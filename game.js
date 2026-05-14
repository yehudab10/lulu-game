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
            distractedUnlocked: false
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
    var touchX = null;
    var steerTouchId = null;
    var boostTouchId = null;
    var brakeTouchId = null;
    var isTouchDevice = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);

    function queueAction() { actionQueued = true; }
    function consumeAction() { if (actionQueued) { actionQueued = false; return true; } return false; }
    function consumeClick() { var c = clickQueue; clickQueue = null; return c; }
    function consumePause() { if (pauseQueued) { pauseQueued = false; return true; } return false; }
    function consumeMissile() { if (missileQueued) { missileQueued = false; return true; } return false; }

    // Mobile control button rects (used by both drawing and touch hit-test)
    var MOBILE_BOOST_RECT = { x: 12, y: 686, w: 56, h: 56 };
    var MOBILE_BRAKE_RECT = { x: 12, y: 750, w: 56, h: 56 };
    var PAUSE_RECT        = { x: 10, y: 65,  w: 40, h: 40 };
    var MISSILE_RECT      = { x: W - 80, y: H - 90, w: 64, h: 64 };

    function hitGameButton(pos) {
        if (state !== "playing") return null;
        if (pointInRect(pos.x, pos.y, PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, PAUSE_RECT.h)) return "pause";
        if (pointInRect(pos.x, pos.y, MISSILE_RECT.x, MISSILE_RECT.y, MISSILE_RECT.w, MISSILE_RECT.h)) return "missile";
        if (pointInRect(pos.x, pos.y, MOBILE_BOOST_RECT.x, MOBILE_BOOST_RECT.y, MOBILE_BOOST_RECT.w, MOBILE_BOOST_RECT.h)) return "boost";
        if (pointInRect(pos.x, pos.y, MOBILE_BRAKE_RECT.x, MOBILE_BRAKE_RECT.y, MOBILE_BRAKE_RECT.w, MOBILE_BRAKE_RECT.h)) return "brake";
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
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            var pos = screenToCanvas(t.clientX, t.clientY);
            var btn = hitGameButton(pos);

            if (btn === "pause") {
                pauseQueued = true;
            } else if (btn === "missile") {
                missileQueued = true;
            } else if (btn === "boost") {
                keys.up = true;
                boostTouchId = t.identifier;
            } else if (btn === "brake") {
                keys.down = true;
                brakeTouchId = t.identifier;
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

    canvas.addEventListener("touchend", function (e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            if (t.identifier === steerTouchId) {
                steerTouchId = null;
                touchX = null;
            } else if (t.identifier === boostTouchId) {
                keys.up = false;
                boostTouchId = null;
            } else if (t.identifier === brakeTouchId) {
                keys.down = false;
                brakeTouchId = null;
            }
        }
    }, { passive: false });

    canvas.addEventListener("touchcancel", function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            if (t.identifier === steerTouchId) { steerTouchId = null; touchX = null; }
            if (t.identifier === boostTouchId) { keys.up = false; boostTouchId = null; }
            if (t.identifier === brakeTouchId) { keys.down = false; brakeTouchId = null; }
        }
    }, { passive: false });

    canvas.addEventListener("mousedown", function (e) {
        getAudio();
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
        ctx.fillStyle = C.grass1;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = C.grass2;
        for (var gy = ((scrollOff * 0.3) % 40) - 40; gy < H; gy += 40) {
            ctx.fillRect(0, gy, W, 18);
        }
        ctx.fillStyle = C.shoulder;
        roundRect(ROAD_L - 8, 0, ROAD_W + 16, H, 0); ctx.fill();
        ctx.fillStyle = C.road;
        ctx.fillRect(ROAD_L, 0, ROAD_W, H);

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

        // ── Lulu's face (feminine) ──
        // Big curly hair backdrop
        ctx.fillStyle = C.hair;
        ctx.beginPath();
        ctx.arc(0, -hh + 24, 11, 0, Math.PI * 2);
        ctx.fill();
        // side curls
        ctx.beginPath();
        ctx.ellipse(-9, -hh + 24, 5, 7, -0.3, 0, Math.PI * 2);
        ctx.ellipse(9, -hh + 24, 5, 7, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Face
        ctx.fillStyle = C.skin;
        ctx.beginPath();
        ctx.arc(0, -hh + 22, 7.5, 0, Math.PI * 2);
        ctx.fill();

        // Hair bangs / top
        ctx.fillStyle = C.hair;
        ctx.beginPath();
        ctx.arc(0, -hh + 16, 8.5, Math.PI, Math.PI * 2);
        ctx.fill();
        // little bangs sweep
        ctx.beginPath();
        ctx.ellipse(-2, -hh + 17, 6, 3, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Hair bow (pink!)
        ctx.fillStyle = "#FF4081";
        ctx.beginPath();
        ctx.ellipse(-6, -hh + 13, 3.5, 2.5, -0.3, 0, Math.PI * 2);
        ctx.ellipse(-2, -hh + 13, 3.5, 2.5, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#C2185B";
        ctx.beginPath();
        ctx.arc(-4, -hh + 13, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (bigger, more anime-style)
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.ellipse(-3, -hh + 20.5, 2.2, 2.6, 0, 0, Math.PI * 2);
        ctx.ellipse(3, -hh + 20.5, 2.2, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#5D4037";
        ctx.beginPath();
        ctx.ellipse(-3, -hh + 21, 1.3, 1.8, 0, 0, Math.PI * 2);
        ctx.ellipse(3, -hh + 21, 1.3, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();
        // Eye sparkle
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(-2.5, -hh + 20.3, 0.5, 0, Math.PI * 2);
        ctx.arc(3.5, -hh + 20.3, 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Eyelashes
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-4.8, -hh + 19); ctx.lineTo(-5.5, -hh + 18);
        ctx.moveTo(-3, -hh + 18.5); ctx.lineTo(-3, -hh + 17.5);
        ctx.moveTo(-1.2, -hh + 19); ctx.lineTo(-0.5, -hh + 18);
        ctx.moveTo(1.2, -hh + 19); ctx.lineTo(0.5, -hh + 18);
        ctx.moveTo(3, -hh + 18.5); ctx.lineTo(3, -hh + 17.5);
        ctx.moveTo(4.8, -hh + 19); ctx.lineTo(5.5, -hh + 18);
        ctx.stroke();

        // Blush
        ctx.fillStyle = "rgba(255, 105, 135, 0.5)";
        ctx.beginPath();
        ctx.ellipse(-5, -hh + 23, 1.8, 1.2, 0, 0, Math.PI * 2);
        ctx.ellipse(5, -hh + 23, 1.8, 1.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Lips (pink/red)
        ctx.fillStyle = C.lips;
        ctx.beginPath();
        ctx.ellipse(0, -hh + 25, 2.2, 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FF80AB";
        ctx.beginPath();
        ctx.ellipse(0, -hh + 24.7, 1.5, 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

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

        // Headlights
        ctx.fillStyle = "#FFF9C4";
        ctx.beginPath();
        ctx.ellipse(-hw + 10, -hh + 2, 5, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(hw - 10, -hh + 2, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Taillights
        ctx.fillStyle = "#F44336";
        ctx.beginPath();
        ctx.ellipse(-hw + 10, hh - 4, 4, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(hw - 10, hh - 4, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();

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

        // Head
        ctx.fillStyle = "#333";
        ctx.beginPath(); ctx.arc(0, -14, 7.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin;
        ctx.beginPath(); ctx.arc(0, -14, 6.5, 0, Math.PI * 2); ctx.fill();

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

        // Eyes
        ctx.fillStyle = "#222";
        ctx.beginPath();
        ctx.arc(-2, -13, 0.9, 0, Math.PI * 2);
        ctx.arc(2, -13, 0.9, 0, Math.PI * 2);
        ctx.fill();

        // Mouth (surprised because car is coming!)
        ctx.fillStyle = "#222";
        ctx.beginPath();
        ctx.ellipse(0, -10, 1, 1.2, 0, 0, Math.PI * 2);
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

        // White hair (spiky messy)
        ctx.fillStyle = "#FAFAFA";
        // big puff of white hair
        ctx.beginPath();
        ctx.arc(-5, -22, 5, 0, Math.PI * 2);
        ctx.arc(0, -24, 5.5, 0, Math.PI * 2);
        ctx.arc(5, -22, 5, 0, Math.PI * 2);
        ctx.arc(-8, -19, 4, 0, Math.PI * 2);
        ctx.arc(8, -19, 4, 0, Math.PI * 2);
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
    }

    function drawIconButton(x, y, size, icon, opts) {
        opts = opts || {};
        var bg = opts.bg || "#FFC107";
        var bgDark = opts.bgDark || "#FF6F00";
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        roundRect(x, y + 3, size, size, 8); ctx.fill();
        ctx.fillStyle = bgDark;
        roundRect(x, y, size, size, 8); ctx.fill();
        ctx.fillStyle = bg;
        roundRect(x + 2, y + 2, size - 4, size - 5, 6); ctx.fill();
        drawText(icon, x + size / 2, y + size / 2, "bold " + Math.floor(size * 0.55) + "px Arial", "#FFFFFF", "#000", 3);
    }

    function drawHUD() {
        // Score
        drawText(formatNum(Math.floor(score)), 70, 36, "bold 28px 'Segoe UI', Arial, sans-serif", C.hud, C.hudShadow, 5);
        drawText("SCORE", 70, 14, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 3);

        // Coins (current run)
        drawCoin(W - 100, 26, gameTime);
        drawText("× " + runCoins, W - 70, 27, "bold 20px 'Segoe UI', Arial, sans-serif", C.coin, C.hudShadow, 4, "left");

        // Hearts
        for (var i = 0; i < MAX_LIVES; i++) {
            drawHeart(W / 2 - 28 + i * 28, 30, i < lives);
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
        drawIconButton(PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, "❚❚", { bg: "#FFFFFF", bgDark: "#BDBDBD" });

        // Mobile boost/brake buttons (only show on touch devices)
        if (isTouchDevice) {
            drawIconButton(MOBILE_BOOST_RECT.x, MOBILE_BOOST_RECT.y, MOBILE_BOOST_RECT.w,
                "▲", { bg: keys.up ? "#FFEB3B" : "#FFC107", bgDark: "#FF6F00" });
            drawIconButton(MOBILE_BRAKE_RECT.x, MOBILE_BRAKE_RECT.y, MOBILE_BRAKE_RECT.w,
                "▼", { bg: keys.down ? "#64B5F6" : "#90CAF9", bgDark: "#1565C0" });
        }

        // Missile button (bottom-right)
        var mY = MISSILE_RECT.y;
        drawIconButton(MISSILE_RECT.x, mY, MISSILE_RECT.w, "🚀", { bg: save.missiles > 0 ? "#F44336" : "#9E9E9E", bgDark: save.missiles > 0 ? "#B71C1C" : "#616161" });
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
    }

    // ── State & Globals ──────────────────────────────────────
    var state = "menu";
    var prevState = "menu"; // for pause to know what to return to
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
    var animals = [];
    var missiles = [];

    var spawnClocks = { car: 0, cone: 0, puddle: 0, animal: 0, coin: 0, ped: 0 };

    // Shop UI state
    var shopTab = "skins"; // skins, powerups, special
    var lastBoughtMessage = "";
    var lastBoughtTimer = 0;

    function resetGame() {
        player.x = W / 2; player.targetX = W / 2; player.tilt = 0;
        score = 0; runCoins = 0; lives = MAX_LIVES;
        gameSpeed = BASE_SPEED; scrollOffset = 0; gameTime = 0;
        invincibleTimer = 0; shakeTimer = 0; flashTimer = 0; crashTimer = 0;
        obstacles = []; coinEntities = []; animals = []; missiles = []; particles = [];
        spawnClocks = { car: 0, cone: 0, puddle: 0, animal: 0, coin: 0, ped: 0 };
        passengers = []; passengerTimer = 0;
        crashPhase = 0; crashPhaseTimer = 0; angryMan = null; revengeCar = null;
        initDecorations();
    }

    // ── Spawning ─────────────────────────────────────────────
    function spawnObstacle(type) {
        var lane = randInt(0, 2);
        var x = LANES[lane];
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
                lane: lane
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

    function fireMissile() {
        if (save.missiles <= 0) { playDeny(); return; }
        save.missiles--; persistSave();
        missiles.push({ x: player.x, y: player.y - CAR_H / 2, hitW: 14, hitH: 24, time: 0 });
        playMissile();
    }

    var PASSENGER_SHIRT_COLORS = ["#E91E63", "#FFC107", "#43A047", "#2196F3", "#FF5722", "#9C27B0"];
    var PASSENGER_HAIR_COLORS  = ["#FFC107", "#3E2723", "#6D4C41", "#FAFAFA", "#E91E63", "#FF9800"];

    function pickUpPassenger(ped) {
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

    // ── Update: Playing ──────────────────────────────────────
    function updatePlaying(dt) {
        gameTime += dt;
        var baseGameSpeed = Math.min(BASE_SPEED + gameTime * SPEED_RAMP, MAX_SPEED);
        // Speed control: up = boost, down = slow
        var speedMod = 1;
        if (keys.up) speedMod = 1.6;
        else if (keys.down) speedMod = 0.5;
        gameSpeed = baseGameSpeed * speedMod;
        scrollOffset += gameSpeed * dt;
        var scoreMult = distractedMode ? 2 : 1;
        var coinMult = passengerTimer > 0 ? 2 : 1;
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
        if (spawnClocks.puddle <= 0) { spawnClocks.puddle = rand(4, 8) * speedFactor; spawnObstacle("puddle"); }
        if (spawnClocks.ped <= 0 && gameTime > 15) {
            spawnClocks.ped = rand(5, 10) * speedFactor;
            spawnObstacle("ped");
        }
        if (spawnClocks.animal <= 0) { spawnClocks.animal = rand(8, 14); spawnAnimal(); }
        if (spawnClocks.coin <= 0) {
            spawnClocks.coin = rand(0.6, 1.4);
            if (Math.random() > 0.75) spawnCoinLine(); else spawnCoin();
        }

        // Missile firing
        if (consumeMissile()) fireMissile();

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

        // Update obstacles
        for (var i = obstacles.length - 1; i >= 0; i--) {
            var o = obstacles[i];
            o.y += gameSpeed * o.speedMult * dt;
            if (o.walkTime !== undefined) o.walkTime += dt;
            if (o.y > H + 100) { obstacles.splice(i, 1); continue; }

            if (aabb(player.x, player.y, CAR_W * 0.7, CAR_H * 0.7, o.x, o.y, o.hitW, o.hitH)) {
                if (o.type === "ped") {
                    // Pick up the pedestrian as passenger! Always (even during invincibility).
                    pickUpPassenger(o);
                    obstacles.splice(i, 1);
                    continue;
                }
                if (invincibleTimer <= 0) hitPlayer(o);
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
            if (!c.collected && aabb(player.x, player.y, CAR_W, CAR_H * 0.8, c.x, c.y, c.hitW, c.hitH)) {
                c.collected = true;
                runCoins += coinMult;
                save.totalCoins += coinMult;
                persistSave();
                score += 100 * scoreMult * coinMult;
                spawnCoinSparkle(c.x, c.y);
                playCoin();
                coinEntities.splice(j, 1);
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

        updateDecorations(dt, gameSpeed);
        updateParticles(dt);
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

    // ── Update: Paused ───────────────────────────────────────
    function updatePaused(dt) {
        var click = consumeClick();
        if (click) {
            // Resume button
            if (pointInRect(click.x, click.y, W / 2 - 100, H / 2 - 20, 200, 60)) {
                state = prevState; playClick(); consumeAction(); return;
            }
            // Quit button
            if (pointInRect(click.x, click.y, W / 2 - 100, H / 2 + 60, 200, 60)) {
                state = "menu"; playClick(); consumeAction(); return;
            }
            // Click outside buttons: do nothing (don't fall through to resume)
            consumeAction();
            return;
        }
        if (consumePause() || consumeAction()) {
            state = prevState;
            playClick();
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
            }
            return;
        }
    }

    // ── Update: Game Over ────────────────────────────────────
    function updateGameOver(dt) {
        gameOverAlpha = Math.min(gameOverAlpha + dt * 2, 1);
        updateParticles(dt);
        var click = consumeClick();
        if (click) {
            // Restart button
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.78 - 30, 220, 60)) {
                resetGame(); state = "playing"; playClick(); return;
            }
            // Menu button
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.88 - 25, 220, 50)) {
                state = "menu"; playClick(); return;
            }
        }
        if (consumeAction()) {
            resetGame(); state = "playing";
        }
    }

    // ── Update: Menu ─────────────────────────────────────────
    function updateMenu(dt) {
        menuBounce += dt;
        updateDecorations(dt, 80);
        var click = consumeClick();
        if (click) {
            // PLAY button
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.55, 220, 64)) {
                resetGame(); state = "playing"; playClick(); return;
            }
            // SHOP button
            if (pointInRect(click.x, click.y, W / 2 - 110, H * 0.55 + 80, 220, 56)) {
                state = "shop"; shopTab = "skins"; playClick(); return;
            }
            // Distracted mode toggle (if unlocked)
            if (save.distractedUnlocked &&
                pointInRect(click.x, click.y, W / 2 - 110, H * 0.55 + 150, 220, 44)) {
                distractedMode = !distractedMode; playClick(); return;
            }
            // Mute button
            if (pointInRect(click.x, click.y, W - 56, 16, 40, 40)) {
                audioMuted = !audioMuted; playClick(); return;
            }
            // Default: any click starts game
            if (click.y > H * 0.3 && click.y < H * 0.5) {
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
        if (pointInRect(click.x, click.y, 16, 16, 80, 40)) {
            state = "menu"; playClick(); return;
        }

        // Tabs
        var tabY = 100, tabH = 38, tabW = W / 3;
        if (pointInRect(click.x, click.y, 0, tabY, tabW, tabH)) { shopTab = "skins"; playClick(); return; }
        if (pointInRect(click.x, click.y, tabW, tabY, tabW, tabH)) { shopTab = "powerups"; playClick(); return; }
        if (pointInRect(click.x, click.y, tabW * 2, tabY, tabW, tabH)) { shopTab = "special"; playClick(); return; }

        // Items
        if (shopTab === "skins") {
            var keys = Object.keys(SKINS);
            for (var i = 0; i < keys.length; i++) {
                var col = i % 2, row = Math.floor(i / 2);
                var cx = 20 + col * 230, cy = 165 + row * 145;
                if (pointInRect(click.x, click.y, cx, cy, 210, 130)) {
                    var key = keys[i];
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

    // ── Draw: Playing ────────────────────────────────────────
    function drawPlaying() {
        ctx.save();
        if (shakeTimer > 0) {
            ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));
        }

        drawRoad(scrollOffset);
        drawDecorations(gameTime);

        for (var i = 0; i < obstacles.length; i++) {
            if (obstacles[i].type === "puddle") drawPuddle(obstacles[i].x, obstacles[i].y);
        }

        for (var j = 0; j < coinEntities.length; j++) {
            if (!coinEntities[j].collected) drawCoin(coinEntities[j].x, coinEntities[j].y, gameTime);
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
            if (o.type === "car") drawEnemyCar(o.x, o.y, o.color, o.carType);
            else if (o.type === "ped") drawPedestrian(o.x, o.y, o.walkTime, o.pedType);
        }

        // Missiles
        for (var mm = 0; mm < missiles.length; mm++) {
            drawMissile(missiles[mm].x, missiles[mm].y, missiles[mm].time);
        }

        // Player (or crashed car if state === crash)
        if (state === "crash") {
            drawLuluCar(crashX, crashY, crashRot, false, gameTime, distractedMode);
        } else {
            drawLuluCar(player.x, player.y, player.tilt, invincibleTimer > 0, gameTime, distractedMode);
        }

        drawParticles();

        if (flashTimer > 0) {
            ctx.fillStyle = "rgba(255,0,0," + (flashTimer / 0.15 * 0.3) + ")";
            ctx.fillRect(-20, -20, W + 40, H + 40);
        }

        ctx.restore();
        drawHUD();
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

    // ── Draw: Paused ─────────────────────────────────────────
    function drawPaused() {
        drawPlaying();
        // overlay
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, W, H);
        drawText("PAUSED", W / 2, H / 2 - 100, "bold 64px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 6);

        // Resume button
        drawButton(W / 2 - 100, H / 2 - 20, 200, 60, "RESUME", { bg: "#66BB6A", bgDark: "#2E7D32" });
        // Quit button
        drawButton(W / 2 - 100, H / 2 + 60, 200, 60, "QUIT TO MENU", { bg: "#EF5350", bgDark: "#B71C1C", small: true });

        drawText("Press P or ESC to resume", W / 2, H / 2 + 160, "14px 'Segoe UI', Arial, sans-serif", "#BBB", "#000", 2);
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

        ctx.fillStyle = C.shoulder;
        roundRect(ROAD_L - 8, 0, ROAD_W + 16, H, 0); ctx.fill();
        ctx.fillStyle = C.road;
        ctx.fillRect(ROAD_L, 0, ROAD_W, H);

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
        drawIconButton(W - 56, 16, 40, audioMuted ? "🔇" : "🔊", { bg: "#FFFFFF", bgDark: "#BDBDBD" });

        // PLAY button
        drawButton(W / 2 - 110, H * 0.55, 220, 64, "▶ PLAY", { bg: "#66BB6A", bgDark: "#2E7D32" });
        // SHOP button
        drawButton(W / 2 - 110, H * 0.55 + 80, 220, 56, "🛒 SHOP", { bg: "#FFC107", bgDark: "#FF6F00" });

        // Distracted mode toggle
        if (save.distractedUnlocked) {
            var label = "DISTRACTED: " + (distractedMode ? "ON" : "OFF");
            var c1 = distractedMode ? "#FF80AB" : "#9E9E9E";
            var c2 = distractedMode ? "#C2185B" : "#616161";
            drawButton(W / 2 - 110, H * 0.55 + 150, 220, 44, label, { bg: c1, bgDark: c2, small: true });
        }

        // High score
        if (save.highScore > 0) {
            drawText("Best: " + formatNum(save.highScore), W / 2, H * 0.84,
                "bold 16px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#333", 3);
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
        drawButton(16, 16, 80, 40, "◀ BACK", { bg: "#90A4AE", bgDark: "#455A64", small: true });

        // Title
        drawText("SHOP", W / 2, 38, "bold 36px 'Segoe UI', Arial, sans-serif", "#FFD700", "#000", 5);

        // Coin balance
        drawCoin(W - 100, 36, menuBounce);
        drawText(formatNum(save.totalCoins), W - 86, 38, "bold 22px 'Segoe UI', Arial, sans-serif", C.coin, "#000", 4, "left");

        // Tabs
        var tabY = 100, tabH = 38, tabW = W / 3;
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
        var keys = Object.keys(SKINS);
        for (var i = 0; i < keys.length; i++) {
            var col = i % 2, row = Math.floor(i / 2);
            var cx = 20 + col * 230, cy = 165 + row * 145;
            var key = keys[i];
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

    // ── Main Loop ────────────────────────────────────────────
    var lastTime = 0;

    function gameLoop(timestamp) {
        var dt = Math.min((timestamp - lastTime) / 1000, 0.05);
        lastTime = timestamp;

        if (state === "menu") updateMenu(dt);
        else if (state === "playing") updatePlaying(dt);
        else if (state === "paused") updatePaused(dt);
        else if (state === "crash") updateCrash(dt);
        else if (state === "gameover") updateGameOver(dt);
        else if (state === "shop") updateShop(dt);

        ctx.clearRect(0, 0, W, H);

        if (state === "menu") drawMenu();
        else if (state === "playing") drawPlaying();
        else if (state === "paused") drawPaused();
        else if (state === "crash") drawCrash();
        else if (state === "gameover") drawGameOver();
        else if (state === "shop") drawShop();

        requestAnimationFrame(gameLoop);
    }

    // ── Init ─────────────────────────────────────────────────
    initDecorations();
    requestAnimationFrame(function (ts) { lastTime = ts; gameLoop(ts); });

})();
