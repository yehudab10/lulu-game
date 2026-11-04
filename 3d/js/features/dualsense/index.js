// features/dualsense — PS5 DualSense extras over WebHID (Chrome / Edge on a
// computer): the light bar glows in Lulu's car colour (and flashes red/blue
// in a police chase, red when you crash), the player LEDs show your hearts,
// and the adaptive triggers push back — R2 stiffens as you go faster, L2 has
// a firm brake pedal. Everything else (buttons, sticks, rumble) already works
// through the standard Gamepad API in every browser.
//
// WebHID needs a one-time permission: Settings → "🎮 DualSense lights &
// triggers" (a mouse/touch click — browsers don't accept a controller button
// as the gesture). After that it reconnects automatically on later visits.
import { ctx, on, addMenuItem, css } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { SKINS } from "../../car.js";
import { input } from "../../input.js";
import * as H from "../../hud.js";

const SONY = 0x054c;
const PIDS = [0x0ce6 /* DualSense */, 0x0df2 /* DualSense Edge */];
const S = store("dualsense", { enabled: true, triggers: true });
const hidOK = typeof navigator !== "undefined" && navigator.hid && window.isSecureContext;

let dev = null, bt = false, seq = 0;
let want = { r: 233, g: 30, b: 99, leds: 0x15, right: [0x05], left: [0x05], rumbleR: 0, rumbleL: 0 };
let sent = "", lastSend = 0, flashT = 0, flashCol = null;

// ── CRC32 for Bluetooth output reports ──────────────────────────────────
const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
})();
function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (const b of bytes) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

/** The 47-byte "common" output block (see Linux hid-playstation dualsense_output_report_common). */
function commonBlock() {
    const d = new Uint8Array(47);
    d[0] = 0x02 | 0x04 | 0x08 | 0x01;          // valid_flag0: haptics select, right + left trigger effects, rumble
    d[1] = 0x04 | 0x10 | 0x02;                 // valid_flag1: light bar, player LEDs, (power save ctl)
    d[2] = want.rumbleR; d[3] = want.rumbleL;  // motors (we let the Gamepad API do most rumble)
    const tr = S.triggers ? want.right : [0x05], tl = S.triggers ? want.left : [0x05];
    d.set(tr.slice(0, 11), 10);
    d.set(tl.slice(0, 11), 21);
    d[38] = 0x02;                              // valid_flag2: light bar setup control
    d[41] = 0x02;                              // light bar setup: take over from the system fade
    d[42] = 0x00;                              // LED brightness: full
    d[43] = want.leds & 0x1f;
    d[44] = want.r; d[45] = want.g; d[46] = want.b;
    return d;
}

async function send(force = false) {
    if (!dev || !dev.opened) return;
    const key = JSON.stringify(want);
    const now = performance.now();
    if (!force && key === sent && now - lastSend < 2000) return;
    if (!force && now - lastSend < 60) return;
    sent = key; lastSend = now;
    try {
        if (!bt) {
            await dev.sendReport(0x02, commonBlock());
        } else {
            const d = new Uint8Array(77);
            d[0] = (seq++ & 0x0f) << 4;
            d[1] = 0x10;
            d.set(commonBlock(), 2);
            const crc = crc32(new Uint8Array([0xA2, 0x31, ...d.slice(0, 73)]));
            d[73] = crc & 0xff; d[74] = (crc >>> 8) & 0xff; d[75] = (crc >>> 16) & 0xff; d[76] = (crc >>> 24) & 0xff;
            await dev.sendReport(0x31, d);
        }
    } catch (e) {
        console.warn("DualSense output failed", e);
    }
}

async function open(d) {
    try {
        if (!d.opened) await d.open();
        dev = d;
        // Bluetooth DualSense exposes output report 0x31; USB uses 0x02.
        bt = d.collections.some(c => (c.outputReports || []).some(r => r.reportId === 0x31));
        input.padKind = "ps";
        update(true);
        H.toast(`🎮 DualSense ${bt ? "(Bluetooth)" : "(USB)"} — lights & triggers on!`, "pink");
        return true;
    } catch (e) {
        console.warn("DualSense open failed", e);
        return false;
    }
}

async function connect() {
    if (!hidOK) return false;
    try {
        const list = await navigator.hid.requestDevice({ filters: PIDS.map(productId => ({ vendorId: SONY, productId })) });
        if (list && list[0]) { S.enabled = true; saveSoon(); return open(list[0]); }
    } catch (e) { console.warn(e); }
    return false;
}

async function autoConnect() {
    if (!hidOK || !S.enabled || ctx.TEST) return;
    try {
        const list = await navigator.hid.getDevices();
        const d = list.find(x => x.vendorId === SONY && PIDS.includes(x.productId));
        if (d) open(d);
    } catch (e) { /* permissions policy etc. */ }
}

function hexRGB(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Recompute what the controller should show for the current moment. */
function update(force = false) {
    if (!dev) return;
    const skin = SKINS[ctx.car ? ctx.car.skinKey : "pink"] || SKINS.pink;
    let [r, g, b] = hexRGB(skin.body);
    if (skin.body === "#212121") [r, g, b] = [255, 64, 129];   // the Black Ninja glows its pink stripe
    const chase = ctx.law && ctx.law.wanted > 0;
    if (chase) { const on = Math.floor(ctx.time * 6) % 2; [r, g, b] = on ? [255, 0, 40] : [0, 60, 255]; }
    if (flashT > 0 && flashCol) [r, g, b] = flashCol;
    want.r = r; want.g = g; want.b = b;
    const hearts = ctx.G && ctx.G.hearts != null ? ctx.G.hearts : 3;
    want.leds = [0x00, 0x04, 0x0A, 0x15, 0x1B, 0x1F][Math.max(0, Math.min(5, hearts))];
    const def = ctx.states[ctx.state];
    if (def && def.driving && !ctx.paused && ctx.state === "playing") {
        const sp = ctx.car ? ctx.car.speed : 0;
        // R2: continuous resistance (mode 0x01: start position, force) that firms up with speed
        want.right = [0x01, 0x30, Math.min(255, 30 + Math.round(sp * 3.2)), 0, 0, 0, 0, 0, 0, 0, 0];
        // L2: a brake pedal that bites halfway down
        want.left = [0x01, 0x60, 170, 0, 0, 0, 0, 0, 0, 0, 0];
    } else {
        want.right = [0x05]; want.left = [0x05];   // relax the triggers in menus
    }
    send(force);
}

// keep it in sync
let acc = 0;
on("boot", () => { autoConnect(); });
ctx.dualsense = { connect, get connected() { return !!dev; } };
const tick = () => {
    requestAnimationFrame(tick);
    if (!dev) return;
    const now = performance.now();
    acc += 1;
    if (flashT > 0) flashT -= 1 / 60;
    if (acc % 6 === 0) update();
};
requestAnimationFrame(tick);
on("damage", () => { flashT = 0.5; flashCol = [255, 0, 0]; update(true); });
on("skin", () => update(true));
on("state", () => update(true));
on("pause", () => update(true));
if (hidOK) navigator.hid.addEventListener("disconnect", e => { if (e.device === dev) { dev = null; H.toast("DualSense lights disconnected"); } });

// Settings entries (only where WebHID exists: Chrome / Edge on a computer)
css("dualsense", `.btn.setting.ds b { background: #2979ff; color: #fff; }`);
if (hidOK) {
    addMenuItem("settings", {
        id: "dualsense", order: 10,
        label: () => `🎮 DualSense lights & triggers <b>${dev ? "ON" : "CONNECT"}</b>`,
        action: async () => { if (!dev) await connect(); else { S.triggers = !S.triggers; update(true); H.toast(`Adaptive triggers ${S.triggers ? "on" : "off"}`); } },
    });
}
