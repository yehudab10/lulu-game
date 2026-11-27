// Shared Road — multiplayer relay for Lulu's Road Trip
// Cloudflare Worker + Durable Object. Deploy with `wrangler deploy`.
//
// A dumb presence relay: one Durable Object instance per room, WebSocket
// clients connect at  GET /room/<ROOMID>  and their state heartbeats / events
// are fanned out to everyone else in the same room. No auth, no persistence.
//
// Protocol (v1) — see MULTIPLAYER.md for the source of truth.
//   client -> server:  j (join) · s (state) · e (event) · pi (ping)
//   server -> client:  h (hello) · + (peer joined) · s (peer state)
//                      e (peer event) · - (peer left) · po (pong)
//
// Rules enforced here:
//   - room id sanitized to [A-Z0-9], max 12 chars, uppercased
//   - cap 24 members / room  (reject with WS close code 4001)
//   - drop frames > 2 KB
//   - rate-limit state (t:"s") to 8 / sec per client (silently drop excess)
//   - fan out only to OTHER members; assign short ids
//   - clean up on close / error
//
// Uses the WebSocket Hibernation API (state.acceptWebSocket + webSocket*
// handlers) so idle rooms are evicted from memory and cost nothing.

import { createHomes, sqlStore } from "./homes.mjs";   // 🏘️ the world-wide property registry (ci/realestate, owner-approved 2026-11-20)
import { createAccounts, doSql } from "./accounts.mjs";
import * as W from "./world.mjs";                      // 🌍 one shared world: the clock, reliable events, the free-plan budget (ci/oneserver, owner-approved 2026-11-27) // 🪪 accounts + usernames + friends (ci/accounts, owner-approved 2026-11-26)
import { createShops } from "./shops.mjs";             // 🏪 player-owned shops (ci/playershops, owner-approved 2026-11-27 — golden rule 3, fifth exception)
import { createWear } from "./wear.mjs";               // 👜 limited luxury pieces: a world-wide stock counter (ci/clothes, owner-approved 2026-11-27)

const MAX_MEMBERS = 24;
const MAX_FRAME_BYTES = 2 * 1024; // 2 KB
const STATE_RATE_LIMIT = 8; // messages per second per client
const CLOSE_ROOM_FULL = 4001;

// --- Async board (phase 2) constants ---------------------------------------
// The 12 curated player names — kept byte-identical to CURATED_NAMES in
// src/10f-multiplayer.js. Posts are only accepted for one of these names.
const CURATED_NAMES = [
  "Cholent Boy", "Rugelach Queen", "Bubby's Favorite", "Kugel Kid",
  "Shabbos Racer", "Babka Baron", "Gefilte Ghost", "Mitzvah Machine",
  "Sheitel Slayer", "Dreidel Daredevil", "Latke Legend", "Schmaltz Speedster",
];
const CURATED_SET = new Set(CURATED_NAMES);

const WANTED_KEEP = 30; // retain newest N posters
const WANTED_GET = 12; // return newest N on GET
const SCORES_GET = 8; // top-N daily scores on GET
const MAX_CHARGES = 3; // charges per wanted poster
const MAX_CHARGE_LEN = 32; // chars per charge
const SCORE_MAX = 2e6; // score clamp ceiling
const WANTED_MIN_GAP_MS = 20 * 1000; // per-IP throttle for /board/wanted
const SCORE_MIN_GAP_MS = 10 * 1000; // per-IP throttle for /board/score

// CORS headers applied to every board response (incl. OPTIONS preflight).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function corsJson(obj, status) {
  return new Response(status === 204 ? null : JSON.stringify(obj), {
    status: status || 200,
    headers: {
      ...CORS_HEADERS,
      ...(status === 204 ? {} : { "content-type": "application/json" }),
    },
  });
}

function utcDay(now) {
  return new Date(now == null ? Date.now() : now).toISOString().slice(0, 10);
}

// Validate a name is one of the curated 12 (exact match).
function validName(name) {
  return typeof name === "string" && CURATED_SET.has(name);
}

// Sanitize a charges array: keep ≤MAX_CHARGES, uppercase, strip disallowed
// chars (allow A-Z 0-9 ( ) & ' and spaces), truncate each to MAX_CHARGE_LEN,
// drop empties.
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

// Clamp a score to an integer in [0, SCORE_MAX].
function clampScore(v) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > SCORE_MAX ? SCORE_MAX : n;
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
  for (let i = 0; i < 2; i++) {
    s += ID_ALPHABET[(Math.random() * ID_ALPHABET.length) | 0];
  }
  return s;
}

// --- Durable Object: one instance per room ---------------------------------

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // In-memory rate-limit windows, keyed by WebSocket. Rebuilt lazily after
    // hibernation — losing it just resets a client's window, which is fine.
    this.rate = new Map();
    this.recentEv = [];                 // 🌍 reliable events of the last 20 s (world.mjs)
    this.relRate = new Map();           // 🌍 per-socket reliable-event limit
    this.count = { ws: 0, conn: 0, at: Date.now() };   // 🌍 the free-plan budget: what this room received, told to the Board now and then
  }

  // 🌍 tell the Board what this room received (every 2,000 messages or 10 minutes — ~1 % more requests)
  tally(kind) {
    const c = this.count;
    c[kind]++;
    if (c.ws + c.conn < 2000 && Date.now() - c.at < 600000) return;
    const body = JSON.stringify({ ws: c.ws, conn: c.conn });
    this.count = { ws: 0, conn: 0, at: Date.now() };
    try {
      const stub = this.env.BOARD.get(this.env.BOARD.idFromName("global"));
      this.state.waitUntil(stub.fetch("https://relay/world/_count", { method: "POST", body }).catch(() => {}));
    } catch (_) { /* the budget counter is best-effort */ }
  }

  // Every joined member carries its identity on the socket attachment so it
  // survives hibernation. Un-joined sockets have no attachment.
  members() {
    const out = [];
    for (const ws of this.state.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (a && a.id) out.push({ ws, meta: a });
    }
    return out;
  }

  usedIds() {
    const s = new Set();
    for (const m of this.members()) s.add(m.meta.id);
    return s;
  }

  freshId() {
    const used = this.usedIds();
    let id = randomId();
    let guard = 0;
    while (used.has(id) && guard++ < 500) id = randomId();
    // Extremely unlikely fallback: widen the id.
    while (used.has(id)) id += ID_ALPHABET[(Math.random() * ID_ALPHABET.length) | 0];
    return id;
  }

  send(ws, obj) {
    try {
      ws.send(JSON.stringify(obj));
    } catch (_) {
      /* socket is going away; ignore */
    }
  }

  broadcast(exceptWs, obj) {
    const payload = JSON.stringify(obj);
    for (const m of this.members()) {
      if (m.ws === exceptWs) continue;
      try {
        m.ws.send(payload);
      } catch (_) {
        /* ignore */
      }
    }
  }

  async fetch(request) {
    const upgrade = request.headers.get("Upgrade");
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    // Hibernation-aware accept: the runtime will re-deliver messages to
    // webSocketMessage / webSocketClose even after the DO is evicted.
    this.state.acceptWebSocket(server);
    this.tally("conn");

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    this.tally("ws");
    // Enforce max frame size (message may be string or ArrayBuffer).
    const size =
      typeof message === "string"
        ? // fast byte-length estimate without allocating in the common ascii case
          byteLength(message)
        : message.byteLength;
    if (size > MAX_FRAME_BYTES) return;

    let msg;
    try {
      msg = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch (_) {
      return; // not JSON — drop
    }
    if (!msg || typeof msg !== "object") return;

    const attach = ws.deserializeAttachment();
    const joined = attach && attach.id;

    switch (msg.t) {
      case "j": {
        if (joined) return; // already joined, ignore duplicate join
        // Room-full check counts current members.
        if (this.members().length >= MAX_MEMBERS) {
          try {
            ws.close(CLOSE_ROOM_FULL, "room full");
          } catch (_) {}
          return;
        }
        const id = this.freshId();
        const meta = {
          id,
          name: typeof msg.name === "string" ? msg.name.slice(0, 40) : "Player",
          sk: typeof msg.sk === "string" ? msg.sk.slice(0, 24) : "pink",
          d: null, // last known state payload
        };
        ws.serializeAttachment(meta);

        // hello -> the joiner, with a snapshot of existing peers
        const peers = [];
        for (const m of this.members()) {
          if (m.ws === ws) continue;
          const p = { id: m.meta.id, name: m.meta.name, sk: m.meta.sk };
          if (m.meta.d) p.d = m.meta.d;
          peers.push(p);
        }
        // 🌍 step 1: the server's clock; step 2: the room's recent reliable events (a late joiner gets them)
        const now = Date.now();
        const hello = { t: "h", id, peers, st: now };
        const rec = W.recent(this.recentEv, now);
        if (rec.length) hello.r = rec;
        this.send(ws, hello);

        // "+" peer-joined -> everyone else
        this.broadcast(ws, { t: "+", id, name: meta.name, sk: meta.sk });
        return;
      }

      case "s": {
        if (!joined) return;
        if (!this.allowState(ws)) return; // rate limited
        const d = msg.d;
        if (d == null || typeof d !== "object") return;
        // remember for future joiners' hello snapshot
        attach.d = d;
        ws.serializeAttachment(attach);
        this.broadcast(ws, { t: "s", id: attach.id, d, st: Date.now() });   // 🌍 step 2: when the relay got it
        return;
      }

      case "e": {
        if (!joined) return;
        const e = msg.e;
        if (e !== "honk" && e !== "wave") return;
        this.broadcast(ws, { t: "e", id: attach.id, e });
        return;
      }

      case "pi": {
        this.send(ws, W.pong(msg, Date.now()));          // 🌍 step 1: { t: "po", st, n? } (old clients ignore st)
        return;
      }

      case "r": {
        // 🌍 step 2: a reliable one-time event — passed on once, acknowledged, remembered 20 s for late joiners
        if (!joined) return;
        const now = Date.now();
        const slot = this.relRate.get(ws) || {};
        this.relRate.set(ws, slot);
        if (!W.relAllowed(slot, now)) return;
        const ev = W.cleanEvent(msg, attach.id, now);
        if (!ev) return;
        W.remember(this.recentEv, ev);
        this.broadcast(ws, ev);
        this.send(ws, { t: "ra", id: ev.id, st: now });
        return;
      }

      default:
        return; // unknown message type — drop
    }
  }

  allowState(ws) {
    const now = Date.now();
    let w = this.rate.get(ws);
    if (!w || now - w.start >= 1000) {
      w = { start: now, count: 0 };
      this.rate.set(ws, w);
    }
    if (w.count >= STATE_RATE_LIMIT) return false;
    w.count++;
    return true;
  }

  async webSocketClose(ws, code, reason, wasClean) {
    this.dropped(ws);
  }

  async webSocketError(ws, err) {
    this.dropped(ws);
  }

  dropped(ws) {
    const attach = ws.deserializeAttachment();
    this.rate.delete(ws);
    this.relRate.delete(ws);
    if (attach && attach.id) {
      // announce departure to remaining members
      this.broadcast(ws, { t: "-", id: attach.id });
    }
    try {
      ws.close();
    } catch (_) {}
  }
}

// UTF-8 byte length of a string without allocating a Buffer.
function byteLength(str) {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++; // surrogate pair
    } else bytes += 3;
  }
  return bytes;
}

// --- Durable Object: the single global async board -------------------------
//
// One instance (idFromName("global")) backs the wanted-poster feed and the
// per-UTC-day leaderboard. Storage is SQLite (survives restarts/hibernation);
// per-IP rate limits live in an in-memory map (best-effort; resetting on
// eviction only relaxes throttling, never corrupts data).

export class Board {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;
    // ip -> { wanted: lastMs, score: lastMs }
    this.ipHits = new Map();
    this.ready = false;
  }

  ensureSchema() {
    if (this.ready) return;
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS wanted (ts INTEGER, name TEXT, charges TEXT)"
    );
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS scores (day TEXT, name TEXT, score INTEGER, PRIMARY KEY (day, name))"
    );
    this.ready = true;
  }

  accounts() {
    if (!this.acct) {
      const q = doSql(this.sql);
      this.acct = createAccounts(q, {
        homeSech: (pid) => { try { const r = q("SELECT sech FROM homes WHERE owner = ? LIMIT 1", pid)[0]; return r ? r.sech : null; } catch (e) { return null; } },
        onDelete: (pid) => { this.wearReg().releaseAll(pid); this.shopsReg().releaseAll(pid); },
      });
    }
    return this.acct;
  }

  shopsReg() {
    if (!this.shops) this.shops = createShops(doSql(this.sql), { sechOf: (pid) => this.accounts().sechOf(pid), nameOf: (pid) => this.accounts().nameOf(pid),
      madeOf: (pid) => this.accounts().madeOf(pid), on: () => !!W.WORLD.shops });
    return this.shops;
  }

  wearReg() {
    if (!this.wear) this.wear = createWear(doSql(this.sql), { sechOf: (pid) => this.accounts().sechOf(pid), nameOf: (pid) => this.accounts().nameOf(pid) });
    return this.wear;
  }

  // 🌍 today's counts (one row per UTC day; written at most every 50 requests or on a room's report)
  usageRow() {
    const day = W.dayOf(Date.now());
    if (!this.use || this.use.day !== day) {
      this.sql.exec("CREATE TABLE IF NOT EXISTS world_usage (day TEXT PRIMARY KEY, ws INTEGER, conn INTEGER, http INTEGER)");
      const r = this.sql.exec("SELECT * FROM world_usage WHERE day = ?", day).toArray()[0];
      this.use = r ? { day, ws: r.ws, conn: r.conn, http: r.http, dirty: 0 } : { day, ws: 0, conn: 0, http: 0, dirty: 0 };
      this.sql.exec("DELETE FROM world_usage WHERE day < ?", W.dayOf(Date.now() - 14 * 86400000));
    }
    return this.use;
  }
  usageAdd(ws, conn, http, flush) {
    try {
      const u = this.usageRow();
      u.ws += ws; u.conn += conn; u.http += http; u.dirty++;
      if (flush || u.dirty >= 50) {
        u.dirty = 0;
        this.sql.exec("INSERT INTO world_usage (day, ws, conn, http) VALUES (?, ?, ?, ?) ON CONFLICT (day) DO UPDATE SET ws = excluded.ws, conn = excluded.conn, http = excluded.http", u.day, u.ws, u.conn, u.http);
      }
    } catch (_) { /* best-effort */ }
  }

  clientIp(request) {
    return request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  }

  // Returns true if this IP is allowed to post `kind` now; records the hit.
  rateOk(ip, kind, gapMs, now) {
    const rec = this.ipHits.get(ip) || {};
    const last = rec[kind] || 0;
    if (now - last < gapMs) return false;
    rec[kind] = now;
    this.ipHits.set(ip, rec);
    return true;
  }

  async readBody(request, max) {
    try {
      const text = await request.text();
      if (text.length > (max || MAX_FRAME_BYTES)) return null;
      const obj = JSON.parse(text);
      return obj && typeof obj === "object" ? obj : null;
    } catch (_) {
      return null;
    }
  }

  async fetch(request) {
    this.ensureSchema();
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 🌍 the free-plan budget (world.mjs): rooms report what they received; every HTTP request here counts too
    if (path === "/world/_count" && method === "POST") {
      const b = await this.readBody(request);
      this.usageAdd(Math.max(0, Number(b && b.ws) || 0), Math.max(0, Number(b && b.conn) || 0), 1, true);
      return corsJson({ ok: true });
    }
    this.usageAdd(0, 0, 1, false);
    if (path === "/world/usage") {
      const u = W.usageOf(this.usageRow(), Date.now());
      if (url.searchParams.get("text")) return new Response(W.usageText(u), { headers: { ...CORS_HEADERS, "content-type": "text/plain; charset=utf-8" } });
      return corsJson(u);
    }

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 🪪 /acct/* — accounts, usernames, friends (accounts.mjs): more tables in this same global object
    if (path.startsWith("/acct/")) {
      let body = null;
      if (method === "GET") body = { n: url.searchParams.get("n"), pid: url.searchParams.get("pid") };
      else body = await this.readBody(request, 16 * 1024);
      const r = await this.accounts().handle(path, method, body, this.clientIp(request));
      return corsJson(r.body, r.status);
    }

    // 👜 /wear/* — limited luxury pieces (wear.mjs): one more table in this same global object
    // 🏪 /shops/* — player-owned shops (shops.mjs): three more tables in this same global object
    if (path.startsWith("/shops/")) {
      const body = method === "GET" ? {} : await this.readBody(request, 8 * 1024);
      const r = await this.shopsReg().handle(path, method, body, this.clientIp(request), Object.fromEntries(url.searchParams));
      return corsJson(r.body, r.status);
    }
    if (path.startsWith("/wear/")) {
      const body = method === "GET" ? {} : await this.readBody(request, 4 * 1024);
      const r = await this.wearReg().handle(path, method, body, this.clientIp(request));
      return corsJson(r.body, r.status);
    }

    // 🏘️ /homes/* — the property registry (homes.mjs): one more table in this same global object
    if (path.startsWith("/homes/")) {
      if (!this.homes) this.homes = createHomes(sqlStore(this.sql), { acctSech: (pid) => this.accounts().sechOf(pid), nameOf: (pid) => this.accounts().nameOf(pid) });
      let body = null;
      if (method === "GET") body = { town: url.searchParams.get("town") };
      else body = await this.readBody(request);
      const r = await this.homes.handle(path, method, body, this.clientIp(request));
      return corsJson(r.body, r.status);
    }

    if (path === "/board/wanted") {
      if (method === "GET") return this.getWanted();
      if (method === "POST") return this.postWanted(request);
      return corsJson({ error: "method not allowed" }, 405);
    }
    if (path === "/board/score" && method === "POST") {
      return this.postScore(request);
    }
    if (path === "/board/scores" && method === "GET") {
      return this.getScores();
    }
    return corsJson({ error: "not found" }, 404);
  }

  getWanted() {
    const rows = this.sql
      .exec(
        "SELECT name, charges, ts FROM wanted ORDER BY ts DESC, rowid DESC LIMIT ?",
        WANTED_GET
      )
      .toArray();
    const list = rows.map((r) => ({
      name: r.name,
      charges: safeParseCharges(r.charges),
      ts: r.ts,
    }));
    return corsJson({ list });
  }

  async postWanted(request) {
    const body = await this.readBody(request);
    if (!body || !validName(body.name)) {
      return corsJson({ error: "bad request" }, 400);
    }
    const ip = this.clientIp(request);
    const now = Date.now();
    if (!this.rateOk(ip, "wanted", WANTED_MIN_GAP_MS, now)) {
      return corsJson({ error: "rate limited" }, 429);
    }
    const charges = sanitizeCharges(body.charges);
    this.sql.exec(
      "INSERT INTO wanted (ts, name, charges) VALUES (?, ?, ?)",
      now,
      body.name,
      JSON.stringify(charges)
    );
    // Retain only the newest WANTED_KEEP posters.
    this.sql.exec(
      "DELETE FROM wanted WHERE rowid NOT IN (SELECT rowid FROM wanted ORDER BY ts DESC, rowid DESC LIMIT ?)",
      WANTED_KEEP
    );
    return corsJson(null, 204);
  }

  async postScore(request) {
    const body = await this.readBody(request);
    if (!body || !validName(body.name)) {
      return corsJson({ error: "bad request" }, 400);
    }
    const ip = this.clientIp(request);
    const now = Date.now();
    if (!this.rateOk(ip, "score", SCORE_MIN_GAP_MS, now)) {
      return corsJson({ error: "rate limited" }, 429);
    }
    const score = clampScore(body.score);
    const day = utcDay(now);
    // Best score per name per UTC day.
    this.sql.exec(
      "INSERT INTO scores (day, name, score) VALUES (?, ?, ?) " +
        "ON CONFLICT (day, name) DO UPDATE SET score = MAX(score, excluded.score)",
      day,
      body.name,
      score
    );
    return corsJson(null, 204);
  }

  getScores() {
    const day = utcDay();
    const rows = this.sql
      .exec(
        "SELECT name, score FROM scores WHERE day = ? ORDER BY score DESC LIMIT ?",
        day,
        SCORES_GET
      )
      .toArray();
    const list = rows.map((r) => ({ name: r.name, score: r.score }));
    return corsJson({ day, list });
  }
}

function safeParseCharges(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch (_) {
    return [];
  }
}

// --- Worker entrypoint: route GET /room/<ID> to the room's DO --------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean); // ["room","<ID>"]

    // Async board (phase 2): everything under /board/* → the single global
    // Board Durable Object. Handles GET/POST + OPTIONS preflight itself.
    // 🌍 /world/config — the kill switches + the server's clock, answered by the Worker itself (no Durable Object, so
    // it still answers when the Durable Objects are over the free daily allowance)
    if (url.pathname === "/world/config") {
      return new Response(JSON.stringify({ world: W.WORLD, st: Date.now() }), { headers: { ...CORS_HEADERS, "content-type": "application/json", "cache-control": "no-store" } });
    }
    if (url.pathname === "/world/usage") {
      try {
        const r = await env.BOARD.get(env.BOARD.idFromName("global")).fetch(request);
        if (r.status >= 500) throw new Error("board " + r.status);
        return r;
      } catch (e) {
        // the Durable Objects refused: almost always the free daily allowance — online play rests until midnight UTC
        const now = Date.now();
        const reset = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() + 1);
        return new Response(JSON.stringify({ resting: 1, resetAt: reset, why: String(e && e.message || e).slice(0, 120) }), { status: 503, headers: { ...CORS_HEADERS, "content-type": "application/json" } });
      }
    }

    if (parts[0] === "board" || parts[0] === "homes" || parts[0] === "acct" || parts[0] === "wear" || parts[0] === "shops") {
      const id = env.BOARD.idFromName("global");
      const stub = env.BOARD.get(id);
      return stub.fetch(request);
    }

    if (request.method === "GET" && parts.length === 2 && parts[0] === "room") {
      const room = sanitizeRoom(parts[1]);
      if (!room) return new Response("bad room id", { status: 400 });

      const upgrade = request.headers.get("Upgrade");
      if (!upgrade || upgrade.toLowerCase() !== "websocket") {
        return new Response("expected websocket upgrade", { status: 426 });
      }

      const id = env.ROOMS.idFromName(room);
      const stub = env.ROOMS.get(id);
      return stub.fetch(request);
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("Shared Road relay OK\n", {
        headers: { "content-type": "text/plain" },
      });
    }

    return new Response("not found", { status: 404 });
  },
};
