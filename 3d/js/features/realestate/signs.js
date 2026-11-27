// features/realestate/signs.js — what you SEE on the street: a FOR SALE yard sign on every listed home and HER
// mailbox (pink, "LULU ♥" on the plate) by every home she owns. Four InstancedMeshes for the whole town (posts,
// boards, mailbox bodies, name plates) = ≤ 4 draw calls however many there are, no shadows; rebuilt (a few
// matrices) when the listings / her houses change. Nothing runs per frame.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { YARD, SEIZED_SIGN } from "./data.js";

const G = { group: null, town: null, meshes: null, tex: {}, mats: {}, geo: null };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

function boardTex(town) {
    if (G.tex[town]) return G.tex[town];
    const Y = town === "seized" ? SEIZED_SIGN : YARD[town] || YARD.lakewood;
    const c = document.createElement("canvas"); c.width = 256; c.height = 170;
    const g = c.getContext("2d");
    g.fillStyle = Y.bg; g.fillRect(0, 0, 256, 170);
    g.fillStyle = Y.band; g.fillRect(0, 0, 256, 22); g.fillRect(0, 148, 256, 22);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = Y.fg[0]; g.font = "bold 52px sans-serif"; g.fillText(Y.lines[0], 128, 72);
    g.fillStyle = Y.fg[1]; g.font = "bold 21px sans-serif"; g.fillText(Y.lines[1], 128, 122);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return (G.tex[town] = t);
}
function plateTex() {
    if (G.tex.plate) return G.tex.plate;
    const c = document.createElement("canvas"); c.width = 256; c.height = 80;
    const g = c.getContext("2d");
    g.fillStyle = "#FFF3F8"; g.fillRect(0, 0, 256, 80);
    g.strokeStyle = "#E91E63"; g.lineWidth = 8; g.strokeRect(4, 4, 248, 72);
    g.fillStyle = "#AD1457"; g.font = "bold 46px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("LULU ♥", 128, 42);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return (G.tex.plate = t);
}

function ensure(town) {
    if (G.group && G.town === town) return;
    clear();
    G.town = town;
    const N = 64;
    if (!G.geo) G.geo = { post: new THREE.BoxGeometry(0.07, 1, 0.07), board: new THREE.BoxGeometry(0.92, 0.62, 0.035), box: new THREE.BoxGeometry(0.46, 0.3, 0.3), plate: new THREE.BoxGeometry(0.5, 0.16, 0.02) };
    G.mats.post = G.mats.post || new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.8 });
    G.mats.box = G.mats.box || new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.5, metalness: 0.2 });   // (each mailbox's colour: instanceColor)
    G.mats.plate = G.mats.plate || new THREE.MeshStandardMaterial({ map: plateTex(), roughness: 0.7 });
    // (one cached material per town, never disposed: a material disposed while three's background shader compile is
    //  still polling it throws inside three — "reading 'isReady'")
    const board = G.mats["board:" + town] || (G.mats["board:" + town] = new THREE.MeshStandardMaterial({ map: boardTex(town), roughness: 0.7 }));
    G.mats.board = board;
    const mk = (geo, mat, name) => { const m = new THREE.InstancedMesh(geo, mat, N); m.name = name; m.count = 0; m.castShadow = false; m.receiveShadow = false; m.visible = false; return m; };
    G.mats.seized = G.mats.seized || new THREE.MeshStandardMaterial({ map: boardTex("seized"), roughness: 0.7 });
    G.meshes = { post: mk(G.geo.post, G.mats.post, "RE_Posts"), board: mk(G.geo.board, board, "RE_Boards"), box: mk(G.geo.box, G.mats.box, "RE_Mailbox"), plate: mk(G.geo.plate, G.mats.plate, "RE_Plates"),
        seized: mk(G.geo.board, G.mats.seized, "RE_Seized") };
    G.group = new THREE.Group(); G.group.name = "RealEstateSigns";
    for (const m of Object.values(G.meshes)) G.group.add(m);
    ctx.scene.add(G.group);
}
function put(mesh, x, y, z, rot, sx = 1, sy = 1, sz = 1) {
    if (mesh.count >= mesh.instanceMatrix.count) return;
    _q.setFromAxisAngle(_up, rot); _p.set(x, y, z); _s.set(sx, sy, sz);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(mesh.count++, _m);
}

/** Lay out the signs: `listed` = catalogue records for sale today, `owned` = her records standing in this town. */
const _c = new THREE.Color();
export function layout(town, listed, owned, friends = [], seized = []) {
    ensure(town);
    const M = G.meshes;
    for (const m of Object.values(M)) m.count = 0;
    for (const r of seized) {        // (the government's notice board: the Abandoned Kugel Ordinance)
        const rot = Math.atan2(r.nx, r.nz);
        put(M.post, r.sign.x - r.ux * 0.38, 0.55, r.sign.z - r.uz * 0.38, rot, 1, 1.1, 1);
        put(M.post, r.sign.x + r.ux * 0.38, 0.55, r.sign.z + r.uz * 0.38, rot, 1, 1.1, 1);
        put(M.seized, r.sign.x, 0.98, r.sign.z, rot);
    }
    for (const r of listed) {
        const rot = Math.atan2(r.nx, r.nz);      // the board faces the street
        put(M.post, r.sign.x - r.ux * 0.38, 0.55, r.sign.z - r.uz * 0.38, rot, 1, 1.1, 1);
        put(M.post, r.sign.x + r.ux * 0.38, 0.55, r.sign.z + r.uz * 0.38, rot, 1, 1.1, 1);
        put(M.board, r.sign.x, 0.98, r.sign.z, rot);
    }
    const box = (r, hex, plate) => {
        // the mailbox: beside the front walk, on the other side from where a yard sign would stand
        const mx = r.lot.x - r.nx * 0.35 - (r.sign.x - r.lot.x + r.nx * 0.7) * 0.6, mz = r.lot.z - r.nz * 0.35 - (r.sign.z - r.lot.z + r.nz * 0.7) * 0.6;
        const rot = Math.atan2(r.nx, r.nz);
        r.mailbox = { x: mx, z: mz };
        if (r.noBox) return;        // (a mailbox from features/decor's catalogue stands there instead — yard.js)
        put(M.post, mx, 0.45, mz, rot, 1.2, 0.9, 1.2);
        M.box.setColorAt(M.box.count, _c.set(hex));
        put(M.box, mx, 1.02, mz, rot);
        if (plate) put(M.plate, mx + r.nx * 0.16, 1.27, mz + r.nz * 0.16, rot);
    };
    for (const r of owned) box(r, "#F06292", true);
    for (const r of friends) box(r, (r.who && r.who.hex) || "#7E57C2", false);      // (a friend's: their colour)
    if (M.box.instanceColor) M.box.instanceColor.needsUpdate = true;
    for (const m of Object.values(M)) {
        m.instanceMatrix.needsUpdate = true;
        m.visible = m.count > 0;
        if (m.count) m.computeBoundingSphere();
    }
}
/** How many of each are standing (tests / perf). */
export function counts() { const M = G.meshes; return M ? { signs: M.board.count, mailboxes: M.box.count, seized: M.seized.count, calls: Object.values(M).filter(m => m.visible).length } : { signs: 0, mailboxes: 0, seized: 0, calls: 0 }; }
export function clear() {
    if (G.group) { if (G.group.parent) G.group.parent.remove(G.group); for (const m of Object.values(G.meshes)) m.dispose(); }
    G.group = null; G.meshes = null; G.town = null;
}
export { G };
