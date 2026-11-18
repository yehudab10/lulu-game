// features/rides — 🚑 THE AMBULANCE.
//
// Horn = the siren (traffic makes way). Rivky at dispatch sends her to a patient lying
// on the right shoulder a few hundred metres up (a bystander waving, a red beacon):
// stop beside them and they climb in the back; then St. Shloimy's ER bay goes up
// past the built road and the clock runs — siren on, every bump costs the tip
// ("OW! The BUMPS!"); stop in the bay and she's paid by the seconds left. Trick:
// 🩹 PATCH UP (+1 ❤️, two kits a ride). The ER remembers a paramedic: once she has
// delivered patients, an ER visit comes with a "the paramedics chipped in" refund.
import { ctx, on, emit, fmtTime } from "../../core/ctx.js";
import { heal, addCoins, damage } from "../../core/driving.js";
import { facingRoad } from "../../world.js";
import { rumble } from "../../input.js";
import { saveSoon } from "../../core/save.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { add, S } from "./registry.js";
import { setSiren } from "./siren.js";
import { live, partyOn, inTown, need, models, pick, rand, clamp, smooth, pt, carLocal, bubble, luluSays, toast, stat,
    borrowPerson, returnPerson, beam, slotAhead, hornGlyph, trickWords } from "./common.js";
import * as T from "./lines.js";
import * as THREE from "three";

const KIT = 2;
const knobs = { erAhead: null };       // tests: put the ER this far ahead instead of past the built road
const PATCH = { id: "patch", emoji: "🩹", label: "PATCH UP", short: "PATCH", ready: true, why: T.PATCH_EMPTY };
const RUN = { phase: "off", t: 0, s: 0, side: 1, patient: null, by: null, erS: 0, left: 0, T: 0, tip: 0, owT: 0, resv: null, er: null };
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

add({
    id: "ambulance", name: "Ambulance", emoji: "🚑", keys: ["foot_ambulance"], vtype: "ambulance",
    handling: { top: 1.0, acc: 0.85, grip: 0.9, brake: 0.9 }, mass: 2.5, feel: "floaty",
    stops: true,
    horn: "siren", siren: "ambulance", lightBar: [0.4, 2.62, 1.3],
    hint: () => `${hornGlyph()} siren · drive to the 🚑 patient, STOP beside them, then rush them to the ER before the clock runs out · ${trickWords("🩹")} patch yourself up (+❤️)`,
    enter(R) {
        R.data.kits = KIT;
        reset();
        RUN.phase = "wait"; RUN.t = 4.5;
        need(["npcMan", "npcWoman", "rides_er"]).catch(() => {});
    },
    exit() { reset(); },
    onSiren(R, on) { if (on) luluSays(pick(T.SIREN_ON_AMB)); },
    ability(R) {
        PATCH.label = `PATCH UP ×${R.data.kits}`;
        PATCH.ready = R.data.kits > 0;
        return PATCH;
    },
    use(R) {
        const G = ctx.G;
        if (G.hearts >= G.maxHearts) { toast(T.PATCH_FULL, "", "rides:patch"); return; }
        R.data.kits--;
        heal(1);
        S.patches++; saveSoon();
        toast(`🩹 +1 ❤️ (${R.data.kits} kit${R.data.kits === 1 ? "" : "s"} left)`, "pink", "rides:patch");
        luluSays(pick(T.PATCH), true);
        stat("ridesPatchUps", 1);
        if (ctx.feel && ctx.feel.damage && ctx.feel.damage.undo) { try { ctx.feel.damage.undo(1); } catch (e) { /* cosmetic */ } }
    },
    status() {
        const car = ctx.car;
        if (RUN.phase === "pickup") return `🚑 Patient <b>${Math.max(0, Math.round(RUN.s - car.s))} m</b>`;
        if (RUN.phase === "load") return "🚑 Loading the patient…";
        if (RUN.phase === "rush") return `🚑 <b>${fmtTime(Math.max(0, RUN.left))}</b> · ER ${Math.max(0, Math.round(RUN.erS - car.s))} m`;
        return "";
    },
    update(dt, R, playing) { tick(dt, R, playing); },
    // an off-duty ambulance in traffic ("returning to base") — jack it on foot
    traffic: {
        kind: "rides_ambulance", mix: 0.015, models: ["foot_ambulance"],
        spec: { len: 6.0, halfW: 1.05, circles: [1.6, -1.4], r: 1.1, mass: 2.5, model: "foot_ambulance", paint: false },
        jack: { model: "foot_ambulance", label: "🚑 JACK THE AMBULANCE", vtype: "ambulance", feel: "floaty", half: 1.01, fwd: 1.8, len: 1.0, y: [0.5, 1.75], paint: "AmbWhite",
            handling: { top: 1.0, acc: 0.85, grip: 0.9, brake: 0.9 } },
    },
});

// ── the run ──────────────────────────────────────────────────────────────
function reset() {
    for (const t of timers.splice(0)) { try { t.fn(); } catch (e) { console.error(e); } }
    if (RUN.patient) returnPerson(RUN.patient);
    if (RUN.by) returnPerson(RUN.by);
    RUN.patient = RUN.by = null;
    removeER();
    beam.hide();
    RUN.phase = "off";
}
function removeER() {
    if (RUN.er && RUN.er.parent) RUN.er.parent.remove(RUN.er);
    if (RUN.resv) { const r = ctx.world.reserved, i = r.indexOf(RUN.resv); if (i >= 0) r.splice(i, 1); }
    RUN.resv = null;
}
function wait(sec) {
    if (RUN.patient) returnPerson(RUN.patient);
    if (RUN.by) returnPerson(RUN.by);
    RUN.patient = RUN.by = null;
    beam.hide();
    RUN.phase = "wait"; RUN.t = sec;
}

/** Rivky sends her to someone on the right shoulder up ahead. */
export function dispatch(ahead = rand(230, 300)) {
    const car = ctx.car;
    if (!models.npcMan || !models.npcWoman) return false;
    if (RUN.patient) returnPerson(RUN.patient);
    if (RUN.by) returnPerson(RUN.by);
    RUN.patient = RUN.by = null;
    removeER();
    const side = 1, s = car.s + ahead;
    const p = borrowPerson(pick(["npcMan", "npcWoman"])), by = borrowPerson("npcWoman");
    if (!p || !by) { returnPerson(p); returnPerson(by); return false; }
    const q = pt(s, side * 8.3);
    p.obj.position.set(q.x, 0.14, q.z);
    p.obj.rotation.set(-Math.PI / 2, q.h + 0.25, 0);            // flat on their back along the kerb
    const b = pt(s + 1.6, side * 9.6);
    by.obj.position.set(b.x, 0, b.z);
    by.obj.rotation.set(0, facingRoad(b.h, side), 0);
    Object.assign(RUN, { phase: "pickup", t: 0, s, side, patient: p, by, tip: 12 });
    beam.show(q.x, q.z, "#FF5252");
    H.banner(`<b>🚑 ${T.DISPATCHER}</b><small>"${pick(T.DISPATCH)}"</small>`, 4200, { key: "rides:dispatch" });
    A.sfxCloseCall(2);
    emit("rides:patient", { phase: "dispatch", s });
    return true;
}

function tick(dt, R, playing) {
    const car = ctx.car;
    beam.pulse(ctx.time);
    tickTimers();
    if (RUN.owT > 0) RUN.owT -= dt;
    if (inTown() && RUN.phase !== "wait" && RUN.phase !== "off") { toast("🚑 Dispatch: never mind — the town ambulance has it.", "", "rides:miss"); removeER(); wait(8); return; }
    switch (RUN.phase) {
        case "wait": {
            if (!playing) return;
            RUN.t -= dt;
            if (RUN.t > 0) return;
            if (!(live() || partyOn()) || inTown() || (ctx.law && ctx.law.chasing) || !dispatch()) RUN.t = 3;
            return;
        }
        case "pickup": {
            const rel = RUN.s - car.s;
            if (RUN.by) { RUN.by.update(dt, { wave: true }); }
            if (RUN.patient) RUN.patient.update(dt, {});
            if (!playing) return;
            if (Math.abs(rel) < 8.5 && car.d * RUN.side > 4.2 && car.speed < 3.2) { RUN.phase = "load"; RUN.t = 0; car.vx *= 0.3; car.vz *= 0.3; return; }
            if (rel < -45) { toast("🚑 You drove right past them! Dispatch sent someone else.", "red", "rides:miss"); wait(10); }
            return;
        }
        case "load": {
            RUN.t += dt;
            const p = RUN.patient, k = RUN.t / 1.1;
            if (RUN.by) RUN.by.update(dt, { cheer: true });
            if (p) {
                // up on their feet, a wobbly shuffle to the back doors, in
                const up = smooth(k * 2.2);
                p.obj.rotation.x = -Math.PI / 2 * (1 - up);
                p.obj.position.y = 0.14 * (1 - up);
                if (k > 0.45) {
                    carLocal(0, -3.4, _v);
                    p.obj.position.x += (_v.x - p.obj.position.x) * Math.min(1, dt * 5);
                    p.obj.position.z += (_v.z - p.obj.position.z) * Math.min(1, dt * 5);
                    p.face(_v.x, _v.z, dt, 8);
                }
                p.update(dt, { walk: k > 0.45 ? 1.4 : 0 });
            }
            if (RUN.t >= 1.1) startRush(R);
            return;
        }
        case "rush": {
            collideER();
            if (!playing) return;
            RUN.left -= dt;
            const rel = RUN.erS - car.s;
            if (Math.abs(rel) < 9 && car.d * RUN.side > 4.2 && car.speed < 3.4) { dropOff(); return; }
            if (RUN.left <= 0 || rel < -60) {
                toast(`🚑 "${pick(T.PATIENT_LATE)}"`, "red", "rides:late");
                emit("rides:patient", { phase: "late" });
                stat("ridesPatientsLost", 1);
                RUN.phase = "gone"; RUN.t = 0;
                beam.hide();
            }
            return;
        }
        case "drop": {
            collideER();
            RUN.t += dt;
            const p = RUN.patient;
            if (p) {
                const door = pt(RUN.erS, RUN.side * 12.0);
                p.face(door.x, door.z, dt, 8);
                const dx = door.x - p.obj.position.x, dz = door.z - p.obj.position.z, d = Math.hypot(dx, dz);
                if (d > 0.4) { const st = Math.min(d, 1.7 * dt) / d; p.obj.position.x += dx * st; p.obj.position.z += dz * st; }
                p.update(dt, { walk: d > 0.4 ? 1.7 : 0, wave: d <= 0.4 });
            }
            if (RUN.t > 3.2) { if (RUN.patient) { returnPerson(RUN.patient); RUN.patient = null; } RUN.phase = "gone"; RUN.t = 0; }
            return;
        }
        case "gone": {
            // the ER stays until it's behind her, then the next call
            collideER();
            RUN.t += dt;
            if (RUN.erS - car.s < -40 || RUN.t > 25) { removeER(); wait(rand(12, 20)); }
            return;
        }
    }
}

function startRush(R) {
    const car = ctx.car;
    if (RUN.patient) { returnPerson(RUN.patient); RUN.patient = null; }
    if (RUN.by) { bubble("Thank you!! 🙏", RUN.by.obj, { cls: "nice", y: 2.1 }); }
    const side = RUN.side;
    const erS = knobs.erAhead != null ? car.s + knobs.erAhead : slotAhead(560, side, 9, 20, 12);
    RUN.erS = erS;
    const dist = erS - car.s;
    RUN.T = RUN.left = clamp(dist / 15.5 + 12, 38, 85);
    RUN.phase = "rush"; RUN.t = 0;
    ctx.world.reserve(erS - 11, erS + 11, side, 8.9, 24);
    RUN.resv = ctx.world.reserved[ctx.world.reserved.length - 1];
    if (models.rides_er) {
        if (!RUN.er) RUN.er = models.rides_er.clone();
        const q = pt(erS, side * 12.6);
        RUN.er.position.set(q.x, 0, q.z);
        RUN.er.rotation.set(0, facingRoad(q.h, side), 0);
        ctx.scene.add(RUN.er);
    }
    const bq = pt(erS, side * 7.4);
    beam.show(bq.x, bq.z, "#FF5252");
    bubble(pick(T.PATIENT_IN), car.obj, { cls: "angry", y: 3.0, dur: 2.6 });
    setSiren(R, true);
    H.banner(`<b>🚑 TO ST. SHLOIMY'S!</b><small>${Math.round(dist)} m · ${fmtTime(RUN.T)} · stop in the ER bay — every bump costs the tip</small>`, 3000, { key: "rides:dispatch" });
    emit("rides:patient", { phase: "pickup", erS, T: RUN.T });
    // drop the waving bystander once she's gone
    const by = RUN.by;
    RUN.by = null;
    if (by) setTimeoutGame(() => returnPerson(by), 4);
}

function dropOff() {
    const car = ctx.car;
    const pay = Math.round(14 + Math.max(0, RUN.left) * 0.5 + RUN.tip);
    addCoins(pay, "rides:patient");
    S.patients++; saveSoon();
    stat("ridesPatients", 1);
    rumble(0.2, 0.5, 220, true);
    A.sfxFanfare && A.sfxFanfare();
    H.banner(`<b>🚑 DELIVERED! +${pay} 💰</b><small>"${pick(T.PATIENT_OUT)}"${RUN.tip > 0 ? ` · tip ${RUN.tip}` : " · no tip (the BUMPS)"}</small>`, 3200, { key: "rides:dispatch" });
    emit("rides:patient", { phase: "drop", pay, left: Math.round(RUN.left) });
    beam.hide();
    // out the back doors and in through the sliding doors
    const p = borrowPerson(pick(["npcMan", "npcWoman"]));
    if (p) { carLocal(-0.3, -3.6, _w); p.obj.position.set(_w.x, 0, _w.z); }
    RUN.patient = p;
    RUN.phase = "drop"; RUN.t = 0;
}

function collideER() {
    const car = ctx.car;
    if (!RUN.er || !RUN.er.parent || Math.abs(car.s - RUN.erS) > 12 || car.d * RUN.side < 8.4) return;
    let imp = 0;
    for (let k = -5; k <= 5; k += 2) { const q = pt(RUN.erS + k, RUN.side * 13.4); imp = Math.max(imp, car.collideStatic(q.x, q.z, 1.0)); }
    for (const k of [-3.4, 3.4]) { const q = pt(RUN.erS + k, RUN.side * 9.2); imp = Math.max(imp, car.collideStatic(q.x, q.z, 0.25)); }
    if (imp > 10) { emit("crash", { impact: imp, kind: "rides_er" }); damage(imp / 20, "St. Shloimy's has a DOOR, Lulu", "rides_er"); }
    else if (imp > 2.5) { A.sfxBump(); rumble(0.5, 0.4, 150, true); }
}

// a bump with someone in the back
on("crash", e => {
    const R = ctx.rides && ctx.rides.current;
    if (!R || R.id !== "ambulance" || RUN.phase !== "rush" || !e || !(e.impact > 3) || RUN.owT > 0) return;
    RUN.owT = 1.5;
    RUN.tip = Math.max(0, RUN.tip - 4);
    bubble(pick(T.PATIENT_OW), ctx.car.obj, { cls: "angry", y: 3.0, dur: 2 });
});

// game-time timers (a skipped scene or a pause never fires them early)
const timers = [];
function setTimeoutGame(fn, sec) { timers.push({ fn, at: ctx.time + sec }); }
export function tickTimers() {
    for (let i = timers.length - 1; i >= 0; i--) if (ctx.time >= timers[i].at) { const t = timers[i]; timers.splice(i, 1); try { t.fn(); } catch (e) { console.error(e); } }
}

// ── the ER remembers a paramedic ─────────────────────────────────────────
let perk = 0;
on("er:admit", () => { if (S.patients > 0 && live() && !partyOn()) perk = Math.min(30, 6 + S.patients * 3); });
on("state", ({ to }) => {
    if (to === "title") { perk = 0; return; }
    if (!perk || (to !== "playing" && to !== "footRun")) return;
    const n = perk;
    perk = 0;
    addCoins(n, "rides:er");
    toast(T.ER_PERK(n), "gold", "rides:er");
});
export const ambDebug = { RUN, dispatch, knobs, get perk() { return perk; } };
