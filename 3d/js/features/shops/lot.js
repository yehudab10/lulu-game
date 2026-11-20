// features/shops/lot.js — the dealership as TOWN DATA (a town's `uses.dealer`, read by town/build.js › layoutFace):
// the showroom + one `with` entry per car on the lot, each a landmark of its own (its price board is a sign in the
// town's atlas, its spot "lot_<skin>" is where she stands to look at it, `tag` lets dealer.js lift it out of the merge
// for a closer look / a test drive). Pure data: a town file calls dealerUse({...}) for its block face.
import { SKINS } from "../../car.js";
import { SKIN_SHOP } from "../garage/data.js";
import { DEALER_DIMS, LOTCAR_DIMS } from "./models.js";

/** The cars on the lot, nearest the showroom first (pink is everybody's first car: it's not for sale). */
export const LOT = ["purple", "orange", "blue", "green", "red", "gold", "ninja"];
export const LOT_GAP = 3.9;

/**
 * A town's `uses.dealer`. opts: { sign (the fascia's lines), tints (the showroom: Walls / Trim / Roof), signBg, signFg,
 * u (the showroom's offset from the face's middle), dir (±1: which way along the face the lot runs from it) }.
 */
export function dealerUse({ sign, tints = {}, signBg = "#C62828", signFg = ["#FFFFFF", "#FFE082"], u = 16, dir = -1 } = {}) {
    const first = u + dir * (DEALER_DIMS.w / 2 + 2.6);
    return {
        key: "shops_dealer", fallback: null, dims: DEALER_DIMS, u, sign, spot: "dealer", tints,
        signSize: [12.6, 1.05, 104], signBg, signFg,
        with: LOT.map((k, i) => {
            const sk = SKINS[k];
            return {
                key: "shops_lotcar", dims: LOTCAR_DIMS, u: first + dir * i * LOT_GAP, spot: "lot_" + k, tag: true,
                tints: { Body: sk.body, BodyLight: sk.light, BodyDark: sk.dark },
                sign: [sk.name.toUpperCase(), `${SKIN_SHOP[k].price.toLocaleString("en-US")} COINS`],
                signSize: [1.3, 0.6, 64], signW: 256, signBg: "#FFFFFF", signFg: ["#1B1B1B", sk.dark],
            };
        }),
    };
}
