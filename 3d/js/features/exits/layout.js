// features/exits — the REST AREA's layout, in highway road coords relative to its s:
// u = s − rest.s (metres along), d = metres right of the highway's centre line.
//
//   u −1350 / −700 / −260   blue service signs (1 MI · ½ MI · NEXT RIGHT)
//   u −200 → −80             the decel lane tapers out (a dashed line keeps the right lane straight)
//   u −80 → 10               the off-ramp curves up to the lot's drive aisle (d 27)
//   u 0 → 232, d 23.5 → 66   THE LOT: the drive aisle, two rows of stalls, the sidewalk, the building,
//                            Mendel's garage, the gas canopy, the truckers' lot, a lawn with picnic
//                            tables and the pet area (the lawn is "grounds": walkable, still grass)
//   u 222 → 322              the on-ramp back down to the highway
//   u 322 → 440              the acceleration lane tapers back in
// Everything is DATA here (positions, colliders, people, spots); build.js draws it, life.js runs it.

export const TAPER0 = -200, RAMP0 = -80, RAMP1 = 10;
export const LOT0 = 0, LOT1 = 232, LOT_D0 = 23.5, LOT_D1 = 66;
export const ON0 = 222, ON1 = 322, ACC1 = 440;
export const AISLE = 27, HALF = 2.6;
export const LAWN = { u0: 2, u1: 58, d0: 48, d1: 66 };
export const SIGN_MILE = -1350, SIGN_HALF = -700, SIGN_NEXT = -260;
/** The stretch a rest area covers (its first sign → the end of the accel lane), for other planners. */
export const SPAN = { a: SIGN_MILE - 40, b: ACC1 + 60 };

const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
/** The off-ramp's centre line. */
export const offD = u => 8.9 + (AISLE - 8.9) * smooth((u - RAMP0) / (RAMP1 - RAMP0));
/** The on-ramp's centre line. */
export const onD = u => AISLE - (AISLE - 8.9) * smooth((u - ON0) / (ON1 - ON0));
/** The decel lane's outer edge / the accel lane's outer edge. */
export const decelEdge = u => 7 + 3.9 * smooth((u - TAPER0) / (RAMP0 - TAPER0));
export const accelEdge = u => 7 + 3.9 * (1 - smooth((u - ON1) / (ACC1 - ON1)));

/** Is (u, d) in the lot itself? */
export const inLot = (u, d) => u >= LOT0 - 2 && u <= LOT1 + 2 && d >= LOT_D0 - 1 && d <= LOT_D1 + 2;
export const onLawn = (u, d) => u >= LAWN.u0 && u <= LAWN.u1 && d >= LAWN.d0 && d <= LAWN.d1;

/** The lot's drive aisle (the lane from the off-ramp past the stalls to the pumps and the on-ramp): d range. */
export const AISLE_D0 = LOT_D0 + 0.4, AISLE_D1 = 30.5;
/** Ground type at (u, d): 0 not ours · 1 grounds (walkable, grass for a car) · 2 asphalt (the lot) · 3 a LANE (decel /
 *  accel lane, a ramp, a painted gore, the drive aisle — core's `paved`: nothing may be placed on it). */
export function groundAt(u, d) {
    if (u < TAPER0 - 2 || u > ACC1 + 2 || d < 6.5) return 0;
    if (u <= RAMP0 + 2 && u >= TAPER0 && d <= decelEdge(u) + 0.3) return 3;
    if (u >= RAMP0 - 2 && u <= RAMP1 + 4 && Math.abs(d - offD(u)) <= HALF + 0.3) return 3;
    if (u >= RAMP0 && u <= RAMP0 + 62 && d > 7 && d < offD(u)) return 3;                   // the painted gore
    if (u >= LOT0 && u <= LOT1 && d >= AISLE_D0 && d <= AISLE_D1) return 3;                // the drive aisle
    if (u >= LOT0 && u <= LOT1 && d >= LOT_D0 && d <= LOT_D1) return onLawn(u, d) ? 1 : 2;
    if (u >= ON0 - 4 && u <= ON1 + 2 && Math.abs(d - onD(u)) <= HALF + 0.3) return 3;
    if (u >= ON1 - 62 && u <= ON1 && d > 7 && d < onD(u)) return 3;                         // the merge gore
    if (u >= ON1 - 2 && u <= ACC1 && d <= accelEdge(u) + 0.3) return 3;
    if (u >= -10 && u <= LOT1 + 10 && d >= 11 && d <= 70) return 1;                        // the verges round the lot
    return 0;
}

// ── the set (u, d, yaw: "road" = faces the highway / the aisle, "along" = heading +s, "back" = faces −s) ──
export const PROPS = [
    { key: "exits_building", u: 80, d: 57.2, yaw: "road", id: "building" },
    { key: "exits_canopy", u: 196, d: 31.5, yaw: "road", id: "canopy" },
    { key: "exits_garage", u: 141, d: 60, yaw: "road", id: "garage" },
    { key: "exits_kiosk", u: 112, d: 50, yaw: "road", id: "kiosk" },
    { key: "exits_vending", u: 104, d: 50.2, yaw: "road", id: "vending" },
    { key: "exits_dogrun", u: 16, d: 57.5, yaw: "road", id: "dogrun" },
    { key: "exits_picnic", u: 36, d: 52, yaw: "road", id: "picnic0" },
    { key: "exits_picnic", u: 47, d: 56, yaw: "road", id: "picnic1" },
    { key: "exits_picnic", u: 38, d: 61.5, yaw: "road", id: "picnic2" },
    { key: "exits_semi", u: 178, d: 47, yaw: "along", tint: { Paint: "#C62828" } },
    { key: "exits_semi", u: 209, d: 47, yaw: "along", tint: { Paint: "#1565C0", Trailer: "#FFF8E1" } },
    { key: "exits_semi", u: 178, d: 59, yaw: "along", tint: { Paint: "#2E7D32", Trailer: "#ECEFF1", TrailerStripe: "#F9A825" } },
];
export const LAMPS = [[30, 23.4], [90, 23.4], [150, 23.4], [222, 23.4], [40, 48.3], [100, 48.3], [126, 48.3], [158, 40], [194, 53], [226, 53]];
export const TREES = [[-6, 18], [22, 16], [46, 17], [70, 16], [100, 17], [128, 16], [156, 17], [-4, 42], [-2, 60], [56, 65], [236, 40], [238, 60], [118, 64.5]];
/** Car stalls: rows of 2.8 m stalls (cars nose +d). Some get a parked car (seeded per rest area). */
export const STALLS = [{ u0: 22, u1: 146, d: 33.3 }, { u0: 22, u1: 128, d: 45.2 }];
export const STALL_W = 2.8;
/** The family's minivan (row 0, stall 14: u 62.6) is always there — Ima and the kid stand behind it. */
export const FAMILY_STALL = { row: 0, i: 14 };

// ── the people (life.js): role → spot. face: a point (u, d) they look at ──
export const PEOPLE_AT = [
    { id: "pump", u: 197.4, d: 30.3, face: [196, 26] },
    { id: "trucker", u: 193, d: 53, face: [190, 46], talk: true },
    { id: "ima", u: 61.4, d: 37.4, face: [62.6, 34], talk: true },
    { id: "kid", u: 63.6, d: 38.0, face: [61.4, 37.4], talk: true, scale: 0.85 },
    { id: "tourist", u: 52, d: 49.8, face: [46, 56], talk: true },
    { id: "bubbe", u: 84, d: 49.6, face: [84, 44], talk: true },
    { id: "teen", u: 102, d: 48.6, face: [104, 50.2], talk: true },
    { id: "mechanic", u: 138.5, d: 53.6, face: [141, 46], talk: true },
    { id: "souvenir", u: 112, d: 50.5, face: [112, 46] },
    { id: "walker", u: 13, d: 55.5, face: [17, 58] },
];
export const DOG_AT = { u: 18, d: 58.5 };
/** On-foot spots (life.js): door / machine / table positions, in (u, d). */
export const SPOTS = {
    food: { u: 75.4, d: 50.0, r: 2.4 },
    restroom: { u: 67, d: 50.0, r: 2.2 },
    vending: { u: 104, d: 49.2, r: 2.0 },
    souvenir: { u: 112, d: 48.6, r: 2.3 },
    picnic: [{ u: 36, d: 51.0 }, { u: 47, d: 55.0 }, { u: 38, d: 60.5 }],
};
/** The driving bays (ctx.places): the gas pump and Mendel's garage. */
export const BAYS = {
    pump: { u: 196, d: 28.6, half: 8, d0: 25.6, d1: 30.3 },
    garage: { u: 143.5, d: 59, half: 4.6, d0: 55.6, d1: 63.6 },
};

/** Static colliders (u, d, r), the props' footprints as circles. */
export function colliderList() {
    const out = [];
    const run = (u0, u1, d, r, step) => { for (let u = u0; u <= u1 + 0.01; u += step) out.push([u, d, r]); };
    // the building (40 × 12): two rows of circles + the porch posts
    run(62, 98, 54.6, 3.4, 4); run(62, 98, 59.8, 3.4, 4);
    out.push([79.4, 47.9, 0.3], [71.4, 47.9, 0.3]);
    // the canopy posts + the pump island
    out.push([203, 31.5, 0.4], [189, 31.5, 0.4]);
    run(190, 202, 31.5, 0.75, 1.5);
    // the garage: back wall, sides, the office block
    run(134, 148, 64.6, 0.6, 1.4);
    for (let d = 55.5; d <= 64.5; d += 1.5) { out.push([133.6, d, 0.5], [148.4, d, 0.5]); }
    run(133.8, 138.4, 55.2, 0.6, 1.1);
    // the kiosk, the vending bank, the picnic tables
    out.push([111, 50.2, 1.0], [113, 50.2, 1.0], [104, 50.2, 1.1], [102.9, 50.2, 0.6], [105.1, 50.2, 0.6]);
    out.push([36, 52, 1.05], [47, 56, 1.05], [38, 61.5, 1.05]);
    // the dog run's fence (gate gap at the front middle)
    for (let u = 7; u <= 25; u += 1.6) { if (Math.abs(u - 16) > 1.7) out.push([u, 52, 0.25]); out.push([u, 63, 0.25]); }
    for (let d = 52; d <= 63; d += 1.6) { out.push([7, d, 0.25], [25, d, 0.25]); }
    // the semis
    for (const p of PROPS) if (p.key === "exits_semi") run(p.u - 8.5, p.u + 8.5, p.d, 1.45, 2.4);
    for (const [u, d] of LAMPS) out.push([u, d, 0.3]);
    for (const [u, d] of TREES) out.push([u, d, 0.5]);
    return out;
}
