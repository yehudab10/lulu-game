// "Pick a Bruck Sister!" (2D: charSelect) — Lulu (18) and Dina (8) on a sunny
// lawn with confetti drifting down. Lulu → back to the road trip (title);
// Dina → the school bus. (Tammy's working a shift — she's a nurse.)
import * as THREE from "three";
import { ctx, registerState, setState, css } from "../../core/ctx.js";
import { makeSet } from "../../core/sets.js";
import { spawnPerson } from "../../core/people.js";
import { shared } from "../../core/save.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { input } from "../../input.js";
import { L, sfx, g, isTouch, prop, attach, canvasTexture, models, ensureModels, STREET_MODELS, ROOM_MODELS, S2, holdPose, node } from "./common.js";
import { cloneWithColors, findNodes } from "../../models.js";

css("dina-select", `
#screen .card.dina-select { background: transparent; box-shadow: none; width: min(980px, 100%); height: 100%; max-height: 100%;
  display: flex; flex-direction: column; justify-content: space-between; padding: 6px 4px; overflow: visible; }
body.dina-select-on .screen { background: none; }
.dina-select .ds-title { align-self: center; background: rgba(0,0,0,.35); color: #fff; border-radius: 16px; padding: 6px 22px;
  font-size: 32px; font-weight: 700; text-shadow: 0 3px 0 #7A2A5C; animation: dsbob 2.1s ease-in-out infinite; }
@keyframes dsbob { 50% { transform: translateY(-4px); } }
.dina-select .ds-cards { display: flex; justify-content: space-between; gap: 18px; align-items: flex-end; }
.dina-select .ds-card { flex: 0 1 300px; border: 5px solid var(--acc); border-radius: 20px; background: linear-gradient(#FFFDF8, #FCEAF1);
  padding: 0 0 10px; cursor: pointer; font: 600 15px var(--font); color: #555; box-shadow: 4px 6px 0 rgba(0,0,0,.25); overflow: hidden;
  display: flex; flex-direction: column; align-items: stretch; text-align: center; }
.dina-select .ds-card b { display: block; background: var(--acc); color: #fff; font-size: 22px; padding: 6px 0; text-shadow: 0 2px 0 rgba(0,0,0,.35); }
.dina-select .ds-card i { display: block; margin: 8px 10px 4px; }
.dina-select .ds-card .tap { align-self: center; background: var(--acc); color: #fff; border-radius: 999px; padding: 3px 14px; font-weight: 700; font-size: 13px;
  display: inline-flex; gap: 6px; align-items: center; }
.dina-select .ds-card .tap .glyph { background: rgba(255,255,255,.9); color: var(--ink); }
.dina-select .ds-card.focus { transform: scale(1.06); box-shadow: 0 0 0 6px #fff, 0 0 0 11px rgba(233,30,99,.55); }
.dina-select .ds-foot { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.dina-select .ds-foot .tammy { color: rgba(255,255,255,.92); font-style: italic; font-size: 13px; text-shadow: 0 1px 2px #7A2A5C; }
.dina-select .ds-room { background: #7E57C2; color: #fff; border: none; border-radius: 14px; padding: 7px 16px; font: 700 15px var(--font); cursor: pointer;
  box-shadow: 0 4px 0 rgba(0,0,0,.22); }
.dina-select .ds-room.focus { outline: 4px solid #fff; box-shadow: 0 0 0 8px rgba(233,30,99,.55); }
@media (max-aspect-ratio: 1/1) { .dina-select .ds-cards { flex-direction: row; } .dina-select .ds-card { flex-basis: 48%; font-size: 13px; }
  .dina-select .ds-title { font-size: 24px; } }
body.tv #screen .card.dina-select { width: min(1500px, 100%); }
body.tv .dina-select .ds-title { font-size: 48px; }
body.tv .dina-select .ds-card { flex-basis: 440px; font-size: 22px; }
body.tv .dina-select .ds-card b { font-size: 32px; }
`);

const SEL = { set: null, lulu: null, dina: null, t: 0, focus: "dina", confetti: null, loading: false };

function build() {
    const set = makeSet({ light: "day", fog: [18, 60] });
    const own = (...a) => set.own(...a);
    const sc = set.scene;
    sc.background = own(canvasTexture(16, 256, (x, w, h) => {
        const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#A8E6CF"); gr.addColorStop(0.62, "#FFE3B0"); gr.addColorStop(1, "#FFD59A");
        x.fillStyle = gr; x.fillRect(0, 0, w, h);
    }));
    sc.fog.color.set("#FFE3B0");
    const grass = new THREE.Mesh(own(new THREE.CircleGeometry(30, 48)), own(new THREE.MeshStandardMaterial({ color: "#7CB342", roughness: 0.95 })));
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; sc.add(grass);
    // a picket fence + a few bushes behind them
    const pick = new THREE.InstancedMesh(own(new THREE.BoxGeometry(0.1, 0.9, 0.04)), own(new THREE.MeshStandardMaterial({ color: "#FFF8E8" })), 60);
    for (let i = 0; i < 60; i++) pick.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-10 + i * 0.34, 0.45, -3.6));
    pick.castShadow = true; sc.add(pick);
    for (const [x, z, s] of [[-4.2, -3.1, 0.9], [4.4, -3.2, 1.0], [-6.5, -2.4, 0.7], [6.8, -2.6, 0.8]]) {
        const b = cloneWithColors(models.bush); b.position.set(x, 0, z); b.scale.setScalar(s); sc.add(b);
    }
    for (const [x, z] of [[-8, -6], [8.5, -7]]) { const t = cloneWithColors(models.treeRound); t.position.set(x, 0, z); sc.add(t); }
    // Lulu by her pink convertible, Dina with Morgan + her backpack
    const car = cloneWithColors(models.lulu);
    const drv = findNodes(car, "Driver")[0]; if (drv) drv.visible = false;
    for (const h of findNodes(car, "Hair_")) h.visible = false;
    car.position.set(-2.6, 0, -1.6); car.rotation.y = 0.9; sc.add(car);
    const lulu = spawnPerson("luluPerson");
    lulu.obj.position.set(-1.05, 0, 0.2); lulu.obj.rotation.y = 0.25; sc.add(lulu.obj);
    const dina = spawnPerson("dinaPerson");
    dina.obj.position.set(1.05, 0, 0.3); dina.obj.rotation.y = -0.25; sc.add(dina.obj);
    attach(dina, "Body", prop("dinaProps", "Backpack"), 0, 0.78, -0.17);
    const morgan = cloneWithColors(models.dinaMorgan);
    morgan.scale.setScalar(0.42);
    attach(dina, "Body", morgan, 0, 0.5, 0.17);
    // confetti: little squares + stars drifting down
    const COLS = ["#FF4FA3", "#FFD93D", "#6BCBFF", "#A8E6CF", "#FFFFFF"].map(c => new THREE.Color(c));
    const conf = new THREE.InstancedMesh(own(new THREE.PlaneGeometry(0.07, 0.05)), own(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), 90);
    const parts = [];
    for (let i = 0; i < 90; i++) { parts.push({ x: (Math.random() - 0.5) * 9, y: Math.random() * 5, z: (Math.random() - 0.5) * 5 - 0.5, r: Math.random() * 6, s: 0.6 + Math.random() * 0.6 }); conf.setColorAt(i, COLS[i % 5]); }
    sc.add(conf);
    return { set, lulu, dina, conf, parts };
}

function html() {
    const runs = S2.runsPlayed();
    return `<div class="ds-title">Pick a Bruck Sister!</div>
        <div class="ds-cards">
            <button class="ds-card" id="dsLulu" style="--acc:#FF4FA3"><b>Lulu — 18</b><i>Pink car. Big sister energy.</i><span class="tap">${isTouch() ? "TAP" : g("confirm")} ▶</span></button>
            <button class="ds-card" id="dsDina" style="--acc:#A06DC8"><b>Dina — 8</b><i>Has Morgan. Runs fast.</i><span class="tap">${isTouch() ? "TAP" : g("confirm")} ▶</span></button>
        </div>
        <div class="ds-foot">
            ${runs > 0 ? `<button class="ds-room" id="dsRoom">🏠 Straight to Dina's room</button>` : ""}
            <div class="tammy" style="font-style:normal;font-weight:700;font-size:16px">${isTouch() ? "Tap a sister to play!" : `${g("move")} pick a sister · ${g("confirm")} play`}</div>
            <div class="tammy">🏥 (Tammy's working a shift — she's a nurse)</div>
        </div>`;
}

export async function pickDina() {
    if (SEL.loading) return;
    SEL.loading = true;
    sfx.charSelect();
    try { await ensureModels(STREET_MODELS.concat(ROOM_MODELS)); }
    catch (e) { console.error(e); H.toast("Couldn't load Dina's street — check your connection", "red"); SEL.loading = false; return; }
    SEL.loading = false;
    if (ctx.state === "dinaSelect") setState("dinaBus");
}
async function toRoom() {
    if (SEL.loading) return;
    SEL.loading = true;
    try { await ensureModels(ROOM_MODELS.concat(["dinaTreats", "dinaKitchen"])); } catch (e) { console.error(e); SEL.loading = false; return; }
    SEL.loading = false;
    if (ctx.state === "dinaSelect") setState("dinaHome", { from: "outside" });
}

registerState("dinaSelect", {
    hud: false, touch: false, pausable: false, world: false,
    enter() {
        if (!SEL.set) SEL.set = build();
        SEL.set.set.show();
        SEL.t = 0;
        document.body.classList.add("dina-select-on");
        const card = H.showScreen(html(), [], { cls: "dina-select", focus: "dsDina", onBack: () => setState("title") });
        card.querySelector("#dsLulu").addEventListener("click", () => { sfx.charSelect(); setState("title"); });
        card.querySelector("#dsDina").addEventListener("click", pickDina);
        const room = card.querySelector("#dsRoom");
        if (room) room.addEventListener("click", toRoom);
        A.setMusic("../lulu.mp3");
        // warm the cache for the street + room while the player decides
        ensureModels(STREET_MODELS.concat(ROOM_MODELS)).catch(() => {});
    },
    exit() {
        document.body.classList.remove("dina-select-on");
        H.hideScreen();
        if (SEL.set) { SEL.set.set.dispose(); SEL.set = null; }
    },
    update(dt, P) {
        const S = SEL.set;
        SEL.t += dt;
        H.menuInput(P);
        const f = document.querySelector("#screenCard .focus");
        SEL.focus = f && f.id === "dsLulu" ? "lulu" : "dina";
        // the focused sister waves; both bob
        S.lulu.update(dt, { wave: SEL.focus === "lulu", talk: SEL.focus === "lulu" });
        S.dina.update(dt, { wave: false });
        holdPose(S.dina, -1.0, 0.5);           // hugging Morgan
        if (SEL.focus === "dina") { S.dina.obj.position.y = Math.abs(Math.sin(SEL.t * 5)) * 0.08; } else S.dina.obj.position.y = 0;
        S.lulu.obj.position.y = SEL.focus === "lulu" ? Math.abs(Math.sin(SEL.t * 5)) * 0.05 : 0;
        // confetti
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
        S.parts.forEach((p, i) => {
            p.y -= dt * 0.5 * p.s; p.r += dt * 2 * p.s;
            if (p.y < 0) p.y = 5;
            m4.compose(new THREE.Vector3(p.x + Math.sin(SEL.t + i) * 0.2, p.y, p.z), q.setFromEuler(e.set(p.r, p.r * 0.7, 0)), sc.setScalar(p.s));
            S.conf.setMatrixAt(i, m4);
        });
        S.conf.instanceMatrix.needsUpdate = true;
        const cam = S.set.camera, portrait = cam.aspect < 1;
        cam.position.set(Math.sin(SEL.t * 0.2) * 0.3, portrait ? 1.9 : 1.35, portrait ? 7.4 : 4.6);
        cam.lookAt(0, portrait ? 1.0 : 0.95, 0);
        cam.fov = portrait ? 58 : 50; cam.updateProjectionMatrix();
    },
});
