// features/law — the roadside pull-over ("copBust"): Lulu eases onto the
// shoulder, the cruiser slides in behind her with the lights going, the officer
// strolls up to her window and tells her EXACTLY why she's been stopped — then
// SHE picks how to play it (snack, $20, charm, Bubbe, tears, Shabbos, sass…).
// Outcomes keep the 2D odds on average: let off · booked · impounded (walk).
//
// Also "copStop": when Lulu is the one driving a cruiser, she pulls others over.
import * as THREE from "three";
import { ctx, registerState, setState, emit, wrapAngle } from "../../core/ctx.js";
import { updateDriving, addCoins } from "../../core/driving.js";
import { rumble } from "../../input.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import * as X from "./sfx.js";
import * as UI from "./ui.js";
import { L, setRig, endChase, driveUnit } from "./cops.js";
import { COP_SCENES, BUST_TACTICS, COP_LINE_DUR, COP_STOP_SCENES } from "./data.js";
import { pick, rand, S } from "./rules.js";
import { runFlow, check, line, ask, person, walkTo, quietRoad, restoreRoad, V } from "./scene.js";
import { law, FORCE } from "./service.js";

const tmp = {}, tmpB = {};
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
export const cast = { cop: null, unit: null };   // shared with the arrest scene (same officer, same cruiser)

function autoLulu(dt, d, stop) {
    const car = ctx.car, road = ctx.world.road;
    road.point(car.s + 12, d, tmp);
    const want = Math.atan2(tmp.x - car.pos.x, tmp.z - car.pos.z);
    const diff = wrapAngle(want - car.h);
    // (holding the brake at a standstill would REVERSE — ease off once she's stopped)
    const ctl = { steer: Math.max(-1, Math.min(1, -diff * 3)), throttle: 0, brake: stop ? (car.vF > 0.6 ? 0.9 : 0.25) : 0.35, handbrake: false, analog: true };
    if (!stop && car.speed < 6) { ctl.brake = 0; ctl.throttle = car.speed < 4 ? 0.25 : 0; }
    updateDriving(dt, {}, false, ctl);
}
/** Where an officer stands to talk through Lulu's (left-side) window. */
export function windowSpot(out = _a) {
    const car = ctx.car, h = car.h;
    return out.set(car.pos.x + Math.cos(h) * 1.45 + Math.sin(h) * 0.15, 0, car.pos.z - Math.sin(h) * 1.45 + Math.cos(h) * 0.15);
}
export function copDoor(u, out = _b) {
    const c = u.car, h = c.h;
    return out.set(c.x + Math.cos(h) * 1.25 + Math.sin(h) * 0.3, 0, c.z - Math.sin(h) * 1.25 + Math.cos(h) * 0.3);
}
export function roadsideShot(dt, rate = 1.6) {
    const car = ctx.car, road = ctx.world.road;
    road.point(car.s + 10.5, car.d - 6.5, tmp);
    road.point(car.s - 2.5, car.d - 0.4, tmpB);
    ctx.cam.cinematic(_a.set(tmp.x, 2.3, tmp.z), _b.set(tmpB.x, 1.15, tmpB.z), dt, rate, 46);
}

function reasonText(reason, charges, fugitive) {
    if (fugitive) return "ESCAPE FROM CUSTODY";
    if (charges && charges.length) return charges.slice(0, 2).join(" + ");
    if (reason) return reason;
    if (S.wanted.length) return S.wanted.slice(0, 2).join(" + ");
    return "RECKLESS DRIVING";
}

let flow = null, st = null;
registerState("lawBust", {
    hud: false, touch: false, pausable: true, driving: true,
    enter(data) {
        const u = data.unit;
        st = { u, data, t: 0, stop: false, walking: false, talking: false, done: false, phase: "pull" };
        cast.unit = u;
        quietRoad();
        UI.hideAll();
        UI.header(`🚨 PULLED OVER 🚨<small>${reasonText(data.reason, data.charges, data.fugitive)}</small>`);
        ctx.cam.snap();
        X.chirp();
        rumble(0.4, 0.6, 300, true);
        A.duckMusic(0.15);
        if (u && u.car) {
            u.mode = "pull"; u.siren = true; u.pullD = 7.9; u.stopS = ctx.car.s - 7.2;
            if (!u.car.ai) { u.car.free = true; u.car.ai = (dt, c) => driveUnit(dt, c, u); }
        }
        flow = runFlow(f => script(f, data));
    },
    exit(next) {
        if (flow) flow.kill();
        flow = null;
        UI.hideAll();
        A.duckMusic(0.32);
        if (next !== "lawArrest") {
            restoreRoad();
            if (cast.cop) { ctx.scene.remove(cast.cop.obj); cast.cop = null; }
            if (cast.unit && cast.unit.car && cast.unit.mode === "pull") { cast.unit.mode = "giveup"; cast.unit.siren = false; }
            cast.unit = null;
        }
        st = null;
    },
    update(dt, P) {
        if (!st) return;
        st.t += dt;
        const u = st.u, car = ctx.car;
        autoLulu(dt, 7.9, st.t > 0.6);
        if (u && u.car) { u.stopS = car.s - 7.2; setRig(u.rig, true, ctx.time); }
        const cop = cast.cop;
        if (cop) {
            if (st.walking) { if (walkTo(cop, st.wx, st.wz, 2.2, dt)) st.walking = false; }
            else { cop.face(car.pos.x, car.pos.z, dt, 6); cop.update(dt, { talk: st.talking }); }
        }
        if (flow) flow.tick(dt, P);
        X.sirenUpdate(dt, 0.18, 0, "wail");
    },
    camera(dt) {
        if (st && st.phase === "talk" && cast.cop) {
            // over the officer's shoulder, into Lulu's window
            const car = ctx.car, h = car.h, c = cast.cop.obj.position;
            _a.set(c.x + Math.cos(h) * 1.9 - Math.sin(h) * 2.2, 2.05, c.z - Math.sin(h) * 1.9 - Math.cos(h) * 2.2);
            _b.set(car.pos.x, 1.25, car.pos.z);
            ctx.cam.cinematic(_a, _b, dt, 1.8, 44);
        } else roadsideShot(dt);
        return true;
    },
});

async function script(f, data) {
    const u = data.unit, car = ctx.car;
    // 1 — the cruiser eases up right behind her
    await f.until(() => st.t > 1.2 && car.speed < 0.8 && (!u || !u.car || u.car.speed < 0.6), 4.5);
    check(f);
    // 2 — he climbs out and strolls to her window
    if (u && u.car) {
        await ensureCop();
        check(f);
        const cop = person("copPerson");
        const door = copDoor(u);
        cop.obj.position.copy(door);
        cop.obj.rotation.y = car.h;
        ctx.scene.add(cop.obj);
        cast.cop = cop;
        const w = windowSpot();
        st.wx = w.x; st.wz = w.z; st.walking = true;
        await f.until(() => !st.walking, 6);
        check(f);
    }
    X.blip("cop");   // *tap tap* on the window
    st.phase = "talk";
    const rt = reasonText(data.reason, data.charges, data.fugitive);
    st.talking = true;
    await line(f, "cop", `You're pulled over for: ${rt}.`, { auto: COP_LINE_DUR + 1.2 });
    // 3 — the outcome (2D odds: 10% impound · ~22% let off · the rest booked)
    const forced = !!(data.charges && data.charges.length) || data.fugitive;
    let outcome, scene, tactic = null;
    if (!forced && (FORCE.bustOutcome ? FORCE.bustOutcome === "walk" : Math.random() < 0.10)) {
        outcome = "walk";
        scene = pick(COP_SCENES.filter(s => s.outcome === "walk"));
    } else if (forced) {
        outcome = "ticket";
        scene = pick(COP_SCENES.filter(s => s.outcome === "ticket"));
    } else {
        // SHE picks how to play it
        const pool = BUST_TACTICS.filter(t => t.id !== "honest").sort(() => Math.random() - 0.5).slice(0, 3);
        pool.push(BUST_TACTICS.find(t => t.id === "honest"));
        st.talking = false;
        const i = await ask(f, "lulu", "How do you play this, Lulu?", pool.map(t => t.label));
        tactic = pool[i] || pool[0];
        outcome = FORCE.bustOutcome || (Math.random() < tactic.free ? "free" : "ticket");
        const match = COP_SCENES.filter(s => s.outcome === outcome && s.tactic === tactic.id);
        scene = pick(match.length ? match : COP_SCENES.filter(s => s.outcome === outcome));
    }
    for (const [who, text] of scene.lines) {
        st.talking = who === "cop";
        await line(f, who, text, { auto: COP_LINE_DUR + text.length / 55 });
    }
    st.talking = false;
    // 4 — the outcome lands, holds a beat
    const sub = outcome === "free" ? "Back on the road! 🚗" : outcome === "walk" ? "No car? She'll WALK to Bubbe's..." : `Booked for ${rt}!`;
    UI.header("");
    UI.caption(scene.title, sub);
    if (outcome === "free") X.lost(); else X.wompWomp();
    rumble(outcome === "free" ? 0.2 : 0.6, 0.5, 300, true);
    emit("law:bust", { outcome, reason: rt, tactic: tactic && tactic.id });
    await f.sleep(1.9, true);
    check(f);
    UI.caption("");
    // 5 — resolve
    if (data.fugitive) { st.keepCop = true; law.arrest(["ESCAPE FROM CUSTODY", "RESISTING ARREST"], { fromBust: true }); return; }
    if (outcome === "free") { release(); return; }
    if (outcome === "walk") {
        restoreRoad();
        endUnit();
        if (ctx.foot && ctx.foot.start) { ctx.foot.start("copWalk"); return; }
        H.toast("🚧 The tow truck's busy — drive it home, Lulu!", "pink");
        release();
        return;
    }
    const wasBribe = /BRIBE/.test(scene.title);
    let ch = data.charges && data.charges.length ? data.charges.slice()
        : wasBribe ? ["ATTEMPTED BRIBERY", rt === "RECKLESS DRIVING" ? "SPEEDING" : rt]
        : rt === "SPEEDING" || rt === "RECKLESS DRIVING" ? ["SPEEDING", "RECKLESS DRIVING"] : [rt, "RECKLESS DRIVING"];
    for (const c of data.extra || []) if (!ch.includes(c)) ch.push(c);
    st.keepCop = true;
    law.arrest(ch, { fromBust: true });
}

function endUnit() {
    const u = cast.unit;
    if (u && u.car) { u.mode = "giveup"; u.siren = false; u.t = 0; }
    cast.unit = null;
}
/** Let off: the officer heads back, Lulu pulls out with a breather. */
function release() {
    restoreRoad();
    endUnit();
    L.grace = 6;
    L.apbCool = Math.max(L.apbCool, 8);
    ctx.G.invT = Math.max(ctx.G.invT, 2.5);
    setState("playing");
    H.toast("🍀 Drive safe, Lulu!", "gold");
}

async function ensureCop() {
    const { ensureModels } = await import("../../models.js");
    try { await ensureModels(["copPerson"]); } catch (e) { /* falls back to Lulu's model */ }
}

// ── copStop: Lulu in a cruiser pulls someone over ────────────────────────
let sflow = null, ss = null;
export function pullOver() {
    if (ctx.state !== "playing") return false;
    const car = ctx.car;
    let best = null, bd = 1e9;
    for (const c of ctx.traffic.cars) {
        if (c.hit || (c.data && c.data.law) || c.dir < 0) continue;
        const gap = c.s - car.s;
        if (gap > 4 && gap < 60 && gap < bd) { bd = gap; best = c; }
    }
    if (!best) { UI.say("🚨 No one to bust!", ""); X.deny(); return false; }
    setState("lawStop", { target: best });
    return true;
}
registerState("lawStop", {
    hud: false, touch: false, pausable: true, driving: true,
    enter(data) {
        const c = data.target;
        const r = Math.random();
        const outcome = r < 0.35 ? "bribe" : r < 0.70 ? "jail" : r < 0.90 ? "letgo" : "runs";
        const sc = pick(COP_STOP_SCENES.filter(s => s.outcome === outcome));
        ss = { c, sc, outcome, t: 0 };
        c.ai = (dt, car) => {        // the busted car drifts onto the shoulder and stops
            car.dTarget = 7.9;
            car.d += Math.sign(7.9 - car.d) * Math.min(Math.abs(7.9 - car.d), 2.2 * dt);
            if (!ss || ss.outcome !== "runs" || !ss.bolt) car.speed = Math.max(0, car.speed - 9 * dt);
            else car.speed = Math.min(40, car.speed + 14 * dt);
            car.s += car.speed * dt;
        };
        quietRoad();
        X.chirp();
        UI.header("🚨 YOU'RE THE LAW 🚨<small>Pulling them over…</small>");
        sflow = runFlow(f => stopScript(f));
    },
    exit() { if (sflow) sflow.kill(); sflow = null; UI.hideAll(); restoreRoad(); if (ss && ss.c && ss.c.ai) ss.c.ai = null; ss = null; },
    update(dt, P) {
        if (!ss) return;
        ss.t += dt;
        const c = ss.c, car = ctx.car;
        const gap = c.s - car.s;
        autoLulu(dt, 7.9, gap < 9 || ss.t > 5);
        if (sflow) sflow.tick(dt, P);
    },
    camera(dt) { roadsideShot(dt); return true; },
});
async function stopScript(f) {
    await f.until(() => ss.t > 1.4 && ss.c.speed < 0.5, 5);
    for (const [who, text] of ss.sc.lines) await line(f, who === "lulu" ? "lulu" : "driver", text, { auto: COP_LINE_DUR + text.length / 55 });
    UI.header("");
    if (ss.sc.reward > 0) { addCoins(ss.sc.reward, "copStop"); X.coins(); }
    if (ss.outcome === "runs") ss.bolt = true;
    UI.caption(ss.sc.title, ss.sc.reward > 0 ? `+${ss.sc.reward} 💰` : ss.outcome === "jail" ? "⭐ Justice served!" : ss.outcome === "runs" ? "💨 Gone!" : "");
    await f.sleep(1.8, true);
    check(f);
    UI.caption("");
    if (ss.c && ss.outcome === "jail") ctx.traffic.remove(ss.c);
    setState("playing");
}
