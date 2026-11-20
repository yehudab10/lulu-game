"""
Places (features/places): the town's civic buildings — roadmap step 4, "jail, court and the
ER are real places in town". Every exterior is a town LANDMARK placed by the town's `uses`
data (features/town/towns/<id>.js) and merged by kit.js like any other building, so they
cost ~0 extra draw calls; keep them LOW-POLY (the town has a triangle budget). Tintable
materials: Walls / Trim / Roof / Accent (+ NeonGlobe, the lamps: blue in Lakewood, green in
Midwood). Signs come from the town's sign atlas at Anchor_sign. Front = -Y (= +Z in three.js);
the origin is the centre of the main body at ground level (the town's DIMS prot = how far the
steps / canopy stick out in front of the body).

    places_precinct    a two-storey brick police station: stone base, steps, double doors,
                       barred windows downstairs, two globe lamps, a flag. Anchor_sign, Anchor_door.
    places_court       a classical courthouse: wide steps, six columns, a pediment with gold
                       scales, tall windows. Anchor_sign (the frieze), Anchor_door.
    places_hospital    a three-storey clinic block: ribbon windows, an entrance canopy with a
                       glowing red cross, an ambulance bay on its right with an ambulance in it.
                       Anchor_sign, Anchor_door, Anchor_bay.
    places_impound     the precinct's fenced lot: slatted fence, a rolling gate, two parked
                       cruisers (light bars lit), a sign board. Anchor_sign, Anchor_gate, Anchor_car
                       (where an impounded car is shown).
    places_courtlobby  the courthouse LOBBY interior set (interiors engine: Spot_ / Col_ /
                       Light_ / Fx_ anchors): the metal detector, the clerk's window, the docket
                       board, the bench, the locked doors of Courtroom 2B, a water fountain.
"""
from lib import *
from assets_interiors import SetBuilder, shell, tiles, wainscot, door, bm_text_lo


def P(coll, name, bm, m, loc, rot=(0, 0, 0)):
    return Part(coll, name, bm, m, loc=loc, rot=rot, smooth=False)


def windows_row(coll, parts, xs, y, z, w, h, frame, glass):
    for x in xs:
        parts.append(P(coll, "wf", bm_box(w + 0.24, 0.1, h + 0.24), frame, (x, y - 0.02, z)))
        parts.append(P(coll, "wg", bm_box(w, 0.12, h), glass, (x, y - 0.05, z)))


# ══════════════════════════════ the precinct ═══════════════════════════════
def build_precinct():
    coll = scene_coll("PlacesPrecinct")
    root = root_empty(coll, "PlacesPrecinct")
    WALL = mat("Walls", "#9E5A43", rough=0.9)          # brick (tinted per town)
    TRIM = mat("Trim", "#D9D4C7", rough=0.85)          # limestone
    ROOF = mat("Roof", "#3A3D42", rough=0.95)
    DOOR = mat("Accent", "#1A237E", rough=0.5)
    WIN = mat("Window", "#9AD3EE", rough=0.15, emit=0.25)
    GLOBE = mat("NeonGlobe", "#4FA3FF", rough=0.3, emit=2.2)
    DARK = mat("Iron", "#2B2F33", rough=0.6)
    FLAG = mat("FlagBlue", "#1A237E", rough=0.8)
    FLAGW = mat("FlagWhite", "#F5F5F5", rough=0.8)
    STEP = mat("Concrete", "#C9C4B8", rough=0.95)
    w, d, h = 15.0, 12.0, 7.6
    fy = -d / 2
    parts = [P(coll, "body", bm_box(w, d, h), WALL, (0, 0, h / 2)),
             P(coll, "base", bm_box(w + 0.2, d + 0.2, 0.9), TRIM, (0, 0, 0.45)),
             P(coll, "band", bm_box(w + 0.12, d + 0.12, 0.3), TRIM, (0, 0, 3.75)),
             P(coll, "cornice", bm_box(w + 0.5, d + 0.5, 0.45), TRIM, (0, 0, h + 0.22)),
             P(coll, "roof", bm_box(w - 0.3, d - 0.3, 0.4), ROOF, (0, 0, h + 0.4))]
    # the entrance bay: a stone surround, a pediment-ish lintel, double doors, the sign band above
    parts.append(P(coll, "surround", bm_box(4.4, 0.5, 4.6), TRIM, (0, fy - 0.25, 2.3)))
    parts.append(P(coll, "lintel", bm_box(5.0, 0.7, 0.5), TRIM, (0, fy - 0.35, 4.75)))
    for s in (-1, 1):
        parts.append(P(coll, "door", bm_box(1.25, 0.12, 2.7), DOOR, (s * 0.66, fy - 0.55, 2.25)))
        parts.append(P(coll, "doorwin", bm_box(0.7, 0.14, 0.9), WIN, (s * 0.66, fy - 0.57, 2.85)))
    parts.append(P(coll, "transom", bm_box(2.6, 0.14, 0.5), WIN, (0, fy - 0.57, 3.9)))
    parts.append(P(coll, "signband", bm_box(9.6, 0.2, 1.0), TRIM, (0, fy - 0.1, 5.65)))
    # steps up to the doors (the base is 0.9 m high)
    for k in range(4):
        parts.append(P(coll, "step", bm_box(5.6 - k * 0.3, 2.4 - k * 0.55, 0.225), STEP, (0, fy - 1.25 + k * 0.27, 0.11 + k * 0.225)))
    # windows: barred downstairs, plain upstairs
    xs = (-5.6, -3.3, 3.3, 5.6)
    windows_row(coll, parts, xs, fy, 2.35, 1.3, 1.6, TRIM, WIN)
    windows_row(coll, parts, (-5.6, -3.3, 3.3, 5.6), fy, 5.95, 1.3, 1.5, TRIM, WIN)
    for x in xs:
        for b in range(3):
            parts.append(P(coll, "bar", bm_box(0.05, 0.06, 1.6), DARK, (x - 0.38 + b * 0.38, fy - 0.12, 2.35)))
    # the two globe lamps either side of the steps
    for s in (-1, 1):
        parts.append(P(coll, "lamppost", bm_cyl(0.07, 0.09, 2.4, 6), DARK, (s * 3.2, fy - 1.6, 1.2)))
        parts.append(P(coll, "globe", bm_sphere(0.3, u=8, v=6), GLOBE, (s * 3.2, fy - 1.6, 2.6)))
    # the flag on a pole off the corner
    parts.append(P(coll, "flagpole", bm_cyl(0.06, 0.05, 9.0, 6), DARK, (-w / 2 + 0.6, fy - 1.8, 4.5)))
    parts.append(P(coll, "flag", bm_box(0.04, 1.6, 1.0), FLAG, (-w / 2 + 0.6, fy - 2.65, 8.4)))
    parts.append(P(coll, "flagstripe", bm_box(0.05, 1.6, 0.25), FLAGW, (-w / 2 + 0.6, fy - 2.65, 8.4)))
    # a side garage (the sally port) on the right end
    parts.append(P(coll, "garage", bm_box(3.2, 0.12, 2.8), mat("GarageDoor", "#7D8288", rough=0.7), (w / 2 - 2.2, fy - 0.06, 1.4)))
    bake(parts, "PlacesPrecinct_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, fy - 0.25, 5.65))
    anchor(coll, root, "Anchor_door", (0, fy - 2.4, 0))
    return coll


# ═════════════════════════════ the courthouse ══════════════════════════════
def build_court():
    coll = scene_coll("PlacesCourt")
    root = root_empty(coll, "PlacesCourt")
    WALL = mat("Walls", "#E4DCC8", rough=0.85)          # limestone / stucco
    TRIM = mat("Trim", "#F7F3EA", rough=0.7)
    ROOF = mat("Roof", "#5B6B7A", rough=0.85)
    COL = mat("Column", "#FBF8F0", rough=0.6)
    DOOR = mat("Accent", "#6D4C2E", rough=0.45)
    WIN = mat("Window", "#8FCDEB", rough=0.15, emit=0.2)
    GOLD = mat("Gold", "#E8B923", rough=0.35, metal=0.7)
    STEP = mat("Concrete", "#D2CCBF", rough=0.95)
    w, d, h = 18.0, 14.0, 8.6
    fy = -d / 2
    parts = [P(coll, "body", bm_box(w, d, h), WALL, (0, 0, h / 2)),
             P(coll, "base", bm_box(w + 0.3, d + 0.3, 0.7), TRIM, (0, 0, 0.35)),
             P(coll, "cornice", bm_box(w + 0.6, d + 0.6, 0.5), TRIM, (0, 0, h + 0.25)),
             P(coll, "roof", bm_box(w - 0.4, d - 0.4, 0.5), ROOF, (0, 0, h + 0.55)),
             P(coll, "attic", bm_box(w * 0.55, d * 0.55, 1.2), WALL, (0, 0.8, h + 1.1))]
    # the portico: wide steps, six columns, an entablature (the sign), a pediment with the scales
    pw = 13.6
    for k in range(4):
        parts.append(P(coll, "step", bm_box(pw + 1.6 - k * 0.4, 3.4 - k * 0.6, 0.2), STEP, (0, fy - 1.9 + k * 0.3, 0.1 + k * 0.2)))
    for k in range(6):
        x = -pw / 2 + 0.9 + k * (pw - 1.8) / 5
        parts.append(P(coll, "col", bm_cyl(0.4, 0.34, 5.6, 10), COL, (x, fy - 2.4, 3.6)))
        parts.append(P(coll, "cap", bm_box(0.95, 0.95, 0.25), TRIM, (x, fy - 2.4, 6.5)))
        parts.append(P(coll, "plinth", bm_box(0.9, 0.9, 0.2), TRIM, (x, fy - 2.4, 0.9)))
    parts.append(P(coll, "porchfloor", bm_box(pw, 3.0, 0.2), STEP, (0, fy - 1.5, 0.7)))
    parts.append(P(coll, "porchroof", bm_box(pw + 0.4, 3.4, 0.35), TRIM, (0, fy - 1.6, 6.75)))
    parts.append(P(coll, "entab", bm_box(pw + 0.4, 0.5, 1.2), TRIM, (0, fy - 3.1, 7.3)))
    ped = bm_prism([(-pw / 2 - 0.3, 0.0), (pw / 2 + 0.3, 0.0), (0.0, 2.3)], 0.5)
    parts.append(P(coll, "pediment", ped, TRIM, (0, fy - 2.9, 7.9), (0, 0, math.pi / 2)))
    # the scales of justice in gold on the pediment
    parts.append(P(coll, "beam", bm_box(1.6, 0.08, 0.08), GOLD, (0, fy - 3.45, 8.85)))
    parts.append(P(coll, "post", bm_box(0.08, 0.08, 0.8), GOLD, (0, fy - 3.45, 8.55)))
    for s in (-1, 1):
        parts.append(P(coll, "pan", bm_cyl(0.28, 0.16, 0.12, 8), GOLD, (s * 0.75, fy - 3.45, 8.45)))
    # tall bronze doors under a fanlight, tall windows either side
    parts.append(P(coll, "doorframe", bm_box(3.2, 0.2, 4.0), TRIM, (0, fy - 0.08, 2.75)))
    for s in (-1, 1):
        parts.append(P(coll, "door", bm_box(1.3, 0.14, 3.4), DOOR, (s * 0.7, fy - 0.15, 2.45)))
    parts.append(P(coll, "fan", bm_box(2.6, 0.14, 0.5), WIN, (0, fy - 0.16, 4.45)))
    windows_row(coll, parts, (-5.0, -2.9, 2.9, 5.0), fy, 3.4, 1.1, 3.0, TRIM, WIN)
    windows_row(coll, parts, (-8.0, 8.0), fy, 3.4, 1.1, 3.0, TRIM, WIN)
    bake(parts, "PlacesCourt_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, fy - 3.37, 7.3))
    anchor(coll, root, "Anchor_door", (0, fy - 3.6, 0))
    return coll


# ══════════════════════════════ the hospital ═══════════════════════════════
def ambulance(coll, parts, x, y, rot):
    """A low-poly ambulance (box van) parked at (x, y), nose toward rot."""
    WHITE = mat("AmbWhite", "#F7F7F5", rough=0.5)
    STRIPE = mat("AmbStripe", "#F4511E", rough=0.5)
    RED = mat("AmbCross", "#D32F2F", rough=0.5)
    GLASS = mat("AmbGlass", "#2B3A42", rough=0.1)
    TIRE = mat("Tire", "#262626", rough=0.9)
    LIGHT = mat("NeonAmbLight", "#FF5252", rough=0.3, emit=2.0)
    c, s = math.cos(rot), math.sin(rot)

    def at(lx, ly):
        return (x + lx * c - ly * s, y + lx * s + ly * c)

    def add(name, bm, m, lx, ly, z):
        px, py = at(lx, ly)
        parts.append(P(coll, name, bm, m, (px, py, z), (0, 0, rot)))
    add("box", bm_box(2.2, 3.8, 2.4), WHITE, 0, 0.9, 1.6)
    add("cab", bm_box(2.1, 1.9, 1.6), WHITE, 0, -1.9, 1.2)
    add("hood", bm_box(2.0, 0.6, 0.8), WHITE, 0, -3.0, 0.8)
    add("wind", bm_box(1.9, 0.08, 0.7), GLASS, 0, -2.86, 1.6)
    add("stripe", bm_box(2.24, 5.6, 0.3), STRIPE, 0, 0.0, 1.25)
    add("crossV", bm_box(2.26, 0.25, 0.8), RED, 0, 1.2, 2.2)
    add("crossH", bm_box(2.26, 0.8, 0.25), RED, 0, 1.2, 2.2)
    add("bar", bm_box(1.4, 0.3, 0.18), LIGHT, 0, -1.6, 2.1)
    for lx in (-1.0, 1.0):
        for ly in (-2.2, 1.9):
            add("tire", bm_cyl(0.42, 0.42, 0.3, 8, "X"), TIRE, lx, ly, 0.42)


def build_hospital():
    coll = scene_coll("PlacesHospital")
    root = root_empty(coll, "PlacesHospital")
    WALL = mat("Walls", "#EEF2F1", rough=0.85)
    TRIM = mat("Trim", "#00897B", rough=0.55)          # the teal bands (tinted per town)
    ROOF = mat("Roof", "#3A3A3A", rough=0.95)
    WIN = mat("Window", "#8CCBE6", rough=0.1, emit=0.25)
    RED = mat("NeonCross", "#FF3B3B", rough=0.4, emit=1.8)
    CANOPY = mat("Canopy", "#FAFAFA", rough=0.5)
    STEEL = mat("Steel", "#B0BEC5", rough=0.4, metal=0.5)
    DOOR = mat("DoorGlass", "#BFE7F5", rough=0.05, emit=0.15)
    CONC = mat("Concrete", "#C9C6BE", rough=0.95)
    w, d, h = 22.0, 14.0, 10.8
    fy = -d / 2
    parts = [P(coll, "body", bm_box(w, d, h), WALL, (0, 0, h / 2)),
             P(coll, "base", bm_box(w + 0.2, d + 0.2, 0.6), TRIM, (0, 0, 0.3)),
             P(coll, "roofband", bm_box(w + 0.3, d + 0.3, 0.5), TRIM, (0, 0, h + 0.25)),
             P(coll, "roof", bm_box(w - 0.3, d - 0.3, 0.3), ROOF, (0, 0, h + 0.3)),
             P(coll, "plant", bm_box(4.0, 3.0, 1.6), STEEL, (4.0, 1.5, h + 0.9))]
    # three ribbon windows with a teal sill band under each
    for z in (3.0, 6.0, 9.0):
        parts.append(P(coll, "ribbon", bm_box(w - 1.6, 0.12, 1.3), WIN, (0, fy - 0.04, z)))
        parts.append(P(coll, "sill", bm_box(w - 1.2, 0.2, 0.16), TRIM, (0, fy - 0.08, z - 0.75)))
    # the entrance: sliding glass doors under a canopy on two posts, a big glowing cross on the canopy
    parts.append(P(coll, "doorframe", bm_box(4.0, 0.16, 2.8), TRIM, (-3.0, fy - 0.08, 1.4)))
    parts.append(P(coll, "doors", bm_box(3.4, 0.18, 2.5), DOOR, (-3.0, fy - 0.1, 1.25)))
    parts.append(P(coll, "canopy", bm_box(6.0, 3.0, 0.3), CANOPY, (-3.0, fy - 1.5, 3.4)))
    parts.append(P(coll, "fascia", bm_box(6.1, 0.15, 0.55), TRIM, (-3.0, fy - 3.0, 3.4)))
    for s in (-1, 1):
        parts.append(P(coll, "post", bm_cyl(0.12, 0.12, 3.3, 6), STEEL, (-3.0 + s * 2.6, fy - 2.7, 1.65)))
    parts.append(P(coll, "crossV", bm_box(0.45, 0.2, 1.5), RED, (-3.0, fy - 1.5, 4.4)))
    parts.append(P(coll, "crossH", bm_box(1.5, 0.2, 0.45), RED, (-3.0, fy - 1.5, 4.4)))
    # the sign band up top (the town's sign goes here) + a cross at the corner
    parts.append(P(coll, "signband", bm_box(12.0, 0.2, 1.2), TRIM, (-1.0, fy - 0.12, h - 0.5)))
    parts.append(P(coll, "cross2V", bm_box(0.5, 0.2, 1.6), RED, (w / 2 - 1.4, fy - 0.12, h - 0.5)))
    parts.append(P(coll, "cross2H", bm_box(1.6, 0.2, 0.5), RED, (w / 2 - 1.4, fy - 0.12, h - 0.5)))
    # the ambulance bay at the right end: a deep canopy, EMERGENCY over it, an ambulance backed in
    bx = w / 2 - 4.2
    parts.append(P(coll, "baydoor", bm_box(4.4, 0.14, 3.2), STEEL, (bx, fy - 0.07, 1.6)))
    parts.append(P(coll, "baycanopy", bm_box(6.4, 4.0, 0.3), CANOPY, (bx, fy - 2.0, 4.3)))
    parts.append(P(coll, "bayedge", bm_box(6.5, 0.15, 0.6), mat("NeonEmergency", "#FF5252", rough=0.3, emit=1.6), (bx, fy - 4.0, 4.3)))
    for s in (-1, 1):
        parts.append(P(coll, "baypost", bm_cyl(0.14, 0.14, 4.2, 6), STEEL, (bx + s * 3.0, fy - 3.8, 2.1)))
    parts.append(P(coll, "apron", bm_box(6.4, 4.2, 0.06), CONC, (bx, fy - 2.1, 0.03)))
    ambulance(coll, parts, bx, fy - 2.4, math.pi)
    # benches + a planter by the door
    parts.append(P(coll, "bench", bm_box(2.0, 0.5, 0.45), mat("Bench", "#8D6E63", rough=0.7), (-7.6, fy - 1.0, 0.45)))
    parts.append(P(coll, "planter", bm_box(1.4, 1.4, 0.6), CONC, (-9.6, fy - 1.0, 0.3)))
    parts.append(P(coll, "shrub", bm_sphere(0.75, u=8, v=5), mat("Leaves", "#6CC24A", rough=0.85), (-9.6, fy - 1.0, 1.1)))
    bake(parts, "PlacesHospital_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (-1.0, fy - 0.24, h - 0.5))
    anchor(coll, root, "Anchor_door", (-3.0, fy - 2.6, 0))
    anchor(coll, root, "Anchor_bay", (bx, fy - 5.0, 0))
    return coll


# ═════════════════════════════ the impound lot ═════════════════════════════
def cruiser(coll, parts, x, y, rot):
    """A low-poly parked police cruiser (black & white, the bar lit red / blue)."""
    BLK = mat("CruiserBlack", "#1E2226", rough=0.45)
    WHT = mat("CruiserWhite", "#F4F4F2", rough=0.45)
    GLASS = mat("CruiserGlass", "#2B3A42", rough=0.1)
    TIRE = mat("Tire", "#262626", rough=0.9)
    RED = mat("NeonBarRed", "#FF3D3D", rough=0.3, emit=2.0)
    BLUE = mat("NeonBarBlue", "#3D8BFF", rough=0.3, emit=2.0)
    c, s = math.cos(rot), math.sin(rot)

    def add(name, bm, m, lx, ly, z):
        parts.append(P(coll, name, bm, m, (x + lx * c - ly * s, y + lx * s + ly * c, z), (0, 0, rot)))
    add("lower", bm_box(1.9, 4.7, 0.6), BLK, 0, 0, 0.6)
    add("doors", bm_box(1.94, 2.2, 0.5), WHT, 0, 0.1, 0.62)
    add("cabin", bm_box(1.7, 2.4, 0.6), WHT, 0, 0.2, 1.2)
    add("glass", bm_box(1.72, 2.0, 0.42), GLASS, 0, 0.2, 1.22)
    add("barR", bm_box(0.6, 0.3, 0.16), RED, -0.32, 0.25, 1.58)
    add("barB", bm_box(0.6, 0.3, 0.16), BLUE, 0.32, 0.25, 1.58)
    for lx in (-0.9, 0.9):
        for ly in (-1.5, 1.5):
            add("tire", bm_cyl(0.36, 0.36, 0.26, 8, "X"), TIRE, lx, ly, 0.36)


def build_impound():
    coll = scene_coll("PlacesImpound")
    root = root_empty(coll, "PlacesImpound")
    POST = mat("Iron", "#2B2F33", rough=0.6)
    SLAT = mat("Accent", "#2E5E4E", rough=0.85)        # the privacy slats (tinted per town)
    TRIM = mat("Trim", "#D9D4C7", rough=0.85)
    ASPH = mat("Asphalt", "#55585D", rough=0.95)
    PAINT = mat("LotPaint", "#EDEDE6", rough=0.8)
    w, d = 12.0, 12.0
    fy = -d / 2
    parts = [P(coll, "lot", bm_box(w, d, 0.06), ASPH, (0, 0, 0.03))]
    # the fence: back + sides solid slats, the front a low wall + slats with a rolling gate in the middle
    hf = 2.2
    parts.append(P(coll, "back", bm_box(w, 0.08, hf), SLAT, (0, d / 2, hf / 2)))
    for s in (-1, 1):
        parts.append(P(coll, "side", bm_box(0.08, d, hf), SLAT, (s * w / 2, 0, hf / 2)))
        parts.append(P(coll, "front", bm_box(w / 2 - 2.2, 0.08, hf), SLAT, (s * (w / 4 + 1.1), fy, hf / 2)))
    parts.append(P(coll, "gate", bm_box(4.4, 0.06, hf - 0.4), mat("GateMesh", "#8A9096", rough=0.5, metal=0.4), (0, fy - 0.12, (hf - 0.4) / 2 + 0.1)))
    for x in (-w / 2, -w / 4, -2.2, 2.2, w / 4, w / 2):
        parts.append(P(coll, "post", bm_cyl(0.06, 0.06, hf + 0.3, 6), POST, (x, fy, (hf + 0.3) / 2)))
    for x in (-w / 2, 0, w / 2):
        parts.append(P(coll, "bpost", bm_cyl(0.06, 0.06, hf + 0.3, 6), POST, (x, d / 2, (hf + 0.3) / 2)))
    # a sign board on two legs over the gate
    parts.append(P(coll, "signboard", bm_box(5.0, 0.12, 1.0), TRIM, (0, fy - 0.2, hf + 0.9)))
    for s in (-1, 1):
        parts.append(P(coll, "leg", bm_box(0.12, 0.12, hf + 0.5), POST, (s * 2.3, fy - 0.2, (hf + 0.5) / 2)))
    # bays: painted lines, two cruisers nose-in (the left bay is where an impounded car is shown)
    for x in (-3.0, 0.0, 3.0):
        parts.append(P(coll, "line", bm_box(0.12, 5.0, 0.01), PAINT, (x, d / 2 - 3.0, 0.065)))
    cruiser(coll, parts, 1.5, d / 2 - 3.0, 0)
    cruiser(coll, parts, 4.5, d / 2 - 3.0, 0)
    bake(parts, "PlacesImpound_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, fy - 0.3, hf + 0.9))
    anchor(coll, root, "Anchor_gate", (0, fy - 1.4, 0))
    anchor(coll, root, "Anchor_car", (-3.0 + 1.5, d / 2 - 3.0, 0))
    return coll


# ═══════════════════════════ the courthouse lobby ══════════════════════════
def build_court_lobby():
    S = SetBuilder("PlacesCourtLobby")
    W, D, H = 14.0, 9.0, 4.6
    FLOOR = mat("CLFloor", "#E9E3D6", 0.35)
    TILE = mat("CLTile", "#B7AD99", 0.35)
    WALL = mat("CLWall", "#D9CDB4", 0.9)
    WAIN = mat("CLWainscot", "#6D4C41", 0.55)
    RAIL = mat("CLRail", "#C9A86A", 0.4, 0.5)
    CAP = mat("CLCap", "#4E342E", 0.8)
    LIP = mat("CLLip", "#5D4037", 0.8)
    WOOD = mat("CLWood", "#7B4A2A", 0.5)
    WOODT = mat("CLWoodTop", "#A1887F", 0.35)
    BRASS = mat("CLBrass", "#D4AF37", 0.3, 0.8)
    GOLDT = mat("CLGoldText", "#FFD54F", 0.4, emit=0.8)
    SIGN = mat("CLSign", "#2B1B10", 0.6)
    GLASS = mat("GlassCL", "#BFE6F7", 0.05)
    METAL = mat("CLMetal", "#B0BEC5", 0.3, 0.7)
    DARKM = mat("CLDarkMetal", "#455A64", 0.4, 0.5)
    PANEL = mat("NeonTube", "#FFF8E7", 0.5, emit=2.2)
    CORK = mat("CLCork", "#C8A165", 0.9)
    PAPER = mat("CLPaper", "#FFF8E1", 0.8)
    DOOR = mat("CLDoor", "#5D4037", 0.5, 0.2)
    KNOB = mat("CLKnob", "#ECEFF1", 0.2, 0.8)
    EXITR = mat("NeonExitRed", "#FF5252", 0.3, emit=3.0)
    REDL = mat("NeonDetRed", "#FF5252", 0.3, emit=2.0)
    GREENL = mat("NeonDetGreen", "#69F0AE", 0.3, emit=2.0)
    FLAGB = mat("CLFlagBlue", "#1A237E", 0.8)
    FLAGR = mat("CLFlagRed", "#C62828", 0.8)
    PLANT = mat("CLPlant", "#43A047", 0.85)
    POT = mat("CLPot", "#BF6B3A", 0.8)

    shell(S, W, D, H, FLOOR, WALL, CAP, LIP)
    tiles(S, W, D, 1.0, FLOOR, TILE)
    wainscot(S, W, D, 1.2, WAIN, RAIL, gap=(-1.6, 1.6))
    for k, x in enumerate((-3.8, 3.8)):
        S.box(2.4, 0.25, 0.08, PANEL, x, 0.0, H - 0.4)
        S.light("tube%d" % k, x, 0.0, H - 0.8)

    # Courtroom 2B: tall double doors in the middle of the back wall (locked between sessions)
    for s in (-1, 1):
        S.box(1.2, 0.1, 2.9, DOOR, s * 0.62, D / 2 - 0.06, 1.45)
        S.box(0.08, 0.06, 0.4, BRASS, s * 0.12, D / 2 - 0.14, 1.3)
    S.box(2.8, 0.12, 0.18, RAIL, 0, D / 2 - 0.05, 2.98)
    S.box(2.6, 0.06, 0.4, SIGN, 0, D / 2 - 0.05, 3.4)
    S.text("COURTROOM 2B", 0.2, GOLDT, 0, D / 2 - 0.1, 3.4, "-Y")
    S.col("doors2b", 0, D / 2 - 0.2, 1.5, 0.3)
    S.spot("doors2b", 0, D / 2 - 1.3, 0)
    # the scales of justice above the doors
    S.box(1.0, 0.05, 0.05, BRASS, 0, D / 2 - 0.08, 4.05)
    S.box(0.05, 0.05, 0.5, BRASS, 0, D / 2 - 0.08, 3.85)
    for s in (-1, 1):
        S.cyl(0.18, 0.1, 0.06, BRASS, s * 0.45, D / 2 - 0.12, 3.8, segs=10)

    # the clerk's window (left): a wood counter + glass, CLERK OF COURT
    cx, cy = -4.6, 2.2
    S.box(3.2, 0.8, 1.1, WOOD, cx, cy, 0.55, bevel=0.03)
    S.box(3.4, 0.95, 0.06, WOODT, cx, cy, 1.13)
    S.box(3.2, 0.05, 1.0, GLASS, cx, cy - 0.2, 1.7)
    S.box(1.0, 0.05, 0.22, DARKM, cx, cy - 0.22, 1.25)
    S.box(3.0, 0.06, 0.36, SIGN, cx, cy - 0.2, 2.45)
    S.text("CLERK OF COURT", 0.16, GOLDT, cx, cy - 0.24, 2.45, "-Y")
    S.box(0.4, 0.3, 0.3, PAPER, cx + 0.9, cy + 0.1, 1.31)
    S.box(0.36, 0.26, 0.04, mat("CLStamp", "#C62828", 0.6), cx - 0.9, cy - 0.15, 1.18)
    S.col("clerk", cx, cy + 0.5, 1.7, 0.9)
    S.spot("clerk", cx, cy + 0.85, 0)
    S.spot("clerkTalk", cx, cy - 1.0, 0)

    # the docket board (right wall)
    S.box(0.06, 2.6, 1.6, CORK, W / 2 - 0.04, 1.0, 2.0)
    S.box(0.08, 2.7, 0.08, WOOD, W / 2 - 0.05, 1.0, 2.84)
    S.box(0.08, 2.7, 0.08, WOOD, W / 2 - 0.05, 1.0, 1.16)
    for k in range(6):
        S.box(0.02, 0.5, 0.36, PAPER, W / 2 - 0.08, 0.1 + (k % 3) * 0.85, 2.3 - (k // 3) * 0.6, rot=(((k % 2) - 0.5) * 0.08, 0, 0))
    S.box(0.06, 2.0, 0.3, SIGN, W / 2 - 0.05, 1.0, 3.05)
    S.text("TODAY'S DOCKET", 0.14, GOLDT, W / 2 - 0.1, 1.0, 3.05, "-X")
    S.spot("docket", W / 2 - 1.2, 1.0, -math.pi / 2)

    # the waiting bench (front left) + a second (front right)
    for bx in (-3.2, 3.0):
        S.box(2.6, 0.5, 0.08, WOOD, bx, -1.9, 0.48)
        S.box(2.6, 0.08, 0.6, WOOD, bx, -1.65, 0.8)
        for s in (-1, 1):
            S.box(0.08, 0.5, 0.48, DARKM, bx + s * 1.2, -1.9, 0.24)
    S.col("bench0", -3.2, -1.8, 1.35, 0.35, 0.5)
    S.col("bench1", 3.0, -1.8, 1.35, 0.35, 0.5)
    S.spot("bench0", -3.6, -1.95, math.pi)
    S.spot("bench1", -2.6, -1.95, math.pi)
    S.spot("bench2", 3.4, -1.95, math.pi)
    S.spot("bench", -3.2, -3.0, 0)

    # the metal detector by the door (right front) + the bailiff beside it
    mx, my = 4.8, -2.9
    for s in (-1, 1):
        S.box(0.18, 0.5, 2.2, METAL, mx + s * 0.55, my, 1.1)
    S.box(1.3, 0.5, 0.2, METAL, mx, my, 2.3)
    S.sph(0.07, REDL, mx - 0.3, my - 0.27, 2.3, u=8, v=6)
    S.sph(0.07, GREENL, mx + 0.3, my - 0.27, 2.3, u=8, v=6)
    S.col("detL", mx - 0.55, my, 0.12, 0.3)
    S.col("detR", mx + 0.55, my, 0.12, 0.3)
    S.spot("detector", mx, my + 0.9, math.pi)
    S.spot("bailiff", mx + 1.4, my + 1.0, -math.pi / 2)
    S.spot("bailiffTalk", mx + 0.2, my + 1.6, 0)

    # the water fountain (back right) + a potted ficus + the flag (back left)
    fx, fy = 4.6, D / 2 - 0.35
    S.box(0.6, 0.4, 0.9, METAL, fx, fy, 0.45, bevel=0.03)
    S.box(0.5, 0.35, 0.08, DARKM, fx, fy, 0.92)
    S.col("fountain", fx, fy, 0.35, 0.3)
    S.spot("fountain", fx, fy - 1.0, 0)
    S.cyl(0.3, 0.24, 0.5, POT, 6.2, D / 2 - 0.5, 0.25, segs=10)
    S.sph(0.55, PLANT, 6.2, D / 2 - 0.5, 1.05, u=10, v=6)
    S.col("plant", 6.2, D / 2 - 0.5, 0.35, 0.35)
    S.cyl(0.03, 0.03, 2.6, BRASS, -6.2, D / 2 - 0.5, 1.3, segs=6)
    S.box(0.04, 0.9, 0.6, FLAGB, -6.2, D / 2 - 0.95, 2.3)
    for k in range(3):
        S.box(0.045, 0.9, 0.08, FLAGR, -6.2, D / 2 - 0.95, 2.05 + k * 0.17)
    S.col("flag", -6.2, D / 2 - 0.5, 0.2, 0.2)
    S.spot("portrait", -2.6, D / 2 - 1.2, 0)
    S.box(1.0, 0.05, 1.2, mat("CLFrame", "#8D6E63", 0.6), -2.6, D / 2 - 0.03, 2.5)
    S.box(0.84, 0.04, 1.04, mat("CLPortrait", "#5D7A8C", 0.8), -2.6, D / 2 - 0.06, 2.5)

    # the way out (left wall, front)
    door(S, -W / 2, -2.6, "+X", DOOR, RAIL, KNOB, SIGN, EXITR, "EXIT")
    S.spot("door", -W / 2 + 0.95, -2.6, math.pi / 2)
    S.spot("lulu", -W / 2 + 2.4, -2.6, math.pi / 2)
    return S.finish()


ASSETS = [
    ("places_precinct", build_precinct),
    ("places_court", build_court),
    ("places_hospital", build_hospital),
    ("places_impound", build_impound),
    ("places_courtlobby", build_court_lobby),
]
