// v3 kit (01.11.2026): shared plan helpers for the "one familiar action changes the room" films. Units cm, y up, camera side +z, desk y = 0.
// Each film's js/plan.mjs builds on these: keyed fields for the mascot, hops, the camera spline, the keyboard layout, events.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const lerp = (a, b, p) => a + (b - a) * p;
export const PI = Math.PI;
export const EASE = { lin: (u) => u, smooth: (u) => u * u * (3 - 2 * u), in: (u) => u * u * u, out: (u) => 1 - Math.pow(1 - u, 3), snap: (u) => 1 - Math.pow(1 - u, 5), back: (u) => { const c = 1.7; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); } };
export const hash = (n) => { const s = Math.sin(n * 91.7 + 17.3) * 43758.5453; return s - Math.floor(s); };

// ---- keyed fields: [{t, field: value, e: ease}] -> f(t) -> {field: value} ------------------------------------------------------------------------------
export function keyed(keys, fields) {
  const tr = {}; for (const f of fields) tr[f] = []; const last = {};
  [...keys].sort((a, b) => a.t - b.t).forEach((k) => { for (const f of fields) { if (k[f] !== undefined) last[f] = k[f]; if (last[f] !== undefined) tr[f].push([k.t, last[f], k.e || 'smooth']); } });
  const val = (list, t) => { if (!list.length) return 0; if (t <= list[0][0]) return list[0][1]; for (let i = 1; i < list.length; i++) if (t < list[i][0]) { const [a, va] = list[i - 1]; const [b, vb, e] = list[i]; return va + (vb - va) * EASE[e]((t - a) / (b - a)); } return list[list.length - 1][1]; };
  return (t) => { const o = {}; for (const f of fields) o[f] = val(tr[f], t); return o; };
}
// a step function: [[t, value], ...] -> the last value at or before t
export const stepAt = (list, t) => { let v = list[0][1]; for (const [a, x] of list) if (t >= a) v = x; return v; };
// how long since the last time in a list (Infinity before the first)
export const since = (times, t) => { let d = Infinity; for (const a of times) if (t >= a) d = Math.min(d, t - a); return d; };

// ---- the mascot in the world ---------------------------------------------------------------------------------------------------------------------------
export function makeToWorld(S) {
  return (p, pose) => {
    let [x, y, z] = [p[0] * pose.sx * S, p[1] * pose.sy * S, p[2] * (pose.sz ?? pose.sx) * S];
    let c = Math.cos(pose.pitch), s = Math.sin(pose.pitch); [y, z] = [y * c - z * s, y * s + z * c]; c = Math.cos(pose.tilt); s = Math.sin(pose.tilt); [x, y] = [x * c - y * s, x * s + y * c]; c = Math.cos(pose.yaw); s = Math.sin(pose.yaw); [x, z] = [x * c + z * s, -x * s + z * c];
    return [pose.pos[0] + x, pose.pos[1] + y, pose.pos[2] + z];
  };
}
// a hop from p to q (x, y, z) between t0 and t1, arc height h; going up it rises first, going down it clears the edge first
export function hopAt(t, t0, t1, p, q, h = 1.2) {
  const u = clamp((t - t0) / (t1 - t0)); const up = q[1] > p[1] + 0.05, down = q[1] < p[1] - 0.05;
  const ux = up ? u * u : down ? 1 - (1 - u) * (1 - u) : u; const uy = up ? 1 - (1 - u) * (1 - u) : down ? u * u : u;
  return [lerp(p[0], q[0], ux), lerp(p[1], q[1], uy) + 4 * h * u * (1 - u), lerp(p[2], q[2], ux)];
}
// a pose from keyed fields; walk phase from distance, a little bob, arms swing when running
export function basePose(k, pos, walking, dist = 0) {
  const w = walking ? 1 : 0; const ph = dist * 4.2; const sw = w * 0.6 * Math.sin(ph); const bob = w * 0.06 * Math.abs(Math.sin(ph));
  return { pos: [pos[0], pos[1] + bob, pos[2]], yaw: k.yaw, pitch: k.pitch ?? 0, tilt: (k.tilt ?? 0) + w * 0.05 * Math.sin(ph), sx: 1 - 0.5 * (k.sq ?? 0), sy: 1 + (k.sq ?? 0),
    arms: [[k.aL ?? 0.1, k.sL ?? 0], [k.aR ?? 0.1, k.sR ?? 0]], legs: [sw, -sw, sw, -sw] };
}
// distance walked so far (for the step phase): integrate a position function where walking(t) is true
export function walkTable(dur, posAt, walking) {
  const n = Math.ceil(dur * 240); const out = new Float64Array(n + 1); let d = 0; let prev = posAt(0);
  for (let i = 1; i <= n; i++) { const t = i / 240; const p = posAt(t); if (walking(t)) d += Math.hypot(p[0] - prev[0], p[2] - prev[2]); out[i] = d; prev = p; }
  return (t) => out[Math.min(n, Math.max(0, Math.round(t * 240)))];
}

// ---- faces: [[t, face], ...] with blinks ----------------------------------------------------------------------------------------------------------------
export function faceTrack(list, blinks = []) {
  return (t) => { let f = list[0][1]; for (const [a, x] of list) if (t >= a) f = x; f = { ...f, t };
    for (const b of blinks) if (t > b && t < b + 0.1 && ['open', 'wide', 'dot'].includes(f.eyes)) f.lid = 1; return f; };
}

// ---- the camera: keys [t, px, py, pz, tx, ty, tz, fov, fstop, follow?], a Catmull-Rom spline, hand breathing, shakes -----------------------------------------
// Two keys less than 20 ms apart are a hard cut: the shot before holds still up to the cut and the spline never runs across it.
// follow (0..1, per key): the target is pulled onto followAt(t) (the mascot's head), so focus and framing stay on it while it moves.
export function camTrack(CAM, shakes = [], breathe = 1, followAt = null) {
  const cut = (i) => i >= 0 && i < CAM.length - 1 && CAM[i + 1][0] - CAM[i][0] < 0.02;
  return (t) => {
    let i = 0; for (let k = 0; k < CAM.length; k++) if (CAM[k][0] <= t) i = k;
    const k0 = CAM[i]; const k1 = cut(i) ? k0 : CAM[Math.min(CAM.length - 1, i + 1)]; const kp = cut(i - 1) ? k0 : CAM[Math.max(0, i - 1)]; const k2 = cut(i + 1) ? k1 : CAM[Math.min(CAM.length - 1, i + 2)];
    const h = Math.max(1e-6, k1[0] - k0[0]); const s = clamp((t - k0[0]) / h); const out = [];
    for (let j = 1; j < 10; j++) { const v0 = k0[j] ?? 0, v1 = k1[j] ?? 0, vp = kp[j] ?? 0, v2 = k2[j] ?? 0;
      const m0 = i > 0 && kp !== k0 ? ((v1 - vp) / Math.max(1e-6, k1[0] - kp[0])) * h * 0.5 : 0; const m1 = k2 !== k1 ? ((v2 - v0) / Math.max(1e-6, k2[0] - k0[0])) * h * 0.5 : 0; const s2 = s * s; const s3 = s2 * s;
      out.push((2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * m1); }
    const w = clamp(out[8]); if (followAt && w > 0) { const f = followAt(t); for (let j = 0; j < 3; j++) out[3 + j] = lerp(out[3 + j], f[j], w); }
    out[3] += 0.04 * breathe * Math.sin(t * 1.3); out[4] += 0.03 * breathe * Math.sin(t * 1.7 + 1);
    let sh = 0; for (const [t0, a, d = 0.35] of shakes) { const dd = t - t0; if (dd > 0 && dd < d) sh = Math.max(sh, a * (1 - dd / d)); }
    out[3] += sh * Math.sin(t * 90); out[4] += sh * Math.sin(t * 77);
    const pos = out.slice(0, 3), tgt = out.slice(3, 6);
    return { pos, tgt, fov: out[6], fstop: out[7] };
  };
}
// a hard cut in a key list: the same time + 1 ms
export const CUT = (t) => t + 0.001;

// ---- the keyboard: a tenkeyless board, front row nearest the camera; written to keyboard.json for Blender ------------------------------------------------
export const KB = { u: 2.2, cap: 1.9, top: 2.3, travel: 0.4, base: [0, 0, 0] }; // key pitch, keycap top size, keycap top height above the desk, press depth
const ROWS = [
  [['Ctrl', 1.5], ['Win', 1.25], ['Alt', 1.25], ['Space', 5.75], ['AltGr', 1.25], ['Fn', 1.25], ['Menu', 1.25], ['CtrlR', 1.5]],
  [['Shift', 2.25], ['Z', 1], ['X', 1], ['C', 1], ['V', 1], ['B', 1], ['N', 1], ['M', 1], [',', 1], ['.', 1], ['/', 1], ['ShiftR', 2.75]],
  [['Caps', 1.75], ['A', 1], ['S', 1], ['D', 1], ['F', 1], ['G', 1], ['H', 1], ['J', 1], ['K', 1], ['L', 1], [';', 1], ["'", 1], ['Enter', 2.25]],
  [['Tab', 1.5], ['Q', 1], ['W', 1], ['E', 1], ['R', 1], ['T', 1], ['Y', 1], ['U', 1], ['I', 1], ['O', 1], ['P', 1], ['[', 1], [']', 1], ['\\', 1.5]],
  [['`', 1], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1], ['8', 1], ['9', 1], ['0', 1], ['-', 1], ['=', 1], ['Back', 2]],
];
const LABEL = { Ctrl: 'Ctrl', CtrlR: 'Ctrl', Win: '⊞', Alt: 'Alt', AltGr: 'Alt', Fn: 'Fn', Menu: '☰', Space: '', Shift: 'Shift', ShiftR: 'Shift', Caps: 'Caps', Enter: 'Enter', Tab: 'Tab', Back: '⌫' };
export function keyboard(origin = [0, 0, 0], yaw = 0) {
  const u = KB.u; const keys = {}; const W = 15 * u; // every row is 15 units wide
  ROWS.forEach((row, r) => { let x = -W / 2; for (const [name, w] of row) { const cx = x + (w * u) / 2; const lx = cx, lz = -r * u; const c = Math.cos(yaw), s = Math.sin(yaw);
    keys[name] = { name, label: LABEL[name] ?? name, w: w * u - (u - KB.cap), d: KB.cap, c: [origin[0] + lx * c + lz * s, origin[1] + KB.top, origin[2] - lx * s + lz * c], yaw, row: r }; x += w * u; } });
  return { keys, origin, yaw, size: [W + 1.2, 5 * u + 1.2], center: [origin[0] - (-2 * u) * Math.sin(yaw), origin[2] + (-2 * u) * Math.cos(yaw)] };
}
export function writeJSON(projDir, name, data) { fs.mkdirSync(path.join(projDir, 'out'), { recursive: true }); fs.writeFileSync(path.join(projDir, 'out', name), JSON.stringify(data)); }
export const projOf = (metaUrl) => path.resolve(path.dirname(fileURLToPath(metaUrl)), '..');

// ---- orientation helpers ---------------------------------------------------------------------------------------------------------------------------------------------
export const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const add = (a, b, k = 1) => a.map((x, i) => x + b[i] * k); export const sub = (a, b) => a.map((x, i) => x - b[i]);
// Euler XYZ (three.js order = Blender 'ZYX' mode) for an object whose local y goes to `up` and local z towards `fwd`
export function eulerFrom(up, fwd) { const y = norm(up); let z = norm(fwd); const x = norm(cross(y, z)); z = cross(x, y);
  const ry = Math.asin(clamp(z[0], -1, 1)); if (Math.abs(z[0]) < 0.9999) return [Math.atan2(-z[1], z[2]), ry, Math.atan2(-y[0], x[0])]; return [Math.atan2(y[2], y[1]), ry, 0]; }
// a Catmull-Rom path through timed points [[t, x, y, z], ...] -> position at t
export function pathAt(P, t) { if (t <= P[0][0]) return P[0].slice(1); if (t >= P[P.length - 1][0]) return P[P.length - 1].slice(1); let i = 0; while (P[i + 1][0] <= t) i++;
  const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)]; const u = (t - p1[0]) / (p2[0] - p1[0]); const u2 = u * u, u3 = u2 * u;
  return [1, 2, 3].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3)); }
