// features/realestate/yard.js — 🏡 the OUTSIDE of a home she owns, decorated (roadmap 23 d2: everything she bought for
// Ima's house has a place in her own): the front door's paint, the porch, the mailbox and the front yard — features/decor's
// own catalogue + models (props.js › buildOption("outside", …)), which are laid out for the family house (+Z toward the
// street, the door at x 0.6 z 4.04, the porch deck y 0.4, the mailbox x 3.0 z 12.4, the lawn x 2…9 z 7…9). Each piece is
// moved onto HER house by an anchor: the door / porch on her door, the mailbox where her mailbox stands, the yard between
// her door and the sidewalk. Defaults change nothing: her own door, the pink LULU mailbox (signs.js), a bare lawn.
// Cost: only her homes in the town she's in (≤ 10), each piece 1–3 merged draw calls; rebuilt only when what's placed
// there changes (a picker preview: that house only). Nothing runs per frame.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { SLOTS } from "../decor/data.js";
import { buildOption, disposeObj } from "../decor/props.js";

export const YARD_SLOTS = ["door", "porch", "mailbox", "lawn"];
// the family-house point each slot's pieces hang off (house-local x, y, z) and how much they shrink to fit a town lot
const ANCHOR = { porch: [0.6, 0.4, 4.04, 1], mailbox: [3.0, 0, 12.4, 1], lawn: [4.0, 0, 8.2, 0.75] };
const slot = id => SLOTS.find(s => s.id === id);
const Y = { group: null, town: null, homes: new Map(), mats: {} };       // id → { key, objs: [] }

function ensure(town) {
    if (Y.group && Y.town === town) return;
    clearYard();
    Y.group = new THREE.Group(); Y.group.name = "RealEstateYards"; Y.town = town;
    ctx.scene.add(Y.group);
}
function drop(h) { for (const o of h.objs) { if (o.parent) o.parent.remove(o); disposeObj(o); } h.objs = []; }
export function clearYard() {
    for (const h of Y.homes.values()) drop(h);
    Y.homes.clear();
    if (Y.group && Y.group.parent) Y.group.parent.remove(Y.group);
    Y.group = null; Y.town = null;
}

/** Is a non-default mailbox placed at this home (then signs.js leaves out the pink one)? */
export const ownMailbox = deco => !!(deco && deco.mailbox && slot("mailbox") && deco.mailbox !== slot("mailbox").opts[0].id);

// what she'd stand on at (x, z): the porch deck / stoop / ground (one short ray down — only when a house's pieces are rebuilt)
const _ray = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3(0, -1, 0);
function groundAt(x, z) {
    _ray.set(_o.set(x, 3.2, z), _d); _ray.far = 3.6; _ray.camera = ctx.camera;     // (sprites in the scene need one)
    let best = 0;
    for (const h of _ray.intersectObjects(ctx.scene.children, true)) {
        if (!h.object.visible || (Y.group && isIn(h.object, Y.group)) || h.object.isSprite) continue;
        if (h.point.y < 1.6) { best = Math.max(best, h.point.y); break; }
    }
    return best;
}
/** Which way along the street (±1 × u) her lot is open — the side the FOR SALE sign stood on (a duplex's other half
 *  is the other way). */
const openSide = r => Math.sign((r.sign.x - r.lot.x) * r.ux + (r.sign.z - r.lot.z) * r.uz) || 1;
function isIn(o, root) { for (let p = o; p; p = p.parent) if (p === root) return true; return false; }
/** World point + facing for home record r (market.js: door / lot / ap / nx nz / ux uz) and slot. */
function anchorAt(r, sl) {
    const rot = Math.atan2(r.nx, r.nz);
    if (sl === "mailbox" && r.mailbox) return { x: r.mailbox.x, z: r.mailbox.z, y: 0, rot };
    if (sl === "lawn") {
        // on the front lawn: out past the front walk's start, a step to her lot's open side
        const sd = openSide(r), x = r.ap.x + r.nx * 1.2 + r.ux * sd * 1.8, z = r.ap.z + r.nz * 1.2 + r.uz * sd * 1.8;
        return { x, z, y: 0, rot };
    }
    if (sl === "porch") {
        // on whatever is in front of her door: a porch deck, a stoop, or the ground
        const px = r.door.x + r.nx * 0.9, pz = r.door.z + r.nz * 0.9;
        return { x: r.door.x, z: r.door.z, y: groundAt(px, pz), rot };
    }
    return { x: r.door.x + r.nx * 0.05, z: r.door.z + r.nz * 0.05, y: 0, rot };
}
function doorPanel(o) {
    const key = "door:" + o.id;
    const m = Y.mats[key] || (Y.mats[key] = new THREE.MeshStandardMaterial({ color: o.color || "#E91E63", metalness: o.metal || 0, roughness: o.metal ? 0.28 : 0.6 }));
    const mesh = new THREE.Mesh(Y.mats.doorGeo || (Y.mats.doorGeo = new THREE.BoxGeometry(0.95, 2.05, 0.06)), m);
    mesh.position.y = 1.03; mesh.name = "RE_DoorPaint"; mesh.userData.sharedGeo = true;
    return mesh;
}
function piece(r, sl, optId) {
    const s = slot(sl), o = s && s.opts.find(x => x.id === optId);
    if (!o || o === s.opts[0]) return null;                               // (the default: nothing added)
    const A = anchorAt(r, sl);
    const g = new THREE.Group(); g.name = `RE_${sl}`;
    g.position.set(A.x, A.y || 0, A.z); g.rotation.y = A.rot;
    if (sl === "door") { g.add(doorPanel(o)); return g; }
    const obj = buildOption("outside", sl, o.id);
    if (!obj) return null;
    const [ax, ay, az, sc] = ANCHOR[sl];
    obj.position.set(-ax * sc, -ay, -az * sc); obj.scale.setScalar(sc);
    g.add(obj);
    // (the family house's porch / lawn pieces stand to its door's +X side: mirror them to HER open side)
    if (sl === "porch" || sl === "lawn") { const plusX = r.nz * r.ux - r.nx * r.uz; if (plusX * openSide(r) < 0) g.scale.x = -1; }
    return g;
}

/** Lay out the outside of every home of hers in `town`: homes = [{ rec, deco }] (deco: { slot: optId } placed there). */
export function layoutYard(town, homes, preview = null) {
    if (!ctx.scene) return;
    ensure(town);
    const seen = new Set();
    for (const { rec, deco } of homes) {
        if (!rec) continue;
        seen.add(rec.id);
        const d = Object.assign({}, deco || {}, preview && preview.id === rec.id ? { [preview.slot]: preview.opt } : {});
        const key = YARD_SLOTS.map(s => d[s] || "").join("|") + `@${Math.round(rec.door.x)},${Math.round(rec.door.z)}`;
        const h = Y.homes.get(rec.id) || { key: "", objs: [] };
        if (h.key === key) { Y.homes.set(rec.id, h); continue; }
        drop(h); h.key = key;
        for (const sl of YARD_SLOTS) { const p = piece(rec, sl, d[sl]); if (p) { Y.group.add(p); h.objs.push(p); } }
        Y.homes.set(rec.id, h);
    }
    for (const [id, h] of [...Y.homes]) if (!seen.has(id)) { drop(h); Y.homes.delete(id); }
}
/** How many pieces stand (tests / perf). */
export const yardCount = () => [...Y.homes.values()].reduce((n, h) => n + h.objs.length, 0);
export { Y };
