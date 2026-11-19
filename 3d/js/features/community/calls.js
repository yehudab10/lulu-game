// features/community — 📞 CALL: one phone app (only while she's in a town with volunteer orgs)
// with four contacts — Chaverim, Hatzalah, Shomrim, 911 — and, for each, the reasons that
// make sense RIGHT NOW (her car's banged up · she's hurt · a minivan with a flat down the
// street · she's wanted and calling 911 anyway). Picking one closes the phone and places the
// call: the in-car call card while she drives (journey's ctx.phone.call), a short dialogue on
// foot. Then somebody actually shows up.
import { ctx, emit } from "../../core/ctx.js";
import { say } from "../../core/dialog.js";
import * as H from "../../hud.js";
import { CM, onFoot, pick, luluSay, sfx, stat, townCfg, later } from "./common.js";
import { request, busy, ownStub } from "./help.js";
import { callFor } from "./scenes.js";
import { startShomrim } from "./shomrim.js";
import { ORGS, SCENES, LULU_CALL, SHOMRIM, POLICE, NOTHING } from "./lines.js";

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const inCar = () => ctx.state === "playing" && !onFoot();
const wanted = () => !!(ctx.law && (ctx.law.wanted > 0 || ctx.law.chasing || ctx.law.fugitive));
const G = () => ctx.G;
const damaged = () => (G().hearts || 0) < (G().maxHearts || 3) || !!(ctx.feel && ctx.feel.damage && ctx.feel.damage.stage > 0) || !!(ctx.streets && ctx.streets.flat);
const sceneFor = org => { const sc = CM.scene; return sc && sc.org === org && sc.phase === "wait" ? sc : null; };

/** Reasons other features add (ctx.community.addReason): org → [fn() → reason | null]. */
export const EXTRA = new Map();
export function addReason(org, fn) {
    if (!EXTRA.has(org)) EXTRA.set(org, []);
    EXTRA.get(org).push(fn);
    return () => { const l = EXTRA.get(org), i = l ? l.indexOf(fn) : -1; if (i >= 0) l.splice(i, 1); };
}
function extraFor(org) {
    const out = [];
    for (const fn of EXTRA.get(org) || []) { try { const r = fn(); if (r) out.push(r); } catch (e) { console.error("[community] reason", e); } }
    return out;
}
/** Orgs with a reason from another feature right now (the 📞 app shows them even off-town). */
export function extraOrgs() { return ["chaverim", "hatzalah", "shomrim"].filter(o => extraFor(o).length); }

/** What she can call each org about, right now: [{ id, icon, label, sub, run }] */
export function reasons(org) {
    const out = extraFor(org);
    const sc = sceneFor(org);
    if (sc) out.push({ id: "scene", icon: sc.def.icon, label: `Report ${sc.def.label}`, sub: `${sc.at.street || "on the shoulder"} · a mitzvah`, run: () => callScene(sc) });
    if (org === "chaverim") {
        if (inCar() && damaged()) out.push({ id: "fix", icon: "🔧", label: "My car's banged up", sub: "dents out, +❤️, tyres", run: () => dispatch(org, "fix") });
        if (onFoot() && ownStub()) out.push({ id: "unlock", icon: "🔑", label: "My car won't start", sub: "a jump, a bracha, back behind the wheel", run: () => dispatch(org, "unlock") });
        if (inCar() && (G().boost || 0) < 0.9) out.push({ id: "gas", icon: "⛽", label: "I'm out of gas", sub: "a full nitro tank, handed through the window", run: () => dispatch(org, "gas") });
        if (inCar()) out.push({ id: "tow", icon: "🪝", label: "I'm stuck", sub: "they'll put you back on the street", run: () => dispatch(org, "tow") });
    } else if (org === "hatzalah") {
        if ((G().hearts || 0) < (G().maxHearts || 3)) out.push({ id: "patch", icon: "🤕", label: "I'm hurt", sub: "+❤️ and a granola bar", run: () => dispatch(org, "patch") });
        out.push({ id: "fine", icon: "🙂", label: "Just… checking you're open", sub: "they will come anyway", run: () => dispatch(org, "fine") });
    } else if (org === "shomrim") {
        if (wanted()) out.push({ id: "self", icon: "🕵️", label: "Report a suspicious pink convertible", sub: "(it's you)", run: () => shomrimSelf() });
        else out.push({ id: "visit", icon: "🕵️", label: "Report a suspicious car", sub: "they LOVE a call", run: () => dispatch(org, "visit") });
        out.push({ id: "geese", icon: "🦢", label: "The geese are after me", sub: "a long shot", run: () => dispatch(org, "geese") });
    } else if (org === "police") {
        if (wanted()) {
            out.push({ id: "self", icon: "🚨", label: onFoot() ? "Report a wanted woman on foot" : "Report a pink convertible driving like a maniac", sub: "what could go wrong", run: () => police("self") });
            out.push({ id: "surrender", icon: "🙋‍♀️", label: "Turn myself in", sub: "honestly? respect", run: () => police("surrender") });
        } else {
            out.push({ id: "parked", icon: "🚗", label: "Report the triple-parked minivans", sub: "on Main St. And everywhere.", run: () => police("parked") });
            out.push({ id: "geese", icon: "🦢", label: "Report the geese", sub: "they're organised", run: () => police("geese") });
        }
    }
    // a 🎉 party without the law: nothing that would start a chase / an arrest
    if (ctx.party && ctx.party.active && !ctx.enabled("law")) return out.filter(r => r.id !== "self" && r.id !== "surrender");
    return out;
}

/** Place a call: the call card while she drives, a little dialogue on foot. then() runs when they hang up. */
export function callOut(org, lines, then = null, done = "") {
    const O = ORGS[org];
    const ln = [LULU_CALL[org], ...lines];
    CM.stats.calls = (CM.stats.calls || 0) + 1;
    if (CM.save) { CM.save.calls = (CM.save.calls || 0) + 1; if (CM.saveSoon) CM.saveSoon(); }
    stat("communityCalls", 1);
    emit("community:call", { org });
    sfx.dial();
    const finish = () => { try { if (then) then(); } catch (e) { console.error("[community] call", e); } };
    if (inCar() && ctx.phone && ctx.phone.call && !(ctx.phone.busy && ctx.phone.busy())) {
        const c = ctx.phone.call({ from: O.call, emoji: O.emoji, color: O.color, lines: ln, ring: 0.01, talk: Math.max(3.5, ln.length * 1.9), declinable: false,
            talkEmoji: O.emoji, doneText: () => done, onDone: () => finish() });
        if (c) return true;
    }
    if (onFoot() && ctx.state === "footRun") {
        (async () => {
            await say("LULU", ln[0], { emoji: "📱", color: "#E91E63" });
            for (const l of ln.slice(1)) await say(O.call, l, { emoji: O.emoji, color: O.color });
            finish();
        })().catch(e => console.error(e));
        return true;
    }
    finish();
    return true;
}

function dispatch(org, kind) {
    if ((ctx.law && ctx.law.chasing) || (CM.chase && org !== "shomrim")) { H.toast(`${ORGS[org].emoji} "Lose the cops first, THEN call us."`, ""); return; }
    if (busy()) { H.toast(`${ORGS[org].emoji} Somebody's already on the way!`, ""); return; }
    const lines = org === "chaverim" ? ["Chaverim, where are you? …Okay. Don't move. Somebody's two minutes away. Somebody's ALWAYS two minutes away."]
        : org === "hatzalah" ? ["Hatzalah. Where are you? …We see you. Turn around."]
        : ["Shomrim hotline, what's the situation?", kind === "geese" ? "Geese. Okay. We'll send… somebody brave." : "A suspicious car? We're on it. We're SO on it."];
    callOut(org, lines, () => { if (!request(kind, { byCall: true })) H.toast(`${ORGS[org].emoji} …they couldn't get through the traffic.`, ""); });
}
function callScene(sc) {
    const lines = sc.org === "hatzalah" ? ["Hatzalah. A bochur off an e-bike? We're — actually we're already there."] : [`Chaverim. ${sc.def.label}? On it. Tell them not to touch anything.`];
    callOut(sc.org, lines, () => callFor(sc, true));
}
function shomrimSelf() {
    callOut("shomrim", SHOMRIM.report.self, () => startShomrim("FILING A FALSE REPORT (ON YOURSELF)", { msg: "🔦 SHE REPORTED HERSELF!", withCops: 0 }));
}
function police(kind) {
    const law = ctx.law;
    if (kind === "parked") return callOut("police", POLICE.parked, null, "📵 They hung up on you.");
    if (kind === "geese") return callOut("police", POLICE.geese, null, "🦢 Help is (not) on the way.");
    if (kind === "surrender") {
        return callOut("police", POLICE.surrender, () => {
            const ch = (law && law.warrants && law.warrants.length ? law.warrants : ["TURNING HERSELF IN"]).slice(0, 3);
            stat("communitySurrenders", 1);
            later(0.4, () => { try { if (ctx.foot && ctx.foot.active && ctx.foot.end) ctx.foot.end("arrest"); if (ctx.town && ctx.town.active) ctx.town.leave("quiet"); if (law && law.arrest) law.arrest(ch, {}); } catch (e) { console.error(e); } });
        });
    }
    // reporting HERSELF: the trace comes back to the pink convertible
    return callOut("police", onFoot() ? POLICE.selfFoot : POLICE.self, () => {
        stat("communitySelfReports", 1);
        if (!law) return;
        if (law.chasing) { law.startChase("PRANK-CALLING 911", { msg: "📞 SHE CALLED 911 ON HERSELF!", heat: (law.wanted || 1) + 1 }); return; }
        if (!(law.startChase && law.startChase("PRANK-CALLING 911", { msg: "📞 SHE CALLED 911 ON HERSELF!", heat: 2 })) && law.addWarrant) law.addWarrant("PRANK-CALLING 911");
    }, "🚓 …they're tracing it.");
}

// ── the app ──────────────────────────────────────────────────────────────
export function registerApp() {
    if (!ctx.phone || !ctx.phone.addApp) return;
    ctx.phone.addApp({
        id: "community", icon: "📞", name: "Call", order: 65, color: "#3949AB", color2: "#E53935",
        visible: () => (!!townCfg() || extraOrgs().length > 0) && (!(ctx.party && ctx.party.active) || ctx.enabled("community")),
        badge: () => (CM.scene && CM.scene.phase === "wait" ? "!" : null),
        back(api) { if (CM.view) { CM.view = null; api.refresh(); return true; } return false; },
        render(el, api, arg) {
            if (arg && arg.org && CM.viewArg !== arg) { CM.view = arg.org; CM.viewArg = arg; }
            const cfg = townCfg(), org = CM.view;
            if (!org) {
                const xo = extraOrgs();
                const orgs = ["chaverim", "hatzalah", "shomrim", "police"].filter(o => o === "police" || (cfg && cfg.orgs[o]) || xo.includes(o));
                el.innerHTML = `<div class="lp-note">📞 <b>${esc((cfg && ctx.town && ctx.town.name) || "On the road")}</b> · who you gonna call?</div>` + orgs.map(o => {
                    const O = ORGS[o], n = reasons(o).length;
                    return `<button class="btn lp-row" data-org="${o}"><span class="lp-av" style="background:${O.color}">${O.emoji}</span><span class="lp-tx"><b>${esc(O.name)}</b><small>${esc(O.tag)}</small></span>${sceneFor(o) ? '<span class="lp-meta">!</span>' : n ? "" : ""}</button>`;
                }).join("") + `<p class="lp-fine">Volunteer orgs, a hotline, and the actual police. Not affiliated with anyone real.</p>`;
                el.querySelectorAll("[data-org]").forEach(b => b.addEventListener("click", () => { CM.view = b.dataset.org; api.refresh(); }));
                return;
            }
            const O = ORGS[org], list = reasons(org);
            el.innerHTML = `<div class="lp-card"><span class="lp-av" style="background:${O.color}">${O.emoji}</span><span class="lp-tx"><b>${esc(O.name)}</b><small>${esc(O.tag)}</small></span></div>`
                + (busy() && org !== "police" ? `<p class="lp-note">🚗 Somebody's already on the way to you.</p>` : "")
                + (ctx.law && ctx.law.chasing && org !== "police" ? `<p class="lp-note">🚓 Lose the cops first — nobody pulls up mid-chase.</p>` : "")
                + (list.length ? list.map((r, i) => `<button class="btn lp-row" data-i="${i}"><span class="lp-av">${r.icon}</span><span class="lp-tx"><b>${esc(r.label)}</b><small>${esc(r.sub || "")}</small></span><span class="lp-meta">📞</span></button>`).join("") : `<p class="lp-empty">${esc(NOTHING)}</p>`)
                + `<button class="btn lp-row lp-mini" id="cmBack">‹ Contacts</button>`;
            el.querySelectorAll("[data-i]").forEach(b => b.addEventListener("click", () => {
                const r = list[+b.dataset.i];
                if (!r) return;
                CM.view = null;
                api.close();
                r.run();
            }));
            const bk = el.querySelector("#cmBack");
            if (bk) bk.addEventListener("click", () => { CM.view = null; api.refresh(); });
        },
    });
}
/** Tests / debug: place a call without the phone UI. */
export function debugCall(org, id) {
    const r = reasons(org).find(x => x.id === id);
    if (!r) return false;
    r.run();
    return true;
}
export { SCENES };
