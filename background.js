const EXT = typeof browser !== 'undefined' ? browser : chrome;


function apiCall(target, method, ...args) {
  if (typeof browser !== 'undefined') return target[method](...args);
  return new Promise((resolve, reject) => {
    target[method](...args, (result) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(result);
    });
  });
}

const CONFIG_URL = 'http://124.222.62.190:8081/api/config/xiaohongshu';
const HISTORY_KEY = 'xiaohongshu-dl-history-v1';
const COVER_WARM_KEY = 'xiaohongshu-dl-covers-v1';
const jobs = new Map();

function cleanPart(value, fallback) {
  return String(value || fallback)
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || fallback;
}

function extensionFor(url, kind) {
  const match = String(url).match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
  if (match && /^(jpe?g|png|webp|gif|mp4|webm|mov|txt)$/i.test(match[1])) {
    return match[1].toLowerCase().replace('jpeg', 'jpg');
  }
  if (kind === 'image' && /![^?#]*webp/i.test(String(url))) return 'webp';
  if (kind === 'video') return 'mp4';
  if (kind === 'text') return 'txt';
  return 'jpg';
}

function kindLabel(kind) {
  if (kind === 'video') return '视频';
  if (kind === 'text') return '文字';
  return '图片';
}

function textDataUrl(text) {
  const bytes = new TextEncoder().encode(String(text || ''));
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return 'data:text/plain;charset=utf-8;base64,' + btoa(binary);
}

function pushProgress(tabId, payload) {
  if (!tabId) return;
  try {
    const sent = apiCall(EXT.tabs, 'sendMessage', tabId, { type: 'XHS_DL_PROGRESS', ...payload });
    if (sent && typeof sent.catch === 'function') sent.catch(() => {});
  } catch (_) {}
}

function downloadsSearch(query) {
  return apiCall(EXT.downloads, 'search', query);
}
function storageGet(keys) {
  return apiCall(EXT.storage.local, 'get', keys);
}
function storageSet(obj) {
  return apiCall(EXT.storage.local, 'set', obj);
}

/* ---- Cover resource cache (aligned with Ins IDB strategy) ---- */

let coverDbPromise;
function coverDb() {
  if (!coverDbPromise) {
    coverDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('xiaohongshu-cover-cache', 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('posts', { keyPath: 'noteId' });
        store.createIndex('savedAt', 'savedAt');
        request.result.createObjectStore('meta');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        coverDbPromise = null;
        reject(request.error);
      };
    });
  }
  return coverDbPromise;
}

async function coverCacheRead(codes) {
  const db = await coverDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', 'readonly');
    const posts = [];
    [...new Set(codes)].slice(0, 300).forEach((code) => {
      const request = tx.objectStore('posts').get(String(code || ''));
      request.onsuccess = () => {
        const entry = request.result;
        if (entry && entry.post?.cacheVersion === 1 && Date.now() - entry.savedAt < 30 * 86400000) {
          posts.push(entry.post);
        }
      };
    });
    tx.oncomplete = () => resolve({ ok: true, posts });
    tx.onerror = () => reject(tx.error);
  });
}

async function writeCoverCache(post) {
  const noteId = String(post?.noteId || '');
  if (!/^[0-9a-z]{6,64}$/i.test(noteId) || !post?.cover) return { ok: false };
  const payload = {
    noteId,
    title: String(post.title || noteId).slice(0, 200),
    cover: String(post.cover || ''),
    pageUrl: String(post.pageUrl || ''),
    kind: post.kind === 'video' ? 'video' : 'image',
    author: post.author && typeof post.author === 'object' ? post.author : {},
    cacheVersion: 1,
    resolvedAt: Number(post.resolvedAt) || Date.now()
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload)).length;
  if (bytes > 256 * 1024) return { ok: false };
  const db = await coverDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['posts', 'meta'], 'readwrite');
    const store = tx.objectStore('posts');
    const meta = tx.objectStore('meta');
    const oldRequest = store.get(noteId);
    oldRequest.onsuccess = () => {
      const totalsRequest = meta.get('totals');
      totalsRequest.onsuccess = () => {
        const totals = totalsRequest.result || { count: 0, bytes: 0 };
        totals.count += oldRequest.result ? 0 : 1;
        totals.bytes += bytes - (oldRequest.result?.bytes || 0);
        store.put({ noteId, post: payload, bytes, savedAt: Date.now() });
        const cursorRequest = store.index('savedAt').openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (
            cursor &&
            (totals.count > 10000 ||
              totals.bytes > 64 * 1024 * 1024 ||
              Date.now() - cursor.value.savedAt > 30 * 86400000)
          ) {
            totals.count -= 1;
            totals.bytes -= cursor.value.bytes;
            cursor.delete();
            cursor.continue();
          } else {
            meta.put(totals, 'totals');
          }
        };
      };
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  // Warm storage.local like Ins resources-v3 (fast boot).
  try {
    const warm = await storageGet([COVER_WARM_KEY]);
    const list = Array.isArray(warm?.[COVER_WARM_KEY]) ? warm[COVER_WARM_KEY] : [];
    const next = [payload, ...list.filter((item) => item?.noteId !== noteId)].slice(0, 100);
    await storageSet({ [COVER_WARM_KEY]: next });
  } catch (_) {}
  return { ok: true };
}

/* ---- Download history (aligned with Ins completedKeys) ---- */

async function readHistory() {
  const data = await storageGet([HISTORY_KEY]);
  return Array.isArray(data?.[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
}

async function writeHistory(history) {
  await storageSet({ [HISTORY_KEY]: history.slice(0, 4000) });
}

function coverDownloadKey(noteId) {
  return String(noteId || '') + ':cover:image';
}

async function writeHistoryEntries(entries) {
  if (!Array.isArray(entries) || !entries.length) return { ok: true, history: await readHistory() };
  let history = await readHistory();
  entries.forEach((entry) => {
    const noteId = String(entry?.noteId || '');
    if (!noteId) return;
    const downloadKey = String(entry.downloadKey || coverDownloadKey(noteId));
    const status = entry.status === 'failed' ? 'failed' : 'completed';
    if (history.some((item) => item.downloadKey === downloadKey && item.status === status)) return;
    history.unshift({
      id: entry.id || ('h' + Date.now() + Math.random().toString(16).slice(2, 8)),
      noteId,
      title: String(entry.title || noteId).slice(0, 200),
      author: String(entry.author || '').slice(0, 120),
      coverUrl: String(entry.coverUrl || entry.cover || ''),
      pageUrl: String(entry.pageUrl || ''),
      type: entry.kind === 'video' ? 'video' : 'image',
      downloadKey,
      status,
      error: String(entry.error || ''),
      time: Date.now(),
      downloadedAt: status === 'completed' ? Date.now() : 0
    });
  });
  history = history.slice(0, 4000);
  await writeHistory(history);
  return { ok: true, history };
}

let storageQueue = Promise.resolve();
function enqueueStorage(operation) {
  const result = storageQueue.then(operation);
  storageQueue = result.catch(() => {});
  return result;
}
function coverCacheWrite(post) { return enqueueStorage(() => writeCoverCache(post)); }
function appendHistoryEntries(entries) { return enqueueStorage(() => writeHistoryEntries(entries)); }

function reportDownload(id) {
  const job = jobs.get(id);
  if (!job) return;
  downloadsSearch({ id }).then((items) => {
    const item = items && items[0];
    if (!item || jobs.get(id) !== job) return;
    const total = item.totalBytes > 0 ? item.totalBytes : 0;
    const received = item.bytesReceived || 0;
    let step = 'download';
    let percent = total ? Math.min(99, Math.round((received / total) * 100)) : 0;
    if (item.state === 'complete') {
      step = 'done';
      percent = 100;
    } else if (item.state === 'interrupted') {
      if (item.error !== 'USER_CANCELED' && job.fallbackUrls?.length && !job.retrying) {
        job.retrying = true;
        clearTimeout(job.pollTimer);
        jobs.delete(id);
        const url = job.fallbackUrls.shift();
        const format = job.formats?.[url];
        if (format) job.filename = job.filename.replace(/\.[a-z0-9]+$/i, '.' + format);
        apiCall(EXT.downloads, 'download', { url, filename: job.filename, conflictAction: 'uniquify', saveAs: false })
          .then((nextId) => {
            job.retrying = false;
            job.usedFallback = true;
            jobs.set(nextId, job);
            pushProgress(job.tabId, { jobId: job.jobId, downloadId: nextId, step: 'download', percent: 0, fallback: true });
            reportDownload(nextId);
          }).catch((error) => pushProgress(job.tabId, { jobId: job.jobId, step: 'error', error: error.message }));
        return;
      }
      step = item.error === 'USER_CANCELED' ? 'cancel' : 'error';
    } else if (item.paused) {
      step = 'paused';
      percent = total ? Math.round((received / total) * 100) : percent;
    }
    pushProgress(job.tabId, {
      jobId: job.jobId,
      downloadId: id,
      step,
      percent,
      received,
      total,
      error: item.error || '',
      fallback: !!job.usedFallback
    });
    if (item.state === 'complete' || item.state === 'interrupted') {
      jobs.delete(id);
    } else {
      clearTimeout(job.pollTimer);
      job.pollTimer = setTimeout(() => reportDownload(id), 1000);
    }
  }).catch(() => {});
}

EXT.downloads.onChanged.addListener((delta) => {
  if (!jobs.has(delta.id)) return;
  reportDownload(delta.id);
});

// Resolve the selected public note page, preserving its access token from the card link.
// Never substitute a video poster for a missing video resource.


const imageProbeCache = new Map();
function sourceImageUrl(value) {
  try {
    const url = new URL(value);
    if (!/(^|\.)(xhscdn\.com|xiaohongshu\.com)$/.test(url.hostname)) return '';
    const path = url.pathname.split('!')[0];
    const named = path.match(/\/(notes_pre_post|spectrum)\/([a-z0-9_-]+)$/i);
    if (named) return 'https://ci.xiaohongshu.com/' + named[1] + '/' + named[2];
    const id = path.split('/').pop();
    return /^1040[a-z0-9_-]{16,100}$/i.test(id || '') ? 'https://ci.xiaohongshu.com/' + id : '';
  } catch (_) { return ''; }
}
function imageHeader(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (at, count) => String.fromCharCode(...bytes.subarray(at, at + count));
  if (bytes.length >= 24 && bytes[0] === 137 && ascii(1, 3) === 'PNG') {
    return { width: view.getUint32(16), height: view.getUint32(20), format: 'png' };
  }
  if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const type = ascii(12, 4);
    if (type === 'VP8X') return { width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16), format: 'webp' };
    if (type === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) return { width: view.getUint16(26, true) & 16383, height: view.getUint16(28, true) & 16383, format: 'webp' };
    if (type === 'VP8L' && bytes[20] === 47) return { width: 1 + (((bytes[22] & 63) << 8) | bytes[21]), height: 1 + (((bytes[24] & 15) << 10) | (bytes[23] << 2) | (bytes[22] >> 6)), format: 'webp' };
  }
  if (bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 255) break;
      while (bytes[offset] === 255) offset += 1;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const size = view.getUint16(offset);
      if (size < 2) break;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
        return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3), format: 'jpg' };
      }
      offset += size;
    }
  }
  if (bytes.length >= 10 && /^GIF8[79]a$/.test(ascii(0, 6))) return { width: view.getUint16(6, true), height: view.getUint16(8, true), format: 'gif' };
  if (bytes.length >= 16 && ascii(4, 4) === 'ftyp') {
    const brands = ascii(8, Math.min(48, bytes.length - 8));
    const format = /avif|avis/.test(brands) ? 'avif' : /heic|heix|hevc|mif1/.test(brands) ? 'heic' : '';
    for (let at = 16; format && at + 16 <= bytes.length; at += 1) {
      if (ascii(at, 4) === 'ispe') return { width: view.getUint32(at + 8), height: view.getUint32(at + 12), format };
    }
  }
  return null;
}
let imageProbeActive = 0;
const imageProbeWaiters = [];
async function acquireImageProbe() {
  if (imageProbeActive >= 3) await new Promise((resolve) => imageProbeWaiters.push(resolve));
  else imageProbeActive += 1;
}
function releaseImageProbe() {
  const next = imageProbeWaiters.shift();
  if (next) next();
  else imageProbeActive -= 1;
}
function probeImage(url) {
  const previous = imageProbeCache.get(url);
  if (previous && Date.now() - previous.at < 300000) return previous.promise;
  const promise = (async () => {
    await acquireImageProbe();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let reader;
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok || !/^image\//i.test(response.headers.get('content-type') || '')) return null;
      reader = response.body?.getReader();
      if (!reader) return null;
      let bytes = new Uint8Array(0);
      while (bytes.length < 256 * 1024) {
        const chunk = await reader.read();
        if (chunk.done) break;
        const take = chunk.value.subarray(0, 256 * 1024 - bytes.length);
        const next = new Uint8Array(bytes.length + take.length);
        next.set(bytes); next.set(take, bytes.length); bytes = next;
        const meta = imageHeader(bytes);
        if (meta?.width > 0 && meta?.height > 0) return { ...meta, url };
      }
      return null;
    } catch (_) { return null; }
    finally { clearTimeout(timer); if (reader) await reader.cancel().catch(() => {}); controller.abort(); releaseImageProbe(); }
  })();
  imageProbeCache.set(url, { at: Date.now(), promise });
  while (imageProbeCache.size > 128) imageProbeCache.delete(imageProbeCache.keys().next().value);
  return promise;
}
async function bestImage(item) {
  const published = [...new Set([item.url, ...(item.fallbackUrls || [])])].filter((value) => {
    try { const url = new URL(value); return url.protocol === 'https:' && /(^|\.)(xhscdn\.com|xiaohongshu\.com)$/.test(url.hostname); } catch (_) { return false; }
  }).slice(0, 4);
  const sources = [...new Set(published.map(sourceImageUrl).filter(Boolean))].slice(0, 1);
  // Read only image headers, not entire multi-megabyte files. Keep a bounded cache.
  const urls = [...new Set([...sources, ...published])];
  const results = (await Promise.all(urls.map(probeImage))).filter(Boolean);
  results.sort((a, b) => b.width * b.height - a.width * a.height || Number(sources.includes(b.url)) - Number(sources.includes(a.url)));
  const best = results[0];
  if (!best) return { url: item.url, format: extensionFor(item.url, 'image'), fallbackUrls: published.slice(1) };
  return { ...best, fallbackUrls: [...new Set([...results.slice(1).map((entry) => entry.url), ...published])].filter((url) => url !== best.url).slice(0, 4), formats: Object.fromEntries(results.map((entry) => [entry.url, entry.format])) };
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

async function resolveNoteMedia(post) {
  const url = new URL(String(post.pageUrl || ''));
  if (url.hostname !== 'www.xiaohongshu.com' || !/^\/(explore|discovery\/item|user\/profile|search_result)\//.test(url.pathname)) {
    throw new Error('笔记地址无效');
  }
  const noteId = String(post.noteId || '').toLowerCase();
  if (!/^[0-9a-f]{16,64}$/.test(noteId)) throw new Error('笔记编号无效');
  // Profile card routes serve the profile's initial state, not the note detail.
  // Keep xsec_token/xsec_source while requesting the canonical note route.
  url.pathname = '/explore/' + noteId;
  url.hash = '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url.href, { credentials: 'include', signal: controller.signal });
    if (!response.ok) throw new Error('读取笔记失败：HTTP ' + response.status);
    const html = await response.text();
    if (html.length > 8 * 1024 * 1024) throw new Error('笔记页面过大');
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*([\s\S]*?)<\/script>/);
    if (!stateMatch) throw new Error('无法读取笔记内容，请确认登录状态或打开笔记详情');
    let source = stateMatch[1].trim().replace(/;\s*$/, '');
    // Replace JavaScript undefined values outside quoted JSON strings only.
    source = source.replace(/"(?:\\.|[^"\\])*"|\bundefined\b|\bnew\s+(?:Map|Set)\s*\(\s*(?:\[\s*\])?\s*\)/g, (token) => token.startsWith('"') ? token : token === 'undefined' ? 'null' : '[]');
    const state = JSON.parse(source);
    const unwrap = (value) => value && typeof value === 'object' && value.__v_isRef
      ? (value._value ?? value.value) : value;
    const noteState = unwrap(state.note) || {};
    const details = unwrap(noteState.noteDetailMap) || {};
    const entry = unwrap(details[noteId]);
    let note = unwrap(entry?.note || entry?.noteCard || entry?.note_card);
    if (!note?.imageList && !note?.video) note = null;
    // Hydration schemas differ between routes. Search only for the exact note ID
    // and media fields, with a fixed traversal budget; never use another note.
    if (!note) {
      const queue = [state];
      for (let cursor = 0; cursor < queue.length && cursor < 10000; cursor += 1) {
        const value = unwrap(queue[cursor]);
        if (!value || typeof value !== 'object') continue;
        const id = String(value.noteId || value.note_id || value.id || '').toLowerCase();
        if (id === noteId && (Array.isArray(value.imageList) || value.video)) {
          note = value;
          break;
        }
        for (const child of Object.values(value)) {
          if (child && typeof child === 'object' && queue.length < 10000) queue.push(child);
        }
      }
    }
    if (!note) throw new Error(url.searchParams.has('xsec_token')
      ? '笔记内容不可用，请确认登录状态后重试'
      : '笔记链接缺少访问凭证，请刷新收藏列表后重试');
    const valid = (value) => {
      try {
        const media = new URL(String(value || '').replace(/^\/\//, 'https://').replace(/^http:\/\//i, 'https://'));
        return media.protocol === 'https:' && /(^|\.)(xhscdn\.com|xiaohongshu\.com)$/.test(media.hostname) ? media.href : '';
      } catch (_) { return ''; }
    };
    let items;
    const videoNote = note.type === 'video' || post.kind === 'video';
    if (videoNote) {
      const streams = note.video?.media?.stream || {};
      const candidates = Object.values(streams).flat().filter((entry) => entry && typeof entry === 'object');
      candidates.sort((a, b) => (Number(b.width) * Number(b.height) || 0) - (Number(a.width) * Number(a.height) || 0));
      const videoUrl = candidates.map((entry) => valid(entry.masterUrl || entry.url || entry.backupUrls?.[0])).find(Boolean) || valid(note.video?.url);
      if (!videoUrl || /\.m3u8(?:[?#]|$)/i.test(videoUrl)) throw new Error('未读取到可下载的视频地址，请打开笔记详情后下载');
      items = [{ kind: 'video', url: videoUrl }];
    } else {
      items = (note.imageList || []).map(selectImageResource).filter(Boolean);
      items = [...new Map(items.map((item) => [item.url, item])).values()];
      if (!items.length) throw new Error('未读取到笔记图片，请打开笔记详情后下载');
    }
    return { ok: true, kind: videoNote ? 'video' : 'image', title: note.title || post.title, author: note.user?.nickname || post.author?.name || '', items };
  } finally { clearTimeout(timer); }
}

EXT.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'XHS_DL_RESOLVE_NOTE') {
    resolveNoteMedia(message.post || {}).then(respond, (error) => respond({ ok: false, error: error.message || '读取笔记失败' }));
    return true;
  }

  if (message?.type === 'XHS_DL_CACHE_READ' || message?.type === 'XHS_DL_CACHE_WRITE') {
    const operation = message.type === 'XHS_DL_CACHE_READ'
      ? coverCacheRead(Array.isArray(message.codes) ? message.codes : [])
      : coverCacheWrite(message.post);
    operation.then(respond, (error) => respond({ ok: false, error: String(error?.message || error) }));
    return true;
  }

  if (message?.type === 'XHS_DL_HISTORY_LIST') {
    readHistory().then((history) => respond({ ok: true, history })).catch(() => respond({ ok: false, history: [] }));
    return true;
  }

  if (message?.type === 'XHS_DL_HISTORY_APPEND') {
    appendHistoryEntries(message.entries)
      .then(respond)
      .catch((error) => respond({ ok: false, error: String(error?.message || error) }));
    return true;
  }

  if (message?.type === 'XHS_DL_FETCH_JSON') {
    const url = String(message.url || '');
    if (url !== CONFIG_URL) {
      respond({ ok: false, error: '不允许的地址' });
      return;
    }
    fetch(url, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then((data) => respond({ ok: true, data }))
      .catch((error) => respond({ ok: false, error: String(error?.message || error) }));
    return true;
  }

  if (message?.type === 'XHS_DL_OPEN_DOWNLOADS') {
    const url = typeof browser !== 'undefined' && browser.runtime?.getBrowserInfo
      ? 'about:downloads'
      : 'chrome://downloads/';
    if (!EXT.tabs?.create) {
      respond({ ok: false, error: '无法打开下载页' });
      return;
    }
    apiCall(EXT.tabs, 'create', { url })
      .then(() => respond({ ok: true }))
      .catch((error) => respond({ ok: false, error: String(error?.message || error) }));
    return true;
  }

  if (message?.type === 'XHS_DL_JOB_CTRL') {
    const downloadId = Number(message.downloadId);
    const action = message.action;
    const run = action === 'pause'
      ? apiCall(EXT.downloads, 'pause', downloadId)
      : action === 'resume'
        ? apiCall(EXT.downloads, 'resume', downloadId)
        : apiCall(EXT.downloads, 'cancel', downloadId);
    run.then(() => respond({ ok: true })).catch((error) => respond({ ok: false, error: error.message || '操作失败' }));
    return true;
  }

  if (message?.type !== 'XHS_DL_DOWNLOAD') return;
  const item = message.item || {};
  const folder = cleanPart(message.title, '小红书笔记');
  const index = String(Number(item.index || 0) + 1).padStart(2, '0');
  const tabId = sender.tab?.id;
  const jobId = message.jobId || ('j' + Date.now());

  const start = (url, filename, image = null) => {
    apiCall(EXT.downloads, 'download', {
      url,
      filename,
      conflictAction: 'uniquify',
      saveAs: false
    })
      .then((id) => {
        jobs.set(id, { tabId, jobId, filename, formats: image?.formats || {}, fallbackUrls: item.kind === 'image'
          ? [...new Set(image?.fallbackUrls || item.fallbackUrls || [])].filter((value) => {
              try { const media = new URL(value); return media.protocol === 'https:' && /(^|\.)(xhscdn\.com|xiaohongshu\.com)$/.test(media.hostname); } catch (_) { return false; }
            }).slice(0, 3) : [] });
        respond({ ok: true, id, jobId });
        reportDownload(id);
      })
      .catch((error) => respond({ ok: false, error: error.message || '浏览器拒绝下载', jobId }));
  };

  function fallbackName(ext) {
    return `${index}-${kindLabel(item.kind)}.${ext}`;
  }

  function safeFileName(name, ext) {
    const raw = String(name || '').trim();
    if (!raw) return fallbackName(ext);
    if (/\.[a-z0-9]{1,10}$/i.test(raw)) {
      return cleanPart(raw.replace(/\.[^.]+$/, ''), 'file') + '.' + ext;
    }
    return cleanPart(raw, 'file') + '.' + ext;
  }

  if (item.kind === 'text') {
    start(textDataUrl(item.text), `小红书/${folder}/${safeFileName(message.filename, 'txt')}`);
    return true;
  }

  if (!/^https:\/\//i.test(item.url || '')) {
    respond({ ok: false, error: '媒体地址无效', jobId });
    return;
  }
  if (item.kind === 'image') {
    bestImage(item).then((image) => start(image.url, `小红书/${folder}/${safeFileName(message.filename, image.format)}`, image))
      .catch((error) => respond({ ok: false, error: error.message || '图片读取失败', jobId }));
    return true;
  }
  const ext = extensionFor(item.url, item.kind);
  start(item.url, `小红书/${folder}/${safeFileName(message.filename, ext)}`);
  return true;
});
