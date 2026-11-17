"""
features/community — the frum community's volunteer fleet + people (3d/js/features/community/).

    community_chaverim   CHAVERIM · ROADSIDE CHESED: a boxy charcoal SUV, amber light bar,
                         a spare tyre + a gas can on the roof rack, jumper cables in the back
    community_shomrim    SHOMRIM · PATROL: a long white Crown-Vic-style sedan with a navy
                         stripe, a blue + amber light bar ("not police"), a push bar, a
                         spotlight on the pillar and THREE radio antennas
    community_hatzalah   HATZALAH · VOLUNTEER EMS: a white box ambulance-van with an orange
                         band, red + white lights and our own emblem (a blue six-armed star
                         with a white heart) — no real chapter's logo or number
    community_shomer     a Shomrim volunteer: black hat, beard, black coat, hi-vis vest
    community_volunteer  a Chaverim volunteer: orange cap + vest, toolbelt energy
    community_emt        a Hatzalah EMT: navy jacket, reflective vest, kippah, beard
    community_bygirl     a Bais Yaakov girl: light-blue blouse, navy pleated skirt, ponytail
    community_menahel    the menahel: black hat, grey beard, glasses, black suit, tie
    community_baisyaakov the BAIS YAAKOV building (two storeys of brick, a canopy, a fence),
                         placed by the town engine through the town's `uses` (Anchor_sign)
    community_spare      a spare tyre on a jack + a toolbox (roadside-help prop)

Light materials the game flashes per org: LightAmber · LightBlue · LightRed · LightWhite.
Livery text is real geometry (material "Livery" / "LiveryB"). FRONT faces Blender -Y.
"""
import math
from lib import *
from lib_people import build_person

R90 = math.pi / 2


def _text(body, size):
    """Flat, low-resolution livery text (a sticker on the panel: a few hundred triangles, not thousands)."""
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = body
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.resolution_u = 2
    cu.extrude = 0.0
    cu.fill_mode = "FRONT"
    tmp = bpy.data.objects.new("txt", cu)
    bpy.context.scene.collection.objects.link(tmp)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    return bm


def _fresh(*names):
    """Each vehicle gets its OWN Paint / Stripe / Livery (lib.mat caches by name, and the game
    recolours by these exact names, so the previous vehicle's are renamed out of the way)."""
    for nm in names:
        m = bpy.data.materials.get(nm)
        if m is not None:
            m.name = nm + "~prev"
        MATS.pop(nm, None)


VEHICLE_MATS = ("Paint", "Stripe", "StripeGold", "Livery", "LiveryB")


def _side_text(coll, parts, body, size, x, y, z, M):
    """The same text on both flanks (reads front→back on each side)."""
    parts.append(Part(coll, "txtR", _text(body, size), M, loc=(x, y, z), rot=(R90, 0, R90)))
    parts.append(Part(coll, "txtL", _text(body, size), M, loc=(-x, y, z), rot=(R90, 0, -R90)))


def _rear_text(coll, parts, body, size, y, z, M):
    parts.append(Part(coll, "txtB", _text(body, size), M, loc=(0, y, z), rot=(R90, 0, math.pi)))


def _wheels(coll, root, S, track, fy, ry, r, w=0.26):
    for nm, x, y in (("Wheel_FL", track, fy), ("Wheel_FR", -track, fy), ("Wheel_RL", track, ry), ("Wheel_RR", -track, ry)):
        wp = [Part(coll, nm + "_t", bm_cyl(r, r, w, 14, "X"), S.TIRE, loc=(x, y, r)),
              Part(coll, nm + "_h", bm_cyl(r * 0.45, r * 0.45, w + 0.03, 8, "X"), S.TIRE, loc=(x, y, r))]
        bake_at(wp, nm, coll, root, (x, y, r))


def _lightbar(coll, parts, y, z, w, left, right, S, mid=None):
    parts.append(Part(coll, "barBase", bm_box(w, 0.32, 0.07), S.DARK, loc=(0, y, z)))
    seg = w / 2 - 0.04
    parts.append(Part(coll, "barL", bm_box(seg, 0.27, 0.13), left, loc=(-w / 4, y, z + 0.09)).bevel(0.04, 2))
    parts.append(Part(coll, "barR", bm_box(seg, 0.27, 0.13), right, loc=(w / 4, y, z + 0.09)).bevel(0.04, 2))
    if mid is not None:
        parts.append(Part(coll, "barM", bm_box(0.16, 0.28, 0.14), mid, loc=(0, y, z + 0.09)))


# ── SHOMRIM: the not-a-cop car ─────────────────────────────────────────────
def build_shomrim():
    _fresh(*VEHICLE_MATS)
    coll = scene_coll("CommunityShomrim")
    root = root_empty(coll, "CommunityShomrim")
    S = shared()
    PAINT = mat("Paint", "#F4F5F2", rough=0.35, metal=0.15)
    STRIPE = mat("Stripe", "#1A2A6C", rough=0.5)
    GOLD = mat("StripeGold", "#F2B705", rough=0.5)
    LIV = mat("Livery", "#14205A", rough=0.5)
    BLUE = mat("LightBlue", "#2979FF", rough=0.3, emit=2.5)
    AMBER = mat("LightAmber", "#FFAB00", rough=0.3, emit=2.5)
    parts = [
        Part(coll, "body", bm_box(1.9, 5.3, 0.62), PAINT, loc=(0, 0, 0.68)).bevel(0.1, 2),
        Part(coll, "cabin", bm_box(1.66, 2.3, 0.56), S.TINT, loc=(0, 0.3, 1.25)).bevel(0.12, 2),
        Part(coll, "roof", bm_box(1.58, 1.9, 0.08), PAINT, loc=(0, 0.32, 1.52)).bevel(0.04, 1),
        Part(coll, "trunk", bm_box(1.86, 1.05, 0.12), PAINT, loc=(0, 2.05, 1.02)),
        Part(coll, "bumperF", bm_box(1.86, 0.22, 0.2), S.DARK, loc=(0, -2.68, 0.5)),
        Part(coll, "bumperR", bm_box(1.86, 0.22, 0.2), S.DARK, loc=(0, 2.68, 0.5)),
        # the push bar ("for pushing… opinions")
        Part(coll, "push", bm_box(1.3, 0.1, 0.5), S.DARK, loc=(0, -2.86, 0.7)),
        Part(coll, "pushT", bm_box(1.3, 0.22, 0.08), S.DARK, loc=(0, -2.8, 0.95)),
    ]
    for sx in (-1, 1):
        parts.append(Part(coll, "stripe", bm_box(0.02, 5.0, 0.16), STRIPE, loc=(sx * 0.955, 0, 0.62)))
        parts.append(Part(coll, "stripeG", bm_box(0.02, 5.0, 0.05), GOLD, loc=(sx * 0.958, 0, 0.73)))
        parts.append(Part(coll, "head", bm_box(0.44, 0.06, 0.15), S.HEAD, loc=(sx * 0.6, -2.66, 0.78)))
        parts.append(Part(coll, "tail", bm_box(0.4, 0.06, 0.16), S.TAIL, loc=(sx * 0.6, 2.66, 0.84)))
        parts.append(Part(coll, "mirror", bm_box(0.18, 0.1, 0.12), S.DARK, loc=(sx * 1.0, -0.65, 1.08)))
    # the pillar spotlight (driver's side) + three antennas (why three? nobody knows)
    parts.append(Part(coll, "spotA", bm_cyl(0.02, 0.02, 0.22, 6), S.CHROME, loc=(0.86, -0.72, 1.18)))
    parts.append(Part(coll, "spot", bm_cyl(0.1, 0.08, 0.16, 10, "Y"), S.CHROME, loc=(0.86, -0.78, 1.32)))
    parts.append(Part(coll, "spotL", bm_cyl(0.075, 0.075, 0.02, 10, "Y"), S.HEAD, loc=(0.86, -0.87, 1.32)))
    for i, x in enumerate((-0.55, 0.0, 0.55)):
        parts.append(limb(coll, "ant%d" % i, (x, 1.95 + i * 0.12, 1.08), (x + 0.04, 2.05 + i * 0.12, 1.08 + 0.9 + i * 0.15), 0.008, S.BLACK))
    _lightbar(coll, parts, 0.15, 1.58, 1.3, BLUE, AMBER, S)
    _side_text(coll, parts, "SHOMRIM", 0.3, 0.972, 0.1, 0.86, LIV)
    _side_text(coll, parts, "PATROL", 0.15, 0.972, 1.75, 0.86, LIV)
    _rear_text(coll, parts, "SHOMRIM", 0.17, 2.665, 0.87, LIV)
    _rear_text(coll, parts, "WE'RE NOT POLICE", 0.1, 2.665, 0.68, LIV)
    bake(parts, "CommunityShomrim_body", coll, parent=root)
    _wheels(coll, root, S, 0.82, -1.62, 1.62, 0.36)
    return coll


# ── CHAVERIM: the roadside-help SUV ────────────────────────────────────────
def build_chaverim():
    _fresh(*VEHICLE_MATS)
    coll = scene_coll("CommunityChaverim")
    root = root_empty(coll, "CommunityChaverim")
    S = shared()
    PAINT = mat("Paint", "#3A4149", rough=0.4, metal=0.25)
    STRIPE = mat("Stripe", "#FFB300", rough=0.45)
    LIV = mat("Livery", "#FFC94A", rough=0.45)
    LIVB = mat("LiveryB", "#FFFFFF", rough=0.5)
    AMBER = mat("LightAmber", "#FFAB00", rough=0.3, emit=2.5)
    RACK = mat("Rack", "#1E2328", rough=0.6, metal=0.4)
    CAN = mat("GasCan", "#D32F2F", rough=0.5)
    parts = [
        Part(coll, "body", bm_box(1.98, 4.8, 0.86), PAINT, loc=(0, 0, 0.84)).bevel(0.12, 2),
        Part(coll, "upper", bm_box(1.88, 3.1, 0.66), PAINT, loc=(0, 0.6, 1.58)).bevel(0.14, 2),
        Part(coll, "hood", bm_box(1.9, 1.3, 0.2), PAINT, loc=(0, -1.75, 1.22), rot=(-0.12, 0, 0)),
        Part(coll, "wind", bm_box(1.76, 0.6, 0.06), S.TINT, loc=(0, -0.95, 1.6), rot=(-0.9, 0, 0)),
        Part(coll, "glass", bm_box(1.9, 2.7, 0.46), S.TINT, loc=(0, 0.7, 1.62)),
        Part(coll, "bumperF", bm_box(1.96, 0.26, 0.28), S.DARK, loc=(0, -2.46, 0.55)),
        Part(coll, "bumperR", bm_box(1.96, 0.26, 0.28), S.DARK, loc=(0, 2.46, 0.55)),
        Part(coll, "hitch", bm_box(0.12, 0.36, 0.1), S.CHROME, loc=(0, 2.68, 0.45)),
        # roof rack: a spare tyre + a red gas can
        Part(coll, "rack", bm_box(1.5, 2.3, 0.05), RACK, loc=(0, 0.8, 1.98)),
        Part(coll, "spare", bm_cyl(0.36, 0.36, 0.22, 14, "Z"), S.TIRE, loc=(0, 1.35, 2.12)),
        Part(coll, "can", bm_box(0.3, 0.42, 0.34), CAN, loc=(0.48, 0.3, 2.18)).bevel(0.04, 1),
    ]
    for sx in (-1, 1):
        parts.append(Part(coll, "stripe", bm_box(0.02, 4.5, 0.2), STRIPE, loc=(sx * 0.995, 0, 0.98)))
        parts.append(Part(coll, "head", bm_box(0.42, 0.06, 0.18), S.HEAD, loc=(sx * 0.62, -2.42, 0.95)))
        parts.append(Part(coll, "tail", bm_box(0.18, 0.06, 0.5), S.TAIL, loc=(sx * 0.86, 2.42, 1.2)))
        parts.append(Part(coll, "rail", bm_box(0.05, 2.4, 0.08), RACK, loc=(sx * 0.72, 0.8, 1.94)))
        # amber grille strobes
        parts.append(Part(coll, "grille", bm_box(0.16, 0.05, 0.08), AMBER, loc=(sx * 0.26, -2.47, 0.95)))
    _lightbar(coll, parts, -0.55, 1.95, 1.4, AMBER, AMBER, S)
    _side_text(coll, parts, "CHAVERIM", 0.36, 1.002, -0.1, 1.33, LIV)
    _side_text(coll, parts, "ROADSIDE CHESED", 0.14, 1.002, -0.1, 0.72, LIVB)
    _rear_text(coll, parts, "CHAVERIM", 0.24, 2.6, 1.32, LIV)
    _rear_text(coll, parts, "STUCK? WE GOT YOU", 0.1, 2.6, 0.98, LIVB)
    bake(parts, "CommunityChaverim_body", coll, parent=root)
    _wheels(coll, root, S, 0.86, -1.55, 1.6, 0.4, 0.3)
    return coll


# ── HATZALAH: the volunteer ambulance ──────────────────────────────────────
def _emblem(coll, parts, x, y, z, side, BLUE, WHITE):
    """Our own EMS-style emblem: a blue six-armed star (three crossed bars) + a white heart."""
    for k in range(3):
        a = k * math.pi / 3
        if side == 0:      # on the rear (faces +Y)
            parts.append(Part(coll, "em", bm_box(0.11, 0.02, 0.62), BLUE, loc=(x, y, z), rot=(0, a, 0)))
        else:              # on a flank (faces ±X)
            parts.append(Part(coll, "em", bm_box(0.02, 0.11, 0.62), BLUE, loc=(x, y, z), rot=(a, 0, 0)))
    for s in (-1, 1):
        off = s * 0.045
        if side == 0:
            parts.append(Part(coll, "hl", bm_sphere(0.06, 0.02, 0.06, 10, 6), WHITE, loc=(x + off, y + 0.012, z + 0.03)))
        else:
            parts.append(Part(coll, "hl", bm_sphere(0.02, 0.06, 0.06, 6, 10), WHITE, loc=(x + side * 0.012, y + off, z + 0.03)))
    if side == 0:
        parts.append(Part(coll, "hp", bm_box(0.09, 0.02, 0.09), WHITE, loc=(x, y + 0.012, z - 0.03), rot=(0, math.pi / 4, 0)))
    else:
        parts.append(Part(coll, "hp", bm_box(0.02, 0.09, 0.09), WHITE, loc=(x + side * 0.012, y, z - 0.03), rot=(math.pi / 4, 0, 0)))


def build_hatzalah():
    _fresh(*VEHICLE_MATS)
    coll = scene_coll("CommunityHatzalah")
    root = root_empty(coll, "CommunityHatzalah")
    S = shared()
    PAINT = mat("Paint", "#FAFAFA", rough=0.4, metal=0.1)
    BAND = mat("Stripe", "#F57C00", rough=0.45)
    BLUE = mat("EmblemBlue", "#1565C0", rough=0.4)
    WHITE = mat("EmblemWhite", "#FFFFFF", rough=0.5)
    LIV = mat("Livery", "#C62828", rough=0.45)
    LIVB = mat("LiveryB", "#1565C0", rough=0.45)
    RED = mat("LightRed", "#FF1744", rough=0.3, emit=2.5)
    LW = mat("LightWhite", "#F5F7FF", rough=0.3, emit=2.5)
    parts = [
        Part(coll, "cab", bm_box(1.98, 1.7, 1.0), PAINT, loc=(0, -1.8, 0.95)).bevel(0.12, 2),
        Part(coll, "hood", bm_box(1.94, 0.9, 0.3), PAINT, loc=(0, -2.5, 0.95)).bevel(0.08, 1),
        Part(coll, "wind", bm_box(1.8, 0.5, 0.06), S.TINT, loc=(0, -2.02, 1.55), rot=(-0.75, 0, 0)),
        Part(coll, "box", bm_box(2.16, 3.5, 2.05), PAINT, loc=(0, 0.85, 1.42)).bevel(0.06, 1),
        Part(coll, "bumperF", bm_box(1.96, 0.24, 0.26), S.DARK, loc=(0, -2.98, 0.52)),
        Part(coll, "bumperR", bm_box(2.1, 0.3, 0.2), S.DARK, loc=(0, 2.66, 0.5)),
        Part(coll, "step", bm_box(1.2, 0.3, 0.08), S.CHROME, loc=(0, 2.76, 0.42)),
        Part(coll, "rearwin", bm_box(1.4, 0.05, 0.5), S.TINT, loc=(0, 2.61, 1.85)),
    ]
    for sx in (-1, 1):
        parts.append(Part(coll, "band", bm_box(0.02, 3.4, 0.3), BAND, loc=(sx * 1.085, 0.85, 1.0)))
        parts.append(Part(coll, "bandC", bm_box(0.02, 1.6, 0.2), BAND, loc=(sx * 0.995, -1.75, 0.82)))
        parts.append(Part(coll, "head", bm_box(0.44, 0.06, 0.18), S.HEAD, loc=(sx * 0.6, -2.96, 0.82)))
        parts.append(Part(coll, "tail", bm_box(0.2, 0.06, 0.45), S.TAIL, loc=(sx * 0.9, 2.61, 0.9)))
        parts.append(Part(coll, "sidewin", bm_box(0.04, 0.8, 0.5), S.TINT, loc=(sx * 1.0, -1.7, 1.25)))
        # corner strobes on the box
        parts.append(Part(coll, "cornerF", bm_box(0.2, 0.08, 0.14), RED, loc=(sx * 0.95, -0.92, 2.36)))
        parts.append(Part(coll, "cornerR", bm_box(0.2, 0.08, 0.14), RED, loc=(sx * 0.95, 2.62, 2.36)))
        _emblem(coll, parts, sx * 1.1, 1.75, 1.7, sx, BLUE, WHITE)
    _lightbar(coll, parts, -1.6, 1.5, 1.4, RED, RED, S, mid=LW)
    _side_text(coll, parts, "HATZALAH", 0.36, 1.1, 0.3, 1.72, LIV)
    _side_text(coll, parts, "VOLUNTEER EMS", 0.15, 1.1, 0.6, 0.64, LIVB)
    _rear_text(coll, parts, "HATZALAH", 0.26, 2.63, 1.3, LIV)
    _emblem(coll, parts, -0.62, 2.63, 2.2, 0, BLUE, WHITE)
    _emblem(coll, parts, 0.62, 2.63, 2.2, 0, BLUE, WHITE)
    bake(parts, "CommunityHatzalah_body", coll, parent=root)
    _wheels(coll, root, S, 0.86, -2.15, 1.75, 0.4, 0.3)
    return coll


# ── people ─────────────────────────────────────────────────────────────────
def build_shomer():
    return build_person("CommunityShomer", dict(hair="short", hair_color="#2B1D14", top="#15161A", bottom="pants", bottom_color="#15161A",
                        shoes="#0E0E0E", width=1.08, extras=["beard", "fedora", "vest", "tzitzit", "glasses"],
                        extra_colors={"Beard": "#3A2618", "Hat": "#0F0F10", "HatBand": "#1C1C1C", "Vest": "#C8F02A", "Glasses": "#222222"}))


def build_volunteer():
    return build_person("CommunityVolunteer", dict(hair="short", hair_color="#4E342E", top="#263238", bottom="pants", bottom_color="#37474F",
                        shoes="#3E2723", width=1.12, extras=["beard", "cap", "vest", "tzitzit"],
                        extra_colors={"Beard": "#5D4037", "Hat": "#FF8F00", "Vest": "#FF6D00"}))


def build_emt():
    return build_person("CommunityEmt", dict(hair="short", hair_color="#3E2723", top="#0D2A5C", bottom="pants", bottom_color="#1B2433",
                        shoes="#111111", extras=["beard", "kippah", "vest", "badge"],
                        extra_colors={"Beard": "#4E342E", "Kippah": "#111111", "Vest": "#DCE775", "Badge": "#F57C00"}))


def build_bygirl():
    return build_person("CommunityByGirl", dict(hair="ponytail", hair_color="#4E342E", top="#9CC8EE", sleeves="long", bottom="skirt",
                        bottom_color="#1F2D63", shoes="#1A1A1A", height=1.52,
                        extra_colors={"Tights": "#1F2D63", "HairTie": "#1F2D63"}))


def build_menahel():
    return build_person("CommunityMenahel", dict(hair="short", hair_color="#9E9E9E", top="#121316", bottom="pants", bottom_color="#121316",
                        shoes="#0B0B0B", width=1.05, extras=["beard", "fedora", "glasses", "tie"],
                        extra_colors={"Beard": "#BDBDBD", "Hat": "#0E0E0E", "Tie": "#1A237E", "Glasses": "#111111"}))


# ── the Bais Yaakov ────────────────────────────────────────────────────────
def build_baisyaakov():
    """Two storeys of brick on Carpool Ln: a canopy over the doors, a long row of windows,
    a low fence with a gate (dismissal happens HERE), a flag pole. Sign = Anchor_sign."""
    coll = scene_coll("CommunityBaisYaakov")
    root = root_empty(coll, "CommunityBaisYaakov")
    S = shared()
    W = mat("Walls", "#C98D6E", rough=0.9)
    TRIM = mat("Trim", "#F3EEE4", rough=0.7)
    WIN = mat("Window", "#8FCDEB", rough=0.15, emit=0.2)
    DOOR = mat("Door", "#1F2D63", rough=0.6)
    CAN = mat("Canopy", "#1F2D63", rough=0.6)
    SIGN = mat("SignBoard", "#F5F1E6", rough=0.8)
    FENCE = mat("Fence", "#2E3440", rough=0.5, metal=0.4)
    CONC = mat("Concrete", "#C9C3B8", rough=0.95)
    w, d, h = 30.0, 16.0, 9.0
    parts = [Part(coll, "body", bm_box(w, d, h), W, loc=(0, 0, h / 2), smooth=False),
             Part(coll, "cap", bm_box(w + 0.5, d + 0.5, 0.5), TRIM, loc=(0, 0, h + 0.25), smooth=False),
             Part(coll, "band", bm_box(w + 0.1, d + 0.1, 0.3), TRIM, loc=(0, 0, 4.6), smooth=False)]
    fy = -d / 2 - 0.05
    for z in (2.3, 6.6):
        for k in range(10):
            x = -13.2 + k * 2.93
            if abs(x) < 2.6:
                continue
            parts.append(Part(coll, "wf", bm_box(1.7, 0.08, 1.9), TRIM, loc=(x, fy + 0.02, z), smooth=False))
            parts.append(Part(coll, "w", bm_box(1.45, 0.1, 1.65), WIN, loc=(x, fy, z), smooth=False))
    # the entrance: double doors, a navy canopy on two posts, steps
    parts.append(Part(coll, "door", bm_box(2.6, 0.15, 2.8), DOOR, loc=(0, fy - 0.05, 1.4), smooth=False))
    parts.append(Part(coll, "canopy", bm_box(5.0, 2.6, 0.22), CAN, loc=(0, fy - 1.3, 3.25), smooth=False))
    for sx in (-1, 1):
        parts.append(Part(coll, "post", bm_cyl(0.08, 0.08, 3.2, 8), TRIM, loc=(sx * 2.3, fy - 2.45, 1.6)))
    parts.append(Part(coll, "steps", bm_box(5.4, 1.2, 0.3), CONC, loc=(0, fy - 0.6, 0.15), smooth=False))
    parts.append(Part(coll, "sign", bm_box(12.4, 0.2, 1.35), SIGN, loc=(0, fy - 0.12, h - 0.95), smooth=False))
    # a flag pole by the door
    parts.append(Part(coll, "pole", bm_cyl(0.06, 0.05, 7.5, 8), S.CHROME, loc=(-6.0, fy - 3.2, 3.75)))
    # the fence along the lot line (open at the gate) — the girls file out here
    fz = fy - 3.0
    for x0, x1 in ((-15.0, -3.0), (3.0, 15.0)):
        n = int((x1 - x0) / 1.2)
        for i in range(n + 1):
            parts.append(Part(coll, "picket", bm_box(0.06, 0.06, 1.0), FENCE, loc=(x0 + i * (x1 - x0) / n, fz, 0.5), smooth=False))
        parts.append(Part(coll, "rail", bm_box(x1 - x0, 0.06, 0.06), FENCE, loc=((x0 + x1) / 2, fz, 0.9), smooth=False))
    bake(parts, "CommunityBaisYaakov_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, fy - 0.26, h - 0.95))
    anchor(coll, root, "Anchor_gate", (0, fz, 0))
    return coll


def build_spare():
    """A spare tyre on a scissor jack + an orange toolbox (a Chaverim roadside call)."""
    coll = scene_coll("CommunitySpare")
    root = root_empty(coll, "CommunitySpare")
    S = shared()
    BOX = mat("Toolbox", "#FF6D00", rough=0.5)
    parts = [Part(coll, "tyre", bm_cyl(0.34, 0.34, 0.22, 14, "X"), S.TIRE, loc=(0, 0, 0.34), rot=(0, 0, 0.2)),
             Part(coll, "hub", bm_cyl(0.15, 0.15, 0.24, 8, "X"), S.CHROME, loc=(0, 0, 0.34), rot=(0, 0, 0.2)),
             Part(coll, "jack", bm_box(0.18, 0.5, 0.12), S.DARK, loc=(0.55, 0.1, 0.06)),
             Part(coll, "box", bm_box(0.45, 0.25, 0.22), BOX, loc=(-0.6, 0.15, 0.11)).bevel(0.03, 1),
             Part(coll, "handle", bm_box(0.3, 0.04, 0.05), S.DARK, loc=(-0.6, 0.15, 0.25))]
    bake(parts, "CommunitySpare_body", coll, parent=root)
    return coll


ASSETS = [
    ("community_shomrim", build_shomrim),
    ("community_chaverim", build_chaverim),
    ("community_hatzalah", build_hatzalah),
    ("community_shomer", build_shomer),
    ("community_volunteer", build_volunteer),
    ("community_emt", build_emt),
    ("community_bygirl", build_bygirl),
    ("community_menahel", build_menahel),
    ("community_baisyaakov", build_baisyaakov),
    ("community_spare", build_spare),
]
