"""Draw a generated sample to PNG (pen-up gaps shown as light dashes) for eyeballing."""
import numpy as np
from PIL import Image, ImageDraw


def to_png(sample, path, scale=1.0, boxes=False):
    pts = [np.array(s['pts']) for s in sample['strokes']]
    allp = np.vstack(pts)
    x0, y0 = allp[:, 0].min() - 20, allp[:, 1].min() - 30
    W, H = int((allp[:, 0].max() - x0 + 20) * scale), int((allp[:, 1].max() - y0 + 20) * scale)
    im = Image.new('RGB', (max(W, 60), max(H, 60)), 'white'); d = ImageDraw.Draw(im)
    n = len(pts)
    for i, p in enumerate(pts):
        c = (int(255 * i / max(n - 1, 1)), 0, int(255 * (1 - i / max(n - 1, 1))))      # blue = written first, red = last
        xy = [((x - x0) * scale, (y - y0) * scale) for x, y, _ in p]
        d.line(xy, fill=c, width=2)
    if boxes:
        for sy in sample['symbols']:
            b = sy['bbox']; d.rectangle([(b[0] - x0) * scale, (b[1] - y0) * scale, (b[2] - x0) * scale, (b[3] - y0) * scale], outline=(0, 160, 0))
    im.save(path)
