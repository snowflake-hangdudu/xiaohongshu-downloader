"""打包 Chrome / Edge 发布 zip。"""
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'xiaohongshu-downloader-chrome.zip')
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
    'shared/i18n.js',
    'shared/design-system.css',
    'assets/donate-wechat.jpg',
    'assets/donate-alipay.jpg',
    'icons/icon16.png',
    'icons/icon32.png',
    'icons/icon48.png',
    'icons/icon128.png',
    '_locales/zh_CN/messages.json',
    '_locales/en/messages.json',
    'README.md',
]


def main():
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as archive:
        for rel in INCLUDE:
            path = os.path.join(ROOT, rel.replace('/', os.sep))
            if not os.path.isfile(path):
                print('SKIP (missing):', rel)
                continue
            archive.write(path, rel)
            print('ADD:', rel)
    print('OK ->', OUT)


if __name__ == '__main__':
    main()
