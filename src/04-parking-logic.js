    function resetGame() {
        player.x = W / 2; player.targetX = W / 2; player.tilt = 0;
        score = 0; runCoins = 0; lives = MAX_LIVES;
        gameSpeed = BASE_SPEED; scrollOffset = 0; gameTime = 0;
        invincibleTimer = 0; shakeTimer = 0; flashTimer = 0; crashTimer = 0;
        obstacles = []; coinEntities = []; heartEntities = []; animals = []; missiles = []; particles = [];
        fuelCans = []; nitroTimer = 0; wetTimer = 0; tollBooth = null;
        trainCrossing = null; driveThru = null; paradeTimer = 0; busStop = null;
        crossingGuard = null; convoyTimer = 0; convoyNext = 0; iceTruck = null;
        heshy = null;
        spawnClocks = { car: 0, cone: 0, puddle: 0, animal: 0, coin: 0, ped: 0 };
        initSpawnTimers(); // randomized first-appearance per run (see 01b-spawn-tuning.js)
        passengers = []; passengerTimer = 0;
        crashPhase = 0; crashPhaseTimer = 0; angryMan = null; revengeCar = null;
        crashCause = null; crashedCar = null; animalSwarm = []; crashCars = []; crashSmokeT = 0; crashCarT = 0;
        crashReprieve = false; reprieveKind = null;
        parkingSigns = []; parkingSpawnTimer = 25;
        iceCreamSigns = []; iceCreamSpawnTimer = 60;
        sasquatch = null; sasquatchTimer = rand(40, 70);
        billboards = []; billboardTimer = 8;
        copEvent = null; copEventTimer = rand(60, 120);
        roadCops = []; copChase = null; copBust = null;
        honkCooldown = 0;
        kidsInCar = false;
        imaText = null; imaTextTimer = rand(35, 75);
        sasquatchPassenger = 0;
        honkChain = 0; honkChainResetTimer = 0;
        // Avigail + salon
        avigailWalker = null; avigailSpawnTimer = rand(30, 55);
        avigailInCar = false; pointMult = 1;
        salonSigns = []; salonSpawnTimer = rand(40, 70);
        // Reset Dina + parking state leaks (per QA + Bug Hunter)
        parkingChallengeMode = false;
        parkingResult = null; parkingFailHit = null;
        parkingExtras = []; parkedCars = []; parkingPedestrian = null;
        parkingCar = null; parkingZone = null; parkingLevelConfig = null;
        parkingCameras = []; parkingMsgTimer = 0;
        morganHearts = []; morganSparkles = []; morganHappy = 0; morganMood = "calm";
        dinaCoinsRun = 0; dinaStickers = 0; dinaSidewalk = [];
        dinaRunTimer = 0; dinaRunDistance = 0; dinaRunPhase = 0;
        shakeIntensity = 0;
        initSeason();
        initZone();
        initDecorations();
    }

    // ── Spawning ─────────────────────────────────────────────
    // Lane LINES (the gaps between lane centers) — used so cars/cones sometimes
    // sit on the dashed line and you can't just park between lanes forever.
    var LANE_LINES = [ROAD_L + LANE_W, ROAD_L + LANE_W * 2];

    // Decide how an enemy car drives. Calm early on; after some distance (and
    // especially at night / in the bar district) some drivers are DRUNK (big
    // weaving swerves, spilling booze) or TEXTING (gentle distracted drift).
    function pickCarBehavior() {
        if (scrollOffset < 4000) return "normal";
        var drunk = 0.06, texting = 0.10;
        if (typeof season !== "undefined" && season === "night") drunk += 0.10;
        if (typeof zone !== "undefined") {
            if (zone === "bars") drunk += 0.30;
            if (zone === "downtown") texting += 0.16;
        }
        var r = Math.random();
        if (r < drunk) return "drunk";
        if (r < drunk + texting) return "texting";
        return "normal";
    }

    // Emergency vehicle for the hospital zone — fast, flashing, and other cars
    // pull aside as it screams down the road.
    function spawnAmbulance() {
        var lane = randInt(0, 2);
        obstacles.push({
            type: "car", behavior: "ambulance",
            x: LANES[lane], y: -120, color: "#FFFFFF", carType: 0,
            hitW: 38, hitH: 70, speedMult: 2.0, lane: lane, swerveT: 0, spillT: 0
        });
        playTone(900, 0.18, "sine", 0.14, 1320);
        setTimeout(function () { playTone(1320, 0.18, "sine", 0.14, 900); }, 200);
        setTimeout(function () { playTone(900, 0.18, "sine", 0.14, 1320); }, 400);
    }

    function spawnFuel() {
        var x = rand(ROAD_L + 24, ROAD_R - 24);
        fuelCans.push({ x: x, y: -30, hitW: 22, hitH: 24, collected: false, bob: rand(0, 6.28) });
    }

    function spawnTrainCrossing() {
        var dir = Math.random() < 0.5 ? 1 : -1;
        // Short train (2-3 cars) so there's always a cleared side to steer into;
        // it sweeps in immediately as the crossing scrolls down.
        // Spawns high so the "R X R" road paint announces it well in advance.
        trainCrossing = {
            y: -420, dir: dir, started: false, gone: false,
            trainX: dir > 0 ? -200 : W + 200, cars: randInt(2, 3), warnPhase: 0
        };
    }
    function spawnDriveThru() {
        var side = Math.random() < 0.5 ? -1 : 1; // which shoulder the window is on
        driveThru = { y: -150, side: side, taken: false };
    }
    function spawnParadeRunner() {
        var side = Math.random() < 0.5 ? -1 : 1;
        obstacles.push({
            type: "ped", x: side < 0 ? ROAD_L - 12 : ROAD_R + 12, y: rand(-30, H * 0.42),
            vx: -side * rand(60, 115), hitW: 18, hitH: 20, speedMult: 0.2, lane: 1,
            pedType: randInt(0, 2), walkTime: 0
        });
    }

    function spawnTollBooth() {
        var sh = [0, 1, 2];
        for (var i = sh.length - 1; i > 0; i--) { var j = randInt(0, i); var t = sh[i]; sh[i] = sh[j]; sh[j] = t; }
        var openCount = Math.random() < 0.5 ? 1 : 2; // 1-2 lanes open
        // Spawns well above the screen so its painted road warnings ("TOLL
        // AHEAD" / "SLOW") scroll into view first — no more sudden gantry.
        tollBooth = { y: -480, open: sh.slice(0, openCount), paid: false };
    }

    // A cop car cruising the road like normal traffic — but it'll give chase if
    // you speed past it (or blow a school-bus stop sign in its view).
    function spawnPatrolCar() {
        var lane = randInt(0, 2);
        obstacles.push({
            type: "car", behavior: "patrol", x: LANES[lane], y: -100,
            color: "#FFFFFF", carType: 0, hitW: 36, hitH: 64,
            speedMult: Math.random() < 0.4 ? rand(1.3, 1.6) : 0.7,
            lane: lane, spot: 0, swerveT: 0, spillT: 0
        });
    }

    // Water kicked up when Lulu splashes through a puddle.
    function spawnSplash(x, y) {
        for (var i = 0; i < 14; i++) {
            var a = rand(-Math.PI, 0); // upward fan
            particles.push({
                x: x + rand(-14, 14), y: y + 18,
                vx: Math.cos(a) * rand(40, 130), vy: Math.sin(a) * rand(60, 170),
                life: 0.5, maxLife: 0.5, size: rand(2, 4.5),
                color: randPick(["#42A5F5", "#90CAF9", "#BBDEFB", "#E1F5FE"]), gravity: 240
            });
        }
        playTone(280, 0.12, "sine", 0.08, 120);
    }

    function spawnAlcoholDrop(x, y) {
        particles.push({
            x: x + rand(-16, 16), y: y + rand(-6, 18),
            vx: rand(-25, 25), vy: rand(-5, 25), life: 0.9, maxLife: 0.9,
            size: rand(2, 4), color: randPick(["#C8A24B", "#A6792E", "#D4AF5A", "#E8C66A"]),
            gravity: 50
        });
    }

    function spawnObstacle(type) {
        var lane = randInt(0, 2);
        var x = LANES[lane];
        // ~28% of cars/cones straddle a lane line so the lane gaps aren't a
        // permanent safe spot. Everything else gets a little jitter.
        if ((type === "car" || type === "cone") && Math.random() < 0.28) {
            x = randPick(LANE_LINES) + rand(-8, 8);
        } else {
            x += rand(-10, 10);
        }
        var y = -90;
        for (var i = 0; i < obstacles.length; i++) {
            if (Math.abs(obstacles[i].y - y) < 120 && Math.abs(obstacles[i].x - x) < LANE_W) return;
        }
        if (type === "car") {
            var beh = pickCarBehavior();
            // Regular cars only ever drive SLOWER than you — you overtake them
            // (same direction). Only DRUNK drivers can barrel toward you from the
            // opposite direction (fast). Cops/ambulances set their own speeds.
            var sm = rand(0.45, 0.72);
            if (beh === "drunk" && Math.random() < 0.5) sm = rand(1.4, 1.7);
            obstacles.push({
                type: "car", x: x, y: y,
                color: randPick(C.enemyCols),
                carType: randInt(0, 2),
                hitW: 36, hitH: 64,
                speedMult: sm,
                lane: lane,
                behavior: beh,
                swerveT: rand(0, 6.28), spillT: rand(0.2, 0.6)
            });
        } else if (type === "cone") {
            obstacles.push({
                type: "cone", x: x + rand(-15, 15), y: y,
                hitW: 14, hitH: 14, speedMult: 1, lane: lane
            });
        } else if (type === "puddle") {
            obstacles.push({
                type: "puddle", x: x, y: y,
                hitW: 30, hitH: 12, speedMult: 1, lane: lane
            });
        } else if (type === "pool") {
            // Heshy's pool — an Easter-egg "obstacle" that's actually a treat:
            // riding through it summons Heshy and grants a temporary shield.
            obstacles.push({
                type: "pool", x: x, y: y,
                hitW: 34, hitH: 18, speedMult: 1, lane: lane
            });
        } else if (type === "ped") {
            obstacles.push({
                type: "ped", x: x, y: y,
                hitW: 18, hitH: 20, speedMult: 0.5, lane: lane,
                pedType: randInt(0, 2),
                worker: (typeof zone !== "undefined" && zone === "construction"),
                drunk: (typeof zone !== "undefined" && zone === "bars"),
                catcallT: 0,
                walkTime: 0
            });
        }
    }

    function spawnCoin() {
        var x = rand(ROAD_L + 20, ROAD_R - 20);
        var y = -30;
        coinEntities.push({ x: x, y: y, hitW: 16, hitH: 16, collected: false });
    }

    // Rare floating heart → restores a life (or pays out coins if already full).
    function spawnHeart() {
        var x = rand(ROAD_L + 24, ROAD_R - 24);
        heartEntities.push({ x: x, y: -30, hitW: 22, hitH: 22, collected: false, bob: rand(0, 6.28) });
    }

    // Heshy cannonballs into the scene: grant a temp shield + a funny cameo,
    // never costing the player anything (it overlaps gameplay harmlessly).
    function triggerHeshy() {
        heshy = { t: 0, dur: 4.5 };
        invincibleTimer = Math.max(invincibleTimer, 4.5); // shield for the cameo
        spawnFloater(player.x, player.y - 40, "😎 HESHY!", "#4FC3F7");
        // goofy splash + a sunglasses-cool two-note sting
        spawnCoinSparkle(player.x, player.y);
        playTone(523, 0.12, "triangle", 0.2);
        setTimeout(function () { playTone(392, 0.18, "triangle", 0.2); }, 130);
    }

    function spawnCoinLine() {
        var lane = randInt(0, 2);
        var x = LANES[lane];
        var count = randInt(3, 5);
        for (var i = 0; i < count; i++) {
            coinEntities.push({ x: x, y: -30 - i * 40, hitW: 16, hitH: 16, collected: false });
        }
    }

    function spawnAnimal() {
        if (gameTime < 30) return;
        var side = Math.random() > 0.5 ? 1 : -1;
        var y = rand(-60, H * 0.3);
        var animalTypes = ["duck", "raccoon"];
        if (gameTime > 60 || save.distractedUnlocked) animalTypes.push("ostrich");
        animals.push({
            type: randPick(animalTypes),
            x: side > 0 ? ROAD_R + 30 : ROAD_L - 30,
            y: y,
            vx: -side * rand(40, 80),
            hitW: 18, hitH: 14,
            walkTime: 0
        });
    }

    function spawnDuckParade() {
        // Mom + 6 ducklings cross slowly, single file from one side
        var side = Math.random() > 0.5 ? 1 : -1;
        var y = rand(H * 0.25, H * 0.45);
        var startX = side > 0 ? ROAD_R + 40 : ROAD_L - 40;
        var speed = -side * 25; // slow!
        // Mama
        animals.push({
            type: "duck", x: startX, y: y, vx: speed,
            hitW: 22, hitH: 18, walkTime: 0,
            isParade: true, parent: true,
            sayTimer: 4, says: ["Excuse me!", "*quack quack*", "We have right of way!", "Have a blessed day."]
        });
        // 6 ducklings, lined up behind
        for (var i = 0; i < 6; i++) {
            animals.push({
                type: "duck", x: startX + side * (30 + i * 18), y: y + rand(-4, 4),
                vx: speed * rand(0.9, 1.05),
                hitW: 12, hitH: 10, walkTime: rand(0, Math.PI),
                isParade: true, scale: 0.55,
                isLast: i === 5, // last duckling trips
                tripPhase: 0
            });
        }
    }

    function spawnParkingSign() {
        var x = LANES[randInt(0, 2)];
        parkingSigns.push({ x: x, y: -50, hitW: 26, hitH: 26, bob: 0 });
    }

    function spawnIceCreamSign() {
        // Roadside icon (slightly off-road)
        var side = Math.random() > 0.5 ? 1 : -1;
        iceCreamSigns.push({
            x: side > 0 ? ROAD_R + 16 : ROAD_L - 16,
            y: -50, hitW: 30, hitH: 32, bob: 0
        });
    }

    function spawnBillboard() {
        var side = Math.random() > 0.5 ? 1 : -1;
        var msgs = [
            "SLOW DOWN, LULU!",
            "FREE PICKLES NEXT EXIT",
            "OSTRICH CROSSING 500ft",
            "DRIVE LIKE GRANDMA",
            "HONK IF U LOVE COINS",
            "ICE CREAM AHEAD",
            "CAUTION: KIDS w/ FORKS",
            "WANTED: ANGRY OLD MAN",
            "LULU.BOATS",
            "RACCOON YARD SALE TODAY",
            "WASH YOUR CAR. NOW.",
            "BEWARE OF SASQUATCH"
        ];
        billboards.push({
            x: side > 0 ? W - 50 : 50,
            y: -120,
            side: side,
            msg: randPick(msgs),
            parallax: rand(0.7, 0.9)
        });
    }

    function spawnSasquatch() {
        // Brief sighting in the bushes (way off-road, decorative)
        var side = Math.random() > 0.5 ? 1 : -1;
        sasquatch = {
            x: side > 0 ? W - 30 : 30,
            y: -40,
            side: side,
            phase: 0, // 0 walking in, 1 looking around, 2 walking out
            timer: 0,
            walkTime: 0,
            waved: false
        };
    }

    function spawnCop() {
        // Cop event - police car appears from behind with sirens
        copEvent = {
            phase: 0, // 0 approaching, 1 pulled over, 2 questioning, 3 leaving
            timer: 0,
            x: player.x,
            y: H + 80,
            siren: 0,
            dialogue: 0
        };
    }

    function fireMissile() {
        if (save.missiles <= 0) { playDeny(); return; }
        save.missiles--; persistSave();
        missiles.push({ x: player.x, y: player.y - CAR_H / 2, hitW: 14, hitH: 24, time: 0 });
        playMissile();
    }

    var PASSENGER_SHIRT_COLORS = ["#E91E63", "#FFC107", "#43A047", "#2196F3", "#FF5722", "#9C27B0"];
    var PASSENGER_HAIR_COLORS  = ["#FFC107", "#3E2723", "#6D4C41", "#FAFAFA", "#E91E63", "#FF9800"];

    // Driver chatter (speech bubbles over enemy cars, all by chance).
    var DRUNK_QUIPS = ["WOOO!", "*hic* sorry!", "I'm FINE to drive!", "Is it Purim?!",
        "Who moved the road?", "One more lechaim!", "Whose lane is this??", "I see TWO Lulus!",
        "The road is WAVY!", "I'm not drunk, YOU are!", "Designated... nah.", "Wheee, bumper cars!",
        "Which pedal stops?", "Shhh, don't tell Ima.", "I drive BETTER like this!", "*burp* 'scuse me",
        "Is this Mario Kart?", "Left is the new right!", "Lanes are a suggestion!", "I LOVE everybody!",
        "Was that a stop sign?", "Catch me if you can, ociffer!", "My car, my rules!", "Spinny spinny!",
        "I only had... eleven.", "Honk if you love cholent!", "The lines keep MOVING!", "Weee-ooo weee-ooo... no cops right?"];
    var RUDE_QUIPS = ["LEARN TO DRIVE!", "MY LANE!!", "Signal much?!", "Drive like my BUBBE!",
        "Off the road!", "MOVE IT!", "Watch it, lady!", "Oy, this DRIVER..."];
    var DODGE_QUIPS = ["WHOA!", "Yikes!", "Careful!!", "Hey now!", "Meshugga!"];
    var BUS_QUIPS = ["Kids on board!", "Slow it down!", "Beep beep!", "Mind the children!", "No passing!"];
    var BUS_STOP_QUIPS = ["STOP for the bus!", "Kids crossing!!", "You BLEW my sign!", "Where's the FIRE?!", "Report that plate!"];
    var COP_BUS_SNARK = ["Ran a bus sign, huh?", "Cute. PULL OVER.", "Kids were CROSSING!", "That's a big ticket."];
    var GUARD_QUIPS = ["SLOW DOWN!", "Kids crossing!!", "Eyes UP, driver!", "STOP means STOP!", "Not on MY watch!"];

    // Ice-cream truck parked on the shoulder. Kids cluster around it (and a
    // couple more dash ACROSS the road toward it — watch out!). Hug the near
    // lane to grab a scoop for coins. Jingle plays as it appears.
    function spawnIceTruck() {
        var side = Math.random() < 0.5 ? -1 : 1;
        iceTruck = { y: -170, side: side, taken: false, kids: [], noteT: 0 };
        for (var i = 0; i < randInt(2, 3); i++) {
            iceTruck.kids.push({ dx: rand(-22, 22), dy: rand(34, 58), type: randInt(0, 2) });
        }
        var from = -side; // kids run from the far side toward the truck
        for (var k = 0; k < randInt(1, 2); k++) {
            obstacles.push({
                type: "ped", x: from < 0 ? ROAD_L - 12 : ROAD_R + 12, y: rand(-60, 50),
                vx: -from * rand(70, 120), hitW: 18, hitH: 20, speedMult: 0.2, lane: 1,
                pedType: randInt(0, 2), walkTime: 0
            });
        }
        [659, 587, 523, 587, 659, 659, 659].forEach(function (f, i) {
            setTimeout(function () { playTone(f, 0.12, "square", 0.07); }, i * 140);
        });
    }

    function spawnCrossingGuard() {
        var side = Math.random() < 0.5 ? -1 : 1;
        var kids = [], n = randInt(2, 3);
        for (var i = 0; i < n; i++) kids.push({ kx: rand(ROAD_L + 26, ROAD_R - 26), ky: rand(-26, 26), type: randInt(0, 2) });
        crossingGuard = { y: -160, side: side, kids: kids, checked: false, comment: "", commentT: 0 };
    }

    // A bus parked in the right lane dropping kids, stop-sign extended. You must
    // SLOW DOWN (brake) to pass legally — otherwise it's a violation.
    function spawnBusStop() {
        var kids = [], n = randInt(2, 4);
        for (var i = 0; i < n; i++) kids.push({ dx: rand(-40, -16), dy: rand(-34, 54), type: randInt(0, 2) });
        busStop = {
            y: -190, signOut: true, violated: false, checked: false,
            hasDina: Math.random() < 0.3, kids: kids, comment: "", commentT: 0
        };
    }

    function spawnSchoolBus() {
        var lane = randInt(0, 2);
        obstacles.push({
            type: "car", behavior: "bus", x: LANES[lane], y: -150,
            color: "#F9A825", carType: 0, hitW: 40, hitH: 96, speedMult: 0.5,
            lane: lane, comment: "", commentT: 0
        });
    }

    // Names + one-liners shown when Lulu bonks a pedestrian (random each time).
    var KO_NAMES = ["Shua", "Esti", "Random British guy", "Leah"];
    var KO_LINES = [" was knocked down!", " went flying!", " ate dirt!", " got bonked!", " did a backflip!"];

    function pickUpPassenger(ped) {
        spawnFloater(ped.x, ped.y - 26, randPick(KO_NAMES) + randPick(KO_LINES), "#FF8A65");
        passengers.push({
            pedType: ped.pedType,
            shirtColor: PASSENGER_SHIRT_COLORS[ped.pedType % PASSENGER_SHIRT_COLORS.length],
            hairColor: PASSENGER_HAIR_COLORS[ped.pedType % PASSENGER_HAIR_COLORS.length],
            bobOffset: Math.random() * Math.PI * 2
        });
        if (passengers.length > 4) passengers.shift();
        passengerTimer = 30;
        // Fun pickup particles (hearts!)
        for (var i = 0; i < 10; i++) {
            var ang = rand(-Math.PI, 0); // upward
            particles.push({
                x: ped.x, y: ped.y,
                vx: Math.cos(ang) * rand(40, 100),
                vy: Math.sin(ang) * rand(80, 160),
                life: 0.8, maxLife: 0.8,
                size: rand(3, 6),
                color: randPick(["#FF80AB", "#FF4081", "#E91E63", "#FFD700"]),
                gravity: 100
            });
        }
        // Two happy tones
        playTone(523, 0.08, "triangle", 0.2);
        setTimeout(function () { playTone(784, 0.12, "triangle", 0.22); }, 80);
    }

    // ── Parking mini-game trigger + scene setup ──────────────
    function triggerParkingMinigame() {
        // Save state then switch
        prevState = "playing";
        state = "parkingIntro";
        parkingTransitionTimer = parkingTransitionDuration;
        parkingZoom = 1;
        setupParkingScene();
        // happy chime
        playTone(880, 0.08, "sine", 0.18);
        setTimeout(function () { playTone(1175, 0.12, "sine", 0.18); }, 80);
    }

    function setupParkingScene() {
        // Determine config: challenge mode uses level config, casual uses defaults
        parkingLevelConfig = parkingChallengeMode
            ? getParkingLevelConfig(parkingLevel)
            : { level: 0, spotWidth: CAR_H + 20, numCameras: randInt(1, 3), timeLimit: 60,
                theme: "day", coneInSpot: false, pedestrian: false, traffic: false, sasquatchWatcher: false };
        var cfg = parkingLevelConfig;

        // Lulu's car starts to the right of the empty spot, in the driving lane
        parkingCar = {
            x: W - 50, y: H * 0.55,
            rot: -Math.PI,
            speed: 0,
            steerAngle: 0,
            damage: [],
            w: CAR_W, h: CAR_H
        };
        // Empty spot
        var spotCenterX = W / 2;
        parkingZone = {
            x: spotCenterX - cfg.spotWidth / 2,
            y: 168,
            w: cfg.spotWidth,
            h: CAR_W + 16
        };
        parkedCars = [
            { x: parkingZone.x - CAR_H / 2 - 6, y: parkingZone.y + parkingZone.h / 2,
              rot: 0, color: randPick(C.enemyCols), damage: [], w: CAR_W, h: CAR_H },
            { x: parkingZone.x + parkingZone.w + CAR_H / 2 + 6, y: parkingZone.y + parkingZone.h / 2,
              rot: 0, color: randPick(C.enemyCols), damage: [], w: CAR_W, h: CAR_H }
        ];
        // Cameras on the sidewalk
        parkingCameras = [];
        var camPositions = [
            { x: 40, y: 88, poleH: 52 },
            { x: W / 2, y: 88, poleH: 52 },
            { x: W - 40, y: 88, poleH: 52 }
        ];
        var indexes = [0, 1, 2].sort(function () { return Math.random() - 0.5; }).slice(0, cfg.numCameras);
        for (var ci = 0; ci < indexes.length; ci++) {
            var p = camPositions[indexes[ci]];
            parkingCameras.push({ x: p.x, y: p.y, poleH: p.poleH, currentRot: Math.PI / 2 });
        }
        // Optional cone obstacle in the spot
        parkingExtras = [];
        if (cfg.coneInSpot) {
            parkingExtras.push({
                type: "cone",
                x: parkingZone.x + parkingZone.w / 2 + rand(-15, 15),
                y: parkingZone.y + parkingZone.h / 2 + rand(-10, 10),
                hitR: 10
            });
        }
        // Pedestrian walking by
        parkingPedestrian = null;
        if (cfg.pedestrian) {
            parkingPedestrian = {
                x: -20, y: 115, // on the sidewalk
                vx: rand(35, 60),
                walkTime: 0,
                pedType: randInt(0, 2)
            };
        }
        // Reset state
        parkingResult = null;
        parkingResultTimer = 0;
        parkingResultPhase = 0;
        parkingInZoneTimer = 0;
        parkingTimeLeft = cfg.timeLimit;
        parkingScore = 0;
        parkingFlashTimer = 0;
        parkingFailHit = null;
        parkingTouchedCar = false;
        parkingPerfect = true;
    }

    // parkingExtras declared earlier — see top of file

    function updateParkingIntro(dt) {
        parkingTransitionTimer -= dt;
        // Smooth zoom from 1 to 2 then back to 1 during in
        var t = 1 - parkingTransitionTimer / parkingTransitionDuration;
        parkingZoom = 1 + Math.sin(t * Math.PI) * 0.5; // peak in middle
        if (parkingTransitionTimer <= 0) {
            state = "parking";
            parkingZoom = 1;
            // start nice
            playTone(523, 0.08, "triangle", 0.2);
        }
    }

    function updateParking(dt) {
        if (parkingMsgTimer > 0) parkingMsgTimer -= dt;
        updateParticles(dt); // tick collision debris so it animates and clears
        // Pause check
        if (consumePause()) {
            prevState = "parking";
            state = "paused";
            return;
        }
        // Click on pause button
        var click = consumeClick();
        if (click && pointInRect(click.x, click.y, PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, PAUSE_RECT.h)) {
            prevState = "parking"; state = "paused"; playClick(); return;
        }

        // Steering input — keyboard arrows or on-screen ◀ ▶ buttons
        var steerInput = 0;
        if (keys.left) steerInput = -1;
        if (keys.right) steerInput = 1;
        var accelInput = 0;
        if (keys.up) accelInput = 1;
        if (keys.down) accelInput = -1;
        if (distractedMode) {
            accelInput = -accelInput;
            steerInput = -steerInput;
        }

        // Smooth speed (acceleration)
        var maxSpeed = 60;
        parkingCar.speed += accelInput * 90 * dt;
        if (accelInput === 0) {
            // friction
            parkingCar.speed *= Math.pow(0.05, dt);
            if (Math.abs(parkingCar.speed) < 1) parkingCar.speed = 0;
        }
        parkingCar.speed = clamp(parkingCar.speed, -maxSpeed * 0.7, maxSpeed);

        // Steering angle (gradual)
        parkingCar.steerAngle = lerp(parkingCar.steerAngle, steerInput * 0.6, dt * 5);

        // Bicycle model rotation
        if (Math.abs(parkingCar.speed) > 1) {
            var turnRate = (parkingCar.speed / 25) * parkingCar.steerAngle;
            parkingCar.rot += turnRate * dt;
        }

        // Movement
        var newX = parkingCar.x + Math.cos(parkingCar.rot) * parkingCar.speed * dt;
        var newY = parkingCar.y + Math.sin(parkingCar.rot) * parkingCar.speed * dt;

        // World bounds (curb on top, edges on sides, bottom open road)
        newX = clamp(newX, 30, W - 30);
        newY = clamp(newY, 150, H - 50);

        // Collision with parked cars (axis-aligned rough check + apply damage if newly colliding)
        var hadCollision = false;
        for (var pi = 0; pi < parkedCars.length; pi++) {
            var pc = parkedCars[pi];
            // Approximate: rotated rect SAT is complex; use circle approximation
            var pcRadius = 22;
            var luluRadius = 22;
            var dx = newX - pc.x, dy = newY - pc.y;
            var dist2 = dx * dx + dy * dy;
            var combined = pcRadius + luluRadius;
            if (dist2 < combined * combined) {
                // Collision!
                var impactSeverity = Math.abs(parkingCar.speed) / maxSpeed;
                applyCollisionDamage(parkingCar, dx, dy, impactSeverity);
                applyCollisionDamage(pc, -dx, -dy, impactSeverity);
                var pushBack = 4;
                newX = parkingCar.x - Math.cos(parkingCar.rot) * Math.sign(parkingCar.speed) * pushBack;
                newY = parkingCar.y - Math.sin(parkingCar.rot) * Math.sign(parkingCar.speed) * pushBack;
                parkingCar.speed *= -0.3;
                parkingFlashTimer = 0.2;
                // Heavier hits crunch harder — shake + debris scale with impact.
                shakeTimer = 0.2 + impactSeverity * 0.3;
                shakeIntensity = 4 + impactSeverity * 9;
                spawnCrashBurst(pc.x, pc.y, impactSeverity > 0.35);
                playTone(180, 0.18, "sawtooth", 0.18);
                playTone(90, 0.12, "square", 0.10 + impactSeverity * 0.08);
                hadCollision = true;
                parkingTouchedCar = true;
                parkingPerfect = false;
                if (impactSeverity > 0.4) {
                    parkingFailHit = { who: "parked", x: pc.x, y: pc.y, severity: impactSeverity };
                    triggerParkingFail();
                    return;
                }
                break;
            }
        }
        // Curb collision (top)
        if (newY < 150 && parkingCar.speed > 0) {
            applyCollisionDamage(parkingCar, 0, -1, Math.abs(parkingCar.speed) / maxSpeed);
            parkingCar.speed *= -0.3;
            shakeTimer = 0.15; shakeIntensity = 3;
            parkingPerfect = false;
        }

        // Cone collision (knock it over, no damage but +chaos)
        for (var ex = parkingExtras.length - 1; ex >= 0; ex--) {
            var ext = parkingExtras[ex];
            if (ext.type === "cone") {
                var ddx = newX - ext.x, ddy = newY - ext.y;
                if (ddx * ddx + ddy * ddy < (ext.hitR + 22) * (ext.hitR + 22)) {
                    // Boop! Cone is knocked away
                    ext.knocked = true;
                    ext.vx = ddx * 5;
                    ext.vy = ddy * 5;
                    ext.rot = 0;
                    ext.rotVel = rand(-10, 10);
                    parkingExtras.splice(ex, 1);
                    parkingPerfect = false;
                    playTone(220, 0.1, "square", 0.15);
                    // Add a fun "BONK!" particle
                    for (var pp = 0; pp < 8; pp++) {
                        particles.push({
                            x: ext.x, y: ext.y,
                            vx: rand(-80, 80), vy: rand(-80, 20),
                            life: 0.5, maxLife: 0.5,
                            size: rand(2, 4), color: "#FF5722", gravity: 200
                        });
                    }
                }
            }
        }

        // Pedestrian update
        if (parkingPedestrian) {
            parkingPedestrian.x += parkingPedestrian.vx * dt;
            parkingPedestrian.walkTime += dt;
            if (parkingPedestrian.x > W + 30) {
                parkingPedestrian = null;
            } else if (parkingPedestrian) {
                // Collision (pedestrian = passenger pickup OR fail!)
                var pdx = newX - parkingPedestrian.x;
                var pdy = newY - parkingPedestrian.y;
                if (pdx * pdx + pdy * pdy < 25 * 25) {
                    // ouch — instant fail for pedestrian hit
                    parkingFailHit = { who: "pedestrian", x: parkingPedestrian.x, y: parkingPedestrian.y };
                    parkingPedestrian = null;
                    triggerParkingFail();
                    return;
                }
            }
        }

        parkingCar.x = newX;
        parkingCar.y = newY;

        // Cameras track
        for (var c = 0; c < parkingCameras.length; c++) {
            var cam = parkingCameras[c];
            var cdx = parkingCar.x - cam.x;
            var cdy = parkingCar.y - cam.y;
            var targetRot = Math.atan2(cdy, cdx);
            // wrap shortest
            var diffR = targetRot - cam.currentRot;
            while (diffR > Math.PI) diffR -= Math.PI * 2;
            while (diffR < -Math.PI) diffR += Math.PI * 2;
            cam.currentRot += diffR * Math.min(1, dt * 6);
        }

        if (parkingFlashTimer > 0) parkingFlashTimer -= dt;
        if (shakeTimer > 0) shakeTimer -= dt;

        // Check if parked successfully: in zone + slow + roughly horizontal
        var rotMod = ((parkingCar.rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        var horizontalOK = (rotMod < 0.35 || rotMod > Math.PI * 2 - 0.35 ||
                            Math.abs(rotMod - Math.PI) < 0.35);
        var slow = Math.abs(parkingCar.speed) < 8;
        if (carIsInZone(parkingCar) && slow && horizontalOK) {
            parkingInZoneTimer += dt;
            if (parkingInZoneTimer > 0.8) {
                triggerParkingSuccess();
                return;
            }
        } else {
            parkingInZoneTimer = 0;
        }

        // Timer
        var prevTime = parkingTimeLeft;
        parkingTimeLeft -= dt;
        // Low-time panic cue: one urgent beep per second once under 10s
        // (rising pitch as it gets more dire) so players feel the clock.
        if (parkingTimeLeft <= 10 && parkingTimeLeft > 0 &&
            Math.ceil(parkingTimeLeft) !== Math.ceil(prevTime)) {
            var sec = Math.ceil(parkingTimeLeft);
            playTone(sec <= 5 ? 880 : 660, 0.09, "square", 0.14);
        }
        if (parkingTimeLeft <= 0) {
            parkingFailHit = { who: "timeout" };
            triggerParkingFail();
            return;
        }
    }

    function applyCollisionDamage(car, dx, dy, severity) {
        // Convert world impact direction to local
        var localAngle = Math.atan2(dy, dx) - (car.rot + Math.PI / 2);
        var hw = CAR_W / 2, hh = CAR_H / 2;
        // Project to local rectangle edge
        var lx = Math.cos(localAngle), ly = Math.sin(localAngle);
        // Normalize to fit on edge
        var t1 = lx !== 0 ? Math.abs(hw / lx) : 1e9;
        var t2 = ly !== 0 ? Math.abs(hh / ly) : 1e9;
        var t = Math.min(t1, t2);
        var dmgX = lx * t * 0.85;
        var dmgY = ly * t * 0.85;
        car.damage.push({
            x: dmgX, y: dmgY,
            size: 3 + severity * 6,
            rot: localAngle
        });
        if (car.damage.length > 8) car.damage.shift();
    }

    function calcStars() {
        if (parkingPerfect && !parkingTouchedCar) return 3;
        if (!parkingTouchedCar) return 2;
        return 1;
    }

    function triggerParkingSuccess() {
        parkingResult = "success";
        parkingResultPhase = 0;
        parkingResultTimer = 3.0;
        kidsInCar = true;
        state = "parkingResult";
        playTone(523, 0.1, "triangle", 0.2);
        setTimeout(function () { playTone(659, 0.1, "triangle", 0.2); }, 100);
        setTimeout(function () { playTone(784, 0.1, "triangle", 0.2); }, 200);
        setTimeout(function () { playTone(1046, 0.18, "triangle", 0.22); }, 300);

        var stars = calcStars();
        var levelBonus = parkingChallengeMode ? parkingLevel * 25 : 50;
        var starBonus = stars * 15;
        var bonus = levelBonus + starBonus;
        if (parkingChallengeMode) {
            parkingChallengeCoins += bonus;
            parkingChallengeStars += stars;
            save.totalCoins += bonus;
            save.parkingTotalStars += stars;
            if (stars === 3) save.parkingPerfectRuns++;
            if (parkingLevel > save.parkingBestLevel) save.parkingBestLevel = parkingLevel;
        } else {
            runCoins += bonus;
            save.totalCoins += bonus;
            score += 500;
        }
        persistSave();
    }

    function triggerParkingFail() {
        parkingResult = "fail";
        parkingResultPhase = 0;
        parkingResultTimer = 4.0;
        state = "parkingResult";
        playExplosion();
        setTimeout(playWompWomp, 300);
        if (parkingChallengeMode) {
            parkingChallengeLives--;
        } else {
            lives = Math.max(0, lives - 1);
        }
    }

    function updateParkingResult(dt) {
        parkingResultTimer -= dt;
        updateParticles(dt); // let leftover collision debris settle on the result screen

        // Allow skipping the result screen by clicking
        var click = consumeClick();
        if (click && parkingResultTimer > 0.3 && parkingResultPhase === 0) {
            parkingResultTimer = 0.1;
        }

        if (parkingResult === "success") {
            if (parkingResultTimer <= 0 && parkingResultPhase === 0) {
                parkingResultPhase = 1;
                parkingTransitionTimer = parkingTransitionDuration;
            }
            if (parkingResultPhase === 1) {
                parkingTransitionTimer -= dt;
                var t = 1 - parkingTransitionTimer / parkingTransitionDuration;
                parkingZoom = 1 + Math.sin(t * Math.PI) * 0.4;
                if (parkingTransitionTimer <= 0) {
                    parkingZoom = 1;
                    if (parkingChallengeMode) {
                        // Advance to next level
                        parkingLevel++;
                        if (parkingLevel > 10) {
                            // Beat all 10 levels — victory!
                            finishParkingRun(true);
                        } else {
                            startParkingLevel(parkingLevel);
                        }
                    } else {
                        returnToDriving();
                        parkingMsg = "🍦 ICE CREAM TIME! +50 coins";
                        parkingMsgTimer = 3;
                    }
                }
            }
        } else {
            if (parkingResultTimer <= 0 && parkingResultPhase === 0) {
                parkingResultPhase = 1;
                parkingTransitionTimer = parkingTransitionDuration;
            }
            if (parkingResultPhase === 1) {
                parkingTransitionTimer -= dt;
                var t2 = 1 - parkingTransitionTimer / parkingTransitionDuration;
                parkingZoom = 1 + Math.sin(t2 * Math.PI) * 0.4;
                if (parkingTransitionTimer <= 0) {
                    parkingZoom = 1;
                    if (parkingChallengeMode) {
                        if (parkingChallengeLives <= 0) {
                            finishParkingRun(false);
                        } else {
                            // Retry same level
                            startParkingLevel(parkingLevel);
                        }
                    } else if (lives <= 0) {
                        // Out of lives → the car's wrecked, so Lulu sets off on
                        // foot (the "Lulu on Foot" playthrough). Defer the high
                        // score — the foot run can still raise it, and its lose
                        // branch commits it exactly once.
                        parkingZoom = 1;
                        startFootWorld("parkingCrash");
                        return;
                    } else {
                        returnToDriving();
                        parkingMsg = "Better luck next time!";
                        parkingMsgTimer = 2;
                    }
                }
            }
        }
    }

    function startParkingChallenge() {
        parkingChallengeMode = true;
        parkingLevel = 1;
        parkingChallengeLives = 3;
        parkingChallengeStars = 0;
        parkingChallengeCoins = 0;
        kidsInCar = false;
        startParkingLevel(1);
    }

    function startParkingLevel(lvl) {
        parkingLevel = lvl;
        var levelMsgs = [
            "DOWNTOWN BLOCK", "BUSY STREET", "TIGHT SQUEEZE", "CONE ZONE",
            "RUSH HOUR", "DUSK DRIVE", "TIGHT & DARK", "DIAGONAL DANGER",
            "MIDNIGHT PARK", "BOSS LEVEL"
        ];
        parkingLevelIntroText = "Level " + lvl + " · " + levelMsgs[Math.min(lvl - 1, 9)];
        setupParkingScene();
        state = "parkingIntro";
        parkingTransitionTimer = parkingTransitionDuration;
        parkingZoom = 1;
        playTone(880, 0.08, "sine", 0.18);
        setTimeout(function () { playTone(1175, 0.12, "sine", 0.18); }, 80);
    }

    function finishParkingRun(victory) {
        parkingEndStats = {
            level: parkingLevel,
            stars: parkingChallengeStars,
            coins: parkingChallengeCoins,
            victory: victory
        };
        state = "parkingEnd";
    }

    // ── Update: Playing ──────────────────────────────────────