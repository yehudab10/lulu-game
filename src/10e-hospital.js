    // ════════════════════════════════════════════════════════════
    //  THE HOSPITAL / ER  — a softer landing than game over.
    //  A bad enough crash or knockout sometimes sends Lulu to the ER instead
    //  of straight to game over: she wakes up, a doctor delivers a (ridiculous)
    //  diagnosis through the RPG dialogue box, she picks her care, pays a
    //  MEDICAL BILL (coins), and is discharged back onto the road, patched up.
    //  Reuses the dialogue box / portraits from the jail-court fragment.
    // ════════════════════════════════════════════════════════════

    var hospital = null;
    var erMusic = "er1";   // which ER song is playing — picked at random per visit

    var DIAGNOSES = ["a mild case of the OOFs", "two broken nails and a bruised ego",
        "whiplash — from your own SASS", "a boo-boo. A BIG boo-boo", "a concussion (or you're just like this)",
        "road rash and a wounded reputation", "one (1) ouchie, doctor's note attached", "a fractured sense of caution"];
    var DOC_GREET = ["You're awake! Don't sue us.", "Well well. The famous Lulu.", "BP's high, attitude's higher.",
        "Welcome back to the land of the living.", "You flatlined your DIGNITY, mostly."];
    var DOC_REPEAT = ["You AGAIN?! We should charge rent.", "Back so soon? I kept your bed warm.",
        "Lulu. Of COURSE it's Lulu.", "Third gown this WEEK, young lady.", "Frequent-flyer miles don't cover THIS."];
    var HOSP_OPTIONS = [
        { label: "🩹 Just patch me up", billMul: 1.0, extra: false, say: "Band-aid, a lollipop, you're golden. Try the BRAKES next time." },
        { label: "💊 The GOOD stuff, doc!", billMul: 2.0, extra: true, say: "Premium care! Extra heart on the house. Wheee~ 💕" },
        { label: "🏃 Skip the bill — RUN!", billMul: 0, extra: false, dash: true }
    ];
    // ── Bill-skip ESCAPE cutscene content ──
    // The way she TRIES to bolt (a random funny attempt, played out on screen).
    var ER_ESCAPES = [
        { attempt: "🪟 She DIVES through the ER window!", visual: "window" },
        { attempt: "🥼 ...struts out in a stolen lab coat.", visual: "coat" },
        { attempt: "♿ Wheelchair getaway — beep beep!", visual: "chair" },
        { attempt: "🛏️ ...rides a runaway gurney like a sled!", visual: "gurney" },
        { attempt: "🌀 ...up into the air vent, spy-movie style!", visual: "vent" }
    ];
    // If she makes it — a clean-getaway brag.
    var ER_CLEAN = ["...and she's GONE. Little gonif. 🏃💨", "...vanished. In a HOSPITAL GOWN. Iconic.",
        "Security was on a bagel break. 🥯", "Filmed her own escape for TikTok. #blessed",
        "Hopped the bus in a gown. Nobody blinked."];
    // If she's nabbed — the cop gets her in a DIFFERENT funny way each time.
    var ER_CAUGHT = [
        { line: "A sweet old lady blocks her — then rips off the shawl: IT'S A COP! 👵🚔", visual: "oldlady" },
        { line: "She bursts outside — into a WALL of waiting cop cars. 🚓🚓🚓", visual: "cars" },
        { line: "The 'doctor' clamps her shoulder — badge under the coat. 🩺🚔", visual: "doccop" },
        { line: "A guard tackles her at the sliding doors. OOF. 🚨", visual: "guard" }
    ];

    // ── NURSE TAMMY — Lulu's big sister, works the ER. She recognizes Lulu the
    //    second she's wheeled in, and her MOOD decides the bill: sweet → family
    //    discount, gossip → sister rate (pay in gossip), fed-up → full price. ──
    var TAMMY_GREET = {
        sweet:  ["LULU?! Oh my GOSH — are you OKAY?!", "Of all the ERs in town, you crash into MINE.",
                 "Sit STILL, mamaleh, I've got you. It's me.", "My baby sister! ...what did you DO this time?"],
        scold:  ["FOUR times this month, Lulu. FOUR.", "I'm telling Ma. And Bubbe. And Abba. ALL of them.",
                 "You'll pay this off babysitting Dina. For a YEAR.", "I clock out in five minutes and HERE you are."],
        gossip: ["Did you hear Avigail's ENGAGED? In MY ER you find out.", "You didn't bring me a coffee. Typical Lulu.",
                 "Ooh, sit — I have SO much to tell you about Esti.", "I covered your name on the chart. You're WELCOME."]
    };
    var TAMMY_CARE = {
        sweet:  ["There — stitched, kissed, FREE of charge. Don't tell my boss. 💕", "Family discount. Now GO, before a doctor sees this.",
                 "All patched. Text Ma you're alive, she's been calling ME."],
        scold:  ["Fine. Full price, and I'm rounding UP. 🧾", "Patched. NO discount — maybe THAT'll teach you.",
                 "There. Now drive like you've got a sister who worries."],
        gossip: ["Half off — but you owe me ALL the details. 🤭", "Sister rate. Spill about Avigail and we're square.",
                 "Discounted. Hold still and tell me EVERYTHING."]
    };

    // ── THE IN-LAWS drop by the bedside (Tammy texted the family group chat) ──
    // HILLEL — Tammy's husband. A nervous, perpetually-between-jobs actuary who
    //   STILL talks like he sells car insurance (his last gig, sort of). He frets
    //   in statistics and means well. If he visits and Lulu pays for care, he'll
    //   "file the claim" — sometimes it lands (discount!), sometimes it's denied.
    var HILLEL_LINES = [
        "Tammy texted me. Actuarially, Lulu, your crash rate is... off the charts.",
        "I ran your numbers on the drive over. You're a 94th-percentile risk. Yikes.",
        "I'd put this through insurance, but they, ah... let me go on Tuesday.",
        "Between jobs right now! But statistically, SOMETHING'll turn up, right?",
        "As your former-ish insurance guy: please, PLEASE stop totaling cars.",
        "I updated your premium in my head. It made me a little nauseous."
    ];
    // RAPHAEL — the uncle. Stout, smug, gold chain, cigar. Adores Hillel ("mein
    //   kind"), needles Lulu, can't stand Tammy, and once talked Hillel into a
    //   $2,000 "miracle" turbo part that never worked (he'll bring it up).
    var RAPHAEL_LINES = [
        "Oy, THIS one. Always was the clumsy little niece, nu?",
        "Hillel! Mein kind — did you tell her about the turbo I found you? A METSIAH.",
        "Two THOUSAND dollars that part, and feh, never worked. But Hillel TRIED. Good boy.",
        "Your sister Tammy? Don't get me started. But Hillel — Hillel is FAMILY.",
        "In MY day we didn't crash cars, we DROVE them. Properly.",
        "I'd lend you gelt for the bill, but, eh... I'm saving it. For Hillel."
    ];
    // ── THE WIDER CAST drops by the ER bedside — a random cameo (or two) per
    //    visit, each with their own shtick. Tammy still treats her; THESE are the
    //    well-wishers, hecklers and weirdos who wander in. ~50 lines in all. ──
    var BUBBE_ER = [
        "I brought CHOLENT. You'll eat it ALL — you're skin and bones, mamaleh.",
        "A hospital?! Did they even offer you tea? No? FEH. Barbarians.",
        "I lit a candle for you. And one for the other driver. I'm FAIR.",
        "Your cousin Esti would NEVER crash. I'm just SAYING, sweetheart.",
        "When I was your age we didn't HAVE cars. We walked. Uphill. BOTH ways.",
        "Eat. Eat! The nurse is too skinny also. EVERYONE in here, eat!"
    ];
    var AVIGAIL_ER = [
        "Crashed AGAIN? And here I am — engaged AND completely unscratched. 💍",
        "I'd sign your cast, but I JUST got my nails done. You understand.",
        "I only came to see if it was as bad as everyone's saying. ...It is. 💅",
        "Should I post this? For your followers? Oh wait — you have none.",
        "Get well soon-ish. The wedding's Sunday and you are NOT on the list."
    ];
    var DOC_ER = [
        "Second opinion: yep, still reckless. That'll be another ★50.",
        "I'm not your doctor. I just heard there was DRAMA. Please, continue.",
        "Good news: you're alive! Bad news: we're fresh out of lollipops.",
        "We googled your symptoms. WebMD says, and I quote, 'stop doing that.'",
        "Your X-ray is GORGEOUS. Frame-worthy. Still broken, mind you.",
        "Filing this on insurance? *laughs in medical bill* Oh, you're serious."
    ];
    var COP_ER = [
        "Just making sure you didn't ESCAPE. ...Don't get any ideas.",
        "Officer Krupke. We've MET. Several times. This week, actually.",
        "Heal up quick — your court date waits for NO ONE, ma'am.",
        "Love the gown. Very 'flight risk.' I'll be right outside. 👮"
    ];
    var RABBI_ER = [
        "Refuah shleimah, Lulu. And maybe — just maybe — slow down a little?",
        "I'm not saying it's a SIGN. But your bumper did say 'HONK FOR MOSHIACH.'",
        "Everyone makes mistakes. You just make yours at eighty miles an hour.",
        "I'll add you to the Mi Shebeirach. Under the 'frequent flyers' section.",
        "They say G-d watches over fools and children. You, He double-shifts."
    ];
    var CLOWN_ER = [
        "Wrong ward — I do the KIDS' floor — but honk honk anyway! 🤡",
        "Balloon animal? This one's a... totaled sedan. Too soon? 🎈",
        "Why the long face? Oh. Right. The car. ...Tough crowd tonight.",
        "Knock knock! Who's there? Your insurance adjuster! (It is not.)"
    ];
    var KID_ER = [
        "Are you the lady who hit the ICE CREAM TRUCK?! You're a LEGEND. 🍦",
        "My mom says you drive like a 'farkakteh.' What's a farkakteh?",
        "Can I have your wheelchair when you're done? I wanna go FAST.",
        "I drew you a picture! It's the crash. There's a LOT of red, see?"
    ];
    var OLDMAN_ER = [
        "In MY day a fender-bender meant a handshake and a brisket. FEH.",
        "You drive like your grandmother. And SHE'S banned from the roads!",
        "I had a car just like yours. Once. Before YOU were allowed to drive.",
        "*adjusts hearing aid* They said you crashed into a WHAT now?"
    ];
    // Expand a character's line list into individual cameo entries.
    function erCameoSet(who, p, body, accent, sub, lines, extra) {
        var out = [];
        for (var i = 0; i < lines.length; i++) {
            var c = { who: who, p: p, body: body, accent: accent, sub: sub, text: lines[i] };
            if (extra) for (var k in extra) c[k] = extra[k];
            out.push(c);
        }
        return out;
    }
    var ER_CAMEOS = [].concat(
        erCameoSet("HILLEL", "hillel", "hillel", "#90CAF9", "🧮 Tammy's husband — the actuary (between jobs)", HILLEL_LINES, { hillel: true }),
        erCameoSet("UNCLE RAPHAEL", "raphael", "raphael", "#FFB74D", "💢 your uncle — adores Hillel, not you", RAPHAEL_LINES),
        erCameoSet("BUBBE", "bubbe", "bubbe", "#C5A880", "👵 she brought food. obviously.", BUBBE_ER),
        erCameoSet("AVIGAIL", "avigail", "avigail", "#B39DDB", "💅 your nemesis — here to gloat", AVIGAIL_ER),
        erCameoSet("A NOSY DOCTOR", "doctor", "doctor", "#80CBC4", "🩺 not even your doctor", DOC_ER),
        erCameoSet("OFFICER KRUPKE", "cop", "cop", "#5C6BC0", "👮 keeping an eye on you", COP_ER),
        erCameoSet("THE RABBI", "rabbi", "rabbi", "#CFD8DC", "✡️ here for a refuah shleimah", RABBI_ER),
        erCameoSet("BOZO THE CLOWN", "clown", "clown", "#FF8A80", "🤡 lost from the kids' ward", CLOWN_ER),
        erCameoSet("SOME KID", "kid", "kid", "#A5D6A7", "🧒 a little fan, kind of", KID_ER),
        erCameoSet("A NOSY ZAIDY", "oldman", "oldman", "#B0BEC5", "👴 unimpressed by your generation", OLDMAN_ER)
    );
    // Build the (possibly empty) bedside-visit script for this ER trip.
    function buildErVisit() {
        if (Math.random() < 0.28) return { lines: [], hillel: false };           // nobody today
        var first = randPick(ER_CAMEOS);
        var lines = [first], hillel = !!first.hillel;
        if (Math.random() < 0.22) {                                              // a SECOND well-wisher wanders in
            var second = randPick(ER_CAMEOS);
            if (second.who !== first.who) { lines.push(second); if (second.hillel) hillel = true; }
        }
        return { lines: lines, hillel: hillel };
    }

    // Wake her up in the ER. Returns true (so callers can use it as a reprieve).
    function beginHospital(reason) {
        save.erVisits = (save.erVisits || 0) + 1; persistSave();
        var greet = save.erVisits >= 3 && Math.random() < 0.7 ? randPick(DOC_REPEAT) : randPick(DOC_GREET);
        // Tammy's working today (she always is). Her mood sets the bill multiplier.
        var moods = ["sweet", "scold", "gossip"], tm = randPick(moods);
        var visit = buildErVisit();
        hospital = { phase: 0, t: 0, typeT: 0, reason: reason || "crash",
                     diagnosis: randPick(DIAGNOSES), greet: greet,
                     options: HOSP_OPTIONS, choice: -1, bill: 0, applied: false, ekg: 0, line: null,
                     caught: false, lines: null, li: 0,
                     visit: visit.lines, visitStep: 0, hillelVisited: visit.hillel, claimMsg: null,
                     tammyMood: tm, tammyDiscount: tm === "sweet" ? 0 : tm === "gossip" ? 0.5 : 1.0,
                     tammyGreet: randPick(TAMMY_GREET[tm]), tammyCare: randPick(TAMMY_CARE[tm]) };
        copChase = null; copBust = null; copStop = null;
        erMusic = Math.random() < 0.5 ? "er1" : "er2";   // random ER song this visit
        playTone(880, 0.1, "sine", 0.06); setTimeout(function () { playTone(880, 0.1, "sine", 0.06); }, 700);
        state = "hospital";
        return true;
    }

    function hospOptRect(i) { return { x: 22, y: H - 162 + i * 46, w: W - 44, h: 40 }; }

    // typewriter helpers (shared shape with the courtroom)
    function hospTyped(full) { return full.slice(0, Math.floor(hospital.typeT * 45)); }
    function hospDone(full) { return Math.floor(hospital.typeT * 45) >= full.length; }

    // ── escape particle helpers (glass shards / dust puffs / skid smoke) ──
    function erGlass(x, y) {
        for (var i = 0; i < 5; i++) particles.push({ x: x + rand(-14, 14), y: y + rand(-12, 12),
            vx: rand(-160, 160), vy: rand(-220, -40), life: 0.9, maxLife: 0.9, size: rand(3, 6),
            color: randPick(["#CFEFF6", "#9FD2E0", "#E3F4F8"]), gravity: 520, glass: true });
    }
    function erDust(x, y) {
        for (var i = 0; i < 2; i++) particles.push({ x: x + rand(-6, 6), y: y + rand(-3, 3),
            vx: rand(-40, 40), vy: rand(-30, -8), life: 0.6, maxLife: 0.6, size: rand(5, 10),
            color: randPick(["#B0BEC5", "#CFD8DC", "#ECEFF1"]), gravity: -30, smoke: true });
    }
    function erSpawnFx() {
        if (!hospital || hospital.phase !== 4) return;
        var v = hospital.escape.visual, prog = clamp(hospital.escT / 2.3, 0, 1);
        var gy = Math.min(H * 0.62, 470) - 24;
        if (v === "window") { if (hospital.escT < 0.5) erGlass(W * 0.5, 116); }
        else if (v === "chair") erDust(lerp(W * 0.26, W * 0.82, prog) - 14, gy + 22);
        else if (v === "gurney") erDust(lerp(-50, W + 50, prog) - 26, gy + 20);
        else if (v === "coat") { if (Math.random() < 0.25) erDust(lerp(W * 0.34, W * 0.76, prog), gy + 18); }
        else if (v === "vent") { if (Math.random() < 0.4) erDust(W * 0.5 + rand(-6, 6), 150); }
    }

    function updateHospital(dt) {
        hospital.t += dt; hospital.typeT += dt; hospital.ekg += dt;
        if (typeof updateParticles === "function") updateParticles(dt);
        if (hospital.phase === 0) {                 // coming to
            if (hospital.t > 1.6 || consumeTap()) {
                hospital.phase = 1; hospital.t = 0; hospital.typeT = 0;
                hospital.line = hospital.greet + " You've got " + hospital.diagnosis + ".";
            }
            return;
        }
        if (hospital.phase === 1) {                 // doctor's diagnosis
            if (consumeTap()) {
                if (!hospDone(hospital.line)) { hospital.typeT = 999; return; }
                hospital.phase = 7; hospital.t = 0; hospital.typeT = 0;   // → Tammy clocks her
                hospital.line = hospital.tammyGreet;
                playTone(740, 0.08, "sine", 0.08);
            }
            return;
        }
        if (hospital.phase === 7) {                 // NURSE TAMMY recognizes her sister
            if (consumeTap()) {
                if (!hospDone(hospital.line)) { hospital.typeT = 999; return; }
                if (hospital.visit && hospital.visit.length) {   // the in-laws dropped by
                    hospital.phase = 8; hospital.visitStep = 0; hospital.t = 0; hospital.typeT = 0;
                    hospital.line = hospital.visit[0].text;
                    playTone(hospital.visit[0].p === "hillel" ? 500 : 300, 0.08, "sine", 0.08);
                } else {
                    hospital.phase = 2; hospital.t = 0;
                }
            }
            return;
        }
        if (hospital.phase === 8) {                 // family bedside visit (Hillel / Raphael)
            if (consumeTap()) {
                if (!hospDone(hospital.line)) { hospital.typeT = 999; return; }
                hospital.visitStep++;
                if (hospital.visitStep >= hospital.visit.length) {
                    hospital.phase = 2; hospital.t = 0;
                } else {
                    hospital.typeT = 0; hospital.line = hospital.visit[hospital.visitStep].text;
                    playTone(hospital.visit[hospital.visitStep].p === "hillel" ? 500 : 300, 0.08, "sine", 0.08);
                }
            }
            return;
        }
        if (hospital.phase === 2) {                 // pick your care
            var click = consumeClick();
            if (click) for (var i = 0; i < hospital.options.length; i++) {
                var r = hospOptRect(i);
                if (pointInRect(click.x, click.y, r.x, r.y, r.w, r.h)) {
                    var opt = hospital.options[i];
                    hospital.choice = i; hospital.t = 0; hospital.typeT = 0;
                    consumeAction();   // drop this tap's queued action so it can't skip the cutscene
                    if (opt.dash) {
                        // She BOLTS — play a random escape attempt. ~55% she's nabbed,
                        // and if so the capture is its own random gag.
                        hospital.escape = randPick(ER_ESCAPES);
                        hospital.caughtGag = randPick(ER_CAUGHT);
                        hospital.cleanLine = randPick(ER_CLEAN);
                        hospital.caught = Math.random() < 0.55;
                        hospital.skippedBill = randInt(30, 60);   // what she owes if nabbed
                        hospital.phase = 4; hospital.escT = 0;
                        playTone(520, 0.08, "square", 0.12);
                    } else {
                        // Tammy patches her up — the family discount comes off the bill.
                        hospital.phase = 3;
                        hospital.bill = Math.round(rand(25, 55) * opt.billMul * hospital.tammyDiscount);
                        hospital.line = hospital.tammyCare;
                        playTone(660, 0.06, "sine", 0.1);
                    }
                    return;
                }
            }
            return;
        }
        if (hospital.phase === 3) {                 // result → discharge (paid care)
            if (!hospital.applied) {
                hospital.applied = true;
                var opt = hospital.options[hospital.choice];
                // If Hillel dropped by, he "files the claim" on her behalf — his
                // old insurance instincts kick in. Sometimes it lands (a discount),
                // sometimes it's denied (he doesn't actually work there anymore).
                if (hospital.hillelVisited && hospital.bill > 0) {
                    if (Math.random() < 0.55) {
                        var cut = Math.round(hospital.bill * rand(0.4, 0.6));
                        hospital.bill -= cut; hospital.claim = cut;
                        hospital.claimMsg = "📋 Hillel filed your claim — APPROVED! −★" + cut;
                    } else {
                        hospital.claimMsg = "📋 Hillel's claim DENIED — he doesn't work there anymore. 😬";
                    }
                }
                if (hospital.bill > 0) {
                    hospital.paid = chargeCoins(hospital.bill);   // medical bill out of her coins
                }
                lives = Math.max(1, (typeof lives !== "undefined" ? lives : 1) + (opt.extra ? 1 : 0));
            }
            if (hospital.t > 0.6 && consumeTap()) {
                if (!hospDone(hospital.line)) { hospital.typeT = 999; return; }
                hospital = null;
                beginExitScene("hospital", "drive", "🩹 Discharged — drive safe!");
            }
            return;
        }
        if (hospital.phase === 4) {                 // ESCAPE ATTEMPT (the funny try)
            if (hospital.escT === 0 && hospital.escape.visual === "window") playTone(260, 0.18, "sawtooth", 0.16);
            hospital.escT += dt;
            erSpawnFx();
            if (hospital.escT > 2.3) {
                if (hospital.caught) { hospital.phase = 5; hospital.escT = 0; shakeTimer = 0.25; shakeIntensity = 5; playTone(200, 0.12, "square", 0.14);
                    // Nabbed → the bill she tried to skip gets collected at booking,
                    // so getting caught ALWAYS stings even if the court later lets her off.
                    hospital.billCollected = chargeCoins(hospital.skippedBill || 0);
                }
                else { hospital.phase = 6; hospital.t = 0; playTone(680, 0.1, "triangle", 0.16);
                       setTimeout(function () { playTone(988, 0.12, "triangle", 0.16); }, 110); }
            }
            return;
        }
        if (hospital.phase === 5) {                 // CAUGHT — the gag plays, then arrest
            if (shakeTimer > 0) shakeTimer -= dt;
            hospital.escT += dt;
            if (hospital.escT > 2.4 || (hospital.escT > 1.0 && consumeTap())) {
                hospital = null;
                if (typeof beginArrest === "function") beginArrest(["SKIPPING A MEDICAL BILL", "FLEEING IN A GOWN"]);
                else if (typeof returnToDriving === "function") returnToDriving();
            }
            return;
        }
        if (hospital.phase === 6) {                 // CLEAN GETAWAY
            hospital.t += dt;
            if (hospital.t > 1.7 || consumeTap()) {
                hospital = null;
                beginExitScene("hospital", "drive", "🏃 Skipped the bill — GONE!");
            }
            return;
        }
    }

    // ── ER room pieces (depth + lighting, like the courtroom revamp) ──────
    // Perspective vinyl floor: seams converge to a vanishing point + ceiling-
    // light reflections streak toward the viewer.
    function drawErPerspFloor(topY) {
        var fg = ctx.createLinearGradient(0, topY, 0, H);
        fg.addColorStop(0, "#C4D8D4"); fg.addColorStop(1, "#8AAEA9");
        ctx.fillStyle = fg; ctx.fillRect(0, topY, W, H - topY);
        ctx.save(); ctx.beginPath(); ctx.rect(0, topY, W, H - topY); ctx.clip();
        var vpx = W / 2, vpy = topY - 70;
        ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1.5;
        for (var bx = -W * 0.5; bx <= W * 1.5; bx += W / 9) { ctx.beginPath(); ctx.moveTo(vpx, vpy); ctx.lineTo(bx, H + 4); ctx.stroke(); }
        ctx.strokeStyle = "rgba(0,0,0,0.07)";
        var seams = [0.13, 0.30, 0.52, 0.78, 1.0];
        for (var s = 0; s < seams.length; s++) { var yy = topY + (H - topY) * seams[s]; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
        // glossy reflections under the two ceiling panels
        ctx.fillStyle = "rgba(255,255,245,0.07)";
        for (var r = 0; r < 2; r++) { var rx = W * (0.3 + r * 0.4); ctx.beginPath(); ctx.moveTo(rx - 12, topY); ctx.lineTo(rx + 12, topY); ctx.lineTo(rx + 44, H); ctx.lineTo(rx - 44, H); ctx.closePath(); ctx.fill(); }
        ctx.restore();
    }
    // A ticking wall clock.
    function drawErClock(cx, cy, r) {
        ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#90A4AE"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "#B0BEC5"; ctx.lineWidth = 1;
        for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2)); ctx.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4)); ctx.stroke(); }
        var mn = gameTime * 0.12 - Math.PI / 2, sc = gameTime * 1.4 - Math.PI / 2;
        ctx.strokeStyle = "#37474F"; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(mn) * r * 0.5, cy + Math.sin(mn) * r * 0.5); ctx.stroke();
        ctx.strokeStyle = "#E53935"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sc) * r * 0.8, cy + Math.sin(sc) * r * 0.8); ctx.stroke();
        ctx.fillStyle = "#37474F"; ctx.beginPath(); ctx.arc(cx, cy, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    // The whole clinical room: walls, ceiling lights+glow, floor, decor, monitor,
    // IV pole (with a falling drip), and the privacy curtain.
    function drawErRoom(erFloor, bedY) {
        // — back wall: clinical mint + lower wainscot band + trim rail —
        var bg = ctx.createLinearGradient(0, 0, 0, erFloor);
        bg.addColorStop(0, "#DCEEEB"); bg.addColorStop(0.62, "#C2E0DB"); bg.addColorStop(1, "#AAD0CB");
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, erFloor);
        var wainTop = erFloor - 64;
        ctx.fillStyle = "#9FC4BF"; ctx.fillRect(0, wainTop, W, erFloor - wainTop);
        ctx.fillStyle = "#6F9B96"; ctx.fillRect(0, wainTop - 4, W, 4);
        ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(0, wainTop, W, 1.5);
        ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 1;
        for (var ty = 34; ty < wainTop; ty += 36) { ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke(); }

        // — ceiling fluorescent panels + soft glow cones (subtle flicker) —
        var flick = Math.sin(hospital.ekg * 37) > -0.85 ? 1 : 0.55;
        for (var p = 0; p < 2; p++) {
            var lx = W * (0.3 + p * 0.4), lw = 92;
            var cone = ctx.createLinearGradient(0, 6, 0, erFloor);
            cone.addColorStop(0, "rgba(255,255,240," + (0.22 * flick) + ")"); cone.addColorStop(1, "rgba(255,255,240,0)");
            ctx.fillStyle = cone; ctx.beginPath();
            ctx.moveTo(lx - lw / 2, 8); ctx.lineTo(lx + lw / 2, 8); ctx.lineTo(lx + lw, erFloor); ctx.lineTo(lx - lw, erFloor); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#CFD8DC"; roundRect(lx - lw / 2, 5, lw, 13, 3); ctx.fill();
            ctx.fillStyle = "rgba(255,255,238," + flick + ")"; roundRect(lx - lw / 2 + 3, 7, lw - 6, 9, 2); ctx.fill();
        }

        // — back-wall decor —
        // a glowing red-cross emblem behind the bed
        ctx.save(); ctx.globalAlpha = 0.9; ctx.translate(W / 2, 120);
        ctx.fillStyle = "#FFF"; roundRect(-26, -26, 52, 52, 10); ctx.fill();
        ctx.strokeStyle = "#E0E0E0"; ctx.lineWidth = 2; roundRect(-26, -26, 52, 52, 10); ctx.stroke();
        ctx.fillStyle = "#E53935"; ctx.fillRect(-7, -19, 14, 38); ctx.fillRect(-19, -7, 38, 14);
        ctx.restore();
        drawErClock(W * 0.86, 92, 17);                                            // wall clock (clear of the coin HUD)
        // eye-chart poster (upper-left)
        ctx.fillStyle = "#FFF"; roundRect(20, 30, 40, 50, 3); ctx.fill();
        ctx.fillStyle = "#37474F";
        var ech = ["E", "F P", "T O Z", "L P E D"];
        for (var ei = 0; ei < ech.length; ei++) drawText(ech[ei], 40, 40 + ei * 11, "bold " + (10 - ei * 1.6) + "px Arial", "#37474F", null, 0);
        // hand-sanitizer dispenser on the wall (right of center)
        ctx.fillStyle = "#ECEFF1"; roundRect(W * 0.5 + 70, 150, 16, 26, 3); ctx.fill();
        ctx.fillStyle = "#80CBC4"; roundRect(W * 0.5 + 72, 154, 12, 12, 2); ctx.fill();
        ctx.fillStyle = "#455A64"; roundRect(W * 0.5 + 75, 176, 6, 4, 1); ctx.fill();

        // — perspective vinyl floor —
        drawErPerspFloor(erFloor);
        ctx.fillStyle = "#6F9B96"; ctx.fillRect(0, erFloor - 1, W, 3);

        // — supply cabinet against the left wainscot —
        ctx.fillStyle = "#CFD8DC"; roundRect(8, wainTop - 30, 56, erFloor - (wainTop - 30) - 2, 3); ctx.fill();
        ctx.strokeStyle = "#90A4AE"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(36, wainTop - 28); ctx.lineTo(36, erFloor - 4); ctx.stroke();
        for (var sh = wainTop - 14; sh < erFloor - 6; sh += 16) { ctx.beginPath(); ctx.moveTo(10, sh); ctx.lineTo(62, sh); ctx.stroke(); }
        ctx.fillStyle = "#90A4AE"; ctx.fillRect(30, wainTop - 18, 3, 6); ctx.fillRect(39, wainTop - 18, 3, 6);

        // — privacy curtain (right), gently swaying —
        ctx.fillStyle = "#90A4AE"; ctx.fillRect(W * 0.66, 64, W * 0.34, 5);          // rail
        for (var cu = 0; cu < 6; cu++) {
            var sway = Math.sin(gameTime * 1.1 + cu * 0.6) * 2;
            ctx.fillStyle = cu % 2 ? "rgba(150,200,210,0.40)" : "rgba(120,180,200,0.34)";
            roundRect(W * 0.67 + cu * 24 + sway, 70, 21, erFloor - 78, 5); ctx.fill();
        }

        // — heart monitor on a rolling stand (left) —
        var mx = 22, my = 92, mw = 116, mh = 64;
        ctx.strokeStyle = "#90A4AE"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx + mw / 2, my + mh + 14); ctx.lineTo(mx + mw / 2, erFloor - 12); ctx.stroke();
        ctx.fillStyle = "#263238"; roundRect(mx - 6, my - 6, mw + 12, mh + 22, 7); ctx.fill();
        ctx.fillStyle = "#0A140F"; roundRect(mx, my, mw, mh, 3); ctx.fill();
        ctx.strokeStyle = "#39FF7A"; ctx.lineWidth = 2; ctx.beginPath();
        for (var ssx = 0; ssx <= mw; ssx += 4) {
            var t = (ssx / mw) * 6 + hospital.ekg * 4, beat = (t % 6);
            var sy = my + mh / 2 - (beat > 2.6 && beat < 3.2 ? Math.sin((beat - 2.6) / 0.6 * Math.PI) * 20 : 0);
            if (ssx === 0) ctx.moveTo(mx + ssx, sy); else ctx.lineTo(mx + ssx, sy);
        }
        ctx.stroke();
        drawText((Math.sin(hospital.ekg * 6) > 0 ? "♥ " : "  ") + (78 + Math.floor(Math.sin(hospital.ekg) * 6)) + " BPM",
            mx + mw - 4, my + mh - 6, "bold 11px 'Segoe UI', Arial, sans-serif", "#39FF7A", "#000", 2, "right");

        // — IV pole (right) with a falling drip —
        var ivx = W - 40;
        ctx.strokeStyle = "#CFD8DC"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ivx, 72); ctx.lineTo(ivx, erFloor - 10); ctx.stroke();
        ctx.fillStyle = "#90A4AE"; ctx.beginPath(); ctx.moveTo(ivx - 10, 72); ctx.lineTo(ivx + 10, 72); ctx.lineTo(ivx, 64); ctx.closePath(); ctx.fill();   // hook
        ctx.fillStyle = "rgba(255,205,210,0.92)"; roundRect(ivx - 9, 82, 18, 30, 5); ctx.fill();   // saline bag
        ctx.fillStyle = "#EF9A9A"; roundRect(ivx - 9, 82, 18, 30 * 0.4, 5); ctx.fill();
        ctx.fillStyle = "#FFF"; roundRect(ivx - 4, 112, 8, 7, 1); ctx.fill();                          // drip chamber
        var drop = (gameTime % 1.1) / 1.1;                                                            // a drop falling down the line
        ctx.fillStyle = "#EF9A9A"; ctx.beginPath(); ctx.arc(ivx, 119 + drop * 10, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#EF9A9A"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(ivx, 130); ctx.lineTo(W / 2 + 36, bedY + 2); ctx.stroke();
    }

    // A proper rolling hospital bed with Lulu tucked in (breathing, bandaged).
    function drawErBed(bedX, bedY, bedW, bedH) {
        ctx.fillStyle = "rgba(0,0,0,0.13)"; ctx.beginPath(); ctx.ellipse(bedX + bedW / 2, bedY + bedH + 36, bedW * 0.56, 9, 0, 0, Math.PI * 2); ctx.fill();
        // legs + wheels
        ctx.fillStyle = "#90A4AE"; roundRect(bedX + 4, bedY + bedH + 4, 6, 30, 2); ctx.fill(); roundRect(bedX + bedW - 10, bedY + bedH + 4, 6, 30, 2); ctx.fill();
        ctx.fillStyle = "#37474F"; ctx.beginPath(); ctx.arc(bedX + 7, bedY + bedH + 35, 5, 0, Math.PI * 2); ctx.arc(bedX + bedW - 7, bedY + bedH + 35, 5, 0, Math.PI * 2); ctx.fill();
        // headboard (left end)
        ctx.fillStyle = "#B0BEC5"; roundRect(bedX - 12, bedY - 14, 9, bedH + 22, 3); ctx.fill();
        // frame + mattress
        ctx.fillStyle = "#CFD8DC"; roundRect(bedX - 5, bedY + bedH - 7, bedW + 10, 13, 3); ctx.fill();
        ctx.fillStyle = "#F2F5F6"; roundRect(bedX, bedY, bedW, bedH, 6); ctx.fill();
        // blanket (gradient) tucked from mid-bed down
        var bl = ctx.createLinearGradient(0, bedY - 4, 0, bedY + bedH); bl.addColorStop(0, "#90CAF9"); bl.addColorStop(1, "#5AA0E8");
        ctx.fillStyle = bl; roundRect(bedX + 44, bedY - 4, bedW - 48, 26, 6); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(bedX + 44, bedY - 2, bedW - 48, 2);
        // pillow
        ctx.fillStyle = "#FFF"; roundRect(bedX + 2, bedY - 8, 40, 26, 8); ctx.fill();
        // front safety rail
        ctx.strokeStyle = "#B0BEC5"; ctx.lineWidth = 2.5; roundRect(bedX + 34, bedY + bedH - 1, bedW - 44, 13, 4); ctx.stroke();
        // hanging chart clipboard on the foot rail
        ctx.save(); ctx.translate(bedX + bedW + 2, bedY + bedH + 4); ctx.rotate(0.1);
        ctx.fillStyle = "#8D6E63"; roundRect(-7, 0, 15, 19, 2); ctx.fill();
        ctx.fillStyle = "#FFF"; roundRect(-5, 2, 11, 14, 1); ctx.fill();
        ctx.strokeStyle = "#CFD8DC"; ctx.lineWidth = 0.7; for (var cl = 5; cl < 15; cl += 3) { ctx.beginPath(); ctx.moveTo(-3, cl); ctx.lineTo(4, cl); ctx.stroke(); }
        ctx.restore();
        // Lulu: head on the pillow, gentle breathing bob, head bandage, dizzy eyes
        var br = Math.sin(gameTime * 2) * 0.7, hx = bedX + 23, hy = bedY + 5 + br;
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(hx, hy, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(hx, hy, 9.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = save.luluHair || "#8B5A2B"; ctx.beginPath(); ctx.arc(hx, hy - 3, 9.6, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFF"; ctx.save(); ctx.translate(hx - 1, hy - 6); ctx.rotate(-0.35); ctx.fillRect(-8, -2, 16, 4); ctx.restore();   // bandage wrap
        ctx.fillStyle = "#E53935"; ctx.fillRect(hx + 5, hy - 9, 2.4, 2.4);                                                                  // tiny cross
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 1; ctx.beginPath();                                                                    // woozy closed eyes
        ctx.arc(hx - 3, hy + 1, 1.7, 0.12 * Math.PI, 0.88 * Math.PI); ctx.arc(hx + 3, hy + 1, 1.7, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
        ctx.fillStyle = "rgba(255,140,140,0.55)"; ctx.beginPath(); ctx.arc(hx - 5, hy + 5, 1.7, 0, Math.PI * 2); ctx.arc(hx + 5, hy + 5, 1.7, 0, Math.PI * 2); ctx.fill();
        // an arm in a sling resting on the blanket
        ctx.fillStyle = "#FFF"; ctx.save(); ctx.translate(hx + 34, hy + 12); ctx.rotate(0.22); roundRect(-5, -4, 26, 9, 4); ctx.fill();
        ctx.strokeStyle = "#E0E0E0"; ctx.lineWidth = 1; roundRect(-5, -4, 26, 9, 4); ctx.stroke(); ctx.restore();
    }

    function drawHospital() {
        // ── high-quality clinical ER room (bounded so it doesn't stretch tall) ──
        var erFloor = Math.min(H * 0.62, 470);
        var bedY = erFloor - 96, bedX = W / 2 - 70, bedW = 150, bedH = 40;
        drawErRoom(erFloor, bedY);
        // a soft warm spotlight pools on the bed (focus, like the courtroom)
        var pool = ctx.createRadialGradient(bedX + bedW / 2, bedY + 8, 12, bedX + bedW / 2, bedY + 8, 150);
        pool.addColorStop(0, "rgba(255,250,228,0.22)"); pool.addColorStop(1, "rgba(255,250,228,0)");
        ctx.fillStyle = pool; ctx.beginPath(); ctx.ellipse(bedX + bedW / 2, bedY + 14, 132, 92, 0, 0, Math.PI * 2); ctx.fill();

      if (hospital.phase >= 4 && hospital.phase <= 6) {
        // she's not in bed anymore — she's making a break for it
        drawErEscape(erFloor);
      } else {
        drawErBed(bedX, bedY, bedW, bedH);
        // ── bedside: Nurse Tammy (left) always; the right slot is the doctor,
        //    or — during the family visit — Hillel or Uncle Raphael. ──
        var visC = (hospital.phase === 8) ? hospital.visit[hospital.visitStep] : null;
        if (visC) {
            if (visC.body === "hillel") drawHillel(W / 2 + 74, bedY - 6, gameTime, true);
            else if (visC.body === "raphael") drawRaphael(W / 2 + 74, bedY - 6, gameTime, true);
            else if (visC.body === "doctor") drawDoctor(W / 2 + 72, bedY - 6, gameTime, true);
            else drawErGuest(W / 2 + 74, bedY - 6, gameTime, visC.body, true, visC.who, visC.accent);
        } else {
            drawDoctor(W / 2 + 72, bedY - 6, gameTime, hospital.phase === 1);
        }
        drawNurse(W / 2 - 74, bedY - 6, gameTime, hospital.phase === 7 || hospital.phase === 3 || hospital.phase === 8);
      }

        // soft vignette to frame the lit scene
        var vg = ctx.createRadialGradient(W / 2, erFloor * 0.6, 80, W / 2, H * 0.5, H * 0.7);
        vg.addColorStop(0, "rgba(10,30,28,0)"); vg.addColorStop(1, "rgba(10,30,28,0.32)");
        ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

        // title
        drawText("🏥 THE ER", W / 2, 34, "bold 26px 'Segoe UI', Arial, sans-serif", "#00897B", "#FFF", 4);
        drawCoinHud();   // her coin bank — watch the bill come out of it

        // ── phase overlays ──
        if (hospital.phase === 0) {
            ctx.fillStyle = "rgba(230,245,243," + clamp(1 - hospital.t / 1.6, 0, 1) * 0.85 + ")"; ctx.fillRect(0, 0, W, H);
            drawText("...beep... beep...", W / 2, H / 2, "bold 20px 'Segoe UI', Arial, sans-serif", "#00897B", "#FFF", 3);
        } else if (hospital.phase === 1) {
            var d1 = hospDone(hospital.line);
            drawDialogueBox("DR. SHTERN", hospTyped(hospital.line), "doctor", "#80CBC4", d1, !d1);
        } else if (hospital.phase === 7) {
            var d7 = hospDone(hospital.line);
            drawDialogueBox("NURSE TAMMY", hospTyped(hospital.line), "tammy", "#F48FB1", d7, !d7);
            drawText("👩‍⚕️ your big SISTER works here!", W / 2, H - 168, "bold 12px 'Segoe UI', Arial, sans-serif", "#F8BBD0", "#000", 3);
        } else if (hospital.phase === 8) {
            var v8 = hospital.visit[hospital.visitStep], d8 = hospDone(hospital.line);
            drawDialogueBox(v8.who, hospTyped(hospital.line), v8.p, v8.accent, d8, !d8);
            if (v8.sub) drawText(v8.sub, W / 2, H - 168, "bold 12px 'Segoe UI', Arial, sans-serif", "#E1F5FE", "#000", 3);
        } else if (hospital.phase === 2) {
            ctx.fillStyle = "rgba(0,40,38,0.78)"; roundRect(14, H - 200, W - 28, 190, 12); ctx.fill();
            ctx.strokeStyle = "#26A69A"; ctx.lineWidth = 2; roundRect(14, H - 200, W - 28, 190, 12); ctx.stroke();
            drawText("🏥 How do you want your care?", W / 2, H - 182, "bold 14px 'Segoe UI', Arial, sans-serif", "#B2DFDB", "#000", 3);
            for (var i = 0; i < hospital.options.length; i++) {
                var r = hospOptRect(i), opt = hospital.options[i];
                var pBill = Math.round(40 * opt.billMul);
                drawButton(r.x, r.y, r.w, r.h, opt.label + (opt.dash ? "  (free — RISKY!)" : "  (~💰" + pBill + ")"),
                    { bg: opt.dash ? "#EF6C00" : "#00897B", bgDark: opt.dash ? "#BF360C" : "#004D40", small: true });
            }
        } else if (hospital.phase === 3) {
            var d3 = hospDone(hospital.line);
            drawDialogueBox("NURSE TAMMY", hospTyped(hospital.line), "tammy", "#F48FB1", hospital.t > 0.6 && d3, !d3);
            if (hospital.applied) {
                if (hospital.claimMsg)
                    drawText(hospital.claimMsg, W / 2, H - 202, "bold 12px 'Segoe UI', Arial, sans-serif",
                        hospital.claim ? "#90CAF9" : "#FFAB91", "#000", 3);
                if (hospital.tammyDiscount < 1)
                    drawText("👩‍⚕️ family discount applied!", W / 2, H - 186, "bold 12px 'Segoe UI', Arial, sans-serif", "#A5D6A7", "#000", 3);
                if (hospital.bill > 0)
                    drawText("🧾 −" + hospital.paid + " 💰 medical bill", W / 2, H - 168, "bold 14px 'Segoe UI', Arial, sans-serif", "#FF8A80", "#000", 3);
                else
                    drawText("🩹 on the house — don't tell the boss!", W / 2, H - 168, "bold 13px 'Segoe UI', Arial, sans-serif", "#A5D6A7", "#000", 3);
            }
        } else if (hospital.phase === 4) {
            // the escape ATTEMPT caption
            erCaption(hospital.escape.attempt, "#FFE082");
        } else if (hospital.phase === 5) {
            // BUSTED gag caption (in red)
            erCaption(hospital.caughtGag.line, "#FF8A80");
            if (hospital.escT > 1.0) {
                var bl = 0.4 + 0.6 * Math.abs(Math.sin(gameTime * 6));
                ctx.globalAlpha = bl; drawText("🚨 BUSTED 🚨", W / 2, H * 0.30, "bold 22px 'Segoe UI', Arial, sans-serif", "#FF1744", "#000", 5); ctx.globalAlpha = 1;
                if (hospital.billCollected > 0)
                    drawText("🧾 they collected your ★" + hospital.billCollected + " bill anyway", W / 2, H * 0.30 + 26,
                        "bold 12px 'Segoe UI', Arial, sans-serif", "#FFCDD2", "#000", 3);
            }
        } else if (hospital.phase === 6) {
            erCaption(hospital.cleanLine, "#7CFC4F");
        }
    }

    // A centered caption card for the escape cutscene beats.
    function erCaption(text, accent) {
        ctx.font = "bold 15px 'Segoe UI', Arial, sans-serif";
        var lines = wrapLines(text, W - 80, "bold 15px 'Segoe UI', Arial, sans-serif");
        var bh = 18 + lines.length * 20, by = H - bh - 40, bw = W - 36, bx = 18;
        ctx.fillStyle = "rgba(10,20,18,0.86)"; roundRect(bx, by, bw, bh, 12); ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 2.5; roundRect(bx, by, bw, bh, 12); ctx.stroke();
        for (var i = 0; i < lines.length; i++)
            drawText(lines[i], W / 2, by + 16 + i * 20, "bold 15px 'Segoe UI', Arial, sans-serif", "#F3F8F4", "#000", 3);
    }

    // Lulu drawn scaled/rotated (the escape uses a bigger, livelier Lulu than
    // the tiny top-down sprite). `extra` adds a quick costume (lab coat).
    function drawErLulu(x, y, s, t, mood, rot, extra) {
        ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(s, s);
        drawLuluTopDown(0, 0, t, mood);
        if (extra === "coat") {
            ctx.fillStyle = "rgba(250,250,250,0.96)"; roundRect(-14, -5, 28, 27, 8); ctx.fill();
            ctx.strokeStyle = "#CFD8DC"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 20); ctx.stroke();
            ctx.fillStyle = "#1A1A1A"; roundRect(-9, -16, 18, 5, 2); ctx.fill();        // big shades
        }
        ctx.restore();
    }
    // Speed/whoosh lines trailing a moving figure (dir: +1 moving right).
    function erSpeed(x, y, dir, n, len) {
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
        for (var i = 0; i < n; i++) { var yy = y + (i - (n - 1) / 2) * 8; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x - dir * (len + i * 5), yy); ctx.stroke(); }
        ctx.lineCap = "butt";
    }

    // The bill-skip escape scene: a random funny ATTEMPT, then (if nabbed) a
    // random funny CAPTURE. Bigger, animated, with particles.
    function drawErEscape(erFloor) {
        var e = hospital, t = e.escT || 0, gy = erFloor + 16;
        // fade the empty foreground floor into shadow so the action reads as a
        // lit "stage" instead of a half-empty room.
        var ff = ctx.createLinearGradient(0, erFloor, 0, H);
        ff.addColorStop(0, "rgba(8,24,22,0)"); ff.addColorStop(0.5, "rgba(8,24,22,0.35)"); ff.addColorStop(1, "rgba(8,24,22,0.72)");
        ctx.fillStyle = ff; ctx.fillRect(0, erFloor, W, H - erFloor);
        var shake = (e.phase === 5 && shakeTimer > 0) ? shakeIntensity : 0;
        ctx.save();
        if (shake) ctx.translate(rand(-shake, shake), rand(-shake, shake));

        if (e.phase === 4) {
            var prog = clamp(t / 2.3, 0, 1), v = e.escape.visual;
            if (v === "window") {
                drawErWindow(W * 0.5, 120);
                if (prog < 0.4) {   // shatter starburst flash at the window
                    var f = 1 - prog / 0.4;
                    ctx.strokeStyle = "rgba(255,255,255," + f + ")"; ctx.lineWidth = 3;
                    for (var r = 0; r < 8; r++) { var a = r * Math.PI / 4; ctx.beginPath(); ctx.moveTo(W * 0.5, 120); ctx.lineTo(W * 0.5 + Math.cos(a) * (20 + f * 26), 120 + Math.sin(a) * (20 + f * 26)); ctx.stroke(); }
                }
                // accelerating tumble down-and-left out of the window
                var lx = lerp(W * 0.5, W * 0.30, prog), ly = 120 + (gy - 120) * (prog * prog);
                erSpeed(lx + 30, ly - 6, 1, 4, 22);
                drawErLulu(lx, ly, 1.4, t * 9, "panic", -0.5 - prog * 2.6);
                drawText("CRASH!", W * 0.5 + 40, 96, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 3);
            } else if (v === "coat") {
                var cx = lerp(W * 0.26, W * 0.78, prog), bob = Math.abs(Math.sin(t * 6)) * 5;
                // sneaky dotted footstep trail
                ctx.fillStyle = "rgba(255,255,255,0.28)";
                for (var d = 1; d <= 4; d++) { var dx = cx - d * 26; if (dx > 30) { ctx.beginPath(); ctx.arc(dx, gy + 20, 2.5, 0, Math.PI * 2); ctx.fill(); } }
                drawErLulu(cx, gy - bob, 1.4, t * 4, "panic", 0.12, "coat");
                drawText("🤫 nothing to see here", cx, gy - 52, "bold 11px 'Segoe UI', Arial, sans-serif", "#B2DFDB", "#000", 2);
            } else if (v === "chair") {
                var wx = lerp(W * 0.24, W * 0.82, prog);
                erSpeed(wx - 34, gy + 4, 1, 4, 26);
                // big spinning back wheel + small front wheel
                ctx.save(); ctx.translate(wx - 14, gy + 14); ctx.rotate(t * 16);
                ctx.strokeStyle = "#B0BEC5"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
                ctx.lineWidth = 2; for (var sp = 0; sp < 6; sp++) { var sa = sp * Math.PI / 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(sa) * 16, Math.sin(sa) * 16); ctx.stroke(); }
                ctx.restore();
                ctx.fillStyle = "#90A4AE"; ctx.beginPath(); ctx.arc(wx + 14, gy + 18, 7, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = "#546E7A"; roundRect(wx - 16, gy + 2, 30, 6, 2); ctx.fill();   // seat
                ctx.fillStyle = "#37474F"; ctx.fillRect(wx + 13, gy - 14, 4, 22);              // push handle
                drawErLulu(wx, gy - 8, 1.3, t * 3, "panic", -0.08);
            } else if (v === "gurney") {
                var gx = lerp(-60, W + 60, prog);
                for (var k = 3; k >= 1; k--) {   // motion-blur ghost trail
                    ctx.globalAlpha = 0.16 * k; ctx.fillStyle = "#ECEFF1"; roundRect(gx - 36 - k * 26, gy + 2, 72, 14, 5); ctx.fill();
                }
                ctx.globalAlpha = 1;
                erSpeed(gx - 42, gy + 4, 1, 5, 30);
                ctx.fillStyle = "#ECEFF1"; roundRect(gx - 36, gy + 2, 72, 14, 5); ctx.fill();   // gurney
                ctx.fillStyle = "#90A4AE"; ctx.beginPath(); ctx.arc(gx - 22, gy + 20, 6, 0, Math.PI * 2); ctx.arc(gx + 22, gy + 20, 6, 0, Math.PI * 2); ctx.fill();
                // Lulu lying on it, head + flailing arms
                ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(gx - 24, gy + 2, 9, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = save.luluHair || "#8B5A2B"; ctx.beginPath(); ctx.arc(gx - 24, gy - 2, 9, Math.PI, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = C.skin; ctx.lineWidth = 3.5; ctx.lineCap = "round";
                ctx.beginPath(); ctx.moveTo(gx, gy + 2); ctx.lineTo(gx + 12, gy - 12 + Math.sin(t * 22) * 6); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(gx + 6, gy + 4); ctx.lineTo(gx + 18, gy - 6 + Math.cos(t * 22) * 6); ctx.stroke(); ctx.lineCap = "butt";
                drawText("WHEEEEE!", gx, gy - 22, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 3);
            } else { // vent
                drawErWindow(W * 0.5, 116, true);   // grate
                var kick = Math.sin(t * 13) * 6;
                // her legs kicking out of the open grate
                ctx.fillStyle = "#3F5C8A"; roundRect(W * 0.5 - 9, 132, 7, 20 + kick, 3); ctx.fill(); roundRect(W * 0.5 + 2, 132, 7, 20 - kick, 3); ctx.fill();
                ctx.fillStyle = "#FFF"; ctx.fillRect(W * 0.5 - 10, 150 + kick, 9, 4); ctx.fillRect(W * 0.5 + 1, 150 - kick, 9, 4);
                drawText("nnngh— almost—", W * 0.5, 184, "bold 12px 'Segoe UI', Arial, sans-serif", "#B2DFDB", "#000", 2);
            }
        } else {
            // ── CAUGHT GAG ──
            var v2 = e.caughtGag.visual, rev = clamp((t - 0.4) / 0.5, 0, 1);
            if (v2 === "cars") {
                // skid marks + a row of flashing cruisers, spotlight on Lulu
                ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 5;
                for (var sk = 0; sk < 3; sk++) { var scx = W * 0.22 + sk * (W * 0.28); ctx.beginPath(); ctx.moveTo(scx - 26, gy + 26); ctx.lineTo(scx, gy + 14); ctx.stroke(); }
                for (var cc = 0; cc < 3; cc++) drawCopCar(W * 0.22 + cc * (W * 0.28), gy + 2, gameTime * 6);
                // spotlight cone onto a frozen, hands-up Lulu
                ctx.fillStyle = "rgba(255,255,200,0.16)"; ctx.beginPath(); ctx.moveTo(W * 0.5, gy + 2); ctx.lineTo(W * 0.5 - 36, gy - 70); ctx.lineTo(W * 0.5 + 36, gy - 70); ctx.closePath(); ctx.fill();
                drawErLulu(W * 0.5, gy - 50, 1.3, t * 5, "cry", 0);
            } else if (v2 === "oldlady") {
                drawErLulu(W * 0.36, gy, 1.35, t * 5, "cry", 0.1);
                drawOldLadyCop(W * 0.62, gy, t);
            } else if (v2 === "doccop") {
                drawErLulu(W * 0.38, gy, 1.3, t * 5, "cry", 0.12);
                ctx.save(); ctx.translate(W * 0.6, gy - 6); ctx.scale(1.25, 1.25); drawDoctor(0, 0, gameTime, false); ctx.restore();
                // coat flaps open → badge revealed
                if (rev > 0) { ctx.globalAlpha = rev; ctx.fillStyle = "#1565C0"; roundRect(W * 0.6 - 6, gy - 8, 14, 18, 3); ctx.fill();
                    ctx.fillStyle = "#FFD700"; drawText("★", W * 0.6 + 1, gy + 1, "bold 14px Arial", "#FFD700", "#000", 2); ctx.globalAlpha = 1; }
            } else { // guard tackle
                var lunge = clamp(t / 0.5, 0, 1);
                drawErLulu(lerp(W * 0.5, W * 0.4, lunge), gy, 1.3, t * 6, "cry", -0.2 * lunge);
                ctx.save(); ctx.translate(lerp(W * 0.78, W * 0.55, lunge), gy); ctx.scale(1.3, 1.3); drawAngryMan(0, 0, t, "running", -1, true); ctx.restore();
                if (rev > 0) { // impact stars
                    ctx.fillStyle = "#FFD54F"; for (var st2 = 0; st2 < 5; st2++) { var aa = st2 * 1.25; drawText("✦", W * 0.48 + Math.cos(aa) * 22, gy - 24 + Math.sin(aa) * 16, "bold 13px Arial", "#FFD54F", "#000", 2); } }
            }
        }
        ctx.restore();
        if (typeof drawParticles === "function") drawParticles();
    }

    // A shattered ER window (also reused as a vent grate). Bigger now.
    function drawErWindow(cx, cy, grate) {
        ctx.fillStyle = "#37474F"; roundRect(cx - 42, cy - 32, 84, 64, 6); ctx.fill();
        ctx.fillStyle = grate ? "#546E7A" : "#9FD2E0"; roundRect(cx - 37, cy - 27, 74, 54, 5); ctx.fill();
        if (grate) {
            ctx.fillStyle = "#0A140F"; roundRect(cx - 28, cy - 18, 56, 36, 3); ctx.fill();   // open dark vent
            ctx.strokeStyle = "#37474F"; ctx.lineWidth = 2;
            for (var s = -22; s <= 22; s += 8) { ctx.beginPath(); ctx.moveTo(cx - 28, cy + s); ctx.lineTo(cx + 28, cy + s); ctx.stroke(); }
            // the popped-off grate cover hanging
            ctx.fillStyle = "#90A4AE"; ctx.save(); ctx.translate(cx + 30, cy + 18); ctx.rotate(0.5); roundRect(-14, -3, 28, 6, 2); ctx.fill(); ctx.restore();
        } else {
            ctx.fillStyle = "#0A140F"; ctx.beginPath();   // jagged broken hole
            ctx.moveTo(cx - 24, cy - 18); ctx.lineTo(cx - 4, cy - 24); ctx.lineTo(cx + 22, cy - 12);
            ctx.lineTo(cx + 16, cy + 16); ctx.lineTo(cx - 8, cy + 22); ctx.lineTo(cx - 28, cy + 6); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = "#CFEFF6"; ctx.lineWidth = 1.5; ctx.stroke();
        }
    }

    // A "sweet old lady" who's actually a cop — the shawl FLIES off and a police
    // cap pops up as the disguise drops, with a wagging finger.
    function drawOldLadyCop(x, y, t) {
        var reveal = clamp((t - 0.45) / 0.5, 0, 1);
        ctx.save(); ctx.translate(x, y); ctx.scale(1.3, 1.3);
        // cop body (revealed) — navy uniform
        ctx.fillStyle = "#1A237E"; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-13, 24); ctx.lineTo(13, 24); ctx.closePath(); ctx.fill();
        if (reveal < 1) {   // the shawl still partly on / flying off
            ctx.save(); ctx.globalAlpha = 1 - reveal * 0.6; ctx.translate(reveal * 34, -reveal * 40); ctx.rotate(reveal * 1.4);
            ctx.fillStyle = "#8D6E63"; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-15, 22); ctx.lineTo(15, 22); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        // head
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -14, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#E0E0E0"; ctx.beginPath(); ctx.arc(0, -18, 8, Math.PI, Math.PI * 2); ctx.fill();   // gray bun (under cap)
        ctx.strokeStyle = "#37474F"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-3, -14, 2.2, 0, Math.PI * 2); ctx.arc(3, -14, 2.2, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-3, -14, 0.9, 0, Math.PI * 2); ctx.arc(3, -14, 0.9, 0, Math.PI * 2); ctx.fill();
        // police cap drops onto her head on reveal
        if (reveal > 0) {
            ctx.save(); ctx.translate(0, -22 + (1 - reveal) * -14); ctx.globalAlpha = reveal;
            ctx.fillStyle = "#0D1457"; roundRect(-12, -2, 24, 7, 2); ctx.fill();
            ctx.fillStyle = "#1A237E"; roundRect(-9, -8, 18, 7, 2); ctx.fill();
            ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.arc(0, -4, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            // wagging finger
            var wag = Math.sin(t * 12) * 6;
            ctx.strokeStyle = C.skin; ctx.lineWidth = 3; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(-14, 4); ctx.lineTo(-22 + wag, -8); ctx.stroke(); ctx.lineCap = "butt";
        }
        ctx.restore();
        if (reveal > 0.6) drawText("FREEZE! 🚔", x, y - 40, "bold 13px 'Segoe UI', Arial, sans-serif", "#FF5252", "#000", 3);
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

    // Nurse Tammy — Lulu's big sister. Teal scrubs, nurse cap, Bruck-family hair
    // + rosy cheeks (she's clearly Lulu's sister), holding a heart chart.
    function drawNurse(x, y, t, talking) {
        var hair = (typeof save !== "undefined" && save.luluHair) || "#8B5A2B";
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0, 28, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#00897B"; roundRect(-6, 12, 5, 16, 2); ctx.fill(); roundRect(1, 12, 5, 16, 2); ctx.fill();   // teal scrub pants
        ctx.fillStyle = "#ECEFF1"; roundRect(-7, 26, 8, 4, 2); ctx.fill(); roundRect(0, 26, 8, 4, 2); ctx.fill();      // white shoes
        ctx.fillStyle = "#26A69A"; roundRect(-12, -10, 24, 24, 5); ctx.fill();                                          // scrub top
        ctx.fillStyle = "#1E8E82"; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-5, 5); ctx.lineTo(5, 5); ctx.fill(); // V-neck
        ctx.fillStyle = "#FFF"; roundRect(5, -6, 5, 4, 1); ctx.fill();                                                  // name badge
        // arm holding a little heart chart
        ctx.fillStyle = "#26A69A"; roundRect(-15, -8, 5, 14, 2); ctx.fill();
        ctx.fillStyle = "#ECEFF1"; roundRect(-19, -6, 7, 12, 1); ctx.fill();
        drawText("♥", -15.5, 0, "bold 7px Arial", "#E53935", null, 0);
        // head
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(0, -18, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -18, 7.6, 0, Math.PI * 2); ctx.fill();
        // Bruck-family hair (like Lulu) — crown + side locks
        ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, -20, 8, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-7, -15, 2.6, 6, -0.3, 0, Math.PI * 2); ctx.ellipse(7, -15, 2.6, 6, 0.3, 0, Math.PI * 2); ctx.fill();
        // nurse cap (white, red cross)
        ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.moveTo(-7.5, -23); ctx.lineTo(7.5, -23); ctx.lineTo(5, -29); ctx.lineTo(-5, -29); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#E53935"; ctx.fillRect(-1.1, -28.5, 2.2, 5); ctx.fillRect(-2.4, -27, 4.8, 2);
        // eyes + rosy cheeks
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-2.6, -18, 1.1, 0, Math.PI * 2); ctx.arc(2.6, -18, 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,140,140,0.5)"; ctx.beginPath(); ctx.arc(-4.6, -15, 1.6, 0, Math.PI * 2); ctx.arc(4.6, -15, 1.6, 0, Math.PI * 2); ctx.fill();
        if (talking) { ctx.fillStyle = "#5D2A2A"; ctx.beginPath(); ctx.ellipse(0, -13, 1.6, 0.8 + Math.abs(Math.sin(t * 15)) * 1.4, 0, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.strokeStyle = "#A0394D"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -14, 2, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke(); }
        ctx.restore();
        drawText("NURSE TAMMY", x, y + 34, "bold 8px 'Segoe UI', Arial, sans-serif", "#EC407A", "#FFF", 2);
    }

    // HILLEL — Tammy's husband. A sweaty, between-jobs actuary who still dresses
    // like the car-insurance guy he used to be: pale button-down, crooked navy
    // tie, black yarmulke, glasses, and a calculator he can't put down.
    function drawHillel(x, y, t, talking) {
        var fid = Math.sin(t * 3) * 0.04;   // nervous little sway
        ctx.save(); ctx.translate(x, y); ctx.rotate(fid);
        ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0, 28, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
        // gray slacks + brown shoes
        ctx.fillStyle = "#546E7A"; roundRect(-6, 12, 5, 16, 2); ctx.fill(); roundRect(1, 12, 5, 16, 2); ctx.fill();
        ctx.fillStyle = "#5D4037"; roundRect(-7, 26, 8, 4, 2); ctx.fill(); roundRect(0, 26, 8, 4, 2); ctx.fill();
        // pale-blue button-down shirt
        ctx.fillStyle = "#BBDEFB"; roundRect(-12, -10, 24, 24, 5); ctx.fill();
        ctx.fillStyle = "#90CAF9"; ctx.fillRect(-1, -10, 2, 24);                 // button placket
        // crooked navy tie (he's a bit of a mess)
        ctx.save(); ctx.translate(0, -8); ctx.rotate(0.2);
        ctx.fillStyle = "#1A237E"; ctx.beginPath(); ctx.moveTo(-2.5, 0); ctx.lineTo(2.5, 0); ctx.lineTo(2, 16); ctx.lineTo(-2, 16); ctx.closePath(); ctx.fill();
        ctx.restore();
        // arm clutching a calculator (the actuary)
        ctx.fillStyle = "#BBDEFB"; roundRect(-16, -6, 5, 13, 2); ctx.fill();
        ctx.fillStyle = "#37474F"; roundRect(-21, -2, 9, 11, 1); ctx.fill();     // calculator body
        ctx.fillStyle = "#80DEEA"; roundRect(-20, -1, 7, 3, 1); ctx.fill();      // screen
        ctx.fillStyle = "#90A4AE"; for (var rr = 0; rr < 2; rr++) for (var cc = 0; cc < 3; cc++) ctx.fillRect(-20 + cc * 2.4, 3 + rr * 2.4, 1.4, 1.4);
        // head
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(0, -18, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -18, 7.6, 0, Math.PI * 2); ctx.fill();
        // thinning hair: receding tufts + sideburns
        ctx.fillStyle = "#4E342E";
        ctx.beginPath(); ctx.arc(-4.5, -20, 2.8, Math.PI, 0); ctx.arc(4.5, -20, 2.8, Math.PI, 0); ctx.fill();
        ctx.fillRect(-7.6, -19, 2.2, 5); ctx.fillRect(5.4, -19, 2.2, 5);
        // black yarmulke on the crown
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(0, -23.5, 4.6, Math.PI, 0); ctx.fill();
        // glasses
        ctx.strokeStyle = "#263238"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(-2.6, -18, 2.2, 0, Math.PI * 2); ctx.arc(2.6, -18, 2.2, 0, Math.PI * 2); ctx.moveTo(-0.4, -18); ctx.lineTo(0.4, -18); ctx.stroke();
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-2.6, -18, 0.9, 0, Math.PI * 2); ctx.arc(2.6, -18, 0.9, 0, Math.PI * 2); ctx.fill();
        // worried raised brows
        ctx.strokeStyle = "#4E342E"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5, -22.5); ctx.lineTo(-1, -21.5); ctx.moveTo(1, -21.5); ctx.lineTo(5, -22.5); ctx.stroke();
        // a nervous sweat bead
        ctx.fillStyle = "rgba(130,200,240,0.9)"; ctx.beginPath(); ctx.arc(6.4, -15 + Math.abs(Math.sin(t * 4)) * 1.6, 1.4, 0, Math.PI * 2); ctx.fill();
        // mouth
        if (talking) { ctx.fillStyle = "#5D2A2A"; ctx.beginPath(); ctx.ellipse(0, -12, 1.5, 0.8 + Math.abs(Math.sin(t * 15)) * 1.3, 0, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.strokeStyle = "#5D2A2A"; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(0, -11, 1.8, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
        ctx.restore();
        drawText("HILLEL", x, y + 34, "bold 8px 'Segoe UI', Arial, sans-serif", "#42A5F5", "#FFF", 2);
    }

    // UNCLE RAPHAEL — stout and smug, gold chain over an open silk shirt, a cigar,
    // a balding pate with slicked gray sides and a thick mustache. Loves Hillel,
    // tolerates no one else.
    function drawRaphael(x, y, t, talking) {
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.ellipse(0, 28, 16, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        // dark slacks + black loafers
        ctx.fillStyle = "#37474F"; roundRect(-7, 13, 6, 15, 2); ctx.fill(); roundRect(1, 13, 6, 15, 2); ctx.fill();
        ctx.fillStyle = "#212121"; roundRect(-9, 26, 9, 4, 2); ctx.fill(); roundRect(0, 26, 9, 4, 2); ctx.fill();
        // round belly in a flashy purple shirt
        ctx.fillStyle = "#6A1B9A"; roundRect(-15, -10, 30, 26, 9); ctx.fill();
        ctx.fillStyle = "#4A148C"; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-6, 7); ctx.lineTo(6, 7); ctx.closePath(); ctx.fill();   // open collar
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-4, 3); ctx.lineTo(4, 3); ctx.closePath(); ctx.fill();        // chest
        // gold chain
        ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, -6, 5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.arc(0, -0.5, 1.4, 0, Math.PI * 2); ctx.fill();
        // arm with a cigar (+ a curl of smoke) and a pinky ring
        ctx.fillStyle = "#6A1B9A"; roundRect(11, -6, 6, 12, 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(15, 7, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFD700"; ctx.fillRect(13.4, 7.4, 1.6, 1.6);
        ctx.fillStyle = "#5D4037"; ctx.fillRect(16, 6, 9, 2.4);
        ctx.fillStyle = "#FF7043"; ctx.fillRect(24.6, 6, 1.6, 2.4);
        ctx.fillStyle = "rgba(200,200,200,0.45)"; ctx.beginPath(); ctx.arc(26 + Math.sin(t * 3) * 1.5, 2 - ((t * 6) % 8), 1.7, 0, Math.PI * 2); ctx.fill();
        // jowly head
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(0, -19, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -19, 8.6, 0, Math.PI * 2); ctx.fill();
        // balding — slicked gray sides + a shiny pate
        ctx.fillStyle = "#455A64"; ctx.beginPath(); ctx.arc(-6, -21, 3.6, Math.PI * 0.7, Math.PI * 1.9); ctx.fill(); ctx.beginPath(); ctx.arc(6, -21, 3.6, Math.PI * 1.1, Math.PI * 0.3); ctx.fill();
        ctx.fillStyle = "#546E7A"; ctx.fillRect(-8.8, -20, 2.4, 7); ctx.fillRect(6.4, -20, 2.4, 7);
        ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.beginPath(); ctx.ellipse(-1.5, -24, 3.4, 1.6, -0.3, 0, Math.PI * 2); ctx.fill();
        // smug half-lidded eyes + heavy brows
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-3, -19, 1.1, 0, Math.PI * 2); ctx.arc(3, -19, 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#37474F"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-5.5, -22); ctx.lineTo(-1, -21); ctx.moveTo(1, -21); ctx.lineTo(5.5, -22); ctx.stroke();
        // thick mustache
        ctx.fillStyle = "#455A64"; ctx.beginPath(); ctx.ellipse(0, -13.5, 5, 2.2, 0, 0, Math.PI * 2); ctx.fill();
        // smug mouth under the mustache
        if (talking) { ctx.fillStyle = "#5D2A2A"; ctx.beginPath(); ctx.ellipse(0, -10, 1.8, 0.8 + Math.abs(Math.sin(t * 15)) * 1.2, 0, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.strokeStyle = "#5D2A2A"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-2.6, -10); ctx.quadraticCurveTo(0, -8.6, 2.6, -10.6); ctx.stroke(); }
        ctx.restore();
        drawText("UNCLE RAPHAEL", x, y + 34, "bold 8px 'Segoe UI', Arial, sans-serif", "#FB8C00", "#FFF", 2);
    }

    // Shared little legs/shoes for the cameo bodies.
    function erLegs(pants, shoes, t) {
        var sw = Math.sin(t * 4) * 1;
        ctx.fillStyle = pants; roundRect(-6, 12, 5, 16, 2); ctx.fill(); roundRect(1, 12, 5, 16, 2); ctx.fill();
        ctx.fillStyle = shoes; roundRect(-7, 26 + sw, 8, 4, 2); ctx.fill(); roundRect(0, 26 - sw, 8, 4, 2); ctx.fill();
    }
    // A flexible bedside GUEST for the random ER cameos (Bubbe, a rabbi, a clown,
    // a nosy old man, Avigail, a cop, a kid...). `kind` selects the look.
    function drawErGuest(x, y, t, kind, talking, name, col) {
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0, 28, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
        var mo = talking ? 0.8 + Math.abs(Math.sin(t * 15)) * 1.3 : 0;   // mouth open amount
        function face(eyeStyle) {
            ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(0, -16, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -16, 7.6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-2.6, -16, 1.1, 0, Math.PI * 2); ctx.arc(2.6, -16, 1.1, 0, Math.PI * 2); ctx.fill();
            if (talking) { ctx.fillStyle = "#5D2A2A"; ctx.beginPath(); ctx.ellipse(0, -11, 1.6, mo, 0, 0, Math.PI * 2); ctx.fill(); }
            else { ctx.strokeStyle = "#5D2A2A"; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(0, -12, 1.8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
        }
        if (kind === "bubbe") {
            erLegs("#5D4037", "#3E2723", t);
            ctx.fillStyle = "#8D6E63"; roundRect(-11, -9, 22, 21, 6); ctx.fill();         // cardigan dress
            ctx.fillStyle = "#6D4C41"; roundRect(-13, -5, 5, 13, 2); ctx.fill(); roundRect(8, -5, 5, 13, 2); ctx.fill();
            ctx.fillStyle = "#90A4AE"; roundRect(-7, 2, 14, 8, 2); ctx.fill();             // a pot of cholent
            ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(0, -1 - ((t * 8) % 6), 1.4, 0, Math.PI * 2); ctx.fill();
            face();
            ctx.fillStyle = "#CFD8DC"; ctx.beginPath(); ctx.arc(0, -19, 8, Math.PI, 0); ctx.fill();
            ctx.fillStyle = "#A1887F"; ctx.beginPath(); ctx.arc(0, -20, 8.6, Math.PI * 1.04, -0.04); ctx.fill();   // headscarf
            ctx.strokeStyle = "#5D4037"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-2.6, -16, 2, 0, Math.PI * 2); ctx.arc(2.6, -16, 2, 0, Math.PI * 2); ctx.stroke();
        } else if (kind === "avigail") {
            erLegs("#4A148C", "#212121", t);
            ctx.fillStyle = "#7E57C2"; roundRect(-11, -9, 22, 20, 6); ctx.fill();          // chic dress
            ctx.fillStyle = "#9575CD"; roundRect(-13, -5, 5, 13, 2); ctx.fill(); roundRect(8, -5, 5, 13, 2); ctx.fill();
            face();
            ctx.fillStyle = "#241712"; ctx.beginPath(); ctx.arc(0, -18, 8.6, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-8, -13, 2.6, 7, -0.2, 0, Math.PI * 2); ctx.ellipse(8, -13, 2.6, 7, 0.2, 0, Math.PI * 2); ctx.fill();   // sleek long hair
            ctx.strokeStyle = "#FFD54F"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(7, -10, 1.8, 0, Math.PI * 2); ctx.stroke();   // hoop
        } else if (kind === "rabbi") {
            erLegs("#1A1A1A", "#0A0A0A", t);
            ctx.fillStyle = "#1A1A1A"; roundRect(-11, -9, 22, 22, 5); ctx.fill();          // black coat
            ctx.fillStyle = "#FFF"; roundRect(-3, -8, 6, 14, 1); ctx.fill();               // white shirt
            ctx.fillStyle = "#1A1A1A"; roundRect(-13, -5, 5, 13, 2); ctx.fill(); roundRect(8, -5, 5, 13, 2); ctx.fill();
            face();
            ctx.fillStyle = "#BDBDBD"; ctx.beginPath(); ctx.arc(0, -11, 6.5, 0.05 * Math.PI, 0.95 * Math.PI); ctx.closePath(); ctx.fill();   // beard
            ctx.fillStyle = "#1A1A1A"; ctx.fillRect(-10, -22, 20, 3); roundRect(-7, -30, 14, 9, 2); ctx.fill();   // black hat
            ctx.strokeStyle = "#263238"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-2.6, -16, 2, 0, Math.PI * 2); ctx.arc(2.6, -16, 2, 0, Math.PI * 2); ctx.stroke();
        } else if (kind === "clown") {
            erLegs("#1E88E5", "#E53935", t);
            ctx.fillStyle = "#FDD835"; roundRect(-12, -9, 24, 21, 7); ctx.fill();          // jumpsuit
            ctx.fillStyle = "#E53935"; ctx.beginPath(); ctx.arc(-4, -2, 2.4, 0, Math.PI * 2); ctx.arc(4, 4, 2.4, 0, Math.PI * 2); ctx.fill();   // pom buttons
            ctx.fillStyle = "#43A047"; roundRect(-14, -5, 5, 13, 2); ctx.fill(); roundRect(9, -5, 5, 13, 2); ctx.fill();
            ctx.fillStyle = "#FFF6F2"; ctx.beginPath(); ctx.arc(0, -16, 8, 0, Math.PI * 2); ctx.fill();   // white face
            var wc = ["#E53935", "#FB8C00", "#43A047", "#1E88E5"];
            for (var cw = 0; cw < 4; cw++) { ctx.fillStyle = wc[cw]; ctx.beginPath(); ctx.arc(-6 + cw * 4, -22, 3.4, Math.PI, 0); ctx.fill(); }
            ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-2.6, -16, 1.1, 0, Math.PI * 2); ctx.arc(2.6, -16, 1.1, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#E53935"; ctx.beginPath(); ctx.arc(0, -13, 2, 0, Math.PI * 2); ctx.fill();   // nose
            ctx.strokeStyle = "#E53935"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, -11, 3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();   // grin
        } else if (kind === "kid") {
            ctx.save(); ctx.scale(0.82, 0.82);   // smaller
            erLegs("#3949AB", "#FFFFFF", t);
            ctx.fillStyle = "#66BB6A"; roundRect(-10, -8, 20, 18, 5); ctx.fill();
            ctx.fillStyle = "#FFF"; ctx.fillRect(-10, -3, 20, 3);
            ctx.fillStyle = "#66BB6A"; roundRect(-12, -4, 4, 12, 2); ctx.fill(); roundRect(8, -4, 4, 12, 2); ctx.fill();
            face();
            ctx.fillStyle = "#5D4037"; ctx.beginPath(); ctx.arc(0, -18, 8, Math.PI, 0); ctx.fill();
            ctx.fillStyle = "#3949AB"; ctx.beginPath(); ctx.arc(0, -21, 4, Math.PI, 0); ctx.fill();   // kippah
            ctx.fillStyle = "rgba(255,140,140,0.5)"; ctx.beginPath(); ctx.arc(-4.6, -13, 1.6, 0, Math.PI * 2); ctx.arc(4.6, -13, 1.6, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else if (kind === "oldman") {
            erLegs("#546E7A", "#3E2723", t);
            ctx.fillStyle = "#795548"; roundRect(-11, -9, 22, 21, 6); ctx.fill();          // cardigan
            ctx.fillStyle = "#5D4037"; ctx.fillRect(-1, -9, 2, 21);
            ctx.fillStyle = "#795548"; roundRect(-13, -5, 5, 13, 2); ctx.fill(); roundRect(8, -5, 5, 13, 2); ctx.fill();
            face();
            ctx.fillStyle = "#CFD8DC"; ctx.beginPath(); ctx.arc(-6, -18, 3, Math.PI, 0); ctx.arc(6, -18, 3, Math.PI, 0); ctx.fill();   // side hair
            ctx.fillStyle = "#CFD8DC"; ctx.beginPath(); ctx.ellipse(0, -12.5, 4.4, 1.8, 0, 0, Math.PI * 2); ctx.fill();   // mustache
            ctx.strokeStyle = "#37474F"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-2.6, -16, 2.4, 0, Math.PI * 2); ctx.arc(2.6, -16, 2.4, 0, Math.PI * 2); ctx.stroke();   // big glasses
        } else if (kind === "cop") {
            drawAngryMan(0, 0, t, talking ? "talk" : "listen", 1, true); ctx.restore();
            drawText(name || "OFFICER", x, y + 34, "bold 8px 'Segoe UI', Arial, sans-serif", col || "#5C6BC0", "#FFF", 2);
            return;
        } else {   // generic visitor (man/woman)
            erLegs("#455A64", "#212121", t);
            ctx.fillStyle = col || "#5C6BC0"; roundRect(-11, -9, 22, 20, 5); ctx.fill();
            ctx.fillStyle = "rgba(0,0,0,0.18)"; roundRect(-13, -5, 5, 13, 2); ctx.fill(); roundRect(8, -5, 5, 13, 2); ctx.fill();
            face();
            ctx.fillStyle = "#3E2723"; ctx.beginPath(); ctx.arc(0, -18, 8, Math.PI, 0); ctx.fill();
        }
        ctx.restore();
        drawText(name || "VISITOR", x, y + 34, "bold 8px 'Segoe UI', Arial, sans-serif", col || "#FFD54F", "#FFF", 2);
    }
