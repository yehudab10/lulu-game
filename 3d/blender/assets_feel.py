"""
Feel (feature "feel"): the swapped parts for the damage on Lulu's own car.

Conventions (see 3d/ARCHITECTURE.md): metres, FRONT = Blender -Y (= +Z in
three.js), Blender +X = the model's LEFT. Every file is prefixed feel_.

  feel_hubcap   the chrome hubcap that pops off at her last heart and rolls
                away down the road. A disc in the YZ plane (axle along X,
                face toward +X), origin at its centre, radius 0.21 m - the
                game rolls it on its edge, wobbles it and lays it flat.
  feel_barehub  what's left on the wheel: a dull steel hub with five lug nuts,
                same frame (face toward +X), radius 0.19 m. The game hides the
                wheel's Rim primitives and parents this to the wheel node, so
                it spins with the wheel.
"""
from lib import *


def setup():
    global S
    S = shared()


def build_hubcap():
    coll = scene_coll("FeelHubcap")
    root = root_empty(coll, "FeelHubcap")
    CHROME = S.CHROME
    DARK = mat("HubcapInk", "#5A6470", rough=0.4, metal=0.6)
    parts = [
        Part(coll, "disc", bm_cyl(0.21, 0.21, 0.035, 24, "X"), CHROME).bevel(0.012, 2),
        Part(coll, "dome", bm_sphere(0.04, 0.085, 0.085, 16, 8), CHROME, loc=(0.02, 0, 0)),
        Part(coll, "ring", bm_cyl(0.165, 0.165, 0.045, 24, "X"), DARK, loc=(0.002, 0, 0)),
        Part(coll, "face", bm_cyl(0.155, 0.155, 0.05, 24, "X"), CHROME, loc=(0.003, 0, 0)),
    ]
    # six raised spokes so you can SEE it roll
    for k in range(6):
        a = k * math.pi / 3
        parts.append(Part(coll, "spoke", bm_box(0.02, 0.11, 0.028), CHROME,
                          loc=(0.028, math.cos(a) * 0.11, math.sin(a) * 0.11), rot=(a, 0, 0)))
    bake(parts, "FeelHubcap_body", coll, parent=root)
    return coll


def build_barehub():
    coll = scene_coll("FeelBareHub")
    root = root_empty(coll, "FeelBareHub")
    STEEL = mat("HubSteel", "#4A4F55", rough=0.6, metal=0.5)
    NUT = mat("HubNut", "#9AA3AB", rough=0.35, metal=0.8)
    parts = [
        Part(coll, "plate", bm_cyl(0.19, 0.19, 0.03, 20, "X"), STEEL).bevel(0.008, 2),
        Part(coll, "boss", bm_cyl(0.06, 0.07, 0.05, 14, "X"), STEEL, loc=(0.03, 0, 0)),
    ]
    for k in range(5):
        a = k * 2 * math.pi / 5
        parts.append(Part(coll, "nut", bm_cyl(0.018, 0.018, 0.04, 6, "X"), NUT,
                          loc=(0.03, math.cos(a) * 0.105, math.sin(a) * 0.105)))
    bake(parts, "FeelBareHub_body", coll, parent=root)
    return coll


ASSETS = [
    ("feel_hubcap", build_hubcap),
    ("feel_barehub", build_barehub),
]
