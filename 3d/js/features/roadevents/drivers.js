// features/roadevents — the OTHER DRIVERS: drunk weavers (spilling booze,
// "Is it Purim?!"), texting drifters, traffic MALFUNCTIONS (a breakdown with
// hazards and hood smoke, a flat that limps to the shoulder, a road-rager who
// honks and tailgates), FENDER BENDERS (two cars crunch, the drivers pile out
// to argue, sometimes a cop rolls up), drivers reacting to near misses and
// honks, polite dodges — and AMBULANCES that need you to pull aside.
import * as THREE from "three";
import { ctx, on, emit, addActor } from "../../core/ctx.js";
import { addScore } from "../../core/driving.js";
import { spawnPerson } from "../../core/people.js";
import { registerKind } from "../../traffic.js";
import { LANES_OURS, LANES_ONCOMING } from "../../world.js";
import { rumble } from "../../input.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import { RATES, DRUNK_QUIPS, RUDE_QUIPS, DODGE_QUIPS, RAGE_QUIPS, HONK_REACT, CAR_ARGUE, DRAMA_COP_LINES, CRASH_FLOATERS } from "./config.js";
import { defineEvent, R, count } from "./state.js";
import { K, need, pt, rnd, pick, clamp, bubble, sfx, stat, smoke, personColors, models, cloneWithColors, tone } from "./common.js";

registerKind("roadevents_ambulance", { len: 5.8, halfW: 1.1, circles: [1.6, -1.6], r: 1.1, mass: 2.5, model: K("ambulance"), paint: false });
const NORMAL = new Set(["sedan", "van", "truck"]);

// ── behaviours for freshly spawned traffic ─────────────────────────────────
let malOut = null;
function assign(c) {
    c.data.reSeen = true;
    if (!NORMAL.has(c.kind) || c.ai) return;
    const G = ctx.G;
    const travelled = ctx.car.s - (G.startS || 0);
    if (travelled > 340 && ctx.enabled("roadevents") && !G.roadeventsOff) {     // 2D: calm for the first 4000 px
        let drunk = 0.06, texting = 0.10;
        if (R.zone === "bars") drunk += 0.30;
        if (R.zone === "downtown") texting += 0.16;
        const r = Math.random();
        if (r < drunk) setBehavior(c, "drunk");
        else if (r < drunk + texting) setBehavior(c, "texting");
    }
    if (!c.data.beh && c.dir > 0 && !malOut && ctx.enabled("roadevents") && Math.random() < RATES.malfunction) setBehavior(c, pick(["breakdown", "flat", "rage"]));
}
export function setBehavior(c, beh) {
    c.data.beh = beh;
    c.data.lane = c.dTarget;
    c.data.ph = rnd(0, 6.28);
    c.data.t = 0;
    c.data.quipT = rnd(0.5, 2);
    if (beh === "breakdown" || beh === "flat" || beh === "rage") { malOut = c; c.data.mal = true; }
    if (beh === "breakdown" || beh === "flat") hazards(c, true);
    const prev = c.onRemove;
    c.onRemove = car => { if (malOut === car) malOut = null; hazards(car, false); car.obj.rotation.z = 0; for (const m of car.heads) m.emissiveIntensity = 2; if (prev) prev(car); };
    count("beh_" + beh);
}
function hazards(c, on) {
    if (on && !c.data.tails) {
        c.data.tails = [];
        c.obj.traverse(o => { if (o.isMesh && o.material.name === "Taillight") { c.data.tails.push({ o, orig: o.material }); o.material = o.material.clone(); } });
        c.heads.forEach(m => { m.userData.reOrig = m.emissiveIntensity; });
    } else if (!on && c.data.tails) {
        for (const t of c.data.tails) { t.o.material.dispose(); t.o.material = t.orig; }
        c.data.tails = null;
    }
}

export function updateDrivers(dt) {
    const T = ctx.traffic, car = ctx.car;
    for (const c of T.cars) {
        if (!c.data.reSeen) assign(c);
        if (c.hit || c.ai || !c.data.beh) continue;
        const d = c.data;
        d.t += dt;
        d.quipT -= dt;
        const near = Math.abs(c.s - car.s) < 70;
        switch (d.beh) {
            case "drunk": {
                // big swerves across the lanes (2D: ±95 px/s weave) + spilled booze
                const amp = 2.0, w = 2.6;
                c.d = d.lane + Math.sin(d.t * w + d.ph) * amp;
                c.dTarget = c.d + Math.cos(d.t * w + d.ph) * amp * 0.45;
                T.place(c, 0);
                if (Math.random() < dt * 2.5) car.fx.emit(c.x, 0.5, c.z, rnd(-1, 1), rnd(0.5, 1.5), rnd(-1, 1), 0.22, 0.8, pick([[0.78, 0.64, 0.29], [0.65, 0.47, 0.18], [0.83, 0.69, 0.35]]));
                if (near && d.quipT <= 0 && Math.random() < dt * 0.38 * 8) { d.quipT = 2.2; bubble(pick(DRUNK_QUIPS), c.obj, { t: 2.2, y: 2.4 }); }
                break;
            }
            case "texting": {
                c.dTarget = d.lane + Math.sin(d.t * 1.1 + d.ph) * 1.25;
                if (near && d.quipT <= 0 && Math.random() < dt * 0.6) { d.quipT = 4; bubble(pick(["📱 lol", "📱 omw!", "📱 ...", "📱 typing…", "📱 haha WHAT"]), c.obj, { t: 1.8, y: 2.4 }); }
                break;
            }
            case "breakdown": {
                c.want = Math.max(0.4, c.want - dt * 4);
                if (!d.said && d.t > 0.4 && near) { d.said = true; bubble("Not now, NOT NOW!", c.obj, { t: 2.6, y: 2.4, cls: "red" }); }
                if (Math.random() < dt * 3) smoke(c.x + Math.sin(c.h) * 1.8, 1.3, c.z + Math.cos(c.h) * 1.8, 1, [0.55, 0.55, 0.57]);
                blinkHazards(c);
                break;
            }
            case "flat": {
                c.want = Math.min(c.want, c.base * 0.35);
                if (!d.said && d.t > 0.3 && near) { d.said = true; bubble("thump thump thump…", c.obj, { t: 2.6, y: 2.4 }); }
                if (d.t > 2) c.dTarget = 8.1;             // limp onto the shoulder…
                if (Math.abs(c.d - 8.1) < 0.3) c.want = 0; // …and park there with the hazards on
                c.obj.rotation.z = Math.sin(d.t * 6) * 0.03;
                blinkHazards(c);
                break;
            }
            case "rage": {
                c.want = Math.min(32, Math.max(c.want, c.base * 1.25));
                d.honkT = (d.honkT == null ? rnd(0.8, 1.8) : d.honkT) - dt;
                if (d.honkT <= 0) {
                    d.honkT = rnd(1.4, 3.0);
                    if (near) { sfx.honk(); if (d.quipT <= 0) { d.quipT = 1.8; bubble(pick(RAGE_QUIPS), c.obj, { t: 1.8, y: 2.4, cls: "red" }); } }
                }
                if (Math.random() < dt * 0.5) { const other = LANES_OURS.find(l => Math.abs(l - c.dTarget) > 1); if (other !== undefined) c.dTarget = other; }
                break;
            }
        }
    }
}
function blinkHazards(c) {
    const on = Math.sin(ctx.time * 7) > 0;
    if (c.data.tails) for (const t of c.data.tails) t.o.material.emissiveIntensity = on ? 3 : 0.2;
    for (const m of c.heads) m.emissiveIntensity = on ? 3 : 0.5;
}

// ── near misses, honks, polite dodges ──────────────────────────────────────
on("closeCall", () => {
    if (!ctx.enabled("roadevents")) return;
    const car = ctx.car;
    let best = null, bd = 12;
    for (const c of ctx.traffic.cars) { const dd = Math.hypot(c.x - car.pos.x, c.z - car.pos.z); if (dd < bd && !c.hit) { bd = dd; best = c; } }
    if (!best || (best.data.beh && best.data.beh !== "drunk")) return;
    const r = Math.random();
    if (r < 0.30) { sfx.honk(); bubble("BEEP! BEEP!", best.obj, { t: 1.5, y: 2.4 }); }
    else if (r < 0.55) bubble(pick(RUDE_QUIPS), best.obj, { t: 2.0, y: 2.4 });
});
let honkSnap = null;
on("honk", () => { honkSnap = new Map(ctx.traffic.cars.map(c => [c, c.dTarget])); });
/** After traffic.update: which car moved over for the honk? (2D honks10 quest) */
export function checkHonkMoves() {
    if (!honkSnap) return;
    for (const c of ctx.traffic.cars) {
        const was = honkSnap.get(c);
        if (was !== undefined && was !== c.dTarget && c.laneCooldown >= 3.9) {
            stat("honks10", 1);
            count("honkScares");
            if (Math.random() < 0.4 && ctx.enabled("roadevents")) bubble(pick(HONK_REACT), c.obj, { t: 1.3, y: 2.4 });
        }
    }
    honkSnap = null;
}
/** Regular drivers sometimes swerve aside when Lulu gets right up on them (2D: 32%). */
export function politeDodges() {
    const car = ctx.car;
    for (const c of ctx.traffic.cars) {
        if (c.dir < 0 || c.hit || c.ai || c.data.beh || c.data.dodgeChecked) continue;
        const gap = c.s - car.s;
        if (gap > 2 && gap < 11 && Math.abs(c.d - car.d) < 2 && car.speed > c.speed + 2) {
            c.data.dodgeChecked = true;
            if (Math.random() < 0.32) {
                const other = LANES_OURS.find(l => Math.abs(l - c.dTarget) > 1);
                if (other !== undefined && ctx.traffic.laneFree(c.s, other, 1, 12)) { c.dTarget = other; c.laneCooldown = 4; }
                if (Math.random() < 0.5) bubble(pick(DODGE_QUIPS), c.obj, { t: 1.4, y: 2.4 });
            }
        }
    }
}

// ── fender benders ─────────────────────────────────────────────────────────
const dramas = [];
let crashCool = rnd(...RATES.crash);
export function resetDrivers() { dramas.length = 0; crashCool = rnd(...RATES.crash); malOut = null; }
export function tickFenderBenders(dt) {
    crashCool -= dt;
    if (crashCool > 0 || dramas.length >= 2) return;
    const T = ctx.traffic, car = ctx.car;
    const list = T.cars.filter(c => !c.hit && !c.ai && !c.data.mal && NORMAL.has(c.kind) && c.s - car.s > 45 && c.s - car.s < 260);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.dir !== b.dir) continue;
        if (Math.abs(a.d - b.d) < 3.9 && Math.abs(a.s - b.s) < 5.5) { fenderBender(a, b); crashCool = rnd(10, 22); return; }
    }
}
export function fenderBender(a, b) {
    const T = ctx.traffic;
    for (const [c, o] of [[a, b], [b, a]]) {
        c.hit = true; c.hitT = 0;
        const dx = o.x - c.x, dz = o.z - c.z, L = Math.hypot(dx, dz) || 1;
        c.vx = Math.sin(c.h) * c.speed * 0.25 - dx / L * 1.5;
        c.vz = Math.cos(c.h) * c.speed * 0.25 - dz / L * 1.5;
        c.spinV = (Math.random() < 0.5 ? -1 : 1) * rnd(0.6, 1.4);
        for (const m of c.heads) m.emissiveIntensity = 2;
    }
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    const near = Math.hypot(mx - ctx.car.pos.x, mz - ctx.car.pos.z) < 220;
    if (near) { A.sfxCrash(0.5); tone(180, 0.18, "sawtooth", 0.1, 0, 90); }
    ctx.car.fx.burst(mx, 0.9, mz, 18, 4, [1, 0.8, 0.4], 0.5, 0.6);
    const drama = { a, b, t: 0, drivers: [], cop: null, lineT: 1, who: 0, smokeT: 0 };
    bubble(pick(CRASH_FLOATERS), a.obj, { t: 2.2, y: 2.8, cls: "red big" });
    count("fenderBenders");
    stat("fenderBenders", 1);
    dramas.push(drama);
    // drivers pile out to argue (65%), a cop rolls up (30%) — once the cars have settled
    const wantDrivers = Math.random() < 0.65, wantCop = Math.random() < 0.30;
    need(["npcMan", "npcWoman", "copPerson"]).then(() => {
        drama.wantDrivers = wantDrivers; drama.wantCop = wantCop;
    }).catch(() => {});
    addActor({
        update(dt) {
            drama.t += dt;
            const aGone = !T.cars.includes(a), bGone = !T.cars.includes(b);
            if (aGone && bGone) return false;
            drama.smokeT -= dt;
            if (drama.smokeT <= 0) { drama.smokeT = 0.2; const c = Math.random() < 0.5 ? a : b; smoke(c.x, 1.2, c.z, 1, [0.5, 0.5, 0.52]); }
            if (drama.t > 1.6 && drama.wantDrivers && !drama.drivers.length && !aGone && !bGone) {
                for (const c of [a, b]) {
                    const p = spawnPerson(pick(["npcMan", "npcWoman"]), { colors: personColors() });
                    const side = c.d > 0 ? 1 : -1;
                    const n = ctx.world.road.nearest(c.x, c.z, c.s);
                    const q = pt(n.s, n.d - side * 1.6);
                    p.obj.position.set(q.x, 0, q.z);
                    ctx.scene.add(p.obj);
                    drama.drivers.push(p);
                }
            }
            if (drama.t > 3 && drama.wantCop && !drama.cop && !aGone) {
                const cop = cloneWithColors(models.cop);
                const n = ctx.world.road.nearest(a.x, a.z, a.s);
                const q = pt(n.s - 9, n.d > 0 ? 7.6 : -7.6);
                cop.position.set(q.x, 0, q.z);
                cop.rotation.y = q.h + (n.d > 0 ? 0 : Math.PI) + 0.15;
                ctx.scene.add(cop);
                const lights = [];
                cop.traverse(o => { if (o.isMesh && /LightRed|LightBlue/.test(o.material.name)) { o.material = o.material.clone(); lights.push(o.material); } });
                const officer = models.copPerson ? spawnPerson("copPerson") : null;
                if (officer) { const r = pt(n.s - 5, n.d > 0 ? 6.4 : -6.4); officer.obj.position.set(r.x, 0, r.z); ctx.scene.add(officer.obj); }
                drama.cop = { cop, lights, officer, said: false };
            }
            if (drama.drivers.length === 2) {
                drama.lineT -= dt;
                if (drama.lineT <= 0) { drama.who ^= 1; drama.lineT = 1.8; if (Math.abs(a.s - ctx.car.s) < 90) bubble(pick(CAR_ARGUE), drama.drivers[drama.who].obj, { t: 1.7, y: 2.2, cls: "red" }); }
                drama.drivers.forEach((p, i) => { const o = drama.drivers[1 - i]; p.face(o.obj.position.x, o.obj.position.z, dt, 4); p.update(dt, { talk: drama.who === i, point: drama.who === i }); });
            }
            if (drama.cop) {
                const t = ctx.time;
                drama.cop.lights.forEach((m, i) => { m.emissiveIntensity = Math.sin(t * 10 + i * Math.PI) > 0 ? 4 : 0.3; });
                if (drama.cop.officer) { drama.cop.officer.update(dt, { talk: true }); drama.cop.officer.face(a.x, a.z, dt, 3); }
                if (!drama.cop.said && Math.abs(a.s - ctx.car.s) < 80) { drama.cop.said = true; bubble(pick(DRAMA_COP_LINES), drama.cop.officer ? drama.cop.officer.obj : drama.cop.cop, { t: 2.4, y: 2.3, cls: "cop" }); }
            }
            return a.s - ctx.car.s > -150;
        },
        dispose() {
            for (const p of drama.drivers) if (p.obj.parent) p.obj.parent.remove(p.obj);
            if (drama.cop) { ctx.scene.remove(drama.cop.cop); drama.cop.lights.forEach(m => m.dispose()); if (drama.cop.officer) ctx.scene.remove(drama.cop.officer.obj); }
            const i = dramas.indexOf(drama); if (i >= 0) dramas.splice(i, 1);
        },
    });
    return drama;
}
defineEvent("fenderBender", {
    label: "Fender bender", emoji: "💥", models: [],
    spawn: async () => {
        const car = ctx.car, T = ctx.traffic;
        const s = car.s + 120;
        const a = T.add("sedan", s, 1.75, 1, 0.5), b = T.add("van", s + 2.5, 5.25, 1, 0.5);
        return fenderBender(a, b);
    },
});
defineEvent("drunk", { label: "Drunk driver", emoji: "🍺", models: [], spawn: async (o = {}) => { const c = ctx.traffic.add("sedan", ctx.car.s + (o.ahead || 160), o.d || -1.75, o.dir || -1, 18); setBehavior(c, "drunk"); c.data.reSeen = true; return c; } });
defineEvent("malfunction", { label: "Car trouble", emoji: "🔧", models: [], spawn: async (o = {}) => { const c = ctx.traffic.add("sedan", ctx.car.s + (o.ahead || 120), 5.25, 1, 16); c.data.reSeen = true; setBehavior(c, o.kind || pick(["breakdown", "flat", "rage"])); return c; } });

// ── ambulances ─────────────────────────────────────────────────────────────
let amb = null;
export async function spawnAmbulance(opts = {}) {
    if (amb && ctx.traffic.cars.includes(amb.c)) return amb;
    await need(["ambulance"]);
    const car = ctx.car;
    const fromBehind = opts.behind != null ? opts.behind : true;
    const s = fromBehind ? car.s - 110 : car.s + 420;
    const d = fromBehind ? (Math.abs(car.d - 1.75) < Math.abs(car.d - 5.25) ? 1.75 : 5.25) : pick(LANES_ONCOMING);
    const E = { t: 0, sirenT: 0, blockT: 0, thanked: false, honked: false, passed: false };
    const lights = [];
    const ai = (dt, c) => {
        E.t += dt;
        c.speed += (c.want - c.speed) * Math.min(1, dt * 1.5);
        c.s += c.speed * c.dir * dt;
        c.d += Math.sign(c.dTarget - c.d) * Math.min(Math.abs(c.dTarget - c.d), 3 * dt);
        // traffic ahead pulls over (2D: cars veer to the shoulder)
        for (const o of ctx.traffic.cars) {
            if (o === c || o.dir !== c.dir || o.hit || o.ai) continue;
            const gap = (o.s - c.s) * c.dir;
            if (gap > 0 && gap < 70 && Math.abs(o.d - c.d) < 2.4) { o.dTarget = c.dir > 0 ? (o.d > 3.5 ? 8.0 : 0.6) : (o.d < -3.5 ? -8.0 : -0.6); o.want = Math.min(o.want, 8); o.data.pulled = 1.5; }
            if (o.data.pulled > 0) { o.data.pulled -= dt / 20; if (o.data.pulled <= 0 || gap < -25) { o.data.pulled = 0; o.dTarget = c.dir > 0 ? (o.d > 3.5 ? 5.25 : 1.75) : (o.d < -3.5 ? -5.25 : -1.75); o.want = o.base; } }
        }
        // Lulu in the way (from behind)?
        if (c.dir > 0 && ctx.state === "playing") {
            const gap = car.s - c.s;
            const blocking = gap > 0 && gap < 28 && Math.abs(car.d - c.d) < 2.4;
            if (blocking) {
                c.want = Math.min(c.base, car.speed);
                E.blockT += dt;
                if (E.blockT > 1.5 && !E.honked) { E.honked = true; sfx.honk(); H.toast("🚑 Pull aside for the ambulance!", "red"); }
            } else {
                c.want = c.base;
                if (E.blockT > 0.5 && !E.thanked && gap > -2 && gap < 30) { E.thanked = true; addScore(50, "ambulance"); H.toast("🚑 Good citizen! +50", "gold"); stat("ambulancesCleared", 1); }
            }
            if (!E.passed && gap < -8) { E.passed = true; if (!E.thanked && !E.honked) { E.thanked = true; addScore(50, "ambulance"); H.toast("🚑 Good citizen! +50", "gold"); } }
        }
        // siren + lights
        const blink = Math.sin(E.t * 12) > 0;
        lights.forEach((m, i) => { m.emissiveIntensity = (i % 2 ? !blink : blink) ? 5 : 0.3; });
        E.sirenT -= dt;
        if (E.sirenT <= 0 && Math.abs(c.s - car.s) < 180) { E.sirenT = 0.8; sfx.ambulance(); }
    };
    const c = ctx.traffic.add("roadevents_ambulance", s, d, fromBehind ? 1 : -1, fromBehind ? 36 : 30, { ai, immune: true, data: { amb: true } });
    c.obj.traverse(o => { if (o.isMesh && /LightRed|LightBlue/.test(o.material.name)) { if (!o.userData.reOwn) { o.material = o.material.clone(); o.userData.reOwn = true; } lights.push(o.material); } });
    if (fromBehind && ctx.state === "playing") H.toast("🚑 Ambulance coming up behind you!", "red");
    amb = { c, E };
    count("ambulances");
    return amb;
}
defineEvent("ambulance", { label: "Ambulance", emoji: "🚑", models: ["ambulance"], spawn: spawnAmbulance });
