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