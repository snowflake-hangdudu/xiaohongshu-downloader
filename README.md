# 小红书素材下载助手

Chrome / Edge Manifest V3 扩展。只在小红书**笔记详情页**识别已经加载的图片、视频和文字，再交给浏览器下载管理器保存。

面板样式、评分、公告、开发合作、反馈入口与 YouTube 下载器对齐；公告与评分开关走公共配置站。

## 使用

1. 在 `chrome://extensions` 或 `edge://extensions` 开启开发者模式。
2. 选择“加载已解压的扩展程序”，选择本目录。
3. 打开一篇小红书笔记详情页，点击右下角悬浮按钮。
4. 按「图片 / 视频 / 文字」分类查看，再保存选中项。

下载文件默认位于浏览器下载目录下的 `小红书/<笔记标题>/`。

## 帮助与隐私

- 常见问题：https://snowflake-hangdudu.github.io/xiaohongshu-downloader/faq.html
- 隐私政策：https://snowflake-hangdudu.github.io/xiaohongshu-downloader/

## 边界

- 只处理当前详情页已经加载、浏览器本身可访问的内容。
- 不调用私有接口、不伪造签名、不绕过登录、付费、私密或其他访问控制。
- HLS（`.m3u8`）播放流不会伪装成 MP4 下载；页面内 Blob 视频超过 500 MB 会停止，避免浏览器内存被耗尽。
- 请只保存自己拥有版权或已获授权、且符合平台规则的内容。

## 图标

`icons/icon-source.svg` 是可编辑矢量源文件，采用与 B 站 / YouTube 下载器一致的卡片、播放键和下载托盘构图，仅使用小红书红与浅粉主题色。修改后执行 `python scripts/gen_icons.py` 生成浏览器所需 PNG。

## 开发检查

```powershell
npm.cmd test
npm.cmd run check
```
