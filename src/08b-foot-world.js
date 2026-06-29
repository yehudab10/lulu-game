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
    var footParked = [];         // stealable parked cars on the shoulder
    var footDoors = [];          // building entrances
    var footPrompt = null;       // nearest interactable { kind, ent, label }
    var footCompanion = null;    // Avigail walking along with her { x, y, walkTime, say, sayT }
    var footBuskT = 0;           // >0 while she's busking/dancing on the curb
    var footArrestT = 0;         // >0 during the "cop walks her in" cinematic
    var footArrest = null;       // { x, y, line } cop cruiser pulling her over on foot
    var footDoorCool = 0, footParkCool = 0;
    var footEntryReason = "crashReprieve";
    var footRunLevel = 1;
    var footCoinsRun = 0, footStars = 0;
    // Stars Lulu earns exploring on foot bank into the REAL star currency
    // (save.parkingTotalStars) — the same ⭐ she spends in the sticker book —
    // so they actually mean something instead of vanishing on a side counter.
    function footAwardStar(n) { save.parkingTotalStars = (save.parkingTotalStars || 0) + (n || 1); persistSave(); }
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
    var FOOT_HAIL_VEHICLE = { bus: "On a BUS now?! 🚌", ambulance: "WEE-OOO! 🚑", cop: "Driving a COP car?! 🚓" };
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
        ]
    };

    function startFootWorld(reason) {
        footEntryReason = reason;
        footRunLevel = (save.footRunsPlayed || 0) + 1;
        save.footRunsPlayed = footRunLevel; persistSave();
        footIntroT = 1.6; footWalkTime = 0; footMood = "cry";
        footParked = []; footDoors = []; footPrompt = null; footCompanion = null;
        footParkCool = 5; footDoorCool = 2; footArrestT = 0; footArrest = null; footBuskT = 0;
        footCoinsRun = 0; footStars = 0;
        footChat = ""; footChatT = 0; footChatNext = rand(2.5, 4.5);
        footInteriorType = null;
        footHint = "Find a car to “borrow” 🚗  •  ✋ to interact"; footHintT = 6;
        var pool = reason === "parkingCrash" ? FOOT_INTRO_LINES.parkingCrash
                 : reason === "copWalk"      ? FOOT_INTRO_LINES.copWalk
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
        footMood = footBuskT > 0 ? "dance" : (invincibleTimer > 0 ? "panic" : "run");

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
        footScroll(footParked, 110, dt);
        footScroll(footDoors, 80, dt);
        updateFootCompanion(dt);

        // Nearest thing she can interact with + the hand-button action.
        footPrompt = footNearestInteractable();
        if (footActQueued) { footActQueued = false; if (footPrompt) doFootInteract(footPrompt); else footBusk(); }

        // A bored cop who spots her walking CLOSE BY occasionally takes her in
        // (low chance) — straight to the precinct interior. No speeding here.
        if (footBuskT <= 0) {
            var copSeen = null, ic;
            for (ic = 0; ic < roadCops.length; ic++) { var rc = roadCops[ic]; if (!rc.busted && Math.abs(rc.x - player.x) < 80 && Math.abs(rc.y - player.y) < 90) { copSeen = rc; break; } }
            if (!copSeen) for (ic = 0; ic < obstacles.length; ic++) { var oc = obstacles[ic]; if (oc.type === "car" && (oc.behavior === "patrol" || oc.behavior === "pulled") && Math.abs(oc.x - player.x) < 90 && Math.abs(oc.y - player.y) < 100) { copSeen = oc; break; } }
            if (copSeen && Math.random() < dt * 0.10) {
                copSeen.busted = true; // this cop is now the one nabbing her (no re-trigger)
                footStartArrest(copSeen.x);
                return;
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
        footParked.push({ x: left ? ROAD_L - 24 : ROAD_R + 24, y: -110,
            color: randPick(C.enemyCols), carType: randInt(0, 2), rot: left ? 0.12 : -0.12 });
    }

    var FOOT_DOOR_NAME = { bars: "BAR", school: "SCHOOL", hospital: "CLINIC", police: "PRECINCT", beach: "BEACH" };
    function footZoneInterior() {
        if (typeof zone === "undefined") return null;
        if (zone === "bars" || zone === "school" || zone === "hospital" || zone === "police" || zone === "beach") return zone;
        return null;
    }
    function footMaybeSpawnDoor() {
        if (footDoorCool > 0 || footDoors.length > 0) return;
        var t = footZoneInterior();
        if (!t) return;
        footDoorCool = rand(4, 7);
        var left = Math.random() < 0.5;
        footDoors.push({ type: t, x: left ? ROAD_L - 30 : ROAD_R + 30, y: -90 });
    }

    function footNearestInteractable() {
        var best = null, bestD = 1e9;
        function consider(cand, dx, dy, rx, ry) {
            if (Math.abs(dx) < rx && Math.abs(dy) < ry) { var d = Math.abs(dx) + Math.abs(dy); if (d < bestD) { best = cand; bestD = d; } }
        }
        for (var i = 0; i < footDoors.length; i++) {
            var dr = footDoors[i];
            consider({ kind: "enter", ent: dr, label: "🚪 ENTER " + FOOT_DOOR_NAME[dr.type] }, dr.x - player.x, dr.y - player.y, 58, 66);
        }
        for (var p = 0; p < footParked.length; p++) {
            var pc = footParked[p];
            consider({ kind: "borrow", ent: pc, label: "🚗 BORROW CAR" }, pc.x - player.x, pc.y - player.y, 58, 88);
        }
        // Live-world folk: talk to peds, pet animals, chat up cops, or HAIL a car.
        for (var o = 0; o < obstacles.length; o++) {
            var e = obstacles[o];
            if (e.type === "ped") consider({ kind: "talk", ent: e, label: "💬 TALK" }, e.x - player.x, e.y - player.y, 46, 50);
            else if (e.type === "duck" || e.type === "raccoon" || e.type === "ostrich")
                consider({ kind: "pet", ent: e, label: "🐾 PET" }, e.x - player.x, e.y - player.y, 44, 46);
            else if (e.type === "car") {
                var lbl = e.behavior === "bus" ? "🚌 HAIL BUS" : e.behavior === "ambulance" ? "🚑 HAIL AMBULANCE"
                        : (e.behavior === "patrol" || e.behavior === "pulled") ? "🚓 HAIL COP CAR" : "🚕 HAIL RIDE";
                consider({ kind: "hail", ent: e, label: lbl }, e.x - player.x, e.y - player.y, 60, 80);
            }
        }
        // The sasquatch easter egg → a selfie with the big guy.
        if (typeof sasquatch !== "undefined" && sasquatch)
            consider({ kind: "selfie", ent: sasquatch, label: "🤳 SELFIE" }, sasquatch.x - player.x, sasquatch.y - player.y, 64, 76);
        return best;
    }

    function doFootInteract(prompt) {
        if (prompt.kind === "enter") { enterFootInterior(prompt.ent.type); return; }
        if (prompt.kind === "borrow") {
            spawnFloater(player.x, player.y - 32, randPick(FOOT_STEAL_LINES), "#FFE082");
            spawnCrashBurst(prompt.ent.x, prompt.ent.y, false);
            playTone(520, 0.08, "square", 0.12);
            // Boosting a car in front of a cop = caught red-handed → straight to
            // jail (and her day in court).
            var seen = Math.random() < 0.1 || (typeof copInView === "function" && copInView());
            lives = Math.max(lives, 1);
            footParked = []; footDoors = []; footCompanion = null;
            if (seen && typeof beginArrest === "function") { beginArrest(["GRAND THEFT AUTO", "JOYRIDING"]); return; }
            returnToDriving();   // clean getaway — back on the road (state → "playing")
            return;
        }
        if (prompt.kind === "hail") {
            footChat = ""; footChatT = 0;
            if (Math.random() < 0.6) {     // a kind driver gives her a lift — legit ride, no chase
                // She drives whatever she flagged down — a bus stays a bus, etc.
                var b = prompt.ent.behavior;
                playerVehicle = (b === "bus") ? "bus" : (b === "ambulance") ? "ambulance"
                              : (b === "patrol" || b === "pulled") ? "cop" : null;
                spawnFloater(player.x, player.y - 32, playerVehicle ? FOOT_HAIL_VEHICLE[playerVehicle] : randPick(FOOT_HAIL_OK), "#7CFC4F");
                playTone(660, 0.1, "triangle", 0.14);
                lives = Math.max(lives, 1);
                footParked = []; footDoors = []; footCompanion = null;
                returnToDriving();
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
        invincibleTimer = 1.6; footMood = "panic";
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
        if (r < 0.10 && typeof startFootWedding === "function") { startFootWedding(); return; }
        if (r < 0.30) { footAvigailBusy(av); return; }
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
    function drawFootWorld() {
        if (footCompanion) {
            drawAvigailWalker(footCompanion.x, footCompanion.y, footCompanion.walkTime);
            if (footCompanion.sayT > 0) drawSpeechBubble(footCompanion.x, footCompanion.y - 40, footCompanion.say, footCompanion.walkTime);
        }
        for (var p = 0; p < footParked.length; p++) {
            var pc = footParked[p];
            ctx.save(); ctx.translate(pc.x, pc.y); ctx.rotate(pc.rot || 0);
            drawEnemyCar(0, 0, pc.color, pc.carType);
            ctx.restore();
        }
        for (var p = 0; p < footParked.length; p++) {
            var pc = footParked[p];
            ctx.save(); ctx.translate(pc.x, pc.y); ctx.rotate(pc.rot || 0);
            drawEnemyCar(0, 0, pc.color, pc.carType);
            ctx.restore();
        }
        for (var d = 0; d < footDoors.length; d++) drawFootDoor(footDoors[d]);
    }

    function drawFootDoor(dr) {
        var onLeft = dr.x < W / 2;
        ctx.save();
        ctx.translate(dr.x, dr.y);
        var col = { bars: "#7E57C2", school: "#EF5350", hospital: "#42A5F5", police: "#5C6BC0", beach: "#26C6DA" }[dr.type] || "#8D6E63";
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
        drawCoin(72, top + 36, gameTime);
        drawText("× " + runCoins, 86, top + 35, "bold 20px 'Segoe UI', Arial, sans-serif", C.coin, C.hudShadow, 4, "left");

        // ⭐ stars (top-right) — the REAL, spendable star total (same ⭐ the
        // sticker book uses), not a throwaway counter.
        drawText("⭐ " + (save.parkingTotalStars || 0), W - 14, top + 26, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 3, "right");

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
        ctx.fillStyle = hair;
        ctx.beginPath(); ctx.arc(0, -16, 9, Math.PI, Math.PI * 2); ctx.fill();
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
