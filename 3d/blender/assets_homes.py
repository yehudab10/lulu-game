"""
features/homes — the models for 🏠 LIVING TOWNS + BREAKING INTO HOUSES.

    homes_kit      the house-interior kit: one file, one Kit_<Name> sub-root per piece (couch, Shabbos table,
                   bunk bed, fridge, the wall phone they call it in on, windows, the front door…). The game
                   lays rooms out procedurally from these (features/homes/house.js); walls + floors are JS boxes.
    homes_items    the household items Lulu grabs + the residents' cartoon weapons: Prop_<Name> sub-roots,
                   origin = where the hand holds it (frying pan, seltzer siphon, rubber chicken, pillow, kugel,
                   leaf blower, water balloon, rolling pin, foam blaster + dart, phone handset, air horn,
                   pepper spray, the Groucho disguise, a snow-globe souvenir).
    homes_street   the crowd's street props (Prop_<Name>): stroller, scooter, lemonade stand, rake, shovel, hose,
                   bucket, mail bag, delivery bag, leaf pile, snow pile, porch rocker, newspaper, kickball.
    homes_bubbe / _dad (in a towel) / _mom / _boy / _girl / _baby / _mail / _delivery   residents + townsfolk
                   (lib_people: Body + Arm_L/R + Leg_L/R; Top / Bottom / Hair are recolourable)
    homes_cat / homes_dog   four-legged rigs: Body (with the head) + Leg_FL / FR / BL / BR (hip pivots) + Tail

Conventions: metres, FRONT = Blender -Y (= +Z in three.js), origin on the floor under the piece's middle
(a wall piece: its origin on the wall plane, sticking out toward -Y).
"""
import math
from lib import *
from lib_people import build_person


def _sub(coll, root, prefix, name, items):
    e = bpy.data.objects.new(prefix + name, None)
    coll.objects.link(e)
    e.parent = root
    items.append(e)
    return e


def P(coll, bm, m, loc, rot=(0, 0, 0), smooth=False):
    return Part(coll, "hp", bm, m, loc=loc, rot=rot, smooth=smooth)


def _spread(items, step=2.6):
    for i, e in enumerate(items):
        e.location = ((i % 8) * step, (i // 8) * step, 0)


# ═════════════════════════════════════════════════════════════════════════
#  THE KIT (house interiors)
# ═════════════════════════════════════════════════════════════════════════
def build_kit():
    coll = scene_coll("HomesKit")
    root = root_empty(coll, "HomesKit")
    items = []
    K = lambda name: _sub(coll, root, "Kit_", name, items)
    B = lambda bm, m, loc, rot=(0, 0, 0), smooth=False: P(coll, bm, m, loc, rot, smooth)

    WOOD = mat("Wood", "#8D5A3B", 0.7)
    WOODL = mat("WoodLight", "#C49A6C", 0.7)
    DARKW = mat("WoodDark", "#5D3A24", 0.7)
    FAB = mat("Fabric", "#7E57C2", 0.95)
    CUSH = mat("Cushion", "#9575CD", 0.95)
    METAL = mat("Steel", "#CFD8DC", 0.3, 0.7)
    WHITE = mat("KitWhite", "#F5F5F2", 0.6)
    BLACK = mat("KitBlack", "#202124", 0.5)
    SCREEN = mat("Screen", "#22304A", 0.2, 0.0, 0.6)
    CLOTH = mat("Cloth", "#FFFFFF", 0.9)
    SILVER = mat("Silver", "#D9DDE0", 0.2, 0.9)
    FLAME = mat("Flame", "#FFC94A", 0.3, 0.0, 4.0)
    CHALLAH = mat("Challah", "#C8792E", 0.6)
    VELVET = mat("Velvet", "#4A148C", 0.8)
    GOLD = mat("KitGold", "#E7C24B", 0.3, 0.8)
    BLANKET = mat("Blanket", "#4FC3F7", 0.95)
    MATTRESS = mat("Mattress", "#ECEFF1", 0.9)
    GLASS = mat("Glass", "#BFE6FF", 0.05)
    CURTAIN = mat("Curtain", "#F8BBD0", 0.9)
    COUNTER = mat("Counter", "#E0DCD3", 0.4)
    CAB = mat("Cabinet", "#F1E6D2", 0.6)
    LEAF = mat("KitLeaf", "#4CAF50", 0.8)
    POT = mat("Terracotta", "#C0703E", 0.8)
    RUG = mat("Rug", "#B71C1C", 0.95)
    RUGB = mat("RugBorder", "#F2D16B", 0.95)
    SHADE = mat("LampShade", "#FFF3D6", 0.8, 0.0, 0.8)
    BOOKS = [mat("BookBlue", "#1A237E", 0.6), mat("BookRed", "#7B1F2B", 0.6), mat("BookBrown", "#5D4037", 0.6), mat("BookGreen", "#1B5E20", 0.6)]

    # ── living room ──
    k = K("Couch")
    parts = [B(bm_box(2.2, 0.9, 0.36), FAB, (0, 0, 0.26)), B(bm_box(2.2, 0.24, 0.62), FAB, (0, 0.33, 0.62)),
             B(bm_box(0.22, 0.9, 0.62), FAB, (-1.0, 0, 0.42)), B(bm_box(0.22, 0.9, 0.62), FAB, (1.0, 0, 0.42))]
    for x in (-0.6, 0, 0.6):
        parts.append(B(bm_box(0.6, 0.66, 0.16), CUSH, (x, -0.06, 0.52)).bevel(0.04, 2))
        parts.append(B(bm_box(0.56, 0.16, 0.42), CUSH, (x, 0.2, 0.78)).bevel(0.04, 2))
    for x in (-1.0, 1.0):
        for y in (-0.38, 0.38):
            parts.append(B(bm_cyl(0.035, 0.03, 0.1, 8), DARKW, (x, y, 0.05)))
    bake(parts, "Couch_body", coll, parent=k)

    k = K("Armchair")
    parts = [B(bm_box(0.95, 0.85, 0.36), FAB, (0, 0, 0.26)), B(bm_box(0.95, 0.22, 0.6), FAB, (0, 0.32, 0.62)),
             B(bm_box(0.18, 0.85, 0.55), FAB, (-0.42, 0, 0.4)), B(bm_box(0.18, 0.85, 0.55), FAB, (0.42, 0, 0.4)),
             B(bm_box(0.6, 0.6, 0.15), CUSH, (0, -0.05, 0.5)).bevel(0.04, 2)]
    bake(parts, "Armchair_body", coll, parent=k)

    k = K("CoffeeTable")
    parts = [B(bm_box(1.1, 0.6, 0.06), WOODL, (0, 0, 0.42)).bevel(0.015, 1)]
    for x in (-0.48, 0.48):
        for y in (-0.24, 0.24):
            parts.append(B(bm_box(0.05, 0.05, 0.4), DARKW, (x, y, 0.2)))
    parts.append(B(bm_cyl(0.14, 0.09, 0.07, 14), mat("Bowl", "#26A69A", 0.4), (0.15, 0, 0.49)))
    for i, c in enumerate(("#E53935", "#FBC02D", "#7CB342")):
        parts.append(B(bm_sphere(0.045), mat("Fruit%d" % i, c, 0.5), (0.1 + i * 0.05, (i - 1) * 0.03, 0.55), smooth=True))
    bake(parts, "CoffeeTable_body", coll, parent=k)

    k = K("TV")
    parts = [B(bm_box(1.4, 0.42, 0.5), WOOD, (0, 0, 0.25)), B(bm_box(1.3, 0.02, 0.36), DARKW, (0, -0.215, 0.25)),
             B(bm_box(1.2, 0.07, 0.7), BLACK, (0, 0.02, 0.92)), B(bm_box(1.1, 0.01, 0.6), SCREEN, (0, -0.02, 0.92)),
             B(bm_box(0.3, 0.2, 0.05), BLACK, (0, 0.05, 0.53))]
    bake(parts, "TV_body", coll, parent=k)

    k = K("Bookcase")
    parts = [B(bm_box(1.6, 0.34, 0.05), DARKW, (0, 0, z)) for z in (0.03, 0.5, 0.97, 1.44, 1.95)]
    parts += [B(bm_box(0.05, 0.34, 1.98), DARKW, (x, 0, 0.99)) for x in (-0.78, 0.78)]
    parts.append(B(bm_box(1.6, 0.03, 1.98), DARKW, (0, 0.16, 0.99)))
    import random
    rnd = random.Random(7)
    for z in (0.06, 0.53, 1.0, 1.47):
        x = -0.72
        while x < 0.7:
            w = rnd.uniform(0.04, 0.08)
            h = rnd.uniform(0.3, 0.4)
            parts.append(B(bm_box(w, 0.26, h), BOOKS[rnd.randrange(4)], (x + w / 2, -0.02, z + h / 2)))
            if rnd.random() < 0.5:
                parts.append(B(bm_box(w + 0.002, 0.262, 0.02), GOLD, (x + w / 2, -0.02, z + h * 0.8)))
            x += w + 0.008
    bake(parts, "Bookcase_body", coll, parent=k)

    k = K("Rug")
    bake([B(bm_box(2.6, 1.8, 0.012), RUGB, (0, 0, 0.006)), B(bm_box(2.4, 1.6, 0.014), RUG, (0, 0, 0.008))], "Rug_body", coll, parent=k)

    k = K("FloorLamp")
    bake([B(bm_cyl(0.18, 0.18, 0.03, 16), BLACK, (0, 0, 0.015)), B(bm_cyl(0.02, 0.02, 1.5, 8), METAL, (0, 0, 0.77)),
          B(bm_cyl(0.16, 0.24, 0.32, 16), SHADE, (0, 0, 1.55), smooth=True)], "FloorLamp_body", coll, parent=k)

    k = K("Plant")
    parts = [B(bm_cyl(0.18, 0.14, 0.32, 12), POT, (0, 0, 0.16))]
    for i in range(7):
        a = i / 7 * math.tau
        parts.append(B(bm_sphere(0.12, 0.05, 0.3), LEAF, (math.cos(a) * 0.1, math.sin(a) * 0.1, 0.55), rot=(math.sin(a) * 0.5, math.cos(a) * 0.5, 0), smooth=True))
    bake(parts, "Plant_body", coll, parent=k)

    k = K("Picture")          # on a wall: origin on the wall plane, centre of the frame
    bake([B(bm_box(0.9, 0.04, 0.62), GOLD, (0, -0.02, 0)), B(bm_box(0.8, 0.045, 0.52), mat("PicSky", "#90CAF9", 0.8), (0, -0.022, 0.06)),
          B(bm_box(0.8, 0.046, 0.22), mat("PicStone", "#E2C98F", 0.8), (0, -0.024, -0.12))] +
         [B(bm_box(0.002 + 0.0, 0.047, 0.2), mat("PicLine", "#B8A06A", 0.8), (x, -0.025, -0.12)) for x in (-0.3, -0.1, 0.1, 0.3)],
         "Picture_body", coll, parent=k)

    k = K("CoatRack")
    parts = [B(bm_cyl(0.2, 0.2, 0.03, 12), DARKW, (0, 0, 0.015)), B(bm_cyl(0.025, 0.025, 1.75, 8), DARKW, (0, 0, 0.9))]
    HAT = mat("HatBlack", "#111111", 0.5)
    for i, a in enumerate((0.3, 2.4, 4.4)):
        parts.append(B(bm_cyl(0.012, 0.012, 0.2, 6), DARKW, (math.cos(a) * 0.08, math.sin(a) * 0.08, 1.62), rot=(math.sin(a) * 0.9, -math.cos(a) * 0.9, 0)))
    for a in (0.3, 2.4):
        x, y = math.cos(a) * 0.17, math.sin(a) * 0.17
        parts.append(B(bm_cyl(0.17, 0.17, 0.015, 16), HAT, (x, y, 1.66)))
        parts.append(B(bm_cyl(0.1, 0.095, 0.13, 14), HAT, (x, y, 1.73)))
    parts.append(B(bm_box(0.3, 0.12, 0.6), mat("Coat", "#263238", 0.9), (0.05, -0.16, 1.25), rot=(0.1, 0, 0)))
    bake(parts, "CoatRack_body", coll, parent=k)

    # ── kitchen ──
    k = K("Counter")          # 2.6 m of cabinets with the sink at the right end; back against +Y
    parts = [B(bm_box(2.6, 0.62, 0.86), CAB, (0, 0, 0.43)), B(bm_box(2.66, 0.66, 0.05), COUNTER, (0, -0.01, 0.885))]
    for x in (-1.0, -0.35, 0.3, 0.95):
        parts.append(B(bm_box(0.55, 0.02, 0.62), mat("CabinetDoor", "#E6D6BC", 0.6), (x, -0.315, 0.4)))
        parts.append(B(bm_box(0.12, 0.03, 0.02), METAL, (x, -0.33, 0.66)))
    parts.append(B(bm_box(0.6, 0.42, 0.04), METAL, (0.8, -0.02, 0.9)))
    parts.append(B(bm_cyl(0.02, 0.02, 0.32, 8), METAL, (0.8, 0.2, 1.06)))
    parts.append(B(bm_cyl(0.015, 0.015, 0.2, 8, "Y"), METAL, (0.8, 0.11, 1.2)))
    # upper cabinets + a spice row
    parts.append(B(bm_box(2.6, 0.34, 0.7), CAB, (0, 0.14, 1.95)))
    parts.append(B(bm_box(1.2, 0.18, 0.03), WOOD, (-0.6, 0.2, 1.3)))
    for i in range(7):
        parts.append(B(bm_cyl(0.03, 0.03, 0.12, 8), mat("Spice%d" % (i % 3), ("#C62828", "#F9A825", "#6D4C41")[i % 3], 0.6), (-1.1 + i * 0.15, 0.2, 1.38)))
    bake(parts, "Counter_body", coll, parent=k)

    k = K("Stove")
    parts = [B(bm_box(0.78, 0.66, 0.9), WHITE, (0, 0, 0.45)), B(bm_box(0.6, 0.02, 0.45), BLACK, (0, -0.335, 0.4)),
             B(bm_box(0.5, 0.03, 0.03), METAL, (0, -0.35, 0.68)), B(bm_box(0.8, 0.1, 0.18), WHITE, (0, 0.3, 0.99))]
    for x in (-0.18, 0.18):
        for y in (-0.15, 0.15):
            parts.append(B(bm_cyl(0.1, 0.1, 0.012, 14), BLACK, (x, y, 0.905)))
    # THE cholent pot (on the back burner, low flame since Friday)
    POTM = mat("PotRed", "#C62828", 0.4)
    parts += [B(bm_cyl(0.17, 0.15, 0.24, 16), POTM, (0.18, 0.15, 1.03), smooth=True), B(bm_cyl(0.17, 0.17, 0.03, 16), POTM, (0.18, 0.15, 1.16)),
              B(bm_sphere(0.03), BLACK, (0.18, 0.15, 1.19), smooth=True)]
    for x in (-0.24, -0.08, 0.08, 0.24):
        parts.append(B(bm_cyl(0.025, 0.025, 0.03, 8, "Y"), BLACK, (x, -0.34, 0.84)))
    bake(parts, "Stove_body", coll, parent=k)

    k = K("Fridge")
    parts = [B(bm_box(0.8, 0.7, 1.85), mat("FridgeWhite", "#EEF1F3", 0.35), (0, 0, 0.925)).bevel(0.03, 2),
             B(bm_box(0.78, 0.02, 0.02), mat("FridgeSeam", "#B0BEC5", 0.5), (0, -0.355, 1.25)),
             B(bm_box(0.04, 0.05, 0.5), METAL, (-0.3, -0.38, 1.5)), B(bm_box(0.04, 0.05, 0.4), METAL, (-0.3, -0.38, 0.95)),
             B(bm_box(0.26, 0.01, 0.34), mat("KidDrawing", "#FFF59D", 0.9), (0.12, -0.36, 1.45), rot=(0, 0.08, 0))]
    for i, c in enumerate(("#E91E63", "#2196F3", "#4CAF50", "#FF9800")):
        parts.append(B(bm_cyl(0.025, 0.025, 0.015, 8, "Y"), mat("Magnet%d" % i, c, 0.4), (-0.1 + i * 0.12, -0.36, 1.1 + (i % 2) * 0.14)))
    bake(parts, "Fridge_body", coll, parent=k)

    k = K("KitchenTable")
    parts = [B(bm_cyl(0.6, 0.6, 0.05, 24), WOODL, (0, 0, 0.74), smooth=True), B(bm_cyl(0.06, 0.06, 0.7, 10), DARKW, (0, 0, 0.36)),
             B(bm_cyl(0.3, 0.3, 0.04, 16), DARKW, (0, 0, 0.02))]
    parts.append(B(bm_box(0.36, 0.26, 0.004), mat("Placemat", "#FFCC80", 0.9), (0.2, 0.1, 0.767)))
    bake(parts, "KitchenTable_body", coll, parent=k)

    k = K("Chair")             # faces -Y (you sit facing -Y); back at +Y
    parts = [B(bm_box(0.44, 0.44, 0.05), WOOD, (0, 0, 0.46)), B(bm_box(0.44, 0.04, 0.5), WOOD, (0, 0.2, 0.74))]
    for x in (-0.19, 0.19):
        for y in (-0.19, 0.19):
            parts.append(B(bm_box(0.04, 0.04, 0.46), DARKW, (x, y, 0.23)))
    bake(parts, "Chair_body", coll, parent=k)

    k = K("HighChair")
    parts = [B(bm_box(0.4, 0.4, 0.05), WHITE, (0, 0, 0.62)), B(bm_box(0.4, 0.04, 0.42), WHITE, (0, 0.18, 0.84)),
             B(bm_box(0.5, 0.3, 0.03), mat("Tray", "#FFB74D", 0.5), (0, -0.28, 0.82))]
    for x in (-0.22, 0.22):
        for y in (-0.22, 0.22):
            parts.append(B(bm_box(0.035, 0.035, 0.62), mat("HighLegs", "#FFB74D", 0.5), (x * 1.15, y * 1.15, 0.31)))
    bake(parts, "HighChair_body", coll, parent=k)

    k = K("WallPhone")         # on a wall: origin on the wall plane at the phone's height
    PH = mat("PhoneBeige", "#E8DCC0", 0.5)
    bake([B(bm_box(0.18, 0.06, 0.26), PH, (0, -0.03, 0)).bevel(0.02, 2), B(bm_box(0.06, 0.08, 0.24), PH, (0, -0.08, 0.02)).bevel(0.02, 2),
          B(bm_cyl(0.004, 0.004, 0.5, 5), mat("Cord", "#D6C8A8", 0.6), (0.06, -0.06, -0.3))], "WallPhone_body", coll, parent=k)

    # ── dining room: the Shabbos table ──
    k = K("ShabbosTable")      # 2.4 × 1.0, the head of the table at -X
    parts = [B(bm_box(2.4, 1.0, 0.06), WOOD, (0, 0, 0.74))]
    for x in (-1.1, 1.1):
        for y in (-0.42, 0.42):
            parts.append(B(bm_box(0.07, 0.07, 0.72), DARKW, (x, y, 0.36)))
    parts += [B(bm_box(2.5, 1.1, 0.012), CLOTH, (0, 0, 0.776)), B(bm_box(2.5, 0.012, 0.24), CLOTH, (0, -0.55, 0.66)),
              B(bm_box(2.5, 0.012, 0.24), CLOTH, (0, 0.55, 0.66)), B(bm_box(0.012, 1.1, 0.24), CLOTH, (-1.25, 0, 0.66)),
              B(bm_box(0.012, 1.1, 0.24), CLOTH, (1.25, 0, 0.66))]
    for y in (-0.18, 0.18):                        # candlesticks
        parts += [B(bm_cyl(0.06, 0.06, 0.02, 12), SILVER, (-0.95, y, 0.79)), B(bm_cyl(0.02, 0.03, 0.26, 10), SILVER, (-0.95, y, 0.92)),
                  B(bm_cyl(0.035, 0.035, 0.03, 10), SILVER, (-0.95, y, 1.06)), B(bm_cyl(0.015, 0.015, 0.16, 8), WHITE, (-0.95, y, 1.15)),
                  B(bm_sphere(0.022, 0.022, 0.04), FLAME, (-0.95, y, 1.26), smooth=True)]
    for i, y in enumerate((-0.12, 0.12)):          # two challahs (a braided loaf = a row of buns)
        for j in range(4):
            parts.append(B(bm_sphere(0.075 - abs(j - 1.5) * 0.012, 0.06, 0.055), CHALLAH, (-0.62 + j * 0.075, y, 0.83), rot=(0.4 * (1 if j % 2 else -1), 0, 0), smooth=True))
    parts.append(B(bm_box(0.42, 0.42, 0.012), VELVET, (-0.5, -0.38, 0.79), rot=(0, 0, 0.3)))     # the challah cover, slid off (someone peeked)
    parts.append(B(bm_box(0.3, 0.02, 0.012), GOLD, (-0.5, -0.38, 0.8), rot=(0, 0, 0.3)))
    parts += [B(bm_cyl(0.035, 0.05, 0.09, 12), SILVER, (-0.75, 0.32, 0.83)), B(bm_cyl(0.012, 0.012, 0.06, 6), SILVER, (-0.75, 0.32, 0.79)),
              B(bm_cyl(0.04, 0.04, 0.01, 12), SILVER, (-0.75, 0.32, 0.78))]
    PLATE = mat("Plate", "#FAFAFA", 0.3)
    for x in (-0.3, 0.3, 0.85):
        for y in (-0.36, 0.36):
            parts.append(B(bm_cyl(0.13, 0.11, 0.02, 18), PLATE, (x, y, 0.79)))
    parts.append(B(bm_cyl(0.12, 0.1, 0.12, 14), mat("GefilteBowl", "#5C6BC0", 0.4), (0.3, 0, 0.84)))
    bake(parts, "ShabbosTable_body", coll, parent=k)

    # ── the kids' room ──
    k = K("BunkBed")
    parts = []
    for x in (-0.95, 0.95):
        for y in (-0.42, 0.42):
            parts.append(B(bm_box(0.07, 0.07, 1.75), WOODL, (x, y, 0.875)))
    for z in (0.32, 1.32):
        parts += [B(bm_box(1.95, 0.9, 0.06), WOODL, (0, 0, z)), B(bm_box(1.85, 0.82, 0.14), MATTRESS, (0, 0, z + 0.1)),
                  B(bm_box(1.3, 0.84, 0.05), BLANKET, (0.25, 0, z + 0.19)).bevel(0.02, 1),
                  B(bm_box(0.4, 0.55, 0.1), WHITE, (-0.68, 0, z + 0.23)).bevel(0.04, 2)]
    parts += [B(bm_box(1.95, 0.05, 0.2), WOODL, (0, -0.44, 1.6)), B(bm_box(0.05, 0.05, 1.2), WOODL, (1.05, -0.5, 0.95))]
    for z in (0.5, 0.8, 1.1):
        parts.append(B(bm_box(0.05, 0.3, 0.04), WOODL, (1.05, -0.35, z)))
    bake(parts, "BunkBed_body", coll, parent=k)

    k = K("ToyBox")
    parts = [B(bm_box(0.8, 0.5, 0.45), mat("ToyBoxBlue", "#42A5F5", 0.6), (0, 0, 0.225)),
             B(bm_box(0.82, 0.04, 0.5), mat("ToyBoxLid", "#EF5350", 0.6), (0, 0.27, 0.6), rot=(-0.35, 0, 0)),
             B(bm_sphere(0.12), mat("ToyBall", "#FFEB3B", 0.5), (-0.2, 0, 0.5), smooth=True),
             B(bm_box(0.14, 0.14, 0.14), mat("ToyBlock", "#66BB6A", 0.6), (0.15, -0.05, 0.48), rot=(0.3, 0.4, 0)),
             B(bm_cyl(0.05, 0.05, 0.3, 8), mat("ToyBat", "#FF7043", 0.6), (0.25, 0.08, 0.55), rot=(0.4, 0.3, 0))]
    bake(parts, "ToyBox_body", coll, parent=k)

    k = K("Crib")
    parts = [B(bm_box(1.2, 0.65, 0.1), MATTRESS, (0, 0, 0.42)), B(bm_box(1.0, 0.55, 0.04), mat("BabyBlanket", "#F8BBD0", 0.95), (0.1, 0, 0.49))]
    for x in (-0.6, 0.6):
        for y in (-0.33, 0.33):
            parts.append(B(bm_box(0.05, 0.05, 0.95), WHITE, (x, y, 0.475)))
    for y in (-0.33, 0.33):
        parts.append(B(bm_box(1.2, 0.04, 0.04), WHITE, (0, y, 0.93)))
        for i in range(9):
            parts.append(B(bm_cyl(0.012, 0.012, 0.5, 6), WHITE, (-0.5 + i * 0.125, y, 0.68)))
    parts.append(B(bm_cyl(0.008, 0.008, 0.5, 5), WHITE, (0.55, 0, 1.15)))      # the mobile
    for i in range(4):
        a = i / 4 * math.tau
        parts.append(B(bm_ico(0.04), mat("Mobile%d" % (i % 2), ("#FFD54F", "#80DEEA")[i % 2], 0.5), (0.55 + math.cos(a) * 0.14, math.sin(a) * 0.14, 1.32)))
    bake(parts, "Crib_body", coll, parent=k)

    k = K("Desk")
    parts = [B(bm_box(1.0, 0.55, 0.04), WOODL, (0, 0, 0.66)), B(bm_box(0.04, 0.55, 0.64), WOODL, (-0.48, 0, 0.32)), B(bm_box(0.04, 0.55, 0.64), WOODL, (0.48, 0, 0.32)),
             B(bm_box(0.3, 0.22, 0.02), mat("Notebook", "#FFF59D", 0.8), (-0.15, -0.05, 0.69)),
             B(bm_cyl(0.006, 0.006, 0.18, 6), mat("Pencil", "#FFC107", 0.5), (0.1, -0.08, 0.69), rot=(0, math.pi / 2, 0.4))]
    bake(parts, "Desk_body", coll, parent=k)

    k = K("BeanBag")
    bake([B(bm_sphere(0.42, 0.42, 0.28), mat("BeanBag", "#AB47BC", 0.95), (0, 0, 0.26), smooth=True)], "BeanBag_body", coll, parent=k)

    k = K("Poster")            # on a wall
    bake([B(bm_box(0.6, 0.02, 0.8), mat("PosterBg", "#FFF8E1", 0.9), (0, -0.01, 0)),
          B(bm_cyl(0.16, 0.16, 0.021, 5, "Y"), mat("PosterStar", "#FFB300", 0.6), (0, -0.012, 0.1)),
          B(bm_box(0.4, 0.022, 0.08), mat("PosterBand", "#1E88E5", 0.6), (0, -0.013, -0.25))], "Poster_body", coll, parent=k)

    # ── structure ──
    k = K("Window")            # on a wall: origin on the wall plane, the window's centre at z = 0 (place it ~1.55 up)
    FR = mat("WindowFrame", "#FAFAFA", 0.5)
    parts = [B(bm_box(1.3, 0.14, 0.08), FR, (0, -0.02, 0.66)), B(bm_box(1.3, 0.14, 0.08), FR, (0, -0.02, -0.66)),
             B(bm_box(0.08, 0.14, 1.4), FR, (-0.62, -0.02, 0)), B(bm_box(0.08, 0.14, 1.4), FR, (0.62, -0.02, 0)),
             B(bm_box(0.05, 0.12, 1.3), FR, (0, -0.02, 0)), B(bm_box(1.2, 0.12, 0.05), FR, (0, -0.02, 0)),
             B(bm_box(1.2, 0.02, 1.25), GLASS, (0, 0.0, 0)), B(bm_box(1.45, 0.24, 0.05), FR, (0, -0.09, -0.69))]
    for s in (-1, 1):
        parts.append(B(bm_box(0.32, 0.06, 1.5), CURTAIN, (s * 0.82, -0.12, 0.02)).bevel(0.02, 1))
    parts.append(B(bm_cyl(0.015, 0.015, 2.1, 6, "X"), METAL, (0, -0.14, 0.8)))
    bake(parts, "Window_body", coll, parent=k)

    k = K("Door")              # in a wall: origin on the floor at the doorway's middle; the leaf stands ajar
    DW = mat("DoorWood", "#6D3B22", 0.6)
    parts = [B(bm_box(0.12, 0.2, 2.2), FR, (-0.56, 0, 1.1)), B(bm_box(0.12, 0.2, 2.2), FR, (0.56, 0, 1.1)), B(bm_box(1.24, 0.2, 0.12), FR, (0, 0, 2.2)),
             B(bm_box(0.96, 0.05, 2.08), DW, (-0.48 + 0.48 * math.cos(1.15), -0.48 * math.sin(1.15), 1.04), rot=(0, 0, -1.15)),
             B(bm_box(0.06, 0.03, 0.22), mat("Mezuzah", "#C9A227", 0.3, 0.7), (0.45, -0.11, 1.55), rot=(0, 0.35, 0))]
    bake(parts, "Door_body", coll, parent=k)

    _spread(items, 3.2)
    return coll


# ═════════════════════════════════════════════════════════════════════════
#  THE ITEMS (what Lulu grabs, what the residents fight back with)
# ═════════════════════════════════════════════════════════════════════════
def build_items():
    coll = scene_coll("HomesItems")
    root = root_empty(coll, "HomesItems")
    items = []
    Pr = lambda name: _sub(coll, root, "Prop_", name, items)
    B = lambda bm, m, loc, rot=(0, 0, 0), smooth=False: P(coll, bm, m, loc, rot, smooth)
    IRON = mat("CastIron", "#2B2B2E", 0.45, 0.5)
    WOODH = mat("Handle", "#8D5A3B", 0.7)
    STEEL = mat("ItemSteel", "#CFD8DC", 0.3, 0.8)
    BLACK = mat("ItemBlack", "#1B1B1B", 0.5)
    WHITE = mat("ItemWhite", "#FAFAFA", 0.6)

    # the frying pan: handle up in the fist, the pan below (the swing brings it down on a head)
    pr = Pr("Pan")
    bake([B(bm_cyl(0.022, 0.018, 0.24, 8), WOODH, (0, 0, -0.06)), B(bm_cyl(0.012, 0.012, 0.08, 6), STEEL, (0, 0, -0.2)),
          B(bm_cyl(0.16, 0.14, 0.05, 20), IRON, (0, 0.0, -0.39), rot=(math.pi / 2, 0, 0), smooth=True),
          B(bm_cyl(0.13, 0.13, 0.052, 20), mat("PanInside", "#3E3E44", 0.3, 0.6), (0, -0.002, -0.39), rot=(math.pi / 2, 0, 0))], "Pan_body", coll, parent=pr)

    # the seltzer siphon: blue fluted glass, the chrome head + lever + nozzle pointing forward (-Y)
    pr = Pr("Seltzer")
    bake([B(bm_cyl(0.055, 0.06, 0.26, 14), mat("SiphonBlue", "#3D7DD8", 0.08), (0, 0, -0.2), smooth=True),
          B(bm_cyl(0.05, 0.055, 0.04, 14), STEEL, (0, 0, -0.05)), B(bm_cyl(0.03, 0.04, 0.06, 10), STEEL, (0, 0, 0.0)),
          B(bm_cyl(0.012, 0.01, 0.12, 8, "Y"), STEEL, (0, -0.08, 0.01)), B(bm_box(0.02, 0.1, 0.012), STEEL, (0, -0.03, 0.05), rot=(0.3, 0, 0))],
         "Seltzer_body", coll, parent=pr)

    # the rubber chicken (held by the feet; it dangles)
    pr = Pr("RubberChicken")
    YEL = mat("ChickenYellow", "#FFE14D", 0.45)
    bake([B(bm_cyl(0.008, 0.008, 0.08, 6), mat("ChickenFeet", "#FF9800", 0.5), (0, 0, -0.03)),
          B(bm_sphere(0.06, 0.05, 0.16), YEL, (0, 0, -0.2), smooth=True), B(bm_cyl(0.025, 0.018, 0.18, 8), YEL, (0, 0, -0.42), smooth=True),
          B(bm_sphere(0.04), YEL, (0, 0, -0.53), smooth=True), B(bm_box(0.012, 0.05, 0.04), mat("ChickenComb", "#E53935", 0.5), (0, 0.01, -0.57)),
          B(bm_cyl(0.012, 0.0, 0.04, 6, "Y"), mat("ChickenFeet", "#FF9800", 0.5), (0, -0.05, -0.53)),
          B(bm_sphere(0.008), BLACK, (0.025, -0.03, -0.52)), B(bm_sphere(0.008), BLACK, (-0.025, -0.03, -0.52))], "RubberChicken_body", coll, parent=pr)

    pr = Pr("Pillow")
    bake([B(bm_box(0.5, 0.16, 0.34), mat("PillowCase", "#F3E5F5", 0.95), (0, 0, -0.2)).bevel(0.07, 3),
          B(bm_box(0.52, 0.17, 0.03), mat("PillowTrim", "#BA68C8", 0.9), (0, 0, -0.06))], "Pillow_body", coll, parent=pr)

    # the kugel: a 9 × 13 tin of golden lokshen kugel, held flat in front
    pr = Pr("Kugel")
    bake([B(bm_box(0.34, 0.24, 0.06), mat("KugelTin", "#C9CDD1", 0.3, 0.8), (0, -0.12, -0.04)),
          B(bm_box(0.32, 0.22, 0.03), mat("Kugel", "#E9B44C", 0.65), (0, -0.12, -0.0)),
          B(bm_box(0.3, 0.2, 0.012), mat("KugelCrust", "#B9772A", 0.7), (0, -0.12, 0.016))], "Kugel_body", coll, parent=pr)

    pr = Pr("LeafBlower")
    OR = mat("BlowerOrange", "#FF7A1A", 0.5)
    bake([B(bm_box(0.2, 0.3, 0.2), OR, (0, 0.05, -0.15)).bevel(0.04, 2), B(bm_box(0.04, 0.16, 0.04), BLACK, (0, 0.0, 0.0)),
          B(bm_cyl(0.05, 0.035, 0.6, 12, "Y"), OR, (0, -0.35, -0.2), rot=(0.25, 0, 0)), B(bm_cyl(0.04, 0.04, 0.04, 12, "Y"), BLACK, (0, -0.66, -0.28), rot=(0.25, 0, 0))],
         "LeafBlower_body", coll, parent=pr)

    pr = Pr("WaterBalloon")
    bake([B(bm_sphere(0.1, 0.1, 0.12), mat("Balloon", "#29B6F6", 0.1), (0, 0, -0.14), smooth=True),
          B(bm_cyl(0.012, 0.02, 0.03, 8), mat("Balloon", "#29B6F6", 0.1), (0, 0, -0.02))], "WaterBalloon_body", coll, parent=pr)

    pr = Pr("RollingPin")      # held in the middle, sideways (it's a THREAT)
    bake([B(bm_cyl(0.045, 0.045, 0.34, 14, "X"), mat("PinWood", "#D7B48A", 0.6), (0, 0, -0.04), smooth=True),
          B(bm_cyl(0.018, 0.018, 0.12, 8, "X"), WOODH, (0.23, 0, -0.04)), B(bm_cyl(0.018, 0.018, 0.12, 8, "X"), WOODH, (-0.23, 0, -0.04))], "RollingPin_body", coll, parent=pr)

    pr = Pr("Nerf")            # pistol grip in the fist, the barrel forward
    NO = mat("NerfOrange", "#FF8F00", 0.5)
    NB = mat("NerfBlue", "#1E88E5", 0.5)
    bake([B(bm_box(0.05, 0.06, 0.12), NB, (0, 0, -0.04)), B(bm_box(0.07, 0.3, 0.08), NO, (0, -0.1, 0.04)).bevel(0.02, 1),
          B(bm_cyl(0.035, 0.035, 0.1, 12, "Y"), NB, (0, -0.0, 0.08)), B(bm_cyl(0.02, 0.02, 0.04, 10, "Y"), NB, (0, -0.27, 0.04))], "Nerf_body", coll, parent=pr)

    pr = Pr("Dart")            # a foam dart flying along -Y
    bake([B(bm_cyl(0.014, 0.014, 0.09, 8, "Y"), mat("DartFoam", "#42A5F5", 0.9), (0, 0, 0)),
          B(bm_sphere(0.016, 0.012, 0.016), mat("DartTip", "#FF7043", 0.6), (0, -0.05, 0), smooth=True)], "Dart_body", coll, parent=pr)

    pr = Pr("Phone")           # the corded handset, at the ear
    PH = mat("HandsetBeige", "#E8DCC0", 0.5)
    bake([B(bm_box(0.05, 0.05, 0.22), PH, (0, 0, -0.06)).bevel(0.015, 2), B(bm_box(0.06, 0.07, 0.05), PH, (0, -0.02, 0.05)),
          B(bm_box(0.06, 0.07, 0.05), PH, (0, -0.02, -0.17)), B(bm_torus(0.03, 0.006, 10, 4), mat("CordBeige", "#D6C8A8", 0.6), (0, 0.02, -0.25), rot=(0, math.pi / 2, 0))],
         "Phone_body", coll, parent=pr)

    pr = Pr("AirHorn")
    bake([B(bm_cyl(0.035, 0.035, 0.14, 12), mat("HornCan", "#E53935", 0.4), (0, 0, -0.08)),
          B(bm_cyl(0.015, 0.05, 0.14, 12, "Y"), WHITE, (0, -0.08, 0.02)), B(bm_box(0.03, 0.03, 0.03), BLACK, (0, 0, 0.01))], "AirHorn_body", coll, parent=pr)

    pr = Pr("Pepper")
    bake([B(bm_cyl(0.022, 0.022, 0.12, 10), mat("PepperCan", "#2E7D32", 0.4), (0, 0, -0.06)), B(bm_box(0.026, 0.03, 0.02), BLACK, (0, -0.01, 0.01))], "Pepper_body", coll, parent=pr)

    pr = Pr("Disguise")        # the classic: glasses, a big nose, a mustache (worn on the face; origin at the nose bridge)
    GL = mat("GrouchoBlack", "#111111", 0.4)
    bake([B(bm_torus(0.045, 0.008, 12, 4), GL, (0.06, 0, 0), rot=(math.pi / 2, 0, 0)), B(bm_torus(0.045, 0.008, 12, 4), GL, (-0.06, 0, 0), rot=(math.pi / 2, 0, 0)),
          B(bm_sphere(0.04, 0.05, 0.045), mat("GrouchoNose", "#F4A79A", 0.6), (0, -0.04, -0.04), smooth=True),
          B(bm_sphere(0.075, 0.02, 0.025), GL, (0, -0.03, -0.09), smooth=True), B(bm_box(0.13, 0.01, 0.025), GL, (0, 0, 0.05))], "Disguise_body", coll, parent=pr)

    pr = Pr("SnowGlobe")
    bake([B(bm_cyl(0.06, 0.07, 0.05, 14), mat("GlobeBase", "#5D4037", 0.6), (0, 0, -0.03)), B(bm_sphere(0.07), mat("Glass", "#BFE6FF", 0.05), (0, 0, 0.06), smooth=True),
          B(bm_box(0.04, 0.03, 0.05), mat("GlobeHouse", "#EF5350", 0.6), (0, 0, 0.04))], "SnowGlobe_body", coll, parent=pr)

    pr = Pr("Spoon")
    bake([B(bm_cyl(0.008, 0.008, 0.18, 6), STEEL, (0, 0, -0.05)), B(bm_sphere(0.03, 0.02, 0.04), STEEL, (0, 0, -0.16), smooth=True)], "Spoon_body", coll, parent=pr)

    _spread(items, 1.2)
    return coll


# ═════════════════════════════════════════════════════════════════════════
#  THE STREET PROPS (the crowd's)
# ═════════════════════════════════════════════════════════════════════════
def build_street():
    coll = scene_coll("HomesStreet")
    root = root_empty(coll, "HomesStreet")
    items = []
    Pr = lambda name: _sub(coll, root, "Prop_", name, items)
    B = lambda bm, m, loc, rot=(0, 0, 0), smooth=False: P(coll, bm, m, loc, rot, smooth)
    BLACK = mat("StBlack", "#212121", 0.5)
    STEEL = mat("StSteel", "#B0BEC5", 0.35, 0.7)
    WOOD = mat("StWood", "#A1724E", 0.7)

    # stroller: on the ground, the handle at -Y... no: the mom walks behind it, so the HANDLE is at +Y, it rolls along -Y
    pr = Pr("Stroller")
    CAN = mat("Canopy", "#26A69A", 0.8)
    parts = [B(bm_box(0.42, 0.62, 0.3), CAN, (0, 0, 0.55)).bevel(0.06, 2), B(bm_sphere(0.24, 0.3, 0.24), CAN, (0, 0.18, 0.78), smooth=True),
             B(bm_cyl(0.012, 0.012, 0.75, 6), STEEL, (0.2, 0.32, 0.65), rot=(0.55, 0, 0)), B(bm_cyl(0.012, 0.012, 0.75, 6), STEEL, (-0.2, 0.32, 0.65), rot=(0.55, 0, 0)),
             B(bm_cyl(0.018, 0.018, 0.44, 8, "X"), BLACK, (0, 0.52, 0.95)), B(bm_box(0.3, 0.4, 0.04), mat("BabyBlanketSt", "#FFF59D", 0.9), (0, -0.05, 0.71))]
    for x in (-0.2, 0.2):
        for y in (-0.25, 0.25):
            parts.append(B(bm_cyl(0.09, 0.09, 0.035, 12, "X"), BLACK, (x, y, 0.09)))
            parts.append(B(bm_cyl(0.01, 0.01, 0.4, 5), STEEL, (x, y, 0.3)))
    bake(parts, "Stroller_body", coll, parent=pr)

    pr = Pr("Scooter")         # the kid stands on it; rolls along -Y
    SC = mat("ScooterDeck", "#E91E63", 0.4)
    bake([B(bm_box(0.13, 0.62, 0.035), SC, (0, 0, 0.09)), B(bm_cyl(0.02, 0.02, 0.8, 8), STEEL, (0, -0.3, 0.5), rot=(-0.12, 0, 0)),
          B(bm_cyl(0.016, 0.016, 0.4, 8, "X"), STEEL, (0, -0.35, 0.9)), B(bm_cyl(0.06, 0.06, 0.03, 12, "X"), BLACK, (0, -0.3, 0.06)),
          B(bm_cyl(0.06, 0.06, 0.03, 12, "X"), BLACK, (0, 0.3, 0.06))], "Scooter_body", coll, parent=pr)

    pr = Pr("LemonadeStand")   # the kid stands behind it (+Y); the sign faces the street (-Y)
    YL = mat("LemonYellow", "#FFEB3B", 0.6)
    parts = [B(bm_box(1.2, 0.6, 0.05), WOOD, (0, 0, 0.75)), B(bm_box(1.2, 0.03, 0.55), YL, (0, -0.3, 0.5)),
             B(bm_box(0.05, 0.05, 1.5), WOOD, (-0.57, -0.27, 0.75)), B(bm_box(0.05, 0.05, 1.5), WOOD, (0.57, -0.27, 0.75)),
             B(bm_box(0.05, 0.05, 0.75), WOOD, (-0.57, 0.27, 0.37)), B(bm_box(0.05, 0.05, 0.75), WOOD, (0.57, 0.27, 0.37)),
             B(bm_box(1.25, 0.04, 0.32), mat("LemonSign", "#FFFDE7", 0.8), (0, -0.28, 1.4)),
             B(bm_cyl(0.07, 0.06, 0.2, 12), mat("Glass", "#BFE6FF", 0.05), (-0.25, 0, 0.88)), B(bm_cyl(0.06, 0.05, 0.16, 12), YL, (-0.25, 0, 0.87))]
    for i in range(4):
        parts.append(B(bm_cyl(0.03, 0.025, 0.08, 8), mat("Cup", "#FFFFFF", 0.6), (0.1 + i * 0.1, -0.05, 0.82)))
    txt = bm_text("LEMONADE 25¢", 0.15, 0.01)
    bmesh.ops.rotate(txt, verts=txt.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
    parts.append(B(txt, mat("LemonText", "#E65100", 0.6), (0, -0.305, 1.39)))
    bake(parts, "LemonadeStand_body", coll, parent=pr)

    pr = Pr("Rake")            # in the fist, the tines down on the ground ahead
    bake([B(bm_cyl(0.016, 0.016, 1.5, 6), WOOD, (0, -0.25, -0.55), rot=(0.35, 0, 0)), B(bm_box(0.45, 0.04, 0.05), mat("RakeGreen", "#43A047", 0.5), (0, -0.52, -1.27))] +
         [B(bm_box(0.012, 0.012, 0.14), mat("RakeGreen", "#43A047", 0.5), (x, -0.56, -1.34)) for x in (-0.2, -0.12, -0.04, 0.04, 0.12, 0.2)], "Rake_body", coll, parent=pr)

    pr = Pr("Shovel")
    bake([B(bm_cyl(0.016, 0.016, 1.2, 6), WOOD, (0, -0.2, -0.45), rot=(0.35, 0, 0)), B(bm_box(0.36, 0.3, 0.025), mat("ShovelBlue", "#1E88E5", 0.4), (0, -0.48, -1.08), rot=(0.25, 0, 0))],
         "Shovel_body", coll, parent=pr)

    pr = Pr("Hose")            # the nozzle in the fist + a coil of hose on the ground behind
    HG = mat("HoseGreen", "#2E7D32", 0.5)
    bake([B(bm_cyl(0.018, 0.012, 0.16, 8, "Y"), mat("Nozzle", "#FBC02D", 0.4), (0, -0.06, -0.02)), B(bm_cyl(0.012, 0.012, 0.6, 6), HG, (0, 0.05, -0.32), rot=(-0.2, 0, 0))],
         "Hose_body", coll, parent=pr)
    pr = Pr("HoseCoil")
    bake([B(bm_torus(0.28, 0.02, 18, 5), HG, (0, 0, 0.02)), B(bm_torus(0.24, 0.02, 18, 5), HG, (0, 0, 0.06)), B(bm_torus(0.2, 0.02, 18, 5), HG, (0, 0, 0.1))], "HoseCoil_body", coll, parent=pr)

    pr = Pr("Bucket")
    bake([B(bm_cyl(0.16, 0.13, 0.3, 14), mat("BucketRed", "#E53935", 0.5), (0, 0, 0.15)),
          B(bm_sphere(0.15, 0.15, 0.06), mat("Suds", "#FFFFFF", 0.9), (0, 0, 0.3), smooth=True),
          B(bm_box(0.12, 0.07, 0.05), mat("Sponge", "#FFEB3B", 0.95), (0.05, 0, 0.36))], "Bucket_body", coll, parent=pr)

    pr = Pr("MailBag")         # on the hip (worn on the body)
    bake([B(bm_box(0.36, 0.14, 0.3), mat("MailBagBlue", "#283593", 0.7), (0, 0, 0)).bevel(0.03, 2),
          B(bm_box(0.36, 0.15, 0.08), mat("MailFlap", "#1A237E", 0.7), (0, -0.005, 0.12)),
          B(bm_box(0.2, 0.08, 0.06), mat("Letters", "#FFFFFF", 0.8), (0.05, 0, 0.17))], "MailBag_body", coll, parent=pr)

    pr = Pr("DeliveryBag")     # the cube on the e-bike's rack
    bake([B(bm_box(0.45, 0.45, 0.42), mat("DeliveryGreen", "#00C853", 0.6), (0, 0, 0.21)).bevel(0.03, 2),
          B(bm_box(0.3, 0.46, 0.1), mat("DeliveryWhite", "#FFFFFF", 0.6), (0, 0, 0.25))], "DeliveryBag_body", coll, parent=pr)

    pr = Pr("LeafPile")
    parts = []
    import random
    rnd = random.Random(3)
    LEAVES = [mat("LeafOrange", "#EF6C00", 0.9), mat("LeafRed", "#C62828", 0.9), mat("LeafGold", "#F9A825", 0.9), mat("LeafBrown", "#8D6E63", 0.9)]
    for i in range(16):
        a, r = rnd.uniform(0, math.tau), rnd.uniform(0, 0.45)
        parts.append(B(bm_ico(rnd.uniform(0.12, 0.2), 1), LEAVES[i % 4], (math.cos(a) * r, math.sin(a) * r, 0.08 + (0.45 - r) * 0.35)))
    bake(parts, "LeafPile_body", coll, parent=pr)

    pr = Pr("SnowPile")
    bake([B(bm_sphere(0.55, 0.45, 0.28), mat("Snow", "#F4F8FB", 0.95), (0, 0, 0.12), smooth=True), B(bm_sphere(0.3, 0.3, 0.2), mat("Snow", "#F4F8FB", 0.95), (0.3, 0.2, 0.25), smooth=True)],
         "SnowPile_body", coll, parent=pr)

    pr = Pr("Rocker")          # a porch rocking chair (you sit facing -Y)
    RK = mat("RockerWhite", "#F5F5F5", 0.6)
    parts = [B(bm_box(0.5, 0.48, 0.05), RK, (0, 0, 0.44)), B(bm_box(0.5, 0.05, 0.62), RK, (0, 0.24, 0.78), rot=(-0.15, 0, 0))]
    for x in (-0.23, 0.23):
        parts.append(B(bm_box(0.04, 0.8, 0.04), RK, (x, 0, 0.03)).bevel(0.015, 1))
        parts.append(B(bm_box(0.035, 0.12, 0.04), RK, (x, -0.42, 0.06), rot=(-0.5, 0, 0)))
        parts.append(B(bm_box(0.035, 0.12, 0.04), RK, (x, 0.42, 0.06), rot=(0.5, 0, 0)))
        parts.append(B(bm_box(0.04, 0.04, 0.4), RK, (x, -0.18, 0.24)))
        parts.append(B(bm_box(0.04, 0.04, 0.4), RK, (x, 0.18, 0.24)))
    bake(parts, "Rocker_body", coll, parent=pr)

    pr = Pr("Newspaper")       # held open in both hands in front of the face (origin = the right hand)
    bake([B(bm_box(0.52, 0.01, 0.36), mat("Newsprint", "#ECE8DC", 0.95), (0.24, -0.05, 0.1)),
          B(bm_box(0.44, 0.012, 0.05), mat("Headline", "#212121", 0.8), (0.24, -0.052, 0.22))] +
         [B(bm_box(0.2, 0.012, 0.012), mat("NewsInk", "#757575", 0.9), (0.24 + (i % 2) * 0.22 - 0.11, -0.052, 0.12 - (i // 2) * 0.04)) for i in range(8)],
         "Newspaper_body", coll, parent=pr)

    pr = Pr("Kickball")
    bake([B(bm_sphere(0.14, u=14, v=10), mat("KickRed", "#E53935", 0.5), (0, 0, 0.14), smooth=True)], "Kickball_body", coll, parent=pr)

    _spread(items, 2.0)
    return coll


# ═════════════════════════════════════════════════════════════════════════
#  FOUR LEGS: the family cat, the dog on the leash
# ═════════════════════════════════════════════════════════════════════════
def _animal(name, fur, fur2, scale, ears="cat", tail_up=True):
    coll = scene_coll(name)
    root = root_empty(coll, name)
    s = scale
    F = mat("Fur", fur, 0.9)
    F2 = mat("Fur2", fur2, 0.9)
    BLK = mat("AnimalEye", "#111111", 0.3)
    NOSE = mat("AnimalNose", "#F48FB1" if ears == "cat" else "#212121", 0.5)
    B = lambda bm, m, loc, rot=(0, 0, 0), smooth=True: Part(coll, "an", bm, m, loc=loc, rot=rot, smooth=smooth)
    hip_z, fy, by = 0.26 * s, -0.2 * s, 0.2 * s
    body = [B(bm_sphere(0.14 * s, 0.3 * s, 0.13 * s), F, (0, 0, 0.32 * s)),
            B(bm_sphere(0.12 * s, 0.12 * s, 0.11 * s), F, (0, -0.32 * s, 0.46 * s)),
            B(bm_sphere(0.06 * s, 0.05 * s, 0.045 * s), F2, (0, -0.42 * s, 0.43 * s)),
            B(bm_sphere(0.018 * s), NOSE, (0, -0.47 * s, 0.45 * s)),
            B(bm_sphere(0.02 * s), BLK, (0.05 * s, -0.42 * s, 0.5 * s)), B(bm_sphere(0.02 * s), BLK, (-0.05 * s, -0.42 * s, 0.5 * s))]
    if ears == "cat":
        for sx in (-1, 1):
            body.append(B(bm_cyl(0.04 * s, 0.0, 0.09 * s, 4), F, (sx * 0.065 * s, -0.3 * s, 0.58 * s), rot=(0, sx * 0.25, 0), smooth=False))
        for sx in (-1, 1):
            for k in (0, 1):
                body.append(B(bm_cyl(0.002 * s, 0.002 * s, 0.12 * s, 4), mat("Whisker", "#FFFFFF", 0.4), (sx * 0.08 * s, -0.44 * s, 0.44 * s + k * 0.015 * s), rot=(0, math.pi / 2, sx * 0.15)))
    else:
        for sx in (-1, 1):
            body.append(B(bm_sphere(0.04 * s, 0.03 * s, 0.09 * s), F2, (sx * 0.1 * s, -0.3 * s, 0.47 * s), rot=(0, sx * 0.4, 0)))
        body.append(B(bm_torus(0.07 * s, 0.012 * s, 14, 4), mat("Collar", "#E53935", 0.5), (0, -0.25 * s, 0.4 * s), rot=(1.2, 0, 0)))
    bake(body, "Body", coll, parent=root)
    for nm, sx, sy in (("Leg_FL", 1, -1), ("Leg_FR", -1, -1), ("Leg_BL", 1, 1), ("Leg_BR", -1, 1)):
        hp = (sx * 0.08 * s, sy * by, hip_z + 0.04 * s)
        bake_at([B(bm_cyl(0.035 * s, 0.03 * s, hip_z, 8), F, (hp[0], hp[1], hp[2] - hip_z / 2)),
                 B(bm_sphere(0.035 * s, 0.045 * s, 0.025 * s), F2, (hp[0], hp[1] - 0.01 * s, 0.025 * s))], nm, coll, root, hp)
    tp = (0, 0.28 * s, 0.38 * s)
    tl = 0.3 * s
    bake_at([B(bm_cyl(0.03 * s, 0.018 * s, tl, 8), F2 if ears == "cat" else F, (0, tp[1] + 0.05 * s, tp[2] + tl / 2 * (0.9 if tail_up else 0.4)),
               rot=(-0.3 if tail_up else -1.1, 0, 0))], "Tail", coll, root, tp)
    return coll


ASSETS = [
    ("homes_kit", build_kit),
    ("homes_items", build_items),
    ("homes_street", build_street),
    ("homes_bubbe", lambda: build_person("HomesBubbe", dict(hair="bun", hair_color="#CFCFCF", top="#8E5BA8", sleeves="long", bottom="skirt",
                                                            bottom_color="#4A3B5C", shoes="#5D4037", height=1.5, width=1.18,
                                                            extras=["glasses", "apron", "necklace", "belly"], extra_colors={"Apron": "#FFF8E1", "Glasses": "#8D6E63"}))),
    ("homes_dad", lambda: build_person("HomesDad", dict(hair="short", hair_color="#3E2723", skin="#F3C9A8", top="#F3C9A8", sleeves="short", bottom="skirt",
                                                        bottom_color="#FFFFFF", shoes="#4FC3F7", height=1.72, width=1.15,
                                                        extras=["beard", "kippah", "belly"], extra_colors={"Beard": "#3E2723", "Kippah": "#212121"}))),
    ("homes_mom", lambda: build_person("HomesMom", dict(hair="bob", hair_color="#26A69A", top="#5C6BC0", sleeves="long", bottom="skirt",
                                                        bottom_color="#263238", shoes="#3E2723", extras=["apron", "headband", "earrings"],
                                                        extra_colors={"Apron": "#FFCDD2", "Headband": "#00897B"}))),
    ("homes_boy", lambda: build_person("HomesBoy", dict(hair="short", hair_color="#4E342E", top="#FFFFFF", sleeves="long", bottom="pants",
                                                        bottom_color="#212121", shoes="#212121", height=1.18, extras=["kippah", "tzitzit"],
                                                        extra_colors={"Kippah": "#1565C0"}))),
    ("homes_girl", lambda: build_person("HomesGirl", dict(hair="pigtails", hair_color="#6D4C41", top="#F06292", sleeves="long", bottom="skirt",
                                                          bottom_color="#5E35B1", shoes="#E91E63", height=1.12, extras=["bow"],
                                                          extra_colors={"HairTie": "#FFEB3B", "Bow": "#FFEB3B"}))),
    ("homes_baby", lambda: build_person("HomesBaby", dict(hair="short", hair_color="#FFCC80", top="#B3E5FC", sleeves="long", bottom="pants",
                                                          bottom_color="#B3E5FC", shoes="#FFFFFF", height=0.72, kid=True, width=1.25,
                                                          extras=["apron"], extra_colors={"Apron": "#FFFFFF"}))),
    ("homes_mail", lambda: build_person("HomesMail", dict(hair="short", hair_color="#5D4037", top="#90CAF9", sleeves="short", bottom="pants",
                                                          bottom_color="#1A237E", shoes="#212121", extras=["cap", "mustache", "badge"],
                                                          extra_colors={"Hat": "#1A237E", "Beard": "#5D4037"}))),
    ("homes_delivery", lambda: build_person("HomesDelivery", dict(hair="short", hair_color="#212121", top="#00C853", sleeves="long", bottom="pants",
                                                                  bottom_color="#37474F", shoes="#ECEFF1", extras=["cap"], extra_colors={"Hat": "#00C853"}))),
    ("homes_cat", lambda: _animal("HomesCat", "#F5A623", "#FFF3E0", 0.8, "cat", True)),
    ("homes_dog", lambda: _animal("HomesDog", "#C8A27A", "#6D4C41", 1.0, "dog", True)),
]
