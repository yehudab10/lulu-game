    var dinaNapTucked = false;      // false: "tap to tuck in"; true: drifting off
    var dinaNapTuckTime = 0;        // seconds since tucked in

    function updateDinaNap(dt) {
        // Fresh entry (external code sets dinaRunTimer = 0): reset the beat.
        if (dinaRunTimer === 0) { dinaNapTucked = false; dinaNapTuckTime = 0; }
        dinaRunTimer += dt;
        if (!dinaNapTucked) {
            // Beat 1 — wait for the player to tuck Dina in (or a gentle auto-nudge).
            if (consumeClick() || consumeAction() || dinaRunTimer > 4) {
                dinaNapTucked = true;
                dinaNapTuckTime = 0;
                playTone(523, 0.12, "sine", 0.16, 392); // soft descending "shh"
            }
            return;
        }
        // Beat 2 — drifting off; let it breathe ~3.2s, then tap to wake.
        dinaNapTuckTime += dt;
        if (dinaNapTuckTime > 3.2 && (consumeClick() || consumeAction() || dinaNapTuckTime > 4.5)) {
            state = "dinaHome";
        } else {
            consumeClick(); consumeAction();
        }
    }

    function drawDinaNap() {
        var tucked = dinaNapTucked;
        // Dusk deepens only once she's actually tucked in
        var t = tucked ? clamp(dinaNapTuckTime / 3.2, 0, 1) : 0;
        // gentle breathing factor (slower & deeper once asleep)
        var breath = Math.sin(dinaRunTimer * (tucked ? 1.6 : 2.4)) * (tucked ? 3 : 2);
        ctx.fillStyle = "#FFE8C8";
        ctx.fillRect(0, 0, W, H);
        // Dim overlay
        ctx.fillStyle = "rgba(40, 25, 80, " + (t * 0.55) + ")";
        ctx.fillRect(0, 0, W, H);
        // Bed in middle of screen
        ctx.fillStyle = "#5D4037";
        roundRect(W / 2 - 160, H / 2 - 80, 320, 180, 14); ctx.fill();
        ctx.fillStyle = "#F4A4B8";
        roundRect(W / 2 - 150, H / 2 - 70, 300, 160, 10); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        roundRect(W / 2 - 120, H / 2 - 60, 240, 40, 8); ctx.fill();
        // Blanket — sits low before tuck-in, pulled up snug after; gentle breathing rise.
        // Bottom edge is fixed at H/2+80; the top edge moves so it never overshoots the bed.
        var blanketBottom = H / 2 + 80;
        var blanketTop = tucked ? (H / 2 - 20 - breath) : (H / 2 + 4);
        ctx.fillStyle = "#B8E0D2";
        roundRect(W / 2 - 100, blanketTop, 200, blanketBottom - blanketTop, 8); ctx.fill();
        // Dina's head poking out (rises/falls subtly with breath)
        var headY = H / 2 - 35 + breath * 0.35;
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(W / 2, headY, 22, 0, Math.PI * 2); ctx.fill();
        // Hair
        ctx.fillStyle = "#6B4423";
        ctx.beginPath();
        ctx.arc(W / 2, headY - 10, 24, Math.PI, Math.PI * 2);
        ctx.fill();
        // Sleeping eyes (closed arcs)
        ctx.strokeStyle = "#3D2817";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(W / 2 - 7, headY, 4, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.arc(W / 2 + 7, headY, 4, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.stroke();
        // Tiny smile
        ctx.strokeStyle = "#A0394D";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(W / 2, headY + 7, 4, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
        // Floating Z's (only once she's actually asleep)
        if (tucked) {
            for (var zi = 0; zi < 3; zi++) {
                var zt = (dinaNapTuckTime + zi * 0.5) % 2;
                var alpha = (1 - zt / 2) * Math.min(1, dinaNapTuckTime);
                ctx.save();
                ctx.globalAlpha = Math.max(0, alpha);
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "bold " + (20 + zi * 6) + "px Arial";
                ctx.textAlign = "left";
                ctx.fillText("Z", W / 2 + 20 + zi * 20, headY - 35 - zt * 50);
                ctx.restore();
            }
        }
        // Floating moon/stars
        ctx.fillStyle = "#FFEE58";
        for (var sti = 0; sti < 6; sti++) {
            ctx.fillText("★", (sti * 87 + 47) % W, 50 + (sti % 3) * 30);
        }

        // Beat 1 prompt — invite the player to tuck Dina in
        if (!tucked) {
            var bob = Math.sin(dinaRunTimer * 3) * 4;
            drawText("Dina's so tired...", W / 2, H - 120,
                "bold 18px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#3D2C6B", 4);
            drawText("👆 Tap to tuck her in", W / 2, H - 80 + bob,
                "bold 20px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 4);
        } else {
            // Beat 2 — sweet dreams, then the earned reward
            ctx.globalAlpha = Math.min(1, dinaNapTuckTime * 2);
            drawText("Sweet dreams, Dina 💤", W / 2, H - 120,
                "bold 18px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#3D2C6B", 4);
            ctx.globalAlpha = 1;
            if (t > 0.7) {
                ctx.globalAlpha = (t - 0.7) / 0.3;
                drawText("💤 RESTED! +1 ⭐", W / 2, H - 80,
                    "bold 22px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 5);
                drawText("Tap to wake up", W / 2, H - 40,
                    "12px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#000", 3);
                ctx.globalAlpha = 1;
            }
        }

        // Award the star once (only after she's actually rested)
        if (tucked && t >= 1 && !window.__napAwarded) {
            window.__napAwarded = true;
            save.parkingTotalStars += 1;
            persistSave();
            setTimeout(function () { window.__napAwarded = false; }, 1000);
        }
    }

    // ════════════════════════════════════════════════════════
    // ══════════════ AVIGAIL MODE ════════════════════════════
    // ════════════════════════════════════════════════════════

    // Roadside Avigail (top-down) — curly black hair, purple top
    function drawAvigailWalker(x, y, walkTime) {
        ctx.save();
        ctx.translate(x, y);
        var legSwing = Math.sin(walkTime * 11) * 4;
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(0, 16, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
        // Legs
        ctx.fillStyle = "#37474F";
        roundRect(-5, 4 - legSwing, 4, 14 + legSwing, 2); ctx.fill();
        roundRect(1, 4 + legSwing, 4, 14 - legSwing, 2); ctx.fill();
        ctx.fillStyle = "#212121";
        roundRect(-6, 16 - legSwing, 6, 4, 2); ctx.fill();
        roundRect(0, 16 + legSwing, 6, 4, 2); ctx.fill();
        // Purple top
        ctx.fillStyle = "#5E35B1";
        roundRect(-9, -8, 18, 16, 5); ctx.fill();
        ctx.fillStyle = "#7E57C2";
        roundRect(-8, -7, 16, 14, 4); ctx.fill();
        // Arms
        ctx.fillStyle = "#7E57C2";
        roundRect(-11, -6, 4, 12, 2); ctx.fill();
        roundRect(7, -6, 4, 12, 2); ctx.fill();
        ctx.fillStyle = "#C68642";
        ctx.beginPath(); ctx.arc(-9, 7, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(9, 7, 2.5, 0, Math.PI * 2); ctx.fill();
        // Head (deeper skin)
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(0, -14, 8.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#C68642";
        ctx.beginPath(); ctx.arc(0, -14, 7, 0, Math.PI * 2); ctx.fill();
        // Curly black hair halo
        ctx.fillStyle = "#1A1A1A";
        var curls = [[-7, -18], [-2, -21], [4, -21], [8, -17], [-9, -13], [9, -12]];
        for (var ci = 0; ci < curls.length; ci++) {
            ctx.beginPath(); ctx.arc(curls[ci][0], curls[ci][1], 4, 0, Math.PI * 2); ctx.fill();
        }
        // Gold hoop earrings
        ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(-7, -11, 2, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(7, -11, 2, 0, Math.PI * 2); ctx.stroke();
        // Eyes
        ctx.fillStyle = "#FFF";
        ctx.beginPath();
        ctx.arc(-2.5, -14, 1.4, 0, Math.PI * 2);
        ctx.arc(2.5, -14, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(-2.5, -14, 0.8, 0, Math.PI * 2);
        ctx.arc(2.5, -14, 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Salon sign (roadside) — scissors + "HAIR" sign
    function drawSalonSign(x, y, bob) {
        ctx.save();
        ctx.translate(x, y + Math.sin(bob * 3) * 3);
        // Glow
        ctx.fillStyle = "rgba(216,27,96,0.25)";
        ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
        // Pole
        ctx.fillStyle = "#90A4AE";
        ctx.fillRect(-1.5, 14, 3, 10);
        // Sign body (pink salon sign)
        ctx.fillStyle = "#AD1457";
        roundRect(-18, -16, 36, 30, 5); ctx.fill();
        ctx.fillStyle = "#EC407A";
        roundRect(-16, -14, 32, 26, 4); ctx.fill();
        // Scissors icon
        ctx.strokeStyle = "#FFF"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-6, 6); ctx.lineTo(4, -4);
        ctx.moveTo(-6, -4); ctx.lineTo(4, 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-7, 7, 2, 0, Math.PI * 2);
        ctx.arc(-7, -5, 2, 0, Math.PI * 2);
        ctx.stroke();
        // "HAIR" label
        ctx.fillStyle = "#FFF";
        ctx.font = "bold 8px 'Segoe UI', Arial, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("SALON", 0, 10);
        ctx.restore();
    }

    // Avigail's face for the door scene (around cx, cy)
    function drawAvigailFace(cx, cy, expr, time) {
        ctx.save();
        ctx.translate(cx, cy);
        // Curly black hair halo (behind)
        ctx.fillStyle = "#1A1A1A";
        for (var a = 0; a < 9; a++) {
            var ang = (a / 9) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(Math.cos(ang) * 42, Math.sin(ang) * 40 - 8, 13, 0, Math.PI * 2);
            ctx.fill();
        }
        // Face
        ctx.fillStyle = "#C68642";
        ctx.beginPath(); ctx.arc(0, -8, 38, 0, Math.PI * 2); ctx.fill();
        // Gold hoops
        ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(-34, 8, 6, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(34, 8, 6, 0, Math.PI * 2); ctx.stroke();
        // Eyes
        var eyeSquash = expr === "suspicious" ? 0.55
            : expr === "smug" ? 0.6
            : (expr === "dramatic" || expr === "panic") ? 1.35
            : 1;
        ctx.fillStyle = "#FFF";
        ctx.beginPath();
        ctx.ellipse(-13, -12, 6, 6 * eyeSquash, 0, 0, Math.PI * 2);
        ctx.ellipse(13, -12, 6, 6 * eyeSquash, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#4E342E";
        ctx.beginPath();
        ctx.arc(-13, -12, 3, 0, Math.PI * 2);
        ctx.arc(13, -12, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(-13, -12, 1.5, 0, Math.PI * 2);
        ctx.arc(13, -12, 1.5, 0, Math.PI * 2);
        ctx.fill();
        // Eyebrows by expression
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
        ctx.beginPath();
        if (expr === "suspicious") {
            ctx.moveTo(-20, -24); ctx.lineTo(-6, -22);      // one raised
            ctx.moveTo(6, -20); ctx.lineTo(20, -20);
        } else if (expr === "annoyed") {
            ctx.moveTo(-20, -20); ctx.lineTo(-6, -24);      // angled down-in
            ctx.moveTo(6, -24); ctx.lineTo(20, -20);
        } else if (expr === "dramatic") {
            ctx.moveTo(-20, -26); ctx.lineTo(-6, -28);      // both up
            ctx.moveTo(6, -28); ctx.lineTo(20, -26);
        } else if (expr === "smug") {
            ctx.moveTo(-20, -26); ctx.lineTo(-6, -22);      // one cocked high
            ctx.moveTo(6, -20); ctx.lineTo(20, -20);
        } else if (expr === "panic") {
            ctx.moveTo(-20, -28); ctx.lineTo(-6, -24);      // both high & pinched
            ctx.moveTo(6, -24); ctx.lineTo(20, -28);
        } else if (expr === "love") {
            ctx.moveTo(-20, -25); ctx.lineTo(-6, -27);
            ctx.moveTo(6, -27); ctx.lineTo(20, -25);
        } else { // excited
            ctx.moveTo(-20, -24); ctx.lineTo(-6, -26);
            ctx.moveTo(6, -26); ctx.lineTo(20, -24);
        }
        ctx.stroke();
        ctx.lineCap = "butt";
        // Mouth by expression
        ctx.fillStyle = "#D32F2F";
        if (expr === "excited") {
            ctx.beginPath(); ctx.arc(0, 8, 12, 0, Math.PI); ctx.fill();
            ctx.fillStyle = "#FFF"; ctx.fillRect(-9, 8, 18, 4);
        } else if (expr === "dramatic") {
            ctx.beginPath(); ctx.ellipse(0, 12, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
            // hand to forehead
            ctx.fillStyle = "#C68642";
            ctx.beginPath(); ctx.ellipse(-22, -28, 10, 6, -0.5, 0, Math.PI * 2); ctx.fill();
        } else if (expr === "annoyed") {
            ctx.strokeStyle = "#7D1010"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(0, 18, 8, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
        } else if (expr === "love") {
            ctx.beginPath(); ctx.arc(0, 8, 12, 0, Math.PI); ctx.fill();   // big smile
            ctx.fillStyle = "#FFF"; ctx.fillRect(-9, 8, 18, 4);
            // little heart cheeks
            ctx.fillStyle = "rgba(233,30,99,0.45)";
            ctx.beginPath(); ctx.arc(-22, 2, 5, 0, Math.PI * 2); ctx.arc(22, 2, 5, 0, Math.PI * 2); ctx.fill();
        } else if (expr === "panic") {
            ctx.beginPath(); ctx.ellipse(0, 12, 6, 8, 0, 0, Math.PI * 2); ctx.fill(); // small O
            // sweat drop
            ctx.fillStyle = "#4FC3F7";
            ctx.beginPath(); ctx.arc(28, -14, 3.5, 0, Math.PI * 2); ctx.fill();
        } else if (expr === "smug") {
            ctx.strokeStyle = "#7D1010"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(-8, 12); ctx.quadraticCurveTo(2, 16, 9, 9); ctx.stroke(); // smirk
        } else { // suspicious - flat line
            ctx.strokeStyle = "#7D1010"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(8, 12); ctx.stroke();
        }
        // Bold red lips hint (when not open-mouthed)
        ctx.restore();
    }

    // Avigail dialogue — assembled FRESH each pickup from pools below so the
    // conversation is rarely the same twice.
    //   • AVIGAIL_OPENERS  — step 0. Each has a "rugelach" choice; picking it sets
    //                        avigailHasRugelach. The chosen opener is tagged isOpener.
    //   • AVIGAIL_MIDDLES  — a shuffled subset fills the middle.
    //   • AVIGAIL_SNACKS   — one snack step (tagged isSnack) where "Rugelach. As
    //                        promised." pays off the promise made at the door.
    //   • AVIGAIL_CLOSERS  — final spoken line as she joins the trip (2x points).
    // engine reads step.prompt + choice.{label,reply,expr}. <=3 choices/step.
    // The rugelach payoff keys off the isOpener / isSnack tags (set at assembly
    // time), NOT a fixed index, so shuffling can never break it.

    // ── Openers (step 0). The rugelach choice is always present; rugelachIdx
    //    records which choice index promises rugelach for this opener. ──
    var AVIGAIL_OPENERS = [
        {
            prompt: "Nobody's home! This is\nher cat speaking.",
            expr: "suspicious", rugelachIdx: 2,
            choices: [
                { label: "Cats can't talk.", reply: "...Meow. Dang it. Hold on,\nI'm getting dressed.", expr: "annoyed" },
                { label: "I see your feet under the door.", reply: "These are DECORATIVE feet.\nVery on-trend this season.", expr: "suspicious" },
                { label: "I brought rugelach.", reply: "WHY didn't you LEAD with\nthat?! Door's basically open.", expr: "excited" }
            ]
        },
        {
            prompt: "I'm not coming out. I'm in\nmy pajamas and my FEELINGS.",
            expr: "dramatic", rugelachIdx: 1,
            choices: [
                { label: "It's 2 in the afternoon.", reply: "Time is a SOCIAL CONSTRUCT,\nLulu. So is your invitation.", expr: "smug" },
                { label: "There's rugelach out here.", reply: "...Pajamas ARE a fashion\nstatement. I'll be RIGHT out.", expr: "excited" },
                { label: "Same hat. Let me in.", reply: "Oh you GET it. Ugh, fine.\nUnlocking the door of doom.", expr: "love" }
            ]
        },
        {
            prompt: "State your business! And NO,\nI did not order a salad.",
            expr: "suspicious", rugelachIdx: 0,
            choices: [
                { label: "I literally brought rugelach.", reply: "RUGELACH?! Why are we still\nTALKING? Move, move, move!", expr: "excited" },
                { label: "It's me, Lulu. Open up.", reply: "'It's me' could be ANYONE.\nProve it. ...okay it's you.", expr: "suspicious" },
                { label: "Road trip. Get in the car.", reply: "A road trip? Unannounced??\nThe AUDACITY. I'm intrigued.", expr: "smug" }
            ]
        }
    ];

    // ── Middle exchanges — a shuffled subset is used each run. ──
    var AVIGAIL_MIDDLES = [
        {
            prompt: "Oh. It's YOU. The ghoster\nherself, in the FLESH.",
            expr: "annoyed",
            choices: [
                { label: "I never ghosted you!", reply: "You left me on read for\n9 DAYS, Lulu. NINE.", expr: "annoyed" },
                { label: "I missed your face?", reply: "Don't you 'miss your face' me.\n...okay it IS a great face.", expr: "smug" },
                { label: "Ima made me come.", reply: "Your IMA has better manners\nthan you. Tell her I said hi.", expr: "dramatic" }
            ]
        },
        {
            prompt: "Nine days! I sat by my\nphone like it was Shabbos!",
            expr: "dramatic",
            choices: [
                { label: "My phone fell in a lake.", reply: "Your phone. In a lake.\nWalking distance from MY house?", expr: "suspicious" },
                { label: "I was emotionally busy.", reply: "Emotionally busy. Iconic.\nUnforgivable, but iconic.", expr: "smug" },
                { label: "I sent a thumbs up!", reply: "A THUMBS UP. To 'I think my\ncholent gained sentience.'", expr: "annoyed" }
            ]
        },
        {
            prompt: "And why'd you find me\nWALKING? I have a CAR.",
            expr: "annoyed",
            choices: [
                { label: "Your car broke down again?", reply: "It's RESTING. It's not broken,\nit's spiritually recharging.", expr: "annoyed" },
                { label: "You walk dramatically tho.", reply: "I walk with PURPOSE. There's\na difference, peasant.", expr: "dramatic" },
                { label: "Were you avoiding someone?", reply: "...We do NOT speak of Tzippy\nfrom Lev Bais Yaakov. Drive.", expr: "panic" }
            ]
        },
        {
            prompt: "Hold on — is THIS the car?\nIt sounds like a kettle.",
            expr: "suspicious",
            choices: [
                { label: "She's vintage.", reply: "She's a HAZARD with a\nnamePlate. I love her already.", expr: "smug" },
                { label: "That's the AC. Probably.", reply: "That is NOT the AC, Lulu.\nThat is a CRY for help.", expr: "panic" },
                { label: "Don't insult my car.", reply: "I'll insult whatever I want.\nIt's in my contract. Get in.", expr: "smug" }
            ]
        },
        {
            prompt: "Okay but I'm calling shotgun\nAND aux. Non-negotiable.",
            expr: "smug",
            choices: [
                { label: "You played 1 song for 3 hrs.", reply: "It was a JOURNEY and you\nweren't emotionally ready.", expr: "dramatic" },
                { label: "Deal — no sad-girl playlist.", reply: "Then I have NOTHING to offer\nthis world. ...Fine. One bop.", expr: "dramatic" },
                { label: "Aux is yours, your majesty.", reply: "Was that sarcasm? I'll allow\nit. ONCE. Don't push it.", expr: "smug" }
            ]
        },
        {
            prompt: "Last thing. Swear we're not\npicking up your cousin again.",
            expr: "suspicious",
            choices: [
                { label: "I swear on the cholent.", reply: "That's the HOLIEST oath you\nhave. Okay. I believe you.", expr: "excited" },
                { label: "...Define 'picking up.'", reply: "LULU. I KNEW it. Turn the\ncar around— no, fine, GO.", expr: "panic" },
                { label: "He moved to Lakewood.", reply: "Baruch Hashem. Truly. Start\nthe kettle— I mean, the car.", expr: "love" }
            ]
        },
        // ── fresh material ──
        {
            prompt: "Wait. Did you bring snacks\nOR did you bring DRAMA?",
            expr: "suspicious",
            choices: [
                { label: "Why not both?", reply: "...That's the most ME thing\nyou've EVER said. I'm proud.", expr: "love" },
                { label: "Drama, obviously.", reply: "FINALLY. Someone who under-\nstands my LIFESTYLE. Get in.", expr: "excited" },
                { label: "Snacks. Always snacks.", reply: "A woman of SUBSTANCE. My\nrespect? Earned. Barely.", expr: "smug" }
            ]
        },
        {
            prompt: "I had a DREAM about you.\nYou owed me a casserole.",
            expr: "dramatic",
            choices: [
                { label: "Dreams aren't real debts.", reply: "Tell that to my SUBCONSCIOUS.\nShe keeps RECEIPTS, Lulu.", expr: "annoyed" },
                { label: "I'll bake you two.", reply: "TWO casseroles?! Okay now\nI'm getting in the car FAST.", expr: "love" },
                { label: "That's so specific.", reply: "My dreams have PRODUCTION\nVALUE. Unlike your texting.", expr: "smug" }
            ]
        },
        {
            prompt: "Quick poll: am I the funny\nfriend or the WISE one today?",
            expr: "smug",
            choices: [
                { label: "Funny. Definitely funny.", reply: "WRONG. I'm BOTH. This is a\ntrick poll. You failed. Drive.", expr: "annoyed" },
                { label: "Wise AND funny.", reply: "Correct answer. Suspicious\nspeed, though. Were you coached?", expr: "suspicious" },
                { label: "The dramatic one?", reply: "...How DARE you be RIGHT.\nUgh. Get in before I cry.", expr: "dramatic" }
            ]
        },
        {
            prompt: "I'm bringing my emotional\nsupport water bottle. Issue?",
            expr: "suspicious",
            choices: [
                { label: "No issue at all.", reply: "Good. She's named Brenda.\nBrenda gets the cupholder.", expr: "excited" },
                { label: "Does it have a name?", reply: "Obviously. BRENDA. Keep up.\nShe's been through a LOT.", expr: "dramatic" },
                { label: "We're not bringing Brenda.", reply: "Then I'm not bringing ME.\n...kidding. Brenda's coming.", expr: "smug" }
            ]
        },
        {
            prompt: "Be honest. Is my hair giving\n'main character' today?",
            expr: "dramatic",
            choices: [
                { label: "It's giving LEGEND.", reply: "I KNOW. But I needed YOU\nto know that I know. Thank you.", expr: "love" },
                { label: "It's giving... humid.", reply: "Slander! In MY doorway?!\nGet in before I rethink this.", expr: "annoyed" },
                { label: "Better than mine.", reply: "Finally, some self-awareness.\nWe're gonna get along GREAT.", expr: "smug" }
            ]
        }
    ];

    // ── Snack step (the rugelach payoff lives here). ──
    var AVIGAIL_SNACKS = [
        {
            prompt: "Before I commit: what's the\nsnack situation in there?",
            expr: "excited",
            choices: [
                { label: "Rugelach. As promised.", reply: "Marry me. Not really. But\nkeep the rugelach coming.", expr: "love" },
                { label: "Half a granola bar.", reply: "Half?? Who ATE the other half\nin a moving vehicle?? Animal.", expr: "annoyed" },
                { label: "Vibes only.", reply: "'Vibes only' is how friend-\nships END, Lulu. But fine.", expr: "dramatic" }
            ]
        },
        {
            prompt: "Non-negotiable: is there\nsomething to NOSH on?",
            expr: "excited",
            choices: [
                { label: "Rugelach. As promised.", reply: "You REMEMBERED. I'm welling\nup. Don't look at me. DRIVE.", expr: "love" },
                { label: "A suspicious mint.", reply: "A MINT? One? Singular?? This\nis a CRISIS, not a road trip.", expr: "panic" },
                { label: "Gas station pretzels.", reply: "Gas station pretzels are a\nLOVE LANGUAGE. Fine. I'm in.", expr: "smug" }
            ]
        }
    ];

    var AVIGAIL_CLOSERS = [
        "Okay LET'S GO. I'm driving.\n...Fine, YOU drive. This time.",
        "If we get snacks on the way,\nall nine days are forgiven.",
        "I'm only coming for the aux\ncord and the bit. Mostly the bit.",
        "Buckle up. If we die, I'm\ntelling everyone it was YOUR fault.",
        "Shotgun, aux, AND the last\nrugelach. That's the deal. Go go go.",
        "Brenda's buckled, I'm buckled,\nlet's make some QUESTIONABLE memories.",
        "I forgive you. Conditionally.\nThe condition is more rugelach."
    ];

    var avigailHasRugelach = false;
    var AVIGAIL_SCRIPT = null;                                // assembled per scene
    var avigailRugelachIdx = AVIGAIL_OPENERS[0].rugelachIdx;  // updated at assembly

    // Fisher-Yates-ish shuffle returning a fresh array (does not mutate input).
    function avigailShuffle(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = randInt(0, i);
            var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
        }
        return a;
    }

    // Assemble a fresh ~6-8 step script: opener (tagged isOpener) + shuffled
    // middles + a snack step (tagged isSnack), all inserted in a pleasant order.
    function buildAvigailScript() {
        var opener = randPick(AVIGAIL_OPENERS);
        opener.isOpener = true;                        // tag drives rugelach-promise logic
        avigailRugelachIdx = opener.rugelachIdx;

        var snack = randPick(AVIGAIL_SNACKS);
        snack.isSnack = true;                          // tag drives the payoff logic

        // 4-5 random middles → total 6-7 steps with opener + snack.
        var midCount = randInt(4, 5);
        var mids = avigailShuffle(AVIGAIL_MIDDLES).slice(0, midCount);

        var script = [opener];
        // Drop the snack step somewhere in the back half so the promise has time
        // to register, then append the rest of the middles after it.
        var splitAt = Math.ceil(mids.length / 2);
        for (var m = 0; m < splitAt; m++) script.push(mids[m]);
        script.push(snack);
        for (var n = splitAt; n < mids.length; n++) script.push(mids[n]);
        return script;
    }

    function startAvigailScene() {
        prevState = "playing";
        state = "avigailScene";
        avigailStep = 0;
        avigailReplyTimer = 0;
        avigailReply = "";
        avigailExpr = "suspicious";
        avigailDoorTimer = 2.0;
        avigailResolved = false;
        avigailHasRugelach = false;
        AVIGAIL_SCRIPT = buildAvigailScript();   // fresh randomized conversation
    }

    function updateAvigailScene(dt) {
        gameTime += dt; // keep face/bubble animations ticking
        if (avigailDoorTimer > 0) {
            avigailDoorTimer -= dt;
            consumeClick(); consumeAction();
            return;
        }
        // Showing a reply — wait then advance
        if (avigailReplyTimer > 0) {
            avigailReplyTimer -= dt;
            consumeClick();
            if (avigailReplyTimer <= 0) {
                if (avigailResolved) { finishAvigailScene(); return; }
                avigailStep++;
                if (avigailStep >= AVIGAIL_SCRIPT.length) {
                    // Resolution
                    avigailResolved = true;
                    avigailReply = randPick(AVIGAIL_CLOSERS);
                    avigailExpr = "excited";
                    avigailReplyTimer = 2.2;
                    playTone(660, 0.1, "triangle", 0.2);
                }
            }
            return;
        }
        // Awaiting a choice
        var click = consumeClick();
        if (click) {
            var dec = AVIGAIL_SCRIPT[avigailStep];
            if (!dec) return;
            for (var i = 0; i < dec.choices.length; i++) {
                var by = 636 + i * 60;
                if (pointInRect(click.x, click.y, 70, by, 340, 54)) {
                    var ch = dec.choices[i];
                    // remember the rugelach promise — tracked via the opener tag +
                    // its own rugelachIdx, so step order/shuffle can't break it.
                    if (dec.isOpener) avigailHasRugelach = (i === avigailRugelachIdx);
                    // payoff: on the snack step, "Rugelach. As promised." (choice 0)
                    // only lands if a rugelach promise was actually made at the door.
                    if (dec.isSnack && i === 0 && !avigailHasRugelach) {
                        avigailReply = "You said RUGELACH at the door\nand brought... NOTHING? Get in.";
                        avigailExpr = "annoyed";
                    } else {
                        avigailReply = ch.reply;
                        avigailExpr = ch.expr;
                    }
                    avigailReplyTimer = 1.9;
                    playClick();
                    return;
                }
            }
        }
    }

    function finishAvigailScene() {
        avigailInCar = true;
        pointMult = 2;
        parkingMsg = "💜 AVIGAIL JOINED! 2× POINTS!";
        parkingMsgTimer = 3;
        spawnCoinSparkle(W / 2, H / 2);
        returnToDriving();
    }

    function drawAvigailScene() {
        // Porch background
        var sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, "#FFD89E"); sky.addColorStop(1, "#C9A8E8");
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
        // House wall
        ctx.fillStyle = "#FFE0B2";
        ctx.fillRect(0, 120, W, H - 120);
        // Door
        ctx.fillStyle = "#00796B";
        roundRect(W / 2 - 90, 200, 180, 360, 10); ctx.fill();
        ctx.fillStyle = "#26A69A";
        roundRect(W / 2 - 82, 208, 164, 344, 8); ctx.fill();
        ctx.strokeStyle = "#004D40"; ctx.lineWidth = 4;
        roundRect(W / 2 - 90, 200, 180, 360, 10); ctx.stroke();
        // Brass knob
        ctx.fillStyle = "#FFD700";
        ctx.beginPath(); ctx.arc(W / 2 + 66, 390, 7, 0, Math.PI * 2); ctx.fill();
        // Nameplate
        ctx.fillStyle = "#FFD54F";
        roundRect(W / 2 - 70, 150, 140, 30, 6); ctx.fill();
        ctx.strokeStyle = "#5D4037"; ctx.lineWidth = 2;
        roundRect(W / 2 - 70, 150, 140, 30, 6); ctx.stroke();
        drawText("AVIGAIL'S LAIR", W / 2, 165, "bold 13px 'Segoe UI', Arial, sans-serif", "#5D4037", null, 0);
        // Wreath
        ctx.strokeStyle = "#FBC02D"; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(W / 2, 270, 28, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#5D4037";
        ctx.beginPath(); ctx.arc(W / 2, 270, 8, 0, Math.PI * 2); ctx.fill();
        // Doormat
        ctx.fillStyle = "#A1887F";
        roundRect(W / 2 - 70, H - 70, 140, 36, 4); ctx.fill();
        drawText("GO AWAY :)", W / 2, H - 52, "bold 14px 'Segoe UI', Arial, sans-serif", "#3E2723", null, 0);

        if (avigailDoorTimer > 0) {
            // Lulu knocking (just show her car-less standing — reuse portrait small)
            drawText("*knock knock knock*", W / 2, 110,
                "bold 18px 'Segoe UI', Arial, sans-serif", "#5D4037", "#FFF", 3);
            drawSpeechBubble(W / 2, 430, "Knock knock! I KNOW\nyou're home, Avigail.", avigailDoorTimer * 5);
            return;
        }

        // Rugelach-promise token — visible once Lulu has promised rugelach, so the
        // later "as promised" payoff feels earned rather than a hidden gotcha.
        if (avigailHasRugelach) {
            var tokY = 100;
            ctx.fillStyle = "rgba(255,255,255,0.92)";
            roundRect(W - 150, tokY - 16, 130, 32, 16); ctx.fill();
            ctx.strokeStyle = "#8D6E63"; ctx.lineWidth = 2;
            roundRect(W - 150, tokY - 16, 130, 32, 16); ctx.stroke();
            drawText("🍪 promised", W - 85, tokY, "bold 14px 'Segoe UI', Arial, sans-serif", "#5D4037", null, 0);
        }

        // Avigail in the doorway
        drawAvigailFace(W / 2, 330, avigailExpr, gameTime);

        // Speech bubble: either prompt or reply
        var bubbleText, lockChoices = false;
        if (avigailReplyTimer > 0) {
            bubbleText = avigailReply;
            lockChoices = true;
        } else {
            // Guard: avigailStep can momentarily equal SCRIPT.length on the frame
            // the closer resolves; fall back gracefully instead of indexing OOB.
            var cur = AVIGAIL_SCRIPT && AVIGAIL_SCRIPT[avigailStep];
            bubbleText = cur ? cur.prompt : "...";
        }
        // Bubble
        ctx.fillStyle = "#FFFFFF";
        roundRect(30, 430, W - 60, 90, 16); ctx.fill();
        ctx.strokeStyle = "#00796B"; ctx.lineWidth = 3;
        roundRect(30, 430, W - 60, 90, 16); ctx.stroke();
        var lines = bubbleText.split("\n");
        for (var li = 0; li < lines.length; li++) {
            drawText(lines[li], W / 2, 460 + li * 24, "bold 17px 'Segoe UI', Arial, sans-serif", "#222", null, 0);
        }

        // Choice buttons (only when awaiting choice)
        if (!lockChoices) {
            // progress hearts so the longer scene feels intentional
            if (!avigailResolved) {
                drawText("♥ " + (avigailStep + 1) + " / " + AVIGAIL_SCRIPT.length,
                    W / 2, 540, "bold 14px 'Segoe UI', Arial, sans-serif", "#5D4037", "#FFF", 2);
            }
            var dec = AVIGAIL_SCRIPT && AVIGAIL_SCRIPT[avigailStep];
            var cols = [{ bg: "#66BB6A", bgDark: "#2E7D32" }, { bg: "#42A5F5", bgDark: "#0D47A1" }, { bg: "#FFC107", bgDark: "#FF6F00" }];
            for (var i = 0; dec && i < dec.choices.length; i++) {
                var by = 636 + i * 60;
                drawButton(70, by, 340, 54, dec.choices[i].label,
                    { bg: cols[i].bg, bgDark: cols[i].bgDark, small: true });
            }
        } else {
            drawText("...", W / 2, 700, "bold 28px Arial", "#FFF", "#000", 3);
        }
    }

    // ════════════════════════════════════════════════════════
    // ══════════════ SALON MODE ══════════════════════════════
    // ════════════════════════════════════════════════════════

    function startSalonScene() {
        prevState = "playing";
        state = "salon";
        salonPhase = 0;
        salonTimer = 0;
        salonPendingColor = null;
        salonIsBlonde = false;
        salonReaction = "";
        salonStyle = null;
        salonOops = false;
        salonConsultStep = 0;
        salonConfirm = false;
    }

    // Confirm sub-step for the color pick (telegraphs the choice before committing).
    var salonConfirm = false;
    // Every color is a win with its own flavor — no coin-flip, no punishment.
    // Keyed by SALON_COLORS label so this lives entirely in this fragment.
    // Blonde colors get the extra fanfare, telegraphed beforehand as Fabio's "✨ Fabio's pick".
    var SALON_OUTCOMES = {
        "PLATINUM": "I'm BLONDE! I'm basically a\nwhole new person now!",
        "GOLDEN":   "GOLD?! Fabio, I could KISS\nyou. I won't. But I COULD.",
        "BRUNETTE": "Rich, glossy brunette. I look\nEXPENSIVE. I love it.",
        "JET BLACK": "Sleek. Mysterious. Main-\ncharacter energy. STUNNING.",
        "PINK":     "PINK?! I'm a cotton-candy\nQUEEN and I OWN it!",
        "BLUE":     "Ocean blue! Bold, cool, and\nTOTALLY my vibe. YES."
    };

    function updateSalon(dt) {
        salonTimer += dt;
        gameTime += dt; // keep Fabio/sparkle animations ticking
        if (salonPhase === 0) {
            // Intro — Fabio greets, auto-advance after 3.5s
            if (salonTimer > 3.5 || consumeAction()) {
                salonPhase = 1; salonTimer = 0;
            }
            consumeClick();
            return;
        }
        if (salonPhase === 1) {
            // DIALOGUE — each tap advances one consult line; last → style pick
            if (consumeClick() || consumeAction()) {
                salonConsultStep++;
                playTone(440, 0.06, "triangle", 0.15);
                if (salonConsultStep >= SALON_CONSULT.length) {
                    salonPhase = 2; salonTimer = 0;
                }
            }
            return;
        }
        if (salonPhase === 2) {
            // STYLE pick — 3 stacked buttons
            var sclick = consumeClick();
            if (sclick) {
                for (var s = 0; s < SALON_STYLES.length; s++) {
                    var sby = 380 + s * 80;
                    if (pointInRect(sclick.x, sclick.y, 60, sby, 380, 64)) {
                        salonStyle = SALON_STYLES[s];
                        salonPhase = 3; salonTimer = 0;
                        playTone(523, 0.1, "triangle", 0.2);
                        return;
                    }
                }
            }
            return;
        }
        if (salonPhase === 3) {
            var click = consumeClick();
            if (!click) return;
            if (salonConfirm) {
                // Confirm step — "Go {COLOR}?"  YES commits, BACK re-opens the swatches.
                if (pointInRect(click.x, click.y, 60, 470, 170, 56)) {        // YES
                    salonConfirm = false;
                    salonPhase = 4; salonTimer = 0;
                    playTone(523, 0.1, "triangle", 0.2);
                } else if (pointInRect(click.x, click.y, 250, 470, 170, 56)) { // BACK
                    salonConfirm = false;
                    salonPendingColor = null;
                    playClick();
                }
                return;
            }
            // COLOR pick — choosing a swatch opens the confirm step (no commit yet)
            for (var i = 0; i < SALON_COLORS.length; i++) {
                var col = i % 2, row = Math.floor(i / 2);
                var bx = 50 + col * 250, by = 360 + row * 100;
                if (pointInRect(click.x, click.y, bx, by, 130, 80)) {
                    salonPendingColor = SALON_COLORS[i];
                    salonIsBlonde = SALON_COLORS[i].blonde;
                    salonConfirm = true;
                    playTone(440, 0.07, "triangle", 0.18);
                    return;
                }
            }
            return;
        }
        if (salonPhase === 4) {
            // Processing ~6.4s of beats, then commit + reveal
            if (salonTimer > 6.4) {
                salonPhase = 5; salonTimer = 0;
                // Commit hair color — permanent, exactly once
                save.luluHair = salonPendingColor.hex;
                persistSave();
                // Every color is a happy result now. ~1-in-8 BONUS surprise: the cat
                // knocks the bottle and it comes out even better (a treat, not a punishment).
                salonOops = (Math.random() < 0.125);
                // Always-positive reaction; oops swaps in its own delighted line.
                salonReaction = salonOops ? SALON_OOPS.lulu
                    : (SALON_OUTCOMES[salonPendingColor.label] || salonPendingColor.luluWin || "I LOVE it!");
                // Cheerful arpeggio for everyone; blonde gets a little extra sparkle.
                spawnCoinSparkle(W / 2, 300);
                playTone(523, 0.1, "triangle", 0.2);
                setTimeout(function () { playTone(659, 0.1, "triangle", 0.2); }, 100);
                setTimeout(function () { playTone(784, 0.1, "triangle", 0.2); }, 200);
                if (salonIsBlonde || salonOops) {
                    setTimeout(function () { playTone(1046, 0.18, "triangle", 0.22); }, 300);
                }
            }
            return;
        }
        if (salonPhase === 5) {
            // Reveal — TAP TO LEAVE
            var click2 = consumeClick();
            if ((click2 && salonTimer > 0.6) || consumeAction() || salonTimer > 18) {
                returnToDriving();
            }
        }
    }

    function drawFabio(x, y, time) {
        ctx.save();
        ctx.translate(x + Math.sin(time * 3) * 4, y);
        // Black smock body
        ctx.fillStyle = "#212121";
        roundRect(-16, 0, 32, 50, 8); ctx.fill();
        // Gold scissor brooch
        ctx.fillStyle = "#FFD700";
        ctx.beginPath(); ctx.arc(0, 14, 4, 0, Math.PI * 2); ctx.fill();
        // Head
        ctx.fillStyle = "#E8B89A";
        ctx.beginPath(); ctx.arc(0, -14, 13, 0, Math.PI * 2); ctx.fill();
        // Towering teal pompadour (3 stacked ellipses)
        ctx.fillStyle = "#26A69A";
        ctx.beginPath(); ctx.ellipse(0, -26, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -34, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-2, -42, 8, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = shadeColor("#26A69A", 40);
        ctx.beginPath(); ctx.ellipse(-4, -28, 5, 3, -0.3, 0, Math.PI * 2); ctx.fill();
        // Eyes
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(-4, -15, 1.4, 0, Math.PI * 2);
        ctx.arc(4, -15, 1.4, 0, Math.PI * 2);
        ctx.fill();
        // Pencil mustache
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-5, -9); ctx.lineTo(0, -8); ctx.lineTo(5, -9);
        ctx.stroke();
        // Oversized scissors (snipping)
        var snip = (Math.sin(time * 6) > 0) ? 0.3 : 0;
        ctx.strokeStyle = "#B0BEC5"; ctx.lineWidth = 2.5;
        ctx.save();
        ctx.translate(20, 6);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(14, -6 - snip * 6);
        ctx.moveTo(0, 0); ctx.lineTo(14, 6 + snip * 6);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(-2, -3, 3, 0, Math.PI * 2); ctx.arc(-2, 3, 3, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        ctx.restore();
    }

    function drawSalon() {
        // Walls (pink gradient)
        var wall = ctx.createLinearGradient(0, 0, 0, 596);
        wall.addColorStop(0, "#FFE0EC"); wall.addColorStop(1, "#FFC1DA");
        ctx.fillStyle = wall; ctx.fillRect(0, 0, W, 596);
        ctx.fillStyle = "#D81B60"; ctx.fillRect(0, 596, W, 6);
        // Checkerboard floor
        for (var fy = 600; fy < H; fy += 30) {
            for (var fx = 0; fx < W; fx += 30) {
                ctx.fillStyle = ((fx / 30 + fy / 30) % 2 === 0) ? "#F5F5F5" : "#F8BBD0";
                ctx.fillRect(fx, fy, 30, 30);
            }
        }
        // Big mirror
        ctx.fillStyle = "#FFD700";
        roundRect(120, 120, 240, 300, 14); ctx.fill();
        ctx.fillStyle = "#D7F0FA";
        roundRect(132, 132, 216, 276, 8); ctx.fill();
        // Mirror sheen
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.beginPath();
        ctx.moveTo(150, 132); ctx.lineTo(220, 132); ctx.lineTo(160, 408); ctx.lineTo(132, 408);
        ctx.closePath(); ctx.fill();

        // Salon chair (with Lulu in it during pick/process; reveal shows new hair)
        // Chrome hydraulic pole + round base.
        ctx.fillStyle = "#90A4AE";
        ctx.fillRect(W / 2 - 5, 470, 10, 150); // pole
        ctx.fillStyle = "#B0BEC5";
        roundRect(W / 2 - 7, 470, 4, 150, 2); ctx.fill(); // pole highlight
        ctx.fillStyle = "#78909C";
        ctx.beginPath(); ctx.ellipse(W / 2, 624, 46, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#B0BEC5";
        ctx.beginPath(); ctx.ellipse(W / 2, 620, 46, 12, 0, 0, Math.PI * 2); ctx.fill();
        // Plush salon chair back (rounded, glossy pink) with armrests.
        ctx.fillStyle = "#AD1457";
        roundRect(W / 2 - 58, 432, 116, 78, 22); ctx.fill();
        ctx.fillStyle = "#EC407A";
        roundRect(W / 2 - 50, 440, 100, 64, 18); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.30)"; // gloss
        roundRect(W / 2 - 44, 446, 88, 18, 12); ctx.fill();
        ctx.fillStyle = "#C2185B"; // armrests
        roundRect(W / 2 - 70, 470, 18, 30, 8); ctx.fill();
        roundRect(W / 2 + 52, 470, 18, 30, 8); ctx.fill();

        // Lulu in the mirror (shows her hair). During reveal, show new color big.
        if (salonPhase >= 1) {
            // Soft round vanity-mirror spotlight behind her so the portrait reads
            // as a framed reflection rather than floating art.
            ctx.save();
            ctx.beginPath(); ctx.arc(W / 2, 240, 108, 0, Math.PI * 2); ctx.clip();
            var glowG = ctx.createRadialGradient(W / 2, 230, 20, W / 2, 240, 110);
            glowG.addColorStop(0, "rgba(255,255,255,0.55)");
            glowG.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = glowG;
            ctx.fillRect(W / 2 - 110, 130, 220, 220);
            ctx.restore();

            ctx.save();
            ctx.translate(W / 2, 252);
            ctx.scale(1.32, 1.32);
            // reuse portrait — hair already reads save.luluHair (committed at reveal)
            drawLuluPortrait(0, 0, gameTime, 1);
            // Salon cape draped over her shoulders, painted OVER the portrait so it
            // tidily hides the portrait's peeking car + tee and frames her face as a
            // salon client. (Her hair/face still show — only the body is covered.)
            ctx.fillStyle = "#37474F";
            ctx.beginPath();
            ctx.moveTo(-48, 40);
            ctx.quadraticCurveTo(0, 30, 48, 40);
            ctx.lineTo(64, 100);
            ctx.quadraticCurveTo(0, 114, -64, 100);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#455A64"; // cape sheen panel
            ctx.beginPath();
            ctx.moveTo(-40, 42); ctx.quadraticCurveTo(0, 34, 40, 42);
            ctx.lineTo(52, 94); ctx.quadraticCurveTo(0, 104, -52, 94);
            ctx.closePath(); ctx.fill();
            // White neck towel trim peeking above the cape collar
            ctx.fillStyle = "#FFFFFF";
            roundRect(-30, 30, 60, 13, 6); ctx.fill();
            ctx.restore();
        }

        // Fabio the stylist (right side)
        drawFabio(410, 360, gameTime);

        // Phase-specific UI
        if (salonPhase === 0) {
            drawSalonBubble("Ah, bonjour! You sit in zee\nchair of GENIUS!");
            drawText("(tap to continue)", W / 2, H - 30, "13px Arial", "#fff", "#000", 2);
        } else if (salonPhase === 1) {
            // Consult dialogue
            drawSalonBubble(SALON_CONSULT[Math.min(salonConsultStep, SALON_CONSULT.length - 1)]);
            drawText("(tap to continue)", W / 2, H - 30, "13px Arial", "#fff", "#000", 2);
        } else if (salonPhase === 2) {
            // Style pick — 3 stacked wide buttons
            drawSalonBubble("And zee SILHOUETTE, darling?");
            for (var s = 0; s < SALON_STYLES.length; s++) {
                var sby = 380 + s * 80;
                drawButton(60, sby, 380, 64, SALON_STYLES[s].label,
                    { bg: "#EC407A", bgDark: "#AD1457", small: true });
            }
        } else if (salonPhase === 3 && !salonConfirm) {
            // Color pick — Fabio reacts to the chosen style. Each swatch shows its
            // name (already) and Fabio flags his blonde "picks" so the best result
            // is telegraphed, not a coin-flip.
            drawSalonBubble(salonStyle ? salonStyle.fabio : "What shall it be, mon chou?");
            for (var i = 0; i < SALON_COLORS.length; i++) {
                var col = i % 2, row = Math.floor(i / 2);
                var bx = 50 + col * 250, by = 360 + row * 100;
                var c = SALON_COLORS[i];
                drawButton(bx, by, 130, 80, c.label, { bg: c.hex, bgDark: shadeColor(c.hex, -50), small: true });
                if (c.blonde) {
                    drawText("✨ Fabio's pick", bx + 65, by + 71,
                        "bold 10px 'Segoe UI', Arial, sans-serif", "#FFD700", "#7A4F00", 2);
                }
            }
            drawText("Every shade is a look — pick what's YOU 💖", W / 2, 340,
                "bold 12px 'Segoe UI', Arial, sans-serif", "#AD1457", "#FFF", 2);
        } else if (salonPhase === 3 && salonConfirm) {
            // Confirm step — telegraph the exact choice before committing.
            var cc = salonPendingColor;
            drawSalonBubble("Go " + cc.label + ", darling?\nA MARVELOUS choice!");
            // Big preview swatch + name
            ctx.fillStyle = cc.hex;
            roundRect(W / 2 - 70, 360, 140, 90, 14); ctx.fill();
            ctx.strokeStyle = shadeColor(cc.hex, -50); ctx.lineWidth = 4;
            roundRect(W / 2 - 70, 360, 140, 90, 14); ctx.stroke();
            drawText(cc.label, W / 2, 405, "bold 20px 'Segoe UI', Arial, sans-serif",
                cc.blonde ? "#6B4423" : "#FFF", "#000", 3);
            if (cc.blonde) {
                drawText("✨ Fabio's pick", W / 2, 433,
                    "bold 12px 'Segoe UI', Arial, sans-serif", "#7A4F00", "#FFF", 2);
            }
            drawButton(60, 470, 170, 56, "YES! GO " + cc.label, { bg: "#66BB6A", bgDark: "#2E7D32", small: true });
            drawButton(250, 470, 170, 56, "← PICK AGAIN", { bg: "#90A4AE", bgDark: "#546E7A", small: true });
        } else if (salonPhase === 4) {
            // Processing: foils + beat-driven ticker + white pulses
            var pulse = Math.abs(Math.sin(salonTimer * 4)) * 0.3;
            ctx.fillStyle = "rgba(255,255,255," + pulse + ")";
            ctx.fillRect(0, 0, W, H);
            // first beat: Fabio's hot take on the chosen color, then the process beats
            var pbeat = Math.min(Math.floor(salonTimer / 1.28), SALON_PROCESS_BEATS.length - 1);
            drawSalonBubble(salonTimer < 1.4 && salonPendingColor
                ? salonPendingColor.fabio : SALON_PROCESS_BEATS[pbeat]);
            // sparkle dust
            if (Math.random() > 0.5) {
                particles.push({ x: W / 2 + rand(-40, 40), y: 250 + rand(-40, 40),
                    vx: rand(-30, 30), vy: rand(-40, -10), life: 0.6, maxLife: 0.6,
                    size: rand(2, 5), color: randPick(["#FFD700", "#FFF", "#F8BBD0"]), gravity: 0 });
            }
            drawParticles();
        } else if (salonPhase === 5) {
            // Reveal reaction — always celebratory now. Tint to the new hair color.
            var glow = salonPendingColor ? salonPendingColor.hex : "#FFEB96";
            ctx.fillStyle = "rgba(255,235,150,0.18)";
            ctx.fillRect(0, 0, W, H);
            // floating celebration confetti in the new color (+hearts)
            if (Math.random() > 0.5) {
                particles.push({ x: rand(0, W), y: H, vx: rand(-20, 20), vy: rand(-90, -50),
                    life: 1.5, maxLife: 1.5, size: rand(4, 8),
                    color: randPick(["#E91E63", glow, "#FFD700"]), gravity: 20 });
            }
            // oops bonus gets a little extra paw-print sparkle burst
            if (salonOops && Math.random() > 0.6) {
                particles.push({ x: W / 2 + rand(-50, 50), y: 230 + rand(-20, 20),
                    vx: rand(-30, 30), vy: rand(-40, -10), life: 0.7, maxLife: 0.7,
                    size: rand(3, 6), color: randPick(["#FFD700", "#FFF"]), gravity: 0 });
            }
            drawParticles();
            drawSalonBubble(salonReaction);
            // Fabio closer — oops bonus gets its own (proud!) confession line
            var salonCloser = salonOops ? "Fabio: zee CAT helped. A BONUS, non?"
                : "Fabio: VOILÀ. Thank ZEE ART, darling.";
            drawText(salonCloser, W / 2, 600, "italic 13px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
            drawButton(W / 2 - 90, H - 80, 180, 50, "TAP TO LEAVE", { bg: "#66BB6A", bgDark: "#2E7D32", small: true });
        }
    }

    function drawSalonBubble(text) {
        ctx.fillStyle = "#FFFFFF";
        roundRect(30, 50, W - 60, 70, 14); ctx.fill();
        ctx.strokeStyle = "#D81B60"; ctx.lineWidth = 3;
        roundRect(30, 50, W - 60, 70, 14); ctx.stroke();
        var lines = text.split("\n");
        for (var li = 0; li < lines.length; li++) {
            drawText(lines[li], W / 2, 76 + li * 22, "bold 16px 'Segoe UI', Arial, sans-serif", "#AD1457", null, 0);
        }
    }

    // ── Main Loop ────────────────────────────────────────────
    var lastTime = 0;
