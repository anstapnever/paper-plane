// Bakes a plan (project/js/plan.mjs, three.js convention, cm) to per-frame JSON for Blender: out/bake.json.
//   node kit/bake.mjs <project dir>
import { pathToFileURL } from 'url'; import fs from 'fs'; import path from 'path';
const proj = path.resolve(process.argv[2] || '.');
const PL = await import(pathToFileURL(path.join(proj, 'js', 'plan.mjs')).href);
const FPS = PL.FPS || 60; const n = Math.round(PL.DUR * FPS);
const out = { fps: FPS, n, mascots: {}, faces: {}, faceSeq: {}, cam: [], objs: {}, vals: {} };
const uniq = new Map(); const r = (v, k = 5) => +(+v).toFixed(k);
const faceKey = (f) => JSON.stringify(Object.keys(f).sort().filter((k) => k !== 't' || f.eyes === 'spiral' || f.tears || f.spin).map((k) => [k, typeof f[k] === 'number' ? +f[k].toFixed(2) : f[k]]));
for (let i = 0; i < n; i++) {
  const t = i / FPS;
  const ms = PL.mascots ? PL.mascots(t) : { M: PL.mascotPose(t) };
  for (const [name, p] of Object.entries(ms)) {
    const a = p.arms || [[0, 0], [0, 0]]; const l = p.legs || [0, 0, 0, 0];
    (out.mascots[name] ||= []).push([p.pos[0], p.pos[1], p.pos[2], p.yaw || 0, p.tilt || 0, p.pitch || 0, p.sx ?? 1, p.sy ?? 1, p.sz ?? p.sx ?? 1, a[0][0], a[0][1], a[1][0], a[1][1], ...l].map((v) => r(v)));
    const f = { ...(p.face || { eyes: 'open', mouth: 'smile' }) }; if (f.t !== undefined) f.t = +(+f.t).toFixed(2);
    const k = faceKey(f); if (!uniq.has(k)) { const id = 'u' + String(uniq.size).padStart(4, '0'); uniq.set(k, id); out.faces[id] = f; }
    (out.faceSeq[name] ||= []).push(uniq.get(k));
  }
  const c = PL.camAt(t); out.cam.push([...c.pos, ...c.tgt, c.fov, c.fstop ?? 2.8, c.roll || 0, c.focus ?? -1].map((v) => r(v)));
  const objs = PL.objects ? PL.objects(t) : {};
  for (const [name, o] of Object.entries(objs)) { const p = o.p || [0, 0, 0]; const ro = o.r || [0, 0, 0]; const s = typeof o.s === 'number' ? [o.s, o.s, o.s] : (o.s || [1, 1, 1]); (out.objs[name] ||= []).push([...p, ...ro, ...s, o.vis === false ? 0 : 1].map((v) => r(v))); }
  const vals = PL.values ? PL.values(t) : {};
  for (const [k, v] of Object.entries(vals)) (out.vals[k] ||= []).push(Array.isArray(v) ? v.map((x) => r(x)) : r(v));
}
fs.mkdirSync(path.join(proj, 'out'), { recursive: true });
fs.writeFileSync(path.join(proj, 'out', 'bake.json'), JSON.stringify(out));
if (PL.events) fs.writeFileSync(path.join(proj, 'out', 'events.json'), JSON.stringify(PL.events()));
console.log('baked', n, 'frames,', uniq.size, 'faces, objects:', Object.keys(out.objs).length, 'values:', Object.keys(out.vals).join(' '));
