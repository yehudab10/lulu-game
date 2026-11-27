// features/houseitems — code-built props for the round-2 items (no new .glb): a few boxes baked into ONE vertex-coloured
// mesh each. Box = [w, h, d, x, y, z, rotY, colour]; the origin is where the hand holds it / the table it sits on.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const SHAPES = {
    rollingpin: [[0.08, 0.08, 0.42, 0, 0.04, 0, 0, "#D7B98E"], [0.04, 0.04, 0.12, 0, 0.04, 0.26, 0, "#A1887F"], [0.04, 0.04, 0.12, 0, 0.04, -0.26, 0, "#A1887F"]],
    rugelach: [[0.24, 0.02, 0.24, 0, 0.01, 0, 0, "#FAFAFA"], [0.06, 0.04, 0.05, -0.05, 0.04, 0.03, 0.4, "#C68E54"], [0.06, 0.04, 0.05, 0.05, 0.04, -0.02, -0.3, "#B87A42"], [0.06, 0.04, 0.05, 0.02, 0.04, 0.07, 1.1, "#C68E54"], [0.06, 0.04, 0.05, -0.03, 0.08, 0.01, 0.8, "#A86A34"]],
    challah: [[0.12, 0.09, 0.32, 0, 0.045, 0, 0, "#C77B30"], [0.1, 0.06, 0.1, 0, 0.11, -0.08, 0.3, "#D4914A"], [0.1, 0.06, 0.1, 0, 0.11, 0.06, -0.3, "#D4914A"]],
    lampshade: [[0.34, 0.24, 0.34, 0, 0.12, 0, 0.785, "#F5E6C8"], [0.26, 0.02, 0.26, 0, 0.25, 0, 0.785, "#E0C9A0"], [0.38, 0.02, 0.38, 0, 0.005, 0, 0.785, "#C9A66B"]],
    trophy: [[0.14, 0.05, 0.14, 0, 0.025, 0, 0, "#3E2723"], [0.04, 0.16, 0.04, 0, 0.13, 0, 0, "#FFD54F"], [0.1, 0.06, 0.1, 0, 0.24, 0, 0, "#FFC107"], [0.06, 0.08, 0.06, 0, 0.3, 0, 0, "#212121"]],
    hat: [[0.34, 0.015, 0.36, 0, 0.0075, 0, 0, "#111111"], [0.2, 0.15, 0.22, 0, 0.09, 0, 0, "#151515"], [0.205, 0.025, 0.225, 0, 0.03, 0, 0, "#2B2B2B"]],
    broom: [[0.03, 1.0, 0.03, 0, 0.5, 0, 0, "#A1887F"], [0.22, 0.2, 0.06, 0, 0.06, 0, 0, "#E2C26A"], [0.24, 0.04, 0.08, 0, 0.17, 0, 0, "#C62828"]],
    spray: [[0.08, 0.18, 0.08, 0, 0.09, 0, 0, "#4FC3F7"], [0.05, 0.05, 0.05, 0, 0.205, 0, 0, "#FAFAFA"], [0.03, 0.03, 0.06, 0, 0.215, 0.04, 0, "#FAFAFA"]],
};
let mat = null;
const cache = new Map();
/** A fresh mesh for item prop `kind` (geometry shared per kind) | null. */
export function makeProp(kind) {
    const parts = SHAPES[kind];
    if (!parts) return null;
    let geo = cache.get(kind);
    if (!geo) {
        const geos = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), c = new THREE.Color();
        for (const b of parts) {
            const g = new THREE.BoxGeometry(b[0], b[1], b[2]);
            e.set(0, b[6] || 0, 0); q.setFromEuler(e); p.set(b[3], b[4], b[5]);
            g.applyMatrix4(m.compose(p, q, sc));
            c.set(b[7]);
            const n = g.attributes.position.count, col = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
            g.setAttribute("color", new THREE.BufferAttribute(col, 3));
            geos.push(g);
        }
        geo = mergeGeometries(geos, false);
        for (const g of geos) g.dispose();
        cache.set(kind, geo);
    }
    if (!mat) mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "Prop_" + kind;
    return mesh;
}
export const PROP_KINDS = Object.keys(SHAPES);
