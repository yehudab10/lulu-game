// features/realestate/house.js — a home from the inside, two ways:
//   • a VIEWING (a house for sale): the sellers' things half packed in boxes, the realtor walks her through room by
//     room, overselling (a line per room), and closes the deal at the end (💰 buy it here, or 🚪 not today);
//   • HER OWN HOUSE (✋ 🔑 GO IN with her key — no knocking, no burglary): empty and echoing, a beanbag, a mattress, a
//     fridge with one pickle, boxes to unpack — decorating comes in stage 3 (features/decor's picker).
// Rooms: a "cozy" rowhouse / a townhouse = 2 (the living room IS the kitchen), a duplex half / a house = 3.
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { saveSoon } from "../../core/save.js";
import { defineInterior, pick, pool } from "../interiors/engine.js";
import { rooms, movingBoxes, W, D } from "./rooms.js";
import { VIEWING, MINE, PATTER, TENANTS } from "./data.js";
import { realtorOf } from "./office.js";
import { S } from "./registry.js";
import { slotById, optOf } from "../decor/data.js";
import { buildOption, disposeObj, wallTex } from "../decor/props.js";
import { openPicker, pickerTick, pickerOpen, closePicker } from "../decor/picker.js";
import { HOUSE_SPOTS } from "../decor/house.js";

let API = null;                 // index.js: { buy(rec, opts), valueOf(rec), pitch(rec), townId(), afterBuy }
export function bindHouse(api) { API = api; }
/** Who's going in and why: { rec, mode: "viewing" | "owner" } (set right before the handoff). */
export const CUR = { rec: null, mode: null, bought: false, rt: null };
const patter = pool(PATTER);
const fmt = n => Math.round(n).toLocaleString("en-US");

export const HOUSE_DEF = defineInterior({
    id: "realestateHouse", name: "the house", short: "the house", emoji: "🏠",
    title: "🏠 A HOUSE FOR SALE", tagline: "",
    model: "homesKit", models: ["npcWoman", "npcMan"], music: "../story-relax.mp3",
    light: "indoor", cam: { dist: 7.0, height: 5.4, lookY: 0.8, clampX: 2.4 }, walkSpeed: 3.5,
    build, tick, dispose,
});
/** Title + tagline for what she's walking into. */
export function nameHouse(rec, mode, owner = null) {
    CUR.rec = rec; CUR.mode = mode; CUR.bought = false; CUR.owner = owner;
    HOUSE_DEF.name = rec ? rec.address : "the house";
    HOUSE_DEF.short = mode === "owner" ? "your house" : mode === "visit" ? `${owner}'s house` : "the house";
    HOUSE_DEF.title = mode === "owner" ? `🔑 ${rec.address.toUpperCase()} — YOURS` : mode === "visit" ? `🏠 ${String(owner).toUpperCase()}'S PLACE` : `🪧 FOR SALE — ${rec.address.toUpperCase()}`;
    HOUSE_DEF.tagline = mode === "owner" ? "home sweet (empty) home" : mode === "visit" ? `${rec.address} · friends over 👯` : `${rec.label} · ${fmt(API ? API.valueOf(rec) : rec.price)} 💰`;
    if (ctx.interiors.realestateHouse) ctx.interiors.realestateHouse.name = HOUSE_DEF.name;
}

const ROOMS = { 2: ["living", "bedroom"], 3: ["kitchen", "living", "bedroom"] };
function build(rt) {
    const rec = CUR.rec, mode = CUR.mode || "viewing";
    CUR.rt = rt;
    rt.root.visible = false;
    const n = rec && rec.rooms === 3 ? 3 : 2;
    const kinds = ROOMS[n];
    const li = kinds.indexOf("living");
    const visit = mode === "visit";
    const owner = mode === "owner" || visit;          // (a visit: a friend's home, looked at, not redecorated)
    const wallM = rt.own(new THREE.MeshStandardMaterial({ color: owner ? "#FAFAFA" : "#DCE8E0", roughness: 0.9 }));
    rt.data.wallM = wallM;
    const B = rooms(rt, n, {
        floors: n === 3 ? ["#ECEFF1", "#B58457", "#C79A6A"] : ["#B58457", "#C79A6A"],
        walls: owner ? (n === 3 ? ["#FAFAFA", "#FAFAFA", wallM] : ["#FAFAFA", wallM]) : n === 3 ? ["#FFF1D6", "#E8DCC6", wallM] : ["#E8DCC6", wallM],
        door: li, doorDx: 1.3,
    });
    const V = rt.data.V = { kinds, cx: B.cx, room: -1, said: new Set(), lastLine: 0, owner, target: null };
    const bz = -D / 2;
    // ── the kitchen corner (its own room in a big house; the living room's back wall in a cozy one) ──
    const kx = n === 3 ? B.cx[0] : B.cx[li] - 1.4;
    B.put("Counter", kx - 0.5, bz + 0.35, 0, 1.9, 0.66);
    B.put("Fridge", kx + 1.0, bz + 0.4, 0, 0.82, 0.74);
    if (n === 3) { B.put("Stove", kx - 2.0, bz + 0.38, 0, 0.8, 0.7); if (!owner) { B.put("KitchenTable", kx, 0.9, 0, 1.2, 1.2); B.put("Chair", kx, 1.75, Math.PI); } }
    // ── the living room ──
    const lx = B.cx[li];
    const bx = B.cx[n - 1];
    if (owner) {
        const tn = !visit && rec && S.rent[rec.id] && S.rent[rec.id].tenant != null ? TENANTS[S.rent[rec.id].tenant % TENANTS.length] : null;
        V.tenant = tn; V.bx = bx; V.cache = {}; V.objs = {};
        B.put("Rug", lx + 0.2, 0.3);
        B.put("BeanBag", lx + 0.6, -0.8, 0.4, 0.8, 0.8);
        B.put("FloorLamp", lx + 2.2, bz + 0.45, 0, 0.3, 0.3);
        if (!tn) movingBoxes(B, lx - 0.6, 0.9, 3, 2);
        // her room: a mattress on the floor where the bed goes (until she places a bed), the shelf / nightstand spots
        V.mattress = [B.box(1.1, 0.22, 2.0, "#ECEFF1", bx - 1.7, 0.11, -1.75), B.box(0.6, 0.12, 0.34, "#F8BBD0", bx - 1.7, 0.28, -2.45)];
        B.col("bed", bx - 2.32, bx - 1.08, -2.8, -0.62);
        if (!tn) movingBoxes(B, bx + 1.2, 0.9, 2, 5);
        // decorations she placed here (features/decor's catalogue + props; the room is decor's size)
        if (!visit) for (const id of DSLOTS) { const o = placedHere(id); if (o) show(rt, id, o); }
        if (tn) {
            // a tenant lives here: their stuff everywhere, no redecorating (that's their home now)
            try {
                rt.person("tenant", tn.key, { x: lx - 0.8, z: -0.4, ry: 0.4 }, { name: tn.name, colors: tn.colors, pose: {} });
                rt.hot({ id: "tenant", who: "tenant", track: true, r: 1.5, label: () => `${tn.emoji} ${tn.name} (your tenant)`, action: r => r.say(tn.name, pick(tn.lines), { emoji: tn.emoji, person: r.byId.tenant }) });
            } catch (e) { console.warn("[realestate] tenant", e); }
        } else if (!visit && !(ctx.party && ctx.party.active)) {     // (decorating is solo — like features/decor)
            for (const id of DSLOTS) {
                const sp = spotOf(id, bx), slot = slotById(id);
                if (!sp || !slot) continue;
                rt.hot({ id: "slot:" + id, x: sp.x, z: sp.z, r: sp.r, label: () => `${slot.icon} ${slot.name} — decorate`, action: r => pickHere(r, id) });
            }
        }
        // a welcome card on the wall
        const c = document.createElement("canvas"); c.width = 512; c.height = 160; const g = c.getContext("2d");
        g.fillStyle = "#FFF3F8"; g.fillRect(0, 0, 512, 160); g.fillStyle = "#AD1457"; g.font = "bold 52px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText("LULU'S PLACE ♥", 256, 62); g.font = "bold 26px sans-serif"; g.fillStyle = "#6D4C41"; g.fillText(rec ? rec.address : "", 256, 122);
        const t = rt.own(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace;
        const p = new THREE.Mesh(rt.own(new THREE.PlaneGeometry(1.6, 0.5)), rt.own(new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })));
        p.position.set(lx - 0.2, 1.9, bz + 0.01); rt.add(p);
    } else {
        // the sellers' things, half packed
        B.put("Couch", lx - 0.6, bz + 0.75, 0, 2.2, 0.9);
        B.put("CoffeeTable", lx - 0.6, 0.35, 0, 1.1, 0.6);
        B.put("TV", lx + 2.3, -0.3, -Math.PI / 2, 1.4, 0.45);
        movingBoxes(B, lx + 1.6, 1.2, 4, 3);
        B.put("BunkBed", bx - 1.6, bz + 0.6, 0, 2.0, 1.0);
        B.put("Bookcase", bx + 1.8, bz + 0.3, 0, 1.0, 0.45);
        movingBoxes(B, bx + 0.9, 0.9, 2, 7);
        const pc = B.put("Picture", lx - 0.6, bz + 0.02, 0); pc.position.y = 1.7;
    }
    // ── hotspots ──
    rt.hot({ id: "fridge", x: kx + 1.0, z: bz + 1.2, r: 1.0, label: "🧊 The fridge", action: r => r.say("Lulu", owner ? pick(["One pickle. My pickle. In MY fridge.", "Empty! Like my bank account. But in a fun way.", "It hums. We're friends now."]) : pick(["The sellers left a kugel. Is that… a sign? It's a sign.", "Seltzer, ketchup and one mysterious jar. A classic."]), { emoji: "🧊" }) });
    rt.hot({ id: "window", x: lx - 2.2, z: bz + 0.9, r: 1.0, label: "🪟 Look out the window", action: r => r.say("Lulu", pick(["The neighbours are watching me look at them. Mutual. Healthy.", "A view of the street! And a man walking a very small dog. Charming.", rec && rec.nbLine ? "I can see the neighbours from here. Oh. OH. That's what she meant." : "Trees! A tree. One tree. Love it."]), { emoji: "🪟" }) });
    if (owner && !V.tenant) {
        rt.hot({ id: "boxes", x: lx - 0.6, z: 1.8, r: 1.1, label: "📦 Unpack a box", action: r => r.say("Lulu", pick(["Box 1: socks. Box 2: more socks. Box 3: ONE fork.", "I packed a lamp, a scarf and a single sock-puppet. Priorities.", "Unpacking is just Pesach cleaning in reverse."]), { emoji: "📦" }) });

    }
    // ── the realtor (a viewing) ──
    if (!owner) {
        const R = realtorOf(rec ? rec.town : "lakewood");
        try {
            rt.person("realtor", R.name === "Mendel Brick" ? "npcMan" : "npcWoman", { x: B.doorX - 1.2, z: D / 2 - 1.3, ry: Math.PI }, { name: R.name, colors: R.colors, pose: {}, collide: false });
            rt.hot({ id: "realtor", who: "realtor", track: true, r: 1.5, label: () => `💬 ${R.name.split(" ")[0]} — make an offer`, action: talkDeal });
        } catch (e) { console.warn("[realestate] viewing realtor", e); }
    }
    rt.lulu.obj.position.set(B.doorX, 0, D / 2 - 0.9);
    rt.lulu.obj.rotation.y = Math.PI;
    rt.wait(0.8).then(() => { if (!rt.disposed && owner) rt.bubble(visit ? pick([`${CUR.owner}'s place! Nice echo. 👯`, `Okay, ${CUR.owner}, where's the snack cabinet?`]) : pick(MINE.inside), rt.lulu.obj, 2.8); });
}

/** Which room she's in (index) from her x. */
const roomAt = (V, x) => { let best = 0; V.cx.forEach((c, i) => { if (Math.abs(x - c) < Math.abs(x - V.cx[best])) best = i; }); return best; };

function tick(rt, dt) {
    const V = rt.data.V, rel = rt.byId.realtor;
    if (!V || V.owner || !rel) return;
    // the realtor keeps up with her (walks to the room she's in, a step behind) and says a line per room
    const L = rt.lulu.obj.position, i = roomAt(V, L.x);
    if (i !== V.room) {
        V.room = i;
        V.target = { x: V.cx[i] + (L.x < V.cx[i] ? 1.3 : -1.3), z: 1.4 };
        const kind = V.kinds[i];
        if (!V.said.has(kind) && rt.t > 1.0) { V.said.add(kind); V.sayAt = rt.t + 0.9; V.sayKind = kind; }
    }
    if (V.target) {
        const o = rel.p.obj, dx = V.target.x - o.position.x, dz = V.target.z - o.position.z, d = Math.hypot(dx, dz);
        if (d > 0.15) { const sp = Math.min(2.6, d * 2.2); o.position.x += dx / d * sp * dt; o.position.z += dz / d * sp * dt; rel.pose.walk = sp; rel.p.face(V.target.x, V.target.z, dt, 8); }
        else { rel.pose.walk = 0; V.target = null; }
    }
    if (V.sayAt && rt.t >= V.sayAt && !ctx.dialogOpen) {
        V.sayAt = 0;
        const lines = VIEWING[V.sayKind] || PATTER;
        rt.bubble(Math.random() < 0.8 ? pick(lines) : patter(), rel.p.obj, 3.4);
    }
}

async function talkDeal(rt) {
    const rec = CUR.rec, who = rt.byId.realtor;
    if (!rec || !API) return;
    const R = realtorOf(rec.town);
    if (CUR.bought) { await rt.say(R.name, "It's YOURS now, sweetheart. Go on — explore! I'll show myself out. (I'll be at the office. Selling.)", { emoji: R.emoji, person: who }); return; }
    const price = API.valueOf(rec);
    await rt.say(R.name, pick(VIEWING.close), { emoji: R.emoji, person: who });
    const i = await rt.choose(R.name, `${rec.address} — ${fmt(price)} coins.`, [`💰 Buy it — ${fmt(price)} 💰`, "🏦 What about a mortgage?", "🚪 Not today — let's go out"], { emoji: R.emoji, person: who });
    if (i === 0) { const ok = await API.buy(rec, { rt, who, realtor: R }); if (ok) { CUR.bought = true; } }
    else if (i === 1) await rt.say(R.name, API.mortgageLine ? API.mortgageLine(rec) : "The bank's on the high street — they LOVE paperwork. Talk to them!", { emoji: R.emoji, person: who });
    else if (i === 2) rt.leave();
}
// ── decorating her own house (features/decor's catalogue, picker and props) ──
const DSLOTS = ["bed", "lamp", "art", "shelf", "rug", "wallpaper"];
const DRCX = 6.2;                 // decor's own room centre (HOUSE_SPOTS are around it)
function spotOf(id, bx) { const sp = HOUSE_SPOTS[id]; return sp ? { x: sp.x - DRCX + bx, z: sp.z, r: sp.r, look: [sp.look[0] - DRCX + bx, sp.look[1], sp.look[2]] } : null; }
/** What's placed in THIS house (null = nothing yet). */
function placedHere(slot) { const id = CUR.rec && CUR.rec.id, P = id && S.decor[id]; const o = P && P[slot]; const sl = slotById(slot); return o && sl && optOf(sl, o) && ctx.decor && ctx.decor.owns(slot, o) ? o : null; }
function placeHere(slot, opt) {
    const id = CUR.rec && CUR.rec.id;
    if (!id || !ctx.decor || !ctx.decor.owns(slot, opt)) return false;
    (S.decor[id] = S.decor[id] || {})[slot] = opt;
    saveSoon();
    show(CUR.rt, slot, opt);
    return true;
}
const pickerApi = () => ({
    owns: (s, o) => !!(ctx.decor && ctx.decor.owns(s, o)),
    placed: s => placedHere(s),
    place: (s, o) => placeHere(s, o),
    preview: (s, o) => show(CUR.rt, s, o == null ? placedHere(s) : o),
    // a NEW thing is bought through features/decor (the same catalogue, prices, wallet, toasts) — then it goes HERE; her
    // family house keeps what it had
    buy(s, o) {
        if (!ctx.decor) return { ok: false, why: "bad" };
        if (ctx.decor.owns(s, o)) { placeHere(s, o); return { ok: true, why: "owned" }; }
        const prev = ctx.decor.placed(s);
        const r = ctx.decor.buy(s, o);
        if (r.ok) { if (prev && prev !== o) ctx.decor.place(s, prev); placeHere(s, o); emit("stat", { id: "reDecor", n: 1 }); }
        return r;
    },
});
function show(rt, slot, opt) {
    const V = rt && !rt.disposed && rt.data.V;
    if (!V || !V.cache) return;
    const sl = slotById(slot);
    if (!sl) return;
    if (slot === "wallpaper") {
        const o = opt && optOf(sl, opt);
        rt.data.wallM.map = o ? wallTex(o.wall) : null; rt.data.wallM.color.set(o ? "#ffffff" : "#FAFAFA"); rt.data.wallM.needsUpdate = true;
        return;
    }
    const cache = V.cache[slot] || (V.cache[slot] = {});
    if (opt && !(opt in cache)) {
        const obj = buildOption("inside", slot, opt);
        if (obj) { obj.position.x = V.bx; rt.add(obj); }
        cache[opt] = obj;
    }
    for (const k of Object.keys(cache)) if (cache[k]) cache[k].visible = k === opt;
    if (slot === "bed" && V.mattress) for (const m of V.mattress) m.visible = !opt;
}
function trim(rt, slot) {
    const V = rt && rt.data.V, cache = V && V.cache && V.cache[slot];
    if (!cache) return;
    const keep = placedHere(slot);
    for (const k of Object.keys(cache)) if (k !== keep) { disposeObj(cache[k]); delete cache[k]; }
    show(rt, slot, keep);
}
function pickHere(rt, id) {
    const slot = slotById(id), sp = spotOf(id, rt.data.V.bx);
    if (!slot || !sp) return;
    rt.focusAt = new THREE.Vector3(sp.look[0], sp.look[1] - 1.3, sp.look[2]);
    rt.faceTo = { x: sp.look[0], z: sp.look[2] };
    return rt.runMode({
        start() { openPicker(slot, pickerApi(), null); },
        update(r, dt, P) { return !pickerTick(P); },
        stop() { if (pickerOpen()) closePicker(true); rt.focusAt = null; trim(rt, id); },
    });
}
function dispose(rt) {
    if (pickerOpen()) closePicker(true);
    const V = rt && rt.data.V;
    if (V && V.cache) for (const c of Object.values(V.cache)) for (const o of Object.values(c)) if (o) o.traverse(m => { if (m.isMesh && m.userData.ownMaterial) m.material.dispose(); });
    if (CUR.rt === rt) CUR.rt = null;
}
export const HOUSE_SLOTS = DSLOTS;
export { W };
