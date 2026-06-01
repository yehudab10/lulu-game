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

        // HUD top bar
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        roundRect(0, 0, W, 50, 0); ctx.fill();
        if (parkingChallengeMode) {
            drawText("LVL " + parkingLevel + " · " + (parkingLevelIntroText.split("· ")[1] || ""),
                W / 2, 18, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);
            drawText("⏱ " + Math.ceil(parkingTimeLeft) + "s", W - 14, 18, "bold 15px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3, "right");
            // lives = small heart icons + count
            drawText("♥ " + parkingChallengeLives, 14, 18, "bold 14px 'Segoe UI', Arial, sans-serif", "#FF80AB", "#000", 2, "left");
            drawText("★ " + parkingChallengeStars, 14, 36, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 2, "left");
            drawText("$" + parkingChallengeCoins, W - 14, 36, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 2, "right");
        } else {
            drawText("PARALLEL PARKING", W / 2, 18, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);
            drawText("⏱ " + Math.ceil(parkingTimeLeft) + "s", W - 30, 18, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3, "right");
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

        // Parking-mode D-pad buttons (always shown for mobile/desktop — they double as a UI hint)
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
            drawText("ICE CREAM TIME!", 0, 38, "bold 22px 'Segoe UI', Arial, sans-serif", "#FFF", "#0D47A1", 5);
            drawText("+50 coins · +500 score", 0, 68, "bold 14px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3);
            ctx.restore();

            // Speech bubble from car: "Yay ice cream!"
            if (parkingCar) {
                drawSpeechBubble(parkingCar.x, parkingCar.y - 50, "YAY ICE CREAM!", gameTime);
            }
        } else if (parkingResult === "fail") {
            ctx.fillStyle = "rgba(0,0,0,0.45)";
            ctx.fillRect(0, 0, W, H);
            drawText("CRASH!", W / 2, H * 0.18, "bold 40px 'Segoe UI', Arial, sans-serif", "#F44336", "#000", 7);
            var msg = parkingFailHit && parkingFailHit.who === "timeout" ? "Out of time!" : "You dinged the other car!";
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
        drawText("Total stars: ★ " + save.parkingTotalStars, W / 2, H * 0.58, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3);
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
        drawPlaying();
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
        ctx.fillStyle = "rgba(0,0,0," + (gameOverAlpha * 0.65) + ")";
        ctx.fillRect(0, 0, W, H);

        if (gameOverAlpha > 0.3) {
            var a = Math.min((gameOverAlpha - 0.3) / 0.4, 1);
            ctx.globalAlpha = a;

            var goShake = Math.sin(gameTime * 12) * (1 - a) * 5;
            drawText("GAME OVER", W / 2 + goShake, H * 0.22,
                "bold 52px 'Segoe UI', Arial, sans-serif", "#F44336", "#333", 6);

            drawText("SCORE", W / 2, H * 0.33,
                "bold 18px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#333", 3);
            drawText(formatNum(Math.floor(score)), W / 2, H * 0.40,
                "bold 40px 'Segoe UI', Arial, sans-serif", "#FFF", "#333", 5);

            drawText("★ " + runCoins + " coins this run", W / 2, H * 0.47,
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

            // Buttons
            drawButton(W / 2 - 110, H * 0.78 - 30, 220, 60, "RESTART", { bg: "#66BB6A", bgDark: "#2E7D32" });
            drawButton(W / 2 - 110, H * 0.88 - 25, 220, 50, "MAIN MENU", { bg: "#5C6BC0", bgDark: "#283593", small: true });

            ctx.globalAlpha = 1;
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

        // Title
        var titleY = H * 0.13 + Math.sin(menuBounce * 2) * 5;
        drawText("LULU'S", W / 2, titleY - 22,
            "bold 56px 'Segoe UI', Arial, sans-serif", SKINS[save.selectedSkin].body, "#333", 7);
        drawText("ROAD TRIP", W / 2, titleY + 28,
            "bold 44px 'Segoe UI', Arial, sans-serif", "#FFF", "#333", 6);

        // Car
        var carY = H * 0.36 + Math.sin(menuBounce * 3) * 8;
        drawLuluCar(W / 2, carY, Math.sin(menuBounce * 2) * 0.05, false, menuBounce, distractedMode);

        // Coin balance top-right
        drawCoin(W - 100, 36, menuBounce);
        drawText(formatNum(save.totalCoins), W - 85, 38, "bold 22px 'Segoe UI', Arial, sans-serif", C.coin, "#000", 4, "left");

        // Mute button
        drawIconButton(W - 60, 14, 44, audioMuted ? "🔇" : "🔊", { bg: "#FFFFFF", bgDark: "#BDBDBD" });
        // Back to character select
        drawBackButton(10, 14);

        // PLAY button
        drawButton(W / 2 - 110, H * 0.50, 220, 60, "▶ PLAY", { bg: "#66BB6A", bgDark: "#2E7D32" });
        // PARKING CHALLENGE button
        drawButton(W / 2 - 110, H * 0.50 + 68, 220, 54, "🅿 PARKING", { bg: "#42A5F5", bgDark: "#0D47A1" });
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
                drawText("🅿 Best Level: " + save.parkingBestLevel + " · ★ " + save.parkingTotalStars,
                    W / 2, bestY + 22,
                    "bold 14px 'Segoe UI', Arial, sans-serif", "#90CAF9", "#333", 3);
            }
        }

        // Controls hint
        drawText("← → steer · ↑ boost · ↓ slow · M missile · P pause", W / 2, H * 0.97,
            "11px 'Segoe UI', Arial, sans-serif", "#DDD", "#333", 2);
    }

    // ── Draw: Shop ───────────────────────────────────────────
    function drawShop() {
        // bg
        ctx.fillStyle = "#37474F";
        ctx.fillRect(0, 0, W, H);
        // pattern
        ctx.fillStyle = "#455A64";
        for (var y = 0; y < H; y += 20) {
            for (var x = (y % 40 === 0 ? 0 : 10); x < W; x += 20) {
                ctx.fillRect(x, y, 10, 10);
            }
        }

        // Back button
        drawBackButton(16, 14);

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
                drawText("★ " + skin.price, cx + 105, cy + 124, "bold 14px Arial", col2, "#000", 2);
            }
        }
    }

    function drawPowerupsTab() {
        // Missile single
        drawShopCard(40, 170, W - 80, 130, "🚀 Missile", "Destroy 1 car ahead", 20, "Buy +1", save.totalCoins >= 20);
        drawText("You own: " + save.missiles, W / 2, 295, "bold 14px Arial", "#FFD700", "#000", 2);
        // Missile pack
        drawShopCard(40, 320, W - 80, 130, "🚀×5 Mega Pack", "Save 20 coins!", 80, "Buy 5-Pack", save.totalCoins >= 80);
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
            drawText("★ " + price, x + w / 2, y + h - 35, "bold 22px Arial", canAfford ? "#FFD700" : "#EF5350", "#000", 3);
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
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);

        // Pink car peeking behind, lower-left
        ctx.fillStyle = "#FF6FB5";
        roundRect(-110, 30, 90, 50, 10); ctx.fill();
        ctx.fillStyle = "#222";
        ctx.beginPath(); ctx.arc(-90, 70, 7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-40, 70, 7, 0, Math.PI * 2); ctx.fill();

        // Long flowing hair behind head (uses chosen hair color)
        ctx.fillStyle = save.luluHair;
        ctx.beginPath();
        ctx.ellipse(0, 20, 50, 70, 0, 0, Math.PI * 2);
        ctx.fill();

        // Face (bright peachy skin to match in-car Lulu)
        ctx.fillStyle = "#FFD4B8";
        ctx.beginPath(); ctx.arc(0, -10, 38, 0, Math.PI * 2); ctx.fill();

        // Hair bangs / front (center-parted)
        ctx.fillStyle = save.luluHair;
        ctx.beginPath();
        ctx.ellipse(-15, -35, 18, 14, -0.3, 0, Math.PI * 2);
        ctx.ellipse(15, -35, 18, 14, 0.3, 0, Math.PI * 2);
        ctx.fill();
        // Center part highlight
        ctx.fillStyle = shadeColor(save.luluHair, 18);
        ctx.fillRect(-1, -40, 2, 12);

        // Eyes — adult almond
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.ellipse(-13, -15, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.ellipse(13, -15, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#5D4037";
        ctx.beginPath();
        ctx.arc(-13, -15, 3, 0, Math.PI * 2);
        ctx.arc(13, -15, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1A0F08";
        ctx.beginPath();
        ctx.arc(-13, -15, 1.5, 0, Math.PI * 2);
        ctx.arc(13, -15, 1.5, 0, Math.PI * 2);
        ctx.fill();
        // Highlight
        ctx.fillStyle = "#FFF";
        ctx.beginPath();
        ctx.arc(-12, -16, 1, 0, Math.PI * 2);
        ctx.arc(14, -16, 1, 0, Math.PI * 2);
        ctx.fill();

        // Subtle eyelashes
        ctx.strokeStyle = "#3E2723";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-17, -18); ctx.lineTo(-13, -19);
        ctx.moveTo(-9, -18); ctx.lineTo(-13, -19);
        ctx.moveTo(17, -18); ctx.lineTo(13, -19);
        ctx.moveTo(9, -18); ctx.lineTo(13, -19);
        ctx.stroke();

        // Eyebrows
        ctx.strokeStyle = "#5D4037";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-19, -23); ctx.quadraticCurveTo(-13, -26, -7, -23);
        ctx.moveTo(19, -23); ctx.quadraticCurveTo(13, -26, 7, -23);
        ctx.stroke();

        // Freckles across nose bridge
        ctx.fillStyle = "#A0623C";
        ctx.beginPath();
        ctx.arc(-5, -3, 0.8, 0, Math.PI * 2);
        ctx.arc(-2, -1, 0.7, 0, Math.PI * 2);
        ctx.arc(2, -2, 0.7, 0, Math.PI * 2);
        ctx.arc(5, -3, 0.8, 0, Math.PI * 2);
        ctx.arc(-3, 1, 0.6, 0, Math.PI * 2);
        ctx.arc(4, 1, 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Nose tip
        ctx.fillStyle = "rgba(180,120,90,0.4)";
        ctx.beginPath(); ctx.ellipse(0, 3, 2, 2.5, 0, 0, Math.PI * 2); ctx.fill();

        // Soft smile
        ctx.strokeStyle = "#A0394D";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 5, 9, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();

        // White tee
        ctx.fillStyle = "#FFFFFF";
        roundRect(-35, 40, 70, 50, 8); ctx.fill();
        // Tee outline
        ctx.strokeStyle = "#D0D0D0";
        ctx.lineWidth = 1.5;
        roundRect(-35, 40, 70, 50, 8); ctx.stroke();
        // Floral embroidery (3 small flowers)
        var flowers = [[-18, 55], [0, 70], [16, 55]];
        for (var f = 0; f < flowers.length; f++) {
            var fx = flowers[f][0], fy = flowers[f][1];
            for (var pp = 0; pp < 5; pp++) {
                var ang = pp * Math.PI * 2 / 5;
                ctx.fillStyle = "#FF4FA3";
                ctx.beginPath();
                ctx.arc(fx + Math.cos(ang) * 3, fy + Math.sin(ang) * 3, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = "#FFD93D";
            ctx.beginPath(); ctx.arc(fx, fy, 1.5, 0, Math.PI * 2); ctx.fill();
        }

        // Gold necklace chain
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 38, 22, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
        // Locket
        ctx.fillStyle = "#FFD700";
        ctx.beginPath(); ctx.arc(0, 42, 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#B8860B";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    // ── Drawing: Dina portrait (for character select card) ─
    function drawDinaPortrait(cx, cy, time, scale) {
        var s = scale || 1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);

        // Long ponytail (right side, behind)
        ctx.fillStyle = "#6B4423";
        ctx.beginPath();
        ctx.ellipse(45, 15, 14, 30, 0.3, 0, Math.PI * 2);
        ctx.fill();
        // Hair tie at base of ponytail
        ctx.fillStyle = "#FF4FA3";
        ctx.beginPath(); ctx.arc(40, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#C2185B";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Pink puffy coat (smaller, more proportional — was way too wide before)
        ctx.fillStyle = "#1A1A1A"; // outline
        ctx.beginPath();
        ctx.ellipse(0, 58, 46, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFB0C8";
        ctx.beginPath();
        ctx.ellipse(0, 58, 44, 38, 0, 0, Math.PI * 2);
        ctx.fill();
        // Subtle puffy texture (smaller circles, less bulgy)
        var puffPoints = [[-32, 50], [-28, 68], [-18, 80], [0, 84], [18, 80], [28, 68], [32, 50]];
        for (var pp2 = 0; pp2 < puffPoints.length; pp2++) {
            ctx.beginPath();
            ctx.arc(puffPoints[pp2][0], puffPoints[pp2][1], 8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = "#FFC5D6"; // highlight
        ctx.beginPath();
        ctx.ellipse(-10, 50, 20, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Coat collar/fur trim
        ctx.fillStyle = "#FAFAFA";
        ctx.beginPath();
        ctx.ellipse(0, 35, 45, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Face (rounder, peachy)
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath();
        ctx.arc(0, -5, 34, 0, Math.PI * 2);
        ctx.fill();

        // Hair top + bangs (across forehead)
        ctx.fillStyle = "#6B4423";
        ctx.beginPath();
        ctx.arc(0, -28, 28, Math.PI, 0);
        ctx.fill();
        // Bangs sweep
        ctx.beginPath();
        ctx.ellipse(-8, -22, 18, 7, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Dimples
        ctx.fillStyle = "rgba(230,140,140,0.5)";
        ctx.beginPath();
        ctx.arc(-18, 8, 3, 0, Math.PI * 2);
        ctx.arc(18, 8, 3, 0, Math.PI * 2);
        ctx.fill();

        // Eyes — happy upturned arcs
        ctx.strokeStyle = "#3D2817";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(-11, -10, 5, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.arc(11, -10, 5, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.stroke();
        ctx.lineCap = "butt";

        // Eyebrows
        ctx.strokeStyle = "#5D4037";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-16, -18); ctx.quadraticCurveTo(-11, -20, -6, -18);
        ctx.moveTo(16, -18); ctx.quadraticCurveTo(11, -20, 6, -18);
        ctx.stroke();

        // Nose
        ctx.fillStyle = "rgba(220,150,120,0.5)";
        ctx.beginPath(); ctx.arc(0, 3, 2, 0, Math.PI * 2); ctx.fill();

        // BIG smile (open with teeth)
        ctx.fillStyle = "#A0394D";
        ctx.beginPath();
        ctx.arc(0, 10, 12, 0, Math.PI);
        ctx.fill();
        // Teeth
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(-9, 10, 18, 5);
        ctx.strokeStyle = "#A0394D";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 10); ctx.lineTo(0, 15);
        ctx.stroke();

        // Morgan the cat plushie held in arms (bottom-left)
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