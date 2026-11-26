// features/streets — 🔧 SHMUEL'S CHOP SHOP.
//
// Every so often Shmuel calls (ctx.phone): "a blue minivan, no questions". Pick up
// and the job's on: one turns up in traffic now and then, jack it, and the shop's
// green-lit drop-off appears on the shoulder ahead — roll in and stop. Shmuel pays
// cash and his guy brings Lulu's own car round. Honk to decline the call.
import * as THREE from "three";
import { ctx, on, hook, emit, addActor } from "../../core/ctx.js";
import { addCoins } from "../../core/driving.js";
import { signTexture, worldMaterials } from "../../world.js";
import * as H from "../../hud.js";
import { models, live, rand, pick, toast, stat, sfx, luluSays } from "./common.js";
import { currentRide, RIDES } from "./jack.js";
import * as T from "./lines.js";

export const CHOP = { job: null, nextT: 75, spawnT: 0, shop: null, done: 0 };
const KIND_NAME = { sedan: "sedan", van: "minivan", truck: "box truck", streets_sports: "sports car" };
const PAY = { sedan: 90, van: 110, truck: 150, streets_sports: 180 };
// the traffic palette (traffic.js PAINTS) with names Shmuel would use
const COLORS = { "#42a5f5": "blue", "#ffffff": "white", "#ffca28": "yellow", "#66bb6a": "green", "#ef5350": "red", "#263238": "black", "#26c6da": "teal", "#ba68c8": "purple" };
const tmp = {};

function want() {
    const kind = pick(Object.keys(KIND_NAME).filter(k => k !== "streets_sports" || models.streets_sports));
    const hex = pick(Object.keys(COLORS));
    return { kind, hex, text: `${COLORS[hex]} ${KIND_NAME[kind]}`, pay: PAY[kind] };
}
/** Shmuel calls with a request (opts: { kind, hex } to pick it). Returns the job or null if the line's busy. */
export function chopRequest(opts = {}) {
    if (!ctx.phone || !ctx.phone.call || CHOP.job) return null;
    const w = Object.assign(want(), opts.kind ? { kind: opts.kind, pay: PAY[opts.kind] || 100 } : {}, opts.hex ? { hex: opts.hex.toLowerCase() } : {});
    w.text = `${COLORS[w.hex] || "shiny"} ${KIND_NAME[w.kind] || w.kind}`;
    const line = pick(T.CHOP_INTRO).replace("{want}", w.text);
    const call = ctx.phone.call({
        from: "Shmuel", emoji: "🔧", color: "#8D6E63", lines: [line, `Pays ${w.pay} 💰. Cash. Like it never happened.`],
        ring: opts.instant ? 0.01 : 3.5, talk: 4.2,
        onAnswer() { CHOP.job = Object.assign({ t: 0 }, w); CHOP.spawnT = 6; H.banner(`<b>🔧 JOB: a ${w.text}</b><small>jack one and bring it to Shmuel's</small>`, 2600, { key: "streets:chop" }); },
        onDecline() { CHOP.nextT = rand(90, 140); },
    });
    if (call && opts.instant) { CHOP.job = Object.assign({ t: 0 }, w); CHOP.spawnT = 2; }
    return call ? w : null;
}

const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function sameColor(a, b) {
    if (!a || !b) return false;
    _c1.set(a); _c2.set(b);
    return Math.abs(_c1.r - _c2.r) + Math.abs(_c1.g - _c2.g) + Math.abs(_c1.b - _c2.b) < 0.06;
}
function matches(ride, job) {
    return !!(ride && job && ride.kind === job.kind && sameColor(ride.color, job.hex));
}

/** One of the wanted cars turns up in traffic ahead now and then.
 *  (In a 🎉 party it's MINE alone — data.partyLocal — and rides a gap in the shared, seeded traffic at that lane's
 *  speed, so nothing ever drives through it; step out in front of it / ram it to make it stop, like any car.) */
function spawnTarget(job) {
    const T2 = ctx.traffic, car = ctx.car;
    if (!models[RIDES[job.kind].model]) return;
    const s = car.s + rand(260, 340), d = pick([1.75, 5.25]);
    if (!T2.laneFree(s, d, 1, 40)) return;
    const party = !!(ctx.party && ctx.party.active && ctx.G.mode === "party");
    if (party) {
        const v = d > 3.5 ? 16 : 21.5;                      // (party/traffic.js's lane speeds)
        if (ctx.party.trafficAt(ctx.party.clock(), s - 30, s + 30).some(o => Math.abs(o.d - d) < 1)) return;
        const c = T2.add(job.kind, s, d, 1, v, { data: { partyLocal: true, chopTarget: true },
            ai: (dt, cc) => { cc.speed = v; cc.s += v * dt; cc.d = cc.dTarget = d; } });
        c.obj.traverse(o => {
            if (!o.isMesh || !o.material || o.material.name !== "Paint") return;
            if (!o.userData.chopOwn) { o.material = o.material.clone(); o.userData.chopOwn = true; }
            o.material.color.set(job.hex);
        });
        c.data.partyLane = true;                              // (party/index.js: she can step out in front of it)
        return;
    }
    const c = T2.add(job.kind, s, d, 1, rand(12, 16));
    c.obj.traverse(o => {
        if (!o.isMesh || !o.material || o.material.name !== "Paint") return;
        if (!o.userData.chopOwn) { o.material = o.material.clone(); o.userData.chopOwn = true; }
        o.material.color.set(job.hex);
    });
    c.data.chopTarget = true;
}

// the drop-off: a glowing pad on the right shoulder with a sign
function makeShop(s) {
    const rd = ctx.world.road, M = worldMaterials();
    const grp = new THREE.Group();
    rd.point(s, 9.6, tmp);
    const padGeo = new THREE.CylinderGeometry(3.2, 3.2, 0.06, 40);
    const padMat = new THREE.MeshBasicMaterial({ color: "#76FF03", transparent: true, opacity: 0.35, depthWrite: false });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(tmp.x, 0.05, tmp.z);
    grp.add(pad);
    const tex = signTexture(["SHMUEL'S 🔧", "NO QUESTIONS"], "#3E2723", "#FFD54F", 512, 256);
    const signMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
    const boardGeo = new THREE.BoxGeometry(3, 1.5, 0.08);
    const board = new THREE.Mesh(boardGeo, [M.metal, M.metal, M.metal, M.metal, signMat, M.metal]);
    rd.point(s + 4, 12.2, tmp);
    board.position.set(tmp.x, 2.8, tmp.z);
    board.rotation.y = rd.at(s).h + Math.PI;
    grp.add(board);
    ctx.scene.add(grp);
    const shop = { s, grp, pad, padMat, own: [padGeo, padMat, signMat, boardGeo], t: 0, x: pad.position.x, z: pad.position.z };
    addActor({
        update(dt) {
            if (CHOP.shop !== shop) return false;
            shop.t += dt;
            padMat.opacity = 0.25 + 0.15 * Math.sin(shop.t * 4);
            const car = ctx.car;
            if (car.s > s + 120) { CHOP.shop = null; return false; }
            if (ctx.state === "playing" && Math.hypot(car.pos.x - shop.x, car.pos.z - shop.z) < 3.2 && car.speed < 4) deliver(shop);
            return CHOP.shop === shop;
        },
        dispose() { ctx.scene.remove(grp); for (const o of shop.own) o.dispose(); if (CHOP.shop === shop) CHOP.shop = null; },
    });
    return shop;
}
/** Tests: the drop-off `ahead` metres up the road. */
export function chopShopAhead(ahead = 60) { CHOP.shop = null; CHOP.shop = makeShop(ctx.car.s + ahead); return CHOP.shop; }

function deliver(shop) {
    const job = CHOP.job, ride = currentRide();
    if (!matches(ride, job)) {
        if (!shop.warned) { shop.warned = true; toast(`🔧 "${pick(T.CHOP_WRONG)}"`, "red", "streets:chopwrong"); }
        return;
    }
    CHOP.job = null; CHOP.done++;
    CHOP.shop = null;
    addCoins(job.pay, "chop");
    sfx.chaChing();
    H.banner(`<b>🔧 DELIVERED! +${job.pay} 💰</b><small>"${pick(T.CHOP_DONE)}" — Shmuel</small>`, 2600, { key: "streets:chop", prio: 2 });
    stat("chopJobs", 1);
    emit("streets:chop", { kind: job.kind, color: job.hex, pay: job.pay });
    // Shmuel's guy brings her own car round (a puff of smoke covers the swap)
    const car = ctx.car;
    car.fx.burst(car.pos.x, 1, car.pos.z, 30, 3, [0.85, 0.85, 0.88], 1.6, 1.2);
    if (ctx.foot && ctx.foot.drive) ctx.foot.drive({ own: true, x: car.pos.x, z: car.pos.z, h: car.h });
    luluSays("Pleasure doing business, Shmuel!", true);
    CHOP.nextT = rand(100, 160);
}

hook("update", (dt, P, controlsOn) => {
    if (!controlsOn || ctx.state !== "playing" || (ctx.town && ctx.town.active)) return;   // (a town detour pauses the order)
    const job = CHOP.job;
    if (!job) {
        if (!live()) return;                               // (a 🎉 party too: Shmuel only calls ME)
        CHOP.nextT -= dt;
        if (CHOP.nextT <= 0 && !(ctx.phone && ctx.phone.busy && ctx.phone.busy()) && !(ctx.law && ctx.law.chasing) && !ctx.engaged()) { CHOP.nextT = rand(100, 160); chopRequest(); }
        return;
    }
    job.t += dt;
    const ride = currentRide();
    if (matches(ride, job)) {
        if (!CHOP.shop) { CHOP.shop = makeShop(ctx.car.s + 380); toast("🔧 That's the one! Shmuel's drop-off is up ahead →", "gold", "streets:chopgo"); }
        return;
    }
    CHOP.spawnT -= dt;
    if (CHOP.spawnT <= 0) { CHOP.spawnT = rand(22, 32); if (live() || job.forced) spawnTarget(job); }
});
hook("runStart", () => { CHOP.job = null; CHOP.shop = null; CHOP.nextT = rand(60, 100); });
