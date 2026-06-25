    // ════════════════════════════════════════════════════════════
    //  LULU ON FOOT — INTERIOR: "THE THIRSTY SCHOLAR" (neighborhood bar)
    //  The richest, most-alive interior. Lulu wanders into a lively bar:
    //  a long counter with a wisecracking bartender, neon signs, a wall of
    //  bottles, a flickering disco dance floor, bar stools, a TV, and a
    //  rogues' gallery of wobbly patrons (bartender, two drunks, a guy
    //  passed out on the bar, a hulking bouncer, a glowing jukebox).
    //  Walk Lulu left/right (drag or arrows); step up to a station to pop a
    //  randomized one-liner. Some give coins / a ⭐ with a floater + sound.
    //  All Jewish-family-humor PG flavor. LEAVE → exitFootInterior().
    //
    //  Defines ONLY: initBarsInterior / updateBarsInterior / drawBarsInterior
    //  plus bar-prefixed private helpers/vars. Calls shared globals only.
    // ════════════════════════════════════════════════════════════

    // ── Local state ──────────────────────────────────────────
    var barTime = 0;
    var barLulu = null;            // {x, walkTime, facing}
    var barDialogue = "";          // current speech-bubble text ("" = none)
    var barDialogueT = 0;          // remaining seconds the bubble shows
    var barDialogueX = W / 2;      // where the bubble points
    var barFlash = 0;              // brief neon pop on interaction
    var barDanceT = 0;             // Lulu's boogie timer (>0 = dancing)
    var barClinkT = 0;             // throttle for ambient bottle clinks
    var barLeaveBtn = { x: 0, y: 0, w: 0, h: 0 };
    var barStations = [];          // interaction hotspots along the counter
    var barUsed = {};              // one-time-reward flags per station id
    var barPatronWobble = 0;       // shared wobble phase for the crowd

    var BAR_FLOOR_Y = 0;           // y where the floor meets the back wall (set in init)

    // ── Funny line pools (8-15 each, PG, Jewish-family-humor flavor) ──
    var barBartenderLines = [
        "We don't serve drivers here.\nWhat'll it be, walker?",
        "Seltzer's on the house, mamaleh.\nYou look parched AND parked-out.",
        "A nice egg cream? No alcohol,\nyour mother would plotz.",
        "You want a pickle with that?\nWe got a whole barrel, take TWO.",
        "Last call was twenty years ago.\nI just like the company.",
        "Drink up, but slow — you've got\na long walk to Bubbe's yet.",
        "On the house. Tell your cousin\nI said the brisket was dry.",
        "Club soda, lime, and a side of\nunsolicited advice. Free of charge.",
        "You're too good for this place.\nSo is everybody. Here's a seltzer.",
        "I poured you a water. Hydrate.\nYou're no good to anyone fainted.",
        "Happy hour? Honey, every hour\nI see you is a happy hour.",
        "We're out of the good stuff,\nso I'm giving you the GREAT stuff.",
        "No tab, no tip, no trouble.\nJust drink your seltzer, bubbeleh.",
        "I'll cut you off after this — it's\nwater, but principles are principles."
    ];
    var barDrunkLines = [
        "You're like my ex... but PRETTIER!",
        "Marry me — I HAVE A CAR!\n(...it's my mom's. Still counts.)",
        "Are you an angel? 'Cause I just\nfell off this stool for you.",
        "I'd give you my number but I\nforgot it. And my name. And here.",
        "You, me, the early-bird special.\nWhaddya say, sweetheart?",
        "My therapist says I shouldn't\nflirt. My therapist is ME.",
        "Is it hot in here or did you\njust walk in? ...it's both.",
        "I love you. I love everyone.\nBut especially you. And that lamp.",
        "Wanna split an appetizer and\nmaybe the rest of our lives?",
        "I'm not drunk, I'm just very\nemotionally available right now.",
        "You had me at 'leave me alone.'\nThat's flirting, right?",
        "I once parallel parked PERFECTLY.\nOne time. Marry me anyway.",
        "Beautiful AND you walked here?\nLow maintenance! Mom would LOVE you.",
        "Hey... hey. Hey. ...I forgot.\nBut you're great. Hey."
    ];
    var barPassedOutLines = [
        "(snoring)  ...five more minutes,\nBubbe... the brisket can wait...",
        "(mumbling)  ...I told you the\nGPS was wrong... I TOLD you...",
        "Zzzz... no thank you, I'm full...\nokay one more knish... zzzz...",
        "(snore)  ...check, please...\nno wait, YOU pay... zzzz...",
        "...the Mets... they'll win it...\nany decade now... zzzz...",
        "Mmf... tell my wife the lawn\ncan mow ITSELF... zzzzz...",
        "(snoring)  ...I'm not asleep...\nI'm just resting my whole face...",
        "...one egg cream too many...\nworth it... totally worth it... zzz",
        "Zzz... put it on Murray's tab...\nMurray's good for it... zzz...",
        "(mumble)  ...I'll drive... I'm FINE\nto... drive... *thunk* ...zzz",
        "...is it Shabbos yet... wake me\nfor the candles... only then... zzz"
    ];
    var barBouncerLines = [
        "ID? ...nah, you got an honest\nface. Go on in, kid.",
        "No funny business. I've thrown\nout TOUGHER bubbes than you.",
        "You break it, you bought it.\nYou cry, I get the manager. Me.",
        "I look mean but I cry at\nweddings. Don't tell nobody.",
        "House rules: be nice, tip Sol,\nand NOBODY touches the jukebox volume.",
        "You need a ride later? ...no.\nI walk everywhere. Keeps me humble.",
        "Behave, and the seltzer flows.\nMisbehave, and... well, also seltzer.",
        "I've seen it all in this joint.\nTwice. On a Tuesday. Go in.",
        "You're cleared. Tell the bartender\nBig Schlomo says hi.",
        "Trouble? In MY bar? Over my\nvery large, very gentle body.",
        "Coat check's broke. Just hold\nyour coat. Builds character."
    ];
    var barJukeboxLines = [
        "BOOGIE TIME! Klezmer remix,\nbaby — shake what Bubbe gave ya!",
        "This song was number one at\nyour cousin's bar mitzvah. CLASSIC.",
        "♪ ...and that's why you ALWAYS\ncall your mother ♪  (it's a banger)",
        "Free play! Somebody jammed a\nbutton mitzvah token in there.",
        "Disco never died — it just moved\nto a bar in the old neighborhood.",
        "Hora breakdown incoming! Grab\na chair, we're lifting SOMEBODY.",
        "The good stuff: side A is\nFrank, side B is more Frank.",
        "Dance like nobody's filming —\nbecause Aunt Rivka definitely is.",
        "♪ ...she's got a brand new... NOTHING,\nher car's wrecked ♪ ...too soon?",
        "Cha-cha slide, but it's just\neveryone arguing about parking.",
        "Turn it UP! ...okay, Schlomo said\nturn it down. We compromise: medium."
    ];

    // ── Init (called once on enter) ──────────────────────────
    function initBarsInterior() {
        barTime = 0;
        barDialogue = ""; barDialogueT = 0; barDialogueX = W / 2;
        barFlash = 0; barDanceT = 0; barClinkT = 1.2; barPatronWobble = 0;
        barUsed = {};
        barLulu = { x: W / 2, walkTime: 0, facing: 1 };

        // Counter/back wall sits in the upper portion; Lulu walks the open
        // floor below it. Pad for the safe-area top.
        BAR_FLOOR_Y = SAFE_TOP + 250;

        // Interaction stations: x positions Lulu must walk near. Each has an
        // id, a label icon, the line pool, and reward behavior.
        barStations = [
            { id: "bouncer",  x: 44,       label: "🕴️", pool: barBouncerLines,  reward: null },
            { id: "jukebox",  x: 116,      label: "🎵", pool: barJukeboxLines,  reward: "dance" },
            { id: "drunkA",   x: 192,      label: "🥴", pool: barDrunkLines,    reward: null },
            { id: "passed",   x: 270,      label: "😴", pool: barPassedOutLines, reward: "keys" },
            { id: "drunkB",   x: 340,      label: "🥴", pool: barDrunkLines,    reward: "coins" },
            { id: "bartender",x: W - 56,   label: "🍸", pool: barBartenderLines, reward: "seltzer" }
        ];
        playClick();
        // welcoming little neon "blip" chord
        playTone(523, 0.10, "sine", 0.12, 784);
    }

    // ── A station got tapped/walked-into: speak + maybe reward ──
    function barTrigger(st) {
        barDialogue = randPick(st.pool);
        barDialogueT = 3.2;
        barDialogueX = clamp(st.x, 60, W - 60);
        barFlash = 1;
        barLulu.facing = st.x < barLulu.x ? -1 : 1;
        playClick();
        // bottle-clink / glass-tink accent
        playTone(rand(900, 1300), 0.06, "triangle", 0.14);

        if (st.reward === "dance") {
            // Boogie at the jukebox — a little dance animation + sparkles.
            barDanceT = 2.6;
            playTone(330, 0.12, "square", 0.10, 660);
            for (var d = 0; d < 14; d++) {
                particles.push({ x: barLulu.x + rand(-18, 18), y: BAR_FLOOR_Y + 70 + rand(-10, 10),
                    vx: rand(-50, 50), vy: rand(-80, -20), life: 0.7, maxLife: 0.7,
                    size: rand(3, 6), color: randPick(["#FF4081", "#40C4FF", "#FFD740", "#7C4DFF", "#69F0AE"]),
                    gravity: 120 });
            }
            return;
        }

        if (barUsed[st.id]) return;   // one-time rewards only fire once

        if (st.reward === "seltzer") {
            // Free seltzer from the bartender → a ⭐ AND a couple coins.
            barUsed[st.id] = true;
            footStars += 1;
            footCoinsRun += 3; runCoins += 3; save.totalCoins += 3; persistSave();
            spawnFloater(st.x, BAR_FLOOR_Y + 30, "🥤 FREE SELTZER ⭐", "#FFD700");
            playCoin();
            playTone(660, 0.10, "sine", 0.12, 990);
            for (var s = 0; s < 10; s++) {
                particles.push({ x: st.x + rand(-12, 12), y: BAR_FLOOR_Y + 20,
                    vx: rand(-40, 40), vy: rand(-90, -30), life: 0.8, maxLife: 0.8,
                    size: rand(2, 5), color: "#B3E5FC", gravity: 200 });
            }
        } else if (st.reward === "coins") {
            // Tipsy patron buys YOU a drink (badly). Small coin tip.
            barUsed[st.id] = true;
            var tip = randInt(4, 7);
            footCoinsRun += tip; runCoins += tip; save.totalCoins += tip; persistSave();
            spawnFloater(st.x, BAR_FLOOR_Y + 30, "+" + tip + " 🪙 \"my treat!\"", "#FFD54F");
            playCoin();
        } else if (st.reward === "keys") {
            // Passed-out guy "offers" his car keys in his sleep. Cruel joke —
            // they're a chip clip. Still funny; tiny pity coins, once.
            barUsed[st.id] = true;
            footCoinsRun += 2; runCoins += 2; save.totalCoins += 2; persistSave();
            spawnFloater(st.x, BAR_FLOOR_Y + 30, "🔑? ...it's a chip clip. +2", "#FFAB91");
            playWompWomp();
        }
    }

    // ── Update (per frame) ───────────────────────────────────
    function updateBarsInterior(dt) {
        barTime += dt;
        barPatronWobble += dt;
        if (barFlash > 0) barFlash = Math.max(0, barFlash - dt * 2.2);
        if (barDialogueT > 0) barDialogueT -= dt;
        if (barDanceT > 0) barDanceT -= dt;

        // Ambient bottle clinks / murmur — occasional soft tinks.
        barClinkT -= dt;
        if (barClinkT <= 0) {
            barClinkT = rand(2.2, 4.5);
            playTone(rand(700, 1100), 0.05, "sine", 0.05);
        }
        // Dance-floor sparkle ambiance while boogieing.
        if (barDanceT > 0 && Math.random() < dt * 16) {
            particles.push({ x: barLulu.x + rand(-16, 16), y: BAR_FLOOR_Y + 80,
                vx: rand(-30, 30), vy: rand(-60, -10), life: 0.6, maxLife: 0.6,
                size: rand(2, 4), color: randPick(["#FF4081", "#40C4FF", "#FFD740"]), gravity: 100 });
        }

        // ── Movement: drag/tap-to-walk or arrow keys ──
        var minX = 36, maxX = W - 36;
        var click = consumeClick();

        // LEAVE button first (top-priority hit)
        if (click && pointInRect(click.x, click.y, barLeaveBtn.x, barLeaveBtn.y, barLeaveBtn.w, barLeaveBtn.h)) {
            playClick();
            exitFootInterior();
            return;
        }

        // A tap on a station near the floor walks Lulu over AND triggers it
        // if she's close; otherwise it just sets a walk target. Holding a
        // finger (touchX) drags her directly.
        var walkTarget = null;
        if (touchX !== null) {
            walkTarget = clamp(touchX, minX, maxX);
        } else if (click) {
            // Did they tap a station hotspot?
            var hitSt = null;
            for (var i = 0; i < barStations.length; i++) {
                var st = barStations[i];
                if (pointInRect(click.x, click.y, st.x - 34, SAFE_TOP + 70, 68, BAR_FLOOR_Y + 90 - (SAFE_TOP + 70))) {
                    hitSt = st; break;
                }
            }
            if (hitSt) {
                walkTarget = clamp(hitSt.x, minX, maxX);
                barLulu.pending = hitSt;          // trigger on arrival
            } else {
                walkTarget = clamp(click.x, minX, maxX);
                barLulu.pending = null;
            }
        }

        // Keyboard steering overrides target with direct velocity.
        var kmv = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
        if (kmv !== 0) {
            barLulu.x = clamp(barLulu.x + kmv * 230 * dt, minX, maxX);
            barLulu.facing = kmv;
            barLulu.walkTime += dt * 2.4;
            barLulu.pending = null;
            walkTarget = null;
        } else if (walkTarget !== null || barLulu.target !== undefined && barLulu.target !== null) {
            if (walkTarget !== null) barLulu.target = walkTarget;
            var tgt = barLulu.target;
            var dx = tgt - barLulu.x;
            if (Math.abs(dx) > 3) {
                var dir = dx > 0 ? 1 : -1;
                barLulu.facing = dir;
                barLulu.x = clamp(barLulu.x + dir * 230 * dt, minX, maxX);
                barLulu.walkTime += dt * 2.4;
            } else {
                barLulu.x = tgt;
                barLulu.target = null;
                if (barLulu.pending) { barTrigger(barLulu.pending); barLulu.pending = null; }
            }
        }

        // Proximity trigger: walking NEAR a station (within 26px) and pausing
        // also pops its line — but throttle so it doesn't spam every frame.
        if (barDialogueT <= 0) {
            for (var j = 0; j < barStations.length; j++) {
                var s2 = barStations[j];
                if (Math.abs(barLulu.x - s2.x) < 24 && !barLulu.target) {
                    // only auto-trigger if she actually moved here this turn
                    if (barLulu._lastNear !== s2.id) {
                        barLulu._lastNear = s2.id;
                        barTrigger(s2);
                    }
                    break;
                }
            }
        }
        // clear the near-latch when she steps away from all stations
        var anyNear = false;
        for (var k = 0; k < barStations.length; k++) {
            if (Math.abs(barLulu.x - barStations[k].x) < 24) { anyNear = true; break; }
        }
        if (!anyNear) barLulu._lastNear = null;

        // Space/Enter near a station also triggers (keyboard players).
        if (consumeAction()) {
            var nearest = null, best = 99999;
            for (var m = 0; m < barStations.length; m++) {
                var d2 = Math.abs(barLulu.x - barStations[m].x);
                if (d2 < best) { best = d2; nearest = barStations[m]; }
            }
            if (nearest && best < 60) barTrigger(nearest);
        }
    }

    // ── Drawing helpers (bar-prefixed) ───────────────────────

    // Wall of glowing liquor bottles behind the counter.
    function barDrawBottles(x, y, w) {
        var cols = ["#FF7043", "#66BB6A", "#FFCA28", "#42A5F5", "#AB47BC", "#EF5350", "#26C6DA", "#FFA726"];
        var n = Math.floor(w / 16);
        for (var i = 0; i < n; i++) {
            var bx = x + 8 + i * 16;
            var col = cols[i % cols.length];
            var glow = 0.5 + 0.5 * Math.sin(barTime * 2 + i);
            ctx.save();
            ctx.globalAlpha = 0.35 + glow * 0.3;
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.arc(bx, y - 4, 7, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            // bottle body
            ctx.fillStyle = col;
            roundRect(bx - 4, y - 14, 8, 22, 3); ctx.fill();
            // neck + cap
            ctx.fillStyle = shadeColor(col, -50);
            roundRect(bx - 2, y - 22, 4, 9, 1); ctx.fill();
            ctx.fillStyle = "#FFF59D";
            roundRect(bx - 2, y - 24, 4, 3, 1); ctx.fill();
            // shine streak
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            roundRect(bx - 2, y - 12, 1.6, 16, 1); ctx.fill();
            ctx.restore();
        }
    }

    // A buzzing neon sign with a soft halo. Flickers occasionally.
    function barDrawNeon(x, y, text, color, size) {
        var flick = (Math.sin(barTime * 9 + x) > -0.9) ? 1 : 0.25;  // rare dropout
        ctx.save();
        ctx.globalAlpha = 0.28 * flick;
        ctx.fillStyle = color;
        var halfW = text.length * size * 0.32 + 14;
        ctx.beginPath(); ctx.ellipse(x, y, halfW, size * 0.9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // glowing tube text via layered strokes
        ctx.globalAlpha = flick;
        drawText(text, x, y, "bold " + size + "px 'Segoe UI', Arial, sans-serif", "#FFFFFF", color, 6);
        drawText(text, x, y, "bold " + size + "px 'Segoe UI', Arial, sans-serif", color, null, 0);
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // The jukebox: a glowing rounded cabinet that pulses with the "music".
    function barDrawJukebox(x, y) {
        ctx.save();
        ctx.translate(x, y);
        var pulse = 0.5 + 0.5 * Math.sin(barTime * 6);
        // glow halo
        ctx.globalAlpha = 0.25 + pulse * 0.25;
        var jg = ctx.createRadialGradient(0, -14, 4, 0, -14, 40);
        jg.addColorStop(0, "#FF4081"); jg.addColorStop(1, "rgba(255,64,129,0)");
        ctx.fillStyle = jg;
        ctx.beginPath(); ctx.arc(0, -14, 40, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // cabinet
        ctx.fillStyle = "#5D4037";
        roundRect(-18, -44, 36, 56, 8); ctx.fill();
        ctx.fillStyle = "#8D6E63";
        roundRect(-15, -41, 30, 50, 6); ctx.fill();
        // glowing arch top
        var arch = ctx.createLinearGradient(0, -41, 0, -20);
        arch.addColorStop(0, "#FFEB3B"); arch.addColorStop(0.5, "#FF4081"); arch.addColorStop(1, "#7C4DFF");
        ctx.fillStyle = arch;
        ctx.beginPath();
        ctx.moveTo(-13, -20); ctx.lineTo(-13, -34);
        ctx.arc(0, -34, 13, Math.PI, 0); ctx.lineTo(13, -20); ctx.closePath();
        ctx.fill();
        // bouncing equalizer bars
        for (var b = 0; b < 5; b++) {
            var bh = 4 + (0.5 + 0.5 * Math.sin(barTime * 8 + b * 1.3)) * 9;
            ctx.fillStyle = ["#FF5252", "#FFD740", "#69F0AE", "#40C4FF", "#E040FB"][b];
            roundRect(-11 + b * 5, -8 - bh, 3.4, bh, 1); ctx.fill();
        }
        // speaker grille
        ctx.fillStyle = "#3E2723";
        roundRect(-11, 2, 22, 7, 2); ctx.fill();
        ctx.restore();
    }

    // A wall-mounted TV showing a flickering "game" (it's always a tie).
    function barDrawTV(x, y) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "#212121";
        roundRect(-26, -16, 52, 32, 4); ctx.fill();
        // static-y screen
        ctx.fillStyle = "#1B5E20";
        roundRect(-22, -12, 44, 24, 2); ctx.fill();
        ctx.globalAlpha = 0.5;
        for (var s = 0; s < 6; s++) {
            ctx.fillStyle = (Math.sin(barTime * 20 + s) > 0) ? "#A5D6A7" : "#2E7D32";
            ctx.fillRect(-22, -12 + s * 4, 44, 2);
        }
        ctx.globalAlpha = 1;
        // little scoreboard
        drawText("4 : 4", 0, -2, "bold 9px Arial", "#FFEB3B", "#000", 2);
        ctx.restore();
    }

    // A bar stool (chunky cartoon).
    function barDrawStool(x, y) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath(); ctx.ellipse(0, 26, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#455A64";
        roundRect(-2, -6, 4, 30, 2); ctx.fill();
        ctx.fillStyle = "#37474F";
        roundRect(-9, 18, 18, 4, 2); ctx.fill();
        ctx.fillStyle = "#E53935";
        ctx.beginPath(); ctx.ellipse(0, -8, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#EF5350";
        ctx.beginPath(); ctx.ellipse(0, -9, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // The bartender: a friendly mustachioed fella polishing a glass.
    function barDrawBartender(x, y) {
        ctx.save();
        ctx.translate(x, y);
        var bob = Math.sin(barTime * 2) * 1.5;
        // apron body
        ctx.fillStyle = "#FFFFFF";
        roundRect(-12, -18 + bob, 24, 26, 6); ctx.fill();
        ctx.fillStyle = "#5D4037";
        roundRect(-12, 0 + bob, 24, 8, 3); ctx.fill();  // apron tie
        // arms (one polishes)
        ctx.fillStyle = "#FFFFFF";
        var poke = Math.sin(barTime * 5) * 3;
        roundRect(-16, -12 + bob, 6, 14, 3); ctx.fill();
        roundRect(10, -14 + bob + poke, 6, 14, 3); ctx.fill();
        // polishing glass in right hand
        ctx.fillStyle = "rgba(178,235,242,0.8)";
        roundRect(13, -20 + bob + poke, 6, 8, 2); ctx.fill();
        // head
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(0, -28 + bob, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin;
        ctx.beginPath(); ctx.arc(0, -28 + bob, 7.6, 0, Math.PI * 2); ctx.fill();
        // bald top + side hair
        ctx.fillStyle = "#9E9E9E";
        ctx.beginPath(); ctx.arc(-6, -28 + bob, 2.4, 0, Math.PI * 2); ctx.arc(6, -28 + bob, 2.4, 0, Math.PI * 2); ctx.fill();
        // eyes
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(-2.6, -29 + bob, 1.3, 0, Math.PI * 2); ctx.arc(2.6, -29 + bob, 1.3, 0, Math.PI * 2); ctx.fill();
        // big mustache
        ctx.fillStyle = "#3E2723";
        roundRect(-5, -24 + bob, 10, 3.4, 1.6); ctx.fill();
        ctx.restore();
    }

    // The bouncer: a huge gentle slab in sunglasses by the door.
    function barDrawBouncer(x, y) {
        ctx.save();
        ctx.translate(x, y);
        var bob = Math.sin(barTime * 1.4) * 1;
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath(); ctx.ellipse(0, 30, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
        // legs
        ctx.fillStyle = "#212121";
        roundRect(-9, 8, 8, 22, 3); ctx.fill();
        roundRect(1, 8, 8, 22, 3); ctx.fill();
        // huge torso (black tee)
        ctx.fillStyle = "#263238";
        roundRect(-16, -22 + bob, 32, 34, 8); ctx.fill();
        // arms crossed
        ctx.fillStyle = C.skin;
        roundRect(-18, -6 + bob, 36, 8, 4); ctx.fill();
        ctx.fillStyle = "#1A1A1A";
        roundRect(-6, -7 + bob, 12, 10, 3); ctx.fill();  // crossed-hands shadow
        // head
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(0, -32 + bob, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin;
        ctx.beginPath(); ctx.arc(0, -32 + bob, 9.4, 0, Math.PI * 2); ctx.fill();
        // sunglasses
        ctx.fillStyle = "#000";
        roundRect(-8, -35 + bob, 16, 5, 2); ctx.fill();
        // tiny earpiece
        ctx.strokeStyle = "#616161"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(9, -32 + bob, 1.8, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }

    // Guy passed out face-down on the bar counter, little "Zzz" puffs.
    function barDrawPassedOut(x, y) {
        ctx.save();
        ctx.translate(x, y);
        // slumped body lying on counter
        ctx.fillStyle = "#6D4C41";
        roundRect(-14, -8, 28, 12, 5); ctx.fill();   // back
        ctx.fillStyle = C.skin;
        ctx.beginPath(); ctx.arc(-16, -2, 7, 0, Math.PI * 2); ctx.fill();  // head down
        // bald spot
        ctx.fillStyle = "#BCAAA4";
        ctx.beginPath(); ctx.arc(-16, -4, 3, 0, Math.PI * 2); ctx.fill();
        // spilled glass
        ctx.fillStyle = "rgba(178,235,242,0.85)";
        roundRect(8, -2, 6, 7, 2); ctx.fill();
        // Zzz
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(barTime * 3);
        drawText("z", -22, -14 + Math.sin(barTime * 3) * 2, "bold 10px Arial", "#FFF", "#000", 2);
        drawText("Z", -26, -22 + Math.sin(barTime * 3 + 1) * 2, "bold 13px Arial", "#FFF", "#000", 2);
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // Disco floor tiles flickering with color (dance area).
    function barDrawDanceFloor(x0, y0, w, h) {
        var tile = 24, cols = ["#FF4081", "#40C4FF", "#FFD740", "#7C4DFF", "#69F0AE", "#FF6E40"];
        ctx.save();
        for (var ry = 0; ry < h; ry += tile) {
            for (var rx = 0; rx < w; rx += tile) {
                var idx = Math.floor((rx / tile + ry / tile + barTime * 3)) % cols.length;
                ctx.globalAlpha = 0.45 + 0.4 * Math.sin(barTime * 5 + rx + ry);
                ctx.fillStyle = cols[(idx + cols.length) % cols.length];
                ctx.fillRect(x0 + rx, y0 + ry, tile - 2, tile - 2);
            }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // Spinning disco-ball light cones sweeping the room.
    function barDrawDiscoLights() {
        ctx.save();
        var cx = W / 2, cy = SAFE_TOP + 56;
        // hanging ball
        ctx.fillStyle = "#B0BEC5";
        ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
        for (var f = 0; f < 8; f++) {
            ctx.fillStyle = (Math.sin(barTime * 10 + f) > 0) ? "#FFFFFF" : "#90A4AE";
            ctx.fillRect(cx - 9 + (f % 4) * 5, cy - 9 + Math.floor(f / 4) * 9, 3, 3);
        }
        // sweeping light cones
        var beams = ["rgba(255,64,129,0.10)", "rgba(64,196,255,0.10)", "rgba(255,215,64,0.10)"];
        for (var c = 0; c < 3; c++) {
            var ang = barTime * (0.6 + c * 0.25) + c * 2.1;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(Math.sin(ang) * 0.9 + (c - 1) * 0.5);
            ctx.fillStyle = beams[c];
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-60, 320);
            ctx.lineTo(60, 320);
            ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    // ── Draw (per frame) ─────────────────────────────────────
    function drawBarsInterior() {
        var topY = SAFE_TOP;

        // Back wall — moody dark plum gradient.
        var wall = ctx.createLinearGradient(0, topY, 0, BAR_FLOOR_Y);
        wall.addColorStop(0, "#2A1A2E");
        wall.addColorStop(1, "#3E2236");
        ctx.fillStyle = wall;
        ctx.fillRect(0, 0, W, BAR_FLOOR_Y);

        // Floor — warm dark wood planks.
        var floor = ctx.createLinearGradient(0, BAR_FLOOR_Y, 0, H);
        floor.addColorStop(0, "#4E342E");
        floor.addColorStop(1, "#3E2723");
        ctx.fillStyle = floor;
        ctx.fillRect(0, BAR_FLOOR_Y, W, H - BAR_FLOOR_Y);
        ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 2;
        for (var px = 24; px < W; px += 48) {
            ctx.beginPath(); ctx.moveTo(px, BAR_FLOOR_Y); ctx.lineTo(px, H); ctx.stroke();
        }

        // Sweeping disco lighting over everything (subtle).
        barDrawDiscoLights();

        // Dance floor patch (left-center), under the jukebox area.
        barDrawDanceFloor(78, BAR_FLOOR_Y + 36, 120, 96);

        // Back-bar shelf with the glowing bottle wall (right portion).
        var shelfY = topY + 150;
        ctx.fillStyle = "#3E2723";
        ctx.fillRect(W - 230, shelfY - 30, 230, 6);
        barDrawBottles(W - 226, shelfY, 222);
        ctx.fillStyle = "#3E2723";
        ctx.fillRect(W - 230, shelfY + 6, 230, 5);

        // Neon signs.
        barDrawNeon(W / 2, topY + 34, "THE THIRSTY SCHOLAR", "#FF4081", 17);
        barDrawNeon(86, topY + 96, "L'CHAIM!", "#40C4FF", 16);
        barDrawNeon(W - 70, topY + 150 - 70, "OPEN", "#69F0AE", 18);

        // Wall TV (upper left-ish).
        barDrawTV(180, topY + 92);

        // The long bar counter (front edge, where stools line up).
        var counterY = BAR_FLOOR_Y - 6;
        ctx.fillStyle = "#5D4037";
        roundRect(W - 250, counterY - 4, 250, 30, 6); ctx.fill();
        ctx.fillStyle = "#795548";
        roundRect(W - 248, counterY - 2, 246, 24, 5); ctx.fill();
        // glossy top edge
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        roundRect(W - 248, counterY - 2, 246, 5, 3); ctx.fill();

        // Bartender behind the counter.
        barDrawBartender(W - 56, BAR_FLOOR_Y - 28);

        // Passed-out guy on the counter.
        barDrawPassedOut(270, counterY - 2);

        // Bar stools along the counter.
        barDrawStool(W - 110, BAR_FLOOR_Y + 28);
        barDrawStool(W - 160, BAR_FLOOR_Y + 28);

        // Jukebox (left, by the dance floor).
        barDrawJukebox(116, BAR_FLOOR_Y + 30);

        // Bouncer by the door (far left).
        barDrawBouncer(44, BAR_FLOOR_Y + 6);

        // Two wobbly drunk patrons (reuse drawPedestrian drunk=true).
        drawPedestrian(192, BAR_FLOOR_Y + 26, barPatronWobble + 0.4, 1, false, true);
        drawPedestrian(340, BAR_FLOOR_Y + 26, barPatronWobble + 1.7, 2, false, true);

        // A glowing exit door (far right of the floor) for flavor.
        var doorX = W - 24;
        ctx.save();
        ctx.fillStyle = "#311B92";
        roundRect(doorX - 22, BAR_FLOOR_Y - 40, 44, 96, 6); ctx.fill();
        ctx.fillStyle = "rgba(105,240,174,0.18)";
        roundRect(doorX - 22, BAR_FLOOR_Y - 40, 44, 12, 4); ctx.fill();
        drawText("EXIT", doorX, BAR_FLOOR_Y - 34, "bold 10px Arial", "#69F0AE", "#000", 2);
        ctx.restore();

        // ── Lulu on the floor (walkable / dancing) ──
        var luluY = BAR_FLOOR_Y + 60;
        ctx.save();
        if (barDanceT > 0) {
            // Boogie: bouncy hop + spin sway.
            var hop = Math.abs(Math.sin(barTime * 12)) * 8;
            ctx.translate(barLulu.x, luluY - hop);
            ctx.rotate(Math.sin(barTime * 10) * 0.18);
            ctx.scale(barLulu.facing, 1);
            drawLuluTopDown(0, 0, barTime * 2.2, "run");
        } else {
            ctx.translate(barLulu.x, luluY);
            ctx.scale(barLulu.facing, 1);
            drawLuluTopDown(0, 0, barLulu.walkTime, "run");
        }
        ctx.restore();

        // Neon "pop" flash on interaction (full-screen tint).
        if (barFlash > 0) {
            ctx.save();
            ctx.globalAlpha = barFlash * 0.18;
            ctx.fillStyle = "#FF4081";
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // Active speech bubble.
        if (barDialogueT > 0 && barDialogue) {
            drawSpeechBubble(barDialogueX, BAR_FLOOR_Y + 6, barDialogue, barTime);
        }

        // Subtle "interactables glow" hint dots above each station.
        for (var i = 0; i < barStations.length; i++) {
            var st = barStations[i];
            var pulse = 0.4 + 0.4 * Math.sin(barTime * 4 + i);
            ctx.save();
            ctx.globalAlpha = pulse;
            drawText(st.label, st.x, BAR_FLOOR_Y - 56, "16px Arial", "#FFFFFF", "#000", 2);
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // Title banner ribbon.
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        roundRect(W / 2 - 150, topY + 50, 300, 22, 8); ctx.fill();
        drawText("🍸 THE THIRSTY SCHOLAR — BAR", W / 2, topY + 61, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFD740", "#000", 3);
        ctx.restore();

        // Touch hint.
        if (isTouchDevice) {
            drawText("👆 Tap a face to chat · drag Lulu to walk", W / 2, H - 70, "bold 12px Arial", "#FFFFFF", "#000", 3);
        } else {
            drawText("◀ ▶ walk · SPACE to chat", W / 2, H - 70, "bold 12px Arial", "#FFFFFF", "#000", 3);
        }

        // LEAVE button.
        var bw = 150, bh = 46;
        barLeaveBtn = { x: W / 2 - bw / 2, y: H - 56, w: bw, h: bh };
        drawButton(barLeaveBtn.x, barLeaveBtn.y, bw, bh, "🚪 LEAVE", { bg: "#EF5350", bgDark: "#B71C1C", id: "barLeave" });
    }
