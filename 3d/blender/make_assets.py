"""
Lulu's Road Trip 3D - Blender asset factory (runner).

Every 3D model the game uses is built from code by the asset modules next to
this file (assets_core.py, assets_journey.py, assets_law.py, ...). Each module
exposes  ASSETS = [("file_name", builder_fn), ...]  and may define setup().
This runner builds them, exports each one to 3d/assets/<file_name>.glb, and
saves one editable 3d/blender/blend/<module>.blend per module.

    blender -b -P 3d/blender/make_assets.py                       # everything
    blender -b -P 3d/blender/make_assets.py -- --only journey     # one module (assets_journey.py)
    blender -b -P 3d/blender/make_assets.py -- --only heshy,pool  # specific asset file names
    blender -b -P 3d/blender/make_assets.py -- --render           # + preview.jpg of Lulu's car
    python 3d/blender/make_assets.py [same flags]                 # with `pip install bpy`

Helpers live in lib.py (meshes, materials, baking) and lib_people.py
(characters with animatable limbs). See 3d/ARCHITECTURE.md.
"""
import importlib
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
import lib  # noqa: E402

OUT = os.path.normpath(os.path.join(HERE, "..", "assets"))
BLEND_DIR = os.path.join(HERE, "blend")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
RENDER = "--render" in ARGS
ONLY = None
if "--only" in ARGS:
    ONLY = set(ARGS[ARGS.index("--only") + 1].split(","))


def modules():
    names = sorted(f[:-3] for f in os.listdir(HERE) if f.startswith("assets_") and f.endswith(".py"))
    # core first so a full run always starts from a known state
    names.sort(key=lambda n: (n != "assets_core", n))
    return names


def export(coll, path):
    vl = bpy.context.view_layer
    vl.active_layer_collection = vl.layer_collection.children[coll.name]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_active_collection=True,
                              export_apply=True, export_yup=True, export_cameras=False, export_lights=False)


def build_module(modname):
    mod = importlib.import_module(modname)
    short = modname[len("assets_"):]
    wanted = [(f, fn) for f, fn in mod.ASSETS if ONLY is None or short in ONLY or f in ONLY]
    if not wanted:
        return []
    lib.reset()
    if hasattr(mod, "setup"):
        mod.setup()
    os.makedirs(OUT, exist_ok=True)
    colls = []
    for fname, fn in wanted:
        coll = fn()
        colls.append(coll)
        path = os.path.join(OUT, fname + ".glb")
        export(coll, path)
        print("exported %-22s %7.1f KB  (%s)" % (fname, os.path.getsize(path) / 1024, short))
    # lay the collections out side by side so the .blend is easy to browse
    x = 0.0
    for coll in colls:
        roots = [o for o in coll.objects if o.parent is None]
        if roots:
            roots[0].location.x = x
        x += 14.0
    if ONLY is None or short in ONLY:   # only save a module's .blend when it was built whole
        os.makedirs(BLEND_DIR, exist_ok=True)
        blend = os.path.join(BLEND_DIR, short + ".blend")
        if os.path.exists(blend):
            os.remove(blend)
        bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
        print("saved", os.path.relpath(blend, HERE))
    return colls


def render_preview():
    """A beauty shot of Lulu's car (Cycles, CPU) -> 3d/blender/preview.jpg"""
    import assets_core
    lib.reset()
    assets_core.setup()
    coll = assets_core.build_lulu_car()
    car = [o for o in coll.objects if o.parent is None][0]
    car.location = (0, 0, 0)
    scn = bpy.context.scene
    world = bpy.data.worlds.new("Sky")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = lib.lin("#BFE6FF")
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    scn.world = world
    bpy.ops.mesh.primitive_plane_add(size=60)
    bpy.context.active_object.data.materials.append(lib.mat("Asphalt", "#8A8F99", rough=0.9))
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


def main():
    for m in modules():
        build_module(m)
    if RENDER:
        render_preview()


main()
