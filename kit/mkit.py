# mkit: the shared Blender kit for the v2 films (25.10.2026).
# Plans are written in JS (three.js convention: y up, the camera side is +z, units = cm) and baked per frame to JSON (bake.mjs).
# Everything animated lives under CONV, an empty that turns y-up cm into Blender's z-up metres, so plan numbers are used as is.
import bpy, bmesh, json, math, os, random
from mathutils import Vector, Matrix, Quaternion, Euler

KIT = os.path.dirname(os.path.abspath(__file__))
D = bpy.data

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    conv = D.objects.new('CONV', None); sc.collection.objects.link(conv); conv.rotation_euler = (math.pi / 2, 0, 0); conv.scale = (0.01, 0.01, 0.01)
    return sc, conv

def srgb(h, a=1.0):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (a,)

# ---- materials --------------------------------------------------------------------------------------------------------------------------------------
def mat(name, color, rough=0.5, metal=0.0, coat=0.0, emit=None, estr=0.0, sss=0.0, trans=0.0, alpha=1.0, sheen=0.0, ior=1.45, coat_rough=0.1):
    m = D.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(color) if isinstance(color, str) else color
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal; b.inputs['IOR'].default_value = ior
    b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = coat_rough
    if sheen: b.inputs['Sheen Weight'].default_value = sheen
    if sss: b.inputs['Subsurface Weight'].default_value = sss; b.inputs['Subsurface Radius'].default_value = (0.004, 0.002, 0.001)
    if trans: b.inputs['Transmission Weight'].default_value = trans
    if emit: b.inputs['Emission Color'].default_value = srgb(emit) if isinstance(emit, str) else emit; b.inputs['Emission Strength'].default_value = estr
    if alpha < 1: b.inputs['Alpha'].default_value = alpha
    return m

def bsdf(m): return m.node_tree.nodes['Principled BSDF']

def img_mat(name, path, rough=0.4, emit=0.0, alpha=False, coat=0.0, sequence=False, interp='Linear'):
    """A material from an image (or an image sequence: frame N shows file N)."""
    m = D.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']; t = nt.nodes.new('ShaderNodeTexImage'); t.interpolation = interp
    t.image = D.images.load(path); t.image.colorspace_settings.name = 'sRGB'
    if sequence:
        t.image.source = 'SEQUENCE'; t.image_user.use_auto_refresh = True; t.image_user.frame_start = 1; t.image_user.frame_offset = 0
        t.image_user.frame_duration = len([f for f in os.listdir(os.path.dirname(path)) if f.endswith('.png')])
    nt.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = rough; b.inputs['Coat Weight'].default_value = coat
    if emit: nt.links.new(t.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = emit
    if alpha: nt.links.new(t.outputs['Alpha'], b.inputs['Alpha']); m.surface_render_method = 'DITHERED'
    return m

def wood(name='oak', dark='#6e4426', light='#c08a54', scale=(1, 14, 1), rough=0.34, coat=0.35, distortion=7):
    m = D.materials.new(name); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links; b = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = scale; L.new(tc.outputs['Object'], mp.inputs['Vector'])
    wv = N.new('ShaderNodeTexWave'); wv.inputs['Scale'].default_value = 3.0; wv.inputs['Distortion'].default_value = distortion; wv.inputs['Detail'].default_value = 5; L.new(mp.outputs['Vector'], wv.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 60; L.new(mp.outputs['Vector'], nz.inputs['Vector'])
    mx = N.new('ShaderNodeMix'); mx.data_type = 'FLOAT'; mx.inputs['Factor'].default_value = 0.3; L.new(wv.outputs['Fac'], mx.inputs['A']); L.new(nz.outputs['Fac'], mx.inputs['B'])
    rp = N.new('ShaderNodeValToRGB'); rp.color_ramp.elements[0].color = srgb(dark); rp.color_ramp.elements[1].color = srgb(light); L.new(mx.outputs['Result'], rp.inputs['Fac'])
    L.new(rp.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = rough; b.inputs['Coat Weight'].default_value = coat
    rr = N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = rough - 0.08; rr.inputs['To Max'].default_value = rough + 0.12; L.new(nz.outputs['Fac'], rr.inputs['Value']); L.new(rr.outputs['Result'], b.inputs['Roughness'])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.04; L.new(mx.outputs['Result'], bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m

def noisy(name, color, rough=0.6, scale=40, amount=0.08, bump=0.05, **kw):
    """A plain material with a little colour and roughness variation and a fine bump (paper, plastic, fabric)."""
    m = mat(name, color, rough, **kw); nt = m.node_tree; N = nt.nodes; L = nt.links; b = N['Principled BSDF']
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = 8
    c0 = srgb(color); hsv = N.new('ShaderNodeHueSaturation'); hsv.inputs['Color'].default_value = c0
    mr = N.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = 1 - amount; mr.inputs['To Max'].default_value = 1 + amount; L.new(nz.outputs['Fac'], mr.inputs['Value']); L.new(mr.outputs['Result'], hsv.inputs['Value']); L.new(hsv.outputs['Color'], b.inputs['Base Color'])
    if bump: bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump; bp.inputs['Distance'].default_value = 0.001; L.new(nz.outputs['Fac'], bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m

# ---- geometry (plan space: y up, cm; parent = CONV or any object under it) ----------------------------------------------------------------------------
def _finish(o, m, parent, smooth=True, shadow=True):
    if m is not None:
        for mm in (m if isinstance(m, (list, tuple)) else [m]): o.data.materials.append(mm)
    if parent is not None: o.parent = parent
    if smooth and o.type == 'MESH':
        for p in o.data.polygons: p.use_smooth = True
    o.visible_shadow = shadow
    return o

def _link(o): bpy.context.scene.collection.objects.link(o); return o

def mesh_from(name, verts, faces, m=None, parent=None, smooth=True, uvs=None):
    me = D.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    if uvs is not None:
        uv = me.uv_layers.new();
        for li, l in enumerate(me.loops): uv.data[li].uv = uvs[l.vertex_index]
    o = _link(D.objects.new(name, me)); return _finish(o, m, parent, smooth)

def rbox(name, size, loc, m, parent, bevel=0.0, segs=4, rot=(0, 0, 0), smooth=True):
    """A box (size in cm, x y z in plan space), bevelled edges."""
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if bevel > 0: bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges), offset=min(bevel, min(size) / 2 - 1e-4), segments=segs, profile=0.5, affect='EDGES')
    me = D.meshes.new(name); bm.to_mesh(me); bm.free()
    o = _link(D.objects.new(name, me)); o.location = loc; o.rotation_mode = 'ZYX'; o.rotation_euler = rot
    return _finish(o, m, parent, smooth and bevel > 0)

def cyl(name, r, h, loc, m, parent, verts=48, r2=None, rot=(0, 0, 0), bevel=0.0, cap=True):
    """A cylinder along plan y (up)."""
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=verts, radius1=r, radius2=r if r2 is None else r2, depth=h)
    for v in bm.verts: v.co = Vector((v.co.x, v.co.z, -v.co.y))  # bmesh cone is along z: turn it to y
    if bevel > 0: bmesh.ops.bevel(bm, geom=[e for e in bm.edges if e.calc_face_angle(0) > 0.6], offset=bevel, segments=3, affect='EDGES')
    me = D.meshes.new(name); bm.to_mesh(me); bm.free()
    o = _link(D.objects.new(name, me)); o.location = loc; o.rotation_mode = 'ZYX'; o.rotation_euler = rot
    o = _finish(o, m, parent, True)
    if bevel <= 0:
        mo = o.modifiers.new('ws', 'WEIGHTED_NORMAL') if False else None
    return o

def sphere(name, r, loc, m, parent, scale=(1, 1, 1), segs=32, rings=16):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    me = D.meshes.new(name); bm.to_mesh(me); bm.free(); o = _link(D.objects.new(name, me)); o.location = loc; o.scale = scale
    return _finish(o, m, parent, True)

def lathe(name, prof, loc, m, parent, segs=64):
    """Revolve a profile [(r, y), ...] around plan y."""
    verts = []; faces = []; n = len(prof)
    for i in range(segs):
        a = i / segs * math.tau
        for (r, y) in prof: verts.append((r * math.cos(a), y, r * math.sin(a)))
    for i in range(segs):
        j = (i + 1) % segs
        for k in range(n - 1): faces.append((i * n + k, j * n + k, j * n + k + 1, i * n + k + 1))
    o = mesh_from(name, verts, faces, m, parent); o.location = loc; return o

def text(name, s, loc, m, parent, size=1.0, depth=0.05, rot=(0, 0, 0), align='CENTER', font=None, bevel=0.0):
    cu = D.curves.new(name, 'FONT'); cu.body = s; cu.size = size; cu.extrude = depth; cu.align_x = align; cu.align_y = 'CENTER'; cu.bevel_depth = bevel
    if font: cu.font = D.fonts.load(font, check_existing=True)
    o = _link(D.objects.new(name, cu)); o.location = loc; o.rotation_mode = 'ZYX'; o.rotation_euler = rot
    if m: o.data.materials.append(m)
    o.parent = parent; return o

def empty(name, parent, loc=(0, 0, 0)):
    o = _link(D.objects.new(name, None)); o.parent = parent; o.location = loc; o.rotation_mode = 'ZYX'; return o

# ---- the mascot v2 rig --------------------------------------------------------------------------------------------------------------------------------
FACE_W, FACE_H, FACE_Y, FACE_Z = 1.04, 0.74, 0.80, 0.506  # body centre at LEG_H + 0.5
def mascot(name, parent, face_dir, scale=2.0, color='#C25A3A'):
    """root > yaw > tilt > pitch > squash > parts + face. Units: the model is 1.24 tall; scale 2 = 2.5 cm. Face: image sequence face_dir/face_####.png."""
    root = empty(name, parent); root.scale = (scale, scale, scale)
    yaw = empty(name + '_yaw', root); tilt = empty(name + '_tilt', yaw); pitch = empty(name + '_pitch', tilt); sq = empty(name + '_sq', pitch)
    before = set(D.objects); bpy.ops.import_scene.gltf(filepath=os.path.join(KIT, 'mascot2.glb')); parts = [o for o in D.objects if o not in before and o.type == 'MESH']
    clay = mat(name + '_clay', color, 0.38, coat=0.35, sss=0.22, sheen=0.4, coat_rough=0.25); bsdf(clay).inputs['Sheen Tint'].default_value = srgb('#ffc0a0')
    toY = Matrix.Rotation(-math.pi / 2, 4, 'X'); P = {}
    for o in parts: M = o.matrix_world.copy(); o.parent = None; o.matrix_world = M
    for o in [x for x in D.objects if x not in before and x.type != 'MESH']: D.objects.remove(o)
    for o in parts:
        M = o.matrix_world.copy(); o.parent = sq; o.matrix_parent_inverse = Matrix.Identity(4); o.matrix_basis = toY @ M; o.rotation_mode = 'ZYX'
        o.data.materials.clear(); o.data.materials.append(clay); nm = o.name.split('.')[0]
        for p in o.data.polygons: p.use_smooth = True
        if nm == 'body': P[nm] = o; continue
        # limbs turn on a pivot empty in plan axes (keying the part's own euler would wipe its z-up -> y-up turn)
        pv = empty(name + '_' + nm, sq, tuple(o.matrix_basis.translation)); pv.rotation_mode = 'ZYX'
        o.parent = pv; o.matrix_basis = Matrix.Translation(-o.matrix_basis.translation) @ o.matrix_basis; P[nm] = pv
    # the face: a gently curved grid on the front
    nx, ny = 24, 16; verts = []; uvs = []
    for j in range(ny + 1):
        for i in range(nx + 1):
            u, v = i / nx, j / ny; x = (u - 0.5) * FACE_W; y = (v - 0.5) * FACE_H; xx, yy = 2 * u - 1, 2 * v - 1
            verts.append((x, FACE_Y + y, FACE_Z + 0.016 * (1 - xx * xx) * (1 - yy * yy) - 0.002)); uvs.append((u, v))
    faces = [(j * (nx + 1) + i, j * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i) for j in range(ny) for i in range(nx)]
    fm = img_mat(name + '_face', os.path.join(face_dir, 'face_0001.png'), rough=0.3, alpha=True, coat=0.5, sequence=True)
    # v3 (29.10): the face is not painted on, it's moulded: the dark ink is raised (a bump from alpha x darkness) and glossy, like a printed vinyl toy's face
    nt = fm.node_tree; N_ = nt.nodes; L_ = nt.links; bs = N_['Principled BSDF']; tx = [n for n in N_ if n.type == 'TEX_IMAGE'][0]
    bw = N_.new('ShaderNodeRGBToBW'); L_.new(tx.outputs['Color'], bw.inputs['Color'])
    inv = N_.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0; L_.new(bw.outputs['Val'], inv.inputs[1])
    ht = N_.new('ShaderNodeMath'); ht.operation = 'MULTIPLY'; L_.new(inv.outputs['Value'], ht.inputs[0]); L_.new(tx.outputs['Alpha'], ht.inputs[1])
    # a soft height: the ink sampled at 8 points round each pixel and averaged, so the bump rounds over like moulded vinyl
    uvn = N_.new('ShaderNodeUVMap'); acc = None
    for k_ in range(9):
        if k_ == 0: dx_, dy_ = 0.0, 0.0
        else: a_ = (k_ - 1) / 8 * 6.2832; dx_, dy_ = 0.006 * math.cos(a_), 0.0085 * math.sin(a_)
        ad = N_.new('ShaderNodeVectorMath'); ad.operation = 'ADD'; ad.inputs[1].default_value = (dx_, dy_, 0); L_.new(uvn.outputs['UV'], ad.inputs[0])
        t2 = N_.new('ShaderNodeTexImage'); t2.image = tx.image; t2.interpolation = 'Linear'; t2.image_user.use_auto_refresh = True; t2.image_user.frame_start = 1; t2.image_user.frame_offset = 0; t2.image_user.frame_duration = tx.image_user.frame_duration
        L_.new(ad.outputs['Vector'], t2.inputs['Vector'])
        b2 = N_.new('ShaderNodeRGBToBW'); L_.new(t2.outputs['Color'], b2.inputs['Color']); i2 = N_.new('ShaderNodeMath'); i2.operation = 'SUBTRACT'; i2.inputs[0].default_value = 1.0; L_.new(b2.outputs['Val'], i2.inputs[1])
        h2 = N_.new('ShaderNodeMath'); h2.operation = 'MULTIPLY'; L_.new(i2.outputs['Value'], h2.inputs[0]); L_.new(t2.outputs['Alpha'], h2.inputs[1])
        if acc is None: acc = h2
        else: s2 = N_.new('ShaderNodeMath'); s2.operation = 'ADD'; L_.new(acc.outputs['Value'], s2.inputs[0]); L_.new(h2.outputs['Value'], s2.inputs[1]); acc = s2
    avg = N_.new('ShaderNodeMath'); avg.operation = 'MULTIPLY'; avg.inputs[1].default_value = 1 / 9; L_.new(acc.outputs['Value'], avg.inputs[0])
    pw = N_.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 0.7; L_.new(avg.outputs['Value'], pw.inputs[0])
    bp = N_.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 1.0; bp.inputs['Distance'].default_value = 0.0009; L_.new(pw.outputs['Value'], bp.inputs['Height'])
    L_.new(bp.outputs['Normal'], bs.inputs['Normal'])
    rr_ = N_.new('ShaderNodeMapRange'); rr_.inputs['To Min'].default_value = 0.42; rr_.inputs['To Max'].default_value = 0.2; L_.new(ht.outputs['Value'], rr_.inputs['Value']); L_.new(rr_.outputs['Result'], bs.inputs['Roughness'])
    bs.inputs['Coat Weight'].default_value = 0.0; bs.inputs['Specular IOR Level'].default_value = 0.38
    dk = N_.new('ShaderNodeMix'); dk.data_type = 'RGBA'; dk.blend_type = 'MULTIPLY'; L_.new(ht.outputs['Value'], dk.inputs['Factor']); L_.new(tx.outputs['Color'], dk.inputs['A']); dk.inputs['B'].default_value = (0.25, 0.25, 0.25, 1); L_.new(dk.outputs['Result'], bs.inputs['Base Color'])
    face = mesh_from(name + '_face', verts, faces, fm, sq, uvs=uvs); face.visible_shadow = False
    rig = {'root': root, 'yaw': yaw, 'tilt': tilt, 'pitch': pitch, 'sq': sq, 'face': face, 'clay': clay, **P}
    return rig

def bake_mascot(rig, frames):
    """frames: [[x,y,z,yaw,tilt,pitch,sx,sy,sz,aLr,aLs,aRr,aRs,l0,l1,l2,l3], ...] one per frame (frame 1 = index 0)."""
    n = len(frames); col = lambda i: [f[i] for f in frames]
    keys(rig['root'], 'location', [col(0), col(1), col(2)])
    keys(rig['yaw'], 'rotation_euler', [None, col(3), None]); keys(rig['tilt'], 'rotation_euler', [None, None, col(4)]); keys(rig['pitch'], 'rotation_euler', [col(5), None, None])
    keys(rig['sq'], 'scale', [col(6), col(7), col(8)])
    keys(rig['armL'], 'rotation_euler', [None, col(10), [-a for a in col(9)]]); keys(rig['armR'], 'rotation_euler', [None, [-a for a in col(12)], col(11)])
    for i in range(4): keys(rig['leg%d' % i], 'rotation_euler', [col(13 + i), None, None])

# ---- keyframes: one per frame, linear (fast path through the layered action API) ----------------------------------------------------------------------
def keys(idb, path, comps, interp='LINEAR'):
    """comps: list per array index (None = skip); each a list of values, frame 1..n."""
    if isinstance(idb, bpy.types.Node): path = idb.path_from_id() + '.' + path; idb = idb.id_data  # node sockets animate on their tree
    for idx, vals in enumerate(comps):
        if vals is None: continue
        fc = _fcurve(idb, path, idx); n = len(vals)
        fc.keyframe_points.add(n); co = [0.0] * (2 * n)
        for i, v in enumerate(vals): co[2 * i] = i + 1; co[2 * i + 1] = v
        fc.keyframe_points.foreach_set('co', co); ip = {'LINEAR': 1, 'CONSTANT': 0, 'BEZIER': 2}[interp]
        fc.keyframe_points.foreach_set('interpolation', [ip] * n); fc.update()

def _fcurve(idb, path, idx):
    from bpy_extras import anim_utils
    try: idb.keyframe_insert(data_path=path, index=idx, frame=-1000)
    except TypeError: idb.keyframe_insert(data_path=path, frame=-1000); idx = 0
    ad = idb.animation_data; cb = anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot)
    fc = cb.fcurves.find(path, index=idx); fc.keyframe_points.clear(); return fc

def key_scalar(idb, path, vals, index=0, interp='LINEAR'):
    if index < 0:
        comps = [vals]; path_ = path
        fc = _fcurve(idb, path_, 0) if False else None
    keys(idb, path, [None] * index + [vals], interp)

# ---- objects and camera from the bake -------------------------------------------------------------------------------------------------------------------
def bake_object(o, frames):
    """frames: [[x,y,z, rx,ry,rz, sx,sy,sz, vis], ...] plan space (Euler XYZ like three.js = Blender ZYX mode)."""
    o.rotation_mode = 'ZYX'; col = lambda i: [f[i] for f in frames]
    keys(o, 'location', [col(0), col(1), col(2)]); keys(o, 'rotation_euler', [col(3), col(4), col(5)]); keys(o, 'scale', [col(6), col(7), col(8)])
    if len(frames[0]) > 9:
        vis = [f[9] for f in frames]
        if min(vis) < 0.5: keys(o, 'hide_render', [[0.0 if v > 0.5 else 1.0 for v in vis]], 'CONSTANT')

def camera(conv, sensor=24.0):
    cd = D.cameras.new('cam'); cd.sensor_fit = 'VERTICAL'; cd.sensor_height = sensor; cd.clip_start = 0.002; cd.clip_end = 30
    cam = _link(D.objects.new('cam', cd)); bpy.context.scene.camera = cam; cd.dof.use_dof = True; cd.dof.aperture_blades = 7; cd.dof.aperture_ratio = 1.0
    return cam

def to_world(p):  # plan cm (y up) -> Blender m (z up)
    return Vector((p[0] * 0.01, -p[2] * 0.01, p[1] * 0.01))

def bake_camera(cam, frames, sensor=24.0):
    """frames: [[px,py,pz, tx,ty,tz, fov_deg, fstop, roll, focus_cm or -1], ...] plan space."""
    loc = [[], [], []]; rot = [[], [], [], []]; lens = []; fd = []; fs = []; prev = None
    for f in frames:
        p = to_world(f[0:3]); t = to_world(f[3:6]); q = (t - p).to_track_quat('-Z', 'Y')
        if f[8]: q = q @ Quaternion((0, 0, 1), f[8])
        if prev is not None and prev.dot(q) < 0: q = -q
        prev = q
        for i in range(3): loc[i].append(p[i])
        for i in range(4): rot[i].append(q[i])
        lens.append((sensor / 2) / math.tan(math.radians(f[6]) / 2)); fs.append(f[7]); fd.append((f[9] if len(f) > 9 and f[9] > 0 else (t - p).length * 100) * 0.01)
    cam.rotation_mode = 'QUATERNION'; keys(cam, 'location', loc); keys(cam, 'rotation_quaternion', rot)
    keys(cam.data, 'lens', [lens]); keys(cam.data, 'dof.focus_distance', [fd]); keys(cam.data, 'dof.aperture_fstop', [fs])
    # hard cuts: where the camera jumps between 2 frames, hold the key (CONSTANT) so the motion blur doesn't smear one shot into the next
    jumps = [i for i in range(len(frames) - 1) if (Vector(frames[i + 1][0:3]) - Vector(frames[i][0:3])).length > 1.2 or abs(frames[i + 1][6] - frames[i][6]) > 3]
    if jumps:
        for idb, path, n_ in [(cam, 'location', 3), (cam, 'rotation_quaternion', 4), (cam.data, 'lens', 1), (cam.data, 'dof.focus_distance', 1), (cam.data, 'dof.aperture_fstop', 1)]:
            for k_ in range(n_):
                from bpy_extras import anim_utils
                ad_ = idb.animation_data; fc = anim_utils.action_get_channelbag_for_slot(ad_.action, ad_.action_slot).fcurves.find(path, index=k_) if ad_ and ad_.action else None
                if fc is None: continue
                for i in jumps:
                    if i < len(fc.keyframe_points): fc.keyframe_points[i].interpolation = 'CONSTANT'
    return jumps

def load_bake(path):
    return json.load(open(path, encoding='utf-8'))

# ---- render setup -------------------------------------------------------------------------------------------------------------------------------------
def render_setup(sc, n, fps=60, samples=48, vt='4', exposure=0.0, look='AgX - Medium High Contrast', mblur=True, out=None, glare=0.35):
    sc.render.engine = 'BLENDER_EEVEE'; sc.render.resolution_x = 1920; sc.render.resolution_y = 1080; sc.render.resolution_percentage = 100
    sc.render.fps = fps; sc.frame_start = 1; sc.frame_end = n
    e = sc.eevee
    for k, v in [('taa_render_samples', samples), ('use_raytracing', True), ('volumetric_tile_size', vt), ('volumetric_samples', 96), ('use_volumetric_shadows', True), ('volumetric_end', 6.0),
                 ('use_shadows', True), ('shadow_ray_count', 2), ('shadow_step_count', 8), ('use_fast_gi', True), ('fast_gi_resolution', '2'), ('motion_blur_steps', 1)]:
        try: setattr(e, k, v)
        except Exception as ex: print('skip', k, ex)
    try:
        e.ray_tracing_options.resolution_scale = '1'
    except Exception: pass
    sc.render.use_motion_blur = mblur; sc.render.motion_blur_shutter = 0.5
    try: sc.render.motion_blur_position = 'START'  # the shutter opens on the frame: with held keys at a cut, no frame sees the other shot
    except Exception as ex: print('mblur position', ex)
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = look; sc.view_settings.exposure = exposure
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '8'; sc.render.film_transparent = False
    if out: sc.render.filepath = out
    if glare > 0:
        ng = D.node_groups.new('comp', 'CompositorNodeTree'); sc.compositing_node_group = ng
        rl = ng.nodes.new('CompositorNodeRLayers'); g1 = ng.nodes.new('CompositorNodeGlare'); g2 = ng.nodes.new('CompositorNodeGlare')
        try:
            g1.inputs['Type'].default_value = 'Bloom'
        except Exception:
            try: g1.inputs['Type'].default_value = 'Fog Glow'
            except Exception as ex: print('glare type', ex)
        g1.inputs['Threshold'].default_value = 0.85; g1.inputs['Strength'].default_value = glare; g1.inputs['Size'].default_value = 0.8 if g1.inputs['Size'].type == 'VALUE' else 8
        try: g2.inputs['Type'].default_value = 'Streaks'; g2.inputs['Threshold'].default_value = 3.0; g2.inputs['Strength'].default_value = 0.25; g2.inputs['Streaks'].default_value = 4; g2.inputs['Streaks Angle'].default_value = math.radians(45)
        except Exception as ex: print('streaks', ex)
        ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor'); go = ng.nodes.new('NodeGroupOutput')
        ng.links.new(rl.outputs['Image'], g1.inputs['Image']); ng.links.new(g1.outputs['Image'], g2.inputs['Image']); ng.links.new(g2.outputs['Image'], go.inputs[0])
        sc.render.use_compositing = True

def haze(name, size, loc, parent, density=0.6, aniso=0.55, color='#fff2e2'):
    """A volume box (plan cm) that makes light beams visible."""
    v = D.materials.new(name); v.use_nodes = True; N = v.node_tree.nodes; N.remove(N['Principled BSDF']); pv = N.new('ShaderNodeVolumePrincipled')
    pv.inputs['Density'].default_value = density; pv.inputs['Anisotropy'].default_value = aniso; pv.inputs['Color'].default_value = srgb(color)
    v.node_tree.links.new(pv.outputs['Volume'], N['Material Output'].inputs['Volume'])
    o = rbox(name, size, loc, v, parent); o.visible_shadow = False; return o, pv

def world(sc, color='#2a2018', strength=0.2):
    w = D.worlds.new('world'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = srgb(color); bg.inputs['Strength'].default_value = strength
    return w, bg

def light(kind, name, parent, loc, energy, color=(1, 1, 1), size=None, angle=None, spot=None, blend=0.3, shadow=True, vol=1.0):
    ld = D.lights.new(name, kind); ld.energy = energy; ld.color = color; ld.use_shadow = shadow; ld.volume_factor = vol
    if size is not None and kind in ('AREA', 'POINT', 'SPOT'): (setattr(ld, 'size', size) if kind == 'AREA' else setattr(ld, 'shadow_soft_size', size))
    if angle is not None and kind == 'SUN': ld.angle = angle
    if spot is not None and kind == 'SPOT': ld.spot_size = spot; ld.spot_blend = blend
    o = _link(D.objects.new(name, ld)); o.parent = parent; o.location = loc
    if kind == 'AREA' and parent is not None:  # an area light under a scaled parent (CONV, 0.01) emits nothing in Eevee: take it out, same world place and size
        bpy.context.view_layer.update(); k = parent.matrix_world.to_scale().x
        if abs(k - 1) > 1e-6: wp = parent.matrix_world @ Vector(loc); o.parent = None; o.location = wp; ld.size = max(0.03, (size or 0.25) * 0.1)  # below ~1 cm Eevee drops it
    return o

def aim(o, target_plan):
    """Point a light / object's -Z at a plan-space target (o must be under CONV)."""
    bpy.context.view_layer.update()
    p = o.matrix_world.translation; t = to_world(target_plan); q = (t - p).to_track_quat('-Z', 'Y')
    pw = o.parent.matrix_world.to_quaternion() if o.parent else Quaternion()
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = pw.inverted() @ q
