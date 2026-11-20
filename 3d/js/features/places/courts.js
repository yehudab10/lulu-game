// features/places — the two COURTHOUSES' own stories (the owner, 2026-11-20).
//   • LAKEWOOD: "In re: Baby Gitty" — Shloime's custody case (shloime.js), five short hearings Lulu can sit in on in
//     Courtroom 2B, one a real day (state `placesHearing`, a spectator scene on law's courtroom set — court.js
//     `courtStage()`), skippable; she's pulled in once as a hopeless character witness. When it's over Shloime and the
//     baby are a face around Lakewood (the stroller by the courthouse, a line when she talks to him). Pays nothing;
//     a scrapbook badge for seeing it through.
//   • MIDWOOD: when Lulu is tried THERE, her lawyer is ABBA — `counsel(tier)` (court.js asks): he plays whatever lawyer
//     she has (or sits in uninvited), the SAME tier, factor and draws, only who speaks and what he says changes; and he's
//     in the Midwood lobby with a line. Midwood's 2B stays locked (a small-claims case audible through the door).
// Solo: in a 🎉 party the 2B doors stay locked (the hearing is a set scene — a friend sitting in together would need a
// shared scene; not cheap, so it's personal and solo-only).
import * as THREE from "three";
import { ctx, on, emit, hook, registerState, setState } from "../../core/ctx.js";
import { models, ensureModels, findNodes, cloneWithColors } from "../../models.js";
import { store, saveSoon } from "../../core/save.js";
import { say as dlgSay, choose as dlgChoose, closeDialog } from "../../core/dialog.js";
import * as A from "../../audio.js";
import { courtStage } from "../law/court.js";
import { runFlow, check, person, lulu, walkTo } from "../law/scene.js";
import * as X from "../law/sfx.js";
import { BADGES } from "../meta/badges.js";
import { CAST, HEARINGS, ABBA_COURT, SHLOIME_AFTER, BABY_AFTER } from "./shloime.js";

/** Saved: each case's progress (`cases[id] = { n: hearings seen, day: the local day of the last }`); Abba's line rotations. */
export const CS = store("courts", { cases: {}, abba: 0, abbaL: 0 });
const pick = a => a[Math.floor(Math.random() * a.length)];
const party = () => !!(ctx.party && ctx.party.active);
/** Today's local date (a hearing a REAL day). Tests can pin it: courts.debug.D.today = "2026-11-21". */
const D = { today: null };
export const today = () => D.today || (() => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; })();
/** The town the courtroom is in right now (a trial: where she was taken; walking in: the town she's in). */
function courtTown() { const P = ctx.civic && ctx.civic.place; return (P && P.id) || (ctx.town && ctx.town.active && ctx.town.id) || null; }

// ── CASES: Courtroom 2B's docket, as data ────────────────────────────────
// A case is heard in one town's Courtroom 2B as a series of short spectator hearings on law's courtroom set. Add one with
// `addCase(def)` (or `ctx.civic.courts.addCase(def)`) — nothing else to touch:
//   id        unique; its progress is saved under it
//   town      "lakewood" | "midwood" | null (either courthouse)
//   title     the caption ("IN RE: BABY GITTY"); docket(c, p) → the docket board's line (optional)
//   cast      { key: { name, emoji, color, seat, model?, colors?, fallback? } } — seats: petitioner, petCounsel,
//             respondent, respCounsel (the prosecutor's body), judge, bailiff, gallery, stand, or [x, y, z, rotY]; the keys
//             "judge", "bailiff" and "lulu" (Lulu herself, in the gallery) are always there
//   hearings  [{ title, steps }] — a step is [castKey, text] | { do: "gavel" | "luluToStand" | "luluToGallery" | a name in
//             def.acts | fn(H, api) } | { choose: { who, text, options: [{ label, then: [steps] }] } } (H.choices records them)
//   oneADay   (default true) one hearing a real day · solo (default true) locked in a 🎉 party · available() → may it run now?
//   priority  (default 0) higher = heard first when several cases are open in the same town
//   setup(H, api) / tick(H, dt, api) / shot(who, H) → a camera or null / acts { name: fn(H, api) } / done(H) at every
//             hearing's end (H.n, H.choices, H.last = the case is over now) — the case's own logic (rewards, follow-ups)
//   label     the ✋ at 2B ("⚖️ Sit in on the hearing (…)") · models  extra model keys its setup uses (loaded first)
const CASES = [];
export function addCase(def) {
    const c = Object.assign({ town: null, oneADay: true, solo: true, cast: {}, acts: {} }, def);
    c.cast = Object.assign({ judge: { name: "THE JUDGE", emoji: "👨‍⚖️", color: "#7E57C2", seat: "judge" },
        bailiff: { name: "THE BAILIFF", emoji: "👮", color: "#546E7A", seat: "bailiff" },
        lulu: { name: "LULU", emoji: "💁‍♀️", color: "#E91E63", seat: "gallery" } }, c.cast);
    const i = CASES.findIndex(x => x.id === c.id);
    if (i >= 0) CASES[i] = c; else CASES.push(c);
    return c;
}
export const caseById = id => CASES.find(c => c.id === id) || null;
export const progress = c => CS.cases[c.id] || (CS.cases[c.id] = { n: 0, day: "" });
export const caseDone = (c = caseById("shloime")) => !!c && progress(c).n >= c.hearings.length;
/** Is a hearing of case c on today (not over, not already seen today, solo / available as the case says)? */
export const hearingToday = (c = caseById("shloime")) => !!c && !caseDone(c) && (!c.oneADay || progress(c).day !== today())
    && !(c.solo && party()) && (!c.available || !!c.available());
/** The case on 2B's docket in this town: the highest `priority` (then the first registered) that's not over and may run. */
export function caseIn(town) {
    const here = CASES.filter(c => !c.town || c.town === town).sort((a, b) => (b.priority || 0) - (a.priority || 0));   // (stable: same priority → registration order)
    return here.find(c => !caseDone(c) && (!c.available || c.available())) || null;
}
export function docketText(c) {
    const p = progress(c), N = c.hearings.length;
    if (c.docket) return c.docket(c, p);
    return caseDone(c) ? `📋 2B — ${c.title} · CLOSED.` : `📋 2B — ${c.title} · hearing ${Math.min(p.n + 1, N)} of ${N}${hearingToday(c) ? " · TODAY — public welcome" : " · next session TOMORROW"}`;
}

// ── Midwood: Abba is her lawyer ──────────────────────────────────────────
const rot = list => list[(CS.abba++) % list.length];
/** law/court.js asks: who stands at her side here, and how does he say it? (null = the usual lawyer) */
export function counsel(tier) {
    if (courtTown() !== "midwood") return null;
    saveSoon();
    const name = tier && !tier.free ? `ABBA (as ${tier.name})` : "ABBA";
    return {
        key: "lawAbba", speaker: "abba", name, emoji: "👨",
        opening: () => rot(ABBA_COURT.opening),
        // (the charge's argument itself is the rules' — lawyerChargeArgument — only his way in is his)
        argue: arg => `Lulu-bear, sit up straight. *clears throat* Your honor — ${arg.replace(/^.*?(argue that |FATHER and her counsel: |brief and devastating: |contends )/, "")}`,
        afterProsecutor: () => rot(ABBA_COURT.afterProsecutor),
        uninvited: () => rot(ABBA_COURT.uninvited),
        beforeJury: () => rot(ABBA_COURT.beforeJury),
        verdict: v => (ABBA_COURT.verdict[v] || ABBA_COURT.verdict.fine)[0],
        // (tried with friends — law/crew.js co-defendants: he represents them ALL)
        codefendants: names => rot(ABBA_COURT.codefendants).replace(/\{names\}/g, names),
    };
}

// ── the hearing (a spectator scene on the courtroom set) ─────────────────
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const SEAT = {
    petitioner: [-3.25, 0, -0.35, Math.PI], petCounsel: [-1.95, 0, -0.35, Math.PI], respondent: [1.95, 0, -0.35, Math.PI],
    gallery: [-2.2, 0.07, 2.95, Math.PI], stand: [3.9, 0.3, -5.05, -Math.PI / 4],
};
const SHOT = {
    wide: [[0, 4.6, 10.5], [0, 1.9, -3.0], 50], judge: [[0.9, 2.25, -2.0], [0, 2.85, -6.6], 38],
    petitioner: [[-2.1, 1.75, -3.1], [-3.25, 1.3, -0.35], 40], petCounsel: [[-0.8, 1.75, -3.1], [-1.95, 1.35, -0.35], 40],
    respCounsel: [[2.1, 1.75, -3.1], [3.25, 1.35, -0.35], 40], respondent: [[0.9, 1.75, -3.1], [1.95, 1.3, -0.35], 40],
    bailiff: [[-3.3, 1.9, -1.4], [-5.7, 1.5, -3.6], 40], gallery: [[-0.6, 1.8, 0.6], [-2.2, 1.05, 2.95], 42],
    stand: [[1.5, 2.1, -2.1], [3.9, 1.9, -5.05], 40],
};
let H = null;
registerState("placesHearing", {
    hud: false, touch: false, pausable: true, world: false, skip: true,
    enter(data) {
        const c = caseById(data.id);
        H = { c, n: data.n, t: 0, C: null, cast: {}, seat: {}, extra: [], speaker: null, choices: [], done: false, flow: null, back: data.back };
        A.setMusic("../court.mp3");
        H.flow = runFlow(f => play(f));
    },
    exit() {
        if (!H) return;
        if (H.flow) H.flow.kill();
        closeDialog();
        const C = H.C;
        if (C) {
            for (const o of H.extra) C.set.scene.remove(o);
            C.me.obj.visible = true;
            for (const j of C.jurors) j.obj.visible = true;
            C.set.hide();
        }
        H = null;
    },
    update(dt, P) {
        if (!H) return;
        H.t += dt;
        if (H.flow) H.flow.tick(dt, P);
        if (!H || !H.C) return;
        animate(dt);
    },
});
function place(p, [x, y, z, r]) { p.obj.position.set(x, y, z); p.obj.rotation.y = r; return p; }
function addTo(C, p) { C.set.add(p.obj); H.extra.push(p.obj); return p; }
/** What a case's own hooks get: the set, the people, a few helpers. */
const api = () => ({ C: H.C, cast: H.cast, add: p => addTo(H.C, p), place, person, V3, shotOn, sfx: X });
async function play(f) {
    const C = H.C = await courtStage(), c = H.c;
    check(f);
    C.set.show();
    C.me.obj.visible = false;                         // (Lulu-in-the-dock: not today — she's in the gallery)
    for (const j of C.jurors) j.obj.visible = false;   // (no jury in 2B)
    for (const [k, m] of Object.entries(c.cast)) {
        const st = m.seat;
        H.seat[k] = Array.isArray(st) ? null : st;
        if (st === "judge") H.cast[k] = C.judge;
        else if (st === "bailiff") H.cast[k] = C.bailiff;
        else if (st === "respCounsel") H.cast[k] = C.prosecutor;
        else if (k === "lulu") { H.cast.lulu = addTo(C, place(lulu(false), SEAT.gallery)); H.cast.lulu.update(0.01, { sit: true }); }
        else if (m.model) H.cast[k] = addTo(C, place(person(m.model, m.colors || null, m.fallback || "npcMan"), Array.isArray(st) ? st : SEAT[st] || SEAT.gallery));
    }
    if (c.setup) c.setup(H, api());
    const hr = c.hearings[H.n];
    C.shot.set(V3(...SHOT.wide[0]), V3(...SHOT.wide[1]), SHOT.wide[2]).cut();
    await caption(f, c.title, hr.title);
    for (const s of hr.steps) await step(f, s);
    check(f);
    finish();
}
async function caption(f, big, small) {
    await dlgSay("COURTROOM 2B", `${big} — ${small}`, { emoji: "⚖️", color: "#4E342E", auto: 1.6 });
    check(f);
}
async function step(f, s) {
    check(f);
    if (Array.isArray(s)) return line(f, s[0], s[1]);
    if (s.do) return act(f, s.do);
    if (s.choose) {
        const c = s.choose, sp = H.c.cast[c.who] || H.c.cast.lulu;
        shotOn(c.who);
        const i = Math.max(0, await dlgChoose(sp.name, c.text, c.options.map(o => o.label), { emoji: sp.emoji, color: sp.color }));
        check(f);
        H.choices.push(i);
        if (c.echo !== false) await line(f, c.who, c.options[i].label.replace(/^\S+\s/, ""));
        for (const t of c.options[i].then || []) await step(f, t);
    }
}
async function line(f, who, text) {
    const sp = H.c.cast[who] || H.c.cast.judge;
    H.speaker = who;
    shotOn(who);
    X.blip(H.seat[who] === "judge" ? "judge" : "lulu");
    await dlgSay(sp.name, text, { emoji: sp.emoji, color: sp.color, auto: 0 });
    H.speaker = null;
    check(f);
}
function shotOn(who) {
    const C = H.C, own = H.c.shot && H.c.shot(who, H);
    if (own) { C.shot.set(V3(...own[0]), V3(...own[1]), own[2]); return; }
    const seat = who === "lulu" && H.onStand ? "stand" : H.seat[who];
    const s = SHOT[seat] || SHOT.wide;
    C.shot.set(V3(...s[0]), V3(...s[1]), s[2]);
}
async function act(f, what) {
    const C = H.C;
    if (typeof what === "function") return what(H, api());
    if (H.c.acts[what]) return H.c.acts[what](H, api());
    if (what === "gavel") { X.gavel(); if (C.gavel) H.gavelT = 0.45; return; }
    if (what === "luluToStand") { H.onStand = true; place(H.cast.lulu, SEAT.stand); H.cast.lulu.update(0.01, { sit: false }); return; }
    if (what === "luluToGallery") { H.onStand = false; place(H.cast.lulu, SEAT.gallery); H.cast.lulu.update(0.01, { sit: true }); return; }
}
function animate(dt) {
    const sp = H.speaker;
    for (const [k, p] of Object.entries(H.cast)) {
        if (!p || !p.update || (H.c.own && H.c.own.includes(k))) continue;     // (a case animates its own special ones)
        const seat = H.seat[k];
        p.update(dt, { talk: sp === k, sit: k === "lulu" ? !H.onStand : undefined,
            point: sp === k && (seat === "petCounsel" ? H.t % 3 < 1 : seat === "respCounsel" ? H.t % 4 < 1.5 : false) });
    }
    if (H.c.tick) H.c.tick(H, dt, api());
    if (H.C.gavel) { H.gavelT = Math.max(0, (H.gavelT || 0) - dt); const k = H.gavelT > 0 ? Math.sin((1 - H.gavelT / 0.45) * Math.PI) : 0; H.C.gavel.rotation.z = k; }
    H.C.shot.update(dt, 2.4);
}
/** The hearing is over (played or skipped): the case moves on (a day), back into the lobby. */
function finish() {
    if (!H || H.done) return;
    H.done = true;
    const c = H.c, p = progress(c);
    p.n = Math.max(p.n, H.n + 1);
    p.day = today();
    H.last = caseDone(c);
    saveSoon();
    try { if (c.done) c.done(H); } catch (e) { console.error("[places] case done", e); }
    emit("places:hearing", { id: c.id, n: H.n + 1, of: c.hearings.length, done: H.last });
    // (back into the lobby: its own soft cut — the lobby was warmed on the way in)
    const back = H.back;
    if (!(back && back())) setState("footRun", { resume: "interior" });
}
/** ✋ at 2B (the lobby): sit in on today's hearing of case c → bool. back() re-enters the lobby afterwards. */
export async function sitIn(c, back) {
    if (!c || !hearingToday(c)) return false;
    try {
        await courtStage();
        const keys = [...new Set(Object.values(c.cast).map(m => m.model).filter(Boolean).concat(c.models || []))];
        if (keys.length) await ensureModels(keys);
    } catch (e) { console.error("[places] court set", e); return false; }
    const go = () => setState("placesHearing", { id: c.id, n: progress(c).n, back });
    if (ctx.dissolve && !ctx.skipping) ctx.dissolve(go); else go();
    return true;
}
/** Warm the courtroom's models while she's in the lobby (the step through 2B is then a soft cut). */
export function warmCourt() { courtStage().catch(() => {}); }

// ── LAKEWOOD's case: In re: Baby Gitty (the words: shloime.js) ───────────
/** Where the baby is: in Shloime's arms (beside him), asleep on the bailiff's shoes, in the judge's arms. */
function babyTo(H, where) {
    const b = H.cast.gitty, C = H.C;
    H.baby.mode = where;
    b.obj.rotation.set(0, Math.PI, 0);
    if (where === "shloime") b.obj.position.set(-2.7, 0, -0.3);
    else if (where === "bailiff") { b.obj.position.set(-5.2, 0.12, -3.3); b.obj.rotation.set(-Math.PI / 2, Math.PI / 2, 0); }
    else if (where === "judge") b.obj.position.set(0.45, C.judge.obj.position.y + 0.55, -6.15);
}
addCase({
    id: "shloime", town: "lakewood", title: "IN RE: BABY GITTY", cast: CAST, hearings: HEARINGS,
    label: "⚖️ Sit in on the hearing (Shloime's case)", models: ["homesBaby"],
    docket: (c, p) => caseDone(c) ? "📋 2B — IN RE: BABY GITTY · CLOSED. ('They worked it out. ❤️' — handwritten, with a heart)"
        : `📋 2B — IN RE: BABY GITTY (Pollack v. Pollack) · hearing ${Math.min(p.n + 1, c.hearings.length)} of ${c.hearings.length}${hearingToday(c) ? " · TODAY — public welcome" : " · next session TOMORROW"}`,
    own: ["gitty"],
    setup(H, X) {
        H.baby = { mode: "shloime", cheerT: 0 };
        H.cast.gitty = X.add(person("homesBaby", null, "npcKid"));
        babyTo(H, H.n === 4 ? "judge" : "shloime");          // (the ruling: she's still in the judge's arms)
    },
    tick(H, dt) {
        H.baby.cheerT = Math.max(0, (H.baby.cheerT || 0) - dt);
        if (H.baby.mode === "bailiff") H.cast.gitty.update(dt, {});
        else H.cast.gitty.update(dt, { talk: H.speaker === "gitty", cheer: H.baby.cheerT > 0 });
    },
    shot(who, H) { if (who !== "gitty") return null; const b = H.cast.gitty.obj.position; return [[b.x + 0.9, b.y + 1.2, b.z - 1.8], [b.x, b.y + 0.4, b.z], 40]; },
    acts: {
        babyCheer: H => { H.baby.cheerT = 2.2; },
        babyThrow: H => { H.baby.cheerT = 1.2; X.blip("lulu"); },
        babyToBailiff: H => babyTo(H, "bailiff"),
        babyToJudge: H => babyTo(H, "judge"),
    },
    done(H) {
        emit("stat", { id: "shloimeHearings", n: 1 });
        if (H.last) emit("stat", { id: "shloimeCase", n: 1 });
    },
});
// ── after the case: Shloime around Lakewood, pushing the stroller ────────
const N = { p: null, baby: null, stroller: null, t: 0, sp: null, said: 0, cheerT: 0 };
function dropShloime() {
    for (const o of [N.p && N.p.obj, N.stroller, N.baby && N.baby.obj]) if (o && o.parent) o.parent.remove(o);
    N.p = N.baby = N.stroller = null; N.sp = null;
}
async function spawnShloime() {
    dropShloime();
    if (!caseDone() || !(ctx.town && ctx.town.active && ctx.town.id === "lakewood")) return;
    try { await ensureModels(["homesDad", "homesStreet", "homesBaby"]); } catch (e) { return; }
    if (!(ctx.town && ctx.town.active && ctx.town.id === "lakewood")) return;
    const sp = ctx.civic && ctx.civic.spot("court");
    if (!sp) return;
    N.sp = sp;
    N.p = person("homesDad", { Top: "#FFFFFF", Bottom: "#212121", Hair: "#3E2723" }, "npcMan");
    const src = models.homesStreet && findNodes(models.homesStreet, "Prop_Stroller")[0];
    if (src) { N.stroller = src.clone(true); N.stroller.position.set(0, 0, 0); ctx.scene.add(N.stroller);
        N.baby = person("homesBaby", null, "npcKid"); ctx.scene.add(N.baby.obj); }   // (Gitty, riding in it)
    ctx.scene.add(N.p.obj);
    N.t = 0;
}
const BABY_Y = 0.52;   // (the stroller's seat)
function tickShloime(dt) {
    if (!N.p || !N.sp) return;
    N.t += dt;
    const sp = N.sp, k = 6 + Math.sin(N.t * 0.18) * 3.5;        // up and down the sidewalk beside the courthouse door (never across it: ✋ there is the door)
    const x = sp.x + sp.ux * k + sp.nx * 0.8, z = sp.z + sp.uz * k + sp.nz * 0.8;
    const dir = Math.cos(N.t * 0.18) >= 0 ? 1 : -1, h = Math.atan2(sp.ux * dir, sp.uz * dir);
    N.p.obj.position.set(x, 0, z); N.p.obj.rotation.y = h;
    N.p.update(dt, { walk: 0.9 });
    if (N.stroller) { N.stroller.position.set(x + Math.sin(h) * 0.85, 0, z + Math.cos(h) * 0.85); N.stroller.rotation.y = h; }
    if (N.baby && N.stroller) {
        N.baby.obj.position.set(N.stroller.position.x, BABY_Y, N.stroller.position.z); N.baby.obj.rotation.y = h + Math.PI;   // (facing her Abba)
        N.cheerT = Math.max(0, N.cheerT - dt);
        N.baby.update(dt, { sit: true, cheer: N.cheerT > 0 });
    }
}
on("town:enter", () => { spawnShloime(); });
on("town:leave", () => dropShloime());
on("places:hearing", e => { if (e && e.done && e.id === "shloime") setTimeout(spawnShloime, 0); });
hook("hud", dt => { try { tickShloime(dt); } catch (e) { console.error("[places] shloime", e); } });
on("boot", () => {
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot({
        pos: () => (N.p && ctx.foot.active ? { x: N.p.obj.position.x, z: N.p.obj.position.z } : null), r: 2.2,
        label: () => "👶 TALK TO SHLOIME", short: "SHLOIME",
        act: () => {
            if (!N.p || !ctx.foot.bubble) return true;
            ctx.foot.bubble(N.p.obj, SHLOIME_AFTER[N.said % SHLOIME_AFTER.length], 3.4, { y: 2.1 });
            if (N.baby) setTimeout(() => { if (N.baby && ctx.foot.bubble) { N.cheerT = 2.2; ctx.foot.bubble(N.baby.obj, pick(BABY_AFTER), 2.2, { y: 0.9 }); } }, 900);   // (she waves)
            N.said++;
            emit("stat", { id: "shloimeChats", n: 1 });
            return true;
        },
    });
});

// a scrapbook badge for seeing the case through (3D-only; nothing pays)
BADGES.push({ id: "shloime", icon: "👶", name: "Friend of the Court", desc: "Sit in on all of Shloime's hearings in Lakewood", three: true,
    test: S => ((S.stats && S.stats.shloimeCase) || 0) >= 1 });

export const courtsDebug = {
    CS, D, H: () => H, N, CASES,
    /** A case's saved progress { n, day } (default: Shloime's). */
    P: (id = "shloime") => progress(caseById(id)),
    /** Make a hearing available now (as if it were the next day). */
    nextDay(id = "shloime") { progress(caseById(id)).day = ""; return true; },
    reset() { CS.cases = {}; CS.abba = 0; CS.abbaL = 0; saveSoon(); return true; },
};
