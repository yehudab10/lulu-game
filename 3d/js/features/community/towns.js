// features/community — WHICH TOWNS have which volunteer orgs, as data. One entry per town
// id (features/town/towns/<id>.js). A town without an entry gets nothing from this feature.
// Midwood (or any later town) opts in with one entry here — or at runtime:
//     ctx.community.register("midwood", { orgs: { chaverim: true, shomrim: true, hatzalah: true }, … })
// Every field is optional; DEFAULTS fill the rest.
//
//   orgs        which orgs exist there (vehicles, scenes, calls, chases)
//   approach    metres of HIGHWAY before the town's exit where their cars start showing up
//   highway     sightings on the approach: one every [a, b] s, ≤ max at once, org weights, chance a sighting
//               is a roadside scene (a minivan with a flat on the shoulder + Chaverim) instead of a car
//   cruisers    how many of each org's cars cruise the town's streets (the town's own lane AI)
//   scenes      roadside scenes in town: first after `first` s, then every [a, b] s, which kinds
//   shomrim     the patrol: how many cars join a cop chase, can they LEAD one (spot a crime → call it in),
//               the chance real cops come right away, how long before they call it in, how far they see
//   by          the Bais Yaakov blend-in: the town's `uses` spot name + how many girls in the line
export const DEFAULTS = {
    orgs: { chaverim: true, shomrim: true, hatzalah: true },
    approach: 1600,
    highway: { every: [8, 14], max: 2, weights: { chaverim: 0.4, shomrim: 0.35, hatzalah: 0.25 }, roadside: 0.3 },
    cruisers: { chaverim: 1, shomrim: 2, hatzalah: 1 },
    scenes: { first: 16, every: [30, 55], kinds: ["flat", "lockout", "battery", "hurt"] },
    shomrim: { join: 2, lead: true, withCops: 0.35, callIn: [8, 13], sight: 58 },
    by: null,
};

export const COMMUNITY = {
    lakewood: {
        approach: 1800,
        cruisers: { chaverim: 1, shomrim: 2, hatzalah: 1 },
        by: { spot: "baisyaakov", girls: 7 },
    },
    // midwood: { orgs: { chaverim: true, shomrim: true, hatzalah: true }, by: null },   ← one line to opt in
};

const cache = new Map();
/** The merged config for a town id (null when that town has no community entry). */
export function forTown(id) {
    if (!id || !COMMUNITY[id]) return null;
    if (cache.has(id)) return cache.get(id);
    const c = COMMUNITY[id], out = {};
    for (const k of Object.keys(DEFAULTS)) {
        const d = DEFAULTS[k], v = c[k];
        out[k] = v === undefined ? d : (d && typeof d === "object" && !Array.isArray(d) && v && typeof v === "object" && !Array.isArray(v)) ? Object.assign({}, d, v) : v;
    }
    out.id = id;
    cache.set(id, out);
    return out;
}
export function register(id, cfg) { COMMUNITY[id] = cfg || {}; cache.delete(id); }
