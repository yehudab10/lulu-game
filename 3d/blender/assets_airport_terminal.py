"""
The JFK TERMINAL (features/airport, stage 2 of roadmap 12): ONE walk-in hall on the interiors
engine (Spot_ / Col_ / Light_ / Fx_ anchors, see features/interiors/engine.js). Cartoon only —
parody airlines, a security line that is one long silly gag, nothing about real procedures.

    airport_terminal        the hall, left (landside, the kerb doors) to right (airside, the gate):
                            the terminal doors · three check-in desks (KUGEL AIR, EL OY, SHMEAR JET)
                            + a bag scale · the departures board's frame (the board itself is a JS
                            canvas) · the ARRIVALS doors (two sliding panels: ArrDoor_L / ArrDoor_R)
                            + the greeters' rail + an empty VIP red carpet (stage 3: Dovid Dov) ·
                            the security snake (belts), the silly scanner arch (ScanLamp_red /
                            ScanLamp_green), the tray belt, the glass divider with a one-way EXIT
                            lane · the food court (Shmuley's deli, the H2-OY! water bar, tables) ·
                            the gate (GATE 18, rows of seats, the desk) with a big window onto
                            the apron: a parked plane's jet bridge, the runway, the fence, the tower.
    airport_terminal_props  Prop_Suitcase (ONE white material: the crowd tints each instance),
                            Prop_BigBag (Bubbe's), Prop_Kugel, Prop_Knish, Prop_Pastrami,
                            Prop_Pickle, Prop_Water, Prop_Keys, Prop_Tray, Prop_Segway,
                            Prop_Plane (Livery is recoloured per airline; ~1.1k triangles).

Coordinates: three.js x = Blender x, three.js z = −Blender y (the open dollhouse front faces the
camera at three.js +z). The helper T(x, z) takes three.js coordinates.
"""
from lib import *
from assets_interiors import SetBuilder, bm_text_lo

W, D, H = 56.0, 14.0, 6.5          # the hall: x ±28, z ±7 (three.js), walls 6.5 m
X0, X1 = -W / 2, W / 2
WIN0 = 19.5                        # the gate window: x 19.5 … 28 on the back wall
DIVX = 12.0                        # the security divider (landside < 12 < airside)


def T(x, z):
    """three.js (x, z) → Blender (x, y)."""
    return x, -z


class TB(SetBuilder):
    """SetBuilder in three.js floor coordinates: box(sx, sz, sy_height, m, x, z, y)."""

    def b(self, sx, sz, h, m, x, z, y, rot=(0, 0, 0), bevel=None):
        bx, by = T(x, z)
        return self.box(sx, sz, h, m, bx, by, y, rot=rot, bevel=bevel)

    def c(self, r1, r2, h, m, x, z, y, segs=12, smooth=True):
        bx, by = T(x, z)
        return self.cyl(r1, r2, h, m, bx, by, y, segs=segs, smooth=smooth)

    def s(self, r, m, x, z, y, u=10, v=6):
        bx, by = T(x, z)
        return self.sph(r, m, bx, by, y, u=u, v=v)

    def t(self, body, size, m, x, z, y, face="-Y"):
        bx, by = T(x, z)
        return self.text(body, size, m, bx, by, y, face=face, extrude=0.012)

    def sp(self, name, x, z, ry=0.0, y=0.0):
        bx, by = T(x, z)
        return self.spot(name, bx, by, ry, y)

    def co(self, name, x, z, hx, hz, hy=1.2):
        bx, by = T(x, z)
        return self.col(name, bx, by, hx, hz, hy)

    def li(self, name, x, z, y):
        bx, by = T(x, z)
        return self.light(name, bx, by, y)

    def f(self, name, x, z, y, ry=0.0):
        bx, by = T(x, z)
        return self.fx(name, bx, by, y, ry)


def build_terminal():
    S = TB("AirportTerminal")
    FLOOR = mat("ATFloor", "#ECE8E1", 0.3)
    STRIPE = mat("ATStripe", "#9FB3C8", 0.35)
    WALL = mat("ATWall", "#DDE6EE", 0.85)
    CAP = mat("ATDark", "#3A4652", 0.6)
    METAL = mat("ATMetal", "#B8C2CC", 0.3, 0.6)
    DARK = mat("ATDark", "#3A4652", 0.6)
    GLASS = mat("Glass", "#BFE6F7", 0.05)
    BELT = mat("ATBelt", "#283593", 0.6)
    COUNTER = mat("ATCounter", "#F7F7F2", 0.45)
    WOOD = mat("ATWood", "#A0714F", 0.55)
    KUGEL = mat("NeonKugel", "#FFC107", 0.4, emit=1.2)
    ELOY = mat("NeonEloy", "#29B6F6", 0.4, emit=1.2)
    SHMEAR = mat("NeonShmear", "#FF7043", 0.4, emit=1.2)
    TXT = mat("NeonText", "#FFFFFF", 0.4, emit=1.6)
    INK = mat("ATInk", "#263238", 0.6)
    RED = mat("NeonScanRed", "#FF3D3D", 0.3, emit=2.2)
    GREEN = mat("NeonScanGreen", "#4CFF8A", 0.3, emit=2.2)
    CARPET = mat("ATCarpet", "#C62828", 0.9)
    GOLD = mat("ATGold", "#D4AF37", 0.3, 0.8)
    SEAT = mat("ATSeat", "#1E88E5", 0.6)
    FROST = mat("ATCounter", "#F7F7F2", 0.45)
    DELI = mat("ATDeli", "#2E7D32", 0.6)
    PLANT = mat("ATPlant", "#43A047", 0.85)
    POT = mat("ATPot", "#8D6E63", 0.8)
    PANEL = mat("NeonTube", "#FFF8E7", 0.5, emit=2.0)
    TARMAC = mat("ATTarmac", "#8E9AA3", 0.95)
    ASPHALT = mat("ATDark", "#3A4652", 0.6)
    PAINT = mat("ATCounter", "#F7F7F2", 0.45)
    GRASS = mat("ATGrass", "#7CB342", 0.95)
    BRIDGE = mat("ATWall", "#DDE6EE", 0.85)

    # ── the shell: floor, walls (the back wall has the gate window), a dark cap, the front lip ──
    S.b(W, D, 0.12, FLOOR, 0, 0, -0.06)
    for z in (-3.5, 0.0, 3.5):                                   # terrazzo bands along the hall
        S.b(W - 0.2, 0.12, 0.008, STRIPE, 0, z, 0.004)
    S.b(WIN0 - X0 + 0.3, 0.3, H, WALL, (X0 + WIN0) / 2 - 0.15, -D / 2 - 0.15, H / 2)
    S.b(0.3, D, H, WALL, X0 - 0.15, 0, H / 2)
    S.b(0.3, D, H, WALL, X1 + 0.15, 0, H / 2)
    S.b(W + 0.7, 0.4, 0.1, CAP, 0, -D / 2 - 0.15, H + 0.05)
    S.b(0.4, D + 0.1, 0.1, CAP, X0 - 0.15, 0, H + 0.05)
    S.b(0.4, D + 0.1, 0.1, CAP, X1 + 0.15, 0, H + 0.05)
    S.b(W + 0.6, 0.3, 0.5, CAP, 0, D / 2 + 0.15, -0.25)
    # a clerestory of sky-blue glass along the top of the back wall (landside + security + food court)
    SKYG = mat("ATSkyGlass", "#BFE6FF", 0.2, emit=0.35)
    for xa, xb in ((X0 + 0.2, -12.0), (-4.0, WIN0 - 0.2)):
        S.b(xb - xa, 0.06, 0.6, SKYG, (xa + xb) / 2, -6.83, 6.1)
        k = xa + 1.5
        while k < xb - 0.5:
            S.b(0.16, 0.1, 0.65, DARK, k, -6.8, 6.1)
            k += 3.0
    # pilasters on the back wall + a blue carpet at the gate
    for px in (-25.0, -11.0, 0.5, 6.0, 17.6):
        S.b(0.7, 0.3, H - 1.0, STRIPE, px, -6.85, (H - 1.0) / 2)
    S.b(X1 - WIN0 - 0.2, 12.6, 0.012, mat("ATGateCarpet", "#3F51B5", 0.95), (WIN0 + X1) / 2, 0.0, 0.006)
    # hanging wayfinding signs (high, at the back: never between her and the camera)
    WAY = mat("ATWaySign", "#FFD54F", 0.5)
    for x, txt in ((-14.0, "CHECK-IN"), (-2.0, "BAGGAGE CLAIM"), (3.0, "GATES 1-26 >>"), (24.0, "GATE 18")):
        S.b(3.4, 0.12, 0.6, WAY, x, -5.6, 5.3)
        S.t(txt, 0.26, INK, x, -5.53, 5.3)
        for s_ in (-1, 1):
            S.c(0.02, 0.02, 1.0, METAL, x + s_ * 1.4, -5.6, 6.1, segs=4)
    # skylight tubes (lights follow her in JS; these are just the look)
    for k, x in enumerate((-20, -6, 6, 20)):
        S.b(4.0, 0.3, 0.08, PANEL, x, -6.75, H - 0.5)
        S.li("tube%d" % k, x, -3.0, H - 1.2)

    # ── 1. THE TERMINAL DOORS (left wall): sliding glass + the sign over them ──
    dz = 2.5
    S.b(0.2, 3.6, 0.25, DARK, X0 + 0.05, dz, 3.0)
    for s in (-1, 1):
        S.b(0.12, 1.5, 2.8, GLASS, X0 + 0.08, dz + s * 0.8, 1.4)
        S.b(0.16, 0.1, 2.9, METAL, X0 + 0.08, dz + s * 1.6, 1.45)
    S.b(0.1, 4.6, 0.7, DARK, X0 + 0.07, dz, 3.7)
    S.t("TERMINAL 4½", 0.36, TXT, X0 + 0.14, dz, 3.72, "+X")
    S.sp("door", X0 + 1.0, dz, math.pi / 2)
    S.sp("lulu", X0 + 2.6, dz, math.pi / 2)
    S.sp("cops", X0 + 1.4, dz, math.pi / 2)
    S.t("WELCOME TO JFK", 0.5, INK, -20.0, -6.82, 5.2)

    # ── 2. CHECK-IN: three desks on one island, each with its sign + a bag scale ──
    DESKS = (("kugel", -22.5, KUGEL, "KUGEL AIR", "WE'LL GET YOU THERE. EVENTUALLY."),
             ("eloy", -18.0, ELOY, "EL OY", "NON-STOP KVETCHING"),
             ("shmear", -13.5, SHMEAR, "SHMEAR JET", "SCHMEARED ACROSS THE SKY"))
    cz = -5.0
    S.b(12.8, 0.9, 1.05, COUNTER, -18.0, cz, 0.52, bevel=0.03)
    S.b(13.0, 1.05, 0.06, WOOD, -18.0, cz, 1.08)
    S.co("desks", -18.0, cz, 6.4, 0.5)
    S.b(13.0, 0.6, 0.35, DARK, -18.0, -6.55, 0.6)                # the bag belt behind the agents
    S.b(13.0, 0.5, 0.06, BELT, -18.0, -6.55, 0.8)
    for key, x, M, name, tag in DESKS:
        S.b(4.0, 0.12, 1.5, M, x, -6.8, 3.6)
        S.t(name, 0.5, INK, x, -6.72, 3.8)
        S.t(tag, 0.17, INK, x, -6.72, 3.18)
        S.b(0.6, 0.4, 0.04, DARK, x + 0.7, cz - 0.05, 1.33)       # a little monitor
        S.b(0.56, 0.06, 0.4, M, x + 0.7, cz - 0.05, 1.55)
        # the bag scale at the front-left of the desk
        S.b(0.95, 0.75, 0.16, METAL, x - 1.45, cz + 0.9, 0.08)
        S.b(0.1, 0.1, 0.9, DARK, x - 1.95, cz + 0.6, 0.45)
        S.sp(key, x, cz - 0.85, 0.0)                              # the agent
        S.sp(key + "Talk", x + 0.2, cz + 1.25, math.pi)           # Lulu
        # the rope line (stanchions + belts) in front of each desk
        for zz in (-3.0, -1.4):
            for s in (-1, 1):
                S.c(0.05, 0.05, 1.0, METAL, x + s * 0.9, zz, 0.5, segs=6)
                S.c(0.17, 0.17, 0.05, METAL, x + s * 0.9, zz, 0.025, segs=8)
        for s in (-1, 1):
            S.b(0.04, 1.6, 0.07, BELT, x + s * 0.9, -2.2, 0.92)
        S.co("line_" + key, x, -2.25, 0.95, 0.85, 1.0)
    S.sp("scale", -22.5 - 1.45, cz + 0.9, 0.0)
    S.sp("scaleTalk", -22.5 - 1.6, cz + 1.9, math.pi)
    S.f("scaleScreen", -22.5 - 1.95, cz + 0.6, 1.0)

    # ── 3. THE DEPARTURES BOARD: a frame on the back wall (the board itself is a JS canvas) ──
    bx = -8.0
    S.b(7.6, 0.2, 3.1, DARK, bx, -6.88, 4.45)
    S.b(7.8, 0.3, 0.12, METAL, bx, -6.8, 6.05)
    S.f("board", bx, -6.74, 4.45)
    S.sp("board", bx, -4.4, math.pi)
    for s in (-1, 1):                                             # a bench under it
        S.b(0.1, 0.4, 0.45, METAL, bx + s * 1.3, -6.2, 0.22)
    S.b(3.0, 0.55, 0.08, WOOD, bx, -6.2, 0.48)
    S.co("bench", bx, -6.2, 1.5, 0.35, 0.5)

    # ── 4. ARRIVALS: frosted sliding doors (movers), the rail, the greeters, the VIP carpet ──
    ax = -2.0
    S.b(3.6, 0.25, 3.1, DARK, ax, -6.9, 1.55)
    S.b(4.4, 0.2, 0.7, DARK, ax, -6.82, 3.5)
    S.t("ARRIVALS", 0.42, TXT, ax, -6.7, 3.55)
    S.t("INTERNATIONAL · DOMESTIC · BOCA", 0.16, INK, ax, -6.7, 2.95)

    def door_panel(sx):
        def fn():
            S.b(1.3, 0.08, 2.7, FROST, ax + sx * 0.66, -6.72, 1.35)
            S.b(1.3, 0.1, 0.08, METAL, ax + sx * 0.66, -6.72, 2.72)
        return fn
    S.mover("ArrDoor_L", door_panel(-1), T(ax - 0.66, -6.72) + (0.0,))
    S.mover("ArrDoor_R", door_panel(1), T(ax + 0.66, -6.72) + (0.0,))
    for x0, x1 in ((ax - 4.4, ax - 1.3), (ax + 1.3, ax + 3.2)):
        S.b(x1 - x0, 0.08, 0.08, METAL, (x0 + x1) / 2, -4.6, 1.0)
        for x in (x0, x1):
            S.c(0.04, 0.04, 1.0, METAL, x, -4.6, 0.5, segs=6)
    S.co("railL", ax - 2.85, -4.6, 1.55, 0.12, 1.0)
    S.co("railR", ax + 2.25, -4.6, 0.95, 0.12, 1.0)
    S.sp("arrivals", ax, -6.2, 0.0)
    S.sp("arrivalsTalk", ax, -3.6, math.pi)
    for k, x in enumerate((ax - 3.8, ax - 2.6, ax + 1.8, ax + 2.8)):
        S.sp("greeter%d" % k, x, -3.9, math.pi)
    # the empty VIP carpet (stage 3: a famous singer comes through here — ssh)
    vx = 3.0
    S.b(1.6, 3.0, 0.02, CARPET, vx, -5.2, 0.01)
    for s in (-1, 1):
        for zz in (-6.4, -4.0):
            S.c(0.05, 0.05, 1.0, GOLD, vx + s * 0.95, zz, 0.5, segs=6)
            S.s(0.08, GOLD, vx + s * 0.95, zz, 1.04)
        S.b(0.05, 2.4, 0.06, CARPET, vx + s * 0.95, -5.2, 0.85)
    S.b(1.2, 0.06, 0.5, DARK, vx, -3.9, 1.25)
    S.t("RESERVED · VIP", 0.13, GOLD, vx, -3.95, 1.25)
    S.co("vip", vx, -5.2, 1.0, 1.4, 1.0)
    S.sp("vip", vx, -5.2, 0.0)
    S.sp("vipTalk", vx, -3.2, math.pi)

    # ── 5. SECURITY: the snake, the scanner arch, the tray belt, the glass divider + one-way exit ──
    sx0, sx1 = 5.0, 11.4
    S.t("SECURITY", 0.5, INK, 8.4, -6.82, 5.25)
    S.b(3.6, 0.15, 1.1, DARK, 8.4, -6.88, 4.3)
    S.f("waitBoard", 8.4, -6.78, 4.3)
    lanes = (-1.2, -2.4, -3.6)
    seps = (-0.6, -1.8, -3.0, -4.2)
    for k, zz in enumerate(seps):
        if k == 0:
            xa, xb = sx0 + 0.7, sx1          # the front belt: the entrance is its left end
        elif k == len(seps) - 1:
            xa, xb = sx0, sx1 - 0.7          # the back belt: the snake's exit is its right end
        elif k % 2:
            xa, xb = sx0, sx1 - 0.9          # switchbacks
        else:
            xa, xb = sx0 + 0.9, sx1
        n = int((xb - xa) / 1.6) + 1
        for i in range(n + 1):
            x = xa + (xb - xa) * i / n
            S.c(0.045, 0.045, 1.0, METAL, x, zz, 0.5, segs=6)
            S.c(0.16, 0.16, 0.05, METAL, x, zz, 0.025, segs=8)
        S.b(xb - xa, 0.04, 0.07, BELT, (xa + xb) / 2, zz, 0.92)
    S.b(0.04, 3.6, 0.07, BELT, sx0, -2.4, 0.92)                   # the snake's left side (closed but the entrance)
    S.co("snake", (sx0 + DIVX - 0.2) / 2, -2.4, (DIVX - 0.2 - sx0) / 2, 1.85, 1.0)
    S.sp("lineStart", sx0 - 0.6, -1.2, math.pi / 2)
    S.sp("lineTalk", sx0 - 0.9, -1.2, math.pi / 2)
    for k, zz in enumerate(lanes):
        S.sp("lane%d" % k, sx0 + 0.4, zz, math.pi / 2)
    # the tray belt + the X-ray tunnel through the divider
    S.b(5.6, 0.7, 0.85, DARK, DIVX - 1.2, -5.2, 0.42)
    S.b(5.6, 0.62, 0.05, BELT, DIVX - 1.2, -5.2, 0.87)
    S.b(1.4, 0.9, 1.3, METAL, DIVX, -5.2, 1.4, bevel=0.05)
    S.b(1.0, 0.92, 0.5, INK, DIVX, -5.2, 1.08)
    S.co("trays", DIVX - 1.2, -5.2, 2.8, 0.42, 1.0)
    # the scanner arch (in the divider's gap at z -4.2 … -3.0)
    gz0, gz1 = -4.25, -2.95
    for zz in (gz0, gz1):
        S.b(0.45, 0.22, 2.5, METAL, DIVX, zz, 1.25, bevel=0.04)
    S.b(0.5, gz1 - gz0 + 0.22, 0.32, METAL, DIVX, (gz0 + gz1) / 2, 2.6, bevel=0.04)
    S.t("BEEP-O-MATIC 3000", 0.12, INK, DIVX + 0.26, (gz0 + gz1) / 2, 2.62, "+X")
    S.t("BEEP-O-MATIC 3000", 0.12, INK, DIVX - 0.26, (gz0 + gz1) / 2, 2.62, "-X")

    def lamp(M, dz_):
        def fn():
            S.s(0.12, M, DIVX, (gz0 + gz1) / 2 + dz_, 2.86)
        return fn
    S.mover("ScanLamp_red", lamp(RED, -0.25), T(DIVX, (gz0 + gz1) / 2 - 0.25) + (2.86,))
    S.mover("ScanLamp_green", lamp(GREEN, 0.25), T(DIVX, (gz0 + gz1) / 2 + 0.25) + (2.86,))
    S.sp("scanner", DIVX, (gz0 + gz1) / 2, math.pi / 2)
    S.sp("scanIn", DIVX - 0.8, (gz0 + gz1) / 2, math.pi / 2)
    S.sp("scanOut", DIVX + 1.2, (gz0 + gz1) / 2, math.pi / 2)
    # the glass divider: back segment, middle segment, front stub — the gap at z 4.4 … 5.8 is the EXIT lane
    ex0, ex1 = 4.4, 5.8
    for za, zb in ((-7.0, gz0 - 0.1), (gz1 + 0.1, ex0), (ex1, 7.0)):
        S.b(0.12, zb - za, 2.0, GLASS, DIVX, (za + zb) / 2, 1.05)
        S.b(0.2, zb - za, 0.1, METAL, DIVX, (za + zb) / 2, 2.08)
        S.b(0.2, zb - za, 0.1, METAL, DIVX, (za + zb) / 2, 0.05)
    S.co("divA", DIVX, (-7.0 + gz0) / 2, 0.15, (gz0 + 7.0) / 2)
    S.co("divB", DIVX, (gz1 + ex0) / 2, 0.15, (ex0 - gz1) / 2)
    S.co("divC", DIVX, (ex1 + 7.0) / 2, 0.15, (7.0 - ex1) / 2)
    S.co("exitGate", DIVX, (ex0 + ex1) / 2, 0.35, (ex1 - ex0) / 2)
    for zz in (ex0, ex1):
        S.c(0.06, 0.06, 2.3, METAL, DIVX, zz, 1.15, segs=8)
    S.b(0.1, ex1 - ex0 + 0.4, 0.5, DELI, DIVX, (ex0 + ex1) / 2, 2.55)
    S.t("EXIT · NO RE-ENTRY", 0.15, TXT, DIVX - 0.07, (ex0 + ex1) / 2, 2.55, "-X")
    S.t("EXIT · NO RE-ENTRY", 0.15, TXT, DIVX + 0.07, (ex0 + ex1) / 2, 2.55, "+X")
    S.sp("exitLane", DIVX + 1.0, (ex0 + ex1) / 2, -math.pi / 2)
    S.sp("exitWrong", DIVX - 1.0, (ex0 + ex1) / 2, math.pi / 2)
    S.sp("guard", DIVX + 2.2, -1.0, -math.pi / 2)
    S.sp("dog", DIVX + 1.6, -2.0, -math.pi / 2)

    # ── 6. THE FOOD COURT: Shmuley's deli + the H2-OY! water bar + tables ──
    dx = 15.2
    S.b(3.6, 1.0, 1.05, DELI, dx, -5.6, 0.52, bevel=0.03)
    S.b(3.8, 1.15, 0.06, WOOD, dx, -5.6, 1.08)
    S.b(3.4, 0.5, 0.45, GLASS, dx, -5.5, 1.33)
    for k in range(4):                                            # the knishes + pastrami in the case
        S.b(0.32, 0.22, 0.14, WOOD, dx - 1.2 + k * 0.8, -5.5, 1.18)
    S.b(4.0, 0.15, 1.2, DELI, dx, -6.82, 3.6)
    S.t("SHMULEY'S SKY-HIGH DELI", 0.3, TXT, dx, -6.72, 3.8)
    S.t("KOSHER · PRICES ALSO SKY-HIGH", 0.15, TXT, dx, -6.72, 3.32)
    S.co("deli", dx, -5.8, 1.9, 0.75)
    S.sp("deli", dx, -6.4, 0.0)
    S.sp("deliTalk", dx, -4.5, math.pi)
    wx = 20.0
    S.b(2.2, 1.0, 1.05, mat("ATWaterBar", "#0288D1", 0.4), wx, -5.6, 0.52, bevel=0.03)
    S.b(2.4, 1.15, 0.06, COUNTER, wx, -5.6, 1.08)
    for k in range(5):
        S.c(0.07, 0.07, 0.26, GLASS, wx - 0.8 + k * 0.4, -5.6, 1.24, segs=8)
    S.b(2.8, 0.15, 1.0, mat("ATWaterBar", "#0288D1", 0.4), wx, -6.82, 3.6)
    S.t("H2-OY!", 0.42, TXT, wx, -6.72, 3.72)
    S.t("BOTTLED AT SEA LEVEL", 0.12, TXT, wx, -6.72, 3.3)
    S.co("water", wx, -5.8, 1.2, 0.75)
    S.sp("water", wx, -6.4, 0.0)
    S.sp("waterTalk", wx, -4.5, math.pi)
    for k, (tx, tz) in enumerate(((14.6, -0.6), (17.4, -2.2), (17.6, 1.2))):
        S.c(0.55, 0.55, 0.05, COUNTER, tx, tz, 0.75, segs=14)
        S.c(0.05, 0.05, 0.75, METAL, tx, tz, 0.37, segs=6)
        S.c(0.3, 0.3, 0.03, METAL, tx, tz, 0.015, segs=10)
        S.co("table%d" % k, tx, tz, 0.5, 0.5, 0.8)
        for j, a in enumerate((0.0, math.pi)):
            ox, oz = math.sin(a) * 0.95, math.cos(a) * 0.95
            S.c(0.2, 0.2, 0.06, SEAT, tx + ox, tz + oz, 0.46, segs=10)
            S.c(0.04, 0.04, 0.45, METAL, tx + ox, tz + oz, 0.22, segs=6)
            S.sp("eat%d_%d" % (k, j), tx + ox, tz + oz, a + math.pi)
    S.sp("foodTalk", 16.0, 0.2, 0.0)

    # ── 7. THE GATE: the window onto the apron, rows of seats, the desk ──
    gw = X1 - WIN0
    S.b(gw, 0.3, 0.4, WALL, (WIN0 + X1) / 2, -D / 2 - 0.15, 0.2)
    S.b(gw, 0.3, 0.9, WALL, (WIN0 + X1) / 2, -D / 2 - 0.15, H - 0.45)
    S.b(gw, 0.12, H - 1.3, GLASS, (WIN0 + X1) / 2, -D / 2 - 0.1, 0.4 + (H - 1.3) / 2)
    n = int(gw / 2.1)
    for i in range(n + 1):
        S.b(0.14, 0.22, H - 1.3, DARK, WIN0 + gw * i / n, -D / 2 - 0.1, 0.4 + (H - 1.3) / 2)
    S.b(gw, 0.25, 0.14, DARK, (WIN0 + X1) / 2, -D / 2 - 0.05, 0.42)
    S.co("window", (WIN0 + X1) / 2, -D / 2 + 0.05, gw / 2, 0.3)
    S.b(0.2, 1.6, 0.7, DARK, X1 - 0.07, -1.0, 3.9)
    S.t("GATE 18", 0.42, TXT, X1 - 0.18, -1.0, 4.05, "-X")
    S.t("(CHAI!)", 0.18, TXT, X1 - 0.18, -1.0, 3.65, "-X")
    # the gate desk (podium) + its board (a JS canvas)
    gx, gz = 26.4, -3.2
    S.b(1.8, 0.8, 1.1, COUNTER, gx, gz, 0.55, bevel=0.03)
    S.b(1.9, 0.9, 0.06, DARK, gx, gz, 1.12)
    S.co("gateDesk", gx, gz, 0.95, 0.45)
    S.sp("gateAgent", gx, gz - 0.85, 0.0)
    S.sp("gateTalk", gx - 0.2, gz + 1.25, math.pi)
    S.b(0.1, 0.1, 2.4, DARK, gx + 1.3, gz - 0.2, 1.2)
    S.f("gateBoard", gx + 1.3, gz - 0.12, 2.6)
    # seats: three rows of six facing the window
    rows = (-1.2, 0.8, 2.8)
    for r, rz in enumerate(rows):
        x0 = 20.6
        S.b(6.6, 0.5, 0.08, METAL, x0 + 3.0, rz, 0.3)
        for i in range(6):
            x = x0 + i * 1.1 + 0.2
            S.b(0.9, 0.55, 0.1, SEAT, x, rz, 0.46)
            S.b(0.9, 0.1, 0.62, SEAT, x, rz + 0.3, 0.78)
            S.b(0.06, 0.5, 0.25, DARK, x + 0.52, rz, 0.62)
            S.sp("seat%d_%d" % (r, i), x, rz - 0.05, math.pi)
        for s in (0, 1):
            S.b(0.08, 0.4, 0.3, DARK, x0 + 0.2 + s * 5.5, rz, 0.15)
        S.co("row%d" % r, x0 + 3.0, rz + 0.05, 3.35, 0.4, 0.8)
    S.sp("window", 24.0, -6.0, math.pi)
    S.sp("sleeper", 20.8 + 1.65, 2.8, math.pi)
    # plants
    for px, pz in ((-26.8, -6.2), (-9.5, 5.8), (13.0, 6.2), (27.0, 6.0), (-26.8, 6.2)):
        S.c(0.32, 0.25, 0.55, POT, px, pz, 0.27, segs=10)
        S.s(0.55, PLANT, px, pz, 1.05, u=10, v=6)
        S.co("plant", px, pz, 0.35, 0.35, 1.0)
    S.sp("pa", -4.0, 0.0, 0.0, 5.2)

    # ── 8. OUTSIDE THE WINDOW: the apron, the jet bridge, the runway, the fence, the tower ──
    S.b(80, 90, 0.1, TARMAC, 24, -52, -0.2)
    S.b(80, 9, 0.02, ASPHALT, 24, -58, -0.14)                    # the runway
    for k in range(16):
        S.b(3.0, 0.4, 0.01, PAINT, -12 + k * 5.0, -58, -0.12)
    S.b(80, 6, 0.04, GRASS, 24, -66, -0.14)
    S.b(80, 6, 0.04, GRASS, 24, -50, -0.14)
    for k in range(9):                                            # yellow taxi line to the gate
        S.b(0.2, 1.5, 0.01, mat("ATWaySign", "#FFD54F", 0.5), 24.0, -10 - k * 2.2, -0.13)
    S.b(70, 0.08, 2.4, METAL, 24, -70, 1.0)   # the runway fence
    for k in range(15):
        S.c(0.06, 0.06, 2.6, METAL, -11 + k * 5.0, -70, 1.1, segs=6)
    S.b(70, 0.15, 0.08, METAL, 24, -70, 2.35)
    # the jet bridge from the window to where the parked plane's door is
    S.b(1.8, 7.0, 2.2, BRIDGE, 27.6, -10.8, 3.3)
    S.b(2.0, 0.4, 2.4, DARK, 27.6, -14.3, 3.3)
    S.c(0.22, 0.22, 3.0, METAL, 27.6, -13.0, 1.1, segs=8)
    S.f("parked", 21.0, -24.0, 0.0, 0.0)
    S.f("runway", 0.0, -58.0, 0.0, math.pi / 2)
    # the control tower (far off, to the left)
    S.c(1.6, 2.2, 16, WALL, -4.0, -82.0, 8.0, segs=10)
    S.c(4.2, 3.2, 3.0, mat("ATSkyGlass", "#BFE6FF", 0.2, emit=0.35), -4.0, -82.0, 17.6, segs=10)
    S.c(4.4, 4.4, 0.4, CAP, -4.0, -82.0, 19.3, segs=10)
    return S.finish()


def build_props():
    coll = scene_coll("AirportTerminalProps")
    root = root_empty(coll, "AirportTerminalProps")

    def prop(name):
        e = bpy.data.objects.new("Prop_" + name, None)
        coll.objects.link(e)
        e.parent = root
        return e

    def P(bm, m, loc, rot=(0, 0, 0), smooth=False):
        return Part(coll, "pp", bm, m, loc=loc, rot=rot, smooth=smooth)

    WHITE = mat("TSuitcase", "#FFFFFF", 0.55)
    DARK = mat("TPropDark", "#263238", 0.5)
    METAL = mat("TPropMetal", "#CFD8DC", 0.3, 0.7)
    FOIL = mat("TFoil", "#E0E0E0", 0.25, 0.8)
    KUGELM = mat("TKugel", "#E8B04B", 0.7)
    CRUST = mat("TKugelCrust", "#B36B1E", 0.75)
    FLORAL = mat("TBagFloral", "#EC407A", 0.75)
    FLOWER = mat("TBagFlower", "#FFF176", 0.7)
    STRAP = mat("TBagStrap", "#6D4C41", 0.7)
    BREAD = mat("TRye", "#A1662F", 0.8)
    MEAT = mat("TPastrami", "#C2185B", 0.7)
    PICKLE = mat("TPickle", "#689F38", 0.6)
    WATER = mat("Water_T", "#81D4FA", 0.1)
    CAPB = mat("TCap", "#0277BD", 0.5)
    KEY = mat("TKey", "#FFD54F", 0.3, 0.8)
    TRAY = mat("TTray", "#90A4AE", 0.6)
    SEG = mat("TSegway", "#212121", 0.5)
    SEGL = mat("TSegLight", "#FFEB3B", 0.3)
    LIV = mat("Livery", "#FFC107", 0.5)
    PW = mat("PlaneWhite", "#F5F7FA", 0.45)
    PG = mat("PlaneGrey", "#90A4AE", 0.5, 0.3)
    PWIN = mat("PlaneWindow", "#263238", 0.2)

    # a rolling suitcase: ONE material (the crowd tints each instance)
    o = prop("Suitcase")
    bake([P(bm_box(0.42, 0.24, 0.6), WHITE, (0, 0, 0.36)),
          P(bm_box(0.04, 0.03, 0.42), WHITE, (0.12, 0, 0.86)),
          P(bm_box(0.04, 0.03, 0.42), WHITE, (-0.12, 0, 0.86)),
          P(bm_box(0.28, 0.04, 0.04), WHITE, (0, 0, 1.07)),
          P(bm_cyl(0.04, 0.04, 0.04, 6, "X"), WHITE, (0.15, 0.08, 0.04)),
          P(bm_cyl(0.04, 0.04, 0.04, 6, "X"), WHITE, (-0.15, 0.08, 0.04))], "Suitcase_m", coll, parent=o)
    # Bubbe's bag: a giant floral duffel with a strap and polka-dot flowers
    o = prop("BigBag")
    parts = [P(bm_cyl(0.42, 0.42, 1.3, 12, "X"), FLORAL, (0, 0, 0.42), smooth=True),
             P(bm_box(1.2, 0.08, 0.06), STRAP, (0, 0, 0.86)),
             P(bm_torus(0.22, 0.03, 10, 4), STRAP, (0, 0, 0.98), rot=(math.pi / 2, 0, 0), smooth=True)]
    for k in range(7):
        a = k * 0.9
        parts.append(P(bm_sphere(0.07, 0.07, 0.07, 6, 4), FLOWER, (-0.5 + k * 0.17, -math.sin(a) * 0.42, 0.42 + math.cos(a) * 0.42)))
    bake(parts, "BigBag_m", coll, parent=o)
    # a kugel in a foil pan
    o = prop("Kugel")
    bake([P(bm_cyl(0.16, 0.13, 0.07, 10), FOIL, (0, 0, 0.035)),
          P(bm_cyl(0.145, 0.145, 0.05, 10), KUGELM, (0, 0, 0.07)),
          P(bm_cyl(0.13, 0.13, 0.012, 10), CRUST, (0, 0, 0.098))], "Kugel_m", coll, parent=o)
    o = prop("Knish")
    bake([P(bm_cyl(0.07, 0.07, 0.07, 8), CRUST, (0, 0, 0.0))], "Knish_m", coll, parent=o)
    o = prop("Pastrami")
    bake([P(bm_box(0.16, 0.12, 0.025), BREAD, (0, 0, -0.03)), P(bm_box(0.17, 0.13, 0.05), MEAT, (0, 0, 0.0)),
          P(bm_box(0.16, 0.12, 0.025), BREAD, (0, 0, 0.035))], "Pastrami_m", coll, parent=o)
    o = prop("Pickle")
    bake([P(bm_sphere(0.035, 0.035, 0.1, 8, 5), PICKLE, (0, 0, 0.0))], "Pickle_m", coll, parent=o)
    o = prop("Water")
    bake([P(bm_cyl(0.04, 0.04, 0.2, 8), WATER, (0, 0, 0.0)), P(bm_cyl(0.02, 0.02, 0.04, 8), CAPB, (0, 0, 0.12))], "Water_m", coll, parent=o)
    o = prop("Keys")
    bake([P(bm_torus(0.03, 0.006, 8, 4), KEY, (0, 0, 0)), P(bm_box(0.012, 0.004, 0.07), KEY, (0.02, 0, -0.05)),
          P(bm_box(0.012, 0.004, 0.06), METAL, (-0.02, 0, -0.045))], "Keys_m", coll, parent=o)
    o = prop("Tray")
    bake([P(bm_box(0.55, 0.38, 0.03), TRAY, (0, 0, 0.015)), P(bm_box(0.55, 0.02, 0.1), TRAY, (0, 0.18, 0.06)),
          P(bm_box(0.55, 0.02, 0.1), TRAY, (0, -0.18, 0.06)), P(bm_box(0.02, 0.38, 0.1), TRAY, (0.27, 0, 0.06)),
          P(bm_box(0.02, 0.38, 0.1), TRAY, (-0.27, 0, 0.06))], "Tray_m", coll, parent=o)
    # the Segway: a deck, two big wheels, a stalk + handlebar, a little headlight
    o = prop("Segway")
    bake([P(bm_box(0.5, 0.3, 0.06), SEG, (0, 0, 0.12)),
          P(bm_cyl(0.2, 0.2, 0.08, 12, "X"), DARK, (0.3, 0, 0.2), smooth=True),
          P(bm_cyl(0.2, 0.2, 0.08, 12, "X"), DARK, (-0.3, 0, 0.2), smooth=True),
          P(bm_cyl(0.025, 0.025, 0.9, 6), METAL, (0, -0.06, 0.6), rot=(-0.12, 0, 0)),
          P(bm_box(0.5, 0.04, 0.04), SEG, (0, -0.12, 1.05)),
          P(bm_box(0.1, 0.03, 0.05), SEGL, (0, -0.16, 0.16))], "Segway_m", coll, parent=o)
    # an airliner (~30 m in game: it is built 1:1 small and scaled in JS — 6 m long here)
    o = prop("Plane")
    L = 6.0
    parts = [P(bm_cyl(0.42, 0.42, L * 0.72, 14, "Y"), PW, (0, 0, 0.9), smooth=True),
             P(bm_sphere(0.42, 0.75, 0.42, 14, 8), PW, (0, -L * 0.36, 0.9)),
             P(bm_cyl(0.42, 0.08, 1.5, 14, "Y"), PW, (0, L * 0.36 + 0.75, 1.02), smooth=True),
             P(bm_box(0.86, L * 0.5, 0.12), LIV, (0, 0.2, 0.62)),                    # the belly stripe
             P(bm_prism([(-0.6, 0), (0.6, 0), (0.9, 1.4), (0.2, 1.4)], 0.04), LIV, (0, L * 0.36 + 1.0, 1.15)),   # the tail fin
             P(bm_box(0.06, 0.4, 0.02), PWIN, (0.43, -L * 0.42, 1.08), rot=(0, 0, 0.4)),
             P(bm_box(0.06, 0.4, 0.02), PWIN, (-0.43, -L * 0.42, 1.08), rot=(0, 0, -0.4))]
    for s in (-1, 1):
        parts.append(P(bm_prism([(-0.75, 0), (0.45, 0), (1.25, 0.05), (0.85, 0.05)], 1.4), PW, (s * 1.65, 0.1, 0.72), rot=(0, 0, 0)))
        parts.append(P(bm_box(1.2, 0.3, 0.04), PG, (s * 1.1, 0.3, 0.72)))
        parts.append(P(bm_cyl(0.17, 0.15, 0.6, 10, "Y"), PG, (s * 1.1, -0.15, 0.55), smooth=True))
        parts.append(P(bm_prism([(-0.25, 0), (0.25, 0), (0.45, 0.03), (0.2, 0.03)], 0.55), PW, (s * 0.6, L * 0.36 + 1.2, 1.1)))
        for k in range(10):
            parts.append(P(bm_box(0.02, 0.1, 0.1), PWIN, (s * 0.415, -L * 0.3 + k * 0.38, 1.05)))
    for gx, gy in ((0, -L * 0.33), (0.5, 0.25), (-0.5, 0.25)):
        parts.append(P(bm_cyl(0.025, 0.025, 0.5, 6), PG, (gx, gy, 0.3)))
        parts.append(P(bm_cyl(0.1, 0.1, 0.08, 8, "X"), DARK, (gx, gy, 0.1), smooth=True))
    bake(parts, "Plane_m", coll, parent=o)
    return coll


ASSETS = [
    ("airport_terminal", build_terminal),
    ("airport_terminal_props", build_props),
]
