// features/journey — the Story Trip.
//
// CURRENT STATE (foundation): one leg, Lakewood → BUBBE'S HOUSE (4.8 km), with
// her house, Bubbe waving at the gate, a balloon arch over the road, the
// arrival cutscene and the arrival screen. The journey agent extends this to the
// 2D game's five stops (see src/05a-journey.js TRIP_STOPS).
import * as THREE from "three";
import { ctx, on, hook, registerState, setState, addMenuItem, fmtTime } from "../../core/ctx.js";
import { save3d, saveSoon, store } from "../../core/save.js";
import { startRun, updateDriving, endRun, statsHtml, addScore } from "../../core/driving.js";
import { models, cloneWithColors, findNodes } from "../../models.js";
import { SHOULDER, ribbon, signTexture, facingRoad, worldMaterials } from "../../world.js";
import { rumble, glyph } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";

export const GOAL = 4800;   // Bubbe's house (≈3 miles)
const J = store("journey", { arrivals: 0, bestTime: 0 });

// ── title + trip bar ─────────────────────────────────────────────────────
addMenuItem("title", { id: "story", order: 10, cls: "", label: () => `📖 Story Trip ${glyph("confirm")}`, action: () => startRun({ mode: "story" }) });

hook("runStart", G => {
    if (G.mode !== "story") return;
    G.goal = GOAL;
    G.goText = "Bubbe's house · 3 miles";
    G.arrived = false;
    G.aheadShown = false;
});

ctx.trip = {
    progress() {
        const G = ctx.G;
        if (G.mode !== "story" || G.arrived) return 1;
        return (ctx.car.s - G.startS) / (GOAL - G.startS);
    },
    label() {
        const G = ctx.G;
        if (G.mode !== "story" || G.arrived) return `${G.arrived ? "ENDLESS CRUISE" : "CRUISE"} · ${((ctx.car.s - G.startS) / 1609).toFixed(1)} mi`;
        return `BUBBE'S HOUSE · ${(Math.max(0, GOAL - ctx.car.s) / 1609).toFixed(1)} mi`;
    },
};

hook("update", (dt, P, controlsOn) => {
    const G = ctx.G;
    if (G.mode !== "story" || G.arrived || !controlsOn) return;
    if (!G.aheadShown && GOAL - ctx.car.s < 450) {
        G.aheadShown = true;
        H.banner(`🏡 <b>Bubbe's house ahead!</b><small>Pull in under the balloons</small>`, 2600);
    }
    if (ctx.car.s >= GOAL && ctx.state === "playing") arrive();
});

// ── the set piece: Bubbe's house, Bubbe, the arch ─────────────────────────
on("boot", () => {
    const w = ctx.world;
    w.reserve(GOAL - 60, GOAL + 60, 1, 10, 60);   // keep Bubbe's yard clear of trees/houses
    w.reserve(GOAL - 45, GOAL + 45, 1, 9, 14);    // and the power poles
    w.addSign({ s: GOAL - 3200, d: 10.6, lines: ["BUBBE'S HOUSE", "2 MI"], bg: "#1f7a46" });
    w.addSign({ s: GOAL - 1600, d: 10.6, lines: ["BUBBE'S HOUSE", "1 MI"], bg: "#1f7a46" });
    w.addSign({ s: GOAL - 600, d: 10.6, lines: ["BUBBE'S HOUSE", "EXIT NOW!"], bg: "#E91E63" });
    w.addSign({ s: GOAL + 900, d: 10.6, lines: ["LAS VEGAS", "2,511 MI"], bg: "#1f7a46" });
    w.addSign({ s: 2300, d: 10.6, lines: ["HESHY'S POOL", "8 MI"], bg: "#1f7a46" });
});

let bubbe = null;
on("chunk:build", ({ chunk, world, s0, s1 }) => {
    if (GOAL < s0 || GOAL >= s1) return;
    const road = world.road, M = worldMaterials(), p = {};
    const h = road.at(GOAL).h;
    road.point(GOAL, 27, p);
    const house = cloneWithColors(models.bubbeHouse);
    house.position.set(p.x, 0, p.z);
    house.rotation.y = facingRoad(h, 1);
    chunk.add(house);
    chunk.addCollider({ x: p.x, z: p.z, r: 6.4, kind: "house" });
    chunk.addMesh(ribbon(road, GOAL - 2, GOAL + 2, SHOULDER, 17, 0.025, 10), M.drive);

    // Bubbe herself, waving by the gate
    road.point(GOAL, 15.6, p);
    const b = cloneWithColors(models.bubbe);
    b.position.set(p.x, 0, p.z);
    b.rotation.y = facingRoad(h, 1) - 0.5;
    b.scale.setScalar(1.6);
    chunk.add(b);
    const arm = findNodes(b, "Arm_Wave")[0];
    bubbe = { obj: b, arm, base: arm ? arm.rotation.clone() : null };
    chunk.onAnimate(t => { if (arm) arm.rotation.z = bubbe.base.z + Math.sin(t * 7) * 0.45; });

    // finish arch over the road with balloons
    const arch = new THREE.Group();
    const ap = road.at(GOAL);
    arch.position.set(ap.x, 0, ap.z);
    arch.rotation.y = h + Math.PI;
    const postGeo = chunk.own(new THREE.CylinderGeometry(0.22, 0.22, 7.6, 10));
    for (const s of [-1, 1]) {
        const post = new THREE.Mesh(postGeo, new THREE.MeshStandardMaterial({ color: s > 0 ? "#E91E63" : "#FFC107", roughness: 0.5 }));
        post.position.set(s * 9.6, 3.8, 0);
        post.castShadow = true;
        arch.add(post);
        const cols = ["#FF4081", "#FFD740", "#40C4FF", "#B388FF", "#69F0AE"];
        for (let k = 0; k < 5; k++) {
            const ball = new THREE.Mesh(chunk.own(new THREE.SphereGeometry(0.5, 14, 10)),
                new THREE.MeshStandardMaterial({ color: cols[k], roughness: 0.3, emissive: cols[k], emissiveIntensity: 0.15 }));
            ball.scale.y = 1.2;
            ball.position.set(s * 9.6 + Math.cos(k * 1.3) * 0.9, 7.9 + k * 0.35, Math.sin(k * 1.3) * 0.9);
            ball.castShadow = true;
            arch.add(ball);
            const base = ball.position.y, ph = k + s;
            chunk.onAnimate(t => { ball.position.y = base + Math.sin(t * 1.6 + ph) * 0.18; });
        }
    }
    const banner = new THREE.Mesh(chunk.own(new THREE.BoxGeometry(18.8, 2.2, 0.12)), [
        M.metal, M.metal, M.metal, M.metal,
        new THREE.MeshStandardMaterial({ map: signTexture(["🏡 BUBBE'S HOUSE 🏡"], "#E91E63", "#ffffff", 1024, 128), roughness: 0.6 }),
        new THREE.MeshStandardMaterial({ map: signTexture(["DRIVE SAFE, LULULEH!"], "#E91E63", "#ffffff", 1024, 128), roughness: 0.6 }),
    ]);
    banner.position.y = 6.6;
    banner.castShadow = true;
    arch.add(banner);
    chunk.add(arch);
    chunk.addCollider({ x: ap.x - Math.cos(h) * 9.6, z: ap.z + Math.sin(h) * 9.6, r: 0.35, kind: "pole" });
    chunk.addCollider({ x: ap.x + Math.cos(h) * 9.6, z: ap.z - Math.sin(h) * 9.6, r: 0.35, kind: "pole" });
});

// ── arriving ─────────────────────────────────────────────────────────────
function arrive() {
    const G = ctx.G;
    G.arrived = true;
    A.sfxFanfare();
    A.sfxHorn(false);
    rumble(0.4, 0.8, 500, true);
    H.banner(`🏡 <b>BUBBE'S HOUSE!</b>`, 2800);
    G.arriveBonus = 500 + G.hearts * 250;
    addScore(G.arriveBonus, "arrival");
    const car = ctx.car;
    const cols = [[1, 0.25, 0.5], [1, 0.84, 0.25], [0.25, 0.77, 1], [0.7, 0.53, 1], [0.41, 0.94, 0.68]];
    for (let i = 0; i < 60; i++) {
        car.fx.emit(car.pos.x + (Math.random() - 0.5) * 6, 3 + Math.random() * 3, car.pos.z + (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 6, 4 + Math.random() * 4, (Math.random() - 0.5) * 6, 0.5, 2.2, cols[i % cols.length]);
    }
    setState("arriving");
}

const shot = { from: new THREE.Vector3(), look: new THREE.Vector3() };
registerState("arriving", {
    hud: true, touch: false, driving: true,
    enter() {
        const road = ctx.world.road;
        // from just before the arch: banner, Bubbe's house on the right, Lulu pulling up
        const p = road.point(GOAL - 20, -7, {}), t = road.point(GOAL + 8, 9, {});
        shot.from.set(p.x, 5.2, p.z);
        shot.look.set(t.x, 2.6, t.z);
        ctx.cam.snap();
    },
    update(dt, P) {
        updateDriving(dt, {}, false, { steer: 0, throttle: 0, brake: 1, handbrake: false, analog: true });
        if (ctx.stateT > 3.6 || (ctx.stateT > 1.2 && (P.confirm || P.start))) setState("arrivedScreen");
    },
    camera(dt) {
        shot.from.lerp(shot.look, dt * 0.06);
        ctx.cam.cinematic(shot.from, shot.look, dt, 1.6, 50);
        return true;
    },
});

registerState("arrivedScreen", {
    hud: false, touch: false,
    enter() {
        const G = ctx.G;
        const t = G.runTime;
        const fastest = !J.bestTime || t < J.bestTime;
        if (fastest) J.bestTime = t;
        J.arrivals++;
        if (G.score > save3d.best) save3d.best = Math.floor(G.score);
        saveSoon();
        H.showScreen(`<h2>🏡 You made it!</h2>
            <div class="quote">"LULULEH! You made it! Come, EAT — the cholent's hot! 🍲"</div>
            ${statsHtml(`<div class="stat"><b>${fmtTime(t)}</b><span>TIME${fastest ? " 🏆" : ""}</span></div>`)}
            <p>Arrival bonus <b>+${G.arriveBonus}</b> (${"❤️".repeat(G.hearts)} left${G.tickets ? `, ${G.tickets} speeding ticket${G.tickets > 1 ? "s" : ""} 🙈` : ""})</p>`,
            [
                { label: `🛣️ Keep cruising ${glyph("confirm")}`, action: () => { H.hideScreen(); setState("playing"); H.toast("Endless cruise — how far can you go?", "pink"); } },
                { label: "↺ Drive it again", cls: "alt", action: () => { H.hideScreen(); endRun("arrived"); startRun({ mode: "story" }); } },
                { label: "⌂ Title screen", cls: "purple", action: () => { H.hideScreen(); endRun("arrived"); setState("title"); } },
            ]);
    },
    exit() { H.hideScreen(); },
    update(dt, P) { H.menuInput(P); },
});
