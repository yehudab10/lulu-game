"""
Exits assets (feature id: exits) — the highway interchange gantry and the REST AREA set.

Every model here is static scenery the game MERGES into a few vertex-coloured meshes per road chunk
(features/town/kit.js), so: few triangles, plain materials, names that say what glows —
"ShopWindow" (lit windows at night), "LampGlow" / "Neon*" (always a little lit), "Glass".
Front = -Y (= +Z in three.js, faces the highway / the lot's drive aisle). Metres.

  exits_gantry    the interchange gantry: a post beyond the decel lane, an arm across the carriageway,
                  two boards — EXIT ONLY over the decel lane (Anchor_exit) and ↑ THRU over the lanes
                  (Anchor_thru). The arm reaches -X (the game mounts it facing the traffic: -X = left).
  exits_building  the rest-area building: food court (glass front) + restrooms wing, a flat roof with a
                  parapet, an entrance canopy. Anchors: Anchor_food, Anchor_restroom (the doors),
                  Anchor_sign (the sign band), Anchor_foodSign, Anchor_restSign.
  exits_canopy    the gas canopy over one pump island (along X) with three pumps; Anchor_attendant,
                  Anchor_sign (the canopy's fascia).
  exits_semi      an 18-wheeler (tractor "Paint" + trailer "Trailer", both recolourable), parked.
  exits_picnic    a picnic table with benches and a striped umbrella.
  exits_vending   a bank of three vending machines (lit fronts); Anchor_slot.
  exits_kiosk     the souvenir stand: a booth with a striped awning, shelves of trinkets, a giant snow globe.
  exits_garage    MENDEL'S MUFFLERS: a one-bay garage, door rolled up, a tyre stack, a toolbox;
                  Anchor_bay (where the car stops), Anchor_mendel, Anchor_sign.
  exits_dogrun    the pet area: a low fenced run (gap = the gate at the front), a hydrant, a bag post, a bench.
  exits_lamp      a lot light (8 m pole, two heads).
"""
from lib import *


def setup():
    global S, CONC, GALV, DARK, WHITE
    S = shared()
    CONC = mat("Concrete", "#BDB8AE", rough=0.95)
    GALV = mat("Galv", "#AAB4BC", rough=0.45, metal=0.7)
    DARK = S.DARK
    WHITE = S.WHITE


# ── the interchange gantry ───────────────────────────────────────────────
def build_gantry():
    coll = scene_coll("ExitsGantry")
    root = root_empty(coll, "ExitsGantry")
    GREEN = mat("SignGreen", "#1F7A46", rough=0.6)
    L = 13.6
    parts = [Part(coll, "foot", bm_box(1.3, 1.3, 0.45), CONC, loc=(0, 0, 0.22), smooth=False),
             Part(coll, "post", bm_cyl(0.3, 0.34, 8.2, 10), GALV, loc=(0, 0, 4.1), smooth=False)]
    for z in (7.1, 8.1):
        parts.append(Part(coll, "arm", bm_box(L, 0.18, 0.18), GALV, loc=(-L / 2, 0, z), smooth=False))
    for k in range(9):
        parts.append(Part(coll, "diag", bm_box(1.5, 0.09, 0.09), GALV, loc=(-0.8 - k * 1.45, 0, 7.6), rot=(0, 0.6 * (1 if k % 2 else -1), 0), smooth=False))
    # the boards (the game lays the faces on the anchors)
    parts.append(Part(coll, "boardExit", bm_box(4.3, 0.16, 2.6), GREEN, loc=(-4.0, -0.2, 7.5), smooth=False))
    parts.append(Part(coll, "boardThru", bm_box(6.2, 0.16, 3.0), GREEN, loc=(-9.9, -0.2, 7.5), smooth=False))
    # a little catwalk under the boards
    parts.append(Part(coll, "walk", bm_box(12.0, 0.7, 0.06), GALV, loc=(-7.2, -0.6, 6.05), smooth=False))
    bake(parts, "ExitsGantry_body", coll, parent=root)
    anchor(coll, root, "Anchor_exit", (-4.0, -0.3, 7.5))
    anchor(coll, root, "Anchor_thru", (-9.9, -0.3, 7.5))
    return coll


# ── the rest-area building ───────────────────────────────────────────────
def build_building():
    coll = scene_coll("ExitsBuilding")
    root = root_empty(coll, "ExitsBuilding")
    WALL = mat("Walls", "#E8DCC8", rough=0.9)
    BRICK = mat("Brick", "#B5654A", rough=0.95)
    ROOF = mat("Roof", "#6D6A66", rough=0.9)
    TRIM = mat("Trim", "#2E7D5B", rough=0.6)
    WIN = mat("ShopWindow", "#9AD9F5", rough=0.1, emit=0.3)
    DOOR = mat("Door", "#455A64", rough=0.5)
    BAND = mat("SignBand", "#1B5E20", rough=0.5)
    W, D, H = 40.0, 12.0, 5.2
    parts = [Part(coll, "body", bm_box(W, D, H), WALL, loc=(0, 0, H / 2), smooth=False),
             Part(coll, "base", bm_box(W + 0.2, D + 0.2, 0.9), BRICK, loc=(0, 0, 0.45), smooth=False),
             Part(coll, "roof", bm_box(W + 0.6, D + 0.6, 0.3), ROOF, loc=(0, 0, H + 0.15), smooth=False)]
    for y in (-D / 2 - 0.15, D / 2 + 0.15):
        parts.append(Part(coll, "parapet", bm_box(W + 0.6, 0.3, 0.8), TRIM, loc=(0, y, H + 0.6), smooth=False))
    for x in (-W / 2 - 0.15, W / 2 + 0.15):
        parts.append(Part(coll, "parapetS", bm_box(0.3, D + 0.6, 0.8), TRIM, loc=(x, 0, H + 0.6), smooth=False))
    # roof units
    for x in (-10, 4, 12):
        parts.append(Part(coll, "hvac", bm_box(2.4, 1.8, 1.2), GALV, loc=(x, 1.5, H + 0.9), smooth=False))
    fy = -D / 2 - 0.06
    # the food court (left two thirds): a glass front
    for k in range(6):
        x = -18 + k * 3.6
        parts.append(Part(coll, "win", bm_box(3.2, 0.1, 2.6), WIN, loc=(x + 1.8, fy, 2.1), smooth=False))
        parts.append(Part(coll, "mull", bm_box(0.25, 0.2, 3.2), TRIM, loc=(x, fy - 0.05, 1.9), smooth=False))
    parts.append(Part(coll, "foodDoor", bm_box(2.6, 0.12, 2.6), WIN, loc=(4.6, fy - 0.02, 1.3), smooth=False))
    parts.append(Part(coll, "foodDoorFrame", bm_box(3.0, 0.16, 0.25), TRIM, loc=(4.6, fy - 0.04, 2.7), smooth=False))
    # the restrooms wing (right third): two doors + frosted strips
    for x, nm in ((10.5, "men"), (15.5, "women")):
        parts.append(Part(coll, "rrDoor_" + nm, bm_box(1.3, 0.12, 2.3), DOOR, loc=(x, fy - 0.02, 1.15), smooth=False))
        parts.append(Part(coll, "rrSign_" + nm, bm_box(0.6, 0.06, 0.6), mat("SignBlue", "#1565C0", rough=0.5), loc=(x, fy - 0.08, 2.75), smooth=False))
        parts.append(Part(coll, "rrWin_" + nm, bm_box(1.6, 0.08, 0.5), WIN, loc=(x + 1.7, fy, 3.8), smooth=False))
    # entrance canopy over the food court door, on two posts
    parts.append(Part(coll, "porch", bm_box(9.0, 3.6, 0.35), TRIM, loc=(4.6, -D / 2 - 1.8, 4.0), smooth=False))
    for x in (0.6, 8.6):
        parts.append(Part(coll, "porchPost", bm_box(0.3, 0.3, 4.0), WHITE, loc=(x, -D / 2 - 3.3, 2.0), smooth=False))
    # the sign band (the game lays the name on Anchor_sign)
    parts.append(Part(coll, "band", bm_box(22.0, 0.3, 1.5), BAND, loc=(-6.0, -D / 2 - 0.2, 4.35), smooth=False))
    # planters + a bench + bins along the front
    PLANT = mat("Hedge", "#3E8E41", rough=0.9)
    for x in (-15, -7, 1.0, 8.2):
        parts.append(Part(coll, "planter", bm_box(2.2, 0.9, 0.5), CONC, loc=(x, -D / 2 - 1.2, 0.25), smooth=False))
        parts.append(Part(coll, "hedge", bm_box(1.9, 0.7, 0.55), PLANT, loc=(x, -D / 2 - 1.2, 0.75), smooth=False))
    for x in (-11, 13):
        parts.append(Part(coll, "bin", bm_cyl(0.32, 0.3, 0.95, 8), mat("BinGreen", "#2E7D32", rough=0.7), loc=(x, -D / 2 - 0.9, 0.48), smooth=False))
    bake(parts, "ExitsBuilding_body", coll, parent=root)
    anchor(coll, root, "Anchor_food", (4.6, -D / 2 - 1.0, 0))
    anchor(coll, root, "Anchor_restroom", (13.0, -D / 2 - 1.0, 0))
    anchor(coll, root, "Anchor_sign", (-6.0, -D / 2 - 0.4, 4.35))
    anchor(coll, root, "Anchor_foodSign", (4.6, -D / 2 - 3.65, 4.0))
    anchor(coll, root, "Anchor_restSign", (13.0, -D / 2 - 0.3, 4.2))
    return coll


# ── the gas canopy ───────────────────────────────────────────────────────
def build_canopy():
    coll = scene_coll("ExitsCanopy")
    root = root_empty(coll, "ExitsCanopy")
    BLUE = mat("CanopyBlue", "#1565C0", rough=0.5)
    PUMP = mat("PumpRed", "#E53935", rough=0.5)
    SCR = mat("NeonPump", "#B2FF59", rough=0.4, emit=1.2)
    parts = [Part(coll, "slab", bm_box(19, 9.5, 0.05), CONC, loc=(0, 0, 0.025), smooth=False)]
    for x in (-7.0, 7.0):
        parts.append(Part(coll, "post", bm_box(0.45, 0.45, 5.0), WHITE, loc=(x, 0, 2.5), smooth=False))
    parts.append(Part(coll, "canopy", bm_box(18, 9, 0.55), WHITE, loc=(0, 0, 5.25), smooth=False))
    parts.append(Part(coll, "fascia", bm_box(18.1, 9.1, 0.4), BLUE, loc=(0, 0, 5.15), smooth=False))
    parts.append(Part(coll, "lights", bm_box(16, 7.5, 0.04), mat("LampGlow", "#FFF3D6", rough=0.3, emit=0.6), loc=(0, 0, 4.95), smooth=False))
    parts.append(Part(coll, "island", bm_box(15.0, 1.2, 0.22), CONC, loc=(0, 0, 0.11), smooth=False))
    for x in (-5.0, 0.0, 5.0):
        parts.append(Part(coll, "pump", bm_box(1.0, 0.6, 1.8), PUMP, loc=(x, 0, 1.12), smooth=False))
        parts.append(Part(coll, "pumpTop", bm_box(1.05, 0.65, 0.26), WHITE, loc=(x, 0, 2.15), smooth=False))
        for s in (-1, 1):
            parts.append(Part(coll, "screen", bm_box(0.55, 0.04, 0.32), SCR, loc=(x, s * 0.32, 1.55), smooth=False))
            parts.append(limb(coll, "hose", (x + 0.45, s * 0.3, 1.25), (x + 0.6, s * 0.55, 0.3), 0.035, DARK))
    parts.append(Part(coll, "bin", bm_cyl(0.25, 0.25, 0.75, 8), DARK, loc=(2.5, 0, 0.6), smooth=False))
    parts.append(Part(coll, "squeegee", bm_box(0.3, 0.3, 0.8), mat("SqueegeeBlue", "#29B6F6", rough=0.5), loc=(-2.5, 0, 0.62), smooth=False))
    # the air pump at the end of the island
    parts.append(Part(coll, "air", bm_box(0.5, 0.5, 1.3), mat("AirYellow", "#FDD835", rough=0.5), loc=(8.2, 0, 0.75), smooth=False))
    bake(parts, "ExitsCanopy_body", coll, parent=root)
    anchor(coll, root, "Anchor_attendant", (-1.4, -1.0, 0.22))
    anchor(coll, root, "Anchor_sign", (0, -4.62, 5.15))
    return coll


# ── an 18-wheeler ────────────────────────────────────────────────────────
def build_semi():
    coll = scene_coll("ExitsSemi")
    root = root_empty(coll, "ExitsSemi")
    PAINT = mat("Paint", "#C62828")
    TRAIL = mat("Trailer", "#ECEFF1", rough=0.6)
    STRIPE = mat("TrailerStripe", "#1565C0", rough=0.6)
    parts = [
        Part(coll, "cab", bm_box(2.5, 2.4, 2.3), PAINT, loc=(0, -6.6, 1.95), smooth=False),
        Part(coll, "hood", bm_box(2.4, 1.6, 1.2), PAINT, loc=(0, -8.4, 1.35), smooth=False),
        Part(coll, "sleeper", bm_box(2.5, 1.6, 2.7), PAINT, loc=(0, -4.7, 2.15), smooth=False),
        Part(coll, "wind", bm_box(2.2, 0.06, 0.9), S.TINT, loc=(0, -7.83, 2.55), rot=(0.25, 0, 0), smooth=False),
        Part(coll, "grille", bm_box(1.4, 0.08, 0.9), S.CHROME, loc=(0, -9.22, 1.35), smooth=False),
        Part(coll, "bumper", bm_box(2.5, 0.3, 0.35), S.CHROME, loc=(0, -9.3, 0.7), smooth=False),
        Part(coll, "chassis", bm_box(1.2, 16.5, 0.35), DARK, loc=(0, -0.8, 0.8), smooth=False),
        Part(coll, "trailer", bm_box(2.6, 13.4, 2.9), TRAIL, loc=(0, 2.7, 2.55), smooth=False),
        Part(coll, "stripe", bm_box(2.64, 11.0, 0.35), STRIPE, loc=(0, 2.9, 1.9), smooth=False),
        Part(coll, "tank", bm_cyl(0.32, 0.32, 1.4, 10, axis="Y"), S.CHROME, loc=(1.35, -6.0, 0.95), smooth=False),
    ]
    for s in (-1, 1):
        parts.append(Part(coll, "stack", bm_cyl(0.12, 0.12, 2.6, 8), S.CHROME, loc=(s * 1.15, -5.4, 3.4), smooth=False))
        parts.append(Part(coll, "head", bm_box(0.35, 0.06, 0.22), S.HEAD, loc=(s * 0.9, -9.25, 1.05), smooth=False))
        parts.append(Part(coll, "tail", bm_box(0.2, 0.06, 0.3), S.TAIL, loc=(s * 1.1, 9.42, 1.0), smooth=False))
    bake(parts, "ExitsSemi_body", coll, parent=root)
    for nm, y in (("F", -8.0), ("M1", -4.8), ("M2", -3.6), ("R1", 6.5), ("R2", 7.8)):
        for s, side in ((1, "L"), (-1, "R")):
            wheel(coll, root, "Wheel_" + nm + side, (s * 1.08, y, 0.52), 0.52, 0.4, S.TIRE, S.CHROME, S.TIRE)
    return coll


# ── small props ──────────────────────────────────────────────────────────
def build_picnic():
    coll = scene_coll("ExitsPicnic")
    root = root_empty(coll, "ExitsPicnic")
    WOOD = mat("PicnicWood", "#A1724E", rough=0.9)
    parts = [Part(coll, "top", bm_box(2.0, 0.85, 0.08), WOOD, loc=(0, 0, 0.76), smooth=False)]
    for y in (-0.72, 0.72):
        parts.append(Part(coll, "bench", bm_box(2.0, 0.3, 0.06), WOOD, loc=(0, y, 0.45), smooth=False))
    for x in (-0.75, 0.75):
        for r in (-0.45, 0.45):
            parts.append(Part(coll, "leg", bm_box(0.08, 0.08, 1.0), WOOD, loc=(x, 0, 0.42), rot=(r, 0, 0), smooth=False))
    parts.append(Part(coll, "pole", bm_cyl(0.035, 0.035, 2.3, 6), WHITE, loc=(0, 0, 1.6), smooth=False))
    parts.append(Part(coll, "umbrella", bm_cyl(1.3, 0.08, 0.45, 8), mat("Umbrella", "#EF5350", rough=0.7), loc=(0, 0, 2.55), smooth=False))
    bake(parts, "ExitsPicnic_body", coll, parent=root)
    return coll


def build_vending():
    coll = scene_coll("ExitsVending")
    root = root_empty(coll, "ExitsVending")
    parts = []
    for k, (col, glow) in enumerate((("#C62828", "#FFCDD2"), ("#1565C0", "#BBDEFB"), ("#2E7D32", "#C8E6C9"))):
        x = (k - 1) * 1.15
        parts.append(Part(coll, "box", bm_box(1.05, 0.85, 1.95), mat("Vend%d" % k, col, rough=0.5), loc=(x, 0, 0.98), smooth=False))
        parts.append(Part(coll, "front", bm_box(0.72, 0.05, 1.3), mat("NeonVend%d" % k, glow, rough=0.3, emit=0.9), loc=(x - 0.1, -0.44, 1.15), smooth=False))
        parts.append(Part(coll, "slot", bm_box(0.6, 0.06, 0.2), DARK, loc=(x - 0.1, -0.45, 0.3), smooth=False))
        parts.append(Part(coll, "pad", bm_box(0.18, 0.05, 0.5), DARK, loc=(x + 0.38, -0.45, 1.25), smooth=False))
    parts.append(Part(coll, "pad0", bm_box(3.6, 1.2, 0.08), CONC, loc=(0, 0, 0.04), smooth=False))
    bake(parts, "ExitsVending_body", coll, parent=root)
    anchor(coll, root, "Anchor_slot", (0, -0.9, 0))
    return coll


def build_kiosk():
    coll = scene_coll("ExitsKiosk")
    root = root_empty(coll, "ExitsKiosk")
    BOOTH = mat("KioskWood", "#8D6E63", rough=0.85)
    AW1 = mat("AwningPink", "#F06292", rough=0.7)
    AW2 = mat("AwningWhite", "#FAFAFA", rough=0.7)
    parts = [Part(coll, "counter", bm_box(3.4, 1.0, 1.05), BOOTH, loc=(0, -0.4, 0.52), smooth=False),
             Part(coll, "back", bm_box(3.6, 0.2, 2.6), BOOTH, loc=(0, 0.9, 1.3), smooth=False)]
    for x in (-1.7, 1.7):
        parts.append(Part(coll, "post", bm_box(0.15, 0.15, 2.7), BOOTH, loc=(x, -0.85, 1.35), smooth=False))
    for k in range(6):
        parts.append(Part(coll, "awning", bm_box(0.62, 1.9, 0.08), AW1 if k % 2 else AW2, loc=(-1.55 + k * 0.62, -0.2, 2.75), rot=(0.18, 0, 0), smooth=False))
    for k, col in enumerate(("#FFCA28", "#4FC3F7", "#AB47BC", "#66BB6A", "#FF7043", "#EC407A", "#26A69A")):
        parts.append(Part(coll, "trinket", bm_box(0.32, 0.26, 0.3), mat("Trinket%d" % k, col, rough=0.5), loc=(-1.4 + k * 0.46, 0.65, 1.45 + (k % 2) * 0.55), smooth=False))
    parts.append(Part(coll, "globe", bm_sphere(0.36), mat("Glass", "#BFE6FF", rough=0.05), loc=(1.05, -0.4, 1.4), smooth=True))
    parts.append(Part(coll, "globeBase", bm_cyl(0.3, 0.34, 0.2, 10), mat("KioskGold", "#FFC107", rough=0.4, metal=0.4), loc=(1.05, -0.4, 1.12), smooth=False))
    parts.append(Part(coll, "mugs", bm_box(0.7, 0.3, 0.22), WHITE, loc=(-0.9, -0.5, 1.16), smooth=False))
    parts.append(Part(coll, "signBoard", bm_box(2.4, 0.08, 0.55), mat("KioskSign", "#4A148C", rough=0.5), loc=(0, -1.12, 2.35), smooth=False))
    bake(parts, "ExitsKiosk_body", coll, parent=root)
    anchor(coll, root, "Anchor_vendor", (0, 0.35, 0))
    anchor(coll, root, "Anchor_sign", (0, -1.18, 2.35))
    return coll


def build_garage():
    coll = scene_coll("ExitsGarage")
    root = root_empty(coll, "ExitsGarage")
    WALL = mat("GarageWalls", "#CFD8DC", rough=0.9)
    ROOF = mat("GarageRoof", "#546E7A", rough=0.8)
    DOORM = mat("GarageDoor", "#90A4AE", rough=0.6, metal=0.3)
    INSIDE = mat("GarageDark", "#263238", rough=0.95)
    BAND = mat("GarageBand", "#E65100", rough=0.5)
    W, D, H = 15.0, 10.0, 5.0
    parts = [Part(coll, "back", bm_box(W, 0.4, H), WALL, loc=(0, D / 2 - 0.2, H / 2), smooth=False),
             Part(coll, "roof", bm_box(W + 0.5, D + 0.5, 0.35), ROOF, loc=(0, 0, H + 0.17), smooth=False),
             Part(coll, "floor", bm_box(W - 0.8, D - 0.8, 0.04), INSIDE, loc=(0, 0, 0.02), smooth=False)]
    for x in (-W / 2 + 0.2, W / 2 - 0.2):
        parts.append(Part(coll, "side", bm_box(0.4, D, H), WALL, loc=(x, 0, H / 2), smooth=False))
    # the front: an office on the right, the bay (door rolled up) on the left
    parts.append(Part(coll, "office", bm_box(5.0, 0.4, H), WALL, loc=(W / 2 - 2.5, -D / 2 + 0.2, H / 2), smooth=False))
    parts.append(Part(coll, "officeWin", bm_box(3.0, 0.1, 1.4), mat("ShopWindow", "#9AD9F5", rough=0.1, emit=0.3), loc=(W / 2 - 2.5, -D / 2 - 0.02, 2.2), smooth=False))
    parts.append(Part(coll, "header", bm_box(W - 5.0, 0.4, 1.2), WALL, loc=(-2.5, -D / 2 + 0.2, H - 0.6), smooth=False))
    parts.append(Part(coll, "rolled", bm_cyl(0.35, 0.35, W - 5.6, 8, axis="X"), DOORM, loc=(-2.5, -D / 2 + 0.55, H - 1.45), smooth=False))
    parts.append(Part(coll, "band", bm_box(W - 0.6, 0.3, 1.0), BAND, loc=(0, -D / 2 - 0.05, H + 0.75), smooth=False))
    # inside: a lift, a toolbox, tyres
    parts.append(Part(coll, "lift", bm_box(0.4, 4.0, 0.25), mat("LiftYellow", "#FDD835", rough=0.5), loc=(-4.4, 0.5, 0.15), smooth=False))
    parts.append(Part(coll, "lift2", bm_box(0.4, 4.0, 0.25), mat("LiftYellow", "#FDD835", rough=0.5), loc=(-0.6, 0.5, 0.15), smooth=False))
    parts.append(Part(coll, "toolbox", bm_box(1.6, 0.6, 1.1), mat("ToolRed", "#D32F2F", rough=0.4), loc=(-6.2, 3.8, 0.55), smooth=False))
    for k in range(4):
        parts.append(Part(coll, "tyre", bm_cyl(0.45, 0.45, 0.28, 10), S.TIRE, loc=(W / 2 + 0.8, -D / 2 + 1.0, 0.16 + k * 0.3), smooth=False))
    bake(parts, "ExitsGarage_body", coll, parent=root)
    anchor(coll, root, "Anchor_bay", (-2.5, -1.0, 0))
    anchor(coll, root, "Anchor_mendel", (2.5, -D / 2 - 1.2, 0))
    anchor(coll, root, "Anchor_sign", (0, -D / 2 - 0.25, H + 0.75))
    return coll


def build_dogrun():
    coll = scene_coll("ExitsDogrun")
    root = root_empty(coll, "ExitsDogrun")
    WOOD = mat("FenceWood", "#8D6E4E", rough=0.9)
    W, D = 18.0, 11.0
    parts = []
    # posts + two rails all round, a 3 m gate gap in the front (-Y) middle
    def run(x0, y0, x1, y1):
        n = max(1, int(round(max(abs(x1 - x0), abs(y1 - y0)) / 2.0)))
        for i in range(n + 1):
            t = i / n
            parts.append(Part(coll, "post", bm_box(0.14, 0.14, 1.0), WOOD, loc=(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 0.5), smooth=False))
        L = math.hypot(x1 - x0, y1 - y0)
        ang = math.atan2(y1 - y0, x1 - x0)
        for z in (0.45, 0.85):
            parts.append(Part(coll, "rail", bm_box(L, 0.07, 0.09), WOOD, loc=((x0 + x1) / 2, (y0 + y1) / 2, z), rot=(0, 0, ang), smooth=False))
    run(-W / 2, -D / 2, -1.5, -D / 2)
    run(1.5, -D / 2, W / 2, -D / 2)
    run(W / 2, -D / 2, W / 2, D / 2)
    run(W / 2, D / 2, -W / 2, D / 2)
    run(-W / 2, D / 2, -W / 2, -D / 2)
    parts.append(Part(coll, "hydrant", bm_cyl(0.18, 0.2, 0.75, 8), mat("HydrantRed", "#E53935", rough=0.5), loc=(4.0, 2.0, 0.38), smooth=False))
    parts.append(Part(coll, "hydrantCap", bm_sphere(0.19, u=8, v=5), mat("HydrantRed", "#E53935", rough=0.5), loc=(4.0, 2.0, 0.78), smooth=False))
    parts.append(Part(coll, "bagPost", bm_box(0.12, 0.12, 1.4), GALV, loc=(2.3, -D / 2 + 0.4, 0.7), smooth=False))
    parts.append(Part(coll, "bagBox", bm_box(0.4, 0.2, 0.5), mat("BagGreen", "#43A047", rough=0.6), loc=(2.3, -D / 2 + 0.3, 1.25), smooth=False))
    parts.append(Part(coll, "seat", bm_box(2.0, 0.5, 0.08), WOOD, loc=(-5.0, 3.6, 0.48), smooth=False))
    for x in (-5.8, -4.2):
        parts.append(Part(coll, "leg", bm_box(0.08, 0.45, 0.44), WOOD, loc=(x, 3.6, 0.22), smooth=False))
    parts.append(Part(coll, "ball", bm_sphere(0.12, u=8, v=5), mat("BallYellow", "#C6FF00", rough=0.5), loc=(-1.5, 1.0, 0.12), smooth=False))
    bake(parts, "ExitsDogrun_body", coll, parent=root)
    anchor(coll, root, "Anchor_gate", (0, -D / 2, 0))
    anchor(coll, root, "Anchor_sign", (-6.0, -D / 2 - 0.5, 0))
    return coll


def build_lamp():
    coll = scene_coll("ExitsLamp")
    root = root_empty(coll, "ExitsLamp")
    parts = [Part(coll, "base", bm_cyl(0.3, 0.32, 0.5, 8), CONC, loc=(0, 0, 0.25), smooth=False),
             Part(coll, "pole", bm_cyl(0.1, 0.13, 8.0, 8), GALV, loc=(0, 0, 4.2), smooth=False)]
    for s in (-1, 1):
        parts.append(Part(coll, "arm", bm_box(1.6, 0.1, 0.1), GALV, loc=(s * 0.8, 0, 8.1), smooth=False))
        parts.append(Part(coll, "head", bm_box(0.7, 0.35, 0.18), DARK, loc=(s * 1.55, 0, 8.05), smooth=False))
        parts.append(Part(coll, "glow", bm_box(0.6, 0.3, 0.04), mat("LampGlow", "#FFF3D6", rough=0.3, emit=1.5), loc=(s * 1.55, 0, 7.95), smooth=False))
    bake(parts, "ExitsLamp_body", coll, parent=root)
    return coll


ASSETS = [
    ("exits_gantry", build_gantry),
    ("exits_building", build_building),
    ("exits_canopy", build_canopy),
    ("exits_semi", build_semi),
    ("exits_picnic", build_picnic),
    ("exits_vending", build_vending),
    ("exits_kiosk", build_kiosk),
    ("exits_garage", build_garage),
    ("exits_dogrun", build_dogrun),
    ("exits_lamp", build_lamp),
]
