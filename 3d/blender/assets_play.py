"""
Playground (feature "play"): the Golden Dreidel collectible and the wooden
stunt ramp.

Conventions (see 3d/ARCHITECTURE.md): metres, FRONT = Blender -Y (= +Z in
three.js), Blender +X = the model's LEFT. Every file is prefixed play_.

  play_dreidel  a chunky gold dreidel (נ ג ה ש on its four faces), origin at
                the tip; two materials (DreidelGold, DreidelInk) so the road's
                InstancedMeshes stay at two draw calls.
  play_ramp     a candy-striped kicker ramp, 5 m long, 3 m wide, 1.15 m lip.
                The car drives along -Y (three.js +Z): the low edge is at
                Blender y = +2.5, the lip at y = -2.5. The deck follows
                z = H * u^1.6 (u = 0 at the start, 1 at the lip) - the game
                uses the same curve for the ride up.
"""
from lib import *

RAMP_L, RAMP_W, RAMP_H, RAMP_EXP = 5.0, 3.0, 1.15, 1.6


def setup():
    global S
    S = shared()


def bm_text_lo(body, size, extrude=0.0, res=3):
    """Low-poly text: coarse curve resolution (the road shows dozens of these)."""
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = body
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.extrude = extrude
    cu.resolution_u = res
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


def text_part(coll, body, size, m, loc, rot, extrude=0.012, res=3):
    return Part(coll, "txt", bm_text_lo(body, size, extrude, res), m, loc=loc, rot=rot, smooth=False)


# ── the Golden Dreidel ───────────────────────────────────────────────────
def build_dreidel():
    coll = scene_coll("PlayDreidel")
    root = root_empty(coll, "PlayDreidel")
    GOLD = mat("DreidelGold", "#FFC233", rough=0.22, metal=0.85)
    INK = mat("DreidelInk", "#2340B8", rough=0.35, metal=0.2)
    parts = []
    B, BH, BZ = 0.46, 0.50, 0.62                      # body width, height, centre z
    parts.append(Part(coll, "body", bm_box(B, B, BH), GOLD, loc=(0, 0, BZ)).bevel(0.06, 2))
    # square pyramid point (create_cone: radius1 at the bottom)
    tip = Part(coll, "tip", bm_cyl(0.0, B * 0.66, 0.34, 4), GOLD, loc=(0, 0, BZ - BH / 2 - 0.15), rot=(0, 0, math.pi / 4), smooth=False)
    parts.append(tip)
    parts.append(Part(coll, "tipBall", bm_sphere(0.035, 0.035, 0.035, 10, 6), GOLD, loc=(0, 0, 0.05)))
    # shoulder, stem and knob
    parts.append(Part(coll, "cap", bm_box(B * 0.72, B * 0.72, 0.06), GOLD, loc=(0, 0, BZ + BH / 2 + 0.02)).bevel(0.025, 2))
    parts.append(Part(coll, "stem", bm_cyl(0.05, 0.05, 0.24, 12), GOLD, loc=(0, 0, BZ + BH / 2 + 0.16)))
    parts.append(Part(coll, "knob", bm_sphere(0.075, 0.075, 0.06, 14, 8), GOLD, loc=(0, 0, BZ + BH / 2 + 0.3)))
    # blue trim bands top and bottom of the body
    for z in (BZ + BH / 2 - 0.045, BZ - BH / 2 + 0.045):
        parts.append(Part(coll, "band", bm_box(B + 0.012, B + 0.012, 0.035), INK, loc=(0, 0, z)).bevel(0.012, 1))
    # the four letters: nun, gimel, hei, shin - one per face
    h = B / 2 + 0.004
    faces = [("נ", (0, -h, BZ), (math.pi / 2, 0, 0)),          # front (-Y)
             ("ג", (h, 0, BZ), (math.pi / 2, 0, math.pi / 2)),  # +X
             ("ה", (0, h, BZ), (math.pi / 2, 0, math.pi)),      # back (+Y)
             ("ש", (-h, 0, BZ), (math.pi / 2, 0, -math.pi / 2))]  # -X
    for ch, loc, rot in faces:
        parts.append(text_part(coll, ch, 0.3, INK, loc, rot, extrude=0.014))
    bake(parts, "Dreidel", coll, parent=root)
    return coll


# ── the stunt ramp ───────────────────────────────────────────────────────
def ramp_z(u):
    return RAMP_H * (u ** RAMP_EXP)


def ramp_y(u):
    return RAMP_L / 2 - RAMP_L * u


def build_ramp():
    coll = scene_coll("PlayRamp")
    root = root_empty(coll, "PlayRamp")
    PINK = mat("RampPink", "#FF4FA3", rough=0.45)
    WHITE = mat("RampWhite", "#FFF4F8", rough=0.5)
    WOOD = mat("RampWood", "#C98B55", rough=0.8)
    WOODD = mat("RampWoodDark", "#8D5A34", rough=0.85)
    LIP = mat("RampLip", "#FFC107", rough=0.3, metal=0.4)
    TXT = mat("RampText", "#FFFFFF", rough=0.5)
    FLAG = mat("RampFlag", "#7C4DFF", rough=0.6)
    parts = []
    hw = RAMP_W / 2

    # candy-striped deck: one slab per stripe, following the kicker curve
    N, T = 12, 0.07
    for i in range(N):
        u0, u1 = i / N, (i + 1) / N
        y0, y1, z0, z1 = ramp_y(u0), ramp_y(u1), ramp_z(u0), ramp_z(u1)
        prof = [(y0, z0), (y1, z1), (y1, z1 - T), (y0, max(0.0, z0 - T))]
        if z0 - T < 0:
            prof = [(y0, z0 + 0.012), (y1, z1), (y1, max(0.0, z1 - T)), (y0, 0.0)]
        parts.append(Part(coll, "deck", bm_prism(prof, hw - 0.06), PINK if i % 2 == 0 else WHITE, smooth=False))

    # wooden side walls (the full curved profile, closed down to the ground)
    side = [(ramp_y(i / 16), ramp_z(i / 16)) for i in range(17)] + [(-RAMP_L / 2, 0.0)]
    for s in (-1, 1):
        parts.append(Part(coll, "side", bm_prism(side, 0.05), WOOD, loc=(s * hw, 0, 0), smooth=False))
        # rail along the top edge of each wall
        for i in range(8):
            u0, u1 = i / 8, (i + 1) / 8
            parts.append(limb(coll, "rail", (s * hw, ramp_y(u0), ramp_z(u0) + 0.05), (s * hw, ramp_y(u1), ramp_z(u1) + 0.05), 0.045, WOODD))
        # "JUMP!" + a star on the outside of each wall
        rot = (math.pi / 2, 0, math.pi / 2) if s > 0 else (math.pi / 2, 0, -math.pi / 2)
        parts.append(text_part(coll, "JUMP!", 0.36, TXT, (s * (hw + 0.056), -1.0, 0.36), rot))
        parts.append(text_part(coll, "★", 0.42, LIP, (s * (hw + 0.056), -2.05, 0.62), rot))

    # back of the lip: planks + cross braces
    parts.append(Part(coll, "back", bm_box(RAMP_W, 0.06, RAMP_H), WOOD, loc=(0, -RAMP_L / 2 + 0.03, RAMP_H / 2), smooth=False))
    for s in (-1, 1):
        parts.append(limb(coll, "brace", (s * (hw - 0.15), -RAMP_L / 2 - 0.02, 0.05), (-s * (hw - 0.15), -RAMP_L / 2 - 0.02, RAMP_H - 0.08), 0.04, WOODD))
    # yellow steel lip + an entry plate so the wheels roll on smoothly
    parts.append(Part(coll, "lip", bm_cyl(0.055, 0.055, RAMP_W + 0.08, 14, "X"), LIP, loc=(0, -RAMP_L / 2 + 0.02, RAMP_H + 0.01)))
    parts.append(Part(coll, "entry", bm_box(RAMP_W - 0.1, 0.35, 0.02), LIP, loc=(0, RAMP_L / 2 + 0.12, 0.01), smooth=False))

    # pennants on little poles at the lip corners, blowing back
    for s in (-1, 1):
        x, y = s * (hw + 0.02), -RAMP_L / 2 + 0.12
        parts.append(limb(coll, "pole", (x, y, RAMP_H), (x, y, RAMP_H + 1.0), 0.025, S.DARK))
        parts.append(Part(coll, "pennant", bm_prism([(0.0, 0.0), (0.0, 0.34), (0.55, 0.17)], 0.012), FLAG,
                          loc=(x, y, RAMP_H + 0.62), smooth=False))
        parts.append(Part(coll, "knob", bm_sphere(0.04), LIP, loc=(x, y, RAMP_H + 1.02)))
    bake(parts, "Ramp", coll, parent=root)
    return coll


ASSETS = [("play_dreidel", build_dreidel), ("play_ramp", build_ramp)]
