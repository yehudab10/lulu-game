// ─────────────────────────────────────────────────────────────────────────
//  features/underworld — 😈 CORRUPT PEOPLE & BAD GUYS AROUND TOWN (a cartoon: nobody gets hurt
//  beyond the game's own knock-down / heart rules; the "weapons" are a baguette, a banana and a
//  water pistol; the bribe is for the Policeman's Kugel Fund).
//
//    crooked.js     🍩 Officer Krupnik: a ⚠️ warning → his cruiser on the shoulder ahead; a 1–2★ pull-over
//                   → law/bust.js asks bustOffer(). Pay → it goes away · an Internal Affairs STING → the
//                   charge + stars (and a courtroom scene) · no thanks → nothing changes
//    mechanic.js    🔧 Velvel's No-Questions Auto: cheap fixes / paint (maybe HOT: cops recognise the car
//                   later), he buys the "borrowed" car she's in (a neighbour may call it in)
//    fixer.js       🕶️ the Fixer's dirty jobs on hustle's framework (📦 the package · 🧤 the wheelman ·
//                   🕶️ lose the tail): a text + a ringing payphone, or the 💼 Jobs app — pay well, add HEAT
//    heat.js        🌡️ heat 0–100 (cools while she plays + while she's away; high = law's pursuit table
//                   scaled: cops see further, warnings linger) + 🧠 rivals (bad guys remember her)
//    badguys.js     😡 the road-rager, 😎 the gang car (highway traffic with our AI), 🚓 led past a cop →
//                   HE gets pulled over, 🔦 Shomrim from the 📞 Call app, 🔧 Chaverim for his flat
//    pickpocket.js  🫳 on foot: bump, lift ≤ 30 coins, run — ✋ TACKLE him (or a Shomer does); escaped
//                   coins come back anyway (his mother)
//    deal.js        the roadside deal state "underworldDeal" (Krupnik, Velvel) · common.js · data.js (all
//                   text + every knob: SPAWN — the owner's frequency table)
//
//  ctx.underworld { heat, level, addHeat(n, why), enc, offer, rivals, SPAWN, TUNE, bustOffer(), spawn(kind),
//                   offer…, debug } — see the bottom. Events underworld:<ev> (offer, bribe, velvel, hot,
//                   encounter, bump, flat, end, shomrim, chaverim, pick, owed, job, fixer, heat); stats uw*.
//  Gating: ctx.enabled("underworld") (?test opt-in; OFF in a 🎉 party — party's OFF set); Settings ›
//  😈 Bad guys (Off · Rare · Normal · Often). Never in the first minute of a run, never during a chase,
//  at most one bad-guy encounter every few minutes (SPAWN.gap).
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on, hook, addActor, addMenuItem, css } from "../../core/ctx.js";
import { ID, SPAWN, TUNE, RATE_ORDER, RATE_LABEL, PAGE } from "./data.js";
import { UW, SAVE, dirty, live, inParty, rand, pick, chance, rate, onFoot, inTown, chasing, calm, mode, stars, flushRemovals, tickTimers, clearTimers, later, log } from "./common.js";
import { heat, heatLevel, addHeat, heatTick, applyAlert, alertOff } from "./heat.js";
import { onWarning, offersTick, clearOffer, bustOffer, registerCharge, shoulderCop } from "./crooked.js";
import { mechTick, clearShack, placeShack, hotTick } from "./mechanic.js";
import { fixerTick, registerJobs, offer as fixerOffer, blocked as fixerBlocked } from "./fixer.js";
import { spawnBadCar, badTick, dropBad, registerCalls, callShomrim, chaverimFlat } from "./badguys.js";
import { spawnPickpocket, pickTick, dropPick, tackle, tackleSpot, shomerAfter, payOwed } from "./pickpocket.js";
import "./deal.js";

UW.shomerAfter = shomerAfter;
// ?test&enable=underworld&uwrate=3 — the frequency knob from the URL
{ const q = new URLSearchParams(location.search).get("uwrate"); if (q != null && Number.isFinite(+q)) SPAWN.rate = +q; }

// ── the scheduler: at most one bad guy every few minutes ─────────────────
const weighted = w => { let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(w)) if ((r -= v) <= 0) return k; return Object.keys(w)[0]; };
/** Could a bad guy show up right now? → "" or why not. */
export function why() {
    const party = inParty();
    if (!live(party ? "pickpocket" : "")) return "off";
    if (UW.enc || UW.loading) return "busy";
    if (UW.runT < SPAWN.firstAfter) return "early";
    if (chasing() || (ctx.law && ctx.law.reported)) return "chase";
    if (calm()) return "calm";
    if (!party && !/^(cruise|story)$/.test(mode())) return "mode";
    if (ctx.hustle && ctx.hustle.job) return "job";
    if (ctx.phone && ctx.phone.busy && ctx.phone.busy()) return "phone";
    if (ctx.dialogOpen || ctx.paused) return "dialog";
    if (ctx.state === "playing") {
        if (party) return "party";       // (no bad-guy cars with friends: they'd sit in the shared traffic on one screen)
        if (onFoot() || inTown()) return "town";
        if (ctx.car.speed < 12) return "slow";
        return "";
    }
    if (ctx.state === "footRun") return ctx.foot && ctx.foot.phase === "walk" && !ctx.foot.chasing ? "" : "foot";
    return "state";
}
function schedTick(dt) {
    if (UW.enc || UW.loading || !live(inParty() ? "pickpocket" : "")) return;
    UW.nextT -= dt;
    if (UW.nextT > 0) return;
    const w = why();
    if (w) { UW.nextT = 2; return; }
    if (!(UW.force.always || chance(SPAWN.roll))) { UW.nextT = rand(SPAWN.retry[0], SPAWN.retry[1]); return; }
    UW.nextT = rand(SPAWN.gap[0], SPAWN.gap[1]);
    spawn(ctx.state === "footRun" || inParty() ? weighted(SPAWN.foot) : weighted(SPAWN.drive));
}
/** A bad guy now: "rager" | "gang" (driving, highway) · "pickpocket" (on foot). → Promise<encounter | null> */
export function spawn(kind, opts = {}) {
    if (kind === "pickpocket") return spawnPickpocket(opts);
    if (inParty()) return Promise.resolve(null);      // (a bad-guy car never joins a party's shared traffic)
    return spawnBadCar(kind, opts);
}

// ── one actor ticks everything (driving AND on foot) ─────────────────────
let actor = null;
function ensureActor() {
    if (actor && ctx.actors.includes(actor)) return;
    actor = addActor({ foot: true, update: dt => { try { tick(dt); } catch (e) { console.error("[underworld] tick", e); } return true; } });
}
function tick(dt) {
    flushRemovals();
    tickTimers();
    const st = ctx.state;
    if (!ctx.paused && (st === "playing" || st === "footRun")) UW.runT += dt;
    if (chasing()) UW.lastHeat = Math.max(UW.lastHeat, stars());
    heatTick(dt);
    const E = UW.enc;
    if (E && !E.loading) { if (E.kind === "pickpocket") pickTick(dt, E); else badTick(dt, E); }
    if (st === "playing" || st === "underworldDeal") { offersTick(dt); mechTick(dt); }
    if (st === "playing") { fixerTick(dt); hotTick(dt); }
    schedTick(dt);
}

function reset(full = true) {
    if (UW.enc) { const E = UW.enc; if (E.kind === "pickpocket") dropPick(E); else dropBad(E); }
    UW.enc = null; UW.loading = null;
    if (UW.offer) { if (UW.offer.kind === "velvel") clearShack(UW.offer); else clearOffer(UW.offer); }
    UW.offer = null;
    clearTimers();
    if (!full) return;
    UW.runT = 0;
    UW.nextT = Math.max(SPAWN.firstAfter, rand(75, 150));
    UW.mechT = rand(SPAWN.mechanic.first, SPAWN.mechanic.first + 120);
    UW.fixT = rand(SPAWN.fixer.first, SPAWN.fixer.first + 90);
    UW.hot = null; UW.flatBy = null; UW.lastHeat = 0;
    UW.runs = (UW.runs || 0) + 1;
}
hook("runStart", () => {
    reset(true);
    actor = null;
    ensureActor();
    applyAlert(true);
    if ((SAVE.owed || 0) > 0 && live(inParty() ? "pickpocket" : "")) later(rand(20, 40), () => payOwed());   // (his mother keeps her word)
}, 4);
hook("update", () => { if (!actor || !ctx.actors.includes(actor)) ensureActor(); });
on("state", ({ to }) => { if (to === "title" || to === "gameover") reset(true); });

// ── the law ──────────────────────────────────────────────────────────────
on("law:warning", () => { try { onWarning(); } catch (e) { console.error("[underworld] warning", e); } });
on("cop:chase", e => { if (e && e.active) UW.lastHeat = Math.max(1, e.heat || 1); });
// took an exit into a town / got out on foot: a car-bound bad guy loses her
on("town:enter", () => { const E = UW.enc; if (E && E.kind !== "pickpocket") dropBad(E); if (UW.offer) reset(false); });
on("foot:start", () => { const E = UW.enc; if (E && E.kind !== "pickpocket" && !E.result) { E.result = "escaped"; E.phase = "leave"; } });

// ── boot: the charge's lines, the jobs, the 📞 reasons, the ✋ spot, settings, the 📒 page ──
on("boot", () => {
    registerCharge();
    registerJobs();
    registerCalls();
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot(tackleSpot);
    if (ctx.meta && ctx.meta.addScrapbookTab) ctx.meta.addScrapbookTab({ id: "underworld", icon: "🕶️", name: "Underworld", render: pageHtml });
    applyAlert(true);
});
addMenuItem("settings", {
    id: "underworld", order: 62,
    label: () => `😈 Bad guys &amp; shady deals <b>${RATE_LABEL[SAVE.rate] || "NORMAL"}</b>`,
    action: () => {
        const i = RATE_ORDER.indexOf(SAVE.rate);
        SAVE.rate = RATE_ORDER[(i + 1) % RATE_ORDER.length];
        dirty();
        applyAlert(true);
    },
});

// ── 📒 the scrapbook page ────────────────────────────────────────────────
css("underworld", `
.uw-page { text-align: left; color: #3E2723; }
.uw-heat { padding: 10px 14px; border-radius: 14px; background: #FFF3E0; margin-bottom: 10px; }
.uw-heat .bar { height: 10px; border-radius: 6px; background: rgba(0,0,0,.08); overflow: hidden; margin: 6px 0 4px; }
.uw-heat .bar i { display: block; height: 100%; background: linear-gradient(90deg, #FFB300, #E53935); }
.uw-rivals { display: grid; gap: 6px; }
.uw-riv { display: flex; gap: 10px; align-items: center; padding: 8px 12px; border-radius: 12px; background: rgba(255,255,255,.7); }
.uw-riv b { display: block; } .uw-riv small { opacity: .75; }
.uw-stats { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; font-size: 13px; }
.uw-stats span { padding: 4px 8px; border-radius: 10px; background: rgba(0,0,0,.06); }
`);
function pageHtml() {
    const h = Math.round(heat()), L = heatLevel();
    const icon = k => (k === "rager" ? "😡" : k === "gang" ? "😎" : "🫳");
    const rv = SAVE.rivals.slice().reverse().map(r => `<div class="uw-riv"><span style="font-size:24px">${icon(r.kind)}</span><span><b>${r.name}</b>
        <small>met ${r.met || 1}× · ${r.busted ? `busted ${r.busted}× · ` : ""}${r.escaped ? `you got away ${r.escaped}×` : ""}${r.last === "won" ? " · he got away" : ""}</small></span></div>`).join("");
    const s = SAVE.stats, n = k => s[k] || 0;
    return `<div class="uw-page">
      <div class="uw-heat"><b>${PAGE.title}</b> · heat <b>${h}</b>/100 · ${L.name}<div class="bar"><i style="width:${h}%"></i></div><small>${PAGE.note}</small></div>
      <div class="uw-rivals">${rv || `<p class="lp-empty">${PAGE.empty}</p>`}</div>
      <div class="uw-stats"><span>🍩 bribes ${n("uwBribes")}</span><span>🕵️ stings ${n("uwStings")}</span><span>🔧 Velvel ${n("uwVelvelFixes") + n("uwVelvelPaints") + n("uwVelvelSales")}</span>
        <span>🕶️ jobs ${n("uwJobs")}</span><span>🚓 bad guys busted ${n("uwCopBusts") + n("uwShomrimBusts")}</span><span>🤼 tackles ${n("uwTackles")}</span></div>
    </div>`;
}

// ── the service ──────────────────────────────────────────────────────────
ctx.underworld = {
    /** 0–100 the street's heat (cools while she plays / while she's away). */
    get heat() { return heat(); },
    get level() { return heatLevel(); },
    addHeat,
    /** The live bad-guy encounter: { kind, phase, result, rival } | null. */
    get enc() { const E = UW.enc; return E ? { kind: E.kind, phase: E.phase, result: E.result, rival: E.rival && E.rival.name, stolen: E.stolen || 0 } : null; },
    /** The roadside offer up the road (Krupnik's cruiser / Velvel's shack): { kind, s, done } | null. */
    get offer() { const O = UW.offer; return O ? { kind: O.kind, s: O.s, done: O.done } : null; },
    get rivals() { return SAVE.rivals.map(r => Object.assign({}, r)); },
    /** The owner's knobs (see data.js): SPAWN (frequencies) + TUNE (numbers). */
    SPAWN, TUNE,
    /** law/bust.js: a crooked officer's offer at a pull-over (or null). */
    bustOffer,
    /** Is the underworld on (enabled, Settings not Off; in a 🎉 party: false — only the pickpocket runs there)? */
    get live() { return live(); },
    /** The gate for one kind ("pickpocket" | "" = the rest): in a 🎉 party only the pickpocket. */
    liveFor: what => live(what),
    /** Why no bad guy can show up right now ("" = it could). */
    why,
    spawn,
    debug: {
        UW, SAVE, rate, reset, spawn, shoulderCop, placeShack, fixerOffer, fixerBlocked, callShomrim, chaverimFlat, shomerAfter, tackle, payOwed,
        get force() { return UW.force; }, get log() { return UW.log; },
        get E() { return UW.enc; }, get O() { return UW.offer; },
    },
};
