
    // ══════════════════════════════════════════════════════════
    // ═══════════════ FIRST-DRIVE TUTORIAL ═════════════════════
    // ══════════════════════════════════════════════════════════
    // Six quick steps taught DURING a real run — each advances when the
    // player actually does the thing (or after a generous timeout), so it
    // never feels like homework. Only fires for a genuinely NEW player
    // (no banked high score yet), and the SKIP pill in the corner ends it
    // forever. Draw/update are hooked from the game loop, playing only.
    var tutActive = false;
    var tutStep = 0, tutT = 0, tutDoneFx = 0;
    var tutSteerAcc = 0, tutSpeedHeld = 0, tutLastX = 0, tutCoins0 = 0;

    var TUT_STEPS = [
        { icon: "🕹️", title: "STEER",       a: "Drag anywhere (or ◀ ▶ keys)", b: "to weave through traffic.",          min: 1.2, timeout: 99 },
        { icon: "⏫",  title: "SPEED",       a: "Hold BOOST / BRAKE — bottom left.", b: "Double-tap either to LOCK it.", min: 1.2, timeout: 12, point: "boost" },
        { icon: "🪙",  title: "COINS",       a: "Grab coins — quick pickups", b: "chain into a COMBO multiplier.",      min: 1.2, timeout: 10 },
        { icon: "😤",  title: "CLOSE CALLS", a: "Shave past cars for bonus points —", b: "chains heat your score up to ×3!", min: 1.2, timeout: 10 },
        { icon: "🅿️", title: "PULL OVER",   a: "Slow down in a side lane, then EXIT", b: "to park up and explore on foot.", min: 4.5, timeout: 4.5 },
        { icon: "❤️",  title: "STAY ALIVE",  a: "Hearts are lives — crashes cost one.", b: "Good luck out there, Lulu! 🍀", min: 3.5, timeout: 3.5 }
    ];

    // Called by resetGame at the start of every run; decides for itself.
    function tutMaybeStart() {
        if (save.tutorialDone || save.highScore > 0) { tutActive = false; return; }
        tutActive = true; tutStep = 0; tutT = 0; tutDoneFx = 0;
        tutSteerAcc = 0; tutSpeedHeld = 0; tutLastX = player.x; tutCoins0 = 0;
    }

    function tutSkipRect() { return { x: W - 126, y: SAFE_TOP + 64, w: 112, h: 30 }; }

    function tutFinish(skipped) {
        tutActive = false;
        save.tutorialDone = true; persistSave();
        if (!skipped) {
            spawnFloater(player.x, player.y - 60, "🎉 You're ready!", "#FFD700");
            playTone(523, 0.1, "triangle", 0.14, 784);
        }
    }

    function updateTutorial(dt) {
        if (!tutActive || state !== "playing") return;
        // The SKIP pill peeks at the tap queue and only consumes its own.
        var r = tutSkipRect();
        if (clickQueue && pointInRect(clickQueue.x, clickQueue.y, r.x, r.y - 6, r.w, r.h + 12)) {
            clickQueue = null; playClick(); tutFinish(true); return;
        }
        tutT += dt;
        if (tutDoneFx > 0) tutDoneFx -= dt;
        var done = false;
        if (tutStep === 0) { tutSteerAcc += Math.abs(player.x - tutLastX); tutLastX = player.x; done = tutSteerAcc > 130; }
        else if (tutStep === 1) { if (keys.up || keys.down) tutSpeedHeld += dt; done = tutSpeedHeld > 0.7; }
        else if (tutStep === 2) { done = runCoins > tutCoins0; }
        else if (tutStep === 3) { done = nearChain > 0; }
        // steps 4-5 are info beats: min === timeout → they simply play out.
        var st = TUT_STEPS[tutStep];
        if (tutT >= st.min && (done || tutT >= st.timeout)) {
            tutStep++; tutT = 0; tutDoneFx = 0.5;
            if (tutStep === 2) tutCoins0 = runCoins;   // count only coins grabbed DURING the step
            if (tutStep >= TUT_STEPS.length) { tutFinish(false); return; }
            playTone(660, 0.08, "sine", 0.1, 880);
        }
    }

    function drawTutorial() {
        if (!tutActive || state !== "playing") return;
        var st = TUT_STEPS[tutStep];
        var cardW = W - 56, cardX = 28, cardH = 92;
        // Sits above the bottom control buttons, below the action.
        var cardY = H - 322;
        var popIn = clamp(tutT / 0.25, 0, 1);
        var pop = easeOutBack(popIn);

        ctx.save();
        ctx.translate(W / 2, cardY + cardH / 2);
        ctx.scale(pop, pop);
        ctx.translate(-W / 2, -(cardY + cardH / 2));
        // Panel — shop-style slate with a gold edge; flashes green on advance.
        ctx.fillStyle = "rgba(20,28,36,0.88)";
        roundRect(cardX, cardY, cardW, cardH, 14); ctx.fill();
        ctx.strokeStyle = tutDoneFx > 0 ? "#66BB6A" : "rgba(255,193,7,0.85)";
        ctx.lineWidth = 2.5;
        roundRect(cardX, cardY, cardW, cardH, 14); ctx.stroke();
        // Icon well
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        roundRect(cardX + 10, cardY + 14, 64, 64, 12); ctx.fill();
        drawText(st.icon, cardX + 42, cardY + 47, "34px Arial", "#FFF", null, 0);
        // Title + two text lines
        drawText(st.title, cardX + 86, cardY + 24, "bold 15px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 3, "left");
        drawText(st.a, cardX + 86, cardY + 46, "bold 12.5px 'Segoe UI', Arial, sans-serif", "#ECEFF1", "#000", 2, "left");
        drawText(st.b, cardX + 86, cardY + 64, "bold 12.5px 'Segoe UI', Arial, sans-serif", "#ECEFF1", "#000", 2, "left");
        // Step pips
        for (var i = 0; i < TUT_STEPS.length; i++) {
            ctx.fillStyle = i < tutStep ? "#66BB6A" : (i === tutStep ? "#FFD54F" : "rgba(255,255,255,0.25)");
            ctx.beginPath(); ctx.arc(cardX + 92 + i * 16, cardY + cardH - 12, 4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        // Pointer arrow at the boost/brake cluster during the SPEED step.
        if (st.point === "boost" && typeof MOBILE_BOOST_RECT !== "undefined" && MOBILE_BOOST_RECT) {
            var bob2 = Math.sin(gameTime * 6) * 6;
            drawText("👇", MOBILE_BOOST_RECT.x + MOBILE_BOOST_RECT.w / 2,
                MOBILE_BOOST_RECT.y - 26 + bob2, "26px Arial", "#FFF", null, 0);
        }

        // SKIP pill — always visible while the tutorial runs.
        var r = tutSkipRect();
        ctx.fillStyle = "rgba(20,28,36,0.82)";
        roundRect(r.x, r.y, r.w, r.h, 15); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.5;
        roundRect(r.x, r.y, r.w, r.h, 15); ctx.stroke();
        drawText("Skip tutorial ✕", r.x + r.w / 2, r.y + r.h / 2 + 1,
            "bold 11px 'Segoe UI', Arial, sans-serif", "#ECEFF1", "#000", 2);
    }
