"""
People builder: chibi characters with animatable limbs.

    build_person("Avigail", dict(hair="long", hair_color="#E8C15A", top="#CE93D8",
                 bottom="skirt", bottom_color="#6A1B9A", extras=["sunglasses", "earrings"]))

Produces ONE collection whose root Empty has these children (the game's
core/people.js animates them by name):
    Body   - torso, head, hair, face and clothes, baked (multi-material)
    Arm_L  / Arm_R  - origin at the shoulder, hanging straight down
    Leg_L  / Leg_R  - origin at the hip
The person faces Blender -Y (+Z in three.js). Height ~1.62 m for adults; pass
height=1.15 (and kid=True for a bigger head) for children.

Material names (recolourable at runtime with spawnPerson(key, {colors})):
    Skin, Hair, Top, Bottom, Shoes, Eye, Cheek, Mouth, + extras' own names
    (Glasses, Shades, Beard, Hat, HatBand, Apron, Badge, Tie, Kippah, Veil…)

spec keys (all optional):
    skin, hair ("sheitel" | "bun" | "ponytail" | "long" | "curly" | "short" |
                "bald" | "pigtails" | "bob" | "updo"), hair_color,
    top, sleeves ("long" | "short"), bottom ("skirt" | "pants" | "dress"),
    bottom_color, shoes, height, kid (bool), width (body width factor),
    extras: list of "glasses" | "sunglasses" | "beard" | "mustache" | "kippah" |
            "fedora" | "cap" | "police_hat" | "chef_hat" | "apron" | "badge" | "tie" |
            "bowtie" | "earrings" | "necklace" | "veil" | "tiara" | "headband" |
            "scarf" | "bow" | "lab_coat" | "vest" | "tzitzit" | "belly" | "sunglasses_up"
    extra_colors: {"Hat": "#111", "Tie": "#c00", ...}
"""
import math
from lib import *


def _c(spec, key, default):
    return spec.get(key, default) or default


def build_person(name, spec=None):
    spec = spec or {}
    coll = scene_coll(name)
    root = root_empty(coll, name)
    H = spec.get("height", 1.62)
    kid = spec.get("kid", H < 1.35)
    k = H / 1.62                     # overall scale
    hk = k * (1.22 if kid else 1.0)  # kids get bigger heads
    wf = spec.get("width", 1.0)
    xc = spec.get("extra_colors", {})
    extras = set(spec.get("extras", []))

    SKIN = mat("Skin", _c(spec, "skin", "#FFD2B0"), rough=0.7)
    HAIR = mat("Hair", _c(spec, "hair_color", "#8B5A2B"), rough=0.8)
    TOP = mat("Top", _c(spec, "top", "#4FC3F7"), rough=0.75)
    BOT = mat("Bottom", _c(spec, "bottom_color", "#283593"), rough=0.8)
    SHOE = mat("Shoes", _c(spec, "shoes", "#3E2723"), rough=0.6)
    EYE = mat("Eye", "#1B1B1B", rough=0.3)
    CHEEK = mat("Cheek", "#FF8A9A", rough=0.8)
    MOUTH = mat("Mouth", "#B23A48", rough=0.6)
    SHINE = mat("EyeShine", "#FFFFFF", rough=0.2)
    xm = lambda nm, default, **kw: mat(nm, xc.get(nm, default), **kw)

    hip = 0.80 * k
    waist = 0.98 * k
    chest = 1.14 * k
    shoulder_z = 1.30 * k
    neck_z = 1.37 * k
    head_r = 0.19 * hk
    head_z = neck_z + head_r * 0.95
    sx = 0.22 * k * wf               # shoulder x
    lx = 0.095 * k * wf              # leg x

    body = []
    bottom = spec.get("bottom", "skirt")
    # torso (+ belly)
    body.append(Part(coll, "torso", bm_sphere(0.2 * k * wf, 0.15 * k * wf, 0.24 * k), TOP, loc=(0, 0, chest)))
    if "belly" in extras:
        body.append(Part(coll, "belly", bm_sphere(0.2 * k * wf, 0.19 * k * wf, 0.19 * k), TOP, loc=(0, -0.04 * k, waist + 0.04 * k)))
    if bottom in ("skirt", "dress"):
        top_r = 0.18 * k * wf
        hem_z = 0.40 * k if bottom == "skirt" else 0.36 * k
        sk = BOT if bottom == "skirt" else TOP
        body.append(Part(coll, "skirt", bm_cyl(top_r, 0.30 * k * wf, waist - hem_z + 0.06 * k, 16), sk,
                         loc=(0, 0, (waist + hem_z) / 2)))
    else:
        body.append(Part(coll, "hips", bm_sphere(0.18 * k * wf, 0.14 * k * wf, 0.12 * k), BOT, loc=(0, 0, hip + 0.06 * k)))
    if "lab_coat" in extras:
        coat = xm("LabCoat", "#FAFAFA", rough=0.7)
        body.append(Part(coll, "coat", bm_cyl(0.21 * k * wf, 0.27 * k * wf, chest - 0.5 * k + 0.2 * k, 16), coat, loc=(0, 0, (chest + 0.5 * k) / 2)))
    if "vest" in extras:
        body.append(Part(coll, "vest", bm_sphere(0.205 * k * wf, 0.155 * k * wf, 0.2 * k), xm("Vest", "#5D4037"), loc=(0, 0, chest - 0.02 * k)))
    # neck + head
    body.append(Part(coll, "neck", bm_cyl(0.055 * k, 0.055 * k, 0.12 * k, 10), SKIN, loc=(0, 0, neck_z)))
    body.append(Part(coll, "head", bm_sphere(head_r, head_r * 0.95, head_r * 1.02, 22, 16), SKIN, loc=(0, 0, head_z)))
    fy = -head_r * 0.93              # face front (y)
    for s in (-1, 1):
        body.append(Part(coll, "eye", bm_sphere(0.032 * hk, 0.018 * hk, 0.042 * hk, 10, 8), EYE, loc=(s * 0.07 * hk, fy, head_z + 0.01 * hk)))
        body.append(Part(coll, "shine", bm_sphere(0.01 * hk, 0.008 * hk, 0.01 * hk, 6, 4), SHINE, loc=(s * 0.07 * hk + 0.01 * hk, fy - 0.012 * hk, head_z + 0.025 * hk)))
        body.append(Part(coll, "cheek", bm_sphere(0.035 * hk, 0.01 * hk, 0.022 * hk, 10, 6), CHEEK, loc=(s * 0.12 * hk, fy + 0.02 * hk, head_z - 0.06 * hk)))
        body.append(Part(coll, "ear", bm_sphere(0.03 * hk, 0.02 * hk, 0.045 * hk, 8, 6), SKIN, loc=(s * head_r * 0.98, 0, head_z)))
    body.append(Part(coll, "mouth", bm_sphere(0.035 * hk, 0.01 * hk, 0.014 * hk, 10, 6), MOUTH, loc=(0, fy - 0.004 * hk, head_z - 0.085 * hk)))

    # hair
    style = spec.get("hair", "sheitel")
    hz = head_z
    def cap(scale_z=1.0, back=0.05):
        return Part(coll, "cap", bm_sphere(head_r * 1.07, head_r * 1.0, head_r * 1.04 * scale_z, 22, 16), HAIR, loc=(0, head_r * back, hz + head_r * 0.12))
    if style in ("sheitel", "bob"):
        body.append(cap())
        body.append(Part(coll, "back", bm_sphere(head_r * 1.12, head_r * 0.55, head_r * (1.45 if style == "sheitel" else 1.2)), HAIR,
                         loc=(0, head_r * 0.55, hz - head_r * 0.55)))
        for s in (-1, 1):
            body.append(Part(coll, "side", bm_sphere(head_r * 0.35, head_r * 0.45, head_r * 1.05), HAIR, loc=(s * head_r * 0.9, head_r * 0.05, hz - head_r * 0.45)))
        body.append(Part(coll, "fringe", bm_sphere(head_r * 0.95, head_r * 0.25, head_r * 0.35), HAIR, loc=(0, -head_r * 0.72, hz + head_r * 0.62)))
    elif style == "bun":
        body.append(cap(0.9))
        body.append(Part(coll, "bun", bm_sphere(head_r * 0.55), HAIR, loc=(0, head_r * 0.55, hz + head_r * 0.95)))
    elif style == "updo":
        body.append(cap(0.95))
        body.append(Part(coll, "updo", bm_sphere(head_r * 0.6, head_r * 0.55, head_r * 0.7), HAIR, loc=(0, head_r * 0.2, hz + head_r * 1.15)))
    elif style == "ponytail":
        body.append(cap())
        body.append(Part(coll, "tie", bm_sphere(head_r * 0.2), mat("HairTie", xc.get("HairTie", "#FF4081")), loc=(0, head_r * 0.95, hz + head_r * 0.35)))
        body.append(Part(coll, "tail", bm_sphere(head_r * 0.32, head_r * 0.42, head_r * 0.95), HAIR, loc=(0, head_r * 1.2, hz - head_r * 0.3), rot=(0.4, 0, 0)))
    elif style == "pigtails":
        body.append(cap())
        for s in (-1, 1):
            body.append(Part(coll, "pig", bm_sphere(head_r * 0.32, head_r * 0.32, head_r * 0.7), HAIR, loc=(s * head_r * 1.1, head_r * 0.2, hz - head_r * 0.2), rot=(0, s * 0.4, 0)))
            body.append(Part(coll, "tie", bm_sphere(head_r * 0.16), mat("HairTie", xc.get("HairTie", "#FF4081")), loc=(s * head_r * 1.0, head_r * 0.15, hz + head_r * 0.25)))
    elif style == "long":
        body.append(cap())
        body.append(Part(coll, "back", bm_sphere(head_r * 1.12, head_r * 0.5, head_r * 2.1), HAIR, loc=(0, head_r * 0.55, hz - head_r * 1.05)))
        for s in (-1, 1):
            body.append(Part(coll, "side", bm_sphere(head_r * 0.33, head_r * 0.45, head_r * 1.5), HAIR, loc=(s * head_r * 0.92, head_r * 0.08, hz - head_r * 0.8)))
    elif style == "curly":
        body.append(cap(0.95))
        for i in range(14):
            a = i / 14 * math.pi * 2
            body.append(Part(coll, "curl", bm_ico(head_r * 0.32), HAIR,
                             loc=(math.cos(a) * head_r * 0.95, math.sin(a) * head_r * 0.6 + head_r * 0.3, hz - head_r * 0.2 + math.sin(a * 2) * head_r * 0.25), smooth=False))
    elif style == "short":
        body.append(Part(coll, "cap", bm_sphere(head_r * 1.05, head_r * 0.98, head_r * 0.82, 22, 12), HAIR, loc=(0, head_r * 0.08, hz + head_r * 0.28)))
    # bald → nothing

    # extras
    if "glasses" in extras or "sunglasses" in extras:
        sun = "sunglasses" in extras
        fm = xm("Shades" if sun else "Glasses", "#111111" if sun else "#C9A227", rough=0.2, metal=0.5)
        for s in (-1, 1):
            if sun:
                body.append(Part(coll, "lens", bm_sphere(0.06 * hk, 0.015 * hk, 0.045 * hk, 10, 6), fm, loc=(s * 0.07 * hk, fy - 0.02 * hk, head_z + 0.01 * hk)))
            else:
                body.append(Part(coll, "lens", bm_torus(0.05 * hk, 0.009 * hk, 14, 5), fm, loc=(s * 0.07 * hk, fy - 0.02 * hk, head_z + 0.01 * hk), rot=(math.pi / 2, 0, 0)))
        body.append(Part(coll, "bridge", bm_box(0.04 * hk, 0.01 * hk, 0.01 * hk), fm, loc=(0, fy - 0.02 * hk, head_z + 0.02 * hk)))
    if "sunglasses_up" in extras:
        fm = xm("Shades", "#111111", rough=0.15, metal=0.4)
        for s in (-1, 1):
            body.append(Part(coll, "upLens", bm_sphere(0.06 * hk, 0.022 * hk, 0.045 * hk, 10, 6), fm,
                             loc=(s * 0.075 * hk, -head_r * 0.5, head_z + head_r * 0.92), rot=(-0.6, 0, 0)))
    if "beard" in extras:
        bc = xm("Beard", xc.get("Beard", spec.get("hair_color", "#5D4037")), rough=0.85)
        body.append(Part(coll, "beard", bm_sphere(head_r * 0.75, head_r * 0.5, head_r * 0.7), bc, loc=(0, -head_r * 0.45, head_z - head_r * 0.6)))
    if "mustache" in extras:
        mc = xm("Beard", xc.get("Beard", spec.get("hair_color", "#5D4037")), rough=0.85)
        body.append(Part(coll, "stache", bm_sphere(0.07 * hk, 0.02 * hk, 0.02 * hk, 10, 6), mc, loc=(0, fy - 0.01 * hk, head_z - 0.055 * hk)))
    top_z = hz + head_r * 1.0
    if "kippah" in extras:
        body.append(Part(coll, "kippah", bm_sphere(head_r * 0.55, head_r * 0.55, head_r * 0.12), xm("Kippah", "#1A237E"), loc=(0, head_r * 0.25, top_z + head_r * 0.08)))
    if "fedora" in extras:
        hm = xm("Hat", "#111111", rough=0.5)
        body.append(Part(coll, "brim", bm_cyl(head_r * 1.45, head_r * 1.45, 0.02 * k, 20), hm, loc=(0, 0, top_z - head_r * 0.1)))
        body.append(Part(coll, "crown", bm_cyl(head_r * 0.85, head_r * 0.8, head_r * 0.75, 18), hm, loc=(0, 0, top_z + head_r * 0.25)))
        body.append(Part(coll, "band", bm_cyl(head_r * 0.86, head_r * 0.86, head_r * 0.15, 18), xm("HatBand", "#333333"), loc=(0, 0, top_z + head_r * 0.0)))
    if "cap" in extras:
        hm = xm("Hat", "#E53935", rough=0.6)
        body.append(Part(coll, "capTop", bm_sphere(head_r * 1.06, head_r * 1.02, head_r * 0.55), hm, loc=(0, 0, top_z - head_r * 0.15)))
        body.append(Part(coll, "visor", bm_box(head_r * 1.1, head_r * 0.7, 0.02 * k), hm, loc=(0, -head_r * 1.05, top_z - head_r * 0.42)))
    if "police_hat" in extras:
        hm = xm("Hat", "#1A237E", rough=0.5)
        body.append(Part(coll, "pTop", bm_cyl(head_r * 1.05, head_r * 1.15, head_r * 0.45, 18), hm, loc=(0, 0, top_z + head_r * 0.05)))
        body.append(Part(coll, "pVisor", bm_box(head_r * 1.1, head_r * 0.55, 0.02 * k), xm("Black", "#111111"), loc=(0, -head_r * 0.95, top_z - head_r * 0.22)))
        body.append(Part(coll, "pBadge", bm_sphere(0.03 * hk, 0.01 * hk, 0.03 * hk), xm("Badge", "#FFD54F", rough=0.3, metal=0.8), loc=(0, -head_r * 1.07, top_z + head_r * 0.07)))
    if "chef_hat" in extras:
        hm = xm("ChefHat", "#FFFFFF", rough=0.8)
        body.append(Part(coll, "chefBand", bm_cyl(head_r * 0.95, head_r * 0.95, head_r * 0.35, 18), hm, loc=(0, 0, top_z)))
        body.append(Part(coll, "chefPuff", bm_sphere(head_r * 1.15, head_r * 1.1, head_r * 0.7), hm, loc=(0, 0, top_z + head_r * 0.6)))
    if "tiara" in extras:
        body.append(Part(coll, "tiara", bm_torus(head_r * 0.7, 0.012 * k, 18, 5), xm("Tiara", "#FFD54F", rough=0.2, metal=0.9), loc=(0, 0, top_z - head_r * 0.05)))
    if "veil" in extras:
        body.append(Part(coll, "veil", bm_sphere(head_r * 1.2, head_r * 0.6, head_r * 2.4), xm("Veil", "#FFFFFF", rough=0.9), loc=(0, head_r * 0.7, hz - head_r * 0.9)))
    if "headband" in extras:
        body.append(Part(coll, "hband", bm_torus(head_r * 1.0, 0.025 * k, 20, 6), xm("Headband", "#FF4081"), loc=(0, 0.01, top_z - head_r * 0.25), rot=(0.25, 0, 0)))
    if "bow" in extras:
        bw = xm("Bow", "#FF4081")
        for s in (-1, 1):
            body.append(Part(coll, "bowL", bm_sphere(head_r * 0.28, head_r * 0.12, head_r * 0.2), bw, loc=(s * head_r * 0.25 + head_r * 0.5, 0, top_z - head_r * 0.05), rot=(0, s * 0.5, 0)))
    if "earrings" in extras:
        for s in (-1, 1):
            body.append(Part(coll, "earring", bm_sphere(0.022 * hk), xm("Gold", "#FFD54F", rough=0.2, metal=0.9), loc=(s * head_r * 1.0, -0.01, head_z - 0.06 * hk)))
    if "necklace" in extras:
        body.append(Part(coll, "necklace", bm_torus(0.11 * k, 0.012 * k, 18, 5), xm("Gold", "#FFD54F", rough=0.2, metal=0.9), loc=(0, -0.02 * k, neck_z - 0.06 * k), rot=(0.35, 0, 0)))
    if "scarf" in extras:
        body.append(Part(coll, "scarf", bm_torus(0.09 * k, 0.04 * k, 16, 8), xm("Scarf", "#E53935"), loc=(0, 0, neck_z - 0.02 * k)))
    if "apron" in extras:
        body.append(Part(coll, "apron", bm_box(0.3 * k, 0.03 * k, 0.55 * k), xm("Apron", "#FFFFFF"), loc=(0, -0.17 * k * wf, waist - 0.05 * k), rot=(0.08, 0, 0)))
    if "badge" in extras:
        body.append(Part(coll, "badge", bm_sphere(0.04 * k, 0.012 * k, 0.045 * k), xm("Badge", "#FFD54F", rough=0.3, metal=0.8), loc=(0.08 * k, -0.15 * k * wf, chest + 0.06 * k)))
    if "tie" in extras:
        body.append(Part(coll, "tie", bm_box(0.05 * k, 0.02 * k, 0.28 * k), xm("Tie", "#C62828"), loc=(0, -0.155 * k * wf, chest - 0.02 * k)))
    if "bowtie" in extras:
        for s in (-1, 1):
            body.append(Part(coll, "bowtie", bm_sphere(0.05 * k, 0.02 * k, 0.03 * k), xm("Tie", "#C62828"), loc=(s * 0.04 * k, -0.14 * k, shoulder_z - 0.01 * k)))
    if "tzitzit" in extras:
        for s in (-1, 1):
            body.append(Part(coll, "tzitzit", bm_cyl(0.006 * k, 0.006 * k, 0.22 * k, 5), xm("White", "#FAFAFA"), loc=(s * 0.17 * k * wf, -0.04 * k, waist - 0.12 * k)))

    bake(body, "Body", coll, parent=root)

    # arms: hang from the shoulder; origin AT the shoulder
    sleeve = TOP if spec.get("sleeves", "long") == "long" else SKIN
    arm_len = 0.42 * k
    for nm, s in (("Arm_L", 1), ("Arm_R", -1)):
        sh = (s * sx, 0, shoulder_z)
        parts = [Part(coll, nm + "_up", bm_cyl(0.06 * k, 0.05 * k, arm_len, 10), sleeve, loc=(s * sx, 0, shoulder_z - arm_len / 2)),
                 Part(coll, nm + "_sh", bm_sphere(0.065 * k), TOP, loc=sh),
                 Part(coll, nm + "_hand", bm_sphere(0.055 * k), SKIN, loc=(s * sx, 0, shoulder_z - arm_len - 0.02 * k))]
        if spec.get("sleeves", "long") != "long":
            parts.append(Part(coll, nm + "_sl", bm_cyl(0.068 * k, 0.065 * k, 0.14 * k, 10), TOP, loc=(s * sx, 0, shoulder_z - 0.07 * k)))
        bake_at(parts, nm, coll, root, sh)

    # legs: origin at the hip
    leg_col = BOT if bottom == "pants" else SKIN if kid else mat("Tights", xc.get("Tights", "#2B2B3A"), rough=0.7)
    for nm, s in (("Leg_L", 1), ("Leg_R", -1)):
        hp = (s * lx, 0, hip)
        parts = [Part(coll, nm + "_leg", bm_cyl(0.07 * k, 0.06 * k, hip - 0.06 * k, 10), leg_col, loc=(s * lx, 0, hip / 2 + 0.03 * k)),
                 Part(coll, nm + "_shoe", bm_sphere(0.07 * k, 0.12 * k, 0.055 * k), SHOE, loc=(s * lx, -0.04 * k, 0.05 * k))]
        bake_at(parts, nm, coll, root, hp)
    return coll
