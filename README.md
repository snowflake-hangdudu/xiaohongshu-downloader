# 小红书下载助手

支持 Chrome、Edge 和 Firefox。下载笔记图片、视频和文字，支持主页、收藏与点赞批量下载。

面板样式、评分、公告、开发合作、反馈入口与 YouTube 下载器对齐；公告与评分开关走公共配置站。

## 使用

1. 在 `chrome://extensions` 或 `edge://extensions` 开启开发者模式。
2. 选择“加载已解压的扩展程序”，选择本目录。
3. 打开笔记或主页，点击右下角下载按钮。
4. 勾选内容下载。批量下载时，图片笔记保存全部图片，视频笔记保存视频。

下载文件默认位于浏览器下载目录下的 `小红书/<笔记标题>/`。

## 帮助与隐私

- 常见问题：https://snowflake-hangdudu.github.io/xiaohongshu-downloader/faq.html
- 隐私政策：https://snowflake-hangdudu.github.io/xiaohongshu-downloader/

## 边界

- 读取详情页媒体或选中笔记页面，只下载当前账号可访问的内容。
- 不调用私有接口、不伪造签名、不绕过登录、付费、私密或其他访问控制。
- HLS（`.m3u8`）播放流不会伪装成 MP4 下载；页面内 Blob 视频超过 500 MB 会停止，避免浏览器内存被耗尽。
- 请只保存自己拥有版权或已获授权、且符合平台规则的内容。

## 图标

`icons/icon-source.png` 为图标源图；修改后执行 `python scripts/gen_icons.py` 生成 `icon16/32/48/128.png`。

## 打包

```powershell
python scripts/pack_all.py
```

会生成两种商店包：

- `xiaohongshu-downloader-chrome.zip`：Chrome / Edge
- `xiaohongshu-downloader-firefox.xpi`：Firefox

也可单独执行 `python scripts/pack.py` 或 `python scripts/pack_firefox.py`。

## 开发检查

```powershell
npm.cmd test
npm.cmd run check
```
