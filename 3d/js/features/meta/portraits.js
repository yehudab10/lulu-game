// features/meta — Polaroid portraits of the 3D cast for the scrapbook.
// The real Blender characters are rendered once (main renderer → an sRGB render
// target → a PNG data URL) and taped into the DOM pages. Lazy: models load the
// first time the scrapbook asks; anything that fails just keeps its emoji.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { models, ensureModels, cloneWithColors } from "../../models.js";

const cache = new Map();
let chain = Promise.resolve();

/** → Promise<dataURL | null>. key = a model key (luluPerson, avigailPerson, bubbe…). */
export function portrait(key, { colors = null, size = 168, yaw = 0.32, frame = 0.26 } = {}) {
    const id = key + "|" + JSON.stringify(colors || {}) + "|" + size + "|" + yaw;
    if (cache.has(id)) return cache.get(id);
    const p = (chain = chain.then(() => render(key, colors, size, yaw, frame)).catch(e => { console.warn("[meta] portrait", key, e); return null; }));
    cache.set(id, p);
    return p;
}

async function render(key, colors, size, yaw, frame) {
    await ensureModels([key]);
    const r = ctx.renderer;
    if (!r || !models[key]) return null;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#fff6e8", "#7a6a5a", 1.55));
    const keyL = new THREE.DirectionalLight("#fff1dc", 2.3);
    keyL.position.set(-1.4, 2.6, 3.2);
    const rim = new THREE.DirectionalLight("#d6ecff", 1.3);
    rim.position.set(2.2, 2.4, -2.4);
    scene.add(keyL, keyL.target, rim);
    const obj = cloneWithColors(models[key], colors);
    scene.add(obj);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const look = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y - frame, (box.min.z + box.max.z) / 2);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
    const d = 1.45;
    cam.position.set(look.x + Math.sin(yaw) * d, look.y + 0.07, look.z + Math.cos(yaw) * d);
    cam.lookAt(look);
    const S = size * 2;
    const rt = new THREE.WebGLRenderTarget(S, S, { colorSpace: THREE.SRGBColorSpace });
    const prev = r.getRenderTarget(), cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
    const buf = new Uint8Array(S * S * 4);
    try {
        r.setRenderTarget(rt);
        r.setClearColor(0x000000, 0);
        r.clear();
        r.render(scene, cam);
        r.readRenderTargetPixels(rt, 0, 0, S, S, buf);
    } finally {
        r.setRenderTarget(prev);
        r.setClearColor(cc, ca);
        rt.dispose();
        scene.remove(obj);
    }
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) img.data.set(buf.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
    g.putImageData(img, 0, 0);
    const o = document.createElement("canvas");
    o.width = o.height = size;
    const og = o.getContext("2d");
    og.imageSmoothingQuality = "high";
    og.drawImage(c, 0, 0, size, size);
    return o.toDataURL("image/png");
}

/** Fill every [data-portrait] element inside `root` (its emoji stays until the image is ready). */
export function fillPortraits(root, specs) {
    for (const el of root.querySelectorAll("[data-portrait]")) {
        const spec = specs[el.dataset.portrait];
        if (!spec) continue;
        portrait(spec.key, spec).then(url => {
            if (!url || !el.isConnected) return;
            el.style.backgroundImage = `url(${url})` + (el.classList.contains("mug") ? ", repeating-linear-gradient(180deg, transparent 0 15px, rgba(0,0,0,.2) 15px 16px)" : "");
            el.classList.add("ready");
        });
    }
}
