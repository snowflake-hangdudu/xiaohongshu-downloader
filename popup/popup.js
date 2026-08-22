const EXT = typeof browser !== 'undefined' ? browser : chrome;
const VERSION = EXT.runtime.getManifest().version;
document.getElementById('app-version').textContent = 'v' + VERSION;

const $ = (id) => document.getElementById(id);

function isXhsUrl(url) {
  return url && /xiaohongshu\.com/i.test(url);
}

function isXhsDetailUrl(url) {
  if (!url) return false;
  return /xiaohongshu\.com\/(?:explore|discovery\/item|search_result)\/[0-9a-z]+/i.test(url);
}

function formatCurrentSite(url) {
  if (!url) return '当前页面：—';
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return '当前页面：' + u.protocol.replace(':', '');
    }
    let path = u.pathname;
    if (path.length > 24) path = path.slice(0, 24) + '…';
    const suffix = path && path !== '/' ? path : '';
    return '当前页面：' + u.hostname + suffix;
  } catch {
    return '当前页面：未知';
  }
}

function showState(name) {
  ['state-loading', 'state-video', 'state-empty', 'state-error'].forEach((id) => {
    $(id).classList.toggle('hidden', id !== name);
  });
}

function showEmptyState(tab) {
  const siteEl = $('empty-current-site');
  if (siteEl) siteEl.textContent = formatCurrentSite(tab?.url);
  showState('state-empty');
}

function renderNote(info) {
  $('video-title').textContent = info.title || '当前小红书笔记';
  const authorEl = $('video-author');
  if (info.author) {
    authorEl.textContent = info.author;
    authorEl.classList.remove('hidden');
  } else {
    authorEl.classList.add('hidden');
  }
  const imageCount = info.images?.length || 0;
  const videoCount = info.videos?.length || 0;
  $('video-sub').textContent = `图片 ${imageCount} · 视频 ${videoCount} · 文字 ${info.text ? '已识别' : '无'}`;

  const cover = $('video-cover');
  const coverPh = $('video-cover-ph');
  if (info.cover) {
    cover.src = info.cover;
    cover.onload = () => {
      cover.classList.remove('hidden');
      coverPh.classList.add('hidden');
    };
    cover.onerror = () => {
      cover.classList.add('hidden');
      coverPh.classList.remove('hidden');
    };
  } else {
    cover.classList.add('hidden');
    coverPh.classList.remove('hidden');
  }
  $('btn-open-panel').disabled = false;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label || '超时')), ms))
  ]);
}

async function init() {
  showState('state-loading');
  const [tab] = await EXT.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !isXhsUrl(tab.url)) {
    showEmptyState(tab);
    return;
  }

  const tabId = tab.id;
  try {
    const resp = await withTimeout(
      EXT.tabs.sendMessage(tabId, { type: 'XHS_DL_GET_INFO' }),
      8000,
      '识别超时'
    );
    if (resp?.ok && resp.data?.info) {
      renderNote(resp.data.info);
      showState('state-video');
    } else if (isXhsDetailUrl(tab.url)) {
      throw new Error(resp?.error || '无法读取笔记，请先 F5');
    } else {
      showEmptyState(tab);
    }
  } catch (err) {
    if (!isXhsDetailUrl(tab.url)) {
      showEmptyState(tab);
    } else {
      $('error-text').textContent = err.message || '加载失败';
      showState('state-error');
    }
  }

  $('btn-open-panel')?.addEventListener('click', async () => {
    try {
      await EXT.tabs.sendMessage(tabId, { type: 'XHS_DL_OPEN_PANEL' });
      window.close();
    } catch {
      $('error-text').textContent = '无法打开面板，请刷新详情页';
      showState('state-error');
    }
  });

  $('btn-retry')?.addEventListener('click', async () => {
    if (!tabId) return;
    try {
      await EXT.tabs.reload(tabId);
      window.close();
    } catch {
      $('error-text').textContent = '无法刷新页面，请手动 F5';
      showState('state-error');
    }
  });
}

init();
