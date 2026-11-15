// features/play — effects: a pooled confetti burst (one InstancedMesh of
// tumbling paper bits) and the sparkle point-cloud shader the dreidels use.
import * as THREE from "three";
import { ctx, on } from "../../core/ctx.js";

// ── confetti ─────────────────────────────────────────────────────────────
const MAX_CONF = 160;
const COLORS = ["#FF4FA3", "#FFC233", "#4FC3F7", "#7CDB6A", "#B388FF", "#FFFFFF", "#FF7043"];
const conf = { mesh: null, n: 0, p: new Float32Array(MAX_CONF * 3), v: new Float32Array(MAX_CONF * 3), r: new Float32Array(MAX_CONF * 3),
    rv: new Float32Array(MAX_CONF * 3), life: new Float32Array(MAX_CONF), col: new Uint8Array(MAX_CONF) };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();

function ensureConfetti() {
    if (conf.mesh || !ctx.scene) return conf.mesh;
    const geo = new THREE.PlaneGeometry(0.16, 0.09);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
    const m = new THREE.InstancedMesh(geo, mat, MAX_CONF);
    m.count = 0;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < MAX_CONF; i++) m.setColorAt(i, _c.set(COLORS[i % COLORS.length]));
    ctx.scene.add(m);
    conf.mesh = m;
    return m;
}

/** Pop a confetti burst at (x, y, z), drifting with velocity (vx, vz). */
export function confetti(x, y, z, n = 70, vx = 0, vz = 0, speed = 6) {
    if (!ensureConfetti()) return;
    for (let k = 0; k < n; k++) {
        let i = conf.n;
        if (i >= MAX_CONF) i = Math.floor(Math.random() * MAX_CONF);   // recycle a random bit
        else conf.n++;
        const a = Math.random() * Math.PI * 2, u = 0.35 + Math.random() * 0.65;
        conf.p.set([x + (Math.random() - 0.5) * 0.8, y, z + (Math.random() - 0.5) * 0.8], i * 3);
        conf.v.set([vx * 0.85 + Math.cos(a) * speed * u, speed * (0.8 + Math.random() * 0.9), vz * 0.85 + Math.sin(a) * speed * u], i * 3);
        conf.r.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3);
        conf.rv.set([(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 14], i * 3);
        conf.life[i] = 2.2 + Math.random() * 1.2;
        conf.col[i] = Math.floor(Math.random() * COLORS.length);
        conf.mesh.setColorAt(i, _c.set(COLORS[conf.col[i]]));
    }
    if (conf.mesh.instanceColor) conf.mesh.instanceColor.needsUpdate = true;
}

/** Advance the confetti (game time: freezes with the pause, slows with the slow-mo). */
export function updateConfetti(dt) {
    const m = conf.mesh;
    if (!m || !conf.n) { if (m) m.count = 0; return; }
    let colorDirty = false;
    for (let i = 0; i < conf.n; i++) {
        conf.life[i] -= dt;
        if (conf.life[i] <= 0) {        // swap-remove with the last live bit
            const j = --conf.n;
            if (i !== j) {
                for (const arr of [conf.p, conf.v, conf.r, conf.rv]) { arr[i * 3] = arr[j * 3]; arr[i * 3 + 1] = arr[j * 3 + 1]; arr[i * 3 + 2] = arr[j * 3 + 2]; }
                conf.life[i] = conf.life[j]; conf.col[i] = conf.col[j];
                m.setColorAt(i, _c.set(COLORS[conf.col[i]])); colorDirty = true;
                i--;
            }
            continue;
        }
        const k = i * 3;
        // flutter: strong air drag, gentle gravity, a sideways wobble
        const drag = Math.exp(-2.4 * dt);
        conf.v[k] *= drag; conf.v[k + 2] *= drag;
        conf.v[k + 1] = conf.v[k + 1] * Math.exp(-1.2 * dt) - 7 * dt;
        if (conf.v[k + 1] < -1.6) conf.v[k + 1] = -1.6;
        conf.p[k] += (conf.v[k] + Math.sin(conf.life[i] * 7 + i) * 0.5) * dt;
        conf.p[k + 1] += conf.v[k + 1] * dt;
        conf.p[k + 2] += conf.v[k + 2] * dt;
        if (conf.p[k + 1] < 0.03) { conf.p[k + 1] = 0.03; conf.v[k] = conf.v[k + 2] = 0; conf.rv[k] *= 0.9; conf.rv[k + 2] *= 0.9; }
        conf.r[k] += conf.rv[k] * dt; conf.r[k + 1] += conf.rv[k + 1] * dt; conf.r[k + 2] += conf.rv[k + 2] * dt;
        const sc = Math.min(1, conf.life[i] / 0.4);
        _q.setFromEuler(_e.set(conf.r[k], conf.r[k + 1], conf.r[k + 2]));
        _m.compose(_v.set(conf.p[k], conf.p[k + 1], conf.p[k + 2]), _q, _s.setScalar(sc));
        m.setMatrixAt(i, _m);
    }
    m.count = conf.n;
    m.instanceMatrix.needsUpdate = true;
    if (colorDirty && m.instanceColor) m.instanceColor.needsUpdate = true;
}
export function clearConfetti() { conf.n = 0; if (conf.mesh) conf.mesh.count = 0; }
on("title", clearConfetti);

// ── sparkle points (twinkling 4-point stars + soft halos) ────────────────
export function sparkleMaterial(color = "#FFE08A") {
    return new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uScale: { value: 400 }, uColor: { value: new THREE.Color(color) }, uFar: { value: 230 } },
        vertexShader: `attribute float aSize; attribute float aPhase; attribute float aKind;
            uniform float uTime; uniform float uScale; uniform float uFar;
            varying float vA; varying float vKind;
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                float dist = -mv.z;
                float tw = aKind > 0.5 ? 0.8 + 0.2 * sin(uTime * 3.0 + aPhase * 6.283)
                                       : max(0.0, sin(uTime * 5.0 + aPhase * 6.283));
                vA = tw * (1.0 - smoothstep(uFar * 0.6, uFar, dist)) * step(0.0, aSize);
                vKind = aKind;
                gl_PointSize = max(0.0, aSize) * uScale * (aKind > 0.5 ? 1.0 : 0.45 + 0.55 * tw) / max(0.5, dist);
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: `uniform vec3 uColor; varying float vA; varying float vKind;
            void main() {
                vec2 p = gl_PointCoord - 0.5;
                float r = length(p);
                float a;
                vec3 col = uColor;
                if (vKind > 0.5) {
                    a = pow(max(0.0, 1.0 - r * 2.0), 2.2) * 0.32;
                } else {
                    float star = max(0.0, 1.0 - abs(p.x) * 16.0) * max(0.0, 1.0 - abs(p.y) * 2.1)
                               + max(0.0, 1.0 - abs(p.y) * 16.0) * max(0.0, 1.0 - abs(p.x) * 2.1);
                    float core = max(0.0, 1.0 - r * 5.0);
                    a = clamp(star + core * core, 0.0, 1.0);
                    col = mix(uColor, vec3(1.0), core);
                }
                a *= vA;
                if (a < 0.01) discard;
                gl_FragColor = vec4(col, a);
                #include <colorspace_fragment>
            }`,
    });
}
