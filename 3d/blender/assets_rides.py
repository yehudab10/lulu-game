"""
Rides (feature "rides"): what makes each vehicle Lulu can drive its own thing.

Conventions (see 3d/ARCHITECTURE.md): metres, FRONT = Blender -Y (= +Z in
three.js), Blender +X = the model's LEFT. Every file is prefixed rides_.

  rides_taxi      a yellow city cab (sedan proportions, so it drives / jacks like
                  one): checker band, roof TAXI light (Neon_Taxi, emissive),
                  Wheel_* nodes. Paint = the yellow (kept, never re-tinted).
  rides_er        the ambulance bay of St. Shloimy's: a short facade with glass
                  doors, a red EMERGENCY sign (Neon_ER) and a canopy that
                  reaches out over the shoulder. Front faces -Y (the road);
                  origin = the foot of the facade, centred; the canopy spans
                  y -3.6 .. 0, the building y 0 .. +5.
  rides_busstop   a bus shelter: bench, glass back, roof, and a pole with the
                  blue BUS sign. Front faces -Y; origin at the kerb centre.
  rides_cone      a kid-size ice-cream cone (held in a hand; origin at the tip
                  of the cone, pointing down -Z).
"""
from lib import *


def setup():
    global S
    S = shared()


def text_lo(coll, body, size, m, loc, face="-Y", extrude=0.0):
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
    rot = {"-Y": (math.pi / 2, 0, 0), "+Y": (math.pi / 2, 0, math.pi),
           "+X": (math.pi / 2, 0, math.pi / 2), "-X": (math.pi / 2, 0, -math.pi / 2)}[face]
    return Part(coll, "txt", bm, m, loc=loc, rot=rot, smooth=False)


# ── the cab ──────────────────────────────────────────────────────────────
def build_taxi():
    coll = scene_coll("RidesTaxi")
    root = root_empty(coll, "RidesTaxi")
    PAINT = mat("Paint", "#FFC107", rough=0.32)
    INK = mat("TaxiInk", "#1B1B1B", rough=0.5)
    CHK = mat("TaxiCheck", "#FAFAFA", rough=0.5)
    SIGN = mat("Neon_Taxi", "#FFF3C4", rough=0.3, emit=1.6)
    parts = [
        Part(coll, "body", bm_box(1.80, 4.4, 0.62), PAINT, loc=(0, 0, 0.66)).bevel(0.14, 3),
        Part(coll, "cabin", bm_box(1.58, 2.15, 0.56), S.TINT, loc=(0, 0.25, 1.20)).bevel(0.16, 3),
        Part(coll, "roof", bm_box(1.50, 1.75, 0.08), PAINT, loc=(0, 0.28, 1.47)).bevel(0.04, 2),
        Part(coll, "bumperF", bm_box(1.76, 0.2, 0.18), S.DARK, loc=(0, -2.2, 0.48)).bevel(0.06, 2),
        Part(coll, "bumperR", bm_box(1.76, 0.2, 0.18), S.DARK, loc=(0, 2.2, 0.48)).bevel(0.06, 2),
        # roof light: a little two-sided TAXI box on a black base
        Part(coll, "signBase", bm_box(0.78, 0.36, 0.05), INK, loc=(0, 0.28, 1.535)),
        Part(coll, "sign", bm_box(0.72, 0.3, 0.22), SIGN, loc=(0, 0.28, 1.67)).bevel(0.04, 2),
    ]
    parts.append(text_lo(coll, "TAXI", 0.16, INK, (0, 0.28 - 0.152, 1.67), "-Y"))
    parts.append(text_lo(coll, "TAXI", 0.16, INK, (0, 0.28 + 0.152, 1.67), "+Y"))
    for s in (-1, 1):
        parts.append(Part(coll, "head", bm_box(0.38, 0.06, 0.13), S.HEAD, loc=(s * 0.58, -2.19, 0.74)).bevel(0.03, 2))
        parts.append(Part(coll, "tail", bm_box(0.36, 0.06, 0.13), S.TAIL, loc=(s * 0.6, 2.19, 0.80)).bevel(0.03, 2))
        # the checker band along each side (two rows, alternating)
        for i in range(16):
            y = -1.82 + i * 0.24
            for row in (0, 1):
                m = CHK if (i + row) % 2 == 0 else INK
                parts.append(Part(coll, "chk", bm_box(0.02, 0.24, 0.07), m, loc=(s * 0.905, y, 0.80 + row * 0.07), smooth=False))
        parts.append(text_lo(coll, "LULU CAB", 0.15, INK, (s * 0.908, 0.55, 0.62), "+X" if s > 0 else "-X"))
    bake(parts, "RidesTaxi_body", coll, parent=root)
    four_wheels(coll, root, 0.80, -1.42, 1.42, 0.34, 0.24, S.TIRE, S.CHROME, S.TIRE)
    return coll


# ── the ambulance bay ────────────────────────────────────────────────────
def build_er():
    coll = scene_coll("RidesER")
    root = root_empty(coll, "RidesER")
    WALL = mat("Walls", "#ECEFF1", rough=0.8)
    TRIM = mat("ERTrim", "#90A4AE", rough=0.6)
    RED = mat("ERRed", "#D32F2F", rough=0.45)
    SIGN = mat("Neon_ER", "#FF5252", rough=0.3, emit=2.2)
    DOOR = mat("GlassER", "#9FD8FF", rough=0.05)
    CANOPY = mat("ERCanopy", "#FAFAFA", rough=0.5)
    STEEL = mat("ERSteel", "#B0BEC5", rough=0.4, metal=0.6)
    W = 12.0
    parts = [
        Part(coll, "building", bm_box(W, 5.0, 5.2), WALL, loc=(0, 2.5, 2.6)),
        Part(coll, "base", bm_box(W + 0.1, 5.1, 0.5), TRIM, loc=(0, 2.5, 0.25)),
        Part(coll, "parapet", bm_box(W + 0.2, 5.2, 0.35), TRIM, loc=(0, 2.5, 5.35)),
        Part(coll, "doors", bm_box(3.2, 0.08, 2.6), DOOR, loc=(0, -0.03, 1.55)),
        Part(coll, "doorFrame", bm_box(3.5, 0.06, 0.2), STEEL, loc=(0, -0.05, 2.95)),
        Part(coll, "doorMid", bm_box(0.08, 0.1, 2.6), STEEL, loc=(0, -0.08, 1.55)),
        # the canopy over the drop-off lane (reaches toward the road, -Y)
        Part(coll, "canopy", bm_box(7.4, 3.8, 0.28), CANOPY, loc=(0, -1.8, 3.9)).bevel(0.06, 2),
        Part(coll, "canopyEdge", bm_box(7.5, 0.12, 0.42), RED, loc=(0, -3.72, 3.9)),
        Part(coll, "kerb", bm_box(7.0, 1.2, 0.14), TRIM, loc=(0, -0.55, 0.07)),
    ]
    for x in (-3.4, 3.4):
        parts.append(Part(coll, "post", bm_cyl(0.14, 0.14, 3.8, 12), STEEL, loc=(x, -3.4, 1.9)))
        parts.append(Part(coll, "bollard", bm_cyl(0.16, 0.16, 0.9, 10), mat("ERYellow", "#FFC107", rough=0.5), loc=(x * 0.62, -1.3, 0.45)))
    # EMERGENCY on the canopy edge, and a big red cross on the wall
    parts.append(Part(coll, "signBox", bm_box(4.6, 0.16, 0.7), SIGN, loc=(0, -3.86, 4.55)).bevel(0.05, 2))
    parts.append(text_lo(coll, "EMERGENCY", 0.5, mat("ERInk", "#FFFFFF", rough=0.5), (0, -3.95, 4.55), "-Y"))
    parts.append(Part(coll, "crossV", bm_box(0.6, 0.1, 1.8), RED, loc=(-4.2, -0.05, 3.6)))
    parts.append(Part(coll, "crossH", bm_box(1.8, 0.1, 0.6), RED, loc=(-4.2, -0.05, 3.6)))
    parts.append(text_lo(coll, "ST. SHLOIMY'S", 0.42, RED, (3.6, -0.06, 4.6), "-Y"))
    parts.append(text_lo(coll, "AMBULANCE ONLY", 0.26, RED, (3.6, -0.06, 2.2), "-Y"))
    # windows either side of the doors
    for x in (-4.4, -2.6, 2.6, 4.4):
        parts.append(Part(coll, "win", bm_box(1.2, 0.06, 1.0), DOOR, loc=(x, -0.02, 1.8)))
    bake(parts, "RidesER_body", coll, parent=root)
    return coll


# ── the bus stop ─────────────────────────────────────────────────────────
def build_busstop():
    coll = scene_coll("RidesBusStop")
    root = root_empty(coll, "RidesBusStop")
    STEEL = mat("StopSteel", "#90A4AE", rough=0.4, metal=0.6)
    GLASS = mat("GlassStop", "#BFE6FF", rough=0.05)
    ROOF = mat("StopRoof", "#1565C0", rough=0.5)
    BENCH = mat("StopBench", "#8D6E63", rough=0.8)
    SIGN = mat("StopSign", "#1E88E5", rough=0.4)
    INK = mat("StopInk", "#FFFFFF", rough=0.5)
    parts = [
        Part(coll, "roof", bm_box(3.6, 1.7, 0.12), ROOF, loc=(0, 0.75, 2.45)).bevel(0.04, 2),
        Part(coll, "back", bm_box(3.4, 0.06, 1.9), GLASS, loc=(0, 1.5, 1.35)),
        Part(coll, "seat", bm_box(2.6, 0.42, 0.08), BENCH, loc=(0, 1.15, 0.5)),
        Part(coll, "slab", bm_box(4.2, 2.3, 0.1), mat("StopSlab", "#BDBDBD", rough=0.9), loc=(0, 0.6, 0.05)),
    ]
    for x in (-1.7, 1.7):
        parts.append(Part(coll, "post", bm_box(0.08, 0.08, 2.4), STEEL, loc=(x, 1.5, 1.2)))
        parts.append(Part(coll, "side", bm_box(0.05, 1.2, 1.7), GLASS, loc=(x, 0.95, 1.35)))
    for x in (-1.0, 1.0):
        parts.append(Part(coll, "leg", bm_box(0.06, 0.3, 0.45), STEEL, loc=(x, 1.15, 0.25)))
    # the pole + sign at the kerb
    parts.append(Part(coll, "pole", bm_cyl(0.05, 0.05, 2.9, 10), STEEL, loc=(-2.4, -0.2, 1.45)))
    parts.append(Part(coll, "sign", bm_box(0.75, 0.05, 0.55), SIGN, loc=(-2.4, -0.2, 2.75)).bevel(0.03, 2))
    parts.append(text_lo(coll, "BUS", 0.22, INK, (-2.4, -0.23, 2.83), "-Y"))
    parts.append(text_lo(coll, "STOP", 0.15, INK, (-2.4, -0.23, 2.62), "-Y"))
    parts.append(text_lo(coll, "BUS", 0.22, INK, (-2.4, -0.17, 2.83), "+Y"))
    parts.append(text_lo(coll, "LINE 18", 0.13, ROOF, (0.4, 0.22, 2.75), "-Y"))
    bake(parts, "RidesBusStop_body", coll, parent=root)
    return coll


# ── a cone for the kids ──────────────────────────────────────────────────
def build_cone():
    coll = scene_coll("RidesCone")
    root = root_empty(coll, "RidesCone")
    WAF = mat("ConeWaffle", "#D7A86E", rough=0.8)
    SC = mat("ConeScoop", "#F48FB1", rough=0.6)
    parts = [
        Part(coll, "cone", bm_cyl(0.0, 0.055, 0.16, 10), WAF, loc=(0, 0, 0.08)),
        Part(coll, "scoop", bm_sphere(0.065, 0.065, 0.06, 10, 8), SC, loc=(0, 0, 0.18)),
    ]
    bake(parts, "RidesCone_body", coll, parent=root)
    return coll


ASSETS = [
    ("rides_taxi", build_taxi),
    ("rides_er", build_er),
    ("rides_busstop", build_busstop),
    ("rides_cone", build_cone),
]
