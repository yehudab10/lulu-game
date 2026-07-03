    // ════════════════════════════════════════════════════════════
    //  FOOT CUTSCENE — AVIGAIL'S WEDDING  (state === "footWedding")
    //  While walking the city, Lulu sometimes runs into Avigail —
    //  occasionally at her OWN chuppah. This is the full, funny,
    //  interactive Jewish-wedding cutscene.
    //
    //  PUBLIC (exactly three): startFootWedding / updateFootWedding /
    //  drawFootWedding. Everything else is wed*-prefixed & private.
    //  The game loop dispatches update/draw by state === "footWedding"
    //  (wired elsewhere). On exit we drop back to "footRun".
    //
    //  Phases (auto-advance; tap to hurry; ALWAYS terminates):
    //    0 PROCESSION — chuppah up top, white aisle, guest rows, klezmer
    //      fiddler. Avigail walks down the aisle to nervous chosson Aviel.
    //      TAP = throw petals/rice (shower + cheer + Lulu line).
    //    1 CHUPPAH — Avigail circles Aviel 7× (counter), then the glass.
    //      TAP = STOMP the glass → shatter, "MAZEL TOV!!!", confetti, band.
    //    2 SIMCHA — hora (figures spin, couple lifted on chairs), then the
    //      BOUQUET TOSS: a "CATCH!" timing tap. Caught = reward + "NEXT!".
    //      Then a short beat → exit to footRun (+ small gift).
    //
    //  particles aren't auto-ticked for this state, so we call
    //  updateParticles(dt) in update and drawParticles() in draw.
    // ════════════════════════════════════════════════════════════

    // ── scene state ──────────────────────────────────────────────
    var wedPhase = 0;              // 0 procession · 1 chuppah · 2 simcha · 3 done
    var wedTime = 0;               // total scene clock (for animations)
    var wedPhaseT = 0;             // time within the current phase
    var wedExiting = false;        // exit guard (prevents double-fire)
    var wedExitT = 0;              // post-bouquet beat before leaving

    // procession
    var wedAisleProg = 0;          // 0..1 Avigail's walk down the aisle
    var wedPetalCool = 0;          // throttle on the tap petal-shower SFX
    var wedPetalCount = 0;         // how many showers thrown (for a gag)

    // chuppah / circling
    var wedCircles = 0;            // 0..7 completed loops around the chosson
    var wedCircleAng = 0;          // current angle of Avigail's orbit
    var wedGlassStomped = false;
    var wedGlassShake = 0;         // pre-stomp anticipation wiggle
    var wedMazelT = 0;             // "MAZEL TOV!!!" banner timer

    // simcha / bouquet
    var wedHoraT = 0;              // hora spin clock
    var wedBouquetActive = false;  // bouquet currently in the air (catchable)
    var wedBouquetT = 0;           // bouquet arc progress 0..1
    var wedBouquetCaught = null;   // null = pending, true/false once resolved
    var wedBouquetTossed = false;  // toss has begun
    var wedCatchYelled = false;    // the synced "NOW — CATCH!" cue fired
    var wedBouquetX = 0, wedBouquetY = 0; // live bouquet position (for tap test)
    var wedRewardGiven = false;

    // current speech bubble
    var wedBubble = "", wedBubbleT = 0, wedBubbleX = 0, wedBubbleY = 0, wedBubbleLast = -1;

    // ── cached layout (built once in startFootWedding) ───────────
    var wedSkyGrad = null, wedAisleGrad = null;
    var wedGuests = [];            // {x, y, side, type, kvellPh, dabPh, col}
    var wedChuppahX = 0, wedChuppahY = 0, wedChuppahW = 0;
    var wedAisleX = 0, wedAisleTop = 0, wedAisleBot = 0, wedAisleW = 0;
    var wedFiddlerX = 0, wedFiddlerY = 0;
    var wedFlowerCols = ["#FF80AB", "#FF4081", "#FFD54F", "#BA68C8", "#FFF176", "#F8BBD0"];

    // ── dialogue pools (8-15 each) ───────────────────────────────
    var WED_BRIDE = [
        "Is my veil straight? IS IT? Somebody check!",
        "WHERE is my mother?! She had the ring— no, the TISSUES!",
        "I'm so happy I could plotz. Don't let me plotz.",
        "Twenty years of bubbe asking 'nu?' — TODAY, Bubbe. TODAY.",
        "If I trip on this gown I'm taking the photographer DOWN.",
        "Lulu! You came! Are you crying? Don't, you'll start ME.",
        "Did the caterer bring TWO briskets? Tell me TWO.",
        "My feet are KILLING me and I haven't even danced yet.",
        "Breathe, Avigail, breathe. ...okay that's enough breathing.",
        "I rehearsed this walk for a MONTH. Watch the legend work.",
        "Aviel looks like he's gonna faint. Same, honestly. SAME.",
        "Is it normal to want a nap at your own wedding?",
        "Somebody tell Tzippy her hat is blocking the WHOLE row."
    ];
    var WED_CHOSSON = [   // nervous Aviel under the chuppah
        "...is it too late to— no. No, I'm good. I'm GOOD.",
        "Why are 200 people LOOKING at me. Why. WHY.",
        "I memorized the vows. I forgot the vows. I— there they are.",
        "Is it hot under here or is that just my entire nervous system?",
        "Rabbi, can we do the short version? The SHORT version?",
        "I'm not sweating, YOU'RE— okay I'm sweating a LOT.",
        "She's GORGEOUS. I'm a schlub. How did I— mazel to ME.",
        "*shuckles intensely* davening that I don't drop the ring.",
        "One glass to stomp. One. I've been practicing on bubble wrap.",
        "If I pass out, tell everyone it was 'overcome with JOY.'",
        "Where do I put my HANDS? Why do I have so many hands?",
        "Don't lock knees, don't lock knees, don't lock kn—*sways*"
    ];
    var WED_GUEST = [
        "She was such a SWEET baby! I changed that punim's diapers!",
        "200 people and ONE brisket?! This is a SCANDAL.",
        "The band! TOO LOUD! ...play it again, it's gorgeous!",
        "Who's the maTCHmaker? I owe her a slap AND a thank-you.",
        "I gave them my GOOD blender. The GOOD one. Remember that.",
        "From the OTHER side they look even more in love. Kineahora!",
        "I'm not crying, I have a SIMCHA in my eye.",
        "Did you see the centerpieces? FOUR feet tall. FOUR.",
        "Nu, when's the viort? I skipped lunch for THIS.",
        "Aviel? Lovely boy. Couldn't park a car to save his life.",
        "Tzippy, SIT DOWN, the kallah is WALKING!",
        "I knew them when they were just a shidduch and a maybe.",
        "Save me a piece of the SECOND brisket. If it exists.",
        "Mazel toooov! *dabs eyes with three tissues at once*",
        "The flowers alone cost more than my FIRST car. Worth it."
    ];
    var WED_LULU = [
        "I'm not crying, YOU'RE crying!",
        "Mazel tov!! ...is there a viort? I'm STARVING.",
        "Avigail's getting MARRIED and I'm here in walking shoes. Iconic.",
        "I caught the bouquet — is that legally binding?",
        "She made me PROMISE I'd dance. My knees made no such promise.",
        "Rose petals? On it. I'm basically a flower girl now.",
        "Look at her GO. That's my best friend up there!",
        "Somebody hold me, this is too beautiful... and there's brisket.",
        "I walked here. I'll dance here. I'll EAT here. Worth the blisters.",
        "Aviel better treat her right or he answers to ME and my sneakers.",
        "Kvelling so hard I might levitate. Mazel TOV!",
        "Ten outta ten chuppah. No notes. Pass the rugelach."
    ];
    var WED_CHEER = [
        "MAZEL TOV!", "WOOO!", "SIMAN TOV!", "DANCE!", "L'CHAIM!", "KINEAHORA!"
    ];
    var WED_CIRCLE = [   // shown as she completes each of the 7 circles
        "One! ...this is dizzy work.",
        "Two! Aviel, hold STILL.",
        "Three! Halfway-ish? I lost count. Three!",
        "Four! The gown weighs a THOUSooo—four!",
        "Five! Somebody's bubbe is timing this.",
        "Six! ONE more, ONE more!",
        "SEVEN! Done! I'm a DREIDEL, somebody catch me!"
    ];
    var WED_BOUQUET_WIN = [
        "You're NEXT, Lulu!!",
        "She THREW it RIGHT at you. That's basically a contract.",
        "CAUGHT IT! ...do I have to give it back? I'm keeping it.",
        "The crowd GASPS. Lulu, the people have SPOKEN."
    ];
    var WED_BOUQUET_MISS = [
        "...it bounced off your HEAD. The seagull got it. Classic.",
        "SO close! It's fine. You're 'between bouquets' right now.",
        "Tzippy boxed you out. Tzippy plays DIRTY.",
        "Whiffed it! No worries — more cake for the single ladies."
    ];

    // ── tiny anti-repeat picker (per-pool last index) ────────────
    var wedLastIdx = {};
    function wedPick(pool, key) {
        var idx = randInt(0, pool.length - 1);
        if (pool.length > 1 && idx === wedLastIdx[key]) idx = (idx + 1) % pool.length;
        wedLastIdx[key] = idx;
        return pool[idx];
    }
    function wedSay(pool, key, x, y, dur) {
        wedBubble = wedPick(pool, key);
        wedBubbleT = (dur === undefined) ? 2.6 : dur;
        wedBubbleX = x; wedBubbleY = y;
    }

    // ── confetti / petals (capped) ───────────────────────────────
    function wedBurst(x, y, n, cols, up, spread) {
        for (var i = 0; i < n && particles.length < 240; i++) {
            var ang = -Math.PI / 2 + rand(-spread, spread);
            var spd = rand(60, up);
            particles.push({
                x: x + rand(-10, 10), y: y,
                vx: Math.cos(ang) * spd + rand(-30, 30),
                vy: Math.sin(ang) * spd,
                life: rand(0.9, 1.7), maxLife: 1.7,
                size: rand(2.5, 5.5),
                color: randPick(cols), gravity: rand(120, 220)
            });
        }
    }

    // ════════════════════════════════════════════════════════════
    //  SETUP
    // ════════════════════════════════════════════════════════════
    function startFootWedding() {
        state = "footWedding";
        wedPhase = 0; wedTime = 0; wedPhaseT = 0;
        wedExiting = false; wedExitT = 0;
        wedAisleProg = 0; wedPetalCool = 0; wedPetalCount = 0;
        wedCircles = 0; wedCircleAng = -Math.PI / 2;
        wedGlassStomped = false; wedGlassShake = 0; wedMazelT = 0;
        wedHoraT = 0;
        wedBouquetActive = false; wedBouquetT = 0; wedBouquetCaught = null;
        wedBouquetTossed = false; wedRewardGiven = false; wedCatchYelled = false;
        wedBubble = ""; wedBubbleT = 0; wedLastIdx = {};

        // clear any stale input so the no-tap intro is smooth
        consumeClick(); consumeAction();

        var top = SAFE_TOP, bot = H - SAFE_BOTTOM;

        // aisle geometry (runs down the middle, chuppah at the top)
        wedAisleW = 132;
        wedAisleX = W / 2 - wedAisleW / 2;
        wedAisleTop = top + 150;
        wedAisleBot = bot - 70;

        // chuppah canopy near the top
        wedChuppahW = 200;
        wedChuppahX = W / 2;
        wedChuppahY = top + 92;

        // klezmer fiddler off to one side, up near the chuppah
        wedFiddlerX = W - 52;
        wedFiddlerY = top + 132;

        // cached gradients (built ONCE)
        wedSkyGrad = ctx.createLinearGradient(0, 0, 0, bot);
        wedSkyGrad.addColorStop(0, "#FFE6A7");
        wedSkyGrad.addColorStop(0.5, "#FFD089");
        wedSkyGrad.addColorStop(1, "#E8B7D8");
        wedAisleGrad = ctx.createLinearGradient(0, wedAisleTop, 0, wedAisleBot);
        wedAisleGrad.addColorStop(0, "#FFFFFF");
        wedAisleGrad.addColorStop(1, "#F1E6D6");

        // precompute guest rows on both sides of the aisle (static layout)
        wedGuests = [];
        var rowY0 = wedAisleTop + 20;
        var rows = Math.max(3, Math.floor((wedAisleBot - rowY0 - 30) / 58));
        for (var r = 0; r < rows; r++) {
            var gy = rowY0 + r * 58;
            for (var side = -1; side <= 1; side += 2) {
                var seats = (side < 0) ? 2 : 2; // a couple per row per side
                for (var s = 0; s < seats; s++) {
                    var gx = (side < 0)
                        ? wedAisleX - 22 - s * 34
                        : wedAisleX + wedAisleW + 22 + s * 34;
                    if (gx < 14 || gx > W - 14) continue;
                    wedGuests.push({
                        x: gx, y: gy, side: side,
                        type: randInt(0, 2),
                        worker: false,
                        kvellPh: rand(0, Math.PI * 2),
                        dabPh: rand(0, Math.PI * 2),
                        dabActive: rand(0, 1) < 0.4,
                        col: randPick(wedFlowerCols)
                    });
                }
            }
        }

        // a couple of opening lines so the scene starts alive
        wedSay(WED_LULU, "lulu", W / 2, wedAisleBot - 30, 3.2);
        playTone(523, 0.12, "triangle", 0.16, 784);
    }

    // ════════════════════════════════════════════════════════════
    //  UPDATE
    // ════════════════════════════════════════════════════════════
    function updateFootWedding(dt) {
        if (dt > 0.05) dt = 0.05; // clamp huge frames (tab refocus)
        wedTime += dt;
        wedPhaseT += dt;
        if (wedBubbleT > 0) wedBubbleT -= dt;
        if (wedMazelT > 0) wedMazelT -= dt;
        if (wedPetalCool > 0) wedPetalCool -= dt;
        updateParticles(dt);

        var click = consumeClick();
        var act = consumeAction();
        var tapped = !!click || act;

        if (wedPhase === 0) wedUpdateProcession(dt, tapped);
        else if (wedPhase === 1) wedUpdateChuppah(dt, tapped, click);
        else if (wedPhase === 2) wedUpdateSimcha(dt, tapped, click);
        else wedUpdateDone(dt);
    }

    // PHASE 0 — procession ----------------------------------------
    function wedUpdateProcession(dt, tapped) {
        // Avigail strolls down the aisle. Tap hurries her + throws petals.
        var speed = 0.085;           // base aisle pace (slow, regal)
        if (tapped) {
            speed += 0.4;            // a tap nudges her along
            wedThrowPetals();
        }
        wedAisleProg = clamp(wedAisleProg + speed * dt * (tapped ? 6 : 1), 0, 1);

        // occasional ambient lines while she walks
        if (wedBubbleT <= 0 && rand(0, 1) < dt * 0.7) {
            var roll = rand(0, 1);
            if (roll < 0.4) wedSay(WED_BRIDE, "bride", W / 2, wedAisleTop + 40);
            else if (roll < 0.7) wedSay(WED_CHOSSON, "chosson", wedChuppahX, wedChuppahY + 4);
            else wedSay(WED_GUEST, "guest", randPick(wedGuests).x, randPick(wedGuests).y - 18);
        }

        // she's reached the chuppah → advance
        if (wedAisleProg >= 1 && wedPhaseT > 1.2) wedGoto(1);
        // hard fallback so it can never stall
        if (wedPhaseT > 16) wedGoto(1);
    }

    function wedThrowPetals() {
        var px = clamp(wedAisleX + wedAisleW / 2 + rand(-30, 30), 20, W - 20);
        wedBurst(px, wedAisleTop + 30, 14, wedFlowerCols, 200, 1.1);
        wedPetalCount++;
        if (wedPetalCool <= 0) {
            wedPetalCool = 0.25;
            playTone(880, 0.05, "sine", 0.12, 1320);
        }
        // a cheer + a Lulu/guest reaction (kept snappy)
        if (rand(0, 1) < 0.6) wedSay(WED_LULU, "lulu", W / 2, wedAisleBot - 30, 2.0);
        else wedSay(WED_GUEST, "guest", randPick(wedGuests).x, randPick(wedGuests).y - 18, 2.0);
    }

    // PHASE 1 — chuppah: 7 circles, then stomp the glass ----------
    function wedUpdateChuppah(dt, tapped, click) {
        if (wedCircles < 7) {
            // Avigail orbits the chosson; tap speeds the current loop.
            var orbitSpeed = 1.5 + (tapped ? 5 : 0);
            wedCircleAng += orbitSpeed * dt;
            if (wedCircleAng >= -Math.PI / 2 + Math.PI * 2) {
                wedCircleAng -= Math.PI * 2;
                wedCircles++;
                playTone(440 + wedCircles * 50, 0.1, "triangle", 0.16);
                // show the SPECIFIC counted line ("One!", "Two!", ... "SEVEN!")
                wedBubble = WED_CIRCLE[Math.min(wedCircles - 1, WED_CIRCLE.length - 1)];
                wedBubbleT = 1.8; wedBubbleX = wedChuppahX; wedBubbleY = wedChuppahY + 10;
            }
            // fallback: auto-finish circling if dawdling
            if (wedPhaseT > 11) wedCircles = 7;
            return;
        }

        // GLASS time. Anticipation wiggle; tap to STOMP.
        wedGlassShake = 0.5 + Math.sin(wedTime * 8) * 0.5;
        if (!wedGlassStomped) {
            if (wedBubbleT <= 0 && rand(0, 1) < dt * 0.8) {
                wedSay(WED_CHOSSON, "chosson", wedChuppahX, wedChuppahY + 4, 2.2);
            }
            if (tapped || wedPhaseT > 9) {
                wedStompGlass();
            }
            return;
        }

        // post-stomp celebration beat, then → simcha
        if (wedPhaseT > 2.6) wedGoto(2);
    }

    function wedStompGlass() {
        wedGlassStomped = true;
        wedMazelT = 2.4;
        wedPhaseT = 0; // reuse as post-stomp timer
        // shatter shards + a confetti blast over the chuppah
        wedBurst(wedChuppahX, wedChuppahY + 70, 16, ["#B3E5FC", "#E1F5FE", "#90CAF9", "#FFFFFF"], 260, 1.4);
        wedBurst(wedChuppahX, wedChuppahY + 50, 28, ["#FF4081", "#FFD54F", "#7E57C2", "#4FC3F7", "#FFFFFF"], 300, 1.5);
        playTone(180, 0.18, "sawtooth", 0.22, 60);          // crunch
        setTimeout(function () { playTone(660, 0.1, "triangle", 0.2, 990); }, 90);
        setTimeout(function () { playTone(880, 0.12, "triangle", 0.2, 1320); }, 200);
        setTimeout(function () { playTone(1175, 0.18, "triangle", 0.22, 1568); }, 320);
        wedBubble = "MAZEL TOV!!!"; wedBubbleT = 2.4;
        wedBubbleX = W / 2; wedBubbleY = wedChuppahY + 20;
    }

    // PHASE 2 — simcha: hora, then bouquet toss ------------------
    function wedUpdateSimcha(dt, tapped, click) {
        wedHoraT += dt;

        // After a few seconds of hora, toss the bouquet.
        if (!wedBouquetTossed && wedPhaseT > 3.2) {
            wedBouquetTossed = true;
            wedBouquetActive = true;
            wedBouquetT = 0;
            wedBouquetCaught = null;
            playTone(784, 0.12, "triangle", 0.2, 1046);
            // Anticipation first — the actual "CATCH!" fires when the catch
            // window really opens (it used to yell CATCH ~0.9s too early and
            // bait a fumble tap).
            wedBubble = "Here it comes…!";
            wedBubbleT = 0.9; wedBubbleX = W / 2; wedBubbleY = wedAisleBot - 40;
        }

        // ambient hora lines before the toss
        if (!wedBouquetTossed && wedBubbleT <= 0 && rand(0, 1) < dt * 0.6) {
            wedSay(WED_GUEST, "guest", randPick(wedGuests).x, randPick(wedGuests).y - 18, 2.0);
        }

        if (wedBouquetActive) {
            wedBouquetT += dt / 1.5;   // ~1.5s arc
            // arc path: from chuppah down toward Lulu at the front-left
            var sx = wedChuppahX, sy = wedChuppahY + 40;
            var ex = wedLuluX(), ey = wedAisleBot - 26;
            wedBouquetX = lerp(sx, ex, wedBouquetT);
            wedBouquetY = lerp(sy, ey, wedBouquetT) - Math.sin(wedBouquetT * Math.PI) * 90; // up-and-over

            // catch window: tap while it's near Lulu (late in the arc)
            var nearLulu = wedBouquetT > 0.62;
            // The moment the window opens, NOW we yell it (synced to the truth).
            if (nearLulu && !wedCatchYelled) {
                wedCatchYelled = true;
                wedBubble = "NOW — CATCH! 💐";
                wedBubbleT = 0.8; wedBubbleX = W / 2; wedBubbleY = wedAisleBot - 40;
                playTone(988, 0.08, "triangle", 0.2);
            }
            if (wedBouquetCaught === null && (tapped)) {
                if (nearLulu) wedCatchBouquet(true);
                else wedCatchBouquet(false); // tapped too early → fumble
            }
            // reached the end untapped → missed
            if (wedBouquetCaught === null && wedBouquetT >= 1) {
                wedCatchBouquet(false);
            }
        } else if (wedBouquetCaught !== null) {
            // resolved — short beat then exit
            if (wedPhaseT > 2.4 || tapped) wedGoto(3);
        }

        // absolute fallback
        if (wedPhaseT > 14) {
            if (wedBouquetCaught === null) wedCatchBouquet(false);
            wedGoto(3);
        }
    }

    function wedCatchBouquet(caught) {
        wedBouquetActive = false;
        wedBouquetCaught = caught;
        wedPhaseT = 0; // reuse as post-catch timer
        if (caught) {
            wedBurst(wedBouquetX, wedBouquetY, 20, wedFlowerCols, 240, 1.4);
            playCoin();
            wedBubble = wedPick(WED_BOUQUET_WIN, "bqwin");
            wedBubbleT = 2.4; wedBubbleX = W / 2; wedBubbleY = wedAisleBot - 40;
            wedGiveReward(true);
        } else {
            playWompWomp();
            wedBubble = wedPick(WED_BOUQUET_MISS, "bqmiss");
            wedBubbleT = 2.4; wedBubbleX = W / 2; wedBubbleY = wedAisleBot - 40;
            wedGiveReward(false);
        }
    }

    // award a small gift on the way out (once)
    function wedGiveReward(caught) {
        if (wedRewardGiven) return;
        wedRewardGiven = true;
        var n = caught ? 40 : 15;
        footCoinsRun += n; runCoins += n; save.totalCoins += n;
        if (caught) footAwardStar();
        persistSave();
        // Showing up to her WEDDING is the biggest friendship moment there is
        // (+15; catching the bouquet makes it +20 — she threw it AT you, admit it).
        if (typeof bumpAvigailRel === "function") bumpAvigailRel(caught ? 20 : 15);
        spawnFloater(W / 2, wedAisleBot - 80, "+" + n + (caught ? " 💰  +1⭐" : " 💰"),
            caught ? "#FFD700" : "#FFE082");
    }

    // PHASE 3 — exit beat -----------------------------------------
    function wedUpdateDone(dt) {
        wedExitT += dt;
        if (!wedExiting && (wedExitT > 1.6 || consumeAction())) {
            wedExiting = true;
            playTone(660, 0.1, "triangle", 0.18, 880);
            // back to walking the city
            state = "footRun";
            consumeClick(); consumeAction();
        }
    }

    function wedGoto(phase) {
        wedPhase = phase;
        wedPhaseT = 0;
        wedBubbleT = Math.min(wedBubbleT, 1.0); // let lingering bubbles fade fast
    }

    // Lulu stands at the front-left as a guest (computed, used a few places)
    function wedLuluX() { return wedAisleX - 36; }
    function wedLuluY() { return wedAisleBot - 18; }

    // ════════════════════════════════════════════════════════════
    //  DRAW
    // ════════════════════════════════════════════════════════════
    function drawFootWedding() {
        var top = SAFE_TOP, bot = H - SAFE_BOTTOM;

        // sky / hall backdrop (cached gradient)
        ctx.fillStyle = wedSkyGrad;
        ctx.fillRect(0, 0, W, H);

        // ground band beneath everything
        ctx.fillStyle = "#D8C39E";
        ctx.fillRect(0, wedAisleTop - 6, W, bot - (wedAisleTop - 6));

        // ── aisle runner ─────────────────────────────────────────
        ctx.fillStyle = wedAisleGrad;
        ctx.fillRect(wedAisleX, wedAisleTop, wedAisleW, wedAisleBot - wedAisleTop);
        ctx.strokeStyle = "#C9B79A"; ctx.lineWidth = 2;
        ctx.strokeRect(wedAisleX, wedAisleTop, wedAisleW, wedAisleBot - wedAisleTop);
        // soft rose petals scattered on the runner (static-ish, phase-driven)
        for (var p = 0; p < 10; p++) {
            var pyr = wedAisleTop + ((p * 53) % (wedAisleBot - wedAisleTop));
            var pxr = wedAisleX + 16 + ((p * 37) % (wedAisleW - 32));
            ctx.fillStyle = wedFlowerCols[p % wedFlowerCols.length];
            ctx.globalAlpha = 0.55;
            ctx.beginPath(); ctx.ellipse(pxr, pyr, 4, 2.4, p, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // ── guests on both sides ─────────────────────────────────
        for (var g = 0; g < wedGuests.length; g++) wedDrawGuest(wedGuests[g]);

        // ── klezmer fiddler ──────────────────────────────────────
        wedDrawFiddler(wedFiddlerX, wedFiddlerY);

        // ── chuppah canopy + occupants ───────────────────────────
        wedDrawChuppah();

        // ── Lulu (guest, front-left) ─────────────────────────────
        wedDrawLulu();

        // ── bouquet in flight (phase 2) ──────────────────────────
        if (wedPhase === 2 && wedBouquetActive) wedDrawBouquet(wedBouquetX, wedBouquetY);

        // ── particles (petals / confetti / shards) ───────────────
        drawParticles();

        // ── MAZEL TOV banner (post-stomp) ────────────────────────
        if (wedMazelT > 0) {
            ctx.save();
            var pop = 1 + Math.sin((2.4 - wedMazelT) * 14) * 0.06;
            ctx.translate(W / 2, top + 60);
            ctx.scale(pop, pop);
            drawText("MAZEL TOV!!!", 0, 0, "bold 34px 'Segoe UI', Arial, sans-serif",
                "#FFD700", "#7A1010", 6);
            ctx.restore();
        }

        // ── speech bubble ────────────────────────────────────────
        if (wedBubbleT > 0 && wedBubble) {
            var bx = clamp(wedBubbleX, 80, W - 80);
            var by = clamp(wedBubbleY, top + 70, bot - 20);
            drawSpeechBubble(bx, by, wedBubble, wedTime);
        }

        // ── HUD: title banner + phase hint + touch hints ─────────
        wedDrawHUD();
    }

    // — title banner + contextual prompt —
    function wedDrawHUD() {
        var top = SAFE_TOP, bot = H - SAFE_BOTTOM;
        // banner
        ctx.save();
        ctx.translate(0, top);
        var bw = 300, bx = (W - bw) / 2;
        ctx.fillStyle = "rgba(60,20,70,0.85)";
        roundRect(bx, 8, bw, 36, 10); ctx.fill();
        ctx.strokeStyle = "#FFD54F"; ctx.lineWidth = 2;
        roundRect(bx, 8, bw, 36, 10); ctx.stroke();
        drawText("💍 AVIGAIL'S WEDDING!", W / 2, 26,
            "bold 18px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 4);
        ctx.restore();

        // contextual action prompt (bobbing)
        var bob = Math.sin(wedTime * 4) * 3;
        var prompt = null, sub = null;
        if (wedPhase === 0) {
            prompt = isTouchDevice ? "👆 TAP to throw petals!" : "SPACE / CLICK to throw petals!";
            sub = "Here comes the kallah...";
        } else if (wedPhase === 1) {
            if (wedCircles < 7) {
                prompt = "Circling the chosson... (" + wedCircles + "/7)";
                sub = isTouchDevice ? "tap to help her spin" : "tap/space to help her spin";
            } else if (!wedGlassStomped) {
                prompt = isTouchDevice ? "👆 STOMP THE GLASS!" : "STOMP THE GLASS! (space/click)";
                sub = "...everyone's waiting...";
            }
        } else if (wedPhase === 2) {
            if (wedBouquetActive) { prompt = "CATCH!! 💐"; sub = "tap when it's close!"; }
            else if (wedBouquetCaught === true) { prompt = "🎉 You're NEXT, Lulu!"; }
            else if (wedBouquetCaught === false) { prompt = "Aw, so close! 💐"; }
        } else {
            prompt = "🎉 Mazel tov, Avigail! 🎉";
        }
        if (prompt) {
            drawText(prompt, W / 2, bot - 38 + (wedPhase !== 1 || wedCircles >= 7 ? bob : 0),
                "bold 18px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#5A1A66", 4);
        }
        if (sub) {
            drawText(sub, W / 2, bot - 16, "bold 12px 'Segoe UI', Arial, sans-serif",
                "#FFF3C4", "#5A1A66", 3);
        }
    }

    // — a single seated guest who turns, kvells & dabs —
    function wedDrawGuest(gu) {
        ctx.save();
        ctx.translate(gu.x, gu.y);
        // turn toward the aisle (lean) + gentle kvell bob
        var kvell = Math.sin(wedTime * 2 + gu.kvellPh) * 2;
        var lean = gu.side * 0.12;
        ctx.translate(0, kvell);
        ctx.rotate(lean);

        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath(); ctx.ellipse(0, 18, 11, 3.5, 0, 0, Math.PI * 2); ctx.fill();

        // body (formalwear — dark suits / colorful gowns)
        var bodyCol = (gu.type === 0) ? "#2C2C3A" : gu.col;
        ctx.fillStyle = bodyCol;
        roundRect(-8, -2, 16, 18, 5); ctx.fill();

        // head
        ctx.fillStyle = "#FFD9B8";
        ctx.beginPath(); ctx.arc(0, -10, 7, 0, Math.PI * 2); ctx.fill();

        // hat / hair by type
        if (gu.type === 0) {
            // black hat (man's side vibe)
            ctx.fillStyle = "#15151E";
            ctx.beginPath(); ctx.arc(0, -12, 7.5, Math.PI, Math.PI * 2); ctx.fill();
            ctx.fillRect(-9, -12, 18, 2.5);
        } else if (gu.type === 1) {
            // sheitel / styled hair
            ctx.fillStyle = "#5D3A1A";
            ctx.beginPath(); ctx.arc(0, -12, 8, Math.PI, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-6, -8, 3, 0, Math.PI * 2); ctx.arc(6, -8, 3, 0, Math.PI * 2); ctx.fill();
        } else {
            // a big hat (the row-blocking variety)
            ctx.fillStyle = randPickStable(gu, ["#7E57C2", "#26A69A", "#EF5350"]);
            ctx.beginPath(); ctx.ellipse(0, -14, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(0, -15, 5, Math.PI, Math.PI * 2); ctx.fill();
        }

        // eyes (tiny, happy)
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(-2.4, -10, 1, 0, Math.PI * 2); ctx.arc(2.4, -10, 1, 0, Math.PI * 2); ctx.fill();

        // a dabbing tissue at the eye for the criers
        if (gu.dabActive) {
            var dab = (Math.sin(wedTime * 1.6 + gu.dabPh) * 0.5 + 0.5);
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath(); ctx.arc(3 + dab * 1.5, -10 - dab * 1.5, 2.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    // deterministic pick keyed off a guest (no per-frame flicker)
    function randPickStable(gu, arr) {
        if (gu._stable === undefined) gu._stable = randInt(0, arr.length - 1);
        return arr[gu._stable];
    }

    // — klezmer fiddler swaying with his violin —
    function wedDrawFiddler(x, y) {
        ctx.save();
        ctx.translate(x, y);
        var sway = Math.sin(wedTime * 3) * 0.12;
        var bow = Math.sin(wedTime * 9) * 6;
        ctx.rotate(sway);
        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath(); ctx.ellipse(0, 24, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
        // body (vest)
        ctx.fillStyle = "#3E2723";
        roundRect(-9, 0, 18, 22, 5); ctx.fill();
        ctx.fillStyle = "#6D4C41";
        roundRect(-6, 2, 12, 16, 3); ctx.fill();
        // head + black hat
        ctx.fillStyle = "#FFD9B8";
        ctx.beginPath(); ctx.arc(0, -8, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#15151E";
        ctx.beginPath(); ctx.arc(0, -10, 7.5, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillRect(-9, -10, 18, 2.5);
        // beard
        ctx.fillStyle = "#9E9E9E";
        ctx.beginPath(); ctx.arc(0, -3, 4, 0, Math.PI); ctx.fill();
        // violin tucked under chin
        ctx.save();
        ctx.translate(-7, -2); ctx.rotate(-0.5);
        ctx.fillStyle = "#7B3F00";
        roundRect(-4, -3, 8, 16, 4); ctx.fill();
        ctx.strokeStyle = "#2A1500"; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, 13); ctx.stroke();
        ctx.restore();
        // bow (sawing)
        ctx.strokeStyle = "#E0C9A6"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-12, 2 + bow); ctx.lineTo(6, -4 - bow); ctx.stroke();
        // little ♪ notes
        ctx.fillStyle = "#7A1066";
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(wedTime * 6);
        drawText("♪", 14, -14, "bold 12px Arial", "#7A1066", null, 0);
        drawText("♫", 18, -2, "bold 10px Arial", "#AD1457", null, 0);
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // — the chuppah canopy + Avigail/Aviel/rabbi under it —
    function wedDrawChuppah() {
        var cx = wedChuppahX, cy = wedChuppahY, hw = wedChuppahW / 2;
        var poleTop = cy - 36, poleBot = cy + 96;

        // four poles (held by friends — drawn as little hands at the base)
        ctx.strokeStyle = "#8D6E63"; ctx.lineWidth = 5; ctx.lineCap = "round";
        var poleX = [cx - hw, cx - hw * 0.34, cx + hw * 0.34, cx + hw];
        for (var i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(poleX[i], poleTop); ctx.lineTo(poleX[i], poleBot);
            ctx.stroke();
            // friend's hand gripping the pole
            ctx.fillStyle = "#FFD9B8";
            ctx.beginPath(); ctx.arc(poleX[i], poleBot - 6, 3.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.lineCap = "butt";

        // canopy cloth (tallis-ish, gently billowing)
        var bil = Math.sin(wedTime * 1.5) * 4;
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(cx - hw - 6, poleTop);
        ctx.quadraticCurveTo(cx, poleTop - 16 - bil, cx + hw + 6, poleTop);
        ctx.lineTo(cx + hw + 6, poleTop + 14);
        ctx.quadraticCurveTo(cx, poleTop - 2 - bil, cx - hw - 6, poleTop + 14);
        ctx.closePath(); ctx.fill();
        // blue tallis stripes
        ctx.strokeStyle = "#3F51B5"; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - hw, poleTop + 5); ctx.lineTo(cx + hw, poleTop + 5);
        ctx.moveTo(cx - hw, poleTop + 9); ctx.lineTo(cx + hw, poleTop + 9);
        ctx.stroke();
        // canopy fringe
        ctx.fillStyle = "#FFD700";
        for (var f = -hw; f <= hw; f += 12) {
            ctx.fillRect(cx + f, poleTop + 13, 2, 4);
        }

        // — rabbi behind the couple (small) —
        ctx.save();
        ctx.translate(cx, cy + 56);
        ctx.fillStyle = "#1B1B22";
        roundRect(-7, -2, 14, 18, 4); ctx.fill();            // black coat
        ctx.fillStyle = "#FFD9B8";
        ctx.beginPath(); ctx.arc(0, -9, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#15151E";                            // hat
        ctx.beginPath(); ctx.arc(0, -11, 6.5, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillRect(-8, -11, 16, 2);
        ctx.fillStyle = "#E0E0E0";                            // long beard
        ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(4, -5); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill();
        ctx.restore();

        // — the chosson Aviel, nervously shuckling under the canopy —
        var chossonX = cx + (wedPhase >= 1 ? 0 : 22);
        var shuckle = Math.sin(wedTime * 6) * 3;       // forward-back davening
        var chossonY = cy + 64;
        wedDrawChosson(chossonX, chossonY + Math.abs(shuckle) * 0.2, shuckle);

        // — the glass under a napkin (phase 1, when circling done) —
        if (wedPhase === 1 && wedCircles >= 7 && !wedGlassStomped) {
            wedDrawGlass(chossonX, chossonY + 30);
        }

        // — Avigail: in procession she walks the aisle; in chuppah she
        //   circles the chosson; afterward she stands beside him. —
        var ax, ay, awalk = wedTime;
        if (wedPhase === 0) {
            ax = wedAisleX + wedAisleW / 2;
            ay = lerp(wedAisleBot - 30, cy + 70, wedAisleProg);
        } else if (wedPhase === 1 && wedCircles < 7) {
            ax = chossonX + Math.cos(wedCircleAng) * 30;
            ay = chossonY + 6 + Math.sin(wedCircleAng) * 16;
        } else {
            ax = cx - 22; ay = cy + 70;
        }
        wedDrawBride(ax, ay, awalk);
    }

    // — Avigail with veil + gown, over the walker sprite —
    function wedDrawBride(x, y, walkTime) {
        // base sprite
        drawAvigailWalker(x, y, walkTime);
        // white gown skirt over her legs
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.moveTo(-9, -2);
        ctx.lineTo(9, -2);
        ctx.lineTo(15, 24);
        ctx.quadraticCurveTo(0, 30, -15, 24);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#E6D7E8"; ctx.lineWidth = 1;
        ctx.stroke();
        // sash
        ctx.fillStyle = "#F8BBD0";
        ctx.fillRect(-9, 2, 18, 3);
        // flowing veil from the back of her head
        var vw = Math.sin(walkTime * 2) * 3;
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath();
        ctx.moveTo(-7, -20);
        ctx.quadraticCurveTo(-16 + vw, -4, -12 + vw, 18);
        ctx.quadraticCurveTo(0, 22, 12 - vw, 18);
        ctx.quadraticCurveTo(16 - vw, -4, 7, -20);
        ctx.closePath(); ctx.fill();
        // little floral crown over the veil
        ctx.fillStyle = "#FF80AB";
        for (var fc = -6; fc <= 6; fc += 4) {
            ctx.beginPath(); ctx.arc(fc, -22, 2, 0, Math.PI * 2); ctx.fill();
        }
        // bouquet in hand (until she tosses it in phase 2)
        if (!(wedPhase === 2 && wedBouquetTossed)) {
            wedDrawBouquet(11, 6, true);
        }
        ctx.restore();
    }

    // — nervous chosson Aviel —
    function wedDrawChosson(x, y, shuckle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(shuckle * 0.01);
        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath(); ctx.ellipse(0, 22, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
        // legs
        ctx.fillStyle = "#1B1B22";
        roundRect(-6, 8, 5, 14, 2); ctx.fill();
        roundRect(1, 8, 5, 14, 2); ctx.fill();
        // long black kittel/coat
        ctx.fillStyle = "#15151E";
        roundRect(-11, -6, 22, 22, 6); ctx.fill();
        // white kittel front
        ctx.fillStyle = "#F5F5F5";
        roundRect(-4, -4, 8, 18, 3); ctx.fill();
        // hands clasped nervously in front
        ctx.fillStyle = "#FFD9B8";
        ctx.beginPath(); ctx.arc(0, 8, 3.5, 0, Math.PI * 2); ctx.fill();
        // head
        ctx.fillStyle = "#FFD9B8";
        ctx.beginPath(); ctx.arc(0, -14, 8, 0, Math.PI * 2); ctx.fill();
        // black hat
        ctx.fillStyle = "#15151E";
        ctx.beginPath(); ctx.arc(0, -17, 8.5, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillRect(-10, -17, 20, 3);
        // wide nervous eyes
        ctx.fillStyle = "#FFF";
        ctx.beginPath(); ctx.arc(-3, -14, 2.4, 0, Math.PI * 2); ctx.arc(3, -14, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#000";
        var dart = Math.sin(wedTime * 5) * 0.8;
        ctx.beginPath(); ctx.arc(-3 + dart, -14, 1.1, 0, Math.PI * 2); ctx.arc(3 + dart, -14, 1.1, 0, Math.PI * 2); ctx.fill();
        // sweat bead
        ctx.fillStyle = "#4FC3F7";
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(wedTime * 4);
        ctx.beginPath(); ctx.arc(8, -12, 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // little beard
        ctx.fillStyle = "#5D3A1A";
        ctx.beginPath(); ctx.arc(0, -8, 4, 0, Math.PI); ctx.fill();
        ctx.restore();
    }

    // — the glass under a napkin, shaking before the stomp —
    function wedDrawGlass(x, y) {
        ctx.save();
        ctx.translate(x + Math.sin(wedTime * 18) * wedGlassShake, y);
        // napkin
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(8, 8); ctx.lineTo(-8, 8);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#D0D0D0"; ctx.lineWidth = 1; ctx.stroke();
        // glint
        ctx.fillStyle = "rgba(173,216,230,0.7)";
        ctx.beginPath(); ctx.ellipse(0, 2, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // a finger-tap hint arrow bobbing above it
        var ar = Math.sin(wedTime * 6) * 3;
        drawText("👞", x, y - 18 - ar, "bold 18px Arial", "#5D4037", "#FFF", 2);
    }

    // — bouquet (used both in-hand small and in-flight) —
    function wedDrawBouquet(x, y, inHand) {
        ctx.save();
        ctx.translate(x, y);
        var sc = inHand ? 0.7 : 1;
        ctx.scale(sc, sc);
        if (!inHand) ctx.rotate(Math.sin(wedTime * 12) * 0.4); // tumble in air
        // stems
        ctx.strokeStyle = "#2E7D32"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 12); ctx.stroke();
        // ribbon
        ctx.fillStyle = "#F8BBD0";
        ctx.fillRect(-3, 8, 6, 4);
        // flower cluster
        var cols = ["#FF4081", "#FFD54F", "#FF80AB", "#BA68C8", "#FFFFFF"];
        var pos = [[-5, -3], [5, -3], [0, -7], [-3, 1], [3, 1], [0, -1]];
        for (var i = 0; i < pos.length; i++) {
            ctx.fillStyle = cols[i % cols.length];
            ctx.beginPath(); ctx.arc(pos[i][0], pos[i][1], 3.4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFF59D";
            ctx.beginPath(); ctx.arc(pos[i][0], pos[i][1], 1.1, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    // — Lulu as a guest at the front-left, kvelling —
    function wedDrawLulu() {
        var lx = wedLuluX(), ly = wedLuluY();
        // mood: dance during simcha, cry during the emotional chuppah beat
        var mood = "run";
        if (wedPhase === 2) mood = "dance";
        else if (wedPhase === 1 && wedGlassStomped) mood = "dance";
        else if (wedPhase === 0 && wedAisleProg > 0.5) mood = "cry";
        // little jump/cheer when the glass breaks or bouquet caught
        var hop = 0;
        if (wedMazelT > 1.6) hop = Math.abs(Math.sin(wedTime * 16)) * 8;
        if (wedPhase === 2 && wedBouquetCaught === true) hop = Math.abs(Math.sin(wedTime * 14)) * 7;
        drawLuluTopDown(lx, ly - hop, wedTime, mood);
        // a "guest" name tag so she reads as on-the-sidelines
        if (wedPhase === 0) {
            drawText("(that's me!)", lx, ly + 26, "bold 9px Arial", "#7A1066", "#FFF", 2);
        }
    }
