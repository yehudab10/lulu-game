    // ════════════════════════════════════════════════════════════
    //  THE HOSPITAL / ER  — a softer landing than game over.
    //  A bad enough crash or knockout sometimes sends Lulu to the ER instead
    //  of straight to game over: she wakes up, a doctor delivers a (ridiculous)
    //  diagnosis through the RPG dialogue box, she picks her care, pays a
    //  MEDICAL BILL (coins), and is discharged back onto the road, patched up.
    //  Reuses the dialogue box / portraits from the jail-court fragment.
    // ════════════════════════════════════════════════════════════

    var hospital = null;

    var DIAGNOSES = ["a mild case of the OOFs", "two broken nails and a bruised ego",
        "whiplash — from your own SASS", "a boo-boo. A BIG boo-boo", "a concussion (or you're just like this)",
        "road rash and a wounded reputation", "one (1) ouchie, doctor's note attached", "a fractured sense of caution"];
    var DOC_GREET = ["You're awake! Don't sue us.", "Well well. The famous Lulu.", "BP's high, attitude's higher.",
        "Welcome back to the land of the living.", "You flatlined your DIGNITY, mostly."];
    var DOC_REPEAT = ["You AGAIN?! We should charge rent.", "Back so soon? I kept your bed warm.",
        "Lulu. Of COURSE it's Lulu.", "Third gown this WEEK, young lady.", "Frequent-flyer miles don't cover THIS."];
    var HOSP_OPTIONS = [
        { label: "🩹 Just patch me up", billMul: 1.0, extra: false, say: "Band-aid, a lollipop, you're golden. Try the BRAKES next time." },
        { label: "💊 The GOOD stuff, doc!", billMul: 2.0, extra: true, say: "Premium care! Extra heart on the house. Wheee~ 💕" },
        { label: "🏃 Skip the bill — RUN!", billMul: 0, extra: false, dash: true }
    ];
    // ── Bill-skip ESCAPE cutscene content ──
    // The way she TRIES to bolt (a random funny attempt, played out on screen).
    var ER_ESCAPES = [
        { attempt: "🪟 She DIVES through the ER window!", visual: "window" },
        { attempt: "🥼 ...struts out in a stolen lab coat.", visual: "coat" },
        { attempt: "♿ Wheelchair getaway — beep beep!", visual: "chair" },
        { attempt: "🛏️ ...rides a runaway gurney like a sled!", visual: "gurney" },
        { attempt: "🌀 ...up into the air vent, spy-movie style!", visual: "vent" }
    ];
    // If she makes it — a clean-getaway brag.
    var ER_CLEAN = ["...and she's GONE. Little gonif. 🏃💨", "...vanished. In a HOSPITAL GOWN. Iconic.",
        "Security was on a bagel break. 🥯", "Filmed her own escape for TikTok. #blessed",
        "Hopped the bus in a gown. Nobody blinked."];
    // If she's nabbed — the cop gets her in a DIFFERENT funny way each time.
    var ER_CAUGHT = [
        { line: "A sweet old lady blocks her — then rips off the shawl: IT'S A COP! 👵🚔", visual: "oldlady" },
        { line: "She bursts outside — into a WALL of waiting cop cars. 🚓🚓🚓", visual: "cars" },
        { line: "The 'doctor' clamps her shoulder — badge under the coat. 🩺🚔", visual: "doccop" },
        { line: "A guard tackles her at the sliding doors. OOF. 🚨", visual: "guard" }
    ];

    // Wake her up in the ER. Returns true (so callers can use it as a reprieve).
    function beginHospital(reason) {
        save.erVisits = (save.erVisits || 0) + 1; persistSave();
        var greet = save.erVisits >= 3 && Math.random() < 0.7 ? randPick(DOC_REPEAT) : randPick(DOC_GREET);
        hospital = { phase: 0, t: 0, typeT: 0, reason: reason || "crash",
                     diagnosis: randPick(DIAGNOSES), greet: greet,
                     options: HOSP_OPTIONS, choice: -1, bill: 0, applied: false, ekg: 0, line: null,
                     caught: false, lines: null, li: 0 };
        copChase = null; copBust = null; copStop = null;
        playTone(880, 0.1, "sine", 0.06); setTimeout(function () { playTone(880, 0.1, "sine", 0.06); }, 700);
        state = "hospital";
        return true;
    }

    function hospOptRect(i) { return { x: 22, y: H - 162 + i * 46, w: W - 44, h: 40 }; }

    // typewriter helpers (shared shape with the courtroom)
    function hospTyped(full) { return full.slice(0, Math.floor(hospital.typeT * 45)); }
    function hospDone(full) { return Math.floor(hospital.typeT * 45) >= full.length; }

    // ── escape particle helpers (glass shards / dust puffs / skid smoke) ──
    function erGlass(x, y) {
        for (var i = 0; i < 5; i++) particles.push({ x: x + rand(-14, 14), y: y + rand(-12, 12),
            vx: rand(-160, 160), vy: rand(-220, -40), life: 0.9, maxLife: 0.9, size: rand(3, 6),
            color: randPick(["#CFEFF6", "#9FD2E0", "#E3F4F8"]), gravity: 520, glass: true });
    }
    function erDust(x, y) {
        for (var i = 0; i < 2; i++) particles.push({ x: x + rand(-6, 6), y: y + rand(-3, 3),
            vx: rand(-40, 40), vy: rand(-30, -8), life: 0.6, maxLife: 0.6, size: rand(5, 10),
            color: randPick(["#B0BEC5", "#CFD8DC", "#ECEFF1"]), gravity: -30, smoke: true });
    }
    function erSpawnFx() {
        if (!hospital || hospital.phase !== 4) return;
        var v = hospital.escape.visual, prog = clamp(hospital.escT / 2.3, 0, 1);
        var gy = Math.min(H * 0.62, 470) - 24;
        if (v === "window") { if (hospital.escT < 0.5) erGlass(W * 0.5, 116); }
        else if (v === "chair") erDust(lerp(W * 0.26, W * 0.82, prog) - 14, gy + 22);
        else if (v === "gurney") erDust(lerp(-50, W + 50, prog) - 26, gy + 20);
        else if (v === "coat") { if (Math.random() < 0.25) erDust(lerp(W * 0.34, W * 0.76, prog), gy + 18); }
        else if (v === "vent") { if (Math.random() < 0.4) erDust(W * 0.5 + rand(-6, 6), 150); }
    }

    function updateHospital(dt) {
        hospital.t += dt; hospital.typeT += dt; hospital.ekg += dt;
        if (typeof updateParticles === "function") updateParticles(dt);
        if (hospital.phase === 0) {                 // coming to
            if (hospital.t > 1.6 || consumeClick() || consumeAction()) {
                hospital.phase = 1; hospital.t = 0; hospital.typeT = 0;
                hospital.line = hospital.greet + " You've got " + hospital.diagnosis + ".";
            }
            return;
        }
        if (hospital.phase === 1) {                 // diagnosis
            if (consumeClick() || consumeAction()) {
                if (!hospDone(hospital.line)) { hospital.typeT = 999; return; }
                hospital.phase = 2; hospital.t = 0;
            }
            return;
        }
        if (hospital.phase === 2) {                 // pick your care
            var click = consumeClick();
            if (click) for (var i = 0; i < hospital.options.length; i++) {
                var r = hospOptRect(i);
                if (pointInRect(click.x, click.y, r.x, r.y, r.w, r.h)) {
                    var opt = hospital.options[i];
                    hospital.choice = i; hospital.t = 0; hospital.typeT = 0;
                    consumeAction();   // drop this tap's queued action so it can't skip the cutscene
                    if (opt.dash) {
                        // She BOLTS — play a random escape attempt. ~55% she's nabbed,
                        // and if so the capture is its own random gag.
                        hospital.escape = randPick(ER_ESCAPES);
                        hospital.caughtGag = randPick(ER_CAUGHT);
                        hospital.cleanLine = randPick(ER_CLEAN);
                        hospital.caught = Math.random() < 0.55;
                        hospital.phase = 4; hospital.escT = 0;
                        playTone(520, 0.08, "square", 0.12);
                    } else {
                        hospital.phase = 3;
                        hospital.bill = Math.round(rand(25, 55) * opt.billMul);
                        hospital.line = opt.say;
                        playTone(660, 0.06, "sine", 0.1);
                    }
                    return;
                }
            }
            return;
        }
        if (hospital.phase === 3) {                 // result → discharge (paid care)
            if (!hospital.applied) {
                hospital.applied = true;
                var opt = hospital.options[hospital.choice];
                if (hospital.bill > 0) {
                    var pay = Math.min(hospital.bill, save.totalCoins);
                    save.totalCoins -= pay; persistSave(); hospital.paid = pay;
                }
                lives = Math.max(1, (typeof lives !== "undefined" ? lives : 1) + (opt.extra ? 1 : 0));
            }
            if (hospital.t > 0.6 && (consumeClick() || consumeAction())) {
                if (!hospDone(hospital.line)) { hospital.typeT = 999; return; }
                hospital = null;
                if (typeof returnToDriving === "function") returnToDriving();
                spawnFloater(player.x, player.y - 50, "🩹 Patched up — drive safe!", "#7CFC4F");
            }
            return;
        }
        if (hospital.phase === 4) {                 // ESCAPE ATTEMPT (the funny try)
            if (hospital.escT === 0 && hospital.escape.visual === "window") playTone(260, 0.18, "sawtooth", 0.16);
            hospital.escT += dt;
            erSpawnFx();
            if (hospital.escT > 2.3) {
                if (hospital.caught) { hospital.phase = 5; hospital.escT = 0; shakeTimer = 0.25; shakeIntensity = 5; playTone(200, 0.12, "square", 0.14); }
                else { hospital.phase = 6; hospital.t = 0; playTone(680, 0.1, "triangle", 0.16);
                       setTimeout(function () { playTone(988, 0.12, "triangle", 0.16); }, 110); }
            }
            return;
        }
        if (hospital.phase === 5) {                 // CAUGHT — the gag plays, then arrest
            if (shakeTimer > 0) shakeTimer -= dt;
            hospital.escT += dt;
            if (hospital.escT > 2.4 || (hospital.escT > 1.0 && (consumeClick() || consumeAction()))) {
                hospital = null;
                if (typeof beginArrest === "function") beginArrest(["SKIPPING A MEDICAL BILL", "FLEEING IN A GOWN"]);
                else if (typeof returnToDriving === "function") returnToDriving();
            }
            return;
        }
        if (hospital.phase === 6) {                 // CLEAN GETAWAY
            hospital.t += dt;
            if (hospital.t > 1.7 || consumeClick() || consumeAction()) {
                hospital = null;
                if (typeof returnToDriving === "function") returnToDriving();
                spawnFloater(player.x, player.y - 50, "🏃 Skipped the bill — GONE!", "#7CFC4F");
            }
            return;
        }
    }

    function drawHospital() {
        // ── clinical room (bounded so it doesn't stretch on tall screens) ──
        var erFloor = Math.min(H * 0.62, 470);
        var bedY = erFloor - 96, bedX = W / 2 - 70, bedW = 150, bedH = 40;
        var bg = ctx.createLinearGradient(0, 0, 0, erFloor);
        bg.addColorStop(0, "#CFE7E4"); bg.addColorStop(1, "#A6C9C6");
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, erFloor);
        ctx.fillStyle = "#B7D6D2"; for (var ty = 0; ty < erFloor; ty += 30) ctx.fillRect(0, ty, W, 1.5);
        ctx.fillStyle = "#7FA9A4"; ctx.fillRect(0, erFloor, W, 5);
        ctx.fillStyle = "#9DBDB8"; ctx.fillRect(0, erFloor + 5, W, H);
        // curtain rail + curtain on the right
        ctx.fillStyle = "#78909C"; ctx.fillRect(W * 0.62, 70, 6, erFloor - 76);
        ctx.fillStyle = "rgba(120,180,200,0.35)";
        for (var cu = 0; cu < 5; cu++) { roundRect(W * 0.64 + cu * 26, 74, 22, erFloor - 90, 6); ctx.fill(); }

        // ── heart monitor ──
        var mx = 24, my = 90, mw = 120, mh = 70;
        ctx.fillStyle = "#263238"; roundRect(mx - 6, my - 6, mw + 12, mh + 20, 6); ctx.fill();
        ctx.fillStyle = "#0A140F"; roundRect(mx, my, mw, mh, 3); ctx.fill();
        ctx.strokeStyle = "#39FF7A"; ctx.lineWidth = 2; ctx.beginPath();
        for (var sx = 0; sx <= mw; sx += 4) {
            var t = (sx / mw) * 6 + hospital.ekg * 4, beat = (t % 6);
            var sy = my + mh / 2 - (beat > 2.6 && beat < 3.2 ? Math.sin((beat - 2.6) / 0.6 * Math.PI) * 22 : 0);
            if (sx === 0) ctx.moveTo(mx + sx, sy); else ctx.lineTo(mx + sx, sy);
        }
        ctx.stroke();
        drawText((Math.sin(hospital.ekg * 6) > 0 ? "♥ " : "  ") + (78 + Math.floor(Math.sin(hospital.ekg) * 6)) + " BPM",
            mx + mw / 2, my + mh + 6, "bold 10px 'Segoe UI', Arial, sans-serif", "#39FF7A", "#000", 2);

        // ── IV pole ──
        var ivx = W - 54;
        ctx.strokeStyle = "#B0BEC5"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ivx, 70); ctx.lineTo(ivx, erFloor - 20); ctx.stroke();
        ctx.fillStyle = "#FFCDD2"; roundRect(ivx - 8, 80, 16, 26, 4); ctx.fill();
        ctx.strokeStyle = "#EF9A9A"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ivx, 106); ctx.lineTo(W / 2 + 30, bedY); ctx.stroke();

      if (hospital.phase >= 4) {
        // she's not in bed anymore — she's making a break for it
        drawErEscape(erFloor);
      } else {
        // ── bed + Lulu lying down ──
        ctx.fillStyle = "#455A64"; roundRect(bedX - 6, bedY + bedH, 8, 34, 2); ctx.fill(); roundRect(bedX + bedW - 2, bedY + bedH, 8, 34, 2); ctx.fill();
        ctx.fillStyle = "#ECEFF1"; roundRect(bedX, bedY, bedW, bedH, 6); ctx.fill();      // mattress
        ctx.fillStyle = "#90CAF9"; roundRect(bedX + 34, bedY - 4, bedW - 38, 22, 6); ctx.fill(); // blanket
        ctx.fillStyle = "#FFF"; roundRect(bedX + 4, bedY - 6, 34, 22, 6); ctx.fill();     // pillow
        // Lulu's head on the pillow + a little bandage
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(bedX + 22, bedY + 4, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(bedX + 22, bedY + 4, 9.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = save.luluHair || "#8B5A2B"; ctx.beginPath(); ctx.arc(bedX + 22, bedY + 1, 9.6, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFF"; ctx.save(); ctx.translate(bedX + 18, bedY - 2); ctx.rotate(-0.4); ctx.fillRect(-5, -1.5, 10, 3); ctx.restore(); // bandage
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(bedX + 19, bedY + 4, 1, 0, Math.PI * 2); ctx.arc(bedX + 25, bedY + 4, 1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,140,140,0.5)"; ctx.beginPath(); ctx.arc(bedX + 16, bedY + 7, 1.6, 0, Math.PI * 2); ctx.arc(bedX + 28, bedY + 7, 1.6, 0, Math.PI * 2); ctx.fill();

        // ── the doctor at the bedside ──
        drawDoctor(W / 2 + 64, bedY - 6, gameTime, hospital.phase === 1 || hospital.phase === 3);
      }

        // title
        drawText("🏥 THE ER", W / 2, 34, "bold 26px 'Segoe UI', Arial, sans-serif", "#00897B", "#FFF", 4);

        // ── phase overlays ──
        if (hospital.phase === 0) {
            ctx.fillStyle = "rgba(230,245,243," + clamp(1 - hospital.t / 1.6, 0, 1) * 0.85 + ")"; ctx.fillRect(0, 0, W, H);
            drawText("...beep... beep...", W / 2, H / 2, "bold 20px 'Segoe UI', Arial, sans-serif", "#00897B", "#FFF", 3);
        } else if (hospital.phase === 1) {
            var d1 = hospDone(hospital.line);
            drawDialogueBox("DR. SHTERN", hospTyped(hospital.line), "doctor", "#80CBC4", d1, !d1);
        } else if (hospital.phase === 2) {
            ctx.fillStyle = "rgba(0,40,38,0.78)"; roundRect(14, H - 200, W - 28, 190, 12); ctx.fill();
            ctx.strokeStyle = "#26A69A"; ctx.lineWidth = 2; roundRect(14, H - 200, W - 28, 190, 12); ctx.stroke();
            drawText("🏥 How do you want your care?", W / 2, H - 182, "bold 14px 'Segoe UI', Arial, sans-serif", "#B2DFDB", "#000", 3);
            for (var i = 0; i < hospital.options.length; i++) {
                var r = hospOptRect(i), opt = hospital.options[i];
                var pBill = Math.round(40 * opt.billMul);
                drawButton(r.x, r.y, r.w, r.h, opt.label + (opt.dash ? "  (free — RISKY!)" : "  (~★" + pBill + ")"),
                    { bg: opt.dash ? "#EF6C00" : "#00897B", bgDark: opt.dash ? "#BF360C" : "#004D40", small: true });
            }
        } else if (hospital.phase === 3) {
            var d3 = hospDone(hospital.line);
            drawDialogueBox("DR. SHTERN", hospTyped(hospital.line), "doctor", "#80CBC4", hospital.t > 0.6 && d3, !d3);
            if (hospital.applied && hospital.bill > 0)
                drawText("🧾 −" + hospital.paid + " 💰 medical bill", W / 2, H - 168, "bold 14px 'Segoe UI', Arial, sans-serif", "#FF8A80", "#000", 3);
        } else if (hospital.phase === 4) {
            // the escape ATTEMPT caption
            erCaption(hospital.escape.attempt, "#FFE082");
        } else if (hospital.phase === 5) {
            // BUSTED gag caption (in red)
            erCaption(hospital.caughtGag.line, "#FF8A80");
            if (hospital.escT > 1.0) {
                var bl = 0.4 + 0.6 * Math.abs(Math.sin(gameTime * 6));
                ctx.globalAlpha = bl; drawText("🚨 BUSTED 🚨", W / 2, H * 0.30, "bold 22px 'Segoe UI', Arial, sans-serif", "#FF1744", "#000", 5); ctx.globalAlpha = 1;
            }
        } else if (hospital.phase === 6) {
            erCaption(hospital.cleanLine, "#7CFC4F");
        }
    }

    // A centered caption card for the escape cutscene beats.
    function erCaption(text, accent) {
        ctx.font = "bold 15px 'Segoe UI', Arial, sans-serif";
        var lines = wrapLines(text, W - 80, "bold 15px 'Segoe UI', Arial, sans-serif");
        var bh = 18 + lines.length * 20, by = H - bh - 40, bw = W - 36, bx = 18;
        ctx.fillStyle = "rgba(10,20,18,0.86)"; roundRect(bx, by, bw, bh, 12); ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 2.5; roundRect(bx, by, bw, bh, 12); ctx.stroke();
        for (var i = 0; i < lines.length; i++)
            drawText(lines[i], W / 2, by + 16 + i * 20, "bold 15px 'Segoe UI', Arial, sans-serif", "#F3F8F4", "#000", 3);
    }

    // Lulu drawn scaled/rotated (the escape uses a bigger, livelier Lulu than
    // the tiny top-down sprite). `extra` adds a quick costume (lab coat).
    function drawErLulu(x, y, s, t, mood, rot, extra) {
        ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(s, s);
        drawLuluTopDown(0, 0, t, mood);
        if (extra === "coat") {
            ctx.fillStyle = "rgba(250,250,250,0.96)"; roundRect(-14, -5, 28, 27, 8); ctx.fill();
            ctx.strokeStyle = "#CFD8DC"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 20); ctx.stroke();
            ctx.fillStyle = "#1A1A1A"; roundRect(-9, -16, 18, 5, 2); ctx.fill();        // big shades
        }
        ctx.restore();
    }
    // Speed/whoosh lines trailing a moving figure (dir: +1 moving right).
    function erSpeed(x, y, dir, n, len) {
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
        for (var i = 0; i < n; i++) { var yy = y + (i - (n - 1) / 2) * 8; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x - dir * (len + i * 5), yy); ctx.stroke(); }
        ctx.lineCap = "butt";
    }

    // The bill-skip escape scene: a random funny ATTEMPT, then (if nabbed) a
    // random funny CAPTURE. Bigger, animated, with particles.
    function drawErEscape(erFloor) {
        var e = hospital, t = e.escT || 0, gy = erFloor + 16;
        // fade the empty foreground floor into shadow so the action reads as a
        // lit "stage" instead of a half-empty room.
        var ff = ctx.createLinearGradient(0, erFloor, 0, H);
        ff.addColorStop(0, "rgba(8,24,22,0)"); ff.addColorStop(0.5, "rgba(8,24,22,0.35)"); ff.addColorStop(1, "rgba(8,24,22,0.72)");
        ctx.fillStyle = ff; ctx.fillRect(0, erFloor, W, H - erFloor);
        var shake = (e.phase === 5 && shakeTimer > 0) ? shakeIntensity : 0;
        ctx.save();
        if (shake) ctx.translate(rand(-shake, shake), rand(-shake, shake));

        if (e.phase === 4) {
            var prog = clamp(t / 2.3, 0, 1), v = e.escape.visual;
            if (v === "window") {
                drawErWindow(W * 0.5, 120);
                if (prog < 0.4) {   // shatter starburst flash at the window
                    var f = 1 - prog / 0.4;
                    ctx.strokeStyle = "rgba(255,255,255," + f + ")"; ctx.lineWidth = 3;
                    for (var r = 0; r < 8; r++) { var a = r * Math.PI / 4; ctx.beginPath(); ctx.moveTo(W * 0.5, 120); ctx.lineTo(W * 0.5 + Math.cos(a) * (20 + f * 26), 120 + Math.sin(a) * (20 + f * 26)); ctx.stroke(); }
                }
                // accelerating tumble down-and-left out of the window
                var lx = lerp(W * 0.5, W * 0.30, prog), ly = 120 + (gy - 120) * (prog * prog);
                erSpeed(lx + 30, ly - 6, 1, 4, 22);
                drawErLulu(lx, ly, 1.4, t * 9, "panic", -0.5 - prog * 2.6);
                drawText("CRASH!", W * 0.5 + 40, 96, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 3);
            } else if (v === "coat") {
                var cx = lerp(W * 0.26, W * 0.78, prog), bob = Math.abs(Math.sin(t * 6)) * 5;
                // sneaky dotted footstep trail
                ctx.fillStyle = "rgba(255,255,255,0.28)";
                for (var d = 1; d <= 4; d++) { var dx = cx - d * 26; if (dx > 30) { ctx.beginPath(); ctx.arc(dx, gy + 20, 2.5, 0, Math.PI * 2); ctx.fill(); } }
                drawErLulu(cx, gy - bob, 1.4, t * 4, "panic", 0.12, "coat");
                drawText("🤫 nothing to see here", cx, gy - 52, "bold 11px 'Segoe UI', Arial, sans-serif", "#B2DFDB", "#000", 2);
            } else if (v === "chair") {
                var wx = lerp(W * 0.24, W * 0.82, prog);
                erSpeed(wx - 34, gy + 4, 1, 4, 26);
                // big spinning back wheel + small front wheel
                ctx.save(); ctx.translate(wx - 14, gy + 14); ctx.rotate(t * 16);
                ctx.strokeStyle = "#B0BEC5"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
                ctx.lineWidth = 2; for (var sp = 0; sp < 6; sp++) { var sa = sp * Math.PI / 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(sa) * 16, Math.sin(sa) * 16); ctx.stroke(); }
                ctx.restore();
                ctx.fillStyle = "#90A4AE"; ctx.beginPath(); ctx.arc(wx + 14, gy + 18, 7, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = "#546E7A"; roundRect(wx - 16, gy + 2, 30, 6, 2); ctx.fill();   // seat
                ctx.fillStyle = "#37474F"; ctx.fillRect(wx + 13, gy - 14, 4, 22);              // push handle
                drawErLulu(wx, gy - 8, 1.3, t * 3, "panic", -0.08);
            } else if (v === "gurney") {
                var gx = lerp(-60, W + 60, prog);
                for (var k = 3; k >= 1; k--) {   // motion-blur ghost trail
                    ctx.globalAlpha = 0.16 * k; ctx.fillStyle = "#ECEFF1"; roundRect(gx - 36 - k * 26, gy + 2, 72, 14, 5); ctx.fill();
                }
                ctx.globalAlpha = 1;
                erSpeed(gx - 42, gy + 4, 1, 5, 30);
                ctx.fillStyle = "#ECEFF1"; roundRect(gx - 36, gy + 2, 72, 14, 5); ctx.fill();   // gurney
                ctx.fillStyle = "#90A4AE"; ctx.beginPath(); ctx.arc(gx - 22, gy + 20, 6, 0, Math.PI * 2); ctx.arc(gx + 22, gy + 20, 6, 0, Math.PI * 2); ctx.fill();
                // Lulu lying on it, head + flailing arms
                ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(gx - 24, gy + 2, 9, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = save.luluHair || "#8B5A2B"; ctx.beginPath(); ctx.arc(gx - 24, gy - 2, 9, Math.PI, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = C.skin; ctx.lineWidth = 3.5; ctx.lineCap = "round";
                ctx.beginPath(); ctx.moveTo(gx, gy + 2); ctx.lineTo(gx + 12, gy - 12 + Math.sin(t * 22) * 6); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(gx + 6, gy + 4); ctx.lineTo(gx + 18, gy - 6 + Math.cos(t * 22) * 6); ctx.stroke(); ctx.lineCap = "butt";
                drawText("WHEEEEE!", gx, gy - 22, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 3);
            } else { // vent
                drawErWindow(W * 0.5, 116, true);   // grate
                var kick = Math.sin(t * 13) * 6;
                // her legs kicking out of the open grate
                ctx.fillStyle = "#3F5C8A"; roundRect(W * 0.5 - 9, 132, 7, 20 + kick, 3); ctx.fill(); roundRect(W * 0.5 + 2, 132, 7, 20 - kick, 3); ctx.fill();
                ctx.fillStyle = "#FFF"; ctx.fillRect(W * 0.5 - 10, 150 + kick, 9, 4); ctx.fillRect(W * 0.5 + 1, 150 - kick, 9, 4);
                drawText("nnngh— almost—", W * 0.5, 184, "bold 12px 'Segoe UI', Arial, sans-serif", "#B2DFDB", "#000", 2);
            }
        } else {
            // ── CAUGHT GAG ──
            var v2 = e.caughtGag.visual, rev = clamp((t - 0.4) / 0.5, 0, 1);
            if (v2 === "cars") {
                // skid marks + a row of flashing cruisers, spotlight on Lulu
                ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 5;
                for (var sk = 0; sk < 3; sk++) { var scx = W * 0.22 + sk * (W * 0.28); ctx.beginPath(); ctx.moveTo(scx - 26, gy + 26); ctx.lineTo(scx, gy + 14); ctx.stroke(); }
                for (var cc = 0; cc < 3; cc++) drawCopCar(W * 0.22 + cc * (W * 0.28), gy + 2, gameTime * 6);
                // spotlight cone onto a frozen, hands-up Lulu
                ctx.fillStyle = "rgba(255,255,200,0.16)"; ctx.beginPath(); ctx.moveTo(W * 0.5, gy + 2); ctx.lineTo(W * 0.5 - 36, gy - 70); ctx.lineTo(W * 0.5 + 36, gy - 70); ctx.closePath(); ctx.fill();
                drawErLulu(W * 0.5, gy - 50, 1.3, t * 5, "cry", 0);
            } else if (v2 === "oldlady") {
                drawErLulu(W * 0.36, gy, 1.35, t * 5, "cry", 0.1);
                drawOldLadyCop(W * 0.62, gy, t);
            } else if (v2 === "doccop") {
                drawErLulu(W * 0.38, gy, 1.3, t * 5, "cry", 0.12);
                ctx.save(); ctx.translate(W * 0.6, gy - 6); ctx.scale(1.25, 1.25); drawDoctor(0, 0, gameTime, false); ctx.restore();
                // coat flaps open → badge revealed
                if (rev > 0) { ctx.globalAlpha = rev; ctx.fillStyle = "#1565C0"; roundRect(W * 0.6 - 6, gy - 8, 14, 18, 3); ctx.fill();
                    ctx.fillStyle = "#FFD700"; drawText("★", W * 0.6 + 1, gy + 1, "bold 14px Arial", "#FFD700", "#000", 2); ctx.globalAlpha = 1; }
            } else { // guard tackle
                var lunge = clamp(t / 0.5, 0, 1);
                drawErLulu(lerp(W * 0.5, W * 0.4, lunge), gy, 1.3, t * 6, "cry", -0.2 * lunge);
                ctx.save(); ctx.translate(lerp(W * 0.78, W * 0.55, lunge), gy); ctx.scale(1.3, 1.3); drawAngryMan(0, 0, t, "running", -1, true); ctx.restore();
                if (rev > 0) { // impact stars
                    ctx.fillStyle = "#FFD54F"; for (var st2 = 0; st2 < 5; st2++) { var aa = st2 * 1.25; drawText("✦", W * 0.48 + Math.cos(aa) * 22, gy - 24 + Math.sin(aa) * 16, "bold 13px Arial", "#FFD54F", "#000", 2); } }
            }
        }
        ctx.restore();
        if (typeof drawParticles === "function") drawParticles();
    }

    // A shattered ER window (also reused as a vent grate). Bigger now.
    function drawErWindow(cx, cy, grate) {
        ctx.fillStyle = "#37474F"; roundRect(cx - 42, cy - 32, 84, 64, 6); ctx.fill();
        ctx.fillStyle = grate ? "#546E7A" : "#9FD2E0"; roundRect(cx - 37, cy - 27, 74, 54, 5); ctx.fill();
        if (grate) {
            ctx.fillStyle = "#0A140F"; roundRect(cx - 28, cy - 18, 56, 36, 3); ctx.fill();   // open dark vent
            ctx.strokeStyle = "#37474F"; ctx.lineWidth = 2;
            for (var s = -22; s <= 22; s += 8) { ctx.beginPath(); ctx.moveTo(cx - 28, cy + s); ctx.lineTo(cx + 28, cy + s); ctx.stroke(); }
            // the popped-off grate cover hanging
            ctx.fillStyle = "#90A4AE"; ctx.save(); ctx.translate(cx + 30, cy + 18); ctx.rotate(0.5); roundRect(-14, -3, 28, 6, 2); ctx.fill(); ctx.restore();
        } else {
            ctx.fillStyle = "#0A140F"; ctx.beginPath();   // jagged broken hole
            ctx.moveTo(cx - 24, cy - 18); ctx.lineTo(cx - 4, cy - 24); ctx.lineTo(cx + 22, cy - 12);
            ctx.lineTo(cx + 16, cy + 16); ctx.lineTo(cx - 8, cy + 22); ctx.lineTo(cx - 28, cy + 6); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = "#CFEFF6"; ctx.lineWidth = 1.5; ctx.stroke();
        }
    }

    // A "sweet old lady" who's actually a cop — the shawl FLIES off and a police
    // cap pops up as the disguise drops, with a wagging finger.
    function drawOldLadyCop(x, y, t) {
        var reveal = clamp((t - 0.45) / 0.5, 0, 1);
        ctx.save(); ctx.translate(x, y); ctx.scale(1.3, 1.3);
        // cop body (revealed) — navy uniform
        ctx.fillStyle = "#1A237E"; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-13, 24); ctx.lineTo(13, 24); ctx.closePath(); ctx.fill();
        if (reveal < 1) {   // the shawl still partly on / flying off
            ctx.save(); ctx.globalAlpha = 1 - reveal * 0.6; ctx.translate(reveal * 34, -reveal * 40); ctx.rotate(reveal * 1.4);
            ctx.fillStyle = "#8D6E63"; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-15, 22); ctx.lineTo(15, 22); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        // head
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -14, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#E0E0E0"; ctx.beginPath(); ctx.arc(0, -18, 8, Math.PI, Math.PI * 2); ctx.fill();   // gray bun (under cap)
        ctx.strokeStyle = "#37474F"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-3, -14, 2.2, 0, Math.PI * 2); ctx.arc(3, -14, 2.2, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-3, -14, 0.9, 0, Math.PI * 2); ctx.arc(3, -14, 0.9, 0, Math.PI * 2); ctx.fill();
        // police cap drops onto her head on reveal
        if (reveal > 0) {
            ctx.save(); ctx.translate(0, -22 + (1 - reveal) * -14); ctx.globalAlpha = reveal;
            ctx.fillStyle = "#0D1457"; roundRect(-12, -2, 24, 7, 2); ctx.fill();
            ctx.fillStyle = "#1A237E"; roundRect(-9, -8, 18, 7, 2); ctx.fill();
            ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.arc(0, -4, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            // wagging finger
            var wag = Math.sin(t * 12) * 6;
            ctx.strokeStyle = C.skin; ctx.lineWidth = 3; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(-14, 4); ctx.lineTo(-22 + wag, -8); ctx.stroke(); ctx.lineCap = "butt";
        }
        ctx.restore();
        if (reveal > 0.6) drawText("FREEZE! 🚔", x, y - 40, "bold 13px 'Segoe UI', Arial, sans-serif", "#FF5252", "#000", 3);
    }

    // A white-coat doctor with a clipboard / stethoscope.
    function drawDoctor(x, y, t, talking) {
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0, 28, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#37474F"; roundRect(-6, 12, 5, 16, 2); ctx.fill(); roundRect(1, 12, 5, 16, 2); ctx.fill();
        ctx.fillStyle = "#212121"; roundRect(-7, 26, 8, 4, 2); ctx.fill(); roundRect(0, 26, 8, 4, 2); ctx.fill();
        ctx.fillStyle = "#FAFAFA"; roundRect(-12, -10, 24, 24, 5); ctx.fill();           // coat
        ctx.fillStyle = "#E0E0E0"; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-5, 14); ctx.lineTo(5, 14); ctx.fill();
        ctx.strokeStyle = "#455A64"; ctx.lineWidth = 1.6;                                  // stethoscope
        ctx.beginPath(); ctx.moveTo(-4, -7); ctx.quadraticCurveTo(0, 8, 4, -7); ctx.stroke();
        ctx.fillStyle = "#90A4AE"; ctx.beginPath(); ctx.arc(4, -6, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FAFAFA"; roundRect(-13, -8, 4, 14, 2); ctx.fill();
        ctx.fillStyle = "#8D6E63"; roundRect(9, -8, 6, 14, 1); ctx.fill();                 // clipboard
        ctx.fillStyle = "#FFF"; roundRect(10, -7, 4, 11, 1); ctx.fill();
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(0, -18, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -18, 7.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3E2723"; ctx.beginPath(); ctx.arc(0, -20, 8, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = "#263238"; ctx.lineWidth = 1;                                    // glasses
        ctx.beginPath(); ctx.arc(-2.6, -18, 2, 0, Math.PI * 2); ctx.arc(2.6, -18, 2, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-2.6, -18, 0.9, 0, Math.PI * 2); ctx.arc(2.6, -18, 0.9, 0, Math.PI * 2); ctx.fill();
        if (talking) { ctx.fillStyle = "#5D2A2A"; ctx.beginPath(); ctx.ellipse(0, -12, 1.6, 0.8 + Math.abs(Math.sin(t * 15)) * 1.4, 0, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.strokeStyle = "#5D2A2A"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -13, 2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
        ctx.restore();
        drawText("DR. SHTERN", x, y + 34, "bold 8px 'Segoe UI', Arial, sans-serif", "#00897B", "#FFF", 2);
    }
