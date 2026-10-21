    // ══════════════════════════════════════════════════════════════════════
    //  JEWISH HOLIDAYS — read live from the device's Hebrew calendar (Intl),
    //  so there's no date table to keep updating. During a holiday:
    //   · a greeting pill on the menu + a once-a-day gift toast,
    //   · Chanukah: a menorah on Lulu's car with tonight's candles lit,
    //   · Purim: a party hat on the car and the stock horn becomes a GROGGER.
    //  If the browser has no Hebrew calendar, holidays simply never trigger.
    // ══════════════════════════════════════════════════════════════════════
    var HOLIDAYS = [
        { id: "roshHashana", month: ["Tishri"], day: 1, days: 2, emoji: "🍎", greeting: "Shana Tova!", gift: 18, from: "Bubbe's honey-cake money" },
        { id: "sukkot",      month: ["Tishri"], day: 15, days: 9, emoji: "🌿", greeting: "Chag Sameach!", gift: 18, from: "Gelt from the sukkah" },
        { id: "chanukah",    month: ["Kislev"], day: 25, days: 8, emoji: "🕎", greeting: "Happy Chanukah!", gift: 18, from: "Chanukah gelt from Bubbe" },
        { id: "purim",       month: ["Adar", "Adar II"], day: 14, days: 2, emoji: "🎭", greeting: "Freilichen Purim!", gift: 36, from: "Mishloach manot from Avigail" },
        { id: "pesach",      month: ["Nisan"], day: 15, days: 8, emoji: "🫓", greeting: "Chag Pesach Sameach!", gift: 36, from: "You found the afikoman" }
    ];
    var holidayTestDate = null;   // smoke tests pin a date here
    var hebFmt = null;
    function hebrewMD(d) {
        try {
            if (!hebFmt) hebFmt = new Intl.DateTimeFormat("en-u-ca-hebrew", { month: "long", day: "numeric" });
            var parts = hebFmt.formatToParts(d), m = null, day = null;
            for (var i = 0; i < parts.length; i++) {
                if (parts[i].type === "month") m = parts[i].value;
                if (parts[i].type === "day") day = parseInt(parts[i].value, 10);
            }
            return (m && day) ? { m: m, d: day } : null;
        } catch (e) { return null; }
    }
    // The holiday running today (local date) → { h, dayNum (1-based), key } or null.
    var holidayCache = null, holidayCacheKey = "";
    function currentHoliday() {
        var now = holidayTestDate || new Date();
        var key = now.getFullYear() + "-" + now.getMonth() + "-" + now.getDate();
        if (key === holidayCacheKey) return holidayCache;
        holidayCacheKey = key; holidayCache = null;
        // Walk back up to 8 days looking for a holiday's first day.
        for (var back = 0; back < 9 && !holidayCache; back++) {
            var md = hebrewMD(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back, 12));
            if (!md) return null;   // no Hebrew calendar on this device
            for (var i = 0; i < HOLIDAYS.length; i++) {
                var h = HOLIDAYS[i];
                if (h.day === md.d && h.month.indexOf(md.m) >= 0 && back < h.days) {
                    holidayCache = { h: h, dayNum: back + 1, key: h.id + ":" + key };
                    break;
                }
            }
        }
        return holidayCache;
    }
    function holidayIs(id) { var c = currentHoliday(); return !!(c && c.h.id === id); }

    // Menu: once per holiday day, hand out the gift (after any badge toast).
    function holidayMenuTick() {
        var c = currentHoliday();
        if (!c || save.holidayGiftKey === c.key || menuMsgTimer > 0) return;
        save.holidayGiftKey = c.key;
        save.totalCoins += c.h.gift;
        statAdd("holidayGifts", 1);
        persistSave();
        menuMsg = c.h.emoji + " " + c.h.from + "! +" + c.h.gift + " 💰";
        menuMsgTimer = 3;
        playTone(659, 0.1, "triangle", 0.2);
        setTimeout(function () { playTone(784, 0.1, "triangle", 0.2); }, 110);
        setTimeout(function () { playTone(1046, 0.14, "triangle", 0.2); }, 220);
    }
    function drawHolidayGreeting() {
        var c = currentHoliday();
        if (!c) return;
        var txt = c.h.emoji + " " + c.h.greeting + (c.h.id === "chanukah" ? " Night " + c.dayNum : "");
        ctx.font = "bold 14px 'Segoe UI', Arial, sans-serif";
        var w = ctx.measureText(txt).width + 24, x = W / 2 - 40 - w / 2;
        ctx.fillStyle = "rgba(13,71,161,0.82)"; roundRect(x, 18, w, 26, 13); ctx.fill();
        ctx.strokeStyle = "#FFD54F"; ctx.lineWidth = 1.5; roundRect(x, 18, w, 26, 13); ctx.stroke();
        drawText(txt, x + w / 2, 31, "bold 14px 'Segoe UI', Arial, sans-serif", "#FFF8E1", null, 0);
    }

    // Holiday car decor — Lulu's OWN car only (drawLuluCar calls this when no
    // explicit decor was passed). Sits on the trunk when roof bling is worn.
    function drawHolidayCarDecor(hw, hh, time) {
        var c = currentHoliday();
        if (!c) return;
        var roofTaken = save.decor === "bow" || save.decor === "crown" || save.decor === "surf";
        var y = roofTaken ? hh - 4 : 6;
        ctx.save();
        if (c.h.id === "chanukah") {
            var lit = Math.min(8, c.dayNum);
            ctx.translate(0, y);
            ctx.strokeStyle = "#B8860B"; ctx.lineWidth = 2; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(13, 0); ctx.moveTo(0, 0); ctx.lineTo(0, 6); ctx.moveTo(-5, 6); ctx.lineTo(5, 6); ctx.stroke();
            var xs = [-13, -10, -7, -4, 4, 7, 10, 13];
            ctx.lineWidth = 1.6;
            for (var i = 0; i < 8; i++) {
                ctx.strokeStyle = "#90CAF9"; ctx.beginPath(); ctx.moveTo(xs[i], 0); ctx.lineTo(xs[i], -5); ctx.stroke();
                // candles are lit right-to-left as the nights go on (newest on the left)
                if (i >= 8 - lit) drawHolidayFlame(xs[i], -7, time + i);
            }
            ctx.strokeStyle = "#90CAF9"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -8); ctx.stroke();   // shamash
            drawHolidayFlame(0, -10, time + 9);
        } else if (c.h.id === "purim") {
            ctx.translate(0, y);
            ctx.fillStyle = "#AB47BC"; ctx.strokeStyle = "#4A148C"; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(-8, 5); ctx.lineTo(0, -12); ctx.lineTo(8, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#FFEB3B";
            ctx.beginPath(); ctx.arc(-3, 1, 1.4, 0, Math.PI * 2); ctx.arc(2, -4, 1.2, 0, Math.PI * 2); ctx.arc(3, 2, 1.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FF4081"; ctx.beginPath(); ctx.arc(0, -13, 2.6 + Math.sin(time * 6) * 0.4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
    function drawHolidayFlame(x, y, t) {
        var f = 1 + Math.sin(t * 13) * 0.18;
        ctx.fillStyle = "#FFB300";
        ctx.beginPath(); ctx.ellipse(x, y, 1.4 * f, 2.4 * f, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFF59D";
        ctx.beginPath(); ctx.ellipse(x, y + 0.5, 0.6, 1.1, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Purim: the stock horn is a grogger (a quick wooden ratchet).
    function playGrogger() {
        if (audioMuted) return;
        var ac = getAudio(); if (!ac) return;
        var t = ac.currentTime;
        for (var i = 0; i < 9; i++) {
            var o = ac.createOscillator(), g = ac.createGain();
            o.type = "square"; o.frequency.setValueAtTime(140 + (i % 2) * 40, t + i * 0.045);
            g.gain.setValueAtTime(0.0001, t + i * 0.045);
            g.gain.exponentialRampToValueAtTime(0.14, t + i * 0.045 + 0.005);
            g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.045 + 0.035);
            o.connect(g).connect(ac.destination);
            o.start(t + i * 0.045); o.stop(t + i * 0.045 + 0.04);
        }
    }
