# 生成 Android 图标（各密度 mipmap）
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'icons', 'icon-512.png')

# mipmap-xxxhdpi 192 / xxhdpi 144 / xhdpi 96 / hdpi 72 / mdpi 48
DENSITIES = {
    'mdpi': 48,
    'hdpi': 72,
    'xhdpi': 96,
    'xxhdpi': 144,
    'xxxhdpi': 192,
}

src = Image.open(SRC).convert('RGBA')

for name, size in DENSITIES.items():
    outdir = os.path.join(HERE, 'app', 'src', 'main', 'res', f'mipmap-{name}')
    os.makedirs(outdir, exist_ok=True)
    img = src.resize((size, size), Image.LANCZOS)
    img.save(os.path.join(outdir, 'ic_launcher.png'))
    print(f'mipmap-{name}/ic_launcher.png  {size}x{size}')
