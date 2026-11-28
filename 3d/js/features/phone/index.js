// ─────────────────────────────────────────────────────────────────────────
//  features/phone — 📱 LULU'S PHONE: one GTA-style entry point for the extras,
//  REPLACING buttons instead of adding them.
//
//   ui.js     the handset (a restyled showScreen card: it pauses the game like the
//             pause menu), the app registry, the home grid, the corner button
//   inbox.js  💬 Messages: every ctx.phone.text() is stored + threaded (last 50, 3D
//             save), unread badges, the "Mishpacha 💕🙄" family group chat
//   apps.js   🗺️ Map · 📻 Radio · 💼 Jobs · 🎨 Paint & Pray · 📸 Camera
//
//  Open it: PlayStation touchpad (Xbox / Switch: L3) · Tab · the 📱 corner button
//  (it takes the ❚❚ spot while she's driving or walking; the phone's ☰ Menu — or
//  Start / OPTIONS — is the full pause menu; Esc / P / ○ go back). PS L3 = the story map.
//
//  ctx.phone (journey owns call() / text() and the call card) gains:
//    addApp({ id, icon, name, order, visible?, badge?, open?, render?(el, api) })
//    addPin({ id, order?, visible?, row() → { icon, color, title, sub, badge }, render(el, api) }) — a row in
//      💬 Messages instead of a 10th app (the home grid stays ONE 3 × 3 screen: 9 apps solo and in a party)
//    openPhone(appId?, arg?) · closePhone() · isOpen · apps() · inbox {…} · _dbg
//  and text() also stores the message in the inbox (tap the bubble → that thread).
//  Events: phone:open {app} · phone:close {how} · phone:app {app} · phone:text {from, thread, msg}
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on, hook, addMenuItem, css } from "../../core/ctx.js";
import { input, glyph } from "../../input.js";
import { store, saveSoon } from "../../core/save.js";
import { pause, setControlRow } from "../../core/screens.js";
import * as H from "../../hud.js";
import "./style.js";
import { APPS, PH, PHONE_STATES, addApp, openPhone, closePhone, canOpen, openApp, refresh, buildCorner, refreshCorner, visibleApps, partyOn } from "./ui.js";
import { INBOX, post, unread, threads, markRead, clearInbox, onInbox, view, familyLines, addPin, pins, needs, shown } from "./inbox.js";
import "./apps.js";
import { ONEGAME } from "../onegame/switches.js";

const S = store("phone", { hinted: false });

// ── ctx.phone: extend journey's (or stand alone without it) ────────────────
const phone = ctx.phone || (ctx.phone = { busy: () => false });
const bubble = phone.text ? phone.text.bind(phone) : null;
/** A text: the driving bubble (journey) AND the inbox. opts { from, emoji, color, msg, dur, thread?, need? }
 *  ci/hud landing 3: a text that doesn't need her (inbox.js › needs) doesn't happen at all — no inbox line AND no card
 *  on the HUD (it would only move the clutter onto the road); the "phone:text" event (quiet: true) still fires. → the
 *  card, or null. */
phone.text = function text(opts = {}) {
    const m = post(opts);
    // (opts.react: a line that answers something she JUST did — Ima when she walks off the road — shows its card, isn't
    //  kept, and never while she's in an activity)
    if (!m && !(opts.react && !(ctx.engaged && ctx.engaged()))) return null;
    let el = null;
    if (bubble) { try { el = bubble(opts); } catch (e) { console.error("[phone] bubble", e); } }
    else H.toast(`💬 ${m.from}: ${m.msg}`, "pink");
    if (el && el.addEventListener && m) {
        el.style.cursor = "pointer";
        el.title = "Open in Messages";
        el.addEventListener("click", e => { e.stopPropagation(); if (!PH.open) openPhone("messages", { thread: m.k }); });
    }
    return el;
};
Object.assign(phone, {
    addApp, openPhone, closePhone,
    /** A pinned row in 💬 Messages instead of an app (the phone stays one 3 × 3 screen) — see inbox.js › addPin. */
    addPin,
    /** Visible apps, in order (ids). */
    apps: () => visibleApps().map(a => a.id),
    /** Pinned rows showing in 💬 Messages now (ids). */
    pins,
    inbox: { post, unread, threads, markRead, clear: clearInbox, get msgs() { return INBOX.msgs; }, familyLines, needs, shown },
    _dbg: { PH, APPS, view, canOpen, openApp, refresh },
});
Object.defineProperty(phone, "isOpen", { get: () => PH.open, configurable: true });

// ── input: touchpad / Tab / L3 (Xbox) open + close; PS L3 = the map shortcut ──
// Priority 50 so we run BEFORE other "hud" hooks and can consume the edge (meta's
// scrapbook-on-touchpad only applies on the title / pause menu then).
let keyHint = false;
hook("hud", () => {
    const P = input.pressed;
    if (PH.open) {
        if (P.phone) { closePhone(); P.phone = P.map = false; }
        return;
    }
    if (P.phone || P.map) {
        if (P.phone && canOpen()) { if (openPhone()) P.phone = P.map = false; }
        else if (!P.phone && P.map && ONEGAME.story && canOpen() && ctx.journey && ctx.journey.openMap && !partyOn()) {
            if (ctx.journey.openMap({ from: "phone" })) P.map = false;
        }
    }
    // the "Tab / TOUCHPAD" hint under the 📱 for the first seconds of a drive
    const G = ctx.G, want = input.device !== "touch" && ctx.state === "playing" && (G.runTime || 0) < 12;
    if (want !== keyHint) { keyHint = want; refreshCorner(null, want); }
    // one gentle intro, once per save
    // (not over the first-drive tutorial's cards: both came up together at a new player's first pull-out; ci/sweep-phone)
    if (!S.hinted && ctx.state === "playing" && (G.runTime || 0) > 8 && ctx.enabled("phone") && !H.popupsBlocked() && !G.tutorial) {
        S.hinted = true; saveSoon();
        H.banner(`<b>📱 Lulu's phone</b><small>map · messages · radio · jobs — ${input.device === "touch" ? "tap 📱 up top" : "press " + glyph("phone")}</small>`, 3600, { key: "phone" });
    }
}, 50);

// ── the corner button + the pause menu + the button guide ─────────────────
on("boot", () => {
    buildCorner(() => { if (PH.open) closePhone(); else if (!openPhone()) pause(); });
    refreshCorner(waiting(), false);
    // a tap outside the handset closes it
    const scr = document.getElementById("screen");
    if (scr) scr.addEventListener("click", e => { if (PH.open && e.target === scr) closePhone(); });
});
onInbox(() => refreshCorner(waiting()));
// (the 📱 badge: only what waits for HER — kept messages she hasn't read + friends' requests / asks to join; never news)
function waiting() {
    let n = unread();
    try { const F = ctx.friends; if (F) n += (F.joinAsks() || []).length + ["mp", "party", "code"].reduce((k, c) => k + ((F.incoming(c) || []).length || 0), 0); } catch (e) { /* no friends */ }
    return n;
}
for (const ev of ["friends:asks", "friends:joinAsk", "friends:made"]) on(ev, () => refreshCorner(waiting()));
on("device", () => refreshCorner(null, keyHint));
on("state", ({ to }) => {
    document.body.classList.toggle("phone-ok", PHONE_STATES.has(to));
    if (PH.open && !PHONE_STATES.has(to)) { PH.open = false; PH.app = null; document.body.classList.remove("phone-open"); }
});
on("photo", ({ open }) => { if (open && PH.open) { PH.open = false; document.body.classList.remove("phone-open"); } });
addMenuItem("pause", {
    id: "phone", order: 11, group: "tools", short: "Phone",
    label: () => { const n = waiting(); return `📱 Phone${n ? ` <span class="lp-pill">${n}</span>` : ""}`; },
    visible: () => PHONE_STATES.has(ctx.state),
    action: () => openPhone(),
});
setControlRow("phone", "📱 Lulu's phone", "interact");
if (ONEGAME.story) setControlRow("map", "🗺️ Story map (shortcut)");      // (the Story Trip is hidden for now: L3 stays the scrapbook)

css("phone-pill", `.lp-pill { background: #FF3B30; color: #fff; border-radius: 999px; padding: 0 7px; font-size: .8em; margin-left: 4px; }`);
