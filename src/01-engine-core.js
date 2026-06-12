// ============================================================
//  LULU'S ROAD TRIP — A Sneaky-Sasquatch-style driving game
// ============================================================

(function () {
    "use strict";

    // ── Constants ────────────────────────────────────────────
    var W = 480, H = 854;
    // H (the logical play-field height) is recomputed from the real device
    // viewport in relayout() below so the canvas fills the screen with no
    // letterbox and no distortion. 854 is just a safe pre-layout default.
    var ROAD_L = 100, ROAD_R = 380, ROAD_W = 280;
    var LANE_W = ROAD_W / 3;
    var LANES = [ROAD_L + LANE_W * 0.5, ROAD_L + LANE_W * 1.5, ROAD_L + LANE_W * 2.5];
    var CAR_W = 46, CAR_H = 78;
    var PLAYER_Y = H - 170;
    var MAX_LIVES = 3;
    var BASE_SPEED = 210;
    var MAX_SPEED = 620;
    var SPEED_RAMP = 7;
    var INVINCIBLE_TIME = 1.8;
    var PARKING_UNLOCK_COST = 1000; // one-time coin cost to unlock Parking Challenge

    // ── Skins ────────────────────────────────────────────────
    var SKINS = {
        pink:    { name: "Classic Pink",  price: 0,   body: "#E91E63", light: "#F48FB1", dark: "#AD1457", stripe: null },
        purple:  { name: "Royal Purple",  price: 100, body: "#9C27B0", light: "#CE93D8", dark: "#6A1B9A", stripe: null },
        orange:  { name: "Sunset Glow",   price: 150, body: "#FF9800", light: "#FFCC80", dark: "#E65100", stripe: null },
        blue:    { name: "Ocean Blue",    price: 200, body: "#2196F3", light: "#81D4FA", dark: "#0D47A1", stripe: null },
        green:   { name: "Lime Zest",     price: 250, body: "#8BC34A", light: "#C5E1A5", dark: "#558B2F", stripe: null },
        red:     { name: "Racing Red",    price: 300, body: "#F44336", light: "#FFCDD2", dark: "#B71C1C", stripe: "#FFFFFF" },
        gold:    { name: "Golden Lux",    price: 500, body: "#FFC107", light: "#FFE082", dark: "#FF6F00", stripe: "#FFFFFF" },
        ninja:   { name: "Black Ninja",   price: 750, body: "#212121", light: "#616161", dark: "#000000", stripe: "#E91E63" }
    };

    // ── Save System ──────────────────────────────────────────
    var SAVE_KEY = "luluSaveV2";
    var save = loadSave();

    function defaultSave() {
        return {
            highScore: 0,
            totalCoins: 0,
            ownedSkins: ["pink"],
            selectedSkin: "pink",
            missiles: 0,
            shields: 0,
            distractedUnlocked: false,
            parkingBestLevel: 0,
            parkingTotalStars: 0,
            parkingUnlocked: false,
            parkingPerfectRuns: 0,
            luluHair: "#8B5A2B",
            stickerBook: [],  // placed stickers: [{kind, x, y, rot, scale}]
            dinaRunsPlayed: 0 // # of run-home attempts → drives progressive difficulty
        };
    }

    function loadSave() {
        try {
            var raw = localStorage.getItem(SAVE_KEY);
            if (!raw) {
                // migrate old high score
                var oldHigh = parseInt(localStorage.getItem("luluHighScore")) || 0;
                var s = defaultSave();
                s.highScore = oldHigh;
                return s;
            }
            var parsed = JSON.parse(raw);
            var def = defaultSave();
            for (var k in def) if (!(k in parsed)) parsed[k] = def[k];
            return parsed;
        } catch (e) {
            return defaultSave();
        }
    }

    function persistSave() {
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
    }

    // ── Colors ───────────────────────────────────────────────
    var C = {
        grass1: "#4CAF50", grass2: "#66BB6A", grass3: "#388E3C",
        road: "#6B7B8D", roadEdge: "#555F6A", roadLine: "#F5F5DC",
        shoulder: "#5A6A7A",
        windshield: "#81D4FA", windshieldDark: "#4FC3F7",
        wheel: "#333333",
        coin: "#FFD700", coinDark: "#E6AC00", coinShine: "#FFF8B0",
        cone: "#FF5722", coneStripe: "#FFFFFF",
        puddle: "#42A5F5",
        trunk: "#5D4037", trunkDark: "#3E2723",
        tree: ["#2E7D32", "#388E3C", "#43A047"],
        bush: ["#66BB6A", "#4CAF50", "#388E3C"],
        flower: ["#FF80AB", "#FF4081", "#FFD54F", "#BA68C8", "#FFF176"],
        heart: "#E91E63", heartEmpty: "#555555",
        enemyCols: ["#2196F3", "#FF9800", "#9C27B0", "#26A69A", "#EF5350", "#5C6BC0"],
        hud: "#FFFFFF", hudShadow: "#222222",
        menuBg: "#81C784",
        overlay: "rgba(0,0,0,0.55)",
        skin: "#FFCCBC", lips: "#E91E63", hair: "#3E2723"
    };

    // ── Sound System (Web Audio) ─────────────────────────────
    var audioCtx = null;
    var audioMuted = false;

    function getAudio() {
        if (!audioCtx) {
            try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
            catch (e) { audioCtx = null; }
        }
        if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
        return audioCtx;
    }

    function playTone(freq, duration, type, volume, sweepTo) {
        if (audioMuted) return;
        var ac = getAudio(); if (!ac) return;
        var osc = ac.createOscillator();
        var gain = ac.createGain();
        osc.type = type || "sine";
        osc.frequency.setValueAtTime(freq, ac.currentTime);
        if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, ac.currentTime + duration);
        gain.gain.setValueAtTime(volume || 0.2, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
        osc.connect(gain).connect(ac.destination);
        osc.start();
        osc.stop(ac.currentTime + duration + 0.02);
    }

    function playCoin() {
        playTone(880, 0.08, "sine", 0.18, 1320);
        setTimeout(function () { playTone(1320, 0.08, "sine", 0.15, 1760); }, 60);
    }

    function playWompWomp() {
        if (audioMuted) return;
        var ac = getAudio(); if (!ac) return;
        var notes = [392, 349, 311, 261]; // descending sad trombone
        notes.forEach(function (freq, i) {
            var osc = ac.createOscillator();
            var gain = ac.createGain();
            osc.type = "sawtooth";
            var t = ac.currentTime + i * 0.18;
            osc.frequency.setValueAtTime(freq, t);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.16);
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
            // Lowpass for "muted brass" feel
            var lp = ac.createBiquadFilter();
            lp.type = "lowpass";
            lp.frequency.value = 1200;
            osc.connect(lp).connect(gain).connect(ac.destination);
            osc.start(t);
            osc.stop(t + 0.18);
        });
    }

    function playExplosion() {
        if (audioMuted) return;
        var ac = getAudio(); if (!ac) return;
        var bufferSize = Math.floor(ac.sampleRate * 0.6);
        var buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) {
            var decay = Math.pow(1 - i / bufferSize, 1.5);
            data[i] = (Math.random() * 2 - 1) * decay;
        }
        var noise = ac.createBufferSource();
        noise.buffer = buffer;
        var gain = ac.createGain();
        gain.gain.setValueAtTime(0.4, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.6);
        var filter = ac.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(2000, ac.currentTime);
        filter.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 0.5);
        noise.connect(filter).connect(gain).connect(ac.destination);
        noise.start();
        noise.stop(ac.currentTime + 0.6);

        // low boom
        var osc = ac.createOscillator();
        var bg = ac.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(120, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.4);
        bg.gain.setValueAtTime(0.4, ac.currentTime);
        bg.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
        osc.connect(bg).connect(ac.destination);
        osc.start();
        osc.stop(ac.currentTime + 0.45);
    }

    function playMissile() {
        playTone(200, 0.4, "sawtooth", 0.15, 600);
    }

    function playClick() { playTone(700, 0.04, "square", 0.08); }
    function playBuy() {
        playTone(523, 0.08, "triangle", 0.2);
        setTimeout(function () { playTone(659, 0.08, "triangle", 0.2); }, 70);
        setTimeout(function () { playTone(784, 0.12, "triangle", 0.2); }, 140);
    }
    function playDeny() { playTone(180, 0.15, "square", 0.15); }

    // ── Extra SFX (per Audio Engineer recommendations) ───────
    function makeNoiseBuffer(ac, dur) {
        var len = Math.floor(ac.sampleRate * dur);
        var buf = ac.createBuffer(1, len, ac.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        return buf;
    }
    function playCharHover() { playTone(620, 0.06, "sine", 0.10, 880); }
    function playCharSelect() {
        playTone(660, 0.07, "triangle", 0.18, 990);
        setTimeout(function () { playTone(990, 0.10, "triangle", 0.18, 1320); }, 70);
    }
    function playMenuHover() { playTone(900, 0.025, "sine", 0.06); }
    function playStarSparkle() {
        playTone(1760, 0.08, "sine", 0.12, 2640);
        setTimeout(function () { playTone(2640, 0.08, "sine", 0.10, 3520); }, 60);
        setTimeout(function () { playTone(3520, 0.12, "sine", 0.08, 4400); }, 120);
    }
    function playDinaStep() {
        if (audioMuted) return;
        var ac = getAudio(); if (!ac) return;
        var n = ac.createBufferSource(); n.buffer = makeNoiseBuffer(ac, 0.05);
        var g = ac.createGain(); var f = ac.createBiquadFilter();
        f.type = "bandpass"; f.frequency.value = 1200; f.Q.value = 2;
        g.gain.setValueAtTime(0.08, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
        n.connect(f).connect(g).connect(ac.destination); n.start(); n.stop(ac.currentTime + 0.06);
    }
    function playSchoolBell() {
        playTone(1320, 0.5, "sine", 0.14);
        playTone(1980, 0.5, "sine", 0.06);
        setTimeout(function () { playTone(1320, 0.5, "sine", 0.12); playTone(1980, 0.5, "sine", 0.05); }, 280);
    }
    function playDoorHiss() {
        if (audioMuted) return;
        var ac = getAudio(); if (!ac) return;
        var n = ac.createBufferSource(); n.buffer = makeNoiseBuffer(ac, 0.4);
        var g = ac.createGain(); var f = ac.createBiquadFilter();
        f.type = "highpass"; f.frequency.value = 3000;
        g.gain.setValueAtTime(0.12, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
        n.connect(f).connect(g).connect(ac.destination); n.start(); n.stop(ac.currentTime + 0.42);
    }
    function playDogBark() {
        playTone(280, 0.10, "sawtooth", 0.18, 180);
        setTimeout(function () { playTone(320, 0.12, "sawtooth", 0.18, 200); }, 140);
    }
    function playHopJump() { playTone(440, 0.18, "triangle", 0.16, 880); }
    function playThunder() {
        if (audioMuted) return;
        // crack now, low rolling rumble a moment later (like distant thunder)
        setTimeout(function () {
            var ac = getAudio(); if (!ac) return;
            var n = ac.createBufferSource(); n.buffer = makeNoiseBuffer(ac, 1.1);
            var g = ac.createGain(); var f = ac.createBiquadFilter();
            f.type = "lowpass";
            f.frequency.setValueAtTime(700, ac.currentTime);
            f.frequency.exponentialRampToValueAtTime(110, ac.currentTime + 1.0);
            g.gain.setValueAtTime(0.001, ac.currentTime);
            g.gain.linearRampToValueAtTime(0.32, ac.currentTime + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.1);
            n.connect(f).connect(g).connect(ac.destination); n.start(); n.stop(ac.currentTime + 1.15);
        }, rand(150, 450));
    }
    // Honk Symphony — pitch varies with speed/honk count
    var honkChain = 0; var honkChainResetTimer = 0;
    // ── Background music system (real MP3 files) ────────────
    var MUSIC_FILES = {
        lulu:    "lulu.mp3",
        dina:    "dina.mp3",
        parking: "parking.mp3",
        avigail: "avigail.mp3",
        salon:   "salon.mp3"
    };
    // Some tracks are PLAYLISTS — they play through in sequence then repeat the
    // sequence, instead of looping a single song forever.
    var MUSIC_PLAYLISTS = {
        lulu: ["lulu.mp3", "luludriving.mp3"]
    };
    var musicElements = {};       // cached looping Audio() per single-file track
    var playlistEls = {};         // track → [Audio, ...] for playlist tracks
    var playlistIdx = {};         // track → current index in its playlist
    var currentMusicTrack = null; // file-track name currently selected
    var currentMusicEl = null;
    var musicMuted = false;       // separate from SFX mute; toggled in pause menu
    var musicState = null;        // kept for compatibility with old references
    var MUSIC_VOLUME = 0.5;
    var audioUnlocked = false;    // becomes true after first user gesture

    function getMusicEl(track) {
        if (!MUSIC_FILES[track]) return null;
        if (!musicElements[track]) {
            var a = new Audio(MUSIC_FILES[track]);
            a.loop = true;
            a.volume = MUSIC_VOLUME;
            a.preload = "auto";
            musicElements[track] = a;
        }
        return musicElements[track];
    }

    function buildPlaylist(track) {
        if (playlistEls[track]) return;
        var files = MUSIC_PLAYLISTS[track];
        var els = [];
        files.forEach(function (f, i) {
            var a = new Audio(f);
            a.loop = false;
            a.volume = MUSIC_VOLUME;
            a.preload = "auto";
            a.addEventListener("ended", function () {
                // advance to the next song (cycling) only if still on this track
                if (currentMusicTrack === track) {
                    playlistIdx[track] = (i + 1) % files.length;
                    playPlaylistCurrent(track);
                }
            });
            els.push(a);
        });
        playlistEls[track] = els;
        playlistIdx[track] = 0;
    }
    function playPlaylistCurrent(track) {
        if (document.hidden || musicMuted || audioMuted || !audioUnlocked) return;
        var el = playlistEls[track][playlistIdx[track] || 0];
        currentMusicEl = el;
        el.volume = MUSIC_VOLUME;
        el.play().catch(function () {});
    }

    function stopMusic() {
        if (currentMusicEl) {
            try { currentMusicEl.pause(); } catch (e) {}
        }
        currentMusicEl = null;
        currentMusicTrack = null;
        musicState = null;
    }

    // Pause/resume without losing position (used by pause menu)
    function pauseMusic() {
        if (currentMusicEl) { try { currentMusicEl.pause(); } catch (e) {} }
    }
    function resumeMusic() {
        if (document.hidden) return;
        if (currentMusicEl && !musicMuted && !audioMuted && audioUnlocked) {
            currentMusicEl.play().catch(function () {});
        }
    }

    function startMusic(track) {
        // Never (re)start audio while the app is backgrounded — the game loop
        // keeps ticking via setTimeout when hidden and would otherwise re-play
        // the music the moment we paused it on background.
        if (document.hidden) return;
        if (musicMuted || audioMuted || !track || !audioUnlocked) return;
        if (currentMusicTrack === track) {
            // Same track — just make sure it's playing
            if (currentMusicEl && currentMusicEl.paused) {
                currentMusicEl.play().catch(function () {});
            }
            return;
        }
        // Switch tracks
        if (currentMusicEl) { try { currentMusicEl.pause(); } catch (e) {} }
        currentMusicTrack = track;
        musicState = track;
        if (MUSIC_PLAYLISTS[track]) {
            buildPlaylist(track);
            playPlaylistCurrent(track);
        } else {
            var el = getMusicEl(track);
            currentMusicEl = el;
            if (!el) return;
            el.volume = MUSIC_VOLUME;
            el.play().catch(function () {});
        }
    }

    function playHonkPitched(pitch) {
        if (audioMuted) return;
        var ac = getAudio(); if (!ac) return;
        for (var b = 0; b < 2; b++) {
            var osc = ac.createOscillator(); var gain = ac.createGain();
            osc.type = "square"; osc.frequency.value = pitch + b * 30;
            var t = ac.currentTime + b * 0.12;
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.setValueAtTime(0.18, t + 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(gain).connect(ac.destination); osc.start(t); osc.stop(t + 0.13);
        }
    }

    // ── Canvas Setup ─────────────────────────────────────────
    var canvas = document.getElementById("gameCanvas");
    var ctx = canvas.getContext("2d");
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    var viewW = W, viewH = H;           // last-measured viewport size (CSS px)
    var SAFE_TOP = 0, SAFE_BOTTOM = 0;   // safe-area insets in LOGICAL units

    function measureViewport() {
        var vv = window.visualViewport;
        var vw = vv && vv.width ? vv.width : (document.documentElement.clientWidth || window.innerWidth || W);
        var vh = vv && vv.height ? vv.height : (document.documentElement.clientHeight || window.innerHeight || H);
        return { w: Math.max(1, Math.round(vw)), h: Math.max(1, Math.round(vh)) };
    }
    function readSafeInsets() {
        try {
            var p = document.createElement("div");
            p.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
                "padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);";
            document.body.appendChild(p);
            var cs = getComputedStyle(p);
            var t = parseFloat(cs.paddingTop) || 0, b = parseFloat(cs.paddingBottom) || 0;
            document.body.removeChild(p);
            return { top: t, bottom: b };
        } catch (e) { return { top: 0, bottom: 0 }; }
    }
    // Recompute everything that depends on the (variable) play-field height.
    function recomputeLayout() {
        PLAYER_Y = H - 170;
        var bot = H - SAFE_BOTTOM;
        PAUSE_RECT        = { x: 8,       y: SAFE_TOP + 12, w: 48, h: 48 };
        MOBILE_BOOST_RECT = { x: 14,      y: bot - 168, w: 64, h: 64 };
        MOBILE_BRAKE_RECT = { x: 14,      y: bot - 96,  w: 64, h: 64 };
        MISSILE_RECT      = { x: W - 78,  y: bot - 96,  w: 64, h: 64 };
        HONK_RECT         = { x: W - 78,  y: bot - 168, w: 64, h: 64 };
        PARK_LEFT_RECT    = { x: 12,      y: bot - 96,  w: 64, h: 64 };
        PARK_RIGHT_RECT   = { x: 88,      y: bot - 96,  w: 64, h: 64 };
        PARK_FWD_RECT     = { x: W - 152, y: bot - 96,  w: 64, h: 64 };
        PARK_REV_RECT     = { x: W - 76,  y: bot - 96,  w: 64, h: 64 };
    }
    // Full-bleed responsive sizing — re-measured whenever iOS changes the
    // viewport (which it does late and repeatedly on launch / rotation).
    function relayout() {
        // Cap DPR at 2 — native 3× on big iPhones can blow the 256 MB canvas limit.
        dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
        var m = measureViewport();
        viewW = m.w; viewH = m.h;
        // logical height tracks the device aspect → fills the screen, no bars
        H = clamp(Math.round(W * viewH / viewW), 700, 1600);
        var ins = readSafeInsets();
        var perCss = H / viewH;             // logical px per CSS px
        SAFE_TOP = ins.top * perCss;
        SAFE_BOTTOM = ins.bottom * perCss;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = viewW + "px";
        canvas.style.height = viewH + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        recomputeLayout();
    }

    // ── Input ────────────────────────────────────────────────
    var keys = { left: false, right: false, up: false, down: false };
    var actionQueued = false;
    var clickQueue = null; // {x, y} in canvas coords
    var pauseQueued = false;
    var missileQueued = false;
    var honkQueued = false;
    var laneQueued = 0; // -1 = step left, +1 = step right (set on tap, drained per frame)
    var touchX = null;
    var touchY = null;  // held-finger position (drag-to-move scenes); null when not dragging
    var steerTouchId = null;
    var boostTouchId = null;
    var brakeTouchId = null;
    var parkLeftTouchId = null;
    var parkRightTouchId = null;
    var parkFwdTouchId = null;
    var parkRevTouchId = null;
    var isTouchDevice = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);

    function queueAction() { actionQueued = true; }
    function consumeAction() { if (actionQueued) { actionQueued = false; return true; } return false; }
    function consumeClick() { var c = clickQueue; clickQueue = null; return c; }
    function consumePause() { if (pauseQueued) { pauseQueued = false; return true; } return false; }
    function consumeMissile() { if (missileQueued) { missileQueued = false; return true; } return false; }
    function consumeHonk() { if (honkQueued) { honkQueued = false; return true; } return false; }

    function playHonk() {
        if (audioMuted) return;
        var ac = getAudio(); if (!ac) return;
        // Classic "BEEP BEEP" - two short tones
        for (var b = 0; b < 2; b++) {
            var osc = ac.createOscillator();
            var gain = ac.createGain();
            osc.type = "square";
            osc.frequency.value = 440 + b * 30;
            var t = ac.currentTime + b * 0.16;
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.setValueAtTime(0.18, t + 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
            osc.connect(gain).connect(ac.destination);
            osc.start(t);
            osc.stop(t + 0.14);
        }
    }

    // Mobile control button rects — 64×64, kept clear of the home indicator via
    // SAFE_BOTTOM. Actual positions are (re)computed in recomputeLayout(); these
    // are just declarations.
    var PAUSE_RECT, MOBILE_BOOST_RECT, MOBILE_BRAKE_RECT, MISSILE_RECT, HONK_RECT;
    var PARK_LEFT_RECT, PARK_RIGHT_RECT, PARK_FWD_RECT, PARK_REV_RECT;

    // Now that the rect vars exist, lay everything out and keep it in sync with
    // the live viewport. iOS reports the final viewport late and repeatedly on
    // launch, so we re-measure on every relevant event AND a few times after.
    relayout();
    window.addEventListener("resize", relayout);
    window.addEventListener("orientationchange", function () { setTimeout(relayout, 120); });
    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", relayout);
        window.visualViewport.addEventListener("scroll", relayout);
    }
    [60, 150, 300, 600, 1000, 1500].forEach(function (ms) { setTimeout(relayout, ms); });

    function hitGameButton(pos) {
        if (state === "playing") {
            if (pointInRect(pos.x, pos.y, PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, PAUSE_RECT.h)) return "pause";
            if (save.missiles > 0 && pointInRect(pos.x, pos.y, MISSILE_RECT.x, MISSILE_RECT.y, MISSILE_RECT.w, MISSILE_RECT.h)) return "missile";
            if (pointInRect(pos.x, pos.y, HONK_RECT.x, HONK_RECT.y, HONK_RECT.w, HONK_RECT.h)) return "honk";
            if (pointInRect(pos.x, pos.y, MOBILE_BOOST_RECT.x, MOBILE_BOOST_RECT.y, MOBILE_BOOST_RECT.w, MOBILE_BOOST_RECT.h)) return "boost";
            if (pointInRect(pos.x, pos.y, MOBILE_BRAKE_RECT.x, MOBILE_BRAKE_RECT.y, MOBILE_BRAKE_RECT.w, MOBILE_BRAKE_RECT.h)) return "brake";
            return null;
        }
        if (state === "parking") {
            if (pointInRect(pos.x, pos.y, PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, PAUSE_RECT.h)) return "pause";
            if (pointInRect(pos.x, pos.y, PARK_LEFT_RECT.x, PARK_LEFT_RECT.y, PARK_LEFT_RECT.w, PARK_LEFT_RECT.h)) return "parkLeft";
            if (pointInRect(pos.x, pos.y, PARK_RIGHT_RECT.x, PARK_RIGHT_RECT.y, PARK_RIGHT_RECT.w, PARK_RIGHT_RECT.h)) return "parkRight";
            if (pointInRect(pos.x, pos.y, PARK_FWD_RECT.x, PARK_FWD_RECT.y, PARK_FWD_RECT.w, PARK_FWD_RECT.h)) return "parkFwd";
            if (pointInRect(pos.x, pos.y, PARK_REV_RECT.x, PARK_REV_RECT.y, PARK_REV_RECT.w, PARK_REV_RECT.h)) return "parkRev";
            return null;
        }
        // Dina's run + Cookie Catch reuse the parking D-pad rects for their
        // on-screen buttons. Without this, taps fell through to a generic click
        // and the buttons did nothing on mobile.
        // Dina's run uses finger-drag for left/right (like Lulu's car); only the
        // sprint (⚡) and slow (🐢) buttons remain so they can be held with a
        // second finger while dragging.
        if (state === "dinaRun") {
            if (pointInRect(pos.x, pos.y, PARK_FWD_RECT.x, PARK_FWD_RECT.y, PARK_FWD_RECT.w, PARK_FWD_RECT.h)) return "parkFwd";
            if (pointInRect(pos.x, pos.y, PARK_REV_RECT.x, PARK_REV_RECT.y, PARK_REV_RECT.w, PARK_REV_RECT.h)) return "parkRev";
            return null;
        }
        // Cookie Catch slides the plate by dragging; only Pause stays a button.
        if (state === "cookieCatch") {
            if (pointInRect(pos.x, pos.y, PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, PAUSE_RECT.h)) return "pause";
            return null;
        }
        // Dina's bedroom is now drag-to-walk + tap-to-interact (no D-pad).
        return null;
    }

    function screenToCanvas(clientX, clientY) {
        // Re-read the rect every touch (never cache — stale on iOS rotate/settle).
        var rect = canvas.getBoundingClientRect();
        // If a touch lands before layout settled the rect can be 0 → NaN coords
        // → random hit-tests. Re-measure once and retry.
        if (!rect.width || !rect.height) { relayout(); rect = canvas.getBoundingClientRect(); }
        if (!rect.width || !rect.height) return { x: clientX, y: clientY };
        return {
            x: (clientX - rect.left) / rect.width * W,
            y: (clientY - rect.top) / rect.height * H
        };
    }

    // Block iOS pinch-zoom / double-tap-zoom so the visual viewport can't shift
    // out from under our touch→canvas mapping.
    document.addEventListener("gesturestart", function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener("dblclick", function (e) { e.preventDefault(); }, { passive: false });

    document.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
        if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
        if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") { keys.up = true; e.preventDefault(); }
        if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") { keys.down = true; e.preventDefault(); }
        if (e.key === " " || e.key === "Enter") { queueAction(); e.preventDefault(); }
        if (e.key === "p" || e.key === "P" || e.key === "Escape") { pauseQueued = true; e.preventDefault(); }
        if (e.key === "m" || e.key === "M") { missileQueued = true; e.preventDefault(); }
        if (e.key === "h" || e.key === "H") { honkQueued = true; e.preventDefault(); }
    });
    document.addEventListener("keyup", function (e) {
        if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
        if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
        if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") keys.up = false;
        if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") keys.down = false;
    });

    canvas.addEventListener("touchstart", function (e) {
        e.preventDefault();
        getAudio(); // unlock audio on first touch
        audioUnlocked = true;
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            var pos = screenToCanvas(t.clientX, t.clientY);
            var btn = hitGameButton(pos);

            if (btn) flashButton(btn);
            if (btn === "pause") {
                pauseQueued = true;
            } else if (btn === "missile") {
                missileQueued = true;
            } else if (btn === "honk") {
                honkQueued = true;
            } else if (btn === "boost") {
                keys.up = true;
                boostTouchId = t.identifier;
            } else if (btn === "brake") {
                keys.down = true;
                brakeTouchId = t.identifier;
            } else if (btn === "parkLeft") {
                keys.left = true;
                laneQueued = -1; // ensures a fast tap still registers a lane step
                parkLeftTouchId = t.identifier;
            } else if (btn === "parkRight") {
                keys.right = true;
                laneQueued = 1;
                parkRightTouchId = t.identifier;
            } else if (btn === "parkFwd") {
                keys.up = true;
                parkFwdTouchId = t.identifier;
            } else if (btn === "parkRev") {
                keys.down = true;
                parkRevTouchId = t.identifier;
            } else {
                // Not a button — register click (for menu/shop/game-over) and
                // start finger-drag steering. Drag-to-move scenes (Dina's run,
                // Cookie Catch, Dina's room) use the same single-finger follow as
                // Lulu's driving, so no on-screen arrows are needed.
                clickQueue = pos;
                queueAction();
                if (steerTouchId === null &&
                    (state === "playing" || state === "dinaRun" ||
                     state === "cookieCatch" || state === "dinaHome")) {
                    steerTouchId = t.identifier;
                    touchX = pos.x;
                    touchY = pos.y;
                }
            }
        }
    }, { passive: false });

    canvas.addEventListener("touchmove", function (e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            if (t.identifier === steerTouchId) {
                var pos = screenToCanvas(t.clientX, t.clientY);
                touchX = pos.x;
                touchY = pos.y;
            }
        }
    }, { passive: false });

    function releaseTouchId(id) {
        if (id === steerTouchId) { steerTouchId = null; touchX = null; touchY = null; }
        if (id === boostTouchId) { keys.up = false; boostTouchId = null; }
        if (id === brakeTouchId) { keys.down = false; brakeTouchId = null; }
        if (id === parkLeftTouchId)  { keys.left = false;  parkLeftTouchId = null; }
        if (id === parkRightTouchId) { keys.right = false; parkRightTouchId = null; }
        if (id === parkFwdTouchId)   { keys.up = false;    parkFwdTouchId = null; }
        if (id === parkRevTouchId)   { keys.down = false;  parkRevTouchId = null; }
    }

    canvas.addEventListener("touchend", function (e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
            releaseTouchId(e.changedTouches[i].identifier);
        }
    }, { passive: false });

    canvas.addEventListener("touchcancel", function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
            releaseTouchId(e.changedTouches[i].identifier);
        }
    }, { passive: false });

    canvas.addEventListener("mousedown", function (e) {
        getAudio();
        audioUnlocked = true;
        var pos = screenToCanvas(e.clientX, e.clientY);
        clickQueue = pos;
        queueAction();
    });

    // Prevent the context menu on long-press (mobile)
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    // ── Background / foreground: silence music when the app is backgrounded ──
    // On iOS the HTML5 <audio> music keeps playing after you swipe the app away
    // unless we explicitly pause it. Pause on hide, resume on return.
    function onAppHidden() {
        pauseMusic();
        if (audioCtx && audioCtx.state === "running") { try { audioCtx.suspend(); } catch (e) {} }
    }
    function onAppVisible() {
        if (audioCtx && audioCtx.state === "suspended") { try { audioCtx.resume(); } catch (e) {} }
        resumeMusic();
    }
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) onAppHidden(); else onAppVisible();
    });
    window.addEventListener("pagehide", onAppHidden);
    // Capacitor App.appStateChange is the authoritative iOS background signal
    // (maps to applicationWillResignActive / DidBecomeActive). We keep
    // visibilitychange + pagehide as the web fallback and DROP blur/focus
    // (they false-fire on iOS for keyboards / alerts).
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        try {
            window.Capacitor.Plugins.App.addListener("appStateChange", function (s) {
                if (s && s.isActive) onAppVisible(); else onAppHidden();
            });
        } catch (e) {}
    }

    function getSteer(playerX) {
        var s = 0;
        if (keys.left) s -= 1;
        if (keys.right) s += 1;
        // Mobile: finger-follow steering (continuous)
        if (touchX !== null && state === "playing") {
            var diff = touchX - playerX;
            s = clamp(diff / 35, -1.4, 1.4);
        }
        return s;
    }

    // ── Utilities ────────────────────────────────────────────
    function lerp(a, b, t) { return a + (b - a) * t; }
    function easeOutBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
    function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
    function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function easeOutElastic(t) { if (t === 0 || t === 1) return t; var c4 = (2 * Math.PI) / 3; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1; }

    // Floating particles for +1 text bursts on pickup
    var floaters = [];
    function spawnFloater(x, y, txt, color) {
        floaters.push({ kind: "text", x: x, y: y, t: 0, dur: 0.8, txt: txt, color: color || "#FFD700" });
    }
    function updateFloaters(dt) {
        for (var i = floaters.length - 1; i >= 0; i--) {
            floaters[i].t += dt;
            if (floaters[i].t >= floaters[i].dur) floaters.splice(i, 1);
        }
    }
    function drawFloaters() {
        for (var i = 0; i < floaters.length; i++) {
            var f = floaters[i];
            var p = f.t / f.dur;
            ctx.globalAlpha = 1 - easeOutQuad(p);
            drawText(f.txt, f.x, f.y - 40 * easeOutQuad(p),
                "bold 20px 'Segoe UI', Arial, sans-serif", f.color, "#000", 4);
            ctx.globalAlpha = 1;
        }
    }

    // Scene fade transition — fade-to-dark-then-out on state changes
    var sceneFade = { t: 1, dur: 0.35, next: null, fired: true, onMid: null };
    // Returns true if a transition actually started (false if one is already running).
    // onMid (optional) runs once at the fade midpoint — use it to init the next scene.
    function gotoState(newState, onMid) {
        if (sceneFade.t < sceneFade.dur) return false; // already transitioning
        sceneFade = { t: 0, dur: 0.35, next: newState, fired: false, onMid: onMid || null };
        return true;
    }
    function updateSceneFade(dt) {
        if (sceneFade.t >= sceneFade.dur) return;
        sceneFade.t += dt;
        if (!sceneFade.fired && sceneFade.t >= sceneFade.dur / 2) {
            state = sceneFade.next;
            if (sceneFade.onMid) sceneFade.onMid();
            sceneFade.fired = true;
        }
    }
    function drawSceneFade() {
        if (sceneFade.t >= sceneFade.dur) return;
        var p = sceneFade.t / sceneFade.dur;
        var a = p < 0.5 ? easeInOutQuad(p * 2) : easeInOutQuad((1 - p) * 2);
        ctx.fillStyle = "rgba(15,10,30," + (a * 0.85) + ")";
        ctx.fillRect(0, 0, W, H);
    }

    // Button press visual feedback — register hit, draw a brief overlay
    var btnPressFx = {};
    function flashButton(id) { btnPressFx[id] = { t: 0, dur: 0.22 }; }
    function getBtnPressScale(id) {
        var fx = btnPressFx[id];
        if (!fx) return 1;
        var p = clamp(fx.t / fx.dur, 0, 1);
        if (p < 0.5) return 1 - 0.10 * Math.sin(p * Math.PI);
        return 1 + 0.05 * easeOutBack((p - 0.5) * 2) * (1 - p);
    }
    function updateBtnPressFx(dt) {
        for (var k in btnPressFx) {
            btnPressFx[k].t += dt;
            if (btnPressFx[k].t >= btnPressFx[k].dur) delete btnPressFx[k];
        }
    }
    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
    function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
    function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
    function randPick(arr) { return arr[randInt(0, arr.length - 1)]; }

    function roundRect(x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }

    function drawText(text, x, y, font, fill, outline, outW, align) {
        ctx.font = font;
        ctx.textAlign = align || "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        if (outline) {
            ctx.strokeStyle = outline;
            ctx.lineWidth = outW || 4;
            ctx.strokeText(text, x, y);
        }
        ctx.fillStyle = fill;
        ctx.fillText(text, x, y);
    }

    function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
        return Math.abs(ax - bx) < (aw + bw) / 2 &&
               Math.abs(ay - by) < (ah + bh) / 2;
    }

    function shadeColor(hex, amount) {
        var col = hexToRgb(hex);
        return rgbToHex(clamp(col.r + amount, 0, 255), clamp(col.g + amount, 0, 255), clamp(col.b + amount, 0, 255));
    }

    function hexToRgb(hex) {
        return {
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16)
        };
    }

    function rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    function formatNum(n) {
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function pointInRect(px, py, x, y, w, h) {
        return px >= x && px <= x + w && py >= y && py <= y + h;
    }

    // ── Particle System ──────────────────────────────────────
    var particles = [];

    function spawnCoinSparkle(x, y) {
        for (var i = 0; i < 8; i++) {
            var angle = (Math.PI * 2 / 8) * i;
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * rand(60, 120),
                vy: Math.sin(angle) * rand(60, 120),
                life: 0.45, maxLife: 0.45,
                size: rand(2, 5),
                color: Math.random() > 0.5 ? C.coin : C.coinShine,
                gravity: 0
            });
        }
    }

    function spawnCrashBurst(x, y, big) {
        var cols = ["#FF5722", "#FF9800", "#F44336", "#9E9E9E", "#FFD700", "#FFC107"];
        var count = big ? 40 : 16;
        for (var i = 0; i < count; i++) {
            var angle = rand(0, Math.PI * 2);
            var spd = rand(big ? 120 : 80, big ? 380 : 250);
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                life: rand(0.6, big ? 1.4 : 1.0), maxLife: big ? 1.2 : 0.8,
                size: rand(big ? 4 : 3, big ? 12 : 8),
                color: randPick(cols),
                gravity: 350
            });
        }
        // Smoke particles
        if (big) {
            for (var j = 0; j < 15; j++) {
                var ang = rand(0, Math.PI * 2);
                particles.push({
                    x: x + rand(-10, 10), y: y + rand(-10, 10),
                    vx: Math.cos(ang) * rand(20, 60),
                    vy: Math.sin(ang) * rand(-80, -20),
                    life: rand(1.0, 2.0), maxLife: 1.5,
                    size: rand(8, 16),
                    color: randPick(["#424242", "#616161", "#9E9E9E"]),
                    gravity: -30,
                    smoke: true
                });
            }
        }
    }

    function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += p.gravity * dt;
            p.life -= dt;
            if (p.smoke) p.size += dt * 8;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function drawParticles() {
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            var alpha = clamp(p.life / p.maxLife, 0, 1);
            ctx.globalAlpha = p.smoke ? alpha * 0.6 : alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (p.smoke ? 1 : alpha), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ── Decorations ──────────────────────────────────────────
    var decorations = [];
    var decoTimer = 0;

    function initDecorations() {
        decorations = [];
        for (var y = -100; y < H + 100; y += 70) pushDeco(y, true);
    }

    function pushDeco(y, both) {
        if (both) {
            pushDecoSide(y, -1);
            pushDecoSide(y + rand(-30, 30), 1);
        } else {
            pushDecoSide(y, Math.random() > 0.5 ? -1 : 1);
        }
    }

    function pushDecoSide(y, side) {
        var type = Math.random();
        var x = side < 0 ? rand(10, ROAD_L - 15) : rand(ROAD_R + 15, W - 10);
        var d = { x: x, y: y, side: side, parallax: rand(0.55, 0.85) };
        var cfg = SEASONS[season];
        // In city zones the shoulder is sidewalk railings, not forest, so the
        // themed buildings read clearly behind them.
        if (zone !== "rural") {
            d.type = "fence"; d.width = rand(28, 50);
            decorations.push(d);
            return;
        }
        // Winter sprinkles snow piles along the shoulder.
        if (cfg.bare && type < 0.16) {
            d.type = "snowpile"; d.scale = rand(0.7, 1.2);
        } else if (type < 0.50) {
            d.type = "tree"; d.scale = rand(0.7, 1.1); d.swayOffset = rand(0, Math.PI * 2);
        } else if (type < 0.72) {
            d.type = "bush"; d.scale = rand(0.6, 1.0); d.bounceOffset = rand(0, Math.PI * 2);
        } else if (type < 0.72 + cfg.flower) {
            // Flower frequency follows the season (lush in spring, none in winter).
            d.type = "flower"; d.color = randPick(C.flower); d.scale = rand(0.5, 0.8);
        } else {
            d.type = "fence"; d.width = rand(30, 55);
        }
        decorations.push(d);
    }

    function updateDecorations(dt, speed) {
        for (var i = decorations.length - 1; i >= 0; i--) {
            decorations[i].y += speed * decorations[i].parallax * dt;
            if (decorations[i].y > H + 80) decorations.splice(i, 1);
        }
        decoTimer -= dt;
        if (decoTimer <= 0) {
            decoTimer = rand(0.15, 0.4);
            pushDeco(-rand(40, 100), false);
        }
    }

    // ── Seasons / weather ────────────────────────────────────
    // The world cycles through seasons every ~SEASON_DISTANCE of travel. Each
    // season retints the sky/grass/foliage, sets a weather effect, a darkness
    // level, and a puddle-frequency multiplier. Easy to tweak below.
    var SEASONS = {
        summer: { name: "Summer ☀️", sky: ["#A8E6CF", "#7CCB7E", "#5BA85D"], grass: "#66BB6A",
                  trees: ["#2E7D32", "#388E3C", "#43A047"], bushes: ["#66BB6A", "#4CAF50", "#388E3C"],
                  dark: 0, weather: null, puddleMul: 1, flower: 0.15, bare: false },
        spring: { name: "Spring 🌸", sky: ["#BFE9FF", "#CDEFC4", "#9CD98C"], grass: "#7CC36A",
                  trees: ["#7CB342", "#9CCC65", "#AED581"], bushes: ["#9CCC65", "#7CB342", "#689F38"],
                  dark: 0, weather: "petals", puddleMul: 1, flower: 0.34, bare: false },
        fall:   { name: "Fall 🍂", sky: ["#FFE0B2", "#F6C98E", "#D9A05B"], grass: "#C2A14B",
                  trees: ["#E65100", "#EF6C00", "#F9A825"], bushes: ["#C0691E", "#A0522D", "#8D4E1E"],
                  dark: 0.05, weather: "leaves", puddleMul: 1, flower: 0.05, bare: false },
        winter: { name: "Winter ❄️", sky: ["#D4E6F1", "#C2D8E8", "#AEC9DC"], grass: "#E8EEF2",
                  trees: ["#9DB1B8", "#8D9499", "#B0BEC5"], bushes: ["#E0E8EC", "#C5D2D8", "#A7B8C0"],
                  dark: 0.12, weather: "snow", puddleMul: 1.5, flower: 0, bare: true },
        rain:   { name: "Rainy 🌧️", sky: ["#9AABB5", "#80949F", "#65808C"], grass: "#4E7A52",
                  trees: ["#2E5E32", "#356B39", "#3E7A42"], bushes: ["#3E7A42", "#356B39", "#2E5E32"],
                  dark: 0.22, weather: "rain", puddleMul: 2.4, flower: 0.08, bare: false },
        storm:  { name: "Thunderstorm ⛈️", sky: ["#5C6670", "#474F57", "#363C42"], grass: "#3E5E44",
                  trees: ["#23421F", "#2A4D26", "#33592E"], bushes: ["#33592E", "#2A4D26", "#23421F"],
                  dark: 0.38, weather: "rain", puddleMul: 2.6, flower: 0.05, bare: false, lightning: true },
        night:  { name: "Night 🌙", sky: ["#1A2238", "#222A45", "#2A3350"], grass: "#2E4A36",
                  trees: ["#1B3A22", "#234A2A", "#2A5530"], bushes: ["#234A2A", "#1B3A22", "#163018"],
                  dark: 0.5, weather: null, puddleMul: 1, flower: 0.05, bare: false, night: true },
        fog:    { name: "Foggy 🌫️", sky: ["#C8CDD0", "#BFC4C7", "#B4B9BC"], grass: "#6E8270",
                  trees: ["#4A6B4E", "#557056", "#5E7A5F"], bushes: ["#5E7A5F", "#557056", "#4A6B4E"],
                  dark: 0.06, weather: null, puddleMul: 1.1, flower: 0.08, bare: false, fog: true },
        heatwave: { name: "Heat Wave 🥵", sky: ["#FFE08A", "#FFC85E", "#FBA94C"], grass: "#B8A24E",
                  trees: ["#9C8A3C", "#A8923F", "#B89C44"], bushes: ["#B89C44", "#A8923F", "#9C8A3C"],
                  dark: 0, weather: "dust", puddleMul: 0.3, flower: 0.04, bare: false, heat: true }
    };
    var SEASON_ORDER = ["spring", "fall", "winter", "rain", "storm", "night", "fog", "heatwave"];
    var SEASON_DISTANCE = 24000;  // px of travel between season changes (longer = rarer)

    var season = "summer", prevSeason = "summer", seasonBlend = 1;
    var seasonNextAt = SEASON_DISTANCE, seasonBannerT = 0;
    var weatherBits = [], weatherAccum = 0;
    var lightningFlash = 0, lightningTimer = 4, lightningStrike = null;

    function initSeason() {
        season = "summer"; prevSeason = "summer"; seasonBlend = 1;
        seasonNextAt = SEASON_DISTANCE + rand(-5000, 6000);
        seasonBannerT = 0; weatherBits = []; weatherAccum = 0;
        lightningFlash = 0; lightningTimer = rand(2, 5); lightningStrike = null;
    }
    function changeSeason() {
        prevSeason = season;
        // Spend most of the time in plain Summer; specials are occasional. If
        // we're in a special season, usually return to Summer; from Summer, pick
        // a random special one.
        var pick;
        if (season !== "summer" && Math.random() < 0.55) {
            pick = "summer";
        } else {
            var tries = 0; pick = season;
            while (pick === season && tries < 12) { pick = randPick(SEASON_ORDER); tries++; }
        }
        season = pick;
        seasonBlend = 0;
        seasonNextAt = scrollOffset + SEASON_DISTANCE + rand(-5000, 6000);
        seasonBannerT = 0;
        lightningTimer = rand(1.5, 4);
    }
    // Transition to a SPECIFIC season (used for atmospheric zone pairings).
    function setSeason(target) {
        if (!SEASONS[target] || target === season) return;
        prevSeason = season;
        season = target;
        seasonBlend = 0;
        lightningTimer = rand(1.5, 4);
    }
    function curSeason() { return SEASONS[season]; }
    function lerpColor(a, b, t) {
        var ca = hexToRgb(a), cb = hexToRgb(b);
        return rgbToHex(Math.round(lerp(ca.r, cb.r, t)), Math.round(lerp(ca.g, cb.g, t)), Math.round(lerp(ca.b, cb.b, t)));
    }
    function seasonSky(i) { return lerpColor(SEASONS[prevSeason].sky[i], SEASONS[season].sky[i], seasonBlend); }
    function seasonGrass() { return lerpColor(SEASONS[prevSeason].grass, SEASONS[season].grass, seasonBlend); }
    function seasonDark() { return lerp(SEASONS[prevSeason].dark, SEASONS[season].dark, seasonBlend); }

    function updateSeason(dt, speed) {
        if (seasonBlend < 1) seasonBlend = Math.min(1, seasonBlend + dt / 1.8);
        if (seasonBannerT > 0) seasonBannerT -= dt;
        if (scrollOffset >= seasonNextAt) changeSeason();
        var cfg = SEASONS[season];
        // spawn weather
        var rate = cfg.weather === "rain" ? 95 : cfg.weather === "snow" ? 30
                 : cfg.weather === "leaves" ? 11 : cfg.weather === "petals" ? 9
                 : cfg.weather === "dust" ? 24 : 0;
        if (rate > 0 && seasonBlend > 0.25) {
            weatherAccum += rate * dt;
            while (weatherAccum >= 1) { weatherAccum -= 1; pushWeatherBit(cfg.weather, speed); }
            // spring also gets the occasional butterfly fluttering across
            if (cfg.weather === "petals" && Math.random() < dt * 0.4) pushButterfly();
        }
        for (var i = weatherBits.length - 1; i >= 0; i--) {
            var w = weatherBits[i];
            w.x += w.vx * dt; w.y += w.vy * dt;
            if (w.spin !== undefined) w.rot += w.spin * dt;
            if (w.flap !== undefined) w.flap += dt * 14;
            w.life -= dt;
            if (w.y > H + 24 || w.life <= 0 || w.x < -40 || w.x > W + 40) weatherBits.splice(i, 1);
        }
        // lightning
        if (lightningFlash > 0) lightningFlash = Math.max(0, lightningFlash - dt * 3);
        if (lightningStrike) { lightningStrike.t += dt; if (lightningStrike.t > 0.28) lightningStrike = null; }
        if (cfg.lightning && seasonBlend > 0.5) {
            lightningTimer -= dt;
            if (lightningTimer <= 0) { lightningTimer = rand(3, 8); triggerLightning(); }
        }
    }

    function pushWeatherBit(kind, speed) {
        if (kind === "rain") {
            weatherBits.push({ kind: "rain", x: rand(-20, W + 30), y: -20, vx: -120,
                vy: 900 + speed * 0.4, len: rand(10, 18), life: 2 });
        } else if (kind === "snow") {
            weatherBits.push({ kind: "snow", x: rand(0, W), y: -10, vx: rand(-15, 15),
                vy: rand(55, 105) + speed * 0.12, r: rand(1.5, 3.5), sway: rand(0, 6.28), life: 14 });
        } else if (kind === "leaves") {
            weatherBits.push({ kind: "leaf", x: rand(0, W), y: -15, vx: rand(-45, 45),
                vy: rand(70, 130) + speed * 0.2, rot: rand(0, 6.28), spin: rand(-4, 4),
                r: rand(4, 7), color: randPick(["#E65100", "#F57F17", "#FF8F00", "#BF360C"]), life: 12 });
        } else if (kind === "petals") {
            weatherBits.push({ kind: "petal", x: rand(0, W), y: -15, vx: rand(-30, 30),
                vy: rand(50, 90) + speed * 0.15, rot: rand(0, 6.28), spin: rand(-3, 3),
                r: rand(3, 5), color: randPick(["#FF80AB", "#F8BBD0", "#FFCDD2", "#F48FB1"]), life: 12 });
        } else if (kind === "dust") {
            var d2 = Math.random() < 0.5 ? 1 : -1;
            weatherBits.push({ kind: "dust", x: d2 > 0 ? -20 : W + 20, y: rand(H * 0.25, H - 50),
                vx: d2 * rand(180, 340), vy: rand(-12, 12), r: rand(2, 5),
                color: randPick(["#D2B48C", "#C9A66B", "#E0C28A"]), life: 4 });
        }
    }
    function pushButterfly() {
        var dir = Math.random() < 0.5 ? 1 : -1;
        weatherBits.push({ kind: "butterfly", x: dir > 0 ? -20 : W + 20, y: rand(60, H * 0.55),
            vx: dir * rand(60, 100), vy: rand(-10, 10), flap: rand(0, 6.28),
            color: randPick(["#FF7043", "#AB47BC", "#42A5F5", "#FFCA28"]), life: 9, dir: dir });
    }

    function triggerLightning() {
        lightningFlash = 1;
        playThunder();
        if (Math.random() < 0.45 && typeof obstacles !== "undefined" && obstacles && obstacles.length) {
            var cand = [];
            for (var i = 0; i < obstacles.length; i++) {
                var o = obstacles[i];
                if (o.y > 30 && o.y < H - 130 && (o.type === "car" || o.type === "cone" || o.type === "ped")) cand.push(i);
            }
            if (cand.length) {
                var idx = randPick(cand);
                var ob = obstacles[idx];
                lightningStrike = { x: ob.x, y: ob.y, t: 0 };
                spawnCrashBurst(ob.x, ob.y, true);
                obstacles.splice(idx, 1);
            }
        }
    }

    function drawWeather() {
        for (var i = 0; i < weatherBits.length; i++) {
            var w = weatherBits[i];
            if (w.kind === "rain") {
                ctx.strokeStyle = "rgba(185,212,235,0.55)"; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(w.x - 3, w.y - w.len); ctx.stroke();
            } else if (w.kind === "snow") {
                ctx.fillStyle = "rgba(255,255,255,0.9)";
                ctx.beginPath(); ctx.arc(w.x + Math.sin(w.sway + w.y * 0.04) * 8, w.y, w.r, 0, Math.PI * 2); ctx.fill();
            } else if (w.kind === "butterfly") {
                ctx.save(); ctx.translate(w.x, w.y);
                var flap = Math.abs(Math.sin(w.flap)) * 0.8 + 0.2;
                ctx.fillStyle = w.color;
                ctx.beginPath(); ctx.ellipse(-3, 0, 3 * flap, 4, -0.4, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(3, 0, 3 * flap, 4, 0.4, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = "#3E2723";
                ctx.fillRect(-0.6, -3, 1.2, 6);
                ctx.restore();
            } else if (w.kind === "dust") {
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = w.color;
                ctx.beginPath(); ctx.ellipse(w.x, w.y, w.r * 2.2, w.r, 0, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
            } else { // leaf / petal
                ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.rot);
                ctx.fillStyle = w.color;
                ctx.beginPath(); ctx.ellipse(0, 0, w.r, w.r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
        }
    }

    // Darkness tint + weather + lightning + season banner. Drawn over the world
    // (call after the scene, before the HUD).
    function drawSeasonFx() {
        var cfg = curSeason();
        var dk = seasonDark();
        if (dk > 0.001) { ctx.fillStyle = "rgba(12,16,38," + dk + ")"; ctx.fillRect(0, 0, W, H); }
        if (cfg.night && seasonBlend > 0.35) drawNightFx();
        if (cfg.fog) drawFogFx();
        if (cfg.heat) drawHeatFx();
        drawWeather();
        if (lightningStrike && lightningStrike.t < 0.18) {
            ctx.strokeStyle = "#FFFDE7"; ctx.lineWidth = 3; ctx.lineCap = "round";
            ctx.beginPath();
            var lx = lightningStrike.x, ly = 0;
            ctx.moveTo(lx, 0);
            while (ly < lightningStrike.y) { ly += rand(20, 42); lx += rand(-18, 18); ctx.lineTo(lx, ly); }
            ctx.stroke(); ctx.lineCap = "butt";
        }
        if (lightningFlash > 0) { ctx.fillStyle = "rgba(255,255,255," + (lightningFlash * 0.5) + ")"; ctx.fillRect(0, 0, W, H); }
    }

    function drawNightFx() {
        // Headlight beams from Lulu's car lighting the road ahead
        if (typeof player !== "undefined" && player) {
            var hx = player.x, hy = player.y - 34;
            var g = ctx.createLinearGradient(0, hy, 0, hy - 200);
            g.addColorStop(0, "rgba(255,248,200,0.20)");
            g.addColorStop(1, "rgba(255,248,200,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(hx - 13, hy); ctx.lineTo(hx - 62, hy - 200);
            ctx.lineTo(hx + 62, hy - 200); ctx.lineTo(hx + 13, hy);
            ctx.closePath(); ctx.fill();
        }
    }
    function drawFogFx() {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "rgba(222,226,229,0.62)");
        g.addColorStop(0.5, "rgba(222,226,229,0.36)");
        g.addColorStop(1, "rgba(222,226,229,0.16)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        for (var i = 0; i < 4; i++) {
            var fy = ((gameTime * 16 + i * 130) % (H + 120)) - 60;
            ctx.fillStyle = "rgba(238,240,242,0.12)";
            ctx.beginPath(); ctx.ellipse(W / 2, fy, W * 0.72, 42, 0, 0, Math.PI * 2); ctx.fill();
        }
    }
    function drawHeatFx() {
        ctx.fillStyle = "rgba(255,176,72,0.10)"; ctx.fillRect(0, 0, W, H);
        // wavering heat-shimmer bands near the horizon
        for (var i = 0; i < 7; i++) {
            var yy = H * 0.12 + i * 16 + Math.sin(gameTime * 3 + i) * 3;
            ctx.fillStyle = "rgba(255,255,255,0.05)";
            ctx.fillRect(0, yy, W, 4);
        }
    }

    // ── City zones (themed scenery stretches) ────────────────
    // Most of the drive is rural. Occasionally you pass through a CITY zone with
    // themed roadside buildings and matching traffic: a bar district (drunk
    // drivers), police HQ (lots of cops), a school zone (kids crossing), or
    // downtown (texting drivers). Zones last a good stretch so they don't flash by.
    var ZONE_CITY = ["bars", "police", "school", "downtown", "hospital", "construction", "gas", "market"];
    var ZONE_NAMES = {
        bars: "Bar District 🍸", police: "Police HQ 🚓", school: "School Zone 🏫", downtown: "Downtown 🏙️",
        hospital: "Hospital 🏥", construction: "Construction 🚧", gas: "Gas Station ⛽", market: "Farmers Market 🧺"
    };
    // Each city often arrives with a fitting sky (atmospheric combos).
    var ZONE_SEASON = {
        bars: ["night", "night", "rain"], downtown: ["night", "fog", "rain"],
        police: ["night", "rain"], school: ["summer", "spring"],
        market: ["summer", "spring"], construction: ["summer", "heatwave"],
        hospital: ["summer", "fog"], gas: ["summer", "night"]
    };
    var ZONE_RURAL_GAP = 13000;   // px of rural driving between city visits
    var zone = "rural";
    var zoneEndsAt = 0, zoneNextAt = ZONE_RURAL_GAP;
    var cityBuildings = [], cityBuildTimer = 0;

    function initZone() {
        zone = "rural";
        zoneNextAt = ZONE_RURAL_GAP + rand(-3000, 5000);
        zoneEndsAt = 0; cityBuildings = []; cityBuildTimer = 0;
    }
    function updateZone(dt, speed) {
        if (zone === "rural") {
            if (scrollOffset >= zoneNextAt) {
                zone = randPick(ZONE_CITY);
                zoneEndsAt = scrollOffset + rand(7000, 11000); // long enough to feel it
                cityBuildTimer = 0;
                // Atmospheric pairing: a city often brings a fitting sky.
                if (ZONE_SEASON[zone] && Math.random() < 0.6) setSeason(randPick(ZONE_SEASON[zone]));
            }
        } else {
            if (scrollOffset >= zoneEndsAt) {
                zone = "rural";
                zoneNextAt = scrollOffset + ZONE_RURAL_GAP + rand(-3000, 5000);
            }
            cityBuildTimer -= dt;
            if (cityBuildTimer <= 0) {
                // Spaced out + sides chosen independently so it's a streetscape,
                // not a solid wall of identical boxes.
                cityBuildTimer = rand(1.0, 1.8);
                if (Math.random() < 0.85) spawnCityBuilding(-1);
                if (Math.random() < 0.7) spawnCityBuilding(1);
            }
        }
        for (var i = cityBuildings.length - 1; i >= 0; i--) {
            cityBuildings[i].y += speed * dt;
            if (cityBuildings[i].y > H + 160) cityBuildings.splice(i, 1);
        }
    }
    function spawnCityBuilding(side) {
        var shortKind = (zone === "market" || zone === "gas");
        var w = rand(50, 74);
        var h = shortKind ? rand(58, 82) : rand(74, zone === "downtown" ? 162 : 126);
        var x = side < 0 ? rand(6, Math.max(8, ROAD_L - w - 6)) + w / 2
                         : rand(ROAD_R + 6, W - w - 6) + w / 2;
        // All variety is chosen ONCE here (stable per building → no flicker).
        var label = zone === "bars" ? randPick(BAR_NAMES)
                  : zone === "school" ? randPick(SCHOOL_NAMES)
                  : BUILD_LABEL[zone];
        cityBuildings.push({ x: x, y: -h - 36, side: side, kind: zone, w: w, h: h,
            lit: Math.random() < 0.72, tint: randInt(0, 2), seed: randInt(1, 997),
            style: randInt(0, 2), roof: randInt(0, 2), shade: randInt(-12, 12),
            label: label, glow: zone === "bars" && Math.random() < 0.3,
            signC: zone === "bars" ? randPick(["#FF4FA3", "#4FC3F7", "#FFD54F", "#AED581", "#FF8A65"]) : BUILD_SIGN[zone],
            roofC: randPick(["#5D4037", "#455A64", "#37474F", "#6D4C41", "#4E342E", "#827717"]),
            awn: [randInt(0, 3), randInt(0, 3)], prod: [randInt(0, 4), randInt(0, 4), randInt(0, 4)] });
    }
    function drawCityBuildings() {
        for (var i = 0; i < cityBuildings.length; i++) drawBuilding(cityBuildings[i]);
    }
    // Draw bold text shrunk to fit maxW (stops names spilling out of buildings).
    function drawFitText(text, cx, cy, maxW, basePx, color, outline) {
        var px = basePx;
        ctx.font = "bold " + px + "px 'Segoe UI', Arial, sans-serif";
        while (px > 5 && ctx.measureText(text).width > maxW) {
            px--; ctx.font = "bold " + px + "px 'Segoe UI', Arial, sans-serif";
        }
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
        if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 3; ctx.strokeText(text, cx, cy); }
        ctx.fillStyle = color; ctx.fillText(text, cx, cy);
    }
    var BUILD_BODY = {
        bars: ["#3E2C4F", "#4A3A5C", "#5C2E52"], police: ["#37474F", "#455A64", "#2E3D44"],
        school: ["#9C4A3C", "#A85A48", "#8C4234"], downtown: ["#546E7A", "#607D8B", "#7E8A93"],
        hospital: ["#ECEFF1", "#E0E4E7", "#F5F7F8"], construction: ["#9E8E6E", "#8C7D5E", "#A89A7C"],
        gas: ["#C62828", "#B71C1C", "#D32F2F"], market: ["#6D4C41", "#7B5A4C", "#5D4037"]
    };
    var BUILD_LABEL = { bars: "BAR", police: "POLICE", school: "SCHOOL", hospital: "HOSPITAL", gas: "GAS", market: "MARKET" };
    var BAR_NAMES = ["BAR", "PUB", "LOUNGE", "KARAOKE", "TAVERN", "JUICE BAR"];
    var SCHOOL_NAMES = ["SCHOOL", "BAIS YAAKOV", "CHEDER", "ACADEMY", "DAY SCHOOL"];
    var BUILD_SIGN = { bars: "#FF4FA3", police: "#42A5F5", school: "#FFD54F", hospital: "#E53935", gas: "#FFEB3B", market: "#AED581" };
    var AWN_COLS = ["#E53935", "#43A047", "#1E88E5", "#FB8C00"];
    var PRODUCE = ["#FF7043", "#FFCA28", "#8BC34A", "#E53935", "#AB47BC"];
    function drawMarketStall(b) {
        var x = b.x - b.w / 2, w = b.w, baseY = b.y + b.h, stallH = 56, top = baseY - stallH;
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        ctx.beginPath(); ctx.ellipse(x + w / 2, baseY - 2, w / 2, 7, 0, 0, Math.PI * 2); ctx.fill();
        // posts + back board
        ctx.fillStyle = "#8D6E63"; ctx.fillRect(x + 2, top + 10, 5, stallH - 10); ctx.fillRect(x + w - 7, top + 10, 5, stallH - 10);
        ctx.fillStyle = "#BCAAA4"; ctx.fillRect(x + 5, top + 12, w - 10, stallH - 30);
        // produce crates
        var crateY = baseY - 24, cw = (w - 12) / 3;
        for (var c = 0; c < 3; c++) {
            var cx0 = x + 6 + c * cw;
            ctx.fillStyle = "#6D4C41"; ctx.fillRect(cx0, crateY, cw - 2, 16);
            ctx.fillStyle = "#5D4037"; ctx.fillRect(cx0, crateY, cw - 2, 3);
            ctx.fillStyle = PRODUCE[b.prod[c]];
            for (var p = 0; p < 4; p++) {
                ctx.beginPath();
                ctx.arc(cx0 + 4 + (p % 2) * (cw - 12), crateY - 1 - Math.floor(p / 2) * 4, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.fillStyle = "#8D6E63"; ctx.fillRect(x + 2, baseY - 8, w - 4, 8); // counter front
        // striped scalloped awning
        var a1 = AWN_COLS[b.awn[0]], awY = top - 2, awH = 15, sw0 = 10;
        for (var s = 0; s < w; s += sw0) {
            var sw = Math.min(sw0, w - s);
            ctx.fillStyle = ((s / sw0) % 2) ? "#FAFAFA" : a1;
            ctx.fillRect(x + s, awY, sw, awH);
            ctx.beginPath(); ctx.moveTo(x + s, awY + awH); ctx.lineTo(x + s + sw / 2, awY + awH + 6); ctx.lineTo(x + s + sw, awY + awH); ctx.closePath(); ctx.fill();
        }
        // sign
        ctx.fillStyle = "#3E2723"; roundRect(x + 6, top - 19, w - 12, 14, 3); ctx.fill();
        drawFitText(b.label || "MARKET", x + w / 2, top - 12, w - 16, 9, "#FFF59D");
    }

    function drawSchool(b) {
        var x = b.x - b.w / 2, y = b.y, w = b.w, h = b.h, wi, wy, wx;
        ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(x + 4, y + 8, w, h);
        ctx.fillStyle = shadeColor("#9C4A3C", b.shade); ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = "rgba(0,0,0,0.1)"; ctx.lineWidth = 1;
        for (var br = y + 9; br < y + h; br += 9) { ctx.beginPath(); ctx.moveTo(x, br); ctx.lineTo(x + w, br); ctx.stroke(); }
        ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        // arched windows (deterministic lit), leaving room for the door banner
        wi = 0;
        for (wy = y + 14; wy < y + h - 34; wy += 19) {
            for (wx = x + 9; wx < x + w - 11; wx += 17) {
                wi++;
                ctx.fillStyle = (b.lit && ((wi * 37 + b.seed) % 10 < 6)) ? "#FFE082" : "#BBDEFB";
                ctx.beginPath();
                ctx.moveTo(wx, wy + 9); ctx.lineTo(wx, wy + 3); ctx.arc(wx + 5, wy + 3, 5, Math.PI, 0); ctx.lineTo(wx + 10, wy + 9); ctx.closePath();
                ctx.fill(); ctx.strokeStyle = "#FFF"; ctx.lineWidth = 1; ctx.stroke();
            }
        }
        // peaked roof + bell cupola
        ctx.fillStyle = b.roofC; ctx.beginPath();
        ctx.moveTo(x - 4, y); ctx.lineTo(x + w / 2, y - 18); ctx.lineTo(x + w + 4, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#FAFAFA"; ctx.fillRect(x + w / 2 - 5, y - 28, 10, 12);
        ctx.fillStyle = b.roofC; ctx.beginPath();
        ctx.moveTo(x + w / 2 - 6, y - 28); ctx.lineTo(x + w / 2, y - 36); ctx.lineTo(x + w / 2 + 6, y - 28); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#FFD54F"; ctx.beginPath(); ctx.arc(x + w / 2, y - 22, 2.5, 0, Math.PI * 2); ctx.fill();
        // double doors
        ctx.fillStyle = "#4E342E"; ctx.fillRect(x + w / 2 - 9, y + h - 18, 18, 18);
        ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + w / 2, y + h - 18); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
        // fitted name banner over the door
        ctx.fillStyle = "#FFFFFF"; roundRect(x + 4, y + h - 33, w - 8, 13, 2); ctx.fill();
        ctx.strokeStyle = "#5D4037"; ctx.lineWidth = 1; roundRect(x + 4, y + h - 33, w - 8, 13, 2); ctx.stroke();
        drawFitText(b.label || "SCHOOL", x + w / 2, y + h - 26, w - 12, 9, "#5D4037");
    }

    function drawBuilding(b) {
        var x = b.x - b.w / 2, y = b.y, w = b.w, h = b.h;
        if (b.kind === "market") { drawMarketStall(b); return; }
        if (b.kind === "school") { drawSchool(b); return; }
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(x + 4, y + 8, w, h);
        ctx.fillStyle = shadeColor((BUILD_BODY[b.kind] || BUILD_BODY.downtown)[b.tint], b.shade || 0);
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        if (b.kind === "construction") {
            // concrete shell: floor slabs + columns
            ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.lineWidth = 1;
            for (var cf = y + 14; cf < y + h; cf += 15) { ctx.beginPath(); ctx.moveTo(x, cf); ctx.lineTo(x + w, cf); ctx.stroke(); }
            for (var cc = x + 9; cc < x + w; cc += 16) { ctx.beginPath(); ctx.moveTo(cc, y); ctx.lineTo(cc, y + h); ctx.stroke(); }
            // exposed rebar poking out of the top
            ctx.strokeStyle = "#B0BEC5"; ctx.lineWidth = 1.5;
            for (var rb = x + 6; rb < x + w; rb += 8) { ctx.beginPath(); ctx.moveTo(rb, y); ctx.lineTo(rb + (rb % 3 - 1) * 2, y - 7); ctx.stroke(); }
            // scaffolding on the road-facing edge (poles + diagonals)
            var sfx = b.side < 0 ? x + w - 7 : x + 1;
            ctx.strokeStyle = "#64B5F6"; ctx.lineWidth = 1.5;
            ctx.strokeRect(sfx, y + 6, 6, h - 10);
            for (var sy = y + 6; sy < y + h - 12; sy += 14) { ctx.beginPath(); ctx.moveTo(sfx, sy); ctx.lineTo(sfx + 6, sy + 14); ctx.stroke(); }
            // hazard stripes at the base
            for (var sc = 0; sc < w; sc += 8) { ctx.fillStyle = (sc / 8) % 2 ? "#1A1A1A" : "#FFC107"; ctx.fillRect(x + sc, y + h - 7, 8, 7); }
            // tower crane rising beside the shell
            var crX = b.side < 0 ? x + w + 5 : x - 5, jib = b.side < 0 ? 1 : -1;
            ctx.strokeStyle = "#FB8C00"; ctx.lineWidth = 3; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(crX, y + 12); ctx.lineTo(crX, y - 52); ctx.stroke();             // mast
            ctx.beginPath(); ctx.moveTo(crX - jib * 12, y - 50); ctx.lineTo(crX + jib * 38, y - 50); ctx.stroke(); // jib + counter-jib
            ctx.lineCap = "butt";
            ctx.fillStyle = "#FB8C00"; ctx.fillRect(crX - 4, y - 56, 8, 7);                                // operator cab
            var lx = crX + jib * 30, lyb = y - 50 + 14 + Math.sin(gameTime * 1.6) * 4;                     // hanging load (bobs)
            ctx.strokeStyle = "#546E7A"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, y - 50); ctx.lineTo(lx, lyb); ctx.stroke();
            ctx.fillStyle = "#78909C"; ctx.fillRect(lx - 4, lyb, 8, 7);
            return;
        }
        if (b.kind === "gas") {
            // bright canopy + a pump out front
            ctx.fillStyle = "#FAFAFA"; ctx.fillRect(x - 2, y - 10, w + 4, 12);
            ctx.fillStyle = "#C62828"; ctx.fillRect(x - 2, y - 10, w + 4, 4);
            ctx.fillStyle = "#1A1A1A"; roundRect(x + w / 2 - 18, y - 30, 36, 18, 3); ctx.fill();
            drawText("⛽GAS", x + w / 2, y - 21, "bold 10px 'Segoe UI', Arial, sans-serif", "#FFEB3B", null, 0);
            ctx.fillStyle = "#37474F"; ctx.fillRect(x + w / 2 - 4, y + h - 22, 8, 22); // pump
            ctx.fillStyle = "#FF5252"; ctx.fillRect(x + w / 2 - 3, y + h - 20, 6, 6);
            return;
        }
        if (b.kind === "market") {
            // striped awning over the storefront + crates
            for (var aw = 0; aw < w; aw += 10) { ctx.fillStyle = (aw / 10) % 2 ? "#E53935" : "#FAFAFA"; ctx.fillRect(x + aw, y - 12, 10, 12); }
            ctx.fillStyle = "#1A1A1A"; roundRect(x + 3, y - 30, w - 6, 16, 3); ctx.fill();
            drawText("MARKET", x + w / 2, y - 22, "bold 9px 'Segoe UI', Arial, sans-serif", "#AED581", null, 0);
            ctx.fillStyle = "#A1887F"; ctx.fillRect(x + 6, y + h - 14, 12, 12); ctx.fillRect(x + w - 18, y + h - 14, 12, 12);
            ctx.fillStyle = "#FF7043"; ctx.beginPath(); ctx.arc(x + 12, y + h - 16, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#8BC34A"; ctx.beginPath(); ctx.arc(x + w - 12, y + h - 16, 3, 0, Math.PI * 2); ctx.fill();
            return;
        }

        // Tall buildings (bars/police/school/downtown/hospital): lit window grid.
        // Lit pattern is DETERMINISTIC per building (seed) — re-rolling each
        // frame made every window strobe, which read as 'too flashy'.
        var wi = 0;
        for (var wy = y + 10; wy < y + h - 8; wy += 16) {
            for (var wx = x + 7; wx < x + w - 8; wx += 14) {
                wi++;
                var litWin = b.lit && (((wi * 37 + (b.seed || 0)) % 10) < 6);
                ctx.fillStyle = litWin ? "#FFE082" : "rgba(20,20,30,0.5)";
                ctx.fillRect(wx, wy, 8, 9);
            }
        }
        // Roofline variety (parapet / stepped / peaked) so towers aren't clones.
        var roofC = shadeColor((BUILD_BODY[b.kind] || BUILD_BODY.downtown)[b.tint], (b.shade || 0) - 22);
        ctx.fillStyle = roofC;
        if (b.roof === 0) {
            ctx.fillRect(x - 2, y - 4, w + 4, 6);                          // flat parapet
        } else if (b.roof === 1) {
            ctx.fillRect(x - 2, y - 4, w + 4, 5);
            ctx.fillRect(x + w * 0.18, y - 9, w * 0.64, 6);               // stepped
            ctx.fillRect(x + w * 0.36, y - 13, w * 0.28, 5);
        } else {
            ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x + w / 2, y - 13); ctx.lineTo(x + w + 2, y); ctx.closePath(); ctx.fill(); // low peak
        }
        var label = b.label || BUILD_LABEL[b.kind];
        if (label) {
            var signC = b.signC || BUILD_SIGN[b.kind];
            var sy0 = y - 16 - (b.roof === 1 ? 8 : b.roof === 2 ? 6 : 0);
            ctx.fillStyle = "#1A1A1A";
            roundRect(x + 3, sy0, w - 6, 15, 3); ctx.fill();
            if (b.glow && b.lit) { ctx.shadowColor = signC; ctx.shadowBlur = 6; }
            drawFitText(label, x + w / 2, sy0 + 8, w - 12, 9, signC);
            ctx.shadowBlur = 0;
        }
        if (b.kind === "bars") {
            if (b.style === 1) {
                // striped fabric awning over the entrance
                for (var awb = 0; awb < w - 8; awb += 9) {
                    ctx.fillStyle = (awb / 9) % 2 ? "#FAFAFA" : (b.signC || "#FF4FA3");
                    ctx.fillRect(x + 4 + awb, y + 2, Math.min(9, w - 12 - awb), 8);
                }
            } else if (b.style === 2) {
                // a string of warm cafe lights along the facade (static)
                ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(x + 4, y + 6); ctx.quadraticCurveTo(x + w / 2, y + 12, x + w - 4, y + 6); ctx.stroke();
                for (var lt = 0; lt < 5; lt++) {
                    var ltx = x + 6 + (w - 12) * lt / 4;
                    ctx.fillStyle = "#FFD54F";
                    ctx.beginPath(); ctx.arc(ltx, y + 8 + Math.sin(lt * 2.1) * 2, 1.8, 0, Math.PI * 2); ctx.fill();
                }
            }
        } else if (b.kind === "school") {
            if (b.style === 0) {
                // flagpole beside the door
                var fpx = x + 6;
                ctx.strokeStyle = "#90A4AE"; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(fpx, y + h); ctx.lineTo(fpx, y - 14); ctx.stroke();
                ctx.fillStyle = "#42A5F5"; ctx.fillRect(fpx + 1, y - 13, 11, 7);
            } else {
                // wide double doors at the base
                ctx.fillStyle = "#4E342E";
                ctx.fillRect(x + w / 2 - 9, y + h - 18, 18, 18);
                ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(x + w / 2, y + h - 18); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
            }
        }
        if (b.kind === "police") {
            ctx.fillStyle = "#E53935"; ctx.fillRect(x + 2, y - 22, (w - 4) / 2, 4);
            ctx.fillStyle = "#1E88E5"; ctx.fillRect(x + 2 + (w - 4) / 2, y - 22, (w - 4) / 2, 4);
        } else if (b.kind === "downtown") {
            if (b.style === 0) {
                // rooftop water tower
                var wtx = x + w / 2;
                ctx.strokeStyle = "#6D4C41"; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(wtx - 6, y); ctx.lineTo(wtx - 6, y - 8); ctx.moveTo(wtx + 6, y); ctx.lineTo(wtx + 6, y - 8); ctx.stroke();
                ctx.fillStyle = "#8D6E63"; roundRect(wtx - 9, y - 22, 18, 14, 3); ctx.fill();
                ctx.fillStyle = "#6D4C41"; ctx.beginPath();
                ctx.moveTo(wtx - 10, y - 22); ctx.lineTo(wtx, y - 30); ctx.lineTo(wtx + 10, y - 22); ctx.closePath(); ctx.fill();
            } else {
                ctx.strokeStyle = "#90A4AE"; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y - 18); ctx.stroke();
                ctx.fillStyle = "#FF5252"; ctx.beginPath(); ctx.arc(x + w / 2, y - 18, 2, 0, Math.PI * 2); ctx.fill();
            }
        } else if (b.kind === "hospital") {
            // big red cross on the facade
            ctx.fillStyle = "#E53935";
            ctx.fillRect(x + w / 2 - 4, y + 12, 8, 26); ctx.fillRect(x + w / 2 - 13, y + 21, 26, 8);
        }
    }

    // ── Drawing: Environment ─────────────────────────────────
    function drawTree(x, y, scale, time, swayOff) {
        var s = scale || 1;
        var sway = Math.sin(time * 1.5 + (swayOff || 0)) * 2;
        var cfg = SEASONS[season];
        ctx.save();
        ctx.translate(x + sway, y);
        ctx.scale(s, s);
        ctx.fillStyle = C.trunkDark;
        roundRect(-7, -8, 14, 30, 3); ctx.fill();
        ctx.fillStyle = C.trunk;
        roundRect(-5, -6, 10, 26, 2); ctx.fill();
        if (cfg.bare) {
            // Winter: bare branches with little snow caps
            ctx.strokeStyle = C.trunkDark; ctx.lineWidth = 2; ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(0, -6); ctx.lineTo(-9, -20); ctx.moveTo(0, -10); ctx.lineTo(9, -22);
            ctx.moveTo(0, -14); ctx.lineTo(0, -28); ctx.moveTo(0, -16); ctx.lineTo(-7, -26);
            ctx.stroke(); ctx.lineCap = "butt";
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.ellipse(-9, -21, 3, 1.6, 0, 0, Math.PI * 2);
            ctx.ellipse(9, -23, 3, 1.6, 0, 0, Math.PI * 2);
            ctx.ellipse(0, -29, 3.2, 1.7, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            for (var i = 0; i < 3; i++) {
                var cx = [-10, 10, 0][i], cy = [-26, -24, -34][i], r = [14, 13, 16][i];
                ctx.fillStyle = shadeColor(cfg.trees[i], -34);
                ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = cfg.trees[i];
                ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.restore();
    }

    function drawBush(x, y, scale, time, bounceOff) {
        var s = (scale || 1) * (1 + Math.sin(time * 2 + (bounceOff || 0)) * 0.03);
        var pal = SEASONS[season].bushes;
        ctx.save();
        ctx.translate(x, y); ctx.scale(s, s);
        for (var i = 0; i < 3; i++) {
            var bx = [-9, 9, 0][i], by = [-2, -1, -8][i];
            var rx = [13, 12, 14][i], ry = [9, 8, 11][i];
            ctx.fillStyle = shadeColor(pal[i], -34);
            ctx.beginPath(); ctx.ellipse(bx, by, rx + 2, ry + 2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = pal[i];
            ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    function drawFlower(x, y, color, scale) {
        var s = scale || 1;
        ctx.save();
        ctx.translate(x, y); ctx.scale(s, s);
        ctx.fillStyle = "#388E3C"; ctx.fillRect(-1, 0, 2, 10);
        for (var i = 0; i < 5; i++) {
            ctx.fillStyle = color;
            ctx.save();
            ctx.rotate((Math.PI * 2 / 5) * i);
            ctx.beginPath(); ctx.ellipse(0, -5, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        ctx.fillStyle = "#FFF176";
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function drawFence(x, y, w) {
        ctx.fillStyle = "#795548";
        roundRect(x - w / 2, y - 4, w, 6, 2); ctx.fill();
        ctx.fillStyle = "#8D6E63";
        roundRect(x - w / 2, y - 3, w, 4, 1); ctx.fill();
        for (var i = 0; i < w; i += 14) {
            ctx.fillStyle = "#795548";
            roundRect(x - w / 2 + i + 2, y - 12, 5, 16, 1); ctx.fill();
            ctx.fillStyle = "#8D6E63";
            roundRect(x - w / 2 + i + 3, y - 11, 3, 14, 1); ctx.fill();
        }
    }

    function drawSnowPile(x, y, scale) {
        var s = scale || 1;
        ctx.save();
        ctx.translate(x, y); ctx.scale(s, s);
        ctx.fillStyle = "rgba(0,0,0,0.10)";
        ctx.beginPath(); ctx.ellipse(0, 4, 20, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#E8EEF2";
        ctx.beginPath(); ctx.ellipse(-7, 0, 12, 9, 0, 0, Math.PI * 2);
        ctx.ellipse(7, 1, 11, 8, 0, 0, Math.PI * 2);
        ctx.ellipse(0, -4, 13, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.ellipse(-3, -6, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function drawDecorations(time) {
        for (var i = 0; i < decorations.length; i++) {
            var d = decorations[i];
            if (d.type === "tree") drawTree(d.x, d.y, d.scale, time, d.swayOffset);
            else if (d.type === "bush") drawBush(d.x, d.y, d.scale, time, d.bounceOffset);
            else if (d.type === "flower") drawFlower(d.x, d.y, d.color, d.scale);
            else if (d.type === "snowpile") drawSnowPile(d.x, d.y, d.scale);
            else if (d.type === "fence") drawFence(d.x, d.y, d.width);
        }
    }

    function drawRoad(scrollOff) {
        // Sky-to-grass gradient for depth (season-tinted)
        var skyGrad = ctx.createLinearGradient(0, 0, 0, H);
        skyGrad.addColorStop(0, seasonSky(0));
        skyGrad.addColorStop(0.35, seasonSky(1));
        skyGrad.addColorStop(1, seasonSky(2));
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = shadeColor(seasonGrass(), 10);
        for (var gy = ((scrollOff * 0.3) % 40) - 40; gy < H; gy += 40) {
            ctx.fillRect(0, gy, W, 18);
        }
        // Drop shadow + chunky outline on road for depth (Sneaky-Sasquatch style)
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(ROAD_L - 14, 0, 4, H);
        ctx.fillRect(ROAD_R + 10, 0, 4, H);
        ctx.fillStyle = C.shoulder;
        roundRect(ROAD_L - 8, 0, ROAD_W + 16, H, 0); ctx.fill();
        ctx.fillStyle = C.road;
        ctx.fillRect(ROAD_L, 0, ROAD_W, H);
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 3;
        ctx.strokeRect(ROAD_L - 8, 0, ROAD_W + 16, H);

        ctx.strokeStyle = C.roadLine;
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(ROAD_L + 2, 0); ctx.lineTo(ROAD_L + 2, H);
        ctx.moveTo(ROAD_R - 2, 0); ctx.lineTo(ROAD_R - 2, H);
        ctx.stroke();

        ctx.strokeStyle = C.roadLine;
        ctx.lineWidth = 2;
        ctx.setLineDash([28, 22]);
        ctx.lineDashOffset = -(scrollOff % 50);
        for (var lane = 1; lane < 3; lane++) {
            var lx = ROAD_L + lane * LANE_W;
            ctx.beginPath();
            ctx.moveTo(lx, 0); ctx.lineTo(lx, H);
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }

    // ── Drawing: Lulu's car (with skin & feminine face) ──────