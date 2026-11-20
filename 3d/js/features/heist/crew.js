// features/heist — 💰 THE BANK JOB WITH FRIENDS (a 🎉 party's 🌍 Free Roam; ci/bankfriends stage 3). Opt-in, cartoon only.
//
//   1. PLAN IT: in the bank's lobby (a room friends share — features/together) ✋ at the vault → "💰 Plan a job with the
//      crew" + a plan (🤫 / 🏎️ / 🚀, the solo plans). That friend is the LEADER; an INVITATION is open for INVITE_S:
//      friends in the lobby see "💰 Join <leader>'s job" at the vault — nobody is dragged in (no warp, no hold).
//      Joining needs your OWN heist rules to allow it (one heist a run, HEIST.cooldownMin minutes between — job.js).
//   2. THE ROLES (by crew size, in join order): 🔓 THE VAULT (the leader: crack it at the vault door) · 🗣️ THE TALKER
//      (distract the teller with a ridiculous story) · 🏎️ THE DRIVER (out to your car and pull up at the kerb) ·
//      👀 THE LOOKOUT (keep watch at the door). Each is one ✋ in the lobby (or the kerb, for the driver).
//   3. THE ALARM: once every role is done (or ROLES_S runs out) — confetti, Bubbe's hearing-aid alarm — the crew is out
//      the door and it's a GETAWAY: each friend's own law (personal in a party) chases them with the plan's heat
//      (law.startChase in a car; a cop on foot if they're still walking); stun nets / spike strips as usual. Friends can
//      pile into one car (ride.js: one passenger) — a passenger shares the driver's fate.
//   4. THE RESULT, per friend, from their own screen: shook them (cop:chase escaped / disguise / talked out) = "ok";
//      law:arrest = "busted" (in a town: the precinct, and out of its front door — features/places). A passenger gets
//      the driver's result.
//   5. THE TAKE: the leader works it out ONCE with the solo formula (the town's base × the plan × bags kept + heat) and
//      asks the party's HOST (`hjo`): a new job id, members only, ≤ MAX_TAKE, each friend ≤ 1 paying job a session →
//      the shares (`hja`, host-only): the take SPLIT among the friends who got away (never multiplied); caught = 0. Every
//      crew member's own heist cooldown + one-a-run are spent (they took part).
// Fair: nobody risks coins they didn't opt into; a leaver never traps the rest (the leader leaving calls it off for
// everyone — their chases stay their own, no pay); strangers are never part of it (only party members, only in the
// shared lobby). Wire (existing relay protocol): the leader's d.x.hj; broadcasts hjin (join) · hjd (a role done) · hjx (my
// result) · hja (host: the shares); reliable hjo (leader → host).
import { ctx, on, emit, hook } from "../../core/ctx.js";
import { addCoins } from "../../core/driving.js";
import { saveSoon } from "../../core/save.js";
import * as H from "../../hud.js";
import { HEIST, PLANS, JOB } from "./data.js";
import { J, S as JS, blocked } from "./job.js";
import { current } from "../interiors/engine.js";
import { setChip, setBeacon, sfx, confetti, stat, inParty, partyFree, inTown, onFoot, luluSays, pick, fmtM, distTo } from "./common.js";

const INVITE_S = ctx.TEST ? 40 : 20;       // the invitation stays open this long (party seconds; a crawling ?test page gets longer)
const ROLES_S = ctx.TEST ? 120 : 45;       // …and the inside part, before the alarm goes anyway
const RESULT_S = 420;                      // a getaway with no result after this long: the job's off for whoever hasn't reported
export const MAX_TAKE = Math.round((Math.max(...Object.values(HEIST.base)) * Math.max(...PLANS.map(p => p.mul)) + HEIST.heatBonus * 5) / 5) * 5;
const ORDER = ["vault", "talker", "driver", "lookout"];
export const ROLE = {
    vault: { emoji: "🔓", name: "THE VAULT", task: "crack the vault (at the vault door)" },
    talker: { emoji: "🗣️", name: "THE TALKER", task: "distract the teller (at the window)" },
    driver: { emoji: "🏎️", name: "THE DRIVER", task: "get your car and pull up out front" },
    lookout: { emoji: "👀", name: "THE LOOKOUT", task: "keep watch at the door" },
};
const STORIES = ["My cousin's goat ate my bank card. The WHOLE card. Do you have a goat form?",
    "I need to open an account for my pet rock. He's very responsible. Never spends anything.",
    "Is it true the vault is haunted? My Bubbe says a ghost withdraws exactly $3 every Tuesday.",
    "Can I pay in kugel? It's a family recipe. It's VERY valuable. Ask anyone in Lakewood."];
const CRACK = ["*click*… *click*…", "Left… left… RIGHT… a little more…", "*CLUNK!* It's open! Nobody breathe."];

const C = { lead: null, mine: null, paid: new Set(), host: { seen: new Set(), n: new Map() }, sent: "", sendT: 0 };
// C.lead (I'm the leader): { id, plan, town, ph: "in" | "inside" | "getaway" | "done", until, crew: [uid], roles: {uid: role}, done: {role: 1}, res: {uid: "ok" | "busted" | "gone"} }
// C.mine (I'm in a crew, leader or not): { leader, id, role, ph, result, chased, startAt }

const me = () => (ctx.party ? ctx.party.uid : "");
const now = () => (ctx.party ? ctx.party.clock() : 0);
const members = () => (ctx.party && ctx.party.active ? ctx.party.members() : []);
const fresh = p => !!p && ctx.party.fresh(p, 8000);
const name = u => (ctx.party ? ctx.party.displayName(u) : "a friend");
const roam = () => inParty() && partyFree() && !!(ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());

/** A crew job someone's leading (as this screen sees it): { leader, a } (a = their d.x.hj) — or null. */
function crewOn() {
    if (C.lead) return { leader: me(), a: pubArr() };
    for (const u of members()) {
        if (u === me()) continue;
        const p = ctx.party.peer(u), a = p && p.x && Array.isArray(p.x.hj) ? p.x.hj : null;
        if (a && fresh(p) && a[1] !== "done") return { leader: u, a };
    }
    return null;
}
/** The leader's job, published: [id, ph, plan, town, crew csv, roles csv, done csv, results csv, until (party ms)]. */
function pubArr() {
    const L = C.lead;
    if (!L) return null;
    return [L.id, L.ph, L.plan, L.town, L.crew.join(","), L.crew.map(u => L.roles[u] || "").join(","), Object.keys(L.done).join(","),
        L.crew.map(u => L.res[u] || "").join(","), Math.round(L.until)];
}
const parse = a => ({ id: a[0], ph: a[1], plan: PLANS.find(p => p.id === a[2]) || PLANS[1], town: a[3], crew: String(a[4] || "").split(",").filter(Boolean),
    roles: String(a[5] || "").split(","), done: String(a[6] || "").split(",").filter(Boolean), res: String(a[7] || "").split(","), until: +a[8] || 0 });

// ── the vault in a party (bank.js asks): what the ✋ there does ─────────────────────────
/** The vault hotspot's label with friends. */
export function vaultLabel() {
    const on = crewOn();
    if (!on) return "💰 Plan a job with the crew";
    const j = parse(on.a);
    if (j.ph === "in" && !j.crew.includes(me())) return `💰 Join ${name(on.leader)}'s job (${j.crew.length}/4)`;
    if (j.ph === "in" && on.leader === me()) return j.crew.length > 1 ? `▶ Go now (${j.crew.length} in the crew)` : "💰 Waiting for the crew…";
    const my = C.mine && C.mine.role;
    if (j.ph === "inside" && my === "vault") return "🔓 Crack the vault";
    return "🔒 The vault";
}
/** ✋ at the vault with friends. rt = the bank's Room. */
export async function vaultAct(rt) {
    const on = crewOn();
    if (!on) {
        const why = blocked();
        if (why) { await rt.say("Lulu", why, { emoji: "⏳" }); return; }
        if (!roam()) { await rt.say("Lulu", "Not now — not in the middle of a game.", { emoji: "⏳" }); return; }
        const opts = PLANS.map(p => `${p.emoji} ${p.name} <small>(${p.blurb})</small>`).concat(["😇 Nah"]);
        const i = await rt.choose("The crew's plan", "A job — WITH the crew? Friends in the lobby can hop in (nobody has to).", opts, { emoji: "💰", color: "#2E7D32" });
        if (rt.disposed || i < 0 || i >= PLANS.length) return;
        lead(PLANS[i].id);
        return;
    }
    const j = parse(on.a);
    if (j.ph === "in" && !j.crew.includes(me())) {
        const why = blocked();
        if (why) { await rt.say("Lulu", why, { emoji: "⏳" }); return; }
        if (j.crew.length >= 4) { await rt.say("Lulu", "Four's a crew. Five's a parade.", { emoji: "🙅‍♀️" }); return; }
        ctx.party.broadcast("hjin", on.leader, j.id);
        C.mine = { leader: on.leader, id: j.id, role: "", ph: "in", result: "", chased: false, startAt: 0 };
        H.toast(`✅ You're in ${name(on.leader)}'s crew — roles at GO`, "gold", { key: "heist:crew" });
        sfx.pop();
        return;
    }
    if (j.ph === "in" && on.leader === me()) { if (j.crew.length > 1) launch(); return; }
    if (j.ph === "inside" && C.mine && C.mine.role === "vault" && !j.done.includes("vault")) {
        rt.data.open = true;
        for (const l of CRACK) { await rt.say("Lulu", l, { emoji: "🔓", color: "#2E7D32" }); if (rt.disposed) return; }
        roleDone("vault");
        return;
    }
    await rt.say("Lulu", "Nice vault. Very… vaulty.", { emoji: "🔒" });
}
/** The other roles' ✋ in the lobby: "talker" at the window, "lookout" at the door (bank.js adds the hotspots). */
export function roleLabel(role) {
    const m = C.mine, on = crewOn();
    if (!m || !on || m.role !== role) return null;
    const j = parse(on.a);
    if (j.ph !== "inside" || j.done.includes(role)) return null;
    return role === "talker" ? "🗣️ Distract the teller" : role === "lookout" ? "👀 Keep watch" : null;
}
export async function roleAct(rt, role) {
    if (!roleLabel(role)) return;
    if (role === "talker") {
        await rt.say("Lulu", pick(STORIES), { emoji: "🗣️", color: "#E91E63" });
        if (rt.disposed) return;
        await rt.say("The Teller", pick(["…A GOAT form?", "Ma'am. Ma'am. MA'AM.", "Let me get my manager. And a glass of water.", "Is… is the rock here with you?"]), { emoji: "🏦" });
    } else {
        await rt.say("Lulu", pick(["All clear. Unless that's a cop. No — a mailman. All clear.", "👀 Eyes on the street. Nobody move. Except you guys. Move.", "Lookout reporting: one pigeon, suspicious."]), { emoji: "👀" });
    }
    roleDone(role);
}

// ── the leader ───────────────────────────────────────────────────────────────────────────
function lead(planId) {
    C.lead = { id: 1 + Math.floor(Math.random() * 1e6), plan: planId, town: ctx.town ? ctx.town.id : "", ph: "in", until: now() + INVITE_S * 1000,
        crew: [me()], roles: {}, done: {}, res: {} };
    C.mine = { leader: me(), id: C.lead.id, role: "", ph: "in", result: "", chased: false, startAt: 0 };
    H.toast(`💰 Crew job: friends in the lobby can join at the vault (${INVITE_S} s)`, "gold", { key: "heist:crew" });
    emit("heist:crew", { phase: "invite", id: C.lead.id, plan: planId });
}
function launch() {
    const L = C.lead;
    if (!L || L.ph !== "in") return;
    L.crew = L.crew.filter(u => u === me() || members().includes(u));
    if (L.crew.length < 2) { L.ph = "done"; H.toast("💰 Nobody hopped in — a crew job needs a friend. Maybe next time 😇", "", { key: "heist:crew" }); C.mine = null; return; }
    L.crew.forEach((u, i) => { L.roles[u] = ORDER[i] || "lookout"; });
    // (the driver's task is outside: with 2 there's no driver — the vault + the talker, then everyone runs for a car)
    L.ph = "inside"; L.until = now() + ROLES_S * 1000;
    emit("heist:crew", { phase: "inside", id: L.id, crew: L.crew.slice() });
}
function leaderTick() {
    const L = C.lead;
    if (!L) return;
    const t = now();
    // a crew member gone from the party: off the crew (no share), never holding the rest up
    for (const u of L.crew) if (u !== me() && !members().includes(u) && !L.res[u]) L.res[u] = "gone";
    if (L.ph === "in" && t >= L.until) launch();
    else if (L.ph === "inside") {
        const need = L.crew.map(u => L.roles[u]);
        if (need.every(r => L.done[r]) || t >= L.until) { L.ph = "getaway"; L.until = t + RESULT_S * 1000; emit("heist:crew", { phase: "alarm", id: L.id }); }
    } else if (L.ph === "getaway") {
        const all = L.crew.every(u => L.res[u]);
        if (all || t >= L.until) { for (const u of L.crew) if (!L.res[u]) L.res[u] = "gone"; settle(); }
    }
}
/** The leader asks the host for the shares. */
function settle() {
    const L = C.lead;
    if (!L || L.ph === "done") return;
    L.ph = "done";
    const plan = PLANS.find(p => p.id === L.plan) || PLANS[1];
    const base = HEIST.base[L.town] || HEIST.base.lakewood;
    const take = Math.round((base * plan.mul + HEIST.heatBonus * plan.stars) / 5) * 5;
    const res = L.crew.map(u => L.res[u] || "gone");
    ctx.party.sendEvent("hjo", L.id, L.crew, res, take);
    emit("heist:crew", { phase: "settle", id: L.id, take, res });
}

// ── every crew member ────────────────────────────────────────────────────────────────────
function roleDone(role) {
    const m = C.mine;
    if (!m) return;
    if (m.leader === me()) { if (C.lead) C.lead.done[role] = 1; }
    else ctx.party.broadcast("hjd", m.leader, m.id, role);
    H.toast(`${ROLE[role].emoji} ${ROLE[role].name}: done!`, "gold", { key: "heist:crew:role" });
    sfx.pop();
    stat("heistCrewRoles", 1);
}
function report(result) {
    const m = C.mine;
    if (!m || m.result) return;
    m.result = result;
    if (m.leader === me()) { if (C.lead) C.lead.res[me()] = result; }
    else ctx.party.broadcast("hjx", m.leader, m.id, result);
    emit("heist:crew", { phase: "result", id: m.id, result });
}
function memberTick(dt) {
    const m = C.mine;
    if (!m) return;
    const p = m.leader === me() ? null : ctx.party.peer(m.leader);
    const a = m.leader === me() ? pubArr() : (p && p.x && Array.isArray(p.x.hj) ? p.x.hj : null);
    // the leader left / stopped publishing: the job's off (my chase, if any, stays my own — no pay)
    if (!a || (m.leader !== me() && (!members().includes(m.leader) || !fresh(p)))) { off("the leader left"); return; }
    const j = parse(a);
    if (j.id !== m.id) { off(""); return; }
    const i = j.crew.indexOf(me());
    if (i < 0 && j.ph !== "in") { off(""); return; }
    m.role = i >= 0 ? j.roles[i] || "" : "";
    if (j.ph !== m.ph) {
        const was = m.ph;
        m.ph = j.ph;
        if (j.ph === "inside") H.banner(`<b>${ROLE[m.role] ? ROLE[m.role].emoji + " YOU'RE " + ROLE[m.role].name : "💰 THE JOB"}</b><small>${ROLE[m.role] ? ROLE[m.role].task : ""}</small>`, 3400, { key: "heist:crew", prio: 3 });
        if (j.ph === "getaway") alarm();
        if (j.ph === "done" && was !== "done") { /* the shares come from the host (hja) */ }
    }
    // the driver: pulled up out front = done
    if (j.ph === "inside" && m.role === "driver" && !j.done.includes("driver") && ctx.state === "playing" && !onFoot()) {
        const sp = inTown() && ctx.town.spot("bank");
        if (sp && distTo(sp.x, sp.z) < HEIST.arriveR && ctx.car.speed < HEIST.arriveV) roleDone("driver");
    }
    // the getaway: my own chase starts once I'm driving (a cop on foot if I'm still walking after a few seconds)
    if (j.ph === "getaway" && !m.result) {
        m.gT = (m.gT || 0) + dt;
        const riding = ctx.openworld && ctx.openworld.riding;
        if (riding) {
            // a passenger shares the driver's fate
            const r = riding === me() ? "" : riderResult(riding, j);
            if (r) report(r);
        } else if (!m.chased && ctx.state === "playing" && !onFoot() && ctx.law && ctx.law.startChase) {
            m.chased = !!ctx.law.startChase(HEIST.warrant, { heat: j.plan.stars, msg: `🚨 ${"★".repeat(j.plan.stars)} BANK ROBBERY — WITH A CREW!`, charges: [HEIST.warrant] });
        } else if (!m.chased && onFoot() && m.gT > 6 && ctx.foot && ctx.foot.startChase) {
            const sp = inTown() && ctx.town.spot("bank");
            m.chased = !!ctx.foot.startChase(sp ? { x: sp.x + sp.nx * 14, z: sp.z + sp.nz * 14 } : { x: ctx.foot.pos.x + 20, z: ctx.foot.pos.z }, { charges: [HEIST.warrant] });
        }
        // shook them (a car chase that ended, or the cop on foot gave up): no chase of any kind for 3 s = got away
        const chasing = !!(ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || !!(ctx.foot && ctx.foot.chasing);
        if (m.chased && !chasing && (ctx.state === "playing" || ctx.state === "footRun")) { m.calmT = (m.calmT || 0) + dt; if (m.calmT > 3) report("ok"); }
        else m.calmT = 0;
        const left = Math.max(0, Math.round((j.until - now()) / 1000));
        setChip("💰 THE GETAWAY · with the crew", `lose the cops · ${j.crew.length} in the crew${left < 60 ? ` · ${left} s` : ""}`, ctx.law && ctx.law.chasing ? ctx.law.searchProgress : null, "#66BB6A");
    } else if (j.ph === "inside" && m.role) {
        const done = j.done.includes(m.role);
        setChip(`${ROLE[m.role].emoji} ${ROLE[m.role].name}${done ? " ✓" : ""}`, done ? `waiting for the crew · ${j.done.length}/${j.crew.length}` : ROLE[m.role].task, null, "#66BB6A");
        if (m.role === "driver" && !done) { const sp = inTown() && ctx.town.spot("bank"); setBeacon(sp ? { x: sp.x, y: 0, z: sp.z, lift: 5.5 } : null, "#66BB6A"); } else setBeacon(null);
    } else if (j.ph === "in") {
        setChip(`💰 ${name(m.leader)}'s crew · ${j.crew.length}/4`, `roles at GO · ${Math.max(0, Math.round((j.until - now()) / 1000))} s`, null, "#66BB6A");
    }
}
/** What the driver I'm riding with got (their hjx / the leader's results) → "ok" | "busted" | "". */
function riderResult(driver, j) {
    const i = j.crew.indexOf(driver);
    if (i >= 0 && j.res[i]) return j.res[i] === "gone" ? "" : j.res[i];
    return C.seenRes.get(driver) || "";
}
function alarm() {
    sfx.bell(10);
    confetti(ctx.car.pos.x, 2.2, ctx.car.pos.z, 30);
    H.banner(`<b>🚨 THE ALARM! (Bubbe's hearing aid)</b><small>out the door — to the cars! Lose the cops to get your share</small>`, 3200, { key: "heist:crew", prio: 3 });
    luluSays(pick(JOB.lulu), true);
    // out of the lobby (the soft cut back to the street at the bank's door)
    try { const rt = current(); if (rt && rt.def && rt.def.id === "bank" && !rt.leaving) rt.leave(); } catch (e) { /* */ }
    J.done = true; JS.lastJob = Date.now(); JS.jobs++; saveSoon();         // (she took part: one heist a run + the cooldown)
    stat("heistCrewJobs", 1);
}
function off(why) {
    const m = C.mine;
    C.mine = null;
    setChip(null); setBeacon(null);
    if (why && m) H.toast(`💰 The job's off — ${why}`, "", { key: "heist:crew" });
}
C.seenRes = new Map();

// ── the wire ─────────────────────────────────────────────────────────────────────────────
on("party:bc", ({ p, k, a }) => {
    if (!inParty() || !p || !Array.isArray(a)) return;
    const L = C.lead;
    if (k === "hjin" && L && a[0] === me() && a[1] === L.id && L.ph === "in" && L.crew.length < 4 && members().includes(p.uid) && !L.crew.includes(p.uid)) { L.crew.push(p.uid); H.toast(`💰 ${name(p.uid)} is in!`, "gold", { key: "heist:crewin" }); }
    else if (k === "hjd" && L && a[0] === me() && a[1] === L.id && L.ph === "inside" && L.roles[p.uid] === a[2]) L.done[a[2]] = 1;
    else if (k === "hjx") {
        if (["ok", "busted"].includes(a[2])) C.seenRes.set(p.uid, a[2]);
        if (L && a[0] === me() && a[1] === L.id && L.crew.includes(p.uid) && !L.res[p.uid] && ["ok", "busted"].includes(a[2])) L.res[p.uid] = a[2];
    } else if (k === "hja" && p.uid === ctx.party.host) payShare(a);
});
on("cop:chase", e => { if (C.mine && C.mine.ph === "getaway" && e && e.active === false && e.result && !["busted", "arrest", "quit"].includes(e.result)) report("ok"); });
on("law:arrest", () => { if (C.mine && C.mine.ph === "getaway") report("busted"); });
// the party's host: checks the leader's claim, splits the take among the ones who got away, one paying job a session each
if (ctx.party && ctx.party.onHostEvent) ctx.party.onHostEvent((uid, kind, a) => {
    if (kind !== "hjo" || !Array.isArray(a)) return;
    const [id, crew, res, take] = a, mem = members(), key = uid + ":" + id;
    if (C.host.seen.has(key) || !Array.isArray(crew) || !Array.isArray(res) || crew.length < 2 || crew.length > 4 || crew.length !== res.length) return;
    if (crew[0] !== uid || !crew.every(u => typeof u === "string" && mem.includes(u))) return;
    C.host.seen.add(key);
    const t = Math.max(0, Math.min(MAX_TAKE, take | 0));
    const won = crew.filter((u, i) => res[i] === "ok");
    const each = won.length ? Math.round(t / won.length / 5) * 5 : 0;
    const shares = crew.map((u, i) => {
        if (res[i] !== "ok") return [u, 0, res[i] || "gone"];
        const n = C.host.n.get(u) || 0;
        if (n >= 1) return [u, 0, "cap"];
        C.host.n.set(u, n + 1);
        return [u, each, "ok"];
    });
    const msg = [id, uid, shares];
    ctx.party.broadcast("hja", ...msg);
    payShare(msg);
});
function payShare(a) {
    const [id, leader, shares] = a;
    const key = leader + ":" + id;
    if (C.paid.has(key) || !Array.isArray(shares)) return;
    const mine = shares.find(s => Array.isArray(s) && s[0] === me());
    if (!mine) return;
    C.paid.add(key);
    const n = Math.max(0, Math.min(MAX_TAKE, mine[1] | 0)), got = shares.filter(s => s[2] === "ok").length;
    if (n > 0) {
        addCoins(n, "heist:crew");
        if (ctx.law && ctx.law.addWarrant) ctx.law.addWarrant([HEIST.warrant]);
        sfx.yay();
        H.banner(`<b>💰 +${n} — your share!</b><small>${got > 1 ? `split ${got} ways` : "the whole take"} · the warrant goes on file</small>`, 3400, { key: "heist:crew", prio: 3 });
        stat("heistCrewClean", 1);
    } else H.banner(`<b>💰 ${mine[2] === "busted" ? "Caught — no share this time" : mine[2] === "cap" ? "Your share's spent for today's party" : "The job's over"}</b><small>${got ? `${got} of the crew got away` : "nobody got away with it"}</small>`, 2800, { key: "heist:crew", prio: 2 });
    emit("heist:crewPaid", { id, leader, pay: n, got });
    if (C.mine && C.mine.id === id) { C.mine = null; setChip(null); setBeacon(null); }
    if (C.lead && C.lead.id === id) C.lead = null;
}

// ── per frame: publish (the leader), tick ────────────────────────────────────────────────
function publish(dt) {
    C.sendT -= dt;
    if (C.sendT > 0) return;
    C.sendT = 0.15;
    const a = C.lead && inParty() ? pubArr() : null;
    const k = a ? a.join("|") : "";
    if (k !== C.sent) { C.sent = k; ctx.party.setX("hj", a); }
}
export function crewTick(dt) {
    if (!inParty()) { if (C.lead || C.mine) { C.lead = null; off(""); } return; }
    try { leaderTick(); memberTick(dt); publish(dt); } catch (e) { console.error("[heist crew]", e); }
}
hook("hud", dt => { if (!ctx.paused) crewTick(dt); });
// (inside the bank the HUD hook runs too — interiors have hud: true)
on("party:status", e => { if (e && e.want === false) { C.lead = null; C.mine = null; C.host.seen.clear(); C.host.n.clear(); } });
export const crewDebug = {
    C, MAX_TAKE, launch: () => launch(), lead: id => lead(id || "classic"),
    done: role => roleDone(role), result: r => report(r), settle: () => settle(),
    get on() { const o = crewOn(); return o ? Object.assign({ leader: o.leader }, parse(o.a)) : null; },
};
