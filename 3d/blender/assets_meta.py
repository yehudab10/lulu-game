"""
Meta assets (scrapbook / quests / holidays): the holiday car decorations that
ride on Lulu's convertible during the Jewish holidays (see features/meta).

  meta_menorah  - Chanukah: a car-top chanukiah. Flames are separate objects
                  (Flame_1 … Flame_8 + Flame_S, origin at the wick) so the game
                  lights tonight's candles and flickers them. Flame_1 sits on the
                  car's RIGHT (-X): night 1 lights it, night 8 lights them all.
  meta_purim_hat - Purim: a polka-dot party cone for Lulu's head.
  meta_grogger  - Purim: a giant novelty grogger; "Grogger_Spin" (pivot on the
                  handle axis) whirls when Lulu honks.
  meta_honey    - Rosh Hashana: an apple + a honey jar for the dashboard.
  meta_lulav    - Sukkot: lulav (+ hadass, aravah) and an etrog for the passenger seat.
  meta_matzah   - Pesach: a box of matzah and Elijah's cup for the passenger seat.

Every asset's origin is the centre of its base (it sits ON the car anchor);
front = Blender -Y like everything else.
"""
from lib import *


def setup():
    global GOLD, WOOD, FLAME
    GOLD = mat("MenorahGold", "#D4A72C", rough=0.28, metal=0.85)
    WOOD = mat("Wood", "#6D4C41", rough=0.7)
    FLAME = mat("NeonFlame", "#FFB300", rough=0.4, emit=4.0)


def _flame(coll, root, name, x, y, z):
    """A teardrop flame standing on (x, y, z) with its origin at the wick."""
    parts = [
        Part(coll, name + "_outer", bm_sphere(0.017, 0.017, 0.032, 12, 8), FLAME, loc=(x, y, z + 0.03)),
        Part(coll, name + "_tip", bm_cyl(0.012, 0.0, 0.03, 10), FLAME, loc=(x, y, z + 0.068)),
        Part(coll, name + "_core", bm_sphere(0.008, 0.008, 0.016, 8, 6), mat("NeonFlameCore", "#FFF59D", rough=0.4, emit=6.0),
             loc=(x, y - 0.004, z + 0.024)),
    ]
    return bake_at(parts, name, coll, root, (x, y, z))


# ── Chanukah: the car-top chanukiah ───────────────────────────────────────
def build_menorah():
    coll = scene_coll("MetaMenorah")
    root = root_empty(coll, "MetaMenorah")
    BLUE = mat("CandleBlue", "#90CAF9", rough=0.6)
    WHITE = mat("CandleWhite", "#FFFDF5", rough=0.6)
    SIGN = mat("SignBlue", "#1565C0", rough=0.5)
    SIGN_TXT = mat("SignText", "#FFF8E1", rough=0.5)
    PAD = mat("SuctionPad", "#263238", rough=0.6)
    parts = []
    # base + suction feet (it's a car menorah, after all)
    parts.append(Part(coll, "base", bm_box(0.34, 0.15, 0.035), WOOD, loc=(0, 0, 0.0275)).bevel(0.012, 2))
    for x in (-0.13, 0.13):
        parts.append(Part(coll, "pad", bm_cyl(0.035, 0.03, 0.012, 14), PAD, loc=(x, 0, 0.006)))
    # the plaque on the back, facing the chase camera
    parts.append(Part(coll, "sign", bm_box(0.36, 0.018, 0.07), SIGN, loc=(0, 0.085, 0.08)).bevel(0.008, 2))
    parts.append(Part(coll, "signTxt", bm_text("HAPPY CHANUKAH", 0.034), SIGN_TXT, loc=(0, 0.095, 0.08),
                      rot=(math.pi / 2, 0, math.pi), smooth=False))
    # central stem (runs up to the shamash)
    top = 0.25                     # height of the eight cups
    parts.append(Part(coll, "foot", bm_cyl(0.05, 0.03, 0.03, 16), GOLD, loc=(0, 0, 0.06)))
    parts.append(limb(coll, "stem", (0, 0, 0.06), (0, 0, top + 0.09), 0.016, GOLD))
    parts.append(Part(coll, "knop", bm_sphere(0.026, 0.026, 0.02), GOLD, loc=(0, 0, 0.13)))
    # four U-shaped pairs of arms (classic chanukiah silhouette)
    xs = [0.075, 0.14, 0.205, 0.27]
    for r in xs:
        seg = 10
        pts = []
        for i in range(seg + 1):
            a = math.pi + math.pi * i / seg
            pts.append((r * math.cos(a), 0, top + r * 0.62 * math.sin(a)))
        for i in range(seg):
            parts.append(limb(coll, "arm", pts[i], pts[i + 1], 0.011, GOLD))
    # cups + candles; numbering: 1 = car-right (-X) … 8 = car-left (+X)
    holders = sorted([-x for x in xs] + xs)
    for i, x in enumerate(holders):
        parts.append(Part(coll, "cup", bm_cyl(0.017, 0.024, 0.026, 14), GOLD, loc=(x, 0, top + 0.012)))
        parts.append(Part(coll, "candle", bm_cyl(0.011, 0.011, 0.085, 10), BLUE if i % 2 else WHITE, loc=(x, 0, top + 0.067)))
        parts.append(Part(coll, "wick", bm_cyl(0.002, 0.002, 0.012, 4), PAD, loc=(x, 0, top + 0.115)))
    # the shamash, raised in the middle
    st = top + 0.09
    parts.append(Part(coll, "cupS", bm_cyl(0.019, 0.027, 0.028, 14), GOLD, loc=(0, 0, st + 0.012)))
    parts.append(Part(coll, "candleS", bm_cyl(0.012, 0.012, 0.095, 10), WHITE, loc=(0, 0, st + 0.072)))
    parts.append(Part(coll, "wickS", bm_cyl(0.002, 0.002, 0.012, 4), PAD, loc=(0, 0, st + 0.125)))
    bake(parts, "MetaMenorah_body", coll, parent=root)
    for i, x in enumerate(holders):
        _flame(coll, root, "Flame_%d" % (i + 1), x, 0, top + 0.118)
    _flame(coll, root, "Flame_S", 0, 0, st + 0.128)
    return coll


# ── Purim: party hat + grogger ────────────────────────────────────────────
def build_purim_hat():
    coll = scene_coll("MetaPurimHat")
    root = root_empty(coll, "MetaPurimHat")
    HAT = mat("PartyHat", "#AB47BC", rough=0.5)
    DOTS = mat("HatDots", "#FFEB3B", rough=0.45)
    POM = mat("PomPom", "#FF4081", rough=0.85)
    TRIM = mat("HatTrim", "#FFD54F", rough=0.4, metal=0.2)
    R, Hh = 0.115, 0.27
    parts = [Part(coll, "cone", bm_cyl(R, 0.004, Hh, 24), HAT, loc=(0, 0, Hh / 2))]
    parts.append(Part(coll, "brim", bm_torus(R - 0.004, 0.012, 24, 8), TRIM, loc=(0, 0, 0.008)))
    # polka dots sitting on the cone's surface
    k = 0
    for h in (0.045, 0.1, 0.155, 0.205):
        n = max(3, int(7 * (1 - h / Hh)) + 1)
        for j in range(n):
            a = 2 * math.pi * (j + 0.5 * (k % 2)) / n
            rr = R * (1 - h / Hh) + 0.002
            parts.append(Part(coll, "dot", bm_sphere(0.016, 0.016, 0.016, 8, 6), DOTS,
                              loc=(rr * math.cos(a), rr * math.sin(a), h)))
        k += 1
    parts.append(Part(coll, "pom", bm_ico(0.042, 2), POM, loc=(0, 0, Hh + 0.02)))
    for a in range(6):   # a few fluffy tufts on the pom-pom
        ang = a * math.pi / 3
        parts.append(Part(coll, "tuft", bm_ico(0.02, 1), POM, loc=(0.035 * math.cos(ang), 0.035 * math.sin(ang), Hh + 0.025)))
    bake(parts, "MetaPurimHat_body", coll, parent=root)
    return coll


def build_grogger():
    coll = scene_coll("MetaGrogger")
    root = root_empty(coll, "MetaGrogger")
    RED = mat("GroggerRed", "#E53935", rough=0.45)
    BLUE = mat("GroggerBlue", "#1E88E5", rough=0.45)
    STAR = mat("GroggerStar", "#FFD54F", rough=0.4, metal=0.3)
    handle = [
        Part(coll, "handle", bm_cyl(0.022, 0.026, 0.2, 12), WOOD, loc=(0, 0, 0.1)),
        Part(coll, "knob", bm_sphere(0.032, 0.032, 0.026), WOOD, loc=(0, 0, 0.012)),
        Part(coll, "axle", bm_cyl(0.012, 0.012, 0.09, 10), GOLD, loc=(0, 0, 0.24)),
    ]
    # the ratchet gear at the top of the handle
    handle.append(Part(coll, "gear", bm_cyl(0.04, 0.04, 0.03, 16), GOLD, loc=(0, 0, 0.215)))
    for t in range(10):
        a = t * 2 * math.pi / 10
        handle.append(Part(coll, "tooth", bm_box(0.016, 0.014, 0.03), GOLD, loc=(0.045 * math.cos(a), 0.045 * math.sin(a), 0.215),
                           rot=(0, 0, a)))
    bake(handle, "MetaGrogger_handle", coll, parent=root)
    # the spinning box (pivot on the handle axis)
    piv = (0, 0, 0.25)
    spin = [
        Part(coll, "arm", bm_box(0.2, 0.03, 0.025), WOOD, loc=(0.1, 0, 0.25)).bevel(0.008, 2),
        Part(coll, "box", bm_box(0.11, 0.07, 0.11), RED, loc=(0.21, 0, 0.25)).bevel(0.012, 2),
        Part(coll, "panel", bm_box(0.112, 0.074, 0.05), BLUE, loc=(0.21, 0, 0.25)),
        Part(coll, "clapper", bm_box(0.12, 0.012, 0.06), WOOD, loc=(0.06, 0.03, 0.25)),
    ]
    for s in (-1, 1):
        spin.append(Part(coll, "star", bm_text("*", 0.07, 0.01), STAR, loc=(0.21, s * 0.04, 0.25),
                         rot=(math.pi / 2 * -s, 0, 0), smooth=False))
    bake_at(spin, "Grogger_Spin", coll, root, piv)
    return coll


# ── Rosh Hashana: apples & honey ─────────────────────────────────────────
def build_honey():
    coll = scene_coll("MetaHoney")
    root = root_empty(coll, "MetaHoney")
    APPLE = mat("AppleRed", "#D32F2F", rough=0.35)
    STEM = mat("Stem", "#5D4037", rough=0.8)
    LEAF = mat("Leaf", "#43A047", rough=0.6)
    HONEY = mat("WaterHoney", "#FFA000", rough=0.15)
    LID = mat("JarLid", "#FFD54F", rough=0.4, metal=0.3)
    LABEL = mat("JarLabel", "#FFF8E1", rough=0.7)
    parts = []
    ax = -0.09
    parts.append(Part(coll, "apple", bm_sphere(0.055, 0.055, 0.05, 18, 12), APPLE, loc=(ax, 0, 0.05)))
    parts.append(limb(coll, "stem", (ax, 0, 0.095), (ax + 0.008, 0, 0.125), 0.005, STEM))
    parts.append(Part(coll, "leaf", bm_sphere(0.026, 0.012, 0.004, 10, 6), LEAF, loc=(ax + 0.025, 0, 0.118), rot=(0, -0.5, 0)))
    # a second apple, sliced (well, a wedge) lying in front
    parts.append(Part(coll, "slice", bm_sphere(0.03, 0.018, 0.026, 12, 8), APPLE, loc=(ax + 0.02, -0.07, 0.022), rot=(0, 0, 0.6)))
    parts.append(Part(coll, "sliceIn", bm_box(0.04, 0.004, 0.034), LABEL, loc=(ax + 0.02, -0.08, 0.022), rot=(0, 0, 0.6)))
    jx = 0.06
    parts.append(Part(coll, "jar", bm_cyl(0.042, 0.042, 0.09, 18), HONEY, loc=(jx, 0, 0.045)))
    parts.append(Part(coll, "label", bm_cyl(0.0435, 0.0435, 0.035, 18), LABEL, loc=(jx, 0, 0.042)))
    parts.append(Part(coll, "lid", bm_cyl(0.046, 0.046, 0.018, 18), LID, loc=(jx, 0, 0.099)).bevel(0.005, 2))
    # the honey dipper poking out
    parts.append(limb(coll, "dipper", (jx + 0.01, 0, 0.1), (jx + 0.05, 0, 0.19), 0.005, WOOD))
    for i in range(3):
        parts.append(Part(coll, "ring", bm_cyl(0.014, 0.014, 0.008, 10), WOOD,
                          loc=(jx + 0.012 + i * 0.006, 0, 0.098 + i * 0.012)))
    bake(parts, "MetaHoney_body", coll, parent=root)
    return coll


# ── Sukkot: lulav + etrog ────────────────────────────────────────────────
def build_lulav():
    coll = scene_coll("MetaLulav")
    root = root_empty(coll, "MetaLulav")
    PALM = mat("PalmFrond", "#7CB342", rough=0.6)
    MYRTLE = mat("Myrtle", "#2E7D32", rough=0.6)
    WILLOW = mat("Willow", "#AED581", rough=0.6)
    HOLDER = mat("Holder", "#C8A04A", rough=0.75)
    ETROG = mat("Etrog", "#F9D71C", rough=0.55)
    parts = []
    # lulav leaning back over the seat (tilt about X: the top goes toward +Y, the rear)
    tilt = 0.32
    def up(z, dx=0.0):
        return (dx, z * math.sin(tilt), z * math.cos(tilt))
    parts.append(limb(coll, "spine", up(0.0), up(0.95), 0.013, PALM))
    for i in range(7):   # the closed frond: long blades hugging the spine
        dx = (i - 3) * 0.006
        parts.append(limb(coll, "blade", up(0.05, dx), up(0.82 + 0.02 * (i % 3), dx * 1.8), 0.007, PALM))
    # holder (koishikel) at the bottom
    parts.append(Part(coll, "holder", bm_cyl(0.032, 0.03, 0.16, 12), HOLDER, loc=up(0.12), rot=(-tilt, 0, 0)))
    for k in range(3):
        parts.append(Part(coll, "band", bm_torus(0.033, 0.004, 14, 4), WOOD, loc=up(0.06 + k * 0.06), rot=(-tilt, 0, 0)))
    # hadass (myrtle) on the right, aravah (willow) on the left
    for j in range(9):
        z = 0.22 + j * 0.035
        for s in (-1, 1):
            p = up(z, -0.03 + s * 0.012)
            parts.append(Part(coll, "myrtle", bm_sphere(0.012, 0.005, 0.02, 6, 4), MYRTLE, loc=p, rot=(-tilt, 0, s * 0.7)))
    for j in range(4):
        z = 0.24 + j * 0.07
        p = up(z, 0.035)
        parts.append(Part(coll, "willow", bm_sphere(0.008, 0.004, 0.05, 6, 4), WILLOW, loc=p, rot=(-tilt, 0, -0.35)))
    # the etrog resting at the foot of the lulav
    parts.append(Part(coll, "etrog", bm_sphere(0.045, 0.045, 0.065, 16, 12), ETROG, loc=(0.12, -0.04, 0.045), rot=(0, 1.2, 0.3)))
    parts.append(Part(coll, "pitam", bm_cyl(0.006, 0.002, 0.018, 6), WOOD, loc=(0.18, -0.055, 0.03), rot=(0, 1.2, 0.3)))
    bake(parts, "MetaLulav_body", coll, parent=root)
    return coll


# ── Pesach: matzah + Elijah's cup ────────────────────────────────────────
def build_matzah():
    coll = scene_coll("MetaMatzah")
    root = root_empty(coll, "MetaMatzah")
    BOX = mat("MatzahBox", "#1E88E5", rough=0.6)
    BAND = mat("MatzahLabel", "#FFFFFF", rough=0.6)
    TXT = mat("MatzahText", "#0D47A1", rough=0.6)
    MATZAH = mat("Matzah", "#E9C98C", rough=0.85)
    BURN = mat("MatzahBurn", "#A86B32", rough=0.9)
    SILVER = mat("Silver", "#CFD8DC", rough=0.2, metal=0.9)
    WINE = mat("WaterWine", "#8E1B3A", rough=0.1)
    parts = []
    bx = -0.04
    parts.append(Part(coll, "box", bm_box(0.24, 0.24, 0.07), BOX, loc=(bx, 0, 0.035)).bevel(0.006, 2))
    parts.append(Part(coll, "band", bm_box(0.244, 0.244, 0.026), BAND, loc=(bx, 0, 0.038)))
    parts.append(Part(coll, "txt", bm_text("MATZAH", 0.04), TXT, loc=(bx, 0.124, 0.038), rot=(math.pi / 2, 0, math.pi), smooth=False))
    # two sheets on top, slightly askew, with docking holes
    for k, (dz, rz) in enumerate(((0.074, 0.12), (0.082, -0.18))):
        parts.append(Part(coll, "sheet", bm_box(0.2, 0.2, 0.006), MATZAH, loc=(bx, 0, dz), rot=(0, 0, rz)).bevel(0.004, 1))
        if k == 1:
            for i in range(5):
                for j in range(5):
                    u, v = (i - 2) * 0.036, (j - 2) * 0.036
                    x = bx + u * math.cos(rz) - v * math.sin(rz)
                    y = u * math.sin(rz) + v * math.cos(rz)
                    parts.append(Part(coll, "hole", bm_box(0.008, 0.008, 0.002), BURN, loc=(x, y, dz + 0.0035), rot=(0, 0, rz), smooth=False))
    # Elijah's cup
    cx = 0.15
    parts.append(Part(coll, "cupFoot", bm_cyl(0.035, 0.03, 0.012, 16), SILVER, loc=(cx, 0, 0.006)))
    parts.append(Part(coll, "cupStem", bm_cyl(0.009, 0.009, 0.06, 10), SILVER, loc=(cx, 0, 0.04)))
    parts.append(Part(coll, "cupBowl", bm_cyl(0.022, 0.036, 0.07, 16), SILVER, loc=(cx, 0, 0.105)))
    parts.append(Part(coll, "wine", bm_cyl(0.033, 0.033, 0.004, 16), WINE, loc=(cx, 0, 0.13)))
    bake(parts, "MetaMatzah_body", coll, parent=root)
    return coll


ASSETS = [
    ("meta_menorah", build_menorah),
    ("meta_purim_hat", build_purim_hat),
    ("meta_grogger", build_grogger),
    ("meta_honey", build_honey),
    ("meta_lulav", build_lulav),
    ("meta_matzah", build_matzah),
]
