# Lulu's Road Trip — SHARED ROAD (multiplayer) spec

## Design
"Shared Road" is a **presence layer**, not shared physics. Online players
broadcast tiny state heartbeats; nearby players render in your world as
non-colliding GHOSTS (translucent car or walker + nametag). Interactions are
emoji-level (honk 📣 / wave 👋). No chat. Offline play is untouched: all
multiplayer code no-ops unless the player explicitly joins from the menu.

## Modes
- **EVERYONE lobby** (default): room id "lobby".
- **Friend rooms**: 4–8 letter room code (A–Z), client-side uppercased.
- Curated player names only (no free text) — App Store-safe, on-theme.

## Transport
WebSocket, JSON text frames, one connection per client.
Server URL comes from `MP_URL` (a `var` in the client fragment; empty string
= feature hidden). Local dev: `ws://127.0.0.1:9977`. Production: a Cloudflare
Worker + Durable Object (deploy-ready code in `server/mp-worker.js`).

## Protocol (v1)
Client → server:
- join: `{"t":"j","v":1,"room":"LOBBY","name":"Cholent Boy","sk":"pink"}`
- state (≤5 Hz, only while playing/footRun):
  `{"t":"s","d":{"m":0,"x":220,"di":123456,"sp":340,"vk":"car","ct":6,"co":"#E53935"}}`
  - m: 0 drive | 1 foot · x: lane x px (440-wide canvas) · di: total distance
    px (scrollOffset) · sp: current speed px/s · vk: "car"(=Lulu skin)|
    "borrowed"|"cop"|"bus"|"ambulance"|"dozer" · ct: carType when borrowed ·
    co: color when borrowed
- event: `{"t":"e","e":"honk"}` | `{"t":"e","e":"wave"}`
- ping: `{"t":"pi"}` (30s keepalive; server echoes `{"t":"po"}`)

Server → client:
- hello: `{"t":"h","id":"a7","peers":[{"id":"b2","name":"…","sk":"…","d":{…}}]}`
- peer joined: `{"t":"+","id":"b2","name":"…","sk":"…"}`
- peer state: `{"t":"s","id":"b2","d":{…}}`
- peer event: `{"t":"e","id":"b2","e":"honk"}`
- peer left: `{"t":"-","id":"b2"}`

Server is a dumb relay: no auth, no persistence, per-room fanout, caps room
at 24, drops >2 KB frames, rate-limits state to 8 Hz per client.

## Ghost placement (client)
Peers are placed by RELATIVE distance on a looping "highway ring":
`rel = wrap(peer.di - my.di, RING)` with RING = 60000 px, wrapped to
[-RING/2, RING/2). Visible when |rel| < 900 px. Screen pos:
`gy = player.y - rel * 0.55` (clamped margin −80..H+80), `gx = peer.x`.
Between packets, extrapolate `di += sp*dt` and lerp x; snap if error > 250.
Ghosts draw at `globalAlpha 0.75`, nametag chip above, NO collision, drawn
under the player. Foot ghosts (m=1) draw as walking Lulu sprite at 0.75.
Honk event → 📣 floater at that ghost + honk sfx if within 300 px.

## Client integration points (already stubbed by the lead)
- `src/10f-multiplayer.js` — the entire feature (net, ghosts, UI, names).
- Hook calls (guarded `typeof`) already placed by lead in 05/06:
  `mpUpdate(dt)`, `mpDrawGhosts()` in drawPlaying world layer,
  `mpMenuButton()` draw + `mpMenuClick(click)` in the menu,
  `mpStatusChip()` in HUDs.
- Menu flow: 🌐 SHARED ROAD button → name picker (curated grid) → EVERYONE
  or FRIEND CODE → connect. Disconnect on entering menu/gameover keeps the
  socket (presence persists across runs); full disconnect via the button.
- `save.mpName` persists the chosen name.

## Non-goals v1
No collision, no chat, no server authority, no accounts.

## PHASE 2 — async board (wanted posters + daily leaderboard)
A single global Durable Object ("BOARD") with SQLite storage, reached over
plain HTTPS fetch (same Worker, new routes). All client posting happens ONLY
when the player has joined Shared Road this session (opt-in) — offline and
never-joined players are never published.

Routes (JSON):
- `POST /board/wanted`  body `{"name":"Cholent Boy","charges":["GRAND THEFT AUTO","SPEEDING"]}`
  → 204. Server validates: name MUST be one of the 12 curated names, ≤3
  charges, each ≤32 chars A-Z0-9()&' spaces; keeps the newest 30; per-IP
  ≥20s between posts.
- `GET /board/wanted` → `{"list":[{"name":…,"charges":[…],"ts":…}]}` newest
  first, max 12.
- `POST /board/score` body `{"name":"…","score":12345}` → 204. Same name
  validation; score clamped 0..2e6; keeps best score per name per UTC day;
  per-IP ≥10s between posts.
- `GET /board/scores` → `{"day":"2026-07-03","list":[{"name":…,"score":…}]}`
  top 8 for the current UTC day.
- CORS: `Access-Control-Allow-Origin: *` on GET/POST + OPTIONS preflight.

Client behavior (only when opted in, all try/caught, all fire-and-forget):
- On being JAILED (goToJail) → POST /board/wanted with her name + top-3
  charges by severity.
- On game over → POST /board/score (once per run).
- Fugitive-mode WANTED billboards + the precinct most-wanted board draw REAL
  recent players from GET /board/wanted (cached 60s, fallback to the
  fictional posters when empty/unavailable).
- The menu shows a small "🏁 TODAY'S TOP RIDERS" panel (top 5) from
  GET /board/scores (cached 60s), only when Shared Road has ever been used
  (save.mpName exists) and the fetch succeeds — otherwise nothing renders.
