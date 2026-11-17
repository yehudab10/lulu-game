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
 * A ride along a Path with a time-based speed profile:
 *   new Ride(path, { reverse, profile: "inout", dur })   ease in + out over `dur` s (backing out)
 *   new Ride(path, { profile: "accel", v1 })             from rest to v1 m/s (pulling away; dur = 2L/v1)
 *   new Ride(path, { profile: "decel", v0 })             from v0 m/s to a stop (parking; dur = 2L/v0)
 * step(dt) poses ctx.car; `done` once the end is reached. finish() jumps to the end.
 */
export class Ride {
    constructor(path, { reverse = false, profile = "inout", dur = 2, v0 = 10, v1 = 10 } = {}) {
        const L = path.length;
        Object.assign(this, { path, reverse, profile, t: 0, m: 0, v: 0, done: false, prevH: null });
        this.dur = profile === "accel" ? 2 * L / Math.max(0.5, v1) : profile === "decel" ? 2 * L / Math.max(0.5, v0) : Math.max(0.2, dur);
        this.pt = {};
    }
    /** Distance + speed at time t. */
    profileAt(t) {
        const L = this.path.length, T = this.dur, k = Math.max(0, Math.min(1, t / T));
        if (this.profile === "accel") return [L * k * k, 2 * L * k / T];
        if (this.profile === "decel") return [L * (1 - (1 - k) * (1 - k)), 2 * L * (1 - k) / T];
        return [L * k * k * (3 - 2 * k), 6 * L * k * (1 - k) / T];
    }
    finish(car = ctx.car) { this.t = this.dur - 1 / 120; return this.step(1 / 120, car); }
    /** Advance and pose `car` (default ctx.car). Returns true once finished. */
    step(dt, car = ctx.car) {
        const prevV = this.v;
        this.t = Math.min(this.dur, this.t + dt);
        [this.m, this.v] = this.profileAt(this.t);
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
        const steer = Math.abs(vF) > 0.3 ? Math.max(-1, Math.min(1, yaw / vF * 4.2)) : 0;
        car.steerVal += (steer - car.steerVal) * Math.min(1, dt * 8);
        car.updateVisual(dt, ctx.time, { steer, throttle: 0.4, brake: this.profile === "decel" ? 0.3 : 0, handbrake: false }, false);
        const road = ctx.world.road.nearest(car.pos.x, car.pos.z, car.s, this.pt);
        car.s = road.s; car.d = road.d;
        this.done = this.t >= this.dur - 1e-6;
        return this.done;
    }
}

/** Ease 0..1 (smoothstep). */
export const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
