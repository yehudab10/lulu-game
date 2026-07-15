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
- piggyback fields inside `d` (the relay forwards `d` verbatim, so client-only
  features ride along without server changes):
  - races: `rn` race id (invite/announce) · `rp` cumulative race progress px ·
    `rw` race id the sender just won
  - party parking: `pk:{x,y,r}` — parking-minigame car pose (px, px, radians
    ×100 rounded), sent only while `state === "parking"`. Peers with a fresh
    `pk` (<3 s) draw as translucent ghosts in the shared lot. Friend rooms
    seed the lot layout from the room code (`mpParkingRng`) and each member
    gets a distinct target bay by roster order (`mpParkingSpotIndex`).
  - record toast: `pb:[nonce, score]` — sent for ~4 s after the local player
    beats their own high score mid-run (`mpNoteRecord`, fired from the driving
    loop's `pbBroken` celebration). Peers de-dupe per sender nonce and show a
    one-shot "🎉 <name> set a record" toast (`mpApplyState` → `mpToasts` →
    `mpDrawToasts`). Dropped after ~4 s so late joiners don't see stale toasts;
    hello-snapshot nonces are swallowed (never re-toasted). You never toast your
    own record — the local `recordBannerT` banner already fires.

## Client-only party features (verbatim relay, no server changes)
All of these ride inside the relayed `d` packet or exist purely client-side —
the frozen relay forwards `d` verbatim and needs no awareness of them.
- **Switch rooms while connected** (`mpSwitchRoom`): the Shared Road picker's
  connected panel exposes the EVERYONE|FRIEND toggle + code wheel; when the form
  points at a different room the big button reads "🔀 SWITCH". Switching closes
  the socket WITHOUT setting `save.mpAutoOff` (keeps `mpWant`/cruise-auto intact),
  points `mpRoom`/`mpRoomKind` at the target, clears `mpPeers`, cancels any live
  race (with a floater), resets the reconnect backoff, and reconnects on the
  normal path. Plain CONNECT (from disconnected) and DISCONNECT (sets
  `mpAutoOff`) are unchanged.
- **Convoy bonus** (`mpConvoyMult`): FRIEND rooms only. `state === "playing"`,
  not on foot, with ≥1 peer ghost within `|rel| < 500` px for 2 s continuous →
  ×1.5 score multiplier (drops after 3 s with nobody in range). Applied via the
  driving loop's `scoreMult` (`* mpConvoyMult()`). Lobby is excluded for fairness
  even though scores still post to the daily board (social play is encouraged).
  A "🚗🚗 ×1.5" HUD chip shows while active.
- event: `{"t":"e","e":"honk"}` | `{"t":"e","e":"wave"}`
- ping: `{"t":"pi"}` (30s keepalive; server echoes `{"t":"po"}`)

## PARTY WAVE 2 — real player-to-player interactions
Four features, all riding the FROZEN relay. BONK + SLIPSTREAM are pure
client-side self-detection (nothing new on the wire — each client independently
tests the same geometry). TAG + EMOTES piggyback new fields inside the
verbatim-relayed `d` packet. All live in `src/10f-multiplayer.js`; the only
non-10f touches are three tiny guarded hooks (see "Client integration points").

- **BONK! physical ghosts** (`mpBonkUpdate`): FRIEND rooms only, `state ===
  "playing"`, both cars in drive mode (`m === 0`). Each frame, for every visible
  ghost, test `|gx − player.x| < 44 && |gy − player.y| < 60`. On overlap START
  (edge-triggered via `p.bonkOverlap`, with a 0.6 s per-peer `p.bonkCd` floor) I
  get shoved AWAY laterally: `player.targetX ± 54` (clamped to road) + a tilt
  kick + "BONK!" floater + sparkle burst + low thunk (`playTone(150,…)`) +
  `Haptic.medium`. NO damage, NO invincibility. Symmetric: the peer self-detects
  the same overlap and bounces themselves — no coordination, nothing broadcast.
- **SLIPSTREAM draft** (`mpDraftMult`): FRIEND rooms only. When a peer ghost is
  AHEAD (`120 < rel < 420`) and `|peer.x − player.x| < 34` for 1 s continuous →
  DRAFTING → `gameSpeed × 1.08` (applied via ONE guarded line in
  `05-driving-loop.js` beside the other gameSpeed multipliers). Drops after 0.7 s
  out of the window. Wind-line particles stream past my car; a "💨 SLIPSTREAM"
  HUD chip shows; whoosh tone + `Haptic.light` on activation. Stacks with convoy.
- **TAG mode** (`mpTag*`): FRIEND rooms, 2+ riders. A "🏷 TAG" button in the
  connected panel (own row above the race/switch button) starts a 90 s game.
  Self-declaration over three piggyback fields:
  - `d.it = [n, gid]` — broadcast every packet by whoever is IT; `n` increments
    on every tag. `gid` is a game id (`mpTagNewId`: time · hashed id · random).
  - `d.tgo = gid` — the STARTER announces the game for ~4 s (like `d.pb`), so
    late joiners learn it even if they missed the first `d.it`.
  - `d.tgr = [gid, secs]` — each client shouts its total it-time for ~4 s at
    timeout; everyone renders a results card (least it-time wins, missing
    reporters show "?"). Winner tone; state clears ~8 s after results.
  PASSING: if I'm NOT it and the IT ghost overlaps me (slightly bigger box,
  `54×70`) → `mpTagBecomeIt` bumps `n`, I broadcast `d.it=[n+1,gid]`
  (`mpForceSends`), big "YOU'RE IT! 🏷" banner + `Haptic.heavy` + tone; the old IT
  drops the marker on receiving `n+1`. A 1.2 s `tagGuardUntil` (reset on every
  marker change) blocks instant tag-backs / machine-gunning while overlapping.
  Conflict SELF-HEAL (deterministic everywhere): higher `n` wins; equal `n` →
  higher peer id wins. VISUALS: the IT ghost/car wears a pulsing red halo + "· IT"
  on the nametag; HUD chip reads "🏷 TAG — you're IT! Ns" or "avoid <name>! Ns".
  Each client accumulates its own it-time locally (`myItTime`). BONK still fires
  during a pass (bounce + tag together). Room switch / disconnect clears all tag
  state (like races). Duration is `mpTag.dur` (default `MP_TAG_DUR = 90`), a live
  field so tests can shrink it without a code change.
- **EMOTE WHEEL** (`mpEmote*`, all rooms incl. lobby): LONG-PRESS the honk button
  (hold ≥350 ms; a quick tap still honks — decided at touchend, see below) opens a
  radial fan of 6 curated emotes (😂 ❤️ 😱 🏁 🐢 🔥) around the LIVE (movable)
  `HONK_RECT`, clamped on-screen. Tap one → `mpSendEmote` broadcasts
  `d.em = [nonce, idx]` (~2 s, `mpForceSends`) + a big emoji burst over MY car;
  peers de-dupe per nonce and burst it over my ghost (`p.emT`/`p.emEmoji`, reuses
  `mpDrawEmojiBurst`). Slot selection picks the NEAREST slot (not first-match) so
  adjacent discs never mis-fire. Tap elsewhere / 3 s timeout → close. While open,
  `mpEmoteUpdate` (runs BEFORE `updatePlaying`) peeks + consumes `clickQueue` and
  kills any drag-steer so taps can't leak into steering/honk/weapons.

- **`d` piggyback fields (wave 2):** `em:[nonce,idx]` emote · `it:[n,gid]` tag
  marker · `tgo:gid` tag announce · `tgr:[gid,secs]` tag results. Max payload
  with every field maximally active ≈ 213 bytes (well under the 2 KB cap).

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
- Wave-2 hooks (all guarded, added minimally):
  - `05-driving-loop.js`: `if (typeof mpDraftMult === "function") gameSpeed *=
    mpDraftMult();` (beside the other gameSpeed multipliers) for SLIPSTREAM; and
    `mpDrawHudOverlay()` right after `drawHUD()` (screen-space, driving only) for
    the emote wheel + my emote burst + slipstream wind-lines + my TAG halo/banner.
  - `01-engine-core.js` (the one permitted input hook): the honk button no longer
    queues a honk at touchstart. It stashes `honkTouchId` + `honkDownAt`
    (mirroring `boostTouchId`); `releaseTouchId` decides on touchend — held
    <350 ms → `honkQueued` (unchanged honk), else → `emoteWheelOpen` (when
    `MP_URL` is set). Keyboard honk (`h`) is untouched.
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
