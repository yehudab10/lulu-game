// features/world/path.js — smooth scripted paths (Catmull-Rom through control
// points, arc-length parametrised) and a kinematic "drive the car along it"
// helper, so the driveway pull-out / homecoming look exactly the same every
// time (no physics wobble) yet hand the car to the real sim at the right speed.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";

const _p = new THREE.Vector3(), _t = new THREE.Vector3();

export class Path {
    /** pts: [{x, z}] (at least 2). */
    constructor(pts) {
        const v = pts.map(p => new THREE.Vector3(p.x, 0, p.z));
        if (v.length === 2) v.splice(1, 0, v[0].clone().lerp(v[1], 0.5));
        this.curve = new THREE.CatmullRomCurve3(v, false, "centripetal");
        this.length = this.curve.getLength();
    }
    /** Position + travel heading at distance m along the path → {x, z, h}. */
    at(m, out = {}) {
        const u = Math.max(0, Math.min(1, m / Math.max(1e-6, this.length)));
        this.curve.getPointAt(u, _p);
        this.curve.getTangentAt(u, _t);
        out.x = _p.x; out.z = _p.z; out.h = Math.atan2(_t.x, _t.z);
        return out;
    }
}

const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

/**
 * A ride along a Path with an eased speed profile.
 *   new Ride(path, { reverse, v0, v1, dur })  → step(dt) moves ctx.car; done when m ≥ length.
 * Speed goes v0 → v1 linearly over the length (m/s); the time it takes follows from that.
 */
export class Ride {
    constructor(path, { reverse = false, v0 = 0, v1 = 8, vMin = 1.5 } = {}) {
        Object.assign(this, { path, reverse, v0, v1, vMin, m: 0, v: v0, done: false, prevH: null });
        this.pt = {};
    }
    speedAt(m) {
        const k = Math.max(0, Math.min(1, m / this.path.length));
        return Math.max(this.vMin, this.v0 + (this.v1 - this.v0) * k);
    }
    /** Advance and pose `car` (default ctx.car). Returns true once finished. */
    step(dt, car = ctx.car) {
        const prevV = this.v;
        this.v = this.speedAt(this.m);
        this.m = Math.min(this.path.length, this.m + this.v * dt);
        const p = this.path.at(this.m, this.pt);
        const h = this.reverse ? wrap(p.h + Math.PI) : p.h;
        const vF = this.reverse ? -this.v : this.v;
        const yaw = this.prevH == null || dt <= 0 ? 0 : wrap(this.prevH - h) / dt;   // + = turning right (car.js)
        this.prevH = h;
        car.pos.set(p.x, 0, p.z);
        car.h = h;
        car.vF = vF; car.vR = 0; car.spin = 0;
        car.vx = Math.sin(h) * vF; car.vz = Math.cos(h) * vF;
        car.accelLong = dt > 0 ? (this.v - prevV) / dt * Math.sign(vF || 1) : 0;
        car.latAcc = vF * yaw;
        const steer = Math.abs(vF) > 0.3 ? Math.max(-1, Math.min(1, yaw / vF * 2.6 * 1.6)) : 0;
        car.steerVal += (steer - car.steerVal) * Math.min(1, dt * 8);
        car.updateVisual(dt, ctx.time, { steer, throttle: 0.4, brake: this.v1 < this.v0 ? 0.3 : 0, handbrake: false }, false);
        this.done = this.m >= this.path.length - 1e-3;
        return this.done;
    }
}

/** Ease 0..1 (smoothstep). */
export const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
