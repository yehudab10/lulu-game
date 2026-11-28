// Shared Road — local dev relay for Lulu's Road Trip.
//
// Implements the SAME protocol as the Cloudflare Worker (mp-worker.js) so the
// client can point MP_URL at  ws://127.0.0.1:9977  during development.
//
//   Run:  cd server && npm install && node local-relay.js
//
// Connect at  ws://127.0.0.1:9977/room/<ID>
//
// Prefers the `ws` npm package. If `ws` is not installed (e.g. npm was
// unavailable), it transparently falls back to a tiny zero-dependency RFC6455
// implementation in ./ws-fallback.js so the relay still runs.

const http = require("http");

const PORT = process.env.PORT ? Number(process.env.PORT) : 9977;
const HOST = "127.0.0.1";

const MAX_MEMBERS = 24;
const MAX_FRAME_BYTES = 2 * 1024;
const STATE_RATE_LIMIT = 8; // per second per client
const CLOSE_ROOM_FULL = 4001;

// --- Async board (phase 2) — in-memory mirror of the DO logic ---------------
const CURATED_NAMES = [
  "Cholent Boy", "Rugelach Queen", "Bubby's Favorite", "Kugel Kid",
  "Shabbos Racer", "Babka Baron", "Gefilte Ghost", "Mitzvah Machine",
  "Sheitel Slayer", "Dreidel Daredevil", "Latke Legend", "Schmaltz Speedster",
];
const CURATED_SET = new Set(CURATED_NAMES);
const WANTED_KEEP = 30;
const WANTED_GET = 12;
const SCORES_GET = 8;
const MAX_CHARGES = 3;
const MAX_CHARGE_LEN = 32;
const SCORE_MAX = 2e6;
const WANTED_MIN_GAP_MS = 20 * 1000;
const SCORE_MIN_GAP_MS = 10 * 1000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

// In-memory board storage (survives only for the life of the process — fine
// for local dev / tests).
const board = {
  wanted: [], // { ts, name, charges: [] } newest last
  scores: new Map(), // day -> Map(name -> best score)
  ipHits: new Map(), // ip -> { wanted, score } last-post ms
};

function utcDay(now) {
  return new Date(now == null ? Date.now() : now).toISOString().slice(0, 10);
}
function validName(name) {
  return typeof name === "string" && CURATED_SET.has(name);
}
function sanitizeCharges(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const c of raw) {
    if (out.length >= MAX_CHARGES) break;
    if (typeof c !== "string") continue;
    const clean = c
      .toUpperCase()
      .replace(/[^A-Z0-9()&' ]/g, "")
      .slice(0, MAX_CHARGE_LEN)
      .trim();
    if (clean) out.push(clean);
  }
  return out;
}
function clampScore(v) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > SCORE_MAX ? SCORE_MAX : n;
}
function boardRateOk(ip, kind, gapMs, now) {
  const rec = board.ipHits.get(ip) || {};
  const last = rec[kind] || 0;
  if (now - last < gapMs) return false;
  rec[kind] = now;
  board.ipHits.set(ip, rec);
  return true;
}
function boardClientIp(req) {
  return (
    req.headers["cf-connecting-ip"] ||
    (req.socket && req.socket.remoteAddress) ||
    "0.0.0.0"
  );
}
function sendBoard(res, status, obj) {
  const headers = { ...CORS_HEADERS };
  if (status === 204 || obj == null) {
    res.writeHead(status, headers);
    res.end();
    return;
  }
  headers["content-type"] = "application/json";
  res.writeHead(status, headers);
  res.end(JSON.stringify(obj));
}

// Handle a /board/* HTTP request. Returns true if consumed.
function handleBoard(req, res, pathname) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return true;
  }
  if (pathname === "/board/wanted" && req.method === "GET") {
    const list = board.wanted
      .slice()
      .reverse()
      .slice(0, WANTED_GET)
      .map((w) => ({ name: w.name, charges: w.charges.slice(), ts: w.ts }));
    sendBoard(res, 200, { list });
    return true;
  }
  if (pathname === "/board/scores" && req.method === "GET") {
    const day = utcDay();
    const dayMap = board.scores.get(day) || new Map();
    const list = [...dayMap.entries()]
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, SCORES_GET);
    sendBoard(res, 200, { day, list });
    return true;
  }
  if (
    (pathname === "/board/wanted" || pathname === "/board/score") &&
    req.method === "POST"
  ) {
    readHttpBody(req, (body) => {
      const now = Date.now();
      const ip = boardClientIp(req);
      if (!body || !validName(body.name)) {
        sendBoard(res, 400, { error: "bad request" });
        return;
      }
      if (pathname === "/board/wanted") {
        if (!boardRateOk(ip, "wanted", WANTED_MIN_GAP_MS, now)) {
          sendBoard(res, 429, { error: "rate limited" });
          return;
        }
        board.wanted.push({
          ts: now,
          name: body.name,
          charges: sanitizeCharges(body.charges),
        });
        if (board.wanted.length > WANTED_KEEP) {
          board.wanted = board.wanted.slice(board.wanted.length - WANTED_KEEP);
        }
        sendBoard(res, 204, null);
      } else {
        if (!boardRateOk(ip, "score", SCORE_MIN_GAP_MS, now)) {
          sendBoard(res, 429, { error: "rate limited" });
          return;
        }
        const day = utcDay(now);
        let dayMap = board.scores.get(day);
        if (!dayMap) {
          dayMap = new Map();
          board.scores.set(day, dayMap);
        }
        const score = clampScore(body.score);
        const prev = dayMap.get(body.name);
        if (prev == null || score > prev) dayMap.set(body.name, score);
        sendBoard(res, 204, null);
      }
    });
    return true;
  }
  return false;
}

// Collect a size-capped JSON body, then invoke cb(objOrNull).
function readHttpBody(req, cb) {
  const chunks = [];
  let total = 0;
  let done = false;
  const finish = (obj) => {
    if (done) return;
    done = true;
    cb(obj);
  };
  req.on("data", (c) => {
    total += c.length;
    if (total > MAX_FRAME_BYTES) {
      finish(null);
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on("end", () => {
    try {
      const obj = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      finish(obj && typeof obj === "object" ? obj : null);
    } catch (_) {
      finish(null);
    }
  });
  req.on("error", () => finish(null));
}

// Load a WebSocketServer implementation: real `ws`, else the fallback.
// Set WS_IMPL=fallback to force the zero-dependency implementation.
let WebSocketServer;
let usingFallback = false;
if (process.env.WS_IMPL === "fallback") {
  ({ WebSocketServer } = require("./ws-fallback.js"));
  usingFallback = true;
} else {
  try {
    ({ WebSocketServer } = require("ws"));
  } catch (_) {
    ({ WebSocketServer } = require("./ws-fallback.js"));
    usingFallback = true;
  }
}

// --- helpers ---------------------------------------------------------------

function sanitizeRoom(raw) {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
function randomId() {
  let s = "";
  for (let i = 0; i < 2; i++) s += ID_ALPHABET[(Math.random() * ID_ALPHABET.length) | 0];
  return s;
}

// --- room registry ---------------------------------------------------------

/** roomName -> Set<clientWs> */
const rooms = new Map();

function roomMembers(room) {
  let set = rooms.get(room);
  if (!set) {
    set = new Set();
    rooms.set(room, set);
  }
  return set;
}

function usedIds(set) {
  const ids = new Set();
  for (const ws of set) if (ws._meta && ws._meta.id) ids.add(ws._meta.id);
  return ids;
}

function freshId(set) {
  const used = usedIds(set);
  let id = randomId();
  let guard = 0;
  while (used.has(id) && guard++ < 500) id = randomId();
  while (used.has(id)) id += ID_ALPHABET[(Math.random() * ID_ALPHABET.length) | 0];
  return id;
}

function sendJson(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch (_) {}
}

function broadcast(set, exceptWs, obj) {
  const payload = JSON.stringify(obj);
  for (const ws of set) {
    if (ws === exceptWs) continue;
    if (!ws._meta || !ws._meta.id) continue; // only joined members
    try {
      ws.send(payload);
    } catch (_) {}
  }
}

function allowState(ws) {
  const now = Date.now();
  let w = ws._rate;
  if (!w || now - w.start >= 1000) {
    w = { start: now, count: 0 };
    ws._rate = w;
  }
  if (w.count >= STATE_RATE_LIMIT) return false;
  w.count++;
  return true;
}

// --- 🏘️ the world-wide property registry (homes.mjs — the SAME code the worker runs) --------------------------
// A dev / test relay only: POST /homes/_clock {offset} moves THIS process's clock (the 14-day rule in a test); the
// production worker has no such endpoint.
let homesP = null, acctP = null, homesStore = null;
const homesClock = { offset: 0 };
function homesReg() {
  if (!homesP) homesP = acctReg().then((A) => import("./homes.mjs").then((m) => {
    homesStore = m.memoryStore();
    return m.createHomes(homesStore, { clock: () => Date.now() + homesClock.offset, config: { claimGapMs: 300, sweepGapMs: 0 },
      acctSech: (pid) => (A ? A.sechOf(pid) : null), nameOf: (pid) => (A ? A.nameOf(pid) : null) });
  }));
  return homesP;
}
// --- 🪪 accounts (accounts.mjs — the SAME code the worker runs, on node:sqlite; null when this Node has none) ------
// Dev / test only: POST /acct/_clock {offset} moves the same clock as /homes/_clock; ACCT_FAST=1 (the 3D tests) makes
// the per-account write gap small so a test can click quickly. The production worker has neither.
function acctReg() {
  if (!acctP) acctP = import("./accounts.mjs").then(async (m) => {
    const q = await m.nodeSql(process.env.ACCT_DB || ":memory:");
    if (!q) return null;
    const fast = process.env.ACCT_FAST === "1";
    return m.createAccounts(q, { clock: () => Date.now() + homesClock.offset,
      config: fast ? { writeGapMs: 30, checkGapMs: 0 } : {},
      homeSech: (pid) => { const r = homesStore && homesStore.byOwner(pid)[0]; return r ? r.sech : null; },
      onDelete: (pid) => { if (wearNow) wearNow.releaseAll(pid); if (shopsNow) shopsNow.releaseAll(pid); } });
  });
  return acctP;
}
// --- 👜 limited luxury pieces (wear.mjs — the SAME code the worker runs, on node:sqlite) ---------------------------
// Dev / test only: POST /wear/_clock {offset} moves the same clock (a hold running out in a test); WEAR_LIMITED='{"jfk_bag":2}'
// shrinks the totals (selling out in a test). The production worker has neither.
let wearP = null, wearNow = null;
function wearReg() {
  if (!wearP) wearP = acctReg().then((A) => Promise.all([import("./wear.mjs"), import("./accounts.mjs")]).then(async ([w, a]) => {
    const q = await a.nodeSql(":memory:");
    if (!q || !A) return null;
    let lim = null;
    try { lim = process.env.WEAR_LIMITED ? Object.assign({}, w.LIMITED, JSON.parse(process.env.WEAR_LIMITED)) : null; } catch (e) { lim = null; }
    wearNow = w.createWear(q, { clock: () => Date.now() + homesClock.offset, sechOf: (pid) => A.sechOf(pid), nameOf: (pid) => A.nameOf(pid),
      config: process.env.ACCT_FAST === "1" ? { writeGapMs: 30, ipGapMs: 0 } : {}, limited: lim });
    return wearNow;
  }));
  return wearP;
}
function handleWear(req, res, pathname) {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS_HEADERS); res.end(); return; }
  const done = (st, obj) => sendBoard(res, st, obj);
  const run = (body) => {
    if (pathname === "/wear/_clock" && req.method === "POST") { homesClock.offset = Number(body && body.offset) || 0; done(200, { ok: true, offset: homesClock.offset }); return; }
    wearReg().then((W) => (W ? W.handle(pathname, req.method, body, boardClientIp(req)) : { status: 404, body: { error: "no wear here" } }))
      .then((r) => done(r.status, r.body)).catch((e) => done(500, { error: String(e && e.message) }));
  };
  if (req.method === "GET") { run({}); return; }
  let raw = "";
  req.on("data", (c) => { raw += c; if (raw.length > 4 * 1024) req.destroy(); });
  req.on("end", () => { let body = null; try { body = JSON.parse(raw); } catch (_) { body = null; } run(body && typeof body === "object" ? body : null); });
}
// --- 🏪 player-owned shops (shops.mjs — the SAME code the worker runs, on node:sqlite; ci/playershops) -----------------
// Dev / test only: POST /shops/_clock {offset} moves the same clock (a new day; an owner going idle); POST /shops/_made
// {pid, ago} back-dates an account (a buyer needs one ≥ minDays old); SHOPS_OFF=1 starts with the kill switch off;
// SHOPS_CFG='{"ownerDayProfit":10}' shrinks the caps (reaching them in a test). The production worker has none of these.
let shopsP = null, shopsNow = null;
function shopsReg() {
  if (!shopsP) shopsP = acctReg().then((A) => Promise.all([import("./shops.mjs"), import("./accounts.mjs"), import("./world.mjs")]).then(async ([m, a, w]) => {
    const q = await a.nodeSql(":memory:");
    if (!q || !A) return null;
    const made = new Map();
    shopsNow = m.createShops(q, { clock: () => Date.now() + homesClock.offset, sechOf: (pid) => A.sechOf(pid), nameOf: (pid) => A.nameOf(pid),
      madeOf: (pid) => (made.has(pid) ? made.get(pid) : A.madeOf(pid)), on: () => process.env.SHOPS_OFF !== "1" && !!w.WORLD.shops,
      config: Object.assign(process.env.ACCT_FAST === "1" ? { writeGapMs: 30, ipGapMs: 0, sweepGapMs: 0 } : {}, (() => { try { return JSON.parse(process.env.SHOPS_CFG || "{}"); } catch (e) { return {}; } })()) });
    shopsNow.backdate = (pid, ago) => made.set(pid, Date.now() + homesClock.offset - ago);
    return shopsNow;
  }));
  return shopsP;
}
function handleShops(req, res, pathname) {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS_HEADERS); res.end(); return; }
  const done = (st, obj) => sendBoard(res, st, obj);
  const qs = Object.fromEntries(new URL(req.url, "http://x").searchParams);
  const run = (body) => {
    if (pathname === "/shops/_clock" && req.method === "POST") { homesClock.offset = Number(body && body.offset) || 0; done(200, { ok: true, offset: homesClock.offset }); return; }
    if (pathname === "/shops/_made" && req.method === "POST") { shopsReg().then((S) => { if (S) S.backdate(String(body && body.pid), Number(body && body.ago) || 0); done(200, { ok: true }); }); return; }
    shopsReg().then((S) => (S ? S.handle(pathname, req.method, body, boardClientIp(req), qs) : { status: 404, body: { error: "no shops here" } }))
      .then((r) => done(r.status, r.body)).catch((e) => done(500, { error: String(e && e.message) }));
  };
  if (req.method === "GET") { run({}); return; }
  let raw = "";
  req.on("data", (c) => { raw += c; if (raw.length > 8 * 1024) req.destroy(); });
  req.on("end", () => { let body = null; try { body = JSON.parse(raw); } catch (_) { body = null; } run(body && typeof body === "object" ? body : null); });
}
function handleAcct(req, res, pathname) {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS_HEADERS); res.end(); return; }
  const done = (st, obj) => sendBoard(res, st, obj);
  const qs = new URL(req.url, "http://x").searchParams;
  const run = (body) => {
    if (pathname === "/acct/_clock" && req.method === "POST") { homesClock.offset = Number(body && body.offset) || 0; done(200, { ok: true, offset: homesClock.offset }); return; }
    homesReg().then(() => acctReg()).then((A) => (A ? A.handle(pathname, req.method, body, boardClientIp(req)) : { status: 404, body: { error: "no accounts here" } }))
      .then((r) => done(r.status, r.body)).catch((e) => done(500, { error: String(e && e.message) }));
  };
  if (req.method === "GET") { run({ n: qs.get("n"), pid: qs.get("pid") }); return; }
  let raw = "";
  req.on("data", (c) => { raw += c; if (raw.length > 16 * 1024) req.destroy(); });
  req.on("end", () => { let body = null; try { body = JSON.parse(raw); } catch (_) { body = null; } run(body && typeof body === "object" ? body : null); });
}
function handleHomes(req, res, pathname) {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS_HEADERS); res.end(); return; }
  const done = (st, obj) => sendBoard(res, st, obj);
  const q = new URL(req.url, "http://x").searchParams;
  const run = (body) => {
    if (pathname === "/homes/_clock" && req.method === "POST") { homesClock.offset = Number(body && body.offset) || 0; done(200, { ok: true, offset: homesClock.offset }); return; }
    homesReg().then((H) => H.handle(pathname, req.method, body, boardClientIp(req))).then((r) => done(r.status, r.body)).catch((e) => done(500, { error: String(e && e.message) }));
  };
  if (req.method === "GET") { run({ town: q.get("town") }); return; }
  let raw = "";
  req.on("data", (c) => { raw += c; if (raw.length > MAX_FRAME_BYTES) req.destroy(); });
  req.on("end", () => { let body = null; try { body = JSON.parse(raw); } catch (_) { body = null; } run(body && typeof body === "object" ? body : null); });
}

// --- server ----------------------------------------------------------------

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`)
    .pathname;
  if (pathname === "/" || pathname === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("Shared Road local relay OK\n");
    return;
  }
  if (pathname.startsWith("/board")) {
    if (handleBoard(req, res, pathname)) return;
    sendBoard(res, 404, { error: "not found" });
    return;
  }
  if (pathname.startsWith("/homes/")) { handleHomes(req, res, pathname); return; }
  if (pathname.startsWith("/acct/")) { handleAcct(req, res, pathname); return; }
  if (pathname.startsWith("/world/")) { handleWorld(req, res, pathname); return; }
  if (pathname.startsWith("/wear/")) { handleWear(req, res, pathname); return; }
  if (pathname.startsWith("/shops/")) { handleShops(req, res, pathname); return; }
  res.writeHead(426);
  res.end("expected websocket upgrade");
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean); // ["room","<ID>"]
  if (parts.length !== 2 || parts[0] !== "room") {
    socket.destroy();
    return;
  }
  const room = sanitizeRoom(parts[1]);
  if (!room) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws._room = room;
    ws._meta = null;
    ws._rate = null;
    handleConnection(ws);
  });
});

// --- 🌍 one shared world (world.mjs — the SAME code the worker runs): the clock, reliable events, the budget ---------
let W = null;
const worldP = import("./world.mjs").then((m) => { W = m; if (process.env.WORLD_KEEP_MS) m.REL.keepMs = Number(process.env.WORLD_KEEP_MS); if (process.env.WORLD_PLACE === "0") m.WORLD.place = 0; return m; });
const roomEvents = new Map();          // room → recent reliable events
const usage = { day: "", ws: 0, conn: 0, http: 0 };
function count(kind) { if (!W) return; const d = W.dayOf(Date.now()); if (usage.day !== d) Object.assign(usage, { day: d, ws: 0, conn: 0, http: 0 }); usage[kind]++; }
function handleWorld(req, res, pathname) {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS_HEADERS); res.end(); return; }
  worldP.then(() => {
    if (pathname === "/world/config") { sendBoard(res, 200, { world: W.WORLD, st: Date.now() }); return; }
    count("http");
    if (pathname === "/world/usage") {
      if (process.env.WORLD_RESTING === "1") { sendBoard(res, 503, { resting: 1, resetAt: W.usageOf(null, Date.now()).resetAt }); return; }
      const u = W.usageOf(usage.day ? usage : null, Date.now());
      if (/[?&]text=/.test(req.url)) { res.writeHead(200, { ...CORS_HEADERS, "content-type": "text/plain; charset=utf-8" }); res.end(W.usageText(u)); return; }
      sendBoard(res, 200, u); return;
    }
    sendBoard(res, 404, { error: "not found" });
  });
}

function handleConnection(ws) {
  const set = roomMembers(ws._room);
  count("conn");

  ws.on("message", (data, isBinary) => {
    // `ws` gives a Buffer; normalize to string and enforce frame size.
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (buf.length > MAX_FRAME_BYTES) return;

    let msg;
    try {
      msg = JSON.parse(buf.toString("utf8"));
    } catch (_) {
      return;
    }
    if (!msg || typeof msg !== "object") return;
    count("ws");

    const joined = ws._meta && ws._meta.id;

    switch (msg.t) {
      case "j": {
        if (joined) return;
        // 🌍 step 3: listeners don't count; place rooms ("W…") hold 40
        const lo = msg.lo === 1;
        let players = 0, listeners = 0;
        for (const x of set) if (x._meta && x._meta.id) { if (x._meta.lo) listeners++; else players++; }
        if (W ? (lo ? listeners >= W.PLACE.listenCap : players >= W.capFor(ws._room, MAX_MEMBERS)) : set.size >= MAX_MEMBERS) {
          try {
            ws.close(CLOSE_ROOM_FULL, "room full");
          } catch (_) {}
          return;
        }
        const id = freshId(set);
        ws._meta = {
          id,
          name: typeof msg.name === "string" ? msg.name.slice(0, 40) : "Player",
          sk: typeof msg.sk === "string" ? msg.sk.slice(0, 24) : "pink",
          d: null,
        };
        if (lo) ws._meta.lo = 1;
        set.add(ws);

        const peers = [];
        for (const peer of set) {
          if (peer === ws || !peer._meta || !peer._meta.id || peer._meta.lo) continue;
          const p = { id: peer._meta.id, name: peer._meta.name, sk: peer._meta.sk };
          if (peer._meta.d) p.d = peer._meta.d;
          peers.push(p);
        }
        const now = Date.now();
        const hello = { t: "h", id, peers, st: now };            // 🌍 step 1: the server's clock
        if (W) { const rec = W.recent(roomEvents.get(ws._room) || [], now); if (rec.length) hello.r = rec; }   // 🌍 step 2
        sendJson(ws, hello);
        if (!lo) broadcast(set, ws, { t: "+", id, name: ws._meta.name, sk: ws._meta.sk });
        return;
      }

      case "s": {
        if (!joined || ws._meta.lo) return;
        if (!allowState(ws)) return;
        const d = msg.d;
        if (d == null || typeof d !== "object") return;
        ws._meta.d = d;
        broadcast(set, ws, { t: "s", id: ws._meta.id, d, st: Date.now() });   // 🌍 step 2: when the relay got it
        return;
      }

      case "e": {
        if (!joined || ws._meta.lo) return;
        const e = msg.e;
        if (e !== "honk" && e !== "wave") return;
        broadcast(set, ws, { t: "e", id: ws._meta.id, e });
        return;
      }

      case "pi": {
        sendJson(ws, W ? W.pong(msg, Date.now()) : { t: "po" });   // 🌍 step 1
        return;
      }

      case "r": {
        // 🌍 step 2: a reliable one-time event (world.mjs)
        if (!joined || !W || ws._meta.lo) return;
        const now = Date.now();
        ws._rel = ws._rel || {};
        if (!W.relAllowed(ws._rel, now)) return;
        const ev = W.cleanEvent(msg, ws._meta.id, now);
        if (!ev) return;
        let list = roomEvents.get(ws._room);
        if (!list) roomEvents.set(ws._room, (list = []));
        W.remember(list, ev);
        broadcast(set, ws, ev);
        sendJson(ws, { t: "ra", id: ev.id, st: now });
        return;
      }

      default:
        return;
    }
  });

  const cleanup = () => {
    if (!set.has(ws)) return;
    set.delete(ws);
    if (ws._meta && ws._meta.id && !ws._meta.lo) broadcast(set, ws, { t: "-", id: ws._meta.id });
    if (set.size === 0) { rooms.delete(ws._room); roomEvents.delete(ws._room); }
  };

  ws.on("close", cleanup);
  ws.on("error", cleanup);
}

server.listen(PORT, HOST, () => {
  console.log(
    `Shared Road local relay listening on ws://${HOST}:${PORT}/room/<ID>` +
      (usingFallback ? "  (zero-dep fallback WS)" : "  (ws package)")
  );
});
