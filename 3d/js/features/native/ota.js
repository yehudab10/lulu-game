// features/native/ota.js — updates of the web game inside the iOS app, from the server ("over the air").
//
// The app carries a copy of the game (www/, the BUNDLED copy — it always works, offline, on first launch).
// This file keeps it in step with the website without an App Store release:
//
//   1. a while after the game is up it reads the STABLE channel's manifest (published by
//      .github/workflows/app-updates.yml for a commit whose "Smoke test" was green): the commit, the lowest app
//      version it needs (`minNative`), the brakes (`paused` / `revert`) and every file's SHA-256 + size;
//   2. if it's new, compatible and small enough, it asks the updater plugin (@capgo/capacitor-updater, fully
//      self-hosted: no Capgo account or server — capacitor.config.json blanks every URL it would call) to
//      download it. The plugin fetches ONLY files whose fingerprint the phone doesn't have yet (the bundled
//      copy's files and earlier downloads are reused), checks every file's SHA-256 natively, keeps finished
//      files so an interrupted download resumes, and accepts HTTPS only;
//   3. the new copy is switched in at the NEXT launch, while the loading screen is up — never under a running
//      game — and calls notifyAppReady() once it reaches its first screen. If it never does, the plugin's
//      native timer (appReadyTimeout, 40 s) throws it away and goes back to the last good copy; this file then
//      remembers that version as bad and never tries it again.
//
// The save is untouched: every copy is served from the same origin (capacitor://localhost) — only the folder
// behind it changes — so localStorage (luluSaveV2, lulu3dSave …) is the same storage before and after.
// On the web (lulu.boats) nothing here runs. IOS_BUILD.md › "Updates from the server" has the whole story.
import { ctx, on } from "../../core/ctx.js";
import * as H from "../../hud.js";
import { isNative, plugin, call } from "./cap.js";

export const OTA = {
    manifestUrl: "https://raw.githubusercontent.com/yehudab10/lulu-game/refs/heads/ci/ios-ota-verify/ota-test/broken.json",
    // files may only come from these (every one is SHA-256 checked anyway)
    bases: ["https://raw.githubusercontent.com/yehudab10/lulu-game/", "https://lulu.boats/"],
    firstCheckMs: 20000,       // after the game is up (not during the loading screen)
    everyMs: 30 * 60000,       // then at most this often while the app is open
    anyNetMB: 30,              // download up to this much on any connection
    maxMB: 150,                // more than anyNetMB waits for Wi-Fi; more than this never comes over the air
    fetchMs: 20000,
};
const KEY = "luluOtaV1";
const P = new URLSearchParams(location.search);

// ── test hooks (never in the app: the app's page has no ?test) ──────────────────────────────────────────────
if (ctx.TEST) {
    if (P.get("otaManifest")) OTA.manifestUrl = new URL(P.get("otaManifest"), location.href).href;
    OTA.bases.push(location.origin + "/");
    OTA.firstCheckMs = +(P.get("otaFirst") || 600000);    // a test runs a check by hand unless it asks
}

// ── local state (its own key, next to the save — never inside it) ───────────────────────────────────────────
const S = load();
function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { s = null; }
    return Object.assign({ pending: null, trying: null, bad: [], fails: {}, have: "", haveBuild: "", builtin: "", builtinAt: "", revert: false, storeNote: "", good: "", log: [] }, s || {});
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* full storage: try again next time */ } }
function note(msg) {
    S.log.push(new Date().toISOString().slice(0, 19) + " " + msg);
    if (S.log.length > 30) S.log.splice(0, S.log.length - 30);
    save();
}

const short = h => String(h || "").slice(0, 12);
const haveSet = () => new Set(S.have ? S.have.split(",") : []);
function addHave(files) {
    const h = haveSet();
    for (const k in files) h.add(short(files[k][0]));
    S.have = [...h].slice(-4000).join(",");
}
/** -1 / 0 / 1, numeric dotted versions ("2.0.0" < "2.1"). */
export function cmpVersion(a, b) {
    const x = String(a || "0").split(/[.-]/).map(n => parseInt(n, 10) || 0), y = String(b || "0").split(/[.-]/).map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
    return 0;
}

/** Is this a manifest we trust the shape of? (the plugin checks every file's hash; this checks the rest) */
export function validManifest(m) {
    if (!m || m.schema !== 1 || typeof m.version !== "string" || !/^[\w.-]{1,64}$/.test(m.version)) return false;
    if (m.revert || m.paused) return true;                     // a brake needs no file list
    if (typeof m.base !== "string" || !OTA.bases.some(b => m.base.startsWith(b))) return false;
    if (!/^https:\/\//.test(m.base) && !ctx.TEST) return false;
    if (!m.files || typeof m.files !== "object") return false;
    const names = Object.keys(m.files);
    // the forwarder, the page the app opens first (capacitor.config.json › server.appStartPath) and the game's code
    const start = String(m.startPath || ["", "3d", "index.html"].join("/")).replace(/^\//, "");
    if (!names.includes("index.html") || !names.includes(start) || !names.some(n => n.startsWith("3d/js/"))) return false;
    return names.every(n => !n.startsWith("/") && !n.split("/").includes("..") && Array.isArray(m.files[n]) && /^[0-9a-f]{64}$/.test(m.files[n][0]) && m.files[n][1] >= 0);
}

const U = () => plugin("CapacitorUpdater");
let cur = { id: "builtin", version: "", status: "" };   // the copy running right now
let readySent = false, busy = false, lastCheck = 0, info = null;
const dbg = { checks: 0, last: "", get state() { return S; }, get current() { return cur; } };

async function fetchJSON(url) {
    const ac = typeof AbortController === "function" ? new AbortController() : null;
    const t = setTimeout(() => ac && ac.abort(), OTA.fetchMs);
    try {
        const r = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store", signal: ac && ac.signal });
        if (!r.ok) throw new Error("HTTP " + r.status);
        return await r.json();
    } finally { clearTimeout(t); }
}

// ── launch: the outcome of the last switch, the brakes, then switch in a downloaded copy ────────────────────
async function launch() {
    const u = U();
    const c = await call(u, "current");
    if (c && c.bundle) cur = { id: c.bundle.id || "builtin", version: c.bundle.version || "", status: c.bundle.status || "" };
    info = (await call(plugin("App"), "getInfo")) || {};

    // the bundled copy describes itself (its commit + every file's hash): what this phone already has
    if (cur.id === "builtin" && S.haveBuild !== String(info.build || "?")) {
        try {
            const own = await fetchJSON(new URL("../ota-build.json", location.href).href);
            S.have = ""; addHave(own.files || {});
            S.builtin = own.commit || "";
            S.builtinAt = own.committed || "";
            S.haveBuild = String(info.build || "?");
            S.bad = []; S.fails = {}; S.storeNote = "";   // a new app build: start clean
            save();
        } catch (e) { /* an old bundle without the list: estimate from nothing */ }
    }

    if (S.trying) {
        if (cur.id === S.trying.id) { /* we ARE the new copy: ready() below confirms it */ }
        else {
            note(`rolled back: ${S.trying.version} never reached the title`);
            if (!S.bad.includes(S.trying.version)) S.bad.push(S.trying.version);
            S.trying = null; save();
        }
    }
    if (readySent) return;                                   // the game is already up: never switch under it

    if (S.revert && cur.id !== "builtin") {
        note("revert: back to the bundled copy");
        S.pending = null; save();
        await call(u, "reset", { toLastSuccessful: false });  // reloads into the bundled copy
        return;
    }
    if (S.pending && !S.trying && cur.id !== S.pending.id) {
        const p = S.pending;
        const list = await call(u, "list");
        const b = list && (list.bundles || []).find(x => x.id === p.id);
        if (!b || b.status === "error" || S.bad.includes(p.version)) { note(`dropped pending ${p.version}`); S.pending = null; save(); return; }
        S.trying = { id: p.id, version: p.version, at: Date.now() };
        S.pending = null;
        note(`switching to ${p.version}`);
        try { await u.set({ id: p.id }); }                    // the page reloads into the new copy
        catch (e) { note(`switch failed: ${e && e.message}`); S.bad.push(p.version); S.trying = null; save(); }
    }
}

/** The game is up (its first real screen): tell the plugin this copy works. */
function ready() {
    if (readySent) return;
    readySent = true;
    const u = U();
    if (!u) return;
    launched.then(() => call(u, "notifyAppReady")).then(() => {
        if (S.trying && cur.id === S.trying.id) { note(`running ${S.trying.version}`); S.good = S.trying.version; S.trying = null; save(); }
    });
    setTimeout(() => check(), OTA.firstCheckMs);
}

// ── the check: read the stable manifest, decide, download in the background ────────────────────────────────
async function check(force) {
    const u = U();
    if (!u || busy) return dbg.last;
    if (!force && Date.now() - lastCheck < OTA.everyMs - 1000) return dbg.last;
    busy = true; lastCheck = Date.now(); dbg.checks++;
    try { return (dbg.last = await decide(u)); }
    catch (e) { return (dbg.last = "error: " + (e && e.message || e)); }
    finally { busy = false; }
}

async function decide(u) {
    let m;
    try { m = await fetchJSON(OTA.manifestUrl); } catch (e) { return "offline"; }
    if (!validManifest(m)) { note("ignored a manifest that doesn't look right"); return "invalid"; }
    if (m.minNative && S.minNative !== m.minNative) { S.minNative = m.minNative; save(); }

    if (m.revert) {
        S.pending = null;
        if (cur.id !== "builtin" && !S.revert) { S.revert = true; note("server says revert (next launch)"); }
        save(); return "revert";
    }
    if (S.revert) { S.revert = false; save(); }
    if (m.paused) { if (S.pending) { note("paused: dropped the pending copy"); S.pending = null; save(); } return "paused"; }

    if (m.version === cur.version || (cur.id === "builtin" && m.commit && S.builtin && m.commit === S.builtin)) return "up to date";
    if (S.pending && S.pending.version === m.version) return "already downloaded";
    // an app built from a NEWER commit than stable keeps its own copy (unless the server pinned this one on purpose)
    if (cur.id === "builtin" && !m.hold && S.builtinAt && m.committed && Date.parse(m.committed) < Date.parse(S.builtinAt)) return "bundled copy is newer";
    if (S.bad.includes(m.version)) return "known bad";
    if (cmpVersion((info && info.version) || "0", m.minNative) < 0) {
        // the web game moved on to native code this app doesn't have: keep the last compatible copy; say so once
        const k = m.minNative + "@" + ((info && info.version) || "?");
        if (S.storeNote !== k) {
            S.storeNote = k; save();
            H.toast("📱 A new version of the app is in the App Store", "", { prio: 2, key: "ota-store" });
        }
        return "needs a newer app";
    }

    const have = haveSet();
    let bytes = 0;
    for (const k in m.files) if (!have.has(short(m.files[k][0]))) bytes += m.files[k][1];
    const mb = bytes / 1048576;
    if (mb > OTA.maxMB) { note(`${m.version}: ${mb.toFixed(0)} MB is too big to download — wait for the App Store`); return "too big"; }
    if (mb > OTA.anyNetMB) {
        const net = await call(plugin("Network"), "getStatus");
        if (!net || net.connectionType !== "wifi") return "waiting for Wi-Fi";
    }

    const manifest = Object.keys(m.files).map(f => ({
        file_name: f, file_hash: m.files[f][0],
        download_url: m.base + f.split("/").map(encodeURIComponent).join("/"),
    }));
    note(`downloading ${m.version} (~${mb.toFixed(1)} MB new)`);
    let b;
    try { b = await u.download({ url: m.base + "index.html", version: m.version, manifest }); }
    catch (e) {
        const n = S.fails[m.version] = (S.fails[m.version] || 0) + 1;
        note(`download of ${m.version} failed (${n}): ${String(e && e.message || e).slice(0, 120)}`);
        if (n >= 3 && !S.bad.includes(m.version)) S.bad.push(m.version);    // a bad file list: stop retrying it
        save(); return "download failed";
    }
    if (!b || !b.id) { note("download returned nothing"); return "download failed"; }
    if (S.pending && S.pending.id !== b.id) await call(u, "delete", { id: S.pending.id });   // a newer one replaces it
    S.pending = { id: b.id, version: m.version, commit: m.commit || "" };
    addHave(m.files);
    note(`ready for next launch: ${m.version}`);
    save();
    return "downloaded";
}

// ── wiring ──────────────────────────────────────────────────────────────────────────────────────────────────
let launched = Promise.resolve();
if (isNative() && U()) {
    launched = launch().catch(e => note("launch: " + (e && e.message || e)));
    on("state", e => { if (e && e.to && e.to !== "loading") ready(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && readySent) check(); });
}

/** ctx.native.ota — read-only status + a manual check (tests; ⚙️ could show it one day). */
export const ota = {
    get active() { return isNative() && !!U(); },
    /** For ⚙️ More: the app's version + build, which game copy runs, and whether the game now needs a newer app. */
    status() {
        const app = info && info.version ? `App ${info.version} (build ${info.build})` : "";
        const copy = cur.id === "builtin" ? "game: built into the app" : `game: ${cur.version} (downloaded)`;
        const needs = S.minNative && info && info.version && cmpVersion(info.version, S.minNative) < 0 ? S.minNative : "";
        return { app, copy, needs, last: dbg.last };
    },
    check: () => check(true),
    debug: dbg,
};
