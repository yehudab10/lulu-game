    // ── Minigame: Sticker Book ───────────────────────────────
    // Dina spends the ⭐ stars she's earned to buy stickers and decorate a
    // scrapbook page. Placements persist in save.stickerBook so the book is
    // hers to keep. This gives earned stars a real purpose (a spend sink).
    var sticker = null; // { held, msg, msgT, sparkle[] }

    // Sticker catalog: emoji + star cost. Cheap-and-cheerful so kids can fill a page.
    var STICKER_KINDS = [
        { e: "⭐", cost: 1 }, { e: "💖", cost: 1 }, { e: "🌈", cost: 2 },
        { e: "🦄", cost: 3 }, { e: "🌸", cost: 1 }, { e: "🐱", cost: 2 },
        { e: "🍦", cost: 2 }, { e: "🎀", cost: 1 }, { e: "🦋", cost: 2 },
        { e: "🍓", cost: 1 }, { e: "🌟", cost: 1 }, { e: "🐶", cost: 2 }
    ];
    var STICKER_PAGE = { x: 40, y: 110, w: W - 80, h: 380 }; // the scrapbook page rect

    function startStickerBook() {
        state = "stickerBook";
        if (!save.stickerBook) save.stickerBook = [];
        sticker = { held: null, msg: "Tap a sticker, then tap the page!", msgT: 3, sparkle: [] };
        playTone(880, 0.08, "triangle", 0.15);
        setTimeout(function () { playTone(1100, 0.1, "triangle", 0.15); }, 80);
    }

    function stickerSparkle(x, y) {
        for (var i = 0; i < 10; i++) {
            var a = (Math.PI * 2 / 10) * i;
            sticker.sparkle.push({ x: x, y: y, vx: Math.cos(a) * rand(40, 110),
                vy: Math.sin(a) * rand(40, 110), life: 0.5, max: 0.5,
                col: randPick(["#FFD700", "#FF80AB", "#7C4DFF", "#4FC3F7"]) });
        }
    }

    function updateStickerBook(dt) {
        if (!sticker) return;
        if (sticker.msgT > 0) sticker.msgT -= dt;
        for (var s = sticker.sparkle.length - 1; s >= 0; s--) {
            var p = sticker.sparkle[s];
            p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
            if (p.life <= 0) sticker.sparkle.splice(s, 1);
        }

        var click = consumeClick();
        if (!click) return;

        // Back button
        if (pointInRect(click.x, click.y, 10, 52, 80, 40)) {
            persistSave();
            sticker = null;
            enterDinaHome();
            playClick();
            return;
        }
        // Clear-page button (bottom-right)
        if (pointInRect(click.x, click.y, W - 110, H - 52, 100, 40)) {
            if (save.stickerBook.length > 0) {
                save.stickerBook = [];
                persistSave();
                sticker.msg = "Cleared the page!"; sticker.msgT = 1.6;
                playTone(300, 0.12, "square", 0.14);
            }
            return;
        }

        // Tray row (bottom): pick up a sticker to place
        var tray = stickerTrayLayout();
        for (var t = 0; t < tray.length; t++) {
            var it = tray[t];
            if (pointInRect(click.x, click.y, it.x - 24, it.y - 24, 48, 48)) {
                if ((save.totalCoins || 0) >= it.kind.cost) {
                    sticker.held = it.kind;
                    sticker.msg = "Now tap the page to place " + it.kind.e;
                    sticker.msgT = 2.5;
                    playClick();
                } else {
                    sticker.msg = "Need 💰" + it.kind.cost + " for that one";
                    sticker.msgT = 1.8;
                    playDeny();
                }
                return;
            }
        }

        // Place held sticker onto the page
        if (sticker.held && pointInRect(click.x, click.y, STICKER_PAGE.x, STICKER_PAGE.y, STICKER_PAGE.w, STICKER_PAGE.h)) {
            save.totalCoins -= sticker.held.cost;
            save.stickerBook.push({
                e: sticker.held.e, x: click.x, y: click.y,
                rot: rand(-0.35, 0.35), scale: rand(0.9, 1.25)
            });
            persistSave();
            stickerSparkle(click.x, click.y);
            playTone(700, 0.07, "sine", 0.16);
            setTimeout(function () { playTone(950, 0.08, "sine", 0.14); }, 60);
            sticker.msg = "Pretty! 💰" + (save.totalCoins || 0) + " left";
            sticker.msgT = 1.6;
            // keep the same sticker held if still affordable, else drop it
            if ((save.totalCoins || 0) < sticker.held.cost) sticker.held = null;
            return;
        }
    }

    function stickerTrayLayout() {
        // Two rows of 6 along the bottom tray.
        var arr = [];
        var startY = H - 150;
        for (var i = 0; i < STICKER_KINDS.length; i++) {
            var col = i % 6, row = Math.floor(i / 6);
            arr.push({ kind: STICKER_KINDS[i], x: 50 + col * 76, y: startY + row * 50 });
        }
        return arr;
    }

    function drawStickerBook() {
        // Warm desk background
        ctx.fillStyle = "#E8C9A0";
        ctx.fillRect(0, 0, W, H);
        // wood grain
        ctx.strokeStyle = "rgba(150,110,70,0.25)";
        ctx.lineWidth = 2;
        for (var wy = 0; wy < H; wy += 26) {
            ctx.beginPath(); ctx.moveTo(0, wy + Math.sin(wy) * 3); ctx.lineTo(W, wy); ctx.stroke();
        }

        // HUD bar
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(0, 0, W, 44, 0); ctx.fill();
        drawText("📖 Dina's Sticker Book", W / 2, 22,
            "bold 15px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#000", 3);
        drawText("💰 " + (save.totalCoins || 0), W - 14, 22,
            "bold 15px Arial", "#FFD700", "#000", 2, "right");

        // Scrapbook page (with a cute spiral binding)
        var pg = STICKER_PAGE;
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        roundRect(pg.x + 4, pg.y + 5, pg.w, pg.h, 14); ctx.fill();
        ctx.fillStyle = "#FFFDF7";
        roundRect(pg.x, pg.y, pg.w, pg.h, 14); ctx.fill();
        ctx.strokeStyle = "#FF80AB"; ctx.lineWidth = 3;
        roundRect(pg.x, pg.y, pg.w, pg.h, 14); ctx.stroke();
        // faint guide dots
        ctx.fillStyle = "rgba(255,180,200,0.25)";
        for (var gy = pg.y + 30; gy < pg.y + pg.h - 10; gy += 40) {
            for (var gx = pg.x + 30; gx < pg.x + pg.w - 10; gx += 40) {
                ctx.beginPath(); ctx.arc(gx, gy, 2, 0, Math.PI * 2); ctx.fill();
            }
        }
        // spiral binding rings along the top
        ctx.strokeStyle = "#B07B4F"; ctx.lineWidth = 3;
        for (var rx = pg.x + 20; rx < pg.x + pg.w - 10; rx += 26) {
            ctx.beginPath(); ctx.arc(rx, pg.y, 6, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        }

        // Empty-page hint
        if (!save.stickerBook || save.stickerBook.length === 0) {
            drawText("Your page is empty —", W / 2, pg.y + pg.h / 2 - 12,
                "italic 15px 'Segoe UI', Arial", "#C9A0B0", null, 0);
            drawText("decorate it below! 💕", W / 2, pg.y + pg.h / 2 + 12,
                "italic 15px 'Segoe UI', Arial", "#C9A0B0", null, 0);
        }

        // Placed stickers (clipped to the page)
        ctx.save();
        roundRect(pg.x, pg.y, pg.w, pg.h, 14); ctx.clip();
        for (var i = 0; i < save.stickerBook.length; i++) {
            var pl = save.stickerBook[i];
            ctx.save();
            ctx.translate(pl.x, pl.y);
            ctx.rotate(pl.rot);
            ctx.scale(pl.scale, pl.scale);
            // little white sticker backing for that vinyl look
            ctx.fillStyle = "rgba(0,0,0,0.10)";
            ctx.beginPath(); ctx.arc(1, 2, 18, 0, Math.PI * 2); ctx.fill();
            ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(pl.e, 0, 0);
            ctx.restore();
        }
        ctx.restore();

        // Sparkles
        for (var sp = 0; sp < sticker.sparkle.length; sp++) {
            var s2 = sticker.sparkle[sp];
            ctx.globalAlpha = clamp(s2.life / s2.max, 0, 1);
            ctx.fillStyle = s2.col;
            ctx.beginPath(); ctx.arc(s2.x, s2.y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Tray label
        drawText("Tap a sticker (costs 💰), then tap the page", W / 2, H - 176,
            "bold 12px 'Segoe UI', Arial", "#5D4037", "#FFF", 2);

        // Tray of buyable stickers
        var tray = stickerTrayLayout();
        for (var t = 0; t < tray.length; t++) {
            var it = tray[t];
            var afford = (save.totalCoins || 0) >= it.kind.cost;
            var held = sticker.held === it.kind;
            // tile
            ctx.fillStyle = held ? "#FFF59D" : (afford ? "#FFFFFF" : "#D7CCC8");
            roundRect(it.x - 24, it.y - 24, 48, 48, 10); ctx.fill();
            ctx.strokeStyle = held ? "#FBC02D" : "#B0A08F"; ctx.lineWidth = held ? 3 : 2;
            roundRect(it.x - 24, it.y - 24, 48, 48, 10); ctx.stroke();
            ctx.globalAlpha = afford ? 1 : 0.45;
            ctx.font = "26px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(it.kind.e, it.x, it.y - 4);
            ctx.globalAlpha = 1;
            // cost pill
            drawText("💰" + it.kind.cost, it.x, it.y + 16, "bold 10px Arial", afford ? "#FF8F00" : "#9E9E9E", "#FFF", 2);
        }

        // Held-sticker preview following nothing (shown near message)
        if (sticker.held) {
            drawText("Holding " + sticker.held.e + " — tap the page!", W / 2, 66,
                "bold 13px 'Segoe UI', Arial", "#7C4DFF", "#FFF", 2);
        } else if (sticker.msgT > 0) {
            ctx.globalAlpha = clamp(sticker.msgT, 0, 1);
            drawText(sticker.msg, W / 2, 66, "bold 13px 'Segoe UI', Arial", "#5D4037", "#FFF", 2);
            ctx.globalAlpha = 1;
        }

        // Back + Clear buttons
        drawIconButton(20, 56, 36, "◀", { bg: "#A8E6CF", bgDark: "#388E3C" });
        ctx.fillStyle = "#EF9A9A";
        roundRect(W - 110, H - 52, 100, 40, 10); ctx.fill();
        ctx.strokeStyle = "#C62828"; ctx.lineWidth = 2;
        roundRect(W - 110, H - 52, 100, 40, 10); ctx.stroke();
        drawText("🗑 Clear", W - 60, H - 32, "bold 13px Arial", "#FFFFFF", "#000", 2);
    }
