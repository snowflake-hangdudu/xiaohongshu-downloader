# Firefox 上架填写参考（1.0.0）

## 打包

```powershell
python scripts/pack_firefox.py
```

生成：`xiaohongshu-downloader-firefox.xpi`  
也可一次打两套：`python scripts/pack_all.py`。

## 当前包内关键设置

- Manifest V3
- Firefox 后台使用 `background.scripts`
- Gecko ID：`xiaohongshu-downloader@hangdudu.local`
- 最低版本：`121.0`
- 数据收集声明：`required: none`

## 入口

- 开发者后台：https://addons.mozilla.org/developers/

## 描述页（Describe add-on）直接填

**名称**：已从包内读取，不用改。

**概述（Summary）**：可保持现有这句，或换成下面（≤250 字）

```text
在小红书笔记详情页保存已加载的图片、视频与文字。仅供个人学习与整理，不收集用户数据。
```

**描述（Description，支持 Markdown）**

```text
在小红书**笔记详情页**分类识别并保存当前已经加载的图片、视频与文字。

## 主要功能
- 图片 / 视频 / 文字分栏，支持单项或批量保存
- 页面右下角悬浮按钮为主要入口
- 下载进度可暂停、继续或取消
- 文件保存在浏览器默认下载目录的 `小红书/笔记标题/`

## 使用方法
1. 打开一篇公开笔记详情页，刷新一次
2. 点击右下角红色悬浮按钮
3. 确认使用须知后，按分类选择并保存

## 边界
- 只保存当前页已经加载、可公开访问的内容
- 不支持 HLS（.m3u8）、付费、私密、登录受限或 DRM
- 首页、搜索列表、个人主页没有下载面板
- 完全免费，不收集、不上传用户数据

反馈：hangdudu0@agent.qq.com
常见问题：https://snowflake-hangdudu.github.io/xiaohongshu-downloader/faq.html
```

**两个勾选项**：都不要勾（不是实验性，也不收费）。

**分类**：勾这两项即可

- Download Management（下载管理）
- Photos, Music & Video（照片、音乐和视频）

**用户支持邮箱**：`hangdudu0@agent.qq.com`  
**用户支持网站**：`https://snowflake-hangdudu.github.io/xiaohongshu-downloader/faq.html`

**许可协议**：选 **All Rights Reserved（保留所有权利）**

**隐私策略**：勾选 “This add-on has its own privacy policy”，链接填

```text
https://snowflake-hangdudu.github.io/xiaohongshu-downloader/
```

**给审核员的备注**（仅审核可见，英文）：见文末。

## 建议填写

**名称**

- 小红书下载助手

**简介**

- 在小红书笔记详情页保存已加载的图片、视频与文字。仅供个人学习与素材整理。不收集用户数据。

**权限说明**

- `activeTab`：识别当前打开的小红书笔记详情页
- `downloads`：通过浏览器下载管理器保存用户主动选择的图片、视频或文字
- `storage`：仅在本地保存使用须知、公告缓存与评分偏好
- Host permissions：仅限小红书站点、媒体 CDN，以及公开配置 JSON

## 上架前自查

- 说明页写明「仅供个人学习与整理」
- 不写「下载全部小红书内容」这类过度表述
- 隐私项选择「不收集数据」
- 准备 1 张产品图标和 1 到 3 张截图（见 `SCREENSHOTS.md`）

## 审核备注（英文）

```text
No account or password is required. Test on a public Xiaohongshu note detail page.

Sample notes:
1) https://www.xiaohongshu.com/explore/68e65a3b00000000030366b0?xsec_token=ABdAKbQ758Cl5zAUhFzBOgBGjtbbBFmN-YDtaOadEMSb8=&xsec_source=pc_search&source=web_explore_feed
2) https://www.xiaohongshu.com/explore/695fcb80000000000a029466?xsec_token=AByewggmnvpzOM1ov7tUM836TdnUoQerkleheP-jMjmGk=&xsec_source=pc_search&source=web_explore_feed
3) https://www.xiaohongshu.com/explore/69018e76000000000503813f?xsec_token=ABENEdChZCJwYCl1RX10yL6dDoEpqRAkPeBk8TzNPSQ6I=&xsec_source=pc_search&source=web_explore_feed

How to test:
1. Install, then refresh the note page (F5).
2. Primary UI: red floating button at the bottom-right (not the toolbar popup).
3. Click it, accept local terms once, then download one image from the Image tab.
4. Homepage / search list / profile have no panel.

This is plain JS MV3. No transpile or minify. Source = the uploaded XPI.
Limits: only already-loaded public media. No paid/private/HLS/DRM unlock. No remote code, analytics, or user-data collection.

Privacy: https://snowflake-hangdudu.github.io/xiaohongshu-downloader/
FAQ: https://snowflake-hangdudu.github.io/xiaohongshu-downloader/faq.html
Contact: hangdudu0@agent.qq.com
```
