    // ════════════════════════════════════════════════════════════
    //  LULU ON FOOT — "The Long Way to Bubbe's"
    //  A self-contained top-down playthrough that boots up when Lulu's
    //  car is wrecked. She's late for Shabbos dinner and the sun's going
    //  down, so she runs there on foot — managing ONE stamina bar (sprint
    //  to bank distance, walk to recover), dodging strollers/scooters/
    //  hydrants, and outrunning Mom's minivan in the climax.
    //  Cloned from the Dina-run template (08-dina-run.js).
    //  Entered from: the 20% crash reprieve, a parking-sim crash, and
    //  10% of cop pull-overs.  WIN → returnToDriving();  LOSE → gameover.
    // ════════════════════════════════════════════════════════════

    var FOOT_BASE = 165;        // px/sec base run speed (cruise)
    var FOOT_TOTAL_PX = 7800;   // full journey to Bubbe's (~47s at cruise)

    // ── State ────────────────────────────────────────────────
    var footPhase = 0;          // 0 intro · 1 run · 2 outro
    var footTimer = 0;
    var footStartScroll = 0;    // scrollOffset when the run began (progress baseline)
    var footDistance = 0;       // 0..1 progress along the real road
    var footStamina = 100;      // the master resource — empties = caught
    var footHazards = [];
    var footHazardSpawn = 1.0;
    var footStars = 0;
    var footCoinsRun = 0;
    var footLulu = null;
    var momVan = null;          // climax pursuer (spawns ~85%)
    var footEntryReason = "crashReprieve";
    var footRunLevel = 1;
    var footDiff = 1;
    var footEnding = "made";    // "made" | "caught"
    var footIntroLine = "";
    var footBeats = {};         // one-shot story-beat flags
    var footConfetti = [];
    var footBankedCoins = 0, footBankedStars = 0, footWinBonus = 0;
    var footToast = "", footToastT = 0; // brief story-beat banner

    function startFootWorld(reason) {
        footEntryReason = reason;
        footRunLevel = (save.footRunsPlayed || 0) + 1;
        footDiff = Math.min(1 + (footRunLevel - 1) * 0.12, 2.2);
        save.footRunsPlayed = footRunLevel; persistSave();
        footPhase = 0; footTimer = 0; footStartScroll = scrollOffset; footDistance = 0;
        footStamina = 100; footHazards = []; footHazardSpawn = 1.0;
        footStars = 0; footCoinsRun = 0; footToast = ""; footToastT = 0;
        momVan = null; footConfetti = [];
        footBeats = { avigail: false, heshy: false, greenblatt: false, mom: false };
        footEnding = "made";
        footIntroLine =
            reason === "parkingCrash" ? "That's coming out of my deposit.\nDeal with it later — RUN!" :
            reason === "copWalk"      ? "Impounded?! Bubbe's gonna plotz.\n\"Walk it off,\" he says. Fine. I'll WALK." :
                                        "The car's a meatball. But Bubbe lights\ncandles in twenty minutes — RUN!";
        footLulu = { x: W / 2, y: H - 200, walkTime: 0, lane: 1, stumble: 0,
                     mood: "cry", chat: "", chatLife: 0, chatTimer: rand(2.5, 4.5), smokeT: 0 };
        state = "footRun";
        playClick();
    }

    // ── Update ───────────────────────────────────────────────
    function updateFootRun(dt) {
        if (!footLulu) return;
        footTimer += dt;
        updateParticles(dt);            // particles aren't ticked globally in sub-scenes
        if (shakeTimer > 0) shakeTimer -= dt;

        if (footPhase === 0) { updateFootIntro(dt); return; }
        if (footPhase === 2) { updateFootOutro(dt); return; }

        // ── Phase 1: the run ──────────────────────────────────
        if (footToastT > 0) footToastT -= dt;
        var sprint = keys.up && footStamina > 0;
        var slow = keys.down;
        var speedMult = sprint ? 1.9 : (slow ? 0.55 : 1.0);
        if (footLulu.stumble > 0) { speedMult *= 0.3; footLulu.stumble -= dt; }

        // Stamina: the heart of the design. Sprinting burns it, walking
        // recovers it, cruising slowly tires you. Hit 0 → Mom catches you.
        if (sprint) footStamina -= 13 * dt;
        else if (slow) footStamina += 7 * dt;
        else footStamina -= 2.0 * dt;
        footStamina = clamp(footStamina, 0, 100);
        footLulu.mood = footStamina < 28 ? "panic" : "run";

        // Legs visibly spin faster sprinting, plod walking — animation reads the mechanic.
        footLulu.walkTime += dt * (0.4 + speedMult);

        // She's running along the SAME road she drives — advance the real
        // world scroll and keep its zones/seasons/decorations evolving so it's
        // her actual world (cars, buildings, weather), just on two legs.
        var runSpeed = FOOT_BASE * speedMult;
        scrollOffset += runSpeed * dt;
        updateZone(dt, runSpeed);
        updateSeason(dt, runSpeed);
        updateDecorations(dt, runSpeed);
        footDistance = clamp((scrollOffset - footStartScroll) / FOOT_TOTAL_PX, 0, 1);

        // Sprint dust kicked up at her heels (the "boost beam" analog)
        if (sprint) {
            particles.push({ x: footLulu.x + rand(-9, 9), y: footLulu.y + 22,
                vx: rand(-25, 25), vy: rand(18, 55), life: 0.4, maxLife: 0.4,
                size: rand(3, 6), color: randPick(["#D7CCC8", "#BCAAA4", "#CFD8DC"]), gravity: 0 });
        }
        // Winded → sweat drops fly off her head
        if (footLulu.mood === "panic" && Math.random() < dt * 7) {
            particles.push({ x: footLulu.x + rand(-8, 8), y: footLulu.y - 24,
                vx: rand(-40, 40), vy: rand(-40, -10), life: 0.5, maxLife: 0.5,
                size: rand(2, 4), color: "#4FC3F7", gravity: 220 });
        }

        // Steering — finger-drag or arrow keys, exactly like the car, but she
        // stays on the actual road (dodge the traffic between the curbs).
        var minX = ROAD_L + 18, maxX = ROAD_R - 18;
        if (touchX !== null) {
            footLulu.x = lerp(footLulu.x, clamp(touchX, minX, maxX), Math.min(1, 14 * dt));
        } else {
            var mv = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
            footLulu.x = clamp(footLulu.x + mv * 280 * dt, minX, maxX);
        }
        footLulu.lane = footLulu.x < W / 2 - 35 ? 0 : (footLulu.x > W / 2 + 35 ? 2 : 1);

        triggerFootBeats();

        // Hazard density ramps up over the run (and per run level)
        footHazardSpawn -= dt;
        if (footHazardSpawn <= 0 && footDistance < 0.97) {
            footHazardSpawn = rand(0.85, 1.5) * (1 - footDistance * 0.5) / footDiff;
            spawnFootHazard();
            if (footDistance > 0.5 && Math.random() < 0.3 * footDistance * footDiff) spawnFootHazard();
        }

        // Move + collide hazards. Cars drive faster than the road scrolls
        // (they bear down on her); cones/puddles/pickups ride with the road.
        for (var h = footHazards.length - 1; h >= 0; h--) {
            var hz = footHazards[h];
            hz.y += (runSpeed + (hz.vyOwn || 0)) * dt;
            if (hz.type === "car" && hz.swerve) hz.x = hz.baseX + Math.sin(hz.walkTime * 3) * 16; // drunk weave
            hz.walkTime = (hz.walkTime || 0) + dt;
            if (hz.y > H + 80) { footHazards.splice(h, 1); continue; }
            if (hz.hit) continue;
            // Roadside greeters (Avigail/Heshy/Greenblatt) fire as they pass her,
            // not on touch — they live on the shoulder, you don't run into them.
            if (hz.beat) {
                if (hz.y > footLulu.y - 24) { hz.hit = true; handleFootHazard(hz); }
                continue;
            }
            var dx = footLulu.x - hz.x, dy = footLulu.y - hz.y;
            if (dx * dx + dy * dy < (hz.r + 14) * (hz.r + 14)) {
                hz.hit = true;
                handleFootHazard(hz);
            }
        }

        // Mom's minivan — the visible climax pursuer (after Beat 4)
        if (momVan) {
            momVan.t += dt;
            // Closeness driven by stamina: low stamina → van on her heels.
            var targetY = H + 70 - (1 - footStamina / 100) * 200;
            momVan.y = lerp(momVan.y, targetY, Math.min(1, 3 * dt));
            momVan.x = lerp(momVan.x, footLulu.x, dt * 2);
            momVan.honkT -= dt;
            if (momVan.y < footLulu.y + 130 && momVan.honkT <= 0) {
                momVan.honkT = rand(1.4, 2.6); playHonk();
                shakeTimer = 0.2; shakeIntensity = 4;
            }
        }

        // Lulu's running commentary
        footLulu.chatTimer -= dt;
        if (footLulu.chatLife > 0) footLulu.chatLife -= dt;
        if (footLulu.chatTimer <= 0) {
            footLulu.chatTimer = rand(3.5, 6.5);
            footLulu.chatLife = 1.6;
            if (footLulu.stumble > 0) footLulu.chat = randPick(["Oof!", "My ankle!", "Sheitel intact!"]);
            else if (footStamina < 28) footLulu.chat = randPick(["*wheeze*", "I jog... never.", "Cardio is a LIE"]);
            else if (sprint) footLulu.chat = randPick(["Outta my way!", "Coming through!", "MOVE it!"]);
            else if (footDistance > 0.75) footLulu.chat = randPick(["I smell brisket!", "Almost, almost!", "Bubbe, hold the soup!"]);
            else footLulu.chat = randPick(["These are NEW flats.", "Twenty minutes, she said.", "Why is it uphill?!"]);
        }

        // ── End conditions ────────────────────────────────────
        if (footDistance >= 1) { enterFootOutro(true); return; }
        if (footStamina <= 0) { enterFootOutro(false); return; }
    }

    function updateFootIntro(dt) {
        footLulu.smokeT -= dt;
        if (footLulu.smokeT <= 0) {
            footLulu.smokeT = 0.09;
            particles.push({ x: W / 2 - 38 + rand(-10, 10), y: H * 0.42 + rand(-8, 6),
                vx: rand(-18, 18), vy: rand(-55, -25), life: rand(1.0, 1.7), maxLife: 1.4,
                size: rand(7, 13), color: randPick(["#616161", "#9E9E9E", "#757575"]),
                gravity: -22, smoke: true });
        }
        footLulu.walkTime += dt * 1.2;
        if (footTimer > 1.0) footLulu.mood = "run"; // cry → determined
        if (footTimer > 2.9 || consumeClick() || consumeAction()) {
            footPhase = 1; footTimer = 0;
            footLulu.x = W / 2; footLulu.y = H - 200; footLulu.mood = "run";
        }
    }

    function updateFootOutro(dt) {
        for (var i = footConfetti.length - 1; i >= 0; i--) {
            var p = footConfetti[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt; p.vy += 60 * dt;
            if (p.y > H + 20) footConfetti.splice(i, 1);
        }
        footLulu.walkTime += dt * 4;
        // Auto-advance after the celebration, or on a deliberate tap (after a
        // brief grace so a leftover input can't blow past the reward banner).
        if (footTimer > 3.6 || (footTimer > 0.5 && (consumeClick() || consumeAction()))) {
            endFootWorld(footEnding === "made");
        }
    }

    // Fire authored story beats once each, at fixed progress thresholds.
    function triggerFootBeats() {
        if (!footBeats.avigail && footDistance > 0.22) {
            footBeats.avigail = true;
            footHazards.push({ type: "avigailCafe", x: ROAD_L - 16, y: -50, r: 20, walkTime: 0, beat: true });
            footToast = "Avigail's Café — grab a breather!"; footToastT = 2.4;
        }
        if (!footBeats.heshy && footDistance > 0.48) {
            footBeats.heshy = true;
            footHazards.push({ type: "heshyLemonade", x: ROAD_R + 16, y: -50, r: 18, walkTime: 0, beat: true });
        }
        if (!footBeats.greenblatt && footDistance > 0.68) {
            footBeats.greenblatt = true;
            footHazards.push({ type: "greenblatt", x: ROAD_L - 18, y: -45, r: 18, walkTime: 0, greeted: false, beat: true });
        }
        if (!footBeats.mom && footDistance > 0.85) {
            footBeats.mom = true;
            momVan = { x: footLulu.x, y: H + 130, t: 0, honkT: 1.0 };
            footToast = "Mom 📱: I see you on the corner. RUN."; footToastT = 2.6;
        }
    }

    function spawnFootHazard() {
        var lane = randInt(0, 2);
        var lx = LANES[lane];
        var r = Math.random();
        if (r < 0.52) {
            // Real traffic bearing down the lane — the main thing to dodge.
            footHazards.push({ type: "car", x: lx, baseX: lx, y: -80, r: 22,
                color: randPick(C.enemyCols), carType: randInt(0, 2),
                vyOwn: rand(55, 150), swerve: Math.random() < 0.22, walkTime: 0 });
        } else if (r < 0.64) {
            footHazards.push({ type: "cone", x: lx, y: -50, r: 12, walkTime: 0 });
        } else if (r < 0.72) {
            footHazards.push({ type: "puddle", x: lx, y: -48, r: 16, walkTime: 0 });
        } else {
            footHazards.push({ type: randPick(["coin", "coin", "coin", "bagel", "iceCoffee", "star"]),
                x: lx, y: -48, r: 13, walkTime: 0 });
        }
    }

    var FOOT_CAR_YELP = ["HEY! WALKING HERE!", "Watch it, buddy!", "MEEP MEEP?!", "Use a CROSSWALK, lady!", "OY!"];
    function handleFootHazard(hz) {
        var t = hz.type;
        if (t === "car") {
            // Clipped by traffic — the big road hazard. Stumble + a real stamina hit.
            footLulu.stumble = 0.7; footStamina -= 12;
            shakeTimer = 0.35; shakeIntensity = 8;
            spawnCrashBurst(footLulu.x, footLulu.y, false);
            playWompWomp();
            spawnFloater(footLulu.x, footLulu.y - 30, randPick(FOOT_CAR_YELP), "#FFF");
        } else if (t === "cone") {
            footLulu.stumble = 0.5; footStamina -= 6;
            shakeTimer = 0.2; shakeIntensity = 4;
            spawnCrashBurst(hz.x, hz.y, false);
            playTone(180, 0.1, "square", 0.15);
        } else if (t === "puddle") {
            footLulu.stumble = 0.7; footStamina -= 5;
            shakeTimer = 0.2; shakeIntensity = 4;
            spawnSplash(hz.x, footLulu.y);
        } else if (t === "coin") {
            footCoinsRun += 1; runCoins += 1; save.totalCoins += 1;
            spawnCoinSparkle(hz.x, hz.y); playCoin();
            spawnFloater(hz.x, hz.y - 12, "+1 💰", "#FFD700");
        } else if (t === "bagel") {
            footStamina = clamp(footStamina + 18, 0, 100);
            footCoinsRun += 1; runCoins += 1; save.totalCoins += 1;
            playTone(520, 0.1, "triangle", 0.16);
            spawnFloater(hz.x, hz.y - 12, "+18 🥯", "#FFCC80");
        } else if (t === "iceCoffee") {
            footStamina = clamp(footStamina + 30, 0, 100);
            spawnCoinSparkle(hz.x, hz.y);
            playTone(760, 0.1, "sine", 0.16);
            spawnFloater(hz.x, hz.y - 12, "Caffeine!! ⚡", "#8D6E63");
        } else if (t === "star") {
            footStars++;
            playHopJump();
            spawnFloater(hz.x, hz.y - 12, "+⭐", "#FFD700");
        } else if (t === "avigailCafe") {
            footStamina = 100;
            playTone(660, 0.09, "triangle", 0.18);
            setTimeout(function () { playTone(880, 0.1, "triangle", 0.18); }, 80);
            spawnFloater(hz.x, hz.y - 18, "You got this, Lu! 💅", "#FF80AB");
        } else if (t === "heshyLemonade") {
            footCoinsRun += 5; runCoins += 5; save.totalCoins += 5; footStars++;
            footLulu.stumble = 0.45;
            playTone(700, 0.08, "square", 0.14);
            spawnFloater(hz.x, hz.y - 18, "🍋 +5  \"family discount\"", "#FFEE58");
        } else if (t === "greenblatt") {
            if (!hz.greeted) {
                hz.greeted = true;
                footCoinsRun += 5; runCoins += 5; save.totalCoins += 5; footStars++;
                footLulu.stumble = 0.6; // cheek pinch
                playTone(660, 0.08, "triangle", 0.18);
                setTimeout(function () { playTone(880, 0.1, "triangle", 0.18); }, 80);
                spawnFloater(hz.x, hz.y - 22, "🍬 +5  \"You're SO thin!\"", "#FFD700");
            }
        }
    }

    // ── Banking + return ─────────────────────────────────────
    function enterFootOutro(won) {
        footPhase = 2; footTimer = 0;
        // Drain any taps/keys queued DURING the run (phase 1 ignores them, and
        // the phase flip isn't a state change so the loop won't flush them) —
        // otherwise the reward screen would be skipped on its very first frame.
        consumeClick(); consumeAction();
        footEnding = won ? "made" : "caught";
        bankFootRewards(won);
        if (won) {
            spawnFootConfetti();
            playTone(523, 0.1, "triangle", 0.2);
            setTimeout(function () { playTone(659, 0.1, "triangle", 0.2); }, 100);
            setTimeout(function () { playTone(784, 0.12, "triangle", 0.22); }, 200);
            setTimeout(function () { playTone(1046, 0.16, "triangle", 0.24); }, 320);
        } else {
            playWompWomp();
        }
    }

    function bankFootRewards(won) {
        footWinBonus = won ? 30 : 0;
        footBankedCoins = footCoinsRun + footWinBonus;
        footBankedStars = footStars;
        runCoins += footWinBonus;
        save.totalCoins += footWinBonus;
        save.parkingTotalStars = (save.parkingTotalStars || 0) + footBankedStars;
        if (footDistance > (save.footRunHigh || 0)) save.footRunHigh = footDistance;
        persistSave();
    }

    function endFootWorld(won) {
        if (won) {
            // The on-foot detour was the second chance — make it real: she comes
            // back to the road with at least one life (she may have entered the
            // foot world on 0 lives from a fatal crash). copWalk keeps her lives.
            lives = Math.max(lives, 1);
            // Bubbe lends her a car / the wreck got towed & fixed — back to the road.
            returnToDriving();
        } else {
            if (score > save.highScore) save.highScore = Math.floor(score);
            persistSave();
            gameOverAlpha = 0;
            state = "gameover";
        }
    }

    var FOOT_CONFETTI_COLS = ["#FF4FA3", "#FFD700", "#4FC3F7", "#7CFC4F", "#FF8A65", "#BA68C8"];
    function spawnFootConfetti() {
        footConfetti = [];
        for (var i = 0; i < 64; i++) {
            footConfetti.push({ x: rand(0, W), y: rand(-H * 0.4, 0),
                vx: rand(-30, 30), vy: rand(40, 160), size: rand(4, 9),
                color: randPick(FOOT_CONFETTI_COLS), rot: rand(0, Math.PI * 2), spin: rand(-6, 6) });
        }
    }

    // ── Draw ─────────────────────────────────────────────────
    function drawFootRun() {
        if (footPhase === 0) { drawFootIntro(); return; }
        if (footPhase === 2) { drawFootOutro(); return; }

        ctx.save();
        if (shakeTimer > 0) ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));

        // Her real world — same road, decorations, buildings, season/weather.
        drawRoad(scrollOffset);
        drawDecorations(footTimer);
        drawCityBuildings();

        // Hazards with a pulsing telegraph shadow as they approach
        for (var h = 0; h < footHazards.length; h++) {
            var hz = footHazards[h];
            if (!hz.hit && hz.y > 0 && hz.y < footLulu.y - 30) {
                var warn = 0.35 + 0.25 * Math.sin(footTimer * 12);
                ctx.fillStyle = "rgba(0,0,0," + (warn * 0.4) + ")";
                ctx.beginPath();
                ctx.ellipse(hz.x, hz.y + hz.r + 6, hz.r + 4, (hz.r + 4) * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            drawFootHazard(hz);
        }

        drawFootDestination();

        if (momVan) drawMomVan(momVan.x, momVan.y, momVan.t);

        drawLuluTopDown(footLulu.x, footLulu.y, footLulu.walkTime, footLulu.mood);
        drawParticles();
        if (footLulu.chatLife > 0) drawSpeechBubble(footLulu.x, footLulu.y - 58, footLulu.chat, footLulu.walkTime);

        // Mom's headlights crawling closer → danger wash
        if (momVan && momVan.y < footLulu.y + 150) {
            var g = clamp((footLulu.y + 150 - momVan.y) / 150, 0, 1);
            ctx.fillStyle = "rgba(255,210,80," + (g * 0.18) + ")";
            ctx.fillRect(0, 0, W, H);
            if (g > 0.5) {
                ctx.fillStyle = "#FFC107";
                ctx.beginPath(); ctx.arc(footLulu.x + 18, footLulu.y - 30, 8, 0, Math.PI * 2); ctx.fill();
                drawText("!", footLulu.x + 18, footLulu.y - 29, "bold 12px Arial", "#000", null, 0);
            }
        }

        ctx.restore(); // HUD steady (outside shake)
        drawSeasonFx();  // season darkness + weather (rain/snow/fog) over the world
        drawFootHUD();
    }

    function drawFootHUD() {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        roundRect(0, 0, W, 52, 0); ctx.fill();

        // Progress bar (pink) with a house at the end + a Lulu dot
        var barX = 56, barY = 12, barW = W - 112, barH = 12;
        ctx.fillStyle = "rgba(255,255,255,0.2)"; roundRect(barX, barY, barW, barH, 6); ctx.fill();
        ctx.fillStyle = "#FF4FA3"; roundRect(barX, barY, barW * footDistance, barH, 6); ctx.fill();
        ctx.font = "15px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🏠", W - 32, barY + barH / 2);
        ctx.fillStyle = "#FFB0C8";
        ctx.beginPath(); ctx.arc(barX + barW * footDistance, barY + barH / 2, 7, 0, Math.PI * 2); ctx.fill();

        // Stamina bar (green→amber→red)
        var sbX = 56, sbY = 32, sbW = W - 112, sbH = 9, sf = footStamina / 100;
        ctx.fillStyle = "rgba(255,255,255,0.18)"; roundRect(sbX, sbY, sbW, sbH, 4); ctx.fill();
        ctx.fillStyle = sf > 0.5 ? "#7CFC4F" : sf > 0.22 ? "#FFC107" : "#FF5252";
        roundRect(sbX, sbY, sbW * sf, sbH, 4); ctx.fill();
        drawText("🏃", 30, 36, "13px Arial", "#FFF", "#000", 2);
        drawText("STAMINA", sbX + sbW / 2, sbY + sbH / 2, "bold 7px Arial", "rgba(0,0,0,0.5)", null, 0);

        drawText("⭐ " + footStars + "  💰 " + footCoinsRun, 8, 14, "bold 12px Arial", "#FFD700", "#000", 2, "left");
        drawText("Run #" + footRunLevel, W - 8, 14, "bold 11px Arial", "#FFF", "#000", 2, "right");

        // Story-beat toast banner
        if (footToastT > 0) {
            var ta = clamp(footToastT, 0, 1) * clamp((2.6 - footToastT) * 3, 0, 1);
            ctx.globalAlpha = ta;
            ctx.fillStyle = "rgba(0,0,0,0.7)"; roundRect(W / 2 - 150, 60, 300, 26, 8); ctx.fill();
            drawText(footToast, W / 2, 73, "bold 12px Arial", "#FFE082", "#000", 2);
            ctx.globalAlpha = 1;
        }

        if (isTouchDevice) {
            drawIconButton(PARK_FWD_RECT.x, PARK_FWD_RECT.y, PARK_FWD_RECT.w, "⚡",
                { bg: keys.up ? "#FFEB3B" : "#FFC107", bgDark: "#FF6F00" });
            drawIconButton(PARK_REV_RECT.x, PARK_REV_RECT.y, PARK_REV_RECT.w, "🐢",
                { bg: keys.down ? "#FFEB3B" : "#90CAF9", bgDark: "#1565C0" });
            drawText("drag to dodge", W / 2, H - 14, "11px Arial", "#FFFFFF", "#000", 2);
        }
    }

    // ── Intro tableau (phase 0) ──────────────────────────────
    function drawFootIntro() {
        drawRoad(scrollOffset);
        drawDecorations(footTimer);
        drawCityBuildings();
        drawSeasonFx();
        // Dusk wash
        ctx.fillStyle = "rgba(40,20,60,0.22)"; ctx.fillRect(0, 0, W, H);
        // Wrecked pink car, tilted + smoking
        ctx.save();
        ctx.translate(W / 2 - 38, H * 0.42);
        ctx.rotate(0.4);
        drawLuluCar(0, 0, 0, false, footTimer, false, save.selectedSkin, 1);
        ctx.restore();
        drawParticles();
        // Lulu, just climbed out
        drawLuluTopDown(W / 2 + 36, H * 0.42 + 14, footLulu.walkTime, footLulu.mood);
        drawSpeechBubble(W / 2 + 36, H * 0.42 - 44, footIntroLine, footTimer);

        // Title card slides up from the bottom
        var slide = clamp((footTimer - 0.6) / 0.5, 0, 1);
        var cardY = H * 0.7 + (1 - slide) * 80;
        ctx.globalAlpha = slide;
        ctx.fillStyle = "rgba(0,0,0,0.72)";
        roundRect(30, cardY, W - 60, 92, 14); ctx.fill();
        drawText("LULU ON FOOT", W / 2, cardY + 26, "bold 22px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);
        drawText("Get to Bubbe's before sundown 🕯️", W / 2, cardY + 50, "bold 12px Arial", "#FFF8E1", "#000", 2);
        drawText("⚡ run  ·  🐢 slow to catch your breath  ·  drag to dodge",
            W / 2, cardY + 72, "11px Arial", "#B3E5FC", "#000", 2);
        ctx.globalAlpha = 1;
        if (footTimer > 1.3) drawText("tap to start", W / 2, H - 24, "13px Arial", "#FFFFFF", "#000", 2);
    }

    // ── Outro (phase 2) ──────────────────────────────────────
    function drawFootOutro() {
        // Dusk sky → warm porch
        ctx.fillStyle = "#3A2A5C"; ctx.fillRect(0, 0, W, H * 0.42);
        ctx.fillStyle = "#7CB342"; ctx.fillRect(0, H * 0.42, W, H * 0.58);
        // Bubbe's house
        ctx.fillStyle = "#C8A27A"; roundRect(W / 2 - 150, H * 0.16, 300, 290, 12); ctx.fill();
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 3; roundRect(W / 2 - 150, H * 0.16, 300, 290, 12); ctx.stroke();
        ctx.fillStyle = "#6D4C41";
        ctx.beginPath(); ctx.moveTo(W / 2 - 170, H * 0.16); ctx.lineTo(W / 2, H * 0.04); ctx.lineTo(W / 2 + 170, H * 0.16); ctx.closePath(); ctx.fill(); ctx.stroke();
        // Warm windows
        ctx.fillStyle = "#FFE082";
        roundRect(W / 2 - 108, H * 0.24, 56, 56, 5); ctx.fill(); ctx.strokeRect(W / 2 - 108, H * 0.24, 56, 56);
        roundRect(W / 2 + 52, H * 0.24, 56, 56, 5); ctx.fill(); ctx.strokeRect(W / 2 + 52, H * 0.24, 56, 56);
        // Door + two Shabbos candles glowing in the window
        ctx.fillStyle = "#3E2723"; roundRect(W / 2 - 34, H * 0.34, 68, 120, 6); ctx.fill(); ctx.stroke();
        for (var cdl = 0; cdl < 2; cdl++) {
            var cx = W / 2 - 92 + cdl * 12 + (cdl ? 152 : 0);
            ctx.fillStyle = "#FFF3E0"; ctx.fillRect(cx, H * 0.30, 3, 12);
            ctx.fillStyle = "#FFCA28"; ctx.beginPath(); ctx.arc(cx + 1.5, H * 0.30 - 3, 3, 0, Math.PI * 2); ctx.fill();
        }

        // Lulu (and the plate / Mom)
        var lx = W / 2, ly = H * 0.62;
        if (footEnding === "made") {
            var jump = Math.abs(Math.sin(footTimer * 6)) * 20 * Math.max(0, 1 - footTimer / 2.2);
            ctx.save(); ctx.translate(lx, ly - jump); ctx.scale(2.4, 2.4);
            drawLuluTopDown(0, 0, footTimer * 4, "run");
            ctx.restore();
            // Bubbe at the door with a foil plate
            ctx.save(); ctx.translate(lx + 64, ly - 18); ctx.scale(2.2, 2.2);
            drawMomTopDown(0, 0, footTimer * 1.4); // stand-in bubbe sprite
            ctx.restore();
            drawText("🍽️", lx + 40, ly - 28, "20px Arial", "#FFF", "#000", 2);
        } else {
            ctx.save(); ctx.translate(lx, ly); ctx.scale(2.4, 2.4);
            drawLuluTopDown(0, 0, footTimer * 2, "panic");
            ctx.restore();
            // Mom's van pulled up alongside
            ctx.save(); ctx.translate(lx - 86, ly + 4); ctx.scale(1.3, 1.3);
            drawMomVan(0, 0, footTimer);
            ctx.restore();
        }

        var bubble = footEnding === "made" ? "BRISKET!\nI SAVED THE\nBRISKET!" : "...So we\nwalk?";
        drawSpeechBubble(lx, ly - 96, bubble, footTimer * 4);

        // Banner
        ctx.fillStyle = "rgba(0,0,0,0.6)"; roundRect(30, 26, W - 60, 50, 12); ctx.fill();
        drawText(footEnding === "made" ? "YOU MADE IT! 🕯️ Good Shabbos!" : "Mom found you. \"Get in.\"",
            W / 2, 52, "bold 17px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);

        var bonusStr = footWinBonus > 0 ? "  (+" + footWinBonus + " bonus!)" : "";
        drawText("Banked: ⭐ " + footBankedStars + "   💰 " + footBankedCoins + bonusStr,
            W / 2, H - 74, "bold 16px Arial", "#FFD700", "#000", 3);
        drawText(footEnding === "made" ? "Bubbe's lending you a car — back to the road!" : "Run over. Tap to see the score.",
            W / 2, H - 50, "bold 12px Arial", "#FFF8E1", "#000", 2);
        drawText("tap to continue", W / 2, H - 26, "13px Arial", "#FFFFFF", "#000", 2);

        for (var ci = 0; ci < footConfetti.length; ci++) {
            var cp = footConfetti[ci];
            ctx.save(); ctx.translate(cp.x, cp.y); ctx.rotate(cp.rot);
            ctx.fillStyle = cp.color; ctx.fillRect(-cp.size / 2, -cp.size / 2, cp.size, cp.size * 0.6);
            ctx.restore();
        }
    }


    function drawFootDestination() {
        if (footDistance <= 0.78) return;
        var a = clamp((footDistance - 0.78) / 0.22, 0, 1);
        var homeY = -110 + a * 180;
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = "#C8A27A"; roundRect(W / 2 - 74, homeY, 148, 92, 8); ctx.fill();
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 3; roundRect(W / 2 - 74, homeY, 148, 92, 8); ctx.stroke();
        ctx.fillStyle = "#6D4C41";
        ctx.beginPath(); ctx.moveTo(W / 2 - 84, homeY); ctx.lineTo(W / 2, homeY - 42); ctx.lineTo(W / 2 + 84, homeY); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#FFE082";
        ctx.fillRect(W / 2 - 56, homeY + 20, 30, 30); ctx.fillRect(W / 2 + 26, homeY + 20, 30, 30);
        ctx.strokeRect(W / 2 - 56, homeY + 20, 30, 30); ctx.strokeRect(W / 2 + 26, homeY + 20, 30, 30);
        ctx.fillStyle = "#3E2723"; roundRect(W / 2 - 16, homeY + 52, 32, 40, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#FFD700"; roundRect(W / 2 - 34, homeY - 10, 68, 15, 4); ctx.fill();
        ctx.strokeStyle = "#5D4037"; ctx.lineWidth = 2; roundRect(W / 2 - 34, homeY - 10, 68, 15, 4); ctx.stroke();
        drawText("BUBBE'S 🕯️", W / 2, homeY - 2, "bold 10px Arial", "#000", null, 0);
        ctx.restore();
    }

    // ── Running Lulu (top-down) ──────────────────────────────
    function drawLuluTopDown(x, y, walkTime, mood) {
        ctx.save();
        var bob = Math.abs(Math.sin(walkTime * 13)) * 4;
        var lean = Math.sin(walkTime * 13) * 0.05;
        ctx.translate(x, y - bob);
        ctx.rotate(lean);
        var legSwing = Math.sin(walkTime * 16) * 7;
        var armSwing = Math.sin(walkTime * 16) * 0.5;

        // Shadow (stays grounded)
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(0, 22, 16, 4, 0, 0, Math.PI * 2); ctx.fill();

        // Legs (denim) + sneakers
        ctx.fillStyle = "#3F5C8A";
        roundRect(-6, 7 - legSwing, 5, 16 + legSwing, 2); ctx.fill();
        roundRect(1, 7 + legSwing, 5, 16 - legSwing, 2); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        roundRect(-7, 21 - legSwing, 7, 4, 2); ctx.fill();
        roundRect(0, 21 + legSwing, 7, 4, 2); ctx.fill();

        // Swinging arms (behind the body), skin hands
        for (var a = 0; a < 2; a++) {
            ctx.save();
            ctx.translate(a === 0 ? -11 : 11, -3);
            ctx.rotate((a === 0 ? 1 : -1) * armSwing);
            ctx.fillStyle = "#FF9EC3";
            roundRect(-2, 0, 4, 11, 2); ctx.fill();
            ctx.fillStyle = "#FFE0CC";
            ctx.beginPath(); ctx.arc(0, 11, 2.3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        // Body — pink top
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FF9EC3";
        ctx.beginPath(); ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFC0DA";
        ctx.beginPath(); ctx.ellipse(-5, -3, 4, 2.5, -0.2, 0, Math.PI * 2); ctx.fill();
        // little crossbody bag
        ctx.strokeStyle = "#8E5A3C"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(7, 7); ctx.stroke();
        ctx.fillStyle = "#A1674A"; roundRect(5, 4, 7, 6, 2); ctx.fill();

        // Head
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(0, -13, 9.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(0, -13, 8.5, 0, Math.PI * 2); ctx.fill();

        // Hair (luluHair) cap + flowing ponytail streaming behind as she runs
        var hair = save.luluHair || "#8B5A2B";
        ctx.fillStyle = hair;
        ctx.beginPath(); ctx.arc(0, -16, 9, Math.PI, Math.PI * 2); ctx.fill();
        var tail = Math.sin(walkTime * 16) * 3;
        ctx.beginPath(); ctx.ellipse(0 + tail, -2, 4.5, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = shadeColor(hair, 22);
        ctx.beginPath(); ctx.ellipse(-3, -17, 3, 2, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FF4FA3"; // hair tie
        ctx.beginPath(); ctx.arc(0, -9, 1.5, 0, Math.PI * 2); ctx.fill();

        // Face by mood
        if (mood === "cry") {
            ctx.strokeStyle = "#3D2817"; ctx.lineWidth = 1; ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(-3, -13.5, 1.6, 1.15 * Math.PI, 1.85 * Math.PI);
            ctx.arc(3, -13.5, 1.6, 1.15 * Math.PI, 1.85 * Math.PI);
            ctx.stroke(); ctx.lineCap = "butt";
            ctx.fillStyle = "#4FC3F7"; // tears
            ctx.beginPath(); ctx.arc(-3.5, -10.5, 1, 0, Math.PI * 2); ctx.arc(3.5, -10.5, 1, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#A0394D"; ctx.lineWidth = 0.9;
            ctx.beginPath(); ctx.arc(0, -8.5, 2, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
        } else {
            ctx.strokeStyle = "#3D2817"; ctx.lineWidth = 1; ctx.lineCap = "round";
            ctx.beginPath();
            if (mood === "panic") {
                ctx.arc(-2.5, -13, 1.8, 0, Math.PI * 2);
                ctx.arc(2.5, -13, 1.8, 0, Math.PI * 2);
            } else {
                ctx.arc(-2.5, -13, 1.5, 1.1 * Math.PI, 1.9 * Math.PI);
                ctx.arc(2.5, -13, 1.5, 1.1 * Math.PI, 1.9 * Math.PI);
            }
            ctx.stroke(); ctx.lineCap = "butt";
            // mouth
            ctx.strokeStyle = "#A0394D"; ctx.lineWidth = 0.9;
            ctx.beginPath();
            if (mood === "panic") ctx.ellipse(0, -9.5, 1.6, 1.4, 0, 0, Math.PI * 2);
            else ctx.arc(0, -10, 2, 0.12 * Math.PI, 0.88 * Math.PI);
            ctx.stroke();
        }
        // Cheeks (flushed when panicking)
        ctx.fillStyle = mood === "panic" ? "rgba(244,90,90,0.55)" : "rgba(230,140,140,0.45)";
        ctx.beginPath(); ctx.arc(-5, -11, mood === "panic" ? 1.6 : 1.1, 0, Math.PI * 2);
        ctx.arc(5, -11, mood === "panic" ? 1.6 : 1.1, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }

    // ── Mom's minivan (top-down pursuer) ─────────────────────
    function drawMomVan(x, y, t) {
        ctx.save();
        ctx.translate(x, y);
        // Headlight cones reaching up toward Lulu
        var hg = ctx.createLinearGradient(0, -10, 0, -90);
        hg.addColorStop(0, "rgba(255,235,150,0.45)"); hg.addColorStop(1, "rgba(255,235,150,0)");
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.moveTo(-12, -22); ctx.lineTo(-26, -92); ctx.lineTo(-2, -92); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(12, -22); ctx.lineTo(2, -92); ctx.lineTo(26, -92); ctx.closePath(); ctx.fill();
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.beginPath(); ctx.ellipse(2, 6, 26, 40, 0, 0, Math.PI * 2); ctx.fill();
        // Body (sensible-mom silver)
        ctx.fillStyle = "#9E9E9E";
        roundRect(-24, -38, 48, 78, 12); ctx.fill();
        ctx.strokeStyle = "#37474F"; ctx.lineWidth = 2; roundRect(-24, -38, 48, 78, 12); ctx.stroke();
        ctx.fillStyle = "#B0BEC5"; roundRect(-21, -34, 42, 30, 8); ctx.fill();
        // Windshield + a little Mom silhouette
        ctx.fillStyle = "#1D2A3A"; roundRect(-19, -30, 38, 20, 6); ctx.fill();
        ctx.fillStyle = "#5D4037"; ctx.beginPath(); ctx.arc(0, -20, 6, 0, Math.PI * 2); ctx.fill();
        // Headlights
        ctx.fillStyle = "#FFF59D";
        ctx.beginPath(); ctx.arc(-15, -36, 3.5, 0, Math.PI * 2); ctx.arc(15, -36, 3.5, 0, Math.PI * 2); ctx.fill();
        // "MOM" plate
        ctx.fillStyle = "#FFF"; roundRect(-12, 33, 24, 8, 2); ctx.fill();
        drawText("MOM", 0, 37, "bold 6px Arial", "#1565C0", null, 0);
        ctx.restore();
    }

    // ── Hazard / pickup / NPC sprites ────────────────────────
    function drawFootHazard(hz) {
        // Mrs. Greenblatt reuses the Dina-runner crossing-guard sprite.
        if (hz.type === "greenblatt") {
            drawDinaSidewalkHazard(hz);
            return;
        }
        ctx.save();
        ctx.translate(hz.x, hz.y);
        var w = hz.walkTime || 0;
        if (hz.type === "car") {
            // The same enemy car art as the driving game — real traffic.
            drawEnemyCar(0, 0, hz.color, hz.carType);
        } else if (hz.type === "cone") {
            drawCone(0, 0);
        } else if (hz.type === "puddle") {
            drawPuddle(0, 0);
        } else if (hz.type === "coin") {
            drawCoin(0, 0, w);
        } else if (hz.type === "bagel") {
            ctx.fillStyle = "#C8964B"; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#8D6E63"; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFF3E0";
            for (var sd = 0; sd < 7; sd++) { var sa = sd / 7 * Math.PI * 2; ctx.fillRect(Math.cos(sa) * 7 - 0.7, Math.sin(sa) * 7 - 0.7, 1.4, 1.4); }
        } else if (hz.type === "iceCoffee") {
            ctx.fillStyle = "rgba(255,255,255,0.85)"; roundRect(-6, -10, 12, 22, 3); ctx.fill();
            ctx.fillStyle = "#6F4E37"; roundRect(-5, -4, 10, 15, 2); ctx.fill();
            ctx.fillStyle = "#D7CCC8"; ctx.fillRect(-5, -2, 10, 3); // ice
            ctx.strokeStyle = "#E91E63"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(3, -10); ctx.lineTo(6, -18); ctx.stroke();
        } else if (hz.type === "star") {
            drawFootStar(0, 0, 11, "#FFD700");
        } else if (hz.type === "avigailCafe") {
            // little café table + parasol + Avigail seated
            ctx.fillStyle = "#6D4C41"; ctx.fillRect(-1, 2, 2, 14);
            ctx.fillStyle = "#ECEFF1"; ctx.beginPath(); ctx.ellipse(0, 2, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FF80AB"; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(-16, -8); ctx.lineTo(16, -8); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#F8BBD0"; roundRect(8, -6, 9, 14, 4); ctx.fill();
            ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(12, -10, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#6B4423"; ctx.beginPath(); ctx.arc(12, -12, 4.5, Math.PI, Math.PI * 2); ctx.fill();
            if (hz.y > 70 && hz.y < H - 90) drawSpeechBubble(0, -34, "Sit! ...kidding,\nRUN, mami!", w);
        } else if (hz.type === "heshyLemonade") {
            ctx.fillStyle = "#8D6E63"; roundRect(-14, -2, 28, 16, 2); ctx.fill();
            ctx.fillStyle = "#FFF59D"; roundRect(-14, -10, 28, 9, 2); ctx.fill();
            ctx.fillStyle = "#F57F17"; ctx.font = "bold 6px Arial"; ctx.textAlign = "center"; ctx.fillText("LEMONADE", 0, -3.5);
            ctx.fillStyle = "#FFEE58"; ctx.beginPath(); ctx.arc(0, 4, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(10, -2, 4, 0, Math.PI * 2); ctx.fill(); // Heshy
            if (hz.y > 70 && hz.y < H - 90) drawSpeechBubble(0, -26, "Two bucks!", w);
        }
        ctx.restore();
    }

    function drawFootStar(cx, cy, r, col) {
        ctx.fillStyle = col;
        ctx.beginPath();
        for (var i = 0; i < 10; i++) {
            var ang = -Math.PI / 2 + i * Math.PI / 5;
            var rr = i % 2 === 0 ? r : r * 0.45;
            var px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#FFA000"; ctx.lineWidth = 1; ctx.stroke();
    }
