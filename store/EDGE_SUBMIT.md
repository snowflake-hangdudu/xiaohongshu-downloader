# Microsoft Edge Add-ons 上架填写参考（1.0.0）

## 提交前检查

- 项目根目录运行 `python scripts/pack.py`，上传 `xiaohongshu-downloader-chrome.zip`；不要提交源码目录。
- 也可一次打两套：`python scripts/pack_all.py`（同时出 Chrome zip 与 Firefox xpi）。
- 上传前确认 `manifest.json` 版本为 `1.0.0`。
- 隐私政策：https://snowflake-hangdudu.github.io/xiaohongshu-downloader/
- 常见问题：https://snowflake-hangdudu.github.io/xiaohongshu-downloader/faq.html

## Properties（属性）— 当前页直接填

| 项 | 填写 |
|---|---|
| Category | **Productivity**（生产力 / 效率工具）。没有这一项就选 **Tools** 或「工具」。不要选 Photos / Social / Entertainment。 |
| Website | `https://snowflake-hangdudu.github.io/xiaohongshu-downloader/` |
| Support contact detail | `hangdudu0@agent.qq.com` |
| Mature content | **不要勾选** |

填完点右下角 Save draft，再进 Privacy。

## Privacy（隐私）

- Remote code：选 **No, I am not using remote code**
- Data collection：全部 **不勾选**（本地保存文件不等于收集用户数据；不要勾 Website content）
- Certifications：下面三项 **全部勾选**
- Privacy Policy URL：`https://snowflake-hangdudu.github.io/xiaohongshu-downloader/`
- 各框粘贴文案见下，每段 ≤1000 字

## Single purpose

```text
小红书下载助手帮助用户在小红书笔记详情页，将页面已经加载、且用户有权保存的图片、视频与文字保存到本地，供个人学习与素材整理使用。仅在用户主动点击保存时工作；不绕过登录、付费、私密限制或 DRM，不收集用户数据。
```

## 权限说明

**activeTab**：识别用户当前打开的小红书笔记详情页。

**downloads**：通过浏览器下载管理器保存用户主动选择的图片、视频或文字文件。

**storage**：仅在本地保存使用须知、公告缓存与评分偏好，不上传用户数据。

**Host permission justification**（整段粘贴）

```text
xiaohongshu.com：仅在笔记详情页读取已经加载的标题、作者、图片、视频和文字，用于展示下载面板。
xhscdn.com：在用户主动点击下载后，保存当前页面已暴露、可公开访问的图片或视频文件。
download-config-hub：仅 GET 一份公开 JSON，用于公告、合作说明和评分开关；不执行远程脚本。
不访问用户账号、私信或其他网站。
```

**Remote code justification**（选 No 后若仍要填）

```text
不使用远程代码。所有脚本都打在扩展包内。配置站只返回静态 JSON 文本，不加载、不执行外部 JS 或 Wasm，也不使用 eval。
```

## 商店描述

```text
小红书下载助手可在小红书笔记详情页，分类识别并保存当前已经加载的图片、视频与文字。

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

## Store listings 搜索词（逐条 Add，最多 7 条）

```
小红书下载
小红书
笔记下载
图片下载
视频下载
图文保存
xiaohongshu
```

## 图片

优先上传 `screenshot-1280x800.png`，可再上传 `screenshot-panel-1280x800.png`；图标使用 `logo-300.png`。完整列表见 `SCREENSHOTS.md`。

## 提交页（Submit）

- Does a tester need credentials…：选 **No**。公开笔记无需账号。若已选 Yes，下面备注里已写明 “No account required”。
- Notes for certification：粘贴下面英文全文。

## 审核备注（英文）

```text
No account, password, or China phone number is required. Please test on a public Xiaohongshu note detail page.

Sample public notes (open in a desktop browser; refresh once after install):
1) https://www.xiaohongshu.com/explore/68e65a3b00000000030366b0?xsec_token=ABdAKbQ758Cl5zAUhFzBOgBGjtbbBFmN-YDtaOadEMSb8=&xsec_source=pc_search&source=web_explore_feed
2) https://www.xiaohongshu.com/explore/695fcb80000000000a029466?xsec_token=AByewggmnvpzOM1ov7tUM836TdnUoQerkleheP-jMjmGk=&xsec_source=pc_search&source=web_explore_feed
3) https://www.xiaohongshu.com/explore/69018e76000000000503813f?xsec_token=ABENEdChZCJwYCl1RX10yL6dDoEpqRAkPeBk8TzNPSQ6I=&xsec_source=pc_search&source=web_explore_feed

How to test:
1. Install the extension and refresh the note page (F5).
2. Primary UI: red floating button at the bottom-right (not the toolbar popup).
3. Click it, accept the local terms once, then open Image / Video / Text tabs.
4. Download one image. Expected: browser download to 小红书/<note title>/.
5. Homepage, search list, and profile pages have no download panel.

Limits: only media already loaded and publicly reachable. Does not unlock paid, private, login-gated, DRM, or HLS (.m3u8). No remote code, analytics, or user-data collection.

Privacy: https://snowflake-hangdudu.github.io/xiaohongshu-downloader/
FAQ: https://snowflake-hangdudu.github.io/xiaohongshu-downloader/faq.html
Contact: hangdudu0@agent.qq.com
```
