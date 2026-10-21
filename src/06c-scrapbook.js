    // ══════════════════════════════════════════════════════════════════════
    //  LULU'S SCRAPBOOK  (state === "scrapbook", 📒 button under the menu mute)
    //  One place for everything the game already remembers — badges, the rap
    //  sheet, the ER punch card, the Avigail meter, family run-ins and records —
    //  plus a save-code backup/restore. Lifetime counters ride on the existing
    //  quest hooks (questAdd/questBest call statAdd/statBest), so they tick for
    //  everyone whether or not weekly quests are unlocked yet.
    // ══════════════════════════════════════════════════════════════════════

    // ── Lifetime stats (save.stats) ─────────────────────────────────────────
    // Keys reuse the quest ids that feed them (honks10, missiles8, …) plus a few
    // direct hooks (weddings, salon, dismissed). save.stats.best holds bests.
    function statsObj() {
        if (!save.stats || typeof save.stats !== "object") save.stats = {};
        if (!save.stats.best || typeof save.stats.best !== "object") save.stats.best = {};
        return save.stats;
    }
    // In-memory only — the run-end bank / scene exits persist the save.
    function statAdd(id, n) { if (n > 0) { var s = statsObj(); s[id] = (s[id] || 0) + n; } }
    function statBest(id, v) { var b = statsObj().best; if (v > (b[id] || 0)) b[id] = v; }
    function stat(id) { return (save.stats && save.stats[id]) || 0; }
    function statB(id) { return (save.stats && save.stats.best && save.stats.best[id]) || 0; }

    function skinCount() { var n = 0; for (var k in SKINS) n++; return n; }
    function ownsAllSkins() { return (save.ownedSkins || []).length >= skinCount(); }
    function storyStarCount() { var n = 0; for (var k in (save.storyStars || {})) if (save.storyStars[k]) n++; return n; }
    function hasPostcard(id) { return (save.postcards || []).indexOf(id) >= 0; }

    // ── Badges ──────────────────────────────────────────────────────────────
    // test() → earned?  prog() → [current, target] for the progress line.
    // secret badges stay off the board entirely until earned.
    var BADGES = [
        { id: "firstRun",  icon: "🚗", name: "Learner's Permit", desc: "Finish your first drive",            test: function () { return save.highScore > 0; } },
        { id: "score10k",  icon: "🔥", name: "Lead Foot",        desc: "Score 10,000 in one run",            prog: function () { return [save.highScore, 10000]; } },
        { id: "score50k",  icon: "🌟", name: "Road Legend",      desc: "Score 50,000 in one run",            prog: function () { return [save.highScore, 50000]; } },
        { id: "chain8",    icon: "😤", name: "Daredevil",        desc: "Chain 8 close calls in one run",     prog: function () { return [statB("chain6"), 8]; } },
        { id: "coins300",  icon: "🪙", name: "Coin Vacuum",      desc: "Grab 300 coins in one run",          prog: function () { return [statB("runCoins250"), 300]; } },
        { id: "honks50",   icon: "📣", name: "Honk Symphony",    desc: "Honk-scare 50 cars",                 prog: function () { return [stat("honks10"), 50]; } },
        { id: "missile25", icon: "🚀", name: "Demolition Diva",  desc: "Missile 25 cars",                    prog: function () { return [stat("missiles8"), 25]; } },
        { id: "bubbe",     icon: "🏡", name: "Bubbe's Favorite", desc: "Make it to Bubbe's house",           test: function () { return hasPostcard("bubbe") || (save.storyStop || 0) > 0 || (save.storyCycle || 0) > 0; } },
        { id: "vegas",     icon: "🎲", name: "Viva Las Vegas",   desc: "Finish the Road to Vegas",           test: function () { return (save.storyCycle || 0) >= 1; } },
        { id: "postcards", icon: "📮", name: "Postcard Pro",     desc: "Collect all 5 postcards",            prog: function () { return [(save.postcards || []).length, 5]; } },
        { id: "stars5",    icon: "⭐", name: "Teacher's Pet",    desc: "Earn all 5 chapter stars",           prog: function () { return [storyStarCount(), 5]; } },
        { id: "streak7",   icon: "📅", name: "Every Day Driver", desc: "Play 7 days in a row",               prog: function () { return [save.streak || 0, 7]; } },
        { id: "escape5",   icon: "🚓", name: "Can't Catch Me",   desc: "Escape 5 cop chases",                prog: function () { return [stat("escapes2"), 5]; } },
        { id: "jailbird",  icon: "⛓️", name: "Jailbird",         desc: "Get found guilty in court",          test: function () { return (save.convictions || 0) >= 1; } },
        { id: "strikes3",  icon: "⚖️", name: "Three Strikes",    desc: "Rack up 3 convictions",              prog: function () { return [save.convictions || 0, 3]; } },
        { id: "houdini",   icon: "🗝️", name: "Houdini",          desc: "Break out of jail",                  test: function () { return (save.escapes || 0) >= 1; } },
        { id: "dismissed", icon: "🤫", name: "Case Dismissed",   desc: "Walk out of court scot-free",        test: function () { return stat("dismissed") >= 1; } },
        { id: "er5",       icon: "🏥", name: "Frequent Flyer",   desc: "Visit the ER 5 times",               prog: function () { return [save.erVisits || 0, 5]; } },
        { id: "bff",       icon: "💜", name: "Besties",          desc: "Max out Avigail's friendship (90+)", prog: function () { return [avigailRel(), 90]; } },
        { id: "nemesis",   icon: "😈", name: "Nemesis",          desc: "Sink Avigail's friendship to 10",    test: function () { return avigailRel() <= 10; } },
        { id: "wedding",   icon: "💍", name: "Wedding Crasher",  desc: "Dance at Avigail's wedding",         test: function () { return stat("weddings") >= 1; } },
        { id: "uncles10",  icon: "👨", name: "Uncle Bingo",      desc: "Bump into the uncles 10 times",      prog: function () { return [stat("uncles3"), 10]; } },
        { id: "heshy5",    icon: "🏊", name: "Pool Patrol",      desc: "Find Heshy 5 times",                 prog: function () { return [stat("heshy2"), 5]; } },
        { id: "salon",     icon: "💇", name: "Fabio's Muse",     desc: "Get a makeover at the salon",        test: function () { return stat("salon") >= 1 || save.luluHair !== "#8B5A2B"; } },
        { id: "garage",    icon: "🏎️", name: "Full Garage",      desc: "Own every car in the shop",          prog: function () { return [(save.ownedSkins || []).length, skinCount()]; } },
        { id: "walk10k",   icon: "🚶", name: "Leg Day",          desc: "Walk 10,000 on foot",                prog: function () { return [stat("footDist"), 10000]; } },
        { id: "sister",    icon: "🎒", name: "Secret Sister",    desc: "Found the hidden sister",            secret: true, test: function () { return (save.dinaRunsPlayed || 0) > 0; } }
    ];
    function badgeEarned(b) {
        try {
            if (b.test) return !!b.test();
            var p = b.prog(); return p[0] >= p[1];
        } catch (e) { return false; }
    }
    // Badges shown on the board: every normal one + secrets already earned.
    function visibleBadges() {
        var out = [];
        for (var i = 0; i < BADGES.length; i++) if (!BADGES[i].secret || badgeEarned(BADGES[i])) out.push(BADGES[i]);
        return out;
    }
    function badgeTotals() {
        var got = 0, tot = 0;
        for (var i = 0; i < BADGES.length; i++) {
            if (BADGES[i].secret) { if (badgeEarned(BADGES[i])) got++; continue; }
            tot++; if (badgeEarned(BADGES[i])) got++;
        }
        return { got: got, tot: tot };
    }

    // Record newly earned badges in save.badges. Returns the NEW ones (for the
    // menu toast). The very first sync just snapshots silently, so veterans
    // aren't buried under a pile of toasts — they get the 📒 dot instead.
    function badgeSync() {
        var first = !Array.isArray(save.badges);
        if (first) save.badges = [];
        var fresh = [];
        for (var i = 0; i < BADGES.length; i++) {
            var b = BADGES[i];
            if (save.badges.indexOf(b.id) < 0 && badgeEarned(b)) { save.badges.push(b.id); fresh.push(b); }
        }
        if (first) { save.scrapSeen = 0; fresh = []; }
        if (first || fresh.length) persistSave();
        return fresh;
    }
    // A badge exists the player hasn't looked at yet → pulse the 📒 button.
    function scrapHasNew() { return Array.isArray(save.badges) && save.badges.length > (save.scrapSeen || 0); }

    // Menu hook: called from updateMenu. Syncs twice a second and toasts new ones.
    var badgeSyncT = 0;
    function menuBadgeTick(dt) {
        badgeSyncT -= dt;
        if (badgeSyncT > 0) return;
        badgeSyncT = 0.5;
        var fresh = badgeSync();
        if (fresh.length) {
            menuMsg = "🏆 New badge: " + fresh[0].name + (fresh.length > 1 ? " +" + (fresh.length - 1) + " more" : "") + "!";
            menuMsgTimer = 2.6;
            playTone(784, 0.10, "triangle", 0.2);
            setTimeout(function () { playTone(1046, 0.14, "triangle", 0.2); }, 110);
        }
    }

    // Menu 📒 button (under the mute button; only once the full menu is open).
    var SCRAP_BTN = { x: 0, y: 66, s: 44 };
    function scrapBtnX() { return W - 60; }
    function drawScrapbookMenuButton() {
        if (!save.cruiseUnlocked) return;
        var x = scrapBtnX(), y = SCRAP_BTN.y, s = SCRAP_BTN.s;
        drawIconButton(x, y, s, "📒", { bg: "#FFE082", bgDark: "#C49000" });
        if (scrapHasNew()) {
            var p = 0.5 + 0.5 * Math.sin(menuBounce * 6);
            ctx.save();
            ctx.shadowColor = "rgba(255,82,82," + (0.5 + 0.4 * p) + ")"; ctx.shadowBlur = 6 + 8 * p;
            ctx.fillStyle = "#FF5252";
            ctx.beginPath(); ctx.arc(x + s - 3, y + 4, 8, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            drawText("!", x + s - 3, y + 5, "bold 12px Arial", "#FFF", null, 0);
        }
    }
    function scrapbookMenuClick(click) {
        if (!save.cruiseUnlocked) return false;
        if (!pointInRect(click.x, click.y, scrapBtnX(), SCRAP_BTN.y, SCRAP_BTN.s, SCRAP_BTN.s)) return false;
        openScrapbook();
        playClick();
        return true;
    }

    // ── Screen state ────────────────────────────────────────────────────────
    var scrapTab = 0;          // 0 badges · 1 rap sheet · 2 crew · 3 records
    var scrapT = 0;            // time on the current tab (pop-in motion)
    var scrapSel = null;       // selected badge id (info panel)
    var scrapToast = "", scrapToastT = 0;
    var SCRAP_TABS = [["🏆", "Badges"], ["🚔", "Record"], ["💜", "Crew"], ["📊", "Stats"]];

    function openScrapbook() {
        badgeSync();
        save.scrapSeen = (save.badges || []).length; persistSave();
        scrapT = 0; scrapSel = null; scrapToastT = 0;
        state = "scrapbook";
    }

    // Layout shared by draw + click.
    function scrapTabRect(i) { var tw = (W - 24) / 4; return { x: 12 + i * tw, y: 96, w: tw - 6, h: 44 }; }
    function scrapBadgeLayout() {
        var list = visibleBadges();
        var cols = 4, top = 160, infoH = 86;
        var rows = Math.ceil(list.length / cols);
        var cellW = (W - 24) / cols;
        var cellH = Math.min(88, Math.floor((H - top - infoH - 16) / rows));
        var cells = [];
        for (var i = 0; i < list.length; i++) {
            cells.push({ b: list[i], x: 12 + (i % cols) * cellW, y: top + Math.floor(i / cols) * cellH, w: cellW, h: cellH });
        }
        return { cells: cells, infoY: top + rows * cellH + 8, infoH: infoH };
    }
    function scrapBackupRects() {
        var y = H - 70;
        return { copy: { x: 24, y: y, w: (W - 60) / 2, h: 48 }, load: { x: 36 + (W - 60) / 2, y: y, w: (W - 60) / 2, h: 48 } };
    }

    // ── Save code backup / restore ──────────────────────────────────────────
    // "LULU1:" + base64(UTF-8 JSON). Lets a player move progress between the
    // website and the app, or a new phone. Restoring asks twice-over.
    var SAVE_CODE_PREFIX = "LULU1:";
    function saveToCode() {
        var json = JSON.stringify(save);
        return SAVE_CODE_PREFIX + btoa(unescape(encodeURIComponent(json)));
    }
    function codeToSave(code) {
        code = String(code || "").replace(/\s+/g, "");
        if (code.indexOf(SAVE_CODE_PREFIX) !== 0) return null;
        try {
            var obj = JSON.parse(decodeURIComponent(escape(atob(code.slice(SAVE_CODE_PREFIX.length)))));
            return (obj && typeof obj === "object" && !Array.isArray(obj) && typeof obj.totalCoins === "number") ? obj : null;
        } catch (e) { return null; }
    }
    function scrapCopyCode() {
        var code = saveToCode();
        var shown = false;
        function fallback() {
            if (shown) return; shown = true;
            try { window.prompt("Your save code — copy it and keep it somewhere safe:", code); } catch (e) {}
        }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(code).then(function () {
                    scrapToast = "📋 Save code copied! Paste it somewhere safe."; scrapToastT = 2.6;
                }, fallback);
                return;
            }
        } catch (e) {}
        fallback();
    }
    function scrapLoadCode() {
        var code = null;
        try { code = window.prompt("Paste a save code (it starts with " + SAVE_CODE_PREFIX + "):", ""); } catch (e) {}
        if (!code) return;
        var obj = codeToSave(code);
        if (!obj) { scrapToast = "🤔 That doesn't look like a save code."; scrapToastT = 2.4; playDeny(); return; }
        var ok = false;
        try {
            ok = window.confirm("Load this save? It REPLACES the progress on this device (" +
                formatNum(save.totalCoins) + " coins → " + formatNum(obj.totalCoins) + " coins).");
        } catch (e) {}
        if (!ok) return;
        try { localStorage.setItem(SAVE_KEY + "_bak", JSON.stringify(save)); } catch (e) {}
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(obj)); } catch (e) {}
        location.reload();
    }

    // ── Update ──────────────────────────────────────────────────────────────
    var scrapPrevL = false, scrapPrevR = false;
    function updateScrapbook(dt) {
        menuBounce += dt;
        scrapT += dt;
        if (scrapToastT > 0) scrapToastT -= dt;
        updateParticles(dt);

        // ← / → flip tabs on a keyboard (edge-triggered).
        if (keys.left && !scrapPrevL) { scrapTab = (scrapTab + 3) % 4; scrapT = 0; scrapSel = null; playClick(); }
        if (keys.right && !scrapPrevR) { scrapTab = (scrapTab + 1) % 4; scrapT = 0; scrapSel = null; playClick(); }
        scrapPrevL = keys.left; scrapPrevR = keys.right;

        if (consumePause()) { state = "menu"; playClick(); return; }
        var click = consumeClick();
        consumeAction();
        if (!click) return;

        if (pointInRect(click.x, click.y, 16, 14, 80, 44)) { state = "menu"; playClick(); return; }
        for (var t = 0; t < 4; t++) {
            var r = scrapTabRect(t);
            if (pointInRect(click.x, click.y, r.x, r.y, r.w, r.h)) {
                if (scrapTab !== t) { scrapTab = t; scrapT = 0; scrapSel = null; playClick(); }
                return;
            }
        }
        if (scrapTab === 0) {
            var lay = scrapBadgeLayout();
            for (var i = 0; i < lay.cells.length; i++) {
                var c = lay.cells[i];
                if (pointInRect(click.x, click.y, c.x, c.y, c.w, c.h)) { scrapSel = c.b.id; playClick(); return; }
            }
        } else if (scrapTab === 3) {
            var br = scrapBackupRects();
            if (pointInRect(click.x, click.y, br.copy.x, br.copy.y, br.copy.w, br.copy.h)) { playClick(); scrapCopyCode(); return; }
            if (pointInRect(click.x, click.y, br.load.x, br.load.y, br.load.w, br.load.h)) { playClick(); scrapLoadCode(); return; }
        }
    }

    // ── Draw ────────────────────────────────────────────────────────────────
    function drawScrapbook() {
        // Kraft-paper scrapbook page with faint ruled lines.
        var bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, "#C8A97E"); bg.addColorStop(1, "#A07E55");
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(90,60,30,0.10)"; ctx.lineWidth = 1;
        for (var ly = 150; ly < H; ly += 28) { ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke(); }
        // spiral binding dots down the left edge
        ctx.fillStyle = "rgba(60,40,20,0.28)";
        for (var sy = 170; sy < H - 20; sy += 34) { ctx.beginPath(); ctx.arc(6, sy, 3, 0, Math.PI * 2); ctx.fill(); }

        drawBackButton(16, 14);
        drawText("📒 LULU'S SCRAPBOOK", W / 2 + 34, 38, "bold 24px 'Segoe UI', Arial, sans-serif", "#FFF8E1", "#4E342E", 5);
        var tots = badgeTotals();
        drawText("🏆 " + tots.got + " / " + tots.tot + " badges", W / 2 + 34, 70, "bold 15px 'Segoe UI', Arial, sans-serif", "#FFE082", "#4E342E", 3);

        for (var t = 0; t < 4; t++) {
            var r = scrapTabRect(t), on = scrapTab === t;
            ctx.fillStyle = on ? "#FFF8E1" : "rgba(78,52,46,0.55)";
            roundRect(r.x, r.y, r.w, r.h, 9); ctx.fill();
            if (on) { ctx.strokeStyle = "#8D6E63"; ctx.lineWidth = 2; roundRect(r.x, r.y, r.w, r.h, 9); ctx.stroke(); }
            drawText(SCRAP_TABS[t][0] + " " + SCRAP_TABS[t][1], r.x + r.w / 2, r.y + r.h / 2,
                "bold 15px 'Segoe UI', Arial, sans-serif", on ? "#4E342E" : "#FFF8E1", null, 0);
        }

        var pop = easeOutBack(clamp(scrapT / 0.3, 0, 1));
        ctx.save();
        ctx.globalAlpha = clamp(scrapT / 0.15, 0, 1);
        ctx.translate(0, (1 - pop) * 18);
        if (scrapTab === 0) drawScrapBadges();
        else if (scrapTab === 1) drawScrapRecord();
        else if (scrapTab === 2) drawScrapCrew();
        else drawScrapStats();
        ctx.restore();

        drawParticles();
        if (scrapToastT > 0) {
            ctx.globalAlpha = clamp(scrapToastT, 0, 1);
            ctx.fillStyle = "rgba(0,0,0,0.82)";
            roundRect(24, H - 140, W - 48, 44, 10); ctx.fill();
            drawText(scrapToast, W / 2, H - 118, "bold 15px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 2);
            ctx.globalAlpha = 1;
        }
    }

    // A taped-on paper card.
    function scrapCard(x, y, w, h, tint) {
        ctx.fillStyle = "rgba(60,40,20,0.25)"; roundRect(x + 3, y + 4, w, h, 10); ctx.fill();
        ctx.fillStyle = tint || "#FFFDF5"; roundRect(x, y, w, h, 10); ctx.fill();
        ctx.strokeStyle = "rgba(120,90,60,0.45)"; ctx.lineWidth = 1.5; roundRect(x, y, w, h, 10); ctx.stroke();
        ctx.fillStyle = "rgba(255,241,118,0.55)";   // washi tape
        ctx.save(); ctx.translate(x + w / 2, y); ctx.rotate(-0.04);
        ctx.fillRect(-34, -8, 68, 16); ctx.restore();
    }

    function drawScrapBadges() {
        var lay = scrapBadgeLayout();
        for (var i = 0; i < lay.cells.length; i++) {
            var c = lay.cells[i], b = c.b, got = badgeEarned(b);
            var cx = c.x + c.w / 2, r = Math.min(26, c.h * 0.32), cy = c.y + r + 6;
            var sel = scrapSel === b.id;
            ctx.save();
            if (sel) {
                ctx.fillStyle = "rgba(255,248,225,0.6)";
                roundRect(c.x + 3, c.y + 1, c.w - 6, c.h - 2, 10); ctx.fill();
            }
            // medal: gold ribbon disc when earned, dashed pencil outline when not
            ctx.fillStyle = got ? "#FFD54F" : "rgba(78,52,46,0.18)";
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = got ? 3 : 2;
            ctx.strokeStyle = got ? "#E65100" : "rgba(78,52,46,0.55)";
            if (!got) ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = got ? 1 : 0.35;
            drawText(b.icon, cx, cy + 1, Math.round(r * 1.1) + "px Arial", "#FFF", null, 0);
            ctx.globalAlpha = 1;
            drawText(b.name, cx, Math.min(c.y + c.h - 8, cy + r + 13), "bold 12px 'Segoe UI', Arial, sans-serif",
                got ? "#3E2723" : "rgba(62,39,35,0.6)", null, 0);
            ctx.restore();
        }
        // Info panel for the selected (or first unearned) badge.
        var pick = null, list = visibleBadges();
        for (var j = 0; j < list.length && !pick; j++) if (list[j].id === scrapSel) pick = list[j];
        for (var k = 0; k < list.length && !pick; k++) if (!badgeEarned(list[k])) pick = list[k];
        if (!pick) pick = list[0];
        var y = Math.min(lay.infoY, H - lay.infoH - 8);
        scrapCard(16, y, W - 32, lay.infoH);
        var got2 = badgeEarned(pick);
        drawText(pick.icon + " " + pick.name + (got2 ? "  ✓" : ""), W / 2, y + 24, "bold 18px 'Segoe UI', Arial, sans-serif",
            got2 ? "#2E7D32" : "#4E342E", null, 0);
        drawText(pick.desc, W / 2, y + 48, "15px 'Segoe UI', Arial, sans-serif", "#5D4037", null, 0);
        if (!got2 && pick.prog) {
            var p = pick.prog(), frac = clamp(p[0] / p[1], 0, 1);
            var bx = 60, bw = W - 120, by = y + 62;
            ctx.fillStyle = "rgba(78,52,46,0.18)"; roundRect(bx, by, bw, 14, 7); ctx.fill();
            if (frac > 0) { ctx.fillStyle = "#FFB300"; roundRect(bx, by, Math.max(14, bw * frac), 14, 7); ctx.fill(); }
            drawText(formatNum(Math.min(p[0], p[1])) + " / " + formatNum(p[1]), W / 2, by + 7, "bold 11px 'Segoe UI', Arial, sans-serif", "#3E2723", "#FFF8E1", 2);
        } else if (!got2) {
            drawText("tap a badge to see what it takes", W / 2, y + 70, "italic 13px 'Segoe UI', Arial, sans-serif", "#8D6E63", null, 0);
        }
    }

    function scrapStatusLine() {
        var c = save.convictions || 0;
        if (c === 0 && !(save.offenses || 0)) return ["MODEL CITIZEN", "#2E7D32"];
        if (c === 0) return ["KNOWN TO POLICE", "#EF6C00"];
        if (c < 3) return ["REPEAT OFFENDER", "#D84315"];
        return ["PUBLIC ENEMY #1", "#B71C1C"];
    }

    function drawScrapRecord() {
        // ── Rap sheet (police file) ──
        var x = 16, y = 160, w = W - 32, h = 268;
        scrapCard(x, y, w, h, "#F3EBD3");
        drawText("CITY POLICE · RAP SHEET", x + w / 2, y + 22, "bold 15px 'Courier New', monospace", "#5D4037", null, 0);
        // mugshot: Lulu in stripes against height lines
        var mx = x + 74, my = y + 112;
        ctx.fillStyle = "#CFD8DC"; ctx.fillRect(mx - 56, my - 70, 112, 132);
        ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 1;
        for (var hl = 0; hl < 6; hl++) { var hy = my - 60 + hl * 22; ctx.beginPath(); ctx.moveTo(mx - 56, hy); ctx.lineTo(mx + 56, hy); ctx.stroke(); }
        ctx.save(); ctx.beginPath(); ctx.rect(mx - 56, my - 70, 112, 132); ctx.clip();
        drawPortrait("lulu", mx, my + 6, 100, false);
        ctx.restore();
        ctx.fillStyle = "#263238"; ctx.fillRect(mx - 46, my + 40, 92, 20);
        drawText("BRUCK, L.", mx, my + 50, "bold 12px 'Courier New', monospace", "#FFF", null, 0);
        // file lines
        var lx = x + 150, rows = [
            ["Times booked", save.offenses || 0],
            ["Convictions", save.convictions || 0],
            ["Cases dismissed", stat("dismissed")],
            ["Jailbreaks", save.escapes || 0],
            ["Cop chases escaped", stat("escapes2")]
        ];
        for (var i = 0; i < rows.length; i++) {
            var ry = y + 56 + i * 28;
            drawText(rows[i][0], lx, ry, "15px 'Segoe UI', Arial, sans-serif", "#5D4037", null, 0, "left");
            drawText(String(rows[i][1]), x + w - 18, ry, "bold 17px 'Segoe UI', Arial, sans-serif", "#3E2723", null, 0, "right");
        }
        var st = scrapStatusLine();
        ctx.save(); ctx.translate(lx + (x + w - 18 - lx) / 2, y + 206); ctx.rotate(-0.06);
        ctx.strokeStyle = st[1]; ctx.lineWidth = 3; roundRect(-96, -16, 192, 32, 6); ctx.stroke();
        drawText(st[0], 0, 1, "bold 16px 'Courier New', monospace", st[1], null, 0);
        ctx.restore();
        var w8 = save.wanted || [];
        drawText(w8.length ? "⚠ OPEN WARRANTS: " + w8.slice(0, 2).join(", ") + (w8.length > 2 ? " +" + (w8.length - 2) : "")
                           : "No open warrants. For now. 😇",
            x + w / 2, y + h - 18, "bold 12px 'Segoe UI', Arial, sans-serif", w8.length ? "#B71C1C" : "#5D4037", null, 0);

        // ── ER punch card ──
        var py = y + h + 18, ph = Math.min(190, H - py - 16);
        if (ph < 120) return;
        scrapCard(x, py, w, ph, "#E3F2FD");
        drawPortrait("doctor", x + 50, py + 64, 70, false);
        drawText("🏥 ER FREQUENT FLYER CARD", x + 96, py + 26, "bold 15px 'Segoe UI', Arial, sans-serif", "#0D47A1", null, 0, "left");
        var er = save.erVisits || 0, punched = er % 10, lolli = Math.floor(er / 10);
        for (var p = 0; p < 10; p++) {
            var px = x + 110 + (p % 5) * 52, pyy = py + 62 + Math.floor(p / 5) * 40;
            ctx.strokeStyle = "#1565C0"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(px, pyy, 14, 0, Math.PI * 2); ctx.stroke();
            if (p < punched) {
                ctx.fillStyle = "#1565C0"; ctx.beginPath(); ctx.arc(px, pyy, 9, 0, Math.PI * 2); ctx.fill();
            } else if (p === 9) drawText("🍭", px, pyy + 1, "16px Arial", "#000", null, 0);
        }
        drawText(er + " visit" + (er === 1 ? "" : "s") + " · every 10th earns a lollipop" + (lolli ? " · 🍭×" + lolli : ""),
            x + w / 2, py + ph - 20, "bold 13px 'Segoe UI', Arial, sans-serif", "#0D47A1", null, 0);
    }

    function drawScrapCrew() {
        var x = 16, w = W - 32;
        // ── Avigail friendship meter ──
        var y = 160, h = 196;
        scrapCard(x, y, w, h, "#F3E5F5");
        drawPortrait("avigail", x + 62, y + 84, 92, false);
        drawText("AVIGAIL", x + 62, y + 160, "bold 15px 'Segoe UI', Arial, sans-serif", "#6A1B9A", null, 0);
        var rel = avigailRel();
        var lbl = rel <= 20 ? "😈 Sworn Nemesis" : rel <= 40 ? "😒 Rivals" : rel <= 60 ? "😏 Frenemies" : rel <= 80 ? "😊 Friends" : "💜 Besties";
        var gx = x + 130, gw = w - 150, gy = y + 66;
        drawText(lbl, gx + gw / 2, y + 36, "bold 20px 'Segoe UI', Arial, sans-serif", "#4A148C", null, 0);
        var gg = ctx.createLinearGradient(gx, 0, gx + gw, 0);
        gg.addColorStop(0, "#E53935"); gg.addColorStop(0.5, "#FFB300"); gg.addColorStop(1, "#AB47BC");
        ctx.fillStyle = gg; roundRect(gx, gy, gw, 20, 10); ctx.fill();
        ctx.strokeStyle = "#4A148C"; ctx.lineWidth = 2; roundRect(gx, gy, gw, 20, 10); ctx.stroke();
        var mk = gx + gw * clamp(rel / 100, 0, 1);
        ctx.fillStyle = "#FFF"; ctx.strokeStyle = "#4A148C"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(mk, gy + 10, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        drawText(String(Math.round(rel)), mk, gy + 11, "bold 12px Arial", "#4A148C", null, 0);
        drawText("nemesis", gx, gy + 36, "12px 'Segoe UI', Arial, sans-serif", "#7B1FA2", null, 0, "left");
        drawText("bestie", gx + gw, gy + 36, "12px 'Segoe UI', Arial, sans-serif", "#7B1FA2", null, 0, "right");
        drawText("Road trips together: " + stat("avigail3"), gx, gy + 70, "15px 'Segoe UI', Arial, sans-serif", "#4A148C", null, 0, "left");
        drawText("Weddings danced at: " + stat("weddings"), gx, gy + 96, "15px 'Segoe UI', Arial, sans-serif", "#4A148C", null, 0, "left");

        // ── Family run-ins ──
        var fy = y + h + 18, fh = Math.min(260, H - fy - 16);
        if (fh < 140) return;
        scrapCard(x, fy, w, fh, "#FFF3E0");
        drawText("👪 FAMILY RUN-INS", x + w / 2, fy + 26, "bold 16px 'Segoe UI', Arial, sans-serif", "#BF360C", null, 0);
        var fam = [
            ["bubbe", "Bubbe", "postcards", (save.postcards || []).length + " / 5 postcards"],
            ["burry", "The uncles", "", stat("uncles3") + " run-ins"],
            ["heshy", "Heshy", "", stat("heshy2") + " pool finds"]
        ];
        var colW = w / 3;
        for (var i = 0; i < fam.length; i++) {
            var cx = x + colW * i + colW / 2;
            if (fam[i][0] === "heshy") drawText("🏊", cx, fy + 92, "54px Arial", "#000", null, 0);
            else drawPortrait(fam[i][0], cx, fy + 92, 76, false);
            drawText(fam[i][1], cx, fy + 150, "bold 15px 'Segoe UI', Arial, sans-serif", "#4E342E", null, 0);
            drawText(fam[i][3], cx, fy + 172, "14px 'Segoe UI', Arial, sans-serif", "#6D4C41", null, 0);
        }
        if (fh >= 230) {
            var tours = save.storyCycle || 0;
            drawText(tours ? "🎲 Road to Vegas finished " + tours + "×" : "🎲 Vegas is still out there…",
                x + w / 2, fy + fh - 26, "bold 14px 'Segoe UI', Arial, sans-serif", "#BF360C", null, 0);
        }
    }

    function drawScrapStats() {
        var x = 16, y = 160, w = W - 32;
        var br = scrapBackupRects();
        var rows = [
            ["🏁 Best run", formatNum(save.highScore || 0)],
            ["🧮 Lifetime score", formatNum(save.lifetimeScore || 0)],
            ["🛣️ Longest drive", formatNum(statB("dist25k"))],
            ["🪙 Most coins in a run", formatNum(statB("runCoins250"))],
            ["😤 Longest close-call chain", formatNum(statB("chain6"))],
            ["📅 Day streak", formatNum(save.streak || 0)],
            ["🗺️ Most stops in one trip", formatNum(save.tripBest || 0)],
            ["🏎️ Cars owned", (save.ownedSkins || []).length + " / " + skinCount()],
            ["📣 Honk scares", formatNum(stat("honks10"))],
            ["🚀 Cars missiled", formatNum(stat("missiles8"))],
            ["🅿️ Pull-over parks", formatNum(stat("parks3"))],
            ["🎫 Toll booths", formatNum(stat("tolls4"))],
            ["🚶 Distance walked", formatNum(stat("footDist"))]
        ];
        var avail = br.copy.y - 40 - y;
        var rowH = Math.min(30, Math.floor((avail - 16) / rows.length));
        var h = rows.length * rowH + 16;
        scrapCard(x, y, w, h);
        for (var i = 0; i < rows.length; i++) {
            var ry = y + 8 + i * rowH + rowH / 2;
            if (i % 2) { ctx.fillStyle = "rgba(141,110,99,0.08)"; ctx.fillRect(x + 6, ry - rowH / 2, w - 12, rowH); }
            drawText(rows[i][0], x + 16, ry, "15px 'Segoe UI', Arial, sans-serif", "#4E342E", null, 0, "left");
            drawText(rows[i][1], x + w - 16, ry, "bold 16px 'Segoe UI', Arial, sans-serif", "#3E2723", null, 0, "right");
        }
        drawText("💾 Moving to a new phone? Back up your progress:", W / 2, br.copy.y - 18,
            "bold 13px 'Segoe UI', Arial, sans-serif", "#FFF8E1", "#4E342E", 3);
        drawButton(br.copy.x, br.copy.y, br.copy.w, br.copy.h, "📋 COPY CODE", { bg: "#66BB6A", bgDark: "#2E7D32", small: true });
        drawButton(br.load.x, br.load.y, br.load.w, br.load.h, "📥 LOAD CODE", { bg: "#90A4AE", bgDark: "#455A64", small: true });
    }
