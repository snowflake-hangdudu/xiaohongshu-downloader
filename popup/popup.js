const EXT = typeof browser !== 'undefined' ? browser : chrome;
const VERSION = EXT.runtime.getManifest().version;
document.getElementById('app-version').textContent = 'v' + VERSION;

const $ = (id) => document.getElementById(id);
function t(key, values) {
  return globalThis.DownloaderKit?.i18n?.t?.(key, values) || key;
}

function isXhsUrl(url) {
  return url && /xiaohongshu\.com/i.test(url);
}

function isXhsDetailUrl(url) {
  if (!url) return false;
  return /xiaohongshu\.com\/(?:explore|discovery\/item|search_result)\/[0-9a-z]+/i.test(url);
}

function isXhsProfileUrl(url) {
  if (!url) return false;
  return /xiaohongshu\.com\/user\/profile\/[0-9a-z]+/i.test(url);
}

function isXhsSupportedUrl(url) {
  return isXhsDetailUrl(url) || isXhsProfileUrl(url);
}

function formatCurrentSite(url) {
  const prefix = t('currentPage');
  if (!url) return prefix + '—';
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return prefix + u.protocol.replace(':', '');
    }
    let path = u.pathname;
    if (path.length > 24) path = path.slice(0, 24) + '…';
    const suffix = path && path !== '/' ? path : '';
    return prefix + u.hostname + suffix;
  } catch {
    return prefix + t('unknownPage');
  }
}

function showState(name) {
  ['state-loading', 'state-video', 'state-empty', 'state-error'].forEach((id) => {
    $(id).classList.toggle('hidden', id !== name);
  });
}

function applyStaticCopy() {
  globalThis.DownloaderKit?.i18n?.apply?.(document);
  document.body.style.setProperty('--xhs-author-prefix', JSON.stringify(t('authorPrefix')));
  document.querySelector('.popup-steps')?.setAttribute('aria-label', t('downloadSteps'));
}

function showEmptyState(tab) {
  const onXhs = isXhsUrl(tab?.url);
  const status = $('page-status');
  const title = $('empty-title');
  const lead = $('empty-lead');
  const siteEl = $('empty-current-site');
  const go = $('btn-go-xhs');

  if (status) status.textContent = onXhs ? t('notSupportedPage') : t('openXhsFirst');
  if (title) title.textContent = onXhs ? t('emptyTitleOnSite') : t('emptyTitleOffSite');
  if (lead) lead.textContent = onXhs ? t('emptyLeadOnSite') : t('emptyLeadOffSite');
  if (siteEl) siteEl.textContent = formatCurrentSite(tab?.url);
  if (go) go.hidden = onXhs;
  showState('state-empty');
}

function renderNote(info, options = {}) {
  const isProfile = !!options.isProfile;
  $('video-title').textContent = info.title || (isProfile ? t('creator') : t('currentNote'));
  const authorEl = $('video-author');
  if (info.author) {
    authorEl.textContent = info.author;
    authorEl.classList.remove('hidden');
  } else {
    authorEl.classList.add('hidden');
  }

  if (isProfile) {
    $('video-sub').textContent = t('scanReadyCount', { count: info.creatorCount || 0 });
  } else {
    const imageCount = info.images?.length || 0;
    const videoCount = info.videos?.length || 0;
    $('video-sub').textContent = t('mediaSummary', {
      images: imageCount,
      videos: videoCount,
      text: info.text ? t('textRecognized') : t('textNone')
    });
  }

  const detect = document.querySelector('#state-video .popup-detect span:last-child');
  if (detect) detect.textContent = isProfile ? t('recognizedProfile') : t('recognizedNote');
  const ready = document.querySelector('#state-video .popup-note p');
  if (ready) ready.textContent = isProfile ? t('readyProfile') : t('readyNote');

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
    new Promise((_, reject) => setTimeout(() => reject(new Error(label || t('timeout'))), ms))
  ]);
}

async function init() {
  try {
    await Promise.race([
      globalThis.DownloaderKit?.i18n?.ready || Promise.resolve(),
      new Promise((resolve) => setTimeout(resolve, 250))
    ]);
  } catch (_) {}
  applyStaticCopy();
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
      t('timeout')
    );
    if (resp?.ok && resp.data?.info) {
      renderNote(resp.data.info, { isProfile: !!resp.data.isProfile && !resp.data.isDetail });
      showState('state-video');
    } else if (isXhsSupportedUrl(tab.url)) {
      throw new Error(resp?.error || t('readFail'));
    } else {
      showEmptyState(tab);
    }
  } catch (err) {
    if (!isXhsSupportedUrl(tab.url)) {
      showEmptyState(tab);
    } else {
      $('error-text').textContent = err.message || t('loadFailed');
      showState('state-error');
    }
  }

  $('btn-open-panel')?.addEventListener('click', async () => {
    try {
      await EXT.tabs.sendMessage(tabId, { type: 'XHS_DL_OPEN_PANEL' });
      window.close();
    } catch {
      $('error-text').textContent = t('panelFail');
      showState('state-error');
    }
  });

  $('btn-retry')?.addEventListener('click', async () => {
    if (!tabId) return;
    try {
      await EXT.tabs.reload(tabId);
      window.close();
    } catch {
      $('error-text').textContent = t('refreshFail');
      showState('state-error');
    }
  });
}

init();
