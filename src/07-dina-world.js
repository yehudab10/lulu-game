    function updateCharSelect(dt) {
        charSelectTime += dt;
        var click = consumeClick();
        if (click) {
            // Lulu card top half H*0.18 - H*0.50
            if (click.y > H * 0.18 && click.y < H * 0.50) {
                selectedChar = "lulu";
                gotoState("menu");
                playCharSelect();
                return;
            }
            // Dina card bottom half H*0.52 - H*0.88
            if (click.y > H * 0.52 && click.y < H * 0.88) {
                selectedChar = "dina";
                playCharSelect();
                // Enter dina mode at the fade midpoint (only if the fade actually started)
                gotoState("dinaBus", function () { startDinaMode(); });
                return;
            }
        }
        if (consumeAction()) {
            // default to Lulu if no click but space pressed
            selectedChar = "lulu";
            state = "menu";
        }
    }

    function drawCharSelect() {
        // Cohesive sky-to-grass gradient to match the rest of the game
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#A8E6CF");
        g.addColorStop(0.55, "#FFE3B0");
        g.addColorStop(1, "#7CB342");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        // warm sun-glow up top
        var csSun = ctx.createRadialGradient(W / 2, 50, 20, W / 2, 50, 280);
        csSun.addColorStop(0, "rgba(255,248,205,0.55)"); csSun.addColorStop(1, "rgba(255,248,205,0)");
        ctx.fillStyle = csSun; ctx.fillRect(0, 0, W, 340);
        // soft drifting clouds
        for (var cc = 0; cc < 3; cc++) {
            var clx = ((charSelectTime * (7 + cc * 4) + cc * 210) % (W + 180)) - 90;
            var cly = 46 + cc * 30, cls = 1 - cc * 0.16;
            ctx.fillStyle = "rgba(255,255,255," + (0.55 - cc * 0.1) + ")";
            ctx.beginPath();
            ctx.ellipse(clx, cly, 34 * cls, 16 * cls, 0, 0, Math.PI * 2);
            ctx.ellipse(clx + 26 * cls, cly + 4, 24 * cls, 13 * cls, 0, 0, Math.PI * 2);
            ctx.ellipse(clx - 26 * cls, cly + 4, 22 * cls, 12 * cls, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        // Chunky dark band behind title for contrast
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        roundRect(W / 2 - 180, 40, 360, 50, 14); ctx.fill();
        // Drifting confetti — a mix of dots and little stars
        ctx.globalAlpha = 0.7;
        for (var i = 0; i < 40; i++) {
            var x = (i * 47 + 13) % W;
            var y = ((i * 31 + 9) + charSelectTime * 20) % H;
            ctx.fillStyle = ["#FF4FA3", "#FFD93D", "#6BCBFF", "#A8E6CF", "#FFFFFF"][i % 5];
            if (i % 4 === 0) {
                drawText("✦", x, y, (8 + (i % 3) * 3) + "px Arial", ctx.fillStyle, null, 0);
            } else {
                ctx.beginPath(); ctx.arc(x, y, 3 + (i % 3), 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.globalAlpha = 1;

        // Header wobble
        var wob = Math.sin(charSelectTime * 3) * 4;
        drawText("Pick a Bruck Sister!", W / 2, 70 + wob, "bold 32px 'Segoe UI', Arial, sans-serif",
            "#FFFFFF", "#7A2A5C", 6);

        // Lulu Card
        drawCharCard(50, H * 0.18, 380, H * 0.32, "lulu",
            "Lulu — 18", "Pink car. Big sister energy.", "#FF4FA3");
        // Dina Card
        drawCharCard(50, H * 0.52, 380, H * 0.34, "dina",
            "Dina — 8", "Has Morgan. Runs fast.", "#A06DC8");

        // Footer
        drawText("Tap a sister to play!", W / 2, H - 42,
            "bold 16px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#7A2A5C", 4);
        // the THIRD Bruck sister isn't playable — she's at work (nod to Tammy)
        drawText("🏥 (Tammy's working a shift — she's a nurse)", W / 2, H - 18,
            "italic 11px 'Segoe UI', Arial, sans-serif", "rgba(255,255,255,0.72)", "#7A2A5C", 3);

        // soft frame vignette to draw the eye to the cards
        var csVig = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.34, W / 2, H * 0.5, H * 0.72);
        csVig.addColorStop(0, "rgba(0,0,0,0)"); csVig.addColorStop(1, "rgba(40,20,40,0.20)");
        ctx.fillStyle = csVig; ctx.fillRect(0, 0, W, H);
    }

    function drawCharCard(x, y, w, h, who, name, tagline, accent) {
        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        roundRect(x + 5, y + 6, w, h, 18); ctx.fill();
        // card body — soft top-lit gradient instead of a flat fill
        var cardG = ctx.createLinearGradient(0, y, 0, y + h);
        cardG.addColorStop(0, "#FFFDF8"); cardG.addColorStop(1, "#FCEAF1");
        ctx.fillStyle = cardG;
        roundRect(x, y, w, h, 18); ctx.fill();
        // accent stripe with a glossy sheen
        ctx.fillStyle = accent;
        roundRect(x, y, w, 36, 18); ctx.fill();
        ctx.fillRect(x, y + 18, w, 18);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        roundRect(x + 10, y + 6, w - 20, 9, 5); ctx.fill();
        // border
        ctx.strokeStyle = accent;
        ctx.lineWidth = 5;
        roundRect(x, y, w, h, 18); ctx.stroke();
        // header text
        drawText(name, x + w / 2, y + 18, "bold 22px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#000", 3);
        // Portrait
        var portraitX = x + w / 2;
        var portraitY = y + h * 0.45 + 30;
        ctx.save();
        // Soft glow under portrait
        var grad = ctx.createRadialGradient(portraitX, portraitY + 30, 10, portraitX, portraitY + 30, 80);
        grad.addColorStop(0, "rgba(255,255,255,0.6)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(x, y + 40, w, h - 40);
        ctx.restore();
        var bob = Math.sin(charSelectTime * 2.5 + (who === "dina" ? 1 : 0)) * 4;
        if (who === "lulu") drawLuluPortrait(portraitX, portraitY + bob, charSelectTime, 0.95);
        else drawDinaPortrait(portraitX, portraitY + bob, charSelectTime, 0.95);
        // Tagline below
        drawText(tagline, x + w / 2, y + h - 16, "italic 14px 'Segoe UI', Arial, sans-serif",
            "#555", "#FFF", 2);
        // "TAP" badge in corner — gently pulsing to invite a tap
        var tp = 1 + Math.sin(charSelectTime * 4 + (who === "dina" ? 1.5 : 0)) * 0.07;
        ctx.save(); ctx.translate(x + w - 40, y + h - 23); ctx.scale(tp, tp);
        ctx.fillStyle = accent; roundRect(-30, -13, 60, 26, 13); ctx.fill();
        drawText("TAP ▶", 0, 0, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFF", null, 0);
        ctx.restore();
    }

    function startDinaMode() {
        state = "dinaBus";
        dinaRunPhase = 0;
        dinaRunTimer = 0;
        dinaRunDistance = 0;
        dinaCoinsRun = 0;
        dinaStickers = 0;
        dina = { x: W / 2 + 30, y: 350, walkTime: 0, vx: 0, vy: 0, sprintTimer: 3,
                 sprintCool: 0, stumble: 0, holding: "backpack",
                 targetX: W / 2, targetY: 350 };
        schoolBus = { x: W + 220, y: 140, phase: 0, timer: 0, doorOpen: 0 };
        schoolGirls = [];
        particles.length = 0; // start the intro with a clean particle layer
        // Pre-populate girls who will come off
        for (var g = 0; g < 6; g++) {
            schoolGirls.push({
                spawn: 2.1 + g * 0.3, // when they appear (in seconds)
                onBus: true,
                x: 335, y: 195,
                vx: rand(-30, 30),
                vy: rand(40, 80),
                walkTime: 0,
                hairColor: ["#3E2723", "#5D4037", "#6D4C41", "#3E2723"][g % 4],
                hairStyle: ["pony", "loose", "bun", "loose", "pony", "bun"][g]
            });
        }
        mom = null;
    }

    // ── Drawing: Dina (top-down for game world) ──────────────
    function drawDinaTopDown(x, y, walkTime, facing, holding) {
        ctx.save();
        // Body bounces up on each footfall — absolute sin = always positive
        var bob = Math.abs(Math.sin(walkTime * 10)) * 3;
        var lean = Math.sin(walkTime * 10) * 0.04;
        ctx.translate(x, y - bob);
        ctx.rotate(lean);
        var legSwing = Math.sin(walkTime * 12) * 5;
        // Shadow (no bob — stays on ground)
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(0, 20, 16, 4, 0, 0, Math.PI * 2); ctx.fill();

        // Legs (black tights)
        ctx.fillStyle = "#212121";
        roundRect(-6, 6 - legSwing, 5, 16 + legSwing, 2); ctx.fill();
        roundRect(1, 6 + legSwing, 5, 16 - legSwing, 2); ctx.fill();
        // Boots
        ctx.fillStyle = "#3E2723";
        roundRect(-7, 20 - legSwing, 7, 4, 2); ctx.fill();
        roundRect(0, 20 + legSwing, 7, 4, 2); ctx.fill();

        // Pink puffy coat body (smaller, more proportional)
        ctx.fillStyle = "#1A1A1A"; // outline
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFB0C8";
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        // Subtle puff highlight (just one, not bulging)
        ctx.fillStyle = "#FFC5D6";
        ctx.beginPath();
        ctx.ellipse(-5, -3, 4, 2.5, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Arms (slimmer, peeking from coat puffs)
        ctx.fillStyle = "#FFB0C8";
        roundRect(-14, -4, 4, 10, 2); ctx.fill();
        roundRect(10, -4, 4, 10, 2); ctx.fill();
        // Hands (skin)
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(-12, 6, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(12, 6, 2.2, 0, Math.PI * 2); ctx.fill();

        // Backpack on back (showing as small bump behind coat)
        if (holding === "backpack") {
            ctx.fillStyle = "#1F2D5C";
            roundRect(-7, -4, 14, 8, 3); ctx.fill();
            // Unicorn keychain hanging off
            ctx.fillStyle = "#FFB0C8";
            ctx.beginPath(); ctx.arc(6, 6, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#FF4FA3";
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(6, 6); ctx.lineTo(7, 9);
            ctx.stroke();
        }

        // Head (kid proportions — thin outline for definition)
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath();
        ctx.arc(0, -13, 9.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath();
        ctx.arc(0, -13, 8.5, 0, Math.PI * 2);
        ctx.fill();

        // Hair top + ponytail (visible from above)
        ctx.fillStyle = "#6B4423";
        ctx.beginPath();
        ctx.arc(0, -16, 9, Math.PI, Math.PI * 2);
        ctx.fill();
        // Ponytail trailing behind (toward bottom of car/character)
        ctx.beginPath();
        ctx.ellipse(0, -3, 4, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        // Hair tie (small pink dot)
        ctx.fillStyle = "#FF4FA3";
        ctx.beginPath(); ctx.arc(0, -9, 1.5, 0, Math.PI * 2); ctx.fill();

        // Face details
        // Eyes (happy slits) for adorable face
        ctx.strokeStyle = "#3D2817";
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(-2.5, -13, 1.5, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.arc(2.5, -13, 1.5, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.stroke();
        ctx.lineCap = "butt";
        // Tiny smile
        ctx.strokeStyle = "#A0394D";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(0, -10, 2, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
        // Dimples
        ctx.fillStyle = "rgba(230,140,140,0.5)";
        ctx.beginPath();
        ctx.arc(-4, -11, 0.8, 0, Math.PI * 2);
        ctx.arc(4, -11, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // If holding Morgan plushie — proper cute cat with ears + nose + sleepy eyes
        if (holding === "morgan") {
            var mx = 0, my = 5;
            // Body
            ctx.fillStyle = "#9B8FB4";
            ctx.beginPath(); ctx.ellipse(mx, my + 1, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
            // Head
            ctx.beginPath(); ctx.arc(mx, my - 3, 4, 0, Math.PI * 2); ctx.fill();
            // Ears (triangular)
            ctx.beginPath();
            ctx.moveTo(mx - 3.5, my - 5); ctx.lineTo(mx - 2, my - 7.5); ctx.lineTo(mx - 1, my - 5);
            ctx.moveTo(mx + 1, my - 5); ctx.lineTo(mx + 2, my - 7.5); ctx.lineTo(mx + 3.5, my - 5);
            ctx.fill();
            // Inner ear pink
            ctx.fillStyle = "#FFB8D9";
            ctx.beginPath();
            ctx.arc(mx - 2.2, my - 6, 0.6, 0, Math.PI * 2);
            ctx.arc(mx + 2.2, my - 6, 0.6, 0, Math.PI * 2);
            ctx.fill();
            // Closed happy eyes
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 0.7;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(mx - 1.5, my - 3, 0.7, 1.1 * Math.PI, 1.9 * Math.PI);
            ctx.arc(mx + 1.5, my - 3, 0.7, 1.1 * Math.PI, 1.9 * Math.PI);
            ctx.stroke();
            // Pink nose
            ctx.fillStyle = "#FF8AAA";
            ctx.beginPath(); ctx.arc(mx, my - 1.5, 0.5, 0, Math.PI * 2); ctx.fill();
            ctx.lineCap = "butt";
        }

        ctx.restore();
    }

    // ── Drawing: Mom (top-down) ──────────────────────────────
    function drawMomTopDown(x, y, walkTime) {
        ctx.save();
        // Heavier mom bob — slower frequency, slightly larger amplitude
        var momBob = Math.abs(Math.sin(walkTime * 8)) * 2.5;
        var momLean = Math.sin(walkTime * 8) * 0.03;
        ctx.translate(x, y - momBob);
        ctx.rotate(momLean);
        var legSwing = Math.sin(walkTime * 10) * 4;

        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(0, 24, 18, 5, 0, 0, Math.PI * 2); ctx.fill();

        // Legs (dark pants)
        ctx.fillStyle = "#37474F";
        roundRect(-7, 8 - legSwing, 6, 18 + legSwing, 3); ctx.fill();
        roundRect(1, 8 + legSwing, 6, 18 - legSwing, 3); ctx.fill();
        // Shoes
        ctx.fillStyle = "#212121";
        roundRect(-8, 24 - legSwing, 8, 4, 2); ctx.fill();
        roundRect(0, 24 + legSwing, 8, 4, 2); ctx.fill();

        // Body - cozy sweater
        ctx.fillStyle = "#8E24AA";
        ctx.beginPath();
        ctx.ellipse(0, -2, 18, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#AB47BC";
        ctx.beginPath();
        ctx.arc(-8, -8, 7, 0, Math.PI * 2);
        ctx.arc(8, -8, 7, 0, Math.PI * 2);
        ctx.fill();

        // Arms (one waving)
        var armWave = Math.sin(walkTime * 6) * 0.5;
        ctx.fillStyle = "#8E24AA";
        ctx.save();
        ctx.translate(-15, -2);
        ctx.rotate(-0.4 + armWave);
        roundRect(-3, -8, 6, 16, 3); ctx.fill();
        ctx.restore();
        roundRect(13, -2, 6, 16, 3); ctx.fill();
        // Hands
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(-18, 8, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(16, 14, 2.5, 0, Math.PI * 2); ctx.fill();

        // Head
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(0, -18, 9, 0, Math.PI * 2); ctx.fill();
        // Hair (adult bob) — frames the top + sides but leaves the lower
        // face (~60% of the head) as visible skin. Head spans y -27..-9;
        // hair stops around y -21 across the front so eyes/blush/mouth show.
        ctx.fillStyle = "#3E2723";
        // Top cap: semicircle over the crown, flat edge above the brows.
        ctx.beginPath();
        ctx.arc(0, -21, 9.5, Math.PI, Math.PI * 2);
        ctx.fill();
        // Bob sides: hair sweeps down past the cheeks at the very edges of
        // the face, hugging the sides without covering the front features.
        ctx.beginPath();
        ctx.ellipse(-9, -16, 2.8, 9, -0.15, 0, Math.PI * 2);
        ctx.ellipse(9, -16, 2.8, 9, 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Head outline (chunky)
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, -18, 9, 0, Math.PI * 2); ctx.stroke();
        // Cheek blush
        ctx.fillStyle = "rgba(255,140,140,0.5)";
        ctx.beginPath();
        ctx.arc(-5, -16, 1.6, 0, Math.PI * 2);
        ctx.arc(5, -16, 1.6, 0, Math.PI * 2);
        ctx.fill();
        // Eyes (whites + pupils)
        ctx.fillStyle = "#FFF";
        ctx.beginPath();
        ctx.arc(-3, -18, 1.4, 0, Math.PI * 2);
        ctx.arc(3, -18, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#222";
        ctx.beginPath();
        ctx.arc(-2.7, -17.8, 0.9, 0, Math.PI * 2);
        ctx.arc(3.3, -17.8, 0.9, 0, Math.PI * 2);
        ctx.fill();
        // Worried brows (angled inward)
        ctx.strokeStyle = "#3E2723";
        ctx.lineWidth = 1.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-6, -21); ctx.lineTo(-2, -22);
        ctx.moveTo(2, -22); ctx.lineTo(6, -21);
        ctx.stroke();
        ctx.lineCap = "butt";
        // Small "o" worried mouth
        ctx.fillStyle = "#5D2A2A";
        ctx.beginPath();
        ctx.ellipse(0, -14, 0.9, 1.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Handbag bouncing
        ctx.fillStyle = "#5D4037";
        roundRect(13, -5, 9, 11, 2); ctx.fill();
        ctx.fillStyle = "#FFD700";
        ctx.fillRect(13, -2, 9, 2);

        ctx.restore();
    }

    // ── Drawing: School Bus ──────────────────────────────────
    function drawSchoolBus(bus) {
        ctx.save();
        ctx.translate(bus.x, bus.y);

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        roundRect(8, 8, 240, 140, 14); ctx.fill();

        // Body
        ctx.fillStyle = "#FFD426";
        roundRect(0, 0, 240, 140, 14); ctx.fill();
        // Outline
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 4;
        roundRect(0, 0, 240, 140, 14); ctx.stroke();

        // Black stripes
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 22, 240, 6);
        ctx.fillRect(0, 116, 240, 6);

        // Windshield (front)
        ctx.fillStyle = "#7BB8E0";
        roundRect(8, 4, 70, 18, 4); ctx.fill();

        // Side windows along the side
        ctx.fillStyle = "#7BB8E0";
        for (var w = 0; w < 5; w++) {
            roundRect(86 + w * 30, 4, 24, 18, 3); ctx.fill();
        }

        // White panel behind school name (readability)
        ctx.fillStyle = "#FFFFFF";
        roundRect(20, 56, 200, 36, 6); ctx.fill();
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 2.5;
        roundRect(20, 56, 200, 36, 6); ctx.stroke();
        // "LEV BAIS YAAKOV" written along the side
        ctx.fillStyle = "#0D47A1";
        ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("LEV BAIS YAAKOV", 120, 70);
        ctx.font = "bold 10px 'Segoe UI', Arial, sans-serif";
        ctx.fillText("SCHOOL", 120, 84);

        // Wheels
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.ellipse(35, 138, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(205, 138, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#424242";
        ctx.beginPath(); ctx.ellipse(35, 138, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(205, 138, 6, 3, 0, 0, Math.PI * 2); ctx.fill();

        // Door (right side, opens with bus.doorOpen 0-1)
        ctx.fillStyle = "#000";
        var doorOpen = bus.doorOpen || 0;
        ctx.fillRect(218 + doorOpen * 8, 100, 8, 36);
        // Door window
        ctx.fillStyle = "#7BB8E0";
        ctx.fillRect(220 + doorOpen * 8, 104, 4, 14);

        // Flashing lights on top
        var blink = Math.sin(bus.timer * 12) > 0;
        ctx.fillStyle = blink ? "#FF2222" : "#FFAA22";
        ctx.beginPath(); ctx.arc(20, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = !blink ? "#FF2222" : "#FFAA22";
        ctx.beginPath(); ctx.arc(220, 0, 5, 0, Math.PI * 2); ctx.fill();

        // Light aura
        if (blink) {
            ctx.fillStyle = "rgba(244,67,54,0.3)";
            ctx.beginPath(); ctx.arc(20, 0, 16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(255,170,34,0.3)";
            ctx.beginPath(); ctx.arc(220, 0, 16, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = "rgba(255,170,34,0.3)";
            ctx.beginPath(); ctx.arc(20, 0, 16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(244,67,54,0.3)";
            ctx.beginPath(); ctx.arc(220, 0, 16, 0, Math.PI * 2); ctx.fill();
        }

        // Stop sign deployed (when stopped)
        if (bus.phase >= 1) {
            ctx.fillStyle = "#D32F2F";
            ctx.beginPath();
            var cx = -18, cy = 80;
            for (var i = 0; i < 8; i++) {
                var ang = i * Math.PI / 4;
                var px = cx + Math.cos(ang) * 16;
                var py = cy + Math.sin(ang) * 16;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 9px 'Segoe UI', Arial, sans-serif";
            ctx.fillText("STOP", cx, cy + 2);
        }

        ctx.restore();
    }

    // ── Drawing: school girl in uniform (top-down) ───────────
    function drawSchoolGirl(g) {
        ctx.save();
        ctx.translate(g.x, g.y);
        var legSwing = Math.sin(g.walkTime * 14) * 4;

        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(0, 14, 10, 3, 0, 0, Math.PI * 2); ctx.fill();

        // Navy skirt
        ctx.fillStyle = "#1F2D5C";
        roundRect(-6, 0, 12, 10, 2); ctx.fill();
        // Legs (tights)
        ctx.fillStyle = "#3E2723";
        ctx.fillRect(-4, 8 - legSwing, 3, 8);
        ctx.fillRect(1, 8 + legSwing, 3, 8);
        // Shoes
        ctx.fillStyle = "#000";
        ctx.fillRect(-5, 15 - legSwing, 4, 2);
        ctx.fillRect(1, 15 + legSwing, 4, 2);

        // White shirt
        ctx.fillStyle = "#FFFFFF";
        roundRect(-7, -8, 14, 12, 3); ctx.fill();
        // Collar dots
        ctx.fillStyle = "#1F2D5C";
        ctx.fillRect(-3, -5, 1.5, 1.5);
        ctx.fillRect(1.5, -5, 1.5, 1.5);

        // Backpack
        ctx.fillStyle = "#212121";
        roundRect(-5, -4, 10, 6, 2); ctx.fill();

        // Arms
        ctx.fillStyle = "#FFFFFF";
        roundRect(-9, -6, 3, 9, 1); ctx.fill();
        roundRect(6, -6, 3, 9, 1); ctx.fill();

        // Head with chunky outline
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(0, -13, 7.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#F5C9A0";
        ctx.beginPath(); ctx.arc(0, -13, 6.3, 0, Math.PI * 2); ctx.fill();
        // Hair (slightly darker outer + lighter inner pass)
        ctx.fillStyle = shadeColor(g.hairColor, -35);
        if (g.hairStyle === "pony") {
            ctx.beginPath();
            ctx.arc(0, -16, 8, Math.PI, Math.PI * 2);
            ctx.ellipse(0, -8, 3.5, 6.5, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (g.hairStyle === "bun") {
            ctx.beginPath();
            ctx.arc(0, -16, 8, Math.PI, Math.PI * 2);
            ctx.arc(0, -19, 4.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(0, -14, 8.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#F5C9A0";
            ctx.beginPath(); ctx.arc(0, -13, 5.5, 0, Math.PI * 2); ctx.fill();
        }
        // Inner hair color pass for definition
        ctx.fillStyle = g.hairColor;
        if (g.hairStyle === "pony") {
            ctx.beginPath();
            ctx.arc(0, -16, 7, Math.PI, Math.PI * 2);
            ctx.fill();
        } else if (g.hairStyle === "bun") {
            ctx.beginPath();
            ctx.arc(0, -19, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }
        // Cheek blush
        ctx.fillStyle = "rgba(255,150,150,0.5)";
        ctx.beginPath();
        ctx.arc(-3.5, -11, 1.2, 0, Math.PI * 2);
        ctx.arc(3.5, -11, 1.2, 0, Math.PI * 2);
        ctx.fill();
        // Sparkly eyes (Sasquatch-style)
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(-2.2, -13, 1.4, 0, Math.PI * 2);
        ctx.arc(2.2, -13, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(-2.2, -12.8, 0.9, 0, Math.PI * 2);
        ctx.arc(2.2, -12.8, 0.9, 0, Math.PI * 2);
        ctx.fill();
        // Tiny smile
        ctx.strokeStyle = "#A0394D";
        ctx.lineWidth = 0.9;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(0, -11, 1.6, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
        ctx.lineCap = "butt";

        ctx.restore();
    }

    // ── Update / Draw: Dina Bus Intro ────────────────────────
    function updateDinaBus(dt) {
        if (!schoolBus) return;
        schoolBus.timer += dt;
        var t = schoolBus.timer;
        updateParticles(dt); // tick exhaust/dust puffs spawned below

        // Phase 0: bus drives in (0-1.2s)
        if (schoolBus.phase === 0) {
            schoolBus.x = lerp(W + 220, W / 2 - 120, Math.min(t / 1.2, 1));
            if (t > 1.2) {
                schoolBus.phase = 1;
                schoolBus.timer = 1.2;
            }
        }
        // Phase 1: doors hiss open (1.2-1.7s)
        if (schoolBus.phase === 1) {
            if (schoolBus.doorOpen === 0) playDoorHiss();
            schoolBus.doorOpen = Math.min((t - 1.2) / 0.5, 1);
            if (t > 1.7) {
                schoolBus.phase = 2;
                playSchoolBell();
            }
        }
        // Phase 2: girls coming off (1.7-5.0s)
        if (schoolBus.phase === 2) {
            for (var i = 0; i < schoolGirls.length; i++) {
                var gi = schoolGirls[i];
                if (gi.onBus && t > gi.spawn) {
                    gi.onBus = false;
                    gi.x = schoolBus.x + 220;
                    gi.y = schoolBus.y + 130;
                    // little chatter
                    if (Math.random() > 0.5) playTone(rand(500, 900), 0.05, "sine", 0.06);
                    // little puff of dust as they hop down onto the sidewalk
                    for (var dp = 0; dp < 5; dp++) {
                        particles.push({
                            x: gi.x + rand(-4, 4), y: gi.y + 10,
                            vx: rand(-25, 25), vy: rand(-30, -5),
                            life: rand(0.3, 0.6), maxLife: 0.6,
                            size: rand(3, 6),
                            color: randPick(["#D7CBB0", "#C9BCA0", "#E0D6BE"]),
                            gravity: 40, smoke: true
                        });
                    }
                }
                if (!gi.onBus) {
                    gi.x += gi.vx * dt;
                    gi.y += gi.vy * dt;
                    gi.walkTime += dt;
                }
            }
            if (t > 4.5) {
                schoolBus.phase = 3;
                // Dina emerges
                dina.x = schoolBus.x + 220;
                dina.y = schoolBus.y + 130;
                dina.targetX = W / 2;
                dina.targetY = 350;
                dina.walkTime = 0;
                dinaCharacterFace = "happy";
            }
        }
        // Phase 3: Dina emerges and walks center (4.5-6.0s)
        if (schoolBus.phase === 3) {
            // Move Dina toward target
            var dx = dina.targetX - dina.x;
            var dy = dina.targetY - dina.y;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d > 2) {
                dina.x += (dx / d) * 100 * dt;
                dina.y += (dy / d) * 100 * dt;
                dina.walkTime += dt;
            } else if (t > 6.0) {
                schoolBus.phase = 4;
            }
        }
        // Phase 4: thought bubble (6.0-7.0s)
        if (schoolBus.phase === 4 && t > 7.0) {
            schoolBus.phase = 5;
            dinaCharacterFace = "determined";
            playTone(220, 0.12, "square", 0.15);
        }
        // Phase 5: determined / Hmph (7.0-8.0s)
        if (schoolBus.phase === 5 && t > 8.0) {
            schoolBus.phase = 6;
        }
        // Phase 6: bus drives away (8.0-8.7s)
        if (schoolBus.phase === 6) {
            schoolBus.x -= 600 * dt;
            // Exhaust puffs trailing from the back-right of the bus
            schoolBus.exhaust = (schoolBus.exhaust || 0) + dt;
            if (schoolBus.exhaust > 0.06) {
                schoolBus.exhaust = 0;
                particles.push({
                    x: schoolBus.x + 240, y: schoolBus.y + 120 + rand(-4, 4),
                    vx: rand(20, 60), vy: rand(-30, -10),
                    life: rand(0.5, 0.9), maxLife: 0.9,
                    size: rand(6, 11),
                    color: randPick(["#9E9E9E", "#BDBDBD", "#757575"]),
                    gravity: -20, smoke: true
                });
            }
            if (schoolBus.x < -300) {
                // Start the run-home game
                schoolBus = null;
                particles.length = 0; // clear leftover exhaust/dust
                startDinaRun();
            }
        }

        // Allow click to skip
        var click = consumeClick();
        if (click || consumeAction()) {
            schoolBus = null;
            particles.length = 0; // clear leftover exhaust/dust
            startDinaRun();
        }
    }

    function drawDinaBus() {
        // Sky gradient at top
        var skyG = ctx.createLinearGradient(0, 0, 0, 90);
        skyG.addColorStop(0, "#A8E6CF"); skyG.addColorStop(1, "#FFE3B0");
        ctx.fillStyle = skyG;
        ctx.fillRect(0, 0, W, 90);
        // Unified lawn green (matches run home)
        ctx.fillStyle = "#7CB342";
        ctx.fillRect(0, 90, W, H);
        // Road (where bus is)
        ctx.fillStyle = "#6B7B8D";
        ctx.fillRect(0, 90, W, 220);
        // Road outline + lane dashes
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 90, W, 220);
        ctx.strokeStyle = "#F5F5DC";
        ctx.lineWidth = 2;
        ctx.setLineDash([20, 16]);
        ctx.beginPath();
        ctx.moveTo(0, 200); ctx.lineTo(W, 200);
        ctx.stroke();
        ctx.setLineDash([]);
        // Curb
        ctx.fillStyle = "#FBC02D";
        ctx.fillRect(0, 305, W, 4);
        ctx.fillStyle = "#212121";
        ctx.fillRect(0, 309, W, 2);
        // Sidewalk
        ctx.fillStyle = "#D0CFC2";
        ctx.fillRect(0, 311, W, 88);
        ctx.strokeStyle = "#9E9E9E";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var sxx = 60; sxx < W; sxx += 80) {
            ctx.moveTo(sxx, 311); ctx.lineTo(sxx, 399);
        }
        ctx.stroke();

        // Distant houses with chunky outlines + windows
        // House 1 (pink)
        ctx.fillStyle = "#EF9A9A";
        roundRect(40, 430, 100, 80, 6); ctx.fill();
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 3;
        roundRect(40, 430, 100, 80, 6); ctx.stroke();
        // Roof
        ctx.fillStyle = "#B71C1C";
        ctx.beginPath();
        ctx.moveTo(40, 430); ctx.lineTo(90, 400); ctx.lineTo(140, 430); ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Windows
        ctx.fillStyle = "#FFEB3B";
        ctx.fillRect(56, 458, 22, 22);
        ctx.fillRect(102, 458, 22, 22);
        ctx.strokeRect(56, 458, 22, 22);
        ctx.strokeRect(102, 458, 22, 22);
        // Window cross
        ctx.beginPath();
        ctx.moveTo(67, 458); ctx.lineTo(67, 480);
        ctx.moveTo(56, 469); ctx.lineTo(78, 469);
        ctx.moveTo(113, 458); ctx.lineTo(113, 480);
        ctx.moveTo(102, 469); ctx.lineTo(124, 469);
        ctx.stroke();
        // Door
        ctx.fillStyle = "#5D4037";
        ctx.fillRect(82, 484, 16, 26);
        ctx.strokeRect(82, 484, 16, 26);

        // House 2 (brown)
        ctx.fillStyle = "#BCAAA4";
        roundRect(250, 440, 110, 70, 6); ctx.fill();
        roundRect(250, 440, 110, 70, 6); ctx.stroke();
        ctx.fillStyle = "#4E342E";
        ctx.beginPath();
        ctx.moveTo(250, 440); ctx.lineTo(305, 410); ctx.lineTo(360, 440); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#FFEB3B";
        ctx.fillRect(268, 460, 22, 22);
        ctx.fillRect(320, 460, 22, 22);
        ctx.strokeRect(268, 460, 22, 22);
        ctx.strokeRect(320, 460, 22, 22);
        ctx.beginPath();
        ctx.moveTo(279, 460); ctx.lineTo(279, 482);
        ctx.moveTo(268, 471); ctx.lineTo(290, 471);
        ctx.moveTo(331, 460); ctx.lineTo(331, 482);
        ctx.moveTo(320, 471); ctx.lineTo(342, 471);
        ctx.stroke();
        ctx.fillStyle = "#5D4037";
        ctx.fillRect(297, 484, 16, 26);
        ctx.strokeRect(297, 484, 16, 26);

        // Bus — gentle idle bob while stopped (engine running, phases 1-5)
        if (schoolBus) {
            var busBob = (schoolBus.phase >= 1 && schoolBus.phase <= 5)
                ? Math.sin(schoolBus.timer * 6) * 1.5 : 0;
            var baseY = schoolBus.y;
            schoolBus.y = baseY + busBob;
            drawSchoolBus(schoolBus);
            schoolBus.y = baseY;
        }

        // Exhaust / dust puffs (rendered behind the girls but over the bus)
        drawParticles();

        // School girls
        for (var gi = 0; gi < schoolGirls.length; gi++) {
            if (!schoolGirls[gi].onBus) drawSchoolGirl(schoolGirls[gi]);
        }

        // Dina (only after phase 3)
        if (schoolBus && schoolBus.phase >= 3) {
            drawDinaTopDown(dina.x, dina.y, dina.walkTime, "down", "backpack");
        }

        // Subtitles
        if (schoolBus) {
            var bt = schoolBus.timer;
            if (bt > 2.0 && bt < 4.0) {
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                roundRect(40, 750, W - 80, 50, 10); ctx.fill();
                drawText("🔔 School's out!", W / 2, 775,
                    "bold 20px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);
            } else if (bt > 6.0 && bt < 7.0 && dina) {
                // Thought bubble above Dina
                drawSpeechBubble(dina.x, dina.y - 25, "Where's mom?", bt);
            } else if (bt > 7.0 && bt < 8.0 && dina) {
                drawSpeechBubble(dina.x, dina.y - 25, "Hmph!\nI'll walk!", bt);
            }
        }

        // Tap-to-skip hint — shown from the very start, gentle pulse so it
        // reads as an interactive prompt rather than static chrome.
        var skipT = schoolBus ? schoolBus.timer : 0;
        ctx.save();
        ctx.globalAlpha = 0.75 + Math.sin(skipT * 4) * 0.2;
        drawText("Tap to skip ▶", W - 12, H - 16, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3, "right");
        ctx.restore();
    }
