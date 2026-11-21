// ─────────────────────────────────────────────────────────────────────────
//  features/airport — ✈️ JFK STAGE 3: THINGS TO DO (roadmap 12; the owner's decision 8 in 3d/docs/airport-plan.md).
//
//    🚕 THE JFK TAXI RUN (stage3-taxi.js) — a hustle side job (ctx.hustle.register): pick up a traveller at the ARRIVALS
//       kerb (or say yes to one at the terminal's arrivals door) and drive them to a real place in Lakewood or Midwood;
//       a yenta, a bochur back from yeshiva in Israel, a tourist looking for "the Brooklyn Bridge", a Zeidy with
//       grapefruits. A FIXED fare, PAY.taxiPerDay runs a real day. Offered ONLY at the airport: until stage 1
//       (ci/airport: the exit + the kerb) is in the game, it is never offered.
//    🧳 THE LOST SUITCASE (stage3-hall.js) — Mrs. Shpilkes by ARRIVALS lost her pink suitcase: it's somewhere in the
//       hall, or a look-alike-bag man is doing laps with it. Return it: a small reward once a real day.
//    🎤 DOVID DOV ON TOUR (stage3-hall.js) — now and then he comes through the arrivals doors and down the VIP red
//       carpet; a fan crowd, Officer Segal clears a path; ✋ a selfie / an autograph / "strangers"; once a real day
//       a little gas money; a scrapbook badge the first time. SOLO only (in a party the carpet stays empty).
//    and the hall's bottom hint (foot's "Find a car to borrow" doesn't belong indoors) — set while she's inside.
//
//  Own files only (stage3*.js); hooks: ctx.airport.terminal.addBuilder (stage 2), ctx.hustle.register, ctx.meta.addBadge,
//  stage 1's ctx.airport (on / planned / ready / inside / debug.world) — every stage-1 read guarded.
//
//  ctx.airport.stage3 = { today(), ledger, taxi: { offered(), book(id), booked }, PAY, TUNE, debug }
//  Events: airport:taxi {phase: offer | book | pickup | drop | wrong, fare, pay} · airport:bag {phase: ask | found | return, variant, pay}
//          · airport:dovid {phase: arrive | here | meet | leave, choice, pay}
//  Stats: airportTaxiRuns, airportBagsReturned, airportDovid (+ badge "jfkDovid")
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on, emit } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { glyph, input } from "../../input.js";
import { PAY, TUNE, TAXI, TAXI_DEF, HINT, DOVID } from "./stage3-data.js";
import { createTaxi, TAXI_ID, fareById } from "./stage3-taxi.js";
import { hallBuilder, HALL } from "./stage3-hall.js";

// ── the ledger: what paid out today (the device's local date) ───────────────
const SV = store("airport3", { day: "", taxi: 0, bag: 0, dovid: 0, runs: 0, bags: 0, met: 0 });
const DBG = { date: null, kerb: undefined, stage1: null };
export function today() {
    if (DBG.date) return DBG.date;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** The day's counters (rolled over at local midnight). */
export function ledger() {
    const t = today();
    if (SV.day !== t) { SV.day = t; SV.taxi = 0; SV.bag = 0; SV.dovid = 0; saveSoon(); }
    return SV;
}
/** Count one paid thing today (kind: taxi | bag | dovid) if it's under the cap → the coins to pay (0 past it). */
export function claim(kind) {
    const L = ledger(), cap = kind === "taxi" ? PAY.taxiPerDay : 1;
    if (L[kind] >= cap) return 0;
    L[kind]++;
    saveSoon();
    return PAY[kind];
}
export const lifetime = SV;

// ── stage 1 (ci/airport), read-only and guarded ──────────────────────────────
const partyOn = () => !!(ctx.party && ctx.party.active);
/** Is stage 1's airport place in the game and planned on this run? */
export function stage1() {
    if (DBG.stage1 != null) return DBG.stage1;
    const A = ctx.airport;
    return !!(A && typeof A.spans === "function" && A.on && A.planned);
}
/** She (car or foot) is in stage 1's fenced landside. */
export function atAirport() {
    if (DBG.stage1 != null) return DBG.stage1;
    return stage1() && !!ctx.airport.inside;
}
/** The ARRIVALS kerb pickup, world {x, z} — stage 1's kerb API if it has one, else its frame (f, r) → world. */
export function kerbPickup() {
    if (DBG.kerb !== undefined) return DBG.kerb;
    if (!stage1()) return null;
    const A = ctx.airport;
    try {
        if (A.kerb && typeof A.kerb.pickup === "function") { const p = A.kerb.pickup(); if (p) return { x: p.x, z: p.z }; }
        if (A.ready && A.debug && typeof A.debug.world === "function") {
            // the ARRIVALS kerb lane (layout: KERBS.arr f 6 → 110, KERB_LANE r 193.5), short of the taxi queue (f 70 →)
            const p = A.debug.world(24, 193.5);
            if (p && isFinite(p.x) && isFinite(p.z)) return { x: p.x, z: p.z };
        }
    } catch (e) { console.warn("[airport stage3] kerb", e); }
    return null;
}

// ── 🚕 can a taxi run be offered right now? ─────────────────────────────────
/** "" = yes, else why not (the 💼 Jobs app lists it only when ""). */
export function taxiWhy() {
    if (!ctx.hustle || !ctx.hustle.register) return "off";
    if (partyOn()) return "party";                         // (stage 1 is off in a party for now; the run would be personal)
    if (!ctx.G || ctx.G.mode !== "cruise" || ctx.G.tutorial) return "mode";
    if (!atAirport()) return "away";                       // ONLY from the airport
    if (!kerbPickup()) return "kerb";
    if (ledger().taxi >= PAY.taxiPerDay) return "capped";
    if (ctx.law && (ctx.law.chasing || ctx.law.wanted >= 2)) return "law";
    return "";
}
const BOOK = { fare: null, said: false };
function book(id) {
    const f = fareById(id) || null;
    if (!f || taxiWhy() === "capped" || taxiWhy() === "party") return false;
    BOOK.fare = f.id;
    emit("airport:taxi", { phase: "book", fare: f.id });
    return true;
}
/** Back behind the wheel at the airport with a booked fare → the run starts (pickup at the kerb). */
function startBooked() {
    if (!BOOK.fare || ctx.state !== "playing" || !ctx.hustle || ctx.hustle.job) return false;
    if (taxiWhy()) { if (!atAirport()) BOOK.fare = null; return false; }
    const id = BOOK.fare;
    BOOK.fare = null;
    return !!ctx.hustle.start(TAXI_ID, { via: "terminal", fare: id });
}
on("state", ({ to }) => {
    if (to === "title") { BOOK.fare = null; BOOK.said = false; return; }
    if (to === "playing" && BOOK.fare) setTimeout(() => { try { startBooked(); } catch (e) { console.error("[airport stage3] booked", e); } }, 400);
});
on("run:start", () => { BOOK.fare = null; BOOK.said = false; });
// she pulls into the landside: JFK dispatch texts once a visit (a quiet text, no pop-up) while a run can be offered
on("airport:enter", () => {
    if (BOOK.said || taxiWhy() || ctx.state !== "playing") return;
    BOOK.said = true;
    try {
        const msg = TAXI.dispatchText[Math.floor(Math.random() * TAXI.dispatchText.length)].replace("${name}", TAXI_DEF.name);
        if (ctx.phone && ctx.phone.text) ctx.phone.text({ from: TAXI_DEF.from, emoji: TAXI_DEF.fromEmoji, color: "#F9A825", msg, thread: "jfk", dur: 5 });
    } catch (e) { /* no phone */ }
    emit("airport:taxi", { phase: "offer" });
});
on("airport:leave", () => { BOOK.said = false; if (ctx.state === "playing") BOOK.fare = null; });

// ── the hall's bottom hint ──────────────────────────────────────────────────
// (foot's walk hint — "Find a car to “borrow” 🚗 · A to interact · RB run" — is still up when she walks in, and the
//  interior state shows ctx.G.hint at the bottom: inside the terminal it says something that fits, then it's put back)
const HT = { saved: undefined, set: "" };
function hintIn() {
    if (!ctx.G) return;
    if (HT.saved === undefined) HT.saved = ctx.G.hint;
    HT.set = input.device === "touch" ? "" : HINT(glyph);
    ctx.G.hint = HT.set;
}
function hintOut() {
    if (!ctx.G || HT.saved === undefined) return;
    if (ctx.G.hint === HT.set) ctx.G.hint = HT.saved;
    HT.saved = undefined; HT.set = "";
}
on("airport:terminal", e => { if (e && e.in === false) hintOut(); });
on("state", ({ to }) => { if (to === "title") { HT.saved = undefined; HT.set = ""; } });

// ── wiring (re-attached on boot: stage 1 assigns ctx.airport when it loads) ──
const API = {
    today, ledger, PAY, TUNE,
    get lifetime() { return { runs: SV.runs, bags: SV.bags, met: SV.met }; },
    taxi: {
        id: TAXI_ID,
        /** "" when a JFK taxi run can be offered now, else why not. */
        why: () => taxiWhy(),
        offered: () => !taxiWhy(),
        book, get booked() { return BOOK.fare; },
        pickup: () => kerbPickup(),
    },
    debug: {
        DBG, SV, HALL, BOOK,
        /** Pretend it's this local date ("YYYY-MM-DD"), null = the real one. */
        date(v = null) { DBG.date = v; return today(); },
        /** Tests (stage 1 isn't on main yet): pretend she's at the airport, with the kerb pickup at {x, z} (null → no override). */
        fakeAirport(kerb) { if (kerb === null) { DBG.stage1 = null; DBG.kerb = undefined; } else { DBG.stage1 = true; DBG.kerb = kerb; } return stage1(); },
        /** The next terminal visit: Dovid Dov comes through (true) / not (false) / dice (null). */
        dovidNext(v = true) { HALL.forceDovid = v; },
        /** The next visit's lost suitcase: "scale" | "bench" | "plant" | "lookalike" | null (random). */
        bagNext(v) { HALL.forceBag = v || null; },
        /** The live hall state (stage 3's bits) or null. */
        hall: () => { const r = ctx.airport && ctx.airport.terminal && ctx.airport.terminal.debug.room(); return r && r.data.s3 ? r.data.s3 : null; },
        hintIn, hintOut,
    },
};
function attach() {
    const A = ctx.airport || (ctx.airport = {});
    A.stage3 = API;
    if (A.terminal && A.terminal.addBuilder && !attach.built) {
        attach.built = true;
        A.terminal.addBuilder((rt, api) => { hintIn(); hallBuilder(rt, api); });
    }
    if (ctx.hustle && ctx.hustle.register && !attach.job) {
        attach.job = ctx.hustle.register(TAXI_ID, createTaxi, TAXI_DEF, { listed: () => !taxiWhy() });
    }
    if (ctx.meta && ctx.meta.addBadge && !attach.badge) {
        attach.badge = true;
        ctx.meta.addBadge({ id: "jfkDovid", icon: "🎤", name: "Front Row", desc: "Meet Dovid Dov on tour at JFK",
            test: S => ((S.stats && S.stats.airportDovid) || 0) >= 1 });
    }
}
attach();
on("boot", attach);
export { API as stage3, DOVID };
