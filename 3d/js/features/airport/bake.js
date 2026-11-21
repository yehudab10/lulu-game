// features/airport — one draw call per moving vehicle KIND: a model's parts baked into ONE vertex-coloured geometry
// (tints by material name), drawn as one InstancedMesh. Used for the kerb's taxis + shuttles and the planes (a baked copy
// per livery). The look is plain (no glass / glowing lamps of their own) — they're seen across a car park or in the sky.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const MAT = new Map();
/** The shared vertex-coloured material (one per roughness). */
export function bakedMaterial(rough = 0.5) {
    if (!MAT.has(rough)) MAT.set(rough, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: 0.08 }));
    return MAT.get(rough);
}
/** Template → one geometry (position, normal, colour). tints: { MatName: "#hex" }; keep(matName) filters parts. */
export function bakeTemplate(template, tints = {}, keep = null) {
    template.updateMatrixWorld(true);
    const inv = template.matrixWorld.clone().invert(), list = [], c = new THREE.Color();
    template.traverse(o => {
        if (!o.isMesh) return;
        const name = (o.material && o.material.name) || "";
        if (keep && !keep(name)) return;
        let g = o.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
        g.morphAttributes = {};
        g.applyMatrix4(inv.clone().multiply(o.matrixWorld));
        if (g.index) g = g.toNonIndexed();
        if (!g.attributes.normal) g.computeVertexNormals();
        c.set(tints[name] || (o.material && o.material.color) || "#ffffff");
        const n = g.attributes.position.count, col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        g.setAttribute("color", new THREE.BufferAttribute(col, 3));
        list.push(g);
    });
    const out = list.length ? mergeGeometries(list, false) : new THREE.BufferGeometry();
    for (const g of list) g.dispose();
    out.computeBoundingSphere();
    return out;
}
/** An InstancedMesh of a baked template (all instances hidden until set). */
export function bakedInstanced(template, n, tints = {}, keep = null, rough = 0.5) {
    const im = new THREE.InstancedMesh(bakeTemplate(template, tints, keep), bakedMaterial(rough), n);
    const z = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) im.setMatrixAt(i, z);
    im.frustumCulled = false;
    im.castShadow = false; im.receiveShadow = true;
    return im;
}
