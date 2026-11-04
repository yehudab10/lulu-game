"""
Core assets: Lulu's car (+ Lulu as the separate "Driver"), traffic, cop car,
trees, bushes, houses, Bubbe's house + Bubbe, and the people everyone reuses
(Lulu and Dina on foot, generic townsfolk).
"""
from lib import *
from lib_people import build_person


def setup():
    """Called by the runner after lib.reset(): (re)create the shared materials."""
    global TIRE, RIM, CHROME, HEAD, TAIL, GLASS, TINT, DARK, PLATE, PLATE_TXT, BARK, LEAVES, PINE
    S = shared()
    TIRE, RIM, CHROME, HEAD, TAIL, GLASS, TINT = S.TIRE, S.RIM, S.CHROME, S.HEAD, S.TAIL, S.GLASS, S.TINT
    DARK, PLATE, PLATE_TXT, BARK, LEAVES, PINE = S.DARK, S.PLATE, S.PLATE_TXT, S.BARK, S.LEAVES, S.PINE


# ── Lulu's pink convertible (with Lulu driving) ──────────────────────────
def build_lulu_car():
    coll = scene_coll("LuluCar")
    root = root_empty(coll, "LuluCar")
    BODY = mat("Body", "#E91E63", rough=0.32, metal=0.05)
    LIGHT = mat("BodyLight", "#F48FB1", rough=0.4)
    BDARK = mat("BodyDark", "#AD1457", rough=0.45)
    SEAT = mat("Seat", "#FFF3E0", rough=0.75)
    SKIN = mat("Skin", "#FFD2B0", rough=0.7)
    HAIR = mat("Hair", "#8B5A2B", rough=0.8)
    SHIRT = mat("Shirt", "#4FC3F7", rough=0.75)
    EYE = mat("Eye", "#1B1B1B", rough=0.3)
    CHEEK = mat("Cheek", "#FF8A9A", rough=0.8)
    SHADES = mat("Shades", "#111111", rough=0.15, metal=0.4)

    R = 0.34      # wheel radius
    TRACK = 0.80  # half track
    FY, RY = -1.28, 1.28

    parts = []
    body = Part(coll, "body", bm_box(1.80, 3.95, 0.54), BODY, loc=(0, 0, 0.62)).bevel(0.2, 4)
    cockpit = Part(coll, "cockpitCut", bm_box(1.50, 1.55, 0.7), None, loc=(0, 0.24, 1.10))
    cockpit.ob.display_type = "WIRE"
    body.cut(cockpit)
    for nm, x, y in (("archFL", -1, FY), ("archFR", 1, FY), ("archRL", -1, RY), ("archRR", 1, RY)):
        arch = Part(coll, nm, bm_cyl(R + 0.08, R + 0.08, 0.5, 20, "X"), None, loc=(x * 0.95, y, R))
        arch.ob.display_type = "WIRE"
        body.cut(arch)
    parts.append(body)

    # A soft pink stripe down the sides + the rocker trim.
    for s in (-1, 1):
        parts.append(Part(coll, "stripe", bm_box(0.02, 2.2, 0.07), LIGHT, loc=(s * 0.902, 0.05, 0.74)))
        parts.append(Part(coll, "mirror", bm_box(0.16, 0.10, 0.10), BODY, loc=(s * 0.95, -0.52, 0.98)).bevel(0.03, 2))
        parts.append(limb(coll, "mirrorArm", (s * 0.84, -0.52, 0.88), (s * 0.93, -0.52, 0.96), 0.02, BDARK))

    # Rear deck humps behind the seats (classic roadster look).
    for x in (-0.38, 0.38):
        parts.append(Part(coll, "hump", bm_sphere(0.26, 0.42, 0.16), BODY, loc=(x, 1.22, 0.88)))
    # Dashboard
    parts.append(Part(coll, "dash", bm_box(1.46, 0.28, 0.16), BDARK, loc=(0, -0.44, 0.84)).bevel(0.05, 2))

    # Windshield (glass + frame), raked back.
    ws = root_empty(coll, "ws")
    ws.location = (0, -0.50, 1.06)
    ws.rotation_euler = (-0.42, 0, 0)
    parts.append(Part(coll, "wsGlass", bm_box(1.44, 0.03, 0.42), GLASS, parent=ws))
    parts.append(Part(coll, "wsTop", bm_box(1.52, 0.06, 0.06), CHROME, loc=(0, 0, 0.23), parent=ws).bevel(0.02, 2))
    for s in (-1, 1):
        parts.append(Part(coll, "wsPost", bm_box(0.06, 0.06, 0.5), CHROME, loc=(s * 0.74, 0, 0), parent=ws).bevel(0.02, 2))

    # Seats
    for x in (-0.38, 0.38):
        parts.append(Part(coll, "cushion", bm_box(0.55, 0.55, 0.14), SEAT, loc=(x, 0.36, 0.83)).bevel(0.05, 2))
        parts.append(Part(coll, "back", bm_box(0.55, 0.14, 0.56), SEAT, loc=(x, 0.70, 1.06), rot=(-0.18, 0, 0)).bevel(0.05, 2))

    # Lulu sits on the LEFT, i.e. Blender +X (the car faces -Y, so -X is its right).
    lx = 0.38
    # Steering wheel: its own object (origin at the hub) so the game can turn it.
    swp = (lx, -0.20, 1.02)
    sw = bake_at([Part(coll, "ring", bm_torus(0.17, 0.025), DARK, loc=swp),
                  Part(coll, "spokeA", bm_box(0.32, 0.03, 0.02), DARK, loc=swp),
                  Part(coll, "spokeB", bm_box(0.03, 0.17, 0.02), DARK, loc=(lx, -0.115, 1.02))],
                 "SteeringWheel", coll, root, swp)
    sw.rotation_euler = (math.radians(70), 0, 0)  # tilt; the game spins it about its local axis
    parts.append(limb(coll, "column", (lx, -0.20, 1.02), (lx, -0.44, 0.88), 0.03, DARK))

    # Lulu herself is a SEPARATE object ("Driver") so she can climb out (on foot)
    # and her hair is its own object ("Hair_<style>") so the salon can swap it.
    # Chibi proportions so she reads from the chase cam.
    hr, hy, hz = 0.235, 0.38, 1.60
    driver = []
    hair = []
    driver.append(Part(coll, "torso", bm_sphere(0.21, 0.16, 0.27), SHIRT, loc=(lx, 0.46, 1.10)))
    driver.append(Part(coll, "neck", bm_cyl(0.06, 0.06, 0.14, 10), SKIN, loc=(lx, 0.42, 1.36)))
    driver.append(Part(coll, "head", bm_sphere(hr, hr * 0.95, hr * 1.02, 22, 16), SKIN, loc=(lx, hy, hz)))
    hair.append(Part(coll, "hair", bm_sphere(hr * 1.08, hr, hr * 1.04, 22, 16), HAIR, loc=(lx, hy + 0.06, hz + 0.05)))
    hair.append(Part(coll, "hairBack", bm_sphere(hr * 1.12, 0.13, hr * 1.45), HAIR, loc=(lx, hy + 0.15, hz - 0.18)))
    for s in (-1, 1):
        hair.append(Part(coll, "hairSide", bm_sphere(0.08, 0.1, 0.25), HAIR, loc=(lx + s * hr * 0.9, hy + 0.02, hz - 0.12)))
        driver.append(Part(coll, "eye", bm_sphere(0.038, 0.02, 0.05, 10, 8), EYE, loc=(lx + s * 0.085, hy - hr * 0.92, hz)))
        driver.append(Part(coll, "shine", bm_sphere(0.012, 0.01, 0.012, 6, 4), RIM, loc=(lx + s * 0.085 + 0.012, hy - hr * 0.98, hz + 0.018)))
        driver.append(Part(coll, "cheek", bm_sphere(0.04, 0.012, 0.025, 10, 6), CHEEK, loc=(lx + s * 0.145, hy - hr * 0.84, hz - 0.075)))
        hair.append(Part(coll, "lens", bm_sphere(0.06, 0.022, 0.045, 10, 6), SHADES, loc=(lx + s * 0.085, hy - 0.11, hz + 0.21), rot=(-0.6, 0, 0)))
        # arms reaching for the wheel
        driver.append(limb(coll, "arm", (lx + s * 0.19, 0.42, 1.24), (lx + s * 0.13, -0.16, 1.05), 0.045, SHIRT))
        driver.append(Part(coll, "hand", bm_sphere(0.05), SKIN, loc=(lx + s * 0.13, -0.18, 1.05)))
    driver.append(Part(coll, "mouth", bm_sphere(0.04, 0.012, 0.018, 10, 6), EYE, loc=(lx, hy - hr * 0.96, hz - 0.1)))
    bake(driver, "Driver", coll, parent=root)
    bake(hair, "Hair_sheitel", coll, parent=root)

    # Attachment points for decorations, hats, passengers (see car.js anchors).
    anchor(coll, root, "Anchor_hood", (0, -1.25, 0.90))
    anchor(coll, root, "Anchor_deck", (0, 1.35, 0.98))
    anchor(coll, root, "Anchor_front", (0, -2.08, 0.62))
    anchor(coll, root, "Anchor_rear", (0, 2.08, 0.70))
    anchor(coll, root, "Anchor_head", (lx, hy + 0.04, hz + 0.27))
    anchor(coll, root, "Anchor_dash", (0, -0.45, 0.93))
    anchor(coll, root, "Anchor_passenger", (-0.38, 0.40, 0.90))
    anchor(coll, root, "Anchor_mirrorL", (0.97, -0.52, 1.04))
    anchor(coll, root, "Anchor_mirrorR", (-0.97, -0.52, 1.04))

    # Lights, bumpers, plate
    for s in (-1, 1):
        parts.append(Part(coll, "headlight", bm_sphere(0.16, 0.06, 0.12), HEAD, loc=(s * 0.56, -1.93, 0.70)))
        parts.append(Part(coll, "taillight", bm_box(0.30, 0.05, 0.12), TAIL, loc=(s * 0.58, 1.96, 0.74)).bevel(0.03, 2))
    parts.append(Part(coll, "bumperF", bm_box(1.66, 0.18, 0.15), CHROME, loc=(0, -2.0, 0.46)).bevel(0.06, 3))
    parts.append(Part(coll, "bumperR", bm_box(1.66, 0.18, 0.15), CHROME, loc=(0, 2.0, 0.46)).bevel(0.06, 3))
    parts.append(Part(coll, "grille", bm_box(0.7, 0.04, 0.1), BDARK, loc=(0, -1.975, 0.58)).bevel(0.03, 2))
    parts.append(Part(coll, "plate", bm_box(0.52, 0.02, 0.16), PLATE, loc=(0, 2.02, 0.62)))
    parts.append(Part(coll, "plateTxt", bm_text("LULU", 0.13), PLATE_TXT, loc=(0, 2.035, 0.62),
                      rot=(math.pi / 2, 0, math.pi), smooth=False))

    bake(parts, "LuluCar_body", coll, parent=root)
    four_wheels(coll, root, TRACK, FY, RY, R, 0.26, TIRE, RIM, BODY)
    return coll


# ── traffic ──────────────────────────────────────────────────────────────
def build_sedan(name="Sedan", cop=False):
    coll = scene_coll(name)
    root = root_empty(coll, name)
    PAINT = mat("Paint", "#42A5F5", rough=0.35) if not cop else mat("CopPaint", "#1A1A1A", rough=0.35)
    parts = [
        Part(coll, "body", bm_box(1.80, 4.4, 0.62), PAINT, loc=(0, 0, 0.66)).bevel(0.14, 3),
        Part(coll, "cabin", bm_box(1.58, 2.15, 0.56), TINT, loc=(0, 0.25, 1.20)).bevel(0.16, 3),
        Part(coll, "roof", bm_box(1.50, 1.75, 0.08), PAINT, loc=(0, 0.28, 1.47)).bevel(0.04, 2),
        Part(coll, "bumperF", bm_box(1.76, 0.2, 0.18), DARK, loc=(0, -2.2, 0.48)).bevel(0.06, 2),
        Part(coll, "bumperR", bm_box(1.76, 0.2, 0.18), DARK, loc=(0, 2.2, 0.48)).bevel(0.06, 2),
    ]
    for s in (-1, 1):
        parts.append(Part(coll, "head", bm_box(0.38, 0.06, 0.13), HEAD, loc=(s * 0.58, -2.19, 0.74)).bevel(0.03, 2))
        parts.append(Part(coll, "tail", bm_box(0.36, 0.06, 0.13), TAIL, loc=(s * 0.6, 2.19, 0.80)).bevel(0.03, 2))
    if cop:
        WHITE = mat("CopWhite", "#F5F5F5", rough=0.4)
        RED = mat("LightRed", "#FF1744", rough=0.3, emit=3.0)
        BLUE = mat("LightBlue", "#2979FF", rough=0.3, emit=3.0)
        for s in (-1, 1):
            parts.append(Part(coll, "door", bm_box(0.02, 1.9, 0.42), WHITE, loc=(s * 0.905, 0.15, 0.70)))
        parts.append(Part(coll, "bar", bm_box(1.2, 0.3, 0.06), DARK, loc=(0, 0.28, 1.54)))
        parts.append(Part(coll, "red", bm_box(0.5, 0.26, 0.12), RED, loc=(-0.32, 0.28, 1.62)).bevel(0.04, 2))
        parts.append(Part(coll, "blue", bm_box(0.5, 0.26, 0.12), BLUE, loc=(0.32, 0.28, 1.62)).bevel(0.04, 2))
    bake(parts, name + "_body", coll, parent=root)
    four_wheels(coll, root, 0.80, -1.42, 1.42, 0.34, 0.24, TIRE, CHROME, TIRE)
    return coll


def build_van():
    coll = scene_coll("Van")
    root = root_empty(coll, "Van")
    PAINT = mat("Paint", "#42A5F5")
    parts = [
        Part(coll, "body", bm_box(1.95, 4.9, 0.78), PAINT, loc=(0, 0, 0.78)).bevel(0.16, 3),
        Part(coll, "cabin", bm_box(1.86, 3.5, 0.72), TINT, loc=(0, 0.55, 1.50)).bevel(0.2, 3),
        Part(coll, "roof", bm_box(1.80, 3.2, 0.1), PAINT, loc=(0, 0.62, 1.86)).bevel(0.05, 2),
        Part(coll, "nose", bm_box(1.86, 0.9, 0.36), TINT, loc=(0, -1.38, 1.24), rot=(-0.55, 0, 0)).bevel(0.1, 2),
        Part(coll, "bumperF", bm_box(1.9, 0.2, 0.2), DARK, loc=(0, -2.45, 0.5)).bevel(0.06, 2),
        Part(coll, "bumperR", bm_box(1.9, 0.2, 0.2), DARK, loc=(0, 2.45, 0.5)).bevel(0.06, 2),
    ]
    for s in (-1, 1):
        parts.append(Part(coll, "head", bm_box(0.4, 0.06, 0.15), HEAD, loc=(s * 0.62, -2.44, 0.86)).bevel(0.03, 2))
        parts.append(Part(coll, "tail", bm_box(0.2, 0.06, 0.5), TAIL, loc=(s * 0.82, 2.44, 1.1)).bevel(0.03, 2))
        parts.append(Part(coll, "rail", bm_box(0.05, 2.6, 0.05), CHROME, loc=(s * 0.7, 0.6, 1.94)))
    bake(parts, "Van_body", coll, parent=root)
    four_wheels(coll, root, 0.84, -1.6, 1.65, 0.36, 0.26, TIRE, CHROME, TIRE)
    return coll


def build_truck():
    coll = scene_coll("Truck")
    root = root_empty(coll, "Truck")
    PAINT = mat("Paint", "#42A5F5")
    CARGO = mat("Cargo", "#FAFAFA", rough=0.6)
    parts = [
        Part(coll, "cab", bm_box(2.2, 1.9, 1.5), PAINT, loc=(0, -2.75, 1.35)).bevel(0.18, 3),
        Part(coll, "wind", bm_box(1.9, 0.05, 0.62), TINT, loc=(0, -3.70, 1.72)),
        Part(coll, "chassis", bm_box(1.9, 7.2, 0.3), DARK, loc=(0, -0.1, 0.62)),
        Part(coll, "box", bm_box(2.4, 5.2, 2.6), CARGO, loc=(0, 0.95, 2.05)).bevel(0.08, 2),
        Part(coll, "bumperF", bm_box(2.2, 0.22, 0.3), CHROME, loc=(0, -3.75, 0.62)).bevel(0.08, 2),
    ]
    for s in (-1, 1):
        parts.append(Part(coll, "head", bm_box(0.36, 0.06, 0.2), HEAD, loc=(s * 0.75, -3.72, 1.0)).bevel(0.04, 2))
        parts.append(Part(coll, "tail", bm_box(0.18, 0.06, 0.3), TAIL, loc=(s * 1.05, 3.56, 1.0)))
    bake(parts, "Truck_body", coll, parent=root)
    for nm, x, y in (("Wheel_FL", 0.92, -2.7), ("Wheel_FR", -0.92, -2.7),
                     ("Wheel_RL", 0.92, 2.0), ("Wheel_RR", -0.92, 2.0)):
        wheel(coll, root, nm, (x, y, 0.48), 0.48, 0.34, TIRE, CHROME, TIRE)
    return coll


# ── nature ───────────────────────────────────────────────────────────────


def build_tree_round():
    coll = scene_coll("TreeRound")
    root = root_empty(coll, "TreeRound")
    trunk = [Part(coll, "t", bm_cyl(0.28, 0.18, 2.4, 7), BARK, loc=(0, 0, 1.2), smooth=False)]
    canopy = [
        Part(coll, "c1", bm_ico(1.7), LEAVES, loc=(0, 0, 3.3), smooth=False),
        Part(coll, "c2", bm_ico(1.25), LEAVES, loc=(0.95, 0.35, 2.75), smooth=False),
        Part(coll, "c3", bm_ico(1.15), LEAVES, loc=(-0.8, -0.45, 4.05), smooth=False),
        Part(coll, "c4", bm_ico(1.0), LEAVES, loc=(-0.6, 0.8, 2.85), smooth=False),
    ]
    bake(trunk, "Trunk", coll, parent=root)
    bake(canopy, "Canopy", coll, parent=root)
    return coll


def build_tree_pine():
    coll = scene_coll("TreePine")
    root = root_empty(coll, "TreePine")
    trunk = [Part(coll, "t", bm_cyl(0.22, 0.16, 1.6, 7), BARK, loc=(0, 0, 0.8), smooth=False)]
    cones = [
        Part(coll, "c1", bm_cyl(1.9, 0.2, 2.6, 8), PINE, loc=(0, 0, 2.4), smooth=False),
        Part(coll, "c2", bm_cyl(1.45, 0.15, 2.2, 8), PINE, loc=(0, 0, 3.7), rot=(0, 0, 0.3), smooth=False),
        Part(coll, "c3", bm_cyl(1.0, 0.0, 2.0, 8), PINE, loc=(0, 0, 4.9), rot=(0, 0, 0.6), smooth=False),
    ]
    bake(trunk, "Trunk", coll, parent=root)
    bake(cones, "Canopy", coll, parent=root)
    return coll


def build_bush():
    coll = scene_coll("Bush")
    root = root_empty(coll, "Bush")
    parts = [
        Part(coll, "b1", bm_ico(0.8), LEAVES, loc=(0, 0, 0.5), smooth=False),
        Part(coll, "b2", bm_ico(0.6), LEAVES, loc=(0.7, 0.2, 0.4), smooth=False),
        Part(coll, "b3", bm_ico(0.55), LEAVES, loc=(-0.6, -0.2, 0.38), smooth=False),
    ]
    bake(parts, "Canopy", coll, parent=root)
    return coll


# ── houses ───────────────────────────────────────────────────────────────
def house_parts(coll, w, d, wall_h, roof_h, WALLS, ROOF, TRIM, DOOR, WIN, porch=False):
    """A gabled house whose FRONT faces -Y (same as a car's front)."""
    hd = d / 2
    parts = [Part(coll, "walls", bm_prism([(-hd, 0), (hd, 0), (hd, wall_h), (0, wall_h + roof_h), (-hd, wall_h)], w / 2),
                  WALLS, smooth=False)]
    slope = math.atan2(roof_h, hd)
    L = math.hypot(hd, roof_h) + 0.55
    for s in (-1, 1):
        # Roof slab along each slope, with a little overhang.
        mid = Vector((0, s * hd / 2, wall_h + roof_h / 2)) + Vector((0, s * math.sin(slope), math.cos(slope))) * 0.1
        parts.append(Part(coll, "roof", bm_box(w + 0.7, L, 0.2), ROOF, loc=mid, rot=(-s * slope, 0, 0), smooth=False))
    parts.append(Part(coll, "chimney", bm_box(0.7, 0.7, 1.6), mat("Brick", "#A1665E", rough=0.9),
                      loc=(w * 0.28, hd * 0.35, wall_h + roof_h * 0.75), smooth=False))
    # Front: door + windows (+ a tiny mezuzah on the door frame).
    fy = -hd - 0.04
    parts.append(Part(coll, "door", bm_box(1.1, 0.12, 2.1), DOOR, loc=(0, fy, 1.05), smooth=False))
    parts.append(Part(coll, "doorframe", bm_box(1.4, 0.08, 2.35), TRIM, loc=(0, fy + 0.03, 1.15), smooth=False))
    parts.append(Part(coll, "knob", bm_sphere(0.06), CHROME, loc=(0.38, fy - 0.08, 1.05)))
    parts.append(Part(coll, "mezuzah", bm_box(0.06, 0.05, 0.26), mat("Mezuzah", "#C9A227", rough=0.3, metal=0.7),
                      loc=(0.62, fy - 0.06, 1.65), rot=(0, -0.35, 0)))
    for x in (-w * 0.3, w * 0.3):
        parts.append(Part(coll, "winframe", bm_box(1.5, 0.08, 1.25), TRIM, loc=(x, fy + 0.02, wall_h * 0.55), smooth=False))
        parts.append(Part(coll, "win", bm_box(1.25, 0.1, 1.0), WIN, loc=(x, fy, wall_h * 0.55), smooth=False))
    # Side windows
    for sx in (-1, 1):
        parts.append(Part(coll, "sidewin", bm_box(0.1, 1.2, 1.0), WIN, loc=(sx * (w / 2 + 0.04), 0, wall_h * 0.55), smooth=False))
    if porch:
        parts.append(Part(coll, "porch", bm_box(w * 0.7, 2.2, 0.25), TRIM, loc=(0, -hd - 1.1, 0.12), smooth=False))
        parts.append(Part(coll, "porchRoof", bm_box(w * 0.72, 2.4, 0.15), ROOF, loc=(0, -hd - 1.1, wall_h * 0.8), smooth=False))
        for x in (-w * 0.33, w * 0.33):
            parts.append(Part(coll, "column", bm_cyl(0.12, 0.12, wall_h * 0.8, 10), TRIM, loc=(x, -hd - 2.1, wall_h * 0.4)))
    return parts


def build_house():
    coll = scene_coll("House")
    root = root_empty(coll, "House")
    parts = house_parts(coll, 8.0, 7.0, 3.2, 2.1,
                        mat("Walls", "#FFE0B2", rough=0.9), mat("Roof", "#C0504D", rough=0.8),
                        mat("Trim", "#FFFFFF", rough=0.7), mat("Door", "#6D4C41", rough=0.7),
                        mat("Window", "#9AD9F5", rough=0.1, emit=0.25))
    bake(parts, "House_body", coll, parent=root)
    return coll


def build_bubbe_house():
    coll = scene_coll("BubbeHouse")
    root = root_empty(coll, "BubbeHouse")
    WALLS = mat("BubbeWalls", "#FFE38A", rough=0.9)
    ROOF = mat("BubbeRoof", "#4E8F5A", rough=0.8)
    TRIM = mat("Trim", "#FFFFFF", rough=0.7)
    parts = house_parts(coll, 11.0, 8.5, 3.6, 2.6, WALLS, ROOF, TRIM,
                        mat("BubbeDoor", "#1E5AA8", rough=0.6), mat("Window", "#9AD9F5", rough=0.1, emit=0.25), porch=True)
    # Shutters, a white picket fence, flower boxes and a mailbox.
    SHUT = mat("Shutter", "#1E5AA8", rough=0.6)
    for x in (-11.0 * 0.3, 11.0 * 0.3):
        for s in (-1, 1):
            parts.append(Part(coll, "shutter", bm_box(0.35, 0.1, 1.25), SHUT, loc=(x + s * 0.95, -4.3, 3.6 * 0.55), smooth=False))
        parts.append(Part(coll, "flowerbox", bm_box(1.5, 0.35, 0.25), mat("Planter", "#8D6E63"), loc=(x, -4.45, 1.25), smooth=False))
        for k in range(5):
            parts.append(Part(coll, "flower", bm_ico(0.13), mat("Flower%d" % (k % 3), ("#FF6F91", "#FFD54F", "#BA68C8")[k % 3]),
                              loc=(x - 0.6 + k * 0.3, -4.45, 1.45), smooth=False))
    fence_y = -9.5
    for i in range(-14, 15):
        if abs(i) <= 1:
            continue  # gate gap
        parts.append(Part(coll, "picket", bm_box(0.12, 0.06, 1.0), TRIM, loc=(i * 0.45, fence_y, 0.5), smooth=False))
    for s in (-1, 1):
        parts.append(Part(coll, "rail", bm_box(5.8, 0.05, 0.08), TRIM, loc=(s * 3.55, fence_y + 0.05, 0.7), smooth=False))
    parts.append(Part(coll, "path", bm_box(1.4, 5.4, 0.04), mat("Path", "#CFC3B0", rough=0.95), loc=(0, -7.0, 0.02), smooth=False))
    parts.append(Part(coll, "mailpost", bm_box(0.1, 0.1, 1.1), mat("Door", "#6D4C41"), loc=(2.0, -10.2, 0.55), smooth=False))
    parts.append(Part(coll, "mailbox", bm_box(0.35, 0.6, 0.35), SHUT, loc=(2.0, -10.2, 1.2)).bevel(0.08, 3))
    parts.append(Part(coll, "flag", bm_box(0.03, 0.05, 0.3), mat("LightRed", "#FF1744", emit=0.5), loc=(2.2, -10.0, 1.4)))
    bake(parts, "BubbeHouse_body", coll, parent=root)
    return coll


def build_bubbe():
    """Bubbe: purple housecoat, grey bun, big glasses. Arm_Wave pivots at the shoulder."""
    coll = scene_coll("Bubbe")
    root = root_empty(coll, "Bubbe")
    DRESS = mat("Housecoat", "#8E5CC2", rough=0.8)
    APRON = mat("Apron", "#FFFFFF", rough=0.8)
    SKIN = mat("Skin", "#FFD2B0", rough=0.7)
    GREY = mat("GreyHair", "#D9D9DE", rough=0.8)
    EYE = mat("Eye", "#1B1B1B", rough=0.3)
    FRAME = mat("Glasses", "#C9A227", rough=0.3, metal=0.7)
    CHEEK = mat("Cheek", "#FF8A9A", rough=0.8)
    parts = [
        Part(coll, "dress", bm_cyl(0.42, 0.24, 1.1, 18), DRESS, loc=(0, 0, 0.62)),
        Part(coll, "apron", bm_box(0.36, 0.05, 0.6), APRON, loc=(0, -0.34, 0.6), rot=(0.18, 0, 0)).bevel(0.03, 2),
        Part(coll, "shoulders", bm_sphere(0.3, 0.22, 0.2), DRESS, loc=(0, 0, 1.18)),
        Part(coll, "head", bm_sphere(0.24, 0.23, 0.25, 20, 14), SKIN, loc=(0, -0.02, 1.52)),
        Part(coll, "hair", bm_sphere(0.25, 0.23, 0.2, 20, 12), GREY, loc=(0, 0.04, 1.62)),
        Part(coll, "bun", bm_sphere(0.13), GREY, loc=(0, 0.12, 1.86)),
        Part(coll, "smile", bm_sphere(0.06, 0.012, 0.02, 10, 6), EYE, loc=(0, -0.245, 1.44)),
        Part(coll, "armL", bm_sphere(0.08, 0.08, 0.3), DRESS, loc=(-0.3, -0.05, 0.98), rot=(0, 0.25, 0)),
        Part(coll, "handL", bm_sphere(0.07), SKIN, loc=(-0.37, -0.08, 0.7)),
        Part(coll, "shoeL", bm_sphere(0.1, 0.16, 0.06), EYE, loc=(-0.12, -0.08, 0.05)),
        Part(coll, "shoeR", bm_sphere(0.1, 0.16, 0.06), EYE, loc=(0.12, -0.08, 0.05)),
    ]
    for s in (-1, 1):
        parts.append(Part(coll, "eye", bm_sphere(0.03, 0.02, 0.035, 10, 8), EYE, loc=(s * 0.08, -0.235, 1.55)))
        parts.append(Part(coll, "lens", bm_torus(0.06, 0.012, 14, 5), FRAME, loc=(s * 0.08, -0.25, 1.55), rot=(math.pi / 2, 0, 0)))
        parts.append(Part(coll, "cheek", bm_sphere(0.045, 0.012, 0.03, 10, 6), CHEEK, loc=(s * 0.15, -0.215, 1.47)))
    bake(parts, "Bubbe_body", coll, parent=root)
    shoulder = (0.3, -0.02, 1.2)
    bake_at([Part(coll, "armR", bm_sphere(0.08, 0.08, 0.3), DRESS, loc=(0.36, -0.02, 1.45), rot=(0, -0.3, 0)),
             Part(coll, "handR", bm_sphere(0.075), SKIN, loc=(0.44, -0.02, 1.75))], "Arm_Wave", coll, root, shoulder)
    return coll



# ── people everyone reuses ───────────────────────────────────────────────
def build_lulu_person():
    # Lulu on foot: same look as in the car (brown sheitel, sky-blue top,
    # long navy skirt, shades pushed up on her head).
    return build_person("LuluPerson", dict(hair="sheitel", hair_color="#8B5A2B", top="#4FC3F7",
                        bottom="skirt", bottom_color="#283593", shoes="#E91E63", extras=["sunglasses_up"]))


def build_dina_person():
    # Dina: Lulu's little sister - ponytail with a pink tie, pink top, purple skirt.
    return build_person("DinaPerson", dict(hair="ponytail", hair_color="#6D4C41", top="#F48FB1", height=1.12, kid=True,
                        bottom="skirt", bottom_color="#7E57C2", shoes="#FFFFFF", sleeves="short"))


def build_npc_woman():
    # Generic townsperson; recolour Top/Bottom/Hair at runtime for variety.
    return build_person("NpcWoman", dict(hair="sheitel", hair_color="#4E342E", top="#81C784", bottom="skirt", bottom_color="#37474F"))


def build_npc_man():
    return build_person("NpcMan", dict(hair="short", hair_color="#3E2723", top="#FFFFFF", bottom="pants", bottom_color="#212121",
                        extras=["kippah"], width=1.08))


def build_npc_kid():
    return build_person("NpcKid", dict(hair="short", hair_color="#5D4037", top="#FFB74D", bottom="pants", bottom_color="#1565C0", height=1.1, kid=True,
                        sleeves="short"))


ASSETS = [
    ("lulu_car", build_lulu_car),
    ("sedan", lambda: build_sedan("Sedan")),
    ("cop_car", lambda: build_sedan("CopCar", cop=True)),
    ("van", build_van),
    ("truck", build_truck),
    ("tree_round", build_tree_round),
    ("tree_pine", build_tree_pine),
    ("bush", build_bush),
    ("house", build_house),
    ("bubbe_house", build_bubbe_house),
    ("bubbe", build_bubbe),
    ("lulu_person", build_lulu_person),
    ("dina_person", build_dina_person),
    ("npc_woman", build_npc_woman),
    ("npc_man", build_npc_man),
    ("npc_kid", build_npc_kid),
]
