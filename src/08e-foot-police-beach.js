    // ════════════════════════════════════════════════════════════
    //  FOOT INTERIORS — POLICE STATION + BEACH
    //  Two self-contained mini-scenes Lulu can wander into while she's
    //  on foot (car wrecked). Each: full-screen art, walkable/animated
    //  Lulu (drawLuluTopDown), 3+ randomized-dialogue interactions, a
    //  reward (coins/⭐ + floater + sound), an obvious 🚪 LEAVE door/
    //  button calling exitFootInterior(), a title banner, touch hints.
    //  Defines ONLY init/update/draw{Police,Beach}Interior + pol*/bch*
    //  prefixed helpers. Dispatcher/exitFootInterior live elsewhere.
    // ════════════════════════════════════════════════════════════

    // ── tiny shared idiom (prefixed so it can't collide) ─────────
    // A "hotspot" is {x, walkY, r, label, lines, rewarded, type}. When
    // Lulu walks near its x (or it's tapped) we pop a randomized line;
    // reward hotspots pay out once per visit.

    function polPickLine(spot) {
        // avoid repeating the immediately-previous line for a pool
        var arr = spot.lines, idx = randInt(0, arr.length - 1);
        if (arr.length > 1 && idx === spot._last) idx = (idx + 1) % arr.length;
        spot._last = idx;
        return arr[idx];
    }
    function bchPickLine(spot) {
        var arr = spot.lines, idx = randInt(0, arr.length - 1);
        if (arr.length > 1 && idx === spot._last) idx = (idx + 1) % arr.length;
        spot._last = idx;
        return arr[idx];
    }

    // ════════════════════════════════════════════════════════════
    //  POLICE STATION — "PRECINCT 18½"
    // ════════════════════════════════════════════════════════════
    var polTime = 0;
    var polLuluX = 90, polLuluTargetX = 90, polWalkT = 0, polFacing = 1;
    var polFloorY = 0;            // computed in init from H
    var polBubble = "", polBubbleT = 0, polBubbleX = 0;
    var polSpots = [];
    var polLeaveRect = null;
    var polServiceRect = null;   // "settle your charges" service button
    var polCopMunch = 0;          // donut chew animation
    var polPerpBlink = 0;
    var polPerpPace = 0;          // perp paces side-to-side / rattles bars
    var polFan = 0;               // ceiling-fan spin
    var polConfettiSpawned = false;
    var polLuluFidget = 0;        // Lulu idle look-around timer
    // — cached / precomputed (built once in init) —
    var polWallGrad = null, polFloorGrad = null;
    var polTiles = [];            // {x,y,w,h} static checker tiles
    var polPhoneT = 0;            // desk phone ringing phase (>0 = ringing)
    var polPhoneCool = 0;         // cooldown before next ring
    var polFlick = 1;             // WANTED-board flicker brightness
    var polFlickT = 0;
    var polSteamCool = 0;         // throttle coffee-steam particle spawns
    // micro-events (radio dispatch / perp hauled past)
    var polEventT = 0, polEventCool = 0, polEventKind = 0;
    var polEventX = 0;            // x of the hauled-perp procession
    var polDispatch = "";         // radio crackle text
    var POL_DISPATCH = [
        "📻 *kkrrt* ...10-91, loose goat on Route 6...",
        "📻 *kkrrt* ...be advised, babka heist in progress...",
        "📻 *kkrrt* ...all units, double-parked minivan, code MOM...",
        "📻 *kkrrt* ...suspect described as tall, hairy, polite...",
        "📻 *kkrrt* ...possible 10-56, man overboard at Shtrand...",
        "📻 *kkrrt* ...requesting backup, the donuts are GONE...",
        "📻 *kkrrt* ...Heshy sighting near the kiddie pool, again..."
    ];

    // ── Precinct SNEAK-OUT cutscene (mirrors the ER escape) ──────
    // Leaving the precinct sometimes plays a comedic "sneak past the cops" beat:
    // a random attempt, then either a clean strut-out or a funny nab. (She's
    // free to go either way — getting "caught" just means she's shooed out.)
    var polEscape = null;
    var POL_ESCAPES = [
        { attempt: "🤫 ...tiptoes past the donut-munching desk cop.", visual: "tiptoe" },
        { attempt: "🪖 ...army-crawls across the precinct floor.", visual: "crawl" },
        { attempt: "🧹 ...grabs a mop — 'just the janitor, officer!'", visual: "mop" },
        { attempt: "🔔 ...yanks the fire alarm and bolts in the chaos!", visual: "alarm" }
    ];
    var POL_CLEAN = ["...waltzed right out the front door. 🚶‍♀️💨",
        "The cop never looked up from his cruller. 🍩", "Out clean — she even swiped a lollipop. 🍭",
        "Smooth. Nobody saw a thing.", "Strolled past three cops. Confidence is a disguise."];
    var POL_CAUGHT = [
        { line: "The desk cop looks up mid-bite: 'Goin' SOMEWHERE?' 🍩👮", visual: "donut" },
        { line: "A K9 clamps onto her pant leg. Good boy. 🐕🚔", visual: "k9" },
        { line: "The front door swings open — backup's already there. 🚓", visual: "backup" }
    ];
    function startPolEscape() {
        polEscape = { escape: randPick(POL_ESCAPES), gag: randPick(POL_CAUGHT), cleanLine: randPick(POL_CLEAN),
                      caught: Math.random() < 0.45, phase: 0, t: 0 };
        polBubble = ""; polBubbleT = 0;   // drop any lingering chat bubble
        if (typeof consumeAction === "function") consumeAction();
        playClick();
    }
    function updatePolEscape(dt) {
        polEscape.t += dt;
        if (typeof updateParticles === "function") updateParticles(dt);
        if (polEscape.phase === 0) {
            // dust for the crawl/alarm dashes
            var v = polEscape.escape.visual;
            if ((v === "crawl" || v === "alarm") && typeof particles !== "undefined" && Math.random() < 0.5)
                particles.push({ x: rand(W * 0.3, W * 0.7), y: polFloorY + 28, vx: rand(-30, 30), vy: rand(-24, -6),
                    life: 0.5, maxLife: 0.5, size: rand(5, 9), color: "#CFD8DC", gravity: -20, smoke: true });
            if (polEscape.t > 2.3) {
                if (polEscape.caught) { polEscape.phase = 1; polEscape.t = 0; playTone(200, 0.12, "square", 0.14); }
                else { spawnFloater(W / 2, polFloorY - 40, "🏃 Out clean!", "#7CFC4F"); polEscape = null; exitFootInterior(); }
            }
        } else {
            if (polEscape.t > 2.2 || (polEscape.t > 1.0 && consumeTap())) {
                spawnFloater(W / 2, polFloorY - 40, "😳 ...shooed back to the street.", "#FFCC80");
                polEscape = null; exitFootInterior();
            }
        }
    }
    function drawPolEscape(floorY) {
        var pe = polEscape, t = pe.t, gy = floorY + 18;
        // floor shadow so the action reads as a lit stage
        var ff = ctx.createLinearGradient(0, floorY - 16, 0, H);
        ff.addColorStop(0, "rgba(6,14,22,0)"); ff.addColorStop(1, "rgba(6,14,22,0.72)");
        ctx.fillStyle = ff; ctx.fillRect(0, floorY - 16, W, H - floorY + 16);

        if (pe.phase === 0) {
            var prog = clamp(t / 2.3, 0, 1), v = pe.escape.visual;
            if (v === "tiptoe") {
                drawPolDonutCop(W * 0.20, gy, t, false);
                var cx = lerp(W * 0.40, W * 0.86, prog), bob = Math.abs(Math.sin(t * 6)) * 5;
                ctx.fillStyle = "rgba(255,255,255,0.28)";
                for (var d = 1; d <= 4; d++) { var dx = cx - d * 26; if (dx > W * 0.30) { ctx.beginPath(); ctx.arc(dx, gy + 20, 2.5, 0, Math.PI * 2); ctx.fill(); } }
                drawErLulu(cx, gy - bob, 1.4, t * 4, "panic", 0.12);
                drawText("🤫", cx + 20, gy - 46, "16px Arial", "#000", null, 0);
            } else if (v === "crawl") {
                var cx2 = lerp(W * 0.20, W * 0.82, prog);
                erSpeed(cx2 - 26, gy + 10, 1, 3, 18);
                drawErLulu(cx2, gy + 14, 1.3, t * 5, "panic", -1.45);   // ~horizontal = belly-crawl
                drawText("🪖", cx2 - 22, gy - 8, "14px Arial", "#000", null, 0);
            } else if (v === "mop") {
                var cx3 = lerp(W * 0.30, W * 0.82, prog);
                drawErLulu(cx3, gy, 1.35, t * 3, "panic", 0);
                ctx.strokeStyle = "#8D6E63"; ctx.lineWidth = 3; ctx.lineCap = "round";
                ctx.beginPath(); ctx.moveTo(cx3 + 12, gy - 16); ctx.lineTo(cx3 + 28, gy + 22); ctx.stroke(); ctx.lineCap = "butt";
                ctx.strokeStyle = "#FFE082"; ctx.lineWidth = 1.5;
                for (var ms = -5; ms <= 5; ms += 2.5) { ctx.beginPath(); ctx.moveTo(cx3 + 28 + ms, gy + 20); ctx.lineTo(cx3 + 28 + ms * 1.4, gy + 30); ctx.stroke(); }
                ctx.fillStyle = "#FFD54F"; roundRect(cx3 - 30, gy + 14, 16, 14, 3); ctx.fill();   // bucket
                drawText("🧹 just moppin'~", cx3, gy - 48, "bold 11px 'Segoe UI', Arial, sans-serif", "#B2DFDB", "#000", 2);
            } else { // alarm
                // alarm box on the wall, pulled, ringing
                ctx.fillStyle = "#C62828"; roundRect(W * 0.16, floorY - 150, 30, 40, 4); ctx.fill();
                ctx.fillStyle = "#FFCDD2"; roundRect(W * 0.16 + 6, floorY - 142, 18, 12, 2); ctx.fill();
                ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.arc(W * 0.16 + 15, floorY - 116 + Math.sin(t * 20) * 2, 5, 0, Math.PI * 2); ctx.fill();  // bell
                var bl0 = Math.abs(Math.sin(t * 14));
                drawText("🔔 CLANG CLANG!", W * 0.16 + 70, floorY - 130, "bold 13px 'Segoe UI', Arial, sans-serif", "rgba(255,82,82," + (0.5 + bl0 * 0.5) + ")", "#000", 3);
                var cx4 = lerp(W * 0.5, W * 0.88, prog);
                erSpeed(cx4 - 30, gy, 1, 4, 26);
                drawErLulu(cx4, gy, 1.4, t * 6, "panic", 0.1);
            }
        } else {
            var v2 = pe.gag.visual;
            if (v2 === "donut") {
                drawErLulu(W * 0.40, gy, 1.35, t * 5, "cry", 0.1);
                drawPolDonutCop(W * 0.64, gy, t, true);
            } else if (v2 === "k9") {
                drawErLulu(W * 0.46, gy, 1.35, t * 5, "cry", -0.12);
                drawPolDog(W * 0.60, gy + 16, t);
            } else { // backup at the door
                drawErLulu(W * 0.42, gy, 1.3, t * 5, "cry", 0);
                ctx.save(); ctx.translate(W * 0.64, gy); ctx.scale(1.3, 1.3); drawAngryMan(0, 0, t, "running", -1, true); ctx.restore();
            }
        }
        if (typeof drawParticles === "function") drawParticles();
        // caption (reuses the ER caption card) + nabbed banner
        erCaption(pe.phase === 0 ? pe.escape.attempt : pe.gag.line, pe.phase === 0 ? "#FFE082" : "#FF8A80");
        if (pe.phase === 1 && t > 1.0) {
            var bl = 0.4 + 0.6 * Math.abs(Math.sin(polTime * 6));
            ctx.globalAlpha = bl; drawText("🚨 NABBED 🚨", W / 2, floorY - 170, "bold 20px 'Segoe UI', Arial, sans-serif", "#FF1744", "#000", 5); ctx.globalAlpha = 1;
        }
    }
    // A seated, donut-munching desk cop (looks up + "!" when alert).
    function drawPolDonutCop(x, y, t, alert) {
        ctx.save(); ctx.translate(x, y); ctx.scale(1.25, 1.25);
        ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.ellipse(0, 26, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1A237E"; roundRect(-13, 0, 26, 24, 6); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -10, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0D1457"; roundRect(-11, -16, 22, 6, 2); ctx.fill();
        ctx.fillStyle = "#1A237E"; roundRect(-8, -21, 16, 6, 2); ctx.fill();
        ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.arc(0, -18, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3E2723"; ctx.fillRect(-4, -7, 8, 2);
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-3, -10, alert ? 1.7 : 1, 0, Math.PI * 2); ctx.arc(3, -10, alert ? 1.7 : 1, 0, Math.PI * 2); ctx.fill();
        // donut in hand
        ctx.fillStyle = "#F8BBD0"; ctx.beginPath(); ctx.arc(15, 7, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(15, 7, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#E91E63"; ctx.fillRect(13, 3, 1.5, 1.5); ctx.fillRect(18, 6, 1.5, 1.5); ctx.fillRect(14, 10, 1.5, 1.5);
        ctx.restore();
        if (alert) drawText("!", x, y - 34, "bold 18px Arial", "#FF1744", "#000", 3);
    }
    // A little K9 latched onto her leg, tail wagging.
    function drawPolDog(x, y, t) {
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = "#5D4037"; roundRect(-10, -6, 22, 13, 5); ctx.fill();
        ctx.beginPath(); ctx.arc(-12, -4, 6, 0, Math.PI * 2); ctx.fill();          // head toward Lulu (left)
        ctx.fillStyle = "#3E2723"; ctx.beginPath(); ctx.arc(-16, -8, 2, 0, Math.PI * 2); ctx.fill();  // ear
        ctx.fillStyle = "#5D4037"; ctx.fillRect(-6, 5, 3, 7); ctx.fillRect(5, 5, 3, 7);
        ctx.strokeStyle = "#5D4037"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(11, -2); ctx.lineTo(18, -10 + Math.sin(t * 18) * 5); ctx.stroke(); ctx.lineCap = "butt";
        ctx.restore();
    }

    function initPoliceInterior() {
        polTime = 0;
        polEscape = null;
        polFloorY = H - SAFE_BOTTOM - 120;
        polLuluX = 90; polLuluTargetX = 90; polWalkT = 0; polFacing = 1;
        polBubble = ""; polBubbleT = 0;
        polCopMunch = 0; polPerpBlink = rand(0, 4); polPerpPace = 0; polFan = 0;
        polConfettiSpawned = false;
        polLuluFidget = rand(0, 3);
        polPhoneT = 0; polPhoneCool = rand(4, 8);
        polFlick = 1; polFlickT = 0; polSteamCool = 0;
        polEventT = 0; polEventCool = rand(6, 11); polEventKind = 0; polEventX = 0;
        polDispatch = "";

        // cache gradients ONCE
        polWallGrad = ctx.createLinearGradient(0, 0, 0, polFloorY);
        polWallGrad.addColorStop(0, "#3E5871");
        polWallGrad.addColorStop(1, "#56789B");
        polFloorGrad = ctx.createLinearGradient(0, polFloorY, 0, H - SAFE_BOTTOM);
        polFloorGrad.addColorStop(0, "#9AA7B3");
        polFloorGrad.addColorStop(1, "#7C8A98");

        // precompute checker-tile rects (no per-frame loop math)
        polTiles = [];
        for (var ty = 0; ty < 8; ty++) {
            for (var tx = -1; tx < 12; tx++) {
                if ((tx + ty) % 2 === 0) {
                    var ts = 28 + ty * 5;
                    polTiles.push({ x: tx * ts, y: polFloorY + ty * 11, w: ts, h: 11 });
                }
            }
        }

        polSpots = [
            {
                id: "desk", x: 175, r: 64, rewarded: false, reward: false,
                label: "Desk Cop", _last: -1,
                lines: [
                    "Officer Pomerantz, how can I— oh, it's you.",
                    "Your car? It's in the lot. $400 to spring it.",
                    "Impound's $400, hon. And no, I can't 'round down.'",
                    "We don't validate parking. We validate FEELINGS.",
                    "You can file a complaint. It goes in this drawer.\n(The drawer is taped shut.)",
                    "Lost and found? One umbrella, a herring, and regret.",
                    "Sign here. And here. And here. And here. And here.",
                    "Yes the donut's a bribe. From me. To me.",
                    "Crime's down 2% since I started napping at noon.",
                    "Your bubbe called. Twice. She says EAT.",
                    "No I will NOT 'just this once' waive the fee.",
                    "Press 1 for impound, 2 for snacks, 3 to hear this again.",
                    "*phone rings* Precinct 18½, you bend it you mend it.",
                    "Coffee's free, justice is not, and the donut is mine.",
                    "We're understaffed. It's me, the fan, and a confused perp."
                ]
            },
            {
                id: "cell", x: 305, r: 60, rewarded: false, reward: false,
                label: "The Perp", _last: -1,
                lines: [
                    "I'm innocent! I only TASTED the kugel display.",
                    "They got me for jaywalking. Diagonally. Twice.",
                    "Psst — you got a nail file? Or like, a bagel file?",
                    "I'm in for excessive parallel parking. It's a crime here.",
                    "One phone call and I used it to order a pizza.",
                    "I didn't do it. But I'd do it again. The pizza, I mean.",
                    "Cell's got no WiFi. THIS is the real punishment.",
                    "I'm basically a prisoner of my own bad choices. Relatable?",
                    "If you see Heshy out there, tell him I said NOTHING.",
                    "They call me 'The Schmear.' I don't know why. (I do.)",
                    "Three squares a day and they're all bagels. No complaints.",
                    "You bring snacks? No? Worst rescue ever.",
                    "I'd shake your hand but, y'know. Bars. Boundaries.",
                    "*rattles bars* These? Decorative. The shame's the real cage.",
                    "I've counted these bars 400 times. There are eight. Eight!",
                    "Pacing's my cardio now. Six steps left, six steps right.",
                    "Tell the cop I want my one call. To complain about the bagels."
                ]
            },
            {
                id: "board", x: 400, r: 56, rewarded: false, reward: false,
                label: "Most Wanted", _last: -1,
                lines: [
                    "MOST WANTED: 7-foot 'Bigfoot.' Last seen... everywhere.",
                    "Reward: 200 coins. Distinguishing feature: ENORMOUS.",
                    "WANTED: Heshy. Crime: cannonballs in the kiddie pool.",
                    "This poster's just a guy in a gorilla suit. Probably.",
                    "WANTED for questioning: whoever ate the desk donuts.",
                    "Hmm. That sasquatch sketch looks suspiciously fluffy.",
                    "Suspect described as 'large, hairy, surprisingly polite.'",
                    "Last seen fleeing a salon. With GREAT highlights.",
                    "Armed and... fragrant? Smells like pine and chutzpah.",
                    "BOLO: a minivan driven 'like a woman possessed.' (Mom.)",
                    "There's a crayon 'wanted' poster of Dina. Aww. Denied.",
                    "Reward doubles if you bring him in conditioned & calm."
                ]
            },
            {
                id: "coffee", x: 230, r: 50, rewarded: false, reward: true,
                label: "Coffee Machine", _last: -1,
                lines: [
                    "FREE precinct coffee! Found 30 coins in the change slot!",
                    "Jackpot — the machine coughed up 30 coins. Cop coffee!",
                    "It's lukewarm, it's free, it tipped you 30 coins. Win.",
                    "Tastes like a stakeout smells. But hey — 30 coins!",
                    "The 'cappuccino' button dispenses pure caffeine + coins!"
                ]
            },
            {
                id: "confess", x: 130, r: 46, rewarded: false, reward: false,
                label: "Confession Box", _last: -1,
                lines: [
                    "\"I confess! I jaywalked!\" ...Cop: \"We all do, hon.\"",
                    "\"I double-parked outside Bubbe's!\" Cop: \"Bold. Continue.\"",
                    "\"I took the last babka.\" Cop: \"THAT one's a real crime.\"",
                    "\"I U-turned where I shouldn't.\" Cop: \"Show-off.\"",
                    "\"I sped to make Shabbos.\" Cop: \"...okay that's fair.\"",
                    "\"I honked at a goose.\" Cop: \"The goose had it coming.\"",
                    "\"I parked in the rabbi's spot.\" Cop: \"...new charges.\"",
                    "You confess. The cop yawns. Justice is exhausting."
                ]
            },
            {
                id: "fan", x: 250, r: 38, rewarded: false, reward: false,
                label: "Ceiling Fan", _last: -1,
                lines: [
                    "The fan squeaks once per rotation. It's almost music.",
                    "It's been spinning since 1987. Don't ask, no one knows.",
                    "Best AC in the building. The ONLY AC in the building.",
                    "It wobbles like it's nervous. Same, fan. Same.",
                    "A paper airplane's been stuck up there for a year."
                ]
            }
        ];
    }

    function updatePoliceInterior(dt) {
        polTime += dt;
        if (polEscape) { updatePolEscape(dt); return; }   // sneak-out cutscene owns input
        polCopMunch += dt * 6;
        polPerpBlink += dt;
        polPerpPace += dt * 1.4;
        polFan += dt * 5;
        polLuluFidget -= dt;
        if (polLuluFidget < 0) polLuluFidget = rand(2.5, 5);
        if (polBubbleT > 0) polBubbleT -= dt;

        // flickering WANTED board (fluorescent buzz)
        polFlickT -= dt;
        if (polFlickT <= 0) {
            polFlickT = rand(0.06, 0.5);
            polFlick = (rand(0, 1) < 0.18) ? rand(0.45, 0.7) : rand(0.92, 1);
        }

        // desk phone ring cycle
        if (polPhoneT > 0) {
            polPhoneT -= dt;
            if (polPhoneT <= 0) polPhoneCool = rand(6, 12);
        } else {
            polPhoneCool -= dt;
            if (polPhoneCool <= 0) { polPhoneT = rand(2, 3.5); playTone(1180, 0.1, "square", 0.05, 0); }
        }

        // periodic micro-event: radio dispatch crackle OR perp hauled past
        if (polEventT > 0) {
            polEventT -= dt;
            if (polEventKind === 2) polEventX += 70 * dt; // procession crosses back hall
            if (polEventT <= 0) { polEventCool = rand(8, 14); polDispatch = ""; }
        } else {
            polEventCool -= dt;
            if (polEventCool <= 0) {
                polEventKind = (rand(0, 1) < 0.55) ? 1 : 2;
                if (polEventKind === 1) {
                    polEventT = 3.2;
                    polDispatch = randPick(POL_DISPATCH);
                    playTone(620, 0.08, "square", 0.05, 760);
                } else {
                    polEventT = 4.5; polEventX = -60;
                    playTone(300, 0.15, "sawtooth", 0.05, 220);
                }
            }
        }

        var bottom = H - SAFE_BOTTOM;
        polLeaveRect = { x: W - 122, y: bottom - 64, w: 110, h: 50 };
        polServiceRect = footServiceRect();

        var c = consumeClick();
        if (c) {
            // SETTLE-CHARGES service desk: pay to wipe her outstanding "wanted" file
            if (pointInRect(c.x, c.y, polServiceRect.x, polServiceRect.y, polServiceRect.w, polServiceRect.h)) {
                polSettleCharges(); return;
            }
            // LEAVE button / door — often play a comedic "sneak past the cops"
            // exit (mirrors the ER escape); otherwise just walk out.
            if (pointInRect(c.x, c.y, polLeaveRect.x, polLeaveRect.y, polLeaveRect.w, polLeaveRect.h) ||
                pointInRect(c.x, c.y, W - 96, polFloorY - 132, 80, 132)) {
                if (Math.random() < 0.55) { startPolEscape(); return; }
                playClick(); exitFootInterior();
                return;
            }
            // tapping a hotspot directly walks Lulu there + triggers it
            var hit = null;
            for (var i = 0; i < polSpots.length; i++) {
                var s = polSpots[i];
                if (Math.abs(c.x - s.x) < s.r && c.y < polFloorY + 60) { hit = s; break; }
            }
            if (hit) {
                polLuluTargetX = clamp(hit.x - 40, 60, W - 60);
                polFacing = (hit.x >= polLuluX) ? 1 : -1;
                polTrigger(hit);
            } else {
                // tap-to-walk on the floor
                polLuluTargetX = clamp(c.x, 50, W - 40);
                polFacing = (c.x >= polLuluX) ? 1 : -1;
            }
        }

        // proximity auto-trigger (walking up to a spot)
        for (var j = 0; j < polSpots.length; j++) {
            var sp = polSpots[j];
            if (Math.abs(polLuluX + 40 - sp.x) < 28 && polBubbleT <= 0) polTrigger(sp);
        }

        // walk toward target
        var dx = polLuluTargetX - polLuluX;
        if (Math.abs(dx) > 2) {
            var step = clamp(dx, -200 * dt, 200 * dt);
            polLuluX += step;
            polWalkT += dt;
        }
    }

    function polWantedFee() { return (typeof isWanted === "function" && isWanted()) ? 50 + save.wanted.length * 40 : 0; }
    // The genuinely USEFUL reason to come to the precinct: pay your fine and the
    // cops call off the hunt (clears the outstanding "wanted" file — otherwise
    // only a court can). Costs more the longer your rap sheet.
    function polSettleCharges() {
        if (!(typeof isWanted === "function" && isWanted())) {
            polBubble = randPick(["Your record's clean as a whistle, hon.", "Nothin' on file. Keep it that way.",
                "No charges pending. Don't tempt me to FIND some."]);
            polBubbleT = 2.8; polBubbleX = W / 2; playClick(); return;
        }
        var cost = polWantedFee();
        if (save.totalCoins < cost) {
            polBubble = "Can't cover the fine? Then you're STILL wanted, hon.";
            polBubbleT = 3.0; polBubbleX = W / 2; playDeny(); return;
        }
        chargeCoins(cost); if (typeof clearWanted === "function") clearWanted();
        polBubble = "Paid in full. Charges DROPPED — cops'll leave you be.";
        polBubbleT = 3.2; polBubbleX = W / 2;
        spawnFloater(W / 2, polFloorY - 70, "🧾 record wiped clean!", "#7CFC4F");
        playCoin();
        for (var k = 0; k < 14; k++) particles.push({ x: W / 2 + rand(-30, 30), y: polFloorY - 50,
            vx: rand(-50, 50), vy: rand(-120, -40), life: 0, maxLife: 0.8, size: rand(3, 6),
            color: randPick(["#7CFC4F", "#FFFFFF", "#B9F6CA"]), gravity: 240 });
    }

    function polTrigger(spot) {
        if (polBubbleT > 0 && polBubble && spot.id === spot._lastShownId) {
            // already showing this spot's bubble — don't spam
        }
        polBubble = polPickLine(spot);
        polBubbleT = 2.6;
        polBubbleX = spot.x;
        spot._lastShownId = spot.id;
        playClick();
        if (spot.reward && !spot.rewarded) {
            spot.rewarded = true;
            footCoinsRun += 30; runCoins += 30; save.totalCoins += 30; persistSave();
            spawnFloater(spot.x, polFloorY - 80, "+30", "#FFD700");
            playCoin();
            for (var k = 0; k < 12; k++) {
                particles.push({
                    x: spot.x, y: polFloorY - 60,
                    vx: rand(-50, 50), vy: rand(-120, -40),
                    life: 0, maxLife: 0.7, size: rand(3, 6),
                    color: randPick(["#FFD700", "#6F4E37", "#FFF8B0"]), gravity: 260
                });
            }
        }
    }

    function drawPoliceInterior() {
        var bottom = H - SAFE_BOTTOM;
        var floorY = polFloorY;

        // ── back wall (cached gradient) ─────────────────────────
        ctx.fillStyle = polWallGrad;
        ctx.fillRect(0, 0, W, floorY);

        // back hallway depth: a darker recessed doorway mid-wall + a
        // second cop crossing behind it (gives the lobby a "behind")
        var hallX = W / 2 + 70, hallW = 90, hallTop = 40, hallBot = floorY - 26;
        ctx.fillStyle = "#22323F";
        ctx.fillRect(hallX, hallTop, hallW, hallBot - hallTop);
        ctx.fillStyle = "#1A2730";
        ctx.fillRect(hallX, hallTop, hallW, 6); // lintel shadow
        // faint depth lines (perspective)
        ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hallX, hallTop); ctx.lineTo(hallX + 14, hallTop + 14);
        ctx.moveTo(hallX + hallW, hallTop); ctx.lineTo(hallX + hallW - 14, hallTop + 14);
        ctx.stroke();
        // a second cop silhouette crossing the back hall
        var bcX = hallX + 18 + (Math.sin(polTime * 0.5) * 0.5 + 0.5) * (hallW - 36);
        ctx.save();
        ctx.translate(bcX, hallBot - 8);
        var bcW = (Math.sin(polTime * 7) > 0) ? 1 : -1;
        ctx.fillStyle = "#16222B";
        roundRect(-7, -34, 14, 26, 5); ctx.fill();            // body
        ctx.beginPath(); ctx.arc(0, -40, 7, 0, Math.PI * 2); ctx.fill(); // head
        ctx.beginPath(); ctx.arc(0, -44, 7, Math.PI, Math.PI * 2); ctx.fill(); // cap
        ctx.fillRect(-1.5, -8, 3 * bcW, 8);                   // stepping leg hint
        ctx.restore();

        // ── fluorescent ceiling lighting: soft warm wash + flicker
        ctx.save();
        ctx.globalAlpha = 0.10 + (polFlick < 0.8 ? 0.05 : 0);
        ctx.fillStyle = "#EAF6FF";
        ctx.fillRect(0, 0, W, floorY * 0.5);
        ctx.globalAlpha = 1;
        // two ceiling tube fixtures
        ctx.fillStyle = polFlick > 0.85 ? "#F4FBFF" : "#C7D6DF";
        roundRect(W * 0.18, 14, 120, 8, 3); ctx.fill();
        roundRect(W * 0.62, 14, 120, 8, 3); ctx.fill();
        ctx.restore();

        // ── wall decor to fill the tall lobby wall ─────────────
        var wdMid = floorY * 0.5;
        // precinct seal — a gold star in a ring (upper-left)
        var seX = W * 0.20, seY = 142;
        ctx.fillStyle = "#16222B"; ctx.beginPath(); ctx.arc(seX, seY, 44, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#FFC107"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(seX, seY, 37, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#FFD54F"; ctx.beginPath();
        for (var ss = 0; ss < 5; ss++) { var sa = -Math.PI / 2 + ss * (Math.PI * 2 / 5); ctx.lineTo(seX + Math.cos(sa) * 19, seY - 5 + Math.sin(sa) * 19); var sb = sa + Math.PI / 5; ctx.lineTo(seX + Math.cos(sb) * 8.5, seY - 5 + Math.sin(sb) * 8.5); }
        ctx.closePath(); ctx.fill();
        drawText("PRECINCT 18½", seX, seY + 30, "bold 7px 'Segoe UI', Arial, sans-serif", "#FFD54F", null, 0);
        // wall clock (upper-centre, left of the hallway)
        var clX = W * 0.5, clY = 124;
        ctx.fillStyle = "#ECEFF1"; ctx.beginPath(); ctx.arc(clX, clY, 21, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#37474F"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(clX, clY, 21, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "#263238"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(clX, clY); ctx.lineTo(clX + Math.cos(polTime * 0.4 - Math.PI / 2) * 10, clY + Math.sin(polTime * 0.4 - Math.PI / 2) * 10); ctx.stroke();
        ctx.strokeStyle = "#E53935"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(clX, clY); ctx.lineTo(clX + Math.cos(polTime * 1.6 - Math.PI / 2) * 15, clY + Math.sin(polTime * 1.6 - Math.PI / 2) * 15); ctx.stroke();
        // framed "OFFICER O' MONTH" photo (right of the hallway)
        var phX = W * 0.9, phY = 150;
        ctx.fillStyle = "#5D4037"; roundRect(phX - 28, phY - 34, 56, 68, 4); ctx.fill();
        ctx.fillStyle = "#90CAF9"; roundRect(phX - 23, phY - 29, 46, 48, 2); ctx.fill();
        ctx.fillStyle = "#1A237E"; roundRect(phX - 11, phY - 4, 22, 23, 6); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(phX, phY - 10, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0D1B5E"; ctx.beginPath(); ctx.ellipse(phX, phY - 16, 9, 3.6, 0, 0, Math.PI * 2); ctx.fill();
        drawText("OFFICER O' MONTH", phX, phY + 28, "bold 6px 'Segoe UI', Arial, sans-serif", "#FFD54F", null, 0);
        // cork bulletin board with sticky notes (mid-left)
        var bbX = W * 0.2, bbY = wdMid + 30;
        ctx.fillStyle = "#A1724B"; roundRect(bbX - 46, bbY - 34, 92, 68, 4); ctx.fill();
        ctx.strokeStyle = "#6D4C41"; ctx.lineWidth = 4; roundRect(bbX - 46, bbY - 34, 92, 68, 4); ctx.stroke();
        var noteCols = ["#FFF59D", "#FFAB91", "#A5D6A7", "#90CAF9"];
        for (var nz = 0; nz < 4; nz++) { var nx = bbX - 24 + (nz % 2) * 48, ny = bbY - 16 + Math.floor(nz / 2) * 34; ctx.save(); ctx.translate(nx, ny); ctx.rotate((nz % 2 ? 1 : -1) * 0.08); ctx.fillStyle = noteCols[nz]; roundRect(-15, -13, 30, 26, 2); ctx.fill(); ctx.fillStyle = "rgba(0,0,0,0.16)"; for (var ln = 0; ln < 3; ln++) ctx.fillRect(-11, -7 + ln * 6, 22, 1.4); ctx.restore(); }
        // motivational poster (mid-centre)
        var poX = W * 0.52, poY = wdMid + 30;
        ctx.fillStyle = "#263238"; roundRect(poX - 44, poY - 34, 88, 68, 4); ctx.fill();
        ctx.fillStyle = "#1565C0"; roundRect(poX - 40, poY - 30, 80, 60, 3); ctx.fill();
        drawText("PROTECT", poX, poY - 13, "bold 11px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 2);
        drawText("& SERVE", poX, poY + 1, "bold 11px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 2);
        drawText("(SNACKS)", poX, poY + 18, "bold 9px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#000", 2);

        // wainscot stripe
        ctx.fillStyle = "#2E4257";
        ctx.fillRect(0, floorY - 26, W, 26);

        // floor (cached gradient + precomputed checker tiles)
        ctx.fillStyle = polFloorGrad;
        ctx.fillRect(0, floorY, W, bottom - floorY);
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        for (var ti = 0; ti < polTiles.length; ti++) {
            var t = polTiles[ti];
            ctx.fillRect(t.x, t.y, t.w, t.h);
        }

        // ── ceiling-fan shadow sweeping the floor (under the fan) ─
        ctx.save();
        ctx.globalAlpha = 0.10;
        ctx.translate(W / 2, floorY + 30);
        ctx.rotate(polFan);
        ctx.fillStyle = "#1A2730";
        for (var fs = 0; fs < 3; fs++) {
            ctx.rotate((Math.PI * 2) / 3);
            ctx.fillRect(-7, 0, 14, 64);
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // ceiling fan
        ctx.save();
        ctx.translate(W / 2, 30);
        ctx.fillStyle = "#2E4257"; ctx.fillRect(-1.5, -20, 3, 14);
        ctx.rotate(polFan);
        ctx.fillStyle = "rgba(40,55,75,0.85)";
        for (var fb = 0; fb < 3; fb++) {
            ctx.rotate((Math.PI * 2) / 3);
            roundRect(-4, 0, 8, 30, 4); ctx.fill();
        }
        ctx.fillStyle = "#1F2E3D"; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // ── MOST WANTED board (x≈400) ──────────────────────────
        polDrawBoard(400, floorY - 150);

        // ── coffee machine (x≈230) ─────────────────────────────
        polDrawCoffee(230, floorY);

        // ── confession box (x≈130) ─────────────────────────────
        polDrawConfession(130, floorY);

        // ── holding cell + perp (x≈305) ────────────────────────
        polDrawCell(305, floorY);

        // ── exit doorway (top-right) ───────────────────────────
        ctx.fillStyle = "#3A2A1A";
        roundRect(W - 96, floorY - 132, 80, 132, 6); ctx.fill();
        ctx.fillStyle = "#5D4037";
        roundRect(W - 90, floorY - 124, 68, 124, 4); ctx.fill();
        ctx.fillStyle = "#FFD54F";
        ctx.beginPath(); ctx.arc(W - 30, floorY - 62, 3, 0, Math.PI * 2); ctx.fill();
        drawText("EXIT", W - 56, floorY - 118, "bold 11px Arial", "#B71C1C", "#FFF", 3);

        // ── front desk + donut cop (x≈175), drawn near floor ───
        polDrawDesk(175, floorY);

        // ── hauled-perp procession crossing the back hall ──────
        if (polEventKind === 2 && polEventT > 0 && polEventX < W + 60) {
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.translate(polEventX, hallBot - 6);
            // escorting cop
            ctx.fillStyle = "#16222B"; roundRect(-9, -32, 14, 26, 5); ctx.fill();
            ctx.beginPath(); ctx.arc(-2, -38, 6, 0, Math.PI * 2); ctx.fill();
            // cuffed perp (striped) being walked
            ctx.fillStyle = "#5A6B78"; roundRect(8, -30, 12, 22, 4); ctx.fill();
            ctx.fillStyle = "#3A4854"; ctx.beginPath(); ctx.arc(14, -34, 5, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // ── Lulu (with idle look-around fidget) — replaced by the sneak-out
        //    cutscene while escaping ───────────────────────────────
        if (polEscape) {
            drawPolEscape(floorY);
        } else {
        var polFid = (polLuluFidget < 0.6) ? Math.sin(polTime * 8) * 0.12 : 0;
        ctx.save();
        if (polFacing < 0) {
            ctx.translate(polLuluX, 0); ctx.scale(-1, 1);
            ctx.translate(0, floorY + 18); ctx.rotate(polFid); ctx.translate(0, -(floorY + 18));
            drawLuluTopDown(0, floorY + 18, polWalkT, "run");
        } else {
            ctx.translate(polLuluX, floorY + 18); ctx.rotate(polFid); ctx.translate(-polLuluX, -(floorY + 18));
            drawLuluTopDown(polLuluX, floorY + 18, polWalkT, "run");
        }
        ctx.restore();
        }

        // ── radio dispatch crackle banner (micro-event) ────────
        if (polEventKind === 1 && polEventT > 0 && polDispatch) {
            ctx.save();
            var dw = 300, dxp = (W - dw) / 2, dyp = floorY - 200;
            ctx.globalAlpha = clamp(polEventT, 0, 1) * (0.7 + 0.3 * Math.sin(polTime * 18));
            ctx.fillStyle = "rgba(15,25,35,0.9)";
            roundRect(dxp, dyp, dw, 26, 6); ctx.fill();
            ctx.globalAlpha = clamp(polEventT, 0, 1);
            drawText(polDispatch, W / 2, dyp + 17, "bold 11px Arial", "#9CFF9C", "#000", 3);
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // ── speech bubble ───────────────────────────────────────
        if (polBubbleT > 0 && polBubble) {
            var by = floorY - 70;
            drawSpeechBubble(clamp(polBubbleX, 70, W - 70), by, polBubble, polTime);
        }

        // ── title banner ────────────────────────────────────────
        polDrawBanner();

        // ── LEAVE button + hints (hidden during the sneak-out cutscene) ──
        if (polEscape) return;
        drawButton(polLeaveRect.x, polLeaveRect.y, polLeaveRect.w, polLeaveRect.h,
            "🚪 LEAVE", { bg: "#EF5350", bgDark: "#B71C1C", small: true });
        // ── SETTLE-CHARGES service button (the useful reason to be here) ──
        if (polServiceRect) {
            var wanted = (typeof isWanted === "function" && isWanted());
            var fee = polWantedFee();
            var sState = !wanted ? "done" : (save.totalCoins >= fee ? "ready" : "cant");
            drawFootServiceBtn(polServiceRect, "🧾", wanted ? "SETTLE CHARGES" : "RECORD CLEAN",
                wanted ? ("💰" + fee + " · clear record") : "✓ no charges", sState);
        }

        // ── touch / control hints ──────────────────────────────
        if (isTouchDevice) {
            drawText("Tap the floor to walk · tap a cop/board/perp to chat",
                W / 2, bottom - 22, "bold 11px Arial", "#FFFFFF", "#1A2A3A", 3);
        } else {
            drawText("Walk up to people & props to talk · 🚪 to leave",
                W / 2, bottom - 22, "bold 11px Arial", "#FFFFFF", "#1A2A3A", 3);
        }
    }

    function polDrawBanner() {
        ctx.save();
        ctx.translate(0, SAFE_TOP);
        var bw = 320, bx = (W - bw) / 2;
        ctx.fillStyle = "rgba(20,30,45,0.85)";
        roundRect(bx, 8, bw, 38, 10); ctx.fill();
        ctx.strokeStyle = "#FFD54F"; ctx.lineWidth = 2;
        roundRect(bx, 8, bw, 38, 10); ctx.stroke();
        drawText("🚓 PRECINCT 18½ — POLICE", W / 2, 27,
            "bold 17px 'Segoe UI', Arial", "#FFD54F", "#000", 4);
        ctx.restore();
    }

    function polDrawBoard(cx, cy) {
        ctx.save();
        ctx.translate(cx, cy);
        // a buzzing fluorescent spotlight pooling on the board (flickers)
        ctx.save();
        ctx.globalAlpha = 0.18 * polFlick;
        var bgGlow = ctx.createRadialGradient(0, 50, 4, 0, 50, 70);
        bgGlow.addColorStop(0, "#FFF59D");
        bgGlow.addColorStop(1, "rgba(255,245,157,0)");
        ctx.fillStyle = bgGlow;
        ctx.fillRect(-70, -20, 140, 140);
        ctx.globalAlpha = 1;
        ctx.restore();
        // cork board (dimmed by the flicker)
        ctx.globalAlpha = 0.78 + 0.22 * polFlick;
        ctx.fillStyle = "#8D6E45";
        roundRect(-46, 0, 92, 116, 6); ctx.fill();
        ctx.fillStyle = "#A07C4F";
        roundRect(-42, 4, 84, 108, 4); ctx.fill();
        ctx.globalAlpha = 1;
        drawText("MOST", 0, 16, "bold 13px Arial", "#3A2A12", null, 0);
        drawText("WANTED", 0, 30, "bold 13px Arial", "#3A2A12", null, 0);
        // sasquatch mugshot poster
        ctx.fillStyle = "#FFF8E1"; roundRect(-34, 40, 30, 40, 3); ctx.fill();
        ctx.fillStyle = "#6D4C2F";
        ctx.beginPath(); ctx.arc(-19, 56, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(-19, 56, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(-21, 55, 1, 0, Math.PI * 2); ctx.arc(-17, 55, 1, 0, Math.PI * 2); ctx.fill();
        drawText("$200", -19, 74, "bold 7px Arial", "#B71C1C", null, 0);
        // Heshy poster (pool menace)
        ctx.fillStyle = "#FFF8E1"; roundRect(4, 40, 30, 40, 3); ctx.fill();
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(19, 55, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#2E7D32"; // swim cap
        ctx.beginPath(); ctx.arc(19, 51, 7, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(17, 55, 1, 0, Math.PI * 2); ctx.arc(21, 55, 1, 0, Math.PI * 2); ctx.fill();
        drawText("HESHY", 19, 74, "bold 6px Arial", "#B71C1C", null, 0);
        // Real online fugitive (from the async board) pinned below the gag posters,
        // with their top charge. Silent fallback to just the gags when no data.
        if (typeof mpWantedList === "function") {
            try {
                var rmw = mpWantedList();
                if (rmw && rmw.length && rmw[0] && rmw[0].name) {
                    var rmwe = rmw[0];
                    ctx.fillStyle = "#FFF8E1"; roundRect(-40, 86, 80, 24, 2); ctx.fill();
                    ctx.fillStyle = "#E53935"; ctx.beginPath(); ctx.arc(0, 88, 1.6, 0, Math.PI * 2); ctx.fill();
                    // A little booking-photo mugshot for the real fugitive, pinned at
                    // the left; name + top charge sit to its right.
                    var rmHasMug = (typeof drawMugshot === "function");
                    if (rmHasMug) { try { drawMugshot(rmwe.name, -28, 98, 18); } catch (e) { rmHasMug = false; } }
                    var rmTx = rmHasMug ? 9 : 0, rmMaxW = rmHasMug ? 54 : 74;
                    var rmName = ("" + rmwe.name).toUpperCase(), nfs = 7;
                    ctx.font = "bold " + nfs + "px Arial";
                    while (nfs > 5 && ctx.measureText(rmName).width > rmMaxW) { nfs -= 0.5; ctx.font = "bold " + nfs + "px Arial"; }
                    drawText(rmName, rmTx, 95, "bold " + nfs + "px Arial", "#4A1A0A", null, 0);
                    var rmChg = (rmwe.charges && rmwe.charges.length) ? ("" + rmwe.charges[0]) : "AT LARGE", cfs = 5;
                    ctx.font = "bold " + cfs + "px Arial";
                    while (cfs > 4 && ctx.measureText(rmChg).width > rmMaxW) { cfs -= 0.5; ctx.font = "bold " + cfs + "px Arial"; }
                    drawText(rmChg, rmTx, 104, "bold " + cfs + "px Arial", "#B71C1C", null, 0);
                }
            } catch (e) {}
        }
        // pin glints
        ctx.fillStyle = "#E53935";
        ctx.beginPath(); ctx.arc(-19, 41, 2, 0, Math.PI * 2); ctx.arc(19, 41, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function polDrawCoffee(cx, floorY) {
        ctx.save();
        ctx.translate(cx, floorY);
        // machine body
        ctx.fillStyle = "#37474F";
        roundRect(-22, -96, 44, 96, 6); ctx.fill();
        ctx.fillStyle = "#546E7A";
        roundRect(-18, -92, 36, 40, 4); ctx.fill();
        drawText("☕", 0, -72, "bold 20px Arial", "#FFE0B2", null, 0);
        // drip spout + cup
        ctx.fillStyle = "#263238"; ctx.fillRect(-6, -52, 12, 6);
        ctx.fillStyle = "#FFFFFF"; roundRect(-7, -44, 14, 12, 2); ctx.fill();
        // steam (gentle, alpha-safe, two curling wisps)
        ctx.globalAlpha = 0.30 + 0.18 * Math.sin(polTime * 3);
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(Math.sin(polTime * 2) * 2, -50 - (polTime * 14 % 16), 3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.22 + 0.14 * Math.sin(polTime * 3 + 1.5);
        ctx.beginPath(); ctx.arc(3 + Math.sin(polTime * 2.5 + 1) * 2, -54 - (polTime * 11 % 14), 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // capped ambient steam particles (a few per ~0.18s)
        polSteamCool -= (1 / 60);
        if (polSteamCool <= 0 && particles.length < 220) {
            polSteamCool = 0.18;
            particles.push({
                x: cx + rand(-3, 3), y: floorY - 44,
                vx: rand(-6, 6), vy: rand(-26, -16),
                life: 0, maxLife: 1.1, size: rand(2, 4),
                color: "rgba(255,255,255,0.5)", gravity: -8
            });
        }
        // buttons
        ctx.fillStyle = "#FFB300"; ctx.beginPath(); ctx.arc(-10, -20, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#43A047"; ctx.beginPath(); ctx.arc(10, -20, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function polDrawConfession(cx, floorY) {
        ctx.save();
        ctx.translate(cx, floorY);
        // little wooden booth
        ctx.fillStyle = "#5D4037";
        roundRect(-30, -108, 60, 108, 6); ctx.fill();
        ctx.fillStyle = "#6D4C41";
        roundRect(-26, -100, 52, 64, 4); ctx.fill();
        // lattice screen
        ctx.strokeStyle = "#3E2723"; ctx.lineWidth = 2;
        for (var g = -20; g <= 20; g += 10) {
            ctx.beginPath(); ctx.moveTo(g, -96); ctx.lineTo(g, -42); ctx.stroke();
        }
        for (var gy = -90; gy <= -48; gy += 10) {
            ctx.beginPath(); ctx.moveTo(-24, gy); ctx.lineTo(24, gy); ctx.stroke();
        }
        // curtain
        ctx.fillStyle = "#7B1FA2"; roundRect(-26, -36, 52, 36, 3); ctx.fill();
        drawText("CONFESS", 0, -118, "bold 9px Arial", "#FFD54F", "#000", 3);
        ctx.restore();
    }

    function polDrawCell(cx, floorY) {
        ctx.save();
        ctx.translate(cx, floorY);
        // cell back
        ctx.fillStyle = "#2E3B47";
        roundRect(-46, -118, 92, 118, 4); ctx.fill();
        // cot
        ctx.fillStyle = "#455A64"; roundRect(-42, -40, 34, 36, 3); ctx.fill();
        ctx.fillStyle = "#90A4AE"; roundRect(-42, -44, 34, 8, 3); ctx.fill();
        // the goofy perp (striped shirt, paces side-to-side + bob + blink)
        var bob = Math.sin(polTime * 2) * 2;
        var pace = Math.sin(polPerpPace) * 16;       // walks the cell
        var rattle = (Math.sin(polPerpPace) > 0.92) ? Math.sin(polTime * 40) * 1.2 : 0;
        ctx.save();
        ctx.translate(pace, -28 + bob);
        ctx.fillStyle = "#FAFAFA"; // body
        roundRect(-12, -8, 24, 30, 6); ctx.fill();
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 2; // stripes
        for (var st = -4; st <= 18; st += 7) {
            ctx.beginPath(); ctx.moveTo(-12, st); ctx.lineTo(12, st); ctx.stroke();
        }
        ctx.fillStyle = "#FFE0CC"; // head
        ctx.beginPath(); ctx.arc(0, -16, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3E2723"; // hair
        ctx.beginPath(); ctx.arc(0, -20, 10, Math.PI, Math.PI * 2); ctx.fill();
        // eyes (blink)
        var blink = (polPerpBlink % 3.4) < 0.12;
        ctx.fillStyle = "#000";
        if (blink) {
            ctx.fillRect(-5, -16, 3, 1); ctx.fillRect(2, -16, 3, 1);
        } else {
            ctx.beginPath(); ctx.arc(-3.5, -16, 1.4, 0, Math.PI * 2); ctx.arc(3.5, -16, 1.4, 0, Math.PI * 2); ctx.fill();
        }
        // goofy grin
        ctx.strokeStyle = "#A0394D"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0, -11, 4, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        ctx.restore();
        // bars (vertical) — drawn over the perp; rattle when he grips them
        ctx.strokeStyle = "#CFD8DC"; ctx.lineWidth = 4; ctx.lineCap = "round";
        for (var b = -42; b <= 42; b += 12) {
            var br = (rattle && Math.abs(b - pace) < 18) ? rattle : 0;
            ctx.beginPath(); ctx.moveTo(b + br, -118); ctx.lineTo(b + br, 0); ctx.stroke();
        }
        ctx.lineCap = "butt";
        // top + bottom rails
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(-46, -116); ctx.lineTo(46, -116); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-46, -2); ctx.lineTo(46, -2); ctx.stroke();
        drawText("HOLDING", 0, -128, "bold 9px Arial", "#CFD8DC", "#000", 3);
        ctx.restore();
    }

    function polDrawDesk(cx, floorY) {
        ctx.save();
        ctx.translate(cx, floorY);
        // the donut cop sitting behind the desk
        var munch = (Math.sin(polCopMunch) > 0.4) ? 1 : 0; // mouth open on chew
        ctx.save();
        ctx.translate(0, -54);
        // torso (navy uniform)
        ctx.fillStyle = "#1A237E";
        roundRect(-18, 0, 36, 30, 8); ctx.fill();
        // badge
        ctx.fillStyle = "#FFD700";
        ctx.beginPath();
        for (var p = 0; p < 5; p++) {
            var a0 = -Math.PI / 2 + p * (Math.PI * 2 / 5);
            ctx.lineTo(-8 + Math.cos(a0) * 5, 8 + Math.sin(a0) * 5);
            var a1 = a0 + Math.PI / 5;
            ctx.lineTo(-8 + Math.cos(a1) * 2.2, 8 + Math.sin(a1) * 2.2);
        }
        ctx.closePath(); ctx.fill();
        // head
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(0, -14, 11, 0, Math.PI * 2); ctx.fill();
        // police cap
        ctx.fillStyle = "#1A237E";
        ctx.beginPath(); ctx.arc(0, -19, 11, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillRect(-11, -19, 22, 3);
        ctx.fillStyle = "#0D1442"; ctx.fillRect(-12, -16, 24, 3); // brim
        ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.arc(0, -22, 2, 0, Math.PI * 2); ctx.fill();
        // eyes
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(-4, -14, 1.5, 0, Math.PI * 2); ctx.arc(4, -14, 1.5, 0, Math.PI * 2); ctx.fill();
        // mouth (chewing)
        ctx.fillStyle = munch ? "#5D2A2A" : "#A0394D";
        if (munch) { ctx.beginPath(); ctx.arc(0, -8, 2.5, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.strokeStyle = "#A0394D"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, -9, 3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke(); }
        // donut in hand
        ctx.save();
        ctx.translate(15, -2 + Math.sin(polCopMunch / 2) * 1.5);
        ctx.fillStyle = "#E8A05A"; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#F06292"; ctx.beginPath(); ctx.arc(0, 0, 6, Math.PI, Math.PI * 2); ctx.fill(); // frosting
        ctx.fillStyle = "#3E5871"; ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill(); // hole
        ctx.restore();
        ctx.restore();

        // desk (front counter) — drawn OVER the cop's lower half
        ctx.fillStyle = "#5D4037";
        roundRect(-58, -24, 116, 44, 6); ctx.fill();
        ctx.fillStyle = "#795548";
        roundRect(-58, -24, 116, 10, 6); ctx.fill();
        // nameplate
        ctx.fillStyle = "#263238"; roundRect(-30, -8, 60, 14, 3); ctx.fill();
        drawText("FRONT DESK", 0, -1, "bold 9px Arial", "#FFD54F", null, 0);
        // little desk bell
        ctx.fillStyle = "#FFC107";
        ctx.beginPath(); ctx.arc(42, -26, 6, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillRect(36, -26, 12, 2);
        ctx.fillStyle = "#FFE082"; ctx.beginPath(); ctx.arc(42, -33, 1.6, 0, Math.PI * 2); ctx.fill();

        // ringing rotary phone (shudders + emits ring marks when ringing)
        var ring = (polPhoneT > 0) ? Math.sin(polTime * 40) * 1.5 : 0;
        ctx.save();
        ctx.translate(-44 + ring, -26);
        ctx.fillStyle = "#212B33"; roundRect(-9, -5, 18, 12, 3); ctx.fill();      // base
        ctx.fillStyle = "#37474F"; roundRect(-11, -10, 22, 6, 3); ctx.fill();     // handset
        ctx.fillStyle = "#90A4AE"; ctx.beginPath(); ctx.arc(0, 1, 4, 0, Math.PI * 2); ctx.fill(); // dial
        if (polPhoneT > 0) {
            ctx.fillStyle = "#FFD54F";
            drawText("♪", -14, -12, "bold 10px Arial", "#FFD54F", null, 0);
            drawText("♪", 14, -14, "bold 9px Arial", "#FFE082", null, 0);
        }
        ctx.restore();
        ctx.restore();
    }

    // ════════════════════════════════════════════════════════════
    //  BEACH — "SHTRAND-BY-THE-SEA BOARDWALK"
    // ════════════════════════════════════════════════════════════
    var bchTime = 0;
    var bchLuluX = 90, bchLuluTargetX = 90, bchWalkT = 0, bchFacing = 1;
    var bchSandY = 0, bchSeaY = 0;
    var bchBubble = "", bchBubbleT = 0, bchBubbleX = 0;
    var bchSpots = [];
    var bchLeaveRect = null;
    var bchServiceRect = null;   // "rest & heal in the sun" service button
    var bchGulls = [];
    var bchHeshyT = 0;            // Heshy bob phase
    // — cached gradients / precomputed layout (built ONCE in init) —
    var bchSkyGrad = null, bchSeaGrad = null, bchSandGrad = null, bchSunGlow = null;
    var bchWaveX = [];           // precomputed wave sample x-coords
    var bchScratchY = [];        // reusable y scratch buffer for wave paths
    var bchSpeckles = [];        // static sand speckle positions
    var bchDunes = [];           // parallax dune layer params
    var bchClouds = [];          // parallax clouds
    var bchGlints = [];          // static sun-glint seeds on the water
    var bchSandCool = 0;         // throttle blowing-sand particles
    // dynamic props
    var bchBall = null;          // bouncing beach ball
    var bchKiteT = 0;            // kite sway
    var bchHeshyCannon = 0;      // >0 = mid-cannonball splash anim
    var bchHeshyCool = 0;        // cooldown to next cannonball
    var bchLifeScan = 0;         // lifeguard binocular scan phase
    var bchLuluShade = 0;        // Lulu shields eyes from sun (timer)
    var bchBigWaveT = 0;         // periodic high wash-up wave
    var bchBigWaveCool = 0;

    function initBeachInterior() {
        bchTime = 0;
        bchSeaY = (H * 0.30);
        bchSandY = (H * 0.46);
        bchLuluX = 90; bchLuluTargetX = 90; bchWalkT = 0; bchFacing = 1;
        bchBubble = ""; bchBubbleT = 0;
        bchHeshyT = 0;
        bchBands = null; // rebuilt lazily on first draw (depends on sea/sand Y)
        bchKiteT = 0; bchLifeScan = 0; bchLuluShade = rand(3, 7);
        bchHeshyCannon = 0; bchHeshyCool = rand(5, 9);
        bchBigWaveT = 0; bchBigWaveCool = rand(7, 12);
        bchSandCool = 0;

        // cache gradients ONCE
        bchSkyGrad = ctx.createLinearGradient(0, 0, 0, bchSeaY);
        bchSkyGrad.addColorStop(0, "#4FC3F7");
        bchSkyGrad.addColorStop(1, "#B3E5FC");
        bchSeaGrad = ctx.createLinearGradient(0, bchSeaY, 0, bchSandY);
        bchSeaGrad.addColorStop(0, "#0288D1");
        bchSeaGrad.addColorStop(1, "#4DD0E1");
        bchSandGrad = ctx.createLinearGradient(0, bchSandY, 0, H - SAFE_BOTTOM);
        bchSandGrad.addColorStop(0, "#FFE8B0");
        bchSandGrad.addColorStop(1, "#F4D08A");
        bchSunGlow = ctx.createRadialGradient(W - 70, 70, 18, W - 70, 70, 120);
        bchSunGlow.addColorStop(0, "rgba(255,245,157,0.55)");
        bchSunGlow.addColorStop(1, "rgba(255,245,157,0)");

        // precompute wave sample x-coords + scratch buffer (reused each frame)
        bchWaveX = []; bchScratchY = [];
        for (var x = -20; x <= W + 20; x += 6) { bchWaveX.push(x); bchScratchY.push(0); }

        // static sand speckles (no per-frame random => no flicker, no GC)
        bchSpeckles = [];
        var bottomY = H - SAFE_BOTTOM;
        for (var sp2 = 0; sp2 < 46; sp2++) {
            bchSpeckles.push({ x: (sp2 * 53) % W, y: bchSandY + ((sp2 * 37) % (bottomY - bchSandY)) });
        }

        // static sun-glint seeds on the water (twinkle via phase, not random)
        bchGlints = [];
        for (var gl = 0; gl < 22; gl++) {
            bchGlints.push({
                x: rand(W * 0.45, W - 20),
                y: rand(bchSeaY + 6, bchSandY - 10),
                ph: rand(0, Math.PI * 2), sz: rand(1, 2.4)
            });
        }

        // parallax dunes (far + near) — drawn as static silhouettes
        bchDunes = [
            { y: bchSandY + 20, h: 26, col: "#EFD79A", off: -30 },
            { y: bchSandY + 52, h: 34, col: "#E6C77F", off: 40 }
        ];

        // parallax clouds (drift)
        bchClouds = [];
        for (var cl = 0; cl < 4; cl++) {
            bchClouds.push({ x: rand(0, W), y: rand(24, bchSeaY - 30), s: rand(0.7, 1.4), v: rand(4, 10) });
        }

        // bouncing beach ball (physics-lite, stays on the sand)
        bchBall = { x: 200, y: bchSandY + 30, vx: rand(30, 60), vy: 0, r: 12, spin: 0 };

        bchGulls = [];
        for (var g = 0; g < 4; g++) {
            bchGulls.push({ x: rand(0, W), y: rand(40, bchSeaY - 10), vx: rand(18, 34) * (g % 2 ? 1 : -1), flap: rand(0, 6) });
        }

        bchSpots = [
            {
                id: "lifeguard", x: 360, r: 70, rewarded: false, reward: false,
                label: "Lifeguard", _last: -1,
                lines: [
                    "No running on the boardwalk! ...Okay a little jog. Fine.",
                    "Sunscreen check! SPF 50 or you answer to your bubbe.",
                    "Rip current's mild today. The DRAMA current, though — wild.",
                    "I rescued a beach ball earlier. True hero work.",
                    "If you see a 7-foot swimmer, that's not a wave. That's Heshy.",
                    "Whistle's just for show. I mostly point dramatically.",
                    "Stay hydrated! Lemonade counts. Ice cream... debatable.",
                    "I've got my eye on those seagulls. They KNOW what they did.",
                    "Shark? Nah. That's just Heshy doing the breaststroke. Badly.",
                    "Beach closes at sundown for Shabbos. Tide's been told.",
                    "Buddy system, hon. Where's your buddy? ...the seagull? No.",
                    "I'm 90% lifeguard, 10% sandcastle inspector.",
                    "*scans with binoculars* ...yep, that's still Heshy. Floating.",
                    "Kite's flying low. Somebody tell the seagull it's not lunch.",
                    "Beach ball's loose again. Third escape this hour. Tenacious.",
                    "I count heads every ten minutes. Heshy counts as three."
                ]
            },
            {
                id: "icecream", x: 150, r: 64, rewarded: false, reward: true,
                label: "Ice Cream Stand", _last: -1,
                lines: [
                    "One cone, on the house! Found 25 coins under the cart!",
                    "Free scoop + the tip jar tipped YOU 25 coins. Cool day!",
                    "Vanilla? Got it. And 25 coins fell out the change drawer!",
                    "Rainbow sprinkles AND 25 coins? Best beach day ever!",
                    "Cone's free 'cause it's melting fast — and here's 25 coins!"
                ]
            },
            {
                id: "gull", x: 255, r: 56, rewarded: false, reward: false,
                label: "Sneaky Seagull", _last: -1,
                lines: [
                    "MINE. MINE. MINE. (It took your imaginary fries.)",
                    "The seagull eyes your snack. You have no snack. It's furious.",
                    "It stole a chip from someone three towels over. Legend.",
                    "SQUAWK. Translation: 'gimme the bagel, lady.'",
                    "This gull has committed more crimes than the perp downtown.",
                    "It's not a seagull. It's a feathered tax collector.",
                    "You blink. Your hot dog is gone. It was always gone.",
                    "The gull tilts its head. It's planning something. Run.",
                    "Beach rule #1: never make eye contact with the seagull.",
                    "It dropped a fry on you as tribute. ...or an insult.",
                    "SQUAWK SQUAWK (it's just saying 'good shabbos,' probably).",
                    "It's eyeing the kite. It thinks the kite is a giant rival gull.",
                    "It chased the beach ball into the surf. Bold. Wet. Foolish.",
                    "Four gulls just flew off in formation. This one's the general."
                ]
            },
            {
                id: "castle", x: 60, r: 52, rewarded: false, reward: false,
                label: "Sandcastle Kids", _last: -1,
                lines: [
                    "Kids: \"It's a SHUL made of sand! No shoes inside!\"",
                    "\"We built a moat! It's for the crabs to do laps!\"",
                    "\"Don't step on the east wing, that's the kiddush room!\"",
                    "\"The tower fell. We're calling it 'modern art' now.\"",
                    "\"A wave ate the drawbridge. We blame Heshy.\"",
                    "\"This bucket is our hard hat AND our crown.\"",
                    "\"We need 9 more castles for a minyan of castles!\"",
                    "\"Wanna help? You can be in charge of the seashell windows.\"",
                    "\"Mom said one more hour. We're building a SECOND castle.\"",
                    "\"It's not sand in your sandwich. It's seasoning.\""
                ]
            },
            {
                id: "heshy", x: 420, r: 60, rewarded: false, reward: false,
                label: "Heshy (in the water)", _last: -1,
                lines: [
                    "Heshy: \"CANNONBALL!\" (There is no diving board. He found a way.)",
                    "\"Look, Lulu, no hands!\" (He is doing a doggy paddle. Slowly.)",
                    "\"The ocean's basically a giant kiddie pool, change my mind!\"",
                    "\"I'm not lost, I'm exploring! ...which way's the shore?\"",
                    "\"Watch this!\" *belly flop* *seagulls applaud sarcastically*",
                    "\"I brought floaties for my floaties. Safety first!\"",
                    "\"The lifeguard keeps whistling at me. I think she's a fan.\"",
                    "\"Tell Bubbe I'll be there for dinner — soon as I find my towel.\"",
                    "\"I caught a fish! ...with my swim trunks. It's still in there.\"",
                    "\"Marco! ...Polo? ...anyone? ...I'm just gonna float here.\"",
                    "\"CANNONBALL incoming — cover your snacks!\" *KERSPLASH*",
                    "\"The waves keep pushing me back. I think they're shy.\"",
                    "\"I'm doing the backstroke! ...into the buoy. Repeatedly.\"",
                    "\"Is that a beach ball or my lunch? Only one way to find out.\""
                ]
            }
        ];
    }

    function updateBeachInterior(dt) {
        bchTime += dt;
        bchHeshyT += dt;
        bchKiteT += dt;
        bchLifeScan += dt;
        bchLuluShade -= dt;
        if (bchLuluShade < -1.2) bchLuluShade = rand(4, 8);
        if (bchBubbleT > 0) bchBubbleT -= dt;

        var bottom = H - SAFE_BOTTOM;

        // gulls drift + wrap
        for (var i = 0; i < bchGulls.length; i++) {
            var gl = bchGulls[i];
            gl.x += gl.vx * dt; gl.flap += dt * 9;
            gl.y += Math.sin(bchTime * 1.5 + i) * 6 * dt;
            if (gl.x < -20) gl.x = W + 20;
            if (gl.x > W + 20) gl.x = -20;
        }

        // clouds drift (parallax)
        for (var ci = 0; ci < bchClouds.length; ci++) {
            var cd = bchClouds[ci];
            cd.x += cd.v * dt;
            if (cd.x > W + 60) cd.x = -60;
        }

        // bouncing beach ball physics (lives on the sand band)
        if (bchBall) {
            bchBall.vy += 520 * dt;
            bchBall.x += bchBall.vx * dt;
            bchBall.y += bchBall.vy * dt;
            bchBall.spin += bchBall.vx * dt * 0.05;
            var floor = bchSandY + 40;
            if (bchBall.y > floor) { bchBall.y = floor; bchBall.vy = -rand(180, 240); }
            if (bchBall.x < 40) { bchBall.x = 40; bchBall.vx = Math.abs(bchBall.vx); }
            if (bchBall.x > W - 40) { bchBall.x = W - 40; bchBall.vx = -Math.abs(bchBall.vx); }
        }

        // Heshy cannonball cycle (periodic big splash)
        if (bchHeshyCannon > 0) {
            bchHeshyCannon -= dt;
        } else {
            bchHeshyCool -= dt;
            if (bchHeshyCool <= 0) {
                bchHeshyCool = rand(6, 11);
                bchHeshyCannon = 0.7;
                playTone(160, 0.18, "sine", 0.06, 90);
                var splashY = bchSeaY + (bchSandY - bchSeaY) * 0.5;
                for (var sk = 0; sk < 12; sk++) {
                    particles.push({
                        x: 420 + rand(-10, 10), y: splashY,
                        vx: rand(-90, 90), vy: rand(-180, -70),
                        life: 0, maxLife: 0.7, size: rand(2, 5),
                        color: randPick(["#FFFFFF", "#B3E5FC", "#4FC3F7"]), gravity: 420
                    });
                }
            }
        }

        // periodic high wave that washes further up the sand
        if (bchBigWaveT > 0) {
            bchBigWaveT -= dt;
        } else {
            bchBigWaveCool -= dt;
            if (bchBigWaveCool <= 0) { bchBigWaveCool = rand(8, 14); bchBigWaveT = 2.4; }
        }

        bchLeaveRect = { x: W - 122, y: bottom - 64, w: 110, h: 50 };
        bchServiceRect = { x: 12, y: bottom - 124, w: 168, h: 52 };   // stacked above the BOARDWALK exit

        var c = consumeClick();
        if (c) {
            // REST & HEAL service: a lie-down in the sun patches her hearts back up
            if (pointInRect(c.x, c.y, bchServiceRect.x, bchServiceRect.y, bchServiceRect.w, bchServiceRect.h)) {
                bchRestHeal(); return;
            }
            if (pointInRect(c.x, c.y, bchLeaveRect.x, bchLeaveRect.y, bchLeaveRect.w, bchLeaveRect.h)) {
                playClick(); exitFootInterior(); return;
            }
            // boardwalk archway exit (bottom-left "← BOARDWALK")
            if (pointInRect(c.x, c.y, 12, bottom - 64, 110, 50)) {
                playClick(); exitFootInterior(); return;
            }
            // NEW interaction: bop the beach ball (it bounces up + chirps)
            if (bchBall && Math.abs(c.x - bchBall.x) < 26 && Math.abs(c.y - bchBall.y) < 26) {
                bchBall.vy = -rand(280, 360);
                bchBall.vx = (c.x < bchBall.x ? 1 : -1) * rand(60, 120);
                playTone(660, 0.07, "sine", 0.1, 880);
                spawnFloater(bchBall.x, bchBall.y - 18, randPick(["boing!", "bonk!", "whee!"]), "#FF80AB");
                return;
            }
            var hit = null;
            for (var s = 0; s < bchSpots.length; s++) {
                var sp = bchSpots[s];
                if (Math.abs(c.x - sp.x) < sp.r && c.y < bottom - 70) { hit = sp; break; }
            }
            if (hit) {
                bchLuluTargetX = clamp(hit.x - 40, 60, W - 60);
                bchFacing = (hit.x >= bchLuluX) ? 1 : -1;
                bchTrigger(hit);
            } else {
                bchLuluTargetX = clamp(c.x, 50, W - 40);
                bchFacing = (c.x >= bchLuluX) ? 1 : -1;
            }
        }

        for (var j = 0; j < bchSpots.length; j++) {
            var q = bchSpots[j];
            if (Math.abs(bchLuluX + 40 - q.x) < 28 && bchBubbleT <= 0) bchTrigger(q);
        }

        var dx = bchLuluTargetX - bchLuluX;
        if (Math.abs(dx) > 2) {
            bchLuluX += clamp(dx, -200 * dt, 200 * dt);
            bchWalkT += dt;
        }
    }

    var BCH_HEAL_FEE = 40;
    // The genuinely USEFUL reason to hit the beach: a rest in the sun patches
    // her hearts back to full before her next drive.
    function bchRestHeal() {
        if (typeof lives !== "undefined" && lives >= MAX_LIVES) {
            bchBubble = randPick(["You're already fresh as a daisy, mamaleh.", "Hearts are full — go enjoy the waves!"]);
            bchBubbleT = 2.8; bchBubbleX = W / 2; playClick(); return;
        }
        if (save.totalCoins < BCH_HEAL_FEE) {
            bchBubble = "A cabana costs coins, bubbeleh. Come back richer.";
            bchBubbleT = 2.8; bchBubbleX = W / 2; playDeny(); return;
        }
        chargeCoins(BCH_HEAL_FEE);
        if (typeof lives !== "undefined") lives = Math.max(lives, MAX_LIVES);
        bchBubble = "Ahhh. Sun, sea, and full hearts. Drive safe now!";
        bchBubbleT = 3.0; bchBubbleX = W / 2;
        spawnFloater(W / 2, bchSandY, "❤ rested — hearts refilled!", "#FF80AB");
        playCoin();
        for (var k = 0; k < 12; k++) particles.push({ x: W / 2 + rand(-26, 26), y: bchSandY,
            vx: rand(-40, 40), vy: rand(-110, -40), life: 0, maxLife: 0.8, size: rand(3, 6),
            color: randPick(["#FF80AB", "#FFFFFF", "#FF4081"]), gravity: 220 });
    }

    function bchTrigger(spot) {
        bchBubble = bchPickLine(spot);
        bchBubbleT = 2.6;
        bchBubbleX = spot.x;
        playClick();
        if (spot.reward && !spot.rewarded) {
            spot.rewarded = true;
            footCoinsRun += 25; runCoins += 25; save.totalCoins += 25; persistSave();
            footAwardStar(); // a little beach-day star too
            spawnFloater(spot.x, bchSandY + 30, "+25 ⭐", "#FFD700");
            playCoin();
            playTone(880, 0.12, "sine", 0.12, 1320);
            for (var k = 0; k < 14; k++) {
                particles.push({
                    x: spot.x, y: bchSandY + 20,
                    vx: rand(-60, 60), vy: rand(-150, -50),
                    life: 0, maxLife: 0.8, size: rand(3, 6),
                    color: randPick(["#FFD700", "#FF80AB", "#4FC3F7", "#FFF8B0"]), gravity: 280
                });
            }
        }
    }

    function drawBeachInterior() {
        var bottom = H - SAFE_BOTTOM;
        var seaY = bchSeaY, sandY = bchSandY;

        // ── sky (cached gradient) ──────────────────────────────
        ctx.fillStyle = bchSkyGrad;
        ctx.fillRect(0, 0, W, seaY);

        // parallax clouds (soft, behind sun)
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        for (var cl = 0; cl < bchClouds.length; cl++) {
            var cd = bchClouds[cl];
            ctx.globalAlpha = 0.6;
            var cr = 14 * cd.s;
            ctx.beginPath();
            ctx.arc(cd.x, cd.y, cr, 0, Math.PI * 2);
            ctx.arc(cd.x + cr, cd.y + 3, cr * 0.8, 0, Math.PI * 2);
            ctx.arc(cd.x - cr, cd.y + 4, cr * 0.7, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // sun + glow (cached radial) + glowing rays
        ctx.save();
        ctx.fillStyle = bchSunGlow;
        ctx.fillRect(W - 190, -50, 240, 240);
        ctx.fillStyle = "#FFEE58";
        ctx.beginPath(); ctx.arc(W - 70, 70, 30, 0, Math.PI * 2); ctx.fill();
        // slow-turning rays
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = "#FFF59D"; ctx.lineWidth = 3; ctx.lineCap = "round";
        for (var ray = 0; ray < 8; ray++) {
            var ra = bchTime * 0.2 + ray * (Math.PI / 4);
            ctx.beginPath();
            ctx.moveTo(W - 70 + Math.cos(ra) * 36, 70 + Math.sin(ra) * 36);
            ctx.lineTo(W - 70 + Math.cos(ra) * 48, 70 + Math.sin(ra) * 48);
            ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.lineCap = "butt";
        ctx.restore();

        // ── ocean (cached gradient) ────────────────────────────
        ctx.fillStyle = bchSeaGrad;
        ctx.fillRect(0, seaY, W, sandY - seaY);

        // sun glints on the water (twinkle via phase — no per-frame random)
        ctx.save();
        ctx.fillStyle = "#FFFDE7";
        for (var gn = 0; gn < bchGlints.length; gn++) {
            var gp = bchGlints[gn];
            var tw = 0.5 + 0.5 * Math.sin(bchTime * 3 + gp.ph);
            ctx.globalAlpha = 0.15 + 0.5 * tw;
            ctx.fillRect(gp.x, gp.y, gp.sz + tw, 1.4);
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // three parallax wave layers (alpha-safe — reset after)
        bchDrawWaves(seaY, sandY);

        // ── wet-sand shoreline + beach (cached gradient) ───────
        // periodic high wave washes the wet line further up the sand
        var washUp = (bchBigWaveT > 0) ? Math.sin((2.4 - bchBigWaveT) / 2.4 * Math.PI) * 18 : 0;
        ctx.fillStyle = "#FFE0A3"; // wet line
        ctx.fillRect(0, sandY - 6 - washUp * 0.4, W, 6 + washUp * 0.4);
        ctx.fillStyle = bchSandGrad;
        ctx.fillRect(0, sandY, W, bottom - sandY);

        // parallax dunes (depth on the sand)
        for (var dn = 0; dn < bchDunes.length; dn++) {
            var du = bchDunes[dn];
            ctx.fillStyle = du.col;
            ctx.beginPath();
            ctx.moveTo(0, du.y + du.h);
            for (var dx = 0; dx <= W; dx += 40) {
                ctx.lineTo(dx, du.y + Math.sin((dx + du.off) / 90) * du.h);
            }
            ctx.lineTo(W, du.y + du.h);
            ctx.closePath(); ctx.fill();
        }

        // wash-up foam sheet when the big wave rolls in
        if (washUp > 0.5) {
            ctx.save();
            ctx.globalAlpha = clamp(washUp / 18, 0, 1) * 0.5;
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, sandY - 2, W, washUp);
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // static speckles (precomputed)
        ctx.fillStyle = "rgba(180,140,80,0.35)";
        for (var sp2 = 0; sp2 < bchSpeckles.length; sp2++) {
            ctx.fillRect(bchSpeckles[sp2].x, bchSpeckles[sp2].y, 2, 2);
        }

        // ── beach bric-a-brac to fill the lower sand ───────────
        // a striped beach towel
        ctx.save(); ctx.translate(W * 0.28, bottom - 116); ctx.rotate(-0.12);
        ctx.fillStyle = "rgba(0,0,0,0.10)"; ctx.beginPath(); ctx.ellipse(2, 30, 50, 11, 0, 0, Math.PI * 2); ctx.fill();
        for (var ts = 0; ts < 6; ts++) { ctx.fillStyle = ts % 2 ? "#FF5252" : "#FFFDE7"; roundRect(-45 + ts * 15, -26, 15, 56, 2); ctx.fill(); }
        ctx.restore();
        // a beach ball resting on the towel
        ctx.save(); ctx.translate(W * 0.28 + 70, bottom - 132);
        ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.beginPath(); ctx.ellipse(0, 16, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
        var ballCols = ["#E53935", "#FDD835", "#1E88E5", "#43A047"];
        for (var bq = 0; bq < 4; bq++) { ctx.fillStyle = ballCols[bq]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 14, bq * Math.PI / 2, (bq + 1) * Math.PI / 2); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // a starfish
        ctx.save(); ctx.translate(W * 0.72, bottom - 150); ctx.rotate(0.3);
        ctx.fillStyle = "#FF8A65"; ctx.beginPath();
        for (var sf = 0; sf < 5; sf++) { var fa = -Math.PI / 2 + sf * (Math.PI * 2 / 5); ctx.lineTo(Math.cos(fa) * 13, Math.sin(fa) * 13); var fb = fa + Math.PI / 5; ctx.lineTo(Math.cos(fb) * 5.5, Math.sin(fb) * 5.5); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.45)"; for (var sd = 0; sd < 5; sd++) { var fc = -Math.PI / 2 + sd * (Math.PI * 2 / 5); ctx.beginPath(); ctx.arc(Math.cos(fc) * 6, Math.sin(fc) * 6, 1.2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        // a few scattered seashells
        var shells = [[W * 0.5, bottom - 64, "#F8BBD0"], [W * 0.86, bottom - 96, "#FFE0B2"], [W * 0.16, bottom - 44, "#FFCCBC"], [W * 0.62, bottom - 40, "#E1BEE7"]];
        for (var sh = 0; sh < shells.length; sh++) {
            var shx = shells[sh][0], shy = shells[sh][1];
            ctx.fillStyle = shells[sh][2]; ctx.beginPath(); ctx.arc(shx, shy, 8, Math.PI, 0); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = "rgba(120,70,40,0.25)"; ctx.lineWidth = 1;
            for (var rr = 0; rr < 4; rr++) { ctx.beginPath(); ctx.moveTo(shx, shy); ctx.lineTo(shx + Math.cos(Math.PI + rr * Math.PI / 3) * 8, shy + Math.sin(Math.PI + rr * Math.PI / 3) * 8); ctx.stroke(); }
        }

        // blowing sand (capped ambient particles, a few per ~0.12s)
        bchSandCool -= (1 / 60);
        if (bchSandCool <= 0 && particles.length < 230) {
            bchSandCool = 0.12;
            particles.push({
                x: -6, y: sandY + rand(6, bottom - sandY - 6),
                vx: rand(120, 200), vy: rand(-12, 12),
                life: 0, maxLife: rand(1.2, 2.0), size: rand(1, 2),
                color: "rgba(220,190,130,0.6)", gravity: 0
            });
        }

        // heat shimmer band just above the sand (cheap horizontal wobble)
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = "#FFFFFF";
        for (var hs = 0; hs < 3; hs++) {
            var hy = sandY + 8 + hs * 6 + Math.sin(bchTime * 4 + hs) * 1.5;
            ctx.fillRect(0, hy, W, 1.5);
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // ── kite in the sky (string to off-screen) ─────────────
        bchDrawKite();

        // ── beach ball (bouncing) ──────────────────────────────
        if (bchBall) bchDrawBall(bchBall);

        // ── seagulls (behind props, in sky) ────────────────────
        for (var gi = 0; gi < bchGulls.length; gi++) bchDrawGull(bchGulls[gi]);

        // ── umbrellas (parallax-ish depth) ─────────────────────
        bchDrawUmbrella(70, sandY + 26, "#E53935", "#FFFFFF");
        bchDrawUmbrella(W - 60, sandY + 40, "#43A047", "#FFF59D");

        // sunbather on a towel
        bchDrawSunbather(110, sandY + 64);

        // ── Heshy bobbing in the water (x≈420) ─────────────────
        bchDrawHeshy(420, seaY + (sandY - seaY) * 0.5);

        // ── lifeguard tower (x≈360) ────────────────────────────
        bchDrawTower(360, sandY);

        // ── ice cream stand (x≈150) ────────────────────────────
        bchDrawStand(150, sandY + 30);

        // ── sandcastle (x≈60) ──────────────────────────────────
        bchDrawCastle(60, sandY + 70);

        // ── sneaky seagull on the sand (x≈255, the interactable) ─
        bchDrawSandGull(255, sandY + 58);

        // ── Lulu (shields eyes from sun when idle) ─────────────
        var bchLuluY = sandY + 80;
        ctx.save();
        if (bchFacing < 0) {
            ctx.translate(bchLuluX, 0); ctx.scale(-1, 1);
            drawLuluTopDown(0, bchLuluY, bchWalkT, "run");
        } else {
            drawLuluTopDown(bchLuluX, bchLuluY, bchWalkT, "run");
        }
        ctx.restore();
        // a little raised hand shading her eyes (overlay, briefly)
        if (bchLuluShade > 0 && bchLuluShade < 1.4 && Math.abs(bchLuluTargetX - bchLuluX) < 3) {
            ctx.save();
            ctx.strokeStyle = "#FFE0CC"; ctx.lineWidth = 4; ctx.lineCap = "round";
            var hsx = bchLuluX + bchFacing * 6;
            ctx.beginPath(); ctx.moveTo(hsx, bchLuluY - 12); ctx.lineTo(hsx + bchFacing * 8, bchLuluY - 22); ctx.stroke();
            ctx.lineCap = "butt";
            ctx.restore();
        }

        // ── speech bubble ──────────────────────────────────────
        if (bchBubbleT > 0 && bchBubble) {
            drawSpeechBubble(clamp(bchBubbleX, 80, W - 80), sandY + 20, bchBubble, bchTime);
        }

        // ── title banner ───────────────────────────────────────
        bchDrawBanner();

        // ── exits: LEAVE button + boardwalk arch ───────────────
        drawButton(bchLeaveRect.x, bchLeaveRect.y, bchLeaveRect.w, bchLeaveRect.h,
            "🚪 LEAVE", { bg: "#26A69A", bgDark: "#00695C", small: true });
        drawButton(12, bottom - 64, 110, 50, "← BOARDWALK",
            { bg: "#FFB74D", bgDark: "#EF6C00", small: true });
        // ── REST & HEAL service button (the useful reason to be here) ──
        if (bchServiceRect) {
            var full = (typeof lives !== "undefined" && lives >= MAX_LIVES);
            var hState = full ? "done" : (save.totalCoins >= BCH_HEAL_FEE ? "ready" : "cant");
            drawFootServiceBtn(bchServiceRect, "🛟", full ? "FULLY RESTED" : "REST & HEAL",
                full ? "✓ hearts full" : ("💰" + BCH_HEAL_FEE + " · refill ❤"), hState);
        }

        // ── touch / control hints ──────────────────────────────
        if (isTouchDevice) {
            drawText("Tap the sand to stroll · tap people/gulls to chat",
                W / 2, bottom - 8, "bold 11px Arial", "#5D4037", "#FFF8E1", 3);
        } else {
            drawText("Walk up to the lifeguard, stand, gull & castle · 🚪 to leave",
                W / 2, bottom - 8, "bold 11px Arial", "#5D4037", "#FFF8E1", 3);
        }
    }

    function bchDrawBanner() {
        ctx.save();
        ctx.translate(0, SAFE_TOP);
        var bw = 360, bx = (W - bw) / 2;
        ctx.fillStyle = "rgba(2,119,189,0.85)";
        roundRect(bx, 8, bw, 38, 10); ctx.fill();
        ctx.strokeStyle = "#FFF59D"; ctx.lineWidth = 2;
        roundRect(bx, 8, bw, 38, 10); ctx.stroke();
        drawText("🏖️ SHTRAND-BY-THE-SEA — BEACH", W / 2, 27,
            "bold 15px 'Segoe UI', Arial", "#FFF59D", "#01579B", 4);
        ctx.restore();
    }

    // wave bands cached once (params only); paths reuse bchWaveX/bchScratchY
    var bchBands = null;
    function bchDrawWaves(seaY, sandY) {
        if (!bchBands) {
            bchBands = [
                { y: seaY + 8, amp: 4, len: 60, spd: 26, a: 0.30 },
                { y: seaY + (sandY - seaY) * 0.45, amp: 5, len: 80, spd: 18, a: 0.40 },
                { y: sandY - 16, amp: 6, len: 100, spd: 12, a: 0.55 }
            ];
        }
        var xs = bchWaveX, n = xs.length, TWO_PI = Math.PI * 2;
        ctx.save();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        for (var bnd = 0; bnd < bchBands.length; bnd++) {
            var w = bchBands[bnd];
            var phase = bchTime * w.spd, inv = TWO_PI / w.len;
            ctx.globalAlpha = w.a;
            ctx.beginPath();
            for (var k = 0; k < n; k++) {
                var yy = w.y + Math.sin((xs[k] + phase) * inv) * w.amp;
                if (k === 0) ctx.moveTo(xs[k], yy); else ctx.lineTo(xs[k], yy);
            }
            ctx.stroke();
        }
        // foam at the shoreline (no per-iteration allocation)
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = "#FFFFFF";
        for (var fx = 0; fx < W; fx += 18) {
            var fy = sandY - 6 + Math.sin((fx + bchTime * 30) / 40) * 3;
            ctx.beginPath(); ctx.arc(fx, fy, 4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // bouncing beach ball (3-color wedge ball with spin + shadow)
    function bchDrawBall(b) {
        ctx.save();
        // shadow on the sand
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.ellipse(b.x, bchSandY + 42, b.r * 0.9, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.translate(b.x, b.y);
        ctx.rotate(b.spin);
        var cols = ["#EF5350", "#FFFFFF", "#42A5F5", "#FFFFFF", "#FFCA28", "#FFFFFF"];
        for (var s = 0; s < 6; s++) {
            ctx.fillStyle = cols[s];
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, b.r, s * Math.PI / 3, (s + 1) * Math.PI / 3);
            ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }

    // a kite wheeling in the sky on a long string
    function bchDrawKite() {
        var kx = W * 0.30 + Math.sin(bchKiteT * 0.6) * 50;
        var ky = 56 + Math.cos(bchKiteT * 0.9) * 18;
        var ang = Math.sin(bchKiteT * 0.6) * 0.4;
        ctx.save();
        // string down to an off-screen flier near the sand
        ctx.strokeStyle = "rgba(60,40,20,0.5)"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(kx, ky);
        ctx.quadraticCurveTo(kx - 30, ky + 80, W * 0.18, bchSandY + 50);
        ctx.stroke();
        ctx.translate(kx, ky);
        ctx.rotate(ang);
        // diamond kite
        ctx.fillStyle = "#FF7043";
        ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(11, 0); ctx.lineTo(0, 14); ctx.lineTo(-11, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#FFCA28";
        ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(11, 0); ctx.lineTo(0, 0); ctx.lineTo(-11, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#5D4037"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.stroke();
        // tail bows
        ctx.fillStyle = "#26A69A";
        for (var t = 1; t <= 3; t++) {
            ctx.beginPath(); ctx.arc(Math.sin(bchKiteT * 3 + t) * 4, 14 + t * 7, 2.4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    function bchDrawGull(g) {
        ctx.save();
        ctx.translate(g.x, g.y);
        if (g.vx < 0) ctx.scale(-1, 1);
        var flap = Math.sin(g.flap) * 0.5;
        ctx.strokeStyle = "#37474F"; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.quadraticCurveTo(-4, -5 - flap * 6, 0, 0);
        ctx.quadraticCurveTo(4, -5 - flap * 6, 9, 0);
        ctx.stroke();
        ctx.restore();
    }

    function bchDrawSandGull(cx, cy) {
        // a chunkier, interactable seagull standing on the sand
        ctx.save();
        ctx.translate(cx, cy);
        var hop = Math.abs(Math.sin(bchTime * 3)) * 3;
        ctx.translate(0, -hop);
        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath(); ctx.ellipse(0, 16 + hop, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
        // legs
        ctx.strokeStyle = "#FB8C00"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(-3, 15); ctx.moveTo(3, 8); ctx.lineTo(3, 15); ctx.stroke();
        // body
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.ellipse(0, 2, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
        // wing
        ctx.fillStyle = "#CFD8DC";
        ctx.beginPath(); ctx.ellipse(4, 2, 6, 7, 0.3, 0, Math.PI * 2); ctx.fill();
        // head
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(-7, -8, 6, 0, Math.PI * 2); ctx.fill();
        // beak
        ctx.fillStyle = "#FB8C00";
        ctx.beginPath(); ctx.moveTo(-13, -8); ctx.lineTo(-19, -6); ctx.lineTo(-13, -5); ctx.closePath(); ctx.fill();
        // eye (shifty)
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(-8 + Math.sin(bchTime * 2) * 1, -9, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function bchDrawUmbrella(cx, cy, c1, c2) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = "#8D6E63"; ctx.fillRect(-1.5, -2, 3, 34); // pole
        // canopy panels
        var r = 30;
        for (var p = 0; p < 8; p++) {
            ctx.fillStyle = (p % 2 === 0) ? c1 : c2;
            ctx.beginPath();
            ctx.moveTo(0, -2);
            ctx.arc(0, -2, r, Math.PI + p * (Math.PI / 8), Math.PI + (p + 1) * (Math.PI / 8));
            ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = "#5D4037"; ctx.beginPath(); ctx.arc(0, -2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function bchDrawSunbather(cx, cy) {
        ctx.save();
        ctx.translate(cx, cy);
        // towel
        ctx.fillStyle = "#26C6DA"; roundRect(-22, -2, 44, 14, 3); ctx.fill();
        ctx.fillStyle = "#00ACC1"; ctx.fillRect(-22, 3, 44, 3);
        // lounging body
        ctx.fillStyle = "#FFE0CC";
        roundRect(-18, -6, 30, 8, 4); ctx.fill();
        ctx.beginPath(); ctx.arc(14, -2, 5, 0, Math.PI * 2); ctx.fill(); // head
        // sun hat
        ctx.fillStyle = "#FFB300";
        ctx.beginPath(); ctx.ellipse(14, -4, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function bchDrawHeshy(cx, cy) {
        // mid-cannonball: a quick crouch-jump above the waterline
        var cannon = (bchHeshyCannon > 0) ? Math.sin((0.7 - bchHeshyCannon) / 0.7 * Math.PI) * 26 : 0;
        ctx.save();
        ctx.translate(cx, cy + Math.sin(bchHeshyT * 2) * 4 - cannon);
        // expanding ripple ring on splashdown
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 8, 22 + cannon * 0.6, 6 + cannon * 0.15, 0, 0, Math.PI * 2); ctx.stroke();
        // head + green swim cap
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#2E7D32";
        ctx.beginPath(); ctx.arc(0, -3, 10, Math.PI, Math.PI * 2); ctx.fill();
        // happy eyes + grin
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(-3.5, 0, 1.6, 0, Math.PI * 2); ctx.arc(3.5, 0, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#A0394D"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0, 3, 4, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        // a waving arm splashing
        ctx.strokeStyle = "#FFE0CC"; ctx.lineWidth = 4; ctx.lineCap = "round";
        var wave = Math.sin(bchHeshyT * 6) * 0.5;
        ctx.beginPath(); ctx.moveTo(8, 6); ctx.lineTo(16 + wave * 6, -4 - wave * 6); ctx.stroke();
        ctx.lineCap = "butt";
        ctx.restore();
    }

    function bchDrawTower(cx, sandY) {
        ctx.save();
        ctx.translate(cx, sandY);
        // legs
        ctx.strokeStyle = "#A1674A"; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(-22, 30); ctx.lineTo(-14, -36); ctx.moveTo(22, 30); ctx.lineTo(14, -36); ctx.stroke();
        // platform
        ctx.fillStyle = "#C8895C"; roundRect(-26, -44, 52, 10, 2); ctx.fill();
        // hut
        ctx.fillStyle = "#FFFFFF"; roundRect(-22, -78, 44, 36, 4); ctx.fill();
        ctx.fillStyle = "#E53935"; // red roof
        ctx.beginPath(); ctx.moveTo(-26, -78); ctx.lineTo(0, -98); ctx.lineTo(26, -78); ctx.closePath(); ctx.fill();
        // cross emblem
        ctx.fillStyle = "#E53935";
        ctx.fillRect(-3, -70, 6, 18); ctx.fillRect(-9, -64, 18, 6);
        // the lifeguard standing on the platform
        ctx.save();
        ctx.translate(0, -44);
        ctx.fillStyle = "#E53935"; roundRect(-7, -22, 14, 18, 4); ctx.fill(); // red swimsuit/tank
        ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(0, -28, 7, 0, Math.PI * 2); ctx.fill(); // head
        ctx.fillStyle = "#3E2723"; ctx.beginPath(); ctx.arc(0, -31, 7, Math.PI, Math.PI * 2); ctx.fill(); // hair
        ctx.fillStyle = "#000"; // sunglasses
        roundRect(-6, -29, 12, 4, 2); ctx.fill();
        // scanning the horizon with binoculars (periodic)
        var scanning = (bchLifeScan % 5) < 1.6;
        if (scanning) {
            var look = Math.sin(bchLifeScan * 2) * 4;
            ctx.strokeStyle = "#FFE0CC"; ctx.lineWidth = 3; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(4, -18); ctx.lineTo(8 + look, -28); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-4, -18); ctx.lineTo(-2 + look, -28); ctx.stroke();
            ctx.lineCap = "butt";
            // binoculars
            ctx.fillStyle = "#212121";
            roundRect(-3 + look, -33, 5, 6, 1); ctx.fill();
            roundRect(3 + look, -33, 5, 6, 1); ctx.fill();
        } else {
            // whistle hand up
            ctx.strokeStyle = "#FFE0CC"; ctx.lineWidth = 3; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(6, -16); ctx.lineTo(12, -24); ctx.stroke();
            ctx.lineCap = "butt";
        }
        ctx.restore();
        ctx.restore();
    }

    function bchDrawStand(cx, cy) {
        ctx.save();
        ctx.translate(cx, cy);
        // counter
        ctx.fillStyle = "#5D4037"; roundRect(-34, -6, 68, 30, 4); ctx.fill();
        ctx.fillStyle = "#8D6E63"; roundRect(-34, -6, 68, 8, 4); ctx.fill();
        // striped awning
        for (var p = 0; p < 6; p++) {
            ctx.fillStyle = (p % 2 === 0) ? "#FF6F60" : "#FFFFFF";
            ctx.beginPath();
            ctx.moveTo(-36 + p * 12, -40);
            ctx.lineTo(-24 + p * 12, -40);
            ctx.lineTo(-30 + p * 12, -30);
            ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = "#6D4C41"; ctx.fillRect(-36, -44, 72, 5); // awning bar
        // poles
        ctx.fillStyle = "#8D6E63"; ctx.fillRect(-34, -40, 3, 36); ctx.fillRect(31, -40, 3, 36);
        // giant ice cream cone sign
        ctx.save();
        ctx.translate(0, -56 + Math.sin(bchTime * 2) * 2);
        ctx.fillStyle = "#D7A86E"; // cone
        ctx.beginPath(); ctx.moveTo(-7, -2); ctx.lineTo(7, -2); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#F8BBD0"; ctx.beginPath(); ctx.arc(-3, -5, 6, 0, Math.PI * 2); ctx.fill(); // strawberry
        ctx.fillStyle = "#FFF59D"; ctx.beginPath(); ctx.arc(4, -7, 6, 0, Math.PI * 2); ctx.fill();   // vanilla
        ctx.fillStyle = "#FFCDD2"; ctx.beginPath(); ctx.arc(0, -12, 5, 0, Math.PI * 2); ctx.fill();   // top
        ctx.fillStyle = "#E53935"; ctx.beginPath(); ctx.arc(0, -16, 2, 0, Math.PI * 2); ctx.fill();   // cherry
        ctx.restore();
        drawText("ICE CREAM", 0, 14, "bold 10px Arial", "#FFF8E1", "#5D4037", 3);
        ctx.restore();
    }

    function bchDrawCastle(cx, cy) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = "#E0B877";
        // main keep
        roundRect(-22, -18, 44, 22, 2); ctx.fill();
        // towers
        ctx.fillRect(-26, -28, 10, 32);
        ctx.fillRect(16, -28, 10, 32);
        // crenellations
        ctx.fillStyle = "#D4A55F";
        for (var cr = -26; cr < 26; cr += 6) ctx.fillRect(cr, -30, 4, 4);
        // flags
        ctx.strokeStyle = "#8D6E63"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-21, -28); ctx.lineTo(-21, -40); ctx.moveTo(21, -28); ctx.lineTo(21, -40); ctx.stroke();
        ctx.fillStyle = "#42A5F5";
        var wav = Math.sin(bchTime * 4) * 2;
        ctx.beginPath(); ctx.moveTo(-21, -40); ctx.lineTo(-13, -38 + wav); ctx.lineTo(-21, -35); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#EF5350";
        ctx.beginPath(); ctx.moveTo(21, -40); ctx.lineTo(29, -38 - wav); ctx.lineTo(21, -35); ctx.closePath(); ctx.fill();
        // door (arch)
        ctx.fillStyle = "#A1764B";
        ctx.beginPath(); ctx.moveTo(-5, 4); ctx.lineTo(-5, -6); ctx.arc(0, -6, 5, Math.PI, 0); ctx.lineTo(5, 4); ctx.closePath(); ctx.fill();
        // a little bucket + spade beside it
        ctx.fillStyle = "#EF5350"; roundRect(28, -6, 12, 12, 2); ctx.fill();
        ctx.fillStyle = "#FDD835"; ctx.fillRect(42, -10, 2, 16);
        ctx.restore();
    }
