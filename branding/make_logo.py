#!/usr/bin/env python3
"""Draws the Mikajy logo: the original mark (a white M on a black-and-red rounded square cut by a diagonal sweep), lighter and handwritten:
a hand-lettered M (Caveat Bold, SIL OFL), a soft shadow instead of a hard one, a thin double sweep, two fine speed lines and a gentle glow.
python3 branding/make_logo.py [path/to/Caveat[wght].ttf]   (default: $MIKAJY_CAVEAT or ~/mikajy-data/assets/caveat.ttf)
Writes branding/logo-512.png, branding/logo-1024.png and the 192 px launcher icon android/res/drawable/icon.png.
branding/logo-original-512.png keeps the first artwork for reference."""
import os, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
S = 2048; U = S / 1000.0
here = Path(__file__).resolve().parent
P = lambda pts: [(x * U, y * U) for x, y in pts]
CORAL, RED, RED_L, INK = (244, 96, 76), (232, 52, 40), (255, 168, 140), (38, 36, 38)
src = Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get('MIKAJY_CAVEAT', Path.home() / 'mikajy-data/assets/caveat.ttf'))

def bezier(p0, p1, p2, n=60):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in [i / n for i in range(n + 1)]]

# lighter field: a coral-to-red gradient instead of flat saturated red
img = Image.new('RGB', (S, S), INK)
grad = Image.new('RGB', (S, S)); gd = ImageDraw.Draw(grad)
for y in range(S):
    t = y / S; gd.line([(0, y), (S, y)], fill=tuple(int(CORAL[i] + (RED[i] - CORAL[i]) * t) for i in range(3)))
mask = Image.new('L', (S, S), 0)
sweep = bezier((430, 0), (150, 170), (0, 560))
ImageDraw.Draw(mask).polygon(P(sweep + [(0, 1000), (1000, 1000), (1000, 0)]), fill=255)
img.paste(grad, (0, 0), mask)
d = ImageDraw.Draw(img)
# thin double sweep (the Free logo's layered plates, drawn as hairlines)
for off, w, col in ((60, 6, RED_L), (130, 3, (255, 205, 190))):
    d.line(P(bezier((430 + off, 0), (150 + off * .9, 170 + off), (0, 560 + off * 1.6))), fill=col, width=int(w * U))
for k, (y, w) in enumerate([(95, 5), (130, 3)]):                       # two fine speed lines
    d.line(P([(1000, y), (800 - k * 50, y)]), fill=(255, 215, 200), width=int(w * U))
# soft white glow behind the letter
glow = Image.new('RGB', (S, S), (0, 0, 0)); ImageDraw.Draw(glow).ellipse(P([(170, 200), (830, 800)]), fill=(255, 190, 170))
img = ImageChops.add(img, Image.eval(glow.filter(ImageFilter.GaussianBlur(190)), lambda v: int(v * .45)))

# the hand-lettered M
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
tmp = here / '.caveat-bold.ttf'
instancer.instantiateVariableFont(TTFont(src), {'wght': 700}).save(tmp)
font = ImageFont.truetype(str(tmp), int(800 * U))
tmp.unlink()
bb = d.textbbox((0, 0), 'M', font=font)
w, h = bb[2] - bb[0], bb[3] - bb[1]
x, y = (S - w) / 2 - bb[0] + 10 * U, (S - h) / 2 - bb[1] - 10 * U
shadow = Image.new('L', (S, S), 0); ImageDraw.Draw(shadow).text((x + 14 * U, y + 22 * U), 'M', font=font, fill=120)
shadow = shadow.filter(ImageFilter.GaussianBlur(26))
img = Image.composite(Image.new('RGB', (S, S), (60, 10, 10)), img, shadow)
ImageDraw.Draw(img).text((x, y), 'M', font=font, fill=(255, 255, 255))

rm = Image.new('L', (S, S), 0); ImageDraw.Draw(rm).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.2), fill=255)
out = Image.new('RGBA', (S, S), (0, 0, 0, 0)); out.paste(img.convert('RGBA'), (0, 0), rm)
orig = here / 'logo-original-512.png'
if not orig.exists() and (here / 'logo-512.png').exists(): (here / 'logo-512.png').rename(orig)
for size, path in ((1024, here / 'logo-1024.png'), (512, here / 'logo-512.png')):
    out.resize((size, size), Image.Resampling.LANCZOS).save(path, optimize=True)
flat = Image.new('RGB', (S, S), (0, 0, 0)); flat.paste(out, (0, 0), out)
flat.resize((192, 192), Image.Resampling.LANCZOS).save(here.parent / 'android/res/drawable/icon.png', optimize=True)
print('Mikajy logo written')
