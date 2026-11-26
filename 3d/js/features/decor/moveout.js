// features/decor/moveout.js — 📦 IMA'S HOUSE IS TEMPORARY (roadmap 23, ci/moveout; the owner, 2026-11-26: "Players
// shouldn't be able to customize mom's house since that's not their own. It's more like a temporary place until they
// settle on their own. Likewise friends shouldn't be able to visit that house. Even in the house as time goes on there
// should be subtle signs that Lulu needs to buy their own house, signs should get progressively more aggressive").
//
//   • HER THINGS: nobody decorates Ima's house (decor/index.js + house.js show Ima's own first options). Everything she
//     ever bought stays hers (ctx.decor.owns): packed in boxes in her room — one box per thing — "for your own place".
//     Ima says once what happened to them. In the FIRST home she owns, the Lulu's-room pieces she had placed go up by
//     themselves (`seed`, called by features/realestate's house), free; any owned thing is free to pick there anyway.
//   • NO FRIENDS INSIDE: everyone has her own copy of the house and nobody's room is shared (together/rooms.js ›
//     NOT_SHARED). With a friend already inside hers, ✋ at the door is 🔔 RING THE BELL → Ima's refusal (`refuse`).
//     Strangers' ghosts aren't drawn around the lot (multiplayer/ghosts.js › LOT_R).
//   • THE HINTS: STAGES below, by REAL calendar days (the device's local date) counted from her first day — the owner,
//     2026-11-26: "7 real days is better for the max hint" (day 1 nothing, then one stage a day; a player who stays away
//     comes back to a later stage — Ima got on with it). A save from before this counts from its first launch after it:
//     props in the kitchen / her room / by the door, and ONE line from Ima when she walks in. No pop-ups, nothing that
//     blocks or locks: the bed, Dina's door, the front door and the kitchen always work. Once her days start at a home
//     of her own (ctx.home.startAt) they stop and turn warm: "WE KEPT YOUR ROOM! (it's a gym now)".
// Service ctx.moveout: days · stage() · based() · build(rt, B) → Ima's line | null · imaLines() · friendHome() ·
// refuse() · seed(homeId, decorMap) · debug { S, setDays(n), STAGES }.
import { ctx, on } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { textPlane } from "../../core/sets.js";
import { Kit } from "./props.js";
import { SLOTS } from "./data.js";

const S = store("moveout", { first: null, told: false, seeded: false, seen: -1 });

/** The stages, in order: `at` = her day number (day 1 = the first day she played; the owner wants the last by day 7); each one ADDS to the ones before it. `line`: Ima's line the visit it first
 *  shows (and now and then after). Props are built by `props(K, B, put)` (K: one merged Kit; put(textPlane …)). */
export const STAGES = [
    { id: "flyer", at: 2, line: "Someone left a flyer on the fridge. No idea who. A mystery! 🧲" },
    { id: "photo", at: 3, line: "The Goldbergs' daughter has her OWN apartment now. Lovely place. I'm just mentioning. 🏢" },
    { id: "circled", at: 4, line: "I circled a few in the paper. For fun! Circling is fun. ⭕" },
    { id: "bike", at: 5, line: "The bike needed a room. And your room is… a room! 🚲" },
    { id: "rent", at: 6, line: "The sign in the window is a JOKE. Mostly. 😅" },
    { id: "boarder", at: 7, line: "The air mattress is very comfortable! I'm told. Mr. Feivish's plant says hi. 🪴" },
    { id: "feivish", at: 7, line: "I printed you directions to the realtor. And a map. And a sandwich for the trip. 🥪" },
];
const KEPT_LINE = "We kept your room! It's a gym now. Come for dinner! 💕";
const TOLD_LINE = "I packed your things in boxes, sweetie — they're for your own place. 📦";
const TALK = {
    flyer: ["Midwood has SUCH nice homes. Did you see the flyer?", "A home of your own! Imagine. I'm imagining it right now."],
    photo: ["The Goldbergs' daughter makes her OWN kugel now. In her OWN kitchen.", "Her apartment has a balcony. Not that I'm counting balconies."],
    circled: ["That realtor's card on your pillow? Must have fallen there. From the ceiling.", "Page six, the ones in red. Just for fun!"],
    bike: ["I'll only use the bike when you're out! You're out a lot. That's good!", "The sewing machine is just visiting. Like you! …I mean that with love."],
    rent: ["Your things are by the door so they're READY. For what? Who knows!", "Abba's measuring for a study. He measures everything. It's a hobby."],
    boarder: ["Mr. Feivish is very quiet. You'll barely notice him. In your room.", "An air mattress builds character!"],
    feivish: ["I love you to the moon. And the moon has VERY reasonable listings.", "The realtor said she has openings! I happened to ask. Twice."],
};

/** Today's local calendar day as a day number (DST-proof: the date's own Y/M/D through UTC). */
const dayNo = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
// her first day: the first launch with this code (a new player's first day; an old save's first day after the update)
if (!Number.isFinite(S.first)) { S.first = dayNo(); saveSoon(); }
/** Her day number: 1 on the first day, 7 a week later (never below 1 — a clock set back doesn't undo anything). */
export const days = () => Math.max(1, dayNo() - S.first + 1);

/** Her days start at a home of her own (features/realestate's "🏠 Start my days here"). */
export const based = () => !!(ctx.home && ctx.home.startAt);
/** The current stage index (-1: none yet). */
export function stage() {
    let k = -1;
    const n = days();
    for (let i = 0; i < STAGES.length; i++) if (n >= STAGES[i].at) k = i;
    return k;
}
const has = id => { const k = stage(); return STAGES.findIndex(s => s.id === id) <= k; };
/** What she has bought (one box each): [{ slot, id, icon, name }]. */
export function boxed() {
    const out = [];
    if (!ctx.decor) return out;
    for (const s of SLOTS) for (const o of s.opts.slice(1)) if (ctx.decor.owns(s.id, o.id)) out.push({ slot: s.id, id: o.id, icon: o.icon, name: o.name });
    return out;
}

// ═════════════════════════════════════════════════════════════════════════
//  the house: boxes + the stage's props (house.js's build hands its helpers in B)
// ═════════════════════════════════════════════════════════════════════════
function sign(rt, lines, o, x, y, z, ry = 0, rx = 0) {
    const p = textPlane(lines, o);
    p.position.set(x, y, z); p.rotation.set(rx, ry, 0);
    rt.own(p.material, p.material.map);
    rt.add(p);
    return p;
}
/** Build what Ima's house shows today. → the one line Ima says as she walks in (or null). */
export function build(rt, B) {
    const { col, RCX, LCX, KCX, D, X1, DOOR_X, bz } = B;
    const V = rt.data.V;
    const K = new Kit();
    const M = rt.data.MO = { stage: based() ? "kept" : stage(), boxes: 0, at: null, props: [] };
    const k = based() ? STAGES.length - 1 : stage();
    const vis = id => !based() && has(id);
    // ── her things, boxed: in her room (from "rent": stacked by the front door, ready) ──
    const items = boxed();
    const byDoor = vis("rent");
    const bx0 = byDoor ? DOOR_X - 2.25 : RCX - 2.35, bz0 = byDoor ? D / 2 - 0.65 : D / 2 - 1.05;
    const shown = Math.min(items.length, 9);
    for (let i = 0; i < shown; i++) {
        const c = i % 3, r = Math.floor(i / 3), w = 0.46, h = 0.36;
        const x = bx0 + c * 0.5, y = h / 2 + r * h, z = bz0 + (r % 2 ? 0.04 : 0);
        K.box(w, h - 0.02, 0.44, i % 2 ? "#C8A26E" : "#B98F5A", x, y, z);
        K.box(w + 0.01, 0.04, 0.1, "#E8D3A8", x, y + h / 2 - 0.03, z);           // tape
    }
    if (shown) {
        col("boxes", bx0 - 0.3, bx0 + 1.3, bz0 - 0.3, bz0 + 0.3);
        sign(rt, ["LULU'S THINGS 📦", byDoor ? "FRAGILE — GOOD LUCK" : "FOR MY OWN PLACE"], { w: 0.9, h: 0.3, bg: "#FFF8E1", fg: "#6D4C41", font: 50 }, bx0 + 0.5, Math.min(1.2, 0.36 * Math.ceil(shown / 3)) + 0.22, bz0 + 0.23);
        M.boxes = shown; M.at = { x: bx0 + 0.5, z: bz0 - 0.75 };
        rt.hot({ id: "boxes", x: M.at.x, z: M.at.z, r: 1.0, label: "📦 Your things", action: r => r.say("Lulu", boxLine(items), { emoji: "📦" }) });
    }
    // ── 1 · the realtor's flyer on the fridge (the fridge's front: KCX + 2.5, z ≈ bz + 0.8) ──
    if (vis("flyer")) M.props.push(sign(rt, ["🏡 MIDWOOD HOMES", "YOUR FUTURE", "STARTS HERE!"], { w: 0.34, h: 0.44, bg: "#E1F5FE", fg: "#01579B", font: 54 }, KCX + 2.38, 1.5, bz + 0.79));
    // ── 2 · a framed photo of the neighbours' daughter's lovely apartment (the kitchen wall) ──
    if (vis("photo")) {
        K.box(0.74, 0.56, 0.04, "#8D6E63", KCX - 0.35, 1.9, bz + 0.03);
        M.props.push(sign(rt, ["🏢✨", "THE GOLDBERGS'", "DAUGHTER'S PLACE"], { w: 0.64, h: 0.46, bg: "#FFFDE7", fg: "#4E342E", font: 46 }, KCX - 0.35, 1.9, bz + 0.06));
    }
    // ── 3 · the realtor's card on her pillow + the paper on the kitchen table, listings circled ──
    if (vis("circled")) {
        M.props.push(sign(rt, ["REALTOR 🔑", "CALL ME!"], { w: 0.22, h: 0.13, bg: "#FFFFFF", fg: "#AD1457", font: 60 }, RCX - 1.7, 0.7, -2.3, 0, -Math.PI / 2));
        M.props.push(sign(rt, ["THE MIDWOOD TIMES", "FOR SALE ⭕ ⭕ ⭕"], { w: 0.5, h: 0.36, bg: "#F5F5F5", fg: "#B71C1C", font: 44 }, KCX - 1.65, 0.79, 1.25, 0.4, -Math.PI / 2));
    }
    // ── 4 · her room fills up: Ima's exercise bike, the sewing machine, Dina's stuffed animals on her shelf ──
    if (vis("bike") || based()) {
        const x = RCX + 1.65, z = 1.75;
        K.box(1.0, 0.08, 0.3, "#37474F", x, 0.06, z); K.box(0.08, 0.7, 0.08, "#546E7A", x - 0.3, 0.42, z, { rz: 0.25 });
        K.box(0.3, 0.07, 0.18, "#212121", x - 0.38, 0.8, z); K.box(0.08, 0.95, 0.08, "#546E7A", x + 0.35, 0.52, z, { rz: -0.2 });
        K.box(0.5, 0.06, 0.06, "#B0BEC5", x + 0.42, 1.0, z); K.cyl(0.22, 0.22, 0.06, "#E91E63", x, 0.32, z, { rx: Math.PI / 2 });
        col("bike", x - 0.6, x + 0.6, z - 0.3, z + 0.3);
    }
    if (vis("bike")) {
        const x = RCX + 0.95, z = -2.45;
        K.box(0.8, 0.72, 0.5, "#A1887F", x, 0.36, z); K.box(0.42, 0.22, 0.2, "#ECEFF1", x, 0.83, z); K.box(0.1, 0.3, 0.2, "#ECEFF1", x + 0.16, 0.98, z);
        col("sewing", x - 0.45, x + 0.45, -2.8, z + 0.28);
        for (const [dx, c] of [[-0.3, "#F48FB1"], [0, "#CE93D8"], [0.3, "#FFF59D"]]) K.ball(0.11, c, RCX + 2.4 + dx, 1.17, -2.57);
    }
    // ── 5 · ROOM FOR RENT in the window (a joke!), her boxes by the door (above), ABBA'S STUDY (SOON) on her wall ──
    if (vis("rent")) {
        M.props.push(sign(rt, ["ROOM FOR RENT", "(JOKE!) (MOSTLY)"], { w: 1.15, h: 0.46, bg: "#FFFFFF", fg: "#C62828", font: 64 }, LCX + 0.95, 1.92, bz + 0.07));
        M.props.push(sign(rt, ["ABBA'S STUDY", "(SOON) 📏"], { w: 0.5, h: 0.3, bg: "#FFF59D", fg: "#5D4037", font: 52 }, RCX - 2.45, 1.75, bz + 0.03));
        K.cyl(0.07, 0.07, 0.04, "#FDD835", RCX - 2.0, 0.02, -0.4); K.box(0.9, 0.01, 0.03, "#FFF176", RCX - 1.55, 0.01, -0.4);
    }
    // ── 6 · her bed is an air mattress now; the "prospective boarder" already left a plant + a suitcase ──
    if (vis("boarder")) {
        if (V && V.objs && V.objs.bed) V.objs.bed.visible = false;
        K.box(1.0, 0.24, 1.9, "#64B5F6", RCX - 1.7, 0.12, -1.72); K.box(0.55, 0.1, 0.3, "#FFFFFF", RCX - 1.7, 0.29, -2.4);
        K.cyl(0.11, 0.09, 0.2, "#8D6E63", RCX - 0.6, 0.62, -2.45); K.ball(0.16, "#43A047", RCX - 0.6, 0.85, -2.45);
        K.box(0.42, 0.55, 0.2, "#5D4037", RCX - 0.95, 0.28, -0.85); K.box(0.16, 0.04, 0.04, "#212121", RCX - 0.95, 0.6, -0.85);
        col("suitcase", RCX - 1.2, RCX - 0.7, -1.0, -0.7);
    }
    // ── 7 · Mr. Feivish's name on her doorway + the fridge calendar ──
    if (vis("feivish")) {
        M.props.push(sign(rt, ["MR. FEIVISH", "PLEASE KNOCK 🙏"], { w: 0.7, h: 0.26, bg: "#E8EAF6", fg: "#1A237E", font: 52 }, LCX + B.W / 2 - 0.05, 2.25, 0.6, -Math.PI / 2));
        M.props.push(sign(rt, ["📅 LULU MOVES OUT??", "⭕ 3  ⭕ 11  ⭕ 19  ⭕ 27"], { w: 0.4, h: 0.3, bg: "#FFFFFF", fg: "#AD1457", font: 40 }, KCX + 2.62, 1.05, bz + 0.79));
    }
    // ── she lives somewhere else now: WE KEPT YOUR ROOM! (it's a gym now) + a photo of her on the nightstand ──
    if (based()) {
        M.props.push(sign(rt, ["WE KEPT YOUR ROOM! 💕", "(it's a gym now)"], { w: 1.3, h: 0.36, bg: "#FCE4EC", fg: "#AD1457", font: 54 }, RCX + 1.7, 2.05, bz + 0.03));
        K.box(0.22, 0.28, 0.03, "#FF4F9A", RCX - 0.45, 0.66, -2.45, { rx: -0.2 });
    }
    if (K.parts.solid.length) rt.add(K.build("MoveOut"));
    // ── Ima's one line as she walks in ──
    let line = null;
    if (items.length && !S.told) { line = TOLD_LINE; S.told = true; saveSoon(); }
    else if (based()) line = KEPT_LINE;
    else if (k >= 0 && (S.seen !== k || Math.random() < 0.35)) { line = STAGES[k].line; }
    if (k !== S.seen && !based()) { S.seen = k; saveSoon(); }
    M.line = line;
    return line;
}
function boxLine(items) {
    if (!items.length) return "Empty boxes. Ima's ready. I'm… getting there.";
    const names = items.slice(0, 4).map(i => `${i.icon} ${i.name}`).join(", ");
    const more = items.length > 4 ? ` and ${items.length - 4} more` : "";
    return `${names}${more}. All mine — for when I get my own place! (In my own home they go up for free.)`;
}
/** Extra things Ima says when she's talked to (the stage's; empty before the first stage / once she's moved out). */
export function imaLines() {
    if (based()) return ["Come for dinner! Friday too. And Tuesday. Just come. 💕", "I use your room for spinning class. You'd be so proud."];
    const k = stage();
    return k >= 0 ? TALK[STAGES[k].id] || [] : [];
}

// ═════════════════════════════════════════════════════════════════════════
//  friends at the door: nobody's let in to anybody's copy of Ima's house
// ═════════════════════════════════════════════════════════════════════════
const HOUSE = "luluHome";
/** A friend in my party is inside her own copy of Ima's house right now (so this door is "her friend's" door). */
export function friendHome() {
    const P = ctx.party;
    if (!P || !P.active || !P.members) return false;
    const town = (ctx.home && ctx.home.town) || "";
    for (const u of P.members()) {
        if (u === P.uid) continue;
        const p = P.peer(u);
        if (!p || p.m !== 7 || !P.fresh(p, 6000)) continue;
        const z = p.x && typeof p.x.z === "string" ? p.x.z : "";
        if (z !== town) continue;
        const pr = P.presenceOf ? P.presenceOf(u) : null;
        if (pr && pr.mode === "in" && /^at home|in Home$/.test(pr.label || "")) return true;
    }
    return false;
}
const REFUSE = [
    "Ima, through the door: \"Lulu's friend! Sweetheart! Family only today. When she has her OWN place — come over THERE! 😘\"",
    "Ima, through the door: \"Who's that? A friend! Lovely! No. 💕 Ask Lulu about her new apartment! …She doesn't have one? Ask her WHY.\"",
    "Ima, through the door: \"I just mopped! Wave from the window. 👋 Lulu's place, next time — once she gets one.\"",
];
let refusedAt = -99;
/** ✋ 🔔 RING THE BELL (a friend's inside her copy): Ima says no, kindly. Nothing happens to anyone. */
export function refuse() {
    const text = REFUSE[Math.floor(Math.random() * REFUSE.length)];
    refusedAt = ctx.time || 0;
    if (ctx.foot && ctx.foot.bubble && ctx.foot.obj) ctx.foot.bubble(ctx.foot.obj, text, 3.4);
    return text;
}
// (while she's inside: the friend finder says she's "at home", not "in Home")
on("state", ({ to }) => {
    if (to !== "interior" || !(ctx.stateData && ctx.stateData.id === HOUSE) || !ctx.party || !ctx.party.active || !ctx.party.presence) return;
    ctx.party.presence({ mode: "in", icon: "🏠", label: "at home" });
});

// ═════════════════════════════════════════════════════════════════════════
//  her FIRST own home: the Lulu's-room pieces she'd chosen go up there by themselves (no second payment — she owns them)
// ═════════════════════════════════════════════════════════════════════════
/** features/realestate's house, the first time she's inside a home of hers: fill its decor map. → true when seeded. */
export function seed(homeId, map) {
    if (S.seeded || !homeId || !map || !ctx.decor) return false;
    const room = {};
    for (const s of SLOTS) {
        if (s.where !== "inside" || s.room !== "lulu") continue;
        const id = ctx.decor.placed(s.id);
        if (id && id !== s.opts[0].id && ctx.decor.owns(s.id, id)) room[s.id] = id;
    }
    S.seeded = true; saveSoon();
    if (!Object.keys(room).length) return false;
    map[homeId] = Object.assign(room, map[homeId] || {});
    return true;
}

ctx.moveout = {
    get days() { return days(); },
    stage, based, build, imaLines, friendHome, refuse, seed, boxed,
    get refusedAt() { return refusedAt; },
    debug: {
        S, STAGES,
        /** Tests: make today her n-th day (her first day n − 1 days ago); `told` = whether Ima's said where her things went. */
        setDays(n, told = S.told) { S.first = dayNo() - Math.max(1, n | 0) + 1; S.told = told; saveSoon(); return days(); },
        /** Inside the house: what this visit built — { stage, boxes, at, line, props (how many signs) }. */
        room: () => { const rt = ctx.decor && ctx.decor.debug.room(), M = rt && rt.data.MO; return M ? { stage: M.stage, boxes: M.boxes, at: M.at, line: M.line, props: M.props.length } : null; },
    },
};
