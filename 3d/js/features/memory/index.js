// ─────────────────────────────────────────────────────────────────────────
//  features/memory — 🧠 A WORLD THAT REMEMBERS LULU.
//
//  A small, capped record in save3d (f.memory) of what Lulu did, paid off IN the
//  world in later runs — no menus, no HUD:
//   grudge.js     😤 the driver she carjacked comes back in traffic (same car, same
//                 paint, same face): honks, yells, tailgates / brake-checks / calls
//                 the cops (a call-in) / forgives her
//   texts.js      📱 cab fares, delivery customers and Uncle Moishe text afterwards;
//                 Avigail texts about Lulu's growing notoriety (ctx.phone.text)
//   poster.js     🪧 "WANTED: LULU" billboards after a 4–5★ chase / an escape / a
//                 jailbreak (banter's billboard, our face), evolving with notoriety
//   recognize.js  👀 small recognitions other features ask for: the cop at the window,
//                 Moishe at Paint & Pray, the hitchhiker, Avigail (coupe + porch)
//   data.js · lines.js · sfx.js
//
//  Service ctx.memory: grudges · notoriety() · remember(kind, data) · recall(kind) ·
//  recognize(who, info) · spawnGrudge(rec, opts) · text(t, when) · poster(ahead) · debug.
//  Events: memory:grudge {name, kind, color, act, seen} · memory:billboard {variant, key, s, side}.
//  Everything random is gated by ctx.enabled("memory") (opt-in in ?test, OFF in a 🎉 party);
//  remembering itself is always on (outside parties).
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on, hook } from "../../core/ctx.js";
import { saveNow } from "../../core/save.js";
import { M, CAP, ID, dirty, live, knobs, notoriety, logPush } from "./data.js";
import { GR, addGrudge, eligible, scheduleGrudge, grudgeTick, grudgeAfter, grudgeReset, spawnGrudge, forgive, canMeet } from "./grudge.js";
import { TX, queueText, textsTick, textsRunStart, onJobStart, onJobEnd, aviRunStart, faresMet, deliveryStars } from "./texts.js";
import { PS, AD_ID, posterDesign, posterRunStart, posterTick, posterChunk, chaseTick, chaseEnded, released, owe, posterNow, variants } from "./poster.js";
import { RC, recognize, rememberPaint } from "./recognize.js";

const party = () => !!(ctx.party && ctx.party.active);

// ── what the world remembers ──────────────────────────────────────────────
// (a 🎉 party remembers too — it's HER history; the grudge cars + WANTED posters it earns turn up in a later solo run)
on("streets:carjack", e => { addGrudge(e); logPush("carjack", { kind: e.kind, color: e.color || null, witnessed: !!e.witnessed }); });
on("streets:paint", e => rememberPaint(e));
on("cop:chase", e => chaseEnded(e));
on("law:release", e => released(e));
on("law:booked", e => { logPush("booked", { charges: (e.charges || []).slice(0, 3) }); });
on("hustle:start", () => onJobStart());
on("hustle:end", e => onJobEnd(e));

// ── run lifecycle ─────────────────────────────────────────────────────────
on("run:start", () => {
    grudgeReset();
    M.runs = (M.runs || 0) + 1;
    dirty();
    textsRunStart();
    // a 🎉 party: no grudge car in the shared traffic, no WANTED billboard (it'd reserve roadside space on ONE
    // screen) — texts + recognition lines are personal, so they stay
    if (party()) { GR.sched = -1; PS.want = false; aviRunStart(); return; }
    scheduleGrudge();
    posterRunStart();
    aviRunStart();
});
on("state", ({ to }) => { if (to === "title") grudgeReset(); });

// every driving frame
hook("update", dt => {
    chaseTick();
    if (ctx.state !== "playing") return;
    try { grudgeTick(dt); grudgeAfter(); } catch (e) { console.error("[memory] grudge", e); }
    try { posterTick(); } catch (e) { console.error("[memory] poster", e); }
    try { textsTick(dt); } catch (e) { console.error("[memory] texts", e); }
}, -6);
on("chunk:build", e => { try { posterChunk(e); } catch (err) { console.error("[memory] poster chunk", err); } });

on("boot", () => {
    if (ctx.banter && ctx.banter.addAd) ctx.banter.addAd({ id: AD_ID, dynamic: posterDesign });
});

// ── the service ───────────────────────────────────────────────────────────
ctx.memory = {
    /** The remembered carjack victims (live array, oldest first, ≤ 6). */
    get grudges() { return M.grudges; },
    /** How notorious she is: { score, level 0–4, title, arrests, mugshots, escapes, er, carjacks, maxStars, grudges }. */
    notoriety,
    /**
     * Remember something. kind "grudge" → a grudge (streets:carjack-shaped data: { kind, color, driver: {key, colors}, name });
     * "poster" → owe her a WANTED billboard ({ heat, why }); "text" → queue a text ({ from, emoji, color, msg, thread, next });
     * any other kind → a capped log (≤ 8 records each, ≤ 16 kinds) you read back with recall(kind).
     */
    remember(kind, data = {}) {
        if (kind === "grudge") return addGrudge(data);
        if (kind === "poster") { owe(data); return M.poster; }
        if (kind === "text") return queueText(data, { next: !!data.next, after: data.after });
        return logPush(kind, data);
    },
    /** Read it back: "grudge"(s) · "poster" · "text"(s) · "hitch" · any logged kind → a copy (array / object / null). */
    recall(kind) {
        if (kind === "grudge" || kind === "grudges") return M.grudges.map(g => Object.assign({}, g));
        if (kind === "poster") return M.poster ? Object.assign({}, M.poster) : null;
        if (kind === "text" || kind === "texts") return M.texts.map(x => Object.assign({}, x));
        if (kind === "hitch") return Object.assign({}, M.hitch);
        return (M.log[kind] || []).map(x => Object.assign({}, x));
    },
    /** A rate-limited recognition line for `who` ("cop" | "moishe" | "hitch" | "avigailRoad" | "avigailPorch") or "". */
    recognize,
    /** The grudge car, now (the town can use it): rec = a grudge (default: a ripe one), opts { act, behind, force }. → Promise<car|null> */
    spawnGrudge,
    /** Is now a good moment for a grudge visit? */
    canMeet,
    /** Let a grudge go. */
    forgive,
    /** Queue a text: t { from, emoji, color, msg, thread }, when { next, after }. */
    text: (t, when) => queueText(t, when),
    /** Hang the WANTED poster `ahead` metres up the road now (variant "wanted" | "honk" | "free"). */
    poster: (ahead = 70, side = -1, variant = null) => posterNow(ahead, side, variant),
    get runs() { return M.runs; },
    /** Tests / debug: internals + knobs ({ always, act, variant }). */
    debug: { M, GR, TX, PS, RC, CAP, knobs, eligible, faresMet, deliveryStars, variants, posterDesign, save: () => saveNow(), ID, live },
};
