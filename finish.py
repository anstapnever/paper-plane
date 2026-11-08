# Paper Plane: the light show and the film finish per frame (numpy + OpenCV), the approved look-dev v3 post (shared with Last Ray):
#  the sun's screen spot comes from the baked camera and sun; aerial haze, light wrap, a hard cel rim on the characters on the side facing the sun,
#  the sun (its disc grows with a long lens), crepuscular rays, bloom, lens flare, bokeh, steam off the drying wing, chromatic fringe, the grade,
#  paper and grain. Random things (bokeh, grain, steam) change on threes.
#   python finish.py <frames dir> <out dir> [first last] [workers]
import sys, os, json, numpy as np, cv2
from multiprocessing import Pool
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out')
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(OUT, 'frames'); DST = sys.argv[2] if len(sys.argv) > 2 else os.path.join(OUT, 'final')
def hexc(h): h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)
def ss(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def screen(a, b): return 1 - (1 - a) * (1 - np.clip(b, 0, 1))
def blur(x, s): return cv2.GaussianBlur(x, (0, 0), s)
META = None
def meta():
    global META
    if META is None:
        B = json.load(open(os.path.join(OUT, 'bake.json'))); V = B['vals']
        cams = np.array(B['cam'], np.float64); M = {'cam': cams, 'sunD': np.array(V['sunD']), 'sunE': np.array(V['sunE']), 'night': np.array(V['night']), 'steam': np.array(V['steam']), 'wingL': np.array(V['wingL']), 'hero': np.array([m[:3] for m in B['mascots']['M']])}
        META = M
    return META
def project(cam, p, W, H):
    pos, tgt, fov = cam[0:3], cam[3:6], cam[6]; f = tgt - pos; f /= np.linalg.norm(f); r = np.cross(f, [0, 1, 0]); r /= np.linalg.norm(r); u = np.cross(r, f)
    d = p - pos; z = d @ f; tv = np.tan(np.radians(fov) / 2)
    if z <= 1e-6: return None, z
    return (W * (0.5 + (d @ r) / z / (2 * tv * W / H)), H * (0.5 - (d @ u) / z / (2 * tv))), z
def load_pass(path, shape):
    if not os.path.exists(path):   # stills name their passes p0030_hero.png
        d, f = os.path.split(path); import re; m_ = re.match(r'p_(\w+?)(\d{4})\.png', f)
        if m_: path = os.path.join(d, 'p%s_%s.png' % (m_.group(2), m_.group(1)))
    if not os.path.exists(path): return np.zeros(shape, np.float32)
    r = cv2.imread(path, cv2.IMREAD_UNCHANGED); den = 65535.0 if r.dtype == np.uint16 else 255.0; a = r.astype(np.float32); a = a[..., 0] if a.ndim == 3 else a; return a / den
PAPER = {}
def paper(H, W):
    if (H, W) not in PAPER:
        r = np.random.default_rng(9); fib = blur(r.random((H, W)).astype(np.float32), 0.6)
        fib = cv2.filter2D(fib, -1, np.ones((1, 9), np.float32) / 9) * 0.5 + cv2.filter2D(fib, -1, np.ones((9, 1), np.float32) / 9) * 0.5
        mott = cv2.resize(blur(r.random((H // 8, W // 8)).astype(np.float32), 2), (W, H), interpolation=cv2.INTER_CUBIC)
        PAPER[(H, W)] = (fib - fib.mean()) * 0.12 + (mott - mott.mean()) * 0.10
    return PAPER[(H, W)]
def disc(xx, yy, x, y, r, col, a_, hexa=True, ring=0.0):
    x0, x1 = int(max(0, x - r * 1.1)), int(min(xx.shape[1], x + r * 1.1 + 1)); y0, y1 = int(max(0, y - r * 1.1)), int(min(xx.shape[0], y + r * 1.1 + 1))
    out = np.zeros(xx.shape + (3,), np.float32)
    if x0 >= x1 or y0 >= y1: return out
    X, Y = xx[y0:y1, x0:x1], yy[y0:y1, x0:x1]
    if hexa: ang = np.arctan2(Y - y, X - x); rr = np.hypot(X - x, Y - y) * np.cos(((ang + np.pi / 6) % (np.pi / 3)) - np.pi / 6)
    else: rr = np.hypot(X - x, Y - y)
    body = ss(r, r * 0.9, rr) * a_; edge = (ss(r * 0.86, r * 0.97, rr) * ss(r * 1.02, r * 0.97, rr)) * ring
    out[y0:y1, x0:x1] = (body + edge)[..., None] * hexc(col); return out
def process(fr):
    M = meta(); i = fr - 1
    bp = os.path.join(SRC, 'f%04d.png' % fr); op = os.path.join(DST, 'f%04d.png' % fr)
    if not os.path.exists(bp) or os.path.exists(op): return
    img = cv2.imread(bp, cv2.IMREAD_UNCHANGED)[..., :3][..., ::-1].astype(np.float32) / 255; H, W = img.shape[:2]; k = W / 1920
    hero = load_pass(os.path.join(SRC, 'p_hero%04d.png' % fr), (H, W)); glow = load_pass(os.path.join(SRC, 'p_glow%04d.png' % fr), (H, W))
    dep = load_pass(os.path.join(SRC, 'p_depth%04d.png' % fr), (H, W)) * 40.0
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cam = M['cam'][i]; e = M['sunE'][i]; night = M['night'][i]; sunvis = float(np.clip((e + 0.5) / 1.3, 0, 1))
    sp, sz = project(cam, cam[0:3] + M['sunD'][i] * 1e5, W, H)
    sky = ss(26.0, 27.5, dep) * (1 - hero); lin = img.copy()
    hb = (hero > 0.5).astype(np.float32); hasH = hb.sum() > 50
    if hasH: hy, hx = np.argwhere(hb > 0).mean(0)
    # sun geometry on screen (it may be off screen, or behind the camera)
    if sp is not None: SX, SY = sp
    else: SX, SY = W / 2, -H * 4
    rs = np.hypot(xx - SX, yy - SY); front = sp is not None and sz > 0
    prox = np.exp(-rs / (0.35 * W)) if front else np.zeros_like(xx) + 0.15
    # 1) aerial haze: warm toward the sun by day, lavender away from it, deep blue at night
    far = (ss(0.12, 1.2, dep) * 0.22 + ss(1.2, 18.0, dep) * 0.2) * (1 - sky) * (1 - hero)
    hz_day = hexc('#ffe1b0')[None, None] * prox[..., None] * sunvis + hexc('#c9c6ee')[None, None] * (1 - prox[..., None] * sunvis)
    hz = hz_day * (1 - night) + hexc('#1e2a5a') * night
    lin = lin * (1 - far[..., None] * (1 - 0.4 * night)) + hz * (far * (1 - 0.4 * night))[..., None]
    # 2) light wrap round silhouettes against the bright sky
    if sunvis > 0.01:
        bgc = blur(lin * sky[..., None], 22 * k) / (blur(sky, 22 * k)[..., None] + 1e-4)
        near_sky = blur(sky, 9 * k) * (1 - sky)
        lin = screen(lin, bgc * (near_sky * (0.3 + 1.1 * prox) * sunvis)[..., None] * 0.85)
    # 3) the hero's rim: a hard cel band on the edges that face the light (the sun if it is in front, else the companion firefly at night)
    if hasH:
        def rim_toward(tx, ty, width, col_rim, col_hot, amount):
            dx, dy = tx - hx, ty - hy; dl = np.hypot(dx, dy) + 1e-6; dx /= dl; dy /= dl
            sh = lambda d: cv2.remap(hero, (xx + dx * d).astype(np.float32), (yy + dy * d).astype(np.float32), cv2.INTER_LINEAR, borderValue=0)
            rim = blur(hb * (1 - (sh(width * k) > 0.5)), 0.7 * k) * amount; hot = blur(hb * (1 - (sh(width * 0.35 * k) > 0.5)), 0.6 * k) * amount
            out = lin * (1 - rim[..., None]) + hexc(col_rim) * rim[..., None]; out = out * (1 - hot[..., None]) + hexc(col_hot) * hot[..., None]
            return screen(out, hexc(col_rim) * (blur(rim, 8 * k) * (1 - hb) * 1.4)[..., None])
        if front and sunvis > 0.01: lin = rim_toward(SX, SY, 13, '#ffc98a', '#fff8e6', sunvis)
        bounce = hb * ss(hy - 40 * k, hy + 260 * k, yy) * 0.07 * (1 - night)
        lin = screen(lin, hexc('#ffcf7a') * bounce[..., None])
    # 4) the sun: a white core, a hot glow, a wide warm bloom; things in front of it cut it
    occ = blur(sky, 1.5 * k)
    if front and sunvis > 0.01:
        rd = max(22 * k, H / 2 * np.tan(np.radians(1.2)) / np.tan(np.radians(cam[6]) / 2) * (1.0 if cam[6] < 20 else 0.5))   # the disc: 2.4 deg wide on a long lens, so it is huge
        disc_ = ss(rd * 1.02, rd * 0.9, rs) * (1.0 if rd > 30 * k else 0.0)
        core = (np.exp(-(rs / rd) ** 2) * 1.6 + np.exp(-(rs / (rd * 3.4)) ** 2) * 0.7 + disc_ * 1.2) * occ * sunvis
        wide = 1 / (1 + (rs / (max(200 * k, rd * 6))) ** 2) * 0.38 * sunvis
        lin = screen(lin, hexc('#fffaf0') * core[..., None] + hexc('#ffd28a') * wide[..., None] * (0.35 + 0.65 * occ[..., None]))
        # 5) crepuscular rays
        src = (np.clip((lin.mean(-1) - 0.72) / 0.28, 0, 1) * sky + core * 0.6) * (0.3 + 0.7 * prox)
        acc = np.zeros_like(src); wsum = 0
        for kk in range(48):
            s_ = 1 - kk * 0.014; Mx = np.float32([[s_, 0, SX * (1 - s_)], [0, s_, SY * (1 - s_)]]); wgt = 0.965 ** kk
            acc += cv2.warpAffine(src, Mx, (W, H), flags=cv2.INTER_LINEAR) * wgt; wsum += wgt
        rays = acc / wsum * (0.6 + 0.4 * np.clip(np.cos(np.arctan2(yy - SY, xx - SX) * 9) * 0.5 + 0.5, 0, 1))
        lin = screen(lin, hexc('#ffd690') * (rays * 1.5 * sunvis)[..., None])
    # 6) fireflies: a warm bloom at night from the glow pass
    if glow.max() > 0.01:
        gsrc = np.clip(img.mean(-1) - 0.3, 0, None) * glow + glow * 0.4
        fb = blur(gsrc, 3 * k) * 0.9 + blur(gsrc, 10 * k) * 0.9 + blur(gsrc, 30 * k) * 0.7 + blur(gsrc, 80 * k) * 0.35
        lin = screen(lin, hexc('#ffd56a') * fb[..., None] * (0.4 + 0.6 * night))
    # 6b) steam off the drying wing: soft wisps rising and curling, back-lit warm
    st = float(M['steam'][i])
    if st > 0.01:
        wp, wz = project(cam, M['wingL'][i], W, H)
        if wp is not None:
            q = fr // 3; rr_ = np.random.default_rng(77); acc_ = np.zeros((H, W), np.float32); sc_ = 260 * k * 8.0 / max(wz * 100, 3.0)
            for j in range(14):
                ph = rr_.random() * 6.28; x0 = wp[0] + rr_.normal(0, 0.35) * sc_; age = ((q * 0.125 + rr_.random() * 2.0) % 2.0) / 2.0
                ys = np.linspace(0, 1, 24); px_ = x0 + np.sin(ys * 5 + ph + q * 0.4) * sc_ * 0.18 * ys; py_ = wp[1] - (ys * 1.4 + age * 0.6) * sc_
                pts = np.stack([px_, py_], -1).astype(np.int32); cv2.polylines(acc_, [pts], False, float(0.5 * (1 - age)), max(1, int(sc_ * 0.12)), cv2.LINE_AA)
            acc_ = blur(acc_, max(1.0, sc_ * 0.08)) * st
            lin = screen(lin, hexc('#fff0dc') * acc_[..., None] * (0.6 + 0.6 * prox[..., None] * sunvis))
    # 7) bloom
    br = np.clip(lin - 0.8, 0, None); lin = screen(lin, (blur(br, 6 * k) * 0.35 + blur(br, 22 * k) * 0.35 + blur(br, 70 * k) * 0.45) * hexc('#fff0d8'))
    # 8) lens flare (only with the sun in front)
    if front and sunvis > 0.05 and -0.3 * W < SX < 1.3 * W and -0.3 * H < SY < 1.3 * H:
        ax, ay = W / 2 - SX, H / 2 - SY; fl = np.zeros_like(lin)
        for (t, r, col, a_) in [(0.55, 34, '#9fe0ff', 0.10), (0.85, 70, '#ffb8e0', 0.07), (1.25, 22, '#b8ffb0', 0.12), (1.55, 120, '#a8c8ff', 0.05), (1.95, 46, '#ffd0a0', 0.08), (-0.35, 26, '#ffe2a8', 0.10)]:
            fl += disc(xx, yy, SX + ax * t * 2, SY + ay * t * 2, r * k, col, a_ * 0.6, True, a_)
        fl *= (1 - 0.85 * blur(hero, 4 * k))[..., None]
        halo = np.exp(-((rs - 380 * k) / (10 * k)) ** 2) * 0.08; fl += halo[..., None] * hexc('#ffc0d0')
        streak = np.exp(-((yy - SY) / (2.2 * k)) ** 2) * np.exp(-np.abs(xx - SX) / (520 * k)) * 0.9 + np.exp(-((yy - SY) / (9 * k)) ** 2) * np.exp(-np.abs(xx - SX) / (260 * k)) * 0.25
        ang = np.arctan2(yy - SY, xx - SX); spikes = (np.abs(np.cos(ang * 4 + 0.3)) ** 220 + 0.6 * np.abs(np.cos(ang * 7 + 1.1)) ** 300) * np.exp(-rs / (230 * k)) * 0.8
        fl += streak[..., None] * hexc('#ffe6c0') + spikes[..., None] * hexc('#fff4dc')
        vis = float(occ[int(np.clip(SY, 0, H - 1)), int(np.clip(SX, 0, W - 1))]) if (0 <= SX < W and 0 <= SY < H) else 0.5
        lin = screen(lin, fl * (0.45 + 0.55 * vis) * sunvis)
    # 9) bokeh drifting near the lens: round the sun by day, firefly-coloured at night (positions move on threes)
    q = fr // 3; rng = np.random.default_rng(4); bk = np.zeros_like(lin)
    for j in range(22):
        bx0, by0 = rng.random() * W, rng.random() * H * 0.9; vx, vy = rng.normal(0, 0.6), rng.normal(-0.3, 0.3); r = rng.uniform(14, 60) * k; col = rng.choice(['#ffe0a0', '#fff2cc', '#ffd0b0', '#e0f0ff'])
        x = (bx0 + vx * q * 3 * k) % W; y = (by0 + vy * q * 3 * k) % H
        if front and sunvis > 0.05: a_ = rng.uniform(0.05, 0.14) * (0.4 + np.exp(-np.hypot(x - SX, y - SY) / (600 * k))) * sunvis
        else: a_ = rng.uniform(0.04, 0.12) * night; col = '#ffd56a'
        if hasH and np.hypot(x - hx, y - hy) < 330 * k: continue
        if a_ > 0.005: bk += disc(xx, yy, x, y, r, col, a_, rng.random() < 0.5, a_ * 1.4)
    lin = screen(lin, blur(bk, 1.2 * k))
    # 10) chromatic fringe, the grade, vignette
    def zoom(ch, s_):
        Mx = np.float32([[s_, 0, W / 2 * (1 - s_)], [0, s_, H / 2 * (1 - s_)]]); return cv2.warpAffine(ch, Mx, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    lin = np.stack([zoom(lin[..., 0], 1.0016), lin[..., 1], zoom(lin[..., 2], 0.9984)], -1)
    lum = lin.mean(-1, keepdims=True)
    lin = lin + hexc('#6f5fb0') * 0.09 * (1 - lum) ** 2 - 0.02
    lin = lin + (hexc('#ffb860') - 0.5) * 0.06 * ss(0.5, 1.0, lum)
    g_ = lin.mean(-1, keepdims=True); lin = g_ + (lin - g_) * 1.14; lin = 0.5 + (lin - 0.5) * 1.12 - 0.015
    rv = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2)); lin = lin * (1 - 0.22 * ss(0.6, 1.5, rv))[..., None] + hexc('#3a1f3a') * (0.05 * ss(0.7, 1.5, rv))[..., None]
    # 11) paper and grain (grain on twos)
    lin = lin * (1 + paper(H, W)[..., None])
    lin = lin + np.random.default_rng(1000 + fr // 2).normal(0, 0.016, (H, W, 1)).astype(np.float32)
    cv2.imwrite(op, (np.clip(lin, 0, 1)[..., ::-1] * 255 + 0.5).astype(np.uint8))
if __name__ == '__main__':
    os.makedirs(DST, exist_ok=True)
    a = int(sys.argv[3]) if len(sys.argv) > 3 else 1; b = int(sys.argv[4]) if len(sys.argv) > 4 else 1716; nw = int(sys.argv[5]) if len(sys.argv) > 5 else 3
    frames = list(range(a, b + 1))
    if nw <= 1:
        for f in frames: process(f)
    else:
        with Pool(nw) as p: p.map(process, frames, chunksize=4)
    print('finished', len(frames))
