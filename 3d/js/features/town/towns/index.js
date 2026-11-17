// features/town/towns — every town you can turn into. Each is plain data (see lakewood.js,
// midwood.js); the engine (plan / build / cars / life / rail / landmarks) and the highway exits
// read it. Add a town: write towns/<id>.js (+ its lines), import it here, give it a turn in
// townFor(), and (if it needs new block uses or props) teach build.js's layoutFace / the asset
// modules about them.
import lakewood from "./lakewood.js";
import midwood from "./midwood.js";

export const TOWNS = { lakewood, midwood };
/** Which town Cruise's exit #k (0, 1, 2… in a run) leads to: they take turns, Lakewood first. */
export function townFor(k = 0) { return k % 2 ? TOWNS.midwood : TOWNS.lakewood; }
