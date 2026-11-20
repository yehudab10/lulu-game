"""
Airport assets (feature id: airport) — ✈️ JFK, stage 1: the outside of the airport.

Static pieces are MERGED by the game into a few vertex-coloured meshes (features/town/kit.js), so: few
triangles, plain materials, names that say what glows — "ShopWindow" / "Window" (lit windows at night),
"LampGlow" / "Neon*" (always a little lit), "Glass" (see-through). Front = -Y (= +Z in three.js). Metres.
Parody only: every airline / logo / shop is made up; the game lays all text on the anchors from its atlas.

  airport_facade     Terminal 4½ (the OUTSIDE; stage 2's hall is airport_terminal): a 190 m glass hall with a swooping roof that overhangs the kerb on a row of
                     columns, six sets of doors, a sign band; Anchor_sign (JFK · TERMINAL 4½), Anchor_dep /
                     Anchor_arr (the DEPARTURES / ARRIVALS boards), Anchor_door0..5 (the doors, at the kerb).
                     Origin = the middle of the front wall at the ground; the hall runs back to +Y 35.
  airport_tower      the control tower (≈ 44 m): a base block, a tapering shaft, a glass cab, a red beacon.
  airport_jetbridge  a gate's jet bridge: a rotunda at the origin, the tube reaching -Y 16 m on two legs.
  airport_plane      a cartoon jet (32 m): fuselage "Paint", tail fin "Tail", a cheat line "Stripe", wings,
                     two engines; the landing gear is its own material "Gear" (the game hides it in the air).
                     Anchor_name (the airline's name on the fuselage, left side), Anchor_tail (the logo).
  airport_taxi       a yellow cab with a lit roof sign ("NeonTaxi") and a checker band.
  airport_shuttle    the parking shuttle bus ("Paint" + a "Stripe" band, big windows); Anchor_sign (its side).
  airport_booth      the parking lot's pay booth with a striped barrier arm; Anchor_sign.
  airport_segway     airport security's Segway (two wheels, a deck, a handlebar with a little flag).
  airport_guard      Officer Segal of airport security (a person: cap, vest, badge, mustache).
  airport_windsock   an orange-and-white windsock on a pole (the airside's corner).
  airport_suitcase   a rolling suitcase (travellers at the kerb pull these).
"""
import math
from lib import *
from lib_people import build_person


def setup():
    global S, CONC, STEEL, DARK, WHITE
    S = shared()
    CONC = mat("Concrete", "#C9C3B8", rough=0.95)
    STEEL = mat("Steel", "#9EA7AE", rough=0.45, metal=0.6)
    DARK = S.DARK
    WHITE = S.WHITE


def arch_profile(half_d, rise, n=10, z0=0.0, thick=0.8):
    """A thick arch (YZ profile) for bm_prism: from y=-half_d to +half_d, rising `rise` in the middle."""
    top, bot = [], []
    for i in range(n + 1):
        t = i / n
        y = -half_d + 2 * half_d * t
        z = z0 + rise * math.sin(math.pi * t)
        top.append((y, z + thick))
        bot.append((y, z))
    return top + list(reversed(bot))


# ── the terminal ─────────────────────────────────────────────────────────
def build_terminal():
    coll = scene_coll("AirportTerminal")
    root = root_empty(coll, "AirportTerminal")
    WALL = mat("Walls", "#E9E6DF", rough=0.85)
    ROOF = mat("Roof", "#D6DCE2", rough=0.5, metal=0.3)
    TRIM = mat("Trim", "#5E7D95", rough=0.5, metal=0.2)
    WIN = mat("ShopWindow", "#8FCBEA", rough=0.1, emit=0.25)
    DOOR = mat("Door", "#37505F", rough=0.3)
    BAND = mat("SignBand", "#16324F", rough=0.5)
    BOARD = mat("BoardBlue", "#1E5AA8", rough=0.5)
    W, D, H = 190.0, 35.0, 12.0
    hw = W / 2
    parts = [Part(coll, "hall", bm_box(W, D, H), WALL, loc=(0, D / 2, H / 2), smooth=False),
             Part(coll, "plinth", bm_box(W + 0.4, D + 0.4, 0.6), CONC, loc=(0, D / 2, 0.3), smooth=False)]
    # the swooping roof: an arch along X from the kerb canopy (y -8) to the back (y 36)
    roof_half = (D + 9.0) / 2
    prof = [(y + (D - 9.0) / 2 + 0.5, z) for (y, z) in arch_profile(roof_half, 3.2, n=12, z0=H + 0.2, thick=0.9)]
    parts.append(Part(coll, "roof", bm_prism(prof, hw + 3.0), ROOF, smooth=False))
    # the roof's gable ends (a flat fill under the arch at each end)
    for x in (-hw - 2.9, hw + 2.9):
        parts.append(Part(coll, "roofEnd", bm_box(0.3, D + 8.5, 1.6), TRIM, loc=(x, (D - 8.0) / 2, H + 1.0), smooth=False))
    # the canopy's columns along the kerb (the game puts colliders at the same x, y = -6.8)
    for k in range(13):
        x = -hw + 5 + k * (W - 10) / 12
        parts.append(Part(coll, "col", bm_cyl(0.32, 0.38, H + 1.6, 10), STEEL, loc=(x, -6.8, (H + 1.6) / 2), smooth=False))
    # the glass front: panes + mullions, two storeys
    fy = -0.08
    n = 38
    for k in range(n):
        x = -hw + (k + 0.5) * W / n
        parts.append(Part(coll, "pane", bm_box(W / n - 0.35, 0.1, 4.0), WIN, loc=(x, fy, 6.6), smooth=False))
        parts.append(Part(coll, "pane2", bm_box(W / n - 0.35, 0.1, 2.6), WIN, loc=(x, fy, 10.0), smooth=False))
    for k in range(n + 1):
        x = -hw + k * W / n
        parts.append(Part(coll, "mull", bm_box(0.28, 0.22, H - 0.6), TRIM, loc=(x, fy - 0.06, H / 2 + 0.3), smooth=False))
    parts.append(Part(coll, "floorBand", bm_box(W, 0.24, 0.5), TRIM, loc=(0, fy - 0.06, 8.6), smooth=False))
    # six sets of doors at street level (lit glass panes either side)
    doors = [-75, -45, -15, 15, 45, 75]
    for i, x in enumerate(doors):
        parts.append(Part(coll, "door%d" % i, bm_box(5.2, 0.14, 3.1), DOOR, loc=(x, fy - 0.03, 1.55), smooth=False))
        parts.append(Part(coll, "doorFrame%d" % i, bm_box(6.0, 0.26, 0.35), TRIM, loc=(x, fy - 0.08, 3.25), smooth=False))
        parts.append(Part(coll, "doorMat%d" % i, bm_box(5.6, 2.0, 0.04), DARK, loc=(x, -1.0, 0.02), smooth=False))
    for k in range(n):
        x = -hw + (k + 0.5) * W / n
        if min(abs(x - d) for d in doors) < 3.8:
            continue
        parts.append(Part(coll, "paneLow", bm_box(W / n - 0.35, 0.1, 3.4), WIN, loc=(x, fy, 2.2), smooth=False))
    # the sign band over the middle doors + the two big boards (the game lays the text on the anchors)
    parts.append(Part(coll, "band", bm_box(70.0, 0.4, 2.6), BAND, loc=(0, -0.35, H - 0.2), smooth=False))
    for x in (-60.0, 60.0):
        parts.append(Part(coll, "board", bm_box(22.0, 0.3, 2.2), BOARD, loc=(x, -0.3, 4.6), smooth=False))
    # rooftop units + a flag pole on the roof's crown
    for x in (-60, -20, 25, 70):
        parts.append(Part(coll, "hvac", bm_box(5.0, 3.0, 1.4), STEEL, loc=(x, 22.0, H + 3.4), smooth=False))
    # the airside (back) wall: gate windows
    for k in range(12):
        x = -hw + 8 + k * (W - 16) / 11
        parts.append(Part(coll, "gateWin", bm_box(9.0, 0.1, 3.2), WIN, loc=(x, D + 0.08, 6.0), smooth=False))
    # end walls: a strip of windows
    for x in (-hw - 0.08, hw + 0.08):
        parts.append(Part(coll, "endWin", bm_box(0.1, D - 6, 2.6), WIN, loc=(x, D / 2, 7.0), smooth=False))
    # planters + benches + bins along the kerb sidewalk (between the columns)
    PLANT = mat("Hedge", "#3E8E41", rough=0.9)
    for k in range(8):
        x = -hw + 17 + k * (W - 34) / 7
        if min(abs(x - d) for d in doors) < 6:
            x += 7
        parts.append(Part(coll, "planter", bm_box(3.0, 1.0, 0.55), CONC, loc=(x, -3.6, 0.28), smooth=False))
        parts.append(Part(coll, "hedge", bm_box(2.7, 0.8, 0.5), PLANT, loc=(x, -3.6, 0.8), smooth=False))
    bake(parts, "AirportTerminal_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, -0.6, H - 0.2))
    anchor(coll, root, "Anchor_dep", (-60.0, -0.5, 4.6))
    anchor(coll, root, "Anchor_arr", (60.0, -0.5, 4.6))
    for i, x in enumerate(doors):
        anchor(coll, root, "Anchor_door%d" % i, (x, -0.3, 1.55))
    return coll


# ── the control tower ────────────────────────────────────────────────────
def build_tower():
    coll = scene_coll("AirportTower")
    root = root_empty(coll, "AirportTower")
    WALL = mat("Walls", "#ECE7DC", rough=0.85)
    TRIM = mat("Trim", "#5E7D95", rough=0.5, metal=0.2)
    CAB = mat("Window", "#7FC4E8", rough=0.08, emit=0.3)
    RED = mat("NeonRed", "#FF2A2A", rough=0.3, emit=2.5)
    parts = [Part(coll, "base", bm_box(12, 10, 6), WALL, loc=(0, 0, 3), smooth=False),
             Part(coll, "baseWin", bm_box(10, 0.1, 1.6), CAB, loc=(0, -5.05, 3.6), smooth=False),
             Part(coll, "shaft", bm_cyl(2.0, 2.8, 32, 12), WALL, loc=(0, 0, 6 + 16), smooth=False),
             Part(coll, "shaftBand", bm_cyl(3.0, 3.0, 0.6, 12), TRIM, loc=(0, 0, 20), smooth=False),
             Part(coll, "deck", bm_cyl(5.2, 3.0, 2.0, 12), TRIM, loc=(0, 0, 38.8), smooth=False),
             Part(coll, "cab", bm_cyl(5.0, 5.6, 4.2, 12), CAB, loc=(0, 0, 41.9), smooth=False),
             Part(coll, "cabRoof", bm_cyl(6.0, 5.4, 0.8, 12), TRIM, loc=(0, 0, 44.4), smooth=False),
             Part(coll, "mast", bm_cyl(0.12, 0.18, 6.0, 6), STEEL, loc=(0, 0, 47.8), smooth=False),
             Part(coll, "beacon", bm_sphere(0.45, 0.45, 0.45, 8, 6), RED, loc=(0, 0, 51.0)),
             Part(coll, "radar", bm_box(3.2, 0.4, 0.6), STEEL, loc=(2.2, 0, 46.2), smooth=False)]
    for a in range(12):
        ang = a * math.pi / 6
        parts.append(Part(coll, "mullion", bm_box(0.18, 0.18, 4.2), TRIM, loc=(5.25 * math.cos(ang), 5.25 * math.sin(ang), 41.9), smooth=False))
    bake(parts, "AirportTower_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, -5.2, 4.6))
    return coll


# ── a jet bridge ─────────────────────────────────────────────────────────
def build_jetbridge():
    coll = scene_coll("AirportJetbridge")
    root = root_empty(coll, "AirportJetbridge")
    WALL = mat("Walls", "#D9DEE3", rough=0.6, metal=0.2)
    WIN = mat("ShopWindow", "#8FCBEA", rough=0.1, emit=0.2)
    parts = [Part(coll, "rotunda", bm_cyl(2.6, 2.6, 3.4, 12), WALL, loc=(0, 0, 5.6), smooth=False),
             Part(coll, "rotPost", bm_cyl(0.8, 0.9, 4.0, 10), STEEL, loc=(0, 0, 2.0), smooth=False),
             Part(coll, "tube", bm_box(3.0, 16.0, 2.9), WALL, loc=(0, -9.6, 5.7), smooth=False),
             Part(coll, "tubeWin", bm_box(3.06, 13.0, 0.6), WIN, loc=(0, -9.6, 6.3), smooth=False),
             Part(coll, "cab", bm_box(4.0, 2.6, 3.2), WALL, loc=(0, -18.6, 5.7), smooth=False),
             Part(coll, "hood", bm_box(3.4, 1.0, 2.6), DARK, loc=(0, -20.2, 5.7), smooth=False)]
    for y in (-12.0, -17.0):
        parts.append(Part(coll, "leg", bm_box(0.45, 0.45, 4.2), STEEL, loc=(0, y, 2.1), smooth=False))
        parts.append(Part(coll, "legFoot", bm_box(2.4, 0.9, 0.5), DARK, loc=(0, y, 0.25), smooth=False))
    bake(parts, "AirportJetbridge_body", coll, parent=root)
    return coll


# ── the plane ────────────────────────────────────────────────────────────
def build_plane():
    coll = scene_coll("AirportPlane")
    root = root_empty(coll, "AirportPlane")
    PAINT = mat("Paint", "#FAFAFA", rough=0.4)
    TAIL = mat("Tail", "#E53935", rough=0.4)
    STRIPE = mat("Stripe", "#1E5AA8", rough=0.4)
    WING = mat("Wing", "#B8C1C8", rough=0.45, metal=0.3)
    ENG = mat("Engine", "#9AA3AA", rough=0.35, metal=0.5)
    WINS = mat("PlaneWindows", "#26323A", rough=0.2)
    GEAR = mat("Gear", "#3A3F44", rough=0.6)
    L, R = 30.0, 1.9
    z0 = 3.4     # fuselage centre height (on its wheels)
    body = [Part(coll, "fuse", bm_cyl(R, R, L, 10, axis="Y"), PAINT, loc=(0, 0, z0)),
            Part(coll, "nose", bm_sphere(R, 4.2, R, 10, 6), PAINT, loc=(0, -L / 2, z0)),
            Part(coll, "tailcone", bm_cyl(R, 0.55, 7.0, 10, axis="Y"), PAINT, loc=(0, L / 2 + 3.5, z0 + 0.9), rot=(-0.24, 0, 0)),
            Part(coll, "stripe", bm_box(2 * R + 0.06, L - 2, 0.32), STRIPE, loc=(0, 0, z0 - 0.35), smooth=False)]
    # windows: a dark band each side + the cockpit
    for x in (-R - 0.02, R + 0.02):
        body.append(Part(coll, "wins", bm_box(0.08, L - 7.0, 0.42), WINS, loc=(x, 0.6, z0 + 0.55), smooth=False))
    body.append(Part(coll, "cockpit", bm_box(2.6, 1.0, 0.55), WINS, loc=(0, -L / 2 - 1.9, z0 + 0.85), rot=(0.5, 0, 0), smooth=False))
    # the fin (Tail) + the stabilisers
    fin = [(0, 0), (6.0, 0), (7.6, 6.4), (5.2, 6.4)]
    body.append(Part(coll, "fin", bm_prism([(L / 2 - 1.5 + y, z0 + 1.2 + z) for (y, z) in fin], 0.22), TAIL, smooth=False))
    for sx in (-1, 1):
        body.append(Part(coll, "stab", bm_box(5.8, 2.4, 0.22), WING, loc=(sx * 3.4, L / 2 + 4.6, z0 + 1.3), rot=(0, 0, sx * -0.35), smooth=False))
    # wings: a swept slab each side + the engines under them
    for sx in (-1, 1):
        body.append(Part(coll, "wing", bm_box(13.5, 4.6, 0.38), WING, loc=(sx * 8.2, 1.6, z0 - 0.9), rot=(0, sx * -0.05, sx * -0.32), smooth=False))
        body.append(Part(coll, "winglet", bm_box(0.25, 1.8, 1.8), TAIL, loc=(sx * 14.9, 4.4, z0 - 0.0), rot=(0, sx * 0.2, 0), smooth=False))
        body.append(Part(coll, "engine", bm_cyl(1.05, 0.9, 4.0, 10, axis="Y"), ENG, loc=(sx * 5.6, -1.4, z0 - 2.0)))
        body.append(Part(coll, "intake", bm_cyl(0.85, 0.85, 0.2, 10, axis="Y"), DARK, loc=(sx * 5.6, -3.45, z0 - 2.0)))
        body.append(Part(coll, "pylon", bm_box(0.3, 2.6, 0.9), WING, loc=(sx * 5.6, -0.8, z0 - 1.3), smooth=False))
    bake(body, "AirportPlane_body", coll, parent=root)
    gear = [Part(coll, "noseLeg", bm_cyl(0.12, 0.12, 2.0, 6), GEAR, loc=(0, -L / 2 + 2.0, 1.5), smooth=False),
            Part(coll, "noseWheel", bm_cyl(0.45, 0.45, 0.5, 10, axis="X"), GEAR, loc=(0, -L / 2 + 2.0, 0.45))]
    for sx in (-1, 1):
        gear.append(Part(coll, "mainLeg", bm_cyl(0.16, 0.16, 2.4, 6), GEAR, loc=(sx * 2.6, 1.8, 1.6), smooth=False))
        gear.append(Part(coll, "mainWheel", bm_cyl(0.6, 0.6, 1.0, 10, axis="X"), GEAR, loc=(sx * 2.6, 1.8, 0.6)))
    bake(gear, "AirportPlane_gear", coll, parent=root)
    anchor(coll, root, "Anchor_name", (-R - 0.08, -2.0, z0 + 1.05))
    anchor(coll, root, "Anchor_nameR", (R + 0.08, -2.0, z0 + 1.05))
    anchor(coll, root, "Anchor_tail", (0.26, L / 2 + 4.0, z0 + 4.6))
    return coll


# ── the cab + the shuttle ────────────────────────────────────────────────
def build_taxi():
    coll = scene_coll("AirportTaxi")
    root = root_empty(coll, "AirportTaxi")
    PAINT = mat("Paint", "#FFC107", rough=0.35)
    CHECK = mat("Checker", "#1B1B1B", rough=0.5)
    SIGN = mat("NeonTaxi", "#FFF3B0", rough=0.3, emit=1.2)
    parts = [Part(coll, "body", bm_box(1.9, 4.7, 0.75), PAINT, loc=(0, 0, 0.7)).bevel(0.12, 2),
             Part(coll, "cabin", bm_box(1.7, 2.5, 0.65), PAINT, loc=(0, 0.25, 1.38)).bevel(0.15, 2),
             Part(coll, "glassF", bm_box(1.6, 0.08, 0.5), S.GLASS, loc=(0, -1.0, 1.4), rot=(0.45, 0, 0), smooth=False),
             Part(coll, "glassB", bm_box(1.6, 0.08, 0.45), S.GLASS, loc=(0, 1.48, 1.4), rot=(-0.45, 0, 0), smooth=False),
             Part(coll, "check", bm_box(1.94, 3.4, 0.14), CHECK, loc=(0, 0.1, 0.86), smooth=False),
             Part(coll, "roofSign", bm_box(0.9, 0.35, 0.3), SIGN, loc=(0, 0.2, 1.85), smooth=False),
             Part(coll, "bumperF", bm_box(1.9, 0.15, 0.22), S.CHROME, loc=(0, -2.38, 0.45), smooth=False),
             Part(coll, "bumperB", bm_box(1.9, 0.15, 0.22), S.CHROME, loc=(0, 2.38, 0.45), smooth=False)]
    for x in (-0.65, 0.65):
        parts.append(Part(coll, "head", bm_box(0.4, 0.06, 0.18), S.HEAD, loc=(x, -2.36, 0.78), smooth=False))
        parts.append(Part(coll, "tail", bm_box(0.4, 0.06, 0.18), S.TAIL, loc=(x, 2.36, 0.78), smooth=False))
    for x in (-0.86, 0.86):
        parts.append(Part(coll, "side", bm_box(0.06, 2.3, 0.45), S.GLASS, loc=(x, 0.25, 1.42), smooth=False))
    bake(parts, "AirportTaxi_body", coll, parent=root)
    four_wheels(coll, root, 1.62, -1.5, 1.5, 0.36, 0.26, S.TIRE, S.RIM, S.DARK)
    return coll


def build_shuttle():
    coll = scene_coll("AirportShuttle")
    root = root_empty(coll, "AirportShuttle")
    PAINT = mat("Paint", "#F5F5F5", rough=0.4)
    STRIPE = mat("Stripe", "#1E5AA8", rough=0.4)
    parts = [Part(coll, "body", bm_box(2.5, 9.2, 2.6), PAINT, loc=(0, 0, 1.75)).bevel(0.18, 2),
             Part(coll, "stripe", bm_box(2.54, 9.0, 0.45), STRIPE, loc=(0, 0, 1.1), smooth=False),
             Part(coll, "roofBox", bm_box(1.8, 3.0, 0.4), PAINT, loc=(0, 1.0, 3.2), smooth=False),
             Part(coll, "wind", bm_box(2.3, 0.08, 1.2), S.GLASS, loc=(0, -4.62, 2.2), smooth=False),
             Part(coll, "back", bm_box(2.0, 0.08, 0.8), S.GLASS, loc=(0, 4.62, 2.3), smooth=False),
             Part(coll, "door", bm_box(0.08, 1.1, 2.0), S.TINT, loc=(1.27, -3.4, 1.4), smooth=False)]
    for x in (-1.27, 1.27):
        parts.append(Part(coll, "wins", bm_box(0.08, 6.6 if x < 0 else 5.0, 1.0), S.GLASS, loc=(x, 0.6 if x < 0 else 1.4, 2.25), smooth=False))
        parts.append(Part(coll, "head", bm_box(0.45, 0.06, 0.22), S.HEAD, loc=(x * 0.75, -4.63, 0.85), smooth=False))
        parts.append(Part(coll, "tail", bm_box(0.4, 0.06, 0.25), S.TAIL, loc=(x * 0.8, 4.63, 0.9), smooth=False))
    bake(parts, "AirportShuttle_body", coll, parent=root)
    four_wheels(coll, root, 2.1, -3.0, 3.0, 0.5, 0.32, S.TIRE, S.RIM, S.DARK)
    anchor(coll, root, "Anchor_sign", (-1.32, 0.4, 1.75))
    return coll


# ── the parking booth ────────────────────────────────────────────────────
def build_booth():
    coll = scene_coll("AirportBooth")
    root = root_empty(coll, "AirportBooth")
    WALL = mat("Walls", "#EFEBE0", rough=0.8)
    ROOF = mat("Roof", "#1E5AA8", rough=0.5)
    WIN = mat("ShopWindow", "#8FCBEA", rough=0.1, emit=0.25)
    ARM = mat("ArmStripe", "#E53935", rough=0.5)
    parts = [Part(coll, "booth", bm_box(2.0, 2.4, 2.4), WALL, loc=(0, 0, 1.2), smooth=False),
             Part(coll, "roof", bm_box(2.6, 3.0, 0.3), ROOF, loc=(0, 0, 2.55), smooth=False),
             Part(coll, "win", bm_box(2.06, 1.8, 1.0), WIN, loc=(0, 0, 1.55), smooth=False),
             Part(coll, "island", bm_box(1.6, 5.0, 0.2), CONC, loc=(0, 0, 0.1), smooth=False),
             Part(coll, "armPost", bm_box(0.3, 0.3, 1.1), DARK, loc=(-1.3, -1.6, 0.55), smooth=False),
             Part(coll, "arm", bm_box(3.6, 0.12, 0.12), ARM, loc=(-3.1, -1.6, 1.05), smooth=False)]
    for k in range(4):
        parts.append(Part(coll, "armW", bm_box(0.4, 0.13, 0.13), WHITE, loc=(-1.8 - k * 0.9, -1.6, 1.05), smooth=False))
    bake(parts, "AirportBooth_body", coll, parent=root)
    anchor(coll, root, "Anchor_sign", (0, -1.52, 2.55))
    return coll


# ── security's Segway + Officer Segal ───────────────────────────────────
def build_segway():
    coll = scene_coll("AirportSegway")
    root = root_empty(coll, "AirportSegway")
    FLAG = mat("NeonFlag", "#FF7043", rough=0.4, emit=0.6)
    parts = [Part(coll, "deck", bm_box(0.62, 0.42, 0.12), DARK, loc=(0, 0, 0.2), smooth=False),
             Part(coll, "post", bm_cyl(0.035, 0.035, 1.0, 6), STEEL, loc=(0, -0.12, 0.72), rot=(0.12, 0, 0), smooth=False),
             Part(coll, "bar", bm_cyl(0.03, 0.03, 0.6, 6, axis="X"), DARK, loc=(0, -0.18, 1.22), smooth=False),
             Part(coll, "flagPole", bm_cyl(0.012, 0.012, 1.0, 4), STEEL, loc=(0.25, 0.15, 1.1), smooth=False),
             Part(coll, "flag", bm_box(0.02, 0.32, 0.2), FLAG, loc=(0.25, 0.3, 1.5), smooth=False)]
    for x in (-0.38, 0.38):
        parts.append(Part(coll, "wheel", bm_cyl(0.22, 0.22, 0.12, 12, axis="X"), S.TIRE, loc=(x, 0, 0.22)))
        parts.append(Part(coll, "hub", bm_cyl(0.1, 0.1, 0.14, 8, axis="X"), S.RIM, loc=(x, 0, 0.22)))
    bake(parts, "AirportSegway_body", coll, parent=root)
    return coll


def build_guard():
    return build_person("AirportGuard", dict(hair="short", hair_color="#5D4037", top="#2B4C7E", bottom="pants",
                                             bottom_color="#1F2A44", shoes="#111111", width=1.15,
                                             extras=["cap", "badge", "mustache", "vest", "belly"],
                                             extra_colors={"Cap": "#2B4C7E", "Vest": "#FFD54F"}))


# ── small things ─────────────────────────────────────────────────────────
def build_windsock():
    coll = scene_coll("AirportWindsock")
    root = root_empty(coll, "AirportWindsock")
    OR = mat("SockOrange", "#FF6D00", rough=0.6)
    parts = [Part(coll, "pole", bm_cyl(0.08, 0.1, 6.0, 8), STEEL, loc=(0, 0, 3.0), smooth=False),
             Part(coll, "ring", bm_torus(0.45, 0.05, 12, 4), STEEL, loc=(0, 0.3, 5.8), rot=(math.pi / 2, 0, 0))]
    for k in range(5):
        r = 0.45 - k * 0.06
        parts.append(Part(coll, "sock%d" % k, bm_cyl(r, r - 0.05, 0.6, 10, axis="Y"), OR if k % 2 == 0 else WHITE, loc=(0, 0.6 + k * 0.6, 5.8 - k * 0.12), smooth=False))
    bake(parts, "AirportWindsock_body", coll, parent=root)
    return coll


def build_suitcase():
    coll = scene_coll("AirportSuitcase")
    root = root_empty(coll, "AirportSuitcase")
    CASE = mat("Paint", "#7E57C2", rough=0.5)
    parts = [Part(coll, "case", bm_box(0.42, 0.24, 0.62), CASE, loc=(0, 0, 0.39)).bevel(0.04, 2),
             Part(coll, "handle", bm_box(0.3, 0.03, 0.5), DARK, loc=(0, 0.1, 0.92), smooth=False),
             Part(coll, "grip", bm_box(0.32, 0.05, 0.05), DARK, loc=(0, 0.1, 1.17), smooth=False)]
    for x in (-0.15, 0.15):
        parts.append(Part(coll, "wheel", bm_cyl(0.04, 0.04, 0.04, 8, axis="X"), S.TIRE, loc=(x, 0.08, 0.05)))
    bake(parts, "AirportSuitcase_body", coll, parent=root)
    return coll


ASSETS = [
    ("airport_facade", build_terminal),
    ("airport_tower", build_tower),
    ("airport_jetbridge", build_jetbridge),
    ("airport_plane", build_plane),
    ("airport_taxi", build_taxi),
    ("airport_shuttle", build_shuttle),
    ("airport_booth", build_booth),
    ("airport_segway", build_segway),
    ("airport_guard", build_guard),
    ("airport_windsock", build_windsock),
    ("airport_suitcase", build_suitcase),
]
