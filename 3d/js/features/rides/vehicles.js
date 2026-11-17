// features/rides — the built-in rides: 🚓 cop car, 🚚 box truck, 🏎️ sports car, 🚕 taxi
// (+ 🚑 ambulance.js, 🍦 icecream.js, 🚌 bus.js). Each one is just a def for ctx.rides.add().
import { ctx, on, emit } from "../../core/ctx.js";
import * as A from "../../audio.js";
import { rumble } from "../../input.js";
import { addCoins } from "../../core/driving.js";
import { ensureModels } from "../../models.js";
import { add, HORN_KINDS, S } from "./registry.js";
import { setSiren, nudgeAhead } from "./siren.js";
import { pick, rand, luluSays, bubble, toast, stat, hornGlyph, trickWords, partyOn } from "./common.js";
import { saveSoon } from "../../core/save.js";
import * as T from "./lines.js";
import "./ambulance.js";
import "./icecream.js";
import "./bus.js";

// ── the air horn (truck, bus): the world hears a honk, the cars ahead MOVE ──
HORN_KINDS.air = R => {
    if (A.spatial && A.spatial.ready) A.spatial.play("hornTruck", ctx.car.obj, { gain: 1.1, key: "rides-air" });
    emit("honk", { ride: R.id });               // banter, birds, the tutorial… react (the garage skips its own horn)
    nudgeAhead(95);
    rumble(0.35, 0.5, 260, true);
    if (Math.random() < 0.3) luluSays(pick(T.AIRHORN));
};

// ═══════════════════════════════ 🚓 COP CAR ═══════════════════════════════
const COP = {
    pull: { id: "pullover", emoji: "🚨", label: "PULL OVER", short: "PULL OVER", ready: true, why: "" },
    spikes: { id: "spikes", emoji: "🛑", label: "SPIKES", short: "SPIKES", ready: true, why: "" },
    mega: { id: "megaphone", emoji: "📣", label: "MEGAPHONE", short: "MEGA", ready: true, why: "" },
};
const SPIKE_KIT = 3, TICKET_BOOK = 4;
/** The car law's copStop would pick: the nearest one ahead in her direction. */
function pullTarget() {
    const car = ctx.car;
    let best = null, bd = 60;
    for (const c of ctx.traffic.cars) {
        if (c.hit || c.ai || (c.data && c.data.law) || c.dir < 0) continue;
        const gap = c.s - car.s;
        if (gap > 4 && gap < bd) { bd = gap; best = c; }
    }
    return best;
}
/** +1 or −1: which way along the road she's heading. */
function roadDir() {
    const car = ctx.car, p = ctx.world.road.point(car.s, 0, {});
    return Math.cos(car.h - p.h) >= 0 ? 1 : -1;
}
add({
    id: "cop", name: "Cop car", emoji: "🚓", keys: ["cop"], vtype: "cop",
    handling: { top: 1.12, acc: 1.12, grip: 1.12, brake: 1.15 }, mass: 1.4,
    horn: "siren", siren: "siren",
    hint: () => `${hornGlyph()} siren — traffic pulls over · ${trickWords("🚨")} pull someone over (🛑 spike strips in a chase). Real cops might notice…`,
    enter(R) {
        R.data.spikes = SPIKE_KIT; R.data.tickets = TICKET_BOOK; R.data.megaT = 0; R.data.sus = 0; R.data.susSaid = false; R.data.impostor = false;
        ensureModels(["streets_spikes"]).catch(() => {});
    },
    onSiren(R, on) { if (on) luluSays(pick(T.SIREN_ON_COP)); },
    ability(R) {
        if (ctx.law && ctx.law.chasing) {
            const a = COP.spikes, n = R.data.spikes;
            a.label = n > 0 ? `SPIKES ×${n}` : "SPIKES ×0";
            a.ready = n > 0 && !!(ctx.streets && ctx.streets.spikes);
            a.why = T.SPIKES_EMPTY;
            return a;
        }
        if (pullTarget()) {
            const a = COP.pull;
            a.ready = R.data.tickets > 0 && !!(ctx.law && ctx.law.pullOver);
            a.why = T.TICKET_BOOK_EMPTY;
            return a;
        }
        COP.mega.ready = R.data.megaT <= 0;
        return COP.mega;
    },
    use(R, a) {
        const car = ctx.car;
        if (a.id === "spikes") {
            const dir = roadDir();
            ctx.streets.spikes(car.s - dir * 9, car.d);
            R.data.spikes--;
            S.spikes++; saveSoon();
            A.sfxBump();
            rumble(0.4, 0.4, 160, true);
            toast(`🛑 Spike strip down! (${R.data.spikes} left)`, "gold", "rides:spikes");
            luluSays(pick(T.SPIKES), true);
            stat("ridesSpikes", 1);
            emit("rides:spikes", { left: R.data.spikes });
            return;
        }
        if (a.id === "pullover") {
            setSiren(R, true);
            bubble(pick(T.MEGAPHONE), car.obj, { cls: "cop", y: 2.7, dur: 2.8 });
            const seen = !!(ctx.law.copNear && ctx.law.copNear(car.pos.x, car.pos.z, 90));
            if (!ctx.law.pullOver()) return;
            R.data.tickets--;
            S.tickets++; saveSoon();
            stat("ridesTickets", 1);
            emit("rides:ticket", { seen, left: R.data.tickets });
            if (seen) R.data.impostor = true;     // the scene plays out — then the REAL cop pulls up
            return;
        }
        // 📣 the megaphone: a line + the cars just ahead scoot over
        R.data.megaT = 2.2;
        bubble(pick(T.MEGAPHONE), car.obj, { cls: "cop", y: 2.7, dur: 2.8 });
        nudgeAhead(55);
        if (A.spatial && A.spatial.ready) A.spatial.play("sirenYelp", car.obj, { gain: 0.5, dur: 0.6, key: "rides-yelp" });
        emit("rides:megaphone", {});
    },
    update(dt, R, playing) {
        const d = R.data;
        if (d.megaT > 0) d.megaT -= dt;
        if (!playing || !ctx.law) return;
        // the copStop is over and a real cop watched the whole thing
        if (d.impostor) { d.impostor = false; impostor(R); return; }
        // real cops grow suspicious of a siren they don't recognise
        if (R.siren && !ctx.law.chasing && ctx.law.copNear(ctx.car.pos.x, ctx.car.pos.z, 45)) {
            d.sus += dt;
            if (d.sus > 2 && !d.susSaid) { d.susSaid = true; toast(`👮 "Hey… which precinct are YOU from?"`, "red", "rides:sus"); }
            if (d.sus > 7) { d.sus = 0; d.susSaid = false; impostor(R); }
        } else d.sus = Math.max(0, d.sus - dt * 0.5);
    },
});
function impostor(R) {
    if (!ctx.law || !ctx.law.startChase) return;
    ctx.law.startChase("IMPERSONATING AN OFFICER", { heat: 2, msg: `🚨 "${pick(T.IMPERSONATE_COP)}"` });
    luluSays(pick(T.IMPERSONATE_LULU), true);
    S.impostor++; saveSoon();
    stat("ridesImpostor", 1);
    emit("rides:impostor", {});
}

// ═══════════════════════════════ 🚚 BOX TRUCK ═════════════════════════════
add({
    id: "truck", name: "Box truck", emoji: "🚚", keys: ["truck"],
    handling: { top: 0.72, acc: 0.55, grip: 0.85, brake: 0.62 }, mass: 4, sturdy: 1.2, feel: "heavy",
    horn: "air",
    hint: () => `Heavy! Small cars bounce right off — light bumps cost no ❤️ · ${hornGlyph()} AIR HORN clears the lane`,
});

// ═══════════════════════════════ 🏎️ SPORTS CAR ════════════════════════════
add({
    id: "sports", name: "Sports car", emoji: "🏎️", keys: ["streets_sports"],
    handling: { top: 1.32, acc: 1.45, grip: 0.92, brake: 1.2 }, mass: 1.1,
    nitro: { top: 1.5, acc: 15, drain: 0.7 },
    hint: () => `Launch control: NITRO hits harder and lasts longer in this thing 🔥`,
});
on("boost", () => { const R = ctx.rides && ctx.rides.current; if (R && R.id === "sports" && Math.random() < 0.5) luluSays(pick(T.NITRO)); });

// ═══════════════════════════════ 🚕 TAXI ══════════════════════════════════
const TAXI = { id: "shift", emoji: "🚕", label: "START A SHIFT", short: "FARES", ready: true, why: "" };
add({
    id: "taxi", name: "Taxi", emoji: "🚕", keys: ["rides_taxi"],
    handling: { top: 1.02, acc: 1.0, grip: 1.0, brake: 1.05 }, mass: 1.2,
    horn: "plain",
    hint: () => `A REAL cab! ${trickWords("🚕")} starts a Lulu Cab shift — fares pay +50% in a real taxi`,
    ability() {
        const hu = ctx.hustle;
        if (!hu || hu.job || partyOn()) return null;
        TAXI.ready = ctx.state === "playing";
        return TAXI;
    },
    use() { if (ctx.hustle) ctx.hustle.start("cab", { via: "taxi" }); },
    traffic: {
        kind: "rides_taxi", mix: 0.05, models: ["rides_taxi"],
        spec: { len: 4.4, halfW: 0.9, circles: [1.3, -1.3], r: 0.95, mass: 1.2, model: "rides_taxi", paint: false },
        jack: { model: "rides_taxi", label: "🚕 JACK THE TAXI", vtype: "car", feel: "plain", half: 0.92, fwd: 0.2, len: 1.05, y: [0.42, 0.98],
            handling: { top: 1.02, acc: 1.0, grip: 1.0, brake: 1.05 } },
    },
});
on("hustle:end", e => {
    const R = ctx.rides && ctx.rides.current;
    if (!e || e.id !== "cab" || e.result !== "pass" || !R || R.id !== "taxi" || !(e.pay > 0)) return;
    const n = Math.max(1, Math.round(e.pay * 0.5));
    addCoins(n, "rides:taxi");
    toast(T.TAXI_BONUS(n), "gold", "rides:taxi");
    stat("ridesTaxiBonus", n);
});
