// Face drawing for export (Blender textures): the v2 face, standalone.
const FACE_W = 1.04; const FACE_H = 0.74; export const CW = 1024; export const CH = Math.round(CW * FACE_H / FACE_W);
// ---- drawing the face (v2 style) ----------------------------------------------------------------------------------------------------------------------
const INK = '#1a0f0c';
const mx = (x) => CW / 2 + x * (CW / FACE_W); const my = (y) => CH / 2 - y * (CH / FACE_H); const ms = (s) => s * (CW / FACE_W);
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const EX = 0.2; const EY = 0.05; const FK = 1.5; // eye centres, face scale
export function drawFace(g, f) {
  g.clearRect(0, 0, CW, CH);
  // v2.1 (25.10): the whole face 1.5x bigger, closer to the official mascot's proportions
  g.save(); g.translate(CW / 2, CH / 2); g.scale(FK, FK); g.translate(-CW / 2, -CH / 2);
  const eyes = f.eyes || 'open'; const [lx, ly] = f.look || [0, 0]; const lid = f.lid || 0; const sq = f.squeeze || 0;
  // blush: always a little, more when happy or shy
  const bl = f.noblush ? 0 : 0.35 + 0.65 * (f.blush || 0);
  if (f.anime) { // anime (03.11): blush as a soft patch plus pen hatching, drawn here; the round glow below is skipped
    for (const sx of [-1, 1]) { const x = mx(sx * 0.29), y = my(-0.07); g.save(); g.translate(x, y); g.scale(1, 0.5); const gr = g.createRadialGradient(0, 0, 0, 0, 0, ms(0.09)); gr.addColorStop(0, `rgba(255,128,150,${0.55 * bl})`); gr.addColorStop(1, 'rgba(255,128,150,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, ms(0.09), 0, Math.PI * 2); g.fill(); g.restore();
      g.save(); g.strokeStyle = `rgba(214,70,96,${0.85 * bl})`; g.lineWidth = ms(0.009); g.lineCap = 'round'; for (let k = 0; k < 4; k++) { const hx = x + (k - 1.5) * ms(0.026); g.beginPath(); g.moveTo(hx + ms(0.012), y - ms(0.022)); g.lineTo(hx - ms(0.012), y + ms(0.022)); g.stroke(); } g.restore(); } }
  if (!f.anime) for (const sx of [-1, 1]) { const x = mx(sx * 0.27), y = my(-0.08); g.save(); g.translate(x, y); g.scale(1, 0.55); const gr = g.createRadialGradient(0, 0, 0, 0, 0, ms(0.085)); gr.addColorStop(0, `rgba(255,120,135,${0.75 * bl})`); gr.addColorStop(0.6, `rgba(255,120,135,${0.45 * bl})`); gr.addColorStop(1, 'rgba(255,120,135,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, ms(0.085), 0, Math.PI * 2); g.fill(); g.restore(); }
  g.fillStyle = INK; g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
  if (eyes === 'cyclops') { // Jogo's one huge eye: white, a heavy outline, a tiny red pupil; 'wide' shrinks the pupil, 'lid' narrows it, 'spin' = overloaded
    const cx = mx(lx * 0.03); const cy = my(EY + 0.02 + ly * 0.02); const R = ms(0.15) * (f.wide ? 1.12 : 1); const lidv = f.lid || 0; const ry = R * 0.86 * (1 - lidv * 0.7);
    g.save(); g.translate(cx, cy); g.fillStyle = '#f7f4ee'; g.beginPath(); g.ellipse(0, 0, R, ry, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.ellipse(0, 0, R, ry, 0, 0, Math.PI * 2); g.clip();
    const sh = g.createLinearGradient(0, -ry, 0, ry); sh.addColorStop(0, 'rgba(120,110,130,0.45)'); sh.addColorStop(0.35, 'rgba(120,110,130,0)'); g.fillStyle = sh; g.fillRect(-R, -ry, 2 * R, 2 * ry);
    if (f.spin) { g.strokeStyle = 'rgba(60,40,90,0.85)'; g.lineWidth = ms(0.007); for (let k = 0; k < 3; k++) { g.beginPath(); for (let i = 0; i < 80; i++) { const a = i * 0.3 + (f.t || 0) * (9 + k * 3) + k * 2; const r = i * ms(0.0018); g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.86); } g.stroke(); } }
    else { const pr = R * (f.wide ? 0.06 : 0.09); const px = lx * R * 0.4, py = -ly * ry * 0.35; g.fillStyle = '#c4161c'; g.beginPath(); g.arc(px, py, pr * 1.8, 0, Math.PI * 2); g.fill(); g.fillStyle = '#5a0408'; g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px - pr * 0.7, py - pr * 0.7, pr * 0.45, 0, Math.PI * 2); g.fill(); }
    g.restore();
    g.lineWidth = ms(0.014); g.strokeStyle = INK; g.beginPath(); g.ellipse(0, 0, R, ry, 0, 0, Math.PI * 2); g.stroke();
    g.lineWidth = ms(0.008); for (const k of [1.12, 1.24]) { g.beginPath(); g.ellipse(0, 0, R * k, ry * (k + 0.06), 0, Math.PI * 1.12, Math.PI * 1.88); g.stroke(); } // the heavy lid folds
    if (f.brow === 'angry') { g.lineWidth = ms(0.02); g.beginPath(); g.moveTo(-R * 1.05, -ry * 1.45); g.quadraticCurveTo(0, -ry * 0.95, R * 1.05, -ry * 1.45); g.stroke(); }
    g.restore(); }
  for (const sx of (eyes === 'cyclops' ? [] : [-1, 1])) {
    const cx = mx(sx * EX + lx * 0.035); const cy = my(EY + ly * 0.03); const w = ms(0.072); const h = ms(0.13) * (1 - sq * 0.5);
    g.save(); g.translate(cx, cy);
    if (eyes === 'anime' || eyes === 'animeWide') {
      const k = eyes === 'animeWide' ? 1.12 : 1; const ww = w * 1.42 * k, hh0 = h * 1.18 * k; const hh = Math.max(ms(0.014), hh0 * (1 - lid * 0.9)); const ix = lx * ww * 0.12, iy = -ly * hh * 0.1;
      g.save(); g.beginPath(); g.ellipse(0, 0, ww / 2, hh / 2, 0, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#fbf7f2'; g.fillRect(-ww, -hh, 2 * ww, 2 * hh);
      const ir = g.createLinearGradient(0, -hh / 2, 0, hh / 2); ir.addColorStop(0, '#120709'); ir.addColorStop(0.42, '#3b1712'); ir.addColorStop(0.78, '#a8522c'); ir.addColorStop(1, '#f0a35e');
      g.fillStyle = ir; g.beginPath(); g.ellipse(ix, iy + hh * 0.03, ww * 0.44, hh * 0.47, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(8,3,4,0.92)'; g.beginPath(); g.ellipse(ix, iy - hh * 0.02, ww * 0.2, hh * 0.24, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,214,150,0.55)'; g.lineWidth = ms(0.006); g.beginPath(); g.ellipse(ix, iy + hh * 0.08, ww * 0.3, hh * 0.3, 0, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
      const sh = g.createLinearGradient(0, -hh / 2, 0, -hh * 0.05); sh.addColorStop(0, 'rgba(40,20,60,0.55)'); sh.addColorStop(1, 'rgba(40,20,60,0)'); g.fillStyle = sh; g.fillRect(-ww, -hh, 2 * ww, hh);
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(ix - ww * 0.13, iy - hh * 0.17, ww * 0.17, hh * 0.15, -0.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(ix + ww * 0.16, iy + hh * 0.2, ww * 0.075, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(190,230,255,0.75)'; g.beginPath(); g.ellipse(ix - ww * 0.05, iy + hh * 0.33, ww * 0.16, hh * 0.05, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = ms(0.024); g.beginPath(); g.ellipse(0, 0, ww / 2 + ms(0.004), hh / 2 + ms(0.004), 0, Math.PI * 1.06, Math.PI * 1.94); g.stroke();
      g.beginPath(); g.moveTo(sx * ww * 0.47, -hh * 0.2); g.quadraticCurveTo(sx * ww * 0.62, -hh * 0.3, sx * ww * 0.7, -hh * 0.42); g.lineTo(sx * ww * 0.6, -hh * 0.18); g.closePath(); g.fill();
      g.lineWidth = ms(0.009); g.beginPath(); g.ellipse(0, 0, ww / 2, hh / 2, 0, Math.PI * 0.22, Math.PI * 0.78); g.stroke();
      const sp = (x, y, r) => { g.fillStyle = '#ffffff'; g.beginPath(); for (let i = 0; i < 8; i++) { const a2 = (i / 8) * Math.PI * 2; const rr2 = i % 2 ? r * 0.22 : r; g.lineTo(x + Math.cos(a2) * rr2, y + Math.sin(a2) * rr2); } g.closePath(); g.fill(); };
      if (eyes === 'animeWide' || (f.sparkle || 0) > 0) sp(ix + ww * 0.24, iy - hh * 0.3, ms(0.022));
      g.fillStyle = INK;
    } else
    if (eyes === 'open' || eyes === 'wide' || eyes === 'dot' || eyes === 'angry' || eyes === 'sad') {
      const k = eyes === 'wide' ? 1.3 : eyes === 'dot' ? 0.62 : 1; const ww = w * k * (eyes === 'wide' ? 1.15 : 1); let hh = h * k * (eyes === 'dot' ? 0.62 : 1); hh = Math.max(ms(0.012), hh * (1 - lid * 0.92));
      // v2.2 (28.10): a living eye. The same pill, but a warm iris glow at the bottom, a big catchlight and a small one; angry and sad cut the lid
      g.save();
      if (eyes === 'angry' || eyes === 'sad') { const a = eyes === 'angry' ? 1 : -1; const yi = -hh * (a > 0 ? 0.02 : 0.5), yo = -hh * (a > 0 ? 0.5 : 0.08); // inner end, outer end of the lid line
        g.beginPath(); g.moveTo(-sx * ww, yi - (yo - yi) * 0.5); g.lineTo(sx * ww, yo + (yo - yi) * 0.5); g.lineTo(sx * ww, hh); g.lineTo(-sx * ww, hh); g.closePath(); g.clip(); }
      rr(g, -ww / 2, -hh / 2, ww, hh, Math.min(ww, hh) * 0.45); g.clip();
      const eg = g.createLinearGradient(0, -hh / 2, 0, hh / 2); eg.addColorStop(0, '#0d0605'); eg.addColorStop(0.55, '#1c0e0a'); eg.addColorStop(1, '#3b2117'); g.fillStyle = eg; g.fillRect(-ww, -hh, 2 * ww, 2 * hh);
      const ir = g.createRadialGradient(lx * ww * 0.1, hh * 0.32, 0, lx * ww * 0.1, hh * 0.32, ww * 0.55); ir.addColorStop(0, 'rgba(196,112,74,0.75)'); ir.addColorStop(1, 'rgba(196,112,74,0)'); g.fillStyle = ir; g.fillRect(-ww, -hh, 2 * ww, 2 * hh);
      const hk = eyes === 'dot' ? 0.8 : eyes === 'wide' ? 1.15 : 1; g.fillStyle = 'rgba(255,255,255,0.96)'; if (eyes === 'angry' || eyes === 'sad') g.translate(0, hh * 0.14);
      g.beginPath(); g.ellipse(-ww * 0.16, -hh * 0.2, ww * 0.21 * hk, ww * 0.25 * hk, -0.35, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(ww * 0.19, hh * 0.22, ww * 0.085 * hk, 0, Math.PI * 2); g.fill();
      if (eyes === 'wide' || eyes === 'sad') { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(ww * 0.12, -hh * 0.3, ww * 0.05, 0, Math.PI * 2); g.fill(); }
      if (eyes === 'sad') { g.fillStyle = 'rgba(170,215,255,0.35)'; g.fillRect(-ww, hh * 0.18, 2 * ww, hh); } // a wet line at the bottom
      g.restore(); g.fillStyle = INK;
      if (eyes === 'angry' || eyes === 'sad') { const a = eyes === 'angry' ? 1 : -1; const yi = -hh * (a > 0 ? 0.02 : 0.5), yo = -hh * (a > 0 ? 0.5 : 0.08); g.lineWidth = ms(0.016); g.beginPath(); g.moveTo(-sx * ww * 0.62, yi + (yi - yo) * 0.12); g.lineTo(sx * ww * 0.62, yo - (yi - yo) * 0.12); g.stroke(); }
    } else if (eyes === 'six') { // the Six Eyes, mascot style: the same pill eye, filled ice-blue to deep blue, a soft glow, 2 highlights
      const ww = w * 1.12, hh = h * 1.02 * (1 - lid * 0.85); const gl = g.createRadialGradient(0, 0, ww * 0.3, 0, 0, ww * 1.5); gl.addColorStop(0, 'rgba(110,220,255,0.35)'); gl.addColorStop(1, 'rgba(110,220,255,0)'); g.fillStyle = gl; g.beginPath(); g.arc(0, 0, ww * 1.5, 0, Math.PI * 2); g.fill();
      const ig = g.createLinearGradient(0, -hh / 2, 0, hh / 2); ig.addColorStop(0, '#d9fbff'); ig.addColorStop(0.3, '#5fe0ff'); ig.addColorStop(0.75, '#159ee8'); ig.addColorStop(1, '#0a4fa8'); g.fillStyle = ig;
      rr(g, -ww / 2, -hh / 2, ww, hh, Math.min(ww, hh) * 0.45); g.fill(); g.lineWidth = ms(0.008); g.strokeStyle = '#06305e'; g.stroke(); g.strokeStyle = INK;
      g.fillStyle = 'rgba(4,40,90,0.85)'; g.beginPath(); g.ellipse(lx * ww * 0.12, hh * 0.05, ww * 0.16, Math.min(hh * 0.22, ww * 0.3), 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(-ww * 0.16, -hh * 0.22, ww * 0.16, hh * 0.1, -0.3, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(ww * 0.18, hh * 0.2, ww * 0.07, 0, Math.PI * 2); g.fill(); g.fillStyle = INK;
    } else if (eyes === 'shock') { const ww = w * 1.45, hh = h * 1.1; g.fillStyle = '#fbf7f0'; rr(g, -ww / 2, -hh / 2, ww, hh, ww * 0.48); g.fill(); g.lineWidth = ms(0.014); g.stroke();
      const px = lx * ww * 0.18, py = -ly * hh * 0.15; g.fillStyle = INK; g.beginPath(); g.arc(px, py, ww * 0.13, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px - ww * 0.04, py - ww * 0.04, ww * 0.04, 0, Math.PI * 2); g.fill(); g.fillStyle = INK;
    } else if (eyes === 'happy') { g.lineWidth = ms(0.032); g.beginPath(); g.moveTo(-w * 0.95, h * 0.18); g.quadraticCurveTo(0, -h * 0.55, w * 0.95, h * 0.18); g.stroke(); }
    else if (eyes === 'closed') { g.lineWidth = ms(0.03); g.beginPath(); g.moveTo(-w * 0.95, -h * 0.05); g.quadraticCurveTo(0, h * 0.3, w * 0.95, -h * 0.05); g.stroke(); }
    else if (eyes === 'squint') { g.lineWidth = ms(0.032); const s = sx; g.beginPath(); g.moveTo(-s * w * 0.8, -h * 0.34); g.lineTo(s * w * 0.65, 0); g.lineTo(-s * w * 0.8, h * 0.34); g.stroke(); }
    else if (eyes === 'xx') { g.lineWidth = ms(0.028); g.beginPath(); g.moveTo(-w * 0.75, -h * 0.32); g.lineTo(w * 0.75, h * 0.32); g.moveTo(w * 0.75, -h * 0.32); g.lineTo(-w * 0.75, h * 0.32); g.stroke(); }
    else if (eyes === 'star') { const R = ms(0.085); g.beginPath(); for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i / 8) * Math.PI * 2; const r = i % 2 ? R * 0.28 : R; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(-R * 0.18, -R * 0.2, R * 0.12, 0, Math.PI * 2); g.fill(); }
    else if (eyes === 'spiral') { g.lineWidth = ms(0.016); g.beginPath(); for (let i = 0; i < 60; i++) { const a = i * 0.34 + (f.t || 0) * 8 * sx; const r = i * ms(0.0016); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke(); }
    else if (eyes === 'heart') { const s = ms(0.06); g.beginPath(); g.moveTo(0, s * 0.9); g.bezierCurveTo(-s * 1.4, -s * 0.1, -s * 0.6, -s * 1.1, 0, -s * 0.4); g.bezierCurveTo(s * 0.6, -s * 1.1, s * 1.4, -s * 0.1, 0, s * 0.9); g.fillStyle = '#d63a4a'; g.fill(); }
    g.restore();
    // brows: thin lines that carry most of the emotion
    const brow = f.brow || (eyes === 'angry' ? 'angry' : eyes === 'sad' ? 'sad' : eyes === 'wide' ? 'up' : (f.sweat > 0.5 || f.mouth === 'wavy') ? 'worried' : null);
    if (brow) { const bx = mx(sx * EX); const by = my(EY + 0.125 + (brow === 'up' ? 0.05 : brow === 'angry' ? -0.012 : 0) + ly * 0.02); const len = ms(0.068); const tilt = brow === 'angry' ? -0.48 : brow === 'sad' || brow === 'worried' ? 0.42 : 0; g.lineWidth = ms(0.027);
      const bend = brow === 'angry' ? 0.12 : brow === 'up' ? 0.5 : 0.3; g.save(); g.translate(bx, by); g.rotate(sx * tilt); g.beginPath(); g.moveTo(-len, len * 0.08); g.quadraticCurveTo(0, -len * bend, len, len * 0.08); g.stroke(); g.restore(); }
    // tears
    if (f.tears > 0) { const t = f.tears; g.save(); g.fillStyle = `rgba(120,195,250,${0.85 * t})`; const x = cx + sx * w * 0.2; for (let k = 0; k < 2; k++) { const ph = ((f.t || 0) * 1.6 + k * 0.5) % 1; g.beginPath(); g.ellipse(x, cy + h * 0.55 + ph * ms(0.2), ms(0.016), ms(0.024), 0, 0, Math.PI * 2); g.fill(); } g.fillRect(x - ms(0.011), cy + h * 0.4, ms(0.022), ms(0.08) * t); g.restore(); }
  }
  // the mouth: small
  const m = f.mouth || 'none'; const o = f.open || 0; const mcx = mx(lx * 0.02); const mcy = my(-0.085 + ly * 0.015); g.lineWidth = ms(0.022);
  if (m === 'flat') { g.beginPath(); g.moveTo(mcx - ms(0.025), mcy); g.lineTo(mcx + ms(0.025), mcy); g.stroke(); }
  if (m === 'smile') { g.beginPath(); g.moveTo(mcx - ms(0.045), mcy - ms(0.01)); g.quadraticCurveTo(mcx, mcy + ms(0.045), mcx + ms(0.045), mcy - ms(0.01)); g.stroke(); }
  if (m === 'jgrin' || m === 'jscream') { // Jogo's mouth: wide, a dark inside, a row of square teeth top and bottom; scream opens it tall
    const ww = ms(m === 'jscream' ? 0.15 : 0.2), hh = ms(m === 'jscream' ? 0.05 + 0.03 * o : 0.035 + 0.03 * o); const cy = mcy + ms(m === 'jscream' ? 0.045 : 0.01);
    g.fillStyle = '#2a0a0c'; g.beginPath(); g.moveTo(mcx - ww, cy - hh * 0.4); g.quadraticCurveTo(mcx, cy - hh * (m === 'jscream' ? 1.1 : 0.2), mcx + ww, cy - hh * 0.4); g.quadraticCurveTo(mcx + ww * 0.7, cy + hh * 1.1, mcx, cy + hh * 1.15); g.quadraticCurveTo(mcx - ww * 0.7, cy + hh * 1.1, mcx - ww, cy - hh * 0.4); g.closePath(); g.fill();
    g.save(); g.clip(); g.fillStyle = '#f4f0e6'; g.strokeStyle = '#7a6a60'; g.lineWidth = ms(0.004); const n = 9; const tw = (2 * ww) / n; const th = Math.min(hh * 0.55, ms(0.03));
    for (let k = 0; k < n; k++) { const x = mcx - ww + k * tw; g.fillRect(x + ms(0.002), cy - hh * 1.2, tw - ms(0.004), th + hh * 0.75); g.strokeRect(x + ms(0.002), cy - hh * 1.2, tw - ms(0.004), th + hh * 0.75);
      g.fillRect(x + ms(0.002), cy + hh * 1.15 - th, tw - ms(0.004), th); g.strokeRect(x + ms(0.002), cy + hh * 1.15 - th, tw - ms(0.004), th); }
    if (m === 'jscream') { g.fillStyle = '#b8323e'; g.beginPath(); g.ellipse(mcx, cy + hh * 0.75, ww * 0.38, hh * 0.3, 0, 0, Math.PI * 2); g.fill(); }
    g.restore(); g.lineWidth = ms(0.012); g.strokeStyle = INK; g.stroke(); g.fillStyle = INK; }
  if (m === 'smirk') { g.beginPath(); g.moveTo(mcx - ms(0.04), mcy + ms(0.004)); g.quadraticCurveTo(mcx + ms(0.01), mcy + ms(0.022), mcx + ms(0.05), mcy - ms(0.022)); g.stroke(); }
  if (m === 'frown') { g.beginPath(); g.moveTo(mcx - ms(0.04), mcy + ms(0.02)); g.quadraticCurveTo(mcx, mcy - ms(0.025), mcx + ms(0.04), mcy + ms(0.02)); g.stroke(); }
  if (m === 'wavy') { g.lineWidth = ms(0.016); g.beginPath(); for (let i = 0; i <= 20; i++) { const u = i / 20; g.lineTo(mcx - ms(0.055) + u * ms(0.11), mcy + Math.sin(u * Math.PI * 4) * ms(0.01)); } g.stroke(); }
  if (m === 'fangs') { const ww = ms(0.06); g.beginPath(); g.moveTo(mcx - ww, mcy - ms(0.01)); g.quadraticCurveTo(mcx, mcy + ms(0.04), mcx + ww, mcy - ms(0.01)); g.quadraticCurveTo(mcx, mcy + ms(0.012 + 0.03 * o), mcx - ww, mcy - ms(0.01)); g.fill();
    g.fillStyle = '#fbf6ee'; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(mcx + sx * ww * 0.6, mcy + ms(0.004)); g.lineTo(mcx + sx * ww * 0.25, mcy + ms(0.006)); g.lineTo(mcx + sx * ww * 0.45, mcy + ms(0.045)); g.closePath(); g.fill(); } g.fillStyle = INK; }
  if (m === 'o') { g.beginPath(); g.ellipse(mcx, mcy, ms(0.018 + 0.012 * o), ms(0.024 + 0.018 * o), 0, 0, Math.PI * 2); g.fill(); }
  if (m === 'open' || m === 'grin') { const ww = ms(0.062 + 0.02 * o); const hh = ms(0.024 + 0.062 * o); g.beginPath(); g.moveTo(mcx - ww, mcy - hh * 0.2); g.quadraticCurveTo(mcx, mcy - hh * 0.35, mcx + ww, mcy - hh * 0.2); g.quadraticCurveTo(mcx + ww * 0.85, mcy + hh, mcx, mcy + hh); g.quadraticCurveTo(mcx - ww * 0.85, mcy + hh, mcx - ww, mcy - hh * 0.2); g.closePath(); g.fill();
    if (m === 'grin') { g.fillStyle = '#fbf6ee'; g.fillRect(mcx - ww * 0.75, mcy - hh * 0.25, ww * 1.5, hh * 0.3); g.fillStyle = INK; }
    if (o > 0.35 || m === 'open') { g.fillStyle = '#e0607a'; g.beginPath(); g.ellipse(mcx, mcy + hh * 0.62, ww * 0.42, hh * 0.28, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = INK; } }
  // a sweat drop at the temple, an anger mark
  if (f.sweat > 0) { const s = f.sweat; const x = mx(0.27); const y = my(0.17) + (1 - s) * ms(0.03); const k = 0.55; g.save(); g.globalAlpha = Math.min(1, s * 1.5); g.fillStyle = '#a8dcff'; g.strokeStyle = '#3a7ab8'; g.lineWidth = ms(0.008); g.beginPath(); g.moveTo(x, y - ms(0.085 * k)); g.quadraticCurveTo(x + ms(0.055 * k), y, x + ms(0.04 * k), y + ms(0.03 * k)); g.arc(x, y + ms(0.03 * k), ms(0.042 * k), 0.3, Math.PI - 0.3); g.quadraticCurveTo(x - ms(0.055 * k), y, x, y - ms(0.085 * k)); g.fill(); g.stroke(); g.restore(); }
  if (f.vein > 0) { const x = mx(0.26); const y = my(0.19); g.save(); g.globalAlpha = f.vein; g.strokeStyle = '#c4242c'; g.lineWidth = ms(0.014); const s = ms(0.032); for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { g.beginPath(); g.moveTo(x + a * s * 0.25, y + b * s); g.quadraticCurveTo(x + a * s * 0.3, y + b * s * 0.3, x + a * s, y + b * s * 0.25); g.stroke(); } g.restore(); }
  g.restore();
}
