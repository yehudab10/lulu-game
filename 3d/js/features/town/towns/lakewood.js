// features/town/towns — LAKEWOOD as data. The engine (plan.js, build.js, cars.js, life.js)
// knows nothing about Lakewood: everything here — street names and where they run, what
// stands on each block face, the landmarks, the signs, the people and their lines, the
// traffic mix, the ramps — is read from this object. A second town is another file like
// this one, added to towns/index.js.
//
// Local frame: metres, x → "east", z → "north" (the highway ramp comes in from the south).
// Streets: axis "ns" (constant x = c, runs along z from a0 to a1) or "ew" (constant z = c).
import * as L from "./lakewood-lines.js";

const P = 76, SPAN = 304;
const ns = (name, i, a0 = -14, a1 = SPAN + 14) => ({ name, axis: "ns", c: i * P, a0, a1 });
const ew = (name, j, a0 = -14, a1 = SPAN + 14) => ({ name, axis: "ew", c: j * P, a0, a1 });

export default {
    id: "lakewood",
    name: "Lakewood",
    emoji: "🏙️",
    origin: { x: -152, z: -3200 },        // far south of the highway (which only ever heads north from (0, 0))
    s0: 500000,
    ground: "#ffffff",

    streets: [
        ns("Route 9", 0, -96), ns("Clifton Ave", 1), ns("Madison Ave", 2), ns("Forest Ave", 3), ns("Lake Dr", 4),
        ew("14th St", 0), ew("Carpool Ln", 1), ew("Main St", 2), ew("Minivan Way", 3), ew("County Line Rd", 4, -96),
    ],
    // what stands on each block face: s / n / w / e (z−, z+, x−, x+). Keys "k,l" = block column, row.
    blockDefault: "homes",
    blocks: {
        "1,0": { faces: { s: "townhouses", w: "townhouses" } },
        "2,0": { faces: { s: "construction" } },
        "0,1": { faces: { n: "shops" } }, "1,1": { faces: { n: "pizza" } }, "2,1": { faces: { n: "shops" } }, "3,1": { faces: { n: "shops" } },
        "0,2": { faces: { s: "shops" } }, "1,2": { faces: { s: "shops" } }, "2,2": { faces: { s: "hall" } }, "3,2": { faces: { s: "shops" } },
        "0,3": { faces: { n: "construction2" } },
        "1,3": { faces: { n: "yeshiva", e: "buses" } },
        "2,3": { all: "townhouses" },
    },

    // landmarks
    circle: { ns: "Madison Ave", ew: "Main St", r: 6.0, ring: 9.6, statue: "town_minivan", statueTint: "#D4AF37" },
    blocked: [                                            // directed stretches the town's drivers avoid (from/to = along at the nodes)
        { street: "Route 9", dir: 1, from: 0, to: 2 * P },     // the jam
        { street: "Main St", dir: 1, from: 2 * P, to: 3 * P }, // the wedding
    ],
    jams: [{ street: "Route 9", d: 1.75, from: 9, to: 2 * P - 12, gap: 6.2 }],       // a lane of stopped minivans, forever
    hazards: [                                            // double / triple-parked with the hazards on (jackable)
        { street: "Main St", along: 2 * P + 22, d: 1.75 }, { street: "Main St", along: 2 * P + 30, d: 4.6 }, { street: "Main St", along: 2 * P + 36, d: 1.9 },
    ],
    bandBus: { street: "Main St", along: 2 * P + 50, d: 2.4, model: "foot_bus", colors: { BusBlue: "#6A1B9A", BusWhite: "#F3E5F5" }, lines: L.SIGNS.bandBus },
    clearParking: [{ street: "Main St", from: 2 * P, to: 3 * P, side: 1 }],
    bumps: [{ street: "Carpool Ln", every: 10.5 }],
    chair: { street: "Forest Ave", along: P + 38, side: -1 },
    water: [{ x0: SPAN + 16, x1: SPAN + 170, z0: -40, z1: SPAN + 50, geese: true }],
    woods: [
        [-26, -14, -26, SPAN - 12, 4.2], [-26, SPAN + 22, SPAN + 14, SPAN + 22, 4.4], [-26, -14, -16, -26, 3.6], [16, -26, SPAN + 12, -26, 4.4],
        [-16, -26, -16, -104, 4.0], [16, -26, 16, -104, 4.0], [-26, SPAN - 12, -104, SPAN - 12, 4.0], [-26, SPAN + 22, -104, SPAN + 22, 4.0],
        [-16, -104, 16, -104, 3.0], [-104, SPAN - 12, -104, SPAN + 22, 3.0],
    ],
    billboards: L.SIGNS.billboards.map((lines, k) => ({ x: -17, z: 40 + k * 95, rot: Math.PI / 2, lines })),
    welcome: { street: "Route 9", along: -40, d: 10.5, rot: Math.PI, lines: L.SIGNS.welcome },
    signs: [
        { kind: "green", street: "Route 9", along: -8, d: -7.4, rot: 0, lines: L.SIGNS.exitSouth },
        { kind: "green", street: "County Line Rd", along: 8, d: -7.4, rot: Math.PI / 2, lines: L.SIGNS.exitWest },
        { kind: "green", street: "Main St", along: 10, d: 7.4, rot: -Math.PI / 2, lines: L.SIGNS.toHighway },
        { kind: "post", street: "Carpool Ln", along: 10, d: 7.6, rot: -Math.PI / 2, lines: L.SIGNS.bumps, bg: "#F9C623", fg: "#1B1B1B", w: 1.6, h: 1.1 },
        { kind: "post", street: "Route 9", along: 14, d: 7.6, rot: Math.PI, lines: L.SIGNS.limit, bg: "#FFFFFF", fg: "#111111", border: "#111111", w: 0.9, h: 1.15 },
        { kind: "post", street: "Main St", along: 2 * P + 30, d: 7.6, rot: -Math.PI / 2, lines: L.SIGNS.noParking, bg: "#FFFFFF", fg: ["#C62828", "#C62828", "#111111"], border: "#C62828", w: 0.9, h: 1.05 },
    ],
    coins: [
        { street: "Main St", from: 18, n: 8, d: -1.75 }, { street: "Main St", from: 2 * P + 58, n: 3, d: -1.75 }, { street: "Lake Dr", from: 30, n: 8, d: -1.75 },
        { street: "Carpool Ln", from: P + 16, n: 7, d: 1.75 }, { street: "County Line Rd", from: 2 * P + 14, n: 8, d: 1.75 },
    ],

    // the ramps: where the highway's off-ramp drops her, and the ways back out
    entry: { street: "Route 9", along: -58, d: 1.75, dir: 1 },
    exits: [
        { street: "Route 9", dir: -1, at: -66, name: "Route 9 South" },
        { street: "County Line Rd", dir: -1, at: -66, name: "County Line Rd West" },
    ],
    highway: { first: 1500, every: 3600 },                // where the exits are, metres into a Cruise run

    traffic: { town_van: 7, town_bus: 1, cop: 1 },        // moving drivers (the parked, jammed and hazard ones are extra)
    speedLimitMph: 25, speedingMph: 48,

    // who you can meet, where (spots come from the build: pizza / hall / chair / lake / welcome / yeshiva)
    people: [
        { id: "brooklyn", at: "pizza", off: [5, 0.6] }, { id: "pizza", at: "pizza", off: [-4, 0.2], line: 6 },
        { id: "monsey", at: "hall", off: [6, 0.4] }, { id: "local", at: "hall", off: [-9, 0.8] },
        { id: "chair", at: "chair" }, { id: "agent", at: "welcome", off: [4, -3] }, { id: "local", at: "yeshiva", off: [7, 0.4], alt: true },
    ],
    bikes: 3, geese: 6,
    lines: L,
};
