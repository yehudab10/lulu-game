// features/airport — ✈️ THE TERMINAL'S PEOPLE: everybody in the hall who isn't Lulu (or a friend) — the agents, the
// guard, the deli man, the travellers rolling suitcases, the line that snakes, the family with ten kids, the man asleep
// across four seats — on homes' INSTANCED RIGS (features/homes/rig.js): one rig per body (man / woman / kid / cop) is
// ~5 draw calls for ALL of them, the rolling suitcases are one instanced mesh, the far ones the ~70-triangle LOD figure.
// A person here is a plain record (no Object3D of its own): { x, z, ry, pose, walk, path | target, bag, anchor } —
// the anchor is an empty Object3D that speech bubbles follow.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { models, findNodes } from "../../models.js";
import { Rig, LodCrowd } from "../homes/rig.js";

const PERSON = ["Body", "Arm_L", "Arm_R", "Leg_L", "Leg_R"];
const DOGP = ["Head", "Tail", "Leg_FL", "Leg_FR", "Leg_BL", "Leg_BR"];
export const LOOKS = { man: "npcMan", woman: "npcWoman", kid: "npcKid", cop: "copPerson" };
const MAX = { man: 34, woman: 34, kid: 18, cop: 4 };
const TOPS = ["#E53935", "#8E24AA", "#1E88E5", "#43A047", "#FDD835", "#FB8C00", "#00ACC1", "#F06292", "#5D4037", "#546E7A", "#7E57C2", "#26A69A"];
const BOTS = ["#263238", "#212121", "#37474F", "#3E2723", "#1A237E", "#4E342E"];
const HAIRS = ["#3E2723", "#212121", "#5D4037", "#8D6E63", "#D7CCC8", "#FFB74D", "#4E342E"];
const BAGS = ["#C62828", "#1565C0", "#2E7D32", "#6A1B9A", "#F9A825", "#37474F", "#EC407A", "#00838F"];
const pickR = (a, r) => a[Math.floor(r * a.length) % a.length];

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(),
    _s = new THREE.Vector3(1, 1, 1), _dp = new THREE.Vector3(), _f = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sph = new THREE.Sphere();
const q3 = (x, y, z) => _q.setFromEuler(_e.set(x, y, z, "XYZ"));
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

/** A polyline path: { pts: [[x, z]…], closed, len[], total }. */
export function path(pts, closed = true) {
    const len = [];
    let total = 0;
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); len.push(l); total += l; }
    return { pts, closed, len, total };
}
/** The point `u` metres along path P → { x, z, h } (closed paths wrap; open ones ping-pong). */
export function along(P, u, out = {}) {
    let d = u, back = false;
    if (P.closed) d = ((d % P.total) + P.total) % P.total;
    else { const k = ((d % (2 * P.total)) + 2 * P.total) % (2 * P.total); back = k > P.total; d = back ? 2 * P.total - k : k; }
    let i = 0;
    while (i < P.len.length - 1 && d > P.len[i]) { d -= P.len[i]; i++; }
    const a = P.pts[i], b = P.pts[(i + 1) % P.pts.length], t = P.len[i] ? Math.min(1, d / P.len[i]) : 0;
    out.x = a[0] + (b[0] - a[0]) * t; out.z = a[1] + (b[1] - a[1]) * t;
    out.h = Math.atan2(b[0] - a[0], b[1] - a[1]) + (back ? Math.PI : 0);
    return out;
}

export class Crowd {
    /** set: the room's set · props: the props model (Prop_Suitcase) · fullMax: the most full-detail people drawn at once. */
    constructor(set, props, { fullMax = 16 } = {}) {
        this.set = set; this.fullMax = fullMax;
        this.agents = []; this.byId = {}; this.n = 0; this.t = 0;
        this.group = new THREE.Group(); this.group.name = "TerminalCrowd";
        set.add(this.group);
        this.rigs = {};
        for (const [k, key] of Object.entries(LOOKS)) {
            if (!models[key]) continue;
            this.rigs[k] = new Rig(models[key], PERSON, MAX[k], { name: "term-" + k });
            this.group.add(this.rigs[k].group);
        }
        this.lod = new LodCrowd(90);
        this.group.add(this.lod.im);
        // the dog (law's K9, baked into a little rig of its own: ~7 draw calls)
        this.dogRig = models.lawK9 ? new Rig(models.lawK9, DOGP, 1, { name: "term-dog" }) : null;
        if (this.dogRig) this.group.add(this.dogRig.group);
        this.dog = null;
        // rolling suitcases: ONE instanced mesh, a colour per instance
        const sc = props && findNodes(props, "Prop_Suitcase")[0];
        let mesh = null;
        if (sc) sc.traverse(o => { if (!mesh && o.isMesh) mesh = o; });
        if (mesh) {
            const geo = mesh.geometry, mat = mesh.material.clone();
            mat.color.set("#ffffff");
            this.bagMat = mat;
            this.bags = new THREE.InstancedMesh(geo, mat, 70);
            this.bags.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            this.bags.frustumCulled = false; this.bags.castShadow = false; this.bags.receiveShadow = true;
            this.bags.count = 0; this.bags.name = "TerminalBags";
            const c = new THREE.Color();
            for (let i = 0; i < 70; i++) this.bags.setColorAt(i, c.set(BAGS[i % BAGS.length]));
            this.group.add(this.bags);
            this.bagOwner = new Array(70).fill(null);
        }
        this.stats = { full: 0, lod: 0, bags: 0 };
    }

    /**
     * Add a person. spec: { id, look (man | woman | kid | cop), x, z, ry, seed (0..1 for colours), top, bot, hair,
     * pose: { sit, lie, talk, wave, cheer, point, hug, hold }, path (from path()), u (start metres), speed, bag (true | hex),
     * named (always full detail when on screen), scale, collide (default true), ride ("segway") }
     */
    add(spec) {
        const r = spec.seed != null ? spec.seed : Math.random();
        const a = Object.assign({
            id: "p" + (this.n++), look: "man", x: 0, z: 0, y: 0, ry: 0, pose: {}, walk: 0, phase: r * 6, t: r * 10, scale: 1,
            path: null, u: 0, speed: 1.2, target: null, bag: null, named: false, collide: true, talkT: 0, waveT: 0, cheerT: 0, hugT: 0, gone: false,
        }, spec);
        const cop = a.look === "cop";      // (a cop is in uniform: navy, unless told otherwise)
        a.colors = {
            top: new THREE.Color(spec.top || (cop ? "#1F3A5F" : pickR(TOPS, r * 7.13))),
            bot: new THREE.Color(spec.bot || (cop ? "#16263F" : pickR(BOTS, r * 3.71))),
            hair: new THREE.Color(spec.hair || pickR(HAIRS, r * 5.37)),
        };
        if (a.bag === true) a.bag = pickR(BAGS, r * 11.3);
        if (a.bag) a.bagI = BAGS.indexOf(a.bag) >= 0 ? BAGS.indexOf(a.bag) : Math.floor(r * BAGS.length);
        a.anchor = new THREE.Object3D();
        a.anchor.name = "TerminalAnchor:" + a.id;
        this.group.add(a.anchor);
        if (a.path) { const p = along(a.path, a.u); a.x = p.x; a.z = p.z; a.ry = p.h; }
        if (!this.rigs[a.look]) a.look = "man";
        this.agents.push(a);
        this.byId[a.id] = a;
        this.place(a);
        return a;
    }
    remove(a) {
        if (!a) return;
        a.gone = true;
        a.anchor.removeFromParent();
        const i = this.agents.indexOf(a);
        if (i >= 0) this.agents.splice(i, 1);
        if (this.byId[a.id] === a) delete this.byId[a.id];
    }
    /** Walk to (x, z) at speed; resolves on arrival. */
    walkTo(a, x, z, speed = 1.3) {
        return new Promise(res => { a.path = null; a.target = { x, z, speed, res }; });
    }
    /** The dog: { x, z, ry, walk, sniff, wag, hop, target }. */
    addDog(spec) {
        this.dog = Object.assign({ x: 0, z: 0, ry: 0, walk: 0, phase: 0, t: 0, sniff: 0, hop: 0, target: null, anchor: new THREE.Object3D(),
            colors: { top: new THREE.Color("#B08A63"), bot: new THREE.Color("#2E2320"), hair: new THREE.Color("#2E2320") } }, spec);
        this.group.add(this.dog.anchor);
        return this.dog;
    }
    place(a) { a.anchor.position.set(a.x, a.y + (a.pose.sit ? -0.35 : 0) + (a.pose.lie ? -1.2 : 0), a.z); }

    /** Push a point (Lulu) out of anyone standing or walking near it. */
    push(p, r) {
        for (const a of this.agents) {
            if (!a.collide || a.pose.lie || a.pose.sit) continue;
            const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz), rr = r + (a.look === "kid" ? 0.24 : 0.32);
            if (d < rr && d > 1e-4) { p.x = a.x + dx / d * rr; p.z = a.z + dz / d * rr; }
        }
    }
    /** People within r of (x, z). */
    near(x, z, r) { return this.agents.filter(a => Math.hypot(a.x - x, a.z - z) < r); }

    // ── per frame ──
    update(dt, camera) {
        this.t += dt;
        for (const a of this.agents) this.move(a, dt);
        if (this.dog) this.moveDog(this.dog, dt);
        this.draw(camera, dt);
    }
    move(a, dt) {
        a.t += dt;
        if (a.talkT > 0) a.talkT -= dt;
        if (a.waveT > 0) a.waveT -= dt;
        if (a.cheerT > 0) a.cheerT -= dt;
        if (a.hugT > 0) a.hugT -= dt;
        let walk = 0;
        if (a.path) {
            a.u += a.speed * dt;
            const p = along(a.path, a.u);
            a.x = p.x; a.z = p.z; a.ry += wrap(p.h - a.ry) * Math.min(1, dt * 8);
            walk = a.speed;
        } else if (a.target) {
            const T = a.target, dx = T.x - a.x, dz = T.z - a.z, d = Math.hypot(dx, dz);
            if (d < 0.08) { a.target = null; T.res && T.res(); }
            else {
                const k = Math.min(d, T.speed * dt) / d;
                a.x += dx * k; a.z += dz * k;
                a.ry += wrap(Math.atan2(dx, dz) - a.ry) * Math.min(1, dt * 9);
                walk = T.speed;
            }
        } else if (a.faceTo) {
            a.ry += wrap(Math.atan2(a.faceTo.x - a.x, a.faceTo.z - a.z) - a.ry) * Math.min(1, dt * 5);
        } else if (a.homeRy != null) a.ry += wrap(a.homeRy - a.ry) * Math.min(1, dt * 3);
        a.walk += (walk - a.walk) * Math.min(1, dt * 10);
        a.phase += dt * (a.walk > 0.05 ? 2.2 + a.walk * 2.4 : 0);
        this.place(a);
    }
    moveDog(D, dt) {
        D.t += dt;
        let walk = 0;
        if (D.target) {
            const T = D.target, dx = T.x - D.x, dz = T.z - D.z, d = Math.hypot(dx, dz);
            if (d < 0.1) { D.target = null; T.res && T.res(); }
            else { const k = Math.min(d, T.speed * dt) / d; D.x += dx * k; D.z += dz * k; D.ry += wrap(Math.atan2(dx, dz) - D.ry) * Math.min(1, dt * 10); walk = T.speed; }
        } else if (D.faceTo) D.ry += wrap(Math.atan2(D.faceTo.x - D.x, D.faceTo.z - D.z) - D.ry) * Math.min(1, dt * 6);
        D.walk += (walk - D.walk) * Math.min(1, dt * 10);
        D.phase += dt * (D.walk > 0.05 ? 6 + D.walk * 4 : 0);
        if (D.hop > 0) D.hop -= dt;
        D.anchor.position.set(D.x, 0, D.z);
    }

    draw(camera, dt) {
        camera.updateMatrixWorld();
        _f.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        const cx = camera.position.x, cz = camera.position.z;
        const vis = [];
        for (const a of this.agents) {
            _sph.center.set(a.x, 0.9, a.z); _sph.radius = 1.2;
            a.onScreen = _f.intersectsSphere(_sph);
            if (!a.onScreen) continue;
            a.cd = Math.hypot(a.x - cx, a.z - cz) - (a.named ? 100 : 0);
            vis.push(a);
        }
        vis.sort((p, q) => p.cd - q.cd);
        for (const r of Object.values(this.rigs)) r.begin();
        this.lod.begin();
        let full = 0, nb = 0;
        for (const a of vis) {
            const sit = !!a.pose.sit, lie = !!a.pose.lie;
            if (lie) _e.set(-Math.PI / 2, a.ry, 0, "YXZ"); else _e.set(0, a.ry, 0, "XYZ");
            _q.setFromEuler(_e);
            _m.compose(_v.set(a.x, a.y, a.z), _q, _s.setScalar(a.scale));
            if (full < this.fullMax || a.named) {
                const rig = this.rigs[a.look], i = rig ? rig.add(a, a.colors) : -1;
                if (i >= 0) { full++; this.posePerson(rig, i, a); }
            } else {
                if (sit) _m.compose(_v.set(a.x, a.y - 0.4, a.z), _q, _s.setScalar(a.scale));
                this.lod.add(a, a.colors, _m);
            }
            // a suitcase rolling behind (walking) or standing beside (waiting)
            if (a.bag && this.bags && nb < 70) {
                const moving = a.walk > 0.2, c = Math.cos(a.ry), s = Math.sin(a.ry);
                const lx = moving ? -0.28 : -0.48, lz = moving ? -0.55 : 0.05;
                _v.set(a.x + lx * c + lz * s, 0, a.z - lx * s + lz * c);
                _q.setFromEuler(_e.set(moving ? 0.55 : 0, a.ry, 0, "YXZ"));
                _m2.compose(_v, _q, _s.setScalar(a.look === "kid" ? 0.7 : 1));
                if (this.bagOwner[nb] !== a.bagI) { this.bags.setColorAt(nb, new THREE.Color(BAGS[a.bagI])); this.bagOwner[nb] = a.bagI; this.bags.instanceColor.needsUpdate = true; }
                this.bags.setMatrixAt(nb++, _m2);
            }
        }
        for (const r of Object.values(this.rigs)) r.end();
        this.lod.end();
        if (this.bags) { this.bags.count = nb; this.bags.visible = nb > 0; if (nb) this.bags.instanceMatrix.needsUpdate = true; }
        // the dog
        if (this.dogRig) {
            this.dogRig.begin();
            const D = this.dog;
            if (D) {
                const i = this.dogRig.add(D, D.colors);
                const sw = D.walk > 0.05 ? Math.sin(D.phase) * 0.6 : 0, hop = D.hop > 0 ? Math.abs(Math.sin(D.t * 12)) * 0.16 : 0;
                _m.compose(_v.set(D.x, hop, D.z), _q.setFromEuler(_e.set(0, D.ry, 0)), _s.setScalar(D.scale || 0.9));
                const R = this.dogRig;
                if (R.parts._rest) R.pose(i, "_rest", _m);
                R.pose(i, "Head", _m, q3(D.sniff > 0 ? 0.45 + Math.sin(D.t * 14) * 0.12 : Math.sin(D.t * 1.3) * 0.05, 0, 0));
                R.pose(i, "Tail", _m, q3(0, Math.sin(D.t * (D.hop > 0 || D.sniff > 0 ? 22 : 6)) * 0.5, 0));
                R.pose(i, "Leg_FL", _m, q3(sw, 0, 0)); R.pose(i, "Leg_BR", _m, q3(sw, 0, 0));
                R.pose(i, "Leg_FR", _m, q3(-sw, 0, 0)); R.pose(i, "Leg_BL", _m, q3(-sw, 0, 0));
                if (D.sniff > 0) D.sniff -= dt;
            }
            this.dogRig.end();
        }
        this.stats.full = full; this.stats.lod = vis.length - full; this.stats.bags = nb;
    }

    /** The people.js pose maths, on a rig instance. */
    posePerson(rig, i, a) {
        const P = a.pose, walk = a.walk;
        const swing = walk > 0.05 ? Math.min(0.75, 0.25 + walk * 0.22) : 0;
        const s = Math.sin(a.phase), breathe = Math.sin(a.t * 2.2) * 0.015;
        let legL = s * swing, legR = -s * swing, armL = -s * swing * 0.8, armR = s * swing * 0.8, armLz = 0.06, armRz = -0.06;
        const sit = !!P.sit, talk = a.talkT > 0 || !!P.talk;
        if (sit) { legL = legR = -1.4; armL = armR = -0.5; }
        if (P.ride) { legL = legR = 0; armL = armR = -0.95; armLz = 0.12; armRz = -0.12; }
        if (a.bag && walk > 0.2) { armR = 0.35; armRz = -0.3; }                         // pulling the suitcase
        if (P.hold) { armL = armR = -1.9; armLz = 0.2; armRz = -0.2; }                   // a sign up high
        if (a.cheerT > 0 || P.cheer) { armL = armR = -2.7 + Math.sin(a.t * 10) * 0.15; armLz = 0.25; armRz = -0.25; }
        if (a.waveT > 0 || P.wave) { armR = -2.6; armRz = -0.35 + Math.sin(a.t * 9) * 0.45; }
        if (a.hugT > 0) { armL = armR = -1.45; armLz = -0.55; armRz = 0.55; }
        if (P.point) { armR = -1.5; armRz = -0.05; }
        if (P.phone) { armR = -2.3; armRz = 0.5; }
        if (talk && !P.hold && !P.ride && walk < 0.2) { armL = -0.35 + Math.sin(a.t * 5) * 0.25; }
        const bob = walk > 0.05 ? Math.abs(Math.cos(a.phase)) * 0.035 * Math.min(1, walk) : 0;
        const sy = sit ? -0.35 : 0;
        rig.pose(i, "Body", _m, q3(talk ? Math.sin(a.t * 6) * 0.03 : 0, 0, 0), _dp.set(0, bob + breathe + (talk ? Math.abs(Math.sin(a.t * 12)) * 0.01 : 0) + sy, 0));
        rig.pose(i, "Arm_L", _m, q3(armL, 0, armLz), _dp.set(0, sy + bob, 0));
        rig.pose(i, "Arm_R", _m, q3(armR, 0, armRz), _dp.set(0, sy + bob, 0));
        rig.pose(i, "Leg_L", _m, q3(legL, 0, 0));
        rig.pose(i, "Leg_R", _m, q3(legR, 0, 0));
        if (rig.parts._rest) rig.pose(i, "_rest", _m);
    }

    dispose() {
        for (const r of Object.values(this.rigs)) r.dispose();
        if (this.dogRig) this.dogRig.dispose();
        this.lod.dispose();
        if (this.bags) { this.bags.dispose(); this.bagMat.dispose(); this.bags.removeFromParent(); }
        this.group.removeFromParent();
        this.agents.length = 0;
    }
}
