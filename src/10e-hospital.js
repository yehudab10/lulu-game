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
    // [label, billMul, resultLine, extraLife]
    var HOSP_OPTIONS = [
        { label: "🩹 Just patch me up", billMul: 1.0, extra: false, say: "Band-aid, a lollipop, you're golden. Try the BRAKES next time." },
        { label: "💊 The GOOD stuff, doc!", billMul: 2.0, extra: true, say: "Premium care! Extra heart on the house. Wheee~ 💕" },
        { label: "🏃 Skip the bill — RUN!", billMul: 0, extra: false, say: "HEY! Get back here with that gown— ...and she's gone. 🏃", dash: true }
    ];

    // Wake her up in the ER. Returns true (so callers can use it as a reprieve).
    function beginHospital(reason) {
        hospital = { phase: 0, t: 0, typeT: 0, reason: reason || "crash",
                     diagnosis: randPick(DIAGNOSES), greet: randPick(DOC_GREET),
                     options: HOSP_OPTIONS, choice: -1, bill: 0, applied: false, ekg: 0, line: null,
                     lines: null, li: 0 };
        copChase = null; copBust = null; copStop = null;
        playTone(880, 0.1, "sine", 0.06); setTimeout(function () { playTone(880, 0.1, "sine", 0.06); }, 700);
        state = "hospital";
        return true;
    }

    function hospOptRect(i) { return { x: 22, y: H - 162 + i * 46, w: W - 44, h: 40 }; }

    // typewriter helpers (shared shape with the courtroom)
    function hospTyped(full) { return full.slice(0, Math.floor(hospital.typeT * 45)); }
    function hospDone(full) { return Math.floor(hospital.typeT * 45) >= full.length; }

    function updateHospital(dt) {
        hospital.t += dt; hospital.typeT += dt; hospital.ekg += dt;
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
                    hospital.choice = i; hospital.phase = 3; hospital.t = 0; hospital.typeT = 0;
                    hospital.bill = Math.round(rand(25, 55) * opt.billMul);
                    hospital.line = opt.say;
                    playTone(opt.dash ? 300 : 660, 0.06, "sine", 0.1);
                    return;
                }
            }
            return;
        }
        if (hospital.phase === 3) {                 // result → discharge
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
                var dash = hospital.options[hospital.choice].dash;
                hospital = null;
                if (typeof returnToDriving === "function") returnToDriving();
                spawnFloater(player.x, player.y - 50, dash ? "🏃 Skipped the bill!" : "🩹 Patched up — drive safe!", "#7CFC4F");
            }
        }
    }

    function drawHospital() {
        // ── clinical room ──
        var bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, "#CFE7E4"); bg.addColorStop(1, "#A6C9C6");
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#B7D6D2"; for (var ty = 0; ty < H * 0.6; ty += 30) ctx.fillRect(0, ty, W, 1.5);
        ctx.fillStyle = "#7FA9A4"; ctx.fillRect(0, H * 0.6, W, 5);
        ctx.fillStyle = "#9DBDB8"; ctx.fillRect(0, H * 0.6 + 5, W, H);
        // curtain rail + curtain on the right
        ctx.fillStyle = "#78909C"; ctx.fillRect(W * 0.62, 70, 6, H * 0.5);
        ctx.fillStyle = "rgba(120,180,200,0.35)";
        for (var cu = 0; cu < 5; cu++) roundRect(W * 0.64 + cu * 26, 74, 22, H * 0.46, 6), ctx.fill();

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
        ctx.strokeStyle = "#B0BEC5"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ivx, 70); ctx.lineTo(ivx, H * 0.55); ctx.stroke();
        ctx.fillStyle = "#FFCDD2"; roundRect(ivx - 8, 80, 16, 26, 4); ctx.fill();
        ctx.strokeStyle = "#EF9A9A"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ivx, 106); ctx.lineTo(W / 2 + 30, H * 0.5); ctx.stroke();

        // ── bed + Lulu lying down ──
        var bedX = W / 2 - 70, bedY = H * 0.5, bedW = 150, bedH = 40;
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
                drawButton(r.x, r.y, r.w, r.h, opt.label + (opt.billMul > 0 ? "  (~★" + pBill + ")" : "  (free!)"),
                    { bg: opt.dash ? "#EF6C00" : "#00897B", bgDark: opt.dash ? "#BF360C" : "#004D40", small: true });
            }
        } else if (hospital.phase === 3) {
            var d3 = hospDone(hospital.line);
            drawDialogueBox("DR. SHTERN", hospTyped(hospital.line), "doctor", "#80CBC4", hospital.t > 0.6 && d3, !d3);
            if (hospital.applied && hospital.bill > 0)
                drawText("🧾 −" + hospital.paid + " 💰 medical bill", W / 2, H - 168, "bold 14px 'Segoe UI', Arial, sans-serif", "#FF8A80", "#000", 3);
        }
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
