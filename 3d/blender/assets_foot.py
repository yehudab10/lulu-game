"""
Lulu on Foot + Avigail's wedding - Blender assets (feature id: foot).

Main Street storefronts with real doors (the bar, the cheder, the clinic, the
precinct, the beach boardwalk gate), street furniture (lamp, bench, planter),
the roadside QUICK-CHANGE booth, the parked rides Lulu can "borrow"
(ambulance, city bus, steamroller), the animals she pets (duck, raccoon,
ostrich) and the whole wedding: chuppah, chairs, flower stands, bouquet, the
glass to stomp, the klezmer fiddle, plus the people only this feature uses
(Avigail as a kallah, Aviel the nervous chosson, the rabbi, the fiddler).

Conventions (see 3d/ARCHITECTURE.md): metres, FRONT = Blender -Y, one
collection per asset whose root is an Empty. Buildings carry two anchors the
game reads: Anchor_door (the doorstep, on the pavement) and Anchor_sign (the
centre of the blank sign band, where the name is painted at runtime).
"""
from lib import *
from lib_people import build_person


def setup():
    pass


def S():
    return shared()


def box(coll, nm, size, m, loc, rot=(0, 0, 0), bev=0.0, segs=2, smooth=False):
    p = Part(coll, nm, bm_box(*size), m, loc=loc, rot=rot, smooth=smooth)
    if bev:
        p.bevel(bev, segs)
    return p


def cyl(coll, nm, r1, r2, h, m, loc, segs=16, axis="Z", rot=(0, 0, 0), smooth=True):
    return Part(coll, nm, bm_cyl(r1, r2, h, segs, axis), m, loc=loc, rot=rot, smooth=smooth)


def sph(coll, nm, r, m, loc, ry=None, rz=None, u=14, v=10):
    return Part(coll, nm, bm_sphere(r, ry, rz, u, v), m, loc=loc)


# ── shared bits of a storefront ──────────────────────────────────────────
def facade_windows(coll, parts, w, d, z0, z1, frame, glass, cols, skip_mid=0.0, inset=0.05):
    """A row of framed windows across the front face (y = -d/2)."""
    fy = -d / 2 - inset
    span = w - 1.2
    for i in range(cols):
        x = -span / 2 + span * (i + 0.5) / cols
        if skip_mid and abs(x) < skip_mid:
            continue
        ww = span / cols * 0.72
        parts.append(box(coll, "winframe", (ww + 0.16, 0.08, z1 - z0 + 0.16), frame, (x, fy + 0.02, (z0 + z1) / 2)))
        parts.append(box(coll, "win", (ww, 0.1, z1 - z0), glass, (x, fy, (z0 + z1) / 2)))
        parts.append(box(coll, "sill", (ww + 0.3, 0.22, 0.08), frame, (x, fy - 0.08, z0 - 0.08)))


def door_parts(coll, parts, d, x, w, h, door_m, frame_m, glass_m=None, double=False, z0=0.0):
    fy = -d / 2 - 0.05
    parts.append(box(coll, "doorframe", (w + 0.3, 0.1, h + 0.18), frame_m, (x, fy + 0.03, z0 + (h + 0.18) / 2)))
    if double:
        for s in (-1, 1):
            parts.append(box(coll, "door", (w / 2 - 0.03, 0.12, h), door_m, (x + s * w / 4, fy - 0.01, z0 + h / 2)))
            if glass_m:
                parts.append(box(coll, "doorglass", (w / 2 - 0.25, 0.13, h * 0.45), glass_m, (x + s * w / 4, fy - 0.02, z0 + h * 0.66)))
            parts.append(sph(coll, "knob", 0.05, S().CHROME, (x + s * 0.12, fy - 0.1, z0 + h * 0.48)))
    else:
        parts.append(box(coll, "door", (w, 0.12, h), door_m, (x, fy - 0.01, z0 + h / 2)))
        if glass_m:
            parts.append(box(coll, "doorglass", (w * 0.6, 0.13, h * 0.32), glass_m, (x, fy - 0.02, z0 + h * 0.72)))
        parts.append(sph(coll, "knob", 0.055, S().CHROME, (x + w * 0.36, fy - 0.1, z0 + h * 0.48)))
    # mezuzah on the right door post (it's a Jewish town!)
    parts.append(box(coll, "mezuzah", (0.06, 0.05, 0.26), mat("Mezuzah", "#C9A227", rough=0.3, metal=0.7),
                     (x + w / 2 + 0.08, fy - 0.08, z0 + h * 0.75), rot=(0, -0.35, 0)))
    # welcome mat
    parts.append(box(coll, "mat", (w + 0.2, 0.7, 0.03), mat("DoorMat", "#6D4C41", rough=0.95), (x, -d / 2 - 0.45, 0.02)))


def steps(coll, parts, d, x, w, n, m, rise=0.16, run=0.32):
    for i in range(n):
        parts.append(box(coll, "step", (w + 0.6 + (n - i) * 0.0, run * (n - i), rise), m,
                         (x, -d / 2 - run * (n - i) / 2, rise * (i + 0.5))))


def sign_band(coll, parts, d, z, w, h, m):
    """A blank sign board on the facade; returns the y of its front face."""
    parts.append(box(coll, "signband", (w, 0.12, h), m, (0, -d / 2 - 0.08, z), bev=0.03))
    return -d / 2 - 0.08 - 0.07


def anchors(coll, root, door_y, sign_y, sign_z, door_x=0.0):
    anchor(coll, root, "Anchor_door", (door_x, door_y, 0))
    anchor(coll, root, "Anchor_sign", (0, sign_y - 0.01, sign_z))


# ── THE THIRSTY SCHOLAR (bar) ────────────────────────────────────────────
def build_bar():
    coll = scene_coll("FootBar")
    root = root_empty(coll, "FootBar")
    w, d, h = 9.0, 7.0, 6.4
    BRICK = mat("BarBrick", "#8D4A3A", rough=0.95)
    GREEN = mat("BarGreen", "#1B5E20", rough=0.6)
    GOLD = mat("BarGold", "#D4A72C", rough=0.35, metal=0.6)
    WARM = mat("WindowWarm", "#FFC768", rough=0.2, emit=1.4)
    WOOD = mat("BarWood", "#5D3A1F", rough=0.7)
    SIGN = mat("SignBoard", "#13361A", rough=0.6)
    parts = [box(coll, "walls", (w, d, h), BRICK, (0, 0, h / 2)),
             box(coll, "cornice", (w + 0.4, d + 0.4, 0.35), GREEN, (0, 0, h + 0.17)),
             box(coll, "roof", (w - 0.2, d - 0.2, 0.3), mat("RoofTar", "#3A3A3A", rough=0.95), (0, 0, h + 0.2))]
    # green wooden shopfront on the ground floor
    parts.append(box(coll, "shopfront", (w - 0.6, 0.18, 3.1), GREEN, (0, -d / 2 - 0.06, 1.55)))
    for s in (-1, 1):
        parts.append(box(coll, "pane", (2.4, 0.2, 1.7), WARM, (s * 2.5, -d / 2 - 0.12, 1.55)))
        for k in range(3):
            parts.append(box(coll, "mullion", (0.06, 0.24, 1.7), GREEN, (s * 2.5 - 0.8 + k * 0.8, -d / 2 - 0.13, 1.55)))
        parts.append(box(coll, "stallriser", (2.6, 0.24, 0.55), WOOD, (s * 2.5, -d / 2 - 0.12, 0.36)))
        # barrels by the door
        parts.append(cyl(coll, "barrel", 0.3, 0.3, 0.75, WOOD, (s * 1.25, -d / 2 - 0.55, 0.38), 14))
        parts.append(Part(coll, "hoop", bm_torus(0.31, 0.025, 16, 4), S().DARK, loc=(s * 1.25, -d / 2 - 0.55, 0.6)))
        # brass lamps either side of the door
        parts.append(box(coll, "lampArm", (0.06, 0.4, 0.06), GOLD, (s * 0.95, -d / 2 - 0.3, 2.75)))
        parts.append(sph(coll, "lamp", 0.13, WARM, (s * 0.95, -d / 2 - 0.5, 2.62)))
    door_parts(coll, parts, d + 0.3, 0, 1.2, 2.4, WOOD, GOLD, WARM)
    sy = sign_band(coll, parts, d + 0.2, 3.45, w - 0.8, 0.75, SIGN)
    # upstairs: sash windows
    facade_windows(coll, parts, w, d, 4.3, 5.5, mat("BarTrim", "#F3E9D8", rough=0.7), mat("Window", "#9AD9F5", rough=0.1, emit=0.25), 3)
    # a projecting hanging sign (the board is blank: painted at runtime too)
    parts.append(box(coll, "bracket", (0.06, 1.1, 0.06), S().BLACK, (w / 2 - 0.4, -d / 2 - 0.55, 4.0)))
    parts.append(box(coll, "hangsign", (0.08, 0.8, 0.6), GOLD, (w / 2 - 0.4, -d / 2 - 0.85, 3.6), bev=0.03))
    # an A-frame chalkboard on the pavement
    for s in (-1, 1):
        parts.append(box(coll, "chalk", (0.6, 0.05, 0.85), mat("Chalk", "#263238", rough=0.9), (-2.4, -d / 2 - 1.4 + s * 0.16, 0.42), rot=(s * 0.22, 0, 0)))
    bake(parts, "FootBar_body", coll, parent=root)
    anchors(coll, root, -d / 2 - 1.0, sy, 3.45)
    return coll


# ── the CHEDER (school) ──────────────────────────────────────────────────
def build_school():
    coll = scene_coll("FootSchool")
    root = root_empty(coll, "FootSchool")
    w, d, h = 12.0, 8.0, 5.6
    BRICK = mat("SchoolBrick", "#C0573E", rough=0.95)
    TRIM = mat("SchoolTrim", "#FFF8EE", rough=0.7)
    BLUE = mat("SchoolBlue", "#1E5AA8", rough=0.55)
    GLASS = mat("Window", "#9AD9F5", rough=0.1, emit=0.25)
    SIGN = mat("SignBoard", "#1E5AA8", rough=0.6)
    parts = [box(coll, "walls", (w, d, h), BRICK, (0, 0, h / 2)),
             box(coll, "base", (w + 0.1, d + 0.1, 0.5), mat("Stone", "#B8B1A5", rough=0.95), (0, 0, 0.25)),
             box(coll, "parapet", (w + 0.3, d + 0.3, 0.45), TRIM, (0, 0, h + 0.2)),
             box(coll, "roof", (w - 0.2, d - 0.2, 0.3), mat("RoofTar", "#3A3A3A", rough=0.95), (0, 0, h + 0.18))]
    facade_windows(coll, parts, w, d, 1.2, 2.6, TRIM, GLASS, 4, skip_mid=1.6)
    facade_windows(coll, parts, w, d, 3.5, 4.8, TRIM, GLASS, 5)
    steps(coll, parts, d, 0, 2.6, 3, mat("Stone", "#B8B1A5"))
    # entrance portico: columns + a pediment over the double doors
    for s in (-1, 1):
        parts.append(cyl(coll, "column", 0.16, 0.16, 3.0, TRIM, (s * 1.45, -d / 2 - 0.9, 1.98), 12))
    parts.append(box(coll, "portico", (3.6, 1.4, 0.25), TRIM, (0, -d / 2 - 0.65, 3.55)))
    parts.append(Part(coll, "pediment", bm_prism([(-1.9, 0), (1.9, 0), (0, 0.6)], 0.65), TRIM, loc=(0, -d / 2 - 0.65, 3.66),
                      rot=(0, 0, math.pi / 2), smooth=False))
    door_parts(coll, parts, d, 0, 1.8, 2.5, BLUE, TRIM, GLASS, double=True, z0=0.48)
    sy = sign_band(coll, parts, d, 3.15, 3.0, 0.5, SIGN)
    # bell cupola + a flag
    parts.append(box(coll, "cupola", (1.2, 1.2, 1.1), TRIM, (0, 0.6, h + 0.95)))
    parts.append(Part(coll, "cupolaRoof", bm_cyl(0.95, 0.05, 0.9, 4), BLUE, loc=(0, 0.6, h + 1.95), rot=(0, 0, math.pi / 4), smooth=False))
    parts.append(Part(coll, "bell", bm_cyl(0.18, 0.28, 0.35, 12), mat("Brass", "#D4A72C", rough=0.3, metal=0.8), loc=(0, 0.0, h + 0.95)))
    parts.append(cyl(coll, "flagpole", 0.05, 0.05, 6.5, S().CHROME, (w / 2 + 1.0, -d / 2 - 1.2, 3.25), 8))
    parts.append(box(coll, "flag", (1.2, 0.03, 0.75), mat("Flag", "#FAFAFA", rough=0.8), (w / 2 + 1.65, -d / 2 - 1.2, 6.0)))
    parts.append(box(coll, "flagStripe", (1.2, 0.04, 0.1), BLUE, (w / 2 + 1.65, -d / 2 - 1.2, 6.25)))
    parts.append(box(coll, "flagStripe", (1.2, 0.04, 0.1), BLUE, (w / 2 + 1.65, -d / 2 - 1.2, 5.75)))
    # a hopscotch-chalked bench out front
    parts.append(box(coll, "bench", (2.0, 0.45, 0.1), mat("BenchWood", "#A1673A", rough=0.8), (-3.8, -d / 2 - 1.1, 0.48)))
    for s in (-1, 1):
        parts.append(box(coll, "benchLeg", (0.1, 0.4, 0.45), S().DARK, (-3.8 + s * 0.85, -d / 2 - 1.1, 0.23)))
    bake(parts, "FootSchool_body", coll, parent=root)
    anchors(coll, root, -d / 2 - 1.8, sy, 3.15)
    return coll


# ── the CLINIC (hospital waiting room) ───────────────────────────────────
def build_hospital():
    coll = scene_coll("FootHospital")
    root = root_empty(coll, "FootHospital")
    w, d, h = 11.0, 8.0, 6.6
    WALL = mat("ClinicWall", "#EEF4F3", rough=0.85)
    TEAL = mat("ClinicTeal", "#00897B", rough=0.55)
    RED = mat("LightRed", "#E53935", rough=0.4, emit=1.2)
    GLASS = mat("Window", "#9AD9F5", rough=0.1, emit=0.25)
    SIGN = mat("SignBoard", "#00897B", rough=0.6)
    parts = [box(coll, "walls", (w, d, h), WALL, (0, 0, h / 2)),
             box(coll, "roofband", (w + 0.3, d + 0.3, 0.4), TEAL, (0, 0, h + 0.2)),
             box(coll, "roof", (w - 0.2, d - 0.2, 0.3), mat("RoofTar", "#3A3A3A", rough=0.95), (0, 0, h + 0.2))]
    # ribbon windows
    for z in (3.9, 5.4):
        parts.append(box(coll, "ribbon", (w - 1.0, 0.12, 0.9), mat("GlassTint", "#5FA8C8", rough=0.08, metal=0.2), (0, -d / 2 - 0.04, z)))
        parts.append(box(coll, "ribbonTrim", (w - 0.8, 0.16, 0.1), TEAL, (0, -d / 2 - 0.06, z - 0.5)))
    # sliding glass doors under a canopy
    parts.append(box(coll, "doorframe", (3.0, 0.12, 2.6), TEAL, (0, -d / 2 - 0.03, 1.3)))
    for s in (-1, 1):
        parts.append(box(coll, "glassdoor", (1.3, 0.1, 2.35), mat("Glass", "#BFE7F5", rough=0.05), (s * 0.67, -d / 2 - 0.08, 1.2)))
    parts.append(box(coll, "canopy", (4.6, 2.6, 0.22), TEAL, (0, -d / 2 - 1.2, 3.0)))
    for s in (-1, 1):
        parts.append(cyl(coll, "post", 0.09, 0.09, 3.0, WALL, (s * 2.1, -d / 2 - 2.3, 1.5), 10))
    # red crosses (glowing) on the canopy and the facade
    for (x, y, z, sc) in ((0, -d / 2 - 1.2, 3.55, 1.0), (w / 2 - 1.4, -d / 2 - 0.08, 5.4, 0.8)):
        parts.append(box(coll, "crossV", (0.32 * sc, 0.12, 1.0 * sc), RED, (x, y, z)))
        parts.append(box(coll, "crossH", (1.0 * sc, 0.12, 0.32 * sc), RED, (x, y, z)))
    parts.append(box(coll, "fascia", (4.6, 0.12, 0.5), SIGN, (0, -d / 2 - 2.52, 3.0), bev=0.03))
    # parking bollards + a bench
    for x in (-4.2, -3.2, 3.2, 4.2):
        parts.append(cyl(coll, "bollard", 0.11, 0.11, 0.8, mat("Bollard", "#FBC02D", rough=0.6), (x, -d / 2 - 2.6, 0.4), 10))
    for s in (-1, 1):
        parts.append(box(coll, "sidewin", (0.1, 4.0, 1.2), GLASS, (s * (w / 2 + 0.03), 0, 2.0)))
    bake(parts, "FootHospital_body", coll, parent=root)
    anchors(coll, root, -d / 2 - 1.0, -d / 2 - 2.58, 3.0)
    return coll


# ── PRECINCT 18½ (police) ────────────────────────────────────────────────
def build_police():
    coll = scene_coll("FootPolice")
    root = root_empty(coll, "FootPolice")
    w, d, h = 11.0, 8.0, 6.2
    SLATE = mat("PoliceSlate", "#5A6B78", rough=0.9)
    STONE = mat("PoliceStone", "#C9CED3", rough=0.9)
    NAVY = mat("PoliceNavy", "#1A237E", rough=0.55)
    BLUE = mat("LightBlue", "#4FA3FF", rough=0.3, emit=2.2)
    GLASS = mat("Window", "#9AD9F5", rough=0.1, emit=0.25)
    SIGN = mat("SignBoard", "#1A237E", rough=0.6)
    parts = [box(coll, "walls", (w, d, h), SLATE, (0, 0, h / 2)),
             box(coll, "base", (w + 0.15, d + 0.15, 0.7), STONE, (0, 0, 0.35)),
             box(coll, "cornice", (w + 0.4, d + 0.4, 0.35), STONE, (0, 0, h + 0.17)),
             box(coll, "roof", (w - 0.2, d - 0.2, 0.3), mat("RoofTar", "#3A3A3A", rough=0.95), (0, 0, h + 0.2))]
    facade_windows(coll, parts, w, d, 1.4, 2.7, STONE, GLASS, 4, skip_mid=1.8)
    facade_windows(coll, parts, w, d, 3.8, 5.2, STONE, GLASS, 4)
    # barred windows downstairs (it IS a police station)
    span = w - 1.2
    for i in range(4):
        x = -span / 2 + span * (i + 0.5) / 4
        if abs(x) < 1.8:
            continue
        for b in range(4):
            parts.append(box(coll, "bar", (0.04, 0.05, 1.3), S().DARK, (x - 0.45 + b * 0.3, -d / 2 - 0.12, 2.05)))
    steps(coll, parts, d, 0, 3.0, 4, STONE)
    for s in (-1, 1):
        parts.append(cyl(coll, "pillar", 0.2, 0.2, 3.4, STONE, (s * 1.7, -d / 2 - 0.25, 2.35), 12))
        # the classic blue globe lamps
        parts.append(cyl(coll, "lampPost", 0.05, 0.05, 1.3, S().DARK, (s * 2.4, -d / 2 - 1.45, 0.65 + 0.62), 8))
        parts.append(sph(coll, "globe", 0.24, BLUE, (s * 2.4, -d / 2 - 1.45, 2.05)))
    door_parts(coll, parts, d, 0, 2.0, 2.6, NAVY, STONE, GLASS, double=True, z0=0.66)
    sy = sign_band(coll, parts, d, 3.75, 3.6, 0.55, SIGN)
    parts.append(cyl(coll, "flagpole", 0.05, 0.05, 6.8, S().CHROME, (-w / 2 - 0.8, -d / 2 - 1.4, 3.4), 8))
    parts.append(box(coll, "flag", (1.3, 0.03, 0.8), NAVY, (-w / 2 - 0.1, -d / 2 - 1.4, 6.35)))
    bake(parts, "FootPolice_body", coll, parent=root)
    anchors(coll, root, -d / 2 - 2.2, sy, 3.75)
    return coll


# ── the BEACH boardwalk gate ─────────────────────────────────────────────
def build_beach_gate():
    coll = scene_coll("FootBeach")
    root = root_empty(coll, "FootBeach")
    WOOD = mat("BoardWood", "#B98552", rough=0.85)
    DARKW = mat("BoardDark", "#7A5230", rough=0.85)
    SAND = mat("Sand", "#F2DDA4", rough=1.0)
    ROPE = mat("Rope", "#E8D2A6", rough=0.9)
    SIGN = mat("SignBoard", "#0097A7", rough=0.6)
    parts = [box(coll, "sand", (12.0, 9.0, 0.06), SAND, (0, 2.5, 0.03), bev=0.02)]
    # boardwalk deck running away from the road
    for i in range(14):
        parts.append(box(coll, "plank", (2.6, 0.5, 0.08), WOOD if i % 2 else DARKW, (0, -1.6 + i * 0.55, 0.12)))
    for s in (-1, 1):
        for i in range(4):
            parts.append(cyl(coll, "ropePost", 0.07, 0.07, 1.0, DARKW, (s * 1.4, -1.6 + i * 2.4, 0.5), 8))
        parts.append(limb(coll, "rope", (s * 1.4, -1.6, 0.85), (s * 1.4, 5.6, 0.85), 0.025, ROPE))
        # the gate posts + arch
        parts.append(box(coll, "gatePost", (0.3, 0.3, 4.2), WOOD, (s * 1.8, -2.0, 2.1), bev=0.04))
        parts.append(sph(coll, "postCap", 0.22, mat("BeachWhite", "#FAFAFA"), (s * 1.8, -2.0, 4.3)))
    parts.append(box(coll, "archBeam", (4.2, 0.3, 0.35), WOOD, (0, -2.0, 3.9), bev=0.04))
    sy = sign_band(coll, parts, 4.0, 3.25, 3.2, 0.7, SIGN)
    # surfboards leaning on the posts
    for (x, c, r) in ((-2.4, "#FF7043", 0.25), (2.5, "#26C6DA", -0.22), (2.95, "#FFEE58", -0.3)):
        parts.append(Part(coll, "surf", bm_sphere(0.28, 0.06, 1.05, 16, 8), mat("Surf" + c[1:], c, rough=0.35),
                          loc=(x, -2.2, 1.0), rot=(0, r, 0)))
    # a striped beach umbrella + a lifebuoy
    parts.append(cyl(coll, "umbPole", 0.03, 0.03, 2.3, S().CHROME, (-3.6, 2.5, 1.15), 8))
    parts.append(Part(coll, "umb", bm_cyl(1.25, 0.05, 0.5, 8), mat("Umb0", "#E53935", rough=0.7), loc=(-3.6, 2.5, 2.45), smooth=False))
    parts.append(Part(coll, "umbTop", bm_cyl(0.5, 0.03, 0.22, 8), mat("Umb1", "#FAFAFA", rough=0.7), loc=(-3.6, 2.5, 2.72), smooth=False))
    parts.append(Part(coll, "buoy", bm_torus(0.32, 0.09, 18, 8), mat("Buoy", "#FF5722", rough=0.6),
                      loc=(1.8, -2.17, 2.4), rot=(math.pi / 2, 0, 0)))
    parts.append(Part(coll, "ball", bm_sphere(0.3, u=12, v=8), mat("BeachBall", "#29B6F6"), loc=(3.5, 1.2, 0.33)))
    bake(parts, "FootBeach_body", coll, parent=root)
    anchors(coll, root, -3.0, sy, 3.25)
    return coll


# ── street furniture ─────────────────────────────────────────────────────
def build_lamp():
    coll = scene_coll("FootLamp")
    root = root_empty(coll, "FootLamp")
    IRON = mat("LampIron", "#263238", rough=0.5, metal=0.4)
    GLOW = mat("Neon_Lamp", "#FFF1C1", rough=0.2, emit=1.6)
    parts = [cyl(coll, "base", 0.18, 0.14, 0.4, IRON, (0, 0, 0.2), 12),
             cyl(coll, "pole", 0.07, 0.06, 4.0, IRON, (0, 0, 2.3), 10),
             box(coll, "arm", (0.06, 0.6, 0.06), IRON, (0, -0.28, 4.2)),
             cyl(coll, "cap", 0.05, 0.3, 0.25, IRON, (0, -0.55, 4.25), 8),
             cyl(coll, "lantern", 0.16, 0.22, 0.4, GLOW, (0, -0.55, 3.98), 8)]
    bake(parts, "FootLamp_body", coll, parent=root)
    return coll


def build_bench():
    coll = scene_coll("FootBench")
    root = root_empty(coll, "FootBench")
    WOOD = mat("BenchWood", "#A1673A", rough=0.8)
    IRON = mat("LampIron", "#263238", rough=0.5, metal=0.4)
    parts = []
    for k in range(3):
        parts.append(box(coll, "slat", (1.8, 0.12, 0.05), WOOD, (0, -0.12 + k * 0.15, 0.46), bev=0.015))
    for k in range(2):
        parts.append(box(coll, "back", (1.8, 0.05, 0.11), WOOD, (0, 0.22, 0.66 + k * 0.16), rot=(-0.15, 0, 0), bev=0.015))
    for s in (-1, 1):
        parts.append(box(coll, "leg", (0.06, 0.5, 0.45), IRON, (s * 0.75, 0.03, 0.23)))
        parts.append(box(coll, "legBack", (0.06, 0.06, 0.45), IRON, (s * 0.75, 0.24, 0.68)))
    bake(parts, "FootBench_body", coll, parent=root)
    return coll


def build_planter():
    coll = scene_coll("FootPlanter")
    root = root_empty(coll, "FootPlanter")
    STONE = mat("PlanterStone", "#9E9E9E", rough=0.95)
    LEAF = mat("Leaves", "#4CAF50", rough=0.85)
    parts = [box(coll, "box", (1.4, 0.8, 0.5), STONE, (0, 0, 0.25), bev=0.05),
             box(coll, "soil", (1.25, 0.65, 0.05), mat("Soil", "#5D4037", rough=1), (0, 0, 0.5)),
             Part(coll, "hedge", bm_sphere(0.62, 0.34, 0.32, 14, 8), LEAF, loc=(0, 0, 0.72))]
    for k in range(6):
        parts.append(Part(coll, "flower", bm_ico(0.08), mat("PFlower%d" % (k % 2), ("#F06292", "#FFD54F")[k % 2]),
                          loc=(-0.5 + k * 0.2, -0.22 + (k % 2) * 0.4, 0.95), smooth=False))
    bake(parts, "FootPlanter_body", coll, parent=root)
    return coll


# ── the QUICK-CHANGE booth (shed the heat on foot) ───────────────────────
def build_booth():
    coll = scene_coll("FootBooth")
    root = root_empty(coll, "FootBooth")
    SHELL = mat("BoothShell", "#6A1B3A", rough=0.7)
    PINK = mat("Curtain", "#EC407A", rough=0.9)
    PINK2 = mat("Curtain2", "#F06292", rough=0.9)
    WHITE = mat("BoothWhite", "#FFFFFF", rough=0.7)
    SIGN = mat("SignBoard", "#311B92", rough=0.6)
    parts = [box(coll, "back", (1.7, 0.1, 2.4), SHELL, (0, 0.65, 1.2)),
             box(coll, "roof", (1.9, 1.6, 0.12), SHELL, (0, 0, 2.45), bev=0.03)]
    for s in (-1, 1):
        parts.append(box(coll, "side", (0.1, 1.4, 2.4), SHELL, (s * 0.85, 0, 1.2)))
        # pink privacy curtain, slightly parted (pleats = a row of thin boxes)
        for k in range(5):
            parts.append(box(coll, "pleat", (0.16, 0.06, 2.15), PINK if k % 2 else PINK2,
                             (s * (0.12 + k * 0.15), -0.66 - (k % 2) * 0.03, 1.12)))
    # striped awning
    for k in range(8):
        parts.append(box(coll, "awn", (0.24, 0.6, 0.06), PINK if k % 2 else WHITE, (-0.84 + k * 0.24, -0.95, 2.3), rot=(-0.35, 0, 0)))
    sy = sign_band(coll, parts, 1.2, 2.75, 1.9, 0.42, SIGN)
    # a clothes rack with two dresses peeking out
    parts.append(limb(coll, "rack", (1.0, -0.4, 1.9), (1.0, 0.5, 1.9), 0.025, S().CHROME))
    parts.append(limb(coll, "rackPost", (1.0, 0.5, 0.0), (1.0, 0.5, 1.9), 0.025, S().CHROME))
    for (y, c) in ((-0.2, "#7E57C2"), (0.2, "#26A69A")):
        parts.append(Part(coll, "dress", bm_cyl(0.07, 0.3, 0.9, 10), mat("Dress" + c[1:], c, rough=0.8), loc=(1.05, y, 1.4)))
    # the fancy shoes under the curtain (someone's changing!)
    for x in (-0.12, 0.12):
        parts.append(sph(coll, "shoe", 0.08, mat("ShoeGold", "#FFD54F", rough=0.3, metal=0.4), (x, -0.55, 0.05), ry=0.13, rz=0.05))
    bake(parts, "FootBooth_body", coll, parent=root)
    anchors(coll, root, -1.3, sy, 2.75)
    return coll


# ── parked rides: ambulance, city bus, steamroller ───────────────────────
def build_ambulance():
    coll = scene_coll("FootAmbulance")
    root = root_empty(coll, "FootAmbulance")
    sh = S()
    WHITE = mat("AmbWhite", "#FAFAFA", rough=0.4)
    RED = mat("AmbRed", "#E53935", rough=0.45)
    LRED = mat("LightRed", "#FF1744", rough=0.3, emit=3.0)
    LBLUE = mat("LightBlue", "#2979FF", rough=0.3, emit=3.0)
    parts = [box(coll, "box", (2.1, 3.6, 2.1), WHITE, (0, 0.9, 1.45), bev=0.12),
             box(coll, "cab", (2.0, 1.9, 1.35), WHITE, (0, -1.8, 1.08), bev=0.18),
             box(coll, "hood", (1.95, 0.9, 0.5), WHITE, (0, -2.75, 0.8), bev=0.15),
             box(coll, "wind", (1.8, 0.1, 0.65), sh.TINT, (0, -2.33, 1.5), rot=(0.35, 0, 0)),
             box(coll, "bumperF", (2.0, 0.2, 0.22), sh.DARK, (0, -3.2, 0.5), bev=0.05),
             box(coll, "bumperR", (2.1, 0.2, 0.22), sh.DARK, (0, 2.72, 0.5), bev=0.05)]
    for s in (-1, 1):
        parts.append(box(coll, "stripe", (0.03, 5.6, 0.25), RED, (s * 1.06, -0.1, 1.15)))
        parts.append(box(coll, "crossV", (0.03, 0.3, 0.9), RED, (s * 1.07, 1.0, 1.95)))
        parts.append(box(coll, "crossH", (0.03, 0.9, 0.3), RED, (s * 1.07, 1.0, 1.95)))
        parts.append(box(coll, "sidewin", (0.03, 0.9, 0.55), sh.TINT, (s * 1.0, -1.75, 1.45)))
        parts.append(box(coll, "head", (0.36, 0.06, 0.16), sh.HEAD, (s * 0.62, -3.2, 0.82)))
        parts.append(box(coll, "tail", (0.25, 0.06, 0.3), sh.TAIL, (s * 0.85, 2.72, 0.95)))
    parts.append(box(coll, "lightRed", (0.55, 0.3, 0.16), LRED, (-0.4, -1.3, 2.6), bev=0.04))
    parts.append(box(coll, "lightBlue", (0.55, 0.3, 0.16), LBLUE, (0.4, -1.3, 2.6), bev=0.04))
    parts.append(box(coll, "backdoors", (1.9, 0.04, 1.7), mat("AmbDoor", "#EEEEEE", rough=0.5), (0, 2.71, 1.45)))
    bake(parts, "FootAmbulance_body", coll, parent=root)
    four_wheels(coll, root, 0.88, -2.2, 1.8, 0.4, 0.28, sh.TIRE, sh.CHROME, sh.TIRE)
    return coll


def build_bus():
    coll = scene_coll("FootBus")
    root = root_empty(coll, "FootBus")
    sh = S()
    BODY = mat("BusWhite", "#F5F5F5", rough=0.4)
    BLUE = mat("BusBlue", "#1565C0", rough=0.45)
    YEL = mat("BusYellow", "#FFC107", rough=0.45)
    parts = [box(coll, "body", (2.5, 10.4, 2.6), BODY, (0, 0, 1.75), bev=0.2),
             box(coll, "windows", (2.54, 8.6, 0.95), sh.TINT, (0, 0.5, 2.25)),
             box(coll, "wind", (2.3, 0.1, 1.3), sh.TINT, (0, -5.18, 2.15)),
             box(coll, "skirt", (2.56, 10.2, 0.4), BLUE, (0, 0, 0.72)),
             box(coll, "roofpod", (1.8, 3.0, 0.3), BODY, (0, 2.5, 3.15), bev=0.1),
             box(coll, "routeSign", (1.6, 0.06, 0.32), mat("Neon_Route", "#FFB300", rough=0.3, emit=1.5), (0, -5.22, 2.85))]
    for s in (-1, 1):
        parts.append(box(coll, "stripe", (0.03, 10.0, 0.2), YEL, (s * 1.27, 0, 1.55)))
        parts.append(box(coll, "head", (0.4, 0.06, 0.18), sh.HEAD, (s * 0.8, -5.2, 0.95)))
        parts.append(box(coll, "tail", (0.3, 0.06, 0.4), sh.TAIL, (s * 0.95, 5.2, 1.1)))
    parts.append(box(coll, "door", (0.04, 1.1, 2.0), mat("GlassTint", "#2B3A42", rough=0.08), (-1.27, -3.9, 1.45)))
    bake(parts, "FootBus_body", coll, parent=root)
    four_wheels(coll, root, 1.05, -3.6, 3.4, 0.5, 0.34, sh.TIRE, sh.CHROME, sh.TIRE)
    return coll


def build_dozer():
    coll = scene_coll("FootDozer")
    root = root_empty(coll, "FootDozer")
    sh = S()
    YEL = mat("DozerYellow", "#FBC02D", rough=0.5)
    GREY = mat("DozerSteel", "#78909C", rough=0.4, metal=0.6)
    parts = [box(coll, "chassis", (1.9, 3.0, 1.0), YEL, (0, 0.6, 1.0), bev=0.12),
             box(coll, "engine", (1.6, 1.3, 0.9), YEL, (0, 1.4, 1.9), bev=0.1),
             box(coll, "seat", (0.6, 0.5, 0.2), sh.BLACK, (0, 0.2, 1.65)),
             box(coll, "canopy", (1.8, 1.6, 0.1), YEL, (0, 0.3, 3.0), bev=0.04),
             cyl(coll, "stack", 0.07, 0.07, 1.0, sh.DARK, (0.6, 1.8, 2.8), 8),
             box(coll, "yoke", (2.2, 0.3, 0.3), YEL, (0, -1.1, 1.3)),
             box(coll, "warnL", (0.18, 0.18, 0.18), mat("Neon_Amber", "#FFB300", emit=2.0), (0, 0.3, 3.12))]
    for s in (-1, 1):
        parts.append(limb(coll, "canopyPost", (s * 0.8, -0.35, 1.5), (s * 0.8, -0.35, 3.0), 0.04, sh.DARK))
        parts.append(limb(coll, "canopyPost", (s * 0.8, 0.95, 1.5), (s * 0.8, 0.95, 3.0), 0.04, sh.DARK))
        parts.append(box(coll, "yokeArm", (0.12, 0.9, 0.2), YEL, (s * 1.05, -1.5, 1.0)))
    bake(parts, "FootDozer_body", coll, parent=root)
    # the big roller drum up front (named Wheel_F so the game spins it) + rear wheels
    bake_at([cyl(coll, "drum", 0.75, 0.75, 1.9, GREY, (0, -1.9, 0.75), 24, "X"),
             cyl(coll, "drumCap", 0.3, 0.3, 1.96, YEL, (0, -1.9, 0.75), 12, "X"),
             box(coll, "drumMark", (1.92, 0.12, 1.4), GREY, (0, -1.9, 0.75))], "Wheel_F", coll, root, (0, -1.9, 0.75))
    for nm, x in (("Wheel_RL", 0.95), ("Wheel_RR", -0.95)):
        wheel(coll, root, nm, (x, 1.5, 0.6), 0.6, 0.45, sh.TIRE, YEL, sh.TIRE)
    return coll


# ── animals Lulu can pet (Leg_L/Leg_R/Body so people.js can walk them) ──
def critter_legs(coll, root, xs, hip_z, length, r, m, foot_m=None, y=0.0):
    for nm, x in (("Leg_L", xs), ("Leg_R", -xs)):
        hp = (x, y, hip_z)
        ps = [limb(coll, nm + "_l", (x, y, hip_z), (x, y, 0.03), r, m)]
        if foot_m:
            ps.append(sph(coll, nm + "_f", r * 2.2, foot_m, (x, y - r * 1.5, 0.02), ry=r * 3, rz=r * 0.8))
        bake_at(ps, nm, coll, root, hp)


def build_duck():
    coll = scene_coll("FootDuck")
    root = root_empty(coll, "FootDuck")
    WHITE = mat("DuckWhite", "#FAFAFA", rough=0.8)
    ORANGE = mat("DuckBill", "#FF9800", rough=0.5)
    EYE = mat("Eye", "#1B1B1B", rough=0.3)
    parts = [sph(coll, "body", 0.2, WHITE, (0, 0.02, 0.26), ry=0.28, rz=0.17),
             sph(coll, "tail", 0.08, WHITE, (0, 0.28, 0.33), ry=0.08, rz=0.05),
             sph(coll, "neck", 0.08, WHITE, (0, -0.18, 0.4), rz=0.12),
             sph(coll, "head", 0.11, WHITE, (0, -0.22, 0.55)),
             sph(coll, "bill", 0.06, ORANGE, (0, -0.34, 0.53), ry=0.08, rz=0.025)]
    for s in (-1, 1):
        parts.append(sph(coll, "wing", 0.05, mat("DuckWing", "#ECEFF1", rough=0.8), (s * 0.18, 0.05, 0.3), ry=0.2, rz=0.1))
        parts.append(sph(coll, "eye", 0.018, EYE, (s * 0.07, -0.29, 0.58)))
    bake(parts, "Body", coll, parent=root)
    critter_legs(coll, root, 0.07, 0.14, 0.14, 0.02, ORANGE, ORANGE)
    return coll


def build_raccoon():
    coll = scene_coll("FootRaccoon")
    root = root_empty(coll, "FootRaccoon")
    GREY = mat("RacGrey", "#8D8D8D", rough=0.9)
    DARK = mat("RacDark", "#3A3A3A", rough=0.9)
    LIGHT = mat("RacLight", "#E0E0E0", rough=0.9)
    EYE = mat("Eye", "#1B1B1B", rough=0.3)
    parts = [sph(coll, "body", 0.2, GREY, (0, 0.05, 0.3), ry=0.34, rz=0.2),
             sph(coll, "head", 0.15, GREY, (0, -0.33, 0.4), ry=0.14, rz=0.13),
             sph(coll, "mask", 0.155, DARK, (0, -0.35, 0.42), ry=0.1, rz=0.05),
             sph(coll, "snout", 0.06, LIGHT, (0, -0.47, 0.37), ry=0.07, rz=0.05),
             sph(coll, "nose", 0.02, EYE, (0, -0.53, 0.38))]
    for s in (-1, 1):
        parts.append(sph(coll, "ear", 0.05, DARK, (s * 0.09, -0.3, 0.54), ry=0.03, rz=0.06))
        parts.append(sph(coll, "eye", 0.02, mat("EyeShine", "#FFFFFF", rough=0.2), (s * 0.06, -0.47, 0.44)))
    for k in range(5):   # ringed tail
        parts.append(sph(coll, "tail", 0.07 - k * 0.006, DARK if k % 2 else GREY, (0, 0.38 + k * 0.1, 0.32 + k * 0.035), ry=0.06))
    bake(parts, "Body", coll, parent=root)
    critter_legs(coll, root, 0.1, 0.2, 0.2, 0.035, DARK, None, y=-0.05)
    return coll


def build_ostrich():
    coll = scene_coll("FootOstrich")
    root = root_empty(coll, "FootOstrich")
    BLACK = mat("OstFeather", "#2B2B2B", rough=0.95)
    WHITE = mat("OstWhite", "#F5F5F5", rough=0.9)
    PINK = mat("OstSkin", "#F4B6B0", rough=0.7)
    EYE = mat("Eye", "#1B1B1B", rough=0.3)
    parts = [sph(coll, "body", 0.45, BLACK, (0, 0.05, 1.15), ry=0.6, rz=0.42),
             sph(coll, "tailPuff", 0.3, WHITE, (0, 0.6, 1.3), ry=0.22, rz=0.25),
             limb(coll, "neck", (0, -0.4, 1.35), (0, -0.55, 2.15), 0.06, PINK),
             sph(coll, "head", 0.12, PINK, (0, -0.58, 2.22), ry=0.15),
             sph(coll, "beak", 0.06, mat("OstBeak", "#E0A060"), (0, -0.74, 2.19), ry=0.08, rz=0.03)]
    for s in (-1, 1):
        parts.append(sph(coll, "wing", 0.1, WHITE, (s * 0.42, 0.1, 1.2), ry=0.35, rz=0.2))
        parts.append(sph(coll, "eye", 0.03, EYE, (s * 0.08, -0.66, 2.27)))
    bake(parts, "Body", coll, parent=root)
    critter_legs(coll, root, 0.16, 0.85, 0.85, 0.045, PINK, PINK)
    return coll


# ── the wedding ──────────────────────────────────────────────────────────
def build_chuppah():
    coll = scene_coll("FootChuppah")
    root = root_empty(coll, "FootChuppah")
    BIRCH = mat("Birch", "#F1EDE4", rough=0.8)
    CLOTH = mat("ChuppahCloth", "#FFFDF7", rough=0.9)
    STRIPE = mat("TallitStripe", "#1E5AA8", rough=0.8)
    GREEN = mat("Greenery", "#4E8F5A", rough=0.85)
    ROSE = mat("Rose", "#FF80AB", rough=0.7)
    ROSE2 = mat("RoseWhite", "#FFF3F7", rough=0.7)
    CARPET = mat("Carpet", "#E9D7C1", rough=0.95)
    H, L = 2.75, 1.45
    parts = [box(coll, "platform", (3.4, 3.4, 0.2), mat("PlatformWood", "#C8A27A", rough=0.8), (0, 0, 0.1), bev=0.04),
             box(coll, "carpet", (2.8, 2.8, 0.03), CARPET, (0, 0, 0.215)),
             box(coll, "canopy", (3.2, 3.2, 0.06), CLOTH, (0, 0, H + 0.05))]
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(cyl(coll, "post", 0.07, 0.07, H, BIRCH, (sx * L, sy * L, H / 2 + 0.2), 10))
            # flowers wound round each post + a cluster at the top corner
            for k in range(5):
                parts.append(Part(coll, "wind", bm_ico(0.09 if k % 2 else 0.07), ROSE if k % 2 else GREEN,
                                  loc=(sx * L + 0.07 * math.cos(k * 1.7), sy * L + 0.07 * math.sin(k * 1.7), 0.6 + k * 0.45), smooth=False))
            for k in range(6):
                parts.append(Part(coll, "cluster", bm_ico(0.13 + 0.03 * (k % 2)), (ROSE, ROSE2, GREEN)[k % 3],
                                  loc=(sx * L + 0.15 * math.cos(k), sy * L + 0.15 * math.sin(k), H + 0.18 + 0.05 * (k % 2)), smooth=False))
    # the valance: a tallit-white drape with blue stripes hanging round the edges
    for (dx, dy, w_, d_) in ((0, -1.6, 3.2, 0.04), (0, 1.6, 3.2, 0.04), (-1.6, 0, 0.04, 3.2), (1.6, 0, 0.04, 3.2)):
        parts.append(box(coll, "drape", (w_, d_, 0.42), CLOTH, (dx, dy, H - 0.16)))
        parts.append(box(coll, "stripe", (w_ + 0.01 if w_ > 1 else 0.05, d_ + 0.01 if d_ > 1 else 0.05, 0.06), STRIPE, (dx, dy, H - 0.1)))
        parts.append(box(coll, "stripe", (w_ + 0.01 if w_ > 1 else 0.05, d_ + 0.01 if d_ > 1 else 0.05, 0.04), STRIPE, (dx, dy, H - 0.22)))
    # a little table with the kiddush cup
    parts.append(cyl(coll, "table", 0.35, 0.35, 0.05, CLOTH, (0.9, 0.9, 1.0), 16))
    parts.append(cyl(coll, "tableLeg", 0.04, 0.04, 0.8, BIRCH, (0.9, 0.9, 0.6), 8))
    parts.append(cyl(coll, "cup", 0.05, 0.03, 0.14, mat("Silver", "#D7DCE0", rough=0.2, metal=0.9), (0.9, 0.9, 1.1), 10))
    bake(parts, "FootChuppah_body", coll, parent=root)
    return coll


def build_chair():
    coll = scene_coll("FootChair")
    root = root_empty(coll, "FootChair")
    WHITE = mat("ChairWhite", "#FAF7F0", rough=0.5)
    GOLD = mat("ChairGold", "#D4AF37", rough=0.3, metal=0.7)
    parts = [box(coll, "seat", (0.44, 0.42, 0.05), WHITE, (0, 0, 0.46), bev=0.015),
             box(coll, "cushion", (0.4, 0.38, 0.04), GOLD, (0, 0, 0.5), bev=0.012)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(cyl(coll, "leg", 0.018, 0.015, 0.46, WHITE, (sx * 0.19, sy * 0.18, 0.23), 6))
        parts.append(cyl(coll, "backPost", 0.018, 0.018, 0.5, WHITE, (sx * 0.19, 0.19, 0.72), 6))
    for k in range(3):
        parts.append(box(coll, "rung", (0.36, 0.025, 0.03), WHITE, (0, 0.19, 0.6 + k * 0.14)))
    bake(parts, "FootChair_body", coll, parent=root)
    return coll


def build_flowers():
    coll = scene_coll("FootFlowers")
    root = root_empty(coll, "FootFlowers")
    WHITE = mat("UrnWhite", "#FAF7F0", rough=0.5)
    parts = [cyl(coll, "stand", 0.06, 0.06, 0.9, WHITE, (0, 0, 0.45), 8),
             cyl(coll, "foot", 0.2, 0.22, 0.06, WHITE, (0, 0, 0.03), 12),
             cyl(coll, "bowl", 0.22, 0.12, 0.18, WHITE, (0, 0, 0.98), 14)]
    cols = ("#FF80AB", "#FFF3F7", "#F8BBD0", "#FFD54F")
    for k in range(9):
        a = k * 2.4
        rr = 0.05 + 0.14 * ((k * 37) % 10) / 10
        parts.append(Part(coll, "bloom", bm_ico(0.08), mat("Bloom%d" % (k % 4), cols[k % 4], rough=0.7),
                          loc=(rr * math.cos(a), rr * math.sin(a), 1.13 + 0.04 * (k % 3)), smooth=False))
    for k in range(4):
        parts.append(Part(coll, "leaf", bm_sphere(0.05, 0.12, 0.02, 8, 4), mat("Greenery", "#4E8F5A", rough=0.85),
                          loc=(0.18 * math.cos(k * 1.6), 0.18 * math.sin(k * 1.6), 1.05), rot=(0, 0, k * 1.6)))
    bake(parts, "FootFlowers_body", coll, parent=root)
    return coll


def build_bouquet():
    coll = scene_coll("FootBouquet")
    root = root_empty(coll, "FootBouquet")
    parts = [cyl(coll, "stems", 0.035, 0.02, 0.22, mat("Stem", "#558B2F"), (0, 0, 0.0), 8),
             cyl(coll, "ribbon", 0.045, 0.045, 0.06, mat("Ribbon", "#FFFFFF", rough=0.5), (0, 0, 0.02), 10)]
    cols = ("#FF80AB", "#FFFFFF", "#F8BBD0", "#FF4081")
    for k in range(10):
        a = k * 2.3
        rr = 0.03 + 0.07 * ((k * 53) % 10) / 10
        parts.append(Part(coll, "rose", bm_ico(0.045), mat("BRose%d" % (k % 4), cols[k % 4], rough=0.7),
                          loc=(rr * math.cos(a), rr * math.sin(a), 0.14 + 0.02 * (k % 3)), smooth=False))
    bake(parts, "FootBouquet_body", coll, parent=root)
    return coll


def build_glass():
    coll = scene_coll("FootGlass")
    root = root_empty(coll, "FootGlass")
    parts = [Part(coll, "napkin", bm_sphere(0.11, 0.11, 0.07, 12, 8), mat("Napkin", "#FFFFFF", rough=0.9), loc=(0, 0, 0.06)),
             cyl(coll, "glass", 0.05, 0.03, 0.1, mat("Glass", "#E1F5FE", rough=0.05), (0, 0, 0.14), 10),
             Part(coll, "knot", bm_ico(0.04), mat("Napkin", "#FFFFFF"), loc=(0, 0, 0.18), smooth=False)]
    bake(parts, "FootGlass_body", coll, parent=root)
    return coll


def build_fiddle():
    coll = scene_coll("FootFiddle")
    root = root_empty(coll, "FootFiddle")
    WOOD = mat("Fiddle", "#A0522D", rough=0.35)
    BLACK = mat("FiddleBlack", "#1B1B1B", rough=0.4)
    parts = [sph(coll, "lower", 0.11, WOOD, (0, 0.06, 0), ry=0.1, rz=0.035),
             sph(coll, "upper", 0.09, WOOD, (0, -0.1, 0), ry=0.08, rz=0.033),
             box(coll, "neck", (0.035, 0.22, 0.025), BLACK, (0, -0.28, 0.02)),
             Part(coll, "scroll", bm_torus(0.022, 0.009, 10, 4), WOOD, loc=(0, -0.4, 0.02), rot=(0, math.pi / 2, 0)),
             box(coll, "tailpiece", (0.04, 0.08, 0.02), BLACK, (0, 0.12, 0.03)),
             limb(coll, "bow", (-0.25, -0.15, 0.08), (0.3, 0.12, 0.08), 0.006, mat("Bow", "#5D4037"))]
    bake(parts, "FootFiddle_body", coll, parent=root)
    return coll


# ── people only this feature uses ────────────────────────────────────────
def build_bride():
    # Avigail as a kallah: same hair/skin as the shared avigailPerson, all in white.
    return build_person("FootBride", dict(hair="long", hair_color="#1A1A1A", skin="#C68642", top="#FFFFFF",
                        bottom="dress", shoes="#FFFFFF", sleeves="long",
                        extras=["veil", "tiara", "earrings", "necklace"],
                        extra_colors={"Gold": "#FFD700", "Veil": "#FFFFFF", "Tiara": "#E8E8F0"}))


def build_aviel():
    # Aviel, the very nervous chosson: white shirt, black vest + bow tie, white kippah.
    return build_person("FootAviel", dict(hair="short", hair_color="#3E2723", top="#FAFAFA", bottom="pants",
                        bottom_color="#212121", shoes="#111111", extras=["kippah", "vest", "bowtie", "mustache"],
                        extra_colors={"Kippah": "#FFFFFF", "Vest": "#212121", "Tie": "#111111", "Beard": "#3E2723"}))


def build_rabbi():
    return build_person("FootRabbi", dict(hair="short", hair_color="#BDBDBD", top="#1A1A1A", bottom="pants",
                        bottom_color="#1A1A1A", shoes="#111111", width=1.08,
                        extras=["fedora", "beard", "glasses", "tzitzit"],
                        extra_colors={"Hat": "#111111", "HatBand": "#333333", "Beard": "#E0E0E0"}))


def build_fiddler():
    return build_person("FootFiddler", dict(hair="curly", hair_color="#4E342E", top="#FAFAFA", bottom="pants",
                        bottom_color="#5D4037", shoes="#3E2723", extras=["cap", "vest", "mustache"],
                        extra_colors={"Hat": "#37474F", "Vest": "#B71C1C", "Beard": "#4E342E"}))


ASSETS = [
    ("foot_bar", build_bar),
    ("foot_school", build_school),
    ("foot_hospital", build_hospital),
    ("foot_police", build_police),
    ("foot_beach", build_beach_gate),
    ("foot_lamp", build_lamp),
    ("foot_bench", build_bench),
    ("foot_planter", build_planter),
    ("foot_booth", build_booth),
    ("foot_ambulance", build_ambulance),
    ("foot_bus", build_bus),
    ("foot_dozer", build_dozer),
    ("foot_duck", build_duck),
    ("foot_raccoon", build_raccoon),
    ("foot_ostrich", build_ostrich),
    ("foot_chuppah", build_chuppah),
    ("foot_chair", build_chair),
    ("foot_flowers", build_flowers),
    ("foot_bouquet", build_bouquet),
    ("foot_glass", build_glass),
    ("foot_fiddle", build_fiddle),
    ("foot_bride", build_bride),
    ("foot_aviel", build_aviel),
    ("foot_rabbi", build_rabbi),
    ("foot_fiddler", build_fiddler),
]
