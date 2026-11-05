"""
Garage assets (feature id: garage) - THE SHOP, BLING & ITEMS.

    garage_showroom.glb  the shop's 3D showroom: turntable, pedestal, cyclorama,
                         neon "LULU'S GARAGE" sign, softbox light stands, props
    garage_items.glb     shop items + in-drive props: Item_missile, Item_megapack,
                         Item_pepper, Item_shield, Item_phone, and the six horns
                         as display props (Horn_beep ... Horn_train)
    garage_decor.glb     every Bling decoration, each built around the car anchor
                         it bolts onto (car.attach(slot, obj) at runtime):
                         Decor_dice (dash) Decor_bow (deck) Decor_lashes (front)
                         Decor_surf (deck) Decor_crown (head) Decor_unicorn (hood)
                         Decor_flames (hood - decals shrink-wrapped onto the body)

Decorations are designed in CAR space (the same frame as assets_core's
build_lulu_car: front = -Y, metres) and then re-based onto their anchor, so
they sit exactly where they should on the real car.
"""
from lib import *
import bmesh
import math
from mathutils import Vector, Matrix

# Lulu's car anchors - must match assets_core.build_lulu_car().
ANCH = dict(hood=(0, -1.25, 0.90), deck=(0, 1.35, 0.98), front=(0, -2.08, 0.62), rear=(0, 2.08, 0.70),
            head=(0.38, 0.42, 1.87), dash=(0, -0.45, 0.93), passenger=(-0.38, 0.40, 0.90),
            mirrorL=(0.97, -0.52, 1.04), mirrorR=(-0.97, -0.52, 1.04))


def setup():
    global CHROME, DARK, BLACK, WHITE, GOLD, BRASS
    S = shared()
    CHROME, DARK, BLACK, WHITE = S.CHROME, S.DARK, S.BLACK, S.WHITE
    GOLD = mat("GxGold", "#FFC531", rough=0.25, metal=0.85)
    BRASS = mat("GxBrass", "#E0A526", rough=0.22, metal=0.9)


# ── geometry helpers ─────────────────────────────────────────────────────
def bm_tube(pts, radii, segs=10, cap=True):
    """A tube swept along a polyline (parallel-transport frames). radii: number or list."""
    bm = bmesh.new()
    pts = [Vector(p) for p in pts]
    if not hasattr(radii, "__len__"):
        radii = [radii] * len(pts)
    t0 = (pts[1] - pts[0]).normalized()
    up = Vector((0, 0, 1)) if abs(t0.z) < 0.9 else Vector((1, 0, 0))
    n = t0.cross(up).normalized()
    rings = []
    for i, p in enumerate(pts):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == len(pts) - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        t.normalize()
        n = (n - t * n.dot(t)).normalized()
        b = t.cross(n)
        r = max(radii[i], 0.0015)
        rings.append([bm.verts.new(p + (n * math.cos(2 * math.pi * j / segs) + b * math.sin(2 * math.pi * j / segs)) * r)
                      for j in range(segs)])
    for i in range(len(rings) - 1):
        A, B = rings[i], rings[i + 1]
        for j in range(segs):
            bm.faces.new((A[j], A[(j + 1) % segs], B[(j + 1) % segs], B[j]))
    if cap:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    return bm


def bm_poly(pts2d, depth):
    """Extrude an XY polygon (counter-clockwise) up along Z by depth (centred)."""
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, -depth / 2)) for x, y in pts2d]
    hi = [bm.verts.new((x, y, depth / 2)) for x, y in pts2d]
    n = len(pts2d)
    bm.faces.new(list(reversed(lo)))
    bm.faces.new(hi)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_cone(r, h, segs=16):
    """Cone with its base at z=0 and tip at z=h."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=segs, radius1=r, radius2=0.0, depth=h)
    bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
    return bm


def catmull(ctrl, n=8, closed=True):
    """Smooth a list of 2D/3D control points (Catmull-Rom); open curves keep their ends."""
    out = []
    m = len(ctrl)

    def P(i):
        return ctrl[i % m] if closed else ctrl[max(0, min(m - 1, i))]
    for i in range(m if closed else m - 1):
        p0, p1, p2, p3 = P(i - 1), P(i), P(i + 1), P(i + 2)
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 +
                                    (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in range(len(p1))))
    if not closed:
        out.append(tuple(ctrl[-1]))
    return out


def ring_at(coll, name, p, t, R, r, material):
    """A torus ring centred on p, its hole along direction t."""
    part = Part(coll, name, bm_torus(R, r, 18, 6), material, loc=p)
    part.ob.rotation_mode = "QUATERNION"
    part.ob.rotation_quaternion = Vector(t).normalized().to_track_quat("Z", "Y")
    return part


def group(coll, loc, rz=0.0):
    """An Empty to parent a cluster of parts to (bake() applies the parent transform)."""
    e = bpy.data.objects.new("grp", None)
    coll.objects.link(e)
    e.location = loc
    e.rotation_euler = (0, 0, rz)
    return e


def rebase(ob, slot, pivot=None):
    """Move a baked (car-space) object's mesh into its anchor's frame (origin = pivot or the anchor)."""
    a = Vector(ANCH[slot])
    p = Vector(pivot) if pivot else a
    ob.data.transform(Matrix.Translation(-p))
    ob.location = p - a
    return ob


def decor_root(coll, root, name, idx):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "ARROWS"
    coll.objects.link(e)
    e.parent = root
    e.location = (idx * 3.2, 0, 0)   # spread out in the .blend; the game zeroes it
    return e


def rot_part(p, rx=0, ry=0, rz=0):
    p.ob.rotation_euler = (rx, ry, rz)
    return p


# ══════════════════════════════════════════════════════════════════════════
#  BLING: car decorations
# ══════════════════════════════════════════════════════════════════════════
def build_decor():
    coll = scene_coll("GarageDecor")
    root = root_empty(coll, "GarageDecor")
    k = 0

    # ── 🎲 Fuzzy Dice: a little rear-view mirror up on the windscreen + two dice on strings
    e = decor_root(coll, root, "Decor_dice", k); k += 1
    MIRROR = mat("GxMirror", "#CFD8DC", rough=0.08, metal=0.9)
    PINK = mat("GxDicePink", "#FF4FA3", rough=0.95)
    YEL = mat("GxDiceYellow", "#FFF176", rough=0.95)
    PIP_W = mat("GxPipWhite", "#FFFFFF", rough=0.6)
    PIP_B = mat("GxPipBrown", "#5D4037", rough=0.6)
    STRING = mat("GxString", "#ECEFF1", rough=0.8)
    piv = (-0.04, -0.43, 1.205)       # just under the windscreen's top rail
    mparts = [Part(coll, "stem", bm_cyl(0.012, 0.012, 0.06, 8), DARK, loc=(-0.04, -0.41, 1.245)),
              Part(coll, "mirrorBack", bm_box(0.26, 0.04, 0.075), DARK, loc=(-0.04, -0.425, 1.205)).bevel(0.02, 2),
              Part(coll, "mirrorGlass", bm_box(0.235, 0.01, 0.058), MIRROR, loc=(-0.04, -0.402, 1.205))]
    rebase(bake(mparts, "DiceMirror", coll, parent=e), "dash")
    sw = []
    for i, (dx, drop, M, PIP, rz) in enumerate(((-0.05, 0.16, PINK, PIP_W, 0.5), (0.035, 0.20, YEL, PIP_B, -0.3))):
        cx, cy, cz = piv[0] + dx, piv[1] + 0.01, piv[2] - drop
        sw.append(limb(coll, "string", (piv[0] + dx * 0.3, piv[1], piv[2] - 0.02), (cx, cy, cz + 0.05), 0.0035, STRING))
        sw.append(Part(coll, "die", bm_box(0.10, 0.10, 0.10), M, loc=(cx, cy, cz), rot=(0, 0, rz)).bevel(0.018, 3))
        ca, sa = math.cos(rz), math.sin(rz)
        for face in (-1, 1):               # the faces toward the road (-Y) and toward Lulu (+Y)
            for (u, v) in ((-0.02, 0.02), (0.02, -0.02), (0, 0)):
                fy = face * 0.051
                px, py = u * ca - fy * sa, u * sa + fy * ca
                sw.append(Part(coll, "pip", bm_sphere(0.011, 0.005, 0.011, 8, 6), PIP, loc=(cx + px, cy + py, cz + v), rot=(0, 0, rz)))
        for (u, v) in ((-0.018, 0.018), (0.018, -0.018)):    # side face (+X)
            px, py = 0.051 * ca - u * sa, 0.051 * sa + u * ca
            sw.append(Part(coll, "pip", bm_sphere(0.004, 0.009, 0.009, 8, 6), PIP, loc=(cx + px, cy + py, cz + v), rot=(0, 0, rz)))
    rebase(bake(sw, "DiceSwing", coll, parent=e), "dash", pivot=piv)

    # ── 🎀 Giant Bow on the rear deck
    e = decor_root(coll, root, "Decor_bow", k); k += 1
    BOW = mat("GxBow", "#FF4FA3", rough=0.35)
    BOWD = mat("GxBowDark", "#C2185B", rough=0.45)
    bz = 1.20
    parts = []
    for s in (-1, 1):
        loop = Part(coll, "loop", bm_torus(0.17, 0.07, 22, 10), BOW, loc=(s * 0.27, 1.40, bz + 0.05),
                    rot=(math.pi / 2, s * 0.32, 0))
        loop.ob.scale = (1.35, 1.0, 1.0)
        parts.append(loop)
        parts.append(Part(coll, "loopIn", bm_sphere(0.20, 0.035, 0.10), BOWD, loc=(s * 0.27, 1.40, bz + 0.05), rot=(0, s * 0.32, 0)))
        tail = [(s * 0.04, 1.42, bz - 0.02), (s * 0.12, 1.55, bz - 0.12), (s * 0.20, 1.68, bz - 0.20), (s * 0.27, 1.80, bz - 0.24)]
        parts.append(Part(coll, "tail", bm_tube(tail, [0.05, 0.055, 0.06, 0.05], 8), BOW))
        parts.append(Part(coll, "tailEnd", bm_box(0.13, 0.03, 0.10), BOWD, loc=(s * 0.27, 1.81, bz - 0.25), rot=(0.3, 0, s * 0.4)))
    parts.append(Part(coll, "knot", bm_sphere(0.095, 0.085, 0.095), BOWD, loc=(0, 1.40, bz + 0.05)))
    parts.append(Part(coll, "ribbonL", bm_box(0.08, 0.02, 0.30), BOW, loc=(0, 1.40, 0.98)))
    rebase(bake(parts, "Bow", coll, parent=e), "deck", pivot=(0, 1.40, 1.0))

    # ── 👁️ Headlight Lashes: a lid + five curly lashes over each headlight
    e = decor_root(coll, root, "Decor_lashes", k); k += 1
    LASH = mat("GxLash", "#111111", rough=0.3)
    parts = []
    for s in (-1, 1):
        hx, hy, hz = s * 0.56, -1.985, 0.70
        arc = [(hx + math.cos(a) * 0.175, hy, hz + math.sin(a) * 0.125) for a in [math.radians(d) for d in range(15, 170, 11)]]
        parts.append(Part(coll, "lid", bm_tube(arc, 0.016, 8), LASH))
        for i in range(5):
            a = math.radians(40 + i * 25)                # along the top of the lid
            outer = (s * math.cos(a) + 1) / 2            # 1 = outer edge (lashes flare outward + longer)
            L = 0.07 + outer * 0.07
            bx, bzz = hx + math.cos(a) * 0.175, hz + math.sin(a) * 0.125
            nx, nz = math.cos(a), math.sin(a)
            pts = [(bx, hy, bzz),
                   (bx + nx * L * 0.45, hy - 0.025, bzz + nz * L * 0.55),
                   (bx + nx * L * 0.8 + s * 0.012, hy - 0.06, bzz + nz * L * 0.75 + 0.012),
                   (bx + nx * L + s * 0.03, hy - 0.08, bzz + nz * L * 0.7 + 0.03)]
            parts.append(Part(coll, "lash", bm_tube(pts, [0.009, 0.007, 0.005, 0.002], 6), LASH))
    rebase(bake(parts, "Lashes", coll, parent=e), "front")

    # ── 🏄 Surfboard on a roof rack over the back
    e = decor_root(coll, root, "Decor_surf", k); k += 1
    BOARD = mat("GxBoard", "#26C6DA", rough=0.25)
    BRIM = mat("GxBoardRim", "#00838F", rough=0.35)
    STRIPE = mat("GxBoardStripe", "#FF7043", rough=0.35)
    FIN = mat("GxFin", "#FFEB3B", rough=0.4)
    parts = []
    for yb in (1.05, 1.75):
        parts.append(Part(coll, "bar", bm_box(1.72, 0.06, 0.05), DARK, loc=(0, yb, 1.24)).bevel(0.015, 2))
        for s in (-1, 1):
            parts.append(limb(coll, "leg", (s * 0.80, yb, 1.24), (s * 0.84, yb, 0.86), 0.025, DARK))
    by, bz, blen = 1.72, 1.33, 1.95
    parts.append(Part(coll, "board", bm_sphere(0.29, blen / 2, 0.045, 28, 12), BOARD, loc=(0, by, bz)))
    parts.append(Part(coll, "rim", bm_sphere(0.30, blen / 2 + 0.01, 0.03, 28, 8), BRIM, loc=(0, by, bz - 0.012)))
    parts.append(Part(coll, "stripe", bm_box(0.045, blen * 0.92, 0.012), STRIPE, loc=(0, by, bz + 0.04)))
    parts.append(Part(coll, "dot", bm_cyl(0.06, 0.06, 0.01, 18), FIN, loc=(0, by + 0.55, bz + 0.042)))
    fin = Part(coll, "fin", bm_poly([(0, 0), (0.20, 0), (0.05, 0.16)], 0.018), FIN, loc=(0, by + 0.72, bz + 0.02),
               rot=(math.radians(90), 0, math.radians(90)))
    parts.append(fin)
    for s in (-1, 1):
        parts.append(Part(coll, "strap", bm_box(0.62, 0.035, 0.012), DARK, loc=(0, 1.05 + (s + 1) * 0.35, bz + 0.05)))
    rebase(bake(parts, "Surfboard", coll, parent=e), "deck")

    # ── 👑 Crown on Lulu's head
    e = decor_root(coll, root, "Decor_crown", k); k += 1
    GEM_P = mat("NeonGemPink", "#FF2E88", rough=0.15, emit=0.6)
    GEM_B = mat("NeonGemBlue", "#42A5F5", rough=0.15, emit=0.6)
    hx, hy, hz = ANCH["head"]
    cz = hz - 0.035
    parts = [Part(coll, "band", bm_cyl(0.155, 0.165, 0.075, 28), GOLD, loc=(hx, hy, cz)),
             Part(coll, "rimLo", bm_torus(0.165, 0.012, 28, 6), GOLD, loc=(hx, hy, cz - 0.035)),
             Part(coll, "rimHi", bm_torus(0.158, 0.010, 28, 6), GOLD, loc=(hx, hy, cz + 0.035))]
    for i in range(8):
        a = 2 * math.pi * i / 8
        x, y = hx + math.cos(a) * 0.155, hy + math.sin(a) * 0.155
        tall = 0.12 if i % 2 == 0 else 0.08
        parts.append(rot_part(Part(coll, "point", bm_cone(0.05, tall, 4), GOLD, loc=(x, y, cz + 0.03)), 0, 0, a + math.pi / 4))
        parts.append(Part(coll, "ball", bm_sphere(0.017), GOLD, loc=(x, y, cz + 0.035 + tall)))
        gx, gy = hx + math.cos(a) * 0.168, hy + math.sin(a) * 0.168
        parts.append(Part(coll, "gem", bm_sphere(0.022, 0.012, 0.022, 10, 6), GEM_P if i % 2 == 0 else GEM_B,
                          loc=(gx, gy, cz), rot=(0, 0, a + math.pi / 2)))
    rebase(bake(parts, "Crown", coll, parent=e), "head")

    # ── 🦄 Unicorn Horn on the nose of the hood (pearly, spiral ridge)
    e = decor_root(coll, root, "Decor_unicorn", k); k += 1
    U1 = mat("NeonUniBase", "#E1BEE7", rough=0.25, emit=0.18)
    U2 = mat("NeonUniMid", "#F8BBD0", rough=0.22, emit=0.18)
    U3 = mat("NeonUniTip", "#FFFDE7", rough=0.2, emit=0.25)
    UR = mat("GxUniRidge", "#BA68C8", rough=0.3)
    L, R0 = 0.92, 0.10
    parts = [Part(coll, "u1", bm_cyl(R0, R0 * 0.68, L * 0.32, 18), U1, loc=(0, 0, L * 0.16)),
             Part(coll, "u2", bm_cyl(R0 * 0.68, R0 * 0.36, L * 0.33, 18), U2, loc=(0, 0, L * 0.485)),
             Part(coll, "u3", bm_cone(R0 * 0.36, L * 0.35, 18), U3, loc=(0, 0, L * 0.65)),
             Part(coll, "collar", bm_torus(R0 * 1.05, 0.02, 20, 6), UR, loc=(0, 0, 0.01)),
             Part(coll, "mount", bm_cyl(R0 * 1.25, R0 * 1.25, 0.03, 20), U1, loc=(0, 0, -0.01))]
    helix = []
    for i in range(61):
        t = i / 60
        r = (R0 * (1 - t * 0.98)) + 0.004
        a = t * math.pi * 2 * 3.2
        helix.append((math.cos(a) * r, math.sin(a) * r, 0.02 + t * (L - 0.04)))
    parts.append(Part(coll, "ridge", bm_tube(helix, [0.014 * (1 - i / 75) for i in range(61)], 6), UR))
    horn = bake(parts, "UnicornHorn", coll, parent=e)
    # base on the front of the hood, raked forward like a proper unicorn
    a = ANCH["hood"]
    horn.data.transform(Matrix.Rotation(math.radians(48), 4, "X"))
    horn.location = Vector((0, -1.80, 0.875)) - Vector(a)

    # ── 🔥 Flame Decals: shrink-wrapped onto the bodywork (hood + both sides)
    e = decor_root(coll, root, "Decor_flames", k); k += 1
    FO = mat("NeonFlameOuter", "#FF5A1F", rough=0.35, emit=0.35)
    FI = mat("NeonFlameInner", "#FFD54F", rough=0.35, emit=0.45)
    # a body replica to wrap onto (same box + bevel as the real car)
    tgt = Part(coll, "flameTarget", bm_box(1.80, 3.95, 0.54), None, loc=(0, 0, 0.62)).bevel(0.2, 4)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(tgt.ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    me.transform(tgt.ob.matrix_world)
    bpy.data.objects.remove(tgt.ob)
    target = bpy.data.objects.new("flameBody", me)
    coll.objects.link(target)

    # one flame job outline in (u back along the car 0..1, v across 0..1)
    ctrl = [(0.0, 0.98), (0.30, 1.0), (0.62, 0.95), (0.98, 0.80), (0.62, 0.72), (0.50, 0.66),
            (0.80, 0.52), (0.50, 0.44), (0.40, 0.38), (0.66, 0.22), (0.36, 0.14), (0.20, 0.02), (0.0, 0.04)]
    outline = catmull(ctrl, 7)

    def flame(name, material, mapfn, shrink, inner, normal):
        pts = outline
        if inner:
            pts = [(u * 0.62, 0.5 + (v - 0.5) * 0.66) for (u, v) in outline]
        bm = bmesh.new()
        vs = [bm.verts.new(mapfn(u, v)) for (u, v) in pts]
        edges = [bm.edges.new((vs[i], vs[(i + 1) % len(vs)])) for i in range(len(vs))]
        bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges)
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.normal_update()
        flip = [f for f in bm.faces if f.normal.dot(Vector(normal)) < 0]
        if flip:
            bmesh.ops.reverse_faces(bm, faces=flip)
        p = Part(coll, name, bm, material, smooth=True)
        m = p.ob.modifiers.new("Wrap", "SHRINKWRAP")
        m.target = target
        m.wrap_method = "NEAREST_SURFACEPOINT"
        m.wrap_mode = "OUTSIDE_SURFACE"
        m.offset = shrink
        return p

    def side_map(s):
        def f(u, v):
            y = -1.86 + u * 2.05
            # stay above the front wheel arch
            arch = max(0.0, 1 - abs(y + 1.28) / 0.55)
            zb = 0.57 + 0.22 * min(1, arch * 1.6)
            return (s * 0.95, y, zb + v * (0.875 - zb))
        return f

    def hood_map(u, v):
        return ((v - 0.5) * 1.30, -1.93 + u * 1.28, 1.02)

    parts = []
    for s in (-1, 1):
        parts.append(flame("sideO", FO, side_map(s), 0.006, False, (s, 0, 0)))
        parts.append(flame("sideI", FI, side_map(s), 0.011, True, (s, 0, 0)))
    parts.append(flame("hoodO", FO, hood_map, 0.006, False, (0, 0, 1)))
    parts.append(flame("hoodI", FI, hood_map, 0.011, True, (0, 0, 1)))
    ob = bake(parts, "Flames", coll, parent=e)
    bpy.data.objects.remove(target)
    rebase(ob, "hood")
    return coll


# ══════════════════════════════════════════════════════════════════════════
#  ITEMS: shop displays + in-drive props, and the horns as display props
# ══════════════════════════════════════════════════════════════════════════
def missile_parts(coll, loc=(0, 0, 0), s=1.0, rot_z=0.0, rot_x=0.0):
    """A cartoon rocket pointing -Y (1 m long at s=1). Returns parts (caller bakes)."""
    BODY = mat("GxMslBody", "#F5F5F5", rough=0.3, metal=0.2)
    NOSE = mat("GxMslNose", "#E53935", rough=0.3)
    FINM = mat("GxMslFin", "#B71C1C", rough=0.4)
    BAND = mat("GxMslBand", "#FF4FA3", rough=0.35)
    PORT = mat("GxMslPort", "#81D4FA", rough=0.1, metal=0.3)
    M = Matrix.Translation(loc) @ Matrix.Rotation(rot_z, 4, "Z") @ Matrix.Rotation(rot_x, 4, "X") @ Matrix.Scale(s, 4)

    def P(name, bm, m, at, rx=0.0):
        if rx:
            bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(rx, 3, "X"))
        bmesh.ops.translate(bm, vec=at, verts=bm.verts)
        bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
        return Part(coll, name, bm, m)
    out = [P("body", bm_cyl(0.085, 0.085, 0.62, 18, "Y"), BODY, (0, 0.02, 0)),
           P("nose", bm_cone(0.085, 0.24, 18), NOSE, (0, -0.29, 0), rx=math.radians(90)),
           P("band", bm_cyl(0.088, 0.088, 0.07, 18, "Y"), BAND, (0, -0.12, 0)),
           P("band2", bm_cyl(0.088, 0.088, 0.04, 18, "Y"), BAND, (0, 0.22, 0)),
           P("port", bm_sphere(0.035, 0.035, 0.012, 12, 8), PORT, (0, -0.01, 0.083)),
           P("nozzle", bm_cyl(0.07, 0.05, 0.08, 16, "Y"), DARK, (0, 0.37, 0))]
    for i in range(4):
        a = i * math.pi / 2 + math.pi / 4
        fin = bm_poly([(0, 0.10), (0.13, 0.27), (0.13, 0.36), (0, 0.33)], 0.014)   # x = radial, y = along the body
        bmesh.ops.translate(fin, vec=(0.075, 0, 0), verts=fin.verts)
        bmesh.ops.rotate(fin, verts=fin.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, "Y"))
        bmesh.ops.transform(fin, matrix=M, verts=fin.verts)
        out.append(Part(coll, "fin", fin, FINM))
    return out


def item_root(coll, root, name, idx):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "ARROWS"
    coll.objects.link(e)
    e.parent = root
    e.location = (idx * 2.0, 0, 0)
    return e


def build_props():
    """The props the DRIVE needs (small; loaded at run start): the missile and Lulu's phone."""
    coll = scene_coll("GarageProps")
    root = root_empty(coll, "GarageProps")
    k = 0

    # 🚀 Missile (1.0 m, points forward)
    e = item_root(coll, root, "Item_missile", k); k += 1
    bake(missile_parts(coll), "Missile", coll, parent=e)


    # 📱 Phone (Distracted Mode) - real size, screen faces -Y
    e = item_root(coll, root, "Item_phone", k); k += 1
    SCR = mat("NeonScreen", "#4FC3F7", rough=0.15, emit=1.4)
    BUB = mat("GxBubble", "#FFFFFF", rough=0.4, emit=0.4)
    BUBY = mat("GxBubbleYellow", "#FFEB3B", rough=0.4, emit=0.4)
    CASE = mat("GxPhoneCase", "#FF4FA3", rough=0.5)
    parts = [Part(coll, "case", bm_box(0.082, 0.014, 0.158), CASE, loc=(0, 0.002, 0)).bevel(0.012, 3),
             Part(coll, "body", bm_box(0.076, 0.012, 0.152), BLACK, loc=(0, -0.002, 0)).bevel(0.01, 3),
             Part(coll, "screen", bm_box(0.066, 0.004, 0.132), SCR, loc=(0, -0.008, 0.002)).bevel(0.006, 2)]
    for i, (x, z, w, M) in enumerate(((-0.012, 0.045, 0.034, BUB), (0.012, 0.018, 0.030, BUBY), (-0.010, -0.010, 0.038, BUB), (0.014, -0.040, 0.026, BUBY))):
        parts.append(Part(coll, "msg", bm_box(w, 0.003, 0.016), M, loc=(x, -0.0105, z)).bevel(0.005, 2))
    bake(parts, "Phone", coll, parent=e)

    return coll


def build_items():
    coll = scene_coll("GarageItems")
    root = root_empty(coll, "GarageItems")
    k = 0

    # 🚀×5 Mega 5-Pack: a crate of five rockets with a BEST VALUE ribbon
    e = item_root(coll, root, "Item_megapack", k); k += 1
    WOOD = mat("GxCrate", "#B07A45", rough=0.85)
    WOODD = mat("GxCrateDark", "#7A5230", rough=0.85)
    RIB = mat("GxRibbon", "#FFC107", rough=0.4)
    RIBT = mat("GxRibbonText", "#5D3A00", rough=0.6)
    parts = [Part(coll, "crate", bm_box(0.95, 0.62, 0.30), WOOD, loc=(0, 0, 0.15)).bevel(0.02, 2)]
    for y in (-0.31, 0.31):
        parts.append(Part(coll, "slat", bm_box(0.97, 0.04, 0.06), WOODD, loc=(0, y, 0.24)))
        parts.append(Part(coll, "slat", bm_box(0.97, 0.04, 0.06), WOODD, loc=(0, y, 0.06)))
    for i, (x, rz, z) in enumerate(((-0.34, 0.5, 0.36), (-0.17, 0.25, 0.42), (0, 0, 0.47), (0.17, -0.25, 0.42), (0.34, -0.5, 0.36))):
        parts += missile_parts(coll, loc=(x, -0.02, z), s=0.62, rot_z=rz * 0.35, rot_x=math.radians(-38))
    parts.append(Part(coll, "ribbon", bm_box(0.62, 0.02, 0.13), RIB, loc=(0, -0.325, 0.16)).bevel(0.01, 2))
    parts.append(Part(coll, "ribbonTxt", bm_text("BEST VALUE", 0.075), RIBT, loc=(0, -0.337, 0.16), rot=(math.pi / 2, 0, 0), smooth=False))
    bake(parts, "MegaPack", coll, parent=e)

    # 🌶️ Pepper Spray (real size: 25 cm can)
    e = item_root(coll, root, "Item_pepper", k); k += 1
    CAN = mat("GxCan", "#E53935", rough=0.3, metal=0.35)
    LABEL = mat("GxCanLabel", "#FFF3E0", rough=0.7)
    PEP = mat("GxPepper", "#7CB342", rough=0.5)
    PEPR = mat("GxPepperRed", "#D50000", rough=0.45)
    parts = [Part(coll, "can", bm_cyl(0.045, 0.045, 0.20, 20), CAN, loc=(0, 0, 0.10)).bevel(0.008, 2),
             Part(coll, "label", bm_cyl(0.0465, 0.0465, 0.075, 20), LABEL, loc=(0, 0, 0.10)),
             Part(coll, "shoulder", bm_cyl(0.045, 0.026, 0.03, 20), CAN, loc=(0, 0, 0.215)),
             Part(coll, "cap", bm_cyl(0.026, 0.026, 0.035, 16), BLACK, loc=(0, 0, 0.245)).bevel(0.006, 2),
             Part(coll, "nozzle", bm_box(0.018, 0.045, 0.016), BLACK, loc=(0, -0.03, 0.258)).bevel(0.004, 2),
             Part(coll, "chili", bm_sphere(0.012, 0.010, 0.026), PEPR, loc=(0, -0.047, 0.098), rot=(0, 0.6, 0)),
             Part(coll, "stem", bm_cyl(0.004, 0.004, 0.012, 6), PEP, loc=(0.012, -0.047, 0.12))]
    bake(parts, "Pepper", coll, parent=e)

    # 🛡️ Shield: a bubble-shield emitter puck with a glowing dome
    e = item_root(coll, root, "Item_shield", k); k += 1
    DOME = mat("NeonShield", "#4FC3F7", rough=0.1, emit=1.6)
    RING = mat("NeonShieldRing", "#B3E5FC", rough=0.2, emit=2.2)
    parts = [Part(coll, "base", bm_cyl(0.30, 0.34, 0.10, 28), CHROME, loc=(0, 0, 0.05)).bevel(0.02, 2),
             Part(coll, "plate", bm_cyl(0.26, 0.26, 0.03, 28), DARK, loc=(0, 0, 0.115)),
             Part(coll, "ring", bm_torus(0.27, 0.018, 28, 6), RING, loc=(0, 0, 0.10)),
             Part(coll, "dome", bm_sphere(0.20, 0.20, 0.17, 24, 12), DOME, loc=(0, 0, 0.13))]
    for i in range(3):
        a = 2 * math.pi * i / 3
        parts.append(limb(coll, "fork", (math.cos(a) * 0.24, math.sin(a) * 0.24, 0.10), (math.cos(a) * 0.26, math.sin(a) * 0.26, 0.40), 0.012, CHROME))
        parts.append(Part(coll, "tip", bm_sphere(0.03), RING, loc=(math.cos(a) * 0.26, math.sin(a) * 0.26, 0.42)))
    bake(parts, "Shield", coll, parent=e)

    # ── the horns, as display props ─────────────────────────────────────
    # 📢 Classic Beep: a chrome car-horn speaker
    e = item_root(coll, root, "Horn_beep", k); k += 1
    RED = mat("GxHornRed", "#E53935", rough=0.4)
    parts = [Part(coll, "can", bm_cyl(0.16, 0.16, 0.12, 28, "Y"), CHROME, loc=(0, 0.05, 0.25)).bevel(0.02, 2),
             Part(coll, "grill", bm_cyl(0.13, 0.13, 0.02, 28, "Y"), DARK, loc=(0, -0.02, 0.25)),
             Part(coll, "cap", bm_cyl(0.05, 0.05, 0.03, 18, "Y"), RED, loc=(0, -0.035, 0.25)),
             Part(coll, "bracket", bm_box(0.06, 0.04, 0.22), DARK, loc=(0, 0.13, 0.11)),
             Part(coll, "foot", bm_box(0.22, 0.14, 0.03), DARK, loc=(0, 0.13, 0.015))]
    bake(parts, "HornBeep", coll, parent=e)

    # 🦆 Rubber Duck
    e = item_root(coll, root, "Horn_duck", k); k += 1
    DUCK = mat("GxDuck", "#FFD600", rough=0.35)
    BEAK = mat("GxBeak", "#FF8F00", rough=0.4)
    parts = [Part(coll, "body", bm_sphere(0.17, 0.21, 0.13, 22, 14), DUCK, loc=(0, 0.02, 0.13)),
             Part(coll, "tail", bm_sphere(0.06, 0.08, 0.07), DUCK, loc=(0, 0.21, 0.20), rot=(0.6, 0, 0)),
             Part(coll, "head", bm_sphere(0.11, 0.11, 0.105, 20, 14), DUCK, loc=(0, -0.10, 0.31)),
             Part(coll, "beak", bm_sphere(0.055, 0.07, 0.022, 16, 8), BEAK, loc=(0, -0.20, 0.29)),
             Part(coll, "beakLo", bm_sphere(0.045, 0.055, 0.015, 14, 6), BEAK, loc=(0, -0.19, 0.27))]
    for s in (-1, 1):
        parts.append(Part(coll, "eye", bm_sphere(0.02, 0.012, 0.024), BLACK, loc=(s * 0.055, -0.19, 0.34)))
        parts.append(Part(coll, "wing", bm_sphere(0.04, 0.11, 0.07), DUCK, loc=(s * 0.15, 0.04, 0.16), rot=(0.3, 0, 0)))
    bake(parts, "HornDuck", coll, parent=e)

    # 🤡 Clown Horn: red rubber bulb + curly brass tube + bell
    e = item_root(coll, root, "Horn_clown", k); k += 1
    BULB = mat("GxBulb", "#E53935", rough=0.6)
    tube = [(0, 0.20, 0.20), (0, 0.10, 0.20), (0, 0.02, 0.24), (0, -0.04, 0.30), (0, -0.02, 0.36), (0, 0.05, 0.36), (0, 0.06, 0.30),
            (0, 0.0, 0.24), (0, -0.10, 0.22), (0, -0.18, 0.24)]
    parts = [Part(coll, "bulb", bm_sphere(0.10, 0.12, 0.10, 20, 14), BULB, loc=(0, 0.30, 0.20)),
             Part(coll, "collar", bm_cyl(0.035, 0.035, 0.05, 14, "Y"), BRASS, loc=(0, 0.21, 0.20)),
             Part(coll, "tube", bm_tube(catmull(tube, 4, closed=False), 0.02, 10), BRASS),
             Part(coll, "bell", bm_cyl(0.025, 0.11, 0.14, 22, "Y"), BRASS, loc=(0, -0.25, 0.245)),
             Part(coll, "foot", bm_box(0.08, 0.40, 0.02), DARK, loc=(0, 0.05, 0.01)),
             limb(coll, "post", (0, 0.05, 0.02), (0, 0.05, 0.22), 0.012, DARK)]
    bake(parts, "HornClown", coll, parent=e)

    # 📯 Shofar: a curling ram's horn
    e = item_root(coll, root, "Horn_shofar", k); k += 1
    IVORY = mat("GxShofar", "#E9D3A8", rough=0.45)
    TAN = mat("GxShofarTip", "#9C6B3E", rough=0.5)
    path, radii = [], []
    N = 40
    for i in range(N + 1):
        t = i / N
        a = t * math.pi * 1.25
        r = 0.34 - t * 0.12
        path.append((0, -math.cos(a) * r * 1.1 + 0.05, 0.12 + math.sin(a) * r * 0.8 + t * 0.12))
        radii.append(0.075 * (1 - t) ** 1.1 + 0.012)
    cut = int(N * 0.82)
    parts = [Part(coll, "horn", bm_tube(path[:cut + 1], radii[:cut + 1], 14), IVORY),
             Part(coll, "tip", bm_tube(path[cut:], radii[cut:], 14), TAN)]
    for i in range(5, cut, 5):
        t = Vector(path[i + 1]) - Vector(path[i - 1])
        parts.append(ring_at(coll, "ridge", path[i], t, radii[i], 0.008, TAN))
    bake(parts, "HornShofar", coll, parent=e)

    # 🎺 La Cucaracha: a trumpet
    e = item_root(coll, root, "Horn_cucaracha", k); k += 1
    pipe = [(0, 0.34, 0.20), (0, 0.0, 0.20), (0, -0.10, 0.20), (0, -0.14, 0.17), (0, -0.10, 0.14), (0, 0.10, 0.14),
            (0, 0.16, 0.11), (0, 0.10, 0.08), (0, -0.05, 0.08)]
    parts = [Part(coll, "pipe", bm_tube(pipe, 0.016, 10), BRASS),
             Part(coll, "bell", bm_cyl(0.017, 0.10, 0.18, 22, "Y"), BRASS, loc=(0, -0.14, 0.08)),
             Part(coll, "mouth", bm_cyl(0.022, 0.012, 0.05, 12, "Y"), BRASS, loc=(0, 0.36, 0.20))]
    for i in range(3):
        y = -0.02 + i * 0.05
        parts.append(Part(coll, "valve", bm_cyl(0.018, 0.018, 0.10, 12), BRASS, loc=(0, y, 0.17)))
        parts.append(Part(coll, "button", bm_cyl(0.020, 0.020, 0.012, 12), WHITE, loc=(0, y, 0.225)))
    parts.append(Part(coll, "stand", bm_cyl(0.10, 0.10, 0.02, 20), DARK, loc=(0, 0.1, 0.01)))
    parts.append(limb(coll, "post", (0, 0.1, 0.02), (0, 0.08, 0.08), 0.01, DARK))
    bake(parts, "HornTrumpet", coll, parent=e)

    # 🚂 Train Horn: twin chrome air horns on a bracket
    e = item_root(coll, root, "Horn_train", k); k += 1
    parts = [Part(coll, "manifold", bm_box(0.30, 0.10, 0.08), DARK, loc=(0, 0.25, 0.12)).bevel(0.02, 2),
             Part(coll, "base", bm_box(0.36, 0.18, 0.03), DARK, loc=(0, 0.25, 0.015)),
             limb(coll, "post", (0, 0.25, 0.03), (0, 0.25, 0.08), 0.02, DARK)]
    for x, L, r in ((-0.08, 0.52, 0.10), (0.08, 0.36, 0.08)):
        parts.append(Part(coll, "tube", bm_cyl(0.025, 0.035, L, 18, "Y"), CHROME, loc=(x, 0.22 - L / 2, 0.14 + (0.04 if L > 0.4 else 0))))
        parts.append(Part(coll, "bell", bm_cyl(0.035, r, 0.12, 22, "Y"), CHROME, loc=(x, 0.22 - L - 0.06, 0.14 + (0.04 if L > 0.4 else 0))))
    bake(parts, "HornTrain", coll, parent=e)
    return coll


# ══════════════════════════════════════════════════════════════════════════
#  THE SHOWROOM
# ══════════════════════════════════════════════════════════════════════════
def build_showroom():
    coll = scene_coll("GarageShowroom")
    root = root_empty(coll, "GarageShowroom")
    FLOOR = mat("GxFloor", "#2E3B42", rough=0.32, metal=0.1)
    FLOORL = mat("GxFloorLine", "#3C4C55", rough=0.4)
    WALL = mat("GxWall", "#455A64", rough=0.85)
    WALLD = mat("GxWallDark", "#37474F", rough=0.85)
    TT = mat("GxTurntable", "#546E7A", rough=0.35, metal=0.3)
    TTD = mat("GxTurntableDark", "#263238", rough=0.5, metal=0.2)
    PINKN = mat("NeonPink", "#FF4FA3", rough=0.3, emit=2.5)
    SIGNB = mat("GxSignBoard", "#1B2429", rough=0.6)
    GOLDN = mat("NeonGold", "#FFD54F", rough=0.3, emit=2.2)
    SOFT = mat("NeonSoftbox", "#FFF8EC", rough=0.5, emit=3.5)
    TIRE = shared().TIRE
    RED = mat("GxToolRed", "#D32F2F", rough=0.4, metal=0.3)
    CONE = mat("GxCone", "#FF7043", rough=0.6)
    PEG = mat("GxPegboard", "#C9A27A", rough=0.9)
    CAN = mat("GxOilCan", "#43A047", rough=0.4, metal=0.4)

    # floor + a pink inlay ring around the turntable + tile lines
    parts = [Part(coll, "floor", bm_cyl(15, 15, 0.1, 64), FLOOR, loc=(0, 0, -0.05)),
             Part(coll, "inlay", bm_torus(3.75, 0.05, 64, 6), PINKN, loc=(0, 0, 0.0))]
    for i in range(-6, 7):
        parts.append(Part(coll, "lineX", bm_box(30, 0.03, 0.004), FLOORL, loc=(0, i * 2.2, 0.001)))
        parts.append(Part(coll, "lineY", bm_box(0.03, 30, 0.004), FLOORL, loc=(i * 2.2, 0, 0.001)))
    # curved cyclorama wall behind (the camera looks toward +Y in Blender)
    segs = 28
    for i in range(segs):
        a0 = math.radians(12 + i * (156 / segs))
        a1 = math.radians(12 + (i + 1) * (156 / segs))
        am = (a0 + a1) / 2
        w = 2 * 11.5 * math.sin((a1 - a0) / 2) + 0.05
        p = Part(coll, "wall", bm_box(w, 0.25, 8.0), WALL, loc=(math.cos(am) * 11.5, math.sin(am) * 11.5, 4.0), rot=(0, 0, am - math.pi / 2))
        parts.append(p)
        parts.append(Part(coll, "skirt", bm_box(w, 0.3, 0.35), WALLD, loc=(math.cos(am) * 11.35, math.sin(am) * 11.35, 0.17), rot=(0, 0, am - math.pi / 2)))
    # neon sign on the back wall: LULU'S GARAGE + a coin
    parts.append(Part(coll, "signBoard", bm_box(7.6, 0.12, 1.55), SIGNB, loc=(0, 11.15, 5.0)).bevel(0.08, 3))
    parts.append(Part(coll, "signTxt", bm_text("LULU'S GARAGE", 0.95, extrude=0.03), PINKN, loc=(0.35, 11.05, 4.95),
                      rot=(math.pi / 2, 0, 0), smooth=False))
    parts.append(Part(coll, "coin", bm_cyl(0.45, 0.45, 0.06, 28, "Y"), GOLDN, loc=(-3.15, 11.05, 4.98)))
    parts.append(Part(coll, "coinIn", bm_cyl(0.32, 0.32, 0.08, 28, "Y"), GOLD, loc=(-3.15, 11.03, 4.98)))
    parts.append(Part(coll, "signTube", bm_box(7.2, 0.04, 0.05), PINKN, loc=(0, 11.04, 4.32)))
    # softbox light stands (left + right of the turntable, aimed in)
    for s in (-1, 1):
        x, y = s * 5.6, 1.8
        aim = math.atan2(-y, -x)
        for j in range(3):
            a = aim + math.pi + (j - 1) * 2.1
            parts.append(limb(coll, "leg", (x, y, 1.0), (x + math.cos(a) * 0.55, y + math.sin(a) * 0.55, 0.0), 0.022, DARK))
        parts.append(limb(coll, "pole", (x, y, 0.95), (x, y, 2.75), 0.025, CHROME))
        yaw = aim + math.pi / 2          # local -Y (the lit face) points at the turntable
        parts.append(Part(coll, "softbox", bm_box(1.25, 0.32, 0.9), BLACK, loc=(x, y, 3.05), rot=(math.radians(18), 0, yaw)).bevel(0.03, 2))
        parts.append(Part(coll, "softface", bm_box(1.12, 0.02, 0.78), SOFT,
                          loc=(x + math.cos(aim) * 0.17, y + math.sin(aim) * 0.17, 3.05 - 0.05), rot=(math.radians(18), 0, yaw)))
    # props: tire stack, red tool chest, cones, pegboard with tools, oil cans
    for i in range(4):
        parts.append(Part(coll, "tire", bm_torus(0.36, 0.17, 24, 10), TIRE, loc=(7.6, 5.4, 0.17 + i * 0.33)))
    parts.append(Part(coll, "tire", bm_torus(0.36, 0.17, 24, 10), TIRE, loc=(8.5, 4.4, 0.17)))
    g = group(coll, (-7.4, 6.6, 0), math.radians(-28))
    parts.append(Part(coll, "chest", bm_box(1.5, 0.75, 1.15), RED, loc=(0, 0, 0.62), parent=g).bevel(0.04, 2))
    for j in range(4):
        parts.append(Part(coll, "drawer", bm_box(1.38, 0.03, 0.04), CHROME, loc=(0, -0.385, 0.30 + j * 0.24), parent=g))
    parts.append(Part(coll, "chestTop", bm_box(1.56, 0.80, 0.06), DARK, loc=(0, 0, 1.22), parent=g))
    for (cx, cy) in ((-4.6, -2.6), (4.9, -2.9), (5.6, -2.1)):
        parts.append(Part(coll, "cone", bm_cone(0.2, 0.62, 16), CONE, loc=(cx, cy, 0.04)))
        parts.append(Part(coll, "coneBase", bm_box(0.42, 0.42, 0.04), CONE, loc=(cx, cy, 0.02)))
        parts.append(Part(coll, "coneBand", bm_cyl(0.13, 0.115, 0.08, 16), WHITE, loc=(cx, cy, 0.33)))
    g2 = group(coll, (-6.6, 8.9, 0), math.radians(-38))
    parts.append(Part(coll, "peg", bm_box(3.2, 0.06, 1.8), PEG, loc=(0, 0, 2.6), parent=g2))
    for j, (u, v, L) in enumerate(((-1.1, 0.4, 0.6), (-0.6, 0.3, 0.75), (-0.1, 0.45, 0.5), (0.5, 0.2, 0.8), (1.0, 0.35, 0.55))):
        parts.append(Part(coll, "tool", bm_box(0.07, 0.03, L), CHROME if j % 2 else RED, loc=(u, -0.06, 2.6 + v - L / 2 + 0.2), parent=g2))
    for j in range(3):
        parts.append(Part(coll, "oil", bm_cyl(0.13, 0.13, 0.36, 16), CAN, loc=(6.4 + j * 0.3, 7.2 - j * 0.1, 0.18)))
    bake(parts, "Showroom", coll, parent=root)
    for helper in (g, g2):
        bpy.data.objects.remove(helper)

    # the turntable (its own object: the game spins it with the car on top)
    tparts = [Part(coll, "base", bm_cyl(3.25, 3.35, 0.10, 64), TTD, loc=(0, 0, 0.05)),
              Part(coll, "top", bm_cyl(3.05, 3.05, 0.08, 64), TT, loc=(0, 0, 0.14)),
              Part(coll, "rim", bm_torus(3.08, 0.05, 64, 8), GOLD, loc=(0, 0, 0.165)),
              Part(coll, "ring", bm_torus(2.2, 0.018, 64, 6), PINKN, loc=(0, 0, 0.18))]
    for i in range(12):
        a = 2 * math.pi * i / 12
        tparts.append(Part(coll, "stud", bm_cyl(0.06, 0.06, 0.02, 12), GOLD, loc=(math.cos(a) * 2.7, math.sin(a) * 2.7, 0.185)))
    bake(tparts, "Turntable", coll, parent=root)

    # display pedestal for items / horns (sits on the turntable)
    pparts = [Part(coll, "col", bm_cyl(0.55, 0.62, 0.85, 40), WALLD, loc=(0, 0, 0.18 + 0.425)).bevel(0.03, 2),
              Part(coll, "cap", bm_cyl(0.66, 0.66, 0.06, 40), TT, loc=(0, 0, 1.06)).bevel(0.015, 2),
              Part(coll, "goldRim", bm_torus(0.66, 0.025, 40, 6), GOLD, loc=(0, 0, 1.06)),
              Part(coll, "glow", bm_torus(0.585, 0.012, 40, 6), PINKN, loc=(0, 0, 0.30))]
    bake(pparts, "Pedestal", coll, parent=root)
    return coll


ASSETS = [
    ("garage_showroom", build_showroom),
    ("garage_props", build_props),
    ("garage_items", build_items),
    ("garage_decor", build_decor),
]
