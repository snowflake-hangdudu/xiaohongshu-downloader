"""生成可上传到 Chrome / Edge 的 zip 包。"""
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'xiaohongshu-downloader.zip')
INCLUDE = [
    'manifest.json',
    'background.js',
    'content/content.js',
    'content/content.css',
    'content/page-agent.js',
    'popup/popup.html',
    'popup/popup.js',
    'popup/popup.css',
    'docs/faq.html',
    'docs/index.html',
    'icons/icon16.png',
    'icons/icon32.png',
    'icons/icon48.png',
    'icons/icon128.png',
    'README.md',
]

with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as archive:
    for rel in INCLUDE:
        path = os.path.join(ROOT, rel.replace('/', os.sep))
        if not os.path.isfile(path):
            print('SKIP (missing):', rel)
            continue
        archive.write(path, rel)
        print('ADD:', rel)
print('OK ->', OUT)
