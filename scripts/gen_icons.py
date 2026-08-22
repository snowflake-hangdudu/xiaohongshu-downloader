"""从可编辑 SVG 源图导出浏览器扩展图标。"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'icons'
SOURCE = OUT / 'icon-source.svg'


def render_with_pillow(size=1024):
    """无 Cairo 运行库时，按 SVG 的同一几何结构渲染 PNG。"""
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    scale = size / 128
    s = lambda value: round(value * scale)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=s(25), fill=(255, 36, 66, 255))
    right = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(right).rectangle([s(64), 0, size - 1, size - 1], fill=(248, 231, 234, 255))
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=s(25), fill=255)
    image.alpha_composite(right)
    image.putalpha(mask)
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([s(31), s(36), s(97), s(74)], radius=s(10), fill=(126, 16, 34, 55))
    shadow = shadow.filter(ImageFilter.GaussianBlur(s(2.5)))
    image.alpha_composite(shadow)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle([s(31), s(33), s(97), s(71)], radius=s(10), fill=(255, 255, 255, 255))
    draw.polygon([(s(58), s(42)), (s(76), s(52)), (s(58), s(62))], fill=(255, 36, 66, 255))
    white = (255, 255, 255, 255)
    width = s(7)
    draw.line([(s(64), s(78)), (s(64), s(95))], fill=white, width=width)
    draw.line([(s(53), s(86)), (s(64), s(96)), (s(75), s(86))], fill=white, width=width, joint='curve')
    draw.line([(s(42), s(97)), (s(42), s(105)), (s(86), s(105)), (s(86), s(97))], fill=white, width=width, joint='curve')
    image.putalpha(mask)
    return image


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    source_png = OUT / 'icon-source.png'
    try:
        import cairosvg
        cairosvg.svg2png(url=str(SOURCE), write_to=str(source_png), output_width=1024, output_height=1024)
        src = Image.open(source_png).convert('RGBA')
    except (ImportError, OSError):
        src = render_with_pillow()
        src.save(source_png, 'PNG', optimize=True)
    for size in (16, 32, 48, 128):
        img = src.resize((size * 4, size * 4), Image.Resampling.LANCZOS) if size <= 32 else src.resize((size, size), Image.Resampling.LANCZOS)
        if size <= 32:
            img = img.filter(ImageFilter.UnsharpMask(radius=1, percent=115, threshold=2)).resize((size, size), Image.Resampling.LANCZOS)
        img.save(OUT / f'icon{size}.png', 'PNG', optimize=True)
        print('OK', f'icon{size}.png')


if __name__ == '__main__':
    main()
