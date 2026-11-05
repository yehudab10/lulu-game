// Morgan the plushie (2D: dinaMorgan). Morgan sits on a pink blanket; pet her
// head, back or belly (belly +15, the glowing "Pet here!" spot +10, anywhere
// else +5). The spot moves every 4 s. At 100% she celebrates — +1 💰 once per
// visit — and Dina drifts back to her room. Tap Morgan, or pick a spot with
// the D-pad / stick and press ✕.
import * as THREE from "three";
import { ctx, registerState, setState, emit } from "../../core/ctx.js";
import { wallet } from "../../core/save.js";
import { makeSet } from "../../core/sets.js";
import { input } from "../../input.js";
import {
    L, bubble, bubblesDone, sfx, rand, randPick, clamp, g, isTouch, node, models, canvasTexture,
    bindPointer, unbindPointer, pickAt,
} from "./common.js";
import { cloneWithColors } from "../../models.js";

const ZONES = ["head", "back", "belly"];
const ZONE_POS = { head: new THREE.Vector3(0, 0.47, 0.17), back: new THREE.Vector3(-0.07, 0.25, 0.155), belly: new THREE.Vector3(0, 0.1, 0.165) };
const HEART_COLS = ["#FF6B9D", "#FF80AB", "#E91E63", "#FFD700", "#FFEB3B"];
const M = { set: null, happy: 0, timer: 0, spot: null, mood: "calm", moodT: 0, celebrateT: 0, awarded: false, sel: "back", petT: 0, hearts: [], tapped: null };
const _p = new THREE.Vector3(), _v = new THREE.Vector3();

function build() {
    const set = makeSet({ light: "indoor", sky: "#FFF4E0" });
    set.hemi.color.set("#FFFFFF"); set.sun.color.set("#FFFFFF");
    const own = (...a) => set.own(...a);
    const sc = set.scene;
    const mat = o => own(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.95 }, o)));
    // cozy backdrop + the pink blanket with a scalloped edge (2D #FFD4E5 / #F5A8C8)
    const wall = new THREE.Mesh(own(new THREE.PlaneGeometry(12, 6)), mat({ map: own(canvasTexture(64, 256, (x, w, h) => {
        const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#FFE7C9"); gr.addColorStop(1, "#FFF4E0");
        x.fillStyle = gr; x.fillRect(0, 0, w, h);
    })) }));
    wall.position.set(0, 2.5, -1.6); sc.add(wall);
    const blanket = new THREE.Mesh(own(new THREE.PlaneGeometry(12, 6)), mat({ color: "#FFD4E5" }));
    blanket.rotation.x = -Math.PI / 2; blanket.position.set(0, 0, 0.6); blanket.receiveShadow = true; sc.add(blanket);
    const scal = new THREE.InstancedMesh(own(new THREE.CircleGeometry(0.26, 20)), mat({ color: "#F5A8C8" }), 24);
    for (let i = 0; i < 24; i++) scal.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(-6 + i * 0.52, 0.004, -1.15),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), new THREE.Vector3(1, 0.36, 1)));
    sc.add(scal);
    // pillows
    for (const [x, z, c, s] of [[-0.85, -0.7, "#FFFFFF", 1], [0.9, -0.75, "#B8E0D2", 0.9], [-1.5, -1.1, "#E1BEE7", 0.8]]) {
        const p = new THREE.Mesh(own(new THREE.SphereGeometry(0.3, 18, 12)), mat({ color: c }));
        p.scale.set(0.9 * s, 0.4 * s, 0.6 * s); p.position.set(x * 1.1, 0.11 * s, z); p.castShadow = true; sc.add(p);
    }
    const morgan = cloneWithColors(models.dinaMorgan);
    sc.add(morgan);
    const eyesOpen = node(morgan, "EyesOpen"), eyesHappy = node(morgan, "EyesHappy"), tail = node(morgan, "Tail");
    // the pulsing "Pet here!" ring
    const ring = new THREE.Mesh(own(new THREE.TorusGeometry(0.075, 0.008, 8, 32)),
        own(new THREE.MeshBasicMaterial({ color: "#FFD700", transparent: true, opacity: 0.8, depthTest: false })));
    ring.renderOrder = 10; sc.add(ring);
    // Dina's hand (mint sleeve), coming in from the bottom right
    const hand = new THREE.Group();
    const skin = mat({ color: "#FFE0CC", roughness: 0.7 });
    const palm = new THREE.Mesh(own(new THREE.SphereGeometry(0.045, 16, 12)), skin); palm.scale.set(1, 0.75, 1.15); hand.add(palm);
    for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(own(new THREE.SphereGeometry(0.016, 10, 8)), skin);
        f.scale.set(1, 1, 1.9); f.position.set(-0.03 + i * 0.02, 0.012, -0.05); hand.add(f);
    }
    const sleeve = new THREE.Mesh(own(new THREE.CylinderGeometry(0.03, 0.038, 1, 14)), mat({ color: "#A8E6CF", roughness: 0.9 }));
    hand.scale.setScalar(0.8);
    sc.add(hand, sleeve);
    // heart sprites (one texture per colour, reused)
    const heartTex = HEART_COLS.map(c => own(canvasTexture(64, 64, (x) => { x.fillStyle = c; x.font = "700 56px Arial"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("♥", 32, 36); })));
    const sprites = [];
    for (let i = 0; i < 40; i++) {
        const s = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: heartTex[i % heartTex.length], transparent: true, depthWrite: false })));
        s.visible = false; s.scale.setScalar(0.07); sc.add(s);
        sprites.push({ s, life: 0, vx: 0 });
    }
    set.camera.position.set(0, 0.5, 1.45);
    return { set, morgan, eyesOpen, eyesHappy, tail, ring, hand, sleeve, sprites };
}

function heart(pos, n, col = null) {
    for (let k = 0; k < n; k++) {
        const h = M.set.sprites.find(x => x.life <= 0);
        if (!h) return;
        h.life = col ? 2 : 1.2; h.max = h.life;
        h.s.position.set(pos.x + rand(-0.06, 0.06), pos.y, pos.z + 0.05);
        h.vx = rand(-0.05, 0.05);
        h.s.visible = true;
    }
}

function pet(zone) {
    if (M.mood === "celebrate") return;
    const gain = zone === "belly" ? 15 : zone === M.spot.zone ? 10 : 5;
    M.happy = Math.min(100, M.happy + gain);
    M.sel = zone;
    M.petT = 0.45;
    heart(_v.copy(ZONE_POS[zone]).add(M.set.morgan.position), zone === "belly" ? 8 : 3);
    sfx.tone(zone === "belly" ? 700 : 1000, 0.08, "sine", 0.16);
    M.mood = "happy"; M.moodT = 0.7;
    if (M.happy >= 100) {
        M.mood = "celebrate"; M.celebrateT = 0;
        if (!M.awarded) { M.awarded = true; wallet.add(1); emit("stat", { id: "morganHugs", n: 1 }); }
        sfx.yay();
    }
}

registerState("dinaMorgan", {
    hud: false, touch: false, pausable: false, world: false,
    enter() {
        if (!M.set) M.set = build();
        M.set.set.show();
        Object.assign(M, { happy: 0, timer: 0, spot: null, mood: "calm", moodT: 0, celebrateT: 0, awarded: false, sel: "back", petT: 0, tapped: null });
        for (const h of M.set.sprites) { h.life = 0; h.s.visible = false; }
        L.show();
        const back = L.add(`◀ BACK ${g("back")}`, "dl-btn dl-back");
        back.addEventListener("click", () => { sfx.click(); setState("dinaHome", { from: "morgan" }); });
        bindPointer({ down: e => {
            if (ctx.state !== "dinaMorgan") return;
            const hits = pickAt(e, M.set.set.camera, [M.set.morgan]);
            if (!hits.length) return;
            const local = M.set.morgan.worldToLocal(hits[0].point.clone());
            M.tapped = local.y > 0.31 ? "head" : local.y > 0.165 ? "back" : "belly";
        } });
    },
    exit() { unbindPointer(); L.clear(); if (M.set) { M.set.set.dispose(); M.set = null; } },
    update(dt, P) {
        const S = M.set;
        M.timer += dt;
        // the sweet spot moves every 4 s
        if (!M.spot || M.spot.t <= 0) M.spot = { zone: randPick(ZONES), t: 4 };
        M.spot.t -= dt;
        // pick a spot: ↑ head · ←/→ back · ↓ belly (stick works too)
        if (P.up) M.sel = "head";
        else if (P.down) M.sel = "belly";
        else if (P.navLeft || P.navRight) M.sel = "back";
        if (Math.abs(input.moveY) > 0.6) M.sel = input.moveY < 0 ? "head" : "belly";
        else if (Math.abs(input.moveX) > 0.6) M.sel = "back";
        if (M.tapped) { pet(M.tapped); M.tapped = null; }
        else if (P.confirm || P.interact) pet(M.sel);
        if (P.back) { sfx.click(); setState("dinaHome", { from: "morgan" }); return; }
        if (M.mood === "happy") { M.moodT -= dt; if (M.moodT <= 0) M.mood = "calm"; }

        // Morgan: bounce, eyes, tail
        const happy = M.mood !== "calm", celebrate = M.mood === "celebrate";
        let bounce = M.mood === "happy" ? Math.sin(M.timer * 30) * 0.006 : 0;
        if (celebrate) bounce += Math.abs(Math.sin(M.timer * 8)) * 0.06;
        S.morgan.position.y = bounce;
        S.morgan.rotation.z = celebrate ? Math.sin(M.timer * 8) * 0.06 : 0;
        if (S.eyesOpen) S.eyesOpen.visible = !happy;
        if (S.eyesHappy) S.eyesHappy.visible = happy;
        if (S.tail) S.tail.rotation.y = Math.sin(M.timer * (happy ? 14 : 3)) * 0.35;

        // the ring + "Pet here!" (only while she's calm)
        const sp = ZONE_POS[M.spot.zone];
        S.ring.visible = M.mood === "calm";
        S.ring.position.copy(sp).add(S.morgan.position);
        S.ring.scale.setScalar(1 + 0.12 * Math.sin(M.timer * 5));
        S.ring.material.opacity = 0.5 + 0.3 * Math.sin(M.timer * 5);
        if (S.ring.visible) bubble("pet", "👆 Pet here!", _p.copy(S.ring.position).add(_v.set(0, 0.1, 0)), S.set.camera, "label");

        // Dina's hand: hovers over the chosen spot, strokes when you pet
        M.petT = Math.max(0, M.petT - dt);
        const tgt = _p.copy(ZONE_POS[M.sel]).add(_v.set(0.03, 0.02 + (M.petT > 0 ? Math.sin((0.45 - M.petT) / 0.45 * Math.PI * 2) * 0.04 : 0.03), 0.07));
        if (celebrate) tgt.set(0.28, 0.12, 0.35);
        S.hand.position.lerp(tgt, Math.min(1, dt * 10));
        S.hand.rotation.set(-0.5, 0.4, 0.2);
        const elbow = _v.set(0.55, -0.12, 0.45);
        S.sleeve.position.copy(S.hand.position).add(elbow).multiplyScalar(0.5);
        S.sleeve.scale.y = S.hand.position.distanceTo(elbow);
        S.sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), elbow.clone().sub(S.hand.position).normalize());


        // hearts
        if (celebrate && Math.random() > 0.4) heart(_v.set(rand(-0.6, 0.6), -0.05, rand(-0.1, 0.25)), 1, true);
        for (const h of S.sprites) {
            if (h.life <= 0) continue;
            h.life -= dt;
            h.s.position.y += 0.33 * dt * (h.max > 1.5 ? 1.6 : 1);
            h.s.position.x += Math.sin(h.life * 4) * 0.004 + h.vx * dt;
            h.s.material.opacity = clamp(h.life / 1.2, 0, 1);
            if (h.life <= 0) h.s.visible = false;
        }

        // HUD: Morgan's Happiness
        L.hud(`<span class="t">Morgan's Happiness</span><div class="dl-bar"><i style="width:${M.happy}%"></i></div><span class="chip gold">♥ ${Math.floor(M.happy)}%</span>`);
        if (celebrate) {
            M.celebrateT += dt;
            L.tint("rgba(255,235,0,0.15)", 1);
            L.prompt(`<div class="big gold">${M.awarded ? "💰 +1 coin! 💰" : "💜 Morgan's so happy! 💜"}</div><div>Morgan loves you, Dina!</div>`);
            if (M.celebrateT > 2.8) { setState("dinaHome", { from: "morgan" }); return; }
        } else {
            L.tint("transparent", 0);
            L.prompt(`<div>${isTouch() ? "Tap anywhere on Morgan to pet, scratch, or hug"
                : `${g("move")} pick a spot · ${g("confirm")} pet · ${g("back")} back`}</div>`);
        }
        bubblesDone();
        const cam = S.set.camera, portrait = cam.aspect < 1;
        cam.position.set(0, 0.5, portrait ? 2.2 : 1.45);
        cam.lookAt(0, 0.31, 0);
        cam.fov = portrait ? 52 : 45; cam.updateProjectionMatrix();
    },
});
