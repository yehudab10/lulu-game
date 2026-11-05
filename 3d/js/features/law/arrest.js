// features/law — the arrest cinematic, in the real driving world: the cruiser
// slides up behind her → the officer struts over → a charge-specific bark and
// Lulu's sassy retort → she steps out and the cuffs go on (*click*) → the perp
// walk to the back seat → and you watch the cruiser haul her down the road to
// PRECINCT 18½ (progress bar and all), then fade into booking.
// opts.fromBust skips the approach + banter (the pull-over already played it).
import * as THREE from "three";
import { ctx, registerState, setState, emit } from "../../core/ctx.js";
import { updateDriving } from "../../core/driving.js";
import { ensureModels } from "../../models.js";
import { rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as X from "./sfx.js";
import * as UI from "./ui.js";
import { L, setRig, scriptedCruiser, endChase, driveUnit } from "./cops.js";
import { ARREST_LINES, LULU_ARREST_LINES, CUFF_LINES } from "./data.js";
import { pick, chargeDialogueFor } from "./rules.js";
import { runFlow, check, line, person, lulu, walkTo, cuffs, disposeCuffs, quietRoad, restoreRoad } from "./scene.js";
import { cast, windowSpot, copDoor, roadsideShot } from "./bust.js";

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), tmp = {};
let flow = null, st = null;

export const JAIL_MODELS = ["copPerson", "lawCell", "lawBooking", "lawStation", "lawCellmate", "lawCart"];

registerState("lawArrest", {
    hud: false, touch: false, pausable: true, driving: true,
    enter(data) {
        endChase("arrest");
        quietRoad(180);
        UI.hideAll();
        A.setMusic(null);
        const charges = data.charges && data.charges.length ? data.charges : ["DISTURBING THE PEACE"];
        st = { data, charges, t: 0, phase: data.fromBust ? "cuff" : "pull", unit: null, walkers: [], haulT: 0, hauling: false, lulu: null, cuffs: null };
        UI.header(`🚨 UNDER ARREST 🚨<small>for ${charges.slice(0, 2).join(" + ")}</small>`);
        ensureModels(JAIL_MODELS).catch(() => {});
        // the cruiser: the one that pulled her over, or a fresh one sliding up from behind
        if (cast.unit && cast.unit.car) st.unit = cast.unit;
        else {
            st.unit = scriptedCruiser(28, data.onFoot ? 5.25 : ctx.car.d);
            st.unit.mode = "pull"; st.unit.pullD = data.onFoot ? 5.25 : ctx.car.d;
        }
        st.unit.siren = true;
        if (!st.unit.car.ai) { st.unit.car.free = true; st.unit.car.ai = (dt, c) => driveUnit(dt, c, st.unit); }
        ctx.cam.snap();
        X.chirp();
        X.wompWomp();
        rumble(0.6, 0.6, 400, true);
        flow = runFlow(f => script(f));
    },
    exit() {
        if (flow) flow.kill();
        flow = null;
        UI.hideAll();
        restoreRoad();
        if (st) {
            for (const p of [st.lulu, cast.cop]) if (p) ctx.scene.remove(p.obj);
            if (st.cuffs) disposeCuffs(st.cuffs);
            if (st.unit && st.unit.car) { st.unit.mode = "giveup"; st.unit.siren = false; ctx.traffic.remove(st.unit.car); }
        }
        cast.cop = null; cast.unit = null;
        ctx.car.showDriver(true);
        ctx.car.obj.visible = true;
        st = null;
    },
    update(dt, P) {
        if (!st) return;
        st.t += dt;
        const car = ctx.car, u = st.unit;
        updateDriving(dt, {}, false, { steer: 0, throttle: 0, brake: car.vF > 0.6 ? 1 : 0.25, handbrake: true, analog: true });
        if (u && u.car) {
            if (u.mode === "pull") u.stopS = car.s - 7.4;
            setRig(u.rig, true, ctx.time);
        }
        for (const w of st.walkers) {
            if (w.done) continue;
            if (walkTo(w.p, w.x, w.z, w.speed, dt, w.opts || {})) { w.done = true; if (w.then) w.then(); }
        }
        if (cast.cop && !st.walkers.some(w => w.p === cast.cop && !w.done)) {
            if (st.lulu && st.lulu.obj.visible) cast.cop.face(st.lulu.obj.position.x, st.lulu.obj.position.z, dt, 6);
            else if (!st.hauling) cast.cop.face(car.pos.x, car.pos.z, dt, 6);
            cast.cop.update(dt, { talk: st.copTalk, point: st.copPoint });
        }
        if (st.lulu && !st.walkers.some(w => w.p === st.lulu && !w.done)) st.lulu.update(dt, { talk: st.luluTalk });
        if (st.cuffs && st.lulu) {
            st.lulu.obj.updateMatrixWorld(true);
            st.cuffs.position.set(0, 0.86, 0.2);
        }
        if (st.hauling && u && u.car) {
            st.haulT += dt;
            UI.progress(Math.min(1, st.haulT / 4.4), "🚓 ———→ 🏛️ PRECINCT 18½");
        }
        if (flow) flow.tick(dt, P);
        X.sirenUpdate(dt, st.hauling ? 0.5 : 0.2, 0, "wail");
    },
    camera(dt) {
        if (!st) return true;
        const u = st.unit;
        if (st.hauling && u && u.car) {
            const c = u.car;
            _a.set(c.x - Math.sin(c.h) * 9 + Math.cos(c.h) * 3.5, 3.6, c.z - Math.cos(c.h) * 9 - Math.sin(c.h) * 3.5);
            _b.set(c.x + Math.sin(c.h) * 3, 1.2, c.z + Math.cos(c.h) * 3);
            ctx.cam.cinematic(_a, _b, dt, 3, 52);
        } else if (st.lulu && st.phase !== "pull") {
            const p = st.lulu.obj.position, car = ctx.car, h = car.h;
            _a.set(p.x + Math.cos(h) * 4.6 + Math.sin(h) * 3.2, 2.0, p.z - Math.sin(h) * 4.6 + Math.cos(h) * 3.2);
            _b.set(p.x, 1.1, p.z);
            ctx.cam.cinematic(_a, _b, dt, 1.8, 46);
        } else roadsideShot(dt);
        return true;
    },
});

async function script(f) {
    const car = ctx.car, u = st.unit, d = st.data;
    try { await ensureModels(["copPerson"]); } catch (e) { /* fallback model */ }
    check(f);
    if (st.phase === "pull") {
        // the cruiser slides up behind her
        await f.until(() => st.t > 1.0 && (!u.car || u.car.speed < 0.6), 4);
        check(f);
        // the officer struts over
        const cop = person("copPerson");
        cop.obj.position.copy(copDoor(u));
        ctx.scene.add(cop.obj);
        cast.cop = cop;
        const w = d.onFoot && d.x != null ? _a.set(d.x + 1.2, 0, d.z) : windowSpot();
        await walk(f, cop, w.x, w.z, 2.4);
        // back-and-forth: the cop barks, Lulu sasses
        const cd = chargeDialogueFor(st.charges);
        st.copTalk = true;
        await line(f, "cop", cd ? pick(cd.cop) : pick(ARREST_LINES), { auto: 1.9 + 0.6 });
        st.copTalk = false;
        await line(f, "lulu", cd ? pick(cd.lulu) : pick(LULU_ARREST_LINES), { auto: 1.9 + 0.6 });
    }
    // the officer steps back to make room, and she steps out (or is already standing there on foot)
    if (cast.cop && !d.onFoot) {
        const ws = windowSpot(_a);
        st.walkers.push({ p: cast.cop, x: ws.x + Math.cos(car.h) * 0.7 - Math.sin(car.h) * 1.3, z: ws.z - Math.sin(car.h) * 0.7 - Math.cos(car.h) * 1.3, speed: 1.6 });
    }
    const l = lulu(false);
    if (d.onFoot && d.x != null) { l.obj.position.set(d.x, 0, d.z); l.obj.rotation.y = d.h || 0; }
    else {
        const ws = windowSpot(_b);
        l.obj.position.set((car.pos.x + ws.x) / 2, 0, (car.pos.z + ws.z) / 2);
        l.obj.rotation.y = car.h + Math.PI / 2;
        car.showDriver(false);
    }
    ctx.scene.add(l.obj);
    st.lulu = l;
    if (!cast.cop) {
        const cop = person("copPerson");
        cop.obj.position.copy(windowSpot()).add(_b.set(Math.sin(car.h) * 1.2, 0, Math.cos(car.h) * 1.2));
        ctx.scene.add(cop.obj);
        cast.cop = cop;
    }
    const lp = l.obj.position;
    st.walkers.push({ p: l, x: lp.x + Math.cos(car.h) * 0.9, z: lp.z - Math.sin(car.h) * 0.9, speed: 1.4 });
    st.phase = "cuff";
    await f.sleep(0.7);
    // CUFFING — the rings snap on, *click*
    UI.caption(pick(CUFF_LINES));
    st.copPoint = true;
    await f.sleep(0.55);
    check(f);
    const cf = cuffs();
    l.obj.add(cf);
    st.cuffs = cf;
    X.cuffClick();
    rumble(0.5, 0.3, 120, true);
    UI.caption(pick(CUFF_LINES), "You're being BOOKED...");
    st.copPoint = false;
    await f.sleep(1.2, true);
    check(f);
    // the perp walk to the cruiser's back door
    UI.caption("🚶‍♀️ Into the cruiser...");
    const c = u.car;
    const rear = _a.set(c.x + Math.cos(c.h) * 1.3 - Math.sin(c.h) * 0.8, 0, c.z - Math.sin(c.h) * 1.3 - Math.cos(c.h) * 0.8);
    const rx = rear.x, rz = rear.z;
    st.walkers.push({ p: l, x: rx, z: rz, speed: 1.5 });
    st.walkers.push({ p: cast.cop, x: rx + Math.cos(c.h) * 0.8, z: rz - Math.sin(c.h) * 0.8, speed: 1.5 });
    await f.until(() => st.walkers.every(w => w.done), 5);
    check(f);
    l.obj.visible = false;
    X.doorThunk();
    await f.sleep(0.4);
    cast.cop.obj.visible = false;
    X.doorThunk();
    // DRIVE to the station
    UI.caption("🚓 TAKING LULU TO THE STATION");
    u.mode = "haul";
    st.hauling = true;
    emit("law:arrest", { charges: st.charges });
    await f.sleep(4.4, true);
    check(f);
    UI.fadeTo(true, 700);
    await f.sleep(0.75);
    check(f);
    const sResume = u.car ? u.car.s + 60 : ctx.car.s + 200;
    setState("lawJail", { charges: st.charges, arrive: true, sResume });
    UI.fadeTo(false, 500);
}
function walk(f, p, x, z, speed) {
    const w = { p, x, z, speed };
    st.walkers.push(w);
    return f.until(() => w.done, 8).then(() => check(f));
}
