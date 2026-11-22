// features/hustle — 🔥 HOT DELIVERY: a cholent, a kugel or a pizza rides in the
// passenger seat. Get it to the customer before it goes cold (🔥 meter); hard
// bumps, potholes, jumps, kerb-hopping and wild drifts spill some of it (💦 meter).
// The customer reviews you (★–★★★★★) and pays by what's left and how hot it is.
import * as THREE from "three";
import { ctx, emit, addActor } from "../../core/ctx.js";
import { addCoins, addScore } from "../../core/driving.js";
import { payCrew } from "./together.js";
import { SHOULDER } from "../../world.js";
import { spawnPerson } from "../../core/people.js";
import { input } from "../../input.js";
import * as H from "../../hud.js";
import { FOODS, REVIEWS, DELIVERY, PAY, TUNE, JOBS } from "./data.js";
import { registerJob, finishJob } from "./jobs.js";
import { seatWorld, ease } from "./rider.js";
import { need, models, cloneWithColors, findNodes, pt, rand, pick, clamp, carDist, bubble, burst } from "./util.js";
import { meterHit } from "./ui.js";
import * as SFX from "./sfx.js";

const _v = new THREE.Vector3();
const CUSTOMER = { npcWoman: { Top: "#7E57C2", Bottom: "#37474F" }, npcMan: { Top: "#26A69A", Bottom: "#455A64" } };

registerJob("delivery", (opts = {}) => {
    const food = FOODS.find(f => f.id === opts.food) || pick(FOODS);
    const car = ctx.car;
    const D = opts.dist || rand(850, 1150);
    const job = {
        id: "delivery", def: JOBS.delivery, phase: "drive", t: 0, food,
        intro: food.board, dropS: car.s + D, drop: null, T: D / 21.5 * food.cool + 9, heat: 1, spill: 0, rideT: 0,
        dish: null, customer: null, custKey: Math.random() < 0.5 ? "npcWoman" : "npcMan", steamT: 0, wob: 0, splashCd: 0, lineCd: 0,
        line() { return this.phase === "hand" ? "Delivered!" : DELIVERY.toLine(food); },
        get emoji() { return food.emoji; },
        timeLeft() { return this.phase === "drive" ? Math.max(0, this.T - this.rideT) : null; },
        target() { return this.phase === "drive" ? this.drop : null; },
        meters() { return [{ cls: "heat", label: "🔥", frac: this.heat }, { cls: "spill", label: "💦", frac: this.spill }]; },
        update(dt) { tick(this, dt); },
        onEvent(name, e) { onEvent(this, name, e); },
        summary(result, why) { return summary(this, result, why); },
        dispose() { dispose(this); },
    };
    const q = pt(job.dropS, 8.6);
    job.drop = { x: q.x, z: q.z };
    need(["hustle_food", job.custKey]).then(ok => {
        if (!ok || !ctx.hustle || ctx.hustle.job !== job) return;
        loadDish(job, opts.from || null);
        const p = spawnPerson(job.custKey, { colors: CUSTOMER[job.custKey] });
        const c = pt(job.dropS + 1, 10.6);
        p.obj.position.set(c.x, 0, c.z);
        ctx.scene.add(p.obj);
        job.customer = p;
    });
    return job;
});

function loadDish(job, from) {
    const anc = ctx.car.anchors && ctx.car.anchors.passenger;
    const dish = cloneWithColors(models.hustle_food);
    for (const n of findNodes(dish, "Food_")) n.visible = n.name.startsWith("Food_" + job.food.id);
    job.dish = dish;
    if (!anc) return;
    anc.add(dish);
    dish.position.set(0, -0.2, 0.08);
    dish.scale.setScalar(0.001);
    // pop in: one eased toss (scale + a little drop onto the seat)
    let t = 0;
    SFX.plop();
    addActor({ foot: true, update(dt) {
        t += dt;
        const k = Math.min(1, t / 0.55), e = ease(k);
        if (job.dish !== dish) return false;
        dish.scale.setScalar(Math.max(0.001, e * 1.25));
        dish.position.y = -0.2 + (1 - e) * 0.9;
        return k < 1;
    } });
}

function spill(job, amt, label) {
    if (job.phase !== "drive" || amt <= 0) return;
    const before = job.spill;
    job.spill = clamp(job.spill + amt * job.food.spill, 0, 1);
    job.wob = Math.min(1.2, job.wob + amt * 6);
    if (job.spill - before > 0.035 && job.splashCd <= 0) {
        job.splashCd = 0.6;
        SFX.splosh();
        meterHit("spill");
        seatWorld(_v);
        const col = job.food.id === "cholent" ? [0.45, 0.28, 0.14] : job.food.id === "kugel" ? [0.92, 0.75, 0.3] : [0.95, 0.35, 0.2];
        burst(_v.x, _v.y + 0.5, _v.z, 10, 2.2, col, 0.28, 0.7);
        H.toast(`${pick(DELIVERY.spillHit)} ${Math.round(job.spill * 100)}%`, "red", { key: "hs-spill" });
        if (job.lineCd <= 0 && job.spill > 0.25) { job.lineCd = 6; bubble(job.spill > 0.6 ? "Lulu! There's barely any LEFT!" : "Careful — that's somebody's Shabbos!", ctx.car.obj, { dur: 2.4, y: 2.2, cls: "angry" }); }
    }
    if (job.spill >= 1) finishJob("fail", "spilled");
}

function tick(job, dt) {
    const car = ctx.car;
    job.splashCd -= dt; job.lineCd -= dt;
    if (job.dish) {
        job.wob = Math.max(0, job.wob - dt * 2.2);
        const w = job.wob;
        job.dish.rotation.set(Math.sin(ctx.time * 21) * 0.18 * w, 0, Math.cos(ctx.time * 17) * 0.2 * w);
        job.dish.position.y = -0.2 + Math.abs(Math.sin(ctx.time * 19)) * 0.06 * w;
    }
    if (job.customer) {
        const ahead = job.dropS - car.s;
        job.customer.face(car.pos.x, car.pos.z, dt, 3);
        job.customer.update(dt, { wave: ahead < 160 && ahead > -10 && job.phase === "drive", cheer: job.phase === "hand" });
    }
    if (job.phase !== "drive") return;
    job.rideT += dt;
    job.heat = clamp(1 - job.rideT / job.T, 0, 1);
    // steam while it's hot (one particle every so often — cheap)
    job.steamT -= dt;
    if (job.steamT <= 0 && job.dish && job.heat > 0.3 && car.fx) {
        job.steamT = 0.22;
        seatWorld(_v);
        car.fx.emit(_v.x, _v.y + 0.55, _v.z, 0, 1.2, 0, 0.3, 0.9, [0.95, 0.95, 0.95]);
    }
    // the road shakes it loose
    const absd = Math.abs(car.d);
    if (absd > SHOULDER && car.speed > 6) spill(job, 0.03 * dt * Math.min(1, car.speed / 15), "offroad");
    if (car.slip > 0.4 && car.speed > 9) spill(job, 0.05 * dt * car.slip, "drift");
    if (input.handbrake && car.speed > 10) spill(job, 0.025 * dt, "handbrake");
    if (job.heat <= 0) { finishJob("fail", "cold"); return; }
    // arrive
    const d = carDist(job.drop.x, job.drop.z);
    if (d < 55 && car.speed > TUNE.stopSpeed) H.prompt(`🛑 Slow down to hand over the ${job.food.id}`);
    else if (d >= 55) H.prompt("");
    if (d < TUNE.stopR + 1 && car.speed < TUNE.stopSpeed + 1) { H.prompt(""); handOff(job); return; }
    if (job.dropS - car.s < -40) {
        // drove past: the customer jogs to a spot up the road
        job.dropS = car.s + rand(90, 140);
        const q = pt(job.dropS, 8.6); job.drop.x = q.x; job.drop.z = q.z;
        if (job.customer) { const c = pt(job.dropS + 1, 10.6); job.customer.obj.position.set(c.x, 0, c.z); bubble("Over HERE! Yoo-hoo!", job.customer.obj, { dur: 2.4, y: 2.0, cls: "angry" }); }
    }
}

function handOff(job) {
    job.phase = "hand";
    const cust = job.customer, dish = job.dish;
    bubble(pick(DELIVERY.handOff), ctx.car.obj, { dur: 2, y: 2.3, cls: "nice" });
    if (dish && cust) {
        // one eased toss from the seat into the customer's arms
        const from = new THREE.Vector3();
        dish.getWorldPosition(from);
        if (dish.parent) dish.parent.remove(dish);
        dish.position.copy(from);
        ctx.scene.add(dish);
        let t = 0;
        const to = new THREE.Vector3();
        addActor({ foot: true, update(dt) {
            t += dt;
            const k = Math.min(1, t / 0.8), e = ease(k);
            to.set(cust.obj.position.x, 1.05, cust.obj.position.z);
            dish.position.lerpVectors(from, to, e);
            dish.position.y += Math.sin(Math.PI * k) * 1.4;
            dish.rotation.y += dt * 6;
            if (k >= 1) { dish.rotation.set(0, 0, 0); return false; }
            return true;
        } });
    }
    job.handT = 0;
    job.update = dt => {
        job.handT += dt;
        if (job.customer) { job.customer.face(ctx.car.pos.x, ctx.car.pos.z, dt, 3); job.customer.update(dt, { cheer: true }); }
        if (job.handT > 1.3) finishJob("pass", "delivered");
    };
}

function onEvent(job, name, e) {
    if (job.phase !== "drive") return;
    if (name === "crash") { const i = e.impact || 0; if (i > 1.5) spill(job, Math.min(0.3, i * 0.018), "crash"); }
    else if (name === "pothole") spill(job, 0.12, "pothole");
    else if (name === "jump") spill(job, 0.06 + (e.air || 0.5) * 0.12, "jump");
}

function stars(job) { return clamp(Math.round((job.heat * 0.45 + (1 - job.spill) * 0.55) * 5 + 0.2), 1, 5); }
function summary(job, result, why) {
    const f = job.food;
    if (result !== "pass") {
        const q = why === "cold" ? pick(DELIVERY.cold) : why === "spilled" ? pick(DELIVERY.spilled) : "\"Where's my food?!\"";
        return { sub: why === "cold" ? "stone cold" : why === "spilled" ? "all over the seat" : "never arrived", rows: [], pay: 0, quote: [f.who, q], stars: 1,
            whyText: why === "cold" ? `The ${f.id} went cold. Nobody eats cold ${f.id}. Nobody.` : why === "spilled" ? `There's more ${f.id} on the seat than in the ${f.id === "pizza" ? "box" : "dish"}.` : "The order never made it.",
            logLine: `HOT DELIVERY · ${f.emoji} ${why}` };
    }
    const st = stars(job);
    const base = Math.round(rand(PAY.delivery[0], PAY.delivery[1]));
    const food = Math.round(base * (0.35 + 0.65 * job.heat) * (1 - job.spill * 0.85));
    const tip = Math.round(Math.min(20, Math.max(0, job.T - job.rideT)) * PAY.deliveryTip * (st >= 4 ? 1 : 0.4));   // caps at 20 s early
    const pay = Math.max(5, food + tip);
    addCoins(payCrew(job, pay), "hustle");          // (for two: the pay split with the crew — together.js)
    addScore(600 + pay * 4, "hustle");
    emit("stat", { id: "hustleDeliveries", n: 1 });
    const rows = [[`${f.emoji} ${f.name} (🔥 ${Math.round(job.heat * 100)}% · 💦 ${Math.round(job.spill * 100)}% spilled)`, `+${food}`]];
    if (tip) rows.push(["💵 Early tip", `+${tip}`]);
    return { sub: f.to, rows, pay, stars: st, quote: [f.who, pick(REVIEWS[st])], whyText: "", logLine: `HOT DELIVERY · ${f.emoji} ${"★".repeat(st)}`, best: { stars: st } };
}

function dispose(job) {
    if (job.dish && job.dish.parent) {
        const d = job.dish;
        // keep the handed-over dish with the customer a moment; anything else just goes
        if (job.phase === "hand" && job.customer) { let t = 0; addActor({ foot: true, update(dt) { t += dt; return t < 2.5; }, dispose() { if (d.parent) d.parent.remove(d); } }); }
        else d.parent.remove(d);
    }
    job.dish = null;
    const c = job.customer;
    if (c) {
        // the customer goes back inside once Lulu has driven on
        const s = job.dropS;
        addActor({ foot: true, update(dt) { c.face(ctx.car.pos.x, ctx.car.pos.z, dt, 3); c.update(dt, { wave: true }); return ctx.car.s - s < 80; }, dispose() { if (c.obj.parent) c.obj.parent.remove(c.obj); } });
    }
    job.customer = null;
    H.prompt("");
}
