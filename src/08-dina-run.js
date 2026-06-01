    // Progressive difficulty: ramps up the more the player has run home.
    // dinaDiff = 1.0 on the first run and climbs ~12% per run, capping at 2.2x.
    // Level is the human-facing "Run #" shown in the HUD.
    var dinaDiff = 1;
    var dinaRunLevel = 1;
    function startDinaRun() {
        state = "dinaRun";
        dinaRunLevel = (save.dinaRunsPlayed || 0) + 1;
        dinaDiff = Math.min(1 + (dinaRunLevel - 1) * 0.12, 2.2);
        save.dinaRunsPlayed = dinaRunLevel;
        persistSave();
        dinaRunPhase = 1;
        dinaRunTimer = 0;
        dinaRunDistance = 0;
        dinaScrollY = 0;
        dinaSidewalk = [];
        dinaSidewalk.__greenblattSpawned = false;
        dinaSidewalkSpawn = 0;
        dina = { x: W / 2, y: H - 200, walkTime: 0,
                 lane: 1, sprintTimer: 3, sprintCool: 0,
                 stumble: 0, holding: "backpack",
                 chatTimer: rand(3, 6), chat: "", chatLife: 0 };
        mom = { x: W / 2, y: H + 100, walkTime: 0, distance: 1.0, says: 0, sayTimer: rand(4, 8) };
    }

    // ── Update / Draw: Dina Run Home ─────────────────────────
    var DINA_LANES_X = [W / 2 - 70, W / 2, W / 2 + 70]; // left grass, center sidewalk, right grass
    var DINA_RUN_DURATION = 45; // seconds total (nominal, at normal pace)
    var DINA_BASE_SCROLL = 160;                              // px/sec the world moves at normal pace
    var DINA_RUN_TOTAL_PX = DINA_BASE_SCROLL * DINA_RUN_DURATION; // 7200px = one full run
    var dinaScrollY = 0;                                     // accumulated world scroll — single source of truth

    function updateDinaRun(dt) {
        if (!dina) return;
        dinaRunTimer += dt;
        dina.walkTime += dt;
        if (shakeTimer > 0) shakeTimer -= dt;

        // Sprint / slow input
        var sprint = keys.up && dina.sprintTimer > 0;
        if (sprint) dina.sprintTimer = Math.max(0, dina.sprintTimer - dt);
        else dina.sprintTimer = Math.min(3, dina.sprintTimer + dt * 0.6);
        var slow = keys.down;

        // ── SINGLE source of truth for world motion ──
        // One scroll speed in px/sec; sprint speeds it up, slow/stumble slow it.
        var speedMult = sprint ? 2.0 : (slow ? 0.5 : 1.0);
        if (dina.stumble > 0) {
            speedMult *= 0.3;
            dina.stumble -= dt;
        }
        var scrollSpeed = DINA_BASE_SCROLL * speedMult; // px/sec — drives BG and hazards alike
        dinaScrollY += scrollSpeed * dt;                // accumulate world travel

        // Distance is derived from the exact same scroll → progress bar matches the visuals.
        dinaRunDistance = Math.min(dinaScrollY / DINA_RUN_TOTAL_PX, 1);

        // Steering (lane switch)
        // Use keys.left/right or button presses to switch lanes
        if (consumeLaneSwitch("left")) dina.lane = clamp(dina.lane - 1, 0, 2);
        if (consumeLaneSwitch("right")) dina.lane = clamp(dina.lane + 1, 0, 2);
        var targetX = DINA_LANES_X[dina.lane];
        dina.x = lerp(dina.x, targetX, Math.min(1, 8 * dt));

        // Spawn sidewalk hazards — denser as the run progresses so it ramps
        // from "warm-up" to "obstacle course". Late game can spawn two at once.
        dinaSidewalkSpawn -= dt;
        if (dinaSidewalkSpawn <= 0 && dinaRunTimer < DINA_RUN_DURATION - 4) {
            var prog = dinaRunDistance; // 0..1
            // gap shrinks from ~1.4s early to ~0.55s late, and tightens further
            // on higher run levels (dinaDiff) for a real obstacle course.
            dinaSidewalkSpawn = rand(0.9, 1.6) * (1 - prog * 0.55) / dinaDiff;
            spawnDinaHazard();
            // past the halfway mark, sometimes throw a second hazard in another lane
            // (more likely the harder the run level)
            if (prog > 0.5 && Math.random() < 0.35 * prog * dinaDiff) spawnDinaHazard();
        }
        // Update hazards
        for (var h = dinaSidewalk.length - 1; h >= 0; h--) {
            var hz = dinaSidewalk[h];
            hz.y += scrollSpeed * dt;
            hz.walkTime = (hz.walkTime || 0) + dt;
            if (hz.y > H + 60) { dinaSidewalk.splice(h, 1); continue; }
            // Collision
            var dx = dina.x - hz.x;
            var dy = dina.y - hz.y;
            if (dx * dx + dy * dy < (hz.r + 15) * (hz.r + 15) && !hz.hit) {
                hz.hit = true;
                handleDinaHazard(hz);
            }
        }

        // Mom chase — now an actual RACE. She steadily gains ground at a
        // baseline pace that ramps up over the run; sprinting is the only way
        // to pull back ahead, so the player has to manage sprint + dodge hazards.
        // Mom closes in faster on higher run levels (progressive difficulty).
        var chaseRamp = (0.012 + dinaRunDistance * 0.022) * dinaDiff;
        mom.distance = Math.max(0, mom.distance - chaseRamp * dt);
        if (sprint) {
            // Sprinting reverses the chase and buys back distance
            mom.distance = Math.min(1.0, mom.distance + 0.075 * dt);
        }
        // Mistakes hurt more now: stumbles and dawdling let Mom surge in
        if (dina.stumble > 0) mom.distance = Math.max(0, mom.distance - 0.16 * dt);
        if (slow) mom.distance = Math.max(0, mom.distance - 0.06 * dt);
        // Final-stretch tension: in the last 8 seconds, Mom pushes hard
        if (dinaRunTimer > DINA_RUN_DURATION - 8) {
            mom.distance = Math.max(0, mom.distance - 0.04 * dt);
        }
        mom.walkTime += dt;
        mom.sayTimer -= dt;
        if (mom.sayTimer <= 0) {
            mom.says = (mom.says + 1) % 4;
            mom.sayTimer = rand(4, 8);
        }
        // mom's y position based on distance
        mom.y = H + 50 - (1 - mom.distance) * 130;
        mom.x = lerp(mom.x, DINA_LANES_X[dina.lane], dt * 2);

        // Dina cheerful chatter (personality)
        dina.chatTimer -= dt;
        if (dina.chatLife > 0) dina.chatLife -= dt;
        if (dina.chatTimer <= 0) {
            dina.chatTimer = rand(4, 8);
            dina.chatLife = 1.6;
            if (sprint) dina.chat = randPick(["Zoooom!", "Catch me!", "Wheee!"]);
            else if (dina.stumble > 0) dina.chat = randPick(["Whoops!", "Oof!", "Almost!"]);
            else if (dinaRunDistance > 0.7) dina.chat = randPick(["Home! Home!", "Almost there!"]);
            else dina.chat = randPick(["La la la~", "Hi doggy!", "So fast!", "Race ya!"]);
        }

        // Check ending conditions
        if (dinaRunDistance >= 1) {
            // Won the race! Reached home before mom
            dinaEnding = "ran";
            dinaRunPhase = 2;
            bankDinaRunRewards(true); // winning banks coins + a bonus into Lulu's world
            state = "dinaCaught"; // shared outro state, with different flavor
            dinaRunTimer = 0;
            spawnDinaConfetti();
            playTone(523, 0.1, "triangle", 0.2);
            setTimeout(function () { playTone(659, 0.1, "triangle", 0.2); }, 100);
            setTimeout(function () { playTone(784, 0.12, "triangle", 0.22); }, 200);
            setTimeout(function () { playTone(1046, 0.16, "triangle", 0.24); }, 320);
            return;
        }
        if (mom.distance <= 0) {
            // Mom caught up — still keep what you collected (no win bonus)
            dinaEnding = "walked";
            dinaRunPhase = 2;
            bankDinaRunRewards(false);
            state = "dinaCaught";
            dinaRunTimer = 0;
            playTone(440, 0.18, "sine", 0.2);
            return;
        }
    }

    // Bank what Dina earned on the run into the shared save so it carries over
    // into Lulu's world (coins) and the star total (stickers). Winning the race
    // adds a tidy bonus. dinaRunBanked* hold the amounts for the result screen.
    var dinaRunBankedCoins = 0, dinaRunBankedStars = 0, dinaRunWinBonus = 0;
    function bankDinaRunRewards(won) {
        dinaRunWinBonus = won ? 25 : 0;
        dinaRunBankedCoins = dinaCoinsRun + dinaRunWinBonus;
        dinaRunBankedStars = dinaStickers;
        save.totalCoins += dinaRunBankedCoins;
        save.parkingTotalStars = (save.parkingTotalStars || 0) + dinaRunBankedStars;
        persistSave();
    }

    // Lane switch with keyboard or buttons
    var lastLeftPress = false, lastRightPress = false;
    function consumeLaneSwitch(dir) {
        if (dir === "left") {
            // queued tap (mobile) — drains once
            if (laneQueued === -1) { laneQueued = 0; return true; }
            if (keys.left && !lastLeftPress) { lastLeftPress = true; return true; }
            if (!keys.left) lastLeftPress = false;
        }
        if (dir === "right") {
            if (laneQueued === 1) { laneQueued = 0; return true; }
            if (keys.right && !lastRightPress) { lastRightPress = true; return true; }
            if (!keys.right) lastRightPress = false;
        }
        return false;
    }

    function spawnDinaHazard() {
        var types = ["hydrant", "dog", "butterfly", "squirrel", "kickball", "sprinkler", "hopscotch", "mailbox", "cat"];
        // Mrs. Greenblatt appears once per run, around midpoint
        if (!dinaSidewalk.__greenblattSpawned && dinaRunDistance > 0.4 && dinaRunDistance < 0.6 && Math.random() < 0.4) {
            dinaSidewalk.push({
                type: "greenblatt",
                x: DINA_LANES_X[1], // always center sidewalk
                y: -40,
                r: 18,
                walkTime: 0,
                greeted: false
            });
            dinaSidewalk.__greenblattSpawned = true;
            return;
        }
        var t = randPick(types);
        var lane = randInt(0, 2);
        dinaSidewalk.push({
            type: t,
            x: DINA_LANES_X[lane],
            y: -40,
            r: 14,
            walkTime: 0
        });
    }

    function handleDinaHazard(hz) {
        if (hz.type === "hydrant" || hz.type === "kickball" || hz.type === "squirrel" || hz.type === "mailbox") {
            dina.stumble = 0.5;
            shakeTimer = 0.25; shakeIntensity = 5;
            spawnCrashBurst(hz.x, hz.y, false);
            playTone(180, 0.1, "square", 0.15);
        } else if (hz.type === "dog") {
            dina.stumble = 1.5;
            dinaCoinsRun += 2;
            shakeTimer = 0.4; shakeIntensity = 8;
            playDogBark();
            spawnFloater(hz.x, hz.y, "+2 🐕", "#FFB74D");
        } else if (hz.type === "butterfly") {
            dinaCoinsRun += 1;
            playTone(1500, 0.08, "sine", 0.15);
            spawnFloater(hz.x, hz.y, "+1 🦋", "#FF80AB");
        } else if (hz.type === "sprinkler") {
            dina.sprintTimer = Math.min(3, dina.sprintTimer + 1);
            playTone(440, 0.1, "sine", 0.18);
            spawnFloater(hz.x, hz.y, "+⚡", "#4FC3F7");
        } else if (hz.type === "hopscotch") {
            dinaStickers++;
            playHopJump();
            spawnFloater(hz.x, hz.y, "+⭐", "#FFD700");
        } else if (hz.type === "cat") {
            dinaCoinsRun += 1;
            playTone(600, 0.1, "sine", 0.12);
        } else if (hz.type === "greenblatt") {
            // Crossing guard hands you a tootsie roll
            if (!hz.greeted) {
                dinaCoinsRun += 5;
                dinaStickers += 1;
                hz.greeted = true;
                playTone(660, 0.08, "triangle", 0.18);
                setTimeout(function () { playTone(880, 0.1, "triangle", 0.18); }, 80);
                spawnFloater(hz.x, hz.y, "🍬 +5", "#FFD700");
                // Brief pause but no big stumble
                dina.stumble = 0.4;
            }
        }
    }

    function drawDinaSidewalkBg(scrollY) {
        // Lawn — unified green
        ctx.fillStyle = "#7CB342";
        ctx.fillRect(0, 0, W, H);
        // Lawn texture stripes
        ctx.fillStyle = "#9CCC65";
        for (var gy = (scrollY * 0.2) % 60 - 60; gy < H; gy += 60) {
            ctx.fillRect(0, gy, W, 20);
        }
        // Tiny flower pops scattered on the lawn
        ctx.fillStyle = "#FFD54F";
        for (var fi = 0; fi < 14; fi++) {
            var fxx = (fi * 41 + 13) % W;
            var fyy = ((fi * 67 + scrollY * 0.45) % (H + 80)) - 40;
            if (fxx > W / 2 - 110 && fxx < W / 2 + 110) continue;
            ctx.beginPath(); ctx.arc(fxx, fyy, 2.5, 0, Math.PI * 2); ctx.fill();
        }

        // Sidewalk (center) with edge shadow
        var SIDEWALK_L = W / 2 - 100, SIDEWALK_W = 200;
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(SIDEWALK_L - 4, 0, 4, H);
        ctx.fillRect(SIDEWALK_L + SIDEWALK_W, 0, 4, H);
        ctx.fillStyle = "#D0CFC2";
        ctx.fillRect(SIDEWALK_L, 0, SIDEWALK_W, H);
        // Chunky outline
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 3;
        ctx.strokeRect(SIDEWALK_L, 0, SIDEWALK_W, H);
        // Sidewalk cracks (batched into single path)
        ctx.strokeStyle = "#9E9E9E";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var sy = (scrollY % 80) - 80; sy < H + 40; sy += 80) {
            ctx.moveTo(SIDEWALK_L + 4, sy);
            ctx.lineTo(SIDEWALK_L + SIDEWALK_W - 4, sy);
        }
        ctx.stroke();

        // Lane dashes
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 14]);
        ctx.lineDashOffset = -scrollY * 0.5;
        ctx.beginPath();
        ctx.moveTo(SIDEWALK_L + 60, 0); ctx.lineTo(SIDEWALK_L + 60, H);
        ctx.moveTo(SIDEWALK_L + 140, 0); ctx.lineTo(SIDEWALK_L + 140, H);
        ctx.stroke();
        ctx.setLineDash([]);

        // Proper picket fence on both sides of the lawn
        ctx.fillStyle = "#FFF8E8";
        ctx.strokeStyle = "#5D4037";
        ctx.lineWidth = 2;
        for (var fx = 6; fx < SIDEWALK_L - 12; fx += 14) {
            var ofy = ((fx * 7 + scrollY * 0.4) % (H + 60)) - 60;
            roundRect(fx, ofy, 8, 18, 2); ctx.fill(); ctx.stroke();
            // Mirror on right
            roundRect(W - fx - 8, ofy + 30, 8, 18, 2); ctx.fill(); ctx.stroke();
        }
        // Fence rail (horizontal crossbar)
        ctx.fillStyle = "#5D4037";
        for (var ry = ((scrollY * 0.4) % 120) - 60; ry < H + 30; ry += 120) {
            ctx.fillRect(0, ry, SIDEWALK_L - 6, 3);
            ctx.fillRect(SIDEWALK_L + SIDEWALK_W + 6, ry, W - SIDEWALK_L - SIDEWALK_W - 6, 3);
        }
    }

    function drawDinaSidewalkHazard(hz) {
        ctx.save();
        ctx.translate(hz.x, hz.y);
        if (hz.type === "hydrant") {
            ctx.fillStyle = "#B71C1C";
            roundRect(-7, -10, 14, 22, 4); ctx.fill();
            ctx.fillStyle = "#FFEB3B";
            ctx.beginPath(); ctx.arc(0, -5, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#212121";
            ctx.fillRect(-9, 12, 18, 3);
        } else if (hz.type === "mailbox") {
            // Pole
            ctx.fillStyle = "#5D4037";
            ctx.fillRect(-1, 0, 2, 14);
            // Box
            ctx.fillStyle = "#1565C0";
            roundRect(-10, -10, 20, 14, 3); ctx.fill();
            // Crayon sign "GO DINA!" hanging
            ctx.fillStyle = "#FFFFFF";
            roundRect(-12, 4, 22, 8, 1); ctx.fill();
            ctx.fillStyle = "#FF4FA3";
            ctx.font = "bold 7px Arial";
            ctx.textAlign = "center";
            ctx.fillText("GO DINA!", 0, 10);
        } else if (hz.type === "dog") {
            // friendly golden retriever
            ctx.fillStyle = "#F4A460";
            ctx.beginPath(); ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-10, -5, 6, 0, Math.PI * 2); ctx.fill();
            // Ears
            ctx.fillStyle = "#CD853F";
            ctx.beginPath();
            ctx.ellipse(-14, -3, 3, 6, -0.3, 0, Math.PI * 2);
            ctx.fill();
            // Eyes
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.arc(-12, -6, 0.8, 0, Math.PI * 2);
            ctx.arc(-8, -6, 0.8, 0, Math.PI * 2);
            ctx.fill();
            // Tail wag
            ctx.strokeStyle = "#F4A460";
            ctx.lineWidth = 4;
            ctx.beginPath();
            var wag = Math.sin(hz.walkTime * 10) * 4;
            ctx.moveTo(12, 0); ctx.quadraticCurveTo(20, -6, 22 + wag, -4);
            ctx.stroke();
            // Leash
            ctx.strokeStyle = "#8E24AA";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-10, -10); ctx.lineTo(-2, -22);
            ctx.stroke();
        } else if (hz.type === "butterfly") {
            // Pink/orange butterfly fluttering
            var flutter = Math.sin(hz.walkTime * 25);
            ctx.fillStyle = "#FF80AB";
            ctx.beginPath();
            ctx.ellipse(-6, -4, 6, 8 + flutter * 2, 0.3, 0, Math.PI * 2);
            ctx.ellipse(6, -4, 6, 8 + flutter * 2, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#FFCDD2";
            ctx.beginPath();
            ctx.ellipse(-6, 4, 4, 5, 0.3, 0, Math.PI * 2);
            ctx.ellipse(6, 4, 4, 5, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#212121";
            ctx.fillRect(-0.5, -3, 1, 8);
        } else if (hz.type === "squirrel") {
            ctx.fillStyle = "#8D6E63";
            ctx.beginPath(); ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-7, -3, 4, 0, Math.PI * 2); ctx.fill();
            // Big tail
            ctx.strokeStyle = "#8D6E63";
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(7, 0); ctx.quadraticCurveTo(15, -10, 8, -14);
            ctx.stroke();
            // Acorn
            ctx.fillStyle = "#A0522D";
            ctx.beginPath(); ctx.arc(-9, -2, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#000";
            ctx.beginPath(); ctx.arc(-9, -4, 0.6, 0, Math.PI * 2); ctx.fill();
        } else if (hz.type === "kickball") {
            ctx.fillStyle = "#F44336";
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFCDD2";
            ctx.beginPath(); ctx.arc(-3, -3, 3, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#B71C1C";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.stroke();
        } else if (hz.type === "sprinkler") {
            // Sprinkler nozzle with water arcs
            ctx.fillStyle = "#37474F";
            roundRect(-4, 2, 8, 8, 2); ctx.fill();
            // Water spraying
            ctx.strokeStyle = "rgba(33,150,243,0.6)";
            ctx.lineWidth = 2;
            for (var ww = 0; ww < 8; ww++) {
                var wa = -Math.PI / 2 + (ww / 7 - 0.5) * Math.PI * 0.8;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(wa) * 18, Math.sin(wa) * 18);
                ctx.stroke();
            }
            ctx.fillStyle = "#4FC3F7";
            for (var dd = 0; dd < 5; dd++) {
                var da = -Math.PI / 2 + (dd / 4 - 0.5) * Math.PI * 0.8;
                ctx.beginPath();
                ctx.arc(Math.cos(da) * 14, Math.sin(da) * 14, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (hz.type === "hopscotch") {
            // Chalk grid drawn on sidewalk
            ctx.strokeStyle = "#FFC107";
            ctx.lineWidth = 2;
            ctx.strokeRect(-10, -14, 20, 28);
            ctx.beginPath();
            ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
            ctx.stroke();
            ctx.fillStyle = "#FFC107";
            ctx.font = "bold 10px Arial";
            ctx.textAlign = "center";
            ctx.fillText("1", 0, -5);
            ctx.fillText("2", 0, 11);
        } else if (hz.type === "greenblatt") {
            // Mrs. Greenblatt — crossing guard with stop sign
            // Shadow
            ctx.fillStyle = "rgba(0,0,0,0.25)";
            ctx.beginPath(); ctx.ellipse(0, 18, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
            // Body — yellow safety vest
            ctx.fillStyle = "#FBC02D";
            roundRect(-10, -4, 20, 18, 4); ctx.fill();
            ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 2;
            roundRect(-10, -4, 20, 18, 4); ctx.stroke();
            // Reflective stripes
            ctx.fillStyle = "#FFF59D";
            ctx.fillRect(-10, 1, 20, 2);
            ctx.fillRect(-10, 8, 20, 2);
            // Legs (dark)
            ctx.fillStyle = "#37474F";
            ctx.fillRect(-4, 14, 3, 8);
            ctx.fillRect(1, 14, 3, 8);
            // Shoes
            ctx.fillStyle = "#000";
            ctx.fillRect(-5, 21, 4, 2);
            ctx.fillRect(1, 21, 4, 2);
            // Head with chunky outline
            ctx.fillStyle = "#1A1A1A";
            ctx.beginPath(); ctx.arc(0, -11, 7.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFE0CC";
            ctx.beginPath(); ctx.arc(0, -11, 6.5, 0, Math.PI * 2); ctx.fill();
            // Sheitel / wig (grey-ish brown)
            ctx.fillStyle = "#6D4C41";
            ctx.beginPath(); ctx.arc(0, -14, 8, Math.PI, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.ellipse(-7, -12, 3, 6, -0.2, 0, Math.PI * 2);
            ctx.ellipse(7, -12, 3, 6, 0.2, 0, Math.PI * 2);
            ctx.fill();
            // Glasses
            ctx.strokeStyle = "#1A1A1A";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(-3, -11, 2, 0, Math.PI * 2);
            ctx.arc(3, -11, 2, 0, Math.PI * 2);
            ctx.moveTo(-1, -11); ctx.lineTo(1, -11);
            ctx.stroke();
            // Smile
            ctx.strokeStyle = "#A0394D";
            ctx.lineWidth = 1;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(0, -8, 2.2, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();
            ctx.lineCap = "butt";
            // STOP sign in hand
            ctx.save();
            ctx.translate(-14, -2);
            ctx.rotate(Math.sin(hz.walkTime * 2) * 0.15);
            ctx.fillStyle = "#5D4037";
            ctx.fillRect(-1, 0, 2, 12);
            ctx.fillStyle = "#D32F2F";
            ctx.beginPath();
            for (var sii = 0; sii < 8; sii++) {
                var sang = sii * Math.PI / 4 - Math.PI / 8;
                var sx = Math.cos(sang) * 7;
                var sy = Math.sin(sang) * 7;
                if (sii === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "#FFF";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = "#FFF";
            ctx.font = "bold 4px Arial";
            ctx.textAlign = "center";
            ctx.fillText("STOP", 0, 1);
            ctx.restore();
            // Speech bubble for "Hi mamaleh!"
            if (!hz.greeted && hz.y > 80 && hz.y < H - 100) {
                drawSpeechBubble(0, -28, "Hi mamaleh!", hz.walkTime);
            }
        } else if (hz.type === "cat") {
            // Mr. Whiskers napping
            ctx.fillStyle = "#FF7043";
            ctx.beginPath(); ctx.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-12, -2, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFAB91";
            ctx.beginPath(); ctx.ellipse(0, 2, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
            // Lazy eye
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(-12, -3, 1.5, 0.1 * Math.PI, 0.9 * Math.PI);
            ctx.stroke();
            // Tail
            ctx.strokeStyle = "#FF7043";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(13, 0); ctx.quadraticCurveTo(20, -4, 18, -8);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawDinaRun() {
        ctx.save();
        if (shakeTimer > 0) {
            ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        }
        // Background
        drawDinaSidewalkBg(dinaScrollY);

        // Hazards — with an approach-warning shadow so the player can react
        for (var h = 0; h < dinaSidewalk.length; h++) {
            var hzz = dinaSidewalk[h];
            // Telegraph: pulsing ground shadow once the hazard is on-screen but not yet reached
            if (!hzz.hit && hzz.y > 0 && hzz.y < dina.y - 30) {
                var warn = 0.35 + 0.25 * Math.sin(dinaRunTimer * 12);
                ctx.fillStyle = "rgba(0,0,0," + (warn * 0.4) + ")";
                ctx.beginPath();
                ctx.ellipse(hzz.x, hzz.y + hzz.r + 6, hzz.r + 4, (hzz.r + 4) * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            drawDinaSidewalkHazard(hzz);
        }

        // Home appears at 80% progress
        if (dinaRunDistance > 0.7) {
            // Distant home in upper area
            var alphaH = clamp((dinaRunDistance - 0.7) / 0.3, 0, 1);
            var homeY = -100 + alphaH * 200;
            ctx.save();
            ctx.globalAlpha = alphaH;
            // House body
            ctx.fillStyle = "#A1887F";
            roundRect(W / 2 - 70, homeY, 140, 90, 8); ctx.fill();
            ctx.strokeStyle = "#1A1A1A";
            ctx.lineWidth = 3;
            roundRect(W / 2 - 70, homeY, 140, 90, 8); ctx.stroke();
            // Roof
            ctx.fillStyle = "#5D4037";
            ctx.beginPath();
            ctx.moveTo(W / 2 - 80, homeY);
            ctx.lineTo(W / 2, homeY - 40);
            ctx.lineTo(W / 2 + 80, homeY);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            // Windows (lit warm yellow)
            ctx.fillStyle = "#FFE082";
            ctx.fillRect(W / 2 - 55, homeY + 18, 28, 28);
            ctx.fillRect(W / 2 + 27, homeY + 18, 28, 28);
            ctx.strokeRect(W / 2 - 55, homeY + 18, 28, 28);
            ctx.strokeRect(W / 2 + 27, homeY + 18, 28, 28);
            // Window cross panes
            ctx.beginPath();
            ctx.moveTo(W / 2 - 41, homeY + 18); ctx.lineTo(W / 2 - 41, homeY + 46);
            ctx.moveTo(W / 2 - 55, homeY + 32); ctx.lineTo(W / 2 - 27, homeY + 32);
            ctx.moveTo(W / 2 + 41, homeY + 18); ctx.lineTo(W / 2 + 41, homeY + 46);
            ctx.moveTo(W / 2 + 27, homeY + 32); ctx.lineTo(W / 2 + 55, homeY + 32);
            ctx.stroke();
            // Door
            ctx.fillStyle = "#3E2723";
            roundRect(W / 2 - 15, homeY + 50, 30, 40, 4); ctx.fill();
            roundRect(W / 2 - 15, homeY + 50, 30, 40, 4); ctx.stroke();
            ctx.fillStyle = "#FFEB3B";
            ctx.beginPath(); ctx.arc(W / 2 + 8, homeY + 72, 2, 0, Math.PI * 2); ctx.fill();
            // Welcome mat
            ctx.fillStyle = "#D32F2F";
            ctx.fillRect(W / 2 - 18, homeY + 88, 36, 5);
            ctx.strokeRect(W / 2 - 18, homeY + 88, 36, 5);
            // Sign "HOME"
            ctx.fillStyle = "#FFD700";
            roundRect(W / 2 - 30, homeY - 8, 60, 14, 4); ctx.fill();
            ctx.strokeStyle = "#5D4037";
            ctx.lineWidth = 2;
            roundRect(W / 2 - 30, homeY - 8, 60, 14, 4); ctx.stroke();
            drawText("HOME ♥", W / 2, homeY - 1, "bold 11px Arial", "#000", null, 0);
            ctx.restore();
        }

        // Mom (behind)
        if (mom) drawMomTopDown(mom.x, mom.y, mom.walkTime);

        // Dina
        if (dina) drawDinaTopDown(dina.x, dina.y, dina.walkTime, "up", "backpack");
        // Sprint-charge bar floating just under Dina — readable at a glance, no HUD glance needed
        if (dina) {
            var sFrac = clamp(dina.sprintTimer / 3, 0, 1);
            var sbW = 44, sbX = dina.x - sbW / 2, sbY = dina.y + 30;
            ctx.fillStyle = "rgba(0,0,0,0.35)";
            roundRect(sbX - 2, sbY - 2, sbW + 4, 9, 4); ctx.fill();
            // Color shifts green→amber→red as charge depletes
            var sCol = sFrac > 0.5 ? "#7CFC4F" : sFrac > 0.2 ? "#FFC107" : "#FF5252";
            ctx.fillStyle = sCol;
            roundRect(sbX, sbY, sbW * sFrac, 5, 3); ctx.fill();
            // Little bolt icon when full enough to use
            if (sFrac > 0.05 && keys.up) {
                ctx.fillStyle = "#FFEB3B";
                ctx.font = "11px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText("⚡", dina.x, sbY - 9);
            }
        }
        if (dina && dina.chatLife > 0) drawSpeechBubble(dina.x, dina.y - 60, dina.chat, dina.walkTime);

        // Mom proximity glow
        if (mom && mom.distance < 0.3) {
            var glow = (0.3 - mom.distance) / 0.3;
            ctx.fillStyle = "rgba(255, 200, 0, " + (glow * 0.25) + ")";
            ctx.fillRect(0, 0, W, H);
            // "!" bubble above Dina
            if (mom.distance < 0.15 && dina) {
                ctx.save();
                ctx.fillStyle = "#FFC107";
                ctx.beginPath();
                ctx.arc(dina.x + 18, dina.y - 28, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#000";
                ctx.font = "bold 12px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("!", dina.x + 18, dina.y - 27);
                ctx.restore();
            }
        }

        // Mom speech every once in a while
        if (mom && mom.sayTimer < 1) {
            var phrases = ["Dinaaaa!", "Wait up!", "Honey!", "Hold on!"];
            drawSpeechBubble(mom.x, mom.y - 25, phrases[mom.says], mom.walkTime);
        }

        ctx.restore(); // end shake transform — HUD/buttons stay rock-steady

        // HUD top: distance bar
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        roundRect(0, 0, W, 50, 0); ctx.fill();
        // Progress bar
        var barX = 60, barY = 18, barW = W - 120, barH = 14;
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        roundRect(barX, barY, barW, barH, 7); ctx.fill();
        ctx.fillStyle = "#FF4FA3";
        roundRect(barX, barY, barW * dinaRunDistance, barH, 7); ctx.fill();
        // House icon at end
        ctx.fillStyle = "#FFD700";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("🏠", W - 36, 28);
        // Dina icon at progress
        ctx.fillStyle = "#FFB0C8";
        ctx.beginPath();
        ctx.arc(barX + barW * dinaRunDistance, barY + barH / 2, 8, 0, Math.PI * 2);
        ctx.fill();

        // Stats
        drawText("⏱ " + Math.max(0, Math.ceil(DINA_RUN_DURATION - dinaRunTimer)) + "s",
            15, 18, "bold 13px Arial", "#FFD700", "#000", 2, "left");
        drawText("⚡ " + dina.sprintTimer.toFixed(1) + "s", 15, 36, "bold 12px Arial", "#FFEB3B", "#000", 2, "left");
        drawText("⭐ " + dinaStickers + "  $" + dinaCoinsRun, W - 80, 18,
            "bold 13px Arial", "#FFD700", "#000", 2, "left");
        // Run level (progressive difficulty) — centered under the bar
        drawText("Run #" + dinaRunLevel, W / 2, 40, "bold 12px Arial", "#FFFFFF", "#000", 2);

        // Mobile lane controls + sprint + slow buttons (touch only — desktop uses arrow keys)
        if (isTouchDevice) {
            drawIconButton(PARK_LEFT_RECT.x, PARK_LEFT_RECT.y, PARK_LEFT_RECT.w, "◀",
                { bg: keys.left ? "#FFEB3B" : "#FFFFFF", bgDark: "#90A4AE" });
            drawIconButton(PARK_RIGHT_RECT.x, PARK_RIGHT_RECT.y, PARK_RIGHT_RECT.w, "▶",
                { bg: keys.right ? "#FFEB3B" : "#FFFFFF", bgDark: "#90A4AE" });
            drawIconButton(PARK_FWD_RECT.x, PARK_FWD_RECT.y, PARK_FWD_RECT.w, "⚡",
                { bg: keys.up ? "#FFEB3B" : "#FFC107", bgDark: "#FF6F00" });
            drawIconButton(PARK_REV_RECT.x, PARK_REV_RECT.y, PARK_REV_RECT.w, "🐢",
                { bg: keys.down ? "#FFEB3B" : "#90CAF9", bgDark: "#1565C0" });
        }
    }

    // ── Update / Draw: dinaCaught (ending) ───────────────────
    // Self-contained confetti for the home-arrival celebration (the global
    // particle system isn't ticked in this scene, so we run our own).
    var dinaConfetti = [];
    function spawnDinaConfetti() {
        dinaConfetti = [];
        var cols = ["#FF4FA3", "#FFD700", "#4FC3F7", "#7CFC4F", "#FF8A65", "#BA68C8"];
        for (var i = 0; i < 60; i++) {
            dinaConfetti.push({
                x: rand(0, W), y: rand(-H * 0.4, 0),
                vx: rand(-30, 30), vy: rand(40, 160),
                size: rand(4, 9), color: randPick(cols),
                rot: rand(0, Math.PI * 2), spin: rand(-6, 6)
            });
        }
    }
    function updateDinaCaught(dt) {
        dinaRunTimer += dt;
        for (var i = dinaConfetti.length - 1; i >= 0; i--) {
            var p = dinaConfetti[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
            p.vy += 60 * dt; // gentle gravity
            if (p.y > H + 20) dinaConfetti.splice(i, 1);
        }
        // Hold for 3 seconds, then go home
        if (dinaRunTimer > 3.5 || consumeClick() || consumeAction()) {
            dinaConfetti = [];
            enterDinaHome();
        }
    }

    function drawDinaCaught() {
        // Home porch scene
        ctx.fillStyle = "#FFB6D9";
        ctx.fillRect(0, 0, W, H * 0.4);
        ctx.fillStyle = "#7CB342";
        ctx.fillRect(0, H * 0.4, W, H * 0.6);
        // House
        ctx.fillStyle = "#A1887F";
        roundRect(W / 2 - 140, H * 0.18, 280, 280, 10); ctx.fill();
        ctx.fillStyle = "#5D4037";
        ctx.beginPath();
        ctx.moveTo(W / 2 - 160, H * 0.18);
        ctx.lineTo(W / 2, H * 0.05);
        ctx.lineTo(W / 2 + 160, H * 0.18);
        ctx.closePath(); ctx.fill();
        // Windows
        ctx.fillStyle = "#FFEB3B";
        roundRect(W / 2 - 100, H * 0.25, 50, 50, 4); ctx.fill();
        roundRect(W / 2 + 50, H * 0.25, 50, 50, 4); ctx.fill();
        // Door
        ctx.fillStyle = "#3E2723";
        roundRect(W / 2 - 30, H * 0.35, 60, 110, 6); ctx.fill();
        ctx.fillStyle = "#FFEB3B";
        ctx.beginPath(); ctx.arc(W / 2 + 20, H * 0.42, 3, 0, Math.PI * 2); ctx.fill();
        // Welcome mat
        ctx.fillStyle = "#D32F2F";
        ctx.fillRect(W / 2 - 40, H * 0.45 + 1, 80, 14);
        drawText("WELCOME", W / 2, H * 0.45 + 8, "bold 9px Arial", "#FFEB3B", null, 0);

        // Dina at the porch
        var dinaX = W / 2, dinaY = H * 0.6;
        // Victory jump on the "ran" ending — a few cheerful hops that settle.
        var jump = 0;
        if (dinaEnding === "ran") {
            jump = Math.abs(Math.sin(dinaRunTimer * 6)) * 22 * Math.max(0, 1 - dinaRunTimer / 2.2);
        }
        // Pose: hands on hips if "ran", waving if "walked"
        ctx.save();
        ctx.translate(dinaX, dinaY - jump);
        // Use a larger version for the cutscene
        ctx.scale(2.5, 2.5);
        drawDinaTopDown(0, 0, dinaRunTimer * 4, "down", "backpack");
        ctx.restore();
        // Mom in scene
        if (dinaEnding === "walked") {
            var momX = dinaX - 60, momY = dinaY - 10;
            ctx.save();
            ctx.translate(momX, momY);
            ctx.scale(2.5, 2.5);
            drawMomTopDown(0, 0, dinaRunTimer * 5);
            ctx.restore();
            // Holding hands hint
            ctx.strokeStyle = "#FFD700";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(momX + 20, momY + 20);
            ctx.lineTo(dinaX - 20, dinaY + 20);
            ctx.stroke();
        }

        // Speech bubble
        var msg;
        if (dinaEnding === "ran") {
            msg = "I BEAT YOU,\nMOM!";
        } else {
            msg = "Fine,\nlet's walk\ntogether.";
        }
        drawSpeechBubble(dinaX, dinaY - 90, msg, dinaRunTimer * 4);

        // Result text top
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(40, 30, W - 80, 50, 12); ctx.fill();
        drawText(dinaEnding === "ran" ? "YOU MADE IT HOME! 🏆" : "MOM CAUGHT UP! 🤗",
            W / 2, 56, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);

        // Rewards banked into the shared bank (carries over to Lulu's world)
        var bonusStr = dinaRunWinBonus > 0 ? "  (+" + dinaRunWinBonus + " win bonus!)" : "";
        drawText("Banked: ⭐ " + dinaRunBankedStars + "   💰 " + dinaRunBankedCoins + bonusStr, W / 2, H - 76,
            "bold 16px Arial", "#FFD700", "#000", 3);
        drawText("Added to your bank: " + formatNum(save.totalCoins) + " 💰", W / 2, H - 52,
            "bold 13px Arial", "#FFF8E1", "#000", 2);
        drawText("Tap to enter home", W / 2, H - 26, "14px Arial", "#FFFFFF", "#000", 2);

        // Confetti celebration (on top of everything)
        for (var ci = 0; ci < dinaConfetti.length; ci++) {
            var cp = dinaConfetti[ci];
            ctx.save();
            ctx.translate(cp.x, cp.y);
            ctx.rotate(cp.rot);
            ctx.fillStyle = cp.color;
            ctx.fillRect(-cp.size / 2, -cp.size / 2, cp.size, cp.size * 0.6);
            ctx.restore();
        }
    }
