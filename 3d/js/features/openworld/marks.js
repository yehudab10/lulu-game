// features/openworld — pooled in-world MARKERS: the "go here" beacon (a soft column of
// light + a pulsing ring — race pins, the robbers' drop, photo-hunt sights, a Nearby pin)
// and the roof props that say who's who in a party game (🚓 the cop's light bar, 🥘 the
// hot kugel, 💰 the robbers' stash). Everything is built once and reused: one shared
// geometry per shape, one material per colour, at most BEACONS beacons, no per-frame
// allocation (the flashing / bobbing writes a few uniforms and transforms).
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";

const VERT = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `uniform vec3 color; uniform float time; uniform float alpha; varying vec2 vUv;
void main() {
  float h = vUv.y;
  float a = pow(1.0 - h, 1.6) * (0.8 + 0.2 * sin(h * 40.0 - time * 3.0)) * alpha;
  gl_FragColor = vec4(color * 1.3, a);
}`;
const BEACONS = 6;
let geoCol = null, geoRing = null;
const mats = new Map();
function matsFor(hex) {
    let m = mats.get(hex);
    if (m) return m;
    const base = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide, toneMapped: false };
    m = {
        col: new THREE.ShaderMaterial(Object.assign({ uniforms: { color: { value: new THREE.Color(hex) }, time: { value: 0 }, alpha: { value: 0.85 } }, vertexShader: VERT, fragmentShader: FRAG }, base)),
        ring: new THREE.MeshBasicMaterial(Object.assign({ color: hex, opacity: 0.7 }, base)),
    };
    mats.set(hex, m);
    return m;
}

class Beacon {
    constructor() {
        if (!geoCol) {
            geoCol = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true); geoCol.translate(0, 0.5, 0);
            geoRing = new THREE.RingGeometry(0.8, 1, 36, 1); geoRing.rotateX(-Math.PI / 2);
        }
        this.g = new THREE.Group();
        this.col = new THREE.Mesh(geoCol, matsFor("#FFD54F").col);
        this.ring = new THREE.Mesh(geoRing, matsFor("#FFD54F").ring);
        this.col.frustumCulled = false;
        this.ring.position.y = 0.06;
        this.g.add(this.col, this.ring);
        this.g.visible = false;
        this.hex = "#FFD54F"; this.r = 3; this.key = null;
        ctx.scene.add(this.g);
    }
    show(key, x, z, hex = "#FFD54F", r = 3, h = 34) {
        this.key = key;
        if (hex !== this.hex) { const m = matsFor(hex); this.col.material = m.col; this.ring.material = m.ring; this.hex = hex; }
        this.g.position.set(x, 0, z);
        this.col.scale.set(r * 0.55, h, r * 0.55);
        this.r = r;
        this.g.visible = true;
    }
    hide() { this.g.visible = false; this.key = null; }
}
const pool = [];
/** Show beacon `key` at (x, z): a pooled beacon (the same key keeps its beacon). Returns false when the pool is full. */
export function beacon(key, x, z, hex, r, h) {
    if (!ctx.scene) return false;
    let b = pool.find(p => p.key === key) || pool.find(p => p.key == null);
    if (!b && pool.length < BEACONS) { b = new Beacon(); pool.push(b); }
    if (!b) return false;
    b.show(key, x, z, hex, r, h);
    return true;
}
export function hideBeacon(key) { for (const b of pool) if (b.key === key) b.hide(); }
/** Hide every beacon whose key starts with `prefix` (all of them for ""). */
export function hideBeacons(prefix = "") { for (const b of pool) if (b.key != null && String(b.key).startsWith(prefix)) b.hide(); }
export function beaconCount() { return pool.filter(b => b.g.visible).length; }

// ── roof props ───────────────────────────────────────────────────────────
const P = { geo: null };
function parts() {
    if (P.geo) return P;
    P.geo = {
        bar: new THREE.BoxGeometry(0.6, 0.2, 0.32),
        pan: new THREE.CylinderGeometry(0.42, 0.36, 0.16, 18),
        kugel: new THREE.CylinderGeometry(0.37, 0.37, 0.14, 18),
        bag: new THREE.SphereGeometry(0.34, 14, 10),
        knot: new THREE.CylinderGeometry(0.08, 0.14, 0.18, 10),
        steam: new THREE.SphereGeometry(0.12, 8, 6),
    };
    P.mat = {
        red: new THREE.MeshStandardMaterial({ color: "#ff1744", emissive: "#ff1744", emissiveIntensity: 2 }),
        blue: new THREE.MeshStandardMaterial({ color: "#2979ff", emissive: "#2979ff", emissiveIntensity: 2 }),
        pan: new THREE.MeshStandardMaterial({ color: "#9E9E9E", metalness: 0.7, roughness: 0.35 }),
        kugel: new THREE.MeshStandardMaterial({ color: "#E0A030", emissive: "#FF6D00", emissiveIntensity: 0.4, roughness: 0.6 }),
        bag: new THREE.MeshStandardMaterial({ color: "#C8B07A", roughness: 0.9 }),
        steam: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55, depthWrite: false }),
    };
    return P;
}
/** A roof prop group for `kind`: "cop" | "kugel" | "stash" (attach it to a car's tilt node). */
export function roofProp(kind) {
    const { geo, mat } = parts();
    const g = new THREE.Group();
    g.userData.kind = kind;
    if (kind === "cop") {
        const r = new THREE.Mesh(geo.bar, mat.red), b = new THREE.Mesh(geo.bar, mat.blue);
        r.position.x = 0.32; b.position.x = -0.32;
        g.add(r, b);
        g.position.set(0, 1.6, -0.35);
    } else if (kind === "kugel") {
        const pan = new THREE.Mesh(geo.pan, mat.pan), k = new THREE.Mesh(geo.kugel, mat.kugel);
        k.position.y = 0.06;
        g.add(pan, k);
        for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(geo.steam, mat.steam); s.userData.steam = i; g.add(s); }
        g.position.set(0, 1.5, -0.6);
    } else {
        const bag = new THREE.Mesh(geo.bag, mat.bag), knot = new THREE.Mesh(geo.knot, mat.bag);
        bag.scale.set(1, 0.9, 1); knot.position.y = 0.36;
        g.add(bag, knot);
        g.position.set(0, 1.45, -0.7);
    }
    return g;
}
/** Per frame: flash every light bar, puff the kugel's steam (shared materials: one write each). */
export function tickProps(t, props) {
    if (!P.mat) return;
    const flash = Math.floor(t * 6.5) % 2;
    P.mat.red.emissiveIntensity = flash ? 3.2 : 0.4;
    P.mat.blue.emissiveIntensity = flash ? 0.4 : 3.2;
    P.mat.kugel.emissiveIntensity = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 9));
    for (const g of props) {
        if (!g || g.userData.kind !== "kugel" || !g.visible) continue;
        for (const s of g.children) {
            if (s.userData.steam == null) continue;
            const u = (t * 0.8 + s.userData.steam / 3) % 1;
            s.position.set(Math.sin(u * 9 + s.userData.steam) * 0.12, 0.2 + u * 0.9, 0);
            s.scale.setScalar(0.6 + u * 1.4);
        }
    }
    for (const m of mats.values()) m.col.uniforms.time.value = t;
}
