    function gameLoop(timestamp) {
        var dt = Math.min((timestamp - lastTime) / 1000, 0.05);
        lastTime = timestamp;

        // Global update tickers (always run)
        updateBtnPressFx(dt);
        updateFloaters(dt);
        updateSceneFade(dt);

        // Background music tracks state changes
        // Map game state → music file track
        var musicTrack = null;
        if (state === "charSelect" || state === "menu" || state === "playing" ||
            state === "crash" || state === "gameover" || state === "shop") musicTrack = "lulu";
        else if (state === "parking" || state === "parkingIntro" || state === "parkingResult" ||
                 state === "parkingEnd") musicTrack = "parking";
        else if (state === "dinaRun" || state === "dinaBus" || state === "dinaCaught" ||
                 state === "dinaHome" || state === "dinaNap" || state === "dinaMorgan" ||
                 state === "cookieCatch") musicTrack = "dina";
        else if (state === "avigailScene") musicTrack = "avigail";
        else if (state.indexOf("salon") === 0) musicTrack = "salon";
        // Paused keeps whatever was playing (handled in updatePaused)
        if (musicTrack && state !== "paused") startMusic(musicTrack);

        if (state === "charSelect") updateCharSelect(dt);
        else if (state === "menu") updateMenu(dt);
        else if (state === "playing") updatePlaying(dt);
        else if (state === "paused") updatePaused(dt);
        else if (state === "crash") updateCrash(dt);
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
        else if (state === "avigailScene") updateAvigailScene(dt);
        else if (state === "salon") updateSalon(dt);

        ctx.clearRect(0, 0, W, H);

        if (state === "charSelect") drawCharSelect();
        else if (state === "menu") drawMenu();
        else if (state === "playing") drawPlaying();
        else if (state === "paused") drawPaused();
        else if (state === "crash") drawCrash();
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
        else if (state === "avigailScene") drawAvigailScene();
        else if (state === "salon") drawSalon();

        // Scene fade overlay (drawn on top of everything)
        drawSceneFade();

        // Prefer rAF, but fall back to setTimeout when the tab is hidden
        // (rAF is fully paused in background tabs; setTimeout still fires ~1/sec).
        if (document.hidden) {
            setTimeout(function () { gameLoop(performance.now()); }, 100);
        } else {
            requestAnimationFrame(gameLoop);
        }
    }

    // ── Init ─────────────────────────────────────────────────
    initDecorations();
    // Draw the first frame synchronously so the menu shows up even in hidden tabs
    lastTime = performance.now() - 16;
    gameLoop(performance.now());

})();
