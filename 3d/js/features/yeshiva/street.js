// features/yeshiva/street.js — the yeshiva's street life in Lakewood (roadmap 45): L.S.D. (Lakewood Staring Disorder), Mrs. Weiss's
// forgotten lunch, and the OTD guys who hang out in certain places at certain hours.
//
//  L.S.D.: the nearest few TOWNSPEOPLE (the town's own people — never the instanced crowd) turn to follow her a beat too long;
//    harder for a new car or a lampshade on her head; four at once earns the scrapbook badge; ✋ STARE BACK is a staring contest
//    she wins by standing still. Never hostile.
//  Mrs. Weiss (daytime, some days, until her lunch is delivered): hands Lulu Yossi's lunch for row nine (room.js › sleepAction
//    emits "yeshiva:lunch" — Ima's list picks it up when it's on today's list; no coins from here).
//  OTD guys (Sammy by the lake, Yitzy at the back of the campus lot, Mo on his stool): dusk / night, some evenings — funny, warm,
//    sharp, they know everyone in the yeshiva by name and ask how So-and-so is doing. No cautionary tale, no contempt.
import { ctx, on, emit, addActor, hook } from "../../core/ctx.js";
import { shared, saveSoon } from "../../core/save.js";
import { spawnPerson } from "../../core/people.js";
import { say } from "../../core/dialog.js";
import { LIFE } from "../town/life.js";
import { SAVE, force } from "./room.js";
import { STARE, OTD, MOM, PASS } from "./data.js";

const lakewood = () => !!(ctx.town && ctx.town.active && ctx.town.id === "lakewood");
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos);
const night = () => (force.night != null ? force.night : (ctx.atmos && typeof ctx.atmos.night === "number" ? ctx.atmos.night : 0));
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 100003; return h; };
const chance = (id, p) => force.always ? true : (hash(dayKey() + id) % 100) / 100 < p;     // (a stable "sometimes" for the real day)

export const ST = { n: 0, peak: 0, list: [], npcs: [], lastLine: 0, contest: null, wins: 0, badge: false };

// ── L.S.D. ───────────────────────────────────────────────────────────────
function radius() {
    let r = 22;
    const skin = (shared.get().selectedSkin || "pink");
    if (!(ctx.foot && ctx.foot.active) && skin !== "pink") r += 14;               // a new car
    if (ctx.houseitems && ctx.houseitems.debug && ctx.houseitems.debug.worn && ctx.houseitems.debug.worn()) r += 12;   // a lampshade on her head
    return r;
}
function staring(dt) {
    if (!lakewood() || !LIFE.on) { ST.n = 0; return; }
    const p = herPos();
    if (!p) return;
    const R = radius();
    let n = 0;
    for (const r of LIFE.people) {
        const o = r.p.obj;
        if (!o.visible || r.stareSkip) continue;
        const d = Math.hypot(p.x - o.position.x, p.z - o.position.z);
        if (r.y0 == null) r.y0 = o.rotation.y;
        const want = d < R ? Math.atan2(p.x - o.position.x, p.z - o.position.z) : r.y0;
        let dy = want - o.rotation.y; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
        o.rotation.y += dy * Math.min(1, dt * (d < R ? 3.2 : 1.2));
        if (d < R && Math.abs(dy) < 0.6) { n++; r.starer = true; } else r.starer = false;
    }
    ST.n = n; ST.peak = Math.max(ST.peak, n);
    if (n >= 4 && !ST.badge) { ST.badge = true; emit("stat", { id: "lsdPeak", n: 1 }); }
    // Lulu notices (rarely; her own chatter setting rations it — a bubble, never a toast)
    if (n >= 2 && ctx.time - ST.lastLine > 75 && ctx.foot && ctx.foot.active && ctx.foot.say && ctx.foot.obj && !ctx.dialogOpen) {
        ST.lastLine = ctx.time;
        const pool = (ctx.houseitems && ctx.houseitems.debug && ctx.houseitems.debug.worn && ctx.houseitems.debug.worn()) ? STARE.lampshade : r_pool(p);
        ctx.foot.say(ctx.foot.obj, pool[Math.floor(Math.random() * pool.length)], 3.0);
        emit("stat", { id: "lsdStares", n: 1 });
    }
}
const r_pool = p => (shared.get().selectedSkin || "pink") !== "pink" && !(ctx.foot && ctx.foot.active) ? STARE.car : STARE.lulu;
function nearestStarer() {
    const p = herPos(); let best = null, bd = 3.4;
    for (const r of LIFE.people) { if (!r.starer) continue; const d = Math.hypot(p.x - r.p.obj.position.x, p.z - r.p.obj.position.z); if (d < bd) { bd = d; best = r; } }
    return best;
}
/** ✋ STARE BACK: stand still for a few seconds and she wins (she never loses for real — a blink is just "try again"). */
async function contest() {
    const r = nearestStarer(); if (!r || ST.contest) return;
    const o = ctx.foot.obj, p0 = herPos(); const x0 = p0.x, z0 = p0.z;
    ST.contest = true;
    ctx.foot.say(o, STARE.contest.start[Math.floor(Math.random() * 2)], 1.8);
    let t = 0, ok = true;
    await new Promise(res => { const a = addActor({ foot: true, update: dt => { t += dt; const p = herPos(); if (Math.hypot(p.x - x0, p.z - z0) > 1.4 || ctx.dialogOpen) { ok = false; } if (!ok || t > 3.2) { res(); return false; } return true; } }); });
    ST.contest = false;
    if (ok) { ST.wins++; ctx.foot.say(r.p.obj, STARE.contest.win[Math.floor(Math.random() * 2)].split("(")[0].trim(), 3.0); r.stareSkip = true; r.p.obj.rotation.y = r.y0 != null ? r.y0 : r.p.obj.rotation.y; setTimeout(() => { r.stareSkip = false; }, 25000); emit("stat", { id: "lsdWins", n: 1 }); }
    else ctx.foot.say(o, STARE.contest.lose.replace(/[()]/g, ""), 2.4);
}

// ── NPCs outside (Mrs. Weiss + the OTD guys) ─────────────────────────────
function spawn(id, key, colors, x, z, ry, info) {
    if (ST.npcs.some(n => n.id === id)) return;
    const p = spawnPerson(key, { colors });
    p.obj.position.set(x, 0, z); p.obj.rotation.y = ry;
    p.obj.traverse(o => { if (o.isMesh) o.castShadow = false; });
    ctx.scene.add(p.obj);
    ST.npcs.push(Object.assign({ id, p, x, z, ry, k: 0, t: Math.random() * 5 }, info));
}
function clearNpcs() { for (const n of ST.npcs) if (n.p.obj.parent) n.p.obj.parent.remove(n.p.obj); ST.npcs.length = 0; }
const at = (name, u, n) => { const sp = ctx.town.spot(name); return sp ? { x: sp.x + sp.ux * u + sp.nx * n, z: sp.z + sp.uz * u + sp.nz * n, ry: Math.atan2(sp.nx, sp.nz) + Math.PI, sp } : null; };
function wanted() {
    const out = [], nt = night();
    if (!lakewood()) return out;
    if (nt < 0.35 && !SAVE.lunch && SAVE.lunchDay !== dayKey() && chance("weiss", 0.6)) out.push("weiss");
    if (nt > 0.35 && chance("sammy", 0.55)) out.push("sammy");
    if (nt > 0.55 && chance("yitzy", 0.5)) out.push("yitzy");
    if (nt > 0.2 && chance("mo", 0.5)) out.push("mo");
    return out;
}
let scanT = 99;
function scan(dt) {
    if (!lakewood()) { if (ST.npcs.length) clearNpcs(); return; }
    scanT += dt;
    if (scanT < 3) return; scanT = 0;
    const want = wanted();
    for (const n of ST.npcs.slice()) if (!want.includes(n.id)) { if (n.p.obj.parent) n.p.obj.parent.remove(n.p.obj); ST.npcs.splice(ST.npcs.indexOf(n), 1); }
    for (const id of want) {
        if (id === "weiss") { const a = at("campus", -6.5, 0.4); if (a) spawn("weiss", "npcWoman", { Top: "#7B4A8A", Bottom: "#4A2F5A", Hair: "#2B2B2B" }, a.x, a.z, a.ry, { name: "Mrs. Weiss", label: "🥪 MRS. WEISS (a lunch)", kind: "mom" }); }
        else {
            const o = OTD[id], a = o.where === "campusLot" ? at("campusLot", 3.2, 0.6) : o.where === "lake" ? at("lake", 2.5, 1.2) : at("chair", 1.6, 1.4);
            if (a) spawn(id, "npcMan", { Top: "#4A5568", Bottom: "#2B3A55", Kippah: "#3B2A22", Shoes: "#222222" }, a.x, a.z, a.ry, { name: o.name, label: `${o.icon} ${o.name.toUpperCase()}`, kind: "otd", lines: o.lines });
        }
    }
}
function nearNpc() {
    const p = herPos(); if (!p || !ST.npcs.length) return null;
    let best = null, bd = 2.8;
    for (const n of ST.npcs) { const d = Math.hypot(p.x - n.x, p.z - n.z); if (d < bd) { bd = d; best = n; } }
    return best;
}
async function talk(n) {
    n.p.obj.rotation.y = Math.atan2(herPos().x - n.x, herPos().z - n.z);
    if (n.kind === "mom") {
        if (SAVE.lunch) return say(n.name, MOM.have, { emoji: "🥪" });
        await say(n.name, MOM.offer[Math.floor(Math.random() * MOM.offer.length)], { emoji: "🥪" });
        SAVE.lunch = "yossi"; SAVE.lunchDay = dayKey(); saveSoon();           // (she hands it over: Yossi, row nine)
        emit("stat", { id: "yeshivaLunchTaken", n: 1 });
        const i = ST.npcs.indexOf(n); if (i >= 0) { n.p.obj.parent && n.p.obj.parent.remove(n.p.obj); ST.npcs.splice(i, 1); }
        if (ctx.foot && ctx.foot.say && ctx.foot.obj) ctx.foot.say(ctx.foot.obj, MOM.bag, 3.0);
        return;
    }
    const line = n.lines[n.k++ % n.lines.length];
    await say(n.name, line, { emoji: "🧢" });
}

on("boot", () => {
    if (ctx.foot && ctx.foot.addSpot) {
        ctx.foot.addSpot({ pos: () => { const n = nearNpc(); return n ? { x: n.x, z: n.z } : null; }, r: 2.4, label: () => { const n = nearNpc(); return n ? n.label : null; }, short: "TALK", act: () => { const n = nearNpc(); if (n) talk(n); } });
        ctx.foot.addSpot({ pos: () => { const r = ST.contest ? null : nearStarerSafe(); return r ? { x: r.p.obj.position.x, z: r.p.obj.position.z } : null; }, r: 3.4, label: () => STARE.contest.offer, short: "STARE", act: () => contest() });
    }
    if (ctx.meta && ctx.meta.addBadge) ctx.meta.addBadge({ id: "lsd", icon: "👀", name: STARE.badge.name, desc: STARE.badge.desc, test: S => ((S.stats && S.stats.lsdPeak) || 0) >= 1 });
    // Ima's list: the forgotten lunch (an errand — when today's list has it, delivering Yossi's lunch ticks it; the list pays its own small, capped reward)
    if (ctx.day && ctx.day.addItem) ctx.day.addItem("errand", { id: "yeshivaLunch", icon: "🥪", text: "Take Yossi's forgotten lunch to the big yeshiva (row nine)", kind: "event", ev: "yeshiva:lunch" });
});
const nearStarerSafe = () => (lakewood() && LIFE.on && herPos() ? nearestStarer() : null);
// (one actor, driving AND on foot; a run start clears the actor list, so it's re-added — the community / crime pattern)
let actor = null;
function ensureActor() {
    if (actor && ctx.actors.includes(actor)) return;
    actor = addActor({ foot: true, update: dt => { try { staring(dt); scan(dt); } catch (e) { console.error("[yeshiva] street", e); } return true; } });
}
hook("runStart", () => { actor = null; ensureActor(); }, 5);
hook("update", () => { if (!actor || !ctx.actors.includes(actor)) ensureActor(); });
on("boot", () => ensureActor());
on("town:leave", () => { clearNpcs(); ST.n = 0; for (const r of LIFE.people) { r.y0 = null; r.starer = false; } scanT = 99; });
on("town:enter", () => { scanT = 99; });
export { PASS, talk, contest, nearNpc, wanted, scan };
