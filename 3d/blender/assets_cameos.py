"""
Cameos assets (feature "cameos"): everything for the roadside cameos, the
salon, the crash aftermath and the ER.

  cameos_avigail_car    Avigail's purple coupe (Avigail driving = "Driver")
  cameos_porch          Avigail's front porch ("AVIGAIL'S LAIR"), the Door swings
  cameos_hair_*         Lulu's salon hairstyles in the CAR frame (head at (0.38, 0.38, 1.60))
  cameos_lulu_*         Lulu on foot with those hairstyles (same look as lulu_person)
  cameos_fabio          Fabio the stylist (+ the salon props and the storefront)
  cameos_sasquatch      the big guy (animatable like a person)
  cameos_heshy_pool     Heshy's front yard: inflatable pool, beach ball, umbrella
  cameos_yedidya / burry / shuey / cat_angel   the three uncles (+ Fluffy)
  cameos_grandpa … hipster                     drivers who climb out of the car you hit
  cameos_duck / raccoon                        the furious kin of the animal you hit
  cameos_ambulance, cameos_er_props            the ER ride and the ER room
  cameos_doctor / tammy / raphael / rabbi / clown / zaidy / fayge   ER bedside cast
  cameos_props          small hand props (scissors, milk jug, clipboard, shades, hat…)

People are built with lib_people.build_person (ONE person per asset) and get
their extra bits (pompadour, nurse cap, cigar…) baked into a child of "Body",
so they bob and turn with the body when core/people.js animates them.
"""
import math
from types import SimpleNamespace
from lib import *
from lib_people import build_person


def setup():
    pass


# ── helpers ──────────────────────────────────────────────────────────────

def txt(body, size, extrude=0.0):
    """Like lib.bm_text but low-res and flat (signs don't need bevelled glyphs)."""
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = body
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.extrude = extrude
    cu.resolution_u = 2
    tmp = bpy.data.objects.new("txt", cu)
    bpy.context.scene.collection.objects.link(tmp)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    return bm

def geom(spec):
    H = spec.get("height", 1.62)
    kid = spec.get("kid", H < 1.35)
    k = H / 1.62
    hk = k * (1.22 if kid else 1.0)
    wf = spec.get("width", 1.0)
    neck_z = 1.37 * k
    head_r = 0.19 * hk
    head_z = neck_z + head_r * 0.95
    return SimpleNamespace(k=k, hk=hk, wf=wf, hr=head_r, hz=head_z, neck=neck_z, chest=1.14 * k,
                           sh=1.30 * k, waist=0.98 * k, hip=0.80 * k, sx=0.22 * k * wf, fy=-head_r * 0.93)


def person(name, spec, extra=None):
    """build_person + optional extra parts baked into a child of Body."""
    coll = build_person(name, spec)
    if extra:
        g = geom(spec)
        parts = extra(coll, g)
        if parts:
            body = [o for o in coll.objects if o.name.startswith("Body")][0]
            bake(parts, name + "Extra", coll, parent=body)
    return coll


def stethoscope(coll, g):
    m = mat("Stetho", "#37474F", rough=0.4, metal=0.3)
    disc = mat("StethoDisc", "#B0BEC5", rough=0.2, metal=0.9)
    return [Part(coll, "steth", bm_torus(0.1 * g.k, 0.012 * g.k, 18, 5), m, loc=(0, -0.03 * g.k, g.neck - 0.05 * g.k), rot=(0.5, 0, 0)),
            limb(coll, "stethL", (0.07 * g.k, -0.12 * g.k, g.neck - 0.1 * g.k), (0.06 * g.k, -0.16 * g.k, g.chest - 0.05 * g.k), 0.01 * g.k, m),
            Part(coll, "stethD", bm_cyl(0.03 * g.k, 0.03 * g.k, 0.015 * g.k, 12, "Y"), disc, loc=(0.06 * g.k, -0.17 * g.k, g.chest - 0.08 * g.k))]


def head_mirror(coll, g):
    band = mat("MirrorBand", "#263238", rough=0.6)
    disc = mat("HeadMirror", "#E0E0E0", rough=0.1, metal=0.95)
    return [Part(coll, "hmBand", bm_torus(g.hr * 1.02, 0.012 * g.k, 22, 5), band, loc=(0, 0, g.hz + g.hr * 0.45), rot=(0.12, 0, 0)),
            Part(coll, "hmDisc", bm_cyl(0.06 * g.k, 0.06 * g.k, 0.012 * g.k, 18, "Y"), disc, loc=(0.05 * g.k, -g.hr * 0.98, g.hz + g.hr * 0.55), rot=(0.4, 0, 0))]


# ── Lulu's salon hairstyles (shared by the car frame and the on-foot person) ─
def shades_up(coll, cx, cy, cz, hr, yk=-0.66, zk=1.02):
    sh = mat("Shades", "#111111", rough=0.15, metal=0.4)
    f = hr / 0.235
    return [Part(coll, "lens", bm_sphere(0.06 * f, 0.022 * f, 0.045 * f, 10, 6), sh,
                 loc=(cx + s * 0.085 * f, cy + hr * yk, cz + hr * zk), rot=(-0.75, 0, 0)) for s in (-1, 1)]


def hair_bouncy(coll, cx, cy, cz, hr, HAIR):
    """BIG & BOUNCY — 'VOLUME! We will need a LARGER doorway!'"""
    P = [Part(coll, "bCap", bm_sphere(hr * 1.30, hr * 1.12, hr * 0.92, 18, 12), HAIR, loc=(cx, cy + hr * 0.32, cz + hr * 0.55))]
    for s in (-1, 1):
        for dy, dz, r in ((-0.08, 0.20, 0.50), (0.22, -0.20, 0.56), (0.42, -0.62, 0.52), (0.05, -0.72, 0.46), (0.2, -1.05, 0.40)):
            P.append(Part(coll, "bSide", bm_sphere(hr * r, hr * r, hr * r * 1.05, 12, 8), HAIR, loc=(cx + s * hr * 1.08, cy + hr * dy, cz + hr * dz)))
    for dx, dz, r in ((0, 0.25, 0.72), (-0.6, -0.25, 0.56), (0.6, -0.25, 0.56), (0, -0.55, 0.62), (-0.42, -0.98, 0.46), (0.42, -0.98, 0.46), (0, -1.12, 0.42)):
        P.append(Part(coll, "bBack", bm_sphere(hr * r, hr * r * 0.9, hr * r, 12, 8), HAIR, loc=(cx + hr * dx, cy + hr * 0.78, cz + hr * dz)))
    P.append(Part(coll, "bFringe", bm_sphere(hr * 0.98, hr * 0.32, hr * 0.34), HAIR, loc=(cx, cy - hr * 0.70, cz + hr * 0.66)))
    for s in (-1, 1):
        P.append(Part(coll, "bFlip", bm_sphere(hr * 0.42, hr * 0.42, hr * 0.32), HAIR, loc=(cx + s * hr * 0.62, cy - hr * 0.55, cz + hr * 0.62)))
    return P   # big hair: the shades live in her bag today


def hair_avigail(coll, cx, cy, cz, hr, HAIR):
    """THE 'AVIGAIL' — 'Curls to zee HEAVENS! Zee neighbors will TALK.'"""
    P = [Part(coll, "aCap", bm_sphere(hr * 1.1, hr * 1.05, hr * 0.95, 22, 16), HAIR, loc=(cx, cy + hr * 0.1, cz + hr * 0.25))]
    for i in range(14):
        a = i / 14 * math.pi * 2
        x, y = math.cos(a) * hr * 1.02, math.sin(a) * hr * 0.98
        if y < -hr * 0.5:
            continue   # leave her face open
        P.append(Part(coll, "aCurl", bm_sphere(hr * 0.34, hr * 0.34, hr * 0.3, 12, 8), HAIR, loc=(cx + x, cy + y + hr * 0.12, cz + hr * (0.05 + 0.18 * math.cos(3 * a)))))
    for dx, dz in ((-0.55, -0.45), (0.55, -0.45), (0, -0.6), (-0.3, -0.95), (0.3, -0.95)):
        P.append(Part(coll, "aBack", bm_sphere(hr * 0.36, hr * 0.34, hr * 0.34, 12, 8), HAIR, loc=(cx + hr * dx, cy + hr * 0.85, cz + hr * dz)))
    n = 15
    for i in range(n):
        t = i / (n - 1)
        a = i * 1.35
        r = hr * (0.56 - 0.28 * t)
        rad = hr * (0.44 - 0.28 * t)
        P.append(Part(coll, "aTower", bm_sphere(r * 1.08, r, r * 0.78, 14, 9), HAIR, loc=(cx + math.cos(a) * rad, cy + hr * 0.18 + math.sin(a) * rad, cz + hr * (0.9 + 2.7 * t))))
    P.append(Part(coll, "aTop", bm_sphere(hr * 0.27, hr * 0.27, hr * 0.3, 12, 8), HAIR, loc=(cx, cy + hr * 0.18, cz + hr * 3.78)))
    return P


def build_car_hair(name, fn):
    coll = scene_coll(name)
    root = root_empty(coll, name)
    HAIR = mat("Hair", "#8B5A2B", rough=0.8)
    bake(fn(coll, 0.38, 0.38, 1.60, 0.235, HAIR), "Hair_" + name.split("_")[-1], coll, parent=root)
    return coll


def build_lulu_style(name, fn):
    spec = dict(hair="bald", hair_color="#8B5A2B", top="#4FC3F7", bottom="skirt", bottom_color="#283593", shoes="#E91E63")
    return person(name, spec, lambda coll, g: fn(coll, 0, 0, g.hz, g.hr, mat("Hair", "#8B5A2B", rough=0.8)))


# ── Avigail's purple coupe ───────────────────────────────────────────────
def build_avigail_car():
    S = shared()
    coll = scene_coll("AvigailCar")
    root = root_empty(coll, "AvigailCar")
    PAINT = mat("AviPaint", "#7E57C2", rough=0.28, metal=0.15)
    GOLD = mat("AviGold", "#FFD54F", rough=0.25, metal=0.85)
    DARKP = mat("AviDark", "#4527A0", rough=0.4)
    parts = [
        Part(coll, "body", bm_box(1.78, 4.3, 0.56), PAINT, loc=(0, 0, 0.62)).bevel(0.18, 4),
        Part(coll, "cabin", bm_box(1.48, 1.95, 0.5), S.GLASS, loc=(0, 0.32, 1.12)).bevel(0.16, 3),
        Part(coll, "roof", bm_box(1.42, 1.45, 0.07), PAINT, loc=(0, 0.42, 1.39)).bevel(0.04, 2),
        Part(coll, "hood", bm_box(1.6, 1.3, 0.08), PAINT, loc=(0, -1.35, 0.92), rot=(0.06, 0, 0)).bevel(0.04, 2),
        Part(coll, "bumperF", bm_box(1.7, 0.18, 0.15), S.CHROME, loc=(0, -2.18, 0.46)).bevel(0.06, 2),
        Part(coll, "bumperR", bm_box(1.7, 0.18, 0.15), S.CHROME, loc=(0, 2.18, 0.46)).bevel(0.06, 2),
        Part(coll, "grille", bm_box(0.8, 0.04, 0.12), DARKP, loc=(0, -2.16, 0.62)).bevel(0.03, 2),
        Part(coll, "plate", bm_box(0.55, 0.02, 0.16), GOLD, loc=(0, 2.2, 0.64)),
        Part(coll, "plateTxt", txt("AVIGAIL", 0.1), DARKP, loc=(0, 2.215, 0.64), rot=(math.pi / 2, 0, math.pi), smooth=False),
    ]
    for s in (-1, 1):
        parts.append(Part(coll, "pillar", bm_box(0.06, 0.08, 0.5), PAINT, loc=(s * 0.71, -0.55, 1.13), rot=(-0.45, 0, 0)))
        parts.append(Part(coll, "pillarR", bm_box(0.06, 0.08, 0.5), PAINT, loc=(s * 0.71, 1.2, 1.12), rot=(0.5, 0, 0)))
        parts.append(Part(coll, "stripe", bm_box(0.02, 3.4, 0.05), GOLD, loc=(s * 0.895, 0.0, 0.78)))
        parts.append(Part(coll, "head", bm_sphere(0.17, 0.06, 0.1), S.HEAD, loc=(s * 0.58, -2.12, 0.72)))
        parts.append(Part(coll, "tail", bm_box(0.36, 0.05, 0.11), S.TAIL, loc=(s * 0.58, 2.16, 0.78)).bevel(0.03, 2))
        parts.append(Part(coll, "mirror", bm_box(0.15, 0.1, 0.09), PAINT, loc=(s * 0.92, -0.55, 0.98)).bevel(0.03, 2))
    bake(parts, "AvigailCar_body", coll, parent=root)
    four_wheels(coll, root, 0.80, -1.38, 1.38, 0.34, 0.24, S.TIRE, S.CHROME, GOLD)
    # Avigail at the wheel (a separate "Driver" so she can step out when she's pulled over)
    SKIN = mat("AviSkin", "#C68642", rough=0.7)
    HAIR = mat("AviHair", "#1A1A1A", rough=0.7)
    TOP = mat("AviTop", "#B39DDB", rough=0.75)
    SH = mat("AviShades", "#111111", rough=0.15, metal=0.4)
    LIP = mat("AviLips", "#C2185B", rough=0.5)
    lx, hy, hz, hr = 0.38, 0.42, 1.1, 0.16
    d = [Part(coll, "torso", bm_sphere(0.17, 0.13, 0.22), TOP, loc=(lx, 0.5, 0.78)),
         Part(coll, "head", bm_sphere(hr, hr * 0.95, hr * 1.02, 20, 14), SKIN, loc=(lx, hy, hz)),
         Part(coll, "hair", bm_sphere(hr * 1.1, hr * 1.02, hr * 1.06, 20, 14), HAIR, loc=(lx, hy + 0.04, hz + 0.03)),
         Part(coll, "hairBack", bm_sphere(hr * 1.05, 0.09, hr * 2.0), HAIR, loc=(lx, hy + 0.12, hz - 0.15)),
         Part(coll, "lips", bm_sphere(0.03, 0.01, 0.014), LIP, loc=(lx, hy - hr * 0.97, hz - 0.07))]
    for s in (-1, 1):
        d.append(Part(coll, "lens", bm_sphere(0.045, 0.016, 0.032, 10, 6), SH, loc=(lx + s * 0.058, hy - hr * 0.97, hz + 0.01)))
        d.append(Part(coll, "hoop", bm_torus(0.03, 0.007, 12, 4), GOLD, loc=(lx + s * hr * 1.0, hy, hz - 0.07), rot=(0, math.pi / 2, 0)))
        d.append(limb(coll, "arm", (lx + s * 0.15, 0.5, 0.9), (lx + s * 0.11, -0.12, 0.84), 0.035, TOP))
        d.append(Part(coll, "hand", bm_sphere(0.04), SKIN, loc=(lx + s * 0.11, -0.14, 0.84)))
    d.append(Part(coll, "wheelRing", bm_torus(0.14, 0.02), DARKP, loc=(lx, -0.18, 0.86), rot=(math.radians(70), 0, 0)))
    bake(d, "Driver", coll, parent=root)
    return coll


# ── Avigail's porch ──────────────────────────────────────────────────────
def build_porch():
    S = shared()
    coll = scene_coll("Porch")
    root = root_empty(coll, "Porch")
    WALL = mat("PorchWall", "#FFE0B2", rough=0.9)
    TRIM = mat("PorchTrim", "#FFFFFF", rough=0.7)
    WOOD = mat("PorchWood", "#BCAAA4", rough=0.85)
    ROOF = mat("PorchRoof", "#8E5CC2", rough=0.8)
    GOLD = mat("PorchGold", "#FFD54F", rough=0.3, metal=0.7)
    BROWN = mat("PorchBrown", "#5D4037", rough=0.8)
    WIN = mat("Window", "#FFE7B0", rough=0.1, emit=0.6)
    CURT = mat("PorchCurtain", "#CE93D8", rough=0.9)
    INSIDE = mat("PorchInside", "#5A3E36", rough=0.95)
    LAMP = mat("NeonPorch", "#FFE082", rough=0.3, emit=3.0)
    parts = [
        Part(coll, "wallL", bm_box(3.3, 0.3, 4.4), WALL, loc=(-2.55, 0.15, 2.2), smooth=False),
        Part(coll, "wallR", bm_box(3.3, 0.3, 4.4), WALL, loc=(2.55, 0.15, 2.2), smooth=False),
        Part(coll, "wallT", bm_box(1.8, 0.3, 1.9), WALL, loc=(0, 0.15, 3.45), smooth=False),
        Part(coll, "inside", bm_box(2.4, 2.2, 2.6), INSIDE, loc=(0, 1.4, 1.25), smooth=False),
        Part(coll, "insideFloor", bm_box(2.4, 2.2, 0.05), WOOD, loc=(0, 1.4, 0.0), smooth=False),
        Part(coll, "frameL", bm_box(0.12, 0.12, 2.5), TRIM, loc=(-0.81, -0.02, 1.25), smooth=False),
        Part(coll, "frameR", bm_box(0.12, 0.12, 2.5), TRIM, loc=(0.81, -0.02, 1.25), smooth=False),
        Part(coll, "frameT", bm_box(1.74, 0.12, 0.14), TRIM, loc=(0, -0.02, 2.53), smooth=False),
        Part(coll, "deck", bm_box(9.0, 3.4, 0.25), WOOD, loc=(0, -1.55, -0.125), smooth=False),
        Part(coll, "step1", bm_box(2.6, 0.5, 0.18), WOOD, loc=(0, -3.45, -0.16), smooth=False),
        Part(coll, "step2", bm_box(2.6, 0.5, 0.12), WOOD, loc=(0, -3.9, -0.3), smooth=False),
        Part(coll, "roof", bm_box(9.4, 3.8, 0.18), ROOF, loc=(0, -1.6, 3.4), rot=(-0.08, 0, 0), smooth=False),
        Part(coll, "plate", bm_box(1.6, 0.06, 0.34), GOLD, loc=(0, -0.06, 2.85)).bevel(0.04, 2),
        Part(coll, "plateTxt", txt("AVIGAIL'S LAIR", 0.16), BROWN, loc=(0, -0.1, 2.85), rot=(math.pi / 2, 0, 0), smooth=False),
        Part(coll, "mat", bm_box(1.5, 0.85, 0.03), mat("Doormat", "#A1887F", rough=1.0), loc=(0, -0.7, 0.015), smooth=False),
        Part(coll, "matTxt", txt("GO AWAY :)", 0.17), mat("DoormatTxt", "#3E2723", rough=1.0), loc=(0, -0.7, 0.034), smooth=False),
        Part(coll, "lampBox", bm_box(0.22, 0.14, 0.32), BROWN, loc=(1.25, -0.06, 2.1)).bevel(0.03, 2),
        Part(coll, "lamp", bm_sphere(0.09), LAMP, loc=(1.25, -0.14, 2.1)),
        Part(coll, "soliciting", bm_box(0.7, 0.04, 0.26), TRIM, loc=(-1.3, -0.04, 1.55)),
        Part(coll, "solTxt", txt("NO SOLICITING", 0.07), mat("SolTxt", "#C62828"), loc=(-1.3, -0.07, 1.55), rot=(math.pi / 2, 0, 0), smooth=False),
    ]
    for x in (-2.7, 2.7):
        parts.append(Part(coll, "win", bm_box(1.5, 0.1, 1.4), WIN, loc=(x, -0.02, 1.9), smooth=False))
        parts.append(Part(coll, "winFrame", bm_box(1.7, 0.08, 1.6), TRIM, loc=(x, 0.01, 1.9), smooth=False))
        parts.append(Part(coll, "mull", bm_box(0.06, 0.12, 1.4), TRIM, loc=(x, -0.06, 1.9), smooth=False))
        for s in (-1, 1):
            parts.append(Part(coll, "curt", bm_box(0.34, 0.06, 1.3), CURT, loc=(x + s * 0.55, -0.08, 1.92), smooth=False))
        parts.append(Part(coll, "box", bm_box(1.6, 0.35, 0.25), mat("Planter", "#8D6E63"), loc=(x, -0.2, 1.08), smooth=False))
        for k in range(6):
            parts.append(Part(coll, "flower", bm_ico(0.1, 0), mat("Flower%d" % (k % 3), ("#FF6F91", "#FFD54F", "#BA68C8")[k % 3]),
                              loc=(x - 0.65 + k * 0.26, -0.22, 1.25), smooth=False))
    for x in (-4.1, 4.1, -1.6, 1.6):
        parts.append(Part(coll, "post", bm_cyl(0.11, 0.11, 3.4, 12), TRIM, loc=(x, -3.0, 1.7)))
    for s in (-1, 1):
        parts.append(Part(coll, "rail", bm_box(2.3, 0.08, 0.08), TRIM, loc=(s * 2.85, -3.0, 0.95), smooth=False))
        for i in range(9):
            parts.append(Part(coll, "baluster", bm_box(0.05, 0.05, 0.9), TRIM, loc=(s * (1.75 + i * 0.27), -3.0, 0.5), smooth=False))
        parts.append(Part(coll, "pot", bm_cyl(0.26, 0.2, 0.42, 14), mat("Pot", "#E57373"), loc=(s * 1.25, -0.55, 0.21)))
        parts.append(Part(coll, "plant", bm_ico(0.36, 1), S.LEAVES, loc=(s * 1.25, -0.55, 0.65), smooth=False))
    bake(parts, "Porch_body", coll, parent=root)
    # the door swings on its left hinge (rotate Door about its local Z / three Y)
    DOOR = mat("PorchDoor", "#00796B", rough=0.5)
    PANEL = mat("PorchPanel", "#26A69A", rough=0.5)
    hinge = (-0.72, -0.02, 0.0)
    dp = [Part(coll, "door", bm_box(1.44, 0.08, 2.42), DOOR, loc=(0, -0.02, 1.21)).bevel(0.02, 2),
          Part(coll, "panelT", bm_box(1.06, 0.03, 0.8), PANEL, loc=(0, -0.07, 1.75)).bevel(0.02, 2),
          Part(coll, "panelB", bm_box(1.06, 0.03, 0.8), PANEL, loc=(0, -0.07, 0.7)).bevel(0.02, 2),
          Part(coll, "knob", bm_sphere(0.06), GOLD, loc=(0.55, -0.12, 1.15)),
          Part(coll, "wreath", bm_torus(0.24, 0.07, 20, 8), mat("Wreath", "#2E7D32", rough=0.9), loc=(0, -0.12, 1.85), rot=(math.pi / 2, 0, 0)),
          Part(coll, "bow", bm_sphere(0.08, 0.04, 0.06), mat("WreathBow", "#AB47BC"), loc=(0, -0.17, 1.62))]
    for i in range(8):
        a = i / 8 * math.pi * 2
        dp.append(Part(coll, "berry", bm_sphere(0.035), mat("Berry", "#E53935"), loc=(math.cos(a) * 0.24, -0.17, 1.85 + math.sin(a) * 0.24)))
    bake_at(dp, "Door", coll, root, hinge)
    return coll


# ── the salon ────────────────────────────────────────────────────────────
def build_fabio():
    spec = dict(hair="short", hair_color="#26A69A", skin="#E8B89A", top="#212121", bottom="pants", bottom_color="#212121",
                shoes="#111111", extras=["mustache", "badge"], extra_colors={"Beard": "#1A1A1A", "Badge": "#FFD700"})

    def extra(coll, g):
        HAIR = mat("Hair", "#26A69A")
        SHINE = mat("PompShine", "#80E0D6", rough=0.4)
        hr, hz = g.hr, g.hz
        return [Part(coll, "pomp1", bm_sphere(hr * 1.0, hr * 0.92, hr * 0.55), HAIR, loc=(0, -hr * 0.12, hz + hr * 0.95)),
                Part(coll, "pomp2", bm_sphere(hr * 0.82, hr * 0.8, hr * 0.5), HAIR, loc=(0, -hr * 0.32, hz + hr * 1.38)),
                Part(coll, "pomp3", bm_sphere(hr * 0.62, hr * 0.62, hr * 0.46), HAIR, loc=(0, -hr * 0.62, hz + hr * 1.75)),
                Part(coll, "pompShine", bm_sphere(hr * 0.25, hr * 0.15, hr * 0.15), SHINE, loc=(-hr * 0.2, -hr * 1.05, hz + hr * 1.85)),
                Part(coll, "smockPocket", bm_box(0.12, 0.02, 0.1), mat("SmockPocket", "#EC407A"), loc=(-0.08, -0.155, g.chest - 0.02))]
    return person("CameosFabio", spec, extra)


def build_salon_props():
    S = shared()
    coll = scene_coll("SalonProps")
    root = root_empty(coll, "SalonProps")
    PINK = mat("ChairPink", "#EC407A", rough=0.25)
    CHROME = S.CHROME
    GOLD = mat("SalonGold", "#FFC94A", rough=0.25, metal=0.85)
    BULB = mat("NeonBulb", "#FFF5CC", rough=0.2, emit=3.0)
    WHITE = mat("SalonWhite", "#FAFAFA", rough=0.5)
    BLACK = mat("SalonBlack", "#212121", rough=0.4)
    # styling chair (seat top at ~0.5 m)
    ch = [Part(coll, "base", bm_cyl(0.32, 0.36, 0.06, 24), CHROME, loc=(0, 0, 0.03)),
          Part(coll, "pole", bm_cyl(0.06, 0.06, 0.32, 14), CHROME, loc=(0, 0, 0.22)),
          Part(coll, "seat", bm_box(0.62, 0.6, 0.16), PINK, loc=(0, 0, 0.44)).bevel(0.07, 3),
          Part(coll, "back", bm_box(0.62, 0.13, 0.52), PINK, loc=(0, 0.3, 0.8), rot=(-0.1, 0, 0)).bevel(0.07, 3),
          Part(coll, "foot", bm_box(0.4, 0.12, 0.05), CHROME, loc=(0, -0.42, 0.14)).bevel(0.02, 2),
          limb(coll, "footBar", (0, -0.2, 0.34), (0, -0.42, 0.15), 0.025, CHROME)]
    for s in (-1, 1):
        ch.append(Part(coll, "arm", bm_box(0.1, 0.5, 0.08), PINK, loc=(s * 0.33, 0.02, 0.66)).bevel(0.04, 2))
        ch.append(Part(coll, "armPost", bm_box(0.05, 0.05, 0.16), CHROME, loc=(s * 0.33, 0.05, 0.56)))
    bake(ch, "Chair", coll, parent=root)
    # vanity mirror: gold frame + Hollywood bulbs + counter (mirror surface is made in JS)
    mw, mh, mz = 1.5, 1.7, 1.55
    m = [Part(coll, "fT", bm_box(mw + 0.2, 0.08, 0.12), GOLD, loc=(0, 0, mz + mh / 2)).bevel(0.03, 2),
         Part(coll, "fB", bm_box(mw + 0.2, 0.08, 0.12), GOLD, loc=(0, 0, mz - mh / 2)).bevel(0.03, 2),
         Part(coll, "fL", bm_box(0.12, 0.08, mh + 0.2), GOLD, loc=(-mw / 2 - 0.04, 0, mz)).bevel(0.03, 2),
         Part(coll, "fR", bm_box(0.12, 0.08, mh + 0.2), GOLD, loc=(mw / 2 + 0.04, 0, mz)).bevel(0.03, 2),
         Part(coll, "backing", bm_box(mw, 0.03, mh), mat("MirrorBack", "#3A3A44", rough=0.3), loc=(0, 0.03, mz)),
         Part(coll, "counter", bm_box(2.2, 0.55, 0.08), WHITE, loc=(0, -0.24, 0.86)).bevel(0.03, 2),
         Part(coll, "counterBox", bm_box(2.1, 0.45, 0.8), PINK, loc=(0, -0.2, 0.42)).bevel(0.04, 2)]
    nb = 0
    for i in range(7):
        x = -mw / 2 + i * mw / 6
        for z in (mz + mh / 2 + 0.02, mz - mh / 2 - 0.02):
            m.append(Part(coll, "bulb", bm_sphere(0.055, None, None, 8, 6), BULB, loc=(x, -0.06, z)))
    for i in range(1, 6):
        z = mz - mh / 2 + i * mh / 6
        for x in (-mw / 2 - 0.05, mw / 2 + 0.05):
            m.append(Part(coll, "bulb", bm_sphere(0.055, None, None, 8, 6), BULB, loc=(x, -0.06, z)))
    cols = ("#80DEEA", "#F48FB1", "#FFD54F", "#CE93D8", "#A5D6A7")
    for i, c in enumerate(cols):
        m.append(Part(coll, "bottle", bm_cyl(0.045, 0.05, 0.22, 10), mat("Bottle%d" % i, c, rough=0.2), loc=(-0.85 + i * 0.13, -0.3, 1.01)))
        m.append(Part(coll, "cap", bm_cyl(0.025, 0.025, 0.05, 8), BLACK, loc=(-0.85 + i * 0.13, -0.3, 1.14)))
    m.append(Part(coll, "comb", bm_box(0.22, 0.04, 0.012), BLACK, loc=(0.6, -0.35, 0.91)))
    m.append(Part(coll, "spray", bm_cyl(0.05, 0.05, 0.28, 12), mat("Spray", "#FF80AB", rough=0.3), loc=(0.85, -0.3, 1.04)))
    bake(m, "Mirror", coll, parent=root)
    # product shelf
    sh = [Part(coll, "board", bm_box(1.4, 0.3, 0.05), WHITE, loc=(0, 0, 0)),
          Part(coll, "board2", bm_box(1.4, 0.3, 0.05), WHITE, loc=(0, 0, 0.42))]
    for i in range(6):
        c = cols[i % len(cols)]
        sh.append(Part(coll, "pb", bm_cyl(0.06, 0.06, 0.24 + (i % 2) * 0.06, 10), mat("Bottle%d" % (i % 5), c, rough=0.2), loc=(-0.55 + i * 0.22, 0, 0.15)))
        sh.append(Part(coll, "pb2", bm_box(0.14, 0.14, 0.16), mat("Bottle%d" % ((i + 2) % 5), cols[(i + 2) % 5], rough=0.3), loc=(-0.55 + i * 0.22, 0, 0.53)))
    bake(sh, "Shelf", coll, parent=root)
    # rolling cart
    ct = [Part(coll, "top", bm_box(0.6, 0.45, 0.04), CHROME, loc=(0, 0, 0.9)),
          Part(coll, "mid", bm_box(0.6, 0.45, 0.04), CHROME, loc=(0, 0, 0.5)),
          Part(coll, "low", bm_box(0.6, 0.45, 0.04), CHROME, loc=(0, 0, 0.14))]
    for sx in (-1, 1):
        for sy in (-1, 1):
            ct.append(Part(coll, "leg", bm_cyl(0.015, 0.015, 0.85, 6), CHROME, loc=(sx * 0.28, sy * 0.2, 0.52)))
            ct.append(Part(coll, "wheel", bm_sphere(0.04), BLACK, loc=(sx * 0.28, sy * 0.2, 0.04)))
    for i in range(3):
        ct.append(Part(coll, "cb", bm_cyl(0.05, 0.05, 0.2, 10), mat("Bottle%d" % i, cols[i], rough=0.2), loc=(-0.18 + i * 0.18, 0, 1.02)))
    ct.append(Part(coll, "towels", bm_box(0.4, 0.3, 0.16), WHITE, loc=(0, 0, 0.6)).bevel(0.04, 2))
    bake(ct, "Cart", coll, parent=root)
    # potted plant
    pl = [Part(coll, "pot", bm_cyl(0.28, 0.2, 0.5, 16), PINK, loc=(0, 0, 0.25))]
    for i in range(8):
        a = i / 8 * math.pi * 2
        pl.append(Part(coll, "leaf", bm_sphere(0.1, 0.1, 0.42), S.LEAVES, loc=(math.cos(a) * 0.18, math.sin(a) * 0.18, 0.85),
                       rot=(math.sin(a) * 0.6, -math.cos(a) * 0.6, 0)))
    bake(pl, "Plant", coll, parent=root)
    # hood dryer chair
    dr = [Part(coll, "seat", bm_box(0.6, 0.6, 0.16), WHITE, loc=(0, 0, 0.45)).bevel(0.06, 2),
          Part(coll, "back", bm_box(0.6, 0.12, 0.7), WHITE, loc=(0, 0.3, 0.85)).bevel(0.06, 2),
          Part(coll, "stem", bm_cyl(0.03, 0.03, 0.9, 8), CHROME, loc=(0, 0.42, 1.2)),
          Part(coll, "hood", bm_sphere(0.36, 0.34, 0.3), PINK, loc=(0, 0.15, 1.6)),
          Part(coll, "base", bm_cyl(0.3, 0.32, 0.06, 18), CHROME, loc=(0, 0, 0.03)),
          Part(coll, "pole", bm_cyl(0.05, 0.05, 0.4, 10), CHROME, loc=(0, 0, 0.22))]
    bake(dr, "Dryer", coll, parent=root)
    # poster
    po = [Part(coll, "frame", bm_box(0.9, 0.04, 1.2), GOLD, loc=(0, 0, 0)).bevel(0.02, 2),
          Part(coll, "art", bm_box(0.78, 0.03, 1.06), mat("PosterBg", "#F8BBD0"), loc=(0, -0.01, 0)),
          Part(coll, "t1", txt("CHEZ", 0.14), mat("PosterTxt", "#AD1457"), loc=(0, -0.03, 0.32), rot=(math.pi / 2, 0, 0), smooth=False),
          Part(coll, "t2", txt("FABIO", 0.16), mat("PosterTxt", "#AD1457"), loc=(0, -0.03, 0.12), rot=(math.pi / 2, 0, 0), smooth=False),
          Part(coll, "face", bm_sphere(0.14), mat("PosterSkin", "#E8B89A"), loc=(0, -0.03, -0.18)),
          Part(coll, "pomp", bm_sphere(0.14, 0.05, 0.12), mat("PosterPomp", "#26A69A"), loc=(0, -0.05, -0.02))]
    bake(po, "Poster", coll, parent=root)
    # salon cape (draped over Lulu in the chair)
    cp = [Part(coll, "cape", bm_cyl(0.5, 0.1, 0.62, 24), mat("Cape", "#F8BBD0", rough=0.6), loc=(0, 0, -0.31)),
          Part(coll, "collar", bm_torus(0.09, 0.03, 18, 6), mat("CapeCollar", "#FFFFFF"), loc=(0, 0, 0.0))]
    bake(cp, "Cape", coll, parent=root)
    # a foil (processing beat)
    bake([Part(coll, "foil", bm_box(0.09, 0.02, 0.11), mat("Foil", "#E0E0E0", rough=0.15, metal=1.0), loc=(0, 0, 0)).bevel(0.01, 1)], "Foil", coll, parent=root)
    return coll


def build_salon_front():
    S = shared()
    coll = scene_coll("SalonFront")
    root = root_empty(coll, "SalonFront")
    WALL = mat("SalonWall", "#F8BBD0", rough=0.85)
    TRIM = mat("SalonTrim", "#EC407A", rough=0.6)
    WHITE = mat("SalonWhite", "#FAFAFA", rough=0.6)
    WIN = mat("Window", "#FFE3F1", rough=0.1, emit=0.5)
    SIGN = mat("NeonSign", "#FF4FA3", rough=0.3, emit=1.6)
    w, d, h = 10.0, 7.0, 4.6
    hd = d / 2
    parts = [Part(coll, "walls", bm_box(w, d, h), WALL, loc=(0, 0, h / 2), smooth=False),
             Part(coll, "parapet", bm_box(w + 0.3, d + 0.3, 0.4), TRIM, loc=(0, 0, h + 0.2), smooth=False),
             Part(coll, "roofTop", bm_box(w, d, 0.1), mat("SalonRoof", "#B0BEC5"), loc=(0, 0, h + 0.3), smooth=False),
             Part(coll, "base", bm_box(w + 0.1, d + 0.1, 0.4), TRIM, loc=(0, 0, 0.2), smooth=False),
             Part(coll, "window", bm_box(5.2, 0.1, 2.2), WIN, loc=(-1.6, -hd - 0.03, 1.6), smooth=False),
             Part(coll, "winFrame", bm_box(5.5, 0.08, 2.5), WHITE, loc=(-1.6, -hd - 0.0, 1.6), smooth=False),
             Part(coll, "door", bm_box(1.4, 0.1, 2.5), mat("SalonDoor", "#AD1457"), loc=(3.0, -hd - 0.03, 1.25), smooth=False),
             Part(coll, "doorGlass", bm_box(0.9, 0.12, 1.4), WIN, loc=(3.0, -hd - 0.05, 1.55), smooth=False),
             Part(coll, "board", bm_box(6.4, 0.2, 1.0), mat("SignBoard", "#880E4F"), loc=(-0.6, -hd - 0.12, 3.6), smooth=False),
             Part(coll, "signTxt", txt("CHEZ FABIO", 0.62), SIGN, loc=(-0.6, -hd - 0.24, 3.6), rot=(math.pi / 2, 0, 0), smooth=False),
             Part(coll, "subTxt", txt("HAIR * GLAMOUR * DRAMA", 0.2), WHITE, loc=(-1.6, -hd - 0.1, 2.95), rot=(math.pi / 2, 0, 0), smooth=False),
             Part(coll, "chair", bm_box(0.8, 0.6, 0.9), mat("ChairPink", "#EC407A", rough=0.25), loc=(-2.6, -hd + 0.8, 0.85)).bevel(0.1, 2),
             Part(coll, "mirror", bm_box(1.0, 0.1, 1.3), mat("SalonGold", "#FFC94A", rough=0.25, metal=0.85), loc=(-2.6, -hd + 0.3, 2.0)),
             Part(coll, "boardA", bm_box(0.9, 0.08, 1.1), WHITE, loc=(1.4, -hd - 1.3, 0.55), rot=(0.18, 0, 0), smooth=False),
             Part(coll, "boardTxt", txt("WALK-INS", 0.15), TRIM, loc=(1.4, -hd - 1.41, 0.72), rot=(math.pi / 2 + 0.18, 0, 0), smooth=False),
             Part(coll, "boardTxt2", txt("WELCOME!", 0.15), TRIM, loc=(1.4, -hd - 1.37, 0.46), rot=(math.pi / 2 + 0.18, 0, 0), smooth=False)]
    # striped awning over the window
    for i in range(10):
        parts.append(Part(coll, "awn", bm_box(0.55, 1.3, 0.06), TRIM if i % 2 == 0 else WHITE, loc=(-4.0 + i * 0.55 - 0.0, -hd - 0.6, 2.95), rot=(0.35, 0, 0), smooth=False))
    # scissors icon on the sign (two rings + blades)
    for s in (-1, 1):
        parts.append(Part(coll, "ring", bm_torus(0.14, 0.035, 14, 5), WHITE, loc=(2.0, -hd - 0.24, 3.6 + s * 0.17), rot=(math.pi / 2, 0, 0)))
        parts.append(Part(coll, "blade", bm_box(0.6, 0.04, 0.06), WHITE, loc=(2.42, -hd - 0.24, 3.6 - s * 0.05), rot=(0, s * 0.35, 0)))
    for x in (-4.6, 4.4):
        parts.append(Part(coll, "planter", bm_box(0.8, 0.8, 0.6), TRIM, loc=(x, -hd - 0.6, 0.3), smooth=False))
        parts.append(Part(coll, "shrub", bm_ico(0.5, 1), S.LEAVES, loc=(x, -hd - 0.6, 0.85), smooth=False))
    bake(parts, "SalonFront_body", coll, parent=root)
    # the spinning barber pole (rotate its local Z / three Y)
    RED = mat("PoleRed", "#E53935", rough=0.4)
    BLUE = mat("PoleBlue", "#1E88E5", rough=0.4)
    px, py = 4.75, -hd - 0.25
    pp = [Part(coll, "glass", bm_cyl(0.16, 0.16, 1.4, 18), mat("PoleWhite", "#FFFFFF", rough=0.3), loc=(px, py, 2.3)),
          Part(coll, "capT", bm_sphere(0.2), S.CHROME, loc=(px, py, 3.05)),
          Part(coll, "capB", bm_cyl(0.2, 0.2, 0.12, 18), S.CHROME, loc=(px, py, 1.56))]
    for i in range(7):
        pp.append(Part(coll, "stripe", bm_torus(0.165, 0.028, 18, 5), RED if i % 2 == 0 else BLUE, loc=(px, py, 1.75 + i * 0.18), rot=(0.45, 0, 0)))
    bake_at(pp, "Pole", coll, root, (px, py, 0))
    return coll


# ── the sasquatch (animatable like a person: Body, Arm_*, Leg_*) ─────────
def build_sasquatch():
    coll = scene_coll("Sasquatch")
    root = root_empty(coll, "Sasquatch")
    FUR = mat("Fur", "#3E2723", rough=0.95)
    TUFT = mat("FurLight", "#5D4037", rough=0.95)
    FACE = mat("SasFace", "#6D4C41", rough=0.8)
    EYE = mat("Eye", "#1B1B1B", rough=0.3)
    SHINE = mat("EyeShine", "#FFFFFF", rough=0.2)
    body = [Part(coll, "torso", bm_sphere(0.5, 0.38, 0.62), FUR, loc=(0, 0, 1.55)),
            Part(coll, "belly", bm_sphere(0.36, 0.2, 0.42), TUFT, loc=(0, -0.22, 1.45)),
            Part(coll, "hips", bm_sphere(0.42, 0.34, 0.28), FUR, loc=(0, 0, 1.05)),
            Part(coll, "head", bm_sphere(0.3, 0.3, 0.32, 18, 12), FUR, loc=(0, -0.04, 2.33)),
            Part(coll, "face", bm_sphere(0.21, 0.12, 0.2), FACE, loc=(0, -0.24, 2.3)),
            Part(coll, "brow", bm_box(0.36, 0.1, 0.07), FUR, loc=(0, -0.3, 2.42)).bevel(0.03, 2),
            Part(coll, "nose", bm_sphere(0.06, 0.05, 0.04), FUR, loc=(0, -0.36, 2.3)),
            Part(coll, "mouth", bm_sphere(0.07, 0.02, 0.015), EYE, loc=(0, -0.35, 2.2))]
    for s in (-1, 1):
        body.append(Part(coll, "eye", bm_sphere(0.04, 0.02, 0.045), EYE, loc=(s * 0.08, -0.35, 2.35)))
        body.append(Part(coll, "shine", bm_sphere(0.013), SHINE, loc=(s * 0.08 + 0.012, -0.37, 2.37)))
        body.append(Part(coll, "ear", bm_sphere(0.06, 0.04, 0.08), FUR, loc=(s * 0.3, 0, 2.33)))
    for i in range(16):
        a = i / 16 * math.pi * 2
        body.append(Part(coll, "tuft", bm_ico(0.11, 1), TUFT if i % 2 else FUR,
                         loc=(math.cos(a) * 0.42, math.sin(a) * 0.3, 1.9 + math.sin(a * 3) * 0.08), smooth=False))
    for i in range(7):
        a = i / 7 * math.pi * 2
        body.append(Part(coll, "htuft", bm_ico(0.09, 1), FUR, loc=(math.cos(a) * 0.16, math.sin(a) * 0.14 + 0.04, 2.6), smooth=False))
    bake(body, "Body", coll, parent=root)
    for nm, s in (("Arm_L", 1), ("Arm_R", -1)):
        sh = (s * 0.55, 0, 1.98)
        bake_at([Part(coll, nm + "u", bm_cyl(0.16, 0.13, 1.0, 10), FUR, loc=(s * 0.58, 0, 1.48)),
                 Part(coll, nm + "s", bm_sphere(0.18), FUR, loc=sh),
                 Part(coll, nm + "h", bm_sphere(0.15, 0.12, 0.17), FACE, loc=(s * 0.6, -0.02, 0.92)),
                 Part(coll, nm + "t", bm_ico(0.1, 1), TUFT, loc=(s * 0.66, 0.02, 1.6), smooth=False)], nm, coll, root, sh)
    for nm, s in (("Leg_L", 1), ("Leg_R", -1)):
        hp = (s * 0.2, 0, 1.0)
        bake_at([Part(coll, nm + "l", bm_cyl(0.17, 0.14, 0.95, 10), FUR, loc=(s * 0.21, 0, 0.55)),
                 Part(coll, nm + "f", bm_sphere(0.16, 0.3, 0.08), FACE, loc=(s * 0.22, -0.1, 0.07))], nm, coll, root, hp)
    return coll


# ── the angry animal kin ─────────────────────────────────────────────────
def build_duck():
    coll = scene_coll("Duck")
    root = root_empty(coll, "Duck")
    W = mat("DuckWhite", "#FAFAFA", rough=0.8)
    BILL = mat("Bill", "#FF9800", rough=0.5)
    EYE = mat("Eye", "#1B1B1B", rough=0.3)
    BROW = mat("Brow", "#3E2723", rough=0.6)
    body = [Part(coll, "body", bm_sphere(0.22, 0.3, 0.19), W, loc=(0, 0.02, 0.38)),
            Part(coll, "tail", bm_sphere(0.08, 0.1, 0.06), W, loc=(0, 0.3, 0.47), rot=(-0.6, 0, 0)),
            Part(coll, "neck", bm_cyl(0.08, 0.09, 0.2, 10), W, loc=(0, -0.18, 0.55)),
            Part(coll, "head", bm_sphere(0.14), W, loc=(0, -0.2, 0.7)),
            Part(coll, "bill", bm_sphere(0.08, 0.1, 0.035), BILL, loc=(0, -0.34, 0.67))]
    for s in (-1, 1):
        body.append(Part(coll, "eye", bm_sphere(0.022), EYE, loc=(s * 0.07, -0.31, 0.74)))
        body.append(Part(coll, "brow", bm_box(0.07, 0.015, 0.018), BROW, loc=(s * 0.065, -0.33, 0.79), rot=(0, -s * 0.5, 0)))
    bake(body, "Body", coll, parent=root)
    for nm, s in (("Arm_L", 1), ("Arm_R", -1)):
        p = (s * 0.2, 0.0, 0.46)
        bake_at([Part(coll, nm, bm_sphere(0.05, 0.2, 0.12), W, loc=(s * 0.22, 0.04, 0.38), rot=(0.3, 0, 0))], nm, coll, root, p)
    for nm, s in (("Leg_L", 1), ("Leg_R", -1)):
        hp = (s * 0.08, 0, 0.22)
        bake_at([Part(coll, nm + "l", bm_cyl(0.018, 0.018, 0.2, 6), BILL, loc=(s * 0.08, 0, 0.12)),
                 Part(coll, nm + "f", bm_sphere(0.05, 0.08, 0.015), BILL, loc=(s * 0.08, -0.05, 0.015))], nm, coll, root, hp)
    return coll


def build_raccoon():
    coll = scene_coll("Raccoon")
    root = root_empty(coll, "Raccoon")
    G = mat("RacGrey", "#8D8D8D", rough=0.9)
    D = mat("RacDark", "#3A3A3A", rough=0.9)
    L = mat("RacLight", "#E0E0E0", rough=0.9)
    EYE = mat("Eye", "#1B1B1B", rough=0.3)
    SH = mat("EyeShine", "#FFFFFF", rough=0.2)
    body = [Part(coll, "body", bm_sphere(0.2, 0.17, 0.27), G, loc=(0, 0, 0.5)),
            Part(coll, "belly", bm_sphere(0.13, 0.08, 0.19), L, loc=(0, -0.12, 0.48)),
            Part(coll, "head", bm_sphere(0.17, 0.16, 0.15), G, loc=(0, -0.03, 0.88)),
            Part(coll, "mask", bm_sphere(0.15, 0.08, 0.06), D, loc=(0, -0.13, 0.9)),
            Part(coll, "muzzle", bm_sphere(0.07, 0.07, 0.05), L, loc=(0, -0.18, 0.84)),
            Part(coll, "nose", bm_sphere(0.025), D, loc=(0, -0.25, 0.85))]
    for s in (-1, 1):
        body.append(Part(coll, "ear", bm_sphere(0.05, 0.03, 0.06), D, loc=(s * 0.11, 0.0, 1.02)))
        body.append(Part(coll, "eye", bm_sphere(0.024), SH, loc=(s * 0.06, -0.2, 0.91)))
        body.append(Part(coll, "pupil", bm_sphere(0.013), EYE, loc=(s * 0.06, -0.22, 0.91)))
        body.append(Part(coll, "brow", bm_box(0.07, 0.015, 0.018), D, loc=(s * 0.06, -0.2, 0.96), rot=(0, -s * 0.5, 0)))
    for i in range(5):
        body.append(Part(coll, "tail", bm_sphere(0.08, 0.08, 0.07), D if i % 2 else G, loc=(0, 0.2 + i * 0.05, 0.3 + i * 0.07)))
    bake(body, "Body", coll, parent=root)
    for nm, s in (("Arm_L", 1), ("Arm_R", -1)):
        p = (s * 0.18, 0, 0.68)
        bake_at([Part(coll, nm, bm_cyl(0.04, 0.035, 0.24, 8), D, loc=(s * 0.19, 0, 0.56))], nm, coll, root, p)
    for nm, s in (("Leg_L", 1), ("Leg_R", -1)):
        hp = (s * 0.09, 0, 0.3)
        bake_at([Part(coll, nm, bm_cyl(0.05, 0.045, 0.28, 8), D, loc=(s * 0.09, 0, 0.15)),
                 Part(coll, nm + "f", bm_sphere(0.05, 0.08, 0.03), D, loc=(s * 0.09, -0.04, 0.02))], nm, coll, root, hp)
    return coll


# ── Heshy's front yard + pool ───────────────────────────────────────────
def build_heshy_pool():
    S = shared()
    coll = scene_coll("HeshyPool")
    root = root_empty(coll, "HeshyPool")
    GRASS = mat("YardGrass", "#8BC34A", rough=1.0)
    RIM = mat("PoolRim", "#FFB300", rough=0.35)
    RIM2 = mat("PoolRim2", "#FF7043", rough=0.35)
    WHITE = mat("YardWhite", "#F5F0E0", rough=0.7)
    parts = [Part(coll, "pad", bm_box(8.0, 7.0, 0.06), GRASS, loc=(0, 0, 0.03), smooth=False),
             Part(coll, "edge", bm_box(8.2, 7.2, 0.04), mat("YardEdge", "#7CB342", rough=1.0), loc=(0, 0, 0.02), smooth=False),
             Part(coll, "rim1", bm_torus(1.6, 0.26, 32, 10), RIM, loc=(0, 0, 0.27)),
             Part(coll, "rim2", bm_torus(1.6, 0.24, 32, 10), RIM2, loc=(0, 0, 0.72)),
             Part(coll, "floor", bm_cyl(1.6, 1.6, 0.06, 32), mat("PoolFloor", "#4FC3F7"), loc=(0, 0, 0.08)),
             Part(coll, "water", bm_cyl(1.5, 1.5, 0.04, 32), mat("WaterPool", "#29B6F6", rough=0.05), loc=(0, 0, 0.78)),
             Part(coll, "tube", bm_torus(0.42, 0.15, 24, 10), mat("InnerTube", "#FF4081", rough=0.3), loc=(0.75, 0.55, 0.82)),
             Part(coll, "chairSeat", bm_box(0.55, 0.55, 0.06), mat("Chair", "#FF7043"), loc=(2.6, -1.3, 0.48)),
             Part(coll, "chairBack", bm_box(0.55, 0.06, 0.6), mat("Chair", "#FF7043"), loc=(2.6, -1.0, 0.8), rot=(-0.25, 0, 0)),
             Part(coll, "table", bm_cyl(0.3, 0.3, 0.04, 16), WHITE, loc=(1.9, -1.9, 0.62)),
             Part(coll, "tableLeg", bm_cyl(0.03, 0.03, 0.6, 8), S.CHROME, loc=(1.9, -1.9, 0.31)),
             Part(coll, "drink", bm_cyl(0.06, 0.05, 0.18, 10), mat("Drink", "#FFB74D", rough=0.1), loc=(1.9, -1.9, 0.73)),
             Part(coll, "straw", bm_cyl(0.008, 0.008, 0.2, 6), mat("Straw", "#E91E63"), loc=(1.92, -1.9, 0.86), rot=(0.25, 0, 0)),
             Part(coll, "umbPole", bm_cyl(0.035, 0.035, 2.4, 8), WHITE, loc=(-2.4, 1.6, 1.2)),
             Part(coll, "signPost", bm_box(0.08, 0.08, 1.1), mat("Wood", "#8D6E63"), loc=(-3.2, -3.0, 0.55), smooth=False),
             Part(coll, "signBoard", bm_box(1.4, 0.06, 0.5), mat("WoodLight", "#D7B98E"), loc=(-3.2, -3.05, 1.05), smooth=False),
             Part(coll, "signTxt", txt("HESHY'S POOL", 0.15), mat("SignInk", "#0277BD"), loc=(-3.2, -3.09, 1.05), rot=(math.pi / 2, 0, 0), smooth=False)]
    # striped beach umbrella: alternating pink / white canopy bands
    for i, (r1, r2, z) in enumerate(((1.5, 1.1, 2.25), (1.1, 0.7, 2.4), (0.7, 0.3, 2.55), (0.3, 0.04, 2.68))):
        parts.append(Part(coll, "umb", bm_cyl(r1, r2, 0.15, 20), mat("Umb%d" % (i % 2), "#E91E63" if i % 2 == 0 else "#FFFFFF", rough=0.6),
                          loc=(-2.4, 1.6, z), smooth=False))
    # beach ball (stripes)
    cols = ("#FF5252", "#FFFFFF", "#FFEB3B", "#FFFFFF", "#42A5F5", "#FFFFFF")
    for i in range(6):
        parts.append(Part(coll, "ball", bm_sphere(0.1, 0.32, 0.32, 12, 10), mat("Ball%d" % i, cols[i], rough=0.3),
                          loc=(-1.0, -0.8, 1.0), rot=(0, 0, i * math.pi / 6)))
    # picket fence along the back + sides
    for i in range(-15, 16):
        parts.append(Part(coll, "picket", bm_box(0.12, 0.05, 0.9), WHITE, loc=(i * 0.26, 3.4, 0.45), smooth=False))
    for sx in (-1, 1):
        for i in range(0, 10):
            parts.append(Part(coll, "picketS", bm_box(0.05, 0.12, 0.9), WHITE, loc=(sx * 3.95, 3.3 - i * 0.6, 0.45), smooth=False))
    parts.append(Part(coll, "rail", bm_box(8.0, 0.04, 0.07), WHITE, loc=(0, 3.37, 0.65), smooth=False))
    bake(parts, "HeshyPool_body", coll, parent=root)
    return coll


# ── the uncles ───────────────────────────────────────────────────────────
def build_yedidya():
    spec = dict(hair="short", hair_color="#1A1A1A", top="#1C2733", bottom="pants", bottom_color="#263238", shoes="#111111",
                extras=["fedora", "beard"], extra_colors={"Hat": "#0A0A0A", "HatBand": "#1A1A1A", "Beard": "#141414"})

    def extra(coll, g):
        W = mat("Collar", "#ECEFF1")
        P = [Part(coll, "collarV", bm_box(0.12, 0.02, 0.12), W, loc=(0, -0.15, g.sh - 0.06), rot=(0.1, 0, 0.785)),
             Part(coll, "pin", bm_cyl(0.035, 0.035, 0.01, 14, "Y"), mat("PinRed", "#E53935"), loc=(-0.1, -0.16, g.chest + 0.05)),
             Part(coll, "pinSlash", bm_box(0.06, 0.012, 0.01), mat("PinWhite", "#FFFFFF"), loc=(-0.1, -0.168, g.chest + 0.05), rot=(0, 0.7, 0))]
        B = mat("Beard", "#141414")
        for i, (x, z, r) in enumerate(((-0.08, -0.12, 0.06), (0.08, -0.13, 0.065), (0.0, -0.17, 0.07), (-0.11, -0.05, 0.05), (0.11, -0.04, 0.05))):
            P.append(Part(coll, "scruff", bm_ico(r * g.hk, 1), B, loc=(x * g.hk, -g.hr * 0.6, g.hz + z * g.hk), smooth=False))
        return P
    return person("CameosYedidya", spec, extra)


def build_burry():
    spec = dict(hair="short", hair_color="#3E2723", top="#26A69A", sleeves="short", bottom="pants", bottom_color="#455A64",
                extras=["sunglasses", "kippah"], extra_colors={"Kippah": "#5D4037"})

    def extra(coll, g):
        P = []
        for i, (x, z) in enumerate(((-0.1, 0.1), (0.08, 0.02), (-0.04, -0.12), (0.12, -0.15), (-0.13, -0.08), (0.02, 0.16))):
            P.append(Part(coll, "palm", bm_sphere(0.045, 0.012, 0.025), mat("Palm", "#FFEB3B" if i % 2 else "#2E7D32"),
                          loc=(x, -0.152 * g.wf, g.chest + z), rot=(0, 0.5 * (i % 3 - 1), 0)))
        return P
    return person("CameosBurry", spec, extra)


def build_shuey():
    spec = dict(hair="short", hair_color="#9E9E9E", top="#26A69A", sleeves="short", bottom="pants", bottom_color="#26A69A",
                shoes="#ECEFF1")

    def extra(coll, g):
        return stethoscope(coll, g) + head_mirror(coll, g) + [
            Part(coll, "vneck", bm_box(0.1, 0.02, 0.08), mat("Skin", "#FFD2B0"), loc=(0, -0.15, g.sh - 0.04), rot=(0, 0, 0.785)),
            Part(coll, "pocket", bm_box(0.1, 0.015, 0.08), mat("ScrubDark", "#00897B"), loc=(0.09, -0.155, g.chest + 0.04))]
    return person("CameosShuey", spec, extra)


def build_cat_angel():
    coll = scene_coll("CatAngel")
    root = root_empty(coll, "CatAngel")
    FUR = mat("GhostFur", "#BDBDBD", rough=0.8)
    HALO = mat("NeonHalo", "#FFE082", rough=0.3, emit=2.5)
    WING = mat("GhostWing", "#FFFFFF", rough=0.7)
    EYE = mat("Eye", "#424242")
    parts = [Part(coll, "body", bm_sphere(0.16, 0.2, 0.16), FUR, loc=(0, 0.04, 0.16)),
             Part(coll, "head", bm_sphere(0.13), FUR, loc=(0, -0.12, 0.33)),
             Part(coll, "halo", bm_torus(0.1, 0.014, 18, 5), HALO, loc=(0, -0.12, 0.53)),
             Part(coll, "tail", bm_cyl(0.025, 0.02, 0.3, 6), FUR, loc=(0, 0.25, 0.25), rot=(0.7, 0, 0))]
    for s in (-1, 1):
        parts.append(Part(coll, "ear", bm_cyl(0.045, 0.0, 0.08, 4), FUR, loc=(s * 0.07, -0.12, 0.45)))
        parts.append(Part(coll, "wing", bm_sphere(0.04, 0.12, 0.17), WING, loc=(s * 0.19, 0.08, 0.3), rot=(0.3, s * 0.5, 0)))
        parts.append(Part(coll, "eye", bm_box(0.04, 0.01, 0.01), EYE, loc=(s * 0.045, -0.245, 0.34), rot=(0, s * 0.3, 0)))
    parts.append(Part(coll, "tear", bm_sphere(0.012, 0.008, 0.02), mat("Tear", "#7EC8F0", emit=0.5), loc=(0.05, -0.25, 0.3)))
    bake(parts, "Cat", coll, parent=root)
    return coll


# ── crash-scene strangers ────────────────────────────────────────────────
def build_grandpa():
    return person("CameosGrandpa", dict(hair="curly", hair_color="#F5F5F5", top="#B71C1C", bottom="pants", bottom_color="#5D4037",
                                         extras=["glasses", "mustache"], extra_colors={"Beard": "#F5F5F5"}))


def build_business():
    return person("CameosBusiness", dict(hair="short", hair_color="#3E2723", top="#37474F", bottom="pants", bottom_color="#263238",
                                          shoes="#1A1A1A", extras=["tie"], extra_colors={"Tie": "#C62828"}))


def build_teen():
    return person("CameosTeen", dict(hair="short", hair_color="#212121", top="#7E57C2", sleeves="short", bottom="pants",
                                      bottom_color="#1565C0", shoes="#FFFFFF", height=1.56, extras=["cap"], extra_colors={"Hat": "#FDD835"}))


def build_tourist():
    def extra(coll, g):
        HAT = mat("SunHat", "#E8D7A5", rough=0.9)
        top = g.hz + g.hr
        return [Part(coll, "brim", bm_cyl(g.hr * 1.9, g.hr * 1.9, 0.02, 24), HAT, loc=(0, 0, top - g.hr * 0.12)),
                Part(coll, "crown", bm_cyl(g.hr * 0.9, g.hr * 0.85, g.hr * 0.55, 20), HAT, loc=(0, 0, top + g.hr * 0.15)),
                Part(coll, "band", bm_cyl(g.hr * 0.91, g.hr * 0.91, g.hr * 0.14, 20), mat("SunHatBand", "#E91E63"), loc=(0, 0, top)),
                Part(coll, "camera", bm_box(0.14, 0.06, 0.09), mat("Camera", "#212121"), loc=(0, -0.19, g.chest - 0.04)).bevel(0.015, 2),
                Part(coll, "lens", bm_cyl(0.035, 0.035, 0.05, 12, "Y"), mat("CamLens", "#455A64", rough=0.2, metal=0.6), loc=(0, -0.24, g.chest - 0.04)),
                Part(coll, "strap", bm_torus(0.12, 0.008, 18, 4), mat("Camera", "#212121"), loc=(0, -0.06, g.chest + 0.06), rot=(1.1, 0, 0))]
    return person("CameosTourist", dict(hair="short", hair_color="#8D6E63", top="#26A69A", sleeves="short", bottom="pants",
                                         bottom_color="#D7CCC8", extras=["sunglasses"]), extra)


def build_delivery():
    return person("CameosDelivery", dict(hair="short", hair_color="#3E2723", top="#FB8C00", sleeves="short", bottom="pants",
                                          bottom_color="#5D4037", extras=["cap"], extra_colors={"Hat": "#5D4037"}))


def build_hipster():
    def extra(coll, g):
        B = mat("Beanie", "#455A64", rough=0.95)
        return [Part(coll, "beanie", bm_sphere(g.hr * 1.08, g.hr * 1.04, g.hr * 0.85), B, loc=(0, 0.01, g.hz + g.hr * 0.45)),
                Part(coll, "fold", bm_torus(g.hr * 1.0, g.hr * 0.12, 22, 6), B, loc=(0, 0, g.hz + g.hr * 0.25))]
    return person("CameosHipster", dict(hair="short", hair_color="#3E2723", top="#8D6E63", bottom="pants", bottom_color="#37474F",
                                         extras=["beard", "glasses"], extra_colors={"Beard": "#4E342E", "Glasses": "#212121"}), extra)


# ── the ER cast ──────────────────────────────────────────────────────────
def build_doctor():
    spec = dict(hair="short", hair_color="#9E9E9E", top="#80CBC4", bottom="pants", bottom_color="#455A64", shoes="#3E2723",
                extras=["lab_coat", "glasses", "beard", "kippah"], extra_colors={"Beard": "#9E9E9E", "Glasses": "#37474F", "Kippah": "#283593"})
    return person("CameosDoctor", spec, lambda coll, g: stethoscope(coll, g) + head_mirror(coll, g))


def build_tammy():
    spec = dict(hair="ponytail", hair_color="#5D4037", top="#F48FB1", sleeves="short", bottom="pants", bottom_color="#F48FB1",
                shoes="#FFFFFF", extra_colors={"HairTie": "#E91E63"})

    def extra(coll, g):
        W = mat("NurseCap", "#FFFFFF", rough=0.6)
        R = mat("NurseCross", "#E53935", rough=0.5)
        top = g.hz + g.hr
        return stethoscope(coll, g) + [
            Part(coll, "cap", bm_box(g.hr * 1.3, g.hr * 0.6, g.hr * 0.45), W, loc=(0, -g.hr * 0.25, top + g.hr * 0.05), rot=(-0.3, 0, 0)).bevel(0.01, 2),
            Part(coll, "crossV", bm_box(0.025, 0.01, 0.06), R, loc=(0, -g.hr * 0.58, top + g.hr * 0.12), rot=(-0.3, 0, 0)),
            Part(coll, "crossH", bm_box(0.06, 0.01, 0.025), R, loc=(0, -g.hr * 0.58, top + g.hr * 0.12), rot=(-0.3, 0, 0)),
            Part(coll, "badge", bm_box(0.07, 0.01, 0.04), mat("NameBadge", "#FFFFFF"), loc=(-0.09, -0.155, g.chest + 0.06)),
            Part(coll, "heart", bm_sphere(0.012), R, loc=(-0.09, -0.163, g.chest + 0.06))]
    return person("CameosTammy", spec, extra)


def build_raphael():
    spec = dict(hair="short", hair_color="#BDBDBD", skin="#F0C8A0", top="#6D2E2E", bottom="pants", bottom_color="#3E2723",
                width=1.3, extras=["belly", "necklace", "mustache"], extra_colors={"Gold": "#FFD700", "Beard": "#BDBDBD"})

    def extra(coll, g):
        return [Part(coll, "cigar", bm_cyl(0.017, 0.017, 0.16, 8, "Y"), mat("Cigar", "#6D4C41"), loc=(0.05, g.fy - 0.08, g.hz - 0.09), rot=(0.1, 0, 0.3)),
                Part(coll, "tip", bm_sphere(0.019), mat("NeonCigar", "#FF7043", emit=3.0), loc=(0.075, g.fy - 0.16, g.hz - 0.1)),
                Part(coll, "ring", bm_torus(0.02, 0.006, 10, 4), mat("Gold", "#FFD700"), loc=(-0.28, -0.02, 0.84))]
    return person("CameosRaphael", spec, extra)


def build_rabbi():
    def extra(coll, g):
        B = mat("Beard", "#CFCFCF")
        return [Part(coll, "beardLong", bm_sphere(g.hr * 0.6, g.hr * 0.35, g.hr * 0.9), B, loc=(0, -g.hr * 0.55, g.hz - g.hr * 1.2))]
    return person("CameosRabbi", dict(hair="short", hair_color="#3E2723", top="#212121", bottom="pants", bottom_color="#212121",
                                       extras=["fedora", "beard", "glasses", "tzitzit"], extra_colors={"Beard": "#CFCFCF", "Hat": "#111111"}), extra)


def build_clown():
    def extra(coll, g):
        P = [Part(coll, "nose", bm_sphere(0.045 * g.hk), mat("ClownNose", "#F44336", rough=0.2), loc=(0, g.fy - 0.03, g.hz - 0.02)),
             Part(coll, "smile", bm_sphere(0.07 * g.hk, 0.012, 0.025 * g.hk), mat("ClownSmile", "#D32F2F"), loc=(0, g.fy + 0.005, g.hz - 0.085))]
        cols = ("#E91E63", "#2196F3", "#4CAF50", "#FF9800")
        for i, (x, z) in enumerate(((-0.1, 0.08), (0.09, 0.12), (0.0, -0.05), (-0.08, -0.14), (0.11, -0.1))):
            P.append(Part(coll, "dot", bm_sphere(0.03, 0.01, 0.03), mat("Dot%d" % (i % 4), cols[i % 4]), loc=(x, -0.152, g.chest + z)))
        for s in (-1, 1):
            P.append(Part(coll, "pom", bm_sphere(0.04), mat("Pom", "#E53935"), loc=(0, -0.16, g.chest - 0.12 + s * 0.0)))
        return P
    return person("CameosClown", dict(hair="curly", hair_color="#FF3D00", skin="#FFF3E0", top="#FFEB3B", bottom="pants",
                                       bottom_color="#1E88E5", shoes="#E53935", extras=["bowtie"], extra_colors={"Tie": "#E53935"}), extra)


def build_zaidy():
    def extra(coll, g):
        return [Part(coll, "aid", bm_sphere(0.025), mat("HearingAid", "#F5D0B0"), loc=(g.hr * 1.02, -0.02, g.hz - 0.01))]
    return person("CameosZaidy", dict(hair="short", hair_color="#E0E0E0", top="#8D6E63", bottom="pants", bottom_color="#5D4037",
                                       shoes="#3E2723", extras=["glasses", "mustache", "fedora"],
                                       extra_colors={"Hat": "#616161", "HatBand": "#424242", "Beard": "#EEEEEE"}), extra)


def build_fayge():
    def extra(coll, g):
        BL = mat("BabyBlanket", "#F8BBD0", rough=0.9)
        return [Part(coll, "bundle", bm_sphere(0.13, 0.11, 0.2), BL, loc=(0.02, -0.24, g.chest - 0.06), rot=(0, 0.9, 0)),
                Part(coll, "babyHead", bm_sphere(0.07), mat("Skin", "#FFD2B0"), loc=(0.12, -0.25, g.chest + 0.07)),
                Part(coll, "bonnet", bm_sphere(0.078, 0.07, 0.06), mat("Bonnet", "#FFFFFF"), loc=(0.13, -0.23, g.chest + 0.1))]
    return person("CameosFayge", dict(hair="sheitel", hair_color="#5D4037", top="#80CBC4", bottom="skirt", bottom_color="#37474F"), extra)


# ── the ambulance ────────────────────────────────────────────────────────
def build_ambulance():
    S = shared()
    coll = scene_coll("Ambulance")
    root = root_empty(coll, "Ambulance")
    W = mat("AmbWhite", "#FAFAFA", rough=0.45)
    RED = mat("AmbRed", "#E53935", rough=0.5)
    RL = mat("LightRed", "#FF1744", rough=0.3, emit=3.0)
    BL = mat("LightBlue", "#2979FF", rough=0.3, emit=3.0)
    parts = [Part(coll, "box", bm_box(2.2, 3.7, 2.1), W, loc=(0, 0.75, 1.45)).bevel(0.12, 3),
             Part(coll, "cab", bm_box(2.1, 1.7, 1.25), W, loc=(0, -1.9, 1.02)).bevel(0.16, 3),
             Part(coll, "wind", bm_box(1.9, 0.05, 0.6), S.TINT, loc=(0, -2.72, 1.32), rot=(-0.2, 0, 0)),
             Part(coll, "hood", bm_box(2.0, 0.9, 0.2), W, loc=(0, -2.5, 0.78)).bevel(0.08, 2),
             Part(coll, "bumperF", bm_box(2.1, 0.22, 0.25), S.DARK, loc=(0, -2.95, 0.5)).bevel(0.06, 2),
             Part(coll, "bumperR", bm_box(2.2, 0.2, 0.25), S.DARK, loc=(0, 2.65, 0.5)).bevel(0.06, 2),
             Part(coll, "bar", bm_box(1.6, 0.35, 0.08), S.DARK, loc=(0, -1.6, 1.68)),
             Part(coll, "red", bm_box(0.7, 0.3, 0.16), RL, loc=(-0.42, -1.6, 1.8)).bevel(0.05, 2),
             Part(coll, "blue", bm_box(0.7, 0.3, 0.16), BL, loc=(0.42, -1.6, 1.8)).bevel(0.05, 2)]
    for s in (-1, 1):
        parts.append(Part(coll, "stripe", bm_box(0.02, 5.2, 0.22), RED, loc=(s * 1.105, 0.0, 1.0)))
        parts.append(Part(coll, "crossV", bm_box(0.03, 0.3, 0.9), RED, loc=(s * 1.11, 1.3, 1.8)))
        parts.append(Part(coll, "crossH", bm_box(0.03, 0.9, 0.3), RED, loc=(s * 1.11, 1.3, 1.8)))
        parts.append(Part(coll, "head", bm_box(0.4, 0.06, 0.16), S.HEAD, loc=(s * 0.62, -2.98, 0.82)).bevel(0.03, 2))
        parts.append(Part(coll, "tail", bm_box(0.2, 0.06, 0.4), S.TAIL, loc=(s * 0.88, 2.62, 1.2)))
        parts.append(Part(coll, "rl", bm_box(0.15, 0.15, 0.15), RL if s > 0 else BL, loc=(s * 0.95, 2.5, 2.48)))
        parts.append(Part(coll, "sideWin", bm_box(0.04, 0.8, 0.45), S.TINT, loc=(s * 1.06, -1.85, 1.3)))
    parts.append(Part(coll, "txtL", txt("AMBULANCE", 0.32), RED, loc=(1.12, 0.6, 1.0 + 0.0), rot=(math.pi / 2, 0, math.pi / 2), smooth=False))
    parts.append(Part(coll, "txtR", txt("AMBULANCE", 0.32), RED, loc=(-1.12, 0.6, 1.0), rot=(math.pi / 2, 0, -math.pi / 2), smooth=False))
    bake(parts, "Ambulance_body", coll, parent=root)
    four_wheels(coll, root, 0.92, -1.9, 1.7, 0.42, 0.3, S.TIRE, S.CHROME, S.TIRE)
    return coll


# ── the ER room props ────────────────────────────────────────────────────
def build_er_props():
    S = shared()
    coll = scene_coll("ErProps")
    root = root_empty(coll, "ErProps")
    METAL = mat("ErMetal", "#CFD8DC", rough=0.35, metal=0.6)
    WHITE = mat("ErWhite", "#FAFAFA", rough=0.6)
    MINT = mat("ErSheet", "#A8DAC8", rough=0.9)
    DARK = mat("ErDark", "#263238", rough=0.5)
    # bed: head at +Y (the back wall), feet at -Y; mattress top ~0.72
    bed = [Part(coll, "frame", bm_box(1.05, 2.15, 0.12), METAL, loc=(0, 0, 0.55)).bevel(0.03, 2),
           Part(coll, "mattress", bm_box(0.95, 1.2, 0.16), WHITE, loc=(0, -0.45, 0.68)).bevel(0.05, 3),
           Part(coll, "back", bm_box(0.95, 0.95, 0.16), WHITE, loc=(0, 0.6, 0.92), rot=(0.6, 0, 0)).bevel(0.05, 3),
           Part(coll, "pillow", bm_box(0.7, 0.3, 0.14), mat("Pillow", "#FFFFFF", rough=0.9), loc=(0, 0.82, 1.15), rot=(0.6, 0, 0)).bevel(0.06, 3),
           Part(coll, "blanket", bm_box(1.0, 1.25, 0.1), MINT, loc=(0, -0.47, 0.83)).bevel(0.04, 3),
           Part(coll, "headboard", bm_box(1.05, 0.08, 0.7), METAL, loc=(0, 1.08, 0.95)).bevel(0.03, 2),
           Part(coll, "footboard", bm_box(1.05, 0.08, 0.45), METAL, loc=(0, -1.08, 0.78)).bevel(0.03, 2),
           Part(coll, "chart", bm_box(0.32, 0.02, 0.24), mat("ChartBoard", "#8D6E63"), loc=(0, -1.13, 0.85)),
           Part(coll, "chartPaper", bm_box(0.26, 0.01, 0.18), WHITE, loc=(0, -1.145, 0.84))]
    for sx in (-1, 1):
        bed.append(Part(coll, "rail", bm_box(0.03, 1.1, 0.03), METAL, loc=(sx * 0.52, -0.1, 0.92)))
        for sy in (-1, 1):
            bed.append(Part(coll, "leg", bm_cyl(0.025, 0.025, 0.45, 6), METAL, loc=(sx * 0.45, sy * 0.95, 0.27)))
            bed.append(Part(coll, "caster", bm_sphere(0.05), DARK, loc=(sx * 0.45, sy * 0.95, 0.05)))
    bake(bed, "Bed", coll, parent=root)
    # heart monitor on a rolling stand (screen face toward -Y; JS puts the EKG on it)
    mo = [Part(coll, "pole", bm_cyl(0.025, 0.025, 1.2, 8), METAL, loc=(0, 0, 0.62)),
          Part(coll, "base", bm_cyl(0.28, 0.3, 0.05, 5), METAL, loc=(0, 0, 0.04)),
          Part(coll, "case", bm_box(0.62, 0.22, 0.44), DARK, loc=(0, 0, 1.45)).bevel(0.04, 2),
          Part(coll, "screen", bm_box(0.52, 0.01, 0.34), mat("MonitorScreen", "#0A140F", rough=0.2), loc=(0, -0.115, 1.46))]
    bake(mo, "Monitor", coll, parent=root)
    # IV pole + bag
    iv = [Part(coll, "pole", bm_cyl(0.018, 0.018, 1.9, 8), METAL, loc=(0, 0, 0.95)),
          Part(coll, "base", bm_cyl(0.25, 0.27, 0.04, 5), METAL, loc=(0, 0, 0.03)),
          Part(coll, "hook", bm_box(0.36, 0.02, 0.02), METAL, loc=(0, 0, 1.9)),
          Part(coll, "bag", bm_box(0.16, 0.05, 0.26), mat("WaterBag", "#E1F5FE", rough=0.1), loc=(0.14, 0, 1.72)).bevel(0.03, 2),
          Part(coll, "tube", bm_cyl(0.006, 0.006, 0.9, 5), mat("Tube", "#ECEFF1"), loc=(0.16, -0.05, 1.2), rot=(0.15, 0, 0))]
    bake(iv, "IVPole", coll, parent=root)
    # privacy curtain: rail + 6 swaying panels
    bake([Part(coll, "rail", bm_box(3.6, 0.05, 0.05), METAL, loc=(0, 0, 0))], "CurtainRail", coll, parent=root)
    for i in range(6):
        p = Part(coll, "curt", bm_box(0.6, 0.06, 2.4), mat("Curtain%d" % (i % 2), "#9FD0DA" if i % 2 else "#86C1CF", rough=0.95),
                 loc=(0, 0, -1.2))
        bake_at([p], "Curtain_%d" % i, coll, root, (0, 0, 0))
    # supply cabinet
    cab = [Part(coll, "body", bm_box(1.1, 0.5, 1.9), mat("Cabinet", "#CFD8DC", rough=0.6), loc=(0, 0, 0.95)).bevel(0.03, 2),
           Part(coll, "glass", bm_box(0.95, 0.02, 0.9), S.GLASS, loc=(0, -0.26, 1.4))]
    for z in (1.1, 1.5):
        for i in range(4):
            cab.append(Part(coll, "box", bm_box(0.18, 0.2, 0.18), mat("Supply%d" % (i % 3), ("#FFFFFF", "#80CBC4", "#F48FB1")[i % 3]),
                            loc=(-0.33 + i * 0.22, 0, z)))
    cab.append(Part(coll, "handle", bm_box(0.04, 0.04, 0.3), METAL, loc=(0.4, -0.27, 0.6)))
    bake(cab, "Cabinet", coll, parent=root)
    # red cross emblem
    rc = [Part(coll, "plate", bm_box(0.8, 0.05, 0.8), WHITE, loc=(0, 0, 0)).bevel(0.12, 3),
          Part(coll, "v", bm_box(0.2, 0.06, 0.58), mat("CrossRed", "#E53935", emit=0.4), loc=(0, -0.02, 0)),
          Part(coll, "h", bm_box(0.58, 0.06, 0.2), mat("CrossRed", "#E53935", emit=0.4), loc=(0, -0.02, 0))]
    bake(rc, "RedCross", coll, parent=root)
    # wall clock (hands are made in JS)
    bake([Part(coll, "face", bm_cyl(0.28, 0.28, 0.04, 28, "Y"), WHITE, loc=(0, 0, 0)),
          Part(coll, "rim", bm_torus(0.28, 0.03, 28, 6), mat("ClockRim", "#90A4AE", rough=0.4, metal=0.4), loc=(0, 0, 0), rot=(math.pi / 2, 0, 0))],
         "Clock", coll, parent=root)
    # ceiling light panel
    bake([Part(coll, "housing", bm_box(1.6, 0.6, 0.06), METAL, loc=(0, 0, 0.03)),
          Part(coll, "glow", bm_box(1.5, 0.5, 0.02), mat("NeonPanel", "#FFFFF0", emit=2.5), loc=(0, 0, -0.01))], "Light", coll, parent=root)
    # window (escape route!) with blinds
    wi = [Part(coll, "frame", bm_box(1.8, 0.12, 1.5), WHITE, loc=(0, 0, 0), smooth=False),
          Part(coll, "pane", bm_box(1.6, 0.04, 1.3), mat("WindowSky", "#BFE6FF", rough=0.1, emit=0.6), loc=(0, -0.02, 0), smooth=False)]
    for i in range(7):
        wi.append(Part(coll, "blind", bm_box(1.6, 0.05, 0.04), mat("Blind", "#ECEFF1"), loc=(0, -0.07, 0.55 - i * 0.16), rot=(0.4, 0, 0)))
    bake(wi, "Window", coll, parent=root)
    # ceiling vent (another escape route)
    ve = [Part(coll, "frame", bm_box(0.8, 0.8, 0.05), METAL, loc=(0, 0, 0))]
    for i in range(6):
        ve.append(Part(coll, "slat", bm_box(0.7, 0.04, 0.03), DARK, loc=(0, -0.3 + i * 0.12, -0.03)))
    bake(ve, "Vent", coll, parent=root)
    # wheelchair (escape route!)
    wc = [Part(coll, "seat", bm_box(0.5, 0.5, 0.06), mat("WcSeat", "#1565C0"), loc=(0, 0, 0.5)),
          Part(coll, "back", bm_box(0.5, 0.05, 0.5), mat("WcSeat", "#1565C0"), loc=(0, 0.26, 0.78)),
          Part(coll, "foot", bm_box(0.4, 0.15, 0.03), METAL, loc=(0, -0.38, 0.12))]
    for s in (-1, 1):
        wc.append(Part(coll, "wheel", bm_torus(0.3, 0.025, 24, 6), DARK, loc=(s * 0.3, 0.05, 0.31), rot=(0, math.pi / 2, 0)))
        wc.append(Part(coll, "hub", bm_cyl(0.04, 0.04, 0.06, 10, "X"), METAL, loc=(s * 0.3, 0.05, 0.31)))
        wc.append(Part(coll, "caster", bm_sphere(0.05), DARK, loc=(s * 0.2, -0.32, 0.05)))
        wc.append(limb(coll, "handle", (s * 0.22, 0.28, 0.5), (s * 0.22, 0.34, 1.08), 0.015, METAL))
        wc.append(limb(coll, "frontBar", (s * 0.22, -0.2, 0.48), (s * 0.2, -0.36, 0.12), 0.015, METAL))
    bake(wc, "Wheelchair", coll, parent=root)
    # gurney (escape route!)
    gu = [Part(coll, "top", bm_box(0.7, 2.0, 0.1), WHITE, loc=(0, 0, 0.85)).bevel(0.04, 2),
          Part(coll, "frame", bm_box(0.66, 1.9, 0.04), METAL, loc=(0, 0, 0.75))]
    for sx in (-1, 1):
        for sy in (-1, 1):
            gu.append(Part(coll, "leg", bm_cyl(0.02, 0.02, 0.72, 6), METAL, loc=(sx * 0.28, sy * 0.85, 0.4)))
            gu.append(Part(coll, "caster", bm_sphere(0.05), DARK, loc=(sx * 0.28, sy * 0.85, 0.05)))
    bake(gu, "Gurney", coll, parent=root)
    # visitor chair
    vc = [Part(coll, "seat", bm_box(0.48, 0.46, 0.06), mat("VisitorChair", "#90A4AE"), loc=(0, 0, 0.46)).bevel(0.02, 2),
          Part(coll, "back", bm_box(0.48, 0.05, 0.45), mat("VisitorChair", "#90A4AE"), loc=(0, 0.22, 0.75)).bevel(0.02, 2)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            vc.append(Part(coll, "leg", bm_cyl(0.015, 0.015, 0.45, 6), METAL, loc=(sx * 0.2, sy * 0.19, 0.22)))
    bake(vc, "VisitorChair", coll, parent=root)
    # sanitizer + eye chart frame
    bake([Part(coll, "disp", bm_box(0.16, 0.1, 0.26), WHITE, loc=(0, 0, 0)).bevel(0.03, 2),
          Part(coll, "win", bm_box(0.1, 0.02, 0.1), mat("Sanitizer", "#80CBC4"), loc=(0, -0.05, 0.03))], "Sanitizer", coll, parent=root)
    # swinging ER doors with round windows + EMERGENCY sign
    dd = [Part(coll, "frame", bm_box(2.2, 0.15, 2.6), METAL, loc=(0, 0.02, 1.3), smooth=False),
          Part(coll, "sign", bm_box(1.8, 0.08, 0.4), mat("ErSign", "#E53935", emit=0.8), loc=(0, -0.05, 2.85)),
          Part(coll, "signTxt", txt("EMERGENCY", 0.26), WHITE, loc=(0, -0.1, 2.85), rot=(math.pi / 2, 0, 0), smooth=False)]
    for s in (-1, 1):
        dd.append(Part(coll, "door", bm_box(0.98, 0.08, 2.3), mat("ErDoor", "#B0BEC5", rough=0.5), loc=(s * 0.5, -0.05, 1.18)))
        dd.append(Part(coll, "porthole", bm_cyl(0.16, 0.16, 0.1, 18, "Y"), mat("WindowSky", "#BFE6FF", rough=0.1, emit=0.6), loc=(s * 0.5, -0.08, 1.65)))
        dd.append(Part(coll, "kick", bm_box(0.9, 0.09, 0.3), METAL, loc=(s * 0.5, -0.08, 0.2)))
    bake(dd, "Doors", coll, parent=root)
    return coll


# ── hand props (attached to hands / heads in JS) ─────────────────────────
def build_props():
    S = shared()
    coll = scene_coll("CameoProps")
    root = root_empty(coll, "CameoProps")
    STEEL = mat("Steel", "#CFD8DC", rough=0.2, metal=0.95)
    # scissors (blades along -Y = forward)
    sc = []
    for s in (-1, 1):
        sc.append(Part(coll, "ring", bm_torus(0.035, 0.009, 12, 4), mat("ScissorRing", "#EC407A"), loc=(s * 0.03, 0.05, 0), rot=(math.pi / 2, 0, 0)))
        sc.append(Part(coll, "blade", bm_box(0.018, 0.18, 0.006), STEEL, loc=(s * 0.012, -0.06, 0), rot=(0, 0, s * 0.12)))
    bake(sc, "Scissors", coll, parent=root)
    # raw milk jug
    bake([Part(coll, "jug", bm_cyl(0.08, 0.09, 0.24, 14), mat("JugGlass", "#FFFFFF", rough=0.15), loc=(0, 0, -0.12)),
          Part(coll, "milk", bm_cyl(0.075, 0.085, 0.16, 14), mat("Milk", "#FFFDF7", rough=0.6), loc=(0, 0, -0.16)),
          Part(coll, "cap", bm_cyl(0.035, 0.035, 0.04, 10), mat("JugCap", "#C62828"), loc=(0, 0, 0.02)),
          Part(coll, "label", bm_box(0.1, 0.01, 0.05), mat("JugLabel", "#C62828"), loc=(0, -0.088, -0.1))], "MilkJug", coll, parent=root)
    # Hillel's clipboard
    bake([Part(coll, "board", bm_box(0.24, 0.015, 0.32), mat("Clipboard", "#8D6E63"), loc=(0, 0, 0)),
          Part(coll, "paper", bm_box(0.2, 0.01, 0.26), mat("Paper", "#FFFFFF"), loc=(0, -0.01, -0.02)),
          Part(coll, "clip", bm_box(0.1, 0.02, 0.04), STEEL, loc=(0, -0.012, 0.15))], "Clipboard", coll, parent=root)
    # cool shades (Heshy)
    sh = mat("CoolShades", "#111111", rough=0.1, metal=0.5)
    bake([Part(coll, "l", bm_sphere(0.055, 0.018, 0.04), sh, loc=(-0.07, 0, 0)), Part(coll, "r", bm_sphere(0.055, 0.018, 0.04), sh, loc=(0.07, 0, 0)),
          Part(coll, "bridge", bm_box(0.05, 0.01, 0.012), sh, loc=(0, 0, 0.01)),
          Part(coll, "glint", bm_sphere(0.012), mat("Glint", "#FFFFFF", emit=2.0), loc=(-0.09, -0.016, 0.018))], "Shades", coll, parent=root)
    # a hat that blows away ("MY HAT! MY HAT!")
    hm = mat("LostHat", "#5D4037")
    bake([Part(coll, "brim", bm_cyl(0.26, 0.26, 0.02, 20), hm, loc=(0, 0, 0)), Part(coll, "crown", bm_cyl(0.15, 0.14, 0.14, 18), hm, loc=(0, 0, 0.08)),
          Part(coll, "band", bm_cyl(0.152, 0.152, 0.03, 18), mat("LostHatBand", "#212121"), loc=(0, 0, 0.03))], "Hat", coll, parent=root)
    # the sasquatch's parting gift
    bake([Part(coll, "fish", bm_sphere(0.1, 0.28, 0.08), mat("Fish", "#90A4AE", rough=0.3, metal=0.4), loc=(0, 0, 0)),
          Part(coll, "tail", bm_cyl(0.1, 0.0, 0.12, 3, "Y"), mat("Fish", "#90A4AE"), loc=(0, 0.32, 0)),
          Part(coll, "eye", bm_sphere(0.015), mat("Eye", "#111111"), loc=(0.07, -0.2, 0.03))], "Fish", coll, parent=root)
    # Uncle Burry's VEGAS moving boxes + dice
    BOX = mat("Cardboard", "#C89B6C", rough=0.95)
    bx = [Part(coll, "b1", bm_box(0.7, 0.6, 0.5), BOX, loc=(0, 0, 0.25), smooth=False),
          Part(coll, "b2", bm_box(0.55, 0.5, 0.42), mat("Cardboard2", "#B5875A", rough=0.95), loc=(0.05, 0, 0.71), rot=(0, 0, 0.12), smooth=False),
          Part(coll, "t1", txt("VEGAS", 0.15), mat("BoxInk", "#7B4B1E"), loc=(0, -0.31, 0.25), rot=(math.pi / 2, 0, 0), smooth=False),
          Part(coll, "t2", txt("VEGAS", 0.12), mat("BoxInk", "#7B4B1E"), loc=(0.05, -0.26, 0.72), rot=(math.pi / 2, 0, 0.12), smooth=False)]
    for i, (x, rz) in enumerate(((-0.08, 0.3), (0.14, -0.4))):
        bx.append(Part(coll, "die", bm_box(0.12, 0.12, 0.12), mat("Die", "#FFFFFF"), loc=(x, 0, 0.98), rot=(0, 0, rz)).bevel(0.02, 2))
        bx.append(Part(coll, "pip", bm_sphere(0.018), mat("Pip", "#212121"), loc=(x, 0, 1.045)))
    bake(bx, "Boxes", coll, parent=root)
    return coll


ASSETS = [
    ("cameos_avigail_car", build_avigail_car),
    ("cameos_porch", build_porch),
    ("cameos_hair_bouncy", lambda: build_car_hair("CameosHair_bouncy", hair_bouncy)),
    ("cameos_hair_avigail", lambda: build_car_hair("CameosHair_avigail", hair_avigail)),
    ("cameos_lulu_bouncy", lambda: build_lulu_style("CameosLuluBouncy", hair_bouncy)),
    ("cameos_lulu_avigail", lambda: build_lulu_style("CameosLuluAvigail", hair_avigail)),
    ("cameos_fabio", build_fabio),
    ("cameos_salon_props", build_salon_props),
    ("cameos_salon_front", build_salon_front),
    ("cameos_sasquatch", build_sasquatch),
    ("cameos_duck", build_duck),
    ("cameos_raccoon", build_raccoon),
    ("cameos_heshy_pool", build_heshy_pool),
    ("cameos_yedidya", build_yedidya),
    ("cameos_burry", build_burry),
    ("cameos_shuey", build_shuey),
    ("cameos_cat_angel", build_cat_angel),
    ("cameos_grandpa", build_grandpa),
    ("cameos_business", build_business),
    ("cameos_teen", build_teen),
    ("cameos_tourist", build_tourist),
    ("cameos_delivery", build_delivery),
    ("cameos_hipster", build_hipster),
    ("cameos_doctor", build_doctor),
    ("cameos_tammy", build_tammy),
    ("cameos_raphael", build_raphael),
    ("cameos_rabbi", build_rabbi),
    ("cameos_clown", build_clown),
    ("cameos_zaidy", build_zaidy),
    ("cameos_fayge", build_fayge),
    ("cameos_ambulance", build_ambulance),
    ("cameos_er_props", build_er_props),
    ("cameos_props", build_props),
]
