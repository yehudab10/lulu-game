// features/family — 👩‍👧 FAYGE, CHANI + ASH: Lulu's older married sister's household on features/homes' life engine.
//
//   the basement   the side door of the landlords' house on East 15th St (Avenue M → L), a few steps down by the driveway
//                  — a household homes knows (ctx.homes.addHousehold): its own door, cast, colours, scenes, door menu;
//                  realestate never lists the house (ctx.family.isFamily). She knocks; family walks in.
//   her day        data.js dayOf(when()): mornings at Morah Leah's playgroup (Avenue L, round the corner: six toddlers +
//                  Chani on tiny chairs), afternoons errands with the stroller (the makolet, the bakery, Avenue J'adore's
//                  window, Ima's), supper + bedtime at home, Friday cooking for Ima's table, Shabbos at Ima's.
//   outdoors       Fayge + Chani's stroller where her day says (a ✋ to talk: sister banter tied to features/decor's
//                  move-out days, Chani's whole vocabulary, a tiny job: 🎵 circle time · 🛍️ her bags home — homes' ledger).
// Nothing here texts, nothing pops up; coins only through homes' capped jobs.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx, on, emit, addActor } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { models, ensureModels } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { say, choose } from "../../core/dialog.js";
import * as H from "../../hud.js";
import { when } from "../homes/life.js";
import { SCENES } from "./scenes.js";
import { ID, FAYGE, dayOf, PLACE_NAME, NOTE, KNOCK, SISTER, FAYGE_TALK, ASH_TALK, CHANI, CHANI_REPLY, JOBS, SONGS, PLAYGROUP_AMBIENT } from "./data.js";

export const SAVE = store("family", { met: 0, talks: 0, chani: 0, visits: 0, day: "", did: {} });
if (!SAVE.did || typeof SAVE.did !== "object") SAVE.did = {};
const pick = a => a[Math.floor(Math.random() * a.length)];
export const F = { on: false, host: null, play: null, home: null, set: null, fay: null, kids: [], where: "", t: 0, log: [], force: {}, owned: [] };
export const log = (ev, d = {}) => { F.log.push(Object.assign({ ev }, d)); if (F.log.length > 80) F.log.shift(); emit("family:" + ev, d); };
function today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
/** Once a real day: SAVE.did[what] = the date. */
export const doneToday = what => SAVE.did[what] === today();
export function markToday(what) { SAVE.did[what] = today(); saveSoon(); }

export const live = () => ctx.enabled(ID) && !!(ctx.town && ctx.town.active && ctx.town.id === FAYGE.town) && !(ctx.G && ctx.G.mode === "dina") && !/^dina/.test(ctx.state || "");
/** Where Fayge is right now (the clock, the weekday, the calendar — a 🎉 party shares them). */
export function now() { const w = when(); const d = dayOf(w); if (F.force.where) d.where = F.force.where; return Object.assign(d, { w }); }

// ── the town's houses → world points ─────────────────────────────────────
const P = () => ctx.town && ctx.town.plan;
/** The town's house nearest the local point (lx, lz) of a model. */
function houseAt(lx, lz, model) {
    const T = ctx.town, pl = P();
    if (!T || !pl || !T.homes) return null;
    const at = pl.world(lx, lz, {});
    let best = null, bd = 9;
    for (const h of T.homes) { if (model && h.key !== model) continue; const d = Math.hypot(h.x - at.x, h.z - at.z); if (d < bd) { bd = d; best = h; } }
    return best;
}
/** A point in a house model's frame (x = model +X, z = out the front) → world. */
const inHouse = (h, lx, lz) => ({ x: h.x - h.ux * lx + h.nx * lz, z: h.z - h.uz * lx + h.nz * lz });

// ── the household homes knows ────────────────────────────────────────────
function household(town) {
    if (town !== FAYGE.town || !ctx.enabled(ID)) return [];
    const h = houseAt(FAYGE.host.lx, FAYGE.host.lz, FAYGE.host.model);
    F.host = h;
    if (!h) return [];
    const door = inHouse(h, FAYGE.door[0], FAYGE.door[1]), ap = inHouse(h, FAYGE.ap[0], FAYGE.ap[1]);
    const home = {
        key: FAYGE.key, name: FAYGE.name, cast: FAYGE.cast.slice(), names: Object.assign({}, FAYGE.names), colors: FAYGE.colors,
        door, ap, lot: ap, nx: h.nx, nz: h.nz, ux: h.ux, uz: h.uz, w: 1.2, lightY: 1.2, rooms: FAYGE.rooms, palette: FAYGE.palette, basement: true,
        traits: ["hosts", "bakers"], family: true, scenes: SCENES,
        inside: { name: "Fayge's basement", title: "🏠 FAYGE & ASH'S", label: "Fayge's basement" },
        label: () => (ctx.homes.delivery && ctx.homes.delivery.to === FAYGE.key ? "🛍️ FAYGE'S — DROP OFF THE BAGS" : "👩‍👧 FAYGE'S — DOWN THE STEPS"),
        scene: w => (F.force.scene || dayOf(w).scene),
        menu: api => doorMenu(api),
        talk: (kind, V) => talkLine(kind, V),
    };
    F.home = home;
    return [home];
}
/** Is (x, z) Fayge's house (the landlords' front door or her own) — features/realestate never lists it. */
export function isFamily(x, z) {
    const h = F.host;
    if (!h || !live()) return false;
    const a = inHouse(h, FAYGE.ap[0], FAYGE.ap[1]);
    const fd = inHouse(h, -2.15, 7.55);             // (the landlords' front door: town_mw_house's door)
    return Math.hypot(fd.x - x, fd.z - z) < 3 || Math.hypot(a.x - x, a.z - z) < 4;
}

// ── her door ─────────────────────────────────────────────────────────────
function sister() {
    const M = ctx.moveout;
    try { if (M && M.based && M.based()) return pick(SISTER.own); } catch (e) { /* */ }
    const k = M && M.stage ? M.stage() : -1;
    return pick(k >= 4 ? SISTER.late : k >= 1 ? SISTER.mid : SISTER.early);
}
async function doorMenu(api) {
    const d = now();
    const here = api.here.filter(k => k !== "baby");
    const opts = [];
    if (api.delivery) opts.push(["🛍️ Drop off Fayge's bags", "bags"]);
    opts.push(["✊ Knock", "knock"], ["✖ Leave it", "leave"]);
    const line = here.length ? (d.scene === "faygeNight" ? "Every light's off. Somewhere inside, a very small person is ALMOST asleep." : (api.scene.def.heard && api.scene.def.heard[0]) || "")
        : NOTE[d.where] || NOTE.away;
    const i = await choose("👩‍👧 Fayge & Ash · downstairs", `${FAYGE.street}, the side door. ${line}`.trim(), opts.map(o => o[0]), { emoji: "🚪" });
    if (i < 0 || !opts[i] || opts[i][1] === "leave") return;
    if (opts[i][1] === "bags") {
        const who = here.includes("dad") ? "dad" : here.includes("mom") ? "mom" : null;
        if (who) await api.answer(who);
        const pay = api.finish();
        await say(who === "dad" ? "Ash" : who === "mom" ? "Fayge" : "Lulu", who === "dad" ? "…thanks. *takes all six bags in one hand*" : who === "mom" ? "My bags! You're a doll. You're a sister AND a doll." : "I'll leave them on the step. Next to the stroller. Under the sign. They'll know.", { emoji: who === "dad" ? "🧔" : who === "mom" ? "👩" : "💁‍♀️" });
        log("bags", { paid: pay });
        if (!who) return;
    }
    if (!await api.knock()) return;
    if (!here.length) { await say("🚪", NOTE[d.where] || NOTE.away, { emoji: "📝" }); log("knock", { home: false, where: d.where }); return; }
    const who = here.includes("mom") ? "mom" : "dad";
    await api.answer(who);
    const lines = d.scene === "faygeNight" ? KNOCK.night : d.scene === "faygeFriday" && who === "mom" ? KNOCK.friday : who === "dad" ? KNOCK.ash : KNOCK.open;
    await say(who === "mom" ? "Fayge" : "Ash", pick(lines), { emoji: who === "mom" ? "👩" : "🧔" });
    if (api.done) return;
    SAVE.visits++; saveSoon();
    log("knock", { home: true, who, scene: d.scene });
    emit("stat", { id: "familyVisits", n: 1 });
    api.go();            // (family walks in: a guest who doesn't knock twice)
}
function talkLine(kind, V) {
    const d = now();
    if (kind === "baby") { SAVE.chani++; saveSoon(); emit("stat", { id: "familyChani", n: 1 }); return pick(CHANI); }
    if (kind === "dad") return pick(ASH_TALK);
    if (kind === "mom") { SAVE.talks++; saveSoon(); const r = Math.random(); return r < 0.4 ? sister() : r < 0.6 ? pick(FAYGE_TALK.salt) : pick(FAYGE_TALK.home); }
    return null;
}

// ── outdoors: where her day puts her ─────────────────────────────────────
/** World point + facing for a place ({ x, z, yaw, s: where the stroller goes }) | null (not drawn). */
export function placeOf(where) {
    const T = ctx.town;
    if (!T || !T.spot) return null;
    const fromSpot = (k, u, n) => {
        const sp = T.spot(k);
        if (!sp) return null;
        const nx = sp.nx, nz = sp.nz, ux = sp.ux != null ? sp.ux : nz, uz = sp.uz != null ? sp.uz : -nx;
        const x = sp.x + ux * u + nx * n, z = sp.z + uz * u + nz * n;
        return { x, z, yaw: Math.atan2(-nx, -nz), s: { x: x + ux * 0.9 + nx * 0.2, z: z + uz * 0.9 + nz * 0.2 }, ux, uz, nx, nz };
    };
    if (where === "makolet") return fromSpot("makolet", 2.2, 2.6);
    if (where === "bakery") return fromSpot("bakery", -2.0, 2.6);
    if (where === "clothes") return fromSpot("clothes", 3.0, 1.9);
    if (where === "ima" || where === "walk") {
        const sp = T.spot("luluHome");
        if (!sp) return null;
        const dr = sp.door && typeof sp.door === "object" ? sp.door : { x: sp.x, z: sp.z };
        const n = where === "walk" ? 5.2 : 2.2;
        const x = dr.x + sp.nx * n + (sp.ux || 0) * 1.4, z = dr.z + sp.nz * n + (sp.uz || 0) * 1.4;
        return { x, z, yaw: Math.atan2(sp.nx, sp.nz) + (where === "ima" ? Math.PI : 0), s: { x: x + (sp.ux || 0) * 0.9, z: z + (sp.uz || 0) * 0.9 }, ux: sp.ux || 0, uz: sp.uz || 0, nx: sp.nx, nz: sp.nz };
    }
    if (where === "playgroup") {
        const h = houseAt(FAYGE.playgroup.lx, FAYGE.playgroup.lz, FAYGE.playgroup.model);
        if (!h) return null;
        F.play = h;
        const c = inHouse(h, FAYGE.playgroup.yard[0], FAYGE.playgroup.yard[1] - 2.1);
        return { x: c.x, z: c.z, yaw: Math.atan2(h.nx, h.nz), c, s: c, ux: -h.ux, uz: -h.uz, nx: h.nx, nz: h.nz };
    }
    return null;
}

// cheap props: boxes baked into one vertex-coloured mesh (1 draw call each)
let bakedMat = null;
function bake(parts) {
    const geos = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), c = new THREE.Color();
    for (const b of parts) {
        const g = new THREE.BoxGeometry(b[0], b[1], b[2]);
        e.set(0, b[6] || 0, 0); q.setFromEuler(e); p.set(b[3], b[4], b[5]);
        g.applyMatrix4(m.compose(p, q, s));
        c.set(b[7]);
        const n = g.attributes.position.count, col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        g.setAttribute("color", new THREE.BufferAttribute(col, 3));
        geos.push(g);
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    F.owned.push(merged);
    if (!bakedMat) bakedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.1 });
    const mesh = new THREE.Mesh(merged, bakedMat);
    mesh.receiveShadow = true;
    return mesh;
}
/** A stroller (x = across, z = forward; the handle at −z). */
export function stroller() {
    return bake([[0.55, 0.06, 0.8, 0, 0.42, 0, 0, "#455A64"], [0.5, 0.32, 0.62, 0, 0.62, 0.02, 0, "#7E57C2"], [0.56, 0.3, 0.36, 0, 0.92, -0.2, 0, "#5E35B1"],
        [0.04, 0.5, 0.04, -0.26, 0.7, -0.42, 0, "#37474F"], [0.04, 0.5, 0.04, 0.26, 0.7, -0.42, 0, "#37474F"], [0.56, 0.05, 0.05, 0, 0.98, -0.48, 0, "#212121"],
        [0.05, 0.2, 0.2, -0.27, 0.12, 0.3, 0, "#212121"], [0.05, 0.2, 0.2, 0.27, 0.12, 0.3, 0, "#212121"], [0.05, 0.2, 0.2, -0.27, 0.12, -0.3, 0, "#212121"], [0.05, 0.2, 0.2, 0.27, 0.12, -0.3, 0, "#212121"],
        [0.04, 0.3, 0.04, -0.26, 0.28, 0.3, 0, "#37474F"], [0.04, 0.3, 0.04, 0.26, 0.28, -0.3, 0, "#37474F"], [0.3, 0.2, 0.12, 0.33, 0.55, -0.35, 0, "#F48FB1"]]);    // (the snack bag)
}
/** A canvas sign (one mesh). */
function sign(text, w, h, bg = "#FFF8E1", fg = "#4E342E") {
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = Math.round(256 * h / w);
    const g = cv.getContext("2d"); g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = fg;
    const lines = text.split("\n"); g.textAlign = "center"; g.textBaseline = "middle";
    const fs = Math.min(cv.height / (lines.length + 0.6), 34); g.font = `bold ${fs}px sans-serif`;
    lines.forEach((l, i) => g.fillText(l, cv.width / 2, cv.height / 2 + (i - (lines.length - 1) / 2) * fs * 1.15));
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex }), geo = new THREE.PlaneGeometry(w, h);
    F.owned.push(tex, mat, geo);
    return new THREE.Mesh(geo, mat);
}
const put = (o, x, z, yaw = 0, y = 0) => { o.position.set(x, y, z); o.rotation.y = yaw; F.set.add(o); return o; };

/** The street set: the basement steps (always), the playgroup yard (always — tiny chairs, a little fence, a sign). */
function buildSet() {
    dropSet();
    const h = F.host;
    if (!h) return;
    F.set = new THREE.Group(); F.set.name = "familySet";
    const yaw = Math.atan2(h.nx, h.nz), Pt = FAYGE.pit;
    // the steps down: a dark well, three step edges, an iron rail on the driveway side + the far end, a sign at the top
    const cx = (Pt.x0 + Pt.x1) / 2, cz = (Pt.z0 + Pt.z1) / 2, wx = Pt.x1 - Pt.x0, wz = Pt.z1 - Pt.z0;
    const pit = [[wx, 0.04, wz, 0, 0.02, 0, 0, "#3A3631"]];
    for (let i = 0; i < 4; i++) pit.push([wx - 0.08, 0.05, 0.08, 0, 0.045, wz / 2 - 0.25 - i * 0.55, 0, i % 2 ? "#6D6258" : "#857A6E"]);
    pit.push([0.05, 0.9, wz, wx / 2, 0.45, 0, 0, "#263238"], [0.05, 0.05, wz, wx / 2, 0.92, 0, 0, "#263238"], [wx, 0.05, 0.05, 0, 0.92, -wz / 2, 0, "#263238"], [wx, 0.9, 0.05, 0, 0.45, -wz / 2, 0, "#263238"]);
    pit.push([0.9, 0.7, 0.06, -wx / 2 - 0.02, 0.35, -wz / 2 + 0.6, Math.PI / 2, "#5D4037"]);      // (the top of the door, peeking out at the bottom of the steps)
    const well = bake(pit);
    const wp = inHouse(h, cx, cz);
    put(well, wp.x, wp.z, yaw);
    const sg = sign("FAYGE & ASH\n↓ DOWNSTAIRS ↓", 0.9, 0.42);
    const sp = inHouse(h, Pt.x1 + 0.05, Pt.z1 - 0.2);
    put(sg, sp.x, sp.z, yaw + Math.PI / 2, 0.75);
    const mat = sign("SHOES OFF.\nCHANI ASLEEP.\nPROBABLY.", 0.7, 0.42, "#8D6E63", "#FFF8E1");
    const mp = inHouse(h, cx, Pt.z1 + 0.35);
    mat.rotation.x = -Math.PI / 2; put(mat, mp.x, mp.z, 0, 0.03); mat.rotation.set(-Math.PI / 2, 0, yaw, "YXZ");
    // the parked stroller (when they're home)
    const st = stroller(); F.homeStroller = put(st, inHouse(h, FAYGE.stroller[0], FAYGE.stroller[1]).x, inHouse(h, FAYGE.stroller[0], FAYGE.stroller[1]).z, yaw + 0.4);
    // the playgroup yard (Avenue L): a low picket fence on the street side, six tiny chairs in a circle, a sign
    const ph = houseAt(FAYGE.playgroup.lx, FAYGE.playgroup.lz, FAYGE.playgroup.model);
    F.play = ph;
    if (ph) {
        const pyaw = Math.atan2(ph.nx, ph.nz), [yx, yz] = FAYGE.playgroup.yard;
        const parts = [];
        for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; parts.push([0.3, 0.04, 0.3, Math.cos(a) * 1.05, 0.25, Math.sin(a) * 1.05, -a, ["#EF5350", "#FFCA28", "#66BB6A", "#42A5F5", "#AB47BC", "#FF7043", "#26C6DA"][i]],
            [0.3, 0.25, 0.04, Math.cos(a) * 1.2, 0.4, Math.sin(a) * 1.2, -a + Math.PI / 2, "#ECEFF1"], [0.04, 0.24, 0.04, Math.cos(a) * 1.05, 0.12, Math.sin(a) * 1.05, 0, "#90A4AE"]); }
        parts.push([1.5, 0.04, 1.5, 0, 0.06, 0, 0, "#81D4FA"]);       // (the circle-time rug)
        for (const [cx2, cz2, col] of [[-0.9, -2.0, "#F48FB1"], [0.6, -2.6, "#FFF176"], [-0.3, 2.0, "#80DEEA"]]) parts.push([0.6, 0.01, 0.35, cx2, 0.045, cz2, 0.6, col]);     // (chalk)
        const chairs = bake(parts);
        const cc = inHouse(ph, yx, yz);
        put(chairs, cc.x, cc.z, pyaw);
        F.circle = { x: cc.x, z: cc.z, yaw: pyaw };
        // a baby gate across the driveway's mouth (the driveway is 2.9 m wide: x 3.15 – 6.05 in the house's frame)
        const fence = [];
        for (let i = -4; i <= 4; i++) fence.push([0.06, 0.7, 0.04, i * 0.34, 0.35, 0, 0, "#FAFAFA"]);
        fence.push([2.9, 0.06, 0.05, 0, 0.66, 0, 0, "#FAFAFA"], [2.9, 0.06, 0.05, 0, 0.2, 0, 0, "#FAFAFA"]);
        const fp = inHouse(ph, yx, yz + 2.9);
        put(bake(fence), fp.x, fp.z, pyaw);
        const ps = sign("MORAH LEAH'S\nTINY TOTS PLAYGROUP", 1.2, 0.46, "#FFF59D", "#6A1B9A");
        const pp = inHouse(ph, yx, yz + 2.93);
        put(ps, pp.x, pp.z, pyaw, 0.95);
    }
    ctx.scene.add(F.set);
}
function dropSet() {
    dropPeople();
    if (F.set && F.set.parent) F.set.parent.remove(F.set);
    F.set = null; F.homeStroller = null;
    for (const o of F.owned) try { o.dispose(); } catch (e) { /* */ }
    F.owned = [];
}

// ── Fayge + Chani (+ the toddlers at the playgroup) ──────────────────────
function dropPeople() {
    for (const p of [F.fay, F.chani, F.str, ...F.kids].filter(Boolean)) { const o = p.obj || p; if (o.parent) o.parent.remove(o); }
    F.fay = F.chani = F.str = null; F.kids = []; F.at = null; F.where = "";
}
const TODDLER_TOPS = ["#E57373", "#FFD54F", "#81C784", "#64B5F6", "#BA68C8", "#4DB6AC"];
function spawnAt(where) {
    dropPeople();
    F.where = where;
    const pl = placeOf(where);
    if (!pl || !models.homesMom || !models.homesBaby) return;
    F.at = pl;
    const fay = spawnPerson("homesMom", { colors: FAYGE.colors.mom });
    fay.obj.position.set(pl.x, 0, pl.z); fay.obj.rotation.y = pl.yaw;
    fay.obj.traverse(o => { if (o.isMesh) o.castShadow = false; });
    ctx.scene.add(fay.obj); F.fay = fay;
    const chani = spawnPerson("homesBaby", { colors: FAYGE.colors.baby });
    chani.obj.traverse(o => { if (o.isMesh) o.castShadow = false; });
    if (where === "playgroup" && F.circle) {
        // the circle: six toddlers + Chani on the tiny chairs, Fayge standing at the open side
        const C = F.circle;
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            const lx = Math.cos(a) * 1.05, lz = Math.sin(a) * 1.05;
            const x = C.x + Math.cos(C.yaw) * lx + Math.sin(C.yaw) * lz, z = C.z - Math.sin(C.yaw) * lx + Math.cos(C.yaw) * lz;
            const k = i === 0 ? chani : spawnPerson("homesBaby", { colors: { Top: TODDLER_TOPS[i - 1], Bottom: "#5C6BC0" } });
            k.obj.position.set(x, 0.12, z); k.obj.rotation.y = Math.atan2(C.x - x, C.z - z);
            if (k !== chani) { k.obj.traverse(o => { if (o.isMesh) o.castShadow = false; }); F.kids.push(k); }
            ctx.scene.add(k.obj);
        }
        F.chani = chani;
        fay.obj.position.set(pl.x, 0, pl.z);          // (behind the circle, facing it + the street: she's seen from the sidewalk)
        fay.obj.rotation.y = C.yaw;
        pl.x = fay.obj.position.x; pl.z = fay.obj.position.z;
    } else {
        const st = stroller();
        st.position.set(pl.s.x, 0, pl.s.z); st.rotation.y = pl.yaw + 0.5;
        ctx.scene.add(st); F.str = st;
        chani.obj.position.set(pl.s.x, 0.42, pl.s.z); chani.obj.rotation.y = pl.yaw + 0.5; chani.obj.scale.setScalar(0.9);
        ctx.scene.add(chani.obj); F.chani = chani;
    }
    log("place", { where });
}

// ── the per-frame tick ───────────────────────────────────────────────────
function herPos() { return (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos) || null; }
function tick(dt) {
    if (!live()) { if (F.fay || F.set) { dropSet(); } return; }
    if (!F.set && F.host) buildSet();
    F.t += dt;
    const d = now(), want = ["playgroup", "makolet", "bakery", "clothes", "ima", "walk"].includes(d.where) ? d.where : "";
    const me = herPos();
    if (want !== F.where) {
        // (she moves on between places only while Lulu isn't looking right at her — no popping in front of her)
        const near = me && F.at && Math.hypot(F.at.x - me.x, F.at.z - me.z) < 28;
        if (!near || F.force.where || !F.fay) { if (want) spawnAt(want); else dropPeople(); }
    }
    if (F.homeStroller) F.homeStroller.visible = d.where === "home";
    if (!F.fay || !me) return;
    const dist = Math.hypot(F.at.x - me.x, F.at.z - me.z);
    if (dist > 70) return;
    const talking = F.talking || false;
    if (d.where === "walk") {           // (a Shabbos walk: up and down in front of Ima's, pushing the stroller)
        const s = Math.sin(F.t * 0.12) * 8, o = F.fay.obj, dir = Math.cos(F.t * 0.12) >= 0 ? 1 : -1;
        if (!talking) { o.position.set(F.at.x + F.at.ux * s, 0, F.at.z + F.at.uz * s); o.rotation.y = Math.atan2(F.at.ux * dir, F.at.uz * dir); }
        if (F.str) { F.str.position.set(o.position.x + Math.sin(o.rotation.y) * 0.8, 0, o.position.z + Math.cos(o.rotation.y) * 0.8); F.str.rotation.y = o.rotation.y; F.chani.obj.position.set(F.str.position.x, 0.42, F.str.position.z); F.chani.obj.rotation.y = o.rotation.y; }
        F.fay.update(dt, { walk: talking ? 0 : 0.9, talk: talking });
    } else F.fay.update(dt, { talk: talking || (d.where === "playgroup" && Math.sin(F.t * 0.9) > 0.2), point: d.where === "playgroup" && Math.sin(F.t * 0.5) > 0.8 });
    F.chani.update(dt, { sit: true, wave: dist < 6 && Math.sin(F.t * 1.3) > 0.6 });
    for (let i = 0; i < F.kids.length; i++) F.kids[i].update(dt, { sit: true, clap: Math.sin(F.t * 0.7 + i) > 0.7, wave: Math.sin(F.t * 0.5 + i * 2) > 0.92 });
    if (dist < 14 && !talking && !ctx.dialogOpen && F.t - (F.saidT || 0) > 7) {
        F.saidT = F.t;
        const who = d.where === "playgroup" && Math.random() < 0.6 ? F.fay.obj : Math.random() < 0.3 ? F.chani.obj : F.fay.obj;
        const text = who === F.chani.obj ? pick(CHANI) : d.where === "playgroup" ? pick(PLAYGROUP_AMBIENT) : dist < 8 ? "Lulu! Come here, say hi to your niece!" : null;
        if (text) bubble(text, who);
    }
}
function bubble(text, obj, dur = 2.6) {
    try { if (ctx.banter && ctx.banter.bubble && ctx.banter.bubble(text, obj, { dur, y: obj === (F.chani && F.chani.obj) ? 1.2 : 2.1, cls: "nice" })) return true; } catch (e) { /* */ }
    try { if (ctx.foot && ctx.foot.say) return !!ctx.foot.say(obj, text, dur); } catch (e) { /* */ }
    return false;
}

// ── ✋ talk to her on the street ─────────────────────────────────────────
const talkSpot = {
    r: 2.4, short: "FAYGE",
    pos() {
        if (!live() || !F.fay || !ctx.foot || !ctx.foot.pos || F.talking) return null;
        const o = F.fay.obj.position;
        return Math.hypot(o.x - ctx.foot.pos.x, o.z - ctx.foot.pos.z) < 2.4 ? { x: o.x, z: o.z } : null;
    },
    label: () => (F.where === "playgroup" ? "👩‍👧 FAYGE — AT THE PLAYGROUP" : "👩‍👧 TALK TO FAYGE (+ CHANI)"),
    act() { talk().catch(e => console.error("[family] talk", e)); },
};
function hold() {
    const st = { done: false };
    const o = F.fay && F.fay.obj;
    const ok = ctx.foot.script({
        update(dt, P, Fo) { if (Fo.lulu && o) { Fo.lulu.face(o.position.x, o.position.z, dt, 8); Fo.lulu.update(dt, { walk: 0, talk: ctx.dialogOpen }); } return !st.done; },
        abort() { st.done = true; },
    });
    return ok ? st : null;
}
export async function talk() {
    if (F.talking || !F.fay) return false;
    const st = hold();
    if (!st) return false;
    F.talking = true;
    try {
        const me = ctx.foot.pos, o = F.fay.obj;
        o.rotation.y = Math.atan2(me.x - o.position.x, me.z - o.position.z);
        const d = now(), w = d.w, where = F.where;
        if (!SAVE.met) { SAVE.met = 1; saveSoon(); await say("Fayge", "LULU! You're in Midwood and you don't CALL? Your own sister? Come here. Say hi to Chani.", { emoji: "👩" }); if (st.done) return true; }
        const rest = w.shabbos || w.yomtov;
        const opts = [["💬 Talk to Fayge", "talk"], ["👶 Say hi to Chani", "chani"]];
        if (!rest && where === "playgroup") opts.push([`${JOBS.circle.emoji} Lead circle time${payLeft("circle") ? ` (+${JOBS.circle.pay} 💰)` : ""}`, "circle"]);
        if (!rest && (where === "makolet" || where === "bakery") && !(ctx.homes.delivery)) opts.push([`${JOBS.bags.emoji} Carry her bags home${payLeft("bags") ? ` (+${JOBS.bags.pay} 💰)` : ""}`, "bags"]);
        opts.push(["✖ Bye, Fayge", "bye"]);
        const i = await choose("👩‍👧 Fayge (+ Chani)", `${PLACE_NAME[where] || ""}. ${pick(FAYGE_TALK[where] || FAYGE_TALK.home)}`, opts.map(x => x[0]), { emoji: "👩" });
        if (i < 0 || st.done) return true;
        const k = opts[i][1];
        if (k === "talk") {
            SAVE.talks++; saveSoon();
            await say("Fayge", sister(), { emoji: "👩" });
            if (!st.done && Math.random() < 0.5) await say("Fayge", pick(FAYGE_TALK.salt), { emoji: "👩" });
            log("talk", { where });
        } else if (k === "chani") {
            SAVE.chani++; saveSoon(); emit("stat", { id: "familyChani", n: 1 });
            bubble(pick(CHANI), F.chani.obj, 2.4);
            await say("Chani", pick(CHANI), { emoji: "👶" });
            if (!st.done) await say("Fayge", pick(CHANI_REPLY), { emoji: "👩" });
            log("chani", { where });
        } else if (k === "circle") await circleTime(st);
        else if (k === "bags") await bags(st);
        return true;
    } finally { st.done = true; F.talking = false; }
}
const payLeft = type => ctx.homes && ctx.homes.paid ? ctx.homes.paid(type) < JOBS[type].cap : false;
/** 🎵 Circle time: she leads a song for six toddlers + Chani. Once a real day pays (homes' ledger + cap). */
async function circleTime(st) {
    if (doneToday("circle")) { await say("Fayge", "You already did circle time today! They're STILL singing it. Tomorrow. Please. For me.", { emoji: "👩" }); return; }
    await say("Fayge", "Morah Leah's inside making snack. You're on. Pick a song — and SMILE, they can smell fear.", { emoji: "👩" });
    if (st.done) return;
    const i = await choose("🎵 Circle time", "Seven toddlers look up at you. One is eating a leaf.", SONGS.map(s => s.label), { emoji: "🎵" });
    if (i < 0 || st.done) return;
    for (const k of F.kids) k.__clap = 1;
    for (const l of SONGS[i].lines) { await say(l.startsWith("Chani") ? "Chani" : l.startsWith("Fayge") ? "Fayge" : "🎵", l.replace(/^(Chani|Fayge): /, ""), { emoji: l.startsWith("Chani") ? "👶" : l.startsWith("Fayge") ? "👩" : "🎵" }); if (st.done) break; }
    markToday("circle");
    const pay = ctx.homes && ctx.homes.pay ? ctx.homes.pay("circle") : 0;
    H.toast(pay ? `🎵 +${pay} 💰 — circle time, a triumph` : "🎵 Circle time, a triumph. (Fayge owes you one.)", "gold", { key: "family:job" });
    emit("stat", { id: "familyCircle", n: 1 });
    log("circle", { paid: pay, song: i });
}
/** 🛍️ Her bags → her door (homes' delivery: the beacon over the basement steps, the ✋ there). */
async function bags(st) {
    if (doneToday("bags")) { await say("Fayge", "You already schlepped for me today. Go. Live your life. Find an APARTMENT.", { emoji: "👩" }); return; }
    await say("Fayge", `You're a doll. Down the steps at ${FAYGE.street} — the door's open if Ash is home, otherwise leave them by the stroller sign.`, { emoji: "👩" });
    markToday("bags");
    const ok = ctx.homes && ctx.homes.errand && ctx.homes.errand({ type: "bags", to: FAYGE.key, fromName: "Fayge", label: "🛍️ Drop off Fayge's bags" });
    log("bagsStart", { ok: !!ok });
}

// ── wiring ───────────────────────────────────────────────────────────────
export function init() {
    if (ctx.homes && ctx.homes.jobsAdd) ctx.homes.jobsAdd(JOBS);
    if (ctx.homes && ctx.homes.addHousehold) ctx.homes.addHousehold(household);
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot(talkSpot);
}
on("town:enter", () => {
    if (!ctx.enabled(ID) || !ctx.town || ctx.town.id !== FAYGE.town) return;
    ensureModels(["homesMom", "homesBaby", "homesDad"]).catch(() => { });
    if (!F.on) { F.on = true; addActor({ foot: true, update: dt => { try { tick(dt); } catch (e) { console.error("[family] tick", e); } return F.on; }, dispose() { F.on = false; } }); }
});
on("town:leave", () => { dropSet(); F.host = null; F.home = null; });
