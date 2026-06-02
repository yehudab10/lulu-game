    function enterDinaHome() {
        save.totalCoins += dinaCoinsRun;
        persistSave();
        state = "dinaHome";
        dinaHome = { x: 240, y: 600, walkTime: 0, facing: "down", hover: null };
        homeMessageTimer = 0;
        dinaRunTimer = 0; // reset for star pulse / nap / morgan timers
    }

    // ── Update / Draw: Dina Home Interior ────────────────────
    // Bedroom items — no overlapping rects. Door on left wall, bed bottom-right.
    // ORDER MATTERS — items checked top-to-bottom. tablet must be before bed.
    var HOME_OBJECTS = {
        tablet:  { x: 230, y: 510, w: 60, h: 44,  label: "Play Lulu's game?",   action: "tablet" },
        morgan:  { x: 30,  y: 540, w: 64, h: 70,  label: "Play with Morgan?",   action: "morgan" },
        snacks:  { x: 130, y: 510, w: 60, h: 50,  label: "Cookie & milk!",      action: "snack" },
        sticker: { x: 320, y: 510, w: 70, h: 60,  label: "Sticker book?",       action: "stickers" },
        bed:     { x: 280, y: 320, w: 180, h: 160, label: "Take a nap?",        action: "nap" },
        door:    { x: 8,   y: 90,  w: 70, h: 130, label: "Go back outside?",    action: "outside" }
    };

    function updateDinaHome(dt) {
        if (!dinaHome) dinaHome = { x: 240, y: 600, walkTime: 0, facing: "down" };
        var speed = 100;
        var dx = 0, dy = 0;
        if (keys.left) dx -= 1;
        if (keys.right) dx += 1;
        if (keys.up) dy -= 1;
        if (keys.down) dy += 1;
        // Touch: drag anywhere and Dina walks toward your finger (no D-pad).
        if (touchX !== null && touchY !== null) {
            var fdx = touchX - dinaHome.x, fdy = touchY - dinaHome.y;
            if (Math.sqrt(fdx * fdx + fdy * fdy) > 8) { dx = fdx; dy = fdy; }
        }
        if (dx || dy) {
            var len = Math.sqrt(dx * dx + dy * dy);
            dx /= len; dy /= len;
            dinaHome.x = clamp(dinaHome.x + dx * speed * dt, 30, W - 30);
            dinaHome.y = clamp(dinaHome.y + dy * speed * dt, 250, H - 30);
            dinaHome.walkTime += dt;
            dinaHome.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
        }

        // Check overlap with interactive objects
        var closest = null, closestDist = 999999;
        for (var k in HOME_OBJECTS) {
            var o = HOME_OBJECTS[k];
            var ox = o.x + o.w / 2;
            var oy = o.y + o.h / 2;
            var dd = (dinaHome.x - ox) * (dinaHome.x - ox) + (dinaHome.y - oy) * (dinaHome.y - oy);
            if (dd < (o.w / 2 + 30) * (o.w / 2 + 30) && dd < closestDist) {
                closestDist = dd;
                closest = o;
            }
        }
        dinaHome.hover = closest;

        // Keyboard Space/Enter activates the nearest object (desktop affordance).
        // Touch deliberately does NOT proximity-activate — otherwise simply
        // starting a drag near the bed would fire the nap. Touch uses the
        // precise tap-on-object check below instead.
        if (closest && !isTouchDevice && (consumeAction() || consumeHomeInteract())) {
            triggerHomeInteract(closest.action);
        }
        // Tap on object directly
        var click = consumeClick();
        if (click) {
            for (var k2 in HOME_OBJECTS) {
                var o2 = HOME_OBJECTS[k2];
                if (pointInRect(click.x, click.y, o2.x, o2.y, o2.w, o2.h)) {
                    // clear the queued action from this same tap so it doesn't
                    // leak into (and instantly re-trigger something in) the next scene
                    consumeAction();
                    triggerHomeInteract(o2.action);
                    return;
                }
            }
        }

        if (homeMessageTimer > 0) homeMessageTimer -= dt;
    }

    var lastHomeInteractKey = false;
    function consumeHomeInteract() {
        // Space on keyboard is consumed by consumeAction already
        return false;
    }

    function triggerHomeInteract(action) {
        if (action === "morgan") {
            state = "dinaMorgan";
            morganHappy = 0;
            morganPetSpot = null;
            morganTimer = 0;
            morganMood = "calm";
            morganCelebrateT = 0;
            morganStarAwarded = false;
            playTone(600, 0.1, "triangle", 0.2);
        } else if (action === "tablet") {
            inTabletMode = true;
            resetGame();
            state = "playing";
            playTone(880, 0.08, "sine", 0.18);
        } else if (action === "nap") {
            state = "dinaNap";
            dinaRunTimer = 0;
        } else if (action === "snack") {
            // Cookie & milk now opens the Cookie Catch minigame (costs coins to play).
            if (save.totalCoins < COOKIE_FEE) {
                homeMessage = "Need 💰" + COOKIE_FEE + " to play Cookie Catch";
                homeMessageTimer = 1.8;
                playDeny();
            } else {
                startCookieCatch();
            }
        } else if (action === "stickers") {
            // Open the interactive sticker book minigame
            startStickerBook();
        } else if (action === "outside") {
            state = "charSelect";
            inTabletMode = false;
        }
    }

    function drawDinaHome() {
        // Wall (cream)
        ctx.fillStyle = "#FFE8C8";
        ctx.fillRect(0, 0, W, 280);
        // Wallpaper polka-dot pattern (subtle pink)
        ctx.fillStyle = "rgba(255,180,200,0.28)";
        for (var wy = 20; wy < 260; wy += 40) {
            for (var wx = (wy % 80 === 0 ? 20 : 50); wx < W; wx += 60) {
                ctx.beginPath(); ctx.arc(wx, wy, 4, 0, Math.PI * 2); ctx.fill();
            }
        }
        // Baseboard (white strip with dark line)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 268, W, 12);
        ctx.fillStyle = "#1A1A1A";
        ctx.fillRect(0, 280, W, 2);
        // Floor (honey wood) — start below baseboard
        ctx.fillStyle = "#E8B872";
        ctx.fillRect(0, 282, W, H - 282);
        // Wood grain lines (batched single path)
        ctx.strokeStyle = "#C99A50";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var fy = 300; fy < H; fy += 30) {
            ctx.moveTo(0, fy); ctx.lineTo(W, fy);
        }
        ctx.stroke();

        // Window with sky + curtains
        ctx.fillStyle = "#A8D8F0";
        roundRect(60, 70, 120, 130, 6); ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 5;
        roundRect(60, 70, 120, 130, 6); ctx.stroke();
        // Window cross
        ctx.beginPath();
        ctx.moveTo(120, 70); ctx.lineTo(120, 200);
        ctx.moveTo(60, 135); ctx.lineTo(180, 135);
        ctx.stroke();
        // Sun in window
        ctx.fillStyle = "#FFD54F";
        ctx.beginPath(); ctx.arc(95, 100, 16, 0, Math.PI * 2); ctx.fill();
        // Curtains
        ctx.fillStyle = "#B8E0D2";
        roundRect(40, 60, 22, 150, 4); ctx.fill();
        roundRect(180, 60, 22, 150, 4); ctx.fill();
        // Sunbeam on floor
        ctx.fillStyle = "rgba(255,235,150,0.4)";
        ctx.beginPath();
        ctx.moveTo(60, 280); ctx.lineTo(180, 280); ctx.lineTo(200, 500); ctx.lineTo(40, 500);
        ctx.closePath(); ctx.fill();

        // Poster (BE BRAVE)
        ctx.fillStyle = "#FFFFFF";
        roundRect(220, 50, 80, 100, 4); ctx.fill();
        ctx.strokeStyle = "#5D4037";
        ctx.lineWidth = 3;
        roundRect(220, 50, 80, 100, 4); ctx.stroke();
        // Fox icon
        ctx.fillStyle = "#FF7043";
        ctx.beginPath(); ctx.arc(260, 95, 20, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(245, 78); ctx.lineTo(252, 70); ctx.lineTo(258, 80); ctx.closePath();
        ctx.moveTo(275, 78); ctx.lineTo(268, 70); ctx.lineTo(262, 80); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(254, 92, 2, 0, Math.PI * 2);
        ctx.arc(266, 92, 2, 0, Math.PI * 2);
        ctx.fill();
        drawText("BE BRAVE", 260, 130, "bold 11px Arial", "#5D4037", null, 0);

        // Glow-in-dark stars on ceiling
        var pulseTime = (dinaHome ? dinaHome.walkTime : 0) + dinaRunTimer;
        ctx.fillStyle = "#FFEE58";
        var stars = [[15, 20], [320, 30], [430, 25], [40, 250], [400, 245]];
        for (var st = 0; st < stars.length; st++) {
            var op = 0.5 + 0.5 * Math.sin(pulseTime * 2 + st);
            ctx.globalAlpha = op;
            drawText("★", stars[st][0], stars[st][1], "bold 14px Arial", "#FFEE58", null, 0);
        }
        ctx.globalAlpha = 1;

        // ─── DOOR on left wall (upper area) ───
        var dr = HOME_OBJECTS.door;
        // Doorway frame (darker recess in wall)
        ctx.fillStyle = "#8D6E63";
        roundRect(dr.x - 4, dr.y - 4, dr.w + 8, dr.h + 8, 6); ctx.fill();
        // Door
        ctx.fillStyle = "#FFFFFF";
        roundRect(dr.x, dr.y, dr.w, dr.h, 4); ctx.fill();
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 3;
        roundRect(dr.x, dr.y, dr.w, dr.h, 4); ctx.stroke();
        // Door panels
        ctx.strokeStyle = "#BDBDBD";
        ctx.lineWidth = 1.5;
        roundRect(dr.x + 6, dr.y + 10, dr.w - 12, 50, 3); ctx.stroke();
        roundRect(dr.x + 6, dr.y + 70, dr.w - 12, 50, 3); ctx.stroke();
        // Pink doorknob
        ctx.fillStyle = "#FF4FA3";
        ctx.beginPath(); ctx.arc(dr.x + dr.w - 12, dr.y + dr.h / 2, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
        // "Dina's Room" sign above door
        ctx.fillStyle = "#FFD54F";
        roundRect(dr.x - 4, dr.y - 24, dr.w + 8, 18, 4); ctx.fill();
        ctx.strokeStyle = "#5D4037"; ctx.lineWidth = 2;
        roundRect(dr.x - 4, dr.y - 24, dr.w + 8, 18, 4); ctx.stroke();
        drawText("DINA'S ROOM", dr.x + dr.w / 2, dr.y - 15, "bold 10px Arial", "#5D4037", null, 0);

        // ─── CRAYON DRAWING on wall (next to door, safely away from bed) ───
        ctx.fillStyle = "#FFF59D";
        roundRect(95, 100, 60, 60, 2); ctx.fill();
        ctx.strokeStyle = "#5D4037";
        ctx.lineWidth = 1.5;
        roundRect(95, 100, 60, 60, 2); ctx.stroke();
        // tape strip
        ctx.fillStyle = "rgba(255,200,150,0.6)";
        roundRect(110, 94, 30, 8, 1); ctx.fill();
        // Stick figures (mom + dina holding hands)
        ctx.strokeStyle = "#F44336"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(112, 122, 3, 0, Math.PI * 2);
        ctx.moveTo(112, 125); ctx.lineTo(112, 138);
        ctx.moveTo(108, 130); ctx.lineTo(125, 130); // arm reaching to Dina
        ctx.moveTo(112, 138); ctx.lineTo(108, 148);
        ctx.moveTo(112, 138); ctx.lineTo(116, 148);
        ctx.stroke();
        ctx.strokeStyle = "#3F51B5"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(135, 127, 3, 0, Math.PI * 2);
        ctx.moveTo(135, 130); ctx.lineTo(135, 142);
        ctx.moveTo(125, 134); ctx.lineTo(140, 134);
        ctx.moveTo(135, 142); ctx.lineTo(131, 150);
        ctx.moveTo(135, 142); ctx.lineTo(139, 150);
        ctx.stroke();
        ctx.fillStyle = "#F44336";
        drawText("♥", 123, 119, "bold 10px Arial", "#F44336", null, 0);

        // ─── BED (right side, big & cozy) ───
        var b = HOME_OBJECTS.bed;
        // Bed frame outline
        ctx.fillStyle = "#5D4037";
        roundRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8, 10); ctx.fill();
        // Mattress pink quilt
        ctx.fillStyle = "#F4A4B8";
        roundRect(b.x, b.y, b.w, b.h, 8); ctx.fill();
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 2.5;
        roundRect(b.x, b.y, b.w, b.h, 8); ctx.stroke();
        // Quilt patches (batched)
        ctx.strokeStyle = "#E091A6";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (var qx = b.x + 30; qx < b.x + b.w; qx += 40) {
            ctx.moveTo(qx, b.y + 6); ctx.lineTo(qx, b.y + b.h - 6);
        }
        for (var qy = b.y + 40; qy < b.y + b.h - 6; qy += 40) {
            ctx.moveTo(b.x + 6, qy); ctx.lineTo(b.x + b.w - 6, qy);
        }
        ctx.stroke();
        // Pillow
        ctx.fillStyle = "#FFFFFF";
        roundRect(b.x + 12, b.y + 12, b.w - 24, 38, 8); ctx.fill();
        ctx.strokeStyle = "#BDBDBD";
        ctx.lineWidth = 1.5;
        roundRect(b.x + 12, b.y + 12, b.w - 24, 38, 8); ctx.stroke();
        // Mint blanket folded at foot
        ctx.fillStyle = "#B8E0D2";
        roundRect(b.x + 4, b.y + b.h - 32, b.w - 8, 28, 6); ctx.fill();
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 2;
        roundRect(b.x + 4, b.y + b.h - 32, b.w - 8, 28, 6); ctx.stroke();
        // Little teddy on pillow
        ctx.fillStyle = "#A1887F";
        ctx.beginPath(); ctx.arc(b.x + 28, b.y + 28, 8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(b.x + 22, b.y + 22, 3, 0, Math.PI * 2);
        ctx.arc(b.x + 34, b.y + 22, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(b.x + 25, b.y + 27, 0.8, 0, Math.PI * 2);
        ctx.arc(b.x + 31, b.y + 27, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // ─── RUG (lower-center, big) ───
        ctx.fillStyle = "#FFE8C8";
        ctx.beginPath();
        ctx.ellipse(W / 2, H * 0.84, 200, 60, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#B8E0D2";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(W / 2, H * 0.84, 180, 50, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#F4A4B8";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(W / 2, H * 0.84, 150, 38, 0, 0, Math.PI * 2);
        ctx.stroke();

        // ─── MORGAN PLUSHIE (bottom-left, on floor) ───
        var mo = HOME_OBJECTS.morgan;
        ctx.save();
        ctx.translate(mo.x + 32, mo.y + 38);
        ctx.scale(0.7, 0.7);
        // Outline
        ctx.fillStyle = "#5D4350";
        ctx.beginPath(); ctx.ellipse(0, 14, 36, 30, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -16, 26, 0, Math.PI * 2); ctx.fill();
        // Body
        ctx.fillStyle = "#9B8FB4";
        ctx.beginPath(); ctx.ellipse(0, 14, 32, 26, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -16, 22, 0, Math.PI * 2); ctx.fill();
        // Ears
        ctx.beginPath();
        ctx.moveTo(-20, -28); ctx.lineTo(-10, -42); ctx.lineTo(-2, -30); ctx.closePath();
        ctx.moveTo(2, -30); ctx.lineTo(10, -42); ctx.lineTo(20, -28); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FFB8D9";
        ctx.beginPath();
        ctx.moveTo(-15, -32); ctx.lineTo(-10, -38); ctx.lineTo(-5, -31); ctx.closePath();
        ctx.moveTo(5, -31); ctx.lineTo(10, -38); ctx.lineTo(15, -32); ctx.closePath();
        ctx.fill();
        // Eyes (closed happy arcs)
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(-8, -15, 4, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.arc(8, -15, 4, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.stroke();
        ctx.lineCap = "butt";
        // Nose + mouth
        ctx.fillStyle = "#FF8AAA";
        ctx.beginPath();
        ctx.moveTo(-3, -8); ctx.lineTo(3, -8); ctx.lineTo(0, -5); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -5); ctx.quadraticCurveTo(-2, -3, -4, -4);
        ctx.moveTo(0, -5); ctx.quadraticCurveTo(2, -3, 4, -4);
        ctx.stroke();
        // Heart on chest
        ctx.fillStyle = "#FF6B9D";
        ctx.beginPath(); ctx.arc(-3, 12, 3, 0, Math.PI * 2);
        ctx.arc(3, 12, 3, 0, Math.PI * 2);
        ctx.moveTo(-5, 12); ctx.lineTo(0, 20); ctx.lineTo(5, 12);
        ctx.fill();
        ctx.restore();

        // ─── COOKIE + MILK on a small side table ───
        var sn = HOME_OBJECTS.snacks;
        // Table top
        ctx.fillStyle = "#A1887F";
        roundRect(sn.x - 4, sn.y + 32, sn.w + 8, 18, 4); ctx.fill();
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 2;
        roundRect(sn.x - 4, sn.y + 32, sn.w + 8, 18, 4); ctx.stroke();
        // Table legs
        ctx.fillStyle = "#8D6E63";
        ctx.fillRect(sn.x, sn.y + 50, 4, 16);
        ctx.fillRect(sn.x + sn.w - 4, sn.y + 50, 4, 16);
        // Cookie
        ctx.fillStyle = "#FFA726";
        ctx.beginPath(); ctx.arc(sn.x + 18, sn.y + 28, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 2;
        ctx.stroke();
        // Chocolate chips
        ctx.fillStyle = "#3E2723";
        ctx.beginPath();
        ctx.arc(sn.x + 14, sn.y + 24, 1.5, 0, Math.PI * 2);
        ctx.arc(sn.x + 21, sn.y + 27, 1.5, 0, Math.PI * 2);
        ctx.arc(sn.x + 16, sn.y + 31, 1.5, 0, Math.PI * 2);
        ctx.arc(sn.x + 22, sn.y + 33, 1.5, 0, Math.PI * 2);
        ctx.fill();
        // Milk glass
        ctx.fillStyle = "#FAFAFA";
        roundRect(sn.x + 36, sn.y + 18, 16, 28, 3); ctx.fill();
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 2;
        roundRect(sn.x + 36, sn.y + 18, 16, 28, 3); ctx.stroke();
        // Milk surface
        ctx.fillStyle = "#E3F2FD";
        roundRect(sn.x + 38, sn.y + 22, 12, 4, 1); ctx.fill();

        // ─── TABLET (free-standing, no longer on bed) ───
        var tb = HOME_OBJECTS.tablet;
        ctx.fillStyle = "#212121";
        roundRect(tb.x - 2, tb.y - 2, tb.w + 4, tb.h + 4, 5); ctx.fill();
        ctx.fillStyle = "#37474F";
        roundRect(tb.x, tb.y, tb.w, tb.h, 4); ctx.fill();
        // Screen with mini Lulu game preview
        ctx.fillStyle = "#7CCB7E"; // green road
        roundRect(tb.x + 4, tb.y + 4, tb.w - 8, tb.h - 8, 3); ctx.fill();
        ctx.fillStyle = "#6B7B8D"; // road strip
        ctx.fillRect(tb.x + 18, tb.y + 6, 24, tb.h - 12);
        ctx.fillStyle = "#E91E63"; // tiny Lulu car
        roundRect(tb.x + 24, tb.y + tb.h - 18, 12, 12, 2); ctx.fill();
        // Tablet stand
        ctx.fillStyle = "#5D4037";
        roundRect(tb.x + tb.w / 2 - 12, tb.y + tb.h, 24, 4, 2); ctx.fill();
        // "LULU" label below
        drawText("Lulu game", tb.x + tb.w / 2, tb.y + tb.h + 14, "bold 10px Arial", "#FFD700", "#000", 2);

        // ─── STICKER BOOK (bottom-right) ───
        var sb = HOME_OBJECTS.sticker;
        ctx.fillStyle = "#1A1A1A";
        roundRect(sb.x - 2, sb.y - 2, sb.w + 4, sb.h + 4, 4); ctx.fill();
        ctx.fillStyle = "#FFC107";
        roundRect(sb.x, sb.y, sb.w, sb.h, 3); ctx.fill();
        ctx.fillStyle = "#FF9800";
        roundRect(sb.x + 4, sb.y + 4, sb.w - 8, 14, 2); ctx.fill();
        drawText("STICKERS", sb.x + sb.w / 2, sb.y + 11, "bold 9px Arial", "#FFF", null, 0);
        // Cute stickers visible
        ctx.fillStyle = "#FF80AB";
        ctx.beginPath(); ctx.arc(sb.x + 14, sb.y + 30, 5, 0, Math.PI * 2); ctx.fill();
        drawText("♥", sb.x + 14, sb.y + 32, "bold 7px Arial", "#FFF", null, 0);
        ctx.fillStyle = "#81C784";
        ctx.beginPath(); ctx.arc(sb.x + 30, sb.y + 35, 5, 0, Math.PI * 2); ctx.fill();
        drawText("★", sb.x + 30, sb.y + 37, "bold 7px Arial", "#FFF", null, 0);
        ctx.fillStyle = "#64B5F6";
        ctx.beginPath(); ctx.arc(sb.x + 50, sb.y + 28, 5, 0, Math.PI * 2); ctx.fill();
        drawText("☺", sb.x + 50, sb.y + 30, "bold 7px Arial", "#FFF", null, 0);

        // ─── DINA herself ───
        drawDinaTopDown(dinaHome.x, dinaHome.y, dinaHome.walkTime, dinaHome.facing, "morgan");

        // ─── Hover label for interactive objects ───
        if (dinaHome.hover) {
            var o = dinaHome.hover;
            var lx = o.x + o.w / 2;
            var ly = o.y - 18;
            drawSpeechBubble(lx, ly, o.label, dinaHome.walkTime);
            drawText("[TAP]", lx, ly + 16, "bold 11px Arial", "#FFD700", "#000", 2);
        }

        // ─── Home message banner ───
        if (homeMessageTimer > 0) {
            var alpHM = clamp(homeMessageTimer / 1.5, 0, 1);
            ctx.fillStyle = "rgba(0,0,0," + (0.7 * alpHM) + ")";
            roundRect(W / 2 - 140, 50, 280, 36, 10); ctx.fill();
            ctx.globalAlpha = alpHM;
            drawText(homeMessage, W / 2, 68, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3);
            ctx.globalAlpha = 1;
        }

        // ─── HUD top bar ───
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(0, 0, W, 40, 0); ctx.fill();
        drawText("🏠 Dina's Bedroom", W / 2, 20,
            "bold 13px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#000", 3);
        drawText("⭐ " + (save.parkingTotalStars || 0) + "  💰 " + formatNum(save.totalCoins), 12, 20,
            "bold 12px Arial", "#FFD700", "#000", 2, "left");
        drawText("Mom: kitchen", W - 12, 20, "bold 11px Arial", "#B8E0D2", "#000", 2, "right");

        // ─── Footer hint ───
        drawText(isTouchDevice ? "Drag to walk · tap an item to interact"
                               : "Arrow keys to walk · click an item to interact",
            W / 2, H - 110, "11px Arial", "#FFFFFF", "#000", 2);
    }

    // ── Update / Draw: Morgan Cat Plushie ────────────────────
    var morganSparkles = [];
    var morganCelebrateT = 0;        // time since hitting 100%, drives auto-exit
    var morganStarAwarded = false;   // guards against farming the star by re-petting
    function updateDinaMorgan(dt) {
        morganTimer += dt;
        // Move pet spot occasionally (chin not reachable; removed per QA)
        if (!morganPetSpot || morganPetSpot.t <= 0) {
            var zones = ["head", "back", "belly"];
            var z = randPick(zones);
            morganPetSpot = { zone: z, t: 4 };
        }
        morganPetSpot.t -= dt;

        var click = consumeClick();
        if (click) {
            // Check exit button — generous hitbox covering button + "BACK" label below
            if (pointInRect(click.x, click.y, 10, 70, 80, 80)) {
                state = "dinaHome";
                // clear any leftover queued tap/action so we don't instantly
                // re-trigger Morgan (Dina is still standing on the plushie)
                consumeAction();
                clickQueue = null;
                playClick();
                return;
            }
            // Detect zone clicked
            var dx = click.x - 240;
            var dy = click.y - 480;
            // Head area (y < -50 relative)
            var hit = null;
            if (dy < -50 && Math.abs(dx) < 80) hit = "head";
            else if (dy >= -50 && dy < 50 && Math.abs(dx) < 90) hit = "back";
            else if (dy >= 50 && dy < 140 && Math.abs(dx) < 90) hit = "belly";
            if (hit) {
                var gain = (hit === "belly") ? 15 : (hit === morganPetSpot.zone ? 10 : 5);
                morganHappy = Math.min(100, morganHappy + gain);
                spawnMorganHearts(click.x, click.y, hit === "belly" ? 8 : 3);
                playTone(hit === "belly" ? 700 : 1000, 0.08, "sine", 0.16);
                morganMood = "happy";
                setTimeout(function () { if (morganMood === "happy") morganMood = "calm"; }, 700);
            }
        }
        // Update hearts
        for (var hh = morganHearts.length - 1; hh >= 0; hh--) {
            var heart = morganHearts[hh];
            heart.life -= dt;
            heart.y -= 40 * dt;
            heart.x += Math.sin(heart.life * 4) * 0.5;
            if (heart.life <= 0) morganHearts.splice(hh, 1);
        }
        // 100% celebration — award the star only ONCE per visit (no farming by
        // re-petting), then auto-return home so there's a clean finish.
        if (morganHappy >= 100 && morganMood !== "celebrate") {
            morganMood = "celebrate";
            morganCelebrateT = 0;
            if (!morganStarAwarded) {
                morganStarAwarded = true;
                save.parkingTotalStars += 1;
                persistSave();
            }
            playTone(523, 0.1, "triangle", 0.2);
            setTimeout(function () { playTone(659, 0.1, "triangle", 0.2); }, 100);
            setTimeout(function () { playTone(784, 0.12, "triangle", 0.22); }, 200);
            setTimeout(function () { playTone(1046, 0.18, "triangle", 0.22); }, 300);
        }
        if (morganMood === "celebrate") {
            morganCelebrateT += dt;
            // Let the player soak the moment, then drift back to the bedroom.
            if (morganCelebrateT > 2.8) { state = "dinaHome"; consumeAction(); clickQueue = null; }
        }
    }

    function spawnMorganHearts(x, y, n) {
        for (var i = 0; i < n; i++) {
            morganHearts.push({
                x: x + rand(-15, 15), y: y,
                life: 1.2,
                color: randPick(["#FF6B9D", "#FF80AB", "#E91E63"])
            });
        }
    }

    function drawDinaMorgan() {
        // Cozy background
        ctx.fillStyle = "#FFF4E0";
        ctx.fillRect(0, 0, W, H);
        // Soft pink blanket
        ctx.fillStyle = "#FFD4E5";
        ctx.fillRect(0, H * 0.55, W, H * 0.45);
        ctx.fillStyle = "#F5A8C8";
        for (var f = 0; f < W; f += 60) {
            ctx.beginPath();
            ctx.ellipse(f, H * 0.55, 30, 10, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Happiness bar at top
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        roundRect(0, 0, W, 60, 0); ctx.fill();
        ctx.fillStyle = "#E8D4F0";
        roundRect(40, 22, W - 80, 22, 11); ctx.fill();
        ctx.fillStyle = "#FF8FB8";
        roundRect(42, 24, (W - 84) * (morganHappy / 100), 18, 9); ctx.fill();
        drawText("♥ " + Math.floor(morganHappy) + "%", W / 2, 33,
            "bold 13px Arial", "#FFFFFF", "#000", 3);
        drawText("Morgan's Happiness", W / 2, 12, "bold 10px Arial", "#FFD700", "#000", 2);

        // Back button (matches click hitbox)
        drawIconButton(20, 80, 48, "◀", { bg: "#A8E6CF", bgDark: "#388E3C" });
        drawText("BACK", 44, 138, "bold 11px Arial", "#FFFFFF", "#000", 2);

        // Morgan plushie (BIG)
        ctx.save();
        ctx.translate(240, 480);
        var bounce = morganMood === "happy" ? Math.sin(morganTimer * 30) * 2 : 0;
        var celebrate = morganMood === "celebrate";
        if (celebrate) bounce += Math.abs(Math.sin(morganTimer * 8)) * -10;
        ctx.translate(0, bounce);
        // Body
        ctx.fillStyle = "#9B8FB4";
        ctx.beginPath();
        ctx.ellipse(0, 40, 90, 100, 0, 0, Math.PI * 2);
        ctx.fill();
        // Belly
        ctx.fillStyle = "#D4C9E8";
        ctx.beginPath();
        ctx.ellipse(0, 80, 60, 50, 0, 0, Math.PI * 2);
        ctx.fill();
        // Stitching
        ctx.strokeStyle = "#7A6FA0";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, 30); ctx.lineTo(0, 140);
        ctx.stroke();
        ctx.setLineDash([]);
        // Paws
        ctx.fillStyle = "#9B8FB4";
        ctx.beginPath(); ctx.ellipse(-35, 120, 25, 18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(35, 120, 25, 18, 0, 0, Math.PI * 2); ctx.fill();
        // Tail (wrapping right)
        ctx.beginPath();
        ctx.ellipse(85, 80, 15, 35, -0.4, 0, Math.PI * 2);
        ctx.fill();
        // Head
        ctx.fillStyle = "#9B8FB4";
        ctx.beginPath(); ctx.arc(0, -60, 80, 0, Math.PI * 2); ctx.fill();
        // Ears
        ctx.beginPath();
        ctx.moveTo(-60, -100); ctx.lineTo(-40, -150); ctx.lineTo(-15, -100);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(15, -100); ctx.lineTo(40, -150); ctx.lineTo(60, -100);
        ctx.closePath(); ctx.fill();
        // Inner ears
        ctx.fillStyle = "#FFB8D9";
        ctx.beginPath();
        ctx.moveTo(-50, -110); ctx.lineTo(-40, -135); ctx.lineTo(-25, -105);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(25, -105); ctx.lineTo(40, -135); ctx.lineTo(50, -110);
        ctx.closePath(); ctx.fill();
        // Cheeks
        ctx.fillStyle = "#FFAACC";
        ctx.beginPath(); ctx.arc(-50, -40, 14, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(50, -40, 14, 0, Math.PI * 2); ctx.fill();

        // Eyes (based on mood)
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        if (morganMood === "happy" || celebrate) {
            ctx.beginPath();
            ctx.arc(-28, -60, 12, 1.1 * Math.PI, 1.9 * Math.PI);
            ctx.arc(28, -60, 12, 1.1 * Math.PI, 1.9 * Math.PI);
            ctx.stroke();
        } else {
            ctx.fillStyle = "#2A2438";
            ctx.beginPath();
            ctx.ellipse(-28, -60, 8, 11, 0, 0, Math.PI * 2);
            ctx.ellipse(28, -60, 8, 11, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(-26, -64, 3, 0, Math.PI * 2);
            ctx.arc(30, -64, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.lineCap = "butt";

        // Nose
        ctx.fillStyle = "#E88AAA";
        ctx.beginPath();
        ctx.moveTo(-6, -30); ctx.lineTo(6, -30); ctx.lineTo(0, -24);
        ctx.closePath(); ctx.fill();
        // Mouth
        ctx.strokeStyle = "#A0394D";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.quadraticCurveTo(-4, -20, -6, -22);
        ctx.moveTo(0, -24);
        ctx.quadraticCurveTo(4, -20, 6, -22);
        ctx.stroke();

        // Highlight on pet spot + a clear "Pet here!" label so the rotating
        // sweet-spot mechanic is obvious instead of trial-and-error.
        if (morganPetSpot && morganMood === "calm") {
            var pulse = 0.5 + 0.3 * Math.sin(morganTimer * 5);
            ctx.strokeStyle = "rgba(255, 215, 0, " + pulse + ")";
            ctx.lineWidth = 3;
            var psx = 0, psy = 0;
            if (morganPetSpot.zone === "head") { psx = 0; psy = -60; }
            else if (morganPetSpot.zone === "back") { psx = -20; psy = 0; }
            else if (morganPetSpot.zone === "chin") { psx = 0; psy = -10; }
            else if (morganPetSpot.zone === "belly") { psx = 0; psy = 70; }
            var ringR = 25 + 3 * Math.sin(morganTimer * 5);
            ctx.beginPath();
            ctx.arc(psx, psy, ringR, 0, Math.PI * 2);
            ctx.stroke();
            // pointing label
            drawText("👆 Pet here!", psx, psy - ringR - 12,
                "bold 13px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#5D4037", 3);
        }
        ctx.restore();

        // Floating hearts
        for (var h = 0; h < morganHearts.length; h++) {
            var heart = morganHearts[h];
            ctx.save();
            ctx.globalAlpha = clamp(heart.life / 1.2, 0, 1);
            ctx.fillStyle = heart.color;
            ctx.font = "bold 20px Arial";
            ctx.textAlign = "center";
            ctx.fillText("♥", heart.x, heart.y);
            ctx.restore();
        }

        // Dina's hand peeking from bottom-right
        ctx.save();
        ctx.translate(W - 60, H - 50);
        ctx.fillStyle = "#A8E6CF";
        roundRect(-30, 0, 60, 80, 8); ctx.fill();
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(0, -10, 16, 0, Math.PI * 2); ctx.fill();
        // Fingers
        for (var ff = 0; ff < 4; ff++) {
            ctx.beginPath();
            ctx.arc(-10 + ff * 6, -22, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Celebrate big-burst stars
        if (morganMood === "celebrate") {
            ctx.fillStyle = "rgba(255, 235, 0, 0.15)";
            ctx.fillRect(0, 0, W, H);
            drawText(morganStarAwarded ? "⭐ +1 STAR! ⭐" : "💜 Morgan's so happy! 💜", W / 2, H / 2 - 100,
                "bold 26px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 6);
            drawText("Morgan loves you, Dina!", W / 2, H / 2 - 64,
                "bold 14px Arial", "#FFFFFF", "#000", 3);
            if (Math.random() > 0.4) {
                morganHearts.push({
                    x: rand(0, W), y: H + 20,
                    life: 2,
                    color: randPick(["#FFD700", "#FFEB3B", "#FF6B9D"])
                });
                morganHearts[morganHearts.length - 1].y = H;
            }
        }

        // Footer hint
        drawText("Tap anywhere on Morgan to pet, scratch, or hug", W / 2, H - 14,
            "12px Arial", "#FFFFFF", "#000", 2);
    }

    // ── Update / Draw: Dina Nap ──────────────────────────────