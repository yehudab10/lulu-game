"""
Heist (features/heist): banks, cartoon robberies, Lulu's own cartoon heist,
road snatchers, and the cops' cartoon gear. NOTHING here is a real weapon:
the "guns" are a water pistol, a banana and a confetti blaster (plus a baguette).

    heist_bank       a town bank (Lakewood's "First Minivan Bank", Midwood's "Kings County
                     Savings & Bagel" — the same model, re-tinted; the sign comes from the
                     town's sign atlas at Anchor_sign). Front = -Y. Walls / Roof recolourable.
    heist_bankint    the bank INTERIOR set (interiors engine: Spot_ / Col_ / Light_ / Fx_
                     anchors; movers VaultDoor (hinge pivot) and VaultWheel)
    heist_props      Prop_<name> nodes the game clones: WaterPistol, Banana, Confetti,
                     Baguette, MoneyBag, Lollipop, Rugelach
    heist_robber     the striped robber (shirt stripes + an eye mask, a beanie)
    heist_guard      the bank guard (asleep, mostly)
    heist_teller     the teller
    heist_getaway    the getaway car (purple, yellow racing stripes, whitewalls) — Paint / Stripe
    heist_moped      the snatcher's moped (Paint; Anchor_seat for the rider)
    heist_net        the stun net (a rope dome with weights + a blue zap ring)
    heist_spikes     the cartoon spike strip (yellow-black hinged boards, rubbery orange spikes)
    heist_store      a highway mini-mart (KOSHER QUIK-MART) with Anchor_door
"""
from lib import *
from lib_people import build_person
from assets_interiors import SetBuilder, shell, tiles, wainscot, door, frame_pic, bm_text_lo


def txt(coll, body, size, m, loc, face="-Y", extrude=0.01):
    rot = {"-Y": (math.pi / 2, 0, 0), "+Y": (math.pi / 2, 0, math.pi), "+Z": (0, 0, 0)}[face]
    return Part(coll, "txt", bm_text_lo(body, size, extrude), m, loc=loc, rot=rot, smooth=False)


# ══════════════════════════════════ the bank ═══════════════════════════════
def build_bank():
    """A little classical bank: steps, four fat columns, a pediment with a gold $ medallion,
    bronze double doors, tall windows, a night-deposit slot and an ATM on the front."""
    coll = scene_coll("HeistBank")
    root = root_empty(coll, "HeistBank")
    S = shared()
    W = mat("Walls", "#E9DFC9", rough=0.85)
    TRIM = mat("Trim", "#F7F2E6", rough=0.7)
    ROOF = mat("Roof", "#5D6D7E", rough=0.8)
    COL = mat("Column", "#FBF8F0", rough=0.6)
    BRONZE = mat("Bronze", "#9C6B30", rough=0.35, metal=0.7)
    WIN = mat("Window", "#8FCDEB", rough=0.15, emit=0.2)
    GOLD = mat("Gold", "#F4C430", rough=0.3, metal=0.8)
    SIGN = mat("SignBoard", "#F5F1E6", rough=0.8)
    STEP = mat("Concrete", "#CFC8BB", rough=0.95)
    ATM = mat("AtmGreen", "#2E7D32", rough=0.4)
    SCREEN = mat("NeonAtm", "#80DEEA", rough=0.2, emit=1.4)
    w, d, h = 20.0, 14.0, 7.2
    fy = -d / 2
    parts = [Part(coll, "body", bm_box(w, d, h), W, loc=(0, 0, h / 2), smooth=False),
             Part(coll, "base", bm_box(w + 0.3, d + 0.3, 0.6), TRIM, loc=(0, 0, 0.3), smooth=False),
             Part(coll, "cornice", bm_box(w + 0.6, d + 0.6, 0.45), TRIM, loc=(0, 0, h + 0.22), smooth=False),
             Part(coll, "roof", bm_box(w - 0.4, d - 0.4, 0.5), ROOF, loc=(0, 0, h + 0.6), smooth=False)]
    # the portico: steps, columns, entablature (the sign board sits on it), pediment
    px = 13.0
    for k in range(3):
        parts.append(Part(coll, "step", bm_box(px + 1.2 - k * 0.4, 1.0 + 0.5 * (2 - k), 0.22), STEP,
                          loc=(0, fy - 2.2 + k * 0.5 + 0.25 * k, 0.11 + 0.22 * k), smooth=False))
    for k in range(4):
        x = -4.8 + k * 3.2
        parts.append(Part(coll, "col", bm_cyl(0.42, 0.36, 5.0, 16), COL, loc=(x, fy - 2.0, 3.16)))
        parts.append(Part(coll, "colbase", bm_box(1.0, 1.0, 0.25), TRIM, loc=(x, fy - 2.0, 0.78), smooth=False))
        parts.append(Part(coll, "colcap", bm_box(1.05, 1.05, 0.25), TRIM, loc=(x, fy - 2.0, 5.78), smooth=False))
    parts.append(Part(coll, "porchroof", bm_box(px, 2.9, 0.3), TRIM, loc=(0, fy - 1.45, 6.05), smooth=False))
    parts.append(Part(coll, "entab", bm_box(px, 0.5, 1.2), TRIM, loc=(0, fy - 2.65, 6.5), smooth=False))
    parts.append(Part(coll, "sign", bm_box(11.8, 0.12, 1.0), SIGN, loc=(0, fy - 2.95, 6.5), smooth=False))
    ped = bm_prism([(-px / 2 - 0.2, 0.0), (px / 2 + 0.2, 0.0), (0.0, 1.9)], 0.45)
    parts.append(Part(coll, "pediment", ped, TRIM, loc=(0, fy - 2.5, 7.1), rot=(0, 0, math.pi / 2), smooth=False))
    parts.append(Part(coll, "medal", bm_cyl(0.55, 0.55, 0.12, 20, "Y"), GOLD, loc=(0, fy - 2.98, 7.75)))
    parts.append(txt(coll, "$", 0.75, BRONZE, (0, fy - 3.06, 7.72), extrude=0.03))
    # the doors (bronze, a big round handle each) + the fanlight
    parts.append(Part(coll, "doorframe", bm_box(3.4, 0.2, 3.6), TRIM, loc=(0, fy - 0.05, 1.8 + 0.6), smooth=False))
    for s in (-1, 1):
        parts.append(Part(coll, "door", bm_box(1.45, 0.14, 3.2), BRONZE, loc=(s * 0.76, fy - 0.12, 2.2), smooth=False))
        parts.append(Part(coll, "handle", bm_torus(0.12, 0.025, 14, 5), GOLD, loc=(s * 0.25, fy - 0.22, 2.1), rot=(math.pi / 2, 0, 0)))
    parts.append(Part(coll, "fan", bm_cyl(1.5, 1.5, 0.1, 18, "Y"), WIN, loc=(0, fy - 0.08, 3.9)).cut(
        Part(coll, "fancut", bm_box(3.4, 0.5, 1.6), None, loc=(0, fy - 0.08, 3.1))))
    # tall windows either side of the portico
    for x in (-8.3, 8.3):
        parts.append(Part(coll, "winframe", bm_box(1.9, 0.12, 3.6), TRIM, loc=(x, fy - 0.02, 3.2), smooth=False))
        parts.append(Part(coll, "win", bm_box(1.5, 0.14, 3.2), WIN, loc=(x, fy - 0.06, 3.2), smooth=False))
        parts.append(Part(coll, "sill", bm_box(2.1, 0.4, 0.15), TRIM, loc=(x, fy - 0.2, 1.35), smooth=False))
    # the ATM ("Any Time Money? No.") + night deposit slot, right of the portico
    parts.append(Part(coll, "atm", bm_box(1.1, 0.5, 1.9), ATM, loc=(7.0 - 1.4, fy - 0.25, 1.55), smooth=False).bevel(0.05, 1))
    parts.append(Part(coll, "atmscreen", bm_box(0.6, 0.06, 0.4), SCREEN, loc=(7.0 - 1.4, fy - 0.52, 1.9), smooth=False))
    parts.append(Part(coll, "slot", bm_box(0.9, 0.12, 0.2), BRONZE, loc=(-5.6, fy - 0.1, 1.5), smooth=False))
    parts.append(Part(coll, "flag", bm_cyl(0.05, 0.04, 4.0, 8), S.CHROME, loc=(-7.4, fy - 3.4, 2.0)))
    parts.append(Part(coll, "flagcloth", bm_box(0.05, 1.2, 0.8), mat("Flag", "#2E7D32", rough=0.8), loc=(-7.4, fy - 4.0, 3.55), smooth=False))
    bake(parts, "HeistBank_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, fy - 3.02, 6.5))
    anchor(coll, root, "Anchor_door", (0, fy - 2.6, 0))
    return coll


# ═════════════════════════════════ the interior ════════════════════════════
def build_bank_interior():
    """Inside: a marble floor, the teller line (velvet ropes), the teller window, a guard napping
    in his chair by the vault, the vault door (a mover, hinged on its left), the lollipop jar."""
    S = SetBuilder("HeistBankInt")
    W, D, H = 16.0, 10.0, 4.8
    FLOOR = mat("BankFloor", "#E8E2D6", 0.35)
    TILE = mat("BankTile", "#B9AE98", 0.35)
    WALL = mat("BankWall", "#D8CBB0", 0.9)
    WAIN = mat("BankWainscot", "#6D4C41", 0.55)
    RAIL = mat("BankRail", "#C9A86A", 0.4, 0.5)
    CAP = mat("BankCap", "#4E342E", 0.8)
    LIP = mat("BankLip", "#5D4037", 0.8)
    WOOD = mat("BankWood", "#7B4A2A", 0.5)
    WOODT = mat("BankWoodTop", "#A1887F", 0.35)
    BRASS = mat("BankBrass", "#D4AF37", 0.3, 0.8)
    GLASS = mat("GlassBank", "#BFE6F7", 0.05)
    VELVET = mat("BankVelvet", "#B71C1C", 0.8)
    STEEL = mat("VaultSteel", "#9EA7AD", 0.3, 0.85)
    STEELD = mat("VaultDark", "#55606A", 0.35, 0.7)
    GOLDT = mat("BankGoldText", "#FFD54F", 0.4, emit=0.8)
    SIGN = mat("BankSign", "#2B1B10", 0.6)
    CHAIR = mat("BankChair", "#1F3A5F", 0.7)
    PLANT = mat("BankPlant", "#43A047", 0.85)
    POT = mat("BankPot", "#BF6B3A", 0.8)
    PANEL = mat("NeonTube", "#FFF8E7", 0.5, emit=2.2)
    JAR = mat("GlassJar", "#D7F1FF", 0.05)
    LOLLY = [mat("BankLolly%d" % i, c, 0.4) for i, c in enumerate(("#FF4081", "#FFD740", "#69F0AE", "#40C4FF"))]
    PAPER = mat("BankPaper", "#FFF8E1", 0.8)
    DOOR = mat("BankDoor", "#5D4037", 0.5, 0.2)
    KNOB = mat("BankKnob", "#ECEFF1", 0.2, 0.8)
    EXITR = mat("NeonExitRed", "#FF5252", 0.3, emit=3.0)

    shell(S, W, D, H, FLOOR, WALL, CAP, LIP)
    tiles(S, W, D, 1.0, FLOOR, TILE)
    wainscot(S, W, D, 1.0, WAIN, RAIL)
    for k, x in enumerate((-4.0, 3.5)):
        S.box(2.4, 0.3, 0.08, PANEL, x, -0.5, H - 0.35)
        S.light("tube%d" % k, x, -0.5, H - 0.8)
    S.light("alarm", 4.6, 3.6, 3.4)

    # the teller counter (back-left), a glass partition, the TELLER sign
    cx, cy = -3.6, 2.6
    S.box(6.4, 1.0, 1.15, WOOD, cx, cy, 0.58, bevel=0.03)
    S.box(6.6, 1.15, 0.07, WOODT, cx, cy, 1.18, bevel=0.02)
    S.box(6.4, 0.05, 1.0, GLASS, cx, cy - 0.1, 1.72)
    S.box(6.5, 0.12, 0.08, BRASS, cx, cy - 0.1, 2.25)
    for k in range(4):
        S.box(0.06, 0.08, 1.0, BRASS, cx - 3.2 + k * 2.13, cy - 0.1, 1.72)
    S.box(2.0, 0.08, 0.45, SIGN, cx, D / 2 - 0.1, 3.2)
    S.text("TELLER", 0.28, GOLDT, cx, D / 2 - 0.16, 3.2, "-Y")
    S.box(0.5, 0.35, 0.03, PAPER, cx + 1.0, cy - 0.2, 1.23)
    S.cyl(0.07, 0.09, 0.05, BRASS, cx - 1.2, cy - 0.3, 1.24, segs=12)    # the desk bell
    S.sph(0.03, BRASS, cx - 1.2, cy - 0.3, 1.29)
    # the lollipop jar (end of the counter)
    jx, jy = cx + 2.7, cy - 0.25
    S.cyl(0.16, 0.16, 0.34, JAR, jx, jy, 1.4, segs=14)
    S.cyl(0.17, 0.17, 0.04, BRASS, jx, jy, 1.59, segs=14)
    for k, m in enumerate(LOLLY):
        a = k * 1.57
        S.sph(0.06, m, jx + math.cos(a) * 0.07, jy + math.sin(a) * 0.07, 1.68)
        S.cyl(0.008, 0.008, 0.25, PAPER, jx + math.cos(a) * 0.07, jy + math.sin(a) * 0.07, 1.52, segs=5)
    S.col("counter", cx, cy + 0.6, 3.3, 1.0)
    S.spot("teller", cx, cy + 0.85, 0)
    S.spot("window", cx, cy - 1.15, math.pi)
    S.spot("lolly", jx, jy - 0.95, math.pi)

    # the line: brass stanchions + velvet ropes zig-zagging toward the window
    posts = [(-6.4, 0.9), (-6.4, -0.4), (-6.4, -1.7), (-1.0, 0.9), (-1.0, -0.4), (-1.0, -1.7)]
    for (x, y) in posts:
        S.cyl(0.05, 0.05, 0.95, BRASS, x, y, 0.48, segs=8)
        S.cyl(0.18, 0.2, 0.05, BRASS, x, y, 0.03, segs=12)
        S.sph(0.07, BRASS, x, y, 0.98)
    for y in (0.9, -0.4, -1.7):
        S.box(5.3, 0.06, 0.06, VELVET, -3.7, y, 0.85)
    for k, y in enumerate((0.25, -1.05)):
        S.spot("line%d" % k, -3.0 - k * 1.1, y, math.pi)
    S.spot("line2", -4.9, 0.25, math.pi)

    # the vault (back-right): a steel frame in the wall, the round door on a hinge (mover)
    vx, vy = 4.6, D / 2 - 0.05
    S.box(3.6, 0.3, 3.6, STEELD, vx, vy - 0.1, 1.85)
    S.cyl(1.45, 1.45, 0.12, mat("VaultDark2", "#2B3137", 0.6), vx, vy - 0.27, 1.85, segs=28, axis="Y")
    S.box(5.0, 0.08, 0.5, SIGN, vx, D / 2 - 0.1, H - 0.5)
    S.text("VAULT · NAP TIME 2:15-2:45", 0.2, GOLDT, vx, D / 2 - 0.16, H - 0.5, "-Y")
    hinge = (vx - 1.35, vy - 0.4, 1.85)

    def vault_door():
        S._p(bm_cyl(1.35, 1.35, 0.32, 32, "Y"), STEEL, (vx, vy - 0.42, 1.85), (0, 0, 0), True)
        for k in range(8):
            a = k * math.pi / 4
            S._p(bm_cyl(0.09, 0.09, 0.1, 10, "Y"), STEELD, (vx + math.cos(a) * 1.12, vy - 0.62, 1.85 + math.sin(a) * 1.12), (0, 0, 0), True)
        S._p(bm_box(0.3, 0.2, 0.5), STEELD, (vx - 1.3, vy - 0.45, 2.5), (0, 0, 0), False)
        S._p(bm_box(0.3, 0.2, 0.5), STEELD, (vx - 1.3, vy - 0.45, 1.2), (0, 0, 0), False)
    S.mover("VaultDoor", vault_door, hinge)

    def vault_wheel():
        S._p(bm_torus(0.45, 0.05, 20, 6), BRASS, (vx, vy - 0.64, 1.85), (math.pi / 2, 0, 0), True)
        for k in range(3):
            S._p(bm_box(0.9, 0.06, 0.06), BRASS, (vx, vy - 0.64, 1.85), (0, k * math.pi / 3, 0), False)
        S._p(bm_cyl(0.1, 0.1, 0.12, 12, "Y"), BRASS, (vx, vy - 0.66, 1.85), (0, 0, 0), True)
    S.mover("VaultWheel", vault_wheel, (vx, vy - 0.64, 1.85))
    S.col("vault", vx, vy - 0.3, 2.0, 0.6)
    S.spot("vault", vx, vy - 2.0, math.pi)
    S.fx("vault", vx, vy - 0.7, 1.85)

    # the guard's chair beside the vault (he naps in it) + a little podium
    gx, gy = 1.6, 2.9
    S.box(0.6, 0.55, 0.08, CHAIR, gx, gy, 0.48)
    S.box(0.6, 0.08, 0.7, CHAIR, gx, gy + 0.27, 0.85)
    for sx in (-1, 1):
        for sy in (-1, 1):
            S.cyl(0.025, 0.025, 0.46, STEELD, gx + sx * 0.25, gy + sy * 0.22, 0.23, segs=6)
    S.box(0.5, 0.4, 1.1, WOOD, gx + 1.0, gy - 0.1, 0.55, bevel=0.02)
    S.box(0.35, 0.25, 0.05, PAPER, gx + 1.0, gy - 0.12, 1.12)
    S.col("guard", gx, gy, 0.45, 0.45)
    S.spot("guard", gx, gy - 0.05, 0)
    S.spot("guardTalk", gx, gy - 1.25, math.pi)

    # a bench, a plant, a clock, a framed "OUR FOUNDER" picture
    S.box(2.2, 0.5, 0.1, WOOD, 4.8, -2.8, 0.5, bevel=0.02)
    for sx in (-1, 1):
        S.box(0.08, 0.45, 0.48, WOODT, 4.8 + sx * 1.0, -2.8, 0.24)
    S.col("bench", 4.8, -2.8, 1.15, 0.3)
    S.cyl(0.3, 0.25, 0.5, POT, -7.1, -3.6, 0.25, segs=12)
    S.sph(0.55, PLANT, -7.1, -3.6, 1.0, rz=0.75)
    S.col("plant", -7.1, -3.6, 0.35, 0.35)
    S.cyl(0.42, 0.42, 0.06, BRASS, -0.2, D / 2 - 0.1, 3.4, segs=20, axis="Y")
    S.cyl(0.36, 0.36, 0.07, PAPER, -0.2, D / 2 - 0.13, 3.4, segs=20, axis="Y")
    S.box(0.03, 0.02, 0.26, SIGN, -0.2, D / 2 - 0.17, 3.48)
    S.box(0.2, 0.02, 0.03, SIGN, -0.12, D / 2 - 0.17, 3.4)
    frame_pic(S, -W / 2 + 0.1, 1.0, 2.5, 1.0, 1.2, BRASS, mat("BankPic", "#8D6E63", 0.8), face="+X")
    S.fx("founder", -W / 2 + 0.2, 1.0, 2.5)
    # the door out (left wall, front)
    door(S, -W / 2, -2.8, "+X", DOOR, RAIL, KNOB, SIGN, EXITR, "EXIT")
    S.spot("door", -W / 2 + 0.95, -2.8, math.pi / 2)
    S.spot("lulu", -W / 2 + 2.4, -2.8, math.pi / 2)
    return S.finish()


# ════════════════════════════════════ props ════════════════════════════════
def build_props():
    """Every hand prop, one node each (Prop_<name>); origin at the grip, pointing -Y (forward)."""
    coll = scene_coll("HeistProps")
    root = root_empty(coll, "HeistProps")
    S = shared()

    def prop(name, parts, x):
        return bake(parts, "Prop_" + name, coll, parent=root)

    # a water pistol: chunky lime plastic, an orange tank on top, a blue trigger
    LIME = mat("PlasticLime", "#76FF03", rough=0.35)
    ORNG = mat("PlasticOrange", "#FF9100", rough=0.35)
    BLUE = mat("PlasticBlue", "#2979FF", rough=0.35)
    WATER = mat("WaterTank", "#80D8FF", rough=0.1)
    prop("WaterPistol", [
        Part(coll, "grip", bm_box(0.05, 0.07, 0.14), LIME, loc=(0, 0.02, -0.04), rot=(0.25, 0, 0)).bevel(0.015, 2),
        Part(coll, "barrel", bm_box(0.06, 0.26, 0.07), LIME, loc=(0, -0.1, 0.05)).bevel(0.02, 2),
        Part(coll, "tank", bm_cyl(0.05, 0.05, 0.12, 12, "Y"), WATER, loc=(0, -0.05, 0.12)),
        Part(coll, "cap", bm_cyl(0.025, 0.025, 0.03, 8), ORNG, loc=(0, -0.05, 0.18)),
        Part(coll, "nozzle", bm_cyl(0.018, 0.012, 0.06, 8, "Y"), ORNG, loc=(0, -0.25, 0.05)),
        Part(coll, "trigger", bm_box(0.02, 0.02, 0.05), BLUE, loc=(0, -0.03, -0.0)),
    ], 0)

    # a banana "gun": a curved banana held like a pistol (a sticker says BANG)
    YEL = mat("Banana", "#FFE135", rough=0.55)
    TIP = mat("BananaTip", "#5D4037", rough=0.7)
    bparts = []
    n = 9
    for i in range(n):
        t = i / (n - 1)
        a = -0.9 + 1.8 * t
        r = 0.035 + 0.012 * math.sin(t * math.pi)
        bparts.append(Part(coll, "b%d" % i, bm_sphere(r, r * 1.6, r, 10, 6), YEL, loc=(0, -0.02 - 0.3 * t, 0.07 * math.cos(a * 1.3) - 0.03), rot=(a * 0.35, 0, 0)))
    bparts.append(Part(coll, "stem", bm_cyl(0.012, 0.016, 0.05, 6, "Y"), TIP, loc=(0, 0.02, -0.01)))
    bparts.append(Part(coll, "end", bm_sphere(0.012, 0.012, 0.012, 6, 4), TIP, loc=(0, -0.335, -0.0)))
    bparts.append(Part(coll, "sticker", bm_box(0.075, 0.05, 0.004), mat("BananaSticker", "#1565C0", rough=0.6), loc=(0.038, -0.15, 0.05), rot=(0, math.pi / 2, 0)))
    prop("Banana", bparts, 0)

    # a confetti blaster: a party cannon (striped tube, a gold bell mouth, stars)
    PINK = mat("PartyPink", "#FF4081", rough=0.4)
    GOLD = mat("PartyGold", "#FFD740", rough=0.3, metal=0.6)
    PURP = mat("PartyPurple", "#7C4DFF", rough=0.4)
    cparts = [Part(coll, "tube", bm_cyl(0.05, 0.05, 0.3, 14, "Y"), PINK, loc=(0, -0.12, 0.04)),
              Part(coll, "bell", bm_cyl(0.06, 0.1, 0.1, 16, "Y"), GOLD, loc=(0, -0.31, 0.04)),
              Part(coll, "handle", bm_box(0.04, 0.05, 0.12), PURP, loc=(0, 0.0, -0.04), rot=(0.2, 0, 0)).bevel(0.012, 2)]
    for k in range(3):
        cparts.append(Part(coll, "band", bm_torus(0.052, 0.008, 14, 4), PURP, loc=(0, -0.04 - k * 0.09, 0.04), rot=(math.pi / 2, 0, 0)))
    for k, (dx, dz) in enumerate(((0.05, 0.1), (-0.05, 0.12), (0.0, 0.16))):
        cparts.append(Part(coll, "star", bm_ico(0.022, 0), [GOLD, PINK, PURP][k], loc=(dx, -0.36, 0.04 + dz)))
    prop("Confetti", cparts, 0)

    # a baguette (French, fresh, threatening only to carbs)
    CRUST = mat("Crust", "#D9A35B", rough=0.8)
    SLASH = mat("CrustLight", "#F3D29A", rough=0.85)
    gparts = [Part(coll, "loaf", bm_sphere(0.045, 0.34, 0.045, 12, 8), CRUST, loc=(0, -0.2, 0.0))]
    for k in range(4):
        gparts.append(Part(coll, "slash", bm_box(0.05, 0.07, 0.008), SLASH, loc=(0, -0.05 - k * 0.1, 0.042), rot=(0, 0, 0.6)))
    prop("Baguette", gparts, 0)

    # a money bag ($ on both sides)
    SACK = mat("Burlap", "#C9A66B", rough=0.95)
    TIE = mat("Twine", "#6D4C41", rough=0.8)
    CASH = mat("DollarGreen", "#2E7D32", rough=0.6)
    prop("MoneyBag", [
        Part(coll, "sack", bm_sphere(0.22, 0.19, 0.24, 14, 10), SACK, loc=(0, 0, -0.3)),
        Part(coll, "neck", bm_cyl(0.06, 0.1, 0.12, 12), SACK, loc=(0, 0, -0.04)),
        Part(coll, "tie", bm_torus(0.065, 0.018, 12, 5), TIE, loc=(0, 0, -0.06)),
        txt(coll, "$", 0.24, CASH, (0, -0.19, -0.3), extrude=0.012),
        txt(coll, "$", 0.24, CASH, (0, 0.19, -0.3), face="+Y", extrude=0.012),
    ], 0)

    # a lollipop (the bank's free one)
    prop("Lollipop", [
        Part(coll, "stick", bm_cyl(0.008, 0.008, 0.16, 6), mat("LollyStick", "#FAFAFA", rough=0.6), loc=(0, 0, 0.0)),
        Part(coll, "candy", bm_cyl(0.05, 0.05, 0.02, 16, "Y"), mat("LollyCandy", "#FF4081", rough=0.3), loc=(0, 0, 0.12)),
        Part(coll, "swirl", bm_torus(0.03, 0.006, 14, 4), mat("LollySwirl", "#FFFFFF", rough=0.3), loc=(0, -0.012, 0.12), rot=(math.pi / 2, 0, 0)),
    ], 0)

    # a box of rugelach (THE stick-up)
    BOX = mat("BakeryBox", "#FFFFFF", rough=0.8)
    STR = mat("BakeryString", "#E53935", rough=0.7)
    RUG = mat("Rugelach", "#C68642", rough=0.7)
    rparts = [Part(coll, "box", bm_box(0.26, 0.2, 0.07), BOX, loc=(0, -0.1, -0.02)).bevel(0.01, 1),
              Part(coll, "string", bm_box(0.27, 0.01, 0.075), STR, loc=(0, -0.1, -0.02)),
              Part(coll, "string2", bm_box(0.01, 0.21, 0.075), STR, loc=(0, -0.1, -0.02))]
    for k in range(4):
        rparts.append(Part(coll, "rug", bm_torus(0.025, 0.014, 10, 5), RUG, loc=(-0.08 + k * 0.055, -0.1, 0.03), rot=(0, 0.3, 0)))
    prop("Rugelach", rparts, 0)

    return coll


# ═══════════════════════════════════ people ════════════════════════════════
def build_robber():
    """A cartoon cat burglar: black-and-white striped shirt, black pants, a beanie and an eye mask."""
    coll = build_person("HeistRobber", dict(hair="short", hair_color="#2B2B2B", top="#F5F5F5", sleeves="long", bottom="pants",
                                            bottom_color="#1E1E24", shoes="#111111", skin="#F2C6A0", extras=["cap"],
                                            extra_colors={"Hat": "#1E1E24"}))
    body = bpy.data.objects.get("Body")
    k = 1.0
    STRIPE = mat("Stripe", "#1B1B1B", rough=0.7)
    MASK = mat("Mask", "#111111", rough=0.5)
    parts = []
    chest = 1.14
    for dz in (-0.17, -0.07, 0.03, 0.13):
        z = chest + dz
        f = math.sqrt(max(0.0, 1 - (dz / 0.24) ** 2))
        parts.append(Part(coll, "stripe", bm_cyl(0.203 * f + 0.004, 0.203 * f + 0.004, 0.045, 20), STRIPE, loc=(0, 0, z)))
    # (the ring is round; squash it to the torso's 0.20 × 0.15 ellipse)
    for p in parts:
        p.ob.scale = (1.0, 0.77, 1.0)
    head_z = 1.37 + 0.19 * 0.95
    parts.append(Part(coll, "mask", bm_cyl(0.197, 0.197, 0.075, 22), MASK, loc=(0, 0, head_z + 0.012)))
    parts[-1].ob.scale = (1.0, 0.96, 1.0)
    for s in (-1, 1):
        parts.append(Part(coll, "maskeye", bm_sphere(0.04, 0.02, 0.03, 10, 6), mat("MaskEye", "#FFFFFF", rough=0.4), loc=(s * 0.07, -0.183, head_z + 0.012)))
        parts.append(Part(coll, "pupil", bm_sphere(0.018, 0.012, 0.02, 8, 6), mat("Eye", "#1B1B1B"), loc=(s * 0.07, -0.198, head_z + 0.012)))
    for p in parts:
        p.ob.rotation_mode = "XYZ"
    ob = bake(parts, "Robber_extras", coll, parent=body if body else None)
    return coll


def build_guard():
    return build_person("HeistGuard", dict(hair="short", hair_color="#9E9E9E", top="#1F3A5F", sleeves="long", bottom="pants",
                                           bottom_color="#1B2A3A", shoes="#111111", extras=["police_hat", "badge", "mustache", "belly"],
                                           extra_colors={"Hat": "#1F3A5F", "Beard": "#9E9E9E"}))


def build_teller():
    return build_person("HeistTeller", dict(hair="sheitel", hair_color="#5D4037", top="#00897B", sleeves="long", bottom="skirt",
                                            bottom_color="#263238", extras=["glasses", "necklace"]))


# ═══════════════════════════════════ vehicles ══════════════════════════════
def build_getaway():
    """The getaway car: a boxy 70s purple sedan, yellow racing stripes, whitewall tyres,
    a dented bumper and a loud exhaust. Front = -Y."""
    coll = scene_coll("HeistGetaway")
    root = root_empty(coll, "HeistGetaway")
    S = shared()
    PAINT = mat("Paint", "#7B1FA2", rough=0.35)
    STRIPE = mat("Stripe", "#FFD600", rough=0.4)
    parts = [
        Part(coll, "body", bm_box(1.84, 4.6, 0.6), PAINT, loc=(0, 0, 0.66)).bevel(0.1, 2),
        Part(coll, "cabin", bm_box(1.6, 2.1, 0.56), S.TINT, loc=(0, 0.3, 1.2)).bevel(0.12, 2),
        Part(coll, "roof", bm_box(1.54, 1.8, 0.08), PAINT, loc=(0, 0.32, 1.48)).bevel(0.03, 2),
        Part(coll, "bumperF", bm_box(1.86, 0.2, 0.2), S.CHROME, loc=(0, -2.32, 0.48), rot=(0, 0.06, 0)).bevel(0.05, 2),
        Part(coll, "bumperR", bm_box(1.86, 0.2, 0.2), S.CHROME, loc=(0, 2.32, 0.48)).bevel(0.05, 2),
        Part(coll, "pipe", bm_cyl(0.06, 0.06, 0.3, 10, "Y"), S.CHROME, loc=(0.6, 2.42, 0.35)),
    ]
    for s in (-1, 1):
        parts.append(Part(coll, "stripe", bm_box(0.22, 4.62, 0.02), STRIPE, loc=(s * 0.2, 0, 0.97)))
        parts.append(Part(coll, "stripeR", bm_box(0.22, 1.82, 0.02), STRIPE, loc=(s * 0.2, 0.32, 1.53)))
        parts.append(Part(coll, "head", bm_cyl(0.13, 0.13, 0.06, 12, "Y"), S.HEAD, loc=(s * 0.6, -2.31, 0.74)))
        parts.append(Part(coll, "tail", bm_box(0.36, 0.06, 0.14), S.TAIL, loc=(s * 0.6, 2.31, 0.78)).bevel(0.03, 2))
    parts.append(Part(coll, "dice", bm_box(0.08, 0.08, 0.08), mat("Dice", "#FF4081", rough=0.6), loc=(0.1, -0.55, 1.28), rot=(0.4, 0.3, 0.2)))
    bake(parts, "HeistGetaway_body", coll, parent=root)
    WHITEWALL = mat("Whitewall", "#F5F5F5", rough=0.6)
    four_wheels(coll, root, 0.82, -1.5, 1.5, 0.35, 0.26, S.TIRE, WHITEWALL, S.TIRE)
    anchor(coll, root, "Anchor_driver", (0.38, 0.1, 0.62))
    anchor(coll, root, "Anchor_window", (0.95, 0.1, 1.15))
    return coll


def build_moped():
    """A tiny mint-and-pink moped (the snatcher's). Anchor_seat = where the rider sits. Front = -Y."""
    coll = scene_coll("HeistMoped")
    root = root_empty(coll, "HeistMoped")
    S = shared()
    PAINT = mat("Paint", "#26C6DA", rough=0.35)
    SEAT = mat("MopedSeat", "#3E2723", rough=0.7)
    PINK = mat("MopedPink", "#FF4081", rough=0.4)
    parts = [
        Part(coll, "deck", bm_box(0.36, 0.95, 0.1), PAINT, loc=(0, 0.05, 0.32)).bevel(0.04, 2),
        Part(coll, "rear", bm_sphere(0.24, 0.42, 0.24, 14, 8), PAINT, loc=(0, 0.42, 0.52)),
        Part(coll, "front", bm_box(0.4, 0.16, 0.7), PAINT, loc=(0, -0.48, 0.65), rot=(-0.25, 0, 0)).bevel(0.06, 2),
        Part(coll, "seat", bm_box(0.3, 0.6, 0.1), SEAT, loc=(0, 0.38, 0.8)).bevel(0.05, 2),
        Part(coll, "stem", bm_cyl(0.03, 0.03, 0.5, 8), S.CHROME, loc=(0, -0.6, 0.98), rot=(-0.25, 0, 0)),
        Part(coll, "bar", bm_cyl(0.025, 0.025, 0.62, 8, "X"), S.CHROME, loc=(0, -0.66, 1.22)),
        Part(coll, "lamp", bm_cyl(0.08, 0.08, 0.06, 12, "Y"), S.HEAD, loc=(0, -0.68, 1.08)),
        Part(coll, "basket", bm_box(0.32, 0.26, 0.2), PINK, loc=(0, -0.76, 0.92)).bevel(0.03, 1),
        Part(coll, "tail", bm_box(0.16, 0.04, 0.06), S.TAIL, loc=(0, 0.84, 0.56)),
    ]
    for s in (-1, 1):
        parts.append(Part(coll, "grip", bm_cyl(0.035, 0.035, 0.1, 8, "X"), PINK, loc=(s * 0.33, -0.66, 1.22)))
    bake(parts, "HeistMoped_body", coll, parent=root)
    for nm, y in (("Wheel_F", -0.62), ("Wheel_R", 0.6)):
        wheel(coll, root, nm, (0, y, 0.22), 0.22, 0.12, S.TIRE, S.CHROME, S.TIRE)
    anchor(coll, root, "Anchor_seat", (0, 0.32, 0.86))
    return coll


# ══════════════════════════════════ cop gear ═══════════════════════════════
def build_net():
    """The stun net: a dome of rope (rings + meridians), orange weights round the rim and a
    blue zap ring. ~2.8 m across; origin at the rim's centre (it lands ON a car)."""
    coll = scene_coll("HeistNet")
    root = root_empty(coll, "HeistNet")
    ROPE = mat("NetRope", "#EDE3C3", rough=0.85)
    WEIGHT = mat("NetWeight", "#FF6D00", rough=0.5)
    ZAP = mat("NeonZap", "#40C4FF", rough=0.3, emit=3.0)
    R, Hh = 1.45, 0.9
    parts = []
    for k in range(1, 5):
        t = k / 5.0
        r = R * math.sqrt(1 - t * t)
        parts.append(Part(coll, "ring", bm_torus(max(r, 0.08), 0.018, 24, 4), ROPE, loc=(0, 0, Hh * t)))
    parts.append(Part(coll, "rim", bm_torus(R, 0.03, 28, 5), ZAP, loc=(0, 0, 0.02)))
    for k in range(10):
        a = k * math.pi / 5
        # a meridian: a chain of short limbs from the rim up to the top
        prev = None
        for j in range(6):
            t = j / 5.0
            th = t * math.pi / 2
            p = (math.cos(a) * R * math.cos(th), math.sin(a) * R * math.cos(th), Hh * math.sin(th))
            if prev is not None:
                parts.append(limb(coll, "mer", prev, p, 0.016, ROPE))
            prev = p
        parts.append(Part(coll, "w", bm_sphere(0.08, 0.08, 0.08, 10, 6), WEIGHT, loc=(math.cos(a) * R, math.sin(a) * R, 0.02)))
    bake(parts, "HeistNet_body", coll, parent=root)
    return coll


def build_spikes():
    """A cartoon spike strip: hinged yellow-and-black boards with rubbery orange cone spikes
    and two end handles. 4.2 m long across the lane (X), origin on the road."""
    coll = scene_coll("HeistSpikes")
    root = root_empty(coll, "HeistSpikes")
    YEL = mat("StripYellow", "#FFD600", rough=0.5)
    BLK = mat("StripBlack", "#212121", rough=0.6)
    SPK = mat("StripSpike", "#FF6D00", rough=0.45)
    parts = []
    n = 12
    L = 4.2
    for i in range(n):
        x = -L / 2 + (i + 0.5) * L / n
        parts.append(Part(coll, "board", bm_box(L / n - 0.03, 0.34, 0.06), YEL if i % 2 == 0 else BLK, loc=(x, 0, 0.03), smooth=False))
        for sy in (-0.09, 0.09):
            parts.append(Part(coll, "spike", bm_cyl(0.045, 0.006, 0.12, 8), SPK, loc=(x + (0.06 if sy > 0 else -0.06), sy, 0.12)))
    for s in (-1, 1):
        parts.append(Part(coll, "handle", bm_torus(0.1, 0.02, 12, 4), BLK, loc=(s * (L / 2 + 0.1), 0, 0.03), rot=(0, 0, 0)))
    bake(parts, "HeistSpikes_body", coll, parent=root)
    return coll


# ═══════════════════════════════ the highway mini-mart ═════════════════════
def build_store():
    """KOSHER QUIK-MART: a flat-roofed little store with a striped awning, a glass front, an ice
    machine, a newspaper box and its own lit sign. Front = -Y; Anchor_door at the door."""
    coll = scene_coll("HeistStore")
    root = root_empty(coll, "HeistStore")
    S = shared()
    WALL = mat("Walls", "#F3E6C4", rough=0.85)
    TRIM = mat("Trim", "#5D4037", rough=0.7)
    AWN1 = mat("AwningRed", "#E53935", rough=0.7)
    AWN2 = mat("AwningWhite", "#FAFAFA", rough=0.7)
    GLASS = mat("GlassShop", "#9FD8FF", rough=0.05)
    SIGNB = mat("StoreSign", "#1A237E", rough=0.5)
    SIGNT = mat("NeonStore", "#FFEB3B", rough=0.3, emit=2.0)
    ICE = mat("IceBox", "#E3F2FD", rough=0.4)
    NEWS = mat("NewsBox", "#1565C0", rough=0.5)
    CONC = mat("Concrete", "#BDBDBD", rough=0.95)
    w, d, h = 13.0, 9.0, 4.4
    fy = -d / 2
    parts = [Part(coll, "slab", bm_box(w + 2, d + 4, 0.12), CONC, loc=(0, -1.5, 0.06), smooth=False),
             Part(coll, "body", bm_box(w, d, h), WALL, loc=(0, 0, h / 2), smooth=False),
             Part(coll, "cap", bm_box(w + 0.3, d + 0.3, 0.3), TRIM, loc=(0, 0, h + 0.15), smooth=False),
             Part(coll, "glass", bm_box(w - 4.0, 0.1, 2.3), GLASS, loc=(0.6, fy - 0.03, 1.4), smooth=False),
             Part(coll, "door", bm_box(1.3, 0.12, 2.4), GLASS, loc=(-4.5, fy - 0.05, 1.3), smooth=False),
             Part(coll, "doorframe", bm_box(1.5, 0.1, 2.6), TRIM, loc=(-4.5, fy - 0.0, 1.35), smooth=False),
             Part(coll, "sign", bm_box(w - 1.0, 0.25, 1.1), SIGNB, loc=(0, fy - 0.16, h - 0.65), smooth=False),
             txt(coll, "KOSHER QUIK-MART", 0.62, SIGNT, (0, fy - 0.3, h - 0.62), extrude=0.03),
             Part(coll, "ice", bm_box(1.5, 0.8, 1.4), ICE, loc=(5.2, fy - 0.5, 0.82), smooth=False).bevel(0.04, 1),
             txt(coll, "ICE", 0.3, mat("IceText", "#1565C0", rough=0.5), (5.2, fy - 0.92, 1.1), extrude=0.01),
             Part(coll, "news", bm_box(0.5, 0.45, 1.0), NEWS, loc=(-6.0, fy - 0.6, 0.62), smooth=False).bevel(0.03, 1)]
    # the striped awning over the window
    n = 10
    for i in range(n):
        x = -2.4 + 0.6 + (i + 0.5) * (w - 4.0) / n
        parts.append(Part(coll, "awn", bm_box((w - 4.0) / n, 1.2, 0.08), AWN1 if i % 2 == 0 else AWN2,
                          loc=(x, fy - 0.6, 2.85), rot=(-0.35, 0, 0), smooth=False))
    bake(parts, "HeistStore_body", coll, parent=root)
    anchor(coll, root, "Anchor_door", (-4.5, fy - 1.0, 0))
    return coll


ASSETS = [
    ("heist_bank", build_bank),
    ("heist_bankint", build_bank_interior),
    ("heist_props", build_props),
    ("heist_robber", build_robber),
    ("heist_guard", build_guard),
    ("heist_teller", build_teller),
    ("heist_getaway", build_getaway),
    ("heist_moped", build_moped),
    ("heist_net", build_net),
    ("heist_spikes", build_spikes),
    ("heist_store", build_store),
]
