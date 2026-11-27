// features/family — 💜 AVIGAIL AT HOME + THE AVENUE M BALLROOM (roadmap 32 · stage C; the owner 2026-11-27: "Avigail pop ups
// shouldn't be a thing… a more willing way for the player to choose to have Avigail's house or wedding").
//
//   her house   a fixed door in Midwood: East 34th St between Avenue L and K (a block down from Lulu's, the same street).
//               Homes gives the door up (a claim); real estate never lists it (ctx.family.isFamily). She has a day like
//               any household (AV_DAY): mornings at the nail salon, afternoons home, Sunday shopping on Avenue J, evenings
//               at the hall, nights asleep, Shabbos at her parents'. ✋ at her door when she's home → the porch visit ON
//               HER REAL PORCH (cameos/avigail.js's randomized conversation), and she comes along: shotgun, 2× points, as
//               the roadside version did — at most ONCE A RUN (the roadside walker could come every 2–3 minutes). Not home →
//               the note on her door says where she is.
//   the hall    the Avenue M Ballroom (town data `uses.simchahall`, Lakewood's simcha-hall model). Its marquee says what's
//               on by the clock: Sun–Thu 6 pm – midnight "TONIGHT: AVIGAIL & AVIEL" — ✋ walks her in and the wedding plays
//               (foot/wedding.js, staged in the hall): the bouquet pays at most once a REAL day (40 caught / 15 missed, as
//               before); again the same day = the dancing only. Other hours: a vort, the caterer setting up, closed.
// No toasts, no banners, nothing random: she's only where she lives, and only when the player walks up.
import * as THREE from "three";
import { ctx, on, emit, addActor } from "../../core/ctx.js";
import { saveSoon } from "../../core/save.js";
import { models, ensureModels } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { say, choose } from "../../core/dialog.js";
import { when } from "../homes/life.js";
import { SAVE, log } from "./fayge.js";
import { ID } from "./data.js";

export const AV = { lx: 98, lz: 95, town: "midwood", key: "midwood:avigail" };
const DOORS = { town_duplex: [-2.8, 5.04], town_townhouses: [-3.9, 5.74], town_mw_house: [-2.15, 7.55], town_mw_rowhouse: [-3.6, 5.55] };
export const A = { home: null, her: null, t: 0, busy: false, ride: { pending: false, rode: false }, marquee: null, mq: "", force: {}, claimed: false };
const pick = a => a[Math.floor(Math.random() * a.length)];
function today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
const live = () => ctx.enabled(ID) && !!(ctx.town && ctx.town.active && ctx.town.id === AV.town) && !(ctx.G && ctx.G.mode === "dina") && !/^dina/.test(ctx.state || "");

// ── her day ──────────────────────────────────────────────────────────────
/** Where Avigail is: "home" | "salon" | "shopping" | "hall" | "asleep" | "parents" (Shabbos) | "busy" (erev Shabbos). */
export function avDay(w = when()) {
    if (A.force.where) return A.force.where;
    const h = w.hour, wd = w.wd;
    if (w.shabbos || w.yomtov) return "parents";
    if (h < 9) return "asleep";
    if (wd === 5) return h < 14 ? "home" : "busy";
    if (wd === 0) return h < 13 ? "home" : h < 14.5 ? "shopping" : h < 18 ? "home" : "hall";
    return h < 13.5 ? "salon" : h < 18 ? "home" : "hall";
}
/** The hall, by the clock: "wedding" (Sun–Thu 6 pm – midnight) | "vort" | "setup" | "closed". */
export function hallNow(w = when()) {
    if (A.force.hall) return A.force.hall;
    const h = w.hour, wd = w.wd;
    if (w.shabbos || w.yomtov || wd === 5 || wd === 6) return "closed";
    if (h >= 18) return "wedding";
    if (h >= 15) return "vort";
    if (h >= 9) return "setup";
    return "closed";
}
const NOTE = {
    salon: "A note on the door, in purple glitter pen: \"AT THE NAIL SALON. Back at 2. Don't touch my mailbox, Bruck. 💅\"",
    shopping: "A note: \"SHOPPING ON AVENUE J. If this is about the rugelach you owe me — I'm back at 2:30.\"",
    hall: "A note: \"AT THE BALLROOM ON AVENUE M. You know why. 💍 Come. DRESS NICE.\"",
    asleep: "Dark windows. A sign on the door: \"BEAUTY SLEEP IN PROGRESS. Come back after 9. This means YOU, Lulu.\"",
    parents: "Quiet. A note: \"At my parents' for Shabbos. Gut Shabbos, Bruck! 💜\"",
    busy: "Through the door: \"It's EREV SHABBOS, Lulu! I'm doing my NAILS and the KUGEL! At the SAME TIME!\"",
};
const HALL_LINE = {
    vort: "🥂 A vort inside: forty people, one cake, a lot of \"mazel tov\". Not tonight's party — come back after 6.",
    setup: "🍽️ The caterer's setting up for tonight: \"Don't touch the centrepieces. DON'T. TOUCH.\" Come back at 6.",
    closed: "🔒 The Avenue M Ballroom is dark. A sign: \"CLOSED. Even ballrooms need a rest.\"",
};
const MARQUEE = { wedding: "TONIGHT\nAVIGAIL & AVIEL 💍", vort: "THIS AFTERNOON\nA VORT · MAZEL TOV!", setup: "TONIGHT\nAVIGAIL & AVIEL 💍", closed: "MAZEL TOV\nTO ALL OUR SIMCHAS" };

// ── her door (the town's house nearest AV.lx/lz): homes gives it up, real estate never lists it ──
function findHome() {
    const T = ctx.town, P = T && T.plan;
    if (!T || !P || !T.homes) return null;
    const at = P.world(AV.lx, AV.lz, {});
    let best = null, bd = 30;
    for (const h of T.homes) { if (!DOORS[h.key]) continue; const d = Math.hypot(h.x - at.x, h.z - at.z); if (d < bd) { bd = d; best = h; } }
    if (!best) return null;
    const [dx, dz] = DOORS[best.key];
    const door = { x: best.x - best.ux * dx + best.nx * dz, z: best.z - best.uz * dx + best.nz * dz };
    const t2 = (door.x - best.lotX) * best.ux + (door.z - best.lotZ) * best.uz;
    const lot = { x: best.lotX + best.ux * t2, z: best.lotZ + best.uz * t2 };
    const ap = { x: lot.x + best.nx * 0.7, z: lot.z + best.nz * 0.7 };
    const L = P.local(door.x, door.z, {});
    return { id: `${T.def.id}:${Math.round(L.x)}:${Math.round(L.z)}`, door, ap, lot, nx: best.nx, nz: best.nz, ux: best.ux, uz: best.uz, model: best.key };
}
export function isAvigails(x, z) { const h = A.home; return !!h && live() && (Math.hypot(h.door.x - x, h.door.z - z) < 3 || Math.hypot(h.ap.x - x, h.ap.z - z) < 3); }

// ── ✋ at her door ───────────────────────────────────────────────────────
const doorSpot = {
    r: 2.4, short: "AVIGAIL",
    pos() {
        const h = A.home;
        if (!live() || !h || A.busy || !ctx.foot || !ctx.foot.pos) return null;
        return Math.hypot(h.ap.x - ctx.foot.pos.x, h.ap.z - ctx.foot.pos.z) < 2.4 ? { x: h.ap.x, z: h.ap.z } : null;
    },
    label: () => (avDay() === "home" ? "💜 AVIGAIL'S — KNOCK" : "💜 AVIGAIL'S"),
    act() { porch().catch(e => { console.error("[family] avigail", e); A.busy = false; }); },
};
function hold(face) {
    const st = { done: false };
    const ok = ctx.foot.script({
        update(dt, P, F) { if (F.lulu) { F.lulu.face(face.x, face.z, dt, 8); F.lulu.update(dt, { walk: 0, talk: ctx.dialogOpen }); } if (A.her) A.her.update(dt, { talk: ctx.dialogOpen }); return !st.done; },
        abort() { st.done = true; },
    });
    return ok ? st : null;
}
const AVI = { emoji: "💅", color: "#6A1B9A" };
const EXPR = { suspicious: "🤨", annoyed: "😒", dramatic: "😩", smug: "😏", panic: "😱", love: "🥰", excited: "🤩" };
/** The porch visit at her real door: the randomized conversation, then (once a run) she comes along. */
export async function porch() {
    const h = A.home;
    if (!h || A.busy) return false;
    const st = hold(h.door);
    if (!st) return false;
    A.busy = true;
    try {
        const where = avDay();
        await say("Lulu", "Knock knock! I KNOW you're home, Avigail.", { emoji: "💁‍♀️" });
        if (st.done) return true;
        if (where !== "home") { await say("🚪", NOTE[where] || NOTE.salon, { emoji: "📝" }); log("avigail:note", { where }); return true; }
        const CA = await import("../cameos/avigail.js");
        try { await ensureModels(["avigailPerson"]); } catch (e) { /* */ }
        if (models.avigailPerson) {
            const p = spawnPerson("avigailPerson");
            p.obj.position.set(h.ap.x - h.nx * 1.1, 0, h.ap.z - h.nz * 1.1);
            p.obj.rotation.y = Math.atan2(h.nx, h.nz);
            ctx.scene.add(p.obj); A.her = p;
        }
        const script = CA.buildAvigailScript();
        let rugelach = false;
        for (const step of script) {
            const k = await choose("Avigail", step.prompt, step.choices.map(c => c.label), Object.assign({}, AVI, { emoji: EXPR[step.expr] }));
            if (st.done || k < 0) return true;
            const ch = step.choices[k];
            if (step.isOpener && k === step.rugelachIdx) rugelach = true;
            await say("Avigail", ch.reply, Object.assign({}, AVI, { emoji: EXPR[ch.expr] }));
            if (st.done) return true;
        }
        // the meter thaws (quietly) — once a real day from her porch
        if (SAVE.avPorch !== today()) { SAVE.avPorch = today(); saveSoon(); CA.bump(6 + (rugelach ? 4 : 0), { quiet: true }); }
        if (A.ride.rode) {
            await say("Avigail", "We ALREADY rode today, Bruck. My nails need a REST. Tomorrow. Bring rugelach.", Object.assign({}, AVI, { emoji: EXPR.smug }));
        } else {
            await say("Avigail", "Okay LET'S GO. I'm calling shotgun. I'll be in your car before you are. 💅", Object.assign({}, AVI, { emoji: EXPR.excited }));
            A.ride.pending = true;
        }
        log("avigail:porch", { rugelach, ride: A.ride.pending });
        return true;
    } finally {
        st.done = true; A.busy = false;
        if (A.her && A.her.obj.parent) A.her.obj.parent.remove(A.her.obj);
        A.her = null;
    }
}
/** Back in her car with Avigail waiting: shotgun, 2× points — cameos' ride, once a run. */
async function maybeRide() {
    if (!A.ride.pending || A.ride.rode || ctx.state !== "playing") return;
    const CA = await import("../cameos/avigail.js");
    try { await ensureModels(["avigailPerson"]); } catch (e) { return; }
    if (ctx.state !== "playing") return;
    A.ride.pending = false; A.ride.rode = true;
    CA.startRide();
    try { if (ctx.banter && ctx.banter.say) ctx.banter.say("Avigail's riding shotgun. 2× points. Don't touch the aux."); } catch (e) { /* */ }
    log("avigail:ride", {});
}

// ── the hall ─────────────────────────────────────────────────────────────
const hallSpot = {
    r: 3.2, short: "HALL",
    pos() {
        if (!live() || A.busy || !ctx.foot || !ctx.foot.pos) return null;
        const sp = ctx.town.spot && ctx.town.spot("simchaHall");
        if (!sp) return null;
        return Math.hypot(sp.x - ctx.foot.pos.x, sp.z - ctx.foot.pos.z) < 3.2 ? { x: sp.x, z: sp.z } : null;
    },
    label: () => (hallNow() === "wedding" ? "💍 THE BALLROOM — AVIGAIL'S WEDDING (GO IN)" : "🎉 THE AVENUE M BALLROOM"),
    act() { hall().catch(e => { console.error("[family] hall", e); A.busy = false; }); },
};
export async function hall() {
    if (A.busy) return false;
    const now = hallNow();
    if (now !== "wedding") { A.busy = true; try { await say("🎉", HALL_LINE[now], { emoji: "🎉" }); } finally { A.busy = false; } log("hall:peek", { now }); return true; }
    const paidToday = SAVE.bouquet === today();
    const ok = ctx.foot && ctx.foot.wedding && ctx.foot.wedding({
        hall: true,
        paid: () => { if (SAVE.bouquet === today()) return false; SAVE.bouquet = today(); saveSoon(); return true; },
    });
    log("hall:wedding", { ok: !!ok, paidToday });
    return !!ok;
}
function drawMarquee() {
    const sp = ctx.town && ctx.town.spot && ctx.town.spot("simchaHall");
    const text = MARQUEE[hallNow()];
    if (!sp) return;
    if (A.marquee && A.mq === text) return;
    dropMarquee();
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 192;
    const g = cv.getContext("2d");
    g.fillStyle = "#1B1B1B"; g.fillRect(0, 0, 512, 192); g.strokeStyle = "#E8C766"; g.lineWidth = 8; g.strokeRect(6, 6, 500, 180);
    g.fillStyle = "#F8BBD0"; g.textAlign = "center"; g.textBaseline = "middle";
    const [a, b] = text.split("\n");
    g.font = "bold 44px sans-serif"; g.fillText(a, 256, 62); g.fillStyle = "#FFFFFF"; g.font = "bold 50px sans-serif"; g.fillText(b, 256, 132);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex }), geo = new THREE.PlaneGeometry(2.6, 0.98);
    const m = new THREE.Mesh(geo, mat);
    const nx = sp.nx != null ? sp.nx : 0, nz = sp.nz != null ? sp.nz : 1, ux = sp.ux != null ? sp.ux : nz, uz = sp.uz != null ? sp.uz : -nx;
    m.position.set(sp.x + ux * 3.2 - nx * 0.6, 1.5, sp.z + uz * 3.2 - nz * 0.6); m.rotation.y = Math.atan2(nx, nz);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.08), new THREE.MeshStandardMaterial({ color: "#D4AF37" }));
    post.position.set(0, -0.95, 0); m.add(post);
    ctx.scene.add(m);
    A.marquee = { m, own: [tex, mat, geo, post.geometry, post.material] }; A.mq = text;
}
function dropMarquee() { if (!A.marquee) return; if (A.marquee.m.parent) A.marquee.m.parent.remove(A.marquee.m); for (const o of A.marquee.own) o.dispose(); A.marquee = null; A.mq = ""; }

// ── wiring ───────────────────────────────────────────────────────────────
export function initAvigail() {
    if (ctx.foot && ctx.foot.addSpot) { ctx.foot.addSpot(doorSpot); ctx.foot.addSpot(hallSpot); }
    if (ctx.homes && ctx.homes.claim && !A.claimed) { A.claimed = true; ctx.homes.claim(id => (A.home && id === A.home.id && live() ? "avigail" : null)); }
}
on("town:enter", () => {
    if (!ctx.enabled(ID) || !ctx.town || ctx.town.id !== AV.town) return;
    A.home = findHome();
    if (ctx.homes && ctx.homes.refresh) ctx.homes.refresh();
    ensureModels(["avigailPerson"]).catch(() => { });
    if (!A.on) { A.on = true; addActor({ foot: true, update: dt => { A.t += dt; try { if (live() && (A.t % 2 < dt || !A.marquee)) drawMarquee(); if (!live() && A.marquee) dropMarquee(); } catch (e) { console.error("[family] marquee", e); } return A.on; }, dispose() { A.on = false; } }); }
});
on("town:leave", () => { dropMarquee(); A.home = null; });
on("run:start", () => { A.ride.pending = false; A.ride.rode = false; });
on("foot:end", () => { setTimeout(() => { maybeRide().catch(() => { }); }, 600); });
on("state", () => { if (A.ride.pending) maybeRide().catch(() => { }); });
