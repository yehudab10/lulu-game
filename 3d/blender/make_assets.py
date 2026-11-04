"""
Lulu's Road Trip 3D - Blender asset factory.

Builds every 3D model the game uses (Lulu's pink convertible - with Lulu in
it - traffic cars, a cop car, trees, houses and Bubbe's house) entirely from
code, then exports each one as a .glb for Three.js and saves the whole set as
an editable lulu_assets.blend.

Run it with any recent Blender (4.2+ / 5.x):

    blender -b -P 3d/blender/make_assets.py              # headless
    blender -b -P 3d/blender/make_assets.py -- --render  # + a preview JPG

or without the Blender app, using the pip build of Blender (`pip install bpy`):

    python 3d/blender/make_assets.py [--render]

Outputs:  3d/assets/<name>.glb  and  3d/blender/lulu_assets.blend

Conventions the game relies on (see 3d/js/models.js):
  * metres; the car's FRONT points along Blender -Y  (= +Z in three.js);
  * wheels are separate objects named Wheel_FL / Wheel_FR / Wheel_RL / Wheel_RR
    with their origin at the hub, so the game can spin and steer them;
  * materials named Body / BodyLight / BodyDark get recoloured to the player's
    skin, Paint to each traffic car's colour, Walls / Roof per house, and
    Headlight / Taillight / LightRed / LightBlue are animated (braking, sirens).
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "assets"))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
RENDER = "--render" in ARGS


# ── helpers ──────────────────────────────────────────────────────────────
def lin(hexcol):
    """'#RRGGBB' (sRGB) -> linear RGBA, which is what glTF/Blender store."""
    h = hexcol.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


MATS = {}


def mat(name, hexcol, rough=0.55, metal=0.0, emit=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = lin(hexcol)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit > 0:
        b.inputs["Emission Color"].default_value = lin(hexcol)
        b.inputs["Emission Strength"].default_value = emit
    m.diffuse_color = lin(hexcol)
    MATS[name] = m
    return m


def scene_coll(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


class Part:
    """A mesh object under construction (with optional modifiers)."""

    def __init__(self, coll, name, bm, material, loc=(0, 0, 0), rot=(0, 0, 0), smooth=True, parent=None):
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        if material is not None:
            me.materials.append(material)
        self.ob = bpy.data.objects.new(name, me)
        coll.objects.link(self.ob)
        self.ob.location = loc
        self.ob.rotation_euler = rot
        if parent is not None:
            self.ob.parent = parent
        self.smooth = smooth

    def bevel(self, width, segs=3):
        m = self.ob.modifiers.new("Bevel", "BEVEL")
        m.width = width
        m.segments = segs
        m.limit_method = "NONE"
        return self

    def cut(self, cutter):
        m = self.ob.modifiers.new("Cut", "BOOLEAN")
        m.operation = "DIFFERENCE"
        m.object = cutter.ob
        return self


def bm_box(sx, sy, sz):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    return bm


def bm_cyl(r1, r2, depth, segs=16, axis="Z"):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=r1, radius2=r2, depth=depth)
    if axis == "X":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "Y"))
    elif axis == "Y":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
    return bm


def bm_sphere(rx, ry=None, rz=None, u=16, v=10):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=1.0)
    bmesh.ops.scale(bm, vec=(rx, ry if ry else rx, rz if rz else rx), verts=bm.verts)
    return bm


def bm_ico(r, subdiv=1):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
    return bm


def bm_torus(R, r, seg=18, rseg=6):
    """Torus in the XY plane (hole along Z)."""
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ring = []
        for j in range(rseg):
            b = 2 * math.pi * j / rseg
            d = R + r * math.cos(b)
            ring.append(bm.verts.new((d * math.cos(a), d * math.sin(a), r * math.sin(b))))
        rings.append(ring)
    for i in range(seg):
        for j in range(rseg):
            a, b = rings[i], rings[(i + 1) % seg]
            bm.faces.new((a[j], b[j], b[(j + 1) % rseg], a[(j + 1) % rseg]))
    return bm


def bm_prism(profile_yz, half_x):
    """Extrude a YZ polygon (counter-clockwise seen from +X) along X."""
    bm = bmesh.new()
    left = [bm.verts.new((-half_x, y, z)) for (y, z) in profile_yz]
    right = [bm.verts.new((half_x, y, z)) for (y, z) in profile_yz]
    n = len(profile_yz)
    bm.faces.new(list(reversed(left)))
    bm.faces.new(right)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((left[i], left[j], right[j], right[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_text(body, size, extrude=0.004):
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = body
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.extrude = extrude
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


def limb(coll, name, a, b, r, material, parent=None):
    """A cylinder from point a to point b (arms, poles...)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    p = Part(coll, name, bm_cyl(r, r, d.length, 8), material, loc=(a + b) / 2, parent=parent)
    p.ob.rotation_mode = "QUATERNION"
    p.ob.rotation_quaternion = d.to_track_quat("Z", "Y")
    return p


def bake(parts, name, coll, parent=None, sharp_deg=38):
    """Apply modifiers and join `parts` into one multi-material object.

    One object with N materials == N draw calls in three.js, instead of one per
    part, which keeps the busy road cheap on phones.
    """
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    mats = []
    for p in parts:
        me = bpy.data.meshes.new_from_object(p.ob.evaluated_get(dg))
        me.transform(p.ob.matrix_world)
        if p.smooth:
            me.shade_smooth()
            if hasattr(me, "set_sharp_from_angle"):
                me.set_sharp_from_angle(angle=math.radians(sharp_deg))
        else:
            me.shade_flat()
        # Map this part's material slots onto the joined object's slot list.
        # (Boolean cutters can add empty slots - those fall back to the part's
        # own first real material.)
        own = [m for m in me.materials if m is not None]
        remap = []
        for m in me.materials:
            m = m if m is not None else (own[0] if own else None)
            if m is None:
                remap.append(0)
                continue
            if m not in mats:
                mats.append(m)
            remap.append(mats.index(m))
        bm.faces.ensure_lookup_table()
        start = len(bm.faces)
        bm.from_mesh(me)
        bm.faces.ensure_lookup_table()
        for f in bm.faces[start:]:
            i = f.material_index
            f.material_index = remap[i] if i < len(remap) else (remap[0] if remap else 0)
        bpy.data.meshes.remove(me)
    out = bpy.data.meshes.new(name)
    bm.to_mesh(out)
    bm.free()
    for m in mats:
        out.materials.append(m)
    ob = bpy.data.objects.new(name, out)
    coll.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    # Drop the construction parts (and any boolean cutters they used).
    for p in parts:
        for mod in p.ob.modifiers:
            if mod.type == "BOOLEAN" and mod.object and mod.object.name in bpy.data.objects:
                bpy.data.objects.remove(mod.object)
        me = p.ob.data
        bpy.data.objects.remove(p.ob)
        if me.users == 0:
            bpy.data.meshes.remove(me)
    return ob


def bake_at(parts, name, coll, root, pivot):
    """Like bake() but the joined object's origin sits at `pivot` (wheel hubs)."""
    ob = bake(parts, name, coll)
    ob.data.transform(Matrix.Translation(-Vector(pivot)))
    ob.location = pivot
    ob.parent = root
    return ob


def root_empty(coll, name):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "PLAIN_AXES"
    coll.objects.link(e)
    return e


def wheel(coll, root, name, loc, radius, width, tire, rim, spoke_mat):
    x, y, z = loc
    parts = [
        Part(coll, name + "_tire", bm_cyl(radius, radius, width, 20, "X"), tire, loc=loc),
        Part(coll, name + "_rim", bm_cyl(radius * 0.6, radius * 0.6, width + 0.02, 16, "X"), rim, loc=loc),
    ]
    # Two crossed spokes so you can actually SEE the wheel spin.
    for k in range(2):
        s = Part(coll, name + "_spoke%d" % k, bm_box(width + 0.04, radius * 1.05, radius * 0.16), spoke_mat,
                 loc=loc, rot=(k * math.pi / 2, 0, 0))
        parts.append(s)
    parts.append(Part(coll, name + "_hub", bm_cyl(radius * 0.18, radius * 0.18, width + 0.06, 10, "X"), rim, loc=loc))
    return bake_at(parts, name, coll, root, loc)


def four_wheels(coll, root, track, front_y, rear_y, radius, width, tire, rim, spoke):
    for nm, x, y in (("Wheel_FL", track, front_y), ("Wheel_FR", -track, front_y),
                     ("Wheel_RL", track, rear_y), ("Wheel_RR", -track, rear_y)):
        wheel(coll, root, nm, (x, y, radius), radius, width, tire, rim, spoke)


# ── shared materials ─────────────────────────────────────────────────────
TIRE = mat("Tire", "#262626", rough=0.9)
RIM = mat("Rim", "#F5F5F5", rough=0.35, metal=0.3)
CHROME = mat("Chrome", "#D7DCE0", rough=0.22, metal=0.85)
HEAD = mat("Headlight", "#FFF8E1", rough=0.2, emit=2.0)
TAIL = mat("Taillight", "#FF1744", rough=0.3, emit=1.2)
GLASS = mat("Glass", "#9FD8FF", rough=0.05)
TINT = mat("GlassTint", "#2B3A42", rough=0.08, metal=0.2)
DARK = mat("DarkTrim", "#37474F", rough=0.7)
PLATE = mat("Plate", "#FAFAFA", rough=0.6)
PLATE_TXT = mat("PlateText", "#283593", rough=0.6)


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

    # Lulu herself (chibi proportions so she reads from the chase cam): shirt,
    # head, brown sheitel, big eyes, rosy cheeks, shades pushed up on her head.
    hr, hy, hz = 0.235, 0.38, 1.60
    parts.append(Part(coll, "torso", bm_sphere(0.21, 0.16, 0.27), SHIRT, loc=(lx, 0.46, 1.10)))
    parts.append(Part(coll, "neck", bm_cyl(0.06, 0.06, 0.14, 10), SKIN, loc=(lx, 0.42, 1.36)))
    parts.append(Part(coll, "head", bm_sphere(hr, hr * 0.95, hr * 1.02, 22, 16), SKIN, loc=(lx, hy, hz)))
    parts.append(Part(coll, "hair", bm_sphere(hr * 1.08, hr, hr * 1.04, 22, 16), HAIR, loc=(lx, hy + 0.06, hz + 0.05)))
    parts.append(Part(coll, "hairBack", bm_sphere(hr * 1.12, 0.13, hr * 1.45), HAIR, loc=(lx, hy + 0.15, hz - 0.18)))
    for s in (-1, 1):
        parts.append(Part(coll, "hairSide", bm_sphere(0.08, 0.1, 0.25), HAIR, loc=(lx + s * hr * 0.9, hy + 0.02, hz - 0.12)))
        parts.append(Part(coll, "eye", bm_sphere(0.038, 0.02, 0.05, 10, 8), EYE, loc=(lx + s * 0.085, hy - hr * 0.92, hz)))
        parts.append(Part(coll, "shine", bm_sphere(0.012, 0.01, 0.012, 6, 4), RIM, loc=(lx + s * 0.085 + 0.012, hy - hr * 0.98, hz + 0.018)))
        parts.append(Part(coll, "cheek", bm_sphere(0.04, 0.012, 0.025, 10, 6), CHEEK, loc=(lx + s * 0.145, hy - hr * 0.84, hz - 0.075)))
        parts.append(Part(coll, "lens", bm_sphere(0.06, 0.022, 0.045, 10, 6), SHADES, loc=(lx + s * 0.085, hy - 0.11, hz + 0.21), rot=(-0.6, 0, 0)))
        # arms reaching for the wheel
        parts.append(limb(coll, "arm", (lx + s * 0.19, 0.42, 1.24), (lx + s * 0.13, -0.16, 1.05), 0.045, SHIRT))
        parts.append(Part(coll, "hand", bm_sphere(0.05), SKIN, loc=(lx + s * 0.13, -0.18, 1.05)))
    parts.append(Part(coll, "mouth", bm_sphere(0.04, 0.012, 0.018, 10, 6), EYE, loc=(lx, hy - hr * 0.96, hz - 0.1)))

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
BARK = mat("Bark", "#7B5537", rough=0.9)
LEAVES = mat("Leaves", "#6CC24A", rough=0.85)
PINE = mat("PineLeaves", "#2F8F46", rough=0.85)


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


# ── build everything ─────────────────────────────────────────────────────
def main():
    # Start from an empty file (drop the default cube / camera / light).
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    os.makedirs(OUT, exist_ok=True)

    # re-create shared materials in the fresh file
    global TIRE, RIM, CHROME, HEAD, TAIL, GLASS, TINT, DARK, PLATE, PLATE_TXT, BARK, LEAVES, PINE
    TIRE = mat("Tire", "#262626", rough=0.9)
    RIM = mat("Rim", "#F5F5F5", rough=0.35, metal=0.3)
    CHROME = mat("Chrome", "#D7DCE0", rough=0.22, metal=0.85)
    HEAD = mat("Headlight", "#FFF8E1", rough=0.2, emit=2.0)
    TAIL = mat("Taillight", "#FF1744", rough=0.3, emit=1.2)
    GLASS = mat("Glass", "#9FD8FF", rough=0.05)
    TINT = mat("GlassTint", "#2B3A42", rough=0.08, metal=0.2)
    DARK = mat("DarkTrim", "#37474F", rough=0.7)
    PLATE = mat("Plate", "#FAFAFA", rough=0.6)
    PLATE_TXT = mat("PlateText", "#283593", rough=0.6)
    BARK = mat("Bark", "#7B5537", rough=0.9)
    LEAVES = mat("Leaves", "#6CC24A", rough=0.85)
    PINE = mat("PineLeaves", "#2F8F46", rough=0.85)

    builders = [
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
    ]
    colls = []
    for fname, fn in builders:
        coll = fn()
        colls.append(coll)
        vl = bpy.context.view_layer
        vl.active_layer_collection = vl.layer_collection.children[coll.name]
        path = os.path.join(OUT, fname + ".glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_active_collection=True,
                                  export_apply=True, export_yup=True, export_cameras=False, export_lights=False)
        print("exported %-12s %7.1f KB" % (fname, os.path.getsize(path) / 1024))

    # Lay the collections out side by side so the .blend is easy to browse.
    x = 0.0
    for coll in colls:
        root = [o for o in coll.objects if o.parent is None][0]
        root.location.x = x
        x += 14.0
    blend = os.path.join(HERE, "lulu_assets.blend")
    if os.path.exists(blend):
        os.remove(blend)  # no lulu_assets.blend1 backup clutter
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    print("saved", blend)

    if RENDER:
        render_preview(colls)


def render_preview(colls):
    """A beauty shot of Lulu's car (Cycles, CPU) -> 3d/blender/preview.jpg"""
    for coll in colls[1:]:
        for o in coll.objects:
            o.hide_render = True
    car = [o for o in colls[0].objects if o.parent is None][0]
    car.location = (0, 0, 0)
    scn = bpy.context.scene
    world = bpy.data.worlds.new("Sky")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = lin("#BFE6FF")
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    scn.world = world
    bpy.ops.mesh.primitive_plane_add(size=60)
    bpy.context.active_object.data.materials.append(mat("Asphalt", "#8A8F99", rough=0.9))
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4.0
    sun.rotation_euler = (math.radians(50), 0, math.radians(35))
    scn.collection.objects.link(sun)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.lens = 45
    scn.collection.objects.link(cam)
    cam.location = (5.4, 6.2, 3.2)
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (Vector((0, -0.2, 0.75)) - cam.location).to_track_quat("-Z", "Y")
    scn.camera = cam
    scn.render.engine = "CYCLES"
    scn.cycles.device = "CPU"
    scn.cycles.samples = 48
    scn.render.resolution_x, scn.render.resolution_y = 1280, 800
    scn.render.image_settings.file_format = "JPEG"
    scn.render.image_settings.quality = 88
    scn.render.filepath = os.path.join(HERE, "preview.jpg")
    bpy.ops.render.render(write_still=True)
    print("rendered", scn.render.filepath)


main()
