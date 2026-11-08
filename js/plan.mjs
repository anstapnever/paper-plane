// Paper Plane (04.11.2026). Anime film, 71.5 s at 24 fps. The Claude mascot wants to fly: it flaps off a pebble and flops in the grass;
// a paper plane folded from a notebook corner slams in beside it. A gust lifts them over the meadow; a dewy spider web soaks the left wing,
// the plane spirals into the shadow of a mound. The mascot tows it up by a web strand, dries it in the last sun, runs it off the cliff edge...
// it drops out of sight and rises on the evening updraft into the sunset. Units cm, y up, the sun toward -z.
// Characters on twos (12 drawings/s), effects on threes (8/s), the camera and the plane every frame.   node kit/bake.mjs .
import { clamp, smooth, lerp, PI, EASE, hash, keyed, hopAt, faceTrack, camTrack, norm, cross, add, sub, eulerFrom, pathAt, makeToWorld } from '../kit/common.mjs';
import { resolve, solid, armLocal, bodyPoints } from '../kit/mascotgeo.mjs';
export const DUR = 71.5; export const FPS = 24; export const S = 1.5;
export const toWorld = makeToWorld(S);
const q2 = (t) => Math.floor(t * 12 + 1e-6) / 12;
const q3 = (t) => Math.floor(t * 8 + 1e-6) / 8;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scl = (a, k) => a.map((x) => x * k);
const D2R = PI / 180;
// ---- the sun ---------------------------------------------------------------------------------------------------------------------------------------------------------
export const THS = 0.08 + Math.PI; export const HS = [Math.sin(THS), 0, -Math.cos(THS)];   // the sun is behind the start (+z): the flight heads away from it, faces toward the camera ahead
const EK = [[0, 9.0], [33, 6.6], [41, 5.8], [53, 3.4], [60, 1.9], [71.5, 0.7]];
export function sunE(t) { for (let i = 1; i < EK.length; i++) if (t <= EK[i][0]) { const [a, va] = EK[i - 1], [b, vb] = EK[i]; return va + (vb - va) * (t - a) / (b - a); } return EK[EK.length - 1][1]; }
export const sunDir = (t) => { const e = sunE(t) * D2R; return [HS[0] * Math.cos(e), Math.sin(e), HS[2] * Math.cos(e)]; };
// ---- the land: a meadow at y 0 and a mound: gentle on its shadow side (-z), a steep drop on its sunny side (+z); its top leans to the sun --------------------------------
export const MD = { cx: -52, cz: -110, R: 36, H: 16, top: 7, Ws: 6 };
export const EDGE = -1e9, LOWY = 0, DROP = 6;
const sstep = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
export function terrain(x, z) {
  const dx = x - MD.cx, dz = z - MD.cz; const r = Math.hypot(dx, dz); const sun = r > 1e-6 ? Math.max(0, dz / r) : 0;
  const Wd = (MD.R - MD.top) - (MD.R - MD.top - MD.Ws) * Math.pow(sun, 1.5);
  if (r >= MD.top + Wd) return 0;
  const fall = r < MD.top ? 1 - 0.01 * (r / MD.top) ** 2 : 0.99 * (1 - sstep((r - MD.top) / Wd));
  return MD.H * fall - 0.07 * dz * fall;
}
const tnorm = (x, z) => { const e = 0.3; return norm([terrain(x - e, z) - terrain(x + e, z), 2 * e, terrain(x, z - e) - terrain(x, z + e)]); };
// ---- props ------------------------------------------------------------------------------------------------------------------------------------------------------------
export const PEBBLE = { c: [-1.6, 0, 1.0], r: 1.55, h: 1.1 };
export const NOSE0 = [2.2, -0.15, -6.6];                     // where the nose sticks in
export const BUTTER = [[3.4, -7.0, 0.8], [1.2, -7.6, 0.7], [3.9, -6.1, 0.6], [0.9, -6.2, 0.55]];   // buttercups at the crash (x, z, h): the pollen
export const STEMS = [[-3.2, -44, 13], [4.2, -55, 15], [-4.5, -65, 12], [6.5, -77, 9], [-7.5, -88, 14], [8.0, -98, 11]];   // the tall stalks of the slalom (x, z, h)
export const WEB = { c: [0, 6.0, -118], R: 4.6, anchors: [[-6.6, -118.4, 13.5], [6.4, -117.6, 12.5]] };
export const PL = { L: 5.0, span: 1.9, keel: 0.75, seat: [0, 0.12, -0.6] };      // the plane: nose at local +z 2.5, wings to +-1.9 at the tail
// ---- the timeline --------------------------------------------------------------------------------------------------------------------------------------------------------
export const T = {
  crouch: 1.45, jump: 1.7, flop: 2.45, inbound: 2.5, impact: 3.15, blast: 3.22, onBack: 3.85, sitUp: 4.7, sneeze1: 5.25, stand: 5.8, stare: 6.1,
  walk1: 6.6, walk1e: 7.5, grab: 7.8, unstick: 8.35, level: 8.75, landH: 8.85, look2: 9.15, flap: 9.4, idea: 10.0, hopIn: 10.35, hopInE: 10.95,
  rock: 11.2, rockE: 12.2, bounce1: 12.35, bounce2: 12.8, grump: 13.3, gust: 14.55,
  awe: 16.0, standUp: 18.2, wide: 19.6, leanL: 21.2, leanR: 22.8, leanL2: 24.3,
  dfly: 26.3, dflySide: 26.9, wave1: 27.4, wave1e: 28.5, dart: 28.85, duck: 29.0, cling: 29.45, recover: 30.4, laugh: 30.6,
  turnBack: 31.0, turnFwd: 32.55, hit: 33.1, wetE: 35.6, droop: 35.0, droopE: 36.6, impact2: 40.0, rest2: 40.5,
  thrownE: 40.9, sitUp2: 42.5, stand2: 43.1, walk2: 43.4, walk2e: 44.2, poke: 44.55, sad: 44.95, lookUp2: 45.35, toNose: 45.6, rope: 46.0, tow: 46.4,
  slip: 48.3, slipE: 48.8, cut11: 49.6, light: 52.4, towE: 53.2, ropeOff: 53.4, turnSun: 54.1, toWing: 54.5, lift: 55.0, liftE: 55.9, test: 56.2, testE: 56.9,
  around: 57.0, aroundE: 57.6, push: 57.7, edge: 59.6, leap: 59.7, land3: 60.15, below: 60.9, rise3: 61.6,
  toNose2: 64.0, noseE: 64.8, arms: 65.0, dfly2: 65.6, twitch: 69.2, sneeze: 69.9, laugh2: 70.4,
};
// ---- frames ----------------------------------------------------------------------------------------------------------------------------------------------------------------
// a frame from a nose direction and a bank (positive = right wing down); x = up x fwd is the LEFT wing, as in eulerFrom
function frameOf(fwd, bank = 0, upHint = [0, 1, 0]) {
  const f = norm(fwd); let right = cross(f, upHint); if (Math.hypot(...right) < 1e-6) right = [1, 0, 0]; right = norm(right); const u0 = cross(right, f);
  const c = Math.cos(bank), s = Math.sin(bank); const r2 = sub(scl(right, c), scl(u0, s)); const u = add(scl(u0, c), scl(right, s));
  return { f, u, x: cross(u, f), right: r2 };
}
const yawOfDir = (d) => Math.atan2(d[0], d[2]);
// local -> world for a frame at origin O
const L2W = (O, F, l) => [O[0] + F.x[0] * l[0] + F.u[0] * l[1] + F.f[0] * l[2], O[1] + F.x[1] * l[0] + F.u[1] * l[1] + F.f[1] * l[2], O[2] + F.x[2] * l[0] + F.u[2] * l[1] + F.f[2] * l[2]];
// ---- the plane ---------------------------------------------------------------------------------------------------------------------------------------------------------------
const STUCK_P = 28 * D2R;
const stuckF = frameOf([0, -Math.sin(STUCK_P), -Math.cos(STUCK_P)], 0.1);
const STUCK_O = sub(NOSE0, scl(stuckF.f, 2.5));
const RESTP = [2.2, 0.8, -4.1]; const restF = frameOf([0, 0, -1]);
const FL = [   // the flight: the plane's origin (mid spine)
  [T.gust, ...RESTP], [15.2, 2.0, 2.2, -6.0], [16.0, 1.4, 3.8, -9.5], [17.5, 0.6, 5.6, -16], [19.0, 0, 6.8, -24], [20.0, 0, 7.0, -30],
  [21.0, 1.2, 6.6, -36.5], [22.0, 3.8, 6.2, -43.5], [23.5, -2.8, 6.5, -54.5], [25.0, 2.6, 6.0, -64.5], [26.0, 1.0, 6.4, -71], [27.5, 0, 6.8, -80.5],
  [29.0, 0.4, 6.6, -90], [30.0, -0.6, 6.2, -96.5], [31.0, 0, 6.2, -103.5], [32.0, 0, 6.0, -110.5], [T.hit, 0, 6.0, -118], [34.0, -0.6, 5.7, -124],
  [35.0, -2.5, 5.2, -130], [36.0, -7, 4.6, -134], [37.0, -13, 4.0, -135.5], [38.0, -19, 3.2, -134], [38.8, -25, 2.4, -134], [39.5, -33, 2.0, -139.5],
  [T.impact2, -40, 1.55, -144.5],
];
// the tow line up the mound and on to the edge
const CR = [-49.0, -152.0]; export const TD = norm([MD.cx - CR[0], 0, MD.cz - CR[1]]);
const towP = (s) => { const x = CR[0] + TD[0] * s, z = CR[1] + TD[2] * s; return [x, terrain(x, z), z]; };
export const TOW = { CR, TD };
const TOP_S = Math.hypot(MD.cx - CR[0], MD.cz - CR[1]); const S_EDGE = TOP_S + MD.top;   // ~37, ~44
const towS = (t) => {   // the mascot's distance up the line
  if (t < T.tow) return 5.0;
  if (t < T.slip) return lerp(5.0, 11.5, (t - T.tow) / (T.slip - T.tow));
  if (t < T.slipE) { const u = (t - T.slip) / (T.slipE - T.slip); return 11.5 - 1.8 * EASE.out(u); }
  if (t < T.cut11) return lerp(9.7, 13.2, EASE.smooth((t - T.slipE) / (T.cut11 - T.slipE)));
  if (t < T.towE) return lerp(TOP_S - 13.0, TOP_S + 0.8, (t - T.cut11) / (T.towE - T.cut11));
  return TOP_S + 0.8;
};
const planeS = (t) => {   // the plane's origin along the line (towed 5 cm behind; then pushed to the edge)
  if (t < T.tow) return 0;
  if (t < T.towE) return Math.max(0, towS(t) - 5.0);
  if (t < T.push) return TOP_S - 4.2;
  if (t < T.edge) { const u = (t - T.push) / (T.edge - T.push); return lerp(TOP_S - 4.2, S_EDGE - 2.1, u * u * (0.35 + 0.65 * u)); }
  return S_EDGE - 2.1;
};
const DIP = [  // off the edge: drop out of sight, then the updraft
  [T.edge, 0, 0], [60.0, 3.0, 0.25], [60.4, 6.0, -2.2], [T.below, 9.2, -8.0], [61.3, 12.0, -9.0], [61.8, 14.8, -6.5], [62.4, 18.4, -1.0], [63.0, 21.8, 3.6],
];
const SUNH = norm([HS[0], 0, HS[2]]); const ACROSS = norm(add(scl([-SUNH[2], 0, SUNH[0]], 0.96), scl(SUNH, 0.28)));   // across the sun, a little toward it
function finP(t) { // after 63 s: on toward the sun
  const S0 = S_EDGE - 2.1 + 21.8; const s0 = towP(S0); const p0 = [s0[0], groundF(S_EDGE - 2.1).O[1] + 3.6, s0[2]]; const u = (t - 63.0);
  const dir = norm(add(scl(TD, Math.max(0, 1 - u / 2.2)), scl(ACROSS, Math.min(1, u / 2.2))));
  const travel = u * 6.2; const p = add(p0, [0, 0, 0]);
  // integrate the turn approximately: blend straight lines
  const a = add(p0, scl(TD, Math.min(u, 2.2) * 6.2 * 0.5)); const b = add(a, scl(ACROSS, Math.max(0, u - 1.1) * 5.4));
  return { p: [b[0], p0[1] + 3.0 * EASE.smooth(clamp(u / 6)) + 0.35 * Math.sin(u * 1.3), b[2]], dir, travel };
}
// the plane lying on the land at s along the tow line: its keel ends both clear the ground
function groundF(s) { const pa = towP(s - 2.4), pb = towP(s + 2.4), p = towP(s); const dir = norm(sub(pb, pa)); const n = tnorm(p[0], p[2]);
  const mid = [(pa[0] + pb[0]) / 2, Math.max((pa[1] + pb[1]) / 2, p[1]), (pa[2] + pb[2]) / 2]; return { O: add(mid, scl(n, 0.9)), dir }; }
function planeRaw(t) {
  if (t < T.inbound) return { O: [1.4, -60, 30], F: frameOf([0, 0, -1]) };
  if (t < T.impact) { // the nose comes in over the camera and slams in beside the flopped mascot
    const P = [[T.inbound, 1.4, 9.0, 22], [2.8, 1.9, 4.4, 8], [3.02, 2.1, 1.7, -1.4], [T.impact, ...NOSE0]];
    const n = pathAt(P, t), n2 = pathAt(P, Math.min(T.impact, t + 0.02)); const d = t + 0.02 <= T.impact ? sub(n2, n) : sub(NOSE0, pathAt(P, T.impact - 0.02));
    const F = frameOf(d, 0.08 * Math.sin(t * 20)); return { O: sub(n, scl(F.f, 2.5)), F };
  }
  if (t < T.unstick) { // stuck in, tail quivering, then the mascot's weight
    const q = t - T.impact; let wob = 0.06 * Math.sin(q * 38) * Math.exp(-q * 4);
    if (t > T.grab) wob += 0.035 * Math.sin((t - T.grab) * 9) + 0.04 * clamp((t - T.grab) / 0.3);
    const F = frameOf([0, -Math.sin(STUCK_P - wob), -Math.cos(STUCK_P - wob)], 0.1 + 0.05 * Math.sin(q * 31) * Math.exp(-q * 4)); return { O: sub(NOSE0, scl(F.f, 2.5)), F };
  }
  if (t < T.gust) { // falls level about its nose, thumps, then sits; rocking and bouncing under the mascot
    let pitch = 0, bank = 0, dy = 0;
    if (t < T.level) { const u = EASE.in((t - T.unstick) / (T.level - T.unstick)); pitch = -STUCK_P * (1 - u); bank = 0.1 * (1 - u); }
    else { const q = t - T.level; dy = 0.18 * Math.abs(Math.sin(q * 14)) * Math.exp(-q * 7); pitch = 0.04 * Math.sin(q * 14) * Math.exp(-q * 6); }
    if (t > T.rock && t < T.rockE + 0.3) pitch += 0.03 * Math.sin((t - T.rock) * 2 * PI * 1.6) * (1 - clamp((t - T.rockE) / 0.3));
    for (const b of [T.bounce1 + 0.22, T.bounce2 + 0.22]) { const q = t - b; if (q > 0 && q < 0.5) { dy -= 0.12 * Math.sin(q * 25) * Math.exp(-q * 8); pitch += 0.02 * Math.sin(q * 25) * Math.exp(-q * 8); } }
    const F = frameOf([0, Math.sin(pitch), -Math.cos(pitch)], bank);
    const noseA = t < T.level ? lerp(NOSE0[1], RESTP[1], EASE.in(clamp((t - T.unstick) / (T.level - T.unstick)))) : RESTP[1];
    const nose = [NOSE0[0], noseA + dy, NOSE0[2]]; return { O: sub(nose, scl(F.f, 2.5)), F };
  }
  if (t < T.impact2 + 0.001) { // the flight (bank from the turn, a wobble, the dragonfly's near miss, the wet wing pulling left)
    const p = pathAt(FL, t); const h = 1 / 48; const pa = pathAt(FL, Math.max(T.gust, t - h)), pb = pathAt(FL, Math.min(T.impact2, t + h));
    const v = scl(sub(pb, pa), 1 / (2 * h)); const acc = scl(add(sub(pb, scl(p, 2)), pa), 1 / (h * h));
    const hv = norm([v[0], 0, v[2]]); const rightH = [-hv[2], 0, hv[0]];
    let bank = clamp(Math.atan2(dot(acc, rightH), 26), -0.75, 0.75);
    const k = clamp((t - T.gust) / 0.6); bank *= k;
    bank += (0.05 * Math.sin(t * 2.3) + 0.03 * Math.sin(t * 5.1)) * k;
    if (t > T.dart + 0.25 && t < T.recover + 0.4) { const u = (t - T.dart - 0.25) / (T.recover + 0.4 - T.dart - 0.25); bank += 0.62 * Math.sin(u * PI) * (1 - 0.4 * u); }
    if (t > T.droop) bank -= 0.45 * smooth((t - T.droop) / 1.4);
    bank *= 0.25 + 0.75 * clamp((p[1] - 0.75) / 2.2);   // near the ground the wings level out (no tip digs in)
    let fwd = norm(t < 16.2 ? [v[0], v[1] * 0.35, v[2]] : v); if (t < T.gust + 0.9) { const u = smooth((t - T.gust) / 0.9); fwd = norm(add(scl([0, 0, -1], 1 - u), scl(fwd, u))); }
    const pitchUp = t < 16.8 ? 0.28 * Math.sin(clamp((t - T.gust - 0.3) / 2.0) * PI) : 0.04;
    fwd = norm(add(fwd, [0, pitchUp + (t > 38 ? 0.12 * (1 - clamp((p[1] - 1.2) / 1.6)) : 0), 0]));   // the flare before touchdown
    if (t > T.hit && t < T.hit + 0.5) { const q = t - T.hit; fwd = norm(add(fwd, [0, -0.25 * Math.sin(q * PI / 0.5), 0])); }
    const F = frameOf(fwd, bank); return { O: p, F };
  }
  if (t < T.tow) { // the slide and ground-loop to rest, facing up the mound, left wing on the ground
    const u = smooth((t - T.impact2) / (T.rest2 - T.impact2)); const a = add(pathAt(FL, T.impact2), [0, 0.0, 0]), b = [...towP(0)]; b[1] += 0.85;
    const d0 = norm(sub(pathAt(FL, T.impact2), pathAt(FL, T.impact2 - 0.05)).map((v, j) => j === 1 ? 0 : v)); const dir = norm(add(scl(d0, 1 - u), scl(TD, u)));
    let bank = -0.16 * u; const pk = T.poke + 0.05; if (t > pk) bank -= 0.05 * Math.sin((t - pk) * 18) * Math.exp(-(t - pk) * 5);
    return { O: [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)], F: frameOf(dir, bank) };
  }
  if (t < T.edge) { // towed, then on the top, then pushed
    const G = groundF(planeS(t)); let bank = t < T.liftE ? -0.16 : -0.16 * (1 - smooth((t - T.liftE) / 0.3));
    if (t > T.tow && t < T.towE) bank += 0.04 * Math.sin(t * 7);
    return { O: G.O, F: frameOf(G.dir, bank) };
  }
  if (t < 63.0) { const S0 = S_EDGE - 2.1; const ss = pathAt(DIP.map((k) => [k[0], S0 + k[1], 0, k[2]]), t); const s = ss[0], dy = ss[2]; const top = groundF(S0).O[1] - 0.9;
    const xz = [CR[0] + TD[0] * s, CR[1] + TD[2] * s]; const O = [xz[0], top + 0.9 + dy, xz[1]];
    const s2 = pathAt(DIP.map((k) => [k[0], S0 + k[1], 0, k[2]]), t + 0.04); const O2 = [CR[0] + TD[0] * s2[0], top + 0.9 + s2[2], CR[1] + TD[2] * s2[0]];
    let fwd = norm(sub(O2, O)); fwd = norm(add(fwd, [0, 0.12 * smooth((t - 60.1) / 0.5), 0]));
    const G = groundF(S0); const kb = smooth((t - T.edge) / 0.45); const Ob = [lerp(G.O[0], O[0], kb), lerp(G.O[1], O[1], kb), lerp(G.O[2], O[2], kb)];
    return { O: Ob, F: frameOf(norm(add(scl(G.dir, 1 - kb), scl(fwd, kb))), 0.04 * Math.sin(t * 3) * kb) }; }
  const f = finP(t); let bank = 0.05 * Math.sin(t * 1.7) + 0.22 * Math.sin(clamp((t - 63) / 2.2) * PI);
  if (t > T.sneeze && t < T.sneeze + 0.8) { const q = t - T.sneeze; bank += 0.18 * Math.sin(q * 16) * Math.exp(-q * 4); }
  let fwd = norm(add(f.dir, [0, 0.06 + (t > T.sneeze && t < T.sneeze + 0.6 ? 0.2 * Math.sin((t - T.sneeze) * 16) * Math.exp(-(t - T.sneeze) * 5) : 0), 0]));
  return { O: f.p, F: frameOf(fwd, bank) };
}
export function planeAt(t) { return planeRaw(t); }
// wing dihedrals (deg), wet 0..1
export function wings(t) {
  let L = 8, R = 8;
  const fl = t > T.gust && t < T.impact2 ? 1.2 * Math.sin(t * 23) : 0; L += fl; R -= fl * 0.7;
  if (t > T.droop) L = lerp(8, -24, smooth((t - T.droop) / (T.droopE - T.droop))) + 12 * smooth((t - 38.6) / 1.2);   // the airflow lifts it a little before the ground
  if (t > T.impact2) L = -30 + 3 * Math.sin((t - T.impact2) * 20) * Math.exp(-(t - T.impact2) * 5);
  if (t > T.poke) L += -6 * Math.sin((t - T.poke) * 16) * Math.exp(-(t - T.poke) * 4);
  if (t > T.lift) L = lerp(-30, 8, EASE.back(clamp((t - T.lift) / (T.liftE - T.lift))));
  if (t > T.liftE + 0.4 && t < T.edge) L = 8;
  if (t > T.edge) L = 8 + fl;
  const wet = t < T.hit ? 0 : t < T.light ? smooth((t - T.hit) / (T.wetE - T.hit)) : 1 - smooth((t - T.light) / 3.6);
  return { L, R, wet };
}
// ---- the mascot ------------------------------------------------------------------------------------------------------------------------------------------------------------
const MF = ['yaw', 'sq', 'pitch', 'tilt', 'aL', 'sL', 'aR', 'sR'];
const F_ = PI;   // yaw 'forward' on the plane (and toward the sun on the ground)
const UPY = yawOfDir(TD);
const SUNY = yawOfDir(SUNH);
const MK = keyed([
  // S1: on the pebble, arms out into the breeze; the seed; the jump; flapping; the flop
  { t: 0, yaw: F_, sq: 0, pitch: -0.1, tilt: 0.04, aL: 1.45, sL: 0, aR: 1.45, sR: 0 }, { t: 0.7, tilt: -0.04, pitch: -0.14 }, { t: 1.2, pitch: -0.05, tilt: 0 },
  { t: T.crouch, sq: -0.2, pitch: 0.12, aL: 0.6, aR: 0.6 }, { t: T.jump, sq: 0.18, pitch: -0.05, aL: 2.4, aR: 2.4 }, { t: T.jump + 0.2, sq: 0 },
  { t: T.flop - 0.12, pitch: 0.7 }, { t: T.flop, pitch: PI / 2, sq: -0.25, aL: 2.8, aR: 2.8, e: 'in' }, { t: T.flop + 0.15, sq: 0, e: 'out' },
  // S2: lifts its head; the blast rolls it onto its back; pollen; a sneeze; up
  { t: T.impact - 0.25, pitch: 1.15, aL: 2.4, aR: 2.4 }, { t: T.impact, pitch: 1.15 }, { t: T.blast + 0.2, pitch: 0.2, aL: 2.9, aR: 2.9 }, { t: T.onBack, pitch: -PI / 2, sq: -0.12, aL: 2.6, sL: 0.3, aR: 2.6, sR: 0.3 },
  { t: T.onBack + 0.15, sq: 0 }, { t: T.sitUp, pitch: -PI / 2 }, { t: T.sitUp + 0.35, pitch: -0.45, aL: 0.5, aR: 0.5, sL: 0, sR: 0 },
  { t: T.sneeze1 - 0.25, pitch: -0.7, sq: 0.1 }, { t: T.sneeze1, pitch: -0.15, sq: -0.2 }, { t: T.sneeze1 + 0.12, pitch: -0.4, sq: 0.05 }, { t: T.sneeze1 + 0.3, sq: 0 },
  { t: T.stand, pitch: 0, yaw: F_, aL: 0.2, aR: 0.2 }, { t: T.stare, pitch: -0.25, sq: 0.06 },
  // S3: walks under the wing, jumps, hangs, comes down with it, compares wings and arms, hops in
  { t: T.walk1, pitch: 0, yaw: F_ + 0.3 }, { t: T.walk1e, yaw: F_, pitch: -0.4, sq: 0 }, { t: T.grab - 0.1, sq: -0.2, aL: 0.8, aR: 0.8 },
  { t: T.grab, sq: 0.15, aL: 2.95, sL: 0, aR: 2.95, sR: 0, pitch: -0.1 }, { t: T.unstick, pitch: -0.05 }, { t: T.landH, sq: -0.2, aL: 2.95, aR: 2.95 }, { t: T.landH + 0.2, sq: 0, aL: 0.3, aR: 0.3 },
  { t: T.look2, yaw: F_ - 0.45, pitch: -0.2 }, { t: T.flap, aL: 1.6, aR: 1.6 }, { t: T.flap + 0.15, aL: 0.6, aR: 0.6 }, { t: T.flap + 0.3, aL: 1.6, aR: 1.6 }, { t: T.flap + 0.45, aL: 0.6, aR: 0.6 },
  { t: T.idea, aL: 1.1, aR: 1.1, sq: 0.1, pitch: -0.3 }, { t: T.hopIn - 0.1, sq: -0.2, yaw: F_ - 0.6, pitch: 0.05, aL: 0.6, aR: 0.6 }, { t: T.hopIn + 0.05, sq: 0.15, aL: 2.3, aR: 2.3 },
  { t: T.hopInE, sq: -0.15, yaw: F_, aL: 0.8, aR: 0.8 }, { t: T.hopInE + 0.2, sq: 0 },
  // S4: rocks it, bounces it, sulks; the gust throws it back
  { t: T.rock, pitch: 0.22, aL: 1.2, aR: 1.2 }, { t: T.rock + 0.31, pitch: -0.18 }, { t: T.rock + 0.62, pitch: 0.22 }, { t: T.rock + 0.93, pitch: -0.12 }, { t: T.rockE, pitch: 0 },
  { t: T.bounce1 - 0.08, sq: -0.2 }, { t: T.bounce1 + 0.05, sq: 0.12, aL: 2.2, aR: 2.2 }, { t: T.bounce1 + 0.3, sq: -0.15 }, { t: T.bounce2 - 0.08, sq: -0.2 }, { t: T.bounce2 + 0.05, sq: 0.12 }, { t: T.bounce2 + 0.3, sq: -0.15 },
  { t: T.grump, sq: -0.1, aL: 0.9, sL: 1.4, aR: 0.9, sR: 1.4, yaw: F_ + 0.35, pitch: 0.05 }, { t: T.gust - 0.1, yaw: F_ + 0.35 },
  { t: T.gust + 0.15, pitch: -0.55, aL: 2.6, sL: 0, aR: 2.6, sR: 0, sq: 0.1, yaw: F_ }, { t: T.gust + 0.6, pitch: -0.2, aL: 0.25, aR: 0.25, sq: -0.15 },
  // S5-S6: awe; stands; arms wide; leans into the turns
  { t: T.awe, pitch: -0.1, sq: 0, aL: 0.3, aR: 0.3 }, { t: T.standUp, sq: 0.06, aL: 0.6, aR: 0.6 }, { t: T.wide, aL: 1.45, aR: 1.45, sq: 0.04, pitch: -0.08 },
  { t: T.leanL, tilt: 0.0 }, { t: T.leanL + 0.3, tilt: 0.22 }, { t: T.leanR, tilt: 0.22 }, { t: T.leanR + 0.35, tilt: -0.24 }, { t: T.leanL2, tilt: -0.24 }, { t: T.leanL2 + 0.35, tilt: 0.2 }, { t: 25.6, tilt: 0 },
  // S7: the dragonfly: looks, waves, ducks, clings, laughs
  { t: T.dflySide, yaw: F_ + 0.9, aL: 1.0, aR: 1.0 }, { t: T.wave1, aR: 2.6, sR: 0 }, { t: T.wave1 + 0.25, aR: 2.1 }, { t: T.wave1 + 0.5, aR: 2.6 }, { t: T.wave1 + 0.75, aR: 2.1 }, { t: T.wave1e, aR: 0.9, yaw: F_ + 0.5 },
  { t: T.duck - 0.05, sq: 0, yaw: F_ }, { t: T.duck + 0.12, sq: -0.3, pitch: 0.35, aL: 2.8, aR: 2.8 }, { t: T.cling, sq: -0.22, pitch: 0.25, tilt: -0.3, aL: 0.4, aR: 0.4 }, { t: T.recover, sq: 0, pitch: 0, tilt: 0, aL: 0.6, aR: 0.6 },
  { t: T.laugh, sq: 0.08, pitch: -0.15 }, { t: T.laugh + 0.2, sq: -0.04 }, { t: T.laugh + 0.4, sq: 0.06 },
  // S8: turns back to wave the dragonfly off; turns forward to the web; braces
  { t: T.turnBack, yaw: F_ - 0.2, sq: 0 }, { t: T.turnBack + 0.4, yaw: F_ - PI + 0.25, aL: 2.4, sL: 0, aR: 0.4, sR: 0 }, { t: T.turnBack + 0.65, aL: 2.0 }, { t: T.turnBack + 0.9, aL: 2.5 }, { t: T.turnBack + 1.15, aL: 2.0 }, { t: T.turnBack + 1.4, aL: 2.5 },
  { t: T.turnFwd, yaw: F_ - PI + 0.25, aL: 2.2 }, { t: T.turnFwd + 0.25, yaw: F_, aL: 1.2, aR: 1.2, pitch: -0.2 }, { t: T.hit - 0.12, sq: -0.2, aL: 2.8, aR: 2.8, pitch: 0.2 }, { t: T.hit + 0.2, sq: 0.05, pitch: -0.3 },
  // S9: shakes off; the wing goes; it clings as they spiral
  { t: 34.0, sq: 0, pitch: 0, aL: 0.6, aR: 0.6, tilt: 0.15 }, { t: 34.3, tilt: -0.15 }, { t: 34.6, tilt: 0.1 }, { t: 34.9, tilt: 0 },
  { t: T.droop + 0.5, yaw: F_ + 0.9, pitch: 0.1 }, { t: T.droopE, yaw: F_, sq: -0.25, pitch: 0.3, aL: 0.2, aR: 0.2 }, { t: 38.5, tilt: 0.25 }, { t: T.impact2 - 0.1, sq: -0.3, tilt: 0.1 },
  // S10: thrown onto its back, dizzy; up; to the wet wing; the poke; sad; looks up at the gold on the top
  { t: T.impact2 + 0.3, pitch: -1.2, sq: 0.1, aL: 2.8, aR: 2.8, yaw: UPY + PI }, { t: T.thrownE, pitch: -PI / 2, sq: -0.2, aL: 2.6, aR: 2.6 }, { t: T.thrownE + 0.15, sq: 0 },
  { t: T.sitUp2 - 0.2, pitch: -PI / 2 }, { t: T.sitUp2 + 0.2, pitch: -0.4, aL: 0.4, aR: 0.4, sL: 0, sR: 0 }, { t: T.stand2, pitch: 0, yaw: UPY + PI }, { t: T.stand2 + 0.3, tilt: 0.1 }, { t: T.stand2 + 0.6, tilt: -0.1 }, { t: T.walk2, tilt: 0 },
  { t: T.walk2e, yaw: UPY - PI * 0.5, pitch: 0 }, { t: T.poke - 0.12, pitch: -0.1 }, { t: T.poke, pitch: 0.26, sq: -0.06 }, { t: T.poke + 0.2, pitch: 0, sq: 0 },
  { t: T.sad, sq: -0.08, aL: 0.1, aR: 0.1, pitch: 0.12 }, { t: T.lookUp2, yaw: UPY, pitch: -0.32, sq: 0 },
  // S11: the rope over the shoulder; towing (leaning into it), the slip, on
  { t: T.toNose, yaw: UPY - 0.4, pitch: 0 }, { t: T.rope, aR: 2.5, sR: -0.7, yaw: UPY, pitch: 0.1 }, { t: T.tow, pitch: 0.26, aL: 0.7, sL: 0.4, aR: 2.5, sR: -0.7, sq: -0.06 },
  { t: T.slip, pitch: 0.26 }, { t: T.slip + 0.15, pitch: -0.2, sq: 0.05, aL: 1.8 }, { t: T.slipE, pitch: 0.3, sq: -0.12, aL: 0.7 }, { t: T.cut11, pitch: 0.24, sq: -0.08 },
  { t: T.towE, pitch: 0.2 }, { t: T.ropeOff, pitch: 0.4, sq: -0.2, aR: 0.2, sR: 0, aL: 0.2, sL: 0 }, { t: T.ropeOff + 0.3, sq: 0.05, pitch: 0.2 }, { t: T.ropeOff + 0.55, sq: -0.08 },
  // S12: turns to the sun; lifts the wet wing with its head; tests the air: nothing
  { t: T.turnSun, yaw: SUNY, pitch: -0.12, sq: 0.04 }, { t: T.toWing, yaw: SUNY + 1.2 }, { t: T.lift - 0.25, yaw: UPY, aR: 0.4 }, { t: T.lift - 0.05, sq: -0.2, pitch: 0.05, aR: 1.9, sR: 0 }, { t: T.liftE, sq: 0.12, pitch: -0.1, aR: 2.9, aL: 1.2 }, { t: T.liftE + 0.25, sq: 0 }, { t: T.liftE + 0.35, aR: 0.6, aL: 0.4 },
  { t: T.test, aR: 2.9, sR: 0, aL: 0.3, yaw: SUNY, pitch: -0.15 }, { t: T.testE, aR: 0.4, pitch: 0, tilt: 0.12 }, { t: T.testE + 0.1, tilt: 0 },
  // S13: round to the tail, the push, the run, the leap, crouched in the fold
  { t: T.around, yaw: SUNY + PI * 0.7 }, { t: T.aroundE, yaw: SUNY, pitch: 0.1 }, { t: T.push, pitch: 0.26, sq: -0.08, aL: 1.2, sL: 0.6, aR: 1.2, sR: 0.6 }, { t: T.edge - 0.1, pitch: 0.26 },
  { t: T.leap, sq: 0.18, pitch: -0.05, aL: 2.6, sL: 0, aR: 2.6, sR: 0 }, { t: T.land3, sq: -0.3, yaw: F_, pitch: 0.2, aL: 0.4, aR: 0.4 }, { t: T.below, sq: -0.25 }, { t: T.rise3, sq: -0.2, pitch: 0.1 },
  { t: 62.4, sq: 0.08, pitch: -0.25, aL: 1.6, aR: 1.6 }, { t: 63.2, sq: 0, pitch: -0.1, aL: 1.2, aR: 1.2 },
  // S14: on to the nose; arms wide; the dragonfly
  { t: T.toNose2, aL: 0.5, aR: 0.5 }, { t: T.noseE, pitch: 0 }, { t: T.arms, aL: 1.5, aR: 1.5, pitch: -0.12, sq: 0.03 }, { t: 67.0, tilt: 0.05 }, { t: 68.0, tilt: -0.04, yaw: F_ + 0.5 }, { t: 68.6, yaw: F_ },
  // S15: blissful; the twitch; the sneeze; clings; laughs
  { t: T.twitch, sq: 0.05, pitch: -0.18 }, { t: T.twitch + 0.2, sq: 0 }, { t: T.twitch + 0.45, sq: 0.06 }, { t: T.sneeze - 0.22, pitch: -0.4, sq: 0.12, aL: 1.0, aR: 1.0 },
  { t: T.sneeze, pitch: 0.4, sq: -0.28, aL: 0.4, aR: 0.4 }, { t: T.sneeze + 0.2, sq: -0.2, pitch: 0.2, tilt: 0.2 }, { t: T.laugh2, sq: 0.06, tilt: 0, pitch: -0.15, aL: 1.6, aR: 1.6 }, { t: T.laugh2 + 0.25, sq: -0.02 }, { t: T.laugh2 + 0.5, sq: 0.06 },
], MF);
// rotation of the mascot rig: R = Ry(yaw) Rz(tilt) Rx(pitch); compose and split
const Ry = (a) => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
const Rz = (a) => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
const Rx = (a) => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const split = (M) => ({ tilt: Math.asin(clamp(M[1][0], -1, 1)), pitch: Math.atan2(-M[1][2], M[1][1]), yaw: Math.atan2(-M[2][0], M[0][0]) });
const frameM = (F) => [[F.x[0], F.u[0], F.f[0]], [F.x[1], F.u[1], F.f[1]], [F.x[2], F.u[2], F.f[2]]];
// where it is: ground positions, hops, riding (local to the plane)
const PEB_TOP = [-1.6, PEBBLE.h, 1.15];
const FLOPF = [-0.4, 0.78, -1.15];                    // the feet pivot lying face down (head toward -z)
const BACKP = [2.0, 0.78, 2.9];                      // after the blast, on its back (head toward +z)
const UNDER = [0.25, 0, -2.0];                       // under the left wing tip
const SEATL = PL.seat; const NOSEL = [0, 0.05, 1.25];
const tipW = (t) => { const P = planeRaw(t); return L2W(P.O, P.F, [1.9 * Math.cos(wings(t).L * D2R), 0.12 + 1.9 * Math.sin(wings(t).L * D2R) - 0.05, -2.45]); };
const handsUp = (pose) => { const a = armLocal([0.38, 0, 0], -1, pose.arms[0][0], pose.arms[0][1]), b = armLocal([0.38, 0, 0], 1, pose.arms[1][0], pose.arms[1][1]); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; };
function ride(t, k, lp) { const P = planeRaw(t); const M = mm(frameM(P.F), mm(Ry(k.yaw - F_), mm(Rz(k.tilt), Rx(k.pitch)))); return { pos: L2W(P.O, P.F, lp), ...split(M), ride: true }; }
function where(t, k) {
  const g = (p) => ({ pos: p, yaw: k.yaw, tilt: k.tilt, pitch: k.pitch });
  if (t < T.jump) return g(PEB_TOP);
  if (t < T.flop) return { ...g(hopAt(t, T.jump, T.flop, PEB_TOP, FLOPF, 1.1)), air: true, flap: true };
  if (t < T.blast) return g(FLOPF);
  if (t < T.onBack) { const u = (t - T.blast) / (T.onBack - T.blast); const hp = hopAt(t, T.blast, T.onBack, FLOPF, BACKP, 1.3); hp[0] = lerp(FLOPF[0], BACKP[0], EASE.out(u)); hp[1] += 1.5 * Math.sqrt(Math.sin(u * PI)); return { ...g(hp), air: true, spin: u }; }
  if (t < T.sitUp) return g(BACKP);
  if (t < T.stand) { const u = smooth((t - T.sitUp) / (T.stand - T.sitUp)); return g([BACKP[0], lerp(0.78, 0, u), lerp(BACKP[2] + 0.0, BACKP[2] - 0.9, u)]); }
  const ST = [BACKP[0], 0, BACKP[2] - 0.9];
  if (t < T.walk1) return g(ST);
  if (t < T.walk1e) { const u = smooth((t - T.walk1) / (T.walk1e - T.walk1)); return { ...g([lerp(ST[0], UNDER[0], u), 0, lerp(ST[2], UNDER[2], u)]), walk: true }; }
  if (t < T.grab - 0.12) return g(UNDER);
  if (t < T.landH) { // jumps to the tip, hangs from it as it comes down
    const pose = { pos: [0, 0, 0], yaw: k.yaw, tilt: k.tilt, pitch: k.pitch, sx: 1 - 0.5 * k.sq, sy: 1 + k.sq, sz: 1 - 0.5 * k.sq, arms: [[k.aL, k.sL], [k.aR, k.sR]] };
    const h = toWorld(handsUp(pose), pose); const hang = sub(tipW(t), add(h, [0, 0.12, 0]));
    if (t < T.grab) { const u = EASE.out((t - T.grab + 0.12) / 0.12); return { ...g([lerp(UNDER[0], hang[0], u), lerp(0, hang[1], u), lerp(UNDER[2], hang[2], u)]), air: true }; }
    if (hang[1] <= 0.02) return g([hang[0], 0, hang[2]]);
    return { ...g(hang), air: true, hang: true };
  }
  const LH = (() => { const P = tipW(T.landH); return [P[0] - 0.3, 0, P[2] + 0.6]; })();
  if (t < T.hopIn) return g(LH);
  if (t < T.hopInE) { const P = planeRaw(T.hopInE); return { ...g(hopAt(t, T.hopIn, T.hopInE, LH, L2W(P.O, P.F, SEATL), 1.3)), air: true }; }
  if (t < T.impact2) { let lp = SEATL; if (t > T.bounce1 && t < T.bounce1 + 0.3) lp = add(lp, [0, 0.55 * Math.sin((t - T.bounce1) / 0.3 * PI), 0]); if (t > T.bounce2 && t < T.bounce2 + 0.3) lp = add(lp, [0, 0.55 * Math.sin((t - T.bounce2) / 0.3 * PI), 0]);
    if (t > T.gust && t < T.gust + 0.5) lp = add(lp, [0, 0, -0.5 * Math.sin((t - T.gust) / 0.5 * PI)]);
    return ride(t, k, lp); }
  const THROWN = (() => { const p = towP(5.6); return [p[0], p[1] + 0.9, p[2]]; })();
  if (t < T.thrownE) { const P = planeRaw(T.impact2); const a = L2W(P.O, P.F, add(SEATL, [0, 0.35, 0])); const hp = hopAt(t, T.impact2, T.thrownE, a, THROWN, 1.4); hp[1] += 0.6 * Math.sqrt(Math.sin(clamp((t - T.impact2) / (T.thrownE - T.impact2)) * PI)); return { ...g(hp), air: true }; }
  if (t < T.sitUp2 + 0.2) return g(THROWN);
  const up5 = towP(5.0); const SIDE = (() => { const p = towP(0.4); const L = [TD[2], 0, -TD[0]]; return [p[0] + L[0] * 3.0, 0, p[2] + L[2] * 3.0]; })();  // beside the wet (left) wing
  const stand0 = [up5[0], 0, up5[2]];
  if (t < T.walk2) { const u = smooth((t - T.sitUp2 - 0.2) / (T.stand2 - T.sitUp2 - 0.2)); return { ...g([THROWN[0], lerp(0.78, 0, u), THROWN[2]]), ground: true }; }
  if (t < T.walk2e) { const u = smooth((t - T.walk2) / (T.walk2e - T.walk2)); return { ...g([lerp(THROWN[0], SIDE[0], u), 0, lerp(THROWN[2], SIDE[2], u)]), walk: true, ground: true }; }
  if (t < T.toNose) return { ...g(SIDE), ground: true };
  if (t < T.tow) { const u = smooth((t - T.toNose) / (T.tow - T.toNose)); return { ...g([lerp(SIDE[0], stand0[0], u), 0, lerp(SIDE[2], stand0[2], u)]), walk: true, ground: true }; }
  if (t < T.towE) { const p = towP(towS(t)); return { ...g([p[0], 0, p[2]]), walk: !(t > T.slip && t < T.slipE), ground: true, fast: true }; }
  const top = towP(TOP_S + 0.8);
  if (t < T.toWing) return { ...g([top[0], 0, top[2]]), ground: true };
  const wingTip = (() => { const P = planeRaw(T.lift); return L2W(P.O, P.F, [2.95, 0, -1.6]); })();
  const UW = [wingTip[0], 0, wingTip[2]];
  if (t < T.lift) { const u = smooth((t - T.toWing) / (T.lift - T.toWing)); return { ...g([lerp(top[0], UW[0], u), 0, lerp(top[2], UW[2], u)]), walk: true, ground: true }; }
  if (t < T.around) return { ...g(UW), ground: true };
  const behind = (t2) => { const p = towP(planeS(t2) - 3.7); return [p[0], 0, p[2]]; };
  if (t < T.aroundE) { const u = smooth((t - T.around) / (T.aroundE - T.around)); const b = behind(T.push); const mid = add(UW, scl(TD, -2.2));
    return { ...g(pathAt([[0, ...UW], [0.5, mid[0], 0, mid[2]], [1, ...b]], u)), walk: true, ground: true }; }
  if (t < T.leap) return { ...g(behind(Math.min(t, T.edge))), walk: t > T.push, ground: true, fast: true };
  if (t < T.land3) { const P = planeRaw(T.land3); const b = towP(planeS(T.edge) - 1.6); return { ...g(hopAt(t, T.leap, T.land3, [b[0], 0, b[2]].map((v, j) => j === 1 ? terrain(b[0], b[2]) : v), L2W(P.O, P.F, SEATL), 2.2)), air: true }; }
  if (t < T.toNose2) return ride(t, k, SEATL);
  if (t < T.noseE) { const u = smooth((t - T.toNose2) / (T.noseE - T.toNose2)); return { ...ride(t, k, [0, lerp(SEATL[1], NOSEL[1], u), lerp(SEATL[2], NOSEL[2], u)]), walk: true }; }
  return ride(t, k, NOSEL);
}
export function mascotPose(t0) {
  const t = q2(t0); const k = MK(t); let w = where(t, k);
  // riding: the drawing (pose, face) changes on twos, but where it sits follows the plane every frame, or it shakes against the plane
  if (w.ride) { const w2 = where(t0, k); if (w2.ride) w = w2; }
  const pose = { pos: w.pos, yaw: w.yaw, tilt: w.tilt, pitch: w.pitch, sx: 1 - 0.5 * k.sq, sy: 1 + k.sq, sz: 1 - 0.5 * k.sq, arms: [[k.aL, k.sL], [k.aR, k.sR]], legs: [0, 0, 0, 0] };
  if (w.walk) { const ph = t * (w.fast ? 16 : 11); pose.legs = [0.7 * Math.sin(ph), -0.7 * Math.sin(ph), 0.7 * Math.sin(ph), -0.7 * Math.sin(ph)]; pose.pos = add(pose.pos, [0, 0.1 * Math.abs(Math.sin(ph)), 0]); pose.tilt += 0.05 * Math.sin(ph); }
  if (w.flap) { const ph = (t - T.jump) * 2 * PI * 5.5; pose.arms = [[1.6 + 1.1 * Math.sin(ph), 0], [1.6 + 1.1 * Math.sin(ph), 0]]; pose.legs = [0.5 * Math.sin(ph * 0.5), -0.5 * Math.sin(ph * 0.5), 0.5 * Math.sin(ph * 0.5), -0.5 * Math.sin(ph * 0.5)]; }
  if (t > T.flop && t < T.impact - 0.3) { const ph = (t - T.flop) * 14; pose.legs = [0.6 * Math.sin(ph), -0.6 * Math.sin(ph), 0.6 * Math.sin(ph), -0.6 * Math.sin(ph)]; }   // legs kick on the ground
  if (w.hang) { const ph = t * 13; pose.legs = [0.6 * Math.sin(ph), -0.6 * Math.sin(ph), 0.6 * Math.sin(ph), -0.6 * Math.sin(ph)]; }
  if (w.spin !== undefined) pose.pitch = lerp(1.15, -PI / 2 - 2 * PI, EASE.out(w.spin)) + 2 * PI * (w.spin > 0.999 ? 1 : 0);
  if (t > T.below && t < T.rise3 + 0.2) pose.tilt += 0.03 * Math.sin(t * 30);
  if (!w.air && !w.ride) {
    const ter = (q) => { const h = terrain(q[0], q[2]); return q[1] < h ? [h - q[1], [0, 1, 0]] : null; };
    if (w.ground) { pose.pos = [pose.pos[0], terrain(pose.pos[0], pose.pos[2]) + pose.pos[1], pose.pos[2]]; }
    resolve(pose, toWorld, t < 2.0 ? [solid.floor(0), solid.cylinder([PEBBLE.c[0], PEBBLE.c[2]], PEBBLE.r, PEBBLE.h)] : [ter]);
  }
  if (w.ride) { const P = planeRaw(t0); let pen = 0;
    for (const p of bodyPoints(pose)) { const q = toWorld(p, pose); const d = sub(q, P.O); const x = dot(d, P.F.x), y = dot(d, P.F.u), z = dot(d, P.F.f);
      const hs = 1.9 * (2.5 - z) / 5; if (z < 2.5 && z > -2.5 && Math.abs(x) < hs + 0.05) pen = Math.max(pen, 0.14 * Math.abs(x) + 0.03 - y); }
    pen += 0.03; if (pen > 0) pose.pos = add(pose.pos, scl(P.F.u, pen)); }
  pose.face = FACE(t); return pose;
}
const FACE = faceTrack([
  [0, { eyes: 'happy', mouth: 'smile', blush: 0.7, anime: true }], [1.0, { eyes: 'animeWide', sparkle: 1, mouth: 'o', open: 0.4, anime: true, look: [0.6, 0.3], brow: 'up' }],
  [T.crouch, { eyes: 'anime', mouth: 'grin', anime: true, brow: 'angry', look: [0, 0.4] }], [T.jump + 0.2, { eyes: 'closed', mouth: 'grin', anime: true, brow: 'angry', sweat: 1 }],
  [T.flop + 0.05, { eyes: 'xx', mouth: 'wavy', anime: true }], [T.inbound + 0.2, { eyes: 'animeWide', mouth: 'open', open: 0.8, anime: true, brow: 'up', look: [0, 0.9] }],
  [T.blast, { eyes: 'closed', mouth: 'open', open: 1, anime: true, brow: 'up' }], [T.onBack + 0.1, { eyes: 'spiral', mouth: 'wavy', anime: true }],
  [T.sitUp + 0.3, { eyes: 'anime', lid: 0.4, mouth: 'flat', anime: true, brow: 'worried', blush: 0.3 }], [T.sneeze1 - 0.3, { eyes: 'closed', mouth: 'o', open: 0.6, anime: true, brow: 'up' }],
  [T.sneeze1, { eyes: 'closed', mouth: 'open', open: 1, anime: true, brow: 'angry' }], [T.sneeze1 + 0.3, { eyes: 'anime', lid: 0.3, mouth: 'wavy', anime: true }],
  [T.stare, { eyes: 'animeWide', sparkle: 1, mouth: 'o', open: 0.5, anime: true, brow: 'up', look: [0.3, 0.6] }],
  [T.walk1e, { eyes: 'anime', mouth: 'grin', anime: true, brow: 'angry', look: [0, 0.9] }], [T.grab + 0.1, { eyes: 'closed', mouth: 'grin', anime: true, brow: 'angry', sweat: 1 }],
  [T.landH, { eyes: 'animeWide', mouth: 'o', open: 0.6, anime: true, brow: 'up' }], [T.look2, { eyes: 'anime', mouth: 'flat', anime: true, look: [0.8, 0.2] }],
  [T.flap, { eyes: 'anime', mouth: 'o', open: 0.3, anime: true, look: [0.6, -0.2], brow: 'up' }], [T.idea, { eyes: 'animeWide', sparkle: 1, mouth: 'grin', anime: true, brow: 'up', blush: 0.6 }],
  [T.hopInE, { eyes: 'happy', mouth: 'grin', blush: 0.8, anime: true }], [T.rock, { eyes: 'anime', mouth: 'grin', anime: true, brow: 'angry' }],
  [T.bounce1, { eyes: 'closed', mouth: 'grin', anime: true, brow: 'angry' }], [T.bounce2 + 0.3, { eyes: 'anime', lid: 0.3, mouth: 'frown', anime: true, brow: 'worried' }],
  [T.grump, { eyes: 'anime', lid: 0.55, mouth: 'flat', anime: true, brow: 'angry', look: [-0.6, 0] }], [T.gust, { eyes: 'animeWide', mouth: 'open', open: 1, anime: true, brow: 'up' }],
  [T.gust + 0.7, { eyes: 'closed', mouth: 'wavy', anime: true, brow: 'worried', sweat: 1 }], [T.awe, { eyes: 'animeWide', sparkle: 1, mouth: 'o', open: 0.7, anime: true, brow: 'up' }],
  [T.standUp, { eyes: 'animeWide', sparkle: 1, mouth: 'open', open: 0.6, anime: true, blush: 0.6 }], [T.wide, { eyes: 'happy', mouth: 'grin', blush: 1, anime: true }],
  [T.leanR, { eyes: 'happy', mouth: 'open', open: 0.7, blush: 1, anime: true }], [T.leanL2 + 0.5, { eyes: 'happy', mouth: 'grin', blush: 1, anime: true }],
  [T.dflySide, { eyes: 'animeWide', mouth: 'o', open: 0.5, anime: true, look: [-0.8, 0.1], brow: 'up' }], [T.wave1, { eyes: 'happy', mouth: 'smile', blush: 0.8, anime: true }],
  [T.dart, { eyes: 'animeWide', mouth: 'open', open: 1, anime: true, brow: 'up' }], [T.cling, { eyes: 'closed', mouth: 'wavy', anime: true, brow: 'worried', sweat: 1 }],
  [T.laugh, { eyes: 'happy', mouth: 'open', open: 0.8, blush: 1, anime: true }], [T.turnBack + 0.4, { eyes: 'happy', mouth: 'grin', blush: 0.8, anime: true }],
  [T.turnFwd + 0.15, { eyes: 'animeWide', mouth: 'o', open: 0.9, anime: true, brow: 'up' }], [T.hit - 0.1, { eyes: 'closed', mouth: 'wavy', anime: true, brow: 'worried' }],
  [T.hit + 0.3, { eyes: 'anime', lid: 0.3, mouth: 'wavy', anime: true, brow: 'worried', sweat: 1 }], [T.droop + 0.4, { eyes: 'animeWide', mouth: 'o', open: 0.6, anime: true, brow: 'worried', look: [0.8, -0.4] }],
  [T.droopE, { eyes: 'closed', mouth: 'open', open: 1, anime: true, brow: 'up', sweat: 1 }], [T.impact2 + 0.3, { eyes: 'xx', mouth: 'wavy', anime: true }],
  [T.thrownE + 0.3, { eyes: 'spiral', mouth: 'wavy', anime: true }], [T.sitUp2 + 0.2, { eyes: 'anime', lid: 0.4, mouth: 'flat', anime: true, brow: 'worried' }],
  [T.walk2e, { eyes: 'anime', mouth: 'o', open: 0.3, anime: true, look: [0.4, -0.5], brow: 'worried' }], [T.sad, { eyes: 'anime', lid: 0.5, mouth: 'frown', anime: true, brow: 'sad', look: [0, -0.5] }],
  [T.lookUp2 + 0.3, { eyes: 'animeWide', sparkle: 1, mouth: 'o', open: 0.4, anime: true, look: [0, 0.9], brow: 'up' }], [T.rope, { eyes: 'anime', mouth: 'grin', anime: true, brow: 'angry', look: [0, 0.4] }],
  [T.tow, { eyes: 'closed', mouth: 'grin', anime: true, brow: 'angry', sweat: 1 }], [T.slip, { eyes: 'animeWide', mouth: 'open', open: 0.9, anime: true, brow: 'up' }],
  [T.slipE + 0.1, { eyes: 'anime', mouth: 'grin', anime: true, brow: 'angry', sweat: 1, look: [0, 0.5] }], [T.cut11, { eyes: 'closed', mouth: 'grin', anime: true, brow: 'angry', sweat: 1 }],
  [T.light, { eyes: 'animeWide', sparkle: 1, mouth: 'o', open: 0.5, anime: true, brow: 'up' }], [T.ropeOff, { eyes: 'closed', mouth: 'open', open: 0.7, anime: true, sweat: 1 }],
  [T.turnSun, { eyes: 'happy', mouth: 'smile', blush: 1, anime: true }], [T.lift, { eyes: 'closed', mouth: 'grin', anime: true, brow: 'angry' }],
  [T.liftE, { eyes: 'happy', mouth: 'grin', blush: 0.8, anime: true }], [T.test, { eyes: 'anime', mouth: 'flat', anime: true, look: [0, 0.6] }],
  [T.testE, { eyes: 'anime', lid: 0.3, mouth: 'wavy', anime: true, brow: 'worried' }], [T.around + 0.3, { eyes: 'anime', mouth: 'grin', anime: true, brow: 'angry' }],
  [T.push, { eyes: 'closed', mouth: 'grin', anime: true, brow: 'angry', sweat: 1 }], [T.leap, { eyes: 'animeWide', mouth: 'open', open: 1, anime: true, brow: 'up' }],
  [T.land3, { eyes: 'closed', mouth: 'wavy', anime: true, brow: 'worried' }], [T.rise3 + 0.3, { eyes: 'animeWide', sparkle: 1, mouth: 'o', open: 0.7, anime: true, brow: 'up' }],
  [62.6, { eyes: 'happy', mouth: 'open', open: 0.8, blush: 1, anime: true }], [T.arms, { eyes: 'happy', mouth: 'smile', blush: 1, anime: true }],
  [T.dfly2 + 0.6, { eyes: 'happy', mouth: 'grin', blush: 0.8, anime: true, look: [-0.7, 0] }], [68.6, { eyes: 'closed', mouth: 'smile', blush: 0.9, anime: true }],
  [T.twitch, { eyes: 'closed', mouth: 'o', open: 0.3, anime: true, brow: 'up' }], [T.sneeze - 0.22, { eyes: 'closed', mouth: 'o', open: 0.8, anime: true, brow: 'up' }],
  [T.sneeze, { eyes: 'closed', mouth: 'open', open: 1, anime: true, brow: 'angry' }], [T.sneeze + 0.25, { eyes: 'animeWide', mouth: 'wavy', anime: true, brow: 'up' }],
  [T.laugh2, { eyes: 'happy', mouth: 'open', open: 0.9, blush: 1, anime: true }],
], [6.4, 9.0, 11.0, 17.2, 20.8, 24.9, 27.9, 34.6, 43.6, 50.6, 54.6, 58.2, 66.1]);
export const heroC = (t) => toWorld([0, 0.78, 0], mascotPose(t));
// ---- the dragonfly: [x, y, z, heading yaw, pitch, roll, flap] -------------------------------------------------------------------------------------------------------------
function dflyRel(t) { // positions in the plane's frame
  const K = [[T.dfly, -9, 3.0, -9], [T.dflySide, 3.4, 1.6, -0.5], [T.dart, 3.5, 1.5, -0.4], [T.dart + 0.25, 2.2, 1.2, 3.2], [T.dart + 0.45, -2.5, 1.0, 4.0], [T.dart + 0.8, -8, 2.0, 1.5],
    [30.5, -6, 3.0, -5], [31.6, -3.8, 2.6, -6.5], [32.6, -9, 6, -12], [33.4, -16, 10, -20]];
  let p = pathAt(K, t); if (t > T.dflySide && t < T.dart) p = add(p, [0, 0.25 * Math.sin(t * 3.7), 0.15 * Math.sin(t * 2.3)]);
  if (t > 30.5 && t < 31.6) p = add(p, [0, 0.2 * Math.sin(t * 4), 0]); return p;
}
function dflyRel2(t) { const K = [[T.dfly2, -10, 5, -10], [67.0, 3.6, 1.0, -0.4], [DUR, 3.8, 1.1, -0.2]]; return add(pathAt(K, t), [0, 0.2 * Math.sin(t * 3.3), 0.1 * Math.sin(t * 2.1)]); }
export function dragonfly(t) {
  let rel = null; if (t >= T.dfly && t < 33.4) rel = dflyRel; else if (t >= T.dfly2) rel = dflyRel2;
  if (!rel) return [0, -60, 0, 0, 0, 0, 0];
  const P = planeRaw(t); const p = L2W(P.O, P.F, rel(t)); const P2 = planeRaw(t + 0.05); const p2 = L2W(P2.O, P2.F, rel(t + 0.05));
  const v = sub(p2, p); const sp = Math.hypot(...v) / 0.05; const hd = sp > 4 ? norm(v) : P.F.f;
  const flap = Math.floor(q3(t) * 8) % 2;
  return [...p, yawOfDir(hd), -Math.asin(clamp(hd[1], -1, 1)) * 0.6, 0.15 * Math.sin(t * 2), flap];
}
// ---- the seed in S1, pollen, web drops, strands -----------------------------------------------------------------------------------------------------------------------
function seedS1(t) { const P = [[0, 7, 3.6, 6], [1.0, 3.0, 3.2, 1.5], [1.6, 0.6, 3.0, -1.4], [2.6, -2.6, 3.6, -6], [4.0, -6, 4.6, -14]]; const p = pathAt(P, Math.min(t, 4.0)); return add(p, [0, 0.25 * Math.sin(t * 3), 0]); }
export const NPOL = 110;
const POL = []; for (let i = 0; i < NPOL; i++) { const a = hash(i * 1.37) * 2 * PI, e = 0.2 + hash(i * 2.9) * 1.1; const sp = 2 + hash(i * 4.1) * 6;
  const b = BUTTER[i % 4]; POL.push({ o: [b[0], b[2], b[1]], v: [Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp * 0.9 + 1.0, Math.sin(a) * Math.cos(e) * sp + 1.5], stick: i < 14, w: hash(i * 6.3) }); }
export function pollen(t0) { const t = q3(t0); const out = [];
  for (let i = 0; i < NPOL; i++) { const s = POL[i]; const age = t - T.impact;
    if (age < 0) { out.push(...s.o, 0); continue; }
    const k = 1 - Math.exp(-age * 2.0); let p = [s.o[0] + s.v[0] * k / 2.0 + age * 0.5, s.o[1] + s.v[1] * k / 2.0 - age * 0.2 + 0.3 * Math.sin(age * 2 + s.w * 6), s.o[2] + s.v[2] * k / 2.0 + age * 0.4];
    let g = clamp(1 - age / 6.5) * (0.6 + 0.4 * s.w);
    if (s.stick && t > T.blast + 0.3) { const ms = mascotPose(t); const loc = [(hash(i * 3.3) - 0.5) * 1.2, 1.29, (hash(i * 7.1) - 0.5) * 0.9]; const q = toWorld(loc, ms);
      const blow = t > T.sneeze1 ? clamp((t - T.sneeze1) / 0.6) : 0; p = add(q, [0, blow * 2.5, -blow * 3.5 * (0.5 + s.w)]); g = blow < 1 ? 0.8 : 0; }
    p[1] = Math.max(p[1], 0.08); const cp = camAt(t).pos; if (Math.hypot(p[0] - cp[0], p[1] - cp[1], p[2] - cp[2]) < 4.0) g = 0;   // never right in the lens
    out.push(...p, g); }
  return out; }
export const NDROP = 46;
const WD = []; for (let i = 0; i < NDROP; i++) { const a = hash(i * 2.13) * 2 * PI, r = WEB.R * (0.2 + 0.8 * Math.sqrt(hash(i * 5.7))); WD.push({ o: [WEB.c[0] + Math.cos(a) * r, WEB.c[1] + Math.sin(a) * r, WEB.c[2]], s: 0.05 + 0.08 * hash(i * 8.8), v: [Math.cos(a) * (1 + 3 * hash(i)), 1.5 + 3 * hash(i * 3.3), -(6 + 6 * hash(i * 4.4))] }); }
export const DROPS = WD.map((d) => [...d.o, d.s]);
export function drops(t0) { const t = q3(t0); const out = [];
  for (const d of WD) { const age = t - T.hit; if (age < 0) { out.push(...d.o, 1); continue; } const p = [d.o[0] + d.v[0] * age, d.o[1] + d.v[1] * age - 14 * age * age, d.o[2] + d.v[2] * age]; out.push(...p, age < 1.2 ? 1 : 0); }
  return out; }
export const NST = 10;
function strandPts(t, which) { // web strands after the hit: [0] the long one from the nose (the rope later), [1], [2] over the left wing
  if (t < T.hit || (which === 0 && t > T.push) || (which > 0 && t > T.liftE)) return Array.from({ length: NST }, () => [0, -60, 0]);
  const P = planeRaw(t); const W = wings(t); const pts = [];
  const air = t < T.impact2; const ca = Math.cos(W.L * D2R), sa = Math.sin(W.L * D2R);
  if (which === 0) {
    const a = L2W(P.O, P.F, [0.15, 0.05, 2.45]);
    if (t >= T.rope && t < T.ropeOff + 0.1) { const ms = mascotPose(t); const hand = toWorld(armLocal([0.4, 0, 0], 1, ms.arms[1][0], ms.arms[1][1]), ms);
      for (let i = 0; i < NST; i++) { const u = i / (NST - 1); const sag = (t < T.tow ? 0.6 : 0.12) * Math.sin(u * PI); pts.push([lerp(a[0], hand[0], u), lerp(a[1], hand[1], u) - sag, lerp(a[2], hand[2], u)]); } return pts; }
    if (air) { for (let i = 0; i < NST; i++) { const u = i / (NST - 1); const l = [0.15 + 0.3 * u + 0.2 * Math.sin(t * 9 + u * 5) * u, 0.05 - 0.3 * u + 0.15 * Math.sin(t * 7 + u * 4) * u, 2.45 - 4.6 * u]; pts.push(L2W(P.O, P.F, l)); } return pts; }
    // on the ground: lying from the nose ahead (or where it was dropped)
    const end = t < T.rope ? add(a, scl(TD, 3.5)) : (() => { const ms = mascotPose(T.ropeOff); const h = toWorld([0.9, 0.6, 0], ms); return h; })();
    for (let i = 0; i < NST; i++) { const u = i / (NST - 1); const x = lerp(a[0], end[0], u), z = lerp(a[2], end[2], u); pts.push([x, Math.max(lerp(a[1], end[1], u), terrain(x, z) + 0.04) - 0.15 * Math.sin(u * PI), z]); }
    return pts;
  }
  const z0 = which === 1 ? 1.4 : 0.3; const r0 = which === 1 ? 0.6 : 1.1;
  for (let i = 0; i < NST; i++) { const u = i / (NST - 1); const x = r0 + 0.4 * u; const fl = air ? 0.12 * Math.sin(t * 11 + u * 6 + which) * u : 0;
    pts.push(L2W(P.O, P.F, [x * ca, 0.13 + x * sa + 0.02 + fl - (u > 0.7 && air ? (u - 0.7) * 1.2 : 0), z0 - 2.4 * u])); }
  return pts;
}
// ---- light and values --------------------------------------------------------------------------------------------------------------------------------------------------
export function values(t) {
  const e = sunE(t); const sd = sunDir(t);
  const wB = clamp(1 - Math.abs(e - 2) / 8), wA = e > 2 ? clamp((e - 2) / 8) : 0; const tot = wA + wB || 1;
  const sunStr = 2.2 / Math.max(Math.sin(Math.max(e, 0) * D2R), 0.036) * clamp((e + 0.6) / 0.9);
  const W = wings(t); const P = planeRaw(t);
  // the wind: the gust front (z), its strength, the everyday breeze; on the top it is dead calm, then the updraft
  const gz = 60 - (t - 12.6) * 26; const ga = t < 12.6 ? 0 : t < 16.5 ? 1 : Math.max(0, 1 - (t - 16.5) / 2);
  let breeze = 0.35; if (t > 55.2 && t < T.push) breeze = 0.04; if (t > T.edge) breeze = 0.5;
  const steam = t < T.light ? 0 : t < 56.0 ? smooth((t - T.light) / 0.6) * (1 - smooth((t - 55.0) / 1.0)) : 0;
  const df = dragonfly(t);
  return { sunE: e, sunD: sd, sky: [wA / tot, wB / tot, 0, 0], night: 0, sunStr, wet: W.wet, steam, wind: [gz, ga, breeze],
    wingL: L2W(P.O, P.F, [1.0 * Math.cos(W.L * D2R), 0.12 + 1.0 * Math.sin(W.L * D2R), -0.6]),
    df, seed: [...seedS1(t), t < 4.0 ? 1 : 0], pol: pollen(t), drops: drops(t),
    st0: strandPts(t, 0).flat(), st1: strandPts(t, 1).flat(), st2: strandPts(t, 2).flat(), webOn: t < T.hit + 0.04 ? 1 : 0 };
}
export function objects(t) {
  const P = planeRaw(t); const W = wings(t); const o = {};
  o.plane = { p: P.O, r: eulerFrom(P.F.u, P.F.f) };
  o.wingL = { p: [0, 0, 0], r: [0, 0, W.L * D2R] }; o.wingR = { p: [0, 0, 0], r: [0, 0, -W.R * D2R] };
  const d = dragonfly(t); const f = [Math.sin(d[3]) * Math.cos(d[4]), -Math.sin(d[4]), Math.cos(d[3]) * Math.cos(d[4])]; const DF = frameOf(f, d[5]);
  o.dfly = { p: d.slice(0, 3), r: eulerFrom(DF.u, DF.f) };
  const sd = seedS1(t); o.seed1 = { p: sd, r: [0.25 * Math.sin(t * 1.7), t * 0.6, 0.2 * Math.cos(t * 1.3)], s: t < 4.0 ? 1 : 0.001 };
  return o;
}
// ---- the camera -----------------------------------------------------------------------------------------------------------------------------------------------------------
const C_ = (t) => t + 0.001;
function O(t, tgt, dist, az, el, fov, follow = 0) { const a = az * PI / 180, e = el * PI / 180;
  return [t, tgt[0] + dist * Math.sin(a) * Math.cos(e), tgt[1] + dist * Math.sin(e), tgt[2] + dist * Math.cos(a) * Math.cos(e), tgt[0], tgt[1], tgt[2], fov, 8, follow]; }
const X_ = (t, pos, tgt, fov, follow = 0) => [t, ...pos, ...tgt, fov, 8, follow];
const hc = (t, dy = 0) => add(heroC(t), [0, dy, 0]);
// plane-relative keys: a camera point and aim in the plane's frame at time t (the spline then runs between them)
const PR = (t, lpos, ltgt, fov, follow = 0) => { const P = planeRaw(t); return [t, ...L2W(P.O, P.F, lpos), ...L2W(P.O, P.F, ltgt), fov, 8, follow]; };
// a run of plane-relative keys every 0.2 s from (t0, a) to (t1, b): the camera rides with the plane through its turns
const PRS = (t0, t1, a, b, cut = true) => { const out = []; const n = Math.max(1, Math.round((t1 - t0) / 0.2));
  for (let i = 0; i <= n; i++) { const u = i / n; const tt = (i === 0 && cut) ? C_(t0) : t0 + (t1 - t0) * u; const m = (j) => a[j].map((v, k) => lerp(v, b[j][k], EASE.smooth(u)));
    out.push(PR(tt, m(0), m(1), lerp(a[2], b[2], u), lerp(a[3] ?? 0, b[3] ?? 0, u))); } return out; };
const camKeys = () => {
  const K = [];
  // S1: in front of it, low: the hero on the pebble against the sun, arms out; the jump and the flop toward us
  K.push(O(0.0, [-1.4, 2.2, 0.8], 9.0, 168, 3, 34), O(1.6, [-1.2, 2.2, 0.4], 8.4, 172, 4, 34), O(2.6, [-0.6, 1.4, -0.6], 9.2, 176, 5, 36));
  // S2: further ahead, at ground level: the plane comes out of the sun over the flopped hero and slams in near us; the blast; then closer on it
  K.push(X_(C_(2.6), [1.0, 1.1, -14.0], [0.6, 2.2, 0.5], 40), X_(3.3, [1.1, 1.2, -14.4], [0.8, 2.0, 0.5], 40), X_(C_(4.4), [8.4, 2.8, -2.4], [1.9, 1.0, 2.6], 36), X_(6.4, [8.6, 2.9, -2.2], [1.7, 1.3, 1.8], 36));
  // S3: front-left: under the wing, the hang, the drop; then closer for the flapping comparison and the hop in
  K.push(O(C_(6.4), [0.7, 1.7, -1.4], 9.5, 205, 7, 34), O(8.9, [0.7, 1.5, -1.8], 9.0, 210, 6, 34), O(C_(8.9), [0.6, 1.2, -1.6], 9.6, 200, 9, 32, 0.4), O(10.9, [1.4, 1.4, -2.6], 9.8, 206, 10, 34, 0.45));
  // S4: ahead of the plane, looking back at it in the fold; the meadow, the sun and the gust wave behind it
  K.push(X_(C_(10.9), [3.6, 2.6, -12.5], [2.2, 1.8, -3.4], 34), X_(13.0, [3.4, 2.4, -11.8], [2.2, 1.8, -3.4], 32), X_(14.5, [3.3, 2.5, -11.4], [2.2, 1.9, -3.6], 32));
  // S5: ahead and beside as it rises, then pulling up and away: the meadow, the sun, the cloud towers
  K.push(...PRS(14.5, 16.0, [[-6.5, 1.2, 4.0], [0, 0.8, -0.5], 38], [[-7.0, 1.0, 3.0], [0, 0.9, -0.5], 36]), ...PRS(16.0, 19.6, [[-7.0, 1.0, 3.0], [0, 0.9, -0.5], 36], [[-12, 4.5, 14], [0, 1.0, -4], 42], false).slice(1));
  // S6: low ahead of it through the slalom, the stalks whipping past behind; cut to the other side
  K.push(...PRS(19.6, 23.0, [[-4.6, 0.9, 5.0], [0, 1.3, 0], 36], [[-4.8, 0.8, 4.6], [0, 1.3, 0], 36]), ...PRS(23.0, 26.0, [[4.6, 0.9, 5.0], [0, 1.3, 0], 36], [[4.8, 1.0, 4.6], [0, 1.3, 0], 36]));
  // S7: ahead on the dragonfly's side, then straight ahead for the dart
  K.push(...PRS(26.0, 28.6, [[7.0, 1.9, 5.2], [1.6, 1.4, 0], 36], [[7.2, 1.7, 4.6], [1.6, 1.4, 0], 36]), ...PRS(28.6, 30.6, [[1.2, 1.6, 9.0], [0, 1.2, 0], 40], [[-1.0, 1.4, 8.6], [0, 1.2, 0], 40]));
  // S8: behind and above: it faces us waving, the web glitters ahead; then side-on for the hit
  K.push(...PRS(30.6, 32.5, [[0.8, 3.4, -7.5], [0, 1.0, 3.5], 38], [[0.6, 3.0, -6.8], [0, 1.0, 4.0], 38]), X_(C_(32.5), [8.5, 7.4, -110.0], [0, 6.0, -117.5], 36), X_(34.2, [8.2, 7.2, -112.5], [-0.8, 5.6, -122.5], 38));
  // S9: ahead of the spiral, then from above as the grass rushes up
  K.push(...PRS(34.2, 37.4, [[3.5, 2.0, 6.5], [0, 0.7, 0], 40], [[4.0, 2.5, 6.5], [0, 0.5, 0], 40]), X_(C_(37.4), [-14, 12.0, -128], [-20, 2.4, -135], 44), X_(40.6, [-30, 9.5, -136], [-45, 0.8, -145], 40));
  return K;
};
const camKeys2 = () => {
  const K = []; const g = (s) => towP(s); const L = [TD[2], 0, -TD[0]];
  const up = (p, dy) => [p[0], p[1] + dy, p[2]];
  const TOPY = terrain(MD.cx, MD.cz);
  // S10: beside, low, in the lilac shade: thrown out, dizzy, up; over the plane at it beside the wet wing, the poke; behind it, the tilt up to the gold on the top
  K.push(X_(C_(40.6), add(up(g(3.0), 4.6), scl(L, 6.8)), up(g(4.4), 0.9), 34), X_(43.2, add(up(g(3.2), 4.2), scl(L, 6.6)), up(g(4.2), 1.0), 34),
    X_(C_(43.2), add(up(g(-3.6), 3.6), scl(L, -2.6)), add(up(g(0.8), 1.0), scl(L, 3.0)), 34), X_(45.3, add(up(g(-3.8), 3.5), scl(L, -2.6)), add(up(g(0.8), 1.1), scl(L, 3.0)), 34),
    X_(C_(45.3), add(up(g(-7.0), 1.6), scl(L, 2.2)), up(g(8.0), 2.2), 38), X_(46.0, add(up(g(-7.0), 1.5), scl(L, 2.2)), up(g(28), 9.0), 46));
  // S11a: side-on along the slope, low; the tow and the slip
  K.push(X_(C_(46.0), add(up(g(10.5), 3.8), scl(L, -6.0)), up(g(5.5), 1.2), 36, 0.5), X_(49.6, add(up(g(17.5), 4.2), scl(L, -6.0)), up(g(11.0), 1.2), 36, 0.5));
  // S11b: near the top, from ahead: it climbs toward us out of the shade into the light, the slope falling away behind it
  K.push(X_(C_(49.6), add(up(g(TOP_S + 3.0), 4.8), scl(L, -3.5)), up(g(26), 1.0), 36, 0.7), X_(53.4, add(up(g(TOP_S + 5.0), 4.6), scl(L, -4.2)), up(g(TOP_S - 1), 1.2), 36, 0.7));
  // S12: the hero shot on the top: from behind it into the huge sun; then from the front-left as it lifts the wing and tests the air
  K.push(X_(C_(53.4), add(up(g(TOP_S - 11), 3.0), scl(L, 1.6)), up(g(TOP_S + 8), 1.4), 30), X_(54.4, add(up(g(TOP_S - 10.5), 2.8), scl(L, 1.6)), up(g(TOP_S + 8), 1.4), 28),
    X_(C_(54.4), add(up(g(TOP_S + 4.5), 2.6), scl(L, 7.5)), add(up(g(TOP_S - 2.0), 1.2), scl(L, 1.6)), 34, 0.25), X_(56.95, add(up(g(TOP_S + 4.2), 2.5), scl(L, 7.2)), add(up(g(TOP_S - 2.0), 1.3), scl(L, 1.4)), 34, 0.25));
  // S13: low behind the run, into the sun; at the edge it holds still: the plane goes over and drops out of frame, the empty sun, the rise
  K.push(X_(C_(56.95), add(up(g(TOP_S - 17), 3.4), scl(L, -3.5)), up(g(TOP_S - 2), 1.2), 34, 0.55), X_(59.5, add(up(g(TOP_S - 12), 3.4), scl(L, -3.8)), up(g(S_EDGE), 1.0), 34, 0.45));
  const E = g(S_EDGE - 2.8); const ahead = g(S_EDGE + 16);
  K.push(X_(C_(59.5), add([E[0], TOPY + 1.9, E[2]], scl(L, 6.8)), [ahead[0], TOPY - 2.0, ahead[2]], 40), X_(61.5, add([E[0], TOPY + 1.9, E[2]], scl(L, 6.8)), [ahead[0], TOPY - 1.6, ahead[2]], 40), X_(63.0, add([E[0], TOPY + 2.0, E[2]], scl(L, 6.8)), [ahead[0], TOPY + 2.4, ahead[2]], 40));
  return K;
};
const camKeys3 = () => {
  const K = [];
  // S14: the long lens: the plane against the huge sun, the hero walking to the nose, arms out; the dragonfly joins
  // the camera on the line from the sun through the plane (a touch higher, so the plane sits just under the sun's centre)
  const sil = (t, d, up_, fov) => { const P = planeRaw(t); const sd = sunDir(t); const c = add(sub(P.O, scl(sd, d)), [0, up_, 0]); return [t, ...c, ...add(P.O, [0, 0.4, 0]), fov, 8, 0]; };
  K.push(sil(C_(63.0), 48, 0.6, 17), sil(65.5, 46, 0.5, 16.5), sil(68.4, 44, 0.45, 16));
  // S15: close beside it, ahead, for the sneeze
  K.push(...PRS(68.4, DUR, [[-5.8, 2.2, 6.4], [0, 1.6, 1.3], 32], [[-5.4, 2.1, 6.8], [0, 1.6, 1.3], 32]));
  return K;
};
export const CAM = [...camKeys(), ...camKeys2(), ...camKeys3()];
// camTrack (common.mjs) uses half-length tangents: fine between sparse keys (a soft ease), but along the 0.2 s plane-relative runs it slows at every
// key, a 5 Hz stutter of the whole frame. Here dense runs (keys under 0.3 s apart) get full Catmull-Rom tangents, so the camera glides with the plane.
function camTrackP(CAM, shakes = [], breathe = 1, followAt = null) {
  const cut = (i) => i >= 0 && i < CAM.length - 1 && CAM[i + 1][0] - CAM[i][0] < 0.02;
  return (t) => {
    let i = 0; for (let k = 0; k < CAM.length; k++) if (CAM[k][0] <= t) i = k;
    const k0 = CAM[i]; const k1 = cut(i) ? k0 : CAM[Math.min(CAM.length - 1, i + 1)]; const kp = cut(i - 1) ? k0 : CAM[Math.max(0, i - 1)]; const k2 = cut(i + 1) ? k1 : CAM[Math.min(CAM.length - 1, i + 2)];
    const h = Math.max(1e-6, k1[0] - k0[0]); const s = clamp((t - k0[0]) / h); const out = [];
    const g0 = (k0[0] - kp[0] < 0.3 && h < 0.3) ? 1 : 0.5, g1 = (k2[0] - k1[0] < 0.3 && h < 0.3) ? 1 : 0.5;
    for (let j = 1; j < 10; j++) { const v0 = k0[j] ?? 0, v1 = k1[j] ?? 0, vp = kp[j] ?? 0, v2 = k2[j] ?? 0;
      const m0 = i > 0 && kp !== k0 ? ((v1 - vp) / Math.max(1e-6, k1[0] - kp[0])) * h * g0 : 0; const m1 = k2 !== k1 ? ((v2 - v0) / Math.max(1e-6, k2[0] - k0[0])) * h * g1 : 0; const s2 = s * s; const s3 = s2 * s;
      out.push((2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * m1); }
    const w = clamp(out[8]); if (followAt && w > 0) { const f = followAt(t); for (let j = 0; j < 3; j++) out[3 + j] = lerp(out[3 + j], f[j], w); }
    out[3] += 0.04 * breathe * Math.sin(t * 1.3); out[4] += 0.03 * breathe * Math.sin(t * 1.7 + 1);
    let sh = 0; for (const [t0, a, d = 0.35] of shakes) { const dd = t - t0; if (dd > 0 && dd < d) sh = Math.max(sh, a * (1 - dd / d)); }
    out[3] += sh * Math.sin(t * 90); out[4] += sh * Math.sin(t * 77);
    return { pos: out.slice(0, 3), tgt: out.slice(3, 6), fov: out[6], fstop: out[7] };
  };
}
export const camAt = camTrackP(CAM, [[T.impact, 0.18, 0.4], [T.hit, 0.08, 0.3], [T.impact2, 0.14, 0.4]], 0.6, (t) => hc(t, 0.3));
export function events() { return { T, MD, EDGE, LOWY, DROP, PEBBLE, NOSE0, BUTTER, STEMS, WEB, PL, THS, NPOL, NDROP, NST, DROPS, TOW }; }
