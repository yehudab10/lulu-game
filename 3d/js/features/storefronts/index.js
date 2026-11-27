// ─────────────────────────────────────────────────────────────────────────
//  features/storefronts — 🏪 EVERY SHOPFRONT HAS A STATE (owner, 2026-11-27: "I want to eventually fill every building and
//  property with something … I want most places to have some sort of use and I don't necessarily want a bunch of stores
//  repeating themselves. I also am aware that this could clutter the map and any guides so this would have to be done
//  smartly.")
//
//  The towns' storefronts (features/town: town_shop / town_mw_store) get their state as the town builds (assign.js via
//  town/fronts.js' namer — a street never repeats a name). Here, out in the town:
//   • OPEN, ONE JOKE: ✋ at the door / walk through it (ci/doors) → the one shared shop room (room.js), dressed as that shop
//   • CLOSED NOW: real hours (hours.js) — a red CLOSED card on the door, ✋ reads its joke + when it opens
//   • COMING SOON: papered windows + the week's sign · FOR LEASE: a card in the window (ctx.storefronts.claim — playershops)
//   • saved for another feature (ci/cars' car-care row): "BACK IN 5"; offices / a dentist upstairs; closed for good
//   • a 🗺️ STREET DIRECTORY board on each shopping street: ✋ → its shops + today's hours; tap one → 📍 ping it
//  One-joke shops never get a Map pin of their own (their awning is the ad); the directory pings them through hidden pins.
//  Visuals: ONE merged mesh per town (a tiny 4-cell texture) for every door card + window paper; the room is one set.
//
//  ctx.storefronts = { fronts() (the town's fronts + live state), stateOf(f), enter(f), directory(list),
//    leasable(), claim(id, spec), release(id), debug }
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { ctx, on, emit, hook, setState } from "../../core/ctx.js";
import { setFrontNamer } from "../town/fronts.js";
import { nameFront, soonLines } from "./assign.js";
import { SHOPS, NAMED, STREETS, LULU_AT, titleCase } from "./data.js";
import { openAt, nextOpen, todayText } from "./hours.js";
import { dress, ROOM_ID } from "./room.js";
import { openCard, cardTick, cardOpen, closeCard } from "../shops/card.js";

setFrontNamer(nameFront);

const F = { town: null, list: [], boards: [], claims: new Map(), near: null, nearT: 0, group: null, tex: null, look: 0, dir: null };
const pick = a => a[Math.floor(Math.random() * a.length)];
const key = f => `${F.town}:${f.i}`;
const title = titleCase;

/** The data row behind a front (a one-joke shop's, a named non-shop's) or null. */
export function rowOf(f) {
    const st = f && f.st;
    if (!st) return null;
    return st.shop ? SHOPS[st.shop] || null : st.named ? NAMED[st.named] || null : null;
}
/** A front's live state: open | closed | soon | lease | use | office | dentist | gone | claimed. */
export function stateOf(f, date) {
    const st = f && f.st;
    if (!st) return "use";
    if (F.claims.has(f.id || key(f))) return "claimed";
    if (st.state === "open") return openAt(rowOf(f).hours, date) ? "open" : "closed";
    return st.state;
}

// ── the town's fronts (world coords), refreshed on the way in ───────────
function refresh() {
    clearLook();
    const T = ctx.town;
    if (!T || !T.active || !T.fronts) { F.town = null; F.list = []; return; }
    F.town = T.id;
    F.list = T.fronts.map(f => Object.assign(f, { id: `${T.id}:${f.i}` }));
    // (a landmark's own door — Brooklyn Kollege's registrar: the same one-joke room, through the quad's front)
    for (const name of Object.keys(SHOPS)) {
        const R = SHOPS[name], sp = R.landmark && T.spot ? T.spot(R.landmark) : null;
        if (!sp) continue;
        F.list.push({ id: `${T.id}:${R.landmark}`, i: -1, list: "landmark", name, sub: "", st: { state: "open", shop: name }, door: { x: sp.x, z: sp.z },
            nx: sp.nx, nz: sp.nz, ux: sp.ux, uz: sp.uz, w: 8, facade: null, landmark: R.landmark });
    }
    buildLook();
    buildBoards();
    hiddenPins();
}
on("town:enter", () => refresh());
on("town:built", e => { if (ctx.town && ctx.town.active && e && e.town === ctx.town.id) refresh(); });
on("town:leave", () => { clearLook(); F.town = null; F.list = []; F.near = null; });
on("title", () => { clearLook(); F.town = null; F.list = []; });

// ── the door spot: ONE foot spot that is always the nearest front's door ──
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || null;
function nearFront() {
    if (ctx.time < F.nearT) return F.near;
    F.nearT = ctx.time + 0.2;
    const p = herPos();
    F.near = null;
    if (!p || !F.list.length) return null;
    let bd = 7;
    for (const f of F.list) {
        const d = f.door ? Math.hypot(f.door.x - p.x, f.door.z - p.z) : 1e9;
        if (d < bd) { bd = d; F.near = f; }
    }
    // (walking up to an open shop: its room starts loading now, so the step through is short)
    if (F.near && stateOf(F.near) === "open") { const reg = ctx.interiors && ctx.interiors[ROOM_ID]; if (reg && reg.warm) reg.warm(); }
    return F.near;
}
const doorOf = f => f && f.door ? { x: f.door.x, z: f.door.z, nx: f.nx, nz: f.nz, ux: f.ux, uz: f.uz, len: f.w } : null;
function label(f) {
    if (!f) return "";
    const s = stateOf(f), R = rowOf(f), name = title(f.name);
    if (s === "open") return `${R.emoji || "🏪"} ${name.toUpperCase()} — WALK IN`;
    if (s === "closed") { const n = nextOpen(R.hours); return `🕐 ${name.toUpperCase()}: CLOSED${n ? " · " + n : ""}`; }
    if (s === "claimed") { const c = F.claims.get(f.id); return (c && c.label) || `🏪 ${name.toUpperCase()}`; }
    if (f.st && f.st.bowling) return "🎳 COMING SOON: EAST MIDWOOD LANES";
    return { soon: "🚧 COMING SOON", lease: "🏷️ FOR LEASE", use: `🔧 ${name.toUpperCase()}: BACK IN 5`, office: "🏢 OFFICES UPSTAIRS", dentist: "🦷 UPSTAIRS", gone: "🪧 CLOSED FOR GOOD" }[s] || "🏪";
}
function say(text) { const o = ctx.foot && ctx.foot.obj; if (o && ctx.foot.say) ctx.foot.say(o, text, 3.4); }
function act(f) {
    if (!f) return false;
    const s = stateOf(f), R = rowOf(f);
    if (s === "open") return enter(f);
    if (s === "claimed") { const c = F.claims.get(f.id); try { return c && c.enter ? c.enter(f) : false; } catch (e) { console.error("[storefronts] claim", e); return false; } }
    if (s === "closed") { say(`"${R.shut || "CLOSED"}"${nextOpen(R.hours) ? " — " + nextOpen(R.hours) : ""}`); return true; }
    if (s === "soon") { say(f.st.bowling ? "East Midwood Lanes! Bowling! In MIDWOOD! …'Strike while the iron is hot.' They're very proud of that one." : `"COMING SOON: ${soonLines()[1]}." ${pick(LULU_AT.soon)}`); return true; }
    if (s === "use" && R && R.shut) { say(`"${R.shut}" — ${pick(LULU_AT.use)}`); return true; }
    say(pick(LULU_AT[s] || LULU_AT.lease));
    return true;
}
/** Walk into an open front's shop (the one shared room, dressed as it). */
export function enter(f) {
    const R = rowOf(f), reg = ctx.interiors && ctx.interiors[ROOM_ID];
    if (!R || !reg || stateOf(f) !== "open") return false;
    dress(f.st.shop, R, [f.name, f.sub]);
    const dr = f.door, n = ctx.world.road.nearest(dr.x, dr.z, ctx.car.s, {});
    const ref = { id: "storefront:" + f.id, s: n.s, d: n.d, side: Math.sign(n.d) || 1 };
    emit("stat", { id: "storefrontVisits", n: 1 });
    emit("storefronts:enter", { id: f.id, shop: f.st.shop, town: F.town });
    const exit = () => { if (ctx.foot && ctx.foot.active !== undefined) setState("footRun", { resume: "interior", door: ref }); };
    return reg.enter({ exit, door: ROOM_ID, from: "foot" });
}
const doorSpot = {
    r: 2.6, short: "SHOP",
    pos() { const f = nearFront(); return f ? doorOf(f) : null; },
    get door() { const f = F.near; return !!f && stateOf(f) === "open"; },
    get walkIn() { const f = F.near; return f && stateOf(f) === "open" ? { id: ROOM_ID } : null; },
    label: () => label(F.near),
    act: () => act(F.near),
};

// ── how a front looks: a door card (OPEN / CLOSED), papered windows, a FOR LEASE card — ONE mesh per town ──
const CELLS = ["open", "closed", "paper", "lease"];
function texture() {
    if (F.tex) return F.tex;
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128;
    const g = cv.getContext("2d"), cell = (i, bg, fg, text, sub) => {
        const x = i * 128;
        g.fillStyle = bg; g.fillRect(x + 2, 2, 124, 124);
        g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = "bold 26px system-ui, sans-serif"; g.fillText(text, x + 64, sub ? 52 : 64);
        if (sub) { g.font = "bold 15px system-ui, sans-serif"; g.fillText(sub, x + 64, 84); }
    };
    cell(0, "#2e7d32", "#ffffff", "OPEN", "come in!");
    cell(1, "#c62828", "#ffffff", "CLOSED", "see hours");
    // brown paper with a taped COMING SOON
    g.fillStyle = "#c8a97e"; g.fillRect(258, 2, 124, 124);
    g.strokeStyle = "rgba(90,60,30,.25)"; for (let y = 8; y < 126; y += 9) { g.beginPath(); g.moveTo(258, y); g.lineTo(382, y + 3); g.stroke(); }
    g.fillStyle = "#fff8e1"; g.fillRect(272, 44, 96, 40); g.fillStyle = "#bf360c"; g.textAlign = "center"; g.font = "bold 15px system-ui, sans-serif"; g.fillText("COMING", 320, 58); g.fillText("SOON", 320, 74);
    cell(3, "#fffde7", "#b71c1c", "FOR", "LEASE");
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
    return (F.tex = t);
}
function clearLook() {
    if (F.group) { F.group.removeFromParent(); F.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); F.group = null; }
    for (const b of F.boards) if (b.obj) { b.obj.removeFromParent(); b.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && o.material.map !== F.tex) { o.material.map.dispose(); o.material.dispose(); } }); }
    F.boards = [];
}
function buildLook() {
    const pos = [], uv = [], idx = [];
    const quad = (cx, cy, cz, ux, uz, nx, nz, w, h, cellI) => {
        const b = pos.length / 3, u0 = cellI / 4 + 0.004, u1 = (cellI + 1) / 4 - 0.004;
        for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            // (the model's +X along the street is −u: the card reads left-to-right from the street)
            pos.push(cx - ux * a * w / 2 + nx * 0.03, cy + c * h / 2, cz - uz * a * w / 2 + nz * 0.03);
        }
        uv.push(u0, 0, u1, 0, u1, 1, u0, 1);
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    F.look = 0;
    for (const f of F.list) {
        const fa = f.facade;
        if (!fa) continue;
        const s = f.st ? f.st.state : "use";
        if (s === "open") { quad(fa.x + f.ux * 0.95, 1.55, fa.z + f.uz * 0.95, f.ux, f.uz, f.nx, f.nz, 0.5, 0.5, 0); f.card = pos.length / 3 - 4; }
        else if (s === "soon") for (const o of [-2.5, 2.5]) quad(fa.x + f.ux * o, 1.45, fa.z + f.uz * o, f.ux, f.uz, f.nx, f.nz, 2.1, 1.7, 2);
        else if (s === "lease") quad(fa.x + f.ux * 2.4, 1.5, fa.z + f.uz * 2.4, f.ux, f.uz, f.nx, f.nz, 0.8, 0.8, 3);
        else continue;
        F.look++;
    }
    if (!idx.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture(), side: THREE.DoubleSide, toneMapped: false }));
    m.name = "storefronts"; m.frustumCulled = false;
    F.group = new THREE.Group(); F.group.add(m);
    ctx.scene.add(F.group);
    F.uvT = 0; cardUVs(true);
}
/** OPEN ↔ CLOSED on the door cards, as the hours turn (checked twice a minute). */
function cardUVs(force = false) {
    const m = F.group && F.group.children[0];
    if (!m) return;
    const uvA = m.geometry.attributes.uv;
    let dirty = false;
    for (const f of F.list) {
        if (f.card == null) continue;
        const open = stateOf(f) === "open", c = open ? 0 : 1;
        if (!force && f.cardOpen === open) continue;
        f.cardOpen = open; dirty = true;
        const u0 = c / 4 + 0.004, u1 = (c + 1) / 4 - 0.004;
        uvA.setXY(f.card, u0, 0); uvA.setXY(f.card + 1, u1, 0); uvA.setXY(f.card + 2, u1, 1); uvA.setXY(f.card + 3, u0, 1);
    }
    if (dirty) uvA.needsUpdate = true;
}
hook("hud", dt => { if (F.group && (F.uvT = (F.uvT || 0) + (dt || 0)) > 30) { F.uvT = 0; cardUVs(); } });

// ── the street directory: one board per shopping street ──────────────────
function boardTex(street) {
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 192;
    const g = cv.getContext("2d");
    g.fillStyle = "#1b3a2b"; g.fillRect(0, 0, 256, 192);
    g.strokeStyle = "#e8c766"; g.lineWidth = 6; g.strokeRect(6, 6, 244, 180);
    g.fillStyle = "#e8c766"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "bold 22px system-ui, sans-serif"; g.fillText(street, 128, 52);
    g.font = "bold 18px system-ui, sans-serif"; g.fillText("STREET DIRECTORY", 128, 92);
    g.font = "15px system-ui, sans-serif"; g.fillStyle = "#f5f1e6"; g.fillText("shops · hours · ✋", 128, 134);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function buildBoards() {
    const names = STREETS[F.town] || {};
    for (const list of Object.keys(names)) {
        const first = F.list.find(f => f.list === list && f.door);
        if (!first) continue;
        // (on the sidewalk at the street's first shop, beside its door: between it and the next one)
        const x = first.lotX + first.nx * 1.6 + first.ux * (first.w / 2), z = first.lotZ + first.nz * 1.6 + first.uz * (first.w / 2);
        const obj = new THREE.Group();
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), new THREE.MeshStandardMaterial({ color: "#263238" }));
        post.position.set(0, 0.6, 0); obj.add(post);
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshBasicMaterial({ map: boardTex(names[list]), side: THREE.DoubleSide, toneMapped: false }));
        panel.position.set(0, 1.55, 0); obj.add(panel);
        obj.position.set(x, 0, z); obj.rotation.y = Math.atan2(first.nx, first.nz);
        ctx.scene.add(obj);
        F.boards.push({ list, name: names[list], x, z, nx: first.nx, nz: first.nz, ux: first.ux, uz: first.uz, obj });
    }
}
function nearBoard() {
    const p = herPos();
    if (!p) return null;
    let best = null, bd = 2.4;
    for (const b of F.boards) { const d = Math.hypot(b.x + b.nx * 0.8 - p.x, b.z + b.nz * 0.8 - p.z); if (d < bd) { bd = d; best = b; } }
    return best;
}
/** The shops of a street (open + closed-by-hours ones, with today's hours) + a count of everything else. */
export function directory(list) {
    const shops = [], other = {};
    for (const f of F.list) {
        if (f.list !== list) continue;
        const s = stateOf(f), R = rowOf(f);
        if ((s === "open" || s === "closed") && R && R.hours) shops.push({ id: f.id, name: title(f.name), emoji: R.emoji || "🏪", open: s === "open", hours: todayText(R.hours) });
        else other[s] = (other[s] || 0) + 1;
    }
    return { shops, other };
}
function openDirectory(b) {
    if (!b || cardOpen() || !ctx.foot || !ctx.foot.script) return false;
    const D = directory(b.list);
    const rest = Object.entries(D.other).map(([k, n]) => `${n} ${{ soon: "coming soon", lease: "for lease", office: "offices", dentist: "upstairs", gone: "closed for good", use: "back in 5", claimed: "new" }[k] || k}`).join(" · ");
    const ok = ctx.foot.script({
        update(dt, P, Fo) { if (Fo && Fo.lulu) Fo.lulu.update(dt, { walk: 0 }); return cardTick(P); },
        abort() { if (cardOpen()) closeCard(true); },
    });
    if (!ok) return false;
    F.dir = b.list;
    openCard({
        title: `🗺️ ${b.name} — street directory`,
        head: () => `Today's hours. Tap a shop to 📍 ping it.${rest ? `<br><small>Also on ${b.name}: ${rest}.</small>` : ""}`,
        tiles: D.shops.map(s => ({ id: s.id, icon: s.emoji, name: s.name, desc: s.hours, tag: () => (s.open ? "OPEN" : "CLOSED"),
            act: () => { if (ctx.pins && ctx.pins.ping) ctx.pins.ping("shop:" + s.id, { from: "directory" }); closeCard(); } })),
        focus: D.shops[0] && D.shops[0].id,
        onClose: () => { F.dir = null; },
    });
    emit("storefronts:directory", { town: F.town, list: b.list });
    return true;
}
const boardSpot = {
    r: 2.2, short: "DIRECTORY",
    pos() { const b = nearBoard(); return b ? { x: b.x + b.nx * 0.8, z: b.z + b.nz * 0.8 } : null; },
    label: () => { const b = nearBoard(); return b ? `🗺️ ${b.name} — STREET DIRECTORY` : ""; },
    act: () => openDirectory(nearBoard()),
};
/** The directory's pings: each shop a HIDDEN pin (never listed on the Map — the awning is the ad — but pingable). */
function hiddenPins() {
    const P = ctx.pins;
    if (!P || !P.add) return;
    for (const f of F.list) {
        if (!(f.st && f.st.state === "open") || f.dlx == null) continue;
        const R = rowOf(f);
        P.add({ id: "shop:" + f.id, name: title(f.name), icon: R.emoji || "🏪", cat: "shops", town: F.town, local: [f.dlx, f.dlz], sub: f.sub, hidden: () => true });
    }
}

// ── for ci/playershops: a FOR LEASE front can be claimed (like realestate claims doors) ──
/** The FOR LEASE fronts of the town she's in: [{ id, name, x, z }]. */
export function leasable() { return F.list.filter(f => f.st && f.st.state === "lease" && !F.claims.has(f.id)).map(f => ({ id: f.id, list: f.list, x: f.door.x, z: f.door.z })); }
/** Claim a front: spec { label?, enter?(front) } — its ✋ is the claimer's from then on. */
export function claim(id, spec = {}) { if (!id) return false; F.claims.set(id, spec); return true; }
export function release(id) { return F.claims.delete(id); }

on("boot", () => {
    // (the town stays where it is while she's in a shop: she walks back out onto the same sidewalk)
    if (ctx.town && ctx.town.allowState) ctx.town.allowState("interior");
    if (ctx.foot && ctx.foot.addSpot) { ctx.foot.addSpot(doorSpot); ctx.foot.addSpot(boardSpot); }
});

ctx.storefronts = {
    /** The town's fronts: [{ id, i, list, name, sub, st, state (live), x, z, door }] (world). */
    fronts: () => F.list.map(f => ({ id: f.id, i: f.i, list: f.list, name: f.name, sub: f.sub, st: f.st, state: stateOf(f), door: f.door ? { x: f.door.x, z: f.door.z } : null, facade: !!f.facade, landmark: f.landmark || null })),
    stateOf: f => stateOf(typeof f === "string" ? F.list.find(x => x.id === f) : f),
    enter: f => enter(typeof f === "string" ? F.list.find(x => x.id === f) : f),
    directory, leasable, claim, release,
    debug: { F, nearFront, nearBoard, openDirectory, label: f => label(typeof f === "string" ? F.list.find(x => x.id === f) : f), act: f => act(typeof f === "string" ? F.list.find(x => x.id === f) : f), refresh },
};
