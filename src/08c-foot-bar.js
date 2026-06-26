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
    //
    //  Performance contract: wall/floor/back-bar gradients are cached on
    //  resize; bottle/stool/light/plank/mote layout is precomputed in init;
    //  ambient haze particles are capped; no per-frame Math.random for the
    //  static glints (each gets a fixed phase seed).
    // ════════════════════════════════════════════════════════════

    // ── Local state ──────────────────────────────────────────
    var barTime = 0;
    var barLulu = null;            // {x, walkTime, facing}
    var barDialogue = "";          // current speech-bubble text ("" = none)
    var barDialogueT = 0;          // remaining seconds the bubble shows
    var barDialogueX = W / 2;      // where the bubble points
    var barFlash = 0;              // brief neon pop on interaction
    var barFlashColor = "#FF4081"; // tint color of the last neon pop
    var barDanceT = 0;             // Lulu's boogie timer (>0 = dancing)
    var barClinkT = 0;             // throttle for ambient bottle clinks
    var barLeaveBtn = { x: 0, y: 0, w: 0, h: 0 };
    var barStations = [];          // interaction hotspots along the counter
    var barUsed = {};              // one-time-reward flags per station id
    var barPatronWobble = 0;       // shared wobble phase for the crowd
    var barHazeT = 0;              // throttle for ambient haze motes
    var barTvChannel = 0;          // current TV "channel" index
    var barTvT = 0;                // seconds until the TV flips channel
    var barEventT = 0;             // seconds until the next micro-event
    var barToastT = 0;             // >0 while a "L'CHAIM!" toast ripples
    var barStumbleT = 0;          // >0 while a patron is sliding off a stool
    var barStumbleX = 0;           // x of the stumbling patron
    var barClinkPartnerT = 0;      // >0 while a patron raises a glass to clink

    var BAR_FLOOR_Y = 0;           // y where the floor meets the back wall (set in init)

    // ── Cached gradients / precomputed layout (built on resize) ──
    var barW = 0, barH = 0;        // dims the caches were built for
    var barWallGrad = null;        // back-wall plum gradient
    var barFloorGrad = null;       // floor wood gradient
    var barBackBarGrad = null;     // back-bar recess depth gradient
    var barGlowGrad = null;        // warm overhead pendant glow
    var barBottles = [];           // {bx, col, capCol, neckCol, seed}
    var barStools = [];            // {x, y}
    var barPlanks = [];            // x of each floor plank seam
    var barMotes = [];             // drifting dust/smoke motes {x,y,r,spd,seed,col}
    var barBeams = [];             // disco beam descriptors {col, spd, ph, off}
    var barBackGlasses = [];       // hanging stemware {x, seed}

    // module-level scratch (avoid per-frame allocation)
    var barTvChannels = null;      // built in init

    // ── Funny line pools (PG, Jewish-family-humor flavor) ──
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
        "I'll cut you off after this — it's\nwater, but principles are principles.",
        "I been polishing this same glass\nsince Tuesday. It's a meditation.",
        "You hear about Murray? No? Good.\nSit. I'll tell you EVERYTHING.",
        "Top shelf is just for show. The\nreal good stuff's under the bar.",
        "Two olives or three? In this\neconomy I'm giving you FOUR.",
        "I knew your grandmother. Tough\nlady. Tipped in advice. Sit down.",
        "Cranberry, soda, splash of lime.\nWe call it 'the designated driver.'"
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
        "Hey... hey. Hey. ...I forgot.\nBut you're great. Hey.",
        "I'm a CATCH. I floss. Sometimes.\nWeekly. Monthly. ...I own floss.",
        "Are you a parking spot? 'Cause\nI been circling you all night.",
        "I'd walk you home but the room's\nbeen walking ME for an hour.",
        "Roses are red, this seltzer's\nflat, will you marry... what was I—",
        "I have prospects! A cousin in\nflooring! He owes me twenty bucks!",
        "Your eyes are like two olives.\nI mean that as the highest praise."
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
        "...is it Shabbos yet... wake me\nfor the candles... only then... zzz",
        "(snore)  ...refinance the... the...\nthe whole... zzz... ask my broker...",
        "Mmf... the WiFi password is\n'password'... don't tell... zzzz...",
        "...just resting my eyes... and my\nface... and my entire... zzz..."
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
        "Coat check's broke. Just hold\nyour coat. Builds character.",
        "I do the door AND the books.\nTax season I'm a TEDDY bear.",
        "You look like you walk safe.\nI respect that. Go on, sweetheart.",
        "Last guy who started something?\nI made him apologize to his MOTHER."
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
        "Turn it UP! ...okay, Schlomo said\nturn it down. We compromise: medium.",
        "B-12: the slow one. B-13:\nALSO the slow one. We don't judge.",
        "It only plays one song but\nit's the GOOD one. Press it again."
    ];
    // NEW interaction: clink glasses with a patron (toast)
    var barClinkLines = [
        "L'CHAIM! To you, to me,\nto Bubbe's brisket! 🥂",
        "To health! And to NEVER\nparking downtown again!",
        "Mazel! ...what're we toasting?\nDoesn't matter. MAZEL!",
        "To absent friends, present\nseltzer, and YOUR good face!",
        "Drink! ...it's water, but the\nSPIRIT is one hundred proof!",
        "To the chef! To the bartender!\nTo whoever invented the PICKLE!"
    ];

    // ── Init (called once on enter) ──────────────────────────
    function initBarsInterior() {
        barTime = 0;
        barDialogue = ""; barDialogueT = 0; barDialogueX = W / 2;
        barFlash = 0; barFlashColor = "#FF4081";
        barDanceT = 0; barClinkT = 1.2; barPatronWobble = 0;
        barHazeT = 0;
        barTvChannel = 0; barTvT = 2.4;
        barEventT = rand(5, 9);
        barToastT = 0; barStumbleT = 0; barStumbleX = 0; barClinkPartnerT = 0;
        barUsed = {};
        barLulu = { x: W / 2, walkTime: 0, facing: 1 };

        // Counter/back wall sits in the upper portion; Lulu walks the open
        // floor below it. Pad for the safe-area top.
        BAR_FLOOR_Y = SAFE_TOP + 250;

        // TV "channels" — each is {label, fg, bg}. Cycled by the dynamic TV.
        barTvChannels = [
            { label: "4 : 4", fg: "#FFEB3B", bg: "#1B5E20", scan: "#A5D6A7", scanDark: "#2E7D32" }, // ballgame
            { label: "♥ LIVE", fg: "#FF80AB", bg: "#4A148C", scan: "#CE93D8", scanDark: "#6A1B9A" }, // soap
            { label: "NEWS", fg: "#FFFFFF", bg: "#0D47A1", scan: "#90CAF9", scanDark: "#1565C0" },   // news
            { label: "$$$", fg: "#69F0AE", bg: "#1B5E20", scan: "#A5D6A7", scanDark: "#2E7D32" },    // weather/stocks
            { label: "WX 72°", fg: "#FFD740", bg: "#37474F", scan: "#B0BEC5", scanDark: "#546E7A" }
        ];

        // Interaction stations: x positions Lulu must walk near. Each has an
        // id, a label icon, the line pool, and reward behavior.
        barStations = [
            { id: "bouncer",  x: 44,       label: "🕴️", pool: barBouncerLines,  reward: null },
            { id: "jukebox",  x: 116,      label: "🎵", pool: barJukeboxLines,  reward: "dance" },
            { id: "drunkA",   x: 192,      label: "🥴", pool: barDrunkLines,    reward: null },
            { id: "passed",   x: 270,      label: "😴", pool: barPassedOutLines, reward: "keys" },
            { id: "drunkB",   x: 340,      label: "🥂", pool: barDrunkLines,    reward: "clink" },
            { id: "bartender",x: W - 56,   label: "🍸", pool: barBartenderLines, reward: "seltzer" }
        ];

        barBuildCaches();

        playClick();
        // welcoming little neon "blip" chord
        playTone(523, 0.10, "sine", 0.12, 784);
    }

    // ── Build cached gradients + precomputed static layout ────
    //  Re-run whenever the canvas size changes so caches stay valid.
    function barBuildCaches() {
        barW = W; barH = H;
        var topY = SAFE_TOP;

        // Back-wall plum gradient.
        barWallGrad = ctx.createLinearGradient(0, topY, 0, BAR_FLOOR_Y);
        barWallGrad.addColorStop(0, "#241327");
        barWallGrad.addColorStop(0.55, "#311A33");
        barWallGrad.addColorStop(1, "#3E2236");

        // Floor wood gradient.
        barFloorGrad = ctx.createLinearGradient(0, BAR_FLOOR_Y, 0, H);
        barFloorGrad.addColorStop(0, "#5A3A30");
        barFloorGrad.addColorStop(0.5, "#4E342E");
        barFloorGrad.addColorStop(1, "#3A241C");

        // Back-bar recess — a darker inset behind the bottle wall for depth.
        var shelfY = topY + 150;
        barBackBarGrad = ctx.createLinearGradient(0, shelfY - 64, 0, shelfY + 14);
        barBackBarGrad.addColorStop(0, "#1A0E1C");
        barBackBarGrad.addColorStop(1, "#2C1726");

        // Warm overhead pendant glow (radial, centered above the counter).
        barGlowGrad = ctx.createRadialGradient(W - 120, topY + 40, 8, W - 120, topY + 40, 230);
        barGlowGrad.addColorStop(0, "rgba(255,196,120,0.30)");
        barGlowGrad.addColorStop(0.5, "rgba(255,170,90,0.10)");
        barGlowGrad.addColorStop(1, "rgba(255,170,90,0)");

        // Bottle wall — precompute each bottle's x, color, derived colors & seed.
        var cols = ["#FF7043", "#66BB6A", "#FFCA28", "#42A5F5", "#AB47BC", "#EF5350", "#26C6DA", "#FFA726"];
        barBottles.length = 0;
        var shelfX = W - 226, shelfW = 222;
        var n = Math.floor(shelfW / 16);
        for (var i = 0; i < n; i++) {
            var col = cols[i % cols.length];
            barBottles.push({
                bx: shelfX + 8 + i * 16,
                col: col,
                neckCol: shadeColor(col, -50),
                seed: i * 1.37,           // fixed phase for the glow shimmer
                h: 18 + (i % 3) * 4       // slight height variety
            });
        }

        // Hanging stemware row (under the top shelf) — fixed positions/seeds.
        barBackGlasses.length = 0;
        for (var g = 0; g < 10; g++) {
            barBackGlasses.push({ x: shelfX + 12 + g * 22, seed: g * 0.9 });
        }

        // Stools — fixed positions.
        barStools.length = 0;
        barStools.push({ x: W - 110, y: BAR_FLOOR_Y + 28 });
        barStools.push({ x: W - 160, y: BAR_FLOOR_Y + 28 });
        barStools.push({ x: W - 210, y: BAR_FLOOR_Y + 28 });

        // Floor plank seams.
        barPlanks.length = 0;
        for (var px = 24; px < W; px += 48) barPlanks.push(px);

        // Disco beam descriptors (color, speed, phase, lateral offset).
        barBeams = [
            { col: "rgba(255,64,129,0.10)", spd: 0.60, ph: 0.0, off: -0.5 },
            { col: "rgba(64,196,255,0.10)", spd: 0.85, ph: 2.1, off: 0.0 },
            { col: "rgba(255,215,64,0.10)", spd: 1.10, ph: 4.2, off: 0.5 }
        ];

        // Drifting ambient motes (dust/smoke/disco haze) — capped & seeded.
        barMotes.length = 0;
        var moteCols = ["rgba(255,213,128,0.10)", "rgba(255,255,255,0.07)", "rgba(206,147,216,0.08)"];
        for (var m = 0; m < 22; m++) {
            barMotes.push({
                x: rand(0, W),
                y: rand(topY + 20, BAR_FLOOR_Y + 80),
                r: rand(6, 18),
                spd: rand(4, 12),
                seed: rand(0, Math.PI * 2),
                col: moteCols[m % moteCols.length]
            });
        }
    }

    // ── A station got tapped/walked-into: speak + maybe reward ──
    function barTrigger(st) {
        barDialogue = randPick(st.pool);
        barDialogueT = 3.2;
        barDialogueX = clamp(st.x, 60, W - 60);
        barFlash = 1; barFlashColor = "#FF4081";
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

        if (st.reward === "clink") {
            // NEW: clink glasses with the tipsy patron — a toast, raised glass,
            // sparkle, and a small coin tip the first time ("my round!").
            barClinkPartnerT = 1.4;
            barFlashColor = "#FFD740";
            barDialogue = randPick(barClinkLines);
            barDialogueT = 3.2;
            playTone(rand(1100, 1500), 0.07, "triangle", 0.16);
            playTone(1320, 0.10, "sine", 0.10, 1600);
            for (var cs = 0; cs < 8; cs++) {
                particles.push({ x: st.x + rand(-10, 10), y: BAR_FLOOR_Y - 4,
                    vx: rand(-30, 30), vy: rand(-70, -20), life: 0.7, maxLife: 0.7,
                    size: rand(2, 4), color: "#FFE082", gravity: 140 });
            }
            if (!barUsed[st.id]) {
                barUsed[st.id] = true;
                var t2 = randInt(3, 6);
                footCoinsRun += t2; runCoins += t2; save.totalCoins += t2; persistSave();
                spawnFloater(st.x, BAR_FLOOR_Y + 30, "+" + t2 + " 🪙 \"my round!\"", "#FFD54F");
                playCoin();
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

    // ── A spontaneous room-wide "L'CHAIM!" toast micro-event ──
    function barDoToast() {
        barToastT = 1.8;
        barFlash = 0.8; barFlashColor = "#FFD740";
        playTone(523, 0.10, "triangle", 0.12, 784);
        playTone(659, 0.14, "sine", 0.10, 988);
        for (var i = 0; i < 16; i++) {
            particles.push({ x: rand(40, W - 40), y: BAR_FLOOR_Y + rand(-20, 10),
                vx: rand(-40, 40), vy: rand(-100, -30), life: 0.9, maxLife: 0.9,
                size: rand(2, 5), color: randPick(["#FFE082", "#FFD740", "#FFF59D"]), gravity: 160 });
        }
    }

    // ── Update (per frame) ───────────────────────────────────
    function updateBarsInterior(dt) {
        // Rebuild caches if the canvas was resized.
        if (barW !== W || barH !== H) barBuildCaches();

        barTime += dt;
        barPatronWobble += dt;
        if (barFlash > 0) barFlash = Math.max(0, barFlash - dt * 2.2);
        if (barDialogueT > 0) barDialogueT -= dt;
        if (barDanceT > 0) barDanceT -= dt;
        if (barToastT > 0) barToastT -= dt;
        if (barClinkPartnerT > 0) barClinkPartnerT -= dt;

        // TV channel cycling (dynamic content).
        barTvT -= dt;
        if (barTvT <= 0) {
            barTvT = rand(3.5, 6.5);
            barTvChannel = (barTvChannel + 1) % barTvChannels.length;
        }

        // Patron stumble micro-event timer (a guy sliding off a stool).
        if (barStumbleT > 0) barStumbleT -= dt;

        // Periodic MICRO-EVENTS — toast ripple OR a patron sliding off a stool.
        barEventT -= dt;
        if (barEventT <= 0) {
            barEventT = rand(7, 13);
            if (Math.random() < 0.5) {
                barDoToast();
            } else {
                // stumble: pick a stool and slide its "occupant" off briefly
                barStumbleT = 1.3;
                barStumbleX = barStools[randInt(0, barStools.length - 1)].x;
                playTone(rand(180, 260), 0.14, "sawtooth", 0.08, 90);
                playWompWomp();
                for (var sp = 0; sp < 8; sp++) {
                    particles.push({ x: barStumbleX + rand(-8, 8), y: BAR_FLOOR_Y + 40,
                        vx: rand(-50, 50), vy: rand(-40, -10), life: 0.6, maxLife: 0.6,
                        size: rand(2, 4), color: "#BCAAA4", gravity: 200 });
                }
            }
        }

        // Ambient bottle clinks / murmur — occasional soft tinks.
        barClinkT -= dt;
        if (barClinkT <= 0) {
            barClinkT = rand(2.2, 4.5);
            playTone(rand(700, 1100), 0.05, "sine", 0.05);
        }

        // Ambient haze motes — capped: at most ~3 puffs per 0.12s near the
        // dance floor / pendant light. Drifting motes themselves are static
        // props (drawn directly), these are the soft rising disco/smoke wisps.
        barHazeT -= dt;
        if (barHazeT <= 0) {
            barHazeT = 0.12;
            for (var hp = 0; hp < 2; hp++) {
                particles.push({ x: rand(70, 210), y: BAR_FLOOR_Y + rand(40, 120),
                    vx: rand(-8, 8), vy: rand(-22, -10), life: rand(1.4, 2.2), maxLife: 2.2,
                    size: rand(8, 16), color: "rgba(206,147,216,0.05)", gravity: -4 });
            }
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

    // Wall of glowing liquor bottles behind the counter (precomputed layout).
    function barDrawBottles(y) {
        for (var i = 0; i < barBottles.length; i++) {
            var b = barBottles[i];
            var bx = b.bx;
            var glow = 0.5 + 0.5 * Math.sin(barTime * 2 + b.seed);
            ctx.save();
            ctx.globalAlpha = 0.35 + glow * 0.3;
            ctx.fillStyle = b.col;
            ctx.beginPath(); ctx.arc(bx, y - 4, 7, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            // bottle body (slight height variety)
            ctx.fillStyle = b.col;
            roundRect(bx - 4, y - b.h + 4, 8, b.h, 3); ctx.fill();
            // neck + cap
            ctx.fillStyle = b.neckCol;
            roundRect(bx - 2, y - b.h - 4, 4, 9, 1); ctx.fill();
            ctx.fillStyle = "#FFF59D";
            roundRect(bx - 2, y - b.h - 6, 4, 3, 1); ctx.fill();
            // shine streak
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            roundRect(bx - 2, y - b.h + 6, 1.6, b.h - 8, 1); ctx.fill();
            ctx.restore();
        }
    }

    // Row of hanging stemware (inverted glasses) under the top shelf.
    function barDrawHangingGlasses(y) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.fillStyle = "rgba(178,235,242,0.14)";
        ctx.lineWidth = 1.2;
        for (var i = 0; i < barBackGlasses.length; i++) {
            var g = barBackGlasses[i];
            var sway = Math.sin(barTime * 1.6 + g.seed) * 1.2;
            var gx = g.x + sway;
            // bowl (inverted)
            ctx.beginPath();
            ctx.moveTo(gx - 6, y);
            ctx.quadraticCurveTo(gx, y + 11, gx + 6, y);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // stem
            ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y - 8); ctx.stroke();
            // tiny glint (fixed phase per glass — no per-frame random)
            ctx.globalAlpha = 0.4 + 0.4 * Math.sin(barTime * 3 + g.seed);
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.fillRect(gx - 3, y + 2, 1.4, 3);
            ctx.fillStyle = "rgba(178,235,242,0.14)";
            ctx.globalAlpha = 1;
        }
        ctx.restore();
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
        // floating ♪ notes pulsing out of the top
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(barTime * 3);
        drawText("♪", -20 + Math.sin(barTime * 2) * 3, -48 - (barTime * 8 % 14), "bold 12px Arial", "#FFD740", "#000", 2);
        drawText("♫", 18 + Math.cos(barTime * 2.3) * 3, -44 - ((barTime * 8 + 7) % 14), "bold 11px Arial", "#FF80AB", "#000", 2);
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // A wall-mounted TV cycling through "channels" (dynamic content).
    function barDrawTV(x, y) {
        var ch = barTvChannels[barTvChannel];
        ctx.save();
        ctx.translate(x, y);
        // bezel + tiny mount bracket
        ctx.fillStyle = "#0E0E0E";
        roundRect(-1.5, 16, 3, 6, 1); ctx.fill();
        ctx.fillStyle = "#212121";
        roundRect(-26, -16, 52, 32, 4); ctx.fill();
        // screen
        ctx.fillStyle = ch.bg;
        roundRect(-22, -12, 44, 24, 2); ctx.fill();
        // scanlines
        ctx.globalAlpha = 0.5;
        for (var s = 0; s < 6; s++) {
            ctx.fillStyle = (Math.sin(barTime * 20 + s) > 0) ? ch.scan : ch.scanDark;
            ctx.fillRect(-22, -12 + s * 4, 44, 2);
        }
        ctx.globalAlpha = 1;
        // label
        drawText(ch.label, 0, -2, "bold 9px Arial", ch.fg, "#000", 2);
        // screen glare
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(-22, -12); ctx.lineTo(-6, -12); ctx.lineTo(-18, 12); ctx.lineTo(-22, 12); ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
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

    // The bartender: a friendly mustachioed fella who polishes & pours on a loop.
    function barDrawBartender(x, y) {
        ctx.save();
        ctx.translate(x, y);
        var bob = Math.sin(barTime * 2) * 1.5;
        // loop: alternate between polishing a glass and pouring a drink
        var phase = (barTime * 0.35) % 2;          // 0..2 → first half polish, second half pour
        var pouring = phase >= 1;
        // apron body
        ctx.fillStyle = "#FFFFFF";
        roundRect(-12, -18 + bob, 24, 26, 6); ctx.fill();
        ctx.fillStyle = "#5D4037";
        roundRect(-12, 0 + bob, 24, 8, 3); ctx.fill();  // apron tie
        // left arm
        ctx.fillStyle = "#FFFFFF";
        roundRect(-16, -12 + bob, 6, 14, 3); ctx.fill();
        if (pouring) {
            // pour: right arm tilts out, a bottle pours a stream into a glass
            ctx.save();
            ctx.translate(13, -10 + bob);
            ctx.rotate(-0.5);
            ctx.fillStyle = "#FFFFFF";
            roundRect(-3, -2, 6, 14, 3); ctx.fill();       // arm
            ctx.fillStyle = "#66BB6A";
            roundRect(-3, -12, 6, 12, 2); ctx.fill();       // tilted bottle
            ctx.restore();
            // pouring stream + glass on the counter
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = "#B2EBF2";
            roundRect(15, -14 + bob, 1.6, 12 + Math.sin(barTime * 10) * 1.5, 1); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = "rgba(178,235,242,0.85)";
            roundRect(12, -2 + bob, 7, 9, 2); ctx.fill();
        } else {
            // polish: right arm wipes a glass back and forth
            var poke = Math.sin(barTime * 5) * 3;
            ctx.fillStyle = "#FFFFFF";
            roundRect(10, -14 + bob + poke, 6, 14, 3); ctx.fill();
            ctx.fillStyle = "rgba(178,235,242,0.8)";
            roundRect(13, -20 + bob + poke, 6, 8, 2); ctx.fill();
        }
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
        // tiny earpiece + occasional radio blink (fixed-phase, no random)
        ctx.strokeStyle = "#616161"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(9, -32 + bob, 1.8, 0, Math.PI * 2); ctx.stroke();
        if (Math.sin(barTime * 5) > 0.85) {
            ctx.fillStyle = "#FF5252";
            ctx.beginPath(); ctx.arc(9, -32 + bob, 1, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    // Guy passed out face-down on the bar counter, little "Zzz" puffs.
    function barDrawPassedOut(x, y) {
        ctx.save();
        ctx.translate(x, y);
        // gentle breathing rise/fall
        var breathe = Math.sin(barTime * 2.2) * 0.8;
        // slumped body lying on counter
        ctx.fillStyle = "#6D4C41";
        roundRect(-14, -8 + breathe, 28, 12, 5); ctx.fill();   // back
        ctx.fillStyle = C.skin;
        ctx.beginPath(); ctx.arc(-16, -2 + breathe, 7, 0, Math.PI * 2); ctx.fill();  // head down
        // bald spot
        ctx.fillStyle = "#BCAAA4";
        ctx.beginPath(); ctx.arc(-16, -4 + breathe, 3, 0, Math.PI * 2); ctx.fill();
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

    // Spinning disco-ball light cones sweeping the room (uses cached beams).
    function barDrawDiscoLights() {
        ctx.save();
        var cx = W / 2, cy = SAFE_TOP + 56;
        // hanging ball + cord
        ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx, SAFE_TOP); ctx.lineTo(cx, cy - 10); ctx.stroke();
        ctx.fillStyle = "#B0BEC5";
        ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
        for (var f = 0; f < 8; f++) {
            ctx.fillStyle = (Math.sin(barTime * 10 + f) > 0) ? "#FFFFFF" : "#90A4AE";
            ctx.fillRect(cx - 9 + (f % 4) * 5, cy - 9 + Math.floor(f / 4) * 9, 3, 3);
        }
        // sweeping light cones (precomputed beam descriptors)
        for (var c = 0; c < barBeams.length; c++) {
            var bm = barBeams[c];
            var ang = barTime * bm.spd + bm.ph;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(Math.sin(ang) * 0.9 + bm.off);
            ctx.fillStyle = bm.col;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-60, 320);
            ctx.lineTo(60, 320);
            ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    // Drifting ambient haze motes (precomputed; cheap to animate).
    function barDrawMotes() {
        ctx.save();
        for (var i = 0; i < barMotes.length; i++) {
            var mo = barMotes[i];
            // slow drift up-and-sideways, wrapping at the top of the floor
            var dy = (barTime * mo.spd) % (BAR_FLOOR_Y + 120 - SAFE_TOP);
            var my = (mo.y - dy);
            if (my < SAFE_TOP) my += (BAR_FLOOR_Y + 120 - SAFE_TOP);
            var mx = mo.x + Math.sin(barTime * 0.5 + mo.seed) * 14;
            ctx.fillStyle = mo.col;
            ctx.beginPath(); ctx.arc(mx, my, mo.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    // ── Draw (per frame) ─────────────────────────────────────
    function drawBarsInterior() {
        var topY = SAFE_TOP;

        // Back wall — cached moody plum gradient.
        ctx.fillStyle = barWallGrad;
        ctx.fillRect(0, 0, W, BAR_FLOOR_Y);

        // Warm overhead pendant glow over the bar (cached radial).
        ctx.fillStyle = barGlowGrad;
        ctx.fillRect(W - 350, 0, 350, BAR_FLOOR_Y);

        // Back-bar recess (darker inset) for depth behind the bottle wall.
        var shelfY = topY + 150;
        ctx.fillStyle = barBackBarGrad;
        ctx.fillRect(W - 240, shelfY - 64, 240, 78);

        // Floor — cached warm wood gradient + precomputed plank seams.
        ctx.fillStyle = barFloorGrad;
        ctx.fillRect(0, BAR_FLOOR_Y, W, H - BAR_FLOOR_Y);
        ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 2;
        ctx.beginPath();
        for (var p = 0; p < barPlanks.length; p++) {
            ctx.moveTo(barPlanks[p], BAR_FLOOR_Y); ctx.lineTo(barPlanks[p], H);
        }
        ctx.stroke();

        // Neon floor reflections — soft colored smears mirrored on the wood.
        ctx.save();
        ctx.globalAlpha = 0.10;
        var refl = ctx.createLinearGradient(0, BAR_FLOOR_Y, 0, BAR_FLOOR_Y + 90);
        refl.addColorStop(0, "rgba(255,64,129,0.5)");
        refl.addColorStop(0.5, "rgba(64,196,255,0.35)");
        refl.addColorStop(1, "rgba(255,64,129,0)");
        ctx.fillStyle = refl;
        // shimmer the reflection band horizontally with the beat
        ctx.fillRect(0, BAR_FLOOR_Y, W, 80);
        ctx.globalAlpha = 1;
        ctx.restore();

        // Drifting ambient haze motes (behind props).
        barDrawMotes();

        // Sweeping disco lighting over everything (subtle).
        barDrawDiscoLights();

        // Dance floor patch (left-center), under the jukebox area.
        barDrawDanceFloor(78, BAR_FLOOR_Y + 36, 120, 96);

        // Back-bar shelves + bottle wall + hanging stemware (layered depth).
        ctx.fillStyle = "#3E2723";
        ctx.fillRect(W - 230, shelfY - 30, 230, 6);
        barDrawHangingGlasses(shelfY - 44);
        barDrawBottles(shelfY);
        ctx.fillStyle = "#3E2723";
        ctx.fillRect(W - 230, shelfY + 6, 230, 5);
        // back-bar mirror strip with a soft reflection of the bottles' glow
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = "#FFE0B2";
        ctx.fillRect(W - 226, shelfY + 12, 222, 4);
        ctx.globalAlpha = 1;
        ctx.restore();

        // Neon signs.
        barDrawNeon(W / 2, topY + 34, "THE THIRSTY SCHOLAR", "#FF4081", 17);
        barDrawNeon(86, topY + 96, "L'CHAIM!", "#40C4FF", 16);
        barDrawNeon(W - 70, topY + 150 - 70, "OPEN", "#69F0AE", 18);

        // Wall TV (upper left-ish) — now cycles channels.
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

        // Bartender behind the counter (polishes & pours on a loop).
        barDrawBartender(W - 56, BAR_FLOOR_Y - 28);

        // Passed-out guy on the counter.
        barDrawPassedOut(270, counterY - 2);

        // Bar stools along the counter (precomputed positions).
        for (var si = 0; si < barStools.length; si++) {
            barDrawStool(barStools[si].x, barStools[si].y);
        }

        // Jukebox (left, by the dance floor).
        barDrawJukebox(116, BAR_FLOOR_Y + 30);

        // Bouncer by the door (far left).
        barDrawBouncer(44, BAR_FLOOR_Y + 6);

        // Two wobbly drunk patrons (reuse drawPedestrian drunk=true). They
        // sip/sway on their own; the right one raises a glass when clinked.
        drawPedestrian(192, BAR_FLOOR_Y + 26, barPatronWobble + 0.4, 1, false, true);
        // sipping glass for patron A (rises to "mouth" on a slow cycle)
        var sipA = Math.max(0, Math.sin(barTime * 0.9)) * 6;
        ctx.fillStyle = "rgba(178,235,242,0.85)";
        roundRect(192 + 8, BAR_FLOOR_Y + 14 - sipA, 5, 8, 2); ctx.fill();

        var clinkRaise = barClinkPartnerT > 0 ? 8 : 0;
        drawPedestrian(340, BAR_FLOOR_Y + 26, barPatronWobble + 1.7, 2, false, true);
        ctx.fillStyle = "rgba(255,224,130,0.9)";
        roundRect(340 - 12, BAR_FLOOR_Y + 14 - clinkRaise, 5, 8, 2); ctx.fill();

        // A patron sliding off a stool — brief stumble micro-event.
        if (barStumbleT > 0) {
            var slide = (1.3 - barStumbleT) / 1.3;          // 0→1
            ctx.save();
            ctx.translate(barStumbleX + slide * 14, BAR_FLOOR_Y + 20 + slide * 26);
            ctx.rotate(slide * 0.7);
            ctx.fillStyle = "#7E57C2";
            roundRect(-7, -10, 14, 18, 5); ctx.fill();      // tumbling body
            ctx.fillStyle = C.skin;
            ctx.beginPath(); ctx.arc(0, -14, 6, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            if (slide > 0.3 && slide < 0.45) {
                drawText("WHOOPS!", barStumbleX, BAR_FLOOR_Y - 6, "bold 11px Arial", "#FFD740", "#000", 3);
            }
        }

        // A glowing exit door (far right of the floor) for flavor.
        var doorX = W - 24;
        ctx.save();
        ctx.fillStyle = "#311B92";
        roundRect(doorX - 22, BAR_FLOOR_Y - 40, 44, 96, 6); ctx.fill();
        ctx.fillStyle = "rgba(105,240,174,0.18)";
        roundRect(doorX - 22, BAR_FLOOR_Y - 40, 44, 12, 4); ctx.fill();
        drawText("EXIT", doorX, BAR_FLOOR_Y - 34, "bold 10px Arial", "#69F0AE", "#000", 2);
        ctx.restore();

        // ── Lulu on the floor (walkable / dancing / idle-sway) ──
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
            // idle: gentle sway to the beat when standing still
            var moving = barLulu.target != null || keys.left || keys.right;
            var sway = moving ? 0 : Math.sin(barTime * 3) * 0.05;
            var bobY = moving ? 0 : Math.abs(Math.sin(barTime * 3)) * 1.5;
            ctx.translate(barLulu.x, luluY - bobY);
            ctx.rotate(sway);
            ctx.scale(barLulu.facing, 1);
            drawLuluTopDown(0, 0, barLulu.walkTime, "run");
        }
        ctx.restore();

        // Neon "pop" flash on interaction (full-screen tint).
        if (barFlash > 0) {
            ctx.save();
            ctx.globalAlpha = barFlash * 0.18;
            ctx.fillStyle = barFlashColor;
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // Room-wide L'CHAIM toast banner ripple.
        if (barToastT > 0) {
            ctx.save();
            var ta = Math.min(1, barToastT / 0.4) * Math.min(1, (1.8 - barToastT) / 0.3);
            ctx.globalAlpha = Math.max(0, ta);
            var ty = BAR_FLOOR_Y - 90 - (1.8 - barToastT) * 14;
            drawText("🥂 L'CHAIM! 🥂", W / 2, ty, "bold 22px 'Segoe UI', Arial, sans-serif", "#FFE082", "#5D4037", 5);
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
