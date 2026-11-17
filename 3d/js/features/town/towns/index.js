// features/town/towns — every town you can turn into. Each is plain data (see lakewood.js);
// the engine (plan / build / cars / life) and the highway exits read it. Add a town: write
// towns/<id>.js, import it here, and (if it needs new block uses or props) teach build.js's
// layoutFace / the asset module about them.
import lakewood from "./lakewood.js";

export const TOWNS = { lakewood };
/** Which town a highway exit leads to (one for now; a later town can take every other exit). */
export function townFor(/* exitIndex, mode */) { return TOWNS.lakewood; }
