    // ══════════════════════════════════════════════════════════════════════
    //  BLING  (shop tab "Bling ✨") — coin sinks for players who own every car.
    //  · HORNS: Lulu's own honk (the Honk Symphony still climbs the scale —
    //    every horn is pitched by the chain note). NPC honks stay the beep.
    //  · CAR BLING: one decoration drawn on top of Lulu's car everywhere her
    //    own car is drawn (menu, driving, parked on foot, story map).
    //  First tap on a locked item previews it (hear the horn / see it on the
    //  preview car); a second tap buys it. Owned items equip with one tap.
    // ══════════════════════════════════════════════════════════════════════

    var HORNS = [
        { id: "beep",      icon: "📢", name: "Classic Beep",  price: 0   },
        { id: "duck",      icon: "🦆", name: "Rubber Duck",   price: 120 },
        { id: "clown",     icon: "🤡", name: "Clown Horn",    price: 180 },
        { id: "shofar",    icon: "📯", name: "Shofar",        price: 250 },
        { id: "cucaracha", icon: "🎺", name: "La Cucaracha",  price: 400 },
        { id: "train",     icon: "🚂", name: "Train Horn",    price: 600 }
    ];
    var DECOR = [
        { id: "dice",    icon: "🎲", name: "Fuzzy Dice",    price: 100 },
        { id: "bow",     icon: "🎀", name: "Giant Bow",     price: 150 },
        { id: "lashes",  icon: "👁️", name: "Headlight Lashes", short: "Car Lashes", price: 200 },
        { id: "surf",    icon: "🏄", name: "Surfboard",     price: 300 },
        { id: "crown",   icon: "👑", name: "Crown",         price: 450 },
        { id: "unicorn", icon: "🦄", name: "Unicorn Horn",  price: 650 },
        { id: "flames",  icon: "🔥", name: "Flame Decals",  price: 900 }
    ];
    function blingDef(kind, id) {
        var list = kind === "horn" ? HORNS : DECOR;
        for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
        return null;
    }
    function ownedHorns() { if (!Array.isArray(save.ownedHorns)) save.ownedHorns = ["beep"]; return save.ownedHorns; }
    function ownedDecor() { if (!Array.isArray(save.ownedDecor)) save.ownedDecor = []; return save.ownedDecor; }
    function blingOwned(kind, id) { return (kind === "horn" ? ownedHorns() : ownedDecor()).indexOf(id) >= 0; }
    function blingEquipped(kind, id) { return kind === "horn" ? (save.horn || "beep") === id : save.decor === id; }

    // ── Horn synths ─────────────────────────────────────────────────────────
    // One shaped oscillator voice: quick attack, held, short release. Optional
    // filter ("lowpass"/"bandpass") shapes the timbre.
    function hornVoice(ac, type, freq, t0, dur, vol, fType, fHz, fQ) {
        var o = ac.createOscillator(), g = ac.createGain(), out = o;
        o.type = type; o.frequency.setValueAtTime(freq, t0);
        if (fType) {
            var f = ac.createBiquadFilter();
            f.type = fType; f.frequency.value = fHz; if (fQ) f.Q.value = fQ;
            o.connect(f); out = f;
        }
        out.connect(g).connect(ac.destination);
        dur = Math.max(dur, 0.08);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
        g.gain.setValueAtTime(vol, t0 + dur - 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.start(t0); o.stop(t0 + dur + 0.02);
        return o;
    }
    // Lulu's honk. `note` is the Honk-Symphony pitch (262 = first honk).
    function playPlayerHorn(note, hornId) {
        var id = hornId || save.horn || "beep";
        if (id === "beep" || !blingDef("horn", id)) {
            if (holidayIs("purim")) playGrogger(); else playHonkPitched(note);   // 🎭 Purim: the stock horn is a grogger
            return;
        }
        if (audioMuted) return;
        var ac = getAudio(); if (!ac) return;
        var k = clamp((note || 262) / 262, 1, 2), t = ac.currentTime, o, i;
        if (id === "duck") {
            o = hornVoice(ac, "sawtooth", 640 * k, t, 0.2, 0.3, "bandpass", 1100, 2.5);
            o.frequency.exponentialRampToValueAtTime(390 * k, t + 0.18);
        } else if (id === "clown") {
            o = hornVoice(ac, "square", 410 * k, t, 0.13, 0.12, "lowpass", 2600);
            o.frequency.linearRampToValueAtTime(450 * k, t + 0.1);
            o = hornVoice(ac, "square", 330 * k, t + 0.17, 0.17, 0.12, "lowpass", 2600);
            o.frequency.linearRampToValueAtTime(360 * k, t + 0.3);
        } else if (id === "shofar") {
            var f0 = 233 * k;   // a tekiah: scoop up, hold, crack at the top
            o = hornVoice(ac, "sawtooth", f0 * 0.8, t, 0.72, 0.16, "lowpass", 1500);
            o.frequency.exponentialRampToValueAtTime(f0, t + 0.14);
            o.frequency.setValueAtTime(f0, t + 0.56);
            o.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + 0.64);
        } else if (id === "cucaracha") {
            var tune = [392, 392, 392, 523, 659];
            for (i = 0; i < tune.length; i++)
                hornVoice(ac, "square", tune[i] * k, t + i * 0.1, i === 4 ? 0.24 : 0.085, 0.09, "lowpass", 3200);
        } else if (id === "train") {
            var chord = [220, 277, 330];
            for (i = 0; i < chord.length; i++)
                hornVoice(ac, "sawtooth", chord[i] * k * (1 + (i - 1) * 0.004), t, 0.6, 0.08, "lowpass", 950);
        }
    }

    // ── Car decorations (car-local space: front = −y, hw/hh = half width/height) ──
    function drawCarDecor(id, hw, hh, time) {
        if (!id || id === "none") return;
        var t = time || 0;
        ctx.save();
        ctx.lineJoin = "round"; ctx.lineCap = "round";
        if (id === "dice") {
            // hanging from the mirror, off to the passenger side of the windshield
            var sw = Math.sin(t * 4) * 1.4, ax = 9, ay = -hh + 9;
            var dice = [[11 + sw, -hh + 18], [15 + sw * 1.2, -hh + 21]];
            ctx.strokeStyle = "#ECEFF1"; ctx.lineWidth = 0.9;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(dice[0][0], dice[0][1] - 3); ctx.moveTo(ax, ay); ctx.lineTo(dice[1][0], dice[1][1] - 3); ctx.stroke();
            ctx.fillStyle = "#555"; ctx.fillRect(ax - 3, ay - 1, 6, 2);   // mirror
            for (var d = 0; d < 2; d++) {
                var dx = dice[d][0], dy = dice[d][1], ds = 6;
                ctx.fillStyle = d ? "#FFF176" : "#FF4FA3";
                roundRect(dx - ds / 2, dy - ds / 2, ds, ds, 1.6); ctx.fill();
                ctx.strokeStyle = d ? "#F9A825" : "#AD1457"; ctx.lineWidth = 0.8;
                roundRect(dx - ds / 2, dy - ds / 2, ds, ds, 1.6); ctx.stroke();
                ctx.fillStyle = d ? "#5D4037" : "#FFF";
                ctx.beginPath(); ctx.arc(dx - 1.3, dy - 1.3, 0.7, 0, Math.PI * 2); ctx.arc(dx + 1.3, dy + 1.3, 0.7, 0, Math.PI * 2); ctx.fill();
            }
        } else if (id === "bow") {
            var by = 4, wob = Math.sin(t * 3) * 0.06;
            ctx.translate(0, by); ctx.rotate(wob);
            ctx.fillStyle = "#FF4FA3"; ctx.strokeStyle = "#AD1457"; ctx.lineWidth = 1.4;
            // tails
            ctx.beginPath(); ctx.moveTo(-1, 2); ctx.lineTo(-6, 13); ctx.lineTo(-2, 11); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(1, 2); ctx.lineTo(6, 13); ctx.lineTo(2, 11); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
            // loops
            ctx.beginPath(); ctx.ellipse(-8, -1, 9, 6, -0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(8, -1, 9, 6, 0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "rgba(255,255,255,0.35)";
            ctx.beginPath(); ctx.ellipse(-9, -3, 4, 2, -0.25, 0, Math.PI * 2); ctx.ellipse(7, -3, 4, 2, 0.25, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#E91E63"; ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else if (id === "lashes") {
            // a lid line over each headlight + lashes fanning up and OUTWARD
            for (var sd = -1; sd <= 1; sd += 2) {
                var cx0 = sd * (hw - 10), cy0 = -hh + 2;
                ctx.strokeStyle = "#111"; ctx.lineWidth = 1.6;
                ctx.beginPath(); ctx.ellipse(cx0, cy0, 5.6, 3.6, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
                ctx.lineWidth = 1.3;
                for (var l = 0; l < 4; l++) {
                    var a = Math.PI * (1.15 + l * 0.23);              // along the top arc
                    if (sd < 0) a = Math.PI * 3 - a;                 // mirror so they flare outward
                    var bx = cx0 + Math.cos(a) * 5.6, byy = cy0 + Math.sin(a) * 3.6;
                    var nx = Math.cos(a), ny = Math.sin(a);
                    var out = l / 3;                                  // outer lashes are longer
                    var len = 3.2 + out * 2.2;
                    ctx.beginPath(); ctx.moveTo(bx, byy);
                    ctx.quadraticCurveTo(bx + nx * len * 0.6, byy + ny * len * 0.9 - 0.6,
                        bx + nx * len + sd * (0.8 + out * 1.6), byy + ny * len * 0.8 - 1.2);
                    ctx.stroke();
                }
            }
        } else if (id === "surf") {
            ctx.strokeStyle = "#263238"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-hw + 4, 2); ctx.lineTo(hw - 4, 2); ctx.moveTo(-hw + 4, 22); ctx.lineTo(hw - 4, 22); ctx.stroke();
            ctx.fillStyle = "#26C6DA"; ctx.strokeStyle = "#00838F"; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.ellipse(0, 15, 7, 25, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#FF7043"; ctx.fillRect(-1, -8, 2, 46);
            ctx.fillStyle = "#FFEB3B"; ctx.beginPath(); ctx.arc(0, 26, 2.6, 0, Math.PI * 2); ctx.fill();
        } else if (id === "crown") {
            ctx.translate(0, 6);
            var sp = 0.6 + 0.4 * Math.sin(t * 5);
            ctx.fillStyle = "#FFD54F"; ctx.strokeStyle = "#B8860B"; ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-10, 6); ctx.lineTo(-10, -3); ctx.lineTo(-6, 1); ctx.lineTo(-3, -8); ctx.lineTo(0, 0);
            ctx.lineTo(3, -8); ctx.lineTo(6, 1); ctx.lineTo(10, -3); ctx.lineTo(10, 6); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#E91E63"; ctx.beginPath(); ctx.arc(0, 3, 1.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#42A5F5"; ctx.beginPath(); ctx.arc(-6, 3.4, 1.3, 0, Math.PI * 2); ctx.arc(6, 3.4, 1.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255," + sp + ")"; ctx.beginPath(); ctx.arc(-3, -7, 1, 0, Math.PI * 2); ctx.arc(3, -7, 1, 0, Math.PI * 2); ctx.fill();
        } else if (id === "unicorn") {
            var tip = -hh - 15, base = -hh + 3;
            var ug = ctx.createLinearGradient(0, tip, 0, base);
            ug.addColorStop(0, "#FFF8E1"); ug.addColorStop(0.5, "#F8BBD0"); ug.addColorStop(1, "#CE93D8");
            ctx.fillStyle = ug; ctx.strokeStyle = "#8E24AA"; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(-4.5, base); ctx.lineTo(0, tip); ctx.lineTo(4.5, base); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = "rgba(142,36,170,0.6)"; ctx.lineWidth = 1;
            for (var u = 1; u <= 3; u++) {
                var uy = base + (tip - base) * u / 4, uw = 4.5 * (1 - u / 4);
                ctx.beginPath(); ctx.moveTo(-uw, uy + 1.5); ctx.lineTo(uw, uy - 1.5); ctx.stroke();
            }
            var glint = (t * 0.8) % 1;
            ctx.fillStyle = "rgba(255,255,255," + (1 - glint) + ")";
            ctx.beginPath(); ctx.arc(0, tip + 1 + glint * 3, 1.4, 0, Math.PI * 2); ctx.fill();
        } else if (id === "flames") {
            ctx.save();
            roundRect(-hw, -hh, hw * 2, hh * 2, 12); ctx.clip();
            for (var side = -1; side <= 1; side += 2) {
                for (var fl = 0; fl < 3; fl++) {
                    var fy = -8 + fl * 10, flick = Math.sin(t * 9 + fl * 2 + side) * 1.2;
                    var ex = side * hw;
                    ctx.fillStyle = "#FF6F00";
                    ctx.beginPath(); ctx.moveTo(ex, fy - 4);
                    ctx.quadraticCurveTo(ex - side * 9, fy, ex - side * 4, fy + 16 + flick);
                    ctx.quadraticCurveTo(ex - side * 2, fy + 8, ex, fy + 6); ctx.closePath(); ctx.fill();
                    ctx.fillStyle = "#FFD54F";
                    ctx.beginPath(); ctx.moveTo(ex, fy - 1);
                    ctx.quadraticCurveTo(ex - side * 5, fy + 2, ex - side * 2.5, fy + 11 + flick * 0.6);
                    ctx.quadraticCurveTo(ex - side * 1, fy + 6, ex, fy + 5); ctx.closePath(); ctx.fill();
                }
            }
            ctx.restore();
        }
        ctx.restore();
    }

    // ── Shop tab ────────────────────────────────────────────────────────────
    var blingSel = null;   // { kind, id } — the locked item being previewed
    function blingLayout() {
        var x0 = 22, cols = 3, gap = 8;
        var cw = (W - x0 * 2 - gap * (cols - 1)) / cols;
        var hornTop = 182;
        var decorHead = hornTop + 2 * 84 + 6;
        var decorTop = decorHead + 26;
        var ch = Math.min(84, Math.floor((H - decorTop - 54) / 3)) - gap;
        var cells = [];
        for (var i = 0; i < HORNS.length; i++)
            cells.push({ kind: "horn", it: HORNS[i], x: x0 + (i % 3) * (cw + gap), y: hornTop + Math.floor(i / 3) * 84, w: cw, h: 76 });
        // decor grid: a TALL live-preview car fills column 0 of rows 0–1; the 7
        // decorations wrap around it.
        var slots = [[1, 0], [2, 0], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
        for (var j = 0; j < DECOR.length; j++) {
            cells.push({ kind: "decor", it: DECOR[j], x: x0 + slots[j][0] * (cw + gap), y: decorTop + slots[j][1] * (ch + gap), w: cw, h: ch });
        }
        return { cells: cells, decorHead: decorHead, preview: { x: x0, y: decorTop, w: cw, h: ch * 2 + gap } };
    }

    function drawBlingTab() {
        var lay = blingLayout();
        drawText("📯 HORNS  ·  tap to hear", W / 2, 166, "bold 15px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 3);
        drawText("✨ CAR BLING  ·  tap to try on", W / 2, lay.decorHead + 10, "bold 15px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 3);
        // Live preview car wearing the previewed (or equipped) decoration.
        var p = lay.preview;
        ctx.fillStyle = "rgba(0,0,0,0.28)"; roundRect(p.x, p.y, p.w, p.h, 12); ctx.fill();
        ctx.strokeStyle = "rgba(255,215,0,0.5)"; ctx.lineWidth = 2; roundRect(p.x, p.y, p.w, p.h, 12); ctx.stroke();
        var showDecor = (blingSel && blingSel.kind === "decor") ? blingSel.id : (save.decor || "none");
        var sc = Math.min(1.5, (p.h - 34) / 96);
        ctx.save();
        ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
        drawLuluCar(p.x + p.w / 2, p.y + p.h / 2 + 4, 0, false, menuBounce, false, save.selectedSkin, sc, false, showDecor);
        ctx.restore();
        for (var i = 0; i < lay.cells.length; i++) drawBlingCard(lay.cells[i]);
    }

    function drawBlingCard(c) {
        var it = c.it, owned = blingOwned(c.kind, it.id), on = blingEquipped(c.kind, it.id);
        var sel = blingSel && blingSel.kind === c.kind && blingSel.id === it.id;
        var g = ctx.createLinearGradient(0, c.y, 0, c.y + c.h);
        g.addColorStop(0, on ? "#3E5C46" : "#455A64"); g.addColorStop(1, on ? "#2E4636" : "#2E3B42");
        ctx.fillStyle = g; roundRect(c.x, c.y, c.w, c.h, 12); ctx.fill();
        ctx.lineWidth = sel ? 3 : 2;
        ctx.strokeStyle = sel ? "#FFD54F" : on ? "#66BB6A" : "#263238";
        roundRect(c.x, c.y, c.w, c.h, 12); ctx.stroke();
        var iconY = c.y + Math.min(26, c.h * 0.32);
        drawText(it.icon, c.x + c.w / 2, iconY, Math.round(Math.min(26, c.h * 0.32)) + "px Arial", "#FFF", null, 0);
        drawText(it.short || it.name, c.x + c.w / 2, c.y + c.h * 0.62, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2);
        var tag, col;
        if (on) { tag = c.kind === "decor" ? "✓ ON · tap = off" : "✓ ON"; col = "#A5D6A7"; }
        else if (owned) { tag = "OWNED · tap = on"; col = "#90CAF9"; }
        else if (sel) { tag = save.totalCoins >= it.price ? "TAP AGAIN: BUY 💰" + it.price : "need " + (it.price - save.totalCoins) + " more 💰"; col = save.totalCoins >= it.price ? "#FFD54F" : "#FFAB91"; }
        else { tag = "💰 " + formatNum(it.price); col = "#FFD54F"; }
        drawText(tag, c.x + c.w / 2, c.y + c.h - 12, "bold 12px 'Segoe UI', Arial, sans-serif", col, "#000", 2);
    }

    // Returns true if the tap landed on a bling card (handled).
    function blingClick(click) {
        var lay = blingLayout();
        for (var i = 0; i < lay.cells.length; i++) {
            var c = lay.cells[i];
            if (!pointInRect(click.x, click.y, c.x, c.y, c.w, c.h)) continue;
            var it = c.it, kind = c.kind;
            if (kind === "horn") playPlayerHorn(262, it.id);
            if (blingOwned(kind, it.id)) {
                blingSel = null;
                if (kind === "horn") { save.horn = it.id; lastBoughtMessage = it.name + " equipped! 📯"; }
                else if (save.decor === it.id) { save.decor = "none"; lastBoughtMessage = it.name + " off."; }
                else { save.decor = it.id; lastBoughtMessage = it.name + " on! ✨"; }
                lastBoughtTimer = 1.3; persistSave();
                if (kind === "decor") playClick();
                return true;
            }
            var already = blingSel && blingSel.kind === kind && blingSel.id === it.id;
            if (!already) { blingSel = { kind: kind, id: it.id }; if (kind === "decor") playClick(); return true; }
            if (save.totalCoins < it.price) {
                playDeny(); lastBoughtMessage = "Need " + (it.price - save.totalCoins) + " more coins!"; lastBoughtTimer = 1.3;
                return true;
            }
            save.totalCoins -= it.price;
            (kind === "horn" ? ownedHorns() : ownedDecor()).push(it.id);
            if (kind === "horn") save.horn = it.id; else save.decor = it.id;
            blingSel = null;
            persistSave(); playBuy();
            spawnConfetti(c.x + c.w / 2, c.y + c.h / 2, 30);
            lastBoughtMessage = it.name + " is yours! 🎉"; lastBoughtTimer = 1.6;
            return true;
        }
        blingSel = null;
        return false;
    }
