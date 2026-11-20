// features/meta — THE CAR MENORAH, SLIMMED: the same Blender chanukiah (assets_meta.py `meta_menorah`), rebuilt once
// at load into a handful of draw calls instead of ~30.
//
//   before: 7 body materials (each drawn again in the shadow pass) + 9 flames × 2 materials + 9 glow sprites
//   after:  the body baked into 2 vertex-coloured meshes (the shiny gold, everything else) · the lit flames ONE
//           InstancedMesh (each flame still flickers on its own) · the glows ONE THREE.Points (same texture, same size)
//
// slimMenorah(template, lit) → { obj, tick(t), dispose(), flames, calls } — `obj` is placed / scaled exactly like the
// old clone (the car's anchors), so nothing else changes.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";

const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3(), _c = new THREE.Color(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();
const LOOKS = {};
function look(metal) {
    if (LOOKS[metal]) return LOOKS[metal];
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: metal ? 0.28 : 0.6, metalness: metal ? 0.85 : 0 });
    m.name = metal ? "MetaMenorahGold" : "MetaMenorahBody";
    return (LOOKS[metal] = m);
}
let FLAME_MAT = null;
const flameMat = () => FLAME_MAT || (FLAME_MAT = Object.assign(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), { name: "MetaMenorahFlame" }));

function bake(list) {
    let nv = 0, ni = 0;
    for (const { g } of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    if (!nv) return null;
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3), I = new Uint32Array(ni);
    let ov = 0, oi = 0;
    for (const { g, m, c } of list) {
        const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
        _n.getNormalMatrix(m);
        for (let i = 0; i < n; i++) {
            _v.fromBufferAttribute(pos, i).applyMatrix4(m); P.set([_v.x, _v.y, _v.z], (ov + i) * 3);
            if (nor) { _v.fromBufferAttribute(nor, i).applyMatrix3(_n).normalize(); N.set([_v.x, _v.y, _v.z], (ov + i) * 3); }
            C.set([c.r, c.g, c.b], (ov + i) * 3);
        }
        if (g.index) for (let k = 0; k < g.index.count; k++) I[oi + k] = g.index.getX(k) + ov;
        else for (let k = 0; k < n; k++) I[oi + k] = ov + k;
        oi += g.index ? g.index.count : n; ov += n;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(P, 3));
    out.setAttribute("normal", new THREE.BufferAttribute(N, 3));
    out.setAttribute("color", new THREE.BufferAttribute(C, 3));
    out.setIndex(new THREE.BufferAttribute(I, 1));
    out.computeBoundingSphere();
    return out;
}

// the flame's look on a plain (unlit, not tone-mapped) material: an emissive orange at intensity 4–6 renders as a
// pale cream through the game's filmic tone mapping — so: the colour, most of the way to white
function flameColor(mat) {
    _c.copy(mat.emissive && mat.emissiveIntensity > 0 ? mat.emissive : mat.color);
    const srgb = _c.clone().convertLinearToSRGB().lerp(new THREE.Color(1, 1, 1), 0.72);
    return srgb.convertSRGBToLinear();
}

const CACHE = new Map();      // template → the baked pieces (shared by every clone)
function pieces(template) {
    if (CACHE.has(template)) return CACHE.get(template);
    template.updateMatrixWorld(true);
    const inv = template.matrixWorld.clone().invert();
    const gold = [], body = [], flames = [];
    let flameGeo = null;
    template.traverse(o => {
        if (!/^Flame_/.test(o.name || "") || (o.parent && /^Flame_/.test(o.parent.name || ""))) return;
        // a flame node (Flame_1…8, Flame_S): its transform relative to the template, and its meshes in its own frame
        const local = inv.clone().multiply(o.matrixWorld);
        const n = /^Flame_S/.test(o.name) ? 0 : parseInt(o.name.slice(6), 10);
        flames.push({ n, local, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: new THREE.Vector3() });
        local.decompose(flames[flames.length - 1].pos, flames[flames.length - 1].quat, flames[flames.length - 1].scale);
        if (!flameGeo) {
            const own = o.matrixWorld.clone().invert(), list = [];
            o.traverse(x => { if (x.isMesh) list.push({ g: x.geometry, m: own.clone().multiply(x.matrixWorld), c: flameColor(x.material) }); });
            flameGeo = bake(list);
        }
    });
    template.traverse(o => {
        if (!o.isMesh) return;
        let p = o; while (p && p !== template) { if (/^Flame_/.test(p.name || "")) return; p = p.parent; }
        const mat = o.material, m = inv.clone().multiply(o.matrixWorld);
        (mat.metalness > 0.5 ? gold : body).push({ g: o.geometry, m, c: new THREE.Color().copy(mat.color) });
    });
    flames.sort((a, b) => a.n - b.n);
    const out = { gold: bake(gold), body: bake(body), flame: flameGeo, flames };
    CACHE.set(template, out);
    return out;
}

/** A slim car menorah with `lit` candles burning (+ the shamash). glowTex: the soft glow sprite texture. */
export function slimMenorah(template, lit, glowTex) {
    const P = pieces(template);
    const obj = new THREE.Group();
    obj.name = "MetaHoliday_menorah";
    for (const [geo, metal] of [[P.body, false], [P.gold, true]]) {
        if (!geo) continue;
        const mesh = new THREE.Mesh(geo, look(metal));
        mesh.castShadow = true; mesh.receiveShadow = true;
        obj.add(mesh);
    }
    const burning = P.flames.filter(f => f.n === 0 || f.n <= lit);
    let fm = null, pts = null, pos = null;
    if (P.flame && burning.length) {
        fm = new THREE.InstancedMesh(P.flame, flameMat(), burning.length);
        fm.frustumCulled = false; fm.castShadow = false; fm.receiveShadow = false;
        fm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        fm.name = "MetaMenorahFlames";
        obj.add(fm);
        pos = new Float32Array(burning.length * 3);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
        pts = new THREE.Points(g, new THREE.PointsMaterial({ map: glowTex, size: 0.1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
        pts.frustumCulled = false; pts.name = "MetaMenorahGlow"; pts.renderOrder = 2;
        obj.add(pts);
    }
    const flames = burning.map(f => ({ f, ph: f.n * 1.7 + 0.3 }));
    const ws = new THREE.Vector3();
    function tick(t) {
        if (!fm) return;
        for (let i = 0; i < flames.length; i++) {
            const { f, ph } = flames[i];
            // (the old per-node flicker: taller / thinner and back, a little sway)
            const k = 1 + Math.sin(t * 13 + ph) * 0.16 + Math.sin(t * 29 + ph * 2) * 0.06;
            _s.set(f.scale.x * (2 - k) * 0.95, f.scale.y * k, f.scale.z * (2 - k) * 0.95);
            _q.copy(f.quat).multiply(new THREE.Quaternion().setFromAxisAngle(_v.set(0, 0, 1), Math.sin(t * 7 + ph) * 0.12));
            _m.compose(f.pos, _q, _s);
            fm.setMatrixAt(i, _m);
            // the glow sat 4.5 cm above the wick, in the flame's own (flickering) frame
            _v.set(0, 0.045, 0).applyMatrix4(_m);
            pos[i * 3] = _v.x; pos[i * 3 + 1] = _v.y; pos[i * 3 + 2] = _v.z;
        }
        fm.instanceMatrix.needsUpdate = true;
        pts.geometry.attributes.position.needsUpdate = true;
        // the old sprites were 0.16 m in the flame's frame: a point of the same on-screen size
        obj.getWorldScale(ws);
        const cam = ctx.camera, tanHalf = cam && cam.isPerspectiveCamera ? Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) : 0.6;
        pts.material.size = 0.16 * (flames[0] ? flames[0].f.scale.y : 1) * ws.y / tanHalf;
    }
    tick(0);
    return {
        obj, tick, flames: flames.length,
        get calls() { return obj.children.length; },
        dispose() { if (pts) { pts.geometry.dispose(); pts.material.dispose(); } if (fm) fm.dispose(); if (obj.parent) obj.parent.remove(obj); },
    };
}
