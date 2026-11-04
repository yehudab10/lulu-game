// "Sets": small self-contained 3D scenes for interiors and minigames (the
// bar, the courtroom, Dina's bedroom, a parking lot…). A state shows its set
// by assigning ctx.view = set.view in enter() and ctx.view = null in exit();
// the driving world stays intact underneath, ready to resume.
//
//   const set = makeSet({ sky: "#ffe9c7", light: "indoor" });
//   set.add(mesh);  set.camera.position.set(...);  ctx.view = set.view;
//   …later: set.dispose();
import * as THREE from "three";
import { ctx, trackCamera, untrackCamera } from "./ctx.js";

const PRESETS = {
    day:    { hemi: ["#cfeaff", "#5f8a45", 1.35], sun: ["#fff1dc", 2.6], sky: "#a9dcff", fog: null },
    indoor: { hemi: ["#fff6e8", "#8a7a6a", 1.6], sun: ["#fff4e0", 1.4], sky: "#f6e7d0", fog: null },
    night:  { hemi: ["#5a6aa0", "#202030", 0.7], sun: ["#9fb0ff", 0.6], sky: "#121833", fog: null },
    dusk:   { hemi: ["#ffc7a8", "#5a4a6a", 1.1], sun: ["#ffb070", 2.0], sky: "#f6a77a", fog: null },
};

/**
 * opts: light: "day" | "indoor" | "night" | "dusk"; sky: css colour (background);
 *       fog: [near, far] or null; ground: css colour → adds a big floor plane;
 *       shadows: bool (default true); fov: number
 */
export function makeSet(opts = {}) {
    const P = PRESETS[opts.light || "day"];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(opts.sky || P.sky);
    if (opts.fog) scene.fog = new THREE.Fog(opts.sky || P.sky, opts.fog[0], opts.fog[1]);
    const hemi = new THREE.HemisphereLight(...P.hemi);
    const sun = new THREE.DirectionalLight(...P.sun);
    sun.position.set(-8, 16, -6);
    if (opts.shadows !== false) {
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 0.5, far: 60 });
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.03;
    }
    scene.add(hemi, sun, sun.target);
    const camera = trackCamera(new THREE.PerspectiveCamera(opts.fov || 55, 1, 0.05, 500));
    const disposables = [];
    if (opts.ground) {
        const g = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: opts.ground, roughness: 0.95 }));
        g.rotation.x = -Math.PI / 2;
        g.receiveShadow = true;
        scene.add(g);
        disposables.push(g.geometry, g.material);
    }
    const set = {
        scene, camera, hemi, sun,
        view: { scene, camera },
        add(...objs) { scene.add(...objs); return objs[0]; },
        /** Remember geometries/materials/textures to free in dispose(). */
        own(...things) { disposables.push(...things); return things[0]; },
        show() { ctx.view = set.view; },
        hide() { if (ctx.view === set.view) ctx.view = null; },
        dispose() {
            set.hide();
            untrackCamera(camera);
            for (const d of disposables) if (d && d.dispose) d.dispose();
            scene.traverse(o => { if (o.isMesh && o.userData.ownGeometry) o.geometry.dispose(); });
        },
    };
    return set;
}

/** A simple room: floor, back + side walls (open toward the camera at +Z). */
export function makeRoom(set, { w = 12, d = 10, h = 4, floor = "#c9a27a", walls = "#fbe9d0", trim = "#ffffff" } = {}) {
    const g = new THREE.Group();
    const mat = c => set.own(new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
    const box = (sx, sy, sz, c, x, y, z) => {
        const m = new THREE.Mesh(set.own(new THREE.BoxGeometry(sx, sy, sz)), mat(c));
        m.position.set(x, y, z); m.receiveShadow = true; m.castShadow = false;
        g.add(m); return m;
    };
    box(w, 0.1, d, floor, 0, -0.05, 0);
    box(w, h, 0.2, walls, 0, h / 2, -d / 2);
    box(0.2, h, d, walls, -w / 2, h / 2, 0);
    box(0.2, h, d, walls, w / 2, h / 2, 0);
    box(w, 0.25, 0.25, trim, 0, 0.12, -d / 2 + 0.12);
    set.add(g);
    return g;
}

/** Canvas-texture label/sign (for menus, signs, name plates inside sets). */
export function textPlane(lines, { w = 2, h = 0.6, bg = "#ffffff", fg = "#2b1b2e", font = 64 } = {}) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = Math.round(512 * h / w);
    const g = c.getContext("2d");
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
    const L = Array.isArray(lines) ? lines : [lines];
    L.forEach((t, i) => {
        g.font = `700 ${font}px Fredoka, Arial, sans-serif`;
        g.fillText(t, c.width / 2, c.height * (i + 0.5) / L.length, c.width - 20);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
    m.userData.ownGeometry = true;
    return m;
}
