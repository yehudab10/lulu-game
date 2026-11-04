// Lulu's car: arcade driving physics + all the visual juice (body roll and
// pitch, spinning/steering wheels, a steering wheel that turns, skid marks,
// dust and drift smoke, nitro flames).
import * as THREE from "three";
import { models, cloneWithColors, findNodes } from "./models.js";

// Same skins (and handling stats) as the 2D game's shop, so the car you
// picked there is the car you drive here.
export const SKINS = {
    pink:   { name: "Classic Pink", body: "#E91E63", light: "#F48FB1", dark: "#AD1457", top: 1.00, acc: 1.00, grip: 1.00, brake: 1.00 },
    purple: { name: "Royal Purple", body: "#9C27B0", light: "#CE93D8", dark: "#6A1B9A", top: 1.05, acc: 1.05, grip: 1.05, brake: 1.05 },
    orange: { name: "Sunset Glow",  body: "#FF9800", light: "#FFCC80", dark: "#E65100", top: 1.10, acc: 1.30, grip: 0.85, brake: 0.90 },
    blue:   { name: "Ocean Blue",   body: "#2196F3", light: "#81D4FA", dark: "#0D47A1", top: 0.95, acc: 0.90, grip: 1.10, brake: 1.25 },
    green:  { name: "Lime Zest",    body: "#8BC34A", light: "#C5E1A5", dark: "#558B2F", top: 0.90, acc: 1.00, grip: 1.35, brake: 1.10 },
    red:    { name: "Racing Red",   body: "#F44336", light: "#FFCDD2", dark: "#B71C1C", top: 1.25, acc: 1.15, grip: 0.85, brake: 0.85 },
    gold:   { name: "Golden Lux",   body: "#FFC107", light: "#FFE082", dark: "#FF6F00", top: 1.30, acc: 0.90, grip: 0.90, brake: 1.05 },
    ninja:  { name: "Black Ninja",  body: "#212121", light: "#616161", dark: "#000000", top: 1.18, acc: 1.15, grip: 1.18, brake: 1.15 },
};

/** The skin selected in the 2D game (same origin → same localStorage). */
export function skinFrom2D() {
    try {
        const s = JSON.parse(localStorage.getItem("luluSaveV2") || "null");
        if (s && SKINS[s.selectedSkin]) return s.selectedSkin;
    } catch (e) { /* no 2D save yet */ }
    return "pink";
}

const WHEEL_R = 0.34;
const WHEELBASE = 2.56;
export const CAR_CIRCLES = [1.15, -1.15]; // collision circles along the car's length
export const CAR_RADIUS = 0.93;
export const CAR_HALF_W = 0.9;

export class PlayerCar {
    constructor(scene, skinKey) {
        this.scene = scene;
        this.obj = new THREE.Group();
        this.tilt = new THREE.Group();
        this.obj.add(this.tilt);
        scene.add(this.obj);
        this.setSkin(skinKey);

        // physics state
        this.pos = new THREE.Vector3();
        this.h = 0;            // heading (0 = +Z)
        this.vx = 0; this.vz = 0;
        this.vF = 0; this.vR = 0;
        this.spin = 0;         // extra yaw rate from impacts
        this.steerVal = 0;
        this.slip = 0;
        this.accelLong = 0; this.latAcc = 0;
        this.pitch = 0; this.roll = 0; this.bump = 0;
        this.offroad = 0;
        this.boosting = false;
        this.blink = 0;

        this.skids = new SkidMarks(scene);
        this.fx = new Particles(scene);
        this.flames = makeFlames();
        this.tilt.add(this.flames);
    }

    setSkin(key) {
        if (this.model) this.tilt.remove(this.model);
        this.skinKey = SKINS[key] ? key : "pink";
        const sk = SKINS[this.skinKey];
        this.stats = sk;
        this.model = cloneWithColors(models.lulu, { Body: sk.body, BodyLight: sk.light, BodyDark: sk.dark });
        this.tilt.add(this.model);
        this.wheels = findNodes(this.model, "Wheel_").map(w => {
            w.rotation.order = "YXZ";
            return { obj: w, front: /Wheel_F/.test(w.name), roll: 0 };
        });
        this.steeringWheel = findNodes(this.model, "SteeringWheel")[0] || null;
        this.swBase = this.steeringWheel ? this.steeringWheel.quaternion.clone() : null;
        this.taillights = [];
        this.model.traverse(o => {
            if (o.isMesh && o.material.name === "Taillight") {
                o.material = o.material.clone();
                this.taillights.push(o.material);
            }
        });
        // Attachment points (Blender empties "Anchor_*"): hood, deck, front, rear,
        // head (Lulu's head — hats), dash, passenger, mirrorL, mirrorR.
        this.anchors = {};
        this.model.traverse(o => { if (o.name && o.name.startsWith("Anchor_")) this.anchors[o.name.slice(7).replace(/\d+$/, "")] = o; });
        this.driver = findNodes(this.model, "Driver")[0] || null;
        this.hairs = findNodes(this.model, "Hair_");
        // per-car hair material so the salon can recolour it
        this.hairMats = [];
        for (const h of this.hairs) h.traverse(o => {
            if (o.isMesh && o.material.name === "Hair") { o.material = o.material.clone(); this.hairMats.push(o.material); }
        });
        if (this.hairColor) this.setHair(this.hairColor, this.hairStyle);
        for (const [slot, obj] of Object.entries(this.attached || {})) if (obj) this.attach(slot, obj);
    }

    /** Recolour Lulu's hair and (optionally) pick a style ("sheitel" or any Hair_<style> in the model). */
    setHair(color, style) {
        this.hairColor = color;
        if (color) for (const m of this.hairMats) m.color.set(color);
        if (style) {
            this.hairStyle = style;
            const has = this.hairs.some(h => h.name.startsWith("Hair_" + style));
            for (const h of this.hairs) h.visible = has ? h.name.startsWith("Hair_" + style) : h.name.startsWith("Hair_sheitel");
        }
    }

    /** Show / hide Lulu in the driver's seat (she's out of the car on foot). */
    showDriver(on) {
        if (this.driver) this.driver.visible = on;
        for (const h of this.hairs) h.visible = on && (h.name.startsWith("Hair_" + (this.hairStyle || "sheitel")) ||
            (!this.hairs.some(x => x.name.startsWith("Hair_" + this.hairStyle)) && h.name.startsWith("Hair_sheitel")));
        if (this.attached && this.attached.head) this.attached.head.visible = on;
    }

    /**
     * Attach an object to an anchor slot (replacing what was there). Survives skin changes.
     *   car.attach("deck", unicornHorn);  car.attach("deck", null) removes it.
     */
    attach(slot, obj) {
        this.attached = this.attached || {};
        const prev = this.attached[slot];
        if (prev && prev !== obj && prev.parent) prev.parent.remove(prev);
        this.attached[slot] = obj;
        const a = this.anchors && this.anchors[slot];
        if (obj && a) a.add(obj);
    }

    place(x, z, h) {
        this.pos.set(x, 0, z);
        this.h = h;
        this.vx = this.vz = this.vF = this.vR = this.spin = 0;
        this.steerVal = 0;
        this.skids.clear();
        this.syncObject();
    }

    get speed() { return Math.hypot(this.vx, this.vz); }
    forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.h), 0, Math.cos(this.h)); }

    /**
     * One physics step.
     * ctl: {steer -1..1, throttle 0..1, brake 0..1, handbrake bool, boost bool, analog bool}
     * env: {offroad 0..1, shoulder bool}
     */
    step(dt, ctl, env) {
        const st = this.stats;
        const fx = Math.sin(this.h), fz = Math.cos(this.h);
        const rx = -Math.cos(this.h), rz = Math.sin(this.h);
        let vF = this.vx * fx + this.vz * fz;
        let vR = this.vx * rx + this.vz * rz;
        const off = env.offroad;

        // ── longitudinal ──
        const top = 42 * st.top * (this.boosting ? 1.32 : 1) * (1 - off * 0.45);
        let a = 0;
        if (ctl.throttle > 0.02 && vF > -0.5) {
            const k = Math.max(0, 1 - Math.pow(Math.max(0, vF) / top, 2));
            a += 12.5 * st.acc * ctl.throttle * k + (this.boosting ? 9 : 0);
        } else if (this.boosting) {
            a += 9;
        }
        if (ctl.brake > 0.02) {
            if (vF > 0.6) a -= 26 * st.brake * ctl.brake;
            else if (vF > -9) a -= 7 * ctl.brake;          // reverse
        }
        // drag: rolling + air + engine braking + grass
        let drag = 0.35 + 0.0016 * vF * vF + (ctl.throttle < 0.05 ? 1.4 : 0) + off * 4.5 * Math.min(1, Math.abs(vF) / 8);
        if (ctl.handbrake) drag += 3.5;
        const prevVF = vF;
        vF += a * dt;
        if (Math.abs(vF) > 0.01) {
            const dv = drag * dt;
            vF = Math.abs(vF) <= dv && a === 0 ? 0 : vF - Math.sign(vF) * Math.min(dv, Math.abs(vF));
        }
        if (vF > top) vF -= (vF - top) * Math.min(1, 1.8 * dt);
        this.accelLong = (vF - prevVF) / dt;

        // ── steering ──
        const target = ctl.steer;
        const rate = ctl.analog ? 9 : (Math.abs(target) > Math.abs(this.steerVal) ? 3.2 : 6);
        this.steerVal += Math.max(-rate * dt, Math.min(rate * dt, target - this.steerVal));
        const maxAngle = 0.62 / (1 + Math.abs(vF) / 13);
        const delta = this.steerVal * maxAngle;
        let yaw = vF * Math.tan(delta) / WHEELBASE;          // + = turning right
        const latMax = 13.5 * st.grip * (ctl.handbrake ? 1.45 : 1) * (1 - off * 0.25);
        const lim = latMax / Math.max(Math.abs(vF), 3);
        yaw = Math.max(-lim, Math.min(lim, yaw));
        if (ctl.handbrake && Math.abs(vF) > 6) yaw *= 1.35;

        // ── lateral grip ──
        const grip = (ctl.handbrake ? 1.4 : 9.5 - off * 4) * st.grip;
        vR *= Math.exp(-grip * dt);
        this.slip = Math.min(1, Math.abs(vR) / 6 + (ctl.handbrake && Math.abs(vF) > 5 ? 0.35 : 0) +
            (ctl.brake > 0.8 && vF > 15 ? 0.25 : 0));
        this.vF = vF; this.vR = vR;
        this.vx = fx * vF + rx * vR;
        this.vz = fz * vF + rz * vR;

        this.latAcc = vF * yaw;
        this.h -= (yaw + this.spin) * dt;
        this.spin *= Math.exp(-3 * dt);
        this.pos.x += this.vx * dt;
        this.pos.z += this.vz * dt;
        this.offroad = off;
    }

    /** Push the car out of a static circle. Returns impact speed (m/s) or 0. */
    collideStatic(cx, cz, r) {
        let impact = 0;
        const fx = Math.sin(this.h), fz = Math.cos(this.h);
        for (const o of CAR_CIRCLES) {
            const px = this.pos.x + fx * o, pz = this.pos.z + fz * o;
            const dx = px - cx, dz = pz - cz;
            const rr = r + CAR_RADIUS;
            const d2 = dx * dx + dz * dz;
            if (d2 >= rr * rr || d2 < 1e-6) continue;
            const d = Math.sqrt(d2);
            const nx = dx / d, nz = dz / d;
            const pen = rr - d;
            this.pos.x += nx * pen; this.pos.z += nz * pen;
            const vn = this.vx * nx + this.vz * nz;
            if (vn < 0) {
                this.vx -= 1.35 * vn * nx;
                this.vz -= 1.35 * vn * nz;
                impact = Math.max(impact, -vn);
                // spin away from the hit, more for a front/back corner hit
                const side = (nx * -Math.cos(this.h) + nz * Math.sin(this.h));
                this.spin += side * Math.sign(o) * -vn * 0.07;
            }
        }
        return impact;
    }

    applyImpulse(ix, iz, spin) {
        this.vx += ix; this.vz += iz;
        this.spin += spin;
    }

    syncObject() {
        this.obj.position.copy(this.pos);
        this.obj.rotation.y = this.h;
    }

    updateVisual(dt, time, ctl, invincible) {
        this.syncObject();
        // suspension feel
        const tp = THREE.MathUtils.clamp(-this.accelLong * 0.0035, -0.06, 0.05);
        const tr = THREE.MathUtils.clamp(-this.latAcc * 0.0042, -0.07, 0.07);
        this.pitch += (tp - this.pitch) * Math.min(1, dt * 6);
        this.roll += (tr - this.roll) * Math.min(1, dt * 6);
        const sp = this.speed;
        const bumpAmp = this.offroad > 0 ? 0.05 * Math.min(1, sp / 15) : 0.004 * Math.min(1, sp / 30);
        this.bump = Math.sin(time * 31) * Math.sin(time * 17.3) * bumpAmp;
        this.tilt.rotation.set(this.pitch + this.bump * 0.6, 0, this.roll);
        this.tilt.position.y = this.bump;

        for (const w of this.wheels) {
            w.roll += this.vF * dt / WHEEL_R;
            w.obj.rotation.x = w.roll;
            if (w.front) w.obj.rotation.y = -this.steerVal * 0.5 / (1 + this.speed / 25);
        }
        if (this.steeringWheel) {
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.steerVal * 1.6);
            this.steeringWheel.quaternion.copy(this.swBase).multiply(q);
        }
        const braking = ctl.brake > 0.1 && this.vF > 0.5;
        for (const m of this.taillights) m.emissiveIntensity = braking ? 4.5 : 1.2;

        this.obj.visible = !invincible || Math.floor(time * 12) % 2 === 0;

        // nitro flames
        this.flames.visible = this.boosting;
        if (this.boosting) {
            const f = 0.75 + Math.random() * 0.5;
            this.flames.children.forEach(c => c.scale.set(0.55 * f, 0.55 * f, 1));
        }

        // skid marks + smoke + dust
        const fx = Math.sin(this.h), fz = Math.cos(this.h);
        const rx = -Math.cos(this.h), rz = Math.sin(this.h);
        const skidding = this.slip > 0.32 && sp > 4 && this.offroad < 0.5;
        for (const side of [-1, 1]) {
            const wx = this.pos.x - fx * 1.28 + rx * side * 0.8;
            const wz = this.pos.z - fz * 1.28 + rz * side * 0.8;
            this.skids.track(side > 0 ? 1 : 0, wx, wz, rx, rz, skidding);
            if (skidding && Math.random() < 0.5) this.fx.emit(wx, 0.25, wz, this.vx * 0.2, 0.8, this.vz * 0.2, 1.4, 0.9, [0.92, 0.92, 0.95]);
            if (this.offroad > 0.3 && sp > 5 && Math.random() < 0.6) {
                this.fx.emit(wx, 0.2, wz, -this.vx * 0.05 + (Math.random() - 0.5) * 2, 1.4, -this.vz * 0.05, 1.6, 1.1, [0.72, 0.62, 0.45]);
            }
        }
        this.fx.update(dt);
    }
}

// ── skid marks: a ring buffer of thin dark quads on the road ─────────────
class SkidMarks {
    constructor(scene) {
        this.max = 600;
        this.pos = new Float32Array(this.max * 6 * 3);
        this.geo = new THREE.BufferGeometry();
        this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({
            color: 0x1a1a1a, transparent: true, opacity: 0.38, depthWrite: false,
            polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
        }));
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 1;
        scene.add(this.mesh);
        this.n = 0;
        this.last = [null, null];
    }
    clear() { this.pos.fill(0); this.geo.attributes.position.needsUpdate = true; this.last = [null, null]; }
    track(i, x, z, rx, rz, on) {
        if (!on) { this.last[i] = null; return; }
        const w = 0.13, y = 0.045;
        const cur = { x, z, rx, rz };
        const L = this.last[i];
        this.last[i] = cur;
        if (!L) return;
        if ((x - L.x) ** 2 + (z - L.z) ** 2 < 0.25) { this.last[i] = L; return; }
        const k = (this.n % this.max) * 18;
        const a = [L.x - L.rx * w, y, L.z - L.rz * w], b = [L.x + L.rx * w, y, L.z + L.rz * w];
        const c = [x - rx * w, y, z - rz * w], d = [x + rx * w, y, z + rz * w];
        this.pos.set([...a, ...c, ...b, ...b, ...c, ...d], k);
        this.n++;
        this.geo.attributes.position.needsUpdate = true;
    }
}

// ── soft particles (smoke, dust, sparkles) ─────────────────────────────
function softDot() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.5, "rgba(255,255,255,0.5)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
}
const DOT = softDot();

export class Particles {
    constructor(scene, max = 260) {
        this.max = max;
        this.p = new Float32Array(max * 3);
        this.v = new Float32Array(max * 3);
        this.col = new Float32Array(max * 3);
        this.size = new Float32Array(max);
        this.alpha = new Float32Array(max);
        this.life = new Float32Array(max);
        this.maxLife = new Float32Array(max);
        this.grow = new Float32Array(max);
        this.i = 0;
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute("color", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
        this.geo = g;
        const mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false,
            uniforms: { map: { value: DOT }, scale: { value: 420 } },
            vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 color;
                varying float vA; varying vec3 vC;
                uniform float scale;
                void main() { vA = aAlpha; vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0);
                  gl_PointSize = aSize * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
            fragmentShader: `uniform sampler2D map; varying float vA; varying vec3 vC;
                void main() { vec4 t = texture2D(map, gl_PointCoord); if (t.a * vA < 0.01) discard; gl_FragColor = vec4(vC, t.a * vA); }`,
        });
        this.points = new THREE.Points(g, mat);
        this.points.frustumCulled = false;
        scene.add(this.points);
    }
    emit(x, y, z, vx, vy, vz, size, life, color) {
        const i = this.i++ % this.max;
        this.p.set([x, y, z], i * 3);
        this.v.set([vx, vy, vz], i * 3);
        this.col.set(color, i * 3);
        this.size[i] = size;
        this.grow[i] = size * 1.4;
        this.life[i] = this.maxLife[i] = life;
    }
    burst(x, y, z, n, speed, color, size = 0.9, life = 0.9) {
        for (let k = 0; k < n; k++) {
            const a = Math.random() * Math.PI * 2, u = Math.random();
            this.emit(x, y, z, Math.cos(a) * speed * u, speed * (0.4 + Math.random()), Math.sin(a) * speed * u, size, life * (0.6 + Math.random() * 0.6), color);
        }
    }
    update(dt) {
        for (let i = 0; i < this.max; i++) {
            if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
            this.life[i] -= dt;
            const t = Math.max(0, this.life[i] / this.maxLife[i]);
            this.p[i * 3] += this.v[i * 3] * dt;
            this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
            this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
            this.v[i * 3 + 1] -= 1.5 * dt;
            this.size[i] += this.grow[i] * dt;
            this.alpha[i] = t * 0.55;
        }
        const a = this.geo.attributes;
        a.position.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = a.color.needsUpdate = true;
    }
}

function makeFlames() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, "rgba(255,255,230,1)");
    grd.addColorStop(0.35, "rgba(255,170,40,0.9)");
    grd.addColorStop(1, "rgba(255,40,80,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    const grp = new THREE.Group();
    for (const x of [-0.42, 0.42]) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        s.position.set(x, 0.45, -2.25);
        grp.add(s);
    }
    grp.visible = false;
    return grp;
}
