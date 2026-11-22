// features/heist — 🏦 THE BANK in each town. The building itself is TOWN DATA (Lakewood's / Midwood's
// `uses.bank`, model heist_bank, its sign in the town's atlas — see features/town/towns/*.js); this file
// is what you do there:
//   • on foot in a town, ✋ ENTER THE BANK at its door (ctx.foot.addSpot) → the interiors engine
//     (defineInterior "bank": the teller line, the napping guard, the vault door, the lollipop jar)
//   • inside: talk to the teller / the line / the guard (asleep), a free lollipop, the founder's portrait,
//     and 🔍 CASE THE VAULT → the (optional) plan for a cartoon heist (job.js)
// The town lets the interior state play in it (ctx.town.allowState("interior")) — only for the bank (and
// features/homes' houses): any other interior in a town still sends her back to the highway, as before.
import { ctx, on, setState } from "../../core/ctx.js";
import { defineInterior, pool, pick } from "../interiors/engine.js";
import { BANK, PLANS, JOB, TELLER, TELLER_BK, GUARD, LINE, FOUNDER, LOLLY, VAULT_OK } from "./data.js";
import { setPlan, blocked, J } from "./job.js";
import { prop, inTown, stat, inParty, partyFree } from "./common.js";
import { vaultLabel, vaultAct, roleLabel, roleAct } from "./crew.js";

const PARTY_VAULT = ["With the whole gang watching? Too many witnesses. 👀", "Not today. Bubbe would hear about it by lunch.", "Nice vault. Very… vaulty. Moving on. 😇"];

const tellerLine = { lakewood: pool(TELLER), midwood: pool(TELLER_BK) };
const guardLine = pool(GUARD), lineLine = pool(LINE), founderLine = pool(FOUNDER), lollyLine = pool(LOLLY);
const TELLER_S = { emoji: "🏦", color: "#00897B" }, GUARD_S = { emoji: "😴", color: "#1F3A5F" }, LINE_S = { emoji: "🧍", color: "#6D4C41" };
const townId = () => (ctx.town && ctx.town.active && ctx.town.id) || "lakewood";

const def = defineInterior({
    id: "bank", name: "the bank", short: "the bank", emoji: "🏦",
    title: "🏦 THE BANK", tagline: "",
    model: "heistBankInt", models: ["heistTeller", "heistGuard", "npcWoman", "npcMan", "heistProps"],
    music: "../story-relax.mp3",
    light: "indoor", sky: "#d9cbb0",
    bounds: { x0: -7.6, x1: 7.6, z0: -4.5, z1: 4.6 },
    cam: { dist: 7.6, height: 5.0 },

    build(rt) {
        const set = rt.set, d = rt.data, town = townId();
        set.hemi.color.set("#fff4e0"); set.hemi.intensity = 1.3;
        set.sun.color.set("#fff1d6"); set.sun.intensity = 1.1;
        rt.pointLight("tube0", "#fff3dd", 6, 11);
        rt.pointLight("tube1", "#fff3dd", 6, 11, 1.6, true);
        d.alarm = rt.pointLight("alarm", "#ff1744", 0, 10);
        d.vault = rt.node("VaultDoor");
        d.wheel = rt.node("VaultWheel");
        d.zzT = 1.5;

        // ── people ──
        rt.person("teller", "heistTeller", "teller", { name: "The Teller", collide: false });
        rt.person("guard", "heistGuard", "guard", { name: "The Guard", pose: { sit: true }, y: 0.12, faceLulu: false, collide: false,
            post(p, dt, t) { if (p.limbs.Body) p.limbs.Body.rotateX(0.18 + Math.sin(t * 1.3) * 0.04); } });
        const tint = ["#E57373", "#64B5F6", "#FFB74D", "#81C784", "#BA68C8"];
        rt.person("line0", "npcWoman", "line0", { colors: { Top: pick(tint) }, faceLulu: false, name: "A woman in line" });
        rt.person("line1", "npcMan", "line1", { colors: { Top: pick(tint) }, faceLulu: false, name: "A man in line" });
        rt.person("line2", "npcWoman", "line2", { colors: { Top: pick(tint), Hair: "#9E9E9E" }, faceLulu: false, name: "A bubbe in line" });
        // (the line faces the teller's window, whatever the exported spot's rotation says)
        const win = rt.spot("window") || rt.spot("teller");
        if (win) for (const id of ["line0", "line1", "line2"]) rt.byId[id].p.face(win.x, win.z - 2, 1, 100);

        // ── hotspots ──
        rt.hot({ id: "teller", spot: "window", who: "teller", r: 1.5, label: "💬 Talk to the teller",
            action: rt => rt.say("The Teller", (tellerLine[town] || tellerLine.lakewood)(), Object.assign({ person: rt.byId.teller }, TELLER_S)) });
        rt.hot({ id: "line", spot: "line0", who: "line0", r: 1.5, track: true, label: "🧍 Chat with the line",
            action: rt => { const w = pick(["line0", "line1", "line2"]); return rt.say(rt.byId[w].name, lineLine(), Object.assign({ person: rt.byId[w] }, LINE_S)); } });
        rt.hot({ id: "guard", spot: "guardTalk", who: "guard", r: 1.5, label: "😴 The guard (asleep)",
            action: rt => rt.say("The Guard", guardLine(), Object.assign({ person: rt.byId.guard }, GUARD_S)) });
        rt.hot({ id: "lolly", spot: "lolly", r: 1.3, label: "🍭 Free lollipop", action: async rt => {
            const first = !rt.used.lolly;
            rt.used.lolly = true;
            rt.luluHold(prop("Lollipop"), { y: -0.47, z: 0.06, rx: -2.2 });
            stat("heistLollipops", 1);
            await rt.say("Lulu", first ? lollyLine() : LOLLY[2], { emoji: "🍭", color: "#E91E63" });
        } });
        const ff = rt.fx("founder");
        if (ff) rt.hot({ id: "founder", x: ff.x + 1.1, z: ff.z, r: 1.4, label: "🖼️ The founder's portrait", action: rt => rt.say("Lulu", founderLine(), { emoji: "🖼️" }) });
        rt.hot({ id: "vault", spot: "vault", r: 1.6, label: () => inParty() ? vaultLabel() : J.plan || J.job ? "🔒 The vault" : "🔍 Case the vault", action: caseVault });
        // the crew job's roles (with friends — crew.js): the talker at the window, the lookout by the guard
        rt.hot({ id: "crewTalk", spot: "window", r: 1.7, label: () => roleLabel("talker"), enabled: () => !!roleLabel("talker"), action: rt => roleAct(rt, "talker") });
        rt.hot({ id: "crewLook", spot: "guardTalk", r: 1.7, label: () => roleLabel("lookout"), enabled: () => !!roleLabel("lookout"), action: rt => roleAct(rt, "lookout") });
    },

    tick(rt, dt) {
        const d = rt.data;
        if (d.wheel) d.wheel.rotation.y += dt * 0.15;
        d.zzT -= dt;
        if (d.zzT <= 0 && rt.byId.guard) { d.zzT = 3.2; rt.bubble(pick(["Zzz…", "zzZ…", "*snore*"]), rt.byId.guard.p.obj, 2.0, { color: "#1F3A5F" }); }
        if (d.alarmT > 0) {
            d.alarmT -= dt;
            if (d.alarm) d.alarm.intensity = Math.sin(ctx.time * 18) > 0 ? 9 : 0;
        } else if (d.alarm) d.alarm.intensity = 0;
        if (d.open != null && d.vault) d.vault.rotation.y += ((d.open ? -1.2 : 0) - d.vault.rotation.y) * Math.min(1, dt * 2);
    },
});

/** 🔍 Case the vault: two readable notes, then the (optional) plan. */
async function caseVault(rt) {
    // (with friends: the CREW job — crew.js; a party game on: just a vault)
    if (inParty()) { if (partyFree()) return vaultAct(rt); await rt.say("Lulu", pick(PARTY_VAULT), { emoji: "👀" }); return; }
    if (J.plan || J.job) { await rt.say("Lulu", J.plan ? "Already cased. Now: the car, out front. Act natural." : VAULT_OK, { emoji: "🔒" }); return; }
    const notes = JOB.caseLines.slice().sort(() => Math.random() - 0.5).slice(0, 2);
    rt.data.open = true;
    await rt.say("Lulu", `📝 ${notes[0]}`, { emoji: "🕵️‍♀️", color: "#E91E63" });
    await rt.say("Lulu", `📝 ${notes[1]}`, { emoji: "🕵️‍♀️", color: "#E91E63" });
    rt.data.open = false;
    if (rt.disposed) return;
    const why = blocked();
    if (why) { await rt.say("Lulu", why, { emoji: "⏳" }); return; }
    const opts = PLANS.map(p => `${p.emoji} ${p.name} <small>(${p.blurb})</small>`).concat([JOB.nah]);
    const i = await rt.choose("The plan", JOB.planAsk, opts, { emoji: "💰", color: "#2E7D32" });
    if (rt.disposed || i < 0) return;
    if (i >= PLANS.length) { await rt.say("Lulu", pick(JOB.nahLine), { emoji: "😇" }); return; }
    const plan = PLANS[i];
    if (!setPlan(townId(), plan.id, "inside")) return;
    rt.data.alarmT = 0;
    await rt.say("Lulu", `${plan.emoji} ${plan.name}. Okay. Okay okay okay. Back to the car — then pull up RIGHT out front.`, { emoji: "💰", color: "#2E7D32" });
}

// ── the door (on foot, in a town) ───────────────────────────────────────
function door() {
    // (with friends: open in 🌍 Free Roam — the lobby is a room friends share, features/together)
    const party = !!(ctx.party && ctx.party.active), roam = party && !!(ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());
    if (!inTown() || (party && !roam) || !ctx.interiors || !ctx.interiors.bank) return null;
    if ((ctx.law && ctx.law.chasing) || (ctx.foot && ctx.foot.chasing)) return null;
    if (ctx.heist && (ctx.heist.robbery || ctx.heist.snatcher || ctx.heist.thief)) return null;   // (✋ is the TACKLE right now, not the door)
    const sp = ctx.town.spot("bank");
    // (walking up to it: the inside starts loading now)
    if (sp && ctx.foot && ctx.foot.pos && ctx.interiors.bank.warm && Math.hypot(sp.x - ctx.foot.pos.x, sp.z - ctx.foot.pos.z) < 22) ctx.interiors.bank.warm();
    return sp ? { x: sp.x, z: sp.z } : null;
}
export function enterBank() {
    const sp = inTown() && ctx.town.spot("bank");
    if (!sp || !ctx.interiors || !ctx.interiors.bank) return false;
    const n = ctx.world.road.nearest(sp.x, sp.z, ctx.car.s, {});
    const dr = { id: "bank", s: n.s, d: n.d, side: Math.sign(n.d) || 1 };
    const b = BANK[townId()] || BANK.lakewood;
    def.name = b.name; def.short = "the bank"; def.emoji = b.emoji;
    def.title = `${b.emoji} ${b.name.toUpperCase()}`; def.tagline = b.tagline;
    ctx.interiors.bank.name = b.name; ctx.interiors.bank.emoji = b.emoji;
    stat("heistBankVisits", 1);
    const exit = () => { if (ctx.foot && ctx.foot.active !== undefined) setState("footRun", { resume: "interior", door: dr }); };
    return ctx.interiors.bank.enter({ exit, door: "bank", from: "foot" });
}
on("boot", () => {
    if (ctx.town && ctx.town.allowState) ctx.town.allowState("interior");
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot({ pos: door, r: 2.6, label: () => `🏦 ENTER ${((BANK[townId()] || BANK.lakewood).name).toUpperCase()}`, short: "BANK", act: enterBank });
});
// only the town's own buildings play inside a town — the bank and a house (features/homes' "home": its families
// live on these streets) — any other interior there still sends her back to the highway (the old way)
const TOWN_INTERIORS = new Set(["bank", "home", "police", "hospital", "courthouse", "shopsPizza", "shopsBakery", "shul", "realty", "realestateHouse", "cityhall"]);   // (+ features/places' precinct, hospital, courthouse lobby; features/shops' walk-in shops; features/shul; features/realestate's office + houses; features/cityhall)
on("state", ({ to, data }) => {
    if (to === "interior" && inTown() && !(data && TOWN_INTERIORS.has(data.id)) && ctx.town.leave) ctx.town.leave("quiet");
});
export { def as bankDef };
