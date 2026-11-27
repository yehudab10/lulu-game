// features/town/towns — MIDWOOD, Brooklyn, as data (the second town; see lakewood.js for the format).
//
// A recognisable slice of the real neighbourhood (3d/docs/midwood-brief.md, OSM-derived), squeezed
// to about the size of Lakewood's grid. Real order and names, compressed spacing:
//   west → east  Ocean Parkway (the boulevard: 2+2 lanes, tree malls, service roads) · East 8th St
//                (one-way N) · Coney Island Ave (2+2) · East 15th St (one-way N) · the B/Q embankment
//                (BMT Brighton Line, mid-block E 15th/E 16th, stations at Ave J, Ave M, Kings Hwy) ·
//                East 16th St (one-way S) · Ocean Avenue (2+2, pre-war apartment houses)
//   north → south  Avenue J (the kosher strip) · Avenue K · Avenue L · Avenue M (the second strip) ·
//                Kings Highway — the 1704 road that ignores the grid, a real DIAGONAL (12.5° here).
// Approximated: every other East street is dropped (E 7th, 9th–14th, 17th–19th); Avenues N, O, P and
// Quentin Rd are squeezed out, so Kings Hwy runs just south of Avenue M; Brooklyn College ("Brooklyn
// Kollege of Knowledge") is pulled south from north of Avenue H to the north side of Avenue J.
//
// Local frame: metres, x → "grid east", z → "grid north" (the brief's frame, rotated 8.2° off true
// north so the grid is axis-aligned). The highway ramp comes in from the south, up Ocean Parkway
// (as from the Belt Parkway).
import * as L from "./midwood-lines.js";
import { dealerUse } from "../../shops/lot.js";
import { clothesUse } from "../../clothes/data.js";
import { cityhallUse } from "../../cityhall/place.js";

// the grid
const OP = -250, E8 = -165, CIA = -80, E15 = 5, RAIL = 45, E16 = 85, OA = 175;
const AJ = 245, AK = 145, AL = 45, AM = -55;
// Kings Highway: z on its centre line at x (a straight diagonal from x −330 to Ocean Ave)
const KH0 = -330, SLOPE = 0.222;
const khZ = x => -205 + (x - OP) * SLOPE;
const KH_LEN = Math.hypot(OA - KH0, khZ(OA) - khZ(KH0)), KH_UX = (OA - KH0) / KH_LEN;
/** along Kings Hwy (0 at its midpoint) where it crosses x */
const khA = x => (x - (KH0 + OA) / 2) / KH_UX;
const KH_H = Math.atan2(OA - KH0, khZ(OA) - khZ(KH0));

const ns = (name, x, a0, a1 = AJ, o = {}) => Object.assign({ name, axis: "ns", c: x, a0, a1 }, o);
const ew = (name, z, a0 = OP, a1 = OA, o = {}) => Object.assign({ name, axis: "ew", c: z, a0, a1 }, o);
const atKH = x => khZ(x) - 0.05;          // a street that starts at Kings Hwy (a T from the north)

export default {
    id: "midwood",
    name: "Midwood",
    emoji: "🏙️",
    origin: { x: 260, z: -5650 },          // far south of the highway, well clear of Lakewood
    s0: 500000,
    ground: "#ffffff",
    seed: 718,
    cell: 84,                              // merge clusters (m): Midwood is ~1.5× Lakewood, so bigger cells keep the draw calls level

    streets: [
        ns("Ocean Pkwy", OP, -330, 300, { lanes: 2, park: false, boulevard: { mall: 6, service: 6.6 }, priority: true }),
        ns("E 8th St", E8, atKH(E8), AJ, { oneway: 1 }),
        ns("Coney Island Ave", CIA, atKH(CIA), AJ, { lanes: 2, priority: true }),
        ns("E 15th St", E15, atKH(E15), AJ, { oneway: 1 }),
        ns("E 34th St", E16, atKH(E16), AJ, { oneway: -1 }),
        ns("Ocean Ave", OA, atKH(OA), AJ, { lanes: 2, priority: true }),
        ew("Avenue M", AM), ew("Avenue L", AL), ew("Avenue K", AK), ew("Avenue J", AJ),
        { name: "Kings Hwy", axis: "diag", from: [KH0, khZ(KH0)], to: [OA, khZ(OA)], lanes: 2, priority: true },
    ],
    // block faces (s / n / w / e = z− / z+ / x− / x+). "k,l": column (0 = Ocean Pkwy → E 8th … 4 = E 16th → Ocean Ave),
    // row (0 = Ave M → L, 1 = L → K, 2 = K → J); "k,Kings Hwy": the 4-sided blocks between Kings Hwy and Avenue M.
    blockDefault: "mwhomes",
    blocks: {
        "0,0": { faces: { w: "pkwy", s: "avem" } }, "1,0": { faces: { s: "avem", e: "dealer", n: "hospital" } }, "2,0": { faces: { s: "realty", w: "cia" } },    // (features/realestate: Brick by Brick Realty on Avenue M)
        "3,0": { faces: { s: "avem" } }, "4,0": { faces: { s: "avem", n: "school", e: "apts" } },
        "0,1": { faces: { w: "pkwy", e: "parkLot" } }, "1,1": { faces: { n: "shul", e: "cia" } }, "2,1": { faces: { w: "carsvc", e: "shtiebel", n: "civic" } },
        "3,1": { faces: { w: "rowhouses", e: "rowhouses" } }, "4,1": { faces: { e: "apts" } },
        "0,2": { faces: { w: "pkwy", n: "makolet" } }, "1,2": { faces: { n: "clothes", e: "cia" } }, "2,2": { faces: { n: "mwpizza", w: "cia", s: "cityhall" } },
        "3,2": { faces: { n: "bakery" } }, "4,2": { faces: { n: "bank", e: "apts", w: "luluHome" } },
        "0,Kings Hwy": { faces: { s: "kh", w: "pkwy", n: "avem" } }, "1,Kings Hwy": { faces: { s: "kh", n: "avem", e: "cia" } },
        "2,Kings Hwy": { faces: { s: "kh", n: "avem", w: "cia" } }, "3,Kings Hwy": { faces: { s: "kh", n: "avem", w: "rowhouses", e: "rowhouses" } },
        "4,Kings Hwy": { faces: { s: "kh", n: "simchahall", e: "apts" } },      // (features/family: the Avenue M Ballroom — Avigail's wedding)
    },
    // landmark uses modelled by other features (build.js › layoutFace): the bank on Avenue J (features/heist) —
    // the same model as Lakewood's, in Brooklyn limestone + a green roof, between two storefronts
    uses: {
        // 🏠 LULU'S HOUSE (ci/hometown, roadmap 14 + 21): an EMPTY 14 × 24 m lot among ordinary Midwood houses on EAST 34TH ST
        // (the owner: "East 34th St between J and K"; block 4,2, Avenue K → J). The town builds nothing on it (no house, no `homes` door, no parked cars at its kerb); features/world
        // + decor draw the family's house, driveway and car. Spot `luluHome` (ctx.town.spotOf / spot): lot centre + rot, nx/nz
        // toward the street, door, drive {x, z, h: nose out}, kerb, w, d.
        luluHome: { lot: true, among: "mwhomes", dims: { w: 14, d: 24, prot: 0 }, spot: "luluHome" },
        // 🅿️ a small municipal lot on E 8th St (block 0,1 east face, Avenue L → K) for ci/parkinglot's challenge: EMPTY like
        // Lulu's — the town builds nothing on it, no parked cars at its kerb; features/parking draws the bays + booth.
        parkLot: { lot: true, among: "mwhomes", dims: { w: 26, d: 20, prot: 0 }, spot: "parkLot" },
        bank: { key: "heist_bank", fallback: "town_mw_store", dims: { w: 20, d: 14, prot: 4.0 }, sign: L.SIGNS.bank, spot: "bank",
            tints: { Walls: "#D8CCB4", Roof: "#3F6B4F" }, signSize: [11.4, 0.96, 92], signBg: "#1B3A2B", signFg: ["#E8C766", "#F5F1E6"],
            with: [{ key: "town_mw_store", u: -16.5 }, { key: "town_mw_store", u: 16.5 }] },
        // features/places (roadmap 4): the precinct (green lamps — it's Brooklyn) + its tow pound, the courthouse beside it on
        // Avenue K, and Midwood General on Avenue L. Doors are ✋ spots; arrests / the ER happen IN them.
        civic: { key: "places_precinct", fallback: "town_mw_store", dims: { w: 15, d: 12, prot: 2.6 }, u: -4.2, sign: L.SIGNS.precinct, spot: "precinct",
            tints: { Walls: "#8A4B3A", Trim: "#D9D4C7", Roof: "#3A3D42", Globe: "#3DFF7A", Accent: "#1B3A2B" }, signSize: [9.0, 0.9, 92], signBg: "#1B3A2B", signFg: ["#FFFFFF", "#C8E6C9"],
            with: [
                { key: "places_court", dims: { w: 18, d: 14, prot: 3.8 }, u: 13.6, sign: L.SIGNS.court, spot: "court",
                    tints: { Walls: "#C9C7C0", Roof: "#3F6B4F", Trim: "#E7E4DC", Accent: "#4E3B2A" }, signSize: [13.2, 1.1, 104], signBg: "#1B3A2B", signFg: ["#E8C766", "#F5F1E6"] },
                { key: "places_impound", dims: { w: 12, d: 12, prot: 0.4 }, u: -18.4, sign: L.SIGNS.impound, spot: "impound",
                    tints: { Accent: "#455A64", Trim: "#F5F1E6" }, signSize: [4.8, 0.9, 92], signBg: "#FFC107", signFg: ["#1B1B1B", "#3E2723"] },
            ] },
        hospital: { key: "places_hospital", fallback: "town_mw_store", dims: { w: 22, d: 14, prot: 3.2 }, sign: L.SIGNS.hospital, spot: "hospital",
            tints: { Walls: "#B5653F", Trim: "#F2EEE6", Roof: "#3A3A3A" }, signSize: [11.6, 1.1, 104], signBg: "#0D47A1", signFg: ["#FFFFFF", "#BBDEFB"] },
        // features/shops: Uncle Refael's Brooklyn branch on Coney Island Ave (car dealers' row) — shops/lot.js
        // features/shops: Yanky's 24-Hour Makolet on Avenue J, among the storefronts
        makolet: { key: "town_mw_store", fallback: "town_mw_store", dims: { w: 10, d: 13, prot: 1.5 }, sign: L.SIGNS.makolet, spot: "makolet",
            tints: { Walls: "#9C4A3C", Awning: "#2E7D32" }, signSize: [8.4, 0.9, 62], signW: 640, signBg: "#FFFDE7", signFg: ["#2E7D32", "#5D4037"],
            with: [-20.8, -10.4, 10.4, 20.8].map(u => ({ key: "town_mw_store", u, list: "avej" })) },     // (the Avenue J storefronts either side — their signs from the street's list)
        dealer: dealerUse({ sign: L.SIGNS.dealer, tints: { Walls: "#E6DCCB", Trim: "#1565C0", Roof: "#4A4E55" }, signBg: "#1565C0", signFg: ["#FFFFFF", "#FFE082"] }),
        // features/clothes (roadmap 24): Avenue J'adore, the boutique on Avenue J among the storefronts
        clothes: clothesUse("midwood"),
        // features/realestate (roadmap 16): the realtor's storefront in the middle of the Avenue M store row
        realty: { key: "town_mw_store", fallback: "town_mw_store", dims: { w: 10, d: 13, prot: 1.5 }, sign: L.SIGNS.realty, spot: "realty",
            tints: { Walls: "#7B4A3A", Awning: "#1B3A2B" }, signSize: [8.4, 0.9, 62], signW: 640, signBg: "#1B3A2B", signFg: ["#FFFFFF", "#C8E6C9"],
            with: [{ key: "town_mw_store", u: -10.5, list: "avem" }, { key: "town_mw_store", u: 10.5, list: "avem" }, { key: "town_mw_store", u: -21, list: "avem" }, { key: "town_mw_store", u: 21, list: "avem" }] },
        // features/cityhall (roadmap 17): Midwood Borough Hall on Avenue K, across from the precinct + courthouse, a house either side
        cityhall: cityhallUse("midwood", { with: [{ key: "town_mw_house", u: -21 }, { key: "town_mw_house", u: 21 }] }),
        // features/family (roadmap 32 · stage C): the Avenue M Ballroom — Lakewood's simcha-hall model in Midwood, a store row
        // either side; its door is a ✋ (Avigail's wedding plays inside on the hall's evenings — features/family/hall.js)
        simchahall: { key: "town_hall", fallback: "town_mw_store", dims: { w: 34, d: 22, prot: 4.3 }, sign: L.SIGNS.simchahall, spot: "simchaHall",
            signSize: [15.4, 1.45, 96], signBg: "#4A148C", signFg: ["#F8BBD0", "#FFFFFF"],
            with: [-34.5, -24, 24, 34.5].map(u => ({ key: "town_mw_store", u, list: "avem" })) },
    },
    // the town's edges: a row of buildings along the far side of the boundary streets
    strips: [
        { street: "Ocean Pkwy", side: 1, from: -180, to: 292, use: "pkwy", depth: 16 },
        { street: "Ocean Ave", side: -1, from: khZ(OA) + 20, to: AJ - 14, use: "apts", depth: 20 },
        { street: "Avenue J", side: 1, from: OP + 27, to: RAIL - 17, use: "avej", depth: 14 },
        { street: "Avenue J", side: 1, from: RAIL + 17, to: OA - 6, use: "college", depth: 72 },
        { street: "Kings Hwy", side: -1, from: khA(OP) + 30, to: khA(RAIL) - 18, use: "kh", depth: 14 },
        { street: "Kings Hwy", side: -1, from: khA(RAIL) + 18, to: khA(OA) - 20, use: "kh", depth: 14 },
    ],

    // ── landmarks ────────────────────────────────────────────────────────
    // the B/Q: an earth embankment mid-block between E 15th and E 16th; the streets pass under on short girder bridges
    rail: {
        x: RAIL, z0: -340, z1: 340, top: 5.4, base: 24, deck: 14, tracks: [-5.55, -1.85, 1.85, 5.55],
        stations: [
            { street: "Avenue J", name: "AVENUE J", house: -1 }, { street: "Avenue M", name: "AVENUE M", house: -1 },
            { street: "Kings Hwy", name: "KINGS HWY", house: 1, express: true },
        ],
        // the Q stops everywhere; the B (weekdays only) runs express on the middle tracks and stops only at Kings Hwy
        trains: [
            { line: "Q", color: "#FCCC0A", track: 5.55, dir: 1, local: true, cars: 4 },
            { line: "B", color: "#FF6319", track: -1.85, dir: -1, local: false, cars: 4, weekdays: true },
        ],
        pigeons: "Avenue M",
    },
    barricades: [{ street: "Ocean Pkwy", along: 292, lines: L.SIGNS.closedNorth }],
    // alternate-side parking on E 8th: the west side is being swept (no cars), the east side double-parks and WAITS
    clearParking: [
        { street: "E 8th St", from: -200, to: 260, side: 1 },
        { street: "Avenue J", from: CIA, to: E15, side: 1 },
        // (features/places: POLICE ONLY in front of the precinct + court, AMBULANCE ONLY at Midwood General)
        { street: "Avenue K", from: CIA + 10, to: E15 - 10 }, { street: "Avenue L", from: E8 + 14, to: CIA - 14 },
        // (features/shops: the kerb in front of Uncle Refael's Brooklyn lot)
        { street: "Coney Island Ave", from: AM + 10, to: AL - 10 },
        // (features/shops: Shmerel's van at the kerb outside the car service)
        { street: "Coney Island Ave", from: AL + 8, to: AK - 8 },
    ],
    jams: [
        { street: "E 8th St", d: -1.9, from: AL + 14, to: AK - 14, gap: 6.6, kind: "asp" },
        { street: "Kings Hwy", d: -1.75, from: khA(CIA) + 14, to: khA(E15) - 14, gap: 6.3 },
        { street: "Kings Hwy", d: -5.25, from: khA(CIA) + 18, to: khA(E15) - 16, gap: 7.4 },
    ],
    blocked: [
        { street: "Avenue J", dir: 1, from: CIA, to: E15 },            // the double-parking in front of the pizza store
        { street: "Kings Hwy", dir: -1, from: khA(CIA) + 1, to: khA(E15) + 1 },   // Kings Hwy, 1 pm, a Sunday
    ],
    hazards: [                                                       // double-parked "for one second" (jackable)
        { street: "Avenue J", along: -48, d: 1.75 }, { street: "Avenue J", along: -36, d: 4.4 }, { street: "Avenue J", along: -22, d: 1.9 },
        { street: "Avenue M", along: E15 - 22, d: -1.75 }, { street: "Avenue M", along: -150, d: 1.75 },
    ],
    bandBus: { street: "Kings Hwy", along: khA(CIA) + 46, d: -5.25, dir: -1, model: "foot_bus", colors: { BusBlue: "#1565C0", BusWhite: "#F2F2F2", BusYellow: "#FFC107" },
        lines: ["B82 · KINGS HWY", "next stop: eventually"], bg: "#0D47A1", fg: ["#FFFFFF", "#FFE082"] },
    chair: { street: "E 15th St", along: AL + 52, side: -1 },        // the lawn chair saving a spot (Brooklyn invented it)
    water: [],
    woods: [],
    // the city around it: rows of apartment houses past every edge (cheap merged boxes)
    skyline: [
        [-330, -350, -330, 340], [-312, 345, 215, 345], [232, -150, 232, 340], [-320, -355, 230, -355],
        [-205, -250, 150, -170],
    ],
    billboards: L.SIGNS.billboards.map((lines, k) => ({ x: -283, z: -326 + k * 34, rot: Math.PI / 2, lines })),
    welcome: { street: "Ocean Pkwy", along: -262, d: 10.2, rot: Math.PI, lines: L.SIGNS.welcome },
    signs: [
        { kind: "green", street: "Ocean Pkwy", along: -236, d: -10.2, rot: 0, lines: L.SIGNS.exitSouth },
        { kind: "green", street: "Kings Hwy", along: khA(OP) - 24, d: 13.4, rot: KH_H, lines: L.SIGNS.exitWest },
        { kind: "green", street: "Avenue J", along: OP + 30, d: 7.4, rot: -Math.PI / 2, lines: L.SIGNS.toHighway },
        { kind: "green", street: "Ocean Pkwy", along: -150, d: 10.2, rot: Math.PI, lines: L.SIGNS.lakewood },
        { kind: "post", street: "Ocean Pkwy", along: -282, d: 21.6, rot: Math.PI, lines: L.SIGNS.limit, bg: "#FFFFFF", fg: "#111111", border: "#111111", w: 0.95, h: 1.2 },
        { kind: "post", street: "Avenue J", along: -58, d: 7.6, rot: -Math.PI / 2, lines: L.SIGNS.doubleParking, bg: "#FFFFFF", fg: ["#C62828", "#111111", "#555555"], border: "#C62828", w: 1.1, h: 1.0 },
        { kind: "post", street: "Avenue M", along: -120, d: -7.6, rot: Math.PI / 2, lines: L.SIGNS.minivanDoor, bg: "#F9C623", fg: "#1B1B1B", w: 1.25, h: 1.0 },
        { kind: "post", street: "Kings Hwy", along: khA(OP) + 26, d: 13.2, rot: KH_H + Math.PI, lines: L.SIGNS.sunday, bg: "#FF8F00", fg: "#1B1B1B", w: 1.3, h: 0.9 },
        { kind: "post", street: "Avenue K", along: -120, d: 7.6, rot: -Math.PI / 2, lines: L.SIGNS.aspSuspended, bg: "#FFFFFF", fg: ["#1565C0", "#C62828", "#111111"], border: "#1565C0", w: 1.3, h: 0.95 },
        // alternate side, every block on E 8th (and a couple elsewhere)
        ...[-150, -100, -20, 25, 70, 110, 170, 215].map(a => ({ kind: "asp", street: "E 8th St", along: a, d: 7.6, rot: Math.PI, lines: L.SIGNS.asp })),
        ...[-20, 95, 200].map(a => ({ kind: "asp", street: "E 15th St", along: a, d: -7.6, rot: Math.PI, lines: L.SIGNS.asp })),
        ...[0, 120].map(a => ({ kind: "asp", street: "E 34th St", along: a, d: 7.6, rot: 0, lines: L.SIGNS.asp })),
    ],
    coins: [
        { street: "Avenue J", from: OP + 40, n: 8, d: -1.75 }, { street: "E 15th St", from: AM + 18, n: 9, d: 1.75 },
        { street: "Kings Hwy", from: khA(E16) + 14, n: 7, d: 1.75 }, { street: "Ocean Pkwy", from: AL + 16, n: 10, d: -5.25 },
        { street: "Avenue L", from: E8 + 16, n: 8, d: 1.75 }, { street: "E 34th St", from: AK - 20, n: 8, d: -1.75 },
        { street: "Ocean Pkwy", from: -60, n: 6, d: 15 },           // down the service road
    ],

    // the ramps: Ocean Parkway from the Belt, and the ways back out
    entry: { street: "Ocean Pkwy", along: -300, d: 1.75, dir: 1 },
    exits: [
        { street: "Ocean Pkwy", dir: -1, at: -314, name: "Ocean Pkwy South" },
        { street: "Kings Hwy", dir: -1, at: khA(KH0) + 12, name: "Kings Hwy West" },
    ],
    highway: { first: 2000, every: 3600, no: "9", label: "BROOKLYN", short: "Brooklyn" },
    // ATTACHED to the highway (towns/index.js attachedDef): the outer branch's cross road runs on as AVENUE P to a corner
    // with Ocean Pkwy's south end; Midwood stands turned so the Parkway runs back alongside the highway (the town behind
    // the ramp, Lakewood ahead of it). No skyline across the south end (Avenue P runs there), Kings Hwy's west end is
    // barricaded (it would point at the highway), and the way out is back along Avenue P to the interchange.
    attach: {
        join: [-378, -345], dir: Math.PI / 2,
        streets: { "Ocean Pkwy": { a0: -359 } },
        addStreets: [ew("Avenue P", -345, -378, OP, { grid: false })],
        skyline: [
            [-330, -322, -330, 340], [-312, 345, 215, 345], [232, -150, 232, 340], [-205, -250, 150, -170],
        ],
        barricades: [{ street: "Kings Hwy", along: khA(KH0) + 7, lines: ["KINGS HWY", "ROAD CLOSED", "(the highway's the other way)"] }],
        exits: [{ street: "Avenue P", dir: -1, at: -372, name: "Avenue P" }],
        dropSigns: [L.SIGNS.exitWest],
    },

    traffic: { town_van: 4, town_carsvc: 3, town_citybus: 1, town_sweeper: 1, cop: 1 },
    routes: {
        town_citybus: ["Coney Island Ave", "Kings Hwy", "Ocean Ave", "Avenue J", "Avenue M"],
        town_sweeper: ["E 8th St", "Avenue L", "Avenue K", "Avenue M", "E 15th St", "E 34th St"],
    },
    speedLimitMph: 25, speedingMph: 46,
    // parked cars: car-service sedans and minivans of every colour (Brooklyn isn't all silver)
    parked: [
        { key: "town_mw_sedan_lod", w: 5, paints: ["#1C1C1E", "#2B2D31", "#20232A", "#F5F5F5", "#B0BEC5", "#7B1F1F", "#1E3A5F"] },
        { key: "town_minivan_lod", w: 4, paints: ["#C3C8CE", "#1C1C1E", "#5D6D7E", "#F5F5F5", "#7B1F1F", "#B9BEC4"] },
    ],
    parkRate: 0.88,                                                 // there is no parking: nearly every spot is taken

    // who you can meet, where (spots come from the build)
    people: [
        { id: "driver", at: "carsvc", off: [4, 0.8] }, { id: "mechanic", at: "cia", off: [2, 0.6] },
        { id: "bubby", at: "bench" }, { id: "roaster", at: "pizza", off: [7, 0.6] }, { id: "pizza", at: "pizza", off: [-4, 0.2], line: 4 },
        { id: "bakery", at: "bakery", off: [-3, 0.3], line: 3, friday: 8 }, { id: "asp", at: "asp" }, { id: "commuter", at: "station", off: [2.5, 1.2] },
        { id: "student", at: "college", off: [3, 2] }, { id: "gabbai", at: "shul", off: [3, 0.5] }, { id: "cousin", at: "welcome", off: [4, -3] },
    ],
    bikes: 3, bikeRider: "town_brooklyn", geese: 0,
    flock: { model: "town_mw_pigeon", spot: "pigeons", n: 5, timid: true },     // the pigeons who run the Avenue M underpass
    // Lulu's first sight of each landmark → a line (spot → LULU category)
    notices: [
        { spot: "jam", r: 40, cat: "jam", big: true }, { spot: "asp", r: 26, cat: "asp", big: true }, { spot: "pizza", r: 22, cat: "pizza" },
        { spot: "bakery", r: 22, cat: "bakery" }, { spot: "college", r: 40, cat: "college" }, { spot: "carsvc", r: 20, cat: "carsvc" },
        { spot: "underpass", r: 14, cat: "underpass", big: true }, { spot: "hazards", r: 24, cat: "hazards" }, { spot: "bench", r: 30, cat: "pkwy" },
        { kind: "town_sweeper", r: 28, cat: "sweeper", gossip: "asp" },
    ],
    models: [
        "town_mw_house", "town_mw_rowhouse", "town_mw_apts", "town_mw_store", "town_mw_bakery", "town_pizza", "town_mw_carbase", "town_mw_shul",
        "town_yeshiva", "town_mw_library", "town_mw_hall", "town_mw_station", "town_mw_train", "town_mw_bench", "town_mw_pigeon", "town_mw_barricade",
        "town_mw_sedan_lod", "town_mw_sweeper", "town_minivan", "town_minivan_lod", "town_lamp", "town_stop", "town_chair", "town_welcome", "town_billboard",
        "foot_bus", "treeRound", "treePine", "sedan", "cop", "town_ebike",
        "town_mw_driver", "town_mw_bubby", "town_brooklyn", "town_local", "town_mom", "town_agent", "npcMan", "npcWoman", "npcKid",
    ],
    lines: L,
};
export { khZ, khA };
