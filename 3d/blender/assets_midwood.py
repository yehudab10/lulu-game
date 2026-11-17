"""
features/town — MIDWOOD, Brooklyn: the second town you can turn into (3d/js/features/town/,
towns/midwood.js). Reuses Lakewood's kit (assets_town.py: lamps, stop signs, minivans,
the pizza store with the giant slice, the yeshiva block as the high school…) and adds:

  houses      a detached Midwood house (porch, side driveway, a garage out back),
              a row of three attached brick row houses with bay fronts,
              a six-storey pre-war apartment house (fire escape, canopy, water tower)
  avenues     a two-storey brick "taxpayer" store (awning, sign board, AC units upstairs),
              the bakery (a giant braided challah on the roof), the car-service base
              (dispatch window, radio mast), a brick shul (arched windows, Magen David)
  landmarks   Brooklyn Kollege's library + white clock tower, a Georgian college wing,
              the B/Q station (side platforms + canopies over four tracks), a subway car
              (stainless, the route bullet tinted per train), an Ocean Pkwy bench,
              an NYPD sawhorse
  life        a pigeon (Neck / Wing_L/R / Leg_L/R, like the goose), a parked-sedan LOD,
              the alternate-side street sweeper, the car-service driver, a bubby

Same conventions as assets_town.py: the game merges the static pieces into vertex-coloured
clusters, so material NAMES matter (Window / ShopWindow glow at night, LampGlow / Neon* are lit,
Glass is see-through, Walls / Roof / Awning / Paint / Bullet are tinted per placement); text is
an atlas quad at an Anchor_* empty; every asset's FRONT faces Blender -Y (= +Z in three.js).
"""
import math
from lib import *
from lib_people import build_person


def M():
    S = shared()
    return dict(
        S=S,
        TRIM=mat("Trim", "#F4F1EA", rough=0.7),
        WIN=mat("Window", "#8FB8CC", rough=0.15, emit=0.2),
        SHOPWIN=mat("ShopWindow", "#A7D7EE", rough=0.1, emit=0.25),
        DOOR=mat("Door", "#4E342E", rough=0.7),
        DARK=mat("DarkTrim", "#37474F", rough=0.7),
        SIGN=mat("SignBoard", "#F5F1E6", rough=0.8),
        CONC=mat("Concrete", "#BDB8AE", rough=0.95),
        STONE=mat("Limestone", "#D9CFBC", rough=0.9),
        IRON=mat("Iron", "#232629", rough=0.5, metal=0.5),
    )


def B(coll, name, size, material, loc, rot=(0, 0, 0)):
    return Part(coll, name, bm_box(*size), material, loc=loc, rot=rot, smooth=False)


def windows(coll, parts, WIN, xs, y, z, w=1.1, h=1.4, frame=None):
    for x in xs:
        if frame is not None:
            parts.append(B(coll, "wf", (w + 0.22, 0.06, h + 0.22), frame, (x, y + 0.03, z)))
        parts.append(B(coll, "w", (w, 0.1, h), WIN, (x, y, z)))


# ── houses ────────────────────────────────────────────────────────────────
def build_house():
    """A detached Midwood house: 2½ storeys, a front porch with columns, a hip roof, a side
    driveway down to a little garage out back (footprint 12.5 × 15, porch 2.2 proud)."""
    coll = scene_coll("TownMwHouse")
    root = root_empty(coll, "TownMwHouse")
    m = M()
    WALLS, ROOF = mat("Walls", "#E8DCC4", rough=0.9), mat("Roof", "#5D6D7E", rough=0.8)
    hx0, hx1, hy0, hy1, h = -6.25, 2.75, -7.5, 2.5, 6.2
    cx, cy, w, d = (hx0 + hx1) / 2, (hy0 + hy1) / 2, hx1 - hx0, hy1 - hy0
    parts = [B(coll, "body", (w, d, h), WALLS, (cx, cy, h / 2))]
    # a hip roof: a low pyramid-ish prism + a ridge
    parts.append(Part(coll, "roof", bm_prism([(-d / 2 - 0.5, 0), (d / 2 + 0.5, 0), (d / 2 - 1.8, 2.4), (-d / 2 + 1.8, 2.4)], w / 2 + 0.5), ROOF, loc=(cx, cy, h), smooth=False))
    parts.append(Part(coll, "dormer", bm_prism([(-1.0, 0), (1.0, 0), (0, 1.1)], 1.1), ROOF, loc=(cx, hy0 + 1.2, h + 1.0), smooth=False))
    parts.append(B(coll, "dormerw", (1.2, 0.1, 0.8), m["WIN"], (cx, hy0 + 0.25, h + 1.35)))
    fy = hy0 - 0.05
    # porch: deck, columns, roof; a stoop down to the walk
    parts.append(B(coll, "porch", (6.2, 1.9, 0.7), m["CONC"], (cx - 0.4, hy0 - 0.95, 0.35)))
    for x in (cx - 3.3, cx - 0.4, cx + 2.5):
        parts.append(B(coll, "col", (0.26, 0.26, 2.6), m["TRIM"], (x, hy0 - 1.75, 2.0)))
    parts.append(B(coll, "porchroof", (6.6, 2.3, 0.22), ROOF, (cx - 0.4, hy0 - 0.95, 3.4)))
    parts.append(B(coll, "rail", (6.0, 0.06, 0.08), m["TRIM"], (cx - 0.4, hy0 - 1.85, 1.6)))
    parts.append(B(coll, "stoop", (1.6, 0.6, 0.35), m["CONC"], (cx - 0.4, hy0 - 2.2, 0.17)))
    parts.append(B(coll, "door", (1.0, 0.12, 2.1), m["DOOR"], (cx - 0.4, fy, 1.75)))
    parts.append(B(coll, "mez", (0.06, 0.05, 0.24), mat("Mezuzah", "#C9A227", rough=0.3, metal=0.7), (cx + 0.2, fy - 0.06, 2.3), rot=(0, -0.35, 0)))
    windows(coll, parts, m["WIN"], (cx - 2.9, cx + 2.2), fy, 1.9, w=1.2, h=1.4, frame=m["TRIM"])
    windows(coll, parts, m["WIN"], (cx - 2.9, cx - 0.4, cx + 2.2), fy, 4.6, w=1.1, h=1.3, frame=m["TRIM"])
    for sx in (hx0 - 0.05, hx1 + 0.05):
        for y in (hy0 + 2.5, hy0 + 6.5):
            parts.append(B(coll, "sw", (0.1, 1.1, 1.3), m["WIN"], (sx, y, 4.6)))
    parts.append(B(coll, "chim", (0.8, 0.8, 2.0), mat("Brick", "#8E3F33", rough=0.9), (hx0 + 1.0, cy + 2.0, h + 1.6)))
    # the side driveway and the garage out back
    parts.append(B(coll, "drive", (2.9, 13.0, 0.05), m["CONC"], (4.6, -3.2, 0.03)))
    parts.append(B(coll, "garage", (3.3, 4.2, 2.7), WALLS, (4.6, 5.3, 1.35)))
    parts.append(B(coll, "garageroof", (3.6, 4.5, 0.2), ROOF, (4.6, 5.3, 2.8)))
    parts.append(B(coll, "garagedoor", (2.6, 0.1, 2.2), mat("GarageDoor", "#ECEFF1", rough=0.6), (4.6, 3.15, 1.1)))
    # a low hedge along the front lawn
    parts.append(B(coll, "hedge", (w - 0.6, 0.7, 0.8), mat("Hedge", "#4E7D3A", rough=1), (cx - 0.3, -9.2, 0.4)))
    bake(parts, "TownMwHouse_body", coll, parent=root)
    return coll


def build_rowhouse():
    """Three attached two-storey brick row houses with bay fronts and stoops (15.6 × 11)."""
    coll = scene_coll("TownMwRowhouse")
    root = root_empty(coll, "TownMwRowhouse")
    m = M()
    WALLS = mat("Walls", "#9C4A3C", rough=0.9)
    w, d, h = 15.6, 11.0, 7.2
    parts = [B(coll, "body", (w, d, h), WALLS, (0, 0, h / 2)),
             B(coll, "cornice", (w + 0.3, 0.7, 0.5), m["DARK"], (0, -d / 2 - 0.2, h - 0.1))]
    fy = -d / 2 - 0.05
    for i, x in enumerate((-5.2, 0, 5.2)):
        # the bay: a box proud of the front, two floors, with three windows on each
        parts.append(B(coll, "bay", (3.0, 0.9, h - 1.0), WALLS, (x - 0.8, fy - 0.45, (h - 1.0) / 2 + 0.5)))
        parts.append(B(coll, "baycap", (3.2, 1.1, 0.25), m["STONE"], (x - 0.8, fy - 0.5, h - 0.4)))
        for z in (2.0, 4.9):
            parts.append(B(coll, "bw", (2.2, 0.1, 1.4), m["WIN"], (x - 0.8, fy - 0.92, z)))
            parts.append(B(coll, "sill", (2.5, 0.2, 0.12), m["STONE"], (x - 0.8, fy - 0.98, z - 0.8)))
        parts.append(B(coll, "door", (1.0, 0.12, 2.1), m["DOOR"], (x + 1.6, fy, 2.0)))
        parts.append(B(coll, "lintel", (1.4, 0.16, 0.2), m["STONE"], (x + 1.6, fy - 0.04, 3.2)))
        parts.append(B(coll, "stoop", (1.4, 1.8, 0.95), m["STONE"], (x + 1.6, fy - 0.9, 0.47)))
        parts.append(B(coll, "railing", (0.05, 1.8, 0.9), m["IRON"], (x + 2.3, fy - 0.9, 1.4)))
        windows(coll, parts, m["WIN"], (x + 1.6,), fy, 4.9, w=1.0, h=1.3)
    bake(parts, "TownMwRowhouse_body", coll, parent=root)
    return coll


def build_apts():
    """A six-storey pre-war apartment house (24 × 16): limestone base, brick, a cornice, a
    zig-zag fire escape, an entrance canopy (its name at Anchor_sign) and a water tower."""
    coll = scene_coll("TownMwApts")
    root = root_empty(coll, "TownMwApts")
    m = M()
    WALLS = mat("Walls", "#A85A44", rough=0.9)
    w, d, h = 24.0, 16.0, 19.6
    parts = [B(coll, "body", (w, d, h), WALLS, (0, 0, h / 2)),
             B(coll, "base", (w + 0.2, d + 0.2, 3.4), m["STONE"], (0, 0, 1.7)),
             B(coll, "cornice", (w + 0.9, d + 0.9, 0.7), m["STONE"], (0, 0, h - 0.2)),
             B(coll, "parapet", (w, d, 0.6), WALLS, (0, 0, h + 0.4))]
    fy = -d / 2 - 0.05
    cols = [-10.2 + k * 2.55 for k in range(9)]
    for f in range(6):
        z = 4.6 + f * 2.55 if f else 2.0
        windows(coll, parts, m["WIN"], [x for x in cols if not (f == 0 and abs(x) < 2.6)], fy, z, w=1.15, h=1.5)
    for sx in (-w / 2 - 0.05, w / 2 + 0.05):
        for f in range(1, 6):
            for y in (-4.0, 0.0, 4.0):
                parts.append(B(coll, "sw", (0.1, 1.15, 1.5), m["WIN"], (sx, y, 4.6 + (f - 1) * 2.55 + 2.55)))
    # the fire escape: a balcony per floor + its ladder
    IRON = m["IRON"]
    for f in range(1, 6):
        z = 3.9 + f * 2.55
        parts.append(B(coll, "fe", (4.4, 1.0, 0.08), IRON, (6.4, fy - 0.5, z)))
        parts.append(B(coll, "fer", (4.4, 0.05, 0.9), IRON, (6.4, fy - 1.0, z + 0.45)))
        parts.append(B(coll, "fel", (0.5, 0.06, 2.8), IRON, (6.4 + (1.6 if f % 2 else -1.6), fy - 0.6, z - 1.3), rot=(0, 0.5 if f % 2 else -0.5, 0)))
    # the entrance: steps, doors, a canopy out to the lot line with the building's name
    parts.append(B(coll, "door", (2.4, 0.15, 2.6), mat("GlassDoor", "#3E4A52", rough=0.15, metal=0.3), (0, fy, 1.6)))
    parts.append(B(coll, "canopy", (3.2, 1.6, 0.25), mat("Canopy", "#1B3A2B", rough=0.7), (0, fy - 0.8, 3.3)))
    parts.append(B(coll, "canopyF", (3.2, 0.08, 0.5), mat("Canopy", "#1B3A2B", rough=0.7), (0, fy - 1.6, 3.15)))
    for x in (-1.5, 1.5):
        parts.append(limb(coll, "cpole", (x, fy - 1.55, 0), (x, fy - 1.55, 3.2), 0.04, m["IRON"]))
    parts.append(B(coll, "steps", (3.4, 1.2, 0.3), m["STONE"], (0, fy - 0.6, 0.15)))
    # the water tower
    WOOD = mat("TankWood", "#6D4C41", rough=0.9)
    tx, ty = -6.0, 3.0
    for a, b in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        parts.append(B(coll, "leg", (0.18, 0.18, 2.0), m["IRON"], (tx + a * 1.2, ty + b * 1.2, h + 1.0)))
    parts.append(Part(coll, "tank", bm_cyl(1.8, 1.8, 3.2, 10), WOOD, loc=(tx, ty, h + 3.6), smooth=False))
    parts.append(Part(coll, "tankroof", bm_cyl(2.0, 0.1, 1.4, 10), mat("TankRoof", "#3E2723", rough=0.8), loc=(tx, ty, h + 5.9), smooth=False))
    bake(parts, "TownMwApts_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, fy - 1.66, 3.15))
    return coll


# ── the avenues ───────────────────────────────────────────────────────────
def store_parts(coll, m, AWN, w=10.0, d=13.0, h=7.4):
    """A two-storey brick taxpayer: a shop below (window, door, striped awning, sign board),
    a flat above (windows, AC units), a cornice."""
    WALLS = mat("Walls", "#9C4A3C", rough=0.9)
    parts = [B(coll, "body", (w, d, h), WALLS, (0, 0, h / 2)),
             B(coll, "cornice", (w + 0.3, 0.6, 0.45), m["STONE"], (0, -d / 2 - 0.15, h - 0.1)),
             B(coll, "pilL", (0.4, 0.3, 3.6), m["STONE"], (-w / 2 + 0.2, -d / 2 - 0.1, 1.8)),
             B(coll, "pilR", (0.4, 0.3, 3.6), m["STONE"], (w / 2 - 0.2, -d / 2 - 0.1, 1.8))]
    fy = -d / 2 - 0.05
    parts.append(B(coll, "glass", (w * 0.6, 0.1, 2.3), m["SHOPWIN"], (-w * 0.13, fy, 1.5)))
    parts.append(B(coll, "door", (1.1, 0.12, 2.3), m["DOOR"], (w * 0.3, fy, 1.15)))
    parts.append(B(coll, "base", (w, 0.2, 0.35), m["DARK"], (0, fy - 0.05, 0.17)))
    for k in range(int(w / 0.9)):
        x = -w / 2 + 0.45 + k * 0.9
        parts.append(B(coll, "awn", (0.9, 1.4, 0.08), AWN if k % 2 == 0 else m["TRIM"], (x, fy - 0.65, 3.1), rot=(0.34, 0, 0)))
    parts.append(B(coll, "sign", (w * 0.88, 0.14, 1.0), m["SIGN"], (0, fy - 0.03, 4.05)))
    windows(coll, parts, m["WIN"], (-w * 0.3, 0, w * 0.3), fy, 5.6, w=1.2, h=1.4, frame=m["STONE"])
    AC = mat("ACUnit", "#D5D8DA", rough=0.6)
    parts.append(B(coll, "ac", (0.7, 0.5, 0.45), AC, (-w * 0.3, fy - 0.25, 4.95)))
    parts.append(B(coll, "ac2", (0.7, 0.5, 0.45), AC, (w * 0.3, fy - 0.25, 4.95)))
    return parts, fy


def build_store():
    coll = scene_coll("TownMwStore")
    root = root_empty(coll, "TownMwStore")
    m = M()
    parts, fy = store_parts(coll, m, mat("Awning", "#2E7D32", rough=0.8))
    bake(parts, "TownMwStore_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, fy - 0.12, 4.05))
    return coll


def build_bakery():
    """CHALLAH-DAY INN: the store with a giant braided challah on the roof (and a tower of them in the window)."""
    coll = scene_coll("TownMwBakery")
    root = root_empty(coll, "TownMwBakery")
    m = M()
    parts, fy = store_parts(coll, m, mat("Awning", "#6D4C41", rough=0.8))
    CRUST = mat("Challah", "#C98A3A", rough=0.6)
    TOP = mat("ChallahTop", "#A86A24", rough=0.5)
    # the braid: three twisted strands of bulges, tapering at the ends
    for strand in range(3):
        for k in range(9):
            t = (k - 4) / 4.0
            r = 0.75 * (1 - 0.45 * abs(t))
            y = 1.0 + 0.32 * math.sin(k * 1.4 + strand * 2.1)
            parts.append(Part(coll, "braid", bm_sphere(r, r * 0.9, r * 0.8, 7, 5), TOP if (k + strand) % 2 else CRUST,
                              loc=(t * 3.4, y + (strand - 1) * 0.3, 7.4 + 0.9 + r * 0.6 + 0.12 * strand), smooth=True))
    parts.append(B(coll, "stand", (0.3, 0.3, 0.9), m["DARK"], (0, 1.0, 7.8)))
    for k in range(4):   # the challah tower in the window
        parts.append(Part(coll, "c", bm_sphere(0.55 - k * 0.08, 0.3, 0.22, 6, 4), CRUST, loc=(-1.3, fy + 0.35, 0.8 + k * 0.42), smooth=True))
    bake(parts, "TownMwBakery_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, fy - 0.12, 4.05))
    return coll


def build_carbase():
    """KINGS WAY KAR SERVICE: a one-storey base with a dispatch window, a forecourt for the cars,
    and a radio mast ("he's around the corner"). Footprint 14 × 12, the forecourt 6.5 proud."""
    coll = scene_coll("TownMwCarbase")
    root = root_empty(coll, "TownMwCarbase")
    m = M()
    w, d, h = 14.0, 12.0, 4.4
    WALLS = mat("Walls", "#CFC2AA", rough=0.9)
    parts = [B(coll, "body", (w, d, h), WALLS, (0, 0, h / 2)),
             B(coll, "cap", (w + 0.3, d + 0.3, 0.35), m["DARK"], (0, 0, h + 0.17))]
    fy = -d / 2 - 0.05
    parts.append(B(coll, "window", (5.0, 0.1, 1.6), m["SHOPWIN"], (-3.0, fy, 1.8)))
    parts.append(B(coll, "door", (1.1, 0.12, 2.3), m["DOOR"], (2.5, fy, 1.15)))
    parts.append(B(coll, "neon", (2.2, 0.08, 0.45), mat("Neon_Open", "#FF1744", rough=0.3, emit=2.0), (-3.0, fy - 0.08, 2.9)))
    parts.append(B(coll, "sign", (12.0, 0.18, 1.2), mat("SignBlack", "#151515", rough=0.7), (0, fy - 0.05, 3.7)))
    parts.append(B(coll, "pad", (w, 6.4, 0.05), m["CONC"], (0, fy - 3.2, 0.03)))
    for x in (-3.2, 0, 3.2):     # painted bays
        parts.append(B(coll, "bay", (0.1, 5.4, 0.02), m["TRIM"], (x - 1.6, fy - 3.2, 0.06)))
    # the radio mast
    parts.append(limb(coll, "mast", (4.5, 3.0, h), (4.5, 3.0, h + 9.0), 0.08, m["IRON"]))
    for z in (h + 3.0, h + 6.0, h + 8.6):
        parts.append(B(coll, "xbar", (1.6, 0.06, 0.06), m["IRON"], (4.5, 3.0, z)))
    parts.append(Part(coll, "beacon", bm_sphere(0.16), mat("Neon_Beacon", "#FF5252", rough=0.3, emit=2.0), loc=(4.5, 3.0, h + 9.1)))
    bake(parts, "TownMwCarbase_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, fy - 0.16, 3.7))
    return coll


def build_shul():
    """A mid-size brick shul: a gabled front with a big arched window, smaller arches either
    side, steps up to double doors, a Magen David up top, the name on a band (Anchor_sign)."""
    coll = scene_coll("TownMwShul")
    root = root_empty(coll, "TownMwShul")
    m = M()
    WALLS = mat("ShulBrick", "#B5654F", rough=0.9)
    w, d, h = 18.0, 16.0, 9.0
    parts = [B(coll, "body", (w, d, h), WALLS, (0, 0, h / 2)),
             Part(coll, "gable", bm_prism([(-d / 2, 0), (d / 2, 0), (0, 3.6)], w / 2), WALLS, loc=(0, 0, h), smooth=False),
             Part(coll, "roof", bm_prism([(-d / 2 - 0.4, -0.1), (d / 2 + 0.4, -0.1), (0, 3.9)], w / 2 + 0.3), mat("ShulRoof", "#4E4E58", rough=0.8), loc=(0, 0, h + 0.15), smooth=False)]
    fy = -d / 2 - 0.05
    STAIN = mat("Window", "#8FB8CC", rough=0.15, emit=0.2)
    # the big arched window (a box + a half-disc top) and two smaller ones each side
    for (x, ww, hh, z) in ((0, 3.0, 3.6, 5.6), (-5.6, 1.6, 2.6, 5.4), (5.6, 1.6, 2.6, 5.4), (-5.6, 1.6, 2.0, 2.0), (5.6, 1.6, 2.0, 2.0)):
        parts.append(B(coll, "aw", (ww, 0.1, hh), STAIN, (x, fy, z)))
        parts.append(Part(coll, "arch", bm_cyl(ww / 2, ww / 2, 0.1, 12, "Y"), STAIN, loc=(x, fy, z + hh / 2), smooth=False))
        parts.append(Part(coll, "archf", bm_cyl(ww / 2 + 0.18, ww / 2 + 0.18, 0.06, 12, "Y"), m["STONE"], loc=(x, fy + 0.04, z + hh / 2), smooth=False))
    parts.append(B(coll, "doors", (2.8, 0.14, 2.8), m["DOOR"], (0, fy, 1.4 + 0.6)))
    parts.append(B(coll, "steps", (5.0, 2.4, 0.6), m["STONE"], (0, fy - 1.2, 0.3)))
    parts.append(B(coll, "band", (8.0, 0.12, 0.8), m["STONE"], (0, fy - 0.02, 3.75)))
    # the Magen David: two triangles in the gable
    GOLD = mat("Gold", "#D4AF37", rough=0.3, metal=0.8)
    for flip in (1, -1):
        parts.append(Part(coll, "star", bm_prism([(-0.75, -0.43 * flip), (0.75, -0.43 * flip), (0, 0.86 * flip)], 0.04), GOLD, loc=(0, fy - 0.08, h + 1.5), rot=(0, 0, math.pi / 2), smooth=False))
    bake(parts, "TownMwShul_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, fy - 0.1, 3.75))
    return coll


# ── the college ───────────────────────────────────────────────────────────
def build_library():
    """Brooklyn Kollege's library: red brick, white trim, a columned portico and the white clock
    tower (square base, clock faces, an octagonal lantern, a spire). Anchor_clock: the front face."""
    coll = scene_coll("TownMwLibrary")
    root = root_empty(coll, "TownMwLibrary")
    m = M()
    BRICK = mat("CollegeBrick", "#9C3F2E", rough=0.9)
    WHITE = mat("CollegeWhite", "#F5F2EA", rough=0.6)
    SLATE = mat("Slate", "#4A4E57", rough=0.8)
    w, d, h = 26.0, 15.0, 11.0
    parts = [B(coll, "body", (w, d, h), BRICK, (0, 0, h / 2)),
             B(coll, "cornice", (w + 0.6, d + 0.6, 0.5), WHITE, (0, 0, h + 0.2)),
             Part(coll, "roof", bm_prism([(-d / 2 - 0.2, 0), (d / 2 + 0.2, 0), (0, 3.2)], w / 2 + 0.2), SLATE, loc=(0, 0, h + 0.45), smooth=False)]
    fy = -d / 2 - 0.05
    for z in (2.4, 6.4):
        windows(coll, parts, m["WIN"], [x for x in (-11, -8.4, -5.8, 5.8, 8.4, 11)], fy, z, w=1.3, h=2.2, frame=WHITE)
    # the portico
    for x in (-3.6, -1.2, 1.2, 3.6):
        parts.append(Part(coll, "col", bm_cyl(0.42, 0.42, 7.6, 12), WHITE, loc=(x, fy - 2.2, 3.8)))
    parts.append(B(coll, "ent", (9.4, 3.0, 0.7), WHITE, (0, fy - 1.6, 7.95)))
    parts.append(Part(coll, "ped", bm_prism([(-1.6, 0), (1.6, 0), (0, 1.8)], 4.7), WHITE, loc=(0, fy - 1.6, 8.3), smooth=False))
    parts.append(B(coll, "door", (2.4, 0.15, 3.4), m["DOOR"], (0, fy, 1.7)))
    parts.append(B(coll, "steps", (10.0, 3.4, 0.5), m["CONC"], (0, fy - 1.7, 0.25)))
    # the tower
    tz0 = h + 0.5
    parts.append(B(coll, "tower", (5.4, 5.4, 9.5), BRICK, (0, 0, tz0 + 4.75)))
    parts.append(B(coll, "tcap", (6.0, 6.0, 0.5), WHITE, (0, 0, tz0 + 9.6)))
    for (x, y, rz) in ((0, -2.75, 0), (0, 2.75, 0), (-2.75, 0, math.pi / 2), (2.75, 0, math.pi / 2)):
        parts.append(Part(coll, "clockrim", bm_cyl(1.35, 1.35, 0.12, 20, "Y"), WHITE, loc=(x, y, tz0 + 7.2), rot=(0, 0, rz), smooth=False))
    parts.append(Part(coll, "lantern", bm_cyl(2.2, 2.2, 3.6, 8), WHITE, loc=(0, 0, tz0 + 11.7), smooth=False))
    for k in range(8):
        a = k / 8 * math.pi * 2
        parts.append(B(coll, "lw", (0.6, 0.1, 2.0), m["WIN"], (math.cos(a) * 2.18, math.sin(a) * 2.18, tz0 + 11.7), rot=(0, 0, a + math.pi / 2)))
    parts.append(Part(coll, "dome", bm_sphere(2.3, 2.3, 1.6, 12, 6), WHITE, loc=(0, 0, tz0 + 13.5)))
    parts.append(Part(coll, "spire", bm_cyl(0.3, 0.02, 4.0, 8), mat("Gold", "#D4AF37", rough=0.3, metal=0.8), loc=(0, 0, tz0 + 16.6), smooth=False))
    bake(parts, "TownMwLibrary_body", coll, parent=root)
    anchor(coll, root, "Anchor_clock", (0, -2.84, tz0 + 7.2))
    return coll


def build_hall():
    """A Georgian college wing: 30 m of red brick, white trim, a portico and a little cupola."""
    coll = scene_coll("TownMwHall")
    root = root_empty(coll, "TownMwHall")
    m = M()
    BRICK = mat("CollegeBrick", "#9C3F2E", rough=0.9)
    WHITE = mat("CollegeWhite", "#F5F2EA", rough=0.6)
    SLATE = mat("Slate", "#4A4E57", rough=0.8)
    w, d, h = 30.0, 12.0, 10.5
    parts = [B(coll, "body", (w, d, h), BRICK, (0, 0, h / 2)),
             B(coll, "cornice", (w + 0.5, d + 0.5, 0.4), WHITE, (0, 0, h + 0.15)),
             Part(coll, "roof", bm_prism([(-d / 2 - 0.2, 0), (d / 2 + 0.2, 0), (0, 2.8)], w / 2 + 0.2), SLATE, loc=(0, 0, h + 0.35), smooth=False)]
    fy = -d / 2 - 0.05
    xs = [-13 + k * 2.6 for k in range(11) if abs(-13 + k * 2.6) > 2.5]
    for z in (2.2, 5.4, 8.4):
        windows(coll, parts, m["WIN"], xs, fy, z, w=1.2, h=1.8, frame=WHITE)
    for x in (-2.0, 2.0):
        parts.append(Part(coll, "col", bm_cyl(0.32, 0.32, 6.0, 10), WHITE, loc=(x, fy - 1.4, 3.0)))
    parts.append(Part(coll, "ped", bm_prism([(-1.0, 0), (1.0, 0), (0, 1.4)], 2.8), WHITE, loc=(0, fy - 1.0, 6.0), smooth=False))
    parts.append(B(coll, "door", (1.8, 0.15, 2.8), m["DOOR"], (0, fy, 1.4)))
    parts.append(B(coll, "cup", (2.0, 2.0, 2.2), WHITE, (0, 0, h + 3.4)))
    parts.append(Part(coll, "cupdome", bm_sphere(1.2, 1.2, 1.0, 10, 6), SLATE, loc=(0, 0, h + 4.6)))
    bake(parts, "TownMwHall_body", coll, parent=root)
    return coll


# ── the B/Q ───────────────────────────────────────────────────────────────
TOP = 5.4     # the embankment's top (rail level) in the game: towns/midwood.js › rail.top


def build_station():
    """A local B/Q station on the embankment: two side platforms (outside the four tracks,
    x ±6.6…9.8) 72 m long at rail level + 1 m, canopies over the middle, windscreens, lamps,
    stair heads. Origin: the avenue's centre on the rail axis, at ground level."""
    coll = scene_coll("TownMwStation")
    root = root_empty(coll, "TownMwStation")
    m = M()
    PLAT = mat("Platform", "#A7A39A", rough=0.9)
    EDGE = mat("PlatformEdge", "#F2C230", rough=0.6)
    GREEN = mat("StationGreen", "#2F4F3E", rough=0.6, metal=0.2)
    CANOPY = mat("Canopy", "#D9DCD6", rough=0.6)
    z = TOP + 1.0
    parts = []
    for s in (-1, 1):
        x = s * 8.2
        parts.append(B(coll, "plat", (3.2, 72.0, 0.35), PLAT, (x, 0, z - 0.17)))
        parts.append(B(coll, "edge", (0.4, 72.0, 0.03), EDGE, (s * 6.8, 0, z + 0.02)))
        for y in range(-33, 34, 6):
            if abs(y) < 12:      # (not down into the avenue that passes under)
                continue
            parts.append(B(coll, "pier", (0.35, 0.35, z - 2.0), GREEN, (s * 9.4, y, (z - 2.0) / 2 + 2.0)))
        # the canopy: posts down the middle of the platform, a roof that overhangs the track edge
        for y in range(-21, 22, 6):
            parts.append(B(coll, "post", (0.18, 0.18, 2.8), GREEN, (s * 8.6, y, z + 1.4)))
        parts.append(B(coll, "roof", (3.8, 46.0, 0.18), CANOPY, (s * 8.0, 0, z + 2.85)))
        parts.append(B(coll, "fascia", (0.1, 46.0, 0.35), GREEN, (s * 6.1, 0, z + 2.75)))
        for y in range(-20, 21, 8):
            parts.append(B(coll, "lamp", (0.5, 1.2, 0.08), mat("LampGlow", "#FFF1C9", rough=0.3, emit=0.6), (s * 7.4, y, z + 2.72)))
        # windscreens along the outer edge, a stair head at the middle
        for y in range(-30, 31, 4):
            if abs(y) < 5:
                continue
            parts.append(B(coll, "screen", (0.06, 3.6, 1.4), mat("Glass", "#9FD8FF", rough=0.05), (s * 9.75, y, z + 0.7)))
        parts.append(B(coll, "stairhead", (1.6, 4.0, 1.1), GREEN, (s * 9.0, 0, z + 0.55)))
        parts.append(B(coll, "bench", (0.5, 2.0, 0.45), mat("BenchWood", "#8D6E63", rough=0.8), (s * 9.2, 10, z + 0.22)))
        parts.append(B(coll, "bench2", (0.5, 2.0, 0.45), mat("BenchWood", "#8D6E63", rough=0.8), (s * 9.2, -10, z + 0.22)))
    bake(parts, "TownMwStation_body", coll, parent=root)
    return coll


def build_train():
    """One stainless-steel subway car (15.2 m, along Blender Y): a window band (glows at night),
    four doors a side, the route bullet on the ends + side signs (material Bullet, tinted per line),
    trucks and an undercarriage. Origin: centre, at rail level."""
    coll = scene_coll("TownMwTrain")
    root = root_empty(coll, "TownMwTrain")
    STEEL = mat("Steel", "#C9CED3", rough=0.35, metal=0.65)
    ROOFM = mat("SteelRoof", "#9EA4AA", rough=0.5, metal=0.5)
    DOORM = mat("Door", "#B5BBC1", rough=0.35, metal=0.6)
    WIN = mat("Window", "#3A4A55", rough=0.1, emit=0.2)
    BUL = mat("Bullet", "#FCCC0A", rough=0.4)
    UNDER = mat("Undercar", "#2B2B2B", rough=0.8)
    L, W = 15.0, 2.9
    parts = [B(coll, "body", (W, L, 2.6), STEEL, (0, 0, 2.15)),
             B(coll, "roof", (W - 0.3, L - 0.2, 0.35), ROOFM, (0, 0, 3.6)),
             B(coll, "under", (W - 0.5, L - 1.2, 0.5), UNDER, (0, 0, 0.65))]
    for sx in (-1, 1):
        parts.append(B(coll, "winband", (0.06, L - 1.0, 0.85), WIN, (sx * (W / 2 + 0.02), 0, 2.55)))
        for y in (-5.4, -1.8, 1.8, 5.4):
            parts.append(B(coll, "door", (0.08, 1.3, 2.0), DOORM, (sx * (W / 2 + 0.03), y, 1.9)))
            parts.append(B(coll, "doorwin", (0.1, 0.9, 0.7), WIN, (sx * (W / 2 + 0.05), y, 2.45)))
        parts.append(B(coll, "sidebullet", (0.08, 0.5, 0.3), BUL, (sx * (W / 2 + 0.05), 7.0, 3.1)))
    for sy in (-1, 1):
        parts.append(B(coll, "end", (W - 0.2, 0.1, 2.4), mat("EndCap", "#8E959C", rough=0.4, metal=0.5), (0, sy * (L / 2 + 0.02), 2.1)))
        parts.append(B(coll, "endwin", (1.0, 0.12, 0.9), WIN, (0, sy * (L / 2 + 0.05), 2.6)))
        parts.append(B(coll, "endbullet", (0.55, 0.12, 0.55), BUL, (0.9, sy * (L / 2 + 0.06), 2.9)))
        # a truck under each end
        parts.append(B(coll, "truck", (2.2, 2.6, 0.55), UNDER, (0, sy * 5.0, 0.4)))
        for wy in (-0.8, 0.8):
            for wx in (-0.75, 0.75):
                parts.append(Part(coll, "wheel", bm_cyl(0.42, 0.42, 0.12, 10, "X"), mat("Tire", "#262626", rough=0.9), loc=(wx, sy * 5.0 + wy, 0.42), smooth=False))
    for k in range(3):   # AC units on the roof
        parts.append(B(coll, "ac", (1.8, 1.6, 0.35), ROOFM, (0, -4.5 + k * 4.5, 3.9)))
    bake(parts, "TownMwTrain_body", coll, parent=root)
    return coll


# ── street furniture ──────────────────────────────────────────────────────
def build_bench():
    """An Ocean Parkway bench: green slats on cast-iron ends (sits facing -Y)."""
    coll = scene_coll("TownMwBench")
    root = root_empty(coll, "TownMwBench")
    SLAT = mat("BenchSlat", "#2E6B3A", rough=0.7)
    IRON = mat("Iron", "#232629", rough=0.5, metal=0.5)
    parts = []
    for k in range(3):
        parts.append(B(coll, "seat", (2.0, 0.12, 0.05), SLAT, (0, -0.15 + k * 0.15, 0.46)))
    for k in range(3):
        parts.append(B(coll, "back", (2.0, 0.05, 0.11), SLAT, (0, 0.24 + k * 0.02, 0.62 + k * 0.15), rot=(-0.25, 0, 0)))
    for x in (-0.85, 0.85):
        parts.append(B(coll, "leg", (0.06, 0.5, 0.44), IRON, (x, 0, 0.22)))
        parts.append(B(coll, "legb", (0.06, 0.08, 0.5), IRON, (x, 0.27, 0.7), rot=(-0.25, 0, 0)))
        parts.append(B(coll, "arm", (0.06, 0.45, 0.05), IRON, (x, 0.0, 0.66)))
    bake(parts, "TownMwBench_body", coll, parent=root)
    return coll


def build_barricade():
    """An NYPD sawhorse: a blue-and-white POLICE LINE rail on two A-frame legs (2.4 m)."""
    coll = scene_coll("TownMwBarricade")
    root = root_empty(coll, "TownMwBarricade")
    BLUE = mat("PoliceBlue", "#1A3E8C", rough=0.6)
    WHITE = mat("PoliceWhite", "#F5F5F5", rough=0.6)
    parts = [B(coll, "rail", (2.4, 0.08, 0.28), BLUE, (0, 0, 0.95))]
    for k in range(5):
        parts.append(B(coll, "txt", (0.3, 0.09, 0.12), WHITE, (-0.9 + k * 0.45, -0.005, 0.95)))
    for x in (-1.0, 1.0):
        for s in (-1, 1):
            parts.append(B(coll, "leg", (0.07, 0.07, 1.1), BLUE, (x, s * 0.22, 0.5), rot=(s * 0.4, 0, 0)))
    bake(parts, "TownMwBarricade_body", coll, parent=root)
    return coll


def build_sedan_lod():
    """A parked sedan for the static clusters (car services, everyone's cousin): plain boxes, tinted Paint."""
    coll = scene_coll("TownMwSedanLod")
    root = root_empty(coll, "TownMwSedanLod")
    S = shared()
    PAINT = mat("Paint", "#1C1C1E", rough=0.35, metal=0.4)
    parts = [B(coll, "body", (1.8, 4.7, 0.7), PAINT, (0, 0, 0.62)),
             B(coll, "cabin", (1.6, 2.3, 0.55), PAINT, (0, 0.25, 1.22)),
             B(coll, "glass", (1.64, 2.0, 0.42), S.TINT, (0, 0.25, 1.24)),
             B(coll, "bumpers", (1.82, 4.86, 0.22), S.DARK, (0, 0, 0.42))]
    for sx in (-1, 1):
        parts.append(B(coll, "head", (0.4, 0.06, 0.14), S.HEAD, (sx * 0.6, -2.36, 0.78)))
        parts.append(B(coll, "tail", (0.35, 0.06, 0.16), S.TAIL, (sx * 0.62, 2.36, 0.82)))
    for x, y in ((0.78, -1.45), (-0.78, -1.45), (0.78, 1.45), (-0.78, 1.45)):
        parts.append(B(coll, "wheel", (0.24, 0.62, 0.62), S.TIRE, (x, y, 0.31)))
    bake(parts, "TownMwSedanLod_body", coll, parent=root)
    return coll


def build_sweeper():
    """The alternate-side street sweeper: a white cab-forward truck with a hopper, a green stripe,
    an amber beacon and the gutter brooms (Wheel_* so the traffic code spins them as it drives)."""
    coll = scene_coll("TownMwSweeper")
    root = root_empty(coll, "TownMwSweeper")
    S = shared()
    BODY = mat("SweeperBody", "#F2F2F2", rough=0.5)
    GREEN = mat("SweeperGreen", "#2E7D32", rough=0.5)
    BROOM = mat("Broom", "#C9A227", rough=0.9)
    parts = [B(coll, "cab", (2.2, 1.8, 1.9), BODY, (0, -1.8, 1.55)),
             B(coll, "wind", (2.0, 0.08, 0.9), S.TINT, (0, -2.72, 2.0)),
             B(coll, "hopper", (2.3, 3.2, 2.1), BODY, (0, 0.8, 1.65)),
             B(coll, "stripe", (2.34, 3.2, 0.25), GREEN, (0, 0.8, 1.1)),
             B(coll, "chassis", (2.1, 5.2, 0.4), S.DARK, (0, 0, 0.6)),
             Part(coll, "beacon", bm_cyl(0.16, 0.16, 0.2, 10), mat("Neon_Amber", "#FFB300", rough=0.3, emit=2.0), loc=(0, -1.6, 2.6), smooth=False)]
    for sx in (-1, 1):
        parts.append(B(coll, "head", (0.36, 0.06, 0.14), S.HEAD, (sx * 0.75, -2.72, 0.95)))
        parts.append(Part(coll, "gutter", bm_cyl(0.55, 0.55, 0.12, 12), BROOM, loc=(sx * 1.05, -2.3, 0.08), smooth=False))
    parts.append(Part(coll, "mainbroom", bm_cyl(0.42, 0.42, 1.9, 10, "X"), BROOM, loc=(0, 0.2, 0.42), smooth=False))
    bake(parts, "TownMwSweeper_body", coll, parent=root)
    four_wheels(coll, root, 0.95, -1.8, 2.0, 0.45, 0.3, S.TIRE, S.RIM, S.TIRE)
    return coll


def build_pigeon():
    """A Brooklyn pigeon. Nodes like the goose: Neck (pivot at its base), Wing_L/R, Leg_L/R."""
    coll = scene_coll("TownMwPigeon")
    root = root_empty(coll, "TownMwPigeon")
    BODY = mat("PigeonGrey", "#8A8F99", rough=0.85)
    DARK = mat("PigeonDark", "#4A4F59", rough=0.8)
    NECK = mat("PigeonNeck", "#4F7E6E", rough=0.4, metal=0.3)
    FOOT = mat("PigeonFoot", "#D46A6A", rough=0.7)
    bake([Part(coll, "body", bm_sphere(0.09, 0.15, 0.08, 10, 7), BODY, loc=(0, 0.02, 0.17)),
          Part(coll, "tail", bm_box(0.08, 0.1, 0.02), DARK, loc=(0, 0.17, 0.18), rot=(0.3, 0, 0))], "Body", coll, parent=root)
    bake_at([limb(coll, "neck", (0, -0.08, 0.2), (0, -0.12, 0.28), 0.04, NECK),
             Part(coll, "head", bm_sphere(0.045, 0.055, 0.045, 8, 6), BODY, loc=(0, -0.13, 0.3)),
             Part(coll, "beak", bm_cyl(0.012, 0.004, 0.04, 6, "Y"), DARK, loc=(0, -0.19, 0.3))], "Neck", coll, root, (0, -0.08, 0.2))
    for nm, sx in (("Wing_L", 1), ("Wing_R", -1)):
        bake_at([Part(coll, nm, bm_sphere(0.02, 0.13, 0.05, 8, 6), DARK, loc=(sx * 0.08, 0.04, 0.19))], nm, coll, root, (sx * 0.07, -0.05, 0.2))
    for nm, sx in (("Leg_L", 0.03), ("Leg_R", -0.03)):
        bake_at([limb(coll, nm, (sx, 0, 0.12), (sx, 0, 0.01), 0.008, FOOT)], nm, coll, root, (sx, 0, 0.12))
    return coll


# ── the cast ──────────────────────────────────────────────────────────────
ASSETS = [
    ("town_mw_house", build_house),
    ("town_mw_rowhouse", build_rowhouse),
    ("town_mw_apts", build_apts),
    ("town_mw_store", build_store),
    ("town_mw_bakery", build_bakery),
    ("town_mw_carbase", build_carbase),
    ("town_mw_shul", build_shul),
    ("town_mw_library", build_library),
    ("town_mw_hall", build_hall),
    ("town_mw_station", build_station),
    ("town_mw_train", build_train),
    ("town_mw_bench", build_bench),
    ("town_mw_barricade", build_barricade),
    ("town_mw_sedan_lod", build_sedan_lod),
    ("town_mw_sweeper", build_sweeper),
    ("town_mw_pigeon", build_pigeon),
    # the car-service guy ("five minutes!") and a bubby who has had this bench since 1994
    ("town_mw_driver", lambda: build_person("TownMwDriver", dict(hair="short", hair_color="#212121", top="#3E2723", sleeves="long",
                                                                  bottom="pants", bottom_color="#263238", shoes="#111111", width=1.1,
                                                                  extras=["cap", "sunglasses", "mustache", "belly"], extra_colors={"Hat": "#212121", "Beard": "#212121"}))),
    ("town_mw_bubby", lambda: build_person("TownMwBubby", dict(hair="sheitel", hair_color="#9E9E9E", top="#8E6E8E", sleeves="long",
                                                                bottom="skirt", bottom_color="#3E3E4A", shoes="#4E342E", height=1.52, width=1.12,
                                                                extras=["glasses", "scarf", "necklace"], extra_colors={"Scarf": "#B0BEC5"}))),
]
