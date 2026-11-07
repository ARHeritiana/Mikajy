"""Score a packed float32 model (training/model4.json) on the held-out sets written by train4.py.
   usage: python3 eval_model.py model4.json cache/heldout.npz      (numpy only; mirrors web/core_cnn.js)"""
import base64, json, sys
import numpy as np

def load(path):
    m = json.load(open(path))
    get = lambda k, shape: np.frombuffer(base64.b64decode(m[k]), dtype='<f4').reshape(shape)
    c1 = get('b1', (-1,)).size; c2 = get('b2', (-1,)).size; fc = get('b3', (-1,)).size; nc = get('b4', (-1,)).size
    return dict(w1=get('w1', (3, 3, 1, c1)), b1=get('b1', (c1,)), w2=get('w2', (3, 3, c1, c2)), b2=get('b2', (c2,)),
                w3=get('w3', (49 * c2, fc)), b3=get('b3', (fc,)), w4=get('w4', (fc, nc)), b4=get('b4', (nc,))), m['cls']

def conv(x, w, b):
    n, h, wd, _ = x.shape; xp = np.pad(x, ((0, 0), (1, 1), (1, 1), (0, 0))); out = np.zeros((n, h, wd, w.shape[3]), np.float32)
    for i in range(3):
        for j in range(3): out += xp[:, i:i + h, j:j + wd, :] @ w[i, j]
    return np.maximum(out + b, 0)

def pool(x):
    n, h, w, c = x.shape; return x.reshape(n, h // 2, 2, w // 2, 2, c).max(axis=(2, 4))

def predict(P, X):
    out = []
    for i in range(0, len(X), 500):
        h = pool(conv(X[i:i + 500].reshape(-1, 28, 28, 1), P['w1'], P['b1'])); h = pool(conv(h, P['w2'], P['b2']))
        h = np.maximum(h.reshape(len(h), -1) @ P['w3'] + P['b3'], 0); out.append((h @ P['w4'] + P['b4']).argmax(1))
    return np.concatenate(out)

if __name__ == '__main__':
    P, cls = load(sys.argv[1]); d = np.load(sys.argv[2])
    for name, x, y in (('MNIST test digits', 'Xt', 'Yt'), ('held-out fonts', 'Xh', 'Yh'), ('held-out fonts + ligature strokes', 'Xc', 'Yc')):
        if len(d[x]): print('%-36s %.1f %%  (n=%d)' % (name, 100 * np.mean(predict(P, d[x]) == d[y]), len(d[x])))
