# Shared Road — multiplayer relay

The server side of **Shared Road**, the presence layer for *Lulu's Road Trip*.
It is a **dumb WebSocket relay**: clients broadcast tiny state heartbeats and
emoji events (honk / wave), and the server fans them out to everyone else in
the same room. The rooms have no auth, no persistence, no game logic (the global Board object keeps the board, the
property registry and — since 2026-11-26 — player accounts; see below). The protocol contract
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

## 🏘️ The world-wide property registry (`homes.mjs`, added 2026-11-20 — owner-approved)

Lulu's Road Trip 2.0 lets players buy homes in Lakewood / Midwood; this registry makes ownership the same for
everyone online (one owner per house). Additive: new `/homes/*` endpoints, served by the existing global `Board`
Durable Object (no new class, no migration) with ONE new SQLite table, `homes`. Nothing that existed changed shape;
old clients never call it, and a new client against an old server gets a 404 on `/homes/config` and stays local.

| endpoint | body | answer |
|---|---|---|
| `GET /homes/config` | — | `{ v, cfg }` — the government's knobs (below) |
| `GET /homes/list?town=lakewood` | — | `{ list: [{ h, l, s, z }] }` every owned house in a town: id, the owner's generated label, since, seized |
| `POST /homes/hello` | `{ pid, sec, name }` | my houses + my label; restarts the idle clock |
| `POST /homes/claim` | `{ pid, sec, name, h }` | `{ ok, why: taken \| seized \| cap \| full \| mine, l }` |
| `POST /homes/release` | `{ pid, sec, h }` | `{ ok }` (only the owner) |
| `POST /homes/appeal` | `{ pid, sec, h }` | `{ ok, won }` — a seized house, once; the SERVER rolls |

**Stored** (one row per owned house): the house id (a door's place in the town), the owner's random player id (16
base32 chars made on the device — nothing personal), a SHA-256 hash of the device secret (never the secret), a
GENERATED label (one of the 12 curated names + a number from the id — never typed text), the town, bought / last
seen / seized / appealed times. No IP is stored (rate limits keep it in memory for seconds), no location, no device.

**The government's knobs** — `CONFIG` at the top of `homes.mjs` ("subject to change if the government decides
differently"; a server deploy changes them, no new client needed — clients show whatever `/homes/config` says):
`cap` 10 homes a player · `idleDays` 14 (no hello → the Abandoned Kugel Ordinance seizes their homes) · `holdDays` 7
(seized → back on the market) · `appealWin` 0.5 (the court's odds) · `claimGapMs` 3000 (per player AND per IP) ·
`maxRows` 20000. If the towns fill up, turn `idleDays` down first (14 → 7), then `cap` (10 → 5).

**Tests:** `node server/test-homes.mjs` (local relay, a dev-only clock `POST /homes/_clock` that the worker does NOT
have) and the game's `scripts/tests3d/realestateworld.js` (two players, one local relay).

**Rollback:** Cloudflare keeps every deployed version — `npx wrangler rollback` (or the dashboard: Workers →
lulu-shared-road → Deployments → the previous one → Rollback). The `homes` table stays (harmless; nothing old reads it).

## 🪪 Accounts, usernames and friends (`accounts.mjs`, added 2026-11-26 — owner-approved, AGENTS.md golden rule 3)

Unique usernames, a friends list + friend requests that wait for an offline player, blocks and name reports. Additive:
new `/acct/*` endpoints on the same global `Board` Durable Object (no new class, no migration) with new SQLite tables.
Nothing that existed changed shape; old clients never call it. The name rules + filter are ONE file shared with the game:
`../3d/js/features/accounts/rules.js` (wrangler bundles it; the local relay imports it).

| endpoint | body | answer |
|---|---|---|
| `GET /acct/config` | — | `{ cfg }` |
| `GET /acct/check?n=Name` | — | `{ ok, why, sugg: [3 free names] }` (`n` empty → 3 ideas) |
| `POST /acct/hello` | `{ pid, sec, pk?, claims?: [pid], cards?: { pid: sealed } }` | makes the account on first sight; `{ me: { name, gen, ask, next, who }, friends: [{ f, n, pk, c, mine, at }], inReq, outReq, blocks, claims, badge }` |
| `POST /acct/name` | `{ pid, sec, name }` | `{ ok, why: short\|long\|chars\|start\|under\|rude\|staff\|contact\|taken\|retired\|wait, sugg, next }` |
| `POST /acct/ask` | `{ pid, sec, to: name }` or `{ t, room, rid }` | `{ ok, why: sent\|friends\|none\|self\|closed\|full\|outfull\|busy }` (429 = over the hourly limit) |
| `POST /acct/answer` | `{ pid, sec, f, yes }` | `{ ok, why: friends\|declined\|gone\|full\|busy }` |
| `POST /acct/cancel` · `/remove` · `/block` · `/unblock` | `{ pid, sec, f }` | `{ ok }` |
| `POST /acct/report` | `{ pid, sec, f }` or `{ t, room, rid }` | `{ ok, counted, replaced? }` |
| `POST /acct/set` | `{ pid, sec, who: 0\|1\|2 }` | who can send me requests: everyone · friends of friends · nobody |
| `POST /acct/ticket` | `{ pid, sec, room, rid }` | `{ t }` — "this relay connection is account X" (HMAC, 6 h) |
| `POST /acct/names` | `{ q: [[room, rid, t], …] }` (≤ 30) | `{ n: [name \| null, …] }` |
| `POST /acct/delete` | `{ pid, sec }` | deletes the account, its friendships, requests, claims, blocks, reports |

**Stored** — nothing else: `accounts` (random player id, SHA-256 of the device secret, username + its normalised form,
generated-name / please-pick flags, made / seen / renamed times, who-can-request, the friendship public key, when the
on-device list was first synced) · `edges` (a friendship + each side's SEALED doorbell note, which only the two phones can
open) · `requests` (who asked whom, when, declined when) · `claims` (on-device friendships waiting for the other side to
update) · `blocks` · `reports` (who reported whose name, when — cleared on a rename) · `retired` (normalised names taken
away after reports) · `acct_meta` (the ticket key, random, made on first use: no deploy secret). No IP (rate limits live in
memory), no email, no real name, no contacts, no location.

**Knobs** (`CONFIG` in `accounts.mjs`): rename once per 30 days · 30 friends · ≤ 20 waiting outgoing / 30 incoming
requests · 10 asks an hour per account (30 per IP) · a decline blocks re-asks for 30 days · unanswered requests expire
after 60 days · 3 reports from different accounts ≥ 1 day old (≤ 5 reports a day each) within 14 days replace a name ·
unnamed accounts unseen for 60 days are dropped. `/homes/*` also checks an account's secret, and its town list shows the
owner's username.

**Tests:** `node server/test-accounts.mjs` (local relay on node:sqlite — Node ≥ 22.5; a dev-only `POST /acct/_clock`) and
`node server/test-accounts.mjs --url https://…` against a deployment (throw-away `zz_test_…` accounts, deleted after).
The game: `scripts/tests3d/accounts.js`, `accountsfriends.js` (two / three real pages, some closed and reopened).

**Rollback:** Cloudflare → Workers & Pages → lulu-shared-road → Deployments → the previous one → Rollback (or
`npx wrangler rollback`). The new tables stay (harmless; nothing old reads them).

## Files

- `mp-worker.js` — Cloudflare Worker + `Room` Durable Object (Hibernation API).
- `wrangler.toml` — deploy config (`name = "lulu-shared-road"`, DO binding + migration).
- `local-relay.js` — Node dev relay, same protocol, `ws://127.0.0.1:9977`.
- `ws-fallback.js` — zero-dependency WebSocket server used if `ws` is missing.
- `test-relay.js` — protocol conformance test (`npm test`).
- `homes.mjs` — 🏘️ the property registry (shared by the worker + the local relay); `test-homes.mjs` its tests.
- `accounts.mjs` — 🪪 accounts, usernames, friends, requests, blocks, reports (worker + local relay); `test-accounts.mjs`.
- `package.json` — deps (`ws`) + scripts.
