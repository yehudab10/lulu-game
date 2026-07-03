    function drawParkingIntro() {
        var t = 1 - parkingTransitionTimer / parkingTransitionDuration;
        if (t < 0.5) {
            ctx.save();
            var zoom = 1 + t * 2;
            // Center of zoom: in challenge mode, just zoom on middle of screen (no main game)
            var cx = parkingChallengeMode ? W / 2 : (player ? player.x : W / 2);
            var cy = parkingChallengeMode ? H / 2 : (player ? player.y : H / 2);
            ctx.translate(W / 2, H / 2);
            ctx.scale(zoom, zoom);
            ctx.translate(-cx, -cy);
            if (parkingChallengeMode) {
                // Show the parking scene already (since there's no main game to zoom from)
                drawParkingFull(gameTime);
            } else {
                drawPlaying();
            }
            ctx.restore();
            ctx.fillStyle = "rgba(255,255,255," + (t * 2 * 0.9) + ")";
            ctx.fillRect(0, 0, W, H);
        } else {
            var t2 = (t - 0.5) * 2;
            var zoom2 = 2 - t2;
            var cx2 = parkingCar ? parkingCar.x : W / 2;
            var cy2 = parkingCar ? parkingCar.y : H / 2;
            ctx.save();
            ctx.translate(W / 2, H / 2);
            ctx.scale(zoom2, zoom2);
            ctx.translate(-cx2, -cy2);
            drawParkingFull(gameTime);
            ctx.restore();
            ctx.fillStyle = "rgba(255,255,255," + ((1 - t2) * 0.9) + ")";
            ctx.fillRect(0, 0, W, H);
        }
        drawParkingLevelIntro();
    }

    // ── Draw: Parking gameplay ───────────────────────────────
    function drawParkingFull(time) {
        drawParkingScene(time);

        // Parked cars
        for (var p = 0; p < parkedCars.length; p++) {
            drawParkedCar(parkedCars[p]);
        }
        // Cone obstacles in the parking spot
        for (var e = 0; e < parkingExtras.length; e++) {
            var ext = parkingExtras[e];
            if (ext.type === "cone") drawCone(ext.x, ext.y);
        }
        // Pedestrian on sidewalk
        if (parkingPedestrian) {
            drawPedestrian(parkingPedestrian.x, parkingPedestrian.y,
                parkingPedestrian.walkTime, parkingPedestrian.pedType);
        }
        // Party members parking in the same lot (Shared Road) — translucent
        // ghosts under Lulu's car so she always reads on top.
        if (typeof mpDrawParkingGhosts === "function") { try { mpDrawParkingGhosts(); } catch (e) {} }
        // Lulu's car
        if (parkingCar) drawLuluCarFull(parkingCar, time, false);
        // Cameras (drawn on top)
        for (var c = 0; c < parkingCameras.length; c++) {
            drawSecurityCamera(parkingCameras[c], time);
        }

        // Night-mode dim overlay (subtle) + headlight cone in front of Lulu
        var theme = (parkingLevelConfig && parkingLevelConfig.theme) || "day";
        if (theme === "night") {
            ctx.fillStyle = "rgba(0, 8, 40, 0.35)";
            ctx.fillRect(0, 140, W, H - 140);
            if (parkingCar) {
                // Headlight beams in front of car
                ctx.save();
                ctx.translate(parkingCar.x, parkingCar.y);
                ctx.rotate(parkingCar.rot);
                ctx.fillStyle = "rgba(255,247,180,0.18)";
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(80, -30);
                ctx.lineTo(80, 30);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        } else if (theme === "dusk") {
            ctx.fillStyle = "rgba(255, 87, 34, 0.10)";
            ctx.fillRect(0, 0, W, H);
        }

        drawParticles();
    }

    function drawParking() {
        ctx.save();
        if (shakeTimer > 0) {
            ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        }
        drawParkingFull(gameTime);
        ctx.restore();

        // Flash overlay on collision
        if (parkingFlashTimer > 0) {
            ctx.fillStyle = "rgba(244,67,54," + (parkingFlashTimer / 0.2 * 0.35) + ")";
            ctx.fillRect(0, 0, W, H);
        }

        // Low-time panic vignette — pulsing red edges when under 10s so the
        // time pressure is felt, not just read off the clock.
        if (parkingTimeLeft <= 10 && parkingTimeLeft > 0) {
            var urgency = (10 - parkingTimeLeft) / 10;           // 0→1 as time runs out
            var beat = 0.5 + 0.5 * Math.sin(gameTime * (6 + urgency * 8));
            var vAlpha = (0.12 + urgency * 0.28) * beat;
            var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.62);
            vg.addColorStop(0, "rgba(244,67,54,0)");
            vg.addColorStop(1, "rgba(244,67,54," + vAlpha.toFixed(3) + ")");
            ctx.fillStyle = vg;
            ctx.fillRect(0, 0, W, H);
        }

        // HUD top bar
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        roundRect(0, 0, W, 50, 0); ctx.fill();
        // Timer goes red and grows a touch when the clock is low.
        var lowTime = parkingTimeLeft <= 10;
        var timeCol = lowTime ? (Math.sin(gameTime * 12) > 0 ? "#FF5252" : "#FFEB3B") : "#FFF";
        if (parkingChallengeMode) {
            drawText("LVL " + parkingLevel + " · " + (parkingLevelIntroText.split("· ")[1] || ""),
                W / 2, 18, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);
            drawText("⏱ " + Math.ceil(parkingTimeLeft) + "s", W - 14, 18,
                "bold " + (lowTime ? 17 : 15) + "px 'Segoe UI', Arial, sans-serif", timeCol, "#000", 3, "right");
            // lives = small heart icons + count
            drawText("♥ " + parkingChallengeLives, 14, 18, "bold 14px 'Segoe UI', Arial, sans-serif", "#FF80AB", "#000", 2, "left");
            drawText("★ " + parkingChallengeStars, 14, 36, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 2, "left");
            drawText("$" + parkingChallengeCoins, W - 14, 36, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 2, "right");
        } else {
            drawText("PARALLEL PARKING", W / 2, 18, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);
            drawText("⏱ " + Math.ceil(parkingTimeLeft) + "s", W - 30, 18,
                "bold " + (lowTime ? 18 : 16) + "px 'Segoe UI', Arial, sans-serif", timeCol, "#000", 3, "right");
            drawText("♥ " + lives, 30, 18, "bold 14px 'Segoe UI', Arial, sans-serif", "#FF80AB", "#000", 2, "left");
        }

        if (parkingCar && carIsInZone(parkingCar)) {
            var pulse = 1 + Math.sin(gameTime * 8) * 0.1;
            ctx.save();
            ctx.translate(W / 2, H - 60);
            ctx.scale(pulse, pulse);
            drawText("HOLD STILL TO PARK!", 0, 0,
                "bold 22px 'Segoe UI', Arial, sans-serif", "#4CAF50", "#000", 5);
            ctx.restore();
        } else {
            drawText("Park between the two cars · ←→ steer · ↑↓ move",
                W / 2, H - 30, "13px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2);
        }

        // Pause button
        drawIconButton(PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, "❚❚",
            { bg: "#FFFFFF", bgDark: "#BDBDBD" });

        // Parking-mode D-pad buttons — touch only; desktop uses arrow keys.
        if (isTouchDevice) {
            // Left thumb: steering
            drawIconButton(PARK_LEFT_RECT.x, PARK_LEFT_RECT.y, PARK_LEFT_RECT.w,
                "◀", { bg: keys.left ? "#FFEB3B" : "#FFFFFF", bgDark: "#90A4AE" });
            drawIconButton(PARK_RIGHT_RECT.x, PARK_RIGHT_RECT.y, PARK_RIGHT_RECT.w,
                "▶", { bg: keys.right ? "#FFEB3B" : "#FFFFFF", bgDark: "#90A4AE" });
            // Right thumb: forward / reverse
            drawIconButton(PARK_FWD_RECT.x, PARK_FWD_RECT.y, PARK_FWD_RECT.w,
                "▲", { bg: keys.up ? "#FFEB3B" : "#A5D6A7", bgDark: "#2E7D32" });
            drawIconButton(PARK_REV_RECT.x, PARK_REV_RECT.y, PARK_REV_RECT.w,
                "▼", { bg: keys.down ? "#FFEB3B" : "#EF9A9A", bgDark: "#B71C1C" });
            // Labels under buttons
            drawText("STEER", PARK_LEFT_RECT.x + 58, PARK_LEFT_RECT.y + 70, "bold 10px Arial", "#FFF", "#000", 2);
            drawText("DRIVE", PARK_FWD_RECT.x + 58, PARK_FWD_RECT.y + 70, "bold 10px Arial", "#FFF", "#000", 2);
        }
    }

    // ── Draw: Pull-over walk-out (Lulu steps out + walks off before foot) ──
    function drawParkingWalkout() {
        drawParkingFull(gameTime);
        if (parkingWalkout) {
            drawLuluTopDown(parkingWalkout.x, parkingWalkout.y, parkingWalkout.walkTime, "walk");
        }
    }

    // ── Draw: Parking Result ────────────────────────────────
    function drawParkingResult() {
        ctx.save();
        if (shakeTimer > 0) {
            ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        }

        drawParkingScene(gameTime);
        for (var p = 0; p < parkedCars.length; p++) drawParkedCar(parkedCars[p]);
        if (parkingResult === "fail") {
            drawLuluCarFull(parkingCar, gameTime, true); // crying
        } else {
            drawLuluCarFull(parkingCar, gameTime, false);
        }
        for (var c = 0; c < parkingCameras.length; c++) {
            drawSecurityCamera(parkingCameras[c], gameTime);
        }
        drawParticles();

        ctx.restore();

        // Result overlay
        if (parkingResult === "success") {
            // Confetti particles
            if (Math.random() > 0.5) {
                particles.push({
                    x: rand(0, W), y: -10,
                    vx: rand(-30, 30), vy: rand(60, 140),
                    life: 1.5, maxLife: 1.5,
                    size: rand(3, 6),
                    color: randPick(["#FF80AB", "#FFD700", "#4FC3F7", "#81C784", "#FFB74D"]),
                    gravity: 30
                });
            }
            ctx.fillStyle = "rgba(76, 175, 80, 0.25)";
            ctx.fillRect(0, 0, W, H);
            var bounce = 1 + Math.sin(gameTime * 6) * 0.08;
            ctx.save();
            ctx.translate(W / 2, H * 0.25);
            ctx.scale(bounce, bounce);
            drawText("PARKED! 🎉", 0, 0, "bold 42px 'Segoe UI', Arial, sans-serif", "#FFEB3B", "#0D47A1", 7);
            // A flawless 3-star park finally gets its moment (the counter always
            // tracked perfect runs — there was just never a celebration).
            if (parkingResultStars >= 3) {
                var ppop = 1 + Math.sin(gameTime * 8) * 0.06;
                ctx.save(); ctx.scale(ppop, ppop);
                drawText("✨ PERFECT PARK! ✨", 0, -44, "bold 20px 'Segoe UI', Arial, sans-serif", "#80D8FF", "#01579B", 5);
                ctx.restore();
            }
            drawText("ICE CREAM TIME!", 0, 38, "bold 22px 'Segoe UI', Arial, sans-serif", "#FFF", "#0D47A1", 5);
            var starStr = parkingResultStars > 0 ? "⭐".repeat(parkingResultStars) + " · " : "";
            var payStr = starStr + "+" + parkingResultBonus + " coins" + (parkingChallengeMode ? "" : " · +500 score");
            drawText(payStr, 0, 68, "bold 14px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3);
            ctx.restore();

            // Speech bubble from car: "Yay ice cream!"
            if (parkingCar) {
                drawSpeechBubble(parkingCar.x, parkingCar.y - 50, "YAY ICE CREAM!", gameTime);
            }
        } else if (parkingResult === "fail") {
            ctx.fillStyle = "rgba(0,0,0,0.45)";
            ctx.fillRect(0, 0, W, H);
            drawText("CRASH!", W / 2, H * 0.18, "bold 40px 'Segoe UI', Arial, sans-serif", "#F44336", "#000", 7);
            var failWho = parkingFailHit && parkingFailHit.who;
            var msg = failWho === "timeout" ? "Out of time!" : failWho === "pedestrian" ? "You bumped a pedestrian!" : "You dinged the other car!";
            drawText(msg, W / 2, H * 0.24, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
            drawText("-1 ♥", W / 2, H * 0.30, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFCDD2", "#000", 3);

            // Draw angry man on the road below Lulu's car
            if (parkingCar) {
                var t = parkingResultTimer < 3 ? 3 - parkingResultTimer : 0;
                var manX = parkingCar.x - 30 + t * 5; // walking up
                var manY = parkingCar.y + 50;
                drawAngryMan(Math.min(manX, parkingCar.x - 15), manY, t, "yelling", 1);
                drawSpeechBubble(parkingCar.x - 20, manY - 30, "WHO TAUGHT YOU\nTO DRIVE!?", t);
            }

            // Crying tears falling from car
            if (parkingCar && Math.random() > 0.6) {
                particles.push({
                    x: parkingCar.x + rand(-8, 8),
                    y: parkingCar.y - 20,
                    vx: rand(-10, 10), vy: rand(40, 80),
                    life: 0.6, maxLife: 0.6,
                    size: rand(2, 4),
                    color: "#4FC3F7",
                    gravity: 80
                });
            }
        }

        // Star rating overlay
        if (parkingResult === "success" && parkingResultTimer < 2.5) {
            var stars = calcStars();
            var fadeIn = clamp((2.5 - parkingResultTimer) * 2, 0, 1);
            ctx.globalAlpha = fadeIn;
            for (var si = 0; si < 3; si++) {
                var sx = W / 2 + (si - 1) * 48;
                var sy = H * 0.42;
                var lit = si < stars;
                drawText(lit ? "★" : "☆", sx, sy,
                    "bold 50px Arial", lit ? "#FFD700" : "#9E9E9E", "#000", 5);
            }
            ctx.globalAlpha = 1;
        }
    }

    // ── Draw: Parking Level Intro (overlay during zoom-in) ────
    function drawParkingLevelIntro() {
        if (!parkingChallengeMode || !parkingLevelIntroText) return;
        var t = 1 - parkingTransitionTimer / parkingTransitionDuration;
        if (t > 0.5) {
            var alpha = clamp((t - 0.5) * 2, 0, 1);
            ctx.fillStyle = "rgba(0,0,0," + (alpha * 0.5) + ")";
            ctx.fillRect(0, H / 2 - 60, W, 120);
            ctx.globalAlpha = alpha;
            drawText(parkingLevelIntroText, W / 2, H / 2 - 10,
                "bold 28px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 6);
            var cfg = parkingLevelConfig;
            if (cfg) {
                var details = cfg.numCameras + " 📹 · " + Math.floor(cfg.timeLimit) + "s · " +
                              cfg.theme.toUpperCase();
                if (cfg.coneInSpot) details += " · 🚧";
                if (cfg.pedestrian) details += " · 🚶";
                drawText(details, W / 2, H / 2 + 24,
                    "bold 14px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
            }
            ctx.globalAlpha = 1;
        }
    }

    // ── Draw: Parking End-of-Run Screen ───────────────────────
    function drawParkingEnd() {
        // Background: dark gradient
        ctx.fillStyle = "#0D47A1";
        ctx.fillRect(0, 0, W, H);
        // Confetti
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        for (var c = 0; c < 30; c++) {
            var cx = (c * 47 + 13) % W;
            var cy = (c * 31 + 7 + gameTime * 20) % H;
            ctx.fillRect(cx, cy, 3, 3);
        }

        var stats = parkingEndStats || { level: 1, stars: 0, coins: 0, victory: false };

        if (stats.victory) {
            drawText("🏆 MASTER PARKER!", W / 2, H * 0.12, "bold 32px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 6);
            drawText("You beat ALL 10 levels!", W / 2, H * 0.18, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
        } else {
            drawText("PARKING OVER", W / 2, H * 0.12, "bold 32px 'Segoe UI', Arial, sans-serif", "#F44336", "#000", 6);
            drawText("You reached Level " + stats.level, W / 2, H * 0.18, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
        }

        // Big stats box
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        roundRect(40, H * 0.27, W - 80, 200, 14); ctx.fill();
        ctx.strokeStyle = "#42A5F5";
        ctx.lineWidth = 3;
        roundRect(40, H * 0.27, W - 80, 200, 14); ctx.stroke();

        drawText("THIS RUN", W / 2, H * 0.30, "bold 14px 'Segoe UI', Arial, sans-serif", "#90CAF9", "#000", 2);
        drawText("Level reached: " + stats.level, W / 2, H * 0.34, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
        drawText("Stars earned: ★ " + stats.stars, W / 2, H * 0.39, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3);
        drawText("Coins earned: $ " + stats.coins, W / 2, H * 0.44, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFEB3B", "#000", 3);

        drawText("ALL-TIME", W / 2, H * 0.50, "bold 14px 'Segoe UI', Arial, sans-serif", "#90CAF9", "#000", 2);
        drawText("Best level: " + save.parkingBestLevel, W / 2, H * 0.54, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
        drawText("💰 Coins: " + formatNum(save.totalCoins), W / 2, H * 0.58, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3);
        drawText("Perfect parks: " + save.parkingPerfectRuns, W / 2, H * 0.62, "bold 16px 'Segoe UI', Arial, sans-serif", "#90CAF9", "#000", 3);

        // Buttons
        drawButton(W / 2 - 110, H * 0.74, 220, 56, "🅿 PLAY AGAIN", { bg: "#42A5F5", bgDark: "#0D47A1" });
        drawButton(W / 2 - 110, H * 0.83, 220, 50, "MAIN MENU", { bg: "#90A4AE", bgDark: "#455A64", small: true });
    }

    function updateParkingEnd(dt) {
        var click = consumeClick();
        if (!click) {
            if (consumeAction()) {
                startParkingChallenge();
            }
            return;
        }
        // Play Again
        if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.74, 220, 56)) {
            startParkingChallenge();
            playClick();
            return;
        }
        // Main Menu
        if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.83, 220, 50)) {
            parkingChallengeMode = false;
            state = "menu";
            playClick();
            return;
        }
    }

    // ── Draw: Paused ─────────────────────────────────────────
    function drawPaused() {
        // Draw whatever scene we paused from as the backdrop.
        if (prevState === "parking") drawParking();
        else if (prevState === "cookieCatch") drawCookieCatch();
        else drawPlaying();
        // overlay
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, W, H);
        drawText("PAUSED", W / 2, H / 2 - 130, "bold 60px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 6);

        // Resume button
        drawButton(W / 2 - 110, H / 2 - 55, 220, 56, "▶ RESUME", { bg: "#66BB6A", bgDark: "#2E7D32" });
        // Music toggle button
        var musicLabel = musicMuted ? "♪ MUSIC: OFF" : "♪ MUSIC: ON";
        var mc1 = musicMuted ? "#9E9E9E" : "#42A5F5";
        var mc2 = musicMuted ? "#616161" : "#0D47A1";
        drawButton(W / 2 - 110, H / 2 + 13, 220, 52, musicLabel, { bg: mc1, bgDark: mc2, small: true });
        // SFX toggle button
        var sfxLabel = audioMuted ? "🔇 SOUND: OFF" : "🔊 SOUND: ON";
        var sc1 = audioMuted ? "#9E9E9E" : "#FFC107";
        var sc2 = audioMuted ? "#616161" : "#FF6F00";
        drawButton(W / 2 - 110, H / 2 + 75, 220, 52, sfxLabel, { bg: sc1, bgDark: sc2, small: true });
        // Quit button
        drawButton(W / 2 - 110, H / 2 + 137, 220, 52, "QUIT TO MENU", { bg: "#EF5350", bgDark: "#B71C1C", small: true });

        drawText(isTouchDevice ? "Tap RESUME to keep playing" : "Press P or ESC to resume",
            W / 2, H / 2 + 210, "14px 'Segoe UI', Arial, sans-serif", "#DDD", "#000", 2);
    }

    // ── Draw: Game Over ──────────────────────────────────────
    function drawGameOver() {
        drawPlaying();
        ctx.fillStyle = "rgba(0,0,0," + (gameOverAlpha * 0.6) + ")";
        ctx.fillRect(0, 0, W, H);
        // Extra radial darkening at the edges so the central readout pops.
        ctx.save();
        var goVig = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.18, W / 2, H * 0.42, H * 0.7);
        goVig.addColorStop(0, "rgba(0,0,0,0)");
        goVig.addColorStop(1, "rgba(0,0,0," + (gameOverAlpha * 0.45) + ")");
        ctx.fillStyle = goVig;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        if (gameOverAlpha > 0.3) {
            var a = Math.min((gameOverAlpha - 0.3) / 0.4, 1);
            ctx.globalAlpha = a;

            var goShake = Math.sin(gameTime * 12) * (1 - a) * 5;
            drawText("GAME OVER", W / 2 + goShake, H * 0.22,
                "bold 52px 'Segoe UI', Arial, sans-serif", "#F44336", "#333", 6);

            drawText("SCORE", W / 2, H * 0.33,
                "bold 18px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#333", 3);
            // Score "pops" slightly bigger while the count-up is still climbing.
            var goClimbing = goScoreShown < Math.floor(score);
            var goPulse = goClimbing ? 1 + Math.sin(gameTime * 22) * 0.05 : 1;
            ctx.save();
            ctx.translate(W / 2, H * 0.40);
            ctx.scale(goPulse, goPulse);
            drawText(formatNum(Math.floor(goScoreShown)), 0, 0,
                "bold 40px 'Segoe UI', Arial, sans-serif", goClimbing ? "#FFF59D" : "#FFF", "#333", 5);
            ctx.restore();

            drawText("💰 " + runCoins + " coins this run", W / 2, H * 0.47,
                "bold 18px 'Segoe UI', Arial, sans-serif", C.coin, "#333", 3);
            drawText("Total bank: " + formatNum(save.totalCoins), W / 2, H * 0.52,
                "bold 14px 'Segoe UI', Arial, sans-serif", "#FFE082", "#333", 2);

            if (Math.floor(score) >= save.highScore && save.highScore > 0) {
                var pulse = 0.9 + Math.sin(gameTime * 6) * 0.1;
                ctx.save();
                ctx.translate(W / 2, H * 0.61);
                ctx.scale(pulse, pulse);
                drawText("★ NEW HIGH SCORE! ★", 0, 0,
                    "bold 22px 'Segoe UI', Arial, sans-serif", "#FFD700", "#333", 4);
                ctx.restore();
            } else if (save.highScore > 0) {
                drawText("Best: " + formatNum(save.highScore), W / 2, H * 0.61,
                    "bold 16px 'Segoe UI', Arial, sans-serif", "#AAA", "#333", 3);
            }

            // Rewarded ad: opt-in "watch for coins". Only renders in the native
            // app once an ad is loaded (Ads.rewardedAvailable() is false on web).
            if (Ads.rewardedAvailable()) {
                drawButton(W / 2 - 130, H * 0.70 - 26, 260, 52, "📺  WATCH → +50 💰",
                    { bg: "#FFB300", bgDark: "#EF6C00" });
            }

            // Buttons
            drawButton(W / 2 - 110, H * 0.78 - 30, 220, 60, "RESTART", { bg: "#66BB6A", bgDark: "#2E7D32" });
            drawButton(W / 2 - 110, H * 0.88 - 25, 220, 50, "MAIN MENU", { bg: "#5C6BC0", bgDark: "#283593", small: true });

            ctx.globalAlpha = 1;
            // Celebration confetti rains over everything on a new high score.
            drawParticles();
        }
    }

    // ── Draw: Menu ───────────────────────────────────────────
    function drawMenu() {
        ctx.fillStyle = C.grass1;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = C.grass2;
        for (var gy = ((menuBounce * 30) % 40) - 40; gy < H; gy += 40) {
            ctx.fillRect(0, gy, W, 18);
        }

        // Drifting cloud shadows — soft dark ellipses sweeping across the grass
        // for a sense of open sky overhead. Deterministic so they don't pop.
        ctx.save();
        for (var cs = 0; cs < 3; cs++) {
            var csY = (cs * H * 0.4 + menuBounce * 26) % (H + 240) - 120;
            var csX = cs === 1 ? W * 0.5 : (cs === 0 ? W * 0.16 : W * 0.84);
            var csG = ctx.createRadialGradient(csX, csY, 10, csX, csY, 150);
            csG.addColorStop(0, "rgba(0,0,0,0.10)");
            csG.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = csG;
            ctx.beginPath();
            ctx.ellipse(csX, csY, 150, 90, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Drop shadow + chunky outline on road for depth (Sneaky-Sasquatch style)
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(ROAD_L - 14, 0, 4, H);
        ctx.fillRect(ROAD_R + 10, 0, 4, H);
        ctx.fillStyle = C.shoulder;
        roundRect(ROAD_L - 8, 0, ROAD_W + 16, H, 0); ctx.fill();
        ctx.fillStyle = C.road;
        ctx.fillRect(ROAD_L, 0, ROAD_W, H);
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 3;
        ctx.strokeRect(ROAD_L - 8, 0, ROAD_W + 16, H);

        ctx.strokeStyle = C.roadLine;
        ctx.lineWidth = 2;
        ctx.setLineDash([28, 22]);
        ctx.lineDashOffset = -(menuBounce * 80 % 50);
        for (var l = 1; l < 3; l++) {
            ctx.beginPath();
            ctx.moveTo(ROAD_L + l * LANE_W, 0);
            ctx.lineTo(ROAD_L + l * LANE_W, H);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.strokeStyle = C.roadLine;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ROAD_L + 2, 0); ctx.lineTo(ROAD_L + 2, H);
        ctx.moveTo(ROAD_R - 2, 0); ctx.lineTo(ROAD_R - 2, H);
        ctx.stroke();

        drawDecorations(menuBounce);

        // Floating coins
        for (var ci = 0; ci < 4; ci++) {
            var cx = 50 + ci * 130;
            var cy = H * 0.92 + Math.sin(menuBounce * 2 + ci * 1.2) * 10;
            drawCoin(cx, cy, menuBounce + ci);
        }

        // Warm sun-glow behind the logo — a soft golden halo that makes the
        // title feel lit rather than pasted on.
        var titleY = H * 0.13 + Math.sin(menuBounce * 2) * 5;
        ctx.save();
        var glow = ctx.createRadialGradient(W / 2, titleY, 20, W / 2, titleY, 220);
        glow.addColorStop(0, "rgba(255,235,150," + (0.22 + Math.sin(menuBounce * 2) * 0.05) + ")");
        glow.addColorStop(1, "rgba(255,235,150,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, titleY - 220, W, 440);
        ctx.restore();

        // Title
        drawText("LULU'S", W / 2, titleY - 22,
            "bold 56px 'Segoe UI', Arial, sans-serif", SKINS[save.selectedSkin].body, "#333", 7);
        drawText("ROAD TRIP", W / 2, titleY + 28,
            "bold 44px 'Segoe UI', Arial, sans-serif", "#FFF", "#333", 6);

        // Title shine sweep — a soft gleam slides across the words every few
        // seconds, giving the logo a glossy, polished feel.
        var sweep = (menuBounce * 0.30) % 2.6;   // gleam visible while < 1
        if (sweep < 1) {
            var sx = (W / 2 - 170) + sweep * 380;
            ctx.save();
            ctx.beginPath();
            ctx.rect(W / 2 - 170, titleY - 58, 340, 96);
            ctx.clip();
            var shine = ctx.createLinearGradient(sx - 46, 0, sx + 46, 0);
            shine.addColorStop(0, "rgba(255,255,255,0)");
            shine.addColorStop(0.5, "rgba(255,255,255,0.4)");
            shine.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = shine;
            ctx.fillRect(W / 2 - 170, titleY - 58, 340, 96);
            ctx.restore();
        }

        // Car — with a soft ground shadow that breathes with the bob so the car
        // reads as floating just above the road rather than stuck to it.
        var carY = H * 0.36 + Math.sin(menuBounce * 3) * 8;
        var shY = H * 0.36 + 44;
        var shScale = 1 - Math.sin(menuBounce * 3) * 0.10;
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.beginPath();
        ctx.ellipse(W / 2, shY, 34 * shScale, 11 * shScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        drawLuluCar(W / 2, carY, Math.sin(menuBounce * 2) * 0.05, false, menuBounce, distractedMode);

        // Coin balance top-right
        drawCoin(W - 100, 36, menuBounce);
        drawText(formatNum(save.totalCoins), W - 85, 38, "bold 22px 'Segoe UI', Arial, sans-serif", C.coin, "#000", 4, "left");

        // Mute button
        drawIconButton(W - 60, 14, 44, audioMuted ? "🔇" : "🔊", { bg: "#FFFFFF", bgDark: "#BDBDBD" });
        // (No visible 'back to sister picker' — Dina lives behind a secret 5-tap on
        //  the top-left corner. A faint dot hints at it for those in the know.)
        if (menuSecretTaps > 0) {
            ctx.globalAlpha = 0.5;
            for (var st = 0; st < menuSecretTaps; st++) drawText("·", 16 + st * 8, 30, "bold 20px Arial", "#FFF", null, 0);
            ctx.globalAlpha = 1;
        }

        // PLAY button
        drawButton(W / 2 - 110, H * 0.50, 220, 60, "▶ PLAY", { bg: "#66BB6A", bgDark: "#2E7D32" });
        // PARKING button intentionally NOT drawn — parking is reached via the
        // road pull-over now. SHOP + the others keep their positions (the 🌐
        // Shared Road button rect is computed independently in 10f).
        // SHOP button
        drawButton(W / 2 - 110, H * 0.50 + 130, 220, 54, "🛒 SHOP", { bg: "#FFC107", bgDark: "#FF6F00" });

        // Distracted mode toggle
        if (save.distractedUnlocked) {
            var label = "DISTRACTED: " + (distractedMode ? "ON" : "OFF");
            var c1 = distractedMode ? "#FF80AB" : "#9E9E9E";
            var c2 = distractedMode ? "#C2185B" : "#616161";
            drawButton(W / 2 - 110, H * 0.50 + 192, 220, 44, label, { bg: c1, bgDark: c2, small: true });
        }

        // High scores
        if (save.highScore > 0 || save.parkingBestLevel > 0) {
            var bestY = H * 0.82;
            drawText("Best Run: " + formatNum(save.highScore), W / 2, bestY,
                "bold 14px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#333", 3);
            if (save.parkingBestLevel > 0) {
                drawText("🅿 Best Level: " + save.parkingBestLevel,
                    W / 2, bestY + 22,
                    "bold 14px 'Segoe UI', Arial, sans-serif", "#90CAF9", "#333", 3);
            }
        }

        // Transient message banner (e.g. parking unlock / not enough coins)
        if (menuMsgTimer > 0) {
            var mAlpha = clamp(menuMsgTimer, 0, 1);
            ctx.globalAlpha = mAlpha;
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            roundRect(W / 2 - 150, H * 0.42, 300, 34, 10); ctx.fill();
            drawText(menuMsg, W / 2, H * 0.42 + 17, "bold 15px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3);
            ctx.globalAlpha = 1;
        }

        // Soft vignette to frame the scene and draw the eye inward.
        ctx.save();
        var vig = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.30, W / 2, H * 0.45, H * 0.72);
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(1, "rgba(0,0,0,0.22)");
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // Controls hint
        drawText("← → steer · ↑ boost · ↓ slow · M missile · P pause", W / 2, H * 0.97,
            "11px 'Segoe UI', Arial, sans-serif", "#DDD", "#333", 2);

        // Version tag, tucked in the bottom-right corner.
        if (typeof GAME_VERSION !== "undefined")
            drawText("v" + GAME_VERSION, W - 8, H - 10, "10px 'Segoe UI', Arial, sans-serif", "rgba(255,255,255,0.55)", "#333", 2, "right");

        // Shared Road (multiplayer) button + its overlay — drawn LAST so the
        // name/room picker sits on top of everything. Guarded no-op offline.
        if (typeof mpDrawLeaderboard === "function") { try { mpDrawLeaderboard(); } catch (e) {} }
        if (typeof mpDrawParty === "function") { try { mpDrawParty(); } catch (e) {} }
        if (typeof mpMenuButton === "function") { try { mpMenuButton(); } catch (e) {} }
    }

    // ── Draw: Shop ───────────────────────────────────────────
    function drawShop() {
        // bg — vertical gradient gives the slate some depth rather than a flat wall
        var sg = ctx.createLinearGradient(0, 0, 0, H);
        sg.addColorStop(0, "#455A64");
        sg.addColorStop(1, "#263238");
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, W, H);
        // pattern
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        for (var y = 0; y < H; y += 20) {
            for (var x = (y % 40 === 0 ? 0 : 10); x < W; x += 20) {
                ctx.fillRect(x, y, 10, 10);
            }
        }

        // Back button
        drawBackButton(16, 14);

        // Soft golden glow behind the SHOP title.
        ctx.save();
        var shG = ctx.createRadialGradient(W / 2, 38, 8, W / 2, 38, 120);
        shG.addColorStop(0, "rgba(255,215,0,0.18)");
        shG.addColorStop(1, "rgba(255,215,0,0)");
        ctx.fillStyle = shG;
        ctx.fillRect(0, 0, W, 140);
        ctx.restore();

        // Title
        drawText("SHOP", W / 2, 38, "bold 36px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 5);

        // Coin balance
        drawCoin(W - 100, 36, menuBounce);
        drawText(formatNum(save.totalCoins), W - 86, 38, "bold 22px 'Segoe UI', Arial, sans-serif", C.coin, "#000", 4, "left");

        // Tabs
        var tabY = 100, tabH = 44, tabW = W / 3;
        var tabs = [["skins", "Skins"], ["powerups", "Power-Ups"], ["special", "Special"]];
        for (var ti = 0; ti < 3; ti++) {
            var key = tabs[ti][0], lbl = tabs[ti][1];
            var active = shopTab === key;
            ctx.fillStyle = active ? "#FFC107" : "#546E7A";
            roundRect(ti * tabW + 2, tabY, tabW - 4, tabH, active ? 8 : 6); ctx.fill();
            drawText(lbl, ti * tabW + tabW / 2, tabY + tabH / 2,
                "bold 16px 'Segoe UI', Arial, sans-serif",
                active ? "#000" : "#ECEFF1", active ? null : null, 0);
        }

        // Content per tab
        if (shopTab === "skins") drawSkinsTab();
        else if (shopTab === "powerups") drawPowerupsTab();
        else if (shopTab === "special") drawSpecialTab();

        // Toast message
        if (lastBoughtTimer > 0) {
            var alp = clamp(lastBoughtTimer / 1.5, 0, 1);
            ctx.fillStyle = "rgba(0,0,0," + (0.8 * alp) + ")";
            roundRect(W / 2 - 160, H - 70, 320, 50, 10); ctx.fill();
            ctx.globalAlpha = alp;
            drawText(lastBoughtMessage, W / 2, H - 45, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3);
            ctx.globalAlpha = 1;
        }

        // Framing vignette.
        ctx.save();
        var shVig = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.34, W / 2, H * 0.5, H * 0.72);
        shVig.addColorStop(0, "rgba(0,0,0,0)");
        shVig.addColorStop(1, "rgba(0,0,0,0.28)");
        ctx.fillStyle = shVig;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    function drawSkinsTab() {
        var skinKeys = Object.keys(SKINS);
        for (var i = 0; i < skinKeys.length; i++) {
            var col = i % 2, row = Math.floor(i / 2);
            var cx = 20 + col * 230, cy = 165 + row * 145;
            var key = skinKeys[i];
            var skin = SKINS[key];
            var owned = save.ownedSkins.indexOf(key) >= 0;
            var equipped = save.selectedSkin === key;
            var canAfford = save.totalCoins >= skin.price;

            // Card
            ctx.fillStyle = equipped ? "#FFC107" : (owned ? "#66BB6A" : "#546E7A");
            roundRect(cx, cy, 210, 130, 10); ctx.fill();
            ctx.fillStyle = equipped ? "#FFA000" : (owned ? "#388E3C" : "#37474F");
            roundRect(cx, cy, 210, 130, 10);
            ctx.lineWidth = 3; ctx.strokeStyle = "#000"; ctx.stroke();
            ctx.fillStyle = "#263238";
            roundRect(cx + 5, cy + 5, 200, 90, 6); ctx.fill();

            // Car preview
            ctx.save();
            ctx.translate(cx + 105, cy + 50);
            ctx.scale(0.85, 0.85);
            drawLuluCar(0, 0, 0, false, menuBounce, false, key, 1);
            ctx.restore();

            // Name
            drawText(skin.name, cx + 105, cy + 110, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2);
            // Status
            if (equipped) drawText("EQUIPPED", cx + 105, cy + 124, "bold 11px Arial", "#000", null, 0);
            else if (owned) drawText("Tap to equip", cx + 105, cy + 124, "bold 11px Arial", "#000", null, 0);
            else {
                var col2 = canAfford ? "#FFD700" : "#EF5350";
                drawText("💰 " + skin.price, cx + 105, cy + 124, "bold 14px Arial", col2, "#000", 2);
            }
        }
    }

    function drawPowerupsTab() {
        // Missile single
        drawShopCard(40, 156, W - 80, 112, "🚀 Missile", "Destroy 1 car ahead", 20, "Buy +1", save.totalCoins >= 20);
        drawText("You own: " + save.missiles, W / 2, 274, "bold 12px Arial", "#FFD700", "#000", 2);
        // Missile pack
        drawShopCard(40, 290, W - 80, 112, "🚀×5 Mega Pack", "Save 20 coins!", 80, "Buy 5-Pack", save.totalCoins >= 80);
        // Pepper spray — clear an animal (or person!) off the road
        drawShopCard(40, 422, W - 80, 112, "🌶️ Pepper Spray", "Zap an animal off the road!", 15, "Buy +1", save.totalCoins >= 15);
        drawText("You own: " + save.pepperSpray, W / 2, 540, "bold 12px Arial", "#AED581", "#000", 2);
    }

    function drawSpecialTab() {
        drawShopCard(40, 170, W - 80, 170, "📱 Distracted Mode", "Lulu's on her phone! Reverse controls + 2× score.", 1000,
            save.distractedUnlocked ? "OWNED" : "Unlock", save.totalCoins >= 1000 && !save.distractedUnlocked, save.distractedUnlocked);
    }

    function drawShopCard(x, y, w, h, title, desc, price, btnLabel, canAfford, owned) {
        ctx.fillStyle = owned ? "#66BB6A" : "#546E7A";
        roundRect(x, y, w, h, 12); ctx.fill();
        ctx.fillStyle = owned ? "#388E3C" : "#37474F";
        ctx.lineWidth = 3; ctx.strokeStyle = "#000";
        roundRect(x, y, w, h, 12); ctx.stroke();

        drawText(title, x + w / 2, y + 30, "bold 24px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 4);
        drawText(desc, x + w / 2, y + 60, "14px 'Segoe UI', Arial, sans-serif", "#ECEFF1", "#000", 2);
        if (!owned) {
            drawText("💰 " + price, x + w / 2, y + h - 35, "bold 22px Arial", canAfford ? "#FFD700" : "#EF5350", "#000", 3);
            drawText(canAfford ? btnLabel : "Need more coins", x + w / 2, y + h - 12, "bold 14px Arial", "#FFF", "#000", 2);
        } else {
            drawText("✓ " + btnLabel, x + w / 2, y + h - 20, "bold 22px Arial", "#FFF", "#000", 3);
        }
    }

    // ════════════════════════════════════════════════════════
    // ════════════════ DINA MODE & CHARACTER SELECT ══════════
    // ════════════════════════════════════════════════════════

    // ── Drawing: Lulu portrait (for character select card) ─
    function drawLuluPortrait(cx, cy, time, scale) {
        var s = scale || 1;
        var t = time || 0;
        var bob = Math.sin(t * 1.6) * 2;            // gentle idle bob
        var blink = (Math.sin(t * 1.1) > 0.97) ? 1 : 0; // occasional blink
        var hair = save.luluHair;
        var hairDk = shadeColor(hair, -22);
        var hairLt = shadeColor(hair, 30);
        var hairStyle = save.luluHairStyle || "sheitel";   // shape chosen at the salon

        ctx.save();
        ctx.translate(cx, cy + bob);
        ctx.scale(s, s);
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        // ── Pink car peeking behind, lower-left ──
        ctx.save();
        ctx.fillStyle = "#FF5FAE";
        roundRect(-114, 30, 96, 52, 14); ctx.fill();
        ctx.fillStyle = "#FF85C2"; // window shine
        roundRect(-104, 38, 78, 18, 8); ctx.fill();
        ctx.fillStyle = "#C9E9FF";
        roundRect(-100, 40, 70, 13, 6); ctx.fill();
        ctx.fillStyle = "#2A2A33";
        ctx.beginPath(); ctx.arc(-94, 78, 9, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-40, 78, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#5A5A66";
        ctx.beginPath(); ctx.arc(-94, 78, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-40, 78, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // ── Long flowing hair behind (soft, with darker rim) — SHAPE varies ──
        // bouncy = wider & rounder · avigail = taller voluminous tower · sheitel = sleek
        var bhW = hairStyle === "bouncy" ? 62 : hairStyle === "avigail" ? 50 : 54;
        var bhH = hairStyle === "avigail" ? 84 : hairStyle === "bouncy" ? 72 : 74;
        ctx.fillStyle = hairDk;
        ctx.beginPath();
        ctx.ellipse(0, 26, bhW, bhH, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.ellipse(0, 22, bhW - 5, bhH - 6, 0, 0, Math.PI * 2);
        ctx.fill();
        // flowing strand highlights
        ctx.strokeStyle = hairLt;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-34, -2); ctx.quadraticCurveTo(-44, 40, -30, 78);
        ctx.moveTo(34, -2); ctx.quadraticCurveTo(44, 40, 30, 78);
        ctx.stroke();
        // BIG & BOUNCY — two round volume puffs ballooning out at the sides
        if (hairStyle === "bouncy") {
            ctx.fillStyle = hair;
            ctx.beginPath();
            ctx.arc(-50, 4, 20, 0, Math.PI * 2);
            ctx.arc(50, 4, 20, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = hairLt;
            ctx.beginPath();
            ctx.arc(-54, -2, 5, 0, Math.PI * 2);
            ctx.arc(46, -2, 5, 0, Math.PI * 2); ctx.fill();
        }

        // ── Neck ──
        ctx.fillStyle = shadeColor("#FFD9C0", -8);
        roundRect(-9, 16, 18, 22, 6); ctx.fill();

        // ── Face (soft rounded, warm peachy) ──
        ctx.fillStyle = "#FFD9C0";
        ctx.beginPath();
        ctx.ellipse(0, -8, 37, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        // soft shading on face edge
        ctx.fillStyle = "rgba(244,170,140,0.30)";
        ctx.beginPath();
        ctx.ellipse(24, -2, 13, 26, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // ── Hair front: center-parted soft swoop framing the face ──
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.moveTo(-37, -10);
        ctx.quadraticCurveTo(-44, -46, -6, -44);    // left swoop
        ctx.quadraticCurveTo(0, -46, 6, -44);
        ctx.quadraticCurveTo(44, -46, 37, -10);     // right swoop
        ctx.quadraticCurveTo(30, -30, 14, -34);     // right inner part
        ctx.quadraticCurveTo(8, -40, 0, -39);
        ctx.quadraticCurveTo(-8, -40, -14, -34);    // left inner part
        ctx.quadraticCurveTo(-30, -30, -37, -10);
        ctx.closePath();
        ctx.fill();
        // glossy highlight band on hair
        ctx.fillStyle = hairLt;
        ctx.beginPath();
        ctx.ellipse(-20, -34, 11, 4, -0.4, 0, Math.PI * 2);
        ctx.ellipse(20, -34, 11, 4, 0.4, 0, Math.PI * 2);
        ctx.fill();
        // THE 'AVIGAIL' — a tower of curls piled to the heavens + side ringlets
        if (hairStyle === "avigail") {
            ctx.fillStyle = hair;
            var curls = [[-22, -46, 12], [0, -54, 13], [22, -46, 12], [-11, -58, 9], [11, -58, 9], [0, -66, 8]];
            for (var ci = 0; ci < curls.length; ci++) {
                ctx.beginPath(); ctx.arc(curls[ci][0], curls[ci][1], curls[ci][2], 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = hairLt;       // little shines on the curl tower
            for (var cj = 0; cj < curls.length; cj++) {
                ctx.beginPath(); ctx.arc(curls[cj][0] - 3, curls[cj][1] - 3, curls[cj][2] * 0.3, 0, Math.PI * 2); ctx.fill();
            }
        }

        // ── Rosy cheeks ──
        ctx.fillStyle = "rgba(255,150,170,0.55)";
        ctx.beginPath();
        ctx.ellipse(-21, 2, 8, 5.5, 0, 0, Math.PI * 2);
        ctx.ellipse(21, 2, 8, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // ── Eyebrows ──
        ctx.strokeStyle = hairDk;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-19, -22); ctx.quadraticCurveTo(-12, -25, -5, -22);
        ctx.moveTo(19, -22); ctx.quadraticCurveTo(12, -25, 5, -22);
        ctx.stroke();

        // ── Eyes — big bright almond with sparkle ──
        if (blink) {
            ctx.strokeStyle = "#5D4037";
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(-13, -13, 6, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.arc(13, -13, 6, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();
        } else {
            // whites
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.ellipse(-13, -13, 6.5, 7.5, 0, 0, Math.PI * 2);
            ctx.ellipse(13, -13, 6.5, 7.5, 0, 0, Math.PI * 2);
            ctx.fill();
            // iris (warm brown)
            ctx.fillStyle = "#7A4A2B";
            ctx.beginPath();
            ctx.arc(-13, -12, 4.6, 0, Math.PI * 2);
            ctx.arc(13, -12, 4.6, 0, Math.PI * 2);
            ctx.fill();
            // pupil
            ctx.fillStyle = "#241208";
            ctx.beginPath();
            ctx.arc(-13, -12, 2.4, 0, Math.PI * 2);
            ctx.arc(13, -12, 2.4, 0, Math.PI * 2);
            ctx.fill();
            // big sparkle + small sparkle
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(-15, -15, 1.8, 0, Math.PI * 2);
            ctx.arc(11, -15, 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.75)";
            ctx.beginPath();
            ctx.arc(-11, -9, 1, 0, Math.PI * 2);
            ctx.arc(15, -9, 1, 0, Math.PI * 2);
            ctx.fill();
            // upper lash line
            ctx.strokeStyle = "#3E2723";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(-13, -13, 6.5, 1.05 * Math.PI, 1.55 * Math.PI);
            ctx.arc(13, -13, 6.5, 1.05 * Math.PI, 1.55 * Math.PI);
            ctx.stroke();
            // little lash flicks
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-19, -15); ctx.lineTo(-21, -17);
            ctx.moveTo(19, -15); ctx.lineTo(21, -17);
            ctx.stroke();
        }

        // ── Nose (tiny soft) ──
        ctx.fillStyle = "rgba(214,150,120,0.5)";
        ctx.beginPath(); ctx.ellipse(0, 2, 1.8, 2.2, 0, 0, Math.PI * 2); ctx.fill();

        // ── Freckles ──
        ctx.fillStyle = "rgba(180,110,80,0.7)";
        ctx.beginPath();
        ctx.arc(-7, 0, 0.8, 0, Math.PI * 2);
        ctx.arc(-3, 2, 0.7, 0, Math.PI * 2);
        ctx.arc(3, 2, 0.7, 0, Math.PI * 2);
        ctx.arc(7, 0, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // ── Warm friendly smile ──
        ctx.strokeStyle = "#C44E63";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(0, 6, 8, 0.12 * Math.PI, 0.88 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,140,160,0.45)"; // lower lip blush
        ctx.beginPath();
        ctx.ellipse(0, 11, 4, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // ── Trendy top (soft pink, modern crew neck) ──
        ctx.fillStyle = "#FF9CC4";
        roundRect(-37, 38, 74, 54, 16); ctx.fill();
        ctx.fillStyle = "#FFB6D5"; // shoulder highlight
        roundRect(-37, 38, 74, 16, 16); ctx.fill();
        // neckline
        ctx.fillStyle = shadeColor("#FFD9C0", -6);
        ctx.beginPath();
        ctx.ellipse(0, 40, 13, 7, 0, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = "#E97AAE";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 40, 13, 7, 0, 0.05 * Math.PI, 0.95 * Math.PI);
        ctx.stroke();

        // ── Dainty gold heart necklace ──
        ctx.strokeStyle = "#FFD24A";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 40, 18, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = "#FFCB2E";
        ctx.beginPath();
        ctx.arc(-1.8, 56, 1.6, 0, Math.PI * 2);
        ctx.arc(1.8, 56, 1.6, 0, Math.PI * 2);
        ctx.moveTo(-3.2, 56.5);
        ctx.lineTo(0, 60.5);
        ctx.lineTo(3.2, 56.5);
        ctx.fill();

        ctx.restore();
    }

    // ── Drawing: Dina portrait (for character select card) ─
    function drawDinaPortrait(cx, cy, time, scale) {
        var s = scale || 1;
        var t = time || 0;
        var bob = Math.sin(t * 2.0 + 1) * 2.4;          // bouncier kid bob
        var blink = (Math.sin(t * 1.3 + 2) > 0.97) ? 1 : 0;
        var sparkle = 0.6 + 0.4 * Math.sin(t * 3);      // twinkling cheek sparkle
        var HAIR = "#7A4A28", HAIR_DK = "#5E3819", HAIR_LT = "#9E6A40";

        ctx.save();
        ctx.translate(cx, cy + bob);
        ctx.scale(s, s);
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        // ── Long ponytail (right side, behind, bouncy) ──
        var pony = Math.sin(t * 2.2) * 3;
        ctx.fillStyle = HAIR_DK;
        ctx.beginPath();
        ctx.ellipse(46 + pony, 18, 15, 33, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = HAIR;
        ctx.beginPath();
        ctx.ellipse(44 + pony, 16, 12, 29, 0.3, 0, Math.PI * 2);
        ctx.fill();
        // pony shine
        ctx.strokeStyle = HAIR_LT;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(40, -4); ctx.quadraticCurveTo(50 + pony, 18, 44 + pony, 40);
        ctx.stroke();
        // Scrunchie at base of ponytail
        ctx.fillStyle = "#FF63A9";
        ctx.beginPath(); ctx.arc(38, -2, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FF8FC2";
        ctx.beginPath(); ctx.arc(36, -4, 2.4, 0, Math.PI * 2); ctx.fill();

        // ── Cozy hoodie (lavender, soft and rounded) ──
        ctx.fillStyle = "#B79CE6";
        ctx.beginPath();
        ctx.ellipse(0, 60, 44, 38, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        roundRect(-44, 58, 88, 40, 18); ctx.fill();
        // hoodie highlight
        ctx.fillStyle = "#CBB6F0";
        roundRect(-44, 46, 88, 18, 18); ctx.fill();
        // hood collar behind neck
        ctx.fillStyle = "#A487DC";
        ctx.beginPath();
        ctx.ellipse(0, 40, 30, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        // drawstrings
        ctx.strokeStyle = "#7E63C0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-7, 50); ctx.lineTo(-9, 66);
        ctx.moveTo(7, 50); ctx.lineTo(9, 66);
        ctx.stroke();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(-9, 67, 2.4, 0, Math.PI * 2);
        ctx.arc(9, 67, 2.4, 0, Math.PI * 2);
        ctx.fill();
        // little star on hoodie
        ctx.fillStyle = "#FFD93D";
        ctx.beginPath();
        for (var sp = 0; sp < 10; sp++) {
            var sang = -Math.PI / 2 + sp * Math.PI / 5;
            var srad = (sp % 2 === 0) ? 6 : 2.6;
            var spx = 16 + Math.cos(sang) * srad;
            var spy = 74 + Math.sin(sang) * srad;
            if (sp === 0) ctx.moveTo(spx, spy); else ctx.lineTo(spx, spy);
        }
        ctx.closePath();
        ctx.fill();

        // ── Neck ──
        ctx.fillStyle = shadeColor("#FFE2CE", -8);
        roundRect(-8, 18, 16, 20, 6); ctx.fill();

        // ── Face (round, chubby kid cheeks) ──
        ctx.fillStyle = "#FFE2CE";
        ctx.beginPath();
        ctx.ellipse(0, -2, 34, 35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(248,178,148,0.28)"; // soft chin shade
        ctx.beginPath();
        ctx.ellipse(0, 16, 18, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // ── Hair: rounded top + cute bangs ──
        ctx.fillStyle = HAIR;
        ctx.beginPath();
        ctx.ellipse(0, -22, 35, 30, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        // bangs: little rounded scallops across forehead
        ctx.beginPath();
        ctx.moveTo(-34, -20);
        ctx.quadraticCurveTo(-30, -2, -20, -14);
        ctx.quadraticCurveTo(-12, -2, -6, -14);
        ctx.quadraticCurveTo(0, 0, 6, -14);
        ctx.quadraticCurveTo(12, -2, 20, -14);
        ctx.quadraticCurveTo(30, -2, 34, -20);
        ctx.quadraticCurveTo(20, -40, 0, -41);
        ctx.quadraticCurveTo(-20, -40, -34, -20);
        ctx.closePath();
        ctx.fill();
        // hair shine
        ctx.fillStyle = HAIR_LT;
        ctx.beginPath();
        ctx.ellipse(-12, -30, 12, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        // side hair tucked by ears
        ctx.fillStyle = HAIR;
        ctx.beginPath();
        ctx.ellipse(-32, -2, 6, 14, 0.1, 0, Math.PI * 2);
        ctx.ellipse(32, -2, 6, 14, -0.1, 0, Math.PI * 2);
        ctx.fill();
        // cute pink bow on the side
        ctx.fillStyle = "#FF63A9";
        ctx.beginPath();
        ctx.moveTo(-26, -28);
        ctx.lineTo(-34, -33); ctx.lineTo(-34, -23); ctx.closePath();
        ctx.moveTo(-26, -28);
        ctx.lineTo(-18, -33); ctx.lineTo(-18, -23); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#C2185B";
        ctx.beginPath(); ctx.arc(-26, -28, 2.4, 0, Math.PI * 2); ctx.fill();

        // ── Big rosy round cheeks with sparkle ──
        ctx.fillStyle = "rgba(255,140,160,0.6)";
        ctx.beginPath();
        ctx.ellipse(-20, 6, 8, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(20, 6, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255," + (0.35 + 0.35 * sparkle) + ")";
        ctx.beginPath();
        ctx.arc(-22, 4, 1.4, 0, Math.PI * 2);
        ctx.arc(18, 4, 1.4, 0, Math.PI * 2);
        ctx.fill();

        // ── Eyebrows (small, friendly) ──
        ctx.strokeStyle = HAIR_DK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-16, -15); ctx.quadraticCurveTo(-11, -17, -6, -15);
        ctx.moveTo(16, -15); ctx.quadraticCurveTo(11, -17, 6, -15);
        ctx.stroke();

        // ── Eyes — big, round, super sparkly (kid style) ──
        if (blink) {
            ctx.strokeStyle = "#3D2817";
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.arc(-11, -6, 6, 0.12 * Math.PI, 0.88 * Math.PI);
            ctx.arc(11, -6, 6, 0.12 * Math.PI, 0.88 * Math.PI);
            ctx.stroke();
        } else {
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.ellipse(-11, -6, 6.5, 8, 0, 0, Math.PI * 2);
            ctx.ellipse(11, -6, 6.5, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            // big warm-brown iris
            ctx.fillStyle = "#8A5A30";
            ctx.beginPath();
            ctx.arc(-11, -5, 5.2, 0, Math.PI * 2);
            ctx.arc(11, -5, 5.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#2A150A";
            ctx.beginPath();
            ctx.arc(-11, -5, 2.8, 0, Math.PI * 2);
            ctx.arc(11, -5, 2.8, 0, Math.PI * 2);
            ctx.fill();
            // big shiny sparkles
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(-13, -8, 2.2, 0, Math.PI * 2);
            ctx.arc(9, -8, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            ctx.beginPath();
            ctx.arc(-9, -2, 1.2, 0, Math.PI * 2);
            ctx.arc(13, -2, 1.2, 0, Math.PI * 2);
            ctx.fill();
            // top lash line
            ctx.strokeStyle = "#3D2817";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(-11, -6, 6.5, 1.05 * Math.PI, 1.6 * Math.PI);
            ctx.arc(11, -6, 6.5, 1.05 * Math.PI, 1.6 * Math.PI);
            ctx.stroke();
        }

        // ── Tiny nose ──
        ctx.fillStyle = "rgba(220,150,120,0.55)";
        ctx.beginPath(); ctx.arc(0, 6, 1.8, 0, Math.PI * 2); ctx.fill();

        // ── BIG happy open grin with teeth ──
        ctx.fillStyle = "#B23A52";
        ctx.beginPath();
        ctx.ellipse(0, 13, 11, 9, 0, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF"; // teeth
        ctx.beginPath();
        ctx.moveTo(-10, 13);
        ctx.lineTo(10, 13);
        ctx.quadraticCurveTo(10, 17, 0, 17);
        ctx.quadraticCurveTo(-10, 17, -10, 13);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FF7B96"; // little tongue
        ctx.beginPath();
        ctx.ellipse(0, 20, 5, 3, 0, 0, Math.PI);
        ctx.fill();

        // ── Morgan the purple cat plushie held in arms (bottom-left) ──
        var mx = -45, my = 80;
        // Body
        ctx.fillStyle = "#9B8FB4";
        ctx.beginPath(); ctx.ellipse(mx, my + 8, 16, 12, 0, 0, Math.PI * 2); ctx.fill();
        // Head
        ctx.beginPath(); ctx.arc(mx, my - 6, 11, 0, Math.PI * 2); ctx.fill();
        // Ears
        ctx.beginPath();
        ctx.moveTo(mx - 9, my - 12); ctx.lineTo(mx - 4, my - 18); ctx.lineTo(mx - 1, my - 13);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(mx + 1, my - 13); ctx.lineTo(mx + 4, my - 18); ctx.lineTo(mx + 9, my - 12);
        ctx.closePath(); ctx.fill();
        // Inner ear pink
        ctx.fillStyle = "#FFB8D9";
        ctx.beginPath();
        ctx.moveTo(mx - 6, my - 14); ctx.lineTo(mx - 4, my - 16); ctx.lineTo(mx - 2, my - 13);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(mx + 2, my - 13); ctx.lineTo(mx + 4, my - 16); ctx.lineTo(mx + 6, my - 14);
        ctx.closePath(); ctx.fill();
        // Eyes (cute closed arcs)
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mx - 4, my - 6, 1.5, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.arc(mx + 4, my - 6, 1.5, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.stroke();
        // Nose
        ctx.fillStyle = "#FF8AAA";
        ctx.beginPath();
        ctx.moveTo(mx - 1.5, my - 3); ctx.lineTo(mx + 1.5, my - 3); ctx.lineTo(mx, my - 1);
        ctx.closePath(); ctx.fill();
        // Smile stitch
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(mx, my - 1); ctx.quadraticCurveTo(mx - 2, my + 1, mx - 3, my);
        ctx.moveTo(mx, my - 1); ctx.quadraticCurveTo(mx + 2, my + 1, mx + 3, my);
        ctx.stroke();
        // Pink heart on chest
        ctx.fillStyle = "#FF6B9D";
        ctx.beginPath();
        ctx.arc(mx - 2, my + 4, 1.5, 0, Math.PI * 2);
        ctx.arc(mx + 2, my + 4, 1.5, 0, Math.PI * 2);
        ctx.moveTo(mx - 3, my + 4);
        ctx.lineTo(mx, my + 8);
        ctx.lineTo(mx + 3, my + 4);
        ctx.fill();

        ctx.restore();
    }

    // ── Update / Draw: Character Select ──────────────────────