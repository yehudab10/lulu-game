// features/storefronts/assign.js — WHICH STATE EACH FRONT IS IN, decided as the town builds (town/fronts.js' namer):
// in build order (deterministic — the same for every player and every lap), the FIRST front showing a named shop is that
// shop; every later front with the same name becomes the street's next NEW shop (data.js › SHOPS rows with a `list`), and
// after those the cycle of non-shops (FOR LEASE · COMING SOON · offices · closed for good). Midwood's east end of Avenue M
// is kept as one long front for the bowling alley.
import { ctx } from "../../core/ctx.js";
import { SHOPS, NAMED, SOON, BOWLING, FILL_SIGN, FILL_CYCLE } from "./data.js";

const WEEK0 = Date.UTC(2026, 0, 4);
/** The real week number (COMING SOON's sign changes each one). */
export const weekNo = (d = new Date()) => Math.max(0, Math.floor((d.getTime() - WEEK0) / (7 * 864e5)));
export const soonLines = (d = new Date()) => ["COMING SOON", SOON[weekNo(d) % SOON.length]];

const PLAIN = {
    lease: { bg: "#FFFDE7", fg: ["#B71C1C", "#5D4037"] }, soon: { bg: "#FFF8E1", fg: ["#BF360C", "#5D4037"] },
    office: { bg: "#ECEFF1", fg: ["#263238", "#546E7A"] }, dentist: { bg: "#E3F2FD", fg: ["#0D47A1", "#546E7A"] }, gone: { bg: "#EFEBE9", fg: ["#3E2723", "#6D4C41"] },
};
const townOf = (id, row) => (row.list === "shops" ? "lakewood" : row.list ? "midwood" : null);

/** The namer: ({ town, list, lines, x, z, i }, memo) → { lines, state, shop?, named?, reserved?, bowling? }. */
export function nameFront(f, memo) {
    const r = pickState(f, memo);
    // (fronts another feature will take: ci/carcare — the named Coney Island Ave shops + both Minivan Washes; ci/lanes — the
    //  bowling alley's Avenue M run. Their state stays as it is until that feature claims them.)
    // (only the NAMED car-care shops: the row's unnamed copies are ordinary fronts — FOR LEASE for player shops etc.)
    if (r && r.reserved === "carcare") r.reserved = "carcare";
    if (r && r.bowling) r.reserved = "lanes";
    return r;
}
function pickState(f, memo) {
    const town = f.town, list = f.list || "avej";
    const used = memo.used || (memo.used = new Set());
    const B = BOWLING;
    if (town === B.town && list === B.list && f.x >= B.x0 && f.x <= B.x1 && f.z >= B.z0 && f.z <= B.z1)
        return { lines: ctx.lanes ? B.open : B.sign, state: "soon", bowling: true, style: PLAIN.soon, small: true };
    const name = f.lines && f.lines[0];
    if (name && !used.has(name)) {
        used.add(name);
        if (SHOPS[name]) return { lines: SHOPS[name].sign || f.lines, state: "open", shop: name };
        if (NAMED[name]) { const N = NAMED[name]; return { lines: N.sign || f.lines, state: N.state, named: name, reserved: N.reserved || null }; }
    }
    // a copy: this street's next new shop…
    for (const id of Object.keys(SHOPS)) {
        const S = SHOPS[id];
        if (S.list === list && townOf(town, S) === town && !used.has(id)) { used.add(id); return { lines: S.sign, state: "open", shop: id }; }
    }
    // …then the cycle of non-shops (one counter per town: neighbouring streets don't line up the same)
    // (one plain style + a smaller sign for all of them, whatever the street: one atlas cell per text — the town's sign
    //  atlas is tight, and these are a handful of shared texts)
    const k = memo.k = (memo.k || 0) + 1;
    const cyc = FILL_CYCLE[town] || FILL_CYCLE.midwood;
    const state = cyc[(k - 1) % cyc.length];
    const signs = FILL_SIGN[town] || FILL_SIGN.midwood;
    return { lines: state === "soon" ? soonLines() : signs[state] || signs.lease, state, style: PLAIN[state] || PLAIN.lease, small: true };
}
