// features/airport — the airport as DATA. Two frames:
//
//  • the INTERCHANGE, in highway road coords (u = s − exit.s along, d = metres right of the centre line) — it hugs
//    the highway like a town's exit (features/town/exit.js) and a rest area: advance signs, a 55 m taper into a
//    parallel decel lane, the gantry, a painted gore, an off-ramp that eases away to d 30 at u 60 (a curve that keeps
//    on turning), and from u 600 the on-ramp back easing in, a merge gore, an accel lane.
//  • the AIRPORT itself, RIGID (an airport isn't a ribbon): its own frame (f, r) — origin on the highway's centre line at
//    u = UA, f along the highway's heading there, r to its right (away from the road). Everything past the ramps is
//    laid out in it: the loop (legs, the kerb road, two corners), the parking lot, the terminal, the fence, the apron,
//    the gates, the tower, the runway. Two Bézier roads join the ramps' ends to the loop's legs (plan.js builds them
//    in world space from both ends' poses, so the joints are exact on any bend).
//
//   r 55 → 245, f ±175   LANDSIDE (fenced): the legs at f ±150, the kerb road at r 190 (three one-way lanes, the
//                        terminal on her right), the kerb sidewalk r 195 → 203, the lot r 106 → 160 inside the loop
//   r 203 → 238          the terminal (Terminal 4½), f ±95
//   r 238 → 298          the apron + three gates (jet bridges, parked planes), the tower at f 138
//   r 306                the taxiway; r 330 → 375 the runway (f ±450)
//   fence                the runway fence (r 245 from the terminal's ends out to f ±175, the JOKE fence) + the sides
//                        and the bottom (r 55, open where the legs pass)

// ── the interchange (highway coords) ─────────────────────────────────────
export const TAPER0 = -230, TAPER1 = -175, RAMP0 = -60, OFF1 = 60, GANTRY = -110;
export const ON0 = 600, ON1 = 720, ACC1 = 840;
export const SIGN_MILE = -1450, SIGN_HALF = -880, SIGN_LAST = -470;
export const HALF = 2.6;                       // a ramp lane's half width
export const LANE_EDGE = 7, DECEL_EDGE = 11.2, RAMP_D0 = 9.1, J_D = 30;
/** The airport frame's origin: the highway's centre line at u = UA. */
export const UA = 330;
/** The whole stretch the airport covers along the highway (first sign → end of the accel lane). */
export const SPAN = { a: SIGN_MILE - 40, b: ACC1 + 60 };

const clamp01 = t => Math.max(0, Math.min(1, t));
const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
/** The off-ramp's centre line: leaves the decel lane at the gore, eases away (still turning at its end). */
export const offD = u => RAMP_D0 + (J_D - RAMP_D0) * clamp01((u - RAMP0) / (OFF1 - RAMP0)) ** 2;
export const offSlope = u => 2 * (J_D - RAMP_D0) * clamp01((u - RAMP0) / (OFF1 - RAMP0)) / (OFF1 - RAMP0);
/** The on-ramp's centre line: comes in at a slant, eases into the accel lane. */
export const onD = u => RAMP_D0 + (J_D - RAMP_D0) * (1 - clamp01((u - ON0) / (ON1 - ON0))) ** 2;
export const onSlope = u => -2 * (J_D - RAMP_D0) * (1 - clamp01((u - ON0) / (ON1 - ON0))) / (ON1 - ON0);
export const taperEdge = u => LANE_EDGE + (DECEL_EDGE - LANE_EDGE) * smooth((u - TAPER0) / (TAPER1 - TAPER0));
export const accelEdge = u => LANE_EDGE + (DECEL_EDGE - LANE_EDGE) * (1 - smooth((u - ON1) / (ACC1 - ON1)));

/** Is (u, d) on one of the interchange's highway-side LANES (decel lane, ramps, gores, accel lane)? */
export function hwLane(u, d) {
    if (d < 6.5 || u < TAPER0 - 1 || u > ACC1 + 1) return false;
    if (u <= RAMP0 + 2 && d <= taperEdge(u) + 0.3) return true;                          // taper + decel lane
    if (u >= RAMP0 - 2 && u <= OFF1 + 1 && Math.abs(d - offD(u)) <= HALF + 0.3) return true;    // the off-ramp
    if (u >= RAMP0 && u <= RAMP0 + 74 && d > 6.5 && d < offD(u) - HALF + 0.2) return true;   // the painted gore
    if (u >= ON0 - 1 && u <= ON1 + 2 && Math.abs(d - onD(u)) <= HALF + 0.3) return true;      // the on-ramp
    if (u >= ON1 - 64 && u <= ON1 && d > 6.5 && d < onD(u) - HALF + 0.2) return true;        // the merge gore
    if (u >= ON1 - 2 && d <= accelEdge(u) + 0.3) return true;                             // the accel lane
    return false;
}

// ── the airport frame (f, r) ─────────────────────────────────────────────
export const LEG_F = 150, LEG_R0 = 70, CORNER_R = 155, ARC_R = 35, KERB_R = 190, ROAD_W = 5.25;   // the loop: 3 lanes wide
export const WALK = { r0: KERB_R + ROAD_W, r1: 203 };       // the kerb sidewalk
export const TERM = { f0: -95, f1: 95, r0: 203, r1: 238 };
export const LAND = { f0: -175, f1: 175, r0: 55, r1: 245 };   // the fenced landside
export const LOT = { f0: -105, f1: 105, r0: 113.7, r1: 160 };
export const AISLE = { r: 110, w: 3.7, f0: -LEG_F + ROAD_W - 1, f1: LEG_F - ROAD_W + 1 };   // the lot's main aisle
export const APRON = { f0: -130, f1: 130, r0: TERM.r1, r1: 298 };
export const TAXIWAY = { r: 306, w: 7.5, f0: -260, f1: 260 };
export const RUNWAY = { f0: -450, f1: 450, r0: 330, r1: 375 };
export const RUNWAY_R = (RUNWAY.r0 + RUNWAY.r1) / 2;
/** The box FIT keeps the highway out of (everything the airport draws, + the planes' low passes). */
export const BOX = { f0: -520, f1: 520, r0: 38, r1: 410 };
/** The kerbs: departures (west half) + arrivals (east half), in f. */
export const KERBS = { dep: [-110, -6], arr: [6, 110] };
/** The kerb lane (where the taxis / shuttles stop): the right-hand lane of the kerb road. */
export const KERB_LANE = KERB_R + 3.5;

/** The loop's road pieces (A frame): lines + arcs, all ROAD_W half wide. */
export const LOOP = [
    { kind: "line", a: [-LEG_F, LEG_R0], b: [-LEG_F, CORNER_R] },
    { kind: "arc", c: [-LEG_F + ARC_R, CORNER_R], R: ARC_R, a0: Math.PI, a1: Math.PI / 2 },
    { kind: "line", a: [-LEG_F + ARC_R, KERB_R], b: [LEG_F - ARC_R, KERB_R] },
    { kind: "arc", c: [LEG_F - ARC_R, CORNER_R], R: ARC_R, a0: Math.PI / 2, a1: 0 },
    { kind: "line", a: [LEG_F, CORNER_R], b: [LEG_F, LEG_R0] },
];
/** Sample a piece list → [[f, r]…] every ~step metres. */
export function samplePieces(pieces, step = 2) {
    const out = [];
    for (const p of pieces) {
        if (p.kind === "line") {
            const L = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]), n = Math.max(1, Math.round(L / step));
            for (let i = out.length ? 1 : 0; i <= n; i++) out.push([p.a[0] + (p.b[0] - p.a[0]) * i / n, p.a[1] + (p.b[1] - p.a[1]) * i / n]);
        } else {
            const L = Math.abs(p.a1 - p.a0) * p.R, n = Math.max(2, Math.round(L / step));
            for (let i = out.length ? 1 : 0; i <= n; i++) { const a = p.a0 + (p.a1 - p.a0) * i / n; out.push([p.c[0] + p.R * Math.cos(a), p.c[1] + p.R * Math.sin(a)]); }
        }
    }
    return out;
}

/** The kerb vehicles' closed loop (A frame): the right-hand lane all round — in-leg up, the kerb lane, out-leg down,
 *  through the lot's main aisle and back (left turns only). */
const VR = ARC_R + 3.5, BR = 12, LANE_F = LEG_F + 3.5, AR = AISLE.r - 1.8;
export const VLOOP = [
    { kind: "line", a: [-LANE_F, AR + BR], b: [-LANE_F, CORNER_R] },
    { kind: "arc", c: [-LEG_F + ARC_R, CORNER_R], R: VR, a0: Math.PI, a1: Math.PI / 2 },
    { kind: "line", a: [-LEG_F + ARC_R, KERB_LANE], b: [LEG_F - ARC_R, KERB_LANE] },
    { kind: "arc", c: [LEG_F - ARC_R, CORNER_R], R: VR, a0: Math.PI / 2, a1: 0 },
    { kind: "line", a: [LANE_F, CORNER_R], b: [LANE_F, AR + BR] },
    { kind: "arc", c: [LANE_F - BR, AR + BR], R: BR, a0: 0, a1: -Math.PI / 2 },
    { kind: "line", a: [LANE_F - BR, AR], b: [-LANE_F + BR, AR] },
    { kind: "arc", c: [-LANE_F + BR, AR + BR], R: BR, a0: -Math.PI / 2, a1: -Math.PI },
];
/** Where the kerb vehicles stop (f on the kerb lane). */
export const STOPS = { shuttle: -62, taxiHead: 70, taxiGap: 7.5 };

/** Parking stalls: rows along f (cars nose ±r). */
export const STALL_W = 2.8;
export const STALLS = [{ r: 120.2, f0: -100, f1: 100, face: 1 }, { r: 128.4, f0: -100, f1: 100, face: -1 },
    { r: 145.4, f0: -100, f1: 100, face: 1 }, { r: 153.6, f0: -100, f1: 100, face: -1 }];

/** The fence (A frame polylines). `runway: true` = the joke fence (the airside). */
export const FENCES = [
    { runway: true, pts: [[TERM.f1, TERM.r1], [TERM.f1, LAND.r1], [LAND.f1, LAND.r1]] },
    { runway: true, pts: [[TERM.f0, TERM.r1], [TERM.f0, LAND.r1], [LAND.f0, LAND.r1]] },
    { pts: [[LAND.f1, LAND.r1], [LAND.f1, LAND.r0], [LEG_F + ROAD_W + 2.5, LAND.r0]] },
    { pts: [[LAND.f0, LAND.r1], [LAND.f0, LAND.r0], [-LEG_F - ROAD_W - 2.5, LAND.r0]] },
    { pts: [[-LEG_F + ROAD_W + 2.5, LAND.r0], [LEG_F - ROAD_W - 2.5, LAND.r0]] },
];
export const FENCE_H = 3.4;

/** Props (A frame): key, f, r, yaw as an A-frame direction [df, dr] the model's front faces, tint, r (collider). */
export function propList() {
    const P = [];
    const face = (df, dr) => [df, dr];
    P.push({ key: "airport_terminal", f: 0, r: TERM.r0, face: face(0, -1), id: "terminal" });
    P.push({ key: "airport_tower", f: 138, r: 268, face: face(0, -1), id: "tower" });
    P.push({ key: "airport_windsock", f: -300, r: 318, face: face(1, 0) });
    for (const [k, f] of [[0, -60], [1, 0], [2, 60]]) {
        P.push({ key: "airport_jetbridge", f, r: TERM.r1 + 3, face: face(0, 1), id: "gate" + k });
        P.push({ key: "airport_plane", f, r: 278.4, face: face(0, -1), id: "plane" + k, livery: k, scale: 0.8 });
    }
    P.push({ key: "airport_booth", f: -LOT.f1 + 4, r: AISLE.r + 6.4, face: face(-1, 0), id: "booth" });
    // lamps: the kerb road's median side, the lot, the legs
    for (let f = -120; f <= 120; f += 30) P.push({ key: "exits_lamp", f, r: KERB_R - ROAD_W - 1.4, face: face(1, 0), col: 0.3 });
    for (let f = -90; f <= 90; f += 45) P.push({ key: "exits_lamp", f, r: 137, face: face(1, 0), col: 0.3 });
    for (const sf of [-1, 1]) for (let r = 80; r <= 150; r += 35) P.push({ key: "exits_lamp", f: sf * (LEG_F + ROAD_W + 1.6), r, face: face(0, 1), col: 0.3 });
    // trees in the median between the lot and the kerb road, + along the bottom fence
    for (let f = -100; f <= 100; f += 20) P.push({ key: "treeRound", f: f + 6, r: 172.5, face: face(1, 0), col: 0.5, flat: true });
    for (let f = -130; f <= 130; f += 26) P.push({ key: "treeRound", f, r: 72, face: face(1, 0), col: 0.5, flat: true });
    return P;
}
/** The free-standing boards on posts (A frame): the atlas cell, where, which way they face, size. */
export const BOARD_POSTS = [
    { cell: "welcome", f: -LEG_F - ROAD_W - 6, r: 86, face: [0, -1], w: 5.0, h: 1.7, y: 2.3, big: true },
    { cell: "guide", f: -LEG_F + ROAD_W + 4.5, r: 120, face: [0, -1], w: 4.4, h: 1.9, y: 2.6, big: true },
    { cell: "parking", f: -LOT.f1 - 2, r: AISLE.r + 9.5, face: [-1, 0], w: 2.6, h: 1.2, y: 2.1 },
    { cell: "cell", f: LOT.f1 - 6, r: LOT.r1 + 3.5, face: [0, -1], w: 2.4, h: 1.1, y: 2.0 },
    { cell: "noStop", f: -20, r: WALK.r0 + 0.7, face: [-1, 0], w: 1.6, h: 1.0, y: 2.2 },
    { cell: "taxi", f: STOPS.taxiHead + 4, r: WALK.r0 + 0.7, face: [-1, 0], w: 2.0, h: 0.9, y: 2.3 },
    { cell: "shuttle", f: STOPS.shuttle - 6, r: WALK.r0 + 0.7, face: [-1, 0], w: 2.0, h: 0.9, y: 2.3 },
    { cell: "exitBack", f: LEG_F - ROAD_W - 4, r: 92, face: [0, 1], w: 3.4, h: 1.5, y: 2.4, big: true },
    { cell: "runway", f: 135, r: LAND.r1 - 0.6, face: [0, -1], w: 2.4, h: 1.0, y: 1.6, onFence: true },
    { cell: "runway", f: -135, r: LAND.r1 - 0.6, face: [0, -1], w: 2.4, h: 1.0, y: 1.6, onFence: true },
];
/** The doors (A frame, on the sidewalk in front of each): the terminal model's Anchor_door0..5 x positions. */
export const DOORS = [-75, -45, -15, 15, 45, 75];
/** Static colliders (A frame [f, r, radius, kind]): the terminal's front + ends, the canopy columns, the planters. */
export function colliderList() {
    const out = [];
    for (let f = TERM.f0 + 1.2; f <= TERM.f1 - 1.2 + 0.01; f += 2.2) out.push([f, TERM.r0 + 1.4, 1.5, "wall"]);
    for (let r = TERM.r0 + 1.4; r <= TERM.r1 - 1; r += 2.2) { out.push([TERM.f0 + 1.3, r, 1.5, "wall"]); out.push([TERM.f1 - 1.3, r, 1.5, "wall"]); }
    for (let k = 0; k < 13; k++) out.push([TERM.f0 + 5 + k * (TERM.f1 - TERM.f0 - 10) / 12 - 0, TERM.r0 - 6.8, 0.42, "pole"]);
    return out;
}
