    // ══════════════════════════════════════════════════════════════════════
    //  IMA IS CALLING  (driving only — tuned in SPAWN_CONFIG.imaCall)
    //  The phone rings mid-drive. HONK to say "I'm DRIVING, Ima!" (she's
    //  proud: +10). Let it ring and Lulu picks up — while she's on the phone
    //  the steering is FLIPPED (same as Distracted Mode) for the whole chat,
    //  but Ima sends gas money at the end (+30). Honk mid-call to hang up.
    // ══════════════════════════════════════════════════════════════════════
    var IMA_CALL_LINES = [
        "Hi mamele! Are you EATING?", "Did you call Bubbe back?",
        "Are you wearing a sweater? It's cold!", "Tammy says hi. Don't tell Esti.",
        "Who is this Avigail I keep hearing about?", "Abba wants to know if the car's okay.",
        "Pick up challah on the way home!", "Your cousin got engaged! Just saying.",
        "Did Dina tell you about her sticker book?", "Wait — are you DRIVING right now?!"
    ];
    var IMA_RING_DUR = 2.4, IMA_TALK_DUR = 7.2, IMA_DONE_DUR = 2.2;
    var imaCall = null;   // { phase: "ring"|"talk"|"done", t, lines[], result }

    function imaCallTalking() { return !!(imaCall && imaCall.phase === "talk"); }
    function imaCallRect() { var w = W - 44; return { x: W / 2 - w / 2, y: H * 0.15, w: w, h: 84 }; }

    function imaCallCanStart(onFoot) {
        if (onFoot || imaCall || imaText) return false;
        if (typeof tutActive !== "undefined" && tutActive) return false;
        if (typeof copChase !== "undefined" && copChase) return false;
        if (typeof storyCallT !== "undefined" && (storyCallT > 0 || storyCallPending)) return false;
        if (typeof legBannerT !== "undefined" && legBannerT > 0) return false;
        // Flipped steering would be unfair in a friend-room race.
        if (typeof mpConnected !== "undefined" && mpConnected && mpRoom !== "lobby") return false;
        return gameTime > 30;
    }

    function endImaCall(result) {
        var pay = result === "full" ? 30 : 10;
        imaCall.phase = "done"; imaCall.t = 0; imaCall.result = result; imaCall.pay = pay;
        save.totalCoins += pay; runCoins += pay;
        statAdd(result === "full" ? "imaCalls" : "imaDeclines", 1);
        persistSave();
        if (typeof player !== "undefined" && player) spawnFloater(player.x, player.y - 56, "+" + pay + " 💰 from Ima", "#FF80AB");
        playCoin();
    }

    // Called from updatePlaying (before the honk handler, so a honk during the
    // call is the decline/hang-up — not a Honk Symphony note).
    function updateImaCall(dt, onFoot) {
        if (!imaCall) {
            if (tickSpawn("imaCall", dt) && imaCallCanStart(onFoot)) {
                var pool = IMA_CALL_LINES.slice(), lines = [];
                for (var i = 0; i < 3; i++) lines.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
                imaCall = { phase: "ring", t: 0, lines: lines, ringBeat: 0 };
            }
            return;
        }
        imaCall.t += dt;
        if (imaCall.phase === "ring") {
            imaCall.ringBeat -= dt;
            if (imaCall.ringBeat <= 0) {   // brrring-brrring
                imaCall.ringBeat = 0.8;
                playTone(880, 0.08, "sine", 0.12);
                setTimeout(function () { playTone(988, 0.08, "sine", 0.12); }, 110);
                if (typeof Haptic !== "undefined") Haptic.light("imaRing");
            }
            if (consumeHonk()) { endImaCall("declined"); return; }
            if (imaCall.t >= IMA_RING_DUR) { imaCall.phase = "talk"; imaCall.t = 0; playTone(660, 0.06, "triangle", 0.12); }
        } else if (imaCall.phase === "talk") {
            if (consumeHonk()) { endImaCall("hungup"); return; }
            if (imaCall.t >= IMA_TALK_DUR) endImaCall("full");
        } else if (imaCall.t >= IMA_DONE_DUR) {
            imaCall = null;
        }
    }

    function drawImaCall() {
        if (!imaCall || state !== "playing") return;
        var r = imaCallRect(), t = imaCall.t;
        var fadeIn = imaCall.phase === "ring" ? clamp(t / 0.25, 0, 1) : 1;
        var fadeOut = imaCall.phase === "done" ? clamp((IMA_DONE_DUR - t) / 0.4, 0, 1) : 1;
        var buzz = imaCall.phase === "ring" ? Math.sin(t * 60) * 2.5 * (Math.sin(t * 7.8) > 0 ? 1 : 0) : 0;
        ctx.save();
        ctx.globalAlpha = fadeIn * fadeOut;
        ctx.translate(buzz, 0);
        ctx.fillStyle = "rgba(18,24,36,0.94)";
        roundRect(r.x, r.y, r.w, r.h, 16); ctx.fill();
        ctx.strokeStyle = "#FF80AB"; ctx.lineWidth = 2.5;
        roundRect(r.x, r.y, r.w, r.h, 16); ctx.stroke();
        // avatar: a pink phone bubble (rings while ringing)
        var acx = r.x + 44, acy = r.y + r.h / 2;
        ctx.fillStyle = "#F06292"; ctx.beginPath(); ctx.arc(acx, acy, 28, 0, Math.PI * 2); ctx.fill();
        if (imaCall.phase === "ring") {
            var wv = (t * 1.6) % 1;
            ctx.strokeStyle = "rgba(255,128,171," + (1 - wv) + ")"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(acx, acy, 28 + wv * 14, 0, Math.PI * 2); ctx.stroke();
        }
        drawText(imaCall.phase === "talk" ? "🗣️" : "📞", acx, acy + 1, "28px Arial", "#FFF", null, 0);
        var tx = r.x + 86, tw = r.w - 100;
        if (imaCall.phase === "ring") {
            drawText("📞 IMA is calling…", tx, r.y + 26, "bold 18px 'Segoe UI', Arial, sans-serif", "#FF80AB", "#000", 3, "left");
            drawText("📣 HONK = \"I'm DRIVING, Ima!\"", tx, r.y + 52, "bold 14px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2, "left");
            drawText("…or let it ring to pick up", tx, r.y + 70, "13px 'Segoe UI', Arial, sans-serif", "#B0BEC5", "#000", 2, "left");
        } else if (imaCall.phase === "talk") {
            var li = Math.min(imaCall.lines.length - 1, Math.floor(t / (IMA_TALK_DUR / imaCall.lines.length)));
            drawText("IMA (on the phone)", tx, r.y + 20, "bold 13px 'Segoe UI', Arial, sans-serif", "#FF80AB", "#000", 2, "left");
            drawText(imaCall.lines[li], tx, r.y + 42, "bold 15px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2, "left");
            drawText("🔄 steering's flipped! · 📣 honk to hang up", tx, r.y + 64, "12px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 2, "left");
            ctx.fillStyle = "rgba(255,255,255,0.15)"; roundRect(tx, r.y + 74, tw, 5, 2.5); ctx.fill();
            ctx.fillStyle = "#FF80AB"; roundRect(tx, r.y + 74, tw * clamp(t / IMA_TALK_DUR, 0, 1), 5, 2.5); ctx.fill();
        } else {
            var msg = imaCall.result === "full" ? "Love you! Gas money's on the way 💸"
                    : imaCall.result === "declined" ? "Good girl — eyes on the road! 👀"
                    : "Hung up on your MOTHER?! …drive safe. 💋";
            drawText("IMA", tx, r.y + 24, "bold 13px 'Segoe UI', Arial, sans-serif", "#FF80AB", "#000", 2, "left");
            drawText(msg, tx, r.y + 46, "bold 14px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2, "left");
            drawText("+" + imaCall.pay + " 💰", tx, r.y + 68, "bold 15px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3, "left");
        }
        ctx.restore();
    }
