"""Glyph bank: pen strokes for characters and words from open-licence handwriting fonts (SIL OFL), in x-height units."""
import glob
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from .trace import trace

SIZE = 140
PAD = 60


class Glyph:
    def __init__(self, strokes, adv):
        self.strokes, self.adv = strokes, adv            # strokes: list of (N,2) arrays, x right, y DOWN, baseline y=0, x-height=1
        pts = np.vstack(strokes)
        self.x0, self.y0 = pts.min(axis=0)
        self.x1, self.y1 = pts.max(axis=0)

    @property
    def w(self):
        return self.x1 - self.x0


class GlyphBank:
    def __init__(self, font_dir, fonts=None):
        paths = sorted(glob.glob(os.path.join(font_dir, '*.ttf')))
        self.fonts = [p for p in paths if (fonts is None or os.path.basename(p)[:-4] in fonts)]
        if not self.fonts:
            raise FileNotFoundError('no .ttf fonts in ' + font_dir)
        self._cmap, self._cache, self._xh = {}, {}, {}

    def names(self):
        return [os.path.basename(p)[:-4] for p in self.fonts]

    def has(self, font, ch):
        if font not in self._cmap:
            with TTFont(font, lazy=True) as t:
                self._cmap[font] = set(t.getBestCmap())
        return all(ord(c) in self._cmap[font] for c in ch)

    def candidates(self, text):
        return [f for f in self.fonts if self.has(f, text)]

    def _xheight(self, font, f):
        if font not in self._xh:
            t = f.getbbox('x', anchor='ls')
            self._xh[font] = max(8.0, -t[1])
        return self._xh[font]

    def render(self, font, text):
        """Strokes of `text` written in `font` as one piece (natural ligatures kept), or None."""
        key = (font, text)
        if key not in self._cache:
            self._cache[key] = self._build(font, text)
        return self._cache[key]

    def _build(self, font, text):
        try:
            f = ImageFont.truetype(font, SIZE)
            w = int(f.getlength(text)) + 2 * PAD
            im = Image.new('L', (w, SIZE * 2 + 2 * PAD), 0)
            ImageDraw.Draw(im).text((PAD, SIZE + PAD), text, font=f, fill=255, anchor='ls')
            mask = np.asarray(im) > 127
            if mask.sum() < 20:
                return None
            strokes = [s - np.array([PAD, SIZE + PAD]) for s in trace(mask)]
            if not strokes:
                return None
            xh = self._xheight(font, f)
            return Glyph([s / xh for s in strokes], f.getlength(text) / xh)
        except OSError:
            return None
