// ─────────────────────────────────────────────────────────────────────────
//  features/impound — 🚗 GETTING AN IMPOUNDED CAR BACK (roadmap 30, ci/impound; the owner 2026-11-27: "when a car is
//  impounded - we need a way for the player to get their car back … for cost. Also add a way for a player to break
//  into the impounding thing and attempt to get their car back illegally.")
//
//  Her car is IMPOUNDED when the law walks her out of a precinct on foot (features/places: walkOut(impound) shows her own
//  car behind the impound lot's fence; ctx.foot.ownCar === "gone"). Before: the gate only said a line and the car came
//  back with the next run at home. Now:
//   • THE LEGAL WAY — one fee (data.js FEE: 120, the very first time 60; a coin SINK, never below 0), paid at ONE of:
//       the impound lot's own window (✋ at its gate — "the desk of the place holding it") · City Hall's PERMITS window
//       (features/cityhall addWindowHook: "vehicle release, in triplicate") · 📞 Contacts › City Hall (CONTACT_EXTRAS,
//       two taps). City Hall / the phone hand her a release slip; ✋ at the gate with it (or paying right there) → the
//       gate rattles open and her car rolls out to the kerb: she gets in and drives off. Can't afford it → told so, and
//       today's fallback stands: the car is back at her house next time she's home (a new run) — nobody is ever stuck.
//   • THE ILLEGAL WAY — breakin.js: the loose fence panel, Bruno the night guard + a sweeping camera (view cones), ✋
//       hotwire her OWN car, out through the gate. Seen → his ⚠️ look, seen again → a foot chase → caught = GRAND THEFT
//       AUTO (HER OWN CAR) in court (law.addCharge) and the car stays in (the fee still owed). One try a REAL day: after
//       it Bruno is "extra awake" (wider light, no breaks).
//  Where the car is held = the town she walked out of (ctx.civic decides — any `impound` spot a place registers works:
//  the town precincts now, ci/roadside's trooper yards when they give ctx.civic an impound spot).
//  Finding it: the objective line's LOWEST slot (H.OBJ.info) — "🚗 Your car is impounded · City Hall or the precinct";
//  the 📱 Map through ctx.pins when it exists (ci/hud). No toasts or texts beyond the one payment line.
//  ctx.impound { held, released, fee(), pay(where), gate(), gateLabel(), release(how), debug } · events impound:<ev>.
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on, emit, hook } from "../../core/ctx.js";
import { store, saveSoon, wallet } from "../../core/save.js";
import { choose, say } from "../../core/dialog.js";
import * as H from "../../hud.js";
import { kerbAt } from "../places/out.js";
import { addWindowHook } from "../cityhall/lobby.js";
import { CONTACT_EXTRAS } from "../cityhall/pay.js";
import { ID, FEE, CHARGE, L } from "./data.js";
import { BR, breakTick, breakReset, panelSpot, startBreakIn } from "./breakin.js";
import { TOW_FEE, L as CL } from "../cars/data.js";
import { SKINS } from "../../car.js";
import { lapPlaces } from "../world/lapmap.js";

export const SAVE = store(ID, { paid: 0, breakDay: "", breaks: 0, clean: 0, slip: null });
/** Per run: where her car is held + whether the release is paid. */
export const IM = { held: null, released: false, log: [], chip: null, chipTxt: "", pinRm: null };
export function log(ev, d = {}) { IM.log.push(Object.assign({ ev, t: +ctx.time.toFixed(2) }, d)); if (IM.log.length > 60) IM.log.shift(); emit("impound:" + ev, d); }
const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));
const pick = a => a[Math.floor(Math.random() * a.length)];
const inTown = () => !!(ctx.town && ctx.town.active);
const onFoot = () => !!(ctx.foot && ctx.foot.active && ctx.state === "footRun");
export const fee = () => (IM.held && IM.held.why === "tow" ? TOW_FEE : SAVE.paid > 0 ? FEE.normal : FEE.first);
/** features/cars keeps where every car is: then the impound holds whichever cars ctx.cars says (any number, kept across
 *  runs and reloads — no auto-return), a paid slip is saved per car, and a tow (not an arrest) costs TOW_FEE. */
const carsOn = () => !!(ctx.cars && ctx.cars.held && ctx.enabled("cars"));
/** Where she is, as an impound's key: the town's id, or (on the highway, by a roadside place's yard — ci/roadside's Trooper
 *  Post 7 / the Weigh Station) "hw:<its id>" — the same key a car impounded there is held under. */
function hereKey() {
    if (inTown()) return ctx.town.id;
    const sp = ctx.civic && ctx.civic.spot ? ctx.civic.spot("impound") : null;
    return sp && sp.hw ? "hw:" + sp.hw : null;
}
function syncHeld() {
    if (!carsOn()) return;
    const h = ctx.cars.held(hereKey()) || ctx.cars.held(null);
    if (!h) { IM.held = null; IM.released = false; return; }
    if (!IM.held || IM.held.key !== h.key || IM.held.town !== h.town) {
        IM.held = { town: h.town, key: h.key, why: h.why, at: ctx.time };
        if (heldHere() && !carObj() && ctx.civic && ctx.civic.impound && ctx.civic.ready && ctx.civic.ready()) ctx.civic.impound.show(true);
    }
    IM.released = SAVE.slip === h.key;
}
const brokeLine = () => fill(carsOn() ? CL.brokeKeep : L.broke, { fee: fee(), have: wallet.coins });
const carObj = () => (ctx.civic && ctx.civic.impound ? ctx.civic.impound.car() : null);
/** Is her car held where she is (behind THIS fence — a town's, or a roadside yard's)? (A roadside yard's used to be keyed
 *  null and never matched: its gate never opened — the car stayed in for good.) */
const heldHere = () => !!(IM.held && IM.held.town && hereKey() === IM.held.town);
const live = () => ctx.enabled(ID);

// ── when she's walked out on foot and her car stays behind the fence ────
on("places:out", e => {
    if (!live() || !e || e.car || !(ctx.foot && ctx.foot.ownCar === "gone") || !carObj()) return;
    const where = e.town || (e.hw ? "hw:" + e.hw : null);          // (a roadside place's yard: "hw:trooper" / "hw:weigh")
    if (carsOn()) {
        // (the car she was using; in a borrowed ride her own cars are wherever they are — nothing to hold)
        ctx.cars.impounded(where); IM.held = null; syncHeld();
        if (IM.held && IM.held.town === where) log("held", { town: where, key: IM.held.key });
        else if (!heldHere() && ctx.civic.impound) ctx.civic.impound.show(false);
        return;
    }
    IM.held = { town: where, at: ctx.time }; IM.released = false;
    log("held", { town: where });
});
on("run:start", () => { breakReset(); if (carsOn()) { IM.held = null; syncHeld(); return; } IM.held = null; IM.released = false; });   // (without features/cars: a new run = the car is home again)
on("title", () => { breakReset(); if (carsOn()) return; IM.held = null; IM.released = false; });
on("town:enter", () => { if (heldHere() && !carObj() && ctx.civic.impound) ctx.civic.impound.show(true); });
on("town:leave", () => breakReset());
// (she got into her own car some other way — a new run, the knock-out's tow…: nothing held any more)
on("state", ({ to }) => { if (!carsOn() && IM.held && to === "playing" && ctx.foot && !ctx.foot.active && ctx.foot.ownCar !== "gone") { IM.held = null; IM.released = false; } });

// ── paying ────────────────────────────────────────────────────────────────
/** Pay the release (where: gate | cityhall | phone). → "paid" | "broke" | "none" (nothing held / already paid). */
export function pay(where) {
    if (!IM.held || IM.released) return "none";
    const f = fee();
    if (wallet.coins < f || !wallet.spend(f)) { log("broke", { where, fee: f, have: wallet.coins }); return "broke"; }
    IM.released = true;
    if (carsOn() && IM.held.key) SAVE.slip = IM.held.key;
    if (IM.held.why !== "tow") SAVE.paid++;
    saveSoon();
    emit("stat", { id: "impoundPaid", n: 1 });
    log("paid", { where, fee: f });
    return "paid";
}

// ── the gate (places' ✋ at the impound lot asks us first) ─────────────────
/** The car rolls out to the kerb in front of the gate; she's beside it, on foot, ready to get in. */
export function release(how) {
    const sp = ctx.civic && ctx.civic.spot("impound");
    if (!sp || !ctx.foot || !ctx.foot.start) return false;
    if (ctx.civic.impound) ctx.civic.impound.show(false);
    const c = ctx.car, k = sp.kerbAt ? sp.kerbAt(3) : kerbAt(sp, 3);      // (a roadside yard: its own stalls — the town kerb rule put it in a highway lane)
    const face = Math.atan2(sp.nx, sp.nz);
    const at = { x: sp.x + sp.nx * 1.2, z: sp.z + sp.nz * 1.2 };
    if (carsOn() && IM.held && IM.held.key) ctx.cars.fromImpound(IM.held.key);     // (that car; the one she came in stays parked)
    if (ctx.foot.active) ctx.foot.end("impound");
    c.place(k.x, k.z, k.h); c.s = k.s; c.d = k.d; c.vx = c.vz = 0; if ("vF" in c) c.vF = 0;
    const ok = ctx.foot.start("droveOff", { at, face, noIntro: true, drivable: true, line: how === "breakin" ? pick(L.out) : undefined }) !== false;
    IM.held = null; IM.released = false;
    if (SAVE.slip) { SAVE.slip = null; saveSoon(); }
    log("release", { how, ok });
    emit("stat", { id: how === "breakin" ? "impoundBreakOuts" : "impoundReleases", n: 1 });
    return ok;
}
export async function gate() {
    if (!live() || !heldHere()) return false;
    if (IM.released) { await say(L.gateWho, L.rolled, { emoji: L.gateEmoji }); release("slip"); return true; }
    const f = fee();
    // (the car she's after by name — it used to say "Pink convertible" whatever she drives)
    const sk = IM.held.key && SKINS[IM.held.key], car = sk ? sk.name : "Pink convertible";
    const i = await choose(L.gateWho, fill(L.gateAsk, { fee: f, car }), [fill(L.gatePay, { fee: f }), L.gateCityHall, L.gateLeave], { emoji: L.gateEmoji });
    if (i !== 0) return true;
    const r = pay("gate");
    if (r === "broke") { await say(L.gateWho, brokeLine(), { emoji: L.gateEmoji }); return true; }
    if (r === "paid") { await say(L.gateWho, L.paid, { emoji: L.gateEmoji }); release("gate"); }
    return true;
}
export const gateLabel = () => (live() && heldHere() ? (IM.released ? L.gateReady : L.gateLabel) : null);

// ── 🏛️ City Hall: the PERMITS window, in triplicate ───────────────────────
addWindowHook("permits", async (rt, who, name) => {
    if (!IM.held || IM.released) return false;
    const f = fee(), o = { emoji: "📝", person: who };
    const i = await rt.choose(name, fill(L.winAsk, { fee: f }), [fill(L.winYes, { fee: f }), L.winNo], o);
    if (rt.disposed || i !== 0) return true;
    const r = pay("cityhall");
    await rt.say(name, r === "paid" ? L.winDone : brokeLine(), o);
    return true;
}, 30);

// ── 📞 Contacts › City Hall: two taps ─────────────────────────────────────
const PH = { armed: false };
CONTACT_EXTRAS.push({
    html() {
        if (!IM.held || IM.released) return IM.released ? `<p class="lp-note">${L.phoneDone}</p>` : "";
        const f = fee();
        return `<button class="btn lp-row" id="imPay"><span class="lp-av">🚗</span><span class="lp-tx"><b>${PH.armed ? fill(L.phoneArm, { fee: f }) : L.phoneRow}</b><small>${fill(L.phoneSub, { fee: f })}</small></span></button>`;
    },
    bind(el, rerender) {
        const b = el.querySelector("#imPay");
        if (!b) return;
        b.addEventListener("click", () => {
            if (!PH.armed) { PH.armed = true; rerender(); const nb = el.querySelector("#imPay"); if (nb) nb.focus(); return; }
            PH.armed = false;
            const r = pay("phone");
            if (r === "broke") { const p = el.querySelector("#imPay small"); if (p) p.textContent = brokeLine(); return; }
            try { if (r === "paid" && ctx.phone && ctx.phone.inbox) ctx.phone.inbox.post({ from: "City Hall", emoji: "🏛️", color: "#455A64", msg: L.phoneDone, thread: "City Hall", need: true }); } catch (e) { /* no phone */ }
            rerender();
        });
    },
});
on("phone:close", () => { PH.armed = false; });

// ── the charge (court lines) ─────────────────────────────────────────────
on("boot", () => { try { if (ctx.law && ctx.law.addCharge) ctx.law.addCharge(CHARGE); } catch (e) { /* no law */ } });

// ── the objective line's lowest slot + the 📱 Map (ctx.pins, when ci/hud has it) ──
function chipTick() {
    const want = !!IM.held && !ctx.dialogOpen && (ctx.state === "footRun" || ctx.state === "playing");
    const txt = !want ? "" : IM.released ? `${L.chipReady}<small>${L.chipReadySub}</small>` : `${L.chip}<small>${fill(L.chipSub, { fee: fee() })}</small>`;
    if (!IM.chip && want) {
        IM.chip = document.createElement("div"); IM.chip.className = "day-chip impound-chip";
        H.hudSlot("left").appendChild(IM.chip);
        H.objective(IM.chip, { prio: H.OBJ.info, id: "impound", icon: "🚗" });
    }
    if (IM.chip && IM.chipTxt !== txt) { IM.chipTxt = txt; IM.chip.innerHTML = txt; IM.chip.classList.toggle("hidden", !txt); }
    // the 📱 Map: a pin at the lot holding her car (ci/hud's registry — skipped until it exists)
    try {
        const P = ctx.pins;
        if (P && P.add && IM.held && !IM.pinRm) {
            const hw = String(IM.held.town || "").startsWith("hw:") ? lapPlaces().find(q => q.addr === IM.held.town) : null;
            IM.pinRm = P.add(hw ? { id: "impound", icon: "🚗", label: "Your impounded car", lap: hw.m, group: "highway" } : { id: "impound", icon: "🚗", label: "Your impounded car", town: IM.held.town, spot: "impound" });
        }
        else if (IM.pinRm && !IM.held) { if (typeof IM.pinRm === "function") IM.pinRm(); else if (P && P.remove) P.remove("impound"); IM.pinRm = null; }
    } catch (e) { /* no pins */ }
}
let acc = 0;
hook("hud", dt => { if ((acc += dt) < 0.25) return; acc = 0; try { syncHeld(); chipTick(); } catch (e) { console.error("[impound] chip", e); } });
on("state", ({ to }) => { if (to === "footRun" || to === "playing") return; if (IM.chip && IM.chipTxt) { IM.chipTxt = ""; IM.chip.innerHTML = ""; IM.chip.classList.add("hidden"); } });

// ── the break-in's per-frame tick (on foot, in the town that holds her car) ──
// (towns only: the loose panel + Bruno are built round a town lot — a roadside yard is paid at its gate)
hook("hud", dt => { try { breakTick(dt, live() && inTown() && heldHere() && onFoot()); } catch (e) { console.error("[impound] break-in", e); } });

ctx.impound = {
    get held() { return IM.held ? Object.assign({}, IM.held) : null; },
    get released() { return IM.released; },
    fee, pay, gate, gateLabel, release,
    /** The break-in (breakin.js): the loose panel's spot (world) · start it now (tests). */
    panel: panelSpot, breakIn: startBreakIn,
    debug: { IM, SAVE, BR, get log() { return IM.log; } },
};
