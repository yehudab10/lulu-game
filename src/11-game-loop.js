    var lastDispatchState = null;

    function gameLoop(timestamp) {
        var dt = Math.min((timestamp - lastTime) / 1000, 0.05);
        lastTime = timestamp;

      try {
        // Global update tickers (always run) — these use REAL time so timed
        // effects (the impact flash) finish on schedule regardless of slow-mo.
        updateBtnPressFx(dt);
        updateFloaters(dt);
        updateSceneFade(dt);
        updateStateTransition(dt);
        if (crashFlash > 0) crashFlash -= dt;

        // Bullet-time: briefly slow the simulation after a big crash for drama.
        // Decremented with real time so it always lasts ~0.55s; the scaled dt is
        // what the scene updates below actually advance by.
        if (slowMoT > 0) { slowMoT -= dt; dt *= 0.4; }

        // When the scene changes (via fade or a direct state set), drop any
        // input that belonged to the previous scene — the tap that caused the
        // transition, a half-finished finger-drag — so it can't double-fire or
        // leak into the new scene (this caused stray jumps into other modes).
        if (state !== lastDispatchState) {
            // Play the iris wipe on deliberate scene/menu changes — but NOT on
            // action-consequence flips (crash flash handles those), pause/resume
            // (would hide the menu), or while a gotoState fade is already running.
            var NO_WIPE = { crash: 1, gameover: 1, copBust: 1, copStop: 1, paused: 1,
                            footRun: 1, footInterior: 1, footWedding: 1 };
            if (lastDispatchState !== null && !NO_WIPE[state] && !NO_WIPE[lastDispatchState] &&
                sceneFade.t >= sceneFade.dur) {
                startStateTransition();
            }
            actionQueued = false;
            clickQueue = null;
            pauseQueued = false;
            footActQueued = false;
            // Drop any held control input from the previous scene.
            keys.up = false; keys.down = false;
            steerTouchId = null; touchX = null; touchY = null;
            // Speed-lock (cruise control) should SURVIVE scene/minigame exits:
            // returning to driving re-applies the locked speed so pros don't have
            // to re-lock every time. Locks only clear on a true exit to the menus
            // / game over (and on a fresh run via resetGame).
            if (state === "playing" || state === "footRun") {
                keys.up = boostLock; keys.down = brakeLock;
            } else if (state === "menu" || state === "charSelect" || state === "gameover") {
                boostLock = false; brakeLock = false;
            }
            // Dropping back onto the sidewalk (from an interior / the wedding /
            // a fresh foot start) → a 2s shield so a car sitting right on her
            // can't clip her the instant she reappears.
            if (state === "footRun" && lastDispatchState !== "paused") {
                invincibleTimer = Math.max(invincibleTimer, 2.0);
            }
            lastDispatchState = state;
        }

        // Background music tracks state changes
        // Map game state → music file track
        var musicTrack = null;
        if (state === "charSelect" || state === "menu" || state === "playing" ||
            state === "crash" || state === "copBust" || state === "copStop" || state === "gameover" || state === "shop" ||
            state === "footRun" || state === "footInterior") musicTrack = "lulu";
        else if (state === "footWedding") musicTrack = "wedding";   // Avigail's wedding music
        else if (state === "parking" || state === "parkingIntro" || state === "parkingResult" ||
                 state === "parkingEnd") musicTrack = "parking";
        else if (state === "dinaRun" || state === "dinaBus" || state === "dinaCaught" ||
                 state === "dinaHome" || state === "dinaNap" || state === "dinaMorgan" ||
                 state === "cookieCatch" || state === "stickerBook") musicTrack = "dina";
        else if (state === "avigailScene") musicTrack = "avigail";
        else if (state.indexOf("salon") === 0) musicTrack = "salon";
        // Paused keeps whatever was playing (handled in updatePaused)
        if (musicTrack && state !== "paused") startMusic(musicTrack);

        if (state === "charSelect") updateCharSelect(dt);
        else if (state === "menu") updateMenu(dt);
        else if (state === "playing") updatePlaying(dt);
        else if (state === "paused") updatePaused(dt);
        else if (state === "crash") updateCrash(dt);
        else if (state === "copBust") updateCopBust(dt);
        else if (state === "copStop") updateCopStop(dt);
        else if (state === "footRun") updateFootRun(dt);
        else if (state === "footInterior") updateFootInterior(dt);
        else if (state === "footWedding") updateFootWedding(dt);
        else if (state === "gameover") updateGameOver(dt);
        else if (state === "shop") updateShop(dt);
        else if (state === "parkingIntro") updateParkingIntro(dt);
        else if (state === "parking") updateParking(dt);
        else if (state === "parkingResult") updateParkingResult(dt);
        else if (state === "parkingEnd") updateParkingEnd(dt);
        else if (state === "dinaBus") updateDinaBus(dt);
        else if (state === "dinaRun") updateDinaRun(dt);
        else if (state === "dinaCaught") updateDinaCaught(dt);
        else if (state === "dinaHome") updateDinaHome(dt);
        else if (state === "dinaMorgan") updateDinaMorgan(dt);
        else if (state === "dinaNap") updateDinaNap(dt);
        else if (state === "cookieCatch") updateCookieCatch(dt);
        else if (state === "stickerBook") updateStickerBook(dt);
        else if (state === "avigailScene") updateAvigailScene(dt);
        else if (state === "salon") updateSalon(dt);

        ctx.clearRect(0, 0, W, H);

        if (state === "charSelect") drawCharSelect();
        else if (state === "menu") drawMenu();
        else if (state === "playing") drawPlaying();
        else if (state === "paused") drawPaused();
        else if (state === "crash") drawCrash();
        else if (state === "copBust") drawCopBust();
        else if (state === "copStop") drawCopStop();
        else if (state === "footRun") drawFootRun();
        else if (state === "footInterior") drawFootInterior();
        else if (state === "footWedding") drawFootWedding();
        else if (state === "gameover") drawGameOver();
        else if (state === "shop") drawShop();
        else if (state === "parkingIntro") drawParkingIntro();
        else if (state === "parking") drawParking();
        else if (state === "parkingResult") drawParkingResult();
        else if (state === "parkingEnd") drawParkingEnd();
        else if (state === "dinaBus") drawDinaBus();
        else if (state === "dinaRun") drawDinaRun();
        else if (state === "dinaCaught") drawDinaCaught();
        else if (state === "dinaHome") drawDinaHome();
        else if (state === "dinaMorgan") drawDinaMorgan();
        else if (state === "dinaNap") drawDinaNap();
        else if (state === "cookieCatch") drawCookieCatch();
        else if (state === "stickerBook") drawStickerBook();
        else if (state === "avigailScene") drawAvigailScene();
        else if (state === "salon") drawSalon();

        // Blinding white impact flash on a fatal crash (over the scene, under
        // the scene-fade/iris so transitions still read).
        if (crashFlash > 0) {
            ctx.fillStyle = "rgba(255,255,255," + (clamp(crashFlash / 0.4, 0, 1) * 0.9) + ")";
            ctx.fillRect(0, 0, W, H);
        }

        // Scene fade overlay (drawn on top of everything)
        drawSceneFade();
        // Iris wipe for hard scene cuts (on top of the fade)
        drawStateTransition();
      } catch (e) {
        // Never let one bad frame kill the loop (which would freeze the whole
        // app until a restart). Log it and keep going — input stays responsive.
        if (window.console && console.error) console.error("Lulu frame error:", e);
      }

        // Scheduling lives OUTSIDE the try so the loop always continues, even
        // if a frame threw above.
        // Prefer rAF, but fall back to setTimeout when the tab is hidden
        // (rAF is fully paused in background tabs; setTimeout still fires ~1/sec).
        if (document.hidden) {
            setTimeout(function () { gameLoop(performance.now()); }, 100);
        } else {
            requestAnimationFrame(gameLoop);
        }
    }

    // ── Init ─────────────────────────────────────────────────
    Ads.init(); // sets up AdMob in the native wrapper; no-op on the web
    initDecorations();
    // Draw the first frame synchronously so the menu shows up even in hidden tabs
    lastTime = performance.now() - 16;
    gameLoop(performance.now());

})();
