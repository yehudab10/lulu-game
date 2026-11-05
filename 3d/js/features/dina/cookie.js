// Cookie Catch (2D: cookieCatch) as a 3D kitchen minigame. Dina slides her
// big pink plate left / right to catch falling treats; Mom's burnt cookie (💣)
// costs a heart. 30 s round, 💰10 to play, combos ×(1 + ⌊combo/3⌋).
//
// The game runs in the 2D game's own units (a 480 × 854 field, px/s speeds)
// so the timing and difficulty match exactly; it's only DRAWN in 3D.
import * as THREE from "three";
import { ctx, registerState, setState, emit } from "../../core/ctx.js";
import { shared, wallet } from "../../core/save.js";
import { makeSet } from "../../core/sets.js";
import { spawnPerson } from "../../core/people.js";
import { input, rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import {
    L, floater, updateFloaters, sfx, rand, rnd, clamp, g, isTouch, prop, holdPose, models, canvasTexture, Fx,
    bindPointer, unbindPointer, pointerPlane,
} from "./common.js";
import { cloneWithColors } from "../../models.js";

export const COOKIE_DURATION = 30, COOKIE_FEE = 10;
const W = 480, Hh = 854, PLATE_Y = Hh - 120, PLATE_W = 78;
// falling kinds — weight controls how often each appears (2D COOKIE_KINDS)
export const COOKIE_KINDS = [
    { type: "cookie", model: "Cookie", emoji: "🍪", points: 1, weight: 42, good: true },
    { type: "choc", model: "Choc", emoji: "🍫", points: 2, weight: 18, good: true },
    { type: "donut", model: "Donut", emoji: "🍩", points: 3, weight: 11, good: true },
    { type: "cupcake", model: "Cupcake", emoji: "🧁", points: 5, weight: 6, good: true },
    { type: "milk", model: "Milk", emoji: "🥛", points: 2, weight: 7, good: true },
    { type: "bomb", model: "Bomb", emoji: "💣", points: 0, weight: 22, good: false },
];
function pickKind() {
    let total = 0;
    for (const k of COOKIE_KINDS) total += k.weight;
    let r = rand(0, total);
    for (const k of COOKIE_KINDS) { r -= k.weight; if (r <= 0) return k; }
    return COOKIE_KINDS[0];
}

export const CK = { active: false };
const K = { set: null };
const _v = new THREE.Vector3();
const PLATE_Y3 = 0.86;
let SX = 0.0125, SY = 3.4 / 754;
const to3 = (x, y, out = _v) => out.set((x - 240) * SX, PLATE_Y3 + (PLATE_Y - y) * SY, 0.34);

function buildKitchen() {
    const set = makeSet({ light: "indoor", sky: "#FFF7E8" });
    const own = (...a) => set.own(...a);
    const sc = set.scene;
    const mat = o => own(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9 }, o)));
    set.sun.position.set(-4, 9, 6);
    Object.assign(set.sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    // warm wall + a white-tile backsplash, checkered floor (2D #F4D9B0 / #EBC998)
    const wallTex = own(canvasTexture(64, 256, (x, w, h) => {
        const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#FFF7E8"); gr.addColorStop(1, "#F3E2C2");
        x.fillStyle = gr; x.fillRect(0, 0, w, h);
    }));
    const wall = new THREE.Mesh(own(new THREE.PlaneGeometry(22, 9)), mat({ map: wallTex }));
    wall.position.set(0, 4.5, -2.9); sc.add(wall);
    const tileTex = own(canvasTexture(128, 64, (x, w, h) => {
        x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, w, h);
        x.strokeStyle = "#E0D6C8"; x.lineWidth = 3;
        for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, h); x.stroke(); }
        for (let j = 0; j <= 2; j++) { x.beginPath(); x.moveTo(0, j * 32); x.lineTo(w, j * 32); x.stroke(); }
    }));
    tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(8, 2);
    const tiles = new THREE.Mesh(own(new THREE.PlaneGeometry(8, 0.9)), mat({ map: tileTex, roughness: 0.4 }));
    tiles.position.set(-1.1, 1.42, -2.88); sc.add(tiles);
    const floorTex = own(canvasTexture(128, 128, (x, w, h) => {
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? "#EBC998" : "#F4D9B0"; x.fillRect(i * 64, j * 64, 64, 64); }
    }));
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(11, 5);
    const floor = new THREE.Mesh(own(new THREE.PlaneGeometry(22, 10)), mat({ map: floorTex, roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 2); floor.receiveShadow = true; sc.add(floor);
    const kitchen = cloneWithColors(models.dinaKitchen);
    kitchen.position.set(0, 0, -2.55); sc.add(kitchen);
    // the sunny window over the sink + a warm sunbeam
    const view = own(canvasTexture(256, 200, (x, w, h) => {
        const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#BFE3FF"); gr.addColorStop(1, "#E8F6FF");
        x.fillStyle = gr; x.fillRect(0, 0, w, h);
        x.fillStyle = "#FFE08A"; x.beginPath(); x.arc(w * 0.74, 48, 22, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#A5D6A7"; x.beginPath(); x.ellipse(w * 0.4, h + 10, w * 0.62, 50, 0, 0, Math.PI * 2); x.fill();
    }));
    const win = new THREE.Mesh(own(new THREE.PlaneGeometry(1.1, 0.86)), own(new THREE.MeshBasicMaterial({ map: view })));
    win.position.set(-0.76, 2.25, -2.87); sc.add(win);
    const frameMat = mat({ color: "#FFFFFF", roughness: 0.5 });
    for (const [w2, h2, x, y] of [[1.24, 0.08, 0, 0.47], [1.24, 0.08, 0, -0.47], [0.08, 1.0, -0.6, 0], [0.08, 1.0, 0.6, 0], [0.05, 0.86, 0, 0], [1.1, 0.05, 0, 0]]) {
        const f = new THREE.Mesh(own(new THREE.BoxGeometry(w2, h2, 0.06)), frameMat);
        f.position.set(-0.76 + x, 2.25 + y, -2.85); sc.add(f);
    }
    const beam = new THREE.Mesh(own(new THREE.PlaneGeometry(1.6, 5.2)), own(new THREE.MeshBasicMaterial({ color: "#FFE082", transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })));
    beam.position.set(0.1, 1.4, -1.0); beam.rotation.set(-0.85, 0, -0.25); sc.add(beam);
    // Dina + her plate
    const dina = spawnPerson("dinaPerson");
    sc.add(dina.obj);
    const plate = prop("dinaTreats", "Plate");
    sc.add(plate);
    const fx = new Fx(sc, 300);
    return { set, dina, plate, fx, items: [], dispose() { fx.dispose(); set.dispose(); } };
}

function startRound() {
    // entry fee — a real gamble: you only come out ahead by catching well
    const fee = Math.min(COOKIE_FEE, wallet.coins);
    if (fee > 0) wallet.spend(fee);
    Object.assign(CK, {
        active: true, plateX: W / 2, timer: COOKIE_DURATION, score: 0, lives: 3, spawnT: 0.8, combo: 0, comboT: 0, fee,
        msg: "Catch the cookies!", msgT: 2, phase: "play", endT: 0, caught: 0, prevBest: 0, newBest: false, shake: 0, shown: false, t: 0,
    });
    for (const it of K.set.items) K.set.set.scene.remove(it.obj);
    K.set.items = [];
    sfx.tone(660, 0.08, "triangle", 0.18); sfx.tone(880, 0.1, "triangle", 0.18, 0, 0.09);
}

function spawnItem(yOff = -20, vyBase = [200, 270]) {
    const progress = 1 - CK.timer / COOKIE_DURATION;
    const k = pickKind();
    const obj = prop("dinaTreats", k.model);
    K.set.set.scene.add(obj);
    K.set.items.push({ kind: k, obj, x: rand(30, W - 30), y: yOff, vy: rand(vyBase[0], vyBase[1]) + progress * 170, rot: rand(-0.3, 0.3), spin: rand(-2, 2), wob: rand(0, 6.28) });
}

function endRound(why) {
    CK.phase = why;       // "done" (time up) or "oops" (out of hearts)
    CK.endT = 0;
    CK.prevBest = shared.get().cookieBest || 0;
    if (CK.score > CK.prevBest) { shared.update(s => { s.cookieBest = CK.score; }); CK.newBest = CK.prevBest > 0; }
    wallet.add(CK.score);            // bank the round (2D banks it on the "head back" tap)
    emit("stat", { id: "cookies", n: CK.caught });
    emit("dina:cookie", { score: CK.score, caught: CK.caught, fee: CK.fee });
    if (why === "done") sfx.win(); else sfx.womp();
}

function showResult() {
    CK.shown = true;
    const win = CK.phase === "done", net = CK.score - CK.fee;
    const buttons = [{ label: `🏠 Head back ${g("confirm")}`, cls: "pink", action: () => setState("dinaHome", { from: "cookie" }) }];
    if (wallet.coins >= COOKIE_FEE) buttons.push({ label: `↺ Play again (💰${COOKIE_FEE})`, cls: "alt", action: () => { H.hideScreen(); startRound(); } });
    H.showScreen(`${CK.newBest ? `<div class="dina-newbest">🏆 NEW BEST!</div>` : ""}
        <h2>${win ? "🍪 YUM! 🍪" : "Out of cookies! 💥"}</h2>
        <p><b>Caught ${CK.caught} treats</b></p>
        <p>Earned 💰${CK.score} · Fee 💰${CK.fee}</p>
        <div class="dina-profit ${net >= 0 ? "up" : "down"}">${net >= 0 ? "Profit +💰" : "Lost 💰"}${Math.abs(net)}</div>
        <p class="fine">Best round: 💰${Math.max(CK.prevBest, CK.score)}</p>`,
        buttons, { cls: "dina-cookie-result", onBack: () => setState("dinaHome", { from: "cookie" }) });
}

registerState("dinaCookie", {
    hud: false, touch: false, pausable: true, world: false,
    enter() {
        K.set = buildKitchen();
        K.set.set.show();
        startRound();
        L.show();
        L.pauseButton();
        A.setMusic("../dina.mp3");
        const follow = e => {
            if (ctx.state !== "dinaCookie" || ctx.paused || CK.phase !== "play") return;
            if (e.pointerType !== "mouse" && !(e.buttons || e.type === "pointerdown")) return;
            const p = pointerPlane(e, K.set.set.camera, 0.34, "z");
            if (p) CK.plateX = p.x / SX + 240;
        };
        bindPointer({ down: follow, move: follow });
    },
    exit() {
        unbindPointer();
        H.hideScreen();
        L.clear();
        CK.active = false;
        if (K.set) { K.set.dispose(); K.set = null; }
    },
    update(dt, P) {
        const S = K.set, cam = S.set.camera;
        CK.t += dt;
        S.fx.update(dt);
        // field size: wide kitchen in landscape, narrower on a phone held upright
        const portrait = cam.aspect < 1;
        SX = (portrait ? 3.5 : Math.min(6.2, 3.9 * cam.aspect * 0.86)) / W;
        // ── end-of-round ──
        if (CK.phase !== "play") {
            CK.endT += dt;
            if (!CK.shown && CK.endT > 0.8) showResult();
            else if (CK.shown && !H.screenOpen()) showResult();
            if (CK.shown) { H.menuInput(P); if (ctx.state !== "dinaCookie" || !K.set) return; }
        } else {
            // plate: stick / D-pad / ← → (360 px/s), or follow the finger / mouse
            CK.plateX += input.moveX * 360 * dt;
            CK.plateX = clamp(CK.plateX, PLATE_W / 2, W - PLATE_W / 2);
            // spawn (faster as the round goes)
            const progress = 1 - CK.timer / COOKIE_DURATION;
            CK.spawnT -= dt;
            if (CK.spawnT <= 0) {
                CK.spawnT = rand(0.4, 0.72) * (1 - progress * 0.5);
                spawnItem();
                if (progress > 0.55 && rnd() < 0.4) spawnItem(-40, [220, 290]);   // late-game double drop
            }
            // items + the catch test (2D: a flat zone near PLATE_Y)
            for (let i = S.items.length - 1; i >= 0; i--) {
                const it = S.items[i];
                it.y += it.vy * dt;
                it.rot += it.spin * dt;
                if (it.y > PLATE_Y - 18 && it.y < PLATE_Y + 16 && Math.abs(it.x - CK.plateX) < PLATE_W / 2 + 6) {
                    const at = to3(it.x, it.y, new THREE.Vector3());
                    if (it.kind.good) {
                        CK.combo = Math.min(CK.combo + 1, 9);
                        CK.comboT = 1.6;
                        const pts = it.kind.points * (1 + Math.floor(CK.combo / 3));
                        CK.score += pts;
                        CK.caught++;
                        floater("+" + pts, at.clone().setY(at.y + 0.3), "#FFD700", 0.9);
                        S.fx.burst(at, 10, { speed: 1.6, colors: ["#FFD700", "#FFF59D", "#FFFFFF"], size: 0.08, life: 0.5, gravity: 2 });
                        sfx.tone(700 + CK.combo * 60, 0.06, "sine", 0.14);
                        if (CK.combo >= 3 && CK.combo % 3 === 0) { CK.msg = CK.combo + "x COMBO! 🔥"; CK.msgT = 1.2; }
                    } else {
                        // a burnt one — lose a heart, break the combo, shake
                        CK.lives--;
                        CK.combo = 0;
                        CK.shake = 0.35;
                        S.fx.burst(at, 30, { speed: 3, colors: ["#FF7043", "#FFB300", "#616161", "#212121"], size: 0.16, life: 0.7, gravity: 3 });
                        sfx.explosion();
                        rumble(1, 0.8, 300, true);
                        CK.msg = "Ouch! Burnt one! 💥"; CK.msgT = 1.2;
                        if (CK.lives <= 0) endRound("oops");
                    }
                    S.set.scene.remove(it.obj);
                    S.items.splice(i, 1);
                    continue;
                }
                // a good one falling past the plate: gentle combo reset, no heart lost
                if (it.y > Hh + 24) {
                    if (it.kind.good) CK.combo = 0;
                    S.set.scene.remove(it.obj);
                    S.items.splice(i, 1);
                }
            }
            if (CK.comboT > 0) CK.comboT -= dt; else CK.combo = 0;
            if (CK.msgT > 0) CK.msgT -= dt;
            if (CK.phase === "play") {
                CK.timer -= dt;
                if (CK.timer <= 0) { CK.timer = 0; endRound("done"); }
            }
        }

        // ── draw: treats, plate, Dina ──
        const scale = Math.max(0.62, SX / 0.0125);
        for (const it of S.items) {
            to3(it.x, it.y, it.obj.position);
            it.obj.rotation.set(0, Math.sin(it.wob + CK.t * 2) * 0.7, -it.rot);
            it.obj.scale.setScalar(scale * 1.15);
        }
        const px = (CK.plateX - 240) * SX, d = S.dina;
        const vx = (px - d.obj.position.x) / Math.max(dt, 1e-3);
        d.obj.position.set(px, 0, 0);
        d.obj.rotation.set(0, 0, clamp(-vx * 0.02, -0.12, 0.12));
        d.update(dt, { walk: Math.min(3, Math.abs(vx) * 0.6) });
        holdPose(d, -1.25, 0.28);
        if (CK.phase === "oops") d.update(0, { sit: false, cheer: false });
        else if (CK.phase === "done" && CK.endT > 0) d.update(0, { cheer: true });
        S.plate.position.set(px, PLATE_Y3 - 0.06, 0.3);
        S.plate.scale.set(PLATE_W * SX, 1, 1);
        S.plate.visible = CK.phase === "play";
        updateFloaters(dt, cam);

        // ── HUD ──
        const lowT = CK.timer <= 5 && CK.phase === "play";
        const tCol = lowT ? (Math.sin(CK.t * 12) > 0 ? "#FF5252" : "#FFEB3B") : "#FFFFFF";
        const profit = CK.score - CK.fee;
        L.hud(`<span class="t">🍪 Cookie Catch</span>
            <span class="chip" style="color:${profit >= 0 ? "#7CFC4F" : "#FFD54F"}">💰${CK.score} (fee 💰${CK.fee})</span>
            <span class="chip" style="color:#FF80AB">${"♥".repeat(Math.max(0, CK.lives)) || "—"}</span>
            ${CK.combo >= 2 && CK.phase === "play" ? `<span class="chip" style="color:#FF8A65">${CK.combo}x</span>` : ""}
            <span class="chip" style="color:${tCol}">⏱ ${Math.ceil(CK.timer)}s</span>`);
        L.msg(CK.msgT > 0 ? CK.msg : "");
        L.prompt(CK.phase === "play" ? `<div>${isTouch() ? "Drag to catch treats · dodge 💣" : `${g("steer")} catch treats · dodge 💣`}</div>` : "");

        // ── camera: fit the field (a bit of Dina under the plate, the drop zone above) ──
        const fieldW = W * SX + 0.8, fieldH = 4.6;
        const t2 = Math.tan(THREE.MathUtils.degToRad(25));
        const dist = Math.max(fieldH / (2 * t2), fieldW / (2 * t2 * cam.aspect));
        cam.fov = 50;
        cam.position.set(0, 2.45, dist + 0.34);
        cam.lookAt(0, 2.35, 0);
        CK.shake = Math.max(0, CK.shake - dt);
        if (CK.shake > 0) { cam.position.x += (Math.random() - 0.5) * 0.12; cam.position.y += (Math.random() - 0.5) * 0.12; }
        cam.updateProjectionMatrix();
    },
});
