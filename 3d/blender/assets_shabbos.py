"""
Erev Shabbos Rush (feature "shabbos"): beat the sunset to Bubbe's before candle-lighting.

    shabbos_porch     Bubbe's front door (Door: hinge pivot, swings out) + the warm DoorGlow behind
                      it + a little porch table with two candlesticks (Flame_1 / Flame_2) and a
                      covered challah. Built in BUBBE'S HOUSE's own frame (assets_core
                      build_bubbe_house: front = -Y, door at y = -4.29), so the game drops it on
                      the house's transform and everything lines up.
    shabbos_shop      a little storefront whose roll-down Gate (pivot at the top: scale it to
                      lower it) comes down as Shabbos gets close; Anchor_sign for the name board
    shabbos_sign      a flashing LED message trailer ("SHABBOS IN 3 MIN"); Anchor_screen for
                      the canvas screen the game paints
    shabbos_challah   a woman hurrying home with a big braided challah (lib_people limbs)
    shabbos_cholent   a guy JOGGING with the cholent pot (still hot!)
    shabbos_bekishe   a man in a long black bekishe + hat, towel over the shoulder: mikvah run

Conventions (3d/ARCHITECTURE.md): metres, FRONT = Blender -Y (= +Z in three.js).
Materials named Neon* glow; low-poly, one baked object per moving part.
"""
from lib import *
from lib_people import build_person


def setup():
    global S
    S = shared()


def P(coll, nm, bm, m, loc=(0, 0, 0), rot=(0, 0, 0), smooth=True):
    return Part(coll, nm, bm, m, loc=loc, rot=rot, smooth=smooth)


def geom(spec):
    """The proportions lib_people.build_person uses (for props that sit on a person)."""
    H = spec.get("height", 1.62)
    kid = spec.get("kid", H < 1.35)
    k = H / 1.62
    hk = k * (1.22 if kid else 1.0)
    neck_z = 1.37 * k
    head_r = 0.19 * hk
    head_z = neck_z + head_r * 0.95
    return SimpleNamespace(k=k, hr=head_r, hz=head_z, neck=neck_z, chest=1.14 * k, sh=1.30 * k, waist=0.98 * k,
                           sx=0.22 * k * spec.get("width", 1.0))


def person(name, spec, extra=None):
    """build_person + extra parts baked into a child of Body (so they bob with the torso)."""
    coll = build_person(name, spec)
    if extra:
        parts = extra(coll, geom(spec))
        if parts:
            body = [o for o in coll.objects if o.name.startswith("Body")][0]
            bake(parts, name + "Extra", coll, parent=body)
    return coll


def flame(coll, root, name, x, y, z, s=1.0):
    """A teardrop candle flame standing on (x, y, z), origin at the wick (the game flickers it)."""
    F = mat("NeonFlame", "#FFB300", rough=0.4, emit=4.0)
    C = mat("NeonFlameCore", "#FFF59D", rough=0.4, emit=6.0)
    parts = [P(coll, name + "_o", bm_sphere(0.022 * s, 0.022 * s, 0.042 * s, 10, 6), F, loc=(x, y, z + 0.04 * s)),
             P(coll, name + "_t", bm_cyl(0.016 * s, 0.0, 0.04 * s, 8), F, loc=(x, y, z + 0.09 * s)),
             P(coll, name + "_c", bm_sphere(0.01 * s, 0.01 * s, 0.02 * s, 6, 4), C, loc=(x, y - 0.006 * s, z + 0.032 * s))]
    return bake_at(parts, name, coll, root, (x, y, z))


# ═══════════════════════════ Bubbe's porch (house frame) ═══════════════════
def build_porch():
    coll = scene_coll("ShabbosPorch")
    root = root_empty(coll, "ShabbosPorch")
    DOOR = mat("BubbeDoor", "#1E5AA8", rough=0.6)
    TRIM = mat("Trim", "#FFFFFF", rough=0.7)
    GLOW = mat("NeonDoorGlow", "#FFD08A", rough=0.9, emit=2.2)
    CLOTH = mat("Tablecloth", "#FFFDF5", rough=0.85)
    SILVER = mat("Silver", "#D9DEE3", rough=0.18, metal=0.9)
    WAX = mat("CandleWhite", "#FFFDF5", rough=0.6)
    WOOD = mat("Wood", "#6D4C41", rough=0.7)
    COVER = mat("ChallahCover", "#5E35B1", rough=0.8)
    GOLD = mat("CoverGold", "#E6B422", rough=0.3, metal=0.7)
    # the door: hinge on its -X edge, 7 cm in front of the house's own (baked) door
    hx, dy = -0.56, -4.395
    door = [P(coll, "slab", bm_box(1.12, 0.05, 2.12), DOOR, loc=(0, dy, 1.06), smooth=False),
            P(coll, "panelT", bm_box(0.72, 0.02, 0.62), TRIM, loc=(0, dy - 0.03, 1.55), smooth=False),
            P(coll, "panelB", bm_box(0.72, 0.02, 0.72), TRIM, loc=(0, dy - 0.03, 0.6), smooth=False),
            P(coll, "panelTi", bm_box(0.62, 0.025, 0.52), DOOR, loc=(0, dy - 0.035, 1.55), smooth=False),
            P(coll, "panelBi", bm_box(0.62, 0.025, 0.62), DOOR, loc=(0, dy - 0.035, 0.6), smooth=False),
            P(coll, "knob", bm_sphere(0.06), S.CHROME, loc=(0.38, dy - 0.07, 1.05))]
    bake_at(door, "Door", coll, root, (hx, dy, 0))
    # the warm hallway light, revealed when the door swings open (the game shows it)
    bake([P(coll, "glow", bm_box(1.08, 0.004, 2.08), GLOW, loc=(0, -4.362, 1.05), smooth=False),
          P(coll, "spill", bm_box(1.5, 1.6, 0.004), GLOW, loc=(0, -5.15, 0.252), smooth=False)], "DoorGlow", coll, parent=root)
    # the candle table on the porch (porch top z = 0.245), left of the door (the journey's
    # cholent table stands on the right, at x = +2.6)
    tx, ty, tz = -1.75, -5.3, 0.245
    top = tz + 0.74
    tab = [P(coll, "leg", bm_cyl(0.05, 0.07, 0.72, 10), WOOD, loc=(tx, ty, tz + 0.36)),
           P(coll, "foot", bm_cyl(0.24, 0.26, 0.04, 14), WOOD, loc=(tx, ty, tz + 0.02)),
           P(coll, "cloth", bm_cyl(0.44, 0.47, 0.3, 20), CLOTH, loc=(tx, ty, top - 0.14)),
           P(coll, "clothTop", bm_cyl(0.44, 0.44, 0.02, 20), CLOTH, loc=(tx, ty, top))]
    # covered challah (front, facing the road)
    tab += [P(coll, "cover", bm_box(0.36, 0.22, 0.09), COVER, loc=(tx + 0.12, ty - 0.12, top + 0.055)).bevel(0.03, 2),
            P(coll, "trim", bm_box(0.37, 0.005, 0.02), GOLD, loc=(tx + 0.12, ty - 0.232, top + 0.05), smooth=False),
            P(coll, "magen", bm_torus(0.035, 0.006, 6, 3), GOLD, loc=(tx + 0.12, ty - 0.12, top + 0.102), smooth=False)]
    wicks = []
    for k, cx in enumerate((tx - 0.2, tx + 0.02)):
        cy = ty + 0.12
        tab += [P(coll, "csBase", bm_cyl(0.07, 0.08, 0.03, 14), SILVER, loc=(cx, cy, top + 0.025)),
                P(coll, "csStem", bm_cyl(0.022, 0.03, 0.26, 10), SILVER, loc=(cx, cy, top + 0.16)),
                P(coll, "csKnop", bm_sphere(0.04, 0.04, 0.03, 10, 6), SILVER, loc=(cx, cy, top + 0.11)),
                P(coll, "csCup", bm_cyl(0.045, 0.03, 0.05, 12), SILVER, loc=(cx, cy, top + 0.3)),
                P(coll, "candle", bm_cyl(0.022, 0.022, 0.22, 10), WAX, loc=(cx, cy, top + 0.43))]
        wicks.append((cx, cy, top + 0.545))
    bake(tab, "ShabbosTable", coll, parent=root)
    for k, (x, y, z) in enumerate(wicks):
        flame(coll, root, "Flame_%d" % (k + 1), x, y, z, 1.6)
    return coll


# ═══════════════════════════ a storefront with a roll-down gate ═══════════
def build_shop():
    coll = scene_coll("ShabbosShop")
    root = root_empty(coll, "ShabbosShop")
    BRICK = mat("ShopBrick", "#B0624A", rough=0.92)
    TRIM = mat("ShopTrim", "#F3E9D8", rough=0.7)
    A1 = mat("AwningA", "#2E7D32", rough=0.8)
    A2 = mat("AwningB", "#FAFAFA", rough=0.8)
    WIN = mat("ShopWindow", "#FFE2A8", rough=0.2, emit=0.6)
    GATE = mat("GateMetal", "#9EA7AE", rough=0.45, metal=0.55)
    DOOR = mat("ShopDoor", "#4E342E", rough=0.7)
    OPEN = mat("NeonOpen", "#FF3D7F", rough=0.4, emit=3.0)
    W, D, H = 7.6, 4.0, 4.3
    fy = -D / 2
    b = [P(coll, "box", bm_box(W, D, H), BRICK, loc=(0, 0, H / 2), smooth=False),
         P(coll, "cornice", bm_box(W + 0.3, 0.35, 0.3), TRIM, loc=(0, fy - 0.05, H + 0.05), smooth=False),
         P(coll, "sill", bm_box(6.6, 0.25, 0.18), TRIM, loc=(0, fy - 0.06, 0.09), smooth=False),
         # the shop front: a big window + a door, set in a trim frame
         P(coll, "frame", bm_box(6.6, 0.06, 3.0), TRIM, loc=(0, fy - 0.02, 1.6), smooth=False),
         P(coll, "window", bm_box(4.2, 0.06, 2.4), WIN, loc=(-1.0, fy - 0.05, 1.5), smooth=False),
         P(coll, "door", bm_box(1.2, 0.06, 2.6), DOOR, loc=(2.2, fy - 0.05, 1.4), smooth=False),
         P(coll, "doorWin", bm_box(0.8, 0.07, 1.0), WIN, loc=(2.2, fy - 0.06, 1.9), smooth=False),
         P(coll, "open", bm_text("OPEN", 0.32, 0.0), OPEN, loc=(-2.2, fy - 0.09, 2.25), rot=(math.pi / 2, 0, 0), smooth=False),
         # the gate housing (the rolled-up shutter lives in here)
         P(coll, "housing", bm_box(6.7, 0.42, 0.42), GATE, loc=(0, fy - 0.22, 3.33), smooth=False),
         # the name board (the game paints the shop's name on Anchor_sign)
         P(coll, "board", bm_box(6.4, 0.12, 0.8), TRIM, loc=(0, fy - 0.08, 3.85), smooth=False)]
    # striped awning over the window
    for i in range(8):
        b.append(P(coll, "stripe", bm_box(0.53, 1.2, 0.05), A1 if i % 2 == 0 else A2, loc=(-3.1 + i * 0.53 + 0.26, fy - 0.6, 2.95),
                   rot=(-0.35, 0, 0), smooth=False))
    bake(b, "ShabbosShop_body", coll, parent=root)
    # the roll-down gate: pivot at its TOP edge, so scaling it (three y) lowers it
    gtop = 3.12
    g = [P(coll, "slats", bm_box(6.5, 0.05, gtop - 0.12), GATE, loc=(0, fy - 0.45, (gtop + 0.12) / 2), smooth=False)]
    for k in range(10):
        g.append(P(coll, "ridge", bm_box(6.5, 0.07, 0.04), GATE, loc=(0, fy - 0.47, 0.25 + k * 0.29), smooth=False))
    g.append(P(coll, "bar", bm_box(6.5, 0.1, 0.1), mat("GateBar", "#5F6B73", rough=0.5, metal=0.6), loc=(0, fy - 0.47, 0.14), smooth=False))
    bake_at(g, "Gate", coll, root, (0, fy - 0.45, gtop))
    anchor(coll, root, "Anchor_sign", (0, fy - 0.15, 3.85))
    return coll


# ═══════════════════════════ the flashing LED message trailer ═════════════
def build_sign():
    coll = scene_coll("ShabbosSign")
    root = root_empty(coll, "ShabbosSign")
    YEL = mat("TrailerYellow", "#F9A825", rough=0.6)
    FRAME = mat("SignFrame", "#37474F", rough=0.6, metal=0.3)
    PANEL = mat("SignPanel", "#0B0B0B", rough=0.5)
    AMBER = mat("NeonAmber", "#FFB300", rough=0.4, emit=3.0)
    b = [P(coll, "bed", bm_box(1.6, 2.2, 0.35), YEL, loc=(0, 0.3, 0.75)).bevel(0.05, 2),
         P(coll, "hitch", bm_box(0.12, 1.2, 0.1), FRAME, loc=(0, 1.9, 0.62), smooth=False),
         P(coll, "mast", bm_box(0.16, 0.16, 1.4), FRAME, loc=(0, 0.3, 1.6), smooth=False),
         P(coll, "panelBack", bm_box(2.9, 0.18, 1.6), FRAME, loc=(0, 0.1, 2.75), smooth=False),
         P(coll, "panel", bm_box(2.7, 0.05, 1.42), PANEL, loc=(0, -0.0, 2.75), smooth=False)]
    for s in (-1, 1):
        b.append(P(coll, "jack", bm_cyl(0.05, 0.05, 0.6, 8), FRAME, loc=(s * 0.7, -0.6, 0.35)))
        b.append(P(coll, "pad", bm_cyl(0.12, 0.12, 0.04, 10), FRAME, loc=(s * 0.7, -0.6, 0.03)))
        b.append(P(coll, "beacon", bm_sphere(0.09, 0.09, 0.07, 10, 6), AMBER, loc=(s * 1.25, 0.1, 3.6)))
    bake(b, "ShabbosSign_body", coll, parent=root)
    for s in (-1, 1):
        wheel(coll, root, "Wheel_%s" % ("L" if s > 0 else "R"), (s * 0.88, 0.3, 0.36), 0.36, 0.22, S.TIRE, S.RIM, S.RIM)
    anchor(coll, root, "Anchor_screen", (0, -0.04, 2.75))
    return coll


# ═══════════════════════════ the people rushing home ═════════════════════
def challah(coll, g):
    """A big glazed six-braid challah, held in front of the chest."""
    DOUGH = mat("Challah", "#C9802A", rough=0.45)
    SEED = mat("Sesame", "#FFF3D6", rough=0.6)
    y, z = -0.27 * g.k, g.chest - 0.16 * g.k
    parts = []
    for i in range(5):
        x = (i - 2) * 0.075 * g.k
        r = (0.06 - abs(i - 2) * 0.008) * g.k
        parts.append(P(coll, "braid", bm_sphere(r * 1.15, r, r * 0.95, 10, 6), DOUGH, loc=(x, y, z + (0.01 if i % 2 else 0))))
    parts.append(P(coll, "top", bm_sphere(0.15 * g.k, 0.05 * g.k, 0.04 * g.k, 12, 6), DOUGH, loc=(0, y, z + 0.05 * g.k)))
    for i in range(6):
        parts.append(P(coll, "seed", bm_sphere(0.008 * g.k), SEED, loc=((i - 2.5) * 0.05 * g.k, y - 0.03 * g.k, z + 0.08 * g.k), smooth=False))
    return parts


def build_challah_lady():
    spec = dict(hair="sheitel", hair_color="#4E342E", top="#5C6BC0", bottom="skirt", bottom_color="#263238", shoes="#212121",
                extras=["earrings"], extra_colors={"Gold": "#FFD54F"})
    return person("ShabbosChallah", spec, challah)


def cholent_pot(coll, g):
    POT = mat("PotBlue", "#1E3A8A", rough=0.35, metal=0.2)
    TOWEL = mat("PotTowel", "#FFCC80", rough=0.9)
    DARK = mat("PotDark", "#1B1B1B", rough=0.5)
    y, z = -0.3 * g.k, g.chest - 0.22 * g.k
    return [P(coll, "pot", bm_cyl(0.17, 0.16, 0.2, 16), POT, loc=(0, y, z)),
            P(coll, "lid", bm_sphere(0.17, 0.17, 0.05, 14, 6), POT, loc=(0, y, z + 0.11)),
            P(coll, "knob", bm_sphere(0.03), DARK, loc=(0, y, z + 0.17)),
            P(coll, "towel", bm_torus(0.175, 0.03, 16, 6), TOWEL, loc=(0, y, z - 0.01))]


def build_cholent_jogger():
    spec = dict(hair="short", hair_color="#3E2723", top="#FAFAFA", sleeves="short", bottom="pants", bottom_color="#212121",
                shoes="#FAFAFA", extras=["kippah", "beard", "tzitzit"], extra_colors={"Kippah": "#0D47A1", "Beard": "#3E2723"})
    return person("ShabbosCholent", spec, cholent_pot)


def mikvah_towel(coll, g):
    T1 = mat("MikvahTowel", "#E3F2FD", rough=0.9)
    T2 = mat("MikvahStripe", "#1E88E5", rough=0.9)
    x = g.sx * 0.9
    return [P(coll, "towelF", bm_box(0.16 * g.k, 0.05 * g.k, 0.42 * g.k), T1, loc=(x, -0.13 * g.k, g.sh - 0.14 * g.k), rot=(0.12, 0, 0)),
            P(coll, "towelB", bm_box(0.16 * g.k, 0.05 * g.k, 0.42 * g.k), T1, loc=(x, 0.13 * g.k, g.sh - 0.14 * g.k), rot=(-0.12, 0, 0)),
            P(coll, "towelTop", bm_box(0.17 * g.k, 0.28 * g.k, 0.05 * g.k), T1, loc=(x, 0, g.sh + 0.06 * g.k)),
            P(coll, "stripe", bm_box(0.165 * g.k, 0.055 * g.k, 0.04 * g.k), T2, loc=(x, -0.135 * g.k, g.sh - 0.3 * g.k), rot=(0.12, 0, 0))]


def build_bekishe():
    # "dress" makes the long coat in the Top colour: a black satin bekishe to the shins
    spec = dict(hair="short", hair_color="#1B1B1B", top="#141414", bottom="dress", shoes="#111111", height=1.7,
                extras=["fedora", "beard", "glasses"], extra_colors={"Hat": "#0A0A0A", "HatBand": "#1A1A1A", "Beard": "#2B2B2B", "Glasses": "#212121"})
    return person("ShabbosBekishe", spec, mikvah_towel)


ASSETS = [
    ("shabbos_porch", build_porch),
    ("shabbos_shop", build_shop),
    ("shabbos_sign", build_sign),
    ("shabbos_challah", build_challah_lady),
    ("shabbos_cholent", build_cholent_jogger),
    ("shabbos_bekishe", build_bekishe),
]
