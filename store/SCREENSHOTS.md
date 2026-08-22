# 商店图片资源

所有截图均来自真实的小红书笔记详情页及扩展 1.0.0 面板，不含生成式替换或虚构界面。

| 文件 | 尺寸 | 用途 |
|---|---:|---|
| `store-icon-128.png` | 128×128 | Chrome Web Store 图标 |
| `logo-300.png` | 300×300 | Microsoft Edge Add-ons 图标 |
| `screenshot-1280x800.png` | 1280×800 | 主截图 |
| `screenshot-panel-1280x800.png` | 1280×800 | 面板特写截图 |
| `screenshot-640x400.png` | 640×400 | 备用截图 |
| `tile-440x280.png` | 440×280 | Chrome 小型宣传图 |
| `marquee-1400x560.png` | 1400×560 | Chrome 顶部宣传图 |

需要从新的真实截图重新生成时，把它命名为 `source-capture.png` 放在本目录，运行：

```powershell
python store/_format_store_assets.py
```
