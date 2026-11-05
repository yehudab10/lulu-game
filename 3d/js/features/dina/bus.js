// The school-bus intro (2D: dinaBus). The Lev Bais Yaakov bus pulls up with
// its lights flashing, the door hisses open, the STOP arm swings out, the
// bell rings and six girls hop off… then Dina. "Where's mom?" … "Hmph! I'll
// walk!" — the bus drives off down the street and the camera swings in behind
// her: the run home starts right there. ✕ / tap skips.
import * as THREE from "three";
import { ctx, registerState, setState } from "../../core/ctx.js";
import { spawnPerson } from "../../core/people.js";
import * as A from "../../audio.js";
import { street, cast, camTo, BUS_STOP_Z } from "./street.js";
import { L, bubble, bubblesDone, sfx, rand, randPick, rnd, clamp, lerp, node, ownMaterials, poseLimb, attach, prop, g, isTouch, models } from "./common.js";
import { cloneWithColors } from "../../models.js";

const GIRLS = [  // 2D: hairStyle ["pony","loose","bun","loose","pony","bun"], hairColor by g % 4
    ["dinaGirlPony", "#3E2723"], ["dinaGirlLong", "#5D4037"], ["dinaGirlBun", "#6D4C41"],
    ["dinaGirlLong", "#3E2723"], ["dinaGirlPony", "#5D4037"], ["dinaGirlBun", "#6D4C41"],
];
const BUS_X = 4.6;
const B = { t: 0, phase: 0, bus: null, girls: [], lights: null, v: 0, door: null, arm: null, wheels: [], exhaust: null, step: null, puffT: 0, skipEl: null };
const _p = new THREE.Vector3(), _l = new THREE.Vector3(), _w = new THREE.Vector3();

function setupBus(st) {
    const bus = cloneWithColors(models.dinaBus);
    B.lights = ownMaterials(bus, ["LightRed", "NeonAmber"]);
    B.door = node(bus, "Door");
    B.arm = node(bus, "StopArm");
    B.wheels = ["Wheel_FL", "Wheel_FR", "Wheel_RL", "Wheel_RR"].map(n => node(bus, n)).filter(Boolean);
    B.exhaust = node(bus, "Exhaust");
    B.step = node(bus, "DoorStep");
    bus.position.set(BUS_X, 0, -40);
    st.scene.add(bus);
    B.bus = bus;
    B.girls = GIRLS.map(([key, hair], i) => {
        const p = spawnPerson(key, { colors: { Hair: hair } });
        attach(p, "Body", prop("dinaProps", "Backpack", { PackNavy: "#212121", PackPocket: "#37474F" }), 0, 0.8, -0.17);
        p.obj.visible = false;
        st.scene.add(p.obj);
        return { p, spawn: 2.1 + i * 0.3, onBus: true, t: 0, dir: i % 2 ? 1 : -1, speed: rand(1.1, 1.6), tx: rand(-0.9, 0.9), hopT: 0 };
    });
}

function doorStepWorld(out) {
    B.bus.updateMatrixWorld(true);
    return B.step ? B.step.getWorldPosition(out) : out.set(BUS_X - 1.6, 0, B.bus.position.z + 2.8);
}

registerState("dinaBus", {
    hud: false, touch: false, pausable: false, world: false,
    enter() {
        const st = cast();
        st.set.show();
        st.cam.snap = true;
        setupBus(st);
        B.t = 0; B.phase = 0; B.v = 0; B.puffT = 0; B.hissed = false; B.tapped = false;
        const d = st.dina;
        d.obj.visible = false;
        d.obj.position.set(0, 0, 0);
        d.obj.rotation.set(0, 0, 0);
        st.mom.obj.visible = false;
        st.face = "happy";
        L.show();
        B.skipEl = L.add(`<span>${isTouch() ? "Tap" : g("confirm")} Skip ▶</span>`, "dl-skip");
        A.setMusic("../dina.mp3");
        document.body.classList.add("dina-bus");
    },
    exit() {
        const st = street();
        if (B.bus) { st.scene.remove(B.bus); B.bus = null; }
        for (const gi of B.girls) st.scene.remove(gi.p.obj);
        B.girls = [];
        L.clear();
        document.body.classList.remove("dina-bus");
    },
    update(dt, P) {
        const st = street(), d = st.dina, bus = B.bus;
        B.t += dt;
        const t = B.t;
        st.fx.update(dt);
        // Phase 0: the bus drives in (0–1.2 s), easing to a stop at the curb
        if (B.phase === 0) {
            const k = Math.min(t / 1.2, 1);
            bus.position.z = lerp(-40, BUS_STOP_Z, 1 - (1 - k) * (1 - k));
            B.v = 38 * (1 - k) * 2 / 1.2 * 0.5;
            if (t > 1.2) { B.phase = 1; B.v = 0; }
        }
        // Phase 1: doors hiss open, the STOP arm swings out (1.2–1.7 s)
        let open = 0;
        if (B.phase === 1) {
            if (!B.hissed) { B.hissed = true; sfx.doorHiss(); }
            open = Math.min((t - 1.2) / 0.5, 1);
            if (t > 1.7) { B.phase = 2; sfx.schoolBell(); }
        }
        if (B.phase >= 2 && B.phase < 6) open = 1;
        // Phase 2: the girls come off (1.7–4.5 s)
        if (B.phase >= 2) updateGirls(dt, st);
        if (B.phase === 2 && t > 4.5) {
            B.phase = 3;
            doorStepWorld(_w);
            d.obj.position.set(_w.x, 0, _w.z);
            d.obj.visible = true;
            d.hopT = 0.35;
        }
        // Phase 3: Dina hops down and walks to the middle of the sidewalk (4.5–6.0 s)
        let walking = 0;
        if (B.phase === 3) {
            const dx = 0 - d.obj.position.x, dz = 0 - d.obj.position.z, dist = Math.hypot(dx, dz);
            if (dist > 0.05) {
                const sp = Math.min(dist / dt, 2.1);
                d.obj.position.x += dx / dist * sp * dt; d.obj.position.z += dz / dist * sp * dt;
                d.face(d.obj.position.x + dx, d.obj.position.z + dz, dt, 10);
                walking = sp;
            } else if (t > 6.0) B.phase = 4;
        }
        if (B.phase >= 3 && B.phase <= 5 && walking === 0) d.face(0.4, 3, dt, 6);   // look at the camera
        // Phase 4: "Where's mom?" — looking up and down the street (6.0–7.0 s)
        if (B.phase === 4) {
            d.obj.rotation.y = Math.sin((t - 6) * 5) * 0.7;
            if (t > 7.0) { B.phase = 5; st.face = "determined"; sfx.tone(220, 0.12, "square", 0.15); d.stompT = 0.3; }
        }
        // Phase 5: "Hmph! I'll walk!" (7.0–8.0 s)
        if (B.phase === 5 && t > 8.0) { B.phase = 6; B.v = 0; }
        // Phase 6: the bus drives away down the street; Dina turns for home
        if (B.phase === 6) {
            B.v += 10 * dt;
            bus.position.z += B.v * dt;
            open = Math.max(0, 1 - (t - 8.0) / 0.4);
            d.obj.rotation.y += (0 - d.obj.rotation.y) * Math.min(1, dt * 6);
            B.puffT += dt;
            if (B.puffT > 0.06 && B.exhaust) {
                B.puffT = 0;
                B.exhaust.getWorldPosition(_w);
                st.fx.emit(_w.x, _w.y, _w.z, rand(-0.4, 0.4), rand(0.3, 0.8), -rand(0.5, 1.5), 0.5, rand(0.5, 0.9), randPick(["#9E9E9E", "#BDBDBD", "#757575"]), -0.6);
            }
            if (bus.position.z > 55 || t > 9.6) { setState("dinaRun", { fromBus: true }); return; }
        }
        // door, STOP arm, wheels, flashers, idle bob
        if (B.door) B.door.rotation.y = 1.3 * open;
        if (B.arm) B.arm.rotation.y = -Math.PI / 2 * open;
        for (const w of B.wheels) w.rotation.x += B.v * dt / 0.52;
        const blink = Math.sin(t * 12) > 0;
        const stopped = B.phase >= 1 && B.phase < 6;
        B.lights.LightRed.emissiveIntensity = stopped ? (blink ? 3.2 : 0.25) : 0.2;
        B.lights.NeonAmber.emissiveIntensity = B.phase === 0 ? (blink ? 3 : 0.3) : 0.3;
        bus.position.y = stopped ? Math.sin(t * 6) * 0.012 : 0;
        // Dina's body language
        d.hopT = Math.max(0, (d.hopT || 0) - dt);
        d.stompT = Math.max(0, (d.stompT || 0) - dt);
        d.obj.position.y = d.hopT > 0 ? Math.sin((1 - d.hopT / 0.35) * Math.PI) * 0.3 : d.stompT > 0 ? Math.sin(d.stompT / 0.3 * Math.PI) * 0.08 : 0;
        d.update(dt, { walk: walking });
        if (B.phase === 5) { poseLimb(d, "Arm_L", 0.35, 0.3); poseLimb(d, "Arm_R", 0.35, -0.3); }   // hmph: arms stiff at her sides
        if (B.phase === 6 && t > 8.3) { d.update(0, { point: true }); }                          // …that way!

        // subtitles + thought bubbles (2D timings)
        const head = _p.copy(d.obj.position).add(_l.set(0, 1.45, 0));
        if (t > 2.0 && t < 4.0) L.prompt(`<div class="big gold">🔔 School's out!</div>`);
        else L.prompt("");
        if (t > 6.0 && t < 7.0) bubble("dina", "Where's mom?", head, st.set.camera, "think");
        else if (t > 7.0 && t < 8.0) bubble("dina", "Hmph!\nI'll walk!", head, st.set.camera);
        bubblesDone();
        if (B.skipEl) B.skipEl.style.opacity = String(0.75 + Math.sin(t * 4) * 0.2);

        // camera: wide on the arrival → the door → Dina → behind her for the run
        const dz = d.obj.position.z;
        if (t < 1.7) camTo(_p.set(-5.5, 2.5, 9.5), _l.set(3.8, 1.5, -5), dt, 2.5, 52);
        else if (t < 4.5) camTo(_p.set(-3.0, 1.8, 6.2), _l.set(3.2, 1.25, 0.6), dt, 1.6, 50);
        else if (t < 6.0) camTo(_p.set(-2.4, 1.6, 4.6), _l.copy(d.obj.position).add(_w.set(0.6, 0.85, 0)), dt, 2, 50);
        else if (t < 8.0) camTo(_p.set(0.5, 1.25, 3.0), _l.set(0, 0.95, 0.2), dt, 2.2, 48);
        else camTo(_p.set(d.obj.position.x * 0.55, 2.9, dz - 5.0), _l.set(0, 0.85, dz + 4.5), dt, 2.4, 58);
        st.sunFollow(0, dz);

        if (P.confirm || P.start || P.back || B.tapped) { B.tapped = false; setState("dinaRun", { fromBus: true, skipped: true }); }
    },
});

function updateGirls(dt, st) {
    for (const gi of B.girls) {
        const o = gi.p.obj;
        if (gi.onBus) {
            if (B.t > gi.spawn) {
                gi.onBus = false;
                doorStepWorld(_w);
                o.position.set(_w.x, 0, _w.z);
                o.visible = true;
                gi.hopT = 0.35;
                if (rnd() > 0.5) sfx.tone(rand(500, 900), 0.05, "sine", 0.06);   // a little chatter
                for (let k = 0; k < 5; k++) st.fx.emit(_w.x + rand(-0.1, 0.1), 0.05, _w.z + rand(-0.1, 0.1), rand(-0.6, 0.6), rand(0.2, 0.7), rand(-0.6, 0.6), 0.16, rand(0.3, 0.6), randPick(["#D7CBB0", "#C9BCA0", "#E0D6BE"]), 1);
            }
            continue;
        }
        gi.t += dt;
        gi.hopT = Math.max(0, gi.hopT - dt);
        o.position.y = gi.hopT > 0 ? Math.sin((1 - gi.hopT / 0.35) * Math.PI) * 0.28 : 0;
        // step off the curb onto the sidewalk, then head off along it
        let tx, tz;
        if (o.position.x > gi.tx + 0.15) { tx = gi.tx; tz = o.position.z + gi.dir * 1.2; }
        else { tx = gi.tx; tz = o.position.z + gi.dir * 4; }
        const dx = tx - o.position.x, dz = tz - o.position.z, dd = Math.hypot(dx, dz) || 1;
        o.position.x += dx / dd * gi.speed * dt;
        o.position.z += dz / dd * gi.speed * dt;
        gi.p.face(o.position.x + dx, o.position.z + dz, dt, 8);
        gi.p.update(dt, { walk: gi.speed, talk: gi.t < 1.5 });
        if (Math.abs(o.position.z) > 30) o.visible = false;
    }
}

/** Tap anywhere skips (the canvas pointer handler in index.js sets this). */
export function busTapped() { B.tapped = true; }
