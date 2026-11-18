// features/memory — the persistent record (save3d › f.memory), capped, plus
// notoriety (read from the SHARED 2D save: arrests, ER visits, escapes, carjacks)
// and the small helpers every part shares (gates, rate limits, picks).
import { ctx } from "../../core/ctx.js";
import { store, saveSoon, shared, save3d } from "../../core/save.js";

export const ID = "memory";
export const CAP = { grudges: 6, log: 8, kinds: 16, texts: 6, paints: 5 };

export const M = store(ID, {
    v: 1,
    runs: 0,            // real runs started (a "later run" = a bigger number)
    grudges: [],        // [{ id, name, key, colors, kind, color, run, at, seen, lastRun }]
    log: {},            // remember(kind, data) → { kind: [records…] } (≤ CAP.log each)
    texts: [],          // queued texts [{ from, emoji, color, msg, thread, run, after }]
    poster: null,       // a WANTED billboard owed to the next run(s): { heat, why, run, left }
    maxStars: 0,        // the hottest chase she's ever had
    escapes: 0,         // chases she got away from (memory's own count)
    hitch: { picks: 0, passes: 0, drops: 0 },
    avi: {},            // the notoriety Avigail has already commented on
    last: {},           // rate limits: { key: run number }
});
// older saves / hand-edited ones: make sure the shapes are right
if (!Array.isArray(M.grudges)) M.grudges = [];
if (!Array.isArray(M.texts)) M.texts = [];
if (!M.log || typeof M.log !== "object") M.log = {};
if (!M.hitch || typeof M.hitch !== "object") M.hitch = { picks: 0, passes: 0, drops: 0 };
if (!M.avi || typeof M.avi !== "object") M.avi = {};
if (!M.last || typeof M.last !== "object") M.last = {};

export const dirty = () => saveSoon();

/** Random / surprise content: on in the game, opt-in in ?test, never in a 🎉 party. */
export const live = () => ctx.enabled(ID) && !(ctx.party && ctx.party.active);
/** Personal surprises nobody else sees (a recognition line, a text on HER phone): also in a 🎉 party. */
export const personal = () => ctx.enabled(ID);
/** Tests: every dice roll succeeds (knobs.always) or a fixed roll. */
export const knobs = { always: false, act: null, variant: null };
export const chance = p => knobs.always || Math.random() < p;
export const pick = l => l[Math.floor(Math.random() * l.length)];
export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const fill = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
export const chatter = () => (save3d.settings && save3d.settings.chatter) || "normal";

/** Once per run per key (persistent: a reload doesn't reset it). */
export function oncePerRun(key) {
    if (M.last[key] === M.runs && !knobs.always) return false;
    M.last[key] = M.runs;
    dirty();
    return true;
}

const OWN = new Set(["paint", "carjack", "booked"]);
/** A generic record: kept per kind, newest last, capped. */
export function logPush(kind, data) {
    const k = String(kind).slice(0, 24);
    if (!M.log[k]) {
        // full: the oldest kind goes (memory's own kinds stay)
        const kinds = Object.keys(M.log);
        if (kinds.length >= CAP.kinds) delete M.log[kinds.find(x => !OWN.has(x)) || kinds[0]];
        M.log[k] = [];
    }
    const rec = Object.assign({}, data, { run: M.runs, at: Date.now() });
    M.log[k].push(rec);
    while (M.log[k].length > CAP.log) M.log[k].shift();
    dirty();
    return rec;
}

// ── notoriety ─────────────────────────────────────────────────────────────
const TITLES = ["Upstanding citizen", "Local menace", "Person of interest", "Most wanted", "Folk legend"];
/** How notorious Lulu is right now (the shared save + memory's own counts). */
export function notoriety() {
    const s = shared.get(), st = s.stats || {};
    const booked = st.booked || 0;
    const arrests = Math.max(s.convictions || 0, booked);
    const escapes = Math.max(M.escapes || 0, st.escapes2 || 0) + (st.jailbreaks || 0);
    const er = s.erVisits || 0;
    const carjacks = st.carjacks || 0;
    const maxStars = M.maxStars || 0;
    const score = arrests * 3 + escapes * 2 + er + carjacks * 2 + maxStars * 2 + Math.min(10, s.offenses || 0);
    const level = score >= 40 ? 4 : score >= 20 ? 3 : score >= 8 ? 2 : score >= 1 ? 1 : 0;
    return { score, level, title: TITLES[level], arrests, mugshots: Math.max(booked, arrests), escapes, er, carjacks, maxStars,
        grudges: M.grudges.length };
}
