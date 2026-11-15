// features/atmos/lights.js — NIGHT LIGHTS, all cheap:
//   · Glows: every light flare (car head/tail lights, lamp bulbs, balloon burners)
//     is one instance of ONE billboard mesh (1 draw call, additive).
//   · Pools: every pool of light on the road (Lulu's beams, oncoming cars' beams,
//     the street lamps) is one instance of ONE ground-decal mesh (1 draw call).
//   · Lulu's headlights: the fake beam pool + flares on every quality, plus one
//     real SpotLight on medium/high (added once at boot so no shader recompiles).
//   · Street lamps along the Cruise road (per chunk, instanced) with glowing bulbs.
//   · Windows of every house model glow warm at night (shared materials → free).
import * as THREE from "three";
import { ctx, on } from "../../core/ctx.js";
import { models } from "../../models.js";
import { facingRoad, worldMaterials } from "../../world.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { S, clamp, smooth, lerp, quality, M4, Q4, V1, V2, V3, UP, P0 } from "./common.js";

// ── Glows: camera-facing additive flares ─────────────────────────────────
class Glows {
    constructor(max) {
        this.max = max; this.n = 0;
        const g = new THREE.InstancedBufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
        g.setIndex([0, 1, 2, 0, 2, 3]);
        this.p = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
        this.c = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
        g.setAttribute("iPos", this.p); g.setAttribute("iCol", this.c);
        g.instanceCount = 0;
        this.geo = g;
        this.mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
            uniforms: { uFogNear: { value: 100 }, uFogFar: { value: 600 } },
            vertexShader: `attribute vec4 iPos; attribute vec4 iCol; uniform float uFogNear; uniform float uFogFar;
                varying vec2 vUv; varying vec4 vC;
                void main() {
                    vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
                    float d = -mv.z;
                    mv.z += min(0.6, d * 0.5);                 // pull toward the camera a touch (don't clip into the car)
                    mv.xy += position.xy * iPos.w * (1.0 + d * 0.012);   // grow a little with distance so far lights still read
                    vUv = position.xy;
                    vC = iCol; vC.a *= 1.0 - smoothstep(uFogNear, uFogFar * 1.1, d) * 0.85;
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: `varying vec2 vUv; varying vec4 vC;
                void main() { float r = dot(vUv, vUv); if (r > 1.0) discard;
                    float a = exp(-r * 5.5) * 0.85 + exp(-r * 40.0) * 1.2;
                    gl_FragColor = vec4(vC.rgb * a * vC.a, 1.0); }`,
        });
        this.mesh = new THREE.Mesh(g, this.mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 6;
        this.mesh.visible = false;
    }
    begin() { this.n = 0; }
    add(x, y, z, size, r, g, b, a) {
        if (this.n >= this.max || a < 0.004) return;
        const i = this.n++ * 4;
        const P = this.p.array, C = this.c.array;
        P[i] = x; P[i + 1] = y; P[i + 2] = z; P[i + 3] = size;
        C[i] = r; C[i + 1] = g; C[i + 2] = b; C[i + 3] = a;
    }
    end() {
        this.geo.instanceCount = this.n;
        this.p.needsUpdate = this.c.needsUpdate = true;
        this.mesh.visible = this.n > 0;
        const F = ctx.scene.fog;
        if (F) { this.mat.uniforms.uFogNear.value = F.near; this.mat.uniforms.uFogFar.value = F.far; }
    }
}

// ── Pools: additive light decals lying on the road ───────────────────────
class Pools {
    constructor(max) {
        this.max = max; this.n = 0;
        const g = new THREE.InstancedBufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], 3));
        g.setIndex([0, 2, 1, 0, 3, 2]);
        this.p = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);   // x, z, heading, kind
        this.s = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);   // half width, half length, intensity, _
        this.c = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
        g.setAttribute("iPos", this.p); g.setAttribute("iSize", this.s); g.setAttribute("iCol", this.c);
        g.instanceCount = 0;
        this.geo = g;
        this.mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
            polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
            uniforms: { uWet: { value: 0 }, uFogNear: { value: 100 }, uFogFar: { value: 600 } },
            vertexShader: `attribute vec4 iPos; attribute vec4 iSize; attribute vec3 iCol; uniform float uFogNear; uniform float uFogFar;
                varying vec2 vUv; varying vec3 vC; varying float vK; varying float vF;
                void main() {
                    vec2 l = vec2(position.x * iSize.x, position.z * iSize.y);
                    float c = cos(iPos.z), s = sin(iPos.z);
                    // heading h: local +z → forward (sin h, cos h), local +x → (cos h, -sin h) — a proper
                    // rotation (det +1) so the quad keeps facing up (pools are symmetric left/right)
                    vec3 w = vec3(iPos.x + l.y * s + l.x * c, 0.07, iPos.y + l.y * c - l.x * s);
                    vUv = position.xz; vC = iCol * iSize.z; vK = iPos.w;
                    vec4 mv = viewMatrix * vec4(w, 1.0);
                    vF = 1.0 - smoothstep(uFogNear, uFogFar, -mv.z) * 0.9;
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: `uniform float uWet; varying vec2 vUv; varying vec3 vC; varying float vK; varying float vF;
                void main() {
                    float a;
                    if (vK < 0.5) { float r = length(vUv); a = pow(max(0.0, 1.0 - r), 1.7); }
                    else {   // a headlight beam: bright near the car, spreading + fading down the road
                        float t = vUv.y * 0.5 + 0.5;
                        float spread = mix(0.35, 1.0, t);
                        float x = abs(vUv.x) / spread;
                        a = smoothstep(1.0, 0.45, x) * smoothstep(0.0, 0.12, t) * pow(1.0 - t, 1.2);
                    }
                    gl_FragColor = vec4(vC * a * vF * (1.0 + uWet * 0.7), 1.0);
                }`,
        });
        this.mesh = new THREE.Mesh(g, this.mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 2;
        this.mesh.visible = false;
    }
    begin() { this.n = 0; }
    add(x, z, h, kind, hw, hl, r, g, b, k) {
        if (this.n >= this.max || k < 0.004) return;
        const i = this.n++;
        const P = this.p.array, Sz = this.s.array, C = this.c.array;
        P[i * 4] = x; P[i * 4 + 1] = z; P[i * 4 + 2] = h; P[i * 4 + 3] = kind;
        Sz[i * 4] = hw; Sz[i * 4 + 1] = hl; Sz[i * 4 + 2] = k;
        C[i * 3] = r; C[i * 3 + 1] = g; C[i * 3 + 2] = b;
    }
    end() {
        this.geo.instanceCount = this.n;
        this.p.needsUpdate = this.s.needsUpdate = this.c.needsUpdate = true;
        this.mesh.visible = this.n > 0;
        this.mat.uniforms.uWet.value = S.wet;
        const F = ctx.scene.fog;
        if (F) { this.mat.uniforms.uFogNear.value = F.near; this.mat.uniforms.uFogFar.value = F.far; }
    }
}

export const glows = new Glows(260);
export const pools = new Pools(90);

// ── where a vehicle model's head / tail lights are (from its Headlight/Taillight meshes) ──
const lightCache = new Map();
function lightPoints(template) {
    if (!template) return null;
    let L = lightCache.get(template);
    if (L) return L;
    L = { head: [], tail: [] };
    template.updateMatrixWorld(true);
    const inv = template.matrixWorld.clone().invert(), m = new THREE.Matrix4(), v = new THREE.Vector3();
    template.traverse(o => {
        if (!o.isMesh || !o.material) return;
        const kind = o.material.name === "Headlight" ? "head" : o.material.name === "Taillight" ? "tail" : null;
        if (!kind) return;
        m.multiplyMatrices(inv, o.matrixWorld);
        const pos = o.geometry.attributes.position;
        const side = { l: [0, 0, 0, 0], r: [0, 0, 0, 0] };
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m);
            const b = v.x < 0 ? side.l : side.r;
            b[0] += v.x; b[1] += v.y; b[2] += v.z; b[3]++;
        }
        for (const b of [side.l, side.r]) if (b[3]) L[kind].push(new THREE.Vector3(b[0] / b[3], b[1] / b[3], b[2] / b[3]));
    });
    if (!L.head.length && !L.tail.length) L = { head: [new THREE.Vector3(-0.6, 0.75, 2.1), new THREE.Vector3(0.6, 0.75, 2.1)], tail: [new THREE.Vector3(-0.6, 0.8, -2.1), new THREE.Vector3(0.6, 0.8, -2.1)] };
    lightCache.set(template, L);
    return L;
}
function toWorld(p, x, z, h, out) {
    const c = Math.cos(h), s = Math.sin(h);
    return out.set(x + p.x * c + p.z * s, p.y, z - p.x * s + p.z * c);
}

// ── Lulu's real headlight (medium / high quality) ────────────────────────
let spot = null;
function wantSpot() { return quality() !== "low"; }
export function lightsBoot() {
    ctx.scene.add(glows.mesh, pools.mesh);
    if (ctx.enabled("atmos") && wantSpot()) addSpot();
}
function addSpot() {
    if (spot) return;
    spot = new THREE.SpotLight("#fff1d6", 0, 75, 0.46, 0.6, 1.1);
    spot.castShadow = false;
    ctx.scene.add(spot, spot.target);
}

// ── street lamps (Cruise): procedural, instanced per chunk ───────────────
let LAMP = null;
function lampKit() {
    if (LAMP) return LAMP;
    const pole = new THREE.CylinderGeometry(0.085, 0.13, 7.2, 8).translate(0, 3.6, 0);
    const base = new THREE.CylinderGeometry(0.2, 0.26, 0.55, 8).translate(0, 0.27, 0);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 7.0, 0), new THREE.Vector3(0, 7.7, 0.5), new THREE.Vector3(0, 7.45, 2.0));
    const arm = new THREE.TubeGeometry(curve, 10, 0.055, 6, false);
    const head = new THREE.CylinderGeometry(0.16, 0.36, 0.32, 10).translate(0, 7.36, 2.08);
    const cap = new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 7.5, 2.08);
    const body = mergeGeometries([pole, base, arm, head, cap]);
    const bulb = new THREE.SphereGeometry(0.2, 10, 6).scale(1, 0.55, 1).translate(0, 7.18, 2.08);
    LAMP = {
        body, bulb,
        bodyMat: new THREE.MeshStandardMaterial({ color: "#3b4250", roughness: 0.55, metalness: 0.5 }),
        bulbMat: new THREE.MeshStandardMaterial({ color: "#fff4d6", emissive: "#ffd98a", emissiveIntensity: 0.25, roughness: 0.3 }),
        // a soft cone of light from the bulb to the road (night / fog / rain only)
        cone: new THREE.CylinderGeometry(0.22, 3.3, 7.0, 18, 1, true).translate(0, 3.6, 2.08),
        coneMat: new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
            uniforms: { uK: { value: 0 }, uCol: { value: new THREE.Color("#ffd99a") } },
            vertexShader: `varying float vH; varying float vF;
                void main() {
                    vH = clamp((position.y - 0.1) / 7.0, 0.0, 1.0);
                    mat4 m = modelMatrix;
                    #ifdef USE_INSTANCING
                      m = m * instanceMatrix;
                    #endif
                    vec4 wp = m * vec4(position, 1.0);
                    vec3 n = normalize(mat3(m) * normal);
                    vec3 v = cameraPosition - wp.xyz;
                    float d = length(v);
                    vF = pow(abs(dot(n, v / d)), 1.4) * (1.0 - smoothstep(70.0, 240.0, d));
                    gl_Position = projectionMatrix * viewMatrix * wp;
                }`,
            fragmentShader: `uniform float uK; uniform vec3 uCol; varying float vH; varying float vF;
                void main() { float a = uK * vF * mix(0.12, 1.0, vH * vH); gl_FragColor = vec4(uCol * a, 1.0); }`,
        }),
    };
    return LAMP;
}
const lampChunks = new Map();     // chunk → { group, ims: [], lamps: [{x, y, z, px, pz, h}] }
const LAMP_GAP = { fall: 48, pool: 48, suburbs: 48, coast: 56, desert: 110 };
function lampsWanted() { return ctx.enabled("atmos") && ctx.G && ctx.G.mode === "cruise"; }

function buildLamps(chunk, world) {
    if (lampChunks.has(chunk)) return;
    const biome = chunk.biome || world.biomeAt(chunk.s0 + 100);
    const gap = LAMP_GAP[biome.name] || (biome.name === "dusk" || biome.name === "strip" ? 0 : 52);
    const rec = { group: null, ims: [], lamps: [], cols: [] };
    lampChunks.set(chunk, rec);
    if (!gap || chunk.s0 < 100) return;
    const road = world.road, spots = [];
    for (let s = Math.ceil(chunk.s0 / gap) * gap; s < chunk.s1; s += gap) {
        const k = Math.round(s / gap), side = k % 2 ? 1 : -1, d = side * 10.2;
        if (world.isReserved(s, d, 4)) continue;
        if (side > 0 && biome.poles) { const m = ((s % 46) + 46) % 46; if (m < 6 || m > 40) continue; }   // keep clear of the power poles
        spots.push({ s, side, d });
    }
    if (!spots.length) return;
    const K = lampKit();
    const body = new THREE.InstancedMesh(K.body, K.bodyMat, spots.length);
    const bulb = new THREE.InstancedMesh(K.bulb, K.bulbMat, spots.length);
    const cone = new THREE.InstancedMesh(K.cone, K.coneMat, spots.length);
    cone.castShadow = false; cone.receiveShadow = false; cone.renderOrder = 4;
    body.castShadow = true; body.receiveShadow = false; bulb.castShadow = false;
    spots.forEach((sp, i) => {
        const p = road.point(sp.s, sp.d, P0);
        const rot = facingRoad(p.h, sp.side);
        Q4.setFromAxisAngle(UP, rot);
        M4.compose(V1.set(p.x, 0, p.z), Q4, V2.set(1, 1, 1));
        body.setMatrixAt(i, M4); bulb.setMatrixAt(i, M4); cone.setMatrixAt(i, M4);
        rec.cols.push(chunk.addCollider({ x: p.x, z: p.z, r: 0.22, kind: "pole" }));
        // the bulb hangs 2.08 m toward the road; its pool of light a little further in
        const fx = Math.sin(rot), fz = Math.cos(rot);
        rec.lamps.push({ x: p.x + fx * 2.08, y: 7.12, z: p.z + fz * 2.08, px: p.x + fx * 4.6, pz: p.z + fz * 4.6, h: p.h });
    });
    body.computeBoundingSphere(); bulb.computeBoundingSphere(); cone.computeBoundingSphere();
    const group = new THREE.Group();
    group.add(body, bulb, cone);
    chunk.add(group);
    rec.group = group; rec.ims = [body, bulb, cone];
}
function dropLamps(chunk) {
    const rec = lampChunks.get(chunk);
    if (!rec) return;
    lampChunks.delete(chunk);
    if (rec.group && rec.group.parent) rec.group.parent.remove(rec.group);
    for (const im of rec.ims) im.dispose();
}
on("chunk:build", ({ chunk, world }) => { if (lampsWanted()) { try { buildLamps(chunk, world); } catch (e) { console.error("[atmos lamps]", e); } } });
on("chunk:dispose", ({ chunk }) => dropLamps(chunk));
/** Cruise ↔ Story: add lamps to (or strip them from) the chunks that are already built. */
export function syncLamps() {
    const want = lampsWanted();
    if (!ctx.world) return;
    for (const chunk of ctx.world.chunks.values()) {
        if (want && !lampChunks.has(chunk)) { try { buildLamps(chunk, ctx.world); } catch (e) { console.error("[atmos lamps]", e); } }
        else if (!want && lampChunks.has(chunk)) {
            const rec = lampChunks.get(chunk);
            if (rec.cols && rec.cols.length) chunk.colliders = chunk.colliders.filter(c => !rec.cols.includes(c));   // their poles go too
            dropLamps(chunk);
        }
    }
}

// ── windows glow at night (every house model's shared "Window" material) ──
const WINDOW_MODELS = ["house", "bubbeHouse", "journey_adobe", "journey_beachhouse", "journey_boutique", "journey_casino", "journey_icecream"];
const windowMats = new Map();   // material → original {e, ei}
let windowScanT = 0, windowGlow = -1;
const WARM = new THREE.Color("#ffc46b");
function scanWindows() {
    for (const k of WINDOW_MODELS) {
        const t = models[k];
        if (!t || t.userData.atmosScanned) continue;
        t.userData.atmosScanned = true;
        t.traverse(o => {
            if (!o.isMesh) return;
            for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
                if (m && /^(Window|ShopWindow)$/.test(m.name) && m.emissive && !windowMats.has(m)) windowMats.set(m, { e: m.emissive.clone(), ei: m.emissiveIntensity });
            }
        });
    }
}
function setWindows(g) {
    if (Math.abs(g - windowGlow) < 0.004) return;
    windowGlow = g;
    for (const [m, o] of windowMats) {
        if (g <= 0.001) { m.emissive.copy(o.e); m.emissiveIntensity = o.ei; continue; }
        m.emissive.copy(o.e).lerp(WARM, Math.min(1, g * 1.5));
        m.emissiveIntensity = o.ei + g * 1.5;
    }
}

// ── per-frame ─────────────────────────────────────────────────────────────
const HEAD = [1, 0.93, 0.78], TAIL = [1, 0.12, 0.1];
export function lightsTick(dt) {
    const car = ctx.car, cam = S.camPos;
    windowScanT -= dt;
    if (windowScanT <= 0) {
        windowScanT = 3; scanWindows();
        if (!spot && ctx.enabled("atmos") && wantSpot()) addSpot();   // quality raised in Settings
        else if (spot && !wantSpot()) { ctx.scene.remove(spot, spot.target); spot.dispose(); spot = null; }   // …or lowered
    }
    setWindows(smooth(0.3, 0.85, S.night));

    const lights = S.lightsOn, lamp = smooth(0.25, 0.75, Math.max(S.night, S.fog * 0.6, S.rain * 0.45 * S.night));
    glows.begin(); pools.begin();
    const onFoot = !!(ctx.foot && ctx.foot.active);

    // Lulu's car
    if (lights > 0.01 && !onFoot && car.obj.visible) {
        const L = lightPoints(models.lulu);
        const braking = car.taillights && car.taillights[0] ? car.taillights[0].emissiveIntensity > 3 : false;
        for (const p of L.head) { toWorld(p, car.pos.x, car.pos.z, car.h, V1); glows.add(V1.x, V1.y, V1.z, 0.55, HEAD[0], HEAD[1], HEAD[2], lights * 1.1); }
        for (const p of L.tail) { toWorld(p, car.pos.x, car.pos.z, car.h, V1); glows.add(V1.x, V1.y, V1.z, braking ? 0.5 : 0.34, TAIL[0], TAIL[1], TAIL[2], lights * (braking ? 1.6 : 0.8)); }
        // the beam on the road: weaker where the journey's own beams already show (the Strip)
        const beam = lights * (1 - S.baseNight * 0.55) * (S.fp ? 0.75 : 1);
        const fx = Math.sin(car.h), fz = Math.cos(car.h);
        pools.add(car.pos.x + fx * 14.5, car.pos.z + fz * 14.5, car.h, 1, 4.6, 13, 1, 0.9, 0.72, beam * 0.62);
    }
    if (spot) {
        const on = lights > 0.01 && !onFoot && car.obj.visible !== false;
        const fx = Math.sin(car.h), fz = Math.cos(car.h);
        spot.position.set(car.pos.x + fx * 1.9, 1.05, car.pos.z + fz * 1.9);
        spot.target.position.set(car.pos.x + fx * 24, 0, car.pos.z + fz * 24);
        spot.target.updateMatrixWorld();
        spot.intensity = on ? lights * 55 : 0;
    }

    // traffic: head + tail flares, beams in front of oncoming cars
    if (lights > 0.01 && ctx.traffic) {
        let beams = 0;
        for (const c of ctx.traffic.cars) {
            const o = c.obj;
            if (!o.parent || (c.data && c.data.footStub)) continue;     // (her parked car on foot stays dark — it has hazards)
            const dx = o.position.x - cam.x, dz = o.position.z - cam.z;
            if (dx * dx + dz * dz > 420 * 420) continue;
            const L = lightPoints(models[(c.spec && c.spec.model) || c.kind]);
            if (!L) continue;
            const h = o.rotation.y, flash = c.flash || 0;
            const headA = lights * (c.hit ? 0.3 : 1) * (1 + flash * (Math.sin(ctx.time * 30) > 0 ? 2.5 : 0.5));
            for (const p of L.head) { toWorld(p, o.position.x, o.position.z, h, V1); glows.add(V1.x, V1.y, V1.z, 0.5, HEAD[0], HEAD[1], HEAD[2], headA); }
            for (const p of L.tail) { toWorld(p, o.position.x, o.position.z, h, V1); glows.add(V1.x, V1.y, V1.z, 0.32, TAIL[0], TAIL[1], TAIL[2], lights * 0.75); }
            if (!c.hit && beams < 14 && L.head.length) {
                beams++;
                const fx = Math.sin(h), fz = Math.cos(h);
                pools.add(o.position.x + fx * 12, o.position.z + fz * 12, h, 1, 3.8, 10, 1, 0.9, 0.72, lights * 0.4);
            }
        }
    }

    // street lamps: bulbs, halos, pools
    const K = LAMP;
    if (K) {
        K.bulbMat.emissiveIntensity = 0.25 + lamp * 4.2;
        const ck = lamp * (0.16 + 0.3 * S.fog + 0.22 * S.rain + 0.12 * S.snow);
        K.coneMat.uniforms.uK.value = ck;
        K.coneMat.visible = ck > 0.005;
    }
    if (lamp > 0.01) {
        for (const rec of lampChunks.values()) {
            for (const l of rec.lamps) {
                const dx = l.x - cam.x, dz = l.z - cam.z;
                if (dx * dx + dz * dz > 360 * 360) continue;
                glows.add(l.x, l.y, l.z, 1.05, 1, 0.84, 0.55, lamp * 0.9);
                pools.add(l.px, l.pz, l.h, 0, 7.2, 7.2, 1, 0.82, 0.52, lamp * 0.95);
            }
        }
    }
    for (const fn of extraGlows) { try { fn(glows); } catch (e) { console.error("[atmos glow]", e); } }
    glows.end(); pools.end();
}
/** Other atmos modules add their own flares (balloon burners…). */
const extraGlows = [];
export function addGlowSource(fn) { extraGlows.push(fn); }

export function lightsHide() {
    glows.begin(); glows.end(); pools.begin(); pools.end();
    if (spot) spot.intensity = 0;
    setWindows(0);
    if (LAMP) { LAMP.bulbMat.emissiveIntensity = 0.25; LAMP.coneMat.visible = false; }
}

export function lightsInfo() {
    let lamps = 0;
    for (const r of lampChunks.values()) lamps += r.lamps.length;
    return { glows: glows.mesh.visible ? glows.n : 0, pools: pools.mesh.visible ? pools.n : 0, spot: spot ? spot.intensity : -1,
        lamps, lampChunks: [...lampChunks.values()].filter(r => r.group).length, windows: windowMats.size, windowGlow: Math.max(0, windowGlow) };
}
export { worldMaterials };
