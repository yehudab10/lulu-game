"""
World assets (feature id: world) — Lulu's home street and the places you can pull into.

  world_home      LULU'S HOUSE on the cul-de-sac at the start of the road (Lakewood): a two-storey
                  family house with a pink door, a porch (+ steps where Dina sits), an attached
                  garage with a basketball hoop, hedges, Dina's bike on the lawn, the mailbox.
                  Front = -Y (= +Z in three.js, faces the road). Anchors: Anchor_park (where the
                  car stops, nose to the garage), Anchor_dina (the porch step), Anchor_window
                  (the front window sill — the Chanukah menorah), Anchor_table (the porch table —
                  honey / matzah), Anchor_neighbour. Holiday dressing ships hidden:
                  Deco_sukkah (the sukkah in the side yard, Sukkot) and Deco_chanukah (blue and
                  white bulbs along the porch eave). "Window" glows at night (atmos).
  world_gas       GAS 'N' GO — a little roadside station: canopy, one pump island parallel to
                  the road (the car stops beside it), the mart (+ a lit sign), a price pylon.
                  Anchor_attendant (where the attendant stands), Anchor_stop (where the car stops).
  world_lookout   THE LOOKOUT — a gravel bay, a split-rail fence, a bench, coin-op binoculars and a
                  sign, looking out over a lake (WaterLake, translucent) with hills behind it.
                  Anchor_stop, Anchor_view (what the camera pans across).
"""
from lib import *


def setup():
    global S
    S = shared()


FACE_Y = (math.pi / 2, 0, 0)   # text standing up, readable from -Y (the road)


def text_lo(body, size, extrude=0.01):
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = body
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.extrude = extrude
    cu.resolution_u = 3
    tmp = bpy.data.objects.new("txt", cu)
    bpy.context.scene.collection.objects.link(tmp)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=size * 0.004)
    return bm


def gable(coll, name, w, d, wall_h, roof_h, WALLS, ROOF, loc=(0, 0, 0), along_x=True):
    """A box with a gable roof; ridge along X (along_x) or Y."""
    x0, y0, z0 = loc
    parts = []
    if along_x:
        hd = d / 2
        parts.append(Part(coll, name + "W", bm_prism([(-hd, 0), (hd, 0), (hd, wall_h), (0, wall_h + roof_h), (-hd, wall_h)], w / 2),
                          WALLS, loc=loc, smooth=False))
        slope = math.atan2(roof_h, hd)
        L = math.hypot(hd, roof_h) + 0.5
        for s in (-1, 1):
            mid = Vector((x0, y0 + s * hd / 2, z0 + wall_h + roof_h / 2)) + Vector((0, s * math.sin(slope), math.cos(slope))) * 0.1
            parts.append(Part(coll, name + "R", bm_box(w + 0.6, L, 0.18), ROOF, loc=mid, rot=(-s * slope, 0, 0), smooth=False))
    else:
        hw = w / 2
        p = Part(coll, name + "W", bm_prism([(-hw, 0), (hw, 0), (hw, wall_h), (0, wall_h + roof_h), (-hw, wall_h)], d / 2),
                 WALLS, loc=loc, rot=(0, 0, math.pi / 2), smooth=False)
        parts.append(p)
        slope = math.atan2(roof_h, hw)
        L = math.hypot(hw, roof_h) + 0.5
        for s in (-1, 1):
            mid = Vector((x0 + s * hw / 2, y0, z0 + wall_h + roof_h / 2)) + Vector((s * math.sin(slope), 0, math.cos(slope))) * 0.1
            parts.append(Part(coll, name + "R", bm_box(L, d + 0.6, 0.18), ROOF, loc=mid, rot=(0, s * slope, 0), smooth=False))
    return parts


# ── Lulu's house ─────────────────────────────────────────────────────────
def build_home():
    coll = scene_coll("WorldHome")
    root = root_empty(coll, "WorldHome")
    WALLS = mat("HomeWalls", "#F7E6D4", rough=0.9)
    ROOF = mat("HomeRoof", "#5B6B7C", rough=0.8)
    TRIM = mat("Trim", "#FFFFFF", rough=0.7)
    DOOR = mat("HomeDoor", "#E91E63", rough=0.5)
    WIN = mat("Window", "#9AD9F5", rough=0.1, emit=0.25)
    SHUT = mat("HomeShutter", "#8E6CC8", rough=0.6)
    HEDGE = mat("Hedge", "#4E9A3E", rough=0.9)
    GDOOR = mat("GarageDoor", "#ECEFF1", rough=0.6)
    WOOD = mat("PorchWood", "#B98A5E", rough=0.85)
    BRICK = mat("Brick", "#A1665E", rough=0.9)
    BRASS = mat("Brass", "#C9A227", rough=0.3, metal=0.7)
    PATH = mat("Path", "#CFC3B0", rough=0.95)
    MAILB = SHUT
    W, D, H1, RH = 10.0, 8.0, 5.6, 2.4
    hd = D / 2
    fy = -hd - 0.04
    parts = gable(coll, "house", W, D, H1, RH, WALLS, ROOF)
    parts.append(Part(coll, "chimney", bm_box(0.8, 0.8, 2.2), BRICK, loc=(3.0, 1.2, H1 + RH * 0.7), smooth=False))
    # a band between the floors
    parts.append(Part(coll, "band", bm_box(W + 0.1, D + 0.1, 0.16), TRIM, loc=(0, 0, 2.85), smooth=False))
    # front door (pink!) + frame + mezuzah
    parts.append(Part(coll, "door", bm_box(1.1, 0.12, 2.1), DOOR, loc=(0.6, fy, 1.05 + 0.4), smooth=False))
    parts.append(Part(coll, "doorframe", bm_box(1.4, 0.08, 2.35), TRIM, loc=(0.6, fy + 0.03, 1.15 + 0.4), smooth=False))
    parts.append(Part(coll, "knob", bm_sphere(0.06, u=8, v=6), BRASS, loc=(0.98, fy - 0.08, 1.45)))
    parts.append(Part(coll, "mezuzah", bm_box(0.06, 0.05, 0.26), BRASS,
                      loc=(1.22, fy - 0.06, 2.05), rot=(0, -0.35, 0)))
    # windows: two downstairs (left of the door), three upstairs, side windows
    def window(x, z, wdt=1.3, hgt=1.1, shutters=True, y=fy):
        parts.append(Part(coll, "winframe", bm_box(wdt + 0.25, 0.08, hgt + 0.25), TRIM, loc=(x, y + 0.02, z), smooth=False))
        parts.append(Part(coll, "win", bm_box(wdt, 0.1, hgt), WIN, loc=(x, y, z), smooth=False))
        parts.append(Part(coll, "mullion", bm_box(0.06, 0.12, hgt), TRIM, loc=(x, y - 0.01, z), smooth=False))
        if shutters:
            for s in (-1, 1):
                parts.append(Part(coll, "shutter", bm_box(0.32, 0.08, hgt + 0.1), SHUT, loc=(x + s * (wdt / 2 + 0.3), y - 0.01, z), smooth=False))
    window(-2.8, 1.75)
    window(3.2, 1.75)
    for x in (-3.0, 0.4, 3.2):
        window(x, 4.25, 1.2, 1.0)
    for sx in (-1, 1):
        parts.append(Part(coll, "sidewin", bm_box(0.1, 1.2, 1.0), WIN, loc=(sx * (W / 2 + 0.04), 0.5, 1.75), smooth=False))
        parts.append(Part(coll, "sidewin2", bm_box(0.1, 1.2, 1.0), WIN, loc=(sx * (W / 2 + 0.04), 0.5, 4.25), smooth=False))
    # window sill for the menorah (left downstairs window)
    parts.append(Part(coll, "sill", bm_box(1.7, 0.42, 0.08), TRIM, loc=(-2.8, fy - 0.2, 1.12), smooth=False))
    # porch: deck, steps, roof, columns, railing, a bench + a little table
    py0, pdep = fy - 1.15, 2.3
    parts.append(Part(coll, "porch", bm_box(7.4, pdep, 0.4), WOOD, loc=(0.3, py0, 0.2), smooth=False))
    for k in range(2):
        parts.append(Part(coll, "step", bm_box(1.8, 0.38, 0.27 - k * 0.13), WOOD, loc=(0.6, py0 - pdep / 2 - 0.19 - k * 0.38, 0.135 - k * 0.065), smooth=False))
    parts.append(Part(coll, "porchRoof", bm_box(7.8, pdep + 0.4, 0.16), ROOF, loc=(0.3, py0 - 0.1, 3.0), rot=(0.1, 0, 0), smooth=False))
    for x in (-3.2, 3.8):
        parts.append(Part(coll, "column", bm_cyl(0.13, 0.13, 2.6, 10), TRIM, loc=(x, py0 - pdep / 2 + 0.2, 1.7)))
    for x0, x1 in ((-3.2, -0.5), (1.7, 3.8)):
        parts.append(Part(coll, "rail", bm_box(x1 - x0, 0.08, 0.08), TRIM, loc=((x0 + x1) / 2, py0 - pdep / 2 + 0.2, 1.25), smooth=False))
        n = int((x1 - x0) / 0.32)
        for i in range(n):
            parts.append(Part(coll, "baluster", bm_box(0.05, 0.05, 0.85), TRIM, loc=(x0 + 0.16 + i * 0.32, py0 - pdep / 2 + 0.2, 0.82), smooth=False))
    parts.append(Part(coll, "bench", bm_box(1.6, 0.5, 0.08), WOOD, loc=(-2.0, py0 + 0.5, 0.86), smooth=False))
    parts.append(Part(coll, "benchBack", bm_box(1.6, 0.08, 0.5), WOOD, loc=(-2.0, py0 + 0.72, 1.15), smooth=False))
    for x in (-2.7, -1.3):
        parts.append(Part(coll, "benchLeg", bm_box(0.08, 0.45, 0.46), WOOD, loc=(x, py0 + 0.5, 0.63), smooth=False))
    parts.append(Part(coll, "table", bm_cyl(0.36, 0.36, 0.06, 14), WOOD, loc=(2.7, py0 + 0.3, 1.05)))
    parts.append(Part(coll, "tableLeg", bm_cyl(0.05, 0.05, 0.62, 8), WOOD, loc=(2.7, py0 + 0.3, 0.72)))
    # a flower pot by the door
    parts.append(Part(coll, "pot", bm_cyl(0.26, 0.2, 0.4, 10), BRICK, loc=(-0.6, py0 + 0.6, 0.6)))
    parts.append(Part(coll, "potPlant", bm_ico(0.32), HEDGE, loc=(-0.6, py0 + 0.6, 0.95), smooth=False))
    # hedges along the front
    for x in (-3.9, 4.4):
        parts.append(Part(coll, "hedge", bm_box(1.6, 0.8, 0.8), HEDGE, loc=(x, fy - 0.6, 0.4), smooth=False).bevel(0.2, 2))
    # the garage wing (toward -X), ridge front-to-back, a garage door + hoop
    gx, gw, gd, gh = -7.7, 5.4, 7.0, 3.1
    parts += gable(coll, "garage", gw, gd, gh, 1.4, WALLS, ROOF, loc=(gx, 0.5, 0), along_x=False)
    gfy = 0.5 - gd / 2 - 0.04
    parts.append(Part(coll, "gdoor", bm_box(4.0, 0.1, 2.5), GDOOR, loc=(gx, gfy, 1.25), smooth=False))
    for k in range(4):
        parts.append(Part(coll, "gline", bm_box(4.0, 0.12, 0.04), TRIM, loc=(gx, gfy - 0.01, 0.55 + k * 0.6), smooth=False))
    parts.append(Part(coll, "gframe", bm_box(4.3, 0.08, 2.7), TRIM, loc=(gx, gfy + 0.02, 1.32), smooth=False))
    parts.append(Part(coll, "board", bm_box(1.2, 0.06, 0.8), TRIM, loc=(gx, gfy - 0.05, 3.55), smooth=False))
    parts.append(Part(coll, "hoop", bm_torus(0.24, 0.025, 14, 4), BRICK, loc=(gx, gfy - 0.35, 3.25), smooth=False))
    # front path + mailbox + family name plate
    parts.append(Part(coll, "path", bm_box(1.4, 6.0, 0.04), PATH, loc=(0.6, py0 - pdep / 2 - 3.6, 0.02), smooth=False))
    parts.append(Part(coll, "mailpost", bm_box(0.1, 0.1, 1.1), WOOD, loc=(3.0, -12.4, 0.55), smooth=False))
    parts.append(Part(coll, "mailbox", bm_box(0.3, 0.55, 0.3), MAILB, loc=(3.0, -12.4, 1.2), smooth=False).bevel(0.08, 2))
    parts.append(Part(coll, "flag", bm_box(0.03, 0.08, 0.32), DOOR, loc=(3.17, -12.3, 1.35), smooth=False))
    parts.append(Part(coll, "nameTxt", text_lo("18", 0.34), BRASS, loc=(1.75, fy - 0.03, 2.3), rot=FACE_Y, smooth=False))
    bake(parts, "WorldHome_body", coll, parent=root)

    # Dina's bike on the lawn (its own small object so it isn't merged into the house's bounds)
    bp = []
    BIKE = mat("BikePink", "#FF5CA8", rough=0.4)
    for y in (-0.45, 0.45):
        bp.append(Part(coll, "wheel", bm_torus(0.28, 0.035, 14, 4), S.TIRE, loc=(0, y, 0.3), rot=(0, math.pi / 2, 0), smooth=False))
    bp.append(limb(coll, "frame", (0, -0.45, 0.3), (0, 0.1, 0.62), 0.03, BIKE))
    bp.append(limb(coll, "frame2", (0, 0.1, 0.62), (0, 0.45, 0.3), 0.03, BIKE))
    bp.append(Part(coll, "seat", bm_box(0.12, 0.24, 0.05), S.BLACK, loc=(0, 0.2, 0.7), smooth=False))
    bp.append(limb(coll, "bars", (0, -0.35, 0.62), (0, -0.35, 0.82), 0.025, BIKE))
    bp.append(Part(coll, "grips", bm_box(0.5, 0.05, 0.05), S.BLACK, loc=(0, -0.35, 0.84), smooth=False))
    bike = bake(bp, "Bike", coll, parent=root)
    bike.location = (4.6, -9.6, 0)
    bike.rotation_euler = (0.32, 0, 0.6)

    # 🌿 the sukkah (Sukkot) in the side yard (+X): posts, striped cloth walls, schach on top, fruit
    sp = []
    sx, sy = 8.4, -7.2   # out front on the lawn, where the street can see it
    CLOTH = mat("SukkahCloth", "#F5F0E1", rough=0.9)
    STRIPE = mat("SukkahStripe", "#2E7D9A", rough=0.9)
    SCHACH = mat("Schach", "#6B8E3A", rough=0.95)
    for dx in (-1.5, 1.5):
        for dy in (-1.5, 1.5):
            sp.append(Part(coll, "post", bm_box(0.12, 0.12, 2.5), WOOD, loc=(sx + dx, sy + dy, 1.25), smooth=False))
    for (cx, cy, w, d) in ((sx, sy + 1.5, 3.0, 0.05), (sx + 1.5, sy, 0.05, 3.0), (sx - 1.5, sy + 0.55, 0.05, 1.9)):
        sp.append(Part(coll, "cloth", bm_box(w, d, 2.0), CLOTH, loc=(cx, cy, 1.25), smooth=False))
        for z in (0.55, 1.95):
            sp.append(Part(coll, "stripe", bm_box(w + 0.01, d + 0.01, 0.18), STRIPE, loc=(cx, cy, z), smooth=False))
    for i in range(9):
        sp.append(Part(coll, "schach", bm_box(3.3, 0.3, 0.1), SCHACH, loc=(sx, sy - 1.5 + i * 0.37, 2.55 + (i % 2) * 0.05), rot=(0, 0, 0.04 * (i % 3 - 1)), smooth=False))
    FRUIT = [mat("FruitRed", "#E53935"), mat("FruitGold", "#FFCA28"), mat("FruitPurple", "#7B1FA2")]
    for i in range(7):
        fx = sx - 1.2 + i * 0.4
        sp.append(limb(coll, "string", (fx, sy - 1.3 + (i % 3) * 0.6, 2.5), (fx, sy - 1.3 + (i % 3) * 0.6, 2.15), 0.008, TRIM))
        sp.append(Part(coll, "fruit", bm_sphere(0.09, u=8, v=6), FRUIT[i % 3], loc=(fx, sy - 1.3 + (i % 3) * 0.6, 2.1)))
    # paper chain along the open front
    CHAIN = [mat("ChainPink", "#F48FB1"), mat("ChainBlue", "#81D4FA")]
    for i in range(10):
        sp.append(Part(coll, "chain", bm_torus(0.07, 0.015, 8, 3), CHAIN[i % 2], loc=(sx - 1.35 + i * 0.3, sy - 1.5, 2.35 - math.sin(i / 9 * math.pi) * 0.25),
                       rot=(0, (i % 2) * math.pi / 2, 0), smooth=False))
    sp.append(Part(coll, "sTable", bm_box(1.4, 0.8, 0.06), TRIM, loc=(sx + 0.2, sy + 0.2, 0.75), smooth=False))
    sp.append(Part(coll, "sTableLeg", bm_box(1.2, 0.6, 0.7), WOOD, loc=(sx + 0.2, sy + 0.2, 0.37), smooth=False))
    bake(sp, "Deco_sukkah", coll, parent=root)

    # 🕎 Chanukah: a string of blue + white bulbs along the porch eave and the gutter
    cp = []
    BLUE = mat("LightBlue", "#4FC3F7", rough=0.3, emit=2.5)
    WHITE = mat("LightWhite", "#FFFFFF", rough=0.3, emit=2.5)
    for i in range(22):
        x = -3.4 + i * (7.6 / 21)
        cp.append(Part(coll, "bulb", bm_sphere(0.07, u=6, v=4), BLUE if i % 2 else WHITE, loc=(x, py0 - pdep / 2 - 0.12, 2.9 - abs(math.sin(i * 0.9)) * 0.08)))
    for i in range(26):
        x = -W / 2 + i * (W / 25)
        cp.append(Part(coll, "bulb2", bm_sphere(0.07, u=6, v=4), WHITE if i % 2 else BLUE, loc=(x, -hd - 0.3, H1 - 0.12)))
    bake(cp, "Deco_chanukah", coll, parent=root)

    anchor(coll, root, "Anchor_park", (gx, gfy - 3.3, 0))
    anchor(coll, root, "Anchor_dina", (0.6, py0 - pdep / 2 - 0.05, 0.27))
    anchor(coll, root, "Anchor_window", (-2.8, fy - 0.25, 1.16))
    anchor(coll, root, "Anchor_table", (2.7, py0 + 0.3, 1.08))
    anchor(coll, root, "Anchor_lulu", (-1.2, py0 - pdep / 2 - 1.2, 0))
    return coll


# ── Gas 'n' Go ───────────────────────────────────────────────────────────
def build_gas():
    coll = scene_coll("WorldGas")
    root = root_empty(coll, "WorldGas")
    RED = mat("GasRed", "#E53935", rough=0.5)
    WHITE = mat("White", "#FAFAFA", rough=0.6)
    CONC = mat("Concrete", "#BDB8AE", rough=0.95)
    DARK = S.DARK
    SIGN = mat("NeonGas", "#FFEB3B", rough=0.4, emit=1.6)
    WIN = mat("ShopWindow", "#9AD9F5", rough=0.1, emit=0.3)
    WALL = mat("MartWalls", "#FFF3E0", rough=0.9)
    parts = [Part(coll, "slab", bm_box(20, 13, 0.06), CONC, loc=(0, 0.5, 0.03), smooth=False)]
    # canopy on four posts
    for x in (-6.5, 6.5):
        parts.append(Part(coll, "post", bm_box(0.4, 0.4, 4.6), WHITE, loc=(x, -1.4, 2.3), smooth=False))
    parts.append(Part(coll, "canopy", bm_box(16, 6.5, 0.5), WHITE, loc=(0, -1.4, 4.85), smooth=False))
    parts.append(Part(coll, "canopyBand", bm_box(16.1, 6.6, 0.32), RED, loc=(0, -1.4, 4.8), smooth=False))
    parts.append(Part(coll, "canopyTxt", text_lo("GAS 'N' GO", 0.42), WHITE, loc=(0, -4.72, 4.8), rot=FACE_Y, smooth=False))
    # the pump island (parallel to the road) with two pumps
    parts.append(Part(coll, "island", bm_box(9.0, 1.1, 0.22), CONC, loc=(0, -0.4, 0.11), smooth=False).bevel(0.08, 2))
    for x in (-2.6, 2.6):
        parts.append(Part(coll, "pump", bm_box(0.9, 0.55, 1.7), RED, loc=(x, -0.4, 1.07), smooth=False).bevel(0.06, 2))
        parts.append(Part(coll, "pumpTop", bm_box(0.95, 0.6, 0.24), WHITE, loc=(x, -0.4, 2.0), smooth=False))
        parts.append(Part(coll, "pumpScreen", bm_box(0.5, 0.04, 0.3), SIGN, loc=(x, -0.7, 1.45), smooth=False))
        parts.append(Part(coll, "nozzle", bm_box(0.12, 0.2, 0.35), DARK, loc=(x + 0.5, -0.4, 1.25), smooth=False))
        parts.append(limb(coll, "hose", (x + 0.5, -0.4, 1.05), (x + 0.3, -0.75, 0.3), 0.03, DARK))
    parts.append(Part(coll, "bin", bm_cyl(0.25, 0.25, 0.7, 10), DARK, loc=(0, -0.4, 0.57)))
    # the mart
    parts += gable(coll, "mart", 9.0, 4.6, 3.2, 0.9, WALL, mat("MartRoof", "#8D6E63", rough=0.8), loc=(1.5, 5.3, 0))
    parts.append(Part(coll, "martWin", bm_box(4.4, 0.1, 1.5), WIN, loc=(3.0, 2.96, 1.5), smooth=False))
    parts.append(Part(coll, "martDoor", bm_box(1.2, 0.1, 2.2), WIN, loc=(-0.8, 2.96, 1.1), smooth=False))
    parts.append(Part(coll, "martSign", bm_box(5.5, 0.12, 0.7), RED, loc=(1.5, 2.9, 2.75), smooth=False))
    parts.append(Part(coll, "martTxt", text_lo("KOSHER SNACKS", 0.36), WHITE, loc=(1.5, 2.82, 2.75), rot=FACE_Y, smooth=False))
    parts.append(Part(coll, "ice", bm_box(1.3, 0.7, 1.2), WIN, loc=(-3.3, 3.2, 0.6), smooth=False))
    parts.append(Part(coll, "iceTxt", text_lo("ICE", 0.3), WHITE, loc=(-3.3, 2.84, 0.75), rot=FACE_Y, smooth=False))
    # price pylon by the road
    parts.append(Part(coll, "pylon", bm_box(0.3, 0.3, 4.4), DARK, loc=(8.6, -5.4, 2.2), smooth=False))
    parts.append(Part(coll, "pylonBoard", bm_box(2.2, 0.3, 2.0), RED, loc=(8.6, -5.4, 4.6), smooth=False))
    parts.append(Part(coll, "pylonTxt1", text_lo("GAS'N'GO", 0.3), SIGN, loc=(8.6, -5.58, 5.15), rot=FACE_Y, smooth=False))
    parts.append(Part(coll, "pylonTxt2", text_lo("$3.18", 0.42), SIGN, loc=(8.6, -5.58, 4.45), rot=FACE_Y, smooth=False))
    parts.append(Part(coll, "pylonTxt3", text_lo("RUGELACH!", 0.2), WHITE, loc=(8.6, -5.58, 3.85), rot=FACE_Y, smooth=False))
    bake(parts, "WorldGas_body", coll, parent=root)
    anchor(coll, root, "Anchor_stop", (0, -2.7, 0))
    anchor(coll, root, "Anchor_attendant", (-1.2, 0.35, 0.22))
    return coll


# ── The Lookout ──────────────────────────────────────────────────────────
def build_lookout():
    coll = scene_coll("WorldLookout")
    root = root_empty(coll, "WorldLookout")
    GRAVEL = mat("Gravel", "#C9B99A", rough=1.0)
    WOOD = mat("RailWood", "#8D6E4E", rough=0.9)
    METAL = mat("ScopeMetal", "#2E7D32", rough=0.4, metal=0.5)
    WATER = mat("WaterLake", "#3FA7D6", rough=0.15)
    HILL = mat("Hill", "#6FAE52", rough=1.0)
    HILL2 = mat("HillFar", "#7FA6B8", rough=1.0)
    SAND = mat("Shore", "#E3D3A4", rough=1.0)
    parts = [Part(coll, "pad", bm_box(16, 8.5, 0.05), GRAVEL, loc=(0, -2.0, 0.025), smooth=False)]
    # split-rail fence along the back of the bay
    for i in range(9):
        x = -8 + i * 2.0
        parts.append(Part(coll, "post", bm_box(0.18, 0.18, 1.1), WOOD, loc=(x, 2.4, 0.55), smooth=False))
    for z in (0.5, 0.95):
        parts.append(Part(coll, "rail", bm_box(16.2, 0.1, 0.12), WOOD, loc=(0, 2.4, z), smooth=False))
    # bench
    parts.append(Part(coll, "seat", bm_box(2.0, 0.5, 0.08), WOOD, loc=(-3.5, 1.5, 0.48), smooth=False))
    parts.append(Part(coll, "back", bm_box(2.0, 0.08, 0.45), WOOD, loc=(-3.5, 1.75, 0.8), smooth=False))
    for x in (-4.3, -2.7):
        parts.append(Part(coll, "leg", bm_box(0.08, 0.45, 0.44), WOOD, loc=(x, 1.5, 0.22), smooth=False))
    # coin-op binoculars
    parts.append(Part(coll, "scopePost", bm_cyl(0.07, 0.09, 1.1, 10), METAL, loc=(3.0, 1.6, 0.55)))
    parts.append(Part(coll, "scopeBody", bm_box(0.5, 0.36, 0.32), METAL, loc=(3.0, 1.6, 1.25), smooth=False).bevel(0.08, 2))
    for s in (-1, 1):
        parts.append(Part(coll, "scopeEye", bm_cyl(0.08, 0.1, 0.3, 10, "Y"), METAL, loc=(3.0 + s * 0.12, 1.85, 1.3)))
    # sign
    parts.append(Part(coll, "signPost", bm_box(0.14, 0.14, 2.0), WOOD, loc=(-6.6, -5.6, 1.0), smooth=False))
    parts.append(Part(coll, "signBoard", bm_box(2.6, 0.12, 1.0), WOOD, loc=(-6.6, -5.6, 2.2), smooth=False))
    parts.append(Part(coll, "signTxt", text_lo("SCENIC\nLOOKOUT", 0.3), mat("SignCream", "#FFF3D6"), loc=(-6.6, -5.68, 2.2), rot=FACE_Y, smooth=False))
    # the view: a lake with a sandy shore, a little dock, hills behind
    lake = bm_cyl(1.0, 1.0, 0.04, 28)
    bmesh.ops.scale(lake, vec=(26, 18, 1), verts=lake.verts)
    parts.append(Part(coll, "lake", lake, WATER, loc=(0, 26, 0.04), smooth=False))
    shore = bm_cyl(1.0, 1.0, 0.03, 28)
    bmesh.ops.scale(shore, vec=(29, 20.5, 1), verts=shore.verts)
    parts.append(Part(coll, "shore", shore, SAND, loc=(0, 26, 0.02), smooth=False))
    parts.append(Part(coll, "dock", bm_box(1.4, 6.0, 0.12), WOOD, loc=(6.0, 10.5, 0.3), smooth=False))
    for y in (8.0, 10.5, 13.0):
        for s in (-1, 1):
            parts.append(Part(coll, "piling", bm_cyl(0.1, 0.1, 0.8, 6), WOOD, loc=(6.0 + s * 0.6, y, 0.2)))
    for (x, y, r, h, m) in ((-30, 58, 22, 9, HILL), (4, 66, 28, 13, HILL), (36, 56, 20, 8, HILL), (-12, 92, 40, 22, HILL2), (34, 96, 36, 18, HILL2)):
        hb = bm_sphere(1.0, u=12, v=6)
        bmesh.ops.scale(hb, vec=(r, r * 0.6, h), verts=hb.verts)
        parts.append(Part(coll, "hill", hb, m, loc=(x, y, -h * 0.25), smooth=True))
    # reeds
    for i in range(14):
        a = i / 14 * math.pi * 2
        parts.append(Part(coll, "reed", bm_cyl(0.03, 0.01, 1.2, 4), HILL, loc=(math.cos(a) * 25.5 + (i % 3) * 0.4, 26 + math.sin(a) * 17.5, 0.6)))
    bake(parts, "WorldLookout_body", coll, parent=root)
    anchor(coll, root, "Anchor_stop", (0, -3.2, 0))
    anchor(coll, root, "Anchor_view", (0, 30, 2.0))
    anchor(coll, root, "Anchor_bench", (-3.5, 1.4, 0.48))
    return coll


ASSETS = [
    ("world_home", build_home),
    ("world_gas", build_gas),
    ("world_lookout", build_lookout),
]
