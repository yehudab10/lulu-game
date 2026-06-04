    // Transient visual-only pickup pops (coin collect rings). Drawn in drawPlaying.
    var coinPops = [];

    // Grant a few seconds of collision immunity when re-entering the driving
    // world from a sub-scene (parking / Avigail / salon / tablet), so the player
    // isn't instantly hit by an obstacle that was already on top of the car.
    // Also recenters the car and clears any obstacle currently overlapping it.
    var REENTRY_IMMUNITY = 3.0; // seconds
    function returnToDriving() {
        state = "playing";
        invincibleTimer = Math.max(invincibleTimer, REENTRY_IMMUNITY);
        if (player) { player.targetX = LANES[1]; player.x = LANES[1]; }
        // Sweep away anything sitting right where the car will be, so the grace
        // window starts clean instead of with a pile-up at the player's feet.
        if (typeof obstacles !== "undefined" && obstacles && player) {
            for (var i = obstacles.length - 1; i >= 0; i--) {
                if (Math.abs(obstacles[i].y - player.y) < 160) obstacles.splice(i, 1);
            }
        }
    }

    function updatePlaying(dt) {
        gameTime += dt;
        var baseGameSpeed = Math.min(BASE_SPEED + gameTime * SPEED_RAMP, MAX_SPEED);
        // Speed control: up = boost, down = slow
        var speedMod = 1;
        if (keys.up) speedMod = 1.6;
        else if (keys.down) speedMod = 0.5;
        gameSpeed = baseGameSpeed * speedMod;
        scrollOffset += gameSpeed * dt;
        var scoreMult = (distractedMode ? 2 : 1) * pointMult;
        var coinMult = (passengerTimer > 0 ? 2 : 1) * pointMult;
        score += gameSpeed * dt * 0.08 * scoreMult;

        // Steering (reversed if distracted)
        var steerInput = getSteer(player.x);
        if (distractedMode) steerInput = -steerInput;
        var steerSpeed = 300;
        player.targetX += steerInput * steerSpeed * dt;
        player.targetX = clamp(player.targetX, ROAD_L + CAR_W / 2 + 4, ROAD_R - CAR_W / 2 - 4);
        player.x = lerp(player.x, player.targetX, Math.min(1, 10 * dt));
        player.tilt = lerp(player.tilt, steerInput * 0.08, Math.min(1, 8 * dt));

        // Timers
        if (invincibleTimer > 0) invincibleTimer -= dt;
        if (shakeTimer > 0) shakeTimer -= dt;
        if (flashTimer > 0) flashTimer -= dt;
        if (passengerTimer > 0) {
            passengerTimer -= dt;
            if (passengerTimer <= 0) {
                passengers = [];
                passengerTimer = 0;
                // Goodbye particles
                for (var pp = 0; pp < 8; pp++) {
                    particles.push({
                        x: player.x + rand(-15, 15), y: player.y + rand(-10, 10),
                        vx: rand(-50, 50), vy: rand(-100, -40),
                        life: 0.6, maxLife: 0.6,
                        size: rand(2, 4), color: "#90A4AE", gravity: 50
                    });
                }
            }
        }

        // Spawn timers
        for (var k in spawnClocks) spawnClocks[k] -= dt;
        var speedFactor = 1 - (baseGameSpeed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED) * 0.4;

        if (spawnClocks.car <= 0) { spawnClocks.car = rand(1.0, 2.2) * speedFactor; spawnObstacle("car"); }
        if (spawnClocks.cone <= 0) { spawnClocks.cone = rand(2.5, 5) * speedFactor; spawnObstacle("cone"); }
        if (spawnClocks.puddle <= 0) { spawnClocks.puddle = rand(4, 8) * speedFactor; spawnObstacle("puddle"); }
        // Pedestrians (→ passenger pickup = 30s double-coin bonus). Rarer now
        // so the bonus is occasional, not constant — tune in 01b-spawn-tuning.js.
        if (tickSpawn("pedestrian", dt) && gameTime > 15) spawnObstacle("ped");
        if (spawnClocks.animal <= 0) {
            spawnClocks.animal = rand(8, 14);
            if (gameTime > 45 && Math.random() < 0.15) spawnDuckParade();
            else spawnAnimal();
        }
        if (spawnClocks.coin <= 0) {
            spawnClocks.coin = rand(0.6, 1.4);
            if (Math.random() > 0.75) spawnCoinLine(); else spawnCoin();
        }
        // Rare extra-life heart (rarity in 01b-spawn-tuning.js)
        if (tickSpawn("heart", dt) && gameTime > 10) spawnHeart();
        // Heshy's pool easter egg — skip if one's already out or Heshy's mid-cameo
        if (tickSpawn("heshyPool", dt) && gameTime > 12 && !heshy) {
            var poolOnScreen = false;
            for (var pq = 0; pq < obstacles.length; pq++) if (obstacles[pq].type === "pool") poolOnScreen = true;
            if (!poolOnScreen) spawnObstacle("pool");
        }
        // Heshy cameo timer
        if (heshy) { heshy.t += dt; if (heshy.t >= heshy.dur) heshy = null; }

        // Roadside encounter events — rarity + randomized order live in
        // 01b-spawn-tuning.js (SPAWN_CONFIG). tickSpawn() handles timing + odds.
        // Parking sign spawn
        if (tickSpawn("parkingSign", dt) && parkingSigns.length === 0 && gameTime > 20) {
            spawnParkingSign();
        }
        // Ice cream sign
        if (tickSpawn("iceCream", dt) && iceCreamSigns.length === 0 && gameTime > 30) {
            spawnIceCreamSign();
        }
        // Avigail walking on the roadside (only if not already with you)
        if (tickSpawn("avigail", dt) && !avigailWalker && !avigailInCar && gameTime > 18) {
            // walks in a lane, scrolls down slower than traffic so Lulu can reach her
            avigailWalker = { x: LANES[randInt(0, 2)], y: -60, walkTime: 0, hitW: 22, hitH: 26 };
        }
        if (avigailWalker) {
            avigailWalker.y += gameSpeed * 0.55 * dt;
            avigailWalker.walkTime += dt;
            if (avigailWalker.y > H + 60) { avigailWalker = null; }
            else if (aabb(player.x, player.y, CAR_W, CAR_H, avigailWalker.x, avigailWalker.y, avigailWalker.hitW, avigailWalker.hitH)) {
                avigailWalker = null;
                startAvigailScene();
                return;
            }
        }
        // Salon sign on the roadside
        if (tickSpawn("salon", dt) && salonSigns.length === 0 && gameTime > 25) {
            salonSigns.push({ x: LANES[randInt(0, 2)], y: -60, hitW: 30, hitH: 34, bob: 0 });
        }
        for (var ssi = salonSigns.length - 1; ssi >= 0; ssi--) {
            var ssg = salonSigns[ssi];
            ssg.y += gameSpeed * dt;
            ssg.bob += dt;
            if (ssg.y > H + 60) { salonSigns.splice(ssi, 1); continue; }
            if (aabb(player.x, player.y, CAR_W, CAR_H, ssg.x, ssg.y, ssg.hitW, ssg.hitH)) {
                salonSigns.splice(ssi, 1);
                startSalonScene();
                return;
            }
        }
        // Sasquatch easter egg
        if (tickSpawn("sasquatch", dt) && !sasquatch && gameTime > 35) {
            spawnSasquatch();
        }
        // Billboards
        billboardTimer -= dt;
        if (billboardTimer <= 0) {
            billboardTimer = rand(8, 18);
            spawnBillboard();
        }
        // Ima's text messages — random buzz with phone icon
        imaTextTimer -= dt;
        if (imaTextTimer <= 0 && !imaText && gameTime > 25) {
            imaTextTimer = rand(45, 90);
            // 1 in 3 chance it's Esti (the ex-bff); otherwise Ima
            if (Math.random() < 0.33) {
                imaText = { msg: randPick(ESTI_TEXTS), t: 0, dur: 4.5, sender: "esti" };
            } else {
                imaText = { msg: randPick(IMA_TEXTS), t: 0, dur: 4.0, sender: "ima" };
            }
            // Phone buzz sound
            playTone(180, 0.06, "square", 0.12);
            setTimeout(function () { playTone(180, 0.06, "square", 0.12); }, 100);
            setTimeout(function () { playTone(180, 0.06, "square", 0.12); }, 200);
        }
        if (imaText) {
            imaText.t += dt;
            if (imaText.t > imaText.dur) imaText = null;
        }

        // Missile firing
        if (consumeMissile()) fireMissile();
        // Honk Symphony — pitched by chain count
        if (consumeHonk() && honkCooldown <= 0) {
            honkChain = Math.min(honkChain + 1, 7);
            honkChainResetTimer = 1.5;
            // Notes of a C-major scale: each successive honk = next note up
            var notes = [262, 294, 330, 349, 392, 440, 494, 523];
            playHonkPitched(notes[honkChain - 1]);
            honkCooldown = 0.32;
            // Show "+chain" floater on big chains
            if (honkChain >= 4) spawnFloater(player.x, player.y - 40, "♪ " + honkChain + "x!", "#FFEB3B");
            // Make pedestrians wave and animals scatter
            for (var hh = 0; hh < obstacles.length; hh++) {
                if (obstacles[hh].type === "ped") obstacles[hh].waving = 1.5;
            }
            for (var hk = 0; hk < animals.length; hk++) animals[hk].vx *= 1.5;
        }
        honkChainResetTimer -= dt;
        if (honkChainResetTimer <= 0) honkChain = 0;

        // Pause check
        if (consumePause()) {
            prevState = "playing";
            state = "paused";
            playClick();
            return;
        }

        // Click on pause/missile buttons (mouse fallback — touch path already routes via hitGameButton)
        var click = consumeClick();
        if (click) {
            if (pointInRect(click.x, click.y, PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, PAUSE_RECT.h)) {
                prevState = "playing"; state = "paused"; playClick(); return;
            } else if (pointInRect(click.x, click.y, MISSILE_RECT.x, MISSILE_RECT.y, MISSILE_RECT.w, MISSILE_RECT.h)) {
                fireMissile();
            }
        }

        // Update obstacles
        for (var i = obstacles.length - 1; i >= 0; i--) {
            var o = obstacles[i];
            o.y += gameSpeed * o.speedMult * dt;
            if (o.walkTime !== undefined) o.walkTime += dt;
            if (o.y > H + 100) { obstacles.splice(i, 1); continue; }

            if (aabb(player.x, player.y, CAR_W * 0.7, CAR_H * 0.7, o.x, o.y, o.hitW, o.hitH)) {
                if (o.type === "ped") {
                    // Pick up the pedestrian as passenger! Always (even during invincibility).
                    pickUpPassenger(o);
                    obstacles.splice(i, 1);
                    continue;
                }
                if (o.type === "pool") {
                    // Easter egg — never a penalty. Summon Heshy + grant a shield.
                    triggerHeshy();
                    obstacles.splice(i, 1);
                    continue;
                }
                if (invincibleTimer <= 0) hitPlayer(o);
            } else if (o.type === "car" && !o.nearMissed && invincibleTimer <= 0) {
                // ── Near-miss "whoosh" reward: barely dodge an enemy car ──
                // Trigger once per car, when it's roughly alongside us but not touching.
                var dyNM = Math.abs(o.y - player.y);
                var dxNM = Math.abs(o.x - player.x);
                if (dyNM < CAR_H * 0.55 && dxNM > (CAR_W + o.hitW) * 0.5 && dxNM < CAR_W * 1.05) {
                    o.nearMissed = true;
                    score += 15 * scoreMult;
                    spawnFloater((o.x + player.x) / 2, player.y - 8, "WHOOSH!", "#80D8FF");
                    // small spark line in the gap between the two cars
                    var sside = o.x < player.x ? -1 : 1;
                    for (var nm = 0; nm < 5; nm++) {
                        particles.push({
                            x: player.x + sside * (CAR_W * 0.5) + rand(-3, 3),
                            y: player.y + rand(-CAR_H * 0.3, CAR_H * 0.3),
                            vx: sside * rand(20, 60), vy: rand(120, 200),
                            life: 0.3, maxLife: 0.3,
                            size: rand(1.5, 3), color: "#B3E5FC", gravity: 0
                        });
                    }
                    playTone(720, 0.05, "sine", 0.06, 1100);
                }
            }
        }

        // Update missiles
        for (var mi = missiles.length - 1; mi >= 0; mi--) {
            var m = missiles[mi];
            m.y -= 700 * dt;
            m.time += dt;
            if (m.y < -40) { missiles.splice(mi, 1); continue; }
            // collision with obstacles (cars, pedestrians)
            for (var oi = obstacles.length - 1; oi >= 0; oi--) {
                var ob = obstacles[oi];
                if (ob.type !== "car" && ob.type !== "ped") continue;
                if (aabb(m.x, m.y, m.hitW, m.hitH, ob.x, ob.y, ob.hitW, ob.hitH)) {
                    spawnCrashBurst(ob.x, ob.y, true);
                    playExplosion();
                    obstacles.splice(oi, 1);
                    missiles.splice(mi, 1);
                    score += 50;
                    break;
                }
            }
        }

        // Update coins
        for (var j = coinEntities.length - 1; j >= 0; j--) {
            var c = coinEntities[j];
            c.y += gameSpeed * dt;
            if (c.y > H + 50) { coinEntities.splice(j, 1); continue; }
            // ── Coin magnet: gentle pull toward the car when it's close ──
            var mdx = player.x - c.x, mdy = player.y - c.y;
            var mdist = Math.sqrt(mdx * mdx + mdy * mdy);
            if (mdist < 70 && mdist > 1) {
                var pull = (1 - mdist / 70) * 240 * dt;
                c.x += (mdx / mdist) * pull;
                c.y += (mdy / mdist) * pull;
            }
            if (!c.collected && aabb(player.x, player.y, CAR_W, CAR_H * 0.8, c.x, c.y, c.hitW, c.hitH)) {
                c.collected = true;
                runCoins += coinMult;
                save.totalCoins += coinMult;
                persistSave();
                score += 100 * scoreMult * coinMult;
                spawnCoinSparkle(c.x, c.y);
                spawnFloater(c.x, c.y, "+" + coinMult, "#FFD700");
                // little pop ring that scales up and fades
                coinPops.push({ x: c.x, y: c.y, t: 0 });
                if (coinPops.length > 12) coinPops.shift();
                playCoin();
                coinEntities.splice(j, 1);
            }
        }
        // Age coin-pickup pops
        for (var cp = coinPops.length - 1; cp >= 0; cp--) {
            coinPops[cp].t += dt;
            if (coinPops[cp].t > 0.35) coinPops.splice(cp, 1);
        }

        // Update heart pickups (rare extra life)
        for (var hj = heartEntities.length - 1; hj >= 0; hj--) {
            var he = heartEntities[hj];
            he.y += gameSpeed * dt;
            he.bob += dt;
            if (he.y > H + 50) { heartEntities.splice(hj, 1); continue; }
            if (!he.collected && aabb(player.x, player.y, CAR_W, CAR_H * 0.8, he.x, he.y, he.hitW, he.hitH)) {
                he.collected = true;
                // Lives can now climb past the starting 3 (capped at 9 so the
                // HUD stays sane).
                lives = Math.min(lives + 1, 9);
                spawnFloater(he.x, he.y, "+1 ♥", "#FF4081");
                spawnCoinSparkle(he.x, he.y);
                playTone(880, 0.1, "sine", 0.18, 1320);
                setTimeout(function () { playTone(1320, 0.1, "sine", 0.16, 1760); }, 80);
                heartEntities.splice(hj, 1);
            }
        }

        // Update animals
        for (var kk = animals.length - 1; kk >= 0; kk--) {
            var a = animals[kk];
            a.y += gameSpeed * 0.5 * dt;
            a.x += a.vx * dt;
            a.walkTime += dt;
            if (a.y > H + 80 || a.x < -50 || a.x > W + 50) { animals.splice(kk, 1); continue; }
            if (invincibleTimer <= 0 &&
                aabb(player.x, player.y, CAR_W * 0.7, CAR_H * 0.6, a.x, a.y, a.hitW, a.hitH)) {
                hitPlayer(a);
                animals.splice(kk, 1);
            }
        }

        // Dust particles at speed
        dustTimer -= dt;
        if (gameSpeed > 300 && dustTimer <= 0) {
            dustTimer = 0.06;
            particles.push({
                x: player.x + rand(-8, 8),
                y: player.y + CAR_H / 2 + 5,
                vx: rand(-15, 15), vy: rand(20, 50),
                life: 0.3, maxLife: 0.3,
                size: rand(2, 4), color: "#9E9E9E", gravity: 0
            });
        }

        // Parking signs scroll + collision
        for (var ps = parkingSigns.length - 1; ps >= 0; ps--) {
            var psi = parkingSigns[ps];
            psi.y += gameSpeed * dt;
            psi.bob += dt;
            if (psi.y > H + 60) { parkingSigns.splice(ps, 1); continue; }
            if (aabb(player.x, player.y, CAR_W, CAR_H * 0.8, psi.x, psi.y, psi.hitW, psi.hitH)) {
                parkingSigns.splice(ps, 1);
                triggerParkingMinigame();
                return;
            }
        }
        // Ice cream signs (roadside; only collected if Lulu is at the edge)
        for (var ic = iceCreamSigns.length - 1; ic >= 0; ic--) {
            var ici = iceCreamSigns[ic];
            ici.y += gameSpeed * dt;
            ici.bob += dt;
            if (ici.y > H + 60) { iceCreamSigns.splice(ic, 1); continue; }
            if (aabb(player.x, player.y, CAR_W, CAR_H, ici.x, ici.y, ici.hitW, ici.hitH)) {
                iceCreamSigns.splice(ic, 1);
                // Quick bonus
                runCoins += 5;
                save.totalCoins += 5;
                persistSave();
                playCoin();
                parkingMsg = "🍦 ICE CREAM! +5";
                parkingMsgTimer = 2;
                kidsInCar = true; // celebrate!
                spawnCoinSparkle(ici.x, ici.y);
            }
        }
        // Sasquatch update — now interactive: honk near him to pick him up!
        if (sasquatch) {
            sasquatch.timer += dt;
            sasquatch.walkTime += dt;
            sasquatch.y += gameSpeed * 0.4 * dt;
            if (sasquatch.phase === 0 && sasquatch.timer > 0.8) {
                sasquatch.phase = 1; sasquatch.timer = 0;
            }
            else if (sasquatch.phase === 1 && sasquatch.timer > 3.5) {
                if (!sasquatch.waved) {
                    runCoins += 10;
                    save.totalCoins += 10;
                    persistSave();
                    parkingMsg = "🦍 SASQUATCH! +10";
                    parkingMsgTimer = 2;
                    sasquatch.waved = true;
                }
                sasquatch.phase = 2; sasquatch.timer = 0;
            }
            else if (sasquatch.phase === 2 && (sasquatch.timer > 1.5 || sasquatch.y > H + 40)) {
                sasquatch = null;
            }
            // Check honk pickup: if player honked while sasquatch is in wave-phase + on screen
            if (sasquatch && sasquatch.phase === 1 && honkChain > 0 && honkChainResetTimer > 1.3 &&
                sasquatch.y > 0 && sasquatch.y < H) {
                sasquatchPassenger = 20; // 20 sec in car
                runCoins += 25;
                save.totalCoins += 25;
                persistSave();
                parkingMsg = "🦍 HITCHHIKER! +25";
                parkingMsgTimer = 2.5;
                spawnFloater(sasquatch.x, sasquatch.y, "♥", "#FF80AB");
                sasquatch = null;
            }
        }
        // Sasquatch passenger timer (decrements while in car)
        if (sasquatchPassenger > 0) {
            sasquatchPassenger -= dt;
            if (sasquatchPassenger <= 0) {
                parkingMsg = "🐟 Sasquatch left you a fish!";
                parkingMsgTimer = 2.5;
                runCoins += 50; // parting gift
                save.totalCoins += 50;
                persistSave();
            }
        }
        // Billboard scroll
        for (var bb = billboards.length - 1; bb >= 0; bb--) {
            billboards[bb].y += gameSpeed * billboards[bb].parallax * dt;
            if (billboards[bb].y > H + 60) billboards.splice(bb, 1);
        }
        // Message timer
        if (parkingMsgTimer > 0) parkingMsgTimer -= dt;
        // Honk cooldown
        if (honkCooldown > 0) honkCooldown -= dt;

        updateDecorations(dt, gameSpeed);
        updateParticles(dt);
    }

    function hitPlayer(obj) {
        lives--;
        invincibleTimer = INVINCIBLE_TIME;
        shakeTimer = 0.4;
        shakeIntensity = 6;
        flashTimer = 0.15;
        spawnCrashBurst(obj.x, obj.y, false);
        if (lives <= 0) {
            // BIG crash + angry-man sequence
            crashX = player.x;
            crashY = player.y;
            crashRot = 0;
            crashRotVel = rand(-8, 8);
            spawnCrashBurst(player.x, player.y, true);
            playExplosion();
            setTimeout(playWompWomp, 400);
            state = "crash";
            crashPhase = 0;
            crashPhaseTimer = 1.4; // explosion duration
            shakeTimer = 0.8;
            shakeIntensity = 10;
            angryMan = null;
            revengeCar = null;
            if (score > save.highScore) {
                save.highScore = Math.floor(score);
            }
            persistSave();
        } else {
            playWompWomp();
        }
    }

    // ── Update: Paused ───────────────────────────────────────
    function updatePaused(dt) {
        var click = consumeClick();
        if (click) {
            // Resume button
            if (pointInRect(click.x, click.y, W / 2 - 110, H / 2 - 55, 220, 56)) {
                state = prevState; playClick(); resumeMusic(); consumeAction(); return;
            }
            // Music toggle
            if (pointInRect(click.x, click.y, W / 2 - 110, H / 2 + 13, 220, 52)) {
                musicMuted = !musicMuted;
                if (musicMuted) pauseMusic(); else resumeMusic();
                playClick(); consumeAction(); return;
            }
            // SFX toggle
            if (pointInRect(click.x, click.y, W / 2 - 110, H / 2 + 75, 220, 52)) {
                audioMuted = !audioMuted;
                if (audioMuted) pauseMusic(); else resumeMusic();
                playClick(); consumeAction(); return;
            }
            // Quit button
            if (pointInRect(click.x, click.y, W / 2 - 110, H / 2 + 137, 220, 52)) {
                if (inTabletMode) { inTabletMode = false; state = "dinaHome"; playClick(); consumeAction(); return; }
                // Cookie Catch is a bedroom activity — quit back to the bedroom.
                if (prevState === "cookieCatch") { cookie = null; enterDinaHome(); playClick(); consumeAction(); return; }
                state = "menu"; parkingChallengeMode = false; playClick(); consumeAction(); return;
            }
            consumeAction();
            return;
        }
        if (consumePause()) {
            state = prevState;
            playClick();
            resumeMusic();
            return;
        }
    }

    // ── Update: Crash ────────────────────────────────────────
    var ANGRY_YELLS = [
        "MY CAR!",
        "YOU MANIAC!",
        "I'M CALLING\nTHE COPS!",
        "GET OFF\nTHE ROAD!",
        "LEARN TO\nDRIVE!!"
    ];
    var angryYell = "";

    function updateCrash(dt) {
        crashPhaseTimer -= dt;
        shakeTimer -= dt;
        flashTimer -= dt;
        crashRot += crashRotVel * dt;
        crashRotVel *= 0.96; // friction
        updateParticles(dt);

        // Phase 0: initial explosion (no scrolling — everything stops)
        if (crashPhase === 0) {
            if (crashPhaseTimer <= 0) {
                // Spawn angry man on the opposite side of Lulu's car
                var fromLeft = player.x > W / 2;
                angryMan = {
                    x: fromLeft ? -30 : W + 30,
                    y: player.y + 50,
                    targetX: player.x + (fromLeft ? -38 : 38),
                    time: 0,
                    state: "running",
                    runDir: fromLeft ? 1 : -1
                };
                angryYell = randPick(ANGRY_YELLS);
                crashPhase = 1;
            }
            return;
        }

        // Phase 1: man runs in
        if (crashPhase === 1) {
            angryMan.time += dt;
            var dir = angryMan.targetX - angryMan.x;
            var runSpeed = 220;
            if (Math.abs(dir) > 5) {
                angryMan.x += Math.sign(dir) * runSpeed * dt;
            } else {
                angryMan.x = angryMan.targetX;
                angryMan.state = "yelling";
                crashPhase = 2;
                crashPhaseTimer = 2.2;
                // small dust puff
                for (var i = 0; i < 6; i++) {
                    particles.push({
                        x: angryMan.x + rand(-6, 6), y: angryMan.y + 18,
                        vx: rand(-30, 30), vy: rand(-30, -5),
                        life: 0.5, maxLife: 0.5,
                        size: rand(2, 4), color: "#BCAAA4", gravity: 40
                    });
                }
            }
            return;
        }

        // Phase 2: man yelling — spawn a revenge car coming down
        if (crashPhase === 2) {
            angryMan.time += dt;
            if (crashPhaseTimer <= 0 && !revengeCar) {
                revengeCar = {
                    x: angryMan.x,
                    y: -100,
                    color: randPick(C.enemyCols),
                    carType: randInt(0, 2),
                    vy: 700,
                    hitW: 36, hitH: 64
                };
            }
            if (revengeCar) {
                revengeCar.y += revengeCar.vy * dt;
                if (revengeCar.y >= angryMan.y - 10) {
                    // SLAM!
                    angryMan.state = "hit";
                    spawnCrashBurst(angryMan.x, angryMan.y, true);
                    playExplosion();
                    setTimeout(playWompWomp, 300);
                    shakeTimer = 0.6;
                    shakeIntensity = 12;
                    crashPhase = 3;
                    crashPhaseTimer = 1.4;
                    // revenge car keeps going off-screen
                }
            }
            return;
        }

        // Phase 3: aftermath — car drives past, fade out
        if (crashPhase === 3) {
            if (revengeCar) {
                revengeCar.y += revengeCar.vy * dt;
            }
            if (crashPhaseTimer <= 0) {
                state = "gameover";
                gameOverAlpha = 0;
                Ads.onGameOver(); // interstitial in the native app; no-op on web
            }
            return;
        }
    }

    // ── Update: Game Over ────────────────────────────────────
    function updateGameOver(dt) {
        gameOverAlpha = Math.min(gameOverAlpha + dt * 2, 1);
        // Clear residual angry-man/revenge-car state so they don't keep moving
        if (angryMan) angryMan = null;
        if (revengeCar) revengeCar = null;
        updateParticles(dt);
        var click = consumeClick();
        if (click) {
            // Rewarded ad button (native only — gated by an actually-loaded ad)
            if (Ads.rewardedAvailable() &&
                pointInRect(click.x, click.y, W / 2 - 130, H * 0.70 - 26, 260, 52)) {
                Ads.showRewarded(function () {
                    runCoins += 50; save.totalCoins += 50; persistSave();
                    spawnFloater(W / 2, H * 0.40, "+50 ★", "#FFD700");
                });
                playClick(); return;
            }
            // Restart button
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.78 - 30, 220, 60)) {
                resetGame(); state = "playing"; playClick(); return;
            }
            // Menu button
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.88 - 25, 220, 50)) {
                if (inTabletMode) { inTabletMode = false; state = "dinaHome"; playClick(); return; }
                state = "charSelect"; playClick(); return;
            }
        }
        if (consumeAction()) {
            resetGame(); state = "playing";
        }
    }

    // ── Update: Menu ─────────────────────────────────────────
    function updateMenu(dt) {
        menuBounce += dt;
        updateDecorations(dt, 80);
        var click = consumeClick();
        if (click) {
            // PLAY button
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.50, 220, 60)) {
                resetGame(); gotoState("playing"); playClick(); return;
            }
            // PARKING CHALLENGE button
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.50 + 68, 220, 54)) {
                resetGame();
                startParkingChallenge();
                playClick(); return;
            }
            // SHOP button
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.50 + 130, 220, 54)) {
                state = "shop"; shopTab = "skins"; playClick(); return;
            }
            // Distracted mode toggle (if unlocked)
            if (save.distractedUnlocked &&
                pointInRect(click.x, click.y, W / 2 - 110, H * 0.50 + 192, 220, 44)) {
                distractedMode = !distractedMode; playClick(); return;
            }
            // Mute button
            if (pointInRect(click.x, click.y, W - 60, 14, 44, 44)) {
                audioMuted = !audioMuted;
                if (audioMuted) stopMusic();
                else { var prev = musicState; musicState = null; if (prev) startMusic(prev); else startMusic("lulu"); }
                playClick();
                return;
            }
            // Back to character select (top-left)
            if (pointInRect(click.x, click.y, 10, 14, 80, 44)) {
                gotoState("charSelect"); playClick(); return;
            }
            // Default: any click in upper area starts game
            if (click.y > H * 0.3 && click.y < H * 0.45) {
                resetGame(); state = "playing"; playClick(); return;
            }
        }
        if (consumeAction()) {
            resetGame(); state = "playing";
        }
    }

    // ── Update: Shop ─────────────────────────────────────────
    function updateShop(dt) {
        menuBounce += dt;
        if (lastBoughtTimer > 0) lastBoughtTimer -= dt;

        if (consumePause()) { state = "menu"; playClick(); return; }
        var click = consumeClick();
        if (!click) return;

        // Back button
        if (pointInRect(click.x, click.y, 16, 14, 80, 44)) {
            state = "menu"; playClick(); return;
        }

        // Tabs
        var tabY = 100, tabH = 44, tabW = W / 3;
        if (pointInRect(click.x, click.y, 0, tabY, tabW, tabH)) { shopTab = "skins"; playClick(); return; }
        if (pointInRect(click.x, click.y, tabW, tabY, tabW, tabH)) { shopTab = "powerups"; playClick(); return; }
        if (pointInRect(click.x, click.y, tabW * 2, tabY, tabW, tabH)) { shopTab = "special"; playClick(); return; }

        // Items
        if (shopTab === "skins") {
            var skinKeys = Object.keys(SKINS);
            for (var i = 0; i < skinKeys.length; i++) {
                var col = i % 2, row = Math.floor(i / 2);
                var cx = 20 + col * 230, cy = 165 + row * 145;
                if (pointInRect(click.x, click.y, cx, cy, 210, 130)) {
                    var key = skinKeys[i];
                    var skin = SKINS[key];
                    if (save.ownedSkins.indexOf(key) >= 0) {
                        save.selectedSkin = key; persistSave(); playBuy();
                        lastBoughtMessage = skin.name + " equipped!";
                        lastBoughtTimer = 1.5;
                    } else if (save.totalCoins >= skin.price) {
                        save.totalCoins -= skin.price;
                        save.ownedSkins.push(key);
                        save.selectedSkin = key;
                        persistSave(); playBuy();
                        lastBoughtMessage = skin.name + " purchased!";
                        lastBoughtTimer = 1.5;
                    } else {
                        playDeny();
                        lastBoughtMessage = "Not enough coins!";
                        lastBoughtTimer = 1.2;
                    }
                    return;
                }
            }
        } else if (shopTab === "powerups") {
            // Missile card
            if (pointInRect(click.x, click.y, 40, 170, W - 80, 130)) {
                if (save.totalCoins >= 20) {
                    save.totalCoins -= 20; save.missiles++;
                    persistSave(); playBuy();
                    lastBoughtMessage = "+1 Missile!"; lastBoughtTimer = 1.2;
                } else { playDeny(); lastBoughtMessage = "Not enough coins!"; lastBoughtTimer = 1.2; }
                return;
            }
            // Mega pack (5 missiles)
            if (pointInRect(click.x, click.y, 40, 320, W - 80, 130)) {
                if (save.totalCoins >= 80) {
                    save.totalCoins -= 80; save.missiles += 5;
                    persistSave(); playBuy();
                    lastBoughtMessage = "+5 Missiles!"; lastBoughtTimer = 1.2;
                } else { playDeny(); lastBoughtMessage = "Not enough coins!"; lastBoughtTimer = 1.2; }
                return;
            }
        } else if (shopTab === "special") {
            // Distracted mode
            if (pointInRect(click.x, click.y, 40, 170, W - 80, 170)) {
                if (save.distractedUnlocked) {
                    lastBoughtMessage = "Already unlocked! Toggle in menu.";
                    lastBoughtTimer = 1.5;
                    playClick();
                } else if (save.totalCoins >= 1000) {
                    save.totalCoins -= 1000;
                    save.distractedUnlocked = true;
                    persistSave(); playBuy();
                    lastBoughtMessage = "Distracted Mode UNLOCKED!";
                    lastBoughtTimer = 2;
                } else { playDeny(); lastBoughtMessage = "Need 1000 coins!"; lastBoughtTimer = 1.2; }
                return;
            }
        }
    }

    // ── Easter-egg + pickup art ──────────────────────────────
    function drawHeshyPool(x, y, time) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath(); ctx.ellipse(0, 6, 34, 18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFB300"; // inflatable rim
        ctx.beginPath(); ctx.ellipse(0, 0, 34, 20, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#29B6F6"; // water
        ctx.beginPath(); ctx.ellipse(0, 0, 27, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-14, -2 + Math.sin(time * 4) * 1.5);
        ctx.quadraticCurveTo(0, -6, 14, -2);
        ctx.stroke();
        ctx.fillStyle = "#FF5252"; // beach ball
        ctx.beginPath(); ctx.arc(11, -3, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(11, -3, 5, -0.4, 0.7); ctx.fill();
        ctx.restore();
    }

    function drawHeartPickup(x, y, bob) {
        var s = 1 + Math.sin(bob * 4) * 0.08;
        ctx.save();
        ctx.translate(x, y); ctx.scale(s, s);
        ctx.fillStyle = "rgba(255,64,129,0.25)";
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FF4081";
        ctx.beginPath();
        ctx.moveTo(0, 7);
        ctx.bezierCurveTo(-10, -3, -7, -13, 0, -6);
        ctx.bezierCurveTo(7, -13, 10, -3, 0, 7);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath(); ctx.ellipse(-4, -4, 2.2, 3.2, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // Heshy floats in on his inner tube, waves, and drifts away — pure cameo.
    function drawHeshyCameo(t, dur) {
        var enter = clamp(t / 0.5, 0, 1);
        var exit = clamp((t - (dur - 0.7)) / 0.7, 0, 1);
        var x = lerp(W + 100, W * 0.72, easeOutBack(enter)) + exit * 170;
        var y = H * 0.34 + Math.sin(t * 3) * 7;
        ctx.save();
        ctx.translate(x, y);
        // inner tube (donut float)
        ctx.fillStyle = "#FF80AB";
        ctx.beginPath(); ctx.ellipse(0, 18, 40, 22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        for (var sg = 0; sg < 8; sg++) {
            var a = sg / 8 * Math.PI * 2;
            ctx.beginPath(); ctx.ellipse(Math.cos(a) * 30, 18 + Math.sin(a) * 16, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = "#29B6F6";
        ctx.beginPath(); ctx.ellipse(0, 18, 20, 11, 0, 0, Math.PI * 2); ctx.fill();
        // torso
        ctx.fillStyle = "#FF7043";
        roundRect(-16, -10, 32, 30, 8); ctx.fill();
        // waving arm
        var wave = Math.sin(t * 8) * 0.4;
        ctx.save(); ctx.translate(15, -6); ctx.rotate(-0.7 + wave);
        ctx.fillStyle = "#F0B27A"; roundRect(0, -4, 16, 7, 3); ctx.fill();
        ctx.beginPath(); ctx.arc(17, -1, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // drink in the other hand
        ctx.fillStyle = "#FFEE58"; roundRect(-23, -2, 7, 11, 2); ctx.fill();
        ctx.fillStyle = "#FF5252"; ctx.beginPath(); ctx.arc(-19.5, -3, 2, 0, Math.PI * 2); ctx.fill();
        // head
        ctx.fillStyle = "#F0B27A";
        ctx.beginPath(); ctx.arc(0, -22, 15, 0, Math.PI * 2); ctx.fill();
        // hair
        ctx.fillStyle = "#3E2723";
        ctx.beginPath(); ctx.arc(0, -27, 15, Math.PI, 0); ctx.fill();
        // sunglasses
        ctx.fillStyle = "#111111";
        roundRect(-12, -25, 10, 7, 2); ctx.fill();
        roundRect(2, -25, 10, 7, 2); ctx.fill();
        ctx.fillRect(-2, -23, 4, 2);
        // glint
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillRect(-10, -24, 3, 2);
        // grin
        ctx.strokeStyle = "#7A2A2A"; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(0, -15, 6, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        ctx.lineCap = "butt";
        ctx.restore();

        // banner text
        var alpha = Math.min(1, t * 2) * (1 - exit);
        ctx.globalAlpha = alpha;
        drawText("🏊 Heshy's in the pool", W / 2, H * 0.15,
            "bold 20px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#0277BD", 5);
        drawText("with his shades on 😎", W / 2, H * 0.15 + 28,
            "bold 16px 'Segoe UI', Arial, sans-serif", "#FFE082", "#5D4037", 4);
        ctx.globalAlpha = 1;
    }

    // ── Draw: Playing ────────────────────────────────────────
    function drawPlaying() {
        ctx.save();
        if (shakeTimer > 0) {
            ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        }

        drawRoad(scrollOffset);

        // Billboards (drawn first, behind trees)
        for (var bi = 0; bi < billboards.length; bi++) {
            drawBillboard(billboards[bi].x, billboards[bi].y, billboards[bi].side, billboards[bi].msg);
        }

        drawDecorations(gameTime);

        // Sasquatch easter egg (between decorations and obstacles)
        if (sasquatch) {
            drawSasquatch(sasquatch.x, sasquatch.y, sasquatch.phase, sasquatch.walkTime);
            // Show "HONK!" prompt if in wave phase and on-screen
            if (sasquatch.phase === 1 && sasquatch.y > 100 && sasquatch.y < H - 100) {
                var promptPulse = 1 + Math.sin(gameTime * 6) * 0.1;
                ctx.save();
                ctx.translate(sasquatch.x, sasquatch.y - 50);
                ctx.scale(promptPulse, promptPulse);
                drawText("📣 HONK!", 0, 0, "bold 14px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);
                ctx.restore();
            }
        }

        for (var i = 0; i < obstacles.length; i++) {
            if (obstacles[i].type === "puddle") drawPuddle(obstacles[i].x, obstacles[i].y);
            else if (obstacles[i].type === "pool") drawHeshyPool(obstacles[i].x, obstacles[i].y, gameTime);
        }

        for (var j = 0; j < coinEntities.length; j++) {
            if (!coinEntities[j].collected) drawCoin(coinEntities[j].x, coinEntities[j].y, gameTime);
        }
        // Heart pickups (rare extra life)
        for (var hd = 0; hd < heartEntities.length; hd++) {
            if (!heartEntities[hd].collected) drawHeartPickup(heartEntities[hd].x, heartEntities[hd].y, heartEntities[hd].bob);
        }

        // Parking signs (P) and ice cream signs
        for (var psd = 0; psd < parkingSigns.length; psd++) {
            drawParkingSign(parkingSigns[psd].x, parkingSigns[psd].y, parkingSigns[psd].bob);
        }
        for (var icd = 0; icd < iceCreamSigns.length; icd++) {
            drawIceCreamSign(iceCreamSigns[icd].x, iceCreamSigns[icd].y, iceCreamSigns[icd].bob);
        }
        // Salon signs
        for (var sld = 0; sld < salonSigns.length; sld++) {
            drawSalonSign(salonSigns[sld].x, salonSigns[sld].y, salonSigns[sld].bob);
        }
        // Avigail walking on the road
        if (avigailWalker) {
            drawAvigailWalker(avigailWalker.x, avigailWalker.y, avigailWalker.walkTime);
            // "REACH ME!" hint
            var apulse = 1 + Math.sin(gameTime * 6) * 0.1;
            ctx.save();
            ctx.translate(avigailWalker.x, avigailWalker.y - 32);
            ctx.scale(apulse, apulse);
            drawText("AVIGAIL!", 0, 0, "bold 12px 'Segoe UI', Arial, sans-serif", "#CE93D8", "#000", 3);
            ctx.restore();
        }

        for (var k = 0; k < obstacles.length; k++) {
            if (obstacles[k].type === "cone") drawCone(obstacles[k].x, obstacles[k].y);
        }

        for (var m = 0; m < animals.length; m++) {
            var an = animals[m];
            if (an.type === "duck") drawDuck(an.x, an.y, an.walkTime);
            else if (an.type === "raccoon") drawRaccoon(an.x, an.y, an.walkTime);
            else if (an.type === "ostrich") drawOstrich(an.x, an.y, an.walkTime);
        }

        for (var n = 0; n < obstacles.length; n++) {
            var o = obstacles[n];
            if (o.type === "car") drawEnemyCar(o.x, o.y, o.color, o.carType);
            else if (o.type === "ped") drawPedestrian(o.x, o.y, o.walkTime, o.pedType);
        }

        // Missiles
        for (var mm = 0; mm < missiles.length; mm++) {
            drawMissile(missiles[mm].x, missiles[mm].y, missiles[mm].time);
        }

        // Player (or crashed car if state === crash)
        if (state === "crash") {
            drawLuluCar(crashX, crashY, crashRot, false, gameTime, distractedMode);
        } else {
            drawLuluCar(player.x, player.y, player.tilt, invincibleTimer > 0, gameTime, distractedMode);
        }

        // Heshy cameo (drawn above the car so he floats over the scene)
        if (heshy) drawHeshyCameo(heshy.t, heshy.dur);

        // ── Coin-collect pop rings (scale up + fade) ──
        for (var cpd = 0; cpd < coinPops.length; cpd++) {
            var cpp = coinPops[cpd];
            var cpt = cpp.t / 0.35;
            ctx.save();
            ctx.globalAlpha = (1 - cpt) * 0.8;
            ctx.strokeStyle = "#FFE082";
            ctx.lineWidth = 2.5 * (1 - cpt) + 0.5;
            ctx.beginPath();
            ctx.arc(cpp.x, cpp.y, 6 + cpt * 18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        drawParticles();
        drawFloaters();

        // ── Speed lines / motion streaks at high speed ──
        if (gameSpeed > 360) {
            var spInt = Math.min((gameSpeed - 360) / (MAX_SPEED - 360), 1);
            ctx.save();
            ctx.globalAlpha = spInt * 0.35;
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2;
            ctx.lineCap = "round";
            // deterministic-ish streaks driven by scroll so they "rush" downward.
            // Bias toward the road edges so they don't obscure the action.
            for (var sl = 0; sl < 7; sl++) {
                var slx = (sl * 71 + 23) % (W + 40) - 20;
                // skip streaks landing over the central play band (around the lanes)
                if (slx > ROAD_L + 24 && slx < ROAD_R - 24) continue;
                var phase = (scrollOffset * 2.2 + sl * 130) % (H + 160);
                var sly = phase - 80;
                var slen = 30 + spInt * 50;
                ctx.beginPath();
                ctx.moveTo(slx, sly);
                ctx.lineTo(slx, sly + slen);
                ctx.stroke();
            }
            ctx.restore();
        }

        if (flashTimer > 0) {
            ctx.fillStyle = "rgba(255,0,0," + (flashTimer / 0.15 * 0.3) + ")";
            ctx.fillRect(-20, -20, W + 40, H + 40);
        }

        ctx.restore();
        drawHUD();

        // Re-entry grace indicator: a soft shield bubble around the car + a
        // "SAFE" countdown, so the player knows they have a moment to react
        // after returning to the road from a sub-world.
        if (invincibleTimer > 1.0) {
            var pulse = 0.5 + 0.5 * Math.sin(gameTime * 10);
            ctx.save();
            ctx.strokeStyle = "rgba(120,200,255," + (0.5 + 0.4 * pulse) + ")";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(player.x, player.y, 44 + pulse * 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = "rgba(120,200,255,0.12)";
            ctx.fill();
            ctx.restore();
            drawText("🛡 SAFE " + Math.ceil(invincibleTimer) + "s", W / 2, 70,
                "bold 16px 'Segoe UI', Arial, sans-serif", "#7CD4FF", "#003", 4);
        }
    }

    // ── Draw: Crash ──────────────────────────────────────────
    function drawCrash() {
        drawPlaying();
        // Layer the angry man + speech bubble + revenge car on top
        if (!angryMan) return;
        ctx.save();
        if (shakeTimer > 0) {
            ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        }
        // Revenge car (if active) — drawn before the man if behind, after if hit
        if (revengeCar && angryMan.state !== "hit") {
            drawEnemyCar(revengeCar.x, revengeCar.y, revengeCar.color, revengeCar.carType);
        }
        if (angryMan.state !== "hit") {
            drawAngryMan(angryMan.x, angryMan.y, angryMan.time, angryMan.state, angryMan.runDir);
            if (angryMan.state === "yelling") {
                drawSpeechBubble(angryMan.x, angryMan.y - 30, angryYell, angryMan.time);
            }
        }
        if (revengeCar && angryMan.state === "hit") {
            drawEnemyCar(revengeCar.x, revengeCar.y, revengeCar.color, revengeCar.carType);
        }
        ctx.restore();
    }

    // ── Draw: Parking Intro/Outro (zoom transition) ──────────