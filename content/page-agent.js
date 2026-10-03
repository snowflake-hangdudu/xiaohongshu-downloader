/**
 * MAIN world：读取播放器及已加载笔记的访问链接，不请求私有接口。
 */
(function () {
  'use strict';
  if (window.__XHS_DL_AGENT__) return;
  window.__XHS_DL_AGENT__ = true;

  function isVideoUrl(value) {
    return (
      /^https:\/\//i.test(value) &&
      /(sns-video|\.mp4|\.webm|\.mov)/i.test(value) &&
      !/\.(jpe?g|png|webp|gif)(\?|$)/i.test(value)
    );
  }

  function isCoverUrl(value) {
    return (
      /^https:\/\//i.test(value) &&
      /(sns-webpic|ci\.xiaohongshu|xhscdn)/i.test(value) &&
      !/(sns-video|\.mp4|\.m3u8|avatar|icon|logo)/i.test(value)
    );
  }

  function collect() {
    const videos = new Set();
    const covers = new Set();
    document.querySelectorAll('video').forEach((video) => {
      if (isVideoUrl(video.currentSrc)) videos.add(video.currentSrc);
      if (isVideoUrl(video.src)) videos.add(video.src);
      if (video.poster) covers.add(video.poster);
    });
    return { urls: [...videos], covers: [...covers] };
  }


function selectImageResource(image) {
  const candidates = [];
  const add = (value, scene, width, height, priority) => {
    try {
      const url = new URL(String(value || '').replace(/^\/\//, 'https://').replace(/^http:\/\//i, 'https://'));
      if (!/(^|\.)(xhscdn\.com|xiaohongshu\.com)$/.test(url.hostname)) return;
      const resize = url.href.match(/(?:\/w\/|[?&]w=)(\d+)/i);
      const pixels = (Number(width) || Number(resize?.[1]) || 0) * (Number(height) || Number(width) || Number(resize?.[1]) || 0);
      candidates.push({ url: url.href, pixels, original: /original|origin|raw/i.test(scene || ''), priority });
    } catch (_) {}
  };
  (Array.isArray(image.infoList) ? image.infoList : []).forEach((info) => {
    add(info.url, info.imageScene, info.width, info.height, /WB_DFT/i.test(info.imageScene || '') ? 3 : 1);
  });
  add(image.urlOriginal || image.originalUrl, 'original', image.width, image.height, 5);
  add(image.urlDefault, 'default', 0, 0, 2);
  add(image.url, '', 0, 0, 1);
  add(image.urlPre, 'preview', 0, 0, 0);
  candidates.sort((a, b) => Number(b.original) - Number(a.original) || b.pixels - a.pixels || b.priority - a.priority);
  const urls = [...new Set(candidates.map((candidate) => candidate.url))];
  return urls.length ? { kind: 'image', url: urls[0], fallbackUrls: urls.slice(1, 4), quality: candidates[0].original ? 'original' : 'bestAvailable' } : null;
}

  function noteLink(noteId) {
    if (!/^[0-9a-f]{16,64}$/i.test(noteId || '')) return '';
    const seen = new WeakSet();
    const queue = [window.__INITIAL_STATE__];
    for (let cursor = 0; cursor < queue.length && cursor < 12000; cursor += 1) {
      const node = queue[cursor];
      if (!node || typeof node !== 'object' || seen.has(node)) continue;
      seen.add(node);
      const card = node.noteCard || node.note_card || node.note || node;
      const id = String(node.noteId || node.note_id || node.id || card.noteId || card.note_id || card.id || '');
      if (id.toLowerCase() === noteId.toLowerCase()) {
        const token = node.xsecToken || node.xsec_token || card.xsecToken || card.xsec_token;
        if (typeof token === 'string' && token.length && token.length < 2048) {
          const url = new URL('/explore/' + noteId, location.origin);
          url.searchParams.set('xsec_token', token);
          url.searchParams.set('xsec_source', 'pc_user');
          return url.href;
        }
      }
      for (const key of Object.keys(node)) {
        if (queue.length >= 12000) break;
        try {
          const value = node[key];
          if (value && typeof value === 'object') queue.push(value);
        } catch (_) {}
      }
    }
    return '';
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== 'xhs-dl-panel') return;
    if (event.data.type === 'GET_NOTE_IMAGES') {
      const noteId = String(event.data.noteId || '');
      const note = window.__INITIAL_STATE__?.note?.noteDetailMap?.[noteId]?.note;
      const images = (Array.isArray(note?.imageList) ? note.imageList : []).map(selectImageResource).filter(Boolean);
      window.postMessage({ source: 'xhs-dl-agent', type: 'NOTE_IMAGES', id: event.data.id, noteId, images }, location.origin);
      return;
    }
    if (event.data.type === 'GET_NOTE_LINK') {
      window.postMessage({ source: 'xhs-dl-agent', type: 'NOTE_LINK', id: event.data.id,
        noteId: event.data.noteId, url: noteLink(String(event.data.noteId || '')) }, location.origin);
      return;
    }
    if (event.data.type !== 'GET_VIDEOS') return;
    const data = collect();
    window.postMessage({
      source: 'xhs-dl-agent',
      type: 'VIDEOS',
      id: event.data.id,
      urls: data.urls,
      covers: data.covers
    }, '*');
  });
})();
