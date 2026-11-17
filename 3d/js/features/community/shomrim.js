// features/community — 🔦 SHOMRIM: the civilian patrol. Earnest guys in a Crown Vic with a
// light bar, three antennas, a clipboard and a flip phone that's filming (lens cap on).
// They can't arrest anybody — so they do everything else:
//   • LEAD: they see her do something in town (a stop sign, speeding in a 25, a carjacking,
//     a fender bender) → they follow her round the grid, radio it in, film her, and after a few
//     seconds of seeing her they CALL THE REAL COPS (ctx.law.startChase). Lose them first and
//     they give up ("Lost her by the bagel place"). Sometimes the cops are on it right away.
//   • JOIN: any cop chase in town → 1–2 Shomrim cars join in, and while one has eyes on her
//     the radio tips the cops off (ctx.law.spot: the search meter stops filling).
//   • HOLD: boxed in by a Crown Vic (slow / stopped next to one) → they hold her "until the
//     police arrive": talk your way out (a shiur? Bubbe on Forest Ave?) or it's law's arrest flow.
// Everything goes through ctx.law (guarded); law itself is not forked.
import { ctx, emit } from "../../core/ctx.js";
import { addScore } from "../../core/driving.js";
import { glyph } from "../../input.js";
import * as H from "../../hud.js";
import { say, choose, script } from "../../core/dialog.js";
import { CM, on, onFoot, luluPos, rand, pick, clamp, bubble, luluSay, sfx, stat, townCfg, streetName, later, hintOnce } from "./common.js";
import { spawnAt, pursue, leave, park, shomrimSees, KIND } from "./fleet.js";
import { play, windowSpot, actor, busy as helpBusy } from "./help.js";
import { SHOMRIM } from "./lines.js";

const inTown = () => !!(ctx.town && ctx.town.active);
const MPH = 2.23694;
let chip = null;

/** Start (or pile onto) a Shomrim pursuit. opts: { lead (they called it, no cops yet), from (a V that saw it), join, msg } */
export function startShomrim(reason, opts = {}) {
    const cfg = townCfg();
    if (!cfg || !cfg.orgs.shomrim || !on() || !CM.loaded || !inTown()) return false;
    const SH = CM.chase;
    if (SH) { if (reason && !SH.charges.includes(reason)) SH.charges.push(reason); return true; }
    if ((CM.shCool || 0) > ctx.time && !opts.join) return false;
    const lawOn = !!(ctx.law && ctx.law.chasing);
    const lead = !opts.join && !lawOn && cfg.shomrim.lead !== false;
    const ch = CM.chase = { reason: reason || "BEING SUSPICIOUS", charges: [reason || "BEING SUSPICIOUS"], lead, t: 0, units: [],
        callT: rand(cfg.shomrim.callIn[0], cfg.shomrim.callIn[1]), unseenT: 0, radioT: rand(2, 3.5), shoutT: rand(1, 2), holdT: 0, filmT: rand(3, 5), sight: cfg.shomrim.sight || 58, cfg };
    // the car that saw it leads; more join out of sight on the grid
    const want = Math.max(1, Math.min(3, opts.join ? cfg.shomrim.join : 2));
    const first = opts.from || shomrimSees(ch.sight);
    if (first && !first.dead) addUnit(ch, first, 0);
    while (ch.units.length < want) {
        const sp = ctx.town.copSpawn ? ctx.town.copSpawn(ch.units.length ? "seen" : "first") : null;
        if (!sp) break;
        const V = spawnAt("shomrim", sp.s, sp.d, sp.dir, 9, { lights: true });
        if (!V) break;
        addUnit(ch, V, ch.units.length);
    }
    if (!ch.units.length) { CM.chase = null; return false; }
    sfx.bloop();
    if (opts.join) H.banner(`<b>${SHOMRIM.join}</b><small>they radio everything to the cops</small>`, 2200, { key: "community-sh", prio: 2 });
    else H.banner(`<b>${opts.msg || pick(SHOMRIM.start)}</b><small>${reason} · ${pick(SHOMRIM.startSub)}</small>`, 2400, { key: "community-sh", prio: 2 });
    hintOnce("shomrim", `<b>🔦 Shomrim can't arrest you…</b><small>…but they WILL call the cops. Break their line of sight, or don't stop next to one!</small>`, 4200);
    emit("community:shomrim", { active: true, reason: ch.reason, lead, join: !!opts.join });
    stat("communityShomrimChases", 1);
    // sometimes the real cops were already on the way
    if (lead && Math.random() < (opts.withCops != null ? opts.withCops : cfg.shomrim.withCops)) later(rand(1.2, 2.4), () => { if (CM.chase === ch && ch.lead) callIn(ch); });
    return true;
}
function addUnit(ch, V, k) {
    pursue(V, { gapWant: k === 0 ? -7 : -14 - k * 4, side: k === 0 ? 0 : (k % 2 ? 3.3 : -3.3), lights: true });
    V.chase = ch;
    ch.units.push(V);
}

/** They call it in: the real cops start a pursuit (on foot: a warrant). */
function callIn(ch) {
    ch.lead = false;
    sfx.radio();
    H.banner(`<b>${SHOMRIM.callIn}</b><small>${SHOMRIM.callInSub}</small>`, 2200, { key: "community-sh", prio: 2 });
    const law = ctx.law;
    if (!law) return;
    let ok = false;
    try { ok = !!(law.startChase && law.startChase(ch.reason, { msg: "📞 SHOMRIM CALLED IT IN!", heat: 1 })); } catch (e) { console.error(e); }
    if (!ok && law.addWarrant) { try { law.addWarrant(ch.reason); } catch (e) { /* read-only */ } }
    emit("community:shomrim", { active: true, called: true, reason: ch.reason });
}

export function endShomrim(why = "ended") {
    const ch = CM.chase;
    if (!ch) return;
    CM.chase = null;
    CM.shCool = ctx.time + (why === "let" || why === "blend" ? 40 : 22);
    for (const V of ch.units) {
        if (V.dead) continue;
        V.chase = null;
        if (why === "busted") { park(V, true); later(rand(4, 7), () => leave(V)); }
        else { park(V, why !== "lost"); later(rand(1.2, 2.6), () => leave(V)); }
    }
    if (why === "lost") H.toast(pick(SHOMRIM.lost), "");
    else if (why === "escaped") H.toast(SHOMRIM.giveUp, "");
    showChip(null);
    emit("community:shomrim", { active: false, why });
}

// ── per frame ────────────────────────────────────────────────────────────
export function tickShomrim(dt) {
    const ch = CM.chase;
    if (!ch) { watchSpeeding(dt); return; }
    if (!inTown()) { endShomrim("left"); return; }
    ch.t += dt;
    for (let i = ch.units.length - 1; i >= 0; i--) if (ch.units[i].dead || ch.units[i].chase !== ch) ch.units.splice(i, 1);
    if (!ch.units.length) { endShomrim("lost"); return; }
    if (helpBusy()) return;                       // a scene is playing (the hold itself, a volunteer…)
    const lp = luluPos(), foot = onFoot();
    const blending = !!(CM.by && CM.by.blend);
    let seen = null, near = 1e9;
    for (const V of ch.units) {
        const c = V.car;
        if (c.hit && c.hitT > 3) { c.hit = false; c.speed = 0; c.free = true; c.h = c.obj.rotation.y; }   // shake it off
        const d = Math.hypot(c.x - lp.x, c.z - lp.z);
        if (d < near) near = d;
        if (!blending && d < ch.sight && !ctx.town.blocksSight(c.x, c.z, lp.x, lp.z)) seen = V;
        // shouting out of the window / filming on a flip phone
        if (d < 26 && ctx.time > ch.shoutT) { ch.shoutT = ctx.time + rand(3.5, 6); bubble(c.obj, pick(foot ? SHOMRIM.foot : SHOMRIM.shout), 2.6, "cop"); }
    }
    if (seen && ctx.time > ch.filmT && near < 30) { ch.filmT = ctx.time + rand(5, 8); sfx.shutter(); }
    if (ch.lead) {
        if (seen) { ch.unseenT = 0; ch.callT -= dt; if (ch.callT <= 0) callIn(ch); }
        else { ch.unseenT += dt; if (ch.unseenT > 7.5) { endShomrim("lost"); return; } }
        showChip(ch);
    } else {
        showChip(null);
        // the radio: while one of them sees her, the cops count her as SEEN
        ch.radioT -= dt;
        if (seen && ch.radioT <= 0) {
            ch.radioT = rand(5, 8);
            if (ctx.law && ctx.law.spot && ctx.law.spot(2.6)) {
                sfx.radio();
                H.toast(pick(SHOMRIM.radio).replace(/\{street\}/g, streetName()), "", { key: "cm-radio" });
            }
        }
        if (!(ctx.law && ctx.law.chasing) && !foot) {
            // the cops lost her (or gave up) — the Shomrim follow a few seconds, then go home
            ch.unseenT += seen ? 0 : dt;
            if (ch.unseenT > 6) { endShomrim("escaped"); return; }
        }
        if (foot && !seen) { ch.unseenT += dt; if (ch.unseenT > 9) { endShomrim("lost"); return; } }
    }
    // boxed in: slow / stopped right next to a Crown Vic → they hold her for the cops
    const st = ctx.state;
    const close = foot ? near < 4.5 : near < 7.5;
    const slow = foot ? true : ctx.car.speed < 2.2;
    if (close && slow && !(CM.force && CM.force.noHold) && (st === "playing" || st === "footRun") && !blending && !CM.help && !(ctx.foot && ctx.foot.active && ctx.foot.phase === "script")) {
        ch.holdT += dt;
        if (ch.holdT > (foot ? 1.6 : 1.3)) { ch.holdT = 0; hold(ch); }
    } else ch.holdT = Math.max(0, ch.holdT - dt);
}

// speeding past a Shomrim car (they're watching. they're ALWAYS watching)
function watchSpeeding(dt) {
    const cfg = townCfg();
    if (!cfg || !cfg.orgs.shomrim || !on() || ctx.state !== "playing" || onFoot() || (ctx.law && ctx.law.chasing)) { CM.speedT = 0; return; }
    const lim = (ctx.town.def && ctx.town.def.speedingMph) || 48;
    const mph = ctx.car.speed * MPH;
    if (mph > lim && shomrimSees(45)) {
        CM.speedT = (CM.speedT || 0) + dt;
        if (CM.speedT > 0.9) { CM.speedT = 0; startShomrim(`SPEEDING IN A ${(ctx.town.def && ctx.town.def.speedLimitMph) || 25}`, { msg: `🔦 ${Math.round(mph)} IN A ${(ctx.town.def && ctx.town.def.speedLimitMph) || 25}?! SHOMRIM SAW!` }); }
    } else CM.speedT = Math.max(0, (CM.speedT || 0) - dt);
}

/** Something happened in town: a Shomrim car that saw it (or a guy "just parked on the corner") starts in. */
export function witness(reason, r = 55, chance = 0.25) {
    if (!townCfg() || !on()) return false;
    if (CM.chase) { if (!CM.chase.charges.includes(reason)) CM.chase.charges.push(reason); return true; }
    if (ctx.law && ctx.law.chasing) return false;
    const V = shomrimSees(r);
    if (!V && Math.random() > chance) return false;
    return startShomrim(reason, { from: V });
}

// ── the contextual chip: "📞 calling it in…" (only while THEY lead) ──────
function showChip(ch) {
    if (!ch) { if (chip) { chip.remove(); chip = null; } return; }
    if (!chip) { chip = document.createElement("div"); chip.className = "cm-chip"; H.hudSlot("center").appendChild(chip); }
    const k = clamp(1 - ch.callT / ((ch.cfg.shomrim.callIn[0] + ch.cfg.shomrim.callIn[1]) / 2), 0, 1);
    const html = `🔦 SHOMRIM · ${ch.unseenT > 0.3 ? "lost sight…" : "calling it in…"}<i><b style="width:${(k * 100).toFixed(0)}%"></b></i>`;
    if (chip.dataset.h !== html) { chip.dataset.h = html; chip.innerHTML = html; }
}

// ── HOLD: boxed in until the cops come (or she talks her way out) ───────
function hold(ch) {
    const V = ch.units.slice().sort((a, b) => dist(a) - dist(b))[0];
    if (!V) return;
    const V2 = ch.units.find(u => u !== V) || V;
    for (const u of ch.units) park(u, true);
    CM.sceneKind = "hold";
    stat("communityHolds", 1);
    CM.stats.holds++;
    const foot = onFoot();
    const ok = play({
        kind: "hold",
        script: async (f, ss) => {
            const c = V.car, c2 = V2.car, win = windowSpot();
            const s1 = actor(ss, "community_shomer", c.x - Math.cos(c.h) * 1.3, c.z + Math.sin(c.h) * 1.3, { x: win.x + 0.4, z: win.z + 0.4 });
            const s2 = actor(ss, "community_shomer", c2.x + Math.cos(c2.h) * 1.3, c2.z - Math.sin(c2.h) * 1.3, { x: c2.x + Math.cos(c2.h) * 2.2 + Math.sin(c2.h) * 1.5, z: c2.z - Math.sin(c2.h) * 2.2 + Math.cos(c2.h) * 1.5 });
            ss.s1 = s1; ss.s2 = s2;
            H.banner(`<b>${SHOMRIM.hold.title}</b><small>${ch.reason}</small>`, 2200, { key: "community-sh", prio: 2 });
            sfx.bloop();
            await f.sleep(1.6);
            await script(SHOMRIM.hold.open, { emoji: { "SHOMER": "🔦", "SHOMER #2": "📱" }, color: { "SHOMER": "#3949AB", "SHOMER #2": "#3949AB" } });
            const i = await choose("SHOMER", SHOMRIM.hold.ask, SHOMRIM.hold.options, { emoji: "🔦", color: "#3949AB" });
            const H2 = SHOMRIM.hold;
            const odds = [0.45, 0.55, 0, 0.35][Math.max(0, i)] || 0;
            const won = (CM.force && CM.force.hold != null) ? CM.force.hold : Math.random() < odds;
            const line = i === 0 ? (won ? H2.shiurOk : H2.shiurNo) : i === 1 ? (won ? H2.bubbeOk : H2.bubbeNo) : i === 2 ? H2.flip : (won ? H2.floorOk : H2.floorNo);
            await say(line[0], line[1], { emoji: "🔦", color: "#3949AB" });
            if (won && i === 3) {
                // floored it round the Crown Vic: the chase is still on (they need a sec to get back in)
                H.toast(H2.free, "gold");
                for (const u of ch.units) later(2.2, () => { if (!u.dead && CM.chase === ch) pursue(u, { gapWant: u.gapWant, side: u.side, lights: true }); });
                ss.result = "floor";
            } else if (won) {
                H.toast(H2.let, "gold");
                addScore(200, "talkedOut");
                ss.result = "let";
            } else {
                await say(H2.cops[0], H2.cops[1], { emoji: "🔦", color: "#3949AB" });
                ss.result = "cops";
            }
        },
        tick(dt, ss) {
            const lp = luluPos();
            for (const p of [ss.s1, ss.s2]) {
                if (!p || ss.walkers.some(w => w.p === p && !w.done)) continue;
                p.face(lp.x, lp.z, dt, 6);
                p.update(dt, { talk: p === ss.s1, point: p === ss.s2 });
            }
        },
        after(ss) {
            CM.sceneKind = null;
            if (ss.result === "let") { endShomrim("let"); emit("community:hold", { result: "let" }); }
            else if (ss.result === "floor") emit("community:hold", { result: "floor" });
            else if (ss.result === "cops") { emit("community:hold", { result: "cops" }); arrestNow(ch, foot); }
            else for (const u of ch.units) later(1.5, () => { if (!u.dead && CM.chase === ch) pursue(u, { gapWant: u.gapWant, side: u.side, lights: true }); });
        },
    });
    if (!ok) { CM.sceneKind = null; for (const u of ch.units) pursue(u, { gapWant: u.gapWant, side: u.side, lights: true }); }
}
const dist = V => { const lp = luluPos(); return Math.hypot(V.car.x - lp.x, V.car.z - lp.z); };

/** The cops are here: hand her to law's arrest flow (on the highway's shoulder, where law's scenes live). */
function arrestNow(ch, foot) {
    const charges = ch.charges.slice();
    endShomrim("handed");
    const law = ctx.law;
    if (!law || !law.arrest) { H.toast("🚓 …nobody came. The Shomrim shrug and go home.", ""); return; }
    later(0.05, () => {
        try {
            if (foot && ctx.foot && ctx.foot.active && ctx.foot.end) ctx.foot.end("arrest");
            if (ctx.town && ctx.town.active) ctx.town.leave("quiet");
            law.arrest(charges, foot ? { onFoot: true } : {});
        } catch (e) { console.error("[community] arrest", e); }
    });
}
export { hold };
