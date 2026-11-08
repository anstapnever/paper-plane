// The v2.1 mascot's solid shape for plans: sample points of the body, arms and legs in model space (the rig: arms turn z then y on a pivot,
// legs turn on x), and a resolver that pushes the whole mascot out of anything it went into.
// Model: body 1.4 x 1.0 x 1.0 from y 0.28 to 1.28, arms 0.38 long at x +-0.66, y 0.86; legs 0.23 x 0.38 at x +-0.5, +-0.2 (pivot y 0.35).
const lerp = (a, b, p) => a + (b - a) * p;
export const BODY = { x: 0.7, y0: 0.28, y1: 1.28, z: 0.5 };
export const ARM = { px: 0.66, py: 0.86 };
export const LEGX = [-0.5, -0.2, 0.2, 0.5];
export function armLocal(p, side, a, s) {
  let [x, y, z] = [p[0] * side, p[1], p[2]]; const az = side * a; let c = Math.cos(az), sn = Math.sin(az); [x, y] = [x * c - y * sn, x * sn + y * c];
  const ay = side > 0 ? -s : s; c = Math.cos(ay); sn = Math.sin(ay); [x, z] = [x * c + z * sn, -x * sn + z * c]; return [side * ARM.px + x, ARM.py + y, z];
}
export function bodyPoints(pose, dense = false) {
  const pts = []; const n = dense ? 6 : 3; const k = 0.82;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { const u = -1 + 2 * i / n, v = -1 + 2 * j / n;
    pts.push([u * BODY.x * k, BODY.y0 + 0.02, v * BODY.z * k], [u * BODY.x * k, BODY.y1 - 0.02, v * BODY.z * k], [u * BODY.x * k, lerp(BODY.y0, BODY.y1, (v + 1) / 2), BODY.z - 0.02], [u * BODY.x * k, lerp(BODY.y0, BODY.y1, (v + 1) / 2), -BODY.z + 0.02],
      [BODY.x - 0.02, lerp(BODY.y0, BODY.y1, (u + 1) / 2), v * BODY.z * k], [-BODY.x + 0.02, lerp(BODY.y0, BODY.y1, (u + 1) / 2), v * BODY.z * k]); }
  pose.arms.forEach(([a, s], i) => { const side = i === 0 ? -1 : 1; for (const x of [0.05, 0.2, 0.36]) for (const y of [-0.13, 0.13]) for (const z of [-0.14, 0.14]) pts.push(armLocal([x, y, z], side, a, s)); });
  LEGX.forEach((lx, i) => { const r = pose.legs[i]; for (const x of [-0.1, 0.1]) for (const z of [-0.12, 0.12]) { const y = 0.02 - 0.35; const c = Math.cos(r), s = Math.sin(r); pts.push([lx + x, 0.35 + y * c - (z - 0.02) * s, 0.02 + y * s + (z - 0.02) * c]); } });
  return pts;
}
// push the mascot out: solids are functions (q) -> [depth, normal] (depth > 0 inside); moves pose.pos along the deepest point's normal
export function resolve(pose, toWorld, solids, iters = 40) {
  const pts = bodyPoints(pose, true);
  for (let it = 0; it < iters; it++) {
    let best = 0.02, bn = null; const cen = toWorld([0, 0.78, 0], pose);
    for (const p of pts) { const q = toWorld(p, pose); for (const s of solids) { const r = s(q, cen); if (r && r[0] > best) { best = r[0]; bn = r[1]; } } }
    if (!bn) break; pose.pos = [pose.pos[0] + bn[0] * best * 1.05, pose.pos[1] + bn[1] * best * 1.05, pose.pos[2] + bn[2] * best * 1.05];
  }
  return pose;
}
export const solid = {
  floor: (y0 = 0) => (q) => (q[1] < y0 ? [y0 - q[1], [0, 1, 0]] : null),
  box: (c, half, yaw = 0) => (q) => { const cs = Math.cos(-yaw), sn = Math.sin(-yaw); const x = (q[0] - c[0]) * cs + (q[2] - c[2]) * sn, z = -(q[0] - c[0]) * sn + (q[2] - c[2]) * cs, y = q[1] - c[1];
    const dx = half[0] - Math.abs(x), dy = half[1] - Math.abs(y), dz = half[2] - Math.abs(z); if (dx <= 0 || dy <= 0 || dz <= 0) return null;
    let n; if (dy <= dx && dy <= dz) n = [0, Math.sign(y) || 1, 0]; else if (dx <= dz) { const sx = Math.sign(x) || 1; n = [sx * Math.cos(yaw), 0, -sx * Math.sin(yaw)]; } else { const sz = Math.sign(z) || 1; n = [sz * Math.sin(yaw), 0, sz * Math.cos(yaw)]; }
    return [Math.min(dx, dy, dz), n]; },
  cylinder: (c, r, h) => (q) => { const dx = q[0] - c[0], dz = q[2] - c[1]; const d = Math.hypot(dx, dz); if (d >= r || q[1] >= h || q[1] < 0) return null;
    const side = r - d, top = h - q[1]; return side < top ? [side, [dx / (d || 1), 0, dz / (d || 1)]] : [top, [0, 1, 0]]; },
  cup: (c, ro, ri, h, bottom) => (q, cen) => { const dx = q[0] - c[0], dz = q[2] - c[1]; const d = Math.hypot(dx, dz) || 1e-6; if (d >= ro || q[1] >= h || q[1] < 0) return null; if (d < ri && q[1] > bottom) return null;
    const inside = cen && Math.hypot(cen[0] - c[0], cen[2] - c[1]) < ri && cen[1] < h; // the body is in the cup: push inwards, else outwards or up
    const opts = [[h - q[1], [0, 1, 0]]]; if (!inside) opts.push([ro - d, [dx / d, 0, dz / d]]); if (q[1] > bottom && (inside || !cen)) opts.push([d - ri, [-dx / d, 0, -dz / d]]); else if (d < ri) opts.push([bottom - q[1], [0, 1, 0]]);
    if (inside) return [d - ri, [-dx / d, 0, -dz / d]];
    return opts.reduce((a, b) => (b[0] < a[0] ? b : a)); },
  capsule: (a, b, r) => (q, cen) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const L2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2; let u = ((q[0] - a[0]) * d[0] + (q[1] - a[1]) * d[1] + (q[2] - a[2]) * d[2]) / L2; u = Math.max(0, Math.min(1, u));
    const ax = [a[0] + u * d[0], a[1] + u * d[1], a[2] + u * d[2]]; const v = [q[0] - ax[0], q[1] - ax[1], q[2] - ax[2]]; const l = Math.hypot(...v); if (l >= r) return null;
    if (cen && cen[1] > ax[1]) return [r + ax[1] - q[1], [0, 1, 0]]; // standing on it: step up onto it, never down into the floor
    return [r - l, l > 1e-6 ? v.map((x) => x / l) : [0, 1, 0]]; },
};
