# Paper Plane: the set and the render (Blender 5.2, Eevee). The look is the approved look-dev v3 (cel tones, ink on the characters, Kuwahara
# gouache on the rest), carried through a sunset: every cel material multiplies its shade tone by scene["shadeT"] and its lit tone by scene["litT"].
# The sky is the painted 360 cylinder shared with Last Ray (same sun azimuth), mixed A -> B by scene["skyAB"]. The meadow sways in the wind
# (geometry nodes, the gust front keyed per frame); the plane, its wings, the dragonfly, pollen, dew drops and web strands follow the bake.
#   blender -b -P scene.py -- still 1,240,600 [spp] [scale%]   |   anim [spp]   (F0/F1 env for a range; LOW=1 for the animatic)
import bpy, sys, os, math, random, json
import numpy as np
from mathutils import Vector, Matrix, Euler
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out'); TEX = os.path.join(HERE, 'tex')
sys.path.insert(0, os.path.join(HERE, 'kit'))
import mkit as K, deform as DF
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['still', '1']
LOW = os.environ.get('LOW') == '1'
B = K.load_bake(os.path.join(OUT, 'bake.json')); V = B['vals']; EV = json.load(open(os.path.join(OUT, 'events.json'))); N = B['n']; FPS = B['fps']
sc, C = K.reset(); R = random.Random(11)
P2B = lambda p: Vector((p[0], -p[2], p[1]))
MD = EV['MD']; EDGE, LOWY, DROP = EV['EDGE'], EV['LOWY'], EV['DROP']
def sstep(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)
def terrain(x, z):   # the same as plan.mjs: a mound, gentle on its shadow side, steep on its sunny side (+z), its top leaning to the sun
    dx, dz = x - MD['cx'], z - MD['cz']; r = math.hypot(dx, dz); sun = max(0.0, dz / r) if r > 1e-6 else 0.0
    Wd = (MD['R'] - MD['top']) - (MD['R'] - MD['top'] - MD['Ws']) * sun ** 1.5
    if r >= MD['top'] + Wd: return 0.0
    fall = 1 - 0.01 * (r / MD['top']) ** 2 if r < MD['top'] else 0.99 * (1 - sstep((r - MD['top']) / Wd))
    return MD['H'] * fall - 0.07 * dz * fall
# ---- animated scene properties --------------------------------------------------------------------------------------------------------------------------------------------
def lerp3(a, b, u): return tuple(a[i] + (b[i] - a[i]) * u for i in range(3))
def tints(e):
    sunset = max(0.0, min(1.0, (8 - e) / 7))
    lit = lerp3((1, 1, 1), (1.0, 0.86, 0.72), sunset); sh = lerp3((1, 1, 1), (0.93, 0.87, 0.96), sunset)
    return sh, lit
props = {'shadeT': [], 'litT': [], 'skyAB': [], 'skyCD': [], 'sunB': [], 'night': [], 'wet': [], 'litK': []}
for i in range(N):
    e = V['sunE'][i]; sh, lit = tints(e); s4 = V['sky'][i]; d = V['sunD'][i]
    props['shadeT'].append(sh); props['litT'].append(lit); props['skyAB'].append((s4[0], s4[1], 0)); props['skyCD'].append((s4[2], s4[3], 0)); props['sunB'].append((d[0], -d[2], d[1]))
    props['night'].append((0, 0, 0)); props['wet'].append((V['wet'][i],) * 3); props['litK'].append((min(1.0, 5.0 / max(V['sunStr'][i], 1e-3)),) * 3)
for k, seq in props.items():
    sc[k] = seq[0]
    for idx in range(3): K.keys(sc, '["%s"]' % k, [None] * idx + [[v[idx] for v in seq]])
# ---- materials -------------------------------------------------------------------------------------------------------------------------------------------------------------
def nodes(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); return m, nt.nodes, nt.links
def attr(Nn, name): a = Nn.new('ShaderNodeAttribute'); a.attribute_type = 'VIEW_LAYER'; a.attribute_name = name; return a
def math_(Nn, L, op, a, b=None, v1=None):
    m = Nn.new('ShaderNodeMath'); m.operation = op
    (L.new(a, m.inputs[0]) if not isinstance(a, (int, float)) else setattr(m.inputs[0], 'default_value', a))
    if b is not None: (L.new(b, m.inputs[1]) if not isinstance(b, (int, float)) else setattr(m.inputs[1], 'default_value', b))
    return m.outputs[0]
def mixc(Nn, L, a, b, fac=None, blend='MIX', fval=1.0):
    mm = Nn.new('ShaderNodeMix'); mm.data_type = 'RGBA'; mm.blend_type = blend; mm.inputs['Factor'].default_value = fval
    if fac is not None: (L.new(fac, mm.inputs['Factor']) if not isinstance(fac, (int, float)) else setattr(mm.inputs['Factor'], 'default_value', fac))
    (L.new(a, mm.inputs['A']) if not isinstance(a, tuple) else setattr(mm.inputs['A'], 'default_value', a))
    (L.new(b, mm.inputs['B']) if not isinstance(b, tuple) else setattr(mm.inputs['B'], 'default_value', b))
    return mm.outputs['Result']
def lightval(Nn, L, bsdf='ShaderNodeBsdfDiffuse'):
    d = Nn.new(bsdf); s = Nn.new('ShaderNodeShaderToRGB'); L.new(d.outputs[0], s.inputs[0]); bw = Nn.new('ShaderNodeRGBToBW'); L.new(s.outputs['Color'], bw.inputs[0]); return bw.outputs[0]
def ramp(Nn, L, val, stops, interp='CONSTANT'):
    r = Nn.new('ShaderNodeValToRGB'); r.color_ramp.interpolation = interp; e = r.color_ramp.elements
    cv = lambda c: K.srgb(c) if isinstance(c, str) else c
    e[0].position = 0; e[0].color = cv(stops[0][1]); e[1].position = stops[1][0]; e[1].color = cv(stops[1][1])
    for (p, c) in stops[2:]: x = e.new(p); x.color = cv(c)
    L.new(val, r.inputs['Fac']); return r.outputs['Color']
def lightK(Nn, L, bsdf='ShaderNodeBsdfDiffuse'):
    lv = lightval(Nn, L, bsdf); k = attr(Nn, 'litK'); return math_(Nn, L, 'MULTIPLY', lv, k.outputs['Fac'])
def tinted(Nn, L, col, lv, thr):
    gt = math_(Nn, L, 'GREATER_THAN', lv, thr)
    t = mixc(Nn, L, attr(Nn, 'shadeT').outputs['Color'], attr(Nn, 'litT').outputs['Color'], fac=gt)
    return mixc(Nn, L, col, t, blend='MULTIPLY')
def painted(Nn, L, col, scale, amt, steps=4, seed=0.0, coord='Object'):
    tc = Nn.new('ShaderNodeTexCoord'); nz = Nn.new('ShaderNodeTexNoise'); nz.noise_dimensions = '4D'; nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = 4; nz.inputs['W'].default_value = seed
    L.new(tc.outputs[coord], nz.inputs['Vector'])
    pm = math_(Nn, L, 'SNAP', nz.outputs['Fac'], 1 / steps)
    mr = Nn.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.3; mr.inputs['From Max'].default_value = 0.7; mr.inputs['To Min'].default_value = 1 - amt; mr.inputs['To Max'].default_value = 1 + amt; L.new(pm, mr.inputs['Value'])
    hs = Nn.new('ShaderNodeHueSaturation'); L.new(col, hs.inputs['Color']); L.new(mr.outputs['Result'], hs.inputs['Value']); return hs.outputs['Color']
def backlit(Nn, L, power=3.0):   # how much the sun is right behind this point, as seen from the camera (0 by day-side, 1 against the sun)
    geo = Nn.new('ShaderNodeNewGeometry'); sb = attr(Nn, 'sunB'); neg = Nn.new('ShaderNodeVectorMath'); neg.operation = 'SCALE'; neg.inputs['Scale'].default_value = -1; L.new(sb.outputs['Vector'], neg.inputs[0])
    dd = Nn.new('ShaderNodeVectorMath'); dd.operation = 'DOT_PRODUCT'; L.new(geo.outputs['Incoming'], dd.inputs[0]); L.new(neg.outputs[0], dd.inputs[1])
    return math_(Nn, L, 'POWER', math_(Nn, L, 'MAXIMUM', dd.outputs['Value'], 0.0), power)
def finish(m, Nn, L, col, hero=False, alpha=None, strength=1.0, aov=None, glow=None):
    out = Nn.new('ShaderNodeOutputMaterial'); em = Nn.new('ShaderNodeEmission'); L.new(col, em.inputs['Color']); em.inputs['Strength'].default_value = strength
    if hero: ao = Nn.new('ShaderNodeOutputAOV'); ao.aov_name = 'hero'; ao.inputs['Value'].default_value = 1.0
    if aov: ao = Nn.new('ShaderNodeOutputAOV'); ao.aov_name = aov; ao.inputs['Value'].default_value = 1.0
    if glow is not None: ao = Nn.new('ShaderNodeOutputAOV'); ao.aov_name = 'glow'; L.new(glow, ao.inputs['Value'])
    if alpha is not None:
        tr = Nn.new('ShaderNodeBsdfTransparent'); mx = Nn.new('ShaderNodeMixShader')
        (L.new(alpha, mx.inputs['Fac']) if not isinstance(alpha, (int, float)) else setattr(mx.inputs['Fac'], 'default_value', alpha))
        L.new(tr.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2]); L.new(mx.outputs[0], out.inputs['Surface']); m.surface_render_method = 'DITHERED'
    else: L.new(em.outputs[0], out.inputs['Surface'])
    return m
def cel(name, stops, hero=False, vary=0.0, vscale=1.0, emit=1.0, aov=None, rim=None):
    m, Nn, L = nodes(name); lv = lightK(Nn, L); col = ramp(Nn, L, lv, stops)
    if vary: col = painted(Nn, L, col, vscale, vary)
    col = tinted(Nn, L, col, lv, stops[1][0])
    if rim:  # a warm glow on the shaded side when the sun is behind (thin, backlit things)
        bl = backlit(Nn, L, 3.0); col = mixc(Nn, L, col, K.srgb(rim), fac=math_(Nn, L, 'MULTIPLY', bl, 0.55))
    return finish(m, Nn, L, col, hero, strength=emit, aov=aov)
def glowmat(name, color, strength, objcolor=False):
    m, Nn, L = nodes(name); out = Nn.new('ShaderNodeOutputMaterial'); em = Nn.new('ShaderNodeEmission'); em.inputs['Color'].default_value = K.srgb(color)
    if objcolor:
        oi = Nn.new('ShaderNodeObjectInfo'); sp = Nn.new('ShaderNodeSeparateColor'); L.new(oi.outputs['Color'], sp.inputs[0]); L.new(math_(Nn, L, 'MULTIPLY', sp.outputs[0], strength), em.inputs['Strength'])
    else: em.inputs['Strength'].default_value = strength
    ao = Nn.new('ShaderNodeOutputAOV'); ao.aov_name = 'glow'; ao.inputs['Value'].default_value = 1.0
    L.new(em.outputs[0], out.inputs['Surface']); return m
# ---- the hero -------------------------------------------------------------------------------------------------------------------------------------------------------------
CHAR = bpy.data.collections.new('CHAR'); sc.collection.children.link(CHAR)
def to_char(o):
    for c in list(o.users_collection): c.objects.unlink(o)
    CHAR.objects.link(o)
rig = K.mascot('M', C, os.path.join(OUT, 'faces_M'), scale=1.5)
body = cel('heroBody', [(0, '#b95a4a'), (0.5, '#e8865f'), (0.95, '#ffc79a')], hero=True)
fm, FN, FL = nodes('heroFace'); fim = FN.new('ShaderNodeTexImage')
fseq = bpy.data.images.load(os.path.join(OUT, 'faces_M', 'face_0001.png')); fseq.source = 'SEQUENCE'; fim.image = fseq; fim.image_user.frame_duration = N; fim.image_user.use_auto_refresh = True; fim.image_user.frame_offset = 0
flv = lightK(FN, FL); fcol = mixc(FN, FL, fim.outputs['Color'], ramp(FN, FL, flv, [(0, '#f2cbbd'), (0.5, '#ffffff')]), blend='MULTIPLY'); fcol = tinted(FN, FL, fcol, flv, 0.5)
face = finish(fm, FN, FL, fcol, True, alpha=fim.outputs['Alpha'])
for o in list(bpy.data.objects):
    if o.type != 'MESH': continue
    p = o
    while p is not None and p.name != 'M': p = p.parent
    if p is None: continue
    o.data.materials.clear(); o.data.materials.append(face if o.name.startswith('M_face') else body)
    if not o.name.startswith('M_face'): to_char(o)
K.bake_mascot(rig, B['mascots']['M'])
# ---- the land: the meadow plane, the mound and the bank as a height field, the lower field ------------------------------------------------------------------------------
gm, GN, GL = nodes('ground'); glv = lightval(GN, GL); gcol = ramp(GN, GL, glv, [(0, '#3a6466'), (0.55, '#9fb95a'), (1.6, '#e6dc86')])
gtc = GN.new('ShaderNodeTexCoord'); gmp = GN.new('ShaderNodeMapping'); gmp.inputs['Scale'].default_value = (0.03, 0.03, 0.03); GL.new(gtc.outputs['Object'], gmp.inputs['Vector'])
gim = GN.new('ShaderNodeTexImage'); gim.image = bpy.data.images.load(os.path.join(TEX, 'ground_strokes.png')); gim.image.colorspace_settings.name = 'Non-Color'; GL.new(gmp.outputs['Vector'], gim.inputs['Vector'])
gk = GN.new('ShaderNodeMapRange'); gk.inputs['From Min'].default_value = 0.55; gk.inputs['From Max'].default_value = 0.95; gk.inputs['To Min'].default_value = 0.62; gk.inputs['To Max'].default_value = 1.3; gk.clamp = False; GL.new(gim.outputs['Color'], gk.inputs['Value'])
ghs = GN.new('ShaderNodeHueSaturation'); GL.new(gcol, ghs.inputs['Color']); GL.new(gk.outputs['Result'], ghs.inputs['Value'])
# steep faces (the cliff, the mound's flanks) show bare earth
geo_ = GN.new('ShaderNodeNewGeometry'); nsep = GN.new('ShaderNodeSeparateXYZ'); GL.new(geo_.outputs['Normal'], nsep.inputs[0])
steep = math_(GN, GL, 'LESS_THAN', nsep.outputs['Z'], 0.55)
earth = ramp(GN, GL, glv, [(0, '#5a3e48'), (0.55, '#a8765a'), (1.6, '#e2b47a')])
gfin = mixc(GN, GL, ghs.outputs['Color'], earth, fac=steep)
finish(gm, GN, GL, tinted(GN, GL, painted(GN, GL, gfin, 0.08, 0.12), glv, 0.55))
K.rbox('ground', (9000, 2, 9000), (0, -1.0, 0), gm, C)
xs = [round(x, 2) for x in np.arange(MD['cx'] - 40, MD['cx'] + 40.01, 0.8)]
zs = [round(z, 2) for z in np.arange(MD['cz'] - 40, MD['cz'] + 16.01, 0.6)]
vs = []; fs = []
for z in zs:
    for x in xs: vs.append((x, terrain(x, z) - 0.02, z))
nx = len(xs)
for j in range(len(zs) - 1):
    for i in range(nx - 1): a = j * nx + i; fs.append((a, a + nx, a + nx + 1, a + 1))
K.mesh_from('land', vs, fs, gm, C)
# ---- grass: blades merged into a few big meshes; geometry nodes bend them in the wind (uv v = along the blade, rnd per blade) ----------------------------------------------
def grassmat(i, shade, lit, glow, hot):
    m, Nn, L = nodes('grass%d' % i)
    lv = lightK(Nn, L); col = ramp(Nn, L, lv, [(0, shade), (0.5, lit)])
    uv = Nn.new('ShaderNodeUVMap'); sp = Nn.new('ShaderNodeSeparateXYZ'); L.new(uv.outputs['UV'], sp.inputs[0]); rn = Nn.new('ShaderNodeAttribute'); rn.attribute_type = 'GEOMETRY'; rn.attribute_name = 'rnd'
    root = Nn.new('ShaderNodeValToRGB'); r0, r1 = root.color_ramp.elements; r0.color = (0.66, 0.7, 0.74, 1); r1.position = 0.45; root.color_ramp.interpolation = 'LINEAR'; L.new(sp.outputs['Y'], root.inputs['Fac'])
    col = mixc(Nn, L, col, root.outputs['Color'], blend='MULTIPLY')
    tr = math_(Nn, L, 'MULTIPLY', backlit(Nn, L, 3.0), 1.7)
    y2 = math_(Nn, L, 'POWER', sp.outputs['Y'], 1.6); tip0 = math_(Nn, L, 'MULTIPLY', tr, y2)
    rj = Nn.new('ShaderNodeMath'); rj.operation = 'MULTIPLY_ADD'; rj.inputs[1].default_value = 0.45; rj.inputs[2].default_value = -0.22; L.new(rn.outputs['Fac'], rj.inputs[0])
    lw = Nn.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.35; eg = math_(Nn, L, 'GREATER_THAN', lw.outputs['Facing'], 0.72)
    eg2 = math_(Nn, L, 'MULTIPLY', eg, tr); t1 = math_(Nn, L, 'ADD', tip0, rj.outputs[0])
    tip = Nn.new('ShaderNodeMath'); tip.operation = 'MULTIPLY_ADD'; tip.inputs[1].default_value = 0.35; L.new(eg2, tip.inputs[0]); L.new(t1, tip.inputs[2])
    gl = ramp(Nn, L, tip.outputs[0], [(0, (0, 0, 0, 0)), (0.55, glow), (0.95, hot)])
    gmask = math_(Nn, L, 'GREATER_THAN', tip.outputs[0], 0.55)
    col = tinted(Nn, L, col, lv, 0.5)
    sunc = mixc(Nn, L, gl, attr(Nn, 'litT').outputs['Color'], blend='MULTIPLY')
    col = mixc(Nn, L, col, sunc, fac=gmask)
    col = painted(Nn, L, col, 0.9, 0.1, 3, seed=i)
    return finish(m, Nn, L, col)
GRASS = [grassmat(i, *c) for i, c in enumerate([('#3b6a5e', '#8fbf58', '#a9c95a', '#f6e99a'), ('#44725a', '#9ccb5c', '#b5cf62', '#fff0a6'), ('#355e5a', '#7fb250', '#9cc25a', '#f2e48e'), ('#4a7a5e', '#a7cf62', '#c0d26a', '#fff4b8')])]
# the wind: a gentle sway everywhere plus the gust front rolling toward -z (keyed inputs: front z, gust strength, breeze)
def wind_group():
    ng = bpy.data.node_groups.new('wind', 'GeometryNodeTree'); ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    Nn = ng.nodes; L = ng.links; gi = Nn.new('NodeGroupInput'); go = Nn.new('NodeGroupOutput')
    WVN = {}
    for j, nm_ in enumerate(('GZ', 'GA', 'BR')):   # the wind values, keyed per frame on Value nodes inside the group (shared by every grass mesh)
        vn = Nn.new('ShaderNodeValue'); vn.name = nm_; vn.outputs[0].default_value = float(WV[0, j]); K.keys(vn, 'outputs[0].default_value', [list(map(float, WV[:, j]))]); WVN[nm_] = vn.outputs[0]
    pos = Nn.new('GeometryNodeInputPosition'); sp = Nn.new('ShaderNodeSeparateXYZ'); L.new(pos.outputs[0], sp.inputs[0])
    tm = Nn.new('GeometryNodeInputSceneTime')
    def na(name):
        a = Nn.new('GeometryNodeInputNamedAttribute'); a.data_type = 'FLOAT'; a.inputs['Name'].default_value = name; return a.outputs['Attribute']
    hv = na('hv'); bh = na('bh'); ph = na('ph')
    M = lambda op, a, b=None: math_(Nn, L, op, a, b)
    # sway: sin(time*2.1 + x*0.31 + z*0.27 + ph)
    arg = M('ADD', M('ADD', M('MULTIPLY', tm.outputs['Seconds'], 2.1), M('MULTIPLY', sp.outputs['X'], 0.31)), M('ADD', M('MULTIPLY', sp.outputs['Z'], 0.27), ph))
    sway = M('MULTIPLY', M('SINE', arg), WVN['BR'])
    # gust: exp(-((z - GZ)/9)^2) * GA, plus a softer trailing tail behind the front
    dz = M('DIVIDE', M('SUBTRACT', sp.outputs['Z'], WVN['GZ']), 9.0); g1 = M('EXPONENT', M('MULTIPLY', M('MULTIPLY', dz, dz), -1.0))
    tail = M('MULTIPLY', M('GREATER_THAN', sp.outputs['Z'], WVN['GZ']), M('EXPONENT', M('MULTIPLY', M('MAXIMUM', dz, 0.0), -0.35)))
    gust = M('MULTIPLY', M('ADD', g1, M('MULTIPLY', tail, 0.35)), WVN['GA'])
    amt = M('MULTIPLY', M('ADD', M('MULTIPLY', sway, 0.16), M('MULTIPLY', gust, 0.75)), M('MULTIPLY', M('POWER', hv, 2.0), bh))
    side = M('MULTIPLY', M('MULTIPLY', M('SINE', M('ADD', M('MULTIPLY', tm.outputs['Seconds'], 1.3), M('MULTIPLY', sp.outputs['Z'], 0.2))), WVN['BR']), M('MULTIPLY', M('POWER', hv, 2.0), M('MULTIPLY', bh, 0.06)))
    off = Nn.new('ShaderNodeCombineXYZ'); L.new(side, off.inputs['X']); L.new(M('MULTIPLY', M('ABSOLUTE', amt), -0.35), off.inputs['Y']); L.new(M('MULTIPLY', amt, -1.0), off.inputs['Z'])
    setp = Nn.new('GeometryNodeSetPosition'); L.new(gi.outputs['Geometry'], setp.inputs['Geometry']); L.new(off.outputs[0], setp.inputs['Offset']); L.new(setp.outputs[0], go.inputs[0])
    return ng
WV = np.array(V['wind'], np.float32)
WIND = wind_group()
def add_wind(o): md = o.modifiers.new('wind', 'NODES'); md.node_group = WIND
class Blades:
    def __init__(s): s.v = [[] for _ in GRASS]; s.f = [[] for _ in GRASS]; s.uv = [[] for _ in GRASS]; s.rnd = [[] for _ in GRASS]; s.hv = [[] for _ in GRASS]; s.bh = [[] for _ in GRASS]; s.ph = [[] for _ in GRASS]
    def add(s, mi, x, z, hgt, wid, bend, yaw, twist=0.0, n=8, y0=None):
        vs, fs, us = s.v[mi], s.f[mi], s.uv[mi]; b0 = len(vs); cy, sy = math.cos(yaw), math.sin(yaw); rr = R.random(); y0 = terrain(x, z) if y0 is None else y0; ph = R.uniform(0, 6.28)
        for j in range(n + 1):
            v = j / n; w = wid * (1 - v) ** 0.75; off = bend * v * v
            for side, tw in ((-1, 0.0), (1, twist)):
                lx = side * w / 2; lz = off + (tw * w if side > 0 else 0); vs.append((x + lx * cy + lz * sy, y0 + hgt * v, z - lx * sy + lz * cy)); us.append(((side + 1) / 2, v)); s.rnd[mi].append(rr); s.hv[mi].append(v); s.bh[mi].append(hgt); s.ph[mi].append(ph)
        for j in range(n): a = b0 + 2 * j; fs.append((a, a + 1, a + 3, a + 2))
    def build(s):
        for mi, m in enumerate(GRASS):
            if not s.v[mi]: continue
            me = bpy.data.meshes.new('grass%d' % mi); me.from_pydata(s.v[mi], [], s.f[mi]); me.update()
            uvl = me.uv_layers.new(); uvl.data.foreach_set('uv', np.array([s.uv[mi][l.vertex_index] for l in me.loops], np.float32).ravel())
            for nm_, arr in (('rnd', s.rnd[mi]), ('hv', s.hv[mi]), ('bh', s.bh[mi]), ('ph', s.ph[mi])):
                at = me.attributes.new(nm_, 'FLOAT', 'POINT'); at.data.foreach_set('value', np.array(arr, np.float32))
            o = bpy.data.objects.new('grass%d' % mi, me); sc.collection.objects.link(o); o.parent = C; me.materials.append(m)
            for p in me.polygons: p.use_smooth = True
            add_wind(o)
BL = Blades()
# keep-outs: the hero's path, the plane's path and footprint, the lines of sight from the camera to the hero, the camera itself
hp = np.array([[f[0], f[1], f[2]] for f in B['mascots']['M']]); camk = np.array([c[0:3] for c in B['cam']])
PO = np.array([o[0:3] for o in B['objs']['plane']])
path_xz = hp[::4][:, [0, 2]]; path_y = hp[::4][:, 1]
plane_xz = PO[::2][:, [0, 2]]; plane_y = PO[::2][:, 1]
SI = list(range(0, N, 4)); SA = camk[SI][:, [0, 2]]; SB = (hp[SI] + np.array([0, 1.0, 0]))[:, [0, 2]]; SY0 = camk[SI][:, 1]; SY1 = hp[SI][:, 1] + 1.0
SAB = SB - SA; SL2 = np.einsum('ij,ij->i', SAB, SAB); SOK = SL2 > 1e-6
camlow = camk[::3][:, [0, 2]]; camy = camk[::3][:, 1]
def blocked(x, z, h, y0=0.0):
    q = np.array([x, z]); top = y0 + h
    d = np.linalg.norm(camlow - q, axis=1); m_ = d < 1.6
    if m_.any() and np.min(camy[m_]) < top + 0.6: return True
    d = np.linalg.norm(path_xz - q, axis=1); m_ = d < 2.0
    if m_.any() and np.min(path_y[m_]) < top + 0.4: return True
    d = np.linalg.norm(plane_xz - q, axis=1); m_ = d < 3.4
    if m_.any() and np.min(plane_y[m_]) - 1.1 < top: return True
    t = np.clip(np.einsum('ij,ij->i', q - SA, SAB) / np.maximum(SL2, 1e-9), 0, 1); dd = np.linalg.norm(SA + SAB * t[:, None] - q, axis=1)
    m_ = SOK & (dd < 0.6) & (t > 0.08) & (t < 0.94)
    if m_.any() and (top > (SY0 + (SY1 - SY0) * t)[m_] - 0.25).any(): return True
    return False
def scatter(n, xr, zr, hr, wr, grow=0.0):
    k = 0
    for i in range(n):
        x, z = R.uniform(*xr), R.uniform(*zr); y0 = terrain(x, z)
        r_ = math.hypot(x - MD['cx'], z - MD['cz'])
        if z > MD['cz'] + MD['top'] - 0.5 and r_ < MD['top'] + MD['Ws'] + 1.0 and abs(x - MD['cx']) < 14: continue   # the steep sunny face is bare earth
        h = R.uniform(*hr) * (1 + grow * max(0, abs(z) - 40) / 160)
        if r_ < MD['top'] + 3: h *= 0.35                              # short turf on the top
        if blocked(x, z, h, y0): continue
        BL.add(i % 4, x, z, h, R.uniform(*wr) * (1 + grow * max(0, abs(z) - 40) / 150), R.uniform(0.2, 1.4) * h / 3.5, R.uniform(0, math.tau), R.uniform(-0.4, 0.4), y0=y0); k += 1
    return k
sf = 0.45 if LOW else 1.0
cnt = scatter(int(11000 * sf), (-20, 26), (-24, 34), (1.2, 4.6), (0.16, 0.32))               # the start
cnt += scatter(int(26000 * sf), (-30, 30), (-150, -22), (1.4, 5.2), (0.17, 0.34))           # under the flight
cnt += scatter(int(11000 * sf), (-95, -8), (-170, -55), (1.0, 3.8), (0.15, 0.3))            # the mound and its foot
cnt += scatter(int(9000 * sf), (-170, 190), (-230, -40), (1.6, 5.5), (0.25, 0.5), 0.6)      # the wider meadow
cnt += scatter(int(9000 * sf), (-220, 240), (30, 240), (1.6, 6.0), (0.25, 0.5), 0.6)        # toward the sun, behind the start
cnt += scatter(int(5000 * sf), (-320, 320), (-420, -230), (2.5, 8.0), (0.4, 0.8), 0.4)      # far
print('blades', cnt)
# the slalom stalks and the web's two anchors: tall stems with a seed spike, a leaf or two; tufts round their feet
stemM = cel('stem', [(0, '#3d6a58'), (0.5, '#8fbf5a')], rim='#e8f08a')
spikeM = cel('spike', [(0, '#6a6a4a'), (0.5, '#c8be78'), (0.95, '#fff0b0')], vary=0.12, vscale=3.0, rim='#ffe6a0')
leafM = cel('bigleaf', [(0, '#355f52'), (0.5, '#8cbc58'), (0.95, '#d6e88a')], vary=0.08, vscale=0.4, rim='#e6f09a')
def stalk(name, x, z, h, lean=0.06):
    y0 = terrain(x, z); a = R.uniform(0, math.tau); tip = (x + math.cos(a) * lean * h, y0 + h, z + math.sin(a) * lean * h)
    pts = [(x + (tip[0] - x) * u * u, y0 + h * u, z + (tip[2] - z) * u * u) for u in np.linspace(0, 1, 12)]
    vs = []; fs = []; sides = 6
    for i, p in enumerate(pts):
        rr = 0.17 * (1 - 0.55 * i / 11)
        for j in range(sides): an = j / sides * math.tau; vs.append((p[0] + math.cos(an) * rr, p[1], p[2] + math.sin(an) * rr))
    for i in range(11):
        for j in range(sides): a_ = i * sides + j; b_ = i * sides + (j + 1) % sides; fs.append((a_, b_, b_ + sides, a_ + sides))
    K.mesh_from(name, vs, fs, stemM, C)
    sp_ = K.sphere(name + 'sp', 1, (tip[0], tip[1] + 0.9, tip[2]), spikeM, C, scale=(0.32, 1.25, 0.32), segs=12, rings=10)
    for k in range(2):  # a leaf: a long thin blade from the stem
        yy = y0 + h * R.uniform(0.25, 0.55); BL.add(k % 4, x, z, h * 0.45, 0.42, h * 0.3, R.uniform(0, math.tau), 0.2, y0=yy)
    return sp_
for (x, z, h) in EV['STEMS']: stalk('stalk', x, z, h)
for (x, z, h) in EV['WEB']['anchors']: stalk('anchor', x, z, h, 0.02)
BL.build()
# small flowers in the grass: daisies and buttercups; the crash buttercups (the pollen)
dsy = cel('daisy', [(0, '#c9bde6'), (0.5, '#ffffff'), (0.95, '#fff6dc')], rim='#fff2c8'); dcn = cel('dcen', [(0, '#d6893a'), (0.5, '#ffd03a'), (0.95, '#fff09a')])
butM = cel('butter', [(0, '#c8902a'), (0.5, '#ffd23a'), (0.95, '#fff4a0')], rim='#fff0a0')
class Merge:   # many small things as one mesh with material slots
    def __init__(s, mats): s.v = []; s.f = []; s.mi = []; s.mats = mats
    def add(s, verts, faces, mi, M):
        b0 = len(s.v); s.v += [tuple(M @ Vector(v)) for v in verts]; s.f += [tuple(b0 + i for i in fc) for fc in faces]; s.mi += [mi] * len(faces)
    def build(s, name):
        me = bpy.data.meshes.new(name); me.from_pydata(s.v, [], s.f); me.update()
        for m in s.mats: me.materials.append(m)
        me.polygons.foreach_set('material_index', s.mi); o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); o.parent = C; return o
def disc(n, r, y=0.0):
    vs = [(0, y, 0)] + [(math.cos(k / n * math.tau) * r, y, math.sin(k / n * math.tau) * r) for k in range(n)]; return vs, [(0, 1 + (k + 1) % n, 1 + k) for k in range(n)]
FLW = Merge([stemM, dsy, dcn, butM])
def flower(x, z, h, kind):
    y0 = terrain(x, z); sides = 5; vs = []; fs = []
    for i, yy in enumerate((0, h)):
        for j in range(sides): an = j / sides * math.tau; vs.append((math.cos(an) * 0.05, yy, math.sin(an) * 0.05))
    fs = [(j, (j + 1) % sides, sides + (j + 1) % sides, sides + j) for j in range(sides)]
    FLW.add(vs, fs, 0, Matrix.Translation((x, y0, z)))
    M = Matrix.Translation((x, y0 + h, z)) @ Euler((R.uniform(-0.4, 0.4), R.uniform(0, 6.28), R.uniform(-0.4, 0.4)), 'ZYX').to_matrix().to_4x4()
    if kind == 0:
        for k in range(14):
            a_ = k / 14 * math.tau; c_, s_ = math.cos(a_), math.sin(a_); w = 0.07
            pv = [(c_ * 0.1 - s_ * w, 0.0, s_ * 0.1 + c_ * w), (c_ * 0.55 - s_ * w * 1.3, 0.04, s_ * 0.55 + c_ * w * 1.3), (c_ * 0.62, 0.05, s_ * 0.62), (c_ * 0.55 + s_ * w * 1.3, 0.04, s_ * 0.55 - c_ * w * 1.3), (c_ * 0.1 + s_ * w, 0.0, s_ * 0.1 - c_ * w)]
            FLW.add(pv, [(0, 1, 2, 3, 4), (4, 3, 2, 1, 0)], 1, M)
        dv, df = disc(10, 0.17, 0.05); FLW.add(dv, df + [tuple(reversed(f)) for f in df], 2, M)
    else:
        for k in range(5):
            a_ = k / 5 * math.tau; dv, df = disc(8, 0.2, 0.04); FLW.add(dv, df + [tuple(reversed(f)) for f in df], 3, M @ Matrix.Translation((math.cos(a_) * 0.19, 0.02, math.sin(a_) * 0.19)) @ Matrix.Rotation(0.35, 4, Vector((-math.sin(a_), 0, math.cos(a_)))))
        dv, df = disc(6, 0.09, 0.09); FLW.add(dv, df, 2, M)
nfl = 0
for i in range(220 if not LOW else 90):
    x, z = R.uniform(-28, 28), R.uniform(-150, 18); h = R.uniform(1.6, 4.2)
    if blocked(x, z, h + 0.5, terrain(x, z)): continue
    flower(x, z, h, i % 3 == 0); nfl += 1
for (x, z, h) in EV['BUTTER']: flower(x, z, h, 1)
FLW.build('flowers')
print('flowers', nfl)
rockM = cel('rock', [(0, '#5a6078'), (0.5, '#b8b0a0'), (0.95, '#ece0c4')], vary=0.12, vscale=0.6)
PB = EV['PEBBLE']; K.sphere('pebble', 1, (PB['c'][0], PB['h'] * 0.45, PB['c'][2]), rockM, C, scale=(PB['r'], PB['h'] * 0.56, PB['r'] * 0.9), segs=28, rings=16)
# ---- the plane: notebook paper, a spine and two wings on hinges, a keel; the left wing can go wet ------------------------------------------------------------------------
pim = bpy.data.images.load(os.path.join(TEX, 'paper.png'))
def papermat(name, wet=False):
    m, Nn, L = nodes(name); lv = lightK(Nn, L)
    tc = Nn.new('ShaderNodeTexCoord'); mp = Nn.new('ShaderNodeMapping'); mp.inputs['Location'].default_value = (0.5, 0.5, 0); mp.inputs['Scale'].default_value = (1 / 4.0, 1 / 5.2, 1)
    sxyz = Nn.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sxyz.inputs[0]); cxy = Nn.new('ShaderNodeCombineXYZ'); L.new(sxyz.outputs['X'], cxy.inputs['X']); L.new(sxyz.outputs['Z'], cxy.inputs['Y'])
    L.new(cxy.outputs[0], mp.inputs['Vector']); ti = Nn.new('ShaderNodeTexImage'); ti.image = pim; ti.extension = 'EXTEND'; L.new(mp.outputs['Vector'], ti.inputs['Vector'])
    tone = ramp(Nn, L, lv, [(0, '#a9a4cc'), (0.5, '#f4efe6'), (0.97, '#ffffff')])
    col = mixc(Nn, L, ti.outputs['Color'], tone, blend='MULTIPLY')
    bl = backlit(Nn, L, 2.0)
    if wet:   # a wet patch spreading from the leading edge: darker, bluer, and the sun shows through it more
        nz = Nn.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.6; nz.inputs['Detail'].default_value = 6; L.new(tc.outputs['Object'], nz.inputs['Vector'])
        lead = math_(Nn, L, 'MULTIPLY', math_(Nn, L, 'SUBTRACT', 2.5, sxyz.outputs['Z']), 0.12)
        fld = math_(Nn, L, 'ADD', math_(Nn, L, 'MULTIPLY', nz.outputs['Fac'], 0.55), lead)
        wf = math_(Nn, L, 'SUBTRACT', math_(Nn, L, 'MULTIPLY', attr(Nn, 'wet').outputs['Fac'], 1.45), 0.2)
        wm = math_(Nn, L, 'GREATER_THAN', wf, fld)
        col = mixc(Nn, L, col, (0.62, 0.66, 0.8, 1), fac=wm, blend='MULTIPLY')
        bl = math_(Nn, L, 'MULTIPLY', bl, math_(Nn, L, 'ADD', 1.0, math_(Nn, L, 'MULTIPLY', wm, 0.8)))
    col = tinted(Nn, L, col, lv, 0.5)
    # sunlight through the paper: warm, with the grid and the drawing showing darker in it
    shade = math_(Nn, L, 'LESS_THAN', lv, 0.5)
    tr = math_(Nn, L, 'MULTIPLY', math_(Nn, L, 'MULTIPLY', bl, shade), 0.9)
    thru = mixc(Nn, L, ti.outputs['Color'], K.srgb('#ffd59a'), blend='MULTIPLY')
    col = mixc(Nn, L, col, thru, fac=tr)
    return finish(m, Nn, L, col, hero=True)
paperM = papermat('paper'); paperWet = papermat('paperWet', True)
PLN = K.empty('plane', C); K.bake_object(PLN, B['objs']['plane'])
def wing(name, side, m):
    e = K.empty(name, PLN); vs = []; fs = []; nz_, nx_ = 20, 6
    for j in range(nz_ + 1):
        z = 2.5 - 5.0 * j / nz_; hs = 1.9 * (2.5 - z) / 5
        for i in range(nx_ + 1): x = side * hs * i / nx_; vs.append((x, 0.02 * math.sin(math.pi * i / nx_) * (hs / 1.9), z))
    for j in range(nz_):
        for i in range(nx_): a = j * (nx_ + 1) + i; fs.append((a, a + 1, a + nx_ + 2, a + nx_ + 1) if side > 0 else (a, a + nx_ + 1, a + nx_ + 2, a + 1))
    o = K.mesh_from(name + 'm', vs, fs, m, e, smooth=True); to_char(o); return e
WL_ = wing('wingL', 1, paperWet); WR_ = wing('wingR', -1, paperM)
K.bake_object(WL_, B['objs']['wingL']); K.bake_object(WR_, B['objs']['wingR'])
for sx in (-0.015, 0.015):
    o = K.mesh_from('keel', [(sx, 0, 2.5), (sx, -0.75, 1.0), (sx, -0.75, -2.5), (sx, 0, -2.5)], [(0, 1, 2, 3)], paperM, PLN, smooth=False); to_char(o)
# ---- the dragonfly: big teal eyes, a green thorax, a long cobalt tail with gold rings, four glassy wings that beat on threes -------------------------------------------
eyeM = cel('dfeye', [(0, '#1f6a70'), (0.5, '#3fb8a8'), (0.93, '#bff4e0')], hero=True); thoM = cel('dftho', [(0, '#2a4a3a'), (0.5, '#5aa060'), (0.95, '#c8f0a0')], hero=True)
abdM = cel('dfabd', [(0, '#1a2a6a'), (0.5, '#2f5fd0'), (0.95, '#9ec0ff')], hero=True); ringM = cel('dfring', [(0, '#7a5a20'), (0.5, '#e0b040')], hero=True)
m_, WN_, WLk = nodes('dfwing'); wlv = lightK(WN_, WLk); wcol = ramp(WN_, WLk, wlv, [(0, '#b8b0d8'), (0.5, '#f4f0ff')]); wcol = mixc(WN_, WLk, wcol, K.srgb('#fff0c8'), fac=math_(WN_, WLk, 'MULTIPLY', backlit(WN_, WLk, 2.0), 0.7))
lwt = WN_.new('ShaderNodeLayerWeight'); lwt.inputs['Blend'].default_value = 0.3; wal = math_(WN_, WLk, 'ADD', 0.28, math_(WN_, WLk, 'MULTIPLY', lwt.outputs['Fresnel'], 0.5))
wingDM = finish(m_, WN_, WLk, wcol, True, alpha=wal)
DFL = K.empty('dfly', C); K.bake_object(DFL, B['objs']['dfly'])
parts = [K.sphere('dfe1', 0.3, (0.2, 0.08, 0.98), eyeM, DFL, segs=16, rings=10), K.sphere('dfe2', 0.3, (-0.2, 0.08, 0.98), eyeM, DFL, segs=16, rings=10),
         K.sphere('dftho', 1, (0, 0, 0.45), thoM, DFL, scale=(0.3, 0.32, 0.48), segs=16, rings=10)]
for k in range(16):
    zz = -0.1 - k * 0.17; rr = 0.12 * (1 - k * 0.04); parts.append(K.sphere('dfa%d' % k, 1, (0, 0.015 * k, zz), ringM if k % 4 == 3 else abdM, DFL, scale=(rr, rr, 0.13), segs=10, rings=6))
DWING = []
for (zz, ln) in ((0.62, 1.95), (0.3, 1.8)):
    for sx in (-1, 1):
        e = K.empty('dfw', DFL, (sx * 0.2, 0.22, zz)); e.rotation_mode = 'ZYX'
        w = K.sphere('dfwm', 1, (sx * ln / 2, 0, -0.05), wingDM, e, scale=(ln / 2, 0.012, 0.25), segs=16, rings=6); parts.append(w); DWING.append((e, sx))
for k in range(6): sx = -1 if k % 2 else 1; parts.append(K.cyl('dfl', 0.02, 0.35, (sx * 0.16, -0.25, 0.6 - 0.12 * (k // 2)), thoM, DFL, 4, rot=(0, 0, sx * 0.8)))
for o in DFL.children_recursive:
    if o.type == 'MESH': to_char(o)
DFv = np.array(V['df'], np.float32)
for (e, sx) in DWING: K.keys(e, 'rotation_euler', [[0.0] * N, [0.0] * N, list(map(float, sx * np.where(DFv[:, 6] > 0.5, 0.55, -0.25)))], 'CONSTANT')
# ---- the web (before the hit), its dew drops (then flying), the strands, the pollen, the seed --------------------------------------------------------------------------
W_ = EV['WEB']; threadM = cel('thread', [(0, '#c8c4dc'), (0.5, '#f6f2ff')], rim='#fff4d8'); dropM = glowmat('drop', '#fff6e4', 3.0)
def threads(name, segs, r_=0.012):
    vs = []; fs = []; sides = 4
    for (a, b) in segs:
        a = np.array(a, float); b = np.array(b, float); d = b - a; L_ = np.linalg.norm(d); d /= max(L_, 1e-9); n1 = np.cross(d, [0, 1, 0]) if abs(d[1]) < 0.9 else np.cross(d, [1, 0, 0]); n1 /= np.linalg.norm(n1); n2 = np.cross(d, n1); b0 = len(vs)
        for p in (a, b):
            for j in range(sides): an = j / sides * math.tau; vs.append(tuple(p + r_ * (math.cos(an) * n1 + math.sin(an) * n2)))
        for j in range(sides): fs.append((b0 + j, b0 + (j + 1) % sides, b0 + sides + (j + 1) % sides, b0 + sides + j))
    return K.mesh_from(name, vs, fs, threadM, C, smooth=False)
cx_, cy_, cz_ = W_['c']; Rw = W_['R']; segs = []; NR = 17
rad = lambda k: k / NR * math.tau + 0.1 * math.sin(k * 3.1)
rim_ = [(cx_ + math.cos(rad(k)) * Rw * (1 + 0.08 * math.sin(k * 2.3)), cy_ + math.sin(rad(k)) * Rw * 0.92 * (1 + 0.08 * math.sin(k * 2.3)), cz_) for k in range(NR)]
for k in range(NR): segs.append(((cx_, cy_, cz_), rim_[k])); segs.append((rim_[k], rim_[(k + 1) % NR]))
for k in range(NR * 11):
    u0, u1 = k / NR, (k + 1) / NR; f0 = 0.1 + 0.84 * u0 / 11; f1 = 0.1 + 0.84 * u1 / 11
    p0 = np.array((cx_, cy_, cz_)) + (np.array(rim_[k % NR]) - np.array((cx_, cy_, cz_))) * f0; p1 = np.array((cx_, cy_, cz_)) + (np.array(rim_[(k + 1) % NR]) - np.array((cx_, cy_, cz_))) * f1; segs.append((p0, p1))
an_ = W_['anchors']
segs.append((rim_[NR // 2], (an_[0][0] + 0.15, an_[0][2] * 0 + cy_ + 1.5, an_[0][1]))); segs.append((rim_[0], (an_[1][0] - 0.15, cy_ + 0.8, an_[1][1])))
segs.append((rim_[NR // 4], (an_[0][0] + 0.12, cy_ + 5.5, an_[0][1]))); segs.append((rim_[3 * NR // 4], (cx_ + 0.3, terrain(cx_, cz_) + 0.4, cz_)))
web = threads('web', segs); WON = V['webOn']
K.keys(web, 'hide_render', [[0.0 if v > 0.5 else 1.0 for v in WON]], 'CONSTANT')
torn = threads('torn', [((an_[0][0] + 0.15, cy_ + 1.5, an_[0][1]), (an_[0][0] + 1.3, cy_ - 0.6, an_[0][1] + 0.2)), ((an_[1][0] - 0.15, cy_ + 0.8, an_[1][1]), (an_[1][0] - 1.0, cy_ - 1.6, an_[1][1] - 0.2))])
K.keys(torn, 'hide_render', [[1.0 if v > 0.5 else 0.0 for v in WON]], 'CONSTANT')
DRv = np.array(V['drops'], np.float32).reshape(N, EV['NDROP'], 4)
for i, d in enumerate(EV['DROPS']):
    o = K.sphere('drop%d' % i, d[3], (0, 0, 0), dropM, C, segs=10, rings=6); o.visible_shadow = False
    loc = np.where((DRv[:, i, 3] > 0.5)[:, None], DRv[:, i, :3], np.array([0, -60, 0], np.float32)); K.keys(o, 'location', [list(map(float, loc[:, j])) for j in range(3)])
for k_ in ('st0', 'st1', 'st2'): DF.tube(k_, V, k_, EV['NST'], 0.016, threadM, C, sides=4, caps=False)
polM = glowmat('pollen', '#ffd84a', 2.4, objcolor=True)
POv = np.array(V['pol'], np.float32).reshape(N, EV['NPOL'], 4)
for i in range(EV['NPOL']):
    o = K.sphere('pol%d' % i, 0.04 + 0.025 * (i % 3), (0, -60, 0), polM, C, segs=12, rings=8); o.visible_shadow = False; g = POv[:, i, 3]
    loc = np.where((g > 0.01)[:, None], POv[:, i, :3], np.array([0, -60, 0], np.float32)); K.keys(o, 'location', [list(map(float, loc[:, j])) for j in range(3)]); K.keys(o, 'color', [list(map(float, g))] * 3)
puffM = cel('puff', [(0, '#e6dcd4'), (0.5, '#fffaf0')], emit=1.4, rim='#fff6e0'); seedBodyM = cel('seedb', [(0, '#6a5a4a'), (0.5, '#b89a6a')])
sd = K.empty('seed1', C)
K.cyl('sdb', 0.035, 0.3, (0, 0.15, 0), seedBodyM, sd, 5); K.cyl('sds', 0.012, 1.3, (0, 0.95, 0), puffM, sd, 4)
for k in range(11): a = k / 11 * math.tau; K.cyl('sdf%d' % k, 0.008, 0.55, (math.cos(a) * 0.24, 1.7, math.sin(a) * 0.24), puffM, sd, 3, rot=(math.sin(a) * 1.1, 0, -math.cos(a) * 1.1))
K.bake_object(sd, B['objs']['seed1'])
DF.install()
# ---- far hills (not toward the sun) and the painted sky cylinder -----------------------------------------------------------------------------------------------------------
hill1 = cel('hill1', [(0, '#5f8a86'), (0.5, '#c9c47a')], vary=0.08, vscale=0.004); hill2 = cel('hill2', [(0, '#98a2cf'), (0.5, '#e4c9b0')])
for (az, dist, sx, sy, m) in [(1.6, 1500, 900, 120, hill1), (-1.7, 1600, 1000, 140, hill1), (-0.7, 2300, 900, 110, hill2), (0.9, 2350, 1000, 120, hill2), (0.1, 2500, 1300, 160, hill2)]:   # none toward the sun (+z)
    K.sphere('hill', 1, (math.sin(az) * dist, -sy * 0.3, -math.cos(az) * dist), m, C, scale=(sx, sy, 300))
sj = json.load(open(os.path.join(TEX, 'sky.json')))
skm, SN, SL = nodes('skycyl'); uvn = SN.new('ShaderNodeUVMap')
ims = []
for st in 'ABCD':
    im = SN.new('ShaderNodeTexImage'); im.image = bpy.data.images.load(os.path.join(TEX, 'sky_%s.png' % st)); im.extension = 'EXTEND'; SL.new(uvn.outputs['UV'], im.inputs['Vector']); ims.append(im)
ab = attr(SN, 'skyAB'); cd = attr(SN, 'skyCD'); sab = SN.new('ShaderNodeSeparateXYZ'); scd = SN.new('ShaderNodeSeparateXYZ'); SL.new(ab.outputs['Vector'], sab.inputs[0]); SL.new(cd.outputs['Vector'], scd.inputs[0])
wts = [sab.outputs['X'], sab.outputs['Y'], scd.outputs['X'], scd.outputs['Y']]
accC = None; accA = None
for im, w in zip(ims, wts):
    am = math_(SN, SL, 'MULTIPLY', im.outputs['Alpha'], w)
    cm = SN.new('ShaderNodeVectorMath'); cm.operation = 'SCALE'; SL.new(im.outputs['Color'], cm.inputs[0]); SL.new(am, cm.inputs['Scale'])
    if accC is None: accC, accA = cm.outputs[0], am
    else:
        a2 = SN.new('ShaderNodeVectorMath'); a2.operation = 'ADD'; SL.new(accC, a2.inputs[0]); SL.new(cm.outputs[0], a2.inputs[1]); accC = a2.outputs[0]
        accA = math_(SN, SL, 'ADD', accA, am)
dv = SN.new('ShaderNodeVectorMath'); dv.operation = 'DIVIDE'; SL.new(accC, dv.inputs[0]); SL.new(math_(SN, SL, 'MAXIMUM', accA, 1e-4), dv.inputs[1])
cl = SN.new('ShaderNodeClamp'); SL.new(accA, cl.inputs[0])
finish(skm, SN, SL, dv.outputs[0], alpha=cl.outputs[0], aov='sky')
RC, Y0, Y1 = sj['RC'], sj['Y0'], sj['Y1']; segs_ = 256; vs = []; fs = []; uvs = []
ROT = EV['THS'] - sj['THS']    # the painted sky turned with the sun (the paintings were lit for the sun at THS 0.08)
for i in range(segs_ + 1):
    th = -math.pi + 2 * math.pi * i / segs_ + ROT
    for (y, v) in ((Y0, 0.0), (Y1, 1.0)): vs.append((math.sin(th) * RC, y, -math.cos(th) * RC - 60)); uvs.append((i / segs_, v))
for i in range(segs_): a = 2 * i; fs.append((a, a + 2, a + 3, a + 1))
cyl = K.mesh_from('skycyl', vs, fs, skm, C, False, uvs=uvs); cyl.visible_shadow = False
# ---- the world -------------------------------------------------------------------------------------------------------------------------------------------------------------
wd = bpy.data.worlds.new('world'); sc.world = wd; wd.use_nodes = True; WN = wd.node_tree.nodes; WLn = wd.node_tree.links; WN.clear()
wo = WN.new('ShaderNodeOutputWorld'); tcw = WN.new('ShaderNodeTexCoord'); sepw = WN.new('ShaderNodeSeparateXYZ'); WLn.new(tcw.outputs['Generated'], sepw.inputs[0])
GRADS = [[(0.0, '#ffe2b8'), (0.08, '#fbe3c4'), (0.2, '#a9cdee'), (0.34, '#5f95dc'), (0.55, '#2f63c8')],
         [(0.0, '#ffb070'), (0.06, '#f6b49a'), (0.18, '#c4a8d8'), (0.34, '#6a7ad0'), (0.55, '#3048a8')],
         [(0.0, '#e8909a'), (0.05, '#a87aa8'), (0.16, '#5a5a9e'), (0.34, '#2e3478'), (0.55, '#1a2058')],
         [(0.0, '#1c2448'), (0.06, '#141a3a'), (0.2, '#0c1230'), (0.55, '#060a1e')]]
def wattr(name): a = WN.new('ShaderNodeAttribute'); a.attribute_type = 'VIEW_LAYER'; a.attribute_name = name; return a
wab = wattr('skyAB'); wcd = wattr('skyCD'); s1 = WN.new('ShaderNodeSeparateXYZ'); s2 = WN.new('ShaderNodeSeparateXYZ'); WLn.new(wab.outputs['Vector'], s1.inputs[0]); WLn.new(wcd.outputs['Vector'], s2.inputs[0])
WW = [s1.outputs['X'], s1.outputs['Y'], s2.outputs['X'], s2.outputs['Y']]; acc = None
for g, w in zip(GRADS, WW):
    rw = WN.new('ShaderNodeValToRGB'); E = rw.color_ramp.elements; E[0].position = g[0][0]; E[0].color = K.srgb(g[0][1]); E[1].position = g[-1][0]; E[1].color = K.srgb(g[-1][1])
    for (p, c) in g[1:-1]: x_ = E.new(p); x_.color = K.srgb(c)
    WLn.new(sepw.outputs['Z'], rw.inputs['Fac'])
    sc_ = WN.new('ShaderNodeVectorMath'); sc_.operation = 'SCALE'; WLn.new(rw.outputs['Color'], sc_.inputs[0]); WLn.new(w, sc_.inputs['Scale'])
    if acc is None: acc = sc_.outputs[0]
    else: ad = WN.new('ShaderNodeVectorMath'); ad.operation = 'ADD'; WLn.new(acc, ad.inputs[0]); WLn.new(sc_.outputs[0], ad.inputs[1]); acc = ad.outputs[0]
sbw = wattr('sunB'); dtw = WN.new('ShaderNodeVectorMath'); dtw.operation = 'DOT_PRODUCT'; WLn.new(tcw.outputs['Generated'], dtw.inputs[0]); WLn.new(sbw.outputs['Vector'], dtw.inputs[1])
clw = WN.new('ShaderNodeMath'); clw.operation = 'MAXIMUM'; clw.inputs[1].default_value = 0; WLn.new(dtw.outputs['Value'], clw.inputs[0])
col = acc
for (pw_, c_, k_) in [(6, '#ffb070', 0.35), (60, '#ffd28a', 0.6), (1500, '#ffffff', 2.5)]:
    pw = WN.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = pw_; WLn.new(clw.outputs[0], pw.inputs[0])
    mk = WN.new('ShaderNodeMath'); mk.operation = 'MULTIPLY'; mk.inputs[1].default_value = k_; WLn.new(pw.outputs[0], mk.inputs[0])
    am = WN.new('ShaderNodeMix'); am.data_type = 'RGBA'; am.blend_type = 'ADD'; am.inputs['B'].default_value = K.srgb(c_); WLn.new(mk.outputs[0], am.inputs['Factor']); WLn.new(col, am.inputs['A']); col = am.outputs['Result']
bgs = WN.new('ShaderNodeBackground'); WLn.new(col, bgs.inputs['Color']); bga = WN.new('ShaderNodeBackground'); bga.inputs['Color'].default_value = K.srgb('#9fa6e0'); bga.inputs['Strength'].default_value = 0.32
lp = WN.new('ShaderNodeLightPath'); msw = WN.new('ShaderNodeMixShader'); WLn.new(lp.outputs['Is Camera Ray'], msw.inputs['Fac']); WLn.new(bga.outputs[0], msw.inputs[1]); WLn.new(bgs.outputs[0], msw.inputs[2]); WLn.new(msw.outputs[0], wo.inputs['Surface'])
# ---- the sun --------------------------------------------------------------------------------------------------------------------------------------------------------------
sun = K.light('SUN', 'sun', None, (0, 0, 10), 5.0, (1.0, 0.84, 0.62), angle=math.radians(0.4))
sun.rotation_mode = 'QUATERNION'; qs = [(-P2B(V['sunD'][i])).to_track_quat('-Z', 'Y') for i in range(N)]
K.keys(sun, 'rotation_quaternion', [[q[j] for q in qs] for j in range(4)])
K.keys(sun.data, 'energy', [V['sunStr']])
cols = []
for i in range(N):
    u = max(0.0, min(1.0, (8 - V['sunE'][i]) / 8)); cols.append((1.0, 0.84 - 0.18 * u, 0.62 - 0.3 * u))
K.keys(sun.data, 'color', [[c[j] for c in cols] for j in range(3)])
# ---- camera ---------------------------------------------------------------------------------------------------------------------------------------------------------------
cam = K.camera(C); K.bake_camera(cam, B['cam']); cam.data.dof.use_dof = False; cam.data.clip_end = 80; cam.data.clip_start = 0.001
# ---- render ---------------------------------------------------------------------------------------------------------------------------------------------------------------
mode = args[0]; spp = int(args[2]) if (mode == 'still' and len(args) > 2) else (int(args[1]) if mode == 'anim' and len(args) > 1 else 32)
K.render_setup(sc, N, FPS, samples=spp, glare=0, mblur=False, look='None'); sc.view_settings.view_transform = 'Standard'; sc.render.fps = FPS
if LOW: sc.render.resolution_percentage = int(os.environ.get('RES', '50'))
if mode == 'still' and len(args) > 3: sc.render.resolution_percentage = int(args[3])
try: sc.eevee.shadow_resolution_scale = 1.0
except Exception: pass
WORLDC = bpy.data.collections.new('WORLD'); sc.collection.children.link(WORLDC)
for o in list(sc.collection.objects):
    if o.type in ('MESH', 'LIGHT', 'CURVE', 'META') and not o.name.startswith('M_face'):
        sc.collection.objects.unlink(o); WORLDC.objects.link(o)
sc.render.use_freestyle = os.environ.get('NOFS') != '1'; sc.render.line_thickness_mode = 'ABSOLUTE'; sc.render.line_thickness = 3.0 * sc.render.resolution_percentage / 100
vl = sc.view_layers[0]; vl.use_pass_z = True; vl.use_freestyle = False
for nm_ in ('hero', 'glow', 'sky'): av = vl.aovs.add(); av.name = nm_; av.type = 'VALUE'
vl2 = sc.view_layers.new('lines'); vl2.use_freestyle = True; vl2.layer_collection.children['WORLD'].exclude = True
fs_ = vl2.freestyle_settings; fs_.as_render_pass = True; ls = fs_.linesets[0] if fs_.linesets else fs_.linesets.new('ink')
ls.select_by_collection = True; ls.collection = CHAR; ls.select_silhouette = True; ls.select_border = True; ls.select_crease = False; ls.select_external_contour = True
lst = ls.linestyle or bpy.data.linestyles.new('ink'); ls.linestyle = lst; lst.color = (0.2, 0.07, 0.08); lst.thickness = 3.0 * sc.render.resolution_percentage / 100
try:
    tm = lst.thickness_modifiers.new('taper', 'ALONG_STROKE'); tm.mapping = 'CURVE'; tm.value_min = 0.35; tm.value_max = 1.0
    c = tm.curve; c.curves[0].points[0].location = (0, 0.3); c.curves[0].points.new(0.5, 1.0); c.curves[0].points[-1].location = (1, 0.35); c.update()
except Exception as ex: print('taper', ex)
ng = bpy.data.node_groups.new('anime', 'CompositorNodeTree'); sc.compositing_node_group = ng; ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor'); NN = ng.nodes; LL = ng.links
rl = NN.new('CompositorNodeRLayers'); rl.scene = sc; rl.layer = vl.name
kw = NN.new('CompositorNodeKuwahara'); kw.inputs['Type'].default_value = 'Anisotropic'
for k_, v_ in [('Size', 11 * sc.render.resolution_percentage / 100), ('Uniformity', 4), ('Sharpness', 0.5), ('Eccentricity', 1.0)]: kw.inputs[k_].default_value = v_
LL.new(rl.outputs['Image'], kw.inputs['Image'])
de = NN.new('CompositorNodeDilateErode'); de.inputs['Size'].default_value = 3; LL.new(rl.outputs['hero'], de.inputs[0])
mix = NN.new('ShaderNodeMix'); mix.data_type = 'RGBA'; LL.new(de.outputs[0], mix.inputs['Factor']); LL.new(kw.outputs[0], mix.inputs['A']); LL.new(rl.outputs['Image'], mix.inputs['B'])
rl2 = NN.new('CompositorNodeRLayers'); rl2.scene = sc; rl2.layer = 'lines'
ink = rl2.outputs.get('Freestyle')
if ink is not None:
    hm = NN.new('CompositorNodeDilateErode'); hm.inputs['Size'].default_value = 3; LL.new(rl.outputs['hero'], hm.inputs[0])
    sa = NN.new('CompositorNodeSeparateColor'); LL.new(ink, sa.inputs[0])
    am = NN.new('ShaderNodeMath'); am.operation = 'MULTIPLY'; LL.new(sa.outputs['Alpha'], am.inputs[0]); LL.new(hm.outputs[0], am.inputs[1])
    mx2 = NN.new('ShaderNodeMix'); mx2.data_type = 'RGBA'; LL.new(am.outputs[0], mx2.inputs['Factor']); LL.new(mix.outputs['Result'], mx2.inputs['A']); LL.new(ink, mx2.inputs['B']); final = mx2.outputs['Result']
else: final = mix.outputs['Result']
go = NN.new('NodeGroupOutput'); LL.new(final, go.inputs[0]); sc.render.use_compositing = True
FR = os.environ.get('FRAMES', 'frames'); sub_ = 'stills' if mode == 'still' else FR; os.makedirs(os.path.join(OUT, sub_), exist_ok=True)
fo = NN.new('CompositorNodeOutputFile'); fo.directory = os.path.join(OUT, sub_) + os.sep; fo.file_name = 'p_'
fo.format.media_type = 'IMAGE'; fo.format.file_format = 'PNG'; fo.format.color_mode = 'BW'; fo.format.color_depth = '16'
for nm_ in ('hero', 'glow', 'depth'): fo.file_output_items.new('FLOAT', nm_)
mr = NN.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0; mr.inputs['From Max'].default_value = 40; LL.new(rl.outputs['Depth'], mr.inputs['Value'])
LL.new(rl.outputs['hero'], fo.inputs['hero']); LL.new(rl.outputs['glow'], fo.inputs['glow']); LL.new(mr.outputs['Result'], fo.inputs['depth'])
sc.render.image_settings.file_format = 'PNG'
if mode == 'still':
    for f in [int(x) for x in args[1].split(',')]:
        fo.file_name = 'p%04d_' % f; sc.frame_set(f); sc.render.filepath = os.path.join(OUT, 'stills', 'f%04d.png' % f); bpy.ops.render.render(write_still=True); print('still', f)
else:
    sc.render.filepath = os.path.join(OUT, FR, 'f'); sc.frame_start = int(os.environ.get('F0', '1')); sc.frame_end = int(os.environ.get('F1', str(N))); sc.frame_step = int(os.environ.get('STEP', '1'))
    bpy.ops.render.render(animation=True)
