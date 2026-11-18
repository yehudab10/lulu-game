// features/underworld — 🌡️ HEAT (the street's opinion of Lulu) + 🧠 RIVALS (bad guys who remember her).
//
// Heat 0–100 lives in the 3D save: dirty jobs, bribes and selling hot cars add to it; it cools while
// she plays (TUNE.heat.cool per s) and while she's away (coolAway per real minute). While it's high the
// cops are on alert — law's pursuit table (ctx.law.tune) is scaled: they see further, a ⚠️ warning drains
// slower, the warrant file recognises her quicker. Everything is put back exactly at heat 0 / outside a
// live underworld (a test, a 🎉 party).
//
// Rivals: a road-rager, a gang, a pickpocket she escaped or got busted come back in a later encounter
// (same name, a recognition line), remembered in features/memory's log + a text afterwards.
import { ctx } from "../../core/ctx.js";
import { TUNE, FIXER, RIVAL_NAMES, MEMO } from "./data.js";
import { SAVE, UW, dirty, live, pick, clamp, fill, toast, log } from "./common.js";

// cool off for the time she was away (real time)
(() => {
    const now = Date.now(), at = SAVE.at || now;
    const mins = Math.max(0, (now - at) / 60000);
    if (SAVE.heat > 0 && mins > 0.2) SAVE.heat = Math.max(0, SAVE.heat - mins * TUNE.heat.coolAway);
    SAVE.at = now;
})();

export function heat() { return SAVE.heat || 0; }
export function heatLevel(h = heat()) {
    let out = TUNE.heat.levels[0];
    for (const l of TUNE.heat.levels) if (h >= l[0]) out = l;
    return { i: TUNE.heat.levels.indexOf(out), name: out[1] };
}
/** Add (or remove) heat. → the new heat. */
export function addHeat(n, why = "") {
    const before = heatLevel();
    SAVE.heat = clamp((SAVE.heat || 0) + n, 0, TUNE.heat.max);
    SAVE.at = Date.now();
    dirty();
    const after = heatLevel();
    if (n > 0) log("heat", { n, why, heat: Math.round(SAVE.heat) });
    if (after.i > before.i && after.i >= 2) toast(`${after.name} — the street's talking. Cops are on alert.`, "red", "uw:heat");
    if (after.i === 0 && before.i > 0) fixerCool();
    applyAlert();
    return SAVE.heat;
}
function fixerCool() {
    if (!live() || !ctx.phone || !ctx.phone.text || ctx.state !== "playing") return;
    try { ctx.phone.text({ from: "THE FIXER", emoji: "🕶️", color: "#455A64", msg: FIXER.cool, thread: "fixer" }); } catch (e) { /* no phone */ }
}

// ── what heat does to the law (scaled tuning; restored exactly) ──────────
let base = null, applied = -1;
export function applyAlert(force = false) {
    const T = ctx.law && ctx.law.tune;
    if (!T) return;
    if (!base) base = { sight: T.sight.slice(), susDecay: T.susDecay, warrantSee: T.warrantSee };
    const h = live() ? clamp(heat() / TUNE.heat.max, 0, 1) : 0;
    const k = Math.round(h * 20) / 20;                   // (steps of 5 %: no churn every frame)
    if (k === applied && !force) return;
    applied = k;
    for (let i = 0; i < base.sight.length; i++) T.sight[i] = base.sight[i] * (1 + TUNE.heat.sight * k);
    T.susDecay = base.susDecay * (1 - TUNE.heat.decay * k);
    T.warrantSee = base.warrantSee * (1 - TUNE.heat.warrant * k);
}
/** Per frame while playing: cool off. */
export function heatTick(dt) {
    if (SAVE.heat > 0) {
        const was = SAVE.heat, lv = heatLevel(was).i;
        SAVE.heat = Math.max(0, SAVE.heat - TUNE.heat.cool * dt);
        if (Math.floor(was) !== Math.floor(SAVE.heat)) { SAVE.at = Date.now(); dirty(); }
        // cooled right down: the Fixer's phone works again
        if (lv > 0 && heatLevel().i === 0) { log("heat", { n: 0, why: "cooled", heat: Math.round(SAVE.heat) }); fixerCool(); }
    }
    applyAlert();
}
/** Undo everything (tests, a party). */
export function alertOff() { applied = -1; const T = ctx.law && ctx.law.tune; if (T && base) { for (let i = 0; i < base.sight.length; i++) T.sight[i] = base.sight[i]; T.susDecay = base.susDecay; T.warrantSee = base.warrantSee; } }

// ── rivals ────────────────────────────────────────────────────────────────
let rid = 0;
/** A rival for an encounter of `kind`: a known one comes back (~55 %), else a new face. */
export function rivalFor(kind, { fresh = false, forceKnown = false } = {}) {
    const known = SAVE.rivals.filter(r => r.kind === kind && r.lastRun !== runNo());
    if (!fresh && known.length && (forceKnown || Math.random() < 0.55)) {
        const r = pick(known);
        r.met = (r.met || 0) + 1;
        r.lastRun = runNo();
        dirty();
        return r;
    }
    const used = new Set(SAVE.rivals.map(r => r.name));
    const names = RIVAL_NAMES[kind].filter(n => !used.has(n));
    const r = { id: `${kind}${Date.now() % 100000}${rid++}`, kind, name: pick(names.length ? names : RIVAL_NAMES[kind]), met: 1, escaped: 0, busted: 0, lastRun: runNo(), fresh: true };
    SAVE.rivals.push(r);
    while (SAVE.rivals.length > 6) SAVE.rivals.shift();
    dirty();
    return r;
}
const runNo = () => (ctx.memory && ctx.memory.runs) || UW.runs || 0;
/** How an encounter ended: "busted" (cops / Shomrim / a tackle) · "escaped" (she got away) · "won" (he got away / gave up). */
export function rivalResult(r, result) {
    if (!r) return;
    if (result === "busted") r.busted = (r.busted || 0) + 1;
    if (result === "escaped") r.escaped = (r.escaped || 0) + 1;
    r.last = result;
    r.fresh = false;
    dirty();
    try { if (ctx.memory && ctx.memory.remember) ctx.memory.remember("underworld", { kind: r.kind, name: r.name, result }); } catch (e) { /* no memory */ }
    // a text afterwards (memory spaces texts out: ≥ 40 s apart, ≤ 3 a run)
    const tpl = result === "busted" ? MEMO.bustedText[r.kind] : result === "escaped" ? MEMO.escapedText[r.kind] : null;
    if (tpl && ctx.memory && ctx.memory.text && Math.random() < 0.7) {
        try { ctx.memory.text({ from: r.name, emoji: r.kind === "gang" ? "😎" : r.kind === "rager" ? "😡" : "🫳", color: "#C62828", msg: fill(tpl, { name: r.name }), thread: r.name }, { after: 25 }); } catch (e) { /* no memory */ }
    }
}
