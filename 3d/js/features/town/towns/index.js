// features/town/towns — every town you can turn into. Each is plain data (see lakewood.js,
// midwood.js); the engine (plan / build / cars / life / rail / landmarks) and the highway exits
// read it. Add a town: write towns/<id>.js (+ its lines), import it here, give it a stop on the ROUTE (its own
// interchange — see routeAt), and (if it
// needs new block uses or props) teach build.js's layoutFace / the asset modules about them.
import lakewood from "./lakewood.js";
import midwood from "./midwood.js";

export const TOWNS = { lakewood, midwood };
/** The default town (tests / debug / `ctx.town.enter()` with no town): Lakewood. Kept for callers that index by k. */
export function townFor(k = 0) { return k % 2 ? TOWNS.midwood : TOWNS.lakewood; }

/**
 * Cruise's interchanges: every one offers BOTH towns — one off-ramp that splits after the gore
 * (the inner branch first). `signs` are the interchange's own boards (each town's funny copy is on
 * its own branch); `{no}` / `{label}` in a line fill in per town (joined with " · ").
 */
export const INTERCHANGE = {
    towns: [lakewood, midwood],
    signs: {
        mile: ["EXITS {no}", "{label}", "1 MI"],
        half: ["{no0} {label0} ↗", "{no1} {label1} ↗", "½ MI · totally optional"],
        lastChance: ["LAKEWOOD OR BROOKLYN?", "CHOOSE WISELY", "(or just keep driving)"],
        thru: ["↑ THRU TRAFFIC", "EVERYWHERE ELSE", "(no pressure)"],
        exitOnly: ["EXIT {no} ↘", "{label}", "EXIT ONLY"],
        gore: ["EXIT ↗", "{no}"],
        split: ["↖ {no0} {label0}", "↗ {no1} {label1}"],
    },
};
/**
 * The road's geography (ci/exits2, roadmap 13 — the owner: "Brooklyn and Lakewood shouldn't share the same exit"): every
 * town has its OWN interchange, in this order along the highway, the pattern repeating every `period` m on an endless
 * drive. Pure data: the k-th exit is at `routeAt(k).s` (then slid a little by exit.js FIT until its town fits beside the
 * road — the highway's shape is fixed, so the same metres on every run and on every friend's screen). Home (Lulu's house,
 * ci/hometown) is in Midwood: its exit is the first one.
 */
export const ROUTE = { period: 8000, stops: [{ town: midwood, at: 3600 }, { town: lakewood, at: 7600 }] };
export function routeAt(k) {
    const n = ROUTE.stops.length, st = ROUTE.stops[((k % n) + n) % n];
    return { k, town: st.town, s: st.at + Math.floor(k / n) * ROUTE.period };
}
/** The first route index whose exit is at or past s. */
export function routeFrom(s) { let k = Math.max(0, Math.floor((s - ROUTE.stops[0].at) / ROUTE.period) * ROUTE.stops.length); while (routeAt(k).s < s) k++; return k; }

/** Fill a sign line for a set of towns: {no} → "91 · 9", {label} → "LAKEWOOD · BROOKLYN", {no1} → the second town's… */
export function fillLine(line, towns) {
    return line.replace(/\{(no|label|short)(\d?)\}/g, (_, k, i) => i !== "" ? (towns[+i] ? towns[+i].highway[k] : "") : towns.map(t => t.highway[k]).join(" · "));
}

/**
 * A town as it stands ATTACHED to the highway at an interchange: its data with `def.attach` applied (streets
 * trimmed / added, woods / skyline / signs / barricades / exits for that layout) plus its APPROACH — the interchange's
 * cross road from just past its T-junction (`d0` m out) to `ext` m into the drawn street at `attach.join`, along
 * `attach.dir` (plan.js: a street of the plan the build never draws). `xFar` is how far out the cross road's own asphalt
 * runs (exit.js X_FAR): the join sits there. Cached per (town, d0, xFar). The stand-alone def is untouched.
 */
const ATT = new Map();
export function attachedDef(def, d0, xFar, ext = 8) {
    const A = def.attach;
    if (!A) return null;
    const key = def.id + ":" + d0 + ":" + xFar;
    if (ATT.has(key)) return ATT.get(key);
    const ux = Math.sin(A.dir), uz = Math.cos(A.dir), back = xFar - d0;
    const streets = def.streets.map(st => A.streets && A.streets[st.name] ? Object.assign({}, st, A.streets[st.name]) : st).concat(A.addStreets || []);
    const drop = new Set(A.dropSigns || []);
    const out = Object.assign({}, def, {
        attached: true, base: def, streets,
        woods: A.woods || def.woods, skyline: A.skyline || def.skyline, exits: A.exits || def.exits,
        barricades: (def.barricades || []).concat(A.barricades || []),
        signs: (def.signs || []).filter(sg => !drop.has(sg.lines)),
        approach: { name: (A.name || (def.streets.find(st => st.name === A.street) || {}).name) || null,
            from: [A.join[0] - ux * back, A.join[1] - uz * back], to: [A.join[0] + ux * ext, A.join[1] + uz * ext], d0 },
    });
    // the approach is named after the street it runs into
    if (!out.approach.name) out.approach.name = (streets.find(st => st.axis === "ns" ? Math.abs(st.c - A.join[0]) < 0.5 && Math.abs(st.a0 - A.join[1]) < 0.5
        : st.axis === "ew" && Math.abs(st.c - A.join[1]) < 0.5 && Math.abs(st.a0 - A.join[0]) < 0.5) || { name: def.name }).name;
    ATT.set(key, out);
    return out;
}

