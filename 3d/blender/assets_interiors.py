"""
Interiors: the buildings Lulu can walk into while she's on foot.

    The Thirsty Scholar (bar) · Cheder on the Corner (school hallway) ·
    Urgent Care waiting room (hospital) · Precinct 18½ (police) ·
    Shtrand-by-the-Sea (beach boardwalk)

Each SET is one .glb whose root holds
    <Set>_static   every piece of furniture, baked into one multi-material mesh
    named movers   DiscoBall, FanBlades, CellBars… (origin at their pivot)
    Spot_<id>      Empties: where a character stands / a hotspot sits (floor level,
                   Z rotation = which way the character faces; 0 = toward the camera)
    Col_<id>       CUBE Empties: axis-aligned walk blockers (scale = half size)
    Light_<id>     Empties where the game adds a point light
    Fx_<id>        Empties marking where the game puts its own dynamic bits
                   (TV screens, the dance floor, sun shafts…)
The game reads all of that by name (js/features/interiors/), so the layout lives
here only. Blender axes: X right, +Y = the back wall (away from the camera), the
open "dollhouse" side is -Y.

Also: interiors_props (small props the game clones: seagull, K9, cone, donut…)
and the new characters (one person per asset).
"""
from lib import *
from lib_people import build_person


def bm_text_lo(body, size, extrude=0.004, res=3):
    """Like lib.bm_text but with coarser curves (signs don't need 12 segments per glyph curve)."""
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


# ── a tiny set-building helper ─────────────────────────────────────────────
class SetBuilder:
    def __init__(self, name):
        self.name = name
        self.coll = scene_coll(name)
        self.root = root_empty(self.coll, name)
        self.parts = []
        self.n = 0

    def _p(self, bm, m, loc, rot=(0, 0, 0), smooth=False, bevel=None):
        self.n += 1
        p = Part(self.coll, "%s_p%d" % (self.name, self.n), bm, m, loc=loc, rot=rot, smooth=smooth)
        if bevel:
            p.bevel(bevel, 2)
        self.parts.append(p)
        return p

    def box(self, sx, sy, sz, m, x, y, z, rot=(0, 0, 0), bevel=None):
        return self._p(bm_box(sx, sy, sz), m, (x, y, z), rot, False, bevel)

    def cyl(self, r1, r2, h, m, x, y, z, segs=16, axis="Z", rot=(0, 0, 0), smooth=True):
        return self._p(bm_cyl(r1, r2, h, segs, axis), m, (x, y, z), rot, smooth)

    def sph(self, rx, m, x, y, z, ry=None, rz=None, u=16, v=10, rot=(0, 0, 0)):
        return self._p(bm_sphere(rx, ry, rz, u, v), m, (x, y, z), rot, True)

    def tor(self, R, r, m, x, y, z, rot=(0, 0, 0), seg=18, rseg=6):
        return self._p(bm_torus(R, r, seg, rseg), m, (x, y, z), rot, True)

    def text(self, body, size, m, x, y, z, face="-Y", extrude=0.015):
        """Extruded text on a wall. face = the direction the text faces."""
        rot = {"-Y": (math.pi / 2, 0, 0), "+X": (math.pi / 2, 0, math.pi / 2), "-X": (math.pi / 2, 0, -math.pi / 2),
               "+Z": (0, 0, 0)}[face]
        return self._p(bm_text_lo(body, size, extrude), m, (x, y, z), rot, False)

    def limb(self, a, b, r, m):
        self.n += 1
        p = limb(self.coll, "%s_l%d" % (self.name, self.n), a, b, r, m)
        self.parts.append(p)
        return p

    def empty(self, name, x, y, z=0.0, rz=0.0, kind="PLAIN_AXES", scale=None):
        e = bpy.data.objects.new(name, None)
        e.empty_display_type = kind
        self.coll.objects.link(e)
        e.parent = self.root
        e.location = (x, y, z)
        e.rotation_euler = (0, 0, rz)
        if scale:
            e.scale = scale
        return e

    def spot(self, name, x, y, rz=0.0, z=0.0):
        return self.empty("Spot_" + name, x, y, z, rz, "ARROWS")

    def col(self, name, x, y, hx, hy, hz=1.2):
        return self.empty("Col_" + name, x, y, hz, 0, "CUBE", (hx, hy, hz))

    def light(self, name, x, y, z):
        return self.empty("Light_" + name, x, y, z, 0, "SPHERE")

    def fx(self, name, x, y, z, rz=0.0):
        return self.empty("Fx_" + name, x, y, z, rz, "SINGLE_ARROW")

    def mover(self, name, build_fn, pivot):
        """Bake a separately-animated piece (origin at pivot). build_fn(add) adds Parts."""
        tmp = []
        old = self.parts
        self.parts = tmp
        build_fn()
        self.parts = old
        return bake_at(tmp, name, self.coll, self.root, pivot)

    def finish(self):
        bake(self.parts, self.name + "_static", self.coll, parent=self.root)
        return self.coll


def shell(S, W, D, H, floor_m, wall_m, cap_m, lip_m, seam_m=None, seam_step=0.5, seam_axis="x"):
    """Floor + back/left/right walls (open toward the camera at -Y) with a dollhouse cap."""
    S.box(W, D, 0.12, floor_m, 0, 0, -0.06)
    S.box(W + 0.6, 0.3, H, wall_m, 0, D / 2 + 0.15, H / 2)
    S.box(0.3, D, H, wall_m, -W / 2 - 0.15, 0, H / 2)
    S.box(0.3, D, H, wall_m, W / 2 + 0.15, 0, H / 2)
    # wall caps (the cut-away look) and the base plinth along the open front edge
    S.box(W + 0.7, 0.4, 0.08, cap_m, 0, D / 2 + 0.15, H + 0.04)
    S.box(0.4, D + 0.1, 0.08, cap_m, -W / 2 - 0.15, 0, H + 0.04)
    S.box(0.4, D + 0.1, 0.08, cap_m, W / 2 + 0.15, 0, H + 0.04)
    S.box(W + 0.6, 0.3, 0.5, lip_m, 0, -D / 2 - 0.15, -0.25)
    S.box(0.3, D + 0.6, 0.5, lip_m, -W / 2 - 0.15, -0.15, -0.25)
    S.box(0.3, D + 0.6, 0.5, lip_m, W / 2 + 0.15, -0.15, -0.25)
    if seam_m:
        if seam_axis == "x":
            k = 1
            y = -D / 2 + seam_step
            while y < D / 2 - 0.01:
                S.box(W - 0.02, 0.025, 0.006, seam_m, 0, y, 0.003)
                y += seam_step
                k += 1
        else:
            x = -W / 2 + seam_step
            while x < W / 2 - 0.01:
                S.box(0.025, D - 0.02, 0.006, seam_m, x, 0, 0.003)
                x += seam_step


def bm_poly(verts, faces):
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in verts]
    for f in faces:
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_wedge(R, h, a0, a1, n=4, thick=0.03):
    """One slice of an umbrella canopy (apex up at h, rim at z=0), with an underside."""
    verts = [(0, 0, h), (0, 0, h - thick)]
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        verts.append((math.cos(a) * R, math.sin(a) * R, 0))
        verts.append((math.cos(a) * R, math.sin(a) * R, -thick))
    faces = []
    for i in range(n):
        t0, t1 = 2 + i * 2, 2 + (i + 1) * 2
        faces.append((0, t0, t1))
        faces.append((1, t1 + 1, t0 + 1))
        faces.append((t0, t0 + 1, t1 + 1, t1))
    return bm_poly(verts, faces)


def tiles(S, W, D, step, m_a, m_b, z=0.004):
    """Checkerboard floor tiles (only the B squares; A is the floor itself)."""
    nx, ny = int(W / step), int(D / step)
    for i in range(nx):
        for j in range(ny):
            if (i + j) % 2:
                S.box(step - 0.01, step - 0.01, 0.006, m_b, -W / 2 + step * (i + 0.5), -D / 2 + step * (j + 0.5), z)


def wainscot(S, W, D, h, m, rail_m, sides=("B", "L", "R"), gap=None):
    if "B" in sides and gap:
        for a, b in ((-W / 2, gap[0]), (gap[1], W / 2)):
            S.box(b - a, 0.05, h, m, (a + b) / 2, D / 2 - 0.025, h / 2)
            S.box(b - a, 0.09, 0.07, rail_m, (a + b) / 2, D / 2 - 0.045, h + 0.03)
    elif "B" in sides:
        S.box(W, 0.05, h, m, 0, D / 2 - 0.025, h / 2)
        S.box(W, 0.09, 0.07, rail_m, 0, D / 2 - 0.045, h + 0.03)
    for s, k in ((-1, "L"), (1, "R")):
        if k in sides:
            S.box(0.05, D, h, m, s * (W / 2 - 0.025), 0, h / 2)
            S.box(0.09, D, 0.07, rail_m, s * (W / 2 - 0.045), 0, h + 0.03)


def door(S, x, y, face, wood, frame, knob, sign_m, sign_txt_m, label="EXIT", h=2.3, w=1.15):
    """A door flat on a wall. face = direction the door faces into the room ("-Y", "+X", "-X")."""
    if face == "-Y":
        S.box(w + 0.24, 0.08, h + 0.14, frame, x, y - 0.04, h / 2 + 0.03)
        S.box(w, 0.1, h, wood, x, y - 0.09, h / 2)
        for k in range(2):
            S.box(w * 0.7, 0.03, h * 0.32, frame, x, y - 0.15, h * (0.3 + 0.4 * k))
        S.sph(0.06, knob, x + w * 0.36, y - 0.17, h * 0.47)
        S.box(0.8, 0.08, 0.3, sign_m, x, y - 0.05, h + 0.35)
        S.text(label, 0.2, sign_txt_m, x, y - 0.1, h + 0.35, "-Y")
    else:
        s = 1 if face == "+X" else -1   # +X: door on the LEFT wall facing right
        S.box(0.08, w + 0.24, h + 0.14, frame, x + s * 0.04, y, h / 2 + 0.03)
        S.box(0.1, w, h, wood, x + s * 0.09, y, h / 2)
        for k in range(2):
            S.box(0.03, w * 0.7, h * 0.32, frame, x + s * 0.15, y, h * (0.3 + 0.4 * k))
        S.sph(0.06, knob, x + s * 0.17, y - s * w * 0.36, h * 0.47)
        S.box(0.08, 0.8, 0.3, sign_m, x + s * 0.05, y, h + 0.35)
        S.text(label, 0.2, sign_txt_m, x + s * 0.1, y, h + 0.35, face)


def frame_pic(S, x, y, z, w, h, frame_m, pic_m, face="-Y"):
    if face == "-Y":
        S.box(w + 0.1, 0.05, h + 0.1, frame_m, x, y - 0.03, z)
        S.box(w, 0.03, h, pic_m, x, y - 0.06, z)
    else:
        s = 1 if face == "+X" else -1
        S.box(0.05, w + 0.1, h + 0.1, frame_m, x + s * 0.03, y, z)
        S.box(0.03, w, h, pic_m, x + s * 0.06, y, z)


def stool(S, x, y, seat, chrome, h=0.78):
    S.cyl(0.24, 0.24, 0.1, seat, x, y, h)
    S.cyl(0.035, 0.035, h, chrome, x, y, h / 2, segs=8)
    S.tor(0.17, 0.015, chrome, x, y, 0.3, seg=14, rseg=4)
    S.cyl(0.2, 0.22, 0.04, chrome, x, y, 0.02)


def plant(S, x, y, pot_m, leaf_m, s=1.0):
    S.cyl(0.2 * s, 0.16 * s, 0.38 * s, pot_m, x, y, 0.19 * s, segs=12)
    for k in range(5):
        a = k * 1.256
        S.sph(0.16 * s, leaf_m, x + math.cos(a) * 0.13 * s, y + math.sin(a) * 0.13 * s, 0.55 * s + (k % 2) * 0.15 * s, rz=0.24 * s)
    S.sph(0.2 * s, leaf_m, x, y, 0.85 * s)


# ═════════════════════════════════════════════════════════════════════════
#  THE THIRSTY SCHOLAR — the bar
# ═════════════════════════════════════════════════════════════════════════
def build_bar():
    S = SetBuilder("InteriorsBar")
    W, D, H = 16.0, 10.0, 4.2
    FLOOR = mat("BarFloor", "#6A4434", 0.55)
    SEAM = mat("BarSeam", "#3A241C", 0.8)
    WALL = mat("BarWall", "#4A2840", 0.9)
    WAIN = mat("BarWainscot", "#2C1824", 0.6)
    CAP = mat("BarCap", "#22121C", 0.8)
    LIP = mat("BarLip", "#2A1A14", 0.8)
    WOOD = mat("BarWood", "#7A4528", 0.45)
    TOP = mat("BarTop", "#3B2318", 0.18)
    BRASS = mat("BarBrass", "#D4A72C", 0.25, 0.9)
    CHROME = mat("BarChrome", "#D7DCE0", 0.2, 0.85)
    LEATHER = mat("BarStool", "#C62828", 0.4)
    DARK = mat("BarDark", "#1A1014", 0.6)
    MIRROR = mat("BarMirror", "#8FA6B8", 0.06, 0.95)
    SHELF = mat("BarShelf", "#5B331D", 0.5)
    NEON_P = mat("NeonPink", "#FF2D95", 0.3, emit=1.4)
    NEON_B = mat("NeonBlue", "#1EB6FF", 0.3, emit=1.4)
    NEON_G = mat("NeonGreen", "#2EE88E", 0.3, emit=1.4)
    NEON_Y = mat("NeonGold", "#FFD740", 0.3, emit=3.0)
    BOARD = mat("BarBoard", "#140A12", 0.8)
    BULB = mat("NeonBulb", "#FFD8A0", 0.3, emit=5.0)
    SHADE = mat("BarShade", "#262022", 0.5, 0.3)
    DOOR = mat("BarDoor", "#4E342E", 0.6)
    PIC = [mat("BarPic%d" % i, c, 0.7) for i, c in enumerate(("#FFB74D", "#4DB6AC", "#F06292", "#9575CD"))]
    BOT = [mat("BarBottle%d" % i, c, 0.12, 0.1) for i, c in enumerate(("#FF7043", "#66BB6A", "#FFCA28", "#42A5F5", "#AB47BC", "#EF5350", "#26C6DA", "#8D6E63"))]
    CAPB = mat("BarBottleCap", "#FFF59D", 0.4, 0.4)
    JUKE = mat("NeonJuke", "#FFB300", 0.3, emit=2.5)
    JUKEB = mat("BarJukeBody", "#8E1E3C", 0.35, 0.2)
    GRILLE = mat("BarGrille", "#2A2024", 0.5, 0.5)
    MAT = mat("BarDoormat", "#5D4037", 0.95)
    TV = mat("BarTV", "#111114", 0.35, 0.2)
    DART = [mat("BarDart0", "#1B1B1B", 0.7), mat("BarDart1", "#F5E6C8", 0.7), mat("BarDart2", "#C62828", 0.7)]

    shell(S, W, D, H, FLOOR, WALL, CAP, LIP, SEAM, 0.45, "x")
    wainscot(S, W, D, 1.15, WAIN, SHELF)

    # ── the counter (back right) ──
    cx0, cx1, cy = 0.4, 7.6, 2.6
    cw = cx1 - cx0
    S.box(cw, 0.7, 1.02, WOOD, (cx0 + cx1) / 2, cy, 0.51)
    for k in range(6):   # raised panels on the counter front
        S.box(cw / 6 - 0.16, 0.03, 0.62, SHELF, cx0 + cw * (k + 0.5) / 6, cy - 0.36, 0.52)
    S.box(cw + 0.2, 0.86, 0.08, TOP, (cx0 + cx1) / 2, cy, 1.06, bevel=0.025)
    S.cyl(0.03, 0.03, cw, BRASS, (cx0 + cx1) / 2, cy - 0.48, 0.24, segs=8, axis="X")
    for k in range(5):
        S.limb((cx0 + 0.3 + k * cw / 4.4, cy - 0.36, 0.24), (cx0 + 0.3 + k * cw / 4.4, cy - 0.48, 0.24), 0.02, BRASS)
    # beer tap tower (the "liquid courage" station) at the right end
    tx = 7.0
    S.cyl(0.07, 0.07, 0.42, CHROME, tx, cy, 1.31, segs=10)
    S.box(0.5, 0.1, 0.1, CHROME, tx, cy, 1.5)
    for k, c in enumerate((NEON_Y, LEATHER, NEON_G)):
        S.cyl(0.025, 0.025, 0.06, CHROME, tx - 0.18 + k * 0.18, cy - 0.06, 1.46, segs=8)
        S.cyl(0.03, 0.02, 0.22, c, tx - 0.18 + k * 0.18, cy - 0.06, 1.62, segs=8)
    S.box(0.6, 0.3, 0.02, CHROME, tx, cy - 0.05, 1.11)
    # back bar: lower cabinet, shelves, mirror, bottles, hanging stemware
    S.box(cw, 0.55, 0.95, SHELF, (cx0 + cx1) / 2, D / 2 - 0.3, 0.48)
    S.box(cw, 0.6, 0.05, TOP, (cx0 + cx1) / 2, D / 2 - 0.3, 0.97)
    S.box(cw - 0.2, 0.04, 1.6, MIRROR, (cx0 + cx1) / 2, D / 2 - 0.04, 1.85)
    for z in (1.42, 1.95, 2.48):
        S.box(cw, 0.32, 0.04, SHELF, (cx0 + cx1) / 2, D / 2 - 0.18, z)
    for k in range(2):
        S.box(0.08, 0.34, 1.7, SHELF, cx0 + 0.04 + k * (cw - 0.08), D / 2 - 0.18, 1.85)
    i = 0
    for z in (1.42, 1.95, 2.48):
        x = cx0 + 0.25
        while x < cx1 - 0.2:
            hgt = 0.24 + (i % 3) * 0.05
            bm = BOT[(i * 3 + int(z * 7)) % len(BOT)]
            S.cyl(0.055, 0.055, hgt, bm, x, D / 2 - 0.2, z + 0.02 + hgt / 2, segs=8)
            S.cyl(0.02, 0.025, 0.12, bm, x, D / 2 - 0.2, z + 0.02 + hgt + 0.06, segs=6)
            S.cyl(0.022, 0.022, 0.025, CAPB, x, D / 2 - 0.2, z + 0.02 + hgt + 0.13, segs=5, smooth=False)
            x += 0.19 + (i % 2) * 0.03
            i += 1
    # pendant lamps over the counter
    for k, x in enumerate((1.6, 4.0, 6.4)):
        S.cyl(0.008, 0.008, H - 3.25, DARK, x, cy, (H + 3.25) / 2, segs=6)
        S.cyl(0.06, 0.32, 0.3, SHADE, x, cy, 3.1, segs=16)
        S.sph(0.09, BULB, x, cy, 2.98)
        S.light("pendant%d" % k, x, cy, 2.85)
    # stools along the counter
    for x in (1.6, 3.1, 4.6):
        stool(S, x, 1.75, LEATHER, CHROME)
        S.col("stool%.0f" % (x * 10), x, 1.75, 0.22, 0.22, 0.5)
    S.col("counter", (cx0 + cx1) / 2, 3.7, cw / 2 + 0.1, 1.45)

    # ── neon signs ──
    S.box(5.6, 0.06, 0.78, BOARD, 4.0, D / 2 - 0.05, 3.5)
    S.text("THE THIRSTY SCHOLAR", 0.4, NEON_P, 4.0, D / 2 - 0.1, 3.47, "-Y", 0.03)
    S.light("neonTitle", 4.0, D / 2 - 0.9, 3.3)
    S.box(0.06, 2.6, 0.7, BOARD, -W / 2 + 0.05, 1.4, 3.1)
    S.text("L'CHAIM!", 0.42, NEON_B, -W / 2 + 0.1, 1.4, 3.08, "+X", 0.03)
    S.light("neonChaim", -W / 2 + 0.8, 1.4, 3.0)
    S.box(0.06, 1.5, 0.6, BOARD, W / 2 - 0.05, -2.2, 2.85)
    S.text("OPEN", 0.36, NEON_G, W / 2 - 0.1, -2.2, 2.83, "-X", 0.03)
    S.light("neonOpen", W / 2 - 0.8, -2.2, 2.7)

    # ── jukebox (back left) ──
    jx, jy = -6.6, D / 2 - 0.55
    S.box(1.1, 0.7, 1.25, JUKEB, jx, jy, 0.62, bevel=0.06)
    S.cyl(0.55, 0.55, 0.7, JUKEB, jx, jy, 1.25, segs=24, axis="Y")
    S.tor(0.48, 0.05, JUKE, jx, jy - 0.36, 1.25, rot=(math.pi / 2, 0, 0), seg=24, rseg=6)
    S.box(0.84, 0.04, 0.5, GRILLE, jx, jy - 0.36, 0.42)
    for k in range(4):
        S.box(0.06, 0.05, 0.9, JUKE, jx - 0.45 + k * 0.3, jy - 0.37, 0.66)
    S.box(0.7, 0.04, 0.26, mat("NeonJukeGlass", "#FFE082", 0.2, emit=1.6), jx, jy - 0.37, 1.02)
    S.spot("jukebox", jx + 0.2, jy - 1.25, 0)
    S.col("jukebox", jx, jy, 0.6, 0.4)
    S.light("juke", jx, jy - 1.0, 1.3)
    # dance floor (tiles are animated by the game) + its chrome frame
    S.fx("dancefloor", -4.4, 1.4, 0.0)
    for s in (-1, 1):
        S.box(4.2, 0.08, 0.03, CHROME, -4.4, 1.4 + s * 2.04, 0.015)
        S.box(0.08, 4.2, 0.03, CHROME, -4.4 + s * 2.04, 1.4, 0.015)
    S.spot("dancefloor", -4.4, 1.2, 0)
    S.cyl(0.006, 0.006, 0.9, DARK, -4.4, 1.4, H - 0.45, segs=6)
    S.mover("DiscoBall", lambda: S._p(bm_ico(0.32, 2), mat("DiscoMirror", "#E8EAF0", 0.08, 1.0), (-4.4, 1.4, 3.3), (0, 0, 0), False),
            (-4.4, 1.4, 3.3))
    S.light("disco", -4.4, 1.4, 2.4)

    # ── the wall TV (left of the back bar) ──
    S.box(1.5, 0.12, 0.92, TV, -1.2, D / 2 - 0.08, 2.75, bevel=0.03)
    S.fx("tv", -1.2, D / 2 - 0.15, 2.75)
    S.box(0.2, 0.2, 0.2, DARK, -1.2, D / 2 - 0.05, 2.2)

    # ── the door (left wall, front) + bouncer's corner ──
    door(S, -W / 2, -2.9, "+X", DOOR, SHELF, BRASS, BOARD, NEON_G, "EXIT")
    S.box(1.0, 1.5, 0.02, MAT, -W / 2 + 0.7, -2.9, 0.01)
    S.spot("door", -W / 2 + 0.95, -2.9, math.pi / 2)
    S.spot("bouncer", -W / 2 + 1.0, -1.15, 1.25)
    S.cyl(0.02, 0.02, 0.95, BRASS, -W / 2 + 0.75, -4.1, 0.48, segs=8)  # velvet rope posts
    S.cyl(0.02, 0.02, 0.95, BRASS, -W / 2 + 1.9, -4.1, 0.48, segs=8)
    S.sph(0.05, BRASS, -W / 2 + 0.75, -4.1, 0.98)
    S.sph(0.05, BRASS, -W / 2 + 1.9, -4.1, 0.98)
    S.limb((-W / 2 + 0.75, -4.1, 0.86), (-W / 2 + 1.33, -4.1, 0.7), 0.025, LEATHER)
    S.limb((-W / 2 + 1.33, -4.1, 0.7), (-W / 2 + 1.9, -4.1, 0.86), 0.025, LEATHER)

    # ── high tables + a booth for the regulars ──
    for k, (x, y) in enumerate(((0.4, -2.4), (3.6, -2.9))):
        S.cyl(0.42, 0.42, 0.06, TOP, x, y, 1.05, segs=20)
        S.cyl(0.05, 0.05, 1.0, CHROME, x, y, 0.52, segs=8)
        S.cyl(0.3, 0.34, 0.04, CHROME, x, y, 0.02, segs=16)
        S.col("table%d" % k, x, y, 0.42, 0.42, 0.6)
        for s in (-1, 1):
            stool(S, x + s * 0.75, y, LEATHER, CHROME)
            S.col("tstool%d%d" % (k, s + 1), x + s * 0.75, y, 0.22, 0.22, 0.5)
    S.spot("patron2", 0.4 - 0.75, -2.4, -math.pi / 2)
    S.spot("patron3", 0.4 + 0.75, -2.4, math.pi / 2)
    bx = W / 2 - 0.55
    S.box(0.9, 2.6, 0.5, LEATHER, bx, -0.4, 0.25)
    S.box(0.25, 2.6, 0.95, LEATHER, bx + 0.33, -0.4, 0.75)
    S.box(0.8, 1.6, 0.06, TOP, bx - 0.9, -0.4, 0.78)
    S.cyl(0.05, 0.05, 0.76, CHROME, bx - 0.9, -0.4, 0.38, segs=8)
    S.col("booth", bx - 0.45, -0.4, 0.95, 1.35, 0.6)
    # dartboard + pictures on the right wall
    for k, r in enumerate((0.36, 0.26, 0.15, 0.05)):
        S.cyl(r, r, 0.04 + k * 0.005, DART[k % 3] if k < 3 else DART[2], W / 2 - 0.06 - k * 0.004, 2.2, 1.85, segs=24, axis="X")
    frame_pic(S, W / 2, 0.2, 2.6, 0.7, 0.9, SHELF, PIC[0], "-X")
    frame_pic(S, W / 2, -0.9, 2.5, 0.6, 0.6, SHELF, PIC[1], "-X")
    frame_pic(S, -W / 2, -0.2, 2.1, 0.8, 0.6, SHELF, PIC[2], "+X")
    frame_pic(S, -2.9, D / 2, 2.3, 0.7, 0.9, SHELF, PIC[3], "-Y")

    # ── where the regulars are ──
    S.spot("bartender", 5.6, 3.75, 0)
    S.spot("solTalk", 5.6, 1.85, 0)
    S.spot("courage", 7.1, 1.85, math.pi)
    S.spot("passed", 3.1, 1.75, math.pi)
    S.spot("passedTalk", 3.1, 1.35, 0)
    S.spot("patron1", 1.6, 1.75, math.pi)
    S.spot("drunkB", 4.3, 0.75, 0.5)
    S.spot("drunkA", -1.3, 0.5, -0.5)
    S.spot("lulu", -W / 2 + 2.5, -2.9, math.pi / 2)
    S.col("bouncer", -W / 2 + 1.0, -1.15, 0.45, 0.45)
    return S.finish()


# ═════════════════════════════════════════════════════════════════════════
#  CHEDER ON THE CORNER — the school hallway
# ═════════════════════════════════════════════════════════════════════════
def build_school():
    S = SetBuilder("InteriorsSchool")
    W, D, H = 18.0, 8.0, 3.8
    FLOOR = mat("SchFloor", "#A5D46A", 0.45)
    TILE = mat("SchTile", "#8CC152", 0.45)
    WALL = mat("SchWall", "#FFF1D0", 0.9)
    WAIN = mat("SchWainscot", "#7FB3E0", 0.6)
    RAIL = mat("SchRail", "#FFFFFF", 0.5)
    CAP = mat("SchCap", "#D8C29A", 0.8)
    LIP = mat("SchLip", "#6E8F45", 0.8)
    WOOD = mat("SchWood", "#C98B52", 0.55)
    DWOOD = mat("SchDarkWood", "#7A4E2D", 0.6)
    BOARDG = mat("SchChalk", "#2E5D3A", 0.85)
    METAL = mat("SchMetal", "#B0BEC5", 0.3, 0.7)
    WHITE = mat("SchWhite", "#FAFAFA", 0.6)
    LOCK = [mat("SchLocker%d" % i, c, 0.35, 0.3) for i, c in enumerate(("#42A5F5", "#EF5350", "#66BB6A", "#FFA726", "#AB47BC", "#26C6DA"))]
    CLOTH = mat("SchCloth", "#F8BBD0", 0.9)
    SKY = mat("SchSky", "#BFE6FF", 0.9, emit=1.2)
    TREE = mat("SchTree", "#7CC36A", 0.9, emit=0.4)
    PANEL = mat("NeonPanel", "#FFFDF3", 0.5, emit=2.2)
    SIGN = mat("SchSign", "#37474F", 0.6)
    SIGNT = mat("SchSignText", "#FFE082", 0.4, emit=0.6)
    DOOR = mat("SchDoor", "#8D6E63", 0.6)
    KNOB = mat("SchKnob", "#FFD54F", 0.3, 0.8)
    EXITG = mat("NeonExit", "#69F0AE", 0.3, emit=3.0)
    RED = mat("SchRed", "#E53935", 0.5)
    FOOD = [mat("SchRugelach", "#C68642", 0.7), mat("SchBabka", "#6D4C41", 0.7), mat("SchCookie", "#F5DEB3", 0.7),
            mat("SchJam", "#C2185B", 0.5), mat("SchIcing", "#FFFFFF", 0.5)]
    JAR = mat("Glass", "#9FD8FF", 0.05)

    shell(S, W, D, H, FLOOR, WALL, CAP, LIP)
    tiles(S, W, D, 1.0, FLOOR, TILE)
    wainscot(S, W, D, 1.0, WAIN, RAIL)

    # windows in the back wall (with sky + trees outside, sun shafts added by the game)
    for k, x in enumerate((-1.8, 1.9)):
        cut = Part(S.coll, "wcut%d" % k, bm_box(1.7, 1.0, 1.5), None, loc=(x, D / 2 + 0.15, 2.25))
        cut.ob.display_type = "WIRE"
        S.parts[1].cut(cut)
        S.box(1.84, 0.12, 0.1, WHITE, x, D / 2 - 0.02, 3.03)
        S.box(1.84, 0.2, 0.1, WHITE, x, D / 2 - 0.05, 1.47)
        S.box(0.08, 0.12, 1.5, WHITE, x, D / 2 + 0.02, 2.25)
        S.box(1.7, 0.12, 0.06, WHITE, x, D / 2 + 0.02, 2.25)
        for s in (-1, 1):
            S.box(0.1, 0.12, 1.6, WHITE, x + s * 0.88, D / 2 - 0.02, 2.25)
        S.box(1.7, 0.02, 1.5, JAR, x, D / 2 + 0.12, 2.25)
        S.box(2.4, 0.05, 2.2, SKY, x, D / 2 + 0.9, 2.3)
        for t in range(3):
            S.sph(0.42, TREE, x - 0.6 + t * 0.6, D / 2 + 0.85, 1.65 + (t % 2) * 0.25)
        S.fx("sun%d" % k, x, D / 2 - 0.1, 2.25)
    # ceiling light panels hanging on wires (they flicker)
    for k, x in enumerate((-6, 0, 6)):
        S.box(2.2, 0.5, 0.08, PANEL, x, 0.4, H - 0.35)
        S.box(2.3, 0.6, 0.04, METAL, x, 0.4, H - 0.29)
        for s in (-1, 1):
            S.cyl(0.006, 0.006, 0.3, METAL, x + s * 1.0, 0.4, H - 0.14, segs=5)
        S.light("panel%d" % k, x, 0.4, H - 0.6)

    # chalkboard (the game paints the Hebrew lesson on it) + teacher's desk
    S.box(3.2, 0.08, 1.4, DWOOD, -5.2, D / 2 - 0.04, 2.15)
    S.box(3.0, 0.05, 1.2, BOARDG, -5.2, D / 2 - 0.09, 2.15)
    S.box(3.2, 0.18, 0.05, DWOOD, -5.2, D / 2 - 0.12, 1.44)
    S.fx("chalkboard", -5.2, D / 2 - 0.12, 2.15)
    for k in range(3):
        S.box(0.1, 0.03, 0.03, WHITE, -6.3 + k * 0.2, D / 2 - 0.16, 1.48)
    S.box(1.4, 0.7, 0.06, WOOD, -5.6, 2.7, 0.78)
    for sx in (-1, 1):
        for sy in (-1, 1):
            S.box(0.06, 0.06, 0.76, METAL, -5.6 + sx * 0.62, 2.7 + sy * 0.28, 0.38)
    S.box(0.3, 0.2, 0.25, RED, -5.2, 2.7, 0.93)   # an apple for the morah
    S.sph(0.09, RED, -5.95, 2.7, 0.9)
    S.col("tdesk", -5.6, 2.7, 0.75, 0.4, 0.5)
    S.spot("morah", -4.6, 2.05, 0.0)

    # water fountain (left end of the back wall)
    fx = -8.0
    S.box(0.6, 0.45, 0.9, METAL, fx, D / 2 - 0.25, 0.75)
    S.box(0.64, 0.5, 0.08, METAL, fx, D / 2 - 0.28, 1.22)
    S.cyl(0.18, 0.18, 0.06, mat("SchBasin", "#90A4AE", 0.2, 0.6), fx, D / 2 - 0.3, 1.27, segs=16)
    S.cyl(0.02, 0.02, 0.1, METAL, fx, D / 2 - 0.2, 1.33, segs=6)
    S.col("fountain", fx, D / 2 - 0.25, 0.35, 0.3)
    S.spot("fountain", fx + 0.1, D / 2 - 1.2, 0)
    S.fx("fountainJet", fx, D / 2 - 0.22, 1.38)

    # the hallway clock (always almost recess)
    S.cyl(0.36, 0.36, 0.08, WHITE, 0.05, D / 2 - 0.05, 3.15, segs=24, axis="Y")
    S.tor(0.36, 0.04, SIGN, 0.05, D / 2 - 0.08, 3.15, rot=(math.pi / 2, 0, 0), seg=24)
    S.mover("ClockHands", lambda: (S._p(bm_box(0.03, 0.02, 0.26), SIGN, (0.05, D / 2 - 0.12, 3.15 + 0.11), (0, 0, 0), False),
                                   S._p(bm_box(0.03, 0.02, 0.18), RED, (0.05 + 0.06, D / 2 - 0.13, 3.15 + 0.05), (0, -0.9, 0), False)),
            (0.05, D / 2 - 0.12, 3.15))
    S.spot("clock", 0.05, D / 2 - 1.0, 0)

    # principal's office door with its sign
    door(S, 5.6, D / 2, "-Y", DOOR, DWOOD, KNOB, SIGN, SIGNT, "OFFICE")
    S.box(1.3, 0.04, 0.26, SIGN, 5.6, D / 2 - 0.2, 1.75)
    S.text("PRINCIPAL", 0.13, SIGNT, 5.6, D / 2 - 0.23, 1.75, "-Y")
    S.spot("principal", 5.6, D / 2 - 1.2, 0)

    # lockers (lost-and-found) on the right of the back wall
    for k in range(5):
        x = 6.95 + k * 0.42
        m = LOCK[k % len(LOCK)]
        S.box(0.4, 0.42, 2.0, m, x, D / 2 - 0.22, 1.0)
        for v in range(3):
            S.box(0.28, 0.02, 0.03, mat("SchVent", "#263238", 0.6), x, D / 2 - 0.44, 1.75 - v * 0.07)
        S.box(0.04, 0.03, 0.18, METAL, x + 0.12, D / 2 - 0.44, 1.05)
    S.box(2.15, 0.44, 0.06, METAL, 7.8, D / 2 - 0.22, 2.03)
    S.col("lockers", 7.8, D / 2 - 0.22, 1.1, 0.25)
    S.box(0.6, 0.5, 0.45, mat("SchBox", "#A1887F", 0.8), 7.4, D / 2 - 0.75, 0.23)   # the lost-and-found box
    for k, c in enumerate(("#E53935", "#1E88E5", "#FDD835")):
        S.sph(0.11, mat("SchHat%d" % k, c, 0.8), 7.25 + k * 0.15, D / 2 - 0.75, 0.5, rz=0.06)
    S.spot("locker", 7.6, D / 2 - 1.3, 0)
    S.col("lfbox", 7.4, D / 2 - 0.75, 0.3, 0.25, 0.3)

    # kid drawings taped up
    for k, (x, z, w, h) in enumerate(((-7.0, 2.2, 0.55, 0.42), (-3.1, 2.55, 0.5, 0.4), (3.5, 2.4, 0.6, 0.45),
                                       (4.2, 1.85, 0.42, 0.34), (-0.1, 2.0, 0.45, 0.36))):
        S.fx("drawing%d" % k, x, D / 2 - 0.06, z)
    # coat hooks with backpacks on the left wall
    for k in range(4):
        y = -1.8 + k * 0.9
        S.box(0.06, 0.06, 0.06, METAL, -W / 2 + 0.06, y, 1.8)
        S.box(0.22, 0.42, 0.5, mat("SchBag%d" % k, ("#E91E63", "#3F51B5", "#009688", "#FF9800")[k], 0.8), -W / 2 + 0.17, y, 1.45, bevel=0.06)
    # bake sale table
    bx, by = -1.4, -0.7
    S.box(2.4, 0.9, 0.06, WOOD, bx, by, 0.78)
    S.box(2.5, 0.95, 0.66, CLOTH, bx, by, 0.46)
    for k, f in enumerate(FOOD[:3]):
        x = bx - 0.8 + k * 0.8
        S.cyl(0.3, 0.3, 0.03, mat("SchPlate", "#FFFFFF", 0.4), x, by, 0.83, segs=18)
        if k == 0:
            for r in range(5):
                S.tor(0.06, 0.03, f, x - 0.15 + (r % 3) * 0.15, by - 0.06 + (r // 3) * 0.14, 0.88, seg=10, rseg=5)
        elif k == 1:
            S.box(0.4, 0.18, 0.15, f, x, by, 0.92, bevel=0.05)
            S.box(0.36, 0.14, 0.04, FOOD[4], x, by, 1.0)
        else:
            for r in range(3):
                S._p(bm_prism([(-0.08, 0), (0.08, 0), (0, 0.13)], 0.025), f, (x - 0.12 + r * 0.12, by, 0.85), (0, 0, 0), False)
                S.sph(0.03, FOOD[3], x - 0.12 + r * 0.12, by - 0.02, 0.9)
    S.cyl(0.11, 0.11, 0.24, JAR, bx + 1.05, by + 0.2, 0.93, segs=12)
    S.box(1.9, 0.04, 0.42, mat("SchBanner", "#FFF3E0", 0.7), bx, by - 0.46, 1.35)
    S.text("BAKE SALE", 0.22, mat("SchBannerText", "#E65100", 0.5), bx, by - 0.49, 1.35, "-Y")
    for s in (-1, 1):
        S.cyl(0.02, 0.02, 0.62, DWOOD, bx + s * 0.95, by - 0.45, 1.12, segs=6)
    S.col("bake", bx, by, 1.25, 0.5, 0.5)
    S.spot("bake", bx, by - 1.15, 0)

    # tiny desks for the little ones (front left)
    for k, (x, y) in enumerate(((-7.3, -2.4), (-5.9, -1.8), (-4.5, -2.5))):
        S.box(0.8, 0.55, 0.05, WOOD, x, y, 0.58)
        for sx in (-1, 1):
            S.box(0.04, 0.5, 0.56, METAL, x + sx * 0.36, y, 0.28)
        S.box(0.38, 0.36, 0.04, mat("SchChair", "#FF7043", 0.5), x, y - 0.5, 0.34)
        S.box(0.38, 0.04, 0.34, mat("SchChair", "#FF7043", 0.5), x, y - 0.7, 0.55)
        S.col("desk%d" % k, x, y - 0.15, 0.45, 0.5, 0.4)
    # exit door on the right wall
    door(S, W / 2, -1.6, "-X", DOOR, DWOOD, KNOB, SIGN, EXITG, "EXIT")
    S.spot("door", W / 2 - 0.95, -1.6, -math.pi / 2)
    S.spot("lulu", W / 2 - 2.5, -1.6, -math.pi / 2)
    S.spot("kid", 2.2, 0.6, 0)
    plant(S, -W / 2 + 0.5, -3.4, mat("SchPot", "#E57373", 0.7), mat("SchLeaf", "#43A047", 0.8))
    S.col("plant", -W / 2 + 0.5, -3.4, 0.3, 0.3)
    return S.finish()


# ═════════════════════════════════════════════════════════════════════════
#  URGENT CARE — the hospital waiting room
# ═════════════════════════════════════════════════════════════════════════
def build_hospital():
    S = SetBuilder("InteriorsHospital")
    W, D, H = 16.0, 10.0, 3.8
    FLOOR = mat("HospFloor", "#ECEFF1", 0.35)
    TILE = mat("HospTile", "#D5DEE3", 0.35)
    WALL = mat("HospWall", "#DDF2EF", 0.9)
    WAIN = mat("HospWainscot", "#80CBC4", 0.6)
    RAIL = mat("HospRail", "#FFFFFF", 0.4)
    CAP = mat("HospCap", "#A7C8C4", 0.8)
    LIP = mat("HospLip", "#90A4AE", 0.8)
    DESK = mat("HospDesk", "#FAFAFA", 0.4)
    DESKT = mat("HospDeskTop", "#4DB6AC", 0.3)
    METAL = mat("HospMetal", "#B0BEC5", 0.25, 0.75)
    CHAIR = mat("HospChair", "#7E57C2", 0.45)
    CHAIRD = mat("HospChairDark", "#5E35B1", 0.45)
    PANEL = mat("NeonPanelCool", "#F4FFFF", 0.5, emit=2.4)
    SIGN = mat("HospSign", "#00796B", 0.5)
    SIGNT = mat("HospSignText", "#FFFFFF", 0.4, emit=0.6)
    VEND = mat("HospVend", "#C62828", 0.35, 0.2)
    VGLASS = mat("NeonVendGlass", "#E3F2FD", 0.1, emit=0.6)
    SNACK = [mat("HospSnack%d" % i, c, 0.6) for i, c in enumerate(("#FFCA28", "#42A5F5", "#66BB6A", "#FF7043", "#AB47BC"))]
    WATER = mat("WaterTank", "#4FC3F7", 0.05)
    CAB = mat("HospCabinet", "#8D6E63", 0.6)
    GRAVEL = mat("HospGravel", "#FFE0B2", 0.9)
    WEED = mat("HospWeed", "#43A047", 0.7)
    DOOR = mat("HospDoor", "#B0BEC5", 0.4, 0.3)
    KNOB = mat("HospKnob", "#ECEFF1", 0.2, 0.8)
    EXITG = mat("NeonExitH", "#69F0AE", 0.3, emit=3.0)
    TV = mat("HospTV", "#111114", 0.35, 0.2)
    RED = mat("HospRed", "#E53935", 0.5)
    SKY = mat("HospSky", "#BFE6FF", 0.9, emit=1.1)
    MAGS = [mat("HospMag%d" % i, c, 0.6) for i, c in enumerate(("#EF5350", "#42A5F5", "#FFCA28", "#66BB6A"))]
    POT = mat("HospPot", "#FFFFFF", 0.5)
    LEAF = mat("HospLeaf", "#2E7D32", 0.8)

    shell(S, W, D, H, FLOOR, WALL, CAP, LIP)
    tiles(S, W, D, 0.8, FLOOR, TILE)
    wainscot(S, W, D, 0.9, WAIN, RAIL)
    for k, x in enumerate((-5, 0, 5)):
        S.box(1.8, 1.0, 0.05, PANEL, x, 0.5, H - 0.03)
        S.light("panel%d" % k, x, 0.5, H - 0.5)

    # reception desk (back centre) with its sign + the NOW SERVING board
    S.box(4.4, 0.8, 1.05, DESK, 0, 2.7, 0.52, bevel=0.03)
    S.box(4.6, 1.0, 0.06, DESKT, 0, 2.75, 1.08, bevel=0.02)
    S.box(4.4, 0.04, 0.2, DESKT, 0, 2.29, 0.85)
    S.box(0.5, 0.4, 0.32, mat("HospMonitor", "#263238", 0.3), -1.1, 3.0, 1.28)
    S.box(0.44, 0.02, 0.26, mat("NeonScreen", "#80DEEA", 0.3, emit=1.2), -1.1, 2.79, 1.29)
    S.box(0.2, 0.25, 0.04, mat("HospPaper", "#FFFFFF", 0.7), 0.6, 2.6, 1.12)
    S.cyl(0.05, 0.05, 0.08, mat("HospBell", "#FFC107", 0.3, 0.8), 1.4, 2.5, 1.15, segs=10)
    S.col("desk", 0, 3.5, 2.35, 1.35)
    S.box(2.8, 0.06, 0.48, SIGN, 0, D / 2 - 0.05, 3.05)
    S.text("RECEPTION", 0.28, SIGNT, 0, D / 2 - 0.1, 3.05, "-Y")
    S.box(1.6, 0.08, 0.5, mat("HospBoard", "#102027", 0.5), 2.6, D / 2 - 0.06, 2.35)
    S.fx("nowserving", 2.6, D / 2 - 0.11, 2.35)
    S.spot("reception", 0, 3.5, 0)
    S.light("lamp", 0, 2.6, 2.6)

    # waiting-room chairs (two rows, left)
    for row, y in enumerate((-0.6, -2.6)):
        S.box(4.6, 0.12, 0.06, METAL, -5.0, y + 0.05, 0.4)
        for k in range(5):
            x = -6.8 + k * 0.9
            S.box(0.62, 0.55, 0.08, CHAIR, x, y, 0.46, bevel=0.03)
            S.box(0.62, 0.08, 0.55, CHAIRD, x, y + 0.3, 0.78, rot=(-0.12, 0, 0), bevel=0.03)
            for s in (-1, 1):
                S.box(0.04, 0.04, 0.42, METAL, x + s * 0.27, y, 0.21)
        S.col("chairs%d" % row, -5.0, y + 0.05, 2.35, 0.38, 0.5)
    S.spot("patient", -6.8 + 0.9, -0.6, 0)     # the chairs face the camera (-Y)
    S.spot("heshy", -6.8 + 3 * 0.9, -2.6, 0)
    # a magazine rack + TV (left of the back wall)
    S.box(1.6, 0.12, 0.95, TV, -5.6, D / 2 - 0.08, 2.65, bevel=0.03)
    S.fx("tv", -5.6, D / 2 - 0.15, 2.65)
    S.box(1.2, 0.35, 0.95, CAB, -5.6, D / 2 - 0.2, 0.48)
    for k, m in enumerate(MAGS):
        S.box(0.25, 0.04, 0.34, m, -6.0 + k * 0.27, D / 2 - 0.4, 1.02, rot=(-0.25, 0, 0.08 * (k - 1.5)))
    S.col("rack", -5.6, D / 2 - 0.2, 0.65, 0.25)
    S.spot("tv", -5.6, D / 2 - 1.2, 0)
    # eye chart on the left wall
    S.box(0.04, 0.9, 1.3, mat("HospChart", "#FFFFFF", 0.7), -W / 2 + 0.04, 1.6, 1.9)
    S.fx("eyechart", -W / 2 + 0.07, 1.6, 1.9, -math.pi / 2)
    # fish tank on a cabinet (back right of the desk)
    S.box(1.6, 0.6, 0.85, CAB, 3.7, D / 2 - 0.45, 0.43)
    S.box(1.5, 0.5, 0.75, WATER, 3.7, D / 2 - 0.45, 1.25)
    S.box(1.56, 0.56, 0.05, mat("HospTankRim", "#263238", 0.4), 3.7, D / 2 - 0.45, 1.64)
    S.box(1.48, 0.48, 0.06, GRAVEL, 3.7, D / 2 - 0.45, 0.9)
    for k in range(4):
        S.cyl(0.03, 0.01, 0.3 + (k % 2) * 0.15, WEED, 3.2 + k * 0.33, D / 2 - 0.4, 1.05 + (k % 2) * 0.07, segs=6)
    S.fx("tank", 3.7, D / 2 - 0.45, 1.25)
    S.col("tank", 3.7, D / 2 - 0.45, 0.85, 0.35)
    S.spot("fish", 3.7, D / 2 - 1.5, 0)
    # vending machine "SNAX" (right of the back wall)
    vx = 6.7
    def vend():
        S.box(1.2, 0.8, 2.1, VEND, vx, D / 2 - 0.5, 1.05, bevel=0.04)
        S.box(0.8, 0.05, 1.3, VGLASS, vx - 0.12, D / 2 - 0.92, 1.25)
        for r in range(4):
            for c in range(3):
                S.box(0.16, 0.08, 0.2, SNACK[(r + c) % len(SNACK)], vx - 0.36 + c * 0.24, D / 2 - 0.95, 0.75 + r * 0.32)
        S.box(0.18, 0.05, 0.6, mat("HospKeypad", "#263238", 0.4), vx + 0.42, D / 2 - 0.92, 1.35)
        S.box(0.7, 0.06, 0.2, mat("HospTray", "#1B1B1B", 0.5), vx - 0.12, D / 2 - 0.92, 0.32)
        S.text("SNAX", 0.2, mat("NeonSnax", "#FFF59D", 0.4, emit=2.0), vx, D / 2 - 0.92, 1.98, "-Y")
    S.mover("VendMachine", vend, (vx, D / 2 - 0.5, 0.0))
    S.col("vend", vx, D / 2 - 0.5, 0.65, 0.45)
    S.spot("vending", vx - 0.1, D / 2 - 1.55, 0)
    S.fx("vend", vx, D / 2 - 0.5, 0.0)
    S.spot("doctor", 4.9, -0.8, -0.35)
    # IV drip stand + a gurney along the right wall
    S.cyl(0.02, 0.02, 1.8, METAL, 3.6, -0.4, 0.9, segs=8)
    S.cyl(0.25, 0.25, 0.03, METAL, 3.6, -0.4, 0.05, segs=5)
    S.box(0.18, 0.08, 0.28, mat("WaterIV", "#B3E5FC", 0.1), 3.6, -0.4, 1.7)
    S.fx("drip", 3.6, -0.4, 1.5)
    S.col("iv", 3.6, -0.4, 0.2, 0.2)
    S.box(0.9, 2.1, 0.12, mat("HospGurney", "#E0F2F1", 0.6), W / 2 - 0.7, 0.2, 0.8)
    S.box(0.92, 2.12, 0.05, METAL, W / 2 - 0.7, 0.2, 0.72)
    for sx in (-1, 1):
        for sy in (-1, 1):
            S.cyl(0.025, 0.025, 0.7, METAL, W / 2 - 0.7 + sx * 0.38, 0.2 + sy * 0.95, 0.36, segs=6)
    S.box(0.6, 0.4, 0.14, mat("HospPillow", "#FFFFFF", 0.8), W / 2 - 0.7, 1.0, 0.92, bevel=0.06)
    S.col("gurney", W / 2 - 0.7, 0.2, 0.5, 1.1)
    # window on the right wall (ambulance lights flash through it)
    cut = Part(S.coll, "hwcut", bm_box(1.0, 1.8, 1.3), None, loc=(W / 2 + 0.15, 2.8, 2.1))
    cut.ob.display_type = "WIRE"
    S.parts[3].cut(cut)
    S.box(0.12, 1.94, 0.1, RAIL, W / 2 - 0.02, 2.8, 2.78)
    S.box(0.2, 1.94, 0.1, RAIL, W / 2 - 0.05, 2.8, 1.43)
    S.box(0.05, 2.6, 2.0, SKY, W / 2 + 0.9, 2.8, 2.2)
    S.box(0.02, 1.8, 1.3, mat("Glass", "#9FD8FF", 0.05), W / 2 + 0.1, 2.8, 2.1)
    S.light("ambulance", W / 2 - 0.6, 2.8, 2.2)
    # exit door (right wall, front)
    door(S, W / 2, -2.9, "-X", DOOR, RAIL, KNOB, SIGN, EXITG, "EXIT")
    S.spot("door", W / 2 - 0.95, -2.9, -math.pi / 2)
    S.spot("lulu", W / 2 - 2.5, -2.9, -math.pi / 2)
    # plants + a water cooler
    plant(S, -W / 2 + 0.5, 3.9, POT, LEAF)
    S.col("plant", -W / 2 + 0.5, 3.9, 0.3, 0.3)
    plant(S, 1.9, -4.2, POT, LEAF, 0.9)
    S.col("plant2", 1.9, -4.2, 0.3, 0.3)
    S.box(0.4, 0.4, 1.0, mat("HospCooler", "#ECEFF1", 0.4), -2.6, D / 2 - 0.3, 0.5)
    S.cyl(0.18, 0.18, 0.45, mat("WaterCooler", "#81D4FA", 0.1), -2.6, D / 2 - 0.3, 1.25, segs=14)
    S.col("cooler", -2.6, D / 2 - 0.3, 0.25, 0.25)
    # a "WASH YOUR HANDS" poster + red cross sign
    S.box(0.6, 0.04, 0.6, mat("HospCrossBg", "#FFFFFF", 0.6), -2.6, D / 2 - 0.03, 2.4)
    S.box(0.4, 0.06, 0.12, RED, -2.6, D / 2 - 0.05, 2.4)
    S.box(0.12, 0.06, 0.4, RED, -2.6, D / 2 - 0.05, 2.4)
    return S.finish()


# ═════════════════════════════════════════════════════════════════════════
#  PRECINCT 18½ — the police station
# ═════════════════════════════════════════════════════════════════════════
def build_police():
    S = SetBuilder("InteriorsPolice")
    W, D, H = 16.0, 10.0, 4.2
    FLOOR = mat("PolFloor", "#9AA7B3", 0.45)
    TILE = mat("PolTile", "#7C8A98", 0.45)
    WALL = mat("PolWall", "#5F82A6", 0.9)
    WAIN = mat("PolWainscot", "#3E5871", 0.6)
    RAIL = mat("PolRail", "#C9D6E2", 0.5)
    CAP = mat("PolCap", "#2F4356", 0.8)
    LIP = mat("PolLip", "#4E5B66", 0.8)
    DESK = mat("PolDesk", "#5D4037", 0.55)
    DESKT = mat("PolDeskTop", "#795548", 0.4)
    METAL = mat("PolMetal", "#CFD8DC", 0.25, 0.8)
    DARKM = mat("PolDarkMetal", "#37474F", 0.4, 0.5)
    BARS = mat("PolBars", "#CFD8DC", 0.2, 0.9)
    CELL = mat("PolCell", "#2E3B47", 0.8)
    COT = mat("PolCot", "#90A4AE", 0.8)
    GOLD = mat("PolGold", "#FFD54F", 0.3, 0.8)
    GOLDT = mat("PolGoldText", "#FFD54F", 0.4, emit=0.8)
    CORK = mat("PolCork", "#C8A165", 0.9)
    PAPER = mat("PolPaper", "#FFF8E1", 0.8)
    PANEL = mat("NeonTube", "#F1F8FF", 0.5, emit=2.4)
    BOOTH = mat("PolBooth", "#5D4037", 0.6)
    CURTAIN = mat("PolCurtain", "#7B1FA2", 0.8)
    COFFEE = mat("PolCoffee", "#37474F", 0.4, 0.4)
    COFFEE2 = mat("PolCoffeeFace", "#546E7A", 0.4, 0.4)
    DOOR = mat("PolDoor", "#455A64", 0.5, 0.3)
    KNOB = mat("PolKnob", "#ECEFF1", 0.2, 0.8)
    EXITR = mat("NeonExitRed", "#FF5252", 0.3, emit=3.0)
    SIGN = mat("PolSign", "#263238", 0.6)
    HALL = mat("PolHall", "#22323F", 0.9)
    RED = mat("PolRed", "#C62828", 0.5)
    NOTES = [mat("PolNote%d" % i, c, 0.8) for i, c in enumerate(("#FFF176", "#F48FB1", "#81D4FA", "#A5D6A7"))]

    shell(S, W, D, H, FLOOR, WALL, CAP, LIP)
    tiles(S, W, D, 0.7, FLOOR, TILE)
    wainscot(S, W, D, 1.1, WAIN, RAIL, gap=(0.9 - 1.0, 0.9 + 1.0))
    for k, x in enumerate((-4.5, 3.5)):
        S.box(2.4, 0.25, 0.08, PANEL, x, 0.0, H - 0.4)
        S.box(2.5, 0.35, 0.05, DARKM, x, 0.0, H - 0.34)
        for s in (-1, 1):
            S.cyl(0.006, 0.006, 0.34, DARKM, x + s * 1.1, 0.0, H - 0.15, segs=5)
        S.light("tube%d" % k, x, 0.0, H - 0.7)

    # back hallway doorway (a second cop crosses behind it)
    cut = Part(S.coll, "hallcut", bm_box(1.8, 1.0, 2.5), None, loc=(0.9, D / 2 + 0.15, 1.25))
    cut.ob.display_type = "WIRE"
    S.parts[1].cut(cut)
    S.box(2.0, 0.1, 0.12, RAIL, 0.9, D / 2 - 0.02, 2.55)
    for s in (-1, 1):
        S.box(0.1, 0.1, 2.55, RAIL, 0.9 + s * 0.95, D / 2 - 0.02, 1.27)
    S.box(3.0, 0.1, 2.6, HALL, 0.9, D / 2 + 1.6, 1.3)
    S.box(3.0, 1.6, 0.05, mat("PolHallFloor", "#56616B", 0.8), 0.9, D / 2 + 0.8, 0.0)
    S.box(0.1, 1.6, 2.6, HALL, 0.9 - 1.5, D / 2 + 0.8, 1.3)
    S.box(0.1, 1.6, 2.6, HALL, 0.9 + 1.5, D / 2 + 0.8, 1.3)
    S.fx("hall", 0.9, D / 2 + 0.85, 0.0)

    # front desk (left of centre) — the donut cop sits behind it
    dx, dy = -3.0, 1.3
    S.box(3.4, 0.9, 1.15, DESK, dx, dy, 0.58, bevel=0.03)
    S.box(3.6, 1.05, 0.07, DESKT, dx, dy, 1.18, bevel=0.02)
    S.box(1.5, 0.04, 0.3, SIGN, dx, dy - 0.47, 0.82)
    S.text("FRONT DESK", 0.15, GOLDT, dx, dy - 0.5, 0.82, "-Y")
    S.cyl(0.08, 0.1, 0.06, GOLD, dx + 1.3, dy - 0.2, 1.25, segs=12)    # the desk bell
    S.sph(0.03, GOLD, dx + 1.3, dy - 0.2, 1.31)
    S.box(0.5, 0.35, 0.25, mat("PolFiles", "#A1887F", 0.8), dx + 0.6, dy + 0.15, 1.33)
    S.mover("Phone", lambda: (S._p(bm_box(0.3, 0.22, 0.12), mat("PolPhone", "#212B33", 0.4), (dx - 1.25, dy - 0.15, 1.28), (0, 0, 0), False),
                              S._p(bm_box(0.34, 0.09, 0.07), mat("PolPhone", "#212B33", 0.4), (dx - 1.25, dy - 0.15, 1.38), (0, 0, 0), False),
                              S._p(bm_cyl(0.07, 0.07, 0.02, 12), DARKM, (dx - 1.25, dy - 0.27, 1.3), (math.pi / 2, 0, 0), False)),
            (dx - 1.25, dy - 0.15, 1.24))
    S.box(0.4, 0.35, 0.05, mat("PolDonutBox", "#F8BBD0", 0.7), dx - 0.4, dy + 0.1, 1.24)
    S.col("desk", dx, dy + 0.6, 1.8, 1.0)
    S.spot("deskcop", dx, dy + 0.95, 0)
    S.spot("desk", dx + 0.4, dy - 1.05, 0)
    # the fines window (the useful bit) at the desk's left end
    S.box(0.9, 0.5, 2.0, mat("PolFineBooth", "#ECEFF1", 0.5), dx - 2.4, dy + 0.2, 1.0, bevel=0.03)
    S.box(0.7, 0.04, 0.6, mat("Glass", "#9FD8FF", 0.05), dx - 2.4, dy - 0.06, 1.45)
    S.box(1.0, 0.04, 0.32, RED, dx - 2.4, dy - 0.07, 2.18)
    S.text("PAY FINES", 0.14, mat("PolWhiteText", "#FFFFFF", 0.4, emit=0.6), dx - 2.4, dy - 0.1, 2.18, "-Y")
    S.col("fines", dx - 2.4, dy + 0.2, 0.5, 0.3)
    S.spot("fines", dx - 2.4, dy - 0.85, 0)

    # confession booth (back left corner)
    cbx, cby = -6.6, D / 2 - 0.7
    S.box(1.3, 1.1, 2.4, BOOTH, cbx, cby, 1.2, bevel=0.03)
    S.box(1.1, 0.04, 1.0, mat("PolLattice", "#3E2723", 0.7), cbx, cby - 0.56, 1.75)
    for k in range(5):
        S.box(0.03, 0.05, 1.0, BOOTH, cbx - 0.44 + k * 0.22, cby - 0.58, 1.75)
        S.box(1.1, 0.05, 0.03, BOOTH, cbx, cby - 0.58, 1.3 + k * 0.22)
    S.box(1.1, 0.04, 1.1, CURTAIN, cbx, cby - 0.57, 0.6)
    S.box(1.3, 0.06, 0.24, SIGN, cbx, cby - 0.56, 2.55)
    S.text("CONFESS", 0.15, GOLDT, cbx, cby - 0.6, 2.55, "-Y")
    S.col("confess", cbx, cby, 0.7, 0.6)
    S.spot("confess", cbx + 0.3, cby - 1.35, 0)
    # coffee machine (back wall, left of the hallway)
    cfx = -1.7
    S.box(0.7, 0.55, 1.5, COFFEE, cfx, D / 2 - 0.3, 0.75, bevel=0.04)
    S.box(0.55, 0.05, 0.6, COFFEE2, cfx, D / 2 - 0.59, 1.15)
    S.box(0.2, 0.08, 0.1, DARKM, cfx, D / 2 - 0.6, 0.78)
    S.cyl(0.06, 0.05, 0.12, mat("PolCup", "#FFFFFF", 0.6), cfx, D / 2 - 0.6, 0.64, segs=10)
    S.sph(0.04, mat("NeonCoffeeA", "#FFB300", 0.3, emit=2.0), cfx - 0.15, D / 2 - 0.6, 0.45)
    S.sph(0.04, mat("NeonCoffeeB", "#43A047", 0.3, emit=2.0), cfx + 0.15, D / 2 - 0.6, 0.45)
    S.col("coffee", cfx, D / 2 - 0.3, 0.4, 0.35)
    S.spot("coffee", cfx, D / 2 - 1.3, 0)
    S.fx("steam", cfx, D / 2 - 0.6, 0.75)
    # ceiling fan (centre)
    fx_, fy_ = 0.4, 0.2
    S.cyl(0.02, 0.02, 0.55, DARKM, fx_, fy_, H - 0.28, segs=6)
    S.cyl(0.14, 0.12, 0.16, DARKM, fx_, fy_, H - 0.6, segs=14)
    S.mover("FanBlades", lambda: [S._p(bm_box(1.1, 0.18, 0.02), mat("PolFanBlade", "#8D6E63", 0.6),
                                       (fx_ + math.cos(a) * 0.62, fy_ + math.sin(a) * 0.62, H - 0.66), (0, 0, a), False)
                                  for a in (0, math.pi / 2, math.pi, 3 * math.pi / 2)] +
            [S._p(bm_box(0.24, 0.12, 0.04), mat("PolFanBlade", "#8D6E63", 0.6), (fx_ + 0.95, fy_ + 0.05, H - 0.64), (0, 0, 0.3), False)],
            (fx_, fy_, H - 0.66))
    S.spot("fan", fx_, fy_ - 0.2, 0)
    # holding cell (back right): walls, cot, bars as a separate mover (they rattle)
    cx0, cx1, cy0 = 2.4, 6.0, 2.2
    S.box(0.15, D / 2 - cy0, 2.8, CELL, cx0, (cy0 + D / 2) / 2, 1.4)
    S.box(cx1 - cx0, 0.05, 2.8, CELL, (cx0 + cx1) / 2, D / 2 - 0.03, 1.4)
    S.box(0.15, D / 2 - cy0, 2.8, CELL, cx1, (cy0 + D / 2) / 2, 1.4)
    S.box(cx1 - cx0 + 0.15, D / 2 - cy0, 0.1, CELL, (cx0 + cx1) / 2, (cy0 + D / 2) / 2, 2.85)
    S.box(1.6, 0.7, 0.1, COT, cx0 + 1.0, D / 2 - 0.5, 0.5)
    S.box(1.6, 0.7, 0.06, mat("PolBlanket", "#5C6BC0", 0.9), cx0 + 1.0, D / 2 - 0.5, 0.58)
    for sx in (-1, 1):
        S.box(0.05, 0.7, 0.45, DARKM, cx0 + 1.0 + sx * 0.75, D / 2 - 0.5, 0.25)
    S.box(0.45, 0.4, 0.4, mat("PolToilet", "#ECEFF1", 0.4), cx1 - 0.45, D / 2 - 0.4, 0.2, bevel=0.06)
    S.mover("CellBars", lambda: [S._p(bm_cyl(0.035, 0.035, 2.7, 8), BARS, (cx0 + 0.15 + k * 0.3, cy0, 1.35), (0, 0, 0), True)
                                 for k in range(12)] +
            [S._p(bm_box(cx1 - cx0, 0.08, 0.1), BARS, ((cx0 + cx1) / 2, cy0, 2.72), (0, 0, 0), False),
             S._p(bm_box(cx1 - cx0, 0.08, 0.08), BARS, ((cx0 + cx1) / 2, cy0, 1.3), (0, 0, 0), False),
             S._p(bm_box(cx1 - cx0, 0.08, 0.1), BARS, ((cx0 + cx1) / 2, cy0, 0.05), (0, 0, 0), False)],
            ((cx0 + cx1) / 2, cy0, 0))
    S.box(1.4, 0.06, 0.24, SIGN, (cx0 + cx1) / 2, cy0 - 0.06, 3.0)
    S.text("HOLDING", 0.15, GOLDT, (cx0 + cx1) / 2, cy0 - 0.1, 3.0, "-Y")
    S.col("cell", (cx0 + cx1) / 2, (cy0 + D / 2) / 2 + 0.05, (cx1 - cx0) / 2 + 0.1, (D / 2 - cy0) / 2 + 0.12)
    S.spot("perp", (cx0 + cx1) / 2, D / 2 - 1.3, 0)
    S.spot("cell", (cx0 + cx1) / 2, cy0 - 0.95, 0)
    # MOST WANTED board (right wall)
    S.box(0.06, 2.4, 1.7, CORK, W / 2 - 0.04, 0.3, 2.0)
    S.box(0.08, 2.5, 0.08, DESK, W / 2 - 0.05, 0.3, 2.88)
    S.box(0.08, 2.5, 0.08, DESK, W / 2 - 0.05, 0.3, 1.12)
    S.fx("wanted", W / 2 - 0.09, 0.3, 2.0, math.pi / 2)
    S.spot("board", W / 2 - 1.2, 0.3, -math.pi / 2)
    # wall decor: precinct seal, clock, officer of the month, cork board, poster
    S.cyl(0.42, 0.42, 0.05, mat("PolSeal", "#1A237E", 0.5), -4.5, D / 2 - 0.03, 3.25, segs=24, axis="Y")
    S.tor(0.42, 0.04, GOLD, -4.5, D / 2 - 0.06, 3.25, rot=(math.pi / 2, 0, 0), seg=24)
    S._p(bm_prism([(0, 0.25), (-0.07, 0.07), (-0.24, 0.07), (-0.1, -0.05), (-0.15, -0.23), (0, -0.12), (0.15, -0.23), (0.1, -0.05), (0.24, 0.07), (0.07, 0.07)], 0.02),
         GOLD, (-4.5, D / 2 - 0.08, 3.25), (math.pi / 2, 0, 0), False)
    S.cyl(0.3, 0.3, 0.06, mat("PolClock", "#FAFAFA", 0.5), -2.9, D / 2 - 0.04, 3.3, segs=20, axis="Y")
    S.tor(0.3, 0.03, DARKM, -2.9, D / 2 - 0.06, 3.3, rot=(math.pi / 2, 0, 0), seg=20)
    S.box(0.02, 0.02, 0.2, DARKM, -2.9, D / 2 - 0.09, 3.38)
    S.box(0.15, 0.02, 0.02, DARKM, -2.84, D / 2 - 0.09, 3.3)
    S.fx("officer", 2.0 + 0.4, D / 2 - 0.05, 3.25)
    S.fx("poster", -4.3, D / 2 - 0.05, 1.85)
    S.box(1.2, 0.04, 0.8, CORK, -0.4 - 1.2, D / 2 - 0.02, 2.75)
    for k in range(5):
        S.box(0.22, 0.02, 0.22, NOTES[k % 4], -2.0 + (k % 3) * 0.33, D / 2 - 0.05, 2.9 - (k // 3) * 0.32, rot=(0, (k - 2) * 0.12, 0))
    # exit door (right wall, front)
    door(S, W / 2, -2.8, "-X", DOOR, RAIL, KNOB, SIGN, EXITR, "EXIT")
    S.spot("door", W / 2 - 0.95, -2.8, -math.pi / 2)
    S.spot("lulu", W / 2 - 2.5, -2.8, -math.pi / 2)
    # benches + a water cooler + filing cabinets
    S.box(2.4, 0.5, 0.08, mat("PolBench", "#8D6E63", 0.6), -4.0, -3.6, 0.48)
    for s in (-1, 1):
        S.box(0.06, 0.45, 0.46, DARKM, -4.0 + s * 1.1, -3.6, 0.23)
    S.col("bench", -4.0, -3.6, 1.25, 0.3, 0.4)
    for k in range(2):
        S.box(0.6, 0.6, 1.4, mat("PolFiler", "#78909C", 0.4, 0.4), -W / 2 + 0.4, -0.6 + k * 0.65, 0.7, bevel=0.02)
        for d in range(3):
            S.box(0.04, 0.4, 0.04, METAL, -W / 2 + 0.72, -0.6 + k * 0.65, 0.3 + d * 0.42)
    S.col("filers", -W / 2 + 0.4, -0.28, 0.35, 0.7)
    S.cyl(0.18, 0.18, 0.45, mat("WaterCoolerP", "#81D4FA", 0.1), -W / 2 + 0.4, -2.2, 1.25, segs=14)
    S.box(0.4, 0.4, 1.0, mat("PolCooler", "#ECEFF1", 0.4), -W / 2 + 0.4, -2.2, 0.5)
    S.col("cooler", -W / 2 + 0.4, -2.2, 0.25, 0.25)
    S.fx("alarm", -W / 2 + 0.05, 2.6, 1.8, -math.pi / 2)
    S.box(0.06, 0.34, 0.45, RED, -W / 2 + 0.04, 2.6, 1.8)
    S.sph(0.1, mat("PolAlarmBell", "#FFEB3B", 0.3, 0.7), -W / 2 + 0.15, 2.6, 2.15)
    S.light("alarm", -W / 2 + 0.8, 2.6, 2.4)
    return S.finish()


# ═════════════════════════════════════════════════════════════════════════
#  SHTRAND-BY-THE-SEA — the beach boardwalk
# ═════════════════════════════════════════════════════════════════════════
def build_beach():
    S = SetBuilder("InteriorsBeach")
    SAND = mat("BchSand", "#F7DFA6", 0.95)
    SAND2 = mat("BchDune", "#EBCB86", 0.95)
    WET = mat("BchWetSand", "#D9B979", 0.6)
    PLANK = mat("BchPlank", "#B98552", 0.75)
    PLANKD = mat("BchPlankDark", "#8D5F37", 0.8)
    RAILW = mat("BchRail", "#F5F0E6", 0.6)
    TOWER = mat("BchTower", "#FFFFFF", 0.6)
    TRED = mat("BchRed", "#E53935", 0.5)
    STRIPE1 = mat("BchStripePink", "#FF80AB", 0.6)
    STRIPE2 = mat("BchStripeWhite", "#FFFFFF", 0.6)
    STAND = mat("BchStand", "#4FC3F7", 0.5)
    SIGNT = mat("BchSignText", "#5D4037", 0.5)
    SUN = mat("NeonSun", "#FFF59D", 0.5, emit=3.0)
    SHELL = mat("BchShell", "#FFCCBC", 0.6)
    STAR = mat("BchStarfish", "#FF8A65", 0.6)
    TOWEL1 = mat("BchTowelA", "#42A5F5", 0.9)
    TOWEL2 = mat("BchTowelB", "#FFEB3B", 0.9)
    UMB = [mat("BchUmb%d" % i, c, 0.6) for i, c in enumerate(("#FF5252", "#FFEB3B", "#40C4FF", "#69F0AE"))]
    POLE = mat("BchPole", "#ECEFF1", 0.4, 0.3)
    CABANA = mat("BchCabana", "#26A69A", 0.7)
    GRASS = mat("BchGrass", "#9CCC65", 0.8)
    LOUNGE = mat("BchLounge", "#FFFFFF", 0.6)

    # the sand (gently sloping toward the water) + dunes behind the boardwalk
    S.box(44, 16, 0.2, SAND, 0, -2.0, -0.1)
    S._p(bm_prism([(-1.5, 0), (-1.5, -0.5), (2.0, -0.6), (2.0, -0.35)], 22), WET, (0, 6.0 + 1.5, 0.0), (0, 0, 0), False)
    S.box(44, 0.4, 0.6, mat("BchLip", "#C9A86A", 0.9), 0, -10.2, -0.3)
    for k, (x, y, r) in enumerate(((-19.5, -3.0, 2.6), (-19.0, 2.0, 2.0), (19.0, -2.5, 2.4), (19.5, 2.5, 2.8))):
        S.sph(r, SAND2, x, y, -r * 0.55, ry=r * 0.7, rz=r * 0.7)
        for g in range(4):
            S.cyl(0.03, 0.005, 0.5, GRASS, x - 0.8 + g * 0.5, y + 0.3, r * 0.1 + 0.35, segs=4)
    # the boardwalk along the front (Lulu arrives here)
    for k in range(-21, 22):
        S.box(0.9, 3.0, 0.1, PLANK if k % 2 else PLANKD, k * 0.95, -7.6, 0.05)
    for k in range(-11, 12):
        S.box(0.1, 0.1, 1.0, RAILW, k * 1.9, -9.0, 0.6)
    S.box(40, 0.1, 0.1, RAILW, 0, -9.0, 1.1)
    S.box(40, 0.08, 0.08, RAILW, 0, -9.0, 0.7)
    S.col("rail", 0, -9.25, 22, 0.2)
    # boardwalk arch (the way back out)
    ax = -13.0
    for s in (-1, 1):
        S.box(0.3, 0.3, 3.4, RAILW, ax + s * 1.6, -7.2, 2.05)
        S.col("arch%d" % (s + 1), ax + s * 1.6, -7.2, 0.2, 0.2)
    S.box(3.8, 0.3, 0.7, mat("BchArch", "#0288D1", 0.5), ax, -7.2, 3.6)
    S.text("BOARDWALK", 0.32, mat("BchArchText", "#FFFFFF", 0.4, emit=0.5), ax, -7.38, 3.6, "-Y")
    S.spot("door", ax, -7.6, 0)
    S.spot("lulu", ax + 1.5, -6.6, -0.6)

    # ice cream stand (striped awning)
    ix, iy = -5.5, -3.0
    S.box(2.4, 1.2, 1.1, STAND, ix, iy, 0.55, bevel=0.04)
    S.box(2.5, 1.3, 0.08, STRIPE2, ix, iy, 1.12)
    for k in range(6):
        S.box(2.6 / 6, 1.6, 0.06, STRIPE1 if k % 2 else STRIPE2, ix - 1.3 + 2.6 / 6 * (k + 0.5), iy + 0.1, 2.5, rot=(-0.22, 0, 0))
    for s in (-1, 1):
        S.cyl(0.04, 0.04, 1.5, POLE, ix + s * 1.15, iy + 0.5, 1.8, segs=8)
    S.box(2.0, 0.06, 0.36, mat("BchStandSign", "#FFF8E1", 0.6), ix, iy - 0.62, 0.78)
    S.text("ICE CREAM", 0.22, SIGNT, ix, iy - 0.66, 0.78, "-Y")
    for k, c in enumerate(("#F8BBD0", "#FFF59D", "#C5E1A5", "#8D6E63")):
        S.sph(0.14, mat("BchScoop%d" % k, c, 0.6), ix - 0.7 + k * 0.45, iy - 0.2, 1.24)
    S.col("stand", ix, iy, 1.25, 0.65)
    S.spot("icecream", ix, iy - 1.4, 0)
    S.spot("vendor", ix, iy + 0.85, math.pi * 0)
    # lifeguard tower
    lx, ly = 5.2, 1.6
    for sx in (-1, 1):
        for sy in (-1, 1):
            S.limb((lx + sx * 0.9, ly + sy * 0.9, 0), (lx + sx * 0.6, ly + sy * 0.6, 2.2), 0.08, TOWER)
    S.box(1.8, 1.8, 0.12, TOWER, lx, ly, 2.25)
    S.box(1.6, 1.4, 1.2, TRED, lx, ly + 0.15, 2.9)
    S.box(1.9, 1.7, 0.12, TOWER, lx, ly + 0.15, 3.55)
    S.box(1.0, 0.05, 0.5, mat("Glass", "#9FD8FF", 0.05), lx, ly - 0.56, 3.0)
    S.box(0.45, 0.06, 0.12, TOWER, lx, ly - 0.57, 2.55)
    S.box(0.12, 0.06, 0.45, TOWER, lx, ly - 0.57, 2.55)
    for k in range(6):
        S.box(0.7, 0.08, 0.05, TOWER, lx, ly - 1.2 - k * 0.15, 0.3 + k * 0.33, rot=(0.6, 0, 0))
    S.col("tower", lx, ly, 1.0, 1.0)
    S.spot("lifeguard", lx + 0.2, ly - 0.55, 0, 2.31)
    S.spot("lifeguardTalk", lx, ly - 2.1, 0)
    # sandcastle (pieces revealed one by one as Lulu helps build it)
    cx, cy = -10.5, 0.4
    S.box(1.6, 1.6, 0.35, SAND2, cx, cy, 0.17, bevel=0.05)
    for k, (x, y) in enumerate(((-0.6, -0.6), (0.6, -0.6), (-0.6, 0.6), (0.6, 0.6))):
        S.mover("Castle_%d" % (k + 1), lambda x=x, y=y: (S._p(bm_cyl(0.22, 0.26, 0.6, 12), SAND2, (cx + x, cy + y, 0.6), (0, 0, 0), True),
                                                         S._p(bm_cyl(0.27, 0.27, 0.08, 12), SAND2, (cx + x, cy + y, 0.92), (0, 0, 0), True)),
                (cx + x, cy + y, 0.3))
    S.mover("Castle_5", lambda: (S._p(bm_box(0.9, 0.9, 0.7), SAND2, (cx, cy, 0.7), (0, 0, 0), False),
                                 S._p(bm_cyl(0.3, 0.32, 0.6, 12), SAND2, (cx, cy, 1.3), (0, 0, 0), True),
                                 S._p(bm_cyl(0.02, 0.02, 0.5, 5), POLE, (cx, cy, 1.85), (0, 0, 0), False),
                                 S._p(bm_box(0.02, 0.25, 0.15), TRED, (cx, cy - 0.13, 2.0), (0, 0, 0), False)),
            (cx, cy, 0.35))
    S.tor(1.1, 0.06, mat("WaterMoat", "#4FC3F7", 0.1), cx, cy, 0.02, seg=24, rseg=5)
    S.cyl(0.18, 0.14, 0.25, mat("BchBucket", "#E91E63", 0.5), cx + 1.4, cy - 0.6, 0.12, segs=10)
    S.limb((cx + 1.2, cy - 1.0, 0.02), (cx + 1.5, cy - 1.3, 0.25), 0.02, mat("BchShovel", "#FFEB3B", 0.5))
    S.col("castle", cx, cy, 0.9, 0.9, 0.5)
    S.spot("castle", cx + 0.4, cy - 1.6, 0)
    S.spot("kid1", cx - 1.15, cy - 0.5, -1.2)
    S.spot("kid2", cx + 1.1, cy + 0.6, 2.2)
    # umbrellas, towels, a sunbather
    for k, (x, y, rz) in enumerate(((-1.5, 1.8, 0.2), (9.6, -1.2, -0.3), (-14.8, -2.5, 0.5))):
        S.cyl(0.03, 0.03, 2.3, POLE, x, y, 1.15, segs=8, rot=(0.08, 0, 0))
        for p in range(8):
            a = p * math.pi / 4
            S._p(bm_wedge(1.25, 0.4, a, a + math.pi / 4), UMB[k % 4] if p % 2 else STRIPE2, (x + 0.09, y, 2.1), (0, 0, 0), False)
        S.col("umb%d" % k, x, y, 0.12, 0.12)
    S.box(1.0, 1.9, 0.02, TOWEL1, 10.6, -1.8, 0.01, rot=(0, 0, 0.15))
    S.box(1.0, 1.9, 0.02, TOWEL2, -2.6, 0.8, 0.01, rot=(0, 0, -0.2))
    S.spot("sunbather", 10.6, -1.8, 0.15)
    for k, (x, y) in enumerate(((2.5, -3.6), (-8.2, -4.2), (13.5, 1.5), (-3.8, 3.2), (8.0, 3.6))):
        S.sph(0.08, SHELL, x, y, 0.03, rz=0.04)
    S._p(bm_prism([(0, 0.18), (-0.05, 0.05), (-0.17, 0.05), (-0.07, -0.03), (-0.11, -0.16), (0, -0.08), (0.11, -0.16), (0.07, -0.03), (0.17, 0.05), (0.05, 0.05)], 0.015),
         STAR, (1.2, -2.0, 0.015), (0, 0, 0.4), False)
    # cabana + lounge chair (rest & heal)
    kx, ky = 12.6, -4.0
    for sx in (-1, 1):
        for sy in (-1, 1):
            S.cyl(0.05, 0.05, 2.5, POLE, kx + sx * 1.1, ky + sy * 0.9, 1.25, segs=8)
    S._p(bm_prism([(-1.1, 0), (1.1, 0), (0, 0.7)], 1.25), CABANA, (kx, ky, 2.5), (0, 0, math.pi / 2), True)
    for s in (-1, 1):
        S.box(0.06, 1.8, 1.9, CABANA, kx + s * 1.12, ky + 0.0, 1.5)
    S.box(0.7, 1.9, 0.08, LOUNGE, kx, ky, 0.42)
    S.box(0.7, 0.6, 0.08, LOUNGE, kx, ky + 1.05, 0.65, rot=(0.7, 0, 0))
    for sx in (-1, 1):
        for sy in (-1, 1):
            S.box(0.04, 0.04, 0.4, POLE, kx + sx * 0.3, ky + sy * 0.85, 0.2)
    S.box(1.3, 0.05, 0.4, mat("BchCabanaSign", "#FFFFFF", 0.6), kx, ky - 0.95, 2.1)
    S.text("CABANA", 0.2, mat("BchCabanaText", "#00796B", 0.5), kx, ky - 0.99, 2.1, "-Y")
    S.col("cabana", kx, ky, 0.5, 1.0)
    S.spot("cabana", kx, ky - 1.6, 0)
    S.spot("lounge", kx, ky + 0.1, math.pi)
    # the sun (far away, glowing) + spots the game uses
    S.sph(5.0, SUN, 24, 90, 26)
    S.fx("sea", 0, 7.5, 0.0)
    S.spot("gull", 0.3, -0.6, 0.4)
    S.spot("heshy", 9.2, 11.5, 0)
    S.spot("heshyTalk", 9.2, 6.2, 0)
    S.spot("ball", 2.2, -1.8, 0)
    S.spot("kite", -2.5, 7.0, 0, 9.0)
    return S.finish()


# ═════════════════════════════════════════════════════════════════════════
#  PROPS the game clones (one file, one Prop_<name> sub-root each)
# ═════════════════════════════════════════════════════════════════════════
def build_props():
    coll = scene_coll("InteriorsProps")
    root = root_empty(coll, "InteriorsProps")
    props = []

    def prop(name):
        e = bpy.data.objects.new("Prop_" + name, None)
        coll.objects.link(e)
        e.parent = root
        props.append(e)
        return e

    def P(bm, m, loc, rot=(0, 0, 0), smooth=True):
        return Part(coll, "pp", bm, m, loc=loc, rot=rot, smooth=smooth)

    WHITE = mat("PropWhite", "#FAFAFA", 0.6)
    GREY = mat("PropGrey", "#B0BEC5", 0.6)
    ORANGE = mat("PropOrange", "#FFB300", 0.5)
    BLACK = mat("PropBlack", "#1B1B1B", 0.4)

    # seagull (wings flap: Wing_L / Wing_R pivot at the shoulder)
    g = prop("Gull")
    bake([P(bm_sphere(0.16, 0.3, 0.14), WHITE, (0, 0, 0.32)),
          P(bm_sphere(0.1), WHITE, (0, -0.27, 0.45)),
          P(bm_cyl(0.035, 0.0, 0.14, 8, "Y"), ORANGE, (0, -0.42, 0.44)),
          P(bm_sphere(0.022), BLACK, (0.06, -0.33, 0.48)),
          P(bm_sphere(0.022), BLACK, (-0.06, -0.33, 0.48)),
          P(bm_cyl(0.06, 0.0, 0.2, 6, "Y"), GREY, (0, 0.32, 0.34)),
          P(bm_cyl(0.012, 0.012, 0.2, 5), ORANGE, (0.06, 0, 0.1)),
          P(bm_cyl(0.012, 0.012, 0.2, 5), ORANGE, (-0.06, 0, 0.1))], "Gull_body", coll, parent=g)
    for nm, s in (("Wing_L", 1), ("Wing_R", -1)):
        w = bake([P(bm_box(0.42, 0.22, 0.03), GREY, (s * 0.3, 0.02, 0.38), smooth=False),
                  P(bm_box(0.14, 0.18, 0.031), BLACK, (s * 0.48, 0.03, 0.38), smooth=False)], nm, coll)
        w.data.transform(Matrix.Translation((-s * 0.12, 0, -0.38)))
        w.location = (s * 0.12, 0, 0.38)
        w.parent = g

    # K9 (police dog)
    k9 = prop("K9")
    BROWN = mat("PropDog", "#6D4C41", 0.8)
    DARKB = mat("PropDogDark", "#3E2723", 0.8)
    bake([P(bm_sphere(0.2, 0.36, 0.18), BROWN, (0, 0, 0.42)),
          P(bm_sphere(0.15), BROWN, (0, -0.4, 0.58)),
          P(bm_sphere(0.08, 0.12, 0.07), DARKB, (0, -0.55, 0.53)),
          P(bm_sphere(0.03), BLACK, (0, -0.66, 0.56)),
          P(bm_sphere(0.05, 0.03, 0.1), DARKB, (0.1, -0.38, 0.72)),
          P(bm_sphere(0.05, 0.03, 0.1), DARKB, (-0.1, -0.38, 0.72)),
          P(bm_sphere(0.02), BLACK, (0.06, -0.52, 0.64)),
          P(bm_sphere(0.02), BLACK, (-0.06, -0.52, 0.64)),
          P(bm_cyl(0.16, 0.16, 0.04, 12), mat("PropVest", "#1A237E", 0.6), (0, 0.0, 0.5), (math.pi / 2, 0, 0))] +
         [P(bm_cyl(0.045, 0.04, 0.34, 8), BROWN, (sx * 0.1, sy * 0.22, 0.17)) for sx in (-1, 1) for sy in (-1, 1)],
         "K9_body", coll, parent=k9)
    tail = bake([P(bm_cyl(0.03, 0.015, 0.28, 6), BROWN, (0, 0.46, 0.6), (0.6, 0, 0))], "Tail", coll)
    tail.data.transform(Matrix.Translation((0, -0.36, -0.52)))
    tail.location = (0, 0.36, 0.52)
    tail.parent = k9

    # handheld bits (origin = where the hand holds it)
    c = prop("Cone")
    bake([P(bm_cyl(0.05, 0.0, 0.16, 10), mat("PropCone", "#D7A15A", 0.8), (0, 0, -0.06), (math.pi, 0, 0)),
          P(bm_sphere(0.065), mat("PropScoop", "#F8BBD0", 0.6), (0, 0, 0.05)),
          P(bm_sphere(0.05), mat("PropScoop2", "#8D6E63", 0.6), (0, 0, 0.13))], "Cone_body", coll, parent=c)
    d = prop("Donut")
    bake([P(bm_torus(0.06, 0.03, 14, 7), mat("PropDough", "#E8A05A", 0.7), (0, 0, 0)),
          P(bm_torus(0.06, 0.031, 14, 7), mat("PropFrosting", "#F06292", 0.5), (0, 0, 0.008))], "Donut_body", coll, parent=d)
    c = prop("Cup")
    bake([P(bm_cyl(0.045, 0.038, 0.11, 12), WHITE, (0, 0, 0)),
          P(bm_cyl(0.04, 0.04, 0.005, 12), mat("PropCoffee", "#4E342E", 0.3), (0, 0, 0.05)),
          P(bm_torus(0.025, 0.008, 10, 4), WHITE, (0.05, 0, 0), (math.pi / 2, 0, 0))], "Cup_body", coll, parent=c)
    s = prop("Seltzer")
    bake([P(bm_cyl(0.045, 0.04, 0.14, 12), mat("Glass", "#9FD8FF", 0.05), (0, 0, 0)),
          P(bm_cyl(0.038, 0.034, 0.1, 12), mat("PropSoda", "#E1F5FE", 0.2), (0, 0, -0.015)),
          P(bm_cyl(0.006, 0.006, 0.2, 5), mat("PropStraw", "#FF4081", 0.5), (0.015, 0, 0.06), (0, 0.2, 0)),
          P(bm_sphere(0.02, 0.02, 0.006), mat("PropLime", "#8BC34A", 0.5), (-0.04, 0, 0.07))], "Seltzer_body", coll, parent=s)
    b = prop("Beer")
    bake([P(bm_cyl(0.05, 0.05, 0.15, 12), mat("PropBeer", "#FFB300", 0.15), (0, 0, 0)),
          P(bm_cyl(0.052, 0.052, 0.04, 12), mat("PropFoam", "#FFFDE7", 0.8), (0, 0, 0.09)),
          P(bm_torus(0.035, 0.01, 10, 4), mat("PropBeer", "#FFB300", 0.15), (0.06, 0, 0), (math.pi / 2, 0, 0))], "Beer_body", coll, parent=b)
    sn = prop("Snack")
    bake([P(bm_box(0.16, 0.06, 0.22), mat("PropSnack", "#FFCA28", 0.5), (0, 0, 0)),
          P(bm_box(0.17, 0.065, 0.03), mat("PropSnackBand", "#E53935", 0.5), (0, 0, 0.09), smooth=False)], "Snack_body", coll, parent=sn)
    m = prop("Mop")
    bake([P(bm_cyl(0.018, 0.018, 1.4, 6), mat("PropMopStick", "#8D6E63", 0.7), (0, 0, -0.1)),
          P(bm_cyl(0.13, 0.16, 0.18, 10), mat("PropMopHead", "#FFE082", 0.9), (0, 0, -0.85))], "Mop_body", coll, parent=m)
    pl = prop("Plane")
    bake([P(bm_poly([(0, -0.18, 0), (-0.1, 0.12, 0.025), (0.1, 0.12, 0.025), (0, 0.12, -0.04), (0, 0.12, 0.0)],
                    [(0, 1, 4), (0, 4, 2), (0, 3, 1), (0, 2, 3)]), WHITE, (0, 0, 0), smooth=False)], "Plane_body", coll, parent=pl)
    bl = prop("Ball")
    BC = [mat("PropBallR", "#FF5252", 0.4), mat("PropBallW", "#FFFFFF", 0.4), mat("PropBallB", "#40C4FF", 0.4), mat("PropBallY", "#FFEB3B", 0.4)]
    parts = []
    for k in range(6):
        bm = bm_sphere(0.3, u=24, v=14)
        a0, a1 = k * math.pi / 3, (k + 1) * math.pi / 3
        kill = [v for v in bm.verts if not (a0 - 0.01 <= (math.atan2(v.co.y, v.co.x) % (2 * math.pi)) <= a1 + 0.01)]
        bmesh.ops.delete(bm, geom=kill, context="VERTS")
        parts.append(P(bm, BC[k % 4], (0, 0, 0)))
    parts.append(P(bm_sphere(0.06, 0.06, 0.02), BC[1], (0, 0, 0.29)))
    parts.append(P(bm_sphere(0.06, 0.06, 0.02), BC[1], (0, 0, -0.29)))
    bake(parts, "Ball_body", coll, parent=bl)
    cl = prop("Clipboard")
    bake([P(bm_box(0.22, 0.015, 0.3), mat("PropBoard", "#8D6E63", 0.7), (0, 0, 0), smooth=False),
          P(bm_box(0.18, 0.017, 0.24), WHITE, (0, -0.002, -0.01), smooth=False),
          P(bm_box(0.08, 0.02, 0.03), GREY, (0, -0.004, 0.14), smooth=False)], "Clipboard_body", coll, parent=cl)
    bi = prop("Binoculars")
    bake([P(bm_cyl(0.035, 0.035, 0.12, 10, "Y"), BLACK, (0.045, 0, 0)),
          P(bm_cyl(0.035, 0.035, 0.12, 10, "Y"), BLACK, (-0.045, 0, 0)),
          P(bm_box(0.05, 0.04, 0.03), GREY, (0, 0, 0), smooth=False)], "Binoculars_body", coll, parent=bi)
    f = prop("Fish")
    bake([P(bm_sphere(0.05, 0.09, 0.04), mat("PropFish", "#FF7043", 0.4), (0, 0, 0)),
          P(bm_prism([(0.08, 0), (0.15, 0.05), (0.15, -0.05)], 0.006), mat("PropFish", "#FF7043", 0.4), (0, 0, 0), (0, 0, math.pi / 2), False),
          P(bm_sphere(0.012), BLACK, (0.03, -0.06, 0.012)),
          P(bm_sphere(0.012), BLACK, (-0.03, -0.06, 0.012))], "Fish_body", coll, parent=f)
    sl = prop("Sling")
    bake([P(bm_cyl(0.075, 0.07, 0.3, 10), WHITE, (0, 0, -0.25)),
          P(bm_torus(0.16, 0.02, 14, 4), mat("PropSlingStrap", "#90CAF9", 0.7), (0.12, 0, 0.05), (0, 0.6, 0))], "Sling_body", coll, parent=sl)
    wh = prop("Whistle")
    bake([P(bm_cyl(0.02, 0.02, 0.06, 8, "Y"), mat("PropWhistle", "#FFD54F", 0.3, 0.8), (0, 0, 0)),
          P(bm_torus(0.12, 0.006, 14, 3), mat("PropLanyard", "#E53935", 0.6), (0, 0.02, 0.12), (1.3, 0, 0))], "Whistle_body", coll, parent=wh)
    gl = prop("Glass")
    bake([P(bm_cyl(0.04, 0.035, 0.12, 12), mat("PropShot", "#FFE082", 0.15), (0, 0, 0))], "Glass_body", coll, parent=gl)

    # spread the props out in the .blend (children follow their Prop_ root)
    for i, e in enumerate(props):
        e.location = (i * 1.2, 0, 0)
    return coll


# ═════════════════════════════════════════════════════════════════════════
#  THE NEW CHARACTERS (one person per asset)
# ═════════════════════════════════════════════════════════════════════════
def _body_of(coll):
    for o in coll.objects:
        if o.name.startswith("Body") and o.type == "MESH":
            return o
    return None


def _accessorize(coll, parts_fn):
    """Bake extra Parts onto the person's Body so they bob/sit with it."""
    body = _body_of(coll)
    parts = parts_fn(coll)
    acc = bake(parts, "Acc", coll)
    acc.parent = body
    return coll


def build_bartender():
    # Sol: bald, big mustache, white shirt + burgundy vest, a little belly.
    coll = build_person("InteriorsBartender", dict(hair="bald", skin="#F1C9A5", top="#FFFFFF", sleeves="short",
                        bottom="pants", bottom_color="#3E2723", shoes="#1B1B1B", width=1.12, height=1.68,
                        extras=["mustache", "vest", "belly", "bowtie"],
                        extra_colors={"Beard": "#4E342E", "Vest": "#8E1E3C", "Tie": "#1B1B1B"}))
    k = 1.68 / 1.62
    def side_hair(coll):
        hm = mat("SolHair", "#5D4037", 0.85)
        return [Part(coll, "sh", bm_sphere(0.07 * k, 0.12 * k, 0.07 * k), hm, loc=(s * 0.17 * k, 0.02, 1.53 * k)) for s in (-1, 1)] + \
               [Part(coll, "towel", bm_box(0.08 * k, 0.03, 0.3 * k), mat("SolTowel", "#FFFFFF", 0.9), loc=(0.2 * k, 0.05, 1.2 * k))]
    return _accessorize(coll, side_hair)


def build_bouncer():
    # Big Schlomo: a huge gentle slab in sunglasses with an earpiece.
    coll = build_person("InteriorsBouncer", dict(hair="bald", skin="#C68642", top="#1B1B1B", sleeves="short",
                        bottom="pants", bottom_color="#263238", shoes="#111111", width=1.5, height=1.98,
                        extras=["sunglasses", "beard"], extra_colors={"Beard": "#2B1B12", "Shades": "#0A0A0A"}))
    k = 1.98 / 1.62
    return _accessorize(coll, lambda coll: [
        Part(coll, "ear", bm_sphere(0.022 * k), mat("SchlomoEarpiece", "#90A4AE", 0.3, 0.6), loc=(0.19 * k, -0.01, 1.53 * k)),
        limb(coll, "wire", (0.19 * k, -0.01, 1.5 * k), (0.15 * k, 0.05, 1.28 * k), 0.006, mat("SchlomoWire", "#90A4AE", 0.3)),
        Part(coll, "sec", bm_box(0.18 * k, 0.02, 0.06 * k), mat("SchlomoBadge", "#FFD54F", 0.4, 0.6), loc=(0, -0.24, 1.2 * k)),
    ])


def build_morah():
    # Morah: strict teacher — dark snood/bun, glasses, brown cardigan, long grey skirt.
    return build_person("InteriorsMorah", dict(hair="bun", hair_color="#4E342E", top="#6D4C41", bottom="skirt",
                        bottom_color="#37474F", shoes="#1B1B1B", extras=["glasses", "necklace"],
                        extra_colors={"Glasses": "#212121", "Gold": "#B0BEC5"}))


def build_cheder_kid():
    # A cheder boy: white shirt, tzitzis, blue kippah, grey trousers.
    coll = build_person("InteriorsChederKid", dict(hair="short", hair_color="#4E342E", top="#FFFFFF", sleeves="short",
                        bottom="pants", bottom_color="#455A64", shoes="#1B1B1B", height=1.05, kid=True,
                        extras=["kippah", "tzitzit"], extra_colors={"Kippah": "#1565C0"}))
    k = 1.05 / 1.62
    hk = k * 1.22
    head_z = 1.37 * k + 0.19 * hk * 0.95
    return _accessorize(coll, lambda coll: [
        Part(coll, "payos", bm_sphere(0.025 * hk, 0.025 * hk, 0.08 * hk), mat("KidPayos", "#4E342E", 0.8),
             loc=(s * 0.19 * hk, -0.03, head_z - 0.08 * hk)) for s in (-1, 1)])


def build_doctor():
    # The doctor with terrible advice: lab coat, glasses, grey hair, stethoscope.
    coll = build_person("InteriorsDoctor", dict(hair="short", hair_color="#9E9E9E", top="#90CAF9", bottom="pants",
                        bottom_color="#546E7A", shoes="#3E2723", extras=["glasses", "lab_coat", "mustache"],
                        extra_colors={"Beard": "#9E9E9E", "Glasses": "#37474F"}))
    return _accessorize(coll, lambda coll: [
        Part(coll, "steth", bm_torus(0.12, 0.012, 16, 4), mat("DocSteth", "#263238", 0.4), loc=(0, -0.08, 1.3), rot=(0.5, 0, 0)),
        Part(coll, "disc", bm_cyl(0.035, 0.035, 0.02, 10), mat("DocStethMetal", "#CFD8DC", 0.2, 0.9), loc=(0.06, -0.21, 1.08), rot=(math.pi / 2, 0, 0)),
        Part(coll, "pocket", bm_box(0.1, 0.02, 0.06), mat("DocPen", "#1E88E5", 0.4), loc=(-0.1, -0.2, 1.2)),
    ])


def build_perp():
    # "The Schmear": striped prison shirt, scruffy, goofy grin.
    coll = build_person("InteriorsPerp", dict(hair="curly", hair_color="#3E2723", top="#FAFAFA", bottom="pants",
                        bottom_color="#FAFAFA", shoes="#424242", extras=["beard"], extra_colors={"Beard": "#3E2723"}))
    def stripes(coll):
        out = []
        sm = mat("PerpStripe", "#1A1A1A", 0.7)
        for z in (0.96, 1.06, 1.16, 1.26):
            dz = (z - 1.14) / 0.24
            f = math.sqrt(max(0.05, 1 - dz * dz))
            bm = bm_torus(1.0, 0.025, 20, 4)
            bmesh.ops.scale(bm, vec=(0.205 * f * 1.02 + 0.004, 0.155 * f * 1.02 + 0.004, 1.0), verts=bm.verts)
            out.append(Part(coll, "stripe", bm, sm, loc=(0, 0, z)))
        for z in (0.3, 0.5, 0.7):
            for s in (-1, 1):
                out.append(Part(coll, "legstripe", bm_torus(0.072, 0.018, 12, 4), sm, loc=(s * 0.095, 0, z)))
        return out
    return _accessorize(coll, stripes)


def build_lifeguard():
    # The lifeguard: blonde ponytail, red suit, shades up, whistle on a lanyard.
    return build_person("InteriorsLifeguard", dict(hair="ponytail", hair_color="#F2C94C", skin="#E0A878", top="#E53935",
                        sleeves="short", bottom="pants", bottom_color="#E53935", shoes="#FFFFFF",
                        extras=["sunglasses_up"], extra_colors={"HairTie": "#FFFFFF"}))


def build_icecream_man():
    # The ice-cream man: striped paper hat, white top, pink apron, a big smile + moustache.
    return build_person("InteriorsIceCream", dict(hair="short", hair_color="#5D4037", top="#FFFFFF", sleeves="short",
                        bottom="pants", bottom_color="#5C6BC0", shoes="#3E2723", width=1.08,
                        extras=["cap", "apron", "mustache", "belly"],
                        extra_colors={"Hat": "#FF80AB", "Apron": "#F8BBD0", "Beard": "#5D4037"}))


ASSETS = [
    ("interiors_bar", build_bar),
    ("interiors_school", build_school),
    ("interiors_hospital", build_hospital),
    ("interiors_police", build_police),
    ("interiors_beach", build_beach),
    ("interiors_props", build_props),
    ("interiors_bartender", build_bartender),
    ("interiors_bouncer", build_bouncer),
    ("interiors_morah", build_morah),
    ("interiors_cheder_kid", build_cheder_kid),
    ("interiors_doctor", build_doctor),
    ("interiors_perp", build_perp),
    ("interiors_lifeguard", build_lifeguard),
    ("interiors_icecream", build_icecream_man),
]
