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
import { L, setRig, scriptedCruiser, endChase, driveUnit, spatialSirens, pullDAt } from "./cops.js";
import { ARREST_LINES, LULU_ARREST_LINES, CUFF_LINES } from "./data.js";
import { pick, chargeDialogueFor } from "./rules.js";
import { runFlow, check, line, person, lulu, walkTo, cuffs, disposeCuffs, quietRoad, restoreRoad } from "./scene.js";
import { cast, windowSpot, copDoor, roadsideShot } from "./bust.js";

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), tmp = {};
let flow = null, st = null;

export const JAIL_MODELS = ["copPerson", "lawCell", "lawBooking", "lawStation", "lawCellmate", "lawCart"];

registerState("lawArrest", {
    hud: false, touch: false, pausable: true, driving: true, skip: true,
    enter(data) {
        endChase("arrest");
        quietRoad(180);
        UI.hideAll();
        A.setMusic(null);
        const charges = data.charges && data.charges.length ? data.charges : ["DISTURBING THE PEACE"];
        st = { data, charges, t: 0, phase: data.fromBust ? "cuff" : "pull", unit: null, walkers: [], haulT: 0, hauling: false, lulu: null, cuffs: null };
        UI.header(`🚨 UNDER ARREST 🚨<small>for ${charges.slice(0, 2).join(" + ")}</small>`);
        ensureModels(JAIL_MODELS).catch(() => {});
        // where she's taken (features/places): in a town, THAT town's precinct — the arrest plays right here; on the
        // highway the nearest town's (or, with no town to take her to, the old precinct set + back on the highway)
        st.place = ctx.civic && ctx.civic.claim ? ctx.civic.claim("law") : null;
        // (a town that can't host the arrest would send her back to the highway AFTER this enter — clearing the traffic,
        //  the cruiser below with it. Leave first, so the cruiser is made on the highway.)
        if (!(st.place && st.place.here) && ctx.town && ctx.town.active && ctx.town.leave) {
            ctx.town.leave("quiet");
            // (caught ON FOOT: her spot was a town street, which is gone now — she's cuffed beside the car's spot on the
            //  highway instead, where the cruiser pulls up; the old spot left the shot looking at empty space)
            if (data.onFoot && data.x != null) { data.x = ctx.car.pos.x; data.z = ctx.car.pos.z; data.h = ctx.car.h; }
        }
        // (caught ON FOOT away from her car: the cruiser pulls up by HER, not by the car she left down the street — it used
        //  to stop at the car, she walked 5 s toward it and vanished, and the haul shot whipped the camera across to it)
        st.sAt = ctx.car.s;
        if (data.onFoot && data.x != null && Math.hypot(data.x - ctx.car.pos.x, data.z - ctx.car.pos.z) > 8) {
            const rd = ctx.world.road, n = rd.nearest(data.x, data.z, ctx.car.s, {}), q = rd.point(n.s, n.d, {});
            if (isFinite(n.s) && Math.hypot(q.x - data.x, q.z - data.z) < 6) { st.sAt = n.s; st.sHer = true; }
        }
        // the cruiser: the one that pulled her over, or a fresh one sliding up from behind
        if (cast.unit && cast.unit.car) st.unit = cast.unit;
        else {
            // (on foot: the shoulder's inner edge — in a town the right lane beside the parked row, never the sidewalk)
            const pd = data.onFoot ? (ctx.town && ctx.town.active ? pullDAt(st.sAt) : 5.25) : ctx.car.d;
            st.unit = scriptedCruiser(28, pd, st.sAt);
            st.unit.mode = "pull"; st.unit.pullD = pd; st.unit.stopS = st.sAt - 7.4;
        }
        st.unit.siren = true;
        if (!st.unit.car.ai) { st.unit.car.free = true; st.unit.car.ai = (dt, c) => driveUnit(dt, c, st.unit); }
        ctx.cam.blend(0.6);
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
            if (u.mode === "pull") u.stopS = (st.sHer ? st.sAt : car.s) - 7.4;     // (in the car: wherever it rolls to a stop)
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
            UI.progress(Math.min(1, st.haulT / 4.4), `🚓 ———→ 🏛️ ${UI.precinctName()}`);
        }
        if (flow) flow.tick(dt, P);
        X.sirenUpdate(dt, spatialSirens() ? 0 : st.hauling ? 0.5 : 0.2, 0, "wail");
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
    check(f);      // (the state may have been left meanwhile: pause → title)
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
    // (the cruiser can be gone by now — recycled, a town swap — as copDoor() already allows: the walk goes to where it
    //  stood, just behind her car. It used to read u.car.x of null and the arrest froze mid-cuffs — ci/sweep-logic2, qa18)
    const c = u.car || { x: car.pos.x - Math.sin(car.h) * 6, z: car.pos.z - Math.cos(car.h) * 6, h: car.h };
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
    emit("law:arrest", { charges: st.charges, town: st.place ? st.place.id : null, here: !!(st.place && st.place.here) });
    // in a town: the precinct is round the corner — a moment of pulling away, then the cruiser pulling up at ITS kerb
    // (features/places' placesArrive) and through the doors into booking; no ride across the map, no black
    if (st.place && st.place.here && ctx.civic.arrive) {
        await f.sleep(1.0, true);
        check(f);
        const sR = ctx.car.s;
        if (ctx.civic.arrive({ charges: st.charges, sResume: sR })) return;
    }
    await f.sleep(4.4, true);
    check(f);
    UI.fadeTo(true, 700);
    await f.sleep(0.75);
    check(f);
    const sResume = u.car && Number.isFinite(u.car.s) ? u.car.s + 60 : ctx.car.s + 200;
    // (taken to a town's real precinct: she'll walk out of ITS door, so no stand-in precinct steps on the way in)
    setState("lawJail", { charges: st.charges, arrive: !(st.place && ctx.civic), sResume });
    UI.fadeTo(false, 500);
}
function walk(f, p, x, z, speed) {
    const w = { p, x, z, speed };
    st.walkers.push(w);
    return f.until(() => w.done, 8).then(() => check(f));
}
