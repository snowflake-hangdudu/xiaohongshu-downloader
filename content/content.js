/**
 * 小红书下载助手 — 仅在笔记详情页展示，样式与公共能力对齐 YouTube 下载器。
 */
(function () {
  'use strict';

  if (window.__XHS_DL_INIT__) return;
  window.__XHS_DL_INIT__ = true;

  const EXT = typeof browser !== 'undefined' ? browser : chrome;

function apiCall(target, method, ...args) {
  if (typeof browser !== 'undefined') {
    try { return Promise.resolve(target[method](...args)); }
    catch (error) { return Promise.reject(error); }
  }
  return new Promise((resolve, reject) => {
    target[method](...args, (result) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(result);
    });
  });
}

  const VERSION = EXT.runtime.getManifest().version;
  const ICON_URL = EXT.runtime.getURL('icons/icon128.png');
  const FAQ_URL = 'https://snowflake-hangdudu.github.io/xiaohongshu-downloader/faq.html';
  const PRIVACY_URL = 'https://snowflake-hangdudu.github.io/xiaohongshu-downloader/';
  const CONTENT_JSON_URL = 'http://124.222.62.190:8081/api/config/xiaohongshu';
  const CONTENT_CACHE_KEY = 'xhsDlRemoteContent_v1';
  const STORE_RATING_KEY = 'xhsDlStoreRating_v1';
  const STORE_RATING_MIN_SUCCESS = 10;
  const MAX_BLOB_DOWNLOAD_BYTES = 500 * 1024 * 1024;
  const FEEDBACK_EMAIL = 'hangdudu0@agent.qq.com';
  const FAB_POS_KEY = 'xiaohongshu-dl-fab-pos-v1';
  const THEME_PREF_KEY = 'xiaohongshu-dl-theme-v1';
  const FILENAME_PREF_KEY = 'xiaohongshu-dl-filename-v1';
  const COVER_WARM_KEY = 'xiaohongshu-dl-covers-v1';
  const RESOURCE_TTL = 6 * 60 * 60 * 1000;
  const FAB_SIZE = 64;
  const FAB_MARGIN = 8;
  const THEME_OPTIONS = [
    ['xiaohongshu', 'themeXiaohongshu'],
    ['tokyo-love', 'theme-tokyo-love'],
    ['manchester-sea', 'theme-manchester-sea'],
    ['chinese-odyssey', 'theme-chinese-odyssey']
  ];
  const FILENAME_PRESETS = {
    'index-kind': '{index}-{kind}',
    'title-author': '{title} - {author}',
    'author-title': '{author} - {title}',
    title: '{title}',
    'title-id': '{title} - {id}',
    detailed: '{title} - {author} - {kind}'
  };
  const FILENAME_CHIPS = [
    ['title', 'chipTitle'],
    ['author', 'chipAuthor'],
    ['id', 'chipId'],
    ['index', 'chipIndex'],
    ['kind', 'chipKind'],
    ['date', 'chipDate']
  ];
  const DEFAULT_FILENAME_TEMPLATE = '{index}-{kind}';
  const FILENAME_TOKENS = ['title', 'author', 'id', 'index', 'kind', 'date', 'quality'];

  function t(key, values) {
    return globalThis.DownloaderKit?.i18n?.t?.(key, values) || key;
  }

  function validateFilenameTemplate(value) {
    const template = String(value || '').trim();
    if (!template || template.length > 180) throw new Error(t('invalidTemplate'));
    if (/[\\/<>:"|?*\x00-\x1f]/.test(template)) throw new Error(t('invalidTemplateChars'));
    const rest = template.replace(/\{([a-zA-Z]+)\}/g, (_, token) => {
      if (!FILENAME_TOKENS.includes(token)) throw new Error(t('unknownToken', { token }));
      return '';
    });
    if (/[{}]/.test(rest)) throw new Error(t('invalidTemplateFormat'));
    return template;
  }

  function applyFilenameTemplate(template, meta, format) {
    const ext = String(format || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const values = {
      title: t('noteLabel'),
      author: '',
      id: '',
      index: '01',
      kind: t('image'),
      quality: '',
      date: new Date().toISOString().slice(0, 10),
      ...meta
    };
    const base = validateFilenameTemplate(template)
      .replace(/\{([a-zA-Z]+)\}/g, (_, token) => String(values[token] ?? ''))
      .replace(/[\\/<>:"|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/[. ]+$/g, '')
      .trim()
      .slice(0, 180) || t('noteLabel');
    return (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base) ? '_' : '') + base + '.' + ext;
  }

  const DEFAULT_REMOTE_CONTENT = {
    notice: {
      enabled: false,
      title: '公告',
      updated: '2026-08-22',
      body: '暂无公告。',
      pinned: ['打开笔记或主页，选择内容下载。'],
      recent: ['支持图片、视频、文字及作品批量下载。'],
      knownIssues: [],
      roadmap: { feedback: [], upcoming: [], planned: [] }
    },
    coop: {
      enabled: false,
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

  function storageGet(keys) { return apiCall(EXT.storage.local, 'get', keys); }
  function storageSet(obj) { return apiCall(EXT.storage.local, 'set', obj); }

  function extractNoteId(value) {
    const text = String(value || '');
    if (!text) return '';
    let match = text.match(/\/(?:explore|discovery\/item|search_result)\/([0-9a-z]+)/i);
    if (match) return match[1];
    // Profile grid cards often link as /user/profile/{userId}/{noteId}
    match = text.match(/\/user\/profile\/[0-9a-z]+\/([0-9a-f]{16,})(?:\/|\?|#|$)/i);
    if (match) return match[1];
    return '';
  }

  function extractUserId(value) {
    const text = String(value || '');
    const match = text.match(/\/user\/profile\/([0-9a-z]+)/i);
    return match ? match[1] : '';
  }

  function isProfilePage() {
    return /^\/user\/profile\/[0-9a-z]+/i.test(location.pathname || '');
  }

  let clickedFeedTab = null;
  let feedSwitchUntil = 0;
  function feedTabCategory(node) {
    const text = (node?.textContent || '').replace(/\s+/g, ' ').trim();
    const match = text.match(/^(笔记|收藏|点赞|喜欢)(?:\s*[·：:]?\s*\d+)?$/);
    return match ? ({ '笔记': 'notes', '收藏': 'collect', '点赞': 'likes', '喜欢': 'likes' })[match[1]] : '';
  }
  function profileFeedCategory() {
    if (!isProfilePage()) return 'notes';
    // XHS switches tabs without updating the URL. A clicked tab takes precedence
    // over a stale tab query parameter, scoped to this exact profile URL.
    if (clickedFeedTab?.href === location.href) return clickedFeedTab.category;
    const nodes = [...document.querySelectorAll('[role="tab"], [class*="tab"], button, span')]
      .filter((node) => !node.closest('#xhs-dl-panel-root, .side-bar, .sidebar') && feedTabCategory(node) && isFeedVisible(node));
    const active = nodes.find((node) => {
      for (let current = node, depth = 0; current && depth < 2; current = current.parentElement, depth += 1) {
        if (current.getAttribute('aria-selected') === 'true') return true;
        if (/(?:^|\s)(?:active|selected|current|is-active|tab-active|reds-tab-active)(?:\s|$)/i.test(String(current.className || ''))) return true;
      }
      return false;
    });
    if (active) return feedTabCategory(active);
    const path = location.pathname;
    const tab = new URLSearchParams(location.search).get('tab') || '';
    if (/\/collect(?:\/|$)/i.test(path) || /collect|fav|收藏/i.test(tab)) return 'collect';
    if (/\/likes?(?:\/|$)/i.test(path) || /like|点赞/i.test(tab)) return 'likes';
    return 'notes';
  }

  function creatorCacheKey(userId) {
    const id = String(userId || extractUserId(location.href) || '').toLowerCase();
    if (!id) return '';
    return id + ':' + profileFeedCategory();
  }

  function isFeedVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    let node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
      if (node.classList.contains('tab-content-item')) {
        // Hidden panes still have a 1px border, so their rect is not exactly zero.
        if (node.style.height === '0px') return false;
        const tabBar = [...document.querySelectorAll('.reds-tab-item.sub-tab-list')];
        const activeIndex = tabBar.findIndex((tab) => tab.classList.contains('active'));
        const panes = [...(node.parentElement?.children || [])].filter((item) => item.classList.contains('tab-content-item'));
        if (activeIndex >= 0 && panes.length === tabBar.length && panes.indexOf(node) !== activeIndex) return false;
        const rect = node.getBoundingClientRect();
        if (rect.height <= 0 || rect.width <= 0 || rect.right <= 0 || rect.left >= window.innerWidth) return false;
      }
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      node = node.parentElement;
    }
    return true;
  }

  function noteCardCover(card) {
    const coverNode = card.querySelector?.('.cover, a.cover, [class*="cover"]');
    if (coverNode) {
      const style = coverNode.getAttribute?.('style') || '';
      const bg = style.match(/url\(["']?(https?:[^"')]+|\/\/[^"')]+)/i)?.[1] || '';
      const fromBg = normalizeUrl(bg);
      if (fromBg) return fromBg;
      const img = coverNode.querySelector?.('img') || (coverNode.tagName === 'IMG' ? coverNode : null);
      const fromImg = normalizeUrl(img?.currentSrc || img?.getAttribute('data-src') || img?.src || '');
      if (fromImg) return fromImg;
    }
    const img = card.querySelector?.('img');
    return normalizeUrl(img?.currentSrc || img?.getAttribute('data-src') || img?.src || '') || '';
  }

  function noteCardFromLink(link) {
    return (
      link.closest('section.note-item, .note-item, .feed-card, [class*="note-item"]') ||
      link.closest('section') ||
      link
    );
  }

  function collectNoteCard(card, posts, context) {
    if (!(card instanceof Element)) return;
    if (card.closest?.('#xhs-dl-panel-root, .side-bar, .sidebar, .comments-container, .comment-item')) return;
    if (!isFeedVisible(card)) return;

    const link =
      card.querySelector('a.cover[href]') ||
      card.querySelector('a[href*="/explore/"]') ||
      card.querySelector('a[href*="/discovery/item/"]') ||
      card.querySelector('a[href*="/search_result/"]') ||
      card.querySelector('a[href*="/user/profile/"]') ||
      (card.matches?.('a[href]') ? card : null);
    let href = link?.href || '';
    const linkedId = extractNoteId(href);
    // Prefer a token-bearing note link over a bare cover/profile link.
    const secured = [...card.querySelectorAll('a[href]')].find((anchor) => {
      if (extractNoteId(anchor.href) !== linkedId) return false;
      try { return Boolean(new URL(anchor.href).searchParams.get('xsec_token')); }
      catch (_) { return false; }
    });
    if (secured) href = secured.href;
    const noteId =
      extractNoteId(href) ||
      extractNoteId(card.getAttribute?.('data-note-id') || card.id || '');
    if (!noteId || posts.has(noteId)) return;

    const title =
      card.querySelector('.title span, .footer .title, .title, a.title, .note-title')?.textContent?.trim() ||
      link?.getAttribute('title') ||
      link?.getAttribute('aria-label') ||
      noteId;
    const cover = noteCardCover(card);
    const isVideo = Boolean(
      card.querySelector('.play-icon, [class*="play-icon"], svg[class*="play"], [class*="video-icon"]')
    );
    posts.set(noteId, {
      noteId,
      title: (title || noteId).replace(/\s+/g, ' ').trim(),
      cover,
      pageUrl: (href || `https://www.xiaohongshu.com/explore/${noteId}`).split('#')[0],
      kind: isVideo ? 'video' : 'image',
      category: context.category,
      author: { name: card.querySelector('.author .name, .author-wrapper .name, .footer .name')?.textContent?.trim() || context.author.name || '', url: card.querySelector('.author[href], .author-wrapper a[href]')?.href || '' }
    });
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

  function isSupportedPage() {
    return isDetailPage() || isProfilePage();
  }

  function profileHeaderDetails() {
    const userId = extractUserId(location.href);
    const feedSel = '#userPostedFeeds, .feeds-container, .note-item, #xhs-dl-panel-root, .side-bar, .sidebar, .channel-container';
    const badUrl = /avatar_default|default.?avatar|placeholder|loading|icon|emoji|qrcode|banner|watermark|ads?/i;
    const avatarCdn = /sns-avatar|avatar\.xhscdn|ci\.xiaohongshu\.com\/avatar|\/avatar\//i;
    const preferredRoots = [
      document.querySelector('.user .avatar-wrapper, .user .avatar, [class*="avatar-wrapper"], [class*="user-image"]'),
      document.querySelector('.user-info, [class*="user-info"], [class*="userInfo"]'),
      document.querySelector('#userPageContainer header, .user-page header, main header'),
      document.querySelector('#userPageContainer .user, .user-page .user, .user')
    ].filter(Boolean);

    const candidates = [];
    const consider = (img, base) => {
      if (!(img instanceof HTMLImageElement)) return;
      if (img.closest?.(feedSel)) return;
      const url = normalizeUrl(img.currentSrc || img.src || '');
      if (!url || badUrl.test(url)) return;
      const rect = img.getBoundingClientRect?.() || { width: 0, height: 0 };
      const w = img.naturalWidth || img.width || rect.width || 0;
      const h = img.naturalHeight || img.height || rect.height || 0;
      if (w && h) {
        const ratio = w / h;
        // Profile banners / covers are wide; avatars are near-square.
        if (ratio > 1.4 || ratio < 0.6) return;
      }
      const size = Math.max(w, h);
      if (size && size < 36) return;

      let score = base;
      if (avatarCdn.test(url)) score += 55;
      if (/头像|avatar|profile/i.test(img.alt || img.title || '')) score += 45;
      if (size >= 56 && size <= 240) score += 30;
      if (size > 360) score -= 40;
      try {
        const style = window.getComputedStyle(img);
        const radius = style.borderRadius || '';
        if (radius.includes('50%') || parseFloat(radius) >= 24) score += 25;
        const parentClass = String(img.parentElement?.className || '');
        if (/avatar|user-image|user-head|head-image/i.test(parentClass)) score += 40;
      } catch (_) {}
      candidates.push({ url, score });
    };

    preferredRoots.forEach((root, index) => {
      root.querySelectorAll('img').forEach((img) => consider(img, 110 - index * 12));
    });
    document.querySelectorAll(
      '.avatar img, [class*="user-image"] img, [class*="avatar-wrapper"] img, img[class*="avatar"]'
    ).forEach((img) => consider(img, 100));

    // og:image only when it clearly looks like an avatar CDN asset.
    const og = normalizeUrl(document.querySelector('meta[property="og:image"]')?.content || '');
    if (og && avatarCdn.test(og) && !/note_pre|spectrum|notes_pre_post/i.test(og)) {
      candidates.push({ url: og, score: 60 });
    }

    candidates.sort((a, b) => b.score - a.score);
    const name =
      document.querySelector('.user-name, .user-nickname, [class*="user-name"], [class*="userName"]')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      userId ||
      t('creator');
    return { userId, avatar: candidates[0]?.url || '', name };
  }

  function profileMeta() {
    const header = isProfilePage()
      ? profileHeaderDetails()
      : { userId: extractUserId(location.href), avatar: '', name: '' };
    const userId = header.userId || extractUserId(location.href);
    const name = header.name ||
      document.querySelector('.user-name, .user-nickname, [class*="user-name"]')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      userId ||
      t('creator');
    return {
      userId,
      name,
      avatar: header.avatar || '',
      url: location.href.split('?')[0]
    };
  }

  function findAuthorProfileUrl(root) {
    const scope = root || document;
    const selectors = [
      '.author-wrapper a[href*="/user/profile/"]',
      '.author a[href*="/user/profile/"]',
      '.user-info a[href*="/user/profile/"]',
      '[class*="author-container"] a[href*="/user/profile/"]',
      '[class*="author"] a[href*="/user/profile/"]',
      'a.name[href*="/user/profile/"]',
      'a[href*="/user/profile/"]'
    ];
    for (const selector of selectors) {
      const link = [...scope.querySelectorAll(selector)].find((anchor) => {
        if (anchor.closest('.comments-el, .comments-container, .comment-item, #xhs-dl-panel-root')) return false;
        return Boolean(extractUserId(anchor.href));
      });
      if (!link?.href) continue;
      try {
        const url = new URL(link.href, location.origin);
        if (extractUserId(url.href)) return url.href.split('?')[0];
      } catch (_) {}
    }
    return '';
  }

  function goCreatorProfile(url) {
    const target = String(url || '').split('?')[0];
    if (!target || !extractUserId(target)) return false;
    if (isProfilePage() && extractUserId(target) === extractUserId(location.href)) return false;
    location.href = target;
    return true;
  }

  function coverDownloadKey(noteId) {
    return String(noteId || '') + ':content:v1';
  }

  function scanCreatorNotes() {
    const posts = new Map();
    const context = { category: profileFeedCategory(), author: profileMeta() };
    // Card-first: XHS profile grids use section.note-item / .feed-card, links may be
    // /explore/{id} or /user/profile/{userId}/{noteId}.
    document
      .querySelectorAll('section.note-item, .note-item, .feed-card, [class*="note-item"]')
      .forEach((card) => collectNoteCard(card, posts, context));

    if (!posts.size) {
      document
        .querySelectorAll(
          'a.cover[href], a[href*="/explore/"], a[href*="/discovery/item/"], a[href*="/search_result/"], a[href*="/user/profile/"]'
        )
        .forEach((link) => {
          if (!extractNoteId(link.href || '')) return;
          collectNoteCard(noteCardFromLink(link), posts, context);
        });
    }
    return [...posts.values()];
  }

  const coverCache = new Map();
  const creatorCaches = new Map();
  let coverCacheReady = storageGet([COVER_WARM_KEY]).then((data) => {
    (Array.isArray(data?.[COVER_WARM_KEY]) ? data[COVER_WARM_KEY] : []).slice(-100).forEach((post) => {
      if (post?.noteId && post.cover && Date.now() - Number(post.resolvedAt || 0) < RESOURCE_TTL) {
        coverCache.set(String(post.noteId), post);
      }
    });
    return true;
  }).catch(() => true);

  function sendRuntime(payload) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: t('connectionTimeout') }), 20000);
      apiCall(EXT.runtime, 'sendMessage', payload).then((response) => {
        clearTimeout(timer);
        resolve(response);
      }, (error) => {
        clearTimeout(timer);
        resolve({
          ok: false,
          error: /context invalidated/i.test(error?.message || '')
            ? t('extensionUpdated')
            : (error?.message || t('connectionFailed'))
        });
      });
    });
  }

  async function readCoverCache(codes) {
    const missing = [...new Set((codes || []).map(String).filter(Boolean))].filter((code) => {
      const cached = coverCache.get(code);
      return !cached || Date.now() - Number(cached.resolvedAt || 0) >= RESOURCE_TTL;
    }).slice(0, 300);
    if (!missing.length) return [];
    const resp = await Promise.race([
      sendRuntime({ type: 'XHS_DL_CACHE_READ', codes: missing }),
      new Promise((resolve) => setTimeout(() => resolve(null), 2000))
    ]);
    const posts = Array.isArray(resp?.posts) ? resp.posts : [];
    posts.forEach((post) => {
      if (!post?.noteId || !post.cover) return;
      coverCache.set(String(post.noteId), post);
      while (coverCache.size > 300) coverCache.delete(coverCache.keys().next().value);
    });
    return posts;
  }

  function cacheCover(post, target) {
    if (!post?.noteId || !post.cover) return;
    const noteId = String(post.noteId);
    const previous = coverCache.get(noteId);
    if (
      previous &&
      Date.now() - Number(previous.resolvedAt || 0) < RESOURCE_TTL &&
      previous.cover === post.cover &&
      previous.title === post.title
    ) {
      if (target) mergeCreatorPosts(target, [previous]);
      return;
    }
    const entry = {
      noteId,
      title: post.title || noteId,
      cover: post.cover,
      pageUrl: post.pageUrl || '',
      kind: post.kind === 'video' ? 'video' : 'image',
      author: post.author || {},
      cacheVersion: 1,
      resolvedAt: Date.now()
    };
    coverCache.delete(noteId);
    coverCache.set(noteId, entry);
    while (coverCache.size > 300) coverCache.delete(coverCache.keys().next().value);
    if (target) mergeCreatorPosts(target, [entry]);
    sendRuntime({ type: 'XHS_DL_CACHE_WRITE', post: entry }).catch(() => {});
  }

  function mergeCreatorPosts(target, list) {
    (Array.isArray(list) ? list : []).forEach((raw) => {
      if (!raw?.noteId) return;
      let post = { ...raw, noteId: String(raw.noteId) };
      const cached = coverCache.get(post.noteId);
      if (cached && Date.now() - Number(cached.resolvedAt || 0) < RESOURCE_TTL) {
        post = {
          ...post,
          ...cached,
          cover: post.cover || cached.cover || '',
          title: (!post.title || post.title === post.noteId) && cached.title ? cached.title : (post.title || cached.title),
          pageUrl: post.pageUrl || cached.pageUrl || '',
          kind: post.kind || cached.kind,
          author: { ...(cached.author || {}), ...(post.author || {}) }
        };
      }
      const previous = target.get(post.noteId);
      if (!previous) {
        target.set(post.noteId, post);
        return;
      }
      const weakTitle = !post.title || post.title === post.noteId;
      target.set(post.noteId, {
        ...previous,
        ...post,
        title: weakTitle && previous.title ? previous.title : (post.title || previous.title),
        cover: post.cover || previous.cover || '',
        pageUrl: /[?&]xsec_token=/.test(previous.pageUrl || '') && !/[?&]xsec_token=/.test(post.pageUrl || '')
          ? previous.pageUrl : (post.pageUrl || previous.pageUrl || ''),
        kind: post.kind || previous.kind,
        author: { ...(previous.author || {}), ...(post.author || {}) },
        resolvedAt: post.resolvedAt || previous.resolvedAt,
        cacheVersion: post.cacheVersion || previous.cacheVersion
      });
    });
    while (target.size > 1000) {
      const oldest = target.keys().next().value;
      target.delete(oldest);
    }
    return target;
  }

  function switchCreatorCache(nextKey, previousKey) {
    const key = String(nextKey || '').toLowerCase();
    if (!key) return new Map();
    if (!creatorCaches.has(key)) creatorCaches.set(key, new Map());
    // Keep insertion order: delete+set moves key to newest when switching.
    if (previousKey && previousKey !== key && creatorCaches.has(previousKey)) {
      const prevMap = creatorCaches.get(previousKey);
      creatorCaches.delete(previousKey);
      creatorCaches.set(previousKey, prevMap);
    }
    const current = creatorCaches.get(key);
    creatorCaches.delete(key);
    creatorCaches.set(key, current);
    // Ins keeps ~5 creators; XHS keys include :notes/:collect/:likes so allow a few more.
    while (creatorCaches.size > 12) {
      const oldest = creatorCaches.keys().next().value;
      if (oldest === key) break;
      creatorCaches.delete(oldest);
    }
    return creatorCaches.get(key);
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
    let raw = String(value).trim().replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
    if (raw.startsWith('//')) raw = 'https:' + raw;
    if (!/^https:\/\//i.test(raw)) return null;
    return raw;
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
      const ranked = srcset.split(',').map((part) => {
        const [url, descriptor] = part.trim().split(/\s+/);
        return { url, size: parseFloat(descriptor) || 1 };
      }).filter((item) => item.url).sort((a, b) => b.size - a.size);
      candidates.unshift(...ranked.map((item) => item.url));
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
    ).replace(/\s+/g, ' ').trim() || t('noteLabel');

    const author = (
      root.querySelector('.username, .author-wrapper .name, [class*="author-name"], [class*="user-name"]')?.textContent ||
      ''
    ).replace(/\s+/g, ' ').trim();
    const authorUrl = findAuthorProfileUrl(root) || findAuthorProfileUrl(document);

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
      authorUrl,
      cover,
      images,
      videos,
      text,
      body,
      tags
    };
  }

  function requestNoteLink(post) {
    return new Promise((resolve) => {
      const id = 'link-' + Date.now() + Math.random().toString(16).slice(2);
      const finish = (url) => {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(url || post.pageUrl);
      };
      const onMessage = (event) => {
        const data = event.data;
        if (event.source !== window || event.origin !== location.origin || data?.source !== 'xhs-dl-agent' ||
          data.type !== 'NOTE_LINK' || data.id !== id || data.noteId !== post.noteId) return;
        try {
          const url = new URL(data.url);
          if (url.origin === location.origin && extractNoteId(url.href) === post.noteId && url.searchParams.get('xsec_token')) finish(url.href);
          else finish('');
        } catch (_) { finish(''); }
      };
      const timer = setTimeout(() => finish(''), 1500);
      window.addEventListener('message', onMessage);
      window.postMessage({ source: 'xhs-dl-panel', type: 'GET_NOTE_LINK', id, noteId: post.noteId }, location.origin);
    });
  }

  function requestNoteImages(noteId) {
    return new Promise((resolve) => {
      const id = 'images-' + Date.now() + Math.random().toString(16).slice(2);
      const finish = (images) => { clearTimeout(timer); window.removeEventListener('message', onMessage); resolve(images); };
      const onMessage = (event) => {
        const data = event.data;
        if (event.source !== window || event.origin !== location.origin || data?.source !== 'xhs-dl-agent' ||
          data.type !== 'NOTE_IMAGES' || data.id !== id || data.noteId !== noteId) return;
        const images = (Array.isArray(data.images) ? data.images : []).filter((item) => {
          try { const url = new URL(item.url); return url.protocol === 'https:' && /(^|\.)(xhscdn\.com|xiaohongshu\.com)$/.test(url.hostname); } catch (_) { return false; }
        });
        finish(images);
      };
      const timer = setTimeout(() => finish([]), 1000);
      window.addEventListener('message', onMessage);
      window.postMessage({ source: 'xhs-dl-panel', type: 'GET_NOTE_IMAGES', id, noteId }, location.origin);
    });
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
    const existing = document.getElementById('xhs-dl-panel-root');
    if (existing) {
      const links = existing.querySelector('.xhs-dl-footer-links');
      const ready = links?.querySelector('[data-sheet="settings"]')
        && existing.querySelector('#xhs-dl-mode-tabs')
        && existing.querySelector('#xhs-dl-creator-body')
        && links?.querySelector('.xhs-dl-feedback');
      if (ready && window.__XHS_DL_API) return;
      existing.remove();
      window.__XHS_DL_API = null;
    }

    const host = document.body || document.documentElement;
    const panel = document.createElement('div');
    panel.id = 'xhs-dl-panel-root';
    panel.className = 'is-hidden';
    panel.appendChild(createFragment(`
      <div id="xhs-dl-panel" data-theme="xiaohongshu">
        <button id="xhs-dl-toggle" title="保存素材" data-i18n-title="saveMedia" aria-label="打开下载助手" data-i18n-aria="openAssistant" aria-controls="xhs-dl-menu" aria-expanded="false">
          <img src="${ICON_URL}" alt="">
        </button>
        <div id="xhs-dl-menu" class="hidden" role="dialog" aria-modal="false" aria-label="小红书下载助手" data-i18n-aria="appTitle">
          <div class="xhs-dl-header">
            <div class="xhs-dl-header-left">
              <img class="xhs-dl-header-icon" src="${ICON_URL}" alt="" width="30" height="30">
              <span class="xhs-dl-title" data-i18n="appTitle">小红书下载助手</span>
              <span class="xhs-dl-version">v${VERSION}</span>
            </div>
            <button id="xhs-dl-close" aria-label="关闭" data-i18n-aria="close">&times;</button>
          </div>
          <div class="xhs-dl-body">
            <div id="xhs-dl-home">
              <div id="xhs-dl-mode-tabs" class="xhs-dl-mode-tabs hidden" role="tablist" data-i18n-aria="modeLabel">
                <button type="button" class="xhs-dl-mode-tab active" data-mode="current" role="tab" aria-selected="true" data-i18n="currentContent">当前笔记</button>
                <button type="button" class="xhs-dl-mode-tab" data-mode="creator" role="tab" aria-selected="false" data-i18n="creator">创作者</button>
              </div>

              <div id="xhs-dl-current-body">
              <div id="xhs-dl-detect" class="xhs-dl-detect">
                <span class="xhs-dl-dot"></span>
                <span id="xhs-dl-detect-text" data-i18n="identifying">识别笔记中…</span>
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
                <button type="button" class="xhs-dl-tab active" data-tab="image" role="tab" aria-selected="true" aria-controls="xhs-dl-panel-image"><span data-i18n="image">图片</span> <span class="xhs-dl-tab-count" data-count="image">0</span></button>
                <button type="button" class="xhs-dl-tab" data-tab="video" role="tab" aria-selected="false" aria-controls="xhs-dl-panel-video"><span data-i18n="video">视频</span> <span class="xhs-dl-tab-count" data-count="video">0</span></button>
                <button type="button" class="xhs-dl-tab" data-tab="text" role="tab" aria-selected="false" aria-controls="xhs-dl-panel-text" data-i18n="text">文字</button>
              </div>

              <div id="xhs-dl-panel-image" class="xhs-dl-tab-panel">
                <div class="xhs-dl-pl-toolbar">
                  <label class="xhs-dl-pl-checkall"><input id="xhs-dl-check-image" type="checkbox" checked> <span data-i18n="selectAll">全选</span></label>
                  <span id="xhs-dl-count-image" class="xhs-dl-pl-count">0 张</span>
                </div>
                <div id="xhs-dl-list-image" class="xhs-dl-pl-list"></div>
              </div>

              <div id="xhs-dl-panel-video" class="xhs-dl-tab-panel hidden">
                <div class="xhs-dl-pl-toolbar">
                  <label class="xhs-dl-pl-checkall"><input id="xhs-dl-check-video" type="checkbox" checked> <span data-i18n="selectAll">全选</span></label>
                  <span id="xhs-dl-count-video" class="xhs-dl-pl-count">0 个</span>
                </div>
                <div id="xhs-dl-list-video" class="xhs-dl-pl-list"></div>
              </div>

              <div id="xhs-dl-panel-text" class="xhs-dl-tab-panel hidden">
                <div id="xhs-dl-text-preview" class="xhs-dl-text-preview is-empty" data-i18n="noText">暂未识别到文字</div>
              </div>

              <div class="xhs-dl-actions">
                <button id="xhs-dl-start" class="xhs-dl-btn" type="button">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
                  <span id="xhs-dl-start-label" data-i18n="downloadSelectedImages">下载选中图片</span>
                </button>
                <button id="xhs-dl-secondary" class="xhs-dl-btn xhs-dl-btn-secondary hidden" type="button" data-i18n="copyText">复制文字</button>
              </div>
              </div>

              <div id="xhs-dl-creator-body" class="xhs-dl-creator-body hidden"></div>

              <div id="xhs-dl-job-list" class="xhs-dl-job-list hidden"></div>
              <div id="xhs-dl-status" class="xhs-dl-status hidden"></div>
            </div>
            <div id="xhs-dl-page" class="xhs-dl-page hidden">
              <button type="button" id="xhs-dl-page-back" class="xhs-dl-page-back" data-i18n="backToDownload">返回下载</button>
              <h3 id="xhs-dl-info-title" class="xhs-dl-page-title"></h3>
              <p id="xhs-dl-info-date" class="xhs-dl-info-date hidden"></p>
              <div id="xhs-dl-info-body" class="xhs-dl-info-body"></div>
            </div>
          </div>
          <div id="xhs-dl-store-rating" class="xhs-dl-store-rating hidden" role="note">
            <p class="xhs-dl-store-rating-title" data-i18n="ratingTitle">下载搞定 ⭐ 给个好评呗</p>
            <p class="xhs-dl-store-rating-text">用着顺手的话，去 Edge 商店点个分。</p>
            <button type="button" class="xhs-dl-store-rating-primary" data-action="rate">去 Edge 商店评分 ⭐</button>
            <div class="xhs-dl-store-rating-actions">
              <button type="button" class="xhs-dl-store-rating-ghost" data-action="later" data-i18n="ratingLater">下次再说</button>
              <button type="button" class="xhs-dl-store-rating-ghost" data-action="never" data-i18n="ratingNever">别再问了</button>
            </div>
          </div>
          <div class="xhs-dl-footer is-actions">
            <div class="xhs-dl-footer-links">
              <button type="button" class="xhs-dl-footer-action" data-sheet="settings" title="设置" data-i18n-title="settings" data-i18n-aria="settings">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="18" r="2"/></svg>
                <span class="xhs-dl-footer-label" data-i18n="settings">设置</span>
              </button>
              <button type="button" class="xhs-dl-footer-action xhs-dl-feedback" data-feedback-email="${FEEDBACK_EMAIL}" data-i18n-title="copyEmail" title="点击复制反馈邮箱">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span class="xhs-dl-feedback-label" data-i18n="feedback">反馈</span>
              </button>
              <button type="button" class="xhs-dl-footer-action" data-sheet="donate" title="自愿赞赏" data-i18n-title="donate" data-i18n-aria="donate">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>
                <span class="xhs-dl-footer-label" data-i18n="donate">赞赏</span>
              </button>
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
    const homeEl = panel.querySelector('#xhs-dl-home');
    const pageEl = panel.querySelector('#xhs-dl-page');
    const pageBack = panel.querySelector('#xhs-dl-page-back');
    const infoTitle = panel.querySelector('#xhs-dl-info-title');
    const infoDate = panel.querySelector('#xhs-dl-info-date');
    const infoBody = panel.querySelector('#xhs-dl-info-body');
    const textPreview = panel.querySelector('#xhs-dl-text-preview');
    const modeTabs = panel.querySelector('#xhs-dl-mode-tabs');
    const currentBody = panel.querySelector('#xhs-dl-current-body');
    const creatorBody = panel.querySelector('#xhs-dl-creator-body');

    let currentTab = 'image';
    let tabTouched = false;
    let lastNoteKey = '';
    let currentNote = { title: '', author: '', authorUrl: '', cover: '', images: [], videos: [], text: '', noteId: '' };
    let isOpen = false;
    let activeMode = 'current';
    let creatorPosts = new Map();
    let selectedCreatorIds = new Set();
    let completedCoverKeys = new Set();
    let creatorKey = '';
    let historyLoaded = false;
    let filenameTemplate = DEFAULT_FILENAME_TEMPLATE;
    let currentTheme = 'xiaohongshu';
    const themedPanel = panel.querySelector('#xhs-dl-panel');

    function applyTheme(value) {
      const theme = THEME_OPTIONS.some(([id]) => id === value) ? value : 'xiaohongshu';
      currentTheme = theme;
      if (themedPanel) themedPanel.dataset.theme = theme;
      return theme;
    }

    async function loadFilenameTemplate() {
      const stored = await storageGet([FILENAME_PREF_KEY]);
      const raw = stored?.[FILENAME_PREF_KEY];
      try {
        filenameTemplate = validateFilenameTemplate(
          typeof raw === 'string' ? raw : (raw?.filenameTemplate || DEFAULT_FILENAME_TEMPLATE)
        );
      } catch (_) {
        filenameTemplate = DEFAULT_FILENAME_TEMPLATE;
      }
      return filenameTemplate;
    }

    async function saveFilenameTemplate(value) {
      const next = validateFilenameTemplate(value);
      filenameTemplate = next;
      await storageSet({ [FILENAME_PREF_KEY]: next });
      return next;
    }

    function buildDownloadName(item, format) {
      const meta = item?.meta || {};
      const index = String(Number(item.index || 0) + 1).padStart(2, '0');
      return applyFilenameTemplate(filenameTemplate, {
        title: meta.title || currentNote.title || t('noteLabel'),
        author: meta.author || currentNote.author || '',
        id: meta.noteId || currentNote.noteId || extractNoteId(location.href) || '',
        index,
        kind: itemLabel(item),
        quality: itemLabel(item),
        date: new Date().toISOString().slice(0, 10)
      }, format);
    }

    function showStatus(type, text) {
      clearTimeout(showStatus.timer);
      statusEl.classList.remove('hidden', 'success', 'error', 'info');
      statusEl.classList.add(type || 'info');
      clearNode(statusEl);
      if (type === 'success') {
        statusEl.appendChild(document.createTextNode(t('saved')));
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'xhs-dl-status-action';
        action.textContent = t('viewDownloads');
        action.addEventListener('click', () => {
          apiCall(EXT.runtime, 'sendMessage', { type: 'XHS_DL_OPEN_DOWNLOADS' }).catch(() => {});
        });
        statusEl.appendChild(action);
      } else {
        statusEl.textContent = text || '';
      }
      showStatus.timer = setTimeout(() => hideStatus(), 5000);
    }

    function hideStatus() {
      clearTimeout(showStatus.timer);
      statusEl.classList.add('hidden');
      clearNode(statusEl);
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
        appendTextElement(list, 'div', 'xhs-dl-pl-empty', kind === 'video' ? t('noVideosFound') : t('noImagesFound'));
        count.textContent = kind === 'video' ? t('countVideos', { count: 0 }) : t('countImages', { count: 0 });
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
        appendTextElement(
          meta,
          'div',
          'xhs-dl-pl-title',
          t('mediaItemLabel', { kind: kind === 'video' ? t('videoOne') : t('imageOne'), index: item.index + 1 })
        );
        appendTextElement(meta, 'div', 'xhs-dl-item-sub', t('clickRightToDownload'));
        row.appendChild(meta);
        const dl = document.createElement('button');
        dl.type = 'button';
        dl.className = 'xhs-dl-item-dl';
        dl.dataset.downloadIndex = String(item.index);
        dl.textContent = t('download');
        row.appendChild(dl);
        list.appendChild(row);
      });
      count.textContent = kind === 'video'
        ? t('countVideos', { count: items.length })
        : t('countImages', { count: items.length });
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
        startLabel.textContent = t('downloadTextTxt');
        secondaryBtn.classList.remove('hidden');
        startBtn.disabled = !currentNote.text;
      } else if (currentTab === 'video') {
        const selected = selectedItems('video').length;
        startLabel.textContent = videoCount === 1
          ? t('video')
          : (selected ? `${t('downloadSelectedVideos')}（${selected}）` : t('downloadSelectedVideos'));
        secondaryBtn.classList.add('hidden');
        startBtn.disabled = !videoCount;
      } else {
        const selected = selectedItems('image').length;
        startLabel.textContent = imageCount === 1
          ? t('image')
          : (selected ? `${t('downloadSelectedImages')}（${selected}）` : t('downloadSelectedImages'));
        secondaryBtn.classList.add('hidden');
        startBtn.disabled = !imageCount;
      }
    }

    function renderNote(note, readyText) {
      currentNote = note;
      setNoteLoading(false);
      titleEl.textContent = note.title || t('noteLabel');
      clearNode(authorEl);
      if (note.author) {
        const profileUrl = note.authorUrl || findAuthorProfileUrl(noteRoot()) || findAuthorProfileUrl(document);
        if (profileUrl) {
          const link = document.createElement('a');
          link.className = 'xhs-dl-author-link';
          link.href = profileUrl;
          link.textContent = note.author;
          link.title = t('openCreatorProfile');
          link.addEventListener('click', (event) => {
            event.preventDefault();
            goCreatorProfile(profileUrl);
          });
          authorEl.appendChild(link);
        } else {
          authorEl.textContent = note.author;
        }
        authorEl.classList.remove('hidden');
      } else {
        authorEl.classList.add('hidden');
      }
      subEl.textContent = t('mediaSummary', {
        images: note.images.length,
        videos: note.videos.length,
        text: note.text ? t('textRecognized') : t('textNone')
      });
      videoCard.querySelector('.xhs-dl-cover-wrap')?.classList.toggle('is-portrait', !!note.videos.length && !note.images.length);
      setCover(note.cover);
      renderMediaList('image');
      renderMediaList('video');
      textPreview.textContent = note.text || t('noText');
      textPreview.classList.toggle('is-empty', !note.text);
      if (note.text) textPreview.removeAttribute('data-i18n');
      else textPreview.setAttribute('data-i18n', 'noText');
      setDetect(readyText || t('recognizedNote'), true);
      pickUsefulTab(note);
      applyTab();
    }

    let noteImagesReady = Promise.resolve();
    function refreshNote() {
      if (!isDetailPage()) {
        currentNote = { title: '', author: '', authorUrl: '', cover: '', images: [], videos: [], text: '', noteId: '' };
        setNoteLoading(false);
        titleEl.textContent = t('needDetail');
        authorEl.classList.add('hidden');
        subEl.textContent = t('needDetail');
        setCover('');
        renderMediaList('image');
        renderMediaList('video');
        textPreview.textContent = t('needDetail');
        textPreview.classList.add('is-empty');
        setDetect(t('needDetail'), false);
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
      noteImagesReady = requestNoteImages(note.noteId).then((images) => {
        if (!isDetailPage() || currentNote.noteId !== note.noteId || !images.length) return;
        const previous = currentNote.images;
        currentNote.images = images.map((item, index) => ({ ...item, index, preview: previous[index]?.preview || item.url,
          fallbackUrls: [...new Set([...(item.fallbackUrls || []), previous[index]?.url].filter((url) => url && url !== item.url))].slice(0, 3) }));
        renderNote(currentNote);
      });
      requestPageVideos().then((urls) => {
        if (!isDetailPage() || currentNote.noteId !== note.noteId) return;
        mergeVideoUrls(currentNote, urls);
        renderNote(currentNote);
      });
      return note;
    }

    function authorProfileUrl() {
      if (isProfilePage()) return location.href.split('?')[0];
      return findAuthorProfileUrl(noteRoot()) || findAuthorProfileUrl(document);
    }

    function syncModes(options = {}) {
      const profileOnly = isProfilePage() && !isDetailPage();
      const hasCreator = profileOnly || Boolean(authorProfileUrl()) || isProfilePage();
      const forceMode = options.forceMode;
      if (forceMode === 'current' || forceMode === 'creator') activeMode = forceMode;
      else if (profileOnly) activeMode = 'creator';
      else if (!hasCreator && activeMode === 'creator') activeMode = 'current';

      modeTabs?.classList.toggle('hidden', profileOnly || !hasCreator);
      modeTabs?.querySelectorAll('[data-mode]').forEach((btn) => {
        const on = btn.dataset.mode === activeMode;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      currentBody?.classList.toggle('hidden', activeMode !== 'current');
      creatorBody?.classList.toggle('hidden', activeMode !== 'creator');
      if (activeMode === 'creator' && !options.skipRefresh) refreshCreatorView({ quiet: true });
    }

    function setActiveMode(mode) {
      if (mode !== 'current' && mode !== 'creator') return;
      activeMode = mode;
      syncModes({ forceMode: mode });
      if (mode === 'current' && isDetailPage()) refreshNote();
    }

    function creatorPostList() {
      return [...creatorPosts.values()];
    }

    async function loadCompletedCoverKeys() {
      if (historyLoaded) return completedCoverKeys;
      try {
        const resp = await sendRuntime({ type: 'XHS_DL_HISTORY_LIST' });
        const history = Array.isArray(resp?.history) ? resp.history : [];
        completedCoverKeys = new Set(
          history
            .filter((item) => item?.status === 'completed')
            .map((item) => item.downloadKey || '')
            .filter(Boolean)
        );
      } catch (_) {
        completedCoverKeys = new Set();
      }
      historyLoaded = true;
      return completedCoverKeys;
    }

    async function appendCoverHistory(posts) {
      const entries = (posts || []).map((post) => ({
        noteId: post.noteId,
        title: post.title || post.noteId,
        author: post.author?.name || '',
        coverUrl: post.cover || '',
        pageUrl: post.pageUrl || '',
        downloadKey: coverDownloadKey(post.noteId),
        kind: post.kind,
        status: 'completed'
      }));
      if (!entries.length) return;
      const resp = await sendRuntime({ type: 'XHS_DL_HISTORY_APPEND', entries });
      entries.forEach((entry) => completedCoverKeys.add(entry.downloadKey));
      if (Array.isArray(resp?.history)) {
        completedCoverKeys = new Set(
          resp.history
            .filter((item) => item?.status === 'completed')
            .map((item) => item.downloadKey || '')
            .filter(Boolean)
        );
      }
    }

    function isCoverDownloaded(noteId) {
      return completedCoverKeys.has(coverDownloadKey(noteId));
    }

    function syncCreatorSelectionUi() {
      const selected = [...selectedCreatorIds].filter((id) => creatorPosts.get(id)?.pageUrl);
      const countEl = creatorBody?.querySelector('.xhs-dl-creator-selection-count');
      if (countEl) countEl.textContent = t('selectedCount', { count: selected.length });
      const downloadBtn = creatorBody?.querySelector('.xhs-dl-creator-download');
      if (downloadBtn) downloadBtn.disabled = !selected.length;
    }

    function creatorEmptyIcon(parent) {
      const icon = document.createElement('div');
      icon.className = 'xhs-dl-empty-icon';
      icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M12 8v8"/></svg>';
      parent.appendChild(icon);
    }

    function renderCreatorGate() {
      clearNode(creatorBody);
      const gate = document.createElement('section');
      gate.className = 'xhs-dl-creator-gate';
      const authorRoot = noteRoot().querySelector('.author-wrapper, .author-container, .author');
      const avatarUrl = authorRoot?.querySelector('img')?.currentSrc || authorRoot?.querySelector('img')?.src || '';
      if (/^https:\/\//i.test(avatarUrl)) {
        const avatar = document.createElement('img');
        avatar.src = avatarUrl;
        avatar.alt = '';
        avatar.style.cssText = 'width:48px;height:48px;border-radius:50%;object-fit:cover';
        gate.appendChild(avatar);
      }
      appendTextElement(gate, 'div', 'xhs-dl-video-title', currentNote.author || t('creator'));
      appendTextElement(gate, 'p', 'xhs-dl-muted', t('creatorGoProfile'));
      const profileUrl = authorProfileUrl();
      const authors = [];
      if (currentNote.author && profileUrl) {
        authors.push({ name: currentNote.author, url: profileUrl });
      } else if (profileUrl) {
        authors.push({ name: t('openCreatorProfile'), url: profileUrl });
      }
      authors.forEach((author) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'xhs-dl-btn xhs-dl-creator-profile-entry';
        btn.textContent = t('openCreatorProfile');
        btn.title = t('openCreatorProfile');
        btn.setAttribute('aria-label', `${author.name} · ${t('openCreatorProfile')}`);
        btn.addEventListener('click', () => goCreatorProfile(author.url));
        gate.appendChild(btn);
      });
      creatorBody.appendChild(gate);
    }

    function renderCreator() {
      if (!creatorBody) return;
      const posts = creatorPostList();
      const scrollTop = creatorBody.querySelector('.xhs-dl-creator-list')?.scrollTop || 0;
      if (!isProfilePage()) {
        renderCreatorGate();
        return;
      }

      const meta = profileMeta();
      const downloadedCount = posts.filter((post) => isCoverDownloaded(post.noteId)).length;
      clearNode(creatorBody);

      const summary = document.createElement('section');
      summary.className = 'xhs-dl-creator-summary';
      const main = document.createElement('div');
      main.className = 'xhs-dl-creator-main';
      const avatar = document.createElement('div');
      avatar.className = 'xhs-dl-creator-avatar';
      if (meta.avatar) {
        const img = document.createElement('img');
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.src = meta.avatar;
        img.addEventListener('error', () => {
          img.remove();
          avatar.textContent = (meta.name || 'X').slice(0, 1).toUpperCase();
        }, { once: true });
        avatar.appendChild(img);
      } else {
        avatar.textContent = (meta.name || 'X').slice(0, 1).toUpperCase();
      }
      const identity = document.createElement('div');
      identity.className = 'xhs-dl-creator-identity';
      if (meta.url) {
        const nameLink = document.createElement('a');
        nameLink.className = 'xhs-dl-creator-name-link';
        nameLink.href = meta.url;
        nameLink.textContent = meta.name || t('creator');
        nameLink.title = t('openCreatorProfile');
        nameLink.addEventListener('click', (event) => {
          event.preventDefault();
          goCreatorProfile(meta.url);
        });
        identity.appendChild(nameLink);
      } else {
        appendTextElement(identity, 'strong', '', meta.name || t('creator'));
      }
      appendTextElement(
        identity,
        'span',
        'xhs-dl-count',
        posts.length
          ? t('creatorStats', { total: posts.length, downloaded: downloadedCount })
          : t('scanReady')
      );
      main.append(avatar, identity);
      const refresh = document.createElement('button');
      refresh.type = 'button';
      refresh.className = 'xhs-dl-mini-btn xhs-dl-scan-btn';
      refresh.textContent = t('refreshPosts');
      refresh.addEventListener('click', () => refreshCreatorView());
      summary.append(main, refresh);
      creatorBody.appendChild(summary);

      appendTextElement(creatorBody, 'p', 'xhs-dl-creator-hint', creatorFeedHint());

      const tools = document.createElement('div');
      tools.className = 'xhs-dl-list-toolbar';
      appendTextElement(tools, 'span', 'xhs-dl-list-count', t('listNoteCount', { count: posts.length }));
      const toolActions = document.createElement('div');
      toolActions.className = 'xhs-dl-list-actions';
      const selectAllBtn = document.createElement('button');
      selectAllBtn.type = 'button';
      selectAllBtn.className = 'xhs-dl-mini-btn';
      selectAllBtn.textContent = t('selectAllShort');
      selectAllBtn.addEventListener('click', () => {
        selectedCreatorIds = new Set(posts.filter((post) => post.pageUrl).map((post) => post.noteId));
        renderCreator();
      });
      const selectNewBtn = document.createElement('button');
      selectNewBtn.type = 'button';
      selectNewBtn.className = 'xhs-dl-mini-btn';
      selectNewBtn.textContent = t('selectNewShort');
      selectNewBtn.addEventListener('click', () => {
        selectedCreatorIds = new Set(
          posts.filter((post) => post.pageUrl && !isCoverDownloaded(post.noteId)).map((post) => post.noteId)
        );
        renderCreator();
      });
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'xhs-dl-mini-btn';
      clearBtn.textContent = t('clearShort');
      clearBtn.addEventListener('click', () => {
        selectedCreatorIds = new Set();
        renderCreator();
      });
      toolActions.append(selectAllBtn, selectNewBtn, clearBtn);
      tools.append(toolActions);
      creatorBody.appendChild(tools);

      const list = document.createElement('div');
      list.className = 'xhs-dl-creator-list';
      if (!posts.length) {
        list.classList.add('is-empty');
        const empty = document.createElement('div');
        empty.className = 'xhs-dl-empty-card';
        empty.setAttribute('role', 'status');
        creatorEmptyIcon(empty);
        appendTextElement(empty, 'strong', '', t('creatorEmptyTitle'));
        appendTextElement(empty, 'p', '', t('creatorEmptyDetail'));
        list.appendChild(empty);
      } else {
        posts.forEach((post) => {
          const row = document.createElement('article');
          row.className = 'xhs-dl-creator-item';
          const check = document.createElement('input');
          check.type = 'checkbox';
          check.className = 'xhs-dl-checkbox';
          check.checked = selectedCreatorIds.has(post.noteId);
          check.disabled = !post.pageUrl;
          check.title = post.cover ? t('selectAll') : t('coverUnavailable');
          check.addEventListener('change', () => {
            if (check.checked) selectedCreatorIds.add(post.noteId);
            else selectedCreatorIds.delete(post.noteId);
            syncCreatorSelectionUi();
          });
          const slot = document.createElement('div');
          slot.className = 'xhs-dl-creator-cover-slot';
          const placeholder = document.createElement('div');
          placeholder.className = 'xhs-dl-creator-cover xhs-dl-creator-cover-ph' + (post.cover ? ' hidden' : '');
          placeholder.textContent = post.kind === 'video' ? '▶' : '';
          slot.appendChild(placeholder);
          if (post.cover) {
            const thumb = document.createElement('img');
            thumb.className = 'xhs-dl-creator-cover';
            thumb.alt = '';
            thumb.referrerPolicy = 'no-referrer';
            thumb.loading = 'lazy';
            thumb.addEventListener('error', () => {
              thumb.remove();
              placeholder.classList.remove('hidden');
            }, { once: true });
            thumb.src = post.cover;
            slot.appendChild(thumb);
          }
          const body = document.createElement('div');
          body.className = 'xhs-dl-creator-item-body';
          const title = document.createElement('a');
          title.className = 'xhs-dl-creator-item-title';
          title.href = post.pageUrl || '#';
          title.target = '_blank';
          title.rel = 'noopener';
          title.textContent = post.title || post.noteId;
          body.appendChild(title);
          const footer = document.createElement('div');
          footer.className = 'xhs-dl-creator-item-footer';
          appendTextElement(
            footer,
            'div',
            'xhs-dl-creator-item-meta',
            post.kind === 'video' ? t('videoOne') : t('imageOne')
          );
          if (isCoverDownloaded(post.noteId)) {
            appendTextElement(footer, 'span', 'xhs-dl-status-pill is-done', t('statusDownloaded'));
          } else if (!post.cover) {
            appendTextElement(footer, 'span', 'xhs-dl-creator-resource-status', t('coverUnavailable'));
          } else {
            appendTextElement(footer, 'span', 'xhs-dl-status-pill is-new', t('statusNew'));
          }
          body.appendChild(footer);
          row.append(check, slot, body);
          list.appendChild(row);
        });
      }
      creatorBody.appendChild(list);

      const selection = document.createElement('div');
      selection.className = 'xhs-dl-creator-selection';
      const selectedCount = [...selectedCreatorIds].filter((id) => creatorPosts.get(id)?.pageUrl).length;
      appendTextElement(
        selection,
        'p',
        'xhs-dl-creator-selection-count',
        t('selectedCount', { count: selectedCount })
      );
      const downloadBtn = document.createElement('button');
      downloadBtn.type = 'button';
      downloadBtn.className = 'xhs-dl-btn xhs-dl-creator-download';
      downloadBtn.disabled = !selectedCount;
      downloadBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>';
      const label = document.createElement('span');
      label.textContent = t('downloadSelectedCovers');
      downloadBtn.appendChild(label);
      downloadBtn.addEventListener('click', () => {
        downloadSelectedCreatorCovers().catch(() => {});
      });
      selection.appendChild(downloadBtn);
      creatorBody.appendChild(selection);
      list.scrollTop = scrollTop;
    }

    let creatorRefreshGeneration = 0;
    async function refreshCreatorView(options = {}) {
      const generation = ++creatorRefreshGeneration;
      await Promise.all([coverCacheReady, loadCompletedCoverKeys()]);
      if (generation !== creatorRefreshGeneration) return creatorPostList();
      if (!isProfilePage()) {
        selectedCreatorIds = new Set();
        creatorKey = '';
        creatorPosts = new Map();
        renderCreator();
        return creatorPostList();
      }
      if (Date.now() < feedSwitchUntil) {
        await new Promise((resolve) => setTimeout(resolve, feedSwitchUntil - Date.now()));
        if (generation !== creatorRefreshGeneration) return creatorPostList();
      }
      const meta = profileMeta();
      const nextKey = creatorCacheKey(meta.userId || meta.url);
      const categoryChanged = Boolean(nextKey && creatorKey && nextKey !== creatorKey);
      if (nextKey && nextKey !== creatorKey) {
        const previousKey = creatorKey;
        creatorKey = nextKey;
        selectedCreatorIds = new Set();
        creatorPosts = switchCreatorCache(nextKey, previousKey);
        creatorPosts.clear();
        renderCreator();
      } else if (nextKey && !creatorKey) {
        creatorKey = nextKey;
        creatorPosts = switchCreatorCache(nextKey);
      }

      const targetPosts = creatorPosts;
      const targetKey = creatorKey;
      const isCurrent = () => generation === creatorRefreshGeneration && creatorKey === targetKey && creatorCacheKey(meta.userId || meta.url) === targetKey;
      const before = creatorPosts.size;
      // Prefer a quick first paint; only retry when still empty (tab mount race).
      let scanned = scanCreatorNotes();
      if (!scanned.length && !options.skipRetry) {
        if (!before && creatorBody && !options.quiet) {
          const empty = creatorBody.querySelector('.xhs-dl-creator-empty .xhs-dl-video-title');
          if (empty) empty.textContent = t('scanReady');
        }
        for (const wait of [120, 320, 700]) {
          await new Promise((resolve) => setTimeout(resolve, wait));
          if (!isProfilePage()) return creatorPostList();
          if (creatorCacheKey(meta.userId || meta.url) !== creatorKey) return creatorPostList();
          scanned = scanCreatorNotes();
          if (scanned.length) break;
        }
      }
      if (!isCurrent()) return creatorPostList();
      mergeCreatorPosts(targetPosts, scanned);
      await readCoverCache(scanned.map((post) => post.noteId).concat([...creatorPosts.keys()]));
      if (!isCurrent()) return creatorPostList();
      mergeCreatorPosts(
        creatorPosts,
        [...creatorPosts.keys()].map((id) => coverCache.get(String(id))).filter(Boolean)
      );
      scanned.forEach((post) => {
        const merged = creatorPosts.get(post.noteId);
        if (merged?.cover) cacheCover(merged, creatorPosts);
      });

      if (!options.quiet || categoryChanged) {
        const keep = new Set(creatorPosts.keys());
        selectedCreatorIds = new Set([...selectedCreatorIds].filter((id) => keep.has(id)));
      }
      // Always re-render after an explicit refresh / category switch / size change.
      if (
        !options.quiet ||
        categoryChanged ||
        before !== creatorPosts.size ||
        !creatorBody?.querySelector('.xhs-dl-creator-list')
      ) {
        renderCreator();
      } else {
        const countEl = creatorBody.querySelector('.xhs-dl-list-count');
        if (countEl) countEl.textContent = t('listNoteCount', { count: creatorPosts.size });
        const statusEl = creatorBody.querySelector('.xhs-dl-count');
        if (statusEl) {
          const downloadedCount = creatorPostList().filter((post) => isCoverDownloaded(post.noteId)).length;
          statusEl.textContent = creatorPosts.size
            ? t('creatorStats', { total: creatorPosts.size, downloaded: downloadedCount })
            : t('scanReady');
        }
        const hint = creatorBody.querySelector('.xhs-dl-creator-hint');
        if (hint) hint.textContent = creatorFeedHint();
      }
      return creatorPostList();
    }

    function creatorFeedHint() {
      const category = profileFeedCategory();
      if (category === 'collect') return t('creatorCollectHint');
      if (category === 'likes') return t('creatorLikesHint');
      return t('creatorDownloadHint');
    }

    let creatorDownloadRunning = false;
    async function downloadSelectedCreatorCovers() {
      if (creatorDownloadRunning) return;
      creatorDownloadRunning = true;
      try {
      const selected = creatorPostList().filter((post) => selectedCreatorIds.has(post.noteId) && post.pageUrl);
      if (!selected.length) {
        showStatus('error', t('selectCoversFirst'));
        return;
      }
      hideStatus();
      const okPosts = [];
      const errors = [];
      for (const post of selected) {
        const pageUrl = await requestNoteLink(post);
        const resolved = await sendRuntime({ type: 'XHS_DL_RESOLVE_NOTE', post: { ...post, pageUrl } });
        if (!resolved?.ok || !resolved.items?.length) {
          errors.push((post.title || post.noteId) + '：' + (resolved?.error || t('resolveFailed')));
          continue;
        }
        let completed = true;
        for (let index = 0; index < resolved.items.length; index += 1) {
          const item = {
            ...resolved.items[index], index,
            preview: post.cover,
            meta: { title: resolved.title || post.title, author: resolved.author || '', noteId: post.noteId }
          };
          const result = await downloadOne(item, { quiet: true }).catch((error) => ({ ok: false, error: error.message }));
          if (!result?.ok) {
            completed = false;
            errors.push((post.title || post.noteId) + '：' + (result?.error || t('downloadFailed')));
            break;
          }
        }
        if (completed) okPosts.push({ ...post, kind: resolved.kind });
      }
      if (okPosts.length) {
        await appendCoverHistory(okPosts);
        await noteDownloadSuccessForRating();
        showStatus('success', t('saved'));
      } else {
        showStatus('error', t('downloadFailed'));
      }
      if (errors.length) showStatus('error', errors.slice(0, 3).join('；'));
      renderCreator();
      } finally { creatorDownloadRunning = false; }
    }

    function syncVisibility() {
      const visible = isSupportedPage();
      root.classList.toggle('is-hidden', !visible);
      if (!visible) {
        isOpen = false;
        menu.classList.add('hidden');
        return;
      }
      syncModes();
      if (isOpen) {
        if (activeMode === 'creator') refreshCreatorView();
        else if (isDetailPage()) refreshNote();
      }
    }

    function fillPlainBody(el, text) {
      clearNode(el);
      String(text || t('noContent'))
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
        else appendTextElement(el, 'p', 'xhs-dl-notice-empty', t('noticeEmpty'));
        return;
      }
      appendNoticeSection(el, t('noticePinned'), notice.pinned);
      appendNoticeSection(el, t('noticeRecent'), notice.recent);
      appendNoticeSection(el, t('noticeIssues'), notice.knownIssues);
      const roadmapRows = [
        [t('noticeFeedbackItems'), roadmap.feedback],
        [t('noticeUpcomingItems'), roadmap.upcoming],
        [t('noticePlannedItems'), roadmap.planned]
      ];
      if (roadmapRows.some(([, value]) => toLines(value).length)) {
        const section = document.createElement('section');
        section.className = 'xhs-dl-notice-section';
        appendTextElement(section, 'h4', 'xhs-dl-notice-section-title', t('noticeRoadmap'));
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
      if (text) text.textContent = t('ratingText', { store: label });
      if (btn) btn.textContent = t('ratingGo', { store: label });
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
        if (key === 'settings' || key === 'donate') {
          btn.classList.remove('hidden');
          btn.hidden = false;
          return;
        }
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
            title: data.announcementTitle || t('notice'),
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
        t('versionTooLow', { current: VERSION, minimum })
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
        const resp = await apiCall(EXT.runtime, 'sendMessage', { type: 'XHS_DL_FETCH_JSON', url: CONTENT_JSON_URL });
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
      pageEl?.classList.remove('is-donate');
      homeEl?.classList.remove('hidden');
      menu.classList.remove('is-page');
      menu.style.height = '';
      menu.style.minHeight = '';
      if (infoTitle) infoTitle.dataset.sheet = '';
    }

    function fillSettingsBody(el) {
      clearNode(el);
      const root = document.createElement('div');
      root.className = 'xhs-dl-settings';

      const themeRow = document.createElement('div');
      themeRow.className = 'xhs-dl-settings-row';
      appendTextElement(themeRow, 'span', '', t('theme'));
      const themeControl = document.createElement('div');
      themeControl.className = 'xhs-dl-settings-theme-control';
      const themeTrigger = document.createElement('button');
      themeTrigger.type = 'button';
      themeTrigger.className = 'xhs-dl-settings-theme-trigger';
      themeTrigger.setAttribute('aria-label', t('theme'));
      themeTrigger.setAttribute('aria-haspopup', 'listbox');
      themeTrigger.setAttribute('aria-expanded', 'false');
      const currentSwatch = document.createElement('span');
      currentSwatch.className = 'xhs-dl-settings-theme-swatch xhs-dl-settings-theme-current-swatch';
      currentSwatch.setAttribute('aria-hidden', 'true');
      const currentLabel = document.createElement('span');
      currentLabel.className = 'xhs-dl-settings-theme-current-label';
      const chevron = document.createElement('span');
      chevron.className = 'xhs-dl-settings-theme-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      themeTrigger.append(currentSwatch, currentLabel, chevron);
      const themeOptions = document.createElement('div');
      themeOptions.className = 'xhs-dl-settings-theme-options hidden';
      themeOptions.setAttribute('role', 'listbox');

      function syncThemePicker() {
        const entry = THEME_OPTIONS.find(([id]) => id === currentTheme) || THEME_OPTIONS[0];
        currentLabel.textContent = t(entry[1]);
        currentSwatch.dataset.theme = entry[0];
        themeOptions.querySelectorAll('[data-theme-option]').forEach((option) => {
          option.setAttribute('aria-selected', String(option.dataset.themeOption === currentTheme));
        });
      }

      function setThemeMenuOpen(open) {
        themeOptions.classList.toggle('hidden', !open);
        themeTrigger.setAttribute('aria-expanded', String(open));
        themeControl.classList.toggle('is-open', open);
      }

      THEME_OPTIONS.forEach(([value, labelKey]) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'xhs-dl-settings-theme-option';
        option.dataset.themeOption = value;
        option.setAttribute('role', 'option');
        const swatch = document.createElement('span');
        swatch.className = 'xhs-dl-settings-theme-swatch';
        swatch.dataset.theme = value;
        swatch.setAttribute('aria-hidden', 'true');
        const optionLabel = document.createElement('span');
        optionLabel.textContent = t(labelKey);
        option.append(swatch, optionLabel);
        option.addEventListener('click', async () => {
          const previous = currentTheme;
          applyTheme(value);
          syncThemePicker();
          setThemeMenuOpen(false);
          try {
            await storageSet({ [THEME_PREF_KEY]: value });
            status.textContent = t('themeSaved');
          } catch (error) {
            applyTheme(previous);
            syncThemePicker();
            status.textContent = error?.message || t('themeSaveFailed');
          }
        });
        themeOptions.appendChild(option);
      });
      themeTrigger.addEventListener('click', () => {
        setThemeMenuOpen(themeOptions.classList.contains('hidden'));
      });
      themeControl.append(themeTrigger, themeOptions);
      themeRow.appendChild(themeControl);
      root.appendChild(themeRow);

      const languageRow = document.createElement('div');
      languageRow.className = 'xhs-dl-settings-row';
      appendTextElement(languageRow, 'span', '', t('language'));
      const languageControl = document.createElement('div');
      languageControl.className = 'xhs-dl-settings-control';
      const languageWrap = document.createElement('div');
      languageWrap.className = 'xhs-dl-settings-select-wrap';
      const languageSelect = document.createElement('select');
      languageSelect.className = 'xhs-dl-settings-select';
      languageSelect.setAttribute('aria-label', t('language'));
      [
        ['en', t('english')],
        ['zh-CN', t('chinese')]
      ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        languageSelect.appendChild(option);
      });
      languageSelect.value = globalThis.DownloaderKit?.i18n?.language?.() || 'zh-CN';
      languageSelect.addEventListener('mousedown', () => setThemeMenuOpen(false));
      languageSelect.addEventListener('change', () => {
        const value = languageSelect.value === 'en' ? 'en' : 'zh-CN';
        globalThis.DownloaderKit?.i18n?.save?.(value).then(() => applyLanguage()).catch(() => {});
      });
      languageWrap.appendChild(languageSelect);
      languageControl.appendChild(languageWrap);
      languageRow.appendChild(languageControl);
      root.appendChild(languageRow);

      const presetRow = document.createElement('div');
      presetRow.className = 'xhs-dl-settings-row';
      appendTextElement(presetRow, 'span', '', t('filename'));
      const filenameControl = document.createElement('div');
      filenameControl.className = 'xhs-dl-settings-control';
      const presetWrap = document.createElement('div');
      presetWrap.className = 'xhs-dl-settings-select-wrap';
      const preset = document.createElement('select');
      preset.className = 'xhs-dl-settings-select';
      preset.setAttribute('aria-label', t('filenameRule'));
      preset.addEventListener('mousedown', () => setThemeMenuOpen(false));
      [
        ['index-kind', t('presetIndexKind')],
        ['title-author', t('presetDefault')],
        ['author-title', t('presetAuthorTitle')],
        ['title', t('presetTitle')],
        ['title-id', t('presetTitleId')],
        ['detailed', t('presetDetailed')],
        ['custom', t('presetCustom')]
      ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        preset.appendChild(option);
      });
      presetWrap.appendChild(preset);
      filenameControl.appendChild(presetWrap);
      presetRow.appendChild(filenameControl);
      root.appendChild(presetRow);

      const customBlock = document.createElement('div');
      customBlock.className = 'xhs-dl-settings-custom';
      customBlock.hidden = true;
      const template = document.createElement('input');
      template.type = 'text';
      template.className = 'xhs-dl-settings-input';
      template.maxLength = 180;
      template.spellcheck = false;
      template.autocomplete = 'off';
      template.placeholder = '{index}-{kind}';
      template.setAttribute('aria-label', t('customTemplate'));
      customBlock.appendChild(template);
      const chips = document.createElement('div');
      chips.className = 'xhs-dl-settings-chips';
      FILENAME_CHIPS.forEach(([key, label]) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'xhs-dl-settings-chip';
        chip.textContent = t(label);
        chip.title = '{' + key + '}';
        chip.addEventListener('click', () => {
          const start = template.selectionStart ?? template.value.length;
          const end = template.selectionEnd ?? start;
          const token = '{' + key + '}';
          template.value = template.value.slice(0, start) + token + template.value.slice(end);
          const pos = start + token.length;
          template.focus();
          template.setSelectionRange(pos, pos);
          syncPresetFromTemplate();
          refreshPreview();
          queueSave();
        });
        chips.appendChild(chip);
      });
      customBlock.appendChild(chips);
      root.appendChild(customBlock);

      const preview = document.createElement('p');
      preview.className = 'xhs-dl-settings-preview';
      const error = document.createElement('p');
      error.className = 'xhs-dl-settings-error';
      error.hidden = true;
      root.append(preview, error);
      const foot = document.createElement('div');
      foot.className = 'xhs-dl-settings-foot';
      const status = document.createElement('span');
      status.className = 'xhs-dl-settings-status';
      status.setAttribute('role', 'status');
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'xhs-dl-settings-reset';
      reset.textContent = t('resetDefault');
      foot.append(status, reset);
      root.appendChild(foot);
      el.appendChild(root);
      syncThemePicker();

      let saveTimer = 0;
      function matchPreset(value) {
        const text = String(value || '').trim();
        for (const [key, tpl] of Object.entries(FILENAME_PRESETS)) {
          if (tpl === text) return key;
        }
        return 'custom';
      }
      function syncCustomVisibility() {
        customBlock.hidden = preset.value !== 'custom';
      }
      function syncPresetFromTemplate() {
        preset.value = matchPreset(template.value.trim());
        syncCustomVisibility();
      }
      function currentTemplate() {
        if (preset.value !== 'custom' && FILENAME_PRESETS[preset.value]) return FILENAME_PRESETS[preset.value];
        return template.value.trim();
      }
      function refreshPreview() {
        try {
          const name = applyFilenameTemplate(currentTemplate(), {
            title: t('sampleTitle'),
            author: t('sampleAuthor'),
            id: '64f0sample01',
            index: '02',
            kind: t('image'),
            quality: t('image')
          }, 'jpg');
          error.hidden = true;
          error.textContent = '';
          preview.textContent = t('preview', { name: t('folderSample') + '/' + t('sampleTitle') + '/' + name });
          return currentTemplate();
        } catch (err) {
          error.hidden = false;
          error.textContent = err.message || t('invalidTemplate');
          preview.textContent = t('previewEmpty');
          return false;
        }
      }
      function applyForm(value) {
        template.value = value || DEFAULT_FILENAME_TEMPLATE;
        preset.value = matchPreset(template.value);
        syncCustomVisibility();
        refreshPreview();
      }
      async function persist(showOk) {
        const nextTemplate = refreshPreview();
        if (!nextTemplate) {
          status.textContent = t('invalidTemplate');
          return;
        }
        try {
          await saveFilenameTemplate(nextTemplate);
          status.textContent = showOk ? t('saved') : '';
        } catch (err) {
          status.textContent = err?.message || t('themeSaveFailed');
        }
      }
      function queueSave() {
        status.textContent = '';
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { persist(true); }, 280);
      }
      preset.addEventListener('change', () => {
        if (preset.value !== 'custom' && FILENAME_PRESETS[preset.value]) template.value = FILENAME_PRESETS[preset.value];
        syncCustomVisibility();
        refreshPreview();
        queueSave();
      });
      template.addEventListener('input', () => {
        syncPresetFromTemplate();
        refreshPreview();
        queueSave();
      });
      reset.addEventListener('click', async () => {
        clearTimeout(saveTimer);
        try {
          await saveFilenameTemplate(DEFAULT_FILENAME_TEMPLATE);
          applyForm(DEFAULT_FILENAME_TEMPLATE);
          status.textContent = t('restored');
        } catch (err) {
          status.textContent = err?.message || t('restoreFailed');
        }
      });
      applyForm(filenameTemplate);
    }

    function fillDonateBody(el) {
      clearNode(el);
      const donation = document.createElement('section');
      donation.className = 'xhs-dl-donate';
      appendTextElement(donation, 'p', 'xhs-dl-donate-intro', t('donateIntro'));
      const methods = document.createElement('div');
      methods.className = 'xhs-dl-donate-methods';
      methods.setAttribute('aria-label', t('donateMethods'));
      const code = document.createElement('div');
      code.className = 'xhs-dl-donate-code';
      const image = document.createElement('img');
      const buttons = [];
      const options = [
        { id: 'wechat', label: t('donateWechat'), file: 'assets/donate-wechat.jpg' },
        { id: 'alipay', label: t('donateAlipay'), file: 'assets/donate-alipay.jpg' }
      ];
      const selectMethod = (option) => {
        code.dataset.method = option.id;
        image.src = EXT.runtime.getURL(option.file);
        image.alt = option.label;
        buttons.forEach((button) => {
          const active = button.dataset.method === option.id;
          button.classList.toggle('active', active);
          button.setAttribute('aria-pressed', String(active));
        });
      };
      options.forEach((option) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'xhs-dl-donate-method';
        button.dataset.method = option.id;
        button.setAttribute('aria-pressed', 'false');
        button.textContent = option.label;
        button.addEventListener('click', () => selectMethod(option));
        buttons.push(button);
        methods.appendChild(button);
      });
      code.appendChild(image);
      donation.append(methods, code);
      el.appendChild(donation);
      selectMethod(options[0]);
    }

    function applyLanguage() {
      globalThis.DownloaderKit?.i18n?.apply?.(panel);
      panel.style.setProperty('--xhs-author-prefix', JSON.stringify(t('authorPrefix')));
      toggleBtn.title = t('saveMedia');
      toggleBtn.setAttribute('aria-label', t('openAssistant'));
      menu.setAttribute('aria-label', t('appTitle'));
      const sheet = infoTitle?.dataset.sheet;
      if (!pageEl?.classList.contains('hidden') && sheet === 'settings') {
        infoTitle.textContent = t('settingsTitle');
        if (infoDate) {
          infoDate.textContent = t('settingsHint');
          infoDate.classList.remove('hidden');
        }
        fillSettingsBody(infoBody);
      } else if (!pageEl?.classList.contains('hidden') && sheet === 'donate') {
        infoTitle.textContent = t('donateTitle');
        fillDonateBody(infoBody);
      }
      applyTab();
      applyRatingCopy();
      // Language switch must fully rebuild dynamic panels (quiet refresh leaves stale copy).
      if (isOpen) {
        syncModes({ skipRefresh: true });
        if (activeMode === 'creator') renderCreator();
        else if (isDetailPage()) refreshNote();
      }
    }

    function copyFeedbackEmail(button) {
      navigator.clipboard?.writeText(FEEDBACK_EMAIL).then(() => {
        button?.classList.add('is-copied');
        showStatus('info', t('copied'));
        setTimeout(() => button?.classList.remove('is-copied'), 1200);
      }).catch(() => {
        showStatus('error', t('copyFailedManual'));
      });
    }

    async function openInfoSheet(key) {
      if (key === 'notice') return;
      const locked = menu.offsetHeight;
      if (locked > 0) {
        menu.style.height = locked + 'px';
        menu.style.minHeight = locked + 'px';
      }
      if (key === 'settings') {
        infoTitle.textContent = t('settingsTitle');
        infoTitle.dataset.sheet = 'settings';
        infoDate.textContent = t('settingsHint');
        infoDate.classList.remove('hidden');
        pageEl?.classList.remove('is-donate');
        fillSettingsBody(infoBody);
        homeEl?.classList.add('hidden');
        pageEl?.classList.remove('hidden');
        menu.classList.add('is-page');
        return;
      }
      if (key === 'donate') {
        infoTitle.textContent = t('donateTitle');
        infoTitle.dataset.sheet = 'donate';
        infoDate.textContent = '';
        infoDate.classList.add('hidden');
        pageEl?.classList.add('is-donate');
        fillDonateBody(infoBody);
        homeEl?.classList.add('hidden');
        pageEl?.classList.remove('hidden');
        menu.classList.add('is-page');
        return;
      }
      await loadRemoteContent();
      const item = remoteContent[key] || {};
      infoTitle.textContent = item.title || (key === 'coop' ? t('coopTitle') : t('notice'));
      infoTitle.dataset.sheet = key;
      pageEl?.classList.remove('is-donate');
      if (item.updated) {
        infoDate.textContent = t('updatedAt', { date: item.updated });
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
      if (item.kind === 'video') return t('videoOne');
      if (item.kind === 'text') return t('text');
      return t('imageOne');
    }

    function syncJobList() {
      const visible = [...activeJobs.values()].some((job) => job.cardEl);
      jobListEl.classList.toggle('hidden', !visible);
    }

    function removeJobCard(jobId, delayMs = 0) {
      const job = activeJobs.get(jobId);
      if (!job) return;
      const run = () => {
        if (!activeJobs.has(jobId)) return;
        job.cardEl?.remove();
        job.cardEl = null;
        activeJobs.delete(jobId);
        syncJobList();
      };
      if (delayMs > 0) setTimeout(run, delayMs);
      else run();
    }

    function finishJob(jobId, result) {
      const job = activeJobs.get(jobId);
      if (job) {
        job.result = result;
        job.done = true;
      }
      const wait = jobWaiters.get(jobId);
      if (wait) {
        jobWaiters.delete(jobId);
        wait(result);
      }
      // Ins: queue only shows active tasks; completed → toast + clear row.
      if (!job?.quiet) {
        if (result?.ok) showStatus('success', t('saved'));
        else if (result?.error) showStatus('error', result.error);
      }
      removeJobCard(jobId, result?.ok ? 700 : 1400);
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
          <span class="xhs-dl-job-phase">${t('preparing')}</span>
          <span class="xhs-dl-job-pct">0%</span>
        </div>
        <div class="xhs-dl-progress-track">
          <div class="xhs-dl-progress-bar"></div>
        </div>
        <div class="xhs-dl-progress-actions">
          <button type="button" class="xhs-dl-action-btn" data-act="pause">${t('pause')}</button>
          <button type="button" class="xhs-dl-action-btn danger" data-act="cancel">${t('cancel')}</button>
        </div>
      `));
      el.querySelector('.xhs-dl-progress-title').textContent =
        job.item?.meta?.title || currentNote.title || t('noteLabel');
      el.querySelector('.xhs-dl-progress-q').textContent = itemLabel(job.item);
      el.querySelector('[data-act="pause"]').addEventListener('click', () => {
        if (!job.downloadId || job.done) return;
        const action = job.paused ? 'resume' : 'pause';
        apiCall(EXT.runtime, 'sendMessage', { type: 'XHS_DL_JOB_CTRL', action, downloadId: job.downloadId }).catch(() => {});
      });
      el.querySelector('[data-act="cancel"]').addEventListener('click', () => {
        if (job.done) return;
        if (job.abort) job.abort();
        if (job.downloadId) {
          apiCall(EXT.runtime, 'sendMessage', { type: 'XHS_DL_JOB_CTRL', action: 'cancel', downloadId: job.downloadId }).catch(() => {});
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
      if (payload.fallback) job.usedFallback = true;
      const step = payload.step || 'download';
      const percent = Number(payload.percent) || 0;
      const received = Number(payload.received) || 0;
      const total = Number(payload.total) || 0;

      job.paused = step === 'paused';
      job.done = step === 'done' || step === 'error' || step === 'cancel';
      if (pauseBtn) {
        pauseBtn.textContent = job.paused ? t('resume') : t('pause');
        pauseBtn.classList.toggle('hidden', !job.downloadId);
      }
      actions.classList.toggle('hidden', job.done);
      bar.classList.toggle('paused', job.paused);
      bar.classList.toggle('indeterminate', !total && !job.done && step === 'download');

      if (step === 'done') {
        phaseEl.textContent = job.usedFallback ? t('imageFallback') : t('done');
        pctEl.textContent = '100%';
        bar.style.width = '100%';
        bar.classList.remove('indeterminate', 'paused');
        finishJob(job.jobId, { ok: true });
        return;
      }
      if (step === 'cancel') {
        phaseEl.textContent = t('cancelled');
        pctEl.textContent = percent ? percent + '%' : '';
        finishJob(job.jobId, { ok: false, error: t('cancelled') });
        return;
      }
      if (step === 'error') {
        phaseEl.textContent = payload.error || t('downloadFailed');
        pctEl.textContent = '';
        finishJob(job.jobId, { ok: false, error: payload.error || t('downloadFailed') });
        return;
      }
      if (step === 'paused') {
        phaseEl.textContent = total
          ? t('pausedProgress', { received: formatBytes(received), total: formatBytes(total) })
          : t('paused');
        pctEl.textContent = percent ? percent + '%' : '';
        bar.style.width = percent + '%';
        return;
      }
      if (step === 'prepare') {
        phaseEl.textContent = t('preparing');
        pctEl.textContent = '0%';
        bar.style.width = '0%';
        return;
      }
      phaseEl.textContent = total
        ? t('downloadingProgress', { received: formatBytes(received), total: formatBytes(total) })
        : t('downloading');
      pctEl.textContent = percent ? percent + '%' : '';
      if (total) bar.style.width = percent + '%';
    }

    async function downloadBlobItem(item, job) {
      const ac = new AbortController();
      job.abort = () => ac.abort();
      const res = await fetch(item.url, { signal: ac.signal });
      if (!res.ok) throw new Error(t('readVideoFailed'));
      const total = Number(res.headers.get('content-length')) || 0;
      if (total > MAX_BLOB_DOWNLOAD_BYTES) throw new Error(t('videoTooLarge'));
      const reader = res.body?.getReader();
      if (!reader) throw new Error(t('videoStreamFailed'));
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (received > MAX_BLOB_DOWNLOAD_BYTES) {
          ac.abort();
          throw new Error(t('videoTooLargeStopped'));
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
      if (blob.size < 1024) throw new Error(t('videoTooSmall'));
      const ext = /webm/i.test(blob.type) ? 'webm' : 'mp4';
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = buildDownloadName(item, ext);
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

    async function downloadOne(item, options = {}) {
      if (item.kind === 'image' && !item.meta && isDetailPage()) {
        const expectedNoteId = currentNote.noteId;
        await noteImagesReady;
        if (currentNote.noteId !== expectedNoteId) return { ok: false, error: '笔记已切换，请重新选择' };
        item = currentNote.images[item.index] || item;
      }
      const jobId = 'j' + Date.now() + Math.random().toString(16).slice(2);
      const job = { jobId, item, paused: false, done: false, quiet: !!options.quiet };
      activeJobs.set(jobId, job);
      mountJobCard(job);
      updateJob({ jobId, step: 'prepare', percent: 0 });

      if (item.kind === 'video' && /^blob:/i.test(item.url || '')) {
        try {
          return await downloadBlobItem(item, job);
        } catch (error) {
          if (error.name === 'AbortError') {
            updateJob({ jobId, step: 'cancel', percent: 0 });
            return { ok: false, error: t('cancelled') };
          }
          updateJob({ jobId, step: 'error', error: error.message || t('saveFailed') });
          return { ok: false, error: error.message || t('saveFailed') };
        }
      }

      const done = waitJob(jobId);
      const meta = item.meta || {};
      let filename;
      try { filename = buildDownloadName(item, item.kind === 'text' ? 'txt' : (item.kind === 'video' ? 'mp4' : 'jpg')); }
      catch (error) {
        updateJob({ jobId, step: 'error', error: error.message || t('invalidFilename') });
        return { ok: false, error: error.message || t('invalidFilename') };
      }
      const resp = await sendRuntime({
        type: 'XHS_DL_DOWNLOAD',
        item,
        title: meta.title || currentNote.title,
        author: meta.author || currentNote.author,
        noteId: meta.noteId || currentNote.noteId || extractNoteId(location.href),
        filenameTemplate,
        filename,
        jobId
      });
      if (!resp?.ok) {
        updateJob({ jobId, step: 'error', error: resp?.error || t('saveFailed') });
        return resp || { ok: false, error: t('saveFailed') };
      }
      if (job.done) return done;
      job.downloadId = resp.id;
      updateJob({ jobId, downloadId: resp.id, step: 'download', percent: 0 });
      return done;
    }

    async function downloadItems(items) {
      if (!items.length) {
        showStatus('error', t('selectContentFirst'));
        return;
      }
      hideStatus();
      let ok = 0;
      for (const item of items) {
        const result = await downloadOne(item).catch((error) => ({ ok: false, error: error.message || t('saveFailed') }));
        if (result?.ok) ok += 1;
      }
      if (ok) await noteDownloadSuccessForRating();
    }

    function openPanel() {
      if (!isSupportedPage()) return false;
      isOpen = true;
      menu.classList.remove('hidden');
      toggleBtn.setAttribute('aria-expanded', 'true');
      showHome();
      applyLanguage();
      syncModes({ forceMode: isProfilePage() && !isDetailPage() ? 'creator' : activeMode });
      if (activeMode === 'creator') {
        refreshCreatorView();
      } else {
        setNoteLoading(true);
        setDetect(t('identifying'), false);
        refreshNote();
        setTimeout(() => {
          if (isOpen && isDetailPage() && activeMode === 'current') refreshNote();
        }, 600);
      }
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

    let toggleDragged = false;
    let dragActive = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragPanelLeft = 0;
    let dragPanelTop = 0;
    let dragMoved = false;
    let dragPointerId = null;
    const fabPanel = panel.querySelector('#xhs-dl-panel');

    function clampFabPos(left, top) {
      const maxL = Math.max(FAB_MARGIN, window.innerWidth - FAB_SIZE - FAB_MARGIN);
      const maxT = Math.max(FAB_MARGIN, window.innerHeight - FAB_SIZE - FAB_MARGIN);
      return {
        left: Math.min(Math.max(left, FAB_MARGIN), maxL),
        top: Math.min(Math.max(top, FAB_MARGIN), maxT)
      };
    }

    function applyFabPos(left, top) {
      const pos = clampFabPos(left, top);
      fabPanel.style.left = pos.left + 'px';
      fabPanel.style.top = pos.top + 'px';
      fabPanel.style.right = 'auto';
      fabPanel.style.bottom = 'auto';
      return pos;
    }

    function onFabPointerMove(event) {
      if (!dragActive || event.pointerId !== dragPointerId) return;
      const dx = event.clientX - dragStartX;
      const dy = event.clientY - dragStartY;
      if (!dragMoved && Math.abs(dx) + Math.abs(dy) > 6) {
        dragMoved = true;
        toggleDragged = true;
        toggleBtn.classList.add('dragging');
      }
      if (dragMoved) {
        event.preventDefault();
        applyFabPos(dragPanelLeft + dx, dragPanelTop + dy);
      }
    }

    function onFabPointerUp(event) {
      if (!dragActive || event.pointerId !== dragPointerId) return;
      dragActive = false;
      dragPointerId = null;
      document.removeEventListener('pointermove', onFabPointerMove, true);
      document.removeEventListener('pointerup', onFabPointerUp, true);
      document.removeEventListener('pointercancel', onFabPointerUp, true);
      toggleBtn.classList.remove('dragging');
      fabPanel.style.transition = '';
      if (dragMoved) {
        const rect = fabPanel.getBoundingClientRect();
        const pos = applyFabPos(rect.left, rect.top);
        storageSet({ [FAB_POS_KEY]: pos }).catch(() => {});
      }
      setTimeout(() => { toggleDragged = false; }, 120);
    }

    toggleBtn.addEventListener('click', (event) => {
      if (toggleDragged) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (isOpen) closePanel();
      else openPanel();
    });
    toggleBtn.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      dragActive = true;
      dragMoved = false;
      toggleDragged = false;
      dragPointerId = event.pointerId;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      const rect = fabPanel.getBoundingClientRect();
      dragPanelLeft = rect.right - FAB_SIZE;
      dragPanelTop = rect.bottom - FAB_SIZE;
      if (fabPanel.style.left && fabPanel.style.left !== 'auto') {
        dragPanelLeft = parseFloat(fabPanel.style.left) || dragPanelLeft;
        dragPanelTop = parseFloat(fabPanel.style.top) || dragPanelTop;
      }
      fabPanel.style.transition = 'none';
      applyFabPos(dragPanelLeft, dragPanelTop);
      document.addEventListener('pointermove', onFabPointerMove, true);
      document.addEventListener('pointerup', onFabPointerUp, true);
      document.addEventListener('pointercancel', onFabPointerUp, true);
    });
    toggleBtn.addEventListener('dragstart', (event) => event.preventDefault());
    storageGet([FAB_POS_KEY]).then((data) => {
      const pos = data?.[FAB_POS_KEY];
      if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) applyFabPos(pos.left, pos.top);
    });
    let fabResizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(fabResizeTimer);
      fabResizeTimer = setTimeout(() => {
        const left = parseFloat(fabPanel.style.left);
        const top = parseFloat(fabPanel.style.top);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return;
        const pos = applyFabPos(left, top);
        storageSet({ [FAB_POS_KEY]: pos }).catch(() => {});
      }, 100);
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

    modeTabs?.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => setActiveMode(btn.dataset.mode));
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
          showStatus('error', t('noText'));
          return;
        }
        await downloadItems([{ kind: 'text', text: currentNote.text, index: 0 }]);
        return;
      }
      await downloadItems(selectedItems(currentTab));
    });

    secondaryBtn.addEventListener('click', async () => {
      if (!currentNote.text) {
        showStatus('error', t('noText'));
        return;
      }
      try {
        await navigator.clipboard.writeText(currentNote.text);
        showStatus('info', t('textCopied'));
      } catch (_) {
        showStatus('error', t('copyFailedManual'));
      }
    });

    panel.querySelectorAll('[data-sheet]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openInfoSheet(btn.getAttribute('data-sheet'));
      });
    });
    panel.querySelector('.xhs-dl-feedback')?.addEventListener('click', (e) => {
      e.preventDefault();
      copyFeedbackEmail(e.currentTarget);
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

    loadRemoteContent();
    loadFilenameTemplate().catch(() => {});
    storageGet([THEME_PREF_KEY]).then((data) => {
      applyTheme(data?.[THEME_PREF_KEY] || 'xiaohongshu');
    }).catch(() => applyTheme('xiaohongshu'));
    document.addEventListener('pointerdown', (event) => {
      const themeControl = panel.querySelector('.xhs-dl-settings-theme-control');
      if (!themeControl || themeControl.contains(event.target)) return;
      themeControl.classList.remove('is-open');
      themeControl.querySelector('.xhs-dl-settings-theme-options')?.classList.add('hidden');
      themeControl.querySelector('.xhs-dl-settings-theme-trigger')?.setAttribute('aria-expanded', 'false');
    });
    syncVisibility();
    Promise.resolve(globalThis.DownloaderKit?.i18n?.ready).then(() => applyLanguage()).catch(() => applyLanguage());

    window.__XHS_DL_API = {
      isDetailPage,
      isProfilePage,
      isSupportedPage,
      isPanelOpen() {
        return isOpen;
      },
      collectNote,
      refreshNote,
      refreshCreatorView,
      openPanel,
      updateJob,
      applyLanguage,
      getSnapshot() {
        return {
          info: currentNote,
          isDetail: isDetailPage(),
          isProfile: isProfilePage(),
          isSupported: isSupportedPage(),
          mode: activeMode,
          profile: isProfilePage() ? profileMeta() : null,
          creatorCount: creatorPosts.size
        };
      }
    };
  }

  function boot() {
    mountUI();
    const root = document.getElementById('xhs-dl-panel-root');
    if (root) root.classList.toggle('is-hidden', !isSupportedPage());
    if (isDetailPage()) window.__XHS_DL_API?.refreshNote?.();
    else if (isProfilePage()) window.__XHS_DL_API?.refreshCreatorView?.();
  }

  boot();

  let lastHref = location.href;
  let lastDetail = isDetailPage();
  let lastProfile = isProfilePage();
  let lastFeedCategory = isProfilePage() ? profileFeedCategory() : '';
  let mediaRefreshTimer = 0;
  let creatorScanTimer = 0;
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
  function queueCreatorScan(records) {
    if (!window.__XHS_DL_API?.isPanelOpen?.() || !isProfilePage()) return;
    const panel = document.getElementById('xhs-dl-panel-root');
    const category = profileFeedCategory();
    const tabChanged = category !== lastFeedCategory;
    if (tabChanged) lastFeedCategory = category;
    const changed = tabChanged || records.some((record) => {
      const target = record.target;
      if (!(target instanceof Node) || panel?.contains(target)) return false;
      // Tab text/class changes or feed list mutations.
      if (target instanceof Element) {
        const cls = String(target.className || '');
        if (/tab|feed|note|collect|like/i.test(cls)) return true;
        if (target.getAttribute?.('role') === 'tab') return true;
      }
      const cardSelector = '.note-item, .feed-card, [class*="note-item"]';
      return target instanceof Element && (Boolean(target.closest('#userPageContainer, .user-page, .feeds-container, .feed-container')) ||
        [...record.addedNodes, ...record.removedNodes].some((node) => node instanceof Element && (node.matches(cardSelector) || node.querySelector(cardSelector))));
    });
    if (!changed) return;
    clearTimeout(creatorScanTimer);
    creatorScanTimer = setTimeout(() => {
      if (window.__XHS_DL_API?.isPanelOpen?.() && isProfilePage()) {
        window.__XHS_DL_API.refreshCreatorView?.({ quiet: !tabChanged });
      }
    }, tabChanged ? 280 : 500);
  }
  const observer = new MutationObserver((records) => {
    const panel = document.getElementById('xhs-dl-panel-root');
    records = records.filter((record) => !panel?.contains(record.target));
    if (!records.length) return;
    const href = location.href;
    const detail = isDetailPage();
    const profile = isProfilePage();
    const category = profile ? profileFeedCategory() : '';
    if (
      href !== lastHref ||
      detail !== lastDetail ||
      profile !== lastProfile ||
      category !== lastFeedCategory
    ) {
      const categoryOnly =
        href === lastHref && detail === lastDetail && profile === lastProfile && category !== lastFeedCategory;
      lastHref = href;
      lastDetail = detail;
      lastProfile = profile;
      lastFeedCategory = category;
      if (!categoryOnly) boot();
      if (detail) {
        setTimeout(() => window.__XHS_DL_API?.refreshNote?.(), 600);
      } else if (profile) {
        setTimeout(() => window.__XHS_DL_API?.refreshCreatorView?.(), categoryOnly ? 280 : 600);
      }
      return;
    }
    queueMediaRefresh(records);
    queueCreatorScan(records);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset', 'poster', 'class', 'aria-selected', 'hidden', 'style']
  });

  // Match the label itself: XHS tab class names vary across page layouts.
  document.addEventListener('click', (event) => {
    if (!isProfilePage() || event.target?.closest?.('#xhs-dl-panel-root, .side-bar, .sidebar')) return;
    let tab = event.target instanceof Element ? event.target : null;
    let category = '';
    for (let depth = 0; tab && depth < 4; depth += 1, tab = tab.parentElement) {
      category = feedTabCategory(tab);
      if (category) break;
    }
    if (!category) return;
    clickedFeedTab = { href: location.href, category };
    feedSwitchUntil = Date.now() + 450;
    clearTimeout(creatorScanTimer);
    // Switch the cache immediately; refresh waits for the site's feed to mount.
    window.__XHS_DL_API?.refreshCreatorView?.();
    creatorScanTimer = setTimeout(() => {
      window.__XHS_DL_API?.refreshCreatorView?.();
    }, 900);
  }, true);

  EXT.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'XHS_DL_GET_INFO') {
      if (isDetailPage()) {
        const note = collectNote();
        requestPageVideos().then((urls) => {
          mergeVideoUrls(note, urls);
          sendResponse({
            ok: true,
            data: {
              info: note,
              isDetail: true,
              isProfile: isProfilePage(),
              isSupported: true
            }
          });
        });
        return true;
      }
      if (isProfilePage()) {
        const profile = profileMeta();
        const posts = (() => {
          const map = new Map();
          mergeCreatorPosts(map, scanCreatorNotes());
          return [...map.values()];
        })();
        sendResponse({
          ok: true,
          data: {
            info: {
              title: profile.name || t('creator'),
              author: profile.name || '',
              cover: profile.avatar || posts[0]?.cover || '',
              images: [],
              videos: [],
              text: '',
              noteId: '',
              creatorCount: posts.length
            },
            isDetail: false,
            isProfile: true,
            isSupported: true,
            mode: 'creator'
          }
        });
        return;
      }
      sendResponse({ ok: false, data: null, error: t('needDetail') });
      return;
    }
    if (msg?.type === 'XHS_DL_PROGRESS') {
      window.__XHS_DL_API?.updateJob?.(msg);
      return;
    }
    if (msg?.type === 'XHS_DL_OPEN_PANEL') {
      mountUI();
      const opened = window.__XHS_DL_API?.openPanel?.();
      sendResponse({ ok: !!opened, error: opened ? '' : t('needSupportedPage') });
    }
  });
})();
