    // ════════════════════════════════════════════════════════════
    //  LULU ON FOOT — a GTA-lite walking world
    //  When Lulu's car is wrecked she walks her OWN road. Foot mode REUSES
    //  the real driving simulation (updatePlaying/drawPlaying) — so NOTHING
    //  is missing: every car, cop, animal, toll booth, train, parade, sign,
    //  coin, etc. is there. She just walks instead of driving, and she is
    //  NOT invincible — clipped by traffic she goes down (lose a life).
    //  This fragment adds only the on-foot LAYER: the get-out intro, the
    //  hand-button interactions (talk / pet / enter a building / borrow a
    //  car), the knockdown, the HUD, and the building-interior dispatch.
    //  Entered from the crash reprieve, a parking crash, and 10% of pull-overs.
    // ════════════════════════════════════════════════════════════

    var FOOT_WALK_SPEED = 150;   // world scroll while walking (px/sec, cruise)

    // ── Foot-layer state ─────────────────────────────────────
    var footIntroT = 0;          // get-out cinematic timer (no tap needed)
    var footWalkTime = 0;        // animation clock for the on-foot sprite
    var footMood = "run";        // "run" | "panic" | "cry"
    var footDisguiseLook = null;  // null | "oldLady" | "oldMan" — set by the QUICK-CHANGE booth
    var footParked = [];         // stealable parked cars on the shoulder
    var footHotwire = null;      // the quick "hotwire to unlock it" challenge
    var footApproach = null;     // walking up + coasting to a STOP at the car before hotwiring
    var footDoors = [];          // building entrances
    var footPrompt = null;       // nearest interactable { kind, ent, label }
    var footCompanion = null;    // Avigail walking along with her { x, y, walkTime, say, sayT }
    var footBuskT = 0;           // >0 while she's busking/dancing on the curb
    var footArrestT = 0;         // >0 during the "cop walks her in" cinematic
    var footArrest = null;       // { x, y, line } cop cruiser pulling her over on foot
    var footChase = null;        // an on-FOOT cop chase when a wanted Lulu is spotted
    var footDisguise = null;     // a roadside QUICK-CHANGE booth (shed the heat on foot)
    var footDisguiseCool = 0;
    var FOOT_CHASE_TAUNTS = ["STOP! POLICE!", "You can't outrun the LAW!", "Get BACK here!",
        "I do CARDIO, Lulu!", "Freeze! ...okay, RUN then.", "I've got your SHEITEL on file!",
        "End of the line, missy!", "I skipped lunch for THIS!"];
    var footDoorCool = 0, footParkCool = 0;
    var footEntryReason = "crashReprieve";
    var footRunLevel = 1;
    var footCoinsRun = 0, footStars = 0;
    // Stars Lulu earns exploring on foot bank into the REAL star currency
    // (save.totalCoins) — the same ⭐ she spends in the sticker book —
    // so they actually mean something instead of vanishing on a side counter.
    function footAwardStar(n) { save.totalCoins = (save.totalCoins || 0) + (n || 1); persistSave(); }
    var footIntroLine = "";
    var footHint = "", footHintT = 0;
    var footChat = "", footChatT = 0, footChatNext = 3;
    var footInteriorType = null;

    // ── Saying pools ─────────────────────────────────────────
    var FOOT_LULU_CHAT = ["Where do I get a CAR around here?", "Walking. In these flats. Great.",
        "Bubbe's gonna plotz.", "I need a RIDE.", "So many cars... none are MINE.",
        "Is everyone DRUNK today?", "I should've taken the bus.", "These men. Oy.",
        "A car. Any car. Please.", "Cardio counts as a mitzvah, right?"];
    var FOOT_STEAL_LINES = ["Borrowing this! 🚗", "Sorry, EMERGENCY!", "I'll bring it back!",
        "Don't mind if I DO!", "Grand theft... mitzvah?", "Keys were RIGHT there!", "Bubbe needs me!"];
    var FOOT_TALK_LULU = ["Hi! Have you seen a free car?", "Lovely weather for WALKING. ugh.",
        "Gut voch!", "You didn't see anything.", "Nice... whatever that is.", "Can I borrow your car? No? Rude.",
        "Do these flats say 'desperate'?", "I'm not lost, I'm... scenic.", "Got bus fare? A bus? A horse?"];
    var FOOT_PED_REPLY = ["Shalom! 👋", "...do I know you?", "Spare a nickel?", "Walk faster, lady!",
        "Nice day, eh?", "I'm late too!", "Mazel tov! ...for what? dunno.", "Cute bag!",
        "You dropped your... no? okay.", "I LOVE your energy!", "Gut Shabbos! ...it's Tuesday.", "Move along, dear."];
    var FOOT_DRUNK_REPLY = ["Heyyy GORGEOUS! 🍻", "Marry me — I have a CAR! 🚗", "*hiccup* helloooo",
        "You're an ANGEL 😇", "Niiice walk!", "Call me! ...somehow", "Need a LIFT? 😏",
        "Are you a parking ticket? 'Cause FINE.", "I named a SHOT after you!", "You're like my ex but TALLER"];
    var FOOT_PET_LINES = ["Awww! 🐾", "Who's a good boy?!", "So FLUFFY!", "Hi little guy!", "Shoo! ...no, stay!",
        "It LICKED me!", "You're coming HOME with me.", "Is this... a raccoon? Adorable.", "BOOP the snoot!"];
    var AVIGAIL_WALK_LINES = ["Power walk, mama! 💪", "Did you SEE his sheitel?", "We should get coffee.",
        "I'm telling EVERYONE about this.", "Your form is terrible — but cute.", "Two girls, no car, BIG energy!",
        "Should we just steal a convertible?", "My feet hurt ALREADY.", "This is so much cardio.",
        "Ooh, is that a SALON?", "Walk it off, queen. 👑", "I brought snacks. ...I ate them."];
    var FOOT_PARK_GAG = ["Parallel parking... MYSELF! 🅿️", "Excuse me — squeezing IN.",
        "Nailed it. Between two yentas.", "No ticket for THIS spot!", "I fit! ...barely.", "Perfect form, no car needed."];
    var FOOT_HAIL_OK = ["Thanks for the lift! 🚕", "You're a LIFESAVER!", "Bubbe's, and step on it!", "FINALLY, a ride!"];
    var FOOT_HAIL_NO = ["Rude!! 😤", "I had my hand UP!", "...off-duty, sure.", "Fine, I'll WALK. Again."];
    var FOOT_COP_PICKUP = ["🚓 Off the road, ma'am!", "🚓 You're coming with me.",
        "🚓 Pedestrian in traffic — IN you go.", "🚓 Let's chat at the station.",
        "🚓 Jaywalkin'? Cute. Get in.", "🚓 Bored. You'll do. Hop in."];
    var FOOT_HAIL_VEHICLE = { bus: "On a BUS now?! 🚌", ambulance: "WEE-OOO! 🚑", cop: "Driving a COP car?! 🚓", dozer: "He just... HANDED her the steamroller?! 🚜" };
    var FOOT_BUSK_LINES = ["💃 Spare a dime?", "Singin' for my SUPPER!", "Tips for a stranded girl?",
        "I take Venmo!", "ONE-woman band! 🎵", "🎵 Bubbe's on my MIIIND 🎵", "Watch me WERK!"];
    var FOOT_SELFIE_LINES = ["Say cheese, big guy! 🤳", "This is going VIRAL.", "Bubbe won't BELIEVE this!",
        "Filter? You're perfect.", "#Sasquatch #blessed", "Smile! ...do you HAVE teeth?"];
    var FOOT_HIGHFIVE = ["✋ YEAH!", "Up top!", "Nailed it!", "👊 respect", "Don't leave me hangin— oh!"];

    // What Lulu mutters when her ride dies and she's stuck on foot — way more
    // variety than just "the car's a meatball."
    var FOOT_INTRO_LINES = {
        wreck: [
            "The car's a MEATBALL.\nTime to borrow one.",
            "Well. That's not buffing out.\nOn foot it is.",
            "RIP, little pink car. 🥀\nYou served me... okay.",
            "The engine went 'kaplooey.'\nThat's the medical term.",
            "Totaled. Bubbe is NOT\nhearing about this.",
            "It's not a car now,\nit's modern ART. Walking!",
            "Four wheels down to zero.\nGuess I'm hoofing it.",
            "She's taking a nap.\nA... permanent nap. 😴",
            "Smoke this color is\nNEVER a good sign.",
            "I'll walk it off. Literally."
        ],
        copWalk: [
            "Impounded?! Fine. I'll WALK.\n...and find a new ride.",
            "They TOWED my baby!\nBorrowing the next one.",
            "No car, no problem.\n...okay, SOME problem.",
            "The lot wants $400.\nI want a NEW car. Free."
        ],
        parkingCrash: [
            "That's coming out of\nmy deposit. On foot it is.",
            "I'll just... leave that there.\nWalking now! 🚶‍♀️",
            "Parking is HARD, okay?!\nUgh. Find another."
        ],
        droveOff: [
            "Parked it. Stretching\nmy legs. 🚶‍♀️",
            "Bored of driving.\nLet's WALK a bit.",
            "Pulled over. Time to\nfind a BETTER ride.",
            "I'll leave it here.\nNobody'll notice. Probably."
        ]
    };

    function startFootWorld(reason) {
        footEntryReason = reason;
        footRunLevel = (save.footRunsPlayed || 0) + 1;
        save.footRunsPlayed = footRunLevel; persistSave();
        // Ditching the car is a DIRECT hand-off — no intro flourish, she just keeps
        // moving on foot from where she parked.
        footIntroT = reason === "droveOff" ? 0 : 1.6; footWalkTime = 0;
        footMood = reason === "droveOff" ? "run" : "cry";   // she chose this one, no tears
        footParked = []; footDoors = []; footPrompt = null; footCompanion = null; footHotwire = null; footApproach = null;
        footParkCool = 5; footDoorCool = 2; footArrestT = 0; footArrest = null; footChase = null; footBuskT = 0;
        footDisguise = null; footDisguiseCool = 3; footDisguiseLook = null;
        footCoinsRun = 0; footStars = 0;
        footChat = ""; footChatT = 0; footChatNext = rand(2.5, 4.5);
        footInteriorType = null;
        footHint = "Find a car to “borrow” 🚗  •  ✋ to interact"; footHintT = 6;
        var pool = reason === "parkingCrash" ? FOOT_INTRO_LINES.parkingCrash
                 : reason === "copWalk"      ? FOOT_INTRO_LINES.copWalk
                 : reason === "droveOff"     ? FOOT_INTRO_LINES.droveOff
                                             : FOOT_INTRO_LINES.wreck;
        footIntroLine = randPick(pool);
        // A chase doesn't follow her onto the sidewalk — clear it so a leftover
        // pursuit can't "pull over" a walking Lulu (she'd be drawn as a car).
        copChase = null; copBust = null;
        lives = Math.max(lives, 1);   // she can still lose it — but starts with one
        invincibleTimer = 2.0;        // brief shield so she isn't clipped the instant she appears
        if (player) { player.x = W / 2; player.targetX = W / 2; player.y = PLAYER_Y; player.tilt = 0; }
        state = "footRun";            // smooth: updatePlaying runs the world, drawFootIntro plays first
    }

    // ════════════════════════════════════════════════════════════
    //  EXIT-A-BUILDING cutscene — a consistent beat for LEAVING the
    //  hospital / courthouse / precinct: Lulu walks out the door of a
    //  roadside building and either drives off or heads out on foot,
    //  instead of just snapping onto the road. Reusable from any scene.
    // ════════════════════════════════════════════════════════════
    var exitScene = null;
    // kind: "hospital"|"court"|"jail"|"police"  ·  dest: "drive"|"foot"
    function beginExitScene(kind, dest, caption, footReason) {
        copChase = null; copBust = null; copStop = null;
        consumeClick(); consumeAction();   // drop the tap that triggered the exit

        var quips = dest === "drive" ? ["Let's ROLL. 🚗", "Outta here!", "Freedom smells like exhaust.", "Back to the road, baby."]
                                     : ["Walking it is. 🚶‍♀️", "No car? No problem.", "Free... and on foot. Ugh."];
        exitScene = { kind: kind, dest: dest, caption: caption || "", quip: randPick(quips), footReason: footReason || "carWreck",
                      t: 0, phase: 0, door: 0, walk: 0, carGo: 0, fade: 0 };
        state = "exitScene";
        if (typeof playClick === "function") playClick();
    }
    function updateExitScene(dt) {
        var e = exitScene; if (!e) return;
        e.t += dt;
        // tap to skip ahead to the drive-off
        if (e.phase < 2 && consumeTap()) { e.phase = 2; e.t = 0; e.door = 1; e.walk = 1; }
        if (e.phase === 0) {                         // door opens, Lulu steps out
            e.door = Math.min(1, e.door + dt / 0.5);
            if (e.t > 0.8) { e.phase = 1; e.t = 0; }
        } else if (e.phase === 1) {                  // walk to the curb / car
            e.walk = Math.min(1, e.walk + dt / 1.3);
            if (e.walk >= 1 && e.t > 0.35) { e.phase = 2; e.t = 0; }
        } else if (e.phase === 2) {                  // drive off / step out → fade
            if (e.dest === "drive") e.carGo = Math.min(1, e.carGo + dt / 1.0);
            e.fade = Math.min(1, e.fade + dt / 0.7);
            if (e.fade >= 1) {
                var dest = e.dest, fr = e.footReason; exitScene = null;
                if (dest === "drive") { if (typeof returnToDriving === "function") returnToDriving(); }
                else { if (typeof startFootWorld === "function") startFootWorld(fr); }
            }
        }
    }
    function drawExitScene() {
        var e = exitScene, walk = clamp(e.walk, 0, 1);
        // ── ground: grass on the left, a vertical road on the right ──
        var gr = ctx.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, "#8BC34A"); gr.addColorStop(1, "#689F38");
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
        // striped grass
        ctx.fillStyle = "rgba(255,255,255,0.05)"; for (var g = 0; g < H; g += 26) ctx.fillRect(0, g, W, 13);
        var rdX = W * 0.58, rdW = W * 0.36;
        ctx.fillStyle = "#5C6470"; ctx.fillRect(rdX, 0, rdW, H);                                  // road
        ctx.fillStyle = "#E8E4D8"; ctx.fillRect(rdX - 4, 0, 4, H); ctx.fillRect(rdX + rdW, 0, 4, H);  // edge lines
        ctx.fillStyle = "#9AA0AC"; for (var d = -((gameTime * 120) % 60); d < H; d += 60) { ctx.fillRect(rdX + rdW / 2 - 2, d, 4, 30); }  // lane dashes
        // a paved walkway from the building to the curb
        ctx.fillStyle = "#BCAE8E";
        var bx = 22, by = H * 0.12, bw = rdX - 64, bh = H * 0.40;
        var doorX = bx + bw * 0.5, doorY = by + bh;
        ctx.beginPath(); ctx.moveTo(doorX - 18, doorY); ctx.lineTo(doorX + 18, doorY); ctx.lineTo(rdX - 2, H * 0.7 + 22); ctx.lineTo(rdX - 2, H * 0.7 - 18); ctx.closePath(); ctx.fill();

        // ── the building facade ──
        drawExitBuilding(e.kind, bx, by, bw, bh, e.door);

        // ── Lulu's parked car on the road (drive only), drives up & off in phase 2 ──
        var carX = rdX + rdW * 0.5, parkY = H * 0.66;
        var carY = lerp(parkY, -150, e.carGo);
        var inCar = (walk >= 1 && e.carGo > 0.05);
        if (e.dest === "drive") {
            ctx.save(); ctx.translate(carX, carY);
            drawLuluCar(0, 0, 0, false, gameTime, false, save.selectedSkin, 1, !inCar);   // empty until she's in
            ctx.restore();
        }
        // ── Lulu walks door → car/curb ──
        if (!inCar) {
            var tx = e.dest === "drive" ? carX - 22 : rdX - 12;
            var ty = e.dest === "drive" ? parkY : H * 0.72;
            var lx = lerp(doorX, tx, walk), ly = lerp(doorY + 8, ty, walk);
            drawLuluTopDown(lx, ly, gameTime * (walk < 1 ? 6 : 2), e.dest === "drive" ? "run" : "cry");
            if (e.phase <= 1) drawSpeechBubble(lx, ly - 46, e.quip, gameTime);
        }

        // ── caption banner (bottom) ──
        if (e.caption) {
            ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
            var cw = Math.min(W - 36, ctx.measureText(e.caption).width + 40), cbx = W / 2 - cw / 2, cby = H - 86;
            ctx.fillStyle = "rgba(12,20,16,0.85)"; roundRect(cbx, cby, cw, 40, 12); ctx.fill();
            ctx.strokeStyle = "#FFD54F"; ctx.lineWidth = 2.5; roundRect(cbx, cby, cw, 40, 12); ctx.stroke();
            drawText(e.caption, W / 2, cby + 22, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 4);
            if (e.phase < 2) { var bl = 0.4 + 0.6 * Math.abs(Math.sin(gameTime * 5)); ctx.globalAlpha = bl; drawText("▾ tap", W / 2, cby + 56, "bold 12px Arial", "#FFD54F", "#000", 2); ctx.globalAlpha = 1; }
        }
        if (e.fade > 0) { ctx.fillStyle = "rgba(10,12,20," + e.fade + ")"; ctx.fillRect(0, 0, W, H); }
    }
    // A front-on roadside building facade, themed per kind, with sliding/opening
    // doors revealing a lit interior as Lulu exits.
    function drawExitBuilding(kind, x, y, w, h, doorOpen) {
        var body = kind === "hospital" ? "#EAF1F0" : kind === "court" ? "#CDBfA0"
                 : "#5A6B78";                                                   // police / jail (slate)
        var roof = kind === "hospital" ? "#B5CFCB" : kind === "court" ? "#A89A78" : "#3C4854";
        var signC = kind === "hospital" ? "#00897B" : kind === "court" ? "#5D4037" : "#1565C0";
        var label = kind === "hospital" ? "🏥 GENERAL HOSPITAL" : kind === "court" ? "⚖️ COURTHOUSE"
                  : kind === "jail" ? "🚓 COUNTY JAIL" : "🚓 PRECINCT 18½";
        // drop shadow + body
        ctx.fillStyle = "rgba(0,0,0,0.15)"; roundRect(x + 5, y + 7, w, h, 6); ctx.fill();
        ctx.fillStyle = body; roundRect(x, y, w, h, 6); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 2; roundRect(x, y, w, h, 6); ctx.stroke();
        // roof / pediment
        if (kind === "court") {                       // classical pediment + columns
            ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + w / 2, y - 28); ctx.lineTo(x + w + 6, y); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            for (var c = 0; c < 4; c++) { var colX = x + 14 + c * ((w - 28) / 3); ctx.fillRect(colX - 4, y + 24, 8, h - 50); }
        } else {
            ctx.fillStyle = roof; ctx.fillRect(x - 4, y - 8, w + 8, 12);
        }
        // window grid (barred for jail)
        for (var wy = y + 16; wy < y + h - 70; wy += 30) {
            for (var wx = x + 14; wx < x + w - 18; wx += 34) {
                ctx.fillStyle = "#2A3742"; roundRect(wx, wy, 22, 18, 2); ctx.fill();
                ctx.fillStyle = "rgba(180,220,235,0.6)"; roundRect(wx + 1.5, wy + 1.5, 19, 15, 2); ctx.fill();
                if (kind === "jail") { ctx.fillStyle = "#37474F"; for (var b = 0; b < 3; b++) ctx.fillRect(wx + 4 + b * 6, wy, 2.5, 18); }
            }
        }
        // hospital red cross
        if (kind === "hospital") { ctx.fillStyle = "#E53935"; ctx.fillRect(x + w / 2 - 4, y + 14, 8, 24); ctx.fillRect(x + w / 2 - 12, y + 22, 24, 8); }
        // sign board
        ctx.fillStyle = "#1A1A1A"; roundRect(x + w * 0.12, y - 6, w * 0.76, 18, 4); ctx.fill();
        drawFitText(label, x + w / 2, y + 3, w * 0.72, 11, signC === "#5D4037" ? "#FFE0B2" : signC, "#000");
        // doorway (lit interior) + double doors that slide/swing open
        var dw = 44, dh = 56, dx = x + w / 2 - dw / 2, dy = y + h - dh;
        ctx.fillStyle = "#3A2C1E"; roundRect(dx - 4, dy - 4, dw + 8, dh + 4, 4); ctx.fill();      // frame
        ctx.fillStyle = "#FFE9A8"; ctx.fillRect(dx, dy, dw, dh);                                    // warm interior glow
        var slide = doorOpen * (dw / 2 - 2);
        ctx.fillStyle = kind === "hospital" ? "rgba(160,210,220,0.92)" : "#6D5640";
        ctx.fillRect(dx - slide, dy, dw / 2, dh); ctx.fillRect(dx + dw / 2 + slide, dy, dw / 2, dh);  // two door leaves
        ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1; ctx.strokeRect(dx - slide, dy, dw / 2, dh); ctx.strokeRect(dx + dw / 2 + slide, dy, dw / 2, dh);
        // a couple of steps down to the path
        for (var s = 0; s < 2; s++) { ctx.fillStyle = s % 2 ? "#C9BB9A" : "#BCAE8E"; ctx.fillRect(dx - 8 - s * 6, y + h + s * 7, dw + 16 + s * 12, 7); }
    }

    // Thin dispatch wrappers — foot mode IS the real driving sim with onFoot set.
    function updateFootRun(dt) { updatePlaying(dt); }
    function drawFootRun() { drawPlaying(); }

    // ── The on-foot LAYER (called from updatePlaying when onFoot) ────
    function updateFootExtras(dt) {
        // Belt-and-suspenders: a chase/bust can NEVER exist on foot. Even though
        // every road-violation trigger is now gated by !onFoot, clear any stray
        // chase here each frame so the "SPEED AWAY!" HUD can't render while she
        // walks (and so she can't get pulled over the instant she borrows a car).
        if (copChase) copChase = null;
        if (copBust) copBust = null;
        if (footBuskT > 0) footBuskT -= dt;
        if (footChase) updateFootChase(dt);
        footMood = footChase ? "panic" : footBuskT > 0 ? "dance" : (invincibleTimer > 0 ? "panic" : "run");

        // Drunk pedestrians she passes shuffle toward her and holler (reactive world).
        for (var di = 0; di < obstacles.length; di++) {
            var dp = obstacles[di];
            if (dp.type === "ped" && dp.drunk && Math.abs(dp.y - player.y) < 130 && Math.abs(dp.x - player.x) < 150) {
                dp.x = lerp(dp.x, player.x, dt * 0.8);
                if ((dp.commentT || 0) <= 0 && Math.random() < dt * 0.5) { dp.comment = randPick(FOOT_DRUNK_REPLY); dp.commentT = 2.0; }
            }
        }

        // Spawn + scroll the stealable cars and building doors.
        if (footParkCool > 0) footParkCool -= dt;
        if (footParkCool <= 0 && footParked.length < 1) { footParkCool = rand(5, 9); footSpawnParked(); }
        if (footDoorCool > 0) footDoorCool -= dt;
        footMaybeSpawnDoor();
        // A roadside QUICK-CHANGE booth shows up on the shoulder while she's WANTED —
        // duck in (on foot, by the side of the road) to swap her look and shed the heat.
        var footWantedNow = (typeof isWanted === "function" && isWanted()) || prisonClothes;
        if (footDisguiseCool > 0) footDisguiseCool -= dt;
        if (footWantedNow && !footDisguise && footDisguiseCool <= 0) {
            footDisguise = { x: (Math.random() < 0.5 ? ROAD_L - 34 : ROAD_R + 34), y: -110, t: 0 };
        }
        if (footDisguise) {
            footDisguise.t += dt; footDisguise.y += gameSpeed * dt;
            if (footDisguise.y > H + 100 || !footWantedNow) { footDisguise = null; footDisguiseCool = rand(4, 8); }
        }
        if (!footHotwire && !footApproach) footScroll(footParked, 110, dt);   // hold the car still while she walks up / hotwires
        // Only STANDALONE doors (beach) scroll here — anchored ones track their
        // building every frame in footMaybeSpawnDoor.
        for (var sdi = footDoors.length - 1; sdi >= 0; sdi--) {
            var sdd = footDoors[sdi];
            if (!sdd.standalone) continue;
            sdd.y += gameSpeed * dt;
            if (sdd.y > H + 80) footDoors.splice(sdi, 1);
        }
        updateFootCompanion(dt);

        // Walking up to the car (coasting to a stop) takes priority, then a
        // hotwire-in-progress, then ordinary hand-button interactions.
        if (footApproach) { updateFootApproach(dt); footPrompt = null; }
        else if (footHotwire) { updateFootHotwire(dt); footPrompt = null; }
        else {
            footPrompt = footNearestInteractable();
            if (footActQueued) { footActQueued = false; if (footPrompt) doFootInteract(footPrompt); else footBusk(); }
        }

        // A cop who spots a WANTED Lulu on foot doesn't just grab her — he pulls
        // over and gives CHASE on foot (she can outrun him). Only fires when she
        // actually has an open file, and not while a chase is already running.
        var footWanted = (typeof isWanted === "function" && isWanted()) || prisonClothes;
        if (footBuskT <= 0 && footWanted && !footChase) {
            var copSeen = null, ic;
            for (ic = 0; ic < roadCops.length; ic++) { var rc = roadCops[ic]; if (!rc.busted && Math.abs(rc.x - player.x) < 110 && Math.abs(rc.y - player.y) < 130) { copSeen = rc; break; } }
            if (!copSeen) for (ic = 0; ic < obstacles.length; ic++) { var oc = obstacles[ic]; if (oc.type === "car" && (oc.behavior === "patrol" || oc.behavior === "pulled") && Math.abs(oc.x - player.x) < 120 && Math.abs(oc.y - player.y) < 140) { copSeen = oc; break; } }
            if (copSeen && Math.random() < dt * 0.7) {
                copSeen.busted = true; // this cop is now the one chasing her
                startFootChase(copSeen.x);
            }
        }

        // Chatter + hint.
        footChatT -= dt;
        if (footChatT <= -footChatNext) { footChat = randPick(FOOT_LULU_CHAT); footChatT = 2.0; footChatNext = rand(4, 7); }
        if (footHintT > 0) footHintT -= dt;
    }

    function footScroll(list, killBelow, dt) {
        for (var i = list.length - 1; i >= 0; i--) {
            list[i].y += gameSpeed * dt;       // gameSpeed is the live world scroll
            if (list[i].y > H + killBelow) list.splice(i, 1);
        }
    }

    function footSpawnParked() {
        var left = Math.random() < 0.5;
        // Mostly ordinary cars, but now and then something juicier is parked up:
        // a cop cruiser, a bus, an ambulance, or (rarely) a steamroller. The fancier
        // the ride, the tougher the hotwire.
        var r = Math.random();
        var vtype = r < 0.68 ? "car" : r < 0.80 ? "cop" : r < 0.90 ? "ambulance" : r < 0.97 ? "bus" : "dozer";
        // ~1-in-4 ordinary cars is a LEMON (hood up / flat tire) — steal it and it
        // drives badly. Fancier rides (cop/bus/etc.) are never lemons.
        var lemon = (vtype === "car" && Math.random() < 0.25) ? (Math.random() < 0.5 ? "engine" : "tire") : null;
        footParked.push({ x: left ? ROAD_L - 24 : ROAD_R + 24, y: -110, vtype: vtype, lemon: lemon,
            color: randPick(C.enemyCols), carType: randCarType(), rot: left ? 0.12 : -0.12 });
    }

    var FOOT_DOOR_NAME = { bars: "BAR", school: "SCHOOL", hospital: "CLINIC", police: "PRECINCT", beach: "BEACH", salon: "SALON", parking: "PARKING" };
    function footZoneInterior() {
        if (typeof zone === "undefined") return null;
        if (zone === "bars" || zone === "school" || zone === "hospital" || zone === "police" || zone === "beach") return zone;
        return null;
    }
    // Doors are the BUILDINGS now: every enterable storefront scrolling past on
    // foot gets its entrance at its base — no more free-floating random doors.
    // (The beach has no building, so its boardwalk entrance still pops up on its
    // own — only in the beach stretch, and far less often than doors used to.)
    var FOOT_ENTERABLE = { bars: 1, school: 1, hospital: 1, police: 1, salon: 1, parking: 1 };
    function footMaybeSpawnDoor() {
        // Rebuild the building-anchored entrances from what's actually on screen.
        var kept = [];
        for (var k = 0; k < footDoors.length; k++) if (footDoors[k].standalone) kept.push(footDoors[k]);
        footDoors = kept;
        if (typeof cityBuildings !== "undefined") {
            for (var i = 0; i < cityBuildings.length; i++) {
                var b = cityBuildings[i];
                if (!FOOT_ENTERABLE[b.kind]) continue;
                var by = b.y + b.h + 10;
                if (by < -60 || by > H + 40) continue;
                footDoors.push({ type: b.kind, x: b.x, y: by, bld: b });
            }
        }
        // Beach entrance — rare, and only where a beach actually is.
        if (typeof zone !== "undefined" && zone === "beach" && footDoorCool <= 0) {
            footDoorCool = rand(9, 14);
            var left = Math.random() < 0.5;
            footDoors.push({ type: "beach", x: left ? ROAD_L - 30 : ROAD_R + 30, y: -90, standalone: true });
        }
    }

    function footNearestInteractable() {
        var best = null, bestD = 1e9;
        function consider(cand, dx, dy, rx, ry) {
            if (Math.abs(dx) < rx && Math.abs(dy) < ry) { var d = Math.abs(dx) + Math.abs(dy); if (d < bestD) { best = cand; bestD = d; } }
        }
        if (footDisguise) consider({ kind: "disguise", ent: footDisguise, label: "🥸 DUCK IN — change your look" }, footDisguise.x - player.x, footDisguise.y - player.y, 56, 66);
        for (var i = 0; i < footDoors.length; i++) {
            var dr = footDoors[i];
            consider({ kind: "enter", ent: dr, label: "🚪 ENTER " + FOOT_DOOR_NAME[dr.type] }, dr.x - player.x, dr.y - player.y, 58, 66);
        }
        for (var p = 0; p < footParked.length; p++) {
            var pc = footParked[p];
            var blbl = { cop: "🚓 HOTWIRE COP CAR", ambulance: "🚑 HOTWIRE AMBULANCE", bus: "🚌 HOTWIRE BUS", dozer: "🚜 HOTWIRE STEAMROLLER" }[pc.vtype] || "🚗 HOTWIRE CAR";
            consider({ kind: "borrow", ent: pc, label: blbl }, pc.x - player.x, pc.y - player.y, 58, 88);
        }
        // Live-world folk: talk to peds, pet animals, chat up cops, or HAIL a car.
        for (var o = 0; o < obstacles.length; o++) {
            var e = obstacles[o];
            if (e.type === "ped") consider({ kind: "talk", ent: e, label: "💬 TALK" }, e.x - player.x, e.y - player.y, 46, 50);
            else if (e.type === "duck" || e.type === "raccoon" || e.type === "ostrich")
                consider({ kind: "pet", ent: e, label: "🐾 PET" }, e.x - player.x, e.y - player.y, 44, 46);
            else if (e.type === "car") {
                var lbl = e.behavior === "bus" ? "🚌 HAIL BUS" : e.behavior === "ambulance" ? "🚑 HAIL AMBULANCE"
                        : (e.behavior === "patrol" || e.behavior === "pulled") ? "🚓 HAIL COP CAR"
                        : e.behavior === "dozer" ? "🚜 HAIL STEAMROLLER"
                        : e.carType === 7 ? "🚕 HAIL TAXI" : e.carType === 8 ? "🚌 HAIL CITY BUS" : "🚕 HAIL RIDE";
                consider({ kind: "hail", ent: e, label: lbl }, e.x - player.x, e.y - player.y, 60, 80);
            }
        }
        // The sasquatch easter egg → a selfie with the big guy.
        if (typeof sasquatch !== "undefined" && sasquatch)
            consider({ kind: "selfie", ent: sasquatch, label: "🤳 SELFIE" }, sasquatch.x - player.x, sasquatch.y - player.y, 64, 76);
        return best;
    }

    // ── Walk-up-and-STOP: before the hotwire UI pops, Lulu actually steps over
    //    to the parked car and the world coasts to a halt — so it reads as her
    //    stopping to get in, not teleporting into the challenge.
    function startFootApproach(pc) {
        footApproach = { car: pc, t: 0 };
        consumeClick(); consumeAction(); footActQueued = false;   // drop the initiating tap
        spawnFloater(player.x, player.y - 32, "🚗 …sidling up to it", "#FFE082");
        playTone(330, 0.05, "sine", 0.08);
    }
    function updateFootApproach(dt) {
        footApproach.t += dt;
        var car = footApproach.car;
        // car got cleared somehow (e.g. a scene change swept it) → abort cleanly
        if (footParked.indexOf(car) < 0) { footApproach = null; return; }
        // start the hotwire once she's lined up at the car (or after a short beat)
        var aligned = Math.abs(player.x - car.x) < 16;
        if ((aligned && footApproach.t > 0.4) || footApproach.t > 1.5) {
            var pc = footApproach.car; footApproach = null;
            startFootHotwire(pc);
        }
    }

    // ── Hotwire mini-challenge: tap when the slider's in the green. Plain cars
    //    are a quick one-pin freebie; cop cars / buses / ambulances take two; the
    //    steamroller takes three and the zone is mean. Two misses sets off an alarm.
    function startFootHotwire(pc) {
        var v = pc.vtype || "car";
        var diff = v === "car"   ? { pins: 1, zoneW: 0.36, speed: 0.85 }
                 : v === "dozer" ? { pins: 3, zoneW: 0.19, speed: 1.30 }
                                 : { pins: 2, zoneW: 0.25, speed: 1.08 };
        footHotwire = { veh: pc, pins: diff.pins, zoneW: diff.zoneW, speed: diff.speed,
                        hit: 0, misses: 0, pos: 0, dir: 1, zoneC: rand(0.28, 0.72), result: null, resultT: 0 };
        consumeClick(); consumeAction(); footActQueued = false;   // drop the initiating tap
        spawnFloater(player.x, player.y - 32, randPick(FOOT_STEAL_LINES), "#FFE082");
        playTone(440, 0.05, "square", 0.1);
    }
    function updateFootHotwire(dt) {
        var h = footHotwire;
        if (h.result) {
            h.resultT += dt;
            if (h.result === "win" && h.resultT > 0.5) { footHotwire = null; finalizeBorrow(h.veh); }
            else if (h.result === "fail" && h.resultT > 1.1) { footHotwire = null; footHotwireFail(h); }
            return;
        }
        var tap = footActQueued || consumeTap(); footActQueued = false;
        if (tap) {
            if (Math.abs(h.pos - h.zoneC) < h.zoneW / 2) {
                h.hit++; playTone(680 + h.hit * 90, 0.05, "sine", 0.1);
                if (h.hit >= h.pins) { h.result = "win"; h.resultT = 0; playTone(988, 0.12, "triangle", 0.2); }
                else { h.zoneC = rand(0.22, 0.78); h.speed *= 1.06; }
            } else {
                h.misses++; playTone(150, 0.1, "square", 0.14);
                spawnFloater(W / 2, H * 0.46, "✖ slipped!", "#FF8A80");
                if (h.misses >= 2) { h.result = "fail"; h.resultT = 0; playTone(90, 0.25, "square", 0.14); }
            }
            return;
        }
        h.pos += h.dir * h.speed * dt;
        if (h.pos >= 1) { h.pos = 1; h.dir = -1; } else if (h.pos <= 0) { h.pos = 0; h.dir = 1; }
    }
    function finalizeBorrow(pc) {
        spawnFloater(player.x, player.y - 32, "🔓 HOTWIRED!", "#7CFC4F");
        spawnCrashBurst(pc.x, pc.y, false);
        // Only a cop GENUINELY NEARBY (close enough to actually witness the boost)
        // reacts — a lone cruiser way up the road doesn't count.
        var watcher = null, ci;
        for (ci = 0; ci < roadCops.length; ci++) { var rc = roadCops[ci]; if (!rc.busted && Math.abs(rc.y - player.y) < 180) { watcher = rc; break; } }
        if (!watcher) for (ci = 0; ci < obstacles.length; ci++) { var po = obstacles[ci]; if (po.type === "car" && po.behavior === "patrol" && Math.abs(po.y - player.y) < 180) { watcher = po; break; } }
        lives = Math.max(lives, 1);
        footParked = []; footDoors = []; footCompanion = null; footChase = null;   // jumped in a car → shook the foot cop
        var v = pc.vtype || "car";
        // returnToDriving FIRST — its scene-resume cleanup clears a stale dozer
        // ("diesel days are over"), so set the borrowed vehicle AFTER it or the
        // steamroller would get wiped right back to her pink car.
        returnToDriving();
        if (v === "dozer") { playerVehicle = "dozer"; if (typeof dozerTimer !== "undefined") dozerTimer = 13; }
        else if (v === "cop") playerVehicle = "cop";
        else if (v === "ambulance") playerVehicle = "ambulance";
        else if (v === "bus") playerVehicle = "bus";
        else {
            // A hotwired civilian car — she drives IT (its body + paint), not her pink
            // car, so the pickup / sports car / EV / truck she boosts is what she rides.
            playerVehicle = "borrowed";
            if (typeof borrowedCar !== "undefined") borrowedCar = { carType: pc.carType || 0, color: pc.color || "#E53935" };
        }
        // Stole a LEMON → it drives badly (a flat tire pulls her to one side, or a
        // shot engine sputters and smokes) until she ditches it for another ride.
        if (typeof carMalfunction !== "undefined") {
            carMalfunction = pc.lemon ? { type: pc.lemon, drift: (Math.random() < 0.5 ? -1 : 1), t: 0, sput: 0 } : null;
            if (pc.lemon === "tire") spawnFloater(player.x, player.y - 32, "🛠️ FLAT TIRE — it PULLS!", "#FF8A80");
            else if (pc.lemon === "engine") spawnFloater(player.x, player.y - 32, "🛠️ BAD ENGINE — it SPUTTERS!", "#FF8A80");
        }
        // A cop right there saw it → a ONE-OFF chase (no permanent rap sheet). Out-
        // drive them and you're clean; only getting run down books the theft. This
        // keeps a single hijack from leaving her hunted forever.
        if (watcher && typeof beginCopChase === "function") {
            beginCopChase(player.x, "🚨 GRAND THEFT AUTO — DRIVE!", ["GRAND THEFT AUTO", "JOYRIDING"]);
        }
    }
    function footHotwireFail(h) {
        spawnFloater(player.x, player.y - 32, "🚨 ALARM! Walk AWAY, casual...", "#FF8A80");
        if (typeof playHonk === "function") playHonk();
        footParked = [];   // that one's a bust — move along
        // A cop saw the attempt → she's WANTED for it, but she's still on foot
        // (no car to chase) so she just has to slip away before one nabs her.
        if (typeof copInView === "function" && copInView() && typeof addWanted === "function") {
            addWanted(["ATTEMPTED GRAND THEFT AUTO"]);
            spawnFloater(player.x, player.y - 54, "👮 a cop SAW that — you're WANTED!", "#FF8A80");
        }
    }

    function doFootInteract(prompt) {
        if (prompt.kind === "enter") {
            var dt2 = prompt.ent.type;
            // Salon & parking are full scenes (not footInterior dispatch) — run them
            // and have them return HERE to the foot world afterward.
            if (dt2 === "salon" && typeof startSalonScene === "function") {
                footDoors = []; salonReturnFoot = true; playClick(); startSalonScene(); return;
            }
            if (dt2 === "parking" && typeof triggerParkingMinigame === "function") {
                footDoors = []; parkingReturnFoot = true; playClick(); triggerParkingMinigame(); return;
            }
            enterFootInterior(dt2); return;
        }
        if (prompt.kind === "disguise") { footDoDisguise(); return; }
        if (prompt.kind === "borrow") {
            startFootApproach(prompt.ent);   // walk up + STOP at the car, THEN hotwire
            return;
        }
        if (prompt.kind === "hail") {
            footChat = ""; footChatT = 0;
            if (Math.random() < 0.42) {    // harder to thumb a ride now — most folks blow past
                // She drives whatever she flagged down — a bus stays a bus, and a
                // taxi / pickup / sports car / EV / truck she rides AS ITSELF.
                var b = prompt.ent.behavior;
                lives = Math.max(lives, 1);
                footParked = []; footDoors = []; footCompanion = null;
                returnToDriving();   // FIRST — its cleanup won't wipe the ride we set next
                if (b === "bus") playerVehicle = "bus";
                else if (b === "ambulance") playerVehicle = "ambulance";
                else if (b === "patrol" || b === "pulled") playerVehicle = "cop";
                else if (b === "dozer") { playerVehicle = "dozer"; if (typeof dozerTimer !== "undefined") dozerTimer = 13; }
                else {
                    playerVehicle = "borrowed";
                    if (typeof borrowedCar !== "undefined") borrowedCar = { carType: prompt.ent.carType || 0, color: prompt.ent.color || "#E53935" };
                }
                spawnFloater(player.x, player.y - 32, (playerVehicle && FOOT_HAIL_VEHICLE[playerVehicle]) || randPick(FOOT_HAIL_OK), "#7CFC4F");
                playTone(660, 0.1, "triangle", 0.14);
            } else {                       // ...or they blow right past her
                prompt.ent.comment = "Off duty!"; prompt.ent.commentT = 1.4;
                spawnFloater(player.x, player.y - 30, randPick(FOOT_HAIL_NO), "#FF8A80");
                playHonk();
            }
            return;
        }
        if (prompt.kind === "talk") {
            var e = prompt.ent;
            if (!e.drunk && Math.random() < 0.25) {           // sometimes it's a high-five
                footChat = "Up high! ✋"; footChatT = 1.6;
                e.comment = randPick(FOOT_HIGHFIVE); e.commentT = 2.0; playHopJump();
            } else {
                e.comment = randPick(e.drunk ? FOOT_DRUNK_REPLY : FOOT_PED_REPLY); e.commentT = 2.4;
                footChat = randPick(FOOT_TALK_LULU); footChatT = 2.0; playTone(520, 0.05, "sine", 0.08);
            }
            if (Math.random() < 0.3) { footCoinsRun++; runCoins++; save.totalCoins++; persistSave(); spawnFloater(e.x, e.y - 24, "+1 💰 tip", "#FFD700"); playCoin(); }
            return;
        }
        if (prompt.kind === "selfie") {
            flashTimer = 0.15;
            footCoinsRun += 5; runCoins += 5; save.totalCoins += 5; persistSave();
            footChat = randPick(FOOT_SELFIE_LINES); footChatT = 2.0;
            spawnFloater(player.x, player.y - 42, "📸 +5 (going viral!)", "#FFD700");
            playCoin();
            return;
        }
        if (prompt.kind === "pet") {
            var a = prompt.ent;
            footCoinsRun++; runCoins++; save.totalCoins++; persistSave();
            spawnFloater(a.x, a.y - 18, randPick(FOOT_PET_LINES) + " +1", "#FFB74D");
            playDogBark();
            a.x = clamp(a.x + (a.x >= player.x ? 1 : -1) * 40, 12, W - 12); // it scoots off, delighted
            return;
        }
    }

    // Clipped on foot: cars knock her down (lose a life); cones/animals just trip.
    function footKnockout(obj) {
        var deadly = obj && obj.type === "car";
        shakeTimer = 0.35; shakeIntensity = 8; flashTimer = 0.12;
        spawnCrashBurst(player.x, player.y, false);
        if (!deadly) { invincibleTimer = 0.7; footMood = "panic"; spawnFloater(player.x, player.y - 30, "oof!", "#FFF"); return; }
        lives--;
        invincibleTimer = 2.0; footMood = "panic";   // match the other re-entry shields so a 2nd car can't instantly re-clip her
        playWompWomp();
        spawnFloater(player.x, player.y - 30, lives > 0 ? "OW! watch it!" : "💫", "#FF8A80");
        if (lives <= 0) {
            // Sometimes the ER scoops her up instead of a flat game over.
            if (typeof beginHospital === "function" && Math.random() < 0.45) { beginHospital("knockout"); return; }
            if (score > save.highScore) save.highScore = Math.floor(score);
            persistSave();
            gameOverAlpha = 0; goScoreShown = 0; goConfettiDone = false;
            state = "gameover";
        }
    }

    var AVIGAIL_BUSY = ["Can't, mami — date with my Aviel! 💕", "Aviel's taking me to the AQUARIUM!",
        "I'm so in love I can't walk STRAIGHT!", "Aviel called me his 'whole world' — GAH!",
        "We're picking a china pattern, BYE!", "Sorry, Aviel's double-parked!", "He texted 'wyd' — I gotta GO!",
        "Shidduch of the CENTURY, gotta run!", "Aviel learned to PARALLEL PARK for me 😭"];
    var LULU_AVIGAIL_BUSY = ["Ugh, get a ROOM. ...mazel tov tho.", "Third-wheeling? Hard pass.",
        "Tell Aviel I said... be normal.", "Young love. Gross. Adorable. Gross.", "Go, go! ...lucky.",
        "I'll just talk to this hydrant then.", "Everyone's got a ride but ME.", "He learned to PARK? ...show-off."];

    // On foot she runs into Avigail: usually she tags along, sometimes she's
    // off with her chosson Aviel, and (rarely!) she's getting MARRIED right now.
    function footAvigailMeet(av) {
        var r = Math.random();
        // Real friends get invited: the wedding is far likelier once the rivalry
        // has genuinely thawed (rel ≥ 65).
        var wedCh = (typeof avigailRel === "function" && avigailRel() >= 65) ? 0.25 : 0.10;
        if (r < wedCh && typeof startFootWedding === "function") { startFootWedding(); return; }
        if (r < wedCh + 0.20) { footAvigailBusy(av); return; }
        footAvigailJoin(av);
    }
    function footAvigailBusy(av) {
        spawnFloater(av.x, av.y - 28, "💕 " + randPick(AVIGAIL_BUSY), "#FF80AB");
        footChat = randPick(LULU_AVIGAIL_BUSY); footChatT = 2.6;
        playTone(660, 0.08, "sine", 0.1);
        for (var h = 0; h < 6; h++) particles.push({ x: av.x + rand(-10, 10), y: av.y - 10,
            vx: rand(-20, 20), vy: rand(-50, -15), life: 1.0, maxLife: 1.0, size: rand(3, 6), color: "#FF80AB", gravity: 20 });
    }

    // Avigail spots Lulu walking and tags along — different from the in-car scene.
    function footAvigailJoin(av) {
        footCompanion = { x: av.x, y: av.y, walkTime: 0, say: "Lulu?! Wait for ME!", sayT: 2.4, sayNext: rand(3, 5) };
        footChat = "Avigail! Walk with me!"; footChatT = 2.2;
        spawnFloater(player.x, player.y - 44, "Avigail joined the walk! 💅", "#FF80AB");
        playHopJump();
    }
    function updateFootCompanion(dt) {
        if (!footCompanion) return;
        var c = footCompanion;
        c.x = lerp(c.x, clamp(player.x - 34, 16, W - 16), Math.min(1, 4 * dt));
        c.y = lerp(c.y, player.y + 16, Math.min(1, 4 * dt));
        c.walkTime += dt * (keys.up ? 2.0 : keys.down ? 0.6 : 1.2);
        if (c.sayT > 0) c.sayT -= dt;
        c.sayNext -= dt;
        if (c.sayNext <= 0) { c.say = randPick(AVIGAIL_WALK_LINES); c.sayT = 2.2; c.sayNext = rand(4, 7); }
    }

    // Hand button with nothing nearby → she busks/dances on the curb; passers-by tip.
    function footBusk() {
        footBuskT = 1.6;
        footChat = randPick(FOOT_BUSK_LINES); footChatT = 1.8;
        playHopJump();
        for (var n = 0; n < 6; n++) particles.push({ x: player.x + rand(-16, 16), y: player.y - 18,
            vx: rand(-30, 30), vy: rand(-65, -20), life: 0.9, maxLife: 0.9, size: rand(3, 6),
            color: randPick(["#FF80AB", "#4FC3F7", "#FFD54F", "#AED581"]), gravity: 36 });
        var tips = 0;
        for (var o = 0; o < obstacles.length; o++) {
            var e = obstacles[o];
            if (e.type === "ped" && Math.abs(e.x - player.x) < 130 && Math.abs(e.y - player.y) < 150) { tips++; e.comment = "👏"; e.commentT = 1.2; }
        }
        if (tips > 0) { footCoinsRun += tips; runCoins += tips; save.totalCoins += tips; persistSave(); spawnFloater(player.x, player.y - 52, "+" + tips + " 💰 tips!", "#FFD700"); playCoin(); }
    }

    // Walk into a "P" sign on foot → she just parks HERSELF between people.
    function footParkingGag() {
        footChat = randPick(FOOT_PARK_GAG); footChatT = 2.2;
        spawnFloater(player.x, player.y - 42, "🅿️ PARKED (yourself)", "#4FC3F7");
        playClick();
        if (Math.random() < 0.5) { footCoinsRun++; runCoins++; save.totalCoins++; persistSave(); spawnFloater(player.x, player.y - 62, "+1 💰", "#FFD700"); }
    }

    // ── Roadside QUICK-CHANGE booth (foot-only) → sheds the whole wanted file ──
    function footDoDisguise() {
        footDisguise = null; footDisguiseCool = rand(8, 14);
        footChase = null;
        // Actually CHANGE her clothes — she walks out as a little old lady or old
        // man (random), so nobody recognizes her for the rest of this foot trip.
        footDisguiseLook = Math.random() < 0.5 ? "oldLady" : "oldMan";
        if (typeof clearWanted === "function") clearWanted();
        if (typeof prisonClothes !== "undefined") prisonClothes = false;
        if (typeof clearLockup === "function") clearLockup();
        if (typeof fugitiveSpot !== "undefined") fugitiveSpot = 0;
        spawnFloater(player.x, player.y - 58, footDisguiseLook === "oldLady" ? "👵 SWEET OLD LADY!" : "👴 OLD MAN DISGUISE!", "#7CFC4F");
        spawnFloater(player.x, player.y - 36, "Heat's off — nobody knows you! 😎", "#B9F6CA");
        playTone(660, 0.1, "triangle", 0.16); setTimeout(function () { playTone(988, 0.12, "triangle", 0.16); }, 110);
        for (var i = 0; i < 18; i++) particles.push({ x: player.x + rand(-20, 20), y: player.y, vx: rand(-70, 70), vy: rand(-130, -40), life: 0, maxLife: 0.8, size: rand(3, 6), color: randPick(["#CE93D8", "#FFD54F", "#80DEEA", "#FFFFFF"]), gravity: 240 });
    }
    // A proper roadside changing booth: striped awning, a pink privacy curtain, a
    // little clothes rack of dresses peeking out, and a glowing QUICK-CHANGE sign.
    function drawFootDisguiseBooth(x, y, t) {
        var glow = 0.4 + 0.3 * Math.abs(Math.sin(t * 4));
        ctx.fillStyle = "rgba(206,147,216," + (0.16 + 0.14 * glow) + ")"; ctx.beginPath(); ctx.arc(x, y, 42, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.ellipse(0, 32, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
        var bw = 52, bh = 50, top = -bh / 2 + 12;
        // booth shell
        ctx.fillStyle = "#6A1B3A"; roundRect(-bw / 2, top, bw, bh, 5); ctx.fill();
        // pink privacy curtain, slightly parted in the middle
        ctx.fillStyle = "#EC407A"; roundRect(-bw / 2 + 4, top + 4, bw / 2 - 6, bh - 8, 3); ctx.fill();
        ctx.fillStyle = "#F06292"; roundRect(4, top + 4, bw / 2 - 8, bh - 8, 3); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 1;
        for (var f = -bw / 2 + 8; f < bw / 2 - 6; f += 6) { if (Math.abs(f) < 3) continue; ctx.beginPath(); ctx.moveTo(f, top + 5); ctx.lineTo(f, top + bh - 5); ctx.stroke(); }
        // a peep of a fancy shoe under the curtain (someone's changing!)
        ctx.fillStyle = "#FFD54F"; roundRect(-7, top + bh - 6, 6, 4, 1); ctx.fill(); roundRect(2, top + bh - 6, 6, 4, 1); ctx.fill();
        // striped awning
        for (var a = 0; a < bw; a += 8) { ctx.fillStyle = (a / 8) % 2 ? "#FFFFFF" : "#E91E63"; ctx.fillRect(-bw / 2 + a, top - 11, Math.min(8, bw - a), 12); }
        ctx.fillStyle = "#AD1457"; ctx.fillRect(-bw / 2, top - 11, bw, 3);
        // little clothes rack of dresses on the road-facing side
        ctx.strokeStyle = "#B0BEC5"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bw / 2 - 1, top + 6); ctx.lineTo(bw / 2 + 14, top + 6); ctx.stroke();
        ctx.fillStyle = "#7E57C2"; ctx.beginPath(); ctx.moveTo(bw / 2 + 2, top + 6); ctx.lineTo(bw / 2 + 8, top + 6); ctx.lineTo(bw / 2 + 9, top + 20); ctx.lineTo(bw / 2 + 1, top + 20); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#26A69A"; ctx.beginPath(); ctx.moveTo(bw / 2 + 6, top + 6); ctx.lineTo(bw / 2 + 12, top + 6); ctx.lineTo(bw / 2 + 13, top + 18); ctx.lineTo(bw / 2 + 5, top + 18); ctx.closePath(); ctx.fill();
        // glowing sign
        ctx.fillStyle = "#311B92"; roundRect(-bw / 2 - 2, top - 28, bw + 4, 14, 3); ctx.fill();
        drawText("🥸 QUICK CHANGE", 0, top - 21, "bold 8px 'Segoe UI', Arial", "#F3E5F5", "#000", 2);
        ctx.restore();
        if (Math.sin(t * 7) > 0.55) drawText("✦", x + 24, y - 16, "11px Arial", "#FFE082", "#5D4037", 1);
    }

    // ── On-FOOT cop chase: a cop pulls over and runs her down. She opens a gap by
    //    RUNNING (⚡), gets reeled in by walking/slowing; lose him for a beat and
    //    he gives up, or let him close and she's nabbed (the full arrest cutscene).
    function startFootChase(copX) {
        footChase = { gap: 130, copX: clamp(copX, ROAD_L + 16, ROAD_R - 16), t: 0, escapeT: 0,
                      taunt: randPick(FOOT_CHASE_TAUNTS), tauntT: 1.6 };
        spawnFloater(player.x, player.y - 56, "🚓 A cop's after you — RUN! 🏃‍♀️", "#FF5252");
        if (typeof playWompWomp === "function") playWompWomp();
        playTone(680, 0.2, "sawtooth", 0.13, 460);
    }
    function updateFootChase(dt) {
        var fc = footChase;
        fc.t += dt;
        fc.copX = lerp(fc.copX, player.x, Math.min(1, 2.4 * dt));        // he tracks her side of the road
        // RUNNING opens a gap; cruising lets him slowly reel her in; slowing is suicide
        var d = keys.up ? 48 : (keys.down ? -54 : -20);
        fc.gap = clamp(fc.gap + d * dt, 0, 340);
        if (fc.tauntT > 0) fc.tauntT -= dt; else if (Math.random() < dt * 0.5) { fc.taunt = randPick(FOOT_CHASE_TAUNTS); fc.tauntT = 2.0; }
        if (fc.gap > 270) {
            fc.escapeT += dt;
            if (fc.escapeT > 1.8) {
                footChase = null;
                spawnFloater(player.x, player.y - 50, "Lost the cop! 😎", "#7CFC4F");
                playTone(659, 0.1, "triangle", 0.2); setTimeout(function () { playTone(988, 0.12, "triangle", 0.2); }, 90);
                footBuskT = 2.0;   // brief cooldown before another cop clocks her
                return;
            }
        } else fc.escapeT = 0;
        if (fc.gap <= 4) {       // run down → collared
            footChase = null;
            var fch = (save.wanted && save.wanted.length) ? save.wanted.slice() : ["EVADING ARREST", "RESISTING ARREST"];
            if (typeof beginArrest === "function") beginArrest(fch);
            else footStartArrest(player.x);
        }
    }

    // ── "Cop walks her in" cinematic (smooth → precinct interior) ────
    function footStartArrest(copX) {
        footArrestT = 2.4;
        footArrest = { x: clamp(copX, ROAD_L + 16, ROAD_R - 16), y: -140, line: randPick(FOOT_COP_PICKUP), grabbed: false };
        footMood = "cry";
        footChat = randPick(["I was just WALKING!", "This is HARASSMENT!", "...is it the flats?", "Bubbe will hear about THIS."]); footChatT = 2.0;
        playWompWomp();
    }
    function updateFootArrest(dt) {
        footArrestT -= dt;
        footWalkTime += dt;
        updateParticles(dt);
        if (footArrest) {
            // The cruiser rolls up alongside her, sirens going.
            footArrest.y = lerp(footArrest.y, player.y - 4, Math.min(1, 3.4 * dt));
            footArrest.x = lerp(footArrest.x, clamp(player.x + (footArrest.x < player.x ? -34 : 34), ROAD_L + 16, ROAD_R - 16), Math.min(1, 3 * dt));
            if (!footArrest.grabbed && Math.abs(footArrest.y - (player.y - 4)) < 12) {
                footArrest.grabbed = true;
                if (footChatT > 0) footChatT = 0.4; // her protest ends; cop talks
            }
        }
        if (footArrestT <= 0) { footArrest = null; enterFootInterior("police"); }
    }
    function drawFootArrest() {
        // Frozen street, the cruiser pulling up, Lulu caught, then a fade to the precinct.
        drawRoad(scrollOffset);
        drawDecorations(footWalkTime);
        drawCityBuildings();
        drawSeasonFx();
        if (footArrest) {
            drawCopCar(footArrest.x, footArrest.y, footWalkTime * 6); // sirens flashing
            if (footArrest.grabbed) drawSpeechBubble(footArrest.x, footArrest.y - 42, footArrest.line, footWalkTime);
        }
        drawLuluTopDown(player.x, player.y, footWalkTime, footMood);
        if (footChatT > 0) drawSpeechBubble(player.x, player.y - 56, footChat, footWalkTime);
        drawParticles();
        // Flashing red/blue wash + fade-to-black for the last 0.7s.
        var wash = 0.12 + 0.10 * Math.sin(footWalkTime * 16);
        ctx.fillStyle = (Math.sin(footWalkTime * 8) > 0 ? "rgba(80,120,255," : "rgba(255,70,70,") + wash + ")";
        ctx.fillRect(0, 0, W, H);
        if (footArrestT < 0.7) { ctx.fillStyle = "rgba(0,0,0," + clamp((0.7 - footArrestT) / 0.7, 0, 1) + ")"; ctx.fillRect(0, 0, W, H); }
    }

    // ── Draw: the on-foot world layer ────────────────────────
    // A raised planter/hedge strip along the outer margins that scrolls SLOWER
    // than the road (0.55x) — cheap parallax that gives the flat top-down
    // sidewalk a sense of depth while she's walking.
    function drawFootParallax() {
        var span = H + 170;
        for (var k = 0; k < 8; k++) {
            var py = ((k * 150 + scrollOffset * 0.55) % span + span) % span - 85;
            var left = k % 2 === 0, px = left ? 13 : W - 13;
            var kind = k % 3;
            ctx.save(); ctx.translate(px, py);
            ctx.fillStyle = "rgba(0,0,0,0.16)";                      // drop shadow = raised
            ctx.beginPath(); ctx.ellipse(3, 5, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
            if (kind === 0) {           // trimmed hedge
                ctx.fillStyle = "#2E7D32"; ctx.beginPath(); ctx.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = "#43A047"; ctx.beginPath(); ctx.ellipse(-3, -3, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
            } else if (kind === 1) {    // stone planter with flowers
                ctx.fillStyle = "#8D8D8D"; roundRect(-11, -7, 22, 14, 4); ctx.fill();
                ctx.fillStyle = "#6D6D6D"; roundRect(-11, -7, 22, 4, 4); ctx.fill();
                ctx.fillStyle = "#66BB6A"; ctx.beginPath(); ctx.ellipse(0, -1, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = k % 4 ? "#F06292" : "#FFD54F";
                ctx.beginPath(); ctx.arc(-4, -2, 2, 0, Math.PI * 2); ctx.arc(3, -3, 2, 0, Math.PI * 2); ctx.arc(0, 1, 2, 0, Math.PI * 2); ctx.fill();
            } else {                    // little street shrub in a pot
                ctx.fillStyle = "#795548"; roundRect(-6, 1, 12, 8, 2); ctx.fill();
                ctx.fillStyle = "#388E3C"; ctx.beginPath(); ctx.arc(0, -5, 8, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = "#4CAF50"; ctx.beginPath(); ctx.arc(-2, -7, 4.5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }
    }
    function drawFootWorld() {
        drawFootParallax();
        if (footCompanion) {
            drawAvigailWalker(footCompanion.x, footCompanion.y, footCompanion.walkTime);
            if (footCompanion.sayT > 0) drawSpeechBubble(footCompanion.x, footCompanion.y - 40, footCompanion.say, footCompanion.walkTime);
        }
        for (var p = 0; p < footParked.length; p++) {
            var pc = footParked[p];
            ctx.save(); ctx.translate(pc.x, pc.y); ctx.rotate(pc.rot || 0);
            if (pc.vtype === "cop") drawCopCar(0, 0, gameTime * 3);
            else if (pc.vtype === "ambulance") drawAmbulance(0, 0, gameTime);
            else if (pc.vtype === "bus" && typeof drawTopBus === "function") drawTopBus(0, 0);
            else if (pc.vtype === "dozer" && typeof drawSteamroller === "function") drawSteamroller(0, 0, 0, gameTime, true);
            else drawEnemyCar(0, 0, pc.color, pc.carType);
            // a LEMON wears its trouble: a popped hood + smoke (engine) or a flat
            // tire — so you can SEE it's a dud before you steal it.
            if (pc.lemon === "engine") {
                ctx.fillStyle = "#455A64"; roundRect(-13, -CAR_H / 2 - 7, 26, 11, 2); ctx.fill();
                ctx.fillStyle = "#263238"; roundRect(-13, -CAR_H / 2 - 7, 26, 3, 2); ctx.fill();
            } else if (pc.lemon === "tire") {
                ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.ellipse(-CAR_W / 2 - 1, -CAR_H / 2 + 18, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
            if (pc.lemon === "engine" && Math.random() < 0.25) particles.push({ x: pc.x + rand(-5, 5), y: pc.y - CAR_H / 2 - 4, vx: rand(-8, 8), vy: rand(-24, -10), life: 0, maxLife: 0.9, size: rand(3, 6), color: randPick(["#9E9E9E", "#616161"]), gravity: -8 });
        }
        for (var d = 0; d < footDoors.length; d++) drawFootDoor(footDoors[d]);
        if (footDisguise) drawFootDisguiseBooth(footDisguise.x, footDisguise.y, footDisguise.t);
        // the chasing cop on foot — nearer the closer the gap gets
        if (footChase) {
            var fc = footChase, copY = clamp(player.y + 40 + fc.gap * 0.5, player.y + 24, H - SAFE_BOTTOM - 24);
            if (typeof drawAngryMan === "function") drawAngryMan(fc.copX, copY, footWalkTime, "running", 1, true);
            if (fc.tauntT > 0 && typeof drawSpeechBubble === "function") drawSpeechBubble(fc.copX, copY - 42, fc.taunt, footWalkTime);
        }
        if (footHotwire) drawHotwire(footHotwire);
    }

    var FOOT_VEH_NAME = { car: "CAR", cop: "COP CAR", ambulance: "AMBULANCE", bus: "BUS", dozer: "STEAMROLLER" };
    function drawHotwire(h) {
        var bw = W - 84, bx = 42, by = H * 0.52, bh = 26;
        ctx.fillStyle = "rgba(8,10,18,0.86)"; roundRect(bx - 12, by - 50, bw + 24, 108, 12); ctx.fill();
        ctx.strokeStyle = h.result === "fail" ? "#FF5252" : "#FFD54F"; ctx.lineWidth = 2; roundRect(bx - 12, by - 50, bw + 24, 108, 12); ctx.stroke();
        var title = h.result === "win" ? "🔓 GOT IT!" : h.result === "fail" ? "🚨 ALARM — BAIL!" : "HOTWIRE — tap in the GREEN!";
        drawText(title, W / 2, by - 32, "bold 14px 'Segoe UI', Arial, sans-serif", h.result === "fail" ? "#FF8A80" : "#FFD54F", "#000", 3);
        ctx.fillStyle = "#37474F"; roundRect(bx, by, bw, bh, 8); ctx.fill();
        ctx.fillStyle = "#66BB6A"; roundRect(bx + (h.zoneC - h.zoneW / 2) * bw, by, h.zoneW * bw, bh, 4); ctx.fill();
        ctx.fillStyle = "#FFFFFF"; roundRect(bx + h.pos * bw - 3, by - 5, 6, bh + 10, 3); ctx.fill();
        for (var p = 0; p < h.pins; p++) {
            ctx.fillStyle = p < h.hit ? "#FFD54F" : "#546E7A";
            ctx.beginPath(); ctx.arc(W / 2 - (h.pins - 1) * 11 + p * 22, by + 44, 5, 0, Math.PI * 2); ctx.fill();
        }
    }

    function drawFootDoor(dr) {
        var onLeft = dr.x < W / 2;
        ctx.save();
        ctx.translate(dr.x, dr.y);
        var col = { bars: "#7E57C2", school: "#EF5350", hospital: "#42A5F5", police: "#5C6BC0", beach: "#26C6DA", salon: "#EC407A", parking: "#607D8B" }[dr.type] || "#8D6E63";
        if (dr.bld) {
            // Anchored to a real storefront: the building already wears its own
            // sign, so just a welcoming doorway at its base — a soft glow spilling
            // out + a pulsing mat so it reads "you can go in here".
            var gp = 0.45 + 0.25 * Math.abs(Math.sin(gameTime * 2.6));
            ctx.fillStyle = "rgba(255,224,130," + (gp * 0.35) + ")";
            ctx.beginPath(); ctx.ellipse(0, 22, 30, 13, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#3E2723"; roundRect(-16, -8, 32, 34, 4); ctx.fill();
            ctx.fillStyle = "#5D4037"; roundRect(-12, -5, 24, 31, 3); ctx.fill();
            ctx.fillStyle = "rgba(255,224,130,0.8)"; roundRect(-8, -2, 16, 10, 2); ctx.fill();  // lit window
            ctx.fillStyle = "#FFD54F"; ctx.beginPath(); ctx.arc(onLeft ? 7 : -7, 14, 1.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = col; roundRect(-14, 26, 28, 6, 3); ctx.fill();                       // welcome mat in the shop's color
            ctx.restore();
            return;
        }
        ctx.fillStyle = "#3E2723"; roundRect(-20, -2, 40, 46, 4); ctx.fill();
        ctx.fillStyle = "#5D4037"; roundRect(-15, 2, 30, 42, 3); ctx.fill();
        ctx.fillStyle = "#FFD54F"; ctx.beginPath(); ctx.arc(onLeft ? 9 : -9, 24, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = col; roundRect(-26, -16, 52, 16, 4); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        for (var s = -26; s < 26; s += 10) ctx.fillRect(s + 2, -16, 5, 16);
        drawText(FOOT_DOOR_NAME[dr.type], 0, -8, "bold 8px Arial", "#fff", "#000", 2);
        ctx.restore();
    }

    function drawFootHUD() {
        // Mirror the driving HUD's safe-area-aware top strip so nothing tucks
        // under the notch / Dynamic Island. Top text sits a comfortable distance
        // below SAFE_TOP (matching drawHUD); buttons use their own inset RECTs.
        var top = SAFE_TOP;
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, top + 50);

        // "ON FOOT" + coins collected (left). No SCORE here — score is a driving
        // stat and stays frozen on foot, so showing it just looked broken. Coins
        // are what she's actually earning out here.
        drawText("🚶‍♀️ ON FOOT", 64, top + 13, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 3, "left");
        if (typeof mpStatusChip === "function") { try { mpStatusChip(); } catch (e) {} }
        var fchPop = 1 + Math.max(0, coinHudPulse) * 0.9;
        ctx.save(); ctx.translate(72, top + 36); ctx.scale(fchPop, fchPop); drawCoin(0, 0, gameTime); ctx.restore();
        drawText("× " + runCoins, 86, top + 35, "bold 20px 'Segoe UI', Arial, sans-serif", C.coin, C.hudShadow, 4, "left");
        // Collected coins arc to THIS counter on foot too (they used to fly to
        // the driving HUD's corner — invisible out here).
        for (var cfd = 0; cfd < coinFlys.length; cfd++) {
            var cf = coinFlys[cfd]; if (cf.t < 0) continue;
            var cp2 = Math.min(1, cf.t / cf.dur); cp2 = cp2 * cp2 * (3 - 2 * cp2);
            var inv = 1 - cp2;
            var fx = inv * inv * cf.sx + 2 * inv * cp2 * cf.cx + cp2 * cp2 * 72;
            var fy = inv * inv * cf.sy + 2 * inv * cp2 * cf.cy + cp2 * cp2 * (top + 36);
            ctx.save(); ctx.translate(fx, fy); ctx.scale(0.6, 0.6); ctx.globalAlpha = 0.95;
            drawCoin(0, 0, gameTime + cfd); ctx.restore();
        }

        // ⭐ stars (top-right) — the REAL, spendable star total (same ⭐ the
        // sticker book uses), not a throwaway counter.
        drawText("💰 " + formatNum(save.totalCoins), W - 14, top + 26, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 3, "right");

        // hearts, centered like the driving HUD (she CAN lose them now)
        var slots = Math.max(3, lives);
        if (lives <= 6) {
            for (var i = 0; i < slots; i++) drawHeart(W / 2 - (slots - 1) * 13 + i * 26, top + 28, i < lives);
        } else {
            drawHeart(W / 2 - 16, top + 28, true);
            drawText("×" + lives, W / 2 + 4, top + 28, "bold 18px 'Segoe UI', Arial, sans-serif", "#FF4081", "#000", 3, "left");
        }

        // pause button — works on foot (keyboard P did too) but the button was
        // never drawn, so it was effectively hidden. Now it's here, like driving.
        drawIconButton(PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, "❚❚", { bg: "#FFFFFF", bgDark: "#BDBDBD", id: "pause" });

        // on-foot chase banner + distance meter (run ⚡ to open the gap!)
        if (footChase) {
            var pulse = Math.sin(gameTime * 9) > 0;
            drawText("🚨 COP CHASING — RUN! ⚡", W / 2, top + 56, "bold 14px 'Segoe UI', Arial, sans-serif", pulse ? "#FF5252" : "#FFEB3B", "#000", 3);
            var bw = 150, bx = W / 2 - bw / 2, by = top + 66;
            ctx.fillStyle = "rgba(0,0,0,0.45)"; roundRect(bx, by, bw, 7, 3); ctx.fill();
            // The bar tells the TRUTH now: it fills at the escape threshold (270),
            // then a marker + "KEEP GOING" shows the hold-it phase — a full bar no
            // longer promises an escape it hasn't earned yet.
            var gp = clamp(footChase.gap / 270, 0, 1);
            ctx.fillStyle = gp > 0.6 ? "#7CFC4F" : gp > 0.3 ? "#FFD740" : "#FF5252";
            roundRect(bx, by, bw * gp, 7, 3); ctx.fill();
            if (footChase.gap > 270) {
                var hp = clamp(footChase.escapeT / 1.8, 0, 1);
                ctx.fillStyle = "rgba(255,255,255,0.9)";
                roundRect(bx, by + 9, bw * hp, 3, 1.5); ctx.fill();
                var kg = 0.5 + 0.5 * Math.abs(Math.sin(gameTime * 6));
                ctx.globalAlpha = 0.55 + 0.45 * kg;
                drawText("KEEP GOING! 🏃‍♀️", W / 2, by + 22, "bold 10px 'Segoe UI', Arial, sans-serif", "#B9F6CA", "#000", 2);
                ctx.globalAlpha = 1;
            } else {
                drawText("distance", W / 2, by + 18, "bold 9px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2);
            }
        }

        if (footHintT > 0) {
            ctx.globalAlpha = clamp(footHintT, 0, 1);
            drawText(footHint, W / 2, top + 64, "bold 12px Arial", "#FFF8E1", "#000", 3);
            ctx.globalAlpha = 1;
        }
        if (footPrompt) {
            var py = player.y - 78, pw = footPrompt.label.length * 7 + 24;
            ctx.fillStyle = "rgba(0,0,0,0.7)"; roundRect(player.x - pw / 2, py, pw, 22, 6); ctx.fill();
            drawText(footPrompt.label, player.x, py + 11, "bold 11px Arial", "#FFE082", "#000", 2);
        }
        if (footChatT > 0) drawSpeechBubble(player.x, player.y - 54, footChat, footWalkTime);

        // Buttons: run/slow on the LEFT (boost/brake slots), interact on the RIGHT.
        if (isTouchDevice) {
            drawIconButton(MOBILE_BOOST_RECT.x, MOBILE_BOOST_RECT.y, MOBILE_BOOST_RECT.w, "⚡",
                { bg: keys.up ? "#FFEB3B" : "#FFC107", bgDark: "#FF6F00" });
            drawIconButton(MOBILE_BRAKE_RECT.x, MOBILE_BRAKE_RECT.y, MOBILE_BRAKE_RECT.w, "🐢",
                { bg: keys.down ? "#FFEB3B" : "#90CAF9", bgDark: "#1565C0" });
            drawIconButton(HONK_RECT.x, HONK_RECT.y, HONK_RECT.w, footPrompt ? "👉" : "✋",
                { bg: footPrompt ? "#7CFC4F" : "#B0BEC5", bgDark: "#2E7D32" });
            // pepper spray works on foot too (self-defense) — shown when owned.
            if (save.pepperSpray > 0 && typeof drawPepperButton === "function") drawPepperButton();
            drawSpeedLockBadges();
            drawText("drag to walk", W / 2, H - 14, "11px Arial", "#FFFFFF", "#000", 2);
        }
    }

    // ── Intro tableau (auto, no tap) ─────────────────────────
    function drawFootIntro() {
        drawRoad(scrollOffset);
        drawDecorations(footWalkTime);
        drawCityBuildings();
        drawSeasonFx();
        var prog = clamp(1 - footIntroT / 1.6, 0, 1);
        ctx.fillStyle = "rgba(30,16,46,0.30)"; ctx.fillRect(0, 0, W, H);

        var cx = W / 2 - 32, cy = H * 0.45;
        // ── the dead car: tilted, hood up, hazards blinking, engine smoking ──
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(0.32);
        drawLuluCar(0, 0, 0, false, footWalkTime, false, save.selectedSkin, 1, true);   // EMPTY — she climbed out
        // popped hood (front of the top-down car)
        ctx.fillStyle = "rgba(0,0,0,0.25)"; roundRect(-14, -34, 28, 8, 2); ctx.fill();
        ctx.restore();
        // hazard blinkers (flashing amber)
        if (Math.sin(footWalkTime * 6) > 0) {
            ctx.fillStyle = "#FFC107";
            ctx.beginPath(); ctx.arc(cx - 18, cy - 22, 2.5, 0, Math.PI * 2); ctx.arc(cx + 16, cy - 26, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        // engine smoke (steady plume) + a couple of sparks
        if (footWalkTime % 0.07 < 0.035) particles.push({ x: cx - 6 + rand(-8, 8), y: cy - 30,
            vx: rand(-12, 12), vy: rand(-52, -26), life: 1.3, maxLife: 1.3, size: rand(7, 13),
            color: randPick(["#616161", "#9E9E9E", "#757575"]), gravity: -22, smoke: true });
        if (prog < 0.5 && Math.random() < 0.2) particles.push({ x: cx - 4, y: cy - 28, vx: rand(-30, 30), vy: rand(-40, -10),
            life: 0.4, maxLife: 0.4, size: rand(2, 4), color: "#FFB300", gravity: 120 });
        drawParticles();

        // ── Lulu climbs out and stands beside the wreck (animated) ──
        var lx = lerp(cx + 4, cx + 60, clamp(prog / 0.55, 0, 1)), ly = cy + 12;
        var mood = prog < 0.4 ? "panic" : "cry";
        // dust puffs as she scrambles out
        if (prog < 0.55 && Math.random() < 0.3) particles.push({ x: lx, y: ly + 16, vx: rand(-26, 26), vy: rand(-20, -4),
            life: 0.5, maxLife: 0.5, size: rand(4, 8), color: "#CFC4B0", gravity: 40, smoke: true });
        drawLuluTopDown(lx, ly, footWalkTime, mood);
        if (prog > 0.32) drawSpeechBubble(lx, ly - 48, footIntroLine, footWalkTime);

        // ── title card pops in ──
        var tp = clamp((prog - 0.2) / 0.3, 0, 1);
        ctx.save(); ctx.translate(W / 2, H * 0.68); ctx.scale(0.82 + tp * 0.18, 0.82 + tp * 0.18); ctx.globalAlpha = tp;
        drawText("🚶‍♀️ LULU ON FOOT", 0, 0, "bold 24px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 5);
        ctx.restore();
        ctx.globalAlpha = tp;
        drawText("borrow a car to get back on the road", W / 2, H * 0.68 + 26, "bold 12px Arial", "#FFF8E1", "#000", 2);
        ctx.globalAlpha = 1;
    }

    // ── Interior contract (interiors live in 08c/08d/08e) ────
    function enterFootInterior(type) {
        footInteriorType = type;
        state = "footInterior";
        if (type === "bars" && typeof initBarsInterior === "function") initBarsInterior();
        else if (type === "school" && typeof initSchoolInterior === "function") initSchoolInterior();
        else if (type === "hospital" && typeof initHospitalInterior === "function") initHospitalInterior();
        else if (type === "police" && typeof initPoliceInterior === "function") initPoliceInterior();
        else if (type === "beach" && typeof initBeachInterior === "function") initBeachInterior();
        else { exitFootInterior(); return; }
        // Prime the interior's per-frame layout (some compute button rects in
        // update) so the FIRST draw — which can be the same frame we entered
        // (door collision / bored-cop pickup) — never sees a null rect.
        updateFootInterior(0);
        playClick();
    }
    function exitFootInterior() {
        footInteriorType = null;
        state = "footRun";
        footDoors = []; footDoorCool = 2.0; footPrompt = null;
        footMood = "run";
        invincibleTimer = Math.max(invincibleTimer, 2.0); // shield on re-entry to the road
        playClick();
    }

    // ── Shared "useful service" button for interiors (bottom-left, opposite the
    //    LEAVE button). A labeled action with a coin cost, dimmed when it can't
    //    be used / already done, green-checked when complete. Returns nothing;
    //    interiors keep their own rect for hit-testing. ──
    function footServiceRect() { return { x: 12, y: H - SAFE_BOTTOM - 64, w: 150, h: 52 }; }
    function drawFootServiceBtn(r, icon, label, costText, state) {
        // state: "ready" | "cant" | "done"
        var bg = state === "done" ? "#66BB6A" : state === "cant" ? "#9E9E9E" : "#7E57C2";
        var bgD = state === "done" ? "#2E7D32" : state === "cant" ? "#616161" : "#4527A0";
        drawButton(r.x, r.y, r.w, r.h, "", { bg: bg, bgDark: bgD, small: true });
        drawText(icon + " " + label, r.x + r.w / 2, r.y + 17, "bold 12px 'Segoe UI', Arial", "#FFFFFF", "#000", 2);
        drawText(costText, r.x + r.w / 2, r.y + 35, "bold 12px 'Segoe UI', Arial",
            state === "done" ? "#E8F5E9" : state === "cant" ? "#EEEEEE" : "#FFE082", "#000", 2);
    }
    function updateFootInterior(dt) {
        updateParticles(dt);
        var t = footInteriorType;
        if (t === "bars" && typeof updateBarsInterior === "function") updateBarsInterior(dt);
        else if (t === "school" && typeof updateSchoolInterior === "function") updateSchoolInterior(dt);
        else if (t === "hospital" && typeof updateHospitalInterior === "function") updateHospitalInterior(dt);
        else if (t === "police" && typeof updatePoliceInterior === "function") updatePoliceInterior(dt);
        else if (t === "beach" && typeof updateBeachInterior === "function") updateBeachInterior(dt);
        else exitFootInterior();
    }
    function drawFootInterior() {
        var t = footInteriorType;
        if (t === "bars" && typeof drawBarsInterior === "function") drawBarsInterior();
        else if (t === "school" && typeof drawSchoolInterior === "function") drawSchoolInterior();
        else if (t === "hospital" && typeof drawHospitalInterior === "function") drawHospitalInterior();
        else if (t === "police" && typeof drawPoliceInterior === "function") drawPoliceInterior();
        else if (t === "beach" && typeof drawBeachInterior === "function") drawBeachInterior();
        else { ctx.fillStyle = "#222"; ctx.fillRect(0, 0, W, H); }
        drawParticles();
        drawTapFx();   // consistent tap feedback — interior targets had none
    }

    // ── Running Lulu (top-down) ──────────────────────────────
    function drawLuluTopDown(x, y, walkTime, mood) {
        ctx.save();
        var dancing = (mood === "dance");
        var bob = Math.abs(Math.sin(walkTime * (dancing ? 18 : 13))) * (dancing ? 9 : 4);
        var lean = Math.sin(walkTime * (dancing ? 9 : 13)) * (dancing ? 0.18 : 0.05);
        ctx.translate(x, y - bob);
        ctx.rotate(lean);
        var legSwing = Math.sin(walkTime * 16) * (dancing ? 9 : 7);
        var armSwing = Math.sin(walkTime * 16) * (dancing ? 1.5 : 0.5);

        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(0, 22, 16, 4, 0, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = "#3F5C8A";
        roundRect(-6, 7 - legSwing, 5, 16 + legSwing, 2); ctx.fill();
        roundRect(1, 7 + legSwing, 5, 16 - legSwing, 2); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        roundRect(-7, 21 - legSwing, 7, 4, 2); ctx.fill();
        roundRect(0, 21 + legSwing, 7, 4, 2); ctx.fill();

        for (var a = 0; a < 2; a++) {
            ctx.save();
            ctx.translate(a === 0 ? -11 : 11, -3);
            ctx.rotate((a === 0 ? 1 : -1) * armSwing);
            ctx.fillStyle = "#FF9EC3";
            roundRect(-2, 0, 4, 11, 2); ctx.fill();
            ctx.fillStyle = "#FFE0CC";
            ctx.beginPath(); ctx.arc(0, 11, 2.3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FF9EC3";
        ctx.beginPath(); ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFC0DA";
        ctx.beginPath(); ctx.ellipse(-5, -3, 4, 2.5, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#8E5A3C"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(7, 7); ctx.stroke();
        ctx.fillStyle = "#A1674A"; roundRect(5, 4, 7, 6, 2); ctx.fill();

        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(0, -13, 9.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(0, -13, 8.5, 0, Math.PI * 2); ctx.fill();

        var hair = save.luluHair || "#8B5A2B";
        var hStyle = save.luluHairStyle || "sheitel";
        ctx.fillStyle = hair;
        ctx.beginPath(); ctx.arc(0, -16, 9, Math.PI, Math.PI * 2); ctx.fill();
        // SHAPE: bouncy = side volume puffs · avigail = curl tower on top
        if (hStyle === "bouncy") {
            ctx.beginPath(); ctx.arc(-9, -14, 4.5, 0, Math.PI * 2); ctx.arc(9, -14, 4.5, 0, Math.PI * 2); ctx.fill();
        } else if (hStyle === "avigail") {
            ctx.beginPath();
            ctx.arc(-5, -20, 3, 0, Math.PI * 2); ctx.arc(0, -22, 3.4, 0, Math.PI * 2);
            ctx.arc(5, -20, 3, 0, Math.PI * 2); ctx.fill();
        }
        var tail = Math.sin(walkTime * 16) * 3;
        ctx.beginPath(); ctx.ellipse(0 + tail, -2, 4.5, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = shadeColor(hair, 22);
        ctx.beginPath(); ctx.ellipse(-3, -17, 3, 2, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FF4FA3";
        ctx.beginPath(); ctx.arc(0, -9, 1.5, 0, Math.PI * 2); ctx.fill();

        if (mood === "cry") {
            ctx.strokeStyle = "#3D2817"; ctx.lineWidth = 1; ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(-3, -13.5, 1.6, 1.15 * Math.PI, 1.85 * Math.PI);
            ctx.arc(3, -13.5, 1.6, 1.15 * Math.PI, 1.85 * Math.PI);
            ctx.stroke(); ctx.lineCap = "butt";
            ctx.fillStyle = "#4FC3F7";
            ctx.beginPath(); ctx.arc(-3.5, -10.5, 1, 0, Math.PI * 2); ctx.arc(3.5, -10.5, 1, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#A0394D"; ctx.lineWidth = 0.9;
            ctx.beginPath(); ctx.arc(0, -8.5, 2, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
        } else {
            ctx.strokeStyle = "#3D2817"; ctx.lineWidth = 1; ctx.lineCap = "round";
            ctx.beginPath();
            if (mood === "panic") { ctx.arc(-2.5, -13, 1.8, 0, Math.PI * 2); ctx.arc(2.5, -13, 1.8, 0, Math.PI * 2); }
            else { ctx.arc(-2.5, -13, 1.5, 1.1 * Math.PI, 1.9 * Math.PI); ctx.arc(2.5, -13, 1.5, 1.1 * Math.PI, 1.9 * Math.PI); }
            ctx.stroke(); ctx.lineCap = "butt";
            ctx.strokeStyle = "#A0394D"; ctx.lineWidth = 0.9;
            ctx.beginPath();
            if (mood === "panic") ctx.ellipse(0, -9.5, 1.6, 1.4, 0, 0, Math.PI * 2);
            else ctx.arc(0, -10, 2, 0.12 * Math.PI, 0.88 * Math.PI);
            ctx.stroke();
        }
        ctx.fillStyle = mood === "panic" ? "rgba(244,90,90,0.55)" : "rgba(230,140,140,0.45)";
        ctx.beginPath(); ctx.arc(-5, -11, mood === "panic" ? 1.6 : 1.1, 0, Math.PI * 2);
        ctx.arc(5, -11, mood === "panic" ? 1.6 : 1.1, 0, Math.PI * 2); ctx.fill();

        // ── DISGUISE: paint the old-lady / old-man getup over the top so she
        //    visibly becomes someone else after the QUICK-CHANGE booth. ──
        if (footDisguiseLook === "oldLady") {
            ctx.fillStyle = "#8D6E63"; ctx.beginPath(); ctx.ellipse(0, 1, 13, 10, 0, 0, Math.PI * 2); ctx.fill();   // drab shawl over the torso
            ctx.fillStyle = "#CFCFCF"; ctx.beginPath(); ctx.arc(0, -19, 4, 0, Math.PI * 2); ctx.fill();             // gray bun peeking out back
            ctx.fillStyle = "#C2185B"; ctx.beginPath(); ctx.arc(0, -14, 9.6, Math.PI, 0);                          // floral babushka headscarf
            ctx.lineTo(8, -11); ctx.quadraticCurveTo(0, -7.5, -8, -11); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-2.4, -7); ctx.lineTo(2.4, -7); ctx.lineTo(0, -2.5); ctx.closePath(); ctx.fill();   // knot under the chin
            ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.beginPath();
            ctx.arc(-4, -14, 1, 0, Math.PI * 2); ctx.arc(3, -16, 1, 0, Math.PI * 2); ctx.arc(5, -12, 1, 0, Math.PI * 2); ctx.fill();   // polka dots
            ctx.strokeStyle = "#555"; ctx.lineWidth = 0.8; ctx.beginPath();
            ctx.arc(-2.6, -13, 2, 0, Math.PI * 2); ctx.arc(2.6, -13, 2, 0, Math.PI * 2); ctx.moveTo(-0.6, -13); ctx.lineTo(0.6, -13); ctx.stroke();   // granny glasses
        } else if (footDisguiseLook === "oldMan") {
            ctx.fillStyle = "#546E7A"; ctx.beginPath(); ctx.ellipse(0, 1, 13, 10, 0, 0, Math.PI * 2); ctx.fill();   // drab coat over the torso
            ctx.fillStyle = "#CFCFCF"; ctx.beginPath(); ctx.arc(-7, -12.5, 2.6, 0, Math.PI * 2); ctx.arc(7, -12.5, 2.6, 0, Math.PI * 2); ctx.fill();   // gray side hair
            ctx.fillStyle = "#5D4037"; ctx.beginPath(); ctx.arc(0, -15, 9, Math.PI, 0); ctx.fill();                 // flat newsboy cap
            ctx.beginPath(); ctx.ellipse(0, -15, 9, 2.6, 0, Math.PI, 0); ctx.fill();
            ctx.fillStyle = "#4E342E"; roundRect(-10, -15.5, 5, 2.4, 1); ctx.fill();                                // little brim
            ctx.fillStyle = "#E0E0E0"; ctx.beginPath(); ctx.ellipse(0, -9, 3.6, 1.6, 0, 0, Math.PI * 2); ctx.fill();   // bushy gray mustache
            ctx.strokeStyle = "#555"; ctx.lineWidth = 0.8; ctx.beginPath();
            ctx.arc(-2.6, -13, 2, 0, Math.PI * 2); ctx.arc(2.6, -13, 2, 0, Math.PI * 2); ctx.stroke();              // round spectacles
        }

        ctx.restore();
    }

    function drawFootStar(cx, cy, r, col) {
        ctx.fillStyle = col;
        ctx.beginPath();
        for (var i = 0; i < 10; i++) {
            var ang = -Math.PI / 2 + i * Math.PI / 5;
            var rr = i % 2 === 0 ? r : r * 0.45;
            var px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#FFA000"; ctx.lineWidth = 1; ctx.stroke();
    }
