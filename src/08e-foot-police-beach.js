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
    var polCopMunch = 0;          // donut chew animation
    var polPerpBlink = 0;
    var polFan = 0;               // ceiling-fan spin
    var polConfettiSpawned = false;

    function initPoliceInterior() {
        polTime = 0;
        polFloorY = H - SAFE_BOTTOM - 120;
        polLuluX = 90; polLuluTargetX = 90; polWalkT = 0; polFacing = 1;
        polBubble = ""; polBubbleT = 0;
        polCopMunch = 0; polPerpBlink = rand(0, 4); polFan = 0;
        polConfettiSpawned = false;

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
                    "Press 1 for impound, 2 for snacks, 3 to hear this again."
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
                    "I'd shake your hand but, y'know. Bars. Boundaries."
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
            }
        ];
    }

    function updatePoliceInterior(dt) {
        polTime += dt;
        polCopMunch += dt * 6;
        polPerpBlink += dt;
        polFan += dt * 5;
        if (polBubbleT > 0) polBubbleT -= dt;

        var bottom = H - SAFE_BOTTOM;
        polLeaveRect = { x: W - 122, y: bottom - 64, w: 110, h: 50 };

        var c = consumeClick();
        if (c) {
            // LEAVE button
            if (pointInRect(c.x, c.y, polLeaveRect.x, polLeaveRect.y, polLeaveRect.w, polLeaveRect.h)) {
                playClick();
                exitFootInterior();
                return;
            }
            // door hotspot (top-right exit doorway)
            if (pointInRect(c.x, c.y, W - 96, polFloorY - 132, 80, 132)) {
                playClick();
                exitFootInterior();
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

        // ── back wall ───────────────────────────────────────────
        var wallGrad = ctx.createLinearGradient(0, 0, 0, floorY);
        wallGrad.addColorStop(0, "#3E5871");
        wallGrad.addColorStop(1, "#56789B");
        ctx.fillStyle = wallGrad;
        ctx.fillRect(0, 0, W, floorY);
        // wainscot stripe
        ctx.fillStyle = "#2E4257";
        ctx.fillRect(0, floorY - 26, W, 26);
        // floor (checker tile w/ perspective fade)
        ctx.fillStyle = "#9AA7B3";
        ctx.fillRect(0, floorY, W, bottom - floorY);
        for (var ty = 0; ty < 8; ty++) {
            for (var tx = -1; tx < 10; tx++) {
                if ((tx + ty) % 2 === 0) {
                    ctx.fillStyle = "rgba(255,255,255,0.10)";
                    var ts = 28 + ty * 5;
                    ctx.fillRect(tx * ts, floorY + ty * 11, ts, 11);
                }
            }
        }

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

        // ── Lulu ────────────────────────────────────────────────
        ctx.save();
        if (polFacing < 0) {
            ctx.translate(polLuluX, 0); ctx.scale(-1, 1);
            drawLuluTopDown(0, floorY + 18, polWalkT, "run");
        } else {
            drawLuluTopDown(polLuluX, floorY + 18, polWalkT, "run");
        }
        ctx.restore();

        // ── speech bubble ───────────────────────────────────────
        if (polBubbleT > 0 && polBubble) {
            var by = floorY - 70;
            drawSpeechBubble(clamp(polBubbleX, 70, W - 70), by, polBubble, polTime);
        }

        // ── title banner ────────────────────────────────────────
        polDrawBanner();

        // ── LEAVE button ───────────────────────────────────────
        drawButton(polLeaveRect.x, polLeaveRect.y, polLeaveRect.w, polLeaveRect.h,
            "🚪 LEAVE", { bg: "#EF5350", bgDark: "#B71C1C", small: true });

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
        // cork board
        ctx.fillStyle = "#8D6E45";
        roundRect(-46, 0, 92, 116, 6); ctx.fill();
        ctx.fillStyle = "#A07C4F";
        roundRect(-42, 4, 84, 108, 4); ctx.fill();
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
        // steam (gentle, alpha-safe)
        ctx.globalAlpha = 0.35 + 0.2 * Math.sin(polTime * 3);
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(0, -50 - (polTime * 14 % 16), 3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
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
        // the goofy perp (striped shirt, idle bounce + blink)
        var bob = Math.sin(polTime * 2) * 2;
        ctx.save();
        ctx.translate(6, -28 + bob);
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
        // bars (vertical) — drawn over the perp
        ctx.strokeStyle = "#CFD8DC"; ctx.lineWidth = 4; ctx.lineCap = "round";
        for (var b = -42; b <= 42; b += 12) {
            ctx.beginPath(); ctx.moveTo(b, -118); ctx.lineTo(b, 0); ctx.stroke();
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
    var bchGulls = [];
    var bchHeshyT = 0;            // Heshy bob phase

    function initBeachInterior() {
        bchTime = 0;
        bchSeaY = (H * 0.30);
        bchSandY = (H * 0.46);
        bchLuluX = 90; bchLuluTargetX = 90; bchWalkT = 0; bchFacing = 1;
        bchBubble = ""; bchBubbleT = 0;
        bchHeshyT = 0;

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
                    "I'm 90% lifeguard, 10% sandcastle inspector."
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
                    "SQUAWK SQUAWK (it's just saying 'good shabbos,' probably)."
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
                    "\"Marco! ...Polo? ...anyone? ...I'm just gonna float here.\""
                ]
            }
        ];
    }

    function updateBeachInterior(dt) {
        bchTime += dt;
        bchHeshyT += dt;
        if (bchBubbleT > 0) bchBubbleT -= dt;

        // gulls drift + wrap
        for (var i = 0; i < bchGulls.length; i++) {
            var gl = bchGulls[i];
            gl.x += gl.vx * dt; gl.flap += dt * 9;
            gl.y += Math.sin(bchTime * 1.5 + i) * 6 * dt;
            if (gl.x < -20) gl.x = W + 20;
            if (gl.x > W + 20) gl.x = -20;
        }

        var bottom = H - SAFE_BOTTOM;
        bchLeaveRect = { x: W - 122, y: bottom - 64, w: 110, h: 50 };

        var c = consumeClick();
        if (c) {
            if (pointInRect(c.x, c.y, bchLeaveRect.x, bchLeaveRect.y, bchLeaveRect.w, bchLeaveRect.h)) {
                playClick(); exitFootInterior(); return;
            }
            // boardwalk archway exit (bottom-left "← BOARDWALK")
            if (pointInRect(c.x, c.y, 12, bottom - 64, 110, 50)) {
                playClick(); exitFootInterior(); return;
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

    function bchTrigger(spot) {
        bchBubble = bchPickLine(spot);
        bchBubbleT = 2.6;
        bchBubbleX = spot.x;
        playClick();
        if (spot.reward && !spot.rewarded) {
            spot.rewarded = true;
            footCoinsRun += 25; runCoins += 25; save.totalCoins += 25; persistSave();
            footStars += 1; // a little beach-day star too
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

        // ── sky (warm beach gradient) ──────────────────────────
        var sky = ctx.createLinearGradient(0, 0, 0, seaY);
        sky.addColorStop(0, "#4FC3F7");
        sky.addColorStop(1, "#B3E5FC");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, seaY);

        // sun + glow
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#FFF59D";
        ctx.beginPath(); ctx.arc(W - 70, 70, 46, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#FFEE58";
        ctx.beginPath(); ctx.arc(W - 70, 70, 30, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // ── ocean (animated parallax waves) ────────────────────
        var sea = ctx.createLinearGradient(0, seaY, 0, sandY);
        sea.addColorStop(0, "#0288D1");
        sea.addColorStop(1, "#4DD0E1");
        ctx.fillStyle = sea;
        ctx.fillRect(0, seaY, W, sandY - seaY);
        // three parallax wave layers (alpha-safe — reset after)
        bchDrawWaves(seaY, sandY);

        // ── wet-sand shoreline + beach ─────────────────────────
        ctx.fillStyle = "#FFE0A3"; // wet line
        ctx.fillRect(0, sandY - 6, W, 6);
        var sandGrad = ctx.createLinearGradient(0, sandY, 0, bottom);
        sandGrad.addColorStop(0, "#FFE8B0");
        sandGrad.addColorStop(1, "#F4D08A");
        ctx.fillStyle = sandGrad;
        ctx.fillRect(0, sandY, W, bottom - sandY);
        // speckles
        ctx.fillStyle = "rgba(180,140,80,0.35)";
        for (var sp2 = 0; sp2 < 40; sp2++) {
            var rx = (sp2 * 53 % W), ry = sandY + ((sp2 * 37) % (bottom - sandY));
            ctx.fillRect(rx, ry, 2, 2);
        }

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

        // ── Lulu ───────────────────────────────────────────────
        ctx.save();
        if (bchFacing < 0) {
            ctx.translate(bchLuluX, 0); ctx.scale(-1, 1);
            drawLuluTopDown(0, sandY + 80, bchWalkT, "run");
        } else {
            drawLuluTopDown(bchLuluX, sandY + 80, bchWalkT, "run");
        }
        ctx.restore();

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

    function bchDrawWaves(seaY, sandY) {
        var bands = [
            { y: seaY + 8, amp: 4, len: 60, spd: 26, a: 0.30 },
            { y: seaY + (sandY - seaY) * 0.45, amp: 5, len: 80, spd: 18, a: 0.40 },
            { y: sandY - 16, amp: 6, len: 100, spd: 12, a: 0.55 }
        ];
        ctx.save();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        for (var bnd = 0; bnd < bands.length; bnd++) {
            var w = bands[bnd];
            ctx.globalAlpha = w.a;
            ctx.beginPath();
            for (var x = -20; x <= W + 20; x += 6) {
                var yy = w.y + Math.sin((x + bchTime * w.spd) / w.len * Math.PI * 2) * w.amp;
                if (x === -20) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
            }
            ctx.stroke();
        }
        // foam at the shoreline
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = "#FFFFFF";
        for (var fx = 0; fx < W; fx += 18) {
            var fy = sandY - 6 + Math.sin((fx + bchTime * 30) / 40) * 3;
            ctx.beginPath(); ctx.arc(fx, fy, 4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
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
        ctx.save();
        ctx.translate(cx, cy + Math.sin(bchHeshyT * 2) * 4);
        // ripples around him
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 8, 22, 6, 0, 0, Math.PI * 2); ctx.stroke();
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
        // whistle hand up
        ctx.strokeStyle = "#FFE0CC"; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(6, -16); ctx.lineTo(12, -24); ctx.stroke();
        ctx.lineCap = "butt";
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
