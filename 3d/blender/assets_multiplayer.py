"""
Shared Road assets (feature id: multiplayer).

Other players show up as translucent GHOSTS of whatever they're driving. Lulu's
car, the cop car and traffic sedans/vans/trucks come from assets_core; these are
the 2D game's other rides a 2D player can be in (state `vk`):

  multiplayer_bus        the yellow school bus        (vk "bus")
  multiplayer_ambulance  a white ambulance + lightbar (vk "ambulance")
  multiplayer_dozer      the construction steamroller (vk "dozer")
  multiplayer_flag       a little chequered race flag the race leader's ghost carries

Every vehicle faces Blender -Y (= +Z in three.js) with Wheel_* nodes so ghosts
can spin their wheels; "Paint" is recolourable like the traffic cars.
"""
from lib import *


def setup():
    global S
    S = shared()


def build_bus():
    coll = scene_coll("MpBus")
    root = root_empty(coll, "MpBus")
    Y = mat("Paint", "#F9A825", rough=0.45)
    BLACK = mat("BusTrim", "#212121", rough=0.6)
    STOP = mat("LightRedStop", "#E53935", rough=0.4, emit=0.6)
    L, W_, H = 9.6, 2.45, 2.6
    parts = [
        Part(coll, "body", bm_box(W_, L, H - 0.5), Y, loc=(0, 0.2, 0.55 + (H - 0.5) / 2)).bevel(0.18, 3),
        Part(coll, "hood", bm_box(W_ - 0.2, 1.4, 0.9), Y, loc=(0, -L / 2 - 0.45, 0.95)).bevel(0.16, 3),
        Part(coll, "roof", bm_box(W_ - 0.1, L - 0.2, 0.18), mat("BusRoof", "#FFF59D", rough=0.5), loc=(0, 0.2, H + 0.12)).bevel(0.08, 2),
        Part(coll, "windshield", bm_box(W_ - 0.3, 0.06, 0.9), S.TINT, loc=(0, -L / 2 + 0.22, 2.05)),
        Part(coll, "bumperF", bm_box(W_, 0.22, 0.25), BLACK, loc=(0, -L / 2 - 1.18, 0.55)).bevel(0.05, 2),
        Part(coll, "bumperR", bm_box(W_, 0.22, 0.25), BLACK, loc=(0, L / 2 + 0.31, 0.6)).bevel(0.05, 2),
    ]
    for s in (-1, 1):
        parts.append(Part(coll, "stripe", bm_box(0.02, L - 0.4, 0.1), BLACK, loc=(s * (W_ / 2 + 0.005), 0.2, 1.25)))
        parts.append(Part(coll, "stripe2", bm_box(0.02, L - 0.4, 0.06), BLACK, loc=(s * (W_ / 2 + 0.005), 0.2, 1.55)))
        for i in range(7):
            parts.append(Part(coll, "win", bm_box(0.04, 0.95, 0.75), S.TINT, loc=(s * (W_ / 2 + 0.01), -L / 2 + 1.4 + i * 1.18, 2.05)))
        parts.append(Part(coll, "head", bm_sphere(0.16, 0.06, 0.12), S.HEAD, loc=(s * 0.8, -L / 2 - 1.15, 0.95)))
        parts.append(Part(coll, "tail", bm_box(0.25, 0.05, 0.25), S.TAIL, loc=(s * 0.95, L / 2 + 0.33, 1.0)))
    # the fold-out STOP sign on the driver's side
    parts.append(Part(coll, "stop", bm_cyl(0.32, 0.32, 0.04, 8, "X"), STOP, loc=(W_ / 2 + 0.06, -L / 2 + 1.7, 1.5), smooth=False))
    parts.append(Part(coll, "stopBand", bm_box(0.02, 0.42, 0.1), mat("White", "#FAFAFA"), loc=(W_ / 2 + 0.085, -L / 2 + 1.7, 1.5)))
    parts.append(Part(coll, "sign", bm_box(1.9, 0.05, 0.34), BLACK, loc=(0, -L / 2 + 0.16, 2.75)).bevel(0.04, 2))
    bake(parts, "Bus_body", coll, parent=root)
    for nm, x, y in (("Wheel_FL", 1.08, -L / 2 + 0.2), ("Wheel_FR", -1.08, -L / 2 + 0.2),
                     ("Wheel_RL", 1.08, L / 2 - 1.6), ("Wheel_RR", -1.08, L / 2 - 1.6)):
        wheel(coll, root, nm, (x, y, 0.5), 0.5, 0.34, S.TIRE, S.CHROME, S.TIRE)
    return coll


def build_ambulance():
    coll = scene_coll("MpAmbulance")
    root = root_empty(coll, "MpAmbulance")
    WHITE = mat("Paint", "#FAFAFA", rough=0.4)
    RED = mat("AmbuRed", "#E53935", rough=0.45)
    LR = mat("LightRed", "#FF1744", rough=0.3, emit=3.0)
    LB = mat("LightBlue", "#2979FF", rough=0.3, emit=3.0)
    parts = [
        Part(coll, "box", bm_box(2.1, 3.4, 2.2), WHITE, loc=(0, 0.75, 1.55)).bevel(0.14, 3),
        Part(coll, "cab", bm_box(2.0, 1.9, 1.35), WHITE, loc=(0, -1.75, 1.1)).bevel(0.14, 3),
        Part(coll, "cabWin", bm_box(1.8, 0.06, 0.6), S.TINT, loc=(0, -2.68, 1.45), rot=(-0.3, 0, 0)),
        Part(coll, "bumperF", bm_box(2.0, 0.2, 0.22), S.DARK, loc=(0, -2.75, 0.5)).bevel(0.05, 2),
        Part(coll, "bar", bm_box(1.5, 0.35, 0.08), S.DARK, loc=(0, -1.05, 2.7)),
        Part(coll, "lr", bm_box(0.6, 0.3, 0.16), LR, loc=(-0.38, -1.05, 2.82)).bevel(0.04, 2),
        Part(coll, "lb", bm_box(0.6, 0.3, 0.16), LB, loc=(0.38, -1.05, 2.82)).bevel(0.04, 2),
    ]
    for s in (-1, 1):
        parts.append(Part(coll, "stripe", bm_box(0.02, 4.9, 0.22), RED, loc=(s * 1.06, -0.1, 1.15)))
        parts.append(Part(coll, "crossV", bm_box(0.02, 0.22, 0.75), RED, loc=(s * 1.06, 1.0, 2.0)))
        parts.append(Part(coll, "crossH", bm_box(0.02, 0.75, 0.22), RED, loc=(s * 1.06, 1.0, 2.0)))
        parts.append(Part(coll, "head", bm_box(0.36, 0.06, 0.16), S.HEAD, loc=(s * 0.65, -2.7, 0.85)).bevel(0.03, 2))
        parts.append(Part(coll, "tail", bm_box(0.2, 0.06, 0.4), S.TAIL, loc=(s * 0.9, 2.47, 1.0)))
    parts.append(Part(coll, "crossBack", bm_box(0.7, 0.03, 0.2), RED, loc=(0, 2.47, 1.9)))
    parts.append(Part(coll, "crossBack2", bm_box(0.2, 0.03, 0.7), RED, loc=(0, 2.47, 1.9)))
    bake(parts, "Ambulance_body", coll, parent=root)
    four_wheels(coll, root, 0.9, -1.75, 1.6, 0.4, 0.3, S.TIRE, S.CHROME, S.TIRE)
    return coll


def build_dozer():
    coll = scene_coll("MpDozer")
    root = root_empty(coll, "MpDozer")
    Y = mat("Paint", "#FBC02D", rough=0.5)
    DRUM = mat("Drum", "#9E9E9E", rough=0.35, metal=0.7)
    BLACK = mat("DozerBlack", "#212121", rough=0.6)
    parts = [
        Part(coll, "chassis", bm_box(2.0, 3.2, 1.0), Y, loc=(0, 0.7, 1.15)).bevel(0.12, 3),
        Part(coll, "yoke", bm_box(2.4, 0.5, 0.9), Y, loc=(0, -1.0, 1.3)).bevel(0.1, 2),
        Part(coll, "seat", bm_box(0.6, 0.6, 0.2), BLACK, loc=(0, 1.0, 1.75)).bevel(0.05, 2),
        Part(coll, "roof", bm_box(1.8, 1.8, 0.1), Y, loc=(0, 1.0, 3.0)).bevel(0.04, 2),
        Part(coll, "beacon", bm_sphere(0.14), mat("NeonBeacon", "#FF9100", rough=0.3, emit=2.5), loc=(0, 1.0, 3.15)),
    ]
    for x in (-0.8, 0.8):
        for y in (0.2, 1.8):
            parts.append(limb(coll, "post", (x, y, 1.6), (x, y, 2.98), 0.05, BLACK))
    bake(parts, "Dozer_body", coll, parent=root)
    # the big front roller is "Wheel_F" so it spins like a wheel
    bake_at([Part(coll, "drum", bm_cyl(0.75, 0.75, 2.2, 28, "X"), DRUM, loc=(0, -2.0, 0.75)),
             Part(coll, "rimL", bm_cyl(0.78, 0.78, 0.08, 28, "X"), Y, loc=(1.1, -2.0, 0.75)),
             Part(coll, "rimR", bm_cyl(0.78, 0.78, 0.08, 28, "X"), Y, loc=(-1.1, -2.0, 0.75))], "Wheel_F", coll, root, (0, -2.0, 0.75))
    for nm, x in (("Wheel_RL", 0.95), ("Wheel_RR", -0.95)):
        wheel(coll, root, nm, (x, 1.7, 0.62), 0.62, 0.45, S.TIRE, Y, S.TIRE)
    return coll


def build_flag():
    coll = scene_coll("MpFlag")
    root = root_empty(coll, "MpFlag")
    POLE = mat("FlagPole", "#ECEFF1", rough=0.4, metal=0.5)
    BLK = mat("FlagBlack", "#111111", rough=0.6)
    WHT = mat("FlagWhite", "#FAFAFA", rough=0.6)
    parts = [Part(coll, "pole", bm_cyl(0.025, 0.025, 1.3, 8), POLE, loc=(0, 0, 0.65))]
    for i in range(4):
        for j in range(3):
            m = BLK if (i + j) % 2 == 0 else WHT
            parts.append(Part(coll, "sq", bm_box(0.012, 0.14, 0.14), m, loc=(0, 0.07 + i * 0.14, 1.2 - j * 0.14), smooth=False))
    bake(parts, "Flag", coll, parent=root)
    return coll


ASSETS = [
    ("multiplayer_bus", build_bus),
    ("multiplayer_ambulance", build_ambulance),
    ("multiplayer_dozer", build_dozer),
    ("multiplayer_flag", build_flag),
]
