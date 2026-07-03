# Shared Road — multiplayer relay

The server side of **Shared Road**, the presence layer for *Lulu's Road Trip*.
It is a **dumb WebSocket relay**: clients broadcast tiny state heartbeats and
emoji events (honk / wave), and the server fans them out to everyone else in
the same room. No auth, no persistence, no game logic. The protocol contract
lives in [`../MULTIPLAYER.md`](../MULTIPLAYER.md) and is the source of truth.

Two interchangeable implementations of the exact same protocol:

| File | Runtime | Use |
|------|---------|-----|
| `local-relay.js` | Node.js | local development |
| `mp-worker.js` + `wrangler.toml` | Cloudflare Worker + Durable Object | production (free tier) |

Both expose `GET /room/<ROOMID>` (WebSocket upgrade). Room ids are sanitized to
`[A-Z0-9]`, uppercased, max 12 chars. Each room caps at 24 members; a 25th is
rejected with WebSocket close code **4001**. Frames > 2 KB are dropped, and
state messages are rate-limited to 8/sec per client.

---

## 1. Local development

```bash
cd server
npm install          # installs `ws` (and wrangler for deploys)
node local-relay.js  # listens on ws://127.0.0.1:9977/room/<ID>
```

Then in the client, point the relay URL at it — set `MP_URL` in
`src/10f-multiplayer.js`:

```js
var MP_URL = "ws://127.0.0.1:9977";
```

(Rebuild the game after editing `src/`: `node build.js`.)

If `npm install` is unavailable, the relay automatically falls back to a
built-in zero-dependency RFC6455 implementation (`ws-fallback.js`) — it just
runs. You can force that path with `WS_IMPL=fallback node local-relay.js`.

### Run the protocol tests

```bash
cd server
npm test             # -> node test-relay.js
```

This boots the relay in-process and drives real WebSocket clients through
join / hello / peer-joined / state fan-out / honk / ping-pong / room isolation
/ peer-left / 8-Hz rate limit / 24-member cap / oversized-frame drop.

---

## 2. Deploy to Cloudflare (one-time, free)

The production relay is a Cloudflare Worker with a Durable Object (one DO
instance per room). Durable Objects with `new_sqlite_classes` are available on
the **free** Workers plan, and WebSocket Hibernation means idle rooms cost
nothing.

```bash
cd server
# 1. Create a free Cloudflare account at https://dash.cloudflare.com/sign-up
# 2. Authenticate wrangler (opens a browser to authorize):
npx wrangler login
# 3. Deploy:
npx wrangler deploy
```

`wrangler deploy` prints the deployed URL, e.g.:

```
https://lulu-shared-road.<your-subdomain>.workers.dev
```

The WebSocket endpoint is that host with `wss://` and the `/room/<ID>` path.

### 3. Wire the URL into the client

Put the `wss://` origin (no path) into `MP_URL` in
`src/10f-multiplayer.js`:

```js
var MP_URL = "wss://lulu-shared-road.<your-subdomain>.workers.dev";
```

The client appends `/room/<ROOMID>` itself. An empty string hides the feature.
Rebuild: `node build.js` (then `node scripts/copy-web.js`) and push.

### Quick smoke-test of a deployment

```bash
# should print: Shared Road relay OK
curl https://lulu-shared-road.<your-subdomain>.workers.dev/health
```

---

## Files

- `mp-worker.js` — Cloudflare Worker + `Room` Durable Object (Hibernation API).
- `wrangler.toml` — deploy config (`name = "lulu-shared-road"`, DO binding + migration).
- `local-relay.js` — Node dev relay, same protocol, `ws://127.0.0.1:9977`.
- `ws-fallback.js` — zero-dependency WebSocket server used if `ws` is missing.
- `test-relay.js` — protocol conformance test (`npm test`).
- `package.json` — deps (`ws`) + scripts.
