// 📥 Install on this PC / phone (roadmap 46 — optional, never pushed). The website can be installed by Chrome / Edge
// (Windows, Mac, Linux) and Chrome (Android): its own window + icon, and much faster starts after the first, because
// the big files stay on the device (the service worker, /sw.js — see its header for what it keeps and the kill switch).
//   • the worker is registered from HERE, once the title is up and the browser is idle — never by a boot script, never
//     inside the iOS app (capacitor://), never on plain http (except localhost); `?sw=off` removes it, so does
//     "off": true in /sw.json (checked at every start).
//   • ⚙️ › "📥 Install on this PC" (or "…on this phone"): only while the browser really offers to install (it sent
//     `beforeinstallprompt`), hidden once installed (display-mode standalone), in the iOS app and on browsers that
//     can't. No pop-up, no nag, no title tile — the browser's own little install bar is held back too.
//   • installed on a computer: ⚙️ › "⛶ Go full screen" / "Leave full screen".
// performance's resource list is capped (250 by default): raised here so the first start's models are all in it.
//   ctx.install.info() → { sw, registered, killed, kept, canInstall, installed, native } (tests)
import { ctx, on, addMenuItem } from "../../core/ctx.js";

const QS = new URLSearchParams(location.search);
// the site root (the worker's scope). Built from pieces on purpose: the iOS app's bundle has no sw.js / sw.json (it never
// registers a worker), and scripts/copy-web.js would flag a literal path to them as missing from the app.
const SITE = "../", SW_FILE = SITE + "sw" + ".js", SW_FLAGS = SITE + "sw" + ".json";
const NATIVE = location.protocol === "capacitor:" || !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
const SECURE = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
const SW_OK = !NATIVE && SECURE && "serviceWorker" in navigator;
const COARSE = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const I = { prompt: null, installed: false, registered: false, killed: false, started: false, kept: null };

try { if (SW_OK && performance.setResourceTimingBufferSize) performance.setResourceTimingBufferSize(2000); } catch (e) { /* fine */ }

const standalone = () => typeof matchMedia === "function" && (matchMedia("(display-mode: standalone)").matches
    || matchMedia("(display-mode: fullscreen)").matches || matchMedia("(display-mode: minimal-ui)").matches) || navigator.standalone === true;

// the browser offers to install: keep the offer for the ⚙️ row (and hold back its own little bar — no pop-ups)
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); I.prompt = e; });
window.addEventListener("appinstalled", () => { I.installed = true; I.prompt = null; });

/** Remove the worker + its caches (?sw=off, the /sw.json kill switch). */
async function removeWorker() {
    I.killed = true;
    try { if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage("gone"); } catch (e) { /* none */ }
    try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch (e) { /* none */ }
    try { for (const k of await caches.keys()) if (k.startsWith("lulu-sw-")) await caches.delete(k); } catch (e) { /* none */ }
    I.registered = false;
}
async function startWorker() {
    if (I.started) return;
    I.started = true;
    if (QS.get("sw") === "off") { await removeWorker(); return; }
    // the kill switch: a tiny flag file, always asked of the network
    try {
        const r = await fetch(SW_FLAGS + "?sw=check", { cache: "no-store" });
        if (r.ok && (await r.json()).off) { await removeWorker(); return; }
    } catch (e) { /* offline: keep whatever is there */ }
    try {
        const first = !navigator.serviceWorker.controller;
        await navigator.serviceWorker.register(SW_FILE, { scope: SITE });
        I.registered = true;
        const ready = await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller && ready.active) ready.active.postMessage("claim");
        // the worker's very first start: hand it the big files this start already downloaded (it keeps them, mostly
        // from the browser's own cache — so the NEXT start is the fast one)
        if (first) {
            const reg = ready;
            const keep = performance.getEntriesByType("resource").map(r => r.name)
                .filter(u => u.startsWith(location.origin) && /\.(glb|mp3|ogg|png|jpg|webp)$|\/vendor\//i.test(new URL(u).pathname));
            navigator.serviceWorker.addEventListener("message", m => { if (m.data && m.data.kept != null) I.kept = m.data.kept; });
            if (reg.active && keep.length) reg.active.postMessage({ keep });
        }
    } catch (e) { console.warn("[install] service worker", e); }
}

if (SW_OK) on("title", () => {
    if (I.started) return;
    // automation (the test harness, measurement scripts: navigator.webdriver) never gets a worker unless it asks —
    // ?test&enable=install or ?sw=on — so kept files can't change any other test's timings; ?sw=off always works
    const asked = (ctx.TEST && ctx.enabled("install")) || QS.get("sw") === "on" || QS.get("sw") === "off";
    if ((ctx.TEST || navigator.webdriver) && !asked) return;
    const idle = window.requestIdleCallback ? f => window.requestIdleCallback(f, { timeout: 4000 }) : f => setTimeout(f, 1500);
    requestAnimationFrame(() => requestAnimationFrame(() => idle(() => { startWorker(); })));
});

addMenuItem("settings", {
    id: "install", order: 40,
    label: () => `📥 Install on this ${COARSE ? "phone" : "PC"}`,
    visible: () => !NATIVE && !!I.prompt && !I.installed && !standalone(),
    action: async () => {
        const p = I.prompt;
        if (!p) return;
        I.prompt = null;                     // (an offer can be used once)
        try { p.prompt(); const c = await p.userChoice; if (c && c.outcome === "accepted") I.installed = true; } catch (e) { /* the browser said no */ }
    },
});
addMenuItem("settings", {
    id: "fullscreen", order: 41,
    label: () => document.fullscreenElement ? "⛶ Leave full screen" : "⛶ Go full screen",
    visible: () => !NATIVE && !COARSE && standalone() && !!document.documentElement.requestFullscreen,
    action: () => {
        try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { /* not allowed */ }
    },
});

ctx.install = { info: () => ({ sw: SW_OK, registered: I.registered, killed: I.killed, kept: I.kept, canInstall: !!I.prompt && !I.installed && !standalone(), installed: I.installed || standalone(), native: NATIVE }) };
