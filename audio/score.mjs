// Paper Plane, the sound. All synthesized, no voice. A small anime score in D major built on one flight theme:
// a hopeful plucked motif when it tries to fly with its arms, a comic flop; the plane's whoosh and the pollen burst; a pizzicato sulk in the fold,
// the gust as a rising swell; the flight theme on strings, glass and electric piano; a running arp through the stalks; the dragonfly's buzz;
// a glassy shimmer for the web, the splash, a minor fall in the spiral; a dark pad in the shade; a stubborn ostinato up the mound; warmth in the
// light; silence for the empty edge, and the theme in full as it rises into the sunset. A sneeze and a laugh at the end.
//   node audio/score.mjs [out/music.wav]
import * as A from '../kit/synth/index.mjs';
import * as PL from '../js/plan.mjs';
const out = process.argv.slice(2).find((a) => a.endsWith('.wav')) || 'out/music.wav';
const { T, DUR } = PL; const B = 60 / 92;
A.init({ duration: DUR + 2.0, bpm: 92, seed: 4242 });
A.bus('music', { gain: -13, verb: 0.35 }); A.bus('pad', { gain: -17, verb: 0.5 }); A.bus('bass', { gain: -17 }); A.bus('drums', { gain: -20, verb: 0.12 }); A.bus('fx', { gain: -15, verb: 0.25 }); A.bus('amb', { gain: -27 });
const THEME = ['A4', 'D5', 'E5', 'F#5', 'A5', 'F#5', 'E5', 'D5', 'B4', 'D5'];          // the flight theme (its first 4 notes are the hopeful motif)
const theme = (t0, step, vel = 0.3, oct = 0, n = THEME.length, type = 'ep') => THEME.slice(0, n).forEach((x, i) => A.keys(t0 + i * step, step * 1.7, [A.note(x) + oct * 12], { type, vel, bus: 'music' }));
const rustle = (t, d, vel = 0.05, hz = 3200) => { const w = A.writer('fx', { verb: 0.05 }); const f = A.svf(); const i0 = A.at(t); for (let k = 0; k < d * A.SR; k++) { const s = k / A.SR; w(i0 + k, f(A.noise(), hz, 1.2).bp * vel * Math.sin(Math.PI * s / d)); } };
const gustS = (t, d, vel = 0.12) => { const w = A.writer('fx', { verb: 0.2 }); const f = A.svf(); const i0 = A.at(t); for (let k = 0; k < d * A.SR; k++) { const s = k / A.SR; const u = s / d; w(i0 + k, f(A.noise(), 300 + 1600 * Math.sin(Math.PI * u) ** 2, 0.7).bp * vel * Math.sin(Math.PI * u) ** 1.5); } };
// ---- 0-2.5: arms out on the pebble, the jump, the flapping, the flop ----------------------------------------------------------------------------------------------------
A.pad(0.0, 2.5, ['D3', 'A3', 'F#4'], { type: 'warm', vel: 0.3, bus: 'pad' });
['A4', 'D5', 'E5', 'F#5'].forEach((n, i) => A.pluck(0.2 + i * 0.28, n, { type: 'ks', dur: 0.5, vel: 0.22 }));
A.bell(1.1, 'A6', { vel: 0.07 });
for (let i = 0; i < 7; i++) A.pluck(T.jump + i * 0.1, ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6'][i], { type: 'ks', dur: 0.15, vel: 0.14 });
A.toneSweep(T.flop - 0.25, 0.3, { wave: 'sine', from: 'E6', to: 'A4', vel: 0.05 }); A.thud(T.flop, { f0: 140, vel: 0.12 }); A.boing(T.flop + 0.05, { f: 180, vel: 0.05 });
// ---- 2.5-6.4: the whoosh, the slam, the pollen, the sneeze --------------------------------------------------------------------------------------------------------------
A.riser(T.inbound - 0.4, T.impact, { vel: 0.07 }); A.whoosh(T.inbound + 0.2, 0.5, { vel: 0.12 });
A.thud(T.impact, { f0: 70, vel: 0.22 }); A.crash(T.impact, { vel: 0.08 }); A.sparkle(T.impact + 0.08, { vel: 0.09 });
for (let i = 0; i < 12; i++) A.bell(T.impact + 0.15 + i * 0.12 + A.between(0, 0.05), ['D7', 'A6', 'F#6', 'E7', 'B6'][i % 5], { vel: 0.035, dur: 0.8, pan: A.between(-0.7, 0.7) });
A.pad(T.onBack, 2.2, ['G3', 'B3', 'D4', 'F#4'], { type: 'air', vel: 0.22, bus: 'pad' });
A.toneSweep(T.sneeze1 - 0.3, 0.28, { wave: 'sine', from: 'D5', to: 'A5', vel: 0.03 }); A.tick(T.sneeze1, { bright: 2600, vel: 0.12 }); A.boing(T.sneeze1 + 0.02, { f: 340, vel: 0.04 });
A.pad(T.stare, 0.9, ['D3', 'A3', 'E4', 'B4'], { type: 'glass', vel: 0.2, bus: 'pad' }); A.bell(T.stare, 'B6', { vel: 0.06 });
// ---- 6.4-11: under the wing, the hang, the drop, the idea, the hop in ------------------------------------------------------------------------------------------------
for (let i = 0; i < 6; i++) A.pluck(T.walk1 + i * 0.18, ['D4', 'F#4', 'A4'][i % 3], { type: 'ks', dur: 0.2, vel: 0.1 });
A.pad(T.grab, T.unstick - T.grab, ['E3', 'G3', 'B3'], { type: 'dark', vel: 0.2, bus: 'pad' }); for (let t = T.grab; t < T.unstick; t += 0.2) A.pluck(t, 'E4', { type: 'ks', dur: 0.12, vel: 0.08 });
A.toneSweep(T.unstick, T.level - T.unstick, { wave: 'sine', from: 'B5', to: 'E4', vel: 0.04 }); A.thud(T.level, { f0: 110, vel: 0.16 }); A.thud(T.landH, { f0: 260, vel: 0.06 });
[0, 0.15, 0.3, 0.45].forEach((d, i) => A.pluck(T.flap + d, i % 2 ? 'A4' : 'D5', { type: 'ks', dur: 0.15, vel: 0.12 }));
A.pad(T.idea, 1.2, ['D4', 'F#4', 'A4', 'E5'], { type: 'glass', vel: 0.22, bus: 'pad' }); [0, 0.12, 0.24].forEach((d, i) => A.bell(T.idea + d, ['A6', 'D7', 'F#7'][i], { vel: 0.06 }));
A.boing(T.hopIn, { f: 420, vel: 0.03 }); A.thud(T.hopInE, { f0: 300, vel: 0.05 });
// ---- 11-14.5: come on!, the sulk; the gust rolls in -------------------------------------------------------------------------------------------------------------------
[0, 0.31, 0.62, 0.93].forEach((d, i) => A.pluck(T.rock + d, ['D4', 'A3'][i % 2], { type: 'ks', dur: 0.25, vel: 0.16, bus: 'bass' }));
[T.bounce1, T.bounce2].forEach((t) => { A.boing(t + 0.05, { f: 380, vel: 0.03 }); A.thud(t + 0.3, { f0: 200, vel: 0.05 }); });
A.keys(T.grump, 1.0, ['B3', 'D4', 'F4'].map(A.note), { type: 'ep', vel: 0.16 }); A.pluck(T.grump + 0.6, 'B2', { type: 'ks', dur: 0.4, vel: 0.14, bus: 'bass' });
gustS(12.6, 3.6, 0.13); rustle(12.9, 2.2, 0.05, 2400); A.riser(13.0, T.gust, { vel: 0.08 });
// ---- 14.5-20: the gust, the takeoff, the view opens -------------------------------------------------------------------------------------------------------------------
A.crash(T.gust, { vel: 0.1 }); A.whoosh(T.gust, 0.9, { vel: 0.12 });
A.pad(T.gust, 5.2, ['D2', 'A2', 'D3', 'F#3', 'A3'], { type: 'strings', vel: 0.28, bus: 'pad' }); A.sub(T.gust, 5.0, 'D1', { vel: 0.18, bus: 'bass' });
A.pad(T.awe, 3.6, ['D4', 'F#4', 'A4', 'E5'], { type: 'glass', vel: 0.22, bus: 'pad' });
theme(T.awe + 0.3, 0.36, 0.28, 0, 10, 'ep'); A.vox(T.standUp, 2.6, 'A4', { vowel: 'a', vel: 0.05, attack: 0.8, release: 1.2 });
// ---- 20-26: the slalom ----------------------------------------------------------------------------------------------------------------------------------------------------
A.arp(T.wide, 26.0, ['D4', 'F#4', 'A4', 'D5', 'E5'], { rate: 1 / 4, pattern: 'updown', vel: 0.15, bus: 'music' });
for (let t = T.wide; t < 26.0; t += B / 2) A.shaker(t, { vel: 0.1 });
for (let t = T.wide; t < 26.0; t += B) { A.kick(t, { vel: 0.22 }); A.sub(t, 0.3, ['D2', 'B1', 'G1', 'A1'][Math.floor((t - T.wide) / (B * 4)) % 4], { vel: 0.2, bus: 'bass' }); }
const CH = [['D3', 'A3', 'F#4'], ['B2', 'F#3', 'D4'], ['G2', 'D3', 'B3'], ['A2', 'E3', 'C#4']];
for (let i = 0, t = T.wide; t < 26.0; i++, t += B * 4) A.pad(t, B * 4, CH[i % 4], { type: 'strings', vel: 0.2, bus: 'pad' });
[T.leanL + 0.2, T.leanR + 0.25, T.leanL2 + 0.25].forEach((t) => A.whoosh(t, 0.4, { vel: 0.07 }));
// ---- 26-31: the dragonfly ------------------------------------------------------------------------------------------------------------------------------------------------
A.buzz(T.dfly + 0.2, { vel: 0.03 }); A.buzz(T.dflySide, { vel: 0.025 }); A.buzz(T.dflySide + 0.8, { vel: 0.02 });
A.pad(T.dfly, 2.6, ['G3', 'B3', 'D4', 'A4'], { type: 'warm', vel: 0.24, bus: 'pad' });
['B4', 'D5', 'B4', 'G5'].forEach((n, i) => A.pluck(T.wave1 + i * 0.25, n, { type: 'ks', dur: 0.3, vel: 0.16 }));
A.whoosh(T.dart + 0.1, 0.45, { vel: 0.12 }); A.tick(T.dart + 0.3, { bright: 3200, vel: 0.08 }); A.toneSweep(T.duck, 0.5, { wave: 'sine', from: 'A5', to: 'D5', vel: 0.04 });
A.pad(T.cling, T.recover - T.cling, ['E3', 'G3', 'A#3'], { type: 'dark', vel: 0.2, bus: 'pad' });
[0, 0.12, 0.24, 0.36].forEach((d, i) => A.bell(T.laugh + d, ['D6', 'F#6', 'A6', 'D7'][i], { vel: 0.06 })); A.pad(T.laugh, 1.6, ['D3', 'A3', 'F#4'], { type: 'warm', vel: 0.26, bus: 'pad' });
// ---- 31-33.1: waving back; the web glitters ahead; the hit ----------------------------------------------------------------------------------------------------------------
theme(T.turnBack + 0.2, 0.3, 0.2, 0, 4, 'ep');
A.pad(31.6, T.hit - 31.6, ['A4', 'E5', 'A5'], { type: 'glass', vel: 0.12, bus: 'pad' }); for (let i = 0; i < 8; i++) A.bell(31.7 + i * 0.17, ['E7', 'A6'][i % 2], { vel: 0.03 + i * 0.004, dur: 0.5 });
A.riser(32.0, T.hit, { vel: 0.06 });
A.crash(T.hit, { vel: 0.08 }); A.sparkle(T.hit, { vel: 0.12 }); for (let i = 0; i < 16; i++) A.bell(T.hit + 0.04 + i * 0.05 + A.between(0, 0.03), ['A7', 'E7', 'C#7', 'A6'][i % 4], { vel: 0.04, dur: 0.4, pan: A.between(-0.9, 0.9) });
// ---- 33-40: the wet wing, the spiral, the crash -----------------------------------------------------------------------------------------------------------------------
A.pad(34.0, 2.6, ['B2', 'F#3', 'D4'], { type: 'dark', vel: 0.26, bus: 'pad' }); A.keys(T.droop + 0.4, 1.0, ['B3', 'D4', 'F4'].map(A.note), { type: 'ep', vel: 0.16 });
A.downlifter(T.droopE - 0.4, T.impact2 - T.droopE + 0.4, { vel: 0.07 }); gustS(T.droopE, T.impact2 - T.droopE, 0.09);
for (let i = 0; i < 10; i++) A.pluck(T.droopE + i * 0.32, ['F#5', 'E5', 'D5', 'C#5', 'B4', 'A4', 'G4', 'F#4', 'E4', 'D4'][i], { type: 'ks', dur: 0.35, vel: 0.12 });
A.thud(T.impact2, { f0: 60, vel: 0.24 }); A.crash(T.impact2, { vel: 0.05 }); rustle(T.impact2, 0.7, 0.07, 2000); A.thud(T.thrownE, { f0: 240, vel: 0.06 });
// ---- 40-46: the shade -------------------------------------------------------------------------------------------------------------------------------------------------
A.pad(T.thrownE, T.lookUp2 - T.thrownE, ['B1', 'F#2', 'D3'], { type: 'dark', vel: 0.26, bus: 'pad' });
[[42.6, ['F#4']], [43.7, ['D4']], [T.sad, ['B3', 'D4']]].forEach(([t, n]) => A.keys(t, 1.2, n.map(A.note), { type: 'ep', vel: 0.12 }));
A.boing(T.poke + 0.05, { f: 160, vel: 0.04 });
A.pad(T.lookUp2 + 0.2, 1.6, ['D3', 'A3', 'E4', 'B4'], { type: 'air', vel: 0.24, bus: 'pad' }); A.bell(T.lookUp2 + 0.3, 'D7', { vel: 0.06 }); A.bell(T.lookUp2 + 0.55, 'A6', { vel: 0.05 });
// ---- 46-53: the tow up the mound --------------------------------------------------------------------------------------------------------------------------------------
for (let i = 0, t = T.tow; t < T.towE; i++, t += B) {
  const ch = [['B2', 'F#3', 'D4'], ['G2', 'D3', 'B3'], ['D3', 'A3', 'F#4'], ['A2', 'E3', 'C#4']][Math.floor(i / 2) % 4];
  for (let k = 0; k < 2; k++) A.pluck(t + k * B / 2, ch[(i + k) % 3], { type: 'ks', dur: 0.25, vel: 0.11 + i * 0.004, bus: 'music' });
  if (i % 2 === 0) A.pad(t, B * 2, ch, { type: 'strings', vel: 0.16 + i * 0.006, bus: 'pad' });
  A.tom(t, 48, { vel: 0.15 + i * 0.008 });
}
A.toneSweep(T.slip, T.slipE - T.slip, { wave: 'sine', from: 'D5', to: 'G4', vel: 0.04 }); rustle(T.slip, T.slipE - T.slip, 0.06);
A.pad(T.light, 2.4, ['D3', 'A3', 'D4', 'F#4', 'A4'], { type: 'warm', vel: 0.3, bus: 'pad' }); A.sparkle(T.light, { vel: 0.05 });
// ---- 53-57.7: the top, the steam, the wing, no wind ---------------------------------------------------------------------------------------------------------------------
A.pad(T.towE, 4.0, ['D4', 'F#4', 'A4', 'C#5'], { type: 'air', vel: 0.24, bus: 'pad' }); A.pad(T.towE, 4.0, ['D2', 'A2', 'D3'], { type: 'strings', vel: 0.2, bus: 'pad' });
rustle(T.light, 3.4, 0.025, 6000);    // the steam hissing softly
theme(T.turnSun + 0.2, 0.42, 0.2, 0, 4, 'ep');
A.thud(T.liftE, { f0: 300, vel: 0.04 }); A.bell(T.liftE + 0.05, 'F#6', { vel: 0.05 });
A.keys(T.test, 1.4, ['E4'].map(A.note), { type: 'ep', vel: 0.1 }); A.keys(T.testE, 0.8, ['C#4'].map(A.note), { type: 'ep', vel: 0.08 });
// ---- 57.7-61.6: the run, the leap, the empty edge ---------------------------------------------------------------------------------------------------------------------
A.arp(T.push, T.edge, ['D4', 'F#4', 'A4', 'D5'], { rate: 1 / 4, pattern: 'up', vel: 0.15, bus: 'music' });
for (let t = T.push, i = 0; t < T.edge; t += Math.max(0.12, 0.42 - i * 0.03), i++) { A.kick(t, { vel: 0.18 + i * 0.01 }); A.tick(t, { bright: 1500, dur: 0.03, vel: 0.04 }); }
A.riser(T.push + 0.3, T.leap, { vel: 0.1 }); A.pad(T.push, T.leap - T.push, ['A2', 'E3', 'A3', 'C#4'], { type: 'strings', vel: 0.24, bus: 'pad' });
A.whoosh(T.leap, 0.6, { vel: 0.1 }); A.toneSweep(T.land3, T.below - T.land3, { wave: 'sine', from: 'A5', to: 'A3', vel: 0.04 });
gustS(T.below - 0.2, T.rise3 - T.below + 0.6, 0.05);     // only the wind in the empty frame
// ---- 61.6-68.5: the rise, the theme in full ---------------------------------------------------------------------------------------------------------------------------
A.crash(T.rise3 + 0.1, { vel: 0.12 }); A.whoosh(T.rise3, 1.0, { vel: 0.12 });
A.pad(T.rise3, 7.0, ['D2', 'A2', 'D3', 'F#3', 'A3', 'E4'], { type: 'strings', vel: 0.34, bus: 'pad' }); A.sub(T.rise3, 6.8, 'D1', { vel: 0.2, bus: 'bass' });
A.pad(T.rise3 + 0.5, 6.5, ['D4', 'F#4', 'A4', 'C#5', 'E5'], { type: 'glass', vel: 0.22, bus: 'pad' });
theme(T.rise3 + 0.4, 0.45, 0.32, 0, 10, 'ep'); theme(T.rise3 + 0.4, 0.45, 0.14, 1, 10, 'ep');
A.vox(T.arms, 3.4, 'A4', { vowel: 'a', vel: 0.06, attack: 1.0, release: 1.4 }); A.vox(T.arms, 3.4, 'F#4', { vowel: 'a', vel: 0.05, attack: 1.0, release: 1.4 }); A.vox(T.arms, 3.4, 'D4', { vowel: 'o', vel: 0.04, attack: 1.0, release: 1.4 });
[0, 0.5, 1.1, 1.8].forEach((d, i) => A.bell(T.arms + d, ['A6', 'F#6', 'D6', 'A6'][i], { vel: 0.06 }));
A.buzz(T.dfly2 + 1.0, { vel: 0.02 });
// ---- 68.5-71.5: the sneeze, the laugh, the end ------------------------------------------------------------------------------------------------------------------------
A.pad(68.5, 1.3, ['G3', 'B3', 'D4', 'F#4'], { type: 'air', vel: 0.2, bus: 'pad' });
A.toneSweep(T.twitch, 0.3, { wave: 'sine', from: 'D5', to: 'E5', vel: 0.025 }); A.toneSweep(T.sneeze - 0.3, 0.3, { wave: 'sine', from: 'D5', to: 'B5', vel: 0.035 });
A.tick(T.sneeze, { bright: 2400, vel: 0.14 }); A.boing(T.sneeze + 0.02, { f: 300, vel: 0.05 }); A.thud(T.sneeze + 0.05, { f0: 180, vel: 0.06 });
[0, 0.12, 0.24, 0.36, 0.5].forEach((d, i) => A.bell(T.laugh2 + d, ['D6', 'F#6', 'A6', 'D7', 'F#7'][i], { vel: 0.06 }));
A.keys(T.laugh2 + 0.1, 1.8, ['D4', 'F#4', 'A4', 'D5'].map(A.note), { type: 'ep', vel: 0.24 }); A.pad(T.laugh2, 1.8, ['D3', 'A3', 'F#4'], { type: 'warm', vel: 0.28, bus: 'pad' });
// ---- the meadow: a breeze all through, louder in the gust and up high ---------------------------------------------------------------------------------------------------
{ const w = A.writer('amb', { verb: 0.2 }); const f = A.svf(); const n = (DUR + 2.0) * A.SR;
  for (let k = 0; k < n; k++) { const s = k / A.SR; const up = (s > T.gust && s < T.impact2) || s > T.rise3 ? 1.6 : 1.0; const calm = s > 55.2 && s < T.push ? 0.3 : 1.0; w(k, f(A.noise(), 650, 0.3).bp * 0.05 * up * calm); } }
A.render(out, { lufs: -17, truePeak: -3.2, reverb: 'hall' });
