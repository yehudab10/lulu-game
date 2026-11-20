// features/openworld — 🎮 GAME SPOTS: places in each town to start the party games from, instead of the phone.
//
//   🕹️ an arcade cabinet outside the pizza shop · 📋 a notice board by the hall / the shul (whichever the town has)
//
// Walk up → ✋ GAMES (foot's spot) · drive up and stop beside it → ✕ (the prompt) → a card: who's around (and how
// far), the four games, what's on. Starting one from here is an INVITATION (index.js): the starter is in, a gold
// beacon goes up over the spot, friends get a chip ("🎮 Dina: 🥘 Hot Kugel at Pizza Shmizza · 12 s — come over")
// and opt in by coming over (≤ 24 m), tapping the chip, or 📱 👯 → Join. Nobody is warped, held or pulled out of
// what they're doing; whoever opted in lines up at the spot when it starts (back in their car if they were
// walking). Solo, the card starts the solo games (time trial, photo hunt) at once. The 📱 👯 app stays a shortcut.
//
// The props are a handful of plain three.js boxes (baked into ONE vertex-coloured mesh) + canvas-textured faces
// (no new .glb: 2–4 draw calls a spot),
// built when the town is entered and disposed with it. Placed from ctx.town.spot(…) — never fixed coordinates
// (towns move: ci/oneworld).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx, on, emit, hook } from "../../core/ctx.js";
import { input, glyph } from "../../input.js";
import * as H from "../../hud.js";
import { tone } from "../parking/sfx.js";
import { esc } from "./hud.js";

let E = null;                        // openworld's internals (index.js passes them in)
const SP = { list: [], cols: [], group: null, town: "", texs: [], mats: [], geos: [], near: null, carT: 0, shown: false, footRm: null, t: 0 };
// what goes where: the first named spot a town has wins (data — a new town just needs one of these landmarks)
const PLACES = [
    { kind: "arcade", keys: ["pizza", "bakery"], u: -7.5, n: 0.4, name: (t, k) => k === "pizza" ? (t === "midwood" ? "the Slice of Sinai arcade" : "the Pizza Shmizza arcade") : "the arcade on the avenue" },
    { kind: "board", keys: ["hall", "shul", "yeshiva", "welcome"], u: 9.5, n: 0.2, name: (t, k) => k === "shul" ? "the shul notice board" : k === "hall" ? "the notice board by the hall" : "the town notice board" },
];

function canvasTex(draw, w = 512, h = 256) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    SP.texs.push(t);
    return t;
}
const EMO = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
function mat(o) { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0.05 }, o)); SP.mats.push(m); return m; }
function box(w, h, d) { const g = new THREE.BoxGeometry(w, h, d); SP.geos.push(g); return g; }

function makeArcade() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(box(0.92, 1.72, 0.78), mat({ color: "#6A1B9A" }));
    body.position.y = 0.86;
    const side = mat({ color: "#FFD54F" });
    for (const sx of [-0.47, 0.47]) { const s = new THREE.Mesh(box(0.04, 1.9, 0.82), side); s.position.set(sx, 0.95, 0); g.add(s); }
    const marquee = new THREE.Mesh(box(0.96, 0.34, 0.6), mat({ color: "#311B92" }));
    marquee.position.set(0, 1.98, -0.06);
    const mq = canvasTex((c, w, h) => {
        const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#E91E63"); gr.addColorStop(1, "#7E57C2");
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
        c.font = `700 92px Fredoka, Arial, sans-serif`; c.fillStyle = "#FFF59D"; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText("PARTY GAMES", w / 2, h / 2 + 4, w - 30);
    }, 512, 128);
    const mqFace = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.3), mat({ map: mq, emissive: "#ffffff", emissiveMap: mq, emissiveIntensity: 0.55 }));
    SP.geos.push(mqFace.geometry);
    mqFace.position.set(0, 1.98, 0.245);
    const scr = canvasTex((c, w, h) => {
        c.fillStyle = "#0D1B2A"; c.fillRect(0, 0, w, h);
        c.font = `120px ${EMO}`; c.textAlign = "center"; c.textBaseline = "middle";
        ["🚓", "🥘", "📸", "📍"].forEach((e, i) => c.fillText(e, w * (0.14 + i * 0.24), h * 0.42));
        c.font = `700 40px Fredoka, Arial, sans-serif`; c.fillStyle = "#80DEEA";
        c.fillText("1–8 PLAYERS · WALK UP ✋", w / 2, h * 0.84, w - 20);
    }, 512, 256);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.44), mat({ map: scr, emissive: "#ffffff", emissiveMap: scr, emissiveIntensity: 0.8 }));
    SP.geos.push(screen.geometry);
    screen.position.set(0, 1.42, 0.40); screen.rotation.x = -0.22;
    const panel = new THREE.Mesh(box(0.9, 0.1, 0.36), mat({ color: "#212121" }));
    panel.position.set(0, 1.0, 0.5); panel.rotation.x = 0.25;
    const btn = mat({ color: "#FF5252", emissive: "#FF1744", emissiveIntensity: 0.4 });
    for (const bx of [-0.2, 0.05, 0.25]) { const b = new THREE.Mesh(box(0.08, 0.05, 0.08), btn); b.position.set(bx, 1.07, 0.52); g.add(b); }
    g.add(body, marquee, mqFace, screen, panel);
    return g;
}
function makeBoard() {
    const g = new THREE.Group();
    const wood = mat({ color: "#6D4C41" });
    for (const sx of [-1.0, 1.0]) { const p = new THREE.Mesh(box(0.1, 2.3, 0.1), wood); p.position.set(sx, 1.15, 0); g.add(p); }
    const frame = new THREE.Mesh(box(2.1, 1.3, 0.08), wood);
    frame.position.set(0, 1.55, 0);
    const tx = canvasTex((c, w, h) => {
        c.fillStyle = "#C8A26B"; c.fillRect(0, 0, w, h);
        const card = (x, y, cw, ch, bg, rot) => { c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = bg; c.fillRect(-cw / 2, -ch / 2, cw, ch); c.restore(); };
        card(w * 0.5, h * 0.2, w * 0.86, h * 0.26, "#FFF8E1", -0.01);
        c.fillStyle = "#1A237E"; c.font = `700 52px Fredoka, Arial, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText("PARTY GAMES · TONIGHT!", w / 2, h * 0.2, w * 0.8);
        const items = [["🚓", "Cops & Robbers"], ["🥘", "Hot Kugel"], ["📸", "Photo Hunt"], ["📍", "Race to a Pin"]];
        items.forEach(([e, t], i) => {
            const x = w * (0.27 + (i % 2) * 0.46), y = h * (0.52 + Math.floor(i / 2) * 0.3);
            card(x, y, w * 0.42, h * 0.24, ["#FFCDD2", "#FFE0B2", "#F8BBD0", "#C8E6C9"][i], (i % 2 ? 0.02 : -0.025));
            c.font = `56px ${EMO}`; c.fillText(e, x - w * 0.15, y + 2);
            c.font = `700 30px Fredoka, Arial, sans-serif`; c.fillStyle = "#3E2723"; c.fillText(t, x + w * 0.04, y + 2, w * 0.26);
            c.fillStyle = "#1A237E";
        });
    }, 512, 320);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.18), mat({ map: tx, roughness: 0.9 }));
    SP.geos.push(face.geometry);
    face.position.set(0, 1.55, 0.045);
    g.add(frame, face);
    return g;
}
/** One draw call for a prop's plain painted boxes: every mesh with no texture and no glow is baked into a single
 *  vertex-coloured mesh (same colours / roughness); the textured faces and the glowing buttons stay as they are.
 *  (The arcade was 12 meshes — a dozen draw calls in the town's busiest view.) */
let bakedMat = null;
function bake(g) {
    const flat = g.children.filter(o => o.isMesh && !o.material.map && !(o.material.emissiveIntensity > 0 && o.material.emissive.getHex() !== 0));
    if (flat.length < 2) return g;
    const geos = flat.map(o => {
        o.updateMatrix();
        const geo = o.geometry.clone().applyMatrix4(o.matrix);
        const n = geo.attributes.position.count, col = new Float32Array(n * 3), c = o.material.color;
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
        return geo;
    });
    const merged = mergeGeometries(geos, false);
    for (const geo of geos) geo.dispose();
    if (!merged) return g;
    SP.geos.push(merged);
    if (!bakedMat) bakedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 });
    for (const o of flat) g.remove(o);
    g.add(new THREE.Mesh(merged, bakedMat));
    // (the rest: meshes that share one untextured material — the arcade's three glowing buttons — one draw call too)
    const byMat = new Map();
    for (const o of g.children) if (o.isMesh && !o.material.map && o.material !== bakedMat) byMat.set(o.material, (byMat.get(o.material) || []).concat(o));
    for (const [m, list] of byMat) {
        if (list.length < 2) continue;
        const gs = list.map(o => { o.updateMatrix(); return o.geometry.clone().applyMatrix4(o.matrix); });
        const one = mergeGeometries(gs, false);
        for (const geo of gs) geo.dispose();
        if (!one) continue;
        SP.geos.push(one);
        for (const o of list) g.remove(o);
        g.add(new THREE.Mesh(one, m));
    }
    return g;
}

/** A 🎮 label floating over a spot (so you find it from the car). */
function makeTag(emoji) {
    const t = canvasTex((c, w, h) => { c.font = `110px ${EMO}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(emoji, w / 2, h / 2 + 6); }, 128, 128);
    const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false });
    SP.mats.push(m);
    const s = new THREE.Sprite(m);
    s.scale.set(0.9, 0.9, 1);
    return s;
}

function build() {
    clear();
    const T = ctx.town;
    if (!T || !T.active || !T.spot) return;
    SP.group = new THREE.Group();
    SP.group.name = "owSpots";
    SP.town = T.id;
    for (const P of PLACES) {
        let sp = null, key = "";
        for (const k of P.keys) { sp = T.spot(k); if (sp) { key = k; break; } }
        if (!sp) continue;
        const rot = sp.rot || 0;
        const nx = sp.nx != null ? sp.nx : Math.sin(rot), nz = sp.nz != null ? sp.nz : Math.cos(rot);
        const ux = sp.ux != null ? sp.ux : Math.cos(rot), uz = sp.uz != null ? sp.uz : -Math.sin(rot);
        const x = sp.x + ux * P.u + nx * P.n, z = sp.z + uz * P.u + nz * P.n;
        const obj = bake(P.kind === "arcade" ? makeArcade() : makeBoard());
        obj.position.set(x, 0, z);
        obj.rotation.y = Math.atan2(nx, nz);
        obj.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });   // (the contact shadow grounds it: no shadow-pass cost)
        const tag = makeTag(P.kind === "arcade" ? "🕹️" : "📋");
        tag.position.set(x, 3.0, z);
        SP.group.add(obj, tag);
        // where she stands to use it: just in front of it
        SP.list.push({ kind: P.kind, nx, nz, name: P.name(T.id, key), x, z, fx: x + nx * 1.1, fz: z + nz * 1.1, obj, tag });
    }
    if (SP.list.length) ctx.scene.add(SP.group);
}
function clear() {
    if (SP.group) SP.group.removeFromParent();
    for (const t of SP.texs) t.dispose();
    for (const m of SP.mats) m.dispose();
    for (const g of SP.geos) g.dispose();
    SP.texs.length = SP.mats.length = SP.geos.length = 0;
    for (const c of SP.cols) c.off = true;
    SP.cols.length = 0; SP.solid = false;
    SP.list.length = 0; SP.group = null; SP.town = ""; SP.near = null;
    if (SP.shown) { H.prompt(""); SP.shown = false; }
}
const nearest = (x, z, r) => { let best = null, bd = r * r; for (const s of SP.list) { const d = (s.fx - x) ** 2 + (s.fz - z) ** 2; if (d < bd) { bd = d; best = s; } } return best; };

// ── the card ──────────────────────────────────────────────────────────────
const mi = m => (m >= 1000 ? `${(m / 1609).toFixed(1)} mi` : `${Math.round(m / 5) * 5} m`);
function openCard(spot) {
    if (!E || !spot) return;
    const party = E.roam(), g = E.getG(), me = E.me();
    const lp = ctx.foot && ctx.foot.active && ctx.foot.pos ? ctx.foot.pos : ctx.car.pos;
    let html = `<h2>${spot.kind === "arcade" ? "🕹️" : "📋"} Party games</h2><p class="pt-sub">${esc(spot.name)}</p>`;
    if (party) {
        const mem = E.members().filter(u => u !== me);
        const rows = mem.map(u => {
            const p = E.posOf(u), z = E.zoneOfPeer(ctx.party.peer(u)), pr = ctx.party.presenceOf(u);
            const where = p && z === E.zone() ? mi(Math.hypot(p.x - lp.x, p.z - lp.z)) : z ? "in town" : "on the highway";
            return `<span class="ow-who"><i style="background:${E.skinHex(u)}"></i>${esc(E.nameOf(u))} <small>${pr && pr.icon ? esc(pr.icon) + " " : ""}${where}</small></span>`;
        });
        html += `<div class="ow-crew">${rows.length ? rows.join("") : `<small>Nobody else here yet — the party code is <b>${esc(ctx.party.code)}</b></small>`}</div>`;
    }
    const buttons = [];
    if (g && g.ph === "in") {
        const G = E.GAMES[g.k];
        html += `<p class="lp-note">${G.emoji} <b>${esc(G.name)}</b> is starting${g.spot ? " at " + esc(g.spot.name) : ""} — ${g.ps.length} in</p>`;
        if (!g.ps.includes(me)) buttons.push({ id: "owSpotJoin", cls: "pt-big", label: `<span>✅ Join ${esc(G.name)} ${glyph("confirm")}</span>`, action: () => { H.hideScreen(); E.optIn(g); } });
        else if (g.by === me) buttons.push({ id: "owSpotGo", cls: "pt-big", label: `<span>▶ Start now</span><small>${g.ps.length} playing</small>`, action: () => { H.hideScreen(); E.send("owgo", g.n); } });
    } else if (g && g.ph === "go") {
        const G = E.GAMES[g.k];
        html += `<p class="lp-note">${G.emoji} ${esc(G.name)} is on — ${g.ps.includes(me) ? "you're playing!" : "you're in the next one"}</p>`;
    } else {
        for (const k of E.ORDER) {
            const G = E.GAMES[k], why = E.blockReason(k);
            if (!party && !G.solo) continue;
            buttons.push({ id: "owSpot_" + k, cls: why ? "alt" : "", label: `<span>${G.emoji} ${esc(G.name)}</span><small>${esc(why || (party ? G.blurb + " · friends opt in" : G.blurb))}</small>`,
                action: () => {
                    if (why) { H.toast(why, "red"); return; }
                    const res = E.requestGame(k, { spot: { name: spot.name, x: spot.fx, z: spot.fz } });
                    if (res) { H.toast(res, "red"); return; }
                    H.hideScreen();
                    tone(660, 0.1, "triangle", 0.16, 990);
                } });
        }
    }
    buttons.push({ id: "owSpotBack", cls: "alt", label: `<span>Back ${glyph("back")}</span>`, action: () => H.hideScreen() });
    H.showScreen(html, buttons, { onBack: () => H.hideScreen(), focus: buttons[0].id, cls: "pt-card ow-spot" });
    emit("openworld:spot", { kind: spot.kind });
}

// ── per frame: the 🕹️ / 📋 bob, the drive-up prompt ───────────────────────
/** Solid: the cabinet is one block, the board's two posts are (she can walk between them). Added once the town's own
 *  chunk is the active one (at town:enter it isn't yet), into the town's collider grid. */
function addSolids() {
    const ch = ctx.world.activeChunks();
    let tc = null;
    for (const c of ch) if (c.k === -1 && c.addCollider) { tc = c; break; }
    if (!tc) return;
    for (const sp of SP.list) {
        const yaw = Math.atan2(sp.nx, sp.nz), cx = Math.cos(yaw), cz = -Math.sin(yaw);
        const cs = sp.kind === "arcade" ? [[0, 0.52]] : [[-1.0, 0.2], [1.0, 0.2]];
        for (const [lu, r] of cs) SP.cols.push(tc.addCollider({ x: sp.x + cx * lu, z: sp.z + cz * lu, r, kind: "prop" }));
    }
    SP.solid = true;
}
hook("update", (dt, P) => {
    if (SP.list.length && !SP.solid) addSolids();
    if (!SP.list.length) return;
    SP.t += dt;
    for (const s of SP.list) s.tag.position.y = 3.0 + Math.sin(SP.t * 2.2 + s.x) * 0.12;
    // in the car: stopped beside one → ✕ opens the card (act on the prompt that was showing BEFORE this press: ✕ is gas too)
    const car = ctx.car;
    if (SP.shown && P.interact && ctx.state === "playing" && SP.near) { H.prompt(""); SP.shown = false; SP.carT = 0; openCard(SP.near); return; }
    const near = ctx.state === "playing" && !ctx.paused && !(ctx.foot && ctx.foot.offering) ? nearest(car.pos.x, car.pos.z, 9) : null;
    SP.carT = near && car.speed < 1 && input.throttle < 0.05 ? SP.carT + dt : 0;
    const show = SP.carT > 0.6;
    SP.near = show ? near : null;
    if (show) H.prompt(`${glyph("interact")} ${near.kind === "arcade" ? "🕹️" : "📋"} Party games`);
    else if (SP.shown) H.prompt("");
    SP.shown = show;
}, 20);

on("town:enter", () => { try { build(); } catch (e) { console.error("[openworld] spots", e); } });
on("town:leave", () => clear());
on("title", () => clear());

export function initSpots(api) {
    E = api;
    // on foot: ✋ GAMES (foot's spot list — pos() → null away from a spot)
    if (ctx.foot && ctx.foot.addSpot && !SP.footRm) {
        const spot = {
            pos: () => { const f = ctx.foot.pos; const s = f && nearest(f.x, f.z, 3); spot.cur = s; return s ? { x: s.fx, z: s.fz } : null; },
            r: 2.4, short: "GAMES",
            label: () => (spot.cur ? `${spot.cur.kind === "arcade" ? "🕹️" : "📋"} PARTY GAMES` : ""),
            act: () => openCard(spot.cur),
        };
        SP.footRm = ctx.foot.addSpot(spot);
    }
}
export const spotsDebug = { SP, open: openCard, build };
