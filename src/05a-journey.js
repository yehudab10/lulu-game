    // ═══════════════════════════════════════════════════════════
    //  THE JOURNEY  — every run is a road trip with named stops you
    //  can actually REACH. Arriving is a warm reward beat + the choice
    //  to end the run as a WIN ("TRIP COMPLETE") or push to a farther
    //  stop. This is a LAYER on top of the endless sim — the driving
    //  loop underneath is 100% untouched.
    // ═══════════════════════════════════════════════════════════

    // dist = the scrollOffset distance for THAT leg (per-leg, not cumulative).
    var TRIP_STOPS = [
        { id: "bubbe",   name: "BUBBE'S HOUSE",   icon: "🏡", dist: 56000, reward: 60,
          greet: "LULULEH! You made it! Come, EAT — the cholent's hot! 🍲", accent: "#FFCC80" },
        { id: "heshy",   name: "HESHY'S POOL",    icon: "🏊", dist: 74000, reward: 80,
          greet: "CANNONBAAALL! 💦 ...oh hey Lulu! Towel? Snack? Floatie?", accent: "#80D8FF" },
        { id: "beach",   name: "THE BEACH",       icon: "🏖️", dist: 103000, reward: 100,
          greet: "Salt air, seagulls, zero traffic. You EARNED this, Bruck.", accent: "#FFE082" },
        { id: "avigail", name: "AVIGAIL'S PLACE", icon: "💅", dist: 131000, reward: 125,
          greet: function () {
              var r = (typeof avigailRel === "function") ? avigailRel() : 50;
              if (r >= 65) return "BESTIE! I made spritzers! 💜";
              if (r <= 35) return "...you drove ALL this way? Obsessed with me much? 💅";
              return "Oh. It's you. Cute car, I guess. Come in, whatever. 💅";
          }, accent: "#CE93D8" },
        { id: "vegas",   name: "VIVA VEGAS",      icon: "🎲", dist: 177000, reward: 200,
          greet: "You DROVE it?! Lakewood to VEGAS, baby! Mindy, the kids — LULU'S HERE! 🎲", accent: "#A5D6A7" }
    ];

    // ── Run mode ─────────────────────────────────────────────────
    // "cruise" = endless PLAY (no journey layer, auto-connects to Shared Road).
    // "story"  = STORY TRIP (the journey, with persistent checkpoints).
    var runMode = "cruise";

    // Leg-intro banner (STORY only) — a 2.5s centered pop-in at run start.
    var legBannerT = 0, legBannerText = "", legBannerColor = "#FFF";
    function queueLegIntro() {
        if (runMode !== "story") { legBannerT = 0; return; }
        var stop = TRIP_STOPS[tripStopIdx];
        legBannerT = 2.5;
        legBannerText = "LEG " + (tripStopIdx + 1) + "/5 — NEXT STOP: " + stop.name;
        legBannerColor = stop.accent;
    }

    // Per-leg world flavor (STORY only) — a subtle spawn multiplier keyed to the
    // current leg's theme. Returns 1 in cruise mode / for unrelated events.
    function storySpawnBias(name) {
        if (runMode !== "story") return 1;
        var idx = tripStopIdx;
        if (idx === 1 && name === "heshyPool") return 3;    // Heshy's Pool leg
        if (idx === 2 && name === "iceCream") return 3;      // The Beach leg
        if (idx === 3 && name === "avigailCar") return 3;    // Avigail's Place leg
        if (idx === 4) {                                     // Viva Vegas leg
            if (name === "toll") return 2;
            if (name === "parade") return 2;
        }
        return 1;
    }

    // ── Run state (reset per run in resetGame) ───────────────────
    var tripStopIdx = 0;          // index into TRIP_STOPS (the leg in progress)
    var tripLegStart = 0;         // scrollOffset when this leg began
    var tripCycle = 0;            // full tours completed → legs ×1.5 each cycle
    var tripArrival = null;       // { stop, t, phase, claimed, newPostcard } while at a stop
    var tripStopsThisRun = 0;     // stops reached this run (for the game-over line)
    var tripPostponeUntil = 0;    // scrollOffset gate after a chase-postponed arrival
    var tripEndedWell = false;    // TRIP COMPLETE flag → recolors the game-over screen
    var tripLastStopName = "";    // name of the most-recent stop reached this run
    var tripPullInT = 0;          // >0 while easing to a crawl into a stop (story) — 0..1.1 then arrival
    var tripMile50 = false;       // per-leg: "halfway" floater fired?
    var tripMile85 = false;       // per-leg: "next exit!" floater fired?

    function tripCycleMult() { return Math.pow(1.5, tripCycle || 0); }
    function tripLegDist() { return TRIP_STOPS[tripStopIdx].dist * tripCycleMult(); }
    function tripRemaining() { return (tripLegStart + tripLegDist()) - scrollOffset; }

    // Greet line may be a plain string or a (relationship-aware) function.
    function tripStopGreet(stop) {
        return (typeof stop.greet === "function") ? stop.greet() : stop.greet;
    }

    // ── Leg progress + arrival trigger (hooked from updatePlaying) ──
    function updateJourney(dt) {
        if (runMode !== "story") return;          // cruise has NO journey layer at all
        if (state !== "playing") return;         // works in BOTH drive & foot mode

        // ── ARRIVAL PULL-IN: once triggered, keep her SAFE and let the world coast
        //    to a crawl (the speed damp lives next to parkExit in 05-driving-loop),
        //    then fire the arrival exactly as before once it plays out. ──
        if (tripPullInT > 0) {
            tripPullInT += dt;
            invincibleTimer = Math.max(invincibleTimer, 0.4);
            if (tripPullInT >= 1.1) {
                tripPullInT = 0;
                tripArrival = { stop: TRIP_STOPS[tripStopIdx], t: 0, phase: 0, claimed: false, newPostcard: false };
                state = "arrival";
            }
            return;
        }

        var legD = tripLegDist();
        var rem = tripRemaining();

        // ── LEG MILESTONES (once each): a warm heads-up mid-leg + near the exit. ──
        var stop = TRIP_STOPS[tripStopIdx];
        var prog = clamp(1 - rem / legD, 0, 1);
        if (!tripMile50 && prog >= 0.5 && rem > 0) {
            tripMile50 = true;
            spawnFloater(player.x, player.y - 50, "🏁 halfway to " + stop.name + "!", stop.accent);
            if (typeof playTone === "function") playTone(523, 0.09, "sine", 0.12);
        }
        if (!tripMile85 && prog >= 0.85 && rem > 0) {
            tripMile85 = true;
            spawnFloater(player.x, player.y - 50, stop.icon + " " + stop.name + " — next exit!", stop.accent);
            if (typeof playTone === "function") playTone(659, 0.09, "sine", 0.12);
        }

        if (rem > 0) return;
        // Fugitive / mid-bust? Can't stop with heat on her — postpone the arrival.
        var heat = (typeof copChase !== "undefined" && copChase) ||
                   (typeof copBust !== "undefined" && copBust) ||
                   (typeof prisonClothes !== "undefined" && prisonClothes);
        if (heat) {
            if (scrollOffset >= tripPostponeUntil) {
                spawnFloater(player.x, player.y - 50, "🚨 can't stop with heat on you! next chance ahead…", "#FF8A80");
                tripLegStart += 8000;               // push this leg's end forward
                tripPostponeUntil = scrollOffset + 8000;  // ...only once per ~8000
            }
            return;
        }
        // Calm at the finish → begin the smooth PULL-IN (replaces the hard cut).
        // The arrival fires from the pull-in branch above once it completes.
        tripPullInT = 0.0001;
    }

    // ── Shared button rects (draw + click never drift) ───────────
    function tripBtnRects() {
        var bw = 240, bx = W / 2 - bw / 2;
        return {
            keep: { x: bx, y: H * 0.80, w: bw, h: 54 },
            end:  { x: bx, y: H * 0.88, w: bw, h: 50 }
        };
    }

    // ── Update: arrival scene ────────────────────────────────────
    function updateArrival(dt) {
        if (!tripArrival) { state = "playing"; return; }
        tripArrival.t += dt;
        updateParticles(dt);

        // Apply rewards exactly ONCE, the frame the scene opens.
        if (!tripArrival.claimed) {
            tripArrival.claimed = true;
            var stop = tripArrival.stop;
            runCoins += stop.reward;
            save.totalCoins += stop.reward;
            if (!save.postcards) save.postcards = [];
            if (save.postcards.indexOf(stop.id) < 0) { save.postcards.push(stop.id); tripArrival.newPostcard = true; }
            tripStopsThisRun++;
            tripLastStopName = stop.name;
            if ((save.tripBest || 0) < tripStopsThisRun) save.tripBest = tripStopsThisRun;
            if (stop.id === "avigail" && typeof bumpAvigailRel === "function") bumpAvigailRel(4);
            // STORY checkpoint: reaching a stop banks campaign progress so the NEXT
            // story run resumes from the following leg (dying mid-leg keeps the last
            // reached checkpoint — we write here, at arrival, not at trip end).
            if (runMode === "story") {
                var reached = tripStopIdx;   // 0..4, the leg we just completed
                if (reached >= TRIP_STOPS.length - 1) {   // Vegas — the tour finale
                    save.storyStop = 0;
                    save.storyCycle = (save.storyCycle || 0) + 1;
                    tripArrival.storyComplete = true;
                    tripArrival.tourNum = save.storyCycle + 1;   // the tour just unlocked
                } else {
                    save.storyStop = reached + 1;
                }
                // FIRST arrival unlocks endless cruise + the whole Shared Road stack.
                if (!save.cruiseUnlocked) {
                    save.cruiseUnlocked = true;
                    tripArrival.unlockedCruise = true;
                    spawnConfetti(W / 2, H * 0.30, 50);   // an extra celebratory burst
                }
            }
            persistSave();
            playCoin();
            // a warm little arrival jingle (C–E–G)
            playTone(523, 0.12, "sine", 0.18);
            setTimeout(function () { playTone(659, 0.12, "sine", 0.18); }, 120);
            setTimeout(function () { playTone(784, 0.18, "sine", 0.20); }, 240);
            spawnConfetti(W / 2, H * 0.30, 70);
        }
        // gentle ongoing confetti drift
        if (Math.random() < dt * 3) spawnConfetti(rand(W * 0.15, W * 0.85), H * 0.12, 6);
        // extra celebratory drift while the cruise-unlock line is up
        if (tripArrival.unlockedCruise && Math.random() < dt * 4) spawnConfetti(rand(W * 0.2, W * 0.8), H * 0.10, 8);

        var click = consumeClick();
        if (click) {
            var r = tripBtnRects();
            if (pointInRect(click.x, click.y, r.keep.x, r.keep.y, r.keep.w, r.keep.h)) {
                // KEEP DRIVING → advance to the next stop (wrap + cycle mult)
                tripStopIdx++;
                if (tripStopIdx >= TRIP_STOPS.length) { tripStopIdx = 0; tripCycle = (tripCycle || 0) + 1; }
                tripLegStart = scrollOffset;
                tripPostponeUntil = scrollOffset;
                tripPullInT = 0; tripMile50 = false; tripMile85 = false;   // fresh leg → re-arm milestones
                tripArrival = null;
                invincibleTimer = Math.max(invincibleTimer, 2.5);
                state = "playing";
                if (typeof playClick === "function") playClick();
                var ns = TRIP_STOPS[tripStopIdx];
                spawnFloater(W / 2, H * 0.42, "NEXT STOP: " + ns.name + " — " + formatNum(Math.round(ns.dist * tripCycleMult())) + "m!", ns.accent);
                return;
            }
            if (pointInRect(click.x, click.y, r.end.x, r.end.y, r.end.w, r.end.h)) {
                // CALL IT A TRIP → a celebratory route through the normal game-over
                // flow. Mirror the ticket-outcome high-score commit so banking is
                // identical to a normal end (bankRunStats fires in updateGameOver).
                tripEndedWell = true;
                if (Math.floor(score) > save.highScore) save.highScore = Math.floor(score);
                persistSave();
                tripArrival = null;
                state = "gameover";
                gameOverAlpha = 0; goScoreShown = 0; goConfettiDone = false;
                spawnConfetti(W / 2, H * 0.30, 90);
                if (typeof Ads !== "undefined" && Ads.onGameOver) Ads.onGameOver();
                if (typeof playClick === "function") playClick();
                return;
            }
        }
    }

    // ── tiny word-wrap for the greet card ────────────────────────
    function tripWrap(txt, font, maxW) {
        ctx.font = font;
        var words = txt.split(" "), lines = [], cur = "";
        for (var i = 0; i < words.length; i++) {
            var test = cur ? cur + " " + words[i] : words[i];
            if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = words[i]; }
            else cur = test;
        }
        if (cur) lines.push(cur);
        return lines;
    }

    // ── Draw: arrival scene ──────────────────────────────────────
    function drawArrival() {
        if (!tripArrival) return;
        var stop = tripArrival.stop;
        var t = tripArrival.t;
        var bob = Math.sin(t * 2) * 4;

        tripDrawBackdrop(stop, t);

        // vignette to frame the readout
        ctx.save();
        var vig = ctx.createRadialGradient(W / 2, H * 0.4, H * 0.2, W / 2, H * 0.4, H * 0.78);
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(1, "rgba(0,0,0,0.5)");
        ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // the character (bobbing)
        tripDrawGreeter(stop, W / 2, H * 0.31 + bob, t);

        // banner
        var pop = easeOutBack(clamp(t / 0.5, 0, 1));
        var finale = !!tripArrival.storyComplete;
        ctx.save();
        ctx.translate(W / 2, H * 0.10);
        ctx.scale(pop, pop);
        drawText(finale ? "🏆 STORY COMPLETE!" : "YOU MADE IT!", 0, 0,
            "bold " + (finale ? 28 : 34) + "px 'Segoe UI', Arial, sans-serif",
            finale ? "#FFD700" : "#FFF", "#5D4037", 6);
        ctx.restore();
        drawText(stop.icon + "  " + stop.name, W / 2, H * 0.155,
            "bold 22px 'Segoe UI', Arial, sans-serif", stop.accent, "#3E2723", 5);
        if (finale) {
            drawText("TOUR " + tripArrival.tourNum + " unlocked — longer roads, same mishpacha",
                W / 2, H * 0.20, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFE082", "#3E2723", 3);
        }

        // greet card (speech quote)
        var greet = tripStopGreet(stop);
        var gFont = "bold 15px 'Segoe UI', Arial, sans-serif";
        var lines = tripWrap(greet, gFont, W - 96);
        var lineH = 21, cardPadY = 14;
        var cardH = lines.length * lineH + cardPadY * 2;
        var cardW = W - 56, cardX = W / 2 - cardW / 2, cardY = H * 0.47;
        ctx.fillStyle = "rgba(20,26,38,0.9)";
        roundRect(cardX, cardY, cardW, cardH, 14); ctx.fill();
        ctx.strokeStyle = stop.accent; ctx.lineWidth = 2;
        roundRect(cardX, cardY, cardW, cardH, 14); ctx.stroke();
        // little quote-tail up toward the greeter
        ctx.fillStyle = "rgba(20,26,38,0.9)";
        ctx.beginPath();
        ctx.moveTo(W / 2 - 12, cardY + 1);
        ctx.lineTo(W / 2 + 12, cardY + 1);
        ctx.lineTo(W / 2, cardY - 14);
        ctx.closePath(); ctx.fill();
        for (var li = 0; li < lines.length; li++) {
            drawText(lines[li], W / 2, cardY + cardPadY + li * lineH + lineH / 2,
                gFont, "#FFF5E6", "#000", 3);
        }

        // reward line + postcard
        var ry = cardY + cardH + 26;
        drawText("+" + stop.reward + " 💰", W / 2, ry,
            "bold 24px 'Segoe UI', Arial, sans-serif", "#FFD700", "#5D4037", 5);
        if (tripArrival.newPostcard) {
            var pcPulse = 0.9 + 0.1 * Math.sin(t * 6);
            ctx.save(); ctx.translate(W / 2, ry + 26); ctx.scale(pcPulse, pcPulse);
            drawText("📮 postcard collected!", 0, 0,
                "bold 14px 'Segoe UI', Arial, sans-serif", "#80D8FF", "#000", 3);
            ctx.restore();
        } else {
            drawText("stop #" + tripStopsThisRun + " this trip", W / 2, ry + 26,
                "bold 13px 'Segoe UI', Arial, sans-serif", "#B0BEC5", "#000", 2);
        }

        // First-arrival CRUISE UNLOCK — a distinct green line that fits between the
        // reward readout and the two buttons (buttons sit at H*0.80 / H*0.88).
        if (tripArrival.unlockedCruise) {
            var uFont = "bold 12px 'Segoe UI', Arial, sans-serif";
            var uLines = tripWrap("🔓 SHARED ROAD unlocked — cruise with everyone online, back at the menu!", uFont, W - 84);
            var uy = ry + 52;
            for (var ui = 0; ui < uLines.length; ui++) {
                drawText(uLines[ui], W / 2, uy + ui * 17, uFont, "#7CFC4F", "#1B3A1B", 3);
            }
        }

        // buttons
        var r = tripBtnRects();
        drawButton(r.keep.x, r.keep.y, r.keep.w, r.keep.h, "🚗  KEEP DRIVING", { bg: "#66BB6A", bgDark: "#2E7D32" });
        drawButton(r.end.x, r.end.y, r.end.w, r.end.h, "🏁  CALL IT A TRIP", { bg: "#FFC107", bgDark: "#FF6F00", small: true });

        drawParticles();
    }

    // ── Per-stop procedural backdrop (~30-60 lines each) ──────────
    function tripDrawBackdrop(stop, t) {
        if (stop.id === "bubbe") {
            // warm dusk sky + porch with a lit window and steam off a pot
            var g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, "#3E2C4A"); g.addColorStop(0.5, "#8D5A4A"); g.addColorStop(1, "#4A3327");
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            // house
            ctx.fillStyle = "#6D4C41"; ctx.fillRect(W * 0.15, H * 0.24, W * 0.7, H * 0.5);
            ctx.fillStyle = "#4E342E"; ctx.beginPath();
            ctx.moveTo(W * 0.1, H * 0.24); ctx.lineTo(W / 2, H * 0.08); ctx.lineTo(W * 0.9, H * 0.24); ctx.closePath(); ctx.fill();
            // lit window
            ctx.fillStyle = "#FFE082"; ctx.fillRect(W * 0.58, H * 0.32, W * 0.18, H * 0.14);
            ctx.strokeStyle = "#4E342E"; ctx.lineWidth = 3;
            ctx.strokeRect(W * 0.58, H * 0.32, W * 0.18, H * 0.14);
            ctx.beginPath(); ctx.moveTo(W * 0.67, H * 0.32); ctx.lineTo(W * 0.67, H * 0.46);
            ctx.moveTo(W * 0.58, H * 0.39); ctx.lineTo(W * 0.76, H * 0.39); ctx.stroke();
            // door
            ctx.fillStyle = "#3E2723"; ctx.fillRect(W * 0.26, H * 0.5, W * 0.14, H * 0.24);
            // steam off a pot (soft rising blobs)
            for (var s = 0; s < 3; s++) {
                var sp = (t * 0.6 + s * 0.33) % 1;
                ctx.globalAlpha = (1 - sp) * 0.5;
                ctx.fillStyle = "#FFF";
                ctx.beginPath(); ctx.arc(W * 0.31 + Math.sin(sp * 6 + s) * 6, H * 0.5 - sp * 60, 8 - sp * 3, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
        } else if (stop.id === "heshy") {
            // pool blue with an inner tube + sun sparkle
            var g2 = ctx.createLinearGradient(0, 0, 0, H);
            g2.addColorStop(0, "#4FC3F7"); g2.addColorStop(0.45, "#29B6F6"); g2.addColorStop(1, "#0277BD");
            ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
            // pool deck strip
            ctx.fillStyle = "#E1BEE7"; ctx.fillRect(0, H * 0.2, W, H * 0.06);
            // ripples
            ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2;
            for (var rp = 0; rp < 6; rp++) {
                var ry2 = H * 0.4 + rp * 40 + Math.sin(t * 2 + rp) * 4;
                ctx.beginPath();
                for (var xx = 0; xx <= W; xx += 20) ctx.lineTo(xx, ry2 + Math.sin(xx * 0.05 + t * 3 + rp) * 5);
                ctx.stroke();
            }
            // inner tube
            var tx = W * 0.72, ty = H * 0.6 + Math.sin(t * 1.5) * 8;
            ctx.fillStyle = "#FF7043"; ctx.beginPath(); ctx.arc(tx, ty, 42, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.arc(tx, ty, 42, Math.PI * 0.15, Math.PI * 0.65); ctx.arc(tx, ty, 42, Math.PI * 1.15, Math.PI * 1.65); ctx.fill();
            ctx.fillStyle = "#29B6F6"; ctx.beginPath(); ctx.arc(tx, ty, 20, 0, Math.PI * 2); ctx.fill();
        } else if (stop.id === "beach") {
            // sky / sea / sand bands + umbrella
            var g3 = ctx.createLinearGradient(0, 0, 0, H);
            g3.addColorStop(0, "#4FC3F7"); g3.addColorStop(1, "#B3E5FC");
            ctx.fillStyle = g3; ctx.fillRect(0, 0, W, H * 0.45);
            ctx.fillStyle = "#0288D1"; ctx.fillRect(0, H * 0.45, W, H * 0.12);
            ctx.fillStyle = "#039BE5"; ctx.fillRect(0, H * 0.45, W, H * 0.04);
            var g4 = ctx.createLinearGradient(0, H * 0.57, 0, H);
            g4.addColorStop(0, "#FFE082"); g4.addColorStop(1, "#FFCA28");
            ctx.fillStyle = g4; ctx.fillRect(0, H * 0.57, W, H * 0.43);
            // sun
            ctx.fillStyle = "#FFF176"; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.15, 30, 0, Math.PI * 2); ctx.fill();
            // beach umbrella
            var ux = W * 0.28, uy = H * 0.62;
            ctx.strokeStyle = "#795548"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(ux, uy + H * 0.16); ctx.stroke();
            ctx.fillStyle = "#EF5350"; ctx.beginPath(); ctx.arc(ux, uy, 52, Math.PI, 0); ctx.fill();
            ctx.fillStyle = "#FFF";
            for (var uq = 0; uq < 3; uq++) { ctx.beginPath(); ctx.moveTo(ux - 52 + uq * 34, uy); ctx.lineTo(ux - 35 + uq * 34, uy); ctx.lineTo(ux - 52 + uq * 34, uy - 26); ctx.closePath(); ctx.fill(); }
        } else if (stop.id === "avigail") {
            // chic townhouse + heart
            var g5 = ctx.createLinearGradient(0, 0, 0, H);
            g5.addColorStop(0, "#6A1B9A"); g5.addColorStop(1, "#CE93D8");
            ctx.fillStyle = g5; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "#F8BBD0"; ctx.fillRect(W * 0.2, H * 0.22, W * 0.6, H * 0.52);
            ctx.fillStyle = "#AD1457"; ctx.fillRect(W * 0.2, H * 0.22, W * 0.6, H * 0.05);
            // fancy door
            ctx.fillStyle = "#4A148C"; ctx.fillRect(W * 0.42, H * 0.5, W * 0.16, H * 0.24);
            ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.arc(W * 0.56, H * 0.62, 3, 0, Math.PI * 2); ctx.fill();
            // windows
            ctx.fillStyle = "#B39DDB";
            ctx.fillRect(W * 0.26, H * 0.32, W * 0.12, H * 0.12);
            ctx.fillRect(W * 0.62, H * 0.32, W * 0.12, H * 0.12);
            // floating heart
            var hy = H * 0.14 + Math.sin(t * 2) * 6;
            ctx.fillStyle = "#EC407A";
            tripHeart(W / 2, hy, 18);
        } else { // vegas
            var g6 = ctx.createLinearGradient(0, 0, 0, H);
            g6.addColorStop(0, "#0D0221"); g6.addColorStop(0.6, "#311B4D"); g6.addColorStop(1, "#5D4037");
            ctx.fillStyle = g6; ctx.fillRect(0, 0, W, H);
            // desert stars
            for (var st2 = 0; st2 < 40; st2++) {
                ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(t * 2 + st2));
                ctx.fillStyle = "#FFF";
                ctx.fillRect((st2 * 97) % W, (st2 * 53) % (H * 0.4), 2, 2);
            }
            ctx.globalAlpha = 1;
            // neon VEGAS sign
            var neon = 0.6 + 0.4 * Math.abs(Math.sin(t * 5));
            ctx.save(); ctx.shadowColor = "#FFD54F"; ctx.shadowBlur = 18 * neon;
            drawText("VEGAS", W / 2, H * 0.2, "bold 44px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#B71C1C", 4);
            ctx.restore();
            // dice
            tripDie(W * 0.24, H * 0.7 + Math.sin(t * 2) * 5, 30, 5);
            tripDie(W * 0.74, H * 0.72 + Math.cos(t * 2) * 5, 30, 3);
        }
    }

    function tripHeart(cx, cy, s) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.9);
        ctx.bezierCurveTo(cx - s * 1.4, cy - s * 0.4, cx - s * 0.5, cy - s * 1.1, cx, cy - s * 0.35);
        ctx.bezierCurveTo(cx + s * 0.5, cy - s * 1.1, cx + s * 1.4, cy - s * 0.4, cx, cy + s * 0.9);
        ctx.closePath(); ctx.fill();
    }

    function tripDie(cx, cy, s, pips) {
        ctx.fillStyle = "#FFF"; roundRect(cx - s / 2, cy - s / 2, s, s, 6); ctx.fill();
        ctx.strokeStyle = "#B71C1C"; ctx.lineWidth = 2; roundRect(cx - s / 2, cy - s / 2, s, s, 6); ctx.stroke();
        ctx.fillStyle = "#B71C1C";
        var q = s * 0.26;
        var spots = { 3: [[-1, -1], [0, 0], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]] };
        var p = spots[pips] || spots[5];
        for (var i = 0; i < p.length; i++) {
            ctx.beginPath(); ctx.arc(cx + p[i][0] * q, cy + p[i][1] * q, s * 0.09, 0, Math.PI * 2); ctx.fill();
        }
    }

    // The greeter for each stop. bubbe/avigail reuse drawPortrait; vegas uses
    // Uncle Burry + a Mindy-and-kids cluster; heshy is a fresh swim-cap head;
    // the beach needs no person (a seagull says it all).
    function tripDrawGreeter(stop, cx, cy, t) {
        var talking = Math.sin(t * 5) > 0;
        if (stop.id === "bubbe") {
            drawPortrait("bubbe", cx, cy, 96, talking);
        } else if (stop.id === "avigail") {
            drawPortrait("avigail", cx, cy, 96, talking);
        } else if (stop.id === "vegas") {
            drawPortrait("burry", cx, cy, 92, talking);
            // little Mindy + kids cluster beside him
            tripMiniPerson(cx - 78, cy + 34, 0.55, "#E91E63", "#4E342E");
            tripMiniPerson(cx + 74, cy + 40, 0.4, "#FDD835", "#3E2723");
            tripMiniPerson(cx + 96, cy + 44, 0.36, "#42A5F5", "#5D4037");
        } else if (stop.id === "heshy") {
            tripDrawHeshy(cx, cy, t);
        } else { // beach — a seagull gliding
            var gx = cx + Math.sin(t) * 40;
            ctx.strokeStyle = "#FFF"; ctx.lineWidth = 5; ctx.lineCap = "round";
            var flap = Math.sin(t * 6) * 12;
            ctx.beginPath();
            ctx.moveTo(gx - 34, cy + flap); ctx.lineTo(gx, cy - 6); ctx.lineTo(gx + 34, cy + flap); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(gx - 30, cy + 20 + flap); ctx.lineTo(gx, cy + 6); ctx.lineTo(gx + 30, cy + 20 + flap); ctx.stroke();
        }
    }

    // Simple stand-in person (Mindy / kids at Vegas).
    function tripMiniPerson(cx, cy, sc, shirt, hair) {
        ctx.fillStyle = shirt; roundRect(cx - 12 * sc, cy, 24 * sc, 30 * sc, 6 * sc); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(cx, cy - 10 * sc, 13 * sc, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(cx, cy - 14 * sc, 13 * sc, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(cx - 4 * sc, cy - 10 * sc, 2 * sc, 0, Math.PI * 2); ctx.arc(cx + 4 * sc, cy - 10 * sc, 2 * sc, 0, Math.PI * 2); ctx.fill();
    }

    // Fresh Heshy head with a green swim cap (chunky cartoon).
    function tripDrawHeshy(cx, cy, t) {
        // shoulders
        ctx.fillStyle = "#0288D1"; roundRect(cx - 34, cy + 20, 68, 40, 12); ctx.fill();
        // head
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.stroke();
        // green swim cap
        ctx.fillStyle = "#43A047"; ctx.beginPath(); ctx.arc(cx, cy - 2, 31, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
        ctx.fillStyle = "#2E7D32"; ctx.fillRect(cx - 31, cy - 6, 62, 4);
        // goggles pushed up
        ctx.strokeStyle = "#0277BD"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx - 11, cy - 16, 8, 0, Math.PI * 2); ctx.arc(cx + 11, cy - 16, 8, 0, Math.PI * 2); ctx.stroke();
        // eyes + big grin
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(cx - 10, cy, 3.5, 0, Math.PI * 2); ctx.arc(cx + 10, cy, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#B71C1C"; ctx.lineWidth = 3; ctx.lineCap = "round";
        var mo = Math.sin(t * 5) > 0 ? 8 : 4;
        ctx.beginPath(); ctx.arc(cx, cy + 8, 12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        ctx.fillStyle = "#B71C1C"; ctx.beginPath(); ctx.arc(cx, cy + 8 + mo * 0.3, mo * 0.6, 0, Math.PI); ctx.fill();
    }

    // ── HUD journey pill (called from drawHUD) ───────────────────
    function drawJourneyPill() {
        if (typeof tripStopIdx === "undefined" || typeof TRIP_STOPS === "undefined") return;
        if (runMode !== "story") return;          // cruise shows no distance pill
        if (state !== "playing") return;
        // Yield the center-top strip to any active buff/gauge so nothing overlaps.
        if (typeof playerVehicle !== "undefined" && playerVehicle === "dozer" && typeof dozerTimer !== "undefined" && dozerTimer > 0) return;
        if ((typeof nitroTimer !== "undefined" && nitroTimer > 0) ||
            (typeof courageT !== "undefined" && courageT > 0) ||
            (typeof passengerTimer !== "undefined" && passengerTimer > 0) ||
            (typeof carMalfunction !== "undefined" && carMalfunction) ||
            (typeof distractedMode !== "undefined" && distractedMode)) return;

        var stop = TRIP_STOPS[tripStopIdx];
        var legD = stop.dist * tripCycleMult();
        var rem = (tripLegStart + legD) - scrollOffset;
        if (rem < 0) rem = 0;
        var prog = clamp(1 - rem / legD, 0, 1);
        var close = rem <= 2500;
        var pulling = (typeof tripPullInT !== "undefined" && tripPullInT > 0);
        var pulse = (close || pulling) ? (1 + 0.05 * Math.sin(gameTime * 8)) : 1;
        // ~15% smaller + a softer bg — the owner found the old pill a touch distracting.
        var pw = 133, ph = 19, px = W / 2 - pw / 2, py = 46;

        ctx.save();
        if (pulse !== 1) { ctx.translate(W / 2, py + ph / 2); ctx.scale(pulse, pulse); ctx.translate(-(W / 2), -(py + ph / 2)); }
        ctx.fillStyle = "rgba(15,20,30,0.65)";
        roundRect(px, py, pw, ph, 10); ctx.fill();
        ctx.strokeStyle = stop.accent; ctx.lineWidth = 1.5;
        roundRect(px, py, pw, ph, 10); ctx.stroke();
        var label = pulling ? (stop.icon + " ARRIVED!")
                            : (stop.icon + " " + (close ? "ALMOST THERE!" : (formatNum(Math.round(rem)) + "m")));
        drawText(label, W / 2, py + ph / 2 - 1, "bold 11px 'Segoe UI', Arial, sans-serif", (close || pulling) ? "#FFE082" : "#FFF", "#000", 3);
        // progress bar underneath
        var bw = pw - 14, bx = px + 7, by = py + ph + 2;
        ctx.fillStyle = "rgba(0,0,0,0.4)"; roundRect(bx, by, bw, 4, 2); ctx.fill();
        ctx.fillStyle = stop.accent; roundRect(bx, by, bw * prog, 4, 2); ctx.fill();
        ctx.restore();

        // A small fading "pulling in… <icon>" tag over the car during the pull-in.
        if (pulling && typeof player !== "undefined" && player) {
            var pa = clamp(1 - tripPullInT / 1.1, 0, 1);
            ctx.save();
            ctx.globalAlpha = 0.35 + 0.65 * pa;
            drawText("pulling in… " + stop.icon, player.x, player.y - 62,
                "bold 14px 'Segoe UI', Arial, sans-serif", stop.accent, "#000", 3);
            ctx.restore();
        }
    }

    // ── Menu postcards strip (called from drawMenu) ──────────────
    function drawPostcardsStrip() {
        if (!save.postcards || save.postcards.length <= 0) return;
        var n = TRIP_STOPS.length;
        var stampW = 26, gap = 8, totW = n * stampW + (n - 1) * gap;
        var sx = W / 2 - totW / 2;
        // Sits below the (now taller) menu stack — PLAY/STORY/SHOP|QUESTS/DISTRACTED/SHARED ROAD.
        var rowY = H * 0.80;
        for (var i = 0; i < n; i++) {
            var stop = TRIP_STOPS[i];
            var got = save.postcards.indexOf(stop.id) >= 0;
            var x = sx + i * (stampW + gap);
            ctx.fillStyle = got ? "rgba(30,40,55,0.92)" : "rgba(40,44,52,0.55)";
            roundRect(x, rowY, stampW, stampW, 5); ctx.fill();
            ctx.strokeStyle = got ? stop.accent : "rgba(255,255,255,0.18)"; ctx.lineWidth = got ? 2 : 1;
            roundRect(x, rowY, stampW, stampW, 5); ctx.stroke();
            if (got) {
                drawText(stop.icon, x + stampW / 2, rowY + stampW / 2 + 1, "16px Arial", "#FFF", null, 0);
            } else {
                drawText("?", x + stampW / 2, rowY + stampW / 2 + 1, "bold 13px Arial", "rgba(255,255,255,0.3)", null, 0);
            }
        }
        drawText("✈️ furthest trip: " + (save.tripBest || 0) + " stop" + ((save.tripBest || 0) === 1 ? "" : "s"),
            W / 2, rowY + 28, "bold 11px 'Segoe UI', Arial, sans-serif", "#B0BEC5", "#26323a", 2);
    }
