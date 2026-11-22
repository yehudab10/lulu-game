// features/cityhall/permits.js — 📝 PERMITS (stage 3). Nothing ever waits for a permit: when she does something the town has
// a form for — a tenant moves into one of her homes (`realestate:tenant` {phase: "in"}), the outside of her family house
// changes (`decor:place` on an outside slot: the door, the porch, the mailbox, the lawn) — a quiet note in 📱 Messages ›
// City Hall asks her to come in. The errand, at city hall, three short steps:
//   1. PERMITS: the form "in triplicate" — two silly questions (one choice each)
//   2. TAXES: the stamp (or COMPLAINTS, when Taxes is "back in 5 minutes": they borrowed the stamp)
//   3. PERMITS again: PERMIT GRANTED (free — the stamp was the fee). One must-see banner, the rest is dialogue.
// One permit at a time per kind (≤ 5 open); a granted one is remembered (the inspector asks to see it).
import { ctx, on, emit } from "../../core/ctx.js";
import * as H from "../../hud.js";
import { PERMITS, PERMIT_SLOTS, PERMIT_LINES as PL, TAX_LINES as TL, WINDOWS } from "./data.js";
import { addWindowHook, WIN_LABELS } from "./lobby.js";
import { S, saveSoon, stat, closedWindow } from "./state.js";

if (!S.permits || typeof S.permits !== "object") S.permits = { open: [], granted: [] };
const P = S.permits;
if (!Array.isArray(P.open)) P.open = [];
if (!Array.isArray(P.granted)) P.granted = [];
const pick = a => a[Math.floor(Math.random() * a.length)];

/** Ask for a permit for `kind` (+ the home it's for). → the open permit or null (already open / unknown) */
export function needPermit(kind, home = null) {
    const def = PERMITS[kind];
    if (!def || P.open.some(p => p.kind === kind) || P.open.length >= 5) return null;
    const p = { kind, home, step: 0, at: Date.now() };
    P.open.push(p);
    saveSoon();
    try { if (ctx.phone && ctx.phone.inbox && ctx.phone.inbox.post) ctx.phone.inbox.post({ from: TL.from, emoji: "📝", color: TL.color, msg: PL.note(def), thread: "City Hall" }); } catch (e) { /* no phone */ }
    emit("cityhall:permit", { phase: "needed", kind, home });
    return p;
}
/** Has she a granted permit for this home (or, with no home, for this kind)? */
export const hasPermit = (home, kind = null) => P.granted.some(g => (home && g.home === home) || (!home && kind && g.kind === kind));
export const openPermits = () => P.open.slice();
/** Where the stamp is today: Taxes, unless Taxes is the closed window (then Complaints). */
export const stampWindow = () => (closedWindow() === 1 ? "complaints" : "taxes");
const winName = id => (WINDOWS.find(w => w.id === id) || { label: id }).label;

// ── the windows ──
addWindowHook("permits", async (rt, who, name) => {
    const o = { emoji: "📝", person: who, color: "#6D4C41" };
    const p = P.open.find(x => x.step === 2) || P.open.find(x => x.step === 0) || P.open.find(x => x.step === 1);
    if (!p) return false;
    const def = PERMITS[p.kind];
    if (p.step === 1) { await rt.say(name, PL.toStamp(winName(stampWindow())), o); return true; }
    if (p.step === 2) {
        P.open.splice(P.open.indexOf(p), 1);
        P.granted.push({ kind: p.kind, home: p.home, at: Date.now() });
        if (P.granted.length > 30) P.granted.shift();
        saveSoon();
        stat("cityhallPermits");
        emit("cityhall:permit", { phase: "granted", kind: p.kind, home: p.home });
        H.banner(`📝 <b>PERMIT GRANTED</b><small>${def.form} · ${def.what}</small>`, 2600, { key: "cityhall:permit", prio: 3 });
        if (who) rt.burst(who.p.obj.position.clone().setY(1.6), undefined, 12, 1.8, 0.05);
        await rt.say(name, PL.granted(def), o);
        return true;
    }
    // step 0: the form, in triplicate — two of the three questions
    await rt.say(name, PL.start(def), o);
    if (rt.disposed) return true;
    const qs = PL.questions.slice().sort(() => Math.random() - 0.5).slice(0, 2);
    for (const q of qs) {
        const i = await rt.choose(name, q.q, q.a, o);
        if (rt.disposed || i < 0) return true;
    }
    p.step = 1; saveSoon();
    emit("cityhall:permit", { phase: "form", kind: p.kind });
    await rt.say(name, PL.toStamp(winName(stampWindow())), o);
    return true;
}, 10);
async function stampHook(rt, who, name, id) {
    const p = P.open.find(x => x.step === 1);
    if (!p || stampWindow() !== id) return false;
    const o = { emoji: "🖃", person: who, color: "#2E7D32" };
    if (id === "complaints") await rt.say(name, PL.borrowed, o);
    if (rt.disposed) return true;
    p.step = 2; saveSoon();
    emit("cityhall:permit", { phase: "stamped", kind: p.kind });
    await rt.say(name, pick(PL.stamp), o);
    return true;
}
addWindowHook("taxes", (rt, who, name) => stampHook(rt, who, name, "taxes"), 10);
addWindowHook("complaints", (rt, who, name) => stampHook(rt, who, name, "complaints"), 10);
WIN_LABELS.taxes = () => (P.open.some(x => x.step === 1) && stampWindow() === "taxes" ? PL.stampLabel : null);
WIN_LABELS.complaints = () => (P.open.some(x => x.step === 1) && stampWindow() === "complaints" ? PL.stampLabel : null);
WIN_LABELS.permits = () => (P.open.some(x => x.step === 2) ? PL.backLabel : P.open.some(x => x.step === 0) ? "📝 PERMITS — you need a form" : null);

// ── what needs a permit ──
on("realestate:tenant", e => { if (e && e.phase === "in" && e.id) needPermit("tenant", e.id); });
on("decor:place", e => {
    const k = e && PERMIT_SLOTS[e.slot];
    if (!k || ctx.state === "title") return;
    if (!e.bought && !(ctx.cityhall && ctx.cityhall.debug && ctx.cityhall.debug.force.permitAnyPlace)) return;     // (only a real change: something she just bought)
    needPermit(k, "family");
});
export const PM = P;
