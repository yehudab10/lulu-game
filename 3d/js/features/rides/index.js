// ─────────────────────────────────────────────────────────────────────────
//  features/rides — 🚓🚑🍦 EVERY RIDE IS ITS OWN THING.
//
//  Whatever Lulu ends up driving (a carjacked car, a car she hotwired on foot, a
//  hailed cruiser…) can bring its own handling, weight, horn and ONE trick:
//
//    🚓 cop car     horn = siren (traffic pulls onto the shoulder) · trick = 🚨 PULL OVER
//                   the car ahead (law's copStop scene: bribes, warnings, runners…),
//                   📣 megaphone lines, 🛑 spike strips behind her in a chase; real cops
//                   who see her playing cop get suspicious → IMPERSONATING AN OFFICER
//    🚑 ambulance   horn = siren · dispatch sends her to a patient on the shoulder → stop
//                   beside them → rush them to St. Shloimy's ER bay against the clock
//                   (bumps cost the tip) · trick = 🩹 PATCH UP (+1 ❤️, 2 kits a ride);
//                   the ER remembers the paramedic and chips in on her bill
//    🍦 ice cream   horn = the jingle · pull over, stop, jingle → kids run up with coins
//    🚌 bus         air horn · 🚏 stops ahead: stop at one, riders board and pay · heavy
//    🚚 box truck   air horn · heavy: small cars bounce off, light bumps cost no heart
//    🏎️ sports car  nitro hits harder and lasts longer
//    🚕 taxi        trick = start a 🚕 Lulu Cab shift (hustle) · +50 % on fares in a real cab
//
//  Data-driven: ctx.rides.add(def) keyed by the ride's model key (ctx.foot.vehicle.kind);
//  a def may also put its vehicle into traffic and make it jackable (def.traffic).
//  Input: the horn (L1 / H / HONK) is the ride's horn; the trick is HOLD the horn on a
//  controller, X on a keyboard, one contextual touch button — nothing shows outside a ride.
//  Random content (patients, kids, bus riders, extra traffic) is gated by ctx.enabled("rides");
//  in a 🎉 party the fleet is SEEDED into the shared traffic (ctx.party.addTrafficKind: the same ambulance at the
//  same place on every friend's screen — claim it / jack it like any shared car); rides, tricks and their personal
//  props (patients, kids, riders) are per player.
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on, hook, emit, css } from "../../core/ctx.js";
import { input, glyphSet, addTouchButton, rumble } from "../../input.js";
import { setControlRow } from "../../core/screens.js";
import { saveSoon } from "../../core/save.js";
import { SKINS } from "../../car.js";
import { kindSpec, specOfModel } from "../../traffic.js";
import * as H from "../../hud.js";
import { setSiren, sirenTick, releaseAll, yieldingCount, R_stats, nudgeAhead } from "./siren.js";
import { live, partyOn, need, toast, trickGlyph } from "./common.js";
import { DEFS, BY_KEY, FLEET, S, add, addJack, HORN_KINDS } from "./registry.js";
import "./vehicles.js";
import { ambDebug } from "./ambulance.js";
import { iceDebug } from "./icecream.js";
import { busDebug } from "./bus.js";

const HOLD = 0.42;               // seconds on the horn = the trick (controller)

let R = null;                    // the live ride
let curObj = null;               // the shell it lives on
let keyAct = false;              // X pressed this frame

// ── the live ride ────────────────────────────────────────────────────────
function poll() {
    const so = (ctx.foot && ctx.foot.shellObj) || null;
    if (so === curObj) return;
    if (R) exitRide("swap");
    curObj = so;
    // her collision body follows what she drives: a ride's shell its kind's own (a bus is 10 m long, not her car's 4.6)
    const sp = so && ctx.foot.vehicle ? specOfModel(ctx.foot.vehicle.kind) : null;
    if (ctx.car) { ctx.car.circles = sp && sp.circles && sp.circles.length ? sp.circles.slice() : null; ctx.car.radius = sp && sp.circles ? Math.max(0.85, sp.r || 1) : null; }
    if (!so) return;                                   // (in a 🎉 party too: handling, horns, tricks are per player)
    const v = ctx.foot.vehicle;
    const def = v && BY_KEY.get(v.kind);
    if (def) enterRide(def, so, v);
}
function enterRide(def, obj, v) {
    const car = ctx.car;
    R = { id: def.id, def, key: v.kind, obj, t: 0, siren: false, bar: null, snd: null, stats: null, data: {},
        horn: { down: false, t: 0, fired: false }, act: null, hinted: false };
    // handling: the ride's own (a jacked one already brought some) + weight + nitro
    const own = car.stats !== SKINS[car.skinKey];
    const st = Object.assign({}, car.stats, own ? null : def.handling || null);
    if (def.nitro) { st.nitroTop = def.nitro.top; st.nitroAcc = def.nitro.acc; }
    car.stats = st;
    R.stats = st;
    car.mass = def.mass || 1;
    // rides that STOP on the shoulder for work (the ER bay, bus stops, ice cream) keep the parking pull-over prompt away
    if (def.stops && ctx.G) { R.noPullOverWas = ctx.G.noPullOver; ctx.G.noPullOver = true; }
    S.rides[def.id] = (S.rides[def.id] || 0) + 1;
    saveSoon();
    try { if (def.enter) def.enter(R); } catch (e) { console.error("[rides] enter", def.id, e); }
    emit("rides:enter", { id: def.id, key: v.kind });
    emit("stat", { id: "ridesTried", n: 1 });
}
function exitRide(why) {
    const r = R;
    if (!r) return;
    R = null;
    setSiren(r, false);
    releaseAll();
    try { if (r.def.exit) r.def.exit(r, why); } catch (e) { console.error("[rides] exit", r.id, e); }
    const car = ctx.car;
    if (car) {
        if (car.stats === r.stats) car.stats = SKINS[car.skinKey] || car.stats;
        car.mass = 1;
        if (r.def.stops && ctx.G) ctx.G.noPullOver = r.noPullOverWas;
    }
    showChip("");
    emit("rides:exit", { id: r.id, why });
}

// ── the horn and the trick ───────────────────────────────────────────────
function phoneBusy() { return !!(ctx.phone && ctx.phone.busy && ctx.phone.busy()); }
const claimsHorn = () => !!(R && (R.def.horn || R.def.ability) && ctx.state === "playing" && !phoneBusy());
// the horn press is the ride's: swallow the plain honk before the driving sim sees it
hook("controls", () => {
    if (!input.pressed.honk || !claimsHorn()) return;
    input.pressed.honk = false;
    R.horn.down = true; R.horn.t = 0; R.horn.fired = false;
}, 60);
// the ride's own steering feel (a hotwired bus wallows like the jacked box truck does)
hook("controls", (ctl, dt) => {
    if (!R || !R.def.feel || (ctx.streets && ctx.streets.ride)) return;
    const k = R.def.feel === "heavy" ? 2.6 : 3.4;
    R.ls = (R.ls || 0) + (ctl.steer - (R.ls || 0)) * Math.min(1, dt * k);
    ctl.steer = R.ls;
}, 4);

function hornAction() {
    const h = R.def.horn;
    try {
        if (typeof h === "function") h(R);
        else if (h === "siren") HORNS.siren(R);
        else if (h && HORNS[h]) HORNS[h](R);
        else HORNS.plain(R);
    } catch (e) { console.error("[rides] horn", e); }
    emit("rides:horn", { id: R.id, kind: typeof h === "string" ? h : "custom" });
}
/** Built-in horns (defs may pass a function instead, or a name registered in HORN_KINDS). */
const HORNS = Object.assign(HORN_KINDS, {
    siren(r) {
        setSiren(r, !r.siren);
        rumble(0.15, 0.3, 120);
        if (r.def.onSiren) r.def.onSiren(r, r.siren);
    },
    plain() {
        emit("honk", {});                 // the garage plays Lulu's own horn, the world reacts as to any honk
        rumble(0.1, 0.3, 120);
        nudgeAhead(50);
    },
});
function currentAct() {
    if (!R || !R.def.ability) return null;
    try { return R.def.ability(R) || null; } catch (e) { console.error("[rides] ability", e); return null; }
}
function useAbility(via) {
    const a = currentAct();
    if (!a) return false;
    if (!a.ready) { if (a.why) toast(a.why, "", "rides:why"); return false; }
    try { R.def.use(R, a, via); } catch (e) { console.error("[rides] use", R.id, e); return false; }
    emit("rides:ability", { id: R.id, act: a.id, via });
    return true;
}
window.addEventListener("keydown", e => {
    if (e.code !== "KeyX" || e.repeat || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
    if (R && ctx.state === "playing") { keyAct = true; e.preventDefault(); }
});

// ── per frame ────────────────────────────────────────────────────────────
hook("update", (dt, P, controlsOn) => {
    poll();
    if (!R) { keyAct = false; return; }
    R.t += dt;
    const playing = ctx.state === "playing" && controlsOn;
    const hd = R.horn;
    if (hd.down) {
        if (!playing) hd.down = false;
        else if (!R.def.ability || !currentAct()) { hd.down = false; hornAction(); }   // no trick right now: the horn acts at once
        else if (input.honkHeld) {
            hd.t += dt;
            if (!hd.fired && hd.t >= HOLD) { hd.fired = true; useAbility("hold"); }
        } else { hd.down = false; if (!hd.fired) hornAction(); }
    }
    if (playing && (P.rideAct || keyAct)) useAbility(P.rideAct ? "touch" : "key");
    keyAct = false;
    sirenTick(dt, R);
    const nt = R.def.nitro;
    if (nt && nt.drain != null && ctx.G.boosting) ctx.G.boost = Math.min(1, ctx.G.boost + 0.3 * (1 - nt.drain) * dt);
    if (R.def.update) { try { R.def.update(dt, R, playing); } catch (e) { console.error("[rides] update", R.id, e); } }
    if (playing && !R.hinted && R.t > 0.4) { R.hinted = true; firstHint(); }
}, -2);
on("state", ({ to }) => { if (to === "title" || to === "gameover" || to === "footRun") poll(); if (R && to !== "playing") R.horn.down = false; });
on("foot:start", () => poll());
const ownBody = () => { if (ctx.car) { ctx.car.circles = null; ctx.car.radius = null; } };      // (her own car's hit circles)
on("title", () => { if (R) exitRide("title"); curObj = null; ownBody(); });
hook("runStart", () => { if (R) exitRide("run"); curObj = null; ownBody(); R_stats.yielded = 0; }, 50);

// heavy rides: a light bump with a lighter car costs no heart (they bounce off)
hook("damage", info => {
    if (!R || !R.def.sturdy || !info) return;
    const spec = kindSpec(String(info.source || ""));
    if (spec && (spec.mass || 1) < (R.def.mass || 1) && info.power < R.def.sturdy) {
        H.toast(`💪 ${R.def.emoji} Bounced right off!`, "gold", { key: "rides:sturdy" });
        return false;
    }
}, 20);

// ── first time in each ride: one short card (the notification manager, never a modal) ──
function firstHint() {
    const def = R.def;
    if (S.seen[def.id] || !def.hint) return;
    S.seen[def.id] = true;
    saveSoon();
    let txt = "";
    try { txt = def.hint(R); } catch (e) { console.error("[rides] hint", e); }
    if (txt) H.banner(`<b>${def.emoji} ${def.name.toUpperCase()}</b><small>${txt}</small>`, 5200, { key: "rides:hint", prio: 2 });
}
for (const [k, g] of Object.entries({ ps: "hold L1", xbox: "hold LB", nintendo: "hold L", keyboard: "X", touch: "⭐" })) {
    const set = glyphSet(k);
    if (set) set.rideAct = g;
}

// ── the one chip (HUD right, next to the item chips) + the one touch button ──
let chipEl = null, chipHtml = null, chipT = 0, btn = null, btnKey = "";
function showChip(html) {
    if (html === chipHtml) return;
    chipHtml = html;
    if (!chipEl) {
        if (!html) return;
        chipEl = document.createElement("div");
        chipEl.className = "rides-hud";
        H.hudSlot("right").appendChild(chipEl);
        H.objective(chipEl, { prio: H.OBJ.errand, id: "ride" });      // (ci/hud: the play HUD's objective line)
    }
    chipEl.innerHTML = html;
    chipEl.style.display = html ? "" : "none";
}
hook("hud", dt => {
    chipT -= dt;
    if (chipT > 0) return;
    chipT = 0.2;
    if (!R || ctx.state !== "playing") { showChip(""); R && (R.act = null); return; }
    const a = currentAct();
    R.act = a;
    let status = "";
    try { status = R.def.status ? R.def.status(R) || "" : ""; } catch (e) { console.error("[rides] status", e); }
    const touch = input.device === "touch";
    const parts = [];
    if (status) parts.push(`<div class="hud-chip rides-chip st">${status}</div>`);
    if (a && !touch) parts.push(`<div class="hud-chip rides-chip act${a.ready ? "" : " dim"}">${a.emoji} ${a.label} ${trickGlyph()}</div>`);
    if (R.siren) parts.push(`<div class="hud-chip rides-chip siren">🚨</div>`);
    showChip(parts.join(""));
    // the touch button follows the trick
    if (btn) {
        const key = a ? a.emoji + a.short : "";
        if (key !== btnKey) { btnKey = key; if (a) btn.innerHTML = `${a.emoji}<small>${a.short}</small>`; }
        btn.classList.toggle("dim", !!(a && !a.ready));
    }
});
on("boot", () => {
    btn = addTouchButton({ id: "rides_act", emoji: "⭐", label: "TRICK", action: "rideAct",
        visible: () => !!(R && R.act && ctx.state === "playing") });
    setControlRow("honk", "Horn · siren / jingle in a cop car, ambulance, ice-cream truck");
    setControlRow("rideAct", "Ride trick (cop car, ambulance, taxi)", "bail");
    for (const tr of FLEET) addJack(tr);
    // a 🎉 party: the fleet rides the shared, seeded traffic (registered at boot: the same list on every screen)
    if (ctx.party && ctx.party.addTrafficKind) for (const tr of FLEET) if (tr.mix) ctx.party.addTrafficKind(tr.kind, tr.mix, () => live());
});

// ── the fleet: taxis, ambulances, ice-cream trucks and buses join traffic (jackable) ──
hook("runStart", () => {
    const mix = ctx.traffic && ctx.traffic.config.mix;
    if (!mix) return;
    for (const tr of FLEET) delete mix[tr.kind];
    if (!live() || partyOn()) return;
    for (const tr of FLEET) {
        if (!tr.mix) continue;
        need(tr.models || [tr.spec.model]).then(() => { if (live() && !partyOn() && ctx.traffic) ctx.traffic.config.mix[tr.kind] = tr.mix; }).catch(() => {});
    }
});

css("rides", `
.rides-hud { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
.rides-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 15px; white-space: nowrap; }
.rides-chip .glyph { min-width: 20px; height: 20px; font-size: 10px; padding: 0 5px; }
.rides-chip.act { background: rgba(21, 101, 192, 0.9); color: #fff; }
.rides-chip.act.dim { opacity: .55; }
.rides-chip.st { background: rgba(255, 255, 255, 0.92); color: #263238; font-weight: 700; }
.rides-chip.st b { color: #C62828; }
.rides-chip.siren { padding: 4px 8px; animation: rides-blink .5s steps(2) infinite; }
@keyframes rides-blink { 50% { background: rgba(41, 98, 255, .9); } }
#tx_rides_act { background: rgba(21, 101, 192, 0.88); }
#tx_rides_act.dim { opacity: .55; }
@media (min-aspect-ratio: 1/1) { body.touch .rides-hud { flex-direction: row-reverse; flex-wrap: wrap; } }
body.tv .rides-chip { font-size: 22px; } body.tv .rides-chip .glyph { min-width: 28px; height: 28px; font-size: 14px; }
`);

// ── the service ──────────────────────────────────────────────────────────
ctx.rides = {
    /** Register a ride (see add() above) — a town can bring its own vehicles + tricks. */
    add,
    get: id => DEFS.get(id) || null,
    list: () => [...DEFS.keys()],
    /** The def for a shell model key ("cop", "foot_ambulance"…), or null. */
    forKey: key => BY_KEY.get(key) || null,
    /** The live ride: { id, key, t, siren, data } | null. */
    get current() { return R; },
    get id() { return R ? R.id : null; },
    get siren() { return !!(R && R.siren); },
    setSiren(on) { if (R) setSiren(R, on); return !!(R && R.siren); },
    /** Does holding the horn mean "the trick" right now? (Shared Road's emote wheel stands down.) */
    get holdsHorn() { return !!(R && R.def.ability && ctx.state === "playing"); },
    /** Use the trick now (as if pressed). */
    use(via = "api") { return !!R && useAbility(via); },
    /** The trick on offer right now: { id, emoji, label, ready } | null. */
    act() { const a = currentAct(); return a ? { id: a.id, emoji: a.emoji, label: a.label, ready: !!a.ready } : null; },
    horn() { if (R) hornAction(); return !!R; },
    /** The cars ahead get out of her way (air horn / megaphone). */
    nudge: (range = 70) => nudgeAhead(range),
    stats: S,
    debug: {
        get R() { return R; }, DEFS, BY_KEY, FLEET, yieldingCount, R_stats, S, amb: ambDebug, ice: iceDebug, bus: busDebug,
        /** Put her behind the wheel of ride `id` right where she is (loads its model first). */
        async board(id) {
            const def = DEFS.get(id);
            if (!def || !ctx.foot || !ctx.foot.drive) return false;
            const key = def.keys[0];
            await need([key]);
            const car = ctx.car;
            ctx.foot.drive({ vtype: def.vtype || "car", key, colors: null, x: car.pos.x, z: car.pos.z, h: car.h, how: "test" });
            poll();
            return !!R;
        },
    },
};
