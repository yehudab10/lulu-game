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

    // A 🔒 badge + glow ring on a run/slow button that's been double-tapped to
    // lock (cruise control). Shared by the driving HUD and the on-foot HUD.
    function drawSpeedLockBadges() {
        var pairs = [[boostLock, MOBILE_BOOST_RECT], [brakeLock, MOBILE_BRAKE_RECT]];
        for (var i = 0; i < 2; i++) {
            if (!pairs[i][0]) continue;
            var r = pairs[i][1];
            ctx.save();
            ctx.strokeStyle = "rgba(124,252,79,0.9)"; ctx.lineWidth = 3;
            roundRect(r.x - 2, r.y - 2, r.w + 4, r.w + 4, 16); ctx.stroke();
            ctx.fillStyle = "#2E7D32";
            ctx.beginPath(); ctx.arc(r.x + r.w - 6, r.y + 6, 9, 0, Math.PI * 2); ctx.fill();
            drawText("🔒", r.x + r.w - 6, r.y + 7, "11px Arial", "#FFF", null, 0);
            ctx.restore();
        }
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
        // Score — left-aligned starting just right of the pause button so the
        // number can't grow under it.
        drawText("SCORE", 64, 14, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 3, "left");
        drawText(formatNum(Math.floor(score)), 64, 36, "bold 26px 'Segoe UI', Arial, sans-serif", C.hud, C.hudShadow, 5, "left");

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
            drawSpeedLockBadges();
        }

        // Missile button (bottom-right) — only shown when you actually have one.
        var mY = MISSILE_RECT.y;
        if (save.missiles > 0) {
            drawIconButton(MISSILE_RECT.x, mY, MISSILE_RECT.w, "🚀", { bg: "#F44336", bgDark: "#B71C1C", id: "missile" });
        }

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
    var crashCause = null;   // {kind:"car"/"animal"/"other", color, carType, animal}
    var crashedCar = null;   // the wrecked enemy car the angry driver climbs out of
    var animalSwarm = [];     // mob of the same animal hurling insults
    var crashCars = [];       // revenge cars that mow down the swarm
    var crashSmokeT = 0;      // smoke emitter timer for the wreck
    var crashCarT = 0;        // spawn cadence for the swarm-mowing revenge cars
    var crashReprieve = false; // this wipeout is secretly a funny second chance
    var reprieveKind = null;   // "arrest" (cop nabs the man) | "chase" (man runs off)
    var playerVehicle = null;  // null = Lulu's car; "bus"/"ambulance"/"cop" if she hailed one
    var salonReturnFoot = false; // leaving the salon should drop her back on foot, not driving
    var hitchhiker = null;     // roadside thumber — honk near them to pick up (driving activity)
    var hitchTimer = 0;

    var obstacles = [];
    var coinEntities = [];
    var heartEntities = [];   // rare extra-life pickups
    var fuelCans = [];        // gas-station nitro pickups
    var nitroTimer = 0;       // seconds of turbo remaining
    var wetTimer = 0;         // brief slow after splashing through a puddle
    var tollBooth = null;     // active toll booth {y, open:[lanes], paid}
    var trainCrossing = null; // active railroad crossing {y, trainX, dir, ...}
    var driveThru = null;     // active drive-thru {y, side, taken}
    var paradeTimer = 0;      // seconds left of a parade/marathon crowd
    var busStop = null;       // parked school bus dropping kids {y, signOut, ...}
    var crossingGuard = null; // crossing guard halting traffic {y, side, kids, ...}
    var convoyTimer = 0;      // field-trip bus convoy spawn window
    var convoyNext = 0;       // spacing between convoy buses
    var iceTruck = null;      // ice-cream truck on the shoulder {y, side, kids, taken}
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
