// Paper Plane: intersection check over every frame. The mascot against the ground, the pebble and the plane (when it is not riding);
// the plane against the ground and the slalom stalks; the camera against the ground, the stalks, the plane and the mascot.   node js/check.mjs
import * as PL from './plan.mjs';
import { bodyPoints } from '../kit/mascotgeo.mjs';
const { toWorld, mascotPose, camAt, planeAt, terrain, STEMS, PEBBLE, DUR, FPS } = PL;
const bad = {}; const note = (k, f) => { (bad[k] ||= []).push(f); };
// the plane as sample points in its frame: the spine, the wing edges, the keel bottom
const PP = []; for (let i = 0; i <= 10; i++) { const z = 2.5 - 5 * i / 10; const hs = 1.9 * (2.5 - z) / 5; PP.push([0, 0, z], [hs, 0.27 * hs / 1.9, z], [-hs, 0.27 * hs / 1.9, z], [hs / 2, 0.14 * hs / 1.9, z], [-hs / 2, 0.14 * hs / 1.9, z], [0, -0.75 * Math.min(1, (2.5 - z) / 1.5), z]); }
const l2w = (P, l) => [0, 1, 2].map((j) => P.O[j] + P.F.x[j] * l[0] + P.F.u[j] * l[1] + P.F.f[j] * l[2]);
// a point inside the plane's thin shell (in its frame): |y - surface| < 0.12 within the wing outline, or near the keel
function inPlane(P, q, pen = false) { const d = [q[0] - P.O[0], q[1] - P.O[1], q[2] - P.O[2]]; const x = d[0] * P.F.x[0] + d[1] * P.F.x[1] + d[2] * P.F.x[2], y = d[0] * P.F.u[0] + d[1] * P.F.u[1] + d[2] * P.F.u[2], z = d[0] * P.F.f[0] + d[1] * P.F.f[1] + d[2] * P.F.f[2];
  if (z > 2.5 || z < -2.5) return false; const hs = 1.9 * (2.5 - z) / 5; const sy = 0.14 * Math.abs(x); if (Math.abs(x) < hs && (pen ? (y < sy - 0.03 && y > sy - 0.2) : Math.abs(y - sy) < 0.12)) return true; if (Math.abs(x) < 0.1 && y < 0.05 && y > -0.75 * Math.min(1, (2.5 - z) / 1.5)) return true; return false; }
for (let i = 0; i < Math.round(DUR * FPS); i++) {
  const t = i / FPS; const pose = mascotPose(t); const pts = bodyPoints(pose).map((p) => toWorld(p, pose)); const P = planeAt(t);
  let under = 0, peb = 0, pl = 0;
  for (const q of pts) { const h = terrain(q[0], q[2]); if (q[1] < h - 0.1) under = Math.max(under, h - q[1]);
    const dp = Math.hypot(q[0] - PEBBLE.c[0], q[2] - PEBBLE.c[2]); if (dp < PEBBLE.r * 0.85 && q[1] < PEBBLE.h * 0.85) peb++;
    if (inPlane(P, q, true)) pl++; }
  if (under > 0) note('mascot under ground', i + 1); if (peb > 2) note('mascot in pebble', i + 1); if (pl > 3 && !(t > PL.T.grab - 0.1 && t < PL.T.landH)) note('mascot in plane', i + 1);   // hanging from the wing tip: hands on the paper by design
  // the plane
  let pg = 0, ps = 0; for (const l of PP) { const q = l2w(P, l); if (q[1] < terrain(q[0], q[2]) - 0.15 && t > PL.T.unstick) pg++; for (const s of STEMS) if (Math.hypot(q[0] - s[0], q[2] - s[1]) < 0.35 && q[1] < s[2]) ps++; }
  if (pg) note('plane in ground', i + 1); if (ps) note('plane hits a stalk', i + 1);
  // the camera
  const c = camAt(t); if (c.pos[1] < terrain(c.pos[0], c.pos[2]) + 0.3) note('camera low', i + 1);
  for (const s of STEMS) if (Math.hypot(c.pos[0] - s[0], c.pos[2] - s[1]) < 0.6 && c.pos[1] < s[2] + 0.5) note('camera in stalk', i + 1);
  if (inPlane(P, c.pos)) note('camera in plane', i + 1);
  const hc = toWorld([0, 0.78, 0], pose); if (Math.hypot(c.pos[0] - hc[0], c.pos[1] - hc[1], c.pos[2] - hc[2]) < 2.2) note('camera in mascot', i + 1);
}
const ranges = (a) => { const out = []; let s = a[0], p = a[0]; for (const x of a.slice(1)) { if (x !== p + 1) { out.push(s === p ? `${s}` : `${s}-${p}`); s = x; } p = x; } out.push(s === p ? `${s}` : `${s}-${p}`); return out.join(' '); };
const keys = Object.keys(bad); if (!keys.length) console.log('clean'); for (const k of keys) console.log(k.padEnd(22), bad[k].length, 'frames:', ranges(bad[k]).slice(0, 400));
