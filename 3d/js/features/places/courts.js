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

/** Saved: how far Shloime's case has got (0–5) + the local day the last hearing was seen; Abba's line rotation. */
export const CS = store("courts", { shloime: 0, day: "", abba: 0, abbaL: 0 });
const pick = a => a[Math.floor(Math.random() * a.length)];
const party = () => !!(ctx.party && ctx.party.active);
/** Today's local date (a hearing a REAL day). Tests can pin it: courts.debug.today = "2026-11-21". */
const D = { today: null };
export const today = () => D.today || (() => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; })();
export const caseDone = () => CS.shloime >= HEARINGS.length;
/** Is a hearing on in 2B today (Lakewood, solo, not already seen today, the case not over)? */
export const hearingToday = () => !caseDone() && CS.day !== today() && !party();
/** The town the courtroom is in right now (a trial: where she was taken; walking in: the town she's in). */
function courtTown() { const P = ctx.civic && ctx.civic.place; return (P && P.id) || (ctx.town && ctx.town.active && ctx.town.id) || null; }

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
    };
}

// ── Lakewood: the hearing (a spectator scene on the courtroom set) ───────
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const SHOT = {
    wide: [[0, 4.6, 10.5], [0, 1.9, -3.0], 50], judge: [[0.9, 2.25, -2.0], [0, 2.85, -6.6], 38],
    shloime: [[-2.1, 1.75, -3.1], [-3.25, 1.3, -0.35], 40], fishbein: [[-0.8, 1.75, -3.1], [-1.95, 1.35, -0.35], 40],
    adler: [[2.1, 1.75, -3.1], [3.25, 1.35, -0.35], 40], malky: [[0.9, 1.75, -3.1], [1.95, 1.3, -0.35], 40],
    bailiff: [[-3.3, 1.9, -1.4], [-5.7, 1.5, -3.6], 40], lulu: [[-0.6, 1.8, 0.6], [-2.2, 1.05, 2.95], 42],
    stand: [[1.5, 2.1, -2.1], [3.9, 1.9, -5.05], 40],
};
const GALLERY = [-2.2, 0.07, 2.95, Math.PI], STAND = [3.9, 0.3, -5.05, -Math.PI / 4];
let H = null;
registerState("placesHearing", {
    hud: false, touch: false, pausable: true, world: false, skip: true,
    enter(data) {
        H = { n: data.n, t: 0, C: null, cast: {}, extra: [], speaker: null, baby: { mode: "shloime", t: 0 }, done: false, flow: null, back: data.back };
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
async function play(f) {
    const C = H.C = await courtStage();
    check(f);
    C.set.show();
    C.me.obj.visible = false;                         // (Lulu-in-the-dock: not today — she's in the gallery)
    for (const j of C.jurors) j.obj.visible = false;   // (family court: no jury)
    const cast = H.cast;
    cast.shloime = addTo(C, place(person("homesDad", { Top: "#FFFFFF", Bottom: "#212121", Hair: "#3E2723" }, "npcMan"), [-3.25, 0, -0.35, Math.PI]));
    cast.fishbein = addTo(C, place(person("lawLawyer", { Top: "#8D6E63", Hair: "#BDBDBD" }, "npcMan"), [-1.95, 0, -0.35, Math.PI]));
    cast.malky = addTo(C, place(person("homesMom", { Top: "#AD1457", Hair: "#4E342E" }, "npcWoman"), [1.95, 0, -0.35, Math.PI]));
    cast.adler = C.prosecutor;
    cast.judge = C.judge; cast.bailiff = C.bailiff;
    cast.gitty = addTo(C, person("homesBaby", null, "npcKid"));
    cast.lulu = addTo(C, place(lulu(false), GALLERY));
    cast.lulu.update(0.01, { sit: true });
    babyTo(H.n === 4 ? "judge" : "shloime");          // (the ruling: she's still in the judge's arms)
    const hr = HEARINGS[H.n];
    C.shot.set(V3(...SHOT.wide[0]), V3(...SHOT.wide[1]), SHOT.wide[2]).cut();
    await caption(f, "IN RE: BABY GITTY", hr.title);
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
        const c = s.choose, sp = CAST[c.who];
        shotOn(c.who);
        const i = Math.max(0, await dlgChoose(sp.name, c.text, c.options.map(o => o.label), { emoji: sp.emoji, color: sp.color }));
        check(f);
        H.choice = i;
        await line(f, "lulu", c.options[i].label.replace(/^\S+\s/, ""));
        for (const t of c.options[i].then || []) await line(f, t[0], t[1]);
    }
}
async function line(f, who, text) {
    const sp = CAST[who] || CAST.judge;
    H.speaker = who;
    shotOn(who);
    X.blip(who === "judge" ? "judge" : "lulu");
    await dlgSay(sp.name, text, { emoji: sp.emoji, color: sp.color, auto: 0 });
    H.speaker = null;
    check(f);
}
function shotOn(who) {
    const C = H.C;
    if (who === "gitty") { const b = H.cast.gitty.obj.position; C.shot.set(V3(b.x + 0.9, b.y + 1.2, b.z - 1.8), V3(b.x, b.y + 0.4, b.z), 40); return; }
    const s = who === "lulu" ? (H.onStand ? SHOT.stand : SHOT.lulu) : SHOT[who] || SHOT.wide;
    C.shot.set(V3(...s[0]), V3(...s[1]), s[2]);
}
/** Where the baby is: in Shloime's arms (beside him), asleep on the bailiff's shoes, in the judge's arms. */
function babyTo(where) {
    const b = H.cast.gitty, C = H.C;
    H.baby.mode = where;
    b.obj.rotation.set(0, Math.PI, 0);
    if (where === "shloime") b.obj.position.set(-2.7, 0, -0.3);
    else if (where === "bailiff") { b.obj.position.set(-5.2, 0.12, -3.3); b.obj.rotation.set(-Math.PI / 2, Math.PI / 2, 0); }
    else if (where === "judge") b.obj.position.set(0.45, C.judge.obj.position.y + 0.55, -6.15);
}
async function act(f, what) {
    const C = H.C;
    if (what === "gavel") { X.gavel(); if (C.gavel) H.gavelT = 0.45; return; }
    if (what === "babyCheer") { H.baby.cheerT = 2.2; return; }
    if (what === "babyThrow") { H.baby.cheerT = 1.2; X.blip("lulu"); return; }
    if (what === "babyToBailiff") { babyTo("bailiff"); return; }
    if (what === "babyToJudge") { babyTo("judge"); return; }
    if (what === "luluToStand") { H.onStand = true; place(H.cast.lulu, STAND); H.cast.lulu.update(0.01, { sit: false }); return; }
    if (what === "luluToGallery") { H.onStand = false; place(H.cast.lulu, GALLERY); H.cast.lulu.update(0.01, { sit: true }); return; }
}
function animate(dt) {
    const c = H.cast, sp = H.speaker;
    for (const k of ["shloime", "fishbein", "malky"]) if (c[k]) c[k].update(dt, { talk: sp === k, point: sp === k && k === "fishbein" && H.t % 3 < 1 });
    c.adler.update(dt, { talk: sp === "adler", point: sp === "adler" && H.t % 4 < 1.5 });
    c.judge.update(dt, { talk: sp === "judge" });
    c.bailiff.update(dt, { talk: sp === "bailiff" });
    c.lulu.update(dt, { talk: sp === "lulu", sit: !H.onStand });
    H.baby.cheerT = Math.max(0, (H.baby.cheerT || 0) - dt);
    if (H.baby.mode === "bailiff") c.gitty.update(dt, {});
    else c.gitty.update(dt, { talk: sp === "gitty", cheer: H.baby.cheerT > 0 });
    if (H.C.gavel) { H.gavelT = Math.max(0, (H.gavelT || 0) - dt); const k = H.gavelT > 0 ? Math.sin((1 - H.gavelT / 0.45) * Math.PI) : 0; H.C.gavel.rotation.z = k; }
    H.C.shot.update(dt, 2.4);
}
/** The hearing is over (played or skipped): the case moves on a day, back into the lobby. */
function finish() {
    if (!H || H.done) return;
    H.done = true;
    CS.shloime = Math.max(CS.shloime, H.n + 1);
    CS.day = today();
    saveSoon();
    emit("places:hearing", { n: H.n + 1, of: HEARINGS.length, done: caseDone() });
    emit("stat", { id: "shloimeHearings", n: 1 });
    if (caseDone()) emit("stat", { id: "shloimeCase", n: 1 });
    // (back into the lobby: its own soft cut — the lobby was warmed on the way in)
    const back = H.back;
    if (!(back && back())) setState("footRun", { resume: "interior" });
}
/** ✋ "Sit in on the hearing" (the Lakewood lobby): → bool. back() re-enters the lobby afterwards. */
export async function sitIn(back) {
    if (!hearingToday()) return false;
    try { await courtStage(); } catch (e) { console.error("[places] court set", e); return false; }
    const go = () => setState("placesHearing", { n: CS.shloime, back });
    if (ctx.dissolve && !ctx.skipping) ctx.dissolve(go); else go();
    return true;
}
/** Warm the courtroom's models while she's in the Lakewood lobby (the step through 2B is then a soft cut). */
export function warmCourt() { courtStage().catch(() => {}); }

// ── after the case: Shloime around Lakewood, pushing the stroller ────────
const N = { p: null, baby: null, stroller: null, t: 0, sp: null, said: 0 };
function dropShloime() {
    for (const o of [N.p && N.p.obj, N.stroller]) if (o && o.parent) o.parent.remove(o);
    N.p = N.baby = N.stroller = null; N.sp = null;
}
async function spawnShloime() {
    dropShloime();
    if (!caseDone() || !(ctx.town && ctx.town.active && ctx.town.id === "lakewood")) return;
    try { await ensureModels(["homesDad", "homesStreet"]); } catch (e) { return; }
    if (!(ctx.town && ctx.town.active && ctx.town.id === "lakewood")) return;
    const sp = ctx.civic && ctx.civic.spot("court");
    if (!sp) return;
    N.sp = sp;
    N.p = person("homesDad", { Top: "#FFFFFF", Bottom: "#212121", Hair: "#3E2723" }, "npcMan");
    const src = models.homesStreet && findNodes(models.homesStreet, "Prop_Stroller")[0];
    if (src) { N.stroller = src.clone(true); N.stroller.position.set(0, 0, 0); ctx.scene.add(N.stroller); }
    ctx.scene.add(N.p.obj);
    N.t = 0;
}
function tickShloime(dt) {
    if (!N.p || !N.sp) return;
    N.t += dt;
    const sp = N.sp, k = 6 + Math.sin(N.t * 0.18) * 3.5;        // up and down the sidewalk beside the courthouse door (never across it: ✋ there is the door)
    const x = sp.x + sp.ux * k + sp.nx * 0.8, z = sp.z + sp.uz * k + sp.nz * 0.8;
    const dir = Math.cos(N.t * 0.18) >= 0 ? 1 : -1, h = Math.atan2(sp.ux * dir, sp.uz * dir);
    N.p.obj.position.set(x, 0, z); N.p.obj.rotation.y = h;
    N.p.update(dt, { walk: 0.9 });
    if (N.stroller) { N.stroller.position.set(x + Math.sin(h) * 0.85, 0, z + Math.cos(h) * 0.85); N.stroller.rotation.y = h; }
}
on("town:enter", () => { spawnShloime(); });
on("town:leave", () => dropShloime());
on("places:hearing", e => { if (e && e.done) setTimeout(spawnShloime, 0); });
hook("hud", dt => { try { tickShloime(dt); } catch (e) { console.error("[places] shloime", e); } });
on("boot", () => {
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot({
        pos: () => (N.p && ctx.foot.active ? { x: N.p.obj.position.x, z: N.p.obj.position.z } : null), r: 2.2,
        label: () => "👶 TALK TO SHLOIME", short: "SHLOIME",
        act: () => {
            if (!N.p || !ctx.foot.bubble) return true;
            ctx.foot.bubble(N.p.obj, SHLOIME_AFTER[N.said % SHLOIME_AFTER.length], 3.4, { y: 2.1 });
            if (N.stroller) setTimeout(() => { if (N.stroller && ctx.foot.bubble) ctx.foot.bubble(N.stroller, pick(BABY_AFTER), 2.2, { y: 1.2 }); }, 900);
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
    CS, D, H: () => H, N,
    /** Make a hearing available now (as if it were the next day). */
    nextDay() { CS.day = ""; return true; },
    reset() { CS.shloime = 0; CS.day = ""; CS.abba = 0; CS.abbaL = 0; saveSoon(); return true; },
};
