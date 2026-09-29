const EXT = typeof browser !== 'undefined' ? browser : chrome;

const CONFIG_URL = 'http://124.222.62.190:8081/api/config/xiaohongshu';
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
    const sent = EXT.tabs.sendMessage(tabId, { type: 'XHS_DL_PROGRESS', ...payload });
    if (sent && typeof sent.catch === 'function') sent.catch(() => {});
  } catch (_) {}
}

function downloadsSearch(query) {
  try {
    const result = EXT.downloads.search(query);
    if (result && typeof result.then === 'function') return result;
  } catch (_) {}
  return new Promise((resolve) => {
    EXT.downloads.search(query, (items) => resolve(items || []));
  });
}

function reportDownload(id) {
  const job = jobs.get(id);
  if (!job) return;
  downloadsSearch({ id }).then((items) => {
    const item = items && items[0];
    if (!item) return;
    const total = item.totalBytes > 0 ? item.totalBytes : 0;
    const received = item.bytesReceived || 0;
    let step = 'download';
    let percent = total ? Math.min(99, Math.round((received / total) * 100)) : 0;
    if (item.state === 'complete') {
      step = 'done';
      percent = 100;
    } else if (item.state === 'interrupted') {
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
      error: item.error || ''
    });
    if (item.state === 'complete' || item.state === 'interrupted') {
      setTimeout(() => jobs.delete(id), 2000);
    }
  }).catch(() => {});
}

EXT.downloads.onChanged.addListener((delta) => {
  if (!jobs.has(delta.id)) return;
  reportDownload(delta.id);
});

EXT.runtime.onMessage.addListener((message, sender, respond) => {
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

  if (message?.type === 'XHS_DL_JOB_CTRL') {
    const downloadId = Number(message.downloadId);
    const action = message.action;
    const run = action === 'pause'
      ? EXT.downloads.pause(downloadId)
      : action === 'resume'
        ? EXT.downloads.resume(downloadId)
        : EXT.downloads.cancel(downloadId);
    run.then(() => respond({ ok: true })).catch((error) => respond({ ok: false, error: error.message || '操作失败' }));
    return true;
  }

  if (message?.type !== 'XHS_DL_DOWNLOAD') return;
  const item = message.item || {};
  const folder = cleanPart(message.title, '小红书笔记');
  const index = String(Number(item.index || 0) + 1).padStart(2, '0');
  const tabId = sender.tab?.id;
  const jobId = message.jobId || ('j' + Date.now());

  const start = (url, filename) => {
    EXT.downloads.download({
      url,
      filename,
      conflictAction: 'uniquify',
      saveAs: false
    })
      .then((id) => {
        jobs.set(id, { tabId, jobId });
        respond({ ok: true, id, jobId });
        reportDownload(id);
      })
      .catch((error) => respond({ ok: false, error: error.message || '浏览器拒绝下载', jobId }));
  };

  if (item.kind === 'text') {
    start(textDataUrl(item.text), `小红书/${folder}/${index}-${kindLabel('text')}.txt`);
    return true;
  }

  if (!/^https:\/\//i.test(item.url || '')) {
    respond({ ok: false, error: '媒体地址无效', jobId });
    return;
  }
  const ext = extensionFor(item.url, item.kind);
  start(item.url, `小红书/${folder}/${index}-${kindLabel(item.kind)}.${ext}`);
  return true;
});
