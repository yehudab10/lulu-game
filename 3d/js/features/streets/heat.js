// features/streets — ⭐ HEAT, the GTA way (on top of law's pursuit + its star HUD).
//
// law owns the chase (cop speed relative to Lulu's car, line-of-sight SEARCH with
// flashing stars, escape). We add the 3★+ escalation:
//   • ROADBLOCKS ahead of her: cruisers parked across the lanes with their light
//     bars going, sawhorse barricades on the shoulders, officers who dive for cover,
//     and a SPIKE STRIP across the one open lane;
//   • SPIKE STRIPS shred her tyres: the car wobbles and pulls, sparks fly off the
//     rims, no nitro and a lower top speed — until the spare goes on (or Paint & Pray
//     fixes it). Cruisers that follow her over the strip spin out.
import * as THREE from "three";
import { ctx, on, hook, emit, addActor } from "../../core/ctx.js";
import { registerKind } from "../../traffic.js";
import { spawnPerson } from "../../core/people.js";
import { rumble } from "../../input.js";
import * as H from "../../hud.js";
import { models, need, live, K, clamp, rand, pick, pt, fwd, smooth, toast, stat, sfx, npcSays, luluSays } from "./common.js";
import { addLooseProp } from "./props.js";
import * as T from "./lines.js";

registerKind("streets_rbcop", { len: 4.4, halfW: 0.9, circles: [1.3, -1.3], r: 0.95, mass: 3.2, model: "cop", paint: false });

export const HEAT = { blocks: [], nextT: 8, flat: null, spikes: [] };
const tmp = {}, tmpB = {};
const _v = new THREE.Vector3();
const LANES = [-5.25, -1.75, 1.75, 5.25];

// ── roadblocks ──────────────────────────────────────────────────────────
/** Put a roadblock `ahead` metres up the road. opts: { gap (lane d left open), spikes: bool }. */
export function spawnRoadblock(ahead = 280, opts = {}) {
    if (!models.cop) return null;
    const car = ctx.car, rd = ctx.world.road, T2 = ctx.traffic;
    const s = car.s + ahead;
    const gap = opts.gap != null ? opts.gap : pick([1.75, 5.25]);
    const h = rd.at(s, tmp).h;
    const blk = { s, gap, units: [], cops: [], spikes: null, t: 0, said: false, barriers: [] };
    // cruisers across every lane but the gap, nosed in at an angle like they skidded to a stop
    let k = 0;
    for (const d of LANES) {
        if (Math.abs(d - gap) < 0.5) continue;
        rd.point(s + (k % 2 ? 1.2 : -1.2), d, tmpB);
        const c = T2.add("streets_rbcop", s, d, d < 0 ? -1 : 1, 0, { keep: true, noNearMiss: true, ai: (dt, cc) => { cc.speed = 0; }, data: { streetsBlock: blk, cop: true } });
        c.free = true; c.x = tmpB.x; c.z = tmpB.z; c.h = h + (k % 2 ? 0.75 : -0.75) + (d < 0 ? Math.PI : 0);
        T2.place(c, 0);
        c.onCrash = e => (e.impact > 9 ? undefined : false);         // a nudge is free, ramming it costs a heart
        const bar = ctx.law && ctx.law.lightBar ? ctx.law.lightBar(c.obj) : null;
        blk.units.push({ c, bar, ph: Math.random() });
        k++;
    }
    // barricades on both shoulders (smashable), officers behind the cars
    for (const side of [-1, 1]) {
        rd.point(s + 1.5, side * 7.9, tmpB);
        const b = addLooseProp("barrier", tmpB.x, tmpB.z, h + Math.PI + (side > 0 ? 0.15 : -0.15));

        if (b) blk.barriers.push(b);
    }
    if (models.copPerson) {
        for (const d of [gap > 0 ? 8.6 : -8.6, gap > 0 ? -2.6 : 2.6]) {
            const p = spawnPerson("copPerson");
            p.obj.rotation.order = "YXZ";
            rd.point(s + 4.5, d, tmpB);
            p.obj.position.set(tmpB.x, 0.05, tmpB.z);
            ctx.scene.add(p.obj);
            blk.cops.push({ p, dive: null, d });
        }
    }
    if (opts.spikes !== false) blk.spikes = layStrip(s - 7, gap);
    HEAT.blocks.push(blk);
    addActor({
        update(dt) { return updateBlock(blk, dt); },
        dispose() { removeBlock(blk); },
    });
    H.banner(`<b>${pick(T.ROADBLOCK_BANNER)}</b><small>ram the barricade, dodge the spikes, or go round</small>`, 2200, { key: "streets:rb", prio: 2 });
    emit("streets:roadblock", { s, gap });
    stat("roadblocks", 1);
    return blk;
}
function updateBlock(blk, dt) {
    blk.t += dt;
    const car = ctx.car;
    for (const u of blk.units) if (u.bar) u.bar.set(true, ctx.time + u.ph);
    for (const cop of blk.cops) {
        const o = cop.p.obj;
        if (cop.dive) {
            cop.dive.t += dt;
            const k = Math.min(1, cop.dive.t / 0.5);
            if (k < 1) { o.position.x += cop.dive.vx * dt; o.position.z += cop.dive.vz * dt; o.position.y = 0.05 + Math.sin(Math.PI * k) * 0.6; }
            o.rotation.x = cop.dive.t < 1.4 ? Math.PI / 2 * smooth(k * 1.4) : Math.PI / 2 * (1 - smooth((cop.dive.t - 1.4) / 0.5));
            cop.p.update(dt, { cheer: k < 1 });
            if (cop.dive.t > 1.9) { cop.dive = null; o.rotation.x = 0; }
            continue;
        }
        cop.p.face(car.pos.x, car.pos.z, dt, 5);
        cop.p.update(dt, { point: true, talk: blk.t % 3 < 1.2 });
        // she's coming right at them: dive for cover (nobody gets run over)
        const dx = o.position.x - car.pos.x, dz = o.position.z - car.pos.z, d = Math.hypot(dx, dz), sp = car.speed;
        if (sp > 3 && d < 11 && (dx * car.vx + dz * car.vz) / (d * sp) > 0.5 && ctx.state === "playing") {
            const px = -car.vz / sp, pz = car.vx / sp, side = Math.sign(dx * px + dz * pz) || 1;
            cop.dive = { t: 0, vx: px * side * 6, vz: pz * side * 6 };
            o.rotation.y = Math.atan2(px * side, pz * side);
            npcSays(o, pick(["WHOA!", "SHE'S NOT STOPPING!", "MOVE MOVE MOVE!"]), { always: true });
        }
    }
    if (!blk.said && car.s > blk.s - 70 && ctx.state === "playing") {
        blk.said = true;
        if (blk.cops[0]) npcSays(blk.cops[0].p.obj, pick(T.COP_BARK), { cls: "cop", always: true });
    }
    return car.s < blk.s + 140 && car.s > blk.s - 900;
}
function removeBlock(blk) {
    const i = HEAT.blocks.indexOf(blk);
    if (i >= 0) HEAT.blocks.splice(i, 1);
    for (const u of blk.units) if (ctx.traffic.cars.includes(u.c)) { u.bar && u.bar.set(false); ctx.traffic.remove(u.c); }
    for (const cop of blk.cops) ctx.scene.remove(cop.p.obj);
    if (blk.spikes) removeStrip(blk.spikes);
}

// cadence: while she's SEEN at 3★+, one roadblock at a time, a breather between
hook("update", (dt, P, controlsOn) => {
    if (!controlsOn || ctx.state !== "playing") return;
    const law = ctx.law;
    if (law && law.chasing && law.wanted >= 3 && !law.searching && live()) {
        HEAT.nextT -= dt;
        if (HEAT.nextT <= 0 && !HEAT.blocks.length && ctx.car.speed > 8) {
            HEAT.nextT = rand(20, 28) - (law.wanted - 3) * 3;
            if (models[K("barrier")] && models[K("spikes")]) spawnRoadblock(rand(260, 300));
            else need(["barrier", "spikes", "copPerson"]).then(() => { if (ctx.law && ctx.law.chasing && ctx.state === "playing") spawnRoadblock(rand(260, 300)); }).catch(e => console.error("[streets] roadblock", e));

        }
    } else if (!(law && law.chasing)) HEAT.nextT = Math.max(HEAT.nextT, 6);
    updateFlat(dt);
});

// ── spike strips ────────────────────────────────────────────────────────
export function layStrip(s, d) {
    const tpl = models[K("spikes")];
    const rd = ctx.world.road;
    rd.point(s, d, tmp);
    const obj = tpl ? tpl.clone() : new THREE.Group();
    obj.position.set(tmp.x, 0.01, tmp.z);
    obj.rotation.y = tmp.h;
    ctx.scene.add(obj);
    const st = { s, d, obj, hit: false, x: tmp.x, z: tmp.z, prevS: ctx.car.s, cops: new Set() };
    HEAT.spikes.push(st);
    return st;
}
function removeStrip(st) {
    const i = HEAT.spikes.indexOf(st);
    if (i >= 0) HEAT.spikes.splice(i, 1);
    ctx.scene.remove(st.obj);
}
function checkStrips() {
    const car = ctx.car;
    for (const st of HEAT.spikes) {
        // Lulu: any wheel over the strip as she crosses its line
        const crossed = st.prevS < st.s && car.s >= st.s || st.prevS > st.s && car.s <= st.s;
        if (crossed && !st.hit && Math.abs(car.d - st.d) < 1.8 + 0.9 && ctx.state === "playing") { st.hit = true; puncture(); }
        st.prevS = car.s;
        // a cruiser on her tail rides over it too
        for (const c of ctx.traffic.cars) {
            if (c.hit || !(c.data && c.data.law) || st.cops.has(c)) continue;
            if (Math.abs(c.s - st.s) < 1.2 && Math.abs(c.d - st.d) < 2.6 && c.speed > 6) {
                st.cops.add(c);
                c.hit = true; c.hitT = 0; c.vx = Math.sin(c.h) * c.speed * 0.8; c.vz = Math.cos(c.h) * c.speed * 0.8; c.spinV = (Math.random() < 0.5 ? -1 : 1) * 4;
                sfx.pop();
                toast("💥 Cop SPIKED!", "gold", "streets:copspike");
            }
        }
    }
}
// ── flat tyres ──────────────────────────────────────────────────────────
export function puncture(dur = 22) {
    const G = ctx.G;
    if (HEAT.flat) { HEAT.flat.t = 0; return; }
    HEAT.flat = { t: 0, dur, side: Math.random() < 0.5 ? -1 : 1, scrape: sfx.scrape(), noBoostWas: !!G.noBoost };
    G.noBoost = true;
    sfx.pop();
    rumble(0.9, 0.8, 420, true);
    G.shake = Math.max(G.shake || 0, 0.6);
    H.banner(`<b>🛞 SPIKE STRIP!</b><small>tyres shredded — Paint &amp; Pray fixes them</small>`, 2200, { key: "streets:flat", prio: 2 });
    luluSays(pick(T.SPIKED), true);
    emit("streets:spiked", {});
    stat("spiked", 1);
}
export function repairTyres(msg = "") {
    const f = HEAT.flat;
    if (!f) return;
    HEAT.flat = null;
    if (f.scrape) f.scrape.stop();
    if (ctx.G) ctx.G.noBoost = f.noBoostWas;

    if (msg) toast(msg, "gold", "streets:tyres");
}
function updateFlat(dt) {
    checkStrips();
    const f = HEAT.flat;
    if (!f) return;
    f.t += dt;
    const car = ctx.car;
    if (f.scrape) f.scrape.set(clamp(car.speed / 30, 0, 1) * 0.16);
    // sparks off the bare rim
    if (car.speed > 8 && Math.random() < 0.65) {
        const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = Math.cos(car.h), lz = -Math.sin(car.h);
        const wx = car.pos.x + lx * f.side * 0.82 + fx * 1.25, wz = car.pos.z + lz * f.side * 0.82 + fz * 1.25;
        car.fx.emit(wx, 0.12, wz, -car.vx * 0.15 + (Math.random() - 0.5) * 2, 1.2 + Math.random(), -car.vz * 0.15 + (Math.random() - 0.5) * 2, 0.18, 0.35, [1, 0.75 + Math.random() * 0.2, 0.3]);
    }
    if (f.t >= f.dur) repairTyres("🛞 Spare's on! Tyres are back.");
}
hook("controls", (ctl, dt) => {
    const f = HEAT.flat;
    if (!f) return;
    const car = ctx.car;
    const top = 42 * ((car.stats && car.stats.top) || 1) * 0.62;
    if (car.vF > top) ctl.throttle = 0;
    const wob = Math.sin(f.t * 9.5) * 0.11 + Math.sin(f.t * 23) * 0.05;
    ctl.steer = clamp(ctl.steer + (f.side * 0.13 + wob) * Math.min(1, car.speed / 12), -1, 1);
}, 2);
hook("hud", () => {
    const f = HEAT.flat;
    if (!f || ctx.state !== "playing") return;
    const car = ctx.car, k = Math.min(1, car.speed / 15);
    car.tilt.rotation.z += f.side * 0.045 + Math.sin(f.t * 17) * 0.018 * k;
    car.tilt.rotation.x += Math.sin(f.t * 13) * 0.008 * k;
    car.tilt.position.y -= 0.05;
});

function reset() {
    for (const b of HEAT.blocks.slice()) removeBlock(b);
    for (const st of HEAT.spikes.slice()) removeStrip(st);
    HEAT.blocks.length = 0; HEAT.spikes.length = 0;
    repairTyres();
    HEAT.nextT = 8;
}
hook("runStart", reset);
on("title", reset);
