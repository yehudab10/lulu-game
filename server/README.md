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

## 🌍 One shared world (`world.mjs`, ci/oneserver — owner-approved 2026-11-27, steps 1 + 2)

The relay's clock in the hello / pong (`st`), a server timestamp on every passed-on state, reliable one-time events
(`r` → passed on once, acked with `ra`, kept 20 s in memory for late joiners), `GET /world/config` (the kill switches
`WORLD` — flip a flag to 0 and redeploy to turn a step off) and `GET /world/usage` (the free-plan budget: rooms tell the
Board what they received every 2,000 messages or 10 minutes; `?text=1` gives a sentence; 503 `{ resting }` when the
Durable Objects are over the free allowance). Table: `world_usage` (one row per UTC day: messages, connections, HTTP
requests; 14 days kept) — counts only, nothing about players. Message table: `MULTIPLAYER.md` › ONE SHARED WORLD.
Tests: `node server/test-world.mjs` (`--url` for a deployment) + the game's `scripts/tests3d/worldclock.js`.

## Files

- `mp-worker.js` — Cloudflare Worker + `Room` Durable Object (Hibernation API).
- `wrangler.toml` — deploy config (`name = "lulu-shared-road"`, DO binding + migration).
- `local-relay.js` — Node dev relay, same protocol, `ws://127.0.0.1:9977`.
- `ws-fallback.js` — zero-dependency WebSocket server used if `ws` is missing.
- `test-relay.js` — protocol conformance test (`npm test`).
- `homes.mjs` — 🏘️ the property registry (shared by the worker + the local relay); `test-homes.mjs` its tests.
- `world.mjs` — 🌍 the clock, reliable events, the kill switches and the free-plan budget (both relays); `test-world.mjs`.
- `accounts.mjs` — 🪪 accounts, usernames, friends, requests, blocks, reports (worker + local relay); `test-accounts.mjs`.
- `shops.mjs` — 🏪 player-owned shops (worker + local relay); `test-shops.mjs`.
- `package.json` — deps (`ws`) + scripts.

## 👜 Limited luxury pieces (`wear.mjs`, added 2026-11-27 — owner-approved: golden rule 3, third exception)

Lulu's Road Trip 2.0 sells a few luxury clothing pieces that are LIMITED IN THE WHOLE WORLD (the owner: "limited supply
of items rather than time based"). This counter hands out their numbers ("No. 17 of 50"). Additive: new `/wear/*`
endpoints on the existing global `Board` Durable Object with ONE new table, `wear_limited` (piece, number, holder's
random player id, held / owned, hold-until, when). Nothing that existed changed shape; old clients never call it.
Coins stay on the device. Totals: `LIMITED` in `wear.mjs` (keep in step with `3d/js/features/clothes/data.js`).

| endpoint | body | answer |
|---|---|---|
| `GET /wear/stock` | — | `{ v, stock: { piece: { total, left } } }` (held numbers count as taken) |
| `POST /wear/reserve` | `{ pid, sec, p }` | `{ ok, n, total, until }` — the lowest free number held 5 min · `{ ok: false, why: soldout \| owned }` |
| `POST /wear/confirm` | `{ pid, sec, p }` | `{ ok, n, total }` (paid on her phone) · `{ ok: false, why: expired }` (her phone refunds) |
| `POST /wear/cancel` | `{ pid, sec, p }` | `{ ok }` — a held number goes back |
| `POST /wear/mine` | `{ pid, sec }` | `{ mine: [{ p, n, st, total }], stock }` — a new phone restores her numbers, never charged twice |

Only an ACCOUNT with a username (`accounts.mjs`' secret hash); one of each piece per account; per-account + per-IP
rate limits; deleting the account (`/acct/delete`) gives its pieces back. No resale or trading. Tests:
`node server/test-wear.mjs` (local) · `node server/test-wear.mjs --url https://…` (production: a throw-away hold that's
cancelled; `prodcheck.mjs` runs it).

## 🏪 Player-owned shops (`shops.mjs`, added 2026-11-27 — owner-approved: golden rule 3, fifth exception)

Lulu's Road Trip 2.0 lets a player lease or buy a storefront and stock it; **only real players buy from it** (the plan
the owner approved: `3d/docs/playershops-plan.md`). Additive: new `/shops/*` endpoints on the existing global `Board`
Durable Object with THREE new tables — `shops` (storefront id, owner's random player id, kind, town, an optional name,
since / seen / seized, 👍 count, who reported the name), `shop_stock` (≤ 24 spots a shop: good, units, price, stars),
`shop_day` (per-day counters for the caps, dropped after 2 days) — plus `shop_till` (owner → coins waiting). Nothing that
existed changed shape; old clients never call it. Coins stay on the device: a buyer pays on her phone after the server
says yes; the owner's till (85 % of the price) reaches her phone through `/shops/collect`. Every number: `CONFIG` in
`shops.mjs` (keep in step with `3d/js/features/playershops/data.js`). **Kill switch:** `world.mjs` › `WORLD.shops`
(served at `GET /world/config`): 0 → `/shops/config` answers `{ off: 1 }` and every other call 503 — games show their
shops as OPENING SOON again.

| endpoint | body | answer |
|---|---|---|
| `GET /shops/config` | — | `{ v, cfg: { cap, total, licences, ownerDayProfit, buyerPerOwner, buysPerShop, salesTax } }` · `{ off: 1 }` |
| `GET /shops/list?town=` | — | `{ list: [{ id, k, n, o, z, t }] }` — every shop in the town: kind, name, the owner's username, under renovation, 👍 |
| `GET /shops/view?id=` | — | `{ ok, shop, shelf: [{ s, g, n, p, st, so }], soldOut }` (`so`: that spot is sold out for today) |
| `POST /shops/claim` | `{ pid, sec, id, kind, edictStruck? }` | `{ ok }` · `{ ok: false, why: taken \| mine \| edict \| cap \| licence \| full, o }` |
| `POST /shops/release` | `{ pid, sec, id }` | `{ ok }` (only the owner) |
| `POST /shops/stock` | `{ pid, sec, id, shelf: [{ s, g, n, p, st }] }` | `{ ok, n }` · `{ ok: false, why: price \| bad slot }` (her kind's goods, inside the band) |
| `POST /shops/buy` | `{ pid, sec, id, slot, p }` | `{ ok, g, st, p, left }` · `{ ok: false, why: yours \| new \| price \| buys \| spent \| soldout \| gone \| closed }` |
| `POST /shops/collect` | `{ pid, sec }` | `{ ok, coins }` — the till, emptied |
| `POST /shops/hello` | `{ pid, sec }` | `{ mine, till }` (any POST also marks her seen) |
| `POST /shops/thumb` | `{ pid, sec, id }` | `{ ok }` — once a day, only after buying there |
| `POST /shops/name` / `/shops/report` | `{ pid, sec, id, name }` / `{ pid, sec, id }` | the username rules; 3 reports from different accounts → the name is reset |

**The caps (a net sink, never a coin pump):** the owner earns at most `ownerDayProfit` (300) a real day above what her
stock cost; a buyer spends at most `buyerPerOwner` (150) a day at one owner's shops and buys at most `buysPerShop` (3)
a day in one shop; nobody buys from her own shop; a buyer needs a username and an account at least `minDays` (3) old;
prices sit inside cost × 1.2–1.8; the town keeps 15 %. Midwood allows 1 shop a player (2 when the game says the court
struck the mayor's edict down), Lakewood 3, 4 in all; a few licences per kind per town. Writes: one per 600 ms per
account, 200 ms per IP. **Ghost shops:** an owner unseen for 14 days → her shops are under renovation (sell nothing) for
7 days, then gone. Deleting an account (`/acct/delete`) gives its shops back. **Requests (the free plan):** ≈ 1 per
visit, per purchase, per restock, per till collection; a town's list on the way in + every 2 minutes while in town; an
owner's hello every 5 minutes out in the world (+ ≤ 4 views of her own shops). 500 sales a day ≈ 1,500 requests ≈
1.5 % of the daily allowance.

**Tests:** `node server/test-shops.mjs` (local relay, small caps via the dev-only `SHOPS_CFG`; a dev clock
`POST /shops/_clock` and `/shops/_made` that the worker does NOT have) · `node server/test-shops.mjs --url https://…`
(production: the read-only config + list, then a throw-away zz_test account claims a shop at a lot no town has, stocks
it, releases it, and is deleted). **Rollback:** Cloudflare → Workers & Pages → lulu-shared-road → Deployments → the
previous one → Rollback (the tables stay; nothing old reads them) — or `WORLD.shops = 0` and deploy.

