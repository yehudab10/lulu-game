// features/netping — 📶 SHOW CONNECTION (PING), optional, OFF by default (the owner, 2026-11-27: "an optional ping
// display button in settings"). ⚙️ › 📶 Show connection: a tiny quiet "📶 48 ms" pill in the top band, next to the
// coins. It times the relay heartbeat the game already sends (multiplayer/net.js › pingRelay: "pi" → the relay's "po"),
// every 10 s while it's on and the game is online — never more often, never while ⚙️ Play online is off (then it says
// "📶 offline"). Colour only when it's bad (≥ 250 ms amber, ≥ 500 ms red). Hidden in Dina's mode. No server change.
import { ctx, css, addMenuItem, emit, hook } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { MP, pingRelay } from "../multiplayer/net.js";

const S = store("netping", { show: false });
const N = { el: null, t: 0, txt: "", cls: "" };
const EVERY = 10;

css("netping", `
#hud .pill.net-ping { font-size: 12px; font-weight: 700; padding: 4px 9px; opacity: .85; font-variant-numeric: tabular-nums; }
#hud .pill.net-ping.slow { background: #FFE082; color: #5D4037; opacity: 1; }
#hud .pill.net-ping.bad { background: #EF9A9A; color: #7F0000; opacity: 1; }
body.tv #hud .pill.net-ping { font-size: 18px; padding: 6px 14px; }
`);

const dinaMode = () => /^dina/.test(ctx.state || "") || !!(ctx.G && ctx.G.mode === "dina");
export const on = () => !!S.show;
export function setOn(v) {
    S.show = !!v; saveSoon(); N.t = 0;
    if (!S.show) show("", "");
    emit("settings", { id: "netPing" });
}
function pill() {
    if (N.el && N.el.isConnected) return N.el;
    const tl = document.querySelector("#hud .hud-tl");
    if (!tl) return null;
    N.el = document.createElement("div");
    N.el.className = "pill net-ping";
    N.el.style.display = "none";
    tl.appendChild(N.el);
    return N.el;
}
function show(txt, cls) {
    const el = txt || N.el ? pill() : null;
    if (!el) return;
    if (txt !== N.txt) { N.txt = txt; el.textContent = txt; el.style.display = txt ? "" : "none"; }
    if (cls !== N.cls) { if (N.cls) el.classList.remove(N.cls); if (cls) el.classList.add(cls); N.cls = cls; }
}
function tick(dt) {
    if (!S.show || dinaMode()) { if (N.txt) show("", ""); return; }
    const online = !!(MP.connected && MP.sock && MP.sock.readyState === 1);
    if (!online) { show("📶 offline", ""); N.t = 0; return; }
    N.t -= dt;
    if (N.t <= 0) { N.t = EVERY; pingRelay(); }
    const r = MP.rtt;
    show(r == null ? "📶 …" : `📶 ${r} ms`, r == null ? "" : r >= 500 ? "bad" : r >= 250 ? "slow" : "");
}
hook("hud", dt => { try { tick(dt || 1 / 60); } catch (e) { console.error("[netping]", e); } });

addMenuItem("settings", {
    id: "netPing", order: 61,
    label: () => `📶 Show connection (ping) <b>${S.show ? "ON" : "OFF"}</b> <small style="opacity:.75">${S.show ? "A small readout by the coins: how fast the game reaches the server" : "Off — nothing on screen"}</small>`,
    action: () => setOn(!S.show),
});

ctx.netping = { get on() { return !!S.show; }, set: setOn, debug: { S, N, tick: dt => tick(dt || 0.2) } };
