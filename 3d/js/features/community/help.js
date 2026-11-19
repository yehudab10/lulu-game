// features/community — HELP FOR LULU + the little scenes it plays.
//
//   request(kind)   a volunteer comes to HER: Chaverim "fix" (dents out, +❤️, tyres), "gas"
//                   (a full nitro tank, handed out of the window), "tow" (back onto the street),
//                   Hatzalah "patch" (+❤️, a granola bar, a lecture), Shomrim "visit" / "geese".
//                   In the car the responder follows her round the grid (fleet.pursue) and the
//                   scene plays once she's stopped; on foot it drives up to her (or to her own
//                   parked car: a jump start and she's back behind the wheel).
//   play(def)       a short scene: in the car it's the ⏭-skippable state "communityScene" (car held,
//                   a roadside camera); on foot it's ctx.foot.script. def = { script(f, ss), cam?, people }
//   Chaverim also turn up UNASKED when her car's a wreck and she's sitting still in town.
import * as THREE from "three";
import { ctx, registerState, setState, emit } from "../../core/ctx.js";
import { updateDriving, heal, addCoins } from "../../core/driving.js";
import { glyph } from "../../input.js";
import * as H from "../../hud.js";
import { say, choose, script, closeDialog, isOpen } from "../../core/dialog.js";
import { CM, on, onFoot, luluPos, rand, pick, clamp, wrap, getPerson, putPerson, walkTo, bubble, luluSay, sfx, stat, flow, townCfg, later } from "./common.js";
import { spawnAt, pursue, leave, park, removeVehicle, respond, KIND } from "./fleet.js";
import { ASSIST, PATCH, SHOMRIM, ORGS } from "./lines.js";

const WORKER = { chaverim: "community_volunteer", hatzalah: "community_emt", shomrim: "community_shomer" };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = {};
const inTown = () => !!(ctx.town && ctx.town.active);
const inCar = () => ctx.state === "playing" && !onFoot();

// ── the scene runner ─────────────────────────────────────────────────────
let SS = null;
registerState("communityScene", {
    hud: false, touch: false, pausable: true, driving: true, skip: true,
    enter(data) {
        SS = data && data.ss;
        if (!SS) return;
        SS.foot = false;
        if (ctx.cam) ctx.cam.blend(0.6);
        H.prompt("");
        SS.flow = flow(f => SS.script(f, SS));
    },
    update(dt) {
        const car = ctx.car;
        updateDriving(dt, {}, false, { steer: 0, throttle: 0, brake: car.vF > 0.6 ? 1 : 0.25, handbrake: true, analog: true });
        if (!SS) { setState("playing"); return; }
        tickSS(dt);
        if (SS && SS.flow && SS.flow.done && ctx.state === "communityScene") { const next = SS.next || "playing"; finishSS(); setState(next); }
    },
    camera(dt) {
        if (!SS) return false;
        if (SS.cam) { SS.cam(dt); return true; }
        roadsideShot(dt);
        return true;
    },
    exit() { finishSS(); },
});

/** A roadside shot of Lulu's car: from ahead-left, low. */
export function roadsideShot(dt, rate = 1.8) {
    const car = ctx.car, rd = ctx.world.road;
    rd.point(car.s + 9.5, car.d - 5.6, _p);
    _a.set(_p.x, 2.4, _p.z);
    rd.point(car.s - 2, car.d - 0.2, _p);
    _b.set(_p.x, 1.1, _p.z);
    ctx.cam.cinematic(_a, _b, dt, rate, 46);
}

function tickSS(dt) {
    if (!SS) return;
    if (SS.flow) SS.flow.tick(dt);
    for (const w of SS.walkers || []) {
        if (w.done || !w.p) continue;
        if (walkTo(w.p, w.x, w.z, w.speed || 2.6, dt)) { w.done = true; if (w.then) w.then(); }
    }
    if (SS.tick) { try { SS.tick(dt, SS); } catch (e) { console.error("[community] scene tick", e); } }
}
function finishSS() {
    const ss = SS;
    if (!ss) return;
    SS = null;
    if (ss.flow) ss.flow.kill();
    if (isOpen()) closeDialog();
    for (const p of ss.people || []) putPerson(p);
    ss.people = [];
    if (ss.cutscene && ctx.cutscene) ctx.cutscene.end(ss.cutscene);
    try { if (ss.after) ss.after(ss); } catch (e) { console.error("[community] scene after", e); }
}
/** Play a short scene (in the car: the state; on foot: ctx.foot.script). */
export function play(def) {
    if (SS) return false;
    const ss = Object.assign({ people: [], walkers: [] }, def);
    if (onFoot()) {
        if (!ctx.foot.script || ctx.state !== "footRun") return false;
        SS = ss;
        ss.foot = true;
        ss.cutscene = "communityFoot";
        if (ctx.cutscene) ctx.cutscene.begin(ss.cutscene);
        const ok = ctx.foot.script({
            update: dt => { tickSS(dt); if (SS !== ss) return false; if (ss.flow.done) { finishSS(); return false; } return true; },
            camera: dt => { if (SS !== ss) return false; if (ss.cam) { ss.cam(dt); return true; } footShot(dt); return true; },
            abort: () => { if (SS === ss) finishSS(); },
        });
        if (!ok) { SS = null; if (ctx.cutscene) ctx.cutscene.end(ss.cutscene); return false; }
        ss.flow = flow(f => ss.script(f, ss));
        return true;
    }
    if (ctx.state !== "playing") return false;
    setState("communityScene", { ss });
    return true;
}
export const sceneActive = () => !!SS;
function footShot(dt) {
    const p = ctx.foot.pos, h = ctx.car.h;
    _a.set(p.x + Math.sin(h + 0.9) * 6.5, 2.6, p.z + Math.cos(h + 0.9) * 6.5);
    _b.set(p.x, 1.2, p.z);
    ctx.cam.cinematic(_a, _b, dt, 2, 50);
}
/** Spawn a scene person at (x, z); optional walk target. */
export function actor(ss, key, x, z, to = null, speed = 2.6) {
    const p = getPerson(key);
    if (!p) return null;
    p.obj.position.set(x, 0, z);
    ss.people.push(p);
    if (to) ss.walkers.push({ p, x: to.x, z: to.z, speed });
    return p;
}
/** Where someone stands at Lulu's (left-side) window — or beside her on foot. */
export function windowSpot(out = _a) {
    if (onFoot()) { const p = ctx.foot.pos, h = ctx.car.h; return out.set(p.x + Math.sin(h) * 1.3, 0, p.z + Math.cos(h) * 1.3); }
    const car = ctx.car, h = car.h;
    return out.set(car.pos.x + Math.cos(h) * 1.45 + Math.sin(h) * 0.15, 0, car.pos.z - Math.sin(h) * 1.45 + Math.cos(h) * 0.15);
}
const doorOf = (c, out = _b) => out.set(c.x - Math.cos(c.h) * 1.3 + Math.sin(c.h) * 0.4, 0, c.z + Math.sin(c.h) * 1.3 + Math.cos(c.h) * 0.4);
const look = (p, x, z, dt = 1) => { if (p) p.face(x, z, dt, 8); };

// ── requests: a volunteer comes to HER ───────────────────────────────────
const ORG = { fix: "chaverim", gas: "chaverim", tow: "chaverim", unlock: "chaverim", patch: "hatzalah", fine: "hatzalah", visit: "shomrim", geese: "shomrim" };
/** The stopped car she left on foot (her own, in this run), or null. */
export function ownStub() {
    return ctx.traffic.cars.find(c => c.data && c.data.footStub && /^foot_wreck_lulu$/.test(c.kind)) || null;
}
export function busy() { return !!CM.help || !!SS; }

export function request(kind, { byCall = true, self = false } = {}) {
    const org = ORG[kind];
    if (!org || CM.help || !CM.loaded) return false;
    const car = ctx.car, foot = onFoot();
    let V = null;
    const stub = foot && (kind === "fix" || kind === "unlock") ? ownStub() : null;
    const help = { kind, org, byCall, self, t: 0, phase: "coming", stub };
    if (stub) {
        V = respond(org, { s: stub.s, d: stub.d }, { gap: 7, lights: true, v: 13, from: 80, onArrive: () => { help.phase = "here"; } });
    } else {
        let s, d, dir, v;
        const sp = inTown() && ctx.town.copSpawn ? ctx.town.copSpawn("seen") : null;
        if (sp) { s = sp.s; d = sp.d; dir = sp.dir; v = 9; }
        else { s = car.s - rand(100, 130); d = foot ? 5.25 : car.d > 6 ? 5.25 : car.d; dir = 1; v = Math.max(16, car.speed + 6); }
        V = spawnAt(org, s, d, dir, v, { lights: true, siren: org === "hatzalah" });
        if (V) pursue(V, { gapWant: kind === "gas" ? -3 : -8, side: kind === "gas" ? (car.d > 3.5 ? -3.4 : 3.4) : 0, lights: true });
    }
    if (!V) return false;
    help.V = V;
    CM.help = help;
    emit("community:help", { kind, org, phase: "coming", byCall });
    if (!byCall) H.toast(ASSIST.offer, "gold", { key: "cm-offer" });
    return true;
}
export function cancelHelp(msg = null) {
    const h = CM.help;
    if (!h) return;
    CM.help = null;
    if (h.V && !h.V.dead) leave(h.V);
    if (msg) H.toast(msg, "");
}

export function tickHelp(dt) {
    autoOffer(dt);
    const h = CM.help;
    if (!h || SS) return;
    h.t += dt;
    const V = h.V;
    if (!V || V.dead) { CM.help = null; return; }
    const lp = luluPos(), dist = Math.hypot(V.car.x - lp.x, V.car.z - lp.z);
    const foot = onFoot();
    // lost in the grid (a jam, a dead end, a goose): it turns up round the corner behind her instead
    if (!h.stub && !foot && h.t > 18 && !h.hop && dist > 35) { h.hop = true; hopBehind(V); }
    if (h.t > 70) { cancelHelp(`${ORGS[h.org].emoji} They couldn't find you. (Lakewood has ONE street sign.)`); return; }
    if (h.kind === "gas") {
        if (dist < 12 && !foot) {
            const G = ctx.G;
            G.boost = 1;
            bubble(V.car.obj, pick(ASSIST.gas), 3, "nice");
            H.toast("⛽ NITRO FULL — courtesy of Chaverim", "gold");
            sfx.good();
            stat("communityHelped", 1);
            CM.help = null;
            later(2.5, () => leave(V));
            emit("community:help", { kind: h.kind, org: h.org, phase: "done" });
        }
        return;
    }
    // her own car on foot: the volunteer parks by it, she walks over, it's fixed, she's in
    if (h.stub) {
        if (!ctx.traffic.cars.includes(h.stub) || !foot) { cancelHelp(); return; }
        if (h.phase === "here" && ctx.state === "footRun") stubScene(h);
        return;
    }
    if (foot) {
        if (dist < 15 && ctx.state === "footRun" && !CM.chase) { park(V, true); visitScene(h); }
        return;
    }
    if (ctx.state !== "playing" || (ctx.law && ctx.law.chasing) || CM.chase) return;     // (no pit stops mid-chase)
    if (dist < 13 && ctx.car.speed < 2.5) { park(V, true); visitScene(h); return; }
    if (dist < 30 && ctx.car.speed > 9) h.fast = (h.fast || 0) + dt;
    if ((h.fast || 0) > 14) cancelHelp(ASSIST.cancel);
}

function hopBehind(V) {
    const car = ctx.car, rd = ctx.world.road, n = rd.nearest(car.pos.x, car.pos.z, car.s, {});
    const fwd = Math.sin(car.h) * Math.sin(n.h) + Math.cos(car.h) * Math.cos(n.h) >= 0 ? 1 : -1;
    const s = n.s - fwd * 32, d = inTown() ? fwd * 1.75 : (fwd > 0 ? 5.25 : 1.75), p = rd.point(s, d, {});
    const c = V.car;
    c.x = p.x; c.z = p.z; c.h = fwd > 0 ? p.h : p.h + Math.PI; c.s = s; c.d = d; c.speed = 6;
}

// Chaverim notice a wrecked car sitting still in town and pull up unasked (once in a while)
function autoOffer(dt) {
    CM.assistCool -= dt;
    const G = ctx.G, cfg = townCfg();
    if (!cfg || !cfg.orgs.chaverim || !on() || CM.help || SS || CM.assistCool > 0 || ctx.state !== "playing" || onFoot()) { CM.stillT = 0; return; }
    if ((ctx.law && ctx.law.chasing) || CM.chase) { CM.stillT = 0; return; }
    const hurt = (G.hearts || 0) < (G.maxHearts || 3) || (ctx.streets && ctx.streets.flat);
    if (!hurt || ctx.car.speed > 1.2) { CM.stillT = 0; return; }
    CM.stillT = (CM.stillT || 0) + dt;
    if (CM.stillT > 3) { CM.stillT = 0; CM.assistCool = 75; request("fix", { byCall: false }); }
}

// ── the scenes ───────────────────────────────────────────────────────────
function visitScene(h) {
    const V = h.V, org = h.org, kind = h.kind;
    CM.help = null;
    const ok = play({
        kind, org,
        script: async (f, ss) => {
            const c = V.car, door = doorOf(c), win = windowSpot();
            const w = actor(ss, WORKER[org], door.x, door.z, { x: win.x, z: win.z });
            ss.w = w;
            await f.sleep(1.3);
            if (org === "shomrim") {
                bubble(w && w.obj, pick(kind === "geese" ? SHOMRIM.report.geese : SHOMRIM.report.arrive), 3.2, "cop");
                await f.sleep(3.2);
            } else if (org === "hatzalah") {
                bubble(w && w.obj, pick(PATCH.arrive), 2.8, "nice");
                await f.sleep(2.2);
                bubble(w && w.obj, pick(PATCH.work), 2.8, "nice");
                await f.sleep(2.4);
                const G = ctx.G;
                if (kind === "patch" && G.hearts < G.maxHearts) {
                    heal(1);
                    H.toast("🚑 PATCHED UP +❤️", "pink");
                    stat("communityPatched", 1);
                    bubble(w && w.obj, pick(PATCH.done), 3, "nice");
                } else bubble(w && w.obj, pick(PATCH.fine), 3, "nice");
                sfx.good();
                await f.sleep(2.2);
            } else {
                bubble(w && w.obj, pick(ASSIST.arrive), 2.8, "nice");
                await f.sleep(1.8);
                luluSay(pick(ASSIST.lulu), 2.4);
                if (w) { ss.walkers.push({ p: w, x: hoodSpot().x, z: hoodSpot().z, speed: 2.4 }); }
                await f.sleep(1.4);
                ss.working = true;
                bubble(w && w.obj, pick(kind === "tow" ? ASSIST.tow : ASSIST.work), 3, "nice");
                await f.sleep(3.2);
                ss.working = false;
                fixCar(kind);
                bubble(w && w.obj, pick(ASSIST.done), 3, "nice");
                await f.sleep(2.4);
            }
            if (w) { const d2 = doorOf(c); ss.walkers.push({ p: w, x: d2.x, z: d2.z, speed: 2.8, then: () => { w.obj.visible = false; } }); }
            await f.sleep(1.4);
        },
        tick(dt, ss) {
            const w = ss.w;
            if (!w) return;
            const busyW = ss.walkers.some(x => x.p === w && !x.done);
            if (!busyW) {
                const lp = luluPos();
                look(w, lp.x, lp.z, dt);
                w.update(dt, { talk: true, point: ss.working && Math.sin(ctx.time * 7) > 0 });
                if (ss.working && Math.random() < dt * 4) { sfx.wrench(); const hs = hoodSpot(); ctx.car.fx.burst(hs.x, 0.9, hs.z, 3, 2, [1, 0.85, 0.4], 0.15, 0.4); }
            }
        },
        after() { if (V && !V.dead) later(0.6, () => leave(V)); emit("community:help", { kind, org, phase: "done" }); },
    });
    if (!ok && V && !V.dead) leave(V);
}
function hoodSpot() {
    if (onFoot()) return windowSpot(_b);
    const car = ctx.car, h = car.h;
    return _b.set(car.pos.x + Math.sin(h) * 2.9, 0, car.pos.z + Math.cos(h) * 2.9);
}
/** Dents out, +1 ❤️, tyres back on — or back on the street for a tow. */
function fixCar(kind) {
    const G = ctx.G;
    if (kind === "tow" || kind === "fix") {
        // (a tow also puts her square on the nearest lane)
        if (kind === "tow" && !onFoot()) {
            const rd = ctx.world.road, car = ctx.car, n = rd.nearest(car.pos.x, car.pos.z, car.s, {});
            const fwd = Math.sin(car.h) * Math.sin(n.h) + Math.cos(car.h) * Math.cos(n.h) >= 0 ? 1 : -1;
            const d = inTown() ? fwd * 1.75 : (fwd > 0 ? 5.25 : 1.75), p = rd.point(n.s, d, {});
            car.place(p.x, p.z, fwd > 0 ? p.h : p.h + Math.PI);
            car.s = n.s; car.d = d; car.vx = car.vz = car.vF = 0;
        }
    }
    let did = false;
    if (ctx.feel && ctx.feel.damage && ctx.feel.damage.repair) { try { did = ctx.feel.damage.repair("chaverim") || did; } catch (e) { /* no feel */ } }
    if (ctx.streets && ctx.streets.flat && ctx.streets.repairTyres) { try { ctx.streets.repairTyres(); did = true; } catch (e) { /* no streets */ } }
    if (G.hearts < G.maxHearts) { heal(1); did = true; }
    H.toast(did ? "🔧 FIXED BY CHAVERIM — +❤️" : "🔧 Chaverim checked everything. You're fine!", "gold");
    stat("communityHelped", 1);
    sfx.good();
}
/** On foot: her own car's been stopped (or bailed out of): jump it, she's back in. */
function stubScene(h) {
    const V = h.V, stub = h.stub;
    CM.help = null;
    const ok = play({
        kind: "unlock", org: "chaverim",
        script: async (f, ss) => {
            const door = doorOf(V.car);
            const at = { x: stub.x + Math.sin(stub.h) * 2.8, z: stub.z + Math.cos(stub.h) * 2.8 };
            const w = actor(ss, WORKER.chaverim, door.x, door.z, at);
            ss.w = w;
            const L = ctx.foot.person;
            ss.lulu = { p: L, x: stub.x - Math.cos(stub.h) * 1.4, z: stub.z + Math.sin(stub.h) * 1.4 };
            bubble(w && w.obj, pick(ASSIST.arrive), 2.8, "nice");
            await f.sleep(2.2);
            ss.working = true;
            bubble(w && w.obj, pick(ASSIST.unlock), 3, "nice");
            await f.sleep(3.2);
            ss.working = false;
            await f.sleep(0.4);
        },
        tick(dt, ss) {
            const w = ss.w, L = ss.lulu;
            if (L && L.p && ctx.foot.pos) {
                // walk Lulu to her door
                const F = ctx.foot.pos, dx = L.x - F.x, dz = L.z - F.z, d = Math.hypot(dx, dz);
                if (d > 0.2) { const k = Math.min(d, 3 * dt) / d; F.x += dx * k; F.z += dz * k; L.p.obj.position.set(F.x, 0.05, F.z); L.p.face(L.x, L.z, dt, 10); L.p.update(dt, { walk: 3 }); }
                else { L.p.face(stub.x, stub.z, dt, 6); L.p.update(dt, {}); }
            }
            if (w && !ss.walkers.some(x => x.p === w && !x.done)) {
                look(w, stub.x, stub.z, dt);
                w.update(dt, { point: ss.working && Math.sin(ctx.time * 7) > 0, talk: true });
                if (ss.working && Math.random() < dt * 4) sfx.wrench();
            }
        },
        after() {
            // back behind the wheel, fixed up
            if (ctx.foot && ctx.foot.active && ctx.traffic.cars.includes(stub)) {
                try { ctx.foot.drive({ own: true, x: stub.x, z: stub.z, h: stub.h }); } catch (e) { console.error("[community] drive", e); }
                later(0.2, () => fixCar("fix"));
            }
            if (V && !V.dead) later(1, () => leave(V));
            emit("community:help", { kind: "unlock", org: "chaverim", phase: "done" });
        },
    });
    if (!ok && V && !V.dead) leave(V);
}
export { inCar };
