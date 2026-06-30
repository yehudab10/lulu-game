    // ════════════════════════════════════════════════════════════
    //  FOOT INTERIORS — SCHOOL & HOSPITAL
    //  Two self-contained interior mini-scenes Lulu can wander into
    //  while she's stranded on foot. Each is a full-screen painted
    //  room with a walkable Lulu (tap/drag to stroll left-right),
    //  several charming NPC/object interactions (randomized one-liners),
    //  at least one coin/⭐ reward, and an obvious "🚪 LEAVE" door that
    //  calls the prebuilt exitFootInterior().
    //
    //  Public (called by the central dispatcher):
    //    initSchoolInterior / updateSchoolInterior / drawSchoolInterior
    //    initHospitalInterior / updateHospitalInterior / drawHospitalInterior
    //  Everything else is prefixed `sch` / `hosp` to avoid collisions.
    // ════════════════════════════════════════════════════════════

    // Shared little helper: a soft floor band used by both rooms.
    function schHospFloorBand(y0, h, top, bot) {
        var g = ctx.createLinearGradient(0, y0, 0, y0 + h);
        g.addColorStop(0, top); g.addColorStop(1, bot);
        ctx.fillStyle = g; ctx.fillRect(0, y0, W, h);
    }

    // ═══════════════════════ SCHOOL ═══════════════════════
    //  "🍎 CHEDER ON THE CORNER — DAY SCHOOL"
    //  A bright cheder hallway: lockers, a chalkboard, tiny desks,
    //  taped-up kid drawings, a bake-sale table, a water fountain.
    //  Interactions: Morah (strict teacher), a tiny kid, the
    //  principal's door, the bake-sale (reward), the water fountain.

    var schTime = 0;
    var schLulu = null;          // {x, targetX, walkTime, mood, facing}
    var schSpots = [];           // interaction hotspots
    var schBubble = "", schBubbleT = 0, schBubbleX = 0;
    var schKidWalk = 0, schKidX = 0, schKidDir = 1;
    var schLeaveRect = { x: 0, y: 0, w: 0, h: 0 };
    var schBakeDone = false;     // one-time coin reward latch
    var schFloorY = 0;
    // ── cached gradients (built once in init) ──
    var schWallGrad = null, schFloorGrad = null, schShaftGrad = null;
    // ── precomputed static layout (built once in init) ──
    var schLockers = [];         // {x,y,w,h,col}
    var schDrawings = [];        // {x,y,rot,col,kind}
    var schDesks = [];           // {x,y}
    var schDust = [];            // dust motes drifting in the sun shaft
    var schWindows = [];         // {x, w} back-wall windows for sun shafts
    var schPlanes = [];          // paper airplanes flying by {x,y,vx,vy,t,active}
    // ── dynamic background kids running across the hall ──
    var schRunners = [];         // {x, dir, speed, walk, type, chase}
    var schBell = 6;             // class-bell countdown
    var schBellFlash = 0;        // glow after the bell rings
    var schWave = 0;             // wave-of-kids timer after bell
    var schFlicker = 1;          // fluorescent flicker brightness
    var schFlickerT = 0;         // time until next flicker re-roll
    var schPlaneT = 5;           // paper-airplane spawn timer
    var schPeekT = 0;            // Lulu "peeking into a room" timer
    var SCH_KIDPAL = ["#1565C0", "#6A1B9A", "#00897B", "#C62828", "#F9A825"];

    var SCH_MORAH = [
        "A grown woman? In MY hallway?\nWhere is your hall pass?!",
        "We do NOT run in the cheder.\nWe glide, like ladies.",
        "Is this your daughter's class?\nThen why are YOU here, mami?",
        "You forgot your lunchbox in 1994\nand you STILL owe me a note.",
        "No gum. No phones.\nNo... whatever that sheitel is doing.",
        "Recess is over. Sit down.\n...You're forty? Sit down anyway.",
        "Tuck in that shirt, young lady.\nYes, YOU. The tall one.",
        "If you're here for the bake sale,\nthe rugelach are RATIONED.",
        "I taught your husband aleph-bais.\nHe also couldn't sit still.",
        "Detention is for everyone,\nincluding wandering mothers.",
        "Spit out the gum. I can HEAR\nthe gum. There is no gum?\nThere will be.",
        "Walk on the RIGHT, please.\nThis is a one-way hallway."
    ];
    var SCH_KID = [
        "My morah says I'm a tzaddik.\nI told her I'm just hungry.",
        "I have FORTY-SIX stickers.\nWanna see? ...Too bad, they're mine.",
        "I traded my snack for a rock.\nIt's a GOOD rock though.",
        "Is it Shabbos yet? Is it now?\nIs it NOW? How about now?",
        "I know all the brachos.\nWatch — *whispers nothing* — done!",
        "My bubbe gives me soda.\nDon't tell my ima. Or do. I'll deny it.",
        "I'm not crying, YOU'RE crying.\n...okay I dropped my cookie.",
        "I drew you on the wall!\nYou have nineteen fingers. Sorry.",
        "Wanna hear a joke? Why did the\nmatzah— I forgot the rest.",
        "I lost my tooth in the cubbies.\nThe tooth fairy works here, right?",
        "Morah said sharing is caring.\nSo CARE about my homework, please.",
        "I'm hiding from gym.\nYou never saw me. Shhh."
    ];
    var SCH_PRINCIPAL = [
        "The principal will see you now.\n...In 1996, apparently.",
        "Office hours: whenever the rabbi\nfinds his other shoe.",
        "Sign in, sign out, sign a check\nfor the building fund. Mostly that one.",
        "You're being sent to the office.\nAt your big age. Mazel.",
        "The principal is 'in a meeting'\n(napping behind the gemara).",
        "Please hold. The secretary is\non the phone with EVERYONE'S mother.",
        "He'll call your mom.\n...Your mom is already in the parking lot.",
        "We don't have a budget, but we\nhave a LOT of laminated signs.",
        "The office candy dish is empty.\nThe rabbi has a sweet tooth too.",
        "Yes, the heating is broken.\nYes, it's a 'character-building' winter."
    ];
    var SCH_BAKE = [
        "Bake sale! Rugelach two dollars,\nguilt absolutely free.",
        "Babka by the slice — proceeds\nfund the gym we'll never build.",
        "Buy a hamantasch, support the\neighth grade trip to... the lobby.",
        "These cookies are sugar-free.\nThat's a lie, but it's a MITZVAH lie.",
        "Tzedakah jar's right here, mami.\nThe morah is WATCHING.",
        "Last black-and-white cookie!\nFirst come, first kvell.",
        "Macaroons! From Pesach!\n...This Pesach. Probably."
    ];
    var SCH_FOUNTAIN = [
        "The water fountain only does\nlukewarm and 'forehead splash'.",
        "Press the button, get a sip,\nget a free shirt soaking. Classic.",
        "Someone left gum on it again.\nThe eternal cheder mystery.",
        "It's been 'out of order' since\nthe Maccabees, honestly.",
        "Cold water? In THIS school?\nDream bigger, mami.",
        "*sluuurp* ...okay that's enough\nadventure for one hallway.",
        "The handle's sticky. Everything\nin a cheder is sticky. It's halacha.",
        "I filled my water bottle here\nin 2009. Still tastes like 2009."
    ];
    // NEW interaction: the hallway clock (always 'almost recess').
    var SCH_CLOCK = [
        "Three more minutes till recess.\nIt's been three minutes for an hour.",
        "This clock runs on cheder time:\nslow before lunch, fast after.",
        "*tick* *tick* *tick*\nthe sound of childhood, honestly.",
        "It's exactly 'snack o'clock'.\nIt's ALWAYS snack o'clock here.",
        "The big hand fell off in '04.\nWe just guess now. Spiritually.",
        "Davening's in five minutes.\nOr fifty. The clock is shy about it."
    ];
    // NEW interaction: the lost-and-found / lockers.
    var SCH_LOCKER = [
        "Lost-and-found: forty hats,\nzero owners. A cheder mystery.",
        "Locker 12 has smelled like a\ntuna sandwich since Chanukah.",
        "Someone's gym shoe achieved\nsentience in here. Don't open 6.",
        "A single glove. A yo-yo. A note\nthat says 'sorry morah'. Iconic.",
        "Whose coat is this? It's been\nhere since the boy GRADUATED."
    ];

    function initSchoolInterior() {
        schTime = 0;
        schBubble = ""; schBubbleT = 0; schBubbleX = W / 2;
        schKidWalk = 0; schKidX = W * 0.62; schKidDir = -1;
        schBakeDone = false;
        schFloorY = H * 0.60;
        schLulu = { x: W / 2, y: schFloorY + 70, targetX: W / 2, walkTime: 0, mood: "run", facing: 1 };
        // Interaction hotspots, positioned along the hallway floor line.
        var fy = schFloorY + 70;
        schSpots = [
            { id: "morah",     x: W * 0.20, y: fy, r: 56, pool: SCH_MORAH },
            { id: "kid",       x: W * 0.62, y: fy, r: 50, pool: SCH_KID, moving: true },
            { id: "principal", x: W * 0.84, y: schFloorY - 6, r: 60, pool: SCH_PRINCIPAL },
            { id: "bake",      x: W * 0.42, y: fy + 16, r: 58, pool: SCH_BAKE, reward: true },
            { id: "fountain",  x: W * 0.06, y: schFloorY - 4, r: 46, pool: SCH_FOUNTAIN },
            { id: "clock",     x: W * 0.50, y: 44,            r: 40, pool: SCH_CLOCK },
            { id: "locker",    x: W - 74,   y: schFloorY - 80, r: 50, pool: SCH_LOCKER }
        ];

        // ── cached gradients ──
        schWallGrad = ctx.createLinearGradient(0, 0, 0, schFloorY);
        schWallGrad.addColorStop(0, "#FFF3D6");
        schWallGrad.addColorStop(0.7, "#FBE9C8");
        schWallGrad.addColorStop(1, "#F1DDB0");
        schFloorGrad = ctx.createLinearGradient(0, schFloorY, 0, H);
        schFloorGrad.addColorStop(0, "#9CCC65");
        schFloorGrad.addColorStop(1, "#7CB342");
        schShaftGrad = ctx.createLinearGradient(0, 0, 0, schFloorY);
        schShaftGrad.addColorStop(0, "rgba(255,249,196,0.42)");
        schShaftGrad.addColorStop(1, "rgba(255,249,196,0)");

        // ── precompute back-wall windows (sun shafts come through these) ──
        schWindows = [{ x: W * 0.12, w: 52 }, { x: W * 0.50, w: 52 }, { x: W * 0.70, w: 52 }];

        // ── precompute lockers (right back wall) ──
        var lcol = ["#42A5F5", "#EF5350", "#66BB6A", "#FFA726", "#AB47BC", "#26C6DA"];
        schLockers = [];
        for (var l = 0; l < 6; l++) {
            schLockers.push({ x: W - 120 + (l % 3) * 44, y: schFloorY - 138 + Math.floor(l / 3) * 70,
                w: 40, h: 64, col: lcol[l] });
        }

        // ── precompute taped-up kid drawings ──
        var dcol = ["#FFCDD2", "#BBDEFB", "#FFF9C4", "#C8E6C9", "#F8BBD0"];
        schDrawings = [];
        var dpos = [[18, 60], [W - 168, 56], [W - 200, 150], [W * 0.55, 200], [W * 0.07, 150]];
        for (var d = 0; d < dpos.length; d++) {
            schDrawings.push({ x: dpos[d][0], y: dpos[d][1], rot: (d % 2 ? 1 : -1) * 0.08,
                col: dcol[d % dcol.length], kind: d % 3 });
        }

        // ── precompute tiny desks ──
        schDesks = [];
        for (var dk = 0; dk < 3; dk++) {
            schDesks.push({ x: 40 + dk * 56, y: schFloorY + 40 + (dk % 2) * 18 });
        }

        // ── capped dust motes drifting in the sun shafts ──
        schDust = [];
        for (var u = 0; u < 26; u++) {
            var win = schWindows[u % schWindows.length];
            schDust.push({ x: win.x + rand(-win.w * 0.6, win.w * 0.6), y: rand(0, schFloorY),
                vy: rand(4, 14), drift: rand(0.4, 1.2), ph: rand(0, 6.28), a: rand(0.2, 0.6) });
        }

        // ── background runner kids (cross the hall on their own) ──
        schRunners = [];
        schRunners.push({ x: -40, dir: 1, speed: rand(70, 110), walk: 0,
            type: randInt(0, SCH_KIDPAL.length - 1), chase: 0 });

        schPlanes = [];
        schPlaneT = rand(4, 8);
        schBell = rand(8, 14); schBellFlash = 0; schWave = 0;
        schFlicker = 1; schFlickerT = rand(0.5, 2.5);
        schPeekT = rand(3, 7);
        playClick();
    }

    // Spawn a kid that runs across the full hallway width.
    function schSpawnRunner(chase) {
        var fromLeft = Math.random() < 0.5;
        schRunners.push({ x: fromLeft ? -40 : W + 40, dir: fromLeft ? 1 : -1,
            speed: rand(80, 140) * (chase ? 1.25 : 1), walk: 0,
            type: randInt(0, SCH_KIDPAL.length - 1), chase: chase || 0 });
    }

    function schSay(spot) {
        schBubble = randPick(spot.pool);
        schBubbleT = 3.4;
        schBubbleX = clamp(spot.x, 70, W - 70);
        playClick();
        if (spot.id === "morah") playTone(196, 0.14, "square", 0.13);
        if (spot.id === "kid") playTone(740, 0.08, "triangle", 0.14);
        if (spot.id === "fountain") playTone(520, 0.09, "sine", 0.12, 760);
        if (spot.id === "principal") playTone(330, 0.12, "sine", 0.12);
        if (spot.id === "clock") playTone(880, 0.06, "triangle", 0.1);
        if (spot.id === "locker") playTone(220, 0.1, "square", 0.12);
        // Bake-sale gives a one-time coin reward (then just flavor).
        if (spot.reward && !schBakeDone) {
            schBakeDone = true;
            var n = 6;
            footCoinsRun += n; runCoins += n; save.totalCoins += n; persistSave();
            spawnFloater(spot.x, spot.y - 30, "+" + n + " 💰 rugelach run!", "#FFD700");
            playCoin();
            for (var i = 0; i < 10; i++) {
                particles.push({ x: spot.x + rand(-14, 14), y: spot.y - 20,
                    vx: rand(-40, 40), vy: rand(-90, -30), life: 0.7, maxLife: 0.7,
                    size: rand(3, 6), color: randPick(["#FFD700", "#FFCC80", "#A1674A"]), gravity: 240 });
            }
        } else if (spot.reward) {
            // Tiny star for repeat visits — generous but not exploitable-feeling.
            footAwardStar();
            spawnFloater(spot.x, spot.y - 30, "+1 💰 one more nosh", "#FFD700");
            playHopJump();
        }
    }

    function updateSchoolInterior(dt) {
        if (!schLulu) return;
        schTime += dt;
        updateParticles(dt);
        if (schBubbleT > 0) schBubbleT -= dt;

        // Wandering kid paces the hall.
        schKidWalk += dt * 3;
        schKidX += schKidDir * 26 * dt;
        if (schKidX < W * 0.50) { schKidX = W * 0.50; schKidDir = 1; }
        if (schKidX > W * 0.74) { schKidX = W * 0.74; schKidDir = -1; }
        for (var s = 0; s < schSpots.length; s++) {
            if (schSpots[s].moving) schSpots[s].x = schKidX;
        }

        // ── Fluorescent flicker (one cheap re-roll, not per-frame random) ──
        schFlickerT -= dt;
        if (schFlickerT <= 0) {
            schFlicker = Math.random() < 0.25 ? rand(0.55, 0.85) : 1;
            schFlickerT = schFlicker < 1 ? rand(0.04, 0.12) : rand(0.8, 3.0);
        }

        // ── Dust motes drift up/down through the sun shafts ──
        for (var u = 0; u < schDust.length; u++) {
            var d = schDust[u];
            d.y += d.vy * dt;
            d.ph += dt;
            if (d.y > schFloorY) { d.y = -4; }
        }

        // ── Class bell rings periodically → a wave of kids crosses ──
        schBell -= dt;
        if (schBellFlash > 0) schBellFlash -= dt;
        if (schBell <= 0) {
            schBell = rand(11, 18);
            schBellFlash = 1.2;
            schWave = 0.9;
            playTone(1320, 0.13, "square", 0.13);
            playTone(990, 0.18, "square", 0.1);
        }
        if (schWave > 0) {
            schWave -= dt;
            if (Math.random() < dt * 6) schSpawnRunner(0);
        }

        // ── Background runner kids cross the hall (+ occasional chase pair) ──
        for (var rr = schRunners.length - 1; rr >= 0; rr--) {
            var R = schRunners[rr];
            R.x += R.dir * R.speed * dt;
            R.walk += dt * 6;
            if (R.x < -60 || R.x > W + 60) schRunners.splice(rr, 1);
        }
        if (schRunners.length < 2 && Math.random() < dt * 0.4) {
            // sometimes two: a chaser right behind a runner
            schSpawnRunner(0);
            if (Math.random() < 0.4) {
                var last = schRunners[schRunners.length - 1];
                schRunners.push({ x: last.x - last.dir * 46, dir: last.dir,
                    speed: last.speed * 1.05, walk: 0,
                    type: randInt(0, SCH_KIDPAL.length - 1), chase: 1 });
            }
        }

        // ── Paper airplane flies by occasionally ──
        schPlaneT -= dt;
        if (schPlaneT <= 0 && schPlanes.length < 2) {
            schPlaneT = rand(6, 12);
            var fl = Math.random() < 0.5;
            schPlanes.push({ x: fl ? -30 : W + 30, y: rand(70, schFloorY - 40),
                vx: (fl ? 1 : -1) * rand(150, 220), vy: rand(-10, 10), t: 0 });
        }
        for (var pl = schPlanes.length - 1; pl >= 0; pl--) {
            var P = schPlanes[pl];
            P.x += P.vx * dt; P.y += P.vy * dt + Math.sin(P.t * 6) * 14 * dt; P.t += dt;
            if (P.x < -50 || P.x > W + 50) schPlanes.splice(pl, 1);
        }

        // ── Lulu peeks into rooms periodically when idle ──
        schPeekT -= dt;
        if (schPeekT <= 0) schPeekT = rand(4, 9);

        // Lulu strolls toward the last tapped x.
        schLulu.x = lerp(schLulu.x, schLulu.targetX, Math.min(1, 9 * dt));
        var moving = Math.abs(schLulu.x - schLulu.targetX) > 1.5;
        if (moving) {
            schLulu.walkTime += dt * 3.2;
            schLulu.facing = schLulu.targetX > schLulu.x ? 1 : -1;
        }

        var click = consumeClick();
        if (click) {
            // Leave door first.
            if (pointInRect(click.x, click.y, schLeaveRect.x, schLeaveRect.y, schLeaveRect.w, schLeaveRect.h)) {
                playClick(); exitFootInterior(); return;
            }
            // Did they tap a hotspot? (then chat); otherwise walk there.
            var hit = null;
            for (var i = 0; i < schSpots.length; i++) {
                var sp = schSpots[i];
                var dx = click.x - sp.x, dy = click.y - sp.y;
                if (dx * dx + dy * dy < sp.r * sp.r) { hit = sp; break; }
            }
            if (hit) { schLulu.targetX = clamp(hit.x, 40, W - 40); schSay(hit); }
            else schLulu.targetX = clamp(click.x, 40, W - 40);
        }
    }

    function schDrawLocker(x, y, w, h, col) {
        ctx.fillStyle = col;
        roundRect(x, y, w, h, 4); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2;
        roundRect(x, y, w, h, 4); ctx.stroke();
        // vents
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        for (var v = 0; v < 3; v++) ctx.fillRect(x + 5, y + 8 + v * 5, w - 10, 2);
        // handle + lock
        ctx.fillStyle = "#37474F"; ctx.fillRect(x + w - 8, y + h * 0.5, 4, 12);
        ctx.fillStyle = "#FFD54F"; ctx.beginPath(); ctx.arc(x + w - 6, y + h * 0.5 + 16, 3, 0, Math.PI * 2); ctx.fill();
    }

    function schDrawMorah(x, y, t) {
        ctx.save(); ctx.translate(x, y);
        var bob = Math.sin(t * 2) * 1.5;
        // long modest skirt
        ctx.fillStyle = "#37474F"; roundRect(-16, -6 + bob, 32, 40, 6); ctx.fill();
        // cardigan
        ctx.fillStyle = "#6D4C41"; roundRect(-15, -26 + bob, 30, 26, 8); ctx.fill();
        // wagging finger arm
        ctx.save(); ctx.translate(13, -20 + bob); ctx.rotate(Math.sin(t * 6) * 0.4 - 0.5);
        ctx.fillStyle = "#6D4C41"; roundRect(-3, 0, 6, 18, 3); ctx.fill();
        ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(0, 20, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // head + sheitel (snood)
        ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(0, -36 + bob, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#4E342E"; ctx.beginPath(); ctx.arc(0, -39 + bob, 12, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#5D4037"; roundRect(-12, -40 + bob, 24, 10, 5); ctx.fill();
        // stern face
        ctx.strokeStyle = "#3D2817"; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-6, -39 + bob); ctx.lineTo(-2, -37 + bob);
        ctx.moveTo(6, -39 + bob); ctx.lineTo(2, -37 + bob); ctx.stroke(); // angry brows
        ctx.beginPath(); ctx.arc(-4, -35 + bob, 1.4, 0, Math.PI * 2); ctx.arc(4, -35 + bob, 1.4, 0, Math.PI * 2); ctx.fillStyle = "#000"; ctx.fill();
        ctx.beginPath(); ctx.moveTo(-4, -29 + bob); ctx.lineTo(4, -29 + bob); ctx.stroke();
        ctx.lineCap = "butt";
        // glasses
        ctx.strokeStyle = "#212121"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(-4, -35 + bob, 3, 0, Math.PI * 2); ctx.arc(4, -35 + bob, 3, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }

    function schDrawKid(x, y, walk) {
        ctx.save(); ctx.translate(x, y);
        var legS = Math.sin(walk * 3) * 4;
        ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0, 18, 11, 3, 0, 0, Math.PI * 2); ctx.fill();
        // little legs (grey trousers)
        ctx.fillStyle = "#455A64"; roundRect(-6, 4 - legS, 5, 14 + legS, 2); ctx.fill();
        roundRect(1, 4 + legS, 5, 14 - legS, 2); ctx.fill();
        // white shirt + tzitzis
        ctx.fillStyle = "#FFFFFF"; roundRect(-9, -12, 18, 20, 5); ctx.fill();
        ctx.strokeStyle = "#CFD8DC"; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(-7, 8); ctx.lineTo(-7, 12); ctx.moveTo(-3, 8); ctx.lineTo(-3, 12);
        ctx.moveTo(3, 8); ctx.lineTo(3, 12); ctx.moveTo(7, 8); ctx.lineTo(7, 12); ctx.stroke();
        // head
        ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(0, -20, 9, 0, Math.PI * 2); ctx.fill();
        // payos
        ctx.fillStyle = "#4E342E"; ctx.beginPath(); ctx.arc(-8, -18, 2, 0, Math.PI * 2); ctx.arc(8, -18, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -24, 9, Math.PI, Math.PI * 2); ctx.fill();
        // kippah
        ctx.fillStyle = "#1565C0"; ctx.beginPath(); ctx.arc(0, -26, 6, Math.PI, Math.PI * 2); ctx.fill();
        // happy face
        ctx.strokeStyle = "#3D2817"; ctx.lineWidth = 1.4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(-3, -20, 1.4, 0, Math.PI * 2); ctx.arc(3, -20, 1.4, 0, Math.PI * 2); ctx.fillStyle = "#000"; ctx.fill();
        ctx.beginPath(); ctx.arc(0, -17, 3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        ctx.lineCap = "butt";
        ctx.restore();
    }

    // A small kid running across the hall (background, no payos detail — cheap).
    function schDrawRunner(R) {
        ctx.save(); ctx.translate(R.x, schFloorY + 54);
        ctx.scale(R.dir, 1);
        var legS = Math.sin(R.walk) * 6;
        ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath();
        ctx.ellipse(0, 16, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#455A64"; roundRect(-5, 2 - legS, 4, 13 + legS, 2); ctx.fill();
        roundRect(1, 2 + legS, 4, 13 - legS, 2); ctx.fill();
        ctx.fillStyle = "#FFFFFF"; roundRect(-8, -10, 16, 16, 4); ctx.fill();
        // little arm pumping
        ctx.fillStyle = "#FFE0CC"; ctx.beginPath();
        ctx.arc(7 + Math.sin(R.walk) * 3, -2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(0, -18, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = R.chase ? "#C62828" : SCH_KIDPAL[R.type];
        ctx.beginPath(); ctx.arc(0, -22, 6, Math.PI, Math.PI * 2); ctx.fill(); // kippah
        ctx.restore();
    }

    function schDrawScene() {
        // Back wall (warm school cream) + wainscot — cached gradient.
        ctx.fillStyle = schWallGrad; ctx.fillRect(0, 0, W, schFloorY);

        // Back-wall windows with daylight (behind everything).
        for (var wi = 0; wi < schWindows.length; wi++) {
            var wn = schWindows[wi], wx = wn.x - wn.w / 2, wy = 26, wh = 70;
            ctx.fillStyle = "#BBDEFB"; roundRect(wx, wy, wn.w, wh, 4); ctx.fill();
            ctx.fillStyle = "#E1F5FE"; roundRect(wx, wy, wn.w, wh * 0.45, 4); ctx.fill();
            ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(wn.x, wy); ctx.lineTo(wn.x, wy + wh);
            ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + wn.w, wy + wh / 2); ctx.stroke();
            ctx.strokeStyle = "#8D6E63"; ctx.lineWidth = 2; ctx.strokeRect(wx, wy, wn.w, wh);
        }

        // ── Sun shafts slanting down from the windows (additive-ish glow) ──
        ctx.save();
        ctx.globalAlpha = 0.6 * schFlicker;
        for (var sf = 0; sf < schWindows.length; sf++) {
            var sw = schWindows[sf];
            ctx.fillStyle = schShaftGrad;
            ctx.beginPath();
            ctx.moveTo(sw.x - sw.w * 0.4, 96);
            ctx.lineTo(sw.x + sw.w * 0.4, 96);
            ctx.lineTo(sw.x + sw.w * 0.4 + 60, schFloorY);
            ctx.lineTo(sw.x - sw.w * 0.4 + 60, schFloorY);
            ctx.closePath(); ctx.fill();
        }
        ctx.restore();

        // ── Dust motes in the light ──
        ctx.fillStyle = "#FFFDE7";
        for (var u = 0; u < schDust.length; u++) {
            var dm = schDust[u];
            ctx.globalAlpha = dm.a * (0.5 + 0.5 * Math.sin(dm.ph)) * schFlicker;
            ctx.beginPath();
            ctx.arc(dm.x + Math.sin(dm.ph) * 6 * dm.drift, dm.y, 1.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Wainscot band.
        ctx.fillStyle = "#E8C98A"; ctx.fillRect(0, schFloorY - 26, W, 26);
        ctx.strokeStyle = "#C8A05A"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, schFloorY - 26); ctx.lineTo(W, schFloorY - 26); ctx.stroke();

        // Speckled linoleum floor with perspective tiles — cached gradient.
        ctx.fillStyle = schFloorGrad; ctx.fillRect(0, schFloorY, W, H - schFloorY);
        ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1;
        for (var ty = schFloorY + 18; ty < H; ty += 34) {
            ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke();
        }

        // Soft floor reflection of the sun shafts (warm pools of light).
        ctx.save(); ctx.globalAlpha = 0.18 * schFlicker; ctx.fillStyle = "#FFF59D";
        for (var rp = 0; rp < schWindows.length; rp++) {
            ctx.beginPath();
            ctx.ellipse(schWindows[rp].x + 50, schFloorY + 26, 34, 8, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        // Chalkboard (center back) with aleph-bais + a sum.
        var cbX = W * 0.30, cbY = 70, cbW = 200, cbH = 110;
        ctx.fillStyle = "#5D4037"; roundRect(cbX - 6, cbY - 6, cbW + 12, cbH + 12, 6); ctx.fill();
        ctx.fillStyle = "#2E4A3A"; roundRect(cbX, cbY, cbW, cbH, 4); ctx.fill();
        drawText("א ב ג ד", cbX + cbW / 2, cbY + 26, "bold 22px Arial", "#F1F8E9", null, 0);
        drawText("שבת = soup", cbX + cbW / 2, cbY + 56, "bold 16px Arial", "#FFF9C4", null, 0);
        drawText("Be a mensch!", cbX + cbW / 2, cbY + 82, "italic 14px Arial", "#FFCDD2", null, 0);
        // chalk tray
        ctx.fillStyle = "#4E342E"; ctx.fillRect(cbX, cbY + cbH, cbW, 6);
        ctx.fillStyle = "#FFF"; ctx.fillRect(cbX + 16, cbY + cbH, 14, 4);
        ctx.fillStyle = "#FFCDD2"; ctx.fillRect(cbX + 40, cbY + cbH, 12, 4);

        // Taped-up kid drawings (precomputed positions/colors).
        for (var d = 0; d < schDrawings.length; d++) {
            var dr = schDrawings[d];
            ctx.save(); ctx.translate(dr.x, dr.y); ctx.rotate(dr.rot);
            ctx.fillStyle = dr.col; ctx.fillRect(0, 0, 38, 30);
            ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth = 1; ctx.strokeRect(0, 0, 38, 30);
            if (dr.kind === 0) {
                ctx.fillStyle = "#F44336"; ctx.beginPath(); ctx.arc(12, 14, 5, 0, Math.PI * 2); ctx.fill(); // sun
                ctx.strokeStyle = "#000"; ctx.lineWidth = 1.4;
                ctx.beginPath(); ctx.arc(26, 18, 4, 0, Math.PI * 2); ctx.moveTo(26, 22); ctx.lineTo(26, 27); ctx.stroke();
            } else if (dr.kind === 1) {
                // a house
                ctx.fillStyle = "#8D6E63"; ctx.fillRect(10, 14, 18, 12);
                ctx.fillStyle = "#C62828"; ctx.beginPath();
                ctx.moveTo(8, 14); ctx.lineTo(19, 6); ctx.lineTo(30, 14); ctx.closePath(); ctx.fill();
            } else {
                // a big scribbly heart
                ctx.fillStyle = "#E91E63";
                ctx.beginPath(); ctx.arc(14, 14, 4, 0, Math.PI * 2); ctx.arc(22, 14, 4, 0, Math.PI * 2);
                ctx.moveTo(10, 16); ctx.lineTo(18, 26); ctx.lineTo(26, 16); ctx.closePath(); ctx.fill();
            }
            // tape
            ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fillRect(14, -3, 10, 6);
            ctx.restore();
        }

        // Lockers along the right back wall (precomputed).
        for (var l = 0; l < schLockers.length; l++) {
            var lk = schLockers[l];
            schDrawLocker(lk.x, lk.y, lk.w, lk.h, lk.col);
        }

        // Tiny desks scattered up front-left (precomputed).
        for (var dk = 0; dk < schDesks.length; dk++) {
            var dxp = schDesks[dk].x, dyp = schDesks[dk].y;
            ctx.fillStyle = "#A1674A"; roundRect(dxp, dyp, 34, 8, 3); ctx.fill();        // desktop
            ctx.fillStyle = "#7B4A2E"; ctx.fillRect(dxp + 3, dyp + 8, 4, 18); ctx.fillRect(dxp + 27, dyp + 8, 4, 18); // legs
            ctx.fillStyle = "#FFF59D"; ctx.fillRect(dxp + 10, dyp - 2, 14, 4);          // notebook
        }

        // ── Hallway clock (ticking, back wall center) ──
        var clX = W * 0.50, clY = 44;
        ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(clX, clY, 16, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#5D4037"; ctx.lineWidth = 3; ctx.stroke();
        ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(clX, clY); ctx.lineTo(clX + Math.cos(schTime - 1.57) * 9, clY + Math.sin(schTime - 1.57) * 9); ctx.stroke();
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(clX, clY); ctx.lineTo(clX + Math.cos(schTime * 0.12 - 1.57) * 6, clY + Math.sin(schTime * 0.12 - 1.57) * 6); ctx.stroke();
        // tick second hand jumps
        ctx.strokeStyle = "#E53935"; ctx.lineWidth = 1;
        var sec = Math.floor(schTime) * 0.5236;
        ctx.beginPath(); ctx.moveTo(clX, clY); ctx.lineTo(clX + Math.cos(sec - 1.57) * 12, clY + Math.sin(sec - 1.57) * 12); ctx.stroke();
    }

    function drawSchoolInterior() {
        ctx.save();

        schDrawScene();

        // ── Background runner kids (behind props/NPCs) ──
        for (var rk = 0; rk < schRunners.length; rk++) schDrawRunner(schRunners[rk]);

        // ── Hotspot NPCs / props ──
        // Water fountain (far left).
        var f = schSpots[4];
        ctx.fillStyle = "#B0BEC5"; roundRect(f.x - 16, f.y - 28, 32, 40, 6); ctx.fill();
        ctx.strokeStyle = "#607D8B"; ctx.lineWidth = 2; roundRect(f.x - 16, f.y - 28, 32, 40, 6); ctx.stroke();
        ctx.fillStyle = "#4FC3F7"; ctx.beginPath(); ctx.ellipse(f.x, f.y - 24, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#81D4FA"; // little arc of water
        ctx.beginPath(); ctx.arc(f.x, f.y - 24 - Math.abs(Math.sin(schTime * 4)) * 6, 2, 0, Math.PI * 2); ctx.fill();
        drawText("💧", f.x, f.y + 24, "13px Arial", "#0277BD", null, 0);

        // Bake-sale table (mid-left).
        var b = schSpots[3];
        ctx.fillStyle = "#8D6E63"; roundRect(b.x - 40, b.y - 6, 80, 14, 4); ctx.fill();
        ctx.fillStyle = "#FFFFFF"; roundRect(b.x - 42, b.y - 10, 84, 8, 3); ctx.fill(); // tablecloth
        ctx.fillStyle = "#5D4037"; ctx.fillRect(b.x - 36, b.y + 8, 5, 16); ctx.fillRect(b.x + 31, b.y + 8, 5, 16);
        // baked goods
        var goods = ["🍪", "🥯", "🍩"];
        for (var g = 0; g < 3; g++) drawText(goods[g], b.x - 24 + g * 24, b.y - 6, "16px Arial", "#000", null, 0);
        // sign
        ctx.save(); ctx.translate(b.x, b.y - 40); ctx.rotate(Math.sin(schTime * 2) * 0.04);
        ctx.fillStyle = "#FFF59D"; roundRect(-44, -14, 88, 24, 4); ctx.fill();
        ctx.strokeStyle = "#F9A825"; ctx.lineWidth = 2; roundRect(-44, -14, 88, 24, 4); ctx.stroke();
        drawText("BAKE SALE", 0, -2, "bold 13px Arial", "#E65100", null, 0);
        ctx.restore();
        drawText(schBakeDone ? "(sold out, mami)" : "tap for nosh", b.x, b.y + 30, "bold 10px Arial", "#5D4037", "#FFF", 2);

        // Principal's office door (right).
        var p = schSpots[2];
        ctx.fillStyle = "#5D4037"; roundRect(p.x - 34, p.y - 100, 68, 120, 6); ctx.fill();
        ctx.strokeStyle = "#3E2723"; ctx.lineWidth = 3; roundRect(p.x - 34, p.y - 100, 68, 120, 6); ctx.stroke();
        ctx.fillStyle = "#FFD54F"; ctx.beginPath(); ctx.arc(p.x + 22, p.y - 40, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ECEFF1"; roundRect(p.x - 28, p.y - 92, 56, 26, 3); ctx.fill(); // nameplate window
        drawText("OFFICE", p.x, p.y - 79, "bold 12px Arial", "#37474F", null, 0);
        drawText("PRINCIPAL", p.x, p.y - 66, "bold 8px Arial", "#90A4AE", null, 0);

        // Morah (strict teacher).
        var m = schSpots[0];
        schDrawMorah(m.x, m.y, schTime);

        // Wandering kid.
        var k = schSpots[1];
        schDrawKid(k.x, k.y, schKidWalk);

        // ── Class bell on the wall (rings periodically, glows when ringing) ──
        var blX = W * 0.50 + 30, blY = 26;
        if (schBellFlash > 0) {
            ctx.save();
            ctx.globalAlpha = clamp(schBellFlash, 0, 1) * 0.5;
            ctx.fillStyle = "#FFF176";
            ctx.beginPath(); ctx.arc(blX, blY, 22 + (1.2 - schBellFlash) * 14, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        ctx.fillStyle = "#B71C1C"; ctx.beginPath(); ctx.arc(blX, blY, 8, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#7F1D1D"; ctx.fillRect(blX - 8, blY, 16, 3);
        ctx.fillStyle = "#FFCDD2"; ctx.beginPath();
        ctx.arc(blX + (schBellFlash > 0 ? Math.sin(schTime * 40) * 2 : 0), blY + 3, 2, 0, Math.PI * 2); ctx.fill();

        // ── Paper airplanes ──
        for (var pa = 0; pa < schPlanes.length; pa++) {
            var pn = schPlanes[pa];
            ctx.save(); ctx.translate(pn.x, pn.y);
            ctx.rotate(Math.atan2(pn.vy, pn.vx) + (pn.vx < 0 ? Math.PI : 0));
            ctx.scale(pn.vx < 0 ? -1 : 1, 1);
            ctx.fillStyle = "#FFFFFF"; ctx.strokeStyle = "#B0BEC5"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-12, -5); ctx.lineTo(12, 0); ctx.lineTo(-12, 5); ctx.lineTo(-6, 0); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }

        // ── Lulu (peeks into a room briefly via a tiny "?" thought) ──
        drawLuluTopDown(schLulu.x, schLulu.y, schLulu.walkTime, schLulu.mood);
        if (schPeekT < 1.2 && Math.abs(schLulu.x - schLulu.targetX) <= 1.5) {
            ctx.save();
            ctx.globalAlpha = clamp(schPeekT, 0, 1) * 0.9;
            drawText("👀", schLulu.x + 14 * schLulu.facing, schLulu.y - 56, "14px Arial", "#FFF", "#000", 2);
            ctx.restore();
        }

        drawParticles();

        // Active speech bubble.
        if (schBubbleT > 0) {
            ctx.globalAlpha = clamp(schBubbleT, 0, 1);
            drawSpeechBubble(schBubbleX, (schFloorY + 30), schBubble, schTime * 4);
            ctx.globalAlpha = 1;
        }

        ctx.restore();

        // ── HUD (outside world transform) ──
        // Title banner.
        ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(20, SAFE_TOP + 8, W - 40, 38, 10); ctx.fill();
        drawText("🍎 CHEDER ON THE CORNER", W / 2, SAFE_TOP + 27, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 4);

        drawText("💰 " + footCoinsRun, 14, SAFE_TOP + 60, "bold 13px Arial", "#FFD700", "#000", 3, "left");

        // Leave door button (bottom).
        var lw = 150, lh = 46, lx = W / 2 - lw / 2, ly = H - lh - 16 - SAFE_BOTTOM;
        schLeaveRect = { x: lx, y: ly, w: lw, h: lh };
        drawButton(lx, ly, lw, lh, "🚪 LEAVE", { bg: "#FF8A65", bgDark: "#D84315" });

        if (isTouchDevice) {
            drawText("tap a person/desk to chat · tap floor to walk", W / 2, ly - 14, "11px Arial", "#FFFFFF", "#000", 2);
        } else {
            drawText("click a person/object to chat · click to walk", W / 2, ly - 14, "11px Arial", "#FFFFFF", "#000", 2);
        }
    }

    // ═══════════════════════ HOSPITAL ═══════════════════════
    //  "🏥 MAIMONIDES-ISH URGENT CARE — WAITING ROOM"
    //  A bright clinic waiting room: reception desk, plastic chairs,
    //  a vending machine, an eye chart, a nervous hypochondriac, a
    //  doctor with terrible advice, and Heshy nursing a pool injury.
    //  Interactions: receptionist (insurance), hypochondriac, doctor,
    //  vending machine (reward OR eats a coin for a laugh), Heshy.

    var hospTime = 0;
    var hospLulu = null;
    var hospSpots = [];
    var hospBubble = "", hospBubbleT = 0, hospBubbleX = 0;
    var hospLeaveRect = { x: 0, y: 0, w: 0, h: 0 };
    var hospFloorY = 0;
    var hospVendShake = 0;       // vending machine wobble timer
    var hospPatientBreath = 0;
    // ── cached gradients ──
    var hospWallGrad = null, hospFloorGrad = null, hospLampGrad = null, hospVignette = null;
    // ── precomputed static layout ──
    var hospChairs = [];         // {x,y}
    var hospTilesV = [];         // vertical tile x positions
    var hospTilesH = [];         // horizontal tile y positions
    var hospDust = [];           // gentle floating dust
    var hospFish = [];           // {x,y,vx,col,ph} fish in the tank
    var hospMags = [];           // magazine rack covers {col,rot}
    // ── dynamic bits ──
    var hospVendHum = 0;         // idle hum wobble phase
    var hospVendIdleT = 3;       // random vending wobble timer
    var hospNurse = null;        // {x, dir, walk, active, wait}
    var hospNurseT = 4;          // time until next nurse crossing
    var hospIvDrip = 0;          // IV drip timer
    var hospServeNum = 7;        // "now serving" counter
    var hospServeT = 8;          // ticks the counter
    var hospServeFlash = 0;
    var hospAmbT = 5;            // ambulance light flash event timer
    var hospAmb = 0;             // ambulance flash active timer
    var hospCough = 0;           // patient cough animation timer
    var hospCoughT = 3;          // time until next cough
    var hospTvFrame = 0;         // TV content index
    var hospTvT = 2;             // TV channel-change timer
    var hospLuluShift = 0;       // Lulu seat-shift wiggle phase

    var HOSP_RECEPTION = [
        "Do you have insurance?\n...A coupon? A blessing? Anything?",
        "Fill out these forms.\nAll forty. Both sides. In pen.",
        "Name? Date of birth?\nMother's maiden complaint?",
        "You're not in the system.\nNobody is. The system is a myth.",
        "Co-pay is twenty dollars\nor one really good piece of babka.",
        "The doctor is running behind.\nBy 'behind' I mean 'last Tuesday'.",
        "Have a seat. And a number.\nAnd a long, contemplative wait.",
        "Is this an emergency or are you\njust cold and want the WiFi?",
        "We take all insurance!\n...We accept none of it. But we TAKE it.",
        "Sign here, here, and here.\nThat last one was a raffle. You won a pen.",
        "Pre-existing condition?\nYes — you exist, and that's a condition.",
        "Please don't cough on the desk.\nCough on the OTHER patients, like normal."
    ];
    var HOSP_PATIENT = [
        "I googled my symptoms.\nIt's either a cold or a dragon.",
        "I've been waiting since BREAKFAST.\nI came for breakfast, actually.",
        "Is it warm in here? I'm warm.\nAm I dying? Be honest.",
        "My cousin had a cousin who\nsneezed once. Never recovered. Tragic.",
        "I have a paper cut.\nI think it's spreading to my SOUL.",
        "Do you smell toast? I smell toast.\nThat's a symptom, right? RIGHT?",
        "I'm only here for the vending\nmachine, honestly. Don't tell.",
        "My left pinky feels... opinionated.\nThat can't be good.",
        "I read one medical article\nand now I'm basically a surgeon.",
        "If I die in this chair,\ntell my bubbe I finished the soup.",
        "They called number twelve.\nI'm number nine hundred. We wait.",
        "Is the doctor cute? Asking for\nmy health. Strictly medical reasons."
    ];
    var HOSP_DOCTOR = [
        "My professional advice?\nDrink water and stop reading WebMD.",
        "Take two rugelach and call\nyour mother in the morning. Always.",
        "It's probably stress.\nWhose isn't? Next patient!",
        "Have you tried... not doing\nthe thing that hurts? Groundbreaking.",
        "I prescribe a nap and a bagel.\nThat'll be four hundred dollars.",
        "Walk it off. Worst case,\nyou walk it off to the ER. Mazel!",
        "On a scale of one to oy,\nhow much does it hurt?",
        "Good news: you'll live.\nBad news: so will the waiting room.",
        "I went to a very good school.\nMostly for the parking. Say 'ahh'.",
        "That rash? Confidence. You have\ntoo much. Tone it down. Heal.",
        "Stick out your tongue.\n...Lovely. No notes. You're cured.",
        "Two aspirin, one chicken soup,\nand absolutely no more stairs."
    ];
    var HOSP_VEND = [
        "C-7... the chips are stuck.\nClassic C-7 behavior.",
        "It took your coin AND your dignity.\nButtons are decorative here.",
        "Press B-4? It dispenses B-5.\nAnd a small existential crisis.",
        "This machine has TRUST issues.\nSo do you now. Welcome.",
        "Kosher snacks only — the machine\nchecks the hechsher, swear to it.",
        "It's leaning forward. Do NOT\nrock it. ...Okay rock it a LITTLE."
    ];
    var HOSP_HESHY = [
        "I bellyflopped, Lu. The POOL won.\nThe pool always wins.",
        "I told the lifeguard I was fine.\nI am, medically, NOT fine.",
        "Cannonball gone wrong.\nWorth it. Ten outta ten. Ow.",
        "My back went 'crunch'.\nThe whole shul heard it. Embarrassing.",
        "Slipped on the pool tiles.\nNow I'm a hospital influencer.",
        "They gave me a lollipop AND\na sling. Best day ever, honestly.",
        "Don't tell Ma I dove off the\nhigh board. ...She's behind me, isn't she.",
        "I'm 'between strokes', the doctor\nsaid. I don't even SWIM strokes!",
        "The deep end disrespected me.\nWe have BEEF now. Me and the deep end.",
        "The X-ray guy said 'wow'.\nYou never want the X-ray guy to say 'wow'.",
        "I'm getting a cast! Sign it?\nDraw something kosher. No goats."
    ];
    // NEW interaction: the fish tank in the corner.
    var HOSP_FISH = [
        "This fish has been to more\nappointments than I have.",
        "They named him Dr. Gills.\nHe's the most qualified one here.",
        "*blub* ...he's judging you.\nFish are very judgmental, mami.",
        "The tank's the only thing in here\nwith good circulation. Lucky guy.",
        "One fish. Big tank. Living the\ndream the rest of us only WAIT for.",
        "He saw what's in that vending\nmachine. He's seen things, Lu."
    ];
    // NEW interaction: the waiting-room TV / magazine rack.
    var HOSP_TV = [
        "It's the news on mute, forever.\nSubtitles two minutes behind. Art.",
        "A cooking show with no sound.\nI THINK that's a brisket. Pray it is.",
        "Channel's stuck on the weather.\nIt's 'partly oy' with a chance of wait.",
        "The remote vanished in 2011.\nWe watch what HaShem decides now.",
        "Daytime TV: where everyone's\ncousin is somehow also their lawyer.",
        "The magazines are from 2006.\nGreat news! The economy's gonna be FINE."
    ];

    function initHospitalInterior() {
        hospTime = 0;
        hospBubble = ""; hospBubbleT = 0; hospBubbleX = W / 2;
        hospVendShake = 0; hospPatientBreath = 0;
        hospFloorY = H * 0.58;
        hospLulu = { x: W / 2, y: hospFloorY + 80, targetX: W / 2, walkTime: 0, mood: "run", facing: 1 };
        var fy = hospFloorY + 80;
        hospSpots = [
            { id: "reception", x: W * 0.50, y: hospFloorY - 8, r: 70, pool: HOSP_RECEPTION },
            { id: "patient",   x: W * 0.18, y: fy,            r: 50, pool: HOSP_PATIENT },
            { id: "doctor",    x: W * 0.82, y: fy - 6,        r: 52, pool: HOSP_DOCTOR },
            { id: "vending",   x: W * 0.90, y: hospFloorY - 6, r: 50, pool: HOSP_VEND, vend: true },
            { id: "heshy",     x: W * 0.34, y: fy + 18,       r: 48, pool: HOSP_HESHY, reward: true },
            { id: "fish",      x: W * 0.66, y: hospFloorY - 36, r: 42, pool: HOSP_FISH },
            { id: "tv",        x: W * 0.14, y: 120,           r: 46, pool: HOSP_TV }
        ];

        // ── cached gradients ──
        hospWallGrad = ctx.createLinearGradient(0, 0, 0, hospFloorY);
        hospWallGrad.addColorStop(0, "#EAF6F5");
        hospWallGrad.addColorStop(0.6, "#E0F2F1");
        hospWallGrad.addColorStop(1, "#CDE9E6");
        hospFloorGrad = ctx.createLinearGradient(0, hospFloorY, 0, H);
        hospFloorGrad.addColorStop(0, "#ECEFF1");
        hospFloorGrad.addColorStop(1, "#CFD8DC");
        // warm reception lamp glow (radial, centered over the desk)
        hospLampGrad = ctx.createRadialGradient(W * 0.50, hospFloorY - 60, 8, W * 0.50, hospFloorY - 60, 150);
        hospLampGrad.addColorStop(0, "rgba(255,224,130,0.45)");
        hospLampGrad.addColorStop(1, "rgba(255,224,130,0)");
        // cool sterile vignette
        hospVignette = ctx.createRadialGradient(W / 2, hospFloorY * 0.5, hospFloorY * 0.4, W / 2, hospFloorY * 0.5, W * 0.7);
        hospVignette.addColorStop(0, "rgba(176,210,224,0)");
        hospVignette.addColorStop(1, "rgba(120,160,180,0.22)");

        // ── precompute chairs ──
        hospChairs = [];
        for (var c = 0; c < 4; c++) hospChairs.push({ x: W * 0.10 + c * 64, y: hospFloorY + 70 });

        // ── precompute floor tile lines ──
        hospTilesV = []; hospTilesH = [];
        for (var tx = 40; tx < W; tx += 60) hospTilesV.push(tx);
        for (var tyy = hospFloorY + 28; tyy < H; tyy += 32) hospTilesH.push(tyy);

        // ── capped floating dust ──
        hospDust = [];
        for (var u = 0; u < 18; u++) {
            hospDust.push({ x: rand(0, W), y: rand(0, hospFloorY), vy: rand(-6, 6),
                vx: rand(-5, 5), ph: rand(0, 6.28), a: rand(0.15, 0.4) });
        }

        // ── precompute fish-tank fish ──
        hospFish = [];
        var fcol = ["#FF7043", "#FFB300", "#42A5F5"];
        for (var fi = 0; fi < 3; fi++) {
            hospFish.push({ x: rand(0.2, 0.8), y: rand(0.25, 0.75), vx: (fi % 2 ? 1 : -1) * rand(0.1, 0.22),
                col: fcol[fi], ph: rand(0, 6.28) });
        }

        // ── precompute magazine rack covers ──
        hospMags = [];
        var mcol = ["#EF5350", "#42A5F5", "#FFCA28", "#66BB6A"];
        for (var mg = 0; mg < 4; mg++) hospMags.push({ col: mcol[mg], rot: rand(-0.12, 0.12) });

        hospVendHum = 0; hospVendIdleT = rand(2, 5);
        hospNurse = null; hospNurseT = rand(4, 8);
        hospIvDrip = 0;
        hospServeNum = randInt(5, 30); hospServeT = rand(6, 11); hospServeFlash = 0;
        hospAmbT = rand(4, 9); hospAmb = 0;
        hospCough = 0; hospCoughT = rand(2.5, 5);
        hospTvFrame = 0; hospTvT = rand(2, 4);
        hospLuluShift = 0;
        playClick();
    }

    function hospSay(spot) {
        hospBubble = randPick(spot.pool);
        hospBubbleT = 3.4;
        hospBubbleX = clamp(spot.x, 80, W - 80);
        playClick();
        if (spot.id === "reception") playTone(440, 0.08, "sine", 0.1);
        if (spot.id === "patient") playTone(620, 0.07, "triangle", 0.12);
        if (spot.id === "doctor") playTone(330, 0.1, "sine", 0.12);
        if (spot.id === "fish") playTone(700, 0.07, "sine", 0.09, 480);
        if (spot.id === "tv") playTone(280, 0.06, "square", 0.08);

        // Vending machine: 60% gives a snack (+coins), 40% eats a coin (gag).
        if (spot.vend) {
            hospVendShake = 0.5;
            if (Math.random() < 0.6) {
                var n = 5;
                footCoinsRun += n; runCoins += n; save.totalCoins += n; persistSave();
                spawnFloater(spot.x, spot.y - 40, "+" + n + " 💰 snack!", "#FFD700");
                playCoin();
                for (var i = 0; i < 8; i++) {
                    particles.push({ x: spot.x + rand(-10, 10), y: spot.y - 10,
                        vx: rand(-50, 50), vy: rand(-30, 60), life: 0.6, maxLife: 0.6,
                        size: rand(3, 6), color: randPick(["#FFD700", "#FF8A65", "#FFF176"]), gravity: 280 });
                }
            } else if (footCoinsRun > 0 || runCoins > 0) {
                footCoinsRun = Math.max(0, footCoinsRun - 1);
                runCoins = Math.max(0, runCoins - 1);
                save.totalCoins = Math.max(0, save.totalCoins - 1); persistSave();
                spawnFloater(spot.x, spot.y - 40, "-1 💸 it ATE it!", "#FF5252");
                playWompWomp();
            } else {
                spawnFloater(spot.x, spot.y - 40, "*clunk* ...nothing.", "#B0BEC5");
                playTone(150, 0.18, "square", 0.14);
            }
            return;
        }
        // Heshy hands over a get-well star the first time, flavor after.
        if (spot.reward) {
            if (!spot._gave) {
                spot._gave = true;
                footAwardStar();
                footCoinsRun += 3; runCoins += 3; save.totalCoins += 3; persistSave();
                spawnFloater(spot.x, spot.y - 36, "+3 💰 get-well gelt!", "#FFD700");
                playHopJump(); playCoin();
            } else {
                playTone(523, 0.08, "triangle", 0.14);
            }
        }
    }

    function updateHospitalInterior(dt) {
        if (!hospLulu) return;
        hospTime += dt;
        updateParticles(dt);
        if (hospBubbleT > 0) hospBubbleT -= dt;
        if (hospVendShake > 0) hospVendShake -= dt;
        hospPatientBreath += dt * 2;
        hospVendHum += dt;
        hospLuluShift += dt;

        // ── Vending machine hums & occasionally wobbles on its own ──
        hospVendIdleT -= dt;
        if (hospVendIdleT <= 0) {
            hospVendIdleT = rand(4, 9);
            hospVendShake = Math.max(hospVendShake, 0.4);
            playTone(110, 0.12, "sawtooth", 0.06);
        }

        // ── Floating dust ──
        for (var u = 0; u < hospDust.length; u++) {
            var dm = hospDust[u];
            dm.x += dm.vx * dt; dm.y += dm.vy * dt; dm.ph += dt;
            if (dm.y < 0) dm.y = hospFloorY; else if (dm.y > hospFloorY) dm.y = 0;
            if (dm.x < 0) dm.x = W; else if (dm.x > W) dm.x = 0;
        }

        // ── Fish swim around the tank ──
        for (var fi = 0; fi < hospFish.length; fi++) {
            var F = hospFish[fi];
            F.x += F.vx * dt; F.ph += dt;
            if (F.x < 0.12) { F.x = 0.12; F.vx = Math.abs(F.vx); }
            if (F.x > 0.88) { F.x = 0.88; F.vx = -Math.abs(F.vx); }
        }

        // ── IV drip drips (spawns a tiny falling bead occasionally) ──
        hospIvDrip -= dt;
        if (hospIvDrip <= 0) {
            hospIvDrip = rand(0.8, 1.6);
            particles.push({ x: W * 0.74, y: hospFloorY - 64, vx: 0, vy: 20, life: 0.7, maxLife: 0.7,
                size: 2, color: "#4FC3F7", gravity: 120 });
        }

        // ── Nurse crosses with a clipboard ──
        hospNurseT -= dt;
        if (!hospNurse && hospNurseT <= 0) {
            hospNurseT = rand(7, 13);
            var fromL = Math.random() < 0.5;
            hospNurse = { x: fromL ? -30 : W + 30, dir: fromL ? 1 : -1, walk: 0 };
        }
        if (hospNurse) {
            hospNurse.x += hospNurse.dir * 90 * dt;
            hospNurse.walk += dt * 6;
            if (hospNurse.x < -50 || hospNurse.x > W + 50) hospNurse = null;
        }

        // ── "Now serving" counter ticks up ──
        if (hospServeFlash > 0) hospServeFlash -= dt;
        hospServeT -= dt;
        if (hospServeT <= 0) {
            hospServeT = rand(7, 13);
            hospServeNum++;
            hospServeFlash = 0.8;
            playTone(880, 0.07, "sine", 0.1);
            playTone(660, 0.1, "sine", 0.08);
        }

        // ── Ambulance light flashes through the window ──
        hospAmbT -= dt;
        if (hospAmb > 0) hospAmb -= dt;
        if (hospAmbT <= 0) { hospAmbT = rand(9, 16); hospAmb = 2.4; }

        // ── Hypochondriac coughs/fidgets ──
        if (hospCough > 0) hospCough -= dt;
        hospCoughT -= dt;
        if (hospCoughT <= 0) {
            hospCoughT = rand(3, 6);
            hospCough = 0.5;
            playTone(220, 0.09, "square", 0.08);
            playTone(180, 0.12, "square", 0.06);
        }

        // ── TV channel content cycles ──
        hospTvT -= dt;
        if (hospTvT <= 0) { hospTvT = rand(2.5, 5); hospTvFrame = (hospTvFrame + 1) % 4; }

        hospLulu.x = lerp(hospLulu.x, hospLulu.targetX, Math.min(1, 9 * dt));
        if (Math.abs(hospLulu.x - hospLulu.targetX) > 1.5) {
            hospLulu.walkTime += dt * 3.2;
            hospLulu.facing = hospLulu.targetX > hospLulu.x ? 1 : -1;
        }

        var click = consumeClick();
        if (click) {
            if (pointInRect(click.x, click.y, hospLeaveRect.x, hospLeaveRect.y, hospLeaveRect.w, hospLeaveRect.h)) {
                playClick(); exitFootInterior(); return;
            }
            var hit = null;
            for (var i = 0; i < hospSpots.length; i++) {
                var sp = hospSpots[i];
                var dx = click.x - sp.x, dy = click.y - sp.y;
                if (dx * dx + dy * dy < sp.r * sp.r) { hit = sp; break; }
            }
            if (hit) { hospLulu.targetX = clamp(hit.x, 40, W - 40); hospSay(hit); }
            else hospLulu.targetX = clamp(click.x, 40, W - 40);
        }
    }

    function hospDrawChair(x, y) {
        ctx.fillStyle = "#7E57C2"; roundRect(x - 12, y - 4, 24, 8, 3); ctx.fill();   // seat
        ctx.fillStyle = "#5E35B1"; roundRect(x - 12, y - 22, 24, 20, 4); ctx.fill(); // back
        ctx.fillStyle = "#37474F"; ctx.fillRect(x - 10, y + 4, 3, 12); ctx.fillRect(x + 7, y + 4, 3, 12); // legs
    }

    function hospDrawPatient(x, y, breath) {
        ctx.save(); ctx.translate(x, y);
        var b = Math.sin(breath) * 1.2;
        ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0, 16, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
        // sitting body (green sweater), shoulders rising with anxious breath
        ctx.fillStyle = "#43A047"; roundRect(-12, -14 + b, 24, 26, 7); ctx.fill();
        // nervous hands clasped
        ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(-3, 6 + b, 3, 0, Math.PI * 2); ctx.arc(3, 6 + b, 3, 0, Math.PI * 2); ctx.fill();
        // head
        ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(0, -24 + b, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#6D4C41"; ctx.beginPath(); ctx.arc(0, -27 + b, 11, Math.PI, Math.PI * 2); ctx.fill();
        // worried face + sweat bead
        ctx.strokeStyle = "#3D2817"; ctx.lineWidth = 1.4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(-3.5, -25 + b, 1.8, 0, Math.PI * 2); ctx.arc(3.5, -25 + b, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = "#000"; ctx.fill();
        ctx.beginPath(); ctx.moveTo(-6, -29 + b); ctx.lineTo(-2, -28 + b); ctx.moveTo(6, -29 + b); ctx.lineTo(2, -28 + b); ctx.stroke(); // worried brows
        ctx.beginPath(); ctx.arc(0, -19 + b, 2.5, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke(); // frown
        ctx.lineCap = "butt";
        ctx.fillStyle = "#4FC3F7"; ctx.beginPath(); ctx.arc(9, -22 + b + Math.abs(Math.sin(breath * 1.3)) * 3, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function hospDrawDoctor(x, y, t) {
        ctx.save(); ctx.translate(x, y);
        var bob = Math.sin(t * 2.5) * 1.5;
        ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0, 20, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
        // white coat
        ctx.fillStyle = "#FFFFFF"; roundRect(-15, -8 + bob, 30, 36, 6); ctx.fill();
        ctx.strokeStyle = "#CFD8DC"; ctx.lineWidth = 1; roundRect(-15, -8 + bob, 30, 36, 6); ctx.stroke();
        // teal scrubs collar
        ctx.fillStyle = "#26A69A"; ctx.beginPath(); ctx.moveTo(-6, -8 + bob); ctx.lineTo(0, 2 + bob); ctx.lineTo(6, -8 + bob); ctx.closePath(); ctx.fill();
        // stethoscope
        ctx.strokeStyle = "#37474F"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-5, -6 + bob); ctx.quadraticCurveTo(0, 16 + bob, 7, 6 + bob); ctx.stroke();
        ctx.fillStyle = "#90A4AE"; ctx.beginPath(); ctx.arc(7, 7 + bob, 3, 0, Math.PI * 2); ctx.fill();
        // head
        ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(0, -22 + bob, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3E2723"; ctx.beginPath(); ctx.arc(0, -25 + bob, 11, Math.PI, Math.PI * 2); ctx.fill();
        // confident face
        ctx.strokeStyle = "#3D2817"; ctx.lineWidth = 1.4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(-3.5, -22 + bob, 1.5, 0, Math.PI * 2); ctx.arc(3.5, -22 + bob, 1.5, 0, Math.PI * 2); ctx.fillStyle = "#000"; ctx.fill();
        ctx.beginPath(); ctx.arc(0, -19 + bob, 3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        ctx.lineCap = "butt";
        // head mirror
        ctx.fillStyle = "#E0E0E0"; ctx.beginPath(); ctx.arc(0, -30 + bob, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#90A4AE"; ctx.beginPath(); ctx.arc(0, -30 + bob, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function hospDrawHeshy(x, y, t) {
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0, 16, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
        // sitting, swim trunks + towel
        ctx.fillStyle = "#1E88E5"; roundRect(-12, -10, 24, 24, 6); ctx.fill();
        ctx.fillStyle = "#FFCA28"; roundRect(-13, -2, 26, 8, 3); ctx.fill();     // towel
        // arm in a sling
        ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(6, 4); ctx.lineTo(-12, 8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#B0BEC5"; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(4, 2, 3, 0, Math.PI * 2); ctx.fill(); // hand poking out
        // head + wet hair + kippah
        ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(0, -22, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#4E342E"; ctx.beginPath(); ctx.arc(0, -25, 11, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0D47A1"; ctx.beginPath(); ctx.arc(0, -28, 6, Math.PI, Math.PI * 2); ctx.fill();
        // dripping bead
        ctx.fillStyle = "#4FC3F7"; ctx.beginPath(); ctx.arc(8, -16 + Math.abs(Math.sin(t * 2)) * 4, 1.4, 0, Math.PI * 2); ctx.fill();
        // ow face
        ctx.strokeStyle = "#3D2817"; ctx.lineWidth = 1.4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-5, -23); ctx.lineTo(-1, -24); ctx.moveTo(5, -23); ctx.lineTo(1, -24); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, -18, 2, 1.6, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.lineCap = "butt";
        // bandage on knee
        ctx.fillStyle = "#FFF"; ctx.fillRect(-8, 8, 8, 5);
        ctx.strokeStyle = "#E0E0E0"; ctx.strokeRect(-8, 8, 8, 5);
        ctx.restore();
    }

    function hospDrawScene() {
        // Clinic wall (clean mint) — cached gradient — + a colored stripe.
        ctx.fillStyle = hospWallGrad; ctx.fillRect(0, 0, W, hospFloorY);

        // ── Ambulance light flashing through a back window (left of center) ──
        var winX = W * 0.30, winY = 18, winW = 70, winH = 54;
        ctx.fillStyle = "#37474F"; roundRect(winX - 3, winY - 3, winW + 6, winH + 6, 4); ctx.fill();
        ctx.fillStyle = "#1A2530"; roundRect(winX, winY, winW, winH, 3); ctx.fill(); // night outside
        // distant building dots
        ctx.fillStyle = "#455A64";
        ctx.fillRect(winX + 8, winY + 28, 12, 26); ctx.fillRect(winX + 26, winY + 18, 14, 36);
        ctx.fillRect(winX + 46, winY + 24, 12, 30);
        ctx.fillStyle = "#FFF59D"; ctx.fillRect(winX + 30, winY + 24, 4, 4); ctx.fillRect(winX + 50, winY + 30, 3, 3);
        if (hospAmb > 0) {
            var amb = (Math.sin(hospTime * 14) > 0) ? "rgba(244,67,54,0.5)" : "rgba(33,150,243,0.5)";
            ctx.save(); ctx.globalAlpha = clamp(hospAmb, 0, 1);
            ctx.fillStyle = amb; roundRect(winX, winY, winW, winH, 3); ctx.fill();
            // beam spilling into the room
            ctx.globalAlpha = clamp(hospAmb, 0, 1) * 0.3;
            ctx.fillStyle = amb; ctx.beginPath();
            ctx.moveTo(winX, winY + winH); ctx.lineTo(winX + winW, winY + winH);
            ctx.lineTo(winX + winW + 40, hospFloorY); ctx.lineTo(winX - 40, hospFloorY); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(winX + winW / 2, winY); ctx.lineTo(winX + winW / 2, winY + winH); ctx.stroke();

        ctx.fillStyle = "#26A69A"; ctx.fillRect(0, hospFloorY - 30, W, 8);
        ctx.fillStyle = "#B2DFDB"; ctx.fillRect(0, hospFloorY - 22, W, 22);

        // Speckled tile floor — cached gradient + precomputed tile lines.
        ctx.fillStyle = hospFloorGrad; ctx.fillRect(0, hospFloorY, W, H - hospFloorY);
        ctx.strokeStyle = "rgba(120,144,156,0.35)"; ctx.lineWidth = 1;
        for (var iv = 0; iv < hospTilesV.length; iv++) {
            var tvx = hospTilesV[iv];
            ctx.beginPath(); ctx.moveTo(tvx, hospFloorY); ctx.lineTo(tvx + (tvx - W / 2) * 0.4, H); ctx.stroke();
        }
        for (var ih = 0; ih < hospTilesH.length; ih++) {
            ctx.beginPath(); ctx.moveTo(0, hospTilesH[ih]); ctx.lineTo(W, hospTilesH[ih]); ctx.stroke();
        }

        // Warm reception lamp glow pooled over the desk.
        ctx.fillStyle = hospLampGrad; ctx.fillRect(0, 0, W, hospFloorY + 40);

        // Red cross sign + clock on the back wall.
        ctx.fillStyle = "#FFFFFF"; roundRect(20, 16, 46, 46, 8); ctx.fill();
        ctx.strokeStyle = "#E53935"; ctx.lineWidth = 3; roundRect(20, 16, 46, 46, 8); ctx.stroke();
        ctx.fillStyle = "#E53935"; ctx.fillRect(38, 24, 10, 30); ctx.fillRect(28, 34, 30, 10);
        // wall clock (ticking)
        var clkX = W - 44, clkY = 40;
        ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(clkX, clkY, 18, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#37474F"; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(clkX, clkY); ctx.lineTo(clkX + Math.cos(hospTime) * 10, clkY + Math.sin(hospTime) * 10); ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(clkX, clkY); ctx.lineTo(clkX + Math.cos(hospTime * 0.2) * 6, clkY + Math.sin(hospTime * 0.2) * 6); ctx.stroke();

        // Eye chart (back-left).
        ctx.fillStyle = "#FFFFFF"; roundRect(86, 18, 60, 80, 4); ctx.fill();
        ctx.strokeStyle = "#90A4AE"; ctx.lineWidth = 1; roundRect(86, 18, 60, 80, 4); ctx.stroke();
        drawText("E", 116, 32, "bold 18px Arial", "#000", null, 0);
        drawText("F P", 116, 48, "bold 13px Arial", "#000", null, 0);
        drawText("T O Z", 116, 62, "bold 10px Arial", "#000", null, 0);
        drawText("OY VEY", 116, 76, "bold 8px Arial", "#000", null, 0);
        drawText("בהצלחה", 116, 88, "bold 6px Arial", "#888", null, 0);

        // Reception desk (center).
        var r = hospSpots[0];
        ctx.fillStyle = "#5D4037"; roundRect(r.x - 90, r.y - 14, 180, 50, 6); ctx.fill();
        ctx.fillStyle = "#795548"; roundRect(r.x - 90, r.y - 14, 180, 12, 6); ctx.fill(); // counter top
        ctx.fillStyle = "#3E2723"; roundRect(r.x - 90, r.y - 2, 180, 38, 0); ctx.fill();
        // monitor
        ctx.fillStyle = "#263238"; roundRect(r.x - 70, r.y - 40, 34, 24, 3); ctx.fill();
        ctx.fillStyle = "#4FC3F7"; ctx.fillRect(r.x - 66, r.y - 36, 26, 16);
        // "RECEPTION" sign hanging
        ctx.fillStyle = "#00897B"; roundRect(r.x - 56, r.y - 76, 112, 22, 5); ctx.fill();
        drawText("RECEPTION", r.x, r.y - 65, "bold 13px Arial", "#FFFFFF", null, 0);
        // bell + clipboard
        ctx.fillStyle = "#FFD54F"; ctx.beginPath(); ctx.arc(r.x + 56, r.y - 8, 5, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFF"; roundRect(r.x + 30, r.y - 6, 14, 18, 2); ctx.fill();
        // receptionist head behind desk
        ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(r.x, r.y - 26 + Math.sin(hospTime * 2) * 1.5, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#8E5A3C"; ctx.beginPath(); ctx.arc(r.x, r.y - 30 + Math.sin(hospTime * 2) * 1.5, 12, Math.PI, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#3D2817"; ctx.lineWidth = 1.4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(r.x - 3.5, r.y - 26, 1.4, 0, Math.PI * 2); ctx.arc(r.x + 3.5, r.y - 26, 1.4, 0, Math.PI * 2); ctx.fillStyle = "#000"; ctx.fill();
        ctx.beginPath(); ctx.moveTo(r.x - 3, r.y - 21); ctx.lineTo(r.x + 3, r.y - 21); ctx.stroke(); // flat unimpressed mouth
        ctx.lineCap = "butt";

        // ── "NOW SERVING" counter above the desk ──
        var nsX = r.x, nsY = r.y - 92;
        ctx.fillStyle = "#212121"; roundRect(nsX - 44, nsY - 12, 88, 24, 4); ctx.fill();
        drawText("NOW SERVING", nsX - 16, nsY - 1, "bold 7px Arial", "#80CBC4", null, 0);
        var nsCol = hospServeFlash > 0 ? "#FF5252" : "#FF7043";
        drawText("#" + hospServeNum, nsX + 28, nsY + 2, "bold 14px 'Courier New', monospace", nsCol, null, 0);
    }

    // Wall-mounted waiting-room TV (muted, content cycles).
    function hospDrawTV(x, y) {
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = "#212121"; roundRect(-30, -22, 60, 44, 4); ctx.fill();
        ctx.strokeStyle = "#000"; ctx.lineWidth = 2; roundRect(-30, -22, 60, 44, 4); ctx.stroke();
        // mount arm
        ctx.fillStyle = "#455A64"; ctx.fillRect(-3, -34, 6, 12);
        // screen content by frame
        var f = hospTvFrame;
        if (f === 0) { // news with lower-third
            ctx.fillStyle = "#1565C0"; ctx.fillRect(-26, -18, 52, 36);
            ctx.fillStyle = "#FFCA28"; ctx.beginPath(); ctx.arc(0, -4, 6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#E53935"; ctx.fillRect(-26, 8, 52, 10);
            ctx.fillStyle = "#FFF"; ctx.fillRect(-23, 11, 30, 3);
        } else if (f === 1) { // cooking show
            ctx.fillStyle = "#FFE0B2"; ctx.fillRect(-26, -18, 52, 36);
            ctx.fillStyle = "#8D6E63"; ctx.fillRect(-14, 2, 28, 10);
            ctx.fillStyle = "#A1674A"; ctx.beginPath(); ctx.arc(0, 2, 8, Math.PI, Math.PI * 2); ctx.fill();
        } else if (f === 2) { // weather map
            ctx.fillStyle = "#0D47A1"; ctx.fillRect(-26, -18, 52, 36);
            ctx.fillStyle = "#90CAF9"; ctx.fillRect(-18, -10, 36, 22);
            ctx.fillStyle = "#FFEB3B"; ctx.beginPath(); ctx.arc(10, -2, 5, 0, Math.PI * 2); ctx.fill();
        } else { // static / snow
            ctx.fillStyle = "#9E9E9E"; ctx.fillRect(-26, -18, 52, 36);
            ctx.fillStyle = "rgba(255,255,255,0.6)";
            for (var s = 0; s < 14; s++) {
                ctx.fillRect(-24 + ((s * 37 + hospTvFrame * 11) % 48), -16 + ((s * 53) % 32), 2, 2);
            }
        }
        // glow flicker
        ctx.fillStyle = "rgba(180,210,255," + (0.06 + 0.04 * Math.sin(hospTime * 9)) + ")";
        ctx.fillRect(-26, -18, 52, 36);
        ctx.restore();
    }

    // Corner fish tank (a hotspot prop).
    function hospDrawFishTank(x, y) {
        ctx.save(); ctx.translate(x, y);
        var w = 64, h = 44;
        // stand
        ctx.fillStyle = "#5D4037"; ctx.fillRect(-w / 2 - 2, h / 2, w + 4, 14);
        // water
        ctx.fillStyle = "#4DD0E1"; roundRect(-w / 2, -h / 2, w, h, 4); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.18)"; roundRect(-w / 2, -h / 2, w, h * 0.4, 4); ctx.fill();
        // gravel
        ctx.fillStyle = "#8D6E63"; ctx.fillRect(-w / 2, h / 2 - 6, w, 6);
        // plants
        ctx.strokeStyle = "#388E3C"; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-18, h / 2 - 6); ctx.quadraticCurveTo(-22, 0, -16, -8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(18, h / 2 - 6); ctx.quadraticCurveTo(22, 2, 14, -6); ctx.stroke();
        ctx.lineCap = "butt";
        // fish (precomputed, drifting)
        for (var fi = 0; fi < hospFish.length; fi++) {
            var F = hospFish[fi];
            var fx = -w / 2 + F.x * w, fy = -h / 2 + F.y * h + Math.sin(F.ph) * 2;
            ctx.save(); ctx.translate(fx, fy); ctx.scale(F.vx < 0 ? -1 : 1, 1);
            ctx.fillStyle = F.col; ctx.beginPath(); ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-9, -3); ctx.lineTo(-9, 3); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(3, -1, 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        // bubbles
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        for (var bb = 0; bb < 3; bb++) {
            var by = (h / 2 - 6) - ((hospTime * 18 + bb * 16) % (h - 8));
            ctx.beginPath(); ctx.arc(-12 + Math.sin(hospTime * 3 + bb) * 2, by, 1.4, 0, Math.PI * 2); ctx.fill();
        }
        // glass frame
        ctx.strokeStyle = "#90A4AE"; ctx.lineWidth = 2; roundRect(-w / 2, -h / 2, w, h, 4); ctx.stroke();
        ctx.restore();
    }

    // IV drip pole (ambient prop, drips handled in update).
    function hospDrawIvPole(x) {
        var topY = hospFloorY - 86, botY = hospFloorY + 4;
        ctx.strokeStyle = "#B0BEC5"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, topY); ctx.lineTo(x, botY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 8, topY); ctx.lineTo(x + 8, topY); ctx.stroke();
        // bag
        ctx.fillStyle = "rgba(178,235,233,0.85)"; roundRect(x + 2, topY + 2, 14, 22, 4); ctx.fill();
        ctx.strokeStyle = "#80CBC4"; ctx.lineWidth = 1; roundRect(x + 2, topY + 2, 14, 22, 4); ctx.stroke();
        // wheels
        ctx.fillStyle = "#607D8B"; ctx.beginPath(); ctx.arc(x - 6, botY, 3, 0, Math.PI * 2); ctx.arc(x + 6, botY, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Magazine rack near the chairs.
    function hospDrawMagRack(x, y) {
        ctx.fillStyle = "#90A4AE"; roundRect(x - 22, y, 44, 6, 2); ctx.fill();
        ctx.fillStyle = "#607D8B"; ctx.fillRect(x - 20, y + 6, 3, 16); ctx.fillRect(x + 17, y + 6, 3, 16);
        for (var m = 0; m < hospMags.length; m++) {
            ctx.save(); ctx.translate(x - 16 + m * 10, y - 8); ctx.rotate(hospMags[m].rot);
            ctx.fillStyle = hospMags[m].col; roundRect(-5, -12, 10, 16, 1); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fillRect(-3, -9, 6, 2);
            ctx.restore();
        }
    }

    // Nurse crossing with a clipboard.
    function hospDrawNurse(N) {
        ctx.save(); ctx.translate(N.x, hospFloorY + 50); ctx.scale(N.dir, 1);
        var legS = Math.sin(N.walk) * 5;
        ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(0, 22, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#26A69A"; roundRect(-5, 6 - legS, 5, 16 + legS, 2); ctx.fill();
        roundRect(1, 6 + legS, 5, 16 - legS, 2); ctx.fill();
        ctx.fillStyle = "#4DB6AC"; roundRect(-11, -12, 22, 22, 6); ctx.fill();  // scrub top
        // clipboard
        ctx.fillStyle = "#FFF"; roundRect(8, -4, 9, 12, 1); ctx.fill();
        ctx.strokeStyle = "#90A4AE"; ctx.lineWidth = 1; roundRect(8, -4, 9, 12, 1); ctx.stroke();
        // head + cap
        ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(0, -22, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#6D4C41"; ctx.beginPath(); ctx.arc(0, -25, 10, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFF"; roundRect(-7, -30, 14, 6, 2); ctx.fill();
        ctx.fillStyle = "#E53935"; ctx.fillRect(-1, -29, 2, 4); ctx.fillRect(-2, -28, 4, 2);
        ctx.restore();
    }

    function hospDrawVending(x, y, shake) {
        ctx.save();
        var sx = shake > 0 ? Math.sin(shake * 50) * 2 : 0;
        ctx.translate(x + sx, y);
        // cabinet
        ctx.fillStyle = "#C62828"; roundRect(-26, -100, 52, 116, 6); ctx.fill();
        ctx.strokeStyle = "#7F1D1D"; ctx.lineWidth = 2; roundRect(-26, -100, 52, 116, 6); ctx.stroke();
        // glass front with shelves of snacks
        ctx.fillStyle = "#37474F"; roundRect(-20, -94, 32, 78, 3); ctx.fill();
        var snackCols = ["#FF8A65", "#FFD54F", "#4FC3F7", "#AED581", "#BA68C8", "#FFB74D"];
        for (var row = 0; row < 4; row++) {
            for (var col = 0; col < 3; col++) {
                ctx.fillStyle = snackCols[(row * 3 + col) % snackCols.length];
                roundRect(-18 + col * 10, -90 + row * 18, 7, 12, 2); ctx.fill();
            }
        }
        // keypad + slot
        ctx.fillStyle = "#212121"; roundRect(-22, -12, 14, 24, 2); ctx.fill();
        ctx.fillStyle = "#4CAF50"; ctx.beginPath(); ctx.arc(-19, -8, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1A1A1A"; roundRect(-8, 4, 30, 6, 2); ctx.fill(); // dispense slot
        drawText("SNAX", 0, -103, "bold 9px Arial", "#FFF", "#7F1D1D", 2);
        ctx.restore();
    }

    function drawHospitalInterior() {
        ctx.save();

        hospDrawScene();

        // Wall TV (back-left) + fish tank (mid-right) — ambient hotspots.
        var tv = hospSpots[6];
        hospDrawTV(tv.x, tv.y);
        var fishT = hospSpots[5];
        hospDrawFishTank(fishT.x, fishT.y);

        // IV pole near the doctor's side.
        hospDrawIvPole(W * 0.74);

        // Plastic waiting-room chairs in a row up front (precomputed).
        for (var c = 0; c < hospChairs.length; c++) hospDrawChair(hospChairs[c].x, hospChairs[c].y);

        // Magazine rack tucked by the chairs.
        hospDrawMagRack(W * 0.10 + 4 * 64 + 10, hospFloorY + 64);

        // ── Floating dust motes (between props and NPCs) ──
        ctx.save(); ctx.fillStyle = "#FFFFFF";
        for (var u = 0; u < hospDust.length; u++) {
            var dm = hospDust[u];
            ctx.globalAlpha = dm.a * (0.5 + 0.5 * Math.sin(dm.ph));
            ctx.beginPath(); ctx.arc(dm.x, dm.y, 1.3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        // Vending machine (far right).
        var v = hospSpots[3];
        hospDrawVending(v.x, v.y, hospVendShake);

        // Doctor (right).
        var dr = hospSpots[2];
        hospDrawDoctor(dr.x, dr.y, hospTime);

        // Nervous patient (left, on a chair) — coughs/leans forward periodically.
        var pt = hospSpots[1];
        var cough = hospCough > 0 ? clamp(hospCough * 2, 0, 1) : 0;
        ctx.save(); ctx.translate(0, cough * 3);
        hospDrawPatient(pt.x, pt.y, hospPatientBreath);
        if (cough > 0) {
            ctx.globalAlpha = cough * 0.8;
            drawText("*kof kof*", pt.x + 24, pt.y - 40, "italic 10px Arial", "#90A4AE", "#FFF", 2);
            ctx.globalAlpha = 1;
        }
        ctx.restore();

        // Heshy with pool injury (mid-left).
        var he = hospSpots[4];
        hospDrawHeshy(he.x, he.y, hospTime);

        // Nurse crossing with a clipboard (in front of the chairs).
        if (hospNurse) hospDrawNurse(hospNurse);

        // Lulu (shifts in her waiting chair when idle).
        var idle = Math.abs(hospLulu.x - hospLulu.targetX) <= 1.5;
        ctx.save();
        if (idle) ctx.translate(Math.sin(hospLuluShift * 1.4) * 1.5, 0);
        drawLuluTopDown(hospLulu.x, hospLulu.y, hospLulu.walkTime, hospLulu.mood);
        ctx.restore();

        drawParticles();

        if (hospBubbleT > 0) {
            ctx.globalAlpha = clamp(hospBubbleT, 0, 1);
            drawSpeechBubble(hospBubbleX, hospFloorY + 26, hospBubble, hospTime * 4);
            ctx.globalAlpha = 1;
        }

        // Cool sterile vignette over the whole room (cached gradient).
        ctx.fillStyle = hospVignette; ctx.fillRect(0, 0, W, H);

        ctx.restore();

        // ── HUD ──
        ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(20, SAFE_TOP + 8, W - 40, 38, 10); ctx.fill();
        drawText("🏥 URGENT CARE — WAITING ROOM", W / 2, SAFE_TOP + 27, "bold 14px 'Segoe UI', Arial, sans-serif", "#B2DFDB", "#000", 4);

        drawText("💰 " + footCoinsRun, 14, SAFE_TOP + 60, "bold 13px Arial", "#FFD700", "#000", 3, "left");

        var lw = 150, lh = 46, lx = W / 2 - lw / 2, ly = H - lh - 16 - SAFE_BOTTOM;
        hospLeaveRect = { x: lx, y: ly, w: lw, h: lh };
        drawButton(lx, ly, lw, lh, "🚪 LEAVE", { bg: "#4DB6AC", bgDark: "#00695C" });

        if (isTouchDevice) {
            drawText("tap a person/machine to chat · tap floor to walk", W / 2, ly - 14, "11px Arial", "#FFFFFF", "#000", 2);
        } else {
            drawText("click a person/object to chat · click to walk", W / 2, ly - 14, "11px Arial", "#FFFFFF", "#000", 2);
        }
    }
