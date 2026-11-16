"""
Street-mayhem assets (feature id: streets).

  streets_sports      a low two-door sports coupe for traffic (twitchy + fast when carjacked);
                      "Paint" is recoloured per car, Wheel_* spin, Headlight / Taillight glow
  streets_paint       PAINT & PRAY — a drive-through spray booth. The car drives through along
                      the model's length (front = -Y = +Z in three.js); the roadside wall (+X)
                      carries the neon sign. "Door_In" (rear, +Y) and "Door_Out" (front, -Y) are
                      roll-up doors with their origin at the top of the opening (scale Y to roll
                      them down); "Anchor_ventA/B" are the roof vents the colour puffs leave from;
                      the halo over the spray-can mascot is Neon (emissive, animatable)
  streets_owner       Moishe, who runs it (a person: Body / Arm_* / Leg_*)
  streets_barrier     a police sawhorse barricade with an amber blinker (NeonAmber)
  streets_spikes      a spike strip, 3.6 m across a lane (long axis = X)
  streets_hydrant     smashable street props (each faces -Y = +Z, origin on the ground):
  streets_mailbox       hydrant, blue mailbox, fruit stand (+ striped awning), trash can,
  streets_fruitstand    newspaper box, a 3 m white picket fence segment, a phone booth
  streets_trashcan
  streets_newsbox
  streets_fence
  streets_phonebooth
"""
from lib import *
from lib_people import build_person


def setup():
    global S
    S = shared()


# ── the sports coupe ─────────────────────────────────────────────────────
def build_sports():
    coll = scene_coll("Sports")
    root = root_empty(coll, "Sports")
    PAINT = mat("Paint", "#E53935", rough=0.28, metal=0.15)
    STRIPE = mat("SportStripe", "#FAFAFA", rough=0.35)
    parts = [
        Part(coll, "body", bm_box(1.86, 4.3, 0.5), PAINT, loc=(0, 0, 0.56)).bevel(0.16, 3),
        Part(coll, "nose", bm_prism([(-2.15, 0.36), (-1.35, 0.36), (-1.35, 0.82), (-2.15, 0.62)], 0.9), PAINT, loc=(0, 0, 0)).bevel(0.08, 2),
        Part(coll, "cabin", bm_box(1.5, 1.75, 0.46), S.TINT, loc=(0, 0.35, 0.98)).bevel(0.2, 3),
        Part(coll, "roof", bm_box(1.38, 1.2, 0.06), PAINT, loc=(0, 0.45, 1.2)).bevel(0.03, 2),
        Part(coll, "spoilerL", bm_box(0.08, 0.12, 0.26), S.DARK, loc=(0.62, 2.0, 0.9)),
        Part(coll, "spoilerR", bm_box(0.08, 0.12, 0.26), S.DARK, loc=(-0.62, 2.0, 0.9)),
        Part(coll, "wing", bm_box(1.7, 0.36, 0.06), PAINT, loc=(0, 2.04, 1.05)).bevel(0.02, 2),
        Part(coll, "splitter", bm_box(1.8, 0.24, 0.06), S.DARK, loc=(0, -2.12, 0.33)),
        Part(coll, "diffuser", bm_box(1.6, 0.2, 0.16), S.DARK, loc=(0, 2.15, 0.4)),
        Part(coll, "stripe", bm_box(0.36, 4.32, 0.02), STRIPE, loc=(0, 0, 0.815)),
        Part(coll, "stripeRoof", bm_box(0.36, 1.2, 0.02), STRIPE, loc=(0, 0.45, 1.235)),
    ]
    for s in (-1, 1):
        parts.append(Part(coll, "head", bm_box(0.42, 0.08, 0.1), S.HEAD, loc=(s * 0.58, -2.13, 0.66)).bevel(0.03, 2))
        parts.append(Part(coll, "tail", bm_box(0.5, 0.06, 0.09), S.TAIL, loc=(s * 0.55, 2.16, 0.7)).bevel(0.03, 2))
        parts.append(Part(coll, "exhaust", bm_cyl(0.06, 0.06, 0.14, 10, "Y"), S.CHROME, loc=(s * 0.35, 2.2, 0.36)))
        parts.append(Part(coll, "scoop", bm_box(0.06, 0.6, 0.16), S.DARK, loc=(s * 0.93, 0.85, 0.62)))
    bake(parts, "Sports_body", coll, parent=root)
    four_wheels(coll, root, 0.82, -1.38, 1.38, 0.34, 0.28, S.TIRE, S.CHROME, S.TIRE)
    return coll


# ── PAINT & PRAY ─────────────────────────────────────────────────────────
L_B, W_B, H_W = 16.0, 6.6, 4.4       # booth length (Y), width (X), wall height
OPEN_W, OPEN_H = 4.2, 3.3            # door openings


def build_paint():
    coll = scene_coll("PaintPray")
    root = root_empty(coll, "PaintPray")
    WALLS = mat("Walls", "#7E57C2", rough=0.7)
    TRIM = mat("PaintTrim", "#FFD54F", rough=0.5)
    ROOF = mat("PaintRoof", "#4A3A6B", rough=0.8)
    FLOOR = mat("PaintFloor", "#5D6670", rough=0.9)
    INNER = mat("PaintInner", "#2E2A3A", rough=0.9)
    DOOR = mat("PaintDoor", "#B0BEC5", rough=0.45, metal=0.35)
    DOOR_D = mat("PaintDoorRib", "#78909C", rough=0.5, metal=0.35)
    CAN = mat("CanBody", "#EC407A", rough=0.3, metal=0.4)
    CAN_TOP = mat("CanTop", "#ECEFF1", rough=0.25, metal=0.7)
    NOZ = mat("CanNozzle", "#FFFFFF", rough=0.4)
    HALO = mat("NeonHalo", "#FFE082", rough=0.3, emit=4.0)
    SIGN_BG = mat("PaintSignBg", "#1B1033", rough=0.6)
    SIGN_TXT = mat("NeonSign", "#FF4FA3", rough=0.3, emit=3.5)
    SIGN_TXT2 = mat("NeonSign2", "#4DD0E1", rough=0.3, emit=3.0)
    STRIP = mat("NeonInside", "#E1F5FE", rough=0.3, emit=2.0)
    SPLATS = [mat("SplatPink", "#FF4FA3", rough=0.4), mat("SplatCyan", "#26C6DA", rough=0.4),
              mat("SplatYellow", "#FFCA28", rough=0.4), mat("SplatGreen", "#9CCC65", rough=0.4)]
    hx, hy = W_B / 2, L_B / 2
    t = 0.25
    parts = [
        Part(coll, "floor", bm_box(W_B, L_B + 1.6, 0.08), FLOOR, loc=(0, 0, 0.04)),
        # long walls (+X faces the road)
        Part(coll, "wallRoad", bm_box(t, L_B, H_W), WALLS, loc=(hx - t / 2, 0, H_W / 2)),
        Part(coll, "wallBack", bm_box(t, L_B, H_W), WALLS, loc=(-hx + t / 2, 0, H_W / 2)),
        Part(coll, "innerRoad", bm_box(0.02, L_B - 0.6, H_W - 0.4), INNER, loc=(hx - t - 0.01, 0, H_W / 2)),
        Part(coll, "innerBack", bm_box(0.02, L_B - 0.6, H_W - 0.4), INNER, loc=(-hx + t + 0.01, 0, H_W / 2)),
        Part(coll, "ceiling", bm_box(W_B - 0.4, L_B - 0.4, 0.04), INNER, loc=(0, 0, H_W - 0.22)),
        Part(coll, "roof", bm_box(W_B + 0.5, L_B + 0.5, 0.3), ROOF, loc=(0, 0, H_W + 0.15)).bevel(0.06, 2),
        Part(coll, "base", bm_box(W_B + 0.2, L_B + 0.2, 0.32), TRIM, loc=(0, 0, 0.16)),
    ]
    # a yellow rim round the roof (not a slab), so the purple roof + mascot read from the road
    for sx in (-1, 1):
        parts.append(Part(coll, "rimL", bm_box(0.22, L_B + 0.7, 0.32), TRIM, loc=(sx * (W_B / 2 + 0.24), 0, H_W + 0.42)).bevel(0.04, 2))
    for sy in (-1, 1):
        parts.append(Part(coll, "rimE", bm_box(W_B + 0.7, 0.22, 0.32), TRIM, loc=(0, sy * (L_B / 2 + 0.24), H_W + 0.42)).bevel(0.04, 2))
    # windows on the roadside wall (they glow a little: the booth lights are on)
    WIN = mat("NeonWindow", "#B3E5FC", rough=0.2, emit=0.6)
    for wy in (-5.0, 5.0):
        parts.append(Part(coll, "winFrame", bm_box(0.12, 2.0, 1.3), TRIM, loc=(hx + 0.02, wy, 1.9)).bevel(0.03, 2))
        parts.append(Part(coll, "win", bm_box(0.14, 1.7, 1.0), WIN, loc=(hx + 0.03, wy, 1.9)))
        parts.append(Part(coll, "winBar", bm_box(0.16, 0.06, 1.0), TRIM, loc=(hx + 0.04, wy, 1.9)))

    # end walls with the door openings (left / right jambs + lintel), both ends
    jamb = (W_B - OPEN_W) / 2
    for ey in (-hy + t / 2, hy - t / 2):
        for sx in (-1, 1):
            parts.append(Part(coll, "jamb", bm_box(jamb, t, H_W), WALLS, loc=(sx * (OPEN_W / 2 + jamb / 2), ey, H_W / 2)))
        parts.append(Part(coll, "lintel", bm_box(OPEN_W, t, H_W - OPEN_H), WALLS, loc=(0, ey, OPEN_H + (H_W - OPEN_H) / 2)))
        # the door frame in trim yellow + the roll housing
        for sx in (-1, 1):
            parts.append(Part(coll, "frame", bm_box(0.18, t + 0.12, OPEN_H), TRIM, loc=(sx * (OPEN_W / 2 + 0.09), ey, OPEN_H / 2)))
        parts.append(Part(coll, "housing", bm_cyl(0.32, 0.32, OPEN_W + 0.3, 14, "X"), DOOR_D, loc=(0, ey + (0.25 if ey < 0 else -0.25), OPEN_H + 0.3)))
        # hazard stripes on the threshold
        for k in range(6):
            parts.append(Part(coll, "haz", bm_box(0.34, 0.5, 0.012), TRIM if k % 2 == 0 else S.BLACK,
                              loc=(-OPEN_W / 2 + 0.35 + k * 0.7, ey + (-0.6 if ey < 0 else 0.6), 0.09)))
    # interior: light strips and spray nozzles on the long walls
    for sx in (-1, 1):
        parts.append(Part(coll, "strip", bm_box(0.06, L_B - 1.4, 0.08), STRIP, loc=(sx * (hx - t - 0.05), 0, H_W - 0.5)))
        for k in range(4):
            y = -4.5 + k * 3.0
            parts.append(Part(coll, "nozArm", bm_box(0.4, 0.08, 0.08), S.CHROME, loc=(sx * (hx - t - 0.2), y, 2.2)))
            parts.append(Part(coll, "nozHead", bm_cyl(0.07, 0.04, 0.16, 8, "X"), S.DARK, loc=(sx * (hx - t - 0.45), y, 2.2)))
    # paint splats dripping down the outside walls
    import random
    rnd = random.Random(7)
    for i in range(16):
        side = 1 if i % 2 == 0 else -1
        y = rnd.uniform(-hy + 1.2, hy - 1.2)
        z = rnd.uniform(0.8, H_W - 0.6) if side < 0 else rnd.uniform(2.75, 3.15)   # road side: a drippy band between the windows and the sign
        m = SPLATS[i % 4]
        r = rnd.uniform(0.18, 0.4)
        parts.append(Part(coll, "splat", bm_sphere(0.04, r, r * 0.9, 10, 6), m, loc=(side * (hx + 0.005), y, z)))
        parts.append(Part(coll, "drip", bm_box(0.05, 0.08, r * 1.6), m, loc=(side * (hx + 0.01), y + rnd.uniform(-0.1, 0.1), z - r * 1.2)).bevel(0.02, 2))
    bake(parts, "PaintBooth", coll, parent=root)

    # the roadside neon sign (+X wall)
    sign = [
        Part(coll, "board", bm_box(0.16, 9.0, 1.5), SIGN_BG, loc=(hx + 0.12, 0, H_W - 0.2)).bevel(0.06, 2),
        Part(coll, "boardTrim", bm_box(0.1, 9.2, 1.7), TRIM, loc=(hx + 0.06, 0, H_W - 0.2)).bevel(0.05, 2),
        Part(coll, "txt", bm_text("PAINT & PRAY", 0.82, 0.03), SIGN_TXT, loc=(hx + 0.21, 0, H_W - 0.07), rot=(math.pi / 2, 0, math.pi / 2), smooth=False),
        Part(coll, "txt2", bm_text("NEW COLOR · NO QUESTIONS", 0.3, 0.02), SIGN_TXT2, loc=(hx + 0.21, 0, H_W - 0.72), rot=(math.pi / 2, 0, math.pi / 2), smooth=False),
    ]
    bake(sign, "PaintSign", coll, parent=root)

    # the mascot: a giant spray can on the roof with a golden halo
    cz = H_W + 0.3
    can = [
        Part(coll, "can", bm_cyl(0.75, 0.75, 2.6, 20), CAN, loc=(0, 3.0, cz + 1.3)),
        Part(coll, "shoulder", bm_cyl(0.75, 0.45, 0.4, 20), CAN_TOP, loc=(0, 3.0, cz + 2.8)),
        Part(coll, "cap", bm_cyl(0.32, 0.32, 0.3, 16), NOZ, loc=(0, 3.0, cz + 3.15)),
        Part(coll, "nozzle", bm_box(0.18, 0.3, 0.14), S.DARK, loc=(0.2, 2.8, cz + 3.3)),
        Part(coll, "label", bm_cyl(0.77, 0.77, 0.9, 20), SPLATS[1], loc=(0, 3.0, cz + 1.2)),
        Part(coll, "rim", bm_cyl(0.8, 0.8, 0.12, 20), CAN_TOP, loc=(0, 3.0, cz + 0.06)),
    ]
    bake(can, "Mascot", coll, parent=root)
    bake([Part(coll, "halo", bm_torus(0.62, 0.07, 24, 8), HALO, loc=(0, 3.0, cz + 4.0))], "Halo", coll, parent=root)
    # a little spray cloud puffing from the nozzle (static sculpture)
    puff = [Part(coll, "p%d" % k, bm_ico(0.22 + k * 0.08, 1), SPLATS[k % 4], loc=(0.45 + k * 0.32, 2.55 - k * 0.12, cz + 3.35 + k * 0.1), smooth=False) for k in range(4)]
    bake(puff, "MascotPuff", coll, parent=root)

    # roll-up doors (origin at the top of the opening → scale Y in three.js to roll them up / down)
    for nm, ey in (("Door_Out", -hy + 0.02), ("Door_In", hy - 0.02)):
        top = (0, ey, OPEN_H)
        d = [Part(coll, nm + "_p", bm_box(OPEN_W - 0.04, 0.08, OPEN_H), DOOR, loc=(0, ey, OPEN_H / 2))]
        for k in range(9):
            d.append(Part(coll, nm + "_r", bm_box(OPEN_W - 0.02, 0.12, 0.05), DOOR_D, loc=(0, ey, 0.2 + k * 0.36)))
        d.append(Part(coll, nm + "_h", bm_box(0.5, 0.14, 0.08), S.CHROME, loc=(0, ey, 0.5)))
        bake_at(d, nm, coll, root, top)

    # the drive-thru arrow sign at the entrance
    arrow = [
        Part(coll, "post", bm_cyl(0.06, 0.06, 2.4, 8), S.CHROME, loc=(hx + 1.3, hy + 2.0, 1.2)),
        Part(coll, "plate", bm_box(0.08, 1.9, 0.7), SIGN_BG, loc=(hx + 1.3, hy + 2.0, 2.3)).bevel(0.03, 2),
        Part(coll, "txt", bm_text("DRIVE THRU", 0.26, 0.02), SIGN_TXT2, loc=(hx + 1.36, hy + 2.0, 2.4), rot=(math.pi / 2, 0, math.pi / 2), smooth=False),
        Part(coll, "arr", bm_prism([(-0.3, -0.12), (0.1, -0.12), (0.1, -0.24), (0.45, 0.0), (0.1, 0.24), (0.1, 0.12), (-0.3, 0.12)], 0.02), SIGN_TXT,
             loc=(hx + 1.36, hy + 2.0, 2.12), rot=(0, 0, 0)),
    ]
    bake(arrow, "DriveThru", coll, parent=root)
    anchor(coll, root, "Anchor_ventA", (0, -3.5, H_W + 0.6))
    anchor(coll, root, "Anchor_ventB", (0, 0.5, H_W + 0.6))
    # little roof vents
    vents = []
    for vy in (-3.5, 0.5):
        vents.append(Part(coll, "vent", bm_cyl(0.35, 0.35, 0.5, 12), DOOR_D, loc=(0, vy, H_W + 0.55)))
        vents.append(Part(coll, "ventCap", bm_cyl(0.5, 0.5, 0.06, 12), S.CHROME, loc=(0, vy, H_W + 0.95)))
    bake(vents, "Vents", coll, parent=root)
    return coll


def build_owner():
    return build_person("Moishe", dict(hair="short", hair_color="#3E2723", top="#1565C0", sleeves="short", bottom="pants",
                                       bottom_color="#0D47A1", shoes="#4E342E", width=1.12,
                                       extras=["cap", "mustache", "belly", "apron"],
                                       extra_colors={"Hat": "#FF4FA3", "HatBand": "#FFD54F", "Apron": "#ECEFF1", "Beard": "#3E2723"}))


# ── roadblock pieces ─────────────────────────────────────────────────────
def build_barrier():
    coll = scene_coll("Barrier")
    root = root_empty(coll, "Barrier")
    WOOD = mat("BarrierLeg", "#ECEFF1", rough=0.6)
    RED = mat("BarrierRed", "#E53935", rough=0.5)
    WHITE = mat("BarrierWhite", "#FAFAFA", rough=0.5)
    AMBER = mat("NeonAmber", "#FFB300", rough=0.3, emit=3.0)
    TXT = mat("BarrierText", "#1A237E", rough=0.5)
    W = 2.6
    parts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(limb(coll, "leg", (sx * (W / 2 - 0.15), sy * 0.35, 0.0), (sx * (W / 2 - 0.15), 0, 1.05), 0.045, WOOD))
    # striped board: alternating red / white blocks
    n = 8
    for k in range(n):
        x = -W / 2 + W / n * (k + 0.5)
        parts.append(Part(coll, "s", bm_box(W / n, 0.07, 0.3), RED if k % 2 == 0 else WHITE, loc=(x, -0.02, 0.92)))
        parts.append(Part(coll, "s2", bm_box(W / n, 0.07, 0.22), WHITE if k % 2 == 0 else RED, loc=(x, -0.02, 0.48)))
    parts.append(Part(coll, "plate", bm_box(0.9, 0.03, 0.2), WHITE, loc=(0, -0.07, 0.7)))
    parts.append(Part(coll, "txt", bm_text("POLICE", 0.15, 0.01), TXT, loc=(0, -0.09, 0.7), rot=(math.pi / 2, 0, 0), smooth=False))
    bake(parts, "Barrier_body", coll, parent=root)
    bake([Part(coll, "lamp", bm_cyl(0.09, 0.08, 0.14, 12), AMBER, loc=(W / 2 - 0.25, -0.02, 1.15))], "Blinker", coll, parent=root)
    return coll


def build_spikes():
    coll = scene_coll("Spikes")
    root = root_empty(coll, "Spikes")
    BAR = mat("SpikeBar", "#263238", rough=0.6, metal=0.3)
    HINGE = mat("SpikeHinge", "#FFC107", rough=0.5)
    SPIKE = mat("SpikeSteel", "#CFD8DC", rough=0.25, metal=0.85)
    W = 3.6
    parts = []
    seg = 6
    for k in range(seg):
        x = -W / 2 + W / seg * (k + 0.5)
        parts.append(Part(coll, "seg", bm_box(W / seg - 0.06, 0.32, 0.07), BAR, loc=(x, 0, 0.035)).bevel(0.015, 1))
        if k:
            parts.append(Part(coll, "hinge", bm_cyl(0.04, 0.04, 0.34, 8, "Y"), HINGE, loc=(-W / 2 + W / seg * k, 0, 0.06)))
        for j in range(4):
            for row in (-0.08, 0.08):
                parts.append(Part(coll, "sp", bm_cyl(0.025, 0.0, 0.13, 6), SPIKE, loc=(x - 0.22 + j * 0.15, row, 0.13), rot=(row * 2.2, 0, 0)))
    parts.append(Part(coll, "end", bm_box(0.12, 0.4, 0.12), HINGE, loc=(W / 2 + 0.05, 0, 0.06)).bevel(0.03, 2))
    parts.append(Part(coll, "end2", bm_box(0.12, 0.4, 0.12), HINGE, loc=(-W / 2 - 0.05, 0, 0.06)).bevel(0.03, 2))
    bake(parts, "Spikes_body", coll, parent=root)
    return coll


# ── smashable street props ───────────────────────────────────────────────
def build_hydrant():
    coll = scene_coll("Hydrant")
    root = root_empty(coll, "Hydrant")
    RED = mat("HydrantRed", "#E53935", rough=0.45, metal=0.2)
    CAP = mat("HydrantCap", "#FFD54F", rough=0.45, metal=0.3)
    parts = [
        Part(coll, "base", bm_cyl(0.24, 0.26, 0.1, 14), RED, loc=(0, 0, 0.05)),
        Part(coll, "barrel", bm_cyl(0.17, 0.19, 0.62, 14), RED, loc=(0, 0, 0.41)),
        Part(coll, "collar", bm_cyl(0.22, 0.22, 0.07, 14), CAP, loc=(0, 0, 0.73)),
        Part(coll, "dome", bm_sphere(0.18, 0.18, 0.14, 14, 8), RED, loc=(0, 0, 0.78)),
        Part(coll, "nut", bm_cyl(0.05, 0.06, 0.1, 6), CAP, loc=(0, 0, 0.94)),
        Part(coll, "portF", bm_cyl(0.085, 0.085, 0.16, 10, "Y"), CAP, loc=(0, -0.2, 0.48)),
    ]
    for s in (-1, 1):
        parts.append(Part(coll, "port", bm_cyl(0.065, 0.065, 0.14, 10, "X"), CAP, loc=(s * 0.21, 0, 0.52)))
    bake(parts, "Hydrant_body", coll, parent=root)
    return coll


def build_mailbox():
    coll = scene_coll("Mailbox")
    root = root_empty(coll, "Mailbox")
    BLUE = mat("MailBlue", "#1E5AA8", rough=0.45, metal=0.2)
    LEG = mat("MailLeg", "#1A237E", rough=0.5)
    WHITE = mat("MailWhite", "#FAFAFA", rough=0.5)
    body = Part(coll, "box", bm_box(0.56, 0.5, 0.78), BLUE, loc=(0, 0, 0.82)).bevel(0.04, 2)
    top = Part(coll, "top", bm_cyl(0.28, 0.28, 0.5, 16, "Y"), BLUE, loc=(0, 0, 1.21))
    parts = [body, top,
             Part(coll, "slot", bm_box(0.36, 0.04, 0.06), S.DARK, loc=(0, -0.27, 1.12)),
             Part(coll, "chute", bm_box(0.4, 0.12, 0.18), BLUE, loc=(0, -0.3, 1.1)).bevel(0.03, 2),
             Part(coll, "label", bm_box(0.3, 0.02, 0.16), WHITE, loc=(0, -0.26, 0.78)),
             Part(coll, "txt", bm_text("MAIL", 0.1, 0.008), BLUE, loc=(0, -0.275, 0.78), rot=(math.pi / 2, 0, 0), smooth=False)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(Part(coll, "leg", bm_box(0.06, 0.06, 0.44), LEG, loc=(sx * 0.22, sy * 0.19, 0.22)))
    bake(parts, "Mailbox_body", coll, parent=root)
    return coll


def build_fruitstand():
    coll = scene_coll("FruitStand")
    root = root_empty(coll, "FruitStand")
    WOOD = mat("StandWood", "#A1887F", rough=0.8)
    WOOD_D = mat("StandWoodDark", "#6D4C41", rough=0.8)
    AW1 = mat("AwningRed", "#E53935", rough=0.6)
    AW2 = mat("AwningWhite", "#FAFAFA", rough=0.6)
    FRUIT = [mat("FruitOrange", "#FB8C00", rough=0.5), mat("FruitApple", "#D32F2F", rough=0.4),
             mat("FruitLemon", "#FDD835", rough=0.5), mat("FruitLime", "#7CB342", rough=0.5), mat("FruitGrape", "#7B1FA2", rough=0.4)]
    W, D = 2.2, 1.0
    parts = [
        Part(coll, "table", bm_box(W, D, 0.08), WOOD, loc=(0, 0, 0.82)),
        Part(coll, "skirt", bm_box(W, 0.05, 0.6), WOOD_D, loc=(0, -D / 2, 0.5)),
    ]
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(Part(coll, "leg", bm_box(0.08, 0.08, 0.82), WOOD_D, loc=(sx * (W / 2 - 0.08), sy * (D / 2 - 0.08), 0.41)))
        parts.append(Part(coll, "pole", bm_box(0.07, 0.07, 1.4), WOOD_D, loc=(sx * (W / 2 - 0.06), D / 2 - 0.06, 1.55)))
    # crates on the table, heaped with fruit
    import random
    rnd = random.Random(3)
    for k in range(3):
        x = -0.72 + k * 0.72
        parts.append(Part(coll, "crate", bm_box(0.62, 0.7, 0.18), WOOD, loc=(x, -0.05, 0.95)).bevel(0.01, 1))
        fm = FRUIT[k % len(FRUIT)]
        for j in range(7):
            parts.append(Part(coll, "f", bm_ico(0.085, 1), fm, loc=(x + rnd.uniform(-0.22, 0.22), -0.05 + rnd.uniform(-0.25, 0.25), 1.07 + rnd.uniform(0, 0.09)), smooth=True))
    # the sign + a basket of grapes on the front
    parts.append(Part(coll, "sign", bm_box(1.1, 0.04, 0.26), AW2, loc=(0, -D / 2 - 0.04, 0.6)))
    parts.append(Part(coll, "signTxt", bm_text("FRESH!", 0.16, 0.01), AW1, loc=(0, -D / 2 - 0.065, 0.6), rot=(math.pi / 2, 0, 0), smooth=False))
    bake(parts, "Stand_body", coll, parent=root)
    # striped awning, sloping toward the street (front = -Y)
    aw = []
    n = 6
    for k in range(n):
        x = -W / 2 - 0.1 + (W + 0.2) / n * (k + 0.5)
        aw.append(Part(coll, "aw", bm_box((W + 0.2) / n, 1.3, 0.04), AW1 if k % 2 == 0 else AW2, loc=(x, -0.05, 2.12), rot=(0.32, 0, 0)))
        aw.append(Part(coll, "flap", bm_box((W + 0.2) / n, 0.04, 0.2), AW2 if k % 2 == 0 else AW1, loc=(x, -0.68, 1.84)))
    bake(aw, "Awning", coll, parent=root)
    return coll


def build_trashcan():
    coll = scene_coll("TrashCan")
    root = root_empty(coll, "TrashCan")
    MET = mat("CanMetal", "#90A4AE", rough=0.4, metal=0.6)
    LID = mat("CanLid", "#78909C", rough=0.4, metal=0.6)
    parts = [Part(coll, "can", bm_cyl(0.3, 0.34, 0.86, 16), MET, loc=(0, 0, 0.43))]
    for z in (0.18, 0.45, 0.72):
        parts.append(Part(coll, "rib", bm_cyl(0.33 - z * 0.04 + 0.02, 0.33 - z * 0.04 + 0.02, 0.04, 16), LID, loc=(0, 0, z)))
    parts.append(Part(coll, "lid", bm_cyl(0.37, 0.36, 0.08, 16), LID, loc=(0, 0, 0.9)))
    parts.append(Part(coll, "handle", bm_box(0.18, 0.05, 0.06), S.DARK, loc=(0, 0, 0.97)))
    parts.append(Part(coll, "junk", bm_ico(0.12, 1), mat("Junk", "#A5D6A7", rough=0.7), loc=(0.1, 0.05, 0.96), smooth=False))
    bake(parts, "TrashCan_body", coll, parent=root)
    return coll


def build_newsbox():
    coll = scene_coll("NewsBox")
    root = root_empty(coll, "NewsBox")
    BOX = mat("NewsRed", "#C62828", rough=0.45, metal=0.2)
    WIN = mat("Glass", "#9FD8FF", rough=0.05)
    PAPER = mat("NewsPaper", "#ECEFF1", rough=0.8)
    TXT = mat("NewsText", "#FFFFFF", rough=0.5)
    parts = [
        Part(coll, "box", bm_box(0.5, 0.42, 0.85), BOX, loc=(0, 0, 0.62)).bevel(0.03, 2),
        Part(coll, "paper", bm_box(0.34, 0.02, 0.3), PAPER, loc=(0, -0.2, 0.72)),
        Part(coll, "head", bm_box(0.36, 0.02, 0.05), S.DARK, loc=(0, -0.205, 0.83)),
        Part(coll, "win", bm_box(0.38, 0.02, 0.36), WIN, loc=(0, -0.222, 0.72)),
        Part(coll, "coin", bm_box(0.1, 0.06, 0.14), S.CHROME, loc=(0.16, -0.22, 0.98)),
        Part(coll, "top", bm_box(0.54, 0.46, 0.06), S.DARK, loc=(0, 0, 1.07)),
        Part(coll, "txt", bm_text("DAILY", 0.08, 0.008), TXT, loc=(-0.05, -0.215, 0.98), rot=(math.pi / 2, 0, 0), smooth=False),
        Part(coll, "ped", bm_box(0.3, 0.3, 0.2), S.DARK, loc=(0, 0, 0.1)),
    ]
    bake(parts, "NewsBox_body", coll, parent=root)
    return coll


def build_fence():
    coll = scene_coll("Fence")
    root = root_empty(coll, "Fence")
    WHITE = mat("Picket", "#FAFAFA", rough=0.6)
    W = 3.0
    parts = []
    for z in (0.32, 0.78):
        parts.append(Part(coll, "rail", bm_box(W, 0.05, 0.08), WHITE, loc=(0, 0.04, z)))
    n = 9
    for k in range(n):
        x = -W / 2 + W / n * (k + 0.5)
        parts.append(Part(coll, "picket", bm_box(0.13, 0.04, 0.95), WHITE, loc=(x, 0, 0.475)))
        parts.append(Part(coll, "tip", bm_prism([(-0.02, 0.0), (0.02, 0.0), (0.0, 0.12)], 0.065), WHITE, loc=(x, 0, 0.95)))
    bake(parts, "Fence_body", coll, parent=root)
    return coll


def build_phonebooth():
    coll = scene_coll("PhoneBooth")
    root = root_empty(coll, "PhoneBooth")
    FRAME = mat("BoothRed", "#C62828", rough=0.4, metal=0.2)
    GLASS = mat("Glass", "#9FD8FF", rough=0.05)
    SIGN = mat("NeonPhone", "#FFFDE7", rough=0.3, emit=2.0)
    TXT = mat("BoothText", "#C62828", rough=0.5)
    PHONE = mat("PhoneBody", "#263238", rough=0.4)
    W, D, H = 0.95, 0.95, 2.3
    parts = [Part(coll, "base", bm_box(W + 0.1, D + 0.1, 0.12), FRAME, loc=(0, 0, 0.06)),
             Part(coll, "roof", bm_box(W + 0.12, D + 0.12, 0.14), FRAME, loc=(0, 0, H + 0.07)).bevel(0.03, 2),
             Part(coll, "dome", bm_cyl(0.48, 0.3, 0.12, 4), FRAME, loc=(0, 0, H + 0.2), rot=(0, 0, math.pi / 4))]
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(Part(coll, "post", bm_box(0.08, 0.08, H), FRAME, loc=(sx * W / 2, sy * D / 2, H / 2)))
    # glass on three sides, the back has the phone
    parts.append(Part(coll, "gF", bm_box(W - 0.08, 0.02, H - 0.5), GLASS, loc=(0, -D / 2, H / 2 + 0.05)))
    for sx in (-1, 1):
        parts.append(Part(coll, "gS", bm_box(0.02, D - 0.08, H - 0.5), GLASS, loc=(sx * W / 2, 0, H / 2 + 0.05)))
    parts.append(Part(coll, "back", bm_box(W - 0.08, 0.04, H - 0.3), FRAME, loc=(0, D / 2, H / 2)))
    parts.append(Part(coll, "phone", bm_box(0.26, 0.1, 0.4), PHONE, loc=(0, D / 2 - 0.08, 1.35)).bevel(0.03, 2))
    parts.append(Part(coll, "rcv", bm_box(0.06, 0.06, 0.26), PHONE, loc=(0.16, D / 2 - 0.14, 1.4)))
    for sy in (-1, 1):
        parts.append(Part(coll, "sign", bm_box(W - 0.1, 0.03, 0.18), SIGN, loc=(0, sy * (D / 2 + 0.05), H - 0.08)))
    parts.append(Part(coll, "txt", bm_text("PHONE", 0.12, 0.01), TXT, loc=(0, -D / 2 - 0.07, H - 0.08), rot=(math.pi / 2, 0, 0), smooth=False))
    bake(parts, "PhoneBooth_body", coll, parent=root)
    return coll


ASSETS = [
    ("streets_sports", build_sports),
    ("streets_paint", build_paint),
    ("streets_owner", build_owner),
    ("streets_barrier", build_barrier),
    ("streets_spikes", build_spikes),
    ("streets_hydrant", build_hydrant),
    ("streets_mailbox", build_mailbox),
    ("streets_fruitstand", build_fruitstand),
    ("streets_trashcan", build_trashcan),
    ("streets_newsbox", build_newsbox),
    ("streets_fence", build_fence),
    ("streets_phonebooth", build_phonebooth),
]
