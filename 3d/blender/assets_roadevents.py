"""
Road events & hazards (feature "roadevents"): toll plaza, railroad crossing +
train, ice-cream truck / stand, drive-thru, construction (cones, barricades,
arrow board, the commandeerable steamroller, potholes), school bus, ambulance,
animals (duck, raccoon, ostrich), billboards, crowd barriers, pickups, and the
roadside people (road worker / crossing guard, hitchhiker, food vendor).

Conventions (see 3d/ARCHITECTURE.md): metres, FRONT = Blender -Y, Blender +X =
the model's LEFT (= the road's left when placed with rotation.y = heading).
Every file is prefixed roadevents_ so it never collides with another feature.
"""
from lib import *
from lib_people import build_person


def setup():
    global S
    S = shared()


def stripes(coll, name, x0, x1, y, z, h, d, cols, n, axis="X"):
    """A bar made of n alternating coloured blocks from x0 to x1 (along X)."""
    parts = []
    step = (x1 - x0) / n
    for i in range(n):
        c = cols[i % len(cols)]
        cx = x0 + step * (i + 0.5)
        parts.append(Part(coll, name, bm_box(abs(step) * 1.001, d, h), c, loc=(cx, y, z), smooth=False))
    return parts


def bm_text_lo(body, size, extrude=0.0):
    """Low-poly text (lib.bm_text with a coarse curve resolution, no sides)."""
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = body
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.extrude = extrude
    cu.resolution_u = 2
    cu.fill_mode = "BOTH" if extrude > 0 else "FRONT"
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


def text(coll, body, size, m, loc, face="-Y", extrude=0.0):
    rot = {"-Y": (math.pi / 2, 0, 0), "+Y": (math.pi / 2, 0, math.pi),
           "+X": (math.pi / 2, 0, math.pi / 2), "-X": (math.pi / 2, 0, -math.pi / 2), "+Z": (0, 0, 0)}[face]
    return Part(coll, "txt", bm_text_lo(body, size, extrude), m, loc=loc, rot=rot, smooth=False)


def octagon(r, depth):
    """An octagon prism lying in the XZ plane (faces +-Y), like a STOP sign."""
    pts = [(math.cos(math.pi / 8 + i * math.pi / 4) * r, math.sin(math.pi / 8 + i * math.pi / 4) * r) for i in range(8)]
    bm = bmesh.new()
    front = [bm.verts.new((x, -depth / 2, z)) for (x, z) in pts]
    back = [bm.verts.new((x, depth / 2, z)) for (x, z) in pts]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for i in range(8):
        j = (i + 1) % 8
        bm.faces.new((front[i], back[i], back[j], front[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


# ═════════════════════════════════ construction ═════════════════════════════
def build_cone():
    coll = scene_coll("ReCone")
    root = root_empty(coll, "ReCone")
    OR = mat("ConeOrange", "#FF6D00", rough=0.55)
    WH = mat("ConeWhite", "#FAFAFA", rough=0.5)
    BK = mat("ConeBase", "#212121", rough=0.8)
    parts = [Part(coll, "base", bm_box(0.46, 0.46, 0.05), BK, loc=(0, 0, 0.025)).bevel(0.04, 2),
             Part(coll, "body", bm_cyl(0.18, 0.035, 0.68, 14), OR, loc=(0, 0, 0.39)),
             Part(coll, "band1", bm_cyl(0.142, 0.122, 0.09, 14), WH, loc=(0, 0, 0.31)),
             Part(coll, "band2", bm_cyl(0.096, 0.078, 0.08, 14), WH, loc=(0, 0, 0.5))]
    bake(parts, "Cone", coll, parent=root)
    return coll


def build_barrier():
    """Sawhorse barricade with orange/white boards and a blinking amber lamp."""
    coll = scene_coll("ReBarrier")
    root = root_empty(coll, "ReBarrier")
    OR = mat("BarOrange", "#FF6D00", rough=0.5)
    WH = mat("BarWhite", "#FAFAFA", rough=0.5)
    LEG = mat("BarLeg", "#ECEFF1", rough=0.6)
    AMB = mat("NeonAmber", "#FFB300", rough=0.3, emit=2.5)
    parts = []
    for x in (-0.72, 0.72):
        for s in (-1, 1):
            parts.append(limb(coll, "leg", (x, s * 0.32, 0), (x, s * 0.05, 1.0), 0.035, LEG))
    for z in (0.62, 0.92):
        parts += stripes(coll, "board", -0.85, 0.85, -0.04, z, 0.2, 0.04, [OR, WH], 8)
    parts.append(Part(coll, "lampBox", bm_box(0.12, 0.1, 0.1), mat("BarDark", "#37474F"), loc=(0.62, -0.04, 1.08)))
    parts.append(Part(coll, "lamp", bm_cyl(0.09, 0.09, 0.06, 12, "Y"), AMB, loc=(0.62, -0.1, 1.18)))
    bake(parts, "Barrier", coll, parent=root)
    return coll


def build_arrowboard():
    """Little trailer with a flashing amber 'merge' arrow (points to +X = road left)."""
    coll = scene_coll("ReArrowBoard")
    root = root_empty(coll, "ReArrowBoard")
    T = S
    BODY = mat("ArrowTrailer", "#FF8F00", rough=0.5)
    BOARD = mat("ArrowBoard", "#1B1B1B", rough=0.7)
    AMB = mat("NeonAmber", "#FFB300", rough=0.3, emit=2.5)
    parts = [Part(coll, "bed", bm_box(1.7, 2.2, 0.35), BODY, loc=(0, 0.2, 0.62)).bevel(0.05, 2),
             Part(coll, "hitch", bm_box(0.1, 1.2, 0.1), T.DARK, loc=(0, -1.4, 0.5)),
             Part(coll, "mast", bm_box(0.16, 0.16, 1.6), T.DARK, loc=(0, 0.3, 1.6)),
             Part(coll, "board", bm_box(2.4, 0.14, 1.25), BOARD, loc=(0, 0.42, 2.7)).bevel(0.04, 2)]
    # arrow made of lamps: shaft along X, head at +X
    dots = [(-0.8 + i * 0.24, 0) for i in range(7)] + [(0.6, 0.24), (0.6, -0.24), (0.42, 0.42), (0.42, -0.42)]
    for (x, z) in dots:
        parts.append(Part(coll, "dot", bm_cyl(0.07, 0.07, 0.04, 10, "Y"), AMB, loc=(x, 0.34, 2.7 + z)))
    bake(parts, "ArrowBoard_body", coll, parent=root)
    for nm, x in (("Wheel_L", 0.86), ("Wheel_R", -0.86)):
        wheel(coll, root, nm, (x, 0.4, 0.32), 0.32, 0.2, T.TIRE, T.RIM, T.TIRE)
    return coll


def build_pothole():
    coll = scene_coll("RePothole")
    root = root_empty(coll, "RePothole")
    D = mat("PotholeDark", "#26272B", rough=1.0)
    R = mat("PotholeRim", "#6C7079", rough=1.0)
    parts = [Part(coll, "hole", bm_cyl(0.75, 0.6, 0.03, 16), D, loc=(0, 0, 0.035), smooth=False)]
    for i in range(7):
        a = i / 7 * math.pi * 2 + 0.3
        r = 0.72 + 0.1 * math.sin(i * 2.7)
        parts.append(Part(coll, "chunk", bm_ico(0.09 + 0.04 * (i % 3), 0), R, loc=(math.cos(a) * r, math.sin(a) * r * 0.85, 0.04), smooth=False))
    bake(parts, "Pothole", coll, parent=root)
    return coll


def build_steamroller():
    """The steamroller: big front drum (Wheel_F), rear tyres, yellow body, roll-cage cab."""
    coll = scene_coll("ReSteamroller")
    root = root_empty(coll, "ReSteamroller")
    Y = mat("RollerYellow", "#F9A825", rough=0.45)
    YD = mat("RollerOrange", "#EF6C00", rough=0.5)
    DK = mat("RollerDark", "#37474F", rough=0.6)
    BK = mat("HazardBlack", "#212121", rough=0.6)
    STEEL = mat("DrumSteel", "#90A4AE", rough=0.35, metal=0.6)
    AMB = mat("NeonAmber", "#FFB300", rough=0.3, emit=2.5)
    SEAT = mat("RollerSeat", "#263238", rough=0.8)
    parts = []
    # front yoke over the drum
    for s in (-1, 1):
        parts.append(Part(coll, "yoke", bm_box(0.12, 1.5, 1.1), Y, loc=(s * 1.12, -2.0, 0.95)).bevel(0.04, 2))
    parts.append(Part(coll, "yokeTop", bm_box(2.36, 1.1, 0.22), Y, loc=(0, -2.0, 1.6)).bevel(0.05, 2))
    parts.append(Part(coll, "scraper", bm_box(2.2, 0.08, 0.12), BK, loc=(0, -2.85, 0.45)))
    parts.append(Part(coll, "joint", bm_box(0.6, 0.8, 0.6), DK, loc=(0, -1.15, 1.25)).bevel(0.05, 2))
    # engine body + hazard band
    parts.append(Part(coll, "engine", bm_box(1.9, 2.6, 1.0), Y, loc=(0, 0.75, 1.45)).bevel(0.12, 3))
    parts.append(Part(coll, "grill", bm_box(1.5, 0.06, 0.5), DK, loc=(0, 2.06, 1.45)))
    parts += stripes(coll, "hazard", -0.95, 0.95, 2.08, 1.05, 0.22, 0.05, [BK, Y], 8)
    parts.append(Part(coll, "deck", bm_box(2.0, 1.6, 0.18), YD, loc=(0, -0.1, 1.0)).bevel(0.04, 2))
    # exhaust stack
    parts.append(Part(coll, "stack", bm_cyl(0.08, 0.08, 1.2, 10), DK, loc=(-0.62, 1.4, 2.4)))
    parts.append(Part(coll, "stackCap", bm_cyl(0.11, 0.11, 0.08, 10), BK, loc=(-0.62, 1.4, 3.0)))
    # cab: seat, wheel, roll cage, roof, beacon
    parts.append(Part(coll, "seat", bm_box(0.6, 0.5, 0.18), SEAT, loc=(0, 0.1, 1.55)).bevel(0.05, 2))
    parts.append(Part(coll, "seatBack", bm_box(0.6, 0.14, 0.6), SEAT, loc=(0, 0.38, 1.85), rot=(-0.15, 0, 0)).bevel(0.05, 2))
    parts.append(Part(coll, "console", bm_box(0.5, 0.25, 0.5), DK, loc=(0, -0.62, 1.35)))
    parts.append(Part(coll, "wheelCol", bm_cyl(0.03, 0.03, 0.45, 8), BK, loc=(0, -0.55, 1.75), rot=(0.5, 0, 0)))
    parts.append(Part(coll, "wheelRing", bm_torus(0.17, 0.022), BK, loc=(0, -0.45, 1.98), rot=(-1.0, 0, 0)))
    for x in (-0.85, 0.85):
        for y in (-0.75, 0.55):
            parts.append(Part(coll, "post", bm_box(0.08, 0.08, 1.75), YD, loc=(x, y, 1.95)))
    parts.append(Part(coll, "roof", bm_box(1.95, 1.6, 0.1), Y, loc=(0, -0.1, 2.88)).bevel(0.04, 2))
    parts.append(Part(coll, "beaconBase", bm_cyl(0.13, 0.13, 0.08, 10), BK, loc=(0, -0.1, 2.97)))
    parts.append(Part(coll, "beacon", bm_sphere(0.12, 0.12, 0.14, 10, 8), AMB, loc=(0, -0.1, 3.1)))
    bake(parts, "Steamroller_body", coll, parent=root)
    # front drum (spins): origin at the axle
    drum = [Part(coll, "drum", bm_cyl(0.72, 0.72, 2.08, 22, "X"), STEEL, loc=(0, -2.0, 0.72)),
            Part(coll, "capL", bm_cyl(0.34, 0.34, 2.14, 12, "X"), DK, loc=(0, -2.0, 0.72))]
    for k in range(4):
        drum.append(Part(coll, "seam", bm_box(2.1, 0.04, 1.47), mat("DrumSeam", "#607D8B", rough=0.5), loc=(0, -2.0, 0.72), rot=(k * math.pi / 4, 0, 0)))
    bake_at(drum, "Wheel_F", coll, root, (0, -2.0, 0.72))
    for nm, x in (("Wheel_RL", 0.82), ("Wheel_RR", -0.82)):
        wheel(coll, root, nm, (x, 1.25, 0.62), 0.62, 0.55, S.TIRE, Y, S.TIRE)
    anchor(coll, root, "Anchor_seat", (0, 0.1, 1.62))
    return coll


# ═════════════════════════════════ toll plaza ═══════════════════════════════
def build_toll_booth():
    """Island + booth (window on the -X side, i.e. facing the lane on its RIGHT),
    lane signal (LampRed / LampGreen facing approaching drivers = +Y) and the
    gate post (Anchor_arm) at the downstream end."""
    coll = scene_coll("ReTollBooth")
    root = root_empty(coll, "ReTollBooth")
    CURB = mat("Curb", "#BDBDBD", rough=0.9)
    YEL = mat("CurbYellow", "#FFD600", rough=0.6)
    BK = mat("CurbBlack", "#212121", rough=0.6)
    WALL = mat("BoothWall", "#ECEFF1", rough=0.6)
    ROOF = mat("BoothRoof", "#455A64", rough=0.6)
    TRIM = mat("BoothTrim", "#1E88E5", rough=0.5)
    RED = mat("LampRed", "#FF1744", rough=0.3, emit=2.5)
    GRN = mat("LampGreen", "#00E676", rough=0.3, emit=2.5)
    parts = [Part(coll, "island", bm_box(0.9, 8.0, 0.2), CURB, loc=(0, 0, 0.1)).bevel(0.05, 2)]
    # striped nose at the upstream end (+Y)
    parts += [Part(coll, "nose", bm_box(0.92, 0.25, 0.42), YEL if i % 2 == 0 else BK, loc=(0, 3.9 - i * 0.25, 0.3), smooth=False) for i in range(4)]
    parts.append(Part(coll, "bollard", bm_cyl(0.14, 0.14, 1.0, 12), YEL, loc=(0, 3.4, 0.6)))
    # booth
    parts.append(Part(coll, "booth", bm_box(0.84, 2.1, 2.3), WALL, loc=(0, 0.6, 1.35)).bevel(0.05, 2))
    parts.append(Part(coll, "boothBand", bm_box(0.88, 2.14, 0.18), TRIM, loc=(0, 0.6, 2.25)))
    parts.append(Part(coll, "boothRoof", bm_box(1.2, 2.5, 0.14), ROOF, loc=(0, 0.6, 2.56)).bevel(0.04, 2))
    for s in (-1, 1):
        parts.append(Part(coll, "win", bm_box(0.04, 1.5, 0.9), S.GLASS, loc=(s * 0.43, 0.6, 1.75)))
    parts.append(Part(coll, "winBack", bm_box(0.6, 0.04, 0.8), S.GLASS, loc=(0, 1.66, 1.75)))
    parts.append(Part(coll, "shelf", bm_box(0.25, 0.7, 0.05), ROOF, loc=(-0.52, 0.6, 1.3)))
    # lane signal on a short mast on the roof, lamps facing +Y
    parts.append(Part(coll, "sigMast", bm_cyl(0.05, 0.05, 0.6, 8), BK, loc=(-0.25, 1.7, 2.9)))
    parts.append(Part(coll, "sigBox", bm_box(0.36, 0.22, 0.7), BK, loc=(-0.25, 1.7, 3.45)).bevel(0.04, 2))
    parts.append(Part(coll, "red", bm_cyl(0.12, 0.12, 0.06, 14, "Y"), RED, loc=(-0.25, 1.83, 3.62)))
    parts.append(Part(coll, "green", bm_cyl(0.12, 0.12, 0.06, 14, "Y"), GRN, loc=(-0.25, 1.83, 3.28)))
    # gate post + motor box at the downstream end
    parts.append(Part(coll, "gateBox", bm_box(0.5, 0.45, 0.9), YEL, loc=(-0.1, -3.2, 0.65)).bevel(0.04, 2))
    parts.append(Part(coll, "gateBand", bm_box(0.52, 0.47, 0.12), BK, loc=(-0.1, -3.2, 0.9)))
    bake(parts, "TollBooth", coll, parent=root)
    anchor(coll, root, "Anchor_arm", (-0.38, -3.2, 1.0))
    anchor(coll, root, "Anchor_attendant", (0, 0.6, 0.2))
    return coll


def build_toll_curb():
    coll = scene_coll("ReTollCurb")
    root = root_empty(coll, "ReTollCurb")
    CURB = mat("Curb", "#BDBDBD", rough=0.9)
    YEL = mat("CurbYellow", "#FFD600", rough=0.6)
    BK = mat("CurbBlack", "#212121", rough=0.6)
    parts = [Part(coll, "island", bm_box(0.9, 8.0, 0.2), CURB, loc=(0, 0, 0.1)).bevel(0.05, 2)]
    parts += [Part(coll, "nose", bm_box(0.92, 0.25, 0.42), YEL if i % 2 == 0 else BK, loc=(0, 3.9 - i * 0.25, 0.3), smooth=False) for i in range(4)]
    parts.append(Part(coll, "bollard", bm_cyl(0.14, 0.14, 1.0, 12), YEL, loc=(0, 3.4, 0.6)))
    bake(parts, "TollCurb", coll, parent=root)
    return coll


def build_toll_arm():
    """Gate arm along -X from the pivot (3.7 m), red/white."""
    coll = scene_coll("ReTollArm")
    root = root_empty(coll, "ReTollArm")
    RD = mat("ArmRed", "#E53935", rough=0.45)
    WH = mat("ArmWhite", "#FAFAFA", rough=0.45)
    parts = stripes(coll, "arm", 0.05, -3.7, 0, 0, 0.13, 0.1, [RD, WH], 8)
    parts.append(Part(coll, "hub", bm_cyl(0.13, 0.13, 0.18, 12, "Y"), mat("ArmHub", "#37474F"), loc=(0, 0, 0)))
    parts.append(Part(coll, "weight", bm_box(0.35, 0.16, 0.22), mat("ArmHub", "#37474F"), loc=(0.3, 0, 0)))
    bake(parts, "TollArm", coll, parent=root)
    return coll


def build_toll_canopy():
    """Overhead canopy over the plaza. Origin = road centre line; columns stand on
    the islands at d = 0.2, 4.4, 8.6, 12.8 (our side) and -3.5, -7.4 (oncoming).
    Blender x = -d. 'TOLL' faces +Y (approaching drivers)."""
    coll = scene_coll("ReTollCanopy")
    root = root_empty(coll, "ReTollCanopy")
    ROOF = mat("CanopyRoof", "#ECEFF1", rough=0.7)
    FASCIA = mat("CanopyFascia", "#1565C0", rough=0.5)
    COL = mat("CanopyColumn", "#B0BEC5", rough=0.5, metal=0.3)
    TXT = mat("CanopyText", "#FFFFFF", rough=0.5)
    LIT = mat("NeonPanel", "#FFF8E1", rough=0.3, emit=1.2)
    x0, x1 = 8.3, -13.7
    w = x0 - x1
    cx = (x0 + x1) / 2
    parts = [Part(coll, "roof", bm_box(w, 7.0, 0.5), ROOF, loc=(cx, 0, 5.75)).bevel(0.08, 2),
             Part(coll, "fasciaF", bm_box(w + 0.1, 0.12, 0.9), FASCIA, loc=(cx, 3.55, 5.55)),
             Part(coll, "fasciaB", bm_box(w + 0.1, 0.12, 0.9), FASCIA, loc=(cx, -3.55, 5.55))]
    for d in (0.2, 4.4, 8.6, 12.8, -3.5, -7.4):
        parts.append(Part(coll, "col", bm_cyl(0.22, 0.22, 5.35, 12), COL, loc=(-d, 0, 2.85)))
    for d in (2.3, 6.5, 10.7, -1.75, -5.3):
        parts.append(Part(coll, "light", bm_box(1.6, 1.2, 0.04), LIT, loc=(-d, 0, 5.48)))
    parts.append(text(coll, "TOLL PLAZA", 0.62, TXT, (-6.5, 3.62, 5.52), "+Y"))
    parts.append(text(coll, "EXACT CHANGE  *  NO E-ZPASS", 0.32, TXT, (5.0, 3.62, 5.55), "+Y"))
    parts.append(text(coll, "THANK YOU - DRIVE SAFE", 0.42, TXT, (-2.5, -3.62, 5.52), "-Y"))
    bake(parts, "TollCanopy", coll, parent=root)
    return coll


# ═════════════════════════════════ railroad ═════════════════════════════════
def build_rail_signal():
    """Crossing signal: crossbuck, twin flashing lamps (LampA / LampB face +Y),
    bell, gate mechanism with Anchor_arm (arm extends toward +X = the road)."""
    coll = scene_coll("ReRailSignal")
    root = root_empty(coll, "ReRailSignal")
    WH = mat("SignalWhite", "#F5F5F5", rough=0.5)
    BK = mat("SignalBlack", "#1B1B1B", rough=0.6)
    MECH = mat("SignalMech", "#9E9E9E", rough=0.5, metal=0.4)
    GOLD = mat("BellGold", "#FFC107", rough=0.25, metal=0.8)
    LA = mat("LampA", "#FF1744", rough=0.3, emit=0.2)
    LB = mat("LampB", "#FF1744", rough=0.3, emit=0.2)
    TX = mat("SignalText", "#1B1B1B", rough=0.5)
    parts = [Part(coll, "base", bm_box(0.7, 0.7, 0.2), mat("SignalBase", "#9E9E9E", rough=0.9), loc=(0, 0, 0.1)),
             Part(coll, "mech", bm_box(0.5, 0.55, 1.05), MECH, loc=(0, 0, 0.72)).bevel(0.04, 2),
             Part(coll, "mast", bm_cyl(0.09, 0.09, 4.3, 10), WH, loc=(0, 0, 2.35))]
    for z in (1.4, 2.0):
        parts.append(Part(coll, "band", bm_cyl(0.095, 0.095, 0.18, 10), BK, loc=(0, 0, z)))
    # crossbuck
    for a in (math.radians(45), math.radians(-45)):
        parts.append(Part(coll, "buckEdge", bm_box(1.5, 0.05, 0.3), BK, loc=(0, 0.07, 4.05), rot=(0, a, 0), smooth=False))
        parts.append(Part(coll, "buck", bm_box(1.44, 0.06, 0.24), WH, loc=(0, 0.1, 4.05), rot=(0, a, 0), smooth=False))
    t1 = Part(coll, "t1", bm_text_lo("RAILROAD", 0.13), TX, loc=(0, 0.14, 4.05), rot=(math.pi / 2, math.radians(-45), math.pi), smooth=False)
    t2 = Part(coll, "t2", bm_text_lo("CROSSING", 0.13), TX, loc=(0, 0.145, 4.05), rot=(math.pi / 2, math.radians(45), math.pi), smooth=False)
    parts += [t1, t2]
    # lamp bar + twin lamps with visors
    parts.append(Part(coll, "bar", bm_box(1.35, 0.1, 0.12), BK, loc=(0, 0.05, 3.05)))
    for x, m in ((0.48, LA), (-0.48, LB)):
        parts.append(Part(coll, "disc", bm_cyl(0.3, 0.3, 0.05, 18, "Y"), BK, loc=(x, 0.1, 3.05)))
        parts.append(Part(coll, "housing", bm_cyl(0.17, 0.17, 0.22, 14, "Y"), BK, loc=(x, 0.18, 3.05)))
        parts.append(Part(coll, "lens", bm_cyl(0.14, 0.14, 0.04, 14, "Y"), m, loc=(x, 0.3, 3.05)))
        parts.append(Part(coll, "visor", bm_box(0.36, 0.28, 0.04), BK, loc=(x, 0.34, 3.24), rot=(0.25, 0, 0)))
    parts.append(Part(coll, "bellArm", bm_box(0.05, 0.05, 0.35), BK, loc=(0, 0, 4.55)))
    parts.append(Part(coll, "bell", bm_sphere(0.17, 0.17, 0.13, 14, 8), GOLD, loc=(0, 0, 4.75)))
    bake(parts, "RailSignal", coll, parent=root)
    anchor(coll, root, "Anchor_arm", (0.34, 0.05, 1.0))
    return coll


def build_rail_arm():
    coll = scene_coll("ReRailArm")
    root = root_empty(coll, "ReRailArm")
    RD = mat("ArmRed", "#E53935", rough=0.45)
    WH = mat("ArmWhite", "#FAFAFA", rough=0.45)
    LA = mat("LampA", "#FF1744", rough=0.3, emit=0.2)
    parts = stripes(coll, "arm", 0.0, 7.0, 0, 0, 0.14, 0.11, [RD, WH], 14)
    parts.append(Part(coll, "weight", bm_box(0.55, 0.22, 0.32), mat("ArmHub", "#37474F"), loc=(-0.35, 0, 0)))
    for x in (1.6, 4.0, 6.8):
        parts.append(Part(coll, "lamp", bm_sphere(0.07, 0.07, 0.07, 10, 6), LA, loc=(x, 0, 0.12)))
    bake(parts, "RailArm", coll, parent=root)
    return coll


def build_track():
    """An 8 m straight track segment along Blender Y (ballast, ties, rails)."""
    coll = scene_coll("ReTrack")
    root = root_empty(coll, "ReTrack")
    BAL = mat("Ballast", "#8F8A84", rough=1.0)
    TIE = mat("Tie", "#5D4037", rough=0.9)
    RAIL = mat("Rail", "#9EA7AD", rough=0.3, metal=0.8)
    L = 8.0
    parts = [Part(coll, "ballast", bm_box(3.2, L, 0.22), BAL, loc=(0, 0, 0.11), smooth=False),
             Part(coll, "ballastFoot", bm_box(3.8, L, 0.08), BAL, loc=(0, 0, 0.04), smooth=False)]
    for i in range(13):
        parts.append(Part(coll, "tie", bm_box(2.5, 0.22, 0.14), TIE, loc=(0, -L / 2 + 0.3 + i * (L - 0.6) / 12, 0.29), smooth=False))
    for x in (-0.72, 0.72):
        parts.append(Part(coll, "rail", bm_box(0.08, L, 0.14), RAIL, loc=(x, 0, 0.43), smooth=False))
    bake(parts, "Track", coll, parent=root)
    return coll


def build_track_xing():
    """The part of the track that crosses the road: flush rubber panels + rails (length along Y)."""
    coll = scene_coll("ReTrackXing")
    root = root_empty(coll, "ReTrackXing")
    PAN = mat("XingPanel", "#3B3B3E", rough=0.95)
    RAIL = mat("Rail", "#9EA7AD", rough=0.3, metal=0.8)
    L = 8.0
    parts = [Part(coll, "panel", bm_box(3.0, L, 0.05), PAN, loc=(0, 0, 0.045), smooth=False)]
    for x in (-0.72, 0.72):
        parts.append(Part(coll, "rail", bm_box(0.08, L, 0.03), RAIL, loc=(x, 0, 0.075), smooth=False))
    bake(parts, "TrackXing", coll, parent=root)
    return coll


def _truck(coll, y, mats):
    FR, WHL = mats
    parts = [Part(coll, "bogie", bm_box(2.2, 2.6, 0.35), FR, loc=(0, y, 0.6))]
    for yy in (y - 0.8, y + 0.8):
        for x in (-0.95, 0.95):
            parts.append(Part(coll, "wheel", bm_cyl(0.42, 0.42, 0.16, 14, "X"), WHL, loc=(x, yy, 0.45)))
    return parts


def build_train_loco():
    coll = scene_coll("ReTrainLoco")
    root = root_empty(coll, "ReTrainLoco")
    P = mat("LocoPaint", "#1565C0", rough=0.4)
    ST = mat("LocoStripe", "#FFD54F", rough=0.4)
    DK = mat("LocoDark", "#263238", rough=0.6)
    WHL = mat("LocoWheel", "#37474F", rough=0.4, metal=0.6)
    RAILG = mat("LocoRail", "#FFD54F", rough=0.4)
    parts = [Part(coll, "deck", bm_box(3.0, 17.0, 0.3), DK, loc=(0, 0, 1.25)).bevel(0.04, 2),
             Part(coll, "tank", bm_cyl(0.75, 0.75, 5.0, 14, "Y"), DK, loc=(0, 0.5, 0.85)),
             Part(coll, "hood", bm_box(2.3, 10.5, 2.2), P, loc=(0, 2.9, 2.5)).bevel(0.15, 3),
             Part(coll, "cab", bm_box(2.9, 2.8, 2.75), P, loc=(0, -3.9, 2.78)).bevel(0.12, 3),
             Part(coll, "cabRoof", bm_box(3.0, 3.0, 0.16), DK, loc=(0, -3.9, 4.2)).bevel(0.05, 2),
             Part(coll, "nose", bm_box(2.3, 2.9, 1.3), P, loc=(0, -6.8, 2.05)).bevel(0.15, 3),
             Part(coll, "pilot", bm_prism([(-0.6, 0), (0.6, 0), (0.6, 0.5), (0.1, 0.9), (-0.6, 0.9)], 1.5), ST, loc=(0, -8.5, 0.35), smooth=False),
             Part(coll, "stripeL", bm_box(0.04, 16.0, 0.26), ST, loc=(1.52, -0.2, 1.55)),
             Part(coll, "stripeR", bm_box(0.04, 16.0, 0.26), ST, loc=(-1.52, -0.2, 1.55)),
             Part(coll, "horn", bm_cyl(0.07, 0.11, 0.5, 8, "Y"), S.CHROME, loc=(0.5, -4.6, 4.42)),
             Part(coll, "fan1", bm_cyl(0.55, 0.55, 0.08, 14), DK, loc=(0, 5.6, 3.62)),
             Part(coll, "fan2", bm_cyl(0.55, 0.55, 0.08, 14), DK, loc=(0, 7.0, 3.62))]
    # windows
    parts.append(Part(coll, "wsL", bm_box(1.1, 0.05, 0.8), S.TINT, loc=(0.65, -5.32, 3.4)))
    parts.append(Part(coll, "wsR", bm_box(1.1, 0.05, 0.8), S.TINT, loc=(-0.65, -5.32, 3.4)))
    for s in (-1, 1):
        parts.append(Part(coll, "sideWin", bm_box(0.05, 1.6, 0.75), S.TINT, loc=(s * 1.46, -3.9, 3.35)))
        parts.append(limb(coll, "rail", (s * 1.42, -8.0, 1.95), (s * 1.42, 8.0, 1.95), 0.035, RAILG))
    # lights
    parts.append(Part(coll, "head", bm_cyl(0.2, 0.2, 0.08, 14, "Y"), S.HEAD, loc=(0, -8.25, 2.35)))
    parts.append(Part(coll, "headTop", bm_cyl(0.16, 0.16, 0.08, 12, "Y"), S.HEAD, loc=(0, -5.36, 4.0)))
    for x in (-0.95, 0.95):
        parts.append(Part(coll, "ditch", bm_cyl(0.13, 0.13, 0.08, 12, "Y"), S.HEAD, loc=(x, -8.3, 1.75)))
    parts.append(text(coll, "LAKEWOOD & PACIFIC", 0.4, ST, (1.17, 3.0, 2.6), "+X"))
    parts.append(text(coll, "LAKEWOOD & PACIFIC", 0.4, ST, (-1.17, 3.0, 2.6), "-X"))
    parts.append(text(coll, "613", 0.5, ST, (1.47, -3.9, 2.25), "+X"))
    parts.append(text(coll, "613", 0.5, ST, (-1.47, -3.9, 2.25), "-X"))
    for y in (-5.4, 5.4):
        parts += _truck(coll, y, (DK, WHL))
    bake(parts, "TrainLoco", coll, parent=root)
    anchor(coll, root, "Anchor_engineer", (0.8, -3.9, 1.45))
    return coll


def build_train_box():
    coll = scene_coll("ReTrainBox")
    root = root_empty(coll, "ReTrainBox")
    P = mat("Paint", "#8D3B2B", rough=0.6)
    DK = mat("CarDark", "#2B2B2E", rough=0.6)
    DOOR = mat("BoxDoor", "#5D2A1F", rough=0.6)
    WHL = mat("LocoWheel", "#37474F", rough=0.4, metal=0.6)
    parts = [Part(coll, "frame", bm_box(2.9, 14.0, 0.3), DK, loc=(0, 0, 1.2)),
             Part(coll, "box", bm_box(3.0, 13.6, 2.9), P, loc=(0, 0, 2.85)).bevel(0.06, 2),
             Part(coll, "roof", bm_box(3.1, 13.8, 0.12), DK, loc=(0, 0, 4.36))]
    for s in (-1, 1):
        parts.append(Part(coll, "door", bm_box(0.06, 3.0, 2.6), DOOR, loc=(s * 1.52, 0, 2.75)))
        for y in (-1.6, 1.6):
            parts.append(Part(coll, "doorRail", bm_box(0.08, 0.08, 2.7), DK, loc=(s * 1.55, y, 2.75)))
        for y in (-6.6, 6.6):
            for z in (1.7, 2.1, 2.5, 2.9):
                parts.append(Part(coll, "ladder", bm_box(0.06, 0.4, 0.04), DK, loc=(s * 1.54, y, z)))
    for y in (-5.2, 5.2):
        parts += _truck(coll, y, (DK, WHL))
    for y in (-7.1, 7.1):
        parts.append(Part(coll, "coupler", bm_box(0.3, 0.4, 0.25), DK, loc=(0, y, 1.1)))
    bake(parts, "TrainBox", coll, parent=root)
    return coll


def build_train_tank():
    coll = scene_coll("ReTrainTank")
    root = root_empty(coll, "ReTrainTank")
    P = mat("Paint", "#ECEFF1", rough=0.35, metal=0.2)
    DK = mat("CarDark", "#2B2B2E", rough=0.6)
    WHL = mat("LocoWheel", "#37474F", rough=0.4, metal=0.6)
    parts = [Part(coll, "frame", bm_box(2.6, 13.0, 0.3), DK, loc=(0, 0, 1.2)),
             Part(coll, "tank", bm_cyl(1.4, 1.4, 11.6, 20, "Y"), P, loc=(0, 0, 2.75)),
             Part(coll, "endF", bm_sphere(1.4, 0.5, 1.4, 18, 10), P, loc=(0, -5.8, 2.75)),
             Part(coll, "endB", bm_sphere(1.4, 0.5, 1.4, 18, 10), P, loc=(0, 5.8, 2.75)),
             Part(coll, "dome", bm_cyl(0.45, 0.45, 0.5, 14), DK, loc=(0, 0, 4.25)),
             Part(coll, "walk", bm_box(1.2, 2.0, 0.06), DK, loc=(0, 0, 4.2)),
             Part(coll, "band", bm_cyl(1.43, 1.43, 0.3, 20, "Y"), mat("TankBand", "#E65100", rough=0.5), loc=(0, 0, 2.75))]
    for y in (-4.8, 4.8):
        parts += _truck(coll, y, (DK, WHL))
    bake(parts, "TrainTank", coll, parent=root)
    return coll


def build_train_caboose():
    coll = scene_coll("ReTrainCaboose")
    root = root_empty(coll, "ReTrainCaboose")
    P = mat("Paint", "#C62828", rough=0.5)
    DK = mat("CarDark", "#2B2B2E", rough=0.6)
    TR = mat("CabooseTrim", "#FFD54F", rough=0.5)
    WHL = mat("LocoWheel", "#37474F", rough=0.4, metal=0.6)
    parts = [Part(coll, "frame", bm_box(2.9, 10.4, 0.3), DK, loc=(0, 0, 1.2)),
             Part(coll, "body", bm_box(2.9, 8.4, 2.6), P, loc=(0, 0, 2.7)).bevel(0.08, 2),
             Part(coll, "roof", bm_box(3.1, 8.8, 0.14), DK, loc=(0, 0, 4.06)),
             Part(coll, "cupola", bm_box(2.0, 2.4, 1.0), P, loc=(0, 0, 4.6)).bevel(0.06, 2),
             Part(coll, "cupRoof", bm_box(2.2, 2.6, 0.12), DK, loc=(0, 0, 5.15)),
             Part(coll, "stack", bm_cyl(0.1, 0.1, 0.8, 8), DK, loc=(0.6, 2.8, 4.5))]
    for s in (-1, 1):
        for y in (-2.4, 0, 2.4):
            parts.append(Part(coll, "win", bm_box(0.05, 0.8, 0.7), S.TINT, loc=(s * 1.46, y, 3.0)))
        parts.append(Part(coll, "cupWin", bm_box(0.05, 1.4, 0.45), S.TINT, loc=(s * 1.01, 0, 4.65)))
        parts.append(Part(coll, "trim", bm_box(0.05, 8.4, 0.12), TR, loc=(s * 1.47, 0, 1.6)))
    for y in (-4.8, 4.8):
        parts.append(Part(coll, "porch", bm_box(2.9, 0.9, 0.08), DK, loc=(0, y, 1.45)))
        for x in (-1.35, 1.35):
            parts.append(Part(coll, "rail", bm_box(0.05, 0.05, 1.0), TR, loc=(x, y + (0.42 if y > 0 else -0.42), 1.95)))
        parts.append(Part(coll, "railTop", bm_box(2.8, 0.05, 0.05), TR, loc=(0, y + (0.42 if y > 0 else -0.42), 2.45)))
    parts.append(Part(coll, "tailLamp", bm_sphere(0.12), mat("Taillight", "#FF1744", rough=0.3, emit=1.2), loc=(1.2, 5.2, 3.6)))
    for y in (-3.2, 3.2):
        parts += _truck(coll, y, (DK, WHL))
    bake(parts, "TrainCaboose", coll, parent=root)
    return coll


# ═════════════════════════════════ ice cream ════════════════════════════════
def _cone_treat(coll, loc, scale, mats):
    WAF, SCOOP, CHERRY = mats
    x, y, z = loc
    k = scale
    return [Part(coll, "waffle", bm_cyl(0.02 * k, 0.25 * k, 0.7 * k, 12), WAF, loc=(x, y, z + 0.35 * k)),
            Part(coll, "scoop", bm_sphere(0.29 * k, 0.29 * k, 0.26 * k, 14, 10), SCOOP, loc=(x, y, z + 0.78 * k)),
            Part(coll, "scoop2", bm_sphere(0.2 * k, 0.2 * k, 0.18 * k, 12, 8), SCOOP, loc=(x, y, z + 1.0 * k)),
            Part(coll, "cherry", bm_sphere(0.07 * k), CHERRY, loc=(x, y, z + 1.2 * k))]


def build_icecream_truck():
    coll = scene_coll("ReIceTruck")
    root = root_empty(coll, "ReIceTruck")
    WH = mat("TruckWhite", "#FFFFFF", rough=0.45)
    PK = mat("TruckPink", "#F8BBD0", rough=0.5)
    PKD = mat("TruckPinkDark", "#AD1457", rough=0.5)
    WAF = mat("Waffle", "#D7A86E", rough=0.8)
    SC = mat("ScoopPink", "#F48FB1", rough=0.6)
    CH = mat("Cherry", "#E53935", rough=0.3)
    parts = [Part(coll, "box", bm_box(2.3, 4.2, 2.3), WH, loc=(0, 0.9, 1.9)).bevel(0.15, 3),
             Part(coll, "cab", bm_box(2.2, 1.7, 1.45), WH, loc=(0, -2.0, 1.45)).bevel(0.2, 3),
             Part(coll, "ws", bm_box(1.9, 0.05, 0.6), S.TINT, loc=(0, -2.86, 1.75), rot=(-0.25, 0, 0)),
             Part(coll, "chassis", bm_box(2.0, 5.8, 0.4), S.DARK, loc=(0, -0.1, 0.62)),
             Part(coll, "bumperF", bm_box(2.2, 0.2, 0.25), S.CHROME, loc=(0, -2.95, 0.65)).bevel(0.05, 2),
             Part(coll, "bumperR", bm_box(2.2, 0.2, 0.25), S.CHROME, loc=(0, 3.05, 0.65)).bevel(0.05, 2)]
    for s in (-1, 1):
        parts.append(Part(coll, "wrap", bm_box(0.04, 4.0, 0.55), PK, loc=(s * 1.16, 0.9, 1.35)))
        parts.append(Part(coll, "trim", bm_box(0.04, 4.0, 0.07), PKD, loc=(s * 1.165, 0.9, 1.67)))
        parts.append(Part(coll, "cabWin", bm_box(0.05, 0.9, 0.55), S.TINT, loc=(s * 1.11, -2.0, 1.75)))
        parts.append(Part(coll, "head", bm_box(0.4, 0.05, 0.18), S.HEAD, loc=(s * 0.7, -2.86, 1.0)))
        parts.append(Part(coll, "tail", bm_box(0.2, 0.05, 0.4), S.TAIL, loc=(s * 0.95, 3.02, 1.4)))
    # serving window + awning on the +X (left) side
    parts.append(Part(coll, "window", bm_box(0.05, 2.0, 0.9), S.GLASS, loc=(1.17, 1.0, 2.25)))
    parts.append(Part(coll, "counter", bm_box(0.35, 2.1, 0.07), PKD, loc=(1.3, 1.0, 1.78)))
    parts += [Part(coll, "awning", bm_box(0.7, 0.3, 0.05), PK if i % 2 == 0 else WH, loc=(1.45, 0.1 + i * 0.3, 2.85), rot=(0, 0.35, 0), smooth=False) for i in range(7)]
    parts.append(text(coll, "ICE CREAM", 0.42, PKD, (1.19, 1.0, 1.35), "+X"))
    parts.append(text(coll, "ICE CREAM", 0.42, PKD, (-1.19, 1.0, 1.35), "-X"))
    parts.append(text(coll, "SLOW - CHILDREN", 0.22, PKD, (0, 3.06, 2.5), "+Y"))
    # giant cone on the roof
    parts += _cone_treat(coll, (0, 1.2, 3.05), 1.3, (WAF, SC, CH))
    bake(parts, "IceTruck_body", coll, parent=root)
    four_wheels(coll, root, 0.92, -1.9, 2.0, 0.4, 0.28, S.TIRE, S.RIM, S.TIRE)
    anchor(coll, root, "Anchor_server", (0.55, 1.0, 1.05))
    return coll


def build_icecream_stand():
    """A cart with a striped umbrella and a giant cone sign (window faces -Y = the road)."""
    coll = scene_coll("ReIceStand")
    root = root_empty(coll, "ReIceStand")
    WH = mat("CartWhite", "#FFFFFF", rough=0.5)
    PK = mat("CartPink", "#F48FB1", rough=0.5)
    PKD = mat("CartPinkDark", "#AD1457", rough=0.5)
    WAF = mat("Waffle", "#D7A86E", rough=0.8)
    SC = mat("ScoopMint", "#A5D6A7", rough=0.6)
    CH = mat("Cherry", "#E53935", rough=0.3)
    parts = [Part(coll, "cart", bm_box(1.6, 0.9, 0.9), WH, loc=(0, 0, 0.85)).bevel(0.08, 2),
             Part(coll, "band", bm_box(1.62, 0.92, 0.2), PK, loc=(0, 0, 0.95)),
             Part(coll, "lid", bm_box(1.66, 0.96, 0.06), PKD, loc=(0, 0, 1.32)),
             Part(coll, "pole", bm_cyl(0.03, 0.03, 1.4, 8), S.CHROME, loc=(0, 0.1, 2.0)),
             Part(coll, "post", bm_cyl(0.06, 0.06, 2.8, 8), S.CHROME, loc=(1.3, 0, 1.4))]
    parts.append(Part(coll, "umbTop", bm_cyl(1.0, 0.05, 0.4, 16), PK, loc=(0, 0.1, 2.7), smooth=False))
    parts.append(Part(coll, "umbRim", bm_cyl(1.02, 1.0, 0.08, 16), WH, loc=(0, 0.1, 2.5), smooth=False))
    for x in (-0.55, 0.55):
        parts.append(Part(coll, "wheel", bm_cyl(0.22, 0.22, 0.08, 14, "X"), S.TIRE, loc=(x, 0.0, 0.25)))
    parts.append(text(coll, "ICE CREAM", 0.2, PKD, (0, -0.47, 0.85), "-Y"))
    parts += _cone_treat(coll, (1.3, 0, 2.55), 1.4, (WAF, SC, CH))
    bake(parts, "IceStand", coll, parent=root)
    return coll


def build_treat():
    coll = scene_coll("ReTreat")
    root = root_empty(coll, "ReTreat")
    parts = _cone_treat(coll, (0, 0, 0), 0.6, (mat("Waffle", "#D7A86E", rough=0.8), mat("ScoopPink", "#F48FB1", rough=0.6, emit=0.15), mat("Cherry", "#E53935", rough=0.3)))
    bake(parts, "Treat", coll, parent=root)
    return coll


# ═════════════════════════════════ drive-thru ═══════════════════════════════
def _burger(coll, loc, k, mats):
    BUN, PATTY, CHEESE, LET = mats
    x, y, z = loc
    return [Part(coll, "bunB", bm_cyl(0.42 * k, 0.4 * k, 0.16 * k, 18), BUN, loc=(x, y, z + 0.08 * k)),
            Part(coll, "patty", bm_cyl(0.44 * k, 0.44 * k, 0.13 * k, 18), PATTY, loc=(x, y, z + 0.22 * k)),
            Part(coll, "cheese", bm_box(0.75 * k, 0.75 * k, 0.03 * k), CHEESE, loc=(x, y, z + 0.3 * k), rot=(0, 0, 0.4)),
            Part(coll, "lettuce", bm_cyl(0.47 * k, 0.47 * k, 0.05 * k, 14), LET, loc=(x, y, z + 0.34 * k), smooth=False),
            Part(coll, "bunT", bm_sphere(0.43 * k, 0.43 * k, 0.26 * k, 18, 10), BUN, loc=(x, y, z + 0.38 * k))]


def build_drivethru():
    """Burger joint. Front (-Y) faces the road; the drive-thru window is on the front
    at x = -2.9 (the road-RIGHT end when the front faces the road from the right)."""
    coll = scene_coll("ReDriveThru")
    root = root_empty(coll, "ReDriveThru")
    CREAM = mat("BurgerCream", "#FFF3E0", rough=0.8)
    RED = mat("BurgerRed", "#D32F2F", rough=0.6)
    YEL = mat("BurgerYellow", "#FFC107", rough=0.5)
    DOOR = mat("BurgerDoor", "#5D4037", rough=0.6)
    BUN = mat("Bun", "#E0A050", rough=0.7)
    PAT = mat("Patty", "#5D3A1A", rough=0.8)
    CHE = mat("Cheese", "#FFCA28", rough=0.6)
    LET = mat("Lettuce", "#7CB342", rough=0.7)
    W, D, H = 9.0, 7.0, 3.4
    parts = [Part(coll, "walls", bm_box(W, D, H), CREAM, loc=(0, 0, H / 2), smooth=False),
             Part(coll, "mansard", bm_prism([(-D / 2 - 0.4, 0), (D / 2 + 0.4, 0), (D / 2 - 0.3, 1.1), (-D / 2 + 0.3, 1.1)], W / 2 + 0.4), RED, loc=(0, 0, H), smooth=False),
             Part(coll, "roofTop", bm_box(W - 0.6, D - 0.6, 0.1), mat("BurgerRoof", "#8D6E63"), loc=(0, 0, H + 1.12), smooth=False),
             Part(coll, "trim", bm_box(W + 0.1, D + 0.1, 0.2), YEL, loc=(0, 0, H - 0.1), smooth=False),
             Part(coll, "door", bm_box(1.2, 0.08, 2.2), DOOR, loc=(1.0, -D / 2 - 0.02, 1.1), smooth=False),
             Part(coll, "glass1", bm_box(2.0, 0.08, 1.6), S.GLASS, loc=(3.0, -D / 2 - 0.02, 1.7)),
             Part(coll, "dtWin", bm_box(1.2, 0.08, 1.0), S.GLASS, loc=(-2.9, -D / 2 - 0.02, 1.6)),
             Part(coll, "dtFrame", bm_box(1.5, 0.1, 1.3), YEL, loc=(-2.9, -D / 2 - 0.01, 1.6)),
             Part(coll, "dtShelf", bm_box(1.4, 0.45, 0.07), RED, loc=(-2.9, -D / 2 - 0.25, 1.1)),
             Part(coll, "dtAwning", bm_box(2.0, 1.0, 0.08), RED, loc=(-2.9, -D / 2 - 0.5, 2.55), rot=(0.25, 0, 0))]
    parts.append(text(coll, "DRIVE-THRU", 0.28, RED, (-2.9, -D / 2 - 0.08, 2.35), "-Y"))
    parts.append(text(coll, "BURGER BUBBE", 0.6, mat("BurgerText", "#FFFFFF", rough=0.5), (0, -D / 2 - 0.42, H + 0.5), "-Y"))
    # tall pole sign with a giant burger
    parts.append(Part(coll, "pole", bm_cyl(0.12, 0.12, 6.5, 10), mat("Pole", "#9E9E9E", rough=0.5, metal=0.4), loc=(-W / 2 - 1.5, -D / 2, 3.25)))
    parts += _burger(coll, (-W / 2 - 1.5, -D / 2, 6.4), 3.0, (BUN, PAT, CHE, LET))
    bake(parts, "DriveThru", coll, parent=root)
    anchor(coll, root, "Anchor_server", (-2.9, -D / 2 + 0.35, 0.55))
    return coll


def build_menuboard():
    coll = scene_coll("ReMenuBoard")
    root = root_empty(coll, "ReMenuBoard")
    BD = mat("MenuBoard", "#263238", rough=0.6)
    YL = mat("NeonMenu", "#FFEB3B", rough=0.4, emit=1.0)
    parts = [Part(coll, "post1", bm_cyl(0.06, 0.06, 1.0, 8), S.DARK, loc=(-0.5, 0, 0.5)),
             Part(coll, "post2", bm_cyl(0.06, 0.06, 1.0, 8), S.DARK, loc=(0.5, 0, 0.5)),
             Part(coll, "board", bm_box(1.5, 0.12, 1.3), BD, loc=(0, 0, 1.6)).bevel(0.04, 2)]
    for i in range(5):
        parts.append(Part(coll, "line", bm_box(1.1 - (i % 2) * 0.3, 0.02, 0.08), YL, loc=(0, -0.07, 2.0 - i * 0.2)))
    parts.append(text(coll, "MENU", 0.18, YL, (0, -0.08, 2.15), "-Y"))
    parts.append(Part(coll, "speaker", bm_box(0.35, 0.25, 0.5), S.DARK, loc=(1.1, 0, 1.0)).bevel(0.05, 2))
    parts.append(Part(coll, "speakerPost", bm_cyl(0.04, 0.04, 0.75, 8), S.DARK, loc=(1.1, 0, 0.38)))
    bake(parts, "MenuBoard", coll, parent=root)
    return coll


def build_burger():
    coll = scene_coll("ReBurger")
    root = root_empty(coll, "ReBurger")
    parts = _burger(coll, (0, 0, 0), 0.9, (mat("Bun", "#E0A050", rough=0.7, emit=0.1), mat("Patty", "#5D3A1A", rough=0.8),
                                           mat("Cheese", "#FFCA28", rough=0.6), mat("Lettuce", "#7CB342", rough=0.7)))
    bake(parts, "Burger", coll, parent=root)
    return coll


# ═════════════════════════════════ gas / nitro ══════════════════════════════
def build_fuel_can():
    coll = scene_coll("ReFuelCan")
    root = root_empty(coll, "ReFuelCan")
    RD = mat("FuelRed", "#E53935", rough=0.4, emit=0.15)
    YL = mat("FuelYellow", "#FFD54F", rough=0.4)
    parts = [Part(coll, "can", bm_box(0.42, 0.2, 0.52), RD, loc=(0, 0, 0.3)).bevel(0.04, 2),
             Part(coll, "handle", bm_box(0.3, 0.06, 0.08), RD, loc=(-0.02, 0, 0.62)).bevel(0.02, 2),
             Part(coll, "spout", bm_cyl(0.04, 0.035, 0.22, 8), YL, loc=(0.17, 0, 0.65), rot=(0, 0.6, 0)),
             Part(coll, "x1", bm_box(0.36, 0.21, 0.04), mat("FuelDark", "#B71C1C", rough=0.5), loc=(0, 0, 0.3), rot=(0, 0.85, 0)),
             Part(coll, "x2", bm_box(0.36, 0.21, 0.04), mat("FuelDark", "#B71C1C", rough=0.5), loc=(0, 0, 0.3), rot=(0, -0.85, 0))]
    parts.append(text(coll, "NITRO", 0.09, YL, (0, -0.11, 0.48), "-Y"))
    bake(parts, "FuelCan", coll, parent=root)
    return coll


def build_gas_station():
    """Canopy + two pumps + kiosk; front (-Y) faces the road."""
    coll = scene_coll("ReGasStation")
    root = root_empty(coll, "ReGasStation")
    CAN = mat("GasCanopy", "#FAFAFA", rough=0.6)
    GRN = mat("GasGreen", "#2E7D32", rough=0.5)
    RD = mat("GasRed", "#E53935", rough=0.5)
    KI = mat("GasKiosk", "#FFF8E1", rough=0.8)
    LIT = mat("NeonGas", "#FFF8E1", rough=0.3, emit=1.0)
    parts = [Part(coll, "canopy", bm_box(9.0, 6.0, 0.55), CAN, loc=(0, 0, 4.6)).bevel(0.06, 2),
             Part(coll, "band", bm_box(9.1, 6.1, 0.25), GRN, loc=(0, 0, 4.45)),
             Part(coll, "light", bm_box(7.0, 4.0, 0.04), LIT, loc=(0, 0, 4.3)),
             Part(coll, "island", bm_box(6.0, 1.2, 0.2), mat("Curb", "#BDBDBD", rough=0.9), loc=(0, 0, 0.1)),
             Part(coll, "kiosk", bm_box(5.0, 3.0, 3.0), KI, loc=(0, 6.0, 1.5), smooth=False),
             Part(coll, "kioskRoof", bm_box(5.4, 3.4, 0.2), GRN, loc=(0, 6.0, 3.1), smooth=False),
             Part(coll, "kioskWin", bm_box(3.0, 0.06, 1.2), S.GLASS, loc=(0.5, 4.48, 1.7)),
             Part(coll, "kioskDoor", bm_box(0.9, 0.06, 2.1), mat("BurgerDoor", "#5D4037", rough=0.6), loc=(-1.6, 4.48, 1.05))]
    for x in (-3.8, 3.8):
        parts.append(Part(coll, "post", bm_box(0.35, 0.35, 4.3), CAN, loc=(x, 0, 2.15)))
    for x in (-1.6, 1.6):
        parts.append(Part(coll, "pump", bm_box(0.7, 0.5, 1.6), RD, loc=(x, 0, 1.0)).bevel(0.06, 2))
        parts.append(Part(coll, "pumpTop", bm_box(0.72, 0.52, 0.3), CAN, loc=(x, 0, 1.75)).bevel(0.04, 2))
        parts.append(Part(coll, "screen", bm_box(0.4, 0.04, 0.25), LIT, loc=(x, -0.27, 1.3)))
        parts.append(Part(coll, "hose", bm_torus(0.18, 0.025, 12, 5), S.BLACK, loc=(x + 0.4, -0.1, 0.9), rot=(0, math.pi / 2, 0)))
    parts.append(text(coll, "GAS", 0.9, mat("GasText", "#FFFFFF", rough=0.5), (0, -3.08, 4.45), "-Y"))
    bake(parts, "GasStation", coll, parent=root)
    return coll


# ═════════════════════════════════ vehicles ═════════════════════════════════
def build_school_bus():
    coll = scene_coll("ReSchoolBus")
    root = root_empty(coll, "ReSchoolBus")
    Y = mat("BusYellow", "#F9A825", rough=0.45)
    BK = mat("BusBlack", "#212121", rough=0.6)
    RD = mat("LightRed", "#FF1744", rough=0.3, emit=0.4)
    AMB = mat("NeonBusAmber", "#FFB300", rough=0.3, emit=0.6)
    TX = mat("BusText", "#111111", rough=0.5)
    L = 10.6
    parts = [Part(coll, "body", bm_box(2.5, L - 1.4, 2.4), Y, loc=(0, 0.7, 1.95)).bevel(0.18, 3),
             Part(coll, "hood", bm_box(2.3, 1.6, 1.0), Y, loc=(0, -L / 2 + 0.8, 1.25)).bevel(0.15, 3),
             Part(coll, "ws", bm_box(2.2, 0.06, 0.9), S.TINT, loc=(0, -L / 2 + 1.62, 2.45), rot=(-0.15, 0, 0)),
             Part(coll, "chassis", bm_box(2.2, L - 0.4, 0.4), BK, loc=(0, 0.2, 0.65)),
             Part(coll, "bumperF", bm_box(2.5, 0.22, 0.3), BK, loc=(0, -L / 2 - 0.05, 0.7)),
             Part(coll, "bumperR", bm_box(2.5, 0.22, 0.3), BK, loc=(0, L / 2 + 0.05, 0.7)),
             Part(coll, "rearWin", bm_box(1.6, 0.06, 0.8), S.TINT, loc=(0, L / 2 + 0.02, 2.4))]
    for s in (-1, 1):
        parts.append(Part(coll, "stripe1", bm_box(0.04, L - 1.4, 0.1), BK, loc=(s * 1.26, 0.7, 1.45)))
        parts.append(Part(coll, "stripe2", bm_box(0.04, L - 1.4, 0.1), BK, loc=(s * 1.26, 0.7, 1.75)))
        for i in range(7):
            parts.append(Part(coll, "win", bm_box(0.05, 0.95, 0.7), S.TINT, loc=(s * 1.25, -2.9 + i * 1.18, 2.45)))
        parts.append(Part(coll, "head", bm_cyl(0.15, 0.15, 0.06, 12, "Y"), S.HEAD, loc=(s * 0.8, -L / 2 - 0.02, 1.25)))
        parts.append(Part(coll, "tail", bm_cyl(0.13, 0.13, 0.06, 12, "Y"), S.TAIL, loc=(s * 0.95, L / 2 + 0.04, 1.2)))
        for y, m in ((-L / 2 + 1.55, RD), (L / 2 - 0.02, RD)):
            parts.append(Part(coll, "flash", bm_cyl(0.12, 0.12, 0.06, 12, "Y"), m, loc=(s * 0.95, y, 3.0)))
        for y in (-L / 2 + 1.55, L / 2 - 0.02):
            parts.append(Part(coll, "amber", bm_cyl(0.1, 0.1, 0.06, 12, "Y"), AMB, loc=(s * 0.6, y, 3.0)))
    parts.append(text(coll, "SCHOOL BUS", 0.32, TX, (0, -L / 2 + 1.58, 3.0), "-Y"))
    parts.append(text(coll, "SCHOOL BUS", 0.32, TX, (0, L / 2 + 0.03, 2.95), "+Y"))
    parts.append(text(coll, "LAKEWOOD CHEDER", 0.3, TX, (1.27, 0.7, 1.6), "+X"))
    parts.append(text(coll, "LAKEWOOD CHEDER", 0.3, TX, (-1.27, 0.7, 1.6), "-X"))
    bake(parts, "SchoolBus_body", coll, parent=root)
    # the STOP arm on the driver's (left, +X) side: origin at the hinge, sign extends along -Y (folded)
    arm = [Part(coll, "armBar", bm_box(0.04, 0.5, 0.06), BK, loc=(1.32, -L / 2 + 2.3, 1.85)),
           Part(coll, "sign", octagon(0.3, 0.03), mat("StopRed", "#D32F2F", rough=0.4), loc=(1.32, -L / 2 + 1.75, 1.85), rot=(0, 0, math.pi / 2)),
           Part(coll, "signTxt", bm_text_lo("STOP", 0.13), mat("StopWhite", "#FFFFFF", rough=0.4), loc=(1.35, -L / 2 + 1.75, 1.85), rot=(math.pi / 2, 0, math.pi / 2), smooth=False),
           Part(coll, "lampT", bm_sphere(0.05), RD, loc=(1.36, -L / 2 + 1.75, 2.12)),
           Part(coll, "lampB", bm_sphere(0.05), RD, loc=(1.36, -L / 2 + 1.75, 1.58))]
    bake_at(arm, "StopArm", coll, root, (1.3, -L / 2 + 2.55, 1.85))
    four_wheels(coll, root, 1.02, -L / 2 + 2.0, L / 2 - 2.2, 0.48, 0.32, S.TIRE, S.RIM, S.TIRE)
    return coll


def build_ambulance():
    coll = scene_coll("ReAmbulance")
    root = root_empty(coll, "ReAmbulance")
    WH = mat("AmbWhite", "#FAFAFA", rough=0.4)
    RD = mat("AmbRed", "#E53935", rough=0.4)
    LR = mat("LightRed", "#FF1744", rough=0.3, emit=3.0)
    LB = mat("LightBlue", "#2979FF", rough=0.3, emit=3.0)
    parts = [Part(coll, "box", bm_box(2.2, 3.6, 2.2), WH, loc=(0, 0.9, 1.75)).bevel(0.12, 3),
             Part(coll, "cab", bm_box(2.1, 1.8, 1.4), WH, loc=(0, -1.75, 1.35)).bevel(0.2, 3),
             Part(coll, "ws", bm_box(1.85, 0.05, 0.55), S.TINT, loc=(0, -2.66, 1.62), rot=(-0.3, 0, 0)),
             Part(coll, "chassis", bm_box(2.0, 5.4, 0.36), S.DARK, loc=(0, -0.1, 0.6)),
             Part(coll, "bar", bm_box(1.4, 0.35, 0.16), S.DARK, loc=(0, -1.6, 2.12)),
             Part(coll, "red", bm_box(0.6, 0.32, 0.16), LR, loc=(0.36, -1.6, 2.26)).bevel(0.04, 2),
             Part(coll, "blue", bm_box(0.6, 0.32, 0.16), LB, loc=(-0.36, -1.6, 2.26)).bevel(0.04, 2),
             Part(coll, "bumperF", bm_box(2.1, 0.2, 0.25), S.CHROME, loc=(0, -2.75, 0.6)),
             Part(coll, "rearDoor", bm_box(1.8, 0.04, 1.8), S.TINT, loc=(0, 2.72, 1.8))]
    for s in (-1, 1):
        parts.append(Part(coll, "stripe", bm_box(0.04, 5.0, 0.28), RD, loc=(s * 1.11, 0.0, 1.1)))
        parts.append(Part(coll, "cabWin", bm_box(0.05, 0.9, 0.5), S.TINT, loc=(s * 1.06, -1.7, 1.65)))
        parts.append(Part(coll, "head", bm_box(0.38, 0.05, 0.16), S.HEAD, loc=(s * 0.65, -2.66, 0.95)))
        parts.append(Part(coll, "tail", bm_box(0.18, 0.05, 0.4), S.TAIL, loc=(s * 0.98, 2.72, 1.2)))
        parts.append(Part(coll, "corner", bm_box(0.2, 0.2, 0.12), LR if s > 0 else LB, loc=(s * 0.98, 2.62, 2.9)))
        # red Magen David on each side (two triangles)
        for flip in (0, math.pi):
            parts.append(Part(coll, "star", bm_cyl(0.42, 0.42, 0.03, 3, "X"), RD,
                              loc=(s * 1.125, 1.0, 2.0), rot=(flip + math.pi / 2, 0, 0), smooth=False))
    parts.append(text(coll, "AMBULANCE", 0.3, RD, (0, -2.69, 2.0), "-Y"))
    bake(parts, "Ambulance_body", coll, parent=root)
    four_wheels(coll, root, 0.88, -1.75, 1.75, 0.38, 0.26, S.TIRE, S.RIM, S.TIRE)
    return coll


# ═════════════════════════════════ animals ══════════════════════════════════
def build_duck():
    """Yellow duck (the 2D one). Body / Leg_L / Leg_R (hip pivot) / Arm_L / Arm_R (wings)."""
    coll = scene_coll("ReDuck")
    root = root_empty(coll, "ReDuck")
    Y = mat("DuckYellow", "#FDD835", rough=0.7)
    OR = mat("DuckBeak", "#FF8F00", rough=0.5)
    EYE = mat("Eye", "#1B1B1B", rough=0.3)
    SH = mat("EyeShine", "#FFFFFF", rough=0.2)
    CH = mat("Cheek", "#FF8A9A", rough=0.8)
    body = [Part(coll, "body", bm_sphere(0.15, 0.21, 0.13, 16, 10), Y, loc=(0, 0.02, 0.22)),
            Part(coll, "tail", bm_sphere(0.07, 0.08, 0.06), Y, loc=(0, 0.21, 0.3), rot=(-0.6, 0, 0)),
            Part(coll, "head", bm_sphere(0.1, 0.1, 0.1, 16, 10), Y, loc=(0, -0.15, 0.42)),
            Part(coll, "beak", bm_sphere(0.06, 0.07, 0.025, 12, 6), OR, loc=(0, -0.25, 0.4))]
    for s in (-1, 1):
        body.append(Part(coll, "eye", bm_sphere(0.018, 0.012, 0.022, 8, 6), EYE, loc=(s * 0.045, -0.23, 0.45)))
        body.append(Part(coll, "shine", bm_sphere(0.006), SH, loc=(s * 0.045 + 0.005, -0.24, 0.457)))
        body.append(Part(coll, "cheek", bm_sphere(0.02, 0.006, 0.014), CH, loc=(s * 0.07, -0.21, 0.4)))
    bake(body, "Body", coll, parent=root)
    for nm, s in (("Arm_L", 1), ("Arm_R", -1)):
        bake_at([Part(coll, nm, bm_sphere(0.03, 0.13, 0.08, 10, 6), Y, loc=(s * 0.15, 0.04, 0.22), rot=(-0.2, 0, 0))], nm, coll, root, (s * 0.13, -0.04, 0.26))
    for nm, s in (("Leg_L", 1), ("Leg_R", -1)):
        bake_at([Part(coll, nm + "l", bm_cyl(0.014, 0.014, 0.12, 6), OR, loc=(s * 0.06, 0, 0.07)),
                 Part(coll, nm + "f", bm_box(0.07, 0.08, 0.015), OR, loc=(s * 0.06, -0.03, 0.008))], nm, coll, root, (s * 0.06, 0, 0.13))
    return coll


def build_raccoon():
    coll = scene_coll("ReRaccoon")
    root = root_empty(coll, "ReRaccoon")
    G = mat("RaccoonGrey", "#78909C", rough=0.85)
    DK = mat("RaccoonDark", "#37474F", rough=0.85)
    WH = mat("RaccoonWhite", "#ECEFF1", rough=0.8)
    EYE = mat("Eye", "#1B1B1B", rough=0.3)
    SH = mat("EyeShine", "#FFFFFF", rough=0.2)
    body = [Part(coll, "body", bm_sphere(0.17, 0.3, 0.16, 16, 10), G, loc=(0, 0.05, 0.3)),
            Part(coll, "head", bm_sphere(0.13, 0.12, 0.11, 16, 10), G, loc=(0, -0.3, 0.38)),
            Part(coll, "face", bm_sphere(0.1, 0.06, 0.07, 12, 8), WH, loc=(0, -0.38, 0.36)),
            Part(coll, "mask", bm_sphere(0.115, 0.05, 0.04, 12, 6), DK, loc=(0, -0.38, 0.4)),
            Part(coll, "nose", bm_sphere(0.022), EYE, loc=(0, -0.45, 0.36))]
    for s in (-1, 1):
        body.append(Part(coll, "ear", bm_cyl(0.045, 0.0, 0.07, 6), DK, loc=(s * 0.08, -0.27, 0.49), rot=(0, s * 0.3, 0)))
        body.append(Part(coll, "eye", bm_sphere(0.018, 0.01, 0.018, 8, 6), EYE, loc=(s * 0.045, -0.43, 0.41)))
        body.append(Part(coll, "shine", bm_sphere(0.006), SH, loc=(s * 0.045 + 0.005, -0.44, 0.416)))
    # ringed tail
    for i in range(5):
        body.append(Part(coll, "tail", bm_sphere(0.065 - i * 0.004, 0.06, 0.065 - i * 0.004, 10, 6), DK if i % 2 else G,
                         loc=(0, 0.33 + i * 0.075, 0.33 + i * 0.045)))
    bake(body, "Body", coll, parent=root)
    for nm, s, y in (("Arm_L", 1, -0.16), ("Arm_R", -1, -0.16), ("Leg_L", 1, 0.22), ("Leg_R", -1, 0.22)):
        bake_at([Part(coll, nm, bm_cyl(0.04, 0.035, 0.2, 8), DK, loc=(s * 0.1, y, 0.12)),
                 Part(coll, nm + "p", bm_sphere(0.04, 0.05, 0.025), DK, loc=(s * 0.1, y - 0.02, 0.02))], nm, coll, root, (s * 0.1, y, 0.22))
    return coll


def build_ostrich():
    coll = scene_coll("ReOstrich")
    root = root_empty(coll, "ReOstrich")
    BK = mat("OstrichBlack", "#212121", rough=0.85)
    WH = mat("OstrichWhite", "#FAFAFA", rough=0.8)
    SK = mat("OstrichSkin", "#F4A582", rough=0.7)
    OR = mat("OstrichBeak", "#FFB74D", rough=0.5)
    EYE = mat("Eye", "#1B1B1B", rough=0.3)
    SH = mat("EyeShine", "#FFFFFF", rough=0.2)
    body = [Part(coll, "body", bm_sphere(0.38, 0.55, 0.36, 18, 12), BK, loc=(0, 0.05, 1.3)),
            Part(coll, "plume", bm_sphere(0.28, 0.25, 0.25, 14, 8), WH, loc=(0, 0.55, 1.45)),
            limb(coll, "neck", (0, -0.35, 1.45), (0, -0.55, 2.25), 0.07, SK),
            Part(coll, "head", bm_sphere(0.12, 0.14, 0.11, 14, 10), SK, loc=(0, -0.58, 2.32)),
            Part(coll, "beak", bm_sphere(0.06, 0.1, 0.03, 12, 6), OR, loc=(0, -0.7, 2.29))]
    for s in (-1, 1):
        body.append(Part(coll, "eye", bm_sphere(0.04, 0.02, 0.045, 10, 8), EYE, loc=(s * 0.07, -0.66, 2.36)))
        body.append(Part(coll, "shine", bm_sphere(0.012), SH, loc=(s * 0.07 + 0.01, -0.68, 2.38)))
        body.append(Part(coll, "lash", bm_box(0.06, 0.01, 0.012), EYE, loc=(s * 0.07, -0.67, 2.41)))
    bake(body, "Body", coll, parent=root)
    for nm, s in (("Arm_L", 1), ("Arm_R", -1)):
        bake_at([Part(coll, nm, bm_sphere(0.06, 0.35, 0.18, 12, 8), BK, loc=(s * 0.38, 0.1, 1.35)),
                 Part(coll, nm + "t", bm_sphere(0.05, 0.12, 0.1), WH, loc=(s * 0.4, 0.42, 1.4))], nm, coll, root, (s * 0.33, -0.15, 1.45))
    for nm, s in (("Leg_L", 1), ("Leg_R", -1)):
        bake_at([Part(coll, nm + "th", bm_sphere(0.1, 0.12, 0.2), SK, loc=(s * 0.16, 0.05, 0.95)),
                 limb(coll, nm + "sh", (s * 0.16, 0.05, 0.9), (s * 0.16, 0.0, 0.06), 0.04, SK),
                 Part(coll, nm + "f", bm_box(0.1, 0.2, 0.05), SK, loc=(s * 0.16, -0.07, 0.03))], nm, coll, root, (s * 0.16, 0.05, 1.05))
    return coll


# ═════════════════════════════════ props ════════════════════════════════════
def build_hitch_sign():
    coll = scene_coll("ReHitchSign")
    root = root_empty(coll, "ReHitchSign")
    CB = mat("Cardboard", "#D7B98E", rough=0.95)
    TX = mat("Marker", "#C62828", rough=0.6)
    parts = [Part(coll, "card", bm_box(0.62, 0.02, 0.36), CB, loc=(0, 0, 0)),
             text(coll, "BUBBE'S?", 0.11, TX, (0, -0.012, 0.0), "-Y"),
             text(coll, "BUBBE'S?", 0.11, TX, (0, 0.012, 0.0), "+Y")]
    bake(parts, "HitchSign", coll, parent=root)
    return coll


def build_stop_paddle():
    coll = scene_coll("ReStopPaddle")
    root = root_empty(coll, "ReStopPaddle")
    parts = [Part(coll, "stick", bm_cyl(0.018, 0.018, 0.9, 8), mat("PaddleStick", "#ECEFF1"), loc=(0, 0, 0.45)),
             Part(coll, "rim", octagon(0.24, 0.02), mat("StopWhite", "#FFFFFF", rough=0.4), loc=(0, 0, 1.08)),
             Part(coll, "sign", octagon(0.22, 0.03), mat("StopRed", "#D32F2F", rough=0.4), loc=(0, 0, 1.08)),
             text(coll, "STOP", 0.1, mat("StopWhite", "#FFFFFF", rough=0.4), (0, -0.018, 1.08), "-Y"),
             text(coll, "STOP", 0.1, mat("StopWhite", "#FFFFFF", rough=0.4), (0, 0.018, 1.08), "+Y")]
    bake(parts, "StopPaddle", coll, parent=root)
    return coll


def build_billboard():
    """Roadside billboard; the 'Face' mesh (material BillboardFace) faces -Y and gets
    a canvas texture with the 2D game's messages at runtime."""
    coll = scene_coll("ReBillboard")
    root = root_empty(coll, "ReBillboard")
    POST = mat("BillPost", "#6D6D6D", rough=0.5, metal=0.5)
    FR = mat("BillFrame", "#37474F", rough=0.6)
    parts = [Part(coll, "post1", bm_box(0.3, 0.3, 6.2), POST, loc=(-2.4, 0.2, 3.1)),
             Part(coll, "post2", bm_box(0.3, 0.3, 6.2), POST, loc=(2.4, 0.2, 3.1)),
             Part(coll, "back", bm_box(8.4, 0.25, 3.8), FR, loc=(0, 0.15, 6.0)),
             Part(coll, "walk", bm_box(8.4, 0.8, 0.08), FR, loc=(0, -0.35, 4.05))]
    for x in (-2.8, 0, 2.8):
        parts.append(limb(coll, "lampArm", (x, 0.0, 4.1), (x, -0.9, 4.3), 0.03, FR))
        parts.append(Part(coll, "lamp", bm_box(0.3, 0.2, 0.12), mat("NeonLamp", "#FFF8E1", emit=1.2), loc=(x, -0.95, 4.3)))
    bake(parts, "Billboard_frame", coll, parent=root)
    face = Part(coll, "Face", bm_box(8.0, 0.04, 3.4), mat("BillboardFace", "#FFFFFF", rough=0.7), loc=(0, 0.0, 6.0))
    bake([face], "Face", coll, parent=root)
    return coll


def build_crowd_barrier():
    coll = scene_coll("ReCrowdBarrier")
    root = root_empty(coll, "ReCrowdBarrier")
    M = mat("BarrierMetal", "#B0BEC5", rough=0.35, metal=0.7)
    parts = [limb(coll, "top", (-1.2, 0, 1.05), (1.2, 0, 1.05), 0.03, M),
             limb(coll, "bot", (-1.2, 0, 0.25), (1.2, 0, 0.25), 0.03, M)]
    for i in range(13):
        x = -1.2 + i * 0.2
        parts.append(limb(coll, "bar", (x, 0, 0.25), (x, 0, 1.05), 0.012, M))
    for x in (-1.15, 1.15):
        parts.append(limb(coll, "foot", (x, -0.3, 0.02), (x, 0.3, 0.02), 0.025, M))
        parts.append(limb(coll, "leg", (x, 0, 0.02), (x, 0, 1.05), 0.025, M))
    bake(parts, "CrowdBarrier", coll, parent=root)
    return coll


# ═════════════════════════════════ people ═══════════════════════════════════
def build_worker():
    # road worker / crossing guard: hi-vis orange top, yellow vest, yellow hard hat
    return build_person("ReWorker", dict(hair="short", hair_color="#4E342E", top="#FF7043", bottom="pants",
                        bottom_color="#37474F", shoes="#4E342E", width=1.08,
                        extras=["cap", "vest"], extra_colors={"Hat": "#FBC02D", "Vest": "#FFEB3B"}))


def build_hitchhiker():
    # the thumber on the shoulder (2D: teal top, grey jeans, dark hair)
    return build_person("ReHitchhiker", dict(hair="curly", hair_color="#1A1A1A", top="#00897B", bottom="pants",
                        bottom_color="#455A64", shoes="#6D4C41", sleeves="short", extras=["kippah"],
                        extra_colors={"Kippah": "#3949AB"}))


def build_vendor():
    # ice-cream man / drive-thru server: chef hat, apron, moustache
    return build_person("ReVendor", dict(hair="short", hair_color="#5D4037", top="#F48FB1", bottom="pants",
                        bottom_color="#ECEFF1", shoes="#FAFAFA", extras=["chef_hat", "apron", "mustache"],
                        extra_colors={"Beard": "#3E2723"}))


ASSETS = [
    ("roadevents_cone", build_cone),
    ("roadevents_barrier", build_barrier),
    ("roadevents_arrowboard", build_arrowboard),
    ("roadevents_pothole", build_pothole),
    ("roadevents_steamroller", build_steamroller),
    ("roadevents_toll_booth", build_toll_booth),
    ("roadevents_toll_curb", build_toll_curb),
    ("roadevents_toll_arm", build_toll_arm),
    ("roadevents_toll_canopy", build_toll_canopy),
    ("roadevents_rail_signal", build_rail_signal),
    ("roadevents_rail_arm", build_rail_arm),
    ("roadevents_track", build_track),
    ("roadevents_track_xing", build_track_xing),
    ("roadevents_train_loco", build_train_loco),
    ("roadevents_train_box", build_train_box),
    ("roadevents_train_tank", build_train_tank),
    ("roadevents_train_caboose", build_train_caboose),
    ("roadevents_icecream_truck", build_icecream_truck),
    ("roadevents_icecream_stand", build_icecream_stand),
    ("roadevents_treat", build_treat),
    ("roadevents_drivethru", build_drivethru),
    ("roadevents_menuboard", build_menuboard),
    ("roadevents_burger", build_burger),
    ("roadevents_fuel_can", build_fuel_can),
    ("roadevents_gas_station", build_gas_station),
    ("roadevents_school_bus", build_school_bus),
    ("roadevents_ambulance", build_ambulance),
    ("roadevents_duck", build_duck),
    ("roadevents_raccoon", build_raccoon),
    ("roadevents_ostrich", build_ostrich),
    ("roadevents_hitch_sign", build_hitch_sign),
    ("roadevents_stop_paddle", build_stop_paddle),
    ("roadevents_billboard", build_billboard),
    ("roadevents_crowd_barrier", build_crowd_barrier),
    ("roadevents_worker", build_worker),
    ("roadevents_hitchhiker", build_hitchhiker),
    ("roadevents_vendor", build_vendor),
]
