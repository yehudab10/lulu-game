"""
LOOK TEST (ci/looktest, roadmap: "how far can the look go in place?") - evidence models, used ONLY with ?look=2.

    looktest_car     Lulu's pink convertible, rebuilt with more care: a lofted, rounded body (same size, same
                     wheel spots, same hook names as lulu_car), real wheel arches with dark liners, tyres with a
                     rounded sidewall + tread grooves, 5-spoke rims, chrome-ringed headlights / taillights, a
                     grille, wrap-around bumpers, door lines + handles, a dashboard with dials, a console, seats
                     with bolsters + headrests, a carpeted floor. Lulu at the wheel is today's (same geometry).
    looktest_kenney  Kenney's CC0 "sedan-sports" (Car Kit 3.1, kenney.nl, via opengameart.org/content/car-kit),
                     fitted to the game: its palette texture split into our named materials (Body / Chrome /
                     Rim / Tire / Taillight / Headlight / Glass…) so a repaint works, wheels renamed Wheel_*,
                     the body under "LuluCar_body", the windscreen pivot "ws", the anchors, a steering wheel and
                     today's Lulu at the wheel (lowered to fit under its roof). Source + licence:
                     3d/assets/looktest_kenney.LICENSE.txt. The original .glb is read from
                     3d/blender/vendor/kenney_car-kit/ (kept out of the game's assets).
    looktest_lulu    Lulu on foot with a real SKELETON (hips, spine, chest, neck, head, upper/lower arms, hands,
                     thighs, shins, feet), knees and elbows, a skirt that follows the legs a little, and three
                     authored cycles that the game cross-fades: Idle (3 s), Walk (0.8 s), Run (0.5 s). Same look,
                     same material names as lulu_person (so features/clothes can still recolour her).

Built by make_assets.py like everything else:  python 3d/blender/make_assets.py --only looktest
"""
import math
import os
import bmesh
from mathutils import Vector, Matrix
from lib import *

HERE = os.path.dirname(os.path.abspath(__file__))
KENNEY = os.path.join(HERE, "vendor", "kenney_car-kit", "sedan-sports.glb")


def setup():
    global S
    S = shared()


LITE = False      # the phone version (looktest_car_lite): fewer rings / segments / bevels, no tiny interior bits
seg = lambda full, lite: lite if LITE else full


# ─────────────────────────────────────────────────────────────────────────────
#  (b) the improved convertible
# ─────────────────────────────────────────────────────────────────────────────
L = 2.04          # half length
R = 0.34          # wheel radius (as lulu_car)
TRACK = 0.80      # half track (as lulu_car)
FY, RY = -1.28, 1.28


def _smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def prof(y):
    """The body's side + top profile at length position y (front = -y): (half width, z bottom, z top)."""
    u = y / L
    # top line: a long hood dipping to the nose, the beltline, a rounded deck falling to the tail
    top = 0.88 + 0.03 * _smooth(-1.0, 0.2, u) - 0.20 * _smooth(-0.62, -1.0, u) - 0.13 * _smooth(0.7, 1.0, u)
    bot = 0.30 + 0.07 * _smooth(-0.82, -1.0, u) + 0.09 * _smooth(0.78, 1.0, u)
    w = 0.86 - 0.10 * _smooth(-0.7, -1.0, u) - 0.07 * _smooth(0.72, 1.0, u)
    # fender bulges over the wheels
    for wy in (FY, RY):
        w += 0.045 * math.exp(-((y - wy) / 0.42) ** 2)
        top += 0.035 * math.exp(-((y - wy) / 0.38) ** 2) * (1 if wy < 0 else 0.8)
    return w, bot, top


def bm_body(nl=52, nr=32, n=3.2):
    """A lofted superellipse shell along Y, closed at both ends (rounded nose + tail in plan and side)."""
    bm = bmesh.new()
    rings = []
    for i in range(nl + 1):
        t = i / nl
        y = -L + 2 * L * (0.5 - 0.5 * math.cos(math.pi * t))           # denser at the ends
        e = max(0.0, 1 - abs(y / (L + 0.001)) ** 5) ** 0.2             # rounded ends
        w, b, tp = prof(y)
        zc, h = (b + tp) / 2, (tp - b) / 2
        ring = []
        for j in range(nr):
            a = 2 * math.pi * j / nr
            c, s = math.cos(a), math.sin(a)
            x = w * e * math.copysign(abs(c) ** (2 / n), c)
            z = zc + h * (0.35 + 0.65 * e) * math.copysign(abs(s) ** (2 / n), s)
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    for i in range(nl):
        a, b2 = rings[i], rings[i + 1]
        for j in range(nr):
            k = (j + 1) % nr
            bm.faces.new((a[j], a[k], b2[k], b2[j]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def half_x(y, z, n=3.2):
    """Half width of the body at (y, z) — where its side surface is."""
    e = max(0.0, 1 - abs(y / (L + 0.001)) ** 5) ** 0.2
    w, b, tp = prof(y)
    zc, h = (b + tp) / 2, (tp - b) / 2 * (0.35 + 0.65 * e)
    q = abs((z - zc) / h) if h > 0 else 1
    if q >= 1:
        return 0.0
    return w * e * (1 - q ** n) ** (1 / n)


def end_y(x, z, front=True):
    """Where the nose (front) / tail surface is at (x, z)."""
    ys = [i / 400 * L for i in range(401)]
    if front:
        ys = [-v for v in ys]
    best = 0.0
    for y in ys:
        if half_x(y, z) >= abs(x):
            best = y
        else:
            break
    return best


def bm_sweep(points, ry, rz, segs=10, closed=False):
    """A tube with an elliptical (horizontal ry, vertical rz) section along a path in the XY plane at each point's z."""
    bm = bmesh.new()
    rings = []
    P = [Vector(p) for p in points]
    for i, p in enumerate(P):
        a = P[max(0, i - 1)] if not closed else P[i - 1]
        b = P[min(len(P) - 1, i + 1)] if not closed else P[(i + 1) % len(P)]
        tng = (b - a)
        tng.z = 0
        tng.normalize()
        side = Vector((tng.y, -tng.x, 0))
        ring = []
        for j in range(segs):
            t = 2 * math.pi * j / segs
            ring.append(bm.verts.new(p + side * (math.cos(t) * ry) + Vector((0, 0, math.sin(t) * rz))))
        rings.append(ring)
    n = len(rings) if closed else len(rings) - 1
    for i in range(n):
        A, B = rings[i], rings[(i + 1) % len(rings)]
        for j in range(segs):
            k = (j + 1) % segs
            bm.faces.new((A[j], A[k], B[k], B[j]))
    if not closed:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_lathe(profile, segs=32):
    """Revolve a (radius, x) profile around the X axis (a tyre, a rim lip)."""
    bm = bmesh.new()
    rings = []
    for j in range(segs):
        a = 2 * math.pi * j / segs
        rings.append([bm.verts.new((x, r * math.cos(a), r * math.sin(a))) for (r, x) in profile])
    for j in range(segs):
        A, B = rings[j], rings[(j + 1) % segs]
        for i in range(len(profile) - 1):
            bm.faces.new((A[i], A[i + 1], B[i + 1], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_arch_liner(r0, r1, x0, x1, segs=20):
    """The dark inside of a wheel arch: an upper half-ring (X = across the car)."""
    bm = bmesh.new()
    vs = []
    for i in range(segs + 1):
        a = math.pi * i / segs
        c, s = math.cos(a), math.sin(a)
        vs.append([bm.verts.new((x, r * c, r * s)) for (x, r) in ((x0, r0), (x1, r0), (x1, r1), (x0, r1))])
    for i in range(segs):
        A, B = vs[i], vs[i + 1]
        for k in range(4):
            m = (k + 1) % 4
            bm.faces.new((A[k], A[m], B[m], B[k]))
    bm.faces.new(vs[0])
    bm.faces.new(list(reversed(vs[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def good_wheel(coll, root, name, loc, TIRE, RIM, CHROME, DARK, BODY):
    x, y, z = loc
    s = 1 if x > 0 else -1
    W = 0.25
    # tyre: rounded sidewall, three tread grooves
    pr = []
    nk = seg(13, 7)
    for k in range(nk):
        t = k / (nk - 1)
        xx = (-W / 2 + W * t)
        bulge = math.sin(math.pi * t) ** 0.35
        groove = -0.01 if (k in (3, 6, 9) and not LITE) else 0.0
        pr.append((R * (0.80 + 0.20 * bulge) + groove, xx))
    pr = [(R * 0.62, -W / 2 + 0.01)] + pr + [(R * 0.62, W / 2 - 0.01)]
    parts = [Part(coll, name + "_tire", bm_lathe(pr, seg(28, 16)), TIRE, loc=loc)]
    # rim: a dish + a chrome lip, 5 spokes, a centre cap, lug nuts, a brake disc behind
    ox = s * (W / 2 - 0.035)
    parts.append(Part(coll, name + "_lip", bm_torus(R * 0.66, 0.018, seg(24, 14), seg(5, 4)), CHROME, loc=(x + ox, y, z), rot=(0, math.pi / 2, 0)))
    parts.append(Part(coll, name + "_dish", bm_cyl(R * 0.64, R * 0.64, 0.03, seg(30, 14), "X"), DARK, loc=(x + ox - s * 0.03, y, z)))
    for k in range(5):
        a = 2 * math.pi * k / 5
        parts.append(Part(coll, name + "_spoke%d" % k, bm_box(0.03, 0.05, R * 0.56), RIM,
                          loc=(x + ox, y + math.sin(a) * R * 0.33, z + math.cos(a) * R * 0.33), rot=(-a, 0, 0)))
        if not LITE: parts.append(Part(coll, name + "_nut%d" % k, bm_cyl(0.014, 0.014, 0.02, 6, "X"), CHROME,
                          loc=(x + ox + s * 0.012, y + math.sin(a + 0.63) * R * 0.17, z + math.cos(a + 0.63) * R * 0.17)))
    parts.append(Part(coll, name + "_cap", bm_sphere(0.012, R * 0.12, R * 0.12, 12, 6), RIM, loc=(x + ox + s * 0.015, y, z)))
    parts.append(Part(coll, name + "_rimhub", bm_cyl(R * 0.2, R * 0.2, 0.04, 16, "X"), RIM, loc=(x + ox, y, z)))
    parts.append(Part(coll, name + "_disc", bm_cyl(R * 0.5, R * 0.5, 0.02, seg(18, 10), "X"), CHROME, loc=(x - s * 0.03, y, z)))
    return bake_at(parts, name, coll, root, loc)


def build_good_car_lite():
    global LITE
    LITE = True
    old = Part.bevel
    Part.bevel = lambda self, width, segs=3: old(self, width, 1)
    try:
        return build_good_car()
    finally:
        Part.bevel = old
        LITE = False


def build_good_car():
    import bpy
    # (built after another car in this file: free the names the game looks for)
    for o in list(bpy.data.objects):
        if o.name in ("ws", "LuluCar_body", "SteeringWheel", "Driver", "Hair_sheitel") or o.name.startswith(("Wheel_", "Anchor_")):
            o.name = "prev_" + o.name
    coll = scene_coll("LookCarLite" if LITE else "LookCar")
    root = root_empty(coll, "LookCar")
    BODY = mat("Body", "#E91E63", rough=0.28, metal=0.05)
    LIGHT = mat("BodyLight", "#F48FB1", rough=0.4)
    BDARK = mat("BodyDark", "#AD1457", rough=0.45)
    SEAT = mat("Seat", "#FFF3E0", rough=0.75)
    PIPE = mat("SeatPiping", "#E0C9A6", rough=0.7)
    CARPET = mat("Carpet", "#3A2B33", rough=0.95)
    GAUGE = mat("Gauge", "#FAFAFA", rough=0.4, emit=0.3)
    SKIN = mat("Skin", "#FFD2B0", rough=0.7)
    HAIR = mat("Hair", "#8B5A2B", rough=0.8)
    SHIRT = mat("Shirt", "#4FC3F7", rough=0.75)
    EYE = mat("Eye", "#1B1B1B", rough=0.3)
    CHEEK = mat("Cheek", "#FF8A9A", rough=0.8)
    SHADES = mat("Shades", "#111111", rough=0.15, metal=0.4)
    AMBER = mat("Indicator", "#FFB300", rough=0.3, emit=0.6)
    LENS = mat("HeadlightLens", "#FFFDF5", rough=0.05, emit=2.2)
    TIRE, RIM, CHROME, TAIL, GLASS, DARK = S.TIRE, S.RIM, S.CHROME, S.TAIL, S.GLASS, S.DARK

    parts = []
    body = Part(coll, "body", bm_body(seg(52, 34), seg(32, 22)), BODY)
    cock = Part(coll, "cockpitCut", bm_box(1.42, 1.62, 0.9), None, loc=(0, 0.26, 1.16)).bevel(0.22, 4)
    cock.ob.display_type = "WIRE"
    body.cut(cock)
    for nm, x, y in (("archFL", 1, FY), ("archFR", -1, FY), ("archRL", 1, RY), ("archRR", -1, RY)):
        arch = Part(coll, nm, bm_cyl(R + 0.085, R + 0.085, 0.62, seg(40, 20), "X"), None, loc=(x * 0.92, y, R + 0.02))
        arch.ob.display_type = "WIRE"
        body.cut(arch)
    parts.append(body)
    # the dark inside of each arch (no pink tunnel showing through)
    for x, y in ((1, FY), (-1, FY), (1, RY), (-1, RY)):
        parts.append(Part(coll, "liner", bm_arch_liner(R + 0.07, R + 0.09, 0.62, 0.93, seg(20, 10)), DARK, loc=(0, y, R + 0.02), rot=(0, 0, 0 if x > 0 else math.pi)))

    # the cockpit tub: floor, door cards, firewall, rear bulkhead
    parts.append(Part(coll, "floor", bm_box(1.38, 1.58, 0.04), CARPET, loc=(0, 0.26, 0.62)))
    for s in (-1, 1):
        parts.append(Part(coll, "doorcard", bm_box(0.05, 1.3, 0.34), SEAT, loc=(s * 0.69, 0.18, 0.86)).bevel(0.02, 2))
        parts.append(Part(coll, "doorpull", bm_box(0.03, 0.30, 0.03), BDARK, loc=(s * 0.66, -0.05, 0.92)).bevel(0.01, 2))
    parts.append(Part(coll, "bulkhead", bm_box(1.38, 0.05, 0.36), BDARK, loc=(0, 1.06, 0.82)))

    # beltline chrome + the rocker trim, door lines, handles
    z_belt = 0.80
    belt = []
    for i in range(31):
        y = -1.55 + 3.1 * i / 30
        belt.append((half_x(y, z_belt) + 0.006, y, z_belt))
    for s in (-1, 1):
        pts = [(s * p[0], p[1], p[2]) for p in belt]
        parts.append(Part(coll, "belt", bm_sweep(pts, 0.012, 0.012, seg(5, 3)), CHROME))
        rk = []
        for i in range(16):
            y = -0.72 + 1.44 * i / 15
            rk.append((s * (half_x(y, 0.38) + 0.004), y, 0.38))
        parts.append(Part(coll, "rocker", bm_sweep(rk, 0.02, 0.035, seg(6, 4)), DARK))
        # the stripe (BodyLight) a hand under the belt
        st = [(s * (half_x(p[1], 0.70) + 0.004), p[1], 0.70) for p in belt[4:-4]]
        parts.append(Part(coll, "stripe", bm_sweep(st, 0.004, 0.028, seg(6, 3)), LIGHT))
        for y in (-0.52, 0.86):
            parts.append(Part(coll, "doorline", bm_box(0.012, 0.012, 0.36), DARK, loc=(s * (half_x(y, 0.6) + 0.002), y, 0.6)))
        parts.append(Part(coll, "handle", bm_box(0.03, 0.16, 0.035), CHROME, loc=(s * (half_x(0.62, 0.74) + 0.012), 0.62, 0.74)).bevel(0.012, 2))
        # mirrors: a teardrop head on a stalk
        parts.append(Part(coll, "mirror", bm_sphere(0.075, 0.11, 0.065, seg(16, 10), seg(10, 6)), BODY, loc=(s * 0.98, -0.50, 1.00)))
        parts.append(Part(coll, "mirrorGlass", bm_sphere(0.06, 0.01, 0.05, 12, 6), CHROME, loc=(s * 0.98, -0.395, 1.00)))
        parts.append(limb(coll, "mirrorArm", (s * 0.80, -0.50, 0.86), (s * 0.95, -0.50, 0.98), 0.016, CHROME))

    # rear deck humps + headrests (the roadster look)
    for x in (-0.38, 0.38):
        parts.append(Part(coll, "hump", bm_sphere(0.27, 0.48, 0.17, seg(24, 14), seg(12, 7)), BODY, loc=(x, 1.24, 0.86)))
        parts.append(Part(coll, "headrest", bm_box(0.30, 0.10, 0.18), SEAT, loc=(x, 0.86, 1.43), rot=(-0.18, 0, 0)).bevel(0.05, 2))
        parts.append(limb(coll, "hrPost", (x, 0.84, 1.20), (x, 0.86, 1.36), 0.012, CHROME))

    # dashboard: a padded top, two dials, a console
    parts.append(Part(coll, "dash", bm_box(1.40, 0.30, 0.18), BDARK, loc=(0, -0.44, 0.86)).bevel(0.07, 3))
    parts.append(Part(coll, "dashTop", bm_box(1.36, 0.22, 0.05), CARPET, loc=(0, -0.48, 0.96)).bevel(0.02, 2))
    for k, dx in enumerate((-0.07, 0.07) if not LITE else ()):
        parts.append(Part(coll, "dialRing", bm_torus(0.055, 0.008, 18, 5), CHROME, loc=(0.38 + dx, -0.285, 0.90), rot=(math.pi / 2, 0, 0)))
        parts.append(Part(coll, "dial", bm_cyl(0.052, 0.052, 0.01, 18, "Y"), GAUGE, loc=(0.38 + dx, -0.29, 0.90)))
    parts.append(Part(coll, "console", bm_box(0.22, 0.8, 0.16), BDARK, loc=(0, 0.02, 0.70)).bevel(0.04, 2))
    parts.append(Part(coll, "radio", bm_box(0.18, 0.04, 0.08), DARK, loc=(0, -0.295, 0.82)).bevel(0.01, 2))
    parts.append(Part(coll, "shifter", bm_sphere(0.035), CHROME, loc=(0, -0.10, 0.84)))
    parts.append(limb(coll, "shiftStick", (0, -0.10, 0.78), (0, -0.10, 0.83), 0.01, DARK))

    # windscreen: glass in a chrome frame, raked (the "ws" pivot is what feel/damage cracks)
    ws = root_empty(coll, "ws")
    ws.location = (0, -0.52, 1.08)
    ws.rotation_euler = (-0.42, 0, 0)
    ws.parent = root
    parts.append(Part(coll, "wsGlass", bm_box(1.40, 0.02, 0.42), GLASS, parent=ws).bevel(0.008, 1))
    parts.append(Part(coll, "wsTop", bm_box(1.48, 0.05, 0.045), CHROME, loc=(0, 0, 0.225), parent=ws).bevel(0.02, 3))
    for s in (-1, 1):
        parts.append(Part(coll, "wsPost", bm_box(0.045, 0.05, 0.47), CHROME, loc=(s * 0.72, 0, 0), parent=ws).bevel(0.018, 3))

    # seats with bolsters + piping
    for x in (-0.38, 0.38):
        parts.append(Part(coll, "cushion", bm_box(0.52, 0.52, 0.12), SEAT, loc=(x, 0.36, 0.80)).bevel(0.05, 2))
        parts.append(Part(coll, "back", bm_box(0.52, 0.12, 0.52), SEAT, loc=(x, 0.70, 1.06), rot=(-0.18, 0, 0)).bevel(0.05, 2))
        for s in (-1, 1):
            parts.append(Part(coll, "bolster", bm_box(0.08, 0.14, 0.42), SEAT, loc=(x + s * 0.24, 0.66, 1.04), rot=(-0.18, 0, 0)).bevel(0.035, 2))
            parts.append(Part(coll, "cbolster", bm_box(0.08, 0.48, 0.07), SEAT, loc=(x + s * 0.23, 0.36, 0.88)).bevel(0.03, 2))
        parts.append(Part(coll, "piping", bm_box(0.36, 0.13, 0.012), PIPE, loc=(x, 0.65, 1.07), rot=(1.39, 0, 0)))

    # Lulu sits on the LEFT (+X); steering wheel: rim, three spokes, hub (its own object, origin at the hub)
    lx = 0.38
    swp = (lx, -0.20, 1.02)
    sw_parts = [Part(coll, "ring", bm_torus(0.17, 0.022, seg(28, 16), seg(8, 5)), DARK, loc=swp),
                Part(coll, "hub", bm_cyl(0.045, 0.045, 0.04, 16), CHROME, loc=swp)]
    for a in (0, 2.3, -2.3):
        sw_parts.append(Part(coll, "spoke", bm_box(0.16, 0.025, 0.014), CHROME,
                             loc=(lx + math.cos(a + math.pi / 2) * 0.09, -0.20 + math.sin(a + math.pi / 2) * 0.09, 1.02), rot=(0, 0, a + math.pi / 2)))
    sw = bake_at(sw_parts, "SteeringWheel", coll, root, swp)
    sw.rotation_euler = (math.radians(70), 0, 0)
    parts.append(limb(coll, "column", (lx, -0.20, 1.02), (lx, -0.44, 0.88), 0.028, DARK))

    _lulu_driver(coll, root, lx, SKIN, HAIR, SHIRT, EYE, CHEEK, SHADES, S.RIM)

    for nm, loc in (("hood", (0, -1.25, 0.92)), ("deck", (0, 1.35, 1.0)), ("front", (0, -2.06, 0.6)), ("rear", (0, 2.06, 0.70)),
                    ("head", (lx, 0.38 + 0.04, 1.60 + 0.27)), ("dash", (0, -0.45, 0.97)), ("passenger", (-0.38, 0.40, 0.88)),
                    ("mirrorL", (0.98, -0.5, 1.06)), ("mirrorR", (-0.98, -0.5, 1.06))):
        anchor(coll, root, "Anchor_" + nm, loc)

    # lights: chrome bezels, a bright lens, an amber indicator under each; taillights with a chrome surround
    for s in (-1, 1):
        hx, hz = 0.56, 0.68
        hy = end_y(s * hx, hz, front=True)
        parts.append(Part(coll, "hlBezel", bm_torus(0.12, 0.022, seg(24, 14), seg(6, 4)), CHROME, loc=(s * hx, hy + 0.025, hz), rot=(math.pi / 2, 0, 0)))
        parts.append(Part(coll, "hlLens", bm_sphere(0.115, 0.05, 0.115, seg(20, 12), seg(10, 6)), LENS, loc=(s * hx, hy + 0.035, hz)))
        parts.append(Part(coll, "indicator", bm_box(0.12, 0.03, 0.04), AMBER, loc=(s * 0.58, end_y(s * 0.58, 0.50) + 0.012, 0.50)).bevel(0.012, 2))
        tz = 0.70
        ty = end_y(s * 0.55, tz, front=False)
        parts.append(Part(coll, "taillight", bm_box(0.30, 0.05, 0.11), TAIL, loc=(s * 0.55, ty - 0.012, tz)).bevel(0.03, 3))
        parts.append(Part(coll, "tlRim", bm_box(0.34, 0.03, 0.15), CHROME, loc=(s * 0.55, ty - 0.028, tz)).bevel(0.04, 3))
    # grille: a chrome surround with bars
    gy = end_y(0, 0.52) + 0.01
    parts.append(Part(coll, "grilleSurround", bm_box(0.66, 0.04, 0.16), CHROME, loc=(0, gy, 0.52)).bevel(0.05, 3))
    parts.append(Part(coll, "grille", bm_box(0.58, 0.04, 0.11), DARK, loc=(0, gy - 0.01, 0.52)).bevel(0.03, 2))
    for k in range(4):
        parts.append(Part(coll, "grilleBar", bm_box(0.58, 0.012, 0.012), CHROME, loc=(0, gy - 0.032, 0.48 + k * 0.027)))
    # bumpers that wrap round the corners
    for front in (True, False):
        pts = []
        zb = 0.40
        for i in range(25):
            x = -0.86 + 1.72 * i / 24
            y0 = end_y(x * 0.97, zb + 0.06, front=front)
            pts.append((x * 0.97, y0 + (-0.05 if front else 0.05), zb))
        parts.append(Part(coll, "bumper", bm_sweep(pts, 0.06, 0.07, seg(8, 5)), CHROME))
    py = end_y(0, 0.56, front=False)
    parts.append(Part(coll, "plate", bm_box(0.52, 0.02, 0.16), S.PLATE, loc=(0, py + 0.01, 0.56)).bevel(0.01, 1))
    parts.append(Part(coll, "plateTxt", bm_text("LULU", 0.13), S.PLATE_TXT, loc=(0, py + 0.022, 0.56), rot=(math.pi / 2, 0, math.pi), smooth=False))

    bake(parts, "LuluCar_body", coll, parent=root, sharp_deg=50)
    for nm, x, y in (("Wheel_FL", TRACK, FY), ("Wheel_FR", -TRACK, FY), ("Wheel_RL", TRACK, RY), ("Wheel_RR", -TRACK, RY)):
        good_wheel(coll, root, nm, (x, y, R), TIRE, RIM, CHROME, DARK, BODY)
    return coll


def _lulu_driver(coll, root, lx, SKIN, HAIR, SHIRT, EYE, CHEEK, SHADES, RIM, dz=0.0, k=1.0):
    """Today's Lulu at the wheel (lulu_car's exact geometry), optionally lowered / scaled about her seat."""
    hr, hy, hz = 0.235, 0.38, 1.60
    seat = Vector((lx, 0.40, 0.88))
    P = lambda p: tuple(seat + (Vector(p) - seat) * k + Vector((0, 0, dz)))
    driver, hair = [], []
    driver.append(Part(coll, "torso", bm_sphere(0.21 * k, 0.16 * k, 0.27 * k), SHIRT, loc=P((lx, 0.46, 1.10))))
    driver.append(Part(coll, "neck", bm_cyl(0.06 * k, 0.06 * k, 0.14 * k, 10), SKIN, loc=P((lx, 0.42, 1.36))))
    driver.append(Part(coll, "head", bm_sphere(hr * k, hr * 0.95 * k, hr * 1.02 * k, 22, 16), SKIN, loc=P((lx, hy, hz))))
    hair.append(Part(coll, "hair", bm_sphere(hr * 1.08 * k, hr * k, hr * 1.04 * k, 22, 16), HAIR, loc=P((lx, hy + 0.06, hz + 0.05))))
    hair.append(Part(coll, "hairBack", bm_sphere(hr * 1.12 * k, 0.13 * k, hr * 1.45 * k), HAIR, loc=P((lx, hy + 0.15, hz - 0.18))))
    for s in (-1, 1):
        hair.append(Part(coll, "hairSide", bm_sphere(0.08 * k, 0.1 * k, 0.25 * k), HAIR, loc=P((lx + s * hr * 0.9, hy + 0.02, hz - 0.12))))
        driver.append(Part(coll, "eye", bm_sphere(0.038 * k, 0.02 * k, 0.05 * k, 10, 8), EYE, loc=P((lx + s * 0.085, hy - hr * 0.92, hz))))
        driver.append(Part(coll, "shine", bm_sphere(0.012 * k, 0.01 * k, 0.012 * k, 6, 4), RIM, loc=P((lx + s * 0.085 + 0.012, hy - hr * 0.98, hz + 0.018))))
        driver.append(Part(coll, "cheek", bm_sphere(0.04 * k, 0.012 * k, 0.025 * k, 10, 6), CHEEK, loc=P((lx + s * 0.145, hy - hr * 0.84, hz - 0.075))))
        hair.append(Part(coll, "lens", bm_sphere(0.06 * k, 0.022 * k, 0.045 * k, 10, 6), SHADES, loc=P((lx + s * 0.085, hy - 0.11, hz + 0.21)), rot=(-0.6, 0, 0)))
        a, b = P((lx + s * 0.19, 0.42, 1.24)), P((lx + s * 0.13, -0.16, 1.05))
        driver.append(limb(coll, "arm", a, b, 0.045 * k, SHIRT))
        driver.append(Part(coll, "hand", bm_sphere(0.05 * k), SKIN, loc=P((lx + s * 0.13, -0.18, 1.05))))
    driver.append(Part(coll, "mouth", bm_sphere(0.04 * k, 0.012 * k, 0.018 * k, 10, 6), EYE, loc=P((lx, hy - hr * 0.96, hz - 0.1))))
    bake(driver, "Driver", coll, parent=root)
    bake(hair, "Hair_sheitel", coll, parent=root)
    return P((lx, hy + 0.04, hz + 0.27))


# ─────────────────────────────────────────────────────────────────────────────
#  (c) Kenney's CC0 sedan-sports, fitted
# ─────────────────────────────────────────────────────────────────────────────
def _palette_name(c, where, wheel):
    """Name a palette colour (sRGB 0..1) by what it is on the car."""
    r, g, b = c
    mx, mn = max(c), min(c)
    sat = (mx - mn) / mx if mx > 0 else 0
    if wheel:
        return "Rim" if mx > 0.45 else "Tire"
    if r > 0.9 and g > 0.7 and b < 0.35:
        return "Headlight"
    if sat > 0.5 and r > 0.8 and g < 0.33 and where.y > 0.9:
        return "Taillight"
    if sat > 0.45 and r > 0.75:
        return "Body"
    if mn > 0.82:
        return "Glass"
    if mx < 0.3:
        return "DarkTrim"
    return "Chrome"


def build_kenney_car():
    import bpy
    # the improved car was built first in this file: free the names the game looks for (ws, LuluCar_body, Driver…)
    for o in list(bpy.data.objects):
        if o.name in ("ws", "LuluCar_body", "SteeringWheel", "Driver", "Hair_sheitel") or o.name.startswith(("Wheel_", "Anchor_")):
            o.name = "prev_" + o.name
    coll = scene_coll("KenneyCar")
    root = root_empty(coll, "KenneyCar")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=KENNEY)
    imported = [o for o in bpy.data.objects if o not in before]
    for o in imported:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
    img = next(i for i in bpy.data.images if i.size[0] > 0)
    W, H = img.size
    px = img.pixels[:]
    COLORS = {"Body": "#E91E63", "Chrome": "#B7BCCB", "Rim": "#E8EAF2", "Tire": "#262626", "Taillight": "#FF1744",
              "Headlight": "#FFF8E1", "Glass": "#9FD8FF", "DarkTrim": "#2E2E34"}
    M = {k: mat(k, v, rough=0.3 if k == "Body" else 0.5, metal=0.25 if k == "Chrome" else 0.0,
                emit=2.0 if k == "Headlight" else 1.2 if k == "Taillight" else 0.0) for k, v in COLORS.items()}
    M["Body"] = mat("Body", COLORS["Body"], rough=0.28, metal=0.05)
    SX, SY = 1.40, 1.58                # across, along (fit a 4 m long, 1.82 m wide car)
    names = {"wheel-front-left": "Wheel_FL", "wheel-front-right": "Wheel_FR", "wheel-back-left": "Wheel_RL", "wheel-back-right": "Wheel_RR"}
    body_obj = None
    for o in imported:
        if o.type != "MESH":
            continue
        wheel = o.name in names
        me = o.data
        uv = me.uv_layers.active.data
        slots = []
        me.materials.clear()
        for p in me.polygons:
            u = sum(uv[i].uv[0] for i in p.loop_indices) / p.loop_total
            v = sum(uv[i].uv[1] for i in p.loop_indices) / p.loop_total
            x, y = min(W - 1, max(0, int(u * W))), min(H - 1, max(0, int(v * H)))
            k = (y * W + x) * 4
            srgb = tuple(px[k:k + 3])          # (an 8-bit image's pixels are its stored sRGB values, 0..1)
            nm = _palette_name(srgb, o.matrix_world @ p.center, wheel)
            if nm not in slots:
                slots.append(nm)
                me.materials.append(M[nm])
            p.material_index = slots.index(nm)
        me.uv_layers.remove(me.uv_layers.active)
    # one transform: fit the size; the body parts become "LuluCar_body" (feel/damage dents its Body mesh)
    bpy.context.view_layer.update()
    body_parts = [o for o in imported if o.type == "MESH" and o.name not in names]
    wheels = [o for o in imported if o.type == "MESH" and o.name in names]
    for o in imported:
        if o.type == "MESH":
            mw = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = Matrix.Diagonal((SX, SY, SY, 1)) @ mw
    bpy.context.view_layer.update()
    for o in body_parts:
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
    # join the body + spoiler
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    mats = []
    for o in body_parts:
        me = o.data
        start = len(bm.faces)
        bm.from_mesh(me)
        bm.faces.ensure_lookup_table()
        for f in bm.faces[start:]:
            m = me.materials[f.material_index]
            if m not in mats:
                mats.append(m)
            f.material_index = mats.index(m)
    out = bpy.data.meshes.new("LuluCar_body")
    bm.to_mesh(out)
    bm.free()
    for m in mats:
        out.materials.append(m)
    for p in out.polygons:
        p.use_smooth = False
    body = bpy.data.objects.new("LuluCar_body", out)
    coll.objects.link(body)
    body.parent = root
    for o in body_parts:
        bpy.data.objects.remove(o)
    for o in list(coll.objects):
        if o.type == "EMPTY" and o is not root and o.parent is None:
            bpy.data.objects.remove(o)
    # wheels: origin at the hub, named for the game
    for o in wheels:
        if True:
            nm = names[o.name]
            o.name = nm
            o.data.name = nm
            c = o.matrix_world.translation.copy()
            bb = [o.matrix_world @ Vector(v) for v in o.bound_box]
            hub = Vector((sum(v.x for v in bb) / 8, sum(v.y for v in bb) / 8, sum(v.z for v in bb) / 8))
            o.data.transform(o.matrix_world)
            o.data.transform(Matrix.Translation(-hub))
            o.matrix_world = Matrix.Translation(hub)
            o.parent = root
            o.matrix_parent_inverse = Matrix.Identity(4)
            for p in o.data.polygons:
                p.use_smooth = False
    # its windscreen pivot, a steering wheel, today's Lulu (lowered into the cabin) + the anchors
    ws = root_empty(coll, "ws")
    ws.location = (0, -0.42, 1.12)
    ws.rotation_euler = (-0.75, 0, 0)
    ws.parent = root
    SKIN = mat("Skin", "#FFD2B0", rough=0.7)
    HAIR = mat("Hair", "#8B5A2B", rough=0.8)
    SHIRT = mat("Shirt", "#4FC3F7", rough=0.75)
    EYE = mat("Eye", "#1B1B1B", rough=0.3)
    CHEEK = mat("Cheek", "#FF8A9A", rough=0.8)
    SHADES = mat("Shades", "#111111", rough=0.15, metal=0.4)
    lx = 0.30
    dz, k = -0.50, 0.85
    swp = (lx, -0.08, 0.95 - 0.08)
    sw = bake_at([Part(coll, "ring", bm_torus(0.13, 0.02, 20, 6), M["DarkTrim"], loc=swp),
                  Part(coll, "spokeA", bm_box(0.24, 0.025, 0.015), M["DarkTrim"], loc=swp)], "SteeringWheel", coll, root, swp)
    sw.rotation_euler = (math.radians(70), 0, 0)
    head = _lulu_driver(coll, root, lx, SKIN, HAIR, SHIRT, EYE, CHEEK, SHADES, M["Rim"], dz=dz, k=k)
    for nm, loc in (("hood", (0, -1.2, 0.92)), ("deck", (0, 1.55, 1.02)), ("front", (0, -2.05, 0.55)), ("rear", (0, 2.02, 0.65)),
                    ("head", head), ("dash", (0, -0.32, 0.95)), ("passenger", (-0.30, 0.25, 0.60)),
                    ("mirrorL", (0.95, -0.45, 0.95)), ("mirrorR", (-0.95, -0.45, 0.95))):
        anchor(coll, root, "Anchor_" + nm, loc)
    return coll


# ─────────────────────────────────────────────────────────────────────────────
#  (2) Lulu with a skeleton + walk / run / idle
# ─────────────────────────────────────────────────────────────────────────────
H_ = 1.62
HIP, WAIST, CHEST, SHOULDER, NECK = 0.80, 0.98, 1.14, 1.30, 1.37
HEAD_R = 0.19
HEAD_Z = NECK + HEAD_R * 0.95
SX_, LX_ = 0.22, 0.095
KNEE, ANKLE = 0.44, 0.085
ELBOW, WRIST = 1.09, 0.89

BONES = [  # name, head, tail, parent
    ("Hips", (0, 0, HIP), (0, 0, 0.95), None),
    ("Spine", (0, 0, 0.95), (0, 0, CHEST), "Hips"),
    ("Chest", (0, 0, CHEST), (0, 0, 1.33), "Spine"),
    ("Neck", (0, 0, 1.33), (0, 0, 1.40), "Chest"),
    ("Head", (0, 0, 1.40), (0, 0, 1.78), "Neck"),
]
for side, s in (("L", 1), ("R", -1)):
    BONES += [
        ("UpperArm." + side, (s * SX_, 0, SHOULDER), (s * SX_, 0, ELBOW), "Chest"),
        ("ForeArm." + side, (s * SX_, 0, ELBOW), (s * SX_, 0, WRIST), "UpperArm." + side),
        ("Thigh." + side, (s * LX_, 0, HIP), (s * LX_, 0, KNEE), "Hips"),
        ("Shin." + side, (s * LX_, 0, KNEE), (s * LX_, 0, ANKLE), "Thigh." + side),
        ("Foot." + side, (s * LX_, 0, ANKLE), (s * LX_, -0.13, 0.03), "Shin." + side),
    ]


def bake_tagged(tagged, name, coll):
    """bake() that also remembers which vertices came from which tagged part: [(Part, tag)] → (object, ranges)."""
    import bpy
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    mats, ranges = [], []
    for p, tag in tagged:
        me = bpy.data.meshes.new_from_object(p.ob.evaluated_get(dg))
        me.transform(p.ob.matrix_world)
        me.shade_smooth()
        remap = []
        for m in me.materials:
            if m not in mats:
                mats.append(m)
            remap.append(mats.index(m))
        v0 = len(bm.verts)
        bm.faces.ensure_lookup_table()
        f0 = len(bm.faces)
        bm.from_mesh(me)
        bm.faces.ensure_lookup_table()
        for f in bm.faces[f0:]:
            f.material_index = remap[f.material_index] if f.material_index < len(remap) else 0
        bm.verts.ensure_lookup_table()
        ranges.append((v0, len(bm.verts), tag))
        bpy.data.meshes.remove(me)
        mesh = p.ob.data
        bpy.data.objects.remove(p.ob)
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    out = bpy.data.meshes.new(name)
    bm.to_mesh(out)
    bm.free()
    for m in mats:
        out.materials.append(m)
    ob = bpy.data.objects.new(name, out)
    coll.objects.link(ob)
    return ob, ranges


def _weights(tag, co):
    """Bone weights for a vertex of a part (tags: bone name, or a rule)."""
    x, y, z = co
    side = "L" if x > 0 else "R"
    if tag == "torso":
        t = _smooth(1.0, 1.2, z)
        return {"Spine": 1 - t, "Chest": t}
    if tag == "skirt":
        t = _smooth(WAIST - 0.05, 0.42, z)       # 0 at the waist, 1 at the hem
        sd = min(1.0, abs(x) / 0.12)             # the sides follow their leg; the front + back split it
        w = {"Hips": 1 - 0.55 * t}
        if sd > 0.15:
            w["Thigh." + side] = 0.55 * t * sd
            w["Hips"] += 0.55 * t * (1 - sd)
        else:
            w["Thigh.L"] = w["Thigh.R"] = 0.275 * t
        return w
    if tag == "shoulder":
        return {"UpperArm." + side: 0.6, "Chest": 0.4}
    if tag in ("UpperArm", "ForeArm", "Thigh", "Shin", "Foot"):
        return {tag + "." + side: 1.0}
    if tag == "elbow":
        return {"UpperArm." + side: 0.5, "ForeArm." + side: 0.5}
    if tag == "knee":
        return {"Thigh." + side: 0.5, "Shin." + side: 0.5}
    return {tag: 1.0}


def build_rigged_lulu():
    import bpy
    from lib_people import _fresh_materials
    _fresh_materials()
    coll = scene_coll("LuluRigged")
    root = root_empty(coll, "LuluRigged")
    SKIN = mat("Skin", "#FFD2B0", rough=0.7)
    HAIR = mat("Hair", "#8B5A2B", rough=0.8)
    TOP = mat("Top", "#4FC3F7", rough=0.75)
    BOT = mat("Bottom", "#283593", rough=0.8)
    SHOE = mat("Shoes", "#E91E63", rough=0.6)
    TIGHTS = mat("Tights", "#2B2B3A", rough=0.7)
    EYE = mat("Eye", "#1B1B1B", rough=0.3)
    CHEEK = mat("Cheek", "#FF8A9A", rough=0.8)
    MOUTH = mat("Mouth", "#B23A48", rough=0.6)
    SHINE = mat("EyeShine", "#FFFFFF", rough=0.2)
    SHADES = mat("Shades", "#111111", rough=0.15, metal=0.4)
    hr, hz, fy = HEAD_R, HEAD_Z, -HEAD_R * 0.93
    T = []
    add = lambda part, tag: T.append((part, tag))
    # torso + skirt (more rings than lulu_person: they bend)
    add(Part(coll, "torso", bm_sphere(0.2, 0.15, 0.24, 20, 14), TOP, loc=(0, 0, CHEST)), "torso")
    add(Part(coll, "skirt", _bm_skirt(0.18, 0.30, WAIST + 0.03, 0.40), BOT), "skirt")
    add(Part(coll, "neck", bm_cyl(0.055, 0.055, 0.12, 10), SKIN, loc=(0, 0, NECK)), "Neck")
    add(Part(coll, "head", bm_sphere(hr, hr * 0.95, hr * 1.02, 22, 16), SKIN, loc=(0, 0, hz)), "Head")
    for s in (-1, 1):
        add(Part(coll, "eye", bm_sphere(0.032, 0.018, 0.042, 10, 8), EYE, loc=(s * 0.07, fy, hz + 0.01)), "Head")
        add(Part(coll, "shine", bm_sphere(0.01, 0.008, 0.01, 6, 4), SHINE, loc=(s * 0.07 + 0.01, fy - 0.012, hz + 0.025)), "Head")
        add(Part(coll, "cheek", bm_sphere(0.035, 0.01, 0.022, 10, 6), CHEEK, loc=(s * 0.12, fy + 0.02, hz - 0.06)), "Head")
        add(Part(coll, "ear", bm_sphere(0.03, 0.02, 0.045, 8, 6), SKIN, loc=(s * hr * 0.98, 0, hz)), "Head")
        add(Part(coll, "side", bm_sphere(hr * 0.35, hr * 0.45, hr * 1.05), HAIR, loc=(s * hr * 0.9, hr * 0.05, hz - hr * 0.45)), "Head")
        add(Part(coll, "upLens", bm_sphere(0.06, 0.022, 0.045, 10, 6), SHADES, loc=(s * 0.075, -hr * 0.5, hz + hr * 0.92), rot=(-0.6, 0, 0)), "Head")
    add(Part(coll, "mouth", bm_sphere(0.035, 0.01, 0.014, 10, 6), MOUTH, loc=(0, fy - 0.004, hz - 0.085)), "Head")
    add(Part(coll, "cap", bm_sphere(hr * 1.07, hr * 1.0, hr * 1.04, 22, 16), HAIR, loc=(0, hr * 0.05, hz + hr * 0.12)), "Head")
    add(Part(coll, "back", bm_sphere(hr * 1.12, hr * 0.55, hr * 1.45), HAIR, loc=(0, hr * 0.55, hz - hr * 0.55)), "Head")
    add(Part(coll, "fringe", bm_sphere(hr * 0.95, hr * 0.25, hr * 0.35), HAIR, loc=(0, -hr * 0.72, hz + hr * 0.62)), "Head")
    # arms: upper arm, elbow, forearm, hand (long sleeves = Top)
    for s in (-1, 1):
        x = s * SX_
        add(Part(coll, "sh", bm_sphere(0.065), TOP, loc=(x, 0, SHOULDER)), "shoulder")
        add(Part(coll, "upper", bm_cyl(0.06, 0.053, SHOULDER - ELBOW, 12), TOP, loc=(x, 0, (SHOULDER + ELBOW) / 2)), "UpperArm")
        add(Part(coll, "elbow", bm_sphere(0.054, 0.054, 0.054, 12, 8), TOP, loc=(x, 0, ELBOW)), "elbow")
        add(Part(coll, "fore", bm_cyl(0.052, 0.045, ELBOW - WRIST, 12), TOP, loc=(x, 0, (ELBOW + WRIST) / 2)), "ForeArm")
        add(Part(coll, "hand", bm_sphere(0.052, 0.045, 0.06, 12, 8), SKIN, loc=(x, -0.005, WRIST - 0.04)), "ForeArm")
        # legs: thigh, knee, shin (tights), shoe
        lx = s * LX_
        add(Part(coll, "thigh", bm_cyl(0.075, 0.062, HIP - KNEE, 12), TIGHTS, loc=(lx, 0, (HIP + KNEE) / 2)), "Thigh")
        add(Part(coll, "knee", bm_sphere(0.062, 0.062, 0.062, 12, 8), TIGHTS, loc=(lx, 0, KNEE)), "knee")
        add(Part(coll, "shin", bm_cyl(0.06, 0.048, KNEE - ANKLE, 12), TIGHTS, loc=(lx, 0, (KNEE + ANKLE) / 2)), "Shin")
        add(Part(coll, "shoe", bm_sphere(0.068, 0.125, 0.055, 14, 8), SHOE, loc=(lx, -0.045, 0.05)), "Foot")
    mesh, ranges = bake_tagged(T, "LuluBody", coll)

    # the armature
    arm = bpy.data.armatures.new("LuluRig")
    rig = bpy.data.objects.new("LuluRig", arm)
    coll.objects.link(rig)
    rig.parent = root
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = {}
    for nm, h, t, par in BONES:
        b = arm.edit_bones.new(nm)
        b.head, b.tail, b.roll = h, t, 0.0
        if par:
            b.parent = eb[par]
            b.use_connect = False
        eb[nm] = b
    bpy.ops.object.mode_set(mode="OBJECT")

    # skin weights
    for nm, *_ in BONES:
        mesh.vertex_groups.new(name=nm)
    vg = {g.name: g for g in mesh.vertex_groups}
    for v0, v1, tag in ranges:
        for i in range(v0, v1):
            co = mesh.data.vertices[i].co
            for b, w in _weights(tag, co).items():
                if w > 0.001:
                    vg[b].add([i], w, "REPLACE")
    mesh.parent = rig
    mod = mesh.modifiers.new("Armature", "ARMATURE")
    mod.object = rig

    _animate(rig)
    return coll


def _bm_skirt(r_top, r_hem, z_top, z_hem, segs=20, rings=8):
    bm = bmesh.new()
    rs = []
    for i in range(rings + 1):
        t = i / rings
        z = z_top + (z_hem - z_top) * t
        r = r_top + (r_hem - r_top) * (t ** 0.8)
        rs.append([bm.verts.new((r * math.cos(2 * math.pi * j / segs), r * 0.86 * math.sin(2 * math.pi * j / segs), z)) for j in range(segs)])
    for i in range(rings):
        for j in range(segs):
            k = (j + 1) % segs
            bm.faces.new((rs[i][j], rs[i][k], rs[i + 1][k], rs[i + 1][j]))
    bm.faces.new(rs[0])
    bm.faces.new(list(reversed(rs[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


FPS = 30


def _animate(rig):
    """Author the three cycles as actions (keyframes every 2 frames, looped). Rotations are bone-local Euler:
    a leg / arm (pointing down): +X = swing BACK; a spine bone (pointing up): +X = lean FORWARD, Y = twist."""
    import bpy
    rig.animation_data_create()
    for pb in rig.pose.bones:
        pb.rotation_mode = "XYZ"
    tracks = []

    def make(name, frames, pose):
        act = bpy.data.actions.new(name)
        rig.animation_data.action = act
        for f in range(0, frames + 1, 2):
            ph = f / frames                          # 0..1 through the cycle
            for pb in rig.pose.bones:
                pb.rotation_euler = (0, 0, 0)
                pb.location = (0, 0, 0)
            pose(ph, rig.pose.bones)
            for pb in rig.pose.bones:
                pb.keyframe_insert("rotation_euler", frame=f + 1)
                if pb.name == "Hips":
                    pb.keyframe_insert("location", frame=f + 1)
        tr = rig.animation_data.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, 1, act)
        rig.animation_data.action = None
        tracks.append(tr)

    tau = 2 * math.pi

    def walk(ph, P, run=False):
        a = tau * ph
        A = 0.85 if run else 0.42                    # thigh swing
        for side, off in (("L", 0.0), ("R", math.pi)):
            s = math.sin(a + off)
            c = math.cos(a + off)
            P["Thigh." + side].rotation_euler.x = -A * s - (0.25 if run else 0.0)
            knee = (0.12 + (1.45 if run else 0.62) * max(0.0, c) ** 1.4) if True else 0
            if run:
                knee += 0.35 * max(0.0, -s)
            P["Shin." + side].rotation_euler.x = knee
            P["Foot." + side].rotation_euler.x = -0.35 * max(0.0, c) + 0.25 * max(0.0, -c) * (1 if not run else 1.4) - (0.2 if run else 0)
            AA = 1.1 if run else 0.45
            P["UpperArm." + side].rotation_euler.x = AA * s * (0.75 if not run else 0.6) - (0.15 if run else 0)
            P["UpperArm." + side].rotation_euler.y = 0
            P["UpperArm." + side].rotation_euler.z = (0.08 if side == "L" else -0.08)
            P["ForeArm." + side].rotation_euler.x = -(1.45 + 0.35 * s if run else 0.28 + 0.22 * max(0.0, s))
        bob = abs(math.cos(a))
        P["Hips"].location = (0.018 * math.sin(a) * (0.5 if run else 1), (0.07 if run else 0.032) * bob - (0.05 if run else 0.015), 0)
        P["Hips"].rotation_euler.y = (0.10 if run else 0.13) * math.sin(a)          # pelvis twist with the legs
        P["Hips"].rotation_euler.z = 0.05 * math.cos(a) * (0.5 if run else 1)        # (bone Y up → local Z ≈ forward-ish tilt)
        P["Spine"].rotation_euler.x = 0.22 if run else 0.05
        P["Chest"].rotation_euler.y = -(0.16 if run else 0.14) * math.sin(a)        # shoulders counter the hips
        P["Chest"].rotation_euler.x = 0.06 if run else 0.02
        P["Neck"].rotation_euler.x = -(0.18 if run else 0.04)
        P["Head"].rotation_euler.y = 0.06 * math.sin(a)
        P["Head"].rotation_euler.x = -0.04 * bob

    def idle(ph, P):
        a = tau * ph
        br = math.sin(a * 2)                                   # two breaths a loop
        P["Spine"].rotation_euler.x = 0.015 * br
        P["Chest"].rotation_euler.x = -0.025 * br
        P["Hips"].location = (0.012 * math.sin(a), -0.004 * (1 - math.cos(a * 2)), 0)
        P["Hips"].rotation_euler.z = 0.03 * math.sin(a)
        P["Spine"].rotation_euler.z = -0.035 * math.sin(a)
        P["Head"].rotation_euler.y = 0.18 * math.sin(a) * math.sin(a * 0.5) ** 2
        P["Head"].rotation_euler.x = -0.03 + 0.02 * br
        for side, s in (("L", 1), ("R", -1)):
            P["UpperArm." + side].rotation_euler.x = 0.04 * br + 0.03 * s * math.sin(a)
            P["UpperArm." + side].rotation_euler.z = s * (0.07 + 0.015 * br)
            P["ForeArm." + side].rotation_euler.x = -0.18 - 0.03 * br
            P["Thigh." + side].rotation_euler.z = -0.03 * math.sin(a)
            P["Shin." + side].rotation_euler.x = 0.03 + (0.06 if (s > 0) == (math.sin(a) > 0) else 0.0) * abs(math.sin(a))

    make("Idle", 90, idle)
    make("Walk", 24, lambda ph, P: walk(ph, P, False))
    make("Run", 16, lambda ph, P: walk(ph, P, True))
    bpy.context.scene.render.fps = FPS


ASSETS = [
    ("looktest_car", build_good_car),
    ("looktest_car_lite", build_good_car_lite),
    ("looktest_kenney", build_kenney_car),
    ("looktest_lulu", build_rigged_lulu),
]
