/**
 * 小红书下载助手 — 仅在笔记详情页展示，样式与公共能力对齐 YouTube 下载器。
 */
(function () {
  'use strict';

  if (window.__XHS_DL_INIT__) return;
  window.__XHS_DL_INIT__ = true;

  const EXT = typeof browser !== 'undefined' ? browser : chrome;
  const VERSION = EXT.runtime.getManifest().version;
  const ICON_URL = EXT.runtime.getURL('icons/icon128.png');
  const FAQ_URL = 'https://snowflake-hangdudu.github.io/xiaohongshu-downloader/faq.html';
  const PRIVACY_URL = 'https://snowflake-hangdudu.github.io/xiaohongshu-downloader/';
  const CONTENT_JSON_URL = 'http://124.222.62.190:8081/api/config/xiaohongshu';
  const CONTENT_CACHE_KEY = 'xhsDlRemoteContent_v1';
  const STORE_RATING_KEY = 'xhsDlStoreRating_v1';
  const STORE_RATING_MIN_SUCCESS = 10;
  const TERMS_STORAGE_KEY = 'xhs_dl_terms_accepted_v1';
  const MAX_BLOB_DOWNLOAD_BYTES = 500 * 1024 * 1024;
  const DEFAULT_REMOTE_CONTENT = {
    notice: {
      enabled: true,
      title: '公告',
      updated: '2026-08-22',
      body: '暂未获取到最新公告，请稍后再试。\n\n下载功能不受影响。请先打开一篇笔记详情后再保存。',
      pinned: ['请先打开笔记详情页，再按图片 / 视频 / 文字分类保存。'],
      recent: ['已支持在详情页保存图片、视频与文字。'],
      knownIssues: [],
      roadmap: { feedback: [], upcoming: [], planned: [] }
    },
    coop: {
      enabled: true,
      title: '开发合作',
      updated: '2026-08-22',
      body: '接浏览器插件定制开发。\n\n有合作意向请联系 QQ：748604487\n邮箱：hangdudu0@agent.qq.com\n请备注「插件开发」，并简单说明需求。'
    },
    rating: {
      enabled: false,
      url: '',
      edge: '',
      chrome: '',
      firefox: '',
      minSuccess: 10
    }
  };

  let remoteContent = {
    notice: { ...DEFAULT_REMOTE_CONTENT.notice },
    coop: { ...DEFAULT_REMOTE_CONTENT.coop },
    rating: { ...DEFAULT_REMOTE_CONTENT.rating }
  };

  function createFragment(html) {
    return document.createRange().createContextualFragment(html);
  }

  function clearNode(node) {
    node.replaceChildren();
  }

  function appendTextElement(parent, tagName, className, text, title) {
    const el = document.createElement(tagName);
    if (className) el.className = className;
    el.textContent = text;
    if (title) el.title = title;
    parent.appendChild(el);
    return el;
  }

  function storageGet(keys) {
    return new Promise((resolve) => {
      try {
        EXT.storage.local.get(keys, (r) => resolve(r || {}));
      } catch (_) {
        resolve({});
      }
    });
  }

  function storageSet(obj) {
    return new Promise((resolve) => {
      try {
        EXT.storage.local.set(obj, () => resolve());
      } catch (_) {
        resolve();
      }
    });
  }

  function extractNoteId(value) {
    const text = String(value || '');
    const match = text.match(/\/(?:explore|discovery\/item|search_result)\/([0-9a-z]+)/i);
    return match ? match[1] : '';
  }

  function isDetailPage() {
    const path = location.pathname || '';
    if (/^\/explore\/[0-9a-z]+/i.test(path)) return true;
    if (/^\/discovery\/item\//i.test(path)) return true;
    if (/^\/search_result\/[0-9a-z]+/i.test(path)) return true;
    const modal = document.querySelector('#noteContainer, .note-container');
    if (!modal) return false;
    const rect = modal.getBoundingClientRect();
    return rect.width > 120 && rect.height > 120;
  }

  function noteRoot() {
    return (
      document.querySelector('#noteContainer') ||
      document.querySelector('.note-container') ||
      document.querySelector('[class*="note-detail"]') ||
      document.querySelector('main') ||
      document.body
    );
  }

  function normalizeUrl(value) {
    if (!value) return null;
    const raw = String(value).trim().replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
    if (!/^https:\/\//i.test(raw)) return null;
    return raw
      .replace(/([?&])(imageView2|imageMogr2|x-oss-process)=[^&]*/ig, '$1')
      .replace(/[?&]$/, '')
      .replace(/\?&/, '?')
      .replace(/\?$/, '');
  }

  function mediaUrl(value) {
    if (!value) return null;
    const raw = String(value).trim();
    if (/^blob:/i.test(raw)) return raw;
    return normalizeUrl(raw);
  }

  function pickSrc(el) {
    const candidates = [
      el.currentSrc,
      el.src,
      el.dataset?.src,
      el.getAttribute?.('data-src'),
      el.getAttribute?.('srcset')
    ];
    const srcset = el.getAttribute?.('srcset') || el.dataset?.srcset || '';
    if (srcset) {
      const last = srcset.split(',').map((part) => part.trim().split(/\s+/)[0]).filter(Boolean).pop();
      if (last) candidates.unshift(last);
    }
    for (const item of candidates) {
      const url = normalizeUrl(item);
      if (url) return url;
    }
    return null;
  }

  function pickVideoUrl(video) {
    const candidates = [
      video.currentSrc,
      video.src,
      ...[...video.querySelectorAll('source')].map((node) => node.src)
    ];
    for (const item of candidates) {
      const https = normalizeUrl(item);
      if (https) return https;
    }
    for (const item of candidates) {
      const blob = mediaUrl(item);
      if (blob && /^blob:/i.test(blob)) return blob;
    }
    return null;
  }

  function isNoiseMedia(el, url) {
    if (!url) return true;
    if (/avatar|icon|logo|emoji|sticker|qrcode|loading|placeholder|banner-ads/i.test(url)) return true;
    if (el.closest?.('.author-avatar, [class*="avatar"], [class*="user-head"], .comments-container, .comments-el, .comment-item')) return true;
    const w = el.naturalWidth || el.videoWidth || el.width || 0;
    const h = el.naturalHeight || el.videoHeight || el.height || 0;
    if (w && h && (w < 80 || h < 80)) return true;
    return false;
  }

  function walkShadowVideos(root, acc) {
    if (!root) return;
    const videos = root.querySelectorAll ? root.querySelectorAll('video') : [];
    videos.forEach((video) => acc.add(video));
    const nodes = root.querySelectorAll ? root.querySelectorAll('*') : [];
    nodes.forEach((node) => {
      if (node.shadowRoot) walkShadowVideos(node.shadowRoot, acc);
    });
  }

  function findVideoElements() {
    const acc = new Set();
    walkShadowVideos(document, acc);
    return [...acc].filter((video) => {
      if (video.closest('.comments-el, .comments-container, .comment-item, .author-avatar')) return false;
      const rect = video.getBoundingClientRect();
      const wide = rect.width >= 80 && rect.height >= 60;
      const playing = !!(video.currentSrc || video.src) && (video.readyState >= 1 || !video.paused);
      return wide || playing;
    });
  }

  function collectEmbeddedVideoUrls() {
    const urls = [];
    const add = (value) => {
      const url = normalizeUrl(value);
      if (url && /(sns-video|xhscdn|\.mp4|\.webm|\.mov)/i.test(url) && !/\.m3u8(?:[?#]|$)/i.test(url)) urls.push(url);
    };
    document.querySelectorAll('meta[property^="og:video"]').forEach((meta) => add(meta.content));
    document.querySelectorAll('script').forEach((script) => {
      const text = script.textContent || '';
      if (text.length < 80 || text.length > 800000) return;
      if (!/masterUrl|sns-video|originVideoKey|"stream"/.test(text)) return;
      const pairs = text.match(/"masterUrl"\s*:\s*"(https:[^"]+)"/g) || [];
      pairs.forEach((pair) => {
        const match = pair.match(/"(https:[^"]+)"/);
        if (match) add(match[1]);
      });
    });
    return [...new Set(urls)];
  }

  function cssBackgroundUrl(el) {
    if (!el) return null;
    const bg = getComputedStyle(el).backgroundImage || '';
    const match = bg.match(/url\((['"]?)(https:[^'")]+)\1\)/i);
    return match ? normalizeUrl(match[2]) : null;
  }

  function captureVideoFrame(video) {
    try {
      if (!video.videoWidth || !video.videoHeight) return '';
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 360 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.72);
    } catch (_) {
      return '';
    }
  }

  function collectCoverUrls() {
    const covers = [];
    const add = (value) => {
      const url = /^data:image\//i.test(value || '') ? value : normalizeUrl(value);
      if (!url || covers.includes(url)) return;
      if (/avatar|icon|logo/i.test(url)) return;
      covers.push(url);
    };

    findVideoElements().forEach((video) => {
      add(video.poster);
      add(captureVideoFrame(video));
      const host = video.closest('.player-container, .xgplayer, [class*="player"], [class*="video"], [class*="media"]') || video.parentElement;
      if (!host) return;
      [host, ...host.querySelectorAll('[class*="poster"], [class*="cover"], [class*="thumb"]')].forEach((el) => add(cssBackgroundUrl(el)));
      host.querySelectorAll('img').forEach((img) => {
        const url = pickSrc(img);
        if (url && !isNoiseMedia(img, url)) add(url);
      });
    });

    document.querySelectorAll('meta[property="og:image"], meta[property="og:image:url"], meta[name="twitter:image"]').forEach((meta) => add(meta.content));
    document.querySelectorAll('script').forEach((script) => {
      const text = script.textContent || '';
      if (text.length < 80 || text.length > 800000) return;
      if (!/urlDefault|urlPre|"cover"|thumbnail|firstFrame/.test(text)) return;
      const pairs = text.match(/"(?:urlDefault|urlPre|cover|thumbnail)"\s*:\s*"(https:[^"]+)"/g) || [];
      pairs.forEach((pair) => {
        const match = pair.match(/"(https:[^"]+)"/);
        if (match) add(match[1]);
      });
    });
    return covers;
  }

  function collectNote() {
    const root = noteRoot();
    const images = [];
    const videos = [];
    const seen = new Set();

    const add = (url, kind, preview) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      const list = kind === 'video' ? videos : images;
      list.push({ url, kind, preview: preview && !/^blob:/i.test(preview) ? preview : '', index: list.length });
    };

    findVideoElements().forEach((video) => {
      const url = pickVideoUrl(video);
      if (url && !isNoiseMedia(video, url)) add(url, 'video', video.poster || '');
    });
    collectEmbeddedVideoUrls().forEach((url) => add(url, 'video', ''));
    if (videos.some((item) => /^https:/i.test(item.url))) {
      for (let i = videos.length - 1; i >= 0; i -= 1) {
        if (/^blob:/i.test(videos[i].url)) videos.splice(i, 1);
      }
      videos.forEach((item, index) => {
        item.index = index;
      });
    }

    root.querySelectorAll('img').forEach((img) => {
      const url = pickSrc(img);
      if (!isNoiseMedia(img, url)) add(url, 'image', url);
    });

    const title = (
      root.querySelector('#detail-title, #noteContainer .title, [class*="note-title"]')?.textContent ||
      document.querySelector('meta[property="og:title"]')?.content ||
      document.title.replace(/\s*-\s*小红书.*/i, '')
    ).replace(/\s+/g, ' ').trim() || '小红书笔记';

    const author = (
      root.querySelector('.username, .author-wrapper .name, [class*="author-name"], [class*="user-name"]')?.textContent ||
      ''
    ).replace(/\s+/g, ' ').trim();

    const descEl = [
      root.querySelector('#detail-desc .note-text'),
      root.querySelector('#detail-desc'),
      root.querySelector('.note-text'),
      root.querySelector('.desc')
    ].find((el) => el && !el.closest('.comments-el, .comments-container, .comment-item'));

    let body = '';
    if (descEl) {
      const clone = descEl.cloneNode(true);
      clone.querySelectorAll('button, [class*="search"], [class*="relate"], [class*="bottom-container"], [class*="date"]').forEach((node) => node.remove());
      body = (clone.innerText || '').replace(/\u00a0/g, ' ').trim();
    }
    if (!body) {
      body = (document.querySelector('meta[property="og:description"]')?.content || '').trim();
    }

    body = body
      .replace(/\n?猜你想搜[\s\S]*$/g, '')
      .replace(/\n?\d{1,2}-\d{2}(?:\s+\S+)?\s*$/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const lines = body.split(/\n+/).map((line) => line.trim()).filter((line) => {
      if (!line) return false;
      if (/^(展开|收起|翻译|原文|编辑于)/.test(line)) return false;
      if (/^猜你想搜/.test(line)) return false;
      if (/^\d{1,2}-\d{2}(\s+\S+)?$/.test(line)) return false;
      return true;
    });
    if (lines[0] && lines[0] === title) lines.shift();
    body = lines.join('\n').trim();

    const tags = [...(descEl || root).querySelectorAll('a[href*="keyword="], a[href*="/search_result"]')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((text) => text.startsWith('#') && text.length > 1)
      .filter((text, index, list) => list.indexOf(text) === index);

    const parts = [];
    if (title) parts.push(title);
    if (body && body !== title) parts.push(body);
    const extraTags = tags.filter((tag) => !body.includes(tag) && title !== tag);
    if (extraTags.length) parts.push(extraTags.join(' '));
    const text = parts.join('\n\n').trim();
    const cover = collectCoverUrls()[0] || images[0]?.url || videos[0]?.preview || '';
    videos.forEach((item) => {
      if (!item.preview) item.preview = cover;
    });

    return {
      noteId: extractNoteId(location.href) || extractNoteId(root.querySelector('a[href*="/explore/"], a[href*="/discovery/item/"]')?.href),
      title,
      author,
      cover,
      images,
      videos,
      text,
      body,
      tags
    };
  }

  function requestPageVideos() {
    return new Promise((resolve) => {
      const id = 'v' + Date.now() + Math.random().toString(16).slice(2);
      const timer = setTimeout(() => {
        window.removeEventListener('message', onMessage);
        resolve({ urls: [], covers: [] });
      }, 500);
      function onMessage(event) {
        if (event.source !== window) return;
        if (event.data?.source !== 'xhs-dl-agent' || event.data.id !== id) return;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve({
          urls: Array.isArray(event.data.urls) ? event.data.urls : [],
          covers: Array.isArray(event.data.covers) ? event.data.covers : []
        });
      }
      window.addEventListener('message', onMessage);
      window.postMessage({ source: 'xhs-dl-panel', type: 'GET_VIDEOS', id }, '*');
    });
  }

  function mergeVideoUrls(note, payload) {
    const data = Array.isArray(payload) ? { urls: payload, covers: [] } : (payload || {});
    const https = (data.urls || [])
      .map((item) => normalizeUrl(item))
      .filter((url) => url && /(sns-video|\.mp4|\.webm|\.mov)/i.test(url) && !/\.m3u8(?:[?#]|$)/i.test(url));
    const covers = (data.covers || [])
      .map((item) => normalizeUrl(item))
      .filter((url) => url && !/avatar|icon|logo/i.test(url));
    https.forEach((url) => {
      if (note.videos.some((item) => item.url === url)) return;
      note.videos.push({ url, kind: 'video', preview: covers[0] || note.cover || '', index: note.videos.length });
    });
    if (https.length) {
      note.videos = note.videos.filter((item) => !/^blob:/i.test(item.url));
      note.videos.forEach((item, index) => {
        item.index = index;
      });
    }
    if (covers[0] && !note.cover) note.cover = covers[0];
    if (covers[0]) {
      note.videos.forEach((item) => {
        if (!item.preview) item.preview = covers[0];
      });
    }
    return note;
  }

  function mountUI() {
    if (document.getElementById('xhs-dl-panel-root')) return;

    const host = document.body || document.documentElement;
    const panel = document.createElement('div');
    panel.id = 'xhs-dl-panel-root';
    panel.className = 'is-hidden';
    panel.appendChild(createFragment(`
      <div id="xhs-dl-panel" data-theme="xiaohongshu">
        <button id="xhs-dl-toggle" title="保存素材" aria-label="打开下载助手" aria-controls="xhs-dl-menu" aria-expanded="false">
          <img src="${ICON_URL}" alt="">
        </button>
        <div id="xhs-dl-menu" class="hidden" role="dialog" aria-modal="false" aria-label="小红书下载助手">
          <div class="xhs-dl-header">
            <div class="xhs-dl-header-left">
              <img class="xhs-dl-header-icon" src="${ICON_URL}" alt="" width="30" height="30">
              <span class="xhs-dl-title">小红书下载助手</span>
              <span class="xhs-dl-version">v${VERSION}</span>
            </div>
            <button id="xhs-dl-close" aria-label="关闭">&times;</button>
          </div>
          <div class="xhs-dl-body">
            <div id="xhs-dl-home">
              <div id="xhs-dl-detect" class="xhs-dl-detect">
                <span class="xhs-dl-dot"></span>
                <span id="xhs-dl-detect-text">识别笔记中…</span>
              </div>

              <div id="xhs-dl-video-card" class="xhs-dl-video-card">
                <div class="xhs-dl-cover-wrap">
                  <div id="xhs-dl-cover-sk" class="xhs-dl-sk-cover xhs-dl-shimmer"></div>
                  <img id="xhs-dl-cover" class="xhs-dl-cover hidden" alt="">
                  <div id="xhs-dl-cover-ph" class="xhs-dl-cover-ph hidden">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>
                <div class="xhs-dl-video-meta">
                  <div id="xhs-dl-video-sk" class="xhs-dl-video-sk">
                    <span class="xhs-dl-sk-line xhs-dl-shimmer"></span>
                    <span class="xhs-dl-sk-line xhs-dl-shimmer short"></span>
                    <span class="xhs-dl-sk-line xhs-dl-shimmer shorter"></span>
                  </div>
                  <div id="xhs-dl-video-content" class="xhs-dl-video-content hidden">
                    <div id="xhs-dl-video-title" class="xhs-dl-video-title"></div>
                    <div id="xhs-dl-video-author" class="xhs-dl-video-author hidden"></div>
                    <div id="xhs-dl-video-sub" class="xhs-dl-video-sub"></div>
                  </div>
                </div>
              </div>

              <div class="xhs-dl-tabs" role="tablist">
                <button type="button" class="xhs-dl-tab active" data-tab="image" role="tab" aria-selected="true" aria-controls="xhs-dl-panel-image">图片 <span class="xhs-dl-tab-count" data-count="image">0</span></button>
                <button type="button" class="xhs-dl-tab" data-tab="video" role="tab" aria-selected="false" aria-controls="xhs-dl-panel-video">视频 <span class="xhs-dl-tab-count" data-count="video">0</span></button>
                <button type="button" class="xhs-dl-tab" data-tab="text" role="tab" aria-selected="false" aria-controls="xhs-dl-panel-text">文字</button>
              </div>

              <div id="xhs-dl-panel-image" class="xhs-dl-tab-panel">
                <div class="xhs-dl-pl-toolbar">
                  <label class="xhs-dl-pl-checkall"><input id="xhs-dl-check-image" type="checkbox" checked> 全选</label>
                  <span id="xhs-dl-count-image" class="xhs-dl-pl-count">0 张</span>
                </div>
                <div id="xhs-dl-list-image" class="xhs-dl-pl-list"></div>
              </div>

              <div id="xhs-dl-panel-video" class="xhs-dl-tab-panel hidden">
                <div class="xhs-dl-pl-toolbar">
                  <label class="xhs-dl-pl-checkall"><input id="xhs-dl-check-video" type="checkbox" checked> 全选</label>
                  <span id="xhs-dl-count-video" class="xhs-dl-pl-count">0 个</span>
                </div>
                <div id="xhs-dl-list-video" class="xhs-dl-pl-list"></div>
              </div>

              <div id="xhs-dl-panel-text" class="xhs-dl-tab-panel hidden">
                <div id="xhs-dl-text-preview" class="xhs-dl-text-preview is-empty">暂未识别到文字</div>
              </div>

              <div class="xhs-dl-actions">
                <button id="xhs-dl-start" class="xhs-dl-btn" type="button">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
                  <span id="xhs-dl-start-label">下载选中图片</span>
                </button>
                <button id="xhs-dl-secondary" class="xhs-dl-btn xhs-dl-btn-secondary hidden" type="button">复制文字</button>
              </div>
              <div id="xhs-dl-job-list" class="xhs-dl-job-list hidden"></div>
              <div id="xhs-dl-status" class="xhs-dl-status hidden"></div>
            </div>
            <div id="xhs-dl-page" class="xhs-dl-page hidden">
              <button type="button" id="xhs-dl-page-back" class="xhs-dl-page-back">返回下载</button>
              <h3 id="xhs-dl-info-title" class="xhs-dl-page-title"></h3>
              <p id="xhs-dl-info-date" class="xhs-dl-info-date hidden"></p>
              <div id="xhs-dl-info-body" class="xhs-dl-info-body"></div>
            </div>
          </div>
          <div id="xhs-dl-store-rating" class="xhs-dl-store-rating hidden" role="note">
            <p class="xhs-dl-store-rating-title">下载搞定 ⭐ 给个好评呗</p>
            <p class="xhs-dl-store-rating-text">用着顺手的话，去 Edge 商店点个分。</p>
            <button type="button" class="xhs-dl-store-rating-primary" data-action="rate">去 Edge 商店评分 ⭐</button>
            <div class="xhs-dl-store-rating-actions">
              <button type="button" class="xhs-dl-store-rating-ghost" data-action="later">下次再说</button>
              <button type="button" class="xhs-dl-store-rating-ghost" data-action="never">别再问了</button>
            </div>
          </div>
          <div class="xhs-dl-footer">
            <div class="xhs-dl-footer-links">
              <a class="xhs-dl-faq-link" href="${FAQ_URL}" target="_blank" rel="noopener">常见问题</a>
              <a class="xhs-dl-privacy-link" href="${PRIVACY_URL}" target="_blank" rel="noopener">隐私政策</a>
              <a class="xhs-dl-faq-link" href="#notice" data-sheet="notice">公告</a>
              <a class="xhs-dl-faq-link" href="#coop" data-sheet="coop">开发合作</a>
              <a class="xhs-dl-feedback" href="mailto:hangdudu0@agent.qq.com?subject=小红书下载助手反馈">反馈邮箱：hangdudu0@agent.qq.com</a>
            </div>
          </div>
          <div id="xhs-dl-terms" class="xhs-dl-terms hidden" role="dialog" aria-modal="true">
            <div class="xhs-dl-terms-card">
              <h3 class="xhs-dl-terms-title">使用前请确认</h3>
              <p class="xhs-dl-terms-body">仅供<strong>个人学习</strong>。请仅保存你<strong>有权保存</strong>的公开内容，并遵守小红书用户协议与著作权法。请勿用于侵权、绕过登录/付费/私密限制。</p>
              <button type="button" id="xhs-dl-terms-accept" class="xhs-dl-btn">我已知悉并同意</button>
            </div>
          </div>
        </div>
      </div>
    `));
    host.appendChild(panel);

    const root = panel;
    const toggleBtn = panel.querySelector('#xhs-dl-toggle');
    const menu = panel.querySelector('#xhs-dl-menu');
    const closeBtn = panel.querySelector('#xhs-dl-close');
    const detectRow = panel.querySelector('#xhs-dl-detect');
    const detectText = panel.querySelector('#xhs-dl-detect-text');
    const videoCard = panel.querySelector('#xhs-dl-video-card');
    const coverSk = panel.querySelector('#xhs-dl-cover-sk');
    const coverImg = panel.querySelector('#xhs-dl-cover');
    const coverPh = panel.querySelector('#xhs-dl-cover-ph');
    const videoSk = panel.querySelector('#xhs-dl-video-sk');
    const videoContent = panel.querySelector('#xhs-dl-video-content');
    const titleEl = panel.querySelector('#xhs-dl-video-title');
    const authorEl = panel.querySelector('#xhs-dl-video-author');
    const subEl = panel.querySelector('#xhs-dl-video-sub');
    const startBtn = panel.querySelector('#xhs-dl-start');
    const startLabel = panel.querySelector('#xhs-dl-start-label');
    const secondaryBtn = panel.querySelector('#xhs-dl-secondary');
    const jobListEl = panel.querySelector('#xhs-dl-job-list');
    const statusEl = panel.querySelector('#xhs-dl-status');
    const storeRatingEl = panel.querySelector('#xhs-dl-store-rating');
    const termsEl = panel.querySelector('#xhs-dl-terms');
    const termsAcceptBtn = panel.querySelector('#xhs-dl-terms-accept');
    const homeEl = panel.querySelector('#xhs-dl-home');
    const pageEl = panel.querySelector('#xhs-dl-page');
    const pageBack = panel.querySelector('#xhs-dl-page-back');
    const infoTitle = panel.querySelector('#xhs-dl-info-title');
    const infoDate = panel.querySelector('#xhs-dl-info-date');
    const infoBody = panel.querySelector('#xhs-dl-info-body');
    const textPreview = panel.querySelector('#xhs-dl-text-preview');

    let currentTab = 'image';
    let tabTouched = false;
    let lastNoteKey = '';
    let currentNote = { title: '', author: '', cover: '', images: [], videos: [], text: '' };
    let isOpen = false;
    let termsAccepted = false;
    const termsWaiters = [];

    function showStatus(type, text) {
      statusEl.classList.remove('hidden', 'success', 'error');
      statusEl.classList.add(type);
      statusEl.textContent = text;
    }

    function hideStatus() {
      statusEl.classList.add('hidden');
    }

    function setDetect(text, ready) {
      detectText.textContent = text;
      detectRow.classList.toggle('hidden', !!ready);
      detectRow.classList.toggle('is-error', !ready && /失败|无法|未打开/.test(text || ''));
    }

    function setNoteLoading(loading) {
      videoCard.classList.toggle('is-loading', loading);
      coverSk.classList.toggle('hidden', !loading);
      videoSk.classList.toggle('hidden', !loading);
      videoContent.classList.toggle('hidden', loading);
      if (loading) {
        coverImg.classList.add('hidden');
        coverPh.classList.add('hidden');
      }
    }

    function setCover(url) {
      if (!url) {
        coverImg.classList.add('hidden');
        coverPh.classList.remove('hidden');
        return;
      }
      coverImg.referrerPolicy = 'no-referrer';
      coverImg.onload = () => {
        coverImg.classList.remove('hidden');
        coverPh.classList.add('hidden');
      };
      coverImg.onerror = () => {
        coverImg.classList.add('hidden');
        coverPh.classList.remove('hidden');
      };
      coverImg.src = url;
    }

    function renderMediaList(kind) {
      const items = kind === 'video' ? currentNote.videos : currentNote.images;
      const list = panel.querySelector(`#xhs-dl-list-${kind}`);
      const count = panel.querySelector(`#xhs-dl-count-${kind}`);
      const checkAll = panel.querySelector(`#xhs-dl-check-${kind}`);
      const toolbar = list.previousElementSibling;
      clearNode(list);
      toolbar?.classList.toggle('hidden', items.length < 2);
      if (!items.length) {
        appendTextElement(list, 'div', 'xhs-dl-pl-empty', kind === 'video' ? '当前详情页暂未找到视频' : '当前详情页暂未找到图片');
        count.textContent = kind === 'video' ? '0 个' : '0 张';
        checkAll.checked = false;
        return;
      }
      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'xhs-dl-item';
        if (items.length > 1) {
          const check = document.createElement('input');
          check.type = 'checkbox';
          check.checked = true;
          check.dataset.index = String(item.index);
          row.appendChild(check);
        }
        const preview = item.preview && !/^blob:/i.test(item.preview) ? item.preview : currentNote.cover;
        if (preview && !/^blob:/i.test(preview)) {
          const thumb = document.createElement('img');
          thumb.className = 'xhs-dl-thumb';
          thumb.alt = '';
          thumb.referrerPolicy = 'no-referrer';
          thumb.src = preview;
          row.appendChild(thumb);
        } else {
          const thumb = document.createElement('div');
          thumb.className = 'xhs-dl-thumb-ph';
          thumb.textContent = kind === 'video' ? '▶' : '';
          row.appendChild(thumb);
        }
        const meta = document.createElement('div');
        meta.className = 'xhs-dl-item-meta';
        appendTextElement(meta, 'div', 'xhs-dl-pl-title', `${kind === 'video' ? '视频' : '图片'} ${item.index + 1}`);
        appendTextElement(meta, 'div', 'xhs-dl-item-sub', '点右侧下载');
        row.appendChild(meta);
        const dl = document.createElement('button');
        dl.type = 'button';
        dl.className = 'xhs-dl-item-dl';
        dl.dataset.downloadIndex = String(item.index);
        dl.textContent = '下载';
        row.appendChild(dl);
        list.appendChild(row);
      });
      count.textContent = kind === 'video' ? `${items.length} 个` : `${items.length} 张`;
      checkAll.checked = true;
    }

    function selectedItems(kind) {
      const items = kind === 'video' ? currentNote.videos : currentNote.images;
      const checks = [...panel.querySelectorAll(`#xhs-dl-list-${kind} input[type="checkbox"]`)];
      if (!checks.length) return items.slice();
      return checks.filter((node) => node.checked)
        .map((node) => items[Number(node.dataset.index)])
        .filter(Boolean);
    }

    function pickUsefulTab(note) {
      if (tabTouched) return;
      const hasCurrent = currentTab === 'video'
        ? note.videos.length
        : currentTab === 'image'
          ? note.images.length
          : note.text;
      if (hasCurrent) return;
      if (note.videos.length) currentTab = 'video';
      else if (note.images.length) currentTab = 'image';
      else if (note.text) currentTab = 'text';
    }

    function applyTab() {
      panel.querySelectorAll('.xhs-dl-tab').forEach((btn) => {
        const key = btn.dataset.tab;
        btn.classList.toggle('active', key === currentTab);
        btn.setAttribute('aria-selected', String(key === currentTab));
        const empty = key === 'video'
          ? !currentNote.videos.length
          : key === 'image'
            ? !currentNote.images.length
            : !currentNote.text;
        btn.classList.toggle('is-empty', empty);
      });
      ['image', 'video', 'text'].forEach((key) => {
        panel.querySelector(`#xhs-dl-panel-${key}`).classList.toggle('hidden', key !== currentTab);
      });
      const imageCount = currentNote.images.length;
      const videoCount = currentNote.videos.length;
      const imageCountEl = panel.querySelector('[data-count="image"]');
      const videoCountEl = panel.querySelector('[data-count="video"]');
      if (imageCountEl) imageCountEl.textContent = String(imageCount);
      if (videoCountEl) videoCountEl.textContent = String(videoCount);
      if (currentTab === 'text') {
        startLabel.textContent = '下载文字 TXT';
        secondaryBtn.classList.remove('hidden');
        startBtn.disabled = !currentNote.text;
      } else if (currentTab === 'video') {
        startLabel.textContent = videoCount === 1 ? '下载视频' : `下载选中视频${videoCount ? `（${selectedItems('video').length}）` : ''}`;
        secondaryBtn.classList.add('hidden');
        startBtn.disabled = !videoCount;
      } else {
        startLabel.textContent = imageCount === 1 ? '下载图片' : `下载选中图片${imageCount ? `（${selectedItems('image').length}）` : ''}`;
        secondaryBtn.classList.add('hidden');
        startBtn.disabled = !imageCount;
      }
    }

    function renderNote(note, readyText) {
      currentNote = note;
      setNoteLoading(false);
      titleEl.textContent = note.title || '小红书笔记';
      if (note.author) {
        authorEl.textContent = note.author;
        authorEl.classList.remove('hidden');
      } else {
        authorEl.classList.add('hidden');
      }
      subEl.textContent = `图片 ${note.images.length} · 视频 ${note.videos.length} · 文字 ${note.text ? '已识别' : '无'}`;
      videoCard.querySelector('.xhs-dl-cover-wrap')?.classList.toggle('is-portrait', !!note.videos.length && !note.images.length);
      setCover(note.cover);
      renderMediaList('image');
      renderMediaList('video');
      textPreview.textContent = note.text || '暂未识别到文字';
      textPreview.classList.toggle('is-empty', !note.text);
      setDetect(readyText || '已识别当前笔记', true);
      pickUsefulTab(note);
      applyTab();
    }

    function refreshNote() {
      if (!isDetailPage()) {
        currentNote = { title: '', author: '', cover: '', images: [], videos: [], text: '' };
        setNoteLoading(false);
        titleEl.textContent = '未打开笔记详情';
        authorEl.classList.add('hidden');
        subEl.textContent = '请先进入一篇笔记详情页';
        setCover('');
        renderMediaList('image');
        renderMediaList('video');
        textPreview.textContent = '请先打开笔记详情';
        textPreview.classList.add('is-empty');
        setDetect('未打开笔记详情', false);
        startBtn.disabled = true;
        applyTab();
        return currentNote;
      }
      const note = collectNote();
      const key = note.noteId || note.title || location.href;
      if (key !== lastNoteKey) {
        lastNoteKey = key;
        tabTouched = false;
      }
      renderNote(note);
      requestPageVideos().then((urls) => {
        if (!isDetailPage()) return;
        mergeVideoUrls(currentNote, urls);
        renderNote(currentNote);
      });
      return note;
    }

    function syncVisibility() {
      const visible = isDetailPage();
      root.classList.toggle('is-hidden', !visible);
      if (!visible) {
        isOpen = false;
        menu.classList.add('hidden');
        return;
      }
      if (isOpen) refreshNote();
    }

    async function loadTermsAccepted() {
      const r = await storageGet([TERMS_STORAGE_KEY]);
      termsAccepted = r[TERMS_STORAGE_KEY] === true;
      return termsAccepted;
    }

    async function ensureTermsAccepted() {
      if (termsAccepted || (await loadTermsAccepted())) return true;
      termsEl?.classList.remove('hidden');
      return new Promise((resolve) => termsWaiters.push(resolve));
    }

    termsAcceptBtn?.addEventListener('click', async () => {
      termsAccepted = true;
      await storageSet({ [TERMS_STORAGE_KEY]: true });
      termsEl?.classList.add('hidden');
      termsWaiters.splice(0).forEach((resolve) => resolve(true));
    });

    function fillPlainBody(el, text) {
      clearNode(el);
      String(text || '暂无内容')
        .split(/\n+/)
        .forEach((line) => {
          const p = document.createElement('p');
          p.textContent = line;
          el.appendChild(p);
        });
    }

    function toLines(value) {
      if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
      return String(value || '').split(/\n+/).map((item) => item.trim()).filter(Boolean);
    }

    function appendNoticeSection(el, title, value) {
      const lines = toLines(value);
      if (!lines.length) return;
      const section = document.createElement('section');
      section.className = 'xhs-dl-notice-section';
      appendTextElement(section, 'h4', 'xhs-dl-notice-section-title', title);
      const list = document.createElement('ul');
      list.className = 'xhs-dl-notice-list';
      lines.forEach((line) => appendTextElement(list, 'li', '', line));
      section.appendChild(list);
      el.appendChild(section);
    }

    function fillNoticeBody(el, notice) {
      clearNode(el);
      const roadmap = notice?.roadmap && typeof notice.roadmap === 'object' ? notice.roadmap : {};
      const hasStructuredContent = ['pinned', 'recent', 'knownIssues'].some((key) => toLines(notice?.[key]).length) ||
        ['feedback', 'upcoming', 'planned'].some((key) => toLines(roadmap[key]).length);
      if (!hasStructuredContent) {
        if (notice?.body) fillPlainBody(el, notice.body);
        else appendTextElement(el, 'p', 'xhs-dl-notice-empty', '暂无新公告');
        return;
      }
      appendNoticeSection(el, '置顶说明', notice.pinned);
      appendNoticeSection(el, '最近更新', notice.recent);
      appendNoticeSection(el, '已知问题', notice.knownIssues);
      const roadmapRows = [
        ['待反馈需求', roadmap.feedback],
        ['待更新需求', roadmap.upcoming],
        ['待做需求', roadmap.planned]
      ];
      if (roadmapRows.some(([, value]) => toLines(value).length)) {
        const section = document.createElement('section');
        section.className = 'xhs-dl-notice-section';
        appendTextElement(section, 'h4', 'xhs-dl-notice-section-title', '开发计划');
        roadmapRows.forEach(([label, value]) => {
          const lines = toLines(value);
          if (!lines.length) return;
          const group = document.createElement('div');
          group.className = 'xhs-dl-notice-plan';
          appendTextElement(group, 'strong', 'xhs-dl-notice-plan-label', label);
          const list = document.createElement('ul');
          list.className = 'xhs-dl-notice-list';
          lines.forEach((line) => appendTextElement(list, 'li', '', line));
          group.appendChild(list);
          section.appendChild(group);
        });
        el.appendChild(section);
      }
    }

    function detectBrowserStore() {
      const ua = navigator.userAgent || '';
      if (/\bFirefox\b/i.test(ua)) return 'firefox';
      if (/\bEdg\b/i.test(ua)) return 'edge';
      return 'chrome';
    }

    function httpsUrl(value) {
      const url = String(value || '').trim();
      return /^https:\/\//i.test(url) ? url : '';
    }

    function ratingUrl() {
      const rating = remoteContent.rating || {};
      const key = detectBrowserStore();
      return httpsUrl(rating[key]) || httpsUrl(rating.edge) || httpsUrl(rating.url);
    }

    function ratingEnabled() {
      const rating = remoteContent.rating || {};
      return rating.enabled === true && !!ratingUrl();
    }

    function ratingStoreKey() {
      const rating = remoteContent.rating || {};
      const key = detectBrowserStore();
      if (httpsUrl(rating[key])) return key;
      return 'edge';
    }

    function ratingStoreLabel() {
      return { edge: 'Edge', chrome: 'Chrome', firefox: 'Firefox' }[ratingStoreKey()] || 'Edge';
    }

    function applyRatingCopy() {
      const label = ratingStoreLabel();
      const text = storeRatingEl?.querySelector('.xhs-dl-store-rating-text');
      const btn = storeRatingEl?.querySelector('[data-action="rate"]');
      if (text) text.textContent = `用着顺手的话，去 ${label} 商店点个分。`;
      if (btn) btn.textContent = `去 ${label} 商店评分 ⭐`;
    }

  function ratingMinSuccess() {
    const n = Number(remoteContent.rating?.minSuccess);
    return n > 0 ? n : STORE_RATING_MIN_SUCCESS;
  }

  function isOlderVersion(current, minimum) {
    const toParts = (value) => String(value || '').split('.').map((part) => Number(part) || 0);
    const now = toParts(current);
    const required = toParts(minimum);
    const length = Math.max(now.length, required.length);
    for (let index = 0; index < length; index += 1) {
      if ((now[index] || 0) !== (required[index] || 0)) return (now[index] || 0) < (required[index] || 0);
    }
    return false;
  }

    function applyRemoteButtons() {
      panel.querySelectorAll('[data-sheet]').forEach((btn) => {
        const key = btn.getAttribute('data-sheet');
        const item = remoteContent[key];
        btn.classList.toggle('hidden', item && item.enabled === false);
      });
      if (!ratingEnabled()) storeRatingEl?.classList.add('hidden');
      else applyRatingCopy();
    }

    function mergeRemoteContent(data) {
      const configNotice = data.notice && typeof data.notice === 'object'
        ? data.notice
        : {
            enabled: data.enabled,
            title: data.announcementTitle || '公告',
            updated: data.announcementUpdated || data.updatedAt,
            body: data.announcement
          };
    const notice = { ...DEFAULT_REMOTE_CONTENT.notice, ...configNotice };
    if (!toLines(notice.recent).length) notice.recent = DEFAULT_REMOTE_CONTENT.notice.recent.slice();
    if (!toLines(notice.pinned).length) notice.pinned = DEFAULT_REMOTE_CONTENT.notice.pinned.slice();
    const minimum = String(data.minExtensionVersion || '').trim();
    if (/^\d+(?:\.\d+){0,3}$/.test(minimum) && isOlderVersion(VERSION, minimum)) {
      notice.knownIssues = [
        ...toLines(notice.knownIssues),
        `当前版本 v${VERSION} 低于配置要求 v${minimum}，请在扩展管理页更新后再使用。`
      ];
    }
    return {
        notice,
        coop: { ...DEFAULT_REMOTE_CONTENT.coop, ...(data.coop || {}) },
        rating: { ...DEFAULT_REMOTE_CONTENT.rating, ...(data.rating || {}) }
      };
    }

    async function loadRemoteContent() {
      try {
        const resp = await EXT.runtime.sendMessage({ type: 'XHS_DL_FETCH_JSON', url: CONTENT_JSON_URL });
        if (resp?.ok && resp.data && typeof resp.data === 'object') {
          remoteContent = mergeRemoteContent(resp.data);
          await storageSet({ [CONTENT_CACHE_KEY]: { at: Date.now(), data: remoteContent } });
          applyRemoteButtons();
          return remoteContent;
        }
      } catch (_) {}
      const cached = await storageGet([CONTENT_CACHE_KEY]);
      const cachedData = cached[CONTENT_CACHE_KEY]?.data;
      remoteContent = cachedData && typeof cachedData === 'object'
        ? mergeRemoteContent(cachedData)
        : {
            notice: { ...DEFAULT_REMOTE_CONTENT.notice },
            coop: { ...DEFAULT_REMOTE_CONTENT.coop },
            rating: { ...DEFAULT_REMOTE_CONTENT.rating }
          };
      applyRemoteButtons();
      return remoteContent;
    }

    function showHome() {
      pageEl?.classList.add('hidden');
      homeEl?.classList.remove('hidden');
      menu.classList.remove('is-page');
      menu.style.height = '';
      menu.style.minHeight = '';
      menu.style.minHeight = '';
    }

    async function openInfoSheet(key) {
      const locked = menu.offsetHeight;
      if (locked > 0) {
        menu.style.height = locked + 'px';
        menu.style.minHeight = locked + 'px';
      }
      await loadRemoteContent();
      const item = remoteContent[key] || {};
      infoTitle.textContent = item.title || (key === 'coop' ? '开发合作' : '公告');
      if (item.updated) {
        infoDate.textContent = '更新：' + item.updated;
        infoDate.classList.remove('hidden');
      } else {
        infoDate.textContent = '';
        infoDate.classList.add('hidden');
      }
      if (key === 'notice') fillNoticeBody(infoBody, item);
      else fillPlainBody(infoBody, item.body);
      homeEl?.classList.add('hidden');
      pageEl?.classList.remove('hidden');
      menu.classList.add('is-page');
    }

    async function loadStoreRatingState() {
      const r = await storageGet([STORE_RATING_KEY]);
      return r[STORE_RATING_KEY] && typeof r[STORE_RATING_KEY] === 'object' ? r[STORE_RATING_KEY] : {};
    }

    async function saveStoreRatingState(patch) {
      const prev = await loadStoreRatingState();
      await storageSet({ [STORE_RATING_KEY]: { ...prev, ...patch } });
    }

    async function noteDownloadSuccessForRating() {
      try {
        await loadRemoteContent();
        if (!ratingEnabled()) return;
        const s = await loadStoreRatingState();
        if (s.neverAsk) return;
        const count = (Number(s.successCount) || 0) + 1;
        await saveStoreRatingState({ successCount: count, dismissedUntilNextSuccess: false });
        if (count >= ratingMinSuccess()) {
          applyRatingCopy();
          storeRatingEl?.classList.remove('hidden');
        }
      } catch (_) {}
    }

    const activeJobs = new Map();
    const jobWaiters = new Map();

    function formatBytes(n) {
      const v = Number(n) || 0;
      if (v < 1024) return v + ' B';
      if (v < 1048576) return (v / 1024).toFixed(1).replace(/\.0$/, '') + ' KB';
      return (v / 1048576).toFixed(1).replace(/\.0$/, '') + ' MB';
    }

    function itemLabel(item) {
      if (item.kind === 'video') return '视频';
      if (item.kind === 'text') return '文字';
      return '图片';
    }

    function syncJobList() {
      jobListEl.classList.toggle('hidden', !activeJobs.size);
    }

    function finishJob(jobId, result) {
      const job = activeJobs.get(jobId);
      if (job) job.result = result;
      const wait = jobWaiters.get(jobId);
      if (wait) {
        jobWaiters.delete(jobId);
        wait(result);
      }
    }

    function mountJobCard(job) {
      const el = document.createElement('div');
      el.className = 'xhs-dl-progress';
      el.dataset.jobId = job.jobId;
      el.appendChild(createFragment(`
        <div class="xhs-dl-progress-meta">
          <span class="xhs-dl-progress-title"></span>
          <span class="xhs-dl-progress-q"></span>
        </div>
        <div class="xhs-dl-progress-head">
          <span class="xhs-dl-job-phase">准备下载</span>
          <span class="xhs-dl-job-pct">0%</span>
        </div>
        <div class="xhs-dl-progress-track">
          <div class="xhs-dl-progress-bar"></div>
        </div>
        <div class="xhs-dl-progress-actions">
          <button type="button" class="xhs-dl-action-btn" data-act="pause">暂停</button>
          <button type="button" class="xhs-dl-action-btn danger" data-act="cancel">取消</button>
        </div>
      `));
      el.querySelector('.xhs-dl-progress-title').textContent = currentNote.title || '小红书笔记';
      el.querySelector('.xhs-dl-progress-q').textContent = itemLabel(job.item);
      el.querySelector('[data-act="pause"]').addEventListener('click', () => {
        if (!job.downloadId || job.done) return;
        const action = job.paused ? 'resume' : 'pause';
        EXT.runtime.sendMessage({ type: 'XHS_DL_JOB_CTRL', action, downloadId: job.downloadId }).catch(() => {});
      });
      el.querySelector('[data-act="cancel"]').addEventListener('click', () => {
        if (job.done) return;
        if (job.abort) job.abort();
        if (job.downloadId) {
          EXT.runtime.sendMessage({ type: 'XHS_DL_JOB_CTRL', action: 'cancel', downloadId: job.downloadId }).catch(() => {});
        } else {
          updateJob({ jobId: job.jobId, step: 'cancel', percent: 0 });
        }
      });
      job.cardEl = el;
      jobListEl.appendChild(el);
      syncJobList();
      return el;
    }

    function updateJob(payload) {
      const job = activeJobs.get(payload.jobId);
      if (!job || !job.cardEl) return;
      if (payload.downloadId) job.downloadId = payload.downloadId;
      const el = job.cardEl;
      const phaseEl = el.querySelector('.xhs-dl-job-phase');
      const pctEl = el.querySelector('.xhs-dl-job-pct');
      const bar = el.querySelector('.xhs-dl-progress-bar');
      const pauseBtn = el.querySelector('[data-act="pause"]');
      const actions = el.querySelector('.xhs-dl-progress-actions');
      const step = payload.step || 'download';
      const percent = Number(payload.percent) || 0;
      const received = Number(payload.received) || 0;
      const total = Number(payload.total) || 0;

      job.paused = step === 'paused';
      job.done = step === 'done' || step === 'error' || step === 'cancel';
      if (pauseBtn) {
        pauseBtn.textContent = job.paused ? '继续' : '暂停';
        pauseBtn.classList.toggle('hidden', !job.downloadId);
      }
      actions.classList.toggle('hidden', job.done);
      bar.classList.toggle('paused', job.paused);
      bar.classList.toggle('indeterminate', !total && !job.done && step === 'download');

      if (step === 'done') {
        phaseEl.textContent = '已完成';
        pctEl.textContent = '100%';
        bar.style.width = '100%';
        bar.classList.remove('indeterminate', 'paused');
        finishJob(job.jobId, { ok: true });
        return;
      }
      if (step === 'cancel') {
        phaseEl.textContent = '已取消';
        pctEl.textContent = percent ? percent + '%' : '';
        finishJob(job.jobId, { ok: false, error: '已取消' });
        return;
      }
      if (step === 'error') {
        phaseEl.textContent = payload.error || '下载失败';
        pctEl.textContent = '';
        finishJob(job.jobId, { ok: false, error: payload.error || '下载失败' });
        return;
      }
      if (step === 'paused') {
        phaseEl.textContent = total ? `已暂停 ${formatBytes(received)} / ${formatBytes(total)}` : '已暂停';
        pctEl.textContent = percent ? percent + '%' : '';
        bar.style.width = percent + '%';
        return;
      }
      if (step === 'prepare') {
        phaseEl.textContent = '准备下载';
        pctEl.textContent = '0%';
        bar.style.width = '0%';
        return;
      }
      phaseEl.textContent = total
        ? `下载中 ${formatBytes(received)} / ${formatBytes(total)}`
        : '下载中…';
      pctEl.textContent = percent ? percent + '%' : '';
      if (total) bar.style.width = percent + '%';
    }

    async function downloadBlobItem(item, job) {
      const ac = new AbortController();
      job.abort = () => ac.abort();
      const res = await fetch(item.url, { signal: ac.signal });
      if (!res.ok) throw new Error('读取播放数据失败');
      const total = Number(res.headers.get('content-length')) || 0;
      if (total > MAX_BLOB_DOWNLOAD_BYTES) throw new Error('视频超过 500 MB，暂不支持页面内缓存保存');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('无法读取视频流');
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (received > MAX_BLOB_DOWNLOAD_BYTES) {
          ac.abort();
          throw new Error('视频超过 500 MB，已停止页面内缓存保存');
        }
        updateJob({
          jobId: job.jobId,
          step: 'download',
          percent: total ? Math.min(99, Math.round((received / total) * 100)) : 0,
          received,
          total
        });
      }
      const blob = new Blob(chunks, { type: res.headers.get('content-type') || 'video/mp4' });
      if (blob.size < 1024) throw new Error('视频数据过小');
      const ext = /webm/i.test(blob.type) ? 'webm' : 'mp4';
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${String(Number(item.index || 0) + 1).padStart(2, '0')}-视频.${ext}`;
      a.style.display = 'none';
      document.documentElement.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
      updateJob({ jobId: job.jobId, step: 'done', percent: 100, received: blob.size, total: blob.size });
      return { ok: true };
    }

    function waitJob(jobId) {
      const job = activeJobs.get(jobId);
      if (job?.result) return Promise.resolve(job.result);
      return new Promise((resolve) => {
        jobWaiters.set(jobId, resolve);
      });
    }

    async function downloadOne(item) {
      const jobId = 'j' + Date.now() + Math.random().toString(16).slice(2);
      const job = { jobId, item, paused: false, done: false };
      activeJobs.set(jobId, job);
      mountJobCard(job);
      updateJob({ jobId, step: 'prepare', percent: 0 });

      if (item.kind === 'video' && /^blob:/i.test(item.url || '')) {
        try {
          return await downloadBlobItem(item, job);
        } catch (error) {
          if (error.name === 'AbortError') {
            updateJob({ jobId, step: 'cancel', percent: 0 });
            return { ok: false, error: '已取消' };
          }
          updateJob({ jobId, step: 'error', error: error.message || '保存失败' });
          return { ok: false, error: error.message || '保存失败' };
        }
      }

      const done = waitJob(jobId);
      const resp = await EXT.runtime.sendMessage({
        type: 'XHS_DL_DOWNLOAD',
        item,
        title: currentNote.title,
        jobId
      });
      if (!resp?.ok) {
        updateJob({ jobId, step: 'error', error: resp?.error || '保存失败' });
        return resp || { ok: false, error: '保存失败' };
      }
      job.downloadId = resp.id;
      updateJob({ jobId, downloadId: resp.id, step: 'download', percent: 0 });
      return done;
    }

    async function downloadItems(items) {
      if (!(await ensureTermsAccepted())) return;
      if (!items.length) {
        showStatus('error', '请先选择要保存的内容');
        return;
      }
      hideStatus();
      let ok = 0;
      for (const item of items) {
        const result = await downloadOne(item).catch((error) => ({ ok: false, error: error.message || '保存失败' }));
        if (result?.ok) ok += 1;
      }
      if (ok) await noteDownloadSuccessForRating();
    }

    function openPanel() {
      if (!isDetailPage()) return false;
      isOpen = true;
      menu.classList.remove('hidden');
      toggleBtn.setAttribute('aria-expanded', 'true');
      showHome();
      setNoteLoading(true);
      setDetect('识别笔记中…', false);
      refreshNote();
      setTimeout(() => {
        if (isOpen && isDetailPage()) refreshNote();
      }, 600);
      closeBtn.focus({ preventScroll: true });
      return true;
    }

    function closePanel() {
      isOpen = false;
      menu.classList.add('hidden');
      toggleBtn.setAttribute('aria-expanded', 'false');
      showHome();
      toggleBtn.focus({ preventScroll: true });
    }

    toggleBtn.addEventListener('click', () => {
      if (isOpen) closePanel();
      else openPanel();
    });
    closeBtn.addEventListener('click', closePanel);
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !isOpen) return;
      event.preventDefault();
      if (!pageEl?.classList.contains('hidden')) showHome();
      else closePanel();
    });

    panel.querySelectorAll('.xhs-dl-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentTab = btn.dataset.tab;
        tabTouched = true;
        hideStatus();
        applyTab();
      });
    });

    ['image', 'video'].forEach((kind) => {
      panel.querySelector(`#xhs-dl-check-${kind}`).addEventListener('change', (e) => {
        panel.querySelectorAll(`#xhs-dl-list-${kind} input[type="checkbox"]`).forEach((node) => {
          node.checked = e.target.checked;
        });
        applyTab();
      });
      panel.querySelector(`#xhs-dl-list-${kind}`).addEventListener('click', (e) => {
        const btn = e.target.closest('[data-download-index]');
        if (!btn) return;
        e.preventDefault();
        const items = kind === 'video' ? currentNote.videos : currentNote.images;
        const item = items[Number(btn.dataset.downloadIndex)];
        if (item) downloadItems([item]);
      });
      panel.querySelector(`#xhs-dl-list-${kind}`).addEventListener('change', (e) => {
        if (e.target.matches('input[type="checkbox"]')) applyTab();
      });
    });

    startBtn.addEventListener('click', async () => {
      if (currentTab === 'text') {
        if (!currentNote.text) {
          showStatus('error', '暂未识别到文字');
          return;
        }
        await downloadItems([{ kind: 'text', text: currentNote.text, index: 0 }]);
        return;
      }
      await downloadItems(selectedItems(currentTab));
    });

    secondaryBtn.addEventListener('click', async () => {
      if (!currentNote.text) {
        showStatus('error', '暂未识别到文字');
        return;
      }
      try {
        await navigator.clipboard.writeText(currentNote.text);
        showStatus('success', '文字已复制');
      } catch (_) {
        showStatus('error', '复制失败，请手动选择文字');
      }
    });

    panel.querySelectorAll('[data-sheet]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openInfoSheet(btn.getAttribute('data-sheet'));
      });
    });
    pageBack?.addEventListener('click', showHome);

    storeRatingEl?.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        if (action === 'rate') {
          storeRatingEl.classList.add('hidden');
          const url = ratingUrl();
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
          return;
        }
        if (action === 'never') await saveStoreRatingState({ neverAsk: true });
        else await saveStoreRatingState({ dismissedUntilNextSuccess: true });
        storeRatingEl.classList.add('hidden');
      });
    });

    loadTermsAccepted();
    loadRemoteContent();
    syncVisibility();

    window.__XHS_DL_API = {
      isDetailPage,
      isPanelOpen() {
        return isOpen;
      },
      collectNote,
      refreshNote,
      openPanel,
      updateJob,
      getSnapshot() {
        return { info: currentNote, isDetail: isDetailPage() };
      }
    };
  }

  function boot() {
    mountUI();
    window.__XHS_DL_API?.refreshNote?.();
    const root = document.getElementById('xhs-dl-panel-root');
    if (root) root.classList.toggle('is-hidden', !isDetailPage());
  }

  boot();

  let lastHref = location.href;
  let lastDetail = isDetailPage();
  let mediaRefreshTimer = 0;
  function queueMediaRefresh(records) {
    if (!window.__XHS_DL_API?.isPanelOpen?.() || !isDetailPage()) return;
    const panel = document.getElementById('xhs-dl-panel-root');
    const note = noteRoot();
    const changedInNote = records.some((record) => {
      const target = record.target;
      return target instanceof Node && note.contains(target) && !panel?.contains(target);
    });
    if (!changedInNote) return;
    clearTimeout(mediaRefreshTimer);
    mediaRefreshTimer = setTimeout(() => {
      if (window.__XHS_DL_API?.isPanelOpen?.() && isDetailPage()) {
        window.__XHS_DL_API.refreshNote();
      }
    }, 350);
  }
  const observer = new MutationObserver((records) => {
    const href = location.href;
    const detail = isDetailPage();
    if (href !== lastHref || detail !== lastDetail) {
      lastHref = href;
      lastDetail = detail;
      boot();
      if (detail) {
        setTimeout(() => window.__XHS_DL_API?.refreshNote?.(), 600);
      }
      return;
    }
    queueMediaRefresh(records);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset', 'poster']
  });

  EXT.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'XHS_DL_GET_INFO') {
      if (!isDetailPage()) {
        sendResponse({ ok: false, data: null, error: '请先打开一篇笔记详情页' });
        return;
      }
      const note = collectNote();
      requestPageVideos().then((urls) => {
        mergeVideoUrls(note, urls);
        sendResponse({ ok: true, data: { info: note, isDetail: true } });
      });
      return true;
    }
    if (msg?.type === 'XHS_DL_PROGRESS') {
      window.__XHS_DL_API?.updateJob?.(msg);
      return;
    }
    if (msg?.type === 'XHS_DL_OPEN_PANEL') {
      mountUI();
      const opened = window.__XHS_DL_API?.openPanel?.();
      sendResponse({ ok: !!opened, error: opened ? '' : '请先打开一篇笔记详情页' });
    }
  });
})();
