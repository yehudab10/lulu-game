# One shared world — the server plan (`ci/oneserver`, roadmap 41)

The owner (2026-11-27): *"I want friends and everyone to be as if they are in the same world — same as Roblox and
Fortnite. One server as powerful as we can make it."* This is a **plan only**. Nothing is built or deployed until the
owner says OK. `ci/friends` owns the client side: how players are drawn, the rules, joining. This branch owns the wire
and the server.

## In one minute (for the owner)

- **What "as powerful as we can make it" means here.** Fortnite and Roblox run the game itself on their own servers.
  We can't afford that, and the game wasn't built for it. What we *can* do with the relay we have (Cloudflare, already
  live) is make every phone **agree on the same world**:
  - the same clock, so everyone sees the same traffic, townspeople, events and weather;
  - you always see the players who are near you;
  - movement is smooth and nothing that happens gets lost on the way;
  - a few shared things the world remembers.
  Each phone still runs its own copy of the game, kept in step by the server. That is how most web games work.
- **Five steps, smallest first.** Each one can be switched off on its own, and old copies of the game keep working.
- **Money: your Cloudflare plan matters before step 2.**
  - On the **Free plan**, online play stops for everyone for the rest of the day once the daily allowance is used up.
    That is about **110 player-hours a day** of driving around online. It resets at midnight UTC.
  - The **Paid plan** is **$5 a month**. It includes about 1,100 player-hours a month. Above that it costs roughly
    **$0.15 per 1,000 player-hours**, plus a little for server time (numbers in §3).
  - You can see which plan you're on in Cloudflare → Workers & Pages → Plans. Please check it before step 2.
- **What I would NOT do:** run the game on the server, put everyone in one giant room, send updates 30–60 times a
  second, keep everyone's position on the server, or carry voice through this relay (§5).

---

## 1. Today

**Rooms.** The relay is one Cloudflare Worker with Durable Objects. Each **room** is one Durable Object, holding a
WebSocket per player. A room passes every message on to everyone else in it, and that's all it does.

| | today |
|---|---|
| players per room | **24** (a 25th is refused with close code 4001) |
| "everyone" (EVERYONE room) | rooms `lobby`, `lobby2` … `lobby8`, filled in the order players arrive — **not by where they are**. About 190 players max, then nobody else is seen |
| who sees whom | everyone in your shard, wherever they are (the game hides those far away), but **never** a player in another shard, even one standing beside you |
| updates per player | 5 a second while out in the world, 1 a second when hidden; the relay caps it at 8 a second |
| message size | ≤ 2 KB (a typical update is ~150–300 bytes) |
| party (friends) | its own room, ≤ 8 players, 4 updates a second (7 in games or indoors); a shared clock + seed run by the HOST'S game, so a party's traffic matches. **Outside a party every screen's traffic is its own** |
| one-time things (emotes, honks, a race start) | carried inside the regular update for a short while (e.g. an emote for 2 s); if that update doesn't go out in time, it's lost |
| stored on the server | the board + scores, the property registry, accounts / friends (`accounts.mjs`), the limited clothing stock (`wear.mjs`) — all on the one global Board object. **Nothing about positions or rooms is stored** |
| measured round trip (this cloud box → the relay, 40 pings) | min 17.9 · median 19.8 · p90 21.5 ms. A phone on Wi-Fi / 4G is typically 30–150 ms |

**What a room costs**, at Cloudflare's current prices (pages read 2026-11-27):
- Each message *into* a Durable Object counts as 1/20 of a request. Messages *out* are free.
- A player driving for an hour sends 18,000 updates, which counts as **900 requests**.
- Free plan: 100,000 Durable Object requests a day, which is about **110 player-hours a day**. After that, further
  messages fail until 00:00 UTC.
- Paid plan: $5 a month includes 1 million requests (≈ 1,100 player-hours). After that it's $0.15 per million
  (≈ 1,100 more player-hours).
- Server time (GB-s) is charged only while a room is actually running code; with Hibernation, idle rooms cost nothing.
  - A full room of 24 runs roughly 10–25 % of the time, about 1,000–2,700 GB-s a day (an estimate, to be measured).
  - Free: 13,000 GB-s a day. Paid: 400,000 GB-s a month, then $12.50 per million.

## 2. The gap, and the smallest server change for each (by value)

### a. ONE CLOCK — the same traffic, people, events and weather on every screen  ✅ biggest win per byte

**Confirmed:** this is the biggest "same world" win for the least server work, *provided the client side is ready*.
The party already gives the same traffic from a shared seed + clock. Making that the default for everyone is client
work (`ci/friends` / the traffic owners). The server only has to say what time it is.

- **Server (tiny, additive):** the relay's `h` (hello) and `po` (pong) gain `st` = the server's milliseconds. Old
  clients ignore the extra field. ~10 lines.
- **Client:** the party's existing sync code (5–10 pings, keep the fastest, slew gently) pointed at the server instead
  of the host. **World time** = server time. **World seed** = the date (or a server-announced number).
- **How accurate:** about half the round trip, minus jitter.
  - From here: ±10 ms. On a phone: typically ±20–50 ms.
  - At highway speed a car moves 1–1.5 m in 50 ms, which smoothing hides.
  - A phone's own clock is usually within 0.1 s, but can be off by seconds if it was set by hand. The server clock
    fixes that.
- **What it doesn't fix on its own.**
  - Each phone still simulates its own copy of the traffic. When a player hits a car, only her copy changes.
  - The party's answer (shared cars can't be pushed around, plus "claim a car" — §d) has to come along too.
  - Traffic that never touches a player stays identical forever.

### b. WHO YOU SEE — rooms by PLACE instead of by arrival order

**Client-only to start.** Room names are already chosen by the game. The relay doesn't care what they're called.

- **Place rooms.**
  - The lap in ~500 m segments: `W` + segment number, ~32 rooms.
  - One room per town (`WMID`, `WLAK`), JFK, and each rest area.
  - Indoors: the building's own room, as `together` does today.
  - Two players in the same spot are always in the same room.
- **No blink at a boundary.** Within ~150 m of the next segment, the game also opens a **listen-only** socket there:
  it sends nothing, so it costs nothing (messages out are free). It switches over as she crosses, with no gap.
- **Server (small, additive):**
  - `j` with `lo: 1` = a listener. It isn't announced, isn't counted toward the room's limit of 24, and its updates
    are ignored. An old relay would just treat it as a normal player, which is harmless.
  - Place rooms get a higher cap, **40**.
- **In a crowd** (a town on a busy night):
  - Above 40, the room splits into `WMID`, `WMIDb`… (as `lobby2` does today).
  - The game draws the nearest 6–8 players, friends first (`ci/friends` already does this).
  - Friends always share a room (the group joins the first friend's shard).
- **Old copies of the game still see you.** Old copies only know `lobby`. New copies also send a 1-per-second update
  to `lobby` (≈ 1/5 the cost) and listen to it, so old and new players see each other during the rollout. The Classic
  2D game keeps `lobby` for good.

### c. SMOOTHNESS + nothing gets lost

- **Smooth movement.**
  - Today's 5 updates a second is fine for a browser game; Fortnite uses ~20–30, but its servers run the game.
  - The client already eases between updates and predicts from speed.
  - **Server (tiny):** stamp every passed-on update with the server time (`st`). With the world clock (a), the game
    can then play each player ~150 ms in the past: smooth, with no jitter from the network.
- **Nothing gets lost** ("one-time messages could expire before being sent").
  - **Server (small, additive):** a new message `r` = `{ id, k, d }` (≤ 512 B, ≤ 4 a second per player). The room
    passes it on once and keeps the last ~32 for 20 s, so a player who arrives late or reconnects still gets them in
    her hello.
  - Players de-duplicate by `id`. No acks are needed: the server holds them, not the sender.
  - Emotes, honks, a race start, a ping and "the wedding started" move there.

### d. A world that remembers (a little)

Worth server memory: things another player should still see after the person who caused them has moved on.

| thing | keep on the server? | how |
|---|---|---|
| 📍 a ping / a "meet here" | yes, ~2 min | a reliable event (c) the room keeps until it expires |
| a wedding / a parade / a bank job in progress | yes, while it runs | a reliable "started at world time T" event, so late arrivals join mid-way (works because of a) |
| a parked car while its owner is ONLINE | no | it's already in her update (`ci/cars`) |
| a parked car while its owner is OFFLINE | later, maybe | a row per player in the place room's own small table (rooms can already keep tables), max 1 car per player, cleared after 1 day. Only if `ci/cars` wants it |
| knocked-over cones, a broken window, puddles | **no** | cosmetic and local; the world clock already makes everyone's town the same again |
| **who owns a shared object** (a mission car, the cop in cop tag, a bank bag) | yes, while held | `claim` / `release` messages: the room's server says yes to the first claim and no to the rest, and frees it after 10 s of silence or when the holder disconnects. This replaces "the host decides" in a party with a referee that can't go away |

### e. Scale, cheaters, privacy

**At 50 / 500 / 5,000 players online:**
- Place rooms keep each room at ≤ 40, so the work per room stays the same however many people are online. More
  players just means more rooms.
- One room handles ~40 × 5 = 200 messages a second. A single room tops out at about 1,000 messages a second.
- The one global Board object (accounts, names, homes, clothes) gets roughly one call per player every few minutes:
  ~20 a second at 5,000 players, which is fine. If it ever got close to the limit, the name lookups would move to
  their own object.

**Cheaters and junk.** Already enforced:
- 2 KB per message, 8 updates a second, unknown message types dropped;
- every field is checked on the receiving side;
- names only through server tickets;
- strangers can't start anything on your screen.

To add (small):
- at most 6 open sockets per address;
- the reliable-event limits above;
- a junk-message counter that disconnects a client after 20 bad messages.

**Privacy.** A stranger's game learns only:
- a random connection id;
- where you are *in the game world*;
- your car and outfit;
- your emotes;
- your username (unless they or you turned names off).

It never learns your address (the relay hides it), your location, your contacts or anything about your device.
Positions are not stored.

## 3. Cost by step and scale (Paid plan; Free shown where it still fits)

"Player-hours" = time spent online out in the world. Each line is an estimate built from the prices above.

| | ~50 online at peak (≈ 3,000 player-h/month) | ~500 at peak (≈ 30,000 player-h/month) | ~5,000 at peak (≈ 300,000 player-h/month) |
|---|---|---|---|
| today's design | Free: **runs out on busy days** · Paid: **$5** | Paid: ≈ $5 + $4 requests + ~$3 time ≈ **$12** | ≈ $5 + $40 + ~$30 ≈ **$75** |
| + a. clock | +0 (a ping every few seconds is ~1 % more messages) | +0 | +0 |
| + b. place rooms (+ 1/s to `lobby` while old copies exist) | +~20 % for the rollout months, then −10 % (smaller rooms do less work) | same | same |
| + c. reliable events + server timestamps | +~2 % | +~2 % | +~2 % |
| + d. claims / room memory | rows written: well inside the 50 million a month included | same | same |

**Nothing here needs more than the $5 Paid plan.** The owner's only action: switch to Paid before step 2 if the
account is still on Free, and set a spending alert (Cloudflare → Billing → notifications) at, say, $20.

## 4. Compatibility, rollout, kill switches

- **Every step is additive.**
  - New fields in existing messages: `st`. New message types: `r`, `claim`. A new join flag: `lo`. New room names.
  - Old copies of the game send and get exactly what they do today. The iPhone app can lag weeks behind and keeps
    working.
  - `lobby` stays for old copies and for Classic 2D.
- **One step per deploy**, in the order of §5. Each deploy comes with:
  - the "about to deploy" / "deployed" messages;
  - `server/prodcheck.mjs` extended with that step (old joins, a party join, the new thing with throw-away clients);
  - the Rollback path (Cloudflare → Workers & Pages → lulu-shared-road → Deployments → Rollback).
- **Kill switches.** `GET /world/config` → `{ clock, place, reliable, claims }`, flags read from the Board. The game
  checks it at start and every 10 min, and only uses a step whose flag is on. Off = the game falls back to today's
  behaviour. A flag changes with a one-line deploy, no new game version.
- **Tests.** Server unit tests next to `test-relay.js`. A two-page 3D test for each step against the local relay,
  owned with `ci/friends`:
  - same traffic on both pages;
  - two players at one place see each other across a segment boundary;
  - a late joiner gets the ping;
  - two claims → one winner.

## 5. Recommended order, and what I would NOT do

1. **Clock** (server: ~10 lines; client: the party's sync, world-wide) → then `ci/friends` / traffic make the shared
   seed the default. *Biggest visible win.*
2. **Reliable events + server timestamps** (fixes "expired before it was sent", smoother players).
3. **Place rooms + listen-only + the `lobby` bridge.** Needs the Paid plan settled first.
4. **Claims** (shared objects with a referee), as missions with strangers need them.
5. **Room memory** (pings, events in progress; offline parked cars only if `ci/cars` asks).

**Not doing:**
- **Running the game on the server** (true "server authority"). It would mean rewriting the game around a server
  simulation and paying for constant compute; Durable Objects aren't built for 30 Hz physics.
- **One giant room for everyone.** Every update would go to every player: costs and lag grow with the square of the
  player count.
- **20–60 updates a second.** About 4–12× the bill for little visible gain at our speeds.
- **Storing positions or a history of where people went.** A privacy cost with no player benefit.
- **Voice through this relay.** Voice for friends (roadmap 22c) belongs on a real-time voice service, a separate
  decision.
- **Changing the room / presence / board protocols in place.** Only new fields and new message types.

## Progress + the free-plan budget (2026-11-27)

- **Approved** by the owner ("Go ahead with this"). They are on the **Free** plan, so step 3 (rooms by place) waits for
  the switch to Paid; steps 1–2 must not add requests per player.
- **Steps 1 + 2 are built** (`server/world.mjs`, `features/multiplayer/worldclock.js`, `ctx.mp.event`). What they do to the
  budget, per player-hour of online play (today ≈ 18,000 messages = 900 billed requests):
  - step 1: +6 quick pings per connection (the old 25 s heartbeat carries the clock after that) + one `/world/config`
    every 10 min, which is a Worker request, not a Durable Object one. **≈ +0 %.**
  - step 2: the server timestamps are on messages going OUT (free). A reliable event is 1 incoming message, but it
    replaces a one-time thing that used to ride, repeated, inside the 5-a-second state. **≈ 0 %** (slightly less once
    `ci/friends` moves emotes / bumps over).
  - the budget counter: rooms report every 2,000 messages or 10 min (+1 request per 100 billed ones) **≈ +1 %.**
- **Seeing the budget:** open `https://lulu-shared-road.lulu-boats-1f4cdd.workers.dev/world/usage?text=1`. It answers
  with one sentence, e.g. "about 12 % of the free daily allowance is used… resets in 7 h". The count covers only what
  the relay sees (it starts at the deploy), so treat it as a close estimate; Cloudflare's dashboard has the exact figure.
- **When the free allowance runs out:** players get ONE quiet line, "🌙 Online play is resting until 7:00 PM. You can
  keep playing." (their local time for midnight UTC). Play goes on solo; the game reconnects by itself after the reset.

## Step 3 switched on (2026-11-27)

- **The owner approved step 3 on the Free plan** ("Yes switch it on step 3", relayed by the coordinator, 2026-11-27).
- **Areas are 2 km, not 500 m.** Every room change is a new connection, and each one counts on the free allowance. At
  highway speed, 500 m stretches would have cost about +70 %; 2 km stretches cost about +15 %.
- **Who is heard.** Anyone close enough to be drawn (320 m) is heard across a line: the listening zone matches the
  drawing range.
- **The lobby bridge** for old copies sends every 2 s (about +10 %) and can go once old copies have updated.
- **Budget with step 3:** about +25–30 % per player-hour while driving. The Free plan's daily cap drops from about 110
  to about **85 player-hours a day**. Watch `/world/usage?text=1`.
