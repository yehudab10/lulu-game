// features/community — 📞 PHONE: one phone app, on the phone EVERYWHERE she has it (the highway, a rest
// area, both towns; in the car and on foot), sitting right after 💬 Messages. Contacts: Chaverim, Hatzalah,
// Shomrim, 911 — each with the reasons that make sense RIGHT NOW (her car's banged up · she's hurt · a
// minivan with a flat down the street · she's wanted and calling 911 anyway), or one line in their voice
// when there's honestly nothing to call about — then 👩 Ima (a sweater; no reward) and whatever other
// features add (ctx.community.addContact: world's 🏡 Family & places). Picking a reason closes the phone
// and places the call: the in-car call card while she drives (journey's ctx.phone.call), a short
// dialogue on foot. Then somebody actually shows up (help.js) — in town, on the highway or across a
// rest area's lot; at speed the call card says to pull over.
import { ctx, emit, on } from "../../core/ctx.js";
import { say } from "../../core/dialog.js";
import * as H from "../../hud.js";
import { CM, onFoot, pick, luluSay, sfx, stat, townCfg, townId, later, local, whenLoaded } from "./common.js";
import { request, busy, ownStub, healReady, healLeft } from "./help.js";
import { callFor } from "./scenes.js";
import { startShomrim } from "./shomrim.js";
import { ORGS, SCENES, LULU_CALL, SHOMRIM, POLICE, NOTHING, NOTHING_BY, DISPATCH, IMA_CALL } from "./lines.js";

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

const shomrimHere = () => { const c = townCfg(); return !!(c && c.orgs.shomrim); };
/** Nitro from Chaverim: once every GAS_GAP s of game time (a refill on tap would be free nitro forever). */
export const GAS_GAP = 90;
const gasReady = () => ctx.time - (CM.gasAt == null ? -1e9 : CM.gasAt) >= GAS_GAP;
/** The line an org says when there's nothing to call about right now. */
export function nothingLine(org) {
    if (org === "shomrim" && !shomrimHere()) return NOTHING_BY.shomrimRoad;
    return local(NOTHING_BY[org] || NOTHING);
}

/** What she can call each org about, right now: [{ id, icon, label, sub, run }] */
export function reasons(org) {
    const out = extraFor(org);
    const sc = sceneFor(org);
    if (sc) out.push({ id: "scene", icon: sc.def.icon, label: `Report ${sc.def.label}`, sub: `${sc.at.street || "on the shoulder"} · a mitzvah`, run: () => callScene(sc) });
    if (org === "chaverim") {
        if (inCar() && damaged()) out.push({ id: "fix", icon: "🔧", label: "My car's banged up", sub: "dents out, +❤️, tyres", run: () => dispatch(org, "fix") });
        if (onFoot() && ownStub()) out.push({ id: "unlock", icon: "🔑", label: "My car won't start", sub: "a jump, a bracha, back behind the wheel", run: () => dispatch(org, "unlock") });
        if (inCar() && (G().boost || 0) < 0.9 && gasReady()) out.push({ id: "gas", icon: "⛽", label: "I'm out of gas", sub: "a full nitro tank, handed through the window", run: () => dispatch(org, "gas") });
        if (inCar()) out.push({ id: "tow", icon: "🪝", label: "I'm stuck", sub: "they'll put you back on the street", run: () => dispatch(org, "tow") });
    } else if (org === "hatzalah") {
        if ((G().hearts || 0) < (G().maxHearts || 3)) out.push({ id: "patch", icon: "🤕", label: "I'm hurt", sub: healReady() ? "+❤️ and a granola bar" : healLeft() ? "a granola bar (they JUST patched you — +❤️ again in a minute)" : "a granola bar and a lecture (no more ❤️ this drive)", run: () => dispatch(org, "patch") });
        out.push({ id: "fine", icon: "🙂", label: "Just… checking you're open", sub: "they will come anyway", run: () => dispatch(org, "fine") });
    } else if (org === "shomrim") {
        // (the patrol is a neighbourhood thing: in a town with Shomrim only — other features' reasons still count)
        if (!shomrimHere()) { /* nothing of their own off town */ }
        else if (wanted()) out.push({ id: "self", icon: "🕵️", label: "Report a suspicious pink convertible", sub: "(it's you)", run: () => shomrimSelf() });
        else out.push({ id: "visit", icon: "🕵️", label: "Report a suspicious car", sub: "they LOVE a call", run: () => dispatch(org, "visit") });
        if (shomrimHere()) out.push({ id: "geese", icon: "🦢", label: "The geese are after me", sub: "a long shot", run: () => dispatch(org, "geese") });
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
    const ln = [LULU_CALL[org], ...lines].map(local);
    if (org !== "ima") {
        CM.stats.calls = (CM.stats.calls || 0) + 1;
        if (CM.save) { CM.save.calls = (CM.save.calls || 0) + 1; if (CM.saveSoon) CM.saveSoon(); }
        stat("communityCalls", 1);
    }
    emit("community:call", { org });
    sfx.dial();
    const finish = () => { try { if (then) then(); } catch (e) { console.error("[community] call", e); } };
    if (inCar() && ctx.phone && ctx.phone.call && !(ctx.phone.busy && ctx.phone.busy())) {
        const c = ctx.phone.call({ always: true, from: O.call, emoji: O.emoji, color: O.color, lines: ln, ring: 0.01, talk: Math.max(3.5, ln.length * 1.9), declinable: false,
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
    const D = DISPATCH[org], where = townId() === "midwood" ? "midwood" : townId() ? "town" : "road";
    const first = D[where] || D.town;
    const lines = org === "shomrim" ? [first, kind === "geese" ? "Geese. Okay. We'll send… somebody brave." : "A suspicious car? We're on it. We're SO on it."] : [first];
    if (kind === "gas") CM.gasAt = ctx.time;
    // driving at speed: the call card says to pull over (gas is handed through the window — no need to stop)
    const done = inCar() && kind !== "gas" && ctx.car.speed > 9 ? DISPATCH.pullOver : "";
    whenLoaded(() => {});                       // (the org cars load while they talk — Story / a rest area / Midwood load on demand)
    callOut(org, lines, () => whenLoaded(() => { if (!request(kind, { byCall: true })) H.toast(`${ORGS[org].emoji} …they couldn't get through the traffic.`, ""); }), done);
}
/** 👩 Ima: one call, one line about a sweater. No reward. */
function callIma() {
    const ln = pick(IMA_CALL);
    stat("imaCalls", 1);
    callOut("ima", ln, null, "🧥 Wear a sweater.");
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
/** Contacts other features add below Ima (ctx.community.addContact): { id, icon, name, tag, color, render(el) }. */
export const CONTACTS = [];
export function addContact(def) {
    if (!def || !def.id) return null;
    const i = CONTACTS.findIndex(c => c.id === def.id);
    if (i >= 0) CONTACTS[i] = def; else CONTACTS.push(def);
    return def;
}
const HELP = ["chaverim", "hatzalah", "shomrim", "police"];
// (back on the list: the focus on the row she came from, not wherever the slot number lands)
const refocus = (api, from) => { if (from && api.focus) api.focus(from.startsWith("ct:") ? `[data-ct="${from.slice(3)}"]` : `[data-org="${from}"]`); };
const row = (attr, O, name, tag, meta = "") => `<button class="btn lp-row" ${attr}><span class="lp-av" style="background:${O.color}">${O.emoji}</span><span class="lp-tx"><b>${esc(name)}</b><small>${esc(tag)}</small></span>${meta}</button>`;
function where() {
    const cfg = townCfg();
    if (cfg && ctx.town && ctx.town.name) return ctx.town.name;
    if (ctx.exits && ctx.exits.inside) return ctx.exits.inside;
    return "On the road";
}
// (the phone closed: next time the app opens on the contacts, not on whichever org she looked at last)
on("phone:close", () => { CM.view = null; });
export function registerApp() {
    if (!ctx.phone || !ctx.phone.addApp) return;
    ctx.phone.addApp({
        // (right after 💬 Messages — where a phone's Phone app sits; the old 🏡 Family app is a contact in here now)
        id: "community", icon: "📞", name: "Contacts", order: 22, color: "#43A047", color2: "#3949AB",
        visible: () => !(ctx.party && ctx.party.active) || ctx.enabled("community"),
        badge: () => (CM.scene && CM.scene.phase === "wait" ? "!" : null),
        back(api) { if (CM.view) { const from = CM.view; CM.view = null; api.refresh(); refocus(api, from); return true; } return false; },
        render(el, api, arg) {
            if (arg && arg.org && CM.viewArg !== arg) { CM.view = arg.org; CM.viewArg = arg; }
            const org = CM.view;
            if (!org) {
                el.innerHTML = `<div class="lp-note">📞 <b>${esc(where())}</b> · who you gonna call?</div>`
                    + HELP.map(o => row(`data-org="${o}"`, ORGS[o], ORGS[o].name, ORGS[o].tag, sceneFor(o) ? '<span class="lp-meta">!</span>' : "")).join("")
                    + row(`data-ima="1"`, ORGS.ima, ORGS.ima.name, ORGS.ima.tag, '<span class="lp-meta">📞</span>')
                    + CONTACTS.map(c => row(`data-ct="${esc(c.id)}"`, { emoji: c.icon, color: c.color || "#78909C" }, c.name, c.tag || "")).join("")
                    + `<p class="lp-fine">Volunteer orgs, a hotline, the actual police, and your mother. Not affiliated with anyone real.</p>`;
                el.querySelectorAll("[data-org]").forEach(b => b.addEventListener("click", () => { CM.view = b.dataset.org; api.refresh({ top: true }); }));
                el.querySelectorAll("[data-ct]").forEach(b => b.addEventListener("click", () => { CM.view = "ct:" + b.dataset.ct; api.refresh({ top: true }); }));
                const ima = el.querySelector("[data-ima]");
                if (ima) ima.addEventListener("click", () => { CM.view = null; api.close(); callIma(); });
                return;
            }
            if (org.startsWith("ct:")) {
                const c = CONTACTS.find(x => "ct:" + x.id === org);
                el.innerHTML = `<div class="lp-ct"></div><button class="btn lp-row lp-mini" id="cmBack">‹ Contacts</button>`;
                try { if (c && c.render) c.render(el.querySelector(".lp-ct")); } catch (e) { console.error("[community] contact", e); }
            } else {
                const O = ORGS[org], list = reasons(org);
                el.innerHTML = `<div class="lp-card"><span class="lp-av" style="background:${O.color}">${O.emoji}</span><span class="lp-tx"><b>${esc(O.name)}</b><small>${esc(O.tag)}</small></span></div>`
                    + (busy() && org !== "police" ? `<p class="lp-note">🚗 Somebody's already on the way to you.</p>` : "")
                    + (ctx.law && ctx.law.chasing && org !== "police" ? `<p class="lp-note">🚓 Lose the cops first — nobody pulls up mid-chase.</p>` : "")
                    + (list.length ? list.map((r, i) => `<button class="btn lp-row" data-i="${i}"><span class="lp-av">${r.icon}</span><span class="lp-tx"><b>${esc(local(r.label))}</b><small>${esc(local(r.sub || ""))}</small></span><span class="lp-meta">📞</span></button>`).join("") : `<p class="lp-empty">${esc(nothingLine(org))}</p>`)
                    + `<button class="btn lp-row lp-mini" id="cmBack">‹ Contacts</button>`;
                el.querySelectorAll("[data-i]").forEach(b => b.addEventListener("click", () => {
                    const r = list[+b.dataset.i];
                    if (!r) return;
                    CM.view = null;
                    api.close();
                    r.run();
                }));
            }
            const bk = el.querySelector("#cmBack");
            if (bk) bk.addEventListener("click", () => { const from = CM.view; CM.view = null; api.refresh(); refocus(api, from); });
        },
    });
}
/** Tests / debug: place a call without the phone UI. */
export function debugCall(org, id) {
    if (org === "ima") { callIma(); return true; }
    const r = reasons(org).find(x => x.id === id);
    if (!r) return false;
    r.run();
    return true;
}
export { SCENES };
