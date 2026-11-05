"""
Dina's world (features/dina): the Lev Bais Yaakov school bus + the school,
Dina's house at the end of the street, the run-home props (hydrant, mailbox,
dog, butterfly, squirrel, kickball, sprinkler, hopscotch, Mr. Whiskers the cat,
plus Dina's backpack, Mom's handbag, the crossing guard's STOP paddle and the
run medal), Mrs. Greenblatt and the schoolgirls, Morgan the plushie, Dina's
bedroom furniture, and the Cookie Catch kitchen + treats.

Multi-prop assets (dina_props, dina_room, dina_treats) hold one Empty per prop
under the root, each built around its own origin — the game clones the one it
needs with findNodes(models.dinaProps, "Hydrant")[0].
"""
import math
from lib import *
from lib_people import build_person
import assets_core


def setup():
    assets_core.setup()


# ── small helpers ────────────────────────────────────────────────────────
FACE = {  # text orientation: which way the readable face points
    "-Y": (math.pi / 2, 0, 0), "+Y": (math.pi / 2, 0, math.pi),
    "+X": (math.pi / 2, 0, math.pi / 2), "-X": (math.pi / 2, 0, -math.pi / 2), "+Z": (0, 0, 0),
    "+Zr": (0, 0, math.pi),   # flat on the ground, read from three.js -Z (walking toward +Z)
}


def bm_text_lo(body, size, extrude):
    """lib.bm_text with a coarse curve resolution (signs don't need 12 steps per curve)."""
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = body
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.extrude = extrude
    cu.resolution_u = 3
    tmp = bpy.data.objects.new("txt", cu)
    bpy.context.scene.collection.objects.link(tmp)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=size * 0.004)
    return bm


def text(coll, name, body, size, material, loc, face="-Y", extrude=0.008):
    return Part(coll, name, bm_text_lo(body, size, extrude), material, loc=loc, rot=FACE[face], smooth=False)


def group(coll, root, name):
    """An Empty under the root that one prop's baked meshes hang off."""
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "PLAIN_AXES"
    coll.objects.link(e)
    e.parent = root
    return e


def bm_arc(R, r, a0, a1, seg=10, rseg=6):
    """A bent tube: arc of radius R in the XZ plane (angles from +X toward +Z)."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        radial = Vector((math.cos(a), 0, math.sin(a)))
        c = radial * R
        ring = []
        for j in range(rseg):
            b = 2 * math.pi * j / rseg
            ring.append(bm.verts.new(c + radial * (r * math.cos(b)) + Vector((0, r * math.sin(b), 0))))
        rings.append(ring)
    for i in range(seg):
        for j in range(rseg):
            a, b = rings[i], rings[i + 1]
            bm.faces.new((a[j], b[j], b[(j + 1) % rseg], a[(j + 1) % rseg]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_heart(size, thick):
    """A puffy heart in the XZ plane (faces ±Y)."""
    pts = []
    for i in range(28):
        t = math.pi * 2 * i / 28
        x = 16 * math.sin(t) ** 3
        z = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((x / 17 * size, z / 17 * size))
    bm = bm_prism(pts, thick / 2)          # profile in (y, z), extruded along X
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "Z"))
    return bm


def octagon(coll, name, r, depth, material, loc, axis="Y"):
    """A flat-topped octagon (STOP signs)."""
    rot = {"Y": (0, math.radians(22.5), 0), "X": (math.radians(22.5), 0, 0)}[axis]
    bm = bm_cyl(r, r, depth, 8, axis)
    return Part(coll, name, bm, material, loc=loc, rot=rot, smooth=False)


def stop_sign(coll, parts, center, r, face_axis, faces):
    """Red octagon + white rim + STOP lettering on the given faces."""
    RED = mat("StopRed", "#D32F2F", rough=0.45)
    WHITE = mat("StopWhite", "#FFFFFF", rough=0.5)
    x, y, z = center
    parts.append(octagon(coll, "stopRim", r * 1.1, r * 0.08, WHITE, center, face_axis))
    parts.append(octagon(coll, "stop", r, r * 0.13, RED, center, face_axis))
    for f in faces:
        off = r * 0.075
        if f == "-Y":
            loc = (x, y - off, z)
        elif f == "+Y":
            loc = (x, y + off, z)
        elif f == "+X":
            loc = (x + off, y, z)
        else:
            loc = (x - off, y, z)
        parts.append(text(coll, "stopTxt", "STOP", r * 0.62, WHITE, loc, f, extrude=r * 0.012))


# ── the school bus ───────────────────────────────────────────────────────
def build_bus():
    """Lev Bais Yaakov's yellow school bus. Front = -Y. Door on the right (-X,
    curb side) pivots at its front edge ("Door"); the STOP arm folds on the
    driver's side (+X, "StopArm"). Flashers use LightRed + NeonAmber."""
    coll = scene_coll("DinaBus")
    root = root_empty(coll, "DinaBus")
    S = shared()
    YEL = mat("BusYellow", "#FFD426", rough=0.42)
    BLK = mat("BusBlack", "#1A1A1A", rough=0.6)
    WIN = mat("BusWindow", "#7BB8E0", rough=0.08, metal=0.15, emit=0.08)
    WHITE = mat("BusWhite", "#FFFFFF", rough=0.6)
    BLUE = mat("BusBlue", "#0D47A1", rough=0.5)
    RED = mat("LightRed", "#FF2222", rough=0.3, emit=2.5)
    AMB = mat("NeonAmber", "#FFAA22", rough=0.3, emit=2.5)
    parts = [
        Part(coll, "body", bm_box(2.4, 8.3, 2.45), YEL, loc=(0, 0.85, 1.78)).bevel(0.14, 3),
        Part(coll, "roof", bm_box(2.3, 8.2, 0.24), YEL, loc=(0, 0.85, 3.02)).bevel(0.11, 3),
        Part(coll, "hood", bm_box(2.06, 1.75, 1.12), YEL, loc=(0, -4.1, 1.12)).bevel(0.18, 3),
        Part(coll, "grille", bm_box(1.3, 0.08, 0.66), BLK, loc=(0, -4.97, 1.08)).bevel(0.03, 2),
        Part(coll, "bumperF", bm_box(2.35, 0.26, 0.26), BLK, loc=(0, -5.03, 0.62)).bevel(0.06, 2),
        Part(coll, "bumperR", bm_box(2.45, 0.26, 0.26), BLK, loc=(0, 5.05, 0.62)).bevel(0.06, 2),
        Part(coll, "under", bm_box(2.0, 9.6, 0.32), BLK, loc=(0, 0.0, 0.5)),
        Part(coll, "windshield", bm_box(2.12, 0.07, 0.95), WIN, loc=(0, -3.33, 2.28)).bevel(0.04, 2),
        Part(coll, "header", bm_box(1.2, 0.05, 0.28), YEL, loc=(0, -3.37, 2.88)),
        text(coll, "headerTxt", "SCHOOL BUS", 0.16, BLK, (0, -3.42, 2.88), "-Y"),
        Part(coll, "rearWin", bm_box(0.95, 0.07, 0.8), WIN, loc=(0, 5.02, 2.3)).bevel(0.03, 2),
        Part(coll, "rearDoor", bm_box(1.15, 0.05, 2.0), BLK, loc=(0, 5.0, 1.85)).bevel(0.03, 2),
        text(coll, "rearTxt", "SCHOOL BUS", 0.18, BLK, (0, 5.06, 2.86), "+Y"),
    ]
    for s in (-1, 1):
        parts.append(Part(coll, "head", bm_cyl(0.13, 0.13, 0.06, 14, "Y"), S.HEAD, loc=(s * 0.78, -4.98, 1.3)))
        parts.append(Part(coll, "tail", bm_cyl(0.12, 0.12, 0.06, 14, "Y"), S.TAIL, loc=(s * 0.95, 5.04, 1.0)))
        # flashers: amber inside, red outside, front and back
        for y, d in ((-3.36, 0), (5.03, 0)):
            parts.append(Part(coll, "amber", bm_cyl(0.1, 0.1, 0.1, 14, "Y"), AMB, loc=(s * 0.76, y, 2.86 if y < 0 else 2.92)))
            parts.append(Part(coll, "red", bm_cyl(0.1, 0.1, 0.1, 14, "Y"), RED, loc=(s * 1.0, y, 2.86 if y < 0 else 2.92)))
        # rub rails (the black stripes)
        for z in (0.78, 1.95):
            parts.append(Part(coll, "rail", bm_box(0.05, 8.2, 0.1), BLK, loc=(s * 1.215, 0.85, z)))
        # mirrors
        parts.append(limb(coll, "mirrorArm", (s * 1.05, -3.4, 2.3), (s * 1.42, -3.65, 2.1), 0.02, BLK))
        parts.append(Part(coll, "mirror", bm_box(0.08, 0.16, 0.32), BLK, loc=(s * 1.45, -3.67, 2.05)).bevel(0.03, 2))
        # the school's name on both sides
        face = "+X" if s > 0 else "-X"
        parts.append(Part(coll, "panel", bm_box(0.04, 4.6, 0.7), WHITE, loc=(s * 1.215, 1.3, 1.37)).bevel(0.02, 2))
        parts.append(text(coll, "name", "LEV BAIS YAAKOV", 0.34, BLUE, (s * 1.245, 1.3, 1.45), face))
        parts.append(text(coll, "school", "SCHOOL", 0.17, BLUE, (s * 1.245, 1.3, 1.16), face))
        # side windows (the curb side starts behind the door)
        y = -2.55 if s > 0 else -1.5
        while y < 4.6:
            parts.append(Part(coll, "win", bm_box(0.06, 0.92, 0.7), WIN, loc=(s * 1.2, y, 2.38)).bevel(0.03, 2))
            y += 1.12
    # door frame on the curb side
    parts.append(Part(coll, "doorFrame", bm_box(0.06, 1.0, 2.35), BLK, loc=(-1.215, -2.8, 1.55)))
    bake(parts, "DinaBus_body", coll, parent=root)

    # folding door (opens outward: rotation.y = +1.3 in three.js)
    door = [Part(coll, "door", bm_box(0.06, 0.86, 2.2), BLK, loc=(-1.25, -2.8, 1.55)).bevel(0.02, 2)]
    for z in (2.08, 1.08):
        door.append(Part(coll, "doorWin", bm_box(0.08, 0.62, 0.78), WIN, loc=(-1.25, -2.8, z)))
    bake_at(door, "Door", coll, root, (-1.25, -3.23, 1.55))

    # STOP arm on the driver's side (extends with rotation.y = -PI/2)
    arm = [Part(coll, "armBar", bm_box(0.05, 0.42, 0.05), BLK, loc=(1.27, -2.38, 1.95))]
    stop_sign(coll, arm, (1.29, -1.98, 1.95), 0.3, "X", ["+X", "-X"])
    bake_at(arm, "StopArm", coll, root, (1.27, -2.6, 1.95))

    four_wheels(coll, root, 1.05, -4.0, 3.2, 0.52, 0.34, S.TIRE, S.RIM, S.TIRE)
    anchor(coll, root, "Exhaust", (-0.9, 5.15, 0.42))
    anchor(coll, root, "DoorStep", (-1.6, -2.8, 0.05))
    return coll


# ── Lev Bais Yaakov school ───────────────────────────────────────────────
def build_school():
    coll = scene_coll("DinaSchool")
    root = root_empty(coll, "DinaSchool")
    BRICK = mat("SchoolBrick", "#B5533C", rough=0.92)
    TRIM = mat("SchoolTrim", "#FFF8E8", rough=0.7)
    WIN = mat("Window", "#9AD9F5", rough=0.1, emit=0.25)
    DOOR = mat("SchoolDoor", "#1E5AA8", rough=0.6)
    NAVY = mat("SchoolNavy", "#0D47A1", rough=0.5)
    GREY = mat("SchoolStep", "#B0ACA4", rough=0.9)
    ROOF = mat("SchoolRoof", "#5B5550", rough=0.9)
    hd = 5.0
    parts = [
        Part(coll, "main", bm_box(18, 10, 7.4), BRICK, loc=(0, 0, 3.7), smooth=False),
        Part(coll, "cornice", bm_box(18.5, 10.5, 0.45), TRIM, loc=(0, 0, 7.5), smooth=False),
        Part(coll, "roof", bm_box(17.6, 9.6, 0.5), ROOF, loc=(0, 0, 7.8), smooth=False),
        Part(coll, "base", bm_box(18.2, 10.2, 0.6), GREY, loc=(0, 0, 0.3), smooth=False),
        Part(coll, "door", bm_box(2.4, 0.12, 2.5), DOOR, loc=(0, -hd - 0.05, 1.25), smooth=False),
        Part(coll, "doorLine", bm_box(0.05, 0.14, 2.5), TRIM, loc=(0, -hd - 0.06, 1.25), smooth=False),
        Part(coll, "doorFrame", bm_box(2.8, 0.08, 2.75), TRIM, loc=(0, -hd - 0.02, 1.35), smooth=False),
        Part(coll, "canopy", bm_box(3.8, 1.7, 0.2), TRIM, loc=(0, -hd - 0.85, 2.95), smooth=False),
        Part(coll, "step1", bm_box(3.8, 1.4, 0.16), GREY, loc=(0, -hd - 0.7, 0.08), smooth=False),
        Part(coll, "step2", bm_box(3.2, 0.8, 0.16), GREY, loc=(0, -hd - 0.4, 0.24), smooth=False),
        Part(coll, "sign", bm_box(8.4, 0.12, 0.95), NAVY, loc=(0, -hd - 0.08, 3.78)).bevel(0.05, 2),
        text(coll, "signTxt", "LEV BAIS YAAKOV", 0.6, TRIM, (0, -hd - 0.16, 3.78), "-Y", extrude=0.02),
        Part(coll, "bell", bm_cyl(0.32, 0.18, 0.4, 14), mat("SchoolBell", "#C9A227", rough=0.3, metal=0.8), loc=(0, -hd + 0.4, 8.45)),
        Part(coll, "belfry", bm_box(1.2, 1.2, 0.12), TRIM, loc=(0, -hd + 0.4, 8.95), smooth=False),
    ]
    for s in (-1, 1):
        parts.append(limb(coll, "post", (s * 1.7, -hd - 1.6, 0), (s * 1.7, -hd - 1.6, 2.9), 0.08, TRIM))
        parts.append(limb(coll, "bpost", (s * 0.5, -hd + 0.4, 7.9), (s * 0.5, -hd + 0.4, 8.95), 0.06, TRIM))
    for row, z in ((0, 1.9), (1, 5.4)):
        for i in range(7):
            x = -7.5 + i * 2.5
            if row == 0 and abs(x) < 2:
                continue
            parts.append(Part(coll, "wf", bm_box(1.6, 0.08, 1.75), TRIM, loc=(x, -hd - 0.02, z), smooth=False))
            parts.append(Part(coll, "w", bm_box(1.3, 0.1, 1.45), WIN, loc=(x, -hd - 0.04, z), smooth=False))
            parts.append(Part(coll, "wm", bm_box(0.06, 0.12, 1.45), TRIM, loc=(x, -hd - 0.06, z), smooth=False))
            parts.append(Part(coll, "sill", bm_box(1.7, 0.25, 0.1), TRIM, loc=(x, -hd - 0.12, z - 0.85), smooth=False))
    # children's paper cut-outs in two windows
    for x, c in ((-5.0, "#FF80AB"), (5.0, "#FFD54F"), (7.5, "#81D4FA")):
        parts.append(Part(coll, "art", bm_heart(0.32, 0.02), mat("SchoolArt" + c[1:], c, rough=0.8), loc=(x, -hd - 0.1, 5.4)))
    bake(parts, "DinaSchool_body", coll, parent=root)
    return coll


# ── Dina's house (end of the street) ─────────────────────────────────────
def build_home():
    coll = scene_coll("DinaHome")
    root = root_empty(coll, "DinaHome")
    WALLS = mat("Walls", "#A1887F", rough=0.9)
    ROOF = mat("Roof", "#5D4037", rough=0.85)
    TRIM = mat("HomeTrim", "#FFF8E8", rough=0.7)
    DOOR = mat("HomeDoor", "#3E2723", rough=0.6)
    WIN = mat("HomeWindow", "#FFE082", rough=0.2, emit=0.9)
    w, d, wh, rh = 10.0, 8.0, 3.4, 2.5
    hd = d / 2
    parts = assets_core.house_parts(coll, w, d, wh, rh, WALLS, ROOF, TRIM, DOOR, WIN, porch=True)
    GOLD = mat("HomeGold", "#FFD700", rough=0.4, metal=0.2)
    BROWN = mat("HomeBrown", "#5D4037", rough=0.6)
    HEART = mat("HomeHeart", "#E53935", rough=0.5)
    MAT = mat("HomeMat", "#D32F2F", rough=0.9)
    MATTXT = mat("HomeMatTxt", "#FFEB3B", rough=0.8)
    py = -hd - 2.3
    parts += [
        Part(coll, "signBack", bm_box(2.7, 0.1, 0.72), BROWN, loc=(0, py, 3.2)).bevel(0.05, 2),
        Part(coll, "sign", bm_box(2.5, 0.12, 0.56), GOLD, loc=(0, py, 3.2)).bevel(0.05, 2),
        text(coll, "signTxt", "HOME", 0.42, BROWN, (-0.25, py - 0.08, 3.2), "-Y", extrude=0.015),
        Part(coll, "signHeart", bm_heart(0.2, 0.08), HEART, loc=(0.82, py - 0.08, 3.2)),
        Part(coll, "welcome", bm_box(1.4, 0.75, 0.04), MAT, loc=(0, -hd - 0.65, 0.27)),
        text(coll, "welcomeTxt", "WELCOME", 0.17, MATTXT, (0, -hd - 0.65, 0.3), "+Z", extrude=0.006),
        Part(coll, "path", bm_box(1.5, 6.0, 0.04), mat("HomePath", "#D7CCC8", rough=0.95), loc=(0, -hd - 5.2, 0.02), smooth=False),
    ]
    parts.append(Part(coll, "step", bm_box(1.6, 0.5, 0.12), TRIM, loc=(0, -hd - 2.45, 0.06), smooth=False))
    for s in (-1, 1):
        parts.append(Part(coll, "flowerbed", bm_box(1.3, 0.7, 0.3), mat("HomeBed", "#6D4C41", rough=0.95), loc=(s * 4.35, -hd - 0.45, 0.15), smooth=False))
        for k in range(3):
            col = ("#FF6F91", "#FFD54F", "#BA68C8", "#FF8A65")[(k + (s > 0)) % 4]
            parts.append(Part(coll, "flower", bm_ico(0.14), mat("HomeFlower" + col[1:], col, rough=0.7),
                              loc=(s * 4.35 - 0.4 + k * 0.4, -hd - 0.45, 0.42), smooth=False))
        for k in range(7):
            parts.append(Part(coll, "picket", bm_box(0.12, 0.06, 0.95), TRIM, loc=(s * (1.2 + k * 0.55), -hd - 7.6, 0.48), smooth=False))
        parts.append(Part(coll, "rail", bm_box(3.6, 0.05, 0.08), TRIM, loc=(s * 2.85, -hd - 7.57, 0.7), smooth=False))
    bake(parts, "DinaHome_body", coll, parent=root)
    return coll


# ── props: the run-home hazards + attachments ────────────────────────────
def build_props():
    coll = scene_coll("DinaProps")
    root = root_empty(coll, "DinaProps")

    # Hydrant
    g = group(coll, root, "Hydrant")
    RED = mat("HydrantRed", "#C62828", rough=0.5)
    CAP = mat("HydrantCap", "#FFEB3B", rough=0.45)
    p = [Part(coll, "base", bm_cyl(0.2, 0.2, 0.08, 16), RED, loc=(0, 0, 0.04)),
         Part(coll, "barrel", bm_cyl(0.14, 0.15, 0.5, 16), RED, loc=(0, 0, 0.32)),
         Part(coll, "ring", bm_cyl(0.18, 0.18, 0.06, 16), RED, loc=(0, 0, 0.56)),
         Part(coll, "dome", bm_sphere(0.15, 0.15, 0.12), CAP, loc=(0, 0, 0.6)),
         Part(coll, "nut", bm_cyl(0.04, 0.05, 0.08, 6), CAP, loc=(0, 0, 0.73), smooth=False),
         Part(coll, "front", bm_cyl(0.07, 0.07, 0.12, 12, "Y"), CAP, loc=(0, -0.17, 0.36))]
    for s in (-1, 1):
        p.append(Part(coll, "side", bm_cyl(0.05, 0.05, 0.12, 12, "X"), RED, loc=(s * 0.17, 0, 0.42)))
        p.append(Part(coll, "sidecap", bm_cyl(0.055, 0.055, 0.03, 12, "X"), CAP, loc=(s * 0.235, 0, 0.42)))
    bake(p, "Hydrant_mesh", coll, parent=g)

    # Mailbox with the crayon "GO DINA!" sign
    g = group(coll, root, "Mailbox")
    POST = mat("MailPost", "#5D4037", rough=0.8)
    BOX = mat("MailBlue", "#1565C0", rough=0.4)
    PAPER = mat("MailPaper", "#FFFFFF", rough=0.9)
    PINK = mat("MailPink", "#FF4FA3", rough=0.7)
    p = [Part(coll, "post", bm_box(0.1, 0.1, 1.0), POST, loc=(0, 0, 0.5), smooth=False),
         Part(coll, "box", bm_box(0.32, 0.55, 0.26), BOX, loc=(0, 0, 1.1)).bevel(0.1, 3),
         Part(coll, "door", bm_box(0.3, 0.03, 0.24), mat("MailDoor", "#0D47A1", rough=0.4), loc=(0, -0.28, 1.1)).bevel(0.04, 2),
         Part(coll, "flag", bm_box(0.02, 0.05, 0.22), mat("LightRed", "#FF1744", rough=0.4, emit=0.4), loc=(0.17, 0.1, 1.24)),
         Part(coll, "flagTop", bm_box(0.02, 0.14, 0.07), mat("LightRed", "#FF1744"), loc=(0.17, 0.05, 1.33)),
         Part(coll, "sign", bm_box(0.5, 0.02, 0.2), PAPER, loc=(0, -0.08, 0.72), rot=(0, 0, 0.0)),
         text(coll, "signTxt", "GO DINA!", 0.085, PINK, (0, -0.1, 0.72), "-Y", extrude=0.003),
         Part(coll, "string", bm_box(0.01, 0.01, 0.2), POST, loc=(0, -0.07, 0.86))]
    bake(p, "Mailbox_mesh", coll, parent=g)

    # Golden retriever (Tail wags; the leash trails on the ground)
    g = group(coll, root, "Dog")
    FUR = mat("DogFur", "#F4A460", rough=0.85)
    EAR = mat("DogEar", "#CD853F", rough=0.85)
    DARK = mat("DogDark", "#1B1B1B", rough=0.3)
    TONGUE = mat("DogTongue", "#FF8A9A", rough=0.6)
    LEASH = mat("DogLeash", "#8E24AA", rough=0.6)
    p = [Part(coll, "body", bm_sphere(0.19, 0.38, 0.19), FUR, loc=(0, 0, 0.46)),
         Part(coll, "chest", bm_sphere(0.17, 0.16, 0.2), FUR, loc=(0, -0.26, 0.52)),
         Part(coll, "head", bm_sphere(0.15, 0.15, 0.14), FUR, loc=(0, -0.42, 0.7)),
         Part(coll, "snout", bm_sphere(0.085, 0.11, 0.07), FUR, loc=(0, -0.56, 0.65)),
         Part(coll, "nose", bm_sphere(0.04, 0.03, 0.03), DARK, loc=(0, -0.665, 0.68)),
         Part(coll, "tongue", bm_sphere(0.035, 0.04, 0.012), TONGUE, loc=(0, -0.6, 0.595), rot=(0.3, 0, 0)),
         Part(coll, "collar", bm_torus(0.12, 0.022, 16, 6), LEASH, loc=(0, -0.33, 0.6), rot=(1.2, 0, 0))]
    for s in (-1, 1):
        p.append(Part(coll, "ear", bm_sphere(0.05, 0.05, 0.11), EAR, loc=(s * 0.13, -0.4, 0.66), rot=(0, s * 0.25, 0)))
        p.append(Part(coll, "eye", bm_sphere(0.022, 0.015, 0.024), DARK, loc=(s * 0.06, -0.545, 0.74)))
        for y in (-0.24, 0.24):
            p.append(Part(coll, "leg", bm_cyl(0.05, 0.045, 0.34, 10), FUR, loc=(s * 0.1, y, 0.18)))
            p.append(Part(coll, "paw", bm_sphere(0.055, 0.07, 0.035), FUR, loc=(s * 0.1, y - 0.02, 0.03)))
    # the dropped leash
    pts = [(0, -0.33, 0.55), (0.05, -0.1, 0.25), (0.12, 0.1, 0.03), (0.2, 0.45, 0.02), (0.1, 0.7, 0.02)]
    for a, b in zip(pts, pts[1:]):
        p.append(limb(coll, "leash", a, b, 0.012, LEASH))
    p.append(Part(coll, "loop", bm_torus(0.07, 0.012, 12, 5), LEASH, loc=(0.06, 0.78, 0.02)))
    bake(p, "Dog_mesh", coll, parent=g)
    bake_at([Part(coll, "tail", bm_sphere(0.05, 0.22, 0.05), FUR, loc=(0, 0.5, 0.62), rot=(0.7, 0, 0))],
            "DogTail", coll, g, (0, 0.36, 0.52))

    # Butterfly (Wing_L / Wing_R flap around the body)
    g = group(coll, root, "Butterfly")
    W1 = mat("WingPink", "#FF80AB", rough=0.5)
    W2 = mat("WingLight", "#FFCDD2", rough=0.5)
    BODY = mat("FlyBody", "#212121", rough=0.5)
    p = [Part(coll, "body", bm_sphere(0.022, 0.09, 0.022), BODY, loc=(0, 0, 0))]
    for s in (-1, 1):
        p.append(limb(coll, "ant", (0, -0.08, 0.01), (s * 0.04, -0.16, 0.06), 0.004, BODY))
        p.append(Part(coll, "antTip", bm_sphere(0.01), BODY, loc=(s * 0.04, -0.16, 0.06)))
    bake(p, "Butterfly_body", coll, parent=g)
    for nm, s in (("Wing_L", 1), ("Wing_R", -1)):
        wp = [Part(coll, "upper", bm_sphere(0.12, 0.085, 0.006), W1, loc=(s * 0.12, -0.035, 0), rot=(0, 0, s * 0.35)),
              Part(coll, "lower", bm_sphere(0.075, 0.06, 0.006), W2, loc=(s * 0.08, 0.06, 0), rot=(0, 0, -s * 0.3)),
              Part(coll, "spot", bm_sphere(0.03, 0.03, 0.008), mat("WingSpot", "#FFF59D", rough=0.5), loc=(s * 0.15, -0.04, 0.002))]
        bake_at(wp, nm, coll, g, (0, 0, 0))

    # Squirrel with an acorn (big bushy tail)
    g = group(coll, root, "Squirrel")
    SQ = mat("SquirrelFur", "#8D6E63", rough=0.85)
    SQL = mat("SquirrelBelly", "#D7CCC8", rough=0.85)
    NUT = mat("Acorn", "#A0522D", rough=0.6)
    NUTCAP = mat("AcornCap", "#5D4037", rough=0.8)
    p = [Part(coll, "body", bm_sphere(0.09, 0.11, 0.12), SQ, loc=(0, 0, 0.13)),
         Part(coll, "belly", bm_sphere(0.06, 0.04, 0.08), SQL, loc=(0, -0.07, 0.13)),
         Part(coll, "head", bm_sphere(0.075, 0.08, 0.07), SQ, loc=(0, -0.06, 0.27)),
         Part(coll, "nose", bm_sphere(0.015), mat("SquirrelNose", "#3E2723"), loc=(0, -0.14, 0.27)),
         Part(coll, "acorn", bm_sphere(0.032, 0.03, 0.04), NUT, loc=(0, -0.13, 0.18)),
         Part(coll, "acornCap", bm_sphere(0.034, 0.032, 0.018), NUTCAP, loc=(0, -0.13, 0.215))]
    for s in (-1, 1):
        p.append(Part(coll, "ear", bm_cyl(0.025, 0.0, 0.05, 6), SQ, loc=(s * 0.04, -0.04, 0.34), smooth=False))
        p.append(Part(coll, "eye", bm_sphere(0.014), mat("SquirrelEye", "#111111", rough=0.2), loc=(s * 0.04, -0.125, 0.29)))
        p.append(Part(coll, "foot", bm_sphere(0.03, 0.05, 0.02), SQ, loc=(s * 0.05, -0.03, 0.015)))
    for i, (y, z, r) in enumerate(((0.1, 0.1, 0.07), (0.17, 0.2, 0.085), (0.19, 0.32, 0.09), (0.15, 0.43, 0.08), (0.08, 0.48, 0.06))):
        p.append(Part(coll, "tail", bm_sphere(r * 0.9, r, r), SQ, loc=(0, y, z)))
    bake(p, "Squirrel_mesh", coll, parent=g)

    # Kickball
    g = group(coll, root, "Kickball")
    KR = mat("KickRed", "#F44336", rough=0.55)
    KS = mat("KickSeam", "#FFCDD2", rough=0.6)
    p = [Part(coll, "ball", bm_sphere(0.22, 0.22, 0.22, 20, 14), KR, loc=(0, 0, 0.22)),
         Part(coll, "seam1", bm_torus(0.221, 0.008, 28, 4), KS, loc=(0, 0, 0.22), rot=(math.pi / 2, 0, 0)),
         Part(coll, "seam2", bm_torus(0.221, 0.008, 28, 4), KS, loc=(0, 0, 0.22), rot=(math.pi / 2, 0, math.pi / 2))]
    bake(p, "Kickball_mesh", coll, parent=g)

    # Sprinkler (SprinklerHead spins; translucent water arcs)
    g = group(coll, root, "Sprinkler")
    METAL = mat("SprinklerMetal", "#37474F", rough=0.5, metal=0.3)
    GREEN = mat("SprinklerGreen", "#43A047", rough=0.6)
    WATER = mat("WaterSpray", "#4FC3F7", rough=0.1, emit=0.2)
    p = [Part(coll, "base", bm_cyl(0.16, 0.18, 0.05, 14), GREEN, loc=(0, 0, 0.025)),
         Part(coll, "stem", bm_cyl(0.03, 0.03, 0.18, 10), METAL, loc=(0, 0, 0.12)),
         Part(coll, "hose", bm_torus(0.25, 0.025, 16, 6), GREEN, loc=(0.32, 0.1, 0.03))]
    bake(p, "Sprinkler_base", coll, parent=g)
    hp = [Part(coll, "head", bm_cyl(0.05, 0.04, 0.06, 10), METAL, loc=(0, 0, 0.24)),
          Part(coll, "arm", bm_box(0.3, 0.03, 0.03), METAL, loc=(0, 0, 0.27))]
    for k in range(6):
        a = k * math.pi * 2 / 6
        arc = Part(coll, "arc", bm_arc(0.55, 0.014, math.pi, -0.16 * math.pi, 14, 5), WATER, loc=(0, 0, 0.27), rot=(0, 0, a))
        arc.ob.data.transform(Matrix.Translation((0.55, 0, 0)))
        hp.append(arc)
    bake_at(hp, "SprinklerHead", coll, g, (0, 0, 0.24))

    # Hopscotch (chalk on the ground)
    g = group(coll, root, "Hopscotch")
    CH = mat("ChalkYellow", "#FFC107", rough=0.95, emit=0.15)
    CP = mat("ChalkPink", "#FF4FA3", rough=0.95, emit=0.15)
    CB = mat("ChalkBlue", "#4FC3F7", rough=0.95, emit=0.15)
    p = []
    sq = 0.48
    for i in range(3):
        y = -sq + i * sq
        for (dx, dy, sx, sy) in ((-sq / 2, 0, 0.03, sq), (sq / 2, 0, 0.03, sq), (0, -sq / 2, sq, 0.03), (0, sq / 2, sq, 0.03)):
            p.append(Part(coll, "chalk", bm_box(sx, sy, 0.008), CH, loc=(dx, y + dy, 0.006), smooth=False))
        p.append(text(coll, "num", str(3 - i), 0.26, (CP, CB, CP)[i], (0, y, 0.012), "+Zr", extrude=0.003))
    bake(p, "Hopscotch_mesh", coll, parent=g)

    # Mr. Whiskers, napping (orange tabby, lying down)
    g = group(coll, root, "Cat")
    OR = mat("CatOrange", "#FF7043", rough=0.85)
    ORL = mat("CatLight", "#FFAB91", rough=0.85)
    STR = mat("CatStripe", "#E64A19", rough=0.85)
    CD = mat("CatDark", "#2B1B1B", rough=0.4)
    p = [Part(coll, "body", bm_sphere(0.15, 0.3, 0.12), OR, loc=(0, 0.02, 0.12)),
         Part(coll, "belly", bm_sphere(0.11, 0.24, 0.06), ORL, loc=(0.05, 0.02, 0.06)),
         Part(coll, "head", bm_sphere(0.12, 0.11, 0.1), OR, loc=(0, -0.32, 0.13)),
         Part(coll, "muzzle", bm_sphere(0.06, 0.04, 0.04), ORL, loc=(0, -0.41, 0.1)),
         Part(coll, "nose", bm_sphere(0.014), mat("CatNose", "#FF8AAA"), loc=(0, -0.445, 0.12))]
    for s in (-1, 1):
        p.append(Part(coll, "ear", bm_cyl(0.045, 0.0, 0.08, 4), OR, loc=(s * 0.07, -0.3, 0.24), rot=(0, s * 0.3, 0), smooth=False))
        p.append(Part(coll, "eye", bm_arc(0.025, 0.006, math.pi * 1.1, math.pi * 1.9, 8, 4), CD, loc=(s * 0.045, -0.405, 0.16)))
        p.append(Part(coll, "paw", bm_sphere(0.045, 0.07, 0.03), ORL, loc=(s * 0.06, -0.42, 0.03)))
    for y in (-0.12, 0.0, 0.12):
        p.append(Part(coll, "stripe", bm_box(0.2, 0.035, 0.02), STR, loc=(0, y, 0.235), smooth=False))
    tail = [(0.08, 0.3, 0.06), (0.17, 0.32, 0.04), (0.22, 0.18, 0.03), (0.2, 0.02, 0.03)]
    for a, b in zip(tail, tail[1:]):
        p.append(limb(coll, "tail", a, b, 0.035, OR))
    bake(p, "Cat_mesh", coll, parent=g)

    # Dina's backpack (navy, with the unicorn keychain) — attach to Dina's Body
    g = group(coll, root, "Backpack")
    NAVY = mat("PackNavy", "#1F2D5C", rough=0.7)
    NAVY2 = mat("PackPocket", "#2C3E7A", rough=0.7)
    UNI = mat("PackUnicorn", "#FFB0C8", rough=0.6)
    HORN = mat("PackHorn", "#FFD54F", rough=0.3, metal=0.4)
    p = [Part(coll, "bag", bm_box(0.26, 0.13, 0.3), NAVY, loc=(0, 0, 0)).bevel(0.05, 3),
         Part(coll, "pocket", bm_box(0.2, 0.05, 0.13), NAVY2, loc=(0, 0.075, -0.06)).bevel(0.03, 2),
         Part(coll, "handle", bm_torus(0.04, 0.01, 10, 4), NAVY2, loc=(0, 0, 0.165), rot=(0, math.pi / 2, 0)),
         limb(coll, "chain", (0.1, 0.1, -0.1), (0.1, 0.11, -0.16), 0.004, HORN),
         Part(coll, "uni", bm_sphere(0.025), UNI, loc=(0.1, 0.11, -0.18)),
         Part(coll, "horn", bm_cyl(0.008, 0.0, 0.03, 6), HORN, loc=(0.1, 0.11, -0.15), smooth=False)]
    for s in (-1, 1):
        p.append(Part(coll, "strap", bm_box(0.04, 0.03, 0.3), NAVY2, loc=(s * 0.08, -0.08, 0.02)))
    bake(p, "Backpack_mesh", coll, parent=g)

    # Mom's handbag — attach to her hand
    g = group(coll, root, "Handbag")
    BAG = mat("BagBrown", "#5D4037", rough=0.6)
    BGOLD = mat("BagGold", "#FFD700", rough=0.3, metal=0.6)
    p = [Part(coll, "bag", bm_box(0.24, 0.09, 0.18), BAG, loc=(0, 0, -0.1)).bevel(0.03, 2),
         Part(coll, "band", bm_box(0.245, 0.095, 0.025), BGOLD, loc=(0, 0, -0.05)),
         Part(coll, "clasp", bm_sphere(0.016), BGOLD, loc=(0, -0.05, -0.06)),
         Part(coll, "handle", bm_arc(0.08, 0.008, 0, math.pi, 10, 4), BAG, loc=(0, 0, -0.01))]
    bake(p, "Handbag_mesh", coll, parent=g)

    # Mrs. Greenblatt's STOP paddle (handle up from the grip at the origin)
    g = group(coll, root, "StopPaddle")
    p = [Part(coll, "handle", bm_cyl(0.018, 0.018, 0.55, 8), mat("PaddleHandle", "#5D4037", rough=0.7), loc=(0, 0, 0.18))]
    stop_sign(coll, p, (0, 0, 0.6), 0.17, "Y", ["-Y", "+Y"])
    bake(p, "StopPaddle_mesh", coll, parent=g)

    # The run medal: MedalMetal/MedalRim recolour for silver + bronze; Num1/2/3
    g = group(coll, root, "Medal")
    METALM = mat("MedalMetal", "#FFC107", rough=0.25, metal=0.85)
    RIM = mat("MedalRim", "#8D6E00", rough=0.3, metal=0.8)
    RIBP = mat("RibbonPink", "#E91E63", rough=0.6)
    RIBB = mat("RibbonBlue", "#42A5F5", rough=0.6)
    p = [Part(coll, "disc", bm_cyl(0.2, 0.2, 0.04, 28, "Y"), METALM, loc=(0, 0, 0)),
         Part(coll, "rim", bm_torus(0.2, 0.018, 28, 6), RIM, loc=(0, 0, 0), rot=(math.pi / 2, 0, 0)),
         Part(coll, "ribL", bm_box(0.11, 0.015, 0.42), RIBP, loc=(-0.08, 0.01, 0.36), rot=(0, 0.35, 0)),
         Part(coll, "ribR", bm_box(0.11, 0.015, 0.42), RIBB, loc=(0.08, 0.012, 0.36), rot=(0, -0.35, 0))]
    bake(p, "Medal_mesh", coll, parent=g)
    for n in (1, 2, 3):
        bake([text(coll, "num", str(n), 0.22, RIM, (0, -0.03, -0.01), "-Y", extrude=0.012),
              text(coll, "numB", str(n), 0.22, RIM, (0, 0.03, -0.01), "+Y", extrude=0.012)], "Num%d" % n, coll, parent=g)

    # lay the groups out for browsing in the .blend (the game re-positions clones)
    for i, o in enumerate(o for o in coll.objects if o.parent == root):
        o.location.x = i * 1.2
    return coll


# ── people ───────────────────────────────────────────────────────────────
def build_greenblatt():
    # Mrs. Greenblatt, the crossing guard: sheitel, glasses, yellow safety vest.
    return build_person("Greenblatt", dict(hair="sheitel", hair_color="#6D4C41", top="#ECEFF1", bottom="skirt",
                        bottom_color="#37474F", shoes="#111111", extras=["glasses", "vest"],
                        extra_colors={"Vest": "#FBC02D", "Glasses": "#1A1A1A"}))


def schoolgirl(name, hair, hair_color, extras=()):
    # Lev Bais Yaakov uniform: white blouse, navy pleated skirt.
    return build_person(name, dict(hair=hair, hair_color=hair_color, top="#FFFFFF", bottom="skirt", bottom_color="#1F2D5C",
                        shoes="#111111", height=1.16, kid=True, extras=list(extras)))


# ── Morgan the plushie ───────────────────────────────────────────────────
def build_morgan():
    """Dina's lavender cat plushie. Sits ~0.62 m tall (the room scales it down).
    EyesOpen / EyesHappy toggle with her mood; Tail wags."""
    coll = scene_coll("DinaMorgan")
    root = root_empty(coll, "DinaMorgan")
    LAV = mat("MorganFur", "#9B8FB4", rough=0.95)
    BELLY = mat("MorganBelly", "#D4C9E8", rough=0.95)
    STITCH = mat("MorganStitch", "#7A6FA0", rough=0.9)
    PINK = mat("MorganPink", "#FFB8D9", rough=0.9)
    CHEEK = mat("MorganCheek", "#FFAACC", rough=0.9)
    NOSE = mat("MorganNose", "#E88AAA", rough=0.6)
    MOUTH = mat("MorganMouth", "#A0394D", rough=0.6)
    HEART = mat("MorganHeart", "#FF6B9D", rough=0.6)
    p = [Part(coll, "body", bm_sphere(0.17, 0.15, 0.19), LAV, loc=(0, 0, 0.19)),
         Part(coll, "belly", bm_sphere(0.115, 0.05, 0.12), BELLY, loc=(0, -0.115, 0.17)),
         Part(coll, "head", bm_sphere(0.17, 0.155, 0.155, 24, 16), LAV, loc=(0, -0.01, 0.46)),
         Part(coll, "heart", bm_heart(0.04, 0.02), HEART, loc=(0, -0.168, 0.23)),
         Part(coll, "nose", bm_sphere(0.018, 0.01, 0.013), NOSE, loc=(0, -0.164, 0.44))]
    for k in range(5):
        p.append(Part(coll, "stitch", bm_box(0.005, 0.01, 0.02), STITCH, loc=(0, -0.165, 0.08 + k * 0.035), smooth=False))
    for s in (-1, 1):
        p.append(Part(coll, "paw", bm_sphere(0.06, 0.075, 0.045), LAV, loc=(s * 0.08, -0.12, 0.045)))
        p.append(Part(coll, "pawPad", bm_sphere(0.03, 0.01, 0.022), PINK, loc=(s * 0.08, -0.195, 0.045)))
        p.append(Part(coll, "leg", bm_sphere(0.07, 0.09, 0.06), LAV, loc=(s * 0.14, -0.04, 0.05)))
        p.append(Part(coll, "ear", bm_cyl(0.065, 0.0, 0.12, 4), LAV, loc=(s * 0.095, 0.0, 0.6), rot=(0, s * 0.35, math.pi / 4), smooth=False))
        p.append(Part(coll, "earIn", bm_cyl(0.04, 0.0, 0.08, 4), PINK, loc=(s * 0.093, -0.03, 0.592), rot=(0, s * 0.35, math.pi / 4), smooth=False))
        p.append(Part(coll, "cheek", bm_sphere(0.032, 0.01, 0.024), CHEEK, loc=(s * 0.105, -0.135, 0.42)))
        p.append(Part(coll, "mouth", bm_arc(0.014, 0.0035, math.pi * 1.05, math.pi * 1.95, 8, 4), MOUTH, loc=(s * 0.014, -0.166, 0.425)))
    bake(p, "Morgan_body", coll, parent=root)
    EYE = mat("MorganEye", "#2A2438", rough=0.3)
    SHINE = mat("MorganShine", "#FFFFFF", rough=0.2)
    eo = []
    for s in (-1, 1):
        eo.append(Part(coll, "eye", bm_sphere(0.024, 0.012, 0.032), EYE, loc=(s * 0.058, -0.15, 0.47)))
        eo.append(Part(coll, "shine", bm_sphere(0.008, 0.006, 0.008), SHINE, loc=(s * 0.058 + 0.008, -0.161, 0.482)))
    bake(eo, "EyesOpen", coll, parent=root)
    eh = [Part(coll, "eyeHappy", bm_arc(0.024, 0.006, math.pi * 0.12, math.pi * 0.88, 10, 5), EYE, loc=(s * 0.058, -0.152, 0.462))
          for s in (-1, 1)]
    bake(eh, "EyesHappy", coll, parent=root)
    tl = [(0.12, 0.1, 0.06), (0.2, 0.06, 0.07), (0.23, -0.04, 0.1), (0.2, -0.1, 0.14)]
    bake_at([limb(coll, "tail", a, b, 0.035, LAV) for a, b in zip(tl, tl[1:])] +
            [Part(coll, "tailTip", bm_sphere(0.036), LAV, loc=tl[-1])], "Tail", coll, root, tl[0])
    return coll


# ── Dina's bedroom furniture ─────────────────────────────────────────────
def build_room():
    """One Empty per piece; the game lays the room out (see features/dina/home.js)."""
    coll = scene_coll("DinaRoom")
    root = root_empty(coll, "DinaRoom")
    WOOD = mat("RoomWood", "#8D6E63", rough=0.7)
    WOODD = mat("RoomWoodDark", "#5D4037", rough=0.7)
    QUILT = mat("Quilt", "#F4A4B8", rough=0.95)
    PATCH = mat("QuiltPatch", "#E091A6", rough=0.95)
    SHEET = mat("Sheet", "#FFF6FA", rough=0.9)
    PILLOW = mat("Pillow", "#FFFFFF", rough=0.9)
    MINT = mat("Mint", "#B8E0D2", rough=0.95)
    TEDDY = mat("Teddy", "#A1887F", rough=0.95)
    INK = mat("RoomInk", "#1B1B1B", rough=0.4)

    # Bed: headboard at +Y (against the wall), foot toward -Y. 1.3 x 2.2 m.
    g = group(coll, root, "Bed")
    p = [Part(coll, "frame", bm_box(1.4, 2.25, 0.32), WOOD, loc=(0, 0, 0.3)).bevel(0.05, 2),
         Part(coll, "headboard", bm_box(1.5, 0.12, 1.15), WOODD, loc=(0, 1.12, 0.58)).bevel(0.06, 3),
         Part(coll, "headCap", bm_cyl(0.09, 0.09, 1.56, 12, "X"), WOODD, loc=(0, 1.12, 1.16)),
         Part(coll, "footboard", bm_box(1.5, 0.1, 0.62), WOODD, loc=(0, -1.12, 0.36)).bevel(0.05, 3),
         Part(coll, "mattress", bm_box(1.3, 2.1, 0.2), SHEET, loc=(0, 0, 0.56)).bevel(0.06, 3),
         Part(coll, "pillow", bm_box(0.95, 0.42, 0.16), PILLOW, loc=(0, 0.78, 0.72)).bevel(0.07, 3),
         Part(coll, "teddy", bm_sphere(0.09, 0.08, 0.1), TEDDY, loc=(-0.36, 0.84, 0.86)),
         Part(coll, "teddyHead", bm_sphere(0.075), TEDDY, loc=(-0.36, 0.82, 0.99))]
    for s in (-1, 1):
        p.append(Part(coll, "teddyEar", bm_sphere(0.03), TEDDY, loc=(-0.36 + s * 0.055, 0.83, 1.06)))
        p.append(Part(coll, "teddyEye", bm_sphere(0.01), INK, loc=(-0.36 + s * 0.025, 0.755, 1.0)))
        for y in (-1.05, 1.05):
            p.append(Part(coll, "leg", bm_box(0.1, 0.1, 0.16), WOODD, loc=(s * 0.62, y, 0.08)))
    bake(p, "Bed_mesh", coll, parent=g)
    # Quilt: origin at the FOOT edge so scaling Y pulls it up toward the pillow
    q = [Part(coll, "quilt", bm_box(1.38, 1.6, 0.08), QUILT, loc=(0, -0.3, 0.7)).bevel(0.035, 3)]
    for x in (-0.35, 0.0, 0.35):
        q.append(Part(coll, "patchX", bm_box(0.02, 1.58, 0.082), PATCH, loc=(x, -0.3, 0.701), smooth=False))
    for y in (-0.8, -0.4, 0.0, 0.4):
        q.append(Part(coll, "patchY", bm_box(1.36, 0.02, 0.082), PATCH, loc=(0, y, 0.701), smooth=False))
    for s in (-1, 1):
        q.append(Part(coll, "drape", bm_box(0.05, 1.6, 0.34), QUILT, loc=(s * 0.69, -0.3, 0.54)).bevel(0.02, 2))
    q.append(Part(coll, "fold", bm_box(1.4, 0.36, 0.12), MINT, loc=(0, -0.92, 0.74)).bevel(0.05, 3))
    bake_at(q, "Quilt", coll, g, (0, -1.1, 0.7))

    # Nightstand + lamp (LampShade glows; dims at night)
    g = group(coll, root, "Nightstand")
    SHADE = mat("LampShade", "#FFE082", rough=0.6, emit=1.6)
    p = [Part(coll, "stand", bm_box(0.5, 0.45, 0.55), mat("StandWood", "#7B5A48", rough=0.7), loc=(0, 0, 0.275)).bevel(0.03, 2),
         Part(coll, "drawer", bm_box(0.42, 0.02, 0.18), WOODD, loc=(0, -0.23, 0.36)).bevel(0.01, 1),
         Part(coll, "knob", bm_sphere(0.025), mat("Brass", "#FFD54F", rough=0.3, metal=0.7), loc=(0, -0.25, 0.36)),
         Part(coll, "lampBase", bm_cyl(0.08, 0.1, 0.05, 14), WOODD, loc=(0.05, 0.02, 0.575)),
         Part(coll, "lampStem", bm_cyl(0.015, 0.015, 0.26, 8), WOOD, loc=(0.05, 0.02, 0.72)),
         Part(coll, "shade", bm_cyl(0.16, 0.1, 0.2, 18), SHADE, loc=(0.05, 0.02, 0.9)),
         Part(coll, "book", bm_box(0.14, 0.2, 0.04), mat("BookBlue", "#4FC3F7"), loc=(-0.14, -0.04, 0.57), rot=(0, 0, 0.3))]
    bake(p, "Nightstand_mesh", coll, parent=g)

    # Toy chest (purple) with a teddy + a yo-yo peeking out
    g = group(coll, root, "ToyChest")
    PUR = mat("ChestPurple", "#9575CD", rough=0.7)
    PUR2 = mat("ChestLid", "#7E57C2", rough=0.7)
    p = [Part(coll, "box", bm_box(0.9, 0.55, 0.5), PUR, loc=(0, 0, 0.25)).bevel(0.04, 2),
         Part(coll, "lid", bm_box(0.94, 0.58, 0.1), PUR2, loc=(0, 0.04, 0.55), rot=(-0.35, 0, 0)).bevel(0.03, 2),
         Part(coll, "lock", bm_sphere(0.035), mat("Brass", "#FFD54F"), loc=(0, -0.28, 0.42)),
         Part(coll, "bear", bm_sphere(0.12), TEDDY, loc=(-0.2, -0.02, 0.58)),
         Part(coll, "bearHead", bm_sphere(0.09), TEDDY, loc=(-0.2, -0.05, 0.74)),
         Part(coll, "yoyo", bm_cyl(0.07, 0.07, 0.05, 14, "X"), mat("YoYo", "#FF5252", rough=0.4), loc=(0.22, -0.05, 0.6)),
         Part(coll, "ball", bm_sphere(0.09), mat("ToyBall", "#4FC3F7", rough=0.5), loc=(0.05, 0.05, 0.6))]
    bake(p, "ToyChest_mesh", coll, parent=g)

    # Window (frame, muntins, sill, mint curtains) — the view behind is a JS plane
    g = group(coll, root, "Window")
    FRAME = mat("WinFrame", "#FFFFFF", rough=0.6)
    p = [Part(coll, "top", bm_box(1.5, 0.1, 0.09), FRAME, loc=(0, 0, 0.82)),
         Part(coll, "bot", bm_box(1.5, 0.1, 0.09), FRAME, loc=(0, 0, -0.82)),
         Part(coll, "l", bm_box(0.09, 0.1, 1.7), FRAME, loc=(-0.71, 0, 0)),
         Part(coll, "r", bm_box(0.09, 0.1, 1.7), FRAME, loc=(0.71, 0, 0)),
         Part(coll, "mv", bm_box(0.05, 0.06, 1.6), FRAME, loc=(0, 0, 0)),
         Part(coll, "mh", bm_box(1.4, 0.06, 0.05), FRAME, loc=(0, 0, 0)),
         Part(coll, "sill", bm_box(1.7, 0.25, 0.07), FRAME, loc=(0, -0.1, -0.88)),
         Part(coll, "rod", bm_cyl(0.02, 0.02, 2.1, 8, "X"), WOODD, loc=(0, -0.12, 1.0))]
    for s in (-1, 1):
        for k in range(4):
            p.append(Part(coll, "curtain", bm_cyl(0.07, 0.07, 1.95, 10), MINT, loc=(s * (0.82 + k * 0.08), -0.13 - (k % 2) * 0.03, 0.02)))
        p.append(Part(coll, "tie", bm_torus(0.17, 0.02, 14, 5), mat("CurtainTie", "#F48FB1"), loc=(s * 0.94, -0.15, -0.2), rot=(math.pi / 2, 0, 0)))
    bake(p, "Window_mesh", coll, parent=g)

    # Bedroom door: frame + "DINA'S ROOM" sign; DoorLeaf pivots at the hinge (x = -0.45)
    g = group(coll, root, "RoomDoor")
    DWHITE = mat("DoorWhite", "#FFFFFF", rough=0.55)
    DFR = mat("DoorFrame", "#8D6E63", rough=0.7)
    SIGN = mat("DoorSign", "#FFD54F", rough=0.6)
    p = [Part(coll, "jambL", bm_box(0.1, 0.16, 2.15), DFR, loc=(-0.5, 0, 1.075)),
         Part(coll, "jambR", bm_box(0.1, 0.16, 2.15), DFR, loc=(0.5, 0, 1.075)),
         Part(coll, "lintel", bm_box(1.1, 0.16, 0.1), DFR, loc=(0, 0, 2.15)),
         Part(coll, "sign", bm_box(1.0, 0.05, 0.24), SIGN, loc=(0, -0.06, 2.42)).bevel(0.03, 2),
         text(coll, "signTxt", "DINA'S ROOM", 0.12, WOODD, (0, -0.095, 2.42), "-Y", extrude=0.004)]
    bake(p, "DoorFrame_mesh", coll, parent=g)
    leaf = [Part(coll, "leaf", bm_box(0.9, 0.06, 2.05), DWHITE, loc=(0, 0, 1.03)).bevel(0.02, 2),
            Part(coll, "knob", bm_sphere(0.04), mat("DoorKnob", "#FF4FA3", rough=0.4), loc=(0.34, -0.06, 1.0))]
    for z in (1.5, 0.6):
        leaf.append(Part(coll, "panel", bm_box(0.68, 0.02, 0.62), mat("DoorPanel", "#EEEEEE", rough=0.6), loc=(0, -0.035, z)).bevel(0.02, 2))
    bake_at(leaf, "DoorLeaf", coll, g, (-0.45, 0, 1.03))

    # Side table with a cookie + a glass of milk (the Cookie Catch entrance)
    g = group(coll, root, "SideTable")
    COOKIE = mat("CookieDough", "#FFA726", rough=0.8)
    CHIP = mat("CookieChip", "#3E2723", rough=0.6)
    MILK = mat("MilkWhite", "#FAFAFA", rough=0.3)
    p = [Part(coll, "top", bm_cyl(0.32, 0.32, 0.05, 20), mat("TableWood", "#A1887F", rough=0.6), loc=(0, 0, 0.5)),
         Part(coll, "leg", bm_cyl(0.04, 0.05, 0.48, 10), WOOD, loc=(0, 0, 0.24)),
         Part(coll, "foot", bm_cyl(0.18, 0.2, 0.03, 16), WOOD, loc=(0, 0, 0.015)),
         Part(coll, "plate", bm_cyl(0.13, 0.11, 0.02, 18), mat("PlatePink", "#FF8FB8", rough=0.4), loc=(-0.1, 0, 0.535)),
         Part(coll, "cookie", bm_cyl(0.09, 0.09, 0.025, 16), COOKIE, loc=(-0.1, 0, 0.56)).bevel(0.01, 2),
         Part(coll, "glass", bm_cyl(0.045, 0.04, 0.16, 14), MILK, loc=(0.14, 0.04, 0.605))]
    for (x, y) in ((-0.13, 0.03), (-0.07, -0.02), (-0.11, -0.04), (-0.06, 0.04)):
        p.append(Part(coll, "chip", bm_sphere(0.012), CHIP, loc=(x, y, 0.575)))
    bake(p, "SideTable_mesh", coll, parent=g)

    # Tablet on its stand (TabletScreen gets a live canvas texture)
    g = group(coll, root, "Tablet")
    p = [Part(coll, "stand", bm_box(0.36, 0.3, 0.06), WOODD, loc=(0, 0.05, 0.03)).bevel(0.02, 2),
         Part(coll, "prop", bm_box(0.3, 0.04, 0.3), WOODD, loc=(0, 0.14, 0.18), rot=(-0.4, 0, 0)),
         Part(coll, "body", bm_box(0.5, 0.03, 0.36), mat("TabletBody", "#212121", rough=0.4), loc=(0, 0.06, 0.25), rot=(-0.35, 0, 0)).bevel(0.02, 2)]
    bake(p, "Tablet_mesh", coll, parent=g)
    scr = Part(coll, "screen", bm_box(0.44, 0.006, 0.3), mat("TabletScreen", "#7CCB7E", rough=0.3, emit=0.6), loc=(0, 0.043, 0.256), rot=(-0.35, 0, 0), smooth=False)
    bake([scr], "TabletScreen", coll, parent=g)

    # Sticker book on the floor
    g = group(coll, root, "StickerBook")
    COVER = mat("BookCover", "#FFC107", rough=0.6)
    BAND = mat("BookBand", "#FF9800", rough=0.6)
    p = [Part(coll, "pages", bm_box(0.5, 0.62, 0.06), mat("BookPages", "#FFFDF7", rough=0.9), loc=(0, 0, 0.035)),
         Part(coll, "cover", bm_box(0.52, 0.64, 0.02), COVER, loc=(0, 0, 0.075)).bevel(0.01, 2),
         Part(coll, "back", bm_box(0.52, 0.64, 0.02), COVER, loc=(0, 0, 0.005)),
         Part(coll, "band", bm_box(0.44, 0.13, 0.008), BAND, loc=(0, -0.2, 0.088)),
         text(coll, "label", "STICKERS", 0.07, mat("BookLabel", "#FFFFFF"), (0, -0.2, 0.094), "+Z", extrude=0.002),
         Part(coll, "s1", bm_heart(0.05, 0.01), mat("StickerPink", "#FF80AB"), loc=(-0.14, 0.05, 0.09), rot=(math.pi / 2, 0, 0)),
         Part(coll, "s2", bm_cyl(0.05, 0.05, 0.008, 5), mat("StickerGreen", "#81C784"), loc=(0.02, 0.12, 0.09), smooth=False),
         Part(coll, "s3", bm_cyl(0.045, 0.045, 0.008, 16), mat("StickerBlue", "#64B5F6"), loc=(0.15, 0.0, 0.09))]
    for k in range(6):
        p.append(Part(coll, "ring", bm_torus(0.03, 0.006, 10, 4), mat("BookRing", "#B07B4F", rough=0.4, metal=0.5),
                      loc=(-0.25, -0.24 + k * 0.095, 0.045), rot=(math.pi / 2, 0, 0)))
    bake(p, "StickerBook_mesh", coll, parent=g)

    # Rug: cream oval with mint + pink rings
    g = group(coll, root, "Rug")
    p = [Part(coll, "rug", bm_cyl(1.0, 1.0, 0.02, 40), mat("RugCream", "#FFE8C8", rough=1.0), loc=(0, 0, 0.01)),
         Part(coll, "ring1", bm_torus(0.88, 0.04, 40, 4), mat("RugMint", "#B8E0D2", rough=1.0), loc=(0, 0, 0.022)),
         Part(coll, "ring2", bm_torus(0.72, 0.03, 40, 4), mat("RugPink", "#F4A4B8", rough=1.0), loc=(0, 0, 0.022))]
    for o in p:
        o.ob.scale = (1.6, 0.6, 1.0)
    bake(p, "Rug_mesh", coll, parent=g)

    for i, o in enumerate(o for o in coll.objects if o.parent == root):
        o.location.x = i * 2.6
    return coll


# ── Cookie Catch: the kitchen + the treats ───────────────────────────────
def build_kitchen():
    """Counter run along the back wall (Blender +Y = away from the camera)."""
    coll = scene_coll("DinaKitchen")
    root = root_empty(coll, "DinaKitchen")
    CAB = mat("CabCream", "#FFF3DC", rough=0.7)
    CABD = mat("CabTrim", "#E0C9A6", rough=0.7)
    TOP = mat("CounterTop", "#C8A878", rough=0.5)
    STEEL = mat("Steel", "#CFD8DC", rough=0.3, metal=0.7)
    FRIDGE = mat("Fridge", "#E3F2FD", rough=0.35, metal=0.1)
    OVEN = mat("OvenBlack", "#263238", rough=0.4)
    BRASS = mat("KBrass", "#FFD54F", rough=0.3, metal=0.7)
    JAR = mat("Glass", "#9FD8FF", rough=0.05)
    p = []
    by = 0.0
    # lower cabinets + counter (x from -4.4 to 2.2), fridge at the right
    p.append(Part(coll, "base", bm_box(6.6, 0.65, 0.9), CAB, loc=(-1.1, by, 0.45)).bevel(0.02, 2))
    p.append(Part(coll, "counter", bm_box(6.7, 0.72, 0.07), TOP, loc=(-1.1, by - 0.03, 0.93)).bevel(0.02, 2))
    for i in range(6):
        x = -4.0 + i * 1.08
        p.append(Part(coll, "cabDoor", bm_box(0.95, 0.03, 0.7), CABD, loc=(x, by - 0.34, 0.45)).bevel(0.02, 2))
        p.append(Part(coll, "handle", bm_box(0.12, 0.03, 0.03), BRASS, loc=(x, by - 0.37, 0.72)))
        if i != 3:
            p.append(Part(coll, "upper", bm_box(0.98, 0.4, 0.8), CAB, loc=(x, by + 0.12, 2.25)).bevel(0.02, 2))
            p.append(Part(coll, "upDoor", bm_box(0.86, 0.02, 0.68), CABD, loc=(x, by - 0.09, 2.25)).bevel(0.02, 2))
    # oven in the run
    p.append(Part(coll, "oven", bm_box(0.95, 0.04, 0.72), OVEN, loc=(-1.84, by - 0.35, 0.44)).bevel(0.02, 2))
    p.append(Part(coll, "ovenWin", bm_box(0.6, 0.02, 0.3), mat("OvenGlow", "#FF8A50", rough=0.3, emit=0.6), loc=(-1.84, by - 0.37, 0.48)))
    for k in range(4):
        p.append(Part(coll, "burner", bm_torus(0.11, 0.015, 14, 4), OVEN, loc=(-2.1 + (k % 2) * 0.5, by - 0.05 + (k // 2) * 0.2 - 0.1, 0.97)))
    # sink + faucet under the window
    p.append(Part(coll, "sink", bm_box(0.8, 0.45, 0.02), STEEL, loc=(-0.76, by - 0.05, 0.968)))
    p.append(limb(coll, "faucet", (-0.76, by + 0.22, 0.97), (-0.76, by + 0.22, 1.25), 0.025, STEEL))
    p.append(limb(coll, "spout", (-0.76, by + 0.22, 1.25), (-0.76, by + 0.02, 1.2), 0.022, STEEL))
    # fridge
    p.append(Part(coll, "fridge", bm_box(1.0, 0.75, 2.1), FRIDGE, loc=(2.85, by + 0.02, 1.05)).bevel(0.08, 3))
    p.append(Part(coll, "fridgeLine", bm_box(1.0, 0.02, 0.03), STEEL, loc=(2.85, by - 0.36, 1.35)))
    for z in (0.9, 1.75):
        p.append(Part(coll, "fHandle", bm_box(0.04, 0.05, 0.4), STEEL, loc=(2.45, by - 0.38, z)))
    for k, c in enumerate(("#FF80AB", "#FFD54F", "#81C784")):
        p.append(Part(coll, "magnet", bm_heart(0.06, 0.02) if k != 1 else bm_sphere(0.05, 0.02, 0.05),
                      mat("Magnet" + c[1:], c, rough=0.5), loc=(2.7 + k * 0.17, by - 0.39, 1.6 - k * 0.12)))
    # Dina's drawing on the fridge
    p.append(Part(coll, "drawing", bm_box(0.36, 0.01, 0.28), mat("FridgePaper", "#FFF59D", rough=0.9), loc=(3.05, by - 0.385, 1.15)))
    # cookie jar + a stack of plates on the counter
    p.append(Part(coll, "jar", bm_cyl(0.16, 0.16, 0.3, 18), JAR, loc=(0.95, by + 0.05, 1.12)))
    p.append(Part(coll, "jarLid", bm_cyl(0.17, 0.17, 0.05, 18), mat("JarLid", "#E91E63", rough=0.5), loc=(0.95, by + 0.05, 1.3)))
    for k in range(5):
        p.append(Part(coll, "jarCookie", bm_cyl(0.09, 0.09, 0.025, 14), mat("CookieDough", "#FFA726", rough=0.8),
                      loc=(0.9 + (k % 2) * 0.08, by + 0.05, 1.0 + k * 0.045), rot=(0.3 * k, 0.2, 0)))
    for k in range(4):
        p.append(Part(coll, "dish", bm_cyl(0.18, 0.15, 0.02, 18), mat("DishWhite", "#FAFAFA", rough=0.3), loc=(1.55, by + 0.05, 0.98 + k * 0.025)))
    # a plant on the windowsill
    p.append(Part(coll, "pot", bm_cyl(0.1, 0.08, 0.16, 12), mat("PotTerra", "#D7834F", rough=0.8), loc=(-0.2, by + 0.2, 1.05)))
    for k in range(5):
        a = k * 1.25
        p.append(Part(coll, "leaf", bm_sphere(0.06, 0.03, 0.12), mat("PlantGreen", "#66BB6A", rough=0.8),
                      loc=(-0.2 + math.cos(a) * 0.06, by + 0.2 + math.sin(a) * 0.06, 1.22), rot=(math.sin(a) * 0.5, math.cos(a) * 0.5, 0)))
    bake(p, "Kitchen_mesh", coll, parent=root)
    return coll


def build_treats():
    coll = scene_coll("DinaTreats")
    root = root_empty(coll, "DinaTreats")
    COOKIE = mat("CookieDough", "#FFA726", rough=0.8)
    COOKIE2 = mat("CookieEdge", "#E08A1E", rough=0.8)
    CHIP = mat("CookieChip", "#3E2723", rough=0.6)

    g = group(coll, root, "Cookie")
    p = [Part(coll, "cookie", bm_cyl(0.17, 0.17, 0.05, 20, "Y"), COOKIE, loc=(0, 0, 0)).bevel(0.02, 2),
         Part(coll, "edge", bm_torus(0.165, 0.02, 20, 5), COOKIE2, loc=(0, 0, 0), rot=(math.pi / 2, 0, 0))]
    for (x, z) in ((-0.07, 0.06), (0.05, 0.08), (0.08, -0.04), (-0.03, -0.07), (0.0, 0.0), (-0.1, -0.02)):
        for s in (-1, 1):
            p.append(Part(coll, "chip", bm_sphere(0.022, 0.012, 0.022), CHIP, loc=(x, s * 0.026, z)))
    bake(p, "Cookie_mesh", coll, parent=g)

    g = group(coll, root, "Choc")
    p = [Part(coll, "bar", bm_box(0.22, 0.05, 0.32), mat("Chocolate", "#5D4037", rough=0.5), loc=(0, 0, 0.06)).bevel(0.01, 2),
         Part(coll, "wrap", bm_box(0.23, 0.06, 0.2), mat("ChocWrap", "#E53935", rough=0.4), loc=(0, 0, -0.08)).bevel(0.01, 1),
         Part(coll, "foil", bm_box(0.235, 0.062, 0.03), mat("ChocFoil", "#E0E0E0", rough=0.2, metal=0.8), loc=(0, 0, 0.03))]
    for x in (-0.055, 0.055):
        for z in (0.12, 0.2):
            p.append(Part(coll, "square", bm_box(0.09, 0.012, 0.07), mat("Chocolate", "#5D4037"), loc=(x, -0.028, z - 0.02)).bevel(0.008, 1))
    bake(p, "Choc_mesh", coll, parent=g)

    g = group(coll, root, "Donut")
    p = [Part(coll, "dough", bm_torus(0.12, 0.065, 24, 12), mat("DonutDough", "#E0A060", rough=0.7), loc=(0, 0, 0), rot=(math.pi / 2, 0, 0)),
         Part(coll, "icing", bm_torus(0.12, 0.058, 24, 12), mat("DonutIcing", "#FF80AB", rough=0.4), loc=(0, -0.018, 0), rot=(math.pi / 2, 0, 0))]
    for k in range(10):
        a = k * math.pi * 2 / 10
        col = ("#FFFFFF", "#FFEB3B", "#4FC3F7", "#81C784")[k % 4]
        p.append(Part(coll, "sprinkle", bm_box(0.04, 0.012, 0.012), mat("Sprinkle" + col[1:], col, rough=0.5),
                      loc=(math.cos(a) * 0.12, -0.075, math.sin(a) * 0.12), rot=(0, a * 1.7, 0)))
    bake(p, "Donut_mesh", coll, parent=g)

    g = group(coll, root, "Cupcake")
    p = [Part(coll, "wrapper", bm_cyl(0.1, 0.13, 0.13, 14), mat("CupWrapper", "#4FC3F7", rough=0.6), loc=(0, 0, -0.07), smooth=False),
         Part(coll, "frost1", bm_sphere(0.15, 0.15, 0.08), mat("Frosting", "#FFF0F5", rough=0.5), loc=(0, 0, 0.02)),
         Part(coll, "frost2", bm_sphere(0.11, 0.11, 0.07), mat("Frosting", "#FFF0F5"), loc=(0, 0, 0.09)),
         Part(coll, "frost3", bm_sphere(0.07, 0.07, 0.06), mat("Frosting", "#FFF0F5"), loc=(0, 0, 0.15)),
         Part(coll, "cherry", bm_sphere(0.04), mat("Cherry", "#E53935", rough=0.25), loc=(0, 0, 0.22)),
         limb(coll, "stem", (0, 0, 0.25), (0.02, 0, 0.31), 0.006, mat("CherryStem", "#5D4037"))]
    bake(p, "Cupcake_mesh", coll, parent=g)

    g = group(coll, root, "Milk")
    p = [Part(coll, "glass", bm_cyl(0.09, 0.08, 0.28, 16), mat("Glass", "#9FD8FF", rough=0.05), loc=(0, 0, 0)),
         Part(coll, "milk", bm_cyl(0.08, 0.072, 0.22, 16), mat("MilkWhite", "#FAFAFA", rough=0.3), loc=(0, 0, -0.025)),
         Part(coll, "straw", bm_cyl(0.012, 0.012, 0.3, 8), mat("Straw", "#FF4FA3", rough=0.5), loc=(0.03, 0, 0.12), rot=(0, 0.25, 0))]
    bake(p, "Milk_mesh", coll, parent=g)

    # Mom's burnt cookie... with a fuse. 💣
    g = group(coll, root, "Bomb")
    p = [Part(coll, "ball", bm_sphere(0.15, 0.15, 0.15, 18, 12), mat("BombBlack", "#212121", rough=0.35, metal=0.2), loc=(0, 0, 0)),
         Part(coll, "shine", bm_sphere(0.035, 0.02, 0.025), mat("BombShine", "#9E9E9E", rough=0.2), loc=(-0.06, -0.12, 0.07)),
         Part(coll, "cap", bm_cyl(0.05, 0.05, 0.05, 12), mat("BombCap", "#616161", rough=0.4, metal=0.5), loc=(0.05, 0, 0.14), rot=(0, 0.4, 0)),
         limb(coll, "fuse", (0.07, 0, 0.16), (0.12, 0, 0.24), 0.01, mat("Fuse", "#A1887F")),
         Part(coll, "spark", bm_ico(0.035), mat("NeonSpark", "#FFEB3B", rough=0.3, emit=4.0), loc=(0.125, 0, 0.25), smooth=False)]
    bake(p, "Bomb_mesh", coll, parent=g)

    # Dina's pink serving plate (1 m wide — she means business)
    g = group(coll, root, "Plate")
    p = [Part(coll, "dish", bm_cyl(0.5, 0.42, 0.06, 32), mat("PlatePink", "#FF8FB8", rough=0.35), loc=(0, 0, 0)),
         Part(coll, "inner", bm_cyl(0.38, 0.38, 0.065, 32), mat("PlateInner", "#FFFFFF", rough=0.3), loc=(0, 0, 0.002)),
         Part(coll, "rim", bm_torus(0.47, 0.025, 32, 6), mat("PlatePink", "#FF8FB8"), loc=(0, 0, 0.03))]
    for o in p:
        o.ob.scale = (1.0, 0.55, 1.0)
    bake(p, "Plate_mesh", coll, parent=g)

    for i, o in enumerate(o for o in coll.objects if o.parent == root):
        o.location.x = i * 0.6
    return coll


ASSETS = [
    ("dina_bus", build_bus),
    ("dina_school", build_school),
    ("dina_home", build_home),
    ("dina_props", build_props),
    ("dina_greenblatt", build_greenblatt),
    ("dina_girl_pony", lambda: schoolgirl("GirlPony", "ponytail", "#3E2723", ["bow"])),
    ("dina_girl_bun", lambda: schoolgirl("GirlBun", "bun", "#5D4037")),
    ("dina_girl_long", lambda: schoolgirl("GirlLong", "long", "#6D4C41", ["headband"])),
    ("dina_morgan", build_morgan),
    ("dina_room", build_room),
    ("dina_kitchen", build_kitchen),
    ("dina_treats", build_treats),
]
