// Traffic: cars in our direction (that Lulu overtakes) and oncoming cars in
// the other two lanes. They follow the road, keep their distance, change lanes
// when you honk at them, flash their lights if you're in their lane head-on, and
// go spinning when you hit them.
import * as THREE from "three";
import { models, cloneWithColors, findNodes } from "./models.js";
import { LANES_OURS, LANES_ONCOMING } from "./world.js";
import { CAR_CIRCLES, CAR_RADIUS, CAR_HALF_W } from "./car.js";

const PAINTS = ["#42A5F5", "#FFFFFF", "#FFCA28", "#66BB6A", "#EF5350", "#8D6E63", "#9E9E9E", "#26C6DA", "#263238", "#FF8A65", "#BA68C8"];
const KINDS = {
    sedan: { len: 4.4, halfW: 0.9, circles: [1.3, -1.3], r: 0.95, mass: 1.2, model: "sedan", paint: true },
    van:   { len: 4.9, halfW: 0.97, circles: [1.5, -1.5], r: 1.0, mass: 1.5, model: "van", paint: true },
    truck: { len: 7.5, halfW: 1.2, circles: [-2.6, 0, 2.6], r: 1.25, mass: 4.0, model: "truck", paint: true },
    cop:   { len: 4.4, halfW: 0.9, circles: [1.3, -1.3], r: 0.95, mass: 1.4, model: "cop", paint: false },
};

/**
 * Add a vehicle kind (Avigail's car, ice-cream truck, school bus, parade float…).
 * spec: { len, halfW, circles: [offsets along length], r, mass, model: <models key>,
 *         paint: bool (random Paint colour) | colors: {MatName: "#hex"} }
 */
export function registerKind(name, spec) { KINDS[name] = Object.assign({ circles: [0], r: 1, mass: 1.2, paint: false }, spec); }
export function kindSpec(name) { return KINDS[name]; }

export class Traffic {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.road = world.road;
        this.cars = [];
        this.tmp = {};
        this.spawnT = 0;
        // Tunables features may change (e.g. a quiet desert leg, a busy Vegas strip).
        this.config = {
            enabled: true,          // random spawning on/off (scripted add() still works)
            ours: 5, oncoming: 3,   // base counts; difficulty adds up to +4 each
            mix: { sedan: 0.58, van: 0.28, truck: 0.14 },
            honkMoves: true,
        };
        this.pool = {};
    }

    clear() {
        for (const c of this.cars) this.release(c);
        this.cars = [];
    }

    remove(c) {
        const i = this.cars.indexOf(c);
        if (i >= 0) { this.cars.splice(i, 1); this.release(c); }
    }

    make(kind) {
        const pool = this.pool[kind] || (this.pool[kind] = []);
        if (pool.length) return pool.pop();
        const spec = KINDS[kind];
        const colors = spec.colors || (spec.paint ? { Paint: PAINTS[Math.floor(Math.random() * PAINTS.length)] } : null);
        const obj = cloneWithColors(models[spec.model || kind], colors);
        const wheels = findNodes(obj, "Wheel_").map(w => { w.rotation.order = "YXZ"; return w; });
        const heads = [];
        obj.traverse(o => { if (o.isMesh && o.material.name === "Headlight") { o.material = o.material.clone(); heads.push(o.material); } });
        return { obj, kind, wheels, heads, spec: KINDS[kind] };
    }

    release(c) {
        this.scene.remove(c.obj);
        if (c.onRemove) { try { c.onRemove(c); } catch (e) { console.error(e); } }
        (this.pool[c.kind] || (this.pool[c.kind] = [])).push({ obj: c.obj, kind: c.kind, wheels: c.wheels, heads: c.heads, spec: c.spec });
    }

    laneFree(s, d, dir, gap) {
        for (const c of this.cars) {
            if (c.hit || c.dir !== dir) continue;
            if (Math.abs(c.d - d) < 2 && Math.abs(c.s - s) < gap) return false;
        }
        return true;
    }

    spawn(playerS, difficulty) {
        const cfg = this.config;
        if (!cfg.enabled) return;
        const ours = this.cars.filter(c => c.dir > 0 && !c.hit && !c.ai && c.s > playerS - 50).length;
        const onc = this.cars.filter(c => c.dir < 0 && !c.hit && !c.ai && c.s > playerS - 50).length;
        const maxOurs = cfg.ours + Math.floor(difficulty * 4);
        const maxOnc = cfg.oncoming + Math.floor(difficulty * 4);
        let r = Math.random() * Object.values(cfg.mix).reduce((a, b) => a + b, 0), kind = "sedan";
        for (const [k, w] of Object.entries(cfg.mix)) { if ((r -= w) <= 0) { kind = k; break; } }
        if (ours < maxOurs && Math.random() < 0.6) {
            const d = LANES_OURS[Math.floor(Math.random() * 2)];
            const s = playerS + 320 + Math.random() * 240;
            if (this.laneFree(s, d, 1, 40)) this.add(kind, s, d, 1, (kind === "truck" ? 14 : 16) + Math.random() * 9);
        } else if (onc < maxOnc) {
            const d = LANES_ONCOMING[Math.floor(Math.random() * 2)];
            const s = playerS + 460 + Math.random() * 140;
            if (this.laneFree(s, d, -1, 45)) this.add(kind, s, d, -1, (kind === "truck" ? 16 : 18) + Math.random() * 8);
        }
    }

    /**
     * Put a car on the road. opts:
     *   ai(dt, car, traffic) — custom driver (chasing cop, Avigail…): set car.s/d/speed/dTarget
     *        yourself (or car.x/z/h with car.free = true for off-road driving) — default lane AI is skipped
     *   data — anything you like (stored as car.data) · onRemove(car) · noNearMiss
     *   immune — crashes don't knock it into a spin (heavy / scripted vehicles)
     */
    add(kind, s, d, dir, speed, opts = {}) {
        const c = this.make(kind);
        Object.assign(c, {
            s, d, dTarget: d, dir, speed, want: speed, base: speed, hit: false, hitT: 0,
            vx: 0, vz: 0, spinV: 0, h: 0, x: 0, z: 0, passed: false, lon: null,
            honked: false, flash: 0, laneCooldown: 0, free: false,
            ai: opts.ai || null, data: opts.data || {}, onRemove: opts.onRemove || null,
            noNearMiss: !!opts.noNearMiss, immune: !!opts.immune, keep: !!opts.keep,
        });
        this.scene.add(c.obj);
        this.place(c, 0);
        this.cars.push(c);
        return c;
    }

    place(c, dt) {
        if (c.free) {   // custom AI drives in world space
            c.obj.position.set(c.x, 0, c.z);
            c.obj.rotation.y = c.h;
            for (const w of c.wheels) w.rotation.x += c.speed * dt / 0.34;
            return;
        }
        const p = this.road.point(c.s, c.d, this.tmp);
        const lane = (c.dTarget - c.d);
        const yawOff = Math.atan2(lane > 0 ? 1.2 : lane < 0 ? -1.2 : 0, Math.max(c.speed, 1)) * (Math.abs(lane) > 0.05 ? 1 : 0);
        c.x = p.x; c.z = p.z;
        // forward along travel; lane drift turns the nose a touch
        c.h = c.dir > 0 ? p.h - yawOff : p.h + Math.PI + yawOff;
        c.obj.position.set(c.x, 0, c.z);
        c.obj.rotation.y = c.h;
        for (const w of c.wheels) w.rotation.x += c.speed * dt / 0.34;
    }

    /** Main update. Returns events: [{type:"nearMiss"}...] */
    update(dt, player, playerS, playerD, difficulty, honked, time) {
        const events = [];
        this.spawnT -= dt;
        if (this.spawnT <= 0) { this.spawn(playerS, difficulty); this.spawnT = 0.35; }

        // honk: the car ahead in Lulu's lane gets out of the way
        if (honked && this.config.honkMoves) {
            let best = null, bestGap = 55;
            for (const c of this.cars) {
                if (c.hit || c.dir < 0 || c.ai) continue;
                const gap = c.s - playerS;
                if (gap > 2 && gap < bestGap && Math.abs(c.d - playerD) < 2.2) { best = c; bestGap = gap; }
            }
            if (best) {
                const other = LANES_OURS.find(l => Math.abs(l - best.dTarget) > 1);
                if (other !== undefined && this.laneFree(best.s, other, 1, 14)) {
                    best.dTarget = other; best.laneCooldown = 4;
                    events.push({ type: "moved" });
                } else {
                    best.want = Math.min(best.want + 6, 30);
                    events.push({ type: "speedup" });
                }
            }
        }

        const fx = Math.sin(player.h), fz = Math.cos(player.h);
        const rx = -Math.cos(player.h), rz = Math.sin(player.h);

        for (const c of this.cars) {
            if (c.hit) {
                // tumbling wreck
                c.hitT += dt;
                c.x += c.vx * dt; c.z += c.vz * dt;
                const damp = Math.exp(-1.6 * dt);
                c.vx *= damp; c.vz *= damp;
                c.spinV *= Math.exp(-2 * dt);
                c.h += c.spinV * dt;
                c.obj.position.set(c.x, 0, c.z);
                c.obj.rotation.y = c.h;
                c.s = this.road.nearest(c.x, c.z, c.s, this.tmp).s;
            } else if (c.ai) {
                try { c.ai(dt, c, this); } catch (e) { console.error("[traffic ai]", e); c.ai = null; }
                this.place(c, dt);
            } else {
                // follow the car ahead in the same lane
                let ahead = null, gap = 1e9;
                for (const o of this.cars) {
                    if (o === c || o.dir !== c.dir || Math.abs(o.d - c.d) > 2.2) continue;
                    const g = (o.s - c.s) * c.dir;
                    if (g > 0 && g < gap) { gap = g; ahead = o; }
                }
                let target = c.want;
                if (ahead && gap < 26) {
                    target = Math.min(target, ahead.hit ? 0 : ahead.speed - 1.5);
                    // try to pass a slow / wrecked car
                    if (c.laneCooldown <= 0 && gap < 22) {
                        const lanes = c.dir > 0 ? LANES_OURS : LANES_ONCOMING;
                        const other = lanes.find(l => Math.abs(l - c.dTarget) > 1);
                        if (this.laneFree(c.s, other, c.dir, 16)) { c.dTarget = other; c.laneCooldown = 5; }
                    }
                }
                if (ahead && gap < 9) target = 0;
                c.laneCooldown -= dt;
                c.speed += Math.max(-14 * dt, Math.min(5 * dt, target - c.speed));
                c.speed = Math.max(0, c.speed);
                c.want += (c.base - c.want) * Math.min(1, dt * 0.25); // honk boosts fade
                const ds = c.dTarget - c.d;
                c.d += Math.sign(ds) * Math.min(Math.abs(ds), 1.7 * dt);
                c.s += c.speed * c.dir * dt;
                this.place(c, dt);

                // oncoming car sees Lulu in its lane: flash the brights and honk
                if (c.dir < 0) {
                    const dist = c.s - playerS;
                    const inLane = Math.abs(playerD - c.d) < 2.4;
                    if (inLane && dist > 10 && dist < 90) {
                        c.flash = 1;
                        if (!c.honked && dist < 75) { c.honked = true; events.push({ type: "oncomingHonk", dist }); }
                    } else c.flash = Math.max(0, c.flash - dt * 2);
                    for (const m of c.heads) m.emissiveIntensity = 2 + c.flash * (Math.sin(time * 30) > 0 ? 10 : 2);
                }
            }

            // ── collision with Lulu ──
            const res = this.collide(c, player);
            if (res) events.push(res);

            // ── near miss ──
            if (!c.hit && !c.passed && !c.noNearMiss) {
                const dx = c.x - player.pos.x, dz = c.z - player.pos.z;
                const lon = dx * fx + dz * fz;
                const lat = dx * rx + dz * rz;
                if (c.lon !== null && c.lon > 0 && lon <= 0 && Math.abs(lon) < 8) {
                    const clearance = Math.abs(lat) - c.spec.halfW - CAR_HALF_W;
                    if (clearance < 1.15 && clearance > -0.2 && player.speed > 17) {
                        events.push({ type: "nearMiss", oncoming: c.dir < 0, clearance });
                    }
                    c.passed = true;
                }
                c.lon = lon;
            }
        }

        // recycle
        for (let i = this.cars.length - 1; i >= 0; i--) {
            const c = this.cars[i];
            const rel = c.s - playerS;
            if (!c.keep && (rel < -160 || rel > 900 || (c.hit && c.hitT > 12 && rel < -40))) {
                this.release(c);
                this.cars.splice(i, 1);
            }
        }
        return events;
    }

    collide(c, player) {
        const ph = player.h;
        const pfx = Math.sin(ph), pfz = Math.cos(ph);
        const cfx = Math.sin(c.h), cfz = Math.cos(c.h);
        // quick reject
        const dx0 = c.x - player.pos.x, dz0 = c.z - player.pos.z;
        if (dx0 * dx0 + dz0 * dz0 > 100) return null;
        const cvx = c.hit ? c.vx : cfx * c.speed;
        const cvz = c.hit ? c.vz : cfz * c.speed;
        let best = null;
        for (const po of CAR_CIRCLES) {
            const px = player.pos.x + pfx * po, pz = player.pos.z + pfz * po;
            for (const co of c.spec.circles) {
                const qx = c.x + cfx * co, qz = c.z + cfz * co;
                const dx = px - qx, dz = pz - qz;
                const rr = CAR_RADIUS + c.spec.r;
                const d2 = dx * dx + dz * dz;
                if (d2 < rr * rr && d2 > 1e-6) {
                    const d = Math.sqrt(d2);
                    if (!best || rr - d > best.pen) best = { nx: dx / d, nz: dz / d, pen: rr - d, po };
                }
            }
        }
        if (!best) return null;
        const { nx, nz, pen } = best;
        const vrx = player.vx - cvx, vrz = player.vz - cvz;
        const vn = vrx * nx + vrz * nz;
        const mP = 1, mC = c.spec.mass;
        // separate
        const share = mC / (mP + mC);
        player.pos.x += nx * pen * share; player.pos.z += nz * pen * share;
        if (vn >= 0) return null;
        const j = -(1.3) * vn / (1 / mP + 1 / mC);
        player.applyImpulse(nx * j / mP, nz * j / mP, (best.po > 0 ? 1 : -1) * (nx * -Math.cos(ph) + nz * Math.sin(ph)) * j * 0.05);
        const impact = -vn;
        if (!c.immune && (impact > 3.5 && c.kind !== "truck" || impact > 9)) {
            if (!c.hit) {
                c.hit = true; c.hitT = 0;
                c.vx = cvx; c.vz = cvz;
                for (const w of c.heads) w.emissiveIntensity = 2;
            }
            c.vx -= nx * j / mC; c.vz -= nz * j / mC;
            c.spinV += (Math.random() < 0.5 ? -1 : 1) * Math.min(6, impact * 0.25);
        } else if (!c.hit) {
            c.speed = Math.max(0, c.speed - impact);
        }
        return { type: "crash", impact, kind: c.kind, oncoming: c.dir < 0, car: c, x: (player.pos.x + c.x) / 2, z: (player.pos.z + c.z) / 2 };
    }
}
