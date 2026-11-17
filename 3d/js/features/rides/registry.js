// features/rides — the registry: ride defs keyed by id and by the shell's model key,
// the fleet (vehicles a def puts into traffic) and the persistent tallies.
import { ctx } from "../../core/ctx.js";
import { store } from "../../core/save.js";
import { kindSpec, registerKind } from "../../traffic.js";

export const DEFS = new Map();          // id → def
export const BY_KEY = new Map();        // shell model key (ctx.foot.vehicle.kind) → def
export const FLEET = [];                // def.traffic entries (they join the traffic mix)
export const HORN_KINDS = {};           // named horns ("siren", "plain", "air", "jingle"…) → (R) => void
export const S = store("rides", { seen: {}, tickets: 0, patients: 0, cones: 0, fares: 0, spikes: 0, patches: 0, impostor: 0, rides: {} });

/** Register a ride def (see index.js for the shape). Later defs for the same key win. */
export function add(def) {
    if (!def || !def.id) return null;
    DEFS.set(def.id, def);
    for (const k of def.keys || []) BY_KEY.set(k, def);
    if (def.traffic) {
        const tr = def.traffic;
        if (tr.spec && !kindSpec(tr.kind)) registerKind(tr.kind, tr.spec);
        FLEET.push(tr);
        addJack(tr);
    }
    return def;
}
/** Make a fleet vehicle jackable (streets' RIDES table) and give the big ones a roomier camera. */
export function addJack(tr) {
    const st = ctx.streets;
    if (!st || !st.rides || !tr.jack) return;
    for (const k of [tr.kind, ...(tr.alsoKinds || [])]) if (!st.rides[k]) st.rides[k] = tr.jack;
    if (tr.cam && st.cams && tr.jack.model && !st.cams[tr.jack.model]) st.cams[tr.jack.model] = tr.cam;
}
