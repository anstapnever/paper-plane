# v3 kit: meshes whose vertices follow the bake every frame (01.11.2026). Cables are tubes round a centreline, tape is a flat ribbon.
# The plan bakes a centreline per frame as a flat list [x, y, z, x, y, z, ...] (plan cm) in vals[key]; a ribbon also takes vals[key + 'N'],
# the surface normal per point. A frame-change handler rebuilds the vertices, blending to the next frame on sub-frames (motion blur).
import bpy, math
import numpy as np
REG = []

def _frames(V, key, n):
    a = np.array(V[key], dtype=np.float64); assert a.shape[1] == n * 3, (key, a.shape, n); return a.reshape(len(a), n, 3)

def _frames_tube(P, radius, sides):
    """Rings of `sides` vertices round each point, oriented by parallel transport along the line."""
    n = len(P); T = np.gradient(P, axis=0); T /= np.maximum(1e-9, np.linalg.norm(T, axis=1))[:, None]
    ref = np.array([0.0, 1.0, 0.0]) if abs(T[0][1]) < 0.9 else np.array([1.0, 0.0, 0.0])
    N0 = np.cross(T[0], ref); N0 /= max(1e-9, np.linalg.norm(N0)); Ns = [N0]
    for i in range(1, n):
        v = Ns[-1] - T[i] * np.dot(Ns[-1], T[i]); l = np.linalg.norm(v); Ns.append(v / l if l > 1e-9 else Ns[-1])
    Ns = np.array(Ns); Bs = np.cross(T, Ns); a = np.linspace(0, 2 * math.pi, sides, endpoint=False)
    R = radius if np.ndim(radius) else np.full(n, radius)
    return (P[:, None, :] + R[:, None, None] * (np.cos(a)[None, :, None] * Ns[:, None, :] + np.sin(a)[None, :, None] * Bs[:, None, :])).reshape(-1, 3)

def tube(name, V, key, n, radius, m, parent, sides=10, caps=True):
    """A cable: n points from vals[key]; radius a number or a list of n."""
    import mkit as K
    data = _frames(V, key, n); R = np.array(radius, dtype=np.float64) if np.ndim(radius) else float(radius)
    verts = _frames_tube(data[0], R, sides); faces = []
    for i in range(n - 1):
        for j in range(sides): a = i * sides + j; b = i * sides + (j + 1) % sides; faces.append((a, b, b + sides, a + sides))
    vs = [tuple(v) for v in verts]
    if caps: vs += [tuple(data[0][0]), tuple(data[0][-1])]; c0, c1 = len(vs) - 2, len(vs) - 1; faces += [(c0, (j + 1) % sides, j) for j in range(sides)] + [(c1, (n - 1) * sides + j, (n - 1) * sides + (j + 1) % sides) for j in range(sides)]
    o = K.mesh_from(name, vs, faces, m, parent)
    REG.append(dict(me=o.data, kind='tube', data=data, R=R, sides=sides, caps=caps)); return o

def ribbon(name, V, key, n, width, m, parent, thick=0.02):
    """A strip of tape: centreline vals[key], surface normals vals[key + 'N']; the strip's width lies across (tangent x normal)."""
    import mkit as K
    data = _frames(V, key, n); nrm = _frames(V, key + 'N', n)
    vs = [(0, 0, 0)] * (2 * n); faces = [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(n - 1)]
    uvs = [((i % 2), (i // 2) / max(1, n - 1)) for i in range(2 * n)]
    o = K.mesh_from(name, vs, faces, m, parent, uvs=uvs)
    if thick > 0: sd = o.modifiers.new('sol', 'SOLIDIFY'); sd.thickness = thick; sd.offset = 0
    REG.append(dict(me=o.data, kind='ribbon', data=data, nrm=nrm, w=width)); _set(REG[-1], 0, 0.0); return o

def _ribbon_verts(P, Nn, w):
    T = np.gradient(P, axis=0); T /= np.maximum(1e-9, np.linalg.norm(T, axis=1))[:, None]
    Bx = np.cross(T, Nn); l = np.linalg.norm(Bx, axis=1); Bx /= np.maximum(1e-9, l)[:, None]
    out = np.empty((2 * len(P), 3)); out[0::2] = P - Bx * w / 2; out[1::2] = P + Bx * w / 2; return out

def _set(r, i0, u):
    d = r['data']; i1 = min(i0 + 1, len(d) - 1); P = d[i0] * (1 - u) + d[i1] * u
    if r['kind'] == 'tube':
        v = _frames_tube(P, r['R'], r['sides'])
        if r['caps']: v = np.vstack([v, P[0], P[-1]])
    else:
        Nn = r['nrm'][i0] * (1 - u) + r['nrm'][i1] * u; v = _ribbon_verts(P, Nn, r['w'])
    r['me'].vertices.foreach_set('co', v.astype(np.float32).ravel()); r['me'].update()

def _handler(scene, depsgraph=None):
    f = scene.frame_current + scene.frame_subframe
    for r in REG:
        i0 = int(math.floor(f)) - 1; u = f - math.floor(f); i0 = max(0, min(len(r['data']) - 1, i0)); _set(r, i0, u)

def install():
    for h in list(bpy.app.handlers.frame_change_pre):
        if getattr(h, '__name__', '') == '_handler': bpy.app.handlers.frame_change_pre.remove(h)
    bpy.app.handlers.frame_change_pre.append(_handler)
