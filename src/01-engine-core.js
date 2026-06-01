// ============================================================
//  LULU'S ROAD TRIP — A Sneaky-Sasquatch-style driving game
// ============================================================

(function () {
    "use strict";

    // ── Constants ────────────────────────────────────────────
    var W = 480, H = 854;
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
            parkingPerfectRuns: 0,
            luluHair: "#8B5A2B"
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
        if (currentMusicEl && !musicMuted && !audioMuted && audioUnlocked) {
            currentMusicEl.play().catch(function () {});
        }
    }

    function startMusic(track) {
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
    var dpr = window.devicePixelRatio || 1;

    function resizeCanvas() {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeCanvas();

    function fitToScreen() {
        var scaleX = window.innerWidth / W;
        var scaleY = window.innerHeight / H;
        var scale = Math.min(scaleX, scaleY);
        canvas.style.width = Math.floor(W * scale) + "px";
        canvas.style.height = Math.floor(H * scale) + "px";
    }
    fitToScreen();
    window.addEventListener("resize", function () { resizeCanvas(); fitToScreen(); });

    // ── Input ────────────────────────────────────────────────
    var keys = { left: false, right: false, up: false, down: false };
    var actionQueued = false;
    var clickQueue = null; // {x, y} in canvas coords
    var pauseQueued = false;
    var missileQueued = false;
    var honkQueued = false;
    var touchX = null;
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

    // Mobile control button rects — all 64×64 minimum, clear of iPhone home indicator (last ~34px),
    // generous gaps between adjacent buttons. Sized per Mobile Tester + UX Designer recommendations.
    var PAUSE_RECT        = { x: 8,        y: 60,       w: 48, h: 48 };
    var MOBILE_BOOST_RECT = { x: 14,       y: H - 168,  w: 64, h: 64 }; // upper of left stack
    var MOBILE_BRAKE_RECT = { x: 14,       y: H - 96,   w: 64, h: 64 }; // lower of left stack
    var MISSILE_RECT      = { x: W - 78,   y: H - 96,   w: 64, h: 64 };
    var HONK_RECT         = { x: W - 78,   y: H - 168,  w: 64, h: 64 };
    // Parking-only D-pad buttons (different layout from main game)
    var PARK_LEFT_RECT  = { x: 12,       y: H - 96, w: 64, h: 64 };
    var PARK_RIGHT_RECT = { x: 88,       y: H - 96, w: 64, h: 64 };
    var PARK_FWD_RECT   = { x: W - 152,  y: H - 96, w: 64, h: 64 };
    var PARK_REV_RECT   = { x: W - 76,   y: H - 96, w: 64, h: 64 };

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
        return null;
    }

    function screenToCanvas(clientX, clientY) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) / rect.width * W,
            y: (clientY - rect.top) / rect.height * H
        };
    }

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
                parkLeftTouchId = t.identifier;
            } else if (btn === "parkRight") {
                keys.right = true;
                parkRightTouchId = t.identifier;
            } else if (btn === "parkFwd") {
                keys.up = true;
                parkFwdTouchId = t.identifier;
            } else if (btn === "parkRev") {
                keys.down = true;
                parkRevTouchId = t.identifier;
            } else {
                // Not a button — register click (for menu/shop/game-over) and start steering
                clickQueue = pos;
                queueAction();
                if (state === "playing" && steerTouchId === null) {
                    steerTouchId = t.identifier;
                    touchX = pos.x;
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
            }
        }
    }, { passive: false });

    function releaseTouchId(id) {
        if (id === steerTouchId) { steerTouchId = null; touchX = null; }
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
        if (type < 0.45) {
            d.type = "tree"; d.scale = rand(0.7, 1.1); d.swayOffset = rand(0, Math.PI * 2);
        } else if (type < 0.7) {
            d.type = "bush"; d.scale = rand(0.6, 1.0); d.bounceOffset = rand(0, Math.PI * 2);
        } else if (type < 0.85) {
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

    // ── Drawing: Environment ─────────────────────────────────
    function drawTree(x, y, scale, time, swayOff) {
        var s = scale || 1;
        var sway = Math.sin(time * 1.5 + (swayOff || 0)) * 2;
        ctx.save();
        ctx.translate(x + sway, y);
        ctx.scale(s, s);
        ctx.fillStyle = C.trunkDark;
        roundRect(-7, -8, 14, 30, 3); ctx.fill();
        ctx.fillStyle = C.trunk;
        roundRect(-5, -6, 10, 26, 2); ctx.fill();
        for (var i = 0; i < 3; i++) {
            var cx = [-10, 10, 0][i], cy = [-26, -24, -34][i], r = [14, 13, 16][i];
            ctx.fillStyle = "#1B5E20";
            ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.tree[i];
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    function drawBush(x, y, scale, time, bounceOff) {
        var s = (scale || 1) * (1 + Math.sin(time * 2 + (bounceOff || 0)) * 0.03);
        ctx.save();
        ctx.translate(x, y); ctx.scale(s, s);
        for (var i = 0; i < 3; i++) {
            var bx = [-9, 9, 0][i], by = [-2, -1, -8][i];
            var rx = [13, 12, 14][i], ry = [9, 8, 11][i];
            ctx.fillStyle = "#1B5E20";
            ctx.beginPath(); ctx.ellipse(bx, by, rx + 2, ry + 2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.bush[i];
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

    function drawDecorations(time) {
        for (var i = 0; i < decorations.length; i++) {
            var d = decorations[i];
            if (d.type === "tree") drawTree(d.x, d.y, d.scale, time, d.swayOffset);
            else if (d.type === "bush") drawBush(d.x, d.y, d.scale, time, d.bounceOffset);
            else if (d.type === "flower") drawFlower(d.x, d.y, d.color, d.scale);
            else if (d.type === "fence") drawFence(d.x, d.y, d.width);
        }
    }

    function drawRoad(scrollOff) {
        // Sky-to-grass gradient for depth
        var skyGrad = ctx.createLinearGradient(0, 0, 0, H);
        skyGrad.addColorStop(0, "#A8E6CF");
        skyGrad.addColorStop(0.35, "#7CCB7E");
        skyGrad.addColorStop(1, "#5BA85D");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = C.grass2;
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