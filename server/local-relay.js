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
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("Shared Road local relay OK\n");
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
