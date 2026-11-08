# Paper Plane: the paper of the plane (a corner of a squared school notebook): off-white with fibres, a pale blue 5 mm grid, a red margin
# on the left wing, and a child's wax-crayon drawing on the right wing (a sun over a hill). Maps the plane's local x [-2, 2], z [-2.6, 2.6].
#   python paper.py -> tex/paper.png
import numpy as np, cv2, os
HERE = os.path.dirname(os.path.abspath(__file__)); W, H = 2048, 2662
X0, X1, Z0, Z1 = -2.0, 2.0, -2.6, 2.6
px = lambda x: (x - X0) / (X1 - X0) * W; pz = lambda z: (Z1 - z) / (Z1 - Z0) * H     # image row 0 = nose (+z)
r = np.random.default_rng(3)
def hexc(h): h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255 for i in (4, 2, 0)], np.float32)   # BGR
img = np.ones((H, W, 3), np.float32) * hexc('#f8f4ea')
fib = cv2.GaussianBlur(r.random((H, W)).astype(np.float32), (0, 0), 1.2); fib = cv2.filter2D(fib, -1, np.ones((1, 15), np.float32) / 15)
img *= (1 + (fib - fib.mean())[..., None] * 0.25)
mott = cv2.resize(cv2.GaussianBlur(r.random((H // 16, W // 16)).astype(np.float32), (0, 0), 2), (W, H)); img *= (1 + (mott - mott.mean())[..., None] * 0.12)
# the grid (0.5 cm) and the margin
g = np.zeros((H, W), np.float32)
for k in np.arange(-4, 5): x = px(k * 0.5); cv2.line(g, (int(x), 0), (int(x), H), 1.0, 3, cv2.LINE_AA)
for k in np.arange(-6, 7): y = pz(k * 0.5); cv2.line(g, (0, int(y)), (W, int(y)), 1.0, 3, cv2.LINE_AA)
g = cv2.GaussianBlur(g, (0, 0), 0.8) * (0.75 + 0.25 * fib / fib.max())
img = img * (1 - g[..., None] * 0.5) + hexc('#8fb4e6') * (g[..., None] * 0.5)
m = np.zeros((H, W), np.float32); cv2.line(m, (int(px(1.25)), 0), (int(px(1.25)), H), 1.0, 5, cv2.LINE_AA); m = cv2.GaussianBlur(m, (0, 0), 1.0)
img = img * (1 - m[..., None] * 0.6) + hexc('#e8737a') * (m[..., None] * 0.6)
# the crayon drawing on the right wing (local x < 0): waxy strokes with paper tooth showing through
tooth = (cv2.GaussianBlur(r.random((H, W)).astype(np.float32), (0, 0), 1.4) > 0.47).astype(np.float32)
def crayon(mask, col, a=0.9):
    global img
    k = cv2.GaussianBlur(mask, (0, 0), 1.2) * (0.55 + 0.45 * tooth) * a; img[:] = img * (1 - k[..., None]) + hexc(col) * k[..., None]
cx, cy, R = px(-0.95), pz(-1.15), 0.34 / (X1 - X0) * W
s = np.zeros((H, W), np.float32)
for k in range(9): cv2.ellipse(s, (int(cx + r.normal(0, 4)), int(cy + r.normal(0, 4))), (int(R * (0.95 - k * 0.1)), int(R * (0.92 - k * 0.1))), r.uniform(0, 30), 0, 360, 1.0, 16, cv2.LINE_AA)
crayon(s, '#f39a2c')
s = np.zeros((H, W), np.float32)
for k in range(11):
    a = k / 11 * 2 * np.pi + 0.2; p0 = (int(cx + np.cos(a) * R * 1.25), int(cy + np.sin(a) * R * 1.25)); p1 = (int(cx + np.cos(a) * R * 1.75), int(cy + np.sin(a) * R * 1.75)); cv2.line(s, p0, p1, 1.0, 14, cv2.LINE_AA)
crayon(s, '#f5b532')
s = np.zeros((H, W), np.float32)
hx0, hx1, hy = px(-1.85), px(-0.15), pz(-1.95)
pts = np.array([[hx0 + (hx1 - hx0) * u, hy - np.sin(u * np.pi) * 0.42 / (Z1 - Z0) * H] for u in np.linspace(0, 1, 40)], np.int32)
for k in range(5): cv2.polylines(s, [pts + np.array([0, k * 16])], False, 1.0, 18, cv2.LINE_AA)
crayon(s, '#5fb04a', 0.85)
os.makedirs(os.path.join(HERE, 'tex'), exist_ok=True); cv2.imwrite(os.path.join(HERE, 'tex', 'paper.png'), (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8))
cv2.imwrite(os.path.join(HERE, 'out', 'paper_prev.jpg'), cv2.resize((np.clip(img, 0, 1) * 255).astype(np.uint8), (512, 666)))
print('paper')
