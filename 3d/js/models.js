// Loads the Blender-made .glb models (3d/assets, built by 3d/blender/make_assets.py)
// and turns them into ready-to-use templates: shadows on, glass made see-through,
// per-car recolouring, wheel lookup, and cheap instancing for scenery.
//
// Features register their own models:
//     registerModels({ heshyPool: "heshy_pool", heshy: "heshy" });             // lazy
//     registerModels({ palm: "palm_tree" }, { preload: true });                // loaded at boot
//     await ensureModels(["heshyPool", "heshy"]);  models.heshyPool …
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const FILES = {};
const PRELOAD = new Set();

// The core set — always loaded at boot.
registerModels({
    lulu: "lulu_car", sedan: "sedan", cop: "cop_car", van: "van", truck: "truck",
    treeRound: "tree_round", treePine: "tree_pine", bush: "bush", house: "house",
    luluPerson: "lulu_person", dinaPerson: "dina_person",
}, { preload: true });
// The recurring cast + townsfolk (lazy: await ensureModels([...]) before spawning).
registerModels({
    npcWoman: "npc_woman", npcMan: "npc_man", npcKid: "npc_kid",
    avigailPerson: "avigail_person", heshyPerson: "heshy_person", imaPerson: "ima_person",
    copPerson: "cop_person", hillelPerson: "hillel_person",
});
// Used by the journey's first stop.
registerModels({ bubbeHouse: "bubbe_house", bubbe: "bubbe" }, { preload: true });

export const models = {};
const pending = new Map();
const loader = new GLTFLoader();

/** Map model keys → asset file names (without .glb). */
export function registerModels(map, { preload = false } = {}) {
    for (const [k, f] of Object.entries(map)) {
        FILES[k] = f;
        if (preload) PRELOAD.add(k);
    }
}

function loadOne(key) {
    if (models[key]) return Promise.resolve(models[key]);
    if (pending.has(key)) return pending.get(key);
    const file = FILES[key];
    if (!file) return Promise.reject(new Error(`unknown model "${key}" (registerModels first)`));
    const p = loader.loadAsync(`assets/${file}.glb`).then(gltf => {
        models[key] = prepare(gltf.scene);
        pending.delete(key);
        return models[key];
    });
    pending.set(key, p);
    return p;
}

/** Load models by key (cached). */
export function ensureModels(keys) { return Promise.all(keys.map(loadOne)); }

/** Boot: load everything registered with preload: true. */
export async function loadModels(onProgress) {
    const keys = [...PRELOAD];
    let done = 0;
    await Promise.all(keys.map(k => loadOne(k).then(() => { done++; if (onProgress) onProgress(done / keys.length); })));
    return models;
}

function prepare(root) {
    root.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        const m = o.material;
        if (m.name === "Glass") {
            m.transparent = true; m.opacity = 0.32; m.depthWrite = false;
            o.castShadow = false;
        } else if (m.name === "GlassTint") {
            m.metalness = 0.3; m.roughness = 0.12;
        } else if (/^Water/.test(m.name)) {
            m.transparent = true; m.opacity = 0.82; o.castShadow = false;
        }
        if (/Headlight|Taillight|LightRed|LightBlue|Window|Neon/.test(m.name)) o.castShadow = false;
    });
    return root;
}

/** Find a node by (sanitized) name prefix: "Wheel_FL" matches "Wheel_FL001". */
export function findNodes(root, prefix) {
    const out = [];
    root.traverse(o => { if (o.name && o.name.startsWith(prefix)) out.push(o); });
    // keep only the top-most match of each branch (a Group and its child Meshes share names)
    return out.filter(o => !out.includes(o.parent));
}

const matCache = new Map();
/** Clone a template, recolouring materials by name: {Paint: "#ff0000"}. */
export function cloneWithColors(template, colors) {
    const c = template.clone(true);
    if (!colors) return c;
    c.traverse(o => {
        if (!o.isMesh) return;
        const name = o.material.name;
        const hex = colors[name];
        if (!hex) return;
        const key = o.material.uuid + hex;
        let m = matCache.get(key);
        if (!m) {
            m = o.material.clone();
            m.color.set(hex);
            matCache.set(key, m);
        }
        o.material = m;
    });
    return c;
}

/** Collect each mesh of a template with its transform relative to the template root. */
function partsOf(template) {
    if (template.userData.parts) return template.userData.parts;
    template.updateMatrixWorld(true);
    const inv = template.matrixWorld.clone().invert();
    const parts = [];
    template.traverse(o => {
        if (o.isMesh) parts.push({ geometry: o.geometry, material: o.material, local: inv.clone().multiply(o.matrixWorld), cast: o.castShadow });
    });
    template.userData.parts = parts;
    return parts;
}

const whiteMats = new Map();
/**
 * Instanced copies of a (multi-material) template: one InstancedMesh per part,
 * so a whole forest is a couple of draw calls. `tint` lists material names whose
 * colour varies per instance (set with .color()).
 */
export function instanced(template, count, tint = []) {
    const parts = partsOf(template);
    const group = new THREE.Group();
    const meshes = parts.map(p => {
        let mat = p.material;
        const tinted = tint.includes(mat.name);
        if (tinted) {
            let w = whiteMats.get(mat.uuid);
            if (!w) { w = mat.clone(); w.color.set(0xffffff); whiteMats.set(mat.uuid, w); }
            mat = w;
        }
        const im = new THREE.InstancedMesh(p.geometry, mat, count);
        im.castShadow = p.cast;
        im.receiveShadow = true;
        im.userData.local = p.local;
        im.userData.tinted = tinted;
        im.userData.base = p.material.color.clone();
        im.userData.matName = p.material.name;
        group.add(im);
        return im;
    });
    const tmp = new THREE.Matrix4();
    return {
        group,
        set(i, matrix) {
            for (const im of meshes) im.setMatrixAt(i, tmp.multiplyMatrices(matrix, im.userData.local));
        },
        color(i, matName, color) {
            for (const im of meshes) if (im.userData.tinted && im.userData.matName === matName) im.setColorAt(i, color);
        },
        finish() {
            for (const im of meshes) {
                if (im.userData.tinted && !im.instanceColor) for (let i = 0; i < count; i++) im.setColorAt(i, im.userData.base);
                im.instanceMatrix.needsUpdate = true;
                if (im.instanceColor) im.instanceColor.needsUpdate = true;
                im.computeBoundingSphere();
            }
        },
        dispose() { for (const im of meshes) im.dispose(); },
    };
}
