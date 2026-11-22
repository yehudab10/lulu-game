// features/cityhall/rooms.js — a row of dollhouse rooms (the front wall cut away) for city hall's inside, built from
// homes' furniture kit (homes_kit.glb: Kit_<name>) + boxes — the same idea as realestate's rooms, with this building's
// own widths. Plus a canvas-sign helper (everything it makes is owned by the room: disposed when she leaves).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { models, findNodes } from "../../models.js";

export const W = 6.2, D = 5.6, WALL = 2.9;

export function kit(name) {
    const src = models.homesKit && findNodes(models.homesKit, "Kit_" + name)[0];
    if (!src) return new THREE.Group();
    const c = src.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0);
    return c;
}

/**
 * Build `n` rooms in a row (centres at x = (i − (n − 1) / 2) · W). opts: { floors, walls, door (room index of the front
 * door), doorDx }. Sets rt.bounds / rt.cols / rt.spots.door. → { cx, doorX, X0, X1, box, col, put, mat, sign, bake }
 */
export function rooms(rt, n, opts = {}) {
    const M = (c, o = {}) => rt.own(new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85 }, o)));
    const mats = new Map();
    const mat = c => { if (!mats.has(c)) mats.set(c, M(c)); return mats.get(c); };
    const boxes = [];
    const box = (w, h, d, m, x, y, z) => { const g = rt.own(new THREE.BoxGeometry(w, h, d)); const o = new THREE.Mesh(g, typeof m === "string" ? mat(m) : m); o.position.set(x, y, z); o.receiveShadow = true; o.castShadow = h > 1; rt.add(o); boxes.push(o); return o; };
    /** Merge every plain opaque box made so far into ONE vertex-coloured mesh (call once, after the last box is placed /
     *  turned): a room of ~150 boxes is then one draw call instead of 150. Boxes with a see-through material stay. */
    const bake = () => {
        const geos = [], c = new THREE.Color();
        for (const o of boxes) {
            const m = o.material;
            if (!o.parent || !m || m.transparent || m.map || !m.color) continue;
            o.updateMatrix();
            const g = o.geometry.clone().applyMatrix4(o.matrix);
            const n = g.attributes.position.count, col = new Float32Array(n * 3);
            c.copy(m.color);
            for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
            g.setAttribute("color", new THREE.BufferAttribute(col, 3));
            geos.push(g.index ? g.toNonIndexed() : g);
            o.parent.remove(o);
        }
        boxes.length = 0;
        if (!geos.length) return null;
        const geo = rt.own(mergeGeometries(geos, false));
        for (const g of geos) g.dispose();
        const mesh = new THREE.Mesh(geo, M("#FFFFFF", { vertexColors: true }));
        mesh.receiveShadow = true; mesh.castShadow = true;
        rt.add(mesh);
        return mesh;
    };
    const cx = []; for (let i = 0; i < n; i++) cx.push((i - (n - 1) / 2) * W);
    const X0 = cx[0] - W / 2, X1 = cx[n - 1] + W / 2;
    rt.bounds = { x0: X0 + 0.3, x1: X1 - 0.3, z0: -D / 2 + 0.3, z1: D / 2 - 0.35 };
    rt.cols.length = 0;
    const col = (id, x0, x1, z0, z1) => rt.cols.push({ id, x0, x1, z0, z1, on: true });
    const floors = opts.floors || ["#C79A6A"], walls = opts.walls || ["#F3E5D0"];
    const trim = mat("#FFFFFF");
    for (let i = 0; i < n; i++) {
        box(W, 0.06, D, floors[i % floors.length], cx[i], -0.03, 0);
        box(W, WALL, 0.14, walls[i % walls.length], cx[i], WALL / 2, -D / 2 - 0.07);
        box(W, 0.12, 0.05, trim, cx[i], 0.06, -D / 2 + 0.03);
        box(W, 0.14, 0.06, trim, cx[i], WALL - 0.07, -D / 2 + 0.03);     // a crown moulding: it's a GOVERNMENT building
    }
    col("back", X0 - 1, X1 + 1, -D / 2 - 0.4, -D / 2 + 0.12);
    box(0.14, WALL, D, walls[0], X0, WALL / 2, 0);
    box(0.14, WALL, D, walls[(n - 1) % walls.length], X1, WALL / 2, 0);
    const g0 = -0.1, g1 = 1.3;
    for (let i = 1; i < n; i++) {
        const x = cx[i] - W / 2;
        for (const [za, zb] of [[-D / 2, g0], [g1, D / 2]]) {
            box(0.12, WALL, zb - za, walls[(i - 1) % walls.length], x, WALL / 2, (za + zb) / 2);
            col("p" + i + za, x - 0.1, x + 0.1, za, zb);
        }
        box(0.12, 0.3, g1 - g0, trim, x, WALL - 0.15, (g0 + g1) / 2);
    }
    const doorX = cx[Math.min(n - 1, opts.door || 0)] + (opts.doorDx != null ? opts.doorDx : 1.2);
    box(doorX - 0.62 - X0, 0.5, 0.12, trim, (X0 + doorX - 0.62) / 2, 0.25, D / 2);
    box(X1 - doorX - 0.62, 0.5, 0.12, trim, (doorX + 0.62 + X1) / 2, 0.25, D / 2);
    col("f1", X0 - 1, doorX - 0.62, D / 2 - 0.12, D / 2 + 1);
    col("f2", doorX + 0.62, X1 + 1, D / 2 - 0.12, D / 2 + 1);
    const door = kit("Door"); door.position.set(doorX, 0, D / 2); rt.add(door);
    rt.spots.door = { x: doorX, z: D / 2 - 0.8, ry: Math.PI };
    /** A kit piece at (x, z), turned ry, with a collision box cw × cd (0 = walk-through). */
    const put = (name, x, z, ry = 0, cw = 0, cd = 0, y = 0) => {
        const o = kit(name); o.position.set(x, y, z); o.rotation.y = ry; rt.add(o);
        o.traverse(m => { if (m.isMesh) m.castShadow = false; });
        if (cw) { const sw = Math.abs(Math.cos(ry)) > 0.5, hw = (sw ? cw : cd) / 2, hd = (sw ? cd : cw) / 2; col(name + x.toFixed(1), x - hw, x + hw, z - hd, z + hd); }
        return o;
    };
    /** A flat canvas sign facing +z at (x, y, z): lines of text, w × h metres. → the mesh (its texture: mesh.userData.tex) */
    const sign = (lines, x, y, z, w, h, { bg = "#FFFFFF", fg = "#1B1B1B", font = 64, border = null, ry = 0, sizes = null } = {}) => {
        const tex = rt.own(signTexture(lines, w, h, { bg, fg, font, border, sizes }));
        const m = new THREE.Mesh(rt.own(new THREE.PlaneGeometry(w, h)), rt.own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 })));
        m.position.set(x, y, z); m.rotation.y = ry; m.userData.tex = tex; rt.add(m);
        return m;
    };
    return { cx, doorX, X0, X1, box, col, put, mat, sign, bake };
}

/** A canvas texture with centred lines of text (the first line bigger). */
export function signTexture(lines, w, h, { bg = "#FFFFFF", fg = "#1B1B1B", font = 64, border = null, sizes = null } = {}) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = Math.max(32, Math.round(512 * h / w));
    const g = c.getContext("2d");
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    if (border) { g.strokeStyle = border; g.lineWidth = 12; g.strokeRect(6, 6, c.width - 12, c.height - 12); }
    const L = Array.isArray(lines) ? lines : [lines];
    const fgs = Array.isArray(fg) ? fg : [fg];
    g.textAlign = "center"; g.textBaseline = "middle";
    L.forEach((t, i) => {
        const size = Math.min(font * (sizes ? sizes[i] || 1 : i === 0 ? 1 : 0.62), c.height / L.length * (sizes ? 1.25 : 0.8));
        g.font = `700 ${Math.round(size)}px Fredoka, Arial, sans-serif`;
        g.fillStyle = fgs[Math.min(i, fgs.length - 1)];
        g.fillText(t, c.width / 2, c.height * (i + 0.5) / L.length, c.width - 28);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
