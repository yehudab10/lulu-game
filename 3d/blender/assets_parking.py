"""
Parking minigame assets (feature id: parking).

The roadside lot and the Parking Challenge street are assembled at runtime
(js/features/parking/lot.js); these are the props that go in it:

  parking_camera    security camera on a pole: "CamHead" pivots (yaw + pitch) to
                    track Lulu, "Led"/"RecDot" blink (LightRed* = emissive)
  parking_cone      traffic cone (knocked flying when you clip it)
  parking_lamp      street lamp (the "LampGlow" bulb lights up at dusk / night)
  parking_hydrant   fire hydrant
  parking_mailbox   blue USPS mailbox
  parking_meter     parking meter (EXP)
  parking_signpost  blue P sign on a post; "Anchor_sign" is where the game puts
                    the lot's name plate (LOT A / VISITOR / 2 HR MAX ...)
  parking_bollard   yellow bollard (instanced along the street ends)
  parking_planter   concrete planter box with a shrub
  parking_bldg_a/b  city buildings for the far side of the sidewalk; "Walls" and
                    "Awning" are recoloured per lot, "Window" glows at night
  parking_icecream  an ice-cream cone (the kids' reward: "YAY ICE CREAM!")
  parking_angryman  the grumpy grandpa whose car you dinged ("WHO TAUGHT YOU TO DRIVE!?")
  parking_sasquatch the Boss Level watcher (level 10)
"""
from lib import *
from lib_people import build_person


def setup():
    global S
    S = shared()


# ── security camera ──────────────────────────────────────────────────────
def build_camera():
    coll = scene_coll("ParkingCam")
    root = root_empty(coll, "ParkingCam")
    POLE = mat("CamPole", "#37474F", rough=0.6, metal=0.4)
    POLE_D = mat("CamPoleDark", "#263238", rough=0.7, metal=0.3)
    BODY = mat("CamBody", "#2B3238", rough=0.45, metal=0.2)
    BODY_L = mat("CamBodyLight", "#455A64", rough=0.5, metal=0.2)
    LENS = mat("CamLens", "#0A0A0A", rough=0.1)
    LENS_IN = mat("CamLensBlue", "#1976D2", rough=0.08, metal=0.3)
    BADGE = mat("RecBadge", "#111111", rough=0.6)
    TXT = mat("RecText", "#FFFFFF", rough=0.5)
    LED = mat("LightRedLed", "#F44336", rough=0.3, emit=3.0)
    DOT = mat("LightRedRec", "#F44336", rough=0.3, emit=3.0)
    H = 3.1
    pole = [
        Part(coll, "base", bm_cyl(0.32, 0.36, 0.12, 16), POLE_D, loc=(0, 0, 0.06)),
        Part(coll, "pole", bm_cyl(0.07, 0.08, H, 12), POLE, loc=(0, 0, H / 2)),
        Part(coll, "collar", bm_cyl(0.11, 0.11, 0.12, 12), POLE_D, loc=(0, 0, H - 0.02)),
        # REC badge on the pole (facing the street, -Y)
        Part(coll, "badge", bm_box(0.42, 0.05, 0.18), BADGE, loc=(0, -0.09, 1.55)).bevel(0.02, 2),
        Part(coll, "recTxt", bm_text("REC", 0.11), TXT, loc=(0.05, -0.118, 1.55), rot=(math.pi / 2, 0, 0), smooth=False),
    ]
    bake(pole, "CamPole", coll, parent=root)
    bake([Part(coll, "dot", bm_sphere(0.032, 0.02, 0.032, 10, 6), DOT, loc=(-0.13, -0.12, 1.55))], "RecDot", coll, parent=root)

    # The head pivots at the top of the pole. Its lens looks along -Y (= +Z in
    # three.js), so rotation.y = atan2(dx, dz) aims it; rotation.x tilts it down.
    piv = (0, 0, H + 0.08)
    head = [
        Part(coll, "joint", bm_sphere(0.1), POLE_D, loc=piv),
        Part(coll, "arm", bm_box(0.12, 0.36, 0.12), BODY_L, loc=(0, -0.18, H + 0.08)).bevel(0.03, 2),
        Part(coll, "body", bm_box(0.36, 0.52, 0.34), BODY, loc=(0, -0.52, H + 0.12)).bevel(0.06, 3),
        Part(coll, "fin", bm_box(0.42, 0.62, 0.05), BODY_L, loc=(0, -0.55, H + 0.32)).bevel(0.02, 2),
        Part(coll, "lens", bm_cyl(0.13, 0.13, 0.08, 18, "Y"), LENS, loc=(0, -0.81, H + 0.12)),
        Part(coll, "lensIn", bm_cyl(0.09, 0.09, 0.04, 18, "Y"), LENS_IN, loc=(0, -0.85, H + 0.12)),
        Part(coll, "pupil", bm_sphere(0.05, 0.02, 0.05, 12, 8), LENS, loc=(0.01, -0.875, H + 0.13)),
        Part(coll, "glint", bm_sphere(0.018, 0.01, 0.018, 8, 6), TXT, loc=(-0.035, -0.88, H + 0.165)),
    ]
    hd = bake_at(head, "CamHead", coll, root, piv)
    led = bake([Part(coll, "led", bm_sphere(0.04, 0.03, 0.04, 10, 6), LED, loc=(0.12, -0.79, H + 0.24))], "Led", coll)
    led.parent = hd
    led.matrix_parent_inverse = hd.matrix_world.inverted()
    return coll


# ── cone ─────────────────────────────────────────────────────────────────
def build_cone():
    coll = scene_coll("ParkingCone")
    root = root_empty(coll, "ParkingCone")
    ORANGE = mat("ConeOrange", "#FF6D00", rough=0.5)
    STRIPE = mat("ConeStripe", "#FAFAFA", rough=0.35)
    BASE = mat("ConeBase", "#212121", rough=0.8)
    parts = [
        Part(coll, "base", bm_box(0.46, 0.46, 0.05), BASE, loc=(0, 0, 0.025)).bevel(0.04, 2),
        Part(coll, "cone", bm_cyl(0.19, 0.035, 0.66, 20), ORANGE, loc=(0, 0, 0.38)),
        Part(coll, "s1", bm_cyl(0.157, 0.128, 0.09, 20), STRIPE, loc=(0, 0, 0.30)),
        Part(coll, "s2", bm_cyl(0.10, 0.075, 0.07, 20), STRIPE, loc=(0, 0, 0.53)),
    ]
    bake(parts, "Cone", coll, parent=root)
    return coll


# ── street furniture ─────────────────────────────────────────────────────
def build_lamp():
    coll = scene_coll("ParkingLamp")
    root = root_empty(coll, "ParkingLamp")
    POST = mat("LampPost", "#263238", rough=0.5, metal=0.5)
    GLOW = mat("LampGlow", "#FFEE58", rough=0.2, emit=0.6)
    H = 4.6
    parts = [
        Part(coll, "foot", bm_cyl(0.2, 0.26, 0.4, 14), POST, loc=(0, 0, 0.2)),
        Part(coll, "post", bm_cyl(0.07, 0.09, H, 12), POST, loc=(0, 0, H / 2)),
        limb(coll, "arm", (0, 0, H - 0.1), (0, -0.9, H + 0.25), 0.045, POST),
        Part(coll, "hood", bm_cyl(0.08, 0.34, 0.22, 18), POST, loc=(0, -1.0, H + 0.22)),
    ]
    bake(parts, "Lamp", coll, parent=root)
    bake([Part(coll, "bulb", bm_sphere(0.24, 0.24, 0.12, 16, 8), GLOW, loc=(0, -1.0, H + 0.1))], "LampBulb", coll, parent=root)
    anchor(coll, root, "Anchor_light", (0, -1.0, H - 0.1))
    return coll


def build_hydrant():
    coll = scene_coll("ParkingHydrant")
    root = root_empty(coll, "ParkingHydrant")
    RED = mat("HydrantRed", "#C62828", rough=0.4, metal=0.1)
    CAP = mat("HydrantCap", "#FFD54F", rough=0.4, metal=0.2)
    parts = [
        Part(coll, "foot", bm_cyl(0.2, 0.2, 0.08, 16), RED, loc=(0, 0, 0.04)),
        Part(coll, "barrel", bm_cyl(0.14, 0.15, 0.62, 16), RED, loc=(0, 0, 0.38)),
        Part(coll, "dome", bm_sphere(0.15, 0.15, 0.12), CAP, loc=(0, 0, 0.7)),
        Part(coll, "nut", bm_cyl(0.04, 0.04, 0.08, 6), CAP, loc=(0, 0, 0.82), smooth=False),
        Part(coll, "nozzleF", bm_cyl(0.065, 0.065, 0.12, 12, "Y"), RED, loc=(0, -0.17, 0.46)),
        Part(coll, "capF", bm_cyl(0.075, 0.075, 0.04, 6, "Y"), CAP, loc=(0, -0.24, 0.46), smooth=False),
    ]
    for s in (-1, 1):
        parts.append(Part(coll, "nozzle", bm_cyl(0.05, 0.05, 0.1, 12, "X"), RED, loc=(s * 0.18, 0, 0.5)))
        parts.append(Part(coll, "capS", bm_cyl(0.06, 0.06, 0.035, 6, "X"), CAP, loc=(s * 0.24, 0, 0.5), smooth=False))
    bake(parts, "Hydrant", coll, parent=root)
    return coll


def build_mailbox():
    coll = scene_coll("ParkingMailbox")
    root = root_empty(coll, "ParkingMailbox")
    BLUE = mat("MailBlue", "#1565C0", rough=0.45, metal=0.1)
    DARK = mat("MailDark", "#0D47A1", rough=0.5)
    WHITE = mat("MailText", "#FFFFFF", rough=0.5)
    LEG = mat("MailLeg", "#0D2E5C", rough=0.6)
    parts = []
    for x in (-0.24, 0.24):
        for y in (-0.2, 0.2):
            parts.append(Part(coll, "leg", bm_box(0.06, 0.06, 0.3), LEG, loc=(x, y, 0.15)))
    box = Part(coll, "box", bm_box(0.6, 0.52, 0.8), BLUE, loc=(0, 0, 0.7)).bevel(0.04, 2)
    parts.append(box)
    parts.append(Part(coll, "top", bm_cyl(0.26, 0.26, 0.6, 20, "X"), BLUE, loc=(0, 0, 1.1)))
    parts.append(Part(coll, "slot", bm_box(0.38, 0.12, 0.05), DARK, loc=(0, -0.24, 1.15), rot=(0.5, 0, 0)))
    parts.append(Part(coll, "eagle", bm_cyl(0.11, 0.11, 0.02, 18, "Y"), WHITE, loc=(0, -0.265, 0.82)))
    parts.append(Part(coll, "usps", bm_text("USPS", 0.12), WHITE, loc=(0, -0.27, 0.6), rot=(math.pi / 2, 0, 0), smooth=False))
    bake(parts, "Mailbox", coll, parent=root)
    return coll


def build_meter():
    coll = scene_coll("ParkingMeter")
    root = root_empty(coll, "ParkingMeter")
    POLE = mat("MeterPole", "#37474F", rough=0.5, metal=0.5)
    HEAD = mat("MeterHead", "#90A4AE", rough=0.35, metal=0.6)
    GLASS = mat("MeterGlass", "#101418", rough=0.1)
    RED = mat("MeterExp", "#F44336", rough=0.4, emit=0.8)
    parts = [
        Part(coll, "foot", bm_cyl(0.1, 0.12, 0.06, 12), POLE, loc=(0, 0, 0.03)),
        Part(coll, "pole", bm_cyl(0.045, 0.045, 1.05, 10), POLE, loc=(0, 0, 0.55)),
        Part(coll, "head", bm_box(0.28, 0.2, 0.36), HEAD, loc=(0, 0, 1.25)).bevel(0.07, 3),
        Part(coll, "dome", bm_sphere(0.14, 0.1, 0.1), HEAD, loc=(0, 0, 1.43)),
        Part(coll, "window", bm_cyl(0.085, 0.085, 0.03, 18, "Y"), GLASS, loc=(0, -0.105, 1.3)),
        Part(coll, "exp", bm_text("EXP", 0.06), RED, loc=(0, -0.125, 1.3), rot=(math.pi / 2, 0, 0), smooth=False),
        Part(coll, "coinslot", bm_box(0.06, 0.02, 0.012), GLASS, loc=(0, -0.105, 1.17)),
    ]
    bake(parts, "Meter", coll, parent=root)
    return coll


def build_signpost():
    coll = scene_coll("ParkingSign")
    root = root_empty(coll, "ParkingSign")
    POST = mat("SignPost", "#37474F", rough=0.5, metal=0.5)
    BLUE = mat("SignBlue", "#1565C0", rough=0.5)
    EDGE = mat("SignEdge", "#0D47A1", rough=0.5)
    WHITE = mat("SignWhite", "#FFFFFF", rough=0.5)
    parts = [
        Part(coll, "post", bm_cyl(0.045, 0.045, 2.6, 10), POST, loc=(0, 0, 1.3)),
        Part(coll, "plate", bm_box(0.62, 0.04, 0.62), BLUE, loc=(0, -0.06, 2.35)).bevel(0.05, 2),
        Part(coll, "plateEdge", bm_box(0.66, 0.03, 0.66), EDGE, loc=(0, -0.035, 2.35)).bevel(0.05, 2),
        Part(coll, "P", bm_text("P", 0.5, 0.01), WHITE, loc=(0, -0.085, 2.35), rot=(math.pi / 2, 0, 0), smooth=False),
        # the lot-name board under the P (the game puts the text plate at Anchor_sign)
        Part(coll, "board", bm_box(0.92, 0.04, 0.3), EDGE, loc=(0, -0.06, 1.85)).bevel(0.03, 2),
    ]
    bake(parts, "Signpost", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, -0.085, 1.85))
    return coll


def build_bollard():
    coll = scene_coll("ParkingBollard")
    root = root_empty(coll, "ParkingBollard")
    Y = mat("BollardYellow", "#FBC02D", rough=0.45)
    B = mat("BollardBand", "#212121", rough=0.6)
    parts = [
        Part(coll, "post", bm_cyl(0.13, 0.13, 0.9, 14), Y, loc=(0, 0, 0.45)),
        Part(coll, "cap", bm_sphere(0.13, 0.13, 0.07), Y, loc=(0, 0, 0.9)),
        Part(coll, "band", bm_cyl(0.135, 0.135, 0.08, 14), B, loc=(0, 0, 0.72)),
    ]
    bake(parts, "Bollard", coll, parent=root)
    return coll


def build_planter():
    coll = scene_coll("ParkingPlanter")
    root = root_empty(coll, "ParkingPlanter")
    CON = mat("Concrete", "#BDB7AE", rough=0.95)
    SOIL = mat("Soil", "#5D4037", rough=1.0)
    parts = [
        Part(coll, "box", bm_box(1.6, 1.0, 0.6), CON, loc=(0, 0, 0.3)).bevel(0.05, 2),
        Part(coll, "soil", bm_box(1.44, 0.84, 0.05), SOIL, loc=(0, 0, 0.6)),
        Part(coll, "b1", bm_ico(0.42), S.LEAVES, loc=(-0.35, 0, 0.85), smooth=False),
        Part(coll, "b2", bm_ico(0.36), S.LEAVES, loc=(0.35, 0.05, 0.8), smooth=False),
        Part(coll, "b3", bm_ico(0.3), S.LEAVES, loc=(0.0, -0.1, 1.05), smooth=False),
    ]
    for x in (-0.25, 0.4):
        parts.append(Part(coll, "flower", bm_ico(0.08), mat("Flower", "#FF4081", rough=0.6), loc=(x, -0.3, 1.0), smooth=False))
    bake(parts, "Planter", coll, parent=root)
    return coll


def build_building(name, w, d, floors, storefront):
    """A city block building whose FRONT faces -Y (toward the sidewalk)."""
    coll = scene_coll(name)
    root = root_empty(coll, name)
    WALLS = mat("Walls", "#7986CB", rough=0.85)
    TRIM = mat("Trim", "#EDE7DA", rough=0.7)
    ROOF = mat("Roof", "#3E2723", rough=0.8)
    WIN = mat("Window", "#9AD9F5", rough=0.1, emit=0.15)
    FRAME = mat("WinFrame", "#ECEFF1", rough=0.6)
    DOOR = mat("Door", "#4E342E", rough=0.7)
    AWN = mat("Awning", "#E53935", rough=0.7)
    AWN2 = mat("AwningStripe", "#FAFAFA", rough=0.7)
    fh = 3.0
    hgt = floors * fh + 0.6
    hd = d / 2
    parts = [
        Part(coll, "walls", bm_box(w, d, hgt), WALLS, loc=(0, 0, hgt / 2), smooth=False),
        # trapezoid cornice cap (the 2D lot's buildings had a chunky roof lip)
        Part(coll, "cornice", bm_box(w + 0.5, d + 0.5, 0.35), ROOF, loc=(0, 0, hgt + 0.17), smooth=False).bevel(0.12, 1),
        Part(coll, "parapet", bm_box(w - 0.4, d - 0.4, 0.3), ROOF, loc=(0, 0, hgt + 0.48), smooth=False),
        Part(coll, "base", bm_box(w + 0.1, d + 0.1, 0.45), TRIM, loc=(0, 0, 0.22), smooth=False),
    ]
    fy = -hd - 0.02
    cols = max(2, int(w // 2.2))
    step = w / cols
    f0 = 1 if storefront else 0
    for f in range(f0, floors):
        z = f * fh + 1.7
        parts.append(Part(coll, "band", bm_box(w + 0.06, 0.12, 0.14), TRIM, loc=(0, fy - 0.02, f * fh + 0.55), smooth=False))
        for c in range(cols):
            x = -w / 2 + step * (c + 0.5)
            parts.append(Part(coll, "wf", bm_box(1.15, 0.08, 1.45), FRAME, loc=(x, fy, z), smooth=False))
            parts.append(Part(coll, "w", bm_box(0.95, 0.1, 1.25), WIN, loc=(x, fy - 0.01, z), smooth=False))
            parts.append(Part(coll, "sill", bm_box(1.25, 0.2, 0.08), TRIM, loc=(x, fy - 0.06, z - 0.75), smooth=False))
    if storefront:
        parts.append(Part(coll, "shopwin", bm_box(w * 0.62, 0.1, 1.9), WIN, loc=(-w * 0.12, fy - 0.01, 1.45), smooth=False))
        parts.append(Part(coll, "shopframe", bm_box(w * 0.62 + 0.2, 0.08, 2.1), FRAME, loc=(-w * 0.12, fy + 0.01, 1.45), smooth=False))
        parts.append(Part(coll, "door", bm_box(1.1, 0.12, 2.3), DOOR, loc=(w * 0.34, fy - 0.02, 1.15), smooth=False))
        parts.append(Part(coll, "knob", bm_sphere(0.06), S.CHROME, loc=(w * 0.34 - 0.38, fy - 0.1, 1.1)))
        # striped awning
        n = 8
        aw = w * 0.9
        for i in range(n):
            m = AWN if i % 2 == 0 else AWN2
            x = -aw / 2 + aw / n * (i + 0.5)
            parts.append(Part(coll, "awn", bm_box(aw / n, 1.3, 0.06), m, loc=(x, fy - 0.6, 2.85), rot=(-0.32, 0, 0), smooth=False))
        parts.append(Part(coll, "awnLip", bm_box(aw, 0.05, 0.25), AWN, loc=(0, fy - 1.22, 2.55), smooth=False))
    else:
        parts.append(Part(coll, "door", bm_box(1.2, 0.12, 2.3), DOOR, loc=(0, fy - 0.02, 1.15), smooth=False))
        parts.append(Part(coll, "step", bm_box(1.8, 0.6, 0.18), TRIM, loc=(0, fy - 0.3, 0.09), smooth=False))
    bake(parts, name + "_body", coll, parent=root)
    return coll


def build_icecream():
    coll = scene_coll("ParkingIceCream")
    root = root_empty(coll, "ParkingIceCream")
    CONE = mat("Waffle", "#E0A458", rough=0.8)
    SCOOP = mat("Scoop", "#F48FB1", rough=0.5)
    SPRINK = mat("Sprinkles", "#FFEB3B", rough=0.5)
    parts = [
        Part(coll, "cone", bm_cyl(0.005, 0.045, 0.13, 14), CONE, loc=(0, 0, 0.065)),
        Part(coll, "scoop", bm_sphere(0.055, 0.055, 0.05), SCOOP, loc=(0, 0, 0.15)),
        Part(coll, "top", bm_sphere(0.035), SCOOP, loc=(0.01, 0, 0.195)),
    ]
    for i in range(6):
        a = i * 1.05
        parts.append(Part(coll, "sp", bm_box(0.012, 0.004, 0.004), SPRINK, loc=(math.cos(a) * 0.04, math.sin(a) * 0.04, 0.18), rot=(0, 0, a)))
    bake(parts, "IceCream", coll, parent=root)
    return coll


# ── people ───────────────────────────────────────────────────────────────
def build_angryman():
    # The grumpy grandpa from the 2D game: wild white hair, red plaid shirt,
    # brown trousers, glasses and a bristly moustache.
    return build_person("ParkingAngryMan", dict(hair="curly", hair_color="#FAFAFA", top="#B71C1C", bottom="pants",
                        bottom_color="#3E2723", shoes="#212121", width=1.12,
                        extras=["glasses", "mustache", "belly"], extra_colors={"Beard": "#EEEEEE"}))


def build_sasquatch():
    # Sasquatch, the Boss Level's silent judge (cheers when you nail it).
    return build_person("ParkingSasquatch", dict(hair="curly", hair_color="#4E342E", skin="#8D6E63", top="#5D4037",
                        bottom="pants", bottom_color="#5D4037", shoes="#3E2723", height=2.15, width=1.4,
                        extras=["beard", "belly"], extra_colors={"Beard": "#4E342E"}))


ASSETS = [
    ("parking_camera", build_camera),
    ("parking_cone", build_cone),
    ("parking_lamp", build_lamp),
    ("parking_hydrant", build_hydrant),
    ("parking_mailbox", build_mailbox),
    ("parking_meter", build_meter),
    ("parking_signpost", build_signpost),
    ("parking_bollard", build_bollard),
    ("parking_planter", build_planter),
    ("parking_bldg_a", lambda: build_building("ParkingBldgA", 9.0, 7.0, 3, False)),
    ("parking_bldg_b", lambda: build_building("ParkingBldgB", 8.0, 7.0, 2, True)),
    ("parking_icecream", build_icecream),
    ("parking_angryman", build_angryman),
    ("parking_sasquatch", build_sasquatch),
]
