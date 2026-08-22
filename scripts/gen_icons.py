"""以下载器统一母版生成小红书红主题图标。"""
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'icons'
MASTER = OUT / 'icon-master.png'


def recolor_to_xhs(master):
    """保留母版每个像素的透明度、阴影与形状，只把 B 站蓝换成小红书红。"""
    image = master.convert('RGBA')
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            # 母版的蓝色在边缘会先与白色混合。保留混合强度，才能让
            # 红色边缘和原图的抗锯齿完全一致，而不是留下浅蓝色杂点。
            if blue - red > 8 and green - red > 8 and blue > 90:
                strength = min(1.0, (blue - red) / 214)
                pixels[x, y] = (
                    255,
                    round(255 * (1 - strength) + 36 * strength),
                    round(255 * (1 - strength) + 66 * strength),
                    alpha,
                )
    return image


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if not MASTER.is_file():
        raise SystemExit(f'缺少图标母版：{MASTER}')
    source_png = OUT / 'icon-source.png'
    src = recolor_to_xhs(Image.open(MASTER))
    src.save(source_png, 'PNG', optimize=True)
    for size in (16, 32, 48, 128):
        img = src.resize((size * 4, size * 4), Image.Resampling.LANCZOS) if size <= 32 else src.resize((size, size), Image.Resampling.LANCZOS)
        if size <= 32:
            img = img.filter(ImageFilter.UnsharpMask(radius=1, percent=115, threshold=2)).resize((size, size), Image.Resampling.LANCZOS)
        img.save(OUT / f'icon{size}.png', 'PNG', optimize=True)
        print('OK', f'icon{size}.png')


if __name__ == '__main__':
    main()
