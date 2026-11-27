// 📥 Lulu's Road Trip — the service worker (roadmap 46: install on this PC / phone, optional). Registered by
// 3d/js/features/install/ once the game is up (never by a boot script, never inside the iOS app). It only KEEPS FILES:
//   • pages, code, styles, data (html / js / css / json / webmanifest): NETWORK FIRST — the newest version whenever
//     the network answers; the kept copy only when offline. Nobody can be stuck on an old version of the game.
//   • big files that don't change between versions (.glb models, three.js under vendor/, audio, images): CACHE FIRST,
//     kept as they're fetched (never a big download up front: the first start's own downloads are kept afterwards,
//     mostly straight from the browser's cache). A kept copy older than a day is checked again in the background.
//   • the version key of EVERY cache-first file, /sw.json "assets" (scripts/sw-version.js hashes everything BIG_RE
//     matches: models, vendor/, audio, images): read at every start, beside the page itself; when it changed, the kept
//     big files are dropped before the game asks for them — a regenerated model / a new three.js arrives on the next start.
//   • the worker is never the reason a request fails: any error inside it (blocked storage, quota, a private window)
//     falls back to a plain fetch — keeping files is best-effort only.
//   • a size cap (MAX_BYTES): the oldest big files go first.
//   • other sites (fonts, the multiplayer relay) and anything that isn't a GET: untouched.
// A new sw.js waits for the next start (no skipWaiting: never a swap mid-play).
// KILL SWITCH (no app release needed): set "off": true in /sw.json — at the next start the worker removes itself and
// its caches (and the game unregisters it too). Players: ?sw=off. Last resort: ship a sw.js that is only
//   self.addEventListener("install", () => self.skipWaiting());
//   self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).then(() => self.registration.unregister())));
const VERSION = "lulu-sw-1";
const PAGES = `${VERSION}-pages`, BIG = `${VERSION}-big`, META = `${VERSION}-meta`;
const MAX_BYTES = 150 * 1024 * 1024;           // (every model together is ~41 MB; phones have small quotas)
const RECHECK_MS = 24 * 3600 * 1000;
const FLAGS_WAIT_MS = 2500;            // a big file waits at most this long for a start's /sw.json (offline: no wait at all)
const BIG_RE = /\.(glb|mp3|ogg|wav|m4a|png|jpg|jpeg|webp|gif)$|\/vendor\//i;
const PAGE_RE = /(\/|\.html|\.js|\.mjs|\.css|\.json|\.webmanifest)$/i;
const ROOT = new URL("./", self.location).pathname;

self.addEventListener("install", () => { /* nothing up front: files are kept as the game fetches them */ });
self.addEventListener("activate", e => {
    e.waitUntil((async () => {
        // drop caches from older versions of this worker
        try { for (const k of await caches.keys()) if (k.startsWith("lulu-sw-") && !k.startsWith(VERSION + "-")) await caches.delete(k); } catch (err) { /* no storage */ }
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", e => {
    const req = e.request;
    if (gone || req.method !== "GET") return;                   // (removed: the page it still looks after goes straight to the network)
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (url.searchParams.has("sw") || url.pathname.endsWith("/sw.json") || url.pathname.endsWith("/sw.js")) return;
    if (req.headers.get("range")) return;                       // (audio seeking: let the browser do it)
    if (BIG_RE.test(url.pathname)) e.respondWith(safe(bigFile(e, req), req));
    else if (req.mode === "navigate") e.respondWith(safe(start(e, req), req));
    else if (PAGE_RE.test(url.pathname)) e.respondWith(safe(networkFirst(req), req));
});
/** Anything went wrong inside the worker → the plain network, as if it weren't here. */
const safe = (p, req) => p.catch(() => fetch(req));
const openCache = name => caches.open(name).catch(() => null);

/** A start (a page load): the page, network first — and, beside it (never holding the page), the flags. */
async function start(e, req) {
    const flags = readFlags();
    e.waitUntil(flags.then(f => f && f.off ? removeSelf() : null).catch(() => { }));
    return networkFirst(req);
}
let flagsP = null, gone = false;
function readFlags() {
    return flagsP = (async () => {
        try {
            const r = await fetch(ROOT + "sw.json", { cache: "no-store" });
            if (!r.ok) return null;
            const f = await r.json();
            if (f && f.assets) await applyAssets(String(f.assets)).catch(() => { });
            return f;
        } catch (err) { return null; }                          // offline / no storage: keep everything
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
    gone = true;
    try { for (const k of await caches.keys()) if (k.startsWith("lulu-sw-")) await caches.delete(k); } catch (err) { /* no storage */ }
    await self.registration.unregister();
}

async function networkFirst(req) {
    try {
        const res = await fetch(req);
        if (res.ok && res.type === "basic") openCache(PAGES).then(c => c && c.put(req, res.clone())).catch(() => { });
        return res;
    } catch (err) {
        const cache = await openCache(PAGES);
        const hit = cache && await cache.match(req, { ignoreSearch: req.mode === "navigate" }).catch(() => null);
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
    const cache = await openCache(BIG);
    if (!cache) return fetch(req);
    const hit = await cache.match(req, { ignoreSearch: true }).catch(() => null);
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
      try {
        await (flagsP || readFlags());
        const cache = await caches.open(BIG);
        let kept = 0;
        for (const u of d.keep.slice(0, 400)) {
            const url = new URL(u, self.location);
            if (url.origin !== self.location.origin || !BIG_RE.test(url.pathname)) continue;
            if (await cache.match(url.href, { ignoreSearch: true })) continue;
            try { const r = await fetch(url.href); if (r.ok) { await keep(cache, new Request(url.href), r); kept++; } } catch (err) { /* offline */ }
        }
        if (e.source) e.source.postMessage({ kept });
      } catch (err) { /* no storage: nothing kept */ }
    })());
    else if (d === "trim") trim().catch(() => { });
    else if (d === "gone") e.waitUntil(removeSelf());          // (the game's ?sw=off / kill switch)
    // (registered again right after a removal, the browser can hand back the same worker: it looks after pages again)
    else if (d === "claim") { gone = false; e.waitUntil(self.clients.claim()); }
});
