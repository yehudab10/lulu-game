// features/world/uturn.js — ↺ U-TURN CROSSOVERS (ci/twoway round 4; the owner, 2026-11-27: "There's also no signs facing
// that direction"; the coordinator: "make every place reachable going either way using the SIMPLEST thing that reads as
// a real road — signed U-turn crossovers before each exit"). The exits are taken from the up-the-lap side only, so a
// driver coming DOWN the lap passes a town's / JFK's / a rest area's exit, then turns round at a painted crossover 400 m
// on (a turn bay on her side with a big U-turn arrow) and drives back up to it. The highway's centre is painted, not a
// barrier, so the crossover is paint + signs: a few dozen triangles a copy (the interchange budget — the exits test).
// The boards (lapsigns.js): "U-TURN 300 m · then the exit" before it, and the place's own "exit on the other side".
import * as THREE from "three";
import { models } from "../../models.js";
import { LAP } from "../../world.js";
import { addPlace } from "./places.js";
import { lapPlaces } from "./lapmap.js";

/** How far before an exit (in up-the-lap metres) its crossover is — past it for a driver coming down the lap. */
export const UTURN_BEFORE = 400;
const BIG = new Set(["town", "airport", "rest"]);
/** The crossovers' lap metres (one before each exit). */
// (lapPlaces asks the towns for their exits, and planning those can ask the places for their spots again — this one
//  included: a re-entry guard, and the answer kept once it has every place: 2 towns + JFK + 2 rest areas)
let CACHE = null, BUSY = false;
export function uturnMetres() {
    if (CACHE) return CACHE;
    if (BUSY) return [];
    BUSY = true;
    try {
        const r = lapPlaces().filter(p => BIG.has(p.kind)).map(p => ({ m: ((p.m - UTURN_BEFORE) % LAP + LAP) % LAP, place: p }));
        if (r.length >= 5) CACHE = r;
        return r;
    } catch (e) { return []; } finally { BUSY = false; }
}

// ── the paint: a dashed turn bay 36 m × 3.2 m + a U-turn arrow, flat on the road (one merged mesh, one material) ──
function paint() {
    const pos = [], idx = [];
    const quad = (x0, x1, z0, z1) => { const b = pos.length / 3; pos.push(x0, 0.03, z0, x1, 0.03, z0, x1, 0.03, z1, x0, 0.03, z1); idx.push(b, b + 2, b + 1, b, b + 3, b + 2); };
    // (local x = along the road, z = across it; the bay's outline: solid ends, dashed sides)
    const L = 18, W = 1.6, t = 0.15;
    quad(-L, -L + t, -W, W); quad(L - t, L, -W, W);
    for (let x = -L; x < L - 1; x += 3) { quad(x, x + 1.8, -W, -W + t); quad(x, x + 1.8, W - t, W); }
    // the U-turn arrow: two shafts + the bend + a head
    quad(-6, 4, -0.9, -0.6); quad(-6, 4, 0.6, 0.9); quad(4, 4.3, -0.9, 0.9);
    const b = pos.length / 3; pos.push(-6, 0.03, -1.4, -6, 0.03, -0.1, -8, 0.03, -0.75); idx.push(b, b + 2, b + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: "#f5f5f0", side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.name = "UturnPaint"; m.receiveShadow = false; m.castShadow = false;
    const grp = new THREE.Group(); grp.name = "world_uturn"; grp.add(m);
    return grp;
}
models.world_uturn = models.world_uturn || paint();

// one place definition, a copy before every exit on every lap (cruise / party: the lap's fixed places)
addPlace({
    // (listed: false — paint, not a place: the exits / the airport don't plan round it, no app lists it)
    id: "uturn", kind: "uturn", name: "U-turn", icon: "↺", verb: "", listed: false,
    where: mode => {
        if (mode !== "cruise" && mode !== "party") return [];
        const out = [];
        for (const u of uturnMetres()) for (let n = 0; n * LAP < 400000; n++) out.push(n * LAP + u.m);
        return out;
    },
    // (on the far carriageway's inner lane, turned to run along the road; never a pull-in bay)
    model: "world_uturn", d: -3.5, side: -1, bay: { half: 0, d0: 99, d1: -99 }, dur: 0, beats: [],
});
