    // ════════════════════════════════════════════════════════════
    //  JAIL → COURTROOM → ESCAPE → FUGITIVE  (RPG-style presentation)
    //  Booked offenders cool off in a detailed cell (escape / bail / court),
    //  then face a scripted courtroom that plays out through a visual-novel
    //  dialogue box (portraits + nameplates) with a real judge, jury, and
    //  prosecutor. Verdicts: dismissed / fine / jail. Escape → fugitive on the
    //  road with WANTED posters and cops who re-arrest her.
    // ════════════════════════════════════════════════════════════

    var jail = null;
    var court = null;
    var prisonClothes = false;
    var fugitiveT = 0;
    var fugitiveSpot = 0;
    var wantedPosterT = 0;

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
    var JUDGE_INTROS = ["Order! ORDER in my court!", "This had better be good...",
        "I haven't even had my coffee.", "Let's be quick — I tee off at noon.", "What fresh nonsense is THIS?"];

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
          outcomes: [["dismissed", 0.40], ["fine", 0.45], ["jail", 0.15]] },
        { label: "🎤 OBJECT!", says: "OBJECTION! On the grounds of... vibes. 💅",
          outcomes: [["dismissed", 0.40], ["fine", 0.40], ["jail", 0.20]] },
        { label: "🍪 Bribe the JURY", says: "*passes rugelach down the jury box* 🍪",
          outcomes: [["dismissed", 0.55], ["fine", 0.25], ["jail", 0.20]], bribe: true },
        { label: "📞 Demand a lawyer", says: "I get one call — to my cousin. The LAWYER.",
          outcomes: [["dismissed", 0.45], ["fine", 0.45], ["jail", 0.10]] },
        { label: "💃 Dazzle the court", says: "*little tap routine* Charges dropped now? 💃",
          outcomes: [["dismissed", 0.50], ["fine", 0.30], ["jail", 0.20]] },
        { label: "🤥 Lie (badly)", says: "I wasn't there. Or driving. Or... born.",
          outcomes: [["dismissed", 0.30], ["fine", 0.40], ["jail", 0.30]] },
        { label: "🙏 Beg for mercy", says: "Mercy! I'll never speed again! ...today.",
          outcomes: [["dismissed", 0.50], ["fine", 0.40], ["jail", 0.10]] }
    ];

    // ── Entry: book her ──────────────────────────────────────
    function goToJail(charges) {
        var list = (charges && charges.length ? charges.slice() : ["DISTURBING THE PEACE"]);
        if (Math.random() < 0.5) list.push(randPick(EXTRA_CHARGES));
        list = list.filter(function (c, i) { return list.indexOf(c) === i; });
        jail = { charges: list, phase: 0, t: 0, cellmateLine: randPick(CELLMATE_LINES), cellmateT: 4.0,
                 escapeMethod: "", flash: 0.3, bail: list.length * randInt(35, 55) };
        copChase = null; copBust = null; copStop = null;
        if (typeof playWompWomp === "function") playWompWomp();
        playTone(110, 0.5, "square", 0.12);
        setTimeout(function () { playTone(80, 0.4, "square", 0.12); }, 220);
        state = "jailCell";
    }

    // ── Button rects (horizontal row above the dialogue box) ──
    function cellBtnW() { return (W - 44) / 3; }
    function cellEscapeRect() { return { x: 16, y: H - 178, w: cellBtnW(), h: 42 }; }
    function cellBailRect() { return { x: 16 + cellBtnW() + 6, y: H - 178, w: cellBtnW(), h: 42 }; }
    function cellCourtRect() { return { x: 16 + 2 * (cellBtnW() + 6), y: H - 178, w: cellBtnW(), h: 42 }; }
    function courtOptRect(i) { return { x: 22, y: H - 132 + i * 42, w: W - 44, h: 38 }; }

    // ════════════════ JAIL CELL ════════════════
    function updateJailCell(dt) {
        if (jail.flash > 0) jail.flash -= dt;
        jail.t += dt;
        jail.cellmateT -= dt;
        if (jail.cellmateT <= 0) { jail.cellmateLine = randPick(CELLMATE_LINES); jail.cellmateT = rand(4, 7); }

        if (jail.phase === 0) { if (jail.t > 1.1) { jail.phase = 1; jail.t = 0; } return; }
        if (jail.phase === 1) {
            var click = consumeClick();
            if (click) {
                var er = cellEscapeRect(), br = cellBailRect(), cr = cellCourtRect();
                if (pointInRect(click.x, click.y, er.x, er.y, er.w, er.h)) {
                    jail.phase = 2; jail.t = 0; jail.escapeMethod = randPick(ESCAPE_METHODS);
                    playTone(440, 0.08, "square", 0.1); playTone(660, 0.1, "square", 0.1); return;
                }
                if (pointInRect(click.x, click.y, br.x, br.y, br.w, br.h)) {
                    if (save.totalCoins >= jail.bail) {
                        save.totalCoins -= jail.bail; persistSave();
                        var paid = jail.bail; jail = null; prisonClothes = false;
                        if (typeof returnToDriving === "function") returnToDriving();
                        spawnFloater(player.x, player.y - 50, "💰 BAILED OUT! −" + paid, "#7CFC4F");
                        playTone(784, 0.1, "triangle", 0.18);
                    } else {
                        playTone(180, 0.15, "square", 0.15);
                        spawnFloater(W / 2, H * 0.42, "Can't make bail! 😬", "#FF8A80");
                    }
                    return;
                }
                if (pointInRect(click.x, click.y, cr.x, cr.y, cr.w, cr.h)) { openCourt(jail.charges); return; }
            }
            if (jail.t > 20) { openCourt(jail.charges); return; }
            return;
        }
        if (jail.phase === 2) {
            if (jail.t > 2.8) {
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
        // ── back wall (cool concrete with a vignette) ──
        var bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, "#3A4450"); bg.addColorStop(1, "#222932");
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        // brick courses
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        for (var by = 60; by < H - 150; by += 24) {
            for (var bx = ((Math.floor(by / 24) % 2) ? -28 : 0); bx < W; bx += 56) ctx.fillRect(bx + 2, by, 52, 2);
            ctx.fillRect(0, by, W, 1.5);
        }
        // graffiti
        ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.font = "italic 12px 'Segoe UI', Arial, sans-serif"; ctx.textAlign = "left";
        ctx.fillText("LULU WUZ HERE", 30, 250); ctx.fillText("DAY 4,382...", W - 150, 300);
        // barred moonlit window
        ctx.fillStyle = "#101D30"; roundRect(W / 2 - 46, 56, 92, 58, 6); ctx.fill();
        ctx.fillStyle = "#FFF8E1"; ctx.beginPath(); ctx.arc(W / 2 + 16, 80, 13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#101D30"; ctx.beginPath(); ctx.arc(W / 2 + 21, 76, 11, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#566270"; ctx.lineWidth = 4;
        for (var wb = 0; wb < 3; wb++) { ctx.beginPath(); ctx.moveTo(W / 2 - 30 + wb * 30, 56); ctx.lineTo(W / 2 - 30 + wb * 30, 114); ctx.stroke(); }

        // ── cell furniture ──
        var floorY = H - 196;
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(0, floorY, W, 6);
        // bunk bed (right)
        ctx.fillStyle = "#4A5560"; roundRect(W - 150, floorY - 70, 138, 16, 3); ctx.fill();
        ctx.fillStyle = "#37414B"; ctx.fillRect(W - 148, floorY - 54, 8, 54); ctx.fillRect(W - 24, floorY - 54, 8, 54);
        ctx.fillStyle = "#90A4AE"; roundRect(W - 150, floorY - 36, 138, 12, 3); ctx.fill(); // lower mattress
        ctx.fillStyle = "#B0BEC5"; roundRect(W - 150, floorY - 80, 32, 12, 3); ctx.fill(); // pillow
        // steel toilet+sink (left)
        ctx.fillStyle = "#9AA7B0"; roundRect(20, floorY - 34, 30, 34, 5); ctx.fill();
        ctx.fillStyle = "#C2CCD3"; ctx.beginPath(); ctx.ellipse(35, floorY - 30, 13, 6, 0, 0, Math.PI * 2); ctx.fill();

        // ── characters ──
        drawPrisoner(W - 80, floorY - 28, gameTime, "lulu");      // Lulu sitting on the bunk
        drawPrisoner(W * 0.26, floorY - 6, gameTime, "mate");     // pacing cellmate
        // a guard patrolling outside the bars
        var gx = W / 2 + Math.sin(gameTime * 0.6) * (W * 0.3);
        drawAngryMan(gx, 150, gameTime, "running", Math.cos(gameTime * 0.6) >= 0 ? 1 : -1, true);

        // ── foreground bars (with highlight) ──
        ctx.fillStyle = "#2C2F36";
        for (var i = 0; i <= 6; i++) ctx.fillRect((W / 6) * i - 5, 128, 10, floorY - 128 + 30);
        ctx.fillRect(0, 124, W, 10);
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        for (var j = 0; j <= 6; j++) ctx.fillRect((W / 6) * j - 4, 128, 2.5, floorY - 128 + 30);

        // ── arrival flash + title + charge sheet (parchment) ──
        if (jail.flash > 0) { ctx.fillStyle = "rgba(255,255,255," + (jail.flash / 0.3 * 0.5) + ")"; ctx.fillRect(0, 0, W, H); }
        drawText("🚔 BOOKED!", W / 2, 30, "bold 30px 'Segoe UI', Arial, sans-serif", "#FF7043", "#000", 6);
        var sy = 116, sh = 22 + jail.charges.length * 15;
        ctx.fillStyle = "#E8DBB5"; roundRect(W / 2 - 130, sy, 260, sh, 6); ctx.fill();
        ctx.strokeStyle = "#9E8A5A"; ctx.lineWidth = 2; roundRect(W / 2 - 130, sy, 260, sh, 6); ctx.stroke();
        drawText("— CHARGE SHEET —", W / 2, sy + 12, "bold 11px 'Segoe UI', Arial, sans-serif", "#7A1F1A", null, 0);
        for (var c = 0; c < jail.charges.length; c++)
            drawText("• " + jail.charges[c], W / 2, sy + 27 + c * 15, "bold 10px 'Segoe UI', Arial, sans-serif", "#3E2723", null, 0);

        if (jail.phase === 1) {
            // action buttons (row) + the cellmate chatting in a dialogue box
            var er = cellEscapeRect(), br = cellBailRect(), cr = cellCourtRect();
            var glow = Math.sin(gameTime * 6) > 0;
            drawButton(er.x, er.y, er.w, er.h, "🏃 Escape", { bg: glow ? "#66BB6A" : "#4CAF50", bgDark: "#2E7D32", small: true });
            var canBail = save.totalCoins >= jail.bail;
            drawButton(br.x, br.y, br.w, br.h, "💰 Bail ★" + jail.bail, { bg: canBail ? "#FFB300" : "#757575", bgDark: canBail ? "#EF6C00" : "#424242", small: true });
            drawButton(cr.x, cr.y, cr.w, cr.h, "⚖️ Court", { bg: "#42A5F5", bgDark: "#0D47A1", small: true });
            drawDialogueBox("CELLMATE", jail.cellmateLine, "cellmate", "#90A4AE", false);
        } else if (jail.phase === 2) {
            ctx.fillStyle = "rgba(0,0,0,0.78)"; roundRect(W / 2 - 168, H * 0.40, 336, 100, 14); ctx.fill();
            ctx.strokeStyle = "#7CFC4F"; ctx.lineWidth = 3; roundRect(W / 2 - 168, H * 0.40, 336, 100, 14); ctx.stroke();
            drawText("🏃 JAILBREAK!", W / 2, H * 0.40 + 26, "bold 22px 'Segoe UI', Arial, sans-serif", "#7CFC4F", "#000", 5);
            wrapCentered(jail.escapeMethod, W / 2, H * 0.40 + 50, 300, 16, "#FFF");
        }
    }

    // ════════════════ COURTROOM ════════════════
    function openCourt(charges) {
        var pool = DEFENSE_POOL.slice(), opts = [];
        for (var k = 0; k < 3 && pool.length; k++) opts.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
        var cl = (charges && charges.length ? charges.slice() : ["BEING SUSPICIOUS"]);
        court = { charges: cl, options: opts, choice: -1, verdict: null, fine: 0, applied: false,
                  phase: 0, t: 0, gavel: 0, banner: 0, li: 0,
                  lines: [
                      { who: "JUDGE", p: "judge", accent: "#B39DDB", text: randPick(JUDGE_INTROS) },
                      { who: "PROSECUTOR", p: "prosecutor", accent: "#EF9A9A", text: randPick(PROSECUTOR_LINES) + " The charges: " + cl.join(", ") + "!" },
                      { who: "JUDGE", p: "judge", accent: "#B39DDB", text: "And how do you plead, Ms. Bruck?" }
                  ] };
        jail = null; state = "courtroom"; playTone(523, 0.12, "triangle", 0.16);
    }

    function rollVerdict(opt) {
        var r = Math.random(), acc = 0;
        for (var i = 0; i < opt.outcomes.length; i++) { acc += opt.outcomes[i][1]; if (r <= acc) return opt.outcomes[i][0]; }
        return "fine";
    }

    function updateCourtroom(dt) {
        court.t += dt;
        if (court.gavel > 0) court.gavel -= dt;
        if (court.banner > 0) court.banner -= dt;

        if (court.phase === 0) {                     // ALL RISE
            if (court.t > 1.5) { court.phase = 1; court.t = 0; court.gavel = 0.3; playTone(150, 0.12, "square", 0.18); }
            return;
        }
        if (court.phase === 1) {                     // intro dialogue (judge → pros → judge)
            if (consumeClick() || consumeAction()) {
                court.li++;
                if (court.li >= court.lines.length) { court.phase = 2; court.t = 0; }
                else playTone(court.lines[court.li].p === "judge" ? 300 : 380, 0.04, "sine", 0.06);
            }
            return;
        }
        if (court.phase === 2) {                     // pick a defense
            var click = consumeClick();
            if (click) for (var i = 0; i < court.options.length; i++) {
                var r = courtOptRect(i);
                if (pointInRect(click.x, click.y, r.x, r.y, r.w, r.h)) {
                    court.choice = i; court.phase = 3; court.t = 0;
                    court.defLine = { who: "LULU", p: "lulu", accent: "#F48FB1", text: court.options[i].says };
                    playTone(660, 0.06, "sine", 0.1); return;
                }
            }
            return;
        }
        if (court.phase === 3) {                     // Lulu's defense line
            if (consumeClick() || consumeAction()) { court.phase = 4; court.t = 0; }
            return;
        }
        if (court.phase === 4) {                     // jury deliberates → verdict
            if (court.t > 1.9) {
                var opt = court.options[court.choice];
                court.verdict = rollVerdict(opt);
                if (opt.bribe && court.verdict !== "dismissed") court.charges.push("BRIBING A JUDGE (BADLY)");
                if (court.verdict === "fine" || court.verdict === "jail") {
                    var base = court.charges.length * randInt(12, 30);
                    if (opt.bribe && court.verdict !== "dismissed") base += 40;
                    court.fine = base;
                }
                var vt = court.verdict === "dismissed" ? "CASE DISMISSED! Now get outta my court. 🎉"
                       : court.verdict === "jail" ? "GUILTY! Thirty days in the clink, missy! ⛓️"
                       : "GUILTY! That'll be ★" + court.fine + ". See the clerk on your way out. 💸";
                court.verdictLine = { who: "JUDGE", p: "judge", accent: "#B39DDB", text: vt };
                court.phase = 5; court.t = 0; court.gavel = 0.4; court.banner = 0.55;
                playTone(150, 0.16, "square", 0.18);
                playTone(court.verdict === "dismissed" ? 880 : 200, 0.22, "triangle", 0.16);
                return;
            }
            return;
        }
        if (court.phase === 5) {                     // verdict delivered → released
            if (!court.applied) {
                court.applied = true;
                if (court.verdict !== "dismissed") {
                    var pay = Math.min(court.fine, save.totalCoins);
                    save.totalCoins -= pay; persistSave(); court.paid = pay; court.couldnt = pay < court.fine;
                }
            }
            if (court.t > 0.7 && (consumeClick() || consumeAction())) {
                var v = court.verdict; court = null; prisonClothes = false;
                if (typeof returnToDriving === "function") returnToDriving();
                spawnFloater(player.x, player.y - 50,
                    v === "dismissed" ? "⚖️ DISMISSED! Free to go!" : (v === "jail" ? "Served your time. 🚗" : "Fine paid. Drive safer! 🚗"),
                    v === "dismissed" ? "#7CFC4F" : "#FFE082");
            }
        }
    }

    function drawCourtroom() {
        // ── panelled-wood courtroom with depth ──
        var wall = ctx.createLinearGradient(0, 0, 0, H);
        wall.addColorStop(0, "#7A5640"); wall.addColorStop(1, "#5A3E2E");
        ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(0,0,0,0.10)";
        for (var p = 0; p < W; p += 38) ctx.fillRect(p, 0, 2, H * 0.62);
        // wainscot line + marble floor
        ctx.fillStyle = "#4E342E"; ctx.fillRect(0, H * 0.6, W, 6);
        var fl = ctx.createLinearGradient(0, H * 0.6, 0, H);
        fl.addColorStop(0, "#8D8579"); fl.addColorStop(1, "#6B645A");
        ctx.fillStyle = fl; ctx.fillRect(0, H * 0.6 + 6, W, H);
        // seal + flags on the back wall
        ctx.fillStyle = "#3E2723"; ctx.beginPath(); ctx.arc(W / 2, 44, 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFD54F"; ctx.beginPath(); ctx.arc(W / 2, 44, 17, 0, Math.PI * 2); ctx.fill();
        drawText("⚖", W / 2, 47, "bold 20px Arial", "#5D4037", null, 0);
        ctx.fillStyle = "#1565C0"; ctx.fillRect(W / 2 - 54, 26, 4, 40); ctx.fillStyle = "#C62828"; ctx.fillRect(W / 2 + 50, 26, 4, 40);

        // judge bench (center), jury box (left), prosecutor (right), Lulu (center podium)
        drawBenchJudge(W / 2, 78, court.gavel > 0);
        drawJuryBox(14, 168, court.phase >= 4);
        var prosTalk = (court.phase === 1 && court.li === 1);
        drawProsecutor(W - 52, H * 0.50, gameTime, prosTalk);
        drawDefendant(W / 2, H * 0.56);
        if (court.gavel > 0) drawText("BANG!", W / 2 + 64, 92, "bold 13px Arial", "#FFD54F", "#000", 3);

        // small charge sheet (top-right) for context
        var cy = 150;
        ctx.fillStyle = "rgba(0,0,0,0.45)"; roundRect(W - 172, cy, 162, 18 + court.charges.length * 14, 6); ctx.fill();
        drawText("CHARGES", W - 91, cy + 11, "bold 10px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 2);
        for (var c = 0; c < court.charges.length; c++)
            drawText("• " + court.charges[c], W - 91, cy + 25 + c * 14, "bold 8px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 1);

        // ── phase overlays ──
        if (court.phase === 0) {
            ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, W, H);
            var rise = 1 + Math.max(0, 0.3 - court.t) * 1.2;
            ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(rise, rise);
            drawText("⚖️ ALL RISE ⚖️", 0, 0, "bold 30px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 6); ctx.restore();
        } else if (court.phase === 1) {
            var ln = court.lines[court.li];
            drawDialogueBox(ln.who, ln.text, ln.p, ln.accent, true);
        } else if (court.phase === 2) {
            // RPG choice menu
            ctx.fillStyle = "rgba(20,12,30,0.78)"; roundRect(14, H - 168, W - 28, 158, 12); ctx.fill();
            ctx.strokeStyle = "#FFD54F"; ctx.lineWidth = 2; roundRect(14, H - 168, W - 28, 158, 12); ctx.stroke();
            drawText("⚖️  How do you plead, Ms. Bruck?", W / 2, H - 152, "bold 14px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 3);
            for (var i = 0; i < court.options.length; i++) {
                var r = courtOptRect(i);
                drawButton(r.x, r.y, r.w, r.h, court.options[i].label, { bg: "#7E57C2", bgDark: "#4527A0", small: true });
            }
        } else if (court.phase === 3) {
            drawDialogueBox(court.defLine.who, court.defLine.text, court.defLine.p, court.defLine.accent, true);
        } else if (court.phase === 4) {
            ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(W / 2 - 140, H - 70, 280, 34, 10); ctx.fill();
            var dots = ".".repeat(1 + (Math.floor(court.t * 3) % 3));
            drawText("⚖️ The jury deliberates" + dots, W / 2, H - 53, "bold 15px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 3);
        } else if (court.phase === 5) {
            // slam-down verdict stamp, then the judge delivers it in the box
            if (court.banner > 0) {
                var col = court.verdict === "dismissed" ? "#7CFC4F" : court.verdict === "jail" ? "#FF5252" : "#FFB300";
                var sc = 1 + court.banner * 3;
                ctx.save(); ctx.translate(W / 2, H * 0.34); ctx.rotate(-0.08); ctx.scale(sc, sc); ctx.globalAlpha = clamp(1 - court.banner, 0, 1) + 0.3;
                ctx.strokeStyle = col; ctx.lineWidth = 4; roundRect(-120, -26, 240, 52, 8); ctx.stroke();
                drawText(court.verdict === "dismissed" ? "DISMISSED" : "GUILTY", 0, 0, "bold 34px 'Segoe UI', Arial, sans-serif", col, "#000", 5);
                ctx.restore();
            }
            drawDialogueBox(court.verdictLine.who, court.verdictLine.text, court.verdictLine.p, court.verdictLine.accent, court.t > 0.7);
            if (court.verdict !== "dismissed" && court.applied)
                drawText("−" + court.paid + " 💰" + (court.couldnt ? "  (rest = community service!)" : ""),
                    W / 2, H - 150, "bold 14px 'Segoe UI', Arial, sans-serif", "#FF8A80", "#000", 3);
        }
    }

    // ════════════════ FUGITIVE ════════════════
    function updateFugitive(dt) {
        if (!prisonClothes) return;
        fugitiveT += dt;
        if (fugitiveT > 55) { prisonClothes = false; fugitiveSpot = 0; spawnFloater(player.x, player.y - 50, "😎 Ditched the jumpsuit!", "#7CFC4F"); return; }
        wantedPosterT -= dt;
        if (wantedPosterT <= 0 && typeof billboards !== "undefined") {
            wantedPosterT = rand(7, 12);
            var side = Math.random() < 0.5 ? -1 : 1;
            billboards.push({ x: side > 0 ? W - 50 : 50, y: -120, side: side, msg: "WANTED: LULU", parallax: rand(0.7, 0.9), wanted: true });
        }
        var seen = (typeof copInView === "function" && copInView());
        if (!seen) for (var i = 0; i < obstacles.length; i++) {
            var o = obstacles[i];
            if (o.type === "car" && o.behavior === "patrol" && Math.abs(o.y - player.y) < 200) { seen = o; break; }
        }
        if (seen) { fugitiveSpot += dt; if (fugitiveSpot > 1.6) { goToJail(["ESCAPE FROM CUSTODY", "RESISTING (with SASS)"]); return; } }
        else fugitiveSpot = Math.max(0, fugitiveSpot - dt * 0.8);
    }

    function drawFugitiveHUD() {
        if (!prisonClothes) return;
        var pulse = Math.sin(gameTime * 8) > 0;
        drawText("🔒 FUGITIVE", W / 2, SAFE_TOP + 58, "bold 14px 'Segoe UI', Arial, sans-serif", pulse ? "#FF5252" : "#FFEB3B", "#000", 3);
        if (fugitiveSpot > 0.05) {
            var w = 120, x = W / 2 - w / 2, y = SAFE_TOP + 68;
            ctx.fillStyle = "rgba(0,0,0,0.4)"; roundRect(x, y, w, 6, 3); ctx.fill();
            ctx.fillStyle = "#FF5252"; roundRect(x, y, w * clamp(fugitiveSpot / 1.6, 0, 1), 6, 3); ctx.fill();
            drawText("👀 SPOTTED!", W / 2, y + 18, "bold 10px 'Segoe UI', Arial, sans-serif", "#FF8A80", "#000", 2);
        }
    }

    // ════════════════ RPG dialogue box + portraits ════════════════
    function wrapLines(text, maxW, font) {
        ctx.font = font;
        var words = text.split(" "), line = "", out = [];
        for (var i = 0; i < words.length; i++) {
            var test = line ? line + " " + words[i] : words[i];
            if (ctx.measureText(test).width > maxW && line) { out.push(line); line = words[i]; } else line = test;
        }
        if (line) out.push(line);
        return out;
    }
    function wrapCentered(text, cx, cy, maxW, lh, col) {
        var lines = wrapLines(text, maxW, "13px 'Segoe UI', Arial, sans-serif");
        for (var l = 0; l < lines.length; l++) drawText(lines[l], cx, cy + l * lh, "13px 'Segoe UI', Arial, sans-serif", col || "#FFF", "#000", 2);
    }

    function drawDialogueBox(name, text, ptype, accent, advance) {
        var bh = 116, by = H - bh - 12, bx = 12, bw = W - 24;
        ctx.fillStyle = "rgba(0,0,0,0.35)"; roundRect(bx + 3, by + 4, bw, bh, 14); ctx.fill();
        var g = ctx.createLinearGradient(0, by, 0, by + bh);
        g.addColorStop(0, "#2A2336"); g.addColorStop(1, "#171121");
        ctx.fillStyle = g; roundRect(bx, by, bw, bh, 14); ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 3; roundRect(bx, by, bw, bh, 14); ctx.stroke();
        // portrait
        var pf = 84, px = bx + 12, py = by + bh / 2 - pf / 2;
        ctx.save(); roundRect(px, py, pf, pf, 10); ctx.clip();
        var pg = ctx.createLinearGradient(0, py, 0, py + pf); pg.addColorStop(0, "#473A5E"); pg.addColorStop(1, "#2A2238");
        ctx.fillStyle = pg; ctx.fillRect(px, py, pf, pf);
        drawPortrait(ptype, px + pf / 2, py + pf / 2 + 8, pf - 8);
        ctx.restore();
        ctx.strokeStyle = accent; ctx.lineWidth = 2; roundRect(px, py, pf, pf, 10); ctx.stroke();
        // nameplate tab
        ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
        var nw = ctx.measureText(name).width + 24;
        ctx.fillStyle = accent; roundRect(px + pf + 10, by - 13, nw, 24, 6); ctx.fill();
        drawText(name, px + pf + 10 + nw / 2, by - 1, "bold 13px 'Segoe UI', Arial, sans-serif", "#1A1230", null, 0);
        // wrapped body text (left-aligned)
        var tx = px + pf + 22, tw = bx + bw - 16 - tx;
        var lines = wrapLines(text, tw, "15px 'Segoe UI', Arial, sans-serif");
        for (var i = 0; i < lines.length; i++)
            drawText(lines[i], tx, by + 30 + i * 21, "15px 'Segoe UI', Arial, sans-serif", "#F3E9FF", "#000", 2, "left");
        if (advance) {
            var bl = 0.4 + 0.6 * Math.abs(Math.sin(gameTime * 5));
            ctx.globalAlpha = bl;
            drawText("▾ tap", bx + bw - 36, by + bh - 14, "bold 12px 'Segoe UI', Arial, sans-serif", accent, "#000", 2);
            ctx.globalAlpha = 1;
        }
    }

    // Head-and-shoulders portraits for the dialogue box.
    function drawPortrait(type, cx, cy, s) {
        var hr = s * 0.26;
        // shoulders/clothes
        var clothes = type === "judge" ? "#1A1A1A" : type === "prosecutor" ? "#26323A"
                    : type === "cellmate" ? "#ECEFF1" : type === "cop" ? "#1A237E" : "#37474F";
        ctx.fillStyle = clothes; roundRect(cx - s * 0.36, cy + hr * 0.55, s * 0.72, s * 0.55, 10); ctx.fill();
        if (type === "lulu" || type === "cellmate") {   // prison stripes on the shoulders
            ctx.fillStyle = "#37474F";
            for (var st = 0; st < 3; st++) ctx.fillRect(cx - s * 0.36, cy + hr * 0.7 + st * 7, s * 0.72, 3);
        }
        // neck + head
        ctx.fillStyle = C.skin; ctx.fillRect(cx - 5, cy + hr * 0.2, 10, hr * 0.7);
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(cx, cy, hr + 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(cx, cy, hr, 0, Math.PI * 2); ctx.fill();
        // eyes (common)
        ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.arc(cx - hr * 0.34, cy - hr * 0.05, hr * 0.18, 0, Math.PI * 2); ctx.arc(cx + hr * 0.34, cy - hr * 0.05, hr * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(cx - hr * 0.34, cy - hr * 0.02, hr * 0.10, 0, Math.PI * 2); ctx.arc(cx + hr * 0.34, cy - hr * 0.02, hr * 0.10, 0, Math.PI * 2); ctx.fill();

        if (type === "judge") {
            ctx.fillStyle = "#ECEFF1";              // big powdered wig
            ctx.beginPath(); ctx.arc(cx, cy - hr * 0.3, hr * 1.15, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx - hr, cy + hr * 0.2, hr * 0.42, hr * 0.95, 0, 0, Math.PI * 2); ctx.ellipse(cx + hr, cy + hr * 0.2, hr * 0.42, hr * 0.95, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#37474F"; ctx.lineWidth = 1.5;   // glasses
            ctx.beginPath(); ctx.arc(cx - hr * 0.34, cy - hr * 0.02, hr * 0.26, 0, Math.PI * 2); ctx.arc(cx + hr * 0.34, cy - hr * 0.02, hr * 0.26, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.moveTo(cx - 3, cy + hr * 0.55); ctx.lineTo(cx, cy + hr); ctx.lineTo(cx + 3, cy + hr * 0.55); ctx.fill(); // collar bands
        } else if (type === "prosecutor") {
            ctx.fillStyle = "#212121";              // slicked hair
            ctx.beginPath(); ctx.arc(cx, cy - hr * 0.25, hr * 1.02, Math.PI, 0); ctx.fill();
            ctx.fillRect(cx - hr, cy - hr * 0.25, hr * 2, hr * 0.3);
            ctx.fillStyle = "#3E2723"; ctx.fillRect(cx - hr * 0.5, cy + hr * 0.45, hr, 2.5);  // thin mustache
            ctx.fillStyle = "#FFF"; roundRect(cx - 4, cy + hr * 0.55, 8, hr * 0.6, 1); ctx.fill();
            ctx.fillStyle = "#C62828"; ctx.beginPath(); ctx.moveTo(cx - 2.5, cy + hr * 0.6); ctx.lineTo(cx, cy + hr * 1.1); ctx.lineTo(cx + 2.5, cy + hr * 0.6); ctx.fill(); // tie
        } else if (type === "cellmate") {
            ctx.fillStyle = "#455A64"; ctx.beginPath(); ctx.arc(cx, cy - hr * 0.2, hr * 1.0, Math.PI, 0); ctx.fill(); // beanie
            ctx.fillRect(cx - hr, cy - hr * 0.2, hr * 2, hr * 0.28);
            ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(cx - hr * 0.5, cy + hr * 0.5, hr, hr * 0.4); // stubble
        } else if (type === "cop") {
            ctx.fillStyle = "#3E2723"; ctx.beginPath(); ctx.arc(cx, cy - hr * 0.15, hr * 0.95, Math.PI, 0); ctx.fill();
            ctx.fillStyle = "#0D1B5E"; ctx.beginPath(); ctx.ellipse(cx, cy - hr * 0.7, hr * 1.05, hr * 0.4, 0, 0, Math.PI * 2); ctx.fill(); // cap
            ctx.fillStyle = "#1A237E"; ctx.beginPath(); ctx.ellipse(cx, cy - hr * 0.95, hr * 0.9, hr * 0.5, 0, Math.PI, 0); ctx.fill();
            ctx.fillStyle = "#FFD54F"; ctx.beginPath(); ctx.arc(cx, cy - hr * 0.85, hr * 0.16, 0, Math.PI * 2); ctx.fill();
        } else {                                    // lulu
            ctx.fillStyle = (typeof save !== "undefined" && save.luluHair) || "#8B5A2B";
            ctx.beginPath(); ctx.arc(cx, cy - hr * 0.25, hr * 1.05, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx - hr * 0.95, cy + hr * 0.25, hr * 0.4, hr * 0.95, -0.2, 0, Math.PI * 2); ctx.ellipse(cx + hr * 0.95, cy + hr * 0.25, hr * 0.4, hr * 0.95, 0.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(255,140,140,0.5)"; ctx.beginPath(); ctx.arc(cx - hr * 0.5, cy + hr * 0.25, hr * 0.18, 0, Math.PI * 2); ctx.arc(cx + hr * 0.5, cy + hr * 0.25, hr * 0.18, 0, Math.PI * 2); ctx.fill();
        }
    }

    // ── Courtroom figures ────────────────────────────────────
    function drawBenchJudge(cx, topY, banging) {
        var bw = 196, bx = cx - bw / 2;
        // raised bench
        ctx.fillStyle = "#4E342E"; roundRect(bx, topY + 26, bw, 60, 6); ctx.fill();
        ctx.fillStyle = "#3E2723"; roundRect(bx, topY + 26, bw, 12, 6); ctx.fill();
        ctx.fillStyle = "#5D4037"; roundRect(bx + 18, topY + 44, bw - 36, 34, 4); ctx.fill();
        drawText("⚖", cx, topY + 62, "bold 20px Arial", "#3E2723", null, 0);
        // judge above the bench
        ctx.fillStyle = "#1A1A1A"; roundRect(cx - 24, topY + 2, 48, 32, 8); ctx.fill();           // robe
        ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.moveTo(cx - 4, topY + 8); ctx.lineTo(cx, topY + 22); ctx.lineTo(cx + 4, topY + 8); ctx.fill();
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(cx, topY - 2, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(cx, topY - 2, 9.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ECEFF1"; ctx.beginPath(); ctx.arc(cx, topY - 5, 11, Math.PI, 0); ctx.fill();    // wig
        ctx.beginPath(); ctx.ellipse(cx - 10, topY + 2, 4, 9, 0, 0, Math.PI * 2); ctx.ellipse(cx + 10, topY + 2, 4, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#37474F"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx - 3.4, topY - 2, 2.6, 0, Math.PI * 2); ctx.arc(cx + 3.4, topY - 2, 2.6, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(cx - 3.4, topY - 2, 1, 0, Math.PI * 2); ctx.arc(cx + 3.4, topY - 2, 1, 0, Math.PI * 2); ctx.fill();
        // gavel
        ctx.save(); ctx.translate(cx + 34, topY + 30); ctx.rotate(banging ? -0.4 : -1.0);
        ctx.fillStyle = C.skin; roundRect(-2, 0, 4, 11, 2); ctx.fill();
        ctx.fillStyle = "#8D6E63"; roundRect(-6, -12, 12, 8, 2); ctx.fill();
        ctx.restore();
        // nameplate
        ctx.fillStyle = "#2E1F18"; roundRect(cx - 46, topY + 88, 92, 14, 3); ctx.fill();
        drawText("THE HON. JUDGE", cx, topY + 95, "bold 8px 'Segoe UI', Arial, sans-serif", "#FFD54F", null, 0);
    }

    function drawJuryBox(x, y) {
        ctx.fillStyle = "#4E342E"; roundRect(x, y, 122, 74, 6); ctx.fill();
        for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) drawJuror(x + 24 + c * 37, y + 22 + r * 26, r * 3 + c);
        ctx.fillStyle = "#5D4037"; roundRect(x, y + 46, 122, 9, 2); ctx.fill();   // front rail
        ctx.fillStyle = "#3E2723"; roundRect(x + 36, y + 64, 50, 12, 2); ctx.fill();
        drawText("JURY", x + 61, y + 71, "bold 8px 'Segoe UI', Arial, sans-serif", "#FFD54F", null, 0);
    }

    function drawJuror(x, y, seed) {
        var skin = ["#F4C9A0", "#E8B98A", "#D9A875", "#C68642"][seed % 4];
        var hair = ["#3E2723", "#5D4037", "#8D6E63", "#212121", "#BDBDBD", "#6D4C41"][seed % 6];
        var shirt = ["#5C6BC0", "#26A69A", "#EF5350", "#8D6E63", "#7E57C2", "#66BB6A"][(seed * 2) % 6];
        var bob = Math.sin(gameTime * 1.6 + seed) * 1;
        ctx.save(); ctx.translate(x, y + bob);
        ctx.fillStyle = shirt; roundRect(-9, 4, 18, 13, 4); ctx.fill();             // shoulders
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(0, -2, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -2, 6.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, -4, 6.8, Math.PI, 0); ctx.fill();
        if (seed % 3 === 0) ctx.fillRect(-7, -4, 14, 2.5);                          // some have fuller hair
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(-2.4, -2, 1.1, 0, Math.PI * 2); ctx.arc(2.4, -2, 1.1, 0, Math.PI * 2); ctx.fill();
        if (seed % 2 === 0) { ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(-1, -4); ctx.moveTo(1, -4); ctx.lineTo(4, -5); ctx.stroke(); } // skeptical brow
        ctx.restore();
    }

    function drawProsecutor(x, y, t, pointing) {
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(0, 26, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1C2429"; roundRect(-7, 12, 6, 16, 2); ctx.fill(); roundRect(1, 12, 6, 16, 2); ctx.fill();   // trousers
        ctx.fillStyle = "#212121"; roundRect(-8, 26, 8, 4, 2); ctx.fill(); roundRect(0, 26, 8, 4, 2); ctx.fill();      // shoes
        ctx.fillStyle = "#26323A"; roundRect(-12, -10, 24, 24, 5); ctx.fill();                                          // suit
        ctx.fillStyle = "#FFF"; roundRect(-3, -9, 6, 20, 1); ctx.fill();                                                // shirt
        ctx.fillStyle = "#C62828"; ctx.beginPath(); ctx.moveTo(-2.5, -8); ctx.lineTo(0, 8); ctx.lineTo(2.5, -8); ctx.fill(); // tie
        // pointing arm (accusing) / resting arm
        ctx.save(); ctx.translate(-11, -7); ctx.rotate(pointing ? -1.0 + Math.sin(t * 12) * 0.05 : -0.1);
        ctx.fillStyle = "#26323A"; roundRect(-3, -2, 6, 17, 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, 16, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#26323A"; roundRect(8, -6, 5, 15, 2); ctx.fill();
        // head
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(0, -18, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -18, 7.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#212121"; ctx.beginPath(); ctx.arc(0, -20, 8, Math.PI, 0); ctx.fill(); ctx.fillRect(-8, -20, 16, 2);
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-2.6, -18, 1.1, 0, Math.PI * 2); ctx.arc(2.6, -18, 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3E2723"; ctx.fillRect(-3.5, -13, 7, 1.8);   // mustache
        ctx.restore();
        drawText("PROSECUTOR", x, y + 36, "bold 8px 'Segoe UI', Arial, sans-serif", "#FFCDD2", "#000", 2);
    }

    function drawDefendant(cx, py) {
        // podium + Lulu (striped) behind it
        drawPrisoner(cx, py - 4, gameTime, "lulu");
        ctx.fillStyle = "#5D4037"; roundRect(cx - 30, py + 10, 60, 34, 4); ctx.fill();
        ctx.fillStyle = "#4E342E"; roundRect(cx - 30, py + 10, 60, 8, 3); ctx.fill();
        ctx.fillStyle = "#8D6E63"; roundRect(cx - 22, py + 22, 44, 18, 2); ctx.fill();
        ctx.fillStyle = "#3E2723"; drawText("⚖", cx, py + 31, "bold 12px Arial", "#3E2723", null, 0);
        drawText("THE DEFENDANT", cx, py + 52, "bold 8px 'Segoe UI', Arial, sans-serif", "#F8BBD0", "#000", 2);
    }

    // A seated striped-jumpsuit prisoner ("lulu" = hair + cheeks, "mate" = beanie).
    function drawPrisoner(x, y, t, who) {
        ctx.save(); ctx.translate(x, y);
        var bob = Math.sin(t * 2 + (who === "lulu" ? 1 : 0)) * 1.5; ctx.translate(0, bob);
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(0, 24, 16, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#E8E8E8"; roundRect(-9, 12, 7, 14, 2); ctx.fill(); roundRect(2, 12, 7, 14, 2); ctx.fill();
        ctx.fillStyle = "#ECEFF1"; roundRect(-13, -10, 26, 24, 6); ctx.fill();
        ctx.fillStyle = "#37474F"; for (var s = 0; s < 4; s++) ctx.fillRect(-13, -8 + s * 6, 26, 3);
        ctx.fillStyle = "#ECEFF1"; roundRect(-16, -8, 5, 16, 2); ctx.fill(); roundRect(11, -8, 5, 16, 2); ctx.fill();
        ctx.fillStyle = "#37474F"; ctx.fillRect(-16, -2, 5, 3); ctx.fillRect(11, -2, 5, 3);
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(0, -18, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -18, 8.6, 0, Math.PI * 2); ctx.fill();
        if (who === "lulu") {
            ctx.fillStyle = save.luluHair || "#8B5A2B";
            ctx.beginPath(); ctx.arc(0, -21, 9, Math.PI, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-8, -16, 3.5, 7, -0.3, 0, Math.PI * 2); ctx.ellipse(8, -16, 3.5, 7, 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(255,140,140,0.5)"; ctx.beginPath(); ctx.arc(-4, -15, 1.6, 0, Math.PI * 2); ctx.arc(4, -15, 1.6, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = "#455A64"; ctx.beginPath(); ctx.arc(0, -21, 9, Math.PI, Math.PI * 2); ctx.fill(); ctx.fillRect(-9, -21, 18, 3);
        }
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-3, -18, 1.3, 0, Math.PI * 2); ctx.arc(3, -18, 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#5D2A2A"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(0, -11, 3, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
        ctx.restore();
    }
