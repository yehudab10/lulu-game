// interiors/clear.js — 🚪 NOTHING SOLID IN A DOORWAY (the owner, 2026-11-27: "some of the houses I think a tv blocks
// some of the entrances to some rooms"). The house builders (features/homes house.js — strangers' + neighbours' houses,
// features/decor house.js — Ima's, features/realestate rooms.js — her own homes, viewings, friends' homes) lay rooms out
// in a row: partitions with a doorway gap (z ∈ [g0, g1]) and a front door in the cut-away front wall. Before a solid
// piece of furniture goes down, `fit()` checks it against the CLEAR zones — every doorway plus a walkway either side of
// it, and the strip inside the front door — and slides it along the wall (z first, then x) to the nearest spot that keeps
// them clear and stays in its own room; nowhere fits → the piece is left out. Pieces without a collider (chairs, rugs)
// are decoration she walks through, so they're not moved. Test: scripts/tests3d/doors.js › houses.

/** How much floor stays clear: either side of a doorway (m) and inside the front door (m). */
export const CLEAR = { side: 0.95, pad: 0.15, frontW: 0.8, frontD: 1.5 };

/**
 * The clear zones of a row of rooms. xs = the partitions' x; g0..g1 = their doorway gap; doorX = the front door's x on
 * the front wall at z = D / 2. → [{ x0, x1, z0, z1 }]
 */
export function doorZones({ xs = [], g0 = -0.1, g1 = 1.3, doorX = null, D = 5.6 }) {
    const out = xs.map(x => ({ x0: x - CLEAR.side, x1: x + CLEAR.side, z0: g0 - CLEAR.pad, z1: g1 + CLEAR.pad }));
    if (doorX != null) out.push({ x0: doorX - CLEAR.frontW, x1: doorX + CLEAR.frontW, z0: D / 2 - CLEAR.frontD, z1: D / 2 + 1 });
    return out;
}

const E = 1e-3, hits = (zones, x, z, hw, hd) => zones.some(c => x + hw > c.x0 + E && x - hw < c.x1 - E && z + hd > c.z0 + E && z - hd < c.z1 - E);

/**
 * Where a solid piece (centre x, z; half-size hw × hd on the floor) may stand: as asked when it's clear of every zone,
 * else the nearest slide along z, then along x, that is clear and inside `lim` ({ x0, x1, z0, z1 } — its room's floor).
 * → { x, z, moved } | null (nowhere: leave it out)
 */
export function fit(zones, x, z, hw, hd, lim) {
    if (!zones || !zones.length || !hits(zones, x, z, hw, hd)) return { x, z, moved: false };
    const inside = (px, pz) => !lim || (px - hw >= lim.x0 - 1e-6 && px + hw <= lim.x1 + 1e-6 && pz - hd >= lim.z0 - 1e-6 && pz + hd <= lim.z1 + 1e-6);
    for (const axis of ["z", "x"]) {
        for (let d = 0.05; d <= 3.01; d += 0.05) {
            for (const s of [-1, 1]) {           // (toward the back wall first: furniture belongs against a wall, not in the room's middle)
                const px = axis === "x" ? x + s * d : x, pz = axis === "z" ? z + s * d : z;
                if (inside(px, pz) && !hits(zones, px, pz, hw, hd)) return { x: px, z: pz, moved: true };
            }
        }
    }
    return null;
}

/** The floor of the room in a row (rooms W wide from X0) that holds x, inset by m. */
export function roomLim(x, X0, W, n, D, m = 0.1) {
    const i = Math.max(0, Math.min(n - 1, Math.floor((x - X0) / W)));
    return { x0: X0 + i * W + m, x1: X0 + (i + 1) * W - m, z0: -D / 2 + m, z1: D / 2 - m };
}
