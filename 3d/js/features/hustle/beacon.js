// features/hustle — the destination BEACON: a tall, soft column of light with a
// pulsing ring on the ground (the GTA "go here" marker), plus the mission-marker
// pad. Pooled: two beacons and their geometry are built once and shared; each
// colour gets one cached material. No allocations per frame.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";

const VERT = `varying vec2 vUv; varying float vRim;
void main() {
  vUv = uv;
  vec3 n = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vRim = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;
// soft column: bright at the foot, fading up; soft edges (view-angle rim); gentle rising bands
const FRAG_COL = `uniform vec3 color; uniform float time; uniform float alpha; varying vec2 vUv; varying float vRim;
void main() {
  float h = vUv.y;
  float fade = pow(1.0 - h, 1.7);
  float edge = smoothstep(0.0, 0.75, vRim);
  float bands = 0.82 + 0.18 * sin(h * 46.0 - time * 3.2);
  float a = fade * edge * bands * alpha;
  gl_FragColor = vec4(color * (1.2 + 0.6 * (1.0 - h)), a);
}`;
const FRAG_RING = `uniform vec3 color; uniform float time; uniform float alpha; varying vec2 vUv; varying float vRim;
void main() {
  float r = vUv.x;                       // RingGeometry: u runs around? use the radial v below
  float a = alpha * (0.55 + 0.45 * sin(time * 4.0));
  gl_FragColor = vec4(color * 1.4, a);
}`;

let geoCol = null, geoCore = null, geoRing = null, geoPad = null;
const mats = new Map();   // colour → { col, core, ring }
function geos() {
    if (geoCol) return;
    geoCol = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
    geoCol.translate(0, 0.5, 0);
    geoCore = geoCol;                                     // same shape, scaled thinner
    geoRing = new THREE.RingGeometry(0.82, 1, 40, 1);
    geoRing.rotateX(-Math.PI / 2);
    geoPad = new THREE.CircleGeometry(1, 40);
    geoPad.rotateX(-Math.PI / 2);
}
function matsFor(hex) {
    let m = mats.get(hex);
    if (m) return m;
    const uni = () => ({ color: { value: new THREE.Color(hex) }, time: { value: 0 }, alpha: { value: 1 } });
    const base = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide, toneMapped: false };
    m = {
        col: new THREE.ShaderMaterial(Object.assign({ uniforms: uni(), vertexShader: VERT, fragmentShader: FRAG_COL }, base)),
        core: new THREE.ShaderMaterial(Object.assign({ uniforms: uni(), vertexShader: VERT, fragmentShader: FRAG_COL }, base)),
        ring: new THREE.ShaderMaterial(Object.assign({ uniforms: uni(), vertexShader: VERT, fragmentShader: FRAG_RING }, base)),
        pad: new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }),
    };
    m.core.uniforms.alpha.value = 0.9;
    mats.set(hex, m);
    return m;
}

class Beacon {
    constructor() {
        geos();
        this.group = new THREE.Group();
        this.group.name = "hustle_beacon";
        this.col = new THREE.Mesh(geoCol, null);
        this.core = new THREE.Mesh(geoCore, null);
        this.ring = new THREE.Mesh(geoRing, null);
        this.pad = new THREE.Mesh(geoPad, null);
        for (const m of [this.col, this.core, this.ring, this.pad]) { m.frustumCulled = false; m.renderOrder = 5; this.group.add(m); }
        this.col.scale.set(1.25, 70, 1.25);
        this.core.scale.set(0.35, 70, 0.35);
        this.ring.position.y = 0.08;
        this.pad.position.y = 0.06;
        this.group.visible = false;
        this.on = false;
        this.hex = "";
        this.follow = null;     // an Object3D to sit on (a moving car / a person)
        this.t = Math.random() * 10;
    }
    show(x, z, hex, { follow = null, pad = false, r = 1 } = {}) {
        if (this.hex !== hex) {
            const m = matsFor(hex);
            this.col.material = m.col; this.core.material = m.core; this.ring.material = m.ring; this.pad.material = m.pad;
            this.hex = hex;
        }
        this.group.position.set(x, 0, z);
        this.follow = follow;
        this.pad.visible = !!pad;
        this.pad.scale.setScalar(r * 2.6);
        this.ringR = r;
        if (!this.group.parent) ctx.scene.add(this.group);
        this.group.visible = true;
        this.on = true;
        return this;
    }
    hide() { this.on = false; this.follow = null; this.group.visible = false; }
    update(dt) {
        if (!this.on) return;
        this.t += dt;
        if (this.follow) { this.group.position.x = this.follow.position.x; this.group.position.z = this.follow.position.z; }
        const m = mats.get(this.hex);
        if (m) { m.col.uniforms.time.value = this.t; m.core.uniforms.time.value = this.t * 1.3; m.ring.uniforms.time.value = this.t; }
        const k = (this.t * 0.8) % 1;                                   // a ring that ripples outward
        const r = this.ringR * (1.4 + k * 1.8);
        this.ring.scale.set(r, 1, r);
        if (m) m.ring.uniforms.alpha.value = 0.9 * (1 - k);
        // a little lift + breathe so it reads as "alive"
        const s = 1 + Math.sin(this.t * 2.4) * 0.06;
        this.col.scale.x = this.col.scale.z = 1.25 * s;
        // fade the column as the car gets close (it would fill the screen otherwise)
        if (ctx.car && m) {
            const dx = this.group.position.x - ctx.car.pos.x, dz = this.group.position.z - ctx.car.pos.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            m.col.uniforms.alpha.value = Math.min(1, 0.25 + d / 45);
        }
    }
}

export const beacons = { target: new Beacon(), marker: new Beacon() };
export function updateBeacons(dt) { beacons.target.update(dt); beacons.marker.update(dt); }
export function hideBeacons() { beacons.target.hide(); beacons.marker.hide(); }
