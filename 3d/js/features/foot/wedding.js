// AVIGAIL'S WEDDING (state "footWedding") — the rare (10%; 25% once she and
// Lulu are real friends) on-foot surprise, as a 3D garden chuppah.
//
//   0 PROCESSION — white aisle, rows of guests, the klezmer fiddler; Avigail
//     walks down the aisle to nervous Aviel. ✕ = throw petals (+ hurry her).
//   1 CHUPPAH — she circles the chosson 7× (✕ helps her spin), then the glass:
//     ✕ = STOMP → shatter, MAZEL TOV!!!, confetti, the band.
//   2 SIMCHA — the hora (the couple lifted up on chairs), then the BOUQUET TOSS:
//     a timing press ("NOW — CATCH! 💐"). Caught = +40 💰 +1 ⭐, else +15 💰.
//   3 → back to walking. Every phase auto-advances, so it always ends.
import * as THREE from "three";
import { ctx, registerState, setState, css, emit } from "../../core/ctx.js";
import { models, registerModels, ensureModels, cloneWithColors, findNodes, instanced } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { makeSet } from "../../core/sets.js";
import { pause } from "../../core/screens.js";
import { glyph, rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as L from "./lines.js";
import { bubble, clearBubbles, showBubbles, updateBubbles, hasBubble } from "./bubbles.js";

const WED_MODELS = { foot_chuppah: "foot_chuppah", foot_chair: "foot_chair", foot_flowers: "foot_flowers", foot_bouquet: "foot_bouquet",
    foot_glass: "foot_glass", foot_fiddle: "foot_fiddle", foot_bride: "foot_bride", foot_aviel: "foot_aviel",
    foot_rabbi: "foot_rabbi", foot_fiddler: "foot_fiddler" };
registerModels(WED_MODELS);
const NEED = [...Object.keys(WED_MODELS), "npcWoman", "npcMan", "npcKid", "luluPerson"];

const FLOWER_COLS = ["#FF80AB", "#FF4081", "#FFD54F", "#BA68C8", "#FFF176", "#F8BBD0"];
const TOPS = ["#F48FB1", "#90CAF9", "#CE93D8", "#FFCC80", "#A5D6A7", "#FFFFFF", "#B39DDB", "#80DEEA", "#FFAB91", "#263238"];
const BOTTOMS = ["#37474F", "#283593", "#212121", "#4A148C", "#1B5E20", "#5D4037"];
const HAIRS = ["#4E342E", "#3E2723", "#1A1A1A", "#8D6E63", "#D7B56D", "#BDBDBD"];
const CHUPPAH_Z = -5.0, CENTER = new THREE.Vector3(0, 0.2, -4.6);

css("foot-wedding", `
#footWed { position: fixed; inset: 0; z-index: 7; pointer-events: auto; display: none; touch-action: none; }
#footWed.on { display: block; }
#footWed .ttl { position: absolute; top: max(12px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%);
  background: rgba(60, 20, 70, .85); border: 2px solid #FFD54F; color: #FFD54F; border-radius: 14px; padding: 6px 18px;
  font: 700 20px var(--font); white-space: nowrap; }
#footWed .ttl small { color: #FFE9F3; font-size: 14px; margin-left: 8px; }
#footWed .prm { position: absolute; left: 50%; bottom: max(24px, env(safe-area-inset-bottom)); transform: translateX(-50%); text-align: center;
  color: #fff; text-shadow: 0 2px 0 #5A1A66, 0 0 12px rgba(90, 26, 102, .7); font: 700 24px var(--font); white-space: nowrap; }
#footWed .prm.bob { animation: wedBob .9s ease-in-out infinite; }
#footWed .prm small { display: block; font-size: 15px; color: #FFF3C4; margin-top: 2px; }
#footWed .mazel { position: absolute; left: 50%; top: 34%; transform: translate(-50%, -50%); font: 700 64px var(--font); color: #FFD54F;
  text-shadow: 0 4px 0 #AD1457, 0 0 24px rgba(255, 64, 129, .6); white-space: nowrap; display: none; animation: wedPop .5s cubic-bezier(.2,1.6,.4,1); }
#footWed .gift { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); font: 700 28px var(--font); color: #FFD700;
  text-shadow: 0 2px 0 rgba(0,0,0,.4); display: none; }
#footWed .pz { position: absolute; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); width: 48px; height: 48px;
  border-radius: 50%; border: none; background: rgba(255,255,255,.85); font: 700 16px var(--font); }
#footWed .fade { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; transition: opacity .35s; }
@keyframes wedBob { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -6px); } }
@keyframes wedPop { from { transform: translate(-50%, -50%) scale(.4); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
body.tv #footWed .ttl { font-size: 32px; } body.tv #footWed .prm { font-size: 36px; } body.tv #footWed .mazel { font-size: 110px; }
@media (max-width: 600px) { #footWed .ttl { font-size: 16px; } #footWed .prm { font-size: 19px; white-space: normal; width: 92vw; } #footWed .mazel { font-size: 44px; } }
`);
const ui = document.createElement("div");
ui.id = "footWed";
ui.innerHTML = `<div class="ttl">💍 AVIGAIL'S WEDDING!<small></small></div><div class="gift"></div><div class="mazel">MAZEL TOV!!!</div>
    <div class="prm bob"></div><button class="pz" aria-label="Pause">❚❚</button><div class="fade"></div>`;
document.body.appendChild(ui);
let tapFlag = false;
ui.addEventListener("pointerdown", e => { if (e.target.classList.contains("pz")) return; e.preventDefault(); tapFlag = true; A.unlockAudio(); });
ui.querySelector(".pz").addEventListener("click", () => pause());
const $ = sel => ui.querySelector(sel);

let W = null;

/** Called by the foot feature. opts: { rel, luluKey, luluColors, onReward(caught) → coins, onDone() } */
export async function startWedding(opts) {
    try { await ensureModels(NEED); }
    catch (e) { console.error("[foot] wedding models", e); opts.onDone && opts.onDone(); return; }
    setState("footWedding", opts);
}

// ── a tiny confetti / petal / glass-shard particle system for the set ───
class Confetti {
    constructor(set, max = 320) {
        const geo = set.own(new THREE.PlaneGeometry(0.07, 0.045));
        const mat = set.own(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }));
        this.mesh = new THREE.InstancedMesh(geo, mat, max);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        this.max = max;
        this.p = [];
        const c = new THREE.Color("#ffffff");
        for (let i = 0; i < max; i++) { this.mesh.setColorAt(i, c); this.p.push({ life: 0 }); }
        this.n = 0;
        this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
        set.add(this.mesh);
        this.update(0);
    }
    burst(x, y, z, n, cols, up = 4, spread = 2.4, size = 1) {
        const c = new THREE.Color();
        for (let k = 0; k < n; k++) {
            const i = this.n = (this.n + 1) % this.max;
            const P = this.p[i];
            Object.assign(P, { x: x + (Math.random() - 0.5) * 0.4, y, z: z + (Math.random() - 0.5) * 0.4,
                vx: (Math.random() - 0.5) * spread, vy: up * (0.5 + Math.random() * 0.7), vz: (Math.random() - 0.5) * spread,
                rx: Math.random() * 6, ry: Math.random() * 6, sp: 4 + Math.random() * 8, life: 1.6 + Math.random() * 1.2, size: size * (0.7 + Math.random() * 0.6) });
            this.mesh.setColorAt(i, c.set(cols[Math.floor(Math.random() * cols.length)]));
        }
        this.mesh.instanceColor.needsUpdate = true;
    }
    update(dt) {
        for (let i = 0; i < this.max; i++) {
            const P = this.p[i];
            if (P.life > 0) {
                P.life -= dt;
                P.vy -= 4.5 * dt; P.vx *= Math.exp(-1.2 * dt); P.vz *= Math.exp(-1.2 * dt);
                if (P.vy < -1.2) P.vy = -1.2;   // paper flutters down
                P.x += P.vx * dt; P.y += P.vy * dt; P.z += P.vz * dt;
                if (P.y < 0.03) { P.y = 0.03; P.vx = P.vz = 0; P.vy = 0; }
                P.rx += P.sp * dt; P.ry += P.sp * 0.7 * dt;
                this.e.set(P.rx, P.ry, 0);
                this.q.setFromEuler(this.e);
                const s = P.life > 0 ? P.size * Math.min(1, P.life * 2) : 0;
                this.m.compose(this.v.set(P.x, P.y, P.z), this.q, this.s.set(s, s, s));
            } else this.m.makeScale(0, 0, 0);
            this.mesh.setMatrixAt(i, this.m);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }
}

function guestColors() {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    return { Top: pick(TOPS), Bottom: pick(BOTTOMS), Hair: pick(HAIRS) };
}

function build(opts) {
    const set = makeSet({ light: "day", sky: "#FFE3B6", ground: "#8CCB6A", fog: [45, 140] });
    set.sun.color.set("#FFE2BD");
    set.sun.intensity = 2.5;
    set.sun.position.set(-9, 15, 9);
    set.hemi.color.set("#FFF1DC");
    set.hemi.intensity = 1.25;
    const w = { set, opts, guests: [], chairs: [], flowers: [] };

    // the aisle runner with petals scattered on it
    const runner = new THREE.Mesh(set.own(new THREE.PlaneGeometry(1.6, 15)), set.own(new THREE.MeshStandardMaterial({ color: "#FFFDF8", roughness: 0.9 })));
    runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.012, 2.2); runner.receiveShadow = true;
    set.add(runner);
    const petals = new THREE.InstancedMesh(set.own(new THREE.CircleGeometry(0.04, 6)), set.own(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 })), 140);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    for (let i = 0; i < 140; i++) {
        e.set(-Math.PI / 2, 0, Math.random() * 6); q.setFromEuler(e);
        m4.compose(v.set((Math.random() - 0.5) * 1.5, 0.016, -4 + Math.random() * 13), q, sc);
        petals.setMatrixAt(i, m4);
        petals.setColorAt(i, col.set(FLOWER_COLS[i % FLOWER_COLS.length]));
    }
    set.add(petals);
    // a hedge backdrop + a few trees round the garden
    const hedgeMat = set.own(new THREE.MeshStandardMaterial({ color: "#3E8E4A", roughness: 0.9 }));
    const hedge = new THREE.Mesh(set.own(new THREE.BoxGeometry(26, 2.2, 1.2)), hedgeMat);
    hedge.position.set(0, 1.1, -9.5); hedge.castShadow = hedge.receiveShadow = true;
    set.add(hedge);
    for (const sx of [-1, 1]) {
        const side = new THREE.Mesh(set.own(new THREE.BoxGeometry(1.2, 1.6, 22)), hedgeMat);
        side.position.set(sx * 9, 0.8, 1.5); side.castShadow = side.receiveShadow = true;
        set.add(side);
    }
    for (const [x, z, s] of [[-7, -8, 1.5], [7.5, -7.5, 1.7], [-8, 7, 1.3], [8.2, 6, 1.4], [-5, -9.5, 1.2], [5, -9.6, 1.25]]) {
        const t = (models.treeRound || models.treePine).clone(true);
        t.position.set(x, 0, z); t.scale.setScalar(s);
        set.add(t);
    }
    // string lights over the aisle
    const bulbMat = set.own(new THREE.MeshBasicMaterial({ color: "#FFF1B0", toneMapped: false }));
    const bulbGeo = set.own(new THREE.SphereGeometry(0.06, 8, 6));
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, 60);
    for (let i = 0; i < 60; i++) {
        const k = i % 20, row = Math.floor(i / 20);
        const z = 8 - k * 0.7, x = [-2.5, 0, 2.5][row];
        m4.makeTranslation(x, 3.4 - Math.sin((k / 19) * Math.PI) * 0.35, z);
        bulbs.setMatrixAt(i, m4);
    }
    set.add(bulbs);

    // the chuppah + flower stands down the aisle
    const ch = models.foot_chuppah.clone(true);
    ch.position.set(0, 0, CHUPPAH_Z);
    set.add(ch);
    const fl = instanced(models.foot_flowers, 8);
    let fi = 0;
    for (const z of [5.4, 2.6, -0.2, -2.8]) for (const sx of [-1, 1]) { m4.makeTranslation(sx * 0.95, 0, z); fl.set(fi++, m4); }
    fl.finish(); set.add(fl.group);
    w.flowerInst = fl;

    // chairs (instanced) + seated guests
    const seats = [];
    for (const z of [4.8, 3.4, 2.0, 0.6, -0.8]) for (const sx of [-1, 1]) for (const x of [1.35, 2.05, 2.75, 3.45]) seats.push({ x: sx * x, z, side: sx });
    const chairs = instanced(models.foot_chair, seats.length);
    seats.forEach((st, i) => {
        q.setFromAxisAngle(v.set(0, 1, 0), Math.PI);
        m4.compose(v.set(st.x, 0, st.z), q, sc);
        chairs.set(i, m4);
    });
    chairs.finish(); set.add(chairs.group);
    w.chairInst = chairs;
    // 16 guests; the front-left aisle seat stays free (that's Lulu's spot)
    const order = seats.map((s, i) => i).filter(i => !(seats[i].x === -1.35 && seats[i].z === 2.0));
    for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    const keys = ["npcWoman", "npcMan", "npcWoman", "npcMan", "npcKid"];
    for (let i = 0; i < 16; i++) {
        const st = seats[order[i]];
        const g = spawnPerson(keys[i % keys.length], { colors: guestColors() });
        g.obj.position.set(st.x, 0.02, st.z + 0.05);
        g.obj.rotation.y = Math.PI + st.side * 0.15;
        g.seat = st;
        g.ph = Math.random() * 6;
        g.dab = Math.random() < 0.4;
        set.add(g.obj);
        w.guests.push(g);
    }

    // the cast
    w.lulu = spawnPerson(opts.luluKey && models[opts.luluKey] ? opts.luluKey : "luluPerson", { colors: opts.luluColors || null });
    w.lulu.obj.position.set(-1.2, 0.02, 2.15);
    w.lulu.obj.rotation.y = Math.PI / 2;
    set.add(w.lulu.obj);
    w.bride = spawnPerson("foot_bride");
    w.bride.obj.position.set(0, 0.02, 10);
    w.bride.obj.rotation.y = Math.PI;
    set.add(w.bride.obj);
    w.aviel = spawnPerson("foot_aviel");
    w.aviel.obj.position.copy(CENTER).setX(0.45);
    w.aviel.obj.rotation.y = 0;
    set.add(w.aviel.obj);
    w.rabbi = spawnPerson("foot_rabbi");
    w.rabbi.obj.position.set(0, 0.2, CHUPPAH_Z - 0.95);
    set.add(w.rabbi.obj);
    w.fiddler = spawnPerson("foot_fiddler");
    w.fiddler.obj.position.set(3.4, 0.02, -3.6);
    w.fiddler.obj.rotation.y = -2.3;
    set.add(w.fiddler.obj);
    const fid = models.foot_fiddle.clone(true);
    fid.position.set(0.12, 1.3, 0.16);
    fid.rotation.set(0.3, 0.9, -0.5);
    w.fiddler.obj.add(fid);
    w.glass = models.foot_glass.clone(true);
    w.glass.position.set(0.45, 0.22, CENTER.z - 0.55);
    set.add(w.glass);
    w.bouquet = models.foot_bouquet.clone(true);
    w.bouquet.scale.setScalar(1.3);
    const handR = w.bride.limbs.Arm_R;
    if (handR) { w.bouquet.position.set(0, -0.46, 0.08); w.bouquet.rotation.x = 0.4; handR.add(w.bouquet); }
    w.liftChairs = [];
    for (let i = 0; i < 2; i++) { const c = models.foot_chair.clone(true); c.visible = false; set.add(c); w.liftChairs.push(c); }
    w.fx = new Confetti(set);
    // camera
    w.cam = { pos: new THREE.Vector3(7.5, 4.2, 13), look: new THREE.Vector3(0, 1.2, -2) };
    set.camera.position.copy(w.cam.pos);
    set.camera.lookAt(w.cam.look);
    return w;
}

function say(person, pool, key, secs = 2.6, cls = "") {
    if (!W) return;
    bubble(person.obj, L.pickFrom(pool, W.last, key), secs, { cls, y: person.sitting ? 1.65 : 2.05 });
}
function anyBubble() { return W && [W.bride, W.aviel, W.lulu, ...W.guests].some(p => hasBubble(p.obj)); }
function randGuest() { return W.guests[Math.floor(Math.random() * W.guests.length)]; }

function setPrompt(main, sub, bob = true) {
    const html = main ? `${main}${sub ? `<small>${sub}</small>` : ""}` : "";
    if (W.prm !== html) { W.prm = html; $(".prm").innerHTML = html; $(".prm").classList.toggle("bob", bob); }
}

registerState("footWedding", {
    hud: false, touch: false, pausable: true, world: false, driving: false,
    enter(opts = {}) {
        W = build(opts);
        W.phase = 0; W.t = 0; W.phaseT = 0; W.last = {}; W.prog = 0; W.circles = 0; W.ang = 0;
        W.stomped = false; W.glassT = 0; W.horaT = 0; W.tossed = false; W.bq = null; W.caught = null; W.yelled = false;
        W.exitT = 0; W.leaving = false; W.reward = false;
        W.set.show();
        ui.classList.add("on");
        $(".mazel").style.display = "none"; $(".gift").style.display = "none";
        $(".ttl small").textContent = (opts.rel || 0) >= 65 ? "(bestie seating 💜)" : "";
        W.prm = null;
        tapFlag = false;
        clearBubbles();
        showBubbles(true);
        A.setMusic("../wedding.mp3");
        A.sfxCloseCall(1); setTimeout(() => A.sfxCloseCall(5), 120);
        emit("stat", { id: "weddings", n: 1 });
        say(W.lulu, L.WED_LULU, "lulu", 3.2);
    },
    exit() {
        ui.classList.remove("on");
        clearBubbles();
        showBubbles(false);
        if (W) { W.flowerInst.dispose(); W.chairInst.dispose(); W.set.dispose(); }
        W = null;
    },
    update(dt, P) {
        if (!W) return;
        W.t += dt; W.phaseT += dt;
        const tapped = !!(P.confirm || P.interact || tapFlag);
        tapFlag = false;
        if (W.phase === 0) procession(dt, tapped);
        else if (W.phase === 1) chuppah(dt, tapped);
        else if (W.phase === 2) simcha(dt, tapped);
        else done(dt, tapped);
        if (!W) return;
        animateCrowd(dt);
        W.fx.update(dt);
        updateCamera(dt);
        showBubbles(!ctx.paused);
        updateBubbles(dt, W.set.camera);
    },
});

function goto(phase) { W.phase = phase; W.phaseT = 0; }

// PHASE 0 — the procession
function procession(dt, tapped) {
    const b = W.bride;
    W.prog = Math.min(1, W.prog + 0.085 * dt + (tapped ? 0.06 : 0));
    const z = 10 + (CENTER.z + 0.75 - 10) * W.prog;
    b.obj.position.set(0, z < -3.4 ? 0.2 : 0.02, z);
    b.update(dt, { walk: W.prog < 1 ? 0.9 + (tapped ? 1 : 0) : 0 });
    if (tapped) throwPetals();
    if (!anyBubble() && Math.random() < dt * 0.7) {
        const r = Math.random();
        if (r < 0.4) say(b, L.WED_BRIDE, "bride");
        else if (r < 0.7) say(W.aviel, L.WED_CHOSSON, "chosson");
        else say(randGuest(), L.WED_GUEST, "guest", 2.6, "");
    }
    setPrompt(`💐 ${glyph("confirm")} to throw petals!`, "Here comes the kallah...");
    if ((W.prog >= 1 && W.phaseT > 1.2) || W.phaseT > 16) { goto(1); W.ang = 0; }
}
function throwPetals() {
    const b = W.bride.obj.position;
    W.fx.burst(b.x + (Math.random() - 0.5) * 0.6, 2.4, b.z - 0.6, 16, FLOWER_COLS, 2.2, 2.2, 1.1);
    W.lulu.waveT = 0.5;
    if (!W.petalCool || W.t > W.petalCool) { W.petalCool = W.t + 0.25; A.sfxCloseCall(7); }
    if (Math.random() < 0.6) say(W.lulu, L.WED_LULU, "lulu", 2.0);
    else say(randGuest(), L.WED_GUEST, "guest", 2.0);
}

// PHASE 1 — the chuppah: 7 circles, then stomp the glass
function chuppah(dt, tapped) {
    const b = W.bride, av = W.aviel;
    if (W.circles < 7) {
        W.ang += (1.5 + (tapped ? 9 : 0)) * dt;
        if (W.ang >= Math.PI * 2) {
            W.ang -= Math.PI * 2;
            W.circles++;
            A.sfxCloseCall(W.circles);
            rumble(0.1, 0.3, 90);
            bubble(b.obj, L.WED_CIRCLE[Math.min(W.circles - 1, 6)], 1.8);
        }
        const a = W.ang;
        b.obj.position.set(CENTER.x + Math.sin(a) * 0.95, 0.2, CENTER.z + Math.cos(a) * 0.95);
        b.obj.rotation.y = a + Math.PI / 2;
        b.update(dt, { walk: 1.1 });
        av.face(b.obj.position.x, b.obj.position.z, dt, 3);
        av.update(dt, { talk: true });
        if (W.phaseT > 11) W.circles = 7;
        setPrompt(`Circling the chosson... (${W.circles}/7)`, `${glyph("confirm")} to help her spin`, false);
        if (W.circles >= 7) { W.glassT = 0; b.obj.position.set(CENTER.x - 0.5, 0.2, CENTER.z); }
        return;
    }
    b.face(av.obj.position.x, av.obj.position.z, dt, 4);
    b.update(dt, { talk: false });
    av.face(W.glass.position.x, W.glass.position.z - 2, dt, 4);
    if (!W.stomped) {
        W.glassT += dt;
        // anticipation: Aviel's foot hovers over the glass
        av.update(dt, {});
        const leg = av.limbs.Leg_R;
        if (leg) leg.quaternion.copy(leg.userData.base).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9 - Math.sin(W.t * 8) * 0.15, 0, 0)));
        W.glass.rotation.z = Math.sin(W.t * 18) * 0.08;
        if (!anyBubble() && Math.random() < dt * 0.8) say(av, L.WED_CHOSSON, "chosson", 2.2);
        setPrompt(`🦶 ${glyph("confirm")} STOMP THE GLASS!`, "...everyone's waiting...");
        if (tapped || W.glassT > 9) stomp();
        return;
    }
    av.update(dt, { cheer: true });
    setPrompt(`🎉 MAZEL TOV! 🎉`, "", false);
    if (W.phaseT > 2.6) startHora();
}
function stomp() {
    W.stomped = true;
    W.phaseT = 0;
    W.glass.visible = false;
    const g = W.glass.position;
    W.fx.burst(g.x, 0.35, g.z, 22, ["#B3E5FC", "#E1F5FE", "#90CAF9", "#FFFFFF"], 2.6, 3.2, 0.7);
    W.fx.burst(CENTER.x, 3.0, CENTER.z, 70, ["#FF4081", "#FFD54F", "#7E57C2", "#4FC3F7", "#FFFFFF"], 3.0, 5.0, 1.2);
    A.sfxCrash(0.35);
    setTimeout(() => A.sfxFanfare(), 160);
    rumble(0.9, 0.9, 360, true);
    const mz = $(".mazel");
    mz.style.display = "block"; mz.style.animation = "none"; void mz.offsetWidth; mz.style.animation = "";
    setTimeout(() => { if (W) mz.style.display = "none"; }, 2400);
    bubble(W.bride.obj, "MAZEL TOV!!!", 2.4, { cls: "big" });
    for (const gu of W.guests) gu.cheerT = 2.2 + Math.random();
}

// PHASE 2 — the simcha: hora, then the bouquet
function startHora() {
    goto(2);
    const fade = $(".fade");
    fade.style.opacity = "1";
    setTimeout(() => {
        if (!W) return;
        // the chairs are cleared away; everyone forms a big ring on the lawn
        W.chairInst.group.visible = false;
        W.flowerInst.group.visible = false;
        W.hora = true;
        const n = W.guests.length;
        W.guests.forEach((g, i) => {
            g.lifter = i < 4; g.sitting = false;
            g.liftIdx = i < 2 ? 0 : 1;
            g.ringA = g.lifter ? (i % 2) * Math.PI : ((i - 4) / (n - 4)) * Math.PI * 2;
            g.ring = 3.4;
        });
        for (let i = 0; i < 2; i++) W.liftChairs[i].visible = true;
        W.lulu.obj.position.set(-2.2, 0.02, 7.2);
        W.glass.visible = false;
        fade.style.opacity = "0";
    }, 380);
}
const HORA = new THREE.Vector3(0, 0, 1.6);
function simcha(dt, tapped) {
    W.horaT += dt;
    if (!W.tossed && W.phaseT > 3.2) {
        W.tossed = true;
        W.bq = { t: 0 };
        // the bouquet leaves her hand and flies on its own
        const wp = new THREE.Vector3();
        W.bouquet.getWorldPosition(wp);
        W.bouquet.parent.remove(W.bouquet);
        W.bouquet.position.copy(wp);
        W.set.add(W.bouquet);
        W.bq.from = wp.clone();
        A.sfxCloseCall(6);
        bubble(W.bride.obj, "Here it comes…!", 0.9, { y: 2.0 });
    }
    if (!W.tossed && !anyBubble() && Math.random() < dt * 0.6) say(randGuest(), L.WED_GUEST, "guest", 2.0);
    if (W.bq && W.caught === null) {
        const bq = W.bq;
        bq.t += dt / 1.5;
        const to = W.lulu.obj.position;
        const k = Math.min(1, bq.t);
        W.bouquet.position.set(bq.from.x + (to.x + 0.1 - bq.from.x) * k, bq.from.y + (1.55 - bq.from.y) * k + Math.sin(k * Math.PI) * 3.2, bq.from.z + (to.z - 0.3 - bq.from.z) * k);
        W.bouquet.rotation.x += dt * 9; W.bouquet.rotation.z += dt * 4;
        const near = bq.t > 0.62;
        if (near && !W.yelled) { W.yelled = true; bubble(W.lulu.obj, "NOW — CATCH! 💐", 0.8); A.sfxCloseCall(9); }
        setPrompt(near ? `CATCH!! 💐 ${glyph("confirm")}` : "Here it comes…! 💐", near ? "press NOW!" : "wait for it… press when it's close!");
        if (tapped) catchBouquet(near);
        else if (bq.t >= 1) catchBouquet(false);
    } else if (W.caught !== null) {
        if (!W.caught && W.bouquet.position.y > 0.08) { W.bqv = (W.bqv || 0) - 9 * dt; W.bouquet.position.y = Math.max(0.08, W.bouquet.position.y + W.bqv * dt); W.bouquet.position.x += dt * 1.2; }
        setPrompt(W.caught ? "🎉 You're NEXT, Lulu!" : "Aw, so close! 💐", "", false);
        if (W.phaseT > 2.4 || (tapped && W.phaseT > 0.6)) goto(3);
    } else setPrompt("💃 HORA! 🕺", "the band's going wild", false);
    if (W.phaseT > 14 && W.phase === 2) { if (W.caught === null) catchBouquet(false); goto(3); }
}
function catchBouquet(caught) {
    W.caught = caught;
    W.phaseT = 0;
    if (caught) {
        const hand = W.lulu.limbs.Arm_R;
        W.set.scene.remove(W.bouquet);
        if (hand) { W.bouquet.position.set(0, -0.46, 0.08); W.bouquet.rotation.set(0.4, 0, 0); hand.add(W.bouquet); }
        W.fx.burst(W.lulu.obj.position.x, 1.8, W.lulu.obj.position.z, 30, FLOWER_COLS, 3, 3, 1.1);
        A.sfxCoin(4);
        rumble(0.4, 0.7, 260, true);
        bubble(W.lulu.obj, L.pickFrom(L.WED_BOUQUET_WIN, W.last, "bqwin"), 2.4);
        W.luluCheer = 2.5;
    } else {
        A.sfxBump();
        bubble(W.lulu.obj, L.pickFrom(L.WED_BOUQUET_MISS, W.last, "bqmiss"), 2.4);
    }
    giveReward(caught);
}
function giveReward(caught) {
    if (W.reward) return;
    W.reward = true;
    const n = W.opts.onReward ? W.opts.onReward(caught) : (caught ? 40 : 15);
    const gift = $(".gift");
    gift.textContent = `+${n} 💰${caught ? "  +1⭐" : ""}`;
    gift.style.display = "block";
}

// PHASE 3 — out we go
function done(dt, tapped) {
    W.exitT += dt;
    setPrompt("🎉 Mazel tov, Avigail! 🎉", "", false);
    if (!W.leaving && (W.exitT > 1.6 || (tapped && W.exitT > 0.4))) {
        W.leaving = true;
        A.sfxCloseCall(5);
        const cb = W.opts.onDone;
        cb && cb();
    }
}

// ── everybody moving ────────────────────────────────────────────────────
function animateCrowd(dt) {
    const t = W.t;
    for (const g of W.guests) {
        if (g.cheerT > 0) g.cheerT -= dt;
        if (!W.hora) {
            g.sitting = true;
            if (W.phase === 0) g.face(W.bride.obj.position.x, W.bride.obj.position.z, dt, 1.5);
            const kv = Math.sin(t * 1.3 + g.ph);
            g.update(dt, { sit: true, talk: kv > 0.7, cheer: g.cheerT > 0, wave: g.dab && kv < -0.85 });
        } else {
            g.ringA += dt * (g.lifter ? 0.0 : 0.55);
            const c = g.lifter ? W.liftChairs[g.liftIdx].position : HORA;
            const r = g.ring;
            const x = (g.lifter ? c.x : HORA.x) + Math.sin(g.ringA) * (g.lifter ? 0.75 : r);
            const z = (g.lifter ? c.z : HORA.z) + Math.cos(g.ringA) * (g.lifter ? 0.75 : r);
            g.obj.position.x += (x - g.obj.position.x) * Math.min(1, dt * 4);
            g.obj.position.z += (z - g.obj.position.z) * Math.min(1, dt * 4);
            g.obj.position.y = 0.02 + Math.abs(Math.sin(t * 7 + g.ph)) * 0.12;
            g.obj.rotation.y = g.ringA + Math.PI / 2;
            g.update(dt, g.lifter ? { cheer: true } : { dance: true, walk: 1.2 });
        }
    }
    // the couple: walking / standing, then up on the chairs for the hora
    if (W.hora) {
        const bob = (i) => 1.25 + Math.abs(Math.sin(t * 5 + i)) * 0.35;
        const pos = [new THREE.Vector3(HORA.x - 0.85, bob(0), HORA.z), new THREE.Vector3(HORA.x + 0.85, bob(1.3), HORA.z)];
        W.liftChairs.forEach((c, i) => { c.position.copy(pos[i]); c.rotation.set(Math.sin(t * 3 + i) * 0.12, i ? -Math.PI / 2 : Math.PI / 2, Math.sin(t * 4 + i) * 0.1); });
        for (const [p, i] of [[W.bride, 0], [W.aviel, 1]]) {
            p.obj.position.set(pos[i].x, pos[i].y + 0.02, pos[i].z);
            p.obj.rotation.y = i ? -Math.PI / 2 : Math.PI / 2;
            p.obj.rotation.z = Math.sin(t * 4 + i) * 0.1;
            p.update(dt, { sit: true, cheer: true });
        }
        W.lulu.face(HORA.x, HORA.z, dt, 4);
        W.lulu.update(dt, { cheer: W.luluCheer > 0 || W.caught === null && !W.tossed, dance: !W.tossed && Math.sin(t) > 0, wave: W.tossed && W.caught === null });
        if (W.luluCheer > 0) W.luluCheer -= dt;
        if (Math.random() < dt * 3) W.fx.burst(HORA.x + (Math.random() - 0.5) * 6, 3.4, HORA.z + (Math.random() - 0.5) * 6, 3, FLOWER_COLS, 0.5, 1.2, 1);
    } else {
        W.lulu.face(W.phase === 0 ? W.bride.obj.position.x : CENTER.x, W.phase === 0 ? W.bride.obj.position.z : CENTER.z, dt, 3);
        if (W.lulu.waveT > 0) W.lulu.waveT -= dt;
        W.lulu.update(dt, { wave: W.lulu.waveT > 0, cheer: W.stomped && W.phase === 1, talk: hasBubble(W.lulu.obj) });
        if (W.phase === 0) W.aviel.update(dt, { talk: hasBubble(W.aviel.obj) });
    }
    W.rabbi.update(dt, { talk: W.phase === 1 && !W.stomped, cheer: W.stomped && W.phase === 1 });
    // the klezmer fiddler sways and saws away
    const f = W.fiddler;
    f.update(dt, { talk: true });
    f.obj.rotation.z = Math.sin(t * 3) * 0.06;
    const ar = f.limbs.Arm_R, al = f.limbs.Arm_L;
    if (ar) ar.quaternion.copy(ar.userData.base).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.25 + Math.sin(t * 9) * 0.3, 0, -0.5)));
    if (al) al.quaternion.copy(al.userData.base).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.6, 0, 0.75)));
}

// ── the camera ──────────────────────────────────────────────────────────
const _from = new THREE.Vector3(), _look = new THREE.Vector3();
function updateCamera(dt) {
    const cam = W.set.camera, b = W.bride.obj.position;
    const portrait = cam.aspect < 1;
    if (W.phase === 0) {
        // start wide over the guests, then a front shot of the kallah coming down the aisle
        const k = Math.min(1, W.phaseT / 3);
        _from.set(4.8 * (1 - k) + 1.6 * k, 3.6 * (1 - k) + 1.9 * k, 12 * (1 - k) + (b.z - 4.4) * k);
        if (k >= 1) _from.set(1.6, 1.9, Math.max(CENTER.z + 1.5, b.z - 4.4));
        _look.set(0, 1.25, b.z);
    } else if (W.phase === 1 && !W.stomped && W.circles >= 7) {
        _from.set(2.3, 1.05, CENTER.z + 1.6);
        _look.set(0.45, 0.45, W.glass.position.z);
    } else if (W.phase === 1) {
        _from.set(3.4, 2.5, CENTER.z + 3.4);
        _look.set(0, 1.15, CENTER.z - 0.2);
    } else if (W.phase === 2 && W.tossed) {
        const lp = W.lulu.obj.position;
        _from.set(lp.x - 1.4, 2.5, lp.z + 4.2);
        _look.set(HORA.x * 0.4 + lp.x * 0.6, 1.8, HORA.z * 0.6 + lp.z * 0.4 - 1);
    } else if (W.phase >= 2) {
        const a = W.t * 0.25;
        _from.set(HORA.x + Math.sin(a) * 8.5, 3.6, HORA.z + Math.cos(a) * 8.5);
        _look.set(HORA.x, 1.4, HORA.z);
    }
    if (portrait) _from.lerp(_look, -0.35);
    W.cam.pos.lerp(_from, Math.min(1, dt * 2.2));
    W.cam.look.lerp(_look, Math.min(1, dt * 3));
    cam.position.copy(W.cam.pos);
    cam.lookAt(W.cam.look);
    const fov = portrait ? 70 : 52;
    if (Math.abs(cam.fov - fov) > 0.1) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
}

/** Test hook: how the scene is going. */
export function weddingState() {
    if (!W) return null;
    return { phase: W.phase, circles: W.circles, stomped: W.stomped, tossed: W.tossed, caught: W.caught, prog: W.prog, bq: W.bq ? W.bq.t : 0 };
}
