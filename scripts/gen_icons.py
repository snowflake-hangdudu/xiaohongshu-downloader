"""从 icons/icon-source.png 生成浏览器与商店所需 PNG（铺满画布）。"""
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'icons'
SOURCE = OUT / 'icon-source.png'
# 略留抗锯齿边，避免圆角贴边发硬
FILL = 0.98


def knock_out_background(image: Image.Image, tol: int = 18) -> Image.Image:
    """从四角洪水填充，去掉近白底，保留图标内白色图形。"""
    rgba = image.convert('RGBA')
    pixels = rgba.load()
    w, h = rgba.size
    visited = set()
    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]

    def near_white(x, y):
        r, g, b, a = pixels[x, y]
        return a > 0 and r >= 255 - tol and g >= 255 - tol and b >= 255 - tol

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or (x, y) in visited:
            continue
        visited.add((x, y))
        if not near_white(x, y):
            continue
        pixels[x, y] = (0, 0, 0, 0)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return rgba


def fill_canvas(icon: Image.Image, size: int = 1024) -> Image.Image:
    """裁掉透明边距，把主体放大铺满画布。"""
    bbox = icon.getbbox()
    if not bbox:
        return Image.new('RGBA', (size, size), (0, 0, 0, 0))
    cropped = icon.crop(bbox)
    target = max(1, int(size * FILL))
    scale = target / max(cropped.size)
    new_size = (
        max(1, round(cropped.size[0] * scale)),
        max(1, round(cropped.size[1] * scale)),
    )
    scaled = cropped.resize(new_size, Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(scaled, ((size - new_size[0]) // 2, (size - new_size[1]) // 2), scaled)
    return canvas


def resize_icon(src: Image.Image, size: int) -> Image.Image:
    if size <= 32:
        big = src.resize((size * 4, size * 4), Image.Resampling.LANCZOS)
        big = big.filter(ImageFilter.UnsharpMask(radius=1, percent=115, threshold=2))
        return big.resize((size, size), Image.Resampling.LANCZOS)
    return src.resize((size, size), Image.Resampling.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if not SOURCE.is_file():
        raise SystemExit(f'缺少图标源图：{SOURCE}')

    raw = Image.open(SOURCE)
    sample = raw.convert('RGBA').getpixel((0, 0))
    knocked = (
        knock_out_background(raw)
        if sample[3] > 0 and min(sample[:3]) > 230
        else raw.convert('RGBA')
    )
    icon = fill_canvas(knocked, 1024)
    icon.save(SOURCE, 'PNG', optimize=True)
    print('source fill', round((icon.getbbox()[2] - icon.getbbox()[0]) / 1024 * 100, 1), '%')

    for size in (16, 32, 48, 128):
        resize_icon(icon, size).save(OUT / f'icon{size}.png', 'PNG', optimize=True)
        print('OK', f'icon{size}.png')

    store = ROOT / 'store'
    if store.is_dir():
        for name, size in (('store-icon-128.png', 128), ('logo-300.png', 300)):
            resize_icon(icon, size).save(store / name, 'PNG', optimize=True)
            print('OK', f'store/{name}')


if __name__ == '__main__':
    main()
