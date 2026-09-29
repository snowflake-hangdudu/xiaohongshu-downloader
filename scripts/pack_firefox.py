"""打包 Firefox 发布包（XPI）。"""
import json
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'xiaohongshu-downloader-firefox.xpi')
INCLUDE = [
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


def build_manifest():
    with open(os.path.join(ROOT, 'manifest.json'), 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    manifest['background'] = {
        'scripts': ['background.js']
    }
    manifest['browser_specific_settings'] = {
        'gecko': {
            'id': 'xiaohongshu-downloader@hangdudu.local',
            'data_collection_permissions': {
                'required': ['none']
            },
            'strict_min_version': '121.0'
        }
    }
    return json.dumps(manifest, ensure_ascii=False, indent=2) + '\n'


def main():
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('manifest.json', build_manifest().encode('utf-8'))
        print('ADD: manifest.json (firefox)')
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
