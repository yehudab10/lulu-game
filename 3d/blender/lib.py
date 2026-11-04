"""
Shared Blender helpers for Lulu's Road Trip 3D asset modules.

Asset modules (assets_<feature>.py) do `from lib import *` and expose
    ASSETS = [("file_name", builder_fn), ...]
where builder_fn() builds ONE collection whose single top-level object is the
asset root (an Empty), and returns that collection. The runner
(make_assets.py) exports each one to 3d/assets/<file_name>.glb.

Conventions the game relies on: metres; the asset's FRONT faces Blender -Y
(= +Z in three.js); colours are given as sRGB hex; materials are matched by
NAME at runtime (see 3d/ARCHITECTURE.md).
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector, Matrix
from types import SimpleNamespace

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



def reset():
    """Empty the Blender file and the material cache (the runner calls this per module)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def shared():
    """Materials every module may share (created on first use in the current file)."""
    return SimpleNamespace(
        TIRE=mat("Tire", "#262626", rough=0.9),
        RIM=mat("Rim", "#F5F5F5", rough=0.35, metal=0.3),
        CHROME=mat("Chrome", "#D7DCE0", rough=0.22, metal=0.85),
        HEAD=mat("Headlight", "#FFF8E1", rough=0.2, emit=2.0),
        TAIL=mat("Taillight", "#FF1744", rough=0.3, emit=1.2),
        GLASS=mat("Glass", "#9FD8FF", rough=0.05),
        TINT=mat("GlassTint", "#2B3A42", rough=0.08, metal=0.2),
        DARK=mat("DarkTrim", "#37474F", rough=0.7),
        PLATE=mat("Plate", "#FAFAFA", rough=0.6),
        PLATE_TXT=mat("PlateText", "#283593", rough=0.6),
        BARK=mat("Bark", "#7B5537", rough=0.9),
        LEAVES=mat("Leaves", "#6CC24A", rough=0.85),
        PINE=mat("PineLeaves", "#2F8F46", rough=0.85),
        WHITE=mat("White", "#FAFAFA", rough=0.6),
        BLACK=mat("Black", "#1B1B1B", rough=0.5),
    )


def anchor(coll, root, name, loc):
    """An Empty the game can attach things to (decorations, hats, passengers…)."""
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "SPHERE"
    e.empty_display_size = 0.08
    coll.objects.link(e)
    e.parent = root
    e.location = loc
    return e
