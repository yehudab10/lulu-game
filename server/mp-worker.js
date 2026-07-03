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

const MAX_MEMBERS = 24;
const MAX_FRAME_BYTES = 2 * 1024; // 2 KB
const STATE_RATE_LIMIT = 8; // messages per second per client
const CLOSE_ROOM_FULL = 4001;

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

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
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
        this.send(ws, { t: "h", id, peers });

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
        this.broadcast(ws, { t: "s", id: attach.id, d });
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
        this.send(ws, { t: "po" });
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

// --- Worker entrypoint: route GET /room/<ID> to the room's DO --------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean); // ["room","<ID>"]

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
