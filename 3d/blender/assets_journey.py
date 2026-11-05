"""
Journey assets (the Story Trip): the five stops' set pieces and finish gates,
the per-leg scenery (palms, cacti, mesas, beach houses, boutiques, adobes,
casinos, neon signs, street lamps), the story-event props and vehicles (Ima's
minivan, the ice-cream truck, Burry's moving truck, Avigail's coupe, boxes,
seagulls, the runaway beach gear) and two new people (Uncle Burry, Mindy).

Every model's FRONT faces Blender -Y (= +Z in three.js); metres; y-up export.
"""
from lib import *
from lib_people import build_person


def setup():
    global S
    S = shared()


# ── small helpers ────────────────────────────────────────────────────────
def P(coll, nm, bm, m, loc=(0, 0, 0), rot=(0, 0, 0), smooth=True):
    return Part(coll, nm, bm, m, loc=loc, rot=rot, smooth=smooth)


def txt(body, size, extrude=0.01):
    """Low-poly 3D text (lib.bm_text with a coarse curve resolution keeps the .glb small)."""
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
    return bm


def bm_poly_xz(pts, half_y):
    """Extrude an XZ polygon along Y (signs, boards that face -Y)."""
    bm = bmesh.new()
    a = [bm.verts.new((x, -half_y, z)) for (x, z) in pts]
    b = [bm.verts.new((x, half_y, z)) for (x, z) in pts]
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], b[i], b[j], a[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def balloon(coll, parts, x, y, z, m, r=0.5):
    parts.append(P(coll, "balloon", bm_sphere(r, r, r * 1.2, 14, 10), m, loc=(x, y, z)))
    parts.append(P(coll, "knot", bm_cyl(0.08, 0.02, 0.12, 8), m, loc=(x, y, z - r * 1.2)))


def stripe_cyl(coll, parts, x, y, z0, h, r, mats, bands=8, segs=14):
    """A vertical column made of alternating coloured bands (pool noodles, bulbs, posts)."""
    bh = h / bands
    for i in range(bands):
        parts.append(P(coll, "band", bm_cyl(r, r, bh * 1.001, segs), mats[i % len(mats)], loc=(x, y, z0 + bh * (i + 0.5))))


def gate_frame(coll, root, post_mats, beam_mat, span=9.6, h=7.6, post_r=0.24):
    """Two posts and a cross beam over the road; the JS adds the banner at Anchor_banner."""
    parts = []
    for s in (-1, 1):
        stripe_cyl(coll, parts, s * span, 0, 0, h, post_r, post_mats, bands=6)
        parts.append(P(coll, "foot", bm_cyl(post_r * 2.2, post_r * 2.6, 0.3, 14), beam_mat, loc=(s * span, 0, 0.15)))
        parts.append(P(coll, "cap", bm_sphere(post_r * 1.5), beam_mat, loc=(s * span, 0, h + 0.1)))
    parts.append(P(coll, "beam", bm_box(span * 2 + 0.6, 0.22, 0.22), beam_mat, loc=(0, 0.05, 7.85)).bevel(0.05, 2))
    anchor(coll, root, "Anchor_banner", (0, 0, 6.6))
    return parts


# ── per-leg scenery ──────────────────────────────────────────────────────
def build_palm():
    coll = scene_coll("JPalm")
    root = root_empty(coll, "JPalm")
    BARK = mat("PalmBark", "#9A7650", rough=0.95)
    RING = mat("PalmRing", "#7A5A3A", rough=0.95)
    LEAF = mat("PalmLeaves", "#3FA34D", rough=0.8)
    NUT = mat("Coconut", "#6D4C2F", rough=0.7)
    trunk = []
    x = y = 0.0
    z = 0.0
    n = 9
    for i in range(n):
        h = 0.82
        r = 0.26 - i * 0.012
        x += 0.07 + i * 0.012          # a lazy lean
        trunk.append(P(coll, "seg", bm_cyl(r * 1.08, r, h, 9), BARK if i % 2 else RING, loc=(x, y, z + h / 2), rot=(0, 0.08 + i * 0.012, 0), smooth=False))
        z += h * 0.97
    top = (x + 0.08, y, z + 0.05)
    bake(trunk, "Trunk", coll, parent=root)
    crown = []
    for k in range(9):
        a = k / 9 * math.pi * 2 + 0.2
        ca, sa = math.cos(a), math.sin(a)
        droop = 0.8 + (k % 3) * 0.25
        for j in range(5):
            u = (j + 0.5) / 5
            dist = 0.25 + u * 2.6
            dz = 0.55 * u * 2.6 - droop * (u * 2.6) ** 2 * 0.32
            slope = 0.55 - droop * u * 2.6 * 0.64
            w = 0.34 * (1 - u * 0.65)
            crown.append(P(coll, "frond", bm_sphere(0.36, w, 0.035, 8, 4), LEAF,
                           loc=(top[0] + ca * dist, top[1] + sa * dist, top[2] + dz), rot=(0, -math.atan(slope), a), smooth=False))
    for k in range(3):
        a = k * 2.1
        crown.append(P(coll, "nut", bm_sphere(0.16), NUT, loc=(top[0] + math.cos(a) * 0.25, top[1] + math.sin(a) * 0.25, top[2] - 0.25)))
    bake(crown, "Crown", coll, parent=root)
    return coll


def build_cactus():
    coll = scene_coll("JCactus")
    root = root_empty(coll, "JCactus")
    C = mat("Cactus", "#5E9E4A", rough=0.85)
    F = mat("CactusFlower", "#FF6FAE", rough=0.6)
    parts = [P(coll, "col", bm_cyl(0.34, 0.32, 3.6, 10), C, loc=(0, 0, 1.8), smooth=False),
             P(coll, "top", bm_sphere(0.32, 0.32, 0.3, 10, 6), C, loc=(0, 0, 3.6), smooth=False)]
    for s, hz, h in ((1, 1.3, 1.5), (-1, 1.9, 1.1)):
        parts.append(P(coll, "elbow", bm_cyl(0.2, 0.2, 0.75, 8, "X"), C, loc=(s * 0.55, 0, hz), smooth=False))
        parts.append(P(coll, "arm", bm_cyl(0.22, 0.2, h, 8), C, loc=(s * 0.9, 0, hz + h / 2 - 0.1), smooth=False))
        parts.append(P(coll, "armTop", bm_sphere(0.2, 0.2, 0.18, 8, 6), C, loc=(s * 0.9, 0, hz + h - 0.1), smooth=False))
    for k in range(3):
        a = k * 2.1
        parts.append(P(coll, "flower", bm_ico(0.08), F, loc=(math.cos(a) * 0.2, math.sin(a) * 0.2, 3.85), smooth=False))
    bake(parts, "Cactus_body", coll, parent=root)
    return coll


def build_shrub():
    coll = scene_coll("JShrub")
    root = root_empty(coll, "JShrub")
    B = mat("Brush", "#A3A86B", rough=0.95)
    R = mat("Rock", "#C08A5C", rough=0.95)
    parts = []
    for (x, y, z, r) in ((0, 0, 0.35, 0.5), (0.45, 0.2, 0.3, 0.38), (-0.4, -0.15, 0.28, 0.36), (0.1, -0.4, 0.25, 0.3)):
        parts.append(P(coll, "b", bm_ico(r, 1), B, loc=(x, y, z), smooth=False))
    parts.append(P(coll, "rock", bm_ico(0.45, 1), R, loc=(1.1, 0.4, 0.15), rot=(0.3, 0.2, 0.5), smooth=False))
    parts.append(P(coll, "rock2", bm_ico(0.3, 1), R, loc=(-0.9, 0.6, 0.1), rot=(0.1, 0.5, 0.2), smooth=False))
    bake(parts, "Shrub_body", coll, parent=root)
    return coll


def build_mesa():
    coll = scene_coll("JMesa")
    root = root_empty(coll, "JMesa")
    cols = [mat("Mesa1", "#B5573A", rough=1), mat("Mesa2", "#D98E5A", rough=1), mat("Mesa3", "#C1693C", rough=1), mat("MesaTop", "#E2A66E", rough=1)]
    parts = []
    # an irregular footprint; strata that step inward with ragged, eroded edges
    import random
    rnd = random.Random(7)
    n = 14
    base = []
    for k in range(n):
        a = k / n * math.pi * 2
        r = 26 + rnd.uniform(-6, 7)
        base.append((math.cos(a) * r * 1.25, math.sin(a) * r * 0.75))
    z = 0.0
    for i, (hh, shrink) in enumerate(((10, 1.0), (9, 0.84), (8, 0.7), (5, 0.62))):
        lo_pts = [(x * shrink * rnd.uniform(0.97, 1.03), y * shrink * rnd.uniform(0.97, 1.03)) for x, y in base]
        hi_pts = [(x * rnd.uniform(0.9, 0.98), y * rnd.uniform(0.9, 0.98)) for x, y in lo_pts]
        bm = bmesh.new()
        lo = [bm.verts.new((x, y, z)) for x, y in lo_pts]
        hi = [bm.verts.new((x, y, z + hh + rnd.uniform(-0.8, 0.8))) for x, y in hi_pts]
        bm.faces.new(list(reversed(lo)))
        bm.faces.new(hi)
        for k in range(n):
            j = (k + 1) % n
            bm.faces.new((lo[k], lo[j], hi[j], hi[k]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        parts.append(Part(coll, "stratum", bm, cols[i % 3] if i < 3 else cols[3], smooth=False))
        z += hh
    bake(parts, "Mesa_body", coll, parent=root)
    return coll


def boxy_house(coll, w, d, h, WALLS, ROOF, TRIM, WIN, DOOR):
    """A flat-roof box house (front -Y) — the base for boutiques, adobes and casinos."""
    hd = d / 2
    parts = [P(coll, "walls", bm_box(w, d, h), WALLS, loc=(0, 0, h / 2), smooth=False),
             P(coll, "parapet", bm_box(w + 0.3, d + 0.3, 0.45), ROOF, loc=(0, 0, h + 0.2), smooth=False)]
    fy = -hd - 0.04
    parts.append(P(coll, "door", bm_box(1.2, 0.12, 2.2), DOOR, loc=(0, fy, 1.1), smooth=False))
    parts.append(P(coll, "doorframe", bm_box(1.5, 0.08, 2.45), TRIM, loc=(0, fy + 0.03, 1.2), smooth=False))
    return parts


def build_beachhouse():
    coll = scene_coll("JBeachHouse")
    root = root_empty(coll, "JBeachHouse")
    WALLS = mat("Walls", "#80DEEA", rough=0.85)
    ROOF = mat("Roof", "#FFFFFF", rough=0.7)
    TRIM = mat("Trim", "#FFFFFF", rough=0.7)
    WOOD = mat("Piling", "#A1887F", rough=0.9)
    WIN = mat("Window", "#9AD9F5", rough=0.1, emit=0.25)
    w, d, h, lift = 8.0, 6.5, 3.0, 1.8
    hd = d / 2
    parts = []
    for x in (-w / 2 + 0.3, 0, w / 2 - 0.3):
        for y in (-hd + 0.3, hd - 0.3, -hd - 1.6):
            parts.append(P(coll, "pile", bm_cyl(0.16, 0.16, lift + 0.1, 8), WOOD, loc=(x, y, (lift + 0.1) / 2), smooth=False))
    parts.append(P(coll, "floor", bm_box(w + 0.2, d + 2.2, 0.25), WOOD, loc=(0, -1.0, lift), smooth=False))
    parts.append(P(coll, "body", bm_prism([(-hd, 0), (hd, 0), (hd, h), (0, h + 2.0), (-hd, h)], w / 2), WALLS, loc=(0, 0, lift), smooth=False))
    slope = math.atan2(2.0, hd)
    L = math.hypot(hd, 2.0) + 0.5
    for s in (-1, 1):
        mid = Vector((0, s * hd / 2, lift + h + 1.0)) + Vector((0, s * math.sin(slope), math.cos(slope))) * 0.1
        parts.append(P(coll, "roof", bm_box(w + 0.6, L, 0.18), ROOF, loc=mid, rot=(-s * slope, 0, 0), smooth=False))
    fy = -hd - 0.04
    parts.append(P(coll, "door", bm_box(1.1, 0.12, 2.0), mat("Door", "#FFFFFF", rough=0.6), loc=(0, fy, lift + 1.1), smooth=False))
    for x in (-w * 0.3, w * 0.3):
        parts.append(P(coll, "win", bm_box(1.3, 0.1, 1.1), WIN, loc=(x, fy, lift + 1.7), smooth=False))
        parts.append(P(coll, "shutL", bm_box(0.3, 0.08, 1.2), TRIM, loc=(x - 0.85, fy + 0.02, lift + 1.7), smooth=False))
        parts.append(P(coll, "shutR", bm_box(0.3, 0.08, 1.2), TRIM, loc=(x + 0.85, fy + 0.02, lift + 1.7), smooth=False))
    parts.append(P(coll, "porthole", bm_cyl(0.42, 0.42, 0.1, 16, "Y"), WIN, loc=(0, fy, lift + h + 0.8)))
    # deck railing + stairs to the sand
    for i in range(9):
        parts.append(P(coll, "baluster", bm_box(0.08, 0.08, 0.9), TRIM, loc=(-w / 2 + i * w / 8, -hd - 2.0, lift + 0.55), smooth=False))
    parts.append(P(coll, "rail", bm_box(w, 0.1, 0.1), TRIM, loc=(0, -hd - 2.0, lift + 1.0), smooth=False))
    for k in range(6):
        parts.append(P(coll, "step", bm_box(1.2, 0.35, 0.12), WOOD, loc=(w / 2 + 0.7, -hd - 1.9 + k * 0.32, 0.2 + k * 0.3), smooth=False))
    parts.append(P(coll, "lifering", bm_torus(0.32, 0.09, 16, 6), mat("LifeRing", "#FF5252", rough=0.6), loc=(-w * 0.3 + 1.4, fy - 0.05, lift + 0.9), rot=(math.pi / 2, 0, 0)))
    bake(parts, "BeachHouse_body", coll, parent=root)
    return coll


def build_boutique():
    coll = scene_coll("JBoutique")
    root = root_empty(coll, "JBoutique")
    WALLS = mat("Walls", "#F8BBD0", rough=0.85)
    ROOF = mat("Roof", "#AD1457", rough=0.7)
    TRIM = mat("Trim", "#FFFFFF", rough=0.7)
    SHOP = mat("ShopWindow", "#FFE0A3", rough=0.15, emit=1.2)
    WIN = mat("Window", "#FFE7B3", rough=0.1, emit=0.6)
    w, d, h = 7.5, 7.0, 6.4
    hd = d / 2
    parts = boxy_house(coll, w, d, h, WALLS, ROOF, TRIM, WIN, mat("BoutiqueDoor", "#4A148C", rough=0.5))
    fy = -hd - 0.05
    parts.append(P(coll, "shopwin", bm_box(4.2, 0.1, 2.0), SHOP, loc=(1.7, fy, 1.4), smooth=False))
    parts.append(P(coll, "shopframe", bm_box(4.5, 0.08, 2.3), TRIM, loc=(1.7, fy + 0.03, 1.4), smooth=False))
    # striped awning (Roof-tinted stripes alternate with white)
    for i in range(8):
        parts.append(P(coll, "awn", bm_box(0.6, 1.4, 0.06), ROOF if i % 2 == 0 else TRIM, loc=(-w / 2 + 0.47 + i * 0.94, fy - 0.6, 2.85), rot=(-0.35, 0, 0), smooth=False))
    for x in (-2.2, 0.0, 2.2):
        parts.append(P(coll, "upwin", bm_box(1.3, 0.1, 1.5), WIN, loc=(x, fy, 4.6), smooth=False))
        parts.append(P(coll, "sill", bm_box(1.5, 0.25, 0.1), TRIM, loc=(x, fy - 0.1, 3.8), smooth=False))
        parts.append(P(coll, "plant", bm_ico(0.25, 1), mat("Leaves", "#6CC24A", rough=0.85), loc=(x - 0.4, fy - 0.15, 3.98), smooth=False))
    parts.append(P(coll, "sign", bm_box(3.0, 0.12, 0.6), TRIM, loc=(0, fy - 0.02, 3.35), smooth=False))
    parts.append(P(coll, "signTxt", txt("BOUTIQUE", 0.38), ROOF, loc=(0, fy - 0.1, 3.35), rot=(math.pi / 2, 0, 0), smooth=False))
    bake(parts, "Boutique_body", coll, parent=root)
    return coll


def build_adobe():
    coll = scene_coll("JAdobe")
    root = root_empty(coll, "JAdobe")
    WALLS = mat("Walls", "#E8C39E", rough=0.95)
    ROOF = mat("Roof", "#C77B4A", rough=0.9)
    TRIM = mat("Trim", "#6D4C41", rough=0.8)
    WIN = mat("Window", "#9AD9F5", rough=0.1, emit=0.25)
    w, d, h = 8.0, 6.5, 3.2
    hd = d / 2
    parts = [P(coll, "walls", bm_box(w, d, h), WALLS, loc=(0, 0, h / 2)).bevel(0.3, 3),
             P(coll, "upper", bm_box(w * 0.5, d * 0.6, 2.2), WALLS, loc=(w * 0.2, d * 0.1, h + 1.1)).bevel(0.25, 3),
             P(coll, "parapet", bm_box(w * 0.52, d * 0.62, 0.25), ROOF, loc=(w * 0.2, d * 0.1, h + 2.25), smooth=False)]
    fy = -hd - 0.04
    parts.append(P(coll, "door", bm_box(1.1, 0.12, 2.1), mat("AdobeDoor", "#1E88E5", rough=0.6), loc=(-1.2, fy, 1.05), smooth=False))
    for x in (1.6,):
        parts.append(P(coll, "win", bm_box(1.2, 0.1, 1.0), WIN, loc=(x, fy, 1.7), smooth=False))
    for i in range(6):     # vigas (roof beams) poking out
        parts.append(P(coll, "viga", bm_cyl(0.11, 0.11, 0.8, 8, "Y"), TRIM, loc=(-w / 2 + 0.7 + i * (w - 1.4) / 5, fy - 0.2, h - 0.35)))
    parts.append(P(coll, "pot", bm_cyl(0.35, 0.25, 0.6, 12), ROOF, loc=(-2.6, fy - 0.6, 0.3)))
    parts.append(P(coll, "potCactus", bm_cyl(0.15, 0.14, 0.8, 8), mat("Cactus", "#5E9E4A", rough=0.85), loc=(-2.6, fy - 0.6, 0.9), smooth=False))
    parts.append(P(coll, "chili", bm_cyl(0.06, 0.02, 0.9, 6), mat("Chili", "#D32F2F", rough=0.6), loc=(0.2, fy - 0.08, 2.4)))
    bake(parts, "Adobe_body", coll, parent=root)
    return coll


def build_casino():
    coll = scene_coll("JCasino")
    root = root_empty(coll, "JCasino")
    WALLS = mat("Walls", "#5E35B1", rough=0.6)
    ROOF = mat("Roof", "#FFD54F", rough=0.4, metal=0.3)
    TRIM = mat("Trim", "#FFFFFF", rough=0.6)
    PINK = mat("NeonPink", "#FF4FD8", rough=0.3, emit=4.0)
    CYAN = mat("NeonCyan", "#3FF2FF", rough=0.3, emit=4.0)
    GOLD = mat("NeonGold", "#FFD54F", rough=0.3, emit=3.0)
    WIN = mat("Window", "#FFE7B3", rough=0.1, emit=0.9)
    w, d, h = 10.0, 8.0, 11.0
    hd = d / 2
    fy = -hd - 0.05
    parts = [P(coll, "tower", bm_box(w, d, h), WALLS, loc=(0, 0, h / 2), smooth=False),
             P(coll, "crown", bm_box(w + 0.6, d + 0.6, 0.7), ROOF, loc=(0, 0, h + 0.3), smooth=False),
             P(coll, "spire", bm_cyl(0.5, 0.05, 4.0, 8), ROOF, loc=(0, 0, h + 2.6))]
    for row in range(3):
        for col in range(4):
            parts.append(P(coll, "win", bm_box(1.3, 0.1, 1.3), WIN, loc=(-3.6 + col * 2.4, fy, 4.6 + row * 2.2), smooth=False))
    for z, m in ((3.4, PINK), (h - 0.4, CYAN)):
        parts.append(P(coll, "neonBand", bm_box(w + 0.15, 0.16, 0.16), m, loc=(0, fy - 0.03, z), smooth=False))
    for s in (-1, 1):
        parts.append(P(coll, "neonEdge", bm_box(0.16, 0.16, h), GOLD, loc=(s * (w / 2 + 0.03), fy - 0.03, h / 2), smooth=False))
    # marquee canopy with chaser bulbs
    parts.append(P(coll, "marquee", bm_box(6.0, 2.2, 0.5), ROOF, loc=(0, fy - 1.0, 2.9), smooth=False))
    for i in range(13):
        parts.append(P(coll, "bulb", bm_sphere(0.1, 0.1, 0.1, 8, 6), GOLD if i % 2 else PINK, loc=(-2.9 + i * 0.48, fy - 2.12, 2.9)))
    parts.append(P(coll, "doors", bm_box(3.0, 0.12, 2.4), mat("CasinoDoor", "#B71C1C", rough=0.4), loc=(0, fy, 1.2), smooth=False))
    bake(parts, "Casino_body", coll, parent=root)
    return coll


def build_neon_sign():
    coll = scene_coll("JNeonSign")
    root = root_empty(coll, "JNeonSign")
    POLE = mat("SignPole", "#37474F", rough=0.5, metal=0.6)
    BACK = mat("SignBack", "#1A0F2E", rough=0.6)
    PINK = mat("NeonPink", "#FF4FD8", rough=0.3, emit=4.0)
    CYAN = mat("NeonCyan", "#3FF2FF", rough=0.3, emit=4.0)
    parts = [P(coll, "pole", bm_cyl(0.2, 0.22, 5.4, 10), POLE, loc=(0, 0.4, 2.7)),
             P(coll, "board", bm_box(6.4, 0.3, 3.2), BACK, loc=(0, 0.25, 6.6), smooth=False)]
    for z in (5.05, 8.15):
        parts.append(P(coll, "tubeH", bm_cyl(0.07, 0.07, 6.3, 6, "X"), PINK, loc=(0, 0.06, z)))
    for x in (-3.15, 3.15):
        parts.append(P(coll, "tubeV", bm_cyl(0.07, 0.07, 3.1, 6), CYAN, loc=(x, 0.06, 6.6)))
    parts.append(P(coll, "arrow", bm_prism([(-0.5, 0), (0.5, 0), (0, 0.8)], 0.06), CYAN, loc=(0, 0.1, 8.5)))
    bake(parts, "NeonSign_body", coll, parent=root)
    anchor(coll, root, "Anchor_face", (0, 0.08, 6.6))
    return coll


def build_streetlamp():
    coll = scene_coll("JStreetLamp")
    root = root_empty(coll, "JStreetLamp")
    POLE = mat("LampPole", "#2E3440", rough=0.5, metal=0.6)
    GLOW = mat("NeonLamp", "#FFE3A3", rough=0.2, emit=3.5)
    parts = [P(coll, "pole", bm_cyl(0.09, 0.13, 6.0, 8), POLE, loc=(0, 0, 3.0)),
             P(coll, "arm", bm_cyl(0.05, 0.05, 1.6, 6, "Y"), POLE, loc=(0, -0.8, 5.95)),
             P(coll, "head", bm_box(0.5, 0.7, 0.18), POLE, loc=(0, -1.6, 5.9)).bevel(0.05, 2),
             P(coll, "glow", bm_box(0.42, 0.6, 0.06), GLOW, loc=(0, -1.6, 5.8))]
    bake(parts, "Lamp_body", coll, parent=root)
    return coll


# ── finish gates (one per stop) ──────────────────────────────────────────
def build_gate(kind):
    coll = scene_coll("JGate_" + kind)
    root = root_empty(coll, "JGate_" + kind)
    W = mat("GateWhite", "#FFFFFF", rough=0.6)
    parts = []
    if kind == "bubbe":
        pinkm, yel = mat("GatePink", "#E91E63", rough=0.5), mat("GateYellow", "#FFC107", rough=0.5)
        parts += gate_frame(coll, root, [pinkm, yel], W)
        bcols = [mat("Balloon%d" % i, c, rough=0.3) for i, c in enumerate(("#FF4081", "#FFD740", "#40C4FF", "#B388FF", "#69F0AE"))]
        for s in (-1, 1):
            for k in range(7):
                a = k * 0.9
                balloon(coll, parts, s * 9.6 + math.cos(a) * 0.95, math.sin(a) * 0.7, 8.4 + (k % 3) * 0.45 + (k // 3) * 0.3, bcols[k % 5], 0.48)
        for i in range(15):       # bunting across the beam
            x = -8.4 + i * 1.2
            parts.append(P(coll, "flag", bm_cyl(0.32, 0.0, 0.6, 3), bcols[i % 5], loc=(x, -0.15, 7.45), rot=(math.pi, 0, 0), smooth=False))
    elif kind == "heshy":
        blue, yel, pink = mat("NoodleBlue", "#29B6F6", rough=0.6), mat("NoodleYellow", "#FFEB3B", rough=0.6), mat("NoodlePink", "#FF80AB", rough=0.6)
        parts += gate_frame(coll, root, [blue, yel, pink], W, post_r=0.3)
        ring_r, ring_w = mat("TubeOrange", "#FF7043", rough=0.5), W
        for s in (-1, 1):
            for k in range(3):     # inner tubes stacked at the post feet
                parts.append(P(coll, "tube", bm_torus(0.75, 0.26, 18, 8), ring_r if k % 2 == 0 else ring_w, loc=(s * 9.6, 0, 0.28 + k * 0.5)))
        # a big inflatable flamingo on top of the beam
        F = mat("Flamingo", "#FF6FAE", rough=0.5)
        parts.append(P(coll, "flBody", bm_sphere(1.2, 0.7, 0.6), F, loc=(0, 0, 8.65)))
        parts.append(P(coll, "flNeck", bm_cyl(0.22, 0.2, 1.7, 10), F, loc=(0.6, 0, 9.5), rot=(0, 0.35, 0)))
        parts.append(P(coll, "flHead", bm_sphere(0.38, 0.34, 0.34), F, loc=(0.95, 0, 10.35)))
        parts.append(P(coll, "flBeak", bm_cyl(0.14, 0.05, 0.5, 8, "X"), mat("Beak", "#212121", rough=0.5), loc=(1.42, 0, 10.25), rot=(0, 0.4, 0)))
        for s in (-1, 1):
            parts.append(P(coll, "flEye", bm_sphere(0.07), mat("Eye", "#1B1B1B", rough=0.3), loc=(1.1, s * 0.27, 10.45)))
        parts.append(P(coll, "flTail", bm_cyl(0.5, 0.05, 0.7, 8, "X"), F, loc=(-1.3, 0, 8.9), rot=(0, -0.6, 0)))
        parts.append(P(coll, "buoy", bm_torus(0.9, 0.22, 20, 8), ring_r, loc=(-5.2, -0.15, 7.85), rot=(math.pi / 2, 0, 0)))
        parts.append(P(coll, "buoy2", bm_torus(0.9, 0.22, 20, 8), ring_r, loc=(5.2, -0.15, 7.85), rot=(math.pi / 2, 0, 0)))
    elif kind == "beach":
        sand = mat("GateSand", "#F6D58E", rough=0.9)
        parts += gate_frame(coll, root, [sand], sand, post_r=0.18)
        boards = [mat("Surf1", "#FF7043", rough=0.4), mat("Surf2", "#26C6DA", rough=0.4), mat("Surf3", "#FFEB3B", rough=0.4), mat("Surf4", "#AB47BC", rough=0.4)]
        stripe = mat("SurfStripe", "#FFFFFF", rough=0.4)
        for s in (-1, 1):
            for k, off in enumerate((-0.55, 0.55)):
                bm = boards[(k + (s > 0) * 2) % 4]
                parts.append(P(coll, "board", bm_sphere(0.42, 0.09, 3.4, 16, 10), bm, loc=(s * 9.6 + off, 0.25, 3.4), rot=(0, off * 0.12, 0)))
                parts.append(P(coll, "stripe", bm_box(0.08, 0.2, 6.0), stripe, loc=(s * 9.6 + off, 0.2, 3.4), smooth=False))
        STAR = mat("Starfish", "#FF8A65", rough=0.7)
        for x in (-8.0, 8.0):
            for k in range(5):
                a = k / 5 * math.pi * 2
                parts.append(P(coll, "arm", bm_sphere(0.32, 0.1, 0.08), STAR, loc=(x + math.cos(a) * 0.3, -0.25, 6.6 + math.sin(a) * 0.3), rot=(math.pi / 2, a, 0)))
        parts.append(P(coll, "flagPole", bm_cyl(0.05, 0.05, 2.2, 6), W, loc=(0, 0, 9.0)))
        parts.append(P(coll, "flag", bm_box(1.1, 0.04, 0.7), mat("LifeguardRed", "#E53935", rough=0.6), loc=(0.6, 0, 9.7), smooth=False))
    elif kind == "avigail":
        pur, gold = mat("GatePurple", "#7E57C2", rough=0.4), mat("GateGold", "#FFD54F", rough=0.25, metal=0.8)
        parts += gate_frame(coll, root, [pur, mat("GateLilac", "#CE93D8", rough=0.4)], gold)
        H = mat("Heart", "#EC407A", rough=0.35)
        for s in (-1, 1):
            parts.append(P(coll, "heartLobe", bm_sphere(0.95, 0.35, 0.95), H, loc=(s * 0.62, 0, 9.35)))
        parts.append(P(coll, "heartTip", bm_cyl(1.25, 0.0, 1.7, 4), H, loc=(0, 0, 8.45), rot=(math.pi, 0, math.pi / 4), smooth=False))
        for k in range(14):
            x = -9 + k * 1.38
            parts.append(P(coll, "sparkle", bm_ico(0.16, 0), gold, loc=(x, -0.2, 7.55 - (k % 2) * 0.25), smooth=False))
        ROSE, LEAF = mat("Rose", "#D81B60", rough=0.6), mat("Leaves", "#6CC24A", rough=0.85)
        for s in (-1, 1):
            parts.append(P(coll, "pot", bm_cyl(0.6, 0.45, 0.8, 14), gold, loc=(s * 10.8, 0, 0.4)))
            parts.append(P(coll, "bush", bm_ico(0.7, 1), LEAF, loc=(s * 10.8, 0, 1.3), smooth=False))
            for k in range(5):
                a = k * 1.3
                parts.append(P(coll, "rose", bm_ico(0.16, 1), ROSE, loc=(s * 10.8 + math.cos(a) * 0.5, math.sin(a) * 0.5, 1.6 + (k % 2) * 0.2), smooth=False))
    else:  # vegas
        red, gold = mat("GateRed", "#C62828", rough=0.4), mat("GateGold", "#FFD54F", rough=0.25, metal=0.8)
        bulbA, bulbB = mat("NeonBulb", "#FFF59D", rough=0.3, emit=4.0), mat("NeonPink", "#FF4FD8", rough=0.3, emit=4.0)
        parts += gate_frame(coll, root, [red, gold], gold, post_r=0.3)
        for s in (-1, 1):
            for k in range(14):
                parts.append(P(coll, "bulb", bm_sphere(0.1, 0.1, 0.1, 8, 6), bulbA if k % 2 else bulbB, loc=(s * 9.6, -0.32, 0.4 + k * 0.52)))
        D = mat("Dice", "#FFFFFF", rough=0.3)
        PIP = mat("Pip", "#C62828", rough=0.4)
        for s, rz in ((-1, 0.4), (1, -0.3)):
            cx, cz = s * 1.5, 8.75
            parts.append(P(coll, "die", bm_box(1.5, 1.5, 1.5), D, loc=(cx, 0, cz), rot=(0, 0, rz)).bevel(0.22, 3))
            for (px, pz) in ((-0.35, 0.35), (0, 0), (0.35, -0.35)):
                parts.append(P(coll, "pip", bm_sphere(0.13, 0.05, 0.13), PIP, loc=(cx + px * math.cos(rz), -0.76, cz + pz)))
        STAR = mat("NeonGold", "#FFD54F", rough=0.3, emit=3.0)
        for k in range(8):
            a = k / 8 * math.pi * 2
            parts.append(P(coll, "ray", bm_cyl(0.18, 0.0, 1.2, 4), STAR, loc=(math.cos(a) * 0.6, 0, 10.6 + math.sin(a) * 0.6), rot=(0, math.pi / 2 - a, 0), smooth=False))
        parts.append(P(coll, "starC", bm_sphere(0.35), STAR, loc=(0, 0, 10.6)))
    bake(parts, "Gate_body", coll, parent=root)
    return coll


# ── the stops ────────────────────────────────────────────────────────────
def build_cholent():
    """Bubbe's porch table: the heirloom POT (the one Zaidy schlepped), challah, candlesticks."""
    coll = scene_coll("JCholent")
    root = root_empty(coll, "JCholent")
    WOOD = mat("TableWood", "#8D6E63", rough=0.8)
    CLOTH = mat("Tablecloth", "#FFFFFF", rough=0.9)
    POT = mat("Heirloom", "#B87333", rough=0.3, metal=0.75)
    DARK = mat("PotDark", "#4E342E", rough=0.5)
    CHALLAH = mat("Challah", "#D9963F", rough=0.7)
    SILVER = mat("Silver", "#D7DCE0", rough=0.2, metal=0.9)
    FLAME = mat("NeonFlame", "#FFD180", rough=0.3, emit=4.0)
    parts = [P(coll, "top", bm_box(1.6, 0.9, 0.08), WOOD, loc=(0, 0, 0.78)).bevel(0.02, 2),
             P(coll, "cloth", bm_box(1.66, 0.96, 0.03), CLOTH, loc=(0, 0, 0.83))]
    for x in (-0.7, 0.7):
        for y in (-0.35, 0.35):
            parts.append(P(coll, "leg", bm_box(0.08, 0.08, 0.76), WOOD, loc=(x, y, 0.38), smooth=False))
    parts.append(P(coll, "pot", bm_cyl(0.26, 0.24, 0.32, 20), POT, loc=(-0.3, 0, 1.0)))
    parts.append(P(coll, "rim", bm_torus(0.26, 0.025, 20, 6), POT, loc=(-0.3, 0, 1.16)))
    parts.append(P(coll, "lid", bm_sphere(0.25, 0.25, 0.08, 18, 6), POT, loc=(-0.3, 0, 1.17)))
    parts.append(P(coll, "knob", bm_sphere(0.05), DARK, loc=(-0.3, 0, 1.26)))
    for s in (-1, 1):
        parts.append(P(coll, "handle", bm_torus(0.07, 0.018, 10, 5), DARK, loc=(-0.3 + s * 0.29, 0, 1.08), rot=(math.pi / 2, 0, 0)))
    for k in range(3):
        parts.append(P(coll, "braid", bm_sphere(0.1, 0.075, 0.07), CHALLAH, loc=(0.25 + k * 0.13, 0.05, 0.9)))
    for x in (0.55, 0.7):
        parts.append(P(coll, "stick", bm_cyl(0.035, 0.05, 0.3, 10), SILVER, loc=(x, -0.25, 0.99)))
        parts.append(P(coll, "candle", bm_cyl(0.022, 0.022, 0.16, 8), CLOTH, loc=(x, -0.25, 1.22)))
        parts.append(P(coll, "flame", bm_sphere(0.022, 0.022, 0.04, 8, 6), FLAME, loc=(x, -0.25, 1.33)))
    bake(parts, "Cholent_body", coll, parent=root)
    anchor(coll, root, "Anchor_steam", (-0.3, 0, 1.3))
    return coll


def build_pool_set():
    """Heshy's backyard pool: deck, pool, diving board, cabana, loungers, umbrella, floaties."""
    coll = scene_coll("JPool")
    root = root_empty(coll, "JPool")
    DECK = mat("PoolDeck", "#E1BEE7", rough=0.8)
    TILE = mat("PoolTile", "#0288D1", rough=0.4)
    COP = mat("Coping", "#FAFAFA", rough=0.6)
    WATER = mat("WaterPool", "#4FC3F7", rough=0.05)
    WOOD = mat("CabanaWood", "#FFF3E0", rough=0.7)
    STRIPE = mat("CabanaStripe", "#29B6F6", rough=0.6)
    CHROME = S.CHROME
    RED = mat("UmbrellaRed", "#EF5350", rough=0.6)
    WHITE = mat("White", "#FAFAFA", rough=0.6)
    HEDGE = mat("Hedge", "#4CAF50", rough=0.9)
    PW, PL = 11.0, 6.0        # pool size (x along the road, y away from it)
    py = 1.0                  # pool centre (y)
    parts = [P(coll, "deck", bm_box(24.0, 18.0, 0.2), DECK, loc=(0, 1.0, 0.1), smooth=False)]
    # pool: walls + coping + water (sunk into the deck visually)
    parts.append(P(coll, "poolFloor", bm_box(PW, PL, 0.05), TILE, loc=(0, py, 0.02), smooth=False))
    for s in (-1, 1):
        parts.append(P(coll, "copX", bm_box(PW + 0.8, 0.4, 0.12), COP, loc=(0, py + s * (PL / 2 + 0.2), 0.26), smooth=False))
        parts.append(P(coll, "copY", bm_box(0.4, PL + 0.8, 0.12), COP, loc=(s * (PW / 2 + 0.2), py, 0.26), smooth=False))
    parts.append(P(coll, "tileband", bm_box(PW, PL, 0.18), TILE, loc=(0, py, 0.12), smooth=False))
    # diving board on the far side (+Y side, away from the road)
    parts.append(P(coll, "boardBase", bm_box(0.8, 0.9, 0.6), COP, loc=(-3.0, py + PL / 2 + 1.0, 0.5), smooth=False))
    parts.append(P(coll, "board", bm_box(0.6, 3.2, 0.1), WHITE, loc=(-3.0, py + PL / 2 - 0.5, 0.82)).bevel(0.03, 2))
    # ladder
    for s in (-1, 1):
        parts.append(limb(coll, "rail", (3.5 + s * 0.3, py - PL / 2 - 0.3, 0.2), (3.5 + s * 0.3, py - PL / 2 - 0.3, 1.2), 0.04, CHROME))
        parts.append(limb(coll, "railTop", (3.5 + s * 0.3, py - PL / 2 - 0.3, 1.2), (3.5 + s * 0.3, py - PL / 2 + 0.2, 0.9), 0.04, CHROME))
    # cabana / pool house (back right)
    cx, cy = 8.0, 7.0
    parts.append(P(coll, "cabana", bm_box(4.5, 3.2, 2.6), WOOD, loc=(cx, cy, 1.5), smooth=False))
    for i in range(6):
        parts.append(P(coll, "awn", bm_box(0.75, 1.3, 0.06), STRIPE if i % 2 == 0 else WHITE, loc=(cx - 1.9 + i * 0.75, cy - 2.1, 2.7), rot=(-0.4, 0, 0), smooth=False))
    parts.append(P(coll, "cabRoof", bm_box(4.9, 3.6, 0.2), STRIPE, loc=(cx, cy, 2.9), smooth=False))
    parts.append(P(coll, "cabDoor", bm_box(1.0, 0.1, 2.0), STRIPE, loc=(cx - 1.0, cy - 1.62, 1.2), smooth=False))
    parts.append(P(coll, "towelRack", bm_box(1.4, 0.1, 0.1), CHROME, loc=(cx + 1.2, cy - 1.7, 1.2), smooth=False))
    for k, c in enumerate(("#FF80AB", "#FFEB3B")):
        parts.append(P(coll, "towel", bm_box(0.6, 0.04, 0.9), mat("Towel%d" % k, c, rough=0.9), loc=(cx + 0.9 + k * 0.65, cy - 1.74, 0.8), smooth=False))
    # loungers + umbrella (front left, near the road side)
    for k in range(2):
        x = -8.5 + k * 2.2
        parts.append(P(coll, "lounger", bm_box(0.9, 2.0, 0.12), WHITE, loc=(x, -3.0, 0.5), smooth=False))
        parts.append(P(coll, "back", bm_box(0.9, 0.8, 0.1), STRIPE, loc=(x, -3.85, 0.85), rot=(0.9, 0, 0), smooth=False))
        for y in (-3.8, -2.2):
            parts.append(P(coll, "lleg", bm_box(0.8, 0.06, 0.4), CHROME, loc=(x, y, 0.32), smooth=False))
    parts.append(P(coll, "umbPole", bm_cyl(0.05, 0.05, 2.6, 8), WHITE, loc=(-7.4, -1.2, 1.4)))
    for k in range(8):
        a = k / 8 * math.pi * 2
        parts.append(P(coll, "umbPanel", bm_cyl(1.6, 0.0, 0.6, 3), RED if k % 2 == 0 else WHITE, loc=(-7.4, -1.2, 2.7), rot=(0, 0, a), smooth=False))
    # hedges around three sides
    for x in range(-11, 12, 2):
        parts.append(P(coll, "hedge", bm_ico(1.0, 1), HEDGE, loc=(x, 9.6, 0.8), smooth=False))
    for y in range(-6, 10, 2):
        for s in (-1, 1):
            parts.append(P(coll, "hedgeS", bm_ico(0.9, 1), HEDGE, loc=(s * 11.7, y, 0.7), smooth=False))
    # a gate sign post
    parts.append(P(coll, "signPost", bm_box(0.12, 0.12, 1.8), WOOD, loc=(-4.5, -7.6, 0.9), smooth=False))
    parts.append(P(coll, "signBoard", bm_box(2.4, 0.08, 0.8), STRIPE, loc=(-4.5, -7.7, 1.8), smooth=False))
    parts.append(P(coll, "signTxt", txt("HESHY'S POOL", 0.3), WHITE, loc=(-4.5, -7.76, 1.8), rot=(math.pi / 2, 0, 0), smooth=False))
    bake(parts, "Pool_body", coll, parent=root)
    # the water is its own object so the game can animate it
    bake([P(coll, "water", bm_box(PW, PL, 0.04), WATER, loc=(0, py, 0.22), smooth=False)], "PoolWater", coll, parent=root)
    # floating inner tube + inflatable flamingo (bob in the water)
    tp = (2.0, py - 0.8, 0.3)
    bake_at([P(coll, "tube", bm_torus(0.6, 0.22, 18, 8), mat("TubeOrange", "#FF7043", rough=0.5), loc=tp),
             P(coll, "tubeW1", bm_box(0.2, 0.5, 0.46), WHITE, loc=(tp[0] + 0.6, tp[1], tp[2]), smooth=False),
             P(coll, "tubeW2", bm_box(0.2, 0.5, 0.46), WHITE, loc=(tp[0] - 0.6, tp[1], tp[2]), smooth=False)],
            "Tube", coll, root, tp)
    fp = (-1.5, py + 1.2, 0.35)
    F = mat("Flamingo", "#FF6FAE", rough=0.5)
    bake_at([P(coll, "fb", bm_sphere(0.9, 0.5, 0.35), F, loc=fp),
             P(coll, "fn", bm_cyl(0.13, 0.12, 1.1, 8), F, loc=(fp[0] + 0.5, fp[1], fp[2] + 0.6), rot=(0, 0.3, 0)),
             P(coll, "fh", bm_sphere(0.24), F, loc=(fp[0] + 0.72, fp[1], fp[2] + 1.15)),
             P(coll, "fk", bm_cyl(0.08, 0.03, 0.3, 6, "X"), mat("Beak", "#212121", rough=0.5), loc=(fp[0] + 1.0, fp[1], fp[2] + 1.1))],
            "Flamingo", coll, root, fp)
    anchor(coll, root, "Anchor_board", (-3.0, py + PL / 2 - 1.9, 0.9))
    anchor(coll, root, "Anchor_splash", (-3.0, py - 0.9, 0.3))
    return coll


def build_beach_set():
    """The beach stop: sand, boardwalk, lifeguard tower, umbrellas + towels, a sandcastle, the gull's post."""
    coll = scene_coll("JBeach")
    root = root_empty(coll, "JBeach")
    SAND = mat("SandPatch", "#F3D9A0", rough=1.0)
    WOOD = mat("Boardwalk", "#B08A64", rough=0.9)
    TOWER = mat("TowerWhite", "#FAFAFA", rough=0.6)
    RED = mat("LifeguardRed", "#E53935", rough=0.6)
    CASTLE = mat("Castle", "#E8C27E", rough=1.0)
    parts = [P(coll, "sand", bm_cyl(15.0, 16.0, 0.12, 28), SAND, loc=(0, 4.0, 0.03), smooth=False)]
    for k in range(9):        # boardwalk out from the road
        parts.append(P(coll, "plank", bm_box(3.0, 0.5, 0.1), WOOD, loc=(-6.0, -6.0 + k * 0.55, 0.18), smooth=False))
    # lifeguard tower
    tx, ty = 5.0, 6.0
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(limb(coll, "leg", (tx + sx * 0.9, ty + sy * 0.9, 0.0), (tx + sx * 0.6, ty + sy * 0.6, 2.4), 0.08, TOWER))
    parts.append(P(coll, "deck", bm_box(2.4, 2.4, 0.15), TOWER, loc=(tx, ty, 2.45), smooth=False))
    parts.append(P(coll, "cabin", bm_box(1.8, 1.8, 1.4), TOWER, loc=(tx, ty + 0.2, 3.25), smooth=False))
    parts.append(P(coll, "roof", bm_prism([(-1.2, 0), (1.2, 0), (0, 0.6)], 1.2), RED, loc=(tx, ty + 0.2, 3.95), smooth=False))
    parts.append(P(coll, "crossH", bm_box(0.7, 0.05, 0.2), RED, loc=(tx, ty - 0.72, 3.3), smooth=False))
    parts.append(P(coll, "crossV", bm_box(0.2, 0.05, 0.7), RED, loc=(tx, ty - 0.72, 3.3), smooth=False))
    for k in range(7):
        parts.append(P(coll, "ramp", bm_box(0.8, 0.4, 0.08), WOOD, loc=(tx - 1.6 - k * 0.0, ty - 1.4 - k * 0.38, 2.3 - k * 0.33), smooth=False))
    # umbrellas + towels
    for (ux, uy, c1) in ((-3.0, 2.0, "#EF5350"), (0.5, 8.5, "#42A5F5"), (-8.0, 9.0, "#FFCA28")):
        cm = mat("Umb_" + c1, c1, rough=0.6)
        parts.append(P(coll, "pole", bm_cyl(0.05, 0.05, 2.5, 8), TOWER, loc=(ux, uy, 1.3)))
        for k in range(8):
            a = k / 8 * math.pi * 2
            parts.append(P(coll, "panel", bm_cyl(1.5, 0.0, 0.55, 3), cm if k % 2 == 0 else TOWER, loc=(ux, uy, 2.55), rot=(0, 0, a), smooth=False))
        parts.append(P(coll, "towel", bm_box(1.0, 2.0, 0.03), mat("Towel_" + c1, c1, rough=0.9), loc=(ux + 0.8, uy + 0.3, 0.11), rot=(0, 0, 0.3), smooth=False))
    # sandcastle
    cx, cy = -2.0, 6.5
    parts.append(P(coll, "keep", bm_box(1.2, 1.2, 0.7), CASTLE, loc=(cx, cy, 0.4), smooth=False))
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(P(coll, "tower", bm_cyl(0.28, 0.32, 1.0, 10), CASTLE, loc=(cx + sx * 0.7, cy + sy * 0.7, 0.55), smooth=False))
            parts.append(P(coll, "cone", bm_cyl(0.32, 0.0, 0.4, 10), CASTLE, loc=(cx + sx * 0.7, cy + sy * 0.7, 1.25), smooth=False))
    parts.append(P(coll, "flag", bm_box(0.3, 0.02, 0.18), RED, loc=(cx + 0.85, cy - 0.7, 1.65), smooth=False))
    parts.append(P(coll, "bucket", bm_cyl(0.18, 0.22, 0.3, 12), mat("Bucket", "#26C6DA", rough=0.5), loc=(cx + 1.4, cy - 0.6, 0.25)))
    parts.append(limb(coll, "spade", (cx - 1.2, cy - 0.5, 0.1), (cx - 1.0, cy - 0.3, 0.8), 0.03, RED))
    # the gull's post + a BEACH sign
    parts.append(P(coll, "post", bm_cyl(0.16, 0.18, 2.0, 10), WOOD, loc=(-6.0, -1.0, 1.0)))
    parts.append(P(coll, "signPost", bm_box(0.12, 0.12, 2.0), WOOD, loc=(-9.0, -5.8, 1.0), smooth=False))
    parts.append(P(coll, "signBoard", bm_box(2.6, 0.08, 0.9), mat("SignBlue", "#0288D1", rough=0.6), loc=(-9.0, -5.9, 2.1), smooth=False))
    parts.append(P(coll, "signTxt", txt("THE BEACH", 0.36), TOWER, loc=(-9.0, -5.96, 2.1), rot=(math.pi / 2, 0, 0), smooth=False))
    bake(parts, "Beach_body", coll, parent=root)
    anchor(coll, root, "Anchor_gull", (-6.0, -1.0, 2.05))
    anchor(coll, root, "Anchor_dina", (-2.0, 4.6, 0.1))
    anchor(coll, root, "Anchor_lifeguard", (tx, ty - 0.8, 2.55))
    return coll


def build_avigail_house():
    """Avigail's chic townhouse: pink walls, magenta band, a fancy purple door, string lights, a heart."""
    coll = scene_coll("JAvigailHouse")
    root = root_empty(coll, "JAvigailHouse")
    WALL = mat("AviWalls", "#F8BBD0", rough=0.85)
    BAND = mat("AviBand", "#AD1457", rough=0.6)
    DOOR = mat("AviDoor", "#4A148C", rough=0.4)
    GOLD = mat("Gold", "#FFD700", rough=0.2, metal=0.9)
    WIN = mat("AviWindow", "#B39DDB", rough=0.1, emit=0.6)
    TRIM = mat("Trim", "#FFFFFF", rough=0.7)
    BULB = mat("NeonBulb", "#FFF59D", rough=0.3, emit=3.0)
    HEART = mat("NeonHeart", "#FF4F9A", rough=0.3, emit=2.5)
    LEAF = mat("Leaves", "#6CC24A", rough=0.85)
    w, d, h = 11.0, 8.0, 7.2
    hd = d / 2
    fy = -hd - 0.04
    parts = [P(coll, "walls", bm_box(w, d, h), WALL, loc=(0, 0, h / 2), smooth=False),
             P(coll, "band", bm_box(w + 0.2, d + 0.2, 0.7), BAND, loc=(0, 0, h - 0.35), smooth=False),
             P(coll, "cornice", bm_box(w + 0.6, d + 0.6, 0.25), TRIM, loc=(0, 0, h + 0.1), smooth=False),
             P(coll, "base", bm_box(w + 0.2, d + 0.2, 0.5), BAND, loc=(0, 0, 0.25), smooth=False)]
    # steps + fancy door with gold knob
    for k in range(3):
        parts.append(P(coll, "step", bm_box(2.6 - k * 0.3, 0.5, 0.18), TRIM, loc=(0, fy - 1.25 + k * 0.45, 0.09 + k * 0.18), smooth=False))
    parts.append(P(coll, "door", bm_box(1.5, 0.12, 2.6), DOOR, loc=(0, fy, 1.8), smooth=False))
    parts.append(P(coll, "doorArch", bm_cyl(0.95, 0.95, 0.12, 20, "Y"), TRIM, loc=(0, fy + 0.04, 3.1)))
    parts.append(P(coll, "doorArchIn", bm_cyl(0.75, 0.75, 0.14, 20, "Y"), DOOR, loc=(0, fy - 0.01, 3.1)))
    parts.append(P(coll, "knob", bm_sphere(0.08), GOLD, loc=(0.5, fy - 0.1, 1.7)))
    # windows: ground + upper floor, with a balcony
    for x in (-3.6, 3.6):
        parts.append(P(coll, "win", bm_box(1.8, 0.1, 1.6), WIN, loc=(x, fy, 2.0), smooth=False))
        parts.append(P(coll, "frame", bm_box(2.0, 0.08, 1.8), TRIM, loc=(x, fy + 0.03, 2.0), smooth=False))
        parts.append(P(coll, "box", bm_box(2.0, 0.4, 0.3), BAND, loc=(x, fy - 0.2, 1.1), smooth=False))
        for k in range(5):
            parts.append(P(coll, "flower", bm_ico(0.14, 1), mat("Rose", "#D81B60", rough=0.6), loc=(x - 0.8 + k * 0.4, fy - 0.2, 1.33), smooth=False))
    for x in (-3.6, 0.0, 3.6):
        parts.append(P(coll, "upwin", bm_box(1.6, 0.1, 1.8), WIN, loc=(x, fy, 5.0), smooth=False))
    parts.append(P(coll, "balcony", bm_box(5.0, 1.1, 0.15), TRIM, loc=(0, fy - 0.55, 3.95), smooth=False))
    for i in range(11):
        parts.append(P(coll, "bal", bm_cyl(0.035, 0.035, 0.8, 6), GOLD, loc=(-2.4 + i * 0.48, fy - 1.05, 4.4)))
    parts.append(P(coll, "balRail", bm_box(5.0, 0.08, 0.08), GOLD, loc=(0, fy - 1.05, 4.82), smooth=False))
    # string lights across the facade (two sagging strands)
    for row, z0 in enumerate((6.3, 3.5)):
        for i in range(17):
            x = -5.2 + i * 0.65
            sag = math.sin(i / 16 * math.pi) * 0.45
            parts.append(P(coll, "light", bm_sphere(0.09, 0.09, 0.11, 8, 6), BULB, loc=(x, fy - 0.12 - row * 0.4, z0 - sag)))
    # heart sign over the door
    for s in (-1, 1):
        parts.append(P(coll, "hl", bm_sphere(0.36, 0.1, 0.36), HEART, loc=(s * 0.24, fy - 0.15, 3.95 + 0.0)))
    parts.append(P(coll, "ht", bm_cyl(0.47, 0.0, 0.62, 4), HEART, loc=(0, fy - 0.15, 3.6), rot=(math.pi, 0, math.pi / 4), smooth=False))
    # topiaries in gold pots
    for s in (-1, 1):
        parts.append(P(coll, "pot", bm_cyl(0.4, 0.3, 0.6, 14), GOLD, loc=(s * 1.8, fy - 0.8, 0.3)))
        parts.append(P(coll, "stem", bm_cyl(0.05, 0.05, 0.9, 6), mat("Bark", "#7B5537", rough=0.9), loc=(s * 1.8, fy - 0.8, 1.0)))
        parts.append(P(coll, "ball", bm_ico(0.55, 2), LEAF, loc=(s * 1.8, fy - 0.8, 1.7), smooth=False))
    # mailbox with an "A"
    parts.append(P(coll, "mailpost", bm_box(0.1, 0.1, 1.1), GOLD, loc=(4.2, -9.3, 0.55), smooth=False))
    parts.append(P(coll, "mailbox", bm_box(0.4, 0.6, 0.4), BAND, loc=(4.2, -9.3, 1.25)).bevel(0.08, 3))
    parts.append(P(coll, "mailA", txt("A", 0.3), GOLD, loc=(4.42, -9.3, 1.25), rot=(math.pi / 2, 0, math.pi / 2), smooth=False))
    # a white low fence with a gap
    for i in range(-12, 13):
        if abs(i) <= 2:
            continue
        parts.append(P(coll, "picket", bm_box(0.1, 0.06, 0.8), TRIM, loc=(i * 0.45, -9.0, 0.4), smooth=False))
    parts.append(P(coll, "path", bm_box(2.2, 5.0, 0.04), mat("Path", "#CFC3B0", rough=0.95), loc=(0, -6.8, 0.02), smooth=False))
    bake(parts, "AviHouse_body", coll, parent=root)
    anchor(coll, root, "Anchor_greeter", (0.9, fy - 1.6, 0.0))
    return coll


def build_vegas_set():
    """Viva Vegas: a giant welcome sign with chaser bulbs, a starburst, palms and a red carpet."""
    coll = scene_coll("JVegas")
    root = root_empty(coll, "JVegas")
    WHITE = mat("SignFace", "#FFFDF5", rough=0.5)
    RED = mat("SignRed", "#D32F2F", rough=0.5)
    TEAL = mat("SignTeal", "#00897B", rough=0.5)
    GOLD = mat("NeonGold", "#FFD54F", rough=0.3, emit=3.0)
    BULB = mat("NeonBulb", "#FFF59D", rough=0.3, emit=4.0)
    PINK = mat("NeonPink", "#FF4FD8", rough=0.3, emit=4.0)
    POLE = mat("SignPole", "#37474F", rough=0.5, metal=0.6)
    CARPET = mat("Carpet", "#B71C1C", rough=0.9)
    PAVE = mat("Plaza", "#BCAAA4", rough=0.95)
    parts = [P(coll, "plaza", bm_box(22.0, 16.0, 0.08), PAVE, loc=(0, 2.0, 0.04), smooth=False)]
    sx, sy, sz = 0.0, 3.0, 7.0          # sign centre
    for s in (-1, 1):
        parts.append(P(coll, "pole", bm_box(0.5, 0.5, sz), POLE, loc=(s * 2.6, sy + 0.2, sz / 2), smooth=False))
    # the diamond board: a rotated square, stretched wide
    dia = [(-6.6, 0.0), (0.0, -3.2), (6.6, 0.0), (0.0, 3.2)]
    parts.append(P(coll, "board", bm_poly_xz(dia, 0.2), WHITE, loc=(sx, sy, sz + 1.5), smooth=False))
    rim = [(-7.0, 0.0), (0.0, -3.45), (7.0, 0.0), (0.0, 3.45)]
    parts.append(P(coll, "boardRim", bm_poly_xz(rim, 0.15), RED, loc=(sx, sy + 0.1, sz + 1.5), smooth=False))
    # bulbs around the rim (approximate diamond outline)
    for k in range(32):
        t = k / 32
        a = t * math.pi * 2
        x = math.cos(a)
        z = math.sin(a)
        n = abs(x) + abs(z)
        parts.append(P(coll, "bulb", bm_sphere(0.14, 0.1, 0.14, 8, 6), BULB if k % 2 else GOLD,
                       loc=(sx + x / n * 6.75, sy - 0.25, sz + 1.5 + z / n * 3.3)))
    parts.append(P(coll, "w1", txt("WELCOME TO", 0.62), TEAL, loc=(sx, sy - 0.24, sz + 2.75), rot=(math.pi / 2, 0, 0), smooth=False))
    parts.append(P(coll, "w2", txt("VIVA", 1.15), RED, loc=(sx, sy - 0.24, sz + 1.75), rot=(math.pi / 2, 0, 0), smooth=False))
    parts.append(P(coll, "w3", txt("VEGAS", 1.25), RED, loc=(sx, sy - 0.24, sz + 0.55), rot=(math.pi / 2, 0, 0), smooth=False))
    parts.append(P(coll, "w4", txt("LULU MADE IT!", 0.42), TEAL, loc=(sx, sy - 0.24, sz - 0.25), rot=(math.pi / 2, 0, 0), smooth=False))
    # starburst on top
    for k in range(10):
        a = k / 10 * math.pi * 2
        parts.append(P(coll, "ray", bm_cyl(0.22, 0.0, 1.6, 4), GOLD if k % 2 else PINK, loc=(sx + 0.9 + math.cos(a) * 0.8, sy, sz + 4.6 + math.sin(a) * 0.8),
                       rot=(0, math.pi / 2 - a, 0), smooth=False))
    parts.append(P(coll, "starC", bm_sphere(0.45), GOLD, loc=(sx + 0.9, sy, sz + 4.6)))
    parts.append(P(coll, "starPole", bm_box(0.2, 0.2, 1.4), POLE, loc=(sx + 0.9, sy + 0.1, sz + 3.6), smooth=False))
    # red carpet from the road to the sign + velvet ropes
    parts.append(P(coll, "carpet", bm_box(2.4, 9.0, 0.04), CARPET, loc=(-6.0, -2.5, 0.1), smooth=False))
    for k in range(5):
        for s in (-1, 1):
            parts.append(P(coll, "stanchion", bm_cyl(0.06, 0.08, 1.0, 8), mat("Gold", "#FFD700", rough=0.2, metal=0.9), loc=(-6.0 + s * 1.5, -6.5 + k * 2.0, 0.5)))
    # a stack of "VEGAS" moving boxes by the curb
    BOX = mat("Cardboard", "#C89B6C", rough=0.9)
    for (x, y, z, r) in ((5.5, -4.0, 0.35, 0.1), (6.3, -4.2, 0.35, -0.2), (5.9, -4.1, 1.05, 0.3), (7.2, -3.5, 0.35, 0.5)):
        parts.append(P(coll, "box", bm_box(0.7, 0.7, 0.7), BOX, loc=(x, y, z), rot=(0, 0, r), smooth=False))
    bake(parts, "Vegas_body", coll, parent=root)
    anchor(coll, root, "Anchor_burry", (-4.0, -3.6, 0.1))
    anchor(coll, root, "Anchor_van", (8.5, 3.5, 0.0))
    return coll


def build_umbrella():
    coll = scene_coll("JUmbrella")
    root = root_empty(coll, "JUmbrella")
    W = mat("UmbWhite", "#FAFAFA", rough=0.6)
    C = mat("UmbColor", "#EF5350", rough=0.6)
    T = mat("Towel", "#4FC3F7", rough=0.9)
    parts = [P(coll, "pole", bm_cyl(0.05, 0.05, 2.5, 8), W, loc=(0, 0, 1.25), rot=(0.12, 0, 0))]
    for k in range(8):
        a = k / 8 * math.pi * 2
        parts.append(P(coll, "panel", bm_cyl(1.5, 0.0, 0.55, 3), C if k % 2 == 0 else W, loc=(0, 0.15, 2.5), rot=(0.12, 0, a), smooth=False))
    parts.append(P(coll, "towel", bm_box(1.0, 2.0, 0.03), T, loc=(0.9, -0.4, 0.03), rot=(0, 0, 0.3), smooth=False))
    parts.append(P(coll, "cooler", bm_box(0.5, 0.35, 0.35), mat("Cooler", "#26C6DA", rough=0.5), loc=(-0.6, -0.6, 0.18)).bevel(0.04, 2))
    bake(parts, "Umbrella_body", coll, parent=root)
    return coll


# ── story-event props ────────────────────────────────────────────────────
def build_seagull():
    coll = scene_coll("JSeagull")
    root = root_empty(coll, "JSeagull")
    W = mat("GullWhite", "#FAFAFA", rough=0.7)
    G = mat("GullGrey", "#90A4AE", rough=0.7)
    Y = mat("GullBeak", "#FFB300", rough=0.5)
    E = mat("Eye", "#1B1B1B", rough=0.3)
    body = [P(coll, "body", bm_sphere(0.16, 0.34, 0.16), W, loc=(0, 0, 0.3)),
            P(coll, "head", bm_sphere(0.12), W, loc=(0, -0.3, 0.42)),
            P(coll, "beak", bm_cyl(0.04, 0.0, 0.16, 8, "Y"), Y, loc=(0, -0.45, 0.4), rot=(0, 0, math.pi)),
            P(coll, "tail", bm_cyl(0.12, 0.02, 0.22, 6, "Y"), G, loc=(0, 0.38, 0.32)),
            P(coll, "legL", bm_cyl(0.015, 0.015, 0.16, 5), Y, loc=(0.06, 0.02, 0.1)),
            P(coll, "legR", bm_cyl(0.015, 0.015, 0.16, 5), Y, loc=(-0.06, 0.02, 0.1))]
    for s in (-1, 1):
        body.append(P(coll, "eye", bm_sphere(0.025), E, loc=(s * 0.08, -0.36, 0.46)))
    bake(body, "Body", coll, parent=root)
    for nm, s in (("Wing_L", 1), ("Wing_R", -1)):
        sh = (s * 0.12, -0.02, 0.36)
        bake_at([P(coll, nm + "_in", bm_sphere(0.32, 0.15, 0.03), W, loc=(s * 0.4, 0.0, 0.36)),
                 P(coll, nm + "_tip", bm_sphere(0.22, 0.1, 0.025), G, loc=(s * 0.78, 0.06, 0.36))], nm, coll, root, sh)
    return coll


def build_kite():
    coll = scene_coll("JKite")
    root = root_empty(coll, "JKite")
    A = mat("KitePink", "#FF4FA0", rough=0.6)
    B = mat("KitePurple", "#7E57C2", rough=0.6)
    T = mat("KiteTail", "#FFEB3B", rough=0.6)
    parts = []
    # diamond = two flattened 4-sided cones (upper short, lower long)
    parts.append(P(coll, "upper", bm_cyl(0.6, 0.0, 0.9, 4), A, loc=(0, 0, 1.0), rot=(0, 0, math.pi / 4), smooth=False))
    parts[-1].ob.scale = (1.0, 0.06, 1.0)
    parts.append(P(coll, "lower", bm_cyl(0.6, 0.0, 1.3, 4), B, loc=(0, 0, 0.0), rot=(math.pi, 0, math.pi / 4), smooth=False))
    parts[-1].ob.scale = (1.0, 0.06, 1.0)
    for k in range(5):
        parts.append(P(coll, "bow", bm_sphere(0.12, 0.04, 0.07), T if k % 2 == 0 else A, loc=(0.08 * math.sin(k), 0.0, -0.8 - k * 0.3)))
    parts.append(limb(coll, "spar", (0, -0.03, -0.62), (0, -0.03, 1.42), 0.015, mat("KiteSpar", "#5D4037", rough=0.6)))
    bake(parts, "Kite_body", coll, parent=root)
    return coll


def build_beachball():
    coll = scene_coll("JBeachBall")
    root = root_empty(coll, "JBeachBall")
    cols = [mat("Ball%d" % i, c, rough=0.35) for i, c in enumerate(("#F44336", "#FFFFFF", "#2196F3", "#FFEB3B", "#4CAF50", "#FFFFFF"))]
    parts = []
    for i in range(6):
        a = i / 6 * math.pi * 2
        p = P(coll, "gore", bm_sphere(0.5, 0.5, 0.5, 24, 14), cols[i], loc=(0, 0, 0.5))
        # keep only a wedge: scale a sphere into a lens and rotate (cheap gores)
        p.ob.scale = (1.0, 0.27, 1.0)
        p.ob.rotation_euler = (0, 0, a)
        parts.append(p)
    parts.append(P(coll, "cap", bm_sphere(0.1, 0.1, 0.04), cols[1], loc=(0, 0, 1.0)))
    bake(parts, "Ball_body", coll, parent=root)
    return coll


def build_sunhat():
    coll = scene_coll("JSunHat")
    root = root_empty(coll, "JSunHat")
    STRAW = mat("Straw", "#E9C987", rough=0.9)
    RIB = mat("HatRibbon", "#EC407A", rough=0.6)
    parts = [P(coll, "brim", bm_cyl(0.55, 0.6, 0.04, 28), STRAW, loc=(0, 0, 0.05)),
             P(coll, "crown", bm_sphere(0.27, 0.27, 0.22, 20, 10), STRAW, loc=(0, 0, 0.12)),
             P(coll, "band", bm_cyl(0.275, 0.275, 0.07, 20), RIB, loc=(0, 0, 0.15)),
             P(coll, "bowL", bm_sphere(0.09, 0.03, 0.06), RIB, loc=(0.08, -0.27, 0.16)),
             P(coll, "bowR", bm_sphere(0.09, 0.03, 0.06), RIB, loc=(-0.08, -0.27, 0.16))]
    bake(parts, "Hat_body", coll, parent=root)
    return coll


def build_box():
    coll = scene_coll("JBox")
    root = root_empty(coll, "JBox")
    BOX = mat("Cardboard", "#C89B6C", rough=0.9)
    TAPE = mat("Tape", "#E6C48F", rough=0.6)
    INK = mat("BoxInk", "#7B4B1E", rough=0.8)
    PIP = mat("Pip", "#FFFFFF", rough=0.5)
    parts = [P(coll, "box", bm_box(0.7, 0.7, 0.6), BOX, loc=(0, 0, 0.3)).bevel(0.02, 1),
             P(coll, "tape", bm_box(0.72, 0.16, 0.62), TAPE, loc=(0, 0, 0.3), smooth=False)]
    for s in (-1, 1):
        parts.append(P(coll, "txt", txt("VEGAS", 0.15), INK, loc=(0, s * 0.355, 0.42), rot=(math.pi / 2, 0, 0 if s < 0 else math.pi), smooth=False))
    for (x, z) in ((-0.12, 0.28), (0.12, 0.28), (0.0, 0.18), (-0.12, 0.08), (0.12, 0.08)):
        for s in (-1, 1):
            parts.append(P(coll, "pip", bm_sphere(0.035, 0.01, 0.035), PIP, loc=(s * 0.355, x, z + 0.05)))
    bake(parts, "Box_body", coll, parent=root)
    return coll


def build_phone():
    coll = scene_coll("JPhone")
    root = root_empty(coll, "JPhone")
    CASE = mat("PhoneCase", "#F06292", rough=0.4)
    SCR = mat("NeonScreen", "#B3E5FC", rough=0.1, emit=1.5)
    parts = [P(coll, "case", bm_box(0.08, 0.016, 0.16), CASE, loc=(0, 0, 0)).bevel(0.012, 2),
             P(coll, "screen", bm_box(0.068, 0.004, 0.14), SCR, loc=(0, -0.009, 0), smooth=False)]
    bake(parts, "Phone_body", coll, parent=root)
    return coll


def build_floatie():
    coll = scene_coll("JFloatie")
    root = root_empty(coll, "JFloatie")
    O = mat("TubeOrange", "#FF7043", rough=0.45)
    W = mat("White", "#FAFAFA", rough=0.5)
    parts = [P(coll, "ring", bm_torus(1.0, 0.3, 28, 10), O)]
    for k in range(4):
        a = k / 4 * math.pi * 2 + math.pi / 4
        parts.append(P(coll, "seg", bm_box(0.3, 0.7, 0.62), W, loc=(math.cos(a) * 1.0, math.sin(a) * 1.0, 0), rot=(0, 0, a), smooth=False))
    bake(parts, "Floatie_body", coll, parent=root)
    return coll


def build_morgan():
    """Morgan — Dina's lavender cat plushie (rescued from the sand at the beach)."""
    coll = scene_coll("JMorgan")
    root = root_empty(coll, "JMorgan")
    FUR = mat("MorganFur", "#9B8FB4", rough=0.95)
    BELLY = mat("MorganBelly", "#D4C9E8", rough=0.95)
    E = mat("Eye", "#1B1B1B", rough=0.3)
    N = mat("MorganNose", "#FF8FB8", rough=0.6)
    parts = [P(coll, "body", bm_sphere(0.16, 0.14, 0.18), FUR, loc=(0, 0, 0.18)),
             P(coll, "belly", bm_sphere(0.1, 0.05, 0.1), BELLY, loc=(0, -0.11, 0.15)),
             P(coll, "head", bm_sphere(0.15, 0.14, 0.13), FUR, loc=(0, -0.02, 0.42)),
             P(coll, "nose", bm_sphere(0.02), N, loc=(0, -0.155, 0.41)),
             P(coll, "tail", bm_sphere(0.04, 0.04, 0.14), FUR, loc=(0.16, 0.1, 0.2), rot=(0.5, 0.4, 0))]
    for s in (-1, 1):
        parts.append(P(coll, "ear", bm_cyl(0.06, 0.0, 0.1, 4), FUR, loc=(s * 0.09, -0.02, 0.56), rot=(0, s * -0.3, 0), smooth=False))
        parts.append(P(coll, "eye", bm_sphere(0.022, 0.012, 0.028), E, loc=(s * 0.055, -0.14, 0.45)))
        parts.append(P(coll, "paw", bm_sphere(0.05, 0.06, 0.04), FUR, loc=(s * 0.08, -0.1, 0.04)))
    bake(parts, "Morgan_body", coll, parent=root)
    return coll


# ── vehicles ─────────────────────────────────────────────────────────────
def build_minivan():
    """Ima's minivan: warm taupe, see-through windows (Ima's inside), a cargo box on the roof."""
    coll = scene_coll("JMinivan")
    root = root_empty(coll, "JMinivan")
    PAINT = mat("Paint", "#A1887F", rough=0.4)
    TRIM = mat("VanTrim", "#6D4C41", rough=0.6)
    SEAT = mat("Seat", "#D7CCC8", rough=0.8)
    GLASS = S.GLASS
    parts = [P(coll, "body", bm_box(1.95, 5.0, 0.8), PAINT, loc=(0, 0, 0.74)).bevel(0.18, 3),
             P(coll, "nose", bm_box(1.9, 1.1, 0.5), PAINT, loc=(0, -1.95, 1.2), rot=(-0.45, 0, 0)).bevel(0.12, 2),
             P(coll, "roof", bm_box(1.84, 3.4, 0.12), PAINT, loc=(0, 0.55, 2.02)).bevel(0.05, 2),
             P(coll, "floor", bm_box(1.8, 4.6, 0.1), TRIM, loc=(0, 0, 0.66), smooth=False),
             P(coll, "cargo", bm_box(1.3, 1.9, 0.42), mat("CargoBox", "#5D4037", rough=0.6), loc=(0, 0.7, 2.3)).bevel(0.15, 3),
             P(coll, "bumperF", bm_box(1.9, 0.2, 0.2), TRIM, loc=(0, -2.5, 0.5)).bevel(0.06, 2),
             P(coll, "bumperR", bm_box(1.9, 0.2, 0.2), TRIM, loc=(0, 2.5, 0.5)).bevel(0.06, 2)]
    # pillars (so the cabin is see-through glass between them)
    for s in (-1, 1):
        for y in (-1.15, 0.1, 1.3, 2.25):
            parts.append(P(coll, "pillar", bm_box(0.1, 0.14, 0.86), PAINT, loc=(s * 0.9, y, 1.58), smooth=False))
        parts.append(P(coll, "sideGlass", bm_box(0.03, 3.5, 0.78), GLASS, loc=(s * 0.92, 0.55, 1.58), smooth=False))
        parts.append(P(coll, "head", bm_box(0.4, 0.06, 0.16), S.HEAD, loc=(s * 0.62, -2.45, 0.86)).bevel(0.03, 2))
        parts.append(P(coll, "tail", bm_box(0.22, 0.06, 0.5), S.TAIL, loc=(s * 0.8, 2.48, 1.15)).bevel(0.03, 2))
        parts.append(P(coll, "rail", bm_box(0.05, 2.6, 0.05), S.CHROME, loc=(s * 0.7, 0.6, 2.1)))
    parts.append(P(coll, "windshield", bm_box(1.7, 0.03, 0.95), GLASS, loc=(0, -1.45, 1.6), rot=(-0.5, 0, 0), smooth=False))
    parts.append(P(coll, "rearGlass", bm_box(1.7, 0.03, 0.7), GLASS, loc=(0, 2.4, 1.6), smooth=False))
    for y in (-0.35, 0.75, 1.75):
        parts.append(P(coll, "seat", bm_box(1.5, 0.5, 0.36), SEAT, loc=(0, y, 0.88), smooth=False))
        parts.append(P(coll, "seatBack", bm_box(1.5, 0.14, 0.6), SEAT, loc=(0, y + 0.28, 1.3), smooth=False))
    parts.append(P(coll, "wheel", bm_torus(0.17, 0.025, 14, 5), S.DARK, loc=(0.42, -1.0, 1.35), rot=(1.2, 0, 0)))
    bake(parts, "Minivan_body", coll, parent=root)
    four_wheels(coll, root, 0.84, -1.6, 1.65, 0.36, 0.26, S.TIRE, S.CHROME, S.TIRE)
    anchor(coll, root, "Anchor_driver", (0.42, -0.35, 0.62))
    return coll


def build_icecream():
    coll = scene_coll("JIceCream")
    root = root_empty(coll, "JIceCream")
    WHITE = mat("Paint", "#FFFFFF", rough=0.4)
    PINK = mat("IcePink", "#F8BBD0", rough=0.5)
    MAG = mat("IceMagenta", "#AD1457", rough=0.5)
    CONE = mat("Cone", "#D9A05B", rough=0.8)
    parts = [P(coll, "cab", bm_box(2.1, 1.7, 1.5), WHITE, loc=(0, -2.4, 1.25)).bevel(0.2, 3),
             P(coll, "box", bm_box(2.3, 4.2, 2.3), WHITE, loc=(0, 0.6, 1.75)).bevel(0.12, 2),
             P(coll, "band", bm_box(2.34, 4.22, 0.6), PINK, loc=(0, 0.6, 1.5), smooth=False),
             P(coll, "wind", bm_box(1.8, 0.05, 0.6), S.TINT, loc=(0, -3.26, 1.6)),
             P(coll, "chassis", bm_box(2.0, 6.2, 0.3), S.DARK, loc=(0, -0.3, 0.55)),
             P(coll, "window", bm_box(0.05, 1.8, 0.9), mat("Window", "#9AD9F5", rough=0.1, emit=0.25), loc=(-1.17, 0.6, 2.1), smooth=False),
             P(coll, "shelf", bm_box(0.3, 1.9, 0.08), MAG, loc=(-1.3, 0.6, 1.62), smooth=False)]
    for s in (-1, 1):
        parts.append(P(coll, "txt", txt("ICE CREAM", 0.34), MAG, loc=(s * 1.18, 0.6, 1.5), rot=(math.pi / 2, 0, s * math.pi / 2), smooth=False))
        parts.append(P(coll, "head", bm_box(0.36, 0.06, 0.2), S.HEAD, loc=(s * 0.7, -3.25, 0.95)).bevel(0.04, 2))
        parts.append(P(coll, "tail", bm_box(0.2, 0.06, 0.3), S.TAIL, loc=(s * 1.0, 2.72, 1.0)))
    # the giant cone on the roof
    parts.append(P(coll, "cone", bm_cyl(0.55, 0.05, 1.4, 14), CONE, loc=(0, 0.6, 3.5), rot=(math.pi, 0, 0)))
    parts.append(P(coll, "scoop", bm_sphere(0.62, 0.62, 0.55), PINK, loc=(0, 0.6, 4.35)))
    parts.append(P(coll, "scoop2", bm_sphere(0.5, 0.5, 0.45), mat("Vanilla", "#FFF8E1", rough=0.7), loc=(0, 0.6, 4.95)))
    parts.append(P(coll, "cherry", bm_sphere(0.16), mat("Cherry", "#D50000", rough=0.3), loc=(0, 0.6, 5.45)))
    bake(parts, "IceCream_body", coll, parent=root)
    for nm, x, y in (("Wheel_FL", 0.9, -2.4), ("Wheel_FR", -0.9, -2.4), ("Wheel_RL", 0.9, 1.9), ("Wheel_RR", -0.9, 1.9)):
        wheel(coll, root, nm, (x, y, 0.42), 0.42, 0.3, S.TIRE, S.CHROME, S.TIRE)
    return coll


def build_burry_truck():
    """Burry's moving truck: VEGAS OR BUST, rear door rolled up, boxes inside."""
    coll = scene_coll("JBurryTruck")
    root = root_empty(coll, "JBurryTruck")
    PAINT = mat("Paint", "#8D6E63", rough=0.5)
    BOX = mat("TruckBox", "#EFEBE9", rough=0.7)
    INK = mat("TruckInk", "#4E342E", rough=0.6)
    YEL = mat("TruckYellow", "#FFE082", rough=0.6)
    INSIDE = mat("TruckInside", "#3E2723", rough=0.9)
    CARD = mat("Cardboard", "#C89B6C", rough=0.9)
    parts = [P(coll, "cab", bm_box(2.2, 1.9, 1.6), PAINT, loc=(0, -2.75, 1.4)).bevel(0.18, 3),
             P(coll, "wind", bm_box(1.9, 0.05, 0.62), S.TINT, loc=(0, -3.7, 1.75)),
             P(coll, "chassis", bm_box(1.9, 7.2, 0.3), S.DARK, loc=(0, -0.1, 0.62)),
             P(coll, "bumperF", bm_box(2.2, 0.22, 0.3), S.CHROME, loc=(0, -3.75, 0.62)).bevel(0.08, 2)]
    # the cargo box as 4 walls + roof so the open rear shows the boxes inside
    L, Wd, Hh, y0 = 5.2, 2.4, 2.6, 0.95
    parts.append(P(coll, "roofB", bm_box(Wd, L, 0.1), BOX, loc=(0, y0, 0.75 + Hh), smooth=False))
    parts.append(P(coll, "floorB", bm_box(Wd, L, 0.1), INSIDE, loc=(0, y0, 0.8), smooth=False))
    parts.append(P(coll, "front", bm_box(Wd, 0.1, Hh), BOX, loc=(0, y0 - L / 2, 0.8 + Hh / 2), smooth=False))
    for s in (-1, 1):
        parts.append(P(coll, "side", bm_box(0.1, L, Hh), BOX, loc=(s * Wd / 2, y0, 0.8 + Hh / 2), smooth=False))
        parts.append(P(coll, "stripe", bm_box(0.12, L, 0.4), PAINT, loc=(s * Wd / 2, y0, 1.15), smooth=False))
        parts.append(P(coll, "t1", txt("VEGAS", 0.55), INK, loc=(s * (Wd / 2 + 0.07), y0, 2.6), rot=(math.pi / 2, 0, s * math.pi / 2), smooth=False))
        parts.append(P(coll, "t2", txt("OR BUST!", 0.42), PAINT, loc=(s * (Wd / 2 + 0.07), y0, 1.9), rot=(math.pi / 2, 0, s * math.pi / 2), smooth=False))
        parts.append(P(coll, "head", bm_box(0.36, 0.06, 0.2), S.HEAD, loc=(s * 0.75, -3.72, 1.0)).bevel(0.04, 2))
        parts.append(P(coll, "tail", bm_box(0.18, 0.06, 0.3), S.TAIL, loc=(s * 1.05, y0 + L / 2 + 0.02, 1.0)))
    parts.append(P(coll, "rollup", bm_box(Wd - 0.1, 0.12, 0.45), YEL, loc=(0, y0 + L / 2, 0.75 + Hh - 0.25), smooth=False))
    for (x, y, z) in ((-0.5, 2.6, 1.2), (0.5, 2.4, 1.2), (0.0, 2.5, 1.9), (-0.6, 1.6, 1.2), (0.6, 1.5, 1.9)):
        parts.append(P(coll, "cbox", bm_box(0.7, 0.7, 0.7), CARD, loc=(x, y, z), smooth=False))
    parts.append(P(coll, "lamp", bm_sphere(0.35, 0.3, 0.45), mat("NeonLava", "#FF6E40", rough=0.3, emit=1.5), loc=(0.2, 2.9, 1.85)))
    bake(parts, "BurryTruck_body", coll, parent=root)
    for nm, x, y in (("Wheel_FL", 0.92, -2.7), ("Wheel_FR", -0.92, -2.7), ("Wheel_RL", 0.92, 2.0), ("Wheel_RR", -0.92, 2.0)):
        wheel(coll, root, nm, (x, y, 0.48), 0.48, 0.34, S.TIRE, S.CHROME, S.TIRE)
    anchor(coll, root, "Anchor_drop", (0, y0 + L / 2 + 0.4, 1.0))
    return coll


def build_avigail_car():
    """Avigail's purple coupe (stand-in when the cameos feature isn't around): gold trim, open top."""
    coll = scene_coll("JAviCar")
    root = root_empty(coll, "JAviCar")
    PAINT = mat("Paint", "#7E57C2", rough=0.3, metal=0.15)
    GOLD = mat("Gold", "#FFD700", rough=0.2, metal=0.9)
    SEAT = mat("Seat", "#F8BBD0", rough=0.7)
    parts = [P(coll, "body", bm_box(1.8, 4.3, 0.55), PAINT, loc=(0, 0, 0.62)).bevel(0.2, 4),
             P(coll, "hood", bm_box(1.6, 1.4, 0.2), PAINT, loc=(0, -1.3, 0.92)).bevel(0.08, 2),
             P(coll, "dash", bm_box(1.5, 0.3, 0.2), mat("DarkTrim", "#37474F", rough=0.7), loc=(0, -0.55, 0.98)).bevel(0.05, 2),
             P(coll, "bumperF", bm_box(1.7, 0.18, 0.15), GOLD, loc=(0, -2.18, 0.45)).bevel(0.06, 3),
             P(coll, "bumperR", bm_box(1.7, 0.18, 0.15), GOLD, loc=(0, 2.18, 0.45)).bevel(0.06, 3)]
    ws = P(coll, "ws", bm_box(1.5, 0.03, 0.42), S.GLASS, loc=(0, -0.68, 1.2), rot=(-0.5, 0, 0), smooth=False)
    parts.append(ws)
    for x in (-0.4, 0.4):
        parts.append(P(coll, "seat", bm_box(0.55, 0.55, 0.14), SEAT, loc=(x, 0.3, 0.9)).bevel(0.05, 2))
        parts.append(P(coll, "back", bm_box(0.55, 0.14, 0.5), SEAT, loc=(x, 0.66, 1.12), rot=(-0.18, 0, 0)).bevel(0.05, 2))
    for s in (-1, 1):
        parts.append(P(coll, "head", bm_sphere(0.16, 0.06, 0.1), S.HEAD, loc=(s * 0.58, -2.12, 0.72)))
        parts.append(P(coll, "tail", bm_box(0.32, 0.05, 0.1), S.TAIL, loc=(s * 0.6, 2.16, 0.76)).bevel(0.03, 2))
        parts.append(P(coll, "trim", bm_box(0.02, 3.6, 0.05), GOLD, loc=(s * 0.905, 0.0, 0.78)))
    parts.append(P(coll, "plate", bm_box(0.52, 0.02, 0.16), S.PLATE, loc=(0, 2.21, 0.6)))
    parts.append(P(coll, "plateTxt", txt("AVIGAIL", 0.1), PAINT, loc=(0, 2.225, 0.6), rot=(math.pi / 2, 0, math.pi), smooth=False))
    bake(parts, "AviCar_body", coll, parent=root)
    four_wheels(coll, root, 0.8, -1.35, 1.35, 0.34, 0.26, S.TIRE, GOLD, PAINT)
    anchor(coll, root, "Anchor_driver", (0.4, 0.3, 0.75))
    return coll


# ── people ───────────────────────────────────────────────────────────────
def build_burry():
    # Uncle Burry: chill, clean-shaven, dark shades, teal tropical shirt, kippah.
    return build_person("Burry", dict(hair="short", hair_color="#3E2723", top="#26A69A", sleeves="short",
                        bottom="pants", bottom_color="#455A64", shoes="#212121", width=1.08,
                        extras=["sunglasses", "kippah", "belly"], extra_colors={"Kippah": "#5D4037"}))


def build_mindy():
    # Mindy: Burry's wife — dark sheitel, pink top, earrings.
    return build_person("Mindy", dict(hair="sheitel", hair_color="#4E342E", top="#E91E63", bottom="skirt",
                        bottom_color="#37474F", shoes="#FFFFFF", extras=["earrings", "necklace"]))


ASSETS = [
    ("journey_palm", build_palm),
    ("journey_cactus", build_cactus),
    ("journey_shrub", build_shrub),
    ("journey_mesa", build_mesa),
    ("journey_beachhouse", build_beachhouse),
    ("journey_boutique", build_boutique),
    ("journey_adobe", build_adobe),
    ("journey_casino", build_casino),
    ("journey_neon_sign", build_neon_sign),
    ("journey_streetlamp", build_streetlamp),
    ("journey_umbrella", build_umbrella),
    ("journey_gate_bubbe", lambda: build_gate("bubbe")),
    ("journey_gate_heshy", lambda: build_gate("heshy")),
    ("journey_gate_beach", lambda: build_gate("beach")),
    ("journey_gate_avigail", lambda: build_gate("avigail")),
    ("journey_gate_vegas", lambda: build_gate("vegas")),
    ("journey_cholent", build_cholent),
    ("journey_pool", build_pool_set),
    ("journey_beach", build_beach_set),
    ("journey_avigail_house", build_avigail_house),
    ("journey_vegas", build_vegas_set),
    ("journey_seagull", build_seagull),
    ("journey_kite", build_kite),
    ("journey_beachball", build_beachball),
    ("journey_sunhat", build_sunhat),
    ("journey_box", build_box),
    ("journey_phone", build_phone),
    ("journey_floatie", build_floatie),
    ("journey_morgan", build_morgan),
    ("journey_minivan", build_minivan),
    ("journey_icecream", build_icecream),
    ("journey_burry_truck", build_burry_truck),
    ("journey_avigail_car", build_avigail_car),
    ("journey_burry", build_burry),
    ("journey_mindy", build_mindy),
]
