// ⚠️ GENERATED FILE — do not edit directly.
// Edit the fragments in src/ and run `node build.js`.
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
    var musicElements = {};      // cached Audio() elements per track
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
        var el = getMusicEl(track);
        currentMusicTrack = track;
        musicState = track;
        currentMusicEl = el;
        if (!el) return;
        el.volume = MUSIC_VOLUME;
        el.play().catch(function () {});
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
            if (pointInRect(pos.x, pos.y, MISSILE_RECT.x, MISSILE_RECT.y, MISSILE_RECT.w, MISSILE_RECT.h)) return "missile";
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
            }
        } else {
            if (scrollOffset >= zoneEndsAt) {
                zone = "rural";
                zoneNextAt = scrollOffset + ZONE_RURAL_GAP + rand(-3000, 5000);
            }
            cityBuildTimer -= dt;
            if (cityBuildTimer <= 0) {
                cityBuildTimer = rand(0.5, 1.0);
                spawnCityBuilding(-1);
                if (Math.random() < 0.85) spawnCityBuilding(1);
            }
        }
        for (var i = cityBuildings.length - 1; i >= 0; i--) {
            cityBuildings[i].y += speed * dt;
            if (cityBuildings[i].y > H + 160) cityBuildings.splice(i, 1);
        }
    }
    function spawnCityBuilding(side) {
        var w = rand(50, 76), h = rand(70, 130);
        var x = side < 0 ? rand(6, Math.max(8, ROAD_L - w - 6)) + w / 2
                         : rand(ROAD_R + 6, W - w - 6) + w / 2;
        cityBuildings.push({ x: x, y: -h - 30, side: side, kind: zone, w: w, h: h,
            lit: Math.random() < 0.7, tint: randInt(0, 2) });
    }
    function drawCityBuildings() {
        for (var i = 0; i < cityBuildings.length; i++) drawBuilding(cityBuildings[i]);
    }
    var BUILD_BODY = {
        bars: ["#3E2C4F", "#4A3A5C", "#2E2240"], police: ["#37474F", "#455A64", "#2E3D44"],
        school: ["#9C4A3C", "#A85A48", "#8C4234"], downtown: ["#546E7A", "#607D8B", "#4B636E"],
        hospital: ["#ECEFF1", "#E0E4E7", "#F5F7F8"], construction: ["#9E8E6E", "#8C7D5E", "#A89A7C"],
        gas: ["#C62828", "#B71C1C", "#D32F2F"], market: ["#6D4C41", "#7B5A4C", "#5D4037"]
    };
    var BUILD_LABEL = { bars: "BAR", police: "POLICE", school: "SCHOOL", hospital: "HOSPITAL", gas: "GAS", market: "MARKET" };
    var BUILD_SIGN = { bars: "#FF4FA3", police: "#42A5F5", school: "#FFD54F", hospital: "#E53935", gas: "#FFEB3B", market: "#AED581" };
    function drawBuilding(b) {
        var x = b.x - b.w / 2, y = b.y, w = b.w, h = b.h;
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(x + 4, y + 8, w, h);
        ctx.fillStyle = (BUILD_BODY[b.kind] || BUILD_BODY.downtown)[b.tint];
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        if (b.kind === "construction") {
            // exposed floors + scaffolding, hazard stripes at the base, a crane
            ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1;
            for (var cf = y + 14; cf < y + h; cf += 16) { ctx.beginPath(); ctx.moveTo(x, cf); ctx.lineTo(x + w, cf); ctx.stroke(); }
            for (var sc = 0; sc < w; sc += 8) { ctx.fillStyle = (sc / 8) % 2 ? "#1A1A1A" : "#FFC107"; ctx.fillRect(x + sc, y + h - 8, 8, 8); }
            ctx.strokeStyle = "#FFB300"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(x + w - 6, y); ctx.lineTo(x + w - 6, y - 26); ctx.lineTo(x + 4, y - 20); ctx.stroke();
            ctx.fillStyle = "#616161"; ctx.fillRect(x + 8, y - 22, 5, 8);
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

        // Tall buildings (bars/police/school/downtown/hospital): lit window grid
        for (var wy = y + 10; wy < y + h - 8; wy += 16) {
            for (var wx = x + 7; wx < x + w - 8; wx += 14) {
                ctx.fillStyle = (b.lit && Math.random() < 0.6) ? "#FFE082" : "rgba(20,20,30,0.5)";
                ctx.fillRect(wx, wy, 8, 9);
            }
        }
        var label = BUILD_LABEL[b.kind];
        if (label) {
            var signC = BUILD_SIGN[b.kind];
            ctx.fillStyle = "#1A1A1A";
            roundRect(x + 3, y - 16, w - 6, 16, 3); ctx.fill();
            if (b.kind === "bars" && b.lit) { ctx.shadowColor = signC; ctx.shadowBlur = 8; }
            drawText(label, x + w / 2, y - 8, "bold 10px 'Segoe UI', Arial, sans-serif", signC, null, 0);
            ctx.shadowBlur = 0;
        }
        if (b.kind === "police") {
            ctx.fillStyle = "#E53935"; ctx.fillRect(x + 2, y - 22, (w - 4) / 2, 4);
            ctx.fillStyle = "#1E88E5"; ctx.fillRect(x + 2 + (w - 4) / 2, y - 22, (w - 4) / 2, 4);
        } else if (b.kind === "downtown") {
            ctx.strokeStyle = "#90A4AE"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y - 18); ctx.stroke();
            ctx.fillStyle = "#FF5252"; ctx.beginPath(); ctx.arc(x + w / 2, y - 18, 2, 0, Math.PI * 2); ctx.fill();
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
    // ── Spawn tuning (EDIT ME) ───────────────────────────────
    // Rarity/timing for the random "encounter" events in Lulu's driving game.
    // Everything here is safe to tweak — just edit the numbers and rebuild
    // (`node build.js`). Core obstacles (cars/cones/coins) are NOT here; they
    // stay frequent. These are the special, occasional events.
    //
    //   first:  [min,max] seconds before the event can FIRST appear in a run.
    //           Randomized per run, so the ORDER of events differs every time.
    //   every:  [min,max] seconds between attempts after that.
    //   chance: 0..1 probability an attempt actually spawns (lower = rarer).
    //
    // Want something rarer?  → raise `every` and/or lower `chance`.
    // Want it more common?   → lower `every` and/or raise `chance`.
    var SPAWN_CONFIG = {
        pedestrian:  { first: [12, 30], every: [20, 38],  chance: 0.70 }, // 🚶 walkers → passenger coin bonus
        parkingSign: { first: [25, 75],  every: [55, 100], chance: 0.50 }, // 🅿 parking challenge offer
        iceCream:    { first: [30, 85],  every: [65, 115], chance: 0.50 }, // 🍦 ice-cream bonus
        avigail:     { first: [25, 80],  every: [60, 110], chance: 0.45 }, // Avigail pickup
        salon:       { first: [30, 85],  every: [65, 115], chance: 0.45 }, // 💇 salon scene
        sasquatch:   { first: [40, 100], every: [75, 150], chance: 0.35 }, // 🦶 sasquatch easter egg
        copHide:     { first: [22, 60],  every: [35, 75],  chance: 0.55 }, // 🚓 hidden roadside speed-trap cop
        heshyPool:   { first: [25, 70],  every: [40, 80],  chance: 0.50 }, // 🏊 Heshy-in-the-pool easter egg
        heart:       { first: [15, 35],  every: [20, 40],  chance: 0.60 }, // ❤️ extra-life pickup
        toll:        { first: [45, 90],  every: [60, 120], chance: 0.55 }  // 🎫 toll-booth gauntlet
    };

    // Per-event countdown timers, (re)initialized at the start of each run.
    var spawnTimers = {};
    function initSpawnTimers() {
        for (var key in SPAWN_CONFIG) {
            var c = SPAWN_CONFIG[key];
            spawnTimers[key] = rand(c.first[0], c.first[1]);
        }
    }
    // Counts down `name`'s timer; when it elapses, resets it and rolls `chance`.
    // Returns true only on the frames the event should actually spawn.
    function tickSpawn(name, dt) {
        var c = SPAWN_CONFIG[name];
        if (!c) return false;
        if (spawnTimers[name] === undefined) spawnTimers[name] = rand(c.first[0], c.first[1]);
        spawnTimers[name] -= dt;
        if (spawnTimers[name] > 0) return false;
        spawnTimers[name] = rand(c.every[0], c.every[1]);
        return Math.random() < c.chance;
    }

    // Shared cute face for Lulu's car — used by both the driving game and the
    // parking minigame so she looks identical in both. Drawn centered at (0, fy)
    // in the car's local space. `crying` swaps in the sad/teary parking face.
    function drawLuluFace(fy, crying) {
        var hairC = save.luluHair;
        var hairDark = shadeColor(hairC, -28);
        var hairLite = shadeColor(hairC, 22);

        // Long hair flowing down BOTH SIDES of the face
        ctx.fillStyle = hairC;
        ctx.beginPath();
        ctx.moveTo(-7.5, fy - 4);
        ctx.quadraticCurveTo(-12, fy + 2, -10.5, fy + 14);
        ctx.quadraticCurveTo(-9, fy + 20, -6, fy + 18);
        ctx.quadraticCurveTo(-6.5, fy + 8, -5, fy + 2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(7.5, fy - 4);
        ctx.quadraticCurveTo(12, fy + 2, 10.5, fy + 14);
        ctx.quadraticCurveTo(9, fy + 20, 6, fy + 18);
        ctx.quadraticCurveTo(6.5, fy + 8, 5, fy + 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = hairLite;
        ctx.beginPath();
        ctx.ellipse(-9, fy + 7, 1.3, 5, 0.1, 0, Math.PI * 2);
        ctx.ellipse(9, fy + 7, 1.3, 5, -0.1, 0, Math.PI * 2);
        ctx.fill();

        // Face — soft round, bright peachy skin
        ctx.fillStyle = "#FFD9C0";
        ctx.beginPath();
        ctx.ellipse(0, fy, 8, 8.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Center-parted bangs
        ctx.fillStyle = hairC;
        ctx.beginPath();
        ctx.moveTo(-8, fy + 1);
        ctx.quadraticCurveTo(-10, fy - 8, 0, fy - 9);
        ctx.quadraticCurveTo(10, fy - 8, 8, fy + 1);
        ctx.quadraticCurveTo(6, fy - 3, 4, fy - 2.5);
        ctx.quadraticCurveTo(2, fy - 5.5, 0, fy - 5);
        ctx.quadraticCurveTo(-2, fy - 5.5, -4, fy - 2.5);
        ctx.quadraticCurveTo(-6, fy - 3, -8, fy + 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = hairLite;
        ctx.beginPath();
        ctx.ellipse(-4, fy - 5, 2.2, 1.1, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Eyebrows
        ctx.strokeStyle = hairDark;
        ctx.lineWidth = 0.7;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-4.6, fy - 2.6); ctx.quadraticCurveTo(-2.8, fy - 3.4, -1, fy - 2.7);
        ctx.moveTo(1, fy - 2.7); ctx.quadraticCurveTo(2.8, fy - 3.4, 4.6, fy - 2.6);
        ctx.stroke();
        ctx.lineCap = "butt";

        if (crying) {
            // Squeezed-shut sad eyes
            ctx.strokeStyle = "#5D4037";
            ctx.lineWidth = 1.1;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(-2.9, fy + 0.4, 2.3, 0.1 * Math.PI, 0.9 * Math.PI);
            ctx.arc(2.9, fy + 0.4, 2.3, 0.1 * Math.PI, 0.9 * Math.PI);
            ctx.stroke();
            ctx.lineCap = "butt";
            // Tear drops
            ctx.fillStyle = "#4FC3F7";
            ctx.beginPath();
            ctx.moveTo(-2.9, fy + 2.4); ctx.quadraticCurveTo(-4.6, fy + 6, -3.6, fy + 8.4);
            ctx.quadraticCurveTo(-1.9, fy + 6, -2.9, fy + 2.4); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(2.9, fy + 2.4); ctx.quadraticCurveTo(4.6, fy + 6, 3.6, fy + 8.4);
            ctx.quadraticCurveTo(1.9, fy + 6, 2.9, fy + 2.4); ctx.fill();
            // Wailing frown
            ctx.fillStyle = "#5D4037";
            ctx.beginPath();
            ctx.ellipse(0, fy + 5, 1.8, 1.2, 0, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        // Eyes — big, round, sparkly
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.ellipse(-2.9, fy, 2.4, 2.6, 0, 0, Math.PI * 2);
        ctx.ellipse(2.9, fy, 2.4, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#7A4A24";
        ctx.beginPath();
        ctx.arc(-2.9, fy + 0.2, 1.7, 0, Math.PI * 2);
        ctx.arc(2.9, fy + 0.2, 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#241208";
        ctx.beginPath();
        ctx.arc(-2.9, fy + 0.2, 0.85, 0, Math.PI * 2);
        ctx.arc(2.9, fy + 0.2, 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(-2.1, fy - 0.6, 0.8, 0, Math.PI * 2);
        ctx.arc(3.7, fy - 0.6, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Upper lash line + outer lashes
        ctx.strokeStyle = "#2E1A10";
        ctx.lineWidth = 0.9;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(-2.9, fy, 2.5, Math.PI * 1.05, Math.PI * 1.85);
        ctx.arc(2.9, fy, 2.5, Math.PI * 1.15, Math.PI * 1.95);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-5.2, fy - 0.6); ctx.lineTo(-6.1, fy - 1.4);
        ctx.moveTo(5.2, fy - 0.6); ctx.lineTo(6.1, fy - 1.4);
        ctx.stroke();
        ctx.lineCap = "butt";

        // Blush
        ctx.fillStyle = "rgba(255, 135, 160, 0.5)";
        ctx.beginPath();
        ctx.ellipse(-4.6, fy + 3.2, 1.8, 1.2, 0, 0, Math.PI * 2);
        ctx.ellipse(4.6, fy + 3.2, 1.8, 1.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Button nose
        ctx.strokeStyle = "rgba(190,120,90,0.5)";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(0, fy + 2.4, 0.9, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();

        // Glossy pink smile
        ctx.fillStyle = "#E84A7F";
        ctx.beginPath();
        ctx.moveTo(-2.4, fy + 4.6);
        ctx.quadraticCurveTo(0, fy + 6.6, 2.4, fy + 4.6);
        ctx.quadraticCurveTo(0, fy + 5.4, -2.4, fy + 4.6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(-1.2, fy + 4.8, 2.4, 0.6);
    }

    function drawLuluCar(x, y, tilt, blinking, time, distracted, skinKey, scale) {
        var skin = SKINS[skinKey || save.selectedSkin] || SKINS.pink;
        var sc = scale || 1;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(tilt || 0);
        ctx.scale(sc, sc);

        if (blinking && Math.sin(time * 18) > 0) ctx.globalAlpha = 0.35;

        var hw = CAR_W / 2, hh = CAR_H / 2;

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(3, 6, hw + 4, hh - 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wheels
        ctx.fillStyle = C.wheel;
        roundRect(-hw - 4, -hh + 10, 8, 18, 3); ctx.fill();
        roundRect(hw - 4, -hh + 10, 8, 18, 3); ctx.fill();
        roundRect(-hw - 4, hh - 28, 8, 18, 3); ctx.fill();
        roundRect(hw - 4, hh - 28, 8, 18, 3); ctx.fill();

        // Body outline
        ctx.fillStyle = skin.dark;
        roundRect(-hw - 2, -hh - 2, CAR_W + 4, CAR_H + 4, 14); ctx.fill();

        // Body
        var grad = ctx.createLinearGradient(0, -hh, 0, hh);
        grad.addColorStop(0, skin.light);
        grad.addColorStop(0.5, skin.body);
        grad.addColorStop(1, skin.dark);
        ctx.fillStyle = grad;
        roundRect(-hw, -hh, CAR_W, CAR_H, 12); ctx.fill();

        // Optional racing stripe
        if (skin.stripe) {
            ctx.fillStyle = skin.stripe;
            roundRect(-4, -hh + 4, 8, CAR_H - 8, 2); ctx.fill();
        }

        // Windshield
        ctx.fillStyle = C.windshieldDark;
        roundRect(-hw + 7, -hh + 8, CAR_W - 14, 26, 6); ctx.fill();
        ctx.fillStyle = C.windshield;
        roundRect(-hw + 8, -hh + 9, CAR_W - 16, 24, 5); ctx.fill();

        // ── Lulu's face (cute young woman — bold & readable at small size) ──
        var fy = -hh + 23;                 // face center y
        var hairC = save.luluHair;
        var hairDark = shadeColor(hairC, -28);
        var hairLite = shadeColor(hairC, 22);

        // Long hair flowing down BOTH SIDES of the face (frames it — clearly feminine)
        ctx.fillStyle = hairC;
        // left lock
        ctx.beginPath();
        ctx.moveTo(-7.5, fy - 4);
        ctx.quadraticCurveTo(-12, fy + 2, -10.5, fy + 14);  // sweeps out then down
        ctx.quadraticCurveTo(-9, fy + 20, -6, fy + 18);     // rounded tip
        ctx.quadraticCurveTo(-6.5, fy + 8, -5, fy + 2);     // inner edge back up to cheek
        ctx.closePath();
        ctx.fill();
        // right lock (mirror)
        ctx.beginPath();
        ctx.moveTo(7.5, fy - 4);
        ctx.quadraticCurveTo(12, fy + 2, 10.5, fy + 14);
        ctx.quadraticCurveTo(9, fy + 20, 6, fy + 18);
        ctx.quadraticCurveTo(6.5, fy + 8, 5, fy + 2);
        ctx.closePath();
        ctx.fill();
        // hair sheen down each lock
        ctx.fillStyle = hairLite;
        ctx.beginPath();
        ctx.ellipse(-9, fy + 7, 1.3, 5, 0.1, 0, Math.PI * 2);
        ctx.ellipse(9, fy + 7, 1.3, 5, -0.1, 0, Math.PI * 2);
        ctx.fill();

        // Face — soft round, bright peachy skin
        ctx.fillStyle = "#FFD9C0";
        ctx.beginPath();
        ctx.ellipse(0, fy, 8, 8.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hair: center-parted bangs framing just the top of the face
        ctx.fillStyle = hairC;
        ctx.beginPath();
        ctx.moveTo(-8, fy + 1);
        ctx.quadraticCurveTo(-10, fy - 8, 0, fy - 9);
        ctx.quadraticCurveTo(10, fy - 8, 8, fy + 1);
        ctx.quadraticCurveTo(6, fy - 3, 4, fy - 2.5);     // right bang sweep
        ctx.quadraticCurveTo(2, fy - 5.5, 0, fy - 5);     // center part dip
        ctx.quadraticCurveTo(-2, fy - 5.5, -4, fy - 2.5); // left bang sweep
        ctx.quadraticCurveTo(-6, fy - 3, -8, fy + 1);
        ctx.closePath();
        ctx.fill();
        // Hair highlight sheen on bangs
        ctx.fillStyle = hairLite;
        ctx.beginPath();
        ctx.ellipse(-4, fy - 5, 2.2, 1.1, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Eyebrows — soft thin arcs
        ctx.strokeStyle = hairDark;
        ctx.lineWidth = 0.7;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-4.6, fy - 2.6); ctx.quadraticCurveTo(-2.8, fy - 3.4, -1, fy - 2.7);
        ctx.moveTo(1, fy - 2.7); ctx.quadraticCurveTo(2.8, fy - 3.4, 4.6, fy - 2.6);
        ctx.stroke();

        // Eyes — big, round, sparkly (the key to reading as a cute girl)
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.ellipse(-2.9, fy, 2.4, 2.6, 0, 0, Math.PI * 2);
        ctx.ellipse(2.9, fy, 2.4, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Iris — large warm brown
        ctx.fillStyle = "#7A4A24";
        ctx.beginPath();
        ctx.arc(-2.9, fy + 0.2, 1.7, 0, Math.PI * 2);
        ctx.arc(2.9, fy + 0.2, 1.7, 0, Math.PI * 2);
        ctx.fill();
        // Pupil
        ctx.fillStyle = "#241208";
        ctx.beginPath();
        ctx.arc(-2.9, fy + 0.2, 0.85, 0, Math.PI * 2);
        ctx.arc(2.9, fy + 0.2, 0.85, 0, Math.PI * 2);
        ctx.fill();
        // Big eye sparkle
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(-2.1, fy - 0.6, 0.8, 0, Math.PI * 2);
        ctx.arc(3.7, fy - 0.6, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Upper lash line + outer-corner lashes (defines feminine eyes)
        ctx.strokeStyle = "#2E1A10";
        ctx.lineWidth = 0.9;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(-2.9, fy, 2.5, Math.PI * 1.05, Math.PI * 1.85);
        ctx.arc(2.9, fy, 2.5, Math.PI * 1.15, Math.PI * 1.95);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-5.2, fy - 0.6); ctx.lineTo(-6.1, fy - 1.4);
        ctx.moveTo(5.2, fy - 0.6); ctx.lineTo(6.1, fy - 1.4);
        ctx.stroke();
        ctx.lineCap = "butt";

        // Soft pink blush on cheeks
        ctx.fillStyle = "rgba(255, 135, 160, 0.5)";
        ctx.beginPath();
        ctx.ellipse(-4.6, fy + 3.2, 1.8, 1.2, 0, 0, Math.PI * 2);
        ctx.ellipse(4.6, fy + 3.2, 1.8, 1.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tiny button nose
        ctx.strokeStyle = "rgba(190,120,90,0.5)";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(0, fy + 2.4, 0.9, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();

        // Glossy pink smile
        ctx.fillStyle = "#E84A7F";
        ctx.beginPath();
        ctx.moveTo(-2.4, fy + 4.6);
        ctx.quadraticCurveTo(0, fy + 6.6, 2.4, fy + 4.6);
        ctx.quadraticCurveTo(0, fy + 5.4, -2.4, fy + 4.6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(-1.2, fy + 4.8, 2.4, 0.6);   // teeth glint

        // Phone (distracted mode)
        if (distracted) {
            ctx.fillStyle = "#212121";
            roundRect(6, -hh + 24, 8, 13, 2); ctx.fill();
            ctx.fillStyle = "#4FC3F7";
            roundRect(7, -hh + 25, 6, 11, 1); ctx.fill();
            // little screen content
            ctx.fillStyle = "#FFF";
            ctx.fillRect(8, -hh + 27, 4, 1);
            ctx.fillRect(8, -hh + 30, 4, 1);
            ctx.fillRect(8, -hh + 33, 4, 1);
            // hand on phone
            ctx.fillStyle = C.skin;
            ctx.beginPath();
            ctx.arc(7, -hh + 24, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Rear window
        ctx.fillStyle = C.windshieldDark;
        roundRect(-hw + 10, hh - 22, CAR_W - 20, 12, 4); ctx.fill();

        // Sasquatch hitchhiker — big furry head sticking out top
        if (sasquatchPassenger > 0) {
            ctx.save();
            // Body lump squished in the car
            ctx.fillStyle = "#4E342E";
            roundRect(-hw + 6, hh - 30, CAR_W - 12, 18, 6); ctx.fill();
            // Head poking up through roof
            ctx.fillStyle = "#1A1410";
            ctx.beginPath(); ctx.arc(8, hh - 36, 13, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#4E342E";
            ctx.beginPath(); ctx.arc(8, hh - 36, 11, 0, Math.PI * 2); ctx.fill();
            // Fur tufts
            ctx.fillStyle = "#3E2723";
            ctx.beginPath();
            ctx.arc(2, hh - 44, 3.5, 0, Math.PI * 2);
            ctx.arc(8, hh - 46, 4, 0, Math.PI * 2);
            ctx.arc(14, hh - 44, 3.5, 0, Math.PI * 2);
            ctx.fill();
            // Eyes
            ctx.fillStyle = "#FFF9C4";
            ctx.beginPath();
            ctx.arc(4, hh - 37, 2.5, 0, Math.PI * 2);
            ctx.arc(12, hh - 37, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.arc(4, hh - 37, 1.4, 0, Math.PI * 2);
            ctx.arc(12, hh - 37, 1.4, 0, Math.PI * 2);
            ctx.fill();
            // Big chill smile
            ctx.strokeStyle = "#1A1410";
            ctx.lineWidth = 1.5;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(8, hh - 32, 3.5, 0.1 * Math.PI, 0.9 * Math.PI);
            ctx.stroke();
            ctx.lineCap = "butt";
            // Arm hanging out window
            ctx.fillStyle = "#4E342E";
            roundRect(hw - 4, hh - 26, 8, 16, 3); ctx.fill();
            ctx.restore();
        }

        // Passengers (peeking out the rear window)
        if (passengers && passengers.length > 0) {
            var slots = [[-8, hh - 16], [8, hh - 16], [-4, hh - 12], [4, hh - 12]];
            for (var pi = 0; pi < passengers.length && pi < 4; pi++) {
                var ps = passengers[pi];
                var bob = Math.sin(time * 4 + ps.bobOffset) * 0.5;
                var px = slots[pi][0], py = slots[pi][1] + bob;
                // hair
                ctx.fillStyle = ps.hairColor;
                ctx.beginPath(); ctx.arc(px, py, 3.2, 0, Math.PI * 2); ctx.fill();
                // face
                ctx.fillStyle = C.skin;
                ctx.beginPath(); ctx.arc(px, py + 0.6, 2.5, 0, Math.PI * 2); ctx.fill();
                // eyes
                ctx.fillStyle = "#222";
                ctx.beginPath();
                ctx.arc(px - 0.9, py + 0.5, 0.4, 0, Math.PI * 2);
                ctx.arc(px + 0.9, py + 0.5, 0.4, 0, Math.PI * 2);
                ctx.fill();
                // happy mouth
                ctx.strokeStyle = "#222";
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.arc(px, py + 1.2, 0.8, 0.1 * Math.PI, 0.9 * Math.PI);
                ctx.stroke();
            }
        }

        // Avigail riding shotgun (after she joins) — curly black hair, gold hoops
        if (avigailInCar) {
            var ax = 7, ay = -hh + 22;
            // Curly black hair
            ctx.fillStyle = "#1A1A1A";
            ctx.beginPath();
            ctx.arc(ax - 3, ay - 2, 3, 0, Math.PI * 2);
            ctx.arc(ax, ay - 4, 3.2, 0, Math.PI * 2);
            ctx.arc(ax + 3, ay - 2, 3, 0, Math.PI * 2);
            ctx.fill();
            // Face
            ctx.fillStyle = "#C68642";
            ctx.beginPath(); ctx.arc(ax, ay, 3.4, 0, Math.PI * 2); ctx.fill();
            // Hoop earrings
            ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.arc(ax - 3.5, ay + 1, 1, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(ax + 3.5, ay + 1, 1, 0, Math.PI * 2); ctx.stroke();
            // Eyes
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.arc(ax - 1, ay, 0.5, 0, Math.PI * 2);
            ctx.arc(ax + 1, ay, 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Kids in back seat (after successful parking)
        if (kidsInCar) {
            // Pigtail kid
            ctx.fillStyle = "#FFC107";
            ctx.beginPath(); ctx.arc(-6, hh - 14, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.skin;
            ctx.beginPath(); ctx.arc(-6, hh - 13.5, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFC107";
            ctx.beginPath();
            ctx.ellipse(-9, -hh + (hh - 14), 1.8, 2.5, -0.4, 0, Math.PI * 2);
            ctx.ellipse(-3, -hh + (hh - 14), 1.8, 2.5, 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.arc(-7, hh - 14, 0.6, 0, Math.PI * 2);
            ctx.arc(-5, hh - 14, 0.6, 0, Math.PI * 2);
            ctx.fill();
            // Cap kid
            ctx.fillStyle = C.skin;
            ctx.beginPath(); ctx.arc(6, hh - 13.5, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#1976D2";
            ctx.beginPath();
            ctx.arc(6, hh - 15, 3.3, Math.PI, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(7, hh - 15, 3.5, 1.2);
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.arc(5, hh - 13, 0.6, 0, Math.PI * 2);
            ctx.arc(7, hh - 13, 0.6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Live driving cues: only the active player car, while actually driving
        var driving = (typeof state !== "undefined" && state === "playing" && !blinking) || false;
        var boosting = driving && keys.up;
        var braking = driving && keys.down;

        // Boost: warm headlight beam glowing forward
        if (boosting) {
            var beam = ctx.createLinearGradient(0, -hh - 30, 0, -hh);
            beam.addColorStop(0, "rgba(255,249,196,0)");
            beam.addColorStop(1, "rgba(255,249,196,0.35)");
            ctx.fillStyle = beam;
            ctx.beginPath();
            ctx.moveTo(-hw + 6, -hh + 2);
            ctx.lineTo(-hw - 4, -hh - 26);
            ctx.lineTo(hw + 4, -hh - 26);
            ctx.lineTo(hw - 6, -hh + 2);
            ctx.closePath();
            ctx.fill();
        }

        // Headlights
        ctx.fillStyle = "#FFF9C4";
        ctx.beginPath();
        ctx.ellipse(-hw + 10, -hh + 2, 5, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(hw - 10, -hh + 2, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Brake-light glow halo when slowing
        if (braking) {
            ctx.fillStyle = "rgba(244,67,54,0.35)";
            ctx.beginPath();
            ctx.ellipse(-hw + 10, hh - 4, 9, 7, 0, 0, Math.PI * 2);
            ctx.ellipse(hw - 10, hh - 4, 9, 7, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Taillights (brighter red when braking)
        ctx.fillStyle = braking ? "#FF5252" : "#F44336";
        ctx.beginPath();
        ctx.ellipse(-hw + 10, hh - 4, 4, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(hw - 10, hh - 4, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        if (braking) {
            // hot white core
            ctx.fillStyle = "#FFCDD2";
            ctx.beginPath();
            ctx.ellipse(-hw + 10, hh - 4, 1.8, 1.4, 0, 0, Math.PI * 2);
            ctx.ellipse(hw - 10, hh - 4, 1.8, 1.4, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Boost exhaust puffs out the back
        if (boosting && Math.random() > 0.4) {
            particles.push({
                x: x + rand(-hw + 8, -hw + 14), y: y + hh + 4,
                vx: rand(-12, 12), vy: rand(40, 90),
                life: 0.35, maxLife: 0.35, smoke: true,
                size: rand(2, 4), color: "rgba(200,200,200,0.7)", gravity: 0
            });
            particles.push({
                x: x + rand(hw - 14, hw - 8), y: y + hh + 4,
                vx: rand(-12, 12), vy: rand(40, 90),
                life: 0.35, maxLife: 0.35, smoke: true,
                size: rand(2, 4), color: "rgba(200,200,200,0.7)", gravity: 0
            });
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // ── Drawing: Enemy cars ──────────────────────────────────
    function drawEnemyCar(x, y, color, type) {
        ctx.save();
        ctx.translate(x, y);
        var ew, eh, rad;
        if (type === 0) { ew = 42; eh = 74; rad = 10; }
        else if (type === 1) { ew = 48; eh = 82; rad = 8; }
        else { ew = 44; eh = 68; rad = 12; }
        var hw2 = ew / 2, hh2 = eh / 2;

        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath();
        ctx.ellipse(3, 5, hw2 + 3, hh2 - 8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = C.wheel;
        roundRect(-hw2 - 3, -hh2 + 8, 7, 16, 3); ctx.fill();
        roundRect(hw2 - 4, -hh2 + 8, 7, 16, 3); ctx.fill();
        roundRect(-hw2 - 3, hh2 - 24, 7, 16, 3); ctx.fill();
        roundRect(hw2 - 4, hh2 - 24, 7, 16, 3); ctx.fill();

        ctx.fillStyle = shadeColor(color, -40);
        roundRect(-hw2 - 2, -hh2 - 2, ew + 4, eh + 4, rad + 2); ctx.fill();

        var g2 = ctx.createLinearGradient(0, -hh2, 0, hh2);
        g2.addColorStop(0, shadeColor(color, 30));
        g2.addColorStop(1, color);
        ctx.fillStyle = g2;
        roundRect(-hw2, -hh2, ew, eh, rad); ctx.fill();

        ctx.fillStyle = "#78909C";
        roundRect(-hw2 + 6, hh2 - 22, ew - 12, 14, 4); ctx.fill();
        roundRect(-hw2 + 8, -hh2 + 8, ew - 16, 11, 3); ctx.fill();
        // glass gloss highlight (diagonal sheen) — cleaner, less flat look
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        roundRect(-hw2 + 8, hh2 - 21, (ew - 12) * 0.42, 12, 3); ctx.fill();
        // body top sheen
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        roundRect(-hw2 + 4, -hh2 + 3, ew - 8, 5, 3); ctx.fill();
        // facing taillights (enemy cars drive toward us — red lights at their rear/bottom)
        ctx.fillStyle = "#EF5350";
        ctx.beginPath();
        ctx.ellipse(-hw2 + 8, hh2 - 3, 3, 2, 0, 0, Math.PI * 2);
        ctx.ellipse(hw2 - 8, hh2 - 3, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ── Drawing: Obstacles ───────────────────────────────────
    function drawCone(x, y) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "#444";
        ctx.beginPath(); ctx.ellipse(0, 6, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.cone;
        ctx.beginPath();
        ctx.moveTo(-9, 6); ctx.lineTo(-3, -14); ctx.lineTo(3, -14); ctx.lineTo(9, 6);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = C.coneStripe;
        ctx.fillRect(-6, -4, 12, 4);
        ctx.fillRect(-4, -12, 8, 3);
        ctx.strokeStyle = "#BF360C";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-9, 6); ctx.lineTo(-3, -14); ctx.lineTo(3, -14); ctx.lineTo(9, 6);
        ctx.closePath(); ctx.stroke();
        ctx.restore();
    }

    function drawPuddle(x, y) {
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = C.puddle;
        ctx.beginPath(); ctx.ellipse(0, 0, 24, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = "#BBDEFB";
        ctx.beginPath(); ctx.ellipse(-6, -2, 6, 3, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function drawCoin(x, y, time) {
        ctx.save();
        ctx.translate(x, y + Math.sin(time * 4) * 3);
        var squeeze = Math.abs(Math.cos(time * 3));
        var rx = 10 * Math.max(squeeze, 0.3);
        ctx.fillStyle = C.coinDark;
        ctx.beginPath(); ctx.ellipse(0, 0, rx + 2, 12, 0, 0, Math.PI * 2); ctx.fill();
        var cg = ctx.createRadialGradient(-2, -2, 1, 0, 0, 10);
        cg.addColorStop(0, C.coinShine);
        cg.addColorStop(0.6, C.coin);
        cg.addColorStop(1, C.coinDark);
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.ellipse(0, 0, rx, 10, 0, 0, Math.PI * 2); ctx.fill();
        if (squeeze > 0.5) {
            ctx.fillStyle = C.coinDark;
            ctx.font = "bold 11px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("★", 0, 0);
        }
        ctx.restore();
    }

    // ── Drawing: Pedestrians (people obstacles) ──────────────
    function drawPedestrian(x, y, walkTime, type) {
        ctx.save();
        ctx.translate(x, y);
        var legSwing = Math.sin(walkTime * 10) * 4;
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath(); ctx.ellipse(0, 16, 12, 4, 0, 0, Math.PI * 2); ctx.fill();

        // Legs
        var pantColor = type === 0 ? "#1976D2" : (type === 1 ? "#37474F" : "#6D4C41");
        ctx.fillStyle = pantColor;
        roundRect(-5, 4 - legSwing, 4, 14 + legSwing, 2); ctx.fill();
        roundRect(1, 4 + legSwing, 4, 14 - legSwing, 2); ctx.fill();
        // Shoes
        ctx.fillStyle = "#212121";
        roundRect(-6, 16 - legSwing, 6, 4, 2); ctx.fill();
        roundRect(0, 16 + legSwing, 6, 4, 2); ctx.fill();

        // Body / shirt
        var shirtColor = type === 0 ? "#E91E63" : (type === 1 ? "#FFC107" : "#43A047");
        ctx.fillStyle = shadeColor(shirtColor, -40);
        roundRect(-9, -8, 18, 16, 5); ctx.fill();
        ctx.fillStyle = shirtColor;
        roundRect(-8, -7, 16, 14, 4); ctx.fill();

        // Arms
        ctx.fillStyle = shirtColor;
        roundRect(-11, -6, 4, 12, 2); ctx.fill();
        roundRect(7, -6, 4, 12, 2); ctx.fill();
        // Hands
        ctx.fillStyle = C.skin;
        ctx.beginPath(); ctx.arc(-9, 7, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(9, 7, 2.5, 0, Math.PI * 2); ctx.fill();

        // Head with chunky outline
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(0, -14, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin;
        ctx.beginPath(); ctx.arc(0, -14, 6.8, 0, Math.PI * 2); ctx.fill();

        // Hair
        var hairCol = type === 0 ? "#FFC107" : (type === 1 ? "#3E2723" : "#6D4C41");
        ctx.fillStyle = hairCol;
        ctx.beginPath();
        ctx.arc(0, -16, 7, Math.PI, Math.PI * 2);
        ctx.fill();
        if (type === 0) {
            // ponytail
            ctx.beginPath();
            ctx.ellipse(-7, -12, 3, 5, -0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Sasquatch-style big sparkly eyes
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(-2.2, -13, 1.6, 0, Math.PI * 2);
        ctx.arc(2.2, -13, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath();
        ctx.arc(-2.2, -12.8, 1.1, 0, Math.PI * 2);
        ctx.arc(2.2, -12.8, 1.1, 0, Math.PI * 2);
        ctx.fill();
        // Eye highlights
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(-1.8, -13.2, 0.4, 0, Math.PI * 2);
        ctx.arc(2.6, -13.2, 0.4, 0, Math.PI * 2);
        ctx.fill();
        // Rosy cheek dots
        ctx.fillStyle = "rgba(255,140,140,0.55)";
        ctx.beginPath();
        ctx.arc(-4, -11, 1.4, 0, Math.PI * 2);
        ctx.arc(4, -11, 1.4, 0, Math.PI * 2);
        ctx.fill();
        // Tiny "oh!" mouth (still surprised)
        ctx.fillStyle = "#5D2A2A";
        ctx.beginPath();
        ctx.ellipse(0, -10, 0.9, 1.3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ── Drawing: Animals ─────────────────────────────────────
    function drawDuck(x, y, walkFrame) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "#333";
        ctx.beginPath(); ctx.ellipse(0, 0, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FDD835";
        ctx.beginPath(); ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#333";
        ctx.beginPath(); ctx.arc(-10, -6, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FDD835";
        ctx.beginPath(); ctx.arc(-10, -6, 5.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FF8F00";
        ctx.beginPath();
        ctx.moveTo(-15, -6); ctx.lineTo(-20, -5); ctx.lineTo(-15, -4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#333";
        ctx.beginPath(); ctx.arc(-11, -7, 1.5, 0, Math.PI * 2); ctx.fill();
        var legOff = Math.sin(walkFrame * 8) * 3;
        ctx.fillStyle = "#FF8F00";
        ctx.fillRect(-3, 6, 3, 4 + legOff);
        ctx.fillRect(3, 6, 3, 4 - legOff);
        ctx.restore();
    }

    function drawRaccoon(x, y, walkFrame) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "#333";
        ctx.beginPath(); ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#78909C";
        ctx.beginPath(); ctx.ellipse(0, 0, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#333";
        ctx.beginPath(); ctx.arc(-10, -5, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#78909C";
        ctx.beginPath(); ctx.arc(-10, -5, 6.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#333";
        ctx.beginPath(); ctx.ellipse(-10, -5, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFF";
        ctx.beginPath();
        ctx.arc(-12, -5, 2, 0, Math.PI * 2);
        ctx.arc(-8, -5, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#333";
        ctx.beginPath();
        ctx.arc(-12, -5, 1, 0, Math.PI * 2);
        ctx.arc(-8, -5, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#333";
        ctx.beginPath(); ctx.arc(-14, -3, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#78909C";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(10, 0); ctx.quadraticCurveTo(16, -8, 12, -14); ctx.stroke();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(12, -10); ctx.quadraticCurveTo(14, -14, 12, -16); ctx.stroke();
        var legOff2 = Math.sin(walkFrame * 8) * 3;
        ctx.fillStyle = "#555";
        ctx.fillRect(-5, 7, 4, 4 + legOff2);
        ctx.fillRect(3, 7, 4, 4 - legOff2);
        ctx.restore();
    }

    function drawOstrich(x, y, walkFrame) {
        ctx.save();
        ctx.translate(x, y);
        var legOff = Math.sin(walkFrame * 7) * 8;

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath(); ctx.ellipse(0, 18, 14, 4, 0, 0, Math.PI * 2); ctx.fill();

        // Legs (long pink/orange)
        ctx.strokeStyle = "#F4A582";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-4, 6); ctx.lineTo(-5, 16 + legOff); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4, 6); ctx.lineTo(5, 16 - legOff); ctx.stroke();
        // Feet (3-toed)
        ctx.fillStyle = "#FFB74D";
        ctx.beginPath();
        ctx.moveTo(-5, 16 + legOff);
        ctx.lineTo(-8, 18 + legOff);
        ctx.lineTo(-2, 18 + legOff);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(5, 16 - legOff);
        ctx.lineTo(2, 18 - legOff);
        ctx.lineTo(8, 18 - legOff);
        ctx.closePath(); ctx.fill();

        // Body (big fluffy black/grey oval)
        ctx.fillStyle = "#212121";
        ctx.beginPath(); ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#424242";
        ctx.beginPath(); ctx.ellipse(0, 0, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
        // White tail feathers
        ctx.fillStyle = "#FAFAFA";
        ctx.beginPath();
        ctx.ellipse(11, 2, 5, 4, 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Long neck (curves up and left)
        ctx.strokeStyle = "#F4A582";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-8, -3);
        ctx.quadraticCurveTo(-14, -12, -10, -22);
        ctx.stroke();

        // Head
        ctx.fillStyle = "#F4A582";
        ctx.beginPath();
        ctx.arc(-10, -23, 5, 0, Math.PI * 2); ctx.fill();
        // Beak
        ctx.fillStyle = "#FFB74D";
        ctx.beginPath();
        ctx.moveTo(-14, -23);
        ctx.lineTo(-19, -22);
        ctx.lineTo(-14, -21);
        ctx.closePath(); ctx.fill();
        // Eye
        ctx.fillStyle = "#FFF";
        ctx.beginPath(); ctx.arc(-11, -24, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#222";
        ctx.beginPath(); ctx.arc(-11, -24, 1, 0, Math.PI * 2); ctx.fill();
        // Eyelash
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-12, -26); ctx.lineTo(-12.5, -27.5);
        ctx.stroke();

        ctx.restore();
    }

    // ── Drawing: Missile ─────────────────────────────────────
    function drawMissile(x, y, time) {
        ctx.save();
        ctx.translate(x, y);
        // exhaust trail
        var flicker = 1 + Math.sin(time * 30) * 0.3;
        ctx.fillStyle = "rgba(255,200,0,0.6)";
        ctx.beginPath();
        ctx.ellipse(0, 18, 6, 12 * flicker, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,87,34,0.8)";
        ctx.beginPath();
        ctx.ellipse(0, 14, 4, 8 * flicker, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.ellipse(0, 12, 2, 5 * flicker, 0, 0, Math.PI * 2); ctx.fill();

        // missile body
        ctx.fillStyle = "#37474F";
        roundRect(-5, -12, 10, 24, 3); ctx.fill();
        ctx.fillStyle = "#B0BEC5";
        roundRect(-4, -11, 8, 22, 2); ctx.fill();
        // nose cone
        ctx.fillStyle = "#F44336";
        ctx.beginPath();
        ctx.moveTo(-5, -10);
        ctx.lineTo(0, -18);
        ctx.lineTo(5, -10);
        ctx.closePath(); ctx.fill();
        // fins
        ctx.fillStyle = "#37474F";
        ctx.beginPath();
        ctx.moveTo(-5, 8); ctx.lineTo(-9, 12); ctx.lineTo(-5, 12);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(5, 8); ctx.lineTo(9, 12); ctx.lineTo(5, 12);
        ctx.closePath(); ctx.fill();

        ctx.restore();

        // smoke trail particles
        if (Math.random() > 0.5) {
            particles.push({
                x: x + rand(-4, 4), y: y + 18,
                vx: rand(-10, 10), vy: rand(40, 80),
                life: 0.4, maxLife: 0.4,
                size: rand(3, 6),
                color: randPick(["#FFA000", "#FF5722", "#9E9E9E"]),
                gravity: 0
            });
        }
    }

    // ── Drawing: Angry Man + Speech Bubble ───────────────────
    function drawAngryMan(x, y, time, state, runDir) {
        ctx.save();
        ctx.translate(x, y);

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(0, 22, 14, 4, 0, 0, Math.PI * 2); ctx.fill();

        var legSwing = state === "running" ? Math.sin(time * 18) * 6 : Math.sin(time * 4) * 1;
        var armRaise = state === "yelling" ? Math.sin(time * 12) * 10 : 0;

        // Legs (brown pants)
        ctx.fillStyle = "#3E2723";
        roundRect(-6, 8 - legSwing, 5, 16 + legSwing, 2); ctx.fill();
        roundRect(1, 8 + legSwing, 5, 16 - legSwing, 2); ctx.fill();
        // Shoes
        ctx.fillStyle = "#212121";
        roundRect(-7, 22 - legSwing, 7, 4, 2); ctx.fill();
        roundRect(0, 22 + legSwing, 7, 4, 2); ctx.fill();

        // Body (plaid red shirt for grumpy-grandpa vibe)
        ctx.fillStyle = "#8B0000";
        roundRect(-11, -8, 22, 18, 5); ctx.fill();
        ctx.fillStyle = "#B71C1C";
        roundRect(-10, -7, 20, 16, 4); ctx.fill();
        // shirt lines
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-4, -7); ctx.lineTo(-4, 9);
        ctx.moveTo(4, -7); ctx.lineTo(4, 9);
        ctx.moveTo(-10, -2); ctx.lineTo(10, -2);
        ctx.moveTo(-10, 4); ctx.lineTo(10, 4);
        ctx.stroke();

        // Arms (one raised when yelling)
        ctx.fillStyle = "#B71C1C";
        if (state === "yelling") {
            // both arms up (shaking fist)
            ctx.save();
            ctx.translate(-10, -5);
            ctx.rotate(-0.8 + armRaise * 0.03);
            roundRect(-3, -12, 6, 14, 2); ctx.fill();
            // fist
            ctx.fillStyle = C.skin;
            ctx.beginPath(); ctx.arc(0, -13, 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            ctx.fillStyle = "#B71C1C";
            ctx.save();
            ctx.translate(10, -5);
            ctx.rotate(0.8 - armRaise * 0.03);
            roundRect(-3, -12, 6, 14, 2); ctx.fill();
            ctx.fillStyle = C.skin;
            ctx.beginPath(); ctx.arc(0, -13, 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else if (state === "running") {
            var armSwing = -legSwing;
            ctx.fillStyle = "#B71C1C";
            roundRect(-13, -5 - armSwing * 0.3, 5, 14, 2); ctx.fill();
            roundRect(8, -5 + armSwing * 0.3, 5, 14, 2); ctx.fill();
            ctx.fillStyle = C.skin;
            ctx.beginPath(); ctx.arc(-10, 9 - armSwing * 0.3, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(11, 9 + armSwing * 0.3, 2.5, 0, Math.PI * 2); ctx.fill();
        }

        // Head (red-faced angry)
        ctx.fillStyle = "#222";
        ctx.beginPath(); ctx.arc(0, -16, 9, 0, Math.PI * 2); ctx.fill();
        // angry red face
        var redness = state === "yelling" ? "#FF7043" : "#FFAB91";
        ctx.fillStyle = redness;
        ctx.beginPath(); ctx.arc(0, -16, 8, 0, Math.PI * 2); ctx.fill();

        // White hair (wild messy clumps with darker base for depth)
        ctx.fillStyle = "#9E9E9E";
        ctx.beginPath();
        ctx.arc(-7, -20, 6, 0, Math.PI * 2);
        ctx.arc(0, -23, 7, 0, Math.PI * 2);
        ctx.arc(7, -20, 6, 0, Math.PI * 2);
        ctx.arc(-10, -17, 5, 0, Math.PI * 2);
        ctx.arc(10, -17, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FAFAFA";
        ctx.beginPath();
        ctx.arc(-6, -21, 5, 0, Math.PI * 2);
        ctx.arc(1, -24, 5.8, 0, Math.PI * 2);
        ctx.arc(7, -21, 5, 0, Math.PI * 2);
        ctx.arc(-9, -18, 4, 0, Math.PI * 2);
        ctx.arc(9, -18, 4, 0, Math.PI * 2);
        ctx.fill();
        // Sticky-up tufts (Sasquatch-grandpa cue)
        ctx.beginPath();
        ctx.ellipse(-4, -26, 1.5, 3, -0.3, 0, Math.PI * 2);
        ctx.ellipse(4, -26, 1.5, 3, 0.3, 0, Math.PI * 2);
        ctx.fill();
        // White bushy eyebrows (angry V-shape)
        ctx.fillStyle = "#FAFAFA";
        ctx.save();
        ctx.translate(-3, -18);
        ctx.rotate(0.4);
        roundRect(-3, 0, 6, 2, 1); ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(3, -18);
        ctx.rotate(-0.4);
        roundRect(-3, 0, 6, 2, 1); ctx.fill();
        ctx.restore();

        // Eyes (angry slits)
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-5, -16); ctx.lineTo(-2, -15);
        ctx.moveTo(2, -15); ctx.lineTo(5, -16);
        ctx.stroke();

        // Pupils (small angry dots)
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(-3, -15, 0.9, 0, Math.PI * 2);
        ctx.arc(3, -15, 0.9, 0, Math.PI * 2);
        ctx.fill();

        // Big white mustache
        ctx.fillStyle = "#FAFAFA";
        ctx.beginPath();
        ctx.ellipse(-3, -12, 4, 1.8, 0.2, 0, Math.PI * 2);
        ctx.ellipse(3, -12, 4, 1.8, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Open yelling mouth
        if (state === "yelling") {
            ctx.fillStyle = "#000";
            ctx.beginPath();
            var mouthW = 3 + Math.sin(time * 25) * 1.2;
            ctx.ellipse(0, -9, mouthW, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#F44336";
            ctx.beginPath();
            ctx.ellipse(0, -8.5, mouthW * 0.6, 1, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // grumpy frown
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(0, -8, 3, 1.2 * Math.PI, 1.8 * Math.PI);
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawSpeechBubble(x, y, text, time) {
        ctx.save();
        var lines = text.split("\n");
        var fontSize = 14;
        ctx.font = "bold " + fontSize + "px 'Segoe UI', Arial, sans-serif";
        var maxW = 0;
        for (var li = 0; li < lines.length; li++) {
            var w = ctx.measureText(lines[li]).width;
            if (w > maxW) maxW = w;
        }
        var bw = maxW + 24, bh = lines.length * (fontSize + 4) + 16;
        var bx = x - bw / 2, by = y - bh - 14;
        // wobble for energy
        var wob = Math.sin(time * 20) * 1.5;
        bx += wob;

        // bubble bg
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        roundRect(bx, by, bw, bh, 10);
        ctx.fill(); ctx.stroke();

        // pointer
        ctx.beginPath();
        ctx.moveTo(x - 6, by + bh);
        ctx.lineTo(x + 4, by + bh + 10);
        ctx.lineTo(x + 6, by + bh);
        ctx.closePath();
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.stroke();

        // text
        ctx.fillStyle = "#D32F2F";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (var i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], bx + bw / 2, by + 12 + i * (fontSize + 4) + fontSize / 2);
        }
        ctx.restore();
    }

    // ── Drawing: Parking sign + ice cream + billboards ────────
    function drawParkingSign(x, y, bob) {
        ctx.save();
        ctx.translate(x, y + Math.sin(bob * 3) * 3);
        // Glow halo
        ctx.fillStyle = "rgba(33,150,243,0.25)";
        ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
        // Pole
        ctx.fillStyle = "#90A4AE";
        ctx.fillRect(-1.5, 14, 3, 8);
        // Sign body
        ctx.fillStyle = "#0D47A1";
        roundRect(-14, -14, 28, 28, 4); ctx.fill();
        ctx.fillStyle = "#1976D2";
        roundRect(-12, -12, 24, 24, 3); ctx.fill();
        // White P
        ctx.fillStyle = "#FFF";
        ctx.font = "bold 22px 'Segoe UI', Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("P", 0, 1);
        // shimmer
        if (Math.sin(bob * 4) > 0) {
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            roundRect(-10, -10, 8, 4, 2); ctx.fill();
        }
        ctx.restore();
    }

    function drawIceCreamSign(x, y, bob) {
        ctx.save();
        ctx.translate(x, y + Math.sin(bob * 3) * 3);
        // Pole
        ctx.fillStyle = "#5D4037";
        ctx.fillRect(-1.5, 10, 3, 14);
        // Cone (upside-down triangle)
        ctx.fillStyle = "#FFB74D";
        ctx.beginPath();
        ctx.moveTo(-10, -2);
        ctx.lineTo(10, -2);
        ctx.lineTo(0, 14);
        ctx.closePath();
        ctx.fill();
        // Waffle lines
        ctx.strokeStyle = "#E65100";
        ctx.lineWidth = 1;
        for (var i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(-8 + i * 4, 2);
            ctx.lineTo(8 - i * 4, 2);
            ctx.stroke();
        }
        // Pink scoop
        ctx.fillStyle = "#F48FB1";
        ctx.beginPath(); ctx.arc(0, -6, 8, 0, Math.PI * 2); ctx.fill();
        // White scoop on top
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(-3, -12, 5, 0, Math.PI * 2); ctx.fill();
        // Cherry
        ctx.fillStyle = "#D32F2F";
        ctx.beginPath(); ctx.arc(-3, -16, 2.5, 0, Math.PI * 2); ctx.fill();
        // Stem
        ctx.strokeStyle = "#388E3C";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-3, -18); ctx.lineTo(-1, -20);
        ctx.stroke();
        ctx.restore();
    }

    function drawBillboard(x, y, side, msg) {
        ctx.save();
        ctx.translate(x, y);
        // Two posts
        ctx.fillStyle = "#5D4037";
        ctx.fillRect(-30, 0, 5, 50);
        ctx.fillRect(25, 0, 5, 50);
        // Board outline
        ctx.fillStyle = "#3E2723";
        roundRect(-40, -38, 80, 44, 3); ctx.fill();
        // Board face
        ctx.fillStyle = "#FFF59D";
        roundRect(-37, -35, 74, 38, 2); ctx.fill();
        // Text (wrap into 2 lines)
        ctx.fillStyle = "#D32F2F";
        ctx.font = "bold 8px 'Segoe UI', Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        var words = msg.split(" ");
        var line1 = "", line2 = "";
        for (var i = 0; i < words.length; i++) {
            var test = (line1 ? line1 + " " : "") + words[i];
            if (ctx.measureText(test).width < 70 && !line2) line1 = test;
            else line2 = (line2 ? line2 + " " : "") + words[i];
        }
        if (!line2) {
            ctx.font = "bold 10px 'Segoe UI', Arial, sans-serif";
            ctx.fillText(line1, 0, -16);
        } else {
            ctx.fillText(line1, 0, -22);
            ctx.fillText(line2, 0, -10);
        }
        ctx.restore();
    }

    function drawSasquatch(x, y, phase, walkTime) {
        ctx.save();
        ctx.translate(x, y);
        var legSwing = Math.sin(walkTime * 8) * 4;

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(0, 26, 18, 5, 0, 0, Math.PI * 2); ctx.fill();

        // Big brown body
        ctx.fillStyle = "#3E2723";
        ctx.beginPath(); ctx.ellipse(0, 8, 16, 20, 0, 0, Math.PI * 2); ctx.fill();
        // Fur tufts
        ctx.fillStyle = "#5D4037";
        ctx.beginPath();
        ctx.ellipse(-10, 0, 5, 8, -0.2, 0, Math.PI * 2);
        ctx.ellipse(10, 0, 5, 8, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Legs
        ctx.fillStyle = "#3E2723";
        roundRect(-8, 22 - legSwing, 7, 8 + legSwing, 2); ctx.fill();
        roundRect(1, 22 + legSwing, 7, 8 - legSwing, 2); ctx.fill();
        // Feet
        ctx.fillStyle = "#5D4037";
        roundRect(-10, 28 - legSwing, 10, 4, 2); ctx.fill();
        roundRect(0, 28 + legSwing, 10, 4, 2); ctx.fill();

        // Arms (one waving if phase 1)
        ctx.fillStyle = "#3E2723";
        if (phase === 1) {
            ctx.save();
            ctx.translate(-13, 0);
            ctx.rotate(-0.5 - Math.sin(walkTime * 6) * 0.4);
            roundRect(-4, -2, 8, 18, 3); ctx.fill();
            ctx.restore();
            roundRect(8, 0, 8, 18, 3); ctx.fill();
        } else {
            var armSwing = -legSwing * 0.5;
            roundRect(-15, -2 - armSwing, 8, 18 + Math.abs(armSwing), 3); ctx.fill();
            roundRect(7, -2 + armSwing, 8, 18 + Math.abs(armSwing), 3); ctx.fill();
        }

        // Head (chunky outline + lighter face)
        ctx.fillStyle = "#1A1410";
        ctx.beginPath(); ctx.arc(0, -14, 13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#4E342E";
        ctx.beginPath(); ctx.arc(0, -14, 12, 0, Math.PI * 2); ctx.fill();
        // Fur tufts on top of head
        ctx.fillStyle = "#3E2723";
        ctx.beginPath();
        ctx.arc(-9, -22, 4, 0, Math.PI * 2);
        ctx.arc(-3, -24, 4, 0, Math.PI * 2);
        ctx.arc(3, -24, 4, 0, Math.PI * 2);
        ctx.arc(9, -22, 4, 0, Math.PI * 2);
        ctx.fill();
        // Lighter muzzle area
        ctx.fillStyle = "#8D6E63";
        ctx.beginPath(); ctx.ellipse(0, -9, 9, 7.5, 0, 0, Math.PI * 2); ctx.fill();
        // Brow ridge (gives personality)
        ctx.fillStyle = "#1A1410";
        ctx.beginPath();
        ctx.ellipse(-5, -17, 4, 1.5, -0.3, 0, Math.PI * 2);
        ctx.ellipse(5, -17, 4, 1.5, 0.3, 0, Math.PI * 2);
        ctx.fill();
        // Bigger friendlier eyes
        ctx.fillStyle = "#FFF9C4";
        ctx.beginPath();
        ctx.arc(-4.5, -14, 3.2, 0, Math.PI * 2);
        ctx.arc(4.5, -14, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(-4.5, -13.5, 1.7, 0, Math.PI * 2);
        ctx.arc(4.5, -13.5, 1.7, 0, Math.PI * 2);
        ctx.fill();
        // Eye highlights
        ctx.fillStyle = "#FFF";
        ctx.beginPath();
        ctx.arc(-3.7, -14, 0.7, 0, Math.PI * 2);
        ctx.arc(5.3, -14, 0.7, 0, Math.PI * 2);
        ctx.fill();
        // Nostrils
        ctx.fillStyle = "#1A1410";
        ctx.beginPath();
        ctx.arc(-2, -9, 0.8, 0, Math.PI * 2);
        ctx.arc(2, -9, 0.8, 0, Math.PI * 2);
        ctx.fill();
        // Mouth
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (phase === 1) {
            // Surprised "o" mouth when waving
            ctx.arc(0, -5, 2, 0, Math.PI * 2);
        } else {
            ctx.moveTo(-3, -5); ctx.quadraticCurveTo(0, -3, 3, -5);
        }
        ctx.stroke();

        ctx.restore();
    }

    function drawAmbulance(x, y, time) {
        ctx.save();
        ctx.translate(x, y);
        var hw = CAR_W / 2 + 5, hh = CAR_H / 2 + 6;
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(2, 6, hw + 3, hh - 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#CFD8DC"; roundRect(-hw - 2, -hh - 2, hw * 2 + 4, hh * 2 + 4, 10); ctx.fill();
        ctx.fillStyle = "#FFFFFF"; roundRect(-hw, -hh, hw * 2, hh * 2, 8); ctx.fill();
        ctx.fillStyle = "#E53935"; ctx.fillRect(-hw, -3, hw * 2, 8); // red stripe
        ctx.fillStyle = "#4FC3F7"; roundRect(-hw + 8, -hh + 8, hw * 2 - 16, 22, 5); ctx.fill();
        // red cross on the roof
        ctx.fillStyle = "#E53935";
        ctx.fillRect(-3, hh - 30, 6, 18); ctx.fillRect(-9, hh - 24, 18, 6);
        // flashing light bar
        var on = Math.sin(time * 22) > 0;
        ctx.fillStyle = on ? "#F44336" : "#FFCDD2"; roundRect(-hw + 6, -hh - 6, 12, 6, 2); ctx.fill();
        ctx.fillStyle = on ? "#BBDEFB" : "#1E88E5"; roundRect(hw - 18, -hh - 6, 12, 6, 2); ctx.fill();
        if (on) { ctx.fillStyle = "rgba(244,67,54,0.18)"; ctx.beginPath(); ctx.arc(-hw + 12, -hh - 3, 22, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.fillStyle = "rgba(33,150,243,0.18)"; ctx.beginPath(); ctx.arc(hw - 12, -hh - 3, 22, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = "#222";
        roundRect(-hw - 3, -hh + 12, 7, 16, 3); ctx.fill(); roundRect(hw - 4, -hh + 12, 7, 16, 3); ctx.fill();
        roundRect(-hw - 3, hh - 28, 7, 16, 3); ctx.fill(); roundRect(hw - 4, hh - 28, 7, 16, 3); ctx.fill();
        ctx.restore();
    }

    function drawCopCar(x, y, sirenTime) {
        ctx.save();
        ctx.translate(x, y);
        var hw = CAR_W / 2 + 4, hh = CAR_H / 2 + 4;

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(2, 6, hw + 4, hh - 6, 0, 0, Math.PI * 2); ctx.fill();

        // Body (black/white)
        ctx.fillStyle = "#000";
        roundRect(-hw - 2, -hh - 2, hw * 2 + 4, hh * 2 + 4, 10); ctx.fill();
        ctx.fillStyle = "#FAFAFA";
        roundRect(-hw, -hh + hh, hw * 2, hh, 6); ctx.fill();
        ctx.fillStyle = "#212121";
        roundRect(-hw, -hh, hw * 2, hh, 6); ctx.fill();

        // Windshield
        ctx.fillStyle = "#4FC3F7";
        roundRect(-hw + 8, -hh + 8, hw * 2 - 16, 26, 5); ctx.fill();
        ctx.fillStyle = "#81D4FA";
        roundRect(-hw + 10, -hh + 10, hw * 2 - 20, 22, 4); ctx.fill();

        // Sheriff star
        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("★", 0, 10);

        // Sirens (alternating red/blue flashing)
        var flashR = Math.sin(sirenTime * 18) > 0;
        ctx.fillStyle = flashR ? "#F44336" : "#FFCDD2";
        roundRect(-hw + 6, -hh - 6, 12, 6, 2); ctx.fill();
        ctx.fillStyle = flashR ? "#9FA8DA" : "#2196F3";
        roundRect(hw - 18, -hh - 6, 12, 6, 2); ctx.fill();

        // Light beam aura
        if (flashR) {
            ctx.fillStyle = "rgba(244,67,54,0.18)";
            ctx.beginPath(); ctx.arc(-hw + 12, -hh - 3, 24, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = "rgba(33,150,243,0.18)";
            ctx.beginPath(); ctx.arc(hw - 12, -hh - 3, 24, 0, Math.PI * 2); ctx.fill();
        }

        // Wheels
        ctx.fillStyle = "#222";
        roundRect(-hw - 3, -hh + 10, 7, 16, 3); ctx.fill();
        roundRect(hw - 4, -hh + 10, 7, 16, 3); ctx.fill();
        roundRect(-hw - 3, hh - 26, 7, 16, 3); ctx.fill();
        roundRect(hw - 4, hh - 26, 7, 16, 3); ctx.fill();

        ctx.restore();
    }

    // ── Drawing: Parking scene ───────────────────────────────
    function drawParkingScene(time) {
        var theme = (parkingLevelConfig && parkingLevelConfig.theme) || "day";
        // Sky colors depending on theme
        var skyTop, skyBot, sunOrMoon, sunColor1, sunColor2;
        if (theme === "day") {
            skyTop = "#FFE082"; skyBot = "#FFCC80";
            sunOrMoon = "sun"; sunColor1 = "#FFD54F"; sunColor2 = "#FFB300";
        } else if (theme === "dusk") {
            skyTop = "#FF7043"; skyBot = "#5E35B1";
            sunOrMoon = "sunset"; sunColor1 = "#FF8A65"; sunColor2 = "#D84315";
        } else { // night
            skyTop = "#0D1B40"; skyBot = "#1A237E";
            sunOrMoon = "moon"; sunColor1 = "#ECEFF1"; sunColor2 = "#CFD8DC";
        }
        var skyGrad = ctx.createLinearGradient(0, 0, 0, 80);
        skyGrad.addColorStop(0, skyTop);
        skyGrad.addColorStop(1, skyBot);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, 80);

        // Stars at night
        if (theme === "night") {
            ctx.fillStyle = "#FFF";
            for (var ss = 0; ss < 30; ss++) {
                var sx = (ss * 37 + 13) % W;
                var sy = (ss * 19 + 7) % 60;
                var twinkle = (Math.sin(time * 2 + ss) > 0.3) ? 1 : 0.4;
                ctx.globalAlpha = twinkle;
                ctx.fillRect(sx, sy, 1.5, 1.5);
            }
            ctx.globalAlpha = 1;
        }

        // Sun / Moon
        ctx.fillStyle = sunColor2;
        ctx.beginPath(); ctx.arc(W - 60, 40, 24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = sunColor1;
        ctx.beginPath(); ctx.arc(W - 60, 40, 20, 0, Math.PI * 2); ctx.fill();
        if (sunOrMoon === "moon") {
            // Crescent — overlay sky color to carve out a crescent
            ctx.fillStyle = skyTop;
            ctx.beginPath(); ctx.arc(W - 67, 35, 18, 0, Math.PI * 2); ctx.fill();
        }

        // Building silhouette (darker at night/dusk)
        var bldgColors = theme === "night"
            ? ["#1A237E", "#283593", "#0D1F47", "#1A237E", "#283593", "#1A237E"]
            : theme === "dusk"
            ? ["#311B92", "#4527A0", "#1A237E", "#311B92", "#4527A0", "#311B92"]
            : ["#5C6BC0", "#7986CB", "#3F51B5", "#9FA8DA", "#5C6BC0", "#7986CB"];
        var rects = [[20, 30, 60, 50], [85, 20, 80, 60], [170, 35, 70, 45],
                     [245, 25, 60, 55], [310, 30, 90, 50], [405, 40, 65, 40]];
        for (var rb = 0; rb < rects.length; rb++) {
            ctx.fillStyle = bldgColors[rb];
            ctx.fillRect(rects[rb][0], rects[rb][1], rects[rb][2], rects[rb][3]);
            // Chunky black outline
            ctx.strokeStyle = "#1A1A1A";
            ctx.lineWidth = 2.5;
            ctx.strokeRect(rects[rb][0], rects[rb][1], rects[rb][2], rects[rb][3]);
            // Trapezoid roof on top
            ctx.fillStyle = theme === "night" ? "#0D1230" : "#3E2723";
            ctx.beginPath();
            ctx.moveTo(rects[rb][0] - 4, rects[rb][1]);
            ctx.lineTo(rects[rb][0] + rects[rb][2] + 4, rects[rb][1]);
            ctx.lineTo(rects[rb][0] + rects[rb][2] - 2, rects[rb][1] - 7);
            ctx.lineTo(rects[rb][0] + 2, rects[rb][1] - 7);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        }
        // Windows: gold during day/dusk, blue at night
        ctx.fillStyle = theme === "night" ? "#FFD740" : "#FFEB3B";
        for (var bw = 30; bw < W - 30; bw += 12) {
            for (var bh = 35; bh < 75; bh += 10) {
                if ((bw * 7 + bh * 13) % 11 < (theme === "night" ? 5 : 4)) {
                    ctx.fillRect(bw, bh, 5, 5);
                }
            }
        }

        // Sidewalk
        ctx.fillStyle = "#BDBDBD";
        ctx.fillRect(0, 80, W, 60);
        // Sidewalk cracks
        ctx.strokeStyle = "#9E9E9E";
        ctx.lineWidth = 1;
        for (var sx = 0; sx < W; sx += 60) {
            ctx.beginPath(); ctx.moveTo(sx, 80); ctx.lineTo(sx, 140); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(0, 110); ctx.lineTo(W, 110); ctx.stroke();

        // Curb edge (yellow paint)
        ctx.fillStyle = "#FBC02D";
        ctx.fillRect(0, 138, W, 4);
        ctx.fillStyle = "#212121";
        ctx.fillRect(0, 142, W, 2);

        // Parking strip + main road
        ctx.fillStyle = "#6B7B8D";
        ctx.fillRect(0, 144, W, H - 144);

        // White parking lines (between cars + at edges of zone)
        ctx.strokeStyle = "#F5F5DC";
        ctx.lineWidth = 3;
        if (parkingZone) {
            ctx.beginPath();
            ctx.moveTo(parkingZone.x, parkingZone.y);
            ctx.lineTo(parkingZone.x, parkingZone.y + parkingZone.h);
            ctx.moveTo(parkingZone.x + parkingZone.w, parkingZone.y);
            ctx.lineTo(parkingZone.x + parkingZone.w, parkingZone.y + parkingZone.h);
            ctx.stroke();
            // Outline (highlight when in zone)
            var inZone = parkingCar && carIsInZone(parkingCar);
            ctx.setLineDash([8, 6]);
            ctx.strokeStyle = inZone ? "#4CAF50" : "#FFEB3B";
            ctx.lineWidth = 3;
            roundRect(parkingZone.x, parkingZone.y, parkingZone.w, parkingZone.h, 4);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Road center line (driving lane below)
        ctx.strokeStyle = "#F5F5DC";
        ctx.lineWidth = 2;
        ctx.setLineDash([20, 16]);
        ctx.lineDashOffset = -(time * 30 % 36);
        ctx.beginPath();
        ctx.moveTo(0, H * 0.55); ctx.lineTo(W, H * 0.55);
        ctx.stroke();
        ctx.setLineDash([]);

        // Decorations on sidewalk
        // Lamp post
        ctx.fillStyle = "#37474F";
        ctx.fillRect(70 - 2, 80, 4, 60);
        ctx.beginPath(); ctx.arc(70, 78, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFEE58";
        ctx.beginPath(); ctx.arc(70, 78, 5, 0, Math.PI * 2); ctx.fill();
        // Lamp glow
        ctx.fillStyle = "rgba(255,238,88,0.3)";
        ctx.beginPath(); ctx.arc(70, 78, 18, 0, Math.PI * 2); ctx.fill();

        // Fire hydrant
        ctx.fillStyle = "#B71C1C";
        roundRect(150, 110, 12, 22, 3); ctx.fill();
        ctx.fillStyle = "#FFEB3B";
        ctx.beginPath(); ctx.arc(156, 113, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#212121";
        ctx.fillRect(145, 132, 22, 3);

        // Mailbox
        ctx.fillStyle = "#1565C0";
        roundRect(330, 102, 24, 18, 3); ctx.fill();
        ctx.fillStyle = "#0D47A1";
        roundRect(338, 96, 8, 12, 2); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 8px Arial";
        ctx.textAlign = "center";
        ctx.fillText("USPS", 342, 113);
        // pole
        ctx.fillStyle = "#5D4037";
        ctx.fillRect(340, 120, 4, 18);

        // Parking meter near right
        ctx.fillStyle = "#37474F";
        ctx.fillRect(430, 120, 4, 22);
        ctx.fillStyle = "#90A4AE";
        roundRect(424, 102, 16, 22, 3); ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(432, 110, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#F44336";
        ctx.fillText("EXP", 432, 119);
    }

    // ── Drawing: Security camera (with live tracking) ─────────
    function drawSecurityCamera(cam, time) {
        ctx.save();
        ctx.translate(cam.x, cam.y);

        // Pole (thick, dark grey)
        ctx.fillStyle = "#263238";
        ctx.fillRect(-3, 0, 6, cam.poleH);
        ctx.fillStyle = "#37474F";
        ctx.fillRect(-2, 0, 4, cam.poleH);
        // Base on ground
        ctx.fillStyle = "#212121";
        roundRect(-10, cam.poleH - 3, 20, 6, 2); ctx.fill();

        // Camera arm pivot (rotates to track)
        var rot = cam.currentRot;
        ctx.save();
        ctx.rotate(rot);

        // Arm (joint piece)
        ctx.fillStyle = "#37474F";
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#455A64";
        roundRect(-3, -5, 22, 10, 3); ctx.fill();

        // Camera body (chunkier)
        ctx.fillStyle = "#212121";
        roundRect(10, -11, 22, 22, 4); ctx.fill();
        ctx.fillStyle = "#37474F";
        roundRect(11, -10, 20, 20, 3); ctx.fill();

        // Top fin
        ctx.fillStyle = "#263238";
        roundRect(14, -14, 14, 4, 2); ctx.fill();

        // Lens (big black with blue inner)
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(30, 0, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1976D2";
        ctx.beginPath(); ctx.arc(30, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(31, -1, 3, 0, Math.PI * 2); ctx.fill();
        // Lens highlight
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath(); ctx.arc(29, -2, 1.4, 0, Math.PI * 2); ctx.fill();

        // Recording red dot (blinking)
        var blink = Math.sin(time * 6) > 0;
        if (blink) {
            ctx.fillStyle = "rgba(244,67,54,0.6)";
            ctx.beginPath(); ctx.arc(14, -6, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#F44336";
            ctx.beginPath(); ctx.arc(14, -6, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFCDD2";
            ctx.beginPath(); ctx.arc(14, -6, 1, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = "#5D4037";
            ctx.beginPath(); ctx.arc(14, -6, 2, 0, Math.PI * 2); ctx.fill();
        }

        // Tracking laser line - prominent red dashed line
        var lasGrad = ctx.createLinearGradient(30, 0, 320, 0);
        lasGrad.addColorStop(0, "rgba(244,67,54,0.85)");
        lasGrad.addColorStop(1, "rgba(244,67,54,0)");
        ctx.strokeStyle = lasGrad;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = -time * 30;
        ctx.beginPath();
        ctx.moveTo(30, 0);
        ctx.lineTo(320, 0);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.restore();

        // "REC" badge below pole
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        roundRect(-18, cam.poleH + 4, 36, 13, 3); ctx.fill();
        if (blink) {
            ctx.fillStyle = "#F44336";
        } else {
            ctx.fillStyle = "#B71C1C";
        }
        ctx.beginPath(); ctx.arc(-10, cam.poleH + 10, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFF";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("REC", 4, cam.poleH + 10);

        ctx.restore();
    }

    // ── Drawing: Damage decals ────────────────────────────────
    function drawDamageDecals(car) {
        if (!car.damage || car.damage.length === 0) return;
        for (var i = 0; i < car.damage.length; i++) {
            var d = car.damage[i];
            ctx.save();
            ctx.fillStyle = "#212121";
            // Dent splotch
            ctx.beginPath();
            ctx.ellipse(d.x, d.y, d.size * 1.2, d.size, d.rot || 0, 0, Math.PI * 2);
            ctx.fill();
            // Inner darker
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.ellipse(d.x, d.y, d.size * 0.7, d.size * 0.5, d.rot || 0, 0, Math.PI * 2);
            ctx.fill();
            // Scratch marks
            ctx.strokeStyle = "#FAFAFA";
            ctx.lineWidth = 0.8;
            for (var s = 0; s < 3; s++) {
                var sa = (d.rot || 0) + s * 0.3 - 0.3;
                ctx.beginPath();
                ctx.moveTo(d.x - Math.cos(sa) * d.size, d.y - Math.sin(sa) * d.size);
                ctx.lineTo(d.x + Math.cos(sa) * d.size, d.y + Math.sin(sa) * d.size);
                ctx.stroke();
            }
            // Glass shards (for major hits)
            if (d.size > 5) {
                ctx.fillStyle = "#B0E0FF";
                for (var g = 0; g < 4; g++) {
                    var ga = sa + g;
                    ctx.beginPath();
                    ctx.moveTo(d.x, d.y);
                    ctx.lineTo(d.x + Math.cos(ga) * 3, d.y + Math.sin(ga) * 3);
                    ctx.lineTo(d.x + Math.cos(ga + 0.5) * 4, d.y + Math.sin(ga + 0.5) * 4);
                    ctx.closePath();
                    ctx.fill();
                }
            }
            ctx.restore();
        }
    }

    // ── Drawing: Lulu's car (parking version with damage + crying) ─
    function drawLuluCarFull(carObj, time, crying) {
        var skin = SKINS[save.selectedSkin] || SKINS.pink;
        ctx.save();
        ctx.translate(carObj.x, carObj.y);
        ctx.rotate(carObj.rot + Math.PI / 2); // car drawn facing up by default; rotate to current angle
        var hw = CAR_W / 2, hh = CAR_H / 2;

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(3, 6, hw + 4, hh - 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wheels
        ctx.fillStyle = C.wheel;
        roundRect(-hw - 4, -hh + 10, 8, 18, 3); ctx.fill();
        roundRect(hw - 4, -hh + 10, 8, 18, 3); ctx.fill();
        roundRect(-hw - 4, hh - 28, 8, 18, 3); ctx.fill();
        roundRect(hw - 4, hh - 28, 8, 18, 3); ctx.fill();

        // Body outline
        ctx.fillStyle = skin.dark;
        roundRect(-hw - 2, -hh - 2, CAR_W + 4, CAR_H + 4, 14); ctx.fill();

        var grad = ctx.createLinearGradient(0, -hh, 0, hh);
        grad.addColorStop(0, skin.light);
        grad.addColorStop(0.5, skin.body);
        grad.addColorStop(1, skin.dark);
        ctx.fillStyle = grad;
        roundRect(-hw, -hh, CAR_W, CAR_H, 12); ctx.fill();
        if (skin.stripe) {
            ctx.fillStyle = skin.stripe;
            roundRect(-4, -hh + 4, 8, CAR_H - 8, 2); ctx.fill();
        }

        // Windshield
        ctx.fillStyle = C.windshieldDark;
        roundRect(-hw + 7, -hh + 8, CAR_W - 14, 26, 6); ctx.fill();
        ctx.fillStyle = C.windshield;
        roundRect(-hw + 8, -hh + 9, CAR_W - 16, 24, 5); ctx.fill();

        // Lulu's face — the SAME shared face as the driving car so she looks
        // identical (was an older, cruder face here before).
        drawLuluFace(-hh + 23, crying);

        // Rear window
        ctx.fillStyle = C.windshieldDark;
        roundRect(-hw + 10, hh - 22, CAR_W - 20, 12, 4); ctx.fill();

        // Kids in back seat (if kidsInCar)
        if (kidsInCar) {
            // Kid 1
            ctx.fillStyle = "#FFC107";
            ctx.beginPath(); ctx.arc(-7, hh - 16, 4.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.skin;
            ctx.beginPath(); ctx.arc(-7, hh - 15, 3.5, 0, Math.PI * 2); ctx.fill();
            // pigtails
            ctx.fillStyle = "#FFC107";
            ctx.beginPath();
            ctx.ellipse(-11, hh - 16, 2, 3, -0.4, 0, Math.PI * 2);
            ctx.ellipse(-3, hh - 16, 2, 3, 0.4, 0, Math.PI * 2);
            ctx.fill();
            // eyes happy
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.arc(-8.5, hh - 16, 0.7, 0, Math.PI * 2);
            ctx.arc(-5.5, hh - 16, 0.7, 0, Math.PI * 2);
            ctx.fill();
            // smile
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.arc(-7, hh - 14, 1.5, 0.1 * Math.PI, 0.9 * Math.PI);
            ctx.stroke();

            // Kid 2 (with cap)
            ctx.fillStyle = C.skin;
            ctx.beginPath(); ctx.arc(7, hh - 15, 3.5, 0, Math.PI * 2); ctx.fill();
            // baseball cap
            ctx.fillStyle = "#1976D2";
            ctx.beginPath();
            ctx.arc(7, hh - 17, 3.8, Math.PI, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(8, hh - 17, 4, 1.5);
            // eyes
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.arc(5.5, hh - 15, 0.7, 0, Math.PI * 2);
            ctx.arc(8.5, hh - 15, 0.7, 0, Math.PI * 2);
            ctx.fill();
            // big smile
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.arc(7, hh - 13, 1.7, 0.1 * Math.PI, 0.9 * Math.PI);
            ctx.stroke();
            // Ice cream cones
            ctx.fillStyle = "#FFB74D";
            ctx.beginPath();
            ctx.moveTo(-10, hh - 9); ctx.lineTo(-7, hh - 9); ctx.lineTo(-8.5, hh - 6); ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#F48FB1";
            ctx.beginPath(); ctx.arc(-8.5, hh - 10, 1.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFB74D";
            ctx.beginPath();
            ctx.moveTo(5, hh - 9); ctx.lineTo(8, hh - 9); ctx.lineTo(6.5, hh - 6); ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath(); ctx.arc(6.5, hh - 10, 1.8, 0, Math.PI * 2); ctx.fill();
        }

        // Headlights/taillights
        ctx.fillStyle = "#FFF9C4";
        ctx.beginPath();
        ctx.ellipse(-hw + 10, -hh + 2, 5, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(hw - 10, -hh + 2, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#F44336";
        ctx.beginPath();
        ctx.ellipse(-hw + 10, hh - 4, 4, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(hw - 10, hh - 4, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Damage decals (drawn after car body)
        drawDamageDecals(carObj);

        ctx.restore();
    }

    function drawParkedCar(car) {
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.rot + Math.PI / 2);
        var hw = CAR_W / 2, hh = CAR_H / 2;

        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath();
        ctx.ellipse(3, 5, hw + 3, hh - 8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = C.wheel;
        roundRect(-hw - 3, -hh + 8, 7, 16, 3); ctx.fill();
        roundRect(hw - 4, -hh + 8, 7, 16, 3); ctx.fill();
        roundRect(-hw - 3, hh - 24, 7, 16, 3); ctx.fill();
        roundRect(hw - 4, hh - 24, 7, 16, 3); ctx.fill();

        ctx.fillStyle = shadeColor(car.color, -40);
        roundRect(-hw - 2, -hh - 2, CAR_W + 4, CAR_H + 4, 12); ctx.fill();
        var g2 = ctx.createLinearGradient(0, -hh, 0, hh);
        g2.addColorStop(0, shadeColor(car.color, 30));
        g2.addColorStop(1, car.color);
        ctx.fillStyle = g2;
        roundRect(-hw, -hh, CAR_W, CAR_H, 10); ctx.fill();

        ctx.fillStyle = "#78909C";
        roundRect(-hw + 6, hh - 22, CAR_W - 12, 14, 4); ctx.fill();
        roundRect(-hw + 8, -hh + 8, CAR_W - 16, 11, 3); ctx.fill();

        drawDamageDecals(car);
        ctx.restore();
    }

    function carIsInZone(car) {
        if (!parkingZone) return false;
        return car.x > parkingZone.x + 8 &&
               car.x < parkingZone.x + parkingZone.w - 8 &&
               car.y > parkingZone.y + 8 &&
               car.y < parkingZone.y + parkingZone.h - 8;
    }

    // ── Drawing: HUD ─────────────────────────────────────────
    function drawHeart(x, y, filled) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.bezierCurveTo(-8, -3, -14, -8, -14, -12);
        ctx.arc(-7, -14, 7, Math.PI, 0);
        ctx.arc(7, -14, 7, Math.PI, 0);
        ctx.bezierCurveTo(14, -8, 8, -3, 0, 4);
        ctx.closePath();
        if (filled) { ctx.fillStyle = C.heart; ctx.fill(); ctx.strokeStyle = "#AD1457"; }
        else { ctx.fillStyle = C.heartEmpty; ctx.fill(); ctx.strokeStyle = "#333"; }
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    // ── Drawing: Buttons (UI) ────────────────────────────────
    function drawButton(x, y, w, h, label, opts) {
        opts = opts || {};
        var bg = opts.bg || "#FFC107";
        var bgDark = opts.bgDark || "#FF6F00";
        var textColor = opts.text || "#FFFFFF";
        var disabled = opts.disabled;
        var icon = opts.icon;
        var smallLabel = opts.small;

        if (disabled) { bg = "#9E9E9E"; bgDark = "#616161"; }

        // press-squish feedback (when an id is supplied and recently flashed)
        var sc = opts.id ? getBtnPressScale(opts.id) : 1;
        if (sc !== 1) {
            ctx.save();
            var cx = x + w / 2, cy = y + h / 2;
            ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
        }

        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        roundRect(x, y + 4, w, h, 10); ctx.fill();
        // body
        ctx.fillStyle = bgDark;
        roundRect(x, y, w, h, 10); ctx.fill();
        ctx.fillStyle = bg;
        roundRect(x + 2, y + 2, w - 4, h - 6, 8); ctx.fill();
        // label
        drawText(label, x + w / 2, y + h / 2, "bold " + (smallLabel ? "14" : "20") + "px 'Segoe UI', Arial, sans-serif", textColor, "#000", 3);
        if (icon) drawText(icon, x + 14, y + h / 2, "bold 18px Arial", textColor, "#000", 3);

        if (sc !== 1) ctx.restore();
    }

    // Unified back-button helper — same look/size everywhere
    function drawBackButton(x, y) {
        x = (x === undefined) ? 12 : x;
        y = (y === undefined) ? 12 : y;
        drawButton(x, y, 80, 44, "◀ BACK", { bg: "#90A4AE", bgDark: "#455A64", small: true });
        return { x: x, y: y, w: 80, h: 44 };
    }

    function drawIconButton(x, y, size, icon, opts) {
        opts = opts || {};
        var bg = opts.bg || "#FFC107";
        var bgDark = opts.bgDark || "#FF6F00";
        var sc = opts.id ? getBtnPressScale(opts.id) : 1;
        if (sc !== 1) {
            ctx.save();
            var cx = x + size / 2, cy = y + size / 2;
            ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
        }
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        roundRect(x, y + 3, size, size, 8); ctx.fill();
        ctx.fillStyle = bgDark;
        roundRect(x, y, size, size, 8); ctx.fill();
        ctx.fillStyle = bg;
        roundRect(x + 2, y + 2, size - 4, size - 5, 6); ctx.fill();
        drawText(icon, x + size / 2, y + size / 2, "bold " + Math.floor(size * 0.55) + "px Arial", "#FFFFFF", "#000", 3);
        if (sc !== 1) ctx.restore();
    }

    function drawHUD() {
        // Shift the whole HUD below the notch / Dynamic Island (safe-area inset).
        ctx.save();
        ctx.translate(0, SAFE_TOP);
        // Score
        drawText(formatNum(Math.floor(score)), 70, 36, "bold 28px 'Segoe UI', Arial, sans-serif", C.hud, C.hudShadow, 5);
        drawText("SCORE", 70, 14, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 3);

        // Coins (current run)
        drawCoin(W - 100, 26, gameTime);
        drawText("× " + runCoins, W - 70, 27, "bold 20px 'Segoe UI', Arial, sans-serif", C.coin, C.hudShadow, 4, "left");

        // Hearts — lives can exceed the starting 3 now. Show up to 6 across
        // (empty slots up to MAX_LIVES so damage still reads clearly), then
        // collapse to a single heart + "×N" so it never runs off-screen.
        if (lives <= 6) {
            var slots = Math.max(MAX_LIVES, lives);
            for (var i = 0; i < slots; i++) {
                drawHeart(W / 2 - (slots - 1) * 14 + i * 28, 30, i < lives);
            }
        } else {
            drawHeart(W / 2 - 16, 30, true);
            drawText("×" + lives, W / 2 + 4, 30, "bold 18px 'Segoe UI', Arial, sans-serif",
                "#FF4081", "#000", 3, "left");
        }

        // Speed bar
        var speedPct = clamp((gameSpeed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED), 0, 1);
        var barW = 60, barH = 6;
        var barX = W - barW - 20, barY = 56;
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        roundRect(barX, barY, barW, barH, 3); ctx.fill();
        var sGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        sGrad.addColorStop(0, "#4CAF50");
        sGrad.addColorStop(0.5, "#FFC107");
        sGrad.addColorStop(1, "#F44336");
        ctx.fillStyle = sGrad;
        roundRect(barX, barY, barW * speedPct, barH, 3); ctx.fill();

        // Distracted mode indicator
        if (distractedMode) {
            drawText("DISTRACTED 2×", W / 2, 60, "bold 12px 'Segoe UI', Arial, sans-serif", "#FF80AB", "#000", 2);
        }

        // Nitro turbo indicator
        if (nitroTimer > 0) {
            drawText("🔥 NITRO", W / 2, 48, "bold 13px 'Segoe UI', Arial, sans-serif", "#FF7043", "#000", 3);
            ctx.fillStyle = "rgba(0,0,0,0.4)"; roundRect(W / 2 - 40, 56, 80, 6, 3); ctx.fill();
            ctx.fillStyle = "#FF7043"; roundRect(W / 2 - 38, 57, 76 * clamp(nitroTimer / 9, 0, 1), 4, 2); ctx.fill();
        }

        // Passenger buff timer
        if (passengerTimer > 0) {
            var pctP = passengerTimer / 30;
            var pY = distractedMode ? 75 : 60;
            // bg pill
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            roundRect(W / 2 - 70, pY - 9, 140, 18, 9); ctx.fill();
            // fill
            ctx.fillStyle = "#E91E63";
            roundRect(W / 2 - 68, pY - 7, 136 * pctP, 14, 7); ctx.fill();
            drawText("🚗 +" + passengers.length + " · 2× COINS · " + Math.ceil(passengerTimer) + "s",
                W / 2, pY, "bold 11px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2);
        }

        // Pause button (top-left corner)
        drawIconButton(PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, "❚❚", { bg: "#FFFFFF", bgDark: "#BDBDBD", id: "pause" });

        // Mobile boost/brake buttons (only show on touch devices)
        if (isTouchDevice) {
            drawIconButton(MOBILE_BOOST_RECT.x, MOBILE_BOOST_RECT.y, MOBILE_BOOST_RECT.w,
                "▲", { bg: keys.up ? "#FFEB3B" : "#FFC107", bgDark: "#FF6F00" });
            drawIconButton(MOBILE_BRAKE_RECT.x, MOBILE_BRAKE_RECT.y, MOBILE_BRAKE_RECT.w,
                "▼", { bg: keys.down ? "#64B5F6" : "#90CAF9", bgDark: "#1565C0" });
        }

        // Missile button (bottom-right)
        var mY = MISSILE_RECT.y;
        drawIconButton(MISSILE_RECT.x, mY, MISSILE_RECT.w, "🚀", { bg: save.missiles > 0 ? "#F44336" : "#9E9E9E", bgDark: save.missiles > 0 ? "#B71C1C" : "#616161", id: "missile" });

        // Honk button (above missile, right side)
        drawIconButton(HONK_RECT.x, HONK_RECT.y, HONK_RECT.w, "📣",
            { bg: honkCooldown > 0 ? "#FFEB3B" : "#FFC107", bgDark: "#FF6F00", id: "honk" });
        // Honk-chain badge — shows the current musical streak so the Honk
        // Symphony combo is visible instead of an invisible hidden mechanic.
        if (honkChain > 0) {
            var hcx = HONK_RECT.x + HONK_RECT.w - 4, hcy = HONK_RECT.y - 2;
            var grow = 1 + Math.min(honkChain, 7) * 0.06;
            ctx.save();
            ctx.translate(hcx, hcy);
            ctx.scale(grow, grow);
            ctx.fillStyle = honkChain >= 5 ? "#FF4FA3" : "#7C4DFF";
            ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#FFF"; ctx.lineWidth = 2; ctx.stroke();
            drawText("♪" + honkChain, 0, 1, "bold 12px Arial", "#FFF", "#000", 2);
            ctx.restore();
            // thin timeout ring showing how long the chain stays alive
            ctx.strokeStyle = "rgba(255,255,255,0.85)";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(hcx, hcy, 16, -Math.PI / 2,
                -Math.PI / 2 + Math.PI * 2 * clamp(honkChainResetTimer / 1.5, 0, 1));
            ctx.stroke();
        }
        // count badge
        if (save.missiles > 0) {
            ctx.fillStyle = "#FFC107";
            ctx.beginPath();
            ctx.arc(W - 22, mY + 5, 13, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#FF6F00";
            ctx.lineWidth = 2;
            ctx.stroke();
            drawText(save.missiles, W - 22, mY + 6, "bold 14px Arial", "#000", null, 0);
        }

        // Parking / event message banner
        if (parkingMsgTimer > 0) {
            var alp = clamp(parkingMsgTimer / 2, 0, 1);
            ctx.fillStyle = "rgba(0,0,0," + (0.7 * alp) + ")";
            roundRect(W / 2 - 140, 90, 280, 36, 10); ctx.fill();
            ctx.globalAlpha = alp;
            drawText(parkingMsg, W / 2, 108, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3);
            ctx.globalAlpha = 1;
        }

        // Ima's text message — phone bubble in top-right
        if (imaText) {
            var alpha2 = imaText.t < 0.3 ? imaText.t / 0.3
                       : imaText.t > imaText.dur - 0.5 ? (imaText.dur - imaText.t) / 0.5 : 1;
            var buzz = imaText.t < 0.4 ? Math.sin(imaText.t * 50) * 3 : 0;
            ctx.save();
            ctx.globalAlpha = alpha2;
            // Phone body
            var px = W - 130 + buzz, py = 130;
            ctx.fillStyle = "#212121";
            roundRect(px, py, 110, 92, 8); ctx.fill();
            ctx.fillStyle = "#FFFFFF";
            roundRect(px + 4, py + 4, 102, 84, 5); ctx.fill();
            // Sender header (Ima = pink, Esti = purple/wistful)
            var isEsti = imaText.sender === "esti";
            ctx.fillStyle = isEsti ? "#9575CD" : "#FF80AB";
            roundRect(px + 4, py + 4, 102, 18, 5); ctx.fill();
            drawText(isEsti ? "💔 ESTI" : "📞 IMA", px + 55, py + 13, "bold 11px Arial", "#FFFFFF", null, 0);
            // Message bubble
            ctx.fillStyle = "#E1F5FE";
            roundRect(px + 8, py + 26, 94, 56, 6); ctx.fill();
            ctx.strokeStyle = "#0288D1";
            ctx.lineWidth = 1.5;
            roundRect(px + 8, py + 26, 94, 56, 6); ctx.stroke();
            // Render multi-line message
            var lines = imaText.msg.split("\n");
            for (var li = 0; li < lines.length; li++) {
                drawText(lines[li], px + 55, py + 38 + li * 12, "11px Arial", "#212121", null, 0);
            }
            ctx.restore();
        }
        ctx.restore(); // end SAFE_TOP shift
    }

    // ── State & Globals ──────────────────────────────────────
    var state = "charSelect"; // start by picking a Bruck sister
    var prevState = "menu";
    var selectedChar = "lulu"; // "lulu" or "dina"
    var charHovered = null; // for character-select UI feedback
    var charSelectTime = 0;
    // Dina mode state
    var dina = null;        // {x, y, walkTime, vx, vy, sprintTimer, sprintCool, stumble, holding}
    var mom = null;         // {x, y, walkTime, speed, distance}
    var dinaRunPhase = 0;   // 0 = intro/bus, 1 = running, 2 = home/caught outro
    var dinaRunTimer = 0;
    var dinaRunDistance = 0;   // 0 -> 1 = home
    var dinaSidewalk = [];     // hazards spawned in front of dina
    var dinaSidewalkSpawn = 0;
    var dinaStickers = 0;
    var dinaCoinsRun = 0;
    var dinaEnding = "ran"; // "ran" = beat mom, "walked" = mom caught up
    var schoolBus = null;   // intro animation state
    var schoolGirls = [];   // girls coming off the bus
    var dinaCharacterFace = "happy"; // happy, determined, sleepy
    // Home interior state
    var dinaHome = { x: 240, y: 600, walkTime: 0, facing: "down" };
    var homeMessage = "";
    var homeMessageTimer = 0;
    var homeInteraction = null; // "morgan" | "tablet" | "nap"
    // Morgan plushie mode
    var morganHappy = 0;     // 0-100
    var morganPetSpot = null; // {x, y, t} location to tap
    var morganMood = "calm";
    var morganTimer = 0;
    // Tablet game
    var tabletTransitionTimer = 0;
    var inTabletMode = false; // true means Lulu game is running inside the tablet visual

    // Parking extras (cones, obstacles in parking spot) — declared here to avoid hoisting fragility
    var parkingExtras = [];
    var morganHearts = [];
    var player = { x: W / 2, y: PLAYER_Y, tilt: 0, targetX: W / 2 };
    var score = 0;
    var runCoins = 0;
    var lives = MAX_LIVES;
    var gameSpeed = BASE_SPEED;
    var scrollOffset = 0;
    var gameTime = 0;
    var invincibleTimer = 0;
    var shakeTimer = 0;
    var shakeIntensity = 0;
    var flashTimer = 0;
    var crashTimer = 0;
    var menuBounce = 0;
    var gameOverAlpha = 0;
    var dustTimer = 0;
    var distractedMode = false;

    // Passengers (picked-up pedestrians)
    var passengers = []; // {pedType, hairColor, shirtColor}
    var passengerTimer = 0;

    // Crash animation state
    var crashX = 0, crashY = 0, crashRot = 0, crashRotVel = 0;

    // Angry man crash sequence
    var crashPhase = 0; // 0: explosion, 1: man running, 2: man yelling, 3: man hit, 4: done
    var crashPhaseTimer = 0;
    var angryMan = null;
    var revengeCar = null;

    var obstacles = [];
    var coinEntities = [];
    var heartEntities = [];   // rare extra-life pickups
    var fuelCans = [];        // gas-station nitro pickups
    var nitroTimer = 0;       // seconds of turbo remaining
    var tollBooth = null;     // active toll booth {y, open:[lanes], paid}
    var animals = [];
    var missiles = [];
    var heshy = null;         // Heshy-in-the-pool Easter egg cameo {t, dur}

    var spawnClocks = { car: 0, cone: 0, puddle: 0, animal: 0, coin: 0, ped: 0 };

    // Shop UI state
    var shopTab = "skins"; // skins, powerups, special
    var lastBoughtMessage = "";
    var lastBoughtTimer = 0;

    // ── Parking mini-game state ──────────────────────────────
    var parkingSigns = [];      // P-sign pickups on the main road
    var parkingSpawnTimer = 25; // first parking sign appears around 25s in
    var parkingCar = null;      // Lulu's car in the parking scene
    var parkedCars = [];        // two stationary parked cars
    var parkingZone = null;     // {x,y,w,h} target spot
    var parkingCameras = [];    // [{x,y,poleH,currentRot,blink}]
    var parkingResult = null;   // "success" | "fail"
    var parkingResultTimer = 0;
    var parkingResultPhase = 0;
    var parkingTransitionTimer = 0;
    var parkingTransitionDuration = 0.9;
    var parkingZoom = 1;
    var parkingFlashTimer = 0;
    var parkingMsg = "";
    var parkingMsgTimer = 0;
    var parkingInZoneTimer = 0; // how long Lulu has been in zone, stationary
    var parkingTimeLeft = 0;    // countdown
    var parkingFailHit = null;  // {who:"parked"|"curb", x,y, side, severity}
    var parkingScore = 0;       // bonus accumulating
    var kidsInCar = false;      // true after success
    // Challenge mode
    var parkingChallengeMode = false;
    var parkingLevel = 1;
    var parkingChallengeLives = 3;
    var parkingChallengeStars = 0;
    var parkingChallengeCoins = 0;
    var parkingLevelStartTimer = 0; // shows "LEVEL N" intro
    var parkingLevelConfig = null;
    var parkingPedestrian = null; // walking obstacle on harder levels
    var parkingTouchedCar = false; // used for star calculation
    var parkingPerfect = true;
    var parkingLevelIntroText = "";
    var parkingEndStats = null;

    function getParkingLevelConfig(level) {
        // Spot width tightens (CAR_H is the long axis when rotated)
        var spotW = Math.max(CAR_H + 22 - level * 2.2, CAR_H + 4);
        var theme;
        if (level <= 3) theme = "day";
        else if (level <= 6) theme = "dusk";
        else theme = "night";
        return {
            level: level,
            spotWidth: spotW,
            numCameras: Math.min(1 + Math.floor((level - 1) / 2), 3),
            timeLimit: Math.max(60 - level * 2.5, 25),
            theme: theme,
            coneInSpot: level >= 4,
            pedestrian: level >= 5,
            traffic: level >= 7,
            sasquatchWatcher: level === 10 // special boss flavor
        };
    }

    // Roleplay scenarios + extras
    var sasquatchTimer = rand(40, 70);
    var sasquatch = null; // {x, y, phase, timer}
    var sasquatchPassenger = 0; // seconds remaining as passenger in Lulu's car
    var billboards = [];  // {x, y, msg, parallax}
    var billboardTimer = 8;
    var honkCooldown = 0;
    var copEvent = null;  // {phase, timer, x, y}
    var copEventTimer = rand(60, 120);
    // Speed-trap cops: parked + hidden on the shoulder, then chase if provoked
    var roadCops = [];    // [{x, y, side, hide, spot, busted}]
    var copChase = null;  // active chase {gap, x, siren, escapeT}
    var copBust = null;   // caught cutscene {phase, timer, man, copY, fromLeft, yell}
    // Ima (Mom) text messages mini-event
    var imaTextTimer = rand(35, 75);
    var imaText = null; // { msg, t, dur, sender }
    var IMA_TEXTS = [
        "did u eat? 🥨",
        "abba making\ncholent — stop\nat store",
        "your cousin got\na real job 😉",
        "u still alive? 📞",
        "ima loves u ❤️",
        "PICK UP DINA!!",
        "we have leftovers",
        "ride safe mamaleh"
    ];
    // Esti — Lulu's ex-best-friend. Rarer, bittersweet texts.
    var ESTI_TEXTS = [
        "hey... i miss u 🥺",
        "we used to be\nbest friends...",
        "saw ur car today.\nu didn't wave 😢",
        "do u still have\nour bracelet?",
        "miss our drives\ntogether 💔",
        "can we talk?\ni miss u, Lu"
    ];
    var iceCreamSigns = []; // similar to parking signs
    var iceCreamSpawnTimer = 60;

    // ── Avigail mode ─────────────────────────────────────────
    var avigailWalker = null;       // {x, y, walkTime} roadside Avigail to reach
    var avigailSpawnTimer = rand(30, 55);
    var avigailInCar = false;       // 2x points active
    var avigailStep = 0;            // door interaction step
    var avigailReplyTimer = 0;      // showing Avigail's reply
    var avigailReply = "";          // current reply line
    var avigailExpr = "suspicious"; // facial expression
    var avigailDoorTimer = 0;       // intro knock timer
    var avigailChoices = [];        // current choice buttons
    var avigailResolved = false;
    var pointMult = 1;              // overall score multiplier from Avigail

    // ── Salon mode ───────────────────────────────────────────
    var salonSigns = [];
    var salonSpawnTimer = rand(40, 70);
    var salonPhase = 0;             // 0 intro,1 consult,2 style,3 color,4 process,5 reveal
    var salonTimer = 0;
    var salonPendingColor = null;
    var salonIsBlonde = false;
    var salonReaction = "";
    var salonStyle = null;
    var salonOops = false;
    var salonConsultStep = 0;
    var SALON_COLORS = [
        { label: "PLATINUM", hex: "#F5E6C8", blonde: true,
          fabio: "PLATINUM?! Like zee\nDIAMOND of zee HEAD!",
          luluWin: "I'm BLONDE! I'm basically a\ndifferent person now!" },
        { label: "GOLDEN", hex: "#E6B800", blonde: true,
          fabio: "GOLD! Zee Maccabees would\nWEEP. In a GOOD way!",
          luluWin: "Fabio, I could KISS you.\nI won't. But I COULD." },
        { label: "BRUNETTE", hex: "#6B4423", blonde: false,
          fabio: "Brunette… bold. Brave.\nBasically a SHEITEL, no?",
          luluLose: "It's the SAME?! I paid for\na personality change!!" },
        { label: "JET BLACK", hex: "#1A1A1A", blonde: false,
          fabio: "So DARK. So MYSTERIOUS.\nSo… Tisha B'Av, non?",
          luluLose: "I look like I joined a SAD\nBAND. Where's the WARRANTY?!" },
        { label: "PINK", hex: "#FF6FB5", blonde: false,
          fabio: "PINK! Zee Bubbe will plotz.\nMaybe FAINT. Worth it!",
          luluLose: "I'm a COTTON CANDY GOBLIN!\nMy LAWYER will hear of this!" },
        { label: "BLUE", hex: "#5B8DEF", blonde: false,
          fabio: "BLUE?! Zis is not zee\nmikveh, mon chou!",
          luluLose: "I look like a TROLL doll!!\n...tell my car I loved it." }
    ];
    // Pre-cut consult: each tap reveals the next Fabio line.
    var SALON_CONSULT = [
        "Sit, sit! Tell Fabio…\nwhat is zee VIBE today?",
        "Mm-hm. MM-hm. I see\nGREAT trauma in zis hair.",
        "Zis hair has not seen\nShabbos in WEEKS, non?",
        "Do not worry. Fabio fixes\nEVERYTHING. Even your AURA."
    ];
    // Style is flavor only — does NOT change save.luluHair, but flavors Fabio's reaction.
    var SALON_STYLES = [
        { label: "ZEE SHEITEL", fabio: "Classic. Timeless. Your\nBubbe sheds a TEAR." },
        { label: "BIG & BOUNCY", fabio: "VOLUME! We will need a\nLARGER doorway!" },
        { label: "THE 'AVIGAIL'", fabio: "Curls to zee HEAVENS!\nZee neighbors will TALK." }
    ];
    var SALON_PROCESS_BEATS = [
        "Mixing zee potion…",
        "I add a PINCH of CHUTZPAH…",
        "Patience is beauty, mon chou…",
        "Zee foils! Zey SING to me!",
        "Almost… ALMOST… do not BLINK…"
    ];
    var SALON_OOPS = {
        fabio: "…OKAY zee cat knocked zee\nbottle. But I MEANT zat!",
        lulu:  "MY HAIR. WHAT did you DO.\n...okay it's kind of GREAT."
    };

    function resetGame() {
        player.x = W / 2; player.targetX = W / 2; player.tilt = 0;
        score = 0; runCoins = 0; lives = MAX_LIVES;
        gameSpeed = BASE_SPEED; scrollOffset = 0; gameTime = 0;
        invincibleTimer = 0; shakeTimer = 0; flashTimer = 0; crashTimer = 0;
        obstacles = []; coinEntities = []; heartEntities = []; animals = []; missiles = []; particles = [];
        fuelCans = []; nitroTimer = 0; tollBooth = null;
        heshy = null;
        spawnClocks = { car: 0, cone: 0, puddle: 0, animal: 0, coin: 0, ped: 0 };
        initSpawnTimers(); // randomized first-appearance per run (see 01b-spawn-tuning.js)
        passengers = []; passengerTimer = 0;
        crashPhase = 0; crashPhaseTimer = 0; angryMan = null; revengeCar = null;
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

    function spawnTollBooth() {
        var sh = [0, 1, 2];
        for (var i = sh.length - 1; i > 0; i--) { var j = randInt(0, i); var t = sh[i]; sh[i] = sh[j]; sh[j] = t; }
        var openCount = Math.random() < 0.5 ? 1 : 2; // 1-2 lanes open
        tollBooth = { y: -110, open: sh.slice(0, openCount), paid: false };
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
            obstacles.push({
                type: "car", x: x, y: y,
                color: randPick(C.enemyCols),
                carType: randInt(0, 2),
                hitW: 36, hitH: 64,
                speedMult: gameTime > 90 && Math.random() > 0.6 ? 1.4 : 0.6,
                lane: lane,
                behavior: pickCarBehavior(),
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
                        // Out of lives → straight to the crash sequence (no grace).
                        crashX = player.x;
                        crashY = player.y;
                        crashRot = 0;
                        crashRotVel = rand(-8, 8);
                        spawnCrashBurst(player.x, player.y, true);
                        state = "crash";
                        crashPhase = 0;
                        crashPhaseTimer = 1.4;
                        if (score > save.highScore) save.highScore = Math.floor(score);
                        persistSave();
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
    // Transient visual-only pickup pops (coin collect rings). Drawn in drawPlaying.
    var coinPops = [];

    // Grant a few seconds of collision immunity when re-entering the driving
    // world from a sub-scene (parking / Avigail / salon / tablet), so the player
    // isn't instantly hit by an obstacle that was already on top of the car.
    // Also recenters the car and clears any obstacle currently overlapping it.
    var REENTRY_IMMUNITY = 3.0; // seconds
    function returnToDriving() {
        state = "playing";
        invincibleTimer = Math.max(invincibleTimer, REENTRY_IMMUNITY);
        if (player) { player.targetX = LANES[1]; player.x = LANES[1]; }
        // Sweep away anything sitting right where the car will be, so the grace
        // window starts clean instead of with a pile-up at the player's feet.
        if (typeof obstacles !== "undefined" && obstacles && player) {
            for (var i = obstacles.length - 1; i >= 0; i--) {
                if (Math.abs(obstacles[i].y - player.y) < 160) obstacles.splice(i, 1);
            }
        }
    }

    function updatePlaying(dt) {
        gameTime += dt;
        var baseGameSpeed = Math.min(BASE_SPEED + gameTime * SPEED_RAMP, MAX_SPEED);
        // Speed control: up = boost, down = slow
        var speedMod = 1;
        if (keys.up) speedMod = 1.6;
        else if (keys.down) speedMod = 0.5;
        // Nitro (from gas-station fuel cans): turbo speed, shielded, and you plow
        // through traffic for bonus points.
        if (nitroTimer > 0) {
            nitroTimer = Math.max(0, nitroTimer - dt);
            speedMod = Math.max(speedMod, 2.0);
            invincibleTimer = Math.max(invincibleTimer, 0.2);
            score += baseGameSpeed * dt * 0.06;
        }
        gameSpeed = baseGameSpeed * speedMod;
        scrollOffset += gameSpeed * dt;
        var scoreMult = (distractedMode ? 2 : 1) * pointMult;
        var coinMult = (passengerTimer > 0 ? 2 : 1) * pointMult;
        score += gameSpeed * dt * 0.08 * scoreMult;

        // Steering (reversed if distracted)
        var steerInput = getSteer(player.x);
        if (distractedMode) steerInput = -steerInput;
        var steerSpeed = 300;
        player.targetX += steerInput * steerSpeed * dt;
        player.targetX = clamp(player.targetX, ROAD_L + CAR_W / 2 + 4, ROAD_R - CAR_W / 2 - 4);
        player.x = lerp(player.x, player.targetX, Math.min(1, 10 * dt));
        player.tilt = lerp(player.tilt, steerInput * 0.08, Math.min(1, 8 * dt));

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

        if (spawnClocks.car <= 0) { spawnClocks.car = rand(1.0, 2.2) * speedFactor; spawnObstacle("car"); }
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
        // Hidden roadside speed-trap cops (rarity in 01b-spawn-tuning.js)
        if (tickSpawn("copHide", dt) && gameTime > 15 && !copChase && roadCops.length < 2) spawnRoadCop();
        updateCops(dt);

        // Roadside encounter events — rarity + randomized order live in
        // 01b-spawn-tuning.js (SPAWN_CONFIG). tickSpawn() handles timing + odds.
        // Parking sign spawn
        if (tickSpawn("parkingSign", dt) && parkingSigns.length === 0 && gameTime > 20) {
            spawnParkingSign();
        }
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
            else if (aabb(player.x, player.y, CAR_W, CAR_H, avigailWalker.x, avigailWalker.y, avigailWalker.hitW, avigailWalker.hitH)) {
                avigailWalker = null;
                startAvigailScene();
                return;
            }
        }
        // Salon sign on the roadside
        if (tickSpawn("salon", dt) && salonSigns.length === 0 && gameTime > 25) {
            salonSigns.push({ x: LANES[randInt(0, 2)], y: -60, hitW: 30, hitH: 34, bob: 0 });
        }
        for (var ssi = salonSigns.length - 1; ssi >= 0; ssi--) {
            var ssg = salonSigns[ssi];
            ssg.y += gameSpeed * dt;
            ssg.bob += dt;
            if (ssg.y > H + 60) { salonSigns.splice(ssi, 1); continue; }
            if (aabb(player.x, player.y, CAR_W, CAR_H, ssg.x, ssg.y, ssg.hitW, ssg.hitH)) {
                salonSigns.splice(ssi, 1);
                startSalonScene();
                return;
            }
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
            // 1 in 3 chance it's Esti (the ex-bff); otherwise Ima
            if (Math.random() < 0.33) {
                imaText = { msg: randPick(ESTI_TEXTS), t: 0, dur: 4.5, sender: "esti" };
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
            // Make pedestrians wave and animals scatter
            for (var hh = 0; hh < obstacles.length; hh++) {
                if (obstacles[hh].type === "ped") obstacles[hh].waving = 1.5;
            }
            for (var hk = 0; hk < animals.length; hk++) animals[hk].vx *= 1.5;
        }
        honkChainResetTimer -= dt;
        if (honkChainResetTimer <= 0) honkChain = 0;

        // Pause check
        if (consumePause()) {
            prevState = "playing";
            state = "paused";
            playClick();
            return;
        }

        // Click on pause/missile buttons (mouse fallback — touch path already routes via hitGameButton)
        var click = consumeClick();
        if (click) {
            if (pointInRect(click.x, click.y, PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, PAUSE_RECT.h)) {
                prevState = "playing"; state = "paused"; playClick(); return;
            } else if (pointInRect(click.x, click.y, MISSILE_RECT.x, MISSILE_RECT.y, MISSILE_RECT.w, MISSILE_RECT.h)) {
                fireMissile();
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
            o.y += gameSpeed * o.speedMult * dt;
            if (o.walkTime !== undefined) o.walkTime += dt;
            if (o.y > H + 100) { obstacles.splice(i, 1); continue; }

            // Traffic parts for the ambulance: nearby cars veer to the shoulder.
            if (ambulance && o !== ambulance && o.type === "car" && Math.abs(o.y - ambulance.y) < 150) {
                var away = o.x < ambulance.x ? -1 : 1;
                o.x = clamp(o.x + away * 80 * dt, ROAD_L + 20, ROAD_R - 20);
            }

            // Drunk drivers weave hard across lanes (and spill booze); texting
            // drivers drift gently. Both make the lane gaps unsafe.
            if (o.type === "car" && o.behavior === "drunk") {
                o.swerveT += dt;
                o.x = clamp(o.x + Math.sin(o.swerveT * 2.6) * 95 * dt, ROAD_L + 22, ROAD_R - 22);
                o.spillT -= dt;
                if (o.spillT <= 0) { o.spillT = rand(0.25, 0.6); spawnAlcoholDrop(o.x, o.y); }
            } else if (o.type === "car" && o.behavior === "texting") {
                o.swerveT += dt;
                o.x = clamp(o.x + Math.sin(o.swerveT * 1.1) * 42 * dt, ROAD_L + 22, ROAD_R - 22);
            }

            if (aabb(player.x, player.y, CAR_W * 0.7, CAR_H * 0.7, o.x, o.y, o.hitW, o.hitH)) {
                if (o.type === "ped") {
                    // Pick up the pedestrian as passenger! Always (even during invincibility).
                    pickUpPassenger(o);
                    // Bonk someone in front of a watching cop → instant chase.
                    if (!copChase && !copBust) {
                        var witness = copInView();
                        if (witness) startCopChase(witness);
                    }
                    obstacles.splice(i, 1);
                    continue;
                }
                if (o.type === "pool") {
                    // Easter egg — never a penalty. Summon Heshy + grant a shield.
                    triggerHeshy();
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
                    score += 15 * scoreMult;
                    spawnFloater((o.x + player.x) / 2, player.y - 8, "WHOOSH!", "#80D8FF");
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
                    playTone(720, 0.05, "sine", 0.06, 1100);
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
                runCoins += coinMult;
                save.totalCoins += coinMult;
                persistSave();
                score += 100 * scoreMult * coinMult;
                spawnCoinSparkle(c.x, c.y);
                spawnFloater(c.x, c.y, "+" + coinMult, "#FFD700");
                // little pop ring that scales up and fades
                coinPops.push({ x: c.x, y: c.y, t: 0 });
                if (coinPops.length > 12) coinPops.shift();
                playCoin();
                coinEntities.splice(j, 1);
            }
        }
        // Age coin-pickup pops
        for (var cp = coinPops.length - 1; cp >= 0; cp--) {
            coinPops[cp].t += dt;
            if (coinPops[cp].t > 0.35) coinPops.splice(cp, 1);
        }

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
            if (!fc.collected && aabb(player.x, player.y, CAR_W, CAR_H * 0.8, fc.x, fc.y, fc.hitW, fc.hitH)) {
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
            if (aabb(player.x, player.y, CAR_W, CAR_H * 0.8, psi.x, psi.y, psi.hitW, psi.hitH)) {
                parkingSigns.splice(ps, 1);
                triggerParkingMinigame();
                return;
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
        if (zone === "market" && Math.random() < dt * 0.9) {
            spawnAnimal(); // animals wandering across from the market
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
                    score += 60 * scoreMult;
                    spawnFloater(player.x, player.y - 40, "🎫 TOLL!", "#FFD54F");
                    playCoin();
                }
            }
        }
    }

    function hitPlayer(obj) {
        lives--;
        invincibleTimer = INVINCIBLE_TIME;
        shakeTimer = 0.4;
        shakeIntensity = 6;
        flashTimer = 0.15;
        spawnCrashBurst(obj.x, obj.y, false);
        if (lives <= 0) {
            // BIG crash + angry-man sequence
            crashX = player.x;
            crashY = player.y;
            crashRot = 0;
            crashRotVel = rand(-8, 8);
            spawnCrashBurst(player.x, player.y, true);
            playExplosion();
            setTimeout(playWompWomp, 400);
            state = "crash";
            crashPhase = 0;
            crashPhaseTimer = 1.4; // explosion duration
            shakeTimer = 0.8;
            shakeIntensity = 10;
            angryMan = null;
            revengeCar = null;
            if (score > save.highScore) {
                save.highScore = Math.floor(score);
            }
            persistSave();
        } else {
            playWompWomp();
        }
    }

    // ── Speed-trap cops ──────────────────────────────────────
    var COP_YELLS = ["PULL OVER!", "LICENSE AND\nREGISTRATION!", "YOU'RE BUSTED,\nLULU!", "NO SPEEDING\nIN MY TOWN!", "THAT'S A\nTICKET!"];

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

    function updateCops(dt) {
        var speeding = keys.up || gameSpeed > 520; // flooring it, or just plain fast
        for (var i = roadCops.length - 1; i >= 0; i--) {
            var cop = roadCops[i];
            cop.y += gameSpeed * dt;
            if (cop.y > H + 100) { roadCops.splice(i, 1); continue; }
            var inView = cop.y > 60 && cop.y < H - 40;
            if (!copChase && !copBust && !cop.busted && inView && speeding) {
                cop.spot += dt; // a short fuse so you can brake to avoid it
                if (cop.spot >= 0.65) { startCopChase(cop); continue; }
            } else {
                cop.spot = Math.max(0, cop.spot - dt * 1.5);
            }
        }
        if (copChase) updateCopChase(dt);
    }

    function startCopChase(cop) {
        cop.busted = true;
        var idx = roadCops.indexOf(cop);
        if (idx >= 0) roadCops.splice(idx, 1); // it's now the chaser, not a parked cop
        copChase = { gap: 160, x: cop.x, siren: 0, escapeT: 0 };
        shakeTimer = 0.3; shakeIntensity = 5;
        spawnFloater(player.x, player.y - 50, "🚨 SPEED TRAP!", "#F44336");
        playTone(680, 0.25, "sawtooth", 0.14, 460);
        setTimeout(function () { playTone(460, 0.25, "sawtooth", 0.14, 680); }, 240);
    }

    function updateCopChase(dt) {
        copChase.siren += dt;
        copChase.x = lerp(copChase.x, player.x, Math.min(1, 3 * dt));
        // The cruiser keeps pace with your NATURAL speed, so being fast isn't
        // enough — only actively flooring it (boost) opens a gap; cruising lets
        // him slowly reel you in, braking lets him catch fast. This keeps the
        // chase tense at any speed instead of ending instantly when you're fast.
        var baseSpeed = Math.min(BASE_SPEED + gameTime * SPEED_RAMP, MAX_SPEED);
        var copCruise = baseSpeed * 1.12;
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
                copChase = null;
                return;
            }
        } else { copChase.escapeT = 0; }
        if (copChase.gap <= 6) startCopBust();
    }

    function startCopBust() {
        var fromLeft = player.x > W / 2;
        copBust = { phase: 0, timer: 0.8, copY: player.y + 90, man: null,
                    fromLeft: fromLeft, yell: randPick(COP_YELLS) };
        copChase = null;
        state = "copBust";
        shakeTimer = 0.5; shakeIntensity = 8;
        playWompWomp();
        if (score > save.highScore) save.highScore = Math.floor(score);
        persistSave();
    }

    function updateCopBust(dt) {
        if (shakeTimer > 0) shakeTimer -= dt;
        copBust.timer -= dt;
        updateParticles(dt);
        if (copBust.phase === 0) {
            // cop cruiser pulls up right behind Lulu
            copBust.copY = lerp(copBust.copY, player.y + 56, Math.min(1, 5 * dt));
            if (copBust.timer <= 0) {
                copBust.phase = 1;
                copBust.man = {
                    x: copBust.fromLeft ? -30 : W + 30,
                    y: player.y + 30,
                    targetX: player.x + (copBust.fromLeft ? -42 : 42),
                    time: 0, state: "running", runDir: copBust.fromLeft ? 1 : -1
                };
            }
            return;
        }
        if (copBust.phase === 1) {
            copBust.man.time += dt;
            var dir = copBust.man.targetX - copBust.man.x;
            if (Math.abs(dir) > 5) { copBust.man.x += Math.sign(dir) * 230 * dt; }
            else { copBust.man.x = copBust.man.targetX; copBust.man.state = "yelling"; copBust.phase = 2; copBust.timer = 2.8; }
            return;
        }
        if (copBust.phase === 2) {
            copBust.man.time += dt;
            if (copBust.timer <= 0) { copBust = null; state = "gameover"; }
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

    function drawCopBust() {
        drawRoad(scrollOffset);
        drawDecorations(gameTime);
        ctx.save();
        if (shakeTimer > 0) ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        drawCopCar(player.x, copBust.copY, gameTime * 3); // sirens flashing
        drawLuluCar(player.x, player.y, 0, false, gameTime, distractedMode);
        if (copBust.man) {
            drawAngryMan(copBust.man.x, copBust.man.y, copBust.man.time, copBust.man.state, copBust.man.runDir);
            if (copBust.man.state === "yelling") {
                var lines = copBust.yell.split("\n");
                for (var li = 0; li < lines.length; li++) {
                    drawText(lines[li], copBust.man.x, copBust.man.y - 72 + li * 18,
                        "bold 15px 'Segoe UI', Arial, sans-serif", "#FFEB3B", "#7A0000", 4);
                }
            }
        }
        ctx.restore();
        drawParticles();
        drawText("🚨 BUSTED! 🚨", W / 2, H * 0.16, "bold 38px 'Segoe UI', Arial, sans-serif", "#F44336", "#000", 7);
        drawText("Caught speeding!", W / 2, H * 0.16 + 36, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
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
    var angryYell = "";

    function updateCrash(dt) {
        crashPhaseTimer -= dt;
        shakeTimer -= dt;
        flashTimer -= dt;
        crashRot += crashRotVel * dt;
        crashRotVel *= 0.96; // friction
        updateParticles(dt);

        // Phase 0: initial explosion (no scrolling — everything stops)
        if (crashPhase === 0) {
            if (crashPhaseTimer <= 0) {
                // Spawn angry man on the opposite side of Lulu's car
                var fromLeft = player.x > W / 2;
                angryMan = {
                    x: fromLeft ? -30 : W + 30,
                    y: player.y + 50,
                    targetX: player.x + (fromLeft ? -38 : 38),
                    time: 0,
                    state: "running",
                    runDir: fromLeft ? 1 : -1
                };
                angryYell = randPick(ANGRY_YELLS);
                crashPhase = 1;
            }
            return;
        }

        // Phase 1: man runs in
        if (crashPhase === 1) {
            angryMan.time += dt;
            var dir = angryMan.targetX - angryMan.x;
            var runSpeed = 220;
            if (Math.abs(dir) > 5) {
                angryMan.x += Math.sign(dir) * runSpeed * dt;
            } else {
                angryMan.x = angryMan.targetX;
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

        // Phase 2: man yelling — spawn a revenge car coming down
        if (crashPhase === 2) {
            angryMan.time += dt;
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
                state = "gameover";
                gameOverAlpha = 0;
                Ads.onGameOver(); // interstitial in the native app; no-op on web
            }
            return;
        }
    }

    // ── Update: Game Over ────────────────────────────────────
    function updateGameOver(dt) {
        gameOverAlpha = Math.min(gameOverAlpha + dt * 2, 1);
        // Clear residual angry-man/revenge-car state so they don't keep moving
        if (angryMan) angryMan = null;
        if (revengeCar) revengeCar = null;
        updateParticles(dt);
        var click = consumeClick();
        if (click) {
            // Rewarded ad button (native only — gated by an actually-loaded ad)
            if (Ads.rewardedAvailable() &&
                pointInRect(click.x, click.y, W / 2 - 130, H * 0.70 - 26, 260, 52)) {
                Ads.showRewarded(function () {
                    runCoins += 50; save.totalCoins += 50; persistSave();
                    spawnFloater(W / 2, H * 0.40, "+50 ★", "#FFD700");
                });
                playClick(); return;
            }
            // Restart button
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.78 - 30, 220, 60)) {
                resetGame(); state = "playing"; playClick(); return;
            }
            // Menu button
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.88 - 25, 220, 50)) {
                if (inTabletMode) { inTabletMode = false; state = "dinaHome"; playClick(); return; }
                state = "charSelect"; playClick(); return;
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
        if (menuMsgTimer > 0) menuMsgTimer -= dt;
        updateDecorations(dt, 80);
        var click = consumeClick();
        if (click) {
            // PLAY button
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.50, 220, 60)) {
                resetGame(); gotoState("playing"); playClick(); return;
            }
            // PARKING CHALLENGE button — locked until bought with coins.
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.50 + 68, 220, 54)) {
                if (!save.parkingUnlocked) {
                    if (save.totalCoins >= PARKING_UNLOCK_COST) {
                        save.totalCoins -= PARKING_UNLOCK_COST;
                        save.parkingUnlocked = true;
                        persistSave();
                        playBuy();
                        menuMsg = "🅿 Parking unlocked!"; menuMsgTimer = 2;
                    } else {
                        playDeny();
                        menuMsg = "Need 💰" + PARKING_UNLOCK_COST + " to unlock parking";
                        menuMsgTimer = 2;
                    }
                    return;
                }
                resetGame();
                startParkingChallenge();
                playClick(); return;
            }
            // SHOP button
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.50 + 130, 220, 54)) {
                state = "shop"; shopTab = "skins"; playClick(); return;
            }
            // Distracted mode toggle (if unlocked)
            if (save.distractedUnlocked &&
                pointInRect(click.x, click.y, W / 2 - 110, H * 0.50 + 192, 220, 44)) {
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
            // Back to character select (top-left)
            if (pointInRect(click.x, click.y, 10, 14, 80, 44)) {
                gotoState("charSelect"); playClick(); return;
            }
            // Default: any click in upper area starts game
            if (click.y > H * 0.3 && click.y < H * 0.45) {
                resetGame(); state = "playing"; playClick(); return;
            }
        }
        if (consumeAction()) {
            resetGame(); state = "playing";
        }
    }

    // ── Update: Shop ─────────────────────────────────────────
    function updateShop(dt) {
        menuBounce += dt;
        if (lastBoughtTimer > 0) lastBoughtTimer -= dt;

        if (consumePause()) { state = "menu"; playClick(); return; }
        var click = consumeClick();
        if (!click) return;

        // Back button
        if (pointInRect(click.x, click.y, 16, 14, 80, 44)) {
            state = "menu"; playClick(); return;
        }

        // Tabs
        var tabY = 100, tabH = 44, tabW = W / 3;
        if (pointInRect(click.x, click.y, 0, tabY, tabW, tabH)) { shopTab = "skins"; playClick(); return; }
        if (pointInRect(click.x, click.y, tabW, tabY, tabW, tabH)) { shopTab = "powerups"; playClick(); return; }
        if (pointInRect(click.x, click.y, tabW * 2, tabY, tabW, tabH)) { shopTab = "special"; playClick(); return; }

        // Items
        if (shopTab === "skins") {
            var skinKeys = Object.keys(SKINS);
            for (var i = 0; i < skinKeys.length; i++) {
                var col = i % 2, row = Math.floor(i / 2);
                var cx = 20 + col * 230, cy = 165 + row * 145;
                if (pointInRect(click.x, click.y, cx, cy, 210, 130)) {
                    var key = skinKeys[i];
                    var skin = SKINS[key];
                    if (save.ownedSkins.indexOf(key) >= 0) {
                        save.selectedSkin = key; persistSave(); playBuy();
                        lastBoughtMessage = skin.name + " equipped!";
                        lastBoughtTimer = 1.5;
                    } else if (save.totalCoins >= skin.price) {
                        save.totalCoins -= skin.price;
                        save.ownedSkins.push(key);
                        save.selectedSkin = key;
                        persistSave(); playBuy();
                        lastBoughtMessage = skin.name + " purchased!";
                        lastBoughtTimer = 1.5;
                    } else {
                        playDeny();
                        lastBoughtMessage = "Not enough coins!";
                        lastBoughtTimer = 1.2;
                    }
                    return;
                }
            }
        } else if (shopTab === "powerups") {
            // Missile card
            if (pointInRect(click.x, click.y, 40, 170, W - 80, 130)) {
                if (save.totalCoins >= 20) {
                    save.totalCoins -= 20; save.missiles++;
                    persistSave(); playBuy();
                    lastBoughtMessage = "+1 Missile!"; lastBoughtTimer = 1.2;
                } else { playDeny(); lastBoughtMessage = "Not enough coins!"; lastBoughtTimer = 1.2; }
                return;
            }
            // Mega pack (5 missiles)
            if (pointInRect(click.x, click.y, 40, 320, W - 80, 130)) {
                if (save.totalCoins >= 80) {
                    save.totalCoins -= 80; save.missiles += 5;
                    persistSave(); playBuy();
                    lastBoughtMessage = "+5 Missiles!"; lastBoughtTimer = 1.2;
                } else { playDeny(); lastBoughtMessage = "Not enough coins!"; lastBoughtTimer = 1.2; }
                return;
            }
        } else if (shopTab === "special") {
            // Distracted mode
            if (pointInRect(click.x, click.y, 40, 170, W - 80, 170)) {
                if (save.distractedUnlocked) {
                    lastBoughtMessage = "Already unlocked! Toggle in menu.";
                    lastBoughtTimer = 1.5;
                    playClick();
                } else if (save.totalCoins >= 1000) {
                    save.totalCoins -= 1000;
                    save.distractedUnlocked = true;
                    persistSave(); playBuy();
                    lastBoughtMessage = "Distracted Mode UNLOCKED!";
                    lastBoughtTimer = 2;
                } else { playDeny(); lastBoughtMessage = "Need 1000 coins!"; lastBoughtTimer = 1.2; }
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
            ctx.fillStyle = open ? "#66BB6A" : "#E53935";
            ctx.beginPath(); ctx.arc(lx - 26, y - 22, 3, 0, Math.PI * 2); ctx.fill();      // light
            if (open) {
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
        ctx.save();
        if (shakeTimer > 0) {
            ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        }

        drawRoad(scrollOffset);

        // Billboards (drawn first, behind trees)
        for (var bi = 0; bi < billboards.length; bi++) {
            drawBillboard(billboards[bi].x, billboards[bi].y, billboards[bi].side, billboards[bi].msg);
        }

        drawDecorations(gameTime);
        drawCityBuildings();

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

        for (var i = 0; i < obstacles.length; i++) {
            if (obstacles[i].type === "puddle") drawPuddle(obstacles[i].x, obstacles[i].y);
            else if (obstacles[i].type === "pool") drawHeshyPool(obstacles[i].x, obstacles[i].y, gameTime);
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
            if (o.type === "car" && o.behavior === "ambulance") {
                drawAmbulance(o.x, o.y, gameTime);
            } else if (o.type === "car") {
                drawEnemyCar(o.x, o.y, o.color, o.carType);
                if (o.behavior === "drunk") {
                    // weaving + a beer can by the window
                    drawText("🍺", o.x + 14, o.y - 4, "13px Arial", "#fff", null, 0);
                } else if (o.behavior === "texting") {
                    // glowing phone in the window
                    ctx.save();
                    ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(gameTime * 7));
                    drawText("📱", o.x + 12, o.y, "12px Arial", "#fff", null, 0);
                    ctx.restore();
                }
            }
            else if (o.type === "ped") drawPedestrian(o.x, o.y, o.walkTime, o.pedType);
        }

        // Missiles
        for (var mm = 0; mm < missiles.length; mm++) {
            drawMissile(missiles[mm].x, missiles[mm].y, missiles[mm].time);
        }

        // Toll booth (drawn over the road, behind the car)
        if (tollBooth) drawTollBooth(tollBooth);

        // Nitro flame trail (under the car)
        if (state !== "crash") drawNitroFlame(gameTime);

        // Player (or crashed car if state === crash)
        if (state === "crash") {
            drawLuluCar(crashX, crashY, crashRot, false, gameTime, distractedMode);
        } else {
            drawLuluCar(player.x, player.y, player.tilt, invincibleTimer > 0, gameTime, distractedMode);
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
    }

    // ── Draw: Crash ──────────────────────────────────────────
    function drawCrash() {
        drawPlaying();
        // Layer the angry man + speech bubble + revenge car on top
        if (!angryMan) return;
        ctx.save();
        if (shakeTimer > 0) {
            ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        }
        // Revenge car (if active) — drawn before the man if behind, after if hit
        if (revengeCar && angryMan.state !== "hit") {
            drawEnemyCar(revengeCar.x, revengeCar.y, revengeCar.color, revengeCar.carType);
        }
        if (angryMan.state !== "hit") {
            drawAngryMan(angryMan.x, angryMan.y, angryMan.time, angryMan.state, angryMan.runDir);
            if (angryMan.state === "yelling") {
                drawSpeechBubble(angryMan.x, angryMan.y - 30, angryYell, angryMan.time);
            }
        }
        if (revengeCar && angryMan.state === "hit") {
            drawEnemyCar(revengeCar.x, revengeCar.y, revengeCar.color, revengeCar.carType);
        }
        ctx.restore();
    }

    // ── Draw: Parking Intro/Outro (zoom transition) ──────────
    function drawParkingIntro() {
        var t = 1 - parkingTransitionTimer / parkingTransitionDuration;
        if (t < 0.5) {
            ctx.save();
            var zoom = 1 + t * 2;
            // Center of zoom: in challenge mode, just zoom on middle of screen (no main game)
            var cx = parkingChallengeMode ? W / 2 : (player ? player.x : W / 2);
            var cy = parkingChallengeMode ? H / 2 : (player ? player.y : H / 2);
            ctx.translate(W / 2, H / 2);
            ctx.scale(zoom, zoom);
            ctx.translate(-cx, -cy);
            if (parkingChallengeMode) {
                // Show the parking scene already (since there's no main game to zoom from)
                drawParkingFull(gameTime);
            } else {
                drawPlaying();
            }
            ctx.restore();
            ctx.fillStyle = "rgba(255,255,255," + (t * 2 * 0.9) + ")";
            ctx.fillRect(0, 0, W, H);
        } else {
            var t2 = (t - 0.5) * 2;
            var zoom2 = 2 - t2;
            var cx2 = parkingCar ? parkingCar.x : W / 2;
            var cy2 = parkingCar ? parkingCar.y : H / 2;
            ctx.save();
            ctx.translate(W / 2, H / 2);
            ctx.scale(zoom2, zoom2);
            ctx.translate(-cx2, -cy2);
            drawParkingFull(gameTime);
            ctx.restore();
            ctx.fillStyle = "rgba(255,255,255," + ((1 - t2) * 0.9) + ")";
            ctx.fillRect(0, 0, W, H);
        }
        drawParkingLevelIntro();
    }

    // ── Draw: Parking gameplay ───────────────────────────────
    function drawParkingFull(time) {
        drawParkingScene(time);

        // Parked cars
        for (var p = 0; p < parkedCars.length; p++) {
            drawParkedCar(parkedCars[p]);
        }
        // Cone obstacles in the parking spot
        for (var e = 0; e < parkingExtras.length; e++) {
            var ext = parkingExtras[e];
            if (ext.type === "cone") drawCone(ext.x, ext.y);
        }
        // Pedestrian on sidewalk
        if (parkingPedestrian) {
            drawPedestrian(parkingPedestrian.x, parkingPedestrian.y,
                parkingPedestrian.walkTime, parkingPedestrian.pedType);
        }
        // Lulu's car
        if (parkingCar) drawLuluCarFull(parkingCar, time, false);
        // Cameras (drawn on top)
        for (var c = 0; c < parkingCameras.length; c++) {
            drawSecurityCamera(parkingCameras[c], time);
        }

        // Night-mode dim overlay (subtle) + headlight cone in front of Lulu
        var theme = (parkingLevelConfig && parkingLevelConfig.theme) || "day";
        if (theme === "night") {
            ctx.fillStyle = "rgba(0, 8, 40, 0.35)";
            ctx.fillRect(0, 140, W, H - 140);
            if (parkingCar) {
                // Headlight beams in front of car
                ctx.save();
                ctx.translate(parkingCar.x, parkingCar.y);
                ctx.rotate(parkingCar.rot);
                ctx.fillStyle = "rgba(255,247,180,0.18)";
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(80, -30);
                ctx.lineTo(80, 30);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        } else if (theme === "dusk") {
            ctx.fillStyle = "rgba(255, 87, 34, 0.10)";
            ctx.fillRect(0, 0, W, H);
        }

        drawParticles();
    }

    function drawParking() {
        ctx.save();
        if (shakeTimer > 0) {
            ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        }
        drawParkingFull(gameTime);
        ctx.restore();

        // Flash overlay on collision
        if (parkingFlashTimer > 0) {
            ctx.fillStyle = "rgba(244,67,54," + (parkingFlashTimer / 0.2 * 0.35) + ")";
            ctx.fillRect(0, 0, W, H);
        }

        // Low-time panic vignette — pulsing red edges when under 10s so the
        // time pressure is felt, not just read off the clock.
        if (parkingTimeLeft <= 10 && parkingTimeLeft > 0) {
            var urgency = (10 - parkingTimeLeft) / 10;           // 0→1 as time runs out
            var beat = 0.5 + 0.5 * Math.sin(gameTime * (6 + urgency * 8));
            var vAlpha = (0.12 + urgency * 0.28) * beat;
            var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.62);
            vg.addColorStop(0, "rgba(244,67,54,0)");
            vg.addColorStop(1, "rgba(244,67,54," + vAlpha.toFixed(3) + ")");
            ctx.fillStyle = vg;
            ctx.fillRect(0, 0, W, H);
        }

        // HUD top bar
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        roundRect(0, 0, W, 50, 0); ctx.fill();
        // Timer goes red and grows a touch when the clock is low.
        var lowTime = parkingTimeLeft <= 10;
        var timeCol = lowTime ? (Math.sin(gameTime * 12) > 0 ? "#FF5252" : "#FFEB3B") : "#FFF";
        if (parkingChallengeMode) {
            drawText("LVL " + parkingLevel + " · " + (parkingLevelIntroText.split("· ")[1] || ""),
                W / 2, 18, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);
            drawText("⏱ " + Math.ceil(parkingTimeLeft) + "s", W - 14, 18,
                "bold " + (lowTime ? 17 : 15) + "px 'Segoe UI', Arial, sans-serif", timeCol, "#000", 3, "right");
            // lives = small heart icons + count
            drawText("♥ " + parkingChallengeLives, 14, 18, "bold 14px 'Segoe UI', Arial, sans-serif", "#FF80AB", "#000", 2, "left");
            drawText("★ " + parkingChallengeStars, 14, 36, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 2, "left");
            drawText("$" + parkingChallengeCoins, W - 14, 36, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 2, "right");
        } else {
            drawText("PARALLEL PARKING", W / 2, 18, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);
            drawText("⏱ " + Math.ceil(parkingTimeLeft) + "s", W - 30, 18,
                "bold " + (lowTime ? 18 : 16) + "px 'Segoe UI', Arial, sans-serif", timeCol, "#000", 3, "right");
            drawText("♥ " + lives, 30, 18, "bold 14px 'Segoe UI', Arial, sans-serif", "#FF80AB", "#000", 2, "left");
        }

        if (parkingCar && carIsInZone(parkingCar)) {
            var pulse = 1 + Math.sin(gameTime * 8) * 0.1;
            ctx.save();
            ctx.translate(W / 2, H - 60);
            ctx.scale(pulse, pulse);
            drawText("HOLD STILL TO PARK!", 0, 0,
                "bold 22px 'Segoe UI', Arial, sans-serif", "#4CAF50", "#000", 5);
            ctx.restore();
        } else {
            drawText("Park between the two cars · ←→ steer · ↑↓ move",
                W / 2, H - 30, "13px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2);
        }

        // Pause button
        drawIconButton(PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, "❚❚",
            { bg: "#FFFFFF", bgDark: "#BDBDBD" });

        // Parking-mode D-pad buttons — touch only; desktop uses arrow keys.
        if (isTouchDevice) {
            // Left thumb: steering
            drawIconButton(PARK_LEFT_RECT.x, PARK_LEFT_RECT.y, PARK_LEFT_RECT.w,
                "◀", { bg: keys.left ? "#FFEB3B" : "#FFFFFF", bgDark: "#90A4AE" });
            drawIconButton(PARK_RIGHT_RECT.x, PARK_RIGHT_RECT.y, PARK_RIGHT_RECT.w,
                "▶", { bg: keys.right ? "#FFEB3B" : "#FFFFFF", bgDark: "#90A4AE" });
            // Right thumb: forward / reverse
            drawIconButton(PARK_FWD_RECT.x, PARK_FWD_RECT.y, PARK_FWD_RECT.w,
                "▲", { bg: keys.up ? "#FFEB3B" : "#A5D6A7", bgDark: "#2E7D32" });
            drawIconButton(PARK_REV_RECT.x, PARK_REV_RECT.y, PARK_REV_RECT.w,
                "▼", { bg: keys.down ? "#FFEB3B" : "#EF9A9A", bgDark: "#B71C1C" });
            // Labels under buttons
            drawText("STEER", PARK_LEFT_RECT.x + 58, PARK_LEFT_RECT.y + 70, "bold 10px Arial", "#FFF", "#000", 2);
            drawText("DRIVE", PARK_FWD_RECT.x + 58, PARK_FWD_RECT.y + 70, "bold 10px Arial", "#FFF", "#000", 2);
        }
    }

    // ── Draw: Parking Result ────────────────────────────────
    function drawParkingResult() {
        ctx.save();
        if (shakeTimer > 0) {
            ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        }

        drawParkingScene(gameTime);
        for (var p = 0; p < parkedCars.length; p++) drawParkedCar(parkedCars[p]);
        if (parkingResult === "fail") {
            drawLuluCarFull(parkingCar, gameTime, true); // crying
        } else {
            drawLuluCarFull(parkingCar, gameTime, false);
        }
        for (var c = 0; c < parkingCameras.length; c++) {
            drawSecurityCamera(parkingCameras[c], gameTime);
        }
        drawParticles();

        ctx.restore();

        // Result overlay
        if (parkingResult === "success") {
            // Confetti particles
            if (Math.random() > 0.5) {
                particles.push({
                    x: rand(0, W), y: -10,
                    vx: rand(-30, 30), vy: rand(60, 140),
                    life: 1.5, maxLife: 1.5,
                    size: rand(3, 6),
                    color: randPick(["#FF80AB", "#FFD700", "#4FC3F7", "#81C784", "#FFB74D"]),
                    gravity: 30
                });
            }
            ctx.fillStyle = "rgba(76, 175, 80, 0.25)";
            ctx.fillRect(0, 0, W, H);
            var bounce = 1 + Math.sin(gameTime * 6) * 0.08;
            ctx.save();
            ctx.translate(W / 2, H * 0.25);
            ctx.scale(bounce, bounce);
            drawText("PARKED! 🎉", 0, 0, "bold 42px 'Segoe UI', Arial, sans-serif", "#FFEB3B", "#0D47A1", 7);
            drawText("ICE CREAM TIME!", 0, 38, "bold 22px 'Segoe UI', Arial, sans-serif", "#FFF", "#0D47A1", 5);
            drawText("+50 coins · +500 score", 0, 68, "bold 14px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3);
            ctx.restore();

            // Speech bubble from car: "Yay ice cream!"
            if (parkingCar) {
                drawSpeechBubble(parkingCar.x, parkingCar.y - 50, "YAY ICE CREAM!", gameTime);
            }
        } else if (parkingResult === "fail") {
            ctx.fillStyle = "rgba(0,0,0,0.45)";
            ctx.fillRect(0, 0, W, H);
            drawText("CRASH!", W / 2, H * 0.18, "bold 40px 'Segoe UI', Arial, sans-serif", "#F44336", "#000", 7);
            var msg = parkingFailHit && parkingFailHit.who === "timeout" ? "Out of time!" : "You dinged the other car!";
            drawText(msg, W / 2, H * 0.24, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
            drawText("-1 ♥", W / 2, H * 0.30, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFCDD2", "#000", 3);

            // Draw angry man on the road below Lulu's car
            if (parkingCar) {
                var t = parkingResultTimer < 3 ? 3 - parkingResultTimer : 0;
                var manX = parkingCar.x - 30 + t * 5; // walking up
                var manY = parkingCar.y + 50;
                drawAngryMan(Math.min(manX, parkingCar.x - 15), manY, t, "yelling", 1);
                drawSpeechBubble(parkingCar.x - 20, manY - 30, "WHO TAUGHT YOU\nTO DRIVE!?", t);
            }

            // Crying tears falling from car
            if (parkingCar && Math.random() > 0.6) {
                particles.push({
                    x: parkingCar.x + rand(-8, 8),
                    y: parkingCar.y - 20,
                    vx: rand(-10, 10), vy: rand(40, 80),
                    life: 0.6, maxLife: 0.6,
                    size: rand(2, 4),
                    color: "#4FC3F7",
                    gravity: 80
                });
            }
        }

        // Star rating overlay
        if (parkingResult === "success" && parkingResultTimer < 2.5) {
            var stars = calcStars();
            var fadeIn = clamp((2.5 - parkingResultTimer) * 2, 0, 1);
            ctx.globalAlpha = fadeIn;
            for (var si = 0; si < 3; si++) {
                var sx = W / 2 + (si - 1) * 48;
                var sy = H * 0.42;
                var lit = si < stars;
                drawText(lit ? "★" : "☆", sx, sy,
                    "bold 50px Arial", lit ? "#FFD700" : "#9E9E9E", "#000", 5);
            }
            ctx.globalAlpha = 1;
        }
    }

    // ── Draw: Parking Level Intro (overlay during zoom-in) ────
    function drawParkingLevelIntro() {
        if (!parkingChallengeMode || !parkingLevelIntroText) return;
        var t = 1 - parkingTransitionTimer / parkingTransitionDuration;
        if (t > 0.5) {
            var alpha = clamp((t - 0.5) * 2, 0, 1);
            ctx.fillStyle = "rgba(0,0,0," + (alpha * 0.5) + ")";
            ctx.fillRect(0, H / 2 - 60, W, 120);
            ctx.globalAlpha = alpha;
            drawText(parkingLevelIntroText, W / 2, H / 2 - 10,
                "bold 28px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 6);
            var cfg = parkingLevelConfig;
            if (cfg) {
                var details = cfg.numCameras + " 📹 · " + Math.floor(cfg.timeLimit) + "s · " +
                              cfg.theme.toUpperCase();
                if (cfg.coneInSpot) details += " · 🚧";
                if (cfg.pedestrian) details += " · 🚶";
                drawText(details, W / 2, H / 2 + 24,
                    "bold 14px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
            }
            ctx.globalAlpha = 1;
        }
    }

    // ── Draw: Parking End-of-Run Screen ───────────────────────
    function drawParkingEnd() {
        // Background: dark gradient
        ctx.fillStyle = "#0D47A1";
        ctx.fillRect(0, 0, W, H);
        // Confetti
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        for (var c = 0; c < 30; c++) {
            var cx = (c * 47 + 13) % W;
            var cy = (c * 31 + 7 + gameTime * 20) % H;
            ctx.fillRect(cx, cy, 3, 3);
        }

        var stats = parkingEndStats || { level: 1, stars: 0, coins: 0, victory: false };

        if (stats.victory) {
            drawText("🏆 MASTER PARKER!", W / 2, H * 0.12, "bold 32px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 6);
            drawText("You beat ALL 10 levels!", W / 2, H * 0.18, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
        } else {
            drawText("PARKING OVER", W / 2, H * 0.12, "bold 32px 'Segoe UI', Arial, sans-serif", "#F44336", "#000", 6);
            drawText("You reached Level " + stats.level, W / 2, H * 0.18, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
        }

        // Big stats box
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        roundRect(40, H * 0.27, W - 80, 200, 14); ctx.fill();
        ctx.strokeStyle = "#42A5F5";
        ctx.lineWidth = 3;
        roundRect(40, H * 0.27, W - 80, 200, 14); ctx.stroke();

        drawText("THIS RUN", W / 2, H * 0.30, "bold 14px 'Segoe UI', Arial, sans-serif", "#90CAF9", "#000", 2);
        drawText("Level reached: " + stats.level, W / 2, H * 0.34, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
        drawText("Stars earned: ★ " + stats.stars, W / 2, H * 0.39, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3);
        drawText("Coins earned: $ " + stats.coins, W / 2, H * 0.44, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFEB3B", "#000", 3);

        drawText("ALL-TIME", W / 2, H * 0.50, "bold 14px 'Segoe UI', Arial, sans-serif", "#90CAF9", "#000", 2);
        drawText("Best level: " + save.parkingBestLevel, W / 2, H * 0.54, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
        drawText("Total stars: ★ " + save.parkingTotalStars, W / 2, H * 0.58, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3);
        drawText("Perfect parks: " + save.parkingPerfectRuns, W / 2, H * 0.62, "bold 16px 'Segoe UI', Arial, sans-serif", "#90CAF9", "#000", 3);

        // Buttons
        drawButton(W / 2 - 110, H * 0.74, 220, 56, "🅿 PLAY AGAIN", { bg: "#42A5F5", bgDark: "#0D47A1" });
        drawButton(W / 2 - 110, H * 0.83, 220, 50, "MAIN MENU", { bg: "#90A4AE", bgDark: "#455A64", small: true });
    }

    function updateParkingEnd(dt) {
        var click = consumeClick();
        if (!click) {
            if (consumeAction()) {
                startParkingChallenge();
            }
            return;
        }
        // Play Again
        if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.74, 220, 56)) {
            startParkingChallenge();
            playClick();
            return;
        }
        // Main Menu
        if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.83, 220, 50)) {
            parkingChallengeMode = false;
            state = "menu";
            playClick();
            return;
        }
    }

    // ── Draw: Paused ─────────────────────────────────────────
    function drawPaused() {
        // Draw whatever scene we paused from as the backdrop.
        if (prevState === "parking") drawParking();
        else if (prevState === "cookieCatch") drawCookieCatch();
        else drawPlaying();
        // overlay
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, W, H);
        drawText("PAUSED", W / 2, H / 2 - 130, "bold 60px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 6);

        // Resume button
        drawButton(W / 2 - 110, H / 2 - 55, 220, 56, "▶ RESUME", { bg: "#66BB6A", bgDark: "#2E7D32" });
        // Music toggle button
        var musicLabel = musicMuted ? "♪ MUSIC: OFF" : "♪ MUSIC: ON";
        var mc1 = musicMuted ? "#9E9E9E" : "#42A5F5";
        var mc2 = musicMuted ? "#616161" : "#0D47A1";
        drawButton(W / 2 - 110, H / 2 + 13, 220, 52, musicLabel, { bg: mc1, bgDark: mc2, small: true });
        // SFX toggle button
        var sfxLabel = audioMuted ? "🔇 SOUND: OFF" : "🔊 SOUND: ON";
        var sc1 = audioMuted ? "#9E9E9E" : "#FFC107";
        var sc2 = audioMuted ? "#616161" : "#FF6F00";
        drawButton(W / 2 - 110, H / 2 + 75, 220, 52, sfxLabel, { bg: sc1, bgDark: sc2, small: true });
        // Quit button
        drawButton(W / 2 - 110, H / 2 + 137, 220, 52, "QUIT TO MENU", { bg: "#EF5350", bgDark: "#B71C1C", small: true });

        drawText(isTouchDevice ? "Tap RESUME to keep playing" : "Press P or ESC to resume",
            W / 2, H / 2 + 210, "14px 'Segoe UI', Arial, sans-serif", "#DDD", "#000", 2);
    }

    // ── Draw: Game Over ──────────────────────────────────────
    function drawGameOver() {
        drawPlaying();
        ctx.fillStyle = "rgba(0,0,0," + (gameOverAlpha * 0.65) + ")";
        ctx.fillRect(0, 0, W, H);

        if (gameOverAlpha > 0.3) {
            var a = Math.min((gameOverAlpha - 0.3) / 0.4, 1);
            ctx.globalAlpha = a;

            var goShake = Math.sin(gameTime * 12) * (1 - a) * 5;
            drawText("GAME OVER", W / 2 + goShake, H * 0.22,
                "bold 52px 'Segoe UI', Arial, sans-serif", "#F44336", "#333", 6);

            drawText("SCORE", W / 2, H * 0.33,
                "bold 18px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#333", 3);
            drawText(formatNum(Math.floor(score)), W / 2, H * 0.40,
                "bold 40px 'Segoe UI', Arial, sans-serif", "#FFF", "#333", 5);

            drawText("★ " + runCoins + " coins this run", W / 2, H * 0.47,
                "bold 18px 'Segoe UI', Arial, sans-serif", C.coin, "#333", 3);
            drawText("Total bank: " + formatNum(save.totalCoins), W / 2, H * 0.52,
                "bold 14px 'Segoe UI', Arial, sans-serif", "#FFE082", "#333", 2);

            if (Math.floor(score) >= save.highScore && save.highScore > 0) {
                var pulse = 0.9 + Math.sin(gameTime * 6) * 0.1;
                ctx.save();
                ctx.translate(W / 2, H * 0.61);
                ctx.scale(pulse, pulse);
                drawText("★ NEW HIGH SCORE! ★", 0, 0,
                    "bold 22px 'Segoe UI', Arial, sans-serif", "#FFD700", "#333", 4);
                ctx.restore();
            } else if (save.highScore > 0) {
                drawText("Best: " + formatNum(save.highScore), W / 2, H * 0.61,
                    "bold 16px 'Segoe UI', Arial, sans-serif", "#AAA", "#333", 3);
            }

            // Rewarded ad: opt-in "watch for coins". Only renders in the native
            // app once an ad is loaded (Ads.rewardedAvailable() is false on web).
            if (Ads.rewardedAvailable()) {
                drawButton(W / 2 - 130, H * 0.70 - 26, 260, 52, "📺  WATCH → +50 ★",
                    { bg: "#FFB300", bgDark: "#EF6C00" });
            }

            // Buttons
            drawButton(W / 2 - 110, H * 0.78 - 30, 220, 60, "RESTART", { bg: "#66BB6A", bgDark: "#2E7D32" });
            drawButton(W / 2 - 110, H * 0.88 - 25, 220, 50, "MAIN MENU", { bg: "#5C6BC0", bgDark: "#283593", small: true });

            ctx.globalAlpha = 1;
        }
    }

    // ── Draw: Menu ───────────────────────────────────────────
    function drawMenu() {
        ctx.fillStyle = C.grass1;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = C.grass2;
        for (var gy = ((menuBounce * 30) % 40) - 40; gy < H; gy += 40) {
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
        ctx.lineWidth = 2;
        ctx.setLineDash([28, 22]);
        ctx.lineDashOffset = -(menuBounce * 80 % 50);
        for (var l = 1; l < 3; l++) {
            ctx.beginPath();
            ctx.moveTo(ROAD_L + l * LANE_W, 0);
            ctx.lineTo(ROAD_L + l * LANE_W, H);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.strokeStyle = C.roadLine;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ROAD_L + 2, 0); ctx.lineTo(ROAD_L + 2, H);
        ctx.moveTo(ROAD_R - 2, 0); ctx.lineTo(ROAD_R - 2, H);
        ctx.stroke();

        drawDecorations(menuBounce);

        // Floating coins
        for (var ci = 0; ci < 4; ci++) {
            var cx = 50 + ci * 130;
            var cy = H * 0.92 + Math.sin(menuBounce * 2 + ci * 1.2) * 10;
            drawCoin(cx, cy, menuBounce + ci);
        }

        // Title
        var titleY = H * 0.13 + Math.sin(menuBounce * 2) * 5;
        drawText("LULU'S", W / 2, titleY - 22,
            "bold 56px 'Segoe UI', Arial, sans-serif", SKINS[save.selectedSkin].body, "#333", 7);
        drawText("ROAD TRIP", W / 2, titleY + 28,
            "bold 44px 'Segoe UI', Arial, sans-serif", "#FFF", "#333", 6);

        // Car
        var carY = H * 0.36 + Math.sin(menuBounce * 3) * 8;
        drawLuluCar(W / 2, carY, Math.sin(menuBounce * 2) * 0.05, false, menuBounce, distractedMode);

        // Coin balance top-right
        drawCoin(W - 100, 36, menuBounce);
        drawText(formatNum(save.totalCoins), W - 85, 38, "bold 22px 'Segoe UI', Arial, sans-serif", C.coin, "#000", 4, "left");

        // Mute button
        drawIconButton(W - 60, 14, 44, audioMuted ? "🔇" : "🔊", { bg: "#FFFFFF", bgDark: "#BDBDBD" });
        // Back to character select
        drawBackButton(10, 14);

        // PLAY button
        drawButton(W / 2 - 110, H * 0.50, 220, 60, "▶ PLAY", { bg: "#66BB6A", bgDark: "#2E7D32" });
        // PARKING CHALLENGE button — shows a coin lock until purchased.
        drawButton(W / 2 - 110, H * 0.50 + 68, 220, 54,
            save.parkingUnlocked ? "🅿 PARKING" : "🔒 PARKING 💰" + PARKING_UNLOCK_COST,
            { bg: "#42A5F5", bgDark: "#0D47A1" });
        // SHOP button
        drawButton(W / 2 - 110, H * 0.50 + 130, 220, 54, "🛒 SHOP", { bg: "#FFC107", bgDark: "#FF6F00" });

        // Distracted mode toggle
        if (save.distractedUnlocked) {
            var label = "DISTRACTED: " + (distractedMode ? "ON" : "OFF");
            var c1 = distractedMode ? "#FF80AB" : "#9E9E9E";
            var c2 = distractedMode ? "#C2185B" : "#616161";
            drawButton(W / 2 - 110, H * 0.50 + 192, 220, 44, label, { bg: c1, bgDark: c2, small: true });
        }

        // High scores
        if (save.highScore > 0 || save.parkingBestLevel > 0) {
            var bestY = H * 0.82;
            drawText("Best Run: " + formatNum(save.highScore), W / 2, bestY,
                "bold 14px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#333", 3);
            if (save.parkingBestLevel > 0) {
                drawText("🅿 Best Level: " + save.parkingBestLevel + " · ★ " + save.parkingTotalStars,
                    W / 2, bestY + 22,
                    "bold 14px 'Segoe UI', Arial, sans-serif", "#90CAF9", "#333", 3);
            }
        }

        // Transient message banner (e.g. parking unlock / not enough coins)
        if (menuMsgTimer > 0) {
            var mAlpha = clamp(menuMsgTimer, 0, 1);
            ctx.globalAlpha = mAlpha;
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            roundRect(W / 2 - 150, H * 0.42, 300, 34, 10); ctx.fill();
            drawText(menuMsg, W / 2, H * 0.42 + 17, "bold 15px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3);
            ctx.globalAlpha = 1;
        }

        // Controls hint
        drawText("← → steer · ↑ boost · ↓ slow · M missile · P pause", W / 2, H * 0.97,
            "11px 'Segoe UI', Arial, sans-serif", "#DDD", "#333", 2);
    }

    // ── Draw: Shop ───────────────────────────────────────────
    function drawShop() {
        // bg
        ctx.fillStyle = "#37474F";
        ctx.fillRect(0, 0, W, H);
        // pattern
        ctx.fillStyle = "#455A64";
        for (var y = 0; y < H; y += 20) {
            for (var x = (y % 40 === 0 ? 0 : 10); x < W; x += 20) {
                ctx.fillRect(x, y, 10, 10);
            }
        }

        // Back button
        drawBackButton(16, 14);

        // Title
        drawText("SHOP", W / 2, 38, "bold 36px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 5);

        // Coin balance
        drawCoin(W - 100, 36, menuBounce);
        drawText(formatNum(save.totalCoins), W - 86, 38, "bold 22px 'Segoe UI', Arial, sans-serif", C.coin, "#000", 4, "left");

        // Tabs
        var tabY = 100, tabH = 44, tabW = W / 3;
        var tabs = [["skins", "Skins"], ["powerups", "Power-Ups"], ["special", "Special"]];
        for (var ti = 0; ti < 3; ti++) {
            var key = tabs[ti][0], lbl = tabs[ti][1];
            var active = shopTab === key;
            ctx.fillStyle = active ? "#FFC107" : "#546E7A";
            roundRect(ti * tabW + 2, tabY, tabW - 4, tabH, active ? 8 : 6); ctx.fill();
            drawText(lbl, ti * tabW + tabW / 2, tabY + tabH / 2,
                "bold 16px 'Segoe UI', Arial, sans-serif",
                active ? "#000" : "#ECEFF1", active ? null : null, 0);
        }

        // Content per tab
        if (shopTab === "skins") drawSkinsTab();
        else if (shopTab === "powerups") drawPowerupsTab();
        else if (shopTab === "special") drawSpecialTab();

        // Toast message
        if (lastBoughtTimer > 0) {
            var alp = clamp(lastBoughtTimer / 1.5, 0, 1);
            ctx.fillStyle = "rgba(0,0,0," + (0.8 * alp) + ")";
            roundRect(W / 2 - 160, H - 70, 320, 50, 10); ctx.fill();
            ctx.globalAlpha = alp;
            drawText(lastBoughtMessage, W / 2, H - 45, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3);
            ctx.globalAlpha = 1;
        }
    }

    function drawSkinsTab() {
        var skinKeys = Object.keys(SKINS);
        for (var i = 0; i < skinKeys.length; i++) {
            var col = i % 2, row = Math.floor(i / 2);
            var cx = 20 + col * 230, cy = 165 + row * 145;
            var key = skinKeys[i];
            var skin = SKINS[key];
            var owned = save.ownedSkins.indexOf(key) >= 0;
            var equipped = save.selectedSkin === key;
            var canAfford = save.totalCoins >= skin.price;

            // Card
            ctx.fillStyle = equipped ? "#FFC107" : (owned ? "#66BB6A" : "#546E7A");
            roundRect(cx, cy, 210, 130, 10); ctx.fill();
            ctx.fillStyle = equipped ? "#FFA000" : (owned ? "#388E3C" : "#37474F");
            roundRect(cx, cy, 210, 130, 10);
            ctx.lineWidth = 3; ctx.strokeStyle = "#000"; ctx.stroke();
            ctx.fillStyle = "#263238";
            roundRect(cx + 5, cy + 5, 200, 90, 6); ctx.fill();

            // Car preview
            ctx.save();
            ctx.translate(cx + 105, cy + 50);
            ctx.scale(0.85, 0.85);
            drawLuluCar(0, 0, 0, false, menuBounce, false, key, 1);
            ctx.restore();

            // Name
            drawText(skin.name, cx + 105, cy + 110, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2);
            // Status
            if (equipped) drawText("EQUIPPED", cx + 105, cy + 124, "bold 11px Arial", "#000", null, 0);
            else if (owned) drawText("Tap to equip", cx + 105, cy + 124, "bold 11px Arial", "#000", null, 0);
            else {
                var col2 = canAfford ? "#FFD700" : "#EF5350";
                drawText("★ " + skin.price, cx + 105, cy + 124, "bold 14px Arial", col2, "#000", 2);
            }
        }
    }

    function drawPowerupsTab() {
        // Missile single
        drawShopCard(40, 170, W - 80, 130, "🚀 Missile", "Destroy 1 car ahead", 20, "Buy +1", save.totalCoins >= 20);
        drawText("You own: " + save.missiles, W / 2, 295, "bold 14px Arial", "#FFD700", "#000", 2);
        // Missile pack
        drawShopCard(40, 320, W - 80, 130, "🚀×5 Mega Pack", "Save 20 coins!", 80, "Buy 5-Pack", save.totalCoins >= 80);
    }

    function drawSpecialTab() {
        drawShopCard(40, 170, W - 80, 170, "📱 Distracted Mode", "Lulu's on her phone! Reverse controls + 2× score.", 1000,
            save.distractedUnlocked ? "OWNED" : "Unlock", save.totalCoins >= 1000 && !save.distractedUnlocked, save.distractedUnlocked);
    }

    function drawShopCard(x, y, w, h, title, desc, price, btnLabel, canAfford, owned) {
        ctx.fillStyle = owned ? "#66BB6A" : "#546E7A";
        roundRect(x, y, w, h, 12); ctx.fill();
        ctx.fillStyle = owned ? "#388E3C" : "#37474F";
        ctx.lineWidth = 3; ctx.strokeStyle = "#000";
        roundRect(x, y, w, h, 12); ctx.stroke();

        drawText(title, x + w / 2, y + 30, "bold 24px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 4);
        drawText(desc, x + w / 2, y + 60, "14px 'Segoe UI', Arial, sans-serif", "#ECEFF1", "#000", 2);
        if (!owned) {
            drawText("★ " + price, x + w / 2, y + h - 35, "bold 22px Arial", canAfford ? "#FFD700" : "#EF5350", "#000", 3);
            drawText(canAfford ? btnLabel : "Need more coins", x + w / 2, y + h - 12, "bold 14px Arial", "#FFF", "#000", 2);
        } else {
            drawText("✓ " + btnLabel, x + w / 2, y + h - 20, "bold 22px Arial", "#FFF", "#000", 3);
        }
    }

    // ════════════════════════════════════════════════════════
    // ════════════════ DINA MODE & CHARACTER SELECT ══════════
    // ════════════════════════════════════════════════════════

    // ── Drawing: Lulu portrait (for character select card) ─
    function drawLuluPortrait(cx, cy, time, scale) {
        var s = scale || 1;
        var t = time || 0;
        var bob = Math.sin(t * 1.6) * 2;            // gentle idle bob
        var blink = (Math.sin(t * 1.1) > 0.97) ? 1 : 0; // occasional blink
        var hair = save.luluHair;
        var hairDk = shadeColor(hair, -22);
        var hairLt = shadeColor(hair, 30);

        ctx.save();
        ctx.translate(cx, cy + bob);
        ctx.scale(s, s);
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        // ── Pink car peeking behind, lower-left ──
        ctx.save();
        ctx.fillStyle = "#FF5FAE";
        roundRect(-114, 30, 96, 52, 14); ctx.fill();
        ctx.fillStyle = "#FF85C2"; // window shine
        roundRect(-104, 38, 78, 18, 8); ctx.fill();
        ctx.fillStyle = "#C9E9FF";
        roundRect(-100, 40, 70, 13, 6); ctx.fill();
        ctx.fillStyle = "#2A2A33";
        ctx.beginPath(); ctx.arc(-94, 78, 9, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-40, 78, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#5A5A66";
        ctx.beginPath(); ctx.arc(-94, 78, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-40, 78, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // ── Long flowing hair behind (soft, with darker rim) ──
        ctx.fillStyle = hairDk;
        ctx.beginPath();
        ctx.ellipse(0, 26, 54, 74, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.ellipse(0, 22, 49, 68, 0, 0, Math.PI * 2);
        ctx.fill();
        // flowing strand highlights
        ctx.strokeStyle = hairLt;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-34, -2); ctx.quadraticCurveTo(-44, 40, -30, 78);
        ctx.moveTo(34, -2); ctx.quadraticCurveTo(44, 40, 30, 78);
        ctx.stroke();

        // ── Neck ──
        ctx.fillStyle = shadeColor("#FFD9C0", -8);
        roundRect(-9, 16, 18, 22, 6); ctx.fill();

        // ── Face (soft rounded, warm peachy) ──
        ctx.fillStyle = "#FFD9C0";
        ctx.beginPath();
        ctx.ellipse(0, -8, 37, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        // soft shading on face edge
        ctx.fillStyle = "rgba(244,170,140,0.30)";
        ctx.beginPath();
        ctx.ellipse(24, -2, 13, 26, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // ── Hair front: center-parted soft swoop framing the face ──
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.moveTo(-37, -10);
        ctx.quadraticCurveTo(-44, -46, -6, -44);    // left swoop
        ctx.quadraticCurveTo(0, -46, 6, -44);
        ctx.quadraticCurveTo(44, -46, 37, -10);     // right swoop
        ctx.quadraticCurveTo(30, -30, 14, -34);     // right inner part
        ctx.quadraticCurveTo(8, -40, 0, -39);
        ctx.quadraticCurveTo(-8, -40, -14, -34);    // left inner part
        ctx.quadraticCurveTo(-30, -30, -37, -10);
        ctx.closePath();
        ctx.fill();
        // glossy highlight band on hair
        ctx.fillStyle = hairLt;
        ctx.beginPath();
        ctx.ellipse(-20, -34, 11, 4, -0.4, 0, Math.PI * 2);
        ctx.ellipse(20, -34, 11, 4, 0.4, 0, Math.PI * 2);
        ctx.fill();

        // ── Rosy cheeks ──
        ctx.fillStyle = "rgba(255,150,170,0.55)";
        ctx.beginPath();
        ctx.ellipse(-21, 2, 8, 5.5, 0, 0, Math.PI * 2);
        ctx.ellipse(21, 2, 8, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // ── Eyebrows ──
        ctx.strokeStyle = hairDk;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-19, -22); ctx.quadraticCurveTo(-12, -25, -5, -22);
        ctx.moveTo(19, -22); ctx.quadraticCurveTo(12, -25, 5, -22);
        ctx.stroke();

        // ── Eyes — big bright almond with sparkle ──
        if (blink) {
            ctx.strokeStyle = "#5D4037";
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(-13, -13, 6, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.arc(13, -13, 6, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();
        } else {
            // whites
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.ellipse(-13, -13, 6.5, 7.5, 0, 0, Math.PI * 2);
            ctx.ellipse(13, -13, 6.5, 7.5, 0, 0, Math.PI * 2);
            ctx.fill();
            // iris (warm brown)
            ctx.fillStyle = "#7A4A2B";
            ctx.beginPath();
            ctx.arc(-13, -12, 4.6, 0, Math.PI * 2);
            ctx.arc(13, -12, 4.6, 0, Math.PI * 2);
            ctx.fill();
            // pupil
            ctx.fillStyle = "#241208";
            ctx.beginPath();
            ctx.arc(-13, -12, 2.4, 0, Math.PI * 2);
            ctx.arc(13, -12, 2.4, 0, Math.PI * 2);
            ctx.fill();
            // big sparkle + small sparkle
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(-15, -15, 1.8, 0, Math.PI * 2);
            ctx.arc(11, -15, 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.75)";
            ctx.beginPath();
            ctx.arc(-11, -9, 1, 0, Math.PI * 2);
            ctx.arc(15, -9, 1, 0, Math.PI * 2);
            ctx.fill();
            // upper lash line
            ctx.strokeStyle = "#3E2723";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(-13, -13, 6.5, 1.05 * Math.PI, 1.55 * Math.PI);
            ctx.arc(13, -13, 6.5, 1.05 * Math.PI, 1.55 * Math.PI);
            ctx.stroke();
            // little lash flicks
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-19, -15); ctx.lineTo(-21, -17);
            ctx.moveTo(19, -15); ctx.lineTo(21, -17);
            ctx.stroke();
        }

        // ── Nose (tiny soft) ──
        ctx.fillStyle = "rgba(214,150,120,0.5)";
        ctx.beginPath(); ctx.ellipse(0, 2, 1.8, 2.2, 0, 0, Math.PI * 2); ctx.fill();

        // ── Freckles ──
        ctx.fillStyle = "rgba(180,110,80,0.7)";
        ctx.beginPath();
        ctx.arc(-7, 0, 0.8, 0, Math.PI * 2);
        ctx.arc(-3, 2, 0.7, 0, Math.PI * 2);
        ctx.arc(3, 2, 0.7, 0, Math.PI * 2);
        ctx.arc(7, 0, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // ── Warm friendly smile ──
        ctx.strokeStyle = "#C44E63";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(0, 6, 8, 0.12 * Math.PI, 0.88 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,140,160,0.45)"; // lower lip blush
        ctx.beginPath();
        ctx.ellipse(0, 11, 4, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // ── Trendy top (soft pink, modern crew neck) ──
        ctx.fillStyle = "#FF9CC4";
        roundRect(-37, 38, 74, 54, 16); ctx.fill();
        ctx.fillStyle = "#FFB6D5"; // shoulder highlight
        roundRect(-37, 38, 74, 16, 16); ctx.fill();
        // neckline
        ctx.fillStyle = shadeColor("#FFD9C0", -6);
        ctx.beginPath();
        ctx.ellipse(0, 40, 13, 7, 0, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = "#E97AAE";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 40, 13, 7, 0, 0.05 * Math.PI, 0.95 * Math.PI);
        ctx.stroke();

        // ── Dainty gold heart necklace ──
        ctx.strokeStyle = "#FFD24A";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 40, 18, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = "#FFCB2E";
        ctx.beginPath();
        ctx.arc(-1.8, 56, 1.6, 0, Math.PI * 2);
        ctx.arc(1.8, 56, 1.6, 0, Math.PI * 2);
        ctx.moveTo(-3.2, 56.5);
        ctx.lineTo(0, 60.5);
        ctx.lineTo(3.2, 56.5);
        ctx.fill();

        ctx.restore();
    }

    // ── Drawing: Dina portrait (for character select card) ─
    function drawDinaPortrait(cx, cy, time, scale) {
        var s = scale || 1;
        var t = time || 0;
        var bob = Math.sin(t * 2.0 + 1) * 2.4;          // bouncier kid bob
        var blink = (Math.sin(t * 1.3 + 2) > 0.97) ? 1 : 0;
        var sparkle = 0.6 + 0.4 * Math.sin(t * 3);      // twinkling cheek sparkle
        var HAIR = "#7A4A28", HAIR_DK = "#5E3819", HAIR_LT = "#9E6A40";

        ctx.save();
        ctx.translate(cx, cy + bob);
        ctx.scale(s, s);
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        // ── Long ponytail (right side, behind, bouncy) ──
        var pony = Math.sin(t * 2.2) * 3;
        ctx.fillStyle = HAIR_DK;
        ctx.beginPath();
        ctx.ellipse(46 + pony, 18, 15, 33, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = HAIR;
        ctx.beginPath();
        ctx.ellipse(44 + pony, 16, 12, 29, 0.3, 0, Math.PI * 2);
        ctx.fill();
        // pony shine
        ctx.strokeStyle = HAIR_LT;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(40, -4); ctx.quadraticCurveTo(50 + pony, 18, 44 + pony, 40);
        ctx.stroke();
        // Scrunchie at base of ponytail
        ctx.fillStyle = "#FF63A9";
        ctx.beginPath(); ctx.arc(38, -2, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FF8FC2";
        ctx.beginPath(); ctx.arc(36, -4, 2.4, 0, Math.PI * 2); ctx.fill();

        // ── Cozy hoodie (lavender, soft and rounded) ──
        ctx.fillStyle = "#B79CE6";
        ctx.beginPath();
        ctx.ellipse(0, 60, 44, 38, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        roundRect(-44, 58, 88, 40, 18); ctx.fill();
        // hoodie highlight
        ctx.fillStyle = "#CBB6F0";
        roundRect(-44, 46, 88, 18, 18); ctx.fill();
        // hood collar behind neck
        ctx.fillStyle = "#A487DC";
        ctx.beginPath();
        ctx.ellipse(0, 40, 30, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        // drawstrings
        ctx.strokeStyle = "#7E63C0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-7, 50); ctx.lineTo(-9, 66);
        ctx.moveTo(7, 50); ctx.lineTo(9, 66);
        ctx.stroke();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(-9, 67, 2.4, 0, Math.PI * 2);
        ctx.arc(9, 67, 2.4, 0, Math.PI * 2);
        ctx.fill();
        // little star on hoodie
        ctx.fillStyle = "#FFD93D";
        ctx.beginPath();
        for (var sp = 0; sp < 10; sp++) {
            var sang = -Math.PI / 2 + sp * Math.PI / 5;
            var srad = (sp % 2 === 0) ? 6 : 2.6;
            var spx = 16 + Math.cos(sang) * srad;
            var spy = 74 + Math.sin(sang) * srad;
            if (sp === 0) ctx.moveTo(spx, spy); else ctx.lineTo(spx, spy);
        }
        ctx.closePath();
        ctx.fill();

        // ── Neck ──
        ctx.fillStyle = shadeColor("#FFE2CE", -8);
        roundRect(-8, 18, 16, 20, 6); ctx.fill();

        // ── Face (round, chubby kid cheeks) ──
        ctx.fillStyle = "#FFE2CE";
        ctx.beginPath();
        ctx.ellipse(0, -2, 34, 35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(248,178,148,0.28)"; // soft chin shade
        ctx.beginPath();
        ctx.ellipse(0, 16, 18, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // ── Hair: rounded top + cute bangs ──
        ctx.fillStyle = HAIR;
        ctx.beginPath();
        ctx.ellipse(0, -22, 35, 30, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        // bangs: little rounded scallops across forehead
        ctx.beginPath();
        ctx.moveTo(-34, -20);
        ctx.quadraticCurveTo(-30, -2, -20, -14);
        ctx.quadraticCurveTo(-12, -2, -6, -14);
        ctx.quadraticCurveTo(0, 0, 6, -14);
        ctx.quadraticCurveTo(12, -2, 20, -14);
        ctx.quadraticCurveTo(30, -2, 34, -20);
        ctx.quadraticCurveTo(20, -40, 0, -41);
        ctx.quadraticCurveTo(-20, -40, -34, -20);
        ctx.closePath();
        ctx.fill();
        // hair shine
        ctx.fillStyle = HAIR_LT;
        ctx.beginPath();
        ctx.ellipse(-12, -30, 12, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        // side hair tucked by ears
        ctx.fillStyle = HAIR;
        ctx.beginPath();
        ctx.ellipse(-32, -2, 6, 14, 0.1, 0, Math.PI * 2);
        ctx.ellipse(32, -2, 6, 14, -0.1, 0, Math.PI * 2);
        ctx.fill();
        // cute pink bow on the side
        ctx.fillStyle = "#FF63A9";
        ctx.beginPath();
        ctx.moveTo(-26, -28);
        ctx.lineTo(-34, -33); ctx.lineTo(-34, -23); ctx.closePath();
        ctx.moveTo(-26, -28);
        ctx.lineTo(-18, -33); ctx.lineTo(-18, -23); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#C2185B";
        ctx.beginPath(); ctx.arc(-26, -28, 2.4, 0, Math.PI * 2); ctx.fill();

        // ── Big rosy round cheeks with sparkle ──
        ctx.fillStyle = "rgba(255,140,160,0.6)";
        ctx.beginPath();
        ctx.ellipse(-20, 6, 8, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(20, 6, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255," + (0.35 + 0.35 * sparkle) + ")";
        ctx.beginPath();
        ctx.arc(-22, 4, 1.4, 0, Math.PI * 2);
        ctx.arc(18, 4, 1.4, 0, Math.PI * 2);
        ctx.fill();

        // ── Eyebrows (small, friendly) ──
        ctx.strokeStyle = HAIR_DK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-16, -15); ctx.quadraticCurveTo(-11, -17, -6, -15);
        ctx.moveTo(16, -15); ctx.quadraticCurveTo(11, -17, 6, -15);
        ctx.stroke();

        // ── Eyes — big, round, super sparkly (kid style) ──
        if (blink) {
            ctx.strokeStyle = "#3D2817";
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.arc(-11, -6, 6, 0.12 * Math.PI, 0.88 * Math.PI);
            ctx.arc(11, -6, 6, 0.12 * Math.PI, 0.88 * Math.PI);
            ctx.stroke();
        } else {
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.ellipse(-11, -6, 6.5, 8, 0, 0, Math.PI * 2);
            ctx.ellipse(11, -6, 6.5, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            // big warm-brown iris
            ctx.fillStyle = "#8A5A30";
            ctx.beginPath();
            ctx.arc(-11, -5, 5.2, 0, Math.PI * 2);
            ctx.arc(11, -5, 5.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#2A150A";
            ctx.beginPath();
            ctx.arc(-11, -5, 2.8, 0, Math.PI * 2);
            ctx.arc(11, -5, 2.8, 0, Math.PI * 2);
            ctx.fill();
            // big shiny sparkles
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(-13, -8, 2.2, 0, Math.PI * 2);
            ctx.arc(9, -8, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            ctx.beginPath();
            ctx.arc(-9, -2, 1.2, 0, Math.PI * 2);
            ctx.arc(13, -2, 1.2, 0, Math.PI * 2);
            ctx.fill();
            // top lash line
            ctx.strokeStyle = "#3D2817";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(-11, -6, 6.5, 1.05 * Math.PI, 1.6 * Math.PI);
            ctx.arc(11, -6, 6.5, 1.05 * Math.PI, 1.6 * Math.PI);
            ctx.stroke();
        }

        // ── Tiny nose ──
        ctx.fillStyle = "rgba(220,150,120,0.55)";
        ctx.beginPath(); ctx.arc(0, 6, 1.8, 0, Math.PI * 2); ctx.fill();

        // ── BIG happy open grin with teeth ──
        ctx.fillStyle = "#B23A52";
        ctx.beginPath();
        ctx.ellipse(0, 13, 11, 9, 0, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF"; // teeth
        ctx.beginPath();
        ctx.moveTo(-10, 13);
        ctx.lineTo(10, 13);
        ctx.quadraticCurveTo(10, 17, 0, 17);
        ctx.quadraticCurveTo(-10, 17, -10, 13);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FF7B96"; // little tongue
        ctx.beginPath();
        ctx.ellipse(0, 20, 5, 3, 0, 0, Math.PI);
        ctx.fill();

        // ── Morgan the purple cat plushie held in arms (bottom-left) ──
        var mx = -45, my = 80;
        // Body
        ctx.fillStyle = "#9B8FB4";
        ctx.beginPath(); ctx.ellipse(mx, my + 8, 16, 12, 0, 0, Math.PI * 2); ctx.fill();
        // Head
        ctx.beginPath(); ctx.arc(mx, my - 6, 11, 0, Math.PI * 2); ctx.fill();
        // Ears
        ctx.beginPath();
        ctx.moveTo(mx - 9, my - 12); ctx.lineTo(mx - 4, my - 18); ctx.lineTo(mx - 1, my - 13);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(mx + 1, my - 13); ctx.lineTo(mx + 4, my - 18); ctx.lineTo(mx + 9, my - 12);
        ctx.closePath(); ctx.fill();
        // Inner ear pink
        ctx.fillStyle = "#FFB8D9";
        ctx.beginPath();
        ctx.moveTo(mx - 6, my - 14); ctx.lineTo(mx - 4, my - 16); ctx.lineTo(mx - 2, my - 13);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(mx + 2, my - 13); ctx.lineTo(mx + 4, my - 16); ctx.lineTo(mx + 6, my - 14);
        ctx.closePath(); ctx.fill();
        // Eyes (cute closed arcs)
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mx - 4, my - 6, 1.5, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.arc(mx + 4, my - 6, 1.5, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.stroke();
        // Nose
        ctx.fillStyle = "#FF8AAA";
        ctx.beginPath();
        ctx.moveTo(mx - 1.5, my - 3); ctx.lineTo(mx + 1.5, my - 3); ctx.lineTo(mx, my - 1);
        ctx.closePath(); ctx.fill();
        // Smile stitch
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(mx, my - 1); ctx.quadraticCurveTo(mx - 2, my + 1, mx - 3, my);
        ctx.moveTo(mx, my - 1); ctx.quadraticCurveTo(mx + 2, my + 1, mx + 3, my);
        ctx.stroke();
        // Pink heart on chest
        ctx.fillStyle = "#FF6B9D";
        ctx.beginPath();
        ctx.arc(mx - 2, my + 4, 1.5, 0, Math.PI * 2);
        ctx.arc(mx + 2, my + 4, 1.5, 0, Math.PI * 2);
        ctx.moveTo(mx - 3, my + 4);
        ctx.lineTo(mx, my + 8);
        ctx.lineTo(mx + 3, my + 4);
        ctx.fill();

        ctx.restore();
    }

    // ── Update / Draw: Character Select ──────────────────────
    function updateCharSelect(dt) {
        charSelectTime += dt;
        var click = consumeClick();
        if (click) {
            // Lulu card top half H*0.18 - H*0.50
            if (click.y > H * 0.18 && click.y < H * 0.50) {
                selectedChar = "lulu";
                gotoState("menu");
                playCharSelect();
                return;
            }
            // Dina card bottom half H*0.52 - H*0.88
            if (click.y > H * 0.52 && click.y < H * 0.88) {
                selectedChar = "dina";
                playCharSelect();
                // Enter dina mode at the fade midpoint (only if the fade actually started)
                gotoState("dinaBus", function () { startDinaMode(); });
                return;
            }
        }
        if (consumeAction()) {
            // default to Lulu if no click but space pressed
            selectedChar = "lulu";
            state = "menu";
        }
    }

    function drawCharSelect() {
        // Cohesive sky-to-grass gradient to match the rest of the game
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#A8E6CF");
        g.addColorStop(0.55, "#FFE3B0");
        g.addColorStop(1, "#7CB342");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        // Chunky dark band behind title for contrast
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        roundRect(W / 2 - 180, 40, 360, 50, 14); ctx.fill();
        // Confetti dots drifting
        ctx.globalAlpha = 0.7;
        for (var i = 0; i < 40; i++) {
            var x = (i * 47 + 13) % W;
            var y = ((i * 31 + 9) + charSelectTime * 20) % H;
            ctx.fillStyle = ["#FF4FA3", "#FFD93D", "#6BCBFF", "#A8E6CF", "#FFFFFF"][i % 5];
            ctx.beginPath();
            ctx.arc(x, y, 3 + (i % 3), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Header wobble
        var wob = Math.sin(charSelectTime * 3) * 4;
        drawText("Pick a Bruck Sister!", W / 2, 70 + wob, "bold 32px 'Segoe UI', Arial, sans-serif",
            "#FFFFFF", "#7A2A5C", 6);

        // Lulu Card
        drawCharCard(50, H * 0.18, 380, H * 0.32, "lulu",
            "Lulu — 18", "Pink car. Big sister energy.", "#FF4FA3");
        // Dina Card
        drawCharCard(50, H * 0.52, 380, H * 0.34, "dina",
            "Dina — 8", "Has Morgan. Runs fast.", "#A06DC8");

        // Footer
        drawText("Tap a sister to play!", W / 2, H - 40,
            "bold 16px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#7A2A5C", 4);
    }

    function drawCharCard(x, y, w, h, who, name, tagline, accent) {
        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        roundRect(x + 5, y + 6, w, h, 18); ctx.fill();
        // card body
        ctx.fillStyle = "#FFF8F0";
        roundRect(x, y, w, h, 18); ctx.fill();
        // accent stripe
        ctx.fillStyle = accent;
        roundRect(x, y, w, 36, 18); ctx.fill();
        ctx.fillRect(x, y + 18, w, 18);
        // border
        ctx.strokeStyle = accent;
        ctx.lineWidth = 5;
        roundRect(x, y, w, h, 18); ctx.stroke();
        // header text
        drawText(name, x + w / 2, y + 18, "bold 22px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#000", 3);
        // Portrait
        var portraitX = x + w / 2;
        var portraitY = y + h * 0.45 + 30;
        ctx.save();
        // Soft glow under portrait
        var grad = ctx.createRadialGradient(portraitX, portraitY + 30, 10, portraitX, portraitY + 30, 80);
        grad.addColorStop(0, "rgba(255,255,255,0.6)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(x, y + 40, w, h - 40);
        ctx.restore();
        var bob = Math.sin(charSelectTime * 2.5 + (who === "dina" ? 1 : 0)) * 4;
        if (who === "lulu") drawLuluPortrait(portraitX, portraitY + bob, charSelectTime, 0.95);
        else drawDinaPortrait(portraitX, portraitY + bob, charSelectTime, 0.95);
        // Tagline below
        drawText(tagline, x + w / 2, y + h - 16, "italic 14px 'Segoe UI', Arial, sans-serif",
            "#555", "#FFF", 2);
        // "TAP" badge in corner
        ctx.fillStyle = accent;
        roundRect(x + w - 70, y + h - 36, 60, 26, 13); ctx.fill();
        drawText("TAP ▶", x + w - 40, y + h - 23, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFF", null, 0);
    }

    function startDinaMode() {
        state = "dinaBus";
        dinaRunPhase = 0;
        dinaRunTimer = 0;
        dinaRunDistance = 0;
        dinaCoinsRun = 0;
        dinaStickers = 0;
        dina = { x: W / 2 + 30, y: 350, walkTime: 0, vx: 0, vy: 0, sprintTimer: 3,
                 sprintCool: 0, stumble: 0, holding: "backpack",
                 targetX: W / 2, targetY: 350 };
        schoolBus = { x: W + 220, y: 140, phase: 0, timer: 0, doorOpen: 0 };
        schoolGirls = [];
        particles.length = 0; // start the intro with a clean particle layer
        // Pre-populate girls who will come off
        for (var g = 0; g < 6; g++) {
            schoolGirls.push({
                spawn: 2.1 + g * 0.3, // when they appear (in seconds)
                onBus: true,
                x: 335, y: 195,
                vx: rand(-30, 30),
                vy: rand(40, 80),
                walkTime: 0,
                hairColor: ["#3E2723", "#5D4037", "#6D4C41", "#3E2723"][g % 4],
                hairStyle: ["pony", "loose", "bun", "loose", "pony", "bun"][g]
            });
        }
        mom = null;
    }

    // ── Drawing: Dina (top-down for game world) ──────────────
    function drawDinaTopDown(x, y, walkTime, facing, holding) {
        ctx.save();
        // Body bounces up on each footfall — absolute sin = always positive
        var bob = Math.abs(Math.sin(walkTime * 10)) * 3;
        var lean = Math.sin(walkTime * 10) * 0.04;
        ctx.translate(x, y - bob);
        ctx.rotate(lean);
        var legSwing = Math.sin(walkTime * 12) * 5;
        // Shadow (no bob — stays on ground)
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(0, 20, 16, 4, 0, 0, Math.PI * 2); ctx.fill();

        // Legs (black tights)
        ctx.fillStyle = "#212121";
        roundRect(-6, 6 - legSwing, 5, 16 + legSwing, 2); ctx.fill();
        roundRect(1, 6 + legSwing, 5, 16 - legSwing, 2); ctx.fill();
        // Boots
        ctx.fillStyle = "#3E2723";
        roundRect(-7, 20 - legSwing, 7, 4, 2); ctx.fill();
        roundRect(0, 20 + legSwing, 7, 4, 2); ctx.fill();

        // Pink puffy coat body (smaller, more proportional)
        ctx.fillStyle = "#1A1A1A"; // outline
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFB0C8";
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        // Subtle puff highlight (just one, not bulging)
        ctx.fillStyle = "#FFC5D6";
        ctx.beginPath();
        ctx.ellipse(-5, -3, 4, 2.5, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Arms (slimmer, peeking from coat puffs)
        ctx.fillStyle = "#FFB0C8";
        roundRect(-14, -4, 4, 10, 2); ctx.fill();
        roundRect(10, -4, 4, 10, 2); ctx.fill();
        // Hands (skin)
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(-12, 6, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(12, 6, 2.2, 0, Math.PI * 2); ctx.fill();

        // Backpack on back (showing as small bump behind coat)
        if (holding === "backpack") {
            ctx.fillStyle = "#1F2D5C";
            roundRect(-7, -4, 14, 8, 3); ctx.fill();
            // Unicorn keychain hanging off
            ctx.fillStyle = "#FFB0C8";
            ctx.beginPath(); ctx.arc(6, 6, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#FF4FA3";
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(6, 6); ctx.lineTo(7, 9);
            ctx.stroke();
        }

        // Head (kid proportions — thin outline for definition)
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath();
        ctx.arc(0, -13, 9.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath();
        ctx.arc(0, -13, 8.5, 0, Math.PI * 2);
        ctx.fill();

        // Hair top + ponytail (visible from above)
        ctx.fillStyle = "#6B4423";
        ctx.beginPath();
        ctx.arc(0, -16, 9, Math.PI, Math.PI * 2);
        ctx.fill();
        // Ponytail trailing behind (toward bottom of car/character)
        ctx.beginPath();
        ctx.ellipse(0, -3, 4, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        // Hair tie (small pink dot)
        ctx.fillStyle = "#FF4FA3";
        ctx.beginPath(); ctx.arc(0, -9, 1.5, 0, Math.PI * 2); ctx.fill();

        // Face details
        // Eyes (happy slits) for adorable face
        ctx.strokeStyle = "#3D2817";
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(-2.5, -13, 1.5, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.arc(2.5, -13, 1.5, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.stroke();
        ctx.lineCap = "butt";
        // Tiny smile
        ctx.strokeStyle = "#A0394D";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(0, -10, 2, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
        // Dimples
        ctx.fillStyle = "rgba(230,140,140,0.5)";
        ctx.beginPath();
        ctx.arc(-4, -11, 0.8, 0, Math.PI * 2);
        ctx.arc(4, -11, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // If holding Morgan plushie — proper cute cat with ears + nose + sleepy eyes
        if (holding === "morgan") {
            var mx = 0, my = 5;
            // Body
            ctx.fillStyle = "#9B8FB4";
            ctx.beginPath(); ctx.ellipse(mx, my + 1, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
            // Head
            ctx.beginPath(); ctx.arc(mx, my - 3, 4, 0, Math.PI * 2); ctx.fill();
            // Ears (triangular)
            ctx.beginPath();
            ctx.moveTo(mx - 3.5, my - 5); ctx.lineTo(mx - 2, my - 7.5); ctx.lineTo(mx - 1, my - 5);
            ctx.moveTo(mx + 1, my - 5); ctx.lineTo(mx + 2, my - 7.5); ctx.lineTo(mx + 3.5, my - 5);
            ctx.fill();
            // Inner ear pink
            ctx.fillStyle = "#FFB8D9";
            ctx.beginPath();
            ctx.arc(mx - 2.2, my - 6, 0.6, 0, Math.PI * 2);
            ctx.arc(mx + 2.2, my - 6, 0.6, 0, Math.PI * 2);
            ctx.fill();
            // Closed happy eyes
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 0.7;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(mx - 1.5, my - 3, 0.7, 1.1 * Math.PI, 1.9 * Math.PI);
            ctx.arc(mx + 1.5, my - 3, 0.7, 1.1 * Math.PI, 1.9 * Math.PI);
            ctx.stroke();
            // Pink nose
            ctx.fillStyle = "#FF8AAA";
            ctx.beginPath(); ctx.arc(mx, my - 1.5, 0.5, 0, Math.PI * 2); ctx.fill();
            ctx.lineCap = "butt";
        }

        ctx.restore();
    }

    // ── Drawing: Mom (top-down) ──────────────────────────────
    function drawMomTopDown(x, y, walkTime) {
        ctx.save();
        // Heavier mom bob — slower frequency, slightly larger amplitude
        var momBob = Math.abs(Math.sin(walkTime * 8)) * 2.5;
        var momLean = Math.sin(walkTime * 8) * 0.03;
        ctx.translate(x, y - momBob);
        ctx.rotate(momLean);
        var legSwing = Math.sin(walkTime * 10) * 4;

        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(0, 24, 18, 5, 0, 0, Math.PI * 2); ctx.fill();

        // Legs (dark pants)
        ctx.fillStyle = "#37474F";
        roundRect(-7, 8 - legSwing, 6, 18 + legSwing, 3); ctx.fill();
        roundRect(1, 8 + legSwing, 6, 18 - legSwing, 3); ctx.fill();
        // Shoes
        ctx.fillStyle = "#212121";
        roundRect(-8, 24 - legSwing, 8, 4, 2); ctx.fill();
        roundRect(0, 24 + legSwing, 8, 4, 2); ctx.fill();

        // Body - cozy sweater
        ctx.fillStyle = "#8E24AA";
        ctx.beginPath();
        ctx.ellipse(0, -2, 18, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#AB47BC";
        ctx.beginPath();
        ctx.arc(-8, -8, 7, 0, Math.PI * 2);
        ctx.arc(8, -8, 7, 0, Math.PI * 2);
        ctx.fill();

        // Arms (one waving)
        var armWave = Math.sin(walkTime * 6) * 0.5;
        ctx.fillStyle = "#8E24AA";
        ctx.save();
        ctx.translate(-15, -2);
        ctx.rotate(-0.4 + armWave);
        roundRect(-3, -8, 6, 16, 3); ctx.fill();
        ctx.restore();
        roundRect(13, -2, 6, 16, 3); ctx.fill();
        // Hands
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(-18, 8, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(16, 14, 2.5, 0, Math.PI * 2); ctx.fill();

        // Head
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(0, -18, 9, 0, Math.PI * 2); ctx.fill();
        // Hair (adult bob) — frames the top + sides but leaves the lower
        // face (~60% of the head) as visible skin. Head spans y -27..-9;
        // hair stops around y -21 across the front so eyes/blush/mouth show.
        ctx.fillStyle = "#3E2723";
        // Top cap: semicircle over the crown, flat edge above the brows.
        ctx.beginPath();
        ctx.arc(0, -21, 9.5, Math.PI, Math.PI * 2);
        ctx.fill();
        // Bob sides: hair sweeps down past the cheeks at the very edges of
        // the face, hugging the sides without covering the front features.
        ctx.beginPath();
        ctx.ellipse(-9, -16, 2.8, 9, -0.15, 0, Math.PI * 2);
        ctx.ellipse(9, -16, 2.8, 9, 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Head outline (chunky)
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, -18, 9, 0, Math.PI * 2); ctx.stroke();
        // Cheek blush
        ctx.fillStyle = "rgba(255,140,140,0.5)";
        ctx.beginPath();
        ctx.arc(-5, -16, 1.6, 0, Math.PI * 2);
        ctx.arc(5, -16, 1.6, 0, Math.PI * 2);
        ctx.fill();
        // Eyes (whites + pupils)
        ctx.fillStyle = "#FFF";
        ctx.beginPath();
        ctx.arc(-3, -18, 1.4, 0, Math.PI * 2);
        ctx.arc(3, -18, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#222";
        ctx.beginPath();
        ctx.arc(-2.7, -17.8, 0.9, 0, Math.PI * 2);
        ctx.arc(3.3, -17.8, 0.9, 0, Math.PI * 2);
        ctx.fill();
        // Worried brows (angled inward)
        ctx.strokeStyle = "#3E2723";
        ctx.lineWidth = 1.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-6, -21); ctx.lineTo(-2, -22);
        ctx.moveTo(2, -22); ctx.lineTo(6, -21);
        ctx.stroke();
        ctx.lineCap = "butt";
        // Small "o" worried mouth
        ctx.fillStyle = "#5D2A2A";
        ctx.beginPath();
        ctx.ellipse(0, -14, 0.9, 1.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Handbag bouncing
        ctx.fillStyle = "#5D4037";
        roundRect(13, -5, 9, 11, 2); ctx.fill();
        ctx.fillStyle = "#FFD700";
        ctx.fillRect(13, -2, 9, 2);

        ctx.restore();
    }

    // ── Drawing: School Bus ──────────────────────────────────
    function drawSchoolBus(bus) {
        ctx.save();
        ctx.translate(bus.x, bus.y);

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        roundRect(8, 8, 240, 140, 14); ctx.fill();

        // Body
        ctx.fillStyle = "#FFD426";
        roundRect(0, 0, 240, 140, 14); ctx.fill();
        // Outline
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 4;
        roundRect(0, 0, 240, 140, 14); ctx.stroke();

        // Black stripes
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 22, 240, 6);
        ctx.fillRect(0, 116, 240, 6);

        // Windshield (front)
        ctx.fillStyle = "#7BB8E0";
        roundRect(8, 4, 70, 18, 4); ctx.fill();

        // Side windows along the side
        ctx.fillStyle = "#7BB8E0";
        for (var w = 0; w < 5; w++) {
            roundRect(86 + w * 30, 4, 24, 18, 3); ctx.fill();
        }

        // White panel behind school name (readability)
        ctx.fillStyle = "#FFFFFF";
        roundRect(20, 56, 200, 36, 6); ctx.fill();
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 2.5;
        roundRect(20, 56, 200, 36, 6); ctx.stroke();
        // "LEV BAIS YAAKOV" written along the side
        ctx.fillStyle = "#0D47A1";
        ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("LEV BAIS YAAKOV", 120, 70);
        ctx.font = "bold 10px 'Segoe UI', Arial, sans-serif";
        ctx.fillText("SCHOOL", 120, 84);

        // Wheels
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.ellipse(35, 138, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(205, 138, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#424242";
        ctx.beginPath(); ctx.ellipse(35, 138, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(205, 138, 6, 3, 0, 0, Math.PI * 2); ctx.fill();

        // Door (right side, opens with bus.doorOpen 0-1)
        ctx.fillStyle = "#000";
        var doorOpen = bus.doorOpen || 0;
        ctx.fillRect(218 + doorOpen * 8, 100, 8, 36);
        // Door window
        ctx.fillStyle = "#7BB8E0";
        ctx.fillRect(220 + doorOpen * 8, 104, 4, 14);

        // Flashing lights on top
        var blink = Math.sin(bus.timer * 12) > 0;
        ctx.fillStyle = blink ? "#FF2222" : "#FFAA22";
        ctx.beginPath(); ctx.arc(20, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = !blink ? "#FF2222" : "#FFAA22";
        ctx.beginPath(); ctx.arc(220, 0, 5, 0, Math.PI * 2); ctx.fill();

        // Light aura
        if (blink) {
            ctx.fillStyle = "rgba(244,67,54,0.3)";
            ctx.beginPath(); ctx.arc(20, 0, 16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(255,170,34,0.3)";
            ctx.beginPath(); ctx.arc(220, 0, 16, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = "rgba(255,170,34,0.3)";
            ctx.beginPath(); ctx.arc(20, 0, 16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(244,67,54,0.3)";
            ctx.beginPath(); ctx.arc(220, 0, 16, 0, Math.PI * 2); ctx.fill();
        }

        // Stop sign deployed (when stopped)
        if (bus.phase >= 1) {
            ctx.fillStyle = "#D32F2F";
            ctx.beginPath();
            var cx = -18, cy = 80;
            for (var i = 0; i < 8; i++) {
                var ang = i * Math.PI / 4;
                var px = cx + Math.cos(ang) * 16;
                var py = cy + Math.sin(ang) * 16;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 9px 'Segoe UI', Arial, sans-serif";
            ctx.fillText("STOP", cx, cy + 2);
        }

        ctx.restore();
    }

    // ── Drawing: school girl in uniform (top-down) ───────────
    function drawSchoolGirl(g) {
        ctx.save();
        ctx.translate(g.x, g.y);
        var legSwing = Math.sin(g.walkTime * 14) * 4;

        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(0, 14, 10, 3, 0, 0, Math.PI * 2); ctx.fill();

        // Navy skirt
        ctx.fillStyle = "#1F2D5C";
        roundRect(-6, 0, 12, 10, 2); ctx.fill();
        // Legs (tights)
        ctx.fillStyle = "#3E2723";
        ctx.fillRect(-4, 8 - legSwing, 3, 8);
        ctx.fillRect(1, 8 + legSwing, 3, 8);
        // Shoes
        ctx.fillStyle = "#000";
        ctx.fillRect(-5, 15 - legSwing, 4, 2);
        ctx.fillRect(1, 15 + legSwing, 4, 2);

        // White shirt
        ctx.fillStyle = "#FFFFFF";
        roundRect(-7, -8, 14, 12, 3); ctx.fill();
        // Collar dots
        ctx.fillStyle = "#1F2D5C";
        ctx.fillRect(-3, -5, 1.5, 1.5);
        ctx.fillRect(1.5, -5, 1.5, 1.5);

        // Backpack
        ctx.fillStyle = "#212121";
        roundRect(-5, -4, 10, 6, 2); ctx.fill();

        // Arms
        ctx.fillStyle = "#FFFFFF";
        roundRect(-9, -6, 3, 9, 1); ctx.fill();
        roundRect(6, -6, 3, 9, 1); ctx.fill();

        // Head with chunky outline
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(0, -13, 7.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#F5C9A0";
        ctx.beginPath(); ctx.arc(0, -13, 6.3, 0, Math.PI * 2); ctx.fill();
        // Hair (slightly darker outer + lighter inner pass)
        ctx.fillStyle = shadeColor(g.hairColor, -35);
        if (g.hairStyle === "pony") {
            ctx.beginPath();
            ctx.arc(0, -16, 8, Math.PI, Math.PI * 2);
            ctx.ellipse(0, -8, 3.5, 6.5, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (g.hairStyle === "bun") {
            ctx.beginPath();
            ctx.arc(0, -16, 8, Math.PI, Math.PI * 2);
            ctx.arc(0, -19, 4.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(0, -14, 8.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#F5C9A0";
            ctx.beginPath(); ctx.arc(0, -13, 5.5, 0, Math.PI * 2); ctx.fill();
        }
        // Inner hair color pass for definition
        ctx.fillStyle = g.hairColor;
        if (g.hairStyle === "pony") {
            ctx.beginPath();
            ctx.arc(0, -16, 7, Math.PI, Math.PI * 2);
            ctx.fill();
        } else if (g.hairStyle === "bun") {
            ctx.beginPath();
            ctx.arc(0, -19, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }
        // Cheek blush
        ctx.fillStyle = "rgba(255,150,150,0.5)";
        ctx.beginPath();
        ctx.arc(-3.5, -11, 1.2, 0, Math.PI * 2);
        ctx.arc(3.5, -11, 1.2, 0, Math.PI * 2);
        ctx.fill();
        // Sparkly eyes (Sasquatch-style)
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(-2.2, -13, 1.4, 0, Math.PI * 2);
        ctx.arc(2.2, -13, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(-2.2, -12.8, 0.9, 0, Math.PI * 2);
        ctx.arc(2.2, -12.8, 0.9, 0, Math.PI * 2);
        ctx.fill();
        // Tiny smile
        ctx.strokeStyle = "#A0394D";
        ctx.lineWidth = 0.9;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(0, -11, 1.6, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
        ctx.lineCap = "butt";

        ctx.restore();
    }

    // ── Update / Draw: Dina Bus Intro ────────────────────────
    function updateDinaBus(dt) {
        if (!schoolBus) return;
        schoolBus.timer += dt;
        var t = schoolBus.timer;
        updateParticles(dt); // tick exhaust/dust puffs spawned below

        // Phase 0: bus drives in (0-1.2s)
        if (schoolBus.phase === 0) {
            schoolBus.x = lerp(W + 220, W / 2 - 120, Math.min(t / 1.2, 1));
            if (t > 1.2) {
                schoolBus.phase = 1;
                schoolBus.timer = 1.2;
            }
        }
        // Phase 1: doors hiss open (1.2-1.7s)
        if (schoolBus.phase === 1) {
            if (schoolBus.doorOpen === 0) playDoorHiss();
            schoolBus.doorOpen = Math.min((t - 1.2) / 0.5, 1);
            if (t > 1.7) {
                schoolBus.phase = 2;
                playSchoolBell();
            }
        }
        // Phase 2: girls coming off (1.7-5.0s)
        if (schoolBus.phase === 2) {
            for (var i = 0; i < schoolGirls.length; i++) {
                var gi = schoolGirls[i];
                if (gi.onBus && t > gi.spawn) {
                    gi.onBus = false;
                    gi.x = schoolBus.x + 220;
                    gi.y = schoolBus.y + 130;
                    // little chatter
                    if (Math.random() > 0.5) playTone(rand(500, 900), 0.05, "sine", 0.06);
                    // little puff of dust as they hop down onto the sidewalk
                    for (var dp = 0; dp < 5; dp++) {
                        particles.push({
                            x: gi.x + rand(-4, 4), y: gi.y + 10,
                            vx: rand(-25, 25), vy: rand(-30, -5),
                            life: rand(0.3, 0.6), maxLife: 0.6,
                            size: rand(3, 6),
                            color: randPick(["#D7CBB0", "#C9BCA0", "#E0D6BE"]),
                            gravity: 40, smoke: true
                        });
                    }
                }
                if (!gi.onBus) {
                    gi.x += gi.vx * dt;
                    gi.y += gi.vy * dt;
                    gi.walkTime += dt;
                }
            }
            if (t > 4.5) {
                schoolBus.phase = 3;
                // Dina emerges
                dina.x = schoolBus.x + 220;
                dina.y = schoolBus.y + 130;
                dina.targetX = W / 2;
                dina.targetY = 350;
                dina.walkTime = 0;
                dinaCharacterFace = "happy";
            }
        }
        // Phase 3: Dina emerges and walks center (4.5-6.0s)
        if (schoolBus.phase === 3) {
            // Move Dina toward target
            var dx = dina.targetX - dina.x;
            var dy = dina.targetY - dina.y;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d > 2) {
                dina.x += (dx / d) * 100 * dt;
                dina.y += (dy / d) * 100 * dt;
                dina.walkTime += dt;
            } else if (t > 6.0) {
                schoolBus.phase = 4;
            }
        }
        // Phase 4: thought bubble (6.0-7.0s)
        if (schoolBus.phase === 4 && t > 7.0) {
            schoolBus.phase = 5;
            dinaCharacterFace = "determined";
            playTone(220, 0.12, "square", 0.15);
        }
        // Phase 5: determined / Hmph (7.0-8.0s)
        if (schoolBus.phase === 5 && t > 8.0) {
            schoolBus.phase = 6;
        }
        // Phase 6: bus drives away (8.0-8.7s)
        if (schoolBus.phase === 6) {
            schoolBus.x -= 600 * dt;
            // Exhaust puffs trailing from the back-right of the bus
            schoolBus.exhaust = (schoolBus.exhaust || 0) + dt;
            if (schoolBus.exhaust > 0.06) {
                schoolBus.exhaust = 0;
                particles.push({
                    x: schoolBus.x + 240, y: schoolBus.y + 120 + rand(-4, 4),
                    vx: rand(20, 60), vy: rand(-30, -10),
                    life: rand(0.5, 0.9), maxLife: 0.9,
                    size: rand(6, 11),
                    color: randPick(["#9E9E9E", "#BDBDBD", "#757575"]),
                    gravity: -20, smoke: true
                });
            }
            if (schoolBus.x < -300) {
                // Start the run-home game
                schoolBus = null;
                particles.length = 0; // clear leftover exhaust/dust
                startDinaRun();
            }
        }

        // Allow click to skip
        var click = consumeClick();
        if (click || consumeAction()) {
            schoolBus = null;
            particles.length = 0; // clear leftover exhaust/dust
            startDinaRun();
        }
    }

    function drawDinaBus() {
        // Sky gradient at top
        var skyG = ctx.createLinearGradient(0, 0, 0, 90);
        skyG.addColorStop(0, "#A8E6CF"); skyG.addColorStop(1, "#FFE3B0");
        ctx.fillStyle = skyG;
        ctx.fillRect(0, 0, W, 90);
        // Unified lawn green (matches run home)
        ctx.fillStyle = "#7CB342";
        ctx.fillRect(0, 90, W, H);
        // Road (where bus is)
        ctx.fillStyle = "#6B7B8D";
        ctx.fillRect(0, 90, W, 220);
        // Road outline + lane dashes
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 90, W, 220);
        ctx.strokeStyle = "#F5F5DC";
        ctx.lineWidth = 2;
        ctx.setLineDash([20, 16]);
        ctx.beginPath();
        ctx.moveTo(0, 200); ctx.lineTo(W, 200);
        ctx.stroke();
        ctx.setLineDash([]);
        // Curb
        ctx.fillStyle = "#FBC02D";
        ctx.fillRect(0, 305, W, 4);
        ctx.fillStyle = "#212121";
        ctx.fillRect(0, 309, W, 2);
        // Sidewalk
        ctx.fillStyle = "#D0CFC2";
        ctx.fillRect(0, 311, W, 88);
        ctx.strokeStyle = "#9E9E9E";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var sxx = 60; sxx < W; sxx += 80) {
            ctx.moveTo(sxx, 311); ctx.lineTo(sxx, 399);
        }
        ctx.stroke();

        // Distant houses with chunky outlines + windows
        // House 1 (pink)
        ctx.fillStyle = "#EF9A9A";
        roundRect(40, 430, 100, 80, 6); ctx.fill();
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 3;
        roundRect(40, 430, 100, 80, 6); ctx.stroke();
        // Roof
        ctx.fillStyle = "#B71C1C";
        ctx.beginPath();
        ctx.moveTo(40, 430); ctx.lineTo(90, 400); ctx.lineTo(140, 430); ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Windows
        ctx.fillStyle = "#FFEB3B";
        ctx.fillRect(56, 458, 22, 22);
        ctx.fillRect(102, 458, 22, 22);
        ctx.strokeRect(56, 458, 22, 22);
        ctx.strokeRect(102, 458, 22, 22);
        // Window cross
        ctx.beginPath();
        ctx.moveTo(67, 458); ctx.lineTo(67, 480);
        ctx.moveTo(56, 469); ctx.lineTo(78, 469);
        ctx.moveTo(113, 458); ctx.lineTo(113, 480);
        ctx.moveTo(102, 469); ctx.lineTo(124, 469);
        ctx.stroke();
        // Door
        ctx.fillStyle = "#5D4037";
        ctx.fillRect(82, 484, 16, 26);
        ctx.strokeRect(82, 484, 16, 26);

        // House 2 (brown)
        ctx.fillStyle = "#BCAAA4";
        roundRect(250, 440, 110, 70, 6); ctx.fill();
        roundRect(250, 440, 110, 70, 6); ctx.stroke();
        ctx.fillStyle = "#4E342E";
        ctx.beginPath();
        ctx.moveTo(250, 440); ctx.lineTo(305, 410); ctx.lineTo(360, 440); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#FFEB3B";
        ctx.fillRect(268, 460, 22, 22);
        ctx.fillRect(320, 460, 22, 22);
        ctx.strokeRect(268, 460, 22, 22);
        ctx.strokeRect(320, 460, 22, 22);
        ctx.beginPath();
        ctx.moveTo(279, 460); ctx.lineTo(279, 482);
        ctx.moveTo(268, 471); ctx.lineTo(290, 471);
        ctx.moveTo(331, 460); ctx.lineTo(331, 482);
        ctx.moveTo(320, 471); ctx.lineTo(342, 471);
        ctx.stroke();
        ctx.fillStyle = "#5D4037";
        ctx.fillRect(297, 484, 16, 26);
        ctx.strokeRect(297, 484, 16, 26);

        // Bus — gentle idle bob while stopped (engine running, phases 1-5)
        if (schoolBus) {
            var busBob = (schoolBus.phase >= 1 && schoolBus.phase <= 5)
                ? Math.sin(schoolBus.timer * 6) * 1.5 : 0;
            var baseY = schoolBus.y;
            schoolBus.y = baseY + busBob;
            drawSchoolBus(schoolBus);
            schoolBus.y = baseY;
        }

        // Exhaust / dust puffs (rendered behind the girls but over the bus)
        drawParticles();

        // School girls
        for (var gi = 0; gi < schoolGirls.length; gi++) {
            if (!schoolGirls[gi].onBus) drawSchoolGirl(schoolGirls[gi]);
        }

        // Dina (only after phase 3)
        if (schoolBus && schoolBus.phase >= 3) {
            drawDinaTopDown(dina.x, dina.y, dina.walkTime, "down", "backpack");
        }

        // Subtitles
        if (schoolBus) {
            var bt = schoolBus.timer;
            if (bt > 2.0 && bt < 4.0) {
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                roundRect(40, 750, W - 80, 50, 10); ctx.fill();
                drawText("🔔 School's out!", W / 2, 775,
                    "bold 20px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);
            } else if (bt > 6.0 && bt < 7.0 && dina) {
                // Thought bubble above Dina
                drawSpeechBubble(dina.x, dina.y - 25, "Where's mom?", bt);
            } else if (bt > 7.0 && bt < 8.0 && dina) {
                drawSpeechBubble(dina.x, dina.y - 25, "Hmph!\nI'll walk!", bt);
            }
        }

        // Tap-to-skip hint — shown from the very start, gentle pulse so it
        // reads as an interactive prompt rather than static chrome.
        var skipT = schoolBus ? schoolBus.timer : 0;
        ctx.save();
        ctx.globalAlpha = 0.75 + Math.sin(skipT * 4) * 0.2;
        drawText("Tap to skip ▶", W - 12, H - 16, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3, "right");
        ctx.restore();
    }

    // Progressive difficulty: ramps up the more the player has run home.
    // dinaDiff = 1.0 on the first run and climbs ~12% per run, capping at 2.2x.
    // Level is the human-facing "Run #" shown in the HUD.
    var dinaDiff = 1;
    var dinaRunLevel = 1;
    function startDinaRun() {
        state = "dinaRun";
        dinaRunLevel = (save.dinaRunsPlayed || 0) + 1;
        dinaDiff = Math.min(1 + (dinaRunLevel - 1) * 0.12, 2.2);
        save.dinaRunsPlayed = dinaRunLevel;
        persistSave();
        dinaRunPhase = 1;
        dinaRunTimer = 0;
        dinaRunDistance = 0;
        dinaScrollY = 0;
        dinaSidewalk = [];
        dinaSidewalk.__greenblattSpawned = false;
        dinaSidewalkSpawn = 0;
        dina = { x: W / 2, y: H - 200, walkTime: 0,
                 lane: 1, sprintTimer: 3, sprintCool: 0,
                 stumble: 0, holding: "backpack",
                 chatTimer: rand(3, 6), chat: "", chatLife: 0 };
        mom = { x: W / 2, y: H + 100, walkTime: 0, distance: 1.0, says: 0, sayTimer: rand(4, 8) };
    }

    // ── Update / Draw: Dina Run Home ─────────────────────────
    var DINA_LANES_X = [W / 2 - 70, W / 2, W / 2 + 70]; // left grass, center sidewalk, right grass
    var DINA_RUN_DURATION = 45; // seconds total (nominal, at normal pace)
    var DINA_BASE_SCROLL = 160;                              // px/sec the world moves at normal pace
    var DINA_RUN_TOTAL_PX = DINA_BASE_SCROLL * DINA_RUN_DURATION; // 7200px = one full run
    var dinaScrollY = 0;                                     // accumulated world scroll — single source of truth

    function updateDinaRun(dt) {
        if (!dina) return;
        dinaRunTimer += dt;
        dina.walkTime += dt;
        if (shakeTimer > 0) shakeTimer -= dt;

        // Sprint / slow input. The meter only RECHARGES when you're NOT holding
        // boost — otherwise holding the button on an empty bar would refill it
        // and re-engage, letting you sprint forever.
        var wantSprint = keys.up;
        var sprint = wantSprint && dina.sprintTimer > 0;
        if (sprint) {
            dina.sprintTimer = Math.max(0, dina.sprintTimer - dt);
        } else if (!wantSprint) {
            dina.sprintTimer = Math.min(3, dina.sprintTimer + dt * 0.6);
        }
        var slow = keys.down;

        // ── SINGLE source of truth for world motion ──
        // One scroll speed in px/sec; sprint speeds it up, slow/stumble slow it.
        var speedMult = sprint ? 2.0 : (slow ? 0.5 : 1.0);
        if (dina.stumble > 0) {
            speedMult *= 0.3;
            dina.stumble -= dt;
        }
        var scrollSpeed = DINA_BASE_SCROLL * speedMult; // px/sec — drives BG and hazards alike
        dinaScrollY += scrollSpeed * dt;                // accumulate world travel

        // Distance is derived from the exact same scroll → progress bar matches the visuals.
        dinaRunDistance = Math.min(dinaScrollY / DINA_RUN_TOTAL_PX, 1);

        // Steering — finger-drag (mobile) or arrow keys (desktop) move Dina
        // smoothly across the sidewalk, exactly like Lulu's car. No lane arrows.
        var dinaMinX = W / 2 - 95, dinaMaxX = W / 2 + 95;
        if (touchX !== null) {
            dina.x = lerp(dina.x, clamp(touchX, dinaMinX, dinaMaxX), Math.min(1, 14 * dt));
        } else {
            var dinaMove = 0;
            if (keys.left) dinaMove -= 1;
            if (keys.right) dinaMove += 1;
            dina.x = clamp(dina.x + dinaMove * 280 * dt, dinaMinX, dinaMaxX);
        }
        // Keep lane index roughly synced for anything that reads it.
        dina.lane = dina.x < W / 2 - 35 ? 0 : (dina.x > W / 2 + 35 ? 2 : 1);

        // Spawn sidewalk hazards — denser as the run progresses so it ramps
        // from "warm-up" to "obstacle course". Late game can spawn two at once.
        dinaSidewalkSpawn -= dt;
        if (dinaSidewalkSpawn <= 0 && dinaRunTimer < DINA_RUN_DURATION - 4) {
            var prog = dinaRunDistance; // 0..1
            // gap shrinks from ~1.4s early to ~0.55s late, and tightens further
            // on higher run levels (dinaDiff) for a real obstacle course.
            dinaSidewalkSpawn = rand(0.9, 1.6) * (1 - prog * 0.55) / dinaDiff;
            spawnDinaHazard();
            // past the halfway mark, sometimes throw a second hazard in another lane
            // (more likely the harder the run level)
            if (prog > 0.5 && Math.random() < 0.35 * prog * dinaDiff) spawnDinaHazard();
        }
        // Update hazards
        for (var h = dinaSidewalk.length - 1; h >= 0; h--) {
            var hz = dinaSidewalk[h];
            hz.y += scrollSpeed * dt;
            hz.walkTime = (hz.walkTime || 0) + dt;
            if (hz.y > H + 60) { dinaSidewalk.splice(h, 1); continue; }
            // Collision
            var dx = dina.x - hz.x;
            var dy = dina.y - hz.y;
            if (dx * dx + dy * dy < (hz.r + 15) * (hz.r + 15) && !hz.hit) {
                hz.hit = true;
                handleDinaHazard(hz);
            }
        }

        // Mom chase — now an actual RACE. She steadily gains ground at a
        // baseline pace that ramps up over the run; sprinting is the only way
        // to pull back ahead, so the player has to manage sprint + dodge hazards.
        // Mom closes in faster on higher run levels (progressive difficulty).
        var chaseRamp = (0.012 + dinaRunDistance * 0.022) * dinaDiff;
        mom.distance = Math.max(0, mom.distance - chaseRamp * dt);
        if (sprint) {
            // Sprinting reverses the chase and buys back distance
            mom.distance = Math.min(1.0, mom.distance + 0.075 * dt);
        }
        // Mistakes hurt more now: stumbles and dawdling let Mom surge in
        if (dina.stumble > 0) mom.distance = Math.max(0, mom.distance - 0.16 * dt);
        if (slow) mom.distance = Math.max(0, mom.distance - 0.06 * dt);
        // Final-stretch tension: in the last 8 seconds, Mom pushes hard
        if (dinaRunTimer > DINA_RUN_DURATION - 8) {
            mom.distance = Math.max(0, mom.distance - 0.04 * dt);
        }
        mom.walkTime += dt;
        mom.sayTimer -= dt;
        if (mom.sayTimer <= 0) {
            mom.says = (mom.says + 1) % 4;
            mom.sayTimer = rand(4, 8);
        }
        // mom's y position based on distance
        mom.y = H + 50 - (1 - mom.distance) * 130;
        mom.x = lerp(mom.x, dina.x, dt * 2);

        // Dina cheerful chatter (personality)
        dina.chatTimer -= dt;
        if (dina.chatLife > 0) dina.chatLife -= dt;
        if (dina.chatTimer <= 0) {
            dina.chatTimer = rand(4, 8);
            dina.chatLife = 1.6;
            if (sprint) dina.chat = randPick(["Zoooom!", "Catch me!", "Wheee!"]);
            else if (dina.stumble > 0) dina.chat = randPick(["Whoops!", "Oof!", "Almost!"]);
            else if (dinaRunDistance > 0.7) dina.chat = randPick(["Home! Home!", "Almost there!"]);
            else dina.chat = randPick(["La la la~", "Hi doggy!", "So fast!", "Race ya!"]);
        }

        // Check ending conditions
        if (dinaRunDistance >= 1) {
            // Won the race! Reached home before mom
            dinaEnding = "ran";
            dinaRunPhase = 2;
            bankDinaRunRewards(true); // winning banks coins + a bonus into Lulu's world
            state = "dinaCaught"; // shared outro state, with different flavor
            dinaRunTimer = 0;
            spawnDinaConfetti();
            playTone(523, 0.1, "triangle", 0.2);
            setTimeout(function () { playTone(659, 0.1, "triangle", 0.2); }, 100);
            setTimeout(function () { playTone(784, 0.12, "triangle", 0.22); }, 200);
            setTimeout(function () { playTone(1046, 0.16, "triangle", 0.24); }, 320);
            return;
        }
        if (mom.distance <= 0) {
            // Mom caught up — still keep what you collected (no win bonus)
            dinaEnding = "walked";
            dinaRunPhase = 2;
            bankDinaRunRewards(false);
            state = "dinaCaught";
            dinaRunTimer = 0;
            playTone(440, 0.18, "sine", 0.2);
            return;
        }
    }

    // Bank what Dina earned on the run into the shared save so it carries over
    // into Lulu's world (coins) and the star total (stickers). Winning the race
    // adds a tidy bonus. dinaRunBanked* hold the amounts for the result screen.
    var dinaRunBankedCoins = 0, dinaRunBankedStars = 0, dinaRunWinBonus = 0;
    function bankDinaRunRewards(won) {
        dinaRunWinBonus = won ? 25 : 0;
        dinaRunBankedCoins = dinaCoinsRun + dinaRunWinBonus;
        dinaRunBankedStars = dinaStickers;
        save.totalCoins += dinaRunBankedCoins;
        save.parkingTotalStars = (save.parkingTotalStars || 0) + dinaRunBankedStars;
        persistSave();
    }

    // Lane switch with keyboard or buttons
    var lastLeftPress = false, lastRightPress = false;
    function consumeLaneSwitch(dir) {
        if (dir === "left") {
            // queued tap (mobile) — drains once
            if (laneQueued === -1) { laneQueued = 0; return true; }
            if (keys.left && !lastLeftPress) { lastLeftPress = true; return true; }
            if (!keys.left) lastLeftPress = false;
        }
        if (dir === "right") {
            if (laneQueued === 1) { laneQueued = 0; return true; }
            if (keys.right && !lastRightPress) { lastRightPress = true; return true; }
            if (!keys.right) lastRightPress = false;
        }
        return false;
    }

    function spawnDinaHazard() {
        var types = ["hydrant", "dog", "butterfly", "squirrel", "kickball", "sprinkler", "hopscotch", "mailbox", "cat"];
        // Mrs. Greenblatt appears once per run, around midpoint
        if (!dinaSidewalk.__greenblattSpawned && dinaRunDistance > 0.4 && dinaRunDistance < 0.6 && Math.random() < 0.4) {
            dinaSidewalk.push({
                type: "greenblatt",
                x: DINA_LANES_X[1], // always center sidewalk
                y: -40,
                r: 18,
                walkTime: 0,
                greeted: false
            });
            dinaSidewalk.__greenblattSpawned = true;
            return;
        }
        var t = randPick(types);
        var lane = randInt(0, 2);
        dinaSidewalk.push({
            type: t,
            x: DINA_LANES_X[lane],
            y: -40,
            r: 14,
            walkTime: 0
        });
    }

    function handleDinaHazard(hz) {
        if (hz.type === "hydrant" || hz.type === "kickball" || hz.type === "squirrel" || hz.type === "mailbox") {
            dina.stumble = 0.5;
            shakeTimer = 0.25; shakeIntensity = 5;
            spawnCrashBurst(hz.x, hz.y, false);
            playTone(180, 0.1, "square", 0.15);
        } else if (hz.type === "dog") {
            dina.stumble = 1.5;
            dinaCoinsRun += 2;
            shakeTimer = 0.4; shakeIntensity = 8;
            playDogBark();
            spawnFloater(hz.x, hz.y, "+2 🐕", "#FFB74D");
        } else if (hz.type === "butterfly") {
            dinaCoinsRun += 1;
            playTone(1500, 0.08, "sine", 0.15);
            spawnFloater(hz.x, hz.y, "+1 🦋", "#FF80AB");
        } else if (hz.type === "sprinkler") {
            dina.sprintTimer = Math.min(3, dina.sprintTimer + 1);
            playTone(440, 0.1, "sine", 0.18);
            spawnFloater(hz.x, hz.y, "+⚡", "#4FC3F7");
        } else if (hz.type === "hopscotch") {
            dinaStickers++;
            playHopJump();
            spawnFloater(hz.x, hz.y, "+⭐", "#FFD700");
        } else if (hz.type === "cat") {
            dinaCoinsRun += 1;
            playTone(600, 0.1, "sine", 0.12);
        } else if (hz.type === "greenblatt") {
            // Crossing guard hands you a tootsie roll
            if (!hz.greeted) {
                dinaCoinsRun += 5;
                dinaStickers += 1;
                hz.greeted = true;
                playTone(660, 0.08, "triangle", 0.18);
                setTimeout(function () { playTone(880, 0.1, "triangle", 0.18); }, 80);
                spawnFloater(hz.x, hz.y, "🍬 +5", "#FFD700");
                // Brief pause but no big stumble
                dina.stumble = 0.4;
            }
        }
    }

    function drawDinaSidewalkBg(scrollY) {
        // Lawn — unified green
        ctx.fillStyle = "#7CB342";
        ctx.fillRect(0, 0, W, H);
        // Lawn texture stripes
        ctx.fillStyle = "#9CCC65";
        for (var gy = (scrollY * 0.2) % 60 - 60; gy < H; gy += 60) {
            ctx.fillRect(0, gy, W, 20);
        }
        // Tiny flower pops scattered on the lawn
        ctx.fillStyle = "#FFD54F";
        for (var fi = 0; fi < 14; fi++) {
            var fxx = (fi * 41 + 13) % W;
            var fyy = ((fi * 67 + scrollY * 0.45) % (H + 80)) - 40;
            if (fxx > W / 2 - 110 && fxx < W / 2 + 110) continue;
            ctx.beginPath(); ctx.arc(fxx, fyy, 2.5, 0, Math.PI * 2); ctx.fill();
        }

        // Sidewalk (center) with edge shadow
        var SIDEWALK_L = W / 2 - 100, SIDEWALK_W = 200;
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(SIDEWALK_L - 4, 0, 4, H);
        ctx.fillRect(SIDEWALK_L + SIDEWALK_W, 0, 4, H);
        ctx.fillStyle = "#D0CFC2";
        ctx.fillRect(SIDEWALK_L, 0, SIDEWALK_W, H);
        // Chunky outline
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 3;
        ctx.strokeRect(SIDEWALK_L, 0, SIDEWALK_W, H);
        // Sidewalk cracks (batched into single path)
        ctx.strokeStyle = "#9E9E9E";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var sy = (scrollY % 80) - 80; sy < H + 40; sy += 80) {
            ctx.moveTo(SIDEWALK_L + 4, sy);
            ctx.lineTo(SIDEWALK_L + SIDEWALK_W - 4, sy);
        }
        ctx.stroke();

        // Lane dashes
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 14]);
        ctx.lineDashOffset = -scrollY * 0.5;
        ctx.beginPath();
        ctx.moveTo(SIDEWALK_L + 60, 0); ctx.lineTo(SIDEWALK_L + 60, H);
        ctx.moveTo(SIDEWALK_L + 140, 0); ctx.lineTo(SIDEWALK_L + 140, H);
        ctx.stroke();
        ctx.setLineDash([]);

        // Proper picket fence on both sides of the lawn
        ctx.fillStyle = "#FFF8E8";
        ctx.strokeStyle = "#5D4037";
        ctx.lineWidth = 2;
        for (var fx = 6; fx < SIDEWALK_L - 12; fx += 14) {
            var ofy = ((fx * 7 + scrollY * 0.4) % (H + 60)) - 60;
            roundRect(fx, ofy, 8, 18, 2); ctx.fill(); ctx.stroke();
            // Mirror on right
            roundRect(W - fx - 8, ofy + 30, 8, 18, 2); ctx.fill(); ctx.stroke();
        }
        // Fence rail (horizontal crossbar)
        ctx.fillStyle = "#5D4037";
        for (var ry = ((scrollY * 0.4) % 120) - 60; ry < H + 30; ry += 120) {
            ctx.fillRect(0, ry, SIDEWALK_L - 6, 3);
            ctx.fillRect(SIDEWALK_L + SIDEWALK_W + 6, ry, W - SIDEWALK_L - SIDEWALK_W - 6, 3);
        }
    }

    function drawDinaSidewalkHazard(hz) {
        ctx.save();
        ctx.translate(hz.x, hz.y);
        if (hz.type === "hydrant") {
            ctx.fillStyle = "#B71C1C";
            roundRect(-7, -10, 14, 22, 4); ctx.fill();
            ctx.fillStyle = "#FFEB3B";
            ctx.beginPath(); ctx.arc(0, -5, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#212121";
            ctx.fillRect(-9, 12, 18, 3);
        } else if (hz.type === "mailbox") {
            // Pole
            ctx.fillStyle = "#5D4037";
            ctx.fillRect(-1, 0, 2, 14);
            // Box
            ctx.fillStyle = "#1565C0";
            roundRect(-10, -10, 20, 14, 3); ctx.fill();
            // Crayon sign "GO DINA!" hanging
            ctx.fillStyle = "#FFFFFF";
            roundRect(-12, 4, 22, 8, 1); ctx.fill();
            ctx.fillStyle = "#FF4FA3";
            ctx.font = "bold 7px Arial";
            ctx.textAlign = "center";
            ctx.fillText("GO DINA!", 0, 10);
        } else if (hz.type === "dog") {
            // friendly golden retriever
            ctx.fillStyle = "#F4A460";
            ctx.beginPath(); ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-10, -5, 6, 0, Math.PI * 2); ctx.fill();
            // Ears
            ctx.fillStyle = "#CD853F";
            ctx.beginPath();
            ctx.ellipse(-14, -3, 3, 6, -0.3, 0, Math.PI * 2);
            ctx.fill();
            // Eyes
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.arc(-12, -6, 0.8, 0, Math.PI * 2);
            ctx.arc(-8, -6, 0.8, 0, Math.PI * 2);
            ctx.fill();
            // Tail wag
            ctx.strokeStyle = "#F4A460";
            ctx.lineWidth = 4;
            ctx.beginPath();
            var wag = Math.sin(hz.walkTime * 10) * 4;
            ctx.moveTo(12, 0); ctx.quadraticCurveTo(20, -6, 22 + wag, -4);
            ctx.stroke();
            // Leash
            ctx.strokeStyle = "#8E24AA";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-10, -10); ctx.lineTo(-2, -22);
            ctx.stroke();
        } else if (hz.type === "butterfly") {
            // Pink/orange butterfly fluttering
            var flutter = Math.sin(hz.walkTime * 25);
            ctx.fillStyle = "#FF80AB";
            ctx.beginPath();
            ctx.ellipse(-6, -4, 6, 8 + flutter * 2, 0.3, 0, Math.PI * 2);
            ctx.ellipse(6, -4, 6, 8 + flutter * 2, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#FFCDD2";
            ctx.beginPath();
            ctx.ellipse(-6, 4, 4, 5, 0.3, 0, Math.PI * 2);
            ctx.ellipse(6, 4, 4, 5, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#212121";
            ctx.fillRect(-0.5, -3, 1, 8);
        } else if (hz.type === "squirrel") {
            ctx.fillStyle = "#8D6E63";
            ctx.beginPath(); ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-7, -3, 4, 0, Math.PI * 2); ctx.fill();
            // Big tail
            ctx.strokeStyle = "#8D6E63";
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(7, 0); ctx.quadraticCurveTo(15, -10, 8, -14);
            ctx.stroke();
            // Acorn
            ctx.fillStyle = "#A0522D";
            ctx.beginPath(); ctx.arc(-9, -2, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#000";
            ctx.beginPath(); ctx.arc(-9, -4, 0.6, 0, Math.PI * 2); ctx.fill();
        } else if (hz.type === "kickball") {
            ctx.fillStyle = "#F44336";
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFCDD2";
            ctx.beginPath(); ctx.arc(-3, -3, 3, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#B71C1C";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.stroke();
        } else if (hz.type === "sprinkler") {
            // Sprinkler nozzle with water arcs
            ctx.fillStyle = "#37474F";
            roundRect(-4, 2, 8, 8, 2); ctx.fill();
            // Water spraying
            ctx.strokeStyle = "rgba(33,150,243,0.6)";
            ctx.lineWidth = 2;
            for (var ww = 0; ww < 8; ww++) {
                var wa = -Math.PI / 2 + (ww / 7 - 0.5) * Math.PI * 0.8;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(wa) * 18, Math.sin(wa) * 18);
                ctx.stroke();
            }
            ctx.fillStyle = "#4FC3F7";
            for (var dd = 0; dd < 5; dd++) {
                var da = -Math.PI / 2 + (dd / 4 - 0.5) * Math.PI * 0.8;
                ctx.beginPath();
                ctx.arc(Math.cos(da) * 14, Math.sin(da) * 14, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (hz.type === "hopscotch") {
            // Chalk grid drawn on sidewalk
            ctx.strokeStyle = "#FFC107";
            ctx.lineWidth = 2;
            ctx.strokeRect(-10, -14, 20, 28);
            ctx.beginPath();
            ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
            ctx.stroke();
            ctx.fillStyle = "#FFC107";
            ctx.font = "bold 10px Arial";
            ctx.textAlign = "center";
            ctx.fillText("1", 0, -5);
            ctx.fillText("2", 0, 11);
        } else if (hz.type === "greenblatt") {
            // Mrs. Greenblatt — crossing guard with stop sign
            // Shadow
            ctx.fillStyle = "rgba(0,0,0,0.25)";
            ctx.beginPath(); ctx.ellipse(0, 18, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
            // Body — yellow safety vest
            ctx.fillStyle = "#FBC02D";
            roundRect(-10, -4, 20, 18, 4); ctx.fill();
            ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 2;
            roundRect(-10, -4, 20, 18, 4); ctx.stroke();
            // Reflective stripes
            ctx.fillStyle = "#FFF59D";
            ctx.fillRect(-10, 1, 20, 2);
            ctx.fillRect(-10, 8, 20, 2);
            // Legs (dark)
            ctx.fillStyle = "#37474F";
            ctx.fillRect(-4, 14, 3, 8);
            ctx.fillRect(1, 14, 3, 8);
            // Shoes
            ctx.fillStyle = "#000";
            ctx.fillRect(-5, 21, 4, 2);
            ctx.fillRect(1, 21, 4, 2);
            // Head with chunky outline
            ctx.fillStyle = "#1A1A1A";
            ctx.beginPath(); ctx.arc(0, -11, 7.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFE0CC";
            ctx.beginPath(); ctx.arc(0, -11, 6.5, 0, Math.PI * 2); ctx.fill();
            // Sheitel / wig (grey-ish brown)
            ctx.fillStyle = "#6D4C41";
            ctx.beginPath(); ctx.arc(0, -14, 8, Math.PI, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.ellipse(-7, -12, 3, 6, -0.2, 0, Math.PI * 2);
            ctx.ellipse(7, -12, 3, 6, 0.2, 0, Math.PI * 2);
            ctx.fill();
            // Glasses
            ctx.strokeStyle = "#1A1A1A";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(-3, -11, 2, 0, Math.PI * 2);
            ctx.arc(3, -11, 2, 0, Math.PI * 2);
            ctx.moveTo(-1, -11); ctx.lineTo(1, -11);
            ctx.stroke();
            // Smile
            ctx.strokeStyle = "#A0394D";
            ctx.lineWidth = 1;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(0, -8, 2.2, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();
            ctx.lineCap = "butt";
            // STOP sign in hand
            ctx.save();
            ctx.translate(-14, -2);
            ctx.rotate(Math.sin(hz.walkTime * 2) * 0.15);
            ctx.fillStyle = "#5D4037";
            ctx.fillRect(-1, 0, 2, 12);
            ctx.fillStyle = "#D32F2F";
            ctx.beginPath();
            for (var sii = 0; sii < 8; sii++) {
                var sang = sii * Math.PI / 4 - Math.PI / 8;
                var sx = Math.cos(sang) * 7;
                var sy = Math.sin(sang) * 7;
                if (sii === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "#FFF";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = "#FFF";
            ctx.font = "bold 4px Arial";
            ctx.textAlign = "center";
            ctx.fillText("STOP", 0, 1);
            ctx.restore();
            // Speech bubble for "Hi mamaleh!"
            if (!hz.greeted && hz.y > 80 && hz.y < H - 100) {
                drawSpeechBubble(0, -28, "Hi mamaleh!", hz.walkTime);
            }
        } else if (hz.type === "cat") {
            // Mr. Whiskers napping
            ctx.fillStyle = "#FF7043";
            ctx.beginPath(); ctx.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-12, -2, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFAB91";
            ctx.beginPath(); ctx.ellipse(0, 2, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
            // Lazy eye
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(-12, -3, 1.5, 0.1 * Math.PI, 0.9 * Math.PI);
            ctx.stroke();
            // Tail
            ctx.strokeStyle = "#FF7043";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(13, 0); ctx.quadraticCurveTo(20, -4, 18, -8);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawDinaRun() {
        ctx.save();
        if (shakeTimer > 0) {
            ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        }
        // Background
        drawDinaSidewalkBg(dinaScrollY);

        // Hazards — with an approach-warning shadow so the player can react
        for (var h = 0; h < dinaSidewalk.length; h++) {
            var hzz = dinaSidewalk[h];
            // Telegraph: pulsing ground shadow once the hazard is on-screen but not yet reached
            if (!hzz.hit && hzz.y > 0 && hzz.y < dina.y - 30) {
                var warn = 0.35 + 0.25 * Math.sin(dinaRunTimer * 12);
                ctx.fillStyle = "rgba(0,0,0," + (warn * 0.4) + ")";
                ctx.beginPath();
                ctx.ellipse(hzz.x, hzz.y + hzz.r + 6, hzz.r + 4, (hzz.r + 4) * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            drawDinaSidewalkHazard(hzz);
        }

        // Home appears at 80% progress
        if (dinaRunDistance > 0.7) {
            // Distant home in upper area
            var alphaH = clamp((dinaRunDistance - 0.7) / 0.3, 0, 1);
            var homeY = -100 + alphaH * 200;
            ctx.save();
            ctx.globalAlpha = alphaH;
            // House body
            ctx.fillStyle = "#A1887F";
            roundRect(W / 2 - 70, homeY, 140, 90, 8); ctx.fill();
            ctx.strokeStyle = "#1A1A1A";
            ctx.lineWidth = 3;
            roundRect(W / 2 - 70, homeY, 140, 90, 8); ctx.stroke();
            // Roof
            ctx.fillStyle = "#5D4037";
            ctx.beginPath();
            ctx.moveTo(W / 2 - 80, homeY);
            ctx.lineTo(W / 2, homeY - 40);
            ctx.lineTo(W / 2 + 80, homeY);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            // Windows (lit warm yellow)
            ctx.fillStyle = "#FFE082";
            ctx.fillRect(W / 2 - 55, homeY + 18, 28, 28);
            ctx.fillRect(W / 2 + 27, homeY + 18, 28, 28);
            ctx.strokeRect(W / 2 - 55, homeY + 18, 28, 28);
            ctx.strokeRect(W / 2 + 27, homeY + 18, 28, 28);
            // Window cross panes
            ctx.beginPath();
            ctx.moveTo(W / 2 - 41, homeY + 18); ctx.lineTo(W / 2 - 41, homeY + 46);
            ctx.moveTo(W / 2 - 55, homeY + 32); ctx.lineTo(W / 2 - 27, homeY + 32);
            ctx.moveTo(W / 2 + 41, homeY + 18); ctx.lineTo(W / 2 + 41, homeY + 46);
            ctx.moveTo(W / 2 + 27, homeY + 32); ctx.lineTo(W / 2 + 55, homeY + 32);
            ctx.stroke();
            // Door
            ctx.fillStyle = "#3E2723";
            roundRect(W / 2 - 15, homeY + 50, 30, 40, 4); ctx.fill();
            roundRect(W / 2 - 15, homeY + 50, 30, 40, 4); ctx.stroke();
            ctx.fillStyle = "#FFEB3B";
            ctx.beginPath(); ctx.arc(W / 2 + 8, homeY + 72, 2, 0, Math.PI * 2); ctx.fill();
            // Welcome mat
            ctx.fillStyle = "#D32F2F";
            ctx.fillRect(W / 2 - 18, homeY + 88, 36, 5);
            ctx.strokeRect(W / 2 - 18, homeY + 88, 36, 5);
            // Sign "HOME"
            ctx.fillStyle = "#FFD700";
            roundRect(W / 2 - 30, homeY - 8, 60, 14, 4); ctx.fill();
            ctx.strokeStyle = "#5D4037";
            ctx.lineWidth = 2;
            roundRect(W / 2 - 30, homeY - 8, 60, 14, 4); ctx.stroke();
            drawText("HOME ♥", W / 2, homeY - 1, "bold 11px Arial", "#000", null, 0);
            ctx.restore();
        }

        // Mom (behind)
        if (mom) drawMomTopDown(mom.x, mom.y, mom.walkTime);

        // Dina
        if (dina) drawDinaTopDown(dina.x, dina.y, dina.walkTime, "up", "backpack");
        // Sprint-charge bar floating just under Dina — readable at a glance, no HUD glance needed
        if (dina) {
            var sFrac = clamp(dina.sprintTimer / 3, 0, 1);
            var sbW = 44, sbX = dina.x - sbW / 2, sbY = dina.y + 30;
            ctx.fillStyle = "rgba(0,0,0,0.35)";
            roundRect(sbX - 2, sbY - 2, sbW + 4, 9, 4); ctx.fill();
            // Color shifts green→amber→red as charge depletes
            var sCol = sFrac > 0.5 ? "#7CFC4F" : sFrac > 0.2 ? "#FFC107" : "#FF5252";
            ctx.fillStyle = sCol;
            roundRect(sbX, sbY, sbW * sFrac, 5, 3); ctx.fill();
            // Little bolt icon when full enough to use
            if (sFrac > 0.05 && keys.up) {
                ctx.fillStyle = "#FFEB3B";
                ctx.font = "11px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText("⚡", dina.x, sbY - 9);
            }
        }
        if (dina && dina.chatLife > 0) drawSpeechBubble(dina.x, dina.y - 60, dina.chat, dina.walkTime);

        // Mom proximity glow
        if (mom && mom.distance < 0.3) {
            var glow = (0.3 - mom.distance) / 0.3;
            ctx.fillStyle = "rgba(255, 200, 0, " + (glow * 0.25) + ")";
            ctx.fillRect(0, 0, W, H);
            // "!" bubble above Dina
            if (mom.distance < 0.15 && dina) {
                ctx.save();
                ctx.fillStyle = "#FFC107";
                ctx.beginPath();
                ctx.arc(dina.x + 18, dina.y - 28, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#000";
                ctx.font = "bold 12px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("!", dina.x + 18, dina.y - 27);
                ctx.restore();
            }
        }

        // Mom speech every once in a while
        if (mom && mom.sayTimer < 1) {
            var phrases = ["Dinaaaa!", "Wait up!", "Honey!", "Hold on!"];
            drawSpeechBubble(mom.x, mom.y - 25, phrases[mom.says], mom.walkTime);
        }

        ctx.restore(); // end shake transform — HUD/buttons stay rock-steady

        // HUD top: distance bar
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        roundRect(0, 0, W, 50, 0); ctx.fill();
        // Progress bar
        var barX = 60, barY = 18, barW = W - 120, barH = 14;
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        roundRect(barX, barY, barW, barH, 7); ctx.fill();
        ctx.fillStyle = "#FF4FA3";
        roundRect(barX, barY, barW * dinaRunDistance, barH, 7); ctx.fill();
        // House icon at end
        ctx.fillStyle = "#FFD700";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("🏠", W - 36, 28);
        // Dina icon at progress
        ctx.fillStyle = "#FFB0C8";
        ctx.beginPath();
        ctx.arc(barX + barW * dinaRunDistance, barY + barH / 2, 8, 0, Math.PI * 2);
        ctx.fill();

        // Stats
        drawText("⏱ " + Math.max(0, Math.ceil(DINA_RUN_DURATION - dinaRunTimer)) + "s",
            15, 18, "bold 13px Arial", "#FFD700", "#000", 2, "left");
        drawText("⚡ " + dina.sprintTimer.toFixed(1) + "s", 15, 36, "bold 12px Arial", "#FFEB3B", "#000", 2, "left");
        drawText("⭐ " + dinaStickers + "  $" + dinaCoinsRun, W - 80, 18,
            "bold 13px Arial", "#FFD700", "#000", 2, "left");
        // Run level (progressive difficulty) — centered under the bar
        drawText("Run #" + dinaRunLevel, W / 2, 40, "bold 12px Arial", "#FFFFFF", "#000", 2);

        // Sprint (⚡) + slow (🐢) buttons only — left/right is finger-drag now.
        // Hold one with a second finger while dragging Dina with the other.
        if (isTouchDevice) {
            drawIconButton(PARK_FWD_RECT.x, PARK_FWD_RECT.y, PARK_FWD_RECT.w, "⚡",
                { bg: keys.up ? "#FFEB3B" : "#FFC107", bgDark: "#FF6F00" });
            drawIconButton(PARK_REV_RECT.x, PARK_REV_RECT.y, PARK_REV_RECT.w, "🐢",
                { bg: keys.down ? "#FFEB3B" : "#90CAF9", bgDark: "#1565C0" });
            drawText("drag to move", W / 2, H - 16, "11px Arial", "#FFFFFF", "#000", 2);
        }
    }

    // ── Update / Draw: dinaCaught (ending) ───────────────────
    // Self-contained confetti for the home-arrival celebration (the global
    // particle system isn't ticked in this scene, so we run our own).
    var dinaConfetti = [];
    function spawnDinaConfetti() {
        dinaConfetti = [];
        var cols = ["#FF4FA3", "#FFD700", "#4FC3F7", "#7CFC4F", "#FF8A65", "#BA68C8"];
        for (var i = 0; i < 60; i++) {
            dinaConfetti.push({
                x: rand(0, W), y: rand(-H * 0.4, 0),
                vx: rand(-30, 30), vy: rand(40, 160),
                size: rand(4, 9), color: randPick(cols),
                rot: rand(0, Math.PI * 2), spin: rand(-6, 6)
            });
        }
    }
    function updateDinaCaught(dt) {
        dinaRunTimer += dt;
        for (var i = dinaConfetti.length - 1; i >= 0; i--) {
            var p = dinaConfetti[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
            p.vy += 60 * dt; // gentle gravity
            if (p.y > H + 20) dinaConfetti.splice(i, 1);
        }
        // Hold for 3 seconds, then go home
        if (dinaRunTimer > 3.5 || consumeClick() || consumeAction()) {
            dinaConfetti = [];
            enterDinaHome();
        }
    }

    function drawDinaCaught() {
        // Home porch scene
        ctx.fillStyle = "#FFB6D9";
        ctx.fillRect(0, 0, W, H * 0.4);
        ctx.fillStyle = "#7CB342";
        ctx.fillRect(0, H * 0.4, W, H * 0.6);
        // House
        ctx.fillStyle = "#A1887F";
        roundRect(W / 2 - 140, H * 0.18, 280, 280, 10); ctx.fill();
        ctx.fillStyle = "#5D4037";
        ctx.beginPath();
        ctx.moveTo(W / 2 - 160, H * 0.18);
        ctx.lineTo(W / 2, H * 0.05);
        ctx.lineTo(W / 2 + 160, H * 0.18);
        ctx.closePath(); ctx.fill();
        // Windows
        ctx.fillStyle = "#FFEB3B";
        roundRect(W / 2 - 100, H * 0.25, 50, 50, 4); ctx.fill();
        roundRect(W / 2 + 50, H * 0.25, 50, 50, 4); ctx.fill();
        // Door
        ctx.fillStyle = "#3E2723";
        roundRect(W / 2 - 30, H * 0.35, 60, 110, 6); ctx.fill();
        ctx.fillStyle = "#FFEB3B";
        ctx.beginPath(); ctx.arc(W / 2 + 20, H * 0.42, 3, 0, Math.PI * 2); ctx.fill();
        // Welcome mat
        ctx.fillStyle = "#D32F2F";
        ctx.fillRect(W / 2 - 40, H * 0.45 + 1, 80, 14);
        drawText("WELCOME", W / 2, H * 0.45 + 8, "bold 9px Arial", "#FFEB3B", null, 0);

        // Dina at the porch
        var dinaX = W / 2, dinaY = H * 0.6;
        // Victory jump on the "ran" ending — a few cheerful hops that settle.
        var jump = 0;
        if (dinaEnding === "ran") {
            jump = Math.abs(Math.sin(dinaRunTimer * 6)) * 22 * Math.max(0, 1 - dinaRunTimer / 2.2);
        }
        // Pose: hands on hips if "ran", waving if "walked"
        ctx.save();
        ctx.translate(dinaX, dinaY - jump);
        // Use a larger version for the cutscene
        ctx.scale(2.5, 2.5);
        drawDinaTopDown(0, 0, dinaRunTimer * 4, "down", "backpack");
        ctx.restore();
        // Mom in scene
        if (dinaEnding === "walked") {
            var momX = dinaX - 60, momY = dinaY - 10;
            ctx.save();
            ctx.translate(momX, momY);
            ctx.scale(2.5, 2.5);
            drawMomTopDown(0, 0, dinaRunTimer * 5);
            ctx.restore();
            // Holding hands hint
            ctx.strokeStyle = "#FFD700";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(momX + 20, momY + 20);
            ctx.lineTo(dinaX - 20, dinaY + 20);
            ctx.stroke();
        }

        // Speech bubble
        var msg;
        if (dinaEnding === "ran") {
            msg = "I BEAT YOU,\nMOM!";
        } else {
            msg = "Fine,\nlet's walk\ntogether.";
        }
        drawSpeechBubble(dinaX, dinaY - 90, msg, dinaRunTimer * 4);

        // Result text top
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(40, 30, W - 80, 50, 12); ctx.fill();
        drawText(dinaEnding === "ran" ? "YOU MADE IT HOME! 🏆" : "MOM CAUGHT UP! 🤗",
            W / 2, 56, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);

        // Rewards banked into the shared bank (carries over to Lulu's world)
        var bonusStr = dinaRunWinBonus > 0 ? "  (+" + dinaRunWinBonus + " win bonus!)" : "";
        drawText("Banked: ⭐ " + dinaRunBankedStars + "   💰 " + dinaRunBankedCoins + bonusStr, W / 2, H - 76,
            "bold 16px Arial", "#FFD700", "#000", 3);
        drawText("Added to your bank: " + formatNum(save.totalCoins) + " 💰", W / 2, H - 52,
            "bold 13px Arial", "#FFF8E1", "#000", 2);
        drawText("Tap to enter home", W / 2, H - 26, "14px Arial", "#FFFFFF", "#000", 2);

        // Confetti celebration (on top of everything)
        for (var ci = 0; ci < dinaConfetti.length; ci++) {
            var cp = dinaConfetti[ci];
            ctx.save();
            ctx.translate(cp.x, cp.y);
            ctx.rotate(cp.rot);
            ctx.fillStyle = cp.color;
            ctx.fillRect(-cp.size / 2, -cp.size / 2, cp.size, cp.size * 0.6);
            ctx.restore();
        }
    }

    function enterDinaHome() {
        save.totalCoins += dinaCoinsRun;
        persistSave();
        state = "dinaHome";
        dinaHome = { x: 240, y: 600, walkTime: 0, facing: "down", hover: null };
        homeMessageTimer = 0;
        dinaRunTimer = 0; // reset for star pulse / nap / morgan timers
    }

    // ── Update / Draw: Dina Home Interior ────────────────────
    // Bedroom items — no overlapping rects. Door on left wall, bed bottom-right.
    // ORDER MATTERS — items checked top-to-bottom. tablet must be before bed.
    var HOME_OBJECTS = {
        tablet:  { x: 230, y: 510, w: 60, h: 44,  label: "Play Lulu's game?",   action: "tablet" },
        morgan:  { x: 30,  y: 540, w: 64, h: 70,  label: "Play with Morgan?",   action: "morgan" },
        snacks:  { x: 130, y: 510, w: 60, h: 50,  label: "Cookie & milk!",      action: "snack" },
        sticker: { x: 320, y: 510, w: 70, h: 60,  label: "Sticker book?",       action: "stickers" },
        bed:     { x: 280, y: 320, w: 180, h: 160, label: "Take a nap?",        action: "nap" },
        door:    { x: 8,   y: 90,  w: 70, h: 130, label: "Go back outside?",    action: "outside" }
    };

    function updateDinaHome(dt) {
        if (!dinaHome) dinaHome = { x: 240, y: 600, walkTime: 0, facing: "down" };
        var speed = 100;
        var dx = 0, dy = 0;
        if (keys.left) dx -= 1;
        if (keys.right) dx += 1;
        if (keys.up) dy -= 1;
        if (keys.down) dy += 1;
        // Touch: drag anywhere and Dina walks toward your finger (no D-pad).
        if (touchX !== null && touchY !== null) {
            var fdx = touchX - dinaHome.x, fdy = touchY - dinaHome.y;
            if (Math.sqrt(fdx * fdx + fdy * fdy) > 8) { dx = fdx; dy = fdy; }
        }
        if (dx || dy) {
            var len = Math.sqrt(dx * dx + dy * dy);
            dx /= len; dy /= len;
            dinaHome.x = clamp(dinaHome.x + dx * speed * dt, 30, W - 30);
            dinaHome.y = clamp(dinaHome.y + dy * speed * dt, 250, H - 30);
            dinaHome.walkTime += dt;
            dinaHome.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
        }

        // Check overlap with interactive objects
        var closest = null, closestDist = 999999;
        for (var k in HOME_OBJECTS) {
            var o = HOME_OBJECTS[k];
            var ox = o.x + o.w / 2;
            var oy = o.y + o.h / 2;
            var dd = (dinaHome.x - ox) * (dinaHome.x - ox) + (dinaHome.y - oy) * (dinaHome.y - oy);
            if (dd < (o.w / 2 + 30) * (o.w / 2 + 30) && dd < closestDist) {
                closestDist = dd;
                closest = o;
            }
        }
        dinaHome.hover = closest;

        // Keyboard Space/Enter activates the nearest object (desktop affordance).
        // Touch deliberately does NOT proximity-activate — otherwise simply
        // starting a drag near the bed would fire the nap. Touch uses the
        // precise tap-on-object check below instead.
        if (closest && !isTouchDevice && (consumeAction() || consumeHomeInteract())) {
            triggerHomeInteract(closest.action);
        }
        // Tap on object directly
        var click = consumeClick();
        if (click) {
            for (var k2 in HOME_OBJECTS) {
                var o2 = HOME_OBJECTS[k2];
                if (pointInRect(click.x, click.y, o2.x, o2.y, o2.w, o2.h)) {
                    // clear the queued action from this same tap so it doesn't
                    // leak into (and instantly re-trigger something in) the next scene
                    consumeAction();
                    triggerHomeInteract(o2.action);
                    return;
                }
            }
        }

        if (homeMessageTimer > 0) homeMessageTimer -= dt;
    }

    var lastHomeInteractKey = false;
    function consumeHomeInteract() {
        // Space on keyboard is consumed by consumeAction already
        return false;
    }

    function triggerHomeInteract(action) {
        if (action === "morgan") {
            state = "dinaMorgan";
            morganHappy = 0;
            morganPetSpot = null;
            morganTimer = 0;
            morganMood = "calm";
            morganCelebrateT = 0;
            morganStarAwarded = false;
            playTone(600, 0.1, "triangle", 0.2);
        } else if (action === "tablet") {
            inTabletMode = true;
            resetGame();
            state = "playing";
            playTone(880, 0.08, "sine", 0.18);
        } else if (action === "nap") {
            state = "dinaNap";
            dinaRunTimer = 0;
        } else if (action === "snack") {
            // Cookie & milk now opens the Cookie Catch minigame (costs coins to play).
            if (save.totalCoins < COOKIE_FEE) {
                homeMessage = "Need 💰" + COOKIE_FEE + " to play Cookie Catch";
                homeMessageTimer = 1.8;
                playDeny();
            } else {
                startCookieCatch();
            }
        } else if (action === "stickers") {
            // Open the interactive sticker book minigame
            startStickerBook();
        } else if (action === "outside") {
            state = "charSelect";
            inTabletMode = false;
        }
    }

    function drawDinaHome() {
        // Wall (cream)
        ctx.fillStyle = "#FFE8C8";
        ctx.fillRect(0, 0, W, 280);
        // Wallpaper polka-dot pattern (subtle pink)
        ctx.fillStyle = "rgba(255,180,200,0.28)";
        for (var wy = 20; wy < 260; wy += 40) {
            for (var wx = (wy % 80 === 0 ? 20 : 50); wx < W; wx += 60) {
                ctx.beginPath(); ctx.arc(wx, wy, 4, 0, Math.PI * 2); ctx.fill();
            }
        }
        // Baseboard (white strip with dark line)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 268, W, 12);
        ctx.fillStyle = "#1A1A1A";
        ctx.fillRect(0, 280, W, 2);
        // Floor (honey wood) — start below baseboard
        ctx.fillStyle = "#E8B872";
        ctx.fillRect(0, 282, W, H - 282);
        // Wood grain lines (batched single path)
        ctx.strokeStyle = "#C99A50";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var fy = 300; fy < H; fy += 30) {
            ctx.moveTo(0, fy); ctx.lineTo(W, fy);
        }
        ctx.stroke();

        // Window with sky + curtains
        ctx.fillStyle = "#A8D8F0";
        roundRect(60, 70, 120, 130, 6); ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 5;
        roundRect(60, 70, 120, 130, 6); ctx.stroke();
        // Window cross
        ctx.beginPath();
        ctx.moveTo(120, 70); ctx.lineTo(120, 200);
        ctx.moveTo(60, 135); ctx.lineTo(180, 135);
        ctx.stroke();
        // Sun in window
        ctx.fillStyle = "#FFD54F";
        ctx.beginPath(); ctx.arc(95, 100, 16, 0, Math.PI * 2); ctx.fill();
        // Curtains
        ctx.fillStyle = "#B8E0D2";
        roundRect(40, 60, 22, 150, 4); ctx.fill();
        roundRect(180, 60, 22, 150, 4); ctx.fill();
        // Sunbeam on floor
        ctx.fillStyle = "rgba(255,235,150,0.4)";
        ctx.beginPath();
        ctx.moveTo(60, 280); ctx.lineTo(180, 280); ctx.lineTo(200, 500); ctx.lineTo(40, 500);
        ctx.closePath(); ctx.fill();

        // Poster (BE BRAVE)
        ctx.fillStyle = "#FFFFFF";
        roundRect(220, 50, 80, 100, 4); ctx.fill();
        ctx.strokeStyle = "#5D4037";
        ctx.lineWidth = 3;
        roundRect(220, 50, 80, 100, 4); ctx.stroke();
        // Fox icon
        ctx.fillStyle = "#FF7043";
        ctx.beginPath(); ctx.arc(260, 95, 20, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(245, 78); ctx.lineTo(252, 70); ctx.lineTo(258, 80); ctx.closePath();
        ctx.moveTo(275, 78); ctx.lineTo(268, 70); ctx.lineTo(262, 80); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(254, 92, 2, 0, Math.PI * 2);
        ctx.arc(266, 92, 2, 0, Math.PI * 2);
        ctx.fill();
        drawText("BE BRAVE", 260, 130, "bold 11px Arial", "#5D4037", null, 0);

        // Glow-in-dark stars on ceiling
        var pulseTime = (dinaHome ? dinaHome.walkTime : 0) + dinaRunTimer;
        ctx.fillStyle = "#FFEE58";
        var stars = [[15, 20], [320, 30], [430, 25], [40, 250], [400, 245]];
        for (var st = 0; st < stars.length; st++) {
            var op = 0.5 + 0.5 * Math.sin(pulseTime * 2 + st);
            ctx.globalAlpha = op;
            drawText("★", stars[st][0], stars[st][1], "bold 14px Arial", "#FFEE58", null, 0);
        }
        ctx.globalAlpha = 1;

        // ─── DOOR on left wall (upper area) ───
        var dr = HOME_OBJECTS.door;
        // Doorway frame (darker recess in wall)
        ctx.fillStyle = "#8D6E63";
        roundRect(dr.x - 4, dr.y - 4, dr.w + 8, dr.h + 8, 6); ctx.fill();
        // Door
        ctx.fillStyle = "#FFFFFF";
        roundRect(dr.x, dr.y, dr.w, dr.h, 4); ctx.fill();
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 3;
        roundRect(dr.x, dr.y, dr.w, dr.h, 4); ctx.stroke();
        // Door panels
        ctx.strokeStyle = "#BDBDBD";
        ctx.lineWidth = 1.5;
        roundRect(dr.x + 6, dr.y + 10, dr.w - 12, 50, 3); ctx.stroke();
        roundRect(dr.x + 6, dr.y + 70, dr.w - 12, 50, 3); ctx.stroke();
        // Pink doorknob
        ctx.fillStyle = "#FF4FA3";
        ctx.beginPath(); ctx.arc(dr.x + dr.w - 12, dr.y + dr.h / 2, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
        // "Dina's Room" sign above door
        ctx.fillStyle = "#FFD54F";
        roundRect(dr.x - 4, dr.y - 24, dr.w + 8, 18, 4); ctx.fill();
        ctx.strokeStyle = "#5D4037"; ctx.lineWidth = 2;
        roundRect(dr.x - 4, dr.y - 24, dr.w + 8, 18, 4); ctx.stroke();
        drawText("DINA'S ROOM", dr.x + dr.w / 2, dr.y - 15, "bold 10px Arial", "#5D4037", null, 0);

        // ─── CRAYON DRAWING on wall (next to door, safely away from bed) ───
        ctx.fillStyle = "#FFF59D";
        roundRect(95, 100, 60, 60, 2); ctx.fill();
        ctx.strokeStyle = "#5D4037";
        ctx.lineWidth = 1.5;
        roundRect(95, 100, 60, 60, 2); ctx.stroke();
        // tape strip
        ctx.fillStyle = "rgba(255,200,150,0.6)";
        roundRect(110, 94, 30, 8, 1); ctx.fill();
        // Stick figures (mom + dina holding hands)
        ctx.strokeStyle = "#F44336"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(112, 122, 3, 0, Math.PI * 2);
        ctx.moveTo(112, 125); ctx.lineTo(112, 138);
        ctx.moveTo(108, 130); ctx.lineTo(125, 130); // arm reaching to Dina
        ctx.moveTo(112, 138); ctx.lineTo(108, 148);
        ctx.moveTo(112, 138); ctx.lineTo(116, 148);
        ctx.stroke();
        ctx.strokeStyle = "#3F51B5"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(135, 127, 3, 0, Math.PI * 2);
        ctx.moveTo(135, 130); ctx.lineTo(135, 142);
        ctx.moveTo(125, 134); ctx.lineTo(140, 134);
        ctx.moveTo(135, 142); ctx.lineTo(131, 150);
        ctx.moveTo(135, 142); ctx.lineTo(139, 150);
        ctx.stroke();
        ctx.fillStyle = "#F44336";
        drawText("♥", 123, 119, "bold 10px Arial", "#F44336", null, 0);

        // ─── BED (right side, big & cozy) ───
        var b = HOME_OBJECTS.bed;
        // Bed frame outline
        ctx.fillStyle = "#5D4037";
        roundRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8, 10); ctx.fill();
        // Mattress pink quilt
        ctx.fillStyle = "#F4A4B8";
        roundRect(b.x, b.y, b.w, b.h, 8); ctx.fill();
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 2.5;
        roundRect(b.x, b.y, b.w, b.h, 8); ctx.stroke();
        // Quilt patches (batched)
        ctx.strokeStyle = "#E091A6";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (var qx = b.x + 30; qx < b.x + b.w; qx += 40) {
            ctx.moveTo(qx, b.y + 6); ctx.lineTo(qx, b.y + b.h - 6);
        }
        for (var qy = b.y + 40; qy < b.y + b.h - 6; qy += 40) {
            ctx.moveTo(b.x + 6, qy); ctx.lineTo(b.x + b.w - 6, qy);
        }
        ctx.stroke();
        // Pillow
        ctx.fillStyle = "#FFFFFF";
        roundRect(b.x + 12, b.y + 12, b.w - 24, 38, 8); ctx.fill();
        ctx.strokeStyle = "#BDBDBD";
        ctx.lineWidth = 1.5;
        roundRect(b.x + 12, b.y + 12, b.w - 24, 38, 8); ctx.stroke();
        // Mint blanket folded at foot
        ctx.fillStyle = "#B8E0D2";
        roundRect(b.x + 4, b.y + b.h - 32, b.w - 8, 28, 6); ctx.fill();
        ctx.strokeStyle = "#1A1A1A";
        ctx.lineWidth = 2;
        roundRect(b.x + 4, b.y + b.h - 32, b.w - 8, 28, 6); ctx.stroke();
        // Little teddy on pillow
        ctx.fillStyle = "#A1887F";
        ctx.beginPath(); ctx.arc(b.x + 28, b.y + 28, 8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(b.x + 22, b.y + 22, 3, 0, Math.PI * 2);
        ctx.arc(b.x + 34, b.y + 22, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(b.x + 25, b.y + 27, 0.8, 0, Math.PI * 2);
        ctx.arc(b.x + 31, b.y + 27, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // ─── RUG (lower-center, big) ───
        ctx.fillStyle = "#FFE8C8";
        ctx.beginPath();
        ctx.ellipse(W / 2, H * 0.84, 200, 60, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#B8E0D2";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(W / 2, H * 0.84, 180, 50, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#F4A4B8";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(W / 2, H * 0.84, 150, 38, 0, 0, Math.PI * 2);
        ctx.stroke();

        // ─── MORGAN PLUSHIE (bottom-left, on floor) ───
        var mo = HOME_OBJECTS.morgan;
        ctx.save();
        ctx.translate(mo.x + 32, mo.y + 38);
        ctx.scale(0.7, 0.7);
        // Outline
        ctx.fillStyle = "#5D4350";
        ctx.beginPath(); ctx.ellipse(0, 14, 36, 30, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -16, 26, 0, Math.PI * 2); ctx.fill();
        // Body
        ctx.fillStyle = "#9B8FB4";
        ctx.beginPath(); ctx.ellipse(0, 14, 32, 26, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -16, 22, 0, Math.PI * 2); ctx.fill();
        // Ears
        ctx.beginPath();
        ctx.moveTo(-20, -28); ctx.lineTo(-10, -42); ctx.lineTo(-2, -30); ctx.closePath();
        ctx.moveTo(2, -30); ctx.lineTo(10, -42); ctx.lineTo(20, -28); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FFB8D9";
        ctx.beginPath();
        ctx.moveTo(-15, -32); ctx.lineTo(-10, -38); ctx.lineTo(-5, -31); ctx.closePath();
        ctx.moveTo(5, -31); ctx.lineTo(10, -38); ctx.lineTo(15, -32); ctx.closePath();
        ctx.fill();
        // Eyes (closed happy arcs)
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(-8, -15, 4, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.arc(8, -15, 4, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.stroke();
        ctx.lineCap = "butt";
        // Nose + mouth
        ctx.fillStyle = "#FF8AAA";
        ctx.beginPath();
        ctx.moveTo(-3, -8); ctx.lineTo(3, -8); ctx.lineTo(0, -5); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -5); ctx.quadraticCurveTo(-2, -3, -4, -4);
        ctx.moveTo(0, -5); ctx.quadraticCurveTo(2, -3, 4, -4);
        ctx.stroke();
        // Heart on chest
        ctx.fillStyle = "#FF6B9D";
        ctx.beginPath(); ctx.arc(-3, 12, 3, 0, Math.PI * 2);
        ctx.arc(3, 12, 3, 0, Math.PI * 2);
        ctx.moveTo(-5, 12); ctx.lineTo(0, 20); ctx.lineTo(5, 12);
        ctx.fill();
        ctx.restore();

        // ─── COOKIE + MILK on a small side table ───
        var sn = HOME_OBJECTS.snacks;
        // Table top
        ctx.fillStyle = "#A1887F";
        roundRect(sn.x - 4, sn.y + 32, sn.w + 8, 18, 4); ctx.fill();
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 2;
        roundRect(sn.x - 4, sn.y + 32, sn.w + 8, 18, 4); ctx.stroke();
        // Table legs
        ctx.fillStyle = "#8D6E63";
        ctx.fillRect(sn.x, sn.y + 50, 4, 16);
        ctx.fillRect(sn.x + sn.w - 4, sn.y + 50, 4, 16);
        // Cookie
        ctx.fillStyle = "#FFA726";
        ctx.beginPath(); ctx.arc(sn.x + 18, sn.y + 28, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 2;
        ctx.stroke();
        // Chocolate chips
        ctx.fillStyle = "#3E2723";
        ctx.beginPath();
        ctx.arc(sn.x + 14, sn.y + 24, 1.5, 0, Math.PI * 2);
        ctx.arc(sn.x + 21, sn.y + 27, 1.5, 0, Math.PI * 2);
        ctx.arc(sn.x + 16, sn.y + 31, 1.5, 0, Math.PI * 2);
        ctx.arc(sn.x + 22, sn.y + 33, 1.5, 0, Math.PI * 2);
        ctx.fill();
        // Milk glass
        ctx.fillStyle = "#FAFAFA";
        roundRect(sn.x + 36, sn.y + 18, 16, 28, 3); ctx.fill();
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 2;
        roundRect(sn.x + 36, sn.y + 18, 16, 28, 3); ctx.stroke();
        // Milk surface
        ctx.fillStyle = "#E3F2FD";
        roundRect(sn.x + 38, sn.y + 22, 12, 4, 1); ctx.fill();

        // ─── TABLET (free-standing, no longer on bed) ───
        var tb = HOME_OBJECTS.tablet;
        ctx.fillStyle = "#212121";
        roundRect(tb.x - 2, tb.y - 2, tb.w + 4, tb.h + 4, 5); ctx.fill();
        ctx.fillStyle = "#37474F";
        roundRect(tb.x, tb.y, tb.w, tb.h, 4); ctx.fill();
        // Screen with mini Lulu game preview
        ctx.fillStyle = "#7CCB7E"; // green road
        roundRect(tb.x + 4, tb.y + 4, tb.w - 8, tb.h - 8, 3); ctx.fill();
        ctx.fillStyle = "#6B7B8D"; // road strip
        ctx.fillRect(tb.x + 18, tb.y + 6, 24, tb.h - 12);
        ctx.fillStyle = "#E91E63"; // tiny Lulu car
        roundRect(tb.x + 24, tb.y + tb.h - 18, 12, 12, 2); ctx.fill();
        // Tablet stand
        ctx.fillStyle = "#5D4037";
        roundRect(tb.x + tb.w / 2 - 12, tb.y + tb.h, 24, 4, 2); ctx.fill();
        // "LULU" label below
        drawText("Lulu game", tb.x + tb.w / 2, tb.y + tb.h + 14, "bold 10px Arial", "#FFD700", "#000", 2);

        // ─── STICKER BOOK (bottom-right) ───
        var sb = HOME_OBJECTS.sticker;
        ctx.fillStyle = "#1A1A1A";
        roundRect(sb.x - 2, sb.y - 2, sb.w + 4, sb.h + 4, 4); ctx.fill();
        ctx.fillStyle = "#FFC107";
        roundRect(sb.x, sb.y, sb.w, sb.h, 3); ctx.fill();
        ctx.fillStyle = "#FF9800";
        roundRect(sb.x + 4, sb.y + 4, sb.w - 8, 14, 2); ctx.fill();
        drawText("STICKERS", sb.x + sb.w / 2, sb.y + 11, "bold 9px Arial", "#FFF", null, 0);
        // Cute stickers visible
        ctx.fillStyle = "#FF80AB";
        ctx.beginPath(); ctx.arc(sb.x + 14, sb.y + 30, 5, 0, Math.PI * 2); ctx.fill();
        drawText("♥", sb.x + 14, sb.y + 32, "bold 7px Arial", "#FFF", null, 0);
        ctx.fillStyle = "#81C784";
        ctx.beginPath(); ctx.arc(sb.x + 30, sb.y + 35, 5, 0, Math.PI * 2); ctx.fill();
        drawText("★", sb.x + 30, sb.y + 37, "bold 7px Arial", "#FFF", null, 0);
        ctx.fillStyle = "#64B5F6";
        ctx.beginPath(); ctx.arc(sb.x + 50, sb.y + 28, 5, 0, Math.PI * 2); ctx.fill();
        drawText("☺", sb.x + 50, sb.y + 30, "bold 7px Arial", "#FFF", null, 0);

        // ─── DINA herself ───
        drawDinaTopDown(dinaHome.x, dinaHome.y, dinaHome.walkTime, dinaHome.facing, "morgan");

        // ─── Hover label for interactive objects ───
        if (dinaHome.hover) {
            var o = dinaHome.hover;
            var lx = o.x + o.w / 2;
            var ly = o.y - 18;
            drawSpeechBubble(lx, ly, o.label, dinaHome.walkTime);
            drawText("[TAP]", lx, ly + 16, "bold 11px Arial", "#FFD700", "#000", 2);
        }

        // ─── Home message banner ───
        if (homeMessageTimer > 0) {
            var alpHM = clamp(homeMessageTimer / 1.5, 0, 1);
            ctx.fillStyle = "rgba(0,0,0," + (0.7 * alpHM) + ")";
            roundRect(W / 2 - 140, 50, 280, 36, 10); ctx.fill();
            ctx.globalAlpha = alpHM;
            drawText(homeMessage, W / 2, 68, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 3);
            ctx.globalAlpha = 1;
        }

        // ─── HUD top bar ───
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(0, 0, W, 40, 0); ctx.fill();
        drawText("🏠 Dina's Bedroom", W / 2, 20,
            "bold 13px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#000", 3);
        drawText("⭐ " + (save.parkingTotalStars || 0) + "  💰 " + formatNum(save.totalCoins), 12, 20,
            "bold 12px Arial", "#FFD700", "#000", 2, "left");
        drawText("Mom: kitchen", W - 12, 20, "bold 11px Arial", "#B8E0D2", "#000", 2, "right");

        // ─── Footer hint ───
        drawText(isTouchDevice ? "Drag to walk · tap an item to interact"
                               : "Arrow keys to walk · click an item to interact",
            W / 2, H - 110, "11px Arial", "#FFFFFF", "#000", 2);
    }

    // ── Update / Draw: Morgan Cat Plushie ────────────────────
    var morganSparkles = [];
    var morganCelebrateT = 0;        // time since hitting 100%, drives auto-exit
    var morganStarAwarded = false;   // guards against farming the star by re-petting
    function updateDinaMorgan(dt) {
        morganTimer += dt;
        // Move pet spot occasionally (chin not reachable; removed per QA)
        if (!morganPetSpot || morganPetSpot.t <= 0) {
            var zones = ["head", "back", "belly"];
            var z = randPick(zones);
            morganPetSpot = { zone: z, t: 4 };
        }
        morganPetSpot.t -= dt;

        var click = consumeClick();
        if (click) {
            // Check exit button — generous hitbox covering button + "BACK" label below
            if (pointInRect(click.x, click.y, 10, 70, 80, 80)) {
                state = "dinaHome";
                // clear any leftover queued tap/action so we don't instantly
                // re-trigger Morgan (Dina is still standing on the plushie)
                consumeAction();
                clickQueue = null;
                playClick();
                return;
            }
            // Detect zone clicked
            var dx = click.x - 240;
            var dy = click.y - 480;
            // Head area (y < -50 relative)
            var hit = null;
            if (dy < -50 && Math.abs(dx) < 80) hit = "head";
            else if (dy >= -50 && dy < 50 && Math.abs(dx) < 90) hit = "back";
            else if (dy >= 50 && dy < 140 && Math.abs(dx) < 90) hit = "belly";
            if (hit) {
                var gain = (hit === "belly") ? 15 : (hit === morganPetSpot.zone ? 10 : 5);
                morganHappy = Math.min(100, morganHappy + gain);
                spawnMorganHearts(click.x, click.y, hit === "belly" ? 8 : 3);
                playTone(hit === "belly" ? 700 : 1000, 0.08, "sine", 0.16);
                morganMood = "happy";
                setTimeout(function () { if (morganMood === "happy") morganMood = "calm"; }, 700);
            }
        }
        // Update hearts
        for (var hh = morganHearts.length - 1; hh >= 0; hh--) {
            var heart = morganHearts[hh];
            heart.life -= dt;
            heart.y -= 40 * dt;
            heart.x += Math.sin(heart.life * 4) * 0.5;
            if (heart.life <= 0) morganHearts.splice(hh, 1);
        }
        // 100% celebration — award the star only ONCE per visit (no farming by
        // re-petting), then auto-return home so there's a clean finish.
        if (morganHappy >= 100 && morganMood !== "celebrate") {
            morganMood = "celebrate";
            morganCelebrateT = 0;
            if (!morganStarAwarded) {
                morganStarAwarded = true;
                save.parkingTotalStars += 1;
                persistSave();
            }
            playTone(523, 0.1, "triangle", 0.2);
            setTimeout(function () { playTone(659, 0.1, "triangle", 0.2); }, 100);
            setTimeout(function () { playTone(784, 0.12, "triangle", 0.22); }, 200);
            setTimeout(function () { playTone(1046, 0.18, "triangle", 0.22); }, 300);
        }
        if (morganMood === "celebrate") {
            morganCelebrateT += dt;
            // Let the player soak the moment, then drift back to the bedroom.
            if (morganCelebrateT > 2.8) { state = "dinaHome"; consumeAction(); clickQueue = null; }
        }
    }

    function spawnMorganHearts(x, y, n) {
        for (var i = 0; i < n; i++) {
            morganHearts.push({
                x: x + rand(-15, 15), y: y,
                life: 1.2,
                color: randPick(["#FF6B9D", "#FF80AB", "#E91E63"])
            });
        }
    }

    function drawDinaMorgan() {
        // Cozy background
        ctx.fillStyle = "#FFF4E0";
        ctx.fillRect(0, 0, W, H);
        // Soft pink blanket
        ctx.fillStyle = "#FFD4E5";
        ctx.fillRect(0, H * 0.55, W, H * 0.45);
        ctx.fillStyle = "#F5A8C8";
        for (var f = 0; f < W; f += 60) {
            ctx.beginPath();
            ctx.ellipse(f, H * 0.55, 30, 10, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Happiness bar at top
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        roundRect(0, 0, W, 60, 0); ctx.fill();
        ctx.fillStyle = "#E8D4F0";
        roundRect(40, 22, W - 80, 22, 11); ctx.fill();
        ctx.fillStyle = "#FF8FB8";
        roundRect(42, 24, (W - 84) * (morganHappy / 100), 18, 9); ctx.fill();
        drawText("♥ " + Math.floor(morganHappy) + "%", W / 2, 33,
            "bold 13px Arial", "#FFFFFF", "#000", 3);
        drawText("Morgan's Happiness", W / 2, 12, "bold 10px Arial", "#FFD700", "#000", 2);

        // Back button (matches click hitbox)
        drawIconButton(20, 80, 48, "◀", { bg: "#A8E6CF", bgDark: "#388E3C" });
        drawText("BACK", 44, 138, "bold 11px Arial", "#FFFFFF", "#000", 2);

        // Morgan plushie (BIG)
        ctx.save();
        ctx.translate(240, 480);
        var bounce = morganMood === "happy" ? Math.sin(morganTimer * 30) * 2 : 0;
        var celebrate = morganMood === "celebrate";
        if (celebrate) bounce += Math.abs(Math.sin(morganTimer * 8)) * -10;
        ctx.translate(0, bounce);
        // Body
        ctx.fillStyle = "#9B8FB4";
        ctx.beginPath();
        ctx.ellipse(0, 40, 90, 100, 0, 0, Math.PI * 2);
        ctx.fill();
        // Belly
        ctx.fillStyle = "#D4C9E8";
        ctx.beginPath();
        ctx.ellipse(0, 80, 60, 50, 0, 0, Math.PI * 2);
        ctx.fill();
        // Stitching
        ctx.strokeStyle = "#7A6FA0";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, 30); ctx.lineTo(0, 140);
        ctx.stroke();
        ctx.setLineDash([]);
        // Paws
        ctx.fillStyle = "#9B8FB4";
        ctx.beginPath(); ctx.ellipse(-35, 120, 25, 18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(35, 120, 25, 18, 0, 0, Math.PI * 2); ctx.fill();
        // Tail (wrapping right)
        ctx.beginPath();
        ctx.ellipse(85, 80, 15, 35, -0.4, 0, Math.PI * 2);
        ctx.fill();
        // Head
        ctx.fillStyle = "#9B8FB4";
        ctx.beginPath(); ctx.arc(0, -60, 80, 0, Math.PI * 2); ctx.fill();
        // Ears
        ctx.beginPath();
        ctx.moveTo(-60, -100); ctx.lineTo(-40, -150); ctx.lineTo(-15, -100);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(15, -100); ctx.lineTo(40, -150); ctx.lineTo(60, -100);
        ctx.closePath(); ctx.fill();
        // Inner ears
        ctx.fillStyle = "#FFB8D9";
        ctx.beginPath();
        ctx.moveTo(-50, -110); ctx.lineTo(-40, -135); ctx.lineTo(-25, -105);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(25, -105); ctx.lineTo(40, -135); ctx.lineTo(50, -110);
        ctx.closePath(); ctx.fill();
        // Cheeks
        ctx.fillStyle = "#FFAACC";
        ctx.beginPath(); ctx.arc(-50, -40, 14, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(50, -40, 14, 0, Math.PI * 2); ctx.fill();

        // Eyes (based on mood)
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        if (morganMood === "happy" || celebrate) {
            ctx.beginPath();
            ctx.arc(-28, -60, 12, 1.1 * Math.PI, 1.9 * Math.PI);
            ctx.arc(28, -60, 12, 1.1 * Math.PI, 1.9 * Math.PI);
            ctx.stroke();
        } else {
            ctx.fillStyle = "#2A2438";
            ctx.beginPath();
            ctx.ellipse(-28, -60, 8, 11, 0, 0, Math.PI * 2);
            ctx.ellipse(28, -60, 8, 11, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(-26, -64, 3, 0, Math.PI * 2);
            ctx.arc(30, -64, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.lineCap = "butt";

        // Nose
        ctx.fillStyle = "#E88AAA";
        ctx.beginPath();
        ctx.moveTo(-6, -30); ctx.lineTo(6, -30); ctx.lineTo(0, -24);
        ctx.closePath(); ctx.fill();
        // Mouth
        ctx.strokeStyle = "#A0394D";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.quadraticCurveTo(-4, -20, -6, -22);
        ctx.moveTo(0, -24);
        ctx.quadraticCurveTo(4, -20, 6, -22);
        ctx.stroke();

        // Highlight on pet spot + a clear "Pet here!" label so the rotating
        // sweet-spot mechanic is obvious instead of trial-and-error.
        if (morganPetSpot && morganMood === "calm") {
            var pulse = 0.5 + 0.3 * Math.sin(morganTimer * 5);
            ctx.strokeStyle = "rgba(255, 215, 0, " + pulse + ")";
            ctx.lineWidth = 3;
            var psx = 0, psy = 0;
            if (morganPetSpot.zone === "head") { psx = 0; psy = -60; }
            else if (morganPetSpot.zone === "back") { psx = -20; psy = 0; }
            else if (morganPetSpot.zone === "chin") { psx = 0; psy = -10; }
            else if (morganPetSpot.zone === "belly") { psx = 0; psy = 70; }
            var ringR = 25 + 3 * Math.sin(morganTimer * 5);
            ctx.beginPath();
            ctx.arc(psx, psy, ringR, 0, Math.PI * 2);
            ctx.stroke();
            // pointing label
            drawText("👆 Pet here!", psx, psy - ringR - 12,
                "bold 13px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#5D4037", 3);
        }
        ctx.restore();

        // Floating hearts
        for (var h = 0; h < morganHearts.length; h++) {
            var heart = morganHearts[h];
            ctx.save();
            ctx.globalAlpha = clamp(heart.life / 1.2, 0, 1);
            ctx.fillStyle = heart.color;
            ctx.font = "bold 20px Arial";
            ctx.textAlign = "center";
            ctx.fillText("♥", heart.x, heart.y);
            ctx.restore();
        }

        // Dina's hand peeking from bottom-right
        ctx.save();
        ctx.translate(W - 60, H - 50);
        ctx.fillStyle = "#A8E6CF";
        roundRect(-30, 0, 60, 80, 8); ctx.fill();
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(0, -10, 16, 0, Math.PI * 2); ctx.fill();
        // Fingers
        for (var ff = 0; ff < 4; ff++) {
            ctx.beginPath();
            ctx.arc(-10 + ff * 6, -22, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Celebrate big-burst stars
        if (morganMood === "celebrate") {
            ctx.fillStyle = "rgba(255, 235, 0, 0.15)";
            ctx.fillRect(0, 0, W, H);
            drawText(morganStarAwarded ? "⭐ +1 STAR! ⭐" : "💜 Morgan's so happy! 💜", W / 2, H / 2 - 100,
                "bold 26px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 6);
            drawText("Morgan loves you, Dina!", W / 2, H / 2 - 64,
                "bold 14px Arial", "#FFFFFF", "#000", 3);
            if (Math.random() > 0.4) {
                morganHearts.push({
                    x: rand(0, W), y: H + 20,
                    life: 2,
                    color: randPick(["#FFD700", "#FFEB3B", "#FF6B9D"])
                });
                morganHearts[morganHearts.length - 1].y = H;
            }
        }

        // Footer hint
        drawText("Tap anywhere on Morgan to pet, scratch, or hug", W / 2, H - 14,
            "12px Arial", "#FFFFFF", "#000", 2);
    }

    // ── Update / Draw: Dina Nap ──────────────────────────────
    // ── Minigame: Sticker Book ───────────────────────────────
    // Dina spends the ⭐ stars she's earned to buy stickers and decorate a
    // scrapbook page. Placements persist in save.stickerBook so the book is
    // hers to keep. This gives earned stars a real purpose (a spend sink).
    var sticker = null; // { held, msg, msgT, sparkle[] }

    // Sticker catalog: emoji + star cost. Cheap-and-cheerful so kids can fill a page.
    var STICKER_KINDS = [
        { e: "⭐", cost: 1 }, { e: "💖", cost: 1 }, { e: "🌈", cost: 2 },
        { e: "🦄", cost: 3 }, { e: "🌸", cost: 1 }, { e: "🐱", cost: 2 },
        { e: "🍦", cost: 2 }, { e: "🎀", cost: 1 }, { e: "🦋", cost: 2 },
        { e: "🍓", cost: 1 }, { e: "🌟", cost: 1 }, { e: "🐶", cost: 2 }
    ];
    var STICKER_PAGE = { x: 40, y: 110, w: W - 80, h: 380 }; // the scrapbook page rect

    function startStickerBook() {
        state = "stickerBook";
        if (!save.stickerBook) save.stickerBook = [];
        sticker = { held: null, msg: "Tap a sticker, then tap the page!", msgT: 3, sparkle: [] };
        playTone(880, 0.08, "triangle", 0.15);
        setTimeout(function () { playTone(1100, 0.1, "triangle", 0.15); }, 80);
    }

    function stickerSparkle(x, y) {
        for (var i = 0; i < 10; i++) {
            var a = (Math.PI * 2 / 10) * i;
            sticker.sparkle.push({ x: x, y: y, vx: Math.cos(a) * rand(40, 110),
                vy: Math.sin(a) * rand(40, 110), life: 0.5, max: 0.5,
                col: randPick(["#FFD700", "#FF80AB", "#7C4DFF", "#4FC3F7"]) });
        }
    }

    function updateStickerBook(dt) {
        if (!sticker) return;
        if (sticker.msgT > 0) sticker.msgT -= dt;
        for (var s = sticker.sparkle.length - 1; s >= 0; s--) {
            var p = sticker.sparkle[s];
            p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
            if (p.life <= 0) sticker.sparkle.splice(s, 1);
        }

        var click = consumeClick();
        if (!click) return;

        // Back button
        if (pointInRect(click.x, click.y, 10, 52, 80, 40)) {
            persistSave();
            sticker = null;
            enterDinaHome();
            playClick();
            return;
        }
        // Clear-page button (bottom-right)
        if (pointInRect(click.x, click.y, W - 110, H - 52, 100, 40)) {
            if (save.stickerBook.length > 0) {
                save.stickerBook = [];
                persistSave();
                sticker.msg = "Cleared the page!"; sticker.msgT = 1.6;
                playTone(300, 0.12, "square", 0.14);
            }
            return;
        }

        // Tray row (bottom): pick up a sticker to place
        var tray = stickerTrayLayout();
        for (var t = 0; t < tray.length; t++) {
            var it = tray[t];
            if (pointInRect(click.x, click.y, it.x - 24, it.y - 24, 48, 48)) {
                if ((save.parkingTotalStars || 0) >= it.kind.cost) {
                    sticker.held = it.kind;
                    sticker.msg = "Now tap the page to place " + it.kind.e;
                    sticker.msgT = 2.5;
                    playClick();
                } else {
                    sticker.msg = "Need ⭐" + it.kind.cost + " for that one";
                    sticker.msgT = 1.8;
                    playDeny();
                }
                return;
            }
        }

        // Place held sticker onto the page
        if (sticker.held && pointInRect(click.x, click.y, STICKER_PAGE.x, STICKER_PAGE.y, STICKER_PAGE.w, STICKER_PAGE.h)) {
            save.parkingTotalStars -= sticker.held.cost;
            save.stickerBook.push({
                e: sticker.held.e, x: click.x, y: click.y,
                rot: rand(-0.35, 0.35), scale: rand(0.9, 1.25)
            });
            persistSave();
            stickerSparkle(click.x, click.y);
            playTone(700, 0.07, "sine", 0.16);
            setTimeout(function () { playTone(950, 0.08, "sine", 0.14); }, 60);
            sticker.msg = "Pretty! ⭐" + (save.parkingTotalStars || 0) + " left";
            sticker.msgT = 1.6;
            // keep the same sticker held if still affordable, else drop it
            if ((save.parkingTotalStars || 0) < sticker.held.cost) sticker.held = null;
            return;
        }
    }

    function stickerTrayLayout() {
        // Two rows of 6 along the bottom tray.
        var arr = [];
        var startY = H - 150;
        for (var i = 0; i < STICKER_KINDS.length; i++) {
            var col = i % 6, row = Math.floor(i / 6);
            arr.push({ kind: STICKER_KINDS[i], x: 50 + col * 76, y: startY + row * 50 });
        }
        return arr;
    }

    function drawStickerBook() {
        // Warm desk background
        ctx.fillStyle = "#E8C9A0";
        ctx.fillRect(0, 0, W, H);
        // wood grain
        ctx.strokeStyle = "rgba(150,110,70,0.25)";
        ctx.lineWidth = 2;
        for (var wy = 0; wy < H; wy += 26) {
            ctx.beginPath(); ctx.moveTo(0, wy + Math.sin(wy) * 3); ctx.lineTo(W, wy); ctx.stroke();
        }

        // HUD bar
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(0, 0, W, 44, 0); ctx.fill();
        drawText("📖 Dina's Sticker Book", W / 2, 22,
            "bold 15px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#000", 3);
        drawText("⭐ " + (save.parkingTotalStars || 0), W - 14, 22,
            "bold 15px Arial", "#FFD700", "#000", 2, "right");

        // Scrapbook page (with a cute spiral binding)
        var pg = STICKER_PAGE;
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        roundRect(pg.x + 4, pg.y + 5, pg.w, pg.h, 14); ctx.fill();
        ctx.fillStyle = "#FFFDF7";
        roundRect(pg.x, pg.y, pg.w, pg.h, 14); ctx.fill();
        ctx.strokeStyle = "#FF80AB"; ctx.lineWidth = 3;
        roundRect(pg.x, pg.y, pg.w, pg.h, 14); ctx.stroke();
        // faint guide dots
        ctx.fillStyle = "rgba(255,180,200,0.25)";
        for (var gy = pg.y + 30; gy < pg.y + pg.h - 10; gy += 40) {
            for (var gx = pg.x + 30; gx < pg.x + pg.w - 10; gx += 40) {
                ctx.beginPath(); ctx.arc(gx, gy, 2, 0, Math.PI * 2); ctx.fill();
            }
        }
        // spiral binding rings along the top
        ctx.strokeStyle = "#B07B4F"; ctx.lineWidth = 3;
        for (var rx = pg.x + 20; rx < pg.x + pg.w - 10; rx += 26) {
            ctx.beginPath(); ctx.arc(rx, pg.y, 6, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        }

        // Empty-page hint
        if (!save.stickerBook || save.stickerBook.length === 0) {
            drawText("Your page is empty —", W / 2, pg.y + pg.h / 2 - 12,
                "italic 15px 'Segoe UI', Arial", "#C9A0B0", null, 0);
            drawText("decorate it below! 💕", W / 2, pg.y + pg.h / 2 + 12,
                "italic 15px 'Segoe UI', Arial", "#C9A0B0", null, 0);
        }

        // Placed stickers (clipped to the page)
        ctx.save();
        roundRect(pg.x, pg.y, pg.w, pg.h, 14); ctx.clip();
        for (var i = 0; i < save.stickerBook.length; i++) {
            var pl = save.stickerBook[i];
            ctx.save();
            ctx.translate(pl.x, pl.y);
            ctx.rotate(pl.rot);
            ctx.scale(pl.scale, pl.scale);
            // little white sticker backing for that vinyl look
            ctx.fillStyle = "rgba(0,0,0,0.10)";
            ctx.beginPath(); ctx.arc(1, 2, 18, 0, Math.PI * 2); ctx.fill();
            ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(pl.e, 0, 0);
            ctx.restore();
        }
        ctx.restore();

        // Sparkles
        for (var sp = 0; sp < sticker.sparkle.length; sp++) {
            var s2 = sticker.sparkle[sp];
            ctx.globalAlpha = clamp(s2.life / s2.max, 0, 1);
            ctx.fillStyle = s2.col;
            ctx.beginPath(); ctx.arc(s2.x, s2.y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Tray label
        drawText("Tap a sticker (costs ⭐), then tap the page", W / 2, H - 176,
            "bold 12px 'Segoe UI', Arial", "#5D4037", "#FFF", 2);

        // Tray of buyable stickers
        var tray = stickerTrayLayout();
        for (var t = 0; t < tray.length; t++) {
            var it = tray[t];
            var afford = (save.parkingTotalStars || 0) >= it.kind.cost;
            var held = sticker.held === it.kind;
            // tile
            ctx.fillStyle = held ? "#FFF59D" : (afford ? "#FFFFFF" : "#D7CCC8");
            roundRect(it.x - 24, it.y - 24, 48, 48, 10); ctx.fill();
            ctx.strokeStyle = held ? "#FBC02D" : "#B0A08F"; ctx.lineWidth = held ? 3 : 2;
            roundRect(it.x - 24, it.y - 24, 48, 48, 10); ctx.stroke();
            ctx.globalAlpha = afford ? 1 : 0.45;
            ctx.font = "26px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(it.kind.e, it.x, it.y - 4);
            ctx.globalAlpha = 1;
            // cost pill
            drawText("⭐" + it.kind.cost, it.x, it.y + 16, "bold 10px Arial", afford ? "#FF8F00" : "#9E9E9E", "#FFF", 2);
        }

        // Held-sticker preview following nothing (shown near message)
        if (sticker.held) {
            drawText("Holding " + sticker.held.e + " — tap the page!", W / 2, 66,
                "bold 13px 'Segoe UI', Arial", "#7C4DFF", "#FFF", 2);
        } else if (sticker.msgT > 0) {
            ctx.globalAlpha = clamp(sticker.msgT, 0, 1);
            drawText(sticker.msg, W / 2, 66, "bold 13px 'Segoe UI', Arial", "#5D4037", "#FFF", 2);
            ctx.globalAlpha = 1;
        }

        // Back + Clear buttons
        drawIconButton(20, 56, 36, "◀", { bg: "#A8E6CF", bgDark: "#388E3C" });
        ctx.fillStyle = "#EF9A9A";
        roundRect(W - 110, H - 52, 100, 40, 10); ctx.fill();
        ctx.strokeStyle = "#C62828"; ctx.lineWidth = 2;
        roundRect(W - 110, H - 52, 100, 40, 10); ctx.stroke();
        drawText("🗑 Clear", W - 60, H - 32, "bold 13px Arial", "#FFFFFF", "#000", 2);
    }

    var dinaNapTucked = false;      // false: "tap to tuck in"; true: drifting off
    var dinaNapTuckTime = 0;        // seconds since tucked in

    function updateDinaNap(dt) {
        // Fresh entry (external code sets dinaRunTimer = 0): reset the beat.
        if (dinaRunTimer === 0) { dinaNapTucked = false; dinaNapTuckTime = 0; }
        dinaRunTimer += dt;
        if (!dinaNapTucked) {
            // Beat 1 — wait for the player to tuck Dina in (or a gentle auto-nudge).
            if (consumeClick() || consumeAction() || dinaRunTimer > 4) {
                dinaNapTucked = true;
                dinaNapTuckTime = 0;
                playTone(523, 0.12, "sine", 0.16, 392); // soft descending "shh"
            }
            return;
        }
        // Beat 2 — drifting off; let it breathe ~3.2s, then tap to wake.
        dinaNapTuckTime += dt;
        if (dinaNapTuckTime > 3.2 && (consumeClick() || consumeAction() || dinaNapTuckTime > 4.5)) {
            state = "dinaHome";
            // Clear the leftover tap/action from THIS wake touch. Dina is still
            // standing on the bed back in the bedroom, so without this the room
            // would instantly re-trigger the nap → stuck in a loop.
            consumeAction(); clickQueue = null;
        } else {
            consumeClick(); consumeAction();
        }
    }

    function drawDinaNap() {
        var tucked = dinaNapTucked;
        // Dusk deepens only once she's actually tucked in
        var t = tucked ? clamp(dinaNapTuckTime / 3.2, 0, 1) : 0;
        // gentle breathing factor (slower & deeper once asleep)
        var breath = Math.sin(dinaRunTimer * (tucked ? 1.6 : 2.4)) * (tucked ? 3 : 2);
        ctx.fillStyle = "#FFE8C8";
        ctx.fillRect(0, 0, W, H);
        // Dim overlay
        ctx.fillStyle = "rgba(40, 25, 80, " + (t * 0.55) + ")";
        ctx.fillRect(0, 0, W, H);
        // Bed in middle of screen
        ctx.fillStyle = "#5D4037";
        roundRect(W / 2 - 160, H / 2 - 80, 320, 180, 14); ctx.fill();
        ctx.fillStyle = "#F4A4B8";
        roundRect(W / 2 - 150, H / 2 - 70, 300, 160, 10); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        roundRect(W / 2 - 120, H / 2 - 60, 240, 40, 8); ctx.fill();
        // Blanket — sits low before tuck-in, pulled up snug after; gentle breathing rise.
        // Bottom edge is fixed at H/2+80; the top edge moves so it never overshoots the bed.
        var blanketBottom = H / 2 + 80;
        var blanketTop = tucked ? (H / 2 - 20 - breath) : (H / 2 + 4);
        ctx.fillStyle = "#B8E0D2";
        roundRect(W / 2 - 100, blanketTop, 200, blanketBottom - blanketTop, 8); ctx.fill();
        // Dina's head poking out (rises/falls subtly with breath)
        var headY = H / 2 - 35 + breath * 0.35;
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(W / 2, headY, 22, 0, Math.PI * 2); ctx.fill();
        // Hair
        ctx.fillStyle = "#6B4423";
        ctx.beginPath();
        ctx.arc(W / 2, headY - 10, 24, Math.PI, Math.PI * 2);
        ctx.fill();
        // Sleeping eyes (closed arcs)
        ctx.strokeStyle = "#3D2817";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(W / 2 - 7, headY, 4, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.arc(W / 2 + 7, headY, 4, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.stroke();
        // Tiny smile
        ctx.strokeStyle = "#A0394D";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(W / 2, headY + 7, 4, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
        // Floating Z's (only once she's actually asleep)
        if (tucked) {
            for (var zi = 0; zi < 3; zi++) {
                var zt = (dinaNapTuckTime + zi * 0.5) % 2;
                var alpha = (1 - zt / 2) * Math.min(1, dinaNapTuckTime);
                ctx.save();
                ctx.globalAlpha = Math.max(0, alpha);
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "bold " + (20 + zi * 6) + "px Arial";
                ctx.textAlign = "left";
                ctx.fillText("Z", W / 2 + 20 + zi * 20, headY - 35 - zt * 50);
                ctx.restore();
            }
        }
        // Floating moon/stars
        ctx.fillStyle = "#FFEE58";
        for (var sti = 0; sti < 6; sti++) {
            ctx.fillText("★", (sti * 87 + 47) % W, 50 + (sti % 3) * 30);
        }

        // Beat 1 prompt — invite the player to tuck Dina in
        if (!tucked) {
            var bob = Math.sin(dinaRunTimer * 3) * 4;
            drawText("Dina's so tired...", W / 2, H - 120,
                "bold 18px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#3D2C6B", 4);
            drawText("👆 Tap to tuck her in", W / 2, H - 80 + bob,
                "bold 20px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 4);
        } else {
            // Beat 2 — sweet dreams, then the earned reward
            ctx.globalAlpha = Math.min(1, dinaNapTuckTime * 2);
            drawText("Sweet dreams, Dina 💤", W / 2, H - 120,
                "bold 18px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#3D2C6B", 4);
            ctx.globalAlpha = 1;
            if (t > 0.7) {
                ctx.globalAlpha = (t - 0.7) / 0.3;
                drawText("💤 RESTED! +1 ⭐", W / 2, H - 80,
                    "bold 22px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 5);
                drawText("Tap to wake up", W / 2, H - 40,
                    "12px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#000", 3);
                ctx.globalAlpha = 1;
            }
        }

        // Award the star once (only after she's actually rested)
        if (tucked && t >= 1 && !window.__napAwarded) {
            window.__napAwarded = true;
            save.parkingTotalStars += 1;
            persistSave();
            setTimeout(function () { window.__napAwarded = false; }, 1000);
        }
    }

    // ════════════════════════════════════════════════════════
    // ══════════════ AVIGAIL MODE ════════════════════════════
    // ════════════════════════════════════════════════════════

    // Roadside Avigail (top-down) — curly black hair, purple top
    function drawAvigailWalker(x, y, walkTime) {
        ctx.save();
        ctx.translate(x, y);
        var legSwing = Math.sin(walkTime * 11) * 4;
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(0, 16, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
        // Legs
        ctx.fillStyle = "#37474F";
        roundRect(-5, 4 - legSwing, 4, 14 + legSwing, 2); ctx.fill();
        roundRect(1, 4 + legSwing, 4, 14 - legSwing, 2); ctx.fill();
        ctx.fillStyle = "#212121";
        roundRect(-6, 16 - legSwing, 6, 4, 2); ctx.fill();
        roundRect(0, 16 + legSwing, 6, 4, 2); ctx.fill();
        // Purple top
        ctx.fillStyle = "#5E35B1";
        roundRect(-9, -8, 18, 16, 5); ctx.fill();
        ctx.fillStyle = "#7E57C2";
        roundRect(-8, -7, 16, 14, 4); ctx.fill();
        // Arms
        ctx.fillStyle = "#7E57C2";
        roundRect(-11, -6, 4, 12, 2); ctx.fill();
        roundRect(7, -6, 4, 12, 2); ctx.fill();
        ctx.fillStyle = "#C68642";
        ctx.beginPath(); ctx.arc(-9, 7, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(9, 7, 2.5, 0, Math.PI * 2); ctx.fill();
        // Head (deeper skin)
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath(); ctx.arc(0, -14, 8.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#C68642";
        ctx.beginPath(); ctx.arc(0, -14, 7, 0, Math.PI * 2); ctx.fill();
        // Curly black hair halo
        ctx.fillStyle = "#1A1A1A";
        var curls = [[-7, -18], [-2, -21], [4, -21], [8, -17], [-9, -13], [9, -12]];
        for (var ci = 0; ci < curls.length; ci++) {
            ctx.beginPath(); ctx.arc(curls[ci][0], curls[ci][1], 4, 0, Math.PI * 2); ctx.fill();
        }
        // Gold hoop earrings
        ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(-7, -11, 2, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(7, -11, 2, 0, Math.PI * 2); ctx.stroke();
        // Eyes
        ctx.fillStyle = "#FFF";
        ctx.beginPath();
        ctx.arc(-2.5, -14, 1.4, 0, Math.PI * 2);
        ctx.arc(2.5, -14, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(-2.5, -14, 0.8, 0, Math.PI * 2);
        ctx.arc(2.5, -14, 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Salon sign (roadside) — scissors + "HAIR" sign
    function drawSalonSign(x, y, bob) {
        ctx.save();
        ctx.translate(x, y + Math.sin(bob * 3) * 3);
        // Glow
        ctx.fillStyle = "rgba(216,27,96,0.25)";
        ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
        // Pole
        ctx.fillStyle = "#90A4AE";
        ctx.fillRect(-1.5, 14, 3, 10);
        // Sign body (pink salon sign)
        ctx.fillStyle = "#AD1457";
        roundRect(-18, -16, 36, 30, 5); ctx.fill();
        ctx.fillStyle = "#EC407A";
        roundRect(-16, -14, 32, 26, 4); ctx.fill();
        // Scissors icon
        ctx.strokeStyle = "#FFF"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-6, 6); ctx.lineTo(4, -4);
        ctx.moveTo(-6, -4); ctx.lineTo(4, 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-7, 7, 2, 0, Math.PI * 2);
        ctx.arc(-7, -5, 2, 0, Math.PI * 2);
        ctx.stroke();
        // "HAIR" label
        ctx.fillStyle = "#FFF";
        ctx.font = "bold 8px 'Segoe UI', Arial, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("SALON", 0, 10);
        ctx.restore();
    }

    // Avigail's face for the door scene (around cx, cy)
    function drawAvigailFace(cx, cy, expr, time) {
        ctx.save();
        ctx.translate(cx, cy);
        // Curly black hair halo (behind)
        ctx.fillStyle = "#1A1A1A";
        for (var a = 0; a < 9; a++) {
            var ang = (a / 9) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(Math.cos(ang) * 42, Math.sin(ang) * 40 - 8, 13, 0, Math.PI * 2);
            ctx.fill();
        }
        // Face
        ctx.fillStyle = "#C68642";
        ctx.beginPath(); ctx.arc(0, -8, 38, 0, Math.PI * 2); ctx.fill();
        // Gold hoops
        ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(-34, 8, 6, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(34, 8, 6, 0, Math.PI * 2); ctx.stroke();
        // Eyes
        var eyeSquash = expr === "suspicious" ? 0.55
            : expr === "smug" ? 0.6
            : (expr === "dramatic" || expr === "panic") ? 1.35
            : 1;
        ctx.fillStyle = "#FFF";
        ctx.beginPath();
        ctx.ellipse(-13, -12, 6, 6 * eyeSquash, 0, 0, Math.PI * 2);
        ctx.ellipse(13, -12, 6, 6 * eyeSquash, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#4E342E";
        ctx.beginPath();
        ctx.arc(-13, -12, 3, 0, Math.PI * 2);
        ctx.arc(13, -12, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(-13, -12, 1.5, 0, Math.PI * 2);
        ctx.arc(13, -12, 1.5, 0, Math.PI * 2);
        ctx.fill();
        // Eyebrows by expression
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
        ctx.beginPath();
        if (expr === "suspicious") {
            ctx.moveTo(-20, -24); ctx.lineTo(-6, -22);      // one raised
            ctx.moveTo(6, -20); ctx.lineTo(20, -20);
        } else if (expr === "annoyed") {
            ctx.moveTo(-20, -20); ctx.lineTo(-6, -24);      // angled down-in
            ctx.moveTo(6, -24); ctx.lineTo(20, -20);
        } else if (expr === "dramatic") {
            ctx.moveTo(-20, -26); ctx.lineTo(-6, -28);      // both up
            ctx.moveTo(6, -28); ctx.lineTo(20, -26);
        } else if (expr === "smug") {
            ctx.moveTo(-20, -26); ctx.lineTo(-6, -22);      // one cocked high
            ctx.moveTo(6, -20); ctx.lineTo(20, -20);
        } else if (expr === "panic") {
            ctx.moveTo(-20, -28); ctx.lineTo(-6, -24);      // both high & pinched
            ctx.moveTo(6, -24); ctx.lineTo(20, -28);
        } else if (expr === "love") {
            ctx.moveTo(-20, -25); ctx.lineTo(-6, -27);
            ctx.moveTo(6, -27); ctx.lineTo(20, -25);
        } else { // excited
            ctx.moveTo(-20, -24); ctx.lineTo(-6, -26);
            ctx.moveTo(6, -26); ctx.lineTo(20, -24);
        }
        ctx.stroke();
        ctx.lineCap = "butt";
        // Mouth by expression
        ctx.fillStyle = "#D32F2F";
        if (expr === "excited") {
            ctx.beginPath(); ctx.arc(0, 8, 12, 0, Math.PI); ctx.fill();
            ctx.fillStyle = "#FFF"; ctx.fillRect(-9, 8, 18, 4);
        } else if (expr === "dramatic") {
            ctx.beginPath(); ctx.ellipse(0, 12, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
            // hand to forehead
            ctx.fillStyle = "#C68642";
            ctx.beginPath(); ctx.ellipse(-22, -28, 10, 6, -0.5, 0, Math.PI * 2); ctx.fill();
        } else if (expr === "annoyed") {
            ctx.strokeStyle = "#7D1010"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(0, 18, 8, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
        } else if (expr === "love") {
            ctx.beginPath(); ctx.arc(0, 8, 12, 0, Math.PI); ctx.fill();   // big smile
            ctx.fillStyle = "#FFF"; ctx.fillRect(-9, 8, 18, 4);
            // little heart cheeks
            ctx.fillStyle = "rgba(233,30,99,0.45)";
            ctx.beginPath(); ctx.arc(-22, 2, 5, 0, Math.PI * 2); ctx.arc(22, 2, 5, 0, Math.PI * 2); ctx.fill();
        } else if (expr === "panic") {
            ctx.beginPath(); ctx.ellipse(0, 12, 6, 8, 0, 0, Math.PI * 2); ctx.fill(); // small O
            // sweat drop
            ctx.fillStyle = "#4FC3F7";
            ctx.beginPath(); ctx.arc(28, -14, 3.5, 0, Math.PI * 2); ctx.fill();
        } else if (expr === "smug") {
            ctx.strokeStyle = "#7D1010"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(-8, 12); ctx.quadraticCurveTo(2, 16, 9, 9); ctx.stroke(); // smirk
        } else { // suspicious - flat line
            ctx.strokeStyle = "#7D1010"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(8, 12); ctx.stroke();
        }
        // Bold red lips hint (when not open-mouthed)
        ctx.restore();
    }

    // Avigail dialogue — assembled FRESH each pickup from pools below so the
    // conversation is rarely the same twice.
    //   • AVIGAIL_OPENERS  — step 0. Each has a "rugelach" choice; picking it sets
    //                        avigailHasRugelach. The chosen opener is tagged isOpener.
    //   • AVIGAIL_MIDDLES  — a shuffled subset fills the middle.
    //   • AVIGAIL_SNACKS   — one snack step (tagged isSnack) where "Rugelach. As
    //                        promised." pays off the promise made at the door.
    //   • AVIGAIL_CLOSERS  — final spoken line as she joins the trip (2x points).
    // engine reads step.prompt + choice.{label,reply,expr}. <=3 choices/step.
    // The rugelach payoff keys off the isOpener / isSnack tags (set at assembly
    // time), NOT a fixed index, so shuffling can never break it.

    // ── Openers (step 0). The rugelach choice is always present; rugelachIdx
    //    records which choice index promises rugelach for this opener. ──
    var AVIGAIL_OPENERS = [
        {
            prompt: "Nobody's home! This is\nher cat speaking.",
            expr: "suspicious", rugelachIdx: 2,
            choices: [
                { label: "Cats can't talk.", reply: "...Meow. Dang it. Hold on,\nI'm getting dressed.", expr: "annoyed" },
                { label: "I see your feet under the door.", reply: "These are DECORATIVE feet.\nVery on-trend this season.", expr: "suspicious" },
                { label: "I brought rugelach.", reply: "WHY didn't you LEAD with\nthat?! Door's basically open.", expr: "excited" }
            ]
        },
        {
            prompt: "I'm not coming out. I'm in\nmy pajamas and my FEELINGS.",
            expr: "dramatic", rugelachIdx: 1,
            choices: [
                { label: "It's 2 in the afternoon.", reply: "Time is a SOCIAL CONSTRUCT,\nLulu. So is your invitation.", expr: "smug" },
                { label: "There's rugelach out here.", reply: "...Pajamas ARE a fashion\nstatement. I'll be RIGHT out.", expr: "excited" },
                { label: "Same hat. Let me in.", reply: "Oh you GET it. Ugh, fine.\nUnlocking the door of doom.", expr: "love" }
            ]
        },
        {
            prompt: "State your business! And NO,\nI did not order a salad.",
            expr: "suspicious", rugelachIdx: 0,
            choices: [
                { label: "I literally brought rugelach.", reply: "RUGELACH?! Why are we still\nTALKING? Move, move, move!", expr: "excited" },
                { label: "It's me, Lulu. Open up.", reply: "'It's me' could be ANYONE.\nProve it. ...okay it's you.", expr: "suspicious" },
                { label: "Road trip. Get in the car.", reply: "A road trip? Unannounced??\nThe AUDACITY. I'm intrigued.", expr: "smug" }
            ]
        }
    ];

    // ── Middle exchanges — a shuffled subset is used each run. ──
    var AVIGAIL_MIDDLES = [
        {
            prompt: "Oh. It's YOU. The ghoster\nherself, in the FLESH.",
            expr: "annoyed",
            choices: [
                { label: "I never ghosted you!", reply: "You left me on read for\n9 DAYS, Lulu. NINE.", expr: "annoyed" },
                { label: "I missed your face?", reply: "Don't you 'miss your face' me.\n...okay it IS a great face.", expr: "smug" },
                { label: "Ima made me come.", reply: "Your IMA has better manners\nthan you. Tell her I said hi.", expr: "dramatic" }
            ]
        },
        {
            prompt: "Nine days! I sat by my\nphone like it was Shabbos!",
            expr: "dramatic",
            choices: [
                { label: "My phone fell in a lake.", reply: "Your phone. In a lake.\nWalking distance from MY house?", expr: "suspicious" },
                { label: "I was emotionally busy.", reply: "Emotionally busy. Iconic.\nUnforgivable, but iconic.", expr: "smug" },
                { label: "I sent a thumbs up!", reply: "A THUMBS UP. To 'I think my\ncholent gained sentience.'", expr: "annoyed" }
            ]
        },
        {
            prompt: "And why'd you find me\nWALKING? I have a CAR.",
            expr: "annoyed",
            choices: [
                { label: "Your car broke down again?", reply: "It's RESTING. It's not broken,\nit's spiritually recharging.", expr: "annoyed" },
                { label: "You walk dramatically tho.", reply: "I walk with PURPOSE. There's\na difference, peasant.", expr: "dramatic" },
                { label: "Were you avoiding someone?", reply: "...We do NOT speak of Tzippy\nfrom Lev Bais Yaakov. Drive.", expr: "panic" }
            ]
        },
        {
            prompt: "Is that your CAR out there?\nIt sounds like a kettle.",
            expr: "suspicious",
            choices: [
                { label: "She's vintage.", reply: "She's a HAZARD with a\nnamePlate. I love her already.", expr: "smug" },
                { label: "That's the AC. Probably.", reply: "That is NOT the AC, Lulu.\nThat is a CRY for help.", expr: "panic" },
                { label: "Don't insult my car.", reply: "I'll insult whatever I want.\nIt's in my contract. Get in.", expr: "smug" }
            ]
        },
        {
            prompt: "Okay but I'm calling shotgun\nAND aux. Non-negotiable.",
            expr: "smug",
            choices: [
                { label: "You played 1 song for 3 hrs.", reply: "It was a JOURNEY and you\nweren't emotionally ready.", expr: "dramatic" },
                { label: "Deal — no sad-girl playlist.", reply: "Then I have NOTHING to offer\nthis world. ...Fine. One bop.", expr: "dramatic" },
                { label: "Aux is yours, your majesty.", reply: "Was that sarcasm? I'll allow\nit. ONCE. Don't push it.", expr: "smug" }
            ]
        },
        {
            prompt: "Swear we're not picking up\nyour cousin again.",
            expr: "suspicious",
            choices: [
                { label: "I swear on the cholent.", reply: "That's the HOLIEST oath you\nhave. Okay. I believe you.", expr: "excited" },
                { label: "...Define 'picking up.'", reply: "LULU. I KNEW it. Turn the\ncar around— no, fine, GO.", expr: "panic" },
                { label: "He moved to Lakewood.", reply: "Baruch Hashem. Truly. Start\nthe kettle— I mean, the car.", expr: "love" }
            ]
        },
        // ── fresh material ──
        {
            prompt: "Wait. Did you bring snacks\nOR did you bring DRAMA?",
            expr: "suspicious",
            choices: [
                { label: "Why not both?", reply: "...That's the most ME thing\nyou've EVER said. I'm proud.", expr: "love" },
                { label: "Drama, obviously.", reply: "FINALLY. Someone who under-\nstands my LIFESTYLE. Get in.", expr: "excited" },
                { label: "Snacks. Always snacks.", reply: "A woman of SUBSTANCE. My\nrespect? Earned. Barely.", expr: "smug" }
            ]
        },
        {
            prompt: "I had a DREAM about you.\nYou owed me a casserole.",
            expr: "dramatic",
            choices: [
                { label: "Dreams aren't real debts.", reply: "Tell that to my SUBCONSCIOUS.\nShe keeps RECEIPTS, Lulu.", expr: "annoyed" },
                { label: "I'll bake you two.", reply: "TWO casseroles?! Okay now\nI'm getting in the car FAST.", expr: "love" },
                { label: "That's so specific.", reply: "My dreams have PRODUCTION\nVALUE. Unlike your texting.", expr: "smug" }
            ]
        },
        {
            prompt: "Quick poll: am I the funny\nfriend or the WISE one today?",
            expr: "smug",
            choices: [
                { label: "Funny. Definitely funny.", reply: "WRONG. I'm BOTH. This is a\ntrick poll. You failed. Drive.", expr: "annoyed" },
                { label: "Wise AND funny.", reply: "Correct answer. Suspicious\nspeed, though. Were you coached?", expr: "suspicious" },
                { label: "The dramatic one?", reply: "...How DARE you be RIGHT.\nUgh. Get in before I cry.", expr: "dramatic" }
            ]
        },
        {
            prompt: "I'm bringing my emotional\nsupport water bottle. Issue?",
            expr: "suspicious",
            choices: [
                { label: "No issue at all.", reply: "Good. She's named Brenda.\nBrenda gets the cupholder.", expr: "excited" },
                { label: "Does it have a name?", reply: "Obviously. BRENDA. Keep up.\nShe's been through a LOT.", expr: "dramatic" },
                { label: "We're not bringing Brenda.", reply: "Then I'm not bringing ME.\n...kidding. Brenda's coming.", expr: "smug" }
            ]
        },
        {
            prompt: "Be honest. Is my hair giving\n'main character' today?",
            expr: "dramatic",
            choices: [
                { label: "It's giving LEGEND.", reply: "I KNOW. But I needed YOU\nto know that I know. Thank you.", expr: "love" },
                { label: "It's giving... humid.", reply: "Slander! In MY doorway?!\nGet in before I rethink this.", expr: "annoyed" },
                { label: "Better than mine.", reply: "Finally, some self-awareness.\nWe're gonna get along GREAT.", expr: "smug" }
            ]
        }
    ];

    // ── Snack step (the rugelach payoff lives here). ──
    var AVIGAIL_SNACKS = [
        {
            prompt: "Before I commit: what's the\nsnack situation in there?",
            expr: "excited",
            choices: [
                { label: "Rugelach. A whole bag.", reply: "Marry me. Not really. But\nkeep the rugelach coming.", expr: "love" },
                { label: "Half a granola bar.", reply: "Half?? Who ATE the other half\nin a moving vehicle?? Animal.", expr: "annoyed" },
                { label: "Vibes only.", reply: "'Vibes only' is how friend-\nships END, Lulu. But fine.", expr: "dramatic" }
            ]
        },
        {
            prompt: "Non-negotiable: is there\nsomething to NOSH on?",
            expr: "excited",
            choices: [
                { label: "Rugelach. A whole bag.", reply: "A whole BAG?! I'm welling\nup. Don't look at me. DRIVE.", expr: "love" },
                { label: "A suspicious mint.", reply: "A MINT? One? Singular?? This\nis a CRISIS, not a road trip.", expr: "panic" },
                { label: "Gas station pretzels.", reply: "Gas station pretzels are a\nLOVE LANGUAGE. Fine. I'm in.", expr: "smug" }
            ]
        }
    ];

    var AVIGAIL_CLOSERS = [
        "Okay LET'S GO. I'm driving.\n...Fine, YOU drive. This time.",
        "If we get snacks on the way,\nall nine days are forgiven.",
        "I'm only coming for the aux\ncord and the bit. Mostly the bit.",
        "Buckle up. If we die, I'm\ntelling everyone it was YOUR fault.",
        "Shotgun, aux, AND the last\nrugelach. That's the deal. Go go go.",
        "Brenda's buckled, I'm buckled,\nlet's make some QUESTIONABLE memories.",
        "I forgive you. Conditionally.\nThe condition is more rugelach."
    ];

    var avigailHasRugelach = false;
    var AVIGAIL_SCRIPT = null;                                // assembled per scene
    var avigailRugelachIdx = AVIGAIL_OPENERS[0].rugelachIdx;  // updated at assembly

    // Fisher-Yates-ish shuffle returning a fresh array (does not mutate input).
    function avigailShuffle(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = randInt(0, i);
            var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
        }
        return a;
    }

    // Assemble a fresh ~6-8 step script: opener (tagged isOpener) + shuffled
    // middles + a snack step (tagged isSnack), all inserted in a pleasant order.
    function buildAvigailScript() {
        var opener = randPick(AVIGAIL_OPENERS);
        var snack = randPick(AVIGAIL_SNACKS);

        // 2-3 self-contained middle quips → a tight, coherent 4-5 step chat
        // (each middle stands on its own so any order reads fine).
        var mids = avigailShuffle(AVIGAIL_MIDDLES).slice(0, randInt(2, 3));

        var script = [opener];
        // Drop the snack step somewhere in the back half so the promise has time
        // to register, then append the rest of the middles after it.
        var splitAt = Math.ceil(mids.length / 2);
        for (var m = 0; m < splitAt; m++) script.push(mids[m]);
        script.push(snack);
        for (var n = splitAt; n < mids.length; n++) script.push(mids[n]);
        return script;
    }

    function startAvigailScene() {
        prevState = "playing";
        state = "avigailScene";
        avigailStep = 0;
        avigailReplyTimer = 0;
        avigailReply = "";
        avigailExpr = "suspicious";
        avigailDoorTimer = 2.0;
        avigailResolved = false;
        avigailHasRugelach = false;
        AVIGAIL_SCRIPT = buildAvigailScript();   // fresh randomized conversation
    }

    function updateAvigailScene(dt) {
        gameTime += dt; // keep face/bubble animations ticking
        if (avigailDoorTimer > 0) {
            avigailDoorTimer -= dt;
            consumeClick(); consumeAction();
            return;
        }
        // Showing a reply — wait then advance
        if (avigailReplyTimer > 0) {
            avigailReplyTimer -= dt;
            consumeClick();
            if (avigailReplyTimer <= 0) {
                if (avigailResolved) { finishAvigailScene(); return; }
                avigailStep++;
                if (avigailStep >= AVIGAIL_SCRIPT.length) {
                    // Resolution
                    avigailResolved = true;
                    avigailReply = randPick(AVIGAIL_CLOSERS);
                    avigailExpr = "excited";
                    avigailReplyTimer = 2.2;
                    playTone(660, 0.1, "triangle", 0.2);
                }
            }
            return;
        }
        // Awaiting a choice
        var click = consumeClick();
        if (click) {
            var dec = AVIGAIL_SCRIPT[avigailStep];
            if (!dec) return;
            for (var i = 0; i < dec.choices.length; i++) {
                var by = 636 + i * 60;
                if (pointInRect(click.x, click.y, 70, by, 340, 54)) {
                    var ch = dec.choices[i];
                    avigailReply = ch.reply;
                    avigailExpr = ch.expr;
                    avigailReplyTimer = 1.9;
                    playClick();
                    return;
                }
            }
        }
    }

    function finishAvigailScene() {
        avigailInCar = true;
        pointMult = 2;
        parkingMsg = "💜 AVIGAIL JOINED! 2× POINTS!";
        parkingMsgTimer = 3;
        spawnCoinSparkle(W / 2, H / 2);
        returnToDriving();
    }

    function drawAvigailScene() {
        // Porch background
        var sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, "#FFD89E"); sky.addColorStop(1, "#C9A8E8");
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
        // House wall
        ctx.fillStyle = "#FFE0B2";
        ctx.fillRect(0, 120, W, H - 120);
        // Door
        ctx.fillStyle = "#00796B";
        roundRect(W / 2 - 90, 200, 180, 360, 10); ctx.fill();
        ctx.fillStyle = "#26A69A";
        roundRect(W / 2 - 82, 208, 164, 344, 8); ctx.fill();
        ctx.strokeStyle = "#004D40"; ctx.lineWidth = 4;
        roundRect(W / 2 - 90, 200, 180, 360, 10); ctx.stroke();
        // Brass knob
        ctx.fillStyle = "#FFD700";
        ctx.beginPath(); ctx.arc(W / 2 + 66, 390, 7, 0, Math.PI * 2); ctx.fill();
        // Nameplate
        ctx.fillStyle = "#FFD54F";
        roundRect(W / 2 - 70, 150, 140, 30, 6); ctx.fill();
        ctx.strokeStyle = "#5D4037"; ctx.lineWidth = 2;
        roundRect(W / 2 - 70, 150, 140, 30, 6); ctx.stroke();
        drawText("AVIGAIL'S LAIR", W / 2, 165, "bold 13px 'Segoe UI', Arial, sans-serif", "#5D4037", null, 0);
        // Wreath
        ctx.strokeStyle = "#FBC02D"; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(W / 2, 270, 28, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#5D4037";
        ctx.beginPath(); ctx.arc(W / 2, 270, 8, 0, Math.PI * 2); ctx.fill();
        // Doormat
        ctx.fillStyle = "#A1887F";
        roundRect(W / 2 - 70, H - 70, 140, 36, 4); ctx.fill();
        drawText("GO AWAY :)", W / 2, H - 52, "bold 14px 'Segoe UI', Arial, sans-serif", "#3E2723", null, 0);

        if (avigailDoorTimer > 0) {
            // Lulu knocking (just show her car-less standing — reuse portrait small)
            drawText("*knock knock knock*", W / 2, 110,
                "bold 18px 'Segoe UI', Arial, sans-serif", "#5D4037", "#FFF", 3);
            drawSpeechBubble(W / 2, 430, "Knock knock! I KNOW\nyou're home, Avigail.", avigailDoorTimer * 5);
            return;
        }

        // Rugelach-promise token — visible once Lulu has promised rugelach, so the
        // later "as promised" payoff feels earned rather than a hidden gotcha.
        if (avigailHasRugelach) {
            var tokY = 100;
            ctx.fillStyle = "rgba(255,255,255,0.92)";
            roundRect(W - 150, tokY - 16, 130, 32, 16); ctx.fill();
            ctx.strokeStyle = "#8D6E63"; ctx.lineWidth = 2;
            roundRect(W - 150, tokY - 16, 130, 32, 16); ctx.stroke();
            drawText("🍪 promised", W - 85, tokY, "bold 14px 'Segoe UI', Arial, sans-serif", "#5D4037", null, 0);
        }

        // Avigail in the doorway
        drawAvigailFace(W / 2, 330, avigailExpr, gameTime);

        // Speech bubble: either prompt or reply
        var bubbleText, lockChoices = false;
        if (avigailReplyTimer > 0) {
            bubbleText = avigailReply;
            lockChoices = true;
        } else {
            // Guard: avigailStep can momentarily equal SCRIPT.length on the frame
            // the closer resolves; fall back gracefully instead of indexing OOB.
            var cur = AVIGAIL_SCRIPT && AVIGAIL_SCRIPT[avigailStep];
            bubbleText = cur ? cur.prompt : "...";
        }
        // Bubble
        ctx.fillStyle = "#FFFFFF";
        roundRect(30, 430, W - 60, 90, 16); ctx.fill();
        ctx.strokeStyle = "#00796B"; ctx.lineWidth = 3;
        roundRect(30, 430, W - 60, 90, 16); ctx.stroke();
        var lines = bubbleText.split("\n");
        for (var li = 0; li < lines.length; li++) {
            drawText(lines[li], W / 2, 460 + li * 24, "bold 17px 'Segoe UI', Arial, sans-serif", "#222", null, 0);
        }

        // Choice buttons (only when awaiting choice)
        if (!lockChoices) {
            // progress hearts so the longer scene feels intentional
            if (!avigailResolved) {
                drawText("♥ " + (avigailStep + 1) + " / " + AVIGAIL_SCRIPT.length,
                    W / 2, 540, "bold 14px 'Segoe UI', Arial, sans-serif", "#5D4037", "#FFF", 2);
            }
            var dec = AVIGAIL_SCRIPT && AVIGAIL_SCRIPT[avigailStep];
            var cols = [{ bg: "#66BB6A", bgDark: "#2E7D32" }, { bg: "#42A5F5", bgDark: "#0D47A1" }, { bg: "#FFC107", bgDark: "#FF6F00" }];
            for (var i = 0; dec && i < dec.choices.length; i++) {
                var by = 636 + i * 60;
                drawButton(70, by, 340, 54, dec.choices[i].label,
                    { bg: cols[i].bg, bgDark: cols[i].bgDark, small: true });
            }
        } else {
            drawText("...", W / 2, 700, "bold 28px Arial", "#FFF", "#000", 3);
        }
    }

    // ════════════════════════════════════════════════════════
    // ══════════════ SALON MODE ══════════════════════════════
    // ════════════════════════════════════════════════════════

    function startSalonScene() {
        prevState = "playing";
        state = "salon";
        salonPhase = 0;
        salonTimer = 0;
        salonPendingColor = null;
        salonIsBlonde = false;
        salonReaction = "";
        salonStyle = null;
        salonOops = false;
        salonConsultStep = 0;
        salonConfirm = false;
    }

    // Confirm sub-step for the color pick (telegraphs the choice before committing).
    var salonConfirm = false;
    // Every color is a win with its own flavor — no coin-flip, no punishment.
    // Keyed by SALON_COLORS label so this lives entirely in this fragment.
    // Blonde colors get the extra fanfare, telegraphed beforehand as Fabio's "✨ Fabio's pick".
    var SALON_OUTCOMES = {
        "PLATINUM": "I'm BLONDE! I'm basically a\nwhole new person now!",
        "GOLDEN":   "GOLD?! Fabio, I could KISS\nyou. I won't. But I COULD.",
        "BRUNETTE": "Rich, glossy brunette. I look\nEXPENSIVE. I love it.",
        "JET BLACK": "Sleek. Mysterious. Main-\ncharacter energy. STUNNING.",
        "PINK":     "PINK?! I'm a cotton-candy\nQUEEN and I OWN it!",
        "BLUE":     "Ocean blue! Bold, cool, and\nTOTALLY my vibe. YES."
    };

    function updateSalon(dt) {
        salonTimer += dt;
        gameTime += dt; // keep Fabio/sparkle animations ticking
        if (salonPhase === 0) {
            // Intro — Fabio greets, auto-advance after 3.5s
            if (salonTimer > 3.5 || consumeAction()) {
                salonPhase = 1; salonTimer = 0;
            }
            consumeClick();
            return;
        }
        if (salonPhase === 1) {
            // DIALOGUE — each tap advances one consult line; last → style pick
            if (consumeClick() || consumeAction()) {
                salonConsultStep++;
                playTone(440, 0.06, "triangle", 0.15);
                if (salonConsultStep >= SALON_CONSULT.length) {
                    salonPhase = 2; salonTimer = 0;
                }
            }
            return;
        }
        if (salonPhase === 2) {
            // STYLE pick — 3 stacked buttons
            var sclick = consumeClick();
            if (sclick) {
                for (var s = 0; s < SALON_STYLES.length; s++) {
                    var sby = 380 + s * 80;
                    if (pointInRect(sclick.x, sclick.y, 60, sby, 380, 64)) {
                        salonStyle = SALON_STYLES[s];
                        salonPhase = 3; salonTimer = 0;
                        playTone(523, 0.1, "triangle", 0.2);
                        return;
                    }
                }
            }
            return;
        }
        if (salonPhase === 3) {
            var click = consumeClick();
            if (!click) return;
            if (salonConfirm) {
                // Confirm step — "Go {COLOR}?"  YES commits, BACK re-opens the swatches.
                if (pointInRect(click.x, click.y, 60, 470, 170, 56)) {        // YES
                    salonConfirm = false;
                    salonPhase = 4; salonTimer = 0;
                    playTone(523, 0.1, "triangle", 0.2);
                } else if (pointInRect(click.x, click.y, 250, 470, 170, 56)) { // BACK
                    salonConfirm = false;
                    salonPendingColor = null;
                    playClick();
                }
                return;
            }
            // COLOR pick — choosing a swatch opens the confirm step (no commit yet)
            for (var i = 0; i < SALON_COLORS.length; i++) {
                var col = i % 2, row = Math.floor(i / 2);
                var bx = 50 + col * 250, by = 360 + row * 100;
                if (pointInRect(click.x, click.y, bx, by, 130, 80)) {
                    salonPendingColor = SALON_COLORS[i];
                    salonIsBlonde = SALON_COLORS[i].blonde;
                    salonConfirm = true;
                    playTone(440, 0.07, "triangle", 0.18);
                    return;
                }
            }
            return;
        }
        if (salonPhase === 4) {
            // Processing ~6.4s of beats, then commit + reveal
            if (salonTimer > 6.4) {
                salonPhase = 5; salonTimer = 0;
                // Commit hair color — permanent, exactly once
                save.luluHair = salonPendingColor.hex;
                persistSave();
                // Every color is a happy result now. ~1-in-8 BONUS surprise: the cat
                // knocks the bottle and it comes out even better (a treat, not a punishment).
                salonOops = (Math.random() < 0.125);
                // Always-positive reaction; oops swaps in its own delighted line.
                salonReaction = salonOops ? SALON_OOPS.lulu
                    : (SALON_OUTCOMES[salonPendingColor.label] || salonPendingColor.luluWin || "I LOVE it!");
                // Cheerful arpeggio for everyone; blonde gets a little extra sparkle.
                spawnCoinSparkle(W / 2, 300);
                playTone(523, 0.1, "triangle", 0.2);
                setTimeout(function () { playTone(659, 0.1, "triangle", 0.2); }, 100);
                setTimeout(function () { playTone(784, 0.1, "triangle", 0.2); }, 200);
                if (salonIsBlonde || salonOops) {
                    setTimeout(function () { playTone(1046, 0.18, "triangle", 0.22); }, 300);
                }
            }
            return;
        }
        if (salonPhase === 5) {
            // Reveal — TAP TO LEAVE
            var click2 = consumeClick();
            if ((click2 && salonTimer > 0.6) || consumeAction() || salonTimer > 18) {
                returnToDriving();
            }
        }
    }

    function drawFabio(x, y, time) {
        ctx.save();
        ctx.translate(x + Math.sin(time * 3) * 4, y);
        // Black smock body
        ctx.fillStyle = "#212121";
        roundRect(-16, 0, 32, 50, 8); ctx.fill();
        // Gold scissor brooch
        ctx.fillStyle = "#FFD700";
        ctx.beginPath(); ctx.arc(0, 14, 4, 0, Math.PI * 2); ctx.fill();
        // Head
        ctx.fillStyle = "#E8B89A";
        ctx.beginPath(); ctx.arc(0, -14, 13, 0, Math.PI * 2); ctx.fill();
        // Towering teal pompadour (3 stacked ellipses)
        ctx.fillStyle = "#26A69A";
        ctx.beginPath(); ctx.ellipse(0, -26, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -34, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-2, -42, 8, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = shadeColor("#26A69A", 40);
        ctx.beginPath(); ctx.ellipse(-4, -28, 5, 3, -0.3, 0, Math.PI * 2); ctx.fill();
        // Eyes
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(-4, -15, 1.4, 0, Math.PI * 2);
        ctx.arc(4, -15, 1.4, 0, Math.PI * 2);
        ctx.fill();
        // Pencil mustache
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-5, -9); ctx.lineTo(0, -8); ctx.lineTo(5, -9);
        ctx.stroke();
        // Oversized scissors (snipping)
        var snip = (Math.sin(time * 6) > 0) ? 0.3 : 0;
        ctx.strokeStyle = "#B0BEC5"; ctx.lineWidth = 2.5;
        ctx.save();
        ctx.translate(20, 6);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(14, -6 - snip * 6);
        ctx.moveTo(0, 0); ctx.lineTo(14, 6 + snip * 6);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(-2, -3, 3, 0, Math.PI * 2); ctx.arc(-2, 3, 3, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        ctx.restore();
    }

    function drawSalon() {
        // Walls (pink gradient)
        var wall = ctx.createLinearGradient(0, 0, 0, 596);
        wall.addColorStop(0, "#FFE0EC"); wall.addColorStop(1, "#FFC1DA");
        ctx.fillStyle = wall; ctx.fillRect(0, 0, W, 596);
        ctx.fillStyle = "#D81B60"; ctx.fillRect(0, 596, W, 6);
        // Checkerboard floor
        for (var fy = 600; fy < H; fy += 30) {
            for (var fx = 0; fx < W; fx += 30) {
                ctx.fillStyle = ((fx / 30 + fy / 30) % 2 === 0) ? "#F5F5F5" : "#F8BBD0";
                ctx.fillRect(fx, fy, 30, 30);
            }
        }
        // Big mirror
        ctx.fillStyle = "#FFD700";
        roundRect(120, 120, 240, 300, 14); ctx.fill();
        ctx.fillStyle = "#D7F0FA";
        roundRect(132, 132, 216, 276, 8); ctx.fill();
        // Mirror sheen
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.beginPath();
        ctx.moveTo(150, 132); ctx.lineTo(220, 132); ctx.lineTo(160, 408); ctx.lineTo(132, 408);
        ctx.closePath(); ctx.fill();

        // Salon chair (with Lulu in it during pick/process; reveal shows new hair)
        // Chrome hydraulic pole + round base.
        ctx.fillStyle = "#90A4AE";
        ctx.fillRect(W / 2 - 5, 470, 10, 150); // pole
        ctx.fillStyle = "#B0BEC5";
        roundRect(W / 2 - 7, 470, 4, 150, 2); ctx.fill(); // pole highlight
        ctx.fillStyle = "#78909C";
        ctx.beginPath(); ctx.ellipse(W / 2, 624, 46, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#B0BEC5";
        ctx.beginPath(); ctx.ellipse(W / 2, 620, 46, 12, 0, 0, Math.PI * 2); ctx.fill();
        // Plush salon chair back (rounded, glossy pink) with armrests.
        ctx.fillStyle = "#AD1457";
        roundRect(W / 2 - 58, 432, 116, 78, 22); ctx.fill();
        ctx.fillStyle = "#EC407A";
        roundRect(W / 2 - 50, 440, 100, 64, 18); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.30)"; // gloss
        roundRect(W / 2 - 44, 446, 88, 18, 12); ctx.fill();
        ctx.fillStyle = "#C2185B"; // armrests
        roundRect(W / 2 - 70, 470, 18, 30, 8); ctx.fill();
        roundRect(W / 2 + 52, 470, 18, 30, 8); ctx.fill();

        // Lulu in the mirror (shows her hair). During reveal, show new color big.
        if (salonPhase >= 1) {
            // Soft round vanity-mirror spotlight behind her so the portrait reads
            // as a framed reflection rather than floating art.
            ctx.save();
            ctx.beginPath(); ctx.arc(W / 2, 240, 108, 0, Math.PI * 2); ctx.clip();
            var glowG = ctx.createRadialGradient(W / 2, 230, 20, W / 2, 240, 110);
            glowG.addColorStop(0, "rgba(255,255,255,0.55)");
            glowG.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = glowG;
            ctx.fillRect(W / 2 - 110, 130, 220, 220);
            ctx.restore();

            ctx.save();
            ctx.translate(W / 2, 252);
            ctx.scale(1.32, 1.32);
            // reuse portrait — hair already reads save.luluHair (committed at reveal)
            drawLuluPortrait(0, 0, gameTime, 1);
            // Salon cape draped over her shoulders, painted OVER the portrait so it
            // tidily hides the portrait's peeking car + tee and frames her face as a
            // salon client. (Her hair/face still show — only the body is covered.)
            ctx.fillStyle = "#37474F";
            ctx.beginPath();
            ctx.moveTo(-48, 40);
            ctx.quadraticCurveTo(0, 30, 48, 40);
            ctx.lineTo(64, 100);
            ctx.quadraticCurveTo(0, 114, -64, 100);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#455A64"; // cape sheen panel
            ctx.beginPath();
            ctx.moveTo(-40, 42); ctx.quadraticCurveTo(0, 34, 40, 42);
            ctx.lineTo(52, 94); ctx.quadraticCurveTo(0, 104, -52, 94);
            ctx.closePath(); ctx.fill();
            // White neck towel trim peeking above the cape collar
            ctx.fillStyle = "#FFFFFF";
            roundRect(-30, 30, 60, 13, 6); ctx.fill();
            ctx.restore();
        }

        // Fabio the stylist (right side)
        drawFabio(410, 360, gameTime);

        // Phase-specific UI
        if (salonPhase === 0) {
            drawSalonBubble("Ah, bonjour! You sit in zee\nchair of GENIUS!");
            drawText("(tap to continue)", W / 2, H - 30, "13px Arial", "#fff", "#000", 2);
        } else if (salonPhase === 1) {
            // Consult dialogue
            drawSalonBubble(SALON_CONSULT[Math.min(salonConsultStep, SALON_CONSULT.length - 1)]);
            drawText("(tap to continue)", W / 2, H - 30, "13px Arial", "#fff", "#000", 2);
        } else if (salonPhase === 2) {
            // Style pick — 3 stacked wide buttons
            drawSalonBubble("And zee SILHOUETTE, darling?");
            for (var s = 0; s < SALON_STYLES.length; s++) {
                var sby = 380 + s * 80;
                drawButton(60, sby, 380, 64, SALON_STYLES[s].label,
                    { bg: "#EC407A", bgDark: "#AD1457", small: true });
            }
        } else if (salonPhase === 3 && !salonConfirm) {
            // Color pick — Fabio reacts to the chosen style. Each swatch shows its
            // name (already) and Fabio flags his blonde "picks" so the best result
            // is telegraphed, not a coin-flip.
            drawSalonBubble(salonStyle ? salonStyle.fabio : "What shall it be, mon chou?");
            for (var i = 0; i < SALON_COLORS.length; i++) {
                var col = i % 2, row = Math.floor(i / 2);
                var bx = 50 + col * 250, by = 360 + row * 100;
                var c = SALON_COLORS[i];
                drawButton(bx, by, 130, 80, c.label, { bg: c.hex, bgDark: shadeColor(c.hex, -50), small: true });
                if (c.blonde) {
                    drawText("✨ Fabio's pick", bx + 65, by + 71,
                        "bold 10px 'Segoe UI', Arial, sans-serif", "#FFD700", "#7A4F00", 2);
                }
            }
            drawText("Every shade is a look — pick what's YOU 💖", W / 2, 340,
                "bold 12px 'Segoe UI', Arial, sans-serif", "#AD1457", "#FFF", 2);
        } else if (salonPhase === 3 && salonConfirm) {
            // Confirm step — telegraph the exact choice before committing.
            var cc = salonPendingColor;
            drawSalonBubble("Go " + cc.label + ", darling?\nA MARVELOUS choice!");
            // Big preview swatch + name
            ctx.fillStyle = cc.hex;
            roundRect(W / 2 - 70, 360, 140, 90, 14); ctx.fill();
            ctx.strokeStyle = shadeColor(cc.hex, -50); ctx.lineWidth = 4;
            roundRect(W / 2 - 70, 360, 140, 90, 14); ctx.stroke();
            drawText(cc.label, W / 2, 405, "bold 20px 'Segoe UI', Arial, sans-serif",
                cc.blonde ? "#6B4423" : "#FFF", "#000", 3);
            if (cc.blonde) {
                drawText("✨ Fabio's pick", W / 2, 433,
                    "bold 12px 'Segoe UI', Arial, sans-serif", "#7A4F00", "#FFF", 2);
            }
            drawButton(60, 470, 170, 56, "YES! GO " + cc.label, { bg: "#66BB6A", bgDark: "#2E7D32", small: true });
            drawButton(250, 470, 170, 56, "← PICK AGAIN", { bg: "#90A4AE", bgDark: "#546E7A", small: true });
        } else if (salonPhase === 4) {
            // Processing: foils + beat-driven ticker + white pulses
            var pulse = Math.abs(Math.sin(salonTimer * 4)) * 0.3;
            ctx.fillStyle = "rgba(255,255,255," + pulse + ")";
            ctx.fillRect(0, 0, W, H);
            // first beat: Fabio's hot take on the chosen color, then the process beats
            var pbeat = Math.min(Math.floor(salonTimer / 1.28), SALON_PROCESS_BEATS.length - 1);
            drawSalonBubble(salonTimer < 1.4 && salonPendingColor
                ? salonPendingColor.fabio : SALON_PROCESS_BEATS[pbeat]);
            // sparkle dust
            if (Math.random() > 0.5) {
                particles.push({ x: W / 2 + rand(-40, 40), y: 250 + rand(-40, 40),
                    vx: rand(-30, 30), vy: rand(-40, -10), life: 0.6, maxLife: 0.6,
                    size: rand(2, 5), color: randPick(["#FFD700", "#FFF", "#F8BBD0"]), gravity: 0 });
            }
            drawParticles();
        } else if (salonPhase === 5) {
            // Reveal reaction — always celebratory now. Tint to the new hair color.
            var glow = salonPendingColor ? salonPendingColor.hex : "#FFEB96";
            ctx.fillStyle = "rgba(255,235,150,0.18)";
            ctx.fillRect(0, 0, W, H);
            // floating celebration confetti in the new color (+hearts)
            if (Math.random() > 0.5) {
                particles.push({ x: rand(0, W), y: H, vx: rand(-20, 20), vy: rand(-90, -50),
                    life: 1.5, maxLife: 1.5, size: rand(4, 8),
                    color: randPick(["#E91E63", glow, "#FFD700"]), gravity: 20 });
            }
            // oops bonus gets a little extra paw-print sparkle burst
            if (salonOops && Math.random() > 0.6) {
                particles.push({ x: W / 2 + rand(-50, 50), y: 230 + rand(-20, 20),
                    vx: rand(-30, 30), vy: rand(-40, -10), life: 0.7, maxLife: 0.7,
                    size: rand(3, 6), color: randPick(["#FFD700", "#FFF"]), gravity: 0 });
            }
            drawParticles();
            drawSalonBubble(salonReaction);
            // Fabio closer — oops bonus gets its own (proud!) confession line
            var salonCloser = salonOops ? "Fabio: zee CAT helped. A BONUS, non?"
                : "Fabio: VOILÀ. Thank ZEE ART, darling.";
            drawText(salonCloser, W / 2, 600, "italic 13px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
            drawButton(W / 2 - 90, H - 80, 180, 50, "TAP TO LEAVE", { bg: "#66BB6A", bgDark: "#2E7D32", small: true });
        }
    }

    function drawSalonBubble(text) {
        ctx.fillStyle = "#FFFFFF";
        roundRect(30, 50, W - 60, 70, 14); ctx.fill();
        ctx.strokeStyle = "#D81B60"; ctx.lineWidth = 3;
        roundRect(30, 50, W - 60, 70, 14); ctx.stroke();
        var lines = text.split("\n");
        for (var li = 0; li < lines.length; li++) {
            drawText(lines[li], W / 2, 76 + li * 22, "bold 16px 'Segoe UI', Arial, sans-serif", "#AD1457", null, 0);
        }
    }

    // ── Main Loop ────────────────────────────────────────────
    var lastTime = 0;

    // ── Minigame: Cookie Catch ───────────────────────────────
    // Dina slides a plate left/right to catch falling cookies & treats for
    // coins. Catch a bomb (Mom's burnt cookie) and you lose a life. 30s round.
    var cookie = null; // {plateX, items[], timer, score, lives, spawnT, combo, comboT, msg, msgT, phase}
    var COOKIE_DURATION = 30;
    var COOKIE_PLATE_Y = H - 120;
    var COOKIE_PLATE_W = 78;   // narrower plate → catching takes more skill
    var COOKIE_FEE = 10;       // coins it costs to play one round

    function startCookieCatch() {
        state = "cookieCatch";
        // Entry fee — costs coins to play so it's a real gamble (you only come
        // out ahead by catching well), not a risk-free coin faucet.
        var fee = Math.min(COOKIE_FEE, save.totalCoins);
        save.totalCoins -= fee;
        persistSave();
        cookie = {
            plateX: W / 2, plateVX: 0,
            items: [], timer: COOKIE_DURATION,
            score: 0, lives: 3, spawnT: 0.8,
            combo: 0, comboT: 0,
            fee: fee,
            msg: "Catch the cookies!", msgT: 2,
            phase: "play", endT: 0, caught: 0
        };
        playTone(660, 0.08, "triangle", 0.18);
        setTimeout(function () { playTone(880, 0.1, "triangle", 0.18); }, 90);
    }

    // Falling item kinds — weight controls how often each appears.
    var COOKIE_KINDS = [
        { type: "cookie", emoji: "🍪", points: 1, weight: 42, good: true },
        { type: "choc",   emoji: "🍫", points: 2, weight: 18, good: true },
        { type: "donut",  emoji: "🍩", points: 3, weight: 11, good: true },
        { type: "cupcake",emoji: "🧁", points: 5, weight: 6,  good: true },
        { type: "milk",   emoji: "🥛", points: 2, weight: 7,  good: true },
        { type: "bomb",   emoji: "💣", points: 0, weight: 22, good: false }
    ];
    function pickCookieKind() {
        var total = 0, i;
        for (i = 0; i < COOKIE_KINDS.length; i++) total += COOKIE_KINDS[i].weight;
        var r = rand(0, total);
        for (i = 0; i < COOKIE_KINDS.length; i++) {
            r -= COOKIE_KINDS[i].weight;
            if (r <= 0) return COOKIE_KINDS[i];
        }
        return COOKIE_KINDS[0];
    }

    function updateCookieCatch(dt) {
        if (!cookie) return;
        gameTime += dt; // keep timed visual cues (low-time flash) animating
        updateParticles(dt);

        // ── End-of-round handoff ──
        if (cookie.phase !== "play") {
            cookie.endT += dt;
            if (cookie.endT > 1.0 && (consumeClick() || consumeAction())) {
                // Bank the coins and return to the bedroom.
                save.totalCoins += cookie.score;
                persistSave();
                cookie = null;
                enterDinaHome();
            }
            return;
        }

        // Pause via button
        if (consumePause()) { prevState = "cookieCatch"; state = "paused"; return; }

        // ── Plate movement: keys, on-screen buttons, or tap-to-position ──
        var move = 0;
        if (keys.left) move -= 1;
        if (keys.right) move += 1;
        cookie.plateX += move * 360 * dt;
        var click = consumeClick();
        if (click) {
            if (pointInRect(click.x, click.y, PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, PAUSE_RECT.h)) {
                prevState = "cookieCatch"; state = "paused"; playClick(); return;
            }
            // tap moves the plate toward the tap x
            cookie.plateX = click.x;
        }
        // Continuous finger-drag: the plate follows your finger across the screen.
        if (touchX !== null) cookie.plateX = touchX;
        cookie.plateX = clamp(cookie.plateX, COOKIE_PLATE_W / 2, W - COOKIE_PLATE_W / 2);

        // ── Spawn falling items (faster as the round goes) ──
        var progress = 1 - cookie.timer / COOKIE_DURATION;
        cookie.spawnT -= dt;
        if (cookie.spawnT <= 0) {
            // tighter spacing and a faster drop than before — more to track
            cookie.spawnT = rand(0.4, 0.72) * (1 - progress * 0.5);
            var k = pickCookieKind();
            cookie.items.push({
                kind: k, x: rand(30, W - 30), y: -20,
                vy: rand(200, 270) + progress * 170,
                rot: rand(-0.3, 0.3), spin: rand(-2, 2), wob: rand(0, 6.28)
            });
            // late-game double drop keeps the pressure on
            if (progress > 0.55 && Math.random() < 0.4) {
                var k2 = pickCookieKind();
                cookie.items.push({
                    kind: k2, x: rand(30, W - 30), y: -40,
                    vy: rand(220, 290) + progress * 170,
                    rot: rand(-0.3, 0.3), spin: rand(-2, 2), wob: rand(0, 6.28)
                });
            }
        }

        // ── Update items + catch test ──
        for (var i = cookie.items.length - 1; i >= 0; i--) {
            var it = cookie.items[i];
            it.y += it.vy * dt;
            it.rot += it.spin * dt;
            // caught? plate is a flat zone near COOKIE_PLATE_Y
            if (it.y > COOKIE_PLATE_Y - 18 && it.y < COOKIE_PLATE_Y + 16 &&
                Math.abs(it.x - cookie.plateX) < COOKIE_PLATE_W / 2 + 6) {
                if (it.kind.good) {
                    cookie.combo = Math.min(cookie.combo + 1, 9);
                    cookie.comboT = 1.6;
                    var pts = it.kind.points * (1 + Math.floor(cookie.combo / 3));
                    cookie.score += pts;
                    cookie.caught++;
                    spawnFloater(it.x, it.y - 10, "+" + pts, "#FFD700");
                    spawnCoinSparkle(it.x, it.y);
                    playTone(700 + cookie.combo * 60, 0.06, "sine", 0.14);
                    if (cookie.combo >= 3 && cookie.combo % 3 === 0) {
                        cookie.msg = cookie.combo + "x COMBO! 🔥"; cookie.msgT = 1.2;
                    }
                } else {
                    // bomb — lose a life, break combo, shake
                    cookie.lives--;
                    cookie.combo = 0;
                    shakeTimer = 0.35; shakeIntensity = 8;
                    spawnCrashBurst(it.x, it.y, false);
                    playExplosion();
                    cookie.msg = "Ouch! Burnt one! 💥"; cookie.msgT = 1.2;
                    if (cookie.lives <= 0) { endCookieCatch("oops"); }
                }
                cookie.items.splice(i, 1);
                continue;
            }
            // missed a good item off the bottom — gentle combo reset, no life loss
            if (it.y > H + 24) {
                if (it.kind.good) cookie.combo = 0;
                cookie.items.splice(i, 1);
            }
        }

        if (cookie.comboT > 0) cookie.comboT -= dt;
        else cookie.combo = 0;
        if (cookie.msgT > 0) cookie.msgT -= dt;

        // ── Timer ──
        cookie.timer -= dt;
        if (cookie.timer <= 0) { cookie.timer = 0; endCookieCatch("done"); }
    }

    function endCookieCatch(why) {
        cookie.phase = why;       // "done" (time up) or "oops" (out of lives)
        cookie.endT = 0;
        // Drain any tap/action still queued from gameplay so the result screen
        // doesn't instantly auto-dismiss — it waits for a fresh tap.
        consumeAction(); clickQueue = null;
        if (why === "done") {
            playTone(523, 0.1, "triangle", 0.2);
            setTimeout(function () { playTone(659, 0.1, "triangle", 0.2); }, 100);
            setTimeout(function () { playTone(784, 0.12, "triangle", 0.22); }, 200);
            setTimeout(function () { playTone(1046, 0.16, "triangle", 0.22); }, 300);
        } else {
            playWompWomp();
        }
    }

    function drawCookieCatch() {
        if (!cookie) return;
        ctx.save();
        if (shakeTimer > 0) {
            ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        }

        // Cozy kitchen background
        ctx.fillStyle = "#FFF4E0";
        ctx.fillRect(0, 0, W, H);
        // Warm sunbeam
        ctx.fillStyle = "rgba(255, 224, 130, 0.25)";
        ctx.beginPath();
        ctx.moveTo(W * 0.15, 0); ctx.lineTo(W * 0.45, 0);
        ctx.lineTo(W * 0.6, H); ctx.lineTo(W * 0.0, H);
        ctx.closePath(); ctx.fill();
        // Checkered floor band at bottom
        for (var fx = 0; fx < W; fx += 40) {
            ctx.fillStyle = ((fx / 40) % 2 === 0) ? "#F4D9B0" : "#EBC998";
            ctx.fillRect(fx, H - 70, 40, 70);
        }
        // Counter line
        ctx.fillStyle = "#C8A878";
        ctx.fillRect(0, H - 72, W, 4);

        // Falling items
        for (var i = 0; i < cookie.items.length; i++) {
            var it = cookie.items[i];
            ctx.save();
            ctx.translate(it.x, it.y);
            ctx.rotate(it.rot);
            // soft shadow disk for readability
            ctx.fillStyle = "rgba(0,0,0,0.10)";
            ctx.beginPath(); ctx.ellipse(0, 2, 15, 15, 0, 0, Math.PI * 2); ctx.fill();
            ctx.font = "28px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(it.kind.emoji, 0, 0);
            ctx.restore();
        }

        // Particles (sparkles / bomb debris)
        drawParticles();

        // ── Plate (Dina holds it) ──
        var px = cookie.plateX, py = COOKIE_PLATE_Y;
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.beginPath(); ctx.ellipse(px, py + 18, COOKIE_PLATE_W / 2 + 4, 9, 0, 0, Math.PI * 2); ctx.fill();
        // plate dish
        ctx.fillStyle = "#FF8FB8";
        roundRect(px - COOKIE_PLATE_W / 2, py - 6, COOKIE_PLATE_W, 18, 9); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        roundRect(px - COOKIE_PLATE_W / 2 + 6, py - 3, COOKIE_PLATE_W - 12, 7, 4); ctx.fill();
        // Dina's hands at the plate ends
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(px - COOKIE_PLATE_W / 2, py + 4, 8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + COOKIE_PLATE_W / 2, py + 4, 8, 0, Math.PI * 2); ctx.fill();
        // Dina face peeking below the plate
        ctx.fillStyle = "#FFE0CC";
        ctx.beginPath(); ctx.arc(px, py + 44, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#5D4037";
        ctx.beginPath(); ctx.arc(px, py + 30, 28, Math.PI, Math.PI * 2); ctx.fill(); // hair fringe
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(px - 8, py + 42, 2.4, 0, Math.PI * 2);
        ctx.arc(px + 8, py + 42, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#C2185B"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py + 46, 6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();

        ctx.restore(); // end shake

        // ── HUD ──
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(0, 0, W, 50, 0); ctx.fill();
        drawText("🍪 Cookie Catch", W / 2, 18, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 4);
        var lowT = cookie.timer <= 5 && cookie.phase === "play";
        var tCol = lowT ? (Math.sin(gameTime * 12) > 0 ? "#FF5252" : "#FFEB3B") : "#FFF";
        drawText("⏱ " + Math.ceil(cookie.timer) + "s", W - 14, 18,
            "bold " + (lowT ? 17 : 15) + "px 'Segoe UI', Arial, sans-serif", tCol, "#000", 3, "right");
        // Score, with the entry fee shown so the player knows what to beat.
        var profit = cookie.score - cookie.fee;
        var scoreCol = profit >= 0 ? "#7CFC4F" : "#FFD700";
        drawText("$" + cookie.score + "  (fee $" + cookie.fee + ")", 14, 18,
            "bold 14px 'Segoe UI', Arial, sans-serif", scoreCol, "#000", 2, "left");
        // lives as hearts
        var hh = "";
        for (var L = 0; L < cookie.lives; L++) hh += "♥";
        drawText(hh || "—", 14, 36, "bold 13px Arial", "#FF80AB", "#000", 2, "left");

        // Combo + toast message
        if (cookie.combo >= 2 && cookie.phase === "play") {
            drawText(cookie.combo + "x", W / 2, 40, "bold 14px Arial", "#FF8A65", "#000", 2);
        }
        if (cookie.msgT > 0) {
            var ma = clamp(cookie.msgT, 0, 1);
            ctx.globalAlpha = ma;
            drawText(cookie.msg, W / 2, 80, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#000", 3);
            ctx.globalAlpha = 1;
        }

        // Pause button
        drawIconButton(PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, "❚❚", { bg: "#FFFFFF", bgDark: "#BDBDBD" });

        // Plate is dragged with a finger now — no on-screen arrows.
        if (cookie.phase === "play") {
            drawText(isTouchDevice ? "Drag to catch treats · dodge 💣"
                                   : "◀ ▶ / move mouse to catch · dodge 💣", W / 2, H - 14,
                "12px Arial", "#7A5230", null, 0);
        }

        // ── End overlay ──
        if (cookie.phase !== "play") {
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(0, 0, W, H);
            var win = cookie.phase === "done";
            var net = cookie.score - cookie.fee;
            drawText(win ? "🍪 YUM! 🍪" : "Out of cookies! 💥", W / 2, H / 2 - 100,
                "bold 30px 'Segoe UI', Arial, sans-serif", win ? "#FFD700" : "#FF8A80", "#000", 6);
            drawText("Caught " + cookie.caught + " treats", W / 2, H / 2 - 52,
                "bold 18px Arial", "#FFFFFF", "#000", 3);
            // Show the math: earned vs the fee paid, then the net result.
            drawText("Earned $" + cookie.score + "   ·   Fee $" + cookie.fee, W / 2, H / 2 - 16,
                "bold 14px Arial", "#FFE0B2", "#000", 2);
            drawText((net >= 0 ? "Profit +$" : "Lost $") + Math.abs(net), W / 2, H / 2 + 26,
                "bold 34px 'Segoe UI', Arial, sans-serif", net >= 0 ? "#7CFC4F" : "#FF8A80", "#000", 5);
            if (cookie.endT > 1.0) {
                drawText("Tap to head back", W / 2, H / 2 + 78, "15px Arial", "#FFFFFF", "#000", 2);
            }
        }
    }

    // ── Mobile ads (AdMob via Capacitor) ─────────────────────
    // No-op on the web build (lulu.boats). Only activates inside the native
    // iOS/Android wrapper, where window.Capacitor.Plugins.AdMob exists. Every
    // call is guarded + wrapped in try/catch so a missing or mismatched plugin
    // can never throw into the game loop — the game just runs ad-free.
    //
    // These are the REAL AdMob ad unit IDs for Lulu's Road Trip.
    // AdMob App ID (goes in Info.plist, injected by codemagic.yaml):
    //   ca-app-pub-1477782549591980~6348467252
    //
    // isTesting:false serves LIVE ads — this is the App Store release setting.
    // ⚠️ NEVER tap your own live ads: it can get the AdMob account banned. To
    // test safely on your own phone, add that device's AdMob test-device ID to
    // `testingDevices` below (printed in the Xcode/device console on first ad
    // request) — it will then see Google TEST ads even though isTesting is false.
    var ADMOB = {
        interstitialId: "ca-app-pub-1477782549591980/3654325071", // real interstitial
        rewardedId:     "ca-app-pub-1477782549591980/2341243403", // real rewarded
        isTesting: false,        // false = LIVE ads (App Store release)
        testingDevices: [],      // add your device's test-device ID(s) to stay safe
        interstitialEveryN: 2    // show an interstitial every Nth game over
    };

    var Ads = (function () {
        function plugin() {
            try {
                if (typeof window === "undefined" || !window.Capacitor) return null;
                var cap = window.Capacitor;
                if (!cap.isNativePlatform || !cap.isNativePlatform()) return null;
                return (cap.Plugins && cap.Plugins.AdMob) || null;
            } catch (e) { return null; }
        }

        var ready = false;
        var rewardedReady = false;
        var gameOverCount = 0;
        var rewardCb = null;

        function prepInterstitial() {
            var AdMob = plugin(); if (!AdMob) return;
            try {
                var p = AdMob.prepareInterstitial({
                    adId: ADMOB.interstitialId, isTesting: ADMOB.isTesting
                });
                if (p && p.catch) p.catch(function () {});
            } catch (e) {}
        }

        function prepRewarded() {
            var AdMob = plugin(); if (!AdMob) return;
            rewardedReady = false;
            try {
                var p = AdMob.prepareRewardVideoAd && AdMob.prepareRewardVideoAd({
                    adId: ADMOB.rewardedId, isTesting: ADMOB.isTesting
                });
                if (p && p.then) p.then(function () { rewardedReady = true; })
                                  .catch(function () {});
            } catch (e) {}
        }

        function init() {
            var AdMob = plugin(); if (!AdMob) return; // web → stay silent
            try {
                var p = AdMob.initialize({
                    initializeForTesting: ADMOB.isTesting,
                    testingDevices: ADMOB.testingDevices
                });
                Promise.resolve(p).then(function () {
                    ready = true;
                    prepInterstitial();
                    prepRewarded();
                    // Reward event (string is stable across plugin v6–v8).
                    try {
                        AdMob.addListener("onRewardedVideoAdReward", function () {
                            if (rewardCb) { var cb = rewardCb; rewardCb = null; cb(); }
                        });
                    } catch (e) {}
                }).catch(function () {}); // ads unavailable → game continues fine
            } catch (e) {}
        }

        return {
            init: init,
            // Call when entering game-over. Frequency-capped; preloads the next.
            onGameOver: function () {
                var AdMob = plugin(); if (!AdMob || !ready) return;
                gameOverCount++;
                if (gameOverCount % ADMOB.interstitialEveryN !== 0) return;
                try {
                    Promise.resolve(AdMob.showInterstitial())
                        .then(prepInterstitial, prepInterstitial);
                } catch (e) { prepInterstitial(); }
            },
            // True only in the native build with a rewarded ad loaded → gates UI.
            rewardedAvailable: function () { return !!plugin() && rewardedReady; },
            // Show a rewarded ad; onReward() fires once if the user earns it.
            showRewarded: function (onReward) {
                var AdMob = plugin(); if (!AdMob || !rewardedReady) return;
                rewardCb = onReward || null;
                rewardedReady = false;
                try {
                    var show = AdMob.showRewardVideoAd && AdMob.showRewardVideoAd();
                    if (show && show.then) {
                        show.then(function (item) {
                            // Some versions resolve with the reward item too.
                            if (item && rewardCb) { var cb = rewardCb; rewardCb = null; cb(); }
                            prepRewarded();
                        }).catch(function () { rewardCb = null; prepRewarded(); });
                    }
                } catch (e) { rewardCb = null; prepRewarded(); }
            }
        };
    })();

    var lastDispatchState = null;

    function gameLoop(timestamp) {
        var dt = Math.min((timestamp - lastTime) / 1000, 0.05);
        lastTime = timestamp;

      try {
        // Global update tickers (always run)
        updateBtnPressFx(dt);
        updateFloaters(dt);
        updateSceneFade(dt);

        // When the scene changes (via fade or a direct state set), drop any
        // input that belonged to the previous scene — the tap that caused the
        // transition, a half-finished finger-drag — so it can't double-fire or
        // leak into the new scene (this caused stray jumps into other modes).
        if (state !== lastDispatchState) {
            actionQueued = false;
            clickQueue = null;
            pauseQueued = false;
            steerTouchId = null; touchX = null; touchY = null;
            lastDispatchState = state;
        }

        // Background music tracks state changes
        // Map game state → music file track
        var musicTrack = null;
        if (state === "charSelect" || state === "menu" || state === "playing" ||
            state === "crash" || state === "copBust" || state === "gameover" || state === "shop") musicTrack = "lulu";
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

        // Scene fade overlay (drawn on top of everything)
        drawSceneFade();
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
