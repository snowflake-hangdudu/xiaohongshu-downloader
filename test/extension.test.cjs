const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const content = read('content/content.js');
const agent = read('content/page-agent.js');

assert.equal(manifest.manifest_version, 3, 'must remain MV3');
assert.equal(manifest.version, '1.0.1', 'release manifest version must be explicit');
assert.equal(manifest.default_locale, 'zh_CN', 'default locale must be Simplified Chinese');
assert.equal(manifest.name, '__MSG_extName__', 'store display name must use locale message');
assert.equal(manifest.action.default_title, '__MSG_extName__', 'toolbar title must use locale message');
const zhName = JSON.parse(read('_locales/zh_CN/messages.json')).extName.message;
const enName = JSON.parse(read('_locales/en/messages.json')).extName.message;
assert.equal(zhName, '小红书下载助手 - 图片视频下载', 'zh store name must match listing');
assert.equal(enName, 'RedNote Downloader - Xiaohongshu Video & Image Downloader', 'en store name must match listing');
assert.ok(manifest.permissions.includes('downloads'), 'native downloads permission is required');
assert.ok(manifest.content_scripts.some((script) => script.js?.includes('content/page-agent.js')), 'page agent must be registered');
assert.ok(!agent.includes('__INITIAL_STATE__'), 'do not collect unrelated page state');
assert.ok(!agent.includes('__INITIAL_SSR_STATE__'), 'do not collect unrelated SSR state');
assert.ok(!/sns-video\|\.mp4\|\.m3u8/.test(content), 'HLS playlists must not be offered as MP4 downloads');
assert.ok(content.includes('MAX_BLOB_DOWNLOAD_BYTES'), 'blob-download memory limit is required');
assert.ok(content.includes('received > MAX_BLOB_DOWNLOAD_BYTES'), 'unknown-length blobs must also be capped');
assert.ok(content.includes('isOlderVersion(VERSION, minimum)'), 'remote minimum-version notice must be honored');
assert.ok(content.includes('const STORE_RATING_MIN_SUCCESS = 10'), 'rating prompt must wait for 10 successful downloads');
assert.ok(content.includes('queueMediaRefresh'), 'late-loading carousel media must trigger a debounced refresh');
assert.ok(content.includes("attributeFilter: ['src', 'srcset', 'poster']"), 'late media source assignment must be observed');
assert.ok(!fs.existsSync(path.join(root, 'xiaohongshu-downloader.zip')), 'stale release zip must not live beside source');

console.log('extension checks passed');
