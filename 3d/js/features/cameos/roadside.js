// features/cameos — roadside cameos: the SASQUATCH (honk while he waves and he
// hitches a ride), HESHY in his pool (cruise past his yard → a cannonball and a
// shield), and the three UNCLES taking turns on the shoulder (a wave + a tip).
import { ctx, on, hook, addActor, pick } from "../../core/ctx.js";
import { saveSoon, store as saveStore } from "../../core/save.js";
import { registerModels } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { addCoins } from "../../core/driving.js";
import { facingRoad } from "../../world.js";
import { glyph, rumble } from "../../input.js";
import * as H from "../../hud.js";
import { THREE, models, cloneWithColors, bubble, loadModels, clamp, ease, stat, sfx, tone, findSpot, prop, inHand, onBody, roadPoint } from "./common.js";
import { rideActive } from "./avigail.js";

registerModels({
    cameos_sasquatch: "cameos_sasquatch", cameos_heshyPool: "cameos_heshy_pool", cameos_props: "cameos_props",
    cameos_yedidya: "cameos_yedidya", cameos_burry: "cameos_burry", cameos_shuey: "cameos_shuey", cameos_catAngel: "cameos_cat_angel",
});
const S3 = saveStore("cameos", { uncleIdx: 0, sasquatchRides: 0 });

function spotWorld(spot) { return roadPoint(spot.s, spot.d); }
const relS = s => s - ctx.car.s;

// ── the SASQUATCH ────────────────────────────────────────────────────────
let sas = null;
export const sasquatchOut = () => !!sas;
export async function spawnSasquatch(opts = {}) {
    if (sas && !opts.force) return null;
    if (!await loadModels(["cameos_sasquatch", "cameos_props"])) return null;
    const car = ctx.car;
    const a = opts.ahead || 170;
    const spot = opts.spot || findSpot(car.s + a, car.s + a + 60, opts.side || 0, 15, 20, 2.5);
    if (!spot) return null;
    const big = spawnPerson("cameos_sasquatch");
    const deep = Math.sign(spot.d) * 6;      // he steps out from the trees
    const start = roadPoint(spot.s, spot.d + deep), end = spotWorld(spot);
    big.obj.position.set(start.x, 0, start.z);
    ctx.scene.add(big.obj);
    const honk = bubble(`📣 HONK! ${glyph("honk")}`.replace(/<[^>]+>/g, ""), { bg: "#FFD54F", fg: "#3E2723", size: 0.9 });
    honk.position.set(0, 3.0, 0);
    honk.visible = false;
    big.obj.add(honk);
    const st = { phase: 0, t: 0, started: false, waved: false, picked: false };
    sas = addActor({
        kind: "sasquatch", st,
        update(dt) {
            const rs = relS(spot.s);
            if (!st.started && rs < 165) st.started = true;
            if (st.started) st.t += dt;
            // 0: walks out of the woods → 1: looks around + waves (HONK!) → 2: back into the woods
            if (st.phase === 0) {
                const k = clamp(st.t / 1.6, 0, 1);
                big.obj.position.set(start.x + (end.x - start.x) * k, 0, start.z + (end.z - start.z) * k);
                big.face(end.x, end.z, dt);
                big.update(dt, { walk: st.started ? 1.6 : 0 });
                if (k >= 1) { st.phase = 1; st.t = 0; }
            } else if (st.phase === 1) {
                big.face(ctx.car.pos.x, ctx.car.pos.z, dt, 3);
                big.update(dt, { wave: true });
                honk.visible = true; honk.tick(dt);
                honk.position.y = 3.0 + Math.sin(st.t * 6) * 0.1;
                if (ctx.state === "playing" && rs < 150 && rs > -30) H.prompt(`🦍 ${glyph("honk")} HONK at the sasquatch!`);
                if (st.t > 3.5) {
                    if (!st.waved) {            // he waved at you → +10
                        st.waved = true;
                        addCoins(10, "sasquatch");
                        H.toast("🦍 SASQUATCH! +10", "gold");
                    }
                    st.phase = 2; st.t = 0; honk.visible = false; H.prompt("");
                }
            } else if (st.phase === 2) {
                const k = clamp(st.t / 1.5, 0, 1);
                big.obj.position.set(end.x + (start.x - end.x) * k, 0, end.z + (start.z - end.z) * k);
                big.face(start.x, start.z, dt);
                big.update(dt, { walk: 1.6 });
                if (k >= 1 || rs < -60) return false;
            } else if (st.phase === 3) {
                return leap(dt);
            }
            return rs > -120;
        },
        dispose() { ctx.scene.remove(big.obj); honk.dispose(); if (st.phase === 1) H.prompt(""); if (sas === this) sas = null; },
    });
    // the leap into Lulu's car
    let lt = 0;
    const from = new THREE.Vector3();
    function leap(dt) {
        lt += dt;
        const seat = new THREE.Vector3();
        ctx.car.obj.getWorldPosition(seat);
        const k = clamp(lt / 0.9, 0, 1);
        big.obj.position.lerpVectors(from, seat, ease(k));
        big.obj.position.y = Math.sin(k * Math.PI) * 6;
        big.obj.rotation.y += dt * 8;
        big.update(dt, { cheer: true });
        if (k >= 1) { boardSasquatch(); return false; }
        return true;
    }
    sas.spotS = spot.s;
    sas.pickup = () => {
        if (st.phase !== 1 || st.picked) return false;
        st.picked = true;
        st.phase = 3; honk.visible = false; H.prompt("");
        from.copy(big.obj.position);
        addCoins(25, "sasquatch");
        H.toast("🦍 HITCHHIKER! +25", "gold");
        sfx.sting(); rumble(0.3, 0.5, 200);
        const heart = bubble("♥", { bg: "#FF80AB", fg: "#fff", tail: false, size: 0.7 });
        heart.position.set(0, 3, 0); big.obj.add(heart);
        setTimeout(() => heart.dispose(), 900);
        return true;
    };
    return sas;
}
// honk while he waves (and he's in view) → he hitches a ride
on("honk", () => {
    if (!sas || ctx.state !== "playing") return;
    const rs = relS(sas.spotS);
    if (rs < 150 && rs > -30) sas.pickup();
});

let rider = null;
function boardSasquatch() {
    if (!models.cameos_sasquatch) return;
    const p = spawnPerson("cameos_sasquatch", { scale: 0.6 });
    const holder = new THREE.Group();
    holder.add(p.obj);
    const slot = rideActive() ? "deck" : "passenger";   // Avigail has shotgun → he squishes onto the back
    p.obj.position.set(0, slot === "deck" ? -0.32 : -0.38, slot === "deck" ? 0.1 : 0.05);
    ctx.car.attach(slot, holder);
    rider = { p, holder, slot, t: 20 };            // 20 seconds in the car
    S3.sasquatchRides = (S3.sasquatchRides || 0) + 1; saveSoon();
}
function dropRider(gift) {
    if (!rider) return;
    if (ctx.car.attached && ctx.car.attached[rider.slot] === rider.holder) ctx.car.attach(rider.slot, null);
    rider = null;
    if (gift) {
        addCoins(50, "sasquatch");              // parting gift
        H.toast("🐟 Sasquatch left you a fish! +50", "gold");
        if (models.cameos_props && !(ctx.car.attached && ctx.car.attached.dash)) {
            const fish = prop("cameos_props", "Fish");
            fish.scale.setScalar(0.7);
            fish.position.y = 0.06;
            ctx.car.attach("dash", fish);
            fishOnDash = fish;
        }
    }
}
let fishOnDash = null;
hook("update", (dt, P, controlsOn) => {
    if (!rider) return;
    rider.p.update(dt, { sit: true, cheer: ctx.G.boosting || Math.sin(ctx.time * 2) > 0.85 });
    if (controlsOn && (rider.t -= dt) <= 0) dropRider(true);
});
on("run:start", () => {
    dropRider(false);
    if (fishOnDash && ctx.car.attached && ctx.car.attached.dash === fishOnDash) ctx.car.attach("dash", null);
    fishOnDash = null;
});
on("foot:start", () => dropRider(false));

// ── HESHY's in the pool (with his shades on 😎) ──────────────────────────
let heshy = null;
export const heshyOut = () => !!heshy;
export async function spawnHeshy(opts = {}) {
    if (heshy && !opts.force) return null;
    if (!await loadModels(["cameos_heshyPool", "heshyPerson", "cameos_props"])) return null;
    const car = ctx.car;
    const a = opts.ahead || 300;
    const spot = opts.spot || findSpot(car.s + a, car.s + a + 120, opts.side || 0, 14, 16.5, 5.2);
    if (!spot) return null;
    const p = spotWorld(spot);
    const yard = cloneWithColors(models.cameos_heshyPool);
    yard.position.set(p.x, 0, p.z);
    yard.rotation.y = facingRoad(p.h, Math.sign(spot.d));
    const hes = spawnPerson("heshyPerson");
    hes.obj.position.set(0, -0.32, 0);       // waist-deep in his inflatable pool
    onBody(hes, prop("cameos_props", "Shades"), [0, 1.565, 0.195]);
    yard.add(hes.obj);
    ctx.scene.add(yard);
    const sign = bubble("😎", { bg: "#4FC3F7", fg: "#fff", size: 0.7 });
    sign.position.set(0, 2.1, 0); sign.visible = false;
    hes.obj.add(sign);
    let t = 0, triggered = false, jumpT = -1;
    heshy = addActor({
        kind: "heshy",
        update(dt) {
            t += dt;
            const rs = relS(spot.s);
            // he spots you coming and waves; drive past his yard → the cameo
            const near = rs < 90 && rs > -20;
            hes.face(ctx.car.pos.x, ctx.car.pos.z, dt, 2);
            hes.update(dt, { wave: near && !triggered, cheer: jumpT >= 0, talk: near });
            sign.visible = near && !triggered; if (sign.visible) sign.tick(dt);
            if (!triggered && Math.abs(rs) < 10 && ctx.state === "playing") { triggered = true; jumpT = 0; triggerHeshy(hes, yard); }
            if (jumpT >= 0) {                  // CANNONBALL
                jumpT += dt;
                const k = clamp(jumpT / 1.1, 0, 1);
                hes.obj.position.y = -0.32 + Math.sin(k * Math.PI) * 2.2;
                hes.obj.rotation.x = k < 1 ? k * Math.PI * 2 : 0;
                if (k >= 1 && jumpT < 2) { jumpT = 9; splash(yard, 40); sfx.splash(); hes.obj.rotation.x = 0; }
            } else hes.obj.position.y = -0.32 + Math.sin(t * 2.5) * 0.03;
            return rs > -120;
        },
        dispose() { ctx.scene.remove(yard); sign.dispose(); if (heshy === this) heshy = null; },
    });
    return heshy;
}
function splash(yard, n) {
    const c = new THREE.Vector3();
    yard.getWorldPosition(c);
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 1.2;
        ctx.car.fx.emit(c.x + Math.cos(a) * r, 0.9, c.z + Math.sin(a) * r, Math.cos(a) * 2.5, 3 + Math.random() * 4, Math.sin(a) * 2.5, 0.35, 1.0, [0.55, 0.85, 1]);
    }
}
/** Heshy cannonballs into the scene: a 4.5 s shield + a funny cameo, never costing anything. */
export function triggerHeshy(hes, yard) {
    const G = ctx.G;
    G.invT = Math.max(G.invT || 0, 4.5);
    stat("heshy2", 1);                         // weekly quest: find Heshy
    H.toast("😎 HESHY!", "");
    H.banner(`🏊 <b>Heshy's in the pool</b><small>with his shades on 😎</small>`, 3200);
    sfx.splash();
    rumble(0.2, 0.5, 250);
    if (yard) splash(yard, 20);
    shieldOn(4.5);
}
// a shimmering bubble shield around the car for the cameo's invincibility
let shield = null;
function shieldOn(secs) {
    if (!shield) {
        shield = new THREE.Mesh(new THREE.SphereGeometry(2.9, 24, 16), new THREE.MeshBasicMaterial({ color: "#4FC3F7", transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
        shield.scale.set(1, 0.62, 1.15);
        shield.position.y = 0.9;
        shield.renderOrder = 5;
    }
    shield.userData.t = secs;
    ctx.car.obj.add(shield);
}
hook("update", dt => {
    if (!shield || !shield.parent) return;
    shield.userData.t -= dt;
    shield.material.opacity = 0.12 + 0.08 * Math.sin(ctx.time * 9) * (shield.userData.t < 1 ? Math.sin(ctx.time * 30) : 1);
    shield.rotation.y += dt;
    if (shield.userData.t <= 0) shield.parent.remove(shield);
});
on("run:start", () => { if (shield && shield.parent) shield.parent.remove(shield); });

// ── the UNCLES (rotating: Yedidya → Burry → Shuey) ───────────────────────
export const UNCLES = [
    { id: "yedidya", name: "Uncle Yedidya", model: "cameos_yedidya", color: "#FFF3E0", quips: [
        "Fresh from the cow — no pasteurizing!", "Vaccines? I don't DO shots.",
        "Forty-two and fabulous... still looking though.", "Swig of raw milk? It's ORGANIC."] },
    { id: "burry", name: "Uncle Burry", model: "cameos_burry", color: "#A5D6A7", quips: [
        "Lakewood to Vegas, baby! 🎲", "Mindy packed the kids, I packed... the vibes.",
        "So chill. So blessed.", "Desert's callin', cousin."] },
    { id: "shuey", name: "Uncle Shuey", model: "cameos_shuey", color: "#B3E5FC", quips: [
        "Rough year... the divorce, then the cat.", "Just me and Avraham now.",
        "I'm a doctor, but I couldn't save Fluffy. 😿", "Say hi to your uncle, Avraham."] },
];
let uncle = null;
export const uncleOut = () => !!uncle;
export async function spawnUncle(opts = {}) {
    if (uncle && !opts.force) return null;
    const idx = opts.id ? Math.max(0, UNCLES.findIndex(u => u.id === opts.id)) : (S3.uncleIdx || 0) % 3;
    const u = UNCLES[idx];
    const keys = [u.model, "cameos_props"];
    if (u.id === "burry") keys.push("npcWoman", "npcKid");
    if (u.id === "shuey") keys.push("npcKid", "cameos_catAngel");
    if (!await loadModels(keys)) return null;
    if (!opts.id) { S3.uncleIdx = (idx + 1) % 3; saveSoon(); }
    const car = ctx.car;
    const a = opts.ahead || 220;
    const spot = opts.spot || findSpot(car.s + a, car.s + a + 60, opts.side || 0, 10.6, 11.8, 2.2);
    if (!spot) return null;
    const p = spotWorld(spot);
    const grp = new THREE.Group();
    grp.position.set(p.x, 0, p.z);
    grp.rotation.y = facingRoad(p.h, Math.sign(spot.d));
    const him = spawnPerson(u.model);
    grp.add(him.obj);
    const crew = [];
    if (u.id === "yedidya") inHand(him, prop("cameos_props", "MilkJug"), "R", [0, -0.5, 0.06]);
    if (u.id === "burry") {
        // Mindy + the kids clustered to his left, VEGAS moving boxes to his right
        const mindy = spawnPerson("npcWoman", { colors: { Top: "#E91E63", Hair: "#4E342E", Bottom: "#37474F" } });
        mindy.obj.position.set(0.85, 0, 0.1); grp.add(mindy.obj); crew.push(mindy);
        [["#42A5F5", 0.55, 0.65], ["#FFB300", 1.35, 0.55], ["#66BB6A", 1.0, 0.95]].forEach(([c, x, z]) => {
            const kid = spawnPerson("npcKid", { colors: { Top: c }, scale: 0.8 });
            kid.obj.position.set(x, 0, z); grp.add(kid.obj); crew.push(kid);
        });
        const boxes = prop("cameos_props", "Boxes"); boxes.position.set(-1.0, 0, 0.2); boxes.rotation.y = 0.4; grp.add(boxes);
    }
    let cat = null;
    if (u.id === "shuey") {
        const av = spawnPerson("npcKid", { colors: { Top: "#80DEEA", Hair: "#9E9E9E" }, scale: 0.85 });
        av.obj.position.set(0.55, 0, 0.1); grp.add(av.obj); crew.push(av);
        cat = cloneWithColors(models.cameos_catAngel);
        cat.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.62; o.castShadow = false; } });
        cat.position.set(0, 2.15, 0); grp.add(cat);
    }
    ctx.scene.add(grp);
    const tag = bubble(`👨 ${u.name}`, { bg: "#ffffff", fg: "#2b1b2e", size: 0.75 });
    tag.position.set(0, 2.0, 0); tag.visible = false; him.obj.add(tag);
    let greeted = false, t = 0, quipT = 0;
    uncle = addActor({
        kind: "uncle", id: u.id,
        update(dt) {
            t += dt;
            const rs = relS(spot.s);
            const near = rs < 110 && rs > -25;
            him.face(ctx.car.pos.x, ctx.car.pos.z, dt, 2.5);
            him.update(dt, { wave: near && rs < 70, talk: greeted && quipT > 0 });
            crew.forEach((c, i) => c.update(dt, { wave: near && rs < 50 && i % 2 === 0, cheer: greeted && i === 1 }));
            if (cat) { cat.position.y = 2.15 + Math.sin(t * 1.7) * 0.12; cat.rotation.y = Math.sin(t * 0.8) * 0.4; }
            tag.visible = near; if (near) tag.tick(dt);
            quipT -= dt;
            if (!greeted && Math.abs(rs) < 8 && ctx.state === "playing") {
                greeted = true; quipT = 3.2;
                stat("uncles3", 1);                // weekly quest: greet an uncle
                tag.setText(pick(u.quips)); tag.userData.age = 0;
                addCoins(8, "uncle");              // a small friendly tip
                H.toast("👋 +8 💰", "gold");
                sfx.coin(); tone(660, 0.12, "sine", 0.2, 880);
                const wp = new THREE.Vector3(); him.obj.getWorldPosition(wp);
                ctx.car.fx.burst(wp.x, 1.8, wp.z, 14, 2.5, [1, 0.85, 0.3], 0.3, 0.8);
            }
            return rs > -100;
        },
        dispose() { ctx.scene.remove(grp); tag.dispose(); if (uncle === this) uncle = null; },
    });
    return uncle;
}
