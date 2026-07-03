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
No collision, no chat, no server authority, no accounts. Phase 2 (separate):
async wanted-poster billboards + daily leaderboard.
