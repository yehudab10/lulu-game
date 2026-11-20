"""
features/seasons — the models for 🕎 A WORLD THAT FOLLOWS THE REAL CALENDAR.

    seasons_props   one file, one Prop_<Name> sub-root per piece (origin on the ground under its middle, FRONT = -Y
                    = toward the street / the viewer). Every piece is low-poly on purpose: the game instances them
                    across a whole town (features/seasons/dress.js), so a window menorah is ~140 triangles.

      WinMenorah     a menorah for a front window (first candle on the LIGHTER's right = the street's left)
      BigMenorah     the big public menorah in the town square (~4.6 m)
      Candlesticks   a pair of Shabbos / Yom Tov candlesticks for a window
      Stand          a market stall (striped awning, counter; a `Sign` empty for the runtime sign board, `Goods` on the counter)
      Goods_*        what's on the counter: Donuts (sufganiyot), Hamantaschen, Cheesecake, Lulavim (lulav + etrog
                     boxes), Apples (+ honey), Challah (+ Friday flowers), Flowers
      Sukkah         a finished sukkah (canvas walls, bamboo + green schach, a paper chain, a lamp)
      SukkahFrame    a sukkah going up (bare frame + a ladder + a stack of panels)
      Hat_Crown / Hat_Tricorn / Hat_Clown / Hat_Fire / Hat_Chef   Purim costumes (origin = the top of the head)
      Hamantash      a kid's walking-hamantash costume (origin on the ground)
      Basket         a mishloach manos basket with a bow
      Banner         a parade banner on two poles (runtime text on `Sign`)
      Bonfire        a Lag BaOmer bonfire: a ring of stones, a log teepee, cartoon flames (`Flames`), a bucket of water
      LogBench       a log to sit on round the fire
      KerbPile       the pre-Pesach clean-out at the kerb: bags, a rolled rug, an old chair, a box, a broom
      Planter        a porch planter full of greenery + flowers (Shavuos)
      HeldLulav / HeldEsrog / Book / Torah / Flag / Pushke / BreadBag   things people hold (origin = the grip)
      BurnBarrel     erev Pesach: burning the chametz in a metal barrel on bricks (`Flames`), a bucket of water beside
      Pond           Tashlich: a little pond with stones + reeds (fields off the highway, Midwood)
      SpeakerKit     Purim: the music van's roof rack (two horn speakers + a sign board: the runtime sign at `Sign`)

Lights are empties named Light_<k> (a candle wick / a lamp): the game draws the glow there (one Points draw call for
the whole town, lit by atmos' night) and a tiny instanced flame up close. Materials named Flame* are emissive.
"""
import math
from lib import *


def _sub(coll, root, prefix, name, items):
    e = bpy.data.objects.new(prefix + name, None)
    coll.objects.link(e)
    e.parent = root
    items.append(e)
    return e


def P(coll, bm, m, loc, rot=(0, 0, 0), smooth=False):
    return Part(coll, "sp", bm, m, loc=loc, rot=rot, smooth=smooth)


def _spread(items, step=4.0):
    for i, e in enumerate(items):
        e.location = ((i % 6) * step, (i // 6) * step, 0)


def _light(coll, parent, name, loc):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "SPHERE"
    e.empty_display_size = 0.03
    coll.objects.link(e)
    e.parent = parent
    e.location = loc
    return e


def build_props():
    coll = scene_coll("SeasonsProps")
    root = root_empty(coll, "SeasonsProps")
    items = []
    Pr = lambda name: _sub(coll, root, "Prop_", name, items)
    B = lambda bm, m, loc, rot=(0, 0, 0), smooth=False: P(coll, bm, m, loc, rot, smooth)

    GOLD = mat("SnGold", "#E2B33C", 0.35, 0.75)
    SILVER = mat("SnSilver", "#CFD8DC", 0.3, 0.8)
    WHITE = mat("SnWhite", "#FFFDF5", 0.6)
    BLUE = mat("SnCandleBlue", "#90CAF9", 0.6)
    WOOD = mat("SnWood", "#A1724E", 0.75)
    DWOOD = mat("SnDarkWood", "#6D4C41", 0.8)
    BLACK = mat("SnBlack", "#212121", 0.6)
    GREEN = mat("SnLeaf", "#4CAF50", 0.85)
    DGREEN = mat("SnPalm", "#2E7D32", 0.85)

    # ── a window menorah: ~0.5 m wide, sits on the sill ────────────────────
    pr = Pr("WinMenorah")
    parts = [B(bm_box(0.3, 0.1, 0.03), GOLD, (0, 0, 0.015)), B(bm_box(0.035, 0.035, 0.2), GOLD, (0, 0, 0.13)),
             B(bm_box(0.5, 0.04, 0.03), GOLD, (0, 0, 0.23))]
    xs = [-0.22, -0.16, -0.10, -0.04, 0.04, 0.10, 0.16, 0.22]
    # numbering: candle 1 sits on the lighter's right (the lighter stands inside, facing out to the street, -Y):
    # their right is -X (the street sees it on its left) … 8 at +X
    for i, x in enumerate(xs):
        parts.append(B(bm_cyl(0.011, 0.011, 0.07, 5), BLUE if i % 2 else WHITE, (x, 0, 0.28)))
    parts.append(B(bm_box(0.04, 0.04, 0.07), GOLD, (0, 0, 0.27)))     # the shamash's raised cup
    parts.append(B(bm_cyl(0.012, 0.012, 0.075, 5), WHITE, (0, 0, 0.34)))
    bake(parts, "WinMenorah_body", coll, parent=pr)
    for i, x in enumerate(xs):
        _light(coll, pr, "Light_%d" % (i + 1), (x, 0, 0.33))
    _light(coll, pr, "Light_S", (0, 0, 0.395))

    # ── the big public menorah (straight diagonal arms, lamps on top) ──────
    pr = Pr("BigMenorah")
    H = 3.9
    parts = [B(bm_box(1.3, 1.3, 0.25), mat("SnStone", "#B0A79C", 0.95), (0, 0, 0.125)),
             B(bm_cyl(0.18, 0.12, H - 0.25, 8), GOLD, (0, 0, 0.25 + (H - 0.25) / 2))]
    bxs = [-1.6, -1.2, -0.8, -0.4, 0.4, 0.8, 1.2, 1.6]
    for x in bxs:
        # each arm: a straight diagonal from the stem up to its lamp
        y0 = H - 2.6 + (1.6 - abs(x)) * 0.55
        a, b = Vector((0, 0, y0)), Vector((x, 0, H))
        d = b - a
        arm = B(bm_box(0.09, 0.09, d.length), GOLD, (a + b) / 2)
        arm.ob.rotation_mode = "QUATERNION"
        arm.ob.rotation_quaternion = d.to_track_quat("Z", "Y")
        parts.append(arm)
        parts.append(B(bm_box(0.2, 0.2, 0.22), GOLD, (x, 0, H + 0.11)))
        parts.append(B(bm_cyl(0.06, 0.06, 0.16, 6), WHITE, (x, 0, H + 0.3)))
    parts.append(B(bm_box(0.24, 0.24, 0.5), GOLD, (0, 0, H + 0.35)))   # the shamash stands taller
    parts.append(B(bm_cyl(0.07, 0.07, 0.18, 6), WHITE, (0, 0, H + 0.69)))
    bake(parts, "BigMenorah_body", coll, parent=pr)
    # a public menorah is lit by someone standing in FRONT of it (on the street side, facing it): their right is +X here,
    # so candle 1 is at +X (the street sees the first lights on its right)
    for i, x in enumerate(reversed(bxs)):
        _light(coll, pr, "Light_%d" % (i + 1), (x, 0, H + 0.42))
    _light(coll, pr, "Light_S", (0, 0, H + 0.82))

    # ── Shabbos candlesticks (a pair) ───────────────────────────────────────
    pr = Pr("Candlesticks")
    parts = []
    for x in (-0.09, 0.09):
        parts += [B(bm_cyl(0.045, 0.045, 0.02, 8), SILVER, (x, 0, 0.01)), B(bm_cyl(0.015, 0.02, 0.2, 6), SILVER, (x, 0, 0.12)),
                  B(bm_cyl(0.03, 0.02, 0.03, 8), SILVER, (x, 0, 0.235)), B(bm_cyl(0.013, 0.013, 0.12, 6), WHITE, (x, 0, 0.31))]
    bake(parts, "Candlesticks_body", coll, parent=pr)
    _light(coll, pr, "Light_1", (-0.09, 0, 0.385))
    _light(coll, pr, "Light_2", (0.09, 0, 0.385))

    # ── a market stall ──────────────────────────────────────────────────────
    pr = Pr("Stand")
    AWN = mat("Awning", "#1E88E5", 0.8)
    AWN2 = mat("SnAwningWhite", "#FAFAFA", 0.8)
    parts = [B(bm_box(2.2, 0.8, 0.9), WOOD, (0, 0, 0.45)), B(bm_box(2.3, 0.9, 0.06), DWOOD, (0, 0, 0.93)),
             B(bm_box(2.0, 0.04, 0.6), mat("SnFront", "#FFF8E1", 0.8), (0, -0.42, 0.5))]
    for x in (-1.08, 1.08):
        for y in (-0.38, 0.38):
            parts.append(B(bm_box(0.07, 0.07, 2.3), DWOOD, (x, y, 1.15)))
    for k in range(6):          # striped, sloping awning
        parts.append(B(bm_box(2.4 / 6, 1.3, 0.05), AWN if k % 2 == 0 else AWN2, (-1.2 + 2.4 / 6 * (k + 0.5), -0.2, 2.25), rot=(-0.28, 0, 0)))
    parts.append(B(bm_box(2.0, 0.06, 0.42), mat("SignBoard", "#FBF8F0", 0.8), (0, -0.88, 2.55)))   # the sign's backing (runtime face)
    bake(parts, "Stand_body", coll, parent=pr)
    _light(coll, pr, "Sign", (0, -0.92, 2.55))
    _light(coll, pr, "Goods", (0, -0.05, 0.96))
    _light(coll, pr, "Light_1", (0, -0.2, 2.05))

    # ── goods on the counter (origin = the counter top) ─────────────────────
    TRAY = mat("SnTray", "#ECEFF1", 0.4, 0.3)
    pr = Pr("Goods_Donuts")
    DOUGH = mat("SnDough", "#D9A15B", 0.7)
    SUGAR = mat("SnSugar", "#FFFFFF", 0.9)
    JAM = mat("SnJam", "#C62828", 0.4)
    parts = [B(bm_box(1.1, 0.5, 0.03), TRAY, (0, 0, 0.015))]
    for i in range(8):
        x, y = -0.42 + (i % 4) * 0.28, -0.11 + (i // 4) * 0.22
        parts += [B(bm_sphere(0.1, 0.1, 0.065, u=8, v=4), DOUGH, (x, y, 0.08)), B(bm_cyl(0.075, 0.05, 0.02, 6), SUGAR, (x, y, 0.14)),
                  B(bm_sphere(0.022, u=5, v=3), JAM, (x, y - 0.05, 0.12))]
    bake(parts, "Donuts_body", coll, parent=pr)

    pr = Pr("Goods_Hamantaschen")
    PASTRY = mat("SnPastry", "#E8B86D", 0.7)
    POPPY = mat("SnPoppy", "#3E2723", 0.6)
    parts = [B(bm_box(1.1, 0.5, 0.03), TRAY, (0, 0, 0.015))]
    for i in range(9):
        x, y = -0.42 + (i % 5) * 0.21, -0.12 + (i // 5) * 0.22
        parts += [B(bm_cyl(0.1, 0.1, 0.04, 3), PASTRY, (x, y, 0.05), rot=(0, 0, i * 0.4)), B(bm_cyl(0.035, 0.035, 0.03, 3), POPPY if i % 3 else JAM, (x, y, 0.07), rot=(0, 0, i * 0.4))]
    bake(parts, "Hamantaschen_body", coll, parent=pr)

    pr = Pr("Goods_Cheesecake")
    CAKE = mat("SnCake", "#FFF3D6", 0.7)
    CRUST = mat("SnCrust", "#C8955A", 0.8)
    parts = [B(bm_box(1.1, 0.5, 0.03), TRAY, (0, 0, 0.015))]
    for x, r in ((-0.27, 0.2), (0.27, 0.16)):
        parts += [B(bm_cyl(r, r, 0.03, 10), CRUST, (x, 0, 0.045)), B(bm_cyl(r, r, 0.11, 10), CAKE, (x, 0, 0.115))]
        for k in range(5):
            a = k / 5 * math.tau
            parts.append(B(bm_sphere(0.03, u=5, v=3), JAM, (x + math.cos(a) * r * 0.6, math.sin(a) * r * 0.6, 0.18)))
    bake(parts, "Cheesecake_body", coll, parent=pr)

    pr = Pr("Goods_Lulavim")
    ETROG = mat("SnEtrog", "#F2D43D", 0.6)
    BOX = mat("SnBox", "#F5F5F5", 0.8)
    parts = []
    for i in range(5):
        x = -0.45 + i * 0.22
        parts += [B(bm_box(0.06, 0.06, 1.15), DGREEN, (x, 0.12, 0.58), rot=(0.18, (i - 2) * 0.06, 0)),
                  B(bm_box(0.14, 0.04, 0.38), GREEN, (x, 0.04, 0.4), rot=(0.18, 0, 0))]       # willow + myrtle sleeve
    for i in range(3):
        x = -0.3 + i * 0.3
        parts += [B(bm_box(0.22, 0.16, 0.1), BOX, (x, -0.15, 0.05)), B(bm_sphere(0.06, 0.06, 0.08, u=6, v=4), ETROG, (x, -0.15, 0.14))]
    bake(parts, "Lulavim_body", coll, parent=pr)

    pr = Pr("Goods_Apples")
    APPLE = mat("SnApple", "#D32F2F", 0.5)
    HONEY = mat("SnHoney", "#FFB300", 0.3)
    parts = [B(bm_box(0.6, 0.4, 0.15), WOOD, (-0.25, 0, 0.075))]
    for i in range(6):
        parts.append(B(bm_sphere(0.07, u=6, v=4), APPLE, (-0.45 + (i % 3) * 0.2, -0.1 + (i // 3) * 0.2, 0.19)))
    for i in range(3):
        parts += [B(bm_cyl(0.06, 0.06, 0.13, 6), HONEY, (0.25 + i * 0.15, -0.05, 0.065)), B(bm_cyl(0.065, 0.065, 0.03, 6), mat("SnLid", "#F9A825", 0.5), (0.25 + i * 0.15, -0.05, 0.145))]
    bake(parts, "Apples_body", coll, parent=pr)

    pr = Pr("Goods_Challah")
    BREAD = mat("SnChallah", "#C9792C", 0.6)
    parts = []
    for i in range(3):
        x = -0.4 + i * 0.3
        for k in range(3):
            parts.append(B(bm_sphere(0.075 - k * 0.012, 0.06, 0.055, u=6, v=4), BREAD, (x, -0.1 + k * 0.1, 0.05)))
    parts.append(B(bm_cyl(0.12, 0.1, 0.25, 7), mat("SnBucket", "#78909C", 0.5, 0.4), (0.42, 0.05, 0.125)))
    for k in range(6):
        a = k / 6 * math.tau
        parts.append(B(bm_ico(0.045, 0), mat("SnBloom%d" % (k % 3), ("#EC407A", "#FFEE58", "#FFFFFF")[k % 3], 0.8), (0.42 + math.cos(a) * 0.07, 0.05 + math.sin(a) * 0.07, 0.36)))
    bake(parts, "Challah_body", coll, parent=pr)

    pr = Pr("Goods_Flowers")
    parts = []
    for i in range(4):
        x = -0.4 + i * 0.27
        parts += [B(bm_cyl(0.1, 0.08, 0.22, 7), mat("SnBucket", "#78909C", 0.5, 0.4), (x, 0, 0.11)), B(bm_cyl(0.015, 0.015, 0.25, 4), GREEN, (x, 0, 0.3))]
        for k in range(5):
            a = k / 5 * math.tau + i
            parts.append(B(bm_ico(0.05, 0), mat("SnBloom%d" % ((k + i) % 3), ("#EC407A", "#FFEE58", "#FFFFFF")[(k + i) % 3], 0.8), (x + math.cos(a) * 0.07, math.sin(a) * 0.07, 0.42)))
    bake(parts, "Flowers_body", coll, parent=pr)

    # ── a sukkah (≈ 2.6 × 2.4 m, open at the front) ─────────────────────────
    CANVAS = mat("Canvas", "#F3EBDD", 0.9)
    POLE = mat("SnBamboo", "#C8B273", 0.8)
    SCHACH = mat("SnSchach", "#5E8C3A", 0.9)
    W_, D_, H_ = 2.6, 2.4, 2.2
    def frame(parts):
        for x in (-W_ / 2, W_ / 2):
            for y in (-D_ / 2, D_ / 2):
                parts.append(B(bm_box(0.08, 0.08, H_), DWOOD, (x, y, H_ / 2)))
        for y in (-D_ / 2, D_ / 2):
            parts.append(B(bm_box(W_, 0.07, 0.07), DWOOD, (0, y, H_)))
        for x in (-W_ / 2, W_ / 2):
            parts.append(B(bm_box(0.07, D_, 0.07), DWOOD, (x, 0, H_)))
    pr = Pr("Sukkah")
    parts = []
    frame(parts)
    parts += [B(bm_box(W_, 0.04, H_ - 0.1), CANVAS, (0, D_ / 2, H_ / 2)),
              B(bm_box(0.04, D_, H_ - 0.1), CANVAS, (-W_ / 2, 0, H_ / 2)), B(bm_box(0.04, D_, H_ - 0.1), CANVAS, (W_ / 2, 0, H_ / 2)),
              B(bm_box(0.9, 0.04, H_ - 0.1), CANVAS, (-W_ / 2 + 0.45, -D_ / 2, H_ / 2))]       # the front: half a wall + the doorway
    for k in range(7):
        parts.append(B(bm_box(0.06, D_ + 0.3, 0.06), POLE, (-W_ / 2 + 0.1 + k * (W_ - 0.2) / 6, 0, H_ + 0.07)))
    for k in range(3):
        parts.append(B(bm_box(W_ * 0.34, D_ + 0.1, 0.07), SCHACH, (-W_ / 3 + k * W_ / 3, 0, H_ + 0.13), rot=(0, (k - 1) * 0.05, 0)))
    for k in range(9):          # a paper chain under the front beam
        parts.append(B(bm_box(0.12, 0.03, 0.08), mat("SnChain%d" % (k % 4), ("#E53935", "#FDD835", "#43A047", "#1E88E5")[k % 4], 0.8),
                       (-W_ / 2 + 0.2 + k * 0.28, -D_ / 2 + 0.06, H_ - 0.12 - math.sin(k / 8 * math.pi) * 0.18)))
    parts += [B(bm_box(1.3, 0.7, 0.05), WOOD, (0.2, 0.3, 0.75)), B(bm_box(0.06, 0.06, 0.72), WOOD, (0.2, 0.3, 0.36))]   # a table inside
    bake(parts, "Sukkah_body", coll, parent=pr)
    _light(coll, pr, "Light_1", (0.2, 0.3, H_ - 0.35))

    pr = Pr("SukkahFrame")      # going up: the frame, a ladder, panels leaning on it
    parts = []
    frame(parts)
    for x in (-0.25, 0.25):
        parts.append(B(bm_box(0.05, 0.05, 2.5), WOOD, (W_ / 2 + 0.55 + x, -0.2, 1.2), rot=(0, -0.25, 0)))
    for k in range(5):
        parts.append(B(bm_box(0.55, 0.04, 0.04), WOOD, (W_ / 2 + 0.55 - 0.05 - k * 0.05 * 0.25 * 4, -0.2, 0.3 + k * 0.45), rot=(0, -0.25, 0)))
    for k in range(3):
        parts.append(B(bm_box(1.2, 0.04, 2.0), CANVAS, (-0.3 + k * 0.08, D_ / 2 + 0.25 + k * 0.06, 1.0), rot=(-0.18, 0, 0)))
    parts.append(B(bm_box(0.08, 1.6, 0.08), POLE, (-0.8, -D_ / 2 - 0.5, 0.04)))
    parts.append(B(bm_box(0.08, 1.6, 0.08), POLE, (-0.65, -D_ / 2 - 0.5, 0.04)))
    bake(parts, "SukkahFrame_body", coll, parent=pr)

    # ── Purim costumes (origin = the top of the head) ───────────────────────
    pr = Pr("Hat_Crown")
    parts = [B(bm_cyl(0.13, 0.13, 0.08, 8), GOLD, (0, 0, 0.0))]
    for k in range(8):
        a = k / 8 * math.tau
        parts.append(B(bm_cyl(0.035, 0.0, 0.1, 4), GOLD, (math.cos(a) * 0.12, math.sin(a) * 0.12, 0.09)))
    parts.append(B(bm_ico(0.03, 0), mat("SnRuby", "#E53935", 0.2), (0, -0.135, 0.0)))
    bake(parts, "Crown_body", coll, parent=pr)

    pr = Pr("Hat_Tricorn")      # Haman's three-cornered hat (the hamantash's namesake)
    parts = [B(bm_cyl(0.24, 0.24, 0.03, 3), BLACK, (0, 0, -0.01), rot=(0, 0, math.pi / 2)), B(bm_cyl(0.12, 0.1, 0.12, 6), BLACK, (0, 0, 0.05))]
    bake(parts, "Tricorn_body", coll, parent=pr)

    pr = Pr("Hat_Clown")
    parts = []
    for k in range(6):
        a = k / 6 * math.tau
        parts.append(B(bm_ico(0.09, 1), mat("SnClown%d" % (k % 3), ("#E91E63", "#FFC107", "#29B6F6")[k % 3], 0.9), (math.cos(a) * 0.1, math.sin(a) * 0.1, -0.03)))
    parts.append(B(bm_cyl(0.07, 0.0, 0.18, 6), mat("SnClown0", "#E91E63", 0.9), (0, 0, 0.09)))
    parts.append(B(bm_ico(0.03, 0), mat("SnClown1", "#FFC107", 0.9), (0, 0, 0.19)))
    bake(parts, "Clown_body", coll, parent=pr)

    pr = Pr("Hat_Fire")
    RED = mat("SnFireRed", "#D32F2F", 0.4)
    parts = [B(bm_sphere(0.14, 0.15, 0.1, u=8, v=4), RED, (0, 0, -0.02)), B(bm_cyl(0.2, 0.2, 0.02, 8), RED, (0, 0.03, -0.05)),
             B(bm_box(0.08, 0.02, 0.07), GOLD, (0, -0.15, 0.03))]
    bake(parts, "Fire_body", coll, parent=pr)

    pr = Pr("Hat_Chef")
    parts = [B(bm_cyl(0.12, 0.12, 0.08, 8), WHITE, (0, 0, 0.0)), B(bm_sphere(0.15, 0.15, 0.1, u=8, v=4), WHITE, (0, 0, 0.12))]
    bake(parts, "Chef_body", coll, parent=pr)

    pr = Pr("Hamantash")        # a walking hamantash (a kid inside: face hole at the front)
    parts = [B(bm_cyl(0.55, 0.45, 1.25, 3), PASTRY, (0, 0, 0.72), rot=(0, 0, math.pi / 2)),
             B(bm_cyl(0.2, 0.2, 0.06, 3), POPPY, (0, -0.25, 1.36), rot=(0, 0, math.pi / 2))]
    bake(parts, "Hamantash_body", coll, parent=pr)

    # ── mishloach manos ─────────────────────────────────────────────────────
    pr = Pr("Basket")
    WICKER = mat("SnWicker", "#C49A5A", 0.85)
    parts = [B(bm_cyl(0.16, 0.12, 0.14, 8), WICKER, (0, 0, 0.07)), B(bm_torus(0.13, 0.012, 10, 4), WICKER, (0, 0, 0.22), rot=(math.pi / 2, 0, 0)),
             B(bm_sphere(0.05, u=6, v=4), APPLE, (-0.06, 0.02, 0.17)), B(bm_box(0.09, 0.05, 0.12), mat("SnWine", "#6A1B9A", 0.3), (0.06, 0.03, 0.19)),
             B(bm_cyl(0.05, 0.05, 0.04, 3), PASTRY, (0.0, -0.06, 0.16)),
             B(bm_ico(0.035, 0), mat("SnBow", "#EC407A", 0.6), (-0.04, -0.13, 0.12)), B(bm_ico(0.035, 0), mat("SnBow", "#EC407A", 0.6), (0.04, -0.13, 0.12))]
    bake(parts, "Basket_body", coll, parent=pr)

    pr = Pr("Banner")            # carried by two marchers 2.4 m apart (poles at x = ±1.2)
    parts = [B(bm_cyl(0.025, 0.025, 2.2, 5), DWOOD, (-1.2, 0, 1.1)), B(bm_cyl(0.025, 0.025, 2.2, 5), DWOOD, (1.2, 0, 1.1)),
             B(bm_box(2.4, 0.02, 0.6), mat("SignBoard", "#FBF8F0", 0.8), (0, 0, 1.8))]
    bake(parts, "Banner_body", coll, parent=pr)
    _light(coll, pr, "Sign", (0, -0.02, 1.8))

    # ── Lag BaOmer: a cartoon bonfire, safely ringed with stones ────────────
    pr = Pr("Bonfire")
    STONE = mat("SnStone", "#B0A79C", 0.95)
    parts = []
    for k in range(10):
        a = k / 10 * math.tau
        parts.append(B(bm_ico(0.2, 0), STONE, (math.cos(a) * 1.0, math.sin(a) * 1.0, 0.1)))
    for k in range(6):
        a = k / 6 * math.tau
        top, bot = Vector((0, 0, 1.2)), Vector((math.cos(a) * 0.6, math.sin(a) * 0.6, 0.0))
        d = top - bot
        lg = B(bm_cyl(0.07, 0.06, d.length, 5), DWOOD, (top + bot) / 2)
        lg.ob.rotation_mode = "QUATERNION"
        lg.ob.rotation_quaternion = d.to_track_quat("Z", "Y")
        parts.append(lg)
    parts += [B(bm_cyl(0.2, 0.16, 0.32, 8), mat("SnPail", "#1E88E5", 0.4, 0.3), (1.6, -0.5, 0.16)), B(bm_cyl(0.18, 0.18, 0.02, 8), mat("SnWaterTop", "#81D4FA", 0.1), (1.6, -0.5, 0.31))]
    bake(parts, "Bonfire_body", coll, parent=pr)
    fl = bpy.data.objects.new("Flames", None)
    coll.objects.link(fl)
    fl.parent = pr
    FL1 = mat("FlameOrange", "#FF8F00", 0.5, emit=3.0)
    FL2 = mat("FlameYellow", "#FFE082", 0.5, emit=3.0)
    bake([B(bm_cyl(0.5, 0.0, 1.3, 6), FL1, (0, 0, 0.75)), B(bm_cyl(0.32, 0.0, 1.0, 6), FL2, (0.12, 0.08, 0.6)),
          B(bm_cyl(0.28, 0.0, 0.8, 5), FL1, (-0.2, -0.1, 0.5)), B(bm_cyl(0.22, 0.0, 0.75, 5), FL2, (-0.05, 0.2, 0.5))], "Bonfire_flames", coll, parent=fl)
    _light(coll, pr, "Light_1", (0, 0, 1.0))

    pr = Pr("LogBench")
    bake([B(bm_cyl(0.18, 0.18, 1.6, 7, "X"), DWOOD, (0, 0, 0.18))], "LogBench_body", coll, parent=pr)

    # ── erev Pesach: the clean-out at the kerb ──────────────────────────────
    pr = Pr("KerbPile")
    BAG = mat("SnBag", "#263238", 0.35)
    parts = [B(bm_sphere(0.38, 0.32, 0.4, u=8, v=5), BAG, (-0.6, 0.1, 0.38)), B(bm_sphere(0.34, 0.3, 0.33, u=8, v=5), BAG, (-0.15, 0.3, 0.32)),
             B(bm_sphere(0.3, 0.28, 0.3, u=8, v=5), BAG, (-0.45, -0.3, 0.29)),
             B(bm_cyl(0.18, 0.18, 1.7, 8, "X"), mat("SnRug", "#B5523B", 0.9), (0.55, -0.35, 0.18)),
             B(bm_box(0.55, 0.45, 0.4), mat("SnCardboard", "#C49A6C", 0.9), (0.55, 0.3, 0.2)),
             B(bm_box(0.5, 0.05, 0.2), mat("SnCardboard", "#C49A6C", 0.9), (0.55, 0.06, 0.45), rot=(0.6, 0, 0)),
             # an old chair, upside-down on the box
             B(bm_box(0.45, 0.45, 0.05), WOOD, (0.55, 0.3, 0.45)),
             B(bm_box(0.45, 0.05, 0.5), WOOD, (0.55, 0.52, 0.7))]
    for x in (0.36, 0.74):
        for y in (0.1, 0.5):
            parts.append(B(bm_box(0.04, 0.04, 0.4), WOOD, (x, y, 0.68)))
    parts += [B(bm_cyl(0.02, 0.02, 1.3, 5), WOOD, (1.05, 0.0, 0.62), rot=(0, 0.35, 0)), B(bm_box(0.3, 0.06, 0.18), mat("SnBristle", "#F9A825", 0.9), (0.84, 0.0, 0.07))]
    bake(parts, "KerbPile_body", coll, parent=pr)

    # ── Shavuos: a porch planter of greenery and flowers ────────────────────
    pr = Pr("Planter")
    parts = [B(bm_box(1.0, 0.35, 0.3), mat("SnPlanter", "#8D6E63", 0.85), (0, 0, 0.15))]
    for k in range(4):
        parts.append(B(bm_ico(0.17, 1), GREEN, (-0.36 + k * 0.24, 0, 0.38)))
    for k in range(7):
        parts.append(B(bm_ico(0.06, 0), mat("SnBloom%d" % (k % 3), ("#EC407A", "#FFEE58", "#FFFFFF")[k % 3], 0.8), (-0.4 + k * 0.13, -0.1 + (k % 2) * 0.15, 0.53)))
    bake(parts, "Planter_body", coll, parent=pr)

    # ── round 2: things people hold (origin = where the hand grips it; +Z up the arm) ──────────
    pr = Pr("HeldLulav")         # the lulav bundle: a tall palm spine, myrtle + willow sleeve (held upright)
    bake([B(bm_box(0.035, 0.035, 1.25), DGREEN, (0, 0, 0.45)), B(bm_box(0.05, 0.02, 0.5), DGREEN, (0, 0, 0.95), rot=(0, 0.08, 0)),
          B(bm_box(0.1, 0.07, 0.42), GREEN, (0, 0, 0.12)), B(bm_box(0.08, 0.05, 0.3), mat("SnWillow", "#7CB342", 0.85), (0.02, 0.02, 0.2)),
          B(bm_cyl(0.035, 0.035, 0.05, 6), mat("SnHolder", "#8D6E63", 0.8), (0, 0, 0.0))], "HeldLulav_body", coll, parent=pr)
    pr = Pr("HeldEsrog")
    bake([B(bm_sphere(0.05, 0.05, 0.068, u=7, v=5), ETROG, (0, 0, 0.0)), B(bm_cyl(0.006, 0.004, 0.02, 4), mat("SnPitom", "#6D4C41", 0.8), (0, 0, 0.075))], "HeldEsrog_body", coll, parent=pr)
    pr = Pr("Book")              # a siddur / machzor
    bake([B(bm_box(0.15, 0.04, 0.21), mat("SnBookCover", "#1A237E", 0.6), (0, 0, 0)), B(bm_box(0.14, 0.035, 0.2), mat("SnPages", "#FFF8E1", 0.9), (0, -0.004, 0)),
          B(bm_box(0.06, 0.042, 0.02), GOLD, (0, 0, 0.05))], "Book_body", coll, parent=pr)
    pr = Pr("Torah")             # a Torah in its velvet mantle, crowned (held against the chest; origin = the hug)
    VELVET = mat("SnVelvet", "#7B1F2A", 0.75)
    bake([B(bm_cyl(0.13, 0.13, 0.62, 10), VELVET, (0, 0, 0.0)), B(bm_cyl(0.135, 0.135, 0.04, 10), GOLD, (0, 0, 0.31)),
          B(bm_box(0.12, 0.02, 0.16), GOLD, (0, -0.13, 0.05)),
          B(bm_cyl(0.022, 0.022, 0.3, 6), DWOOD, (-0.06, 0, -0.42)), B(bm_cyl(0.022, 0.022, 0.3, 6), DWOOD, (0.06, 0, -0.42)),
          B(bm_cyl(0.02, 0.02, 0.14, 6), DWOOD, (-0.06, 0, 0.38)), B(bm_cyl(0.02, 0.02, 0.14, 6), DWOOD, (0.06, 0, 0.38)),
          B(bm_cyl(0.11, 0.07, 0.12, 8), GOLD, (0, 0, 0.5)), B(bm_ico(0.03, 0), GOLD, (0, 0, 0.6))], "Torah_body", coll, parent=pr)
    pr = Pr("Flag")              # a Simchas Torah flag on a stick, an apple on top
    bake([B(bm_cyl(0.012, 0.012, 0.7, 5), WOOD, (0, 0, 0.3)), B(bm_box(0.36, 0.01, 0.25), mat("SnFlagWhite", "#FAFAFA", 0.8), (0.19, 0, 0.5)),
          B(bm_box(0.36, 0.012, 0.05), mat("SnFlagBlue", "#1565C0", 0.8), (0.19, 0, 0.6)), B(bm_box(0.36, 0.012, 0.05), mat("SnFlagBlue", "#1565C0", 0.8), (0.19, 0, 0.4)),
          B(bm_box(0.1, 0.014, 0.08), GOLD, (0.19, 0, 0.5)), B(bm_sphere(0.04, u=6, v=4), APPLE, (0, 0, 0.69))], "Flag_body", coll, parent=pr)
    pr = Pr("Pushke")            # a tzedakah box (a blue tin with a slot)
    bake([B(bm_box(0.13, 0.09, 0.16), mat("SnPushke", "#1E88E5", 0.4, 0.4), (0, 0, 0.0)), B(bm_box(0.06, 0.092, 0.012), BLACK, (0, 0, 0.081)),
          B(bm_box(0.08, 0.092, 0.04), mat("SnPushkeLabel", "#FFF8E1", 0.7), (0, 0, 0.0))], "Pushke_body", coll, parent=pr)
    pr = Pr("BreadBag")          # the last of the chametz, in a paper bag
    bake([B(bm_box(0.16, 0.1, 0.2), mat("SnPaperBag", "#C8A26B", 0.9), (0, 0, 0.1)), B(bm_sphere(0.05, u=6, v=4), mat("SnChallah", "#C9792C", 0.6), (0, 0, 0.21))], "BreadBag_body", coll, parent=pr)

    # ── erev Pesach: burning the chametz, in a safe metal barrel on bricks, a bucket of water beside ──
    pr = Pr("BurnBarrel")
    DRUM = mat("SnDrum", "#546E7A", 0.5, 0.5)
    BRICK = mat("SnBrick", "#A0574A", 0.9)
    parts = [B(bm_cyl(0.32, 0.32, 0.75, 10), DRUM, (0, 0, 0.62)), B(bm_torus(0.32, 0.02, 10, 4), DRUM, (0, 0, 0.98)), B(bm_torus(0.32, 0.02, 10, 4), DRUM, (0, 0, 0.5)),
             B(bm_box(0.25, 0.12, 0.25), BRICK, (-0.2, 0, 0.12)), B(bm_box(0.25, 0.12, 0.25), BRICK, (0.2, 0, 0.12)), B(bm_box(0.12, 0.25, 0.25), BRICK, (0, 0.2, 0.12)),
             B(bm_box(0.7, 0.04, 0.02), mat("SnGrate", "#37474F", 0.6, 0.6), (0, 0, 1.0)), B(bm_box(0.04, 0.7, 0.02), mat("SnGrate", "#37474F", 0.6, 0.6), (0, 0, 1.0)),
             B(bm_cyl(0.2, 0.16, 0.32, 8), mat("SnPail", "#1E88E5", 0.4, 0.3), (0.85, -0.3, 0.16)), B(bm_cyl(0.18, 0.18, 0.02, 8), mat("SnWaterTop", "#81D4FA", 0.1), (0.85, -0.3, 0.31))]
    bake(parts, "BurnBarrel_body", coll, parent=pr)
    fl = bpy.data.objects.new("Flames", None)
    coll.objects.link(fl)
    fl.parent = pr
    bake([B(bm_cyl(0.22, 0.0, 0.55, 6), FL1, (0, 0, 1.25)), B(bm_cyl(0.14, 0.0, 0.42, 5), FL2, (0.06, 0.04, 1.18)), B(bm_cyl(0.12, 0.0, 0.35, 5), FL1, (-0.1, -0.05, 1.12))],
         "BurnBarrel_flames", coll, parent=fl)
    _light(coll, pr, "Light_1", (0, 0, 1.2))

    # ── Tashlich: a pond (in a field, for the highway and Midwood) ───────────────────────────
    pr = Pr("Pond")
    parts = [B(bm_cyl(4.2, 4.2, 0.04, 14), mat("SnPondWater", "#4FA3D9", 0.15), (0, 0, 0.03)), B(bm_cyl(4.5, 4.5, 0.03, 14), mat("SnPondEdge", "#8D7B5A", 0.95), (0, 0, 0.015))]
    for k in range(12):
        a = k / 12 * math.tau
        parts.append(B(bm_ico(0.28, 0), STONE, (math.cos(a) * 4.4, math.sin(a) * 4.4, 0.08)))
    for k in range(7):
        a = 2.2 + k * 0.22
        parts.append(B(bm_box(0.04, 0.04, 0.9), mat("SnReed", "#7C8B3A", 0.9), (math.cos(a) * 3.9, math.sin(a) * 3.9, 0.45), rot=(0.1, 0.05 * k, 0)))
    bake(parts, "Pond_body", coll, parent=pr)

    # ── Purim: the music van's roof kit (two horn speakers, a sign board — the runtime sign) ──────
    pr = Pr("SpeakerKit")
    GREYM = mat("SnSpeaker", "#ECEFF1", 0.4, 0.3)
    bake([B(bm_box(1.1, 0.5, 0.05), BLACK, (0, 0, 0.025)), B(bm_cyl(0.08, 0.2, 0.42, 8, "Y"), GREYM, (-0.32, -0.05, 0.22)), B(bm_cyl(0.08, 0.2, 0.42, 8, "Y"), GREYM, (0.32, -0.05, 0.22)),
          B(bm_box(1.5, 0.05, 0.45), mat("SignBoard", "#FBF8F0", 0.8), (0, 0.24, 0.42)), B(bm_box(0.05, 0.05, 0.45), BLACK, (-0.6, 0.24, 0.2)), B(bm_box(0.05, 0.05, 0.45), BLACK, (0.6, 0.24, 0.2))],
         "SpeakerKit_body", coll, parent=pr)
    _light(coll, pr, "Sign", (0, 0.21, 0.42))

    _spread(items)
    return coll


ASSETS = [
    ("seasons_props", build_props),
]
