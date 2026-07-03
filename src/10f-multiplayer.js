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
    var mpRoom = "lobby";       // "lobby" = EVERYONE; else an uppercased code
    var mpMyId = null;
    var mpPeers = {};           // id -> peer record
    var mpClock = 0;            // local accumulated seconds (drives all timers)
    var mpSendTimer = 0;        // state-broadcast throttle (≤5 Hz)
    var mpPingTimer = 0;        // keepalive throttle (25 s)
    var mpReconnectAt = 0;      // mpClock time of the next reconnect attempt
    var mpReconnectDelay = 1;   // backoff seconds (1,2,4,8… cap 10)

    // ── Picker / overlay UI state ────────────────────────────
    var mpPickerOpen = false;
    var mpRoomKind = "everyone";   // "everyone" | "friend" (selection in the form)
    var mpCodeSlots = [0, 0, 0, 0]; // A-Z indices for the 4-letter friend code

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
        if (mpSock) { try { mpSock.onclose = null; mpSock.close(); } catch (e) {} mpSock = null; }
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
            mpPeers = {};
            if (msg.peers) {
                for (var i = 0; i < msg.peers.length; i++) {
                    var pp = msg.peers[i];
                    mpAddPeer(pp.id, pp.name, pp.sk);
                    if (pp.d) mpApplyState(pp.id, pp.d);
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
                sx: W / 2, sy: 0, rel: 0, onScreen: false
            };
            mpPeers[id] = p;
        } else {
            if (name) p.name = name;
            if (sk) p.sk = sk;
        }
        return p;
    }

    function mpApplyState(id, d) {
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
    }

    function mpPeerEvent(id, e) {
        var p = mpPeers[id];
        if (!p) return;
        if (e === "honk") {
            p.honkT = 1.1;
            if (p.onScreen && Math.abs(p.rel) < 300) {
                if (typeof playHonk === "function") playHonk();
                if (typeof spawnFloater === "function") spawnFloater(p.sx, p.sy - 40, "📣", "#FFD54F");
            }
        } else if (e === "wave") {
            p.waveT = 1.1;
            if (p.onScreen && typeof spawnFloater === "function") spawnFloater(p.sx, p.sy - 40, "👋", "#FFF176");
        }
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
        mpSend({ t: "s", d: d });
    }

    // ── Lifecycle tick ───────────────────────────────────────
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
            // Broadcast my state at ≤5 Hz, only while playing/footRun.
            if (mpConnected && !mpFakeMode && (state === "playing" || state === "footRun")) {
                mpSendTimer += dt;
                if (mpSendTimer >= 0.2) { mpSendTimer = 0; mpSendState(); }
            }

            if (mpFakeMode) mpFakeMaintain(dt);

            // Advance interpolation + expire stale peers (no packet 6 s → drop).
            for (var id in mpPeers) {
                var p = mpPeers[id];
                if (!mpFakeMode) p.di += (p.sp || 0) * dt;   // extrapolate distance
                p.x = lerp(p.x, p.tx, clamp(dt * 8, 0, 1));  // ease lane x
                if (p.honkT > 0) p.honkT -= dt;
                if (p.waveT > 0) p.waveT -= dt;
                if (mpClock - p.lastPacket > 6) delete mpPeers[id];
            }
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

    function mpDrawNametag(cx, baseY, name) {
        ctx.save();
        ctx.font = "bold 9px 'Segoe UI', Arial, sans-serif";
        var tw = ctx.measureText(name).width;
        var w = tw + 12, h = 14, x = cx - w / 2, y = baseY - h;
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = "rgba(24,22,38,0.85)";
        roundRect(x, y, w, h, 7); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = 1;
        roundRect(x, y, w, h, 7); ctx.stroke();
        ctx.globalAlpha = 1;
        drawText(name, cx, y + h / 2 + 0.5, "bold 9px 'Segoe UI', Arial, sans-serif", "#FFFFFF", null, 0);
        ctx.restore();
    }

    function mpDrawEmojiBurst(x, y, emoji, t) {
        var p = clamp(1 - t / 1.1, 0, 1);   // 0 → 1 across the life
        var rise = p * 26;
        var scale = 1 + Math.sin(p * Math.PI) * 0.45;
        ctx.save();
        ctx.globalAlpha = clamp(1.15 - p, 0, 1);
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

            ctx.save();
            ctx.globalAlpha = 0.75;
            if (p.m === 1) drawLuluTopDown(gx, gy, mpClock * 6, null);   // walking ghost
            else mpDrawGhostVehicle(gx, gy, p);
            ctx.restore();

            var topY = gy - mpGhostHalfH(p) - 6;
            mpDrawNametag(gx, topY, p.name);
            if (p.honkT > 0) mpDrawEmojiBurst(gx, topY - 16, "📣", p.honkT);
            else if (p.waveT > 0) mpDrawEmojiBurst(gx, topY - 16, "👋", p.waveT);
        }
        ctx.globalAlpha = 1;
    }

    // ── Menu button + name/room picker overlay ───────────────
    function mpMenuBtnRect() {
        var baseY = H * 0.50;
        var y = baseY + (save.distractedUnlocked ? 244 : 192);
        return { x: W / 2 - 110, y: y, w: 220, h: 46 };
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
        var btnY = panelY + panelH - 60;
        r.connect = { x: gx0, y: btnY, w: colW, h: 48 };
        r.cancel = { x: gx0 + colW + gapX, y: btnY, w: colW, h: 48 };
        r.disconnect = { x: gx0, y: btnY, w: colW, h: 48 };
        r.close = { x: gx0 + colW + gapX, y: btnY, w: colW, h: 48 };
        return r;
    }

    function mpDrawConnectedPanel(r) {
        var cy = r.panelY + 130;
        var connecting = !mpConnected;
        drawText(connecting ? "… Connecting" : "✅ Connected", W / 2, cy,
            "bold 24px 'Segoe UI', Arial, sans-serif", connecting ? "#FFD54F" : "#69F0AE", "#000", 4);
        drawText("Room: " + (mpRoom === "lobby" ? "EVERYONE" : mpRoom.toUpperCase()), W / 2, cy + 40,
            "bold 15px 'Segoe UI', Arial, sans-serif", "#E1D5F5", "#000", 3);
        drawText("Riding as: " + mpMyName(), W / 2, cy + 66,
            "bold 14px 'Segoe UI', Arial, sans-serif", "#CFC4E8", "#000", 2);
        if (mpConnected) {
            drawText("🌐 " + mpRiderCount() + " riders on the road", W / 2, cy + 98,
                "bold 16px 'Segoe UI', Arial, sans-serif", "#80CBC4", "#000", 3);
            var pnames = mpPeerNames();
            for (var i = 0; i < pnames.length && i < 6; i++) {
                drawText("• " + pnames[i], W / 2, cy + 128 + i * 22,
                    "12px 'Segoe UI', Arial, sans-serif", "#B0A8C8", null, 0);
            }
        }
        drawButton(r.disconnect.x, r.disconnect.y, r.disconnect.w, r.disconnect.h, "DISCONNECT",
            { bg: "#EF5350", bgDark: "#B71C1C" });
        drawButton(r.close.x, r.close.y, r.close.w, r.close.h, "CLOSE",
            { bg: "#90A4AE", bgDark: "#455A64", small: true });
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
        if (mpRoomKind === "friend") {
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
        }
        // Connect / Cancel
        drawButton(r.connect.x, r.connect.y, r.connect.w, r.connect.h, "CONNECT",
            { bg: "#66BB6A", bgDark: "#2E7D32" });
        drawButton(r.cancel.x, r.cancel.y, r.cancel.w, r.cancel.h, "CANCEL",
            { bg: "#90A4AE", bgDark: "#455A64", small: true });
    }

    function mpMenuButton() {
        if (!MP_URL) return;
        var b = mpMenuBtnRect();
        var online = mpConnected;
        drawButton(b.x, b.y, b.w, b.h,
            online ? ("🌐 ONLINE · " + mpRiderCount()) : "🌐 SHARED ROAD",
            { bg: online ? "#26A69A" : "#7E57C2",
              bgDark: online ? "#00695C" : "#4527A0", small: true });
        if (mpPickerOpen) mpDrawPicker();
    }

    function mpHandlePickerClick(click) {
        var r = mpPickerRects();
        var cx = click.x, cy = click.y;
        function tap() { if (typeof playClick === "function") playClick(); }

        if (mpWant) {   // connected / connecting panel
            if (pointInRect(cx, cy, r.disconnect.x, r.disconnect.y, r.disconnect.w, r.disconnect.h)) { mpDisconnect(); tap(); return; }
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
            }
        }
        // Connect
        if (pointInRect(cx, cy, r.connect.x, r.connect.y, r.connect.w, r.connect.h)) {
            if (!save.mpName) { save.mpName = CURATED_NAMES[0]; persistSave(); }
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
        if (!MP_URL || !mpConnected) return;
        var n = mpRiderCount();
        var txt = "🌐 " + n + (n === 1 ? " rider" : " riders");
        ctx.save();
        ctx.font = "bold 11px 'Segoe UI', Arial, sans-serif";
        var tw = ctx.measureText(txt).width;
        // Just BELOW the top HUD strip, centered — the strip's center is taken by
        // the lives hearts (driving) / title, so tuck the chip under it.
        var w = tw + 18, h = 20, x = W / 2 - w / 2, y = 54;
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = "rgba(38,166,154,0.85)";
        roundRect(x, y, w, h, 10); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.30)"; ctx.lineWidth = 1;
        roundRect(x, y, w, h, 10); ctx.stroke();
        ctx.globalAlpha = 1;
        drawText(txt, W / 2, y + h / 2, "bold 11px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#004D40", 2);
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
            lastPacket: mpClock, honkT: 0, waveT: 0, sx: 170, sy: 0, rel: 0, onScreen: true };
        mpPeers.f2 = { id: "f2", name: "Rugelach Queen", sk: "pink", m: 0, vk: "car", ct: 0, co: null,
            demoOffset: 150, demoAmp: 60, demoPhase: 2, x: 300, tx: 300, di: base + 150, sp: 0, seen: true,
            lastPacket: mpClock, honkT: 0, waveT: 0, sx: 300, sy: 0, rel: 0, onScreen: true };
        mpPeers.f3 = { id: "f3", name: "Latke Legend", sk: "gold", m: 1, vk: "car", ct: 0, co: null,
            demoOffset: -40, demoAmp: 34, demoPhase: 4, x: 60, tx: 60, di: base - 40, sp: 0, seen: true,
            lastPacket: mpClock, honkT: 0, waveT: 0, sx: 60, sy: 0, rel: 0, onScreen: true };
    }
