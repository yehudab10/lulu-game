    // ── Minigame: Cookie Catch ───────────────────────────────
    // Dina slides a plate left/right to catch falling cookies & treats for
    // coins. Catch a bomb (Mom's burnt cookie) and you lose a life. 30s round.
    var cookie = null; // {plateX, items[], timer, score, lives, spawnT, combo, comboT, msg, msgT, phase}
    var COOKIE_DURATION = 30;
    var COOKIE_PLATE_Y = H - 120;
    var COOKIE_PLATE_W = 78;   // narrower plate → catching takes more skill
    var COOKIE_FEE = 10;       // coins it costs to play one round

    function startCookieCatch() {
        state = "cookieCatch";
        // Entry fee — costs coins to play so it's a real gamble (you only come
        // out ahead by catching well), not a risk-free coin faucet.
        var fee = Math.min(COOKIE_FEE, save.totalCoins);
        save.totalCoins -= fee;
        persistSave();
        cookie = {
            plateX: W / 2, plateVX: 0,
            items: [], timer: COOKIE_DURATION,
            score: 0, lives: 3, spawnT: 0.8,
            combo: 0, comboT: 0,
            fee: fee,
            msg: "Catch the cookies!", msgT: 2,
            phase: "play", endT: 0, caught: 0
        };
        playTone(660, 0.08, "triangle", 0.18);
        setTimeout(function () { playTone(880, 0.1, "triangle", 0.18); }, 90);
    }

    // Falling item kinds — weight controls how often each appears.
    var COOKIE_KINDS = [
        { type: "cookie", emoji: "🍪", points: 1, weight: 42, good: true },
        { type: "choc",   emoji: "🍫", points: 2, weight: 18, good: true },
        { type: "donut",  emoji: "🍩", points: 3, weight: 11, good: true },
        { type: "cupcake",emoji: "🧁", points: 5, weight: 6,  good: true },
        { type: "milk",   emoji: "🥛", points: 2, weight: 7,  good: true },
        { type: "bomb",   emoji: "💣", points: 0, weight: 22, good: false }
    ];
    function pickCookieKind() {
        var total = 0, i;
        for (i = 0; i < COOKIE_KINDS.length; i++) total += COOKIE_KINDS[i].weight;
        var r = rand(0, total);
        for (i = 0; i < COOKIE_KINDS.length; i++) {
            r -= COOKIE_KINDS[i].weight;
            if (r <= 0) return COOKIE_KINDS[i];
        }
        return COOKIE_KINDS[0];
    }

    function updateCookieCatch(dt) {
        if (!cookie) return;
        gameTime += dt; // keep timed visual cues (low-time flash) animating
        updateParticles(dt);

        // ── End-of-round handoff ──
        if (cookie.phase !== "play") {
            cookie.endT += dt;
            if (cookie.endT > 1.0 && consumeTap()) {
                // Bank the coins and return to the bedroom.
                save.totalCoins += cookie.score;
                persistSave();
                cookie = null;
                enterDinaHome();
            }
            return;
        }

        // Pause via button
        if (consumePause()) { prevState = "cookieCatch"; state = "paused"; return; }

        // ── Plate movement: keys, on-screen buttons, or tap-to-position ──
        var move = 0;
        if (keys.left) move -= 1;
        if (keys.right) move += 1;
        cookie.plateX += move * 360 * dt;
        var click = consumeClick();
        if (click) {
            if (pointInRect(click.x, click.y, PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, PAUSE_RECT.h)) {
                prevState = "cookieCatch"; state = "paused"; playClick(); return;
            }
            // tap moves the plate toward the tap x
            cookie.plateX = click.x;
        }
        // Continuous finger-drag: the plate follows your finger across the screen.
        if (touchX !== null) cookie.plateX = touchX;
        cookie.plateX = clamp(cookie.plateX, COOKIE_PLATE_W / 2, W - COOKIE_PLATE_W / 2);

        // ── Spawn falling items (faster as the round goes) ──
        var progress = 1 - cookie.timer / COOKIE_DURATION;
        cookie.spawnT -= dt;
        if (cookie.spawnT <= 0) {
            // tighter spacing and a faster drop than before — more to track
            cookie.spawnT = rand(0.4, 0.72) * (1 - progress * 0.5);
            var k = pickCookieKind();
            cookie.items.push({
                kind: k, x: rand(30, W - 30), y: -20,
                vy: rand(200, 270) + progress * 170,
                rot: rand(-0.3, 0.3), spin: rand(-2, 2), wob: rand(0, 6.28)
            });
            // late-game double drop keeps the pressure on
            if (progress > 0.55 && Math.random() < 0.4) {
                var k2 = pickCookieKind();
                cookie.items.push({
                    kind: k2, x: rand(30, W - 30), y: -40,
                    vy: rand(220, 290) + progress * 170,
                    rot: rand(-0.3, 0.3), spin: rand(-2, 2), wob: rand(0, 6.28)
                });
            }
        }

        // ── Update items + catch test ──
        for (var i = cookie.items.length - 1; i >= 0; i--) {
            var it = cookie.items[i];
            it.y += it.vy * dt;
            it.rot += it.spin * dt;
            // caught? plate is a flat zone near COOKIE_PLATE_Y
            if (it.y > COOKIE_PLATE_Y - 18 && it.y < COOKIE_PLATE_Y + 16 &&
                Math.abs(it.x - cookie.plateX) < COOKIE_PLATE_W / 2 + 6) {
                if (it.kind.good) {
                    cookie.combo = Math.min(cookie.combo + 1, 9);
                    cookie.comboT = 1.6;
                    var pts = it.kind.points * (1 + Math.floor(cookie.combo / 3));
                    cookie.score += pts;
                    cookie.caught++;
                    spawnFloater(it.x, it.y - 10, "+" + pts, "#FFD700");
                    spawnCoinSparkle(it.x, it.y);
                    playTone(700 + cookie.combo * 60, 0.06, "sine", 0.14);
                    if (cookie.combo >= 3 && cookie.combo % 3 === 0) {
                        cookie.msg = cookie.combo + "x COMBO! 🔥"; cookie.msgT = 1.2;
                    }
                } else {
                    // bomb — lose a life, break combo, shake
                    cookie.lives--;
                    cookie.combo = 0;
                    shakeTimer = 0.35; shakeIntensity = 8;
                    spawnCrashBurst(it.x, it.y, false);
                    playExplosion();
                    cookie.msg = "Ouch! Burnt one! 💥"; cookie.msgT = 1.2;
                    if (cookie.lives <= 0) { endCookieCatch("oops"); }
                }
                cookie.items.splice(i, 1);
                continue;
            }
            // missed a good item off the bottom — gentle combo reset, no life loss
            if (it.y > H + 24) {
                if (it.kind.good) cookie.combo = 0;
                cookie.items.splice(i, 1);
            }
        }

        if (cookie.comboT > 0) cookie.comboT -= dt;
        else cookie.combo = 0;
        if (cookie.msgT > 0) cookie.msgT -= dt;

        // ── Timer ──
        cookie.timer -= dt;
        if (cookie.timer <= 0) { cookie.timer = 0; endCookieCatch("done"); }
    }

    function endCookieCatch(why) {
        cookie.phase = why;       // "done" (time up) or "oops" (out of lives)
        cookie.endT = 0;
        // Drain any tap/action still queued from gameplay so the result screen
        // doesn't instantly auto-dismiss — it waits for a fresh tap.
        consumeAction(); clickQueue = null;
        if (why === "done") {
            playTone(523, 0.1, "triangle", 0.2);
            setTimeout(function () { playTone(659, 0.1, "triangle", 0.2); }, 100);
            setTimeout(function () { playTone(784, 0.12, "triangle", 0.22); }, 200);
            setTimeout(function () { playTone(1046, 0.16, "triangle", 0.22); }, 300);
        } else {
            playWompWomp();
        }
    }

    function drawCookieCatch() {
        if (!cookie) return;
        ctx.save();
        if (shakeTimer > 0) {
            ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        }

        // Cozy kitchen background — warm vertical gradient instead of a flat wall
        var ckBg = ctx.createLinearGradient(0, 0, 0, H);
        ckBg.addColorStop(0, "#FFF7E8");
        ckBg.addColorStop(1, "#F3E2C2");
        ctx.fillStyle = ckBg;
        ctx.fillRect(0, 0, W, H);

        // Sunny kitchen window up top — the source of the warm sunbeam below.
        var ckwX = W * 0.18, ckwY = 22, ckwW = W * 0.30, ckwH = 96;
        ctx.fillStyle = "#9CCBE8"; roundRect(ckwX - 5, ckwY - 5, ckwW + 10, ckwH + 10, 6); ctx.fill();
        ctx.save();
        roundRect(ckwX, ckwY, ckwW, ckwH, 3); ctx.clip();   // keep the view inside the panes
        var skyG = ctx.createLinearGradient(0, ckwY, 0, ckwY + ckwH);
        skyG.addColorStop(0, "#BFE3FF"); skyG.addColorStop(1, "#E8F6FF");
        ctx.fillStyle = skyG; ctx.fillRect(ckwX, ckwY, ckwW, ckwH);
        // a little rolling hill + sun seen through the glass
        ctx.fillStyle = "#FFE08A"; ctx.beginPath();
        ctx.arc(ckwX + ckwW * 0.74, ckwY + 24, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#A5D6A7"; ctx.beginPath();
        ctx.ellipse(ckwX + ckwW * 0.4, ckwY + ckwH - 4, ckwW * 0.6, 20, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // muntins + frame
        ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(ckwX + ckwW / 2, ckwY); ctx.lineTo(ckwX + ckwW / 2, ckwY + ckwH);
        ctx.moveTo(ckwX, ckwY + ckwH / 2); ctx.lineTo(ckwX + ckwW, ckwY + ckwH / 2); ctx.stroke();
        ctx.strokeStyle = "#C8A878"; ctx.lineWidth = 3; ctx.strokeRect(ckwX, ckwY, ckwW, ckwH);

        // Warm sunbeam slanting down from the window
        ctx.fillStyle = "rgba(255, 224, 130, 0.25)";
        ctx.beginPath();
        ctx.moveTo(W * 0.15, 0); ctx.lineTo(W * 0.45, 0);
        ctx.lineTo(W * 0.6, H); ctx.lineTo(W * 0.0, H);
        ctx.closePath(); ctx.fill();
        // Checkered floor band at bottom
        for (var fx = 0; fx < W; fx += 40) {
            ctx.fillStyle = ((fx / 40) % 2 === 0) ? "#F4D9B0" : "#EBC998";
            ctx.fillRect(fx, H - 70, 40, 70);
        }
        // Counter line
        ctx.fillStyle = "#C8A878";
        ctx.fillRect(0, H - 72, W, 4);

        // Falling items
        for (var i = 0; i < cookie.items.length; i++) {
            var it = cookie.items[i];
            ctx.save();
            ctx.translate(it.x, it.y);
            ctx.rotate(it.rot);
            // soft shadow disk for readability
            ctx.fillStyle = "rgba(0,0,0,0.10)";
            ctx.beginPath(); ctx.ellipse(0, 2, 15, 15, 0, 0, Math.PI * 2); ctx.fill();
            ctx.font = "28px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(it.kind.emoji, 0, 0);
            ctx.restore();
        }

        // Particles (sparkles / bomb debris)
        drawParticles();

        // ── Plate (Dina holds it) ──
        var px = cookie.plateX, py = COOKIE_PLATE_Y;
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.beginPath(); ctx.ellipse(px, py + 18, COOKIE_PLATE_W / 2 + 4, 9, 0, 0, Math.PI * 2); ctx.fill();
        // plate dish
        ctx.fillStyle = "#FF8FB8";
        roundRect(px - COOKIE_PLATE_W / 2, py - 6, COOKIE_PLATE_W, 18, 9); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        roundRect(px - COOKIE_PLATE_W / 2 + 6, py - 3, COOKIE_PLATE_W - 12, 7, 4); ctx.fill();
        // Dina's hands at the plate ends
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(px - COOKIE_PLATE_W / 2, py + 4, 8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + COOKIE_PLATE_W / 2, py + 4, 8, 0, Math.PI * 2); ctx.fill();
        // Dina face peeking below the plate
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(px, py + 44, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#5D4037";
        ctx.beginPath(); ctx.arc(px, py + 30, 28, Math.PI, Math.PI * 2); ctx.fill(); // hair fringe
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(px - 8, py + 42, 2.4, 0, Math.PI * 2);
        ctx.arc(px + 8, py + 42, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#C2185B"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py + 46, 6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();

        ctx.restore(); // end shake

        // ── HUD ──
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(0, 0, W, 50, 0); ctx.fill();
        drawText("🍪 Cookie Catch", W / 2, 18, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);
        var lowT = cookie.timer <= 5 && cookie.phase === "play";
        var tCol = lowT ? (Math.sin(gameTime * 12) > 0 ? "#FF5252" : "#FFEB3B") : "#FFF";
        drawText("⏱ " + Math.ceil(cookie.timer) + "s", W - 14, 18,
            "bold " + (lowT ? 17 : 15) + "px 'Segoe UI', Arial, sans-serif", tCol, "#000", 3, "right");
        // Score, with the entry fee shown so the player knows what to beat.
        var profit = cookie.score - cookie.fee;
        var scoreCol = profit >= 0 ? "#7CFC4F" : "#FFD700";
        drawText("$" + cookie.score + "  (fee $" + cookie.fee + ")", 14, 18,
            "bold 14px 'Segoe UI', Arial, sans-serif", scoreCol, "#000", 2, "left");
        // lives as hearts
        var hh = "";
        for (var L = 0; L < cookie.lives; L++) hh += "♥";
        drawText(hh || "—", 14, 36, "bold 13px Arial", "#FF80AB", "#000", 2, "left");

        // Combo + toast message
        if (cookie.combo >= 2 && cookie.phase === "play") {
            drawText(cookie.combo + "x", W / 2, 40, "bold 14px Arial", "#FF8A65", "#000", 2);
        }
        if (cookie.msgT > 0) {
            var ma = clamp(cookie.msgT, 0, 1);
            ctx.globalAlpha = ma;
            drawText(cookie.msg, W / 2, 80, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#000", 3);
            ctx.globalAlpha = 1;
        }

        // Pause button
        drawIconButton(PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, "❚❚", { bg: "#FFFFFF", bgDark: "#BDBDBD" });

        // Plate is dragged with a finger now — no on-screen arrows.
        if (cookie.phase === "play") {
            drawText(isTouchDevice ? "Drag to catch treats · dodge 💣"
                                   : "◀ ▶ / move mouse to catch · dodge 💣", W / 2, H - 14,
                "12px Arial", "#7A5230", null, 0);
        }

        // ── End overlay ──
        if (cookie.phase !== "play") {
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(0, 0, W, H);
            var win = cookie.phase === "done";
            var net = cookie.score - cookie.fee;
            drawText(win ? "🍪 YUM! 🍪" : "Out of cookies! 💥", W / 2, H / 2 - 100,
                "bold 30px 'Segoe UI', Arial, sans-serif", win ? "#FFD700" : "#FF8A80", "#000", 6);
            drawText("Caught " + cookie.caught + " treats", W / 2, H / 2 - 52,
                "bold 18px Arial", "#FFFFFF", "#000", 3);
            // Show the math: earned vs the fee paid, then the net result.
            drawText("Earned $" + cookie.score + "   ·   Fee $" + cookie.fee, W / 2, H / 2 - 16,
                "bold 14px Arial", "#FFE0B2", "#000", 2);
            drawText((net >= 0 ? "Profit +$" : "Lost $") + Math.abs(net), W / 2, H / 2 + 26,
                "bold 34px 'Segoe UI', Arial, sans-serif", net >= 0 ? "#7CFC4F" : "#FF8A80", "#000", 5);
            if (cookie.endT > 1.0) {
                drawText("Tap to head back", W / 2, H / 2 + 78, "15px Arial", "#FFFFFF", "#000", 2);
            }
        }
    }
