    // ════════════════════════════════════════════════════════
    // ═══════════ SHARED ROAD — multiplayer presence ══════════
    // ════════════════════════════════════════════════════════
    //
    // A thin PRESENCE layer: online players broadcast tiny heartbeats and show
    // up in each other's worlds as translucent, NON-colliding ghosts + a
    // nametag. No shared physics, no chat, no server authority. Offline play is
    // untouched — every hook below is a guarded no-op unless the player has
    // explicitly joined from the menu.
    //
    // MP_URL is the WebSocket base. Production sets a wss:// Cloudflare Worker
    // URL. An EMPTY string ("") hides the whole feature (every hook no-ops).
    // LIVE: the free Cloudflare Worker relay (deployed via the
    // "Deploy Shared Road worker" GitHub Action; see server/README.md).
    // Local dev/testing: "ws://127.0.0.1:9977" with `node server/local-relay.js`.
    // Empty string ("") hides the whole feature.
    var MP_URL = "wss://lulu-shared-road.lulu-boats-1f4cdd.workers.dev";

    // Curated, App-Store-safe, on-theme names (no free text).
    var CURATED_NAMES = [
        "Cholent Boy", "Rugelach Queen", "Bubby's Favorite", "Kugel Kid",
        "Shabbos Racer", "Babka Baron", "Gefilte Ghost", "Mitzvah Machine",
        "Sheitel Slayer", "Dreidel Daredevil", "Latke Legend", "Schmaltz Speedster"
    ];

    var MP_RING = 60000;   // looping "highway ring" length (px)
    var MP_VIS = 900;      // |rel| < this → the ghost is visible

    // ── Connection state ─────────────────────────────────────
    var mpSock = null;
    var mpWant = false;         // does the player WANT to be connected?
    var mpConnected = false;    // socket open AND hello received
    var mpEverConnected = false; // opted in this session? gates all board POSTs
    var mpRoom = "lobby";       // "lobby" = EVERYONE; else an uppercased code
    var mpMyId = null;
    var mpPeers = {};           // id -> peer record
    var mpClock = 0;            // local accumulated seconds (drives all timers)
    var mpSendTimer = 0;        // state-broadcast throttle (≤5 Hz)
    var mpPingTimer = 0;        // keepalive throttle (25 s)
    var mpReconnectAt = 0;      // mpClock time of the next reconnect attempt
    var mpReconnectDelay = 1;   // backoff seconds (1,2,4,8… cap 10)
    var mpWantSince = 0;        // mpClock when the player asked to connect

    // ── Picker / overlay UI state ────────────────────────────
    var mpPickerOpen = false;
    var mpRoomKind = "everyone";   // "everyone" | "friend" (selection in the form)
    // Friend-code slots start RANDOM each session (everyone defaulting to AAAA
    // meant strangers all landed in the same "private" room). Dial the wheel to
    // enter a friend's code, or 🎲 reroll for a fresh one to share.
    var mpCodeSlots = [Math.floor(Math.random() * 26), Math.floor(Math.random() * 26),
                       Math.floor(Math.random() * 26), Math.floor(Math.random() * 26)];
    function mpRerollCode() {
        for (var i = 0; i < 4; i++) mpCodeSlots[i] = Math.floor(Math.random() * 26);
    }

    // ── HUD chip pulse (rider count changes) ─────────────────
    var mpChipPulse = 0;         // 1 → 0 over ~0.6s after the head-count changes
    var mpLastRiderCount = -1;

    // ── Async BOARD (phase 2: wanted posters + daily leaderboard) ─
    var mpScorePosted = false;   // one score POST per run (re-armed after gameover)
    var mpWantedCache = { t: -1e9, data: [], loading: false };          // GET /board/wanted (60s TTL)
    var mpScoresCache = { t: -1e9, data: [], ok: false, loading: false }; // GET /board/scores (60s TTL)

    // ── FRIEND RACE (phase 3) ────────────────────────────────
    // Rides entirely inside the state packets the live relay already forwards
    // (d.rn race-nonce · d.rp progress · d.rw win-nonce) — no server changes.
    // Progress is CUMULATIVE road gained since GO: crashes/jail don't erase it,
    // they just cost you driving time (so staying out of trouble IS the meta).
    // Friend rooms only, so the big lobby stays chill.
    var RACE_GOAL = 200000;     // px of road to win — a proper endurance race
    var mpRace = null;          // null | {id, state:"count"|"go"|"done", t, base, prog, winner, winName}
    var mpRaceSeq = Math.floor(Math.random() * 1e6) + 1;  // my next race nonce
    var mpForceSends = 0;       // send state NOW for a few ticks (race start/win)

    // ── ROOM SWITCH (Feature 1) ──────────────────────────────
    // While CONNECTED you can re-pick EVERYONE/FRIEND (+ a code) and SWITCH
    // rooms without opting out. mpSwitchTo holds the target label while in flight.
    var mpSwitchTo = null;      // null | "EVERYONE" | "ABCD" — shown while switching

    // ── CONVOY BONUS (Feature 2, friend rooms only) ──────────
    // Driving near a party member for 2s continuous → ×1.5 score, holds until
    // 3s with nobody in range. Lobby is excluded (fairness — social rooms only).
    var convoyT = 0;            // continuous in-range seconds (pre-activation)
    var convoyGrace = 0;        // seconds since last peer in range (while active)
    var convoyActive = false;
    function mpConvoyMult() { return convoyActive ? 1.5 : 1; }

    // ── PARTY RECORD TOASTS (Feature 3, all rooms) ───────────
    // When I beat my own high score mid-run the party hears about it: I piggyback
    // d.pb=[nonce,score] for a few seconds; peers toast it once per new nonce.
    var mpRecordNonce = 0;      // bumps each time I set a personal best
    var mpMyRecord = null;      // {v:score, n:nonce} — piggybacked while fresh
    var mpRecordSentAt = -1e9;  // mpClock when the record was noted (drop pb after ~4s)
    var mpToasts = [];          // [{name, score, t}] incoming peer-record toasts

    // ════════════════════════════════════════════════════════
    // ═══════════ PARTY WAVE 2 — real player interactions ═════
    // ════════════════════════════════════════════════════════
    // All four ride the FROZEN relay: BONK/SLIPSTREAM are pure client-side
    // self-detection (nothing new on the wire); TAG + EMOTES piggyback new fields
    // inside the verbatim-relayed `d` packet (d.em / d.it / d.tgo / d.tgr).

    // ── BONK! physical ghosts (Feature 1, friend rooms) ──────
    // My car overlapping a peer ghost bounces me away — comedy physics, no damage.
    // Symmetric: each side self-detects the same overlap. Per-peer cooldown stops
    // riding-alongside from machine-gunning bonks. (cooldown stored on p.bonkCd.)

    // ── SLIPSTREAM draft (Feature 2, friend rooms) ───────────
    // Tucking behind a friend ahead (120<rel<420, |dx|<34) for 1s → gameSpeed +8%.
    var mpDraftT = 0;           // continuous in-window seconds (pre-activation)
    var mpDraftGrace = 0;       // seconds out of window while active
    var mpDraftActive = false;
    function mpDraftMult() { return mpDraftActive ? 1.08 : 1; }

    // ── TAG mode (Feature 3, friend rooms, 2+) ───────────────
    // A together-game over the frozen relay via self-declaration + nonce ordering.
    // d.it=[n,gid] (broadcast by whoever is IT; n increments on every tag) ·
    // d.tgo=gid (starter announces the game for ~4s) · d.tgr=[gid,secs] (each
    // client shouts its total it-time at timeout for ~4s). Conflict self-heal:
    // higher n wins; equal n → higher peer id wins (deterministic everywhere).
    var MP_TAG_DUR = 90;        // seconds a tag game runs (each client times locally)
    var mpTag = null;           // null | {gid,n,itIsMe,itPeer,t,dur,myItTime,participants,
                                //          tgoAt,over,resultsSentAt,resultsT,results{}}
    var mpTagBanner = null;     // {text, sub, t} brief "YOU'RE IT!" / "TAGGED!" banner

    // ── EMOTE WHEEL (Feature 4, all rooms) ───────────────────
    // Long-press the honk button → radial fan of 6 curated emotes. Tap → burst
    // over my car + broadcast d.em=[nonce,idx]; peers de-dupe per nonce + burst it
    // over my ghost. Quick honk tap is unchanged (see 01-engine-core touchend).
    var EMOTES = ["😂", "❤️", "😱", "🏁", "🐢", "🔥"];
    var emoteWheelOpen = false;   // set true by the 01 touchend long-press handler
    var emoteWheelT = 0;          // seconds the wheel has been open (auto-close at 3s)
    var mpEmoteNonce = Math.floor(Math.random() * 1e6) + 1;
    var mpMyEmote = null;         // {n, idx, at} — piggybacked in d.em for ~2s
    var mpMyBurstEmoji = null;    // local emoji burst over MY car
    var mpMyBurstT = 0;           // remaining life (1.1 → 0), like a ghost honkT

    // ── PARTY PARKING (phase 2.9) ────────────────────────────
    // In a FRIEND room the roadside lot is SEEDED BY THE ROOM CODE, so the whole
    // party sees the same lot; each member's target spot comes from their stable
    // position in the room roster (no overlaps); and members mid-parking appear
    // in your lot as translucent ghosts (d.pk rides the verbatim-relayed state).
    function mpHashStr(s) {
        var h = 5381;
        for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
        return h >>> 0;
    }
    function mpMulberry(seed) {
        var a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            var t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    // Layout rng for the roadside lot: room-seeded in a friend room (shared lot
    // for the party), otherwise a fresh random seed (different every pull-over).
    function mpParkingRng() {
        if (mpConnected && mpRoom !== "lobby") return mpMulberry(mpHashStr("lot:" + mpRoom.toUpperCase()));
        return mpMulberry((Math.random() * 4294967296) >>> 0);
    }
    // My spot slot among the room roster (stable, collision-free for ≤ spots).
    function mpParkingSpotIndex() {
        if (!mpConnected || mpRoom === "lobby" || !mpMyId) return 0;
        var ids = [mpMyId];
        for (var k in mpPeers) ids.push(k);
        ids.sort();
        for (var i = 0; i < ids.length; i++) if (ids[i] === mpMyId) return i;
        return 0;
    }
    // Party members mid-parking, drawn into MY lot as translucent nametagged cars.
    function mpDrawParkingGhosts() {
        if (!MP_URL || !mpConnected || mpRoom === "lobby") return;
        for (var id in mpPeers) {
            var p = mpPeers[id];
            if (!p.pk || (mpClock - (p.pkT || -99)) > 3) continue;
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.translate(p.pk.x, p.pk.y);
            ctx.rotate((p.pk.r || 0) + Math.PI / 2);
            mpDrawGhostVehicle(0, 0, p);
            ctx.restore();
            mpDrawNametag(p.pk.x, p.pk.y - 34, p.name, 0.8);
        }
    }

    // ── TEMP DEBUG state (see mpDebugFake at the bottom) ─────
    var mpFakeMode = false;
    var mpFakeHonkT = 2.0;

    function mpMyName() { return save.mpName || CURATED_NAMES[0]; }
    function mpPeerCount() { var n = 0; for (var k in mpPeers) n++; return n; }
    function mpRiderCount() { return mpPeerCount() + (mpConnected ? 1 : 0); }
    function mpPeerNames() { var a = []; for (var k in mpPeers) a.push(mpPeers[k].name); return a; }

    // Wrap a relative distance into [-RING/2, RING/2).
    function mpWrap(v) {
        var r = MP_RING;
        v = v % r;
        if (v < -r / 2) v += r;
        else if (v >= r / 2) v -= r;
        return v;
    }

    // ── Networking ───────────────────────────────────────────
    function mpSockOpen() { return !!mpSock && mpSock.readyState === 1; }

    function mpSend(obj) {
        try { if (mpSockOpen()) mpSock.send(JSON.stringify(obj)); } catch (e) {}
    }

    function mpConnect() {
        if (!MP_URL) return;
        mpWant = true;
        mpWantSince = mpClock;      // for the "still trying…" hint on the panel
        mpEverConnected = true;     // opted in — board POSTs are now allowed this session
        mpConnected = false;
        mpPeers = {};
        mpReconnectDelay = 1;
        mpReconnectAt = mpClock;
        mpOpenSocket();
    }

    function mpDisconnect() {
        mpWant = false;
        mpConnected = false;
        mpMyId = null;
        mpPeers = {};
        mpFakeMode = false;
        mpRace = null; mpForceSends = 0;
        convoyActive = false; convoyT = 0; convoyGrace = 0;
        mpTag = null; mpTagBanner = null;
        mpDraftActive = false; mpDraftT = 0; mpDraftGrace = 0;
        emoteWheelOpen = false;
        mpSwitchTo = null;
        if (mpSock) { try { mpSock.onclose = null; mpSock.close(); } catch (e) {} mpSock = null; }
    }

    // The room the picker form currently points at (EVERYONE → "lobby", else the
    // dialed 4-letter code). Used to label CONNECT vs SWITCH and to switch to.
    function mpTargetRoom() {
        if (mpRoomKind === "friend") {
            var code = "";
            for (var k = 0; k < 4; k++) code += String.fromCharCode(65 + mpCodeSlots[k]);
            return code;
        }
        return "lobby";
    }
    function mpRoomLabel(room) { return (room === "lobby") ? "EVERYONE" : String(room).toUpperCase(); }

    // SWITCH rooms while staying connected (Feature 1): close the socket cleanly
    // WITHOUT opting out (mpWant/auto stay intact — this is a switch, not a
    // DISCONNECT), point at the new room, clear peers + any live race, reset the
    // reconnect/backoff machinery, and reconnect immediately via the normal path.
    function mpSwitchRoom(room, kind) {
        if (!MP_URL) return;
        // Cancel an in-flight race — you're leaving the room it lived in.
        if (mpRace) {
            var wasLive = (mpRace.state !== "done");
            mpRace = null; mpForceSends = 0;
            if (wasLive && typeof spawnFloater === "function" && typeof player !== "undefined" && player)
                spawnFloater(player.x, player.y - 50, "🏁 race cancelled — left the room", "#FFAB91");
        }
        convoyActive = false; convoyT = 0; convoyGrace = 0;
        // Leaving the room ends any live TAG game + slipstream too (like the race).
        mpTag = null; mpTagBanner = null;
        mpDraftActive = false; mpDraftT = 0; mpDraftGrace = 0;
        // Close the current socket without scheduling a reconnect off THIS close.
        if (mpSock) { try { mpSock.onclose = null; mpSock.close(); } catch (e) {} mpSock = null; }
        mpConnected = false;
        mpMyId = null;
        mpPeers = {};
        mpFakeMode = false;
        // Point at the target and reconnect right now (keep mpWant/auto intact).
        mpRoom = room;
        mpRoomKind = kind;
        mpWant = true;
        mpEverConnected = true;
        mpWantSince = mpClock;
        mpReconnectDelay = 1;               // reset backoff so it can't fight us
        mpReconnectAt = mpClock;
        mpSwitchTo = mpRoomLabel(room);
        mpOpenSocket();
    }

    function mpOpenSocket() {
        if (!MP_URL || !mpWant) return;
        try {
            if (mpSock) { try { mpSock.onclose = null; mpSock.close(); } catch (e) {} mpSock = null; }
            mpSock = new WebSocket(MP_URL + "/room/" + encodeURIComponent(mpRoom));
            mpSock.onopen = function () { try { mpOnOpen(); } catch (e) {} };
            mpSock.onmessage = function (ev) { try { mpOnMessage(ev); } catch (e) {} };
            mpSock.onclose = function () { try { mpOnClose(); } catch (e) {} };
            mpSock.onerror = function () {};   // onclose drives the reconnect
        } catch (e) {
            mpSock = null;
            mpScheduleReconnect();
        }
    }

    function mpOnOpen() {
        mpReconnectDelay = 1;
        mpPingTimer = 0;
        mpSendTimer = 0;
        mpSend({
            t: "j", v: 1,
            room: (mpRoom === "lobby" ? "lobby" : mpRoom.toUpperCase()),
            name: mpMyName(),
            sk: save.selectedSkin
        });
    }

    function mpOnClose() {
        mpSock = null;
        mpConnected = false;
        mpPeers = {};
        if (mpWant) mpScheduleReconnect();
    }

    function mpScheduleReconnect() {
        mpReconnectAt = mpClock + mpReconnectDelay;
        mpReconnectDelay = Math.min(mpReconnectDelay * 2, 10);
    }

    function mpOnMessage(ev) {
        var msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (!msg || !msg.t) return;
        if (msg.t === "h") {                    // hello — our id + current peers
            mpMyId = msg.id;
            mpConnected = true;
            mpSwitchTo = null;                  // switch (if any) has landed
            mpPeers = {};
            // Joining a friend room switches distracted mode OFF (solo cheat —
            // reverse controls + 2× score would poison shared scores/races).
            if (mpRoom !== "lobby" && typeof distractedMode !== "undefined" && distractedMode) {
                distractedMode = false;
                menuMsg = "📱 Distracted mode off — friend room"; menuMsgTimer = 2.5;
            }
            if (msg.peers) {
                for (var i = 0; i < msg.peers.length; i++) {
                    var pp = msg.peers[i];
                    mpAddPeer(pp.id, pp.name, pp.sk);
                    if (pp.d) mpApplyState(pp.id, pp.d, true);   // snapshot — stale rn is NOT an invite
                }
            }
        } else if (msg.t === "+") {             // peer joined
            mpAddPeer(msg.id, msg.name, msg.sk);
        } else if (msg.t === "s") {             // peer state
            mpApplyState(msg.id, msg.d);
        } else if (msg.t === "e") {             // peer event (honk/wave)
            mpPeerEvent(msg.id, msg.e);
        } else if (msg.t === "-") {             // peer left
            delete mpPeers[msg.id];
        }
        // "po" (pong) needs no handling — the socket staying open is the point.
    }

    function mpAddPeer(id, name, sk) {
        if (!id || id === mpMyId) return null;
        var p = mpPeers[id];
        if (!p) {
            p = {
                id: id, name: name || "Rider", sk: sk || "pink",
                m: 0, vk: "car", ct: 0, co: null,
                x: W / 2, tx: W / 2, di: 0, sp: 0, seen: false,
                lastPacket: mpClock, honkT: 0, waveT: 0,
                sx: W / 2, sy: 0, rel: 0, onScreen: false,
                vis: 0, dropping: false   // 0→1 fade-in on first sight; →0 fade-out on drop
            };
            mpPeers[id] = p;
        } else {
            if (name) p.name = name;
            if (sk) p.sk = sk;
        }
        return p;
    }

    function mpApplyState(id, d, snap) {
        if (!id || id === mpMyId || !d) return;
        var p = mpPeers[id] || mpAddPeer(id, null, null);
        if (!p) return;
        p.lastPacket = mpClock;
        if (typeof d.m === "number") p.m = d.m;
        if (typeof d.x === "number") p.tx = d.x;
        if (d.vk) p.vk = d.vk;
        if (typeof d.ct === "number") p.ct = d.ct;
        if (d.co) p.co = d.co;
        if (typeof d.sp === "number") p.sp = d.sp;
        if (typeof d.di === "number") {
            if (!p.seen) { p.di = d.di; p.x = p.tx; p.seen = true; } // first packet → snap
            else {
                var err = d.di - p.di;
                if (Math.abs(err) > 250) p.di = d.di;   // hard desync → snap
                else p.di += err * 0.4;                 // small drift → soft-correct
            }
        }
        // ── race fields (friend rooms) ──
        // Only a HELLO SNAPSHOT'S nonce is swallowed as stale (it can predate us);
        // any LIVE packet's new nonce is a genuine invite — including the first
        // packet we ever see from that peer (a menu racer's very first send IS
        // the race start).
        if (typeof d.rn === "number") {
            if (snap) { p.rn = d.rn; p.rnInit = true; }
            else if (!p.rnInit || d.rn !== p.rn) { p.rn = d.rn; p.rnInit = true; mpRaceJoin(d.rn); }
        }
        if (typeof d.rp === "number") p.raceProg = d.rp;
        if (d.pk) { p.pk = d.pk; p.pkT = mpClock; } else p.pk = null;
        if (typeof d.rw === "number" && mpRace && d.rw === mpRace.id && mpRace.state !== "done")
            mpRaceWon(p.name || "A rider");
        // ── record toast (d.pb=[nonce,score]) — de-duped per peer nonce ──
        // A hello SNAPSHOT'S nonce is swallowed (stale — the record predates us);
        // any LIVE packet with a nonce new for this peer fires exactly one toast.
        if (d.pb && d.pb.length === 2 && typeof d.pb[0] === "number") {
            if (snap) { p.pbNonce = d.pb[0]; }
            else if (p.pbNonce !== d.pb[0]) { p.pbNonce = d.pb[0]; mpPushRecordToast(p.name, d.pb[1]); }
        }
        // ── EMOTE (d.em=[nonce,idx]) — de-duped per peer nonce, burst over ghost ──
        // A hello snapshot's nonce is swallowed (stale); any LIVE new nonce bursts once.
        if (d.em && d.em.length === 2 && typeof d.em[0] === "number") {
            if (snap) { p.emNonce = d.em[0]; }
            else if (p.emNonce !== d.em[0]) {
                p.emNonce = d.em[0];
                p.emT = 1.1; p.emEmoji = EMOTES[d.em[1]] || "❤️";
            }
        }
        // ── TAG marker (d.it=[n,gid]) — only the current IT player broadcasts it ──
        if (d.it && d.it.length === 2 && typeof d.it[0] === "number" && !snap) {
            mpTagApplyMarker(id, d.it[0], d.it[1]);
        }
        // ── TAG announce (d.tgo=gid) — starter shouts the game into existence ──
        if (typeof d.tgo === "number" && !snap) mpTagLearn(id, d.tgo);
        // ── TAG results (d.tgr=[gid,secs]) — each client's total it-time at timeout ──
        if (d.tgr && d.tgr.length === 2 && typeof d.tgr[0] === "number" && !snap && mpTag && mpTag.gid === d.tgr[0]) {
            mpTag.results[id] = { name: p.name, secs: Math.max(0, d.tgr[1] || 0) };
            mpTag.participants[id] = 1;
            if (!mpTag.over) { mpTag.over = true; mpTag.resultsT = 0; if (mpTag.resultsSentAt < 0) mpTagBroadcastResults(); }
        }
    }

    function mpPeerEvent(id, e) {
        var p = mpPeers[id];
        if (!p) return;
        if (e === "honk") {
            p.honkT = 1.1;
            if (p.onScreen && Math.abs(p.rel) < 320) {
                if (typeof playHonk === "function") playHonk();
                if (typeof spawnFloater === "function") spawnFloater(p.sx, p.sy - 40, "📣", "#FFD54F");
            }
        } else if (e === "wave") {
            p.waveT = 1.1;
            if (p.onScreen && typeof spawnFloater === "function") spawnFloater(p.sx, p.sy - 40, "👋", "#FFF176");
        }
    }

    // ── PARTY RECORD TOASTS (Feature 3) ──────────────────────
    // Called from the driving loop's pbBroken celebration: stamp a one-shot
    // record so the next few state packets carry d.pb and the party gets toasted.
    function mpNoteRecord(score) {
        if (!MP_URL) return;
        mpRecordNonce++;
        mpMyRecord = { v: Math.floor(score || 0), n: mpRecordNonce };
        mpRecordSentAt = mpClock;
        if (mpForceSends < 3) mpForceSends = 3;   // shout it out right away
    }
    function mpPushRecordToast(name, score) {
        mpToasts.push({ name: name || "A rider", score: Math.floor(score || 0), t: 0 });
        while (mpToasts.length > 4) mpToasts.shift();
        try { playTone(880, 0.09, "triangle", 0.14, 1180); } catch (e) {}
    }

    // Broadcast my own state (≤5 Hz, only while actually driving/walking).
    function mpSendState() {
        var vk = "car", ct = 0, co = null;
        if (typeof playerVehicle !== "undefined" && playerVehicle) {
            if (playerVehicle === "cop") vk = "cop";
            else if (playerVehicle === "bus") vk = "bus";
            else if (playerVehicle === "ambulance") vk = "ambulance";
            else if (playerVehicle === "dozer") vk = "dozer";
            else if (playerVehicle === "borrowed") {
                vk = "borrowed";
                if (typeof borrowedCar !== "undefined" && borrowedCar) {
                    ct = borrowedCar.carType || 0;
                    co = borrowedCar.color || "#E53935";
                }
            }
        }
        var d = {
            m: (state === "footRun") ? 1 : 0,
            x: Math.round(player ? player.x : W / 2),
            di: Math.round(typeof scrollOffset === "number" ? scrollOffset : 0),
            sp: Math.round(typeof gameSpeed === "number" ? gameSpeed : 0),
            vk: vk
        };
        if (vk === "borrowed") { d.ct = ct; d.co = co || "#E53935"; }
        // parking piggyback: my lot position while I'm parking (party ghosts)
        if (state === "parking" && typeof parkingCar !== "undefined" && parkingCar) {
            d.pk = { x: Math.round(parkingCar.x), y: Math.round(parkingCar.y),
                     r: Math.round((parkingCar.rot || 0) * 100) / 100 };
        }
        // race piggyback: nonce always rides once a race exists this session,
        // progress while racing, win-nonce once won by me
        if (mpRace) {
            d.rn = mpRace.id;
            if (mpRace.state === "go") d.rp = Math.round(mpRace.prog || 0);
            if (mpRace.state === "done" && mpRace.winner === "me") d.rw = mpRace.id;
        }
        // record piggyback: [nonce, score] for ~4s after I beat my high score
        if (mpMyRecord && (mpClock - mpRecordSentAt) < 4) d.pb = [mpMyRecord.n, mpMyRecord.v];
        // emote piggyback: [nonce, idx] for ~2s after I fire an emote
        if (mpMyEmote && (mpClock - mpMyEmote.at) < 2) d.em = [mpMyEmote.n, mpMyEmote.idx];
        // TAG piggybacks: IT marker while I'm it; the starter's game announce for
        // 4s; my final it-time for 4s once the game times out.
        if (mpTag) {
            if (mpTag.itIsMe && !mpTag.over) d.it = [mpTag.n, mpTag.gid];
            if (!mpTag.over && (mpClock - mpTag.tgoAt) < 4) d.tgo = mpTag.gid;
            if (mpTag.over && mpTag.resultsSentAt >= 0 && (mpClock - mpTag.resultsSentAt) < 4)
                d.tgr = [mpTag.gid, Math.round(mpTag.myItTime)];
        }
        mpSend({ t: "s", d: d });
    }

    // ── Lifecycle tick ───────────────────────────────────────
    // ── FRIEND RACE lifecycle ────────────────────────────────
    function mpRaceStart() {                    // panel button (friend rooms only)
        if (!mpConnected || mpRoom === "lobby") return;
        mpRaceSeq += 1 + Math.floor(Math.random() * 7);
        mpRaceBegin(mpRaceSeq);
        mpForceSends = 4;                       // shout the nonce out right away
    }
    function mpRaceJoin(id) { if (!mpRace || mpRace.id !== id) mpRaceBegin(id); }
    function mpRaceBegin(id) {
        mpRace = { id: id, state: "count", t: 0, lastBeep: 4, lastDi: 0, prog: 0, winner: null, winName: "" };
        mpPickerOpen = false;
        try { playTone(392, 0.12, "square", 0.16); } catch (e) {}
    }
    function mpRaceWon(name) {
        if (!mpRace || mpRace.state === "done") return;
        mpRace.state = "done"; mpRace.winner = "peer"; mpRace.winName = name; mpRace.t = 0;
        try { playTone(392, 0.14, "triangle", 0.16); setTimeout(function () { playTone(523, 0.2, "triangle", 0.16); }, 140); } catch (e) {}
    }
    function mpRaceUpdate(dt) {
        if (!mpRace) return;
        mpRace.t += dt;
        if (mpRace.state === "count") {
            var n = Math.ceil(3 - mpRace.t);
            if (n < mpRace.lastBeep && n > 0) { mpRace.lastBeep = n; try { playTone(440, 0.09, "square", 0.16); } catch (e) {} }
            if (mpRace.t >= 3) {
                // GO! Menu-racers hop straight into a fresh run; mid-run racers
                // race from where they are (progress counts from HERE).
                if (state === "menu" && typeof resetGame === "function") { resetGame(); state = "playing"; }
                mpRace.state = "go"; mpRace.t = 0;
                if (typeof Haptic !== "undefined") Haptic.medium("racego");
                mpRace.lastDi = (typeof scrollOffset === "number") ? scrollOffset : 0;
                mpRace.prog = 0;
                try {
                    playTone(660, 0.16, "triangle", 0.2, 880);
                    if (typeof player !== "undefined" && player) spawnFloater(player.x, player.y - 50, "🏁 GO!", "#7CFC4F");
                } catch (e) {}
            }
        } else if (mpRace.state === "go") {
            // Cumulative: bank every forward px; a reset (crash/new run) just
            // rebases — you keep what you earned, you lost the time.
            var di = (typeof scrollOffset === "number") ? scrollOffset : 0;
            var dd = di - mpRace.lastDi;
            if (dd > 0 && dd < 3000) mpRace.prog += dd;   // sane forward gain only
            mpRace.lastDi = di;
            if (mpRace.prog >= RACE_GOAL) {
                mpRace.state = "done"; mpRace.winner = "me"; mpRace.winName = mpMyName(); mpRace.t = 0;
                mpForceSends = 5;
                try {
                    playTone(523, 0.12, "triangle", 0.2); setTimeout(function () { playTone(784, 0.14, "triangle", 0.2); }, 120);
                    setTimeout(function () { playTone(1047, 0.2, "triangle", 0.2); }, 260);
                } catch (e) {}
            }
            if (mpRace.t > 1500) mpRace = null;          // 25-min fizzle failsafe
        } else if (mpRace.state === "done") {
            if (mpRace.t > 6) mpRace = null;             // banner shown, race cleared
        }
    }
    // Countdown / progress panel / winner banner — called from the HUD chip
    // (driving + foot) and from the menu button, so a race is visible anywhere.
    function mpDrawRace() {
        if (!MP_URL || !mpRace) return;
        if (mpRace.state === "count") {
            var n = Math.ceil(3 - mpRace.t);
            var frac = 1 - ((3 - mpRace.t) - (n - 1));   // 0→1 within this second
            ctx.save();
            ctx.fillStyle = "rgba(10,8,24,0.45)"; ctx.fillRect(0, 0, W, H);
            drawText("🏁 FRIEND RACE!", W / 2, H * 0.32, "bold 26px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 5);
            var ps = 1 + (1 - frac) * 0.8;
            ctx.translate(W / 2, H * 0.45); ctx.scale(ps, ps);
            drawText(String(n), 0, 0, "bold 84px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#7E57C2", 10);
            ctx.restore();
            drawText("First to " + (RACE_GOAL / 1000) + "k road — crashes cost TIME, not progress!", W / 2, H * 0.56,
                "bold 13px 'Segoe UI', Arial, sans-serif", "#E1D5F5", "#000", 3);
            return;
        }
        if (mpRace.state === "go") {
            // compact live standings, top-left under the score
            var rx = 14, ry = 92, rw2 = 150;
            var rows = [{ name: mpMyName() + " (you)", prog: mpRace.prog, me: true }];
            for (var id in mpPeers) {
                var p = mpPeers[id];
                if (typeof p.raceProg === "number") rows.push({ name: p.name, prog: p.raceProg, me: false });
            }
            rows.sort(function (a, b) { return b.prog - a.prog; });
            ctx.save();
            ctx.fillStyle = "rgba(10,8,24,0.6)"; roundRect(rx - 4, ry - 12, rw2 + 8, 18 + rows.length * 26, 8); ctx.fill();
            drawText("🏁 RACE", rx, ry - 2, "bold 10px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 2, "left");
            for (var i = 0; i < rows.length && i < 5; i++) {
                var rr = rows[i], yy = ry + 12 + i * 26;
                drawText(rr.name, rx, yy, "bold 9px 'Segoe UI', Arial, sans-serif", rr.me ? "#FFE082" : "#CFC4E8", "#000", 2, "left");
                var pp = clamp(rr.prog / RACE_GOAL, 0, 1);
                drawText(Math.floor(pp * 100) + "%", rx + rw2 - 8, yy, "bold 9px 'Segoe UI', Arial, sans-serif", rr.me ? "#7CFC4F" : "#B0A8C8", "#000", 2, "right");
                ctx.fillStyle = "rgba(0,0,0,0.5)"; roundRect(rx, yy + 4, rw2 - 8, 6, 3); ctx.fill();
                ctx.fillStyle = rr.me ? "#7CFC4F" : "#B39DDB"; roundRect(rx, yy + 4, (rw2 - 8) * pp, 6, 3); ctx.fill();
            }
            ctx.restore();
            return;
        }
        // done — winner banner (fades out over the last 2s)
        var a = mpRace.t > 4 ? clamp(1 - (mpRace.t - 4) / 2, 0, 1) : 1;
        ctx.save(); ctx.globalAlpha = a;
        var meWon = mpRace.winner === "me";
        drawText(meWon ? "🏆 YOU WIN THE RACE!" : "🏆 " + mpRace.winName + " WINS!", W / 2, H * 0.3,
            "bold 26px 'Segoe UI', Arial, sans-serif", meWon ? "#FFD54F" : "#B39DDB", "#000", 6);
        ctx.restore();
    }

    function mpUpdate(dt) {
        if (!MP_URL) return;
        try {
            mpClock += dt;

            // Reconnect with backoff while the player still WANTS to be connected.
            if (mpWant && !mpFakeMode &&
                (!mpSock || mpSock.readyState === 2 || mpSock.readyState === 3) &&
                mpClock >= mpReconnectAt) {
                mpOpenSocket();
            }
            // Keepalive ping every 25 s.
            if (mpSockOpen()) {
                mpPingTimer += dt;
                if (mpPingTimer >= 25) { mpPingTimer = 0; mpSend({ t: "pi" }); }
            }
            // Race lifecycle (countdown → go → win/fizzle).
            mpRaceUpdate(dt);
            // Broadcast my state at ≤5 Hz while playing/footRun — plus during a
            // race (so menu-racers still shout the nonce), plus a few forced
            // sends around race start/win so those land instantly.
            if (mpConnected && !mpFakeMode && (state === "playing" || state === "footRun" || state === "parking" || mpRace)) {
                mpSendTimer += dt;
                if (mpSendTimer >= 0.2 || mpForceSends > 0) {
                    mpSendTimer = 0;
                    if (mpForceSends > 0) mpForceSends--;
                    mpSendState();
                }
            }

            if (mpFakeMode) mpFakeMaintain(dt);

            // Advance interpolation + expire stale peers (no packet 6 s → fade out).
            var fadeRate = dt / 0.4;   // 0.4 s to fully fade in / out
            for (var id in mpPeers) {
                var p = mpPeers[id];
                if (!mpFakeMode) p.di += (p.sp || 0) * dt;   // extrapolate distance
                p.x = lerp(p.x, p.tx, clamp(dt * 8, 0, 1));  // ease lane x
                if (p.honkT > 0) p.honkT -= dt;
                if (p.waveT > 0) p.waveT -= dt;
                if (p.emT > 0) p.emT -= dt;
                if (p.bonkCd > 0) p.bonkCd -= dt;
                // Stale → start a graceful fade-out instead of popping away.
                if (mpClock - p.lastPacket > 6) p.dropping = true;
                var target = p.dropping ? 0 : 1;
                if (p.vis < target) p.vis = Math.min(target, p.vis + fadeRate);
                else if (p.vis > target) p.vis = Math.max(target, p.vis - fadeRate);
                if (p.dropping && p.vis <= 0.01) delete mpPeers[id];
                else if (mpClock - p.lastPacket > 9) delete mpPeers[id];   // hard safety
            }

            // ── CONVOY bonus (friend rooms only, driving) ──
            var convoyEligible = (mpConnected && mpRoom !== "lobby" && state === "playing");
            if (convoyEligible) {
                var cnear = false;
                var cMyDi = (typeof scrollOffset === "number") ? scrollOffset : 0;
                for (var cid in mpPeers) {
                    if (Math.abs(mpWrap(mpPeers[cid].di - cMyDi)) < 500) { cnear = true; break; }
                }
                if (cnear) {
                    convoyGrace = 0;
                    convoyT += dt;
                    if (!convoyActive && convoyT >= 2) {
                        convoyActive = true;
                        if (typeof spawnFloater === "function" && typeof player !== "undefined" && player)
                            spawnFloater(player.x, player.y - 60, "🚗🚗 CONVOY! ×1.5 score", "#7CFC4F");
                        try { playTone(660, 0.14, "triangle", 0.2, 880); } catch (e) {}
                        if (typeof Haptic !== "undefined") Haptic.medium("convoy");
                    }
                } else if (convoyActive) {
                    convoyGrace += dt;
                    if (convoyGrace >= 3) {
                        convoyActive = false; convoyT = 0; convoyGrace = 0;
                        if (typeof spawnFloater === "function" && typeof player !== "undefined" && player)
                            spawnFloater(player.x, player.y - 50, "convoy ended", "#B0A8C8");
                    }
                } else {
                    convoyT = 0;   // continuity broken before activation
                }
            } else {
                if (convoyActive && typeof spawnFloater === "function" && typeof player !== "undefined" && player)
                    spawnFloater(player.x, player.y - 50, "convoy ended", "#B0A8C8");
                convoyActive = false; convoyT = 0; convoyGrace = 0;
            }

            // ── PARTY WAVE 2 per-frame drivers ──
            mpBonkUpdate(dt);      // Feature 1 — bounce off + (during TAG) pass the marker
            mpDraftUpdate(dt);     // Feature 2 — slipstream draft window → +8%
            mpTagUpdate(dt);       // Feature 3 — timers, results, expiry
            mpEmoteUpdate(dt);     // Feature 4 — wheel timeout + tap consumption
            if (mpMyBurstT > 0) mpMyBurstT -= dt;
            if (mpTagBanner) { mpTagBanner.t += dt; if (mpTagBanner.t > 2.4) mpTagBanner = null; }

            // ── record toasts age out (~3s each) ──
            for (var ti = mpToasts.length - 1; ti >= 0; ti--) {
                mpToasts[ti].t += dt;
                if (mpToasts[ti].t > 3) mpToasts.splice(ti, 1);
            }

            // 🌐 rider-count chip: pulse briefly whenever the head-count changes.
            var rc = mpRiderCount();
            if (rc !== mpLastRiderCount) {
                if (mpLastRiderCount >= 0) mpChipPulse = 1;
                mpLastRiderCount = rc;
            }
            if (mpChipPulse > 0) mpChipPulse = Math.max(0, mpChipPulse - dt / 0.6);

            // Score is posted once per run; re-arm the moment we leave game over.
            if (typeof state !== "undefined" && state !== "gameover") mpScorePosted = false;
        } catch (e) {}
    }

    // ── Ghost rendering ──────────────────────────────────────
    function mpGhostHalfH(p) {
        if (p.m === 1) return 24;
        if (p.vk === "bus") return 56;
        if (p.vk === "ambulance") return 45;
        if (p.vk === "dozer") return 50;
        return 40;
    }

    function mpDrawGhostVehicle(x, y, p) {
        var vk = p.vk;
        if (vk === "cop") drawCopCar(x, y, mpClock * 3);
        else if (vk === "bus") drawTopBus(x, y);
        else if (vk === "ambulance") drawAmbulance(x, y, mpClock);
        else if (vk === "dozer") drawSteamroller(x, y, 0, mpClock);
        else if (vk === "borrowed") drawEnemyCar(x, y, p.co || "#E53935", (typeof p.ct === "number") ? p.ct : 0);
        else {   // "car" = a Lulu-style car in their chosen skin
            var sk = (p.sk && SKINS[p.sk]) ? p.sk : "pink";
            drawLuluCar(x, y, 0, false, mpClock, false, sk, 1, false);
        }
    }

    // "YOUR CREW" strip on the menu — your own car + everyone else in your room,
    // as their actual ride + name, so a party feels like a party before anyone
    // even drives. Shown whenever CONNECTED (even solo — you're always there) and
    // parked at the TOP, just under the title, centred horizontally.
    function mpDrawParty() {
        if (!MP_URL || !mpConnected || state !== "menu") return;
        // You are always the first slot; peers follow (cap the strip at 5).
        var members = [{ name: mpMyName() + " (you)", p: { vk: "car", sk: save.selectedSkin, ct: 0, co: null, m: 0 } }];
        for (var k in mpPeers) {
            if (members.length >= 5) break;
            members.push({ name: mpPeers[k].name, p: mpPeers[k] });
        }
        var stripY = H * 0.225;
        var slotW = Math.min(84, (W - 44) / members.length);
        var totalW = slotW * members.length;
        var x0 = W / 2 - totalW / 2 + slotW / 2;
        ctx.save();
        ctx.fillStyle = "rgba(10,8,24,0.5)";
        roundRect(W / 2 - totalW / 2 - 10, stripY - 26, totalW + 20, 78, 12); ctx.fill();
        drawText("👥 YOUR CREW" + (mpRoom !== "lobby" ? " · ROOM " + mpRoom.toUpperCase() : ""), W / 2, stripY - 14,
            "bold 10px 'Segoe UI', Arial, sans-serif", "#B39DDB", "#000", 2);
        for (var m = 0; m < members.length; m++) {
            var mx = x0 + m * slotW;
            ctx.save();
            ctx.translate(mx, stripY + 16);
            ctx.scale(0.44, 0.44);
            try { mpDrawGhostVehicle(0, 0, members[m].p); } catch (e) {}
            ctx.restore();
            mpDrawNametag(mx, stripY + 46, members[m].name, 1);
        }
        ctx.restore();
    }

    function mpDrawNametag(cx, baseY, name, a) {
        if (a === undefined) a = 1;
        // The subtle dark pill behind the text keeps names legible over any road.
        ctx.save();
        ctx.font = "bold 9px 'Segoe UI', Arial, sans-serif";
        var tw = ctx.measureText(name).width;
        var w = tw + 12, h = 14, x = cx - w / 2, y = baseY - h;
        ctx.globalAlpha = 0.92 * a;
        ctx.fillStyle = "rgba(24,22,38,0.85)";
        roundRect(x, y, w, h, 7); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = 1;
        roundRect(x, y, w, h, 7); ctx.stroke();
        ctx.globalAlpha = a;
        drawText(name, cx, y + h / 2 + 0.5, "bold 9px 'Segoe UI', Arial, sans-serif", "#FFFFFF", null, 0);
        ctx.restore();
    }

    function mpDrawEmojiBurst(x, y, emoji, t, a) {
        if (a === undefined) a = 1;
        var p = clamp(1 - t / 1.1, 0, 1);   // 0 → 1 across the life
        var rise = p * 26;
        var scale = 1 + Math.sin(p * Math.PI) * 0.45;
        ctx.save();
        ctx.globalAlpha = clamp(1.15 - p, 0, 1) * a;
        drawText(emoji, x, y - rise, "bold " + Math.round(20 * scale) + "px Arial", "#FFF", "#000", 3);
        ctx.restore();
    }

    function mpDrawGhosts() {
        if (!MP_URL || !mpConnected) return;
        var myDi = (typeof scrollOffset === "number") ? scrollOffset : 0;
        var myY = (player ? player.y : PLAYER_Y);
        for (var id in mpPeers) {
            var p = mpPeers[id];
            var rel = mpWrap(p.di - myDi);
            p.rel = rel;
            if (Math.abs(rel) >= MP_VIS) { p.onScreen = false; continue; }
            var gx = p.x;
            var gy = clamp(myY - rel * 0.55, -80, H + 80);
            p.sx = gx; p.sy = gy; p.onScreen = true;

            var a = clamp(p.vis, 0, 1);   // fade-in on first sight / fade-out on drop
            // TAG: the IT player's ghost wears a pulsing red halo so you know to run.
            var peerIsIt = (mpTag && !mpTag.over && !mpTag.itIsMe && mpTag.itPeer === id);
            if (peerIsIt) {
                var hp = 0.5 + 0.5 * Math.sin(mpClock * 7);
                ctx.save();
                ctx.globalAlpha = (0.45 + 0.4 * hp) * a;
                ctx.strokeStyle = "#FF1744"; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(gx, gy, mpGhostHalfH(p) + 12 + hp * 4, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = "rgba(255,23,68,0.12)"; ctx.fill();
                ctx.restore();
            }
            ctx.save();
            ctx.globalAlpha = 0.75 * a;
            if (p.m === 1) drawLuluTopDown(gx, gy, mpClock * 6, null);   // walking ghost
            else mpDrawGhostVehicle(gx, gy, p);
            ctx.restore();

            var topY = gy - mpGhostHalfH(p) - 6;
            mpDrawNametag(gx, topY, (peerIsIt ? "🏷 " : "") + p.name + (peerIsIt ? " · IT" : ""), a);
            if (p.emT > 0) mpDrawEmojiBurst(gx, topY - 16, p.emEmoji || "❤️", p.emT, a);
            else if (p.honkT > 0) mpDrawEmojiBurst(gx, topY - 16, "📣", p.honkT, a);
            else if (p.waveT > 0) mpDrawEmojiBurst(gx, topY - 16, "👋", p.waveT, a);
        }
        ctx.globalAlpha = 1;
    }

    // ── Menu button + name/room picker overlay ───────────────
    function mpMenuBtnRect() {
        // Onboarding lock: Shared Road is unreachable until the first Bubbe arrival.
        if (typeof save !== "undefined" && !save.cruiseUnlocked) return { x: -9999, y: -9999, w: 0, h: 0 };
        var baseY = menuBaseY();
        // Stack (synced with drawMenu + updateMenu): PLAY, STORY, SHOP|QUESTS row,
        // [DISTRACTED +48 if unlocked], then 🌐 SHARED ROAD. Quests share the SHOP
        // row now, so only distracted shoves this button down.
        var y = baseY + 194 + (save.distractedUnlocked ? 48 : 0);
        return { x: W / 2 - 110, y: y, w: 220, h: 44 };
    }

    // ── Cruise auto-connect ──────────────────────────────────
    // The default ▶ PLAY silently joins the EVERYONE lobby (non-blocking; the run
    // starts instantly and the socket resolves in the background). Respects an
    // explicit opt-out (save.mpAutoOff). Never called from STORY mode.
    function mpAutoConnect() {
        if (!MP_URL) return;
        if (save.mpAutoOff) return;              // player explicitly chose solo
        if (mpConnected || mpWant || mpSock) return;   // already on / trying
        try {
            if (!save.mpName) {
                save.mpName = CURATED_NAMES[Math.floor(Math.random() * CURATED_NAMES.length)];
                persistSave();
            }
            mpRoom = "lobby";                    // EVERYONE
            mpRoomKind = "everyone";
            mpConnect();                         // reuse the normal connect path
        } catch (e) { /* silent solo on any failure */ }
    }

    // One layout, shared by the draw + hit-test so they never drift apart.
    function mpPickerRects() {
        var panelX = 26, panelW = W - 52;           // 428
        var panelY = 74, panelH = 700;
        var r = { panelX: panelX, panelY: panelY, panelW: panelW, panelH: panelH,
                  names: [], slots: [], slotUp: [], slotDown: [] };
        var gx0 = panelX + 12;
        var colW = (panelW - 34) / 2;               // 197
        var gapX = 10;
        var gy0 = panelY + 84, cellH = 38, gapY = 6;
        for (var i = 0; i < CURATED_NAMES.length; i++) {
            var col = i % 2, row = Math.floor(i / 2);
            r.names.push({ x: gx0 + col * (colW + gapX), y: gy0 + row * (cellH + gapY),
                           w: colW, h: cellH, name: CURATED_NAMES[i] });
        }
        var gridBottom = gy0 + 6 * (cellH + gapY);
        var mbY = gridBottom + 12;
        r.everyone = { x: gx0, y: mbY, w: colW, h: 46 };
        r.friend = { x: gx0 + colW + gapX, y: mbY, w: colW, h: 46 };
        var slotsY = mbY + 60;
        var slotW = 62, slotGap = 10, slotsTotal = 4 * slotW + 3 * slotGap;
        var sx0 = W / 2 - slotsTotal / 2;
        for (var s = 0; s < 4; s++) {
            var sx = sx0 + s * (slotW + slotGap);
            r.slotUp.push({ x: sx, y: slotsY, w: slotW, h: 26 });
            r.slots.push({ x: sx, y: slotsY + 28, w: slotW, h: 40 });
            r.slotDown.push({ x: sx, y: slotsY + 70, w: slotW, h: 26 });
        }
        r.slotsY = slotsY;
        r.reroll = { x: W / 2 - 60, y: slotsY + 102, w: 120, h: 26 };
        var btnY = panelY + panelH - 60;
        r.connect = { x: gx0, y: btnY, w: colW, h: 48 };
        r.cancel = { x: gx0 + colW + gapX, y: btnY, w: colW, h: 48 };
        r.disconnect = { x: gx0, y: btnY, w: colW, h: 48 };
        r.race = { x: gx0, y: btnY - 58, w: colW * 2 + gapX, h: 48 };
        // TAG starter sits on its own row just above the race/switch button.
        r.tag = { x: gx0, y: btnY - 58 - 54, w: colW * 2 + gapX, h: 44 };
        r.close = { x: gx0 + colW + gapX, y: btnY, w: colW, h: 48 };
        return r;
    }

    // Friend-code wheel (▲ letter ▼ ×4 + 🎲 reroll). Shared by the disconnected
    // picker AND the connected switch panel so the two never drift apart.
    function mpDrawFriendSlots(r) {
        drawText("Tap a letter to change it", W / 2, r.slotsY - 12,
            "10px 'Segoe UI', Arial, sans-serif", "#B0A8C8", null, 0);
        for (var s = 0; s < 4; s++) {
            var up = r.slotUp[s], sl = r.slots[s], dn = r.slotDown[s];
            ctx.fillStyle = "#4A4270"; roundRect(up.x, up.y, up.w, up.h, 6); ctx.fill();
            drawText("▲", up.x + up.w / 2, up.y + up.h / 2, "bold 12px Arial", "#D1C4E9", null, 0);
            ctx.fillStyle = "#1F1A30"; roundRect(sl.x, sl.y, sl.w, sl.h, 6); ctx.fill();
            ctx.strokeStyle = "#7E57C2"; ctx.lineWidth = 2; roundRect(sl.x, sl.y, sl.w, sl.h, 6); ctx.stroke();
            drawText(String.fromCharCode(65 + mpCodeSlots[s]), sl.x + sl.w / 2, sl.y + sl.h / 2,
                "bold 24px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 3);
            ctx.fillStyle = "#4A4270"; roundRect(dn.x, dn.y, dn.w, dn.h, 6); ctx.fill();
            drawText("▼", dn.x + dn.w / 2, dn.y + dn.h / 2, "bold 12px Arial", "#D1C4E9", null, 0);
        }
        ctx.fillStyle = "#3B3357"; roundRect(r.reroll.x, r.reroll.y, r.reroll.w, r.reroll.h, 8); ctx.fill();
        drawText("🎲 new code", r.reroll.x + r.reroll.w / 2, r.reroll.y + r.reroll.h / 2,
            "bold 11px 'Segoe UI', Arial, sans-serif", "#D1C4E9", "#000", 2);
        drawText("Share this code with friends — or dial in theirs", W / 2, r.reroll.y + r.reroll.h + 14,
            "9px 'Segoe UI', Arial, sans-serif", "#B0A8C8", null, 0);
    }

    function mpDrawConnectedPanel(r) {
        var cy = r.panelY + 130;
        var connecting = !mpConnected;
        var switching = connecting && !!mpSwitchTo;
        drawText(switching ? "🔀 Switching…" : (connecting ? "… Connecting" : "✅ Connected"), W / 2, cy,
            "bold 24px 'Segoe UI', Arial, sans-serif", connecting ? "#FFD54F" : "#69F0AE", "#000", 4);
        if (switching) {
            drawText("→ " + mpSwitchTo, W / 2, cy + 24,
                "bold 14px 'Segoe UI', Arial, sans-serif", "#E1D5F5", "#000", 3);
        } else if (connecting && mpClock - mpWantSince > 5) {
            // Been trying a while → say so instead of spinning silently forever.
            drawText("Can't reach the road — still retrying.", W / 2, cy + 22,
                "11px 'Segoe UI', Arial, sans-serif", "#FFAB91", "#000", 2);
        }
        drawText("Room: " + mpRoomLabel(mpRoom), W / 2, cy + 48,
            "bold 15px 'Segoe UI', Arial, sans-serif", "#E1D5F5", "#000", 3);
        drawText("Riding as: " + mpMyName(), W / 2, cy + 72,
            "bold 14px 'Segoe UI', Arial, sans-serif", "#CFC4E8", "#000", 2);
        if (mpConnected) {
            drawText("🌐 " + mpRiderCount() + " riders on the road", W / 2, cy + 96,
                "bold 15px 'Segoe UI', Arial, sans-serif", "#80CBC4", "#000", 3);
            var pnames = mpPeerNames();
            for (var i = 0; i < pnames.length && i < 3; i++) {
                drawText("• " + pnames[i], W / 2, cy + 118 + i * 18,
                    "12px 'Segoe UI', Arial, sans-serif", "#B0A8C8", null, 0);
            }
        }
        // ── Switch room WITHOUT disconnecting (Feature 1) ──
        drawText("— Switch room —", W / 2, r.everyone.y - 14,
            "bold 10px 'Segoe UI', Arial, sans-serif", "#B39DDB", "#000", 2);
        drawButton(r.everyone.x, r.everyone.y, r.everyone.w, r.everyone.h, "🌍 EVERYONE",
            { bg: mpRoomKind === "everyone" ? "#26A69A" : "#546E7A",
              bgDark: mpRoomKind === "everyone" ? "#00695C" : "#37474F", small: true });
        drawButton(r.friend.x, r.friend.y, r.friend.w, r.friend.h, "🔑 FRIEND CODE",
            { bg: mpRoomKind === "friend" ? "#FF7043" : "#546E7A",
              bgDark: mpRoomKind === "friend" ? "#BF360C" : "#37474F", small: true });
        if (mpRoomKind === "friend") mpDrawFriendSlots(r);
        // The big button reads SWITCH when the form points at a DIFFERENT room;
        // otherwise the friend-room race starter sits in that slot as before.
        var target = mpTargetRoom();
        if (target !== mpRoom) {
            drawButton(r.race.x, r.race.y, r.race.w, r.race.h, "🔀 SWITCH TO " + mpRoomLabel(target),
                { bg: "#FFB300", bgDark: "#E65100", small: true });
        } else if (mpConnected && mpRoom !== "lobby" && !mpRace) {
            drawButton(r.race.x, r.race.y, r.race.w, r.race.h, "🏁 START RACE — first to " + (RACE_GOAL / 1000) + "k!",
                { bg: "#FFB300", bgDark: "#E65100", small: true });
        }
        // TAG starter (friend rooms, 2+ riders, no game running) — its own row.
        if (mpConnected && mpRoom !== "lobby" && target === mpRoom) {
            if (mpTag) {
                drawText("🏷 TAG in progress…", W / 2, r.tag.y + r.tag.h / 2,
                    "bold 12px 'Segoe UI', Arial, sans-serif", "#FF8A80", "#000", 3);
            } else if (mpPeerCount() >= 1) {
                drawButton(r.tag.x, r.tag.y, r.tag.w, r.tag.h, "🏷 TAG — 90s, don't be IT!",
                    { bg: "#EC407A", bgDark: "#AD1457", small: true });
            } else {
                drawText("🏷 TAG needs another rider in the room", W / 2, r.tag.y + r.tag.h / 2,
                    "11px 'Segoe UI', Arial, sans-serif", "#B0A8C8", null, 0);
            }
        }
        drawButton(r.disconnect.x, r.disconnect.y, r.disconnect.w, r.disconnect.h, "DISCONNECT",
            { bg: "#EF5350", bgDark: "#B71C1C" });
        drawButton(r.close.x, r.close.y, r.close.w, r.close.h, "CLOSE",
            { bg: "#90A4AE", bgDark: "#455A64", small: true });
    }

    // Party record toasts — top-center, stacked, gold on a dark pill. Drawn from
    // the same spots as the race UI (HUD + menu) so they show during play.
    function mpDrawToasts() {
        if (!MP_URL || !mpToasts.length) return;
        var shown = 0;
        for (var i = 0; i < mpToasts.length && shown < 2; i++) {
            var tt = mpToasts[i];
            var a = 1;
            if (tt.t < 0.25) a = tt.t / 0.25;
            else if (tt.t > 2.5) a = clamp(1 - (tt.t - 2.5) / 0.5, 0, 1);
            var txt = "🎉 " + tt.name + " set a record: " + formatNum(tt.score) + "!";
            var y = 100 + shown * 30;
            ctx.save();
            ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
            var tw = ctx.measureText(txt).width;
            var w = Math.min(tw + 22, W - 24), h = 24, x = W / 2 - w / 2;
            ctx.globalAlpha = 0.92 * a;
            ctx.fillStyle = "rgba(24,18,40,0.9)";
            roundRect(x, y, w, h, 12); ctx.fill();
            ctx.strokeStyle = "rgba(255,213,79,0.6)"; ctx.lineWidth = 1.5;
            roundRect(x, y, w, h, 12); ctx.stroke();
            ctx.globalAlpha = a;
            drawText(txt, W / 2, y + h / 2, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 3);
            ctx.restore();
            shown++;
        }
        ctx.globalAlpha = 1;
    }

    function mpDrawPicker() {
        var r = mpPickerRects();
        ctx.fillStyle = "rgba(0,0,0,0.72)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#2B2540";
        roundRect(r.panelX, r.panelY, r.panelW, r.panelH, 18); ctx.fill();
        ctx.strokeStyle = "#7E57C2"; ctx.lineWidth = 3;
        roundRect(r.panelX, r.panelY, r.panelW, r.panelH, 18); ctx.stroke();
        drawText("🌐 SHARED ROAD", W / 2, r.panelY + 30,
            "bold 22px 'Segoe UI', Arial, sans-serif", "#B39DDB", "#000", 4);

        if (mpWant) { mpDrawConnectedPanel(r); return; }

        drawText("Pick your rider name", W / 2, r.panelY + 58,
            "bold 13px 'Segoe UI', Arial, sans-serif", "#E1D5F5", "#000", 3);
        // Curated name grid (12 names, 2 columns)
        for (var i = 0; i < r.names.length; i++) {
            var c = r.names[i];
            var sel = (save.mpName === c.name);
            ctx.fillStyle = sel ? "#7E57C2" : "#3B3357";
            roundRect(c.x, c.y, c.w, c.h, 9); ctx.fill();
            if (sel) { ctx.strokeStyle = "#FFD54F"; ctx.lineWidth = 2; roundRect(c.x, c.y, c.w, c.h, 9); ctx.stroke(); }
            drawText(c.name, c.x + c.w / 2, c.y + c.h / 2,
                "bold 12px 'Segoe UI', Arial, sans-serif", sel ? "#FFFFFF" : "#CFC4E8", "#000", sel ? 3 : 0);
        }
        // Mode buttons
        drawButton(r.everyone.x, r.everyone.y, r.everyone.w, r.everyone.h, "🌍 EVERYONE",
            { bg: mpRoomKind === "everyone" ? "#26A69A" : "#546E7A",
              bgDark: mpRoomKind === "everyone" ? "#00695C" : "#37474F", small: true });
        drawButton(r.friend.x, r.friend.y, r.friend.w, r.friend.h, "🔑 FRIEND CODE",
            { bg: mpRoomKind === "friend" ? "#FF7043" : "#546E7A",
              bgDark: mpRoomKind === "friend" ? "#BF360C" : "#37474F", small: true });
        // Friend-code slots (tap letter or ▲▼ to cycle — no keyboard)
        if (mpRoomKind === "friend") mpDrawFriendSlots(r);
        // Connect / Cancel
        drawButton(r.connect.x, r.connect.y, r.connect.w, r.connect.h, "CONNECT",
            { bg: "#66BB6A", bgDark: "#2E7D32" });
        drawButton(r.cancel.x, r.cancel.y, r.cancel.w, r.cancel.h, "CANCEL",
            { bg: "#90A4AE", bgDark: "#455A64", small: true });
    }

    function mpMenuButton() {
        if (!MP_URL) return;
        if (typeof save !== "undefined" && !save.cruiseUnlocked) return;   // onboarding: 🌐 hidden until first arrival
        var b = mpMenuBtnRect();
        // Three honest states: idle / trying (pulsing amber) / online (teal).
        var lbl, bg, bgD;
        if (mpConnected) { lbl = "🌐 ONLINE · " + mpRiderCount(); bg = "#26A69A"; bgD = "#00695C"; }
        else if (mpWant) {
            var dots = ["·", "··", "···"][Math.floor((gameTime * 2) % 3)];
            lbl = "🌐 CONNECTING " + dots; bg = "#FFB300"; bgD = "#E65100";
        }
        else { lbl = "🌐 SHARED ROAD"; bg = "#7E57C2"; bgD = "#4527A0"; }
        drawButton(b.x, b.y, b.w, b.h, lbl, { bg: bg, bgDark: bgD, small: true });
        if (mpPickerOpen) mpDrawPicker();
        mpDrawRace();   // races stay visible on the menu too (countdown/banner)
        if (!mpPickerOpen) mpDrawTag();      // tag banner / results visible on the menu too
        if (!mpPickerOpen) mpDrawToasts();   // record toasts (not under the scrim)
    }

    function mpHandlePickerClick(click) {
        var r = mpPickerRects();
        var cx = click.x, cy = click.y;
        function tap() { if (typeof playClick === "function") playClick(); }

        if (mpWant) {   // connected / connecting panel — also the room switcher
            // Re-pick the room kind (EVERYONE | FRIEND CODE) for a switch.
            if (pointInRect(cx, cy, r.everyone.x, r.everyone.y, r.everyone.w, r.everyone.h)) { mpRoomKind = "everyone"; tap(); return; }
            if (pointInRect(cx, cy, r.friend.x, r.friend.y, r.friend.w, r.friend.h)) { mpRoomKind = "friend"; tap(); return; }
            if (mpRoomKind === "friend") {
                for (var fs = 0; fs < 4; fs++) {
                    if (pointInRect(cx, cy, r.slotUp[fs].x, r.slotUp[fs].y, r.slotUp[fs].w, r.slotUp[fs].h)) { mpCodeSlots[fs] = (mpCodeSlots[fs] + 1) % 26; tap(); return; }
                    if (pointInRect(cx, cy, r.slots[fs].x, r.slots[fs].y, r.slots[fs].w, r.slots[fs].h)) { mpCodeSlots[fs] = (mpCodeSlots[fs] + 1) % 26; tap(); return; }
                    if (pointInRect(cx, cy, r.slotDown[fs].x, r.slotDown[fs].y, r.slotDown[fs].w, r.slotDown[fs].h)) { mpCodeSlots[fs] = (mpCodeSlots[fs] + 25) % 26; tap(); return; }
                }
                if (pointInRect(cx, cy, r.reroll.x, r.reroll.y, r.reroll.w, r.reroll.h)) { mpRerollCode(); tap(); return; }
            }
            // The r.race slot is SWITCH when the form points at a different room,
            // else the friend-room race starter — mirror the draw's branching.
            var target = mpTargetRoom();
            if (pointInRect(cx, cy, r.race.x, r.race.y, r.race.w, r.race.h)) {
                if (target !== mpRoom) { mpSwitchRoom(target, mpRoomKind); tap(); return; }
                if (mpConnected && mpRoom !== "lobby" && !mpRace) { mpRaceStart(); tap(); return; }
            }
            // TAG starter (only when the form points at the CURRENT room, 2+ riders).
            if (target === mpRoom && mpConnected && mpRoom !== "lobby" && !mpTag && mpPeerCount() >= 1 &&
                pointInRect(cx, cy, r.tag.x, r.tag.y, r.tag.w, r.tag.h)) { mpTagStart(); tap(); return; }
            if (pointInRect(cx, cy, r.disconnect.x, r.disconnect.y, r.disconnect.w, r.disconnect.h)) {
                // Explicit choice: stay solo — cruise won't silently reconnect.
                mpDisconnect(); save.mpAutoOff = true; persistSave(); tap(); return;
            }
            if (pointInRect(cx, cy, r.close.x, r.close.y, r.close.w, r.close.h)) { mpPickerOpen = false; tap(); return; }
            return;
        }
        // Name grid
        for (var i = 0; i < r.names.length; i++) {
            var c = r.names[i];
            if (pointInRect(cx, cy, c.x, c.y, c.w, c.h)) { save.mpName = c.name; persistSave(); tap(); return; }
        }
        // Mode
        if (pointInRect(cx, cy, r.everyone.x, r.everyone.y, r.everyone.w, r.everyone.h)) { mpRoomKind = "everyone"; tap(); return; }
        if (pointInRect(cx, cy, r.friend.x, r.friend.y, r.friend.w, r.friend.h)) { mpRoomKind = "friend"; tap(); return; }
        // Friend-code slots
        if (mpRoomKind === "friend") {
            for (var s = 0; s < 4; s++) {
                if (pointInRect(cx, cy, r.slotUp[s].x, r.slotUp[s].y, r.slotUp[s].w, r.slotUp[s].h)) { mpCodeSlots[s] = (mpCodeSlots[s] + 1) % 26; tap(); return; }
                if (pointInRect(cx, cy, r.slots[s].x, r.slots[s].y, r.slots[s].w, r.slots[s].h)) { mpCodeSlots[s] = (mpCodeSlots[s] + 1) % 26; tap(); return; }
                if (pointInRect(cx, cy, r.slotDown[s].x, r.slotDown[s].y, r.slotDown[s].w, r.slotDown[s].h)) { mpCodeSlots[s] = (mpCodeSlots[s] + 25) % 26; tap(); return; }
                if (pointInRect(cx, cy, r.reroll.x, r.reroll.y, r.reroll.w, r.reroll.h)) { mpRerollCode(); tap(); return; }
            }
        }
        // Connect
        if (pointInRect(cx, cy, r.connect.x, r.connect.y, r.connect.w, r.connect.h)) {
            if (!save.mpName) { save.mpName = CURATED_NAMES[0]; persistSave(); }
            save.mpAutoOff = false; persistSave();   // opting IN re-enables cruise auto-connect
            if (mpRoomKind === "friend") {
                var code = "";
                for (var k = 0; k < 4; k++) code += String.fromCharCode(65 + mpCodeSlots[k]);
                mpRoom = code;
            } else {
                mpRoom = "lobby";
            }
            mpConnect();
            tap();
            return;
        }
        // Cancel
        if (pointInRect(cx, cy, r.cancel.x, r.cancel.y, r.cancel.w, r.cancel.h)) { mpPickerOpen = false; tap(); return; }
    }

    // Returns true iff the click was consumed. Called with `null` as a probe:
    // return true iff the overlay is open (blocks the menu's keyboard-start).
    function mpMenuClick(click) {
        if (!MP_URL) return false;
        if (typeof save !== "undefined" && !save.cruiseUnlocked) return false;   // onboarding: picker unreachable
        if (!click) return mpPickerOpen;
        if (mpPickerOpen) { mpHandlePickerClick(click); return true; }  // scrim swallows all
        var b = mpMenuBtnRect();
        if (pointInRect(click.x, click.y, b.x, b.y, b.w, b.h)) {
            mpPickerOpen = true;
            if (typeof playClick === "function") playClick();
            return true;
        }
        return false;
    }

    // Tiny "🌐 n riders" chip for the driving / on-foot HUDs (top-center,
    // unobtrusive, only while connected).
    function mpStatusChip() {
        if (!MP_URL) return;
        mpDrawRace();   // countdown / standings / winner banner over the HUD
        mpDrawTag();    // TAG banner / results card over the HUD
        if (!mpConnected) return;
        var n = mpRiderCount();
        var txt = "🌐 " + n + (n === 1 ? " rider" : " riders");
        ctx.save();
        ctx.font = "bold 11px 'Segoe UI', Arial, sans-serif";
        var tw = ctx.measureText(txt).width;
        // Just BELOW the top HUD strip, centered — the strip's center is taken by
        // the lives hearts (driving) / title, so tuck the chip under it.
        var w = tw + 18, h = 20, x = W / 2 - w / 2, y = 54;
        // Brief bulge + warm glow ring when the rider count just changed.
        var pulse = clamp(mpChipPulse, 0, 1);
        if (pulse > 0.001) {
            var sc = 1 + 0.16 * Math.sin(pulse * Math.PI);
            ctx.translate(W / 2, y + h / 2); ctx.scale(sc, sc); ctx.translate(-(W / 2), -(y + h / 2));
            ctx.globalAlpha = 0.55 * pulse;
            ctx.strokeStyle = "#FFECB3"; ctx.lineWidth = 2.5;
            roundRect(x - 3, y - 3, w + 6, h + 6, 12); ctx.stroke();
        }
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = "rgba(38,166,154,0.85)";
        roundRect(x, y, w, h, 10); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.30)"; ctx.lineWidth = 1;
        roundRect(x, y, w, h, 10); ctx.stroke();
        ctx.globalAlpha = 1;
        drawText(txt, W / 2, y + h / 2, "bold 11px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#004D40", 2);
        ctx.restore();

        // Convoy bonus chip (pulsing gently) tucked just under the rider chip.
        if (convoyActive) {
            var ctxt = "🚗🚗 ×1.5";
            ctx.save();
            ctx.font = "bold 11px 'Segoe UI', Arial, sans-serif";
            var ctw = ctx.measureText(ctxt).width;
            var cw = ctw + 16, ch = 18, cxp = W / 2 - cw / 2, cyp = y + h + 4;
            var cpulse = 0.85 + 0.15 * Math.sin(mpClock * 5);
            ctx.globalAlpha = 0.9 * cpulse;
            ctx.fillStyle = "rgba(46,125,50,0.9)";
            roundRect(cxp, cyp, cw, ch, 9); ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
            roundRect(cxp, cyp, cw, ch, 9); ctx.stroke();
            ctx.globalAlpha = 1;
            drawText(ctxt, W / 2, cyp + ch / 2, "bold 11px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#1B5E20", 2);
            ctx.restore();
        }

        // Stacked status chips below the convoy row: slipstream + tag.
        var chipY = y + h + 4 + (convoyActive ? 22 : 0);
        if (mpDraftActive) {
            chipY = mpDrawMiniChip("💨 SLIPSTREAM", chipY, "rgba(2,119,189,0.9)", "#01579B");
        }
        if (mpTag && !mpTag.over) {
            var left = Math.max(0, Math.ceil((mpTag.dur || MP_TAG_DUR) - mpTag.t));
            var tTxt = mpTag.itIsMe
                ? "🏷 TAG — you're IT! " + left + "s"
                : "🏷 TAG — avoid " + mpTagItName() + "! " + left + "s";
            mpDrawMiniChip(tTxt, chipY, mpTag.itIsMe ? "rgba(198,40,40,0.92)" : "rgba(84,110,122,0.92)",
                mpTag.itIsMe ? "#B71C1C" : "#37474F");
        }

        mpDrawToasts();   // party record toasts, top-center over the HUD
    }

    // A small centered pill chip (used by the slipstream + tag status rows).
    // Returns the y for the NEXT chip below it.
    function mpDrawMiniChip(txt, cyp, bg, shadow) {
        ctx.save();
        ctx.font = "bold 11px 'Segoe UI', Arial, sans-serif";
        var ctw = ctx.measureText(txt).width;
        var cw = ctw + 16, ch = 18, cxp = W / 2 - cw / 2;
        var pulse = 0.85 + 0.15 * Math.sin(mpClock * 5);
        ctx.globalAlpha = 0.92 * pulse;
        ctx.fillStyle = bg;
        roundRect(cxp, cyp, cw, ch, 9); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
        roundRect(cxp, cyp, cw, ch, 9); ctx.stroke();
        ctx.globalAlpha = 1;
        drawText(txt, W / 2, cyp + ch / 2, "bold 11px 'Segoe UI', Arial, sans-serif", "#FFFFFF", shadow, 2);
        ctx.restore();
        return cyp + ch + 4;
    }

    // ════════════════════════════════════════════════════════
    // ═══════════ PARTY WAVE 2 — logic + rendering ════════════
    // ════════════════════════════════════════════════════════

    // ── BONK! (Feature 1) ────────────────────────────────────
    // My car overlapping a peer ghost bounces me laterally (comedy physics, no
    // damage). Also the contact that PASSES the tag marker during a TAG game.
    function mpSpawnBonkSparkle(x, y) {
        if (typeof particles === "undefined") return;
        for (var i = 0; i < 10; i++) {
            var ang = (Math.PI * 2 / 10) * i + rand(-0.2, 0.2);
            var spd = rand(80, 200);
            particles.push({ x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
                life: rand(0.3, 0.5), maxLife: 0.5, size: rand(2, 5),
                color: randPick(["#FFF176", "#FFD54F", "#FFFFFF", "#FFAB40"]), gravity: 60 });
        }
    }
    function mpBonkUpdate(dt) {
        if (!mpConnected || mpRoom === "lobby") return;   // friend rooms only
        if (state !== "playing") return;                  // driving only (footRun excluded)
        if (typeof player === "undefined" || !player) return;
        var myDi = (typeof scrollOffset === "number") ? scrollOffset : 0;
        var myY = player.y;
        var cw2 = (typeof CAR_W === "number") ? CAR_W : 46;
        var roadL = (typeof ROAD_L === "number") ? ROAD_L : 40;
        var roadR = (typeof ROAD_R === "number") ? ROAD_R : W - 40;
        for (var id in mpPeers) {
            var p = mpPeers[id];
            if (p.m !== 0) { p.bonkOverlap = false; continue; }   // both must be driving (m=0)
            var rel = mpWrap(p.di - myDi);
            if (Math.abs(rel) >= MP_VIS) { p.bonkOverlap = false; continue; }
            var gx = p.x;
            var gy = clamp(myY - rel * 0.55, -80, H + 80);
            var dx = Math.abs(gx - player.x), dy = Math.abs(gy - player.y);
            var overlap = (dx < 44 && dy < 60);
            var tagOverlap = (dx < 54 && dy < 70);   // slightly bigger box for a tag pass
            // TAG pass takes precedence (but the bounce still fires too — feels right).
            // The tagGuard (set on every marker change) blocks instant tag-backs.
            if (tagOverlap && mpTag && !mpTag.over && !mpTag.itIsMe && mpTag.itPeer === id &&
                mpClock > (mpTag.tagGuardUntil || 0)) mpTagBecomeIt();
            if (overlap && !p.bonkOverlap && (!p.bonkCd || p.bonkCd <= 0)) {
                var dir = (player.x >= gx) ? 1 : -1;   // shove AWAY from the ghost
                player.targetX = clamp(player.targetX + dir * 54, roadL + cw2 / 2 + 4, roadR - cw2 / 2 - 4);
                if (typeof player.tilt === "number") player.tilt += dir * 0.22;
                p.bonkCd = 0.6;                        // per-peer cooldown (no machine-gunning)
                var contactX = (player.x + gx) / 2, contactY = (player.y + gy) / 2;
                if (typeof spawnFloater === "function") spawnFloater(contactX, contactY - 10, "BONK!", "#FFD54F");
                mpSpawnBonkSparkle(contactX, contactY);
                try { playTone(150, 0.12, "square", 0.22, 90); } catch (e) {}
                if (typeof Haptic !== "undefined") Haptic.medium("bonk");
            }
            p.bonkOverlap = overlap;
        }
    }

    // ── SLIPSTREAM (Feature 2) ───────────────────────────────
    function mpDraftUpdate(dt) {
        var eligible = (mpConnected && mpRoom !== "lobby" && state === "playing" &&
                        typeof player !== "undefined" && player);
        if (eligible) {
            var myDi = (typeof scrollOffset === "number") ? scrollOffset : 0;
            var inWin = false;
            for (var id in mpPeers) {
                var p = mpPeers[id];
                if (p.m !== 0) continue;
                var rel = mpWrap(p.di - myDi);          // >0 = the friend is AHEAD of me
                if (rel > 120 && rel < 420 && Math.abs(p.x - player.x) < 34) { inWin = true; break; }
            }
            if (inWin) {
                mpDraftGrace = 0; mpDraftT += dt;
                if (!mpDraftActive && mpDraftT >= 1) {
                    mpDraftActive = true;
                    try { playTone(520, 0.16, "sine", 0.14, 900); } catch (e) {}
                    if (typeof Haptic !== "undefined") Haptic.light("draft");
                    if (typeof spawnFloater === "function") spawnFloater(player.x, player.y - 60, "💨 SLIPSTREAM!", "#4FC3F7");
                }
            } else if (mpDraftActive) {
                mpDraftGrace += dt;
                if (mpDraftGrace >= 0.7) { mpDraftActive = false; mpDraftT = 0; mpDraftGrace = 0; }
            } else {
                mpDraftT = 0;
            }
        } else {
            mpDraftActive = false; mpDraftT = 0; mpDraftGrace = 0;
        }
    }

    // ── TAG (Feature 3) ──────────────────────────────────────
    function mpTagNewId() {
        var base = Math.floor(mpClock * 1000) & 0x7fffff;
        var idh = mpMyId ? (mpHashStr(mpMyId) & 0xff) : ((Math.random() * 256) | 0);
        return (base * 256 + idh) >>> 0;
    }
    function mpTagInit(gid) {
        mpTag = { gid: gid, n: 0, itIsMe: false, itPeer: null, t: 0, dur: MP_TAG_DUR,
                  myItTime: 0, participants: {}, tgoAt: -1e9, over: false,
                  resultsSentAt: -1, resultsT: 0, results: {}, wonTone: false,
                  tagGuardUntil: mpClock + 1.2 };   // brief no-tag-backs grace after any marker change
        return mpTag;
    }
    function mpTagStart() {                              // panel button — I become IT
        if (!mpConnected || mpRoom === "lobby") return;
        var g = mpTagInit(mpTagNewId());
        g.n = 1; g.itIsMe = true; g.itPeer = null; g.tgoAt = mpClock;
        if (mpMyId) g.participants[mpMyId] = 1;
        mpForceSends = Math.max(mpForceSends, 5);        // shout marker + announce now
        mpPickerOpen = false;
        mpTagBanner = { text: "🏷 TAG! You're IT", sub: "Bump a friend to pass it — 90s!", t: 0 };
        try { playTone(392, 0.12, "square", 0.16); setTimeout(function () { playTone(523, 0.14, "triangle", 0.16); }, 130); } catch (e) {}
        if (typeof Haptic !== "undefined") Haptic.heavy("tagstart");
    }
    function mpTagLearn(id, gid) {                       // d.tgo announce
        if (mpTag) { if (mpTag.gid === gid) { mpTag.participants[id] = 1; if (mpMyId) mpTag.participants[mpMyId] = 1; } return; }
        mpTagInit(gid);
        mpTag.participants[id] = 1; if (mpMyId) mpTag.participants[mpMyId] = 1;
        mpTagBanner = { text: "🏷 TAG started!", sub: "Avoid whoever's IT — 90s!", t: 0 };
        try { playTone(440, 0.1, "square", 0.14); } catch (e) {}
    }
    function mpTagApplyMarker(id, n, gid) {              // d.it marker from the IT player
        if (!mpTag) mpTagInit(gid);
        else if (mpTag.gid !== gid) return;             // a different live game — ignore
        mpTag.participants[id] = 1; if (mpMyId) mpTag.participants[mpMyId] = 1;
        if (n > mpTag.n) {
            mpTag.n = n; mpTag.itIsMe = false; mpTag.itPeer = id;
            mpTag.tagGuardUntil = mpClock + 1.2;         // I just learned a new IT — no instant tag-back
        }
        else if (n === mpTag.n) {                        // tie self-heal: higher peer id wins
            if (mpTag.itIsMe) { if (mpMyId && id > mpMyId) { mpTag.itIsMe = false; mpTag.itPeer = id; } }
            else if (mpTag.itPeer !== id) { mpTag.itPeer = (mpTag.itPeer && id > mpTag.itPeer) ? id : (mpTag.itPeer || id); }
        }
        // n < mpTag.n → stale, ignore.
    }
    function mpTagBecomeIt() {                           // I got bumped by the IT player
        if (!mpTag || mpTag.over || mpTag.itIsMe) return;
        mpTag.n += 1; mpTag.itIsMe = true; mpTag.itPeer = null;
        mpForceSends = Math.max(mpForceSends, 5);
        mpTagBanner = { text: "YOU'RE IT! 🏷", sub: "Pass it back — bump a friend!", t: 0 };
        try { playTone(311, 0.14, "square", 0.2); setTimeout(function () { playTone(415, 0.16, "sawtooth", 0.18); }, 120); } catch (e) {}
        if (typeof Haptic !== "undefined") Haptic.heavy("tagged");
    }
    function mpTagBroadcastResults() {
        if (!mpTag) return;
        mpTag.resultsSentAt = mpClock;
        if (mpMyId) mpTag.results[mpMyId] = { name: mpMyName() + " (you)", secs: Math.round(mpTag.myItTime) };
        mpForceSends = Math.max(mpForceSends, 5);
    }
    function mpTagUpdate(dt) {
        if (!mpTag) return;
        if (!mpConnected || mpRoom === "lobby") { mpTag = null; return; }   // eligibility lost
        if (!mpTag.over) {
            mpTag.t += dt;
            if (mpTag.itIsMe) mpTag.myItTime += dt;
            if (mpTag.t >= (mpTag.dur || MP_TAG_DUR)) {
                mpTag.over = true; mpTag.resultsT = 0;
                mpTagBroadcastResults();
                try { playTone(523, 0.16, "triangle", 0.18); } catch (e) {}
            }
        } else {
            mpTag.resultsT += dt;
            if (mpTag.resultsT > 8) mpTag = null;         // results shown → clear all state
        }
    }
    function mpTagItName() {
        if (!mpTag) return "a rider";
        if (mpTag.itIsMe) return mpMyName();
        var p = mpPeers[mpTag.itPeer];
        return p ? p.name : "a rider";
    }
    function mpDrawTag() {
        if (!MP_URL || !mpTag) return;
        // Brief tag banner (started / you're it / tagged).
        if (mpTagBanner) {
            var ba = (mpTagBanner.t < 0.2) ? mpTagBanner.t / 0.2 : clamp(1 - (mpTagBanner.t - 1.8) / 0.6, 0, 1);
            ctx.save(); ctx.globalAlpha = clamp(ba, 0, 1);
            drawText(mpTagBanner.text, W / 2, H * 0.34, "bold 30px 'Segoe UI', Arial, sans-serif", "#FF5252", "#000", 6);
            drawText(mpTagBanner.sub, W / 2, H * 0.34 + 30, "bold 14px 'Segoe UI', Arial, sans-serif", "#FFE0B2", "#000", 3);
            ctx.restore();
        }
        if (!mpTag.over) return;
        // Results card — least it-time wins; missing reporters show "?".
        var rows = [];
        for (var pid in mpTag.results) rows.push(mpTag.results[pid]);
        for (var q in mpTag.participants) {
            if (mpTag.results[q] || q === mpMyId) continue;
            var pp = mpPeers[q];
            rows.push({ name: pp ? pp.name : "Rider", secs: null });
        }
        rows.sort(function (a, b) {
            var av = (a.secs === null) ? 1e9 : a.secs, bv = (b.secs === null) ? 1e9 : b.secs;
            return av - bv;
        });
        var n = Math.min(rows.length, 6);
        var cardW = 264, rowH = 26, cardH = 66 + n * rowH;
        var cx = W / 2 - cardW / 2, cy = H * 0.22;
        var appear = clamp(mpTag.resultsT / 0.3, 0, 1);
        ctx.save(); ctx.globalAlpha = appear;
        ctx.fillStyle = "rgba(20,16,40,0.94)";
        roundRect(cx, cy, cardW, cardH, 16); ctx.fill();
        ctx.strokeStyle = "#FF5252"; ctx.lineWidth = 3;
        roundRect(cx, cy, cardW, cardH, 16); ctx.stroke();
        drawText("🏷 TAG — FINAL", W / 2, cy + 22, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 4);
        drawText("least time as IT wins", W / 2, cy + 42, "11px 'Segoe UI', Arial, sans-serif", "#B0A8C8", null, 0);
        for (var i = 0; i < n; i++) {
            var rr = rows[i], ry = cy + 58 + i * rowH, mid = ry + rowH / 2;
            var win = (i === 0 && rr.secs !== null);
            drawText((win ? "🏆 " : (i + 1) + ". ") + rr.name, cx + 14, mid,
                "bold 12px 'Segoe UI', Arial, sans-serif", win ? "#FFE082" : "#E1D5F5", "#000", 2, "left");
            drawText(rr.secs === null ? "?" : rr.secs + "s", cx + cardW - 14, mid,
                "bold 12px 'Segoe UI', Arial, sans-serif", win ? "#7CFC4F" : "#CFC4E8", "#000", 2, "right");
        }
        ctx.restore();
        if (!mpTag.wonTone && mpTag.resultsT > 0.3) {
            mpTag.wonTone = true;
            try { playTone(523, 0.12, "triangle", 0.18); setTimeout(function () { playTone(784, 0.16, "triangle", 0.18); }, 120); } catch (e) {}
        }
    }

    // ── EMOTE WHEEL (Feature 4) ──────────────────────────────
    // The 6 slots fan into the upper-left quadrant of the (movable, LIVE-read)
    // honk button so they always land on-screen.
    function mpEmoteSlots() {
        var r = (typeof HONK_RECT !== "undefined" && HONK_RECT) ? HONK_RECT : { x: W - 78, y: H - 168, w: 64, h: 64 };
        var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        var R = 100, slots = [];   // wide enough that the 6 slots don't crowd each other
        var a0 = -92 * Math.PI / 180, a1 = -208 * Math.PI / 180;   // up → left (screen y down)
        for (var i = 0; i < EMOTES.length; i++) {
            var t = (EMOTES.length === 1) ? 0 : i / (EMOTES.length - 1);
            var ang = a0 + (a1 - a0) * t;
            slots.push({ x: clamp(cx + Math.cos(ang) * R, 30, W - 30),
                         y: clamp(cy + Math.sin(ang) * R, 30, H - 30), emoji: EMOTES[i], idx: i });
        }
        return slots;
    }
    function mpSendEmote(idx) {
        mpEmoteNonce++;
        mpMyEmote = { n: mpEmoteNonce, idx: idx, at: mpClock };
        if (mpForceSends < 2) mpForceSends = 2;
        mpMyBurstEmoji = EMOTES[idx] || "❤️"; mpMyBurstT = 1.1;
        try { playTone(660, 0.1, "triangle", 0.16, 900); } catch (e) {}
        if (typeof Haptic !== "undefined") Haptic.light("emote");
    }
    // Runs from mpUpdate (BEFORE updatePlaying) so a wheel tap can't leak into
    // steering / honk / weapons. Peeks + consumes clickQueue like other overlays.
    function mpEmoteUpdate(dt) {
        if (!emoteWheelOpen) return;
        emoteWheelT += dt;
        if (state !== "playing") { emoteWheelOpen = false; emoteWheelT = 0; return; }
        // A quick honk-button re-tap while open = center tap → close (no honk).
        if (typeof honkQueued !== "undefined" && honkQueued) { honkQueued = false; emoteWheelOpen = false; emoteWheelT = 0; return; }
        var click = (typeof clickQueue !== "undefined") ? clickQueue : null;
        if (click) {
            clickQueue = null;
            if (typeof actionQueued !== "undefined") actionQueued = false;
            steerTouchId = null; touchX = null; touchY = null;   // kill any drag-steer this tap began
            // Pick the NEAREST slot within reach (not the first match — slot hit
            // discs can overlap, and first-match would bias toward low indices).
            var slots = mpEmoteSlots(), hit = -1, best = 42 * 42;
            for (var i = 0; i < slots.length; i++) {
                var s = slots[i], ddx = click.x - s.x, ddy = click.y - s.y, d2 = ddx * ddx + ddy * ddy;
                if (d2 < best) { best = d2; hit = i; }
            }
            if (hit >= 0) mpSendEmote(hit);
            emoteWheelOpen = false; emoteWheelT = 0;
            return;
        }
        if (emoteWheelT > 3) { emoteWheelOpen = false; emoteWheelT = 0; }
    }
    function mpDrawEmoteWheel() {
        if (!emoteWheelOpen) return;
        var r = (typeof HONK_RECT !== "undefined" && HONK_RECT) ? HONK_RECT : { x: W - 78, y: H - 168, w: 64, h: 64 };
        var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        var slots = mpEmoteSlots();
        ctx.save();
        ctx.globalAlpha = 0.28; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        for (var i = 0; i < slots.length; i++) {
            var s = slots[i];
            ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(s.x, s.y); ctx.stroke();
            var pop = 1 + 0.08 * Math.sin(mpClock * 6 + i);
            ctx.beginPath(); ctx.arc(s.x, s.y, 25 * pop, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(43,37,64,0.96)"; ctx.fill();
            ctx.strokeStyle = "#7E57C2"; ctx.lineWidth = 2.5; ctx.stroke();
            drawText(s.emoji, s.x, s.y + 1, "24px Arial", "#FFFFFF", null, 0);
        }
        ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(126,87,194,0.96)"; ctx.fill();
        drawText("📣", cx, cy + 1, "20px Arial", "#FFFFFF", null, 0);
        ctx.restore();
        drawText("tap an emote · tap away to close", W / 2, 44,
            "bold 11px 'Segoe UI', Arial, sans-serif", "#E1D5F5", "#000", 3);
    }

    // Screen-space party FX over the HUD (driving only). Called after drawHUD.
    function mpDrawHudOverlay() {
        if (!MP_URL || state !== "playing") return;
        var havePlayer = (typeof player !== "undefined" && player);
        // My own IT halo — obvious I'm the one to avoid.
        if (mpTag && !mpTag.over && mpTag.itIsMe && havePlayer) {
            var hp = 0.5 + 0.5 * Math.sin(mpClock * 7);
            ctx.save(); ctx.globalAlpha = 0.45 + 0.4 * hp;
            ctx.strokeStyle = "#FF1744"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(player.x, player.y, 46 + hp * 5, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = "rgba(255,23,68,0.10)"; ctx.fill();
            ctx.restore();
            drawText("🏷 IT", player.x, player.y - 56, "bold 14px 'Segoe UI', Arial, sans-serif", "#FF5252", "#000", 4);
        }
        // Slipstream wind-lines streaming past my car while drafting.
        if (mpDraftActive && havePlayer) {
            ctx.save();
            ctx.globalAlpha = 0.5; ctx.strokeStyle = "#B3E5FC"; ctx.lineWidth = 2; ctx.lineCap = "round";
            for (var i = 0; i < 6; i++) {
                var off = ((mpClock * 900 + i * 130) % 240);
                var lx = player.x + (i % 2 ? 1 : -1) * (18 + (i * 7) % 26);
                var ly = player.y - 60 + off;
                ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + 22); ctx.stroke();
            }
            ctx.restore();
        }
        // My emote burst (big) over my car.
        if (mpMyBurstT > 0 && mpMyBurstEmoji && havePlayer) {
            var qv = clamp(1 - mpMyBurstT / 1.1, 0, 1);
            ctx.save(); ctx.globalAlpha = clamp(1.15 - qv, 0, 1);
            var sc = 1 + Math.sin(qv * Math.PI) * 0.7;
            drawText(mpMyBurstEmoji, player.x, player.y - 50 - qv * 34, "bold " + Math.round(30 * sc) + "px Arial", "#FFFFFF", "#000", 4);
            ctx.restore();
        }
        // The radial emote wheel on top of everything.
        mpDrawEmoteWheel();
    }

    // ════════════════════════════════════════════════════════
    // ═══════════ ASYNC BOARD — wanted posters + leaderboard ══
    // ════════════════════════════════════════════════════════
    // A single global Durable Object reached over plain HTTPS (same Worker, new
    // /board/* routes). Every call here is fire-and-forget + try/caught, and every
    // POST is gated on the player having OPTED IN this session (mpEverConnected);
    // GETs only run once a rider name has ever been chosen (save.mpName). Offline
    // and never-joined players are never published and never fetch.

    // The board lives on the same host as the socket, over HTTP(S): ws→http, wss→https.
    function mpHttpBase() {
        if (!MP_URL) return "";
        return MP_URL.replace(/^ws/, "http");
    }

    // POST her name + top-3 charges (by severity) when she's jailed.
    function mpPostWanted(charges) {
        if (!MP_URL || !mpEverConnected || !save.mpName) return;
        if (!charges || !charges.length) return;
        try {
            var list = charges.slice();
            if (typeof chargeWeight === "function") {
                list.sort(function (a, b) { return chargeWeight(b) - chargeWeight(a); });
            }
            list = list.slice(0, 3);
            fetch(mpHttpBase() + "/board/wanted", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: save.mpName, charges: list })
            }).then(function () { mpWantedCache.t = -1e9; })["catch"](function () {});
        } catch (e) {}
    }

    // POST the final score once per run at game over.
    function mpPostScore() {
        if (mpScorePosted) return;
        mpScorePosted = true;   // guard first — one attempt per run no matter what
        if (!MP_URL || !mpEverConnected || !save.mpName) return;
        try {
            var sc = Math.round(typeof score === "number" ? score : 0);
            if (sc < 0) sc = 0;
            fetch(mpHttpBase() + "/board/score", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: save.mpName, score: sc })
            }).then(function () { mpScoresCache.t = -1e9; })["catch"](function () {});
        } catch (e) {}
    }

    // Cached (60s) list of recent real fugitives. [] when unavailable.
    function mpWantedList() {
        if (!MP_URL || !save.mpName) return [];
        if (mpClock - mpWantedCache.t > 60 && !mpWantedCache.loading) {
            mpWantedCache.t = mpClock;              // mark the attempt (don't spam)
            mpWantedCache.loading = true;
            try {
                fetch(mpHttpBase() + "/board/wanted").then(function (r) { return r.json(); })
                    .then(function (j) { mpWantedCache.data = (j && j.list) ? j.list : []; mpWantedCache.loading = false; })
                    ["catch"](function () { mpWantedCache.loading = false; });
            } catch (e) { mpWantedCache.loading = false; }
        }
        return mpWantedCache.data || [];
    }

    // Cached (60s) top scores for today. null until a fetch has SUCCEEDED.
    function mpScoresList() {
        if (!MP_URL || !save.mpName) return null;
        if (mpClock - mpScoresCache.t > 60 && !mpScoresCache.loading) {
            mpScoresCache.t = mpClock;
            mpScoresCache.loading = true;
            try {
                fetch(mpHttpBase() + "/board/scores").then(function (r) { return r.json(); })
                    .then(function (j) { mpScoresCache.data = (j && j.list) ? j.list : []; mpScoresCache.ok = true; mpScoresCache.loading = false; })
                    ["catch"](function () { mpScoresCache.loading = false; });
            } catch (e) { mpScoresCache.loading = false; }
        }
        return mpScoresCache.ok ? mpScoresCache.data : null;
    }

    // Compact "🏁 TODAY'S TOP RIDERS" panel for the MENU (top-left, above the car,
    // clear of the title, the 🌐 button and the centered menu message). Only shows
    // once a rider name exists AND the daily-scores fetch has succeeded.
    function mpDrawLeaderboard() {
        if (!MP_URL || !save.mpName) return;
        var list = mpScoresList();
        if (!list || !list.length) return;
        var n = Math.min(5, list.length);
        // Sits down-left, BELOW the centred "YOUR CREW" strip (which now lives up
        // top just under the title) so the two panels never overlap.
        var headH = 20, rowH = 18, w = 178, x = 10, y = 252;
        var h = headH + 4 + n * rowH + 6;
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = "rgba(24,22,38,0.82)";
        roundRect(x, y, w, h, 12); ctx.fill();
        ctx.strokeStyle = "rgba(255,213,79,0.55)"; ctx.lineWidth = 1.5;
        roundRect(x, y, w, h, 12); ctx.stroke();
        ctx.globalAlpha = 1;
        drawText("🏁 TODAY'S TOP RIDERS", x + w / 2, y + 12,
            "bold 10px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 2);
        for (var i = 0; i < n; i++) {
            var e = list[i];
            var ry = y + headH + 4 + i * rowH;
            var ph = rowH - 3, mid = ry + ph / 2;
            var mine = (e && e.name === save.mpName);
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = mine ? "rgba(126,87,194,0.55)" : "rgba(255,255,255,0.06)";
            roundRect(x + 6, ry, w - 12, ph, 7); ctx.fill();
            ctx.globalAlpha = 1;
            drawText((i + 1) + ".", x + 14, mid, "bold 9px 'Segoe UI', Arial, sans-serif", "#B0A8C8", null, 0, "left");
            var nm = (e && e.name) ? e.name : "Rider";
            ctx.font = "bold 9px 'Segoe UI', Arial, sans-serif";
            var maxNameW = w - 26 - 48;
            if (ctx.measureText(nm).width > maxNameW) {
                while (nm.length > 3 && ctx.measureText(nm + "…").width > maxNameW) nm = nm.slice(0, -1);
                nm = nm + "…";
            }
            drawText(nm, x + 26, mid, "bold 9px 'Segoe UI', Arial, sans-serif", mine ? "#FFFFFF" : "#E1D5F5", null, 0, "left");
            drawText(formatNum((e && e.score) || 0), x + w - 12, mid,
                "bold 9px 'Segoe UI', Arial, sans-serif", "#FFD54F", null, 0, "right");
        }
        ctx.restore();
    }

    // ════════════════════════════════════════════════════════
    // TEMP DEBUG — offline visual proof (no server). Injects 3 scripted fake
    // peers so ghosts render + MOVE. Keep peers alive by refreshing their
    // heartbeats each frame while mpFakeMode is on.
    // ════════════════════════════════════════════════════════
    function mpFakeMaintain(dt) {
        var base = (typeof scrollOffset === "number") ? scrollOffset : 0;
        for (var k in mpPeers) {
            var p = mpPeers[k];
            p.lastPacket = mpClock;                       // never expire
            p.di = base + (p.demoOffset || 0);            // lock relative distance
            p.sp = (typeof gameSpeed === "number") ? gameSpeed : 300;
            p.demoPhase = (p.demoPhase || 0) + dt;
            var lane = (p.m === 1) ? 60 : 240;            // foot hugs the left edge
            p.tx = lane + Math.sin(p.demoPhase) * (p.demoAmp || 50);
        }
        mpFakeHonkT -= dt;
        if (mpFakeHonkT <= 0) {
            mpFakeHonkT = 2.6;
            if (mpPeers.f1) mpPeerEvent("f1", "honk");
            if (mpPeers.f3) mpPeerEvent("f3", "wave");
        }
    }

    function mpDebugFake() {
        mpConnected = true;
        mpWant = true;
        mpMyId = "me";
        mpFakeMode = true;
        mpFakeHonkT = 1.2;
        mpPeers = {};
        var base = (typeof scrollOffset === "number") ? scrollOffset : 0;
        mpPeers.f1 = { id: "f1", name: "Cholent Boy", sk: "pink", m: 0, vk: "borrowed", ct: 7, co: "#FDD835",
            demoOffset: -240, demoAmp: 70, demoPhase: 0, x: 170, tx: 170, di: base - 240, sp: 0, seen: true,
            lastPacket: mpClock, honkT: 0, waveT: 0, sx: 170, sy: 0, rel: 0, onScreen: true, vis: 1, dropping: false };
        mpPeers.f2 = { id: "f2", name: "Rugelach Queen", sk: "pink", m: 0, vk: "car", ct: 0, co: null,
            demoOffset: 150, demoAmp: 60, demoPhase: 2, x: 300, tx: 300, di: base + 150, sp: 0, seen: true,
            lastPacket: mpClock, honkT: 0, waveT: 0, sx: 300, sy: 0, rel: 0, onScreen: true, vis: 1, dropping: false };
        mpPeers.f3 = { id: "f3", name: "Latke Legend", sk: "gold", m: 1, vk: "car", ct: 0, co: null,
            demoOffset: -40, demoAmp: 34, demoPhase: 4, x: 60, tx: 60, di: base - 40, sp: 0, seen: true,
            lastPacket: mpClock, honkT: 0, waveT: 0, sx: 60, sy: 0, rel: 0, onScreen: true, vis: 1, dropping: false };
    }
