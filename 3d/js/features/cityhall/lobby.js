// features/cityhall/lobby.js — 🏛️ INSIDE CITY HALL (the interiors engine, built from homes' kit + boxes, only when she
// walks in). Three dollhouse rooms, left → right:
//   the MAYOR'S OFFICE  his desk between two flags, a portrait of himself (painted by himself), the giant ceremonial
//                       scissors on the wall — and the mayor, unless he's out cutting a ribbon (ribbon.js)
//   the LOBBY           the front door, the take-a-number machine (NOW SERVING: 37, forever), two benches of people who
//                       have been waiting since Chanukah, the notice board, a poster of the mayor, his secretary's desk
//   the WINDOWS         PERMITS · TAXES · COMPLAINTS — one of them is always "BACK IN 5 MINUTES" (which one: the hour)
// Stage 1: lines only — nothing here pays or costs. Later stages hang the Taxes / Permits windows' real business on
// `WIN_HOOKS` (see index.js).
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { defineInterior, pick, pool } from "../interiors/engine.js";
import { rooms, signTexture, D } from "./rooms.js";
import { TOWNS, MAYOR, TICKET, WINDOWS, CLOSED, CLERKS, COMPLAINTS, BOARD, WAITING, SECRETARY, OUT_CUTTING } from "./data.js";
import { S, saveSoon, force, townId, mayorIn, closedWindow, stat } from "./state.js";

/** Other modules (stages 2–3) add what a window can DO: addWindowHook(id, async (rt, who, clerkName) → true when handled,
 *  prio) — higher prio is asked first; the first that handles it wins, else the clerk's small talk. */
export const WIN_HOOKS = {};
export function addWindowHook(id, fn, prio = 0) {
    const l = WIN_HOOKS[id] || (WIN_HOOKS[id] = []);
    l.push({ fn, prio }); l.sort((a, b) => b.prio - a.prio);
}
/** A window's label override (e.g. "🖃 Get your form stamped"): WIN_LABELS[id] = () → string | null */
export const WIN_LABELS = {};
/** More of the room from later stages: LOBBY_BUILDERS.push((rt, B, info) => …) — called at the end of build, before the
 *  boxes are baked (info: { town, LB, MO, WN, bz }). MAYOR_LINES.push(town → a line | null): what he says first. */
export const LOBBY_BUILDERS = [];
export const MAYOR_LINES = [];

const secLine = pool(SECRETARY), closedLine = pool(CLOSED);
const clerkPools = {}; for (const w of WINDOWS) clerkPools[w.id] = pool(CLERKS[w.id]);
const CLERK_LOOKS = {
    permits: { name: "Mr. Stempler", key: "npcMan", colors: { Top: "#6D4C41", Bottom: "#37474F", Hair: "#9E9E9E" }, emoji: "📝" },
    taxes: { name: "Mrs. Penny Katz", key: "npcWoman", colors: { Top: "#2E7D32", Bottom: "#263238", Hair: "#3E2723" }, emoji: "💰" },
    complaints: { name: "Mr. Kvetchinsky", key: "npcMan", colors: { Top: "#546E7A", Bottom: "#212121", Hair: "#212121" }, emoji: "📣" },
};

export const LOBBY_DEF = defineInterior({
    id: "cityhall", name: "city hall", short: "city hall", emoji: "🏛️",
    title: "🏛️ CITY HALL", tagline: "Please take a number",
    model: "homesKit", models: ["npcWoman", "npcMan"], music: "../story-relax.mp3",
    light: "indoor", cam: { dist: 7.4, height: 5.4, lookY: 0.8, clampX: 6.6 }, walkSpeed: 3.6,
    build, tick,
});
/** Dress the room for the town she's in (the title chip). */
export function nameLobby(town) {
    const T = TOWNS[town] || TOWNS.lakewood;
    LOBBY_DEF.name = T.name; LOBBY_DEF.short = T.short; LOBBY_DEF.title = T.title; LOBBY_DEF.tagline = T.tagline;
    if (ctx.interiors.cityhall) ctx.interiors.cityhall.name = T.name;
}

function build(rt) {
    const town = townId(), T = TOWNS[town] || TOWNS.lakewood, MY = MAYOR[town] || MAYOR.lakewood;
    const V = rt.data.V = { town, display: null, ding: 20 + Math.random() * 15, dingT: 0, closed: closedWindow(), mayor: mayorIn() };
    rt.root.visible = false;
    const B = rooms(rt, 3, { floors: ["#8D6E63", "#D7CCC8", "#BCAAA4"], walls: ["#E8E0CF", "#EDE6D6", "#E3DAC7"], door: 1, doorDx: 0 });
    const [MO, LB, WN] = B.cx, bz = -D / 2;
    const accent = T.tints.Accent;

    // ── the mayor's office ──
    B.put("Desk", MO, -1.35, 0, 1.6, 0.8);
    B.put("Chair", MO, -2.1, 0);
    B.put("Chair", MO - 0.5, -0.45, Math.PI); B.put("Chair", MO + 0.5, -0.45, Math.PI);
    B.put("Bookcase", MO - 2.4, bz + 0.3, 0, 1.0, 0.45);
    B.put("Couch", MO - 2.3, 1.4, Math.PI / 2, 2.0, 0.9);
    B.put("Plant", MO + 2.6, bz + 0.45, 0, 0.4, 0.4);
    B.put("Rug", MO, -0.4, 0);
    for (const [fx, fc] of [[-1.25, "#C62828"], [1.25, "#1565C0"]]) {
        B.box(0.05, 2.2, 0.05, "#B0B6BC", MO + fx, 1.1, bz + 0.35);
        B.box(0.02, 0.55, 0.8, fc, MO + fx, 1.9, bz + 0.78);
    }
    B.col("flags", MO - 1.4, MO + 1.4, bz, bz + 0.5);
    B.sign([T.mayor.short.toUpperCase(), "painted by himself"], MO, 1.85, bz + 0.02, 1.3, 0.9, { bg: "#5D4037", fg: ["#FFE082", "#FFFFFF"], font: 54, border: "#C9A646" });
    // the giant ceremonial scissors (on the wall, right of the desk)
    const gold = "#D4AF37";
    { const a = B.box(0.12, 1.3, 0.04, gold, MO + 2.15, 1.7, bz + 0.03); a.rotation.z = 0.35; const b = B.box(0.12, 1.3, 0.04, gold, MO + 2.15, 1.7, bz + 0.04); b.rotation.z = -0.35;
        B.box(0.36, 0.36, 0.03, "#C62828", MO + 1.95, 1.18, bz + 0.05); B.box(0.36, 0.36, 0.03, "#C62828", MO + 2.35, 1.18, bz + 0.05); }
    // a jar on the desk (Midwood: pickles, for voters; Lakewood: pens with his name on them)
    B.box(0.18, 0.24, 0.18, town === "midwood" ? "#7CB342" : "#90CAF9", MO + 0.55, 0.92, -1.3);

    // ── the lobby ──
    // the take-a-number machine (right of the door) + the NOW SERVING display on the back wall
    const tx = LB + 1.9, tz = 1.75;
    B.box(0.08, 1.0, 0.08, "#9E9E9E", tx, 0.5, tz); B.box(0.36, 0.42, 0.28, "#C62828", tx, 1.2, tz);
    B.box(0.2, 0.05, 0.05, "#FFFFFF", tx, 1.15, tz + 0.15);
    B.col("ticket", tx - 0.25, tx + 0.25, tz - 0.2, tz + 0.2);
    V.tex37 = rt.own(signTexture(["NOW SERVING", String(TICKET.nowServing)], 1.4, 0.7, { bg: "#1B1B1B", fg: ["#FF5252", "#FF1744"], font: 60, sizes: [0.7, 1.9] }));
    V.tex38 = rt.own(signTexture(["NOW SERVING", String(TICKET.nowServing + 1)], 1.4, 0.7, { bg: "#1B1B1B", fg: ["#FF5252", "#FF1744"], font: 60, sizes: [0.7, 1.9] }));
    V.display = B.sign(["NOW SERVING", String(TICKET.nowServing)], LB + 2.2, 2.25, bz + 0.02, 1.4, 0.7, { bg: "#1B1B1B", fg: ["#FF5252", "#FF1744"] });
    V.display.material.map = V.tex37;
    // the notice board + the mayor's poster
    B.box(1.5, 1.0, 0.04, "#A1887F", LB + 0.4, 1.55, bz + 0.03);
    for (let k = 0; k < 5; k++) B.box(0.34, 0.26, 0.02, ["#FFF59D", "#FFFFFF", "#B3E5FC", "#F8BBD0", "#C8E6C9"][k], LB - 0.1 + (k % 3) * 0.5, 1.75 - Math.floor(k / 3) * 0.42, bz + 0.06);
    B.sign(MY.poster, LB - 0.85, 1.7, bz + 0.03, 0.9, 1.15, { bg: accent, fg: ["#FFE082", "#FFFFFF", "#FFE082"], font: 70 });
    // two benches (backs to the door: they face the NOW SERVING sign) + the people waiting
    for (const bx of [-1.35, 1.2]) {
        B.box(1.6, 0.1, 0.45, "#6D4C41", LB + bx, 0.45, 0.35); B.box(1.6, 0.5, 0.08, "#6D4C41", LB + bx, 0.75, 0.6);
        B.box(0.06, 0.4, 0.4, "#5D4037", LB + bx - 0.75, 0.2, 0.35); B.box(0.06, 0.4, 0.4, "#5D4037", LB + bx + 0.75, 0.2, 0.35);
        B.col("bench" + bx, LB + bx - 0.82, LB + bx + 0.82, 0.1, 0.68);
    }
    const waiting = WAITING.slice().sort(() => Math.random() - 0.5).slice(0, 2);
    V.waiting = waiting;
    waiting.forEach((w, i) => {
        const x = LB + (i ? 1.35 : -1.7);
        try { rt.person("wait" + i, i ? "npcWoman" : "npcMan", { x, z: 0.32, ry: Math.PI }, { name: w.name, colors: w.colors, pose: { sit: true }, y: 0.05, faceLulu: false, collide: false }); } catch (e) { /* model */ }
    });
    // the secretary at her desk (back-left, beside the doorway into the mayor's office)
    B.put("Desk", LB - 1.95, -1.9, 0, 1.4, 0.7);
    try { rt.person("secretary", "npcWoman", { x: LB - 1.95, z: -2.45, ry: 0 }, { name: T.secretary.name, colors: T.secretary.colors, pose: {} }); } catch (e) { /* model */ }
    B.put("Plant", LB + 2.65, 2.2, 0, 0.4, 0.4);

    // ── the windows ──
    const wx = [WN - 2.0, WN, WN + 2.0], cz = -1.55;
    B.box(6.0, 1.05, 0.55, "#8D6E63", WN, 0.52, cz);                     // one long counter
    B.box(6.04, 0.06, 0.62, "#D7CCC8", WN, 1.07, cz);
    B.col("counter", WN - 3.1, WN + 3.1, cz - 0.3, cz + 0.3);      // (the counter spans the room: nobody gets behind it)
    for (let k = 0; k < 4; k++) B.box(0.08, 1.6, 0.55, "#5D4037", WN - 3.0 + k * 2.0, 1.85, cz);     // the dividers
    const glass = B.mat("#B3E5FC");
    WINDOWS.forEach((w, i) => {
        const x = wx[i], shut = V.closed === i;
        const g = B.box(1.9, 1.1, 0.03, glass, x, 1.65, cz + 0.05); g.material = rt.own(new THREE.MeshStandardMaterial({ color: "#B3E5FC", transparent: true, opacity: 0.35, roughness: 0.1 }));
        B.sign([`${w.emoji} ${w.label}`], x, 2.45, cz + 0.08, 1.8, 0.36, { bg: accent, fg: "#FFFFFF", font: 70 });
        if (shut) B.sign(["BACK IN", "5 MINUTES"], x, 1.45, cz + 0.08, 0.9, 0.55, { bg: "#FFF59D", fg: ["#C62828", "#3E2723"], font: 64, border: "#C62828" });
        else {
            const L = CLERK_LOOKS[w.id];
            try { rt.person("clerk_" + w.id, L.key, { x, z: bz + 0.55, ry: 0 }, { name: L.name, colors: L.colors, pose: {}, faceLulu: false, collide: false }); } catch (e) { /* model */ }
        }
        rt.hot({ id: "win_" + w.id, x, z: cz + 0.95, r: 0.95, who: shut ? null : "clerk_" + w.id,
            label: () => shut ? `🚪 ${w.label} — back in 5 minutes` : (WIN_LABELS[w.id] && WIN_LABELS[w.id]()) || `${w.emoji} ${w.label} window`,
            action: r => windowTalk(r, w, shut) });
    });

    // ── hotspots: the lobby + the office ──
    rt.hot({ id: "ticket", x: tx, z: tz + 0.6, r: 0.9, label: "🎫 Take a number", action: takeNumber });
    rt.hot({ id: "board", x: LB + 0.4, z: bz + 0.95, r: 0.9, label: "📌 The notice board", action: r => r.say("The notice board", pick(BOARD[town] || BOARD.lakewood), { emoji: "📌", color: "#6D4C41" }) });
    rt.hot({ id: "poster", x: LB - 0.75, z: bz + 1.05, r: 0.6, label: `🖼️ The poster`, action: r => r.say("Lulu", pick([`${T.mayor.short}'s face. Smiling. At everyone. All the time.`, "Someone drew a moustache on him. It's an improvement.", "The poster is bigger than the notice board. Priorities."]), { emoji: "🖼️" }) });
    waiting.forEach((w, i) => rt.hot({ id: "wait" + i, x: LB + (i ? 1.35 : -1.7), z: 1.15, who: "wait" + i, r: 0.75, label: `💬 ${w.name}`,
        action: r => r.say(w.name, w.line, { emoji: "⏳", person: r.byId["wait" + i], color: "#5D4037" }) }));
    rt.hot({ id: "secretary", x: LB - 1.95, z: -1.05, who: "secretary", r: 0.9, label: `💬 ${T.secretary.name}`,
        action: r => r.say(T.secretary.name, V.mayor ? secLine() : OUT_CUTTING, { emoji: "🗂️", person: r.byId.secretary, color: "#6A1B9A" }) });
    if (V.mayor) {
        try { rt.person("mayor", "npcMan", { x: MO, z: -2.1, ry: 0 }, { name: T.mayor.name, colors: T.mayor.colors, pose: {}, scale: 1.04 }); } catch (e) { /* model */ }
        rt.hot({ id: "mayor", x: MO, z: -0.5, who: "mayor", r: 1.1, label: `${T.mayor.emoji} Meet ${T.mayor.short}`, action: talkMayor });
    } else {
        rt.hot({ id: "mayor", x: MO, z: -0.5, r: 1.1, label: "🪑 The mayor's empty chair", action: r => r.say("Lulu", pick(["Empty. A note on the desk: 'OUT CUTTING. BACK SOON.' Behind it, his portrait smiles at nobody.", "His chair is still spinning. He left in a hurry. A ribbon emergency."]), { emoji: "🪑" }) });
    }
    rt.hot({ id: "scissors", x: MO + 2.15, z: bz + 0.95, r: 0.8, label: "✂️ The giant scissors", action: r => r.say("Lulu", pick(["Giant golden scissors. For ribbons. He's cut forty-one this year.", "A label: 'THE SCISSORS OF THE PEOPLE. DO NOT TOUCH. — the people'."]), { emoji: "✂️" }) });

    for (const f of LOBBY_BUILDERS) { try { f(rt, B, { town, LB, MO, WN, bz }); } catch (e) { console.error("[cityhall] builder", e); } }
    B.bake();       // (every plain box above → one mesh)
    // Lulu: in through the front door
    rt.lulu.obj.position.set(B.doorX, 0, D / 2 - 0.9);
    rt.lulu.obj.rotation.y = Math.PI;
    rt.wait(0.9).then(() => {
        if (rt.disposed || !rt.byId.secretary) return;
        rt.bubble(V.mayor ? pick(["Take a number, dear!", "Welcome to city hall! Take a number."]) : "The mayor's out. Ribbon cutting.", rt.byId.secretary.p.obj, 3.0);
    });
}

async function takeNumber(rt) {
    S.ticket = (S.ticket || 411) + 1;
    S.pulls = (S.pulls || 0) + 1;
    saveSoon();
    stat("cityhallTickets");
    const line = S.pulls > 12 && Math.random() < 0.3 ? TICKET.tooMany : pick(TICKET.pulls).replace("{n}", S.ticket);
    await rt.say("🎫 Take-a-number", line, { emoji: "🎫", color: "#C62828" });
}

async function windowTalk(rt, w, shut) {
    if (shut) return rt.say(`${w.label}`, closedLine(), { emoji: "🚪", color: "#795548" });
    const L = CLERK_LOOKS[w.id], who = rt.byId["clerk_" + w.id];
    for (const h of WIN_HOOKS[w.id] || []) {
        try { if (await h.fn(rt, who, L.name)) return; } catch (e) { console.error("[cityhall] window", e); }
        if (rt.disposed) return;
    }
    if (w.id === "complaints") {
        const opts = COMPLAINTS.map(c => c.opt).concat(["💬 Just looking"]);
        const i = await rt.choose(L.name, clerkPools.complaints(), opts, { emoji: L.emoji, person: who });
        if (i >= 0 && i < COMPLAINTS.length && !rt.disposed) {
            stat("cityhallComplaints");
            emit("cityhall:complaint", { about: COMPLAINTS[i].opt });
            await rt.say(L.name, COMPLAINTS[i].reply, { emoji: L.emoji, person: who });
        }
        return;
    }
    return rt.say(L.name, clerkPools[w.id](), { emoji: L.emoji, person: who });
}

async function talkMayor(rt) {
    const town = rt.data.V.town, T = TOWNS[town] || TOWNS.lakewood, MY = MAYOR[town] || MAYOR.lakewood, who = rt.byId.mayor;
    const o = { emoji: T.mayor.emoji, person: who, color: "#283593" };
    if (!rt.data.V.met) {
        rt.data.V.met = true;
        let first = null;
        for (const f of MAYOR_LINES) { try { first = first || f(town); } catch (e) { /* none */ } }
        await rt.say(T.mayor.name, first || pick(MY.hello), o);
        if (rt.disposed) return;
    }
    const i = await rt.choose(T.mayor.name, "What can I do for you? Within reason. Mostly ribbons.", ["🏙️ What have you done for the town?", "🤳 A selfie with the mayor", "👋 Just saying hi"], o);
    if (rt.disposed) return;
    if (i === 0) await rt.say(T.mayor.name, pick(MY.done), o);
    else if (i === 1) { stat("cityhallSelfies"); await rt.say(T.mayor.name, MY.selfie, o); if (who) rt.burst(who.p.obj.position.clone().setY(1.8), undefined, 10, 1.6, 0.05); }
    else await rt.say(T.mayor.name, pick(MY.bye), o);
    S.metMayor = S.metMayor || {}; if (!S.metMayor[town]) { S.metMayor[town] = true; saveSoon(); }
    emit("cityhall:mayor", { town, ask: i });
}

function tick(rt, dt) {
    const V = rt.data.V;
    if (!V || !V.display) return;
    // now and then the display flicks to 38 — the man with ticket 38 jumps up — and it's straight back to 37
    if (V.dingT > 0) {
        V.dingT -= dt;
        if (V.dingT <= 0) { V.display.material.map = V.tex37; V.display.material.needsUpdate = true; }
        return;
    }
    V.ding -= dt;
    if (V.ding <= 0 && !force.noDing) {
        V.ding = 28 + Math.random() * 20; V.dingT = 1.6;
        V.display.material.map = V.tex38; V.display.material.needsUpdate = true;
        const w = rt.byId.wait0;
        if (w && V.waiting[0] && /38/.test(V.waiting[0].name)) rt.bubble("THAT'S ME! …oh. Never mind.", w.p.obj, 2.2);
        else if (rt.byId.secretary) rt.bubble("*ding*", rt.byId.secretary.p.obj, 1.2);
    }
}
