"""
features/town — LAKEWOOD, the town you can turn into (3d/js/features/town/).

Low-poly kit for a small, dense, very suburban town: duplexes with sukkah
decks, rows of brand-new townhouses (with garages nobody parks in), Main St
storefronts, PIZZA SHMIZZA (a giant slice on the roof), the SIMCHA PALACE
wedding hall, a yeshiva, a construction lot + a tower crane, the identical
silver minivan (nine car seats inside, of course), street lamps, stop signs,
the lawn chair that "saves" a parking spot, an aggressive goose, a bochur's
e-bike, the traffic-circle island, the welcome monument, a highway sign
gantry and a billboard — plus a few townsfolk.

The game merges the static pieces per block into a handful of vertex-coloured
meshes (features/town/kit.js), so keep material NAMES meaningful:
  Window / ShopWindow → glow warm at night · LampGlow → the lamps' bulbs ·
  Glass → see-through · Walls / Roof / Awning / Paint → tinted per placement.
Text (shop signs, banners, the welcome sign) is NOT modelled: each sign board
has an "Anchor_sign" empty at its centre and the game lays a canvas-texture
quad from one shared atlas there.
Every asset's FRONT faces Blender -Y (= +Z in three.js).
"""
import math
from lib import *
from lib_people import build_person


def _m():
    S = shared()
    return dict(
        S=S,
        TRIM=mat("Trim", "#FAFAFA", rough=0.7),
        WIN=mat("Window", "#8FCDEB", rough=0.15, emit=0.2),
        DOOR=mat("Door", "#5D4037", rough=0.7),
        DARK=mat("DarkTrim", "#37474F", rough=0.7),
        SIGN=mat("SignBoard", "#F5F1E6", rough=0.8),
        CONC=mat("Concrete", "#BDB8AE", rough=0.95),
        BRICK=mat("Brick", "#A0574A", rough=0.9),
    )


def windows_row(coll, parts, WIN, TRIM, xs, y, z, w=1.1, h=1.25, frame=True):
    for x in xs:
        if frame:
            parts.append(Part(coll, "wf", bm_box(w + 0.24, 0.08, h + 0.24), TRIM, loc=(x, y + 0.03, z), smooth=False))
        parts.append(Part(coll, "w", bm_box(w, 0.1, h), WIN, loc=(x, y, z), smooth=False))


def gable(coll, w, d, wall_h, roof_h, WALLS, ROOF, overhang=0.45):
    """Walls + a gabled roof; ridge along X, eaves front/back."""
    hd = d / 2
    parts = [Part(coll, "walls", bm_prism([(-hd, 0), (hd, 0), (hd, wall_h), (0, wall_h + roof_h), (-hd, wall_h)], w / 2), WALLS, smooth=False)]
    slope = math.atan2(roof_h, hd)
    L = math.hypot(hd, roof_h) + overhang
    for s in (-1, 1):
        mid = Vector((0, s * hd / 2, wall_h + roof_h / 2)) + Vector((0, s * math.sin(slope), math.cos(slope))) * 0.1
        parts.append(Part(coll, "roof", bm_box(w + 0.6, L, 0.18), ROOF, loc=mid, rot=(-s * slope, 0, 0), smooth=False))
    return parts


# ── houses ────────────────────────────────────────────────────────────────
def build_duplex():
    """A two-family duplex: two doors, two porches, a 2nd-floor sukkah deck."""
    coll = scene_coll("TownDuplex")
    root = root_empty(coll, "TownDuplex")
    M = _m()
    WALLS, ROOF = mat("Walls", "#E9DCC7", rough=0.9), mat("Roof", "#5D6D7E", rough=0.8)
    w, d, wh = 11.0, 10.0, 6.0
    parts = gable(coll, w, d, wh, 2.6, WALLS, ROOF)
    fy = -d / 2 - 0.04
    for x in (-2.8, 2.8):
        parts.append(Part(coll, "door", bm_box(1.0, 0.12, 2.1), M["DOOR"], loc=(x, fy, 1.05 + 0.35), smooth=False))
        parts.append(Part(coll, "stoop", bm_box(2.2, 1.6, 0.35), M["CONC"], loc=(x, fy - 0.8, 0.17), smooth=False))
        parts.append(Part(coll, "awn", bm_box(2.2, 1.3, 0.12), ROOF, loc=(x, fy - 0.6, 3.0), rot=(0.18, 0, 0), smooth=False))
        parts.append(Part(coll, "mez", bm_box(0.06, 0.05, 0.24), mat("Mezuzah", "#C9A227", rough=0.3, metal=0.7), loc=(x + 0.62, fy - 0.06, 1.95), rot=(0, -0.35, 0)))
    windows_row(coll, parts, M["WIN"], M["TRIM"], (-4.4, -1.2, 1.2, 4.4), fy, 1.7, w=1.0)
    windows_row(coll, parts, M["WIN"], M["TRIM"], (-4.2, -1.4, 1.4, 4.2), fy, 4.5, w=1.2)
    for sx in (-1, 1):
        parts.append(Part(coll, "sw", bm_box(0.1, 1.3, 1.2), M["WIN"], loc=(sx * (w / 2 + 0.04), 1.5, 4.4), smooth=False))
    # the sukkah deck: a balcony on the side with a railing (every house has one)
    DECK = mat("Deck", "#A1887F", rough=0.85)
    parts.append(Part(coll, "deck", bm_box(3.0, 4.2, 0.2), DECK, loc=(w / 2 + 1.5, 0.6, 3.0), smooth=False))
    for y in (-1.4, 0.6, 2.6):
        parts.append(Part(coll, "post", bm_box(0.16, 0.16, 3.0), DECK, loc=(w / 2 + 2.9, y, 1.5), smooth=False))
    parts.append(Part(coll, "rail", bm_box(0.08, 4.2, 0.08), M["TRIM"], loc=(w / 2 + 2.95, 0.6, 4.0), smooth=False))
    parts.append(Part(coll, "rail2", bm_box(3.0, 0.08, 0.08), M["TRIM"], loc=(w / 2 + 1.5, -1.45, 4.0), smooth=False))
    parts.append(Part(coll, "chim", bm_box(0.7, 0.7, 1.4), M["BRICK"], loc=(-w * 0.3, d * 0.2, wh + 1.9), smooth=False))
    bake(parts, "TownDuplex_body", coll, parent=root)
    return coll


def build_townhouses():
    """A row of three brand-new 3-storey townhouses (stone base, garages)."""
    coll = scene_coll("TownTownhouses")
    root = root_empty(coll, "TownTownhouses")
    M = _m()
    WALLS, ROOF = mat("Walls", "#D7CCC8", rough=0.9), mat("Roof", "#4E4E58", rough=0.8)
    STONE = mat("Stone", "#B0A79C", rough=0.95)
    GAR = mat("Garage", "#ECEFF1", rough=0.6)
    w, d, h = 16.5, 11.0, 9.2
    parts = [Part(coll, "body", bm_box(w, d, h), WALLS, loc=(0, 0, h / 2), smooth=False)]
    fy = -d / 2 - 0.04
    for i, x in enumerate((-5.5, 0, 5.5)):
        # three slightly different roof hats
        parts.append(Part(coll, "hat", bm_prism([(-d / 2 - 0.3, 0), (d / 2 + 0.3, 0), (0, 1.8 + 0.25 * i)], 2.75), ROOF, loc=(x, 0, h), smooth=False))
        parts.append(Part(coll, "stone", bm_box(5.4, 0.25, 3.0), STONE, loc=(x, fy - 0.08, 1.5), smooth=False))
        parts.append(Part(coll, "garage", bm_box(2.8, 0.14, 2.3), GAR, loc=(x - 1.1, fy - 0.2, 1.15), smooth=False))
        for k in range(4):
            parts.append(Part(coll, "gl", bm_box(2.8, 0.16, 0.05), M["DARK"], loc=(x - 1.1, fy - 0.22, 0.45 + k * 0.5), smooth=False))
        parts.append(Part(coll, "door", bm_box(0.95, 0.14, 2.1), M["DOOR"], loc=(x + 1.6, fy - 0.2, 1.05), smooth=False))
        parts.append(Part(coll, "pillar", bm_box(0.3, 0.3, 9.4), M["TRIM"], loc=(x + 2.72, fy - 0.1, 4.7), smooth=False))
        windows_row(coll, parts, M["WIN"], M["TRIM"], (x - 1.2, x + 1.2), fy, 4.6, w=1.4, h=1.5)
        windows_row(coll, parts, M["WIN"], M["TRIM"], (x - 1.2, x + 1.2), fy, 7.5, w=1.4, h=1.4)
        # a tiny balcony on the 2nd floor
        parts.append(Part(coll, "bal", bm_box(2.6, 0.9, 0.14), M["TRIM"], loc=(x, fy - 0.45, 3.65), smooth=False))
        parts.append(Part(coll, "balr", bm_box(2.6, 0.06, 0.7), M["DARK"], loc=(x, fy - 0.88, 4.0), smooth=False))
    bake(parts, "TownTownhouses_body", coll, parent=root)
    return coll


# ── Main St ───────────────────────────────────────────────────────────────
def shop_parts(coll, M, w, d, h, AWN):
    WALLS, ROOF = mat("Walls", "#F2D7B6", rough=0.9), mat("Roof", "#5B5B60", rough=0.8)
    SHOPWIN = mat("ShopWindow", "#9ED3EE", rough=0.1, emit=0.25)
    parts = [Part(coll, "body", bm_box(w, d, h), WALLS, loc=(0, 0, h / 2), smooth=False),
             Part(coll, "cap", bm_box(w + 0.3, d + 0.3, 0.35), ROOF, loc=(0, 0, h + 0.17), smooth=False)]
    fy = -d / 2 - 0.05
    parts.append(Part(coll, "glass", bm_box(w * 0.62, 0.1, 2.3), SHOPWIN, loc=(-w * 0.12, fy, 1.55), smooth=False))
    parts.append(Part(coll, "door", bm_box(1.1, 0.12, 2.3), M["DOOR"], loc=(w * 0.32, fy, 1.15), smooth=False))
    parts.append(Part(coll, "base", bm_box(w, 0.2, 0.4), M["DARK"], loc=(0, fy - 0.05, 0.2), smooth=False))
    # striped awning
    for k in range(int(w / 0.9)):
        x = -w / 2 + 0.45 + k * 0.9
        parts.append(Part(coll, "awn", bm_box(0.9, 1.5, 0.08), AWN if k % 2 == 0 else M["TRIM"], loc=(x, fy - 0.7, 3.25), rot=(0.32, 0, 0), smooth=False))
    parts.append(Part(coll, "sign", bm_box(w * 0.86, 0.14, 1.1), M["SIGN"], loc=(0, fy - 0.03, h - 0.85), smooth=False))
    return parts, fy


def build_shop():
    coll = scene_coll("TownShop")
    root = root_empty(coll, "TownShop")
    M = _m()
    parts, fy = shop_parts(coll, M, 12.0, 13.0, 5.0, mat("Awning", "#2E7D32", rough=0.8))
    bake(parts, "TownShop_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, fy - 0.12, 5.0 - 0.85))
    return coll


def build_pizza():
    """PIZZA SHMIZZA: a storefront with a giant slice on the roof."""
    coll = scene_coll("TownPizza")
    root = root_empty(coll, "TownPizza")
    M = _m()
    parts, fy = shop_parts(coll, M, 12.0, 13.0, 5.0, mat("Awning", "#C62828", rough=0.8))
    CRUST, CHEESE, PEP = mat("Crust", "#D9A35B", rough=0.8), mat("Cheese", "#FFD54F", rough=0.6), mat("Pepperoni", "#B71C1C", rough=0.6)
    # the slice: a wedge standing up on the roof, tip down, tilted toward the street
    tri = [(-2.6, 0), (2.6, 0), (0, -5.2)]
    bm = bmesh.new()
    vs = [bm.verts.new((x, -0.15, z)) for (x, z) in tri] + [bm.verts.new((x, 0.15, z)) for (x, z) in tri]
    bm.faces.new((vs[0], vs[1], vs[2])); bm.faces.new((vs[5], vs[4], vs[3]))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((vs[i], vs[3 + i], vs[3 + j], vs[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    parts.append(Part(coll, "slice", bm, CHEESE, loc=(0, 1.0, 5.3 + 5.2), rot=(0.12, 0, 0), smooth=False))
    parts.append(Part(coll, "crust", bm_box(5.6, 0.5, 0.6), CRUST, loc=(0, 0.95, 5.3 + 5.25), rot=(0.12, 0, 0), smooth=False).bevel(0.2, 2))
    tilt, top = 0.12, Vector((0, 1.0, 5.3 + 5.2))
    for (x, dh) in ((-1.1, 1.0), (0.9, 1.6), (0, 3.1), (-0.35, 2.2), (1.25, 0.8)):
        # a point on the slice's front face, dh below the crust, turned with the slice
        y, z = -0.19, -dh
        p = top + Vector((x, y * math.cos(tilt) - z * math.sin(tilt), y * math.sin(tilt) + z * math.cos(tilt)))
        parts.append(Part(coll, "pep", bm_cyl(0.4, 0.4, 0.06, 12, "Y"), PEP, loc=p, rot=(tilt, 0, 0)))
    parts.append(Part(coll, "pole", bm_cyl(0.18, 0.18, 1.2, 8), M["DARK"], loc=(0, 1.0, 5.6)))
    bake(parts, "TownPizza_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, fy - 0.12, 5.0 - 0.85))
    return coll


def build_hall():
    """SIMCHA PALACE: the wedding hall (columns, gold trim, a big canopy)."""
    coll = scene_coll("TownHall")
    root = root_empty(coll, "TownHall")
    M = _m()
    WALLS, ROOF = mat("Walls", "#F3E9D6", rough=0.9), mat("Roof", "#6D5E52", rough=0.8)
    GOLD = mat("Gold", "#D4AF37", rough=0.3, metal=0.8)
    w, d, h = 34.0, 22.0, 8.5
    parts = [Part(coll, "body", bm_box(w, d, h), WALLS, loc=(0, 0, h / 2), smooth=False),
             Part(coll, "cornice", bm_box(w + 0.6, d + 0.6, 0.6), M["TRIM"], loc=(0, 0, h + 0.3), smooth=False),
             Part(coll, "goldband", bm_box(w + 0.62, d + 0.62, 0.18), GOLD, loc=(0, 0, h - 0.2), smooth=False),
             Part(coll, "roof", bm_box(w - 2, d - 2, 0.8), ROOF, loc=(0, 0, h + 0.8), smooth=False)]
    fy = -d / 2 - 0.05
    # a portico: columns + pediment
    for x in (-6, -2, 2, 6):
        parts.append(Part(coll, "col", bm_cyl(0.42, 0.42, 7.0, 12), M["TRIM"], loc=(x, fy - 3.0, 3.5)))
        parts.append(Part(coll, "colcap", bm_box(1.1, 1.1, 0.3), GOLD, loc=(x, fy - 3.0, 7.1), smooth=False))
    parts.append(Part(coll, "porchroof", bm_box(14.5, 4.2, 0.5), M["TRIM"], loc=(0, fy - 2.0, 7.4), smooth=False))
    parts.append(Part(coll, "pediment", bm_prism([(-0.3, 0), (0.3, 0), (0, 2.4)], 7.25), M["TRIM"], loc=(0, fy - 3.8, 7.65), smooth=False))
    parts.append(Part(coll, "door", bm_box(3.6, 0.15, 3.4), mat("HallDoor", "#4E342E", rough=0.5), loc=(0, fy, 1.7), smooth=False))
    parts.append(Part(coll, "doorgold", bm_box(4.0, 0.12, 3.8), GOLD, loc=(0, fy + 0.03, 1.9), smooth=False))
    parts.append(Part(coll, "steps", bm_box(14.0, 4.0, 0.3), M["CONC"], loc=(0, fy - 2.0, 0.15), smooth=False))
    for side in (-1, 1):
        for k in range(3):
            x = side * (10.5 + k * 4.2)
            parts.append(Part(coll, "arch", bm_box(2.2, 0.1, 4.2), M["WIN"], loc=(x, fy, 3.2), smooth=False))
            parts.append(Part(coll, "archf", bm_box(2.6, 0.08, 4.6), GOLD, loc=(x, fy + 0.03, 3.3), smooth=False))
    parts.append(Part(coll, "sign", bm_box(16.0, 0.2, 1.6), M["SIGN"], loc=(0, fy - 4.0, 9.7), smooth=False))
    bake(parts, "TownHall_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, fy - 4.14, 9.7))
    return coll


def build_yeshiva():
    coll = scene_coll("TownYeshiva")
    root = root_empty(coll, "TownYeshiva")
    M = _m()
    w, d, h = 30.0, 18.0, 11.0
    BR = mat("Walls", "#B5654F", rough=0.9)
    parts = [Part(coll, "body", bm_box(w, d, h), BR, loc=(0, 0, h / 2), smooth=False),
             Part(coll, "cap", bm_box(w + 0.4, d + 0.4, 0.5), M["CONC"], loc=(0, 0, h + 0.25), smooth=False)]
    fy = -d / 2 - 0.05
    for row, z in enumerate((2.2, 5.5, 8.8)):
        windows_row(coll, parts, M["WIN"], M["CONC"], [-12 + k * 3.4 for k in range(8) if abs(-12 + k * 3.4 + 0.1) > 2.2], fy, z, w=1.5, h=1.9)
    parts.append(Part(coll, "entry", bm_box(4.6, 1.2, 4.8), M["CONC"], loc=(0, fy - 0.5, 2.4), smooth=False))
    parts.append(Part(coll, "door", bm_box(2.6, 0.15, 3.0), M["DOOR"], loc=(0, fy - 1.15, 1.5), smooth=False))
    parts.append(Part(coll, "sign", bm_box(12.0, 0.2, 1.3), M["SIGN"], loc=(0, fy - 0.12, h - 0.9), smooth=False))
    bake(parts, "TownYeshiva_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, fy - 0.26, h - 0.9))
    return coll


# ── construction ──────────────────────────────────────────────────────────
def build_frame():
    """A townhouse row going up: stud walls, floor decks, house wrap; a fence with a banner."""
    coll = scene_coll("TownFrame")
    root = root_empty(coll, "TownFrame")
    M = _m()
    WOOD = mat("Wood", "#D8B47E", rough=0.85)
    WRAP = mat("HouseWrap", "#F4F6F7", rough=0.7)
    w, d = 20.0, 11.0
    parts = []
    for fz in (0.25, 3.25, 6.25):
        parts.append(Part(coll, "deck", bm_box(w, d, 0.25), WOOD, loc=(0, 0, fz), smooth=False))
    for lvl, z0 in enumerate((0.4, 3.4)):
        for sx in range(-10, 11, 2):
            for y in (-d / 2 + 0.1, d / 2 - 0.1):
                parts.append(Part(coll, "stud", bm_box(0.12, 0.2, 2.85), WOOD, loc=(sx, y, z0 + 1.42), smooth=False))
        for sy in (-3.5, 0, 3.5):
            for x in (-w / 2 + 0.1, w / 2 - 0.1):
                parts.append(Part(coll, "stud", bm_box(0.2, 0.12, 2.85), WOOD, loc=(x, sy, z0 + 1.42), smooth=False))
    # the third floor already wrapped (logo-free house wrap)
    parts.append(Part(coll, "wrap", bm_box(w * 0.5, d, 2.9), WRAP, loc=(-w * 0.25, 0, 6.4 + 1.45), smooth=False))
    for x in (-8.5, -3.5):
        parts.append(Part(coll, "rafter", bm_prism([(-d / 2, 0), (d / 2, 0), (0, 2.2)], 0.08), WOOD, loc=(x, 0, 9.3), smooth=False))
    # a pallet of lumber and a portable toilet (it's a real site)
    parts.append(Part(coll, "pallet", bm_box(2.4, 1.2, 0.9), WOOD, loc=(-6, -d / 2 - 3.2, 0.45), smooth=False))
    parts.append(Part(coll, "potty", bm_box(1.2, 1.2, 2.3), mat("Potty", "#1E88E5", rough=0.6), loc=(8.5, -d / 2 - 3.0, 1.15), smooth=False).bevel(0.08, 2))
    bake(parts, "TownFrame_body", coll, parent=root)
    # the chain-link fence along the lot front + a banner board
    FENCE = mat("Fence", "#9AA3AB", rough=0.5, metal=0.6)
    fparts = []
    fy = -d / 2 - 6.0
    for x in range(-12, 13, 3):
        fparts.append(Part(coll, "fpost", bm_cyl(0.05, 0.05, 2.1, 6), FENCE, loc=(x, fy, 1.05)))
    fparts.append(Part(coll, "fmesh", bm_box(24.0, 0.03, 1.9), mat("FenceMesh", "#B0BEC5", rough=0.6), loc=(0, fy, 1.05), smooth=False))
    fparts.append(Part(coll, "banner", bm_box(12.0, 0.06, 1.8), M["SIGN"], loc=(0, fy - 0.06, 1.15), smooth=False))
    bake(fparts, "TownFrame_fence", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, fy - 0.11, 1.15))
    return coll


def build_crane():
    """A tower crane. The rotating top is the node "Jib" (origin on the mast axis)."""
    coll = scene_coll("TownCrane")
    root = root_empty(coll, "TownCrane")
    Y = mat("CraneYellow", "#F9C623", rough=0.6)
    M = _m()
    H = 30.0
    parts = [Part(coll, "base", bm_box(4, 4, 1.0), M["CONC"], loc=(0, 0, 0.5), smooth=False)]
    for cx in (-0.9, 0.9):
        for cy in (-0.9, 0.9):
            parts.append(Part(coll, "leg", bm_box(0.22, 0.22, H), Y, loc=(cx, cy, H / 2 + 1), smooth=False))
    for k in range(int(H / 3)):
        z = 1 + k * 3 + 1.5
        for (x, y, rx, ry) in ((0, -0.9, 0, 1), (0, 0.9, 0, 1), (-0.9, 0, 1, 0), (0.9, 0, 1, 0)):
            parts.append(Part(coll, "brace", bm_box(2.4 if ry else 0.12, 0.12 if ry else 2.4, 0.12), Y,
                              loc=(x, y, z), rot=((0.9 if rx else 0), (0.9 if ry else 0), 0), smooth=False))
    bake(parts, "TownCrane_mast", coll, parent=root)
    # the slewing jib (rotates around the mast)
    jp = [Part(coll, "jib", bm_box(1.2, 28, 1.2), Y, loc=(0, -11, H + 1.8), smooth=False),
          Part(coll, "cjib", bm_box(1.2, 9, 1.0), Y, loc=(0, 6.5, H + 1.6), smooth=False),
          Part(coll, "cw", bm_box(2.2, 2.4, 2.2), M["CONC"], loc=(0, 9.5, H + 0.8), smooth=False),
          Part(coll, "tower", bm_prism([(-0.7, 0), (0.7, 0), (0, 4.5)], 0.6), Y, loc=(0, 0, H + 2.4), smooth=False),
          Part(coll, "cab", bm_box(1.8, 2.0, 1.8), mat("CabGlass", "#4F6B7A", rough=0.15), loc=(1.4, -1.0, H + 1.2), smooth=False),
          Part(coll, "cable", bm_box(0.05, 0.05, 12.0), M["DARK"], loc=(0, -20, H + 1.2 - 6), smooth=False),
          Part(coll, "hook", bm_box(0.6, 0.6, 0.7), M["DARK"], loc=(0, -20, H - 11.0), smooth=False)]
    for s in (-1, 1):
        jp.append(limb(coll, "tie", (0, 0, H + 6.8), (0, s * (s > 0 and 9 or 22), H + 2.3), 0.05, M["DARK"]))
    bake(jp, "Jib", coll, parent=root)
    return coll


# ── the minivan ───────────────────────────────────────────────────────────
def build_minivan():
    """The Lakewood minivan: silver, sliding doors, roof rails, NINE car seats inside."""
    coll = scene_coll("TownMinivan")
    root = root_empty(coll, "TownMinivan")
    S = shared()
    PAINT = mat("Paint", "#C3C8CE", rough=0.35, metal=0.35)
    GLASS = mat("Glass", "#9FD8FF", rough=0.05)
    SEAT_A, SEAT_B = mat("CarSeat", "#EC407A", rough=0.8), mat("CarSeatB", "#42A5F5", rough=0.8)
    parts = [
        Part(coll, "body", bm_box(1.96, 5.0, 0.8), PAINT, loc=(0, 0, 0.78)).bevel(0.16, 1),
        Part(coll, "upper", bm_box(1.86, 3.6, 0.7), PAINT, loc=(0, 0.45, 1.5)).bevel(0.18, 1),
        Part(coll, "hood", bm_box(1.88, 1.2, 0.34), PAINT, loc=(0, -1.85, 1.12), rot=(-0.28, 0, 0)).bevel(0.1, 1),
        Part(coll, "wind", bm_box(1.74, 0.9, 0.06), S.TINT, loc=(0, -1.35, 1.55), rot=(-0.95, 0, 0)),
        Part(coll, "bumperF", bm_box(1.92, 0.22, 0.24), S.DARK, loc=(0, -2.5, 0.5)),
        Part(coll, "bumperR", bm_box(1.92, 0.22, 0.24), S.DARK, loc=(0, 2.5, 0.5)),
    ]
    # see-through side + rear glass (the car seats show)
    for sx in (-1, 1):
        parts.append(Part(coll, "sideglass", bm_box(0.06, 3.1, 0.55), GLASS, loc=(sx * 0.94, 0.45, 1.55)))
        parts.append(Part(coll, "slide", bm_box(0.03, 0.05, 0.66), S.DARK, loc=(sx * 0.985, -0.2, 0.85)))
        parts.append(Part(coll, "rail", bm_box(0.05, 2.8, 0.05), S.DARK, loc=(sx * 0.7, 0.5, 1.9)))
        parts.append(Part(coll, "head", bm_box(0.42, 0.06, 0.16), S.HEAD, loc=(sx * 0.62, -2.5, 0.9)))
        parts.append(Part(coll, "tail", bm_box(0.18, 0.06, 0.55), S.TAIL, loc=(sx * 0.84, 2.5, 1.15)))
    parts.append(Part(coll, "rearglass", bm_box(1.5, 0.06, 0.5), GLASS, loc=(0, 2.27, 1.55)))
    # nine car seats in three rows (it's Lakewood)
    for r, y in enumerate((-0.35, 0.55, 1.45)):
        for c, x in enumerate((-0.55, 0, 0.55)):
            seat = SEAT_A if (r + c) % 2 == 0 else SEAT_B
            parts.append(Part(coll, "seat", bm_box(0.42, 0.42, 0.42), seat, loc=(x, y + 0.08, 1.35), smooth=False))
            parts.append(Part(coll, "seatback", bm_box(0.42, 0.12, 0.38), seat, loc=(x, y + 0.26, 1.6), smooth=False))
    bake(parts, "TownMinivan_body", coll, parent=root)
    for nm, x, y in (("Wheel_FL", 0.84, -1.62), ("Wheel_FR", -0.84, -1.62), ("Wheel_RL", 0.84, 1.68), ("Wheel_RR", -0.84, 1.68)):
        # one material per wheel (a draw call each on a moving car): a tyre with a moulded hub
        wp = [Part(coll, nm + "_t", bm_cyl(0.36, 0.36, 0.26, 12, "X"), S.TIRE, loc=(x, y, 0.36)),
              Part(coll, nm + "_h", bm_cyl(0.16, 0.16, 0.29, 6, "X"), S.TIRE, loc=(x, y, 0.36))]
        bake_at(wp, nm, coll, root, (x, y, 0.36))
    return coll


def build_minivan_lod():
    """The same minivan for the hundreds that are PARKED (merged into the town's static
    clusters): same silhouette and paint, no bevels, no interior, dark glass, simple wheels."""
    coll = scene_coll("TownMinivanLod")
    root = root_empty(coll, "TownMinivanLod")
    S = shared()
    PAINT = mat("Paint", "#C3C8CE", rough=0.35, metal=0.35)
    parts = [
        Part(coll, "body", bm_box(1.96, 5.0, 0.8), PAINT, loc=(0, 0, 0.78), smooth=False),
        Part(coll, "upper", bm_box(1.86, 3.6, 0.7), PAINT, loc=(0, 0.45, 1.5), smooth=False),
        Part(coll, "hood", bm_box(1.88, 1.2, 0.34), PAINT, loc=(0, -1.85, 1.12), rot=(-0.28, 0, 0), smooth=False),
        Part(coll, "wind", bm_box(1.74, 0.9, 0.06), S.TINT, loc=(0, -1.35, 1.55), rot=(-0.95, 0, 0), smooth=False),
        Part(coll, "glass", bm_box(1.9, 3.1, 0.55), S.TINT, loc=(0, 0.45, 1.55), smooth=False),
        Part(coll, "bumpers", bm_box(1.92, 5.24, 0.24), S.DARK, loc=(0, 0, 0.5), smooth=False),
    ]
    for sx in (-1, 1):
        parts.append(Part(coll, "head", bm_box(0.42, 0.06, 0.16), S.HEAD, loc=(sx * 0.62, -2.5, 0.9), smooth=False))
        parts.append(Part(coll, "tail", bm_box(0.18, 0.06, 0.55), S.TAIL, loc=(sx * 0.84, 2.5, 1.15), smooth=False))
    for x, y in ((0.84, -1.62), (-0.84, -1.62), (0.84, 1.68), (-0.84, 1.68)):
        parts.append(Part(coll, "wheel", bm_box(0.26, 0.66, 0.66), S.TIRE, loc=(x, y, 0.33), smooth=False))
    bake(parts, "TownMinivanLod_body", coll, parent=root)
    return coll


# ── street furniture ──────────────────────────────────────────────────────
def build_lamp():
    """A curved-arm street lamp; the head hangs 2 m toward the street (-Y)."""
    coll = scene_coll("TownLamp")
    root = root_empty(coll, "TownLamp")
    POLE = mat("Pole", "#2F4F3E", rough=0.6, metal=0.3)
    parts = [Part(coll, "base", bm_cyl(0.24, 0.3, 0.6, 6), POLE, loc=(0, 0, 0.3), smooth=False),
             Part(coll, "pole", bm_cyl(0.1, 0.13, 6.4, 6), POLE, loc=(0, 0, 3.5), smooth=False),
             Part(coll, "arm", bm_box(0.1, 2.1, 0.1), POLE, loc=(0, -1.0, 6.55), smooth=False),
             Part(coll, "brace", bm_box(0.06, 0.9, 0.06), POLE, loc=(0, -0.4, 6.25), rot=(0.6, 0, 0), smooth=False),
             Part(coll, "head", bm_cyl(0.18, 0.42, 0.34, 8), mat("LampHead", "#263238", rough=0.5), loc=(0, -2.0, 6.42), smooth=False),
             Part(coll, "bulb", bm_cyl(0.36, 0.3, 0.1, 8), mat("LampGlow", "#FFE8B0", rough=0.3, emit=0.4), loc=(0, -2.0, 6.22), smooth=False)]
    bake(parts, "TownLamp_body", coll, parent=root)
    return coll


def build_stop():
    coll = scene_coll("TownStop")
    root = root_empty(coll, "TownStop")
    RED, WHITE = mat("StopRed", "#C62828", rough=0.5), mat("StopWhite", "#FAFAFA", rough=0.5)
    POLE = mat("Pole", "#9AA3AB", rough=0.5, metal=0.6)
    parts = [Part(coll, "pole", bm_cyl(0.05, 0.05, 2.6, 6), POLE, loc=(0, 0.05, 1.3))]
    parts.append(Part(coll, "rim", bm_cyl(0.42, 0.42, 0.03, 8, "Y"), WHITE, loc=(0, 0, 2.45), rot=(0, math.pi / 8, 0)))
    parts.append(Part(coll, "oct", bm_cyl(0.38, 0.38, 0.05, 8, "Y"), RED, loc=(0, -0.01, 2.45), rot=(0, math.pi / 8, 0)))
    # (the white STOP lettering is a quad from the game's sign atlas, at Anchor_sign)
    bake(parts, "TownStop_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, -0.05, 2.45))
    return coll


def build_chair():
    """The folding lawn chair that 'saves' the one free parking spot."""
    coll = scene_coll("TownChair")
    root = root_empty(coll, "TownChair")
    AL = mat("Alu", "#CFD8DC", rough=0.35, metal=0.7)
    WEB, WEB2 = mat("Webbing", "#43A047", rough=0.8), mat("Webbing2", "#FAFAFA", rough=0.8)
    parts = []
    for sx in (-0.28, 0.28):
        parts.append(limb(coll, "legF", (sx, -0.25, 0), (sx, 0.22, 0.42), 0.02, AL))
        parts.append(limb(coll, "legB", (sx, 0.25, 0), (sx, -0.2, 0.42), 0.02, AL))
        parts.append(limb(coll, "back", (sx, 0.22, 0.42), (sx, 0.36, 0.95), 0.02, AL))
        parts.append(limb(coll, "arm", (sx, -0.22, 0.6), (sx, 0.25, 0.6), 0.02, AL))
    for k in range(5):
        parts.append(Part(coll, "web", bm_box(0.56, 0.08, 0.012), WEB if k % 2 == 0 else WEB2, loc=(0, -0.18 + k * 0.09, 0.42), smooth=False))
        parts.append(Part(coll, "wb", bm_box(0.56, 0.012, 0.09), WEB if k % 2 == 0 else WEB2, loc=(0, 0.24 + k * 0.024, 0.5 + k * 0.1), rot=(-0.25, 0, 0), smooth=False))
    bake(parts, "TownChair_body", coll, parent=root)
    return coll


def build_goose():
    """A Canada goose with OPINIONS. Nodes: Neck (pivot at the base), Wing_L/R, Leg_L/R."""
    coll = scene_coll("TownGoose")
    root = root_empty(coll, "TownGoose")
    BODY, DARK, WHITE = mat("GooseBody", "#8D7B6A", rough=0.85), mat("GooseBlack", "#1E1E1E", rough=0.7), mat("GooseWhite", "#F5F5F5", rough=0.8)
    BEAK = mat("GooseBeak", "#2B2B2B", rough=0.5)
    FOOT = mat("GooseFoot", "#3E3E3E", rough=0.7)
    body = [Part(coll, "body", bm_sphere(0.24, 0.42, 0.22, 12, 8), BODY, loc=(0, 0.05, 0.52)),
            Part(coll, "breast", bm_sphere(0.2, 0.22, 0.19, 10, 8), mat("GooseBreast", "#D7CCC8", rough=0.85), loc=(0, -0.22, 0.48)),
            Part(coll, "tail", bm_box(0.22, 0.22, 0.08), DARK, loc=(0, 0.46, 0.6), rot=(0.4, 0, 0))]
    bake(body, "Body", coll, parent=root)
    neck = [limb(coll, "neck", (0, -0.3, 0.6), (0, -0.42, 1.05), 0.06, DARK),
            Part(coll, "head", bm_sphere(0.09, 0.13, 0.09, 10, 7), DARK, loc=(0, -0.46, 1.08)),
            Part(coll, "cheek", bm_box(0.19, 0.08, 0.06), WHITE, loc=(0, -0.44, 1.06)),
            Part(coll, "beak", bm_cyl(0.035, 0.015, 0.14, 8, "Y"), BEAK, loc=(0, -0.6, 1.07))]
    bake_at(neck, "Neck", coll, root, (0, -0.3, 0.6))
    for nm, sx in (("Wing_L", 1), ("Wing_R", -1)):
        bake_at([Part(coll, nm, bm_sphere(0.05, 0.36, 0.16, 8, 6), BODY, loc=(sx * 0.22, 0.08, 0.58))], nm, coll, root, (sx * 0.2, -0.12, 0.62))
    for nm, sx in (("Leg_L", 0.09), ("Leg_R", -0.09)):
        bake_at([limb(coll, nm, (sx, 0, 0.35), (sx, 0, 0.04), 0.022, FOOT),
                 Part(coll, nm + "f", bm_box(0.1, 0.12, 0.02), FOOT, loc=(sx, -0.04, 0.02))], nm, coll, root, (sx, 0, 0.35))
    return coll


def build_ebike():
    """A bochur's e-bike (the rider is town_bochur, seated on it at runtime). Wheels: Wheel_F / Wheel_R."""
    coll = scene_coll("TownEbike")
    root = root_empty(coll, "TownEbike")
    S = shared()
    FR = mat("BikeFrame", "#212121", rough=0.4, metal=0.4)
    BAT = mat("Battery", "#43A047", rough=0.5)
    parts = [limb(coll, "down", (0, -0.45, 0.85), (0, 0.05, 0.38), 0.03, FR),
             limb(coll, "top", (0, -0.45, 0.85), (0, 0.25, 0.82), 0.03, FR),
             limb(coll, "seatt", (0, 0.05, 0.38), (0, 0.22, 0.86), 0.03, FR),
             limb(coll, "fork", (0, -0.45, 0.95), (0, -0.55, 0.34), 0.025, FR),
             limb(coll, "stay", (0, 0.05, 0.38), (0, 0.55, 0.34), 0.025, FR),
             limb(coll, "bar", (-0.3, -0.48, 1.02), (0.3, -0.48, 1.02), 0.02, FR),
             Part(coll, "seat", bm_box(0.16, 0.28, 0.06), S.BLACK, loc=(0, 0.24, 0.9)),
             Part(coll, "bat", bm_box(0.12, 0.42, 0.14), BAT, loc=(0, -0.2, 0.62), rot=(0.75, 0, 0)),
             Part(coll, "light", bm_box(0.1, 0.06, 0.08), S.HEAD, loc=(0, -0.56, 0.98)),
             Part(coll, "basket", bm_box(0.3, 0.26, 0.18), mat("Basket", "#6D4C41", rough=0.9), loc=(0, 0.6, 0.72))]
    bake(parts, "TownEbike_body", coll, parent=root)
    for nm, y in (("Wheel_F", -0.55), ("Wheel_R", 0.55)):
        bake_at([Part(coll, nm, bm_torus(0.31, 0.035, 16, 5), S.TIRE, loc=(0, y, 0.34), rot=(0, math.pi / 2, 0)),
                 Part(coll, nm + "h", bm_cyl(0.05, 0.05, 0.08, 8, "X"), S.RIM, loc=(0, y, 0.34))], nm, coll, root, (0, y, 0.34))
    return coll


# ── signs ─────────────────────────────────────────────────────────────────
def build_welcome():
    """The WELCOME TO LAKEWOOD monument (brick base, a board, flower beds)."""
    coll = scene_coll("TownWelcome")
    root = root_empty(coll, "TownWelcome")
    M = _m()
    parts = [Part(coll, "base", bm_box(6.4, 1.0, 0.9), M["BRICK"], loc=(0, 0, 0.45), smooth=False),
             Part(coll, "cap", bm_box(6.7, 1.2, 0.18), M["CONC"], loc=(0, 0, 0.98), smooth=False)]
    for x in (-3.0, 3.0):
        parts.append(Part(coll, "pier", bm_box(0.7, 0.8, 3.4), M["BRICK"], loc=(x, 0, 1.7), smooth=False))
        parts.append(Part(coll, "piercap", bm_box(0.9, 1.0, 0.2), M["CONC"], loc=(x, 0, 3.5), smooth=False))
    parts.append(Part(coll, "board", bm_box(5.3, 0.22, 2.3), mat("SignGreen", "#1F5E3B", rough=0.6), loc=(0, 0, 2.2), smooth=False))
    parts.append(Part(coll, "bed", bm_box(7.4, 1.8, 0.3), mat("Mulch", "#5D4037", rough=1), loc=(0, -0.6, 0.15), smooth=False))
    for k in range(9):
        parts.append(Part(coll, "flw", bm_ico(0.2), mat("Flower%d" % (k % 3), ("#FF6F91", "#FFD54F", "#BA68C8")[k % 3]), loc=(-3.2 + k * 0.8, -1.05, 0.42), smooth=False))
    bake(parts, "TownWelcome_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, -0.13, 2.2))
    return coll


def build_gantry():
    """A cantilever highway sign: the post stands on the right shoulder (+X side of the
    model is the road side), the arm reaches 8 m over the lanes, the board hangs off it."""
    coll = scene_coll("TownGantry")
    root = root_empty(coll, "TownGantry")
    GALV = mat("Galv", "#AAB4BC", rough=0.45, metal=0.7)
    parts = [Part(coll, "foot", bm_box(1.2, 1.2, 0.4), mat("Concrete", "#BDB8AE", rough=0.95), loc=(0, 0, 0.2), smooth=False),
             Part(coll, "post", bm_cyl(0.28, 0.32, 7.6, 12), GALV, loc=(0, 0, 3.8))]
    for z in (6.6, 7.6):
        parts.append(Part(coll, "arm", bm_box(8.6, 0.16, 0.16), GALV, loc=(4.3, 0, z), smooth=False))
    for k in range(6):
        parts.append(Part(coll, "diag", bm_box(1.4, 0.08, 0.08), GALV, loc=(0.8 + k * 1.4, 0, 7.1), rot=(0, 0.62 * (1 if k % 2 else -1), 0), smooth=False))
    parts.append(Part(coll, "board", bm_box(7.2, 0.16, 3.4), mat("SignGreen", "#1F7A46", rough=0.6), loc=(4.6, -0.2, 7.3), smooth=False))
    bake(parts, "TownGantry_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (4.6, -0.3, 7.3))
    return coll


def build_billboard():
    coll = scene_coll("TownBillboard")
    root = root_empty(coll, "TownBillboard")
    M = _m()
    GALV = mat("Galv", "#8E979E", rough=0.5, metal=0.6)
    parts = [Part(coll, "board", bm_box(10.0, 0.3, 4.6), M["SIGN"], loc=(0, 0, 6.5), smooth=False),
             Part(coll, "frame", bm_box(10.4, 0.24, 5.0), M["DARK"], loc=(0, 0.06, 6.5), smooth=False),
             Part(coll, "walk", bm_box(10.0, 0.9, 0.1), GALV, loc=(0, -0.55, 4.0), smooth=False)]
    for x in (-3.0, 3.0):
        parts.append(Part(coll, "leg", bm_cyl(0.22, 0.26, 4.4, 10), GALV, loc=(x, 0.1, 2.2)))
    for x in (-2.5, 2.5):
        parts.append(limb(coll, "lamparm", (x, -0.3, 4.1), (x, -1.2, 4.6), 0.04, GALV))
        parts.append(Part(coll, "lamp", bm_box(0.5, 0.2, 0.2), mat("LampGlow", "#FFE8B0", rough=0.3, emit=0.4), loc=(x, -1.25, 4.6), smooth=False))
    bake(parts, "TownBillboard_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, -0.16, 6.5))
    return coll


def build_circle():
    """The traffic-circle island: a curb ring, a lawn mound, flowers and a plinth for
    the monument (the game sets a GOLD minivan on top. In honour of the minivan.)"""
    coll = scene_coll("TownCircle")
    root = root_empty(coll, "TownCircle")
    M = _m()
    parts = [Part(coll, "curb", bm_cyl(6.0, 6.0, 0.22, 32), M["CONC"], loc=(0, 0, 0.11)),
             Part(coll, "lawn", bm_cyl(5.7, 4.6, 0.5, 32), mat("Lawn", "#6DBE4B", rough=1), loc=(0, 0, 0.3)),
             Part(coll, "plinth", bm_box(3.0, 5.6, 1.4), mat("Stone", "#CFC8BC", rough=0.9), loc=(0, 0, 1.2), smooth=False),
             Part(coll, "plinthcap", bm_box(3.3, 5.9, 0.16), mat("Gold", "#D4AF37", rough=0.3, metal=0.8), loc=(0, 0, 1.95), smooth=False),
             Part(coll, "plaque", bm_box(1.4, 0.06, 0.6), mat("Bronze", "#8D6E3F", rough=0.4, metal=0.7), loc=(0, -2.83, 1.2), smooth=False)]
    for k in range(14):
        a = k / 14 * math.pi * 2
        parts.append(Part(coll, "flw", bm_ico(0.32), mat("Flower%d" % (k % 3), ("#FF6F91", "#FFD54F", "#BA68C8")[k % 3]), loc=(math.cos(a) * 4.8, math.sin(a) * 4.8, 0.62), smooth=False))
    bake(parts, "TownCircle_body", coll, parent=root)
    anchor(coll, root, "Anchor_statue", (0, 0, 2.03))
    return coll


def build_lake():
    """Lakeside bits: a reed clump and a park bench (the water itself is a plane in-game)."""
    coll = scene_coll("TownReeds")
    root = root_empty(coll, "TownReeds")
    REED, CAT = mat("Reed", "#7CA548", rough=0.9), mat("Cattail", "#6D4C41", rough=0.9)
    parts = []
    for k in range(9):
        a = k * 2.4
        x, y = math.cos(a) * 0.5 * (k % 3) / 2, math.sin(a) * 0.5 * (k % 3) / 2
        h = 1.0 + (k % 4) * 0.25
        parts.append(limb(coll, "reed", (x, y, 0), (x * 1.3, y * 1.3, h), 0.025, REED))
        if k % 3 == 0:
            parts.append(Part(coll, "cat", bm_cyl(0.05, 0.05, 0.22, 6), CAT, loc=(x * 1.3, y * 1.3, h + 0.08)))
    bake(parts, "TownReeds_body", coll, parent=root)
    return coll


# ── townsfolk ─────────────────────────────────────────────────────────────
ASSETS = [
    ("town_duplex", build_duplex),
    ("town_townhouses", build_townhouses),
    ("town_shop", build_shop),
    ("town_pizza", build_pizza),
    ("town_hall", build_hall),
    ("town_yeshiva", build_yeshiva),
    ("town_frame", build_frame),
    ("town_crane", build_crane),
    ("town_minivan", build_minivan),
    ("town_minivan_lod", build_minivan_lod),
    ("town_lamp", build_lamp),
    ("town_stop", build_stop),
    ("town_chair", build_chair),
    ("town_goose", build_goose),
    ("town_ebike", build_ebike),
    ("town_welcome", build_welcome),
    ("town_gantry", build_gantry),
    ("town_billboard", build_billboard),
    ("town_circle", build_circle),
    ("town_reeds", build_lake),
    # the cast: a bochur (e-bike), a local who DEFENDS Lakewood, a mom with opinions,
    # an out-of-towner from Brooklyn, a real-estate guy ("Your house. We want it.")
    ("town_bochur", lambda: build_person("TownBochur", dict(hair="short", hair_color="#3E2723", top="#FAFAFA", sleeves="long",
                                                              bottom="pants", bottom_color="#1B1B1B", shoes="#111111",
                                                              extras=["fedora", "glasses"], extra_colors={"Hat": "#141414", "HatBand": "#2B2B2B"}))),
    ("town_local", lambda: build_person("TownLocal", dict(hair="short", hair_color="#5D4037", top="#FAFAFA", sleeves="long",
                                                            bottom="pants", bottom_color="#263238", shoes="#111111", width=1.12,
                                                            extras=["beard", "kippah", "vest", "belly"], extra_colors={"Beard": "#4E342E", "Kippah": "#1B1B1B", "Vest": "#263238"}))),
    ("town_mom", lambda: build_person("TownMom", dict(hair="sheitel", hair_color="#4E342E", top="#3949AB", sleeves="long",
                                                        bottom="skirt", bottom_color="#212121", shoes="#3E2723", extras=["sunglasses_up"]))),
    ("town_brooklyn", lambda: build_person("TownBrooklyn", dict(hair="short", hair_color="#212121", top="#78909C", sleeves="long",
                                                                  bottom="pants", bottom_color="#37474F", shoes="#EEEEEE",
                                                                  extras=["cap", "beard", "sunglasses"], extra_colors={"Hat": "#C62828", "Beard": "#212121"}))),
    ("town_agent", lambda: build_person("TownAgent", dict(hair="short", hair_color="#212121", top="#1A237E", sleeves="long",
                                                            bottom="pants", bottom_color="#1A237E", shoes="#111111",
                                                            extras=["tie", "kippah"], extra_colors={"Tie": "#FFC107", "Kippah": "#1A237E"}))),
]
