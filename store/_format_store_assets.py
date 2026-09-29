"""由真实产品截图生成 Chrome / Edge 商店素材。"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'source-capture.png'
ICON = ROOT.parent / 'icons' / 'icon128.png'


def cover(image, size, box=None):
    source = image.crop(box) if box else image
    return ImageOps.fit(source.convert('RGB'), size, method=Image.Resampling.LANCZOS, centering=(0.55, 0.50))


def main():
    if not SOURCE.is_file():
        raise SystemExit(f'缺少截图：{SOURCE}')
    image = Image.open(SOURCE).convert('RGB')
    width, height = image.size
    print('source', image.size)

    # 整体界面：产品正在识别 10 张图片，右侧面板完整可见。
    cover(image, (1280, 800)).save(ROOT / 'screenshot-1280x800.png', 'PNG', optimize=True)
    cover(image, (640, 400)).save(ROOT / 'screenshot-640x400.png', 'PNG', optimize=True)

    # 面板特写：保留列表、批量保存与底栏，裁掉无关的左侧信息流。
    panel_left = int(width * 0.63)
    panel_top = int(height * 0.06)
    panel_bottom = int(height * 0.94)
    focus = cover(image, (1280, 800), (panel_left, panel_top, width, panel_bottom))
    focus.save(ROOT / 'screenshot-panel-1280x800.png', 'PNG', optimize=True)
    # 440×280 直接取面板顶部，避免宣传图裁掉扩展名称与识别结果。
    tile_left = max(0, width - 448)
    tile_top = int(height * 0.055)
    tile = image.crop((tile_left, tile_top, width, tile_top + 280))
    tile.resize((440, 280), Image.Resampling.LANCZOS).save(ROOT / 'tile-440x280.png', 'PNG', optimize=True)

    # 顶部宣传图：宽画幅仍保留笔记详情和右侧保存面板。
    marquee = cover(image, (1400, 560))
    marquee.save(ROOT / 'marquee-1400x560.png', 'PNG', optimize=True)

    write_store_icons()


def write_store_icons():
    """商店图标用扩展图标铺满，透明圆角落到左右分色底上，不要再缩进贴红底。"""
    icon = Image.open(ICON).convert('RGBA')
    for filename, size in [('store-icon-128.png', 128), ('logo-300.png', 300)]:
        mark = icon.resize((size, size), Image.Resampling.LANCZOS)
        canvas = Image.new('RGB', (size, size), (255, 255, 255))
        ImageDraw.Draw(canvas).rectangle((0, 0, size // 2, size), fill=(255, 36, 66))
        canvas.paste(mark, (0, 0), mark)
        canvas.save(ROOT / filename, 'PNG', optimize=True)
        print('OK', filename, size)


if __name__ == '__main__':
    import sys
    if sys.argv[1:] == ['icons']:
        write_store_icons()
    else:
        main()
