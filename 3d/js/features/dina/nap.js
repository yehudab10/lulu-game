// Dina's nap (2D: dinaNap). Beat 1: "Dina's so tired…" — tuck her in (✕ /
// tap, or it happens by itself after 4 s); the quilt slides up to her chin.
// Beat 2: the room drifts from afternoon to night (lamp dims, moonlight,
// the window turns starry, Z's float up) — "💤 RESTED! +1 💰" — then wake up.
import * as THREE from "three";
import { ctx, registerState, setState, emit } from "../../core/ctx.js";
import { wallet } from "../../core/save.js";
import { room, SPOTS } from "./room.js";
import { Home } from "./home.js";
import { L, sfx, clamp, g, isTouch, emojiSprite, disposeSprite, bindPointer, unbindPointer, models } from "./common.js";
import { cloneWithColors } from "../../models.js";

const N = { t: 0, tucked: false, tuckT: 0, awarded: false, tap: false, zs: [], plush: null, quiltY: 0, quiltS: 1 };
const HEAD = new THREE.Vector3(SPOTS.bed.x, 0.95, SPOTS.bed.z - 0.72);

registerState("dinaNap", {
    hud: false, touch: false, pausable: false, world: false,
    enter() {
        const rm = room();
        rm.set.show();
        Object.assign(N, { t: 0, tucked: false, tuckT: 0, awarded: false, tap: false });
        const d = Home.dina;
        // tuck the walking Dina into bed: on her back, head on the pillow
        d.obj.position.set(SPOTS.bed.x, 0.84, SPOTS.bed.z + 0.38);
        d.obj.rotation.set(-Math.PI / 2, 0, 0);
        d.update(0, {});
        if (rm.quilt) {
            N.quiltY = rm.quilt.position.y; N.quiltS = rm.quilt.scale.z;
            rm.quilt.position.y = N.quiltY + 0.24;
            rm.quilt.scale.z = 0.6;
        }
        // Morgan, tucked in beside her
        N.plush = cloneWithColors(models.dinaMorgan);
        N.plush.scale.setScalar(0.42);
        N.plush.position.set(SPOTS.bed.x + 0.42, 0.68, SPOTS.bed.z - 0.62);
        N.plush.rotation.set(-0.5, -0.4, 0);
        rm.scene.add(N.plush);
        N.zs = [0, 1, 2].map(i => { const s = emojiSprite("Z", 0.16 + i * 0.05, "#FFFFFF"); s.visible = false; rm.scene.add(s); return s; });
        L.show();
        bindPointer({ down: () => { if (ctx.state === "dinaNap") N.tap = true; } });
    },
    exit() {
        const rm = room();
        unbindPointer();
        rm.night(0);
        if (rm.quilt) { rm.quilt.position.y = N.quiltY; rm.quilt.scale.z = N.quiltS; }
        if (N.plush) { rm.scene.remove(N.plush); N.plush = null; }
        for (const s of N.zs) { rm.scene.remove(s); disposeSprite(s); }
        N.zs = [];
        const d = Home.dina;
        if (d) d.obj.rotation.set(0, 0, 0);
        L.clear();
    },
    update(dt, P) {
        const rm = room(), d = Home.dina;
        N.t += dt;
        rm.tick(dt, N.t);
        const press = P.confirm || P.interact || P.start || N.tap;
        N.tap = false;
        if (!N.tucked) {
            // Beat 1 — wait for the player to tuck Dina in (or a gentle auto-nudge)
            if (press || N.t > 4) { N.tucked = true; N.tuckT = 0; sfx.tone(523, 0.12, "sine", 0.16, 392); }
        } else {
            // Beat 2 — drifting off; let it breathe ~3.2 s, then wake
            N.tuckT += dt;
            if (N.tuckT > 3.2 && (press || N.tuckT > 4.5)) { setState("dinaHome", { from: "nap" }); return; }
        }
        const k = N.tucked ? clamp(N.tuckT / 3.2, 0, 1) : 0;
        rm.night(k);
        // quilt up to her chin once tucked; gentle breathing
        if (rm.quilt) {
            const want = N.tucked ? 1.04 : 0.6;
            rm.quilt.scale.z += (want - rm.quilt.scale.z) * Math.min(1, dt * 4);
            const breath = Math.sin(N.t * (N.tucked ? 1.6 : 2.4)) * (N.tucked ? 0.012 : 0.008);
            rm.quilt.position.y = N.quiltY + 0.24 + breath;
        }
        d.update(dt, { sit: false });
        // award once she's actually rested
        if (N.tucked && k >= 1 && !N.awarded) { N.awarded = true; wallet.add(1); emit("stat", { id: "dinaNaps", n: 1 }); sfx.sparkle(); }
        // floating Z's
        N.zs.forEach((s, i) => {
            const zt = (N.tuckT + i * 0.5) % 2;
            s.visible = N.tucked;
            s.material.opacity = Math.max(0, (1 - zt / 2) * Math.min(1, N.tuckT));
            s.position.set(HEAD.x - 0.25 - i * 0.18, HEAD.y + 0.3 + zt * 0.45, HEAD.z + 0.1);
        });
        // words (2D text)
        const tapTxt = isTouch() ? "👆 Tap" : g("confirm");
        if (!N.tucked) L.prompt(`<div>Dina's so tired...</div><div class="big gold">${tapTxt} to tuck her in</div>`);
        else if (k > 0.7) L.prompt(`<div>Sweet dreams, Dina 💤</div><div class="big gold">💤 RESTED! +1 💰</div><div>${tapTxt} to wake up</div>`);
        else L.prompt(`<div>Sweet dreams, Dina 💤</div>`);
        // camera: from the foot of the bed, a little above
        const cam = rm.set.camera, portrait = cam.aspect < 1;
        cam.position.set(SPOTS.bed.x - (portrait ? 1.6 : 1.9), portrait ? 2.9 : 2.2, SPOTS.bed.z + (portrait ? 3.2 : 2.5));
        cam.lookAt(SPOTS.bed.x - 0.1, 0.75, SPOTS.bed.z - 0.45);
        cam.fov = portrait ? 60 : 48; cam.updateProjectionMatrix();
    },
});
