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

function handleConnection(ws) {
  const set = roomMembers(ws._room);

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

    const joined = ws._meta && ws._meta.id;

    switch (msg.t) {
      case "j": {
        if (joined) return;
        if (set.size >= MAX_MEMBERS) {
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
        set.add(ws);

        const peers = [];
        for (const peer of set) {
          if (peer === ws || !peer._meta || !peer._meta.id) continue;
          const p = { id: peer._meta.id, name: peer._meta.name, sk: peer._meta.sk };
          if (peer._meta.d) p.d = peer._meta.d;
          peers.push(p);
        }
        sendJson(ws, { t: "h", id, peers });
        broadcast(set, ws, { t: "+", id, name: ws._meta.name, sk: ws._meta.sk });
        return;
      }

      case "s": {
        if (!joined) return;
        if (!allowState(ws)) return;
        const d = msg.d;
        if (d == null || typeof d !== "object") return;
        ws._meta.d = d;
        broadcast(set, ws, { t: "s", id: ws._meta.id, d });
        return;
      }

      case "e": {
        if (!joined) return;
        const e = msg.e;
        if (e !== "honk" && e !== "wave") return;
        broadcast(set, ws, { t: "e", id: ws._meta.id, e });
        return;
      }

      case "pi": {
        sendJson(ws, { t: "po" });
        return;
      }

      default:
        return;
    }
  });

  const cleanup = () => {
    if (!set.has(ws)) return;
    set.delete(ws);
    if (ws._meta && ws._meta.id) broadcast(set, ws, { t: "-", id: ws._meta.id });
    if (set.size === 0) rooms.delete(ws._room);
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
