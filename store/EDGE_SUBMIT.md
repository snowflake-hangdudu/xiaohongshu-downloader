# Microsoft Edge Add-ons 上架填写参考（1.0.0）

## 提交前检查

- 上传由 `python scripts/pack.py` 手动生成的 zip；不要提交源码目录。
- 上传前确认 `manifest.json` 版本为 `1.0.0`。
- 隐私政策：https://snowflake-hangdudu.github.io/xiaohongshu-downloader/
- 常见问题：https://snowflake-hangdudu.github.io/xiaohongshu-downloader/faq.html

## Single purpose

```text
小红书素材下载助手帮助用户在小红书笔记详情页，将页面已经加载、且用户有权保存的图片、视频与文字保存到本地，供个人学习与素材整理使用。仅在用户主动点击保存时工作；不绕过登录、付费、私密限制或 DRM，不收集用户数据。
```

## 权限说明

**activeTab**：识别用户当前打开的小红书笔记详情页。

**downloads**：通过浏览器下载管理器保存用户主动选择的图片、视频或文字文件。

**storage**：仅在本地保存使用须知、公告缓存与评分偏好，不上传用户数据。

**xiaohongshu.com / xhscdn.com**：读取当前页面已经加载的媒体，并保存用户主动选择的可公开访问内容。

**download-config-hub**：仅读取公开 JSON，用于公告、合作说明和评分开关；不加载或执行远程代码。

## 商店描述

```text
小红书素材下载助手可在小红书笔记详情页，分类识别并保存当前已经加载的图片、视频与文字。

主要功能：
• 图片 / 视频 / 文字分类展示，支持勾选后批量保存
• 右下角悬浮面板与工具栏入口，展示标题、作者和下载进度
• 下载任务可暂停、继续或取消；文件保存在浏览器默认下载目录
• HLS（.m3u8）、付费、私密或访问受限内容不支持保存
• 完全免费，不收集、不上传任何用户数据

使用方法：打开一篇小红书笔记详情页，点击右下角悬浮按钮，确认使用须知后选择图片、视频或文字并保存。

仅供个人学习与整理。请仅保存自己拥有版权或已获授权的内容，并遵守平台规则。
反馈邮箱：hangdudu0@agent.qq.com
```

## 图片

优先上传 `screenshot-1280x800.png`，可再上传 `screenshot-panel-1280x800.png`；图标使用 `logo-300.png`。完整列表见 `SCREENSHOTS.md`。

## 审核备注（英文）

```text
IMPORTANT: The primary UI is the red floating button at the bottom-right of a Xiaohongshu note detail page. Please open a public note detail page, refresh after installation, then click the red floating button.

The extension only lists media already loaded in the current note page after an explicit user action. It does not unlock paid, private, login-restricted, DRM-protected, or HLS content. No remote code, analytics, or user data collection.

Privacy: https://snowflake-hangdudu.github.io/xiaohongshu-downloader/
FAQ: https://snowflake-hangdudu.github.io/xiaohongshu-downloader/faq.html
Contact: hangdudu0@agent.qq.com
```
