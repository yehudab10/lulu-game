"""
Law feature assets: cops, pursuits, arrest, jail & court.

    <bpy-python> 3d/blender/make_assets.py --only law

Sets (one model each, laid out in Blender units = metres, FRONT = -Y):
    law_station   PRECINCT 18½ — the police station Lulu is hauled to / walks out of
    law_cell      the cell block: Lulu's cell (bars + a swinging Gate + padlock), bunk,
                  sink/toilet, barred window, the corridor with a floor vent, guard desk, EXIT
    law_booking   booking room: height chart wall, mugshot camera on a tripod (Flash bulb), desk
    law_court     the courtroom: raised bench + seal + flags, witness stand, jury box,
                  counsel tables, bar rail, gallery benches, tall windows (+ a Gavel node)
Props:
    law_billboard roadside billboard (hidden speed traps hide behind it; WANTED posters
                  go on its "BillboardFace" material at runtime)
    law_chopper   police helicopter (Rotor / TailRotor nodes, LightRed / LightBlue strobes)
    law_k9        police dog (Leg_FL/FR/BL/BR hip pivots, Tail, Head)
    law_missile   the cop missile
    law_cart      the jail lunch cart
People (build_person, one per asset):
    law_judge law_prosecutor law_lawyer law_cellmate law_abba
"""
from lib import *
from lib_people import build_person


# ── shared palette ───────────────────────────────────────────────────────
def P():
    return SimpleNamespace(
        CONC=mat("Concrete", "#8E959D", rough=0.95),
        CONC_D=mat("ConcreteDark", "#5F666E", rough=0.95),
        FLOOR=mat("CellFloor", "#6B7178", rough=0.9),
        STEEL=mat("Steel", "#6E7780", rough=0.35, metal=0.8),
        STEEL_D=mat("SteelDark", "#3B4148", rough=0.4, metal=0.7),
        MATT=mat("Mattress", "#7D93A8", rough=0.9),
        BLANKET=mat("Blanket", "#B0475A", rough=0.95),
        PILLOW=mat("Pillow", "#ECEFF1", rough=0.9),
        BULB=mat("Bulb", "#FFF3C4", rough=0.3, emit=4.0),
        SKYWIN=mat("WindowLight", "#BFDDF2", rough=0.4, emit=1.6),
        WOOD=mat("Wood", "#8D5A34", rough=0.6),
        WOOD_D=mat("WoodDark", "#5D3A22", rough=0.6),
        WOOD_L=mat("WoodLight", "#B07A4C", rough=0.6),
        PLASTER=mat("Plaster", "#EFE3CC", rough=0.9),
        GOLD=mat("Gilt", "#D4AF37", rough=0.3, metal=0.85),
        CARPET=mat("Carpet", "#9C2A2A", rough=0.95),
        DOOR=mat("DoorGreen", "#3F6B5A", rough=0.6),
        EXIT=mat("ExitSign", "#2ECC71", rough=0.4, emit=2.5),
        BRICK=mat("Brick", "#9C5A4A", rough=0.9),
        STONE=mat("Stone", "#D9D2C3", rough=0.85),
        BLUE=mat("PoliceBlue", "#1A3A8F", rough=0.5),
        WHITE=mat("White", "#FAFAFA", rough=0.6),
        BLACK=mat("Black", "#1B1B1B", rough=0.5),
        GLASS=mat("GlassTint", "#2B3A42", rough=0.08, metal=0.2),
        ORANGE=mat("Jumpsuit", "#FF7043", rough=0.8),
        TIRE=mat("Tire", "#262626", rough=0.9),
    )


def box(coll, name, sx, sy, sz, m, loc, rot=(0, 0, 0), bev=0.0, smooth=False):
    p = Part(coll, name, bm_box(sx, sy, sz), m, loc=loc, rot=rot, smooth=smooth)
    if bev:
        p.bevel(bev, 2)
    return p


def cyl(coll, name, r, h, m, loc, segs=12, axis="Z", r2=None, rot=(0, 0, 0)):
    return Part(coll, name, bm_cyl(r, r if r2 is None else r2, h, segs, axis), m, loc=loc, rot=rot)


def text(coll, name, body, size, m, loc, rot=(math.pi / 2, 0, 0), extrude=0.02):
    """Text standing up, readable from -Y (the front)."""
    return Part(coll, name, bm_text(body, size, extrude), m, loc=loc, rot=rot, smooth=False)


# ── PRECINCT 18½ ─────────────────────────────────────────────────────────
def build_station():
    c = P()
    coll = scene_coll("LawStation")
    root = root_empty(coll, "LawStation")
    W, D, H = 18.0, 11.0, 7.2
    parts = [
        box(coll, "walls", W, D, H, c.BRICK, (0, D / 2, H / 2)),
        box(coll, "base", W + 0.4, D + 0.4, 0.6, c.STONE, (0, D / 2, 0.3)),
        box(coll, "cornice", W + 0.6, D + 0.6, 0.45, c.STONE, (0, D / 2, H + 0.1)),
        box(coll, "parapet", W + 0.3, 0.3, 0.7, c.STONE, (0, -0.0, H + 0.6)),
        box(coll, "band", W + 0.1, 0.12, 0.35, c.STONE, (0, -0.06, 3.6)),
    ]
    # portico: steps, columns, pediment
    for i in range(4):
        parts.append(box(coll, "step", 7.4 - i * 0.4, 0.55, 0.18, c.STONE, (0, -2.6 + i * 0.5, 0.09 + i * 0.18)))
    parts.append(box(coll, "porch", 7.0, 2.2, 0.72, c.STONE, (0, -1.0, 0.36)))
    for x in (-2.8, -1.0, 1.0, 2.8):
        parts.append(cyl(coll, "column", 0.28, 4.6, c.STONE, (x, -1.75, 0.72 + 2.3), segs=16))
        parts.append(box(coll, "capital", 0.75, 0.75, 0.22, c.STONE, (x, -1.75, 5.4)))
    parts.append(box(coll, "lintel", 7.4, 2.6, 0.55, c.STONE, (0, -0.95, 5.75)))
    parts.append(Part(coll, "pediment", bm_prism([(-3.7, 0), (3.7, 0), (0, 1.25)], 1.25), c.STONE, loc=(0, -0.95, 6.02), rot=(0, 0, math.pi / 2), smooth=False))
    # the sign over the door
    parts.append(box(coll, "signboard", 6.2, 0.14, 0.9, c.BLUE, (0, -2.26, 5.75)))
    parts.append(text(coll, "signTxt", "PRECINCT 18½", 0.62, c.WHITE, (0, -2.36, 5.72)))
    parts.append(text(coll, "policeTxt", "POLICE DEPARTMENT", 0.42, c.BLUE, (0, -0.4, 7.28), extrude=0.03))
    # double doors
    parts.append(box(coll, "doorframe", 3.0, 0.2, 3.1, c.STONE, (0, -0.05, 0.72 + 1.55)))
    for s in (-1, 1):
        parts.append(box(coll, "door", 1.3, 0.12, 2.8, c.GLASS, (s * 0.68, -0.14, 0.72 + 1.4)))
        parts.append(box(coll, "doorbar", 0.6, 0.06, 0.06, c.STEEL, (s * 0.68, -0.22, 0.72 + 1.3)))
        # the classic blue lamps either side of the door
        parts.append(cyl(coll, "lampArm", 0.04, 0.5, c.STEEL_D, (s * 2.0, -0.3, 3.2), axis="Y"))
        parts.append(Part(coll, "lamp", bm_sphere(0.26, 0.26, 0.34), mat("LampBlue", "#5AA2FF", rough=0.3, emit=3.5), loc=(s * 2.0, -0.6, 3.2)))
    # window rows
    WIN = mat("StationWindow", "#FFE7A8", rough=0.3, emit=0.9)
    for z in (2.0, 5.2):
        for x in (-7.6, -5.6, -4.0, 4.0, 5.6, 7.6):
            parts.append(box(coll, "winframe", 1.25, 0.14, 1.6, c.STONE, (x, -0.04, z)))
            parts.append(box(coll, "win", 1.0, 0.16, 1.35, WIN, (x, -0.06, z)))
            parts.append(box(coll, "winbar", 0.06, 0.2, 1.35, c.STONE, (x, -0.1, z)))
    # flag pole + flag
    parts.append(cyl(coll, "pole", 0.07, 9.0, c.STEEL, (-6.8, -4.2, 4.5), segs=10))
    parts.append(Part(coll, "finial", bm_sphere(0.14), c.GOLD, loc=(-6.8, -4.2, 9.05)))
    parts.append(box(coll, "flag", 0.04, 1.8, 1.1, c.BLUE, (-6.8, -3.25, 8.3)))
    parts.append(box(coll, "flagStripe", 0.05, 1.8, 0.22, c.WHITE, (-6.8, -3.25, 8.3)))
    # a strip of sidewalk out front
    parts.append(box(coll, "sidewalk", W + 4, 4.2, 0.12, c.CONC, (0, -4.2, 0.06)))
    # "SERVE · PROTECT · FILL OUT FORMS" plaque
    parts.append(box(coll, "plaque", 1.6, 0.06, 0.5, c.GOLD, (3.8, -0.06, 1.7)))
    bake(parts, "LawStation_body", coll, parent=root)
    return coll


# ── the cell block ───────────────────────────────────────────────────────
def build_cell():
    c = P()
    coll = scene_coll("LawCell")
    root = root_empty(coll, "LawCell")
    CW, CD, CH = 4.4, 3.4, 3.1          # Lulu's cell: x -2.2..2.2, y 0 (bars)..3.4 (back wall)
    parts = [
        box(coll, "floor", 22, 9.4, 0.1, c.FLOOR, (0, -1.3, -0.05)),
        box(coll, "ceiling", 22, 9.4, 0.12, c.CONC_D, (0, -1.3, CH + 0.06)),
        box(coll, "backwall", 22, 0.3, CH, c.CONC, (0, CD + 0.15, CH / 2)),
        box(coll, "wainscot", 22, 0.32, 0.9, c.CONC_D, (0, CD + 0.14, 0.45)),
    ]
    # cell dividers (side walls) — our cell plus the neighbours' outlines
    for x in (-6.6, -2.2, 2.2, 6.6):
        parts.append(box(coll, "divider", 0.25, CD, CH, c.CONC, (x, CD / 2, CH / 2)))
    # corridor end walls
    for x in (-11, 11):
        parts.append(box(coll, "endwall", 0.3, 9.4, CH, c.CONC, (x, -1.3, CH / 2)))
    # a yellow safety line along the corridor
    parts.append(box(coll, "line", 22, 0.12, 0.012, mat("SafetyYellow", "#F4C430", rough=0.6), (0, -0.55, 0.006)))
    # barred window high on our back wall (moonlight)
    parts.append(box(coll, "window", 1.3, 0.12, 0.8, c.SKYWIN, (0, CD - 0.02, 2.25)))
    parts.append(box(coll, "windowSill", 1.5, 0.2, 0.08, c.CONC_D, (0, CD - 0.08, 1.82)))
    for i in range(5):
        parts.append(cyl(coll, "winbar", 0.025, 0.85, c.STEEL, (-0.52 + i * 0.26, CD - 0.1, 2.25)))
    # bunk bed (right side of the cell)
    bx, by = 1.25, 2.3
    for z in (0.45, 1.55):
        parts.append(box(coll, "bunkframe", 0.95, 2.0, 0.08, c.STEEL, (bx, by, z), bev=0.02))
        parts.append(box(coll, "mattress", 0.88, 1.92, 0.16, c.MATT, (bx, by, z + 0.12), bev=0.05))
        parts.append(box(coll, "blanket", 0.9, 1.2, 0.05, c.BLANKET, (bx, by - 0.3, z + 0.21), bev=0.02))
        parts.append(box(coll, "pillow", 0.6, 0.35, 0.12, c.PILLOW, (bx, by + 0.72, z + 0.26), bev=0.05))
    for dx in (-0.45, 0.45):
        for dy in (-0.98, 0.98):
            parts.append(cyl(coll, "bunkpost", 0.035, 2.0, c.STEEL, (bx + dx, by + dy, 1.0)))
    for k in range(4):
        parts.append(cyl(coll, "rung", 0.02, 0.5, c.STEEL, (bx - 0.47, by - 0.98, 0.7 + k * 0.25), axis="Y", rot=(0, 0, math.pi / 2)))
    # steel sink + toilet (left back corner)
    parts.append(box(coll, "sinkblock", 0.6, 0.45, 0.85, c.STEEL, (-1.7, CD - 0.25, 0.425), bev=0.04))
    parts.append(box(coll, "sinkbowl", 0.42, 0.3, 0.05, c.STEEL_D, (-1.7, CD - 0.28, 0.86)))
    parts.append(cyl(coll, "tap", 0.025, 0.18, c.STEEL, (-1.7, CD - 0.42, 0.96)))
    parts.append(cyl(coll, "toilet", 0.22, 0.42, c.STEEL, (-1.0, CD - 0.35, 0.21), segs=16, r2=0.18))
    parts.append(cyl(coll, "toiletrim", 0.24, 0.05, c.STEEL_D, (-1.0, CD - 0.35, 0.44), segs=16))
    # a little shelf with Bubbe's letter
    parts.append(box(coll, "shelf", 0.7, 0.22, 0.05, c.WOOD, (-1.5, CD - 0.11, 1.55)))
    parts.append(box(coll, "letter", 0.22, 0.16, 0.02, c.PILLOW, (-1.6, CD - 0.12, 1.59)))
    # caged ceiling light
    parts.append(cyl(coll, "lampbase", 0.2, 0.06, c.STEEL_D, (0, 1.5, CH - 0.03)))
    parts.append(Part(coll, "bulb", bm_sphere(0.11), c.BULB, loc=(0, 1.5, CH - 0.18)))
    parts.append(Part(coll, "cage", bm_torus(0.16, 0.012, 14, 4), c.STEEL_D, loc=(0, 1.5, CH - 0.18)))
    parts.append(Part(coll, "cage2", bm_torus(0.16, 0.012, 14, 4), c.STEEL_D, loc=(0, 1.5, CH - 0.18), rot=(math.pi / 2, 0, 0)))
    # corridor lights
    for x in (-8, 8):
        parts.append(box(coll, "tube", 1.2, 0.16, 0.06, c.BULB, (x, -2.4, CH - 0.05)))
    # the front bars of all three cells (gate gap in ours: x -0.55..0.55)
    for cx in (-4.4, 0.0, 4.4):
        for i in range(13):
            x = cx - 2.1 + i * 0.35
            if cx == 0.0 and -0.6 < x < 0.6:
                continue
            parts.append(cyl(coll, "bar", 0.03, CH, c.STEEL, (x, 0, CH / 2), segs=8))
        for z in (0.12, 1.6, CH - 0.12):
            if cx == 0.0:
                for s in (-1, 1):
                    parts.append(box(coll, "rail", 1.55, 0.07, 0.07, c.STEEL_D, (s * 1.35, 0, z)))
            else:
                parts.append(box(coll, "rail", 4.4, 0.07, 0.07, c.STEEL_D, (cx, 0, z)))
    # neighbours' bunks (just shapes in the gloom)
    for cx in (-4.4, 4.4):
        parts.append(box(coll, "nbunk", 0.95, 2.0, 0.24, c.MATT, (cx + 1.2, 2.3, 0.55), bev=0.04))
    # the corridor: guard desk + chair, floor vent, EXIT door
    parts.append(box(coll, "desk", 1.5, 0.75, 0.08, c.WOOD, (6.8, -3.6, 0.78), bev=0.02))
    for dx in (-0.65, 0.65):
        for dy in (-0.3, 0.3):
            parts.append(cyl(coll, "deskleg", 0.03, 0.78, c.STEEL_D, (6.8 + dx, -3.6 + dy, 0.39)))
    parts.append(box(coll, "donutbox", 0.4, 0.3, 0.1, mat("DonutBox", "#F48FB1", rough=0.7), (6.5, -3.6, 0.87)))
    parts.append(Part(coll, "mug", bm_cyl(0.05, 0.05, 0.11, 10), mat("Mug", "#ECEFF1", rough=0.5), loc=(7.15, -3.55, 0.88)))
    parts.append(box(coll, "chair", 0.5, 0.5, 0.06, c.STEEL_D, (6.8, -3.0, 0.46)))
    parts.append(box(coll, "chairback", 0.5, 0.06, 0.55, c.STEEL_D, (6.8, -2.76, 0.75)))
    for dx in (-0.2, 0.2):
        for dy in (-0.2, 0.2):
            parts.append(cyl(coll, "chairleg", 0.02, 0.46, c.STEEL, (6.8 + dx, -3.0 + dy, 0.23)))
    parts.append(box(coll, "vent", 0.9, 0.9, 0.02, c.STEEL_D, (3.4, -2.0, 0.011)))
    for i in range(6):
        parts.append(box(coll, "ventslat", 0.86, 0.04, 0.025, c.STEEL, (3.4, -2.35 + i * 0.14, 0.024)))
    parts.append(box(coll, "exitframe", 0.2, 1.6, 2.5, c.STEEL_D, (10.86, -2.4, 1.25)))
    parts.append(box(coll, "exitdoor", 0.14, 1.3, 2.25, c.DOOR, (10.82, -2.4, 1.13)))
    parts.append(box(coll, "exitsign", 0.1, 0.9, 0.3, c.EXIT, (10.82, -2.4, 2.72)))
    parts.append(text(coll, "exittxt", "EXIT", 0.22, c.WHITE, (10.75, -2.4, 2.71), rot=(math.pi / 2, 0, -math.pi / 2), extrude=0.01))
    # a WANTED board on the corridor end wall
    parts.append(box(coll, "board", 0.06, 1.8, 1.1, mat("Cork", "#C49A6C", rough=0.9), (-10.82, -2.2, 1.6)))
    bake(parts, "LawCell_body", coll, parent=root)

    # the swinging gate: hinge at x = -0.58 (origin), opens toward the corridor
    gate = []
    for i in range(4):
        gate.append(cyl(coll, "gbar", 0.03, CH - 0.2, c.STEEL, (-0.45 + i * 0.3, 0, CH / 2), segs=8))
    for z in (0.18, 1.6, CH - 0.18):
        gate.append(box(coll, "grail", 1.14, 0.07, 0.07, c.STEEL_D, (0, 0, z)))
    gate.append(box(coll, "lockbox", 0.22, 0.16, 0.26, c.STEEL_D, (0.42, -0.06, 1.25), bev=0.02))
    gate.append(Part(coll, "padlock", bm_torus(0.07, 0.02, 12, 5), mat("Brass", "#C9A227", rough=0.3, metal=0.8), loc=(0.42, -0.16, 1.18), rot=(math.pi / 2, 0, 0)))
    gate.append(box(coll, "padbody", 0.16, 0.08, 0.13, mat("Brass", "#C9A227", rough=0.3, metal=0.8), (0.42, -0.16, 1.08), bev=0.02))
    bake_at(gate, "Gate", coll, root, (-0.58, 0, 0))
    return coll


# ── the booking room ─────────────────────────────────────────────────────
def build_booking():
    c = P()
    coll = scene_coll("LawBooking")
    root = root_empty(coll, "LawBooking")
    parts = [
        box(coll, "floor", 9, 7, 0.1, c.FLOOR, (0, 1.0, -0.05)),
        box(coll, "wall", 9, 0.2, 3.4, mat("BookingWall", "#6F7C8A", rough=0.9), (0, 3.0, 1.7)),
        box(coll, "sideL", 0.2, 7, 3.4, mat("BookingWall", "#6F7C8A", rough=0.9), (-4.5, 1.0, 1.7)),
        box(coll, "sideR", 0.2, 7, 3.4, mat("BookingWall", "#6F7C8A", rough=0.9), (4.5, 1.0, 1.7)),
        box(coll, "chart", 1.8, 0.04, 2.5, mat("ChartGrey", "#B7C2CC", rough=0.8), (0, 2.88, 1.3)),
    ]
    INK = mat("ChartInk", "#2E3740", rough=0.7)
    for ft in range(8):
        z = 0.05 + ft * 0.3048
        if z > 2.5:
            break
        parts.append(box(coll, "tick", 1.8, 0.02, 0.025, INK, (0, 2.85, z)))
        parts.append(text(coll, "ftxt", "%d'" % ft, 0.12, INK, (-0.78, 2.84, z + 0.08), extrude=0.004))
        if ft < 7:
            parts.append(box(coll, "half", 0.3, 0.02, 0.015, INK, (-0.75, 2.85, z + 0.1524)))
            parts.append(box(coll, "half", 0.3, 0.02, 0.015, INK, (0.75, 2.85, z + 0.1524)))
    parts.append(text(coll, "deptTxt", "CITY POLICE · BOOKING", 0.2, c.WHITE, (0, 2.88, 2.95), extrude=0.004))
    # the camera on its tripod (stage left)
    parts.append(box(coll, "cambody", 0.36, 0.26, 0.26, c.BLACK, (2.4, -0.6, 1.45), bev=0.03))
    parts.append(cyl(coll, "lens", 0.09, 0.22, c.STEEL_D, (2.33, -0.42, 1.45), axis="Y", rot=(0, 0, 0.15)))
    parts.append(cyl(coll, "lensglass", 0.07, 0.02, mat("Lens", "#4FC3F7", rough=0.1), (2.31, -0.3, 1.45), axis="Y", rot=(0, 0, 0.15)))
    for a in (0, 2.1, 4.2):
        parts.append(limb(coll, "leg", (2.4, -0.6, 1.3), (2.4 + math.cos(a) * 0.4, -0.6 + math.sin(a) * 0.4, 0.0), 0.02, c.STEEL_D))
    parts.append(box(coll, "flashArm", 0.06, 0.06, 0.3, c.STEEL_D, (2.4, -0.6, 1.72)))
    parts.append(box(coll, "flashBox", 0.3, 0.12, 0.16, c.STEEL_D, (2.4, -0.62, 1.92)))
    # booking desk + ink pad (stage right, foreground)
    parts.append(box(coll, "desk", 1.8, 0.8, 0.9, c.WOOD, (-2.6, -0.4, 0.45), bev=0.03))
    parts.append(box(coll, "desktop", 1.9, 0.9, 0.06, c.WOOD_D, (-2.6, -0.4, 0.93)))
    parts.append(box(coll, "inkpad", 0.3, 0.2, 0.04, c.STEEL_D, (-2.3, -0.4, 0.98)))
    parts.append(box(coll, "papers", 0.3, 0.4, 0.02, c.PILLOW, (-2.9, -0.35, 0.97), rot=(0, 0, 0.2)))
    parts.append(box(coll, "lamp", 0.5, 0.16, 0.06, c.BULB, (0, 0.6, 3.3)))
    bake(parts, "LawBooking_body", coll, parent=root)
    # the flash bulb is its own object so the game can pop it
    fl = [Part(coll, "flash", bm_box(0.24, 0.04, 0.11), mat("Flash", "#FFFDE7", rough=0.2, emit=0.6), loc=(2.4, -0.69, 1.92))]
    bake(fl, "Flash", coll, parent=root)
    return coll


# ── the courtroom ────────────────────────────────────────────────────────
def build_court():
    c = P()
    coll = scene_coll("LawCourt")
    root = root_empty(coll, "LawCourt")
    RW, RD, RH = 17.0, 20.0, 6.4        # room x -8.5..8.5, y -12..8
    y0, y1 = -12.0, 8.0
    cy = (y0 + y1) / 2
    parts = [
        box(coll, "floor", RW, RD, 0.12, mat("Parquet", "#9C6B43", rough=0.7), (0, cy, -0.06)),
        box(coll, "ceiling", RW, RD, 0.2, c.PLASTER, (0, cy, RH + 0.1)),
        box(coll, "back", RW, 0.3, RH, c.PLASTER, (0, y1 + 0.15, RH / 2)),
        box(coll, "front", RW, 0.3, RH, c.PLASTER, (0, y0 - 0.15, RH / 2)),
        box(coll, "carpet", 2.0, 11.0, 0.02, c.CARPET, (0, -6.2, 0.01)),
        box(coll, "well", 12.0, 6.6, 0.015, mat("WellRug", "#2F4F6F", rough=0.95), (0, 3.2, 0.008)),
    ]
    for s in (-1, 1):
        parts.append(box(coll, "side", 0.3, RD, RH, c.PLASTER, (s * (RW / 2 + 0.15), cy, RH / 2)))
        parts.append(box(coll, "wainscot", 0.32, RD, 1.25, c.WOOD_D, (s * (RW / 2 + 0.14), cy, 0.62)))
        parts.append(box(coll, "crown", 0.4, RD, 0.25, c.WOOD_D, (s * (RW / 2 + 0.1), cy, RH - 0.12)))
    parts.append(box(coll, "backwain", RW, 0.32, 2.2, c.WOOD, (0, y1 + 0.14, 1.1)))
    for i in range(7):   # vertical panels on the back wall
        parts.append(box(coll, "panel", 1.8, 0.05, 1.6, c.WOOD_L, (-6.6 + i * 2.2, y1 - 0.03, 1.2)))
    # tall windows on the left wall (daylight)
    for y in (-8.5, -4.0, 0.5, 5.0):
        parts.append(box(coll, "winframe", 0.2, 1.9, 3.6, c.WOOD_D, (-RW / 2 + 0.05, y, 3.3)))
        parts.append(box(coll, "win", 0.22, 1.6, 3.3, c.SKYWIN, (-RW / 2 + 0.06, y, 3.3)))
        parts.append(box(coll, "mullion", 0.25, 0.08, 3.3, c.WOOD_D, (-RW / 2 + 0.08, y, 3.3)))
        parts.append(box(coll, "transom", 0.25, 1.6, 0.08, c.WOOD_D, (-RW / 2 + 0.08, y, 3.9)))
    # pendant lamps
    for y in (-7.0, -1.5, 4.0):
        for x in (-4.0, 4.0):
            parts.append(cyl(coll, "rod", 0.02, 1.4, c.STEEL_D, (x, y, RH - 0.7)))
            parts.append(Part(coll, "globe", bm_sphere(0.32, 0.32, 0.26), mat("Globe", "#FFF1C9", rough=0.3, emit=2.2), loc=(x, y, RH - 1.5)))
    # ── the bench (judge) ──
    BY = 6.4
    parts.append(box(coll, "dais", 7.4, 2.8, 0.45, c.WOOD_D, (0, BY + 0.2, 0.225)))
    parts.append(box(coll, "bench", 5.0, 1.1, 1.75, c.WOOD, (0, BY - 0.35, 0.45 + 0.875), bev=0.04))
    parts.append(box(coll, "benchtop", 5.3, 1.35, 0.1, c.WOOD_D, (0, BY - 0.35, 2.25), bev=0.02))
    parts.append(box(coll, "benchfront", 4.4, 0.06, 1.2, c.WOOD_L, (0, BY - 0.92, 1.3)))
    parts.append(box(coll, "benchplate", 1.6, 0.05, 0.3, c.GOLD, (0, BY - 0.96, 1.95)))
    parts.append(box(coll, "chairback", 1.1, 0.25, 2.2, mat("Leather", "#4A2321", rough=0.55), (0, BY + 0.75, 0.45 + 1.4), bev=0.12))
    # the seal of the court
    parts.append(cyl(coll, "seal", 1.1, 0.12, c.GOLD, (0, y1 - 0.08, 4.4), segs=32, axis="Y"))
    parts.append(cyl(coll, "sealin", 0.85, 0.14, mat("SealBlue", "#22396B", rough=0.5), (0, y1 - 0.1, 4.4), segs=32, axis="Y"))
    parts.append(text(coll, "sealtxt", "⚖", 0.9, c.GOLD, (0, y1 - 0.2, 4.35), extrude=0.03))
    parts.append(text(coll, "motto", "IN JUSTICE WE TRUST (MOSTLY)", 0.26, c.GOLD, (0, y1 - 0.08, 5.85), extrude=0.01))
    # flags
    for s, col in ((-1, "#1E3A8A"), (1, "#7A1F2B")):
        parts.append(cyl(coll, "flagpole", 0.045, 3.6, c.GOLD, (s * 3.2, BY + 0.6, 2.25)))
        parts.append(Part(coll, "eagle", bm_sphere(0.12), c.GOLD, loc=(s * 3.2, BY + 0.6, 4.1)))
        parts.append(box(coll, "flag", 0.05, 1.0, 1.6, mat("Flag%d" % (s + 1), col, rough=0.8), (s * 3.2, BY + 0.6 + 0.0, 3.1), rot=(0, 0, s * 0.9)))
        parts.append(cyl(coll, "flagbase", 0.25, 0.12, c.GOLD, (s * 3.2, BY + 0.6, 0.51)))
    # ── witness stand (right of the bench) + clerk (left) ──
    parts.append(box(coll, "witness", 1.6, 1.4, 1.15, c.WOOD, (3.9, 4.6, 0.575), bev=0.03))
    parts.append(box(coll, "witnesstop", 1.75, 1.55, 0.08, c.WOOD_D, (3.9, 4.6, 1.19)))
    parts.append(box(coll, "witnessstep", 1.6, 0.4, 0.3, c.WOOD_D, (3.9, 3.75, 0.15)))
    parts.append(cyl(coll, "mic", 0.015, 0.4, c.STEEL_D, (3.6, 4.0, 1.4)))
    parts.append(Part(coll, "micball", bm_sphere(0.05), c.BLACK, loc=(3.6, 4.0, 1.62)))
    parts.append(box(coll, "clerk", 2.0, 0.9, 1.0, c.WOOD, (-4.0, 4.6, 0.5), bev=0.03))
    parts.append(box(coll, "clerktop", 2.1, 1.0, 0.07, c.WOOD_D, (-4.0, 4.6, 1.03)))
    parts.append(box(coll, "steno", 0.4, 0.3, 0.12, c.BLACK, (-4.0, 4.4, 1.12)))
    # ── jury box (right wall) ──
    JX = 6.6
    parts.append(box(coll, "juryrail", 0.12, 5.6, 1.0, c.WOOD, (JX - 1.75, 1.0, 0.5), bev=0.02))
    parts.append(box(coll, "juryfront", 3.5, 0.12, 1.0, c.WOOD, (JX - 0.0, -1.8, 0.5)))
    parts.append(box(coll, "jurybackrow", 1.6, 5.6, 0.45, c.WOOD_D, (JX + 0.8, 1.0, 0.225)))
    for row, (x, z) in enumerate(((JX - 0.75, 0.0), (JX + 0.8, 0.45))):
        for i in range(4):
            y = -0.9 + i * 1.3
            parts.append(box(coll, "jseat", 0.55, 0.55, 0.08, mat("JuryLeather", "#2E5E4E", rough=0.6), (x, y, z + 0.48)))
            parts.append(box(coll, "jback", 0.1, 0.55, 0.6, mat("JuryLeather", "#2E5E4E", rough=0.6), (x + 0.3, y, z + 0.8)))
    # ── counsel tables ──
    for s in (-1, 1):
        tx = s * 2.6
        parts.append(box(coll, "table", 2.9, 1.1, 0.07, c.WOOD_D, (tx, 1.6, 0.8), bev=0.02))
        parts.append(box(coll, "modesty", 2.8, 0.05, 0.6, c.WOOD, (tx, 2.1, 0.45)))
        for dx in (-1.3, 1.3):
            parts.append(box(coll, "tleg", 0.08, 1.0, 0.76, c.WOOD_D, (tx + dx, 1.6, 0.38)))
        parts.append(box(coll, "folder", 0.35, 0.28, 0.03, mat("Folder", "#E8C77A", rough=0.8), (tx - 0.5, 1.5, 0.85), rot=(0, 0, 0.15)))
        parts.append(cyl(coll, "glass", 0.04, 0.12, mat("Water", "#BFE6FF", rough=0.05), (tx + 0.6, 1.4, 0.9)))
        for dx in (-0.65, 0.65):
            parts.append(box(coll, "cseat", 0.5, 0.5, 0.07, mat("Leather", "#4A2321", rough=0.55), (tx + dx, 0.75, 0.48)))
            parts.append(box(coll, "cback", 0.5, 0.08, 0.6, mat("Leather", "#4A2321", rough=0.55), (tx + dx, 0.5, 0.82)))
            parts.append(cyl(coll, "cleg", 0.03, 0.45, c.STEEL_D, (tx + dx, 0.75, 0.22)))
    # ── the bar (rail + gate) ──
    for s in (-1, 1):
        parts.append(box(coll, "barrail", 6.6, 0.12, 0.08, c.WOOD_D, (s * 4.3, -1.3, 1.0)))
        parts.append(box(coll, "barbase", 6.6, 0.16, 0.12, c.WOOD_D, (s * 4.3, -1.3, 0.06)))
        for i in range(17):
            parts.append(cyl(coll, "baluster", 0.035, 0.92, c.WOOD_L, (s * (1.2 + i * 0.4), -1.3, 0.5), segs=8))
    # ── gallery benches ──
    for row in range(5):
        y = -3.0 - row * 1.7
        for s in (-1, 1):
            bx = s * 4.4
            parts.append(box(coll, "pew", 5.8, 0.5, 0.08, c.WOOD, (bx, y, 0.48), bev=0.02))
            parts.append(box(coll, "pewback", 5.8, 0.08, 0.7, c.WOOD, (bx, y - 0.28, 0.85), bev=0.02))
            for dx in (-2.8, 2.8):
                parts.append(box(coll, "pewend", 0.1, 0.6, 1.05, c.WOOD_D, (bx + dx, y - 0.05, 0.52)))
    # doors at the back of the gallery
    for s in (-1, 1):
        parts.append(box(coll, "gdoor", 1.4, 0.12, 2.8, c.WOOD_D, (s * 6.0, y0 + 0.06, 1.4)))
        parts.append(Part(coll, "gknob", bm_sphere(0.06), c.GOLD, loc=(s * 6.0 - s * 0.5, y0 + 0.16, 1.3)))
    bake(parts, "LawCourt_body", coll, parent=root)

    # the gavel (pivot at the end of the handle, resting on the bench)
    gv = [cyl(coll, "ghandle", 0.03, 0.42, c.WOOD_D, (0.21, 0, 0), axis="X"),
          cyl(coll, "ghead", 0.075, 0.24, c.WOOD_D, (0.44, 0, 0), axis="Y"),
          cyl(coll, "gband", 0.078, 0.04, c.GOLD, (0.44, -0.06, 0), axis="Y"),
          cyl(coll, "gband2", 0.078, 0.04, c.GOLD, (0.44, 0.06, 0), axis="Y")]
    g = bake_at(gv, "Gavel", coll, root, (0, 0, 0))
    g.location = (0.55, BY - 0.55, 2.38)
    blk = [cyl(coll, "block", 0.13, 0.06, c.WOOD_D, (1.0, BY - 0.55, 2.33), segs=16)]
    bake(blk, "SoundBlock", coll, parent=root)
    return coll


# ── props ────────────────────────────────────────────────────────────────
def build_billboard():
    c = P()
    coll = scene_coll("LawBillboard")
    root = root_empty(coll, "LawBillboard")
    parts = []
    for x in (-2.0, 2.0):
        parts.append(box(coll, "post", 0.32, 0.32, 3.4, c.WOOD_D, (x, 0.25, 1.7)))
        parts.append(limb(coll, "brace", (x, 0.25, 2.2), (x, 1.4, 0.0), 0.07, c.WOOD_D))
    parts.append(box(coll, "frame", 6.4, 0.25, 3.3, mat("BillboardFrame", "#ECEFF1", rough=0.6), (0, 0.18, 4.75)))
    parts.append(box(coll, "catwalk", 6.0, 0.6, 0.06, c.STEEL_D, (0, -0.35, 3.05)))
    for x in (-2.6, 0.0, 2.6):
        parts.append(cyl(coll, "lampstem", 0.03, 0.6, c.STEEL_D, (x, -0.55, 6.55), axis="Y"))
        parts.append(box(coll, "lamp", 0.4, 0.2, 0.12, c.STEEL_D, (x, -0.85, 6.55)))
    bake(parts, "LawBillboard_body", coll, parent=root)
    face = [box(coll, "face", 6.0, 0.02, 2.9, mat("BillboardFace", "#FFFFFF", rough=0.7), (0, 0.04, 4.75))]
    bake(face, "Face", coll, parent=root)
    return coll


def build_chopper():
    c = P()
    coll = scene_coll("LawChopper")
    root = root_empty(coll, "LawChopper")
    HULL = mat("ChopperHull", "#1C2733", rough=0.35, metal=0.4)
    BAND = mat("ChopperBand", "#F4F6F8", rough=0.5)
    COCK = mat("GlassTint", "#2B3A42", rough=0.08, metal=0.2)
    parts = [
        Part(coll, "hull", bm_sphere(1.15, 2.2, 1.05), HULL, loc=(0, 0, 1.6)),
        Part(coll, "cockpit", bm_sphere(1.0, 1.25, 0.85), COCK, loc=(0, -1.25, 1.75)),
        Part(coll, "band", bm_sphere(1.2, 1.55, 0.34), BAND, loc=(0, 0.3, 1.55)),
        limb(coll, "boom", (0, 1.8, 1.9), (0, 6.2, 2.3), 0.26, HULL),
        box(coll, "fin", 0.1, 0.9, 1.3, HULL, (0, 6.2, 2.8), rot=(-0.35, 0, 0), bev=0.04),
        box(coll, "stab", 1.6, 0.4, 0.08, HULL, (0, 5.7, 2.25), bev=0.03),
        cyl(coll, "mast", 0.14, 0.5, c.STEEL_D, (0, 0, 2.75)),
    ]
    for s in (-1, 1):
        parts.append(limb(coll, "skid", (s * 0.95, -1.6, 0.12), (s * 0.95, 1.5, 0.12), 0.06, c.STEEL_D))
        parts.append(limb(coll, "strut", (s * 0.95, -0.8, 0.12), (s * 0.6, -0.6, 0.9), 0.05, c.STEEL_D))
        parts.append(limb(coll, "strut", (s * 0.95, 0.8, 0.12), (s * 0.6, 0.7, 0.9), 0.05, c.STEEL_D))
        parts.append(text(coll, "police", "POLICE", 0.42, mat("ChopperText", "#0D1B5E", rough=0.5), (s * 1.21, 0.3, 1.55),
                          rot=(math.pi / 2, 0, s * math.pi / 2), extrude=0.01))
    parts.append(Part(coll, "red", bm_sphere(0.13), mat("LightRed", "#FF1744", rough=0.3, emit=3.0), loc=(-0.6, 0.6, 0.62)))
    parts.append(Part(coll, "blue", bm_sphere(0.13), mat("LightBlue", "#2979FF", rough=0.3, emit=3.0), loc=(0.6, 0.6, 0.62)))
    parts.append(cyl(coll, "spot", 0.22, 0.3, c.STEEL_D, (0, -1.5, 0.72)))
    parts.append(cyl(coll, "spotlens", 0.18, 0.04, mat("Searchlight", "#FFFBE0", rough=0.2, emit=5.0), (0, -1.5, 0.56)))
    bake(parts, "LawChopper_body", coll, parent=root)
    RZ = 3.05
    rot = [cyl(coll, "hub", 0.22, 0.18, c.STEEL_D, (0, 0, RZ))]
    for k in range(4):
        a = k * math.pi / 2
        rot.append(box(coll, "blade", 5.2, 0.32, 0.05, mat("Blade", "#2A2F35", rough=0.5), (math.cos(a) * 2.6, math.sin(a) * 2.6, RZ + 0.05), rot=(0, 0, a)))
    bake_at(rot, "Rotor", coll, root, (0, 0, RZ))
    tp = (0.22, 6.3, 2.8)
    rot = [cyl(coll, "thub", 0.08, 0.12, c.STEEL_D, tp, axis="X")]
    for k in range(2):
        rot.append(box(coll, "tblade", 0.04, 0.16, 1.4, mat("Blade", "#2A2F35", rough=0.5), (tp[0] + 0.06, tp[1], tp[2]), rot=(k * math.pi / 2, 0, 0)))
    bake_at(rot, "TailRotor", coll, root, tp)
    return coll


def build_k9():
    coll = scene_coll("LawK9")
    root = root_empty(coll, "LawK9")
    TAN = mat("Fur", "#B08A63", rough=0.9)
    SADDLE = mat("FurDark", "#2E2320", rough=0.9)
    VEST = mat("Vest", "#1A237E", rough=0.7)
    BADGE = mat("Badge", "#FFD54F", rough=0.3, metal=0.8)
    EYE = mat("Eye", "#FFEB3B", rough=0.3, emit=0.6)
    NOSE = mat("Nose", "#111111", rough=0.4)
    body = [
        Part(coll, "torso", bm_sphere(0.2, 0.42, 0.21), TAN, loc=(0, 0, 0.55)),
        Part(coll, "saddle", bm_sphere(0.205, 0.36, 0.15), SADDLE, loc=(0, 0.05, 0.64)),
        Part(coll, "vest", bm_cyl(0.215, 0.215, 0.32, 14, "Y"), VEST, loc=(0, -0.08, 0.56)),
        Part(coll, "badge", bm_sphere(0.05, 0.02, 0.05), BADGE, loc=(0.2, -0.1, 0.6)),
        Part(coll, "neck", bm_sphere(0.13, 0.16, 0.16), TAN, loc=(0, -0.38, 0.7)),
    ]
    bake(body, "Body", coll, parent=root)
    hp = (0, -0.5, 0.82)
    at = lambda x, y, z: (hp[0] + x, hp[1] + y, hp[2] + z)
    head = [
        Part(coll, "head", bm_sphere(0.14, 0.16, 0.13), TAN, loc=at(0, 0, 0)),
        Part(coll, "snout", bm_sphere(0.075, 0.14, 0.07), SADDLE, loc=at(0, -0.17, -0.04)),
        Part(coll, "nose", bm_sphere(0.035), NOSE, loc=at(0, -0.3, -0.02)),
        Part(coll, "teeth", bm_box(0.08, 0.02, 0.025), mat("Teeth", "#FFFFFF", rough=0.4), loc=at(0, -0.26, -0.085)),
    ]
    for s in (-1, 1):
        head.append(Part(coll, "ear", bm_cyl(0.05, 0.0, 0.16, 6), SADDLE, loc=at(s * 0.08, 0.03, 0.15), rot=(0.25, s * 0.25, 0)))
        head.append(Part(coll, "eye", bm_sphere(0.022), EYE, loc=at(s * 0.06, -0.12, 0.04)))
    bake_at(head, "Head", coll, root, hp)
    for nm, x, y in (("Leg_FL", 0.11, -0.28), ("Leg_FR", -0.11, -0.28), ("Leg_BL", 0.11, 0.3), ("Leg_BR", -0.11, 0.3)):
        leg = [Part(coll, nm + "_l", bm_cyl(0.045, 0.035, 0.42, 8), TAN if y < 0 else SADDLE, loc=(x, y, 0.27)),
               Part(coll, nm + "_p", bm_sphere(0.05, 0.065, 0.035), TAN, loc=(x, y - 0.02, 0.04))]
        bake_at(leg, nm, coll, root, (x, y, 0.5))
    tail = [limb(coll, "tail", (0, 0.4, 0.62), (0, 0.72, 0.82), 0.04, SADDLE)]
    bake_at(tail, "Tail", coll, root, (0, 0.4, 0.62))
    return coll


def build_missile():
    coll = scene_coll("LawMissile")
    root = root_empty(coll, "LawMissile")
    NAVY = mat("MissileBody", "#1A237E", rough=0.4, metal=0.3)
    parts = [
        cyl(coll, "body", 0.13, 1.2, NAVY, (0, 0, 0), segs=14, axis="Y"),
        Part(coll, "nose", bm_cyl(0.13, 0.0, 0.36, 14, "Y"), mat("MissileNose", "#B71C1C", rough=0.4), loc=(0, -0.78, 0), rot=(0, 0, math.pi)),
        cyl(coll, "red", 0.135, 0.1, mat("StripeRed", "#D32F2F", rough=0.5), (0, -0.25, 0), segs=14, axis="Y"),
        cyl(coll, "blue", 0.135, 0.1, mat("StripeBlue", "#1565C0", rough=0.5), (0, -0.12, 0), segs=14, axis="Y"),
        Part(coll, "eye", bm_sphere(0.04), mat("LightRed", "#FF1744", rough=0.3, emit=4.0), loc=(0, -0.86, 0.06)),
        cyl(coll, "nozzle", 0.1, 0.12, mat("SteelDark", "#3B4148", rough=0.4, metal=0.7), (0, 0.64, 0), segs=12, axis="Y"),
    ]
    for k in range(4):
        a = k * math.pi / 2
        parts.append(box(coll, "fin", 0.03, 0.3, 0.22, NAVY, (math.cos(a) * 0.2, 0.45, math.sin(a) * 0.2), rot=(0, a, 0)))
    bake(parts, "LawMissile_body", coll, parent=root)
    return coll


def build_cart():
    c = P()
    coll = scene_coll("LawCart")
    root = root_empty(coll, "LawCart")
    parts = [
        box(coll, "base", 0.7, 1.2, 0.08, c.STEEL, (0, 0, 0.28), bev=0.02),
        box(coll, "mid", 0.7, 1.2, 0.05, c.STEEL, (0, 0, 0.62), bev=0.02),
        box(coll, "top", 0.74, 1.24, 0.05, c.STEEL, (0, 0, 0.95), bev=0.02),
        cyl(coll, "pot", 0.2, 0.28, c.STEEL_D, (0, -0.25, 1.12), segs=16),
        box(coll, "tray", 0.4, 0.5, 0.04, mat("Tray", "#90A4AE", rough=0.5), (0, 0.3, 0.99)),
        Part(coll, "slop", bm_sphere(0.1, 0.1, 0.05), mat("MysteryMeat", "#8D6E63", rough=0.8), loc=(0, 0.3, 1.03)),
        Part(coll, "pudding", bm_cyl(0.06, 0.05, 0.07, 10), mat("Pudding", "#F2C45A", rough=0.5), loc=(0.15, 0.45, 1.04)),
        limb(coll, "handle", (-0.33, 0.62, 0.95), (0.33, 0.62, 0.95), 0.02, c.STEEL_D),
    ]
    for dx in (-0.31, 0.31):
        for dy in (-0.56, 0.56):
            parts.append(cyl(coll, "post", 0.02, 0.7, c.STEEL, (dx, dy, 0.6)))
            parts.append(cyl(coll, "wheel", 0.07, 0.04, c.TIRE, (dx, dy, 0.07), axis="X"))
    bake(parts, "LawCart_body", coll, parent=root)
    return coll


# ── people ───────────────────────────────────────────────────────────────
def build_judge():
    # the distractible, hungry, eternally-late-for-golf judge: black robe, white jabot, grey hair
    return build_person("LawJudge", dict(hair="short", hair_color="#C9CCD1", top="#15151A", bottom="dress", shoes="#111111",
                        width=1.15, extras=["glasses", "mustache", "bowtie", "belly"],
                        extra_colors={"Tie": "#F5F5F5", "Beard": "#C9CCD1", "Glasses": "#B08D57"}))


def build_prosecutor():
    return build_person("LawProsecutor", dict(hair="short", hair_color="#1A1A1A", top="#37474F", bottom="pants",
                        bottom_color="#263238", shoes="#111111", extras=["tie", "sunglasses_up"],
                        extra_colors={"Tie": "#C62828", "Shades": "#222222"}))


def build_lawyer():
    # recoloured per tier at runtime (Top / Bottom / Tie)
    return build_person("LawLawyer", dict(hair="short", hair_color="#6D4C41", top="#5D4037", bottom="pants",
                        bottom_color="#3E2723", shoes="#1A1A1A", extras=["tie", "glasses"],
                        extra_colors={"Tie": "#FFD54F"}))


def build_cellmate():
    return build_person("LawCellmate", dict(hair="bald", skin="#E0A878", top="#FF7043", bottom="pants", bottom_color="#FF7043",
                        shoes="#ECEFF1", width=1.22, sleeves="short", extras=["beard", "belly"],
                        extra_colors={"Beard": "#5D4037"}))


def build_abba():
    # Lulu's dad (passed the bar "years ago, for fun"): black kippah, salt-and-pepper beard, white shirt
    return build_person("LawAbba", dict(hair="short", hair_color="#4E4A47", top="#FAFAFA", bottom="pants",
                        bottom_color="#1F1F24", shoes="#111111", width=1.12, extras=["beard", "kippah", "glasses", "tzitzit", "belly"],
                        extra_colors={"Beard": "#6E6A66", "Kippah": "#111111", "Glasses": "#222222"}))


ASSETS = [
    ("law_station", build_station),
    ("law_cell", build_cell),
    ("law_booking", build_booking),
    ("law_court", build_court),
    ("law_billboard", build_billboard),
    ("law_chopper", build_chopper),
    ("law_k9", build_k9),
    ("law_missile", build_missile),
    ("law_cart", build_cart),
    ("law_judge", build_judge),
    ("law_prosecutor", build_prosecutor),
    ("law_lawyer", build_lawyer),
    ("law_cellmate", build_cellmate),
    ("law_abba", build_abba),
]
