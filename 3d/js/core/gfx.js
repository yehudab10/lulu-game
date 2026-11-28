// Graphics touches, scaled by the tier (core/quality.js) — never anything gameplay reads.
//
//   🌑 contact shadows   a soft dark blob under Lulu's car and the traffic near the camera: the
//                        only shadow on LOW (real shadows off), a light contact darkening under
//                        the sun's shadow on MEDIUM / HIGH. One instanced draw call.
//   🌳 wind sway         the merged tree crowns / bushes (merge.js "leaf" looks) sway in the wind,
//                        harder in a storm (MEDIUM / HIGH; a vertex-shader nudge, no CPU work).
//   ✨ reflections       MEDIUM / HIGH: a tiny environment map of the current sky (PMREM, rebuilt
//                        when the sky changes) gives car paint a glossy clear-coat sheen and the
//                        road a mirror-ish shine when it's wet.
//   🌗 exposure          the tone-mapping exposure lifts a touch at night (ACES keeps the colours).
//   🌟 bloom             HIGH: core/post.js (app.js renders through it).
//
// gfxFrame(dt, camera) runs once a frame before the driving scene renders (app.js).
import * as THREE from "three";
import { ctx } from "./ctx.js";
import { gfx } from "./quality.js";
import { lookHooks, leafMaterials } from "../merge.js";
import { worldMaterials, canvasTex } from "../world.js";

// ── 🌳 wind sway ─────────────────────────────────────────────────────────
const WIND = { uTime: { value: 0 }, uSway: { value: 1 }, uWind: { value: new THREE.Vector2(1, 0.4) } };
function addSway(m) {
    m.onBeforeCompile = sh => {
        sh.uniforms.uTime = WIND.uTime; sh.uniforms.uSway = WIND.uSway; sh.uniforms.uWind = WIND.uWind;
        sh.vertexShader = "attribute float sway;\nuniform float uTime;\nuniform float uSway;\nuniform vec2 uWind;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
            {   // (merged scenery is in world space: its position is a free per-tree phase)
                float sw = sway * uSway;
                float ph = uTime * 1.7 + (position.x + position.z) * 0.13;
                float d = (sin(ph) * 0.65 + sin(ph * 2.3 + 1.3) * 0.35) * 0.028 * sw;
                transformed.xz += uWind * d;
            }`);
    };
    m.customProgramCacheKey = () => "leafSway1";
    m.needsUpdate = true;
}
lookHooks.leaf = addSway;
for (const m of leafMaterials()) addSway(m);

// ── 🌑 contact shadows ───────────────────────────────────────────────────
const MAXB = 28;
let blobs = null;
function blobMesh() {
    if (blobs) return blobs;
    const tex = canvasTex(64, 64, (g, w, h) => {
        const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        grd.addColorStop(0, "rgba(0,0,0,1)"); grd.addColorStop(0.45, "rgba(0,0,0,0.75)"); grd.addColorStop(1, "rgba(0,0,0,0)");
        g.clearRect(0, 0, w, h); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }, false);
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000, map: tex, transparent: true, depthWrite: false, opacity: 0.4,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    mat.name = "ContactShadow";
    blobs = new THREE.InstancedMesh(geo, mat, MAXB);
    blobs.name = "contactShadows";
    blobs.frustumCulled = false;
    blobs.castShadow = blobs.receiveShadow = false;
    blobs.renderOrder = 1;
    blobs.count = 0;
    return blobs;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);
function blob(i, x, z, h, len, wid) {
    _q.setFromAxisAngle(_UP, h);
    _m.compose(_p.set(x, 0.07, z), _q, _s.set(wid, 1, len));
    blobs.setMatrixAt(i, _m);
}
function updateBlobs(camera) {
    const T = gfx.T, scene = ctx.scene;
    if (!T.blob || !ctx.car || !ctx.world) { if (blobs) blobs.visible = false; return; }
    const B = blobMesh();
    if (B.parent !== scene) scene.add(B);
    B.visible = true;
    B.material.opacity = T.blob;
    let n = 0;
    const car = ctx.car, onFoot = !!(ctx.foot && ctx.foot.active);
    if (!onFoot && car.obj.parent && car.model && car.model.visible !== false && car.obj.position.y < 0.3) blob(n++, car.obj.position.x, car.obj.position.z, car.h, 5.0, 2.3);
    const cx = camera.position.x, cz = camera.position.z, R = T.shadows ? 60 : 110;
    if (ctx.traffic) for (const c of ctx.traffic.cars) {
        if (n >= MAXB) break;
        const o = c.obj;
        if (!o.parent || !o.visible || o.position.y > 0.3) continue;
        const dx = o.position.x - cx, dz = o.position.z - cz;
        if (dx * dx + dz * dz > R * R) continue;
        const sp = c.spec || {};
        blob(n++, o.position.x, o.position.z, o.rotation.y, (sp.len || 4.4) + 0.6, (sp.halfW || 0.9) * 2 + 0.5);
    }
    B.count = n;
    B.instanceMatrix.needsUpdate = true;
}

// ── ✨ reflections: a little PMREM of the sky ─────────────────────────────
const PAINT = /^(Paint|Body|BodyLight|CopPaint|CopWhite)$/;
const ENV = { pm: null, rt: null, scene: null, sky: null, t: 99, sig: -1, tagged: new Set(), scanT: 0, roadOn: false };
function envScene() {
    if (ENV.scene) return ENV.scene;
    const s = new THREE.Scene();
    ENV.sky = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, ground: { value: new THREE.Color() }, sun: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() } },
        vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 ground; uniform vec3 sun; uniform vec3 sunCol; varying vec3 vP;
            void main(){ float h = vP.y;
                vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.7, h)) : mix(bottom, mid, smoothstep(-0.02, 0.15, h));
                c = mix(c, ground, smoothstep(0.0, -0.12, h));
                c += sunCol * pow(max(dot(vP, sun), 0.0), 64.0) * 3.0;
                gl_FragColor = vec4(c, 1.0); }`,
    });
    s.add(new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), ENV.sky));
    return ENV.scene = s;
}
function skySig() {
    const u = ctx.world.sky.material.uniforms, L = ctx.lights;
    return u.top.value.r * 7 + u.top.value.g * 5 + u.mid.value.r * 3 + u.mid.value.b * 2 + u.bottom.value.g + L.sun.intensity * 0.5 + ctx.world.groundTint.g * 0.3 + L.sunOffset.x * 0.01;
}
function rebuildEnv() {
    const u = ctx.world.sky.material.uniforms, U = ENV.sky.uniforms, L = ctx.lights;
    U.top.value.copy(u.top.value); U.mid.value.copy(u.mid.value); U.bottom.value.copy(u.bottom.value);
    U.ground.value.set("#6a9a4c").multiply(ctx.world.groundTint).multiplyScalar(0.55 * Math.min(1, L.hemi.intensity));
    U.sun.value.copy(L.sunOffset).normalize();
    U.sunCol.value.copy(L.sun.color).multiplyScalar(Math.min(1, L.sun.intensity / 2.6));
    if (!ENV.pm) ENV.pm = new THREE.PMREMGenerator(ctx.renderer);
    // (its cube faces + blur passes go through the renderer's raw render: they're not the game's draw calls)
    const r = ctx.renderer, pub = r.render;
    let rt;
    if (ctx.rawRender) r.render = ctx.rawRender;
    try { rt = ENV.pm.fromScene(ENV.scene, 0, 0.1, 100); } finally { r.render = pub; }
    if (ENV.rt) ENV.rt.dispose();
    ENV.rt = rt;
    for (const m of ENV.tagged) m.envMap = rt.texture;
}
function dropEnv() {
    for (const m of ENV.tagged) { m.envMap = null; m.needsUpdate = true; }
    ENV.tagged.clear();
    const road = worldMaterials().road;
    if (ENV.roadOn) { road.envMap = null; road.needsUpdate = true; ENV.roadOn = false; }
    if (ENV.rt) { ENV.rt.dispose(); ENV.rt = null; }
    ENV.sig = -1;
}
function updateEnv(dt) {
    const T = gfx.T;
    if (!T.shadows || !ctx.world || !ctx.world.sky) { if (ENV.rt) dropEnv(); return; }   // (MEDIUM / HIGH only)
    envScene();
    ENV.t += dt;
    const sig = skySig();
    // (a slow drift — dusk, a cloud — refreshes every 2 s on HIGH, 15 s on MEDIUM; a sudden jump — a tunnel, a cut to
    //  night, a storm rolling in instantly — at once, or the wet road would mirror a blue noon sky at night)
    const diff = Math.abs(sig - ENV.sig);
    if (!ENV.rt || diff > 0.4 || (ENV.t > (gfx.tier === "high" ? 2 : 15) && diff > 0.03)) { ENV.t = 0; ENV.sig = sig; rebuildEnv(); }
    // car paint (Lulu's + traffic; new cars get it on the next scan)
    ENV.scanT -= dt;
    if (ENV.scanT <= 0) {
        ENV.scanT = 1.5;
        ctx.scene.traverse(o => {
            if (!o.isMesh) return;
            const m = o.material;
            if (!m || Array.isArray(m) || !m.isMeshStandardMaterial || ENV.tagged.has(m) || !PAINT.test(m.name || "")) return;
            m.envMap = ENV.rt.texture;
            m.envMapIntensity = 0.55;
            m.needsUpdate = true;
            ENV.tagged.add(m);
        });
    }
    // the wet road shines (atmos darkens it + drops its roughness; we add the sky in it)
    const road = worldMaterials().road, wet = ctx.atmos && ctx.atmos.wet || 0;
    if (wet > 0.04) {
        if (!ENV.roadOn) { ENV.roadOn = true; road.needsUpdate = true; }
        road.envMap = ENV.rt.texture;
        road.envMapIntensity = wet * 0.85;
    } else if (ENV.roadOn) { ENV.roadOn = false; road.envMap = null; road.needsUpdate = true; }
}

// ── per frame ─────────────────────────────────────────────────────────────
let time = 0;
/** Once a frame before the driving scene renders. */
export function gfxFrame(dt, camera) {
    time += dt;
    const T = gfx.T;
    WIND.uTime.value = time;
    const storm = ctx.atmos ? (ctx.atmos.weather === "rain" ? 1 : 0) : 0;
    WIND.uSway.value = T.sway ? 1 + storm * 1.2 : 0;
    try { updateBlobs(camera); } catch (e) { console.error("[gfx blobs]", e); }
    try { updateEnv(dt); } catch (e) { console.error("[gfx env]", e); }
    // exposure: a touch brighter at night (the palette is dark blue; phones are viewed in daylight too)
    const night = ctx.atmos ? ctx.atmos.night || 0 : 0;
    ctx.renderer.toneMappingExposure = 1.05 + 0.13 * night;
}
/** The sky's pre-filtered environment map (MEDIUM / HIGH; null on LOW) — features/looktest lights the scene with it. */
export function skyEnvTexture() { return ENV.rt ? ENV.rt.texture : null; }
export function gfxInfo() {
    return { envFresh: !ENV.rt || !ctx.world || !ctx.world.sky || Math.abs(skySig() - ENV.sig) <= 0.4, blobs: blobs ? blobs.count : 0, blobsOn: !!(blobs && blobs.visible), env: !!ENV.rt, painted: ENV.tagged.size, wetRoad: ENV.roadOn, sway: WIND.uSway.value, leaves: leafMaterials().length };
}
