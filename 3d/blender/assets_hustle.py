"""
Side hustles (feature "hustle"): GTA-style side jobs + the car radio.

    hustle_payphone    a ringing roadside payphone (the mission marker; the Handset wobbles)
    hustle_jobboard    the HELP WANTED board (delivery gigs)
    hustle_bingo       the LUCKY 7 BINGO HALL (the Getaway's "withdrawal") + its parking lot
    hustle_safehouse   Uncle's TOTALLY LEGIT STORAGE lock-up (the roll-up Door slides open)
    hustle_moneybag    a burlap sack with a $ on it
    hustle_chicken     Gertie, an emotional-support hen (Wing_L / Wing_R flap)
    hustle_selfie      the influencer's phone on a stick, with a ring light
    hustle_food        Food_cholent / Food_kugel / Food_pizza (the JS shows one)
    hustle_groom … hustle_crew   the cab fares and Uncle's crew (lib_people characters)

Conventions (3d/ARCHITECTURE.md): metres, FRONT = Blender -Y (= +Z in three.js),
Blender +X = the model's LEFT. Materials named Neon* / Window glow; Glass is see-through.
Everything is prefixed hustle_ so it never collides with another feature.
"""
from lib import *
from lib_people import build_person


def setup():
    global S
    S = shared()


def P(coll, nm, bm, m, loc=(0, 0, 0), rot=(0, 0, 0), smooth=True):
    return Part(coll, nm, bm, m, loc=loc, rot=rot, smooth=smooth)


def txt(body, size, extrude=0.0):
    """Low-poly text facing -Y (coarse curve resolution keeps the .glb small)."""
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


def label(coll, body, size, m, loc, face="-Y", extrude=0.0):
    rot = {"-Y": (math.pi / 2, 0, 0), "+Y": (math.pi / 2, 0, math.pi)}[face]
    return P(coll, "txt", txt(body, size, extrude), m, loc=loc, rot=rot, smooth=False)


# ═════════════════════════════════ mission markers ═════════════════════════
def build_payphone():
    coll = scene_coll("HPayphone")
    root = root_empty(coll, "HPayphone")
    BLUE = mat("PhoneBlue", "#1565C0", rough=0.45, metal=0.2)
    STEEL = mat("PhoneSteel", "#B0BEC5", rough=0.3, metal=0.8)
    DARK = mat("PhoneDark", "#263238", rough=0.5)
    SIGN = mat("NeonPhone", "#4FC3F7", rough=0.3, emit=2.2)
    KEYS = mat("NeonKeys", "#FFF59D", rough=0.3, emit=0.8)
    CONC = mat("Concrete", "#BDBDBD", rough=0.95)
    parts = [P(coll, "slab", bm_box(1.1, 0.9, 0.08), CONC, loc=(0, 0, 0.04), smooth=False).bevel(0.02, 1),
             P(coll, "post", bm_box(0.12, 0.12, 1.15), STEEL, loc=(0, 0.18, 0.62), smooth=False),
             # the hood: blue back + glass sides + roof with the glowing PHONE band
             P(coll, "back", bm_box(0.82, 0.05, 1.05), BLUE, loc=(0, 0.27, 1.62)).bevel(0.02, 2),
             P(coll, "roof", bm_box(0.92, 0.62, 0.07), BLUE, loc=(0, 0.0, 2.17)).bevel(0.025, 2),
             P(coll, "signBox", bm_box(0.9, 0.5, 0.26), BLUE, loc=(0, 0.02, 2.33)).bevel(0.02, 2),
             P(coll, "signFace", bm_box(0.84, 0.03, 0.2), SIGN, loc=(0, -0.235, 2.33), smooth=False),
             P(coll, "signBack", bm_box(0.84, 0.03, 0.2), SIGN, loc=(0, 0.275, 2.33), smooth=False),
             label(coll, "PHONE", 0.15, mat("NeonWhite", "#FFFFFF", rough=0.3, emit=2.0), (0, -0.255, 2.33)),
             label(coll, "PHONE", 0.15, mat("NeonWhite", "#FFFFFF", rough=0.3, emit=2.0), (0, 0.295, 2.33), face="+Y"),
             # the phone box itself
             P(coll, "box", bm_box(0.44, 0.2, 0.62), STEEL, loc=(0, 0.16, 1.42)).bevel(0.03, 2),
             P(coll, "face", bm_box(0.36, 0.03, 0.5), DARK, loc=(0, 0.05, 1.42), smooth=False),
             P(coll, "keypad", bm_box(0.14, 0.02, 0.18), KEYS, loc=(0.06, 0.03, 1.34), smooth=False),
             P(coll, "slot", bm_box(0.08, 0.02, 0.02), STEEL, loc=(0.06, 0.03, 1.55), smooth=False),
             P(coll, "shelf", bm_box(0.5, 0.26, 0.04), STEEL, loc=(0, -0.03, 1.08), smooth=False),
             P(coll, "hook", bm_box(0.06, 0.06, 0.16), DARK, loc=(-0.17, 0.02, 1.52), smooth=False)]
    for s in (-1, 1):
        parts.append(P(coll, "side", bm_box(0.03, 0.56, 0.95), S.GLASS, loc=(s * 0.42, 0.0, 1.62), smooth=False))
        parts.append(P(coll, "frame", bm_box(0.05, 0.05, 1.0), BLUE, loc=(s * 0.42, -0.28, 1.62), smooth=False))
    # coiled cord from the box to the handset
    for i in range(5):
        parts.append(P(coll, "coil", bm_torus(0.025, 0.007, 10, 4), DARK, loc=(-0.17, 0.0, 1.22 + i * 0.04), rot=(0, 0, 0)))
    bake(parts, "Payphone_body", coll, parent=root)
    # the handset: its own node (origin at the hook) so the game can rattle it while it rings
    hs = [P(coll, "grip", bm_box(0.05, 0.05, 0.2), DARK, loc=(-0.17, -0.03, 1.52)).bevel(0.015, 2),
          P(coll, "ear", bm_box(0.08, 0.07, 0.05), DARK, loc=(-0.17, -0.04, 1.63)).bevel(0.015, 2),
          P(coll, "mouth", bm_box(0.08, 0.07, 0.05), DARK, loc=(-0.17, -0.04, 1.41)).bevel(0.015, 2)]
    bake_at(hs, "Handset", coll, root, (-0.17, -0.02, 1.52))
    return coll


def build_jobboard():
    coll = scene_coll("HJobBoard")
    root = root_empty(coll, "HJobBoard")
    WOOD = mat("BoardWood", "#795548", rough=0.8)
    CORK = mat("Cork", "#C8A06A", rough=0.95)
    RED = mat("HeaderRed", "#D32F2F", rough=0.5)
    WHITE = mat("NeonWhite", "#FFFFFF", rough=0.3, emit=1.4)
    ROOF = mat("BoardRoof", "#4E342E", rough=0.7)
    LAMP = mat("NeonLamp", "#FFF3C4", rough=0.3, emit=2.5)
    papers = [mat("PaperY", "#FFF59D", rough=0.9), mat("PaperP", "#F8BBD0", rough=0.9), mat("PaperB", "#B3E5FC", rough=0.9),
              mat("PaperG", "#C8E6C9", rough=0.9), mat("PaperW", "#FAFAFA", rough=0.9)]
    INK = mat("Ink", "#37474F", rough=0.8)
    PIN = mat("Pin", "#E53935", rough=0.3)
    parts = []
    for x in (-1.05, 1.05):
        parts.append(P(coll, "post", bm_box(0.14, 0.14, 2.5), WOOD, loc=(x, 0.05, 1.25), smooth=False))
    parts += [P(coll, "frame", bm_box(2.3, 0.12, 1.45), WOOD, loc=(0, 0.04, 1.6), smooth=False),
              P(coll, "cork", bm_box(2.1, 0.04, 1.25), CORK, loc=(0, -0.03, 1.6), smooth=False),
              P(coll, "roof", bm_prism([(-0.42, 0), (0.42, 0), (0, 0.32)], 1.3), ROOF, loc=(0, 0.04, 2.42), smooth=False),
              P(coll, "header", bm_box(1.9, 0.06, 0.3), RED, loc=(0, -0.08, 2.18), smooth=False),
              label(coll, "HELP WANTED", 0.19, WHITE, (0, -0.115, 2.18))]
    flyers = [(-0.72, 1.86, 0.08), (-0.25, 1.9, -0.06), (0.25, 1.84, 0.05), (0.74, 1.88, -0.1),
              (-0.6, 1.33, -0.04), (-0.1, 1.3, 0.09), (0.42, 1.36, -0.07), (0.8, 1.28, 0.04)]
    for i, (x, z, r) in enumerate(flyers):
        parts.append(P(coll, "flyer", bm_box(0.34, 0.012, 0.42), papers[i % len(papers)], loc=(x, -0.055, z), rot=(0, r, 0), smooth=False))
        for k in range(3):
            parts.append(P(coll, "line", bm_box(0.22, 0.006, 0.025), INK, loc=(x + math.sin(r) * (0.08 - k * 0.08), -0.064, z + 0.08 - k * 0.08), rot=(0, r, 0), smooth=False))
        parts.append(P(coll, "pin", bm_sphere(0.022), PIN, loc=(x, -0.07, z + 0.17)))
    # a little lamp over the board
    for x in (-1.12, 1.12):
        parts.append(P(coll, "lamp", bm_cyl(0.04, 0.09, 0.08, 10), ROOF, loc=(x, -0.3, 2.44)))
        parts.append(P(coll, "bulb", bm_sphere(0.045), LAMP, loc=(x, -0.3, 2.38)))
    bake(parts, "JobBoard_body", coll, parent=root)
    return coll


# ═════════════════════════════════ the getaway ═════════════════════════════
def build_bingo():
    """LUCKY 7 BINGO HALL: front wall at y = 0 (the door), its parking lot out to y = -7."""
    coll = scene_coll("HBingo")
    root = root_empty(coll, "HBingo")
    BRICK = mat("BingoBrick", "#B23A3A", rough=0.85)
    TRIM = mat("Trim", "#FFF3E0", rough=0.6)
    ROOFM = mat("BingoRoof", "#4E342E", rough=0.8)
    BOARD = mat("SignBack", "#1A0F2E", rough=0.6)
    GOLD = mat("NeonGold", "#FFD54F", rough=0.3, emit=3.2)
    PINK = mat("NeonPink", "#FF4FD8", rough=0.3, emit=3.2)
    WIN = mat("Window", "#FFE7B3", rough=0.1, emit=0.8)
    DOOR = mat("DoorRed", "#7F1D1D", rough=0.4)
    AWN1 = mat("AwningRed", "#E53935", rough=0.7)
    AWN2 = mat("AwningWhite", "#FAFAFA", rough=0.7)
    ASPH = mat("LotAsphalt", "#55595F", rough=0.95)
    LINE = mat("LotLine", "#F5F5F5", rough=0.8)
    POSTER = mat("Poster", "#FFEB3B", rough=0.8)
    INK = mat("Ink", "#212121", rough=0.8)
    w, d, h = 16.0, 10.0, 5.2
    parts = [P(coll, "hall", bm_box(w, d, h), BRICK, loc=(0, d / 2, h / 2), smooth=False),
             P(coll, "parapet", bm_box(w + 0.3, d + 0.3, 0.5), TRIM, loc=(0, d / 2, h + 0.2), smooth=False),
             P(coll, "roofTop", bm_box(w - 0.2, d - 0.2, 0.1), ROOFM, loc=(0, d / 2, h + 0.3), smooth=False),
             P(coll, "base", bm_box(w + 0.1, d + 0.1, 0.5), TRIM, loc=(0, d / 2, 0.25), smooth=False),
             # the lot
             P(coll, "lot", bm_box(w + 4, 7.2, 0.06), ASPH, loc=(0, -3.6, 0.03), smooth=False),
             P(coll, "door", bm_box(2.6, 0.12, 2.5), DOOR, loc=(0, -0.04, 1.25), smooth=False),
             P(coll, "doorFrame", bm_box(2.9, 0.1, 0.18), TRIM, loc=(0, -0.06, 2.55), smooth=False),
             P(coll, "doorSplit", bm_box(0.06, 0.14, 2.5), TRIM, loc=(0, -0.08, 1.25), smooth=False)]
    for x in (-w / 2 + 2.2, w / 2 - 2.2):
        parts.append(P(coll, "lotLineL", bm_box(0.12, 4.6, 0.012), LINE, loc=(x, -3.8, 0.07), smooth=False))
    for x in (-5.6, -3.2, 3.2, 5.6):
        parts.append(P(coll, "win", bm_box(1.6, 0.1, 1.5), WIN, loc=(x, -0.04, 2.2), smooth=False))
        parts.append(P(coll, "sill", bm_box(1.8, 0.2, 0.1), TRIM, loc=(x, -0.1, 1.4), smooth=False))
    # striped awning over the doors
    for i in range(8):
        parts.append(P(coll, "awn", bm_box(0.45, 1.5, 0.08), AWN1 if i % 2 else AWN2, loc=(-1.58 + i * 0.45, -0.75, 3.05), rot=(-0.28, 0, 0), smooth=False))
    # posters by the door
    for x, txtv in ((-2.4, "JACKPOT"), (2.4, "TONIGHT")):
        parts.append(P(coll, "poster", bm_box(1.0, 0.04, 1.3), POSTER, loc=(x, -0.06, 1.5), smooth=False))
        parts.append(label(coll, txtv, 0.16, INK, (x, -0.09, 1.75)))
        parts.append(label(coll, "$$$", 0.3, mat("PosterRed", "#D32F2F", rough=0.6), (x, -0.09, 1.35)))
    # the big roof sign: BINGO in gold, LUCKY 7 in pink, chaser bulbs
    parts += [P(coll, "signPostL", bm_box(0.2, 0.2, 2.2), TRIM, loc=(-3.5, 1.0, h + 1.1), smooth=False),
              P(coll, "signPostR", bm_box(0.2, 0.2, 2.2), TRIM, loc=(3.5, 1.0, h + 1.1), smooth=False),
              P(coll, "signBoard", bm_box(9.0, 0.3, 2.6), BOARD, loc=(0, 0.9, h + 2.0), smooth=False),
              label(coll, "BINGO", 1.25, GOLD, (0, 0.72, h + 1.75), extrude=0.04),
              label(coll, "LUCKY 7", 0.55, PINK, (0, 0.72, h + 2.95), extrude=0.03)]
    for i in range(17):
        x = -4.3 + i * (8.6 / 16)
        parts.append(P(coll, "bulb", bm_sphere(0.09, 0.09, 0.09, 8, 6), GOLD if i % 2 else PINK, loc=(x, 0.72, h + 0.78)))
        parts.append(P(coll, "bulbT", bm_sphere(0.09, 0.09, 0.09, 8, 6), PINK if i % 2 else GOLD, loc=(x, 0.72, h + 3.22)))
    # a ball cage on the side wall (bingo!)
    parts.append(P(coll, "cage", bm_torus(0.55, 0.035, 20, 5), mat("CageGold", "#FFCA28", rough=0.35, metal=0.3), loc=(w / 2 - 1.0, -0.6, h + 0.95), rot=(math.pi / 2, 0, 0)))
    parts.append(P(coll, "cage2", bm_torus(0.55, 0.035, 20, 5), mat("CageGold", "#FFCA28", rough=0.35, metal=0.3), loc=(w / 2 - 1.0, -0.6, h + 0.95), rot=(math.pi / 2, 0, math.pi / 2)))
    parts.append(P(coll, "cageFoot", bm_cyl(0.08, 0.2, 0.45, 10), mat("CageGold", "#FFCA28", rough=0.35, metal=0.3), loc=(w / 2 - 1.0, -0.6, h + 0.3)))
    for k, c in enumerate(("#E53935", "#43A047", "#1E88E5", "#FDD835")):
        parts.append(P(coll, "ball", bm_sphere(0.13), mat("Ball%d" % k, c, rough=0.3), loc=(w / 2 - 1.2 + (k % 2) * 0.35, -0.55, h + 0.75 + (k // 2) * 0.32)))
    bake(parts, "Bingo_body", coll, parent=root)
    anchor(coll, root, "Anchor_door", (0, -0.6, 0))
    return coll


def build_safehouse():
    """Uncle's lock-up: forecourt out to y = -6; the roll-up Door (own node) slides up."""
    coll = scene_coll("HSafehouse")
    root = root_empty(coll, "HSafehouse")
    WALL = mat("SafeSiding", "#8D9BA3", rough=0.75, metal=0.25)
    RIB = mat("Ribs", "#6F7C84", rough=0.6, metal=0.4)
    ROOFM = mat("SafeRoof", "#5D4037", rough=0.8)
    CONC = mat("Concrete", "#A7A7A7", rough=0.95)
    SIGN = mat("SignBoard", "#FFF8E1", rough=0.7)
    RED = mat("SignRed", "#C62828", rough=0.6)
    CRATE = mat("Crate", "#B98552", rough=0.85)
    DARK = mat("DoorDark", "#2B2F33", rough=0.6)
    LAMP = mat("NeonLamp", "#FFE8A3", rough=0.3, emit=2.6)
    w, d, h = 9.0, 7.5, 3.8
    parts = [P(coll, "shed", bm_box(w, d, h), WALL, loc=(0, d / 2, h / 2), smooth=False),
             P(coll, "roof", bm_prism([(-0.2, 0), (d + 0.4, 0), (d * 0.5, 1.2)], w / 2 + 0.3), ROOFM, loc=(0, -0.1, h), smooth=False),
             P(coll, "court", bm_box(w + 3, 6.2, 0.05), CONC, loc=(0, -3.1, 0.025), smooth=False),
             P(coll, "opening", bm_box(5.6, 0.1, 3.1), DARK, loc=(0, -0.03, 1.55), smooth=False),
             P(coll, "rail", bm_box(6.0, 0.14, 0.2), RIB, loc=(0, -0.06, 3.2), smooth=False),
             P(coll, "board", bm_box(6.2, 0.1, 0.8), SIGN, loc=(0, -0.08, h + 0.5), smooth=False),
             label(coll, "TOTALLY LEGIT STORAGE", 0.36, RED, (0, -0.14, h + 0.55)),
             label(coll, "est. last tuesday", 0.14, mat("Ink", "#37474F", rough=0.8), (0, -0.14, h + 0.22))]
    for x in (-w / 2 + 0.6, -w / 2 + 1.3, w / 2 - 1.3, w / 2 - 0.6):
        parts.append(P(coll, "rib", bm_box(0.12, 0.1, h), RIB, loc=(x, -0.05, h / 2), smooth=False))
    # crates + a barrel + a lamp
    parts += [P(coll, "crate", bm_box(1.0, 1.0, 1.0), CRATE, loc=(w / 2 + 0.8, -0.8, 0.5), rot=(0, 0, 0.2), smooth=False),
              P(coll, "crate2", bm_box(0.8, 0.8, 0.8), CRATE, loc=(w / 2 + 0.7, -0.7, 1.4), rot=(0, 0, -0.15), smooth=False),
              P(coll, "barrel", bm_cyl(0.4, 0.4, 1.0, 14), mat("Barrel", "#2E7D32", rough=0.5, metal=0.3), loc=(-w / 2 - 0.8, -0.8, 0.5)),
              P(coll, "lampArm", bm_box(0.08, 0.6, 0.08), RIB, loc=(3.75, -0.35, h + 0.3), smooth=False),
              P(coll, "lamp", bm_cyl(0.06, 0.2, 0.16, 12), DARK, loc=(3.75, -0.65, h + 0.26)),
              P(coll, "bulb", bm_sphere(0.07), LAMP, loc=(3.75, -0.65, h + 0.16))]
    bake(parts, "Safehouse_body", coll, parent=root)
    door = [P(coll, "slats", bm_box(5.4, 0.08, 3.0), RIB, loc=(0, -0.1, 1.5), smooth=False)]
    for i in range(9):
        door.append(P(coll, "slat", bm_box(5.42, 0.1, 0.05), DARK, loc=(0, -0.12, 0.2 + i * 0.33), smooth=False))
    door.append(P(coll, "handle", bm_box(0.5, 0.08, 0.08), mat("Chrome", "#D7DCE0", rough=0.22, metal=0.85), loc=(0, -0.17, 0.25), smooth=False))
    bake_at(door, "Door", coll, root, (0, -0.1, 0))
    return coll


def build_moneybag():
    coll = scene_coll("HMoneyBag")
    root = root_empty(coll, "HMoneyBag")
    SACK = mat("Burlap", "#C9A66B", rough=0.95)
    TIE = mat("Twine", "#6D4C41", rough=0.8)
    CASH = mat("DollarGreen", "#2E7D32", rough=0.6)
    parts = [P(coll, "sack", bm_sphere(0.24, 0.2, 0.25, 16, 10), SACK, loc=(0, 0, 0.24)),
             P(coll, "neck", bm_cyl(0.06, 0.1, 0.12, 12), SACK, loc=(0, 0, 0.5)),
             P(coll, "tie", bm_torus(0.065, 0.018, 12, 5), TIE, loc=(0, 0, 0.48)),
             P(coll, "flap", bm_cyl(0.11, 0.04, 0.08, 12), SACK, loc=(0, 0, 0.59)),
             label(coll, "$", 0.26, CASH, (0, -0.205, 0.24), extrude=0.01),
             label(coll, "$", 0.26, CASH, (0, 0.205, 0.24), face="+Y", extrude=0.01)]
    bake(parts, "MoneyBag_body", coll, parent=root)
    return coll


# ═════════════════════════════════ cab props ═══════════════════════════════
def build_chicken():
    coll = scene_coll("HChicken")
    root = root_empty(coll, "HChicken")
    WHITE = mat("Feathers", "#FAFAFA", rough=0.9)
    RED = mat("Comb", "#E53935", rough=0.5)
    BEAK = mat("Beak", "#FFA000", rough=0.5)
    EYE = mat("Eye", "#1B1B1B", rough=0.3)
    parts = [P(coll, "body", bm_sphere(0.15, 0.2, 0.14, 14, 10), WHITE, loc=(0, 0.02, 0.2)),
             P(coll, "breast", bm_sphere(0.12, 0.1, 0.12, 12, 8), WHITE, loc=(0, -0.12, 0.24)),
             P(coll, "head", bm_sphere(0.075, 0.08, 0.085, 12, 8), WHITE, loc=(0, -0.17, 0.39)),
             P(coll, "beak", bm_cyl(0.03, 0.002, 0.07, 8, "Y"), BEAK, loc=(0, -0.26, 0.38), rot=(math.pi, 0, 0)),
             P(coll, "wattle", bm_sphere(0.022, 0.018, 0.035), RED, loc=(0, -0.235, 0.33))]
    for i in range(3):
        parts.append(P(coll, "comb", bm_sphere(0.025, 0.03, 0.03), RED, loc=(0, -0.2 + i * 0.035, 0.47 - abs(i - 1) * 0.012)))
    for s in (-1, 1):
        parts.append(P(coll, "eye", bm_sphere(0.014), EYE, loc=(s * 0.06, -0.21, 0.41)))
        parts.append(P(coll, "leg", bm_cyl(0.012, 0.012, 0.12, 6), BEAK, loc=(s * 0.05, 0.0, 0.06)))
        parts.append(P(coll, "foot", bm_box(0.06, 0.07, 0.012), BEAK, loc=(s * 0.05, -0.02, 0.006), smooth=False))
    for k in range(3):
        parts.append(P(coll, "tail", bm_sphere(0.04, 0.09, 0.03), WHITE, loc=(0, 0.2, 0.32 + k * 0.03), rot=(0.7 + k * 0.25, 0, (k - 1) * 0.35)))
    bake(parts, "Chicken_body", coll, parent=root)
    for nm, s in (("Wing_L", 1), ("Wing_R", -1)):
        pivot = (s * 0.13, -0.02, 0.27)
        wing = [P(coll, nm, bm_sphere(0.04, 0.13, 0.09, 10, 6), WHITE, loc=(s * 0.15, 0.04, 0.22))]
        bake_at(wing, nm, coll, root, pivot)
    return coll


def build_selfie():
    coll = scene_coll("HSelfie")
    root = root_empty(coll, "HSelfie")
    STICK = mat("Stick", "#ECEFF1", rough=0.3, metal=0.6)
    CASE = mat("PhoneCase", "#F06292", rough=0.4)
    SCR = mat("NeonScreen", "#B3E5FC", rough=0.1, emit=1.4)
    RING = mat("NeonRing", "#FFFFFF", rough=0.2, emit=3.0)
    parts = [P(coll, "stick", bm_cyl(0.012, 0.012, 0.7, 8), STICK, loc=(0, 0, 0.35)),
             P(coll, "grip", bm_cyl(0.02, 0.02, 0.12, 8), mat("Grip", "#212121", rough=0.6), loc=(0, 0, 0.06)),
             P(coll, "phone", bm_box(0.09, 0.012, 0.17), CASE, loc=(0, 0, 0.78)).bevel(0.01, 2),
             P(coll, "screen", bm_box(0.078, 0.004, 0.15), SCR, loc=(0, 0.008, 0.78), smooth=False),
             P(coll, "ring", bm_torus(0.12, 0.012, 20, 5), RING, loc=(0, 0.004, 0.78), rot=(math.pi / 2, 0, 0))]
    bake(parts, "Selfie_body", coll, parent=root)
    return coll


def build_food():
    """Three dishes in one file; the game shows Food_<kind>."""
    coll = scene_coll("HFood")
    root = root_empty(coll, "HFood")
    # cholent: an enamel pot wrapped in a towel
    POT = mat("PotBlue", "#1E3A8A", rough=0.35, metal=0.2)
    SPECK = mat("PotSpeck", "#E3F2FD", rough=0.4)
    TOWEL = mat("Towel", "#FFCC80", rough=0.9)
    DARK = mat("PotDark", "#1B1B1B", rough=0.5)
    ch = [P(coll, "pot", bm_cyl(0.17, 0.16, 0.2, 18), POT, loc=(0, 0, 0.1)),
          P(coll, "rim", bm_torus(0.17, 0.015, 18, 5), POT, loc=(0, 0, 0.2)),
          P(coll, "lid", bm_sphere(0.17, 0.17, 0.05, 16, 6), POT, loc=(0, 0, 0.21)),
          P(coll, "knob", bm_sphere(0.03), DARK, loc=(0, 0, 0.27)),
          P(coll, "towel", bm_torus(0.175, 0.03, 18, 6), TOWEL, loc=(0, 0, 0.09))]
    for k in range(6):
        a = k / 6 * math.pi * 2
        ch.append(P(coll, "speck", bm_sphere(0.012), SPECK, loc=(math.cos(a) * 0.168, math.sin(a) * 0.168, 0.15)))
    for s in (-1, 1):
        ch.append(P(coll, "handle", bm_torus(0.035, 0.01, 10, 4), DARK, loc=(s * 0.19, 0, 0.17), rot=(math.pi / 2, 0, 0)))
    bake(ch, "Food_cholent", coll, parent=root)
    # kugel: a glass dish, golden noodle kugel, foil peeled back
    GLASSD = mat("DishGlass", "#B3E5FC", rough=0.1)
    KUG = mat("Kugel", "#E9B949", rough=0.7)
    CRUST = mat("KugelCrust", "#B9772F", rough=0.7)
    FOIL = mat("Foil", "#E0E0E0", rough=0.25, metal=0.9)
    ku = [P(coll, "dish", bm_box(0.36, 0.26, 0.08), GLASSD, loc=(0, 0, 0.04)).bevel(0.02, 2),
          P(coll, "kugel", bm_box(0.32, 0.22, 0.05), KUG, loc=(0, 0, 0.085), smooth=False),
          P(coll, "foil", bm_box(0.2, 0.26, 0.012), FOIL, loc=(0.1, 0, 0.13), rot=(0, -0.35, 0), smooth=False)]
    for i in range(6):
        ku.append(P(coll, "crust", bm_sphere(0.022, 0.022, 0.01), CRUST, loc=(-0.12 + (i % 3) * 0.08, -0.06 + (i // 3) * 0.12, 0.112)))
    bake(ku, "Food_kugel", coll, parent=root)
    # pizza: the box with a stamp
    BOX = mat("PizzaBox", "#F5E6C8", rough=0.9)
    STAMP = mat("PizzaRed", "#D32F2F", rough=0.6)
    pz = [P(coll, "box", bm_box(0.42, 0.42, 0.06), BOX, loc=(0, 0, 0.03), smooth=False),
          P(coll, "lidEdge", bm_box(0.43, 0.43, 0.012), BOX, loc=(0, 0, 0.064), smooth=False),
          P(coll, "stamp", bm_cyl(0.1, 0.1, 0.004, 16), STAMP, loc=(0, 0, 0.072)),
          label(coll, "HOT", 0.06, mat("White", "#FAFAFA", rough=0.6), (0, 0, 0.076))]
    pz[-1].ob.rotation_euler = (0, 0, 0)
    bake(pz, "Food_pizza", coll, parent=root)
    return coll


# ═════════════════════════════════ people ══════════════════════════════════
def build_groom():
    # Mendel: late for his own wedding (charcoal suit, white kippah, silver tie, beard)
    return build_person("HGroom", dict(hair="short", hair_color="#2B1B10", top="#263238", bottom="pants", bottom_color="#263238",
                        shoes="#111111", extras=["kippah", "beard", "tie"], extra_colors={"Kippah": "#FAFAFA", "Tie": "#CFD8DC", "Beard": "#2B1B10"}))


def build_chickenguy():
    # Shmuel: flannel, denim, trucker cap, ginger beard — and Gertie
    return build_person("HChickenGuy", dict(hair="short", hair_color="#A0522D", top="#C62828", bottom="pants", bottom_color="#1565C0",
                        shoes="#5D4037", width=1.1, extras=["cap", "beard"], extra_colors={"Hat": "#2E7D32", "Beard": "#B5651D"}))


def build_influencer():
    # @LuxeLeah: hot pink, platinum hair, shades up, gold everything
    return build_person("HInfluencer", dict(hair="long", hair_color="#F3E5AB", top="#F48FB1", bottom="skirt", bottom_color="#FCE4EC",
                        shoes="#FFFFFF", sleeves="short", extras=["sunglasses_up", "earrings", "necklace"]))


def build_instructor():
    # Mr. Katz: retired driving instructor — cardigan, tie, glasses, moustache
    return build_person("HInstructor", dict(hair="short", hair_color="#BDBDBD", top="#ECEFF1", bottom="pants", bottom_color="#5D4037",
                        shoes="#3E2723", width=1.08, extras=["glasses", "mustache", "vest", "tie", "belly"],
                        extra_colors={"Vest": "#8D6E63", "Tie": "#1565C0", "Beard": "#9E9E9E"}))


def build_detective():
    # Mrs. Feldman, private eye: trench coat, fedora, shades, scarf
    return build_person("HDetective", dict(hair="bob", hair_color="#B71C1C", top="#C8A165", bottom="dress", bottom_color="#C8A165",
                        shoes="#4E342E", extras=["sunglasses", "fedora", "scarf"],
                        extra_colors={"Hat": "#5D4037", "HatBand": "#3E2723", "Scarf": "#FF7043"}))


def build_crew():
    # one of Uncle's "professionals" (Top / Hat recoloured per crew member)
    return build_person("HCrew", dict(hair="short", hair_color="#3E2723", top="#455A64", bottom="pants", bottom_color="#212121",
                        shoes="#111111", width=1.05, extras=["sunglasses", "cap", "mustache"],
                        extra_colors={"Hat": "#212121", "Beard": "#3E2723"}))


ASSETS = [
    ("hustle_payphone", build_payphone),
    ("hustle_jobboard", build_jobboard),
    ("hustle_bingo", build_bingo),
    ("hustle_safehouse", build_safehouse),
    ("hustle_moneybag", build_moneybag),
    ("hustle_chicken", build_chicken),
    ("hustle_selfie", build_selfie),
    ("hustle_food", build_food),
    ("hustle_groom", build_groom),
    ("hustle_chickenguy", build_chickenguy),
    ("hustle_influencer", build_influencer),
    ("hustle_instructor", build_instructor),
    ("hustle_detective", build_detective),
    ("hustle_crew", build_crew),
]
