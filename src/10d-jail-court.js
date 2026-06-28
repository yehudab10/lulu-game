    // ════════════════════════════════════════════════════════════
    //  JAIL → COURTROOM → ESCAPE → FUGITIVE
    //  When a bribe flops or Lulu wrecks a cruiser she gets booked. She
    //  cools her heels in a cell (with a chatty cellmate), then either faces
    //  a judge (pick a defense → random funny verdict: dismissed / fine /
    //  more time) OR pulls a sneaky jailbreak and hits the road in stripes —
    //  where WANTED posters go up and any cop who spots her hauls her back in.
    // ════════════════════════════════════════════════════════════

    var jail = null;            // { charges, phase, t, cellmateLine, cellmateT }
    var court = null;           // { charges, phase, t, options, choice, verdict, fine, applied }
    var prisonClothes = false;  // true while she's an escaped fugitive on the road
    var fugitiveT = 0;          // time on the lam (auto-ditches the jumpsuit after a while)
    var fugitiveSpot = 0;       // a cop's "is that...?" recognition meter
    var wantedPosterT = 0;      // cadence for WANTED billboards

    // ── Content pools ────────────────────────────────────────
    var CELLMATE_LINES = ["What're you in for? 😏", "I'm INNOCENT. ...mostly.",
        "Psst — wanna dig a tunnel?", "The food here is a CRIME too.", "Third time this week!",
        "You got a good lawyer?", "I just jaywalked, I SWEAR.", "They never proved nothin'.",
        "Snitches get... extra pudding.", "First timer, huh? Cute.", "Don't drop the kugel."];
    var LULU_CELL_LINES = ["Bubbe is gonna PLOTZ.", "This jumpsuit is NOT my color.",
        "I get ONE phone call, right?", "I was barely speeding!", "Avigail set me up, I KNOW it.",
        "Is there a kosher option?", "I demand to see a JUDGE.", "These bars clash with everything."];
    var ESCAPE_METHODS = [
        "You fake a fainting spell — the guard panics and you SLIP right out. 🏃",
        "Bedsheet rope out the window. Bubbe taught you to knot. 🪢",
        "You stroll out behind the lunch cart like you BELONG there. 🛒",
        "The guard's asleep. You lift his keys with a hairpin. 🗝️",
        "You trade a cellmate two puddings for a guard uniform. 👮"];
    var EXTRA_CHARGES = ["UNPAID PARKING (47 TICKETS)", "IMPERSONATING A NICE LADY",
        "EXCESSIVE SASS", "JAYWALKING WITH INTENT", "POSSESSION OF RUGELACH",
        "DISTURBING THE PEACE (LOUDLY)", "DRIVING WHILE FABULOUS"];
    var PROSECUTOR_LINES = ["The defendant is a MENACE, your honor!", "We have her DEAD to rights!",
        "Throw the BOOK at her!", "She showed NO remorse — only sass!", "The people DEMAND justice!",
        "I've never seen a clearer case!", "Lock her up and lose the key!"];
    var JUDGE_INTROS = ["Order! ORDER in my court!", "This better be good...", "I haven't had my coffee.",
        "Let's make this quick, I tee off at noon.", "What fresh nonsense is THIS?"];

    // Each defense is a gamble — weighted outcomes [outcome, weight].
    var DEFENSE_POOL = [
        { label: "🥺 Plead & cry", says: "Your honor, it's been SUCH a hard week... 😭",
          outcomes: [["dismissed", 0.45], ["fine", 0.40], ["jail", 0.15]] },
        { label: "💸 'Tip' the judge", says: "*slides an envelope* For your robe fund 💵",
          outcomes: [["dismissed", 0.55], ["fine", 0.20], ["jail", 0.25]], bribe: true },
        { label: "🤬 Blame Avigail", says: "AVIGAIL dared me to, your honor!",
          outcomes: [["dismissed", 0.30], ["fine", 0.50], ["jail", 0.20]] },
        { label: "🧠 Plead insanity", says: "I'm not crazy — the ROAD is! 🌀",
          outcomes: [["dismissed", 0.35], ["fine", 0.35], ["jail", 0.30]] },
        { label: "👵 Invoke Bubbe", says: "My Bubbe makes the JUDGE'S favorite cholent!",
          outcomes: [["dismissed", 0.50], ["fine", 0.40], ["jail", 0.10]] },
        { label: "😇 'I'm a good girl'", says: "Me? I've never even SPED, officer— judge!",
          outcomes: [["dismissed", 0.40], ["fine", 0.45], ["jail", 0.15]] }
    ];

    // ── Entry: book her on these charges ─────────────────────
    function goToJail(charges) {
        // sometimes a bonus absurd charge gets tacked on
        var list = (charges && charges.length ? charges.slice() : ["DISTURBING THE PEACE"]);
        if (Math.random() < 0.5) list.push(randPick(EXTRA_CHARGES));
        list = list.filter(function (c, i) { return list.indexOf(c) === i; });  // no dupes
        jail = { charges: list, phase: 0, t: 0, cellmateLine: randPick(CELLMATE_LINES),
                 cellmateT: 2.6, luluLine: randPick(LULU_CELL_LINES), luluT: 4.0,
                 escapeMethod: "", flash: 0.3 };
        copChase = null; copBust = null; copStop = null;
        if (typeof playWompWomp === "function") playWompWomp();
        playTone(110, 0.5, "square", 0.12);                 // CLANG — cell door
        setTimeout(function () { playTone(80, 0.4, "square", 0.12); }, 220);
        state = "jailCell";
    }

    // ── Button rects (deterministic — shared by update + draw) ──
    function cellEscapeRect() { return { x: W / 2 - 150, y: H - 132, w: 140, h: 52 }; }
    function cellCourtRect() { return { x: W / 2 + 10, y: H - 132, w: 140, h: 52 }; }
    function courtOptRect(i) { return { x: W / 2 - 150, y: H - 168 + i * 50, w: 300, h: 44 }; }

    // ════════════════ JAIL CELL ════════════════
    function updateJailCell(dt) {
        if (jail.flash > 0) jail.flash -= dt;
        jail.t += dt;
        jail.cellmateT -= dt; jail.luluT -= dt;
        if (jail.cellmateT <= 0) { jail.cellmateLine = randPick(CELLMATE_LINES); jail.cellmateT = rand(3.5, 6); }
        if (jail.luluT <= 0) { jail.luluLine = randPick(LULU_CELL_LINES); jail.luluT = rand(4, 7); }

        if (jail.phase === 0) {                 // door just slammed
            if (jail.t > 1.1) { jail.phase = 1; jail.t = 0; }
            return;
        }
        if (jail.phase === 1) {                 // waiting — escape or face the judge
            var click = consumeClick();
            if (click) {
                var er = cellEscapeRect(), cr = cellCourtRect();
                if (pointInRect(click.x, click.y, er.x, er.y, er.w, er.h)) {
                    jail.phase = 2; jail.t = 0; jail.escapeMethod = randPick(ESCAPE_METHODS);
                    playTone(440, 0.08, "square", 0.1); playTone(660, 0.1, "square", 0.1);
                    return;
                }
                if (pointInRect(click.x, click.y, cr.x, cr.y, cr.w, cr.h)) {
                    openCourt(jail.charges); return;
                }
            }
            // dawdle too long → they drag her to court anyway
            if (jail.t > 16) { openCourt(jail.charges); return; }
            return;
        }
        if (jail.phase === 2) {                 // jailbreak in progress
            if (jail.t > 2.6) {
                prisonClothes = true; fugitiveT = 0; fugitiveSpot = 0; wantedPosterT = 1.5;
                jail = null;
                if (typeof returnToDriving === "function") returnToDriving();
                spawnFloater(player.x, player.y - 50, "🏃 JAILBREAK!", "#FFD54F");
                spawnFloater(player.x, player.y - 28, "Cops will RECOGNIZE you...", "#FF8A80");
                return;
            }
        }
    }

    function drawJailCell() {
        // dim brick cell
        ctx.fillStyle = "#2A2622"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#352F29";
        for (var by = 0; by < H; by += 26) {
            for (var bx = ((Math.floor(by / 26) % 2) ? -20 : 0); bx < W; bx += 54) {
                roundRect(bx + 2, by + 2, 50, 22, 2); ctx.fill();
            }
        }
        // barred moonlit window
        ctx.fillStyle = "#16243A"; roundRect(W / 2 - 44, 40, 88, 60, 6); ctx.fill();
        ctx.fillStyle = "#FFF8E1"; ctx.beginPath(); ctx.arc(W / 2 + 14, 64, 13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#16243A"; ctx.beginPath(); ctx.arc(W / 2 + 19, 60, 11, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#5A5048"; ctx.lineWidth = 4;
        for (var wb = 0; wb < 3; wb++) {
            ctx.beginPath(); ctx.moveTo(W / 2 - 30 + wb * 30, 40); ctx.lineTo(W / 2 - 30 + wb * 30, 100); ctx.stroke();
        }

        // cellmate (a grumbling fellow inmate) on the left, Lulu on the right
        drawPrisoner(W * 0.30, H * 0.56, gameTime, "mate");
        drawPrisoner(W * 0.66, H * 0.58, gameTime, "lulu");

        // foreground bars
        ctx.fillStyle = "#3A3A3E";
        for (var i = 0; i <= 6; i++) { ctx.fillRect((W / 6) * i - 5, 120, 10, H - 120); }
        ctx.fillRect(0, 118, W, 10);
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        for (var j = 0; j <= 6; j++) { ctx.fillRect((W / 6) * j - 5, 120, 3, H - 120); }

        // speech bubbles float in FRONT of the bars
        if (jail.phase >= 1) {
            if (jail.cellmateT > 0.3) drawSpeechBubble(W * 0.30, H * 0.56 - 44, jail.cellmateLine, gameTime);
            else if (jail.luluT > 0.3) drawSpeechBubble(W * 0.66, H * 0.58 - 46, jail.luluLine, gameTime + 1);
        }

        // arrival flash + charge sheet
        if (jail.flash > 0) { ctx.fillStyle = "rgba(255,255,255," + (jail.flash / 0.3 * 0.5) + ")"; ctx.fillRect(0, 0, W, H); }
        drawText("🚔 BOOKED!", W / 2, 28, "bold 30px 'Segoe UI', Arial, sans-serif", "#FF7043", "#000", 6);
        var cy = 112;
        ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(W / 2 - 150, cy, 300, 18 + jail.charges.length * 16, 8); ctx.fill();
        drawText("CHARGES:", W / 2, cy + 12, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 2);
        for (var c = 0; c < jail.charges.length; c++) {
            drawText("• " + jail.charges[c], W / 2, cy + 28 + c * 16, "bold 11px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2);
        }

        if (jail.phase === 1) {
            var er = cellEscapeRect(), cr = cellCourtRect();
            var glow = Math.sin(gameTime * 6) > 0;
            drawButton(er.x, er.y, er.w, er.h, "🏃 ESCAPE", { bg: glow ? "#66BB6A" : "#4CAF50", bgDark: "#2E7D32" });
            drawButton(cr.x, cr.y, cr.w, cr.h, "⚖️ COURT", { bg: "#42A5F5", bgDark: "#0D47A1" });
            drawText("...or wait for your hearing", W / 2, H - 64,
                "italic 11px 'Segoe UI', Arial, sans-serif", "#BCAAA4", "#000", 2);
        }
        if (jail.phase === 2) {
            ctx.fillStyle = "rgba(0,0,0,0.7)"; roundRect(W / 2 - 160, H * 0.4, 320, 92, 12); ctx.fill();
            drawText("🏃 JAILBREAK!", W / 2, H * 0.4 + 26, "bold 22px 'Segoe UI', Arial, sans-serif", "#7CFC4F", "#000", 5);
            wrapText(jail.escapeMethod, W / 2, H * 0.4 + 52, 300, 15, "#FFF");
        }
    }

    // ════════════════ COURTROOM ════════════════
    function openCourt(charges) {
        // pick 3 distinct defenses to offer
        var pool = DEFENSE_POOL.slice();
        var opts = [];
        for (var k = 0; k < 3 && pool.length; k++) opts.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
        court = { charges: (charges && charges.length ? charges.slice() : ["BEING SUSPICIOUS"]),
                  phase: 0, t: 0, options: opts, choice: -1, verdict: null, fine: 0,
                  applied: false, prosLine: randPick(PROSECUTOR_LINES), judgeLine: randPick(JUDGE_INTROS),
                  gavel: 0 };
        jail = null;
        state = "courtroom";
        playTone(523, 0.12, "triangle", 0.16);
    }

    function rollVerdict(opt) {
        var r = Math.random(), acc = 0;
        for (var i = 0; i < opt.outcomes.length; i++) { acc += opt.outcomes[i][1]; if (r <= acc) return opt.outcomes[i][0]; }
        return "fine";
    }

    function updateCourtroom(dt) {
        court.t += dt;
        if (court.gavel > 0) court.gavel -= dt;

        if (court.phase === 0) {                // ALL RISE → gavel
            if (court.t > 1.4) { court.phase = 1; court.t = 0; court.gavel = 0.3; playTone(150, 0.12, "square", 0.18); }
            return;
        }
        if (court.phase === 1) {                // prosecutor reads charges
            if (consumeClick() || consumeAction() || court.t > 3.2) { court.phase = 2; court.t = 0; }
            return;
        }
        if (court.phase === 2) {                // Lulu picks a defense
            var click = consumeClick();
            if (click) {
                for (var i = 0; i < court.options.length; i++) {
                    var r = courtOptRect(i);
                    if (pointInRect(click.x, click.y, r.x, r.y, r.w, r.h)) {
                        court.choice = i; court.phase = 3; court.t = 0;
                        playTone(660, 0.06, "sine", 0.1);
                        return;
                    }
                }
            }
            return;
        }
        if (court.phase === 3) {                // jury deliberates → verdict
            if (court.t > 1.8) {
                var opt = court.options[court.choice];
                court.verdict = rollVerdict(opt);
                // bribing-the-judge that BACKFIRES adds a juicy charge + heavier fine
                if (opt.bribe && court.verdict !== "dismissed") {
                    court.charges.push("BRIBING A JUDGE (BADLY)");
                }
                if (court.verdict === "fine" || court.verdict === "jail") {
                    var base = court.charges.length * randInt(12, 30);
                    if (opt.bribe && court.verdict !== "dismissed") base += 40;
                    court.fine = base;
                }
                court.phase = 4; court.t = 0; court.gavel = 0.3;
                playTone(150, 0.14, "square", 0.18);
                playTone(court.verdict === "dismissed" ? 880 : 200, 0.2, "triangle", 0.16);
                return;
            }
            return;
        }
        if (court.phase === 4) {                // verdict lands → consequences → released
            if (!court.applied) {
                court.applied = true;
                if (court.verdict === "fine" || court.verdict === "jail") {
                    var pay = Math.min(court.fine, save.totalCoins);
                    save.totalCoins -= pay; persistSave();
                    court.paid = pay; court.couldntAfford = pay < court.fine;
                }
            }
            if (court.t > 2.6 || consumeClick() || consumeAction()) {
                var v = court.verdict;
                court = null;
                prisonClothes = false;              // served / paid → normal clothes back
                if (typeof returnToDriving === "function") returnToDriving();
                if (v === "dismissed") spawnFloater(player.x, player.y - 50, "⚖️ CASE DISMISSED!", "#7CFC4F");
                else spawnFloater(player.x, player.y - 50, "Released. Drive safe(r). 🚗", "#FFE082");
                return;
            }
        }
    }

    function drawCourtroom() {
        // panelled-wood courtroom
        ctx.fillStyle = "#6D4C41"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#5D4037";
        for (var p = 0; p < W; p += 40) ctx.fillRect(p, 0, 3, H);
        // back wall seal + flags
        ctx.fillStyle = "#4E342E"; roundRect(W / 2 - 40, 24, 80, 52, 8); ctx.fill();
        ctx.fillStyle = "#FFD54F"; ctx.beginPath(); ctx.arc(W / 2, 50, 17, 0, Math.PI * 2); ctx.fill();
        drawText("⚖️", W / 2, 52, "20px Arial", "#5D4037", null, 0);

        // judge's bench (raised)
        ctx.fillStyle = "#3E2723"; roundRect(W / 2 - 90, 86, 180, 56, 6); ctx.fill();
        ctx.fillStyle = "#4E342E"; roundRect(W / 2 - 84, 92, 168, 16, 3); ctx.fill();
        drawJudge(W / 2, 96, court.gavel > 0);
        // gavel bang stars
        if (court.gavel > 0) drawText("BANG!", W / 2 + 60, 96, "bold 14px Arial", "#FFD54F", "#000", 3);

        // jury box (left) — a row of little heads
        ctx.fillStyle = "#4E342E"; roundRect(8, 150, 96, 66, 6); ctx.fill();
        for (var jr = 0; jr < 6; jr++) {
            var jx = 22 + (jr % 3) * 30, jy = 168 + Math.floor(jr / 3) * 30;
            ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(jx, jy, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = ["#F4C9A0", "#E8B98A", "#D9A875"][jr % 3];
            ctx.beginPath(); ctx.arc(jx, jy, 7, 0, Math.PI * 2); ctx.fill();
            // blinking/judging eyes
            ctx.fillStyle = "#1A1A1A";
            ctx.beginPath(); ctx.arc(jx - 2.5, jy - 1, 1.1, 0, Math.PI * 2); ctx.arc(jx + 2.5, jy - 1, 1.1, 0, Math.PI * 2); ctx.fill();
        }
        drawText("JURY", 56, 226, "bold 9px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 2);

        // prosecutor (right) — pointing accusingly
        drawAngryMan(W - 60, H * 0.46, gameTime, court.phase === 1 ? "yelling" : "talk", -1, false);
        // Lulu at the defendant's podium (centre-low), in stripes if she's still booked
        ctx.fillStyle = "#4E342E"; roundRect(W / 2 - 36, H * 0.52, 72, 40, 5); ctx.fill();
        drawPrisoner(W / 2, H * 0.5, gameTime, "lulu");

        // charge sheet (top-left)
        var cy = 150;
        ctx.fillStyle = "rgba(0,0,0,0.5)"; roundRect(W - 168, cy, 160, 20 + court.charges.length * 15, 6); ctx.fill();
        drawText("CHARGES", W - 88, cy + 12, "bold 11px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 2);
        for (var c = 0; c < court.charges.length; c++) {
            drawText("• " + court.charges[c], W - 88, cy + 27 + c * 15, "bold 9px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2);
        }

        // phase-specific overlays
        if (court.phase === 0) {
            ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, 0, W, H);
            drawText("ALL RISE! 🧑‍⚖️", W / 2, H / 2, "bold 30px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 6);
            drawText(court.judgeLine, W / 2, H / 2 + 34, "italic 14px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 3);
        } else if (court.phase === 1) {
            drawSpeechBubble(W - 60, H * 0.46 - 40, court.prosLine, gameTime);
            drawText("tap ▸", W / 2, H - 24, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2);
        } else if (court.phase === 2) {
            drawText("How do you plead, Ms. Bruck?", W / 2, H - 196,
                "bold 14px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 4);
            for (var i = 0; i < court.options.length; i++) {
                var r = courtOptRect(i);
                drawButton(r.x, r.y, r.w, r.h, court.options[i].label, { bg: "#7E57C2", bgDark: "#4527A0", small: true });
            }
        } else if (court.phase === 3) {
            drawSpeechBubble(W / 2, H * 0.5 - 50, court.options[court.choice].says, gameTime);
            ctx.fillStyle = "rgba(0,0,0,0.45)"; roundRect(W / 2 - 130, H - 70, 260, 30, 8); ctx.fill();
            var dots = ".".repeat(1 + (Math.floor(court.t * 3) % 3));
            drawText("The jury deliberates" + dots, W / 2, H - 55, "bold 14px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 3);
        } else if (court.phase === 4) {
            var col = court.verdict === "dismissed" ? "#7CFC4F" : court.verdict === "jail" ? "#FF5252" : "#FFB300";
            var title = court.verdict === "dismissed" ? "CASE DISMISSED! 🎉"
                      : court.verdict === "jail" ? "GUILTY — 30 DAYS! ⛓️" : "GUILTY — FINE! 💸";
            ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, H / 2 - 60, W, 120);
            var pop = 1 + Math.max(0, 0.35 - court.t) * 1.3;
            ctx.save(); ctx.translate(W / 2, H / 2 - 14); ctx.scale(pop, pop);
            drawText(title, 0, 0, "bold 26px 'Segoe UI', Arial, sans-serif", col, "#000", 6); ctx.restore();
            if (court.verdict !== "dismissed") {
                drawText("−" + court.paid + " 💰" + (court.couldntAfford ? "  (the rest = community service!)" : ""),
                    W / 2, H / 2 + 20, "bold 15px 'Segoe UI', Arial, sans-serif", "#FF8A80", "#000", 3);
            } else {
                drawText("Not guilty! ...this time.", W / 2, H / 2 + 20,
                    "bold 14px 'Segoe UI', Arial, sans-serif", "#C5E1A5", "#000", 3);
            }
            drawText("tap to leave ▸", W / 2, H - 28, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2);
        }
    }

    // ════════════════ FUGITIVE ON THE ROAD ════════════════
    // Called from updatePlaying while she's escaped and driving.
    function updateFugitive(dt) {
        if (!prisonClothes) return;
        fugitiveT += dt;
        // After a good run she ditches the jumpsuit and blends back in.
        if (fugitiveT > 55) {
            prisonClothes = false; fugitiveSpot = 0;
            spawnFloater(player.x, player.y - 50, "😎 Ditched the jumpsuit!", "#7CFC4F");
            return;
        }
        // WANTED posters keep going up.
        wantedPosterT -= dt;
        if (wantedPosterT <= 0 && typeof billboards !== "undefined") {
            wantedPosterT = rand(7, 12);
            var side = Math.random() < 0.5 ? -1 : 1;
            billboards.push({ x: side > 0 ? W - 50 : 50, y: -120, side: side,
                              msg: "WANTED: LULU", parallax: rand(0.7, 0.9), wanted: true });
        }
        // Any cop who can see her starts to recognize the fugitive.
        var seen = (typeof copInView === "function" && copInView());
        if (!seen) {
            for (var i = 0; i < obstacles.length; i++) {
                var o = obstacles[i];
                if (o.type === "car" && o.behavior === "patrol" && Math.abs(o.y - player.y) < 200) { seen = o; break; }
            }
        }
        if (seen) {
            fugitiveSpot += dt;
            if (fugitiveSpot > 1.6) {
                // RE-arrested — escaping makes the next stretch worse.
                goToJail(["ESCAPE FROM CUSTODY", "RESISTING (with SASS)"]);
                return;
            }
        } else {
            fugitiveSpot = Math.max(0, fugitiveSpot - dt * 0.8);
        }
    }

    // HUD strip while a fugitive (drawn from drawHUD).
    function drawFugitiveHUD() {
        if (!prisonClothes) return;
        var pulse = Math.sin(gameTime * 8) > 0;
        drawText("🔒 FUGITIVE", W / 2, SAFE_TOP + 58, "bold 14px 'Segoe UI', Arial, sans-serif",
            pulse ? "#FF5252" : "#FFEB3B", "#000", 3);
        if (fugitiveSpot > 0.05) {
            var w = 120, x = W / 2 - w / 2, y = SAFE_TOP + 68;
            ctx.fillStyle = "rgba(0,0,0,0.4)"; roundRect(x, y, w, 6, 3); ctx.fill();
            ctx.fillStyle = "#FF5252"; roundRect(x, y, w * clamp(fugitiveSpot / 1.6, 0, 1), 6, 3); ctx.fill();
            drawText("👀 SPOTTED!", W / 2, y + 18, "bold 10px 'Segoe UI', Arial, sans-serif", "#FF8A80", "#000", 2);
        }
    }

    // ── Little art helpers ───────────────────────────────────
    // A seated striped-jumpsuit prisoner ("lulu" gets hair + a frown, "mate" a cap).
    function drawPrisoner(x, y, t, who) {
        ctx.save();
        ctx.translate(x, y);
        var bob = Math.sin(t * 2 + (who === "lulu" ? 1 : 0)) * 1.5;
        ctx.translate(0, bob);
        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(0, 24, 16, 4, 0, 0, Math.PI * 2); ctx.fill();
        // legs
        ctx.fillStyle = "#E8E8E8"; roundRect(-9, 12, 7, 14, 2); ctx.fill(); roundRect(2, 12, 7, 14, 2); ctx.fill();
        // striped jumpsuit body
        ctx.fillStyle = "#ECEFF1"; roundRect(-13, -10, 26, 24, 6); ctx.fill();
        ctx.fillStyle = "#37474F";
        for (var s = 0; s < 4; s++) ctx.fillRect(-13, -8 + s * 6, 26, 3);
        // arms
        ctx.fillStyle = "#ECEFF1"; roundRect(-16, -8, 5, 16, 2); ctx.fill(); roundRect(11, -8, 5, 16, 2); ctx.fill();
        ctx.fillStyle = "#37474F"; ctx.fillRect(-16, -2, 5, 3); ctx.fillRect(11, -2, 5, 3);
        // head
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(0, -18, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -18, 8.6, 0, Math.PI * 2); ctx.fill();
        if (who === "lulu") {
            // Lulu's hair
            ctx.fillStyle = save.luluHair || "#8B5A2B";
            ctx.beginPath(); ctx.arc(0, -21, 9, Math.PI, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-8, -16, 3.5, 7, -0.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(8, -16, 3.5, 7, 0.3, 0, Math.PI * 2); ctx.fill();
        } else {
            // cellmate's little beanie + stubble
            ctx.fillStyle = "#455A64"; ctx.beginPath(); ctx.arc(0, -21, 9, Math.PI, Math.PI * 2); ctx.fill();
            ctx.fillRect(-9, -21, 18, 3);
        }
        // sad/annoyed eyes
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(-3, -18, 1.3, 0, Math.PI * 2); ctx.arc(3, -18, 1.3, 0, Math.PI * 2); ctx.fill();
        // little frown
        ctx.strokeStyle = "#5D2A2A"; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(0, -11, 3, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
        // inmate number on the chest
        ctx.fillStyle = "#37474F";
        drawText(who === "lulu" ? "#0613" : "#4417", 0, 2, "bold 6px 'Segoe UI', Arial, sans-serif", "#37474F", null, 0);
        ctx.restore();
    }

    // Judge: white wig, black robe, gavel.
    function drawJudge(x, y, banging) {
        ctx.save();
        ctx.translate(x, y);
        // black robe
        ctx.fillStyle = "#1A1A1A"; roundRect(-20, 0, 40, 34, 6); ctx.fill();
        // white collar bands
        ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(0, 12); ctx.lineTo(3, 2); ctx.fill();
        // head
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -8, 9, 0, Math.PI * 2); ctx.fill();
        // powdered wig
        ctx.fillStyle = "#ECEFF1";
        ctx.beginPath(); ctx.arc(0, -12, 10, Math.PI, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-9, -6, 4, 8, 0, 0, Math.PI * 2); ctx.ellipse(9, -6, 4, 8, 0, 0, Math.PI * 2); ctx.fill();
        // stern eyes + glasses
        ctx.strokeStyle = "#37474F"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(-3, -8, 2, 0, Math.PI * 2); ctx.arc(3, -8, 2, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(-3, -8, 0.9, 0, Math.PI * 2); ctx.arc(3, -8, 0.9, 0, Math.PI * 2); ctx.fill();
        // gavel arm
        var ga = banging ? -0.5 : -1.0;
        ctx.save(); ctx.translate(15, 2); ctx.rotate(ga);
        ctx.fillStyle = C.skin; roundRect(-2, 0, 4, 10, 2); ctx.fill();
        ctx.fillStyle = "#8D6E63"; ctx.fillRect(-2, -8, 4, 9); roundRect(-6, -12, 12, 7, 2); ctx.fill();
        ctx.restore();
        ctx.restore();
    }

    // tiny word-wrap helper for the escape blurb
    function wrapText(text, cx, cy, maxW, lh, col) {
        var words = text.split(" "), line = "", lines = [];
        ctx.font = "13px 'Segoe UI', Arial, sans-serif";
        for (var i = 0; i < words.length; i++) {
            var test = line + words[i] + " ";
            if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = words[i] + " "; }
            else line = test;
        }
        lines.push(line);
        for (var l = 0; l < lines.length; l++) drawText(lines[l].trim(), cx, cy + l * lh, "13px 'Segoe UI', Arial, sans-serif", col || "#FFF", "#000", 2);
    }
