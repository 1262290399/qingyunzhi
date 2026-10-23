# 生成 PWA 图标：深色底 + 金色「青云」意象
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')
os.makedirs(OUT, exist_ok=True)

BG1 = (14, 18, 24)      # 深夜蓝黑
BG2 = (26, 32, 42)
GOLD = (201, 168, 106)
JADE = (122, 178, 156)

FONTS = [
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    r"C:\Windows\Fonts\simsun.ttc",
]


def load_font(size):
    for p in FONTS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def rounded_mask(size, radius):
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def make(size, pad_ratio=0.0, transparent_bg=False):
    S = size * 4  # 超采样，缩下去更干净
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 底：竖直渐变
    for y in range(S):
        t = y / max(1, S - 1)
        c = tuple(int(BG1[i] + (BG2[i] - BG1[i]) * t) for i in range(3)) + (255,)
        d.line([(0, y), (S, y)], fill=c)

    # 山形剪影（三层，越远越淡）
    layers = [
        (0.62, (18, 23, 31), 0.0),
        (0.70, (22, 28, 38), 0.06),
        (0.78, (28, 35, 47), 0.12),
    ]
    for base, color, off in layers:
        pts = [(0, S)]
        xs = 7
        for i in range(xs + 1):
            x = S * i / xs
            import math
            h = S * base - S * 0.10 * math.sin(i * 1.7 + off * 30 + 0.9) - S * off
            pts.append((x, h))
        pts.append((S, S))
        d.polygon(pts, fill=color + (255,))

    # 中央「青」字
    f = load_font(int(S * 0.46))
    cx, cy = S // 2, int(S * 0.44)
    d.text((cx, cy), '青', font=f, fill=GOLD + (255,), anchor='mm')

    # 下方一条细线
    lw = int(S * 0.30)
    d.rounded_rectangle(
        [cx - lw // 2, int(S * 0.72), cx + lw // 2, int(S * 0.72) + max(2, S // 220)],
        radius=S, fill=JADE + (200,)
    )

    img = img.resize((size, size), Image.LANCZOS)

    if transparent_bg:
        # maskable：内容缩进到安全区，底色铺满
        inner = int(size * 0.80)
        canvas = Image.new('RGBA', (size, size), BG1 + (255,))
        small = img.resize((inner, inner), Image.LANCZOS)
        canvas.paste(small, ((size - inner) // 2, (size - inner) // 2))
        return canvas

    # 普通图标：圆角
    mask = rounded_mask(size, int(size * 0.22))
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0))
    out.putalpha(mask)
    return out


for s in (192, 512):
    make(s).save(os.path.join(OUT, f'icon-{s}.png'))
    make(s, transparent_bg=True).save(os.path.join(OUT, f'maskable-{s}.png'))
    print(f'icon-{s}.png / maskable-{s}.png')

make(180).save(os.path.join(OUT, 'apple-touch-icon.png'))
make(32).save(os.path.join(OUT, 'favicon.png'))
print('apple-touch-icon.png / favicon.png')
