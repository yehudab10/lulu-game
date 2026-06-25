    // ════════════════════════════════════════════════════════════
    //  LULU ON FOOT — a GTA-lite walking world
    //  When Lulu's car is wrecked she walks her OWN road (same world,
    //  same traffic) — but on two legs and untouchable: cars honk and
    //  swerve around her, drunks catcall and chase her, animals scatter.
    //  She can duck into buildings (bar/school/hospital/police/beach —
    //  each its own interior mini-world) and "borrow" a parked car to
    //  get back on the road (GTA-style) — steal it in front of a cop and
    //  you'll be chased.  Entered from the crash reprieve, a parking-sim
    //  crash, and 10% of cop pull-overs.
    // ════════════════════════════════════════════════════════════

    var FOOT_BASE = 150;        // forward walk speed (px/sec, cruise)
    var FOOT_RUN = 2.1, FOOT_SLOW = 0.45;

    // ── Exterior state ───────────────────────────────────────
    var footPhase = 0;          // 0 = quick get-out cinematic, 1 = walking
    var footTimer = 0;
    var footLulu = null;        // { x, y, walkTime, face, wreckT }
    var footObs = [];           // live world entities (cars/cops/peds/animals/cones/coins)
    var footSpawnT = 1.0;
    var footParked = [];        // stealable parked cars
    var footDoors = [];         // building entrances
    var footPrompt = null;      // nearest interactable: { kind, ent, label }
    var footDoorCool = 0;       // re-entry cooldown after leaving a building
    var footParkCool = 0;       // spacing between parked-car spawns
    var footEntryReason = "crashReprieve";
    var footRunLevel = 1;
    var footCoinsRun = 0, footStars = 0;
    var footIntroLine = "";
    var footHint = "", footHintT = 0;
    var footChat = "", footChatT = 0, footChatNext = 3;
    var footInteriorType = null;

    // ── Saying pools (lots of variety) ───────────────────────
    var FOOT_CAR_HONKS = ["BEEP BEEP!", "Use a CROSSWALK!", "You WALKING the highway?!",
        "Meshugene!", "MOVE it, lady!", "Get OUTTA the road!", "HOOONK", "Nice jaywalk!",
        "I'm DRIVING here!", "Sidewalk's RIGHT there!"];
    var FOOT_DRUNK_CALLS = ["Heyyy gorgeous! 🍻", "Marry me — I have a CAR! 🚗", "*wolf whistle*",
        "You're an ANGEL 😇", "Hubba hubba!", "Niiice... walk?", "Call me! ...somehow",
        "Lookin' GOOD, Lulu!", "Is it hot or is it YOU?", "*hiccup* helloooo", "Need a LIFT? 😏",
        "My NUMBER is— *burp*", "You complete me!", "Pull OVER, beautiful!"];
    var FOOT_CHASE_LINES = ["Wait UP! 🏃", "Just ONE seltzer!", "I'll walk you home!",
        "Come baaack!", "I'm a CATCH!", "Where ya GOIN?!", "Slow dowwwn!", "I do CARDIO!"];
    var FOOT_LULU_CHAT = ["Where do I get a CAR around here?", "Walking. In these flats. Great.",
        "Bubbe's gonna plotz.", "I need a RIDE.", "So many cars... none are MINE.",
        "Is everyone DRUNK today?", "I should've taken the bus.", "These men. Oy.",
        "Twenty minutes till candles!", "A car. Any car. Please."];
    var FOOT_STEAL_LINES = ["Borrowing this! 🚗", "Sorry, EMERGENCY!", "I'll bring it back!",
        "Don't mind if I DO!", "Grand theft... mitzvah?", "Keys were RIGHT there!", "Bubbe needs me!"];

    function startFootWorld(reason) {
        footEntryReason = reason;
        footRunLevel = (save.footRunsPlayed || 0) + 1;
        save.footRunsPlayed = footRunLevel; persistSave();
        footPhase = 0; footTimer = 0;
        footObs = []; footParked = []; footDoors = [];
        footSpawnT = 1.0; footParkCool = 6; footDoorCool = 2;
        footPrompt = null;
        footCoinsRun = 0; footStars = 0;
        footChat = ""; footChatT = 0; footChatNext = rand(2.5, 4.5);
        footInteriorType = null;
        footHint = "Find a car to “borrow” 🚗"; footHintT = 6;
        footIntroLine =
            reason === "parkingCrash" ? "That's coming out of my deposit.\nOn foot it is." :
            reason === "copWalk"      ? "Impounded?! Fine. I'll WALK.\n...and find a new ride." :
                                        "The car's a meatball.\nTime to borrow one.";
        footLulu = { x: W / 2, y: H - 220, walkTime: 0, face: "cry", wreckT: 0 };
        state = "footRun";   // smooth: no tap, flows straight in
    }

    // ── Update: exterior ─────────────────────────────────────
    function updateFootRun(dt) {
        if (!footLulu) return;
        footTimer += dt;
        updateParticles(dt);
        if (shakeTimer > 0) shakeTimer -= dt;

        if (footPhase === 0) { updateFootIntro(dt); return; }

        // Forward pace — run/slow, on the LEFT buttons (keys.up/down)
        var run = keys.up, slow = keys.down;
        var sp = run ? FOOT_RUN : (slow ? FOOT_SLOW : 1.0);
        var fwd = FOOT_BASE * sp;

        // Advance her ACTUAL world (road, zones, seasons, decorations).
        scrollOffset += fwd * dt;
        updateZone(dt, fwd);
        updateSeason(dt, fwd);
        updateDecorations(dt, fwd);
        footLulu.walkTime += dt * (0.4 + sp);
        footLulu.face = "run";
        if (run) particles.push({ x: footLulu.x + rand(-9, 9), y: footLulu.y + 22,
            vx: rand(-22, 22), vy: rand(16, 50), life: 0.4, maxLife: 0.4,
            size: rand(3, 6), color: randPick(["#D7CCC8", "#BCAAA4", "#CFD8DC"]), gravity: 0 });

        // Steer across the FULL width — road and sidewalks both.
        var minX = 22, maxX = W - 22;
        if (touchX !== null) footLulu.x = lerp(footLulu.x, clamp(touchX, minX, maxX), Math.min(1, 14 * dt));
        else { var mv = (keys.left ? -1 : 0) + (keys.right ? 1 : 0); footLulu.x = clamp(footLulu.x + mv * 300 * dt, minX, maxX); }

        // Spawn + advance the world entities and interactables.
        footSpawnT -= dt;
        if (footSpawnT <= 0) { footSpawnT = rand(0.6, 1.3); spawnFootObs(); }
        if (footParkCool > 0) footParkCool -= dt;
        if (footParkCool <= 0 && footParked.length < 1) { footParkCool = rand(5, 9); spawnFootParked(); }
        if (footDoorCool > 0) footDoorCool -= dt;
        maybeSpawnFootDoor();

        updateFootObs(dt, fwd);
        scrollFootList(footParked, dt, fwd, 110);
        scrollFootList(footDoors, dt, fwd, 80);

        // Context prompt + interact
        footPrompt = footNearestInteractable();
        var act = footActQueued; footActQueued = false;
        if (act && footPrompt) doFootInteract(footPrompt);

        // Chatter + hint
        footChatT -= dt;
        if (footChatT <= -footChatNext) { footChat = randPick(FOOT_LULU_CHAT); footChatT = 2.0; footChatNext = rand(3.5, 6); }
        if (footHintT > 0) footHintT -= dt;
    }

    function updateFootIntro(dt) {
        footLulu.wreckT -= dt;
        if (footLulu.wreckT <= 0) {
            footLulu.wreckT = 0.09;
            particles.push({ x: W / 2 - 38 + rand(-10, 10), y: H * 0.44 + rand(-8, 6),
                vx: rand(-18, 18), vy: rand(-52, -24), life: rand(1.0, 1.6), maxLife: 1.3,
                size: rand(7, 12), color: randPick(["#616161", "#9E9E9E", "#757575"]),
                gravity: -22, smoke: true });
        }
        footLulu.walkTime += dt * 1.3;
        if (footTimer > 0.7) footLulu.face = "run";
        // Smooth, automatic — NO tap needed.
        if (footTimer > 1.6) { footPhase = 1; footTimer = 0; footLulu.x = W / 2; footLulu.y = H - 220; footLulu.face = "run"; }
    }

    // ── World entities ───────────────────────────────────────
    function spawnFootObs() {
        var lane = randInt(0, 2);
        var r = Math.random();
        if (r < 0.40) {
            footObs.push({ kind: "car", x: LANES[lane], baseX: LANES[lane], y: -90, vy: rand(60, 150),
                color: randPick(C.enemyCols), carType: randInt(0, 2), honkT: rand(0, 1),
                drunk: Math.random() < 0.16, swerveT: rand(0, 6.28), walkTime: 0, line: "", lineT: 0 });
        } else if (r < 0.49) {
            footObs.push({ kind: "cop", x: LANES[lane], y: -90, vy: rand(45, 85), walkTime: 0 });
        } else if (r < 0.74) {
            var onSide = Math.random() < 0.45;
            footObs.push({ kind: "ped", x: onSide ? (Math.random() < 0.5 ? ROAD_L - 28 : ROAD_R + 28) : LANES[lane],
                y: -40, vy: rand(8, 34), walkTime: 0, pedType: randInt(0, 2),
                drunk: Math.random() < 0.42, chase: false, callT: rand(0.4, 2), line: "", lineT: 0 });
        } else if (r < 0.86) {
            footObs.push({ kind: "animal", x: rand(ROAD_L + 10, ROAD_R - 10), y: -30, vy: rand(18, 55),
                walkTime: 0, animal: randPick(["duck", "raccoon", "ostrich"]) });
        } else if (r < 0.95) {
            footObs.push({ kind: "coin", x: LANES[lane], y: -30, vy: 0, walkTime: 0 });
        } else {
            footObs.push({ kind: "cone", x: LANES[lane], y: -40, vy: 0, walkTime: 0 });
        }
    }

    function updateFootObs(dt, fwd) {
        for (var i = footObs.length - 1; i >= 0; i--) {
            var o = footObs[i];
            o.y += (fwd + (o.vy || 0)) * dt;
            o.walkTime = (o.walkTime || 0) + dt;
            if (o.lineT > 0) o.lineT -= dt;
            if (o.y > H + 100) { footObs.splice(i, 1); continue; }

            if (o.kind === "car") {
                var dxc = o.x - footLulu.x;
                if (o.honkT > 0) o.honkT -= dt;
                // Approaching her lane → honk + swerve around (never hits her).
                if (Math.abs(dxc) < 64 && o.y > footLulu.y - 150 && o.y < footLulu.y + 26) {
                    o.x += (dxc >= 0 ? 1 : -1) * 70 * dt;
                    if (o.honkT <= 0) { o.honkT = rand(1.4, 2.6); playHonk(); o.line = randPick(FOOT_CAR_HONKS); o.lineT = 1.5; }
                }
                if (o.drunk) { o.swerveT += dt; o.x = clamp(o.x + Math.sin(o.swerveT * 3) * 22 * dt, ROAD_L + 14, ROAD_R - 14); }
            } else if (o.kind === "ped" && o.drunk) {
                o.callT -= dt;
                if (o.callT <= 0 && o.lineT <= 0) { o.callT = rand(1.8, 3.4); o.line = randPick(FOOT_DRUNK_CALLS); o.lineT = 2.2; }
                // Close + roughly alongside → she's got an admirer who CHASES.
                if (!o.chase && Math.abs(o.x - footLulu.x) < 150 && o.y > footLulu.y - 110 && o.y < footLulu.y + 60) o.chase = true;
                if (o.chase) {
                    o.x = lerp(o.x, footLulu.x, dt * 1.1);
                    o.y = lerp(o.y, footLulu.y + 40, dt * 0.9);
                    if (o.lineT <= 0 && Math.random() < dt * 0.7) { o.line = randPick(FOOT_CHASE_LINES); o.lineT = 1.8; }
                }
            } else if (o.kind === "animal") {
                if (Math.abs(o.x - footLulu.x) < 66 && Math.abs(o.y - footLulu.y) < 80)
                    o.x = clamp(o.x + (o.x >= footLulu.x ? 1 : -1) * 130 * dt, 12, W - 12);
            } else if (o.kind === "coin") {
                if (Math.abs(o.x - footLulu.x) < 26 && Math.abs(o.y - footLulu.y) < 26) {
                    footCoinsRun++; runCoins++; save.totalCoins++;
                    spawnCoinSparkle(o.x, o.y); playCoin();
                    spawnFloater(o.x, o.y - 12, "+1 💰", "#FFD700");
                    footObs.splice(i, 1);
                }
            }
        }
    }

    function scrollFootList(list, dt, fwd, killBelow) {
        for (var i = list.length - 1; i >= 0; i--) {
            list[i].y += fwd * dt;
            if (list[i].y > H + killBelow) list.splice(i, 1);
        }
    }

    function spawnFootParked() {
        var left = Math.random() < 0.5;
        footParked.push({ x: left ? ROAD_L - 24 : ROAD_R + 24, y: -110,
            color: randPick(C.enemyCols), carType: randInt(0, 2), rot: left ? 0.12 : -0.12 });
    }

    // City zones map to a building you can enter; beach gets a beach-hut.
    function footZoneInterior() {
        if (typeof zone === "undefined") return null;
        if (zone === "bars" || zone === "school" || zone === "hospital" || zone === "police" || zone === "beach") return zone;
        return null;
    }
    function maybeSpawnFootDoor() {
        if (footDoorCool > 0 || footDoors.length > 0) return;
        var t = footZoneInterior();
        if (!t) return;
        footDoorCool = rand(4, 7);
        var left = Math.random() < 0.5;
        footDoors.push({ type: t, x: left ? ROAD_L - 30 : ROAD_R + 30, y: -90 });
    }

    function footNearestInteractable() {
        var best = null, bestD = 9999;
        for (var i = 0; i < footParked.length; i++) {
            var p = footParked[i];
            var d = Math.abs(p.x - footLulu.x) + Math.abs(p.y - footLulu.y);
            if (Math.abs(p.x - footLulu.x) < 56 && Math.abs(p.y - footLulu.y) < 86 && d < bestD) {
                best = { kind: "steal", ent: p, label: "🚗 BORROW CAR" }; bestD = d;
            }
        }
        for (var j = 0; j < footDoors.length; j++) {
            var dr = footDoors[j];
            var dd = Math.abs(dr.x - footLulu.x) + Math.abs(dr.y - footLulu.y);
            if (Math.abs(dr.x - footLulu.x) < 56 && Math.abs(dr.y - footLulu.y) < 64 && dd < bestD) {
                best = { kind: "enter", ent: dr, label: "🚪 ENTER " + FOOT_DOOR_NAME[dr.type] }; bestD = dd;
            }
        }
        return best;
    }
    var FOOT_DOOR_NAME = { bars: "BAR", school: "SCHOOL", hospital: "CLINIC", police: "PRECINCT", beach: "BEACH" };

    function doFootInteract(prompt) {
        if (prompt.kind === "enter") {
            enterFootInterior(prompt.ent.type);
            return;
        }
        // Steal a car → back on the road (GTA-style). A nearby cop = a chase.
        spawnFloater(footLulu.x, footLulu.y - 32, randPick(FOOT_STEAL_LINES), "#FFE082");
        var seen = Math.random() < 0.12;
        for (var i = 0; i < footObs.length; i++) {
            var o = footObs[i];
            if (o.kind === "cop" && o.y > -20 && o.y < H && Math.abs(o.x - prompt.ent.x) < 300) seen = true;
        }
        spawnCrashBurst(prompt.ent.x, prompt.ent.y, false);
        playTone(520, 0.08, "square", 0.12);
        lives = Math.max(lives, 1); // she entered foot on a wrecked car — give her a life back
        returnToDriving();
        if (seen) {
            // The driving cop-chase system takes it from here.
            if (typeof beginCopChase === "function") beginCopChase(player.x, "🚨 GRAND THEFT AUTO!");
        }
    }

    // ── Interior contract (interiors live in 08c/08d/08e) ────
    function enterFootInterior(type) {
        footInteriorType = type;
        state = "footInterior";
        if (type === "bars" && typeof initBarsInterior === "function") initBarsInterior();
        else if (type === "school" && typeof initSchoolInterior === "function") initSchoolInterior();
        else if (type === "hospital" && typeof initHospitalInterior === "function") initHospitalInterior();
        else if (type === "police" && typeof initPoliceInterior === "function") initPoliceInterior();
        else if (type === "beach" && typeof initBeachInterior === "function") initBeachInterior();
        else { exitFootInterior(); return; }  // not built yet → bounce back out
        playClick();
    }
    function exitFootInterior() {
        footInteriorType = null;
        state = "footRun";
        footPhase = 1;
        footDoors = [];          // clear doors so she doesn't instantly re-enter
        footDoorCool = 2.0;
        footPrompt = null;
        if (footLulu) footLulu.face = "run";
        playClick();
    }
    function updateFootInterior(dt) {
        updateParticles(dt);
        var t = footInteriorType;
        if (t === "bars" && typeof updateBarsInterior === "function") updateBarsInterior(dt);
        else if (t === "school" && typeof updateSchoolInterior === "function") updateSchoolInterior(dt);
        else if (t === "hospital" && typeof updateHospitalInterior === "function") updateHospitalInterior(dt);
        else if (t === "police" && typeof updatePoliceInterior === "function") updatePoliceInterior(dt);
        else if (t === "beach" && typeof updateBeachInterior === "function") updateBeachInterior(dt);
        else exitFootInterior();
    }
    function drawFootInterior() {
        var t = footInteriorType;
        if (t === "bars" && typeof drawBarsInterior === "function") drawBarsInterior();
        else if (t === "school" && typeof drawSchoolInterior === "function") drawSchoolInterior();
        else if (t === "hospital" && typeof drawHospitalInterior === "function") drawHospitalInterior();
        else if (t === "police" && typeof drawPoliceInterior === "function") drawPoliceInterior();
        else if (t === "beach" && typeof drawBeachInterior === "function") drawBeachInterior();
        else { ctx.fillStyle = "#222"; ctx.fillRect(0, 0, W, H); }
        drawParticles();
    }

    // ── Draw: exterior ───────────────────────────────────────
    function drawFootRun() {
        if (footPhase === 0) { drawFootIntro(); return; }

        ctx.save();
        if (shakeTimer > 0) ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));

        // Her real world.
        drawRoad(scrollOffset);
        drawDecorations(footTimer);
        drawCityBuildings();

        // Parked (stealable) cars sit on the shoulder, tilted.
        for (var p = 0; p < footParked.length; p++) {
            var pc = footParked[p];
            ctx.save(); ctx.translate(pc.x, pc.y); ctx.rotate(pc.rot || 0);
            drawEnemyCar(0, 0, pc.color, pc.carType);
            ctx.restore();
        }
        // Building doors.
        for (var d = 0; d < footDoors.length; d++) drawFootDoor(footDoors[d]);

        // World entities (traffic, cops, peds, animals, coins, cones).
        for (var i = 0; i < footObs.length; i++) drawFootObs(footObs[i]);

        // Lulu.
        drawLuluTopDown(footLulu.x, footLulu.y, footLulu.walkTime, footLulu.face);
        if (footChatT > 0) drawSpeechBubble(footLulu.x, footLulu.y - 56, footChat, footLulu.walkTime);

        drawParticles();
        ctx.restore();

        drawSeasonFx();   // weather + season darkness over the world
        drawFootHUD();
    }

    function drawFootObs(o) {
        if (o.kind === "car") {
            drawEnemyCar(o.x, o.y, o.color, o.carType);
            if (o.lineT > 0 && o.y > 40 && o.y < H - 40) drawSpeechBubble(o.x, o.y - 46, o.line, o.walkTime);
        } else if (o.kind === "cop") {
            drawCopCar(o.x, o.y, footTimer * 3);
        } else if (o.kind === "ped") {
            drawPedestrian(o.x, o.y, o.walkTime, o.pedType, false, o.drunk);
            if (o.lineT > 0 && o.y > 30 && o.y < H - 30) drawSpeechBubble(o.x, o.y - 30, o.line, o.walkTime);
        } else if (o.kind === "animal") {
            if (o.animal === "duck") drawDuck(o.x, o.y, o.walkTime);
            else if (o.animal === "raccoon") drawRaccoon(o.x, o.y, o.walkTime);
            else drawOstrich(o.x, o.y, o.walkTime);
        } else if (o.kind === "coin") {
            drawCoin(o.x, o.y, o.walkTime);
        } else if (o.kind === "cone") {
            drawCone(o.x, o.y);
        }
    }

    function drawFootDoor(dr) {
        var onLeft = dr.x < W / 2;
        ctx.save();
        ctx.translate(dr.x, dr.y);
        // awning + doorway, themed colour
        var col = { bars: "#7E57C2", school: "#EF5350", hospital: "#42A5F5", police: "#5C6BC0", beach: "#26C6DA" }[dr.type] || "#8D6E63";
        ctx.fillStyle = "#3E2723"; roundRect(-20, -2, 40, 46, 4); ctx.fill();           // frame
        ctx.fillStyle = "#5D4037"; roundRect(-15, 2, 30, 42, 3); ctx.fill();            // door
        ctx.fillStyle = "#FFD54F"; ctx.beginPath(); ctx.arc(onLeft ? 9 : -9, 24, 2, 0, Math.PI * 2); ctx.fill(); // knob
        ctx.fillStyle = col; roundRect(-26, -16, 52, 16, 4); ctx.fill();                // awning
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        for (var s = -26; s < 26; s += 10) ctx.fillRect(s + 2, -16, 5, 16);
        drawText(FOOT_DOOR_NAME[dr.type], 0, -8, "bold 8px Arial", "#fff", "#000", 2);
        ctx.restore();
    }

    function drawFootHUD() {
        // slim top bar
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(0, 0, W, 40 + SAFE_TOP, 0); ctx.fill();
        drawText("🚶‍♀️ ON FOOT", 10, 16 + SAFE_TOP, "bold 13px Arial", "#FFD54F", "#000", 2, "left");
        drawText("⭐ " + footStars + "   💰 " + footCoinsRun, W - 10, 16 + SAFE_TOP, "bold 13px Arial", "#FFD700", "#000", 2, "right");
        if (footHintT > 0) {
            ctx.globalAlpha = clamp(footHintT, 0, 1);
            drawText(footHint, W / 2, 26 + SAFE_TOP, "bold 13px Arial", "#FFF8E1", "#000", 3);
            ctx.globalAlpha = 1;
        }

        // context prompt floating above Lulu
        if (footPrompt) {
            var py = footLulu.y - 78;
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            var pw = footPrompt.label.length * 7 + 24;
            roundRect(footLulu.x - pw / 2, py, pw, 22, 6); ctx.fill();
            drawText(footPrompt.label, footLulu.x, py + 11, "bold 11px Arial", "#FFE082", "#000", 2);
        }

        // Buttons: run / slow on the LEFT (where the car's boost/brake are),
        // interact on the RIGHT (where honk is).
        if (isTouchDevice) {
            drawIconButton(MOBILE_BOOST_RECT.x, MOBILE_BOOST_RECT.y, MOBILE_BOOST_RECT.w, "⚡",
                { bg: keys.up ? "#FFEB3B" : "#FFC107", bgDark: "#FF6F00" });
            drawIconButton(MOBILE_BRAKE_RECT.x, MOBILE_BRAKE_RECT.y, MOBILE_BRAKE_RECT.w, "🐢",
                { bg: keys.down ? "#FFEB3B" : "#90CAF9", bgDark: "#1565C0" });
            drawIconButton(HONK_RECT.x, HONK_RECT.y, HONK_RECT.w, footPrompt ? "👋" : "✋",
                { bg: footPrompt ? "#7CFC4F" : "#B0BEC5", bgDark: "#2E7D32" });
            drawText("drag to walk", W / 2, H - 14, "11px Arial", "#FFFFFF", "#000", 2);
        }
    }

    // ── Intro tableau (phase 0) — auto, no tap ──────────────
    function drawFootIntro() {
        drawRoad(scrollOffset);
        drawDecorations(footTimer);
        drawCityBuildings();
        drawSeasonFx();
        ctx.fillStyle = "rgba(40,20,60,0.20)"; ctx.fillRect(0, 0, W, H);
        // Wrecked car, tilted + smoking.
        ctx.save(); ctx.translate(W / 2 - 38, H * 0.44); ctx.rotate(0.4);
        drawLuluCar(0, 0, 0, false, footTimer, false, save.selectedSkin, 1);
        ctx.restore();
        drawParticles();
        drawLuluTopDown(W / 2 + 36, H * 0.44 + 14, footLulu.walkTime, footLulu.face);
        drawSpeechBubble(W / 2 + 36, H * 0.44 - 44, footIntroLine, footTimer);
        drawText("LULU ON FOOT", W / 2, H * 0.66, "bold 22px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);
        drawText("borrow a car to get back on the road", W / 2, H * 0.66 + 24, "bold 12px Arial", "#FFF8E1", "#000", 2);
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
