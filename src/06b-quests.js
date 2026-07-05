    // ══════════════════════════════════════════════════════════════════════
    //  WEEKLY QUESTS
    //  Unlocks at 200,000 lifetime score. Three quests are picked deterministically
    //  from a pool each ISO-ish week (same week → same 3 on every device), reward
    //  coins, and reset automatically every 7 days. Gameplay feeds progress through
    //  questAdd()/questBest(); the player claims rewards on the quest screen.
    // ══════════════════════════════════════════════════════════════════════

    // { id, icon, title, desc, target, reward, scope }
    //   scope "run"  → tracks the BEST single-run value (questBest)
    //   scope "week" → accumulates across every run this week (questAdd)
    var QUEST_POOL = [
        { id: "chain6",       icon: "😤", title: "Daredevil",            desc: "Hit a 6 close-call chain in one run",     target: 6,     reward: 150, scope: "run"  },
        { id: "runCoins250",  icon: "🪙", title: "Coin Vacuum",          desc: "Collect 250 coins in a single run",       target: 250,   reward: 150, scope: "run"  },
        { id: "dist25k",      icon: "🛣️", title: "Road Warrior",         desc: "Drive 25,000 distance in one run",        target: 25000, reward: 125, scope: "run"  },
        { id: "escapes2",     icon: "🚓", title: "Catch Me If You Can",  desc: "Escape 2 cop chases this week",           target: 2,     reward: 200, scope: "week" },
        { id: "parks3",       icon: "🅿️", title: "Parallel Pro",         desc: "Complete 3 pull-over parks this week",     target: 3,     reward: 150, scope: "week" },
        { id: "uncles3",      icon: "👨", title: "Family Reunion",       desc: "Greet 3 uncles this week",                target: 3,     reward: 175, scope: "week" },
        { id: "missiles8",    icon: "🚀", title: "Demolition Diva",      desc: "Destroy 8 cars with missiles this week",  target: 8,     reward: 150, scope: "week" },
        { id: "honks10",      icon: "📣", title: "Make Some Noise",      desc: "Honk-scare 10 cars this week",            target: 10,    reward: 100, scope: "week" },
        { id: "heshy2",       icon: "🏊", title: "Pool Patrol",          desc: "Find Heshy 2 times this week",            target: 2,     reward: 125, scope: "week" },
        { id: "tolls4",       icon: "🎫", title: "Toll Collector",       desc: "Pass 4 toll booths this week",            target: 4,     reward: 100, scope: "week" },
        { id: "avigail3",     icon: "💜", title: "Frenemies",            desc: "Share the road with Avigail 3 times",     target: 3,     reward: 125, scope: "week" },
        { id: "footDist",     icon: "🚶", title: "Stretch Those Legs",   desc: "Walk 3,000 on foot this week",            target: 3000,  reward: 125, scope: "week" }
    ];

    // ── Run-end bookkeeping (set false by resetGame, banked once by updateGameOver) ──
    var runBanked = false;      // guards the once-per-run lifetime-score + run-quest bank
    var footQuestAccum = 0;     // on-foot distance not yet flushed to the footDist quest
    var footQuestT = 0;         // throttle timer so footDist persists ~1×/sec, not per-frame

    // ── Quest-screen transient FX ──
    var questClaimFlash = 0;    // toast fade after a claim
    var questClaimMsg = "";
    var questScreenT = 0;       // drives CLAIM-button pulse + badge pulse

    // Deterministic weekly selection cache (recomputed only on week rollover).
    var questActiveCache = null, questActiveCacheWk = -1;

    // Current week index (7-day buckets since the epoch).
    function questWeek() { return Math.floor(Math.floor(Date.now() / 86400000) / 7); }

    // The 3 active quest ids for THIS week — deterministic across devices via a
    // week-seeded mulberry PRNG (reuses the multiplayer hash/PRNG helpers).
    function questActiveIds() {
        var wk = questWeek();
        if (questActiveCache && questActiveCacheWk === wk) return questActiveCache;
        var rng = mpMulberry(mpHashStr("luluQuestsWk" + wk));
        var pool = [];
        for (var i = 0; i < QUEST_POOL.length; i++) pool.push(QUEST_POOL[i].id);
        var ids = [];
        for (var p = 0; p < 3 && pool.length > 0; p++) {
            var idx = Math.floor(rng() * pool.length);
            ids.push(pool[idx]);
            pool.splice(idx, 1);   // no repeats within a week's picks
        }
        questActiveCache = ids; questActiveCacheWk = wk;
        return ids;
    }

    function questIsActive(id) { return questActiveIds().indexOf(id) >= 0; }

    function questDef(id) {
        for (var i = 0; i < QUEST_POOL.length; i++) if (QUEST_POOL[i].id === id) return QUEST_POOL[i];
        return null;
    }

    // The live weekly state, auto-rolled-over. Persists only when it actually
    // resets (once per new week) so the hot gameplay path stays write-free.
    function questState() {
        var wk = questWeek();
        if (!save.quests || save.quests.week !== wk) {
            save.quests = { week: wk, prog: {}, best: {}, claimed: {}, notified: {} };
            persistSave();
        }
        if (!save.quests.prog) save.quests.prog = {};
        if (!save.quests.best) save.quests.best = {};
        if (!save.quests.claimed) save.quests.claimed = {};
        if (!save.quests.notified) save.quests.notified = {};
        return save.quests;
    }

    // Current shown value for a quest (best for run-scope, accumulated for week).
    function questValue(id) {
        var def = questDef(id); if (!def) return 0;
        var q = questState();
        return def.scope === "run" ? (q.best[id] || 0) : (q.prog[id] || 0);
    }

    function questComplete(id) {
        var def = questDef(id); if (!def) return false;
        return questValue(id) >= def.target;
    }

    function questClaimed(id) { return !!questState().claimed[id]; }

    // True if any active quest is complete but not yet claimed (drives the menu
    // button's "!" badge).
    function questAnyClaimable() {
        if (!questsUnlocked()) return false;
        var ids = questActiveIds();
        for (var i = 0; i < ids.length; i++) if (questComplete(ids[i]) && !questClaimed(ids[i])) return true;
        return false;
    }

    // Completion celebration — a gold floater + a rising 3-note jingle, once per
    // quest per week (guarded by the notified flag).
    function questFireComplete(id) {
        var q = questState();
        if (q.notified[id]) return;
        q.notified[id] = true;
        if (typeof player !== "undefined" && player && typeof spawnFloater === "function")
            spawnFloater(player.x, player.y - 64, "📜 QUEST COMPLETE — claim in menu!", "#FFD700");
        playTone(659, 0.10, "triangle", 0.22);
        setTimeout(function () { playTone(880, 0.10, "triangle", 0.22); }, 110);
        setTimeout(function () { playTone(1175, 0.14, "triangle", 0.22); }, 220);
        persistSave();
    }

    // Gameplay hook — WEEK scope. No-op unless unlocked, active, and still advancing
    // an unclaimed/uncompleted target (so it only persists on real progress).
    function questAdd(id, n) {
        if (!questsUnlocked() || n <= 0 || !questIsActive(id)) return;
        var def = questDef(id);
        if (!def || def.scope !== "week") return;
        var q = questState();
        if (q.claimed[id]) return;
        var before = q.prog[id] || 0;
        if (before >= def.target) return;   // already complete → stop tracking
        q.prog[id] = before + n;
        if (q.prog[id] >= def.target) questFireComplete(id);
        persistSave();
    }

    // Gameplay hook — RUN scope. Records the best single-run value live; only
    // persists on completion (run end persists the rest via bankRunStats()).
    function questBest(id, v) {
        if (!questsUnlocked() || !questIsActive(id)) return;
        var def = questDef(id);
        if (!def || def.scope !== "run") return;
        var q = questState();
        var before = q.best[id] || 0;
        if (v <= before) return;
        q.best[id] = v;
        if (v >= def.target && before < def.target) { questFireComplete(id); persistSave(); }
    }

    // Called ONCE per finished run (from updateGameOver, guarded by runBanked):
    // banks lifetime score for the unlock and the run-scope quest totals.
    function bankRunStats() {
        if (runBanked) return;
        runBanked = true;
        // Lifetime score accrues for EVERY run regardless of the quest unlock.
        save.lifetimeScore = (save.lifetimeScore || 0) + Math.floor(score);
        questBest("runCoins250", runCoins);
        questBest("dist25k", Math.floor(scrollOffset));
        // Flush any on-foot distance that didn't reach the ~1s throttle.
        if (footQuestAccum >= 1) { questAdd("footDist", Math.floor(footQuestAccum)); footQuestAccum = 0; }
        persistSave();
    }

    // Countdown to the next weekly reset, as "Xd Yh".
    function questCountdownStr() {
        var boundary = (questWeek() + 1) * 7 * 86400000;
        var ms = boundary - Date.now();
        if (ms < 0) ms = 0;
        var d = Math.floor(ms / 86400000);
        var h = Math.floor((ms % 86400000) / 3600000);
        return d + "d " + h + "h";
    }

    // ── Quest screen layout (shared by draw + click so they never drift) ──
    function questCardRects() {
        var ids = questActiveIds();
        var cardX = 24, cardW = W - 48, cardH = 150, gap = 14, top = 118;
        var arr = [];
        for (var i = 0; i < ids.length; i++) {
            var cy = top + i * (cardH + gap);
            arr.push({
                id: ids[i], x: cardX, y: cy, w: cardW, h: cardH,
                btnX: cardX + cardW - 158, btnY: cy + cardH - 52, btnW: 142, btnH: 40
            });
        }
        return arr;
    }

    // ── Update: Quests ───────────────────────────────────────
    function updateQuests(dt) {
        menuBounce += dt;
        questScreenT += dt;
        if (questClaimFlash > 0) questClaimFlash -= dt;
        updateParticles(dt);   // claim confetti

        if (consumePause()) { state = "menu"; playClick(); return; }
        var click = consumeClick();
        if (!click) return;

        // Back button
        if (pointInRect(click.x, click.y, 16, 14, 80, 44)) { state = "menu"; playClick(); return; }

        // Claim a completed, unclaimed quest.
        var cards = questCardRects();
        for (var i = 0; i < cards.length; i++) {
            var c = cards[i];
            if (questComplete(c.id) && !questClaimed(c.id) &&
                pointInRect(click.x, click.y, c.btnX, c.btnY, c.btnW, c.btnH)) {
                var def = questDef(c.id);
                save.totalCoins += def.reward;
                questState().claimed[c.id] = true;
                persistSave();
                playBuy();
                spawnConfetti(c.btnX + c.btnW / 2, c.btnY, 46);
                questClaimFlash = 1.6;
                questClaimMsg = "+" + def.reward + " 💰 claimed!";
                return;
            }
        }
    }

    // ── Draw: Quests ─────────────────────────────────────────
    function drawQuests() {
        // Slate gradient bg (shop family).
        var sg = ctx.createLinearGradient(0, 0, 0, H);
        sg.addColorStop(0, "#455A64");
        sg.addColorStop(1, "#263238");
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, W, H);
        // Subtle dot texture, same as the shop.
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        for (var ty = 0; ty < H; ty += 20) {
            for (var tx = (ty % 40 === 0 ? 0 : 10); tx < W; tx += 20) ctx.fillRect(tx, ty, 10, 10);
        }

        // Back button.
        drawBackButton(16, 14);

        // Golden glow + title.
        ctx.save();
        var g = ctx.createRadialGradient(W / 2, 38, 8, W / 2, 38, 130);
        g.addColorStop(0, "rgba(255,215,0,0.18)");
        g.addColorStop(1, "rgba(255,215,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, 130);
        ctx.restore();
        // Row 1: back button (left) + coin balance (right); the title gets its
        // own row below so a long word never collides with the coin chip.
        drawCoin(W - 90, 34, menuBounce);
        drawText(formatNum(save.totalCoins), W - 76, 36, "bold 19px 'Segoe UI', Arial, sans-serif", C.coin, "#000", 4, "left");
        drawText("📜 WEEKLY QUESTS", W / 2, 70, "bold 26px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 5);

        // Subtitle countdown.
        var cards = questCardRects();
        var allClaimed = true;
        for (var a = 0; a < cards.length; a++) if (!questClaimed(cards[a].id)) allClaimed = false;
        drawText("new quests in " + questCountdownStr(), W / 2, 96,
            "600 14px 'Segoe UI', Arial, sans-serif", "#B0BEC5", "#1a2228", 3);

        // Quest cards.
        for (var i = 0; i < cards.length; i++) drawQuestCard(cards[i]);

        // All-done celebration line.
        if (allClaimed && cards.length > 0) {
            var doneY = cards[cards.length - 1].y + cards[cards.length - 1].h + 30;
            drawText("all done — new quests in " + questCountdownStr() + " 🎉", W / 2, doneY,
                "bold 16px 'Segoe UI', Arial, sans-serif", "#69F0AE", "#12301f", 3);
        }

        // Claim confetti + toast.
        drawParticles();
        if (questClaimFlash > 0) {
            var alp = clamp(questClaimFlash / 1.6, 0, 1);
            ctx.globalAlpha = alp;
            ctx.fillStyle = "rgba(0,0,0,0.8)";
            roundRect(W / 2 - 150, H - 72, 300, 48, 10); ctx.fill();
            drawText(questClaimMsg, W / 2, H - 48, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3);
            ctx.globalAlpha = 1;
        }
    }

    function drawQuestCard(c) {
        var def = questDef(c.id);
        var complete = questComplete(c.id);
        var claimed = questClaimed(c.id);
        var val = questValue(c.id);

        // Card body — dim slightly once claimed.
        ctx.save();
        if (claimed) ctx.globalAlpha = 0.72;
        var cg = ctx.createLinearGradient(0, c.y, 0, c.y + c.h);
        cg.addColorStop(0, "#33424C"); cg.addColorStop(1, "#1c262c");
        ctx.fillStyle = cg;
        roundRect(c.x, c.y, c.w, c.h, 14); ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = claimed ? "#43A047" : (complete ? "#FFC107" : "#37474F");
        roundRect(c.x, c.y, c.w, c.h, 14); ctx.stroke();

        // Icon well (left).
        var wx = c.x + 16, wy = c.y + 16, ws = 72;
        var pw = ctx.createLinearGradient(0, wy, 0, wy + ws);
        pw.addColorStop(0, "#3d4d57"); pw.addColorStop(1, "#141c22");
        ctx.fillStyle = pw;
        roundRect(wx, wy, ws, ws, 12); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,215,0,0.45)";
        roundRect(wx, wy, ws, ws, 12); ctx.stroke();
        drawText(def.icon, wx + ws / 2, wy + ws / 2 + 2, "40px Arial", "#FFF", null, 0);

        // Reward chip (top-right).
        var chipTxt = "+" + def.reward + " 💰";
        ctx.font = "bold 15px 'Segoe UI', Arial, sans-serif";
        var chipW = ctx.measureText(chipTxt).width + 22;
        var chipX = c.x + c.w - 14 - chipW, chipY = c.y + 14;
        ctx.fillStyle = "rgba(255,193,7,0.16)";
        roundRect(chipX, chipY, chipW, 26, 13); ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,193,7,0.55)";
        roundRect(chipX, chipY, chipW, 26, 13); ctx.stroke();
        drawText(chipTxt, chipX + chipW / 2, chipY + 13, "bold 15px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#3a2b00", 2);

        // Title + description.
        var tx = c.x + 104;
        drawText(def.title, tx, c.y + 34, "bold 20px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#101820", 3, "left");
        drawText(def.desc, tx, c.y + 60, "13px 'Segoe UI', Arial, sans-serif", "#90A4AE", "#0f1519", 2, "left");

        if (claimed) {
            // Green ✓ CLAIMED strip.
            var sX = tx, sY = c.y + c.h - 46, sW = c.w - (tx - c.x) - 16, sH = 30;
            ctx.fillStyle = "rgba(67,160,71,0.22)";
            roundRect(sX, sY, sW, sH, 10); ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = "#43A047";
            roundRect(sX, sY, sW, sH, 10); ctx.stroke();
            drawText("✓ CLAIMED", sX + sW / 2, sY + sH / 2, "bold 16px 'Segoe UI', Arial, sans-serif", "#A5D6A7", "#0f2415", 2);
        } else if (complete) {
            // Progress bar (full, gold) + glowing pulsing CLAIM button.
            var barW = c.btnX - tx - 14;
            drawQuestBar(tx, c.y + c.h - 40, barW, 20, 1, val, def.target, true);
            var pulse = 0.5 + 0.5 * Math.sin(questScreenT * 5);
            ctx.save();
            ctx.shadowColor = "rgba(255,215,0," + (0.5 + 0.4 * pulse) + ")";
            ctx.shadowBlur = 12 + 10 * pulse;
            drawButton(c.btnX, c.btnY, c.btnW, c.btnH, "CLAIM 💰", { bg: "#FFC107", bgDark: "#F9A825", small: true });
            ctx.restore();
        } else {
            // Incomplete → progress bar only.
            var frac = def.target > 0 ? clamp(val / def.target, 0, 1) : 0;
            drawQuestBar(tx, c.y + c.h - 40, c.w - (tx - c.x) - 16, 20, frac, val, def.target, false);
        }
        ctx.restore();
    }

    // A dark-track / gold-fill progress bar with a "cur/target" label.
    function drawQuestBar(x, y, w, h, frac, val, target, done) {
        ctx.fillStyle = "rgba(10,15,20,0.75)";
        roundRect(x, y, w, h, h / 2); ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,0.12)";
        roundRect(x, y, w, h, h / 2); ctx.stroke();
        var fw = Math.max(frac > 0 ? h : 0, w * frac);
        if (fw > 0) {
            var bg = ctx.createLinearGradient(x, 0, x + w, 0);
            if (done) { bg.addColorStop(0, "#FFE082"); bg.addColorStop(1, "#FFC107"); }
            else { bg.addColorStop(0, "#FFD54F"); bg.addColorStop(1, "#FFB300"); }
            ctx.fillStyle = bg;
            roundRect(x, y, fw, h, h / 2); ctx.fill();
        }
        drawText(formatNum(Math.min(val, target)) + "/" + formatNum(target), x + w / 2, y + h / 2,
            "bold 12px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#000", 3);
    }
