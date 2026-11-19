"""
The underworld (feature "underworld"): crooked cops, shady mechanics, the Fixer and the
bad guys around town. Cartoon only: a kugel-fund donation can, a baguette in a truck bed,
a giant plush kugel on a lowrider's roof.

    underworld_krupnik     Officer Krupnik — the crooked cop (aviators, mustache, a belly full of kugel)
    underworld_velvel      Velvel — the no-questions mechanic (coveralls, cap, grease-rag apron)
    underworld_fixer       the Fixer — trench coat, fedora, sunglasses (at night)
    underworld_pickpocket  Yossi Fingers — skinny, beanie, a red scarf to hide behind
    underworld_goon        a gang-car goon — purple tracksuit, gold chain, shades
    underworld_rager       the road-rager's lifted pickup: flames, a bull bar, a baguette in the bed
    underworld_gangcar     the gang's lowrider: recolourable Paint, gold rims, fuzzy dice, a plush KUGEL on the roof
    underworld_shack       VELVEL'S NO-QUESTIONS AUTO: a corrugated garage on the shoulder (+ tyres, a drum)
    underworld_package     the Fixer's "package": a crate with a fish tail sticking out
    underworld_kugelcan    the POLICEMAN'S KUGEL FUND donation can (Krupnik holds it)

Conventions (3d/ARCHITECTURE.md): metres, FRONT = Blender -Y (= +Z in three.js), Blender +X
= the model's LEFT (the driver's side). Paint is recolourable; Headlight / Taillight / Neon*
glow. Everything is prefixed underworld_ so it never collides with another feature.
"""
from lib import *
from lib_people import build_person


def setup():
    global S
    S = shared()


def P(coll, nm, bm, m, loc=(0, 0, 0), rot=(0, 0, 0), smooth=True):
    return Part(coll, nm, bm, m, loc=loc, rot=rot, smooth=smooth)


def txt(body, size, extrude=0.0):
    """Low-poly text facing -Y (coarse curve resolution keeps the .glb small)."""
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = body
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.extrude = extrude
    cu.resolution_u = 2
    cu.fill_mode = "BOTH" if extrude > 0 else "FRONT"
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


def label(coll, body, size, m, loc, face="-Y", extrude=0.0):
    rot = {"-Y": (math.pi / 2, 0, 0), "+Y": (math.pi / 2, 0, math.pi),
           "+X": (math.pi / 2, 0, math.pi / 2), "-X": (math.pi / 2, 0, -math.pi / 2)}[face]
    return P(coll, "txt", txt(body, size, extrude), m, loc=loc, rot=rot, smooth=False)


# ═════════════════════════════════ people ══════════════════════════════════
def build_krupnik():
    return build_person("UWKrupnik", dict(hair="short", hair_color="#3E2723", top="#1A3A6B", bottom="pants", bottom_color="#14284A",
                        shoes="#111111", width=1.16, extras=["police_hat", "mustache", "sunglasses", "badge", "belly", "tie"],
                        extra_colors={"Hat": "#14284A", "HatBand": "#FFD54F", "Shades": "#1B1B1B", "Badge": "#FFD54F", "Beard": "#3E2723", "Tie": "#0D1B33"}))


def build_velvel():
    return build_person("UWVelvel", dict(hair="short", hair_color="#9E9E9E", top="#1E5AA8", bottom="pants", bottom_color="#1E5AA8",
                        shoes="#3E2723", width=1.14, sleeves="short", extras=["cap", "mustache", "apron", "belly"],
                        extra_colors={"Hat": "#F57F17", "Beard": "#757575", "Apron": "#4E342E"}))


def build_fixer():
    return build_person("UWFixer", dict(hair="short", hair_color="#212121", top="#4E342E", bottom="pants", bottom_color="#3E2723",
                        shoes="#1B1B1B", height=1.72, extras=["lab_coat", "fedora", "sunglasses", "tie"],
                        extra_colors={"LabCoat": "#A1887F", "Hat": "#3E2723", "HatBand": "#111111", "Shades": "#111111", "Tie": "#8E0000"}))


def build_pickpocket():
    return build_person("UWPickpocket", dict(hair="short", hair_color="#5D4037", top="#37474F", bottom="pants", bottom_color="#263238",
                        shoes="#E0E0E0", height=1.52, width=0.88, extras=["cap", "scarf"],
                        extra_colors={"Hat": "#212121", "Scarf": "#D32F2F"}))


def build_goon():
    return build_person("UWGoon", dict(hair="bald", hair_color="#3E2723", top="#6A1B9A", bottom="pants", bottom_color="#4A148C",
                        shoes="#FAFAFA", width=1.24, extras=["sunglasses", "necklace", "belly"],
                        extra_colors={"Shades": "#111111"}))


# ═════════════════════════════════ vehicles ════════════════════════════════
def build_rager():
    """A lifted pickup with flame decals, a bull bar, a roof light bar and a baguette in the bed."""
    coll = scene_coll("UWRager")
    root = root_empty(coll, "UWRager")
    PAINT = mat("Paint", "#C62828", rough=0.32, metal=0.15)
    FLAME = mat("RagerFlame", "#FF9800", rough=0.4)
    FLAME2 = mat("RagerFlameHot", "#FFEB3B", rough=0.4)
    AMBER = mat("NeonRager", "#FFB300", rough=0.3, emit=1.6)
    BREAD = mat("RagerBread", "#D9A15B", rough=0.8)
    STICKER = mat("RagerSticker", "#FAFAFA", rough=0.6)
    INK = mat("RagerInk", "#B71C1C", rough=0.6)
    lift = 0.32
    parts = [
        P(coll, "chassis", bm_box(1.86, 5.0, 0.32), S.DARK, loc=(0, 0.1, 0.58 + lift)),
        P(coll, "hood", bm_box(1.94, 1.7, 0.62), PAINT, loc=(0, -1.55, 1.02 + lift)).bevel(0.14, 3),
        P(coll, "cab", bm_box(1.94, 1.6, 1.02), PAINT, loc=(0, 0.05, 1.22 + lift)).bevel(0.14, 3),
        P(coll, "glass", bm_box(1.8, 1.5, 0.48), S.TINT, loc=(0, 0.05, 1.62 + lift)).bevel(0.12, 2),
        P(coll, "roof", bm_box(1.86, 1.32, 0.08), PAINT, loc=(0, 0.1, 1.92 + lift)).bevel(0.04, 2),
        P(coll, "bedFloor", bm_box(1.86, 1.95, 0.14), S.DARK, loc=(0, 1.86, 0.84 + lift)),
        P(coll, "tailgate", bm_box(1.9, 0.1, 0.62), PAINT, loc=(0, 2.84, 1.12 + lift)).bevel(0.03, 2),
        # the bull bar, the roof lights (all show, no blink)
        P(coll, "bullbar", bm_box(1.7, 0.1, 0.12), S.CHROME, loc=(0, -2.5, 0.88 + lift)).bevel(0.04, 2),
        P(coll, "bullbar2", bm_box(1.7, 0.1, 0.12), S.CHROME, loc=(0, -2.5, 1.22 + lift)).bevel(0.04, 2),
        P(coll, "lightbar", bm_box(1.5, 0.18, 0.12), S.DARK, loc=(0, -0.45, 2.02 + lift)),
        # a big angry grille
        P(coll, "grille", bm_box(1.5, 0.06, 0.42), S.CHROME, loc=(0, -2.41, 1.05 + lift)),
        # a baguette sticking out of the bed (the "weapon")
        P(coll, "baguette", bm_cyl(0.07, 0.06, 1.2, 10, "Y"), BREAD, loc=(0.45, 1.75, 1.18 + lift), rot=(0.45, 0, 0.3)),
        # HONK IF YOU'RE ANGRY
        P(coll, "sticker", bm_box(0.9, 0.02, 0.18), STICKER, loc=(0, 2.9, 1.22 + lift), smooth=False),
        label(coll, "HONK IF ANGRY", 0.11, INK, (0, 2.915, 1.22 + lift), face="+Y"),
    ]
    for i in range(4):
        parts.append(P(coll, "lamp", bm_cyl(0.07, 0.07, 0.08, 10, "Y"), AMBER, loc=(-0.54 + i * 0.36, -0.55, 2.02 + lift)))
    for s in (-1, 1):
        parts.append(P(coll, "head", bm_box(0.42, 0.06, 0.16), S.HEAD, loc=(s * 0.6, -2.4, 1.12 + lift)).bevel(0.03, 2))
        parts.append(P(coll, "tail", bm_box(0.14, 0.06, 0.42), S.TAIL, loc=(s * 0.86, 2.9, 1.12 + lift)).bevel(0.03, 2))
        parts.append(P(coll, "bedSide", bm_box(0.1, 1.95, 0.62), PAINT, loc=(s * 0.92, 1.86, 1.12 + lift)).bevel(0.03, 2))
        parts.append(P(coll, "step", bm_box(0.18, 1.4, 0.06), S.CHROME, loc=(s * 1.0, -0.2, 0.62 + lift)))
        parts.append(P(coll, "fender", bm_box(0.24, 1.15, 0.12), S.DARK, loc=(s * 0.98, -1.55, 0.98 + lift)).bevel(0.04, 2))
        parts.append(P(coll, "fenderR", bm_box(0.24, 1.15, 0.12), S.DARK, loc=(s * 0.98, 1.75, 0.98 + lift)).bevel(0.04, 2))
        parts.append(P(coll, "mirror", bm_box(0.22, 0.08, 0.16), S.DARK, loc=(s * 1.12, -0.6, 1.58 + lift)))
        # flames licking back from the front wheel arch
        for k, (y, z, w, h) in enumerate([(-1.65, 1.0, 0.95, 0.24), (-1.15, 1.14, 0.8, 0.16), (-0.65, 1.0, 0.65, 0.12), (-0.2, 1.16, 0.45, 0.1)]):
            parts.append(P(coll, "flame", bm_box(0.02, w, h), FLAME if k % 2 == 0 else FLAME2, loc=(s * 0.985, y, z + lift),
                           rot=(0.18 * (1 if k % 2 else -1), 0, 0), smooth=False))
    bake(parts, "UWRager_body", coll, parent=root)
    four_wheels(coll, root, 0.92, -1.55, 1.75, 0.5, 0.38, S.TIRE, S.CHROME, S.TIRE)
    return coll


def build_gangcar():
    """The gang's lowrider: a long, low coupe with gold rims, fuzzy dice and a plush kugel on the roof."""
    coll = scene_coll("UWGangcar")
    root = root_empty(coll, "UWGangcar")
    PAINT = mat("Paint", "#7B1FA2", rough=0.22, metal=0.25)
    GOLD = mat("Gold", "#FFC107", rough=0.25, metal=0.85)
    STRIPE = mat("GangStripe", "#FFD54F", rough=0.35)
    KUGEL = mat("GangKugel", "#F2C14E", rough=0.85)
    CRUST = mat("GangKugelCrust", "#B5651D", rough=0.9)
    DICE = mat("GangDice", "#FAFAFA", rough=0.95)
    DOTS = mat("GangDots", "#111111", rough=0.6)
    EYES = mat("GangEyes", "#FFFFFF", rough=0.4)
    NEON = mat("NeonGang", "#E040FB", rough=0.3, emit=2.0)
    parts = [
        P(coll, "body", bm_box(1.84, 4.9, 0.5), PAINT, loc=(0, 0, 0.5)).bevel(0.15, 3),
        P(coll, "cabin", bm_box(1.6, 2.0, 0.48), S.TINT, loc=(0, 0.35, 0.98)).bevel(0.18, 3),
        P(coll, "roof", bm_box(1.52, 1.65, 0.07), PAINT, loc=(0, 0.38, 1.22)).bevel(0.035, 2),
        P(coll, "bumperF", bm_box(1.8, 0.18, 0.16), S.CHROME, loc=(0, -2.46, 0.38)).bevel(0.06, 2),
        P(coll, "bumperR", bm_box(1.8, 0.18, 0.16), S.CHROME, loc=(0, 2.46, 0.38)).bevel(0.06, 2),
        P(coll, "skirt", bm_box(1.86, 4.2, 0.06), NEON, loc=(0, 0, 0.22), smooth=False),
        # the giant plush kugel on the roof (with googly eyes)
        P(coll, "kugel", bm_box(0.95, 0.75, 0.34), KUGEL, loc=(0, 0.4, 1.43)).bevel(0.13, 3),
        P(coll, "crust", bm_box(0.97, 0.77, 0.08), CRUST, loc=(0, 0.4, 1.6)).bevel(0.04, 2),
        P(coll, "noodle", bm_torus(0.14, 0.03, 12, 4), KUGEL, loc=(0.2, 0.25, 1.66)),
        P(coll, "noodle2", bm_torus(0.11, 0.03, 12, 4), KUGEL, loc=(-0.22, 0.52, 1.66)),
    ]
    for s in (-1, 1):
        parts.append(P(coll, "eye", bm_sphere(0.09, 0.05, 0.09), EYES, loc=(s * 0.2, 0.03, 1.47)))
        parts.append(P(coll, "pupil", bm_sphere(0.04, 0.02, 0.04), DOTS, loc=(s * 0.2 + 0.02, -0.02, 1.45)))
        parts.append(P(coll, "head", bm_box(0.4, 0.06, 0.1), S.HEAD, loc=(s * 0.6, -2.44, 0.6)).bevel(0.03, 2))
        parts.append(P(coll, "tail", bm_box(0.42, 0.06, 0.09), S.TAIL, loc=(s * 0.58, 2.44, 0.64)).bevel(0.03, 2))
        parts.append(P(coll, "stripe", bm_box(0.02, 3.9, 0.08), STRIPE, loc=(s * 0.925, 0.0, 0.62), smooth=False))
        parts.append(P(coll, "pipe", bm_cyl(0.05, 0.05, 1.3, 8, "Y"), S.CHROME, loc=(s * 0.98, 0.6, 0.3)))
    # fuzzy dice hanging from the mirror
    for k, x in enumerate((0.1, -0.1)):
        parts.append(P(coll, "dice", bm_box(0.13, 0.13, 0.13), DICE, loc=(x, -0.55, 0.92 - k * 0.05), rot=(0.3, 0.4 * (k - 0.5), 0.2)).bevel(0.03, 2))
        parts.append(P(coll, "dot", bm_sphere(0.022), DOTS, loc=(x, -0.62, 0.92 - k * 0.05)))
    parts.append(P(coll, "string", bm_cyl(0.006, 0.006, 0.2, 4), DOTS, loc=(0, -0.55, 1.05)))
    bake(parts, "UWGangcar_body", coll, parent=root)
    # gold rims
    four_wheels(coll, root, 0.82, -1.55, 1.55, 0.31, 0.24, S.TIRE, GOLD, GOLD)
    return coll


# ═════════════════════════════════ set pieces ══════════════════════════════
def build_shack():
    """VELVEL'S NO-QUESTIONS AUTO: a corrugated garage facing the road (-Y), the bay open."""
    coll = scene_coll("UWShack")
    root = root_empty(coll, "UWShack")
    TIN = mat("UWTin", "#90A4AE", rough=0.5, metal=0.55)
    RUST = mat("UWRust", "#A1572A", rough=0.9)
    TRIM = mat("UWTrim", "#F57F17", rough=0.5)
    SIGN = mat("UWSign", "#263238", rough=0.6)
    NEON = mat("NeonVelvel", "#FFCA28", rough=0.3, emit=2.2)
    NEON2 = mat("NeonVelvelRed", "#FF5252", rough=0.3, emit=2.0)
    CONC = mat("UWConcrete", "#9E9E9E", rough=0.95)
    OIL = mat("UWOil", "#1B5E20", rough=0.5, metal=0.3)
    DARKIN = mat("UWInside", "#1C1C1C", rough=0.95)
    W, D, H = 7.0, 6.0, 3.8
    parts = [
        P(coll, "slab", bm_box(W + 2.5, D + 3.5, 0.1), CONC, loc=(0, -0.6, 0.05), smooth=False),
        P(coll, "back", bm_box(W, 0.12, H), TIN, loc=(0, D / 2, H / 2), smooth=False),
        P(coll, "inside", bm_box(W - 0.3, 0.05, H - 0.3), DARKIN, loc=(0, D / 2 - 0.1, H / 2), smooth=False),
        P(coll, "roof", bm_box(W + 0.5, D + 0.6, 0.12), RUST, loc=(0, 0, H + 0.06), rot=(0.05, 0, 0), smooth=False),
        P(coll, "lintel", bm_box(W, 0.2, 0.6), TIN, loc=(0, -D / 2, H - 0.3), smooth=False),
        P(coll, "door", bm_box(W - 1.0, 0.1, 0.5), TRIM, loc=(0, -D / 2 + 0.05, H - 0.55), smooth=False),
        # the sign over the bay
        P(coll, "signBoard", bm_box(5.6, 0.16, 1.2), SIGN, loc=(0, -D / 2 - 0.12, H + 0.75)).bevel(0.05, 2),
        label(coll, "VELVEL'S", 0.62, NEON, (0, -D / 2 - 0.22, H + 0.98)),
        label(coll, "NO-QUESTIONS AUTO", 0.3, NEON2, (0, -D / 2 - 0.22, H + 0.45)),
        # CASH ONLY board on a post
        P(coll, "post", bm_box(0.1, 0.1, 1.6), SIGN, loc=(-W / 2 - 0.8, -D / 2 - 1.2, 0.8), smooth=False),
        P(coll, "cashBoard", bm_box(1.3, 0.06, 0.6), TRIM, loc=(-W / 2 - 0.8, -D / 2 - 1.24, 1.55), smooth=False),
        label(coll, "CASH ONLY", 0.2, SIGN, (-W / 2 - 0.8, -D / 2 - 1.28, 1.6)),
        label(coll, "no receipts", 0.11, SIGN, (-W / 2 - 0.8, -D / 2 - 1.28, 1.38)),
    ]
    # corrugation ribs on the side walls
    for s in (-1, 1):
        parts.append(P(coll, "side", bm_box(0.12, D, H), TIN, loc=(s * W / 2, 0, H / 2), smooth=False))
        for i in range(9):
            parts.append(P(coll, "rib", bm_box(0.05, 0.08, H), TIN, loc=(s * (W / 2 + 0.07), -D / 2 + 0.3 + i * (D - 0.6) / 8, H / 2), smooth=False))
    # a stack of tyres, an oil drum, a hubcap wall
    for i in range(4):
        parts.append(P(coll, "tyre", bm_torus(0.36, 0.14, 16, 6), S.TIRE, loc=(W / 2 + 1.0, -D / 2 - 0.4, 0.16 + i * 0.27)))
    parts.append(P(coll, "drum", bm_cyl(0.32, 0.32, 0.9, 14), OIL, loc=(W / 2 + 1.1, -D / 2 + 1.0, 0.55)))
    for i in range(5):
        parts.append(P(coll, "hubcap", bm_cyl(0.24, 0.24, 0.04, 14, "Y"), S.CHROME, loc=(-W / 2 + 0.9 + i * 1.3, D / 2 - 0.12, 2.2 + 0.25 * (i % 2))))
    bake(parts, "UWShack_body", coll, parent=root)
    return coll


def build_package():
    """The Fixer's package: a slatted crate, a fish tail sticking out, DO NOT OPEN."""
    coll = scene_coll("UWPackage")
    root = root_empty(coll, "UWPackage")
    WOOD = mat("UWCrate", "#A1744A", rough=0.85)
    WOOD2 = mat("UWCrateDark", "#7B5537", rough=0.85)
    FISH = mat("UWFish", "#90A4AE", rough=0.35, metal=0.3)
    INK = mat("UWStencil", "#B71C1C", rough=0.7)
    parts = [P(coll, "box", bm_box(0.62, 0.48, 0.42), WOOD, loc=(0, 0, 0.23)).bevel(0.02, 1)]
    for z in (0.08, 0.38):
        parts.append(P(coll, "slat", bm_box(0.64, 0.5, 0.05), WOOD2, loc=(0, 0, z), smooth=False))
    parts.append(label(coll, "DO NOT OPEN", 0.07, INK, (0, -0.245, 0.24)))
    parts.append(P(coll, "tail", bm_prism([(0.0, 0.0), (0.16, 0.12), (0.16, -0.12)], 0.015), FISH, loc=(0.2, 0.0, 0.52), rot=(0, 0, 0.4)))
    parts.append(P(coll, "fin", bm_cyl(0.05, 0.02, 0.12, 8), FISH, loc=(0.2, 0.0, 0.47)))
    bake(parts, "UWPackage_body", coll, parent=root)
    return coll


def build_kugelcan():
    """THE POLICEMAN'S KUGEL FUND: a donation can with a slot."""
    coll = scene_coll("UWKugelCan")
    root = root_empty(coll, "UWKugelCan")
    TIN = mat("UWCan", "#E53935", rough=0.4, metal=0.4)
    LBL = mat("UWCanLabel", "#FFF8E1", rough=0.6)
    INK = mat("UWCanInk", "#1A3A6B", rough=0.6)
    parts = [P(coll, "can", bm_cyl(0.09, 0.09, 0.22, 14), TIN, loc=(0, 0, 0.11)),
             P(coll, "label", bm_cyl(0.092, 0.092, 0.11, 14), LBL, loc=(0, 0, 0.11)),
             P(coll, "lid", bm_cyl(0.093, 0.093, 0.015, 14), S.CHROME, loc=(0, 0, 0.225)),
             P(coll, "slot", bm_box(0.08, 0.012, 0.01), S.BLACK, loc=(0, 0, 0.234), smooth=False),
             label(coll, "KUGEL", 0.04, INK, (0, -0.094, 0.125)),
             label(coll, "FUND", 0.035, INK, (0, -0.094, 0.088))]
    bake(parts, "UWKugelCan_body", coll, parent=root)
    return coll


ASSETS = [
    ("underworld_krupnik", build_krupnik),
    ("underworld_velvel", build_velvel),
    ("underworld_fixer", build_fixer),
    ("underworld_pickpocket", build_pickpocket),
    ("underworld_goon", build_goon),
    ("underworld_rager", build_rager),
    ("underworld_gangcar", build_gangcar),
    ("underworld_shack", build_shack),
    ("underworld_package", build_package),
    ("underworld_kugelcan", build_kugelcan),
]
