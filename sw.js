// 📥 Lulu's Road Trip — the service worker (roadmap 46: install on this PC / phone, optional). Registered by
// 3d/js/features/install/ once the game is up (never by a boot script, never inside the iOS app). It only KEEPS FILES:
//   • pages, code, styles, data (html / js / css / json / webmanifest): NETWORK FIRST — the newest version whenever
//     the network answers; the kept copy only when offline. Nobody can be stuck on an old version of the game.
//   • big files that don't change between versions (.glb models, three.js under vendor/, audio, images): CACHE FIRST,
//     kept as they're fetched (never a big download up front: the first start's own downloads are kept afterwards,
//     mostly straight from the browser's cache). A kept copy older than a day is checked again in the background.
//   • the models' version key, /sw.json "assets" (scripts/sw-version.js): read at every start, beside the page
//     itself; when it changed, the kept big files are dropped before the game asks for them — a regenerated model is
//     picked up on the next start.
//   • a size cap (MAX_BYTES): the oldest big files go first.
//   • other sites (fonts, the multiplayer relay) and anything that isn't a GET: untouched.
// A new sw.js waits for the next start (no skipWaiting: never a swap mid-play).
// KILL SWITCH (no app release needed): set "off": true in /sw.json — at the next start the worker removes itself and
// its caches (and the game unregisters it too); or ship a sw.js whose body is just `self.registration.unregister()`.
// Players: ?sw=off.
const VERSION = "lulu-sw-1";
const PAGES = `${VERSION}-pages`, BIG = `${VERSION}-big`, META = `${VERSION}-meta`;
const MAX_BYTES = 300 * 1024 * 1024;
const RECHECK_MS = 24 * 3600 * 1000;
const FLAGS_WAIT_MS = 2500;            // the start waits at most this long for /sw.json (offline: no wait at all)
const BIG_RE = /\.(glb|mp3|ogg|wav|m4a|png|jpg|jpeg|webp|gif)$|\/vendor\//i;
const PAGE_RE = /(\/|\.html|\.js|\.mjs|\.css|\.json|\.webmanifest)$/i;
const ROOT = new URL("./", self.location).pathname;

self.addEventListener("install", () => { /* nothing up front: files are kept as the game fetches them */ });
self.addEventListener("activate", e => {
    e.waitUntil((async () => {
        // drop caches from older versions of this worker
        for (const k of await caches.keys()) if (k.startsWith("lulu-sw-") && !k.startsWith(VERSION + "-")) await caches.delete(k);
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", e => {
    const req = e.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (url.searchParams.has("sw") || url.pathname.endsWith("/sw.json") || url.pathname.endsWith("/sw.js")) return;
    if (req.headers.get("range")) return;                       // (audio seeking: let the browser do it)
    if (BIG_RE.test(url.pathname)) e.respondWith(bigFile(e, req));
    else if (req.mode === "navigate") e.respondWith(start(e, req));
    else if (PAGE_RE.test(url.pathname)) e.respondWith(networkFirst(req));
});

/** A start (a page load): the page, network first — and, beside it, the flags. */
async function start(e, req) {
    const flags = readFlags();
    const res = await networkFirst(req);
    const f = await Promise.race([flags, new Promise(r => setTimeout(r, FLAGS_WAIT_MS, null))]);
    if (f && f.off) e.waitUntil(removeSelf());
    return res;
}
let flagsAt = 0, flagsP = null;
function readFlags() {
    if (flagsP && Date.now() - flagsAt < 30000) return flagsP;
    flagsAt = Date.now();
    return flagsP = (async () => {
        try {
            const r = await fetch(ROOT + "sw.json", { cache: "no-store" });
            if (!r.ok) return null;
            const f = await r.json();
            if (f && f.assets) await applyAssets(String(f.assets));
            return f;
        } catch (err) { return null; }                          // offline: keep everything
    })();
}
/** The models' version key changed → drop the kept big files (they come again as the game asks for them). */
async function applyAssets(v) {
    const meta = await caches.open(META), key = new Request(ROOT + "__lulu-assets-version");
    const had = await meta.match(key), was = had ? await had.text() : null;
    if (was === v) return false;
    if (was != null) await caches.delete(BIG);
    await meta.put(key, new Response(v));
    return was != null;
}
async function removeSelf() {
    for (const k of await caches.keys()) if (k.startsWith("lulu-sw-")) await caches.delete(k);
    await self.registration.unregister();
}

async function networkFirst(req) {
    const cache = await caches.open(PAGES);
    try {
        const res = await fetch(req);
        if (res.ok && res.type === "basic") cache.put(req, res.clone()).catch(() => { });
        return res;
    } catch (err) {
        const hit = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
        if (hit) return hit;
        throw err;
    }
}

const stamp = res => +(res.headers.get("x-lulu-kept") || 0);
let puts = 0;
async function keep(cache, req, res) {
    if (!res.ok || res.type !== "basic") return res;
    const body = await res.clone().blob();
    const h = new Headers(res.headers);
    h.set("x-lulu-kept", String(Date.now()));
    h.set("x-lulu-size", String(body.size));
    await cache.put(req, new Response(body, { status: res.status, statusText: res.statusText, headers: h }));
    if (++puts % 25 === 0) trim().catch(() => { });
    return res;
}
async function bigFile(e, req) {
    if (flagsP) await Promise.race([flagsP, new Promise(r => setTimeout(r, FLAGS_WAIT_MS))]);     // (a start's version check first)
    const cache = await caches.open(BIG);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) {
        if (Date.now() - stamp(hit) > RECHECK_MS) e.waitUntil(fetch(req).then(r => keep(cache, req, r)).catch(() => { }));
        return hit;
    }
    const res = await fetch(req);
    e.waitUntil(keep(cache, req, res.clone()).catch(() => { }));
    return res;
}
/** Over the cap: drop the oldest kept big files. */
async function trim() {
    const cache = await caches.open(BIG);
    const keys = await cache.keys(), list = [];
    let total = 0;
    for (const k of keys) { const r = await cache.match(k); const n = +(r && r.headers.get("x-lulu-size") || 0); total += n; list.push([stamp(r), n, k]); }
    if (total <= MAX_BYTES) return;
    list.sort((a, b) => a[0] - b[0]);
    for (const [, n, k] of list) { if (total <= MAX_BYTES * 0.9) break; await cache.delete(k); total -= n; }
}
// the game, right after the worker first starts: "keep these" — the big files this start already downloaded before
// the worker was there (mostly straight from the browser's own cache: no second download)
self.addEventListener("message", e => {
    const d = e.data || {};
    if (Array.isArray(d.keep)) e.waitUntil((async () => {
        await readFlags();
        const cache = await caches.open(BIG);
        let kept = 0;
        for (const u of d.keep.slice(0, 400)) {
            const url = new URL(u, self.location);
            if (url.origin !== self.location.origin || !BIG_RE.test(url.pathname)) continue;
            if (await cache.match(url.href, { ignoreSearch: true })) continue;
            try { const r = await fetch(url.href); if (r.ok) { await keep(cache, new Request(url.href), r); kept++; } } catch (err) { /* offline */ }
        }
        if (e.source) e.source.postMessage({ kept });
    })());
    else if (d === "trim") trim().catch(() => { });
});
