// features/cityhall/comment.js — 🎤 "PUBLIC COMMENT NIGHT" (roadmap 38, the owner's request, guardrails in data.js +
// ARCHITECTURE › City hall). Lakewood City Hall, evenings, on COMMENT_NIGHT.rate of the eligible real days (parodyday.js —
// never a Friday, Shabbos, Yom Tov, a fast or the eve of one): the lobby has a mic stand, folding chairs and an agenda easel
// — ITEM 1: THE POTHOLE ON MINIVAN WAY. Two of three recurring CRANKS (named people: Gary, Darlene, Ron — rotating by the
// day, their lines too) give the "they're taking over" speech, and it collapses under its own evidence ("they bought the
// house next to mine… and then they MOVED IN"); the clerk keeps saying "sir, the item is the pothole"; Mayor Kugelman is
// asleep in his office; and their own NEIGHBOURS sit them down ("Gary. The Goldbergs shovelled your driveway all winter.
// Sit.") — a normal town with a couple of cranks, never two sides. Pothole Phil only ever talks about the pothole.
//   ✋ 🎤 the mic: her turn (read the pothole's dimensions · yield her time to the pothole · ask Gary about the cholent) →
//   the vote → deferred. ✋ 📋 the agenda · 💬 anyone. Nothing pays; no pop-ups (the meeting is bubbles while she's inside);
//   the windows room is untouched (she can still pay a ticket).
import { ctx, on, emit } from "../../core/ctx.js";
import { COMMENT_NIGHT as CN } from "./data.js";
import { LOBBY_BUILDERS } from "./lobby.js";
import { stat } from "./state.js";
import { now, dayKey, onNow, rng, shuffled } from "./parodyday.js";

export const CNS = { log: [], rt: null };
function log(ev, d = {}) { CNS.log.push(Object.assign({ ev }, d)); if (CNS.log.length > 60) CNS.log.shift(); }
const pick = a => a[Math.floor(Math.random() * a.length)];

/** The night's line-up (a pure function of the date): which two cranks, which of their lines, who sits them down. */
export function pcnPlan(date = now()) {
    const key = dayKey(date), r = rng(key + ":pcn-plan");
    const cranks = shuffled(Object.keys(CN.cranks), r).slice(0, 2);
    const script = [["clerk", CN.clerk.open], ["phil", CN.regular.lines[Math.floor(r() * CN.regular.lines.length)]]];
    for (const c of cranks) {
        const C = CN.cranks[c], two = shuffled(C.lines, r).slice(0, 2);
        script.push(["swap", c]);
        for (const [k, set] of two.entries()) {
            set.forEach((t, j) => script.push([j % 2 ? "clerk" : c, t]));        // (a three-part line: the crank, the clerk, the crank)
            if (k === 0) script.push(["clerk", CN.clerk.redirect[Math.floor(r() * CN.clerk.redirect.length)]]);
        }
        const who = Object.keys(CN.neighbours).filter(n => CN.neighbours[n].to[c]);
        const n = who[Math.floor(r() * who.length)], lines = CN.neighbours[n].to[c];
        script.push([n, lines[Math.floor(r() * lines.length)]]);
        script.push([c, C.sit[Math.floor(r() * C.sit.length)]]);
    }
    script.push(["mayor", CN.mayor[Math.floor(r() * CN.mayor.length)]]);
    return { key, cranks, script };
}

/** Dress the lobby for the meeting (a LOBBY_BUILDERS entry: only Lakewood, only tonight, only in its hours). */
function dress(rt, B, info) {
    if (info.town !== CN.town || !onNow("pcn") || !ctx.enabled("cityhall")) return;
    const LB = info.LB, bz = info.bz, plan = pcnPlan();
    const V = rt.data.CN = { plan, i: 0, speaker: plan.cranks[0], spoke: false };
    CNS.rt = rt;
    // the mic stand (in front of the back wall, facing the benches) + the agenda easel + a row of folding chairs
    const mx = LB + 0.55, mz = -1.05;
    B.box(0.04, 1.3, 0.04, "#424242", mx, 0.65, mz); B.box(0.3, 0.03, 0.3, "#424242", mx, 0.015, mz); B.box(0.08, 0.12, 0.08, "#212121", mx, 1.34, mz + 0.03);
    const ex = LB + 1.55, ez = -1.75;
    B.box(0.04, 1.5, 0.04, "#6D4C41", ex - 0.4, 0.75, ez); B.box(0.04, 1.5, 0.04, "#6D4C41", ex + 0.4, 0.75, ez);
    B.sign(CN.agenda, ex, 1.3, ez + 0.04, 1.0, 0.8, { bg: "#FFFFFF", fg: ["#C62828", "#1A237E", "#1A237E"], font: 60, border: "#455A64" });
    B.col("pcnEasel", ex - 0.5, ex + 0.5, ez - 0.15, ez + 0.15);
    const seats = [[LB - 1.75, 1.45], [LB - 1.1, 1.45], [LB + 0.95, 1.45]];
    for (const [x, z] of seats) B.put("Chair", x, z, Math.PI);
    // the people (no collisions: the doorway, the benches and the windows room stay free)
    const P = (id, key, x, z, ry, opts) => { try { return rt.person(id, key === "woman" ? "npcWoman" : "npcMan", { x, z, ry }, Object.assign({ collide: false, faceLulu: false }, opts)); } catch (e) { return null; } };
    const [c0, c1] = plan.cranks, A = CN.cranks[c0], Bc = CN.cranks[c1];
    V.mic = { x: mx, z: mz - 0.35, ry: 0 };
    V.seat = { x: seats[0][0], z: seats[0][1], ry: Math.PI };
    P("pcn_" + c0, A.look, V.mic.x, V.mic.z, 0, { name: A.name, colors: A.colors, pose: {} });
    P("pcn_" + c1, Bc.look, V.seat.x, V.seat.z, Math.PI, { name: Bc.name, colors: Bc.colors, pose: { sit: true }, y: 0.05 });
    const nb = Object.entries(CN.neighbours);
    nb.forEach(([id, N], k) => P("pcn_" + id, N.look, seats[k + 1][0], seats[k + 1][1], Math.PI, { name: N.name, colors: N.colors, pose: { sit: true }, y: 0.05 }));
    P("pcn_phil", CN.regular.look, LB + 2.35, -0.55, -Math.PI / 2, { name: CN.regular.name, colors: CN.regular.colors, pose: {} });
    // ✋
    rt.hot({ id: "pcn_mic", x: mx, z: mz + 0.75, r: 0.8, label: CN.mic.spot, action: mic });
    rt.hot({ id: "pcn_agenda", x: ex, z: ez + 0.9, r: 0.7, label: CN.agendaSpot, action: r => r.say("Lulu", CN.lulu.agendaRead, { emoji: "📋" }) });
    for (const id of plan.cranks) rt.hot({ id: "pcn_hot_" + id, x: 0, z: 0, r: 0.7, who: "pcn_" + id, label: `💬 ${CN.cranks[id].name}`,
        enabled: () => !!rt.byId["pcn_" + id], action: r => crankTalk(r, id) });
    nb.forEach(([id, N]) => rt.hot({ id: "pcn_hot_" + id, x: rt.byId["pcn_" + id] ? rt.byId["pcn_" + id].home.x : 0, z: 1.95, r: 0.6, who: "pcn_" + id, label: `💬 ${N.name}`,
        action: r => r.say(N.name, pick(Object.values(N.to).flat()), { emoji: "🙄", person: r.byId["pcn_" + id] }) }));
    rt.hot({ id: "pcn_hot_phil", x: LB + 2.35, z: 0.1, r: 0.6, who: "pcn_phil", label: `💬 ${CN.regular.name}`,
        action: r => r.say(CN.regular.name, pick(CN.regular.lines), { emoji: "🕳️", person: r.byId.pcn_phil }) });
    placeHots(rt);
    // the meeting: one line every CN.beat s while she's inside (bubbles — no pop-ups)
    rt.every(CN.beat, CN.beat, r => beat(r), { gate: false, first: 2.5 });
    rt.wait(1.4).then(() => { if (!rt.disposed && rt.lulu) rt.bubble(CN.lulu.walkIn, rt.lulu.obj, 2.8); });
    stat("parodyMeetings");
    emit("cityhall:parody", { kind: "pcn", phase: "start", cranks: plan.cranks });
    log("dress", { cranks: plan.cranks, lines: plan.script.length });
}
/** The crank hotspots follow whoever is where (the mic / the chair). */
function placeHots(rt) {
    for (const h of rt.hots) if (/^pcn_hot_(gary|darlene|ron)$/.test(h.id)) { const p = rt.byId[h.who]; if (p) { h.x = p.p.obj.position.x; h.z = p.p.obj.position.z + (p.pose.sit ? 0.55 : 0.6); } }
}
/** Swap who's at the mic (the next crank stands up, the last one sits down). */
function swap(rt, c) {
    const V = rt.data.CN;
    if (!V || V.speaker === c) return;
    const up = rt.byId["pcn_" + c], down = rt.byId["pcn_" + V.speaker];
    if (up) { up.p.obj.position.set(V.mic.x, 0, V.mic.z); up.p.obj.rotation.y = 0; up.pose = {}; up.home = Object.assign({}, V.mic); }
    if (down) { down.p.obj.position.set(V.seat.x, 0.05, V.seat.z); down.p.obj.rotation.y = Math.PI; down.pose = { sit: true }; down.home = Object.assign({}, V.seat); }
    V.speaker = c;
    placeHots(rt);
}
function speakerOf(rt, who) {
    if (who === "clerk") return rt.byId.secretary;
    if (who === "mayor") return rt.byId.mayor;
    if (who === "phil") return rt.byId.pcn_phil;
    return rt.byId["pcn_" + who];
}
function beat(rt) {
    const V = rt.data.CN;
    if (!V || rt.disposed || V.busy || (ctx.dialogOpen)) return;
    let step = V.plan.script[V.i % V.plan.script.length];
    V.i++;
    if (step[0] === "swap") { swap(rt, step[1]); step = V.plan.script[V.i % V.plan.script.length]; V.i++; }
    const who = speakerOf(rt, step[0]);
    if (who) rt.bubble(step[1], who.p.obj, CN.beat - 0.8);
    log("line", { who: step[0], i: V.i });
}
async function crankTalk(rt, id) {
    const C = CN.cranks[id], set = pick(C.lines);
    await rt.say(C.name, set[0], { emoji: "📣", person: rt.byId["pcn_" + id] });
    if (rt.disposed) return;
    await rt.say("Lulu", pick(["…that's not how any of that works.", "Have you tried saying hi to them?", "Is this about the pothole?"]), { emoji: "🤨" });
}
/** ✋ the mic: her turn → the vote (deferred). Nothing pays. */
export async function mic(rt) {
    const V = rt.data.CN;
    if (!V) return;
    V.busy = true;
    try {
        // (the cholent question only when Gary's here tonight)
        const idx = [0, 1, 2, 3].filter(k => k !== 2 || !!rt.byId.pcn_gary);
        const j = await rt.choose("The Clerk", CN.mic.prompt, idx.map(k => CN.mic.opts[k]), { emoji: "🎤", person: rt.byId.secretary });
        const i = j < 0 ? -1 : idx[j];
        if (rt.disposed || i < 0 || i === 3) return;
        const R = CN.mic.replies[i];
        if (i === 1) await rt.say("Lulu", CN.mic.yield, { emoji: "🕳️" });
        else if (R) await rt.say(R[0], R[1], { emoji: i === 2 ? "🍲" : "🎤", person: i === 2 ? rt.byId.pcn_gary || null : null });
        if (rt.disposed) return;
        await rt.say(CN.mic.after[0], CN.mic.after[1], { emoji: "🕳️", person: rt.byId.pcn_phil });
        for (const line of CN.mic.vote) { if (rt.disposed) return; await rt.say("The Clerk", line, { emoji: "🗳️", person: rt.byId.secretary }); }
        if (!rt.disposed) await rt.say("Lulu", CN.mic.lulu, { emoji: "🙄" });
        V.spoke = true;
        stat("parodyMic");
        emit("cityhall:parody", { kind: "pcn", phase: "mic", pick: i });
        log("mic", { pick: i });
    } finally { V.busy = false; }
}
on("boot", () => LOBBY_BUILDERS.push(dress));
