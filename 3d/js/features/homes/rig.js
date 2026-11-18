// features/homes — INSTANCED RIGS: a whole crowd of Blender people (or dogs, or props) in a handful of draw calls.
//
// A template (a lib_people person: Body + Arm_L/R + Leg_L/R, or a four-legged rig) is baked ONCE into one
// vertex-coloured geometry per moving part, in that part's own frame. Each part is ONE InstancedMesh, so a
// template is ~5 draw calls however many of it walk the town. Per-instance colours: materials named Top /
// Bottom / Hair (people) or Fur / Fur2 / Paint / Canopy (dogs, props) carry a vertex "slot" and the shared
// material's shader swaps in that instance's iTop / iBot / iHair colour. Each frame the crowd fills the rigs
// with only the instances that are drawn (begin → add… → end), so a far / hidden ped costs nothing on the GPU.
import * as THREE from "three";

const SLOT = { Top: 1, Bottom: 2, Hair: 3, Fur: 1, Fur2: 2, Paint: 1, Canopy: 1, ScooterDeck: 1, BucketRed: 1, Balloon: 1, DeliveryGreen: 1 };
let MAT = null;
/** The one material every crowd rig shares (vertex colours + the per-instance slot colours; no shadows). */
export function crowdMaterial() {
    if (MAT) return MAT;
    MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });
    MAT.onBeforeCompile = sh => {
        sh.vertexShader = sh.vertexShader
            .replace("#include <common>", "#include <common>\nattribute float slot;\nattribute vec3 iTop;\nattribute vec3 iBot;\nattribute vec3 iHair;")
            .replace("#include <color_vertex>", "#include <color_vertex>\n#ifdef USE_COLOR\nif (slot > 0.5) vColor.xyz = slot < 1.5 ? iTop : (slot < 2.5 ? iBot : iHair);\n#endif");
    };
    MAT.customProgramCacheKey = () => "homesCrowd1";
    return MAT;
}

const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3(), _c = new THREE.Color();

/** Bake meshes (each with a matrix into the target frame) into ONE indexed geometry: position, normal, color, slot. */
function bakeMeshes(list) {
    let nv = 0, ni = 0;
    for (const { mesh } of list) { const g = mesh.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3), S = new Float32Array(nv);
    const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let ov = 0, oi = 0;
    for (const { mesh, m } of list) {
        const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        _c.copy(mat.color || _c.set(1, 1, 1));
        const slot = SLOT[mat.name] || 0;
        _n.getNormalMatrix(m);
        for (let i = 0; i < n; i++) {
            _v.fromBufferAttribute(pos, i).applyMatrix4(m);
            P[(ov + i) * 3] = _v.x; P[(ov + i) * 3 + 1] = _v.y; P[(ov + i) * 3 + 2] = _v.z;
            if (nor) { _v.fromBufferAttribute(nor, i).applyMatrix3(_n).normalize(); N[(ov + i) * 3] = _v.x; N[(ov + i) * 3 + 1] = _v.y; N[(ov + i) * 3 + 2] = _v.z; }
            C[(ov + i) * 3] = _c.r; C[(ov + i) * 3 + 1] = _c.g; C[(ov + i) * 3 + 2] = _c.b;
            S[ov + i] = slot;
        }
        if (g.index) for (let k = 0; k < g.index.count; k++) I[oi + k] = g.index.getX(k) + ov;
        else for (let k = 0; k < n; k++) I[oi + k] = ov + k;
        oi += g.index ? g.index.count : n;
        ov += n;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(P, 3));
    out.setAttribute("normal", new THREE.BufferAttribute(N, 3));
    out.setAttribute("color", new THREE.BufferAttribute(C, 3));
    out.setAttribute("slot", new THREE.BufferAttribute(S, 1));
    out.setIndex(new THREE.BufferAttribute(I, 1));
    out.computeBoundingSphere();
    return out;
}

/**
 * An instanced rig of `template` (a loaded model). parts: node names that move on their own (each is
 * posed every frame); everything else is baked into a static "rest" part. max: the most drawn at once.
 * rig.begin(); const i = rig.add(owner, colors); rig.pose(i, part, matrix) …; rig.end().
 */
export class Rig {
    constructor(template, parts, max, { name = "rig" } = {}) {
        this.max = max;
        this.group = new THREE.Group();
        this.group.name = "HomesRig:" + name;
        template.updateMatrixWorld(true);
        const rootInv = template.matrixWorld.clone().invert();
        const nodes = {};
        for (const p of parts) {
            let found = null;
            template.traverse(o => { if (!found && o.name && o.name.startsWith(p) && o !== template) found = o; });
            if (found) nodes[p] = found;
        }
        const owner = mesh => { let o = mesh; while (o && o !== template) { for (const p in nodes) if (nodes[p] === o) return p; o = o.parent; } return "_rest"; };
        const lists = { _rest: [] };
        for (const p in nodes) lists[p] = [];
        template.traverse(o => {
            if (!o.isMesh) return;
            const p = owner(o);
            // into the part's own frame (or the template root's, for the rest)
            const frame = p === "_rest" ? rootInv : nodes[p].matrixWorld.clone().invert();
            lists[p].push({ mesh: o, m: frame.clone().multiply(o.matrixWorld) });
        });
        this.parts = {};
        this.tris = 0;
        for (const p in lists) {
            if (!lists[p].length) continue;
            const geo = bakeMeshes(lists[p]);
            this.tris += geo.index.count / 3;
            for (const nm of ["iTop", "iBot", "iHair"]) { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(nm, a); }
            const im = new THREE.InstancedMesh(geo, crowdMaterial(), max);
            im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            im.frustumCulled = false;
            im.castShadow = false; im.receiveShadow = true;
            im.count = 0;
            im.name = name + ":" + p;
            this.group.add(im);
            const node = nodes[p];
            const parentM = node ? rootInv.clone().multiply(node.parent.matrixWorld) : new THREE.Matrix4();
            this.parts[p] = { im, geo, parentM, pos: node ? node.position.clone() : new THREE.Vector3(), quat: node ? node.quaternion.clone() : new THREE.Quaternion(), scale: node ? node.scale.clone() : new THREE.Vector3(1, 1, 1) };
        }
        this.list = Object.values(this.parts);
        this.n = 0;
        this.owners = new Array(max).fill(null);
        this.dirtyColor = false;
    }
    begin() { this.n = 0; }
    /** Claim the next instance for `owner` (its colours {top, bot, hair} as THREE.Color) → index, or -1 when full. */
    add(owner, colors) {
        if (this.n >= this.max) return -1;
        const i = this.n++;
        if (this.owners[i] !== owner) {
            this.owners[i] = owner;
            if (colors) for (const P of this.list) {
                const a = P.geo.attributes;
                a.iTop.setXYZ(i, colors.top.r, colors.top.g, colors.top.b);
                a.iBot.setXYZ(i, colors.bot.r, colors.bot.g, colors.bot.b);
                a.iHair.setXYZ(i, colors.hair.r, colors.hair.g, colors.hair.b);
            }
            this.dirtyColor = true;
        }
        return i;
    }
    /** A part's local transform: root matrix (world) × the part's parent frame × T(pos + dp) R(rest ∘ q). */
    pose(i, part, root, q = null, dp = null) {
        const P = this.parts[part];
        if (!P) return null;
        _v.copy(P.pos); if (dp) _v.add(dp);
        _q.copy(P.quat); if (q) _q.multiply(q);
        _m.compose(_v, _q, P.scale);
        _m2.multiplyMatrices(root, P.parentM).multiply(_m);
        P.im.setMatrixAt(i, _m2);
        return _m2;
    }
    /** Every part in its rest pose (props, a far / still figure). */
    still(i, root) { for (const k in this.parts) this.pose(i, k, root); }
    end() {
        for (const P of this.list) {
            P.im.count = this.n;
            P.im.visible = this.n > 0;
            if (this.n) P.im.instanceMatrix.needsUpdate = true;
            if (this.dirtyColor) for (const nm of ["iTop", "iBot", "iHair"]) P.geo.attributes[nm].needsUpdate = true;
        }
        this.dirtyColor = false;
    }
    dispose() { for (const P of this.list) { P.geo.dispose(); P.im.dispose(); } if (this.group.parent) this.group.parent.remove(this.group); }
}
const _q = new THREE.Quaternion(), _m2 = new THREE.Matrix4();

/** The far-LOD figure: ~70 triangles, coloured by the same slots (legs/skirt = Bottom, torso = Top, hair). */
export function lodGeometry() {
    const parts = [];
    const add = (g, slot, color, y) => { g.translate(0, y, 0); const n = g.attributes.position.count; const c = new THREE.Color(color), C = new Float32Array(n * 3), S = new Float32Array(n).fill(slot);
        for (let i = 0; i < n; i++) { C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b; }
        g.setAttribute("color", new THREE.BufferAttribute(C, 3)); g.setAttribute("slot", new THREE.BufferAttribute(S, 1)); g.deleteAttribute("uv"); parts.push(g.index ? g.toNonIndexed() : g); };
    add(new THREE.CylinderGeometry(0.17, 0.24, 0.8, 7, 1), 2, "#333", 0.4);
    add(new THREE.CylinderGeometry(0.2, 0.17, 0.55, 7, 1), 1, "#888", 1.07);
    add(new THREE.SphereGeometry(0.19, 7, 5), 0, "#FFD2B0", 1.55);
    add(new THREE.SphereGeometry(0.2, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), 3, "#333", 1.58);
    // merge (non-indexed)
    let n = 0; for (const g of parts) n += g.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), S = new Float32Array(n);
    let o = 0;
    for (const g of parts) { const c = g.attributes.position.count; P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); S.set(g.attributes.slot.array, o); o += c; g.dispose(); }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(P, 3));
    out.setAttribute("normal", new THREE.BufferAttribute(N, 3));
    out.setAttribute("color", new THREE.BufferAttribute(C, 3));
    out.setAttribute("slot", new THREE.BufferAttribute(S, 1));
    out.computeBoundingSphere();
    return out;
}
/** An instanced mesh of the LOD figure (one draw call for every far ped in town). */
export class LodCrowd {
    constructor(max) {
        this.max = max;
        this.geo = lodGeometry();
        for (const nm of ["iTop", "iBot", "iHair"]) { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3); a.setUsage(THREE.DynamicDrawUsage); this.geo.setAttribute(nm, a); }
        this.im = new THREE.InstancedMesh(this.geo, crowdMaterial(), max);
        this.im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.im.frustumCulled = false; this.im.castShadow = false; this.im.receiveShadow = false;
        this.im.name = "HomesCrowdLOD";
        this.owners = new Array(max).fill(null);
        this.n = 0; this.dirty = false;
    }
    begin() { this.n = 0; }
    add(owner, colors, m) {
        if (this.n >= this.max) return -1;
        const i = this.n++;
        if (this.owners[i] !== owner) {
            this.owners[i] = owner;
            const a = this.geo.attributes;
            a.iTop.setXYZ(i, colors.top.r, colors.top.g, colors.top.b); a.iBot.setXYZ(i, colors.bot.r, colors.bot.g, colors.bot.b); a.iHair.setXYZ(i, colors.hair.r, colors.hair.g, colors.hair.b);
            this.dirty = true;
        }
        this.im.setMatrixAt(i, m);
        return i;
    }
    end() {
        this.im.count = this.n; this.im.visible = this.n > 0;
        if (this.n) this.im.instanceMatrix.needsUpdate = true;
        if (this.dirty) { for (const nm of ["iTop", "iBot", "iHair"]) this.geo.attributes[nm].needsUpdate = true; this.dirty = false; }
    }
    dispose() { this.geo.dispose(); this.im.dispose(); if (this.im.parent) this.im.parent.remove(this.im); }
}
