/**
 * MAIN world：只读取当前页面已经挂载的播放器，不遍历页面状态树或请求私有接口。
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

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== 'xhs-dl-panel' || event.data.type !== 'GET_VIDEOS') return;
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
