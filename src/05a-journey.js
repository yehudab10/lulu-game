    // ═══════════════════════════════════════════════════════════
    //  THE JOURNEY  — every run is a road trip with named stops you
    //  can actually REACH. Arriving is a warm reward beat + the choice
    //  to end the run as a WIN ("TRIP COMPLETE") or push to a farther
    //  stop. This is a LAYER on top of the endless sim — the driving
    //  loop underneath is 100% untouched.
    // ═══════════════════════════════════════════════════════════

    // dist = the scrollOffset distance for THAT leg (per-leg, not cumulative).
    var TRIP_STOPS = [
        { id: "bubbe",   name: "BUBBE'S HOUSE",   icon: "🏡", dist: 56000, reward: 60,
          task: "Grocery run: collect 40 coins on the way",
          greet: "LULULEH! You made it! Come, EAT — the cholent's hot! 🍲", accent: "#FFCC80" },
        { id: "heshy",   name: "HESHY'S POOL",    icon: "🏊", dist: 74000, reward: 80,
          task: "Impress Heshy: chain 3 close calls",
          greet: "CANNONBAAALL! 💦 ...oh hey Lulu! Towel? Snack? Floatie?", accent: "#80D8FF" },
        { id: "beach",   name: "THE BEACH",       icon: "🏖️", dist: 103000, reward: 100,
          task: "Catch the sisters' runaway beach gear (3)",
          greet: "Salt air, seagulls, zero traffic. You EARNED this, Bruck.", accent: "#FFE082" },
        { id: "avigail", name: "AVIGAIL'S PLACE", icon: "💅", dist: 131000, reward: 125,
          task: "Stay classy: don't bump Avigail's car",
          greet: function () {
              var r = (typeof avigailRel === "function") ? avigailRel() : 50;
              if (r >= 65) return "BESTIE! I made spritzers! 💜";
              if (r <= 35) return "...you drove ALL this way? Obsessed with me much? 💅";
              return "Oh. It's you. Cute car, I guess. Come in, whatever. 💅";
          }, accent: "#CE93D8" },
        { id: "vegas",   name: "VIVA VEGAS",      icon: "🎲", dist: 177000, reward: 200,
          task: "Guard the pot: arrive without losing a heart",
          greet: "You DROVE it?! Lakewood to VEGAS, baby! Mindy, the kids — LULU'S HERE! 🎲", accent: "#A5D6A7" }
    ];

    // ── Run mode ─────────────────────────────────────────────────
    // "cruise" = endless PLAY (no journey layer, auto-connects to Shared Road).
    // "story"  = STORY TRIP (the journey, with persistent checkpoints).
    var runMode = "cruise";

    // Leg-intro banner (STORY only) — a 2.5s centered pop-in at run start.
    var legBannerT = 0, legBannerText = "", legBannerColor = "#FFF", legBannerTask = "", legBannerVibe = "";
    function queueLegIntro() {
        if (runMode !== "story") { legBannerT = 0; legBannerTask = ""; legBannerVibe = ""; return; }
        var stop = TRIP_STOPS[tripStopIdx];
        legBannerT = 2.5;
        legBannerText = "LEG " + (tripStopIdx + 1) + "/5 — NEXT STOP: " + stop.name;
        legBannerColor = stop.accent;
        // Second (smaller) banner line: this chapter's optional TASK (⭐ + coins).
        legBannerTask = stop.task ? ("⭐ " + stop.task) : "";
        // Third (italic) banner line: this chapter SET's directed VIBE.
        var set = STORY_SETS[stop.id];
        legBannerVibe = (set && set.vibe) ? set.vibe : "";
    }

    // ═══════════════════════════════════════════════════════════
    //  CHAPTER SETS — film-style art direction per story leg. Each
    //  leg starts by forcing a SEASON (held for the whole leg) and
    //  biasing zones/population/ambience toward the chapter's mood.
    //  STORY-ONLY: every hook self-guards on runMode === "story", so
    //  cruise/multiplayer stay byte-identical.
    // ═══════════════════════════════════════════════════════════
    var STORY_SETS = {
        bubbe:   { season: "fall",     vibe: "🍂 Friday afternoon — erev Shabbos rush" },
        heshy:   { season: "summer",   vibe: "☀️ high summer — pool weather" },
        beach:   { season: "summer",   vibe: "🌊 sea breeze — gulls overhead" },
        avigail: { season: "dusk",     vibe: "🌆 golden dusk — boutique hour" },
        vegas:   { season: "heatwave", nightAt: 0.55, vibe: "🌵 desert heat → 🌃 neon night" }
    };
    // Per-leg one-shot latch for the Vegas heat→neon flip (reset in armStoryLeg).
    var storyVegasFlipped = false;

    // Force the current leg's directed season. Called from armStoryLeg (KEEP
    // DRIVING advance) AND from resetGame AFTER initSeason() — which resets to
    // summer — so a fresh run's set survives. setSeason blends in smoothly.
    function armStorySeason() {
        if (runMode !== "story") return;
        var set = STORY_SETS[TRIP_STOPS[tripStopIdx].id];
        if (set && set.season && typeof setSeason === "function") setSeason(set.season);
    }

    // HOLD the chapter's directed season: while a story leg is running the random
    // rotation / atmospheric zone pairings in 01-engine-core are suppressed so the
    // set's sky stays put. (typeof-guarded at the call sites since 01 loads first.)
    function storySeasonHold() { return runMode === "story"; }

    // Zone DIRECTION consulted at updateZone's decision points (null in cruise):
    //   {scenic, scenicKind} — bias scenic odds + force a scenic biome
    //   {cityKind}           — prefer a city district (70%)
    //   {ruralGapMul}        — stretch the quiet rural gap
    function storyZoneBias() {
        if (runMode !== "story") return null;
        var id = TRIP_STOPS[tripStopIdx].id;
        if (id === "beach")   return { scenic: 0.75, scenicKind: "beach" };   // coast road, often
        if (id === "avigail") return { cityKind: "downtown" };                // chic boutique district
        if (id === "bubbe")   return { ruralGapMul: 1.3 };                    // longer quiet suburbia
        if (id === "vegas" && storyVegasFlipped) return { cityKind: "bars" }; // the neon strip
        return null;
    }

    // Sidewalk-folk density multiplier (bubbe erev-Shabbos = twice the strollers).
    function storyFolkMul() {
        if (runMode !== "story") return 1;
        return (TRIP_STOPS[tripStopIdx].id === "bubbe") ? 0.5 : 1;
    }

    // Billboard cadence multiplier (Vegas run-in after the neon flip = ×0.4, thick).
    function storyBillboardMul() {
        if (runMode !== "story") return 1;
        return (TRIP_STOPS[tripStopIdx].id === "vegas" && storyVegasFlipped) ? 0.4 : 1;
    }

    // ── STORY MAP launch: which leg the map asked us to drive (−1 = none) ──
    // resetGame (04) seeds tripStopIdx from this when set, else from save.storyStop.
    var storyLaunchLeg = -1;
    // ── CHAPTER TASK: per-leg optional goal, armed at leg start, scored at arrival.
    var storyTask = null;      // { id, goal, ...per-task tracking }
    var storyGear = [];        // beach-leg runaway gear pickups (kite/ball/hat)

    // Per-leg world flavor (STORY only) — a subtle spawn multiplier keyed to the
    // current leg's theme. Returns 1 in cruise mode / for unrelated events.
    function storySpawnBias(name) {
        if (runMode !== "story") return 1;
        var idx = tripStopIdx;
        if (idx === 0) {                                     // Bubbe's House leg (erev Shabbos)
            if (name === "pedestrian") return 1.8;           // busy foot traffic
            if (name === "heart") return 1.3;                // family kindness in the air
        }
        if (idx === 1 && name === "heshyPool") return 3;    // Heshy's Pool leg
        if (idx === 2 && name === "iceCream") return 3;      // The Beach leg
        if (idx === 3 && name === "avigailCar") return 3;    // Avigail's Place leg
        if (idx === 4) {                                     // Viva Vegas leg
            if (name === "toll") return 2;
            if (name === "parade") return 2;
        }
        return 1;
    }

    // ── Run state (reset per run in resetGame) ───────────────────
    var tripStopIdx = 0;          // index into TRIP_STOPS (the leg in progress)
    var tripLegStart = 0;         // scrollOffset when this leg began
    var tripCycle = 0;            // full tours completed → legs ×1.5 each cycle
    var tripArrival = null;       // { stop, t, phase, claimed, newPostcard } while at a stop
    var tripStopsThisRun = 0;     // stops reached this run (for the game-over line)
    var tripPostponeUntil = 0;    // scrollOffset gate after a chase-postponed arrival
    var tripEndedWell = false;    // TRIP COMPLETE flag → recolors the game-over screen
    var tripLastStopName = "";    // name of the most-recent stop reached this run
    var tripPullInT = 0;          // >0 while easing to a crawl into a stop (story) — 0..1.1 then arrival
    var tripMile50 = false;       // per-leg: "halfway" floater fired?
    var tripMile85 = false;       // per-leg: "next exit!" floater fired?

    function tripCycleMult() { return Math.pow(1.5, tripCycle || 0); }
    function tripLegDist() { return TRIP_STOPS[tripStopIdx].dist * tripCycleMult(); }
    function tripRemaining() { return (tripLegStart + tripLegDist()) - scrollOffset; }

    // Greet line may be a plain string or a (relationship-aware) function.
    function tripStopGreet(stop) {
        return (typeof stop.greet === "function") ? stop.greet() : stop.greet;
    }

    // STORY-only arrival beat: a small second line under the greet that advances
    // the plot (the pot, the floatie, Morgan, Avigail, the Vegas surprise).
    function tripStoryBeat(id) {
        if (id === "bubbe")   return "*hands over the POT* Guard it with your LIFE. Or at least both hands.";
        if (id === "heshy")   return "*throws floatie in your trunk* Fountain research, here we come.";
        if (id === "beach")   return "*Morgan is rescued, sandy but fine* Dina says you're a hero.";
        if (id === "avigail") return "*gets in* If anyone asks, I was never stranded.";
        if (id === "vegas")   return "*the whole mishpacha jumps out* SURPRIIIISE! ...wait, WE'RE the surprise!";
        return "";
    }

    // ── Leg progress + arrival trigger (hooked from updatePlaying) ──
    function updateJourney(dt) {
        if (runMode !== "story") return;          // cruise has NO journey layer at all
        if (state !== "playing") return;         // works in BOTH drive & foot mode

        // STORY BEATS layers (all self-guard on story + playing).
        updateStoryCall(dt);
        updateStoryEvent(dt);
        maybeFireStoryEvent();
        if (storyBoonT > 0) storyBoonT -= dt;
        updateStoryGear(dt);   // beach-leg runaway gear (self-guards; no-op elsewhere)
        maybeFireStoryTalk();  // ~35% mid-leg dialogue interlude (opens state "storyTalk")
        if (state === "storyTalk") return;   // interlude took the frame

        // ── ARRIVAL PULL-IN: once triggered, keep her SAFE and let the world coast
        //    to a crawl (the speed damp lives next to parkExit in 05-driving-loop),
        //    then fire the arrival exactly as before once it plays out. ──
        if (tripPullInT > 0) {
            tripPullInT += dt;
            invincibleTimer = Math.max(invincibleTimer, 0.4);
            if (tripPullInT >= 1.1) {
                tripPullInT = 0;
                tripArrival = { stop: TRIP_STOPS[tripStopIdx], t: 0, phase: 0, claimed: false, newPostcard: false };
                state = "arrival";
            }
            return;
        }

        var legD = tripLegDist();
        var rem = tripRemaining();

        // ── LEG MILESTONES (once each): a warm heads-up mid-leg + near the exit. ──
        var stop = TRIP_STOPS[tripStopIdx];
        var prog = clamp(1 - rem / legD, 0, 1);
        if (!tripMile50 && prog >= 0.5 && rem > 0) {
            tripMile50 = true;
            spawnFloater(player.x, player.y - 50, "🏁 halfway to " + stop.name + "!", stop.accent);
            if (typeof playTone === "function") playTone(523, 0.09, "sine", 0.12);
            storyTaskMilestone();   // a light task-progress nudge at the halfway mark
        }
        if (!tripMile85 && prog >= 0.85 && rem > 0) {
            tripMile85 = true;
            spawnFloater(player.x, player.y - 50, stop.icon + " " + stop.name + " — next exit!", stop.accent);
            if (typeof playTone === "function") playTone(659, 0.09, "sine", 0.12);
        }

        // ── VEGAS ARC: the desert-heat first half flips to NEON NIGHT for the
        //    run-in, once, when leg progress crosses the set's nightAt point. ──
        if (stop.id === "vegas" && !storyVegasFlipped) {
            var vset = STORY_SETS.vegas;
            if (prog >= (vset.nightAt || 0.55)) {
                storyVegasFlipped = true;
                if (typeof setSeason === "function") setSeason("night");
                spawnFloater(player.x, player.y - 60, "🌃 the neon skyline rises…", "#B39DDB");
                if (typeof playTone === "function") playTone(392, 0.14, "sine", 0.14);
            }
        }

        // ── CHAPTER-SET AMBIENCE (beach gulls / dusk fireflies) — decorative. ──
        updateStoryAmbient(dt);

        if (rem > 0) return;
        // Fugitive / mid-bust? Can't stop with heat on her — postpone the arrival.
        var heat = (typeof copChase !== "undefined" && copChase) ||
                   (typeof copBust !== "undefined" && copBust) ||
                   (typeof prisonClothes !== "undefined" && prisonClothes);
        if (heat) {
            if (scrollOffset >= tripPostponeUntil) {
                spawnFloater(player.x, player.y - 50, "🚨 can't stop with heat on you! next chance ahead…", "#FF8A80");
                tripLegStart += 8000;               // push this leg's end forward
                tripPostponeUntil = scrollOffset + 8000;  // ...only once per ~8000
            }
            return;
        }
        // Calm at the finish → begin the smooth PULL-IN (replaces the hard cut).
        // The arrival fires from the pull-in branch above once it completes.
        tripPullInT = 0.0001;
    }

    // ── Shared button rects (draw + click never drift) ───────────
    function tripBtnRects() {
        var bw = 240, bx = W / 2 - bw / 2;
        return {
            keep: { x: bx, y: H * 0.80, w: bw, h: 54 },
            end:  { x: bx, y: H * 0.88, w: bw, h: 50 }
        };
    }

    // ── Update: arrival scene ────────────────────────────────────
    function updateArrival(dt) {
        if (!tripArrival) { state = "playing"; return; }
        tripArrival.t += dt;
        updateParticles(dt);

        // Apply rewards exactly ONCE, the frame the scene opens.
        if (!tripArrival.claimed) {
            tripArrival.claimed = true;
            var stop = tripArrival.stop;
            // Snapshot leg-end coins BEFORE the arrival reward so Bubbe's "collect
            // 40 coins on the way" task counts only coins earned driving the leg.
            if (runMode === "story" && storyTask) storyTask.legEndCoins = runCoins;
            runCoins += stop.reward;
            save.totalCoins += stop.reward;
            if (!save.postcards) save.postcards = [];
            if (save.postcards.indexOf(stop.id) < 0) { save.postcards.push(stop.id); tripArrival.newPostcard = true; }
            tripStopsThisRun++;
            tripLastStopName = stop.name;
            if ((save.tripBest || 0) < tripStopsThisRun) save.tripBest = tripStopsThisRun;
            if (stop.id === "avigail" && typeof bumpAvigailRel === "function") bumpAvigailRel(4);
            // STORY checkpoint: reaching a stop banks campaign progress so the NEXT
            // story run resumes from the following leg (dying mid-leg keeps the last
            // reached checkpoint — we write here, at arrival, not at trip end).
            if (runMode === "story") {
                var reached = tripStopIdx;   // 0..4, the leg we just completed
                if (reached >= TRIP_STOPS.length - 1) {   // Vegas — the tour finale
                    // CYCLE RULE: only bank a NEW tour when Vegas was the FRONTIER —
                    // i.e. save.storyStop was already 4 (the leg you unlocked by
                    // clearing chapter 4). A Vegas REPLAY after completion (storyStop
                    // already wrapped to 0, or sitting below 4 because you jumped here
                    // from the map) must NOT re-increment the cycle or wrap again.
                    if ((save.storyStop || 0) >= TRIP_STOPS.length - 1) {
                        save.storyStop = 0;
                        save.storyCycle = (save.storyCycle || 0) + 1;
                        tripArrival.storyComplete = true;
                        tripArrival.tourNum = save.storyCycle + 1;   // the tour just unlocked
                    }
                    // else: replay of an already-cleared Vegas — no cycle bump, no regress.
                } else {
                    // CHECKPOINTS ONLY MOVE FORWARD: replaying an early chapter must
                    // never regress a player who's already further along the tour.
                    if (reached + 1 > (save.storyStop || 0)) save.storyStop = reached + 1;
                }
                // ── CHAPTER TASK scoring: met + unstarred → star + 40💰; met but
                //    already starred → no bonus; not met → a tiny grey note. ──
                if (storyTask) {
                    tripArrival.taskId = storyTask.id;
                    tripArrival.taskMet = storyTaskMet();
                    if (tripArrival.taskMet) {
                        if (!save.storyStars) save.storyStars = {};
                        if (!save.storyStars[storyTask.id]) {
                            save.storyStars[storyTask.id] = true;
                            tripArrival.taskBonus = 40;
                            runCoins += 40; save.totalCoins += 40;
                            tripArrival.taskNewStar = true;
                        } else {
                            tripArrival.taskAlready = true;
                        }
                    }
                }
                // FIRST arrival unlocks endless cruise + the whole Shared Road stack.
                if (!save.cruiseUnlocked) {
                    save.cruiseUnlocked = true;
                    tripArrival.unlockedCruise = true;
                    spawnConfetti(W / 2, H * 0.30, 50);   // an extra celebratory burst
                }
            }
            persistSave();
            playCoin();
            // a warm little arrival jingle (C–E–G)
            playTone(523, 0.12, "sine", 0.18);
            setTimeout(function () { playTone(659, 0.12, "sine", 0.18); }, 120);
            setTimeout(function () { playTone(784, 0.18, "sine", 0.20); }, 240);
            spawnConfetti(W / 2, H * 0.30, 70);
        }
        // gentle ongoing confetti drift
        if (Math.random() < dt * 3) spawnConfetti(rand(W * 0.15, W * 0.85), H * 0.12, 6);
        // extra celebratory drift while the cruise-unlock line is up
        if (tripArrival.unlockedCruise && Math.random() < dt * 4) spawnConfetti(rand(W * 0.2, W * 0.8), H * 0.10, 8);

        var click = consumeClick();
        if (click) {
            // ── ARRIVAL BOON tap (checked BEFORE the buttons; once, while untapped) ──
            if (!tripArrival.boonTaken) {
                var boonR = tripBoonRect();
                if (pointInRect(click.x, click.y, boonR.x, boonR.y, boonR.w, boonR.h)) {
                    tripArrival.boonTaken = true;
                    var binfo = tripBoonInfo(tripStopIdx);
                    tripBoon = { id: binfo.id, label: binfo.label };
                    spawnConfetti(boonR.x + boonR.w / 2, boonR.y + boonR.h / 2, 26);
                    if (typeof playTone === "function") { playTone(659, 0.1, "sine", 0.16); setTimeout(function () { playTone(988, 0.12, "sine", 0.16); }, 90); }
                    // VEGAS dice pays out INSTANTLY (the finale treat) — nothing to apply later.
                    if (binfo.id === "dice") {
                        var roll = randInt(25, 100);
                        runCoins += roll; save.totalCoins += roll; persistSave();
                        spawnFloater(boonR.x + boonR.w / 2, boonR.y - 12, "🎲 rolled +" + roll + " 💰", "#FFD54F");
                        tripBoon.paid = true;
                    }
                    return;   // consume this tap (don't fall through to the buttons)
                }
            }
            var r = tripBtnRects();
            if (pointInRect(click.x, click.y, r.keep.x, r.keep.y, r.keep.w, r.keep.h)) {
                // KEEP DRIVING → advance to the next stop (wrap + cycle mult)
                tripStopIdx++;
                if (tripStopIdx >= TRIP_STOPS.length) { tripStopIdx = 0; tripCycle = (tripCycle || 0) + 1; }
                tripLegStart = scrollOffset;
                tripPostponeUntil = scrollOffset;
                tripPullInT = 0; tripMile50 = false; tripMile85 = false;   // fresh leg → re-arm milestones
                if (typeof armStoryLeg === "function") armStoryLeg();       // arm next leg's call + event
                applyTripBoon();                                            // spend a tapped arrival treat
                tripArrival = null;
                invincibleTimer = Math.max(invincibleTimer, 2.5);
                state = "playing";
                if (typeof playClick === "function") playClick();
                var ns = TRIP_STOPS[tripStopIdx];
                spawnFloater(W / 2, H * 0.42, "NEXT STOP: " + ns.name + " — " + formatNum(Math.round(ns.dist * tripCycleMult())) + "m!", ns.accent);
                return;
            }
            if (pointInRect(click.x, click.y, r.end.x, r.end.y, r.end.w, r.end.h)) {
                // CALL IT A TRIP → a celebratory route through the normal game-over
                // flow. Mirror the ticket-outcome high-score commit so banking is
                // identical to a normal end (bankRunStats fires in updateGameOver).
                tripEndedWell = true;
                if (Math.floor(score) > save.highScore) save.highScore = Math.floor(score);
                persistSave();
                tripArrival = null;
                state = "gameover";
                gameOverAlpha = 0; goScoreShown = 0; goConfettiDone = false;
                spawnConfetti(W / 2, H * 0.30, 90);
                if (typeof Ads !== "undefined" && Ads.onGameOver) Ads.onGameOver();
                if (typeof playClick === "function") playClick();
                return;
            }
        }
    }

    // ── tiny word-wrap for the greet card ────────────────────────
    function tripWrap(txt, font, maxW) {
        ctx.font = font;
        var words = txt.split(" "), lines = [], cur = "";
        for (var i = 0; i < words.length; i++) {
            var test = cur ? cur + " " + words[i] : words[i];
            if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = words[i]; }
            else cur = test;
        }
        if (cur) lines.push(cur);
        return lines;
    }

    // ── Draw: arrival scene ──────────────────────────────────────
    function drawArrival() {
        if (!tripArrival) return;
        var stop = tripArrival.stop;
        var t = tripArrival.t;
        var bob = Math.sin(t * 2) * 4;

        tripDrawBackdrop(stop, t);

        // vignette to frame the readout
        ctx.save();
        var vig = ctx.createRadialGradient(W / 2, H * 0.4, H * 0.2, W / 2, H * 0.4, H * 0.78);
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(1, "rgba(0,0,0,0.5)");
        ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // the character (bobbing)
        tripDrawGreeter(stop, W / 2, H * 0.31 + bob, t);

        // banner
        var pop = easeOutBack(clamp(t / 0.5, 0, 1));
        var finale = !!tripArrival.storyComplete;
        ctx.save();
        ctx.translate(W / 2, H * 0.10);
        ctx.scale(pop, pop);
        drawText(finale ? "🏆 STORY COMPLETE!" : "YOU MADE IT!", 0, 0,
            "bold " + (finale ? 28 : 34) + "px 'Segoe UI', Arial, sans-serif",
            finale ? "#FFD700" : "#FFF", "#5D4037", 6);
        ctx.restore();
        drawText(stop.icon + "  " + stop.name, W / 2, H * 0.155,
            "bold 22px 'Segoe UI', Arial, sans-serif", stop.accent, "#3E2723", 5);
        if (finale) {
            // Backing pill so this reads over the neon VEGAS sign behind it.
            var tourTxt = "TOUR " + tripArrival.tourNum + " unlocked — longer roads, same mishpacha";
            ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
            var tourW = ctx.measureText(tourTxt).width + 24;
            ctx.fillStyle = "rgba(20,12,30,0.78)";
            roundRect(W / 2 - tourW / 2, H * 0.20 - 12, tourW, 24, 12); ctx.fill();
            drawText(tourTxt, W / 2, H * 0.20, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFE082", "#3E2723", 3);
        }

        // greet card (speech quote) — STORY appends a small plot BEAT under the
        // greet; the Vegas FINALE swaps the whole card for the EPILOGUE.
        var cardPadY = 14;
        var cardW = W - 56, cardX = W / 2 - cardW / 2, cardY = H * (finale ? 0.42 : 0.47);
        var block = [];   // {text, font, color, ol, ow, h}
        if (finale) {
            var epiBeat = tripStoryBeat("vegas");
            var epiPara = "The pot made it. The cholent happened. Heshy found the fountains. Avigail caught the bouquet — wrong party, still counts. And Burry cried twice. (He says it was the desert air.)";
            var bF = "italic 12px 'Segoe UI', Arial, sans-serif";
            var pF = "13px 'Segoe UI', Arial, sans-serif";
            var eF = "bold 15px 'Segoe UI', Arial, sans-serif";
            var bl = tripWrap(epiBeat, bF, cardW - 36);
            for (var q0 = 0; q0 < bl.length; q0++) block.push({ text: bl[q0], font: bF, color: "#FFE0B2", ol: "#000", ow: 2, h: 16 });
            var pl = tripWrap(epiPara, pF, cardW - 36);
            for (var q1 = 0; q1 < pl.length; q1++) block.push({ text: pl[q1], font: pF, color: "#FFF5E6", ol: "#000", ow: 3, h: 17 });
            block.push({ text: "THE END — until Tour 2 🎲", font: eF, color: "#FFD54F", ol: "#5D4037", ow: 4, h: 24 });
        } else {
            var greet = tripStopGreet(stop);
            var gFont = "bold 15px 'Segoe UI', Arial, sans-serif";
            var gl = tripWrap(greet, gFont, W - 96);
            for (var g0 = 0; g0 < gl.length; g0++) block.push({ text: gl[g0], font: gFont, color: "#FFF5E6", ol: "#000", ow: 3, h: 21 });
            if (runMode === "story") {
                var beat = tripStoryBeat(stop.id);
                if (beat) {
                    var beF = "italic 12px 'Segoe UI', Arial, sans-serif";
                    var bel = tripWrap(beat, beF, W - 96);
                    for (var b0 = 0; b0 < bel.length; b0++) block.push({ text: bel[b0], font: beF, color: "#FFE0B2", ol: "#000", ow: 2, h: 16 });
                }
            }
        }
        var cardH = cardPadY * 2;
        for (var ch0 = 0; ch0 < block.length; ch0++) cardH += block[ch0].h;
        ctx.fillStyle = "rgba(20,26,38,0.9)";
        roundRect(cardX, cardY, cardW, cardH, 14); ctx.fill();
        ctx.strokeStyle = stop.accent; ctx.lineWidth = 2;
        roundRect(cardX, cardY, cardW, cardH, 14); ctx.stroke();
        // little quote-tail up toward the greeter
        ctx.fillStyle = "rgba(20,26,38,0.9)";
        ctx.beginPath();
        ctx.moveTo(W / 2 - 12, cardY + 1);
        ctx.lineTo(W / 2 + 12, cardY + 1);
        ctx.lineTo(W / 2, cardY - 14);
        ctx.closePath(); ctx.fill();
        var cyText = cardY + cardPadY;
        for (var li = 0; li < block.length; li++) {
            cyText += block[li].h / 2;
            drawText(block[li].text, W / 2, cyText, block[li].font, block[li].color, block[li].ol, block[li].ow);
            cyText += block[li].h / 2;
        }

        // reward line + postcard
        var ry = cardY + cardH + 26;
        drawText("+" + stop.reward + " 💰", W / 2, ry,
            "bold 24px 'Segoe UI', Arial, sans-serif", "#FFD700", "#5D4037", 5);
        if (tripArrival.newPostcard) {
            var pcPulse = 0.9 + 0.1 * Math.sin(t * 6);
            ctx.save(); ctx.translate(W / 2, ry + 26); ctx.scale(pcPulse, pcPulse);
            drawText("📮 postcard collected!", 0, 0,
                "bold 14px 'Segoe UI', Arial, sans-serif", "#80D8FF", "#000", 3);
            ctx.restore();
        } else {
            drawText("stop #" + tripStopsThisRun + " this trip", W / 2, ry + 26,
                "bold 13px 'Segoe UI', Arial, sans-serif", "#B0BEC5", "#000", 2);
        }

        // First-arrival CRUISE UNLOCK — a distinct green line that fits between the
        // reward readout and the two buttons (buttons sit at H*0.80 / H*0.88).
        if (tripArrival.unlockedCruise) {
            var uFont = "bold 12px 'Segoe UI', Arial, sans-serif";
            var uLines = tripWrap("🔓 SHARED ROAD unlocked — cruise with everyone online, back at the menu!", uFont, W - 84);
            var uy = ry + 52;
            for (var ui = 0; ui < uLines.length; ui++) {
                drawText(uLines[ui], W / 2, uy + ui * 17, uFont, "#7CFC4F", "#1B3A1B", 3);
            }
        }

        // CHAPTER TASK result — one compact line above the boon (story only).
        if (tripArrival.taskId) {
            var tky = H * 0.665;
            if (tripArrival.taskNewStar) {
                var tkp = 0.92 + 0.08 * Math.sin(t * 7);
                ctx.save(); ctx.translate(W / 2, tky); ctx.scale(tkp, tkp);
                drawText("⭐ CHAPTER TASK DONE!  +" + tripArrival.taskBonus + " 💰", 0, 0,
                    "bold 15px 'Segoe UI', Arial, sans-serif", "#FFEB3B", "#5D4037", 4);
                ctx.restore();
            } else if (tripArrival.taskAlready) {
                drawText("task done ✓ (already starred)", W / 2, tky,
                    "bold 12px 'Segoe UI', Arial, sans-serif", "#7CFC4F", "#1B3A1B", 3);
            } else if (tripArrival.taskMet === false) {
                drawText("task: not this time", W / 2, tky,
                    "bold 11px 'Segoe UI', Arial, sans-serif", "#90A4AE", "#263238", 2);
            }
        }

        // ARRIVAL BOON — one glowing tappable treat that powers the next leg.
        drawTripBoon(t);

        // buttons
        var r = tripBtnRects();
        drawButton(r.keep.x, r.keep.y, r.keep.w, r.keep.h, "🚗  KEEP DRIVING", { bg: "#66BB6A", bgDark: "#2E7D32" });
        drawButton(r.end.x, r.end.y, r.end.w, r.end.h, "🏁  CALL IT A TRIP", { bg: "#FFC107", bgDark: "#FF6F00", small: true });

        drawParticles();
    }

    // ── Per-stop procedural backdrop (~30-60 lines each) ──────────
    function tripDrawBackdrop(stop, t) {
        if (stop.id === "bubbe") {
            // warm dusk sky + porch with a lit window and steam off a pot
            var g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, "#3E2C4A"); g.addColorStop(0.5, "#8D5A4A"); g.addColorStop(1, "#4A3327");
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            // house
            ctx.fillStyle = "#6D4C41"; ctx.fillRect(W * 0.15, H * 0.24, W * 0.7, H * 0.5);
            ctx.fillStyle = "#4E342E"; ctx.beginPath();
            ctx.moveTo(W * 0.1, H * 0.24); ctx.lineTo(W / 2, H * 0.08); ctx.lineTo(W * 0.9, H * 0.24); ctx.closePath(); ctx.fill();
            // lit window
            ctx.fillStyle = "#FFE082"; ctx.fillRect(W * 0.58, H * 0.32, W * 0.18, H * 0.14);
            ctx.strokeStyle = "#4E342E"; ctx.lineWidth = 3;
            ctx.strokeRect(W * 0.58, H * 0.32, W * 0.18, H * 0.14);
            ctx.beginPath(); ctx.moveTo(W * 0.67, H * 0.32); ctx.lineTo(W * 0.67, H * 0.46);
            ctx.moveTo(W * 0.58, H * 0.39); ctx.lineTo(W * 0.76, H * 0.39); ctx.stroke();
            // door
            ctx.fillStyle = "#3E2723"; ctx.fillRect(W * 0.26, H * 0.5, W * 0.14, H * 0.24);
            // steam off a pot (soft rising blobs)
            for (var s = 0; s < 3; s++) {
                var sp = (t * 0.6 + s * 0.33) % 1;
                ctx.globalAlpha = (1 - sp) * 0.5;
                ctx.fillStyle = "#FFF";
                ctx.beginPath(); ctx.arc(W * 0.31 + Math.sin(sp * 6 + s) * 6, H * 0.5 - sp * 60, 8 - sp * 3, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
        } else if (stop.id === "heshy") {
            // pool blue with an inner tube + sun sparkle
            var g2 = ctx.createLinearGradient(0, 0, 0, H);
            g2.addColorStop(0, "#4FC3F7"); g2.addColorStop(0.45, "#29B6F6"); g2.addColorStop(1, "#0277BD");
            ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
            // pool deck strip
            ctx.fillStyle = "#E1BEE7"; ctx.fillRect(0, H * 0.2, W, H * 0.06);
            // ripples
            ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2;
            for (var rp = 0; rp < 6; rp++) {
                var ry2 = H * 0.4 + rp * 40 + Math.sin(t * 2 + rp) * 4;
                ctx.beginPath();
                for (var xx = 0; xx <= W; xx += 20) ctx.lineTo(xx, ry2 + Math.sin(xx * 0.05 + t * 3 + rp) * 5);
                ctx.stroke();
            }
            // inner tube
            var tx = W * 0.72, ty = H * 0.6 + Math.sin(t * 1.5) * 8;
            ctx.fillStyle = "#FF7043"; ctx.beginPath(); ctx.arc(tx, ty, 42, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.arc(tx, ty, 42, Math.PI * 0.15, Math.PI * 0.65); ctx.arc(tx, ty, 42, Math.PI * 1.15, Math.PI * 1.65); ctx.fill();
            ctx.fillStyle = "#29B6F6"; ctx.beginPath(); ctx.arc(tx, ty, 20, 0, Math.PI * 2); ctx.fill();
        } else if (stop.id === "beach") {
            // sky / sea / sand bands + umbrella
            var g3 = ctx.createLinearGradient(0, 0, 0, H);
            g3.addColorStop(0, "#4FC3F7"); g3.addColorStop(1, "#B3E5FC");
            ctx.fillStyle = g3; ctx.fillRect(0, 0, W, H * 0.45);
            ctx.fillStyle = "#0288D1"; ctx.fillRect(0, H * 0.45, W, H * 0.12);
            ctx.fillStyle = "#039BE5"; ctx.fillRect(0, H * 0.45, W, H * 0.04);
            var g4 = ctx.createLinearGradient(0, H * 0.57, 0, H);
            g4.addColorStop(0, "#FFE082"); g4.addColorStop(1, "#FFCA28");
            ctx.fillStyle = g4; ctx.fillRect(0, H * 0.57, W, H * 0.43);
            // sun
            ctx.fillStyle = "#FFF176"; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.15, 30, 0, Math.PI * 2); ctx.fill();
            // beach umbrella
            var ux = W * 0.28, uy = H * 0.62;
            ctx.strokeStyle = "#795548"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(ux, uy + H * 0.16); ctx.stroke();
            ctx.fillStyle = "#EF5350"; ctx.beginPath(); ctx.arc(ux, uy, 52, Math.PI, 0); ctx.fill();
            ctx.fillStyle = "#FFF";
            for (var uq = 0; uq < 3; uq++) { ctx.beginPath(); ctx.moveTo(ux - 52 + uq * 34, uy); ctx.lineTo(ux - 35 + uq * 34, uy); ctx.lineTo(ux - 52 + uq * 34, uy - 26); ctx.closePath(); ctx.fill(); }
        } else if (stop.id === "avigail") {
            // chic townhouse + heart
            var g5 = ctx.createLinearGradient(0, 0, 0, H);
            g5.addColorStop(0, "#6A1B9A"); g5.addColorStop(1, "#CE93D8");
            ctx.fillStyle = g5; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "#F8BBD0"; ctx.fillRect(W * 0.2, H * 0.22, W * 0.6, H * 0.52);
            ctx.fillStyle = "#AD1457"; ctx.fillRect(W * 0.2, H * 0.22, W * 0.6, H * 0.05);
            // fancy door
            ctx.fillStyle = "#4A148C"; ctx.fillRect(W * 0.42, H * 0.5, W * 0.16, H * 0.24);
            ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.arc(W * 0.56, H * 0.62, 3, 0, Math.PI * 2); ctx.fill();
            // windows
            ctx.fillStyle = "#B39DDB";
            ctx.fillRect(W * 0.26, H * 0.32, W * 0.12, H * 0.12);
            ctx.fillRect(W * 0.62, H * 0.32, W * 0.12, H * 0.12);
            // floating heart
            var hy = H * 0.14 + Math.sin(t * 2) * 6;
            ctx.fillStyle = "#EC407A";
            tripHeart(W / 2, hy, 18);
        } else { // vegas
            var g6 = ctx.createLinearGradient(0, 0, 0, H);
            g6.addColorStop(0, "#0D0221"); g6.addColorStop(0.6, "#311B4D"); g6.addColorStop(1, "#5D4037");
            ctx.fillStyle = g6; ctx.fillRect(0, 0, W, H);
            // desert stars
            for (var st2 = 0; st2 < 40; st2++) {
                ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(t * 2 + st2));
                ctx.fillStyle = "#FFF";
                ctx.fillRect((st2 * 97) % W, (st2 * 53) % (H * 0.4), 2, 2);
            }
            ctx.globalAlpha = 1;
            // neon VEGAS sign
            var neon = 0.6 + 0.4 * Math.abs(Math.sin(t * 5));
            ctx.save(); ctx.shadowColor = "#FFD54F"; ctx.shadowBlur = 18 * neon;
            drawText("VEGAS", W / 2, H * 0.2, "bold 44px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#B71C1C", 4);
            ctx.restore();
            // dice
            tripDie(W * 0.24, H * 0.7 + Math.sin(t * 2) * 5, 30, 5);
            tripDie(W * 0.74, H * 0.72 + Math.cos(t * 2) * 5, 30, 3);
        }
    }

    function tripHeart(cx, cy, s) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.9);
        ctx.bezierCurveTo(cx - s * 1.4, cy - s * 0.4, cx - s * 0.5, cy - s * 1.1, cx, cy - s * 0.35);
        ctx.bezierCurveTo(cx + s * 0.5, cy - s * 1.1, cx + s * 1.4, cy - s * 0.4, cx, cy + s * 0.9);
        ctx.closePath(); ctx.fill();
    }

    function tripDie(cx, cy, s, pips) {
        ctx.fillStyle = "#FFF"; roundRect(cx - s / 2, cy - s / 2, s, s, 6); ctx.fill();
        ctx.strokeStyle = "#B71C1C"; ctx.lineWidth = 2; roundRect(cx - s / 2, cy - s / 2, s, s, 6); ctx.stroke();
        ctx.fillStyle = "#B71C1C";
        var q = s * 0.26;
        var spots = { 3: [[-1, -1], [0, 0], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]] };
        var p = spots[pips] || spots[5];
        for (var i = 0; i < p.length; i++) {
            ctx.beginPath(); ctx.arc(cx + p[i][0] * q, cy + p[i][1] * q, s * 0.09, 0, Math.PI * 2); ctx.fill();
        }
    }

    // The greeter for each stop. bubbe/avigail reuse drawPortrait; vegas uses
    // Uncle Burry + a Mindy-and-kids cluster; heshy is a fresh swim-cap head;
    // the beach needs no person (a seagull says it all).
    function tripDrawGreeter(stop, cx, cy, t) {
        var talking = Math.sin(t * 5) > 0;
        if (stop.id === "bubbe") {
            drawPortrait("bubbe", cx, cy, 96, talking);
        } else if (stop.id === "avigail") {
            drawPortrait("avigail", cx, cy, 96, talking);
        } else if (stop.id === "vegas") {
            drawPortrait("burry", cx, cy, 92, talking);
            // little Mindy + kids cluster beside him
            tripMiniPerson(cx - 78, cy + 34, 0.55, "#E91E63", "#4E342E");
            tripMiniPerson(cx + 74, cy + 40, 0.4, "#FDD835", "#3E2723");
            tripMiniPerson(cx + 96, cy + 44, 0.36, "#42A5F5", "#5D4037");
        } else if (stop.id === "heshy") {
            tripDrawHeshy(cx, cy, t);
        } else { // beach — a seagull gliding
            var gx = cx + Math.sin(t) * 40;
            ctx.strokeStyle = "#FFF"; ctx.lineWidth = 5; ctx.lineCap = "round";
            var flap = Math.sin(t * 6) * 12;
            ctx.beginPath();
            ctx.moveTo(gx - 34, cy + flap); ctx.lineTo(gx, cy - 6); ctx.lineTo(gx + 34, cy + flap); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(gx - 30, cy + 20 + flap); ctx.lineTo(gx, cy + 6); ctx.lineTo(gx + 30, cy + 20 + flap); ctx.stroke();
        }
    }

    // Simple stand-in person (Mindy / kids at Vegas).
    function tripMiniPerson(cx, cy, sc, shirt, hair) {
        ctx.fillStyle = shirt; roundRect(cx - 12 * sc, cy, 24 * sc, 30 * sc, 6 * sc); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(cx, cy - 10 * sc, 13 * sc, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(cx, cy - 14 * sc, 13 * sc, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(cx - 4 * sc, cy - 10 * sc, 2 * sc, 0, Math.PI * 2); ctx.arc(cx + 4 * sc, cy - 10 * sc, 2 * sc, 0, Math.PI * 2); ctx.fill();
    }

    // Fresh Heshy head with a green swim cap (chunky cartoon).
    function tripDrawHeshy(cx, cy, t) {
        // shoulders
        ctx.fillStyle = "#0288D1"; roundRect(cx - 34, cy + 20, 68, 40, 12); ctx.fill();
        // head
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.stroke();
        // green swim cap
        ctx.fillStyle = "#43A047"; ctx.beginPath(); ctx.arc(cx, cy - 2, 31, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
        ctx.fillStyle = "#2E7D32"; ctx.fillRect(cx - 31, cy - 6, 62, 4);
        // goggles pushed up
        ctx.strokeStyle = "#0277BD"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx - 11, cy - 16, 8, 0, Math.PI * 2); ctx.arc(cx + 11, cy - 16, 8, 0, Math.PI * 2); ctx.stroke();
        // eyes + big grin
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(cx - 10, cy, 3.5, 0, Math.PI * 2); ctx.arc(cx + 10, cy, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#B71C1C"; ctx.lineWidth = 3; ctx.lineCap = "round";
        var mo = Math.sin(t * 5) > 0 ? 8 : 4;
        ctx.beginPath(); ctx.arc(cx, cy + 8, 12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        ctx.fillStyle = "#B71C1C"; ctx.beginPath(); ctx.arc(cx, cy + 8 + mo * 0.3, mo * 0.6, 0, Math.PI); ctx.fill();
    }

    // ── HUD journey pill (called from drawHUD) ───────────────────
    function drawJourneyPill() {
        if (typeof tripStopIdx === "undefined" || typeof TRIP_STOPS === "undefined") return;
        if (runMode !== "story") return;          // cruise shows no distance pill
        if (state !== "playing") return;
        // Yield the center-top strip to any active buff/gauge so nothing overlaps.
        if (typeof playerVehicle !== "undefined" && playerVehicle === "dozer" && typeof dozerTimer !== "undefined" && dozerTimer > 0) return;
        if ((typeof nitroTimer !== "undefined" && nitroTimer > 0) ||
            (typeof courageT !== "undefined" && courageT > 0) ||
            (typeof passengerTimer !== "undefined" && passengerTimer > 0) ||
            (typeof carMalfunction !== "undefined" && carMalfunction) ||
            (typeof distractedMode !== "undefined" && distractedMode)) return;

        var stop = TRIP_STOPS[tripStopIdx];
        var legD = stop.dist * tripCycleMult();
        var rem = (tripLegStart + legD) - scrollOffset;
        if (rem < 0) rem = 0;
        var prog = clamp(1 - rem / legD, 0, 1);
        var close = rem <= 2500;
        var pulling = (typeof tripPullInT !== "undefined" && tripPullInT > 0);
        var pulse = (close || pulling) ? (1 + 0.05 * Math.sin(gameTime * 8)) : 1;
        // ~15% smaller + a softer bg — the owner found the old pill a touch distracting.
        var pw = 133, ph = 19, px = W / 2 - pw / 2, py = 46;

        ctx.save();
        if (pulse !== 1) { ctx.translate(W / 2, py + ph / 2); ctx.scale(pulse, pulse); ctx.translate(-(W / 2), -(py + ph / 2)); }
        ctx.fillStyle = "rgba(15,20,30,0.65)";
        roundRect(px, py, pw, ph, 10); ctx.fill();
        ctx.strokeStyle = stop.accent; ctx.lineWidth = 1.5;
        roundRect(px, py, pw, ph, 10); ctx.stroke();
        var label = pulling ? (stop.icon + " ARRIVED!")
                            : (stop.icon + " " + (close ? "ALMOST THERE!" : (formatNum(Math.round(rem)) + "m")));
        drawText(label, W / 2, py + ph / 2 - 1, "bold 11px 'Segoe UI', Arial, sans-serif", (close || pulling) ? "#FFE082" : "#FFF", "#000", 3);
        // progress bar underneath
        var bw = pw - 14, bx = px + 7, by = py + ph + 2;
        ctx.fillStyle = "rgba(0,0,0,0.4)"; roundRect(bx, by, bw, 4, 2); ctx.fill();
        ctx.fillStyle = stop.accent; roundRect(bx, by, bw * prog, 4, 2); ctx.fill();
        ctx.restore();

        // A small fading "pulling in… <icon>" tag over the car during the pull-in.
        if (pulling && typeof player !== "undefined" && player) {
            var pa = clamp(1 - tripPullInT / 1.1, 0, 1);
            ctx.save();
            ctx.globalAlpha = 0.35 + 0.65 * pa;
            drawText("pulling in… " + stop.icon, player.x, player.y - 62,
                "bold 14px 'Segoe UI', Arial, sans-serif", stop.accent, "#000", 3);
            ctx.restore();
        }
    }

    // ── Menu postcards strip (called from drawMenu) ──────────────
    function drawPostcardsStrip() {
        if (!save.postcards || save.postcards.length <= 0) return;
        var n = TRIP_STOPS.length;
        var stampW = 26, gap = 8, totW = n * stampW + (n - 1) * gap;
        var sx = W / 2 - totW / 2;
        // Sits below the (now taller) menu stack — PLAY/STORY/SHOP|QUESTS/DISTRACTED/SHARED ROAD.
        var rowY = H * 0.80;
        for (var i = 0; i < n; i++) {
            var stop = TRIP_STOPS[i];
            var got = save.postcards.indexOf(stop.id) >= 0;
            var x = sx + i * (stampW + gap);
            ctx.fillStyle = got ? "rgba(30,40,55,0.92)" : "rgba(40,44,52,0.55)";
            roundRect(x, rowY, stampW, stampW, 5); ctx.fill();
            ctx.strokeStyle = got ? stop.accent : "rgba(255,255,255,0.18)"; ctx.lineWidth = got ? 2 : 1;
            roundRect(x, rowY, stampW, stampW, 5); ctx.stroke();
            if (got) {
                drawText(stop.icon, x + stampW / 2, rowY + stampW / 2 + 1, "16px Arial", "#FFF", null, 0);
            } else {
                drawText("?", x + stampW / 2, rowY + stampW / 2 + 1, "bold 13px Arial", "rgba(255,255,255,0.3)", null, 0);
            }
        }
        drawText("✈️ furthest trip: " + (save.tripBest || 0) + " stop" + ((save.tripBest || 0) === 1 ? "" : "s"),
            W / 2, rowY + 28, "bold 11px 'Segoe UI', Arial, sans-serif", "#B0BEC5", "#26323a", 2);
    }

    // ═══════════════════════════════════════════════════════════
    //  STORY BEATS  — three STORY-MODE-ONLY layers on top of the
    //  journey: (1) a phone CALL from your destination at each leg's
    //  start, (2) ONE scripted ROAD EVENT mid-leg, (3) an ARRIVAL
    //  BOON you tap to power the next leg. Everything self-guards on
    //  runMode === "story"; cruise/multiplayer stay byte-identical.
    // ═══════════════════════════════════════════════════════════

    var STORY_CALL_DUR = 4.6;               // seconds the call card stays up
    var storyCallT = 0;                     // >0 while the call card is showing (counts down)
    var storyCallDelay = 0;                 // >0 counting down before the call slides in
    var storyCallPending = false;           // a call is armed for this leg but not shown yet
    var storyCallStop = 0;                  // which TRIP_STOPS index the call is for
    var storyCallLine = "";                 // the personality line for the pending/active call
    var storyEvent = null;                  // the active scripted road event (per-leg), or null
    var storyEventDone = false;             // per-leg: has this leg's event already fired?
    var storyBoonT = 0;                     // >0 = spritzer ×2-score buff active (drive only)
    var tripBoon = null;                    // { id, label } tapped at arrival, applied on KEEP DRIVING

    // Per-stop CALL identity (portrait/icon + accent). Beach has no person → 🐦.
    function storyCallInfo(idx) {
        var id = TRIP_STOPS[idx].id;
        if (id === "bubbe")   return { name: "BUBBE",     portrait: "bubbe",   color: "#FFCC80" };
        if (id === "heshy")   return { name: "HESHY",     portrait: "heshy",   color: "#80D8FF" };
        if (id === "beach")   return { name: "THE BEACH", icon: "🐦",           color: "#FFE082" };
        if (id === "avigail") return { name: "AVIGAIL",   portrait: "avigail", color: "#CE93D8" };
        return { name: "BURRY", portrait: "burry", color: "#A5D6A7" };
    }

    // Pick the leg's call line (Avigail's is rivalry-aware like her arrival greet).
    function pickStoryCallLine(idx) {
        var id = TRIP_STOPS[idx].id;
        if (id === "bubbe") return randPick([
            "Come straight here, Lululeh — I have a MISSION for you.",
            "The kugel is in the oven and I have NEWS. Drive."]);
        if (id === "heshy") return randPick([
            "It's about Vegas... we need to talk. Poolside. Obviously.",
            "Bring goggles. And your listening ears."]);
        if (id === "beach") return randPick([
            "*SQUAWK* (a seagull has stolen someone's sandwich)",
            "*URGENT seagull noises re: a buried plushie*"]);
        if (id === "avigail") {
            var r = (typeof avigailRel === "function") ? avigailRel() : 50;
            if (r >= 65) return "Bestie, my engine's making a noise like your singing. Come quick 💜";
            if (r <= 35) return "I do NOT need help. But if you HAPPENED to drive by...";
            return "Hypothetically, if my car exploded, what's your ETA?";
        }
        return randPick([
            "Cuz, the van's packed! Mostly. The kids packed themselves. Send help.",
            "Mindy says drive safe. The kids say drive FAST. I say SNACKS."]);
    }

    // Arm the current leg's story beats (call + event). Called at every leg-start
    // site (resetGame seeding + KEEP DRIVING advance), mirroring queueLegIntro.
    function armStoryLeg() {
        if (runMode !== "story") return;
        // Sweep out any lingering GAG vans from the previous leg (they're intangible
        // and pace the player, so they'd never scroll off on their own).
        for (var i = obstacles.length - 1; i >= 0; i--) {
            var b = obstacles[i].behavior;
            if (b === "ima" || b === "burryvan") obstacles.splice(i, 1);
        }
        storyEvent = null; storyEventDone = false;
        storyTalk = null; storyTalkDone = false;   // re-arm this leg's dialogue interlude
        storyCallStop = tripStopIdx;
        storyCallLine = pickStoryCallLine(tripStopIdx);
        storyCallPending = true;
        storyCallDelay = 2.6;   // ~2.5s after the leg begins (banner runs 2.5s)
        storyCallT = 0;
        // ── CHAPTER SET: force this leg's directed season + reset its per-leg
        //    ambience latches. setSeason blends smoothly; storySeasonHold keeps it.
        //    (On a fresh run resetGame re-applies this after initSeason.) ──
        armStorySeason();
        storyVegasFlipped = false;   // Vegas heat→neon flip re-arms each leg
        storyGulls = []; storyGullTimer = rand(4, 9); storyFireflies = null;
        armStoryTask();         // arm this leg's optional CHAPTER TASK
    }

    // ── CHAPTER TASK: arm the current leg's optional goal. One distinct task per
    //    stop; each snapshots whatever it needs at leg start. STORY-only. ──
    function armStoryTask() {
        storyTask = null; storyGear = [];
        if (runMode !== "story") return;
        var id = TRIP_STOPS[tripStopIdx].id;
        if (id === "bubbe")   storyTask = { id: id, goal: 40, coinStart: runCoins };           // coins gained this leg
        else if (id === "heshy")   storyTask = { id: id, goal: 3, bestChain: 0 };              // max close-call chain
        else if (id === "beach")   storyTask = { id: id, goal: 3, gear: 0, gearSpawned: 0,     // gear caught
                                                 gearPlan: [0.30, 0.50, 0.70] };
        else if (id === "avigail") storyTask = { id: id, aviBumped: false };                    // no-bump flag
        else if (id === "vegas")   storyTask = { id: id, heartLost: false };                    // no heart lost
    }

    // Is this leg's task satisfied RIGHT NOW? (evaluated at arrival)
    function storyTaskMet() {
        if (!storyTask) return false;
        var id = storyTask.id;
        if (id === "bubbe")   { var end = (storyTask.legEndCoins != null) ? storyTask.legEndCoins : runCoins;
                                return (end - storyTask.coinStart) >= storyTask.goal; }
        if (id === "heshy")   return storyTask.bestChain >= storyTask.goal;
        if (id === "beach")   return storyTask.gear >= storyTask.goal;
        if (id === "avigail") return !storyTask.aviBumped;   // race never fired → still false → DONE
        if (id === "vegas")   return !storyTask.heartLost;
        return false;
    }

    // A light one-off progress nudge, fired from the 50% leg milestone.
    function storyTaskMilestone() {
        if (runMode !== "story" || !storyTask) return;
        var id = storyTask.id, msg = "";
        if (id === "bubbe")   msg = "🛒 groceries: " + (runCoins - storyTask.coinStart) + "/" + storyTask.goal + " 💰";
        else if (id === "heshy")   msg = "🔥 close calls: " + storyTask.bestChain + "/" + storyTask.goal;
        else if (id === "beach")   msg = "🏖️ beach gear: " + storyTask.gear + "/" + storyTask.goal;
        else if (id === "avigail") msg = storyTask.aviBumped ? "💅 oops — keep it classy!" : "💅 staying classy!";
        else if (id === "vegas")   msg = storyTask.heartLost ? "🎲 careful — protect the pot!" : "🎲 hearts safe so far!";
        if (msg) spawnFloater(player.x, player.y - 74, msg, "#FFE082");
    }

    // Beach leg only: spawn/steer-to-collect 3 runaway gear pickups (fuelCan-style
    // entities), spread across 30-70% of the leg. Drive-mode; STORY-only.
    function updateStoryGear(dt) {
        if (runMode !== "story" || !storyTask || storyTask.id !== "beach") return;
        if (state === "footRun") return;
        var legD = tripLegDist();
        var prog = clamp(1 - tripRemaining() / legD, 0, 1);
        var plan = storyTask.gearPlan;
        while (storyTask.gearSpawned < plan.length && prog >= plan[storyTask.gearSpawned] && tripPullInT <= 0) {
            var k = storyTask.gearSpawned;   // 0=kite, 1=beach ball, 2=sun hat
            storyGear.push({ x: LANES[randInt(0, 2)] + rand(-14, 14), y: -40, kind: k,
                             hitW: 20, hitH: 20, collected: false, bob: rand(0, 6.28) });
            storyTask.gearSpawned++;
        }
        for (var i = storyGear.length - 1; i >= 0; i--) {
            var g = storyGear[i];
            g.y += gameSpeed * dt; g.bob += dt;
            if (g.y > H + 50) { storyGear.splice(i, 1); continue; }
            if (!g.collected && aabb(player.x, player.y, CAR_W, CAR_H * 0.8, g.x, g.y, g.hitW, g.hitH)) {
                g.collected = true; storyTask.gear++;
                var names = ["Dina's kite", "the beach ball", "the sun hat"];
                spawnFloater(g.x, g.y, "🏖️ " + names[g.kind] + "! " + storyTask.gear + "/" + storyTask.goal, "#FFE082");
                spawnCoinSparkle(g.x, g.y);
                runCoins += 5; save.totalCoins += 5; persistSave();
                if (typeof playCoin === "function") playCoin();
                storyGear.splice(i, 1);
            }
        }
    }

    // World-layer draw for the beach gear (called from drawPlaying, next to
    // drawStoryEvent). Small glowing pickup discs with the item emoji.
    function drawStoryGear() {
        if (runMode !== "story" || !storyGear || storyGear.length === 0) return;
        var emos = ["🪁", "🏖️", "👒"];
        for (var i = 0; i < storyGear.length; i++) {
            var g = storyGear[i]; if (g.collected) continue;
            var yb = g.y + Math.sin(g.bob * 3) * 3;
            ctx.save(); ctx.translate(g.x, yb);
            ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(0, 16, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
            var pulse = 0.6 + 0.4 * Math.sin(gameTime * 5 + g.kind);
            ctx.globalAlpha = 0.35 + 0.25 * pulse;
            ctx.fillStyle = "#FFE082"; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = "rgba(20,26,38,0.75)"; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#FFCA28"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
            drawText(emos[g.kind], 0, 1, "18px Arial", "#FFF", null, 0);
            ctx.restore();
        }
    }

    // ── CHAPTER-SET AMBIENCE — beach gull flyovers + Avigail dusk fireflies ──
    // Purely decorative, STORY-only. Updated from updateJourney (skipped during
    // interludes / pull-in, which return earlier); drawn from drawStoryAmbient
    // in drawPlaying's world layer. Cheap; no collision; no gameplay effect.
    var storyGulls = [], storyGullTimer = 0, storyFireflies = null;

    // Shared white-gull glyph (a flapping "M" + soft ground shadow). Reused by the
    // beach story-EVENT squadron AND the ambient mini flyovers so art never drifts.
    function drawGullShape(x, y, t, scale) {
        scale = scale || 1;
        var s = 12 * scale;
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        ctx.beginPath(); ctx.ellipse(x, y + 40 * scale, s, 4 * scale, 0, 0, Math.PI * 2); ctx.fill();
        var fl = Math.sin(t * 14) * 6 * scale;
        ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 3 * scale; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x - s, y + fl); ctx.lineTo(x, y - 3 * scale); ctx.lineTo(x + s, y + fl); ctx.stroke();
    }

    function updateStoryAmbient(dt) {
        if (runMode !== "story") return;
        var id = TRIP_STOPS[tripStopIdx].id;
        // BEACH: a small 2-3 gull flyover sweeps across every ~14-22s.
        if (id === "beach") {
            storyGullTimer -= dt;
            if (storyGullTimer <= 0) {
                storyGullTimer = rand(14, 22);
                var fromLeft = Math.random() < 0.5;
                var dirx = fromLeft ? 1 : -1;   // sweep INTO the screen from its edge
                var n = randInt(2, 3), baseY = rand(H * 0.12, H * 0.34);
                for (var k = 0; k < n; k++) {
                    storyGulls.push({
                        x: (fromLeft ? -40 : W + 40) - dirx * k * rand(26, 44),   // trail behind the leader
                        y: baseY + k * rand(-10, 18),
                        vx: dirx * rand(62, 92), vy: rand(16, 34), t: rand(0, 3) });
                }
            }
        }
        for (var i = storyGulls.length - 1; i >= 0; i--) {
            var gg = storyGulls[i];
            gg.t += dt; gg.x += gg.vx * dt; gg.y += gg.vy * dt;
            // Wide margin so a staggered formation (leader + trailers ~110px back)
            // isn't culled before it has swept in.
            if (gg.x < -150 || gg.x > W + 150 || gg.y > H + 50) storyGulls.splice(i, 1);
        }
        // AVIGAIL: gentle glowing fireflies drift over the grass shoulders.
        if (id === "avigail") {
            if (!storyFireflies) {
                storyFireflies = [];
                var m = randInt(6, 8);
                for (var f = 0; f < m; f++) {
                    var fs = Math.random() < 0.5 ? -1 : 1;
                    storyFireflies.push({
                        x: fs < 0 ? rand(6, Math.max(10, ROAD_L - 10)) : rand(ROAD_R + 10, W - 6),
                        y: rand(H * 0.22, H * 0.88), side: fs,
                        vx: rand(-9, 9), vy: rand(-7, 7), phase: rand(0, 6.28) });
                }
            }
            for (var fi = 0; fi < storyFireflies.length; fi++) {
                var ff = storyFireflies[fi];
                ff.phase += dt; ff.x += ff.vx * dt; ff.y += ff.vy * dt;
                // Bounce softly inside its shoulder band so they linger over grass.
                var lo = ff.side < 0 ? 6 : ROAD_R + 10;
                var hi = ff.side < 0 ? Math.max(12, ROAD_L - 10) : W - 6;
                if (ff.x < lo) { ff.x = lo; ff.vx = Math.abs(ff.vx); }
                if (ff.x > hi) { ff.x = hi; ff.vx = -Math.abs(ff.vx); }
                if (ff.y < H * 0.18) { ff.y = H * 0.18; ff.vy = Math.abs(ff.vy); }
                if (ff.y > H * 0.92) { ff.y = H * 0.92; ff.vy = -Math.abs(ff.vy); }
            }
        }
    }

    function drawStoryAmbient() {
        if (runMode !== "story") return;
        // Dusk fireflies (soft yellow-green pulsing dots) — under the gulls.
        if (storyFireflies && TRIP_STOPS[tripStopIdx].id === "avigail") {
            ctx.save();
            for (var i = 0; i < storyFireflies.length; i++) {
                var ff = storyFireflies[i];
                var glow = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(ff.phase * 2.4 + i));
                ctx.globalAlpha = glow;
                ctx.fillStyle = "#CDE86B";
                ctx.beginPath(); ctx.arc(ff.x, ff.y, 4.5, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = glow * 0.5;
                ctx.beginPath(); ctx.arc(ff.x, ff.y, 8.5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }
        // Beach gull flyover.
        for (var g = 0; g < storyGulls.length; g++) drawGullShape(storyGulls[g].x, storyGulls[g].y, storyGulls[g].t, 0.9);
    }

    // ── Feature 1: the phone-call card ───────────────────────────
    function storyCallRect() {
        var w = W - 44, h = 84, x = W / 2 - w / 2, y = H * 0.15;
        return { x: x, y: y, w: w, h: h };
    }

    function updateStoryCall(dt) {
        if (runMode !== "story") return;
        if (storyCallPending) {
            storyCallDelay -= dt;
            // Only fire once the leg banner has fully faded (no visual overlap).
            if (storyCallDelay <= 0 && (typeof legBannerT === "undefined" || legBannerT <= 0)) {
                storyCallPending = false;
                storyCallT = STORY_CALL_DUR;
                if (typeof playTone === "function") { playTone(660, 0.09, "sine", 0.12); setTimeout(function () { playTone(880, 0.09, "sine", 0.10); }, 130); }
            }
            return;
        }
        if (storyCallT > 0) {
            storyCallT -= dt;
            // Tap-to-dismiss — PEEK the click only inside the card rect, so a tap
            // anywhere else still reaches the driving HUD untouched.
            if (typeof clickQueue !== "undefined" && clickQueue) {
                var r = storyCallRect();
                if (pointInRect(clickQueue.x, clickQueue.y, r.x, r.y, r.w, r.h)) {
                    clickQueue = null;
                    if (storyCallT > 0.28) storyCallT = 0.28;   // quick fade-out
                }
            }
        }
    }

    function drawStoryCall() {
        if (runMode !== "story") return;
        if (state !== "playing") return;
        if (storyCallT <= 0) return;
        var info = storyCallInfo(storyCallStop);
        var r = storyCallRect();
        var age = STORY_CALL_DUR - storyCallT;
        var slide = easeOutBack(clamp(age / 0.35, 0, 1));
        var fade = clamp(storyCallT / 0.5, 0, 1) * clamp(age / 0.1, 0, 1);
        var offx = (1 - slide) * -(r.w + 60);
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(offx, 0);
        // card
        ctx.fillStyle = "rgba(18,24,36,0.94)";
        roundRect(r.x, r.y, r.w, r.h, 16); ctx.fill();
        ctx.strokeStyle = info.color; ctx.lineWidth = 2.5;
        roundRect(r.x, r.y, r.w, r.h, 16); ctx.stroke();
        // avatar (clipped to a circle)
        var acx = r.x + 44, acy = r.y + r.h / 2, ar = 28;
        ctx.save();
        ctx.beginPath(); ctx.arc(acx, acy, ar, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
        ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(acx - ar, acy - ar, ar * 2, ar * 2);
        if (info.icon) {
            drawText(info.icon, acx, acy + 2, "34px Arial", "#FFF", null, 0);
        } else if (info.portrait === "heshy") {
            tripDrawHeshy(acx, acy + 4, gameTime);
        } else {
            drawPortrait(info.portrait, acx, acy, 78, Math.sin(gameTime * 5) > 0);
        }
        ctx.restore();
        ctx.strokeStyle = info.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(acx, acy, ar, 0, Math.PI * 2); ctx.stroke();
        // title + line
        var tx = r.x + 84;
        drawText("📞 " + info.name, tx, r.y + 24, "bold 15px 'Segoe UI', Arial, sans-serif", info.color, "#000", 3, "left");
        var lines = tripWrap(storyCallLine, "bold 12px 'Segoe UI', Arial, sans-serif", r.w - 100);
        for (var i = 0; i < lines.length && i < 3; i++) {
            drawText(lines[i], tx, r.y + 44 + i * 16, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFF5E6", "#000", 3, "left");
        }
        ctx.restore();
    }

    // ═══════════════════════════════════════════════════════════
    //  MID-LEG DIALOGUE INTERLUDE  (state "storyTalk") — a short PAUSE
    //  scene ~35% into each leg: the road freezes (drawn dimmed under a
    //  card), a portrait plays 3-5 scripted lines, tap to advance, last
    //  tap resumes "playing" with a 2s shield. STORY-only; one per leg.
    // ═══════════════════════════════════════════════════════════
    var storyTalk = null;         // { id, lines:[{who,phone,text}], idx, t } while up
    var storyTalkDone = false;    // per-leg: has this leg's interlude already played?

    // The authored per-leg script (Avigail's is relationship-aware, chosen here so
    // the +6 bump applied AFTER the interlude reflects the pre-interlude rel).
    function storyTalkScript(id) {
        if (id === "bubbe") return [
            { who: "bubbe", phone: true, text: "Lululeh. Listen close. The POT comes to Vegas." },
            { who: "lulu",  phone: true, text: "The heirloom pot?? The one Zaidy schlepped from—" },
            { who: "bubbe", phone: true, text: "Sunday we surprise Burry. The whole mishpacha. The pot MAKES the cholent that makes the party." },
            { who: "lulu",  phone: true, text: "No pressure or anything!!" },
            { who: "bubbe", phone: true, text: "Pressure? You're a BRUCK. Drive." }
        ];
        if (id === "heshy") return [
            { who: "heshy", text: "Lulu. Real talk. Vegas has... NO water." },
            { who: "lulu",  text: "Heshy. They have POOLS. Famous ones. With FOUNTAINS." },
            { who: "heshy", text: "...fountains?" },
            { who: "lulu",  text: "Dancing ones. CHOREOGRAPHED." },
            { who: "heshy", text: "...Pack the floatie. I'M IN. 🏊" }
        ];
        if (id === "beach") return [
            { who: "dina",  phone: true, text: "LULU. Emergency. Morgan is IN THE SAND." },
            { who: "lulu",  phone: true, text: "How deep are we talking?" },
            { who: "dina",  phone: true, text: "Tail-deep. Tammy says it's 'fine.' It is NOT fine." },
            { who: "fayge", phone: true, text: "(background) Nobody panic! Chani's napping!" },
            { who: "lulu",  phone: true, text: "Morgan rescue squad, en route. NOBODY digs without me." }
        ];
        if (id === "avigail") {
            var r = (typeof avigailRel === "function") ? avigailRel() : 50;
            if (r <= 35) return [
                { who: "avigail", text: "Don't. Say. Anything." },
                { who: "lulu",    text: "Wasn't gonna. ...Jumper cables?" },
                { who: "avigail", text: "...Fine. But this never happened." },
                { who: "lulu",    text: "What never happened? 😇" }
            ];
            if (r >= 65) return [
                { who: "avigail", text: "BESTIE. My car did a thing." },
                { who: "lulu",    text: "A smoking thing." },
                { who: "avigail", text: "Get me to my own party?" },
                { who: "lulu",    text: "Hop in, drama queen. 💜" }
            ];
            return [
                { who: "avigail", text: "Of COURSE you'd drive by right now." },
                { who: "lulu",    text: "Need a hand, or just an audience?" },
                { who: "avigail", text: "...Both. Obviously." },
                { who: "lulu",    text: "Buckle up, frenemy." }
            ];
        }
        // vegas
        return [
            { who: "burry", phone: true, text: "Cuz... everyone's really coming? For ME?" },
            { who: "lulu",  phone: true, text: "The WHOLE mishpacha. Even Avigail." },
            { who: "burry", phone: true, text: "I told Mindy this town never surprised me once. ...I gotta write a toast. What rhymes with 'Lakewood'?" },
            { who: "lulu",  phone: true, text: "Focus on the ROAD— wait, that's me. GOTTA GO!" }
        ];
    }

    // Speaker identity (name colour + which portrait renderer to use).
    function storyTalkSpeaker(who) {
        if (who === "bubbe")   return { name: "BUBBE",   color: "#FFCC80", port: "bubbe" };
        if (who === "lulu")    return { name: "LULU",    color: "#FF9EC4", lulu: true };
        if (who === "heshy")   return { name: "HESHY",   color: "#80D8FF", heshy: true };
        if (who === "dina")    return { name: "DINA",    color: "#F48FB1", dina: true };
        if (who === "fayge")   return { name: "FAYGE",   color: "#9FA8DA", port: "fayge" };
        if (who === "avigail") return { name: "AVIGAIL", color: "#CE93D8", port: "avigail" };
        if (who === "burry")   return { name: "BURRY",   color: "#A5D6A7", port: "burry" };
        return { name: "?", color: "#FFFFFF", port: "kid" };
    }

    // Fire the interlude (opens the scene). Snapshots the leg's script.
    function fireStoryTalk(idx) {
        storyTalkDone = true;
        var id = TRIP_STOPS[idx].id;
        storyTalk = { id: id, lines: storyTalkScript(id), idx: 0, t: 0, lineT: 0 };
        if (typeof playTone === "function") { playTone(620, 0.08, "sine", 0.12); setTimeout(function () { playTone(830, 0.08, "sine", 0.10); }, 120); }
        state = "storyTalk";
    }

    // Trigger check — story only, once per leg, at >=35%, calm & drive-mode.
    function maybeFireStoryTalk() {
        if (runMode !== "story") return;
        if (storyTalkDone || storyTalk) return;
        if (state !== "playing") return;    // drive-mode only (foot never reaches here)
        if (tripPullInT > 0) return;
        // Heat on her? retry until clear (never consumes the per-leg flag).
        var heat = (typeof copChase !== "undefined" && copChase) ||
                   (typeof copBust !== "undefined" && copBust) ||
                   (typeof prisonClothes !== "undefined" && prisonClothes);
        if (heat) return;
        var legD = tripLegDist();
        var prog = clamp(1 - tripRemaining() / legD, 0, 1);
        if (prog >= 0.35) fireStoryTalk(tripStopIdx);
    }

    // Typewriter speed (chars/sec) + how many chars of the current line are shown.
    var STORY_TALK_CPS = 42;
    function storyTalkShownChars() {
        if (!storyTalk) return 0;
        var ln = storyTalk.lines[storyTalk.idx];
        if (!ln) return 0;
        var n = Math.floor(storyTalk.lineT * STORY_TALK_CPS);
        if (n >= ln.text.length) return ln.text.length;
        // Never split a surrogate pair (emoji) mid-reveal.
        var c = ln.text.charCodeAt(n - 1);
        if (n > 0 && c >= 0xD800 && c <= 0xDBFF) n = Math.max(0, n - 1);
        return n;
    }

    function updateStoryTalk(dt) {
        if (!storyTalk) { state = "playing"; return; }
        storyTalk.t += dt;
        storyTalk.lineT += dt;
        if (typeof updateParticles === "function") updateParticles(dt);
        var adv = false;
        if (consumeClick()) adv = true;
        if (consumeAction()) adv = true;
        if (!adv) return;
        // First tap while the line is still typing COMPLETES it; the next
        // tap advances — the standard visual-novel rhythm.
        var cur = storyTalk.lines[storyTalk.idx];
        if (cur && storyTalkShownChars() < cur.text.length) {
            storyTalk.lineT = 999;
            if (typeof playClick === "function") playClick();
            return;
        }
        storyTalk.lineT = 0;
        storyTalk.idx++;
        if (storyTalk.idx >= storyTalk.lines.length) {
            var wasAvigail = (storyTalk.id === "avigail");
            storyTalk = null;
            state = "playing";
            invincibleTimer = Math.max(invincibleTimer, 2.0);
            if (wasAvigail && typeof bumpAvigailRel === "function") bumpAvigailRel(6);
            if (typeof playClick === "function") playClick();
            return;
        }
        if (typeof playClick === "function") playClick();
    }

    // Render one speaker into a clipped circle avatar (radius R). `speaking`
    // syncs the mouth flap to the typewriter — quiet once the line lands.
    function storyTalkAvatar(spk, acx, acy, R, speaking) {
        ctx.save();
        ctx.beginPath(); ctx.arc(acx, acy, R, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
        ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fillRect(acx - R, acy - R, R * 2, R * 2);
        var talking = speaking && Math.sin(gameTime * 9) > -0.2;
        if (spk.heshy) { tripDrawHeshy(acx, acy + R * 0.12, gameTime); }
        else if (spk.lulu) { var sl = R / 44; drawLuluPortrait(acx, acy + 8 * sl, gameTime, sl); }
        else if (spk.dina) { var sd = R / 44; drawDinaPortrait(acx, acy + 4 * sd, gameTime, sd); }
        else { drawPortrait(spk.port, acx, acy, R * 2.8, talking); }
        ctx.restore();
        ctx.strokeStyle = spk.color; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(acx, acy, R, 0, Math.PI * 2); ctx.stroke();
    }

    function drawStoryTalk() {
        // Frozen driving world underneath, then a dark scrim (like paused).
        if (typeof drawPlaying === "function") drawPlaying();
        ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, W, H);
        if (!storyTalk) return;
        var line = storyTalk.lines[storyTalk.idx];
        if (!line) return;
        var spk = storyTalkSpeaker(line.who);
        var t = storyTalk.t;
        var cardW = W - 40, cardX = 20;
        // The card slides up from below when the scene opens.
        var slideIn = easeOutBack(clamp(t / 0.32, 0, 1));
        var cardH = 184, cardY = H - cardH - 46 + (1 - slideIn) * (cardH + 90);

        // card
        ctx.fillStyle = "rgba(18,24,36,0.96)";
        roundRect(cardX, cardY, cardW, cardH, 18); ctx.fill();
        ctx.strokeStyle = spk.color; ctx.lineWidth = 2.5;
        roundRect(cardX, cardY, cardW, cardH, 18); ctx.stroke();

        // chapter / LEG STORY chip riding the top edge
        var stop = TRIP_STOPS[tripStopIdx];
        var chip = (stop ? stop.icon + "  " : "") + "LEG STORY";
        ctx.font = "bold 11px 'Segoe UI', Arial, sans-serif";
        var chW = ctx.measureText(chip).width + 22, chX = cardX + 18, chY = cardY - 12;
        ctx.fillStyle = stop ? stop.accent : "#FFD54F";
        roundRect(chX, chY, chW, 22, 11); ctx.fill();
        drawText(chip, chX + chW / 2, chY + 11, "bold 11px 'Segoe UI', Arial, sans-serif", "#3E2723", null, 0);

        // portrait (upper-left) — mouth flaps only while the line is typing out
        var shownN = storyTalkShownChars();
        var typing = shownN < line.text.length;
        var R = 34, acx = cardX + 30 + R, acy = cardY + 48;
        storyTalkAvatar(spk, acx, acy, R, typing);

        // speaker name (gold), phone-framed lines get the 📞 prefix
        var nm = (line.phone ? "📞 " : "") + spk.name;
        drawText(nm, acx + R + 16, cardY + 40, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#3E2723", 4, "left");

        // body text (white), wrapped, up to 4 lines — TYPEWRITER reveal.
        // Wrap the FULL text (so lines never reflow mid-reveal), then only
        // draw up to the revealed character count.
        var tFont = "bold 15px 'Segoe UI', Arial, sans-serif";
        var tl = tripWrap(line.text, tFont, cardW - 40);
        var ty0 = cardY + 96, lineH = 21, left = shownN;
        for (var i = 0; i < tl.length && i < 4 && left > 0; i++) {
            var seg = tl[i].length <= left ? tl[i] : tl[i].substring(0, left);
            drawText(seg, cardX + 22, ty0 + i * lineH, tFont, "#FFF5E6", "#000", 3, "left");
            left -= tl[i].length + 1;   // +1 for the swallowed wrap-space
        }

        // advance pulse — "tap ▸▸" fast-forwards while typing, "tap ▸" advances
        var pulse = 0.55 + 0.45 * Math.sin(t * 6);
        ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * pulse;
        drawText(typing ? "tap ▸▸" : "tap ▸", cardX + cardW - 22, cardY + cardH - 18,
            "bold 14px 'Segoe UI', Arial, sans-serif", spk.color, "#000", 3, "right");
        ctx.restore();

        // progress dots (which line of how many)
        var n = storyTalk.lines.length, dotY = cardY + cardH - 16, dotGap = 13;
        var dotX0 = cardX + 22;
        for (var d = 0; d < n; d++) {
            ctx.fillStyle = (d <= storyTalk.idx) ? spk.color : "rgba(255,255,255,0.2)";
            ctx.beginPath(); ctx.arc(dotX0 + d * dotGap, dotY, 3.2, 0, Math.PI * 2); ctx.fill();
        }
    }

    // ── Feature 2: the scripted mid-leg road event ───────────────
    function nearestLaneIdx(x) {
        var best = 0, bd = 1e9;
        for (var i = 0; i < 3; i++) { var d = Math.abs(LANES[i] - x); if (d < bd) { bd = d; best = i; } }
        return best;
    }
    function removeObstacle(o) { var ix = obstacles.indexOf(o); if (ix >= 0) obstacles.splice(ix, 1); }

    // Fires ONCE at ~60% of a leg (see maybeFireStoryEvent). Each event reuses
    // existing entities/art and keeps its own light state on `storyEvent`.
    function fireStoryEvent(idx) {
        storyEventDone = true;
        var se = { kind: idx, t: 0 };
        var pcLane = nearestLaneIdx(player.x);
        if (idx === 0) {
            // IMA CONVOY — a warm minivan paces her, then peels away. INTANGIBLE:
            // it's a gag, not a wall (ghost flag → collision loop skips it).
            var vlane = pcLane === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1;
            var van = { type: "car", x: LANES[vlane], y: player.y, color: "#A1887F", carType: 0,
                behavior: "ima", ghost: true, hitW: 0, hitH: 0, speedMult: 0, comment: null, commentT: 0 };
            obstacles.push(van); se.van = van;
        } else if (idx === 1) {
            // CANNONBALL CROSSING — Heshy sprints across (decorative crosser, no hitbox).
            se.crossers = [{ x: -40, y: player.y - rand(90, 150), vx: 250 }];
            if (typeof playHonk === "function") playHonk();
        } else if (idx === 2) {
            // SEAGULL SQUADRON → ICE CREAM CONVOY.
            se.gulls = []; se.convoySpawned = false;
            var n = randInt(6, 8);
            for (var g = 0; g < n; g++) se.gulls.push({ x: rand(30, W - 30), y: -30 - g * rand(20, 60), vx: rand(-20, 20), vy: rand(300, 400), t: rand(0, 3) });
            spawnFloater(W / 2, H * 0.4, "smell that salt air! 🌊", "#4FC3F7");
        } else if (idx === 3) {
            // RACE YOU THERE — Avigail's coupe pulls parallel (COLLIDABLE as normal).
            var alane = pcLane === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1;
            var aHb = carHitbox(6);
            var aviCar = { type: "car", x: LANES[alane], y: player.y - 10, color: "#7E57C2", carType: 6,
                behavior: "avigail", hitW: aHb.hw, hitH: aHb.hh, speedMult: 0, lane: alane,
                taunted: true, swerveT: 0, spillT: 0, comment: null, commentT: 0 };
            obstacles.push(aviCar); se.aviCar = aviCar;
        } else {
            // BURRY'S BOX DROP — an intangible (ghost) moving van drops pickups.
            var blane = randInt(0, 2);
            var bvan = { type: "car", x: LANES[blane], y: player.y - 270, color: "#8D6E63", carType: 0,
                behavior: "burryvan", ghost: true, hitW: 0, hitH: 0, speedMult: 0, comment: "VEGAS OR BUST!", commentT: 3.5 };
            obstacles.push(bvan);
            se.van = bvan; se.boxes = []; se.dropped = 0; se.nextBox = 0.8;
            se.boxLabels = ["caught the lava lamp!", "the dice clock!", "Mindy's blender!", "a kid's shoe??"];
        }
        storyEvent = se;
        if (typeof playTone === "function") playTone(500, 0.08, "triangle", 0.1, 700);
    }

    function maybeFireStoryEvent() {
        if (runMode !== "story") return;
        if (storyEventDone || storyEvent) return;
        if (state === "footRun") return;   // road event is drive-mode only (onFoot is a local of updatePlaying)
        if (state !== "playing") return;
        if (tripPullInT > 0) return;
        // Heat on her? DELAY (don't consume the per-leg flag) — it fires when clear.
        var heat = (typeof copChase !== "undefined" && copChase) ||
                   (typeof copBust !== "undefined" && copBust) ||
                   (typeof prisonClothes !== "undefined" && prisonClothes);
        if (heat) return;
        var legD = tripLegDist();
        var prog = clamp(1 - tripRemaining() / legD, 0, 1);
        if (prog >= 0.6) fireStoryEvent(tripStopIdx);
    }

    function updateStoryEvent(dt) {
        if (!storyEvent) return;
        var se = storyEvent, kind = se.kind;
        se.t += dt;
        if (kind === 0) {                       // IMA CONVOY
            var v = se.van;
            if (v) {
                if (!se.said1 && se.t > 1.0) { se.said1 = true; v.comment = "Two hands on the wheel!"; v.commentT = 3.0; }
                if (!se.said2 && se.t > 3.6) { se.said2 = true; v.comment = "Call your Bubbe when you arrive!!"; v.commentT = 3.2; }
                if (se.t > 6.2) {
                    if (!se.honked && typeof playHonk === "function") { se.honked = true; playHonk(); }
                    v.speedMult -= dt * 0.9; if (v.speedMult < -0.9) v.speedMult = -0.9;
                }
                if (v.y < -150) { removeObstacle(v); storyEvent = null; }
            } else storyEvent = null;
        } else if (kind === 1) {                // CANNONBALL CROSSING
            for (var i = se.crossers.length - 1; i >= 0; i--) {
                var c = se.crossers[i];
                c.x += c.vx * dt;
                if (c.x > W + 44) {
                    spawnFloater(W / 2, c.y - 30, "CANNONBALL PRACTIIIICE! 💦", "#80D8FF");
                    if (typeof playHonk === "function") playHonk();
                    spawnSplash(c.x - 40, c.y);
                    se.crossers.splice(i, 1);
                }
            }
            if (se.crossers.length === 0) storyEvent = null;
        } else if (kind === 2) {                // GULLS → ICE CREAM CONVOY
            for (var gi = se.gulls.length - 1; gi >= 0; gi--) {
                var gg = se.gulls[gi];
                gg.t += dt; gg.y += gg.vy * dt; gg.x += gg.vx * dt;
                if (gg.y > H + 70) se.gulls.splice(gi, 1);
            }
            if (!se.convoySpawned && se.t > 2.4) {
                se.convoySpawned = true;
                var lane = randInt(0, 2);
                for (var k = 0; k < 3; k++) {
                    var ty = -70 - k * 180;
                    obstacles.push({ type: "car", x: LANES[lane], y: ty, color: "#F8BBD0", carType: 0,
                        behavior: "icetruck", hitW: 40, hitH: 66, speedMult: rand(0.42, 0.5), lane: lane, comment: null, commentT: 0 });
                    coinEntities.push({ x: LANES[lane] + rand(-12, 12), y: ty - 48, hitW: 16, hitH: 16, collected: false });
                }
            }
            if (se.convoySpawned && se.gulls.length === 0) storyEvent = null;
        } else if (kind === 3) {                // RACE YOU THERE
            var a = se.aviCar;
            var present = a && obstacles.indexOf(a) >= 0;
            if (present) {
                if (!se.bumped && aabb(player.x, player.y, CAR_W * 0.7, CAR_H * 0.7, a.x, a.y, a.hitW || 36, a.hitH || 64)) {
                    se.bumped = true;
                    if (storyTask && storyTask.id === "avigail") storyTask.aviBumped = true;   // CHAPTER TASK: classy = no bump
                }
                if (!se.said1 && se.t > 0.9) { se.said1 = true; a.comment = "Race you to MY house 💅"; a.commentT = 2.6; }
                if (!se.said2 && se.t > 3.2) { se.said2 = true; a.comment = "Loser buys the spritzers!"; a.commentT = 2.8; }
                if (se.t > 4.6) { a.speedMult -= dt * 0.9; if (a.speedMult < -1.1) a.speedMult = -1.1; }
                if (a.y < -150) { removeObstacle(a); present = false; }
            }
            if (!present) {
                if (!se.awarded) {
                    se.awarded = true;
                    if (!se.bumped && typeof bumpAvigailRel === "function") bumpAvigailRel(2);
                }
                storyEvent = null;
            }
        } else if (kind === 4) {                // BURRY'S BOX DROP
            for (var bi = se.boxes.length - 1; bi >= 0; bi--) {
                var bx = se.boxes[bi];
                bx.y += gameSpeed * dt; bx.bob += dt;
                if (bx.y > H + 50) { se.boxes.splice(bi, 1); continue; }
                if (state !== "footRun" && aabb(player.x, player.y, CAR_W, CAR_H * 0.8, bx.x, bx.y, bx.hitW, bx.hitH)) {
                    runCoins += 6; save.totalCoins += 6; persistSave();
                    spawnFloater(bx.x, bx.y, se.boxLabels[bx.li] + " +6", "#FFD54F");
                    spawnCoinSparkle(bx.x, bx.y);
                    if (typeof playCoin === "function") playCoin();
                    se.boxes.splice(bi, 1);
                }
            }
            var bv = se.van;
            if (bv) {
                if (se.t >= se.nextBox && se.dropped < 4 && se.t < 8) {
                    se.nextBox += 1.7;
                    se.boxes.push({ x: bv.x + rand(-6, 6), y: bv.y + 34, hitW: 22, hitH: 22, li: se.dropped, bob: rand(0, 6.28) });
                    se.dropped++;
                }
                if (se.t > 8.2) { bv.speedMult -= dt * 0.9; if (bv.speedMult < -0.9) bv.speedMult = -0.9; }
                if (bv.y < -150) { removeObstacle(bv); se.van = null; }
            }
            if (!se.van && se.boxes.length === 0) storyEvent = null;
        }
    }

    // Box-truck / minivan art shared by the intangible gag vans + the ice-cream
    // convoy. Drawn from the obstacle draw loop (behavior branch in 05).
    function drawStoryVehicle(o) {
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.fillStyle = "rgba(0,0,0,0.20)";
        ctx.beginPath(); ctx.ellipse(3, 6, 24, 36, 0, 0, Math.PI * 2); ctx.fill();
        var body, trim;
        if (o.behavior === "icetruck") { body = "#FFFFFF"; trim = "#AD1457"; }
        else if (o.behavior === "burryvan") { body = "#8D6E63"; trim = "#4E342E"; }
        else { body = "#A1887F"; trim = "#6D4C41"; }   // ima minivan (warm)
        ctx.fillStyle = body; roundRect(-23, -36, 46, 74, 9); ctx.fill();
        ctx.strokeStyle = trim; ctx.lineWidth = 2; roundRect(-23, -36, 46, 74, 9); ctx.stroke();
        ctx.fillStyle = "#81D4FA"; roundRect(-15, 20, 30, 12, 4); ctx.fill();   // windshield (front toward bottom)
        ctx.fillStyle = "#222";
        roundRect(-26, -22, 6, 14, 2); ctx.fill(); roundRect(20, -22, 6, 14, 2); ctx.fill();
        roundRect(-26, 14, 6, 14, 2); ctx.fill(); roundRect(20, 14, 6, 14, 2); ctx.fill();
        if (o.behavior === "icetruck") {
            ctx.fillStyle = "#F8BBD0"; roundRect(-23, -8, 46, 18, 0); ctx.fill();
            drawText("🍦", 0, -47, "20px Arial", "#AD1457", null, 0);
            drawText("ICE CREAM", 0, 0, "bold 7px 'Segoe UI', Arial, sans-serif", "#AD1457", null, 0);
        } else if (o.behavior === "burryvan") {
            ctx.fillStyle = "#6D4C41"; roundRect(-16, -48, 32, 14, 3); ctx.fill();
            drawText("VEGAS", 0, -8, "bold 8px 'Segoe UI', Arial, sans-serif", "#FFE082", "#3E2723", 2);
            drawText("OR BUST", 0, 4, "bold 8px 'Segoe UI', Arial, sans-serif", "#FFE082", "#3E2723", 2);
        } else {   // ima minivan — cargo box on the roof + a mom silhouette
            ctx.fillStyle = "#5D4037"; roundRect(-14, -50, 28, 12, 3); ctx.fill();
            ctx.strokeStyle = "#3E2723"; ctx.lineWidth = 1; roundRect(-14, -50, 28, 12, 3); ctx.stroke();
            ctx.fillStyle = "#4E342E"; ctx.beginPath(); ctx.arc(0, 26, 5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    // World-layer draw for the standalone event entities (crossers/gulls/boxes).
    // Vehicles (ima/burry/ice-cream) draw via the obstacle loop's behavior branch.
    function drawStoryEvent() {
        if (!storyEvent) return;
        var se = storyEvent;
        if (se.kind === 1 && se.crossers) {
            for (var i = 0; i < se.crossers.length; i++) drawStoryHeshyCrosser(se.crossers[i]);
        } else if (se.kind === 2 && se.gulls) {
            // shared gull glyph (also used by the ambient beach flyovers)
            for (var g = 0; g < se.gulls.length; g++) drawGullShape(se.gulls[g].x, se.gulls[g].y, se.gulls[g].t, 1);
        } else if (se.kind === 4 && se.boxes) {
            for (var b = 0; b < se.boxes.length; b++) drawStoryBox(se.boxes[b]);
        }
    }

    function drawStoryHeshyCrosser(c) {
        ctx.save();
        ctx.translate(c.x, c.y);
        // inner tube
        ctx.fillStyle = "#FF7043"; ctx.beginPath(); ctx.arc(0, 6, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#29B6F6"; ctx.beginPath(); ctx.arc(0, 6, 10, 0, Math.PI * 2); ctx.fill();
        // body
        ctx.fillStyle = "#0288D1"; roundRect(-8, -10, 16, 22, 5); ctx.fill();
        // head + green cap
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -16, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#43A047"; ctx.beginPath(); ctx.arc(0, -17, 9.5, Math.PI * 1.03, Math.PI * 1.97); ctx.fill();
        // pumping legs
        ctx.strokeStyle = C.skin; ctx.lineWidth = 4; ctx.lineCap = "round";
        var sw = Math.sin(c.x * 0.1) * 6;
        ctx.beginPath();
        ctx.moveTo(-4, 12); ctx.lineTo(-6 + sw, 22);
        ctx.moveTo(4, 12); ctx.lineTo(6 - sw, 22); ctx.stroke();
        ctx.restore();
    }

    function drawStoryBox(b) {
        ctx.save();
        ctx.translate(b.x, b.y + Math.sin(b.bob * 3) * 2);
        ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0, 15, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#8D6E63"; roundRect(-12, -12, 24, 24, 4); ctx.fill();
        ctx.strokeStyle = "#5D4037"; ctx.lineWidth = 2; roundRect(-12, -12, 24, 24, 4); ctx.stroke();
        // 5 dice pips
        ctx.fillStyle = "#FFF";
        var pips = [[-6, -6], [6, -6], [0, 0], [-6, 6], [6, 6]];
        for (var i = 0; i < pips.length; i++) { ctx.beginPath(); ctx.arc(pips[i][0], pips[i][1], 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
    }

    // ── Feature 3: arrival boons ─────────────────────────────────
    function tripBoonInfo(idx) {
        var id = TRIP_STOPS[idx].id;
        if (id === "bubbe")   return { id: "cholent",  emoji: "🍲", label: "Bubbe's cholent" };
        if (id === "heshy")   return { id: "floatie",  emoji: "🛟", label: "floatie shield" };
        if (id === "beach")   return { id: "icecream", emoji: "🍦", label: "ice cream" };
        if (id === "avigail") return { id: "spritzer", emoji: "🥂", label: "spritzer" };
        return { id: "dice", emoji: "🎲", label: "lucky dice" };
    }
    function tripBoonRect() {
        var s = 74; return { x: W / 2 - s / 2, y: H * 0.70, w: s, h: s };
    }
    // Applied on KEEP DRIVING (dice already paid on tap). Announced with a floater.
    function applyTripBoon() {
        if (!tripBoon || tripBoon.applied) return;
        tripBoon.applied = true;
        var id = tripBoon.id;
        if (id === "cholent") { lives = Math.min(lives + 1, 9); spawnFloater(player.x, player.y - 50, "Bubbe's cholent: +1 ❤️", "#FFCC80"); }
        else if (id === "floatie") { invincibleTimer = Math.max(invincibleTimer, 8); spawnFloater(player.x, player.y - 50, "floatie shield: 8s 🛡️", "#80D8FF"); }
        else if (id === "icecream") { nitroTimer = Math.max(nitroTimer, 5); spawnFloater(player.x, player.y - 50, "sugar rush! 🍦💨", "#F8BBD0"); }
        else if (id === "spritzer") { storyBoonT = 15; spawnFloater(player.x, player.y - 50, "spritzer confidence: ×2 ✨", "#CE93D8"); }
        tripBoon = null;
    }
    // Drawn inside drawArrival's backdrop area.
    function drawTripBoon(t) {
        var binfo = tripBoonInfo(tripStopIdx);
        var br = tripBoonRect();
        var bcx = br.x + br.w / 2, bcy = br.y + br.h / 2;
        if (!tripArrival.boonTaken) {
            var bp = 0.5 + 0.5 * Math.sin(t * 4);
            ctx.save();
            ctx.strokeStyle = tripArrival.stop.accent; ctx.globalAlpha = 0.5 + 0.4 * bp; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(bcx, bcy, br.w * 0.5 + 4 + bp * 6, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.fillStyle = "rgba(20,26,38,0.92)"; ctx.beginPath(); ctx.arc(bcx, bcy, br.w * 0.5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = tripArrival.stop.accent; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(bcx, bcy, br.w * 0.5, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            drawText(binfo.emoji, bcx, bcy + 2, "40px Arial", "#FFF", null, 0);
            ctx.save(); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6);
            drawText("tap!", bcx, bcy + br.h * 0.5 + 12, "bold 12px 'Segoe UI', Arial, sans-serif", tripArrival.stop.accent, "#000", 3);
            ctx.restore();
        } else {
            ctx.save(); ctx.globalAlpha = 0.9;
            ctx.fillStyle = "rgba(20,26,38,0.6)"; ctx.beginPath(); ctx.arc(bcx, bcy, br.w * 0.44, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            drawText(binfo.emoji, bcx, bcy + 2, "30px Arial", "#FFF", null, 0);
            drawText("✓ " + binfo.label, bcx, bcy + br.h * 0.5 + 12, "bold 11px 'Segoe UI', Arial, sans-serif", "#7CFC4F", "#1B3A1B", 3);
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  STORY MAP  (state "storyMap") — tapping 📖 STORY TRIP opens a
    //  winding road-map of the 5 stops. Tap an unlocked chapter to
    //  drive it. STORY-only; never touches cruise. Music: "lulu" group.
    // ═══════════════════════════════════════════════════════════
    var storyMapDeniedIdx = -1, storyMapDeniedT = 0;   // brief shake on a locked-node tap
    var storyMapT = 0;   // seconds since the map opened — drives the node pop-in stagger

    // Node centres along a winding S-curve from lower-left → upper-right, the
    // stops placed roughly evenly and alternating sides. Node radius ~34.
    function storyMapNodes() {
        var nodes = [], n = TRIP_STOPS.length;
        var topY = H * 0.30, botY = H * 0.82;
        for (var i = 0; i < n; i++) {
            var f = (n > 1) ? i / (n - 1) : 0;                 // 0 (bottom) → 1 (top)
            var y = botY + (topY - botY) * f;
            var baseX = W * 0.20 + W * 0.60 * f;               // trend rightward as we climb
            var side = (i % 2 === 0) ? -1 : 1;                 // alternate off the trend line
            var x = clamp(baseX + side * W * 0.14, W * 0.16, W * 0.84);
            nodes.push({ x: x, y: y, r: 34, idx: i, stop: TRIP_STOPS[i] });
        }
        return nodes;
    }

    // "done" | "current" | "locked" for a given node index.
    function storyMapNodeState(i) {
        var ss = save.storyStop || 0, cyc = save.storyCycle || 0;
        // Frontier wrapped after a full tour → EVERY leg replayable (node 0 is NEXT).
        if (cyc > 0 && ss === 0) return i === 0 ? "current" : "done";
        if (i < ss) return "done";
        if (i === ss) return "current";
        return "locked";
    }

    function updateStoryMap(dt) {
        menuBounce += dt;
        storyMapT += dt;
        if (storyMapDeniedT > 0) storyMapDeniedT -= dt;
        var click = consumeClick();
        if (!click) return;
        // Back → menu.
        if (pointInRect(click.x, click.y, 16, 14, 80, 44)) { gotoState("menu"); playClick(); return; }
        // Node taps.
        var nodes = storyMapNodes();
        for (var i = 0; i < nodes.length; i++) {
            var nd = nodes[i];
            var dx = click.x - nd.x, dy = click.y - nd.y;
            if (dx * dx + dy * dy <= (nd.r + 12) * (nd.r + 12)) {
                if (storyMapNodeState(i) === "locked") {
                    storyMapDeniedIdx = i; storyMapDeniedT = 0.4;
                    if (typeof playDeny === "function") playDeny();
                    spawnFloater(nd.x, nd.y - nd.r - 12, "🔒 finish earlier stops first", "#FF8A80");
                    return;
                }
                // Launch this chapter.
                storyLaunchLeg = i;
                runMode = "story";
                resetGame();
                gotoState("playing");
                if (typeof playClick === "function") playClick();
                return;
            }
        }
    }

    function drawStoryMap() {
        // Warm dusk gradient backdrop.
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#3A2C4E"); g.addColorStop(0.45, "#7B4B57"); g.addColorStop(1, "#C98A5A");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // Soft low sun glow behind the road.
        var sun = ctx.createRadialGradient(W * 0.7, H * 0.30, 10, W * 0.7, H * 0.30, H * 0.4);
        sun.addColorStop(0, "rgba(255,224,130,0.35)"); sun.addColorStop(1, "rgba(255,224,130,0)");
        ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);

        // Dusk sky life: a few early twinkling stars up top + two slow clouds.
        ctx.save();
        for (var sk = 0; sk < 9; sk++) {
            var stx = ((sk * 97 + 31) % 100) / 100 * W;
            var sty = ((sk * 53 + 17) % 100) / 100 * H * 0.18 + 8;
            ctx.globalAlpha = 0.25 + 0.45 * Math.abs(Math.sin(menuBounce * 1.4 + sk * 1.9));
            ctx.fillStyle = "#FFF8E1";
            ctx.fillRect(stx, sty, 2, 2);
        }
        ctx.globalAlpha = 1;
        for (var cl = 0; cl < 2; cl++) {
            var clx = ((menuBounce * (7 + cl * 4) + cl * 260) % (W + 200)) - 100;
            var cly = H * (0.06 + cl * 0.07);
            ctx.fillStyle = "rgba(255,236,217,0.13)";
            ctx.beginPath();
            ctx.ellipse(clx, cly, 58, 14, 0, 0, Math.PI * 2);
            ctx.ellipse(clx + 30, cly - 8, 34, 11, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        var nodes = storyMapNodes();

        // ── The winding ROAD (thick asphalt polyline through the nodes) ──
        ctx.save();
        ctx.lineJoin = "round"; ctx.lineCap = "round";
        // asphalt
        ctx.strokeStyle = "#2B3038"; ctx.lineWidth = 44;
        ctx.beginPath(); ctx.moveTo(nodes[0].x, nodes[0].y + 40);
        for (var a = 0; a < nodes.length; a++) ctx.lineTo(nodes[a].x, nodes[a].y);
        ctx.lineTo(nodes[nodes.length - 1].x, nodes[nodes.length - 1].y - 40);
        ctx.stroke();
        // subtle edge highlight
        ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 46;
        ctx.stroke();
        // dashed gold centreline — MARCHING toward Vegas (animated dash offset)
        ctx.strokeStyle = "#FFD54F"; ctx.lineWidth = 3; ctx.setLineDash([14, 14]);
        ctx.lineDashOffset = (menuBounce * 24) % 28;
        ctx.beginPath(); ctx.moveTo(nodes[0].x, nodes[0].y + 40);
        for (var b = 0; b < nodes.length; b++) ctx.lineTo(nodes[b].x, nodes[b].y);
        ctx.lineTo(nodes[nodes.length - 1].x, nodes[nodes.length - 1].y - 40);
        ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
        ctx.restore();

        // ── Stop NODES (staggered pop-in when the map opens) ──
        for (var i = 0; i < nodes.length; i++) {
            var nd = nodes[i], st = storyMapNodeState(i), stop = nd.stop;
            var popN = easeOutBack(clamp((storyMapT - 0.1 - i * 0.09) / 0.3, 0, 1));
            if (popN <= 0.01) continue;
            var starred = !!(save.storyStars && save.storyStars[stop.id]);
            var cx = nd.x, cy = nd.y;
            // denied shake
            if (storyMapDeniedIdx === i && storyMapDeniedT > 0) cx += Math.sin(storyMapDeniedT * 50) * 5;
            var isCur = (st === "current");
            var r = nd.r * (isCur ? 1.12 : 1) * popN;

            // ring
            ctx.save();
            if (isCur) {
                var pulse = 0.5 + 0.5 * Math.sin(menuBounce * 5);
                ctx.shadowColor = "rgba(255,213,79," + (0.5 + 0.4 * pulse) + ")"; ctx.shadowBlur = 12 + 10 * pulse;
                ctx.strokeStyle = "#FFD54F"; ctx.lineWidth = 4 + 1.5 * pulse;
            } else if (st === "done") {
                ctx.strokeStyle = "#66BB6A"; ctx.lineWidth = 4;
            } else {
                ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 3;
            }
            // badge fill
            ctx.fillStyle = (st === "locked") ? "rgba(30,34,42,0.85)" : "rgba(24,30,44,0.92)";
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();

            // icon (dimmed when locked; scales with the pop-in)
            ctx.save();
            if (st === "locked") ctx.globalAlpha = 0.4;
            ctx.globalAlpha *= popN;
            drawText(stop.icon, cx, cy + 1, Math.max(8, Math.round(30 * popN)) + "px Arial", "#FFF", null, 0);
            ctx.restore();
            if (popN < 0.85) continue;   // glyphs/labels arrive once the badge has landed

            // status glyphs
            if (st === "done") {
                ctx.fillStyle = "#66BB6A"; ctx.beginPath(); ctx.arc(cx + r * 0.72, cy - r * 0.72, 11, 0, Math.PI * 2); ctx.fill();
                drawText("✓", cx + r * 0.72, cy - r * 0.72 + 1, "bold 14px Arial", "#FFF", null, 0);
            }
            if (starred) {
                drawText("⭐", cx - r * 0.72, cy - r * 0.72, "18px Arial", "#FFD700", null, 0);
            }
            if (st === "locked") {
                drawText("🔒", cx, cy - r - 6, "16px Arial", "#FFF", null, 0);
            }
            if (isCur) {
                // NEXT chip above the node
                var chW = 46, chX = cx - chW / 2, chY = cy - r - 24;
                ctx.fillStyle = "#FFD54F"; roundRect(chX, chY, chW, 18, 9); ctx.fill();
                drawText("NEXT", cx, chY + 9, "bold 11px 'Segoe UI', Arial, sans-serif", "#3E2723", null, 0);
            }

            // name + task lines beside/below the node, on a soft backing pill so
            // they stay legible over the road/sky no matter where the node sits.
            var nameC = (st === "locked") ? "rgba(255,255,255,0.45)" : "#FFF5E6";
            var tLines = (st !== "locked" && stop.task)
                ? tripWrap("⭐ " + stop.task, "10px 'Segoe UI', Arial, sans-serif", 150) : [];
            if (tLines.length > 2) tLines = tLines.slice(0, 2);
            // measure the widest line for the pill
            ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
            var blockW = ctx.measureText(stop.name).width;
            ctx.font = "10px 'Segoe UI', Arial, sans-serif";
            for (var tm = 0; tm < tLines.length; tm++) blockW = Math.max(blockW, ctx.measureText(tLines[tm]).width);
            var blockH = 20 + tLines.length * 13;
            ctx.fillStyle = "rgba(24,16,30,0.55)";
            roundRect(cx - blockW / 2 - 8, cy + r + 4, blockW + 16, blockH, 8); ctx.fill();
            drawText(stop.name, cx, cy + r + 14, "bold 12px 'Segoe UI', Arial, sans-serif", nameC, "#000", 3);
            for (var tl = 0; tl < tLines.length; tl++) {
                drawText(tLines[tl], cx, cy + r + 30 + tl * 13, "10px 'Segoe UI', Arial, sans-serif",
                    starred ? "#FFE082" : "#CFD8DC", "#000", 2);
            }

            // "You are here" — Lulu's own car idles beside the NEXT stop's node,
            // bobbing gently with a soft headlight glow. Makes the map feel like
            // she's really parked on this road, not looking at a chart.
            if (isCur && popN >= 0.99) {
                var mkX = cx - r - 28, mkY = cy + 20 + Math.sin(menuBounce * 2.4) * 3;
                ctx.save();
                var hg = ctx.createRadialGradient(mkX, mkY, 4, mkX, mkY, 42);
                hg.addColorStop(0, "rgba(255,236,150,0.30)"); hg.addColorStop(1, "rgba(255,236,150,0)");
                ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(mkX, mkY, 42, 0, Math.PI * 2); ctx.fill();
                ctx.translate(mkX, mkY);
                ctx.rotate(0.5);
                ctx.scale(0.46, 0.46);
                drawLuluCar(0, 0, 0, false, menuBounce, false);
                ctx.restore();
            }
        }

        // ── Header ──
        var cyc = save.storyCycle || 0;
        drawText("📖 THE ROAD TO VEGAS", W / 2, 40, "bold 22px 'Segoe UI', Arial, sans-serif", "#FFE0B2", "#3E2723", 5);
        // Warm one-line story blurb (drops below the TOUR chip when it's shown).
        drawText("Burry's leaving Lakewood. Bubbe has a plan. You have a car.",
            W / 2, cyc > 0 ? 88 : 64, "italic 12px 'Segoe UI', Arial, sans-serif", "#E8D6C4", "#3E2723", 3);
        if (cyc > 0) {
            var tourTxt = "TOUR " + (cyc + 1);
            ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
            var twd = ctx.measureText(tourTxt).width + 22;
            var txx = W / 2 - twd / 2, tyy = 56;
            ctx.fillStyle = "#7B5E3B"; roundRect(txx, tyy, twd, 20, 10); ctx.fill();
            ctx.strokeStyle = "#FFD54F"; ctx.lineWidth = 1.5; roundRect(txx, tyy, twd, 20, 10); ctx.stroke();
            drawText(tourTxt, W / 2, tyy + 10, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFE082", "#3E2723", 2);
        }
        drawBackButton(16, 14);

        // ── Footer hint ──
        drawText("tap a stop to drive that chapter — ⭐ = chapter task done", W / 2, H - 22,
            "bold 11px 'Segoe UI', Arial, sans-serif", "#FFF5E6", "#3E2723", 3);

        drawParticles();
        drawFloaters();
    }
