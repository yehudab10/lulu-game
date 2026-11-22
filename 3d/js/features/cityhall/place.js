// features/cityhall/place.js — city hall as TOWN DATA (a town's `uses.cityhall`, read by town/build.js › layoutFace),
// like features/shops' dealerUse: a town file calls cityhallUse("<town>") for its block face. Importing this registers
// the code-built model (models.js), so it's there before the town builds.
import { HALL_DIMS, HALL_KEY } from "./models.js";
import { TOWNS } from "./data.js";

/**
 * A town's `uses.cityhall`. opts: { u (offset from the face's middle), with ([{key, u}] — ordinary buildings beside it) }.
 * The spot "cityhall" is the front door (on the sidewalk in front of the model's Anchor_door).
 */
export function cityhallUse(town, { u = 0, with: beside = [] } = {}) {
    const T = TOWNS[town] || TOWNS.lakewood;
    return {
        key: HALL_KEY, fallback: null, dims: HALL_DIMS, u, sign: T.sign, spot: "cityhall", tints: T.tints,
        signSize: [10.4, 1.05, 48], signW: 512, signBg: T.signBg, signFg: T.signFg,       // (a SMALL cell: the town's one sign atlas is tight — Midwood's test needs scale ≥ 0.5)
        with: beside,
    };
}
