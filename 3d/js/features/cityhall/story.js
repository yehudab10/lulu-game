// features/cityhall/story.js — 🕴️ THE CORRUPTION THREAD (stage 5), one small story per town (STORY in data.js):
//   1. SHMULY THE EXPEDITER on the lobby bench: with a permit waiting (permits.js), "skip the line" — STORY_PAY.expedite
//      coins → granted on the spot (a coin sink; no risk, it's only rude). He mentions whose friend he is.
//   2. THE NOTICE BOARD: "PAVING CONTRACT AWARDED: <firm>. Number of bids: 1." — reading it starts the story (step 1).
//   3. THE CREW: from then on, while she walks in that town, the brother-in-law's crew is repaving the perfectly smooth
//      street in front of city hall (a barrier, a little steamroller, the boss): ✋ 📸 snap a photo (EVIDENCE) · 🤝 a cut
//      (STORY_PAY.cut, once per town, within the day cap — STORY_PAY.sting of the time it's an Internal Affairs sting →
//      the law's arrest, BRIBING A PUBLIC SERVANT (MINOR), crime's charge with its own court lines) · walk on.
//   4. THE PHOTO → 📞 Phone › 🏛️ City Hall: 📰 the local paper (exposed: the contract cancelled, the crew gone, the mayor
//      sheepish) · 🕵️ Internal Affairs (exposed: the boss on pothole duty) · 💰 sell it back (hush money; the mayor is
//      friendly). Every payout once per town, ≤ STORY_PAY.dayCap a real day; coins never below 0.
// Emits `cityhall:corrupt` {who, act} (like crime's `crime:corrupt`) + `cityhall:story` {town, step, how}; remembered
// through ctx.memory when it's there. Solo (in a party the crew isn't there; the expediter still sits on his bench).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx, on, emit } from "../../core/ctx.js";
import { choose, say } from "../../core/dialog.js";
import { wallet } from "../../core/save.js";
import { addCoins } from "../../core/driving.js";
import { ensureModels, models } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import * as H from "../../hud.js";
import { ID, STORY, STORY_PAY as PAY, STORY_LINES as SL, TAX_LINES as TL, BOARD } from "./data.js";
import { LOBBY_BUILDERS, MAYOR_LINES } from "./lobby.js";
import { S, saveSoon, inTown, townId, stat } from "./state.js";
import { PM } from "./permits.js";
import { CONTACT_EXTRAS } from "./pay.js";

if (!S.story || typeof S.story !== "object") S.story = {};
if (!S.storyPaid || typeof S.storyPaid !== "object") S.storyPaid = { day: "", n: 0 };
const pick = a => a[Math.floor(Math.random() * a.length)];
export const ST = { crew: null, force: {}, log: [] };
function log(ev, d = {}) { ST.log.push(Object.assign({ ev }, d)); if (ST.log.length > 40) ST.log.shift(); }
const realDay = () => { const d = ST.force.day || new Date(); return typeof d === "string" ? d : `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
/** This town's story state: { step 0 none · 1 noticed · 2 evidence · 3 over, how: "" | "paper" | "ia" | "hush", cut, expedited } */
export const story = (town = townId()) => S.story[town] || (S.story[town] = { step: 0, how: "", cut: false, expedited: 0 });
const solo = () => !(ctx.party && ctx.party.active);
const onFoot = () => !!(ctx.foot && ctx.foot.active && ctx.state === "footRun");
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || null;
function remember(what) { try { if (ctx.memory && ctx.memory.remember) ctx.memory.remember("cityhall", { did: what, town: townId() }); } catch (e) { /* none */ } }

/** Pay a story reward: once per town per kind, within the day cap. → coins paid */
export function payStory(town, kind, want) {
    const s = story(town);
    s.paid = s.paid || {};
    if (s.paid[kind]) return 0;
    const d = realDay();
    if (S.storyPaid.day !== d) { S.storyPaid.day = d; S.storyPaid.n = 0; }
    const n = Math.max(0, Math.min(want, PAY.dayCap - S.storyPaid.n));
    s.paid[kind] = true;
    if (n > 0) { S.storyPaid.n += n; addCoins(n, "cityhall:" + kind); }
    saveSoon();
    log("pay", { kind, n });
    return n;
}

// ── 1 + 2: in the lobby — the expediter on the bench, the paving notice on the board, the mayor's first line ──
LOBBY_BUILDERS.push((rt, B, I) => {
    const s = story(I.town), SD = STORY[I.town] || STORY.lakewood;
    // the expediter: on a folding chair by the windows' doorway (shady, but polite)
    const x = I.LB + 2.6, z = -1.5;
    B.box(0.45, 0.06, 0.45, "#455A64", x, 0.45, z); B.box(0.45, 0.45, 0.05, "#455A64", x, 0.68, z - 0.22);
    B.col("expChair", x - 0.25, x + 0.25, z - 0.27, z + 0.25);
    try { rt.person("expediter", "npcMan", { x, z: z + 0.02, ry: 0.6 }, { name: SL.expediter.name, colors: { Top: "#3E2723", Bottom: "#212121", Hair: "#212121" }, pose: { sit: true }, y: 0.05, faceLulu: false, collide: false }); } catch (e) { /* model */ }
    rt.hot({ id: "expediter", x: x - 0.1, z: z + 0.75, who: "expediter", r: 0.7, label: `${SL.expediter.emoji} ${SL.expediter.name}`, action: r => expediter(r, I.town) });
    // the notice board: once she's seen it, the paving notice is the first thing she reads
    const board = rt.hots.find(h => h.id === "board");
    if (board) board.action = async r => {
        if (s.step === 0 || Math.random() < 0.5) {
            await r.say("The notice board", SL.board(SD), { emoji: "📌", color: "#6D4C41" });
            if (s.step === 0 && !r.disposed) { s.step = 1; saveSoon(); emit("cityhall:story", { town: I.town, step: 1 }); log("noticed", { town: I.town }); await r.say("Lulu", SL.boardLulu, { emoji: "🤨" }); }
            return;
        }
        await r.say("The notice board", pick(BOARD[I.town] || BOARD.lakewood), { emoji: "📌", color: "#6D4C41" });
    };
});
MAYOR_LINES.push(town => { const s = story(town); return s.step === 3 && SL.after[s.how === "hush" ? "partner" : "exposed"] ? SL.after[s.how === "hush" ? "partner" : "exposed"][town] : null; });
async function expediter(rt, town) {
    const SD = STORY[town] || STORY.lakewood, who = rt.byId.expediter, o = { emoji: SL.expediter.emoji, person: who, color: "#3E2723" };
    const p = PM.open.find(x => x.step < 2);
    await rt.say(SL.expediter.name, SL.expHello, o);
    if (rt.disposed) return;
    if (!p) { await rt.say(SL.expediter.name, SL.expNone, o); return; }
    const i = await rt.choose(SL.expediter.name, SL.expOffer(PAY.expedite), SL.expOpts(PAY.expedite), o);
    if (rt.disposed) return;
    if (i === 0) {
        if (!wallet.spend(PAY.expedite)) { await rt.say(SL.expediter.name, "No coins? Then the line is your friend. Enjoy the line.", o); return; }
        p.step = 2; saveSoon();                       // (the stamp's done: Permits hands it over — the next visit to the window grants it)
        const s = story(town); s.expedited = (s.expedited || 0) + 1; saveSoon();
        emit("cityhall:corrupt", { who: "expediter", act: "expedite", n: PAY.expedite });
        stat("cityhallExpedited");
        await rt.say(SL.expediter.name, SL.expDone, o);
    } else if (i === 2) await rt.say(SL.expediter.name, SL.expWho(SD), o);
}

// ── 3: the crew in front of city hall ──
let bakedMat = null;
function bake(parts) {
    const geos = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), c = new THREE.Color();
    for (const b of parts) {
        const g = b.cyl ? new THREE.CylinderGeometry(b.w / 2, b.w / 2, b.h, 12) : new THREE.BoxGeometry(b.w, b.h, b.d);
        e.set(b.rx || 0, b.ry || 0, b.rz || 0); q.setFromEuler(e); p.set(b.x || 0, b.y || 0, b.z || 0);
        g.applyMatrix4(m.compose(p, q, sc));
        c.set(b.color);
        const n = g.attributes.position.count, col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        g.setAttribute("color", new THREE.BufferAttribute(col, 3));
        geos.push(g.index ? g.toNonIndexed() : g);
    }
    const geo = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!bakedMat) bakedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    return new THREE.Mesh(geo, bakedMat);
}
/** Put the crew in front of this town's city hall (tests: force). → bool */
export function crewStart() {
    if (ST.crew || !inTown()) return false;
    const sp = ctx.town.spot && ctx.town.spot("cityhall");
    if (!sp || sp.nx == null) return false;
    const town = townId(), SD = STORY[town] || STORY.lakewood;
    // on the sidewalk edge, 9 m along from the door; the machine at the kerb
    const x = sp.x + sp.ux * 9 + sp.nx * 1.8, z = sp.z + sp.uz * 9 + sp.nz * 1.8;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(sp.ux, sp.uz) - Math.PI / 2;
    const lz = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y);
    if (lz.x * sp.nx + lz.z * sp.nz < 0) g.rotation.y += Math.PI;
    // (local: +x along the sidewalk, +z toward the street)
    g.add(bake([
        { w: 3.6, h: 0.02, d: 1.4, x: 0, y: 0.015, z: 0.3, color: "#2B2B2B" },                       // a patch of fresh asphalt (on smooth asphalt)
        { w: 1.2, h: 0.5, d: 0.1, x: -2.4, y: 0.6, z: 0.3, color: "#FF6F00" }, { w: 1.2, h: 0.12, d: 0.12, x: -2.4, y: 0.62, z: 0.36, color: "#FFFFFF" },
        { w: 0.08, h: 0.6, d: 0.3, x: -2.95, y: 0.3, z: 0.3, color: "#FF6F00" }, { w: 0.08, h: 0.6, d: 0.3, x: -1.85, y: 0.3, z: 0.3, color: "#FF6F00" },
        { cyl: true, w: 0.3, h: 0.5, x: 2.4, y: 0.25, z: 0.0, color: "#FF6F00" }, { cyl: true, w: 0.3, h: 0.5, x: 2.4, y: 0.25, z: 0.9, color: "#FF6F00" },
        // the little steamroller (yellow), its drum along the street
        { w: 1.3, h: 0.9, d: 1.0, x: 0.8, y: 0.85, z: 0.3, color: "#FBC02D" }, { w: 0.8, h: 0.6, d: 0.9, x: 0.9, y: 1.6, z: 0.3, color: "#F9A825" },
        { cyl: true, w: 0.9, h: 1.2, x: -0.2, y: 0.45, z: 0.3, rx: Math.PI / 2, color: "#616161" }, { cyl: true, w: 0.7, h: 0.3, x: 1.4, y: 0.35, z: -0.3, rx: Math.PI / 2, color: "#212121" },
        { cyl: true, w: 0.7, h: 0.3, x: 1.4, y: 0.35, z: 0.9, rx: Math.PI / 2, color: "#212121" },
    ]));
    // the firm's name on the steamroller (a small canvas)
    const c = document.createElement("canvas"); c.width = 256; c.height = 64; const gx = c.getContext("2d");
    gx.fillStyle = "#FBC02D"; gx.fillRect(0, 0, 256, 64); gx.fillStyle = "#212121"; gx.font = "700 26px Fredoka, Arial, sans-serif"; gx.textAlign = "center"; gx.textBaseline = "middle"; gx.fillText(SD.firm, 128, 32, 246);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.31), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    lab.position.set(0.8, 0.9, 0.81); g.add(lab);
    ctx.scene.add(g);
    const C = ST.crew = { town, x, z, g, tex, people: [], t: 0, sayT: 1.5, line: 0, rm: null, busy: false };
    ensureModels(["npcMan"]).then(() => {
        if (ST.crew !== C || !models.npcMan) return;
        for (const [lx, lz, col] of [[-1.0, -0.6, "#FF6F00"], [1.9, -0.5, "#FF6F00"], [-0.6, 1.1, "#5D4037"]]) {
            const p = spawnPerson("npcMan", { colors: { Top: col, Bottom: "#37474F", Hair: "#3E2723" } });
            const w = g.localToWorld(new THREE.Vector3(lx, 0, lz)); p.obj.position.set(w.x, 0, w.z);
            ctx.scene.add(p.obj); C.people.push(p);
        }
    }).catch(() => {});
    if (ctx.foot && ctx.foot.addSpot) C.rm = ctx.foot.addSpot(crewSpot);
    log("crew", { town });
    return true;
}
const crewSpot = {
    r: 3.0, short: "CREW",
    pos() { const C = ST.crew; return C && onFoot() && !C.busy ? { x: C.x, z: C.z } : null; },
    label() { const C = ST.crew; return C ? SL.crewSpot(STORY[C.town] || STORY.lakewood) : null; },
    act() { crewTalk(); },
};
async function crewTalk() {
    const C = ST.crew;
    if (!C || ctx.dialogOpen) return;
    const SD = STORY[C.town] || STORY.lakewood, s = story(C.town), o = { emoji: "🚧", color: "#E65100" };
    C.busy = true;
    const i = await choose(SD.boss, pick(SL.crewLines(SD)), SL.crewOpts, o);
    C.busy = false;
    if (ST.crew !== C) return;
    if (i === 0) {
        if (s.step < 2) { s.step = 2; saveSoon(); emit("cityhall:story", { town: C.town, step: 2 }); stat("cityhallEvidence"); remember("photo"); }
        log("snap", { town: C.town });
        await say("Lulu", SL.snapped, { emoji: "📸" });
    } else if (i === 1) {
        if (s.cut || S.storyPaid.day === realDay() && S.storyPaid.n >= PAY.dayCap) { await say(SD.boss, SL.capped, o); return; }
        s.cut = true; saveSoon();
        emit("cityhall:corrupt", { who: "paving", act: "cut" });
        const stung = ST.force.sting != null ? !!ST.force.sting : Math.random() < PAY.sting;
        if (stung) {
            log("sting", { town: C.town });
            await say("Internal Affairs", SL.sting, { emoji: "🕵️", color: "#1A237E" });
            try { if (ctx.law && ctx.law.arrest) ctx.law.arrest(["BRIBING A PUBLIC SERVANT (MINOR)"]); } catch (e) { /* no law */ }
            return;
        }
        const n = payStory(C.town, "cut", PAY.cut);
        if (n) H.toast(`+${n} 💰`, "gold", { prio: 3, key: "cityhall:pay" });
        await say("Lulu", SL.cut(SD), { emoji: "🚧" });
    }
}
export function crewStop() {
    const C = ST.crew;
    if (!C) return;
    ST.crew = null;
    if (C.rm) C.rm();
    for (const p of C.people) if (p.obj.parent) p.obj.parent.remove(p.obj);
    if (C.g.parent) C.g.parent.remove(C.g);
    C.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== bakedMat) o.material.dispose(); } });
    C.tex.dispose();
}
/** ~every frame from index.js. */
export function storyTick(dt) {
    const want = inTown() && ctx.enabled(ID) && solo() && story().step >= 1 && story().step < 3 && ctx.state !== "interior";
    if (!want) { if (ST.crew && (!inTown() || story(ST.crew.town).step >= 3 || !solo())) crewStop(); return; }
    if (!ST.crew) { crewStart(); return; }
    const C = ST.crew;
    if (ctx.state !== "footRun" || ctx.paused) return;
    C.t += dt;
    C.people.forEach((p, k) => p.update(dt, { walk: 0, point: k === 2 && C.t % 6 > 4, talk: k === 2 && C.t % 6 < 2 }));
    const lp = herPos();
    if (lp && Math.hypot(lp.x - C.x, lp.z - C.z) < 24 && (C.sayT -= dt) <= 0 && C.people[2]) {
        C.sayT = 9;
        try { if (ctx.foot && ctx.foot.say && H.bubbleOk && H.bubbleOk(2.4)) ctx.foot.say(C.people[2].obj, SL.crewLines(STORY[C.town] || STORY.lakewood)[C.line++ % 3], 2.6); } catch (e) { /* none */ }
    }
}

// ── 4: the photo, from 📞 Phone › City Hall ──
/** HTML for the contact (pay.js shows it under the bills) — the photo's choices for each town with one. */
export function storyHtml() {
    const out = [];
    for (const town of Object.keys(STORY)) {
        const s = story(town);
        if (s.step !== 2) continue;
        const SD = STORY[town];
        out.push(`<div class="lp-note">${SL.phoneHave(SD)}</div>` + SL.phoneOpts(SD).map((l, i) => `<button class="btn lp-row" data-story="${town}:${i}"><span class="lp-tx"><b>${l}</b></span></button>`).join(""));
    }
    return out.join("");
}
/** Use the photo: 0 the paper · 1 Internal Affairs · 2 sell it back. → coins paid */
export function usePhoto(town, how) {
    const s = story(town), SD = STORY[town];
    if (!SD || s.step !== 2) return 0;
    const kind = ["paper", "ia", "hush"][how];
    if (!kind) return 0;
    s.step = 3; s.how = kind; saveSoon();
    const n = payStory(town, "photo", PAY[kind]);
    const msg = SL[kind](SD);
    try { if (ctx.phone && ctx.phone.text) ctx.phone.text({ from: kind === "paper" ? SD.paper : kind === "ia" ? "Internal Affairs" : SD.boss, emoji: kind === "paper" ? "📰" : kind === "ia" ? "🕵️" : "🚧", color: TL.color, msg, thread: "City Hall", dur: 5 }); } catch (e) { /* no phone */ }
    if (n) H.toast(`+${n} 💰`, "gold", { prio: 3, key: "cityhall:pay" });
    emit("cityhall:story", { town, step: 3, how: kind });
    emit("cityhall:corrupt", { who: "paving", act: kind === "hush" ? "hush" : "exposed" });
    stat(kind === "hush" ? "cityhallHush" : "cityhallExposed");
    remember(kind);
    if (ST.crew && ST.crew.town === town) crewStop();
    log("photo", { town, kind, n });
    return n;
}
CONTACT_EXTRAS.push({
    html: storyHtml,
    bind(el, rerender) { el.querySelectorAll("[data-story]").forEach(b => b.addEventListener("click", () => { const [town, i] = b.dataset.story.split(":"); usePhoto(town, +i); rerender(); })); },
});
on("town:leave", () => crewStop());
on("title", () => crewStop());
