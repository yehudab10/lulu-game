    // Transient visual-only pickup pops (coin collect rings). Drawn in drawPlaying.
    var coinPops = [];

    // Car-on-car fender benders — when two traffic cars bump, they wreck on the
    // road and (sometimes) the drivers pile out to argue; a cop may roll up.
    var roadDramas = [];
    var carCrashCooldown = rand(7, 16);
    // Drivers bickering after a fender bender (they alternate these).
    var CAR_ARGUE = ["YOU were TEXTING!", "Look at my BUMPER!!", "I had the RIGHT of way!",
        "You came outta NOWHERE!", "My cousin's a LAWYER!", "Watch where you're GOING!",
        "This is a LEASE!", "You owe me a FENDER!", "I just WAXED this!", "Call your INSURANCE!",
        "Were you even LOOKING?!", "Unbelievable!", "My BACK! ...actually it's fine.",
        "Off the road, BOTH of you!", "I'm filming this!", "Says the guy in REVERSE!"];
    var DRAMA_COP_LINES = ["🚓 BREAK IT UP!", "🚓 Move it ALONG!", "🚓 Who called this in?",
        "🚓 Licenses. Both of ya.", "🚓 Nobody's hurt? GO.", "🚓 Off the road, folks!"];

    // Pepper spray — a short green spray cone toward the last target. Drawn in
    // drawPlaying, ticked down in updatePlaying.
    var pepperBeam = null;
    var PEPPER_ANIMAL = ["🌶️ ZAP!", "Sorry, lil guy!", "Off the road! 🐾", "Pew pew! 🌶️",
        "Not today, critter!", "Spicy! 🥵", "Shoo!! 💨"];
    var PEPPER_PED = ["🤧 MY EYES!", "AGH — SPICY!", "Was that... MACE?!", "I can't SEE!",
        "Why, Lulu, WHY?!", "*coughing fit*", "I'm CALLING someone!"];

    // A puff of green spray particles where pepper spray lands.
    function spawnPepperCloud(x, y) {
        for (var i = 0; i < 16; i++) {
            var ang = rand(0, Math.PI * 2), spd = rand(20, 95);
            particles.push({
                x: x, y: y,
                vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 25,
                life: rand(0.4, 0.95), maxLife: 0.85, size: rand(3, 7),
                color: randPick(["#AED581", "#9CCC65", "#C5E1A5", "#7CB342"]),
                gravity: -12, smoke: true
            });
        }
    }

    // Spray the nearest animal (clears it) or person (drops them — ambulance
    // responds) ahead of Lulu. A whiff with no target in range costs nothing.
    function firePepperSpray() {
        if (save.pepperSpray <= 0) { playDeny(); return; }
        var best = null, bestD = 1e9, bestKind = null, ai = -1;
        for (var a = 0; a < animals.length; a++) {
            var an = animals[a];
            if (an.y > player.y + 24 || an.y < player.y - 250) continue;
            var d = Math.abs(an.x - player.x) + Math.abs(an.y - player.y);
            if (d < bestD) { bestD = d; best = an; bestKind = "animal"; ai = a; }
        }
        if (!best) {
            for (var p = 0; p < obstacles.length; p++) {
                var ob = obstacles[p];
                if (ob.type !== "ped" || ob.sprayed || ob.kid) continue;   // never the kids
                if (ob.y > player.y + 24 || ob.y < player.y - 250) continue;
                var dp = Math.abs(ob.x - player.x) + Math.abs(ob.y - player.y);
                if (dp < bestD) { bestD = dp; best = ob; bestKind = "ped"; }
            }
        }
        if (!best) {   // nothing in range → harmless whiff, no charge spent
            spawnFloater(player.x, player.y - 40, "🌶️ *whiff!*", "#A5D6A7");
            playTone(300, 0.08, "sawtooth", 0.05);
            return;
        }
        save.pepperSpray--; persistSave();
        pepperBeam = { x: player.x, y: player.y - CAR_H / 2, tx: best.x, ty: best.y, t: 0.3 };
        spawnPepperCloud(best.x, best.y);
        playTone(540, 0.05, "sawtooth", 0.09, 240); // *pssst*
        if (bestKind === "animal") {
            spawnFloater(best.x, best.y - 20, randPick(PEPPER_ANIMAL), "#C5E1A5");
            if (ai >= 0) animals.splice(ai, 1);
        } else if (best.cop) {
            // Macing a COP is a one-way ticket downtown.
            spawnFloater(best.x, best.y - 20, "😡 BIG mistake!", "#FF5252");
            if (typeof beginArrest === "function") beginArrest(["ASSAULTING AN OFFICER", "PEPPER-SPRAYING A COP"]);
            return;
        } else {
            best.sprayed = true; best.vx = 0;
            best.comment = randPick(PEPPER_PED); best.commentT = 2.6;
            spawnFloater(player.x, player.y - 56, "🚑 Ambulance inbound!", "#FF8A80");
            if (typeof spawnAmbulance === "function") spawnAmbulance();
        }
    }

    // ── Special-vehicle abilities (cop / ambulance / school bus) ──
    var busStopT = 0;            // >0 while the bus's STOP sign is deployed
    var busKidTimer = 0;         // spawn cadence for roadside kids while bus-driving
    var busKids = 0;             // kids picked up this run
    var RESCUE_LINES = ["You're SAVED!", "To the hospital!", "Hang in there!",
        "Easy does it!", "Gotcha! 🚑", "We've got you!"];

    function vehicleHasAction() {
        return playerVehicle === "cop" || playerVehicle === "ambulance" || playerVehicle === "bus";
    }
    function doVehicleAction() {
        if (playerVehicle === "cop") copPullOver();
        else if (playerVehicle === "ambulance") ambulanceRescue();
        else if (playerVehicle === "bus") busStopSign();
    }

    // Ambulance: scoop up the nearest hurt person (a pepper-sprayed one counts
    // double) and whisk them off for a reward.
    function ambulanceRescue() {
        if (playerVehicle !== "ambulance") return;
        var best = null, bi = -1, bestScore = -1;
        for (var i = 0; i < obstacles.length; i++) {
            var o = obstacles[i];
            if (o.type !== "ped" || o.kid) continue;
            if (o.y > player.y + 30 || o.y < player.y - 300) continue;
            var sc = (o.sprayed ? 1000 : 0) + (300 - Math.abs(o.y - player.y));
            if (sc > bestScore) { bestScore = sc; best = o; bi = i; }
        }
        if (!best) {
            spawnFloater(player.x, player.y - 46, "🚑 No patients nearby!", "#90CAF9");
            playTone(900, 0.1, "sine", 0.1, 1320);
            return;
        }
        var reward = best.sprayed ? 35 : 18;
        runCoins += reward; save.totalCoins += reward; persistSave();
        for (var p = 0; p < 12; p++) {
            var a = rand(0, Math.PI * 2), spd = rand(30, 95);
            particles.push({ x: best.x, y: best.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                life: rand(0.4, 0.8), maxLife: 0.7, size: rand(2, 5),
                color: randPick(["#FFFFFF", "#EF5350", "#FF8A80"]), gravity: 0 });
        }
        spawnFloater(best.x, best.y - 24, randPick(RESCUE_LINES), "#FF8A80");
        spawnFloater(player.x, player.y - 58, "+" + reward + " 💰", "#FFD700");
        playCoin();
        obstacles.splice(bi, 1);
        playTone(900, 0.12, "sine", 0.13, 1320);
        setTimeout(function () { playTone(1320, 0.12, "sine", 0.13, 900); }, 160);
    }

    // School bus: pop the STOP sign — nearby cars halt and waiting kids board.
    function busStopSign() {
        if (playerVehicle !== "bus") return;
        busStopT = 2.8;
        playTone(520, 0.1, "square", 0.1);
        var boarded = 0;
        for (var i = obstacles.length - 1; i >= 0; i--) {
            var o = obstacles[i];
            if (o.type === "car" && !o.crashed && Math.abs(o.y - player.y) < 220) o.stopT = 2.8;
            if (o.type === "ped" && o.kid && Math.abs(o.y - player.y) < 190 && Math.abs(o.x - player.x) < 150) {
                boarded++; busKids++;
                spawnFloater(o.x, o.y - 22, "🎒 hops in!", "#FFEB3B");
                obstacles.splice(i, 1);
            }
        }
        if (boarded > 0) {
            var rw = boarded * 8;
            runCoins += rw; save.totalCoins += rw; persistSave();
            spawnFloater(player.x, player.y - 58, "+" + rw + " 💰  " + boarded + " kid" + (boarded > 1 ? "s" : "") + "!", "#FFD700");
            playCoin();
        } else {
            spawnFloater(player.x, player.y - 46, "🛑 STOP!", "#F44336");
        }
    }

    // A kid waiting on the shoulder for the (player-driven) bus.
    function spawnSchoolKid() {
        var side = Math.random() < 0.5 ? -1 : 1;
        var x = side < 0 ? rand(18, Math.max(22, ROAD_L - 18)) : rand(ROAD_R + 18, W - 18);
        obstacles.push({ type: "ped", x: x, y: -40, hitW: 12, hitH: 14, speedMult: 0.55,
            lane: 1, pedType: randInt(0, 2), kid: true, walkTime: 0 });
    }

    // A little driver who hops out of a crashed car to argue. Stays beside its
    // car (so it scrolls down with the wreck).
    function makeDramaDriver(car, side) {
        return { car: car, side: side, time: rand(0, 6), state: "yelling",
                 bubble: "", bubbleT: 0, cop: false };
    }

    // Stage a fender bender between two nearby traffic cars: both wreck in place,
    // and (sometimes) drivers get out to argue / a cop rolls up.
    function triggerCarCrash(a, b) {
        a.crashed = b.crashed = true;
        a.changing = b.changing = null;
        a.dodged = b.dodged = false;
        a.speedMult = b.speedMult = 1.0;   // now stationary on the road (scrolls with it)
        a.crashRot = rand(0.14, 0.4) * (a.x <= b.x ? 1 : -1);
        b.crashRot = rand(0.14, 0.4) * (b.x < a.x ? 1 : -1);
        var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        spawnCrashBurst(mx, my, true);
        playExplosion();
        var drama = { a: a, b: b, t: 0, smokeT: 0, drivers: [], cop: null, lineT: 1.0, who: 0 };
        if (Math.random() < 0.65) {                  // drivers pile out to argue
            drama.drivers = [makeDramaDriver(a, a.x <= b.x ? -1 : 1),
                             makeDramaDriver(b, b.x < a.x ? -1 : 1)];
        }
        if (Math.random() < 0.30) {                  // a cop rolls up, lights going
            drama.cop = { t: 0, line: randPick(DRAMA_COP_LINES), lineT: 2.4, slide: 0 };
        }
        roadDramas.push(drama);
        spawnFloater(mx, my - 40, randPick(["💥 FENDER BENDER!", "💥 CRUNCH!", "💥 OOF!", "💥 SMASH!"]), "#FF7043");
        playTone(180, 0.18, "sawtooth", 0.13, 90);
    }

    // Periodically pair up two traffic cars that have drifted close together and
    // crash them — a believable ambient fender bender, no teleporting.
    function tickCarCrashes(dt) {
        carCrashCooldown -= dt;
        if (carCrashCooldown > 0 || roadDramas.length >= 2) return;
        for (var i = 0; i < obstacles.length; i++) {
            var a = obstacles[i];
            if (a.type !== "car" || a.crashed || a.mal) continue;   // afflicted cars run their own arc
            if (a.behavior && a.behavior !== "normal" && a.behavior !== "drunk" && a.behavior !== "texting") continue;
            if (a.y < 30 || a.y > player.y - 120) continue;   // only ahead, on-screen
            for (var j = i + 1; j < obstacles.length; j++) {
                var b = obstacles[j];
                if (b.type !== "car" || b.crashed || b.mal) continue;
                if (b.behavior && b.behavior !== "normal" && b.behavior !== "drunk" && b.behavior !== "texting") continue;
                if (Math.abs(a.x - b.x) < 44 && Math.abs(a.y - b.y) < 56) {
                    triggerCarCrash(a, b);
                    carCrashCooldown = rand(10, 22);
                    return;
                }
            }
        }
    }

    function updateRoadDramas(dt) {
        for (var i = roadDramas.length - 1; i >= 0; i--) {
            var d = roadDramas[i];
            d.t += dt;
            var aGone = obstacles.indexOf(d.a) < 0 || d.a.y > H + 80;
            var bGone = obstacles.indexOf(d.b) < 0 || d.b.y > H + 80;
            if (aGone && bGone) { roadDramas.splice(i, 1); continue; }
            // lingering smoke off the wrecks
            d.smokeT -= dt;
            if (d.smokeT <= 0) {
                d.smokeT = 0.16;
                var sc = (Math.random() < 0.5 ? d.a : d.b);
                particles.push({ x: sc.x + rand(-6, 6), y: sc.y - 6, vx: rand(-12, 12), vy: rand(-40, -16),
                    life: rand(0.8, 1.6), maxLife: 1.4, size: rand(6, 11),
                    color: randPick(["#616161", "#9E9E9E", "#757575"]), gravity: -18, smoke: true });
            }
            // drivers take turns hollering
            if (d.drivers.length) {
                d.lineT -= dt;
                if (d.lineT <= 0) {
                    d.who ^= 1;
                    d.drivers[d.who].bubble = randPick(CAR_ARGUE);
                    d.drivers[d.who].bubbleT = 1.7;
                    d.lineT = 1.8;
                }
                for (var k = 0; k < d.drivers.length; k++) {
                    d.drivers[k].time += dt;
                    if (d.drivers[k].bubbleT > 0) d.drivers[k].bubbleT -= dt;
                }
            }
            if (d.cop) { d.cop.t += dt; d.cop.lineT -= dt; d.cop.slide = Math.min(1, d.cop.slide + dt * 1.6); }
        }
    }

    // Coin combo — grab coins in quick succession to build a multiplier. The
    // window resets if you go too long without a pickup. Drives a popup + a
    // small HUD meter and escalating score/coin bonuses.
    var coinCombo = 0;        // current consecutive-pickup count
    var coinComboT = 0;       // >0 while the combo window is open
    var coinComboFx = 0;      // >0 briefly after a pickup (pop animation)

    // Close-call chain — stringing near-misses together builds a score
    // multiplier (up to ×3). One hit and it's gone: risk IS the reward.
    var nearChain = 0;        // consecutive close-call count
    var nearChainT = 0;       // seconds left to extend the chain
    // Personal-best race — crossing the old high score mid-run is an EVENT.
    var recordBannerT = 0;    // "NEW RECORD" banner timer
    var pbWarned = false;     // fired the "almost there" heads-up this run
    var pbBroken = false;     // already celebrated this run

    // Grant a few seconds of collision immunity when re-entering the driving
    // world from a sub-scene (parking / Avigail / salon / tablet), so the player
    // isn't instantly hit by an obstacle that was already on top of the car.
    // Also recenters the car and clears any obstacle currently overlapping it.
    var REENTRY_IMMUNITY = 3.0; // seconds
    var HONK_REACT = ["Okay okay!", "Geez!", "Rude!", "I'm MOVING!", "Alright!!", "Easy!", "Pushy!"];
    // A honk scares nearby road users out of the way by chance — and the chance
    // climbs with the honk chain (lean on the horn → more move). Animals bolt
    // faster and sometimes turn back around.
    function honkScare() {
        var chance = Math.min(0.16 + honkChain * 0.10, 0.9);
        for (var i = 0; i < obstacles.length; i++) {
            var o = obstacles[i];
            if (o.y > player.y + 40 || Math.abs(o.y - player.y) > 230) continue; // ahead & near
            if (Math.random() > chance) continue;
            if (o.type === "car" && !o.mal && (!o.behavior || o.behavior === "normal")) {
                o.dodged = true; o.dodgeDir = o.x <= player.x ? -1 : 1;
                questAdd("honks10", 1);   // weekly quest: honk-scare a car
                if (Math.random() < 0.4) { o.comment = randPick(HONK_REACT); o.commentT = 1.3; }
            } else if (o.type === "ped") {
                o.vx = (o.x <= player.x ? -1 : 1) * rand(85, 150); // scurry off the road
                o.waving = 0.6;
            }
        }
        for (var a = 0; a < animals.length; a++) {
            var an = animals[a];
            if (Math.abs(an.y - player.y) > 240) continue;
            if (Math.random() > chance) continue;
            an.vx *= 1.9;                                  // bolt faster
            if (Math.random() < 0.4) an.vx = -an.vx;       // sometimes turn back around
        }
    }

    function returnToDriving() {
        state = "playing";
        invincibleTimer = Math.max(invincibleTimer, REENTRY_IMMUNITY);
        if (player) { player.targetX = LANES[1]; player.x = LANES[1]; }
        // Resuming the road after a sub-scene (jail / court / hospital / parking /
        // salon / Avigail): clear TRANSIENT state so it can't leak across the trip
        // — a chase, a stale combo/honk-chain inflating score, a hitchhiker frozen
        // on the shoulder, leftover screen effects, or a mid-interaction buff.
        // (Score, coins, lives, and the player's vehicle persist — it's the SAME run.)
        // BUT never resume driving with 0 hearts: a fatal crash can route to the ER
        // (entered at lives 0); if she then escapes/gets released back to the road,
        // she'd be drivable-but-dead and die on the next tap. Floor at 1.
        lives = Math.max(lives, 1);
        // The steamroller now SURVIVES a chase it caused: if there's diesel left,
        // she rolls right back out of the pull-over in it. It only truly ends when
        // the diesel runs dry, or when she's pulled out of the vehicle entirely —
        // arrested / hospitalized / on foot (those clear it at their own entry points).
        if (playerVehicle === "dozer" && dozerTimer <= 0) playerVehicle = null;
        copChase = null; copBust = null; copStop = null;
        // Fugitive hazards (K9s / missiles) spawned during the chase/bust window must
        // not survive back onto the road — otherwise a frozen, off-screen dog or
        // missile ambushes her the instant she's back in control. They re-spawn on
        // their own cadence if she's still hot. Also zero the recognition meter so
        // re-entering the car doesn't instantly re-trigger a chase from a stale value.
        if (typeof copK9s !== "undefined") { copK9s = []; copMissiles = []; copK9T = 0; copMslT = 0; }
        if (typeof fugitiveSpot !== "undefined") fugitiveSpot = 0;
        // Fresh back on the road — bailed out, broke out, or let off at a stop. Give a
        // REAL breather before any cop (speed trap / APB / wanted/fugitive recognition)
        // can re-pounce, and zero the recognition meters + delay the next call-in.
        // Otherwise a still-wanted Lulu gets re-chased the instant she's back, on loop.
        postEscapeGrace = Math.max(postEscapeGrace, 6);
        wantedSpot = 0;
        spontaneousChaseCool = Math.max(spontaneousChaseCool, 8);
        if (typeof wantedPatrolT !== "undefined") wantedPatrolT = Math.max(wantedPatrolT, 5);
        hitchhiker = null;
        coinCombo = 0; coinComboT = 0; coinComboFx = 0;
        honkChain = 0; honkChainResetTimer = 0;
        nitroTimer = 0; wetTimer = 0; slowMoT = 0; hitStopT = 0; crashFlash = 0; shakeTimer = 0;
        sasquatchPassenger = 0;
        passengers = []; passengerTimer = 0;
        avigailInCar = false; pointMult = 1;
        crashReprieve = false; reprieveKind = null;
        // Sweep away anything sitting right where the car will be, so the grace
        // window starts clean instead of with a pile-up at the player's feet.
        if (typeof obstacles !== "undefined" && obstacles && player) {
            for (var i = obstacles.length - 1; i >= 0; i--) {
                if (Math.abs(obstacles[i].y - player.y) < 160) obstacles.splice(i, 1);
            }
        }
    }

    // Begin the smooth pull-over: pick the nearer shoulder and coast to it.
    function startParkExit() {
        parkExit = { t: 0, dur: 1.15, side: player.x < W / 2 ? -1 : 1 };
        slowDriveT = 0; exitBtnShown = false;
        invincibleTimer = Math.max(invincibleTimer, 2.0);
        spawnFloater(player.x, player.y - 40, "🅿️ pulling over…", "#CE93D8");
        playTone(440, 0.12, "sine", 0.1, 320);
    }
    // The pull-over coast finished — she's rolled onto the shoulder, so drop
    // her into the CASUAL parking minigame to actually tuck the car in. The
    // pull-over flag routes the after-park beat (walk out → foot world).
    function dropToFoot(side) {
        parkExit = null; slowDriveT = 0; exitBtnShown = false;
        parkingChallengeMode = false;
        parkingReturnFoot = false;
        parkingFromPullover = true;   // → walk-out → startFootWorld("droveOff")
        triggerParkingMinigame();     // parks the CURRENT vehicle (playerVehicle preserved)
    }

    var HITCH_LINES = ["Bubbe's, please! 🙏", "You're a MENSCH!", "Thanks, doll!", "I owe you a kugel!",
        "FINALLY someone stopped!", "To the wedding — STEP ON IT!", "Gut Shabbos, lifesaver!"];
    function drawHitchhiker(h) {
        ctx.save();
        ctx.translate(h.x, h.y);
        var bob = Math.abs(Math.sin(h.walkTime * 3)) * 2;
        // little "BUBBE'S?" sign held up
        ctx.fillStyle = "#FFF8E1"; roundRect(-3, -34 - bob, 22, 12, 2); ctx.fill();
        ctx.strokeStyle = "#5D4037"; ctx.lineWidth = 1; ctx.strokeRect(-3, -34 - bob, 22, 12);
        drawText("BUBBE'S?", 8, -28 - bob, "bold 6px Arial", "#C62828", null, 0);
        // body
        ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0, 16, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#455A64"; roundRect(-5, 2, 4, 14, 2); ctx.fill(); roundRect(1, 2, 4, 14, 2); ctx.fill();
        ctx.fillStyle = "#00897B"; roundRect(-8, -8, 16, 14, 5); ctx.fill();
        // outstretched thumb arm (toward the road)
        var toward = h.side < 0 ? 1 : -1;
        ctx.strokeStyle = "#00897B"; ctx.lineWidth = 4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(toward * 14, -10 - bob); ctx.stroke();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(toward * 14, -10 - bob, 3, 0, Math.PI * 2); ctx.fill();
        ctx.lineCap = "butt";
        // head
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(0, -14, 7.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -14, 6.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3E2723"; ctx.beginPath(); ctx.arc(0, -17, 7, Math.PI, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // Garage stats: look up a driving-feel multiplier for the car Lulu is
    // ACTUALLY driving. They apply only to her OWN car (playerVehicle === null);
    // borrowed rides / the steamroller / commandeered cop-cars keep their own
    // feel, so return a neutral 1 for anything that isn't her car.
    function luluStat(k) {
        if (typeof playerVehicle !== "undefined" && playerVehicle && playerVehicle !== "car") return 1;
        var sk = SKINS[save.selectedSkin]; return (sk && sk[k]) || 1;
    }

    function updatePlaying(dt) {
        // Lulu on foot reuses this whole real-world simulation (so NOTHING is
        // missing) — only the player-car bits below are branched on `onFoot`.
        var onFoot = (state === "footRun");
        if (onFoot && footIntroT > 0) { footIntroT -= dt; updateParticles(dt); footWalkTime += dt * 1.3; return; }
        if (onFoot && footArrestT > 0) { updateFootArrest(dt); return; }
        // Walking never changes the DRIVING score — it has its own coins/stars.
        // Snapshot here, restore at the end, so nothing this frame inflates it.
        var footScore0 = onFoot ? score : 0;

        gameTime += dt;
        // Garage stats bend HER car's pace: acc quickens the speed ramp, top
        // raises the ceiling (capped by MAX_SPEED * top). luluStat() is a no-op
        // (returns 1) on foot / in a borrowed ride, so those feel unchanged.
        var baseGameSpeed = onFoot ? FOOT_WALK_SPEED : Math.min(BASE_SPEED + gameTime * SPEED_RAMP * luluStat("acc"), MAX_SPEED * luluStat("top"));
        // Speed control: up = run, down = slow (on foot the LEFT buttons).
        var speedMod = 1;
        if (keys.up) speedMod = onFoot ? 2.0 : 1.6 * (0.9 + 0.1 * luluStat("acc"));
        else if (keys.down) speedMod = onFoot ? 0.4 : Math.max(0.3, 0.5 / luluStat("brake"));
        // Splashed a puddle → brief slowdown (nitro below can still override it).
        if (wetTimer > 0) { wetTimer = Math.max(0, wetTimer - dt); speedMod = Math.min(speedMod, 0.6); }
        // Nitro (from gas-station fuel cans): turbo speed, shielded, and you plow
        // through traffic for bonus points. (Driving only.)
        if (nitroTimer > 0 && !onFoot) {
            nitroTimer = Math.max(0, nitroTimer - dt);
            speedMod = Math.max(speedMod, 2.0);
            invincibleTimer = Math.max(invincibleTimer, 0.2);
            score += baseGameSpeed * dt * 0.06;
        }
        // Bad weather slows EVERYONE down — fog, snow, rain, and storms all
        // make the whole road drive more carefully (eases in with the season).
        var badWeather = (season === "fog" || season === "winter" ||
                          season === "rain" || season === "storm");
        var weatherSlow = badWeather ? 1 - 0.13 * seasonBlend : 1;
        gameSpeed = baseGameSpeed * speedMod * weatherSlow;
        // The steamroller is a TANK but a slug — hard-cap its top speed (which is
        // exactly why a chase in one is so dangerous: you can't pull away).
        if (playerVehicle === "dozer") gameSpeed = Math.min(gameSpeed, DOZER_SPEED);
        // A borrowed ride handles like itself: a sports car is quicker, a box truck
        // or city bus is a slug (harder to pull away in a chase).
        else if (playerVehicle === "borrowed" && typeof borrowedCar !== "undefined" && borrowedCar) gameSpeed *= vehicleSpeedFactor(borrowedCar.carType);
        // Driving a big borrowed rig (box truck / city bus / pickup) = a bigger target
        // in the car-vs-car collision below (she's a bus, she gets hit like one).
        var rideHitScale = 1;
        if (playerVehicle === "borrowed" && typeof borrowedCar !== "undefined" && borrowedCar) {
            var _bt = borrowedCar.carType;
            rideHitScale = _bt === 8 ? 1.30 : _bt === 4 ? 1.22 : _bt === 3 ? 1.10 : 1;
        }
        // Coasting to a stop as she pulls over to step out.
        if (parkExit) gameSpeed *= clamp(1 - parkExit.t / parkExit.dur, 0, 1);
        // On foot, walking up to a parked car: the world coasts to a halt so she
        // visibly STOPS at it before the hotwire (then stays stopped through it).
        if (onFoot && typeof footApproach !== "undefined" && footApproach) gameSpeed *= clamp(1 - footApproach.t / 0.4, 0, 1);
        if (onFoot && typeof footHotwire !== "undefined" && footHotwire) gameSpeed = 0;
        // Stolen LEMON: a flat tire keeps tugging her aside; a shot engine sputters
        // (brief speed cuts) and trails smoke. Lasts until she's in another ride.
        if (!onFoot && carMalfunction) {
            carMalfunction.t += dt;
            if (carMalfunction.type === "engine") {
                carMalfunction.sput = (carMalfunction.sput || 0) - dt;
                if (carMalfunction.sput <= 0) { carMalfunction.sput = rand(1.3, 2.6); carMalfunction.sputT = 0.45; playTone(rand(80, 130), 0.1, "sawtooth", 0.06); }
                if (carMalfunction.sputT > 0) { carMalfunction.sputT -= dt; gameSpeed *= 0.42; }
                if (Math.random() < 0.3) particles.push({ x: player.x + rand(-7, 7), y: player.y - CAR_H / 2, vx: rand(-12, 12), vy: rand(-30, -12), life: 0, maxLife: 0.8, size: rand(3, 6), color: randPick(["#9E9E9E", "#616161", "#424242"]), gravity: -10 });
            } else {   // flat tire → constant pull to one side + a shudder
                player.targetX = clamp(player.targetX + carMalfunction.drift * 36 * dt, ROAD_L + CAR_W / 2 + 4, ROAD_R - CAR_W / 2 - 4);
            }
        }
        scrollOffset += gameSpeed * dt;
        // THE JOURNEY: advance the named-stop tour (drive + foot). Layer on top —
        // it can flip state to "arrival" but never touches the sim underneath.
        if (typeof updateJourney === "function") updateJourney(dt);
        // On-foot distance feeds the "Stretch Those Legs" quest — accumulate and
        // flush to the (persisting) week total ~1×/sec, never per frame.
        if (onFoot) {
            footQuestAccum += gameSpeed * dt; footQuestT += dt;
            if (footQuestT >= 1) { questAdd("footDist", Math.floor(footQuestAccum)); footQuestAccum -= Math.floor(footQuestAccum); footQuestT = 0; }
        }
        // "Liquid courage" from the bar: while it lasts and she's actually
        // DRIVING, she's shielded and rakes in double points (tipsy-but-fearless).
        if (!onFoot && courageT > 0) {
            courageT = Math.max(0, courageT - dt);
            invincibleTimer = Math.max(invincibleTimer, 0.25);
            if (courageT <= 0) spawnFloater(player.x, player.y - 40, "🍺 courage wore off", "#CE93D8");
        }
        var closeCallMult = (!onFoot && nearChainT > 0) ? 1 + 0.25 * Math.min(nearChain, 8) : 1;
        var scoreMult = (distractedMode && !onFoot ? 2 : 1) * pointMult * (courageT > 0 && !onFoot ? 2 : 1) * closeCallMult;
        var coinMult = (passengerTimer > 0 ? 2 : 1) * pointMult;
        // Walking doesn't rack up DRIVING score (foot has its own coins/stars) —
        // otherwise the invisible foot stretch silently inflates the score.
        if (!onFoot) score += gameSpeed * dt * 0.08 * scoreMult;

        // Close-call chain window ticks down; letting it lapse drops the chain.
        if (nearChainT > 0) { nearChainT -= dt; if (nearChainT <= 0) nearChain = 0; }
        if (recordBannerT > 0) recordBannerT -= dt;
        // ── Personal-best race: beating your old high score IS an event —
        //    confetti + banner the moment you cross it, a nudge at 90%. ──
        if (!onFoot && save.highScore > 400) {
            if (!pbBroken && score > save.highScore) {
                pbBroken = true; recordBannerT = 3.0;
                for (var cf = 0; cf < 36; cf++) {
                    particles.push({ x: rand(ROAD_L, ROAD_R), y: rand(-20, H * 0.35),
                        vx: rand(-45, 45), vy: rand(60, 170), life: 0, maxLife: rand(0.9, 1.7),
                        size: rand(3, 6), color: randPick(["#FFD700", "#FF80AB", "#80D8FF", "#A5D6A7", "#FFAB91"]),
                        gravity: 50 });
                }
                playTone(523, 0.12, "triangle", 0.16, 660);
                setTimeout(function () { playTone(784, 0.16, "triangle", 0.16, 1046); }, 140);
            } else if (!pbWarned && !pbBroken && score > save.highScore * 0.9) {
                pbWarned = true;
                spawnFloater(player.x, player.y - 64, "🏁 90% of your best — keep going!", "#FFD54F");
                playTone(587, 0.1, "sine", 0.12, 740);
            }
        }

        // Steering — on foot she walks the FULL width (road + sidewalks).
        var steerInput = getSteer(player.x);
        if (distractedMode && !onFoot) steerInput = -steerInput;
        // While hotwiring a car she stands STILL (so she isn't wandering into traffic).
        if (onFoot && typeof footHotwire !== "undefined" && footHotwire) { steerInput = 0; player.targetX = player.x; }
        // Walking up to a car → auto-steer toward it and stop right alongside.
        else if (onFoot && typeof footApproach !== "undefined" && footApproach) { steerInput = 0; player.targetX = clamp(footApproach.car.x, 22, W - 22); }
        var steerSpeed = onFoot ? 360 : 300;
        player.targetX += steerInput * steerSpeed * dt;
        player.targetX = clamp(player.targetX, onFoot ? 22 : ROAD_L + CAR_W / 2 + 4, onFoot ? W - 22 : ROAD_R - CAR_W / 2 - 4);
        player.x = lerp(player.x, player.targetX, Math.min(1, (onFoot ? 12 : 10 * luluStat("grip")) * dt));
        player.tilt = onFoot ? 0 : lerp(player.tilt, steerInput * 0.08, Math.min(1, 8 * dt));

        // ── Steamroller: tick its diesel; keep the pancaked-wreck wake rolling.
        //    (You can't grab one off the road anymore — they're commandeered on
        //    FOOT now, and seen driven in construction zones.) ──
        if (!onFoot) {
            if (playerVehicle === "dozer") { dozerTimer -= dt; if (dozerTimer <= 0) endDozer(); }
            updateFlatWrecks(dt);
            // A steamroller trundles by — often in construction zones, rarely else.
            if (state === "playing") {
                dozerNpcCool -= dt;
                if (dozerNpcCool <= 0) {
                    var inConstruction = (typeof zone !== "undefined" && zone === "construction");
                    if (inConstruction && Math.random() < 0.5) { spawnDozerNPC(); dozerNpcCool = rand(7, 13); }
                    else if (!inConstruction && Math.random() < 0.05) { spawnDozerNPC(); dozerNpcCool = rand(45, 85); }
                    else dozerNpcCool = inConstruction ? rand(3, 6) : rand(10, 18);
                }
            }
        }

        // ── Ditch the car → on foot. When she's been crawling for a couple of
        //    seconds (braking or just stuck in slow traffic) an EXIT button appears;
        //    pressing it eases the car to the shoulder and she steps out — smooth,
        //    no cutscene. (Not mid-chase — that'd be a free escape.) ──
        // Only offer the exit when she's already over in a SIDE lane (you pull
        // over from the shoulder side, not the middle of the road).
        var inSideLane = Math.abs(player.x - LANES[1]) > LANE_W * 0.45;
        var canExit = !onFoot && state === "playing" && !copChase && !copBust && !crashReprieve && inSideLane;
        if (parkExit) {
            parkExit.t += dt;
            invincibleTimer = Math.max(invincibleTimer, 0.3);
            keys.up = false; keys.down = true;                 // braking to a stop
            // ease all the way onto the shoulder, leaning into the turn as she pulls in
            player.targetX = parkExit.side < 0 ? ROAD_L + CAR_W / 2 + 2 : ROAD_R - CAR_W / 2 - 2;
            var pinProg = clamp(parkExit.t / parkExit.dur, 0, 1);
            player.tilt = lerp(player.tilt, parkExit.side * 0.14 * (1 - pinProg), Math.min(1, 9 * dt));
            if (parkExit.t >= parkExit.dur) { dropToFoot(parkExit.side); return; }
            exitBtnShown = false;
        } else if (canExit) {
            var goingSlow = keys.down || gameSpeed < BASE_SPEED * 0.82;
            slowDriveT = goingSlow ? slowDriveT + dt : Math.max(0, slowDriveT - dt * 2.5);
            exitBtnShown = slowDriveT > 1.6;
            if (exitQueued) { exitQueued = false; if (exitBtnShown) startParkExit(); }
        } else { slowDriveT = 0; exitBtnShown = false; exitQueued = false; }
        if (onFoot) footWalkTime += dt * (0.5 + speedMod);

        // Timers
        if (invincibleTimer > 0) invincibleTimer -= dt;
        if (shakeTimer > 0) shakeTimer -= dt;
        if (flashTimer > 0) flashTimer -= dt;
        if (passengerTimer > 0) {
            passengerTimer -= dt;
            if (passengerTimer <= 0) {
                passengers = [];
                passengerTimer = 0;
                // Goodbye particles
                for (var pp = 0; pp < 8; pp++) {
                    particles.push({
                        x: player.x + rand(-15, 15), y: player.y + rand(-10, 10),
                        vx: rand(-50, 50), vy: rand(-100, -40),
                        life: 0.6, maxLife: 0.6,
                        size: rand(2, 4), color: "#90A4AE", gravity: 50
                    });
                }
            }
        }

        // Spawn timers
        for (var k in spawnClocks) spawnClocks[k] -= dt;
        var speedFactor = 1 - (baseGameSpeed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED) * 0.4;

        if (spawnClocks.car <= 0) {
            // Heat-wave desert highway: cars are rare, and stretches are empty.
            var desert = (season === "heatwave");
            spawnClocks.car = rand(1.0, 2.2) * speedFactor * (desert ? 3.5 : 1);
            if (!(desert && Math.random() < 0.55)) spawnObstacle("car");
        }
        if (spawnClocks.cone <= 0) { spawnClocks.cone = rand(2.5, 5) * speedFactor; spawnObstacle("cone"); }
        if (spawnClocks.puddle <= 0) { spawnClocks.puddle = rand(4, 8) * speedFactor / SEASONS[season].puddleMul; spawnObstacle("puddle"); }
        // Pedestrians (→ passenger pickup = 30s double-coin bonus). Rarer now
        // so the bonus is occasional, not constant — tune in 01b-spawn-tuning.js.
        if (tickSpawn("pedestrian", dt) && gameTime > 15) spawnObstacle("ped");
        if (spawnClocks.animal <= 0) {
            spawnClocks.animal = rand(8, 14);
            if (gameTime > 45 && Math.random() < 0.15) spawnDuckParade();
            else spawnAnimal();
        }
        if (spawnClocks.coin <= 0) {
            spawnClocks.coin = rand(0.6, 1.4);
            if (Math.random() > 0.75) spawnCoinLine(); else spawnCoin();
        }
        // Rare extra-life heart (rarity in 01b-spawn-tuning.js)
        if (tickSpawn("heart", dt) && gameTime > 10) spawnHeart();
        // Heshy's pool easter egg — skip if one's already out or Heshy's mid-cameo
        if (tickSpawn("heshyPool", dt) && gameTime > 12 && !heshy) {
            var poolOnScreen = false;
            for (var pq = 0; pq < obstacles.length; pq++) if (obstacles[pq].type === "pool") poolOnScreen = true;
            if (!poolOnScreen) spawnObstacle("pool");
        }
        // Heshy cameo timer
        if (heshy) { heshy.t += dt; if (heshy.t >= heshy.dur) heshy = null; }
        // Avigail out DRIVING — her purple coupe shares the road: a taunt as you
        // pass (+1 💜, grudging respect), or — delicious — pulled over on a rural
        // shoulder getting a ticket of her own (+2 💜 for witnessing it).
        if (tickSpawn("avigailCar", dt) && gameTime > 15) {
            var aviOut = false;
            for (var aq = 0; aq < obstacles.length; aq++) if (obstacles[aq].behavior === "avigail") aviOut = true;
            if (!aviOut) {
                if (zone === "rural" && Math.random() < 0.3) {
                    var aLeft = Math.random() < 0.5;
                    roadsideVeh.push({ x: aLeft ? rand(26, Math.max(28, ROAD_L - 28)) : rand(ROAD_R + 28, W - 26),
                        y: -140, side: aLeft ? -1 : 1, story: "pulled", avigail: true,
                        color: "#7E57C2", carType: 6, rot: (aLeft ? 1 : -1) * rand(-0.06, 0.06), copSiren: 0, peeT: 0 });
                } else {
                    var aHb = carHitbox(6);
                    obstacles.push({ type: "car", x: LANES[randInt(0, 2)], y: -110, color: "#7E57C2", carType: 6,
                        hitW: aHb.hw, hitH: aHb.hh, speedMult: rand(0.5, 0.66), lane: randInt(0, 2),
                        behavior: "avigail", swerveT: 0, spillT: 0 });
                }
            }
        }
        // Hidden roadside speed-trap cops (rarity in 01b-spawn-tuning.js)
        if (tickSpawn("copHide", dt) && gameTime > 15 && !copChase && roadCops.length < 2) spawnRoadCop();
        updateCops(dt);

        // Roadside encounter events — rarity + randomized order live in
        // 01b-spawn-tuning.js (SPAWN_CONFIG). tickSpawn() handles timing + odds.
        // Parking is now a BUILDING she enters ON FOOT (a foot-world door), not a
        // road sign — so nothing spawns on the main road here anymore.
        // Ice cream sign
        if (tickSpawn("iceCream", dt) && iceCreamSigns.length === 0 && gameTime > 30) {
            spawnIceCreamSign();
        }
        // Avigail walking on the roadside (only if not already with you)
        if (tickSpawn("avigail", dt) && !avigailWalker && !avigailInCar && gameTime > 18) {
            // walks in a lane, scrolls down slower than traffic so Lulu can reach her
            avigailWalker = { x: LANES[randInt(0, 2)], y: -60, walkTime: 0, hitW: 22, hitH: 26 };
        }
        if (avigailWalker) {
            avigailWalker.y += gameSpeed * 0.55 * dt;
            avigailWalker.walkTime += dt;
            if (avigailWalker.y > H + 60) { avigailWalker = null; }
            else if (aabb(player.x, player.y, onFoot ? 40 : CAR_W, onFoot ? 44 : CAR_H, avigailWalker.x, avigailWalker.y, avigailWalker.hitW, avigailWalker.hitH)) {
                if (onFoot) { footAvigailMeet(avigailWalker); avigailWalker = null; return; }
                else { avigailWalker = null; startAvigailScene(); return; }
            }
        }
        // 👨 Uncle sighting — a rare roadside cameo that ROTATES through the three
        // uncles (Yedidya → Burry → Shuey). Modeled on Heshy's proximity drive-by,
        // NOT Avigail's lane collision, so it can never cause a crash. He stands on
        // the GRASS SHOULDER (off the drivable road). Works on foot too.
        if (tickSpawn("uncle", dt) && !uncleWalker && gameTime > 15) {
            var uSide = Math.random() < 0.5 ? -1 : 1;
            var uX = uSide < 0 ? rand(28, Math.max(32, ROAD_L - 30)) : rand(ROAD_R + 30, W - 28);
            uncleWalker = { id: UNCLES[uncleRotil].id, x: uX, y: -70, walkTime: 0, greeted: false };
            uncleRotil = (uncleRotil + 1) % 3;
        }
        if (uncleWalker) {
            uncleWalker.y += gameSpeed * 0.6 * dt;   // a touch slower than traffic — Lulu passes him
            uncleWalker.walkTime += dt;
            if (uncleWalker.y > H + 80) {
                uncleWalker = null;   // scrolled past ungreeted → just cull, no penalty
            } else if (!uncleWalker.greeted && Math.abs(uncleWalker.y - player.y) < 70) {
                uncleWalker.greeted = true;
                questAdd("uncles3", 1);   // weekly quest: greet an uncle
                var uData = null;
                for (var uu = 0; uu < UNCLES.length; uu++) {
                    if (UNCLES[uu].id === uncleWalker.id) { uData = UNCLES[uu]; break; }
                }
                if (uData) {
                    // Quips are full sentences — render them screen-centered
                    // (subtitle style) at his height so no line ever clips off
                    // the edge when he's on the shoulder.
                    spawnFloater(W / 2, uncleWalker.y - 44, randPick(uData.quips), uData.color);
                    runCoins += 8; save.totalCoins += 8; persistSave();   // small friendly tip
                    spawnFloater(player.x, player.y - 40, "👋 +8 💰", "#FFD700");
                    spawnCoinSparkle(uncleWalker.x, uncleWalker.y);
                    if (typeof playCoin === "function") playCoin();
                    if (typeof playTone === "function") playTone(660, 0.12, "sine", 0.2, 880);
                }
            }
        }
        // The SALON is now a BUILDING she enters ON FOOT (a foot-world door), not a
        // road sign — handled in the foot world, so nothing spawns on the road here.
        // Decorative parked vehicles on the grass shoulder (each with a "story").
        if (!onFoot) updateRoadsideVeh(dt);
        // Roadside HITCHHIKER (driving activity): a thumber on the shoulder you
        // can honk at to pick up for a coin bonus + a 2× "passenger" window.
        if (!onFoot) {
            hitchTimer -= dt;
            if (!hitchhiker && hitchTimer <= 0 && gameTime > 20) {
                hitchTimer = rand(28, 60);
                var hside = Math.random() < 0.5 ? -1 : 1;
                hitchhiker = { x: hside < 0 ? ROAD_L - 18 : ROAD_R + 18, y: -70, walkTime: 0, side: hside };
            }
        }
        if (hitchhiker) {
            hitchhiker.y += gameSpeed * dt;
            hitchhiker.walkTime += dt;
            if (hitchhiker.y > H + 70) hitchhiker = null;
        }
        // Sasquatch easter egg
        if (tickSpawn("sasquatch", dt) && !sasquatch && gameTime > 35) {
            spawnSasquatch();
        }
        // Billboards
        billboardTimer -= dt;
        if (billboardTimer <= 0) {
            billboardTimer = rand(8, 18);
            spawnBillboard();
        }
        // Ima's text messages — random buzz with phone icon
        imaTextTimer -= dt;
        if (imaTextTimer <= 0 && !imaText && gameTime > 25) {
            imaTextTimer = rand(45, 90);
            // mix of Ima, her sister Tammy, and (rarer) her ex-bff Esti
            var rt = Math.random();
            if (rt < 0.25) {
                imaText = { msg: randPick(ESTI_TEXTS), t: 0, dur: 4.5, sender: "esti" };
            } else if (rt < 0.55) {
                imaText = { msg: randPick(TAMMY_TEXTS), t: 0, dur: 4.0, sender: "tammy" };
            } else {
                imaText = { msg: randPick(IMA_TEXTS), t: 0, dur: 4.0, sender: "ima" };
            }
            // Phone buzz sound
            playTone(180, 0.06, "square", 0.12);
            setTimeout(function () { playTone(180, 0.06, "square", 0.12); }, 100);
            setTimeout(function () { playTone(180, 0.06, "square", 0.12); }, 200);
        }
        if (imaText) {
            imaText.t += dt;
            if (imaText.t > imaText.dur) imaText = null;
        }

        // Missile firing
        if (consumeMissile()) fireMissile();
        // Pepper spray (clears an animal off the road, or drops a person)
        if (consumePepper()) firePepperSpray();
        if (pepperBeam) { pepperBeam.t -= dt; if (pepperBeam.t <= 0) pepperBeam = null; }

        // Ambient car-on-car fender benders + their roadside drama.
        tickCarCrashes(dt);
        updateRoadDramas(dt);

        // Special-vehicle action button (cop → pull over, ambulance → rescue,
        // bus → stop sign).
        if (vehicleHasAction() && consumeSiren()) doVehicleAction();
        // School bus: roadside kids appear and the deployed STOP sign times out.
        if (playerVehicle === "bus") {
            busKidTimer -= dt;
            if (busKidTimer <= 0) { busKidTimer = rand(4, 8); spawnSchoolKid(); }
        }
        if (busStopT > 0) busStopT -= dt;

        // Escaped-convict heat: WANTED posters + cops recognizing her.
        if (!onFoot && prisonClothes) { updateFugitive(dt); if (state !== "playing") return; }
        if (!onFoot && typeof updateCopHazards === "function") { updateCopHazards(dt); if (state !== "playing") return; }
        // Honk Symphony — pitched by chain count
        if (consumeHonk() && honkCooldown <= 0) {
            honkChain = Math.min(honkChain + 1, 7);
            honkChainResetTimer = 1.5;
            // Notes of a C-major scale: each successive honk = next note up
            var notes = [262, 294, 330, 349, 392, 440, 494, 523];
            playHonkPitched(notes[honkChain - 1]);
            honkCooldown = 0.32;
            // Show "+chain" floater on big chains
            if (honkChain >= 4) spawnFloater(player.x, player.y - 40, "♪ " + honkChain + "x!", "#FFEB3B");
            honkScare();
            // Honk near a hitchhiker → they hop in for a bonus + a 2× window.
            if (hitchhiker && Math.abs(player.x - hitchhiker.x) < 110 && hitchhiker.y > 60 && hitchhiker.y < H - 60) {
                runCoins += 15; save.totalCoins += 15; persistSave();
                passengerTimer = Math.max(passengerTimer, 30);
                spawnFloater(hitchhiker.x, hitchhiker.y - 30, randPick(HITCH_LINES), "#7CFC4F");
                spawnFloater(player.x, player.y - 62, "🚗 +15 💰  2× coins!", "#FFD700");
                playCoin(); spawnCoinSparkle(hitchhiker.x, hitchhiker.y);
                hitchhiker = null;
            }
        }
        honkChainResetTimer -= dt;
        if (honkChainResetTimer <= 0) honkChain = 0;

        // Pause check
        if (consumePause()) {
            prevState = onFoot ? "footRun" : "playing";
            state = "paused";
            playClick();
            return;
        }

        // Click on the HUD buttons (mouse fallback — touch path already routes via
        // hitGameButton). On foot only pause + pepper apply.
        if (!onFoot) {
            var click = consumeClick();
            if (click) {
                if (pointInRect(click.x, click.y, PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, PAUSE_RECT.h)) {
                    prevState = "playing"; state = "paused"; playClick(); return;
                } else if (pointInRect(click.x, click.y, MISSILE_RECT.x, MISSILE_RECT.y, MISSILE_RECT.w, MISSILE_RECT.h)) {
                    fireMissile();
                } else if (save.pepperSpray > 0 && pointInRect(click.x, click.y, PEPPER_RECT.x, PEPPER_RECT.y, PEPPER_RECT.w, PEPPER_RECT.h)) {
                    firePepperSpray();
                } else if (vehicleHasAction() && pointInRect(click.x, click.y, COP_RECT.x, COP_RECT.y, COP_RECT.w, COP_RECT.h)) {
                    doVehicleAction();
                }
            }
        } else {
            var fclick = consumeClick();
            if (fclick) {
                if (pointInRect(fclick.x, fclick.y, PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, PAUSE_RECT.h)) {
                    prevState = "footRun"; state = "paused"; playClick(); return;
                } else if (save.pepperSpray > 0 && pointInRect(fclick.x, fclick.y, PEPPER_RECT.x, PEPPER_RECT.y, PEPPER_RECT.w, PEPPER_RECT.h)) {
                    firePepperSpray();
                }
            }
        }

        // Find an active ambulance so traffic can pull aside for it.
        var ambulance = null;
        for (var ax = 0; ax < obstacles.length; ax++) {
            if (obstacles[ax].behavior === "ambulance") { ambulance = obstacles[ax]; break; }
        }

        // Update obstacles
        for (var i = obstacles.length - 1; i >= 0; i--) {
            var o = obstacles[i];
            // Cars obeying the bus's STOP sign hold their ground (scroll with the
            // road) until the sign retracts.
            var effSpeed = o.speedMult;
            if (o.stopT > 0) { o.stopT -= dt; effSpeed = 1.0; }
            o.y += gameSpeed * effSpeed * dt;
            if (o.walkTime !== undefined) o.walkTime += dt;
            if (o.vx) { // parade runners cross the road horizontally
                o.x += o.vx * dt;
                if (o.x < -45 || o.x > W + 45) { obstacles.splice(i, 1); continue; }
            }
            if (o.y > H + 100) { obstacles.splice(i, 1); continue; }

            if (o.commentT > 0) o.commentT -= dt; // speech-bubble lifetime

            // ── Traffic MALFUNCTION — a rare afflicted normal car acts up. It
            //    NEVER targets the player (normal collision rules apply); driving
            //    only (foot mode leaves traffic behaving plainly). ──
            if (o.type === "car" && o.mal && !o.crashed && o.behavior === "normal" && !onFoot) {
                o.malT = (o.malT || 0) + dt;
                if (o.mal === "breakdown") {
                    // Eases to a near-stop in-lane over ~2s; hazards + hood smoke.
                    o.speedMult = lerp(o.speedMult, 0.08, Math.min(1, dt * 1.4));
                    if (!o.malSaid && o.malT > 0.4) { o.malSaid = true; o.comment = "Not now, NOT NOW!"; o.commentT = 2.6; }
                    o.smokeT = (o.smokeT || 0) - dt;
                    if (o.smokeT <= 0 && o.y > -20 && o.y < H) {
                        o.smokeT = rand(0.22, 0.45);
                        particles.push({ x: o.x + rand(-6, 6), y: o.y - (o.hitH || 64) / 2,
                            vx: rand(-10, 10), vy: rand(-34, -14), life: 0, maxLife: rand(0.7, 1.2),
                            size: rand(4, 8), color: randPick(["#9E9E9E", "#757575", "#616161"]), gravity: -10, smoke: true });
                    }
                } else if (o.mal === "flat") {
                    // Limps at ~0.35, sways, and veers toward the nearest shoulder.
                    o.speedMult = lerp(o.speedMult, 0.35, Math.min(1, dt * 1.2));
                    if (!o.malSaid && o.malT > 0.3) { o.malSaid = true; o.comment = "thump thump thump…"; o.commentT = 2.6; }
                    var shoulderX = (o.x < W / 2) ? (ROAD_L + 14) : (ROAD_R - 14);
                    o.x = lerp(o.x, shoulderX, Math.min(1, dt * 0.5)) + Math.sin(o.malT * 6) * 16 * dt;
                    // Fully off the road edge → becomes a parked "malfunction" veh.
                    if (o.x <= ROAD_L + 6 || o.x >= ROAD_R - 6) {
                        var flatLeft = o.x < W / 2;
                        roadsideVeh.push({ x: flatLeft ? Math.max(26, ROAD_L - 20) : Math.min(W - 26, ROAD_R + 20),
                            y: o.y, side: flatLeft ? -1 : 1, story: "malfunction",
                            color: o.color, carType: o.carType,
                            rot: (flatLeft ? 1 : -1) * rand(-0.05, 0.05), copSiren: 0, peeT: 0 });
                        obstacles.splice(i, 1);
                        continue;
                    }
                } else if (o.mal === "rage") {
                    // Speeds up (never faster than a drunk), honks, tailgates.
                    o.speedMult = Math.min(1.25, o.speedMult + dt * 0.4);
                    if (o.malHonkT === undefined) o.malHonkT = rand(0.8, 1.8);
                    o.malHonkT -= dt;
                    if (o.malHonkT <= 0) {
                        o.malHonkT = rand(1.4, 3.0);
                        if (Math.abs(o.y - player.y) < 320 && o.y > -20 && o.y < H && typeof playHonk === "function") playHonk();
                        if (o.commentT <= 0) { o.comment = randPick(RAGE_QUIPS); o.commentT = 1.8; }
                    }
                    // TAILGATE: close on the nearest car ahead in its lane.
                    var ahead = null, aheadD = 1e9;
                    for (var ri = 0; ri < obstacles.length; ri++) {
                        var ro = obstacles[ri];
                        if (ro === o || ro.type !== "car" || ro.crashed) continue;
                        if (Math.abs(ro.x - o.x) > CAR_W) continue;       // same lane-ish
                        var rgd = o.y - ro.y;                             // ahead = smaller y
                        if (rgd > 0 && rgd < 140 && rgd < aheadD) { aheadD = rgd; ahead = ro; }
                    }
                    if (ahead) {
                        if (aheadD > 60) o.speedMult = Math.min(1.25, (ahead.speedMult || 0.5) + 0.45);
                        else o.speedMult = Math.min(o.speedMult, ahead.speedMult || 0.5);   // tuck in + match
                        // Occasional abrupt, signal-less lane change to get around.
                        if (!o.changing && o.lane !== undefined && Math.random() < dt * 0.5) {
                            var rdirs = [];
                            if (o.lane > 0) rdirs.push(-1);
                            if (o.lane < 2) rdirs.push(1);
                            if (rdirs.length) { o.lane += randPick(rdirs); o.laneTargetX = LANES[o.lane]; o.changing = "move"; }
                        }
                    }
                    // Drive the cut-over (the polite block is skipped for mal cars).
                    if (o.changing === "move") {
                        o.x = lerp(o.x, o.laneTargetX, Math.min(1, 4.5 * dt));
                        if (Math.abs(o.x - o.laneTargetX) < 2) { o.x = o.laneTargetX; o.changing = null; }
                    }
                }
            }

            // Drunk bar patrons holler at Lulu often; rowdy workers, rarely.
            // Fire while they're anywhere on screen (not just dead-center) so a
            // patron that's about to scroll off still gets a line out.
            if (o.type === "ped" && (o.drunk || o.worker) && !o.sprayed && o.y > -10 && o.y < H + 10) {
                o.catcallT -= dt;
                if (o.catcallT <= 0 && o.commentT <= 0) {
                    var callChance = o.drunk ? 0.85 : 0.06; // workers only now and then
                    if (Math.random() < callChance) {
                        o.comment = randPick(BAR_CATCALLS); o.commentT = 2.6; // long enough to read
                    }
                    // Drunks retry quickly so a missed roll doesn't go silent for long.
                    o.catcallT = o.drunk ? rand(0.8, 1.8) : rand(1.6, 3.4);
                }
            }

            // Traffic parts for the ambulance: nearby cars veer to the shoulder.
            if (ambulance && o !== ambulance && o.type === "car" && !o.crashed && Math.abs(o.y - ambulance.y) < 150) {
                var away = o.x < ambulance.x ? -1 : 1;
                o.x = clamp(o.x + away * 80 * dt, ROAD_L + 20, ROAD_R - 20);
            }
            // ...and for LULU when she's driving a siren vehicle (cop/ambulance):
            // cars ahead and around her pull aside to let her through.
            if ((playerVehicle === "cop" || playerVehicle === "ambulance") &&
                o.type === "car" && !o.crashed && Math.abs(o.y - player.y) < 165) {
                var pAway = o.x < player.x ? -1 : 1;
                o.x = clamp(o.x + pAway * 90 * dt, ROAD_L + 20, ROAD_R - 20);
            }

            // Heshy's pool sits in a FRONT YARD off the shoulder now — cruising
            // past it (any lane) is enough to catch his eye. He stays lounging.
            if (o.type === "pool" && o.yard && !o.heshyed && Math.abs(o.y - player.y) < 60) {
                o.heshyed = true;
                triggerHeshy();
            }

            // Passing Avigail's coupe → the obligatory taunt exchange. Sharing the
            // road (without trading paint) slowly thaws the rivalry: +1 💜.
            if (o.behavior === "avigail" && !o.taunted && Math.abs(o.y - player.y) < 130) {
                o.taunted = true;
                o.comment = randPick(AVIGAIL_ROAD_TAUNTS); o.commentT = 2.4;
                spawnFloater(player.x, player.y - 30, randPick(LULU_ROAD_REPLIES), "#F48FB1");
                if (typeof bumpAvigailRel === "function") bumpAvigailRel(1);
                questAdd("avigail3", 1);   // weekly quest: share the road with Avigail
            }

            // Regular drivers occasionally (by chance) swerve aside when Lulu gets
            // right up on them — a polite (or panicked) dodge. Malfunctioning cars
            // are excluded (they run their own erratic behavior above).
            if (o.type === "car" && !o.crashed && !o.mal && (!o.behavior || o.behavior === "normal")) {
                if (!o.dodgeChecked && Math.abs(o.y - player.y) < 130 && Math.abs(o.x - player.x) < CAR_W * 1.1) {
                    o.dodgeChecked = true;
                    if (Math.random() < 0.32) {
                        o.dodged = true; o.dodgeDir = o.x <= player.x ? -1 : 1;
                        if (Math.random() < 0.5) { o.comment = randPick(DODGE_QUIPS); o.commentT = 1.4; }
                    }
                }
                if (o.dodged) o.x = clamp(o.x + o.dodgeDir * 110 * dt, ROAD_L + 20, ROAD_R - 20);

                // Rare, polite lane change — signals first (amber blinker), THEN
                // eases across. Only well ahead of Lulu so it reads as ambient
                // traffic, not a swerve into her.
                if (!o.dodged && !o.changing && o.lane !== undefined &&
                    o.y > 40 && o.y < player.y - 80 && Math.random() < dt * 0.05) {
                    var dirs = [];
                    if (o.lane > 0) dirs.push(-1);
                    if (o.lane < 2) dirs.push(1);
                    if (dirs.length) {
                        o.signalDir = randPick(dirs);
                        o.lane += o.signalDir;
                        o.laneTargetX = LANES[o.lane];
                        o.signalT = rand(0.7, 1.1);   // blink before moving
                        o.changing = "signal";
                    }
                }
                if (o.changing === "signal") {
                    o.signalT -= dt;
                    if (o.signalT <= 0) o.changing = "move";
                } else if (o.changing === "move") {
                    o.x = lerp(o.x, o.laneTargetX, Math.min(1, 3.5 * dt));
                    if (Math.abs(o.x - o.laneTargetX) < 2) { o.x = o.laneTargetX; o.changing = null; }
                }
            }

            // Drunk drivers weave hard across lanes (and spill booze); texting
            // drivers drift gently. Both make the lane gaps unsafe.
            if (o.type === "car" && o.crashed) {
                // wrecked — no AI, just scroll with the road (handled above)
            } else if (o.type === "car" && o.behavior === "drunk") {
                o.swerveT += dt;
                o.x = clamp(o.x + Math.sin(o.swerveT * 2.6) * 95 * dt, ROAD_L + 22, ROAD_R - 22);
                o.spillT -= dt;
                if (o.spillT <= 0) { o.spillT = rand(0.25, 0.6); spawnAlcoholDrop(o.x, o.y); }
                // frequent drunken outbursts (lots of options)
                if (o.commentT <= 0 && Math.random() < dt * 0.38) { o.comment = randPick(DRUNK_QUIPS); o.commentT = 2.2; }
            } else if (o.type === "car" && o.behavior === "bus") {
                if (o.commentT <= 0 && Math.abs(o.y - player.y) < 150 && Math.random() < dt * 0.4) {
                    o.comment = randPick(BUS_QUIPS); o.commentT = 2.0;
                }
            } else if (o.type === "car" && o.behavior === "patrol") {
                // AGGRESSIVE hunter units (3★+ / K9) actively steer toward her lane
                // and ride faster — a real driving threat, not just scenery.
                if (o.aggro && prisonClothes) {
                    o.x = clamp(lerp(o.x, player.x, Math.min(1, 1.5 * dt)), ROAD_L + 18, ROAD_R - 18);
                    o.speedMult = Math.max(o.speedMult, 1.45);
                }
                if (o.k9) {   // the dog barks when it's closing in
                    o.barkT = (o.barkT || 0) - dt;
                    if (o.barkT <= 0 && Math.abs(o.y - player.y) < 220) { o.barkT = rand(0.7, 1.4); if (typeof playDogBark === "function") playDogBark(); }
                }
                // Cruises normally, but busts you if you speed in its view.
                // (On foot keys.up is RUN, not speeding — never a violation.)
                var patSpeeding = !onFoot && (keys.up || gameSpeed > 520);
                if (patSpeeding && !copChase && !copBust && Math.abs(o.y - player.y) < 175) {
                    o.spot = (o.spot || 0) + dt;
                    if (o.spot > 0.7) { beginCopChase(o.x, o.k9 ? "🐕 K9 UNIT!" : "🚨 PATROL!", null, "SPEEDING"); obstacles.splice(i, 1); continue; }
                } else { o.spot = Math.max(0, (o.spot || 0) - dt * 1.5); }
            } else if (o.type === "car" && o.behavior === "pulled") {
                // Busted: drift to the shoulder, slow down, and bicker with the cop.
                o.x = clamp(lerp(o.x, o.pullX, Math.min(1, 3 * dt)), ROAD_L + 18, ROAD_R - 18);
                o.speedMult = Math.max(0.4, o.speedMult - dt * 0.8);
                o.copSiren = (o.copSiren || 0) + dt;
                if (o.commentT <= 0 && Math.random() < dt * 0.35) { o.comment = randPick(COP_PULLOVER); o.commentT = 2.4; }
            } else if (o.type === "car" && o.behavior === "texting") {
                o.swerveT += dt;
                o.x = clamp(o.x + Math.sin(o.swerveT * 1.1) * 42 * dt, ROAD_L + 22, ROAD_R - 22);
            }

            if (o.kid) {
                // Waiting school kids are never a collision — they board only via
                // the bus's STOP sign. Just let them scroll past.
            } else if (aabb(player.x, player.y, CAR_W * 0.7 * rideHitScale, CAR_H * 0.7 * rideHitScale, o.x, o.y, o.hitW, o.hitH)) {
                if (o.type === "ped") {
                    if (!onFoot) {
                        var roadWitness = (!copChase && !copBust) ? copInView() : null;
                        var patrolWitness = (!copChase && !copBust && !roadWitness) ? patrolInView() : null;
                        var witness = roadWitness || patrolWitness;
                        // Plowing into someone AT SPEED is a hit-and-run — but she's
                        // only booked for it if a COP actually SEES it happen (a
                        // roadside cop OR a patrol car on screen). No cop in view, no
                        // witness, no arrest (she just gives them a lift).
                        // The re-entry shield protects her from this.
                        var reckless = (keys.up || gameSpeed > 520) && invincibleTimer <= 0;
                        if (reckless && witness) {
                            obstacles.splice(i, 1);
                            if (typeof beginArrest === "function") {
                                beginArrest(["HIT AND RUN", "RECKLESS ENDANGERMENT"]);
                                return;
                            }
                        }
                        // Otherwise she just gives them a lift — pick up as passenger.
                        pickUpPassenger(o);
                        // Bonk someone in front of a watching cop → instant chase.
                        // A roadside cop converts into the chaser; a patrol car just
                        // lights up from where it is (no obstacle-array splice here,
                        // so the ped index below stays valid).
                        if (roadWitness) startCopChase(roadWitness, "RECKLESS ENDANGERMENT");
                        else if (patrolWitness) beginCopChase(patrolWitness.x, "🚨 BUSTED!", null, "RECKLESS ENDANGERMENT");
                        obstacles.splice(i, 1);
                    }
                    continue; // on foot she just walks among them (talk via the hand button)
                }
                if (o.type === "pool") {
                    // Easter egg — never a penalty. Summon Heshy + grant a shield.
                    triggerHeshy();
                    obstacles.splice(i, 1);
                    continue;
                }
                if (o.type === "puddle") {
                    // Just a wet splash that slows you for a beat — never a crash.
                    if (!o.splashed) { o.splashed = true; wetTimer = Math.max(wetTimer, 0.7); spawnSplash(o.x, player.y); }
                    continue;
                }
                // Steamroller FLATTENS any car it touches (she's unharmed) and just
                // rolls over cones / debris.
                if (playerVehicle === "dozer") {
                    if (o.type === "car") crushCar(o);
                    else spawnCrashBurst(o.x, o.y, false);
                    obstacles.splice(i, 1);
                    continue;
                }
                // Nitro turbo plows through traffic for bonus points.
                if (nitroTimer > 0 && o.type === "car") {
                    spawnCrashBurst(o.x, o.y, false); playExplosion();
                    score += 30 * scoreMult;
                    obstacles.splice(i, 1);
                    continue;
                }
                if (invincibleTimer <= 0) hitPlayer(o);
            } else if (o.type === "car" && !o.nearMissed && invincibleTimer <= 0) {
                // ── Near-miss "whoosh" reward: barely dodge an enemy car ──
                // Trigger once per car, when it's roughly alongside us but not touching.
                var dyNM = Math.abs(o.y - player.y);
                var dxNM = Math.abs(o.x - player.x);
                if (dyNM < CAR_H * 0.55 && dxNM > (CAR_W + o.hitW) * 0.5 && dxNM < CAR_W * 1.05) {
                    o.nearMissed = true;
                    // Chain it: each close call inside the window is worth more
                    // and pushes the 🔥 score multiplier higher (capped ×3).
                    nearChain++; nearChainT = 6;
                    questBest("chain6", nearChain);   // weekly quest: 6-chain daredevil
                    score += (15 + 5 * Math.min(nearChain - 1, 8)) * scoreMult;
                    spawnFloater((o.x + player.x) / 2, player.y - 8,
                        nearChain >= 2 ? "WHOOSH! 🔥×" + nearChain : "WHOOSH!", "#80D8FF");
                    // small spark line in the gap between the two cars
                    var sside = o.x < player.x ? -1 : 1;
                    for (var nm = 0; nm < 5; nm++) {
                        particles.push({
                            x: player.x + sside * (CAR_W * 0.5) + rand(-3, 3),
                            y: player.y + rand(-CAR_H * 0.3, CAR_H * 0.3),
                            vx: sside * rand(20, 60), vy: rand(120, 200),
                            life: 0.3, maxLife: 0.3,
                            size: rand(1.5, 3), color: "#B3E5FC", gravity: 0
                        });
                    }
                    // Pitch climbs with the chain — you can HEAR the streak build.
                    playTone(720 + Math.min(nearChain, 8) * 55, 0.05, "sine", 0.06, 1100 + Math.min(nearChain, 8) * 55);
                    // The buzzed driver reacts by chance: a honk or a rude remark.
                    if (!o.behavior || o.behavior === "normal") {
                        var reactRoll = Math.random();
                        if (reactRoll < 0.30) { playHonk(); o.comment = "BEEP! BEEP!"; o.commentT = 1.5; }
                        else if (reactRoll < 0.55) { o.comment = randPick(RUDE_QUIPS); o.commentT = 2.0; }
                    }
                }
            }
        }

        // Update missiles
        for (var mi = missiles.length - 1; mi >= 0; mi--) {
            var m = missiles[mi];
            m.y -= 700 * dt;
            m.time += dt;
            if (m.y < -40) { missiles.splice(mi, 1); continue; }
            // collision with obstacles (cars, pedestrians)
            for (var oi = obstacles.length - 1; oi >= 0; oi--) {
                var ob = obstacles[oi];
                if (ob.type !== "car" && ob.type !== "ped") continue;
                if (aabb(m.x, m.y, m.hitW, m.hitH, ob.x, ob.y, ob.hitW, ob.hitH)) {
                    spawnCrashBurst(ob.x, ob.y, true);
                    playExplosion();
                    if (ob.type === "car") questAdd("missiles8", 1);   // weekly quest: missile a car
                    obstacles.splice(oi, 1);
                    missiles.splice(mi, 1);
                    score += 50;
                    break;
                }
            }
        }

        // Update coins
        for (var j = coinEntities.length - 1; j >= 0; j--) {
            var c = coinEntities[j];
            c.y += gameSpeed * dt;
            if (c.y > H + 50) { coinEntities.splice(j, 1); continue; }
            // ── Coin magnet: gentle pull toward the car when it's close ──
            var mdx = player.x - c.x, mdy = player.y - c.y;
            var mdist = Math.sqrt(mdx * mdx + mdy * mdy);
            if (mdist < 70 && mdist > 1) {
                var pull = (1 - mdist / 70) * 240 * dt;
                c.x += (mdx / mdist) * pull;
                c.y += (mdy / mdist) * pull;
            }
            if (!c.collected && aabb(player.x, player.y, CAR_W, CAR_H * 0.8, c.x, c.y, c.hitW, c.hitH)) {
                c.collected = true;
                // Build the combo: another coin within the window bumps it,
                // otherwise it restarts at 1.
                coinCombo = (coinComboT > 0) ? coinCombo + 1 : 1;
                coinComboT = 1.5;
                coinComboFx = 0.3;
                // Multiplier ramps every 3 coins: x1 (1-2), x2 (3-5), x3 (6-8)... up to x5.
                var comboMult = Math.min(1 + Math.floor((coinCombo - 1) / 3), 5);
                var gained = coinMult * comboMult;
                runCoins += gained;
                save.totalCoins += gained;
                persistSave();
                score += 100 * scoreMult * gained;
                spawnCoinSparkle(c.x, c.y);
                if (comboMult > 1) {
                    // Hotter color the higher the multiplier.
                    var hot = comboMult >= 4 ? "#FF5252" : comboMult >= 3 ? "#FF9800" : "#FFD54F";
                    spawnFloater(c.x, c.y, "+" + gained + "  x" + comboMult + "!", hot);
                    if (coinCombo % 3 === 0) playStarSparkle();   // milestone ding
                } else {
                    spawnFloater(c.x, c.y, "+" + gained, "#FFD700");
                }
                // little pop ring that scales up and fades
                coinPops.push({ x: c.x, y: c.y, t: 0 });
                if (coinPops.length > 12) coinPops.shift();
                // …and the coin itself ARCS up to the HUD counter (classic juice):
                // 1-2 mini coins on slightly different bezier paths + timing.
                for (var cf = 0; cf < Math.min(2, gained); cf++) {
                    coinFlys.push({ sx: c.x, sy: c.y, cx: c.x + rand(-50, 50), cy: c.y - rand(60, 110),
                                    t: -cf * 0.07, dur: 0.38 });
                }
                if (coinFlys.length > 10) coinFlys.shift();
                playCoin();
                coinEntities.splice(j, 1);
            }
        }
        // Age coin-pickup pops
        for (var cp = coinPops.length - 1; cp >= 0; cp--) {
            coinPops[cp].t += dt;
            if (coinPops[cp].t > 0.35) coinPops.splice(cp, 1);
        }
        // Advance the HUD-bound flying coins; pulse the counter as each lands.
        for (var cfj = coinFlys.length - 1; cfj >= 0; cfj--) {
            coinFlys[cfj].t += dt;
            if (coinFlys[cfj].t >= coinFlys[cfj].dur) { coinFlys.splice(cfj, 1); coinHudPulse = 0.28; }
        }
        if (coinHudPulse > 0) coinHudPulse -= dt;
        // Decay the combo window; when it lapses the streak resets.
        if (coinComboT > 0) { coinComboT -= dt; if (coinComboT <= 0) coinCombo = 0; }
        if (coinComboFx > 0) coinComboFx -= dt;

        // Update heart pickups (rare extra life)
        for (var hj = heartEntities.length - 1; hj >= 0; hj--) {
            var he = heartEntities[hj];
            he.y += gameSpeed * dt;
            he.bob += dt;
            if (he.y > H + 50) { heartEntities.splice(hj, 1); continue; }
            if (!he.collected && aabb(player.x, player.y, CAR_W, CAR_H * 0.8, he.x, he.y, he.hitW, he.hitH)) {
                he.collected = true;
                // Lives can now climb past the starting 3 (capped at 9 so the
                // HUD stays sane).
                lives = Math.min(lives + 1, 9);
                spawnFloater(he.x, he.y, "+1 ♥", "#FF4081");
                spawnCoinSparkle(he.x, he.y);
                playTone(880, 0.1, "sine", 0.18, 1320);
                setTimeout(function () { playTone(1320, 0.1, "sine", 0.16, 1760); }, 80);
                heartEntities.splice(hj, 1);
            }
        }

        // Update fuel cans (nitro pickups)
        for (var fj = fuelCans.length - 1; fj >= 0; fj--) {
            var fc = fuelCans[fj];
            fc.y += gameSpeed * dt;
            fc.bob += dt;
            if (fc.y > H + 50) { fuelCans.splice(fj, 1); continue; }
            if (!onFoot && !fc.collected && aabb(player.x, player.y, CAR_W, CAR_H * 0.8, fc.x, fc.y, fc.hitW, fc.hitH)) {
                fc.collected = true;
                nitroTimer = Math.min(nitroTimer + 3.5, 9);
                spawnFloater(fc.x, fc.y, "NITRO! 🔥", "#FF7043");
                spawnCoinSparkle(fc.x, fc.y);
                playTone(300, 0.18, "sawtooth", 0.16, 900);
                fuelCans.splice(fj, 1);
            }
        }

        // Update animals
        for (var kk = animals.length - 1; kk >= 0; kk--) {
            var a = animals[kk];
            a.y += gameSpeed * 0.5 * dt;
            a.x += a.vx * dt;
            a.walkTime += dt;
            if (a.y > H + 80 || a.x < -50 || a.x > W + 50) { animals.splice(kk, 1); continue; }
            if (invincibleTimer <= 0 &&
                aabb(player.x, player.y, CAR_W * 0.7, CAR_H * 0.6, a.x, a.y, a.hitW, a.hitH)) {
                hitPlayer(a);
                animals.splice(kk, 1);
            }
        }

        // Dust particles at speed
        dustTimer -= dt;
        if (gameSpeed > 300 && dustTimer <= 0) {
            dustTimer = 0.06;
            particles.push({
                x: player.x + rand(-8, 8),
                y: player.y + CAR_H / 2 + 5,
                vx: rand(-15, 15), vy: rand(20, 50),
                life: 0.3, maxLife: 0.3,
                size: rand(2, 4), color: "#9E9E9E", gravity: 0
            });
        }

        // Parking signs scroll + collision
        for (var ps = parkingSigns.length - 1; ps >= 0; ps--) {
            var psi = parkingSigns[ps];
            psi.y += gameSpeed * dt;
            psi.bob += dt;
            if (psi.y > H + 60) { parkingSigns.splice(ps, 1); continue; }
            if (aabb(player.x, player.y, onFoot ? 40 : CAR_W, onFoot ? 44 : CAR_H * 0.8, psi.x, psi.y, psi.hitW, psi.hitH)) {
                parkingSigns.splice(ps, 1);
                if (onFoot) { footParkingGag(); }
                else { triggerParkingMinigame(); return; }
            }
        }
        // Ice cream signs (roadside; only collected if Lulu is at the edge)
        for (var ic = iceCreamSigns.length - 1; ic >= 0; ic--) {
            var ici = iceCreamSigns[ic];
            ici.y += gameSpeed * dt;
            ici.bob += dt;
            if (ici.y > H + 60) { iceCreamSigns.splice(ic, 1); continue; }
            if (aabb(player.x, player.y, CAR_W, CAR_H, ici.x, ici.y, ici.hitW, ici.hitH)) {
                iceCreamSigns.splice(ic, 1);
                // Quick bonus
                runCoins += 5;
                save.totalCoins += 5;
                persistSave();
                playCoin();
                parkingMsg = "🍦 ICE CREAM! +5";
                parkingMsgTimer = 2;
                kidsInCar = true; // celebrate!
                spawnCoinSparkle(ici.x, ici.y);
            }
        }
        // Sasquatch update — now interactive: honk near him to pick him up!
        if (sasquatch) {
            sasquatch.timer += dt;
            sasquatch.walkTime += dt;
            sasquatch.y += gameSpeed * 0.4 * dt;
            if (sasquatch.phase === 0 && sasquatch.timer > 0.8) {
                sasquatch.phase = 1; sasquatch.timer = 0;
            }
            else if (sasquatch.phase === 1 && sasquatch.timer > 3.5) {
                if (!sasquatch.waved) {
                    runCoins += 10;
                    save.totalCoins += 10;
                    persistSave();
                    parkingMsg = "🦍 SASQUATCH! +10";
                    parkingMsgTimer = 2;
                    sasquatch.waved = true;
                }
                sasquatch.phase = 2; sasquatch.timer = 0;
            }
            else if (sasquatch.phase === 2 && (sasquatch.timer > 1.5 || sasquatch.y > H + 40)) {
                sasquatch = null;
            }
            // Check honk pickup: if player honked while sasquatch is in wave-phase + on screen
            if (sasquatch && sasquatch.phase === 1 && honkChain > 0 && honkChainResetTimer > 1.3 &&
                sasquatch.y > 0 && sasquatch.y < H) {
                sasquatchPassenger = 20; // 20 sec in car
                runCoins += 25;
                save.totalCoins += 25;
                persistSave();
                parkingMsg = "🦍 HITCHHIKER! +25";
                parkingMsgTimer = 2.5;
                spawnFloater(sasquatch.x, sasquatch.y, "♥", "#FF80AB");
                sasquatch = null;
            }
        }
        // Sasquatch passenger timer (decrements while in car)
        if (sasquatchPassenger > 0) {
            sasquatchPassenger -= dt;
            if (sasquatchPassenger <= 0) {
                parkingMsg = "🐟 Sasquatch left you a fish!";
                parkingMsgTimer = 2.5;
                runCoins += 50; // parting gift
                save.totalCoins += 50;
                persistSave();
            }
        }
        // Billboard scroll
        for (var bb = billboards.length - 1; bb >= 0; bb--) {
            billboards[bb].y += gameSpeed * billboards[bb].parallax * dt;
            if (billboards[bb].y > H + 60) billboards.splice(bb, 1);
        }
        // Message timer
        if (parkingMsgTimer > 0) parkingMsgTimer -= dt;
        // Honk cooldown
        if (honkCooldown > 0) honkCooldown -= dt;

        updateDecorations(dt, gameSpeed);
        updateParticles(dt);
        updateSeason(dt, gameSpeed);
        updateZone(dt, gameSpeed);
        // Zone-specific extra traffic
        if (zone === "police" && !copChase && !copBust && roadCops.length < 4 && Math.random() < dt * 1.1) {
            spawnRoadCop();
        }
        if (zone === "school" && gameTime > 5 && Math.random() < dt * 0.9) {
            spawnObstacle("ped"); // kids crossing
        }
        if (zone === "construction" && Math.random() < dt * 1.6) {
            spawnObstacle("cone"); // cone gauntlet
        }
        if (zone === "construction" && gameTime > 8 && Math.random() < dt * 0.5) {
            spawnObstacle("ped"); // road workers (drawn with hard hats; act like peds)
        }
        if (zone === "bars" && gameTime > 5 && Math.random() < dt * 1.1) {
            spawnObstacle("ped"); // tipsy patrons spilling out of the bars (a rowdy crowd)
        }
        if (zone === "hospital" && gameTime > 5 && Math.random() < dt * 0.5) {
            var hasAmb = false;
            for (var ha = 0; ha < obstacles.length; ha++) if (obstacles[ha].behavior === "ambulance") hasAmb = true;
            if (!hasAmb) spawnAmbulance();
        }
        if (zone === "gas" && fuelCans.length < 2 && Math.random() < dt * 0.7) {
            spawnFuel(); // grab one for a nitro turbo
        }

        // Toll booth gauntlet — navigate to an OPEN lane (closed gates crash you)
        if (!tollBooth && tickSpawn("toll", dt) && gameTime > 25) spawnTollBooth();
        if (tollBooth) {
            tollBooth.y += gameSpeed * dt;
            if (tollBooth.y > H + 90) { tollBooth = null; }
            else {
                for (var tlx = 0; tlx < 3; tlx++) {
                    if (tollBooth.open.indexOf(tlx) !== -1) continue;
                    if (invincibleTimer <= 0 &&
                        aabb(player.x, player.y, CAR_W * 0.7, CAR_H * 0.5, LANES[tlx], tollBooth.y, 64, 16)) {
                        hitPlayer({ x: LANES[tlx], y: tollBooth.y });
                        tollBooth.open.push(tlx); // smash through so it doesn't re-hit
                    }
                }
                if (tollBooth && !tollBooth.paid && tollBooth.y > player.y - 8) {
                    tollBooth.paid = true;
                    questAdd("tolls4", 1);   // weekly quest: pass a toll booth
                    score += 60 * scoreMult;
                    spawnFloater(player.x, player.y - 40, "🎫 TOLL!", "#FFD54F");
                    playCoin();
                }
            }
        }

        // Railroad crossing — a train sweeps across the road; brake to let it pass.
        if (!trainCrossing && tickSpawn("train", dt) && gameTime > 30) spawnTrainCrossing();
        if (trainCrossing) {
            var tc = trainCrossing;
            tc.y += gameSpeed * dt;
            tc.warnPhase += dt;
            if (!tc.started && tc.y > -30) {
                tc.started = true;
                parkingMsg = "🚂 TRAIN! Steer to a clear lane (or brake)";
                parkingMsgTimer = 2.2;
                playTone(660, 0.12, "square", 0.1);
                setTimeout(function () { playTone(660, 0.12, "square", 0.1); }, 260);
            }
            var trainW = tc.cars * 60;
            if (tc.started && !tc.gone) tc.trainX += tc.dir * 410 * dt;
            tc.gone = tc.dir > 0 ? (tc.trainX - trainW / 2 > W + 12) : (tc.trainX + trainW / 2 < -12);
            // Only the train BODY hurts — the road it has already crossed is clear,
            // so you steer into the trailing gap (braking buys time too).
            if (tc.started && !tc.gone && invincibleTimer <= 0 &&
                aabb(player.x, player.y, CAR_W * 0.6, CAR_H * 0.5, tc.trainX, tc.y, trainW - 8, 40)) {
                hitPlayer({ x: player.x, y: tc.y });
            }
            if (tc.y > H + 120) trainCrossing = null;
        }

        // Drive-thru — clip the order window on the correct shoulder for coins.
        if (!driveThru && tickSpawn("driveThru", dt) && gameTime > 20) spawnDriveThru();
        if (driveThru) {
            driveThru.y += gameSpeed * dt;
            var dtWinX = driveThru.side < 0 ? ROAD_L + 26 : ROAD_R - 26;
            if (!driveThru.taken &&
                aabb(player.x, player.y, CAR_W, CAR_H, dtWinX, driveThru.y, 40, 60)) {
                driveThru.taken = true;
                var meal = randInt(20, 45);
                runCoins += meal; save.totalCoins += meal; persistSave();
                score += meal * 4;
                spawnFloater(player.x, player.y - 30, "🍔 +" + meal, "#FFD54F");
                spawnCoinSparkle(dtWinX, driveThru.y);
                playBuy();
            }
            if (driveThru.y > H + 90) driveThru = null;
        }

        // Parade / marathon — a crowd streams across the road for a few seconds.
        if (paradeTimer <= 0 && tickSpawn("parade", dt) && gameTime > 30) {
            paradeTimer = rand(4.5, 7);
            parkingMsg = "🎉 PARADE! Mind the crowd!"; parkingMsgTimer = 2.5;
        }
        if (paradeTimer > 0) {
            paradeTimer -= dt;
            if (Math.random() < dt * 9) spawnParadeRunner();
        }

        // Parked school bus dropping kids — you must SLOW (brake) to pass legally.
        if (!busStop && gameTime > 25 && Math.random() < dt * (zone === "school" ? 0.10 : 0.012)) spawnBusStop();
        if (busStop) {
            busStop.y += gameSpeed * dt;
            if (busStop.commentT > 0) busStop.commentT -= dt;
            var bbx = ROAD_R - 24;
            if (invincibleTimer <= 0 && aabb(player.x, player.y, CAR_W * 0.7, CAR_H * 0.6, bbx, busStop.y, 40, 90)) {
                hitPlayer({ x: bbx, y: busStop.y });
            }
            // Scoop up Dina if she's at this stop (drive through her spot).
            if (busStop.hasDina && !busStop.dinaTaken) {
                var dinaX = ROAD_R - 88;
                if (aabb(player.x, player.y, CAR_W, CAR_H * 0.8, dinaX, busStop.y, 26, 32)) {
                    busStop.dinaTaken = true;
                    var dinaBonus = 60;
                    runCoins += dinaBonus; save.totalCoins += dinaBonus; persistSave();
                    score += 300 * scoreMult;
                    spawnFloater(player.x, player.y - 40, "👧 Got Dina! +" + dinaBonus, "#FFD54F");
                    spawnCoinSparkle(dinaX, busStop.y);
                    playBuy();
                }
            }
            if (!busStop.checked && busStop.y > player.y - 6) {
                busStop.checked = true;
                var slowEnough = keys.down || gameSpeed < baseGameSpeed * 0.72;
                if (busStop.signOut && !slowEnough) {
                    busStop.violated = true;
                    busStop.comment = randPick(BUS_STOP_QUIPS); busStop.commentT = 2.4;
                    var watcher = copInView();
                    if (!watcher) {
                        for (var bp = 0; bp < obstacles.length; bp++) {
                            if (obstacles[bp].behavior === "patrol") { watcher = obstacles[bp]; break; }
                        }
                    }
                    if (watcher && !copChase && !copBust && !onFoot) {
                        beginCopChase(watcher.x, "🚨 BUS SIGN!", null, "PASSING A STOPPED SCHOOL BUS");
                        spawnFloater(player.x, player.y - 72, randPick(COP_BUS_SNARK), "#FFD54F");
                    }
                } else if (busStop.signOut) {
                    score += 40 * scoreMult;
                    spawnFloater(player.x, player.y - 30, "🛑 Safe stop!", "#7CFC4F");
                }
            }
            if (busStop.y > H + 130) busStop = null;
        }

        // Crossing guard halting traffic for kids — slow down (brake) to pass.
        if (!crossingGuard && gameTime > 25 && Math.random() < dt * (zone === "school" ? 0.09 : 0.011)) spawnCrossingGuard();
        if (crossingGuard) {
            var cg = crossingGuard;
            cg.y += gameSpeed * dt;
            if (cg.commentT > 0) cg.commentT -= dt;
            // People are never a "lose a life" collision (that's confusing —
            // bonking pedestrians elsewhere is a GOOD thing). The only stakes at
            // a crossing are the speeding violation below.
            if (!cg.checked && cg.y > player.y - 6) {
                cg.checked = true;
                var slowG = keys.down || gameSpeed < baseGameSpeed * 0.72;
                if (!slowG) {
                    cg.comment = randPick(GUARD_QUIPS); cg.commentT = 2.4;
                    var gw = copInView();
                    if (!gw) { for (var gp = 0; gp < obstacles.length; gp++) { if (obstacles[gp].behavior === "patrol") { gw = obstacles[gp]; break; } } }
                    if (gw && !copChase && !copBust && !onFoot) {
                        beginCopChase(gw.x, "🚨 CROSSING!", null, "BLOWING PAST A CROSSING GUARD");
                        spawnFloater(player.x, player.y - 72, randPick(COP_BUS_SNARK), "#FFD54F");
                    }
                } else {
                    score += 40 * scoreMult;
                    spawnFloater(player.x, player.y - 30, "🛑 Thanks, driver!", "#7CFC4F");
                }
            }
            if (cg.y > H + 120) crossingGuard = null;
        }

        // Ice-cream truck — sweeter in summer/heatwave, near schools & markets.
        if (!iceTruck && gameTime > 18 &&
            Math.random() < dt * ((zone === "school" || zone === "market") ? 0.05 : 0.012) *
                            ((season === "summer" || season === "heatwave") ? 1.6 : 1)) {
            spawnIceTruck();
        }
        if (iceTruck) {
            iceTruck.y += gameSpeed * dt;
            iceTruck.noteT += dt;
            var itX = iceTruck.side < 0 ? ROAD_L + 26 : ROAD_R - 26;
            if (!iceTruck.taken && aabb(player.x, player.y, CAR_W, CAR_H, itX, iceTruck.y, 40, 60)) {
                iceTruck.taken = true;
                var scoop = randInt(12, 25);
                runCoins += scoop; save.totalCoins += scoop; persistSave();
                score += scoop * 4;
                spawnFloater(player.x, player.y - 30, "🍦 +" + scoop, "#F8BBD0");
                spawnCoinSparkle(itX, iceTruck.y);
                playBuy();
            }
            if (iceTruck.y > H + 110) iceTruck = null;
        }

        // School buses — rare on the open road, common in the school zone.
        var busN = 0;
        for (var bn = 0; bn < obstacles.length; bn++) if (obstacles[bn].behavior === "bus") busN++;
        if (gameTime > 15 && busN < 1 && convoyTimer <= 0 && Math.random() < dt * (zone === "school" ? 0.22 : 0.02)) {
            spawnSchoolBus();
        }
        // Field-trip convoy: a rare burst of several buses in a row.
        if (convoyTimer <= 0 && busN === 0 && gameTime > 40 && Math.random() < dt * (zone === "school" ? 0.05 : 0.012)) {
            convoyTimer = 6; convoyNext = 0;
            parkingMsg = "🚌 Field-trip convoy!"; parkingMsgTimer = 2.5;
        }
        if (convoyTimer > 0) {
            convoyTimer -= dt; convoyNext -= dt;
            if (convoyNext <= 0 && busN < 4) { convoyNext = rand(0.9, 1.4); spawnSchoolBus(); }
        }

        // Patrol cop cars cruising the road (rare; common in the police zone).
        var patrolN = 0;
        for (var pc = 0; pc < obstacles.length; pc++) if (obstacles[pc].behavior === "patrol") patrolN++;
        if (gameTime > 20 && !copChase && !copBust && patrolN < 1 &&
            Math.random() < dt * (zone === "police" ? 0.18 : 0.03)) {
            spawnPatrolCar();
        }

        // A watching cop pulls over a drunk/texting driver (by chance).
        if (!copChase && !copBust && copInView() && Math.random() < dt * 0.7) {
            for (var pj = 0; pj < obstacles.length; pj++) {
                var po = obstacles[pj];
                if (po.type === "car" && (po.behavior === "drunk" || po.behavior === "texting") &&
                    po.y > 40 && po.y < H - 120) {
                    po.behavior = "pulled";
                    po.pullX = po.x < W / 2 ? ROAD_L + 24 : ROAD_R - 24;
                    po.copSiren = 0;
                    po.comment = randPick(COP_PULLOVER); po.commentT = 2.6;
                    playTone(680, 0.2, "sawtooth", 0.12, 460);
                    setTimeout(function () { playTone(460, 0.2, "sawtooth", 0.12, 680); }, 220);
                    break;
                }
            }
        }

        // On foot: building doors, parked cars to "borrow", and the hand-button
        // interactions (talk / pet / hail / enter / steal) live here.
        if (onFoot) { score = footScore0; updateFootExtras(dt); }
    }

    function hitPlayer(obj) {
        // On foot she's NOT in a car: getting clipped by traffic knocks her
        // down (lose a life); tripping on cones/animals is just a stumble.
        if (state === "footRun") { footKnockout(obj); return; }
        // Any hit torches the close-call chain — that's the deal.
        if (nearChain >= 3) spawnFloater(player.x, player.y - 58, "🔥 chain lost!", "#FF8A80");
        nearChain = 0; nearChainT = 0;
        lives--;
        invincibleTimer = INVINCIBLE_TIME;
        shakeTimer = 0.4;
        shakeIntensity = 6;
        flashTimer = 0.15;
        spawnCrashBurst(obj.x, obj.y, false);
        if (lives <= 0) {
            // BIG crash. What the FINAL hit was decides how the scene plays out.
            var kind = obj && obj.type === "car" ? "car"
                     : (obj && (obj.type === "duck" || obj.type === "raccoon" || obj.type === "ostrich")) ? "animal"
                     : "other";
            crashCause = { kind: kind, color: obj && obj.color, carType: obj && obj.carType, animal: obj && obj.type, behavior: obj && obj.behavior };
            // Trading paint with AVIGAIL is a friendship disaster: -10 💜.
            if (obj && obj.behavior === "avigail" && typeof bumpAvigailRel === "function") bumpAvigailRel(-10);
            // Snapshot the data Hillel will use to adjudicate fault: each driver's
            // speed, who was ahead (= who rear-ended whom), whether they drifted
            // oncoming, and whether Lulu was distracted at the wheel.
            var oMult = (obj && typeof obj.speedMult === "number") ? obj.speedMult : 1;
            crashCause.luluSpeed = Math.round(gameSpeed / 6);                 // ~mph-ish for flavor
            crashCause.otherSpeed = Math.round(Math.abs(gameSpeed * (1 - oMult)) / 6);
            crashCause.oncoming = oMult > 1.05;
            crashCause.otherAhead = !!(obj && obj.y < player.y);
            crashCause.distracted = !!distractedMode;
            crashX = player.x;
            crashY = player.y;
            crashRot = 0;
            crashRotVel = rand(-8, 8);
            crashedCar = null; animalSwarm = []; crashCars = []; crashSmokeT = 0;
            angryMan = null; revengeCar = null;
            if (kind === "car") {
                // The exact vehicle you hit becomes the wreck — bus stays a bus,
                // ambulance an ambulance — sitting right where it was struck.
                var wx = clamp(obj.x, ROAD_L + 24, ROAD_R - 24);
                crashedCar = { x: wx, y: obj.y, rot: rand(0.22, 0.5) * (wx < player.x ? -1 : 1),
                               color: (obj && obj.color) || randPick(C.enemyCols),
                               carType: (obj && obj.carType) || 0,
                               behavior: (obj && obj.behavior) || "normal" };
                obj.hidden = true; // hide the live sprite so the wreck doesn't double up
                spawnCrashBurst(crashedCar.x, crashedCar.y, true);
            }
            // A rare, funny reprieve only when a person (not a swarm) confronts you.
            // Crashing a DRUNK or TEXTING driver is far likelier to let her slip
            // away on foot (they're in no state to chase): 50% vs 20%.
            var sloppy = (kind === "car" && (crashCause.behavior === "drunk" || crashCause.behavior === "texting"));
            crashReprieve = (kind !== "animal") && Math.random() < (sloppy ? 0.50 : 0.20);
            // Car-on-car wrecks can summon Hillel, the (ex-)insurance adjuster, who
            // assesses the damage and sometimes cuts Lulu a check. Otherwise the
            // usual funny outs (a cop nabs the guy, or he gets distracted and bolts).
            reprieveKind = (kind === "car" && Math.random() < 0.4) ? "insurance"
                         : (Math.random() < 0.5 ? "arrest" : "chase");
            spawnCrashBurst(player.x, player.y, true);
            playExplosion();
            setTimeout(playWompWomp, 400);
            crashFlash = 0.4;   // hard white impact flash
            slowMoT = 0.55;     // brief bullet-time on the explosion
            hitStopT = 0.14;    // 2-3 frames of near-freeze + zoom punch FIRST — weight
            state = "crash";
            crashPhase = 0;
            crashPhaseTimer = 1.4; // explosion duration
            shakeTimer = 0.8;
            shakeIntensity = 10;
            if (score > save.highScore) {
                save.highScore = Math.floor(score);
            }
            persistSave();
        } else {
            playWompWomp();
        }
    }

    // ── Speed-trap cops ──────────────────────────────────────
    var COP_YELLS = ["PULL OVER!", "LICENSE AND\nREGISTRATION!", "YOU'RE BUSTED,\nLULU!", "NO SPEEDING\nIN MY TOWN!", "THAT'S A\nTICKET!",
        "PULL IT OVER,\nLEADFOOT!", "PARTY'S OVER,\nBRUCK!", "NICE AND\nSLOW NOW!", "I CLOCKED\nYOU, MISSY!"];
    var COP_PULLOVER = ["License & reg!", "Step out!", "Been DRINKING?!", "It was ONE lechaim!",
        "Define 'drunk'...", "I'm FINE officer!", "Blow into this.", "Eyes on the road!",
        "Where's the FIRE?", "You a race car?", "Slow your TUCHUS!", "Registration. NOW."];
    // Pull-over cutscene scripts — a back-and-forth between the 👮 officer and
    // 💁 Lulu that plays out toward an `outcome`: "free" (she talks her way out),
    // "ticket" (game over), or "walk" (impound → on-foot). Each [who, text] line
    // shows for a beat (tap to advance). Keep lines short — they're bubbles.
    var COP_SCENES = [
        // ── She gets off (bribe / charm / other) ──────────────
        { outcome: "free", title: "LET OFF! 🍀", lines: [
            ["cop", "License and\nregistration."],
            ["lulu", "Officer... warm\nrugelach? 🥧"],
            ["cop", "...is that\ncinnamon?"],
            ["lulu", "Still warm. 😇"],
            ["cop", "*takes two*\nSlow down, kid."] ] },
        { outcome: "free", title: "WHAT TICKET? 💸", lines: [
            ["cop", "Know how fast\nyou were going?"],
            ["lulu", "*slips a $20*\nDo YOU?"],
            ["cop", "...I saw\nnothing."],
            ["lulu", "Pleasure, officer! 😘"] ] },
        { outcome: "free", title: "CHARMED! 💕", lines: [
            ["cop", "Step out of\nthe vehicle."],
            ["lulu", "Anyone say you\nlook like a\nmovie star?"],
            ["cop", "...my wife\nsays that."],
            ["lulu", "She's RIGHT. 💕"],
            ["cop", "Ehh. Warning."] ] },
        { outcome: "free", title: "BUBBE KNOWS HIM! 🍲", lines: [
            ["cop", "Name?"],
            ["lulu", "Bruck. You know\nmy Bubbe?"],
            ["cop", "...Bubbe Bruck?!\nThe CHOLENT?!"],
            ["lulu", "Fridays at six. 🍲"],
            ["cop", "Tell her Moishy\nsays hi. GO!"] ] },
        { outcome: "free", title: "CROCODILE TEARS 😭", lines: [
            ["cop", "That's a big\nticket, ma'am."],
            ["lulu", "*sniffle* It's\nbeen SUCH a day"],
            ["cop", "Oh— no— don't—\nokay, okay—"],
            ["lulu", "*sniff* ...really?"],
            ["cop", "Just GO. Please\nstop crying. 😭"] ] },
        // ── She gets the ticket (game over) ───────────────────
        { outcome: "ticket", title: "BUSTED! 🚨", lines: [
            ["cop", "Know why I\npulled you over?"],
            ["lulu", "The three reds?\nOr the speeding?"],
            ["cop", "...there were\nTHREE?!"],
            ["lulu", "...two. 😬"] ] },
        { outcome: "ticket", title: "BRIBE FAIL! 🚨", lines: [
            ["cop", "License and\nregistration."],
            ["lulu", "*slips a $20*"],
            ["cop", "Is this a\nBRIBE?!"],
            ["lulu", "...a tip? 😬"] ] },
        { outcome: "ticket", title: "SASSED! 🚨", lines: [
            ["cop", "Step out of\nthe vehicle."],
            ["lulu", "I PAY your\nsalary!"],
            ["cop", "And I write\nYOUR tickets."],
            ["lulu", "...fair. 😬"] ] },
        // ── Impounded → she walks (on-foot mode) ──────────────
        { outcome: "walk", title: "IMPOUNDED! 🚧", lines: [
            ["cop", "This reg expired\nin 2019."],
            ["lulu", "It's VINTAGE! 💅"],
            ["cop", "It's getting\nTOWED."],
            ["lulu", "...walking it is. 🚶‍♀️"] ] },
        { outcome: "walk", title: "IMPOUNDED! 🚧", lines: [
            ["cop", "Whose car\nis this?"],
            ["lulu", "Define 'whose'..."],
            ["cop", "TOW it."],
            ["lulu", "Oof. 🚶‍♀️"] ],
        },
        // ── more LET-OFFs ─────────────────────────────────────
        { outcome: "free", title: "COUSIN ESTI?! 💅", lines: [
            ["cop", "Step out, please."],
            ["lulu", "You went to\nEsti's wedding!"],
            ["cop", "...the open bar.\nGreat herring."],
            ["lulu", "Mishpacha! 💕"],
            ["cop", "Ach, GO already."] ] },
        { outcome: "free", title: "RUNNING LATE! ⏰", lines: [
            ["cop", "What's the rush?"],
            ["lulu", "Candle-lighting\nin TEN minutes!"],
            ["cop", "...oh. OH. GO.\nDRIVE SAFE— GO!"],
            ["lulu", "Good Shabbos! 🕯️"] ] },
        { outcome: "free", title: "DASHBOARD DEAL 🍪", lines: [
            ["cop", "This is a\nNO-stopping zone."],
            ["lulu", "Black-and-white\ncookie? Fresh."],
            ["cop", "...is the white\nside bigger?"],
            ["lulu", "For YOU it is. 😇"],
            ["cop", "Move along."] ] },
        // ── more TICKETS ──────────────────────────────────────
        { outcome: "ticket", title: "NO DICE 🚨", lines: [
            ["cop", "Eighty in a\nthirty, Bruck."],
            ["lulu", "I was... rounding\nDOWN?"],
            ["cop", "To EIGHTY?"],
            ["lulu", "...generously. 😬"] ] },
        { outcome: "ticket", title: "TOO MUCH SASS 🚨", lines: [
            ["cop", "Anything to say\nfor yourself?"],
            ["lulu", "Love the hat.\nVery 'mall cop.'"],
            ["cop", "That'll be\nEXTRA."],
            ["lulu", "...worth it. 😬"] ] },
        { outcome: "ticket", title: "PHONE A FRIEND 🚨", lines: [
            ["cop", "Were you TEXTING?"],
            ["lulu", "It was a VOICE\nnote! Totally legal!"],
            ["cop", "It is NOT."],
            ["lulu", "...send. 😬"] ] },
        // ── more IMPOUNDS ─────────────────────────────────────
        { outcome: "walk", title: "IMPOUNDED! 🚧", lines: [
            ["cop", "Plates don't\nmatch the car."],
            ["lulu", "It's a... costume!"],
            ["cop", "For the CAR?"],
            ["lulu", "...walking. 🚶‍♀️"] ] }
    ];

    function spawnRoadCop() {
        var side = Math.random() < 0.5 ? -1 : 1;
        var x = side < 0 ? rand(26, ROAD_L - 24) : rand(ROAD_R + 24, W - 26);
        roadCops.push({ x: x, y: -100, side: side, hide: randPick(["bush", "tree", "billboard"]), spot: 0, busted: false });
    }

    // First on-screen, not-yet-triggered roadside cop (or null).
    function copInView() {
        for (var i = 0; i < roadCops.length; i++) {
            var c = roadCops[i];
            if (!c.busted && c.y > 60 && c.y < H - 40) return c;
        }
        return null;
    }

    // First on-screen patrol CAR (or null) — also counts as a witnessing cop.
    function patrolInView() {
        for (var i = 0; i < obstacles.length; i++) {
            var o = obstacles[i];
            if (o.type === "car" && o.behavior === "patrol" && o.y > 0 && o.y < H) return o;
        }
        return null;
    }

    function updateCops(dt) {
        if (postEscapeGrace > 0) postEscapeGrace -= dt;   // breather after shaking a chase
        // "Speeding" means going faster than the natural flow of traffic — NOT just
        // moving fast. The world speed ramps up over time (cruise climbs toward
        // MAX_SPEED), so a fixed threshold like ">520" wrongly flagged her late-game
        // even while braking. Tie it to the current cruise instead, and NEVER count
        // braking as speeding (the speed trap is meant to be dodgeable by slowing).
        // Mirror the SAME garage-stat factors used to compute HER gameSpeed above,
        // so a genuinely faster car's natural cruise isn't perpetually flagged as
        // "speeding" — the trap stays about flooring it past your own flow.
        var cruiseNow = Math.min(BASE_SPEED + gameTime * SPEED_RAMP * luluStat("acc"), MAX_SPEED * luluStat("top"));
        var speeding = (state !== "footRun") && !keys.down && (keys.up || gameSpeed > cruiseNow * 1.06);
        for (var i = roadCops.length - 1; i >= 0; i--) {
            var cop = roadCops[i];
            cop.y += gameSpeed * dt;
            if (cop.y > H + 100) { roadCops.splice(i, 1); continue; }
            var inView = cop.y > 60 && cop.y < H - 40;
            if (!copChase && !copBust && !cop.busted && inView && speeding && postEscapeGrace <= 0) {
                cop.spot += dt; // a short fuse so you can brake to avoid it
                if (cop.spot >= 0.65) { startCopChase(cop); continue; }
            } else {
                cop.spot = Math.max(0, cop.spot - dt * 1.5);
            }
        }
        // ── Escalating HEAT: the longer & faster the run, the more often a cruiser
        //    "gets the call" and starts a fresh pursuit. Chases pile on at higher
        //    levels (every 30s is a level), even more when she's speeding/distracted. ──
        if (state === "playing" && !copChase && !copBust && !crashReprieve && gameSpeed > 220 && postEscapeGrace <= 0) {
            spontaneousChaseCool -= dt;
            if (spontaneousChaseCool <= 0) {
                var lvl = Math.floor(gameTime / 30);
                if (lvl >= 2) {
                    var fireChance = clamp(0.14 + 0.07 * (lvl - 2), 0, 0.65) * (speeding ? 1.4 : 0.55) * (distractedMode ? 1.35 : 1);
                    if (Math.random() < fireChance) {
                        // Don't accuse her of speeding if she's actually crawling — pick
                        // a speed-themed call only when she's truly fast.
                        var apbMsg = speeding
                            ? randPick(["📻 SPEEDING REPORTED — PURSUE!", "📻 RECKLESS DRIVER — ALL UNITS!", "🚨 APB ON A PINK CAR!"])
                            : randPick(["🚨 APB ON A PINK CAR!", "🚓 SOMEONE CALLED IT IN!", "📻 SHE'S BACK AT IT — GO GO GO!"]);
                        beginCopChase(player.x, apbMsg, null, speeding ? "RECKLESS DRIVING" : "FAILURE TO PULL OVER");
                        spontaneousChaseCool = rand(15, 24) - Math.min(lvl, 7);   // next window (shorter at high levels)
                    } else {
                        spontaneousChaseCool = rand(4, 7);                          // recheck soon
                    }
                } else {
                    spontaneousChaseCool = 6;
                }
            }
        }

        // ── WANTED: with an open file, any cop who gets a look at her gives chase —
        //    and patrols keep trickling in — until a JUDGE clears the case. ──
        if (typeof isWanted === "function" && isWanted() && !prisonClothes && state === "playing" && !copChase && !copBust && postEscapeGrace <= 0) {
            var seenW = copInView();
            if (!seenW) for (var wi = 0; wi < obstacles.length; wi++) {
                var wo = obstacles[wi];
                if (wo.type === "car" && wo.behavior === "patrol" && Math.abs(wo.y - player.y) < 200) { seenW = wo; break; }
            }
            // Driving calmly makes her harder to spot — slowing down should feel safer,
            // not punished. Flooring it past a cop gets her made fast.
            if (seenW) { wantedSpot += dt * (speeding ? 1.2 : 0.55); if (wantedSpot > 0.7) { wantedSpot = 0; beginCopChase(player.x, "🚨 THAT'S HER — WANTED!", (save.wanted || []).slice(0, 3), "OUTSTANDING WARRANT"); } }
            else wantedSpot = Math.max(0, wantedSpot - dt * 0.8);
            wantedPatrolT -= dt;
            if (wantedPatrolT <= 0) { wantedPatrolT = rand(5, 9); if (typeof spawnPatrolCar === "function") spawnPatrolCar(); }
        }

        // A chase never progresses while she's on foot (she's not a car to bust).
        if (copChase && state !== "footRun") updateCopChase(dt);
    }

    // Start a chase from any x with a custom alert (used by roadside cops,
    // patrol cars, and bus-stop violations).
    function beginCopChase(x, msg, charges, reason) {
        // `reason` is a short, plain-language charge ("SPEEDING", "HIT AND RUN",
        // "GRAND THEFT AUTO"…) carried all the way into the pull-over exchange so
        // it always states exactly WHY she's being stopped. Falls back to the
        // charges list, then a generic reckless-driving.
        copChase = { gap: 160, x: x, siren: 0, escapeT: 0, charges: charges || null,
                     reason: reason || (charges && charges.length ? charges[0] : null) };
        // Give her a moment to open a gap before the high-heat hazards start — at
        // 5★ the chase used to fire and a K9/missile could land in the same breath.
        if (typeof copK9T !== "undefined") { copK9T = Math.max(copK9T, 3); copMslT = Math.max(copMslT, 3); }
        shakeTimer = 0.3; shakeIntensity = 5;
        spawnFloater(player.x, player.y - 50, msg || "🚨 BUSTED!", "#F44336");
        playTone(680, 0.25, "sawtooth", 0.14, 460);
        setTimeout(function () { playTone(460, 0.25, "sawtooth", 0.14, 680); }, 240);
    }
    function startCopChase(cop, reason) {
        cop.busted = true;
        var idx = roadCops.indexOf(cop);
        if (idx >= 0) roadCops.splice(idx, 1); // it's now the chaser, not a parked cop
        beginCopChase(cop.x, "🚨 SPEED TRAP!", null, reason || "SPEEDING");
    }

    function updateCopChase(dt) {
        copChase.siren += dt;
        copChase.x = lerp(copChase.x, player.x, Math.min(1, 3 * dt));
        // The cruiser keeps pace with your NATURAL speed, so being fast isn't
        // enough — only actively flooring it (boost) opens a gap; cruising lets
        // him slowly reel you in, braking lets him catch fast. This keeps the
        // chase tense at any speed instead of ending instantly when you're fast.
        // DIVERGES from HER speed sites ON PURPOSE: this paces the pursuing cruiser
        // (a WORLD-difficulty knob), so it stays on the UNMODIFIED formula and does
        // NOT read luluStat. If we scaled it by her garage stats the cop would just
        // match whatever car she bought, erasing the whole point of a fast getaway
        // car. Left fixed, a high-top ride genuinely out-cruises the law while a
        // low-top one must floor it to open a gap — a fair, sane reward for speed.
        var baseSpeed = Math.min(BASE_SPEED + gameTime * SPEED_RAMP, MAX_SPEED);
        var copCruise = baseSpeed * 1.16;   // slightly faster cruise so long chases don't go slack
        copChase.gap += (gameSpeed - copCruise) * dt * 0.7;
        if (keys.up) copChase.gap += 40 * dt;    // flooring it pulls away
        if (keys.down) copChase.gap -= 50 * dt;   // braking lets him catch up
        copChase.gap = clamp(copChase.gap, 0, 520);
        if (copChase.gap > 360) {
            copChase.escapeT += dt;
            if (copChase.escapeT > 1.6) {
                spawnFloater(player.x, player.y - 50, "Lost 'em! 😎", "#7CFC4F");
                playTone(659, 0.1, "triangle", 0.2);
                setTimeout(function () { playTone(988, 0.12, "triangle", 0.2); }, 90);
                questAdd("escapes2", 1);   // weekly quest: escape a cop chase
                copChase = null;
                spontaneousChaseCool = rand(12, 20);   // breather before the next call-in
                postEscapeGrace = 5;   // hard breather: NO cop (trap/APB/recognition) can pounce for a few seconds
                return;
            }
        } else { copChase.escapeT = 0; }
        if (copChase.gap <= 6) startCopBust();
    }

    var COP_LINE_DUR = 1.55;  // seconds each dialogue line lingers (tap to skip)

    // The plain-language charge for the CURRENT stop, in priority order: an
    // escape in progress, the chase's carried charges, the chase's reason, an
    // open wanted file, then a generic fallback. Shown out loud + on a plaque so
    // the pull-over ALWAYS states exactly why she's being stopped.
    function bustReasonText(chaseReason, charges) {
        if (prisonClothes) return "ESCAPE FROM CUSTODY";
        if (charges && charges.length) return charges.slice(0, 2).join(" + ");
        if (chaseReason) return chaseReason;
        if (typeof isWanted === "function" && isWanted() && save.wanted && save.wanted.length) return save.wanted.slice(0, 2).join(" + ");
        return "RECKLESS DRIVING";
    }
    // Split a charge phrase onto ~16-char lines so the spoken bubble stays tidy.
    function wrapCharge(s) {
        var words = s.split(" "), out = [], cur = "";
        for (var i = 0; i < words.length; i++) {
            var t = cur ? cur + " " + words[i] : words[i];
            if (t.length > 16 && cur) { out.push(cur); cur = words[i]; } else cur = t;
        }
        if (cur) out.push(cur);
        return out.join("\n");
    }

    function startCopBust() {
        var fromLeft = player.x > W / 2;
        // Pick the OUTCOME first (preserving the old odds: 10% impound, ~22% let
        // off, the rest a ticket), then a funny scene that plays toward it.
        var r = Math.random();
        var outcome = r < 0.10 ? "walk" : r < 0.32 ? "free" : "ticket";
        // A chase that carries specific charges (e.g. grand theft), OR a FUGITIVE
        // who's run down, ALWAYS ends in a booking — so the SCENE matches the result
        // (no "Bubbe knows him / bribe works" free scene that then jails her anyway).
        var chargeCarry = copChase ? copChase.charges : null;
        var chaseReason = copChase ? copChase.reason : null;
        if (chargeCarry || prisonClothes) outcome = "ticket";
        var pool = COP_SCENES.filter(function (s) { return s.outcome === outcome; });
        var scene = randPick(pool);
        // Work out WHY she's being stopped and put it FIRST — a definite opening
        // line, before the (randomized, comedic) scene plays. Build a fresh lines
        // array so the shared COP_SCENES template is never mutated.
        var reasonText = bustReasonText(chaseReason, chargeCarry);
        var openLine = ["cop", "You're pulled\nover for:\n" + wrapCharge(reasonText)];
        var lines = [openLine].concat(scene.lines);
        copBust = {
            phase: 0, timer: 1.0, copY: player.y + 96, man: null, fromLeft: fromLeft,
            outcome: outcome, title: scene.title, lines: lines, bustCharges: chargeCarry,
            reasonText: reasonText,
            line: 0, lineT: 0, resolveT: 0, knockT: 0
        };
        copChase = null;
        state = "copBust";
        shakeTimer = 0.45; shakeIntensity = 6;
        playWompWomp();
        // Commit the high score only on the ticket (the real game over); free &
        // walk can still raise it, and their branches commit exactly once.
        if (outcome === "ticket" && score > save.highScore) save.highScore = Math.floor(score);
        persistSave();
    }

    // Whose turn it is this line ("cop" / "lulu"), or null when the script is done.
    function copSpeaker() {
        var ln = copBust.lines[copBust.line];
        return ln ? ln[0] : null;
    }

    function updateCopBust(dt) {
        if (shakeTimer > 0) shakeTimer -= dt;
        updateParticles(dt);

        // Phase 0 — the cruiser eases up right behind her.
        if (copBust.phase === 0) {
            copBust.timer -= dt;
            copBust.copY = lerp(copBust.copY, player.y + 58, Math.min(1, 5 * dt));
            if (copBust.timer <= 0) {
                copBust.phase = 1;
                copBust.man = {
                    x: copBust.fromLeft ? -34 : W + 34,
                    y: player.y + 18,
                    targetX: player.x + (copBust.fromLeft ? -44 : 44),
                    time: 0, state: "running", runDir: copBust.fromLeft ? 1 : -1,
                    cop: true   // the officer climbing out of the cruiser
                };
            }
            return;
        }

        // Phase 1 — he strolls over to her window (deliberate, not a sprint).
        if (copBust.phase === 1) {
            copBust.man.time += dt;
            var dir = copBust.man.targetX - copBust.man.x;
            if (Math.abs(dir) > 4) {
                copBust.man.x += Math.sign(dir) * 165 * dt;
                copBust.man.runDir = dir >= 0 ? 1 : -1;
            } else {
                copBust.man.x = copBust.man.targetX;
                copBust.phase = 2; copBust.line = 0; copBust.lineT = 0;
                copBust.man.state = (copSpeaker() === "cop") ? "talk" : "listen";
                playTone(330, 0.05, "square", 0.08); // *tap tap* on the window
            }
            return;
        }

        // Phase 2 — the back-and-forth. Each line lingers, or tap to advance.
        if (copBust.phase === 2) {
            copBust.man.time += dt;
            copBust.lineT += dt;
            // consume BOTH (a tap queues each) so the leftover can't advance an
            // extra line next frame or leak into the resumed scene.
            var cbc = consumeClick(), cba = consumeAction(), skip = cbc || cba;
            if (copBust.lineT >= COP_LINE_DUR || skip) {
                copBust.line++;
                copBust.lineT = 0;
                if (copBust.line >= copBust.lines.length) {
                    copBust.phase = 3; copBust.resolveT = 0;
                    copBust.man.state = copBust.outcome === "free" ? "talk" : "yelling";
                } else {
                    var who = copSpeaker();
                    copBust.man.state = (who === "cop") ? "talk" : "listen";
                    playTone(who === "cop" ? 300 : 620, 0.04, "sine", 0.06); // speech blip
                }
            }
            return;
        }

        // Phase 3 — the outcome lands, holds a beat, then resolves.
        if (copBust.phase === 3) {
            copBust.man.time += dt;
            copBust.resolveT += dt;
            if (copBust.resolveT > 1.9) {
                var out = copBust.outcome;
                var wasBribe = copBust.title && copBust.title.indexOf("BRIBE") >= 0;
                var bch = copBust.bustCharges;
                copBust = null;
                // A FUGITIVE who actually gets run down doesn't get a warning or a
                // walk — she's collared on the spot (escape charges, drive downtown).
                if (prisonClothes) {
                    if (typeof beginArrest === "function") beginArrest(["ESCAPE FROM CUSTODY", "RESISTING ARREST"], { fromBust: true });
                    else goToJail(["ESCAPE FROM CUSTODY", "RESISTING ARREST"]);
                } else if (out === "free") returnToDriving();
                else if (out === "walk") startFootWorld("copWalk");
                // A ticket now means a trip downtown: she's cuffed and DRIVEN to
                // the station (the arrest cutscene) before booking + her day in
                // court — instead of blinking straight to a cell.
                else {
                    var tch = bch || (wasBribe ? ["ATTEMPTED BRIBERY", "SPEEDING"] : ["SPEEDING", "RECKLESS DRIVING"]);
                    if (typeof beginArrest === "function") beginArrest(tch, { fromBust: true });
                    else goToJail(tch);
                }
            }
        }
    }

    // ── Decorative parked vehicles on the grass shoulder, each with its own
    //    little "story" — crashed into a tree, slid off-trail through the mud,
    //    pulled over by a cop, abandoned (driver's watering a bush), or broken
    //    down with the hood up. Pure scenery; they don't collide. ──
    var ROADSIDE_STORIES = ["tree", "offtrail", "pulled", "abandoned", "malfunction"];
    function spawnRoadsideVeh() {
        var left = Math.random() < 0.5;
        var story = randPick(ROADSIDE_STORIES);
        var x = left ? rand(26, Math.max(28, ROAD_L - 28)) : rand(ROAD_R + 28, W - 26);
        var rot = (left ? 1 : -1) * (story === "offtrail" ? rand(0.5, 0.9) : story === "tree" ? rand(0.12, 0.3) : rand(-0.08, 0.08));
        roadsideVeh.push({ x: x, y: -140, side: left ? -1 : 1, story: story,
            color: randPick(C.enemyCols), carType: randCarType(), rot: rot, copSiren: 0, peeT: rand(0, 2) });
    }
    function updateRoadsideVeh(dt) {
        for (var i = roadsideVeh.length - 1; i >= 0; i--) {
            var v = roadsideVeh[i];
            v.y += gameSpeed * dt;
            if (v.story === "pulled") v.copSiren += dt;
            if (v.story === "abandoned") v.peeT += dt;
            // Catching AVIGAIL pulled over, mid-tantrum → +2 💜 (schadenfreude
            // is a bonding experience) and Lulu savors the moment.
            if (v.avigail && !v.seen && Math.abs(v.y - player.y) < 100) {
                v.seen = true;
                if (!v.yell) v.yell = randPick(AVIGAIL_PULLED_YELLS);
                if (typeof bumpAvigailRel === "function") bumpAvigailRel(2);
                spawnFloater(player.x, player.y - 30, "😏 Well, well, WELL.", "#F48FB1");
            }
            if (v.y > H + 140) roadsideVeh.splice(i, 1);
        }
        if (roadsideCool > 0) { roadsideCool -= dt; return; }
        // grass shoulders only — city shoulders are packed with buildings
        if (zone !== "rural" || gameTime < 8 || roadsideVeh.length >= 2) return;
        if (Math.random() < dt * 0.5) { spawnRoadsideVeh(); roadsideCool = rand(3.5, 7); }
    }
    function drawRoadsideVeh(v) {
        var x = v.x, y = v.y;
        // muddy tire tracks trailing off the road (slid off-trail)
        if (v.story === "offtrail") {
            ctx.strokeStyle = "rgba(86,60,38,0.5)"; ctx.lineWidth = 4; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(x - 6 - v.side * 30, y + 130); ctx.quadraticCurveTo(x - 4, y + 55, x - 5, y + 6); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + 6 - v.side * 30, y + 130); ctx.quadraticCurveTo(x + 8, y + 55, x + 5, y + 6); ctx.stroke();
            ctx.lineCap = "butt";
        }
        // a cop cruiser parked behind it, lights going
        if (v.story === "pulled") drawCopCar(x - v.side * 3, y + 50, v.copSiren * 3);
        // Avigail mid-tantrum at the officer
        if (v.avigail && v.yell && v.y > 40 && v.y < H - 60) drawSpeechBubble(x, y - 44, v.yell, v.copSiren);
        // the parked car (tilted per story)
        ctx.save(); ctx.translate(x, y); ctx.rotate(v.rot || 0);
        drawEnemyCar(0, 0, v.color, v.carType);
        if (v.story === "malfunction") {
            ctx.fillStyle = "#455A64"; roundRect(-13, -CAR_H / 2 - 7, 26, 11, 2); ctx.fill();           // popped hood
            ctx.fillStyle = "#263238"; roundRect(-13, -CAR_H / 2 - 7, 26, 3, 2); ctx.fill();
            ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.ellipse(-CAR_W / 2 - 1, -CAR_H / 2 + 18, 6, 3, 0, 0, Math.PI * 2); ctx.fill();   // flat tire
        }
        if (v.story === "abandoned") {   // driver door swung open
            ctx.fillStyle = shadeColor(v.color, -22); ctx.save(); ctx.translate(-CAR_W / 2 + 3, -2); ctx.rotate(-0.7); roundRect(-3, -11, 6, 22, 2); ctx.fill(); ctx.restore();
        }
        ctx.restore();
        // a tree the nose is crumpled into + a wisp of smoke
        if (v.story === "tree") {
            if (typeof drawTree === "function") drawTree(x + v.side * 3, y - CAR_H / 2 - 6, 1.05, gameTime, x);
            if (Math.random() < 0.4) particles.push({ x: x + rand(-6, 6), y: y - CAR_H / 2, vx: rand(-10, 10), vy: rand(-30, -12), life: 0, maxLife: 1.0, size: rand(4, 7), color: randPick(["#9E9E9E", "#BDBDBD", "#757575"]), gravity: -10 });
        }
        if (v.story === "malfunction" && Math.random() < 0.35) particles.push({ x: x + rand(-5, 5), y: y - CAR_H / 2 - 5, vx: rand(-8, 8), vy: rand(-26, -10), life: 0, maxLife: 0.9, size: rand(3, 6), color: randPick(["#9E9E9E", "#616161", "#424242"]), gravity: -8 });
        // abandoned: the driver "watering" a bush off to the side
        if (v.story === "abandoned") {
            var gx = x + v.side * 27, gy = y + 6;
            ctx.fillStyle = "#43A047"; ctx.beginPath(); ctx.arc(gx + v.side * 6, gy + 7, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#5D4037"; roundRect(gx - 3, gy - 14, 7, 14, 2); ctx.fill();
            ctx.fillStyle = (typeof C !== "undefined" && C.skin) || "#FFD9C0"; ctx.beginPath(); ctx.arc(gx, gy - 16, 4, 0, Math.PI * 2); ctx.fill();
            drawText("💦", gx + v.side * 5, gy - 3, "9px Arial", "#80DEEA", null, 0);
        }
    }

    function drawRoadsideCop(cop) {
        drawCopCar(cop.x, cop.y, 0); // parked → static lights
        // partial cover so it's "hidden"
        if (cop.hide === "tree") {
            drawTree(cop.x + cop.side * 4, cop.y - 4, 1.15, gameTime, cop.x);
        } else if (cop.hide === "billboard") {
            ctx.fillStyle = "#5D4037"; roundRect(cop.x - 22, cop.y - 8, 44, 28, 4); ctx.fill();
            ctx.fillStyle = "#FFF"; roundRect(cop.x - 18, cop.y - 4, 36, 20, 2); ctx.fill();
            drawText("RADAR", cop.x, cop.y + 6, "bold 9px Arial", "#37474F", null, 0);
        } else {
            drawBush(cop.x, cop.y + 10, 1.6, gameTime, cop.x);
        }
        if (cop.spot > 0.04) {
            var a = clamp(cop.spot / 0.65, 0, 1);
            ctx.globalAlpha = 0.55 + 0.45 * a;
            drawText("!", cop.x, cop.y - 34, "bold " + (16 + a * 12) + "px Arial", "#FF1744", "#FFF", 3);
            ctx.globalAlpha = 1;
        }
    }

    // Draw whatever vehicle Lulu is CURRENTLY driving (her pink car, or a
    // borrowed bus / ambulance / cop cruiser / steamroller) at a given spot.
    // Cutscenes use this so the pulled-over / crashed / arrested vehicle matches
    // what she was actually behind the wheel of — not always the pink car.
    function drawPlayerVehicleAt(x, y, rot, time, blinking) {
        if (!playerVehicle) { drawLuluCar(x, y, rot, blinking, time, distractedMode); return; }
        ctx.save();
        ctx.translate(x, y);
        if (rot) ctx.rotate(rot);
        if (playerVehicle === "bus") drawTopBus(0, 0);
        else if (playerVehicle === "ambulance") drawAmbulance(0, 0, time);
        else if (playerVehicle === "cop") drawCopCar(0, 0, time * 3);
        else if (playerVehicle === "dozer") drawSteamroller(0, 0, 0, time);
        else if (playerVehicle === "borrowed") drawEnemyCar(0, 0, (borrowedCar && borrowedCar.color) || "#E53935", (borrowedCar && borrowedCar.carType) || 0);
        else drawLuluCar(0, 0, 0, blinking, time, distractedMode);
        ctx.restore();
    }

    function drawCopBust() {
        drawRoad(scrollOffset);
        drawDecorations(gameTime);

        // Siren light-wash: the whole scene pulses red then blue, like the
        // cruiser's bar is strobing across it. Sides alternate for that
        // sweeping squad-car feel. Kept subtle so the action stays readable.
        var sirN = Math.sin(gameTime * 9);
        var redOn = sirN > 0;
        var washA = 0.10 + Math.abs(sirN) * 0.16;
        var washGrad = ctx.createLinearGradient(redOn ? 0 : W, 0, redOn ? W : 0, 0);
        washGrad.addColorStop(0, (redOn ? "rgba(255,40,40," : "rgba(40,90,255,") + washA + ")");
        washGrad.addColorStop(0.55, (redOn ? "rgba(255,40,40," : "rgba(40,90,255,") + (washA * 0.25) + ")");
        washGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = washGrad;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        if (shakeTimer > 0) ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        drawCopCar(player.x, copBust.copY, gameTime * 3); // sirens flashing
        drawPlayerVehicleAt(player.x, player.y, 0, gameTime, false);
        if (copBust.man) {
            drawAngryMan(copBust.man.x, copBust.man.y, copBust.man.time, copBust.man.state, copBust.man.runDir, copBust.man.cop);
        }
        ctx.restore();
        drawParticles();

        // Top banner: the situation as it unfolds (no sudden jump to a verdict).
        if (copBust.phase <= 1) {
            var apProg = copBust.phase === 0 ? "🚨 PULLED OVER 🚨" : "Here he comes...";
            drawText(apProg, W / 2, H * 0.12, "bold 24px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 6);
        }

        // Persistent CHARGE plaque — always on screen through the whole stop, so
        // the reason is unmistakable no matter which comedic scene plays.
        if (copBust.reasonText) {
            ctx.font = "bold 15px 'Segoe UI', Arial, sans-serif";
            var rw = Math.max(180, ctx.measureText(copBust.reasonText).width + 44);
            var rx = W / 2 - rw / 2, ry = H * 0.055;
            ctx.fillStyle = "rgba(20,10,10,0.82)";
            roundRect(rx, ry, rw, 34, 9); ctx.fill();
            ctx.strokeStyle = "#FF5252"; ctx.lineWidth = 2;
            roundRect(rx, ry, rw, 34, 9); ctx.stroke();
            drawText("⚠️ CHARGE: " + copBust.reasonText, W / 2, ry + 17,
                "bold 15px 'Segoe UI', Arial, sans-serif", "#FFCDD2", "#000", 3);
        }

        // The exchange — show whoever is speaking this beat, as a bubble over
        // their head (cop) or over her car (Lulu).
        if (copBust.phase === 2 && copBust.man) {
            var cur = copBust.lines[copBust.line];
            if (cur) {
                if (cur[0] === "cop") {
                    drawSpeechBubble(copBust.man.x, copBust.man.y - 24, "👮 " + cur[1], copBust.man.time);
                } else {
                    drawSpeechBubble(player.x, player.y - 28, "💁 " + cur[1], gameTime);
                }
            }
            // gentle tap-to-continue nudge
            ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(gameTime * 4));
            drawText("tap ▸", W / 2, H * 0.93, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2);
            ctx.globalAlpha = 1;
        }

        // Phase 3 — the verdict lands with a big banner.
        if (copBust.phase === 3) {
            var col = copBust.outcome === "free" ? "#7CFC4F"
                    : copBust.outcome === "walk" ? "#FB8C00" : "#F44336";
            var pop = 1 + Math.max(0, 0.35 - copBust.resolveT) * 1.2; // quick pop-in
            ctx.save();
            ctx.translate(W / 2, H * 0.15);
            ctx.scale(pop, pop);
            drawText(copBust.title, 0, 0, "bold 30px 'Segoe UI', Arial, sans-serif", col, "#000", 6);
            ctx.restore();
            var sub = copBust.outcome === "free" ? "Back on the road! 🚗"
                    : copBust.outcome === "walk" ? "No car? She'll WALK to Bubbe's..."
                    : "Booked for " + (copBust.reasonText || "reckless driving") + "!";
            drawText(sub, W / 2, H * 0.15 + 32, "bold 14px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
        }
    }

    // ══ Lulu drives a (hailed) cop car → she can pull people over ══
    // The reverse of the bust: now SHE'S the officer. Each scene is a back-and-
    // forth ending in a bribe (coins), an arrest (more coins + "justice"), a
    // warning, or the driver flooring it and getting away.
    var copStop = null;
    var COP_STOP_SCENES = [
        // ── Bribe (she pockets it) ──
        { outcome: "bribe", title: "💵 BRIBE POCKETED!", reward: 30, lines: [
            ["lulu", "License and\nregistration!"],
            ["driver", "Officer... for the\n'coffee fund'? 💵"],
            ["lulu", "...I take\ncash."],
            ["driver", "Pleasure doing\nbusiness! 😎"] ] },
        { outcome: "bribe", title: "💵 KICKBACK!", reward: 35, lines: [
            ["lulu", "Do you know how\nfast you were going?"],
            ["driver", "Fast enough to\nslip you a fifty? 🤑"],
            ["lulu", "Drive safe,\ncitizen. 😇"] ] },
        { outcome: "bribe", title: "💵 'DONATION' MADE", reward: 28, lines: [
            ["lulu", "Step out of\nthe vehicle!"],
            ["driver", "Rugelach AND\ntwenty bucks? 🥧"],
            ["lulu", "...for the\nPRECINCT. Go."] ] },
        // ── Jail (hauled off) ──
        { outcome: "jail", title: "🚔 HAULED TO JAIL!", reward: 45, lines: [
            ["lulu", "You were\nFLYING!"],
            ["driver", "I'm LATE for\nkiddush!"],
            ["lulu", "Tell it to\nthe JUDGE!"],
            ["driver", "Aw, nuts. 🚔"] ] },
        { outcome: "jail", title: "🚔 BOOKED!", reward: 40, lines: [
            ["lulu", "You ran THREE\nred lights!"],
            ["driver", "They were\n...orange-ish?"],
            ["lulu", "In the car.\nLet's GO."] ] },
        // ── Warning (let off) ──
        { outcome: "letgo", title: "⚠️ WARNING GIVEN", reward: 8, lines: [
            ["lulu", "Slow it down,\nbubbeleh."],
            ["driver", "Yes, officer!\nThank you! 🙏"] ] },
        { outcome: "letgo", title: "⚠️ LET OFF", reward: 8, lines: [
            ["lulu", "I'll let it\nslide... once."],
            ["driver", "You're an\nANGEL! 😇"] ] },
        // ── Runner (they bolt) ──
        { outcome: "runs", title: "💨 THEY BOLTED!", reward: 0, lines: [
            ["lulu", "Step out of\nthe—"],
            ["driver", "...NEVER!! 🏃💨"],
            ["lulu", "...oy. 🚓💨"] ] },
        { outcome: "runs", title: "💨 RUNNER!", reward: 0, lines: [
            ["lulu", "Pull over\nNOW!"],
            ["driver", "Catch me,\ncopper! 😜"] ] }
    ];

    function copPullOver() {
        if (state !== "playing" || playerVehicle !== "cop") return;
        // nearest ordinary traffic car ahead, within siren range
        var best = null, bestD = 1e9, bi = -1;
        for (var i = 0; i < obstacles.length; i++) {
            var o = obstacles[i];
            if (o.type !== "car" || o.crashed) continue;
            if (o.behavior && o.behavior !== "normal" && o.behavior !== "drunk" && o.behavior !== "texting") continue;
            if (o.y > player.y - 40 || o.y < player.y - 340) continue;   // ahead, in range
            var d = player.y - o.y;
            if (d < bestD) { bestD = d; best = o; bi = i; }
        }
        if (!best) {
            spawnFloater(player.x, player.y - 46, "🚨 No one to bust!", "#90CAF9");
            playTone(700, 0.1, "sawtooth", 0.07, 500);
            return;
        }
        var r = Math.random();
        var outcome = r < 0.35 ? "bribe" : r < 0.70 ? "jail" : r < 0.90 ? "letgo" : "runs";
        var pool = COP_STOP_SCENES.filter(function (s) { return s.outcome === outcome; });
        var sc = randPick(pool);
        var car = { x: clamp(best.x, ROAD_L + 30, ROAD_R - 30), y: clamp(best.y, 120, player.y - 150),
                    color: best.color, carType: best.carType, behavior: best.behavior };
        obstacles.splice(bi, 1);
        copStop = { phase: 0, timer: 0.9, car: car, copY: car.y + 180,
                    lines: sc.lines, line: 0, lineT: 0, outcome: outcome,
                    title: sc.title, reward: sc.reward, resolveT: 0, rewarded: false };
        state = "copStop";
        // siren whoop
        playTone(900, 0.12, "sine", 0.13, 1320);
        setTimeout(function () { playTone(1320, 0.12, "sine", 0.13, 900); }, 160);
    }

    function updateCopStop(dt) {
        if (shakeTimer > 0) shakeTimer -= dt;
        updateParticles(dt);
        var cs = copStop;
        // Phase 0 — Lulu's cruiser eases up behind the car she lit up.
        if (cs.phase === 0) {
            cs.timer -= dt;
            cs.copY = lerp(cs.copY, cs.car.y + 84, Math.min(1, 5 * dt));
            if (cs.timer <= 0) { cs.phase = 1; cs.line = 0; cs.lineT = 0; }
            return;
        }
        // Phase 1 — the exchange (tap to advance).
        if (cs.phase === 1) {
            cs.lineT += dt;
            var csc = consumeClick(), csa = consumeAction(), skip = csc || csa;
            if (cs.lineT >= COP_LINE_DUR || skip) {
                cs.line++; cs.lineT = 0;
                if (cs.line >= cs.lines.length) {
                    cs.phase = 2; cs.resolveT = 0;
                    if (!cs.rewarded) {
                        cs.rewarded = true;
                        if (cs.reward > 0) {
                            runCoins += cs.reward; save.totalCoins += cs.reward; persistSave();
                            spawnFloater(player.x, player.y - 60, "+" + cs.reward + " 💰", "#FFD700");
                            playCoin();
                        }
                        if (cs.outcome === "jail") spawnFloater(cs.car.x, cs.car.y - 30, "⭐ Justice served!", "#FFD54F");
                        if (cs.outcome === "runs") spawnFloater(cs.car.x, cs.car.y - 30, "💨 Gone!", "#FF8A80");
                    }
                } else {
                    playTone(cs.lines[cs.line][0] === "lulu" ? 640 : 320, 0.04, "sine", 0.06);
                }
            }
            return;
        }
        // Phase 2 — verdict, then back to patrolling.
        if (cs.phase === 2) {
            cs.resolveT += dt;
            if (cs.resolveT > 1.8) { copStop = null; state = "playing"; }
        }
    }

    function drawCopStop() {
        drawRoad(scrollOffset);
        drawDecorations(gameTime);

        // Siren light-wash (Lulu's OWN cruiser this time).
        var sirN = Math.sin(gameTime * 9), redOn = sirN > 0, washA = 0.10 + Math.abs(sirN) * 0.16;
        var wg = ctx.createLinearGradient(redOn ? 0 : W, 0, redOn ? W : 0, 0);
        wg.addColorStop(0, (redOn ? "rgba(255,40,40," : "rgba(40,90,255,") + washA + ")");
        wg.addColorStop(0.55, (redOn ? "rgba(255,40,40," : "rgba(40,90,255,") + (washA * 0.25) + ")");
        wg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H);

        var cs = copStop, car = cs.car;
        ctx.save();
        if (shakeTimer > 0) ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        // the pulled-over car
        drawEnemyCar(car.x, car.y, car.color, car.carType);
        // Lulu's cop cruiser easing up behind, lights going
        drawCopCar(player.x, cs.copY, gameTime * 3);
        ctx.restore();
        drawParticles();

        if (cs.phase <= 0) {
            drawText("🚨 PULLING THEM OVER 🚨", W / 2, H * 0.12,
                "bold 22px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 6);
        }
        if (cs.phase === 1) {
            var cur = cs.lines[cs.line];
            if (cur) {
                if (cur[0] === "lulu") drawSpeechBubble(player.x, cs.copY - 30, "🚓 " + cur[1], gameTime);
                else drawSpeechBubble(car.x, car.y - 28, "🚗 " + cur[1], gameTime);
            }
            ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(gameTime * 4));
            drawText("tap ▸", W / 2, H * 0.93, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2);
            ctx.globalAlpha = 1;
        }
        if (cs.phase === 2) {
            var col = cs.outcome === "bribe" ? "#FFD700" : cs.outcome === "jail" ? "#5C6BC0"
                    : cs.outcome === "letgo" ? "#90CAF9" : "#FF8A80";
            var pop = 1 + Math.max(0, 0.35 - cs.resolveT) * 1.2;
            ctx.save(); ctx.translate(W / 2, H * 0.15); ctx.scale(pop, pop);
            drawText(cs.title, 0, 0, "bold 28px 'Segoe UI', Arial, sans-serif", col, "#000", 6);
            ctx.restore();
        }
    }

    // ── Update: Paused ───────────────────────────────────────
    function updatePaused(dt) {
        var click = consumeClick();
        if (click) {
            // Resume button
            if (pointInRect(click.x, click.y, W / 2 - 110, H / 2 - 55, 220, 56)) {
                state = prevState; playClick(); resumeMusic(); consumeAction(); return;
            }
            // Music toggle
            if (pointInRect(click.x, click.y, W / 2 - 110, H / 2 + 13, 220, 52)) {
                musicMuted = !musicMuted;
                if (musicMuted) pauseMusic(); else resumeMusic();
                playClick(); consumeAction(); return;
            }
            // SFX toggle
            if (pointInRect(click.x, click.y, W / 2 - 110, H / 2 + 75, 220, 52)) {
                audioMuted = !audioMuted;
                if (audioMuted) pauseMusic(); else resumeMusic();
                playClick(); consumeAction(); return;
            }
            // Quit button
            if (pointInRect(click.x, click.y, W / 2 - 110, H / 2 + 137, 220, 52)) {
                if (inTabletMode) { inTabletMode = false; state = "dinaHome"; playClick(); consumeAction(); return; }
                // Cookie Catch is a bedroom activity — quit back to the bedroom.
                if (prevState === "cookieCatch") { cookie = null; enterDinaHome(); playClick(); consumeAction(); return; }
                state = "menu"; parkingChallengeMode = false; playClick(); consumeAction(); return;
            }
            consumeAction();
            return;
        }
        if (consumePause()) {
            state = prevState;
            playClick();
            resumeMusic();
            return;
        }
    }

    // ── Update: Crash ────────────────────────────────────────
    var ANGRY_YELLS = [
        "MY CAR!",
        "YOU MANIAC!",
        "I'M CALLING\nTHE COPS!",
        "GET OFF\nTHE ROAD!",
        "LEARN TO\nDRIVE!!"
    ];
    // Yells specifically for the driver who climbs out of the car you wrecked.
    var CAR_YELLS = [
        "YOU WRECKED\nMY CAR!!",
        "MY INSURANCE!!",
        "20 YEARS,\nNO CLAIMS — GONE!",
        "DO YOU SEE\nTHIS DENT?!",
        "I JUST WAXED\nTHIS!!",
        "THAT'S A LEASE,\nLADY!!",
        "I JUST PAID\nIT OFF!!",
        "MY WIFE'S\nGONNA KILL ME!",
        "FORTY YEARS\nOF DRIVING!!",
        "YOU'LL HEAR\nFROM MY LAWYER!",
        "THAT WAS A\nCLASSIC!!",
        "BRAND NEW\nTIRES!! GONE!",
        "I NAMED\nHER BETSY!!",
        "WHERE'S YOUR\nLICENSE?!",
        "MY BUMPER\nSTICKER!!"
    ];
    // Themed yells for the wrecked driver, by how they were driving.
    var DRUNK_CAR_YELLS = [
        "*hic* YOU... YOU\nDENTED... sumthin'",
        "WAS THAT... a\nCAR? or TWO cars?",
        "I'm FINE to\nyell at you!",
        "MY... *burp*\n...INSHURANCE!",
        "OFFISHER! ...oh.\nYou're not a cop.",
        "I only had\nSIX l'chaims!",
        "Who moved\nthe ROAD?!"
    ];
    var TEXT_CAR_YELLS = [
        "BRB — wait,\nMY CAR?!",
        "I was MID-\nTEXT!! Rude!",
        "Hold on, lemme\nphoto the dent.",
        "Ugh, 1 bar of\nsignal AND no car!",
        "I'll TWEET\nabout this!!",
        "That's going on\nmy STORY.",
        "K so anyway— MY\nCAR IS TOTALED?!"
    ];
    // When the wreck was a police cruiser, the officer storms out — by-the-book
    // furious, badge-and-cap and all.
    var COP_CAR_YELLS = [
        "That's a CITY\nvehicle, ma'am!",
        "You're under\nARREST! ...probably.",
        "RECKLESS\nDRIVING! Pull o— oh.",
        "I just WAXED\nthis cruiser!!",
        "Do you KNOW\nwho I am?!",
        "License and\nregistration. NOW.",
        "That'll be a\nVERY big ticket."
    ];
    // Not everyone you bump is a furious grandpa — some are shaken and scared,
    // some are heartbroken. These pools fit either a bystander or a wrecked driver.
    var SCARED_YELLS = [
        "P-PLEASE don't\nhurt me!!",
        "MY HANDS ARE\nSHAKING!!",
        "I— I've NEVER\ncrashed before!",
        "Is everyone\nOKAY?! oh no—",
        "I'm calling\nmy MOM!!",
        "Do we... do we\nEXCHANGE info?!",
        "I think I might\nFAINT...",
        "AAH! my life\nFLASHED by!!"
    ];
    var SAD_YELLS = [
        "...my car. my\nbeautiful car. 😢",
        "I just GOT it\nwashed... *sniff*",
        "why does this\nALWAYS happen...",
        "I can't afford\nthis... again. 💧",
        "it was my\nzaidy's car...",
        "*quietly\nsobbing*",
        "I'm having the\nWORST week...",
        "I only wanted\na nice drive..."
    ];
    // Hair looks for the random driver — "grandpa" is the classic wild white.
    var DRIVER_HAIR = ["grandpa", "grandpa", "#3E2723", "#5D4037", "#212121", "#8D6E63", "#BDBDBD", "#C0843B"];
    function rollDriverMood() { var r = Math.random(); return r < 0.25 ? "scared" : r < 0.50 ? "sad" : "angry"; }
    function driverHairFor(mood) { var h = randPick(DRIVER_HAIR); return (mood !== "angry" && h === "grandpa") ? "#5D4037" : h; }
    function moodYell(mood, angryPool) { return mood === "scared" ? randPick(SCARED_YELLS) : mood === "sad" ? randPick(SAD_YELLS) : randPick(angryPool); }

    // Drunk bar patrons + the odd rowdy worker holler these at Lulu.
    var BAR_CATCALLS = [
        "Heyyy gorgeous! 🍻", "Niiice ride, sweetheart!", "Gimme a liiift?",
        "You're SO pretty!", "Marry me, Lulu! 💍", "*wolf whistle*", "Hubba hubba!",
        "Lookin' GOOD!", "Call me! ...somehow", "Is it hot or is it you?",
        "*hiccup* hellooo!", "Drive me home, cutie?", "My NUMBER is— *burp*",
        "Smile for me, doll!", "Best car in TOWN! 🚗", "Are you an angel? 😇",
        "Pull OVER, beautiful!", "I LOVE you, Lulu!! 💕"
    ];
    // Insults the swarming animals hurl at Lulu (generic across species).
    var ANIMAL_INSULTS = [
        "You DENT my cousin?!", "MURDERER!", "We saw EVERYTHING!", "Justice for Gerald!",
        "You drive like a SHEEP!", "Honk THIS, lady!", "Road HOG!", "My aunt was crossing!",
        "You'll PAY for this!", "We never forget!", "Off our road!", "Menace!"
    ];
    var angryYell = "";
    var hillelAdjuster = null;   // Hillel-the-insurance-guy reprieve, when active
    // typewriter helpers for Hillel's speech bubble (slow, smooth, tap-paced)
    function hillelTyped(s) { return s ? s.slice(0, Math.floor((hillelAdjuster.typeT || 0) * 32)) : ""; }
    function hillelDone(s) { return !s || Math.floor((hillelAdjuster.typeT || 0) * 32) >= s.length; }
    var spontaneousChaseCool = 22;   // cooldown before the next "called-in" pursuit can spawn
    var postEscapeGrace = 0;         // after shaking a chase: a breather where NO new chase can start
    var wantedSpot = 0;              // recognition meter while she has an open "wanted" file
    var wantedPatrolT = 0;          // trickle of patrols hunting a wanted Lulu
    var dozers = [];                // parked steamrollers waiting in work zones
    var dozerTimer = 0;             // how much "diesel" is left while driving one
    var dozerSpawnCool = 34;        // long cooldown — the steamroller is rare
    var flatWrecks = [];            // pancaked cars left in the steamroller's wake
    var DOZER_SPEED = 235;          // it's SLOW — that's the trade for being unstoppable
    var slowDriveT = 0;            // how long she's been crawling (unlocks the EXIT button)
    var parkExit = null;           // smooth "pull over & step out → on foot" animation
    var dozerNpcCool = 8;          // cadence for a steamroller trundling by (construction zones)

    // The person who climbs out of the car you hit isn't always a grumpy grandpa.
    // Each TYPE has its own look (shirt/cap/tie/hair) and its own ANGRY yells; the
    // scared/sad mood pools above carry the emotion when they're rattled instead.
    var STRANGER_TYPES = [
        { id: "grandpa", w: 3, shirt: "#B71C1C", shirtDark: "#8B0000", hair: "grandpa",
          yells: CAR_YELLS },
        { id: "businessman", w: 2, shirt: "#37474F", shirtDark: "#263238", tie: "#C62828", hair: "#3E2723",
          yells: ["I have a MEETING\nin TEN minutes!", "Do you know how\nMUCH I bill an HOUR?!",
                  "My CLIENT is\nin that car!", "This is a COMPANY\nlease, you menace!",
                  "I'll have your\nLICENSE for this!", "I'm late for\nMY OWN DEPOSITION!"] },
        { id: "teen", w: 2, shirt: "#7E57C2", shirtDark: "#4527A0", cap: "#FDD835", hair: "#212121",
          yells: ["Bro. BRO. My DAD's\ngonna KILL me!", "I just GOT my\nlicense YESTERDAY!",
                  "This is SO going\non my STORY!", "My insurance is,\nlike, my MOM!",
                  "You dinged my\nSUBWOOFER, dude!", "That's a vintage\nGAME in there!!"] },
        { id: "mom", w: 2, shirt: "#EC407A", shirtDark: "#AD1457", hair: "#5D4037",
          yells: ["There are KIDS\nin this car!!", "I JUST did the\ncarpool, lady!",
                  "My toddler is\nNAPPING in there!", "You scared the\nBABY! Shame!",
                  "I have GROCERIES\nmelting, you know!", "Snack time is\nRUINED now!"] },
        { id: "tourist", w: 1, shirt: "#26A69A", shirtDark: "#00796B", sunhat: 1, hair: "#8D6E63",
          yells: ["Iz zis... how you\nPARK in zis country?", "My RENTAL! Ze\ndeposit! NOOO!",
                  "Vhere is ze\nEiffel Tower?!", "I take PHOTO of\nyour bad driving!",
                  "Ze guidebook said\nNOSING about ZIS!"] },
        { id: "delivery", w: 1, shirt: "#FB8C00", shirtDark: "#E65100", cap: "#5D4037", hair: "#3E2723",
          yells: ["Forty PACKAGES\nin there, lady!", "My ROUTE is\nRUINED now!",
                  "That was a\nSAME-DAY delivery!", "My TIPS! Do you\nknow my TIPS?!",
                  "Customer's gonna\nONE-STAR me!"] },
        { id: "hipster", w: 1, shirt: "#8D6E63", shirtDark: "#5D4037", beanie: "#455A64", hair: "#3E2723",
          yells: ["That was a\nVINTAGE bumper!", "You wouldn't get it,\nit was ARTISANAL.",
                  "I had a COLD BREW\nin the cupholder!", "My VINYL collection\nis BACK there!",
                  "This car is\nIRONIC, actually."] }
    ];
    function pickStrangerType() {
        var total = 0, i;
        for (i = 0; i < STRANGER_TYPES.length; i++) total += STRANGER_TYPES[i].w;
        var r = Math.random() * total;
        for (i = 0; i < STRANGER_TYPES.length; i++) { r -= STRANGER_TYPES[i].w; if (r <= 0) return STRANGER_TYPES[i]; }
        return STRANGER_TYPES[0];
    }

    function emitWreckSmoke(dt) {
        crashSmokeT -= dt;
        if (crashSmokeT > 0) return;
        crashSmokeT = 0.08;
        var sources = [{ x: crashX, y: crashY }];
        if (crashedCar) sources.push({ x: crashedCar.x, y: crashedCar.y });
        for (var s = 0; s < sources.length; s++) {
            particles.push({
                x: sources[s].x + rand(-10, 10), y: sources[s].y + rand(-10, 6),
                vx: rand(-18, 18), vy: rand(-60, -28), life: rand(1.0, 1.8), maxLife: 1.5,
                size: rand(7, 13), color: randPick(["#424242", "#616161", "#9E9E9E", "#757575"]),
                gravity: -20, smoke: true
            });
        }
    }

    // Crash variant: you flattened an animal. Its furious kin appear and
    // surround Lulu hurling insults — until passing traffic mows THEM down too.
    function spawnAnimalSwarm() {
        var n = randInt(6, 8);
        for (var i = 0; i < n; i++) {
            var ang = (i / n) * Math.PI * 2 + rand(-0.25, 0.25);
            var rad = rand(42, 72);
            var bx = clamp(player.x + Math.cos(ang) * rad, ROAD_L + 16, ROAD_R - 16);
            var by = clamp(player.y + Math.sin(ang) * rad * 0.7, 90, H - 90);
            animalSwarm.push({
                x: bx, y: by, baseX: bx, baseY: by,
                insult: randPick(ANIMAL_INSULTS),
                ph: rand(0, Math.PI * 2),
                walkFrame: rand(0, 10),
                state: "taunt", vx: 0, vy: 0, rot: 0,
                bubbleT: rand(0, 2.4)
            });
        }
    }

    function updateAnimalCrash(dt) {
        // Phase 0: explosion, then the kin materialize.
        if (crashPhase === 0) {
            if (crashPhaseTimer <= 0) {
                spawnAnimalSwarm();
                crashPhase = 1;
                crashPhaseTimer = 7.0;  // hard cap on the scene length
                crashCarT = 0.6;
            }
            return;
        }

        // Phase 1: kin taunt Lulu while revenge traffic flings them off one by one.
        if (crashPhase === 1) {
            var aliveCount = 0;
            for (var i = 0; i < animalSwarm.length; i++) {
                var m = animalSwarm[i];
                m.ph += dt;
                m.bubbleT += dt;
                m.walkFrame += dt * 6;
                if (m.state === "taunt") {
                    aliveCount++;
                    m.x = m.baseX + Math.sin(m.ph * 3) * 4;
                    m.y = m.baseY - Math.abs(Math.sin(m.ph * 5)) * 5; // angry little hops
                    if (m.bubbleT > 2.4) { m.bubbleT = 0; m.insult = randPick(ANIMAL_INSULTS); }
                } else {
                    m.x += m.vx * dt; m.y += m.vy * dt;
                    m.vy += 420 * dt; m.rot += dt * 12;
                }
            }

            // Spawn revenge cars that barrel down the road, aimed at the survivors.
            crashCarT -= dt;
            if (crashCarT <= 0 && crashCars.length < 5) {
                crashCarT = rand(0.45, 0.9);
                var survivors = [];
                for (var s = 0; s < animalSwarm.length; s++) {
                    if (animalSwarm[s].state === "taunt") survivors.push(animalSwarm[s]);
                }
                var tx = survivors.length
                    ? randPick(survivors).x + rand(-12, 12)
                    : rand(ROAD_L + 24, ROAD_R - 24);
                tx = clamp(tx, ROAD_L + 20, ROAD_R - 20);
                crashCars.push({
                    x: tx, y: -90, color: randPick(C.enemyCols),
                    carType: randInt(0, 2), vy: rand(640, 840), hitW: 36, hitH: 64
                });
            }

            for (var c = crashCars.length - 1; c >= 0; c--) {
                var car = crashCars[c];
                car.y += car.vy * dt;
                for (var j = 0; j < animalSwarm.length; j++) {
                    var sm = animalSwarm[j];
                    if (sm.state !== "taunt") continue;
                    if (Math.abs(car.x - sm.x) < 26 && Math.abs(car.y - sm.y) < 34) {
                        sm.state = "hit";
                        sm.vx = (sm.x < car.x ? -1 : 1) * rand(120, 260);
                        sm.vy = rand(-260, -130);
                        sm.rot = 0;
                        spawnCrashBurst(sm.x, sm.y, false);
                        for (var k = 0; k < 8; k++) {  // a puff of feathers/fur
                            particles.push({
                                x: sm.x, y: sm.y, vx: rand(-90, 90), vy: rand(-130, -20),
                                life: rand(0.5, 1.0), maxLife: 1.0, size: rand(2, 5),
                                color: "#FAFAFA", gravity: 200
                            });
                        }
                        playWompWomp();
                    }
                }
                if (car.y > H + 120) crashCars.splice(c, 1);
            }

            if (aliveCount === 0 || crashPhaseTimer <= 0) {
                crashPhase = 2;
                crashPhaseTimer = 1.3;
            }
            return;
        }

        // Phase 2: brief beat as the last flung kin sail off, then game over.
        if (crashPhase === 2) {
            for (var i2 = 0; i2 < animalSwarm.length; i2++) {
                var fm = animalSwarm[i2];
                if (fm.state === "hit") {
                    fm.x += fm.vx * dt; fm.y += fm.vy * dt; fm.vy += 420 * dt; fm.rot += dt * 12;
                }
            }
            for (var c2 = crashCars.length - 1; c2 >= 0; c2--) {
                crashCars[c2].y += crashCars[c2].vy * dt;
                if (crashCars[c2].y > H + 120) crashCars.splice(c2, 1);
            }
            if (crashPhaseTimer <= 0) {
                state = "gameover";
                gameOverAlpha = 0; goScoreShown = 0; goConfettiDone = false;
                Ads.onGameOver();
            }
            return;
        }
    }

    function updateCrash(dt) {
        crashPhaseTimer -= dt;
        shakeTimer -= dt;
        flashTimer -= dt;
        crashRot += crashRotVel * dt;
        crashRotVel *= 0.96; // friction
        updateParticles(dt);
        emitWreckSmoke(dt); // the wreck keeps smoking through the whole scene

        if (crashCause && crashCause.kind === "animal") { updateAnimalCrash(dt); return; }

        // Phase 0: initial explosion (no scrolling — everything stops)
        if (crashPhase === 0) {
            if (crashPhaseTimer <= 0) {
                if (crashCause && crashCause.kind === "car" && crashedCar) {
                    // The driver of the car you wrecked flings open the door and
                    // storms over from the smoking heap itself.
                    var carLeft = crashedCar.x < player.x;
                    // A wrecked cop car sends out a uniformed officer, not a
                    // grandpa — looks right since the wreck is drawn as a cruiser.
                    var crashIsCop = crashCause.behavior === "patrol";
                    // Cops, drunks and texters stay their (angry/oblivious) selves;
                    // an ordinary driver might climb out scared or heartbroken instead.
                    var themed = crashIsCop || crashCause.behavior === "drunk" || crashCause.behavior === "texting";
                    var dMood = themed ? "angry" : rollDriverMood();
                    var sType = themed ? null : pickStrangerType();
                    angryMan = {
                        x: crashedCar.x,
                        y: crashedCar.y + 18,
                        targetX: player.x + (carLeft ? -40 : 40),
                        targetY: player.y + 46,
                        time: 0,
                        state: "running",
                        runDir: carLeft ? 1 : -1,
                        cop: crashIsCop,
                        mood: dMood,
                        stype: sType,
                        hair: crashIsCop ? null : (sType ? (sType.hair === "grandpa" && dMood !== "angry" ? "#5D4037" : sType.hair) : driverHairFor(dMood))
                    };
                    angryYell = crashIsCop ? randPick(COP_CAR_YELLS)
                              : crashCause.behavior === "drunk" ? randPick(DRUNK_CAR_YELLS)
                              : crashCause.behavior === "texting" ? randPick(TEXT_CAR_YELLS)
                              : (dMood === "angry" ? randPick(sType.yells) : moodYell(dMood, CAR_YELLS));
                    // door-burst puff at the wreck
                    for (var d0 = 0; d0 < 7; d0++) {
                        particles.push({
                            x: crashedCar.x + rand(-8, 8), y: crashedCar.y + rand(-4, 10),
                            vx: rand(-40, 40), vy: rand(-40, 0), life: 0.5, maxLife: 0.5,
                            size: rand(2, 4), color: "#CFD8DC", gravity: 30
                        });
                    }
                    crashPhase = 1;
                } else {
                    // Hitting a cone / barrier / sign / lone obstacle — there's no one
                    // to climb out and confront her. Skip the driver beat entirely and
                    // go straight to the aftermath fork (ER chance or game over).
                    crashPhase = 3;
                    crashPhaseTimer = 0.8;
                }
            }
            return;
        }

        // Phase 1: man runs in (toward the spot beside Lulu, in x AND y)
        if (crashPhase === 1) {
            angryMan.time += dt;
            var ty = (typeof angryMan.targetY === "number") ? angryMan.targetY : angryMan.y;
            var dx = angryMan.targetX - angryMan.x;
            var dy = ty - angryMan.y;
            var runSpeed = 220;
            var distSq = dx * dx + dy * dy;
            if (distSq > 30) {
                var d = Math.sqrt(distSq);
                angryMan.x += (dx / d) * runSpeed * dt;
                angryMan.y += (dy / d) * runSpeed * dt;
                angryMan.runDir = dx >= 0 ? 1 : -1;
            } else {
                angryMan.x = angryMan.targetX;
                angryMan.y = ty;
                angryMan.state = "yelling";
                crashPhase = 2;
                crashPhaseTimer = 2.2;
                // small dust puff
                for (var i = 0; i < 6; i++) {
                    particles.push({
                        x: angryMan.x + rand(-6, 6), y: angryMan.y + 18,
                        vx: rand(-30, 30), vy: rand(-30, -5),
                        life: 0.5, maxLife: 0.5,
                        size: rand(2, 4), color: "#BCAAA4", gravity: 40
                    });
                }
            }
            return;
        }

        // Phase 2: man yelling — then either a revenge car OR a funny reprieve
        if (crashPhase === 2) {
            angryMan.time += dt;
            if (crashPhaseTimer <= 0 && crashReprieve) {
                beginReprieve();
                return;
            }
            if (crashPhaseTimer <= 0 && !revengeCar) {
                revengeCar = {
                    x: angryMan.x,
                    y: -100,
                    color: randPick(C.enemyCols),
                    carType: randInt(0, 2),
                    vy: 700,
                    hitW: 36, hitH: 64
                };
            }
            if (revengeCar) {
                revengeCar.y += revengeCar.vy * dt;
                if (revengeCar.y >= angryMan.y - 10) {
                    // SLAM!
                    angryMan.state = "hit";
                    spawnCrashBurst(angryMan.x, angryMan.y, true);
                    playExplosion();
                    setTimeout(playWompWomp, 300);
                    shakeTimer = 0.6;
                    shakeIntensity = 12;
                    crashPhase = 3;
                    crashPhaseTimer = 1.4;
                    // revenge car keeps going off-screen
                }
            }
            return;
        }

        // Phase 3: aftermath — car drives past, fade out
        if (crashPhase === 3) {
            if (revengeCar) {
                revengeCar.y += revengeCar.vy * dt;
            }
            if (crashPhaseTimer <= 0) {
                // Totaling a POLICE cruiser doesn't end the run — it gets you
                // arrested (booked → court) instead of a plain game over.
                if (crashCause && crashCause.behavior === "patrol") {
                    crashedCar = null; angryMan = null; revengeCar = null; crashCause = null;
                    lives = Math.max(lives, 1);
                    beginArrest(["DESTROYING A POLICE CRUISER", "RECKLESS DRIVING"]);
                    return;
                }
                // Sometimes the ambulance gets there first → the ER, not game over.
                if (typeof beginHospital === "function" && Math.random() < 0.35) {
                    crashedCar = null; angryMan = null; revengeCar = null; crashCause = null;
                    beginHospital("crash");
                    return;
                }
                state = "gameover";
                gameOverAlpha = 0; goScoreShown = 0; goConfettiDone = false;
                Ads.onGameOver(); // interstitial in the native app; no-op on web
            }
            return;
        }

        // Phase 4: the rare reprieve plays out — a weird, funny second chance.
        if (crashPhase === 4) {
            angryMan.time += dt;
            if (angryMan.time > 9) { grantSecondChance(); return; } // hard safety cap
            if (reprieveKind === "insurance") {
                var hg = hillelAdjuster;
                if (!hg) { grantSecondChance(); return; }
                hg.t += dt; hg.typeT = (hg.typeT || 0) + dt;
                var hTap = consumeTap();
                if (hTap && !hillelDone(hg.line)) { hg.typeT = 999; return; }   // a tap fast-forwards the typing first
                if (hg.phase === 0) {                        // Hillel ambles over (slow, smooth), greeting types out
                    var hdx = hg.targetX - hg.x;
                    if (Math.abs(hdx) > 2) {
                        // constant slow amble + a gentle ease over the last stretch
                        var sp = Math.abs(hdx) < 36 ? 52 : 88;
                        hg.x += (hdx >= 0 ? 1 : -1) * sp * dt; hg.dir = hdx >= 0 ? 1 : -1;
                    } else { hg.x = hg.targetX; hg.arrived = true; }
                    // only move on once he's there AND done greeting — tap to continue (auto after a beat)
                    if (hg.arrived && hillelDone(hg.line) && (hTap || hg.t > 2.4)) {
                        hg.phase = 1; hg.t = 0; hg.typeT = 0;
                        hg.line = randPick(["Let me just... assess the damage. Mm. Mm-hm.",
                                            "Hold still — running the actuarials...",
                                            "One moment, carrying the one... mm-hm."]);
                        playTone(520, 0.06, "sine", 0.06);
                    }
                    return;
                }
                if (hg.phase === 1) {                        // crunching the numbers, clipboard out
                    if (hillelDone(hg.line) && (hTap || hg.t > 2.2)) {
                        // Hillel's actuarial fault calc: who was faster, who hit whom,
                        // who was distracted, who was impaired.
                        var f = 0.5;
                        if (hg.otherAhead) f += 0.22; else f -= 0.22;          // rear-ended the car in front = her fault
                        if (hg.oncoming) f -= 0.12;                            // they drifted into her lane
                        if (hg.distracted) f += 0.18;                          // she wasn't watching the road
                        if (hg.luluSpeed > hg.otherSpeed + 14) f += 0.15;      // she was barreling
                        if (hg.behavior === "drunk" || hg.behavior === "texting") f -= 0.30;
                        f = clamp(f, 0.12, 0.9);
                        hg.atFault = Math.random() < f;
                        if (hg.atFault) {
                            hg.amount = randInt(40, 110);
                            hg.report = "You: " + hg.luluSpeed + "mph · Them: " + hg.otherSpeed + "mph · " + (hg.otherAhead ? "you hit the car in FRONT" : "you swerved into them");
                            hg.line = randPick([
                                "Ran the numbers — this one's on YOU. Deductible's 💰" + hg.amount + ", sorry kid.",
                                "Fault's yours, mathematically. 💰" + hg.amount + " out of pocket, I'm afraid.",
                                "You were doing " + hg.luluSpeed + "; they weren't. 💰" + hg.amount + " deductible."]);
                        } else {
                            hg.amount = randInt(60, 150);
                            hg.report = "Them: " + hg.otherSpeed + "mph · You: " + hg.luluSpeed + "mph · " + (hg.otherAhead ? "but they cut you off" : "they rear-ended YOU") + (hg.oncoming ? ", oncoming" : "");
                            hg.line = randPick([
                                "Clear fault on THEM. Claim approved — 💰" + hg.amount + ", enjoy.",
                                "Not your fault! Pushed it through: 💰" + hg.amount + ". 📋",
                                "They were in the wrong doing " + hg.otherSpeed + ". 💰" + hg.amount + " for you."]);
                        }
                        hg.phase = 2; hg.t = 0; hg.typeT = 0;
                        playTone(hg.atFault ? 200 : 784, 0.12, "triangle", 0.16);
                    }
                    return;
                }
                if (hg.phase === 2) {                        // verdict → settle up → slip away
                    if (!hg.paid && hillelDone(hg.line)) {   // settle the moment the verdict has finished reading
                        hg.paid = true;
                        if (hg.atFault) {
                            var charged = chargeCoins(hg.amount);
                            spawnFloater(player.x, player.y - 40, "📋 −" + charged + " deductible", "#FF8A80");
                        } else if (hg.amount > 0) {
                            runCoins += hg.amount; save.totalCoins += hg.amount; persistSave();
                            playCoin();
                            spawnFloater(player.x, player.y - 40, "📋 +" + hg.amount + " payout!", "#90CAF9");
                        }
                    }
                    if (hg.paid && (hTap || hg.t > 2.6)) grantSecondChance();
                    return;
                }
                return;
            }
            if (reprieveKind === "faint") {                  // the scared driver keels over
                angryMan.faintT = (angryMan.faintT || 0) + dt;
                if (angryMan.faintT > 1.0) {
                    angryMan.faintRot = Math.min(Math.PI / 2, (angryMan.faintRot || 0) + dt * 3.2);
                    angryMan.state = "faint";
                    if (angryMan.faintRot >= Math.PI / 2 && !angryMan.thudded) {
                        angryMan.thudded = true; shakeTimer = 0.18; shakeIntensity = 4;
                        playTone(90, 0.18, "square", 0.14);
                        for (var fp = 0; fp < 6; fp++) particles.push({ x: angryMan.x + rand(-14, 14), y: angryMan.y + 16,
                            vx: rand(-50, 50), vy: rand(-26, -6), life: 0.5, maxLife: 0.5, size: rand(3, 5), color: "#BCAAA4", gravity: 60 });
                    }
                }
                if (angryMan.faintT > 2.8) grantSecondChance();
                return;
            }
            if (reprieveKind === "weep") {                   // the sad driver shuffles home
                angryMan.x += angryMan.runDir * 92 * dt;
                angryMan.weepT = (angryMan.weepT || 0) + dt;
                if (angryMan.weepT > 0.18) { angryMan.weepT = 0;
                    particles.push({ x: angryMan.x + rand(-4, 4), y: angryMan.y - 14, vx: angryMan.runDir * 8, vy: 40,
                        life: 0.7, maxLife: 0.7, size: rand(2, 3.4), color: "#7EC8F0", gravity: 120 });
                }
                if (angryMan.x < -50 || angryMan.x > W + 50) grantSecondChance();
                return;
            }
            if (reprieveKind === "arrest") {
                if (revengeCar && !revengeCar.arrived) {
                    // cop screeches down to the man
                    revengeCar.y += revengeCar.vy * dt;
                    if (revengeCar.y >= angryMan.y) {
                        revengeCar.y = angryMan.y;
                        revengeCar.arrived = true;
                        crashPhaseTimer = 1.1; // a beat for the cuffing
                        angryYell = randPick(["You're NICKED!", "Book him, boys!", "Down to the station!"]);
                    }
                    return;
                }
                if (crashPhaseTimer > 0) return; // hold during the cuffing beat
                // haul the man + cop off toward the nearer edge
                var edgeDir = (revengeCar && revengeCar.x < W / 2) ? -1 : 1;
                angryMan.state = "running"; angryMan.runDir = edgeDir;
                angryMan.x += edgeDir * 175 * dt;
                if (revengeCar) revengeCar.x += edgeDir * 95 * dt;
                if (angryMan.x < -50 || angryMan.x > W + 50) grantSecondChance();
                return;
            }
            // "chase": the man got distracted and bolts off down the road
            angryMan.x += angryMan.runDir * 230 * dt;
            if (angryMan.x < -50 || angryMan.x > W + 50) grantSecondChance();
            return;
        }
    }

    // Set up the rare second-chance sequence (chosen in hitPlayer).
    function beginReprieve() {
        crashPhase = 4;
        crashPhaseTimer = 3.2;
        // A shaken or heartbroken driver resolves it their OWN way: the scared one
        // keels over in a faint, the sad one shuffles home weeping. (Insurance —
        // Hillel's payout — is too good to override.)
        if (angryMan && reprieveKind !== "insurance") {
            if (angryMan.mood === "scared" && Math.random() < 0.7) reprieveKind = "faint";
            else if (angryMan.mood === "sad" && Math.random() < 0.7) reprieveKind = "weep";
        }
        if (reprieveKind === "faint") {
            angryMan.state = "yelling"; angryMan.faintT = 0; angryMan.faintRot = 0;
            angryYell = randPick(["I— I can't... feel my\nKNEES—", "everything's gone\nall... spinny...", "I feel FAINT—\n*wobble*"]);
        } else if (reprieveKind === "weep") {
            angryMan.state = "running"; angryMan.runDir = angryMan.x < W / 2 ? -1 : 1;
            angryYell = randPick(["*sob* ...I'm just\ngonna go home.", "I want my\nMOMMY... 😭", "this is the WORST\nday... *wail*"]);
        } else if (reprieveKind === "insurance") {
            // Hillel walks up from the shoulder, clipboard in hand, to "handle the
            // claim." The other driver calms down and lets the professional work.
            var fromLeft = player.x < W / 2;
            hillelAdjuster = {
                x: fromLeft ? -28 : W + 28, y: player.y + 30,
                targetX: player.x + (fromLeft ? -46 : 46), targetY: player.y + 30,
                dir: fromLeft ? 1 : -1, phase: 0, t: 0, amount: 0, atFault: false, report: null,
                // fault inputs snapshotted at impact
                luluSpeed: (crashCause && crashCause.luluSpeed) || 0,
                otherSpeed: (crashCause && crashCause.otherSpeed) || 0,
                otherAhead: !!(crashCause && crashCause.otherAhead),
                oncoming: !!(crashCause && crashCause.oncoming),
                distracted: !!(crashCause && crashCause.distracted),
                behavior: crashCause && crashCause.behavior,
                line: randPick(["Hi, Hillel — I'll be your adjuster today.",
                                "Don't panic! I do this... I DID this for a living.",
                                "Lulu?! Small world. Let me just run the numbers."])
            };
            angryMan.state = "talk";
            angryYell = randPick(["...who's THIS guy?", "Finally, a professional.", "*grumbles*"]);
        } else if (reprieveKind === "arrest") {
            // A cop screeches in from the top to nab the angry man.
            revengeCar = {
                x: clamp(angryMan.x + (angryMan.x < W / 2 ? 42 : -42), ROAD_L + 24, ROAD_R - 24),
                y: -110, vy: 620, cop: true, arrived: false, hitW: 36, hitH: 64
            };
            angryYell = "Wait— officer?!";
            angryMan.state = "yelling";
        } else {
            // The man is distracted by something and runs off down the road.
            angryMan.state = "running";
            angryMan.runDir = angryMan.x < W / 2 ? -1 : 1;
            angryYell = randPick(["HEY! COME BACK!", "MY HAT! MY HAT!", "STOP! THIEF!", "THAT'S MY DOG!"]);
        }
    }

    // The funny twist let Lulu off the hook — but her CAR is wrecked, so she
    // continues the run on foot (the "Lulu on Foot" playthrough). If she makes
    // it to Bubbe's she gets a ride back to the road; if not, the run ends.
    function grantSecondChance() {
        spawnFloater(W / 2, H * 0.40, "SECOND CHANCE!", "#7CFC00");
        spawnFloater(W / 2, H * 0.40 + 26,
            reprieveKind === "insurance" ? "Hillel handled it! 📋"
            : reprieveKind === "arrest" ? "They cuffed the guy! 🚓"
            : reprieveKind === "faint" ? "He fainted dead away! 😵"
            : reprieveKind === "weep" ? "He went home crying. 😢" : "You slipped away! 🏃‍♀️", "#FFE082");
        shakeTimer = 0; flashTimer = 0;
        angryMan = null; revengeCar = null; crashedCar = null; hillelAdjuster = null;
        crashCause = null; animalSwarm = []; crashCars = [];
        crashReprieve = false; reprieveKind = null;
        // Clear the hidden wreck sprite so it doesn't pop back when she returns.
        for (var hi = obstacles.length - 1; hi >= 0; hi--) if (obstacles[hi].hidden) obstacles.splice(hi, 1);
        startFootWorld("crashReprieve");
    }

    // ════════════ CONSTRUCTION VEHICLE — the STEAMROLLER ════════════
    // A steamroller sits parked in a coned-off work zone. Drive into it to
    // COMMANDEER it: it's SLOW, but it FLATTENS any car it touches (the driver
    // doesn't make it — dark, but quick). If a cop sees, she's chased — and good
    // luck outrunning anyone in a steamroller.
    function spawnDozer() {
        dozers.push({ x: LANES[randInt(0, 2)], y: -140, hitW: 50, hitH: 64, taken: false, t: 0 });
    }
    // A steamroller trundling along in traffic — a slow hazard to overtake. Common
    // in construction zones, a rare sight elsewhere.
    function spawnDozerNPC() {
        var lane = randInt(0, 2);
        obstacles.push({ type: "car", x: LANES[lane], y: -130, color: "#F9A825", carType: 0,
            hitW: 48, hitH: 60, speedMult: 0.86, lane: lane, behavior: "dozer", swerveT: 0, spillT: 0 });
    }
    function commandeerDozer(d) {
        d.taken = true;
        playerVehicle = "dozer"; dozerTimer = 13;
        invincibleTimer = Math.max(invincibleTimer, 0.4);
        spawnFloater(player.x, player.y - 44, "🚜 STEAMROLLER!", "#FFD54F");
        spawnFloater(player.x, player.y - 24, "CRUSH everything! (slow though)", "#FFE082");
        playTone(70, 0.3, "sawtooth", 0.18); setTimeout(function () { playTone(90, 0.4, "square", 0.14); }, 180);
    }
    function endDozer(msg) {
        playerVehicle = null; dozerTimer = 0;
        invincibleTimer = Math.max(invincibleTimer, 1.2);
        if (player) player.targetX = LANES[1];
        persistSave();   // flush the crush-coins banked in memory during the rampage
        spawnFloater(player.x, player.y - 40, msg || "⛽ Out of diesel — back to your car!", "#FFCC80");
    }
    function crushCar(o) {
        spawnCrashBurst(o.x, o.y, true);
        if (typeof playExplosion === "function") playExplosion();
        playTone(64, 0.24, "square", 0.16); shakeTimer = 0.12; shakeIntensity = 4;
        flatWrecks.push({ x: o.x, y: o.y, color: o.color || "#9E9E9E", t: 0, cop: o.behavior === "patrol",
            // pancake keeps the victim's footprint — a flattened bus stays LONG
            sz: Math.max(0.85, Math.min(1.8, (o.hitH || 64) / 64)) });
        // Bank the crush coins in memory only — do NOT persistSave() here. Flattening
        // a cluster crushes several cars in one frame, and a synchronous localStorage
        // write per car caused a visible hitch. They persist at the next checkpoint
        // (endDozer / scene change / game over).
        score += 60 * scoreMult; runCoins += 3; save.totalCoins += 3;
        spawnFloater(o.x, o.y - 10, randPick(["SPLAT! 💀", "FLATTENED!", "PANCAKED! 🥞", "CRUNCH! 💀"]), "#FF5252");
        // A cop in view (or a flattened cruiser) = she's made → chase + a wanted file.
        var witness = (typeof copInView === "function" && copInView()) || o.behavior === "patrol";
        if (!witness) for (var ci = 0; ci < obstacles.length; ci++) {
            var co = obstacles[ci];
            if (co.type === "car" && co.behavior === "patrol" && co.y > 0 && co.y < H) { witness = true; break; }
        }
        if (witness && !copChase && !copBust) {
            if (typeof addWanted === "function") addWanted(["VEHICULAR DESTRUCTION", "JOYRIDING A STEAMROLLER"]);
            beginCopChase(player.x, "🚨 VEHICULAR DESTRUCTION!", null, "DRIVING A STOLEN STEAMROLLER");
        }
    }
    // The pancaked wrecks she leaves behind scroll off with the road.
    function updateFlatWrecks(dt) {
        for (var i = flatWrecks.length - 1; i >= 0; i--) {
            var fw = flatWrecks[i]; fw.y += gameSpeed * dt; fw.t += dt;
            if (fw.y > H + 40 || fw.t > 6) flatWrecks.splice(i, 1);
        }
    }

    // The pancaked wreck left behind — a squashed car silhouette.
    function drawFlatWreck(fw) {
        ctx.save(); ctx.translate(fw.x, fw.y);
        var fs = fw.sz || 1; ctx.scale(fs, 1 + (fs - 1) * 0.35);   // bigger victim → bigger pancake
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(0, 2, 26, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = shadeColor(fw.color, -20); roundRect(-24, -6, 48, 12, 5); ctx.fill();
        ctx.fillStyle = fw.color; roundRect(-22, -5, 44, 6, 4); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.3)"; for (var c = -16; c <= 16; c += 8) ctx.fillRect(c, -5, 1.5, 11);  // crumple lines
        if (fw.cop) { ctx.fillStyle = "#1A237E"; roundRect(-22, -5, 44, 4, 2); ctx.fill(); }
        ctx.restore();
    }
    // The steamroller itself (Lulu in the cab unless `empty`, for the parked one).
    function drawSteamroller(x, y, tilt, t, empty) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(tilt || 0);
        // ground shadow
        ctx.fillStyle = "rgba(0,0,0,0.26)"; ctx.beginPath(); ctx.ellipse(0, 14, 35, 47, 0, 0, Math.PI * 2); ctx.fill();

        // ── REAR drive drum (a shaded cylinder across the back) ──
        var rg = ctx.createLinearGradient(0, 20, 0, 40);
        rg.addColorStop(0, "#90A4AE"); rg.addColorStop(0.5, "#607D8B"); rg.addColorStop(1, "#37474F");
        ctx.fillStyle = rg; roundRect(-27, 20, 54, 20, 6); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.18)"; roundRect(-27, 21, 54, 4, 6); ctx.fill();
        ctx.fillStyle = "#263238"; for (var rsx = -22; rsx < 26; rsx += 8) ctx.fillRect(rsx, 24, 2, 14);   // tread grooves
        ctx.fillStyle = "#455A64"; ctx.beginPath(); ctx.arc(-27, 30, 5, 0, Math.PI * 2); ctx.arc(27, 30, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#90A4AE"; ctx.beginPath(); ctx.arc(-27, 30, 2.2, 0, Math.PI * 2); ctx.arc(27, 30, 2.2, 0, Math.PI * 2); ctx.fill();

        // ── CHASSIS / engine body (gradient + panel + rivets) ──
        var cg = ctx.createLinearGradient(0, -14, 0, 26);
        cg.addColorStop(0, "#FFCA28"); cg.addColorStop(0.55, "#F9A825"); cg.addColorStop(1, "#F57F17");
        ctx.fillStyle = cg; roundRect(-21, -14, 42, 40, 8); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.10)"; ctx.fillRect(-21, 6, 42, 1.5);                         // panel seam
        ctx.fillStyle = "#FFE082"; for (var rv = -15; rv <= 15; rv += 10) { ctx.beginPath(); ctx.arc(rv, -10, 1, 0, Math.PI * 2); ctx.fill(); }
        // hazard-stripe tail band
        ctx.save(); roundRect(-21, 13, 42, 13, 6); ctx.clip();
        ctx.fillStyle = "#212121"; for (var hs = -30; hs < 26; hs += 11) { ctx.beginPath(); ctx.moveTo(hs, 26); ctx.lineTo(hs + 7, 13); ctx.lineTo(hs + 14, 13); ctx.lineTo(hs + 7, 26); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        ctx.strokeStyle = "#E65100"; ctx.lineWidth = 2; roundRect(-21, -14, 42, 40, 8); ctx.stroke();

        // ── exhaust stack (left) with a cap + a rising puff ──
        ctx.fillStyle = "#546E7A"; roundRect(-20, -22, 5, 12, 1.5); ctx.fill();
        ctx.fillStyle = "#263238"; roundRect(-21.5, -24, 8, 4, 1.5); ctx.fill();
        if (!empty) { var pf = (t * 16) % 12; ctx.fillStyle = "rgba(120,120,120," + (0.5 - pf * 0.035) + ")"; ctx.beginPath(); ctx.arc(-17.5, -26 - pf, 3 + pf * 0.25, 0, Math.PI * 2); ctx.fill(); }

        // ── CAB: roll-cage frame, tinted glass, Lulu, amber beacon ──
        ctx.fillStyle = "#FBC02D"; roundRect(-15, -12, 30, 26, 6); ctx.fill();
        var gg = ctx.createLinearGradient(0, -9, 0, 11); gg.addColorStop(0, "#B3E5FC"); gg.addColorStop(1, "#4FC3F7");
        ctx.fillStyle = gg; roundRect(-11, -8, 22, 18, 4); ctx.fill();
        if (!empty) {   // Lulu at the controls
            ctx.fillStyle = save.luluHair || "#8B5A2B"; ctx.beginPath(); ctx.arc(0, -2, 8, Math.PI, 0); ctx.fill();
            ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = save.luluHair || "#8B5A2B"; ctx.beginPath(); ctx.arc(0, -2, 7, Math.PI, 0); ctx.fill();
            ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-2.2, 0, 1, 0, Math.PI * 2); ctx.arc(2.2, 0, 1, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(255,140,140,0.5)"; ctx.beginPath(); ctx.arc(-4, 2, 1.4, 0, Math.PI * 2); ctx.arc(4, 2, 1.4, 0, Math.PI * 2); ctx.fill();
        } else { ctx.fillStyle = "rgba(0,0,0,0.18)"; roundRect(-9, -6, 18, 13, 3); ctx.fill(); }
        ctx.strokeStyle = "#E65100"; ctx.lineWidth = 3; roundRect(-15, -12, 30, 26, 6); ctx.stroke();
        ctx.fillStyle = "#FF6F00"; [[-13, -10], [13, -10], [-13, 12], [13, 12]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 2.3, 0, Math.PI * 2); ctx.fill(); });  // cage corner posts
        var beac = Math.sin(t * 10) > 0;                                                            // amber beacon
        if (beac) { ctx.fillStyle = "rgba(255,179,0,0.32)"; ctx.beginPath(); ctx.arc(0, -13, 8, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = beac ? "#FFC107" : "#8D6E00"; ctx.beginPath(); ctx.arc(0, -13, 3, 0, Math.PI * 2); ctx.fill();

        // ── articulation joint linking cab to the front drum ──
        ctx.fillStyle = "#37474F"; roundRect(-6, -21, 12, 9, 2); ctx.fill();
        ctx.fillStyle = "#90A4AE"; ctx.beginPath(); ctx.arc(0, -16.5, 2.4, 0, Math.PI * 2); ctx.fill();

        // ── FRONT big DRUM ROLLER (cylinder w/ sheen, rotating seams, hub bolts) ──
        var dg = ctx.createLinearGradient(0, -45, 0, -20);
        dg.addColorStop(0, "#CFD8DC"); dg.addColorStop(0.42, "#90A4AE"); dg.addColorStop(1, "#546E7A");
        ctx.fillStyle = dg; roundRect(-32, -45, 64, 25, 6); ctx.fill();
        ctx.save(); roundRect(-32, -45, 64, 25, 6); ctx.clip();
        ctx.fillStyle = "rgba(255,255,255,0.38)"; ctx.fillRect(-32, -44, 64, 5);                    // top sheen
        ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.fillRect(-32, -25, 64, 5);                          // bottom shade
        ctx.strokeStyle = "rgba(55,71,79,0.45)"; ctx.lineWidth = 1.5;                                // rotating seams
        for (var ds = 0; ds < 6; ds++) { var sx = -36 + (ds * 14 + ((t * 46) % 14)); ctx.beginPath(); ctx.moveTo(sx, -45); ctx.lineTo(sx, -20); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = "#37474F"; roundRect(-31, -49, 62, 3, 1); ctx.fill();                        // scraper bar
        ctx.fillStyle = "#455A64"; ctx.beginPath(); ctx.arc(-30, -32, 6, 0, Math.PI * 2); ctx.arc(30, -32, 6, 0, Math.PI * 2); ctx.fill();   // end caps
        ctx.fillStyle = "#90A4AE"; ctx.beginPath(); ctx.arc(-30, -32, 3.4, 0, Math.PI * 2); ctx.arc(30, -32, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#263238"; for (var bo = 0; bo < 6; bo++) { var ba = bo * Math.PI / 3 + t; ctx.beginPath(); ctx.arc(-30 + Math.cos(ba) * 3.8, -32 + Math.sin(ba) * 3.8, 0.8, 0, Math.PI * 2); ctx.arc(30 + Math.cos(ba) * 3.8, -32 + Math.sin(ba) * 3.8, 0.8, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
    }
    // The parked pickup: a steamroller boxed in by warning cones.
    function drawDozerPickup(d) {
        var cones = [[-34, 30], [34, 30], [-34, -34], [34, -34]];
        for (var c = 0; c < cones.length; c++) {
            var cx = d.x + cones[c][0], cy = d.y + cones[c][1];
            ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(cx, cy + 8, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FF7043"; ctx.beginPath(); ctx.moveTo(cx - 6, cy + 8); ctx.lineTo(cx + 6, cy + 8); ctx.lineTo(cx, cy - 8); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#FFF"; ctx.fillRect(cx - 4, cy - 1, 8, 3);
        }
        drawSteamroller(d.x, d.y, 0, d.t, true);
        var bl = 0.5 + 0.5 * Math.abs(Math.sin(gameTime * 4));
        ctx.globalAlpha = bl;
        drawText("🚜 DRIVE IN!", d.x, d.y - 54, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 3);
        ctx.globalAlpha = 1;
    }

    // ── Update: Game Over ────────────────────────────────────
    function updateGameOver(dt) {
        gameOverAlpha = Math.min(gameOverAlpha + dt * 2, 1);
        // Bank this run ONCE: lifetime score (unlock progress) + run-scope quests.
        bankRunStats();
        if (typeof mpPostScore === "function") { try { mpPostScore(); } catch (e) {} }
        // Clear residual angry-man/revenge-car state so they don't keep moving
        if (angryMan) angryMan = null;
        if (revengeCar) revengeCar = null;
        // Animated score count-up once the panel has faded in — gives the final
        // number a satisfying "tally" feel instead of just popping on.
        if (gameOverAlpha > 0.3) {
            var goTarget = Math.floor(score);
            if (goScoreShown < goTarget) {
                goScoreShown = Math.min(goTarget, goScoreShown + Math.max(1, goTarget * dt * 1.1));
            } else {
                goScoreShown = goTarget;
                // Count-up finished: if it's a new best, throw confetti once.
                if (!goConfettiDone && goTarget >= save.highScore && save.highScore > 0) {
                    goConfettiDone = true;
                    spawnConfetti(W / 2, H * 0.30, 80);
                    playStarSparkle();
                }
            }
        }
        updateParticles(dt);
        // THE JOURNEY: a WIN ending rains celebratory confetti instead of gloom.
        if (typeof tripEndedWell !== "undefined" && tripEndedWell && gameOverAlpha > 0.3 && Math.random() < dt * 2.2) {
            spawnConfetti(rand(W * 0.15, W * 0.85), -10, 10);
        }
        var click = consumeClick();
        if (click) {
            // Rewarded ad button (native only — gated by an actually-loaded ad)
            if (Ads.rewardedAvailable() &&
                pointInRect(click.x, click.y, W / 2 - 130, H * 0.70 - 26, 260, 52)) {
                Ads.showRewarded(function () {
                    runCoins += 50; save.totalCoins += 50; persistSave();
                    spawnFloater(W / 2, H * 0.40, "+50 💰", "#FFD700");
                });
                playClick(); return;
            }
            // Restart button
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.78 - 30, 220, 60)) {
                resetGame(); state = "playing"; playClick(); return;
            }
            // Menu button — Dina's tablet games return to her room; everyone else
            // goes to Lulu's menu (the sister picker is hidden behind the secret combo).
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.88 - 25, 220, 50)) {
                if (inTabletMode) { inTabletMode = false; state = "dinaHome"; playClick(); return; }
                state = "menu"; playClick(); return;
            }
        }
        if (consumeAction()) {
            resetGame(); state = "playing";
        }
    }

    // ── Update: Menu ─────────────────────────────────────────
    var menuMsg = "", menuMsgTimer = 0;
    function updateMenu(dt) {
        menuBounce += dt;
        if (questsUnlocked()) questState();   // touch quests so a weekly rollover persists on the menu
        if (menuMsgTimer > 0) menuMsgTimer -= dt;
        if (menuSecretT > 0) { menuSecretT -= dt; if (menuSecretT <= 0) menuSecretTaps = 0; }
        updateDecorations(dt, 80);
        var click = consumeClick();
        // A tap queues BOTH a click and an action. Drop the paired action as soon as
        // we have the click, so a button tap that returns early (the secret Dina
        // corner, mute, the distracted toggle) can't ALSO trip the "any action starts
        // the game" catch-all on the next frame. (This is what broke the Dina easter
        // egg: the first corner-tap started the game instead of counting toward 5.)
        if (click) consumeAction();
        // Shared Road button + its name/room overlay get first crack at the tap.
        if (click && typeof mpMenuClick === "function" && mpMenuClick(click)) return;
        if (click) {
            // PLAY button
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.50, 220, 60)) {
                resetGame(); gotoState("playing"); playClick(); return;
            }
            // PARKING button removed from the menu — parking is now reached only
            // via the road pull-over (Q / EXIT); the stack is compacted to match.
            // SHOP button
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.50 + 74, 220, 54)) {
                state = "shop"; shopTab = "skins"; shopDetail = null; shopDetailT = 0; playClick(); return;
            }
            // QUESTS button (unlocks at 200k lifetime score). Same qOff shove as
            // drawMenu + mpMenuBtnRect() so the whole stack stays aligned.
            var qOff = questsUnlocked() ? 50 : 0;
            if (questsUnlocked() &&
                pointInRect(click.x, click.y, W / 2 - 110, H * 0.50 + 136, 220, 44)) {
                state = "quests"; playClick(); return;
            }
            // Distracted mode toggle (if unlocked). It's a solo cheat (reverse
            // controls, 2× score) — locked out in friend rooms so shared
            // leaderboards and races stay fair.
            if (save.distractedUnlocked &&
                pointInRect(click.x, click.y, W / 2 - 110, H * 0.50 + 136 + qOff, 220, 44)) {
                if (!distractedMode && typeof mpConnected !== "undefined" && mpConnected && mpRoom !== "lobby") {
                    menuMsg = "📱 No distracted mode in friend rooms"; menuMsgTimer = 2.2;
                    playDeny(); return;
                }
                distractedMode = !distractedMode; playClick(); return;
            }
            // Mute button
            if (pointInRect(click.x, click.y, W - 60, 14, 44, 44)) {
                audioMuted = !audioMuted;
                if (audioMuted) stopMusic();
                else { var prev = musicState; musicState = null; if (prev) startMusic(prev); else startMusic("lulu"); }
                playClick();
                return;
            }
            // Secret: tap the top-left corner 5× quickly to reveal the hidden
            // sister picker (Dina's mode lives behind it).
            if (pointInRect(click.x, click.y, 0, 0, 70, 70)) {
                menuSecretTaps++; menuSecretT = 1.4;
                if (menuSecretTaps >= 5) { menuSecretTaps = 0; gotoState("charSelect"); playClick(); }
                return;
            }
            // Default: any click in upper area starts game
            if (click.y > H * 0.3 && click.y < H * 0.45) {
                resetGame(); state = "playing"; playClick(); return;
            }
        }
        if (consumeAction()) {
            // With the Shared Road overlay open, keyboard-start must not fire
            // behind it (mpMenuClick(null) returns true iff the overlay is open).
            if (typeof mpMenuClick === "function" && mpMenuClick(null)) return;
            resetGame(); state = "playing";
        }
    }

    // ── Update: Shop ─────────────────────────────────────────
    function updateShop(dt) {
        menuBounce += dt;
        if (shopDetail) shopDetailT += dt;   // drives the detail stat-bar fill-in
        if (lastBoughtTimer > 0) lastBoughtTimer -= dt;
        if (buyPopTimer > 0) buyPopTimer -= dt;   // owned-count pill pop/flash

        if (consumePause()) { shopDetail = null; state = "menu"; playClick(); return; }
        var click = consumeClick();
        if (!click) return;

        // Garage showroom detail view is open → ALL clicks route here.
        if (shopDetail) {
            var dk = shopDetail, dsk = SKINS[dk];
            var r = shopDetailRects();
            var dOwned = save.ownedSkins.indexOf(dk) >= 0;
            // Close (✕) or any tap outside the panel → back to the grid.
            if (pointInRect(click.x, click.y, r.closeX, r.closeY, r.closeW, r.closeH) ||
                !pointInRect(click.x, click.y, r.px, r.py, r.pw, r.ph)) {
                shopDetail = null; playClick(); return;
            }
            // Primary action button (BUY / EQUIP).
            if (pointInRect(click.x, click.y, r.btnX, r.btnY, r.btnW, r.btnH)) {
                if (dOwned) {
                    if (save.selectedSkin === dk) { playClick(); }   // already equipped
                    else {
                        save.selectedSkin = dk; persistSave(); playBuy();
                        lastBoughtMessage = dsk.name + " equipped!"; lastBoughtTimer = 1.5;
                    }
                } else if (save.totalCoins >= dsk.price) {
                    save.totalCoins -= dsk.price;
                    save.ownedSkins.push(dk);
                    save.selectedSkin = dk;
                    persistSave(); playBuy();
                    lastBoughtMessage = dsk.name + " purchased!"; lastBoughtTimer = 1.5;
                } else {
                    playDeny(); lastBoughtMessage = "Not enough coins!"; lastBoughtTimer = 1.2;
                }
                return;
            }
            return;   // absorb any other tap inside the panel
        }

        // Back button
        if (pointInRect(click.x, click.y, 16, 14, 80, 44)) {
            shopDetail = null; state = "menu"; playClick(); return;
        }

        // Tabs (switching tabs closes any open detail view)
        var tabY = 100, tabH = 44, tabW = W / 3;
        if (pointInRect(click.x, click.y, 0, tabY, tabW, tabH)) { shopDetail = null; shopTab = "skins"; playClick(); return; }
        if (pointInRect(click.x, click.y, tabW, tabY, tabW, tabH)) { shopDetail = null; shopTab = "powerups"; playClick(); return; }
        if (pointInRect(click.x, click.y, tabW * 2, tabY, tabW, tabH)) { shopDetail = null; shopTab = "special"; playClick(); return; }

        // Items
        if (shopTab === "skins") {
            var skinKeys = Object.keys(SKINS);
            for (var i = 0; i < skinKeys.length; i++) {
                var col = i % 2, row = Math.floor(i / 2);
                var cx = 20 + col * 230, cy = 165 + row * 145;
                if (pointInRect(click.x, click.y, cx, cy, 210, 130)) {
                    // Tapping a card opens the showroom detail view (buy/equip lives there).
                    shopDetail = skinKeys[i]; shopDetailT = 0; playClick(); return;
                }
            }
        } else if (shopTab === "powerups" || shopTab === "special") {
            // Only the BUY button buys — the whole card is no longer one hitbox.
            // Rects come from the SAME shopCardLayout the draw uses so they can't drift.
            var cards = shopCardLayout(shopTab);
            for (var ci = 0; ci < cards.length; ci++) {
                var c = cards[ci];
                if (!pointInRect(click.x, click.y, c.btnX, c.btnY, c.btnW, c.btnH)) continue;
                if (c.id === "missile") {
                    if (save.totalCoins >= 20) {
                        save.totalCoins -= 20; save.missiles++;
                        persistSave(); playBuy(); buyPopId = "missile"; buyPopTimer = 0.5;
                        lastBoughtMessage = "+1 Missile!"; lastBoughtTimer = 1.2;
                    } else { playDeny(); lastBoughtMessage = "Not enough coins!"; lastBoughtTimer = 1.2; }
                } else if (c.id === "megapack") {
                    if (save.totalCoins >= 80) {
                        save.totalCoins -= 80; save.missiles += 5;
                        persistSave(); playBuy(); buyPopId = "megapack"; buyPopTimer = 0.5;
                        lastBoughtMessage = "+5 Missiles!"; lastBoughtTimer = 1.2;
                    } else { playDeny(); lastBoughtMessage = "Not enough coins!"; lastBoughtTimer = 1.2; }
                } else if (c.id === "pepper") {
                    if (save.totalCoins >= 15) {
                        save.totalCoins -= 15; save.pepperSpray++;
                        persistSave(); playBuy(); buyPopId = "pepper"; buyPopTimer = 0.5;
                        lastBoughtMessage = "+1 Pepper Spray! 🌶️"; lastBoughtTimer = 1.2;
                    } else { playDeny(); lastBoughtMessage = "Not enough coins!"; lastBoughtTimer = 1.2; }
                } else if (c.id === "distracted") {
                    if (save.distractedUnlocked) {
                        lastBoughtMessage = "Already unlocked! Toggle in menu."; lastBoughtTimer = 1.5; playClick();
                    } else if (save.totalCoins >= 1000) {
                        save.totalCoins -= 1000; save.distractedUnlocked = true;
                        persistSave(); playBuy(); buyPopId = "distracted"; buyPopTimer = 0.5;
                        lastBoughtMessage = "Distracted Mode UNLOCKED!"; lastBoughtTimer = 2;
                    } else { playDeny(); lastBoughtMessage = "Need 1000 coins!"; lastBoughtTimer = 1.2; }
                }
                return;
            }
        }
    }

    // ── Easter-egg + pickup art ──────────────────────────────
    function drawHeshyPool(x, y, time) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath(); ctx.ellipse(0, 6, 34, 18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFB300"; // inflatable rim
        ctx.beginPath(); ctx.ellipse(0, 0, 34, 20, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#29B6F6"; // water
        ctx.beginPath(); ctx.ellipse(0, 0, 27, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-14, -2 + Math.sin(time * 4) * 1.5);
        ctx.quadraticCurveTo(0, -6, 14, -2);
        ctx.stroke();
        ctx.fillStyle = "#FF5252"; // beach ball
        ctx.beginPath(); ctx.arc(11, -3, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(11, -3, 5, -0.4, 0.7); ctx.fill();
        ctx.restore();
    }

    function drawHeartPickup(x, y, bob) {
        var s = 1 + Math.sin(bob * 4) * 0.08;
        ctx.save();
        ctx.translate(x, y); ctx.scale(s, s);
        ctx.fillStyle = "rgba(255,64,129,0.25)";
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FF4081";
        ctx.beginPath();
        ctx.moveTo(0, 7);
        ctx.bezierCurveTo(-10, -3, -7, -13, 0, -6);
        ctx.bezierCurveTo(7, -13, 10, -3, 0, 7);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath(); ctx.ellipse(-4, -4, 2.2, 3.2, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function drawFuelCan(x, y, bob) {
        var s = 1 + Math.sin(bob * 4) * 0.08;
        ctx.save();
        ctx.translate(x, y); ctx.scale(s, s);
        ctx.fillStyle = "rgba(255,112,67,0.25)";
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#E53935";
        roundRect(-8, -9, 16, 18, 3); ctx.fill();
        ctx.strokeStyle = "#7A1F1A"; ctx.lineWidth = 1.5; roundRect(-8, -9, 16, 18, 3); ctx.stroke();
        ctx.fillStyle = "#B71C1C"; roundRect(-6, -13, 8, 4, 1); ctx.fill(); // spout
        ctx.fillStyle = "#FFEB3B"; drawText("⛽", 0, 1, "11px Arial", "#FFEB3B", null, 0);
        ctx.restore();
    }

    // Advance warnings painted on the asphalt ahead of road events, so nothing
    // arrives by surprise. Drawn early (under traffic) like real road paint.
    function drawRoadPaintWord(word, y, color) {
        if (y < -24 || y > H + 24) return;
        ctx.save();
        ctx.globalAlpha = 0.66;
        drawText(word, W / 2, y, "bold 26px 'Segoe UI', Arial, sans-serif", color || "#F5F5DC", null, 0);
        ctx.restore();
    }
    function drawRoadChevrons(y) {
        if (y < -30 || y > H + 30) return;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = "#F5F5DC"; ctx.lineWidth = 5; ctx.lineCap = "round";
        for (var l = 0; l < 3; l++) {
            var cxv = LANES[l];
            ctx.beginPath();
            ctx.moveTo(cxv - 14, y + 10); ctx.lineTo(cxv, y - 4); ctx.lineTo(cxv + 14, y + 10);
            ctx.stroke();
        }
        ctx.lineCap = "butt";
        ctx.restore();
    }
    function drawTollWarnings(tb) {
        drawRoadChevrons(tb.y + 180);
        drawRoadPaintWord("TOLL AHEAD", tb.y + 215);
        drawRoadPaintWord("SLOW", tb.y + 370, "#FFE082");
    }
    function drawTrainWarnings(tc) {
        drawRoadPaintWord("R X R", tc.y + 180);
        if (tc.y + 320 > -24 && tc.y + 320 < H + 24) {
            ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = "#F5F5DC"; ctx.lineWidth = 5; ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(W / 2 - 18, tc.y + 304); ctx.lineTo(W / 2 + 18, tc.y + 336);
            ctx.moveTo(W / 2 + 18, tc.y + 304); ctx.lineTo(W / 2 - 18, tc.y + 336);
            ctx.stroke(); ctx.lineCap = "butt"; ctx.restore();
        }
    }

    function drawTollBooth(tb) {
        var y = tb.y, l, lx, open;
        // overhead gantry + legs
        ctx.fillStyle = "#455A64"; ctx.fillRect(ROAD_L - 10, y - 34, 6, 42); ctx.fillRect(ROAD_R + 4, y - 34, 6, 42);
        ctx.fillStyle = "#37474F"; ctx.fillRect(ROAD_L - 10, y - 34, ROAD_W + 20, 12);
        ctx.fillStyle = "#FFD54F"; ctx.fillRect(ROAD_L - 10, y - 34, ROAD_W + 20, 3);
        drawText("TOLL", W / 2, y - 27, "bold 11px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 2);
        for (l = 0; l < 3; l++) {
            lx = LANES[l]; open = tb.open.indexOf(l) !== -1;
            ctx.fillStyle = "#90A4AE"; roundRect(lx - 30, y - 18, 7, 30, 2); ctx.fill(); // booth hut
            // little attendant peeking out of the booth window
            ctx.fillStyle = "#37474F"; ctx.fillRect(lx - 29, y - 14, 5, 9);              // window
            ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(lx - 26, y - 10, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = open ? "#66BB6A" : "#E53935";
            ctx.beginPath(); ctx.arc(lx - 26, y - 22, 3, 0, Math.PI * 2); ctx.fill();      // light
            if (open) {
                // soft green "go" glow + raised gate
                ctx.fillStyle = "rgba(102,187,106,0.35)";
                ctx.beginPath(); ctx.arc(lx - 26, y - 22, 6, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = "#66BB6A"; ctx.lineWidth = 4; ctx.lineCap = "round";
                ctx.beginPath(); ctx.moveTo(lx - 23, y); ctx.lineTo(lx - 15, y - 22); ctx.stroke();
                ctx.lineCap = "butt";
            } else {
                for (var g = 0; g < 6; g++) {
                    ctx.fillStyle = (g % 2) ? "#E53935" : "#FAFAFA";
                    ctx.fillRect(lx - 30 + g * 10, y - 5, 10, 9);
                }
            }
        }
    }

    function drawIceTruck(it) {
        var y = it.y;
        var tx = it.side < 0 ? ROAD_L - 36 : ROAD_R + 36; // parked on the shoulder
        ctx.save();
        ctx.translate(tx, y);
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.beginPath(); ctx.ellipse(2, 5, 26, 36, 0, 0, Math.PI * 2); ctx.fill();
        // box truck: white with a pink wrap
        ctx.fillStyle = "#E0E0E0"; roundRect(-24, -36, 48, 72, 8); ctx.fill();
        ctx.fillStyle = "#FFFFFF"; roundRect(-22, -34, 44, 68, 6); ctx.fill();
        ctx.fillStyle = "#F8BBD0"; roundRect(-22, -10, 44, 20, 0); ctx.fill();
        ctx.strokeStyle = "#AD1457"; ctx.lineWidth = 2; roundRect(-22, -34, 44, 68, 6); ctx.stroke();
        // cab windshield (front toward bottom)
        ctx.fillStyle = "#81D4FA"; roundRect(-16, 18, 32, 12, 4); ctx.fill();
        // serving window facing the road, with the server
        var winX = it.side < 0 ? 14 : -22;
        ctx.fillStyle = "#4FC3F7"; roundRect(winX, -26, 8, 22, 2); ctx.fill();
        ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(winX + 4, -16, 4, 0, Math.PI * 2); ctx.fill();
        // giant cone on the roof
        ctx.fillStyle = "#D7A86E"; ctx.beginPath();
        ctx.moveTo(-7, -36); ctx.lineTo(0, -54); ctx.lineTo(7, -36); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#F8BBD0"; ctx.beginPath(); ctx.arc(0, -36, 8, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#E53935"; ctx.beginPath(); ctx.arc(0, -43, 2.5, 0, Math.PI * 2); ctx.fill();
        drawText("ICE CREAM", 0, 0, "bold 7px 'Segoe UI', Arial, sans-serif", "#AD1457", null, 0);
        // wheels
        ctx.fillStyle = "#222";
        roundRect(-27, -24, 6, 14, 2); ctx.fill(); roundRect(21, -24, 6, 14, 2); ctx.fill();
        roundRect(-27, 12, 6, 14, 2); ctx.fill(); roundRect(21, 12, 6, 14, 2); ctx.fill();
        ctx.restore();
        // kids clustered at the truck
        for (var k = 0; k < it.kids.length; k++) {
            drawPedestrian(tx + it.kids[k].dx, y + it.kids[k].dy, gameTime + k, it.kids[k].type);
        }
        // drifting music notes
        for (var nz = 0; nz < 2; nz++) {
            var nt = (it.noteT * 0.7 + nz * 0.5) % 1.4;
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - nt / 1.4) * 0.8;
            drawText(nz % 2 ? "♪" : "♫", tx + (it.side < 0 ? 20 : -20) + Math.sin(nt * 5) * 6,
                y - 40 - nt * 34, "bold 13px Arial", "#AD1457", null, 0);
            ctx.restore();
        }
        // pulsing scoop marker on the near lane
        if (!it.taken) {
            var ipulse = 1 + Math.sin(gameTime * 6) * 0.18;
            var imx = it.side < 0 ? ROAD_L + 26 : ROAD_R - 26;
            ctx.save(); ctx.translate(imx, y); ctx.scale(ipulse, ipulse);
            ctx.fillStyle = "rgba(248,187,208,0.4)"; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
            drawText(it.side < 0 ? "◀🍦" : "🍦▶", 0, 0, "bold 13px Arial", "#F8BBD0", "#000", 3);
            ctx.restore();
        }
    }

    function drawGuard(x, y) {
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0, 12, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#37474F"; roundRect(-5, 2, 4, 12, 2); ctx.fill(); roundRect(1, 2, 4, 12, 2); ctx.fill();
        ctx.fillStyle = "#FF7043"; roundRect(-8, -8, 16, 16, 4); ctx.fill();         // hi-vis vest
        ctx.fillStyle = "#FFEB3B"; ctx.fillRect(-8, -2, 16, 3);                       // reflective stripe
        ctx.fillStyle = "#FF7043"; roundRect(-11, -6, 4, 10, 2); ctx.fill();          // left arm
        ctx.save(); ctx.translate(8, -6); ctx.rotate(-0.5); ctx.fillStyle = "#FF7043"; roundRect(0, -4, 4, 11, 2); ctx.fill(); ctx.restore(); // raised arm
        ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(0, -14, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FBC02D"; ctx.beginPath(); ctx.arc(0, -15, 7, Math.PI, 0); ctx.fill(); // cap
        ctx.fillStyle = "#F57F17"; ctx.fillRect(-7, -15, 14, 2);
        ctx.restore();
    }
    function drawCrossingGuard(cg) {
        var y = cg.y, gx = cg.side < 0 ? ROAD_L + 14 : ROAD_R - 14;
        for (var k = 0; k < cg.kids.length; k++) drawPedestrian(cg.kids[k].kx, y + cg.kids[k].ky, gameTime + k, cg.kids[k].type);
        drawGuard(gx, y);
        drawStopSign(gx + (cg.side < 0 ? 22 : -22), y - 14, 9); // raised paddle toward the road
        if (cg.commentT > 0 && cg.comment) drawCarComment(gx, y - 26, cg.comment);
    }

    function drawStopSign(cx, cy, r) {
        ctx.save(); ctx.translate(cx, cy);
        ctx.fillStyle = "#D32F2F"; ctx.beginPath();
        for (var i = 0; i < 8; i++) {
            var a = Math.PI / 8 + i * Math.PI / 4, px = Math.cos(a) * r, py = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
        drawText("STOP", 0, 0, "bold 6px Arial", "#fff", null, 0);
        ctx.restore();
    }
    function drawBusStop(bs) {
        var y = bs.y, bx = ROAD_R - 24;
        drawTopBus(bx, y);
        var flash = Math.sin(gameTime * 12) > 0;
        if (bs.signOut) {
            // flashing red lights
            ctx.fillStyle = flash ? "#F44336" : "#7A1F1A";
            ctx.beginPath(); ctx.arc(bx - 14, y - 50, 3, 0, Math.PI * 2); ctx.arc(bx + 14, y - 50, 3, 0, Math.PI * 2); ctx.fill();
            // extended STOP-sign arm into the road
            ctx.strokeStyle = "#212121"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(bx - 24, y); ctx.lineTo(bx - 40, y); ctx.stroke();
            drawStopSign(bx - 52, y, 12);
        }
        // kids getting off
        for (var k = 0; k < bs.kids.length; k++) {
            drawPedestrian(bx + bs.kids[k].dx, y + bs.kids[k].dy, gameTime + k, bs.kids[k].type);
        }
        // Dina waiting by the curb — grab her for a bonus
        if (bs.hasDina && !bs.dinaTaken) {
            var dx = ROAD_R - 88, pulse = 1 + Math.sin(gameTime * 6) * 0.18;
            ctx.save(); ctx.translate(dx, y); ctx.scale(pulse, pulse);
            ctx.fillStyle = "rgba(255,213,79,0.35)"; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            drawText("👧", dx, y - 2, "16px Arial", "#fff", null, 0);
            drawText("DINA!", dx, y + 16, "bold 8px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 2);
        }
        if (bs.commentT > 0 && bs.comment) drawCarComment(bx, y - 24, bs.comment);
    }

    // Soft headlight pools in FRONT of traffic (cars face up the screen) at
    // night / in fog.
    function drawCarHeadlights(x, y) {
        var hy = y - CAR_H / 2;
        var g = ctx.createLinearGradient(0, hy, 0, hy - 58);
        g.addColorStop(0, "rgba(255,246,200,0.30)");
        g.addColorStop(1, "rgba(255,246,200,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 12, hy); ctx.lineTo(x - 24, hy - 58);
        ctx.lineTo(x + 24, hy - 58); ctx.lineTo(x + 12, hy);
        ctx.closePath(); ctx.fill();
    }

    // Blinking amber turn signal while a car is signaling / changing lanes.
    function drawTurnSignal(o) {
        if (Math.sin(gameTime * 16) <= 0) return;   // the "off" half of the blink
        // Sit the lamps on the vehicle's ACTUAL corners — the old fixed offsets
        // were sedan-sized, so a box truck or city bus blinked from mid-body.
        var sx = o.x + o.signalDir * ((o.hitW || 36) / 2 + 2);
        var sy = (o.hitH || 64) / 2 - 4;
        ctx.save();
        ctx.fillStyle = "#FFB300";
        ctx.shadowColor = "#FFC107"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(sx, o.y + sy, 3.4, 0, Math.PI * 2); ctx.fill();  // front corner
        ctx.beginPath(); ctx.arc(sx, o.y - sy, 3.0, 0, Math.PI * 2); ctx.fill();  // rear corner
        ctx.restore();
    }

    // A broken-down car's HAZARD lights — the same amber-lamp look as a turn
    // signal, but flashing all FOUR corners at once.
    function drawHazards(o) {
        if (Math.sin(gameTime * 12) <= 0) return;   // the "off" half of the blink
        var hx = (o.hitW || 36) / 2 + 2;
        var hy = (o.hitH || 64) / 2 - 4;
        ctx.save();
        ctx.fillStyle = "#FFB300";
        ctx.shadowColor = "#FFC107"; ctx.shadowBlur = 8;
        var corners = [[-hx, hy], [hx, hy], [-hx, -hy], [hx, -hy]];
        for (var h = 0; h < 4; h++) {
            ctx.beginPath(); ctx.arc(o.x + corners[h][0], o.y + corners[h][1], 3.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    // A wrecked traffic car (after a fender bender): tilted, scorched, cracked.
    function drawRoadWreck(o) {
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.crashRot || 0);
        drawEnemyCar(0, 0, o.color, o.carType);
        ctx.globalAlpha = 0.42; ctx.fillStyle = "#2B2017";
        ctx.beginPath(); ctx.ellipse(-4, -CAR_H * 0.16, 9, 6, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(5, CAR_H * 0.10, 6, 4, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(232,242,255,0.9)"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-5, -CAR_H * 0.2); ctx.lineTo(0, -CAR_H * 0.04); ctx.lineTo(6, -CAR_H * 0.18);
        ctx.stroke();
        ctx.restore();
    }

    // The roadside drama after a fender bender: arguing drivers + maybe a cop.
    function drawRoadDramas() {
        for (var i = 0; i < roadDramas.length; i++) {
            var d = roadDramas[i];
            var aIn = obstacles.indexOf(d.a) >= 0, bIn = obstacles.indexOf(d.b) >= 0;
            var ay = aIn ? d.a.y : d.b.y;
            // a cop cruiser rolls up beside the wreck, lights flashing
            if (d.cop) {
                var cx = clamp((d.a.x + d.b.x) / 2, ROAD_L + 30, ROAD_R - 30);
                var cy = lerp(ay - 116, ay - 60, d.cop.slide);
                drawCopCar(cx, cy, d.cop.t * 3);
                if (d.cop.lineT > 0) drawCarComment(cx, cy - 28, d.cop.line);
            }
            // the drivers, out of their cars, hollering at each other
            for (var k = 0; k < d.drivers.length; k++) {
                var drv = d.drivers[k];
                if (obstacles.indexOf(drv.car) < 0) continue;
                var dx = clamp(drv.car.x + drv.side * 26, ROAD_L + 14, ROAD_R - 14);
                var dyy = drv.car.y + 6;
                drawAngryMan(dx, dyy, drv.time, "yelling", drv.side, false);
                if (drv.bubbleT > 0) drawSpeechBubble(dx, dyy - 26, drv.bubble, drv.time);
            }
        }
    }

    // Drunk driver: a sickly green haze, a woozy left-right TILT, and a wobbly
    // swerve trail behind — reads as 'this car is all over the road'.
    function drawDrunkCar(o) {
        var tilt = Math.sin(o.swerveT * 4) * 0.13;
        // green woozy aura
        var ag = ctx.createRadialGradient(o.x, o.y, 6, o.x, o.y, CAR_W);
        ag.addColorStop(0, "rgba(124,179,66,0.28)");
        ag.addColorStop(1, "rgba(124,179,66,0)");
        ctx.fillStyle = ag;
        ctx.beginPath(); ctx.arc(o.x, o.y, CAR_W * 0.9, 0, Math.PI * 2); ctx.fill();
        // wobbly swerve trail
        ctx.strokeStyle = "rgba(124,179,66,0.5)"; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath();
        for (var t = 0; t <= 5; t++) {
            var ty = o.y + CAR_H / 2 + t * 9;
            var tx = o.x + Math.sin(o.swerveT * 3 - t * 0.7) * 9;
            if (t === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
        }
        ctx.stroke(); ctx.lineCap = "butt";
        // the car itself, tilted
        ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(tilt);
        drawEnemyCar(0, 0, o.color, o.carType);
        ctx.restore();
        // little hiccup bubbles rising
        var hb = (gameTime * 0.9) % 1;
        ctx.globalAlpha = (1 - hb) * 0.8;
        ctx.fillStyle = "#AED581";
        ctx.beginPath(); ctx.arc(o.x + 13, o.y - 12 - hb * 16, 2.5 + hb * 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }

    // Texting driver: a cool blue phone-glow washing over the windshield, and a
    // tiny screen flicker — looks like a lit phone in their lap.
    function drawTextingCar(o) {
        drawEnemyCar(o.x, o.y, o.color, o.carType);
        var pulse = 0.45 + 0.35 * Math.abs(Math.sin(gameTime * 6));
        var wy = o.y - CAR_H / 2 + 18; // windshield area
        var bg = ctx.createRadialGradient(o.x, wy, 1, o.x, wy, 18);
        bg.addColorStop(0, "rgba(120,200,255," + pulse + ")");
        bg.addColorStop(1, "rgba(120,200,255,0)");
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(o.x, wy, 18, 0, Math.PI * 2); ctx.fill();
        // the bright little screen
        ctx.fillStyle = "rgba(200,235,255," + (0.6 + pulse * 0.4) + ")";
        roundRect(o.x - 3, wy + 2, 6, 9, 1.5); ctx.fill();
    }

    function drawCarComment(x, y, text) {
        var bw = text.length * 5.6 + 14;
        var bx = clamp(x, bw / 2 + 4, W - bw / 2 - 4);
        var by = y - CAR_H / 2 - 16;
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        roundRect(bx - bw / 2, by - 10, bw, 18, 6); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 4, by + 7); ctx.lineTo(x + 5, by + 7); ctx.lineTo(x, by + 13); ctx.closePath(); ctx.fill();
        drawText(text, bx, by - 1, "bold 9px 'Segoe UI', Arial, sans-serif", "#C62828", null, 0);
    }

    function drawTrainCrossing(tc) {
        var y = tc.y, trainW = tc.cars * 60, c, cx;
        // ties + rails across the road
        ctx.fillStyle = "#6D4C41";
        for (var rx = ROAD_L; rx < ROAD_R; rx += 18) ctx.fillRect(rx, y - 13, 5, 26);
        ctx.strokeStyle = "#9E9E9E"; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ROAD_L, y - 9); ctx.lineTo(ROAD_R, y - 9);
        ctx.moveTo(ROAD_L, y + 9); ctx.lineTo(ROAD_R, y + 9); ctx.stroke();
        var active = tc.started && !tc.gone, flash = Math.sin(tc.warnPhase * 12) > 0;
        // crossing signals on both shoulders — twin lamps that alternate
        // left/right like a real railroad crossing, with a glow when lit.
        var posts = [ROAD_L - 6, ROAD_R + 6];
        for (var p = 0; p < 2; p++) {
            ctx.fillStyle = "#FAFAFA"; ctx.fillRect(posts[p] - 2, y - 34, 4, 30);
            // crossbuck
            ctx.strokeStyle = "#FAFAFA"; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(posts[p] - 6, y - 44); ctx.lineTo(posts[p] + 6, y - 32);
            ctx.moveTo(posts[p] + 6, y - 44); ctx.lineTo(posts[p] - 6, y - 32); ctx.stroke();
            for (var lamp = 0; lamp < 2; lamp++) {
                var lit = active && (lamp === 0 ? flash : !flash);
                var lxp = posts[p] + (lamp === 0 ? -5 : 5);
                if (lit) {
                    ctx.fillStyle = "rgba(244,67,54,0.4)";
                    ctx.beginPath(); ctx.arc(lxp, y - 26, 7, 0, Math.PI * 2); ctx.fill();
                }
                ctx.fillStyle = lit ? "#FF5252" : "#7A1F1A";
                ctx.beginPath(); ctx.arc(lxp, y - 26, 3.5, 0, Math.PI * 2); ctx.fill();
            }
        }
        if (active) {
            // Motion streaks trailing the train (behind = opposite its travel dir).
            ctx.save();
            ctx.globalAlpha = 0.35; ctx.strokeStyle = "#E0F7FF"; ctx.lineWidth = 2; ctx.lineCap = "round";
            var tailX = tc.dir > 0 ? tc.trainX - trainW / 2 : tc.trainX + trainW / 2;
            for (var ms = 0; ms < 5; ms++) {
                var msy = y - 16 + ms * 8;
                var msl = 26 + (Math.sin(tc.warnPhase * 20 + ms) + 1) * 12;
                ctx.beginPath();
                ctx.moveTo(tailX - tc.dir * 6, msy);
                ctx.lineTo(tailX - tc.dir * (6 + msl), msy);
                ctx.stroke();
            }
            ctx.restore();

            for (c = 0; c < tc.cars; c++) {
                cx = tc.trainX - trainW / 2 + 30 + c * 60;
                ctx.fillStyle = c === 0 ? "#263238" : ["#C62828", "#1565C0", "#2E7D32", "#6A1B9A", "#EF6C00"][c % 5];
                roundRect(cx - 28, y - 21, 56, 42, 6); ctx.fill();
                ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 2; roundRect(cx - 28, y - 21, 56, 42, 6); ctx.stroke();
                ctx.fillStyle = "#90CAF9"; ctx.fillRect(cx - 18, y - 14, 36, 13);
                // roof rivets / detail line
                ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(cx - 24, y + 4); ctx.lineTo(cx + 24, y + 4); ctx.stroke();
                ctx.fillStyle = "#212121"; ctx.fillRect(cx - 22, y + 16, 10, 6); ctx.fillRect(cx + 12, y + 16, 10, 6);
            }

            // Locomotive smokestack + rising steam puffs (the loco is car 0).
            var locoX = tc.trainX - trainW / 2 + 30;
            ctx.fillStyle = "#1A1A1A"; ctx.fillRect(locoX - 16, y - 28, 7, 8); // stack
            for (var sp = 0; sp < 4; sp++) {
                var spt = (tc.warnPhase * 1.6 + sp * 0.5) % 2;        // 0..2 life
                var spA = clamp(1 - spt / 2, 0, 1);
                if (spA <= 0) continue;
                ctx.fillStyle = "rgba(220,220,225," + (spA * 0.55) + ")";
                ctx.beginPath();
                ctx.arc(locoX - 12 - tc.dir * spt * 10, y - 30 - spt * 16, 4 + spt * 5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Headlight beam at the front of the train.
            var frontX = tc.dir > 0 ? tc.trainX + trainW / 2 : tc.trainX - trainW / 2;
            ctx.save();
            var beam = ctx.createLinearGradient(frontX, y, frontX + tc.dir * 70, y);
            beam.addColorStop(0, "rgba(255,245,180,0.6)");
            beam.addColorStop(1, "rgba(255,245,180,0)");
            ctx.fillStyle = beam;
            ctx.beginPath();
            ctx.moveTo(frontX, y - 4);
            ctx.lineTo(frontX + tc.dir * 70, y - 26);
            ctx.lineTo(frontX + tc.dir * 70, y + 26);
            ctx.lineTo(frontX, y + 4);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#FFF9C4";
            ctx.beginPath(); ctx.arc(frontX, y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    }

    function drawDriveThru(d) {
        var y = d.y;
        var bx = d.side < 0 ? 4 : W - 60, bw = 56, bh = 70;
        var winX = d.side < 0 ? ROAD_L + 26 : ROAD_R - 26;
        // restaurant: cream body, red mansard roof, glass front
        ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(bx + 3, y - 8, bw, bh);
        ctx.fillStyle = "#FFF3E0"; ctx.fillRect(bx, y - 12, bw, bh);
        ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 2; ctx.strokeRect(bx, y - 12, bw, bh);
        ctx.fillStyle = "#D32F2F"; ctx.beginPath();
        ctx.moveTo(bx - 3, y); ctx.lineTo(bx + 6, y - 16); ctx.lineTo(bx + bw - 6, y - 16); ctx.lineTo(bx + bw + 3, y); ctx.closePath(); ctx.fill();
        // glass windows
        ctx.fillStyle = "#81D4FA";
        ctx.fillRect(bx + 6, y + 6, 18, 22); ctx.fillRect(bx + bw - 24, y + 6, 18, 22);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.strokeRect(bx + 6, y + 6, 18, 22); ctx.strokeRect(bx + bw - 24, y + 6, 18, 22);
        // tall pole sign with a burger
        var px = bx + bw / 2;
        ctx.fillStyle = "#9E9E9E"; ctx.fillRect(px - 2, y - 44, 4, 32);
        ctx.fillStyle = "#FFC107"; ctx.beginPath(); ctx.arc(px, y - 50, 13, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#E65100"; ctx.lineWidth = 2; ctx.stroke();
        drawText("🍔", px, y - 49, "15px Arial", "#fff", null, 0);
        // menu board + order speaker near the road edge
        var mbx = d.side < 0 ? bx + bw + 2 : bx - 22;
        ctx.fillStyle = "#263238"; roundRect(mbx, y + 8, 20, 26, 3); ctx.fill();
        ctx.fillStyle = "#FFEB3B"; ctx.fillRect(mbx + 3, y + 11, 14, 2); ctx.fillRect(mbx + 3, y + 16, 14, 2); ctx.fillRect(mbx + 3, y + 21, 10, 2);
        ctx.fillStyle = "#455A64"; ctx.beginPath(); ctx.arc(mbx + 10, y + 30, 3, 0, Math.PI * 2); ctx.fill();
        // pulsing "order here" marker over the edge lane
        if (!d.taken) {
            var pulse = 1 + Math.sin(gameTime * 6) * 0.18;
            ctx.save(); ctx.translate(winX, y); ctx.scale(pulse, pulse);
            ctx.fillStyle = "rgba(255,213,79,0.35)"; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
            drawText(d.side < 0 ? "◀🍔" : "🍔▶", 0, -1, "bold 14px Arial", "#FFEB3B", "#000", 3);
            drawText("ORDER", 0, 14, "bold 8px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2);
            ctx.restore();
        }
    }

    // Flame trail behind Lulu while nitro is active.
    function drawNitroFlame(time) {
        if (nitroTimer <= 0 || !player) return;
        var fx = player.x, fy = player.y + CAR_H / 2 + 4;
        for (var i = 0; i < 3; i++) {
            var fl = 14 + Math.abs(Math.sin(time * 30 + i)) * 16;
            ctx.fillStyle = ["rgba(255,235,59,0.9)", "rgba(255,138,0,0.85)", "rgba(244,67,54,0.7)"][i];
            ctx.beginPath();
            ctx.moveTo(fx - 8 + i * 2, fy);
            ctx.lineTo(fx, fy + fl + i * 6);
            ctx.lineTo(fx + 8 - i * 2, fy);
            ctx.closePath(); ctx.fill();
        }
    }

    // Heshy floats in on his inner tube, waves, and drifts away — pure cameo.
    function drawHeshyCameo(t, dur) {
        var enter = clamp(t / 0.5, 0, 1);
        var exit = clamp((t - (dur - 0.7)) / 0.7, 0, 1);
        var x = lerp(W + 100, W * 0.72, easeOutBack(enter)) + exit * 170;
        var y = H * 0.34 + Math.sin(t * 3) * 7;
        ctx.save();
        ctx.translate(x, y);
        // inner tube (donut float)
        ctx.fillStyle = "#FF80AB";
        ctx.beginPath(); ctx.ellipse(0, 18, 40, 22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        for (var sg = 0; sg < 8; sg++) {
            var a = sg / 8 * Math.PI * 2;
            ctx.beginPath(); ctx.ellipse(Math.cos(a) * 30, 18 + Math.sin(a) * 16, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = "#29B6F6";
        ctx.beginPath(); ctx.ellipse(0, 18, 20, 11, 0, 0, Math.PI * 2); ctx.fill();
        // torso
        ctx.fillStyle = "#FF7043";
        roundRect(-16, -10, 32, 30, 8); ctx.fill();
        // waving arm
        var wave = Math.sin(t * 8) * 0.4;
        ctx.save(); ctx.translate(15, -6); ctx.rotate(-0.7 + wave);
        ctx.fillStyle = "#F0B27A"; roundRect(0, -4, 16, 7, 3); ctx.fill();
        ctx.beginPath(); ctx.arc(17, -1, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // drink in the other hand
        ctx.fillStyle = "#FFEE58"; roundRect(-23, -2, 7, 11, 2); ctx.fill();
        ctx.fillStyle = "#FF5252"; ctx.beginPath(); ctx.arc(-19.5, -3, 2, 0, Math.PI * 2); ctx.fill();
        // head
        ctx.fillStyle = "#F0B27A";
        ctx.beginPath(); ctx.arc(0, -22, 15, 0, Math.PI * 2); ctx.fill();
        // hair
        ctx.fillStyle = "#3E2723";
        ctx.beginPath(); ctx.arc(0, -27, 15, Math.PI, 0); ctx.fill();
        // sunglasses
        ctx.fillStyle = "#111111";
        roundRect(-12, -25, 10, 7, 2); ctx.fill();
        roundRect(2, -25, 10, 7, 2); ctx.fill();
        ctx.fillRect(-2, -23, 4, 2);
        // glint
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillRect(-10, -24, 3, 2);
        // grin
        ctx.strokeStyle = "#7A2A2A"; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(0, -15, 6, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        ctx.lineCap = "butt";
        ctx.restore();

        // banner text
        var alpha = Math.min(1, t * 2) * (1 - exit);
        ctx.globalAlpha = alpha;
        drawText("🏊 Heshy's in the pool", W / 2, H * 0.15,
            "bold 20px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#0277BD", 5);
        drawText("with his shades on 😎", W / 2, H * 0.15 + 28,
            "bold 16px 'Segoe UI', Arial, sans-serif", "#FFE082", "#5D4037", 4);
        ctx.globalAlpha = 1;
    }

    // ── Draw: Playing ────────────────────────────────────────
    function drawPlaying() {
        var onFoot = (state === "footRun") || (state === "paused" && prevState === "footRun");
        if (onFoot && footIntroT > 0) { drawFootIntro(); return; }
        if (onFoot && footArrestT > 0) { drawFootArrest(); return; }
        ctx.save();
        if (shakeTimer > 0) {
            ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        }

        drawRoad(scrollOffset);

        // Billboards (drawn first, behind trees)
        for (var bi = 0; bi < billboards.length; bi++) {
            drawBillboard(billboards[bi].x, billboards[bi].y, billboards[bi].side, billboards[bi].msg, billboards[bi].wanted);
        }

        drawDecorations(gameTime);
        drawCityBuildings();
        drawSidewalkFolk();   // ambient city folk strolling / ducking into shops
        // parked roadside vehicles with their little stories (on the grass shoulder)
        for (var rvd = 0; rvd < roadsideVeh.length; rvd++) drawRoadsideVeh(roadsideVeh[rvd]);

        // Sasquatch easter egg (between decorations and obstacles)
        if (sasquatch) {
            drawSasquatch(sasquatch.x, sasquatch.y, sasquatch.phase, sasquatch.walkTime);
            // Show "HONK!" prompt if in wave phase and on-screen
            if (sasquatch.phase === 1 && sasquatch.y > 100 && sasquatch.y < H - 100) {
                var promptPulse = 1 + Math.sin(gameTime * 6) * 0.1;
                ctx.save();
                ctx.translate(sasquatch.x, sasquatch.y - 50);
                ctx.scale(promptPulse, promptPulse);
                drawText("📣 HONK!", 0, 0, "bold 14px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);
                ctx.restore();
            }
        }

        // Road-paint warnings go down first, like real paint — traffic drives
        // over them, and they announce the toll/train long before it arrives.
        if (tollBooth) drawTollWarnings(tollBooth);
        if (trainCrossing) drawTrainWarnings(trainCrossing);

        for (var i = 0; i < obstacles.length; i++) {
            if (obstacles[i].type === "puddle") drawPuddle(obstacles[i].x, obstacles[i].y);
            else if (obstacles[i].type === "pool") {
                var hp = obstacles[i];
                if (hp.yard) {
                    // his little front yard: a grass pad, a picket fence behind,
                    // and a folding chair — so the pool has an ADDRESS now
                    ctx.save(); ctx.translate(hp.x, hp.y);
                    ctx.fillStyle = "#7CB342"; roundRect(-34, -26, 68, 52, 10); ctx.fill();
                    ctx.fillStyle = "#8BC34A"; roundRect(-30, -22, 60, 44, 8); ctx.fill();
                    ctx.strokeStyle = "#EEE7D0"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
                    for (var pk = -28; pk <= 28; pk += 8) { ctx.beginPath(); ctx.moveTo(pk, -26); ctx.lineTo(pk, -18); ctx.stroke(); }
                    ctx.beginPath(); ctx.moveTo(-30, -22); ctx.lineTo(30, -22); ctx.stroke(); ctx.lineCap = "butt";
                    ctx.fillStyle = "#FF7043"; roundRect(20, 8, 10, 12, 2); ctx.fill();   // folding chair
                    ctx.fillStyle = "#FFAB91"; roundRect(21, 9, 8, 5, 2); ctx.fill();
                    ctx.restore();
                }
                drawHeshyPool(hp.x, hp.y, gameTime);
            }
        }

        for (var j = 0; j < coinEntities.length; j++) {
            if (!coinEntities[j].collected) drawCoin(coinEntities[j].x, coinEntities[j].y, gameTime);
        }
        // Heart pickups (rare extra life)
        for (var hd = 0; hd < heartEntities.length; hd++) {
            if (!heartEntities[hd].collected) drawHeartPickup(heartEntities[hd].x, heartEntities[hd].y, heartEntities[hd].bob);
        }
        // Fuel cans (nitro pickups)
        for (var fd = 0; fd < fuelCans.length; fd++) {
            if (!fuelCans[fd].collected) drawFuelCan(fuelCans[fd].x, fuelCans[fd].y, fuelCans[fd].bob);
        }
        // Pancaked wrecks left behind by the steamroller
        for (var fw = 0; fw < flatWrecks.length; fw++) drawFlatWreck(flatWrecks[fw]);

        // Parking signs (P) and ice cream signs
        for (var psd = 0; psd < parkingSigns.length; psd++) {
            drawParkingSign(parkingSigns[psd].x, parkingSigns[psd].y, parkingSigns[psd].bob);
        }
        for (var icd = 0; icd < iceCreamSigns.length; icd++) {
            drawIceCreamSign(iceCreamSigns[icd].x, iceCreamSigns[icd].y, iceCreamSigns[icd].bob);
        }
        // Salon signs
        for (var sld = 0; sld < salonSigns.length; sld++) {
            drawSalonSign(salonSigns[sld].x, salonSigns[sld].y, salonSigns[sld].bob);
        }
        // Hidden roadside speed-trap cops
        for (var rcd = 0; rcd < roadCops.length; rcd++) drawRoadsideCop(roadCops[rcd]);
        // Roadside hitchhiker (honk to pick up)
        if (hitchhiker) drawHitchhiker(hitchhiker);
        // Avigail walking on the road
        if (avigailWalker) {
            drawAvigailWalker(avigailWalker.x, avigailWalker.y, avigailWalker.walkTime);
            // "REACH ME!" hint
            var apulse = 1 + Math.sin(gameTime * 6) * 0.1;
            ctx.save();
            ctx.translate(avigailWalker.x, avigailWalker.y - 32);
            ctx.scale(apulse, apulse);
            drawText("AVIGAIL!", 0, 0, "bold 12px 'Segoe UI', Arial, sans-serif", "#CE93D8", "#000", 3);
            ctx.restore();
        }
        // 👨 Uncle sighting (rotating cameo) + floating nametag + subtle wave hint
        if (uncleWalker) {
            drawUncle(uncleWalker);
            var uName = "Uncle";
            for (var un = 0; un < UNCLES.length; un++) {
                if (UNCLES[un].id === uncleWalker.id) { uName = UNCLES[un].name; break; }
            }
            // Keep the label + hint on-screen when he's near a shoulder edge.
            var uLabelX = clamp(uncleWalker.x, 46, W - 46);
            drawText(uName, uLabelX, uncleWalker.y - 50,
                "bold 11px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
            if (!uncleWalker.greeted) {
                ctx.save();
                ctx.globalAlpha = 0.6 + Math.sin(gameTime * 6) * 0.2;
                drawText("👋 say hi!", uLabelX, uncleWalker.y - 63,
                    "bold 9px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 2);
                ctx.restore();
            }
        }

        for (var k = 0; k < obstacles.length; k++) {
            if (obstacles[k].type === "cone") drawCone(obstacles[k].x, obstacles[k].y);
        }

        for (var m = 0; m < animals.length; m++) {
            var an = animals[m];
            if (an.type === "duck") drawDuck(an.x, an.y, an.walkTime);
            else if (an.type === "raccoon") drawRaccoon(an.x, an.y, an.walkTime);
            else if (an.type === "ostrich") drawOstrich(an.x, an.y, an.walkTime);
        }

        for (var n = 0; n < obstacles.length; n++) {
            var o = obstacles[n];
            if (o.hidden) continue; // the wrecked car is redrawn by the crash scene
            // Headlights on at night and in fog (drawn under the vehicle)
            if (o.type === "car" && seasonBlend > 0.4 &&
                (season === "night" || season === "fog")) {
                drawCarHeadlights(o.x, o.y);
            }
            if (o.type === "car" && o.behavior === "ambulance") {
                drawAmbulance(o.x, o.y, gameTime);
            } else if (o.type === "car" && o.behavior === "patrol") {
                if (o.k9 && typeof drawK9Car === "function") drawK9Car(o.x, o.y, gameTime);
                else drawCopCar(o.x, o.y, gameTime);
                if (o.commentT > 0 && o.comment) drawCarComment(o.x, o.y, o.comment);
            } else if (o.type === "car" && o.behavior === "bus") {
                drawTopBus(o.x, o.y);
                if (o.commentT > 0 && o.comment) drawCarComment(o.x, o.y - 30, o.comment);
            } else if (o.type === "car" && o.behavior === "dozer") {
                drawSteamroller(o.x, o.y, 0, gameTime);
            } else if (o.type === "car") {
                if (o.crashed) {
                    drawRoadWreck(o);
                } else {
                    if (o.behavior === "pulled") drawCopCar(o.x, o.y + CAR_H + 8, o.copSiren || gameTime);
                    if (o.behavior === "drunk") drawDrunkCar(o);
                    else if (o.behavior === "texting") drawTextingCar(o);
                    else if (o.behavior === "avigail") {
                        // Avigail's purple coupe — sleek dark hair + a gold hoop
                        // visible through the windshield, and a 💅 vanity plate.
                        drawEnemyCar(o.x, o.y, "#7E57C2", 6);
                        ctx.save(); ctx.translate(o.x, o.y);
                        ctx.fillStyle = "#241712"; ctx.beginPath(); ctx.arc(0, -8, 6, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = "#FFE0CC"; ctx.beginPath(); ctx.arc(0, -7, 4.2, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = "#241712"; ctx.beginPath(); ctx.arc(0, -10, 4.6, Math.PI, 0); ctx.fill();
                        ctx.strokeStyle = "#FFD54F"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(4.5, -6, 1.5, 0, Math.PI * 2); ctx.stroke();
                        ctx.fillStyle = "#FFF"; roundRect(-8, 26, 16, 7, 2); ctx.fill();
                        drawText("💅", 0, 30, "7px Arial", "#000", null, 0);
                        ctx.restore();
                    }
                    else drawEnemyCar(o.x, o.y, o.color, o.carType);
                    if (o.changing) drawTurnSignal(o);
                    if (o.mal === "breakdown") drawHazards(o);   // amber four-corner hazards
                }
                if (o.commentT > 0 && o.comment) drawCarComment(o.x, o.y, o.comment);
            }
            else if (o.type === "ped") {
                if (o.sprayed) {
                    // toppled over, clutching their eyes, with a lingering green haze
                    ctx.save();
                    ctx.translate(o.x, o.y + 6);
                    ctx.rotate(1.35);
                    drawPedestrian(0, 0, 0, o.pedType, o.worker, o.drunk, o.cop, o.kid);
                    ctx.restore();
                    ctx.fillStyle = "rgba(156,204,101,0.35)";
                    ctx.beginPath(); ctx.arc(o.x, o.y - 4, 16, 0, Math.PI * 2); ctx.fill();
                } else if (o.kid) {
                    // kids are smaller
                    ctx.save(); ctx.translate(o.x, o.y); ctx.scale(0.72, 0.72);
                    drawPedestrian(0, 0, o.walkTime, o.pedType, false, false, false, true);
                    ctx.restore();
                } else {
                    drawPedestrian(o.x, o.y, o.walkTime, o.pedType, o.worker, o.drunk, o.cop);
                }
                if (o.commentT > 0 && o.comment) drawCarComment(o.x, o.y - 6, o.comment);
            }
        }

        // Fender-bender drama (arguing drivers + any responding cop) over the cars
        if (roadDramas.length) drawRoadDramas();

        // Missiles
        for (var mm = 0; mm < missiles.length; mm++) {
            drawMissile(missiles[mm].x, missiles[mm].y, missiles[mm].time);
        }
        // K9 dogs + cop missiles (high-heat fugitive hazards)
        if (typeof drawCopHazards === "function") drawCopHazards();

        // Toll booth / train crossing / drive-thru / bus stop / crossing guard
        if (iceTruck) drawIceTruck(iceTruck);
        if (crossingGuard) drawCrossingGuard(crossingGuard);
        if (busStop) drawBusStop(busStop);
        if (driveThru) drawDriveThru(driveThru);
        if (tollBooth) drawTollBooth(tollBooth);
        if (trainCrossing) drawTrainCrossing(trainCrossing);

        // Nitro flame trail (under the car)
        if (state !== "crash") drawNitroFlame(gameTime);

        // On foot: parked (stealable) cars + building doors sit in the world.
        if (onFoot) drawFootWorld();

        // Shared Road ghosts — other real players sharing the highway (drawn
        // under Lulu so she always reads on top). Guarded no-op offline.
        if (typeof mpDrawGhosts === "function") { try { mpDrawGhosts(); } catch (e) {} }

        // Player (or crashed car if state === crash; or Lulu on foot)
        if (state === "crash") {
            drawPlayerVehicleAt(crashX, crashY, crashRot, gameTime, false);
        } else if (onFoot) {
            // A soft shield bubble while she has re-entry / knock immunity.
            if (invincibleTimer > 0.35) {
                var sp = 0.5 + 0.5 * Math.sin(gameTime * 9);
                ctx.save();
                ctx.strokeStyle = "rgba(120,200,255," + (0.45 + 0.4 * sp) + ")"; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(player.x, player.y - 4, 26 + sp * 3, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = "rgba(120,200,255,0.12)"; ctx.fill();
                ctx.restore();
            }
            // She blinks while briefly invincible after a knock.
            if (!(invincibleTimer > 0 && Math.sin(gameTime * 22) < 0))
                drawLuluTopDown(player.x, player.y, footWalkTime, footMood);
        } else {
            // ── ONE rig for every ride: each vehicle leans into the steering
            //    (player.tilt) and flickers while invincible, exactly like the
            //    pink car always has. Before this, only Lulu's own car tilted
            //    and blinked — a hailed bus or hotwired taxi sat rigid and gave
            //    NO visual cue at all during the immunity window.
            //    (The pink car keeps its own internal blink via the param.)
            if (!(playerVehicle && invincibleTimer > 0 && Math.sin(gameTime * 22) < 0)) {
                ctx.save();
                ctx.translate(player.x, player.y);
                ctx.rotate(player.tilt || 0);
                if (playerVehicle === "bus") drawTopBus(0, 0);
                else if (playerVehicle === "ambulance") drawAmbulance(0, 0, gameTime);
                else if (playerVehicle === "cop") drawCopCar(0, 0, gameTime * 3);
                else if (playerVehicle === "dozer") drawSteamroller(0, 0, 0, gameTime);
                else if (playerVehicle === "borrowed") drawEnemyCar(0, 0, (borrowedCar && borrowedCar.color) || "#E53935", (borrowedCar && borrowedCar.carType) || 0);
                else drawLuluCar(0, 0, 0, invincibleTimer > 0, gameTime, distractedMode);
                ctx.restore();
            }
            // Deployed STOP sign swinging out from the bus's left side (drawn
            // outside the tilt rig so the arm stays screen-aligned).
            if (playerVehicle === "bus" && busStopT > 0) {
                var ext = clamp((2.8 - busStopT) * 6, 0, 1) * (busStopT < 0.4 ? busStopT / 0.4 : 1);
                var sgx = player.x - 30 - ext * 16, sgy = player.y - 4;
                ctx.strokeStyle = "#616161"; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(player.x - 24, sgy); ctx.lineTo(sgx, sgy); ctx.stroke();
                ctx.save();
                ctx.translate(sgx, sgy);
                ctx.fillStyle = "#E53935"; ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2;
                ctx.beginPath();
                for (var oc = 0; oc < 8; oc++) {
                    var oa = Math.PI / 8 + oc * Math.PI / 4;
                    var px = Math.cos(oa) * 13, py = Math.sin(oa) * 13;
                    if (oc === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath(); ctx.fill(); ctx.stroke();
                drawText("STOP", 0, 1, "bold 8px 'Segoe UI', Arial, sans-serif", "#FFF", null, 0);
                ctx.restore();
            }
        }

        // Heshy cameo (drawn above the car so he floats over the scene)
        if (heshy) drawHeshyCameo(heshy.t, heshy.dur);

        // Chasing cop cruiser + "speed away" HUD
        if (copChase) {
            drawCopCar(copChase.x, player.y + copChase.gap, copChase.siren);
            var copFlash = Math.sin(gameTime * 10) > 0;
            drawText("🚨 SPEED AWAY! 🚨", W / 2, 92,
                "bold 20px 'Segoe UI', Arial, sans-serif", copFlash ? "#FF5252" : "#FFEB3B", "#000", 5);
            var dpct = clamp(copChase.gap / 340, 0, 1);
            ctx.fillStyle = "rgba(0,0,0,0.4)"; roundRect(W / 2 - 70, 104, 140, 8, 4); ctx.fill();
            ctx.fillStyle = dpct > 0.7 ? "#7CFC4F" : "#FF5252";
            roundRect(W / 2 - 68, 106, 136 * dpct, 4, 2); ctx.fill();
        }

        // ── Coin-collect pop rings (scale up + fade) ──
        for (var cpd = 0; cpd < coinPops.length; cpd++) {
            var cpp = coinPops[cpd];
            var cpt = cpp.t / 0.35;
            ctx.save();
            ctx.globalAlpha = (1 - cpt) * 0.8;
            ctx.strokeStyle = "#FFE082";
            ctx.lineWidth = 2.5 * (1 - cpt) + 0.5;
            ctx.beginPath();
            ctx.arc(cpp.x, cpp.y, 6 + cpt * 18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // ── Pepper spray cone (toward the last target) ──
        if (pepperBeam) {
            var pb = pepperBeam, pa = clamp(pb.t / 0.3, 0, 1);
            var ang = Math.atan2(pb.ty - pb.y, pb.tx - pb.x);
            var spread = 0.22;
            ctx.save();
            ctx.globalAlpha = pa * 0.5;
            var pg = ctx.createLinearGradient(pb.x, pb.y, pb.tx, pb.ty);
            pg.addColorStop(0, "rgba(174,213,129,0.9)");
            pg.addColorStop(1, "rgba(124,179,66,0)");
            ctx.fillStyle = pg;
            var len = Math.hypot(pb.tx - pb.x, pb.ty - pb.y) + 16;
            ctx.translate(pb.x, pb.y);
            ctx.rotate(ang);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(len, -len * Math.tan(spread));
            ctx.lineTo(len, len * Math.tan(spread));
            ctx.closePath(); ctx.fill();
            ctx.restore();
        }

        drawParticles();
        drawFloaters();

        // ── Speed lines / motion streaks at high speed ──
        if (gameSpeed > 360) {
            var spInt = Math.min((gameSpeed - 360) / (MAX_SPEED - 360), 1);
            ctx.save();
            ctx.globalAlpha = spInt * 0.35;
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2;
            ctx.lineCap = "round";
            // deterministic-ish streaks driven by scroll so they "rush" downward.
            // Bias toward the road edges so they don't obscure the action.
            for (var sl = 0; sl < 7; sl++) {
                var slx = (sl * 71 + 23) % (W + 40) - 20;
                // skip streaks landing over the central play band (around the lanes)
                if (slx > ROAD_L + 24 && slx < ROAD_R - 24) continue;
                var phase = (scrollOffset * 2.2 + sl * 130) % (H + 160);
                var sly = phase - 80;
                var slen = 30 + spInt * 50;
                ctx.beginPath();
                ctx.moveTo(slx, sly);
                ctx.lineTo(slx, sly + slen);
                ctx.stroke();
            }
            ctx.restore();
        }

        if (flashTimer > 0) {
            ctx.fillStyle = "rgba(255,0,0," + (flashTimer / 0.15 * 0.3) + ")";
            ctx.fillRect(-20, -20, W + 40, H + 40);
        }

        ctx.restore();
        // Season darkness tint + weather + lightning + banner (over world, under HUD)
        drawSeasonFx();
        if (onFoot) { drawFootHUD(); return; }
        drawHUD();

        // Re-entry grace indicator: a soft shield bubble around the car + a
        // "SAFE" countdown, so the player knows they have a moment to react
        // after returning to the road from a sub-world.
        if (invincibleTimer > 1.0) {
            var pulse = 0.5 + 0.5 * Math.sin(gameTime * 10);
            ctx.save();
            ctx.strokeStyle = "rgba(120,200,255," + (0.5 + 0.4 * pulse) + ")";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(player.x, player.y, 44 + pulse * 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = "rgba(120,200,255,0.12)";
            ctx.fill();
            ctx.restore();
            drawText("🛡 SAFE " + Math.ceil(invincibleTimer) + "s", W / 2, 70,
                "bold 16px 'Segoe UI', Arial, sans-serif", "#7CD4FF", "#003", 4);
        }
        // Liquid-courage shield — a bold GOLD bubble that lasts the WHOLE buff, so
        // it's obvious it's still active (the blue re-entry shield only covers the
        // brief grace window, which made the buff look like it died after ~2s).
        if (courageT > 0 && state !== "footRun") {
            var cpz = 0.5 + 0.5 * Math.sin(gameTime * 9);
            ctx.save();
            ctx.strokeStyle = "rgba(255,213,79," + (0.55 + 0.35 * cpz) + ")"; ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.arc(player.x, player.y, 42 + cpz * 4, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = "rgba(255,213,79,0.10)"; ctx.fill();
            ctx.restore();
            // a couple of orbiting sparkles
            for (var cs = 0; cs < 2; cs++) {
                var sa = gameTime * 3 + cs * Math.PI;
                drawText("✦", player.x + Math.cos(sa) * 46, player.y + Math.sin(sa) * 46, "bold 11px Arial", "#FFE082", "#5D4037", 2);
            }
        }
    }

    // ── Draw: Crash ──────────────────────────────────────────
    function drawCrash() {
        drawPlaying();
        ctx.save();
        if (shakeTimer > 0) {
            ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        }

        // The vehicle you smashed — the matching wreck, smoking and tilted.
        if (crashedCar) drawWreck(crashedCar);

        // ── Animal-revenge variant ──────────────────────────────
        if (crashCause && crashCause.kind === "animal") {
            // The victim, belly-up at the point of impact.
            drawDeadAnimal(crashX, crashY, crashCause.animal);
            // Revenge traffic mowing through the mob.
            for (var c = 0; c < crashCars.length; c++) {
                drawEnemyCar(crashCars[c].x, crashCars[c].y, crashCars[c].color, crashCars[c].carType);
            }
            // The furious kin (taunting, or mid-flight after being clipped).
            for (var i = 0; i < animalSwarm.length; i++) {
                var m = animalSwarm[i];
                ctx.save();
                ctx.translate(m.x, m.y);
                if (m.state === "hit") ctx.rotate(m.rot);
                drawCrashAnimal(0, 0, crashCause.animal, m.walkFrame);
                ctx.restore();
                // Stagger the bubbles so 8 critters don't all shout at once.
                if (m.state === "taunt" && m.bubbleT < 1.5) {
                    drawSpeechBubble(m.x, m.y - 26, m.insult, m.ph);
                }
            }
            ctx.restore();
            return;
        }

        // ── Angry-man variant ───────────────────────────────────
        if (!angryMan) { ctx.restore(); return; }
        // Revenge car / cop (if active) — drawn before the man if behind, after if hit
        if (revengeCar && angryMan.state !== "hit") drawRevenge(revengeCar);
        if (angryMan.state !== "hit") {
            var fr = angryMan.faintRot || 0;
            if (fr) {
                // tip the fainting driver over, pivoting at his feet
                ctx.save();
                ctx.translate(angryMan.x, angryMan.y + 18); ctx.rotate(fr); ctx.translate(-angryMan.x, -(angryMan.y + 18));
                drawAngryMan(angryMan.x, angryMan.y, angryMan.time, angryMan.state, angryMan.runDir, angryMan.cop, angryMan.mood, angryMan.hair, angryMan.stype);
                ctx.restore();
                if (fr >= Math.PI / 2) for (var ds = 0; ds < 3; ds++) {
                    var da = gameTime * 4 + ds * 2.1;
                    drawText("💫", angryMan.x + 26 + Math.cos(da) * 10, angryMan.y - 6 + Math.sin(da) * 6, "12px Arial", "#FFD54F", null, 0);
                }
            } else {
                drawAngryMan(angryMan.x, angryMan.y, angryMan.time, angryMan.state, angryMan.runDir, angryMan.cop, angryMan.mood, angryMan.hair, angryMan.stype);
            }
            if ((angryMan.state === "yelling" || crashPhase === 4) && fr < Math.PI / 2) {
                drawSpeechBubble(angryMan.x, angryMan.y - 30, angryYell, angryMan.time);
            }
        }
        if (revengeCar && angryMan.state === "hit") drawRevenge(revengeCar);
        // Hillel the (ex-)insurance adjuster — played as a clean RPG dialogue beat so
        // his claims read clearly instead of competing with the crash chaos: a soft
        // scrim calms the busy wreck behind him, a tidy verdict card shows the math,
        // and his lines land in the standard portrait dialogue box.
        if (hillelAdjuster) {
            var hg = hillelAdjuster;
            ctx.fillStyle = "rgba(8,12,24,0.52)"; ctx.fillRect(0, 0, W, H);
            if (typeof drawHillel === "function") drawHillel(hg.x, hg.y, gameTime, hg.phase >= 1);
            // The fault worksheet as a tidy card above the dialogue box (after the verdict reads).
            if (hg.report && hillelDone(hg.line) && hg.phase >= 2) {
                var wy = H - 128 - 50, wx = 18, ww = W - 36;
                ctx.fillStyle = "rgba(13,27,62,0.94)"; roundRect(wx, wy, ww, 44, 10); ctx.fill();
                ctx.strokeStyle = hg.atFault ? "#EF9A9A" : "#A5D6A7"; ctx.lineWidth = 2; roundRect(wx, wy, ww, 44, 10); ctx.stroke();
                drawText(hg.atFault ? "⚖️ AT FAULT — 💰" + hg.amount + " deductible" : "✅ NOT YOUR FAULT — 💰" + hg.amount + " payout",
                    W / 2, wy + 14, "bold 12px 'Segoe UI', Arial, sans-serif", hg.atFault ? "#FFCDD2" : "#B9F6CA", "#000", 2);
                drawFitText("📐 " + hg.report, W / 2, wy + 32, ww - 18, 10, "#CFE3FF");
            }
            // The clean portrait dialogue box (same one the court/cops use).
            if (typeof drawDialogueBox === "function" && hg.line)
                drawDialogueBox("🧮 HILLEL · claims", hillelTyped(hg.line), "hillel", "#90CAF9", hillelDone(hg.line), !hillelDone(hg.line));
        }
        ctx.restore();
    }

    // Draw the wrecked vehicle that matches what Lulu actually hit (a bus stays
    // a bus, an ambulance an ambulance), with a fixed scorch + cracked-glass overlay.
    function drawWreck(v) {
        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.rotate(v.rot || 0);
        if (v.behavior === "bus") drawTopBus(0, 0);
        else if (v.behavior === "ambulance") drawAmbulance(0, 0, gameTime);
        else if (v.behavior === "patrol") drawCopCar(0, 0, gameTime);
        else drawEnemyCar(0, 0, v.color, v.carType); // "pulled"/drunk/texting = the civilian car body
        // scorch blotches (deterministic — no per-frame flicker)
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = "#2B2017";
        ctx.beginPath(); ctx.ellipse(-4, -CAR_H * 0.18, 10, 7, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(6, CAR_H * 0.10, 7, 5, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // cracked windshield
        ctx.strokeStyle = "rgba(232,242,255,0.9)"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-6, -CAR_H * 0.22); ctx.lineTo(0, -CAR_H * 0.05); ctx.lineTo(7, -CAR_H * 0.20);
        ctx.moveTo(0, -CAR_H * 0.05); ctx.lineTo(2, -CAR_H * 0.30);
        ctx.stroke();
        ctx.restore();
    }

    // A revenge actor is either a regular car or the cop that nabs the angry man.
    function drawRevenge(rc) {
        if (rc.cop) drawCopCar(rc.x, rc.y, gameTime);
        else drawEnemyCar(rc.x, rc.y, rc.color, rc.carType);
    }

    // ── Draw: Parking Intro/Outro (zoom transition) ──────────