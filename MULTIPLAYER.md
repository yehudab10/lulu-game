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

## 3D PARTY — 🌍 Free Roam + party games (features/openworld)
Rides the 3D party's netcode (`3d/js/features/party/net.js`: relay protocol v1, everything inside the
verbatim-relayed `d` packet). **No server change.** What it adds on the wire:
- **Free Roam on her own run (ci/friends, 2026-11-27):** no party run any more — each friend keeps her own ▶ PLAY
  run (her hearts, coins, car, the day's list); joining is a teleport to the friend, leaving keeps her where she is.
  Nothing new on the wire except one broadcast: `"lcl"` [key, kind, paint, x×10, z×10, h×1000] — a car she flagged
  down on her own traffic, so a friend nearby gets the same car parked there (flag & grab). Old clients in the same
  group still work: they publish the same pose / extras; an old client hosting Free Roam still starts a party run on
  its own screen. The highway traffic is each screen's own (a friend's car is a lead for it); the towns' loop traffic
  and the sky stay on the shared party clock.
- **Broadcasts** (`d.bc`, party/net.js): each rides in my snapshots for 1.5 s from the FIRST packet it goes out in
  (not from when it was made: a long frame on a slow phone let a one-off expire unsent); an oversize packet (> 1.9 KB)
  drops the extras before the broadcasts.
- `d.x = { z, ex }` — my extras (the party's existing `N.extra` slot): `z` = the zone I'm in (`""` the
  highway, else a town id like `"lakewood"`), `ex` = that town's highway exit s (for warps / late joins). ~25 bytes.
- `d.p` (pose) in a town is published in a **flat frame**: `s = world z + 20000`, `d = −world x`, heading
  frame 0 (receivers interpolate it 2-D: no lateral clamp, no corner snaps). Changing zone bumps the pose's
  respawn counter (`d.p[7]`), so friends restart my track behind a poof instead of interpolating across frames.
- **A shove reads as a slide** (`party/remote.js`): a stretch between two snapshots that moves far more than the reported
  speeds allow (a pratfall, a bump) steps the track and the error offset glides it out at ≤ 40 m/s; only a respawn or a
  warp (> 60 m along / 30 m across) snaps behind a poof. **The host doesn't flip on a stall** (`party/net.js`): a
  takeover needs 4 s of silence and 20 of the taker's own frames. (Reliable events are NOT re-sent on a host change:
  they're de-duplicated only by nonce, so a re-sent chase / finish / claim would replay the game.)
- `H.A.g` — the live party game (host state, replicated in every host snapshot like the rest of `A`): `{k, n, ph,
  t0, at, ps, …}` + the game's fields (pin / drop / cop / out / it / itN / held / fuse / spots / got / fin). ≤ ~700 bytes.
- reliable client → host events (`ev`, acked): `owg` [k, req] start a game · `owf` [n, t] reached the pin ·
  `owb` [n, uid] the cop's bust · `owd` [n] stash delivered · `owk` [n, itN, uid] the kugel passed · `owp` [n, i] a snap.
- town coins reuse the party's shared-pickup broadcast `"k"` with keys `"c-1:<i>"` (chunk −1 = the town's chunk).
Bandwidth: unchanged rate (the party's ≤ 7 snapshots/s); events are a few per game.

## 3D PARTY — the shared world (roadside events, cameos, places, side jobs, the orgs)
**Nothing new on the wire. No server change.** Everything friends must agree on is a pure function of
what every screen already has — the activity seed (`H.A.seed`), the party seed (`worldSeed`, from the
code) and the party clock — so there is nothing to send:
- **The road plan** (`3d/js/features/party/plan.js`, `ctx.party.road`): every 200 m chunk k of a party's
  highway gets at most ONE big thing, picked by `mulberry32(hash("slot:" + k) ^ A.seed)` from the kinds
  the features registered (`road.claim(id, {kind: weight(A)})`, at boot, in import order — the same on
  every client). roadevents (🍦 ice-cream stand · 🍔 drive-thru · ⛽ gas station + nitro cans), cameos
  (💜 Avigail on foot · 💇 Chez Fabio · 🛟 Heshy's pool · uncles · the sasquatch), hustle (☎️ payphone ·
  📋 job board). The spot on the verge comes from `ctx.party.seeded(key, fn)` (Math.random seeded) over the
  same chunk colliders. Small hazards (cones, puddles, potholes, animals, strollers, hitchhikers) hash their
  own sub-slots (`ctx.party.rng("re:" + k)`). Every screen builds its OWN copy as its car gets near (set
  pieces ~950 m out, before their chunks are built, so the roadside reservations agree). Race / Dash / Tag
  get only the fair hazards. Things that drive or must stop the traffic stay out (party traffic can't react).
- **Pull-in places** (Gas 'n' Go, the Lookout, family driveways) are fixed constants — on in a party
  (a Road Trip ends at Bubbe's, so no driveways from there).
- **A Free Roam town's orgs**: the Chaverim / Shomrim / Hatzalah cruisers ride openworld's seeded block
  loops (a phase gap the minivans leave free, the vans' speed): pose = f(party seed, loop, party clock).
  Roadside scenes run in 50 s windows of the party clock: kind, anchor landmark, kerb (seeded
  `curbSpot({still: true})`, parked cars only) and the call-in time are all seeded. The Bais Yaakov line
  walks on the party clock.
- **Personal, never sent**: what a player does with any of it — a porch / salon / world visit / help
  scene (a local state; the world doesn't pause for anyone: friends keep driving, the party traffic keeps
  following the clock), rewards (coins, the 💜 meter, stats), side jobs + their riders / props, my phone,
  memory (grudges, notoriety, texts), Lulu's lines, the scrapbook + quests. A car only I should see (my cab
  fare's "follow that car", the volunteers coming for MY flat) carries `data.partyLocal` so the party's
  traffic sync keeps it; party cars are immune to it.
- **Two friends, one event**: each has their own copy (nothing in it is one-of-a-kind for the party), so no
  host arbitration is needed. A friend in a scene shows over their parked car through `ctx.party.presence`
  (the presence work), if it's there.
- **A party run is banked** like any run: `endRun("party")` once (results, back to the lobby, leaving,
  the next game) → run:end → lifetime score / miles / runs, run quests, badges.

## 3D PARTY — presence + everything you can do alone (features/party/presence.js)
Still protocol v1, still inside the verbatim-relayed `d` packet. **No server change.** `d.x` is now the
activity extra (openworld's `{z, ex, rd}`) merged with per-feature keys (`ctx.party.setX(k, v)`), all optional:
- `pr: [mode, icon, label]` — what I'm doing (presence): `drive` 🚗 · `chase` 🚨 on the run ★★ · `foot` 🚶‍♀️ ·
  `in` 🍺 in The Thirsty Scholar · `law` 🚨 · `jail` 🚔 · `court` ⚖️ · `er` 🏥 · `scene` 🎬 · `lobby` / `done` / `watch`.
  Any feature can set it (`ctx.party.presence({mode, icon, label})`); otherwise it follows my state. ≤ ~50 bytes.
- `m = 7` (new mode): away in a personal scene (inside, jail, court, a cutscene) — no pose (`d.p` absent), friends
  hide my car/walker and show the presence instead.
- On foot `m` stays 3 and `d.p` is MY pose (position, walking velocity, facing, hop height) in the usual frame;
  `f: [anim, look]` marks the walker: anim 0 walk · 1 roll · 2 slide · 3 vault · 4 knocked · 5 busk · 6 wave ·
  7 busy · 8 sit · 9 talk; look 0 · 1 jumpsuit · 2 old lady · 3 old man.
- `pc: [x×10, z×10, h×1000, key|0, paint|0, wrecked]` — the car I left while walking (world coords: the highway
  is built from one fixed seed and a town sits at the same exit for everyone, so x/z mean the same on every screen).
- `v: [modelKey, paint|0]` — I'm driving a borrowed / jacked ride: friends draw that model instead of my convertible.
- `cp: [x×10, z×10, h×1000, …]` — up to 3 lit cruisers chasing / pulling me over (my own, personal cops):
  friends draw puppet cruisers (law's light bar + a located siren, ≤ 2 sirens), ~200 ms in the past.
- `ws: n` — my wanted stars (nametag `🚨★★`). `at: [x×10, z×10]` — where I went inside (the tag over the door).
- `jk: [key, …]` (last 6) + ephemeral broadcast `"j"` key — shared traffic cars I carjacked: gone for everyone,
  never re-added (late joiners learn it from `jk`).
Rates: the extras refresh ≤ 10×/s and ride the normal ≤ 7 snapshots/s. Worst case (walking, parked car,
3 cruisers, stars, a jacked list) ≈ 200 bytes on top of the pose; a snapshot over 1.9 KB drops the bulky
extras first and keeps `pr`.
Collisions stay self-detected (nothing on the wire): a walker's own screen knocks her flat when a friend's car
hits her (no hearts in a party); the driver's screen checks up and says sorry; two walkers each step half aside.

## 3D PARTY — claimed cars, the fleet, street mayhem, rest areas (features/party + streets / rides / exits)
Still protocol v1, still inside the verbatim-relayed `d` packet. **No server change.** On the wire:
- broadcast `"cl"` `[key, T0, L×10, dS×10, hail]` — I CLAIMED shared car `key` (I stepped out in front of it, flagged
  it down, rammed it, pulled it over): from party time `T0` (ms) it brakes evenly to a stop `L` m on, easing to
  `d = dS` (its shoulder; a town loop car: `dS` m toward the kerb). Every screen computes the same pose from that
  + the clock (`traffic.js claimPose` / `towntraffic.js poseAt`) — nothing else is sent while it stops and parks.
  First claim wins (earlier `T0`, then the smaller uid). `hail` = I flagged it down (🚕 HOP IN on my screen).
- `d.x.cl: [key, T0, L×10, dS×10, hail, …]` — my last 4 claims (late joiners / a lost broadcast). ≤ ~120 bytes.
- `"j"` + `d.x.jk` (unchanged) also end a claim: I drove off in it → gone for everyone (no poof: friends see my
  car — that model, `d.x.v` — right where it was parked).
- Keys: the conveyor's `"<lane>:<slot>"`, a 🌍 Free Roam town's loop cars `"tw:<town>:<loop>:<n>"` (now carrying
  the town: the same loop number in two towns is two different cars).
Nothing else is new on the wire — the rest is seeded from what every screen already has:
- **the fleet** (taxi / ambulance / ice-cream truck / bus, streets' coupe) rides the shared conveyor: a slot's
  kind is a pure hash of (activity seed, lane, slot) over the kinds registered at boot (`addTrafficKind`);
- **street props** per chunk from `ctx.party.rng("streets:props:" + k)`; **🎨 Paint & Pray** booths from the
  road plan (`road.claim("streets", {paint})`); **rest areas** at seeded spots (a Road Trip: one; Free Roam:
  after ~every other interchange, `h01("exits:rest", E)`), and the road plan keeps clear of them;
- personal, never sent: smashing props (a friend's car smashes them cosmetically on MY screen), roadblocks
  (`partyLocal` cruisers on the shoulders), Shmuel's calls + his target car, the rest-area visit (presence
  `["rest", "⛽", "at the <name>"]`), ride jobs, hotwiring foot's parked cars.
Worst-case extras with claims ≈ 320 bytes on top of the pose — the 1.9 KB snapshot cap is untouched (over it,
the bulky extras drop first as before).

## 3D — EVERYONE IN ONE WORLD (features/multiplayer, ci/everyone)
Still protocol v1, still the verbatim-relayed `d`. **No server change.**
- The 3D game joins EVERYONE by itself whenever she's out in the open world (⚙️ Play online — the shared save's
  `mpAutoOff` — turns it off; Dina's mode and any 🎉 party are offline from it). EVERYONE is **sharded on the client**:
  the relay closes a 25th member with 4001, so the client moves on to room `lobby2` … `lobby8` (the 2D game stays in
  `lobby`, so cross-play is in the first shard). Rooms stay ≤ 24 — the relay's cap is untouched.
- New piggyback field `w` (3D senders only; 2D ignores it): `w: [zone, a, b, h]` — zone `""` the highway (a = s metres,
  b = lateral d metres, h = yaw relative to the road), a town id like `"lakewood"` (a, b = metres from that town's origin,
  h = yaw), `"~"` hidden (indoors, a scene, a menu: receivers draw nothing). ~30 bytes. While in a town the 2D fields
  say "parked by the town's exit" (`di` = the exit, `x` = 470, `sp` = 0); while hidden the state goes out at 1 Hz.
- **Receivers never trust a stranger:** names shown in EVERYONE are generated (`<skin colour> <hash(id) % 90 + 10>`),
  never the joined `name`; `race`/`tag`/`pk` fields are ignored outside a code room; emotes ≥ 1.5 s, honk/wave events
  ≥ 0.8 s, record toasts ≥ 90 s apart per sender (dropped on the receiving side); `sk`/`co`/`vk`/numbers are validated.
- What leaves the device: the curated name (from the 12), the car skin, the game-world position / speed, emote / honk
  indices. No location, contacts, device or account data, no free text.

## 3D — FRIENDS: a lasting list, presence, one-tap join (features/friends, ci/friends)

No server change — the relay's protocol v1 in rooms the client names:
- **New piggyback field `fr`** (3D only; 2D ignores it) in the EVERYONE state, and `x.fr` in a party snapshot: ≤ 3 entries
  `{ to: peer id, pk: ECDH P-256 public key (base64url), f: the sender's public player id (`ctx.player.id()`, 16 base32 chars — never the player secret), c?: AES-GCM sealed card }` — the
  "be friends?" handshake (both say yes). A card = `{ f, n (curated name), sk, b (doorbell) }`, readable only by the two.
  A party snapshot also carries `x.fid` (the random friend id) so members can see who's already on their list.
- **Doorbell rooms `B` + 11 chars** (a random secret only friends know): the owner sits there with state `{ o: 1 }`; a friend
  joins for a moment with `{ k: { f, c } }` (sealed "where / join"); she answers with `{ o: 1, r: [{ to, c }] }` (sealed per
  friend). Strangers can't find the room; anyone who does (a leaked name) gets no answer without the friendship's secret.
  The sealed knock and its answer also carry `m` — the sender's relay connection id in the EVERYONE room (when she's in
  it), so a friend's screen labels that ghost 👯 + her name; strangers see the random colour + number as ever. Coming
  online re-knocks (≤ 1 a minute). Tapping a name tag over a car opens 📍 Nearby's page for that driver (➕).
- **Friend-code rooms `F` + 6 chars**: open only while the owner's ➕ Add by code screen is up (state `{ fc: 1 }`); the
  handshake runs in that room's state.
- Nothing personal: random ids, the curated name, the car skin, a few words of where in the game world ("in Midwood ·
  driving"), only to friends, sealed. Relay load: one idle socket per online player with friends + short knocks.

## 3D — ACCOUNTS, USERNAMES, FRIENDS THAT WAIT (features/accounts + features/friends/server.js, ci/accounts)

Owner-approved server change (2026-11-26). The relay gains `/acct/*` HTTP endpoints on the global Board object
(`server/accounts.mjs`; table + endpoint list in `server/README.md`). **Nothing in the room protocol changed**; two new
OPTIONAL state fields ride in existing messages, and every old client ignores them:

- `d.hc` / `d.ot` (Shared Road state, 3D only; stage 3 "no ghosts", `ci/friends`): her **look**, so everyone draws her solid
  the way friends do — `hc` her hair colour (`#rrggbb`), `ot` her outfit's compact form (`ctx.clothes.encode`: piece ids
  and commas only, ≤ 160 chars; checked on receipt). Sent only when set; 2D and older 3D clients ignore them (a 3D
  receiver without them draws a top in her car's colour).
- `d.hs` (Shared Road state) / `hs` (party snapshot, beside `hc`): her **salon hairdo** (`bouncy` / `avigail`; the
  default sheitel is never sent; lowercase letters only, checked on receipt). Receivers show the style's hair piece on
  her car and its walking model on foot (`party/remote.js` › `personKey` / `carHairKey`, loaded the first time it's
  needed; the default until then). Old clients ignore it and draw the sheitel.
- `d.f` (Shared Road state, on foot): her **foot code**, the same one friends get as `x.f` — `[anim 0..10, look 0..3,
  height dm 0..40]` (anim: 1 roll · 2 slide · 3 vault · 4 knocked flat · 5 dance · 6 wave · 7 busy · 8 sit · 9 talk ·
  10 in the air; look: 1 the jumpsuit · 2 old lady · 3 old man). Sent only when not all zero; clamped on receipt;
  played by `party/remote.js` › `poseWalker` for friends and everyone alike.
- `d.un` (Shared Road state) / `x.un` (party snapshot extras): a **name ticket** — `PID.EXP.MAC`, ≤ 60 chars, signed by
  the server for THIS relay room + connection id. A receiver never shows text it was sent: it asks `POST /acct/names`
  `{ q: [[ROOM, rid, ticket]] }` and shows the server's answer (null for a forged, copied or expired ticket → the usual
  colour + number). ⚙️ "Other players' names: Off" shows colour + number for everyone but friends. Party members' names
  are always shown (people you chose to play with).
- The curated `mpName` and the `j` (join) name are untouched — the Classic 2D game and the board still use them.

**Friends on the server:** requests by username (`/acct/ask`) wait for an offline player and show as a badge on 👯
(no pop-up); accept / decline (silent) / cancel / remove / block / "who can send me requests" (everyone · friends of
friends · nobody) are server calls. A friendship made on the server gets its doorbell through a SEALED card on the
friendship (AES-GCM under ECDH(my long-term key, their public key) — the server holds only the sealed note). On-device
friendships from before are "claimed" by each side's hello and become server friendships once both have updated.
Presence / ▶ JOIN still go through the private doorbell rooms (nothing about where anyone is goes to the server).

## 3D — ONE SHARED WORLD, the wire (ci/oneserver, steps 1 + 2; plan: 3d/docs/oneserver-plan.md)

All additive (`server/world.mjs`, used by both relays). Old clients ignore every new field and never send `r`.

| | message | what's new |
|---|---|---|
| step 1 | server → `h` | `st` (server ms); `r`: the room's reliable events of the last 20 s (a late joiner) |
| step 1 | client → `pi` | optional `n` (≤ 12 chars) — echoed in the pong |
| step 1 | server → `po` | `st`, `n` |
| step 2 | server → `s` | `st` = when the relay got that state (on the envelope, not inside `d`) |
| step 2 | client → `r` `{ id, k, d }` | a reliable one-time event: id `[A-Za-z0-9]{1,16}`, k `[a-z0-9_]{1,12}`, d an object or null, ≤ 512 bytes, ≤ 4 a second per player |
| step 2 | server → `r` `{ from, id, k, d, st }` | passed on ONCE to everyone else in the room; receivers drop duplicates by from + id |
| step 2 | server → `ra` `{ id, st }` | the ack to the sender (resend the same id after 2 s if missing) |
| | `GET /world/config` | `{ world: { clock, reliable, place, claims }, st }` — the kill switches + the clock, answered by the Worker (no Durable Object) |
| | `GET /world/usage` (`?text=1`) | today's free-plan estimate; **503 `{ resting: 1, resetAt }`** when the Durable Objects are over the free daily allowance |

Client: `features/multiplayer/worldclock.js` → `ctx.worldClock` (`now()`, `synced`, `offset`, `rtt`, `flags`, `resting`);
`ctx.mp.event(k, d)` → `mp:event` `{ from, peer, k, d, st, late }` on the others. The party's own room gets the same
`st` / `r` support from the relay (the party client adopts it in `ci/friends`).

### What the game does with the world clock (client half, `ci/friends`)

Only while she's really online — connected, the clock measured, the relay's `clock` switch on (`ctx.mp.worldSky.on()`);
offline, or on an old relay, everything below falls back to how it was.

- **One sky:** a Cruise outside a group takes its time of day + weather from `ctx.worldClock` and one world seed
  (`ctx.mp.worldSky.clock()` / `.weather()`, `features/atmos`) — every player on the road sees the same hour and the same
  rain. Her own saved day waits and comes back when she's offline. A group keeps the party's sky.
- **Drawn ~150 ms in the past:** every state with the relay's `st` goes into a short track per player (`net.js` ›
  `trackAt`); she's drawn between her two real updates at `worldClock.now() − 150`, extrapolated ≤ 0.3 s past the newest.
  Without `st` (an old relay, a hello snapshot) the old chase-the-estimate smoothing is used.
- **Reliable one-time events:** an emote also goes out as `r` `em` `{ n, i }` (the state's `d.em` stays for old clients,
  same nonce → shown once; a late replay isn't shown). A claimed / taken town loop minivan is `r` `tcl` `{ a: [key, T0,
  L×10, dS×10, hail] }` / `tj` `{ a: [key] }`.
- **The world's town loops:** online, no group, in a town → openworld's seeded right-turn block loops run on the world
  clock with one world seed (`ctx.openworld.worldTowns()`), the same minivans in the same places on every screen; each
  screen keeps its own extra town drivers. She can stop / flag / ram / jack one exactly like in a group (party's claim
  code, `worldClaims()`), and everyone in the place sees it pull over.

### Step 3 — rooms by place (built on `ci/oneserver-place`; switched on only with `place: 1` in /world/config, after the owner moves to the Paid plan)

| | what |
|---|---|
| room names | `WL0` … `WL7` (the 16 km lap in 2 km stretches), `WT` + a town id (`WTMIDWOOD`); a full room splits `…X2`, `…X3` (≤ 6) |
| cap | place rooms hold **40** players; old-style rooms keep 24 |
| client → `j` | `lo: 1` = a LISTENER: hears everything, isn't announced (`+` / `-`) or listed in hellos, doesn't count toward the cap (≤ 40 listeners); its `s` / `e` / `r` are dropped |
| state | `d.sid` = a random session tag (8 chars, per page load): the same player across rooms (receivers key her `S:` + sid); `d.pl: 1` on the every-2-s copy in the old `lobby` (the bridge) — new copies ignore it there |
| the game | `features/multiplayer/place.js` (room naming, the listener + bridge sockets), `net.js` (place mode: peers keyed by room / sid, prune on hello, splits on 4001, the kill switch back to `lobby`); `ctx.mp.room` stays `"lobby"` for the rest of the game, `ctx.mp.placeRoom` names the place room |
| budget | ≈ +10 % for the lobby bridge (1 message / 2 s) while old copies exist + ≈ +15 % for new connections at highway speed (one per room change, ~3 per 2 km); listening itself is free |
