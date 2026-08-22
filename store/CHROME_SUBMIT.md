# Chrome Web Store 上架填写参考（1.0.0）

## 基本资料

- 类别：工具或效率
- 隐私政策：https://snowflake-hangdudu.github.io/xiaohongshu-downloader/
- 支持页面：https://snowflake-hangdudu.github.io/xiaohongshu-downloader/faq.html
- 图标：`store-icon-128.png`
- 主截图：`screenshot-1280x800.png`
- 小型宣传图：`tile-440x280.png`
- 顶部宣传图：`marquee-1400x560.png`

## 单一用途

```text
帮助用户在小红书笔记详情页保存当前已经加载、且用户有权保存的图片、视频与文字，供个人学习与素材整理使用。
```

## 隐私与权限

- Remote code：选择 No。
- 数据收集：全部不勾选。
- `activeTab`、`downloads`、`storage` 与小红书/CDN 主机权限：粘贴 `EDGE_SUBMIT.md` 中的对应说明。

## 测试说明（英文）

```text
Open a public Xiaohongshu note detail page, refresh once after installing the extension, and click the red floating button at the bottom-right. The panel lists media already loaded in that page. Select an image and click Download. No account credentials are required for the extension itself.
```
