    // Shared cute face for Lulu's car — used by both the driving game and the
    // parking minigame so she looks identical in both. Drawn centered at (0, fy)
    // in the car's local space. `crying` swaps in the sad/teary parking face.
    function drawLuluFace(fy, crying) {
        var hairC = save.luluHair;
        var hairDark = shadeColor(hairC, -28);
        var hairLite = shadeColor(hairC, 22);
        var hairStyle = save.luluHairStyle || "sheitel";

        // BIG & BOUNCY / AVIGAIL get extra volume drawn BEHIND the head first
        if (hairStyle === "bouncy") {
            ctx.fillStyle = hairC;
            ctx.beginPath(); ctx.arc(-9, fy - 3, 5, 0, Math.PI * 2); ctx.arc(9, fy - 3, 5, 0, Math.PI * 2); ctx.fill();
        } else if (hairStyle === "avigail") {
            ctx.fillStyle = hairC;
            ctx.beginPath();
            ctx.arc(-5, fy - 11, 3.4, 0, Math.PI * 2); ctx.arc(0, fy - 13, 3.8, 0, Math.PI * 2);
            ctx.arc(5, fy - 11, 3.4, 0, Math.PI * 2); ctx.arc(0, fy - 16, 3, 0, Math.PI * 2); ctx.fill();
        }

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

    function drawLuluCar(x, y, tilt, blinking, time, distracted, skinKey, scale, empty) {
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

        // Wheels — deeper tire contrast (dark tire + a lighter tread inset)
        var wheelSpots = [[-hw - 4, -hh + 10], [hw - 4, -hh + 10], [-hw - 4, hh - 28], [hw - 4, hh - 28]];
        for (var wi = 0; wi < 4; wi++) {
            var wx0 = wheelSpots[wi][0], wy0 = wheelSpots[wi][1];
            ctx.fillStyle = "#181818";
            roundRect(wx0, wy0, 8, 18, 3); ctx.fill();
            ctx.fillStyle = "#3a3a3a";
            roundRect(wx0 + 1.5, wy0 + 3, 5, 12, 2); ctx.fill();
        }

        // Body outline
        ctx.fillStyle = skin.dark;
        roundRect(-hw - 2, -hh - 2, CAR_W + 4, CAR_H + 4, 14); ctx.fill();

        // Body — diagonal gradient, light source top-left
        var grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
        grad.addColorStop(0, skin.light);
        grad.addColorStop(0.42, skin.body);
        grad.addColorStop(1, skin.dark);
        ctx.fillStyle = grad;
        roundRect(-hw, -hh, CAR_W, CAR_H, 12); ctx.fill();
        // top-left sheen band along the hood
        var sheen = ctx.createLinearGradient(-hw, -hh, -hw + 14, -hh + 20);
        sheen.addColorStop(0, "rgba(255,255,255,0.28)");
        sheen.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = sheen;
        roundRect(-hw, -hh, CAR_W, CAR_H, 12); ctx.fill();

        // Optional racing stripe
        if (skin.stripe) {
            ctx.fillStyle = skin.stripe;
            roundRect(-4, -hh + 4, 8, CAR_H - 8, 2); ctx.fill();
        }

        // Thin bumper highlights (front + rear lip)
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        roundRect(-hw + 5, -hh + 1, CAR_W - 10, 2, 1); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        roundRect(-hw + 5, hh - 3, CAR_W - 10, 2, 1); ctx.fill();

        // Windshield — glass gradient + diagonal glare stripe
        ctx.fillStyle = C.windshieldDark;
        roundRect(-hw + 7, -hh + 8, CAR_W - 14, 26, 6); ctx.fill();
        var wsg = ctx.createLinearGradient(-hw + 8, -hh + 9, -hw + 8, -hh + 33);
        wsg.addColorStop(0, "#A6E1FB"); wsg.addColorStop(1, C.windshield);
        ctx.fillStyle = wsg;
        roundRect(-hw + 8, -hh + 9, CAR_W - 16, 24, 5); ctx.fill();
        ctx.save();
        roundRect(-hw + 8, -hh + 9, CAR_W - 16, 24, 5); ctx.clip();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.moveTo(-hw + 10, -hh + 9); ctx.lineTo(-hw + 20, -hh + 9);
        ctx.lineTo(-hw + 8, -hh + 33); ctx.lineTo(-hw + 4, -hh + 33); ctx.closePath(); ctx.fill();
        ctx.restore();

        // ── Lulu's face (skipped for an EMPTY car — she's out of it) ──
      if (empty) {
        // two empty seat-backs showing through the windshield
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        roundRect(-hw + 11, -hh + 12, (CAR_W - 22) / 2 - 1, 18, 3); ctx.fill();
        roundRect(2, -hh + 12, (CAR_W - 22) / 2 - 1, 18, 3); ctx.fill();
      } else {
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
      }

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

    // ── Showroom "fake-3D" car ────────────────────────────────
    // A pretty SIDE-PROFILE cartoon car (facing +x) used by the garage detail
    // turntable and the card previews. The turntable illusion (see
    // drawShowroomCar) is the classic sprite trick: horizontally squash the
    // profile by cos(angle) and swap to a narrow FRONT/REAR sliver when the car
    // turns edge-on, so it never collapses to a flat line.

    // Trace the body silhouette (facing right, centered near origin). No fill —
    // callers fill / clip / darken with it so the shape can't drift.
    function showroomBodyPath() {
        ctx.beginPath();
        ctx.moveTo(-72, 16);
        ctx.quadraticCurveTo(-75, 4, -70, -6);        // rear bumper + trunk lip
        ctx.lineTo(-58, -9);
        ctx.quadraticCurveTo(-50, -11, -45, -30);     // C-pillar up to roof
        ctx.quadraticCurveTo(-43, -35, -35, -35);     // rear roof corner
        ctx.lineTo(8, -35);                           // roofline
        ctx.quadraticCurveTo(20, -35, 27, -19);       // A-pillar / windshield
        ctx.lineTo(41, -12);                          // cowl → hood base
        ctx.lineTo(64, -11);                          // hood
        ctx.quadraticCurveTo(73, -10, 74, -1);        // nose
        ctx.quadraticCurveTo(75, 8, 71, 16);          // front bumper
        ctx.lineTo(-72, 16);                          // rocker (bottom)
        ctx.closePath();
    }

    // One wheel of the side profile: tire depth, hubcap, spokes.
    function showroomWheel(wx) {
        var wr = 17;
        // wheel-well shadow
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.arc(wx, 17, wr + 3, Math.PI, 0); ctx.fill();
        // tire
        ctx.fillStyle = "#1b1b1f";
        ctx.beginPath(); ctx.arc(wx, 18, wr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#2c2c30";
        ctx.beginPath(); ctx.arc(wx, 18, wr - 2.5, 0, Math.PI * 2); ctx.fill();
        // hubcap
        var hg = ctx.createRadialGradient(wx - 3, 15, 1, wx, 18, wr - 5);
        hg.addColorStop(0, "#f2f4f6"); hg.addColorStop(1, "#9aa4ac");
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(wx, 18, wr - 6, 0, Math.PI * 2); ctx.fill();
        // spokes
        ctx.strokeStyle = "rgba(80,90,98,0.7)"; ctx.lineWidth = 1.4;
        for (var k = 0; k < 5; k++) {
            var a = k * (Math.PI * 2 / 5) + 0.4;
            ctx.beginPath(); ctx.moveTo(wx, 18);
            ctx.lineTo(wx + Math.cos(a) * (wr - 7), 18 + Math.sin(a) * (wr - 7)); ctx.stroke();
        }
        ctx.fillStyle = "#5a646c";
        ctx.beginPath(); ctx.arc(wx, 18, 2.4, 0, Math.PI * 2); ctx.fill();
    }

    // The full side illustration, facing +x, drawn already-squashed by caller.
    function showroomProfileArt(skin) {
        var wheelFront = 45, wheelRear = -44;
        // wheels first (body overlaps their tops → seated look)
        showroomWheel(wheelRear);
        showroomWheel(wheelFront);

        // body outline (dark keyline)
        ctx.fillStyle = skin.dark;
        ctx.save(); ctx.translate(0, 0); ctx.lineJoin = "round";
        showroomBodyPath();
        ctx.lineWidth = 5; ctx.strokeStyle = skin.dark; ctx.stroke();
        ctx.fill();
        ctx.restore();

        // body fill — vertical gradient, light source top
        var bg = ctx.createLinearGradient(0, -35, 0, 16);
        bg.addColorStop(0, skin.light);
        bg.addColorStop(0.45, skin.body);
        bg.addColorStop(1, skin.dark);
        showroomBodyPath();
        ctx.save(); ctx.clip();
        ctx.fillStyle = bg;
        ctx.fillRect(-80, -40, 160, 60);

        // rocker-panel shading (bottom strip in shadow)
        var rg = ctx.createLinearGradient(0, 4, 0, 16);
        rg.addColorStop(0, "rgba(0,0,0,0)"); rg.addColorStop(1, "rgba(0,0,0,0.4)");
        ctx.fillStyle = rg; ctx.fillRect(-80, 2, 160, 16);

        // racing stripe along the side (stripe skins)
        if (skin.stripe) {
            ctx.fillStyle = skin.stripe;
            ctx.globalAlpha = 0.9;
            ctx.fillRect(-72, -3, 146, 6);
            ctx.globalAlpha = 1;
        }

        // horizontal specular band along the body
        var spec = ctx.createLinearGradient(0, -10, 0, -2);
        spec.addColorStop(0, "rgba(255,255,255,0)");
        spec.addColorStop(0.5, "rgba(255,255,255,0.45)");
        spec.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = spec; ctx.fillRect(-72, -11, 146, 9);
        ctx.restore();  // end body clip

        // greenhouse / windows with sky reflection
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-42, -31);
        ctx.lineTo(6, -31);
        ctx.quadraticCurveTo(15, -31, 20, -19);
        ctx.lineTo(-42, -14);
        ctx.closePath();
        ctx.clip();
        var sky = ctx.createLinearGradient(0, -33, 0, -13);
        sky.addColorStop(0, "#cdeafd"); sky.addColorStop(0.55, "#8fc6f0"); sky.addColorStop(1, "#5b93c4");
        ctx.fillStyle = sky; ctx.fillRect(-44, -33, 66, 22);
        // reflection streak
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.moveTo(-30, -31); ctx.lineTo(-22, -31); ctx.lineTo(-34, -13); ctx.lineTo(-42, -13); ctx.closePath(); ctx.fill();
        // Lulu head silhouette behind the glass
        var hairC = save.luluHair || "#8B5A2B";
        ctx.fillStyle = hairC;
        ctx.beginPath(); ctx.arc(-8, -20, 7.5, 0, Math.PI * 2); ctx.fill();      // hair
        ctx.fillStyle = "#FFD9C0";
        ctx.beginPath(); ctx.arc(-6, -19, 5, 0, Math.PI * 2); ctx.fill();        // face
        ctx.fillStyle = hairC;
        ctx.beginPath(); ctx.arc(-11, -18, 3.4, 0, Math.PI * 2); ctx.fill();     // hair sweep
        ctx.restore();
        // window pillar + frame
        ctx.strokeStyle = skin.dark; ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-42, -31); ctx.lineTo(6, -31);
        ctx.quadraticCurveTo(15, -31, 20, -19);
        ctx.stroke();
        // B-pillar
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-16, -31); ctx.lineTo(-16, -14); ctx.stroke();

        // door seam + handle
        ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-16, -12); ctx.lineTo(-16, 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-40, -9); ctx.lineTo(-40, 6); ctx.stroke();
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        roundRect(-30, -8, 9, 3, 1.5); ctx.fill();

        // headlight (front) + taillight (rear)
        ctx.fillStyle = "#FFF7C0";
        ctx.beginPath(); ctx.ellipse(69, -4, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(69, -4, 4, 5, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#E53935";
        roundRect(-73, -5, 5, 9, 2); ctx.fill();

        // thin bumper highlights
        ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(66, 10); ctx.lineTo(72, 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-71, 8); ctx.lineTo(-66, 11); ctx.stroke();
    }

    // Narrow FRONT (or REAR) sliver, so the car never collapses edge-on.
    function showroomEndArt(skin, isFront) {
        // ground shadow
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(0, 40, 30, 10, 0, 0, Math.PI * 2); ctx.fill();
        // wheels peeking at the sides
        ctx.fillStyle = "#1b1b1f";
        roundRect(-26, 8, 8, 22, 4); ctx.fill();
        roundRect(18, 8, 8, 22, 4); ctx.fill();
        // narrow body
        showroomEndBodyPath();
        ctx.fillStyle = skin.dark; ctx.lineWidth = 5; ctx.strokeStyle = skin.dark;
        ctx.stroke(); ctx.fill();
        showroomEndBodyPath();
        ctx.save(); ctx.clip();
        var bg = ctx.createLinearGradient(-22, 0, 22, 0);
        bg.addColorStop(0, skin.dark); bg.addColorStop(0.5, skin.light); bg.addColorStop(1, skin.dark);
        ctx.fillStyle = bg; ctx.fillRect(-24, -40, 48, 60);
        if (skin.stripe) { ctx.fillStyle = skin.stripe; ctx.globalAlpha = 0.9; ctx.fillRect(-4, -36, 8, 52); ctx.globalAlpha = 1; }
        ctx.restore();
        // windshield / rear window
        var wg = ctx.createLinearGradient(0, -32, 0, -12);
        wg.addColorStop(0, "#cdeafd"); wg.addColorStop(1, "#5b93c4");
        ctx.fillStyle = wg;
        roundRect(-17, -31, 34, 20, 6); ctx.fill();
        ctx.strokeStyle = skin.dark; ctx.lineWidth = 2;
        roundRect(-17, -31, 34, 20, 6); ctx.stroke();
        if (isFront) {
            // Lulu behind the windshield
            var hairC = save.luluHair || "#8B5A2B";
            ctx.fillStyle = hairC; ctx.beginPath(); ctx.arc(0, -22, 7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFD9C0"; ctx.beginPath(); ctx.arc(0, -20, 4.5, 0, Math.PI * 2); ctx.fill();
            // headlights
            ctx.fillStyle = "#FFF7C0";
            ctx.beginPath(); ctx.ellipse(-15, 2, 4, 5, 0, 0, Math.PI * 2); ctx.ellipse(15, 2, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
            // grille
            ctx.fillStyle = "rgba(0,0,0,0.4)"; roundRect(-8, 4, 16, 5, 2); ctx.fill();
        } else {
            // taillights
            ctx.fillStyle = "#E53935";
            roundRect(-18, 0, 6, 8, 2); ctx.fill();
            roundRect(12, 0, 6, 8, 2); ctx.fill();
        }
        // roof specular
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        roundRect(-14, -33, 28, 3, 1.5); ctx.fill();
    }

    function showroomEndBodyPath() {
        ctx.beginPath();
        ctx.moveTo(-22, 14);
        ctx.quadraticCurveTo(-24, -8, -18, -12);
        ctx.quadraticCurveTo(-18, -34, 0, -34);
        ctx.quadraticCurveTo(18, -34, 18, -12);
        ctx.quadraticCurveTo(24, -8, 22, 14);
        ctx.closePath();
    }

    // Public: draw the showroom car centered at the current origin.
    // angle spins the turntable; scale sizes it.
    function drawShowroomCar(skinKey, angle, scale) {
        var skin = SKINS[skinKey || save.selectedSkin] || SKINS.pink;
        var s = scale || 1;
        var f = Math.cos(angle);
        ctx.save();
        ctx.scale(s, s);

        if (Math.abs(f) < 0.18) {
            // edge-on → front/rear sliver (sin sign picks which end faces us)
            showroomEndArt(skin, Math.sin(angle) >= 0);
        } else {
            var squash = Math.abs(f);
            // ground shadow (barely squashes → stays grounded)
            ctx.fillStyle = "rgba(0,0,0,0.28)";
            ctx.beginPath();
            ctx.ellipse(0, 40, 74 * (0.5 + 0.5 * squash), 12, 0, 0, Math.PI * 2); ctx.fill();
            // squashed + sign-flipped profile
            ctx.save();
            ctx.scale(f, 1);
            showroomProfileArt(skin);
            // darken the side turning away
            if (squash < 1) {
                showroomBodyPath();
                ctx.fillStyle = "rgba(0,0,0," + ((1 - squash) * 0.4) + ")";
                ctx.fill();
            }
            ctx.restore();
        }
        ctx.restore();
    }

    // ── Drawing: Enemy cars ──────────────────────────────────
    // Pick a traffic body type — ordinary sedans (0-2) stay common; the fun rides
    // (pickup / sports / electric / box truck) sprinkle in for variety. Used by
    // traffic, roadside decoration, and the parked cars Lulu can borrow on foot.
    function randCarType() {
        var r = Math.random();
        if (r < 0.50) return randInt(0, 2);   // sedans — still the bulk of traffic
        if (r < 0.62) return 7;                // taxi — common around town
        if (r < 0.73) return 3;                // pickup truck
        if (r < 0.83) return 6;                // sports car
        if (r < 0.91) return 5;                // electric car
        if (r < 0.97) return 4;                // box truck
        return 8;                              // city bus (rarest — the longest)
    }
    // Collision box sized to each body — big rides (truck / bus) are proper big
    // targets instead of a car-sized box floating in a huge silhouette.
    function carHitbox(type) {
        if (type === 3) return { hw: 40, hh: 80 };    // pickup
        if (type === 4) return { hw: 46, hh: 94 };    // box truck
        if (type === 5) return { hw: 36, hh: 62 };    // electric
        if (type === 6) return { hw: 44, hh: 66 };    // sports
        if (type === 7) return { hw: 38, hh: 68 };    // taxi
        if (type === 8) return { hw: 48, hh: 112 };   // city bus
        return { hw: 36, hh: 64 };                     // sedans
    }
    // How each borrowed ride handles: a sports car is quick, a truck/bus is a slug.
    function vehicleSpeedFactor(type) {
        if (type === 6) return 1.18;   // sports — zippy
        if (type === 5) return 1.06;   // electric — peppy
        if (type === 3) return 0.90;   // pickup — a bit heavy
        if (type === 4) return 0.80;   // box truck — slug
        if (type === 8) return 0.74;   // city bus — big slug
        return 1;                      // sedans / taxi — normal
    }
    function drawEnemyCar(x, y, color, type) {
        ctx.save();
        ctx.translate(x, y);
        var ew, eh, rad;
        if (type === 0) { ew = 42; eh = 74; rad = 10; }
        else if (type === 1) { ew = 48; eh = 82; rad = 8; }
        else if (type === 2) { ew = 44; eh = 68; rad = 12; }
        else if (type === 3) { ew = 46; eh = 88; rad = 8; }   // pickup truck — longer
        else if (type === 4) { ew = 52; eh = 100; rad = 6; }  // box truck — biggest
        else if (type === 5) { ew = 42; eh = 72; rad = 16; }  // electric car — rounded/compact
        else if (type === 6) { ew = 50; eh = 76; rad = 9; }   // sports car — low & wide
        else if (type === 7) { ew = 44; eh = 76; rad = 9; }   // taxi — sedan-ish
        else if (type === 8) { ew = 50; eh = 118; rad = 7; }  // city bus — longest vehicle
        else { ew = 44; eh = 68; rad = 12; }
        var hw2 = ew / 2, hh2 = eh / 2;

        // soft drop shadow
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath();
        ctx.ellipse(3, 5, hw2 + 3, hh2 - 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // wheels (four dark roundRects at the corners)
        ctx.fillStyle = C.wheel;
        roundRect(-hw2 - 3, -hh2 + 8, 7, 16, 3); ctx.fill();
        roundRect(hw2 - 4, -hh2 + 8, 7, 16, 3); ctx.fill();
        roundRect(-hw2 - 3, hh2 - 24, 7, 16, 3); ctx.fill();
        roundRect(hw2 - 4, hh2 - 24, 7, 16, 3); ctx.fill();

        // darker body outline
        ctx.fillStyle = shadeColor(color, -40);
        roundRect(-hw2 - 2, -hh2 - 2, ew + 4, eh + 4, rad + 2); ctx.fill();

        // vertical body gradient
        var g2 = ctx.createLinearGradient(0, -hh2, 0, hh2);
        g2.addColorStop(0, shadeColor(color, 30));
        g2.addColorStop(1, color);
        ctx.fillStyle = g2;
        roundRect(-hw2, -hh2, ew, eh, rad); ctx.fill();

        if (type === 3) {
            // ── PICKUP TRUCK ── cab at front (top) + open cargo bed at rear (bottom)
            var cabTop = -hh2 + 4, cabH = eh * 0.42;
            // cab roof panel
            ctx.fillStyle = shadeColor(color, 12);
            roundRect(-hw2 + 3, cabTop, ew - 6, cabH, rad - 2); ctx.fill();
            // windshield (front of cab)
            ctx.fillStyle = "#78909C";
            roundRect(-hw2 + 8, cabTop + 5, ew - 16, 11, 3); ctx.fill();
            // cab rear window
            roundRect(-hw2 + 8, cabTop + cabH - 12, ew - 16, 9, 3); ctx.fill();
            // ── open cargo bed (recessed rectangle with visible walls) ──
            var bedTop = cabTop + cabH + 4, bedBot = hh2 - 6;
            ctx.fillStyle = shadeColor(color, -22);     // bed walls
            roundRect(-hw2 + 4, bedTop, ew - 8, bedBot - bedTop, 4); ctx.fill();
            ctx.fillStyle = shadeColor(color, -48);     // recessed bed floor
            roundRect(-hw2 + 8, bedTop + 4, ew - 16, bedBot - bedTop - 8, 3); ctx.fill();
            // spare tire in the bed
            ctx.fillStyle = C.wheel;
            ctx.beginPath(); ctx.ellipse(-hw2 + 15, (bedTop + bedBot) / 2, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = shadeColor(C.wheel, 40);
            ctx.beginPath(); ctx.ellipse(-hw2 + 15, (bedTop + bedBot) / 2, 2.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
            // wooden crate in the bed
            ctx.fillStyle = "#A1887F";
            roundRect(hw2 - 22, (bedTop + bedBot) / 2 - 6, 13, 13, 2); ctx.fill();
            ctx.strokeStyle = "#6D4C41"; ctx.lineWidth = 1.5;
            roundRect(hw2 - 22, (bedTop + bedBot) / 2 - 6, 13, 13, 2); ctx.stroke();
            // cab windshield gloss
            ctx.fillStyle = "rgba(255,255,255,0.18)";
            roundRect(-hw2 + 8, cabTop + 5, (ew - 16) * 0.42, 11, 3); ctx.fill();
        } else if (type === 4) {
            // ── BOX TRUCK ── small cab at front + tall box cargo body behind it
            var bcabH = eh * 0.24, bcabTop = -hh2 + 3;
            // cab (uses body color, slightly darker roof)
            ctx.fillStyle = shadeColor(color, -8);
            roundRect(-hw2 + 3, bcabTop, ew - 6, bcabH, rad); ctx.fill();
            // cab windshield
            ctx.fillStyle = "#78909C";
            roundRect(-hw2 + 8, bcabTop + 4, ew - 16, bcabH - 8, 3); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.18)";
            roundRect(-hw2 + 8, bcabTop + 4, (ew - 16) * 0.42, bcabH - 8, 3); ctx.fill();
            // ── tall box cargo body (lighter than cab) ──
            var boxTop = bcabTop + bcabH + 2, boxBot = hh2 - 3;
            var boxCol = shadeColor(color, 55);
            var bg = ctx.createLinearGradient(0, boxTop, 0, boxBot);
            bg.addColorStop(0, shadeColor(boxCol, 20));
            bg.addColorStop(1, boxCol);
            ctx.fillStyle = shadeColor(color, -40);     // box edge
            roundRect(-hw2 + 1, boxTop, ew - 2, boxBot - boxTop, 5); ctx.fill();
            ctx.fillStyle = bg;
            roundRect(-hw2 + 3, boxTop + 1, ew - 6, boxBot - boxTop - 2, 4); ctx.fill();
            // roll-up door panel on the back with horizontal slat lines
            ctx.fillStyle = shadeColor(boxCol, -14);
            roundRect(-hw2 + 6, boxBot - 22, ew - 12, 18, 3); ctx.fill();
            ctx.strokeStyle = shadeColor(boxCol, -34); ctx.lineWidth = 1;
            for (var si = 1; si <= 3; si++) {
                var sy = boxBot - 22 + si * 4.5;
                ctx.beginPath(); ctx.moveTo(-hw2 + 8, sy); ctx.lineTo(hw2 - 8, sy); ctx.stroke();
            }
            // door handle
            ctx.fillStyle = shadeColor(boxCol, -40);
            roundRect(-3, boxBot - 15, 6, 3, 1.5); ctx.fill();
            // box top sheen
            ctx.fillStyle = "rgba(255,255,255,0.10)";
            roundRect(-hw2 + 5, boxTop + 2, ew - 10, 5, 2); ctx.fill();
        } else if (type === 5) {
            // ── ELECTRIC CAR ── sleek/rounded, smooth closed nose, teal eco accent
            var evTeal = "#26C6DA";
            // smooth nose (no grille) — a bright full-width LED light bar across the front
            ctx.fillStyle = evTeal;
            roundRect(-hw2 + 6, -hh2 + 3, ew - 12, 4, 2); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            roundRect(-hw2 + 8, -hh2 + 4, ew - 16, 2, 1); ctx.fill();
            // large curved windshield + rear cabin glass
            ctx.fillStyle = "#78909C";
            roundRect(-hw2 + 7, -hh2 + 11, ew - 14, 13, 5); ctx.fill();
            roundRect(-hw2 + 7, hh2 - 26, ew - 14, 13, 5); ctx.fill();
            // eco/teal accent stripe down each side
            ctx.fillStyle = evTeal;
            roundRect(-hw2 + 2, -hh2 + 12, 3, eh - 24, 1.5); ctx.fill();
            roundRect(hw2 - 5, -hh2 + 12, 3, eh - 24, 1.5); ctx.fill();
            // charge-port dot with a tiny glow
            ctx.fillStyle = evTeal;
            ctx.beginPath(); ctx.ellipse(hw2 - 9, -hh2 + 20, 3, 3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#E0F7FA";
            ctx.beginPath(); ctx.ellipse(hw2 - 9, -hh2 + 20, 1.3, 1.3, 0, 0, Math.PI * 2); ctx.fill();
            // glossy windshield sheen + body top sheen
            ctx.fillStyle = "rgba(255,255,255,0.20)";
            roundRect(-hw2 + 7, -hh2 + 11, (ew - 14) * 0.42, 13, 4); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.14)";
            roundRect(-hw2 + 6, -hh2 + 7, ew - 12, 4, 3); ctx.fill();
            // taillights
            ctx.fillStyle = "#EF5350";
            ctx.beginPath();
            ctx.ellipse(-hw2 + 8, hh2 - 3, 3, 2, 0, 0, Math.PI * 2);
            ctx.ellipse(hw2 - 8, hh2 - 3, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        } else if (type === 6) {
            // ── SPORTS CAR ── low & wide, tapered nose, twin racing stripes, rear wing
            // aggressive tapered nose (dark wedge at the front)
            ctx.fillStyle = shadeColor(color, -28);
            ctx.beginPath();
            ctx.moveTo(-hw2 + 6, -hh2 + 3);
            ctx.lineTo(hw2 - 6, -hh2 + 3);
            ctx.lineTo(hw2 - 12, -hh2 + 16);
            ctx.lineTo(-hw2 + 12, -hh2 + 16);
            ctx.closePath(); ctx.fill();
            // twin racing stripes down the middle
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            roundRect(-6, -hh2 + 2, 4, eh - 4, 1.5); ctx.fill();
            roundRect(2, -hh2 + 2, 4, eh - 4, 1.5); ctx.fill();
            // low wide cockpit glass (single canopy)
            ctx.fillStyle = "#78909C";
            roundRect(-hw2 + 8, -hh2 + 18, ew - 16, 24, 5); ctx.fill();
            // windshield gloss
            ctx.fillStyle = "rgba(255,255,255,0.20)";
            roundRect(-hw2 + 8, -hh2 + 18, (ew - 16) * 0.4, 24, 4); ctx.fill();
            // ── rear spoiler / wing across the tail ──
            ctx.fillStyle = shadeColor(color, -50);
            roundRect(-hw2 - 1, hh2 - 12, 5, 12, 2); ctx.fill();   // left strut
            roundRect(hw2 - 4, hh2 - 12, 5, 12, 2); ctx.fill();    // right strut
            ctx.fillStyle = shadeColor(color, -30);
            roundRect(-hw2 - 3, hh2 - 6, ew + 6, 6, 3); ctx.fill(); // wing blade
            ctx.fillStyle = "rgba(255,255,255,0.16)";
            roundRect(-hw2 - 1, hh2 - 6, ew + 2, 2, 1); ctx.fill();
            // taillights
            ctx.fillStyle = "#EF5350";
            ctx.beginPath();
            ctx.ellipse(-hw2 + 9, hh2 - 9, 3, 2, 0, 0, Math.PI * 2);
            ctx.ellipse(hw2 - 9, hh2 - 9, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        } else if (type === 7) {
            // ── TAXI ── classic yellow cab: checker band, TAXI roof light, red taillights
            var taxiY = "#FDD835", taxiYd = "#FBC02D";
            // repaint the body in iconic taxi yellow (a taxi is defined by its color)
            ctx.fillStyle = shadeColor(taxiY, -40);
            roundRect(-hw2 - 2, -hh2 - 2, ew + 4, eh + 4, rad + 2); ctx.fill();
            var tg = ctx.createLinearGradient(0, -hh2, 0, hh2);
            tg.addColorStop(0, shadeColor(taxiY, 25));
            tg.addColorStop(1, taxiYd);
            ctx.fillStyle = tg;
            roundRect(-hw2, -hh2, ew, eh, rad); ctx.fill();
            // windshield (front) + rear window
            ctx.fillStyle = "#78909C";
            roundRect(-hw2 + 8, -hh2 + 8, ew - 16, 11, 3); ctx.fill();
            roundRect(-hw2 + 6, hh2 - 22, ew - 12, 14, 4); ctx.fill();
            // ── black-and-white CHECKER stripe band across the middle side ──
            var bandTop = -2, bandH = 8, sq = bandH / 2, nsq = Math.ceil(ew / sq) + 1;
            ctx.fillStyle = "#ECEFF1";
            ctx.fillRect(-hw2, bandTop, ew, bandH);
            ctx.fillStyle = "#212121";
            for (var cr = 0; cr < 2; cr++) {
                for (var cc = 0; cc < nsq; cc++) {
                    if ((cr + cc) % 2 === 0) ctx.fillRect(-hw2 + cc * sq, bandTop + cr * sq, sq, sq);
                }
            }
            ctx.strokeStyle = shadeColor(taxiY, -40); ctx.lineWidth = 1;
            ctx.strokeRect(-hw2, bandTop, ew, bandH);
            // ── small "TAXI" roof-light box on top (front) ──
            var lbW = 20, lbH = 9, lbTop = -hh2 + 22;
            ctx.fillStyle = "#212121";
            roundRect(-lbW / 2 - 1, lbTop - 1, lbW + 2, lbH + 2, 2); ctx.fill();
            ctx.fillStyle = "#FFF59D";                  // lit sign
            roundRect(-lbW / 2, lbTop, lbW, lbH, 2); ctx.fill();
            ctx.fillStyle = "#5D4037";
            ctx.font = "bold 6px sans-serif";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText("TAXI", 0, lbTop + lbH / 2 + 0.5);
            ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
            // windshield gloss + body top sheen
            ctx.fillStyle = "rgba(255,255,255,0.20)";
            roundRect(-hw2 + 8, -hh2 + 8, (ew - 16) * 0.42, 11, 3); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.12)";
            roundRect(-hw2 + 4, -hh2 + 3, ew - 8, 5, 3); ctx.fill();
            // taillights
            ctx.fillStyle = "#EF5350";
            ctx.beginPath();
            ctx.ellipse(-hw2 + 8, hh2 - 3, 3, 2, 0, 0, Math.PI * 2);
            ctx.ellipse(hw2 - 8, hh2 - 3, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        } else if (type === 8) {
            // ── CITY BUS ── longest vehicle: side-window rows, dest sign, livery stripe
            // big front windshield
            ctx.fillStyle = "#78909C";
            roundRect(-hw2 + 6, -hh2 + 12, ew - 12, 14, 4); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.20)";
            roundRect(-hw2 + 6, -hh2 + 12, (ew - 12) * 0.4, 14, 4); ctx.fill();
            // ── lit destination sign strip near the front ──
            ctx.fillStyle = "#212121";
            roundRect(-hw2 + 6, -hh2 + 4, ew - 12, 6, 2); ctx.fill();
            ctx.fillStyle = "#FFF176";
            roundRect(-hw2 + 8, -hh2 + 5, ew - 16, 4, 1.5); ctx.fill();
            ctx.fillStyle = "#4E342E";
            ctx.font = "bold 4.5px sans-serif";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText("42 DOWNTOWN", 0, -hh2 + 7.2);
            ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
            // ── horizontal livery accent stripe down the length ──
            ctx.fillStyle = shadeColor(color, 45);
            ctx.fillRect(-hw2, -1, ew, 6);
            ctx.fillStyle = shadeColor(color, -30);
            ctx.fillRect(-hw2, -2, ew, 1.5);
            // ── rows of side windows down BOTH sides (evenly spaced) ──
            var winTop = -hh2 + 30, winBot = hh2 - 12, winH = 12;
            var gap = 5, nWin = Math.floor((winBot - winTop + gap) / (winH + gap));
            var winW = 8;
            for (var wi = 0; wi < nWin; wi++) {
                var wy = winTop + wi * (winH + gap);
                if (wy + winH > winBot) break;
                ctx.fillStyle = "#78909C";
                roundRect(-hw2 + 3, wy, winW, winH, 2); ctx.fill();     // left column
                roundRect(hw2 - 3 - winW, wy, winW, winH, 2); ctx.fill(); // right column
                ctx.fillStyle = "rgba(255,255,255,0.16)";
                roundRect(-hw2 + 3, wy, winW * 0.4, winH, 2); ctx.fill();
                roundRect(hw2 - 3 - winW, wy, winW * 0.4, winH, 2); ctx.fill();
            }
            // body top sheen
            ctx.fillStyle = "rgba(255,255,255,0.10)";
            roundRect(-hw2 + 5, -hh2 + 3, ew - 10, 4, 2); ctx.fill();
            // taillights
            ctx.fillStyle = "#EF5350";
            ctx.beginPath();
            ctx.ellipse(-hw2 + 8, hh2 - 3, 3, 2, 0, 0, Math.PI * 2);
            ctx.ellipse(hw2 - 8, hh2 - 3, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        } else {
            // ── SEDANS (types 0,1,2) — unchanged ──
            ctx.fillStyle = "#78909C";
            roundRect(-hw2 + 6, hh2 - 22, ew - 12, 14, 4); ctx.fill();
            roundRect(-hw2 + 8, -hh2 + 8, ew - 16, 11, 3); ctx.fill();
            // glass gloss highlight (diagonal sheen) — cleaner, less flat look
            ctx.fillStyle = "rgba(255,255,255,0.18)";
            roundRect(-hw2 + 8, hh2 - 21, (ew - 12) * 0.42, 12, 3); ctx.fill();
            // body top sheen
            ctx.fillStyle = "rgba(255,255,255,0.12)";
            roundRect(-hw2 + 4, -hh2 + 3, ew - 8, 5, 3); ctx.fill();
        }

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

    // A compact "bank balance" chip (💰 N) for scenes where Lulu spends coins —
    // court, the ER, jail — so she can watch fines/fees come out of her stash.
    function drawCoinHud(x, y) {
        var bw = 102, bh = 30;
        var bx = (typeof x === "number") ? x : W - 116, by = (typeof y === "number") ? y : 14;
        ctx.fillStyle = "rgba(0,0,0,0.45)"; roundRect(bx, by, bw, bh, 15); ctx.fill();
        ctx.strokeStyle = "rgba(255,215,0,0.5)"; ctx.lineWidth = 1.5; roundRect(bx, by, bw, bh, 15); ctx.stroke();
        drawCoin(bx + 18, by + 15, gameTime);
        drawText(formatNum(save.totalCoins), bx + 34, by + 16, "bold 16px 'Segoe UI', Arial, sans-serif", C.coin, "#000", 3, "left");
    }

    // ── Drawing: Pedestrians (people obstacles) ──────────────
    function drawPedestrian(x, y, walkTime, type, worker, drunk, cop, kid) {
        ctx.save();
        ctx.translate(x, y);
        if (drunk) {
            // Tipsy bar patron: a woozy green aura and a big drunken sway so it
            // reads as "drunk" at a glance even when zipping past.
            var ag = ctx.createRadialGradient(0, -4, 4, 0, -4, 30);
            ag.addColorStop(0, "rgba(124,179,66,0.42)");
            ag.addColorStop(0.6, "rgba(124,179,66,0.22)");
            ag.addColorStop(1, "rgba(124,179,66,0)");
            ctx.fillStyle = ag;
            ctx.beginPath(); ctx.arc(0, -4, 28, 0, Math.PI * 2); ctx.fill();
            // Floating "tipsy" bubbles drifting up off the patron.
            ctx.fillStyle = "rgba(174,213,129,0.85)";
            var bphase = walkTime * 1.6;
            for (var db = 0; db < 3; db++) {
                var bb = (bphase + db * 0.66) % 1;
                ctx.globalAlpha = (1 - bb) * 0.8;
                ctx.beginPath();
                ctx.arc(7 + db * 2 - Math.sin(bphase + db) * 2, -20 - bb * 16, 1.6 + db * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            // Pronounced wobble (bigger than a normal walk lean).
            ctx.rotate(Math.sin(walkTime * 3) * 0.26);
        }
        var legSwing = Math.sin(walkTime * (drunk ? 6 : 10)) * (drunk ? 6 : 4);
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

        if (worker) {
            // Road worker: hi-vis vest over the shirt + a yellow hard hat.
            ctx.fillStyle = "#FF7043";
            roundRect(-8, -7, 16, 14, 4); ctx.fill();
            roundRect(-11, -6, 4, 8, 2); ctx.fill(); roundRect(7, -6, 4, 8, 2); ctx.fill();
            ctx.fillStyle = "#FDD835";
            ctx.fillRect(-8, -2, 16, 2.5); ctx.fillRect(-1.5, -7, 3, 14);
            ctx.fillStyle = "#FBC02D";
            ctx.beginPath(); ctx.arc(0, -16, 8, Math.PI, 0); ctx.fill();
            ctx.fillRect(-8.5, -16, 17, 2.5);
            ctx.fillStyle = "#F9A825"; ctx.fillRect(-1.5, -23, 3, 7);
        }

        if (drunk) {
            // A chunky bottle clutched in one hand, raised a little for "cheers".
            ctx.fillStyle = "#2E7D32";
            roundRect(7.5, -2, 4.5, 12, 2); ctx.fill();
            ctx.fillStyle = "#1B5E20";
            ctx.fillRect(8.8, -6, 2, 4); // neck
            ctx.fillStyle = "#A5D6A7"; // glassy highlight
            ctx.fillRect(8.4, 0, 1, 7);
            ctx.fillStyle = "#FFF8E1"; // little label
            ctx.fillRect(8.2, 3, 3.2, 3);
        }

        if (cop) {
            // Navy police uniform over the shirt + a peaked cap + gold badge.
            ctx.fillStyle = "#1A237E";
            roundRect(-9, -8, 18, 16, 5); ctx.fill();
            roundRect(-11, -6, 4, 12, 2); ctx.fill(); roundRect(7, -6, 4, 12, 2); ctx.fill();
            ctx.fillStyle = "#FFD54F";
            ctx.beginPath(); ctx.arc(-4, -2, 1.8, 0, Math.PI * 2); ctx.fill();   // badge
            ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke();  // placket
            // peaked cap over the hair
            ctx.fillStyle = "#0D1B5E";
            ctx.beginPath(); ctx.ellipse(0, -18, 8, 2.6, 0, 0, Math.PI * 2); ctx.fill();   // band
            ctx.fillStyle = "#1A237E";
            ctx.beginPath(); ctx.ellipse(0, -20.5, 7.5, 3.6, 0, Math.PI, 0); ctx.fill();   // crown
            ctx.fillStyle = "#0A0A0A";
            ctx.beginPath(); ctx.ellipse(0, -16.6, 8.5, 1.8, 0, 0, Math.PI); ctx.fill();   // brim
            ctx.fillStyle = "#FFD54F";
            ctx.beginPath(); ctx.arc(0, -19.5, 1.4, 0, Math.PI * 2); ctx.fill();           // emblem
        }

        if (kid) {
            // A little school backpack on the back.
            ctx.fillStyle = "#EF5350";
            roundRect(-12, -6, 5, 12, 2); ctx.fill();
            ctx.fillStyle = "#C62828";
            ctx.fillRect(-12, -1, 5, 2);
            ctx.strokeStyle = "#C62828"; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(-7, -6); ctx.lineTo(-4, -5); ctx.stroke(); // strap
        }

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

    // Dispatch helper: draw whichever critter species is swarming Lulu.
    function drawCrashAnimal(x, y, type, frame) {
        if (type === "raccoon") drawRaccoon(x, y, frame);
        else if (type === "ostrich") drawOstrich(x, y, frame);
        else drawDuck(x, y, frame);
    }

    // A comically-deceased critter (belly-up, X-ed-out eyes, lolling tongue)
    // for the "you hit an animal" crash. Species only changes the body colour.
    function drawDeadAnimal(x, y, type) {
        var col = type === "raccoon" ? "#78909C" : type === "ostrich" ? "#424242" : "#FDD835";
        ctx.save();
        ctx.translate(x, y);
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath(); ctx.ellipse(0, 6, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
        // Flattened body
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.beginPath(); ctx.ellipse(0, 1.5, 14, 5.5, 0, 0, Math.PI * 2); ctx.fill();
        // Stiff little legs sticking straight up
        ctx.strokeStyle = "#5D4037";
        ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-6, -4); ctx.lineTo(-8, -12);
        ctx.moveTo(-2, -5); ctx.lineTo(-2, -13);
        ctx.moveTo(2, -5); ctx.lineTo(3, -13);
        ctx.moveTo(6, -4); ctx.lineTo(8, -12);
        ctx.stroke();
        // Head lolling to the side
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(-15, 1, 6, 0, Math.PI * 2); ctx.fill();
        // X-ed-out eyes
        ctx.strokeStyle = "#222"; ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-18, -2); ctx.lineTo(-15, 1);
        ctx.moveTo(-15, -2); ctx.lineTo(-18, 1);
        ctx.stroke();
        // Tongue
        ctx.fillStyle = "#E53935";
        ctx.beginPath(); ctx.ellipse(-20, 3.5, 2, 3, 0.4, 0, Math.PI * 2); ctx.fill();
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
    function drawAngryMan(x, y, time, state, runDir, cop, mood, hair, type) {
        ctx.save();
        ctx.translate(x, y);
        // The driver who climbs out isn't always a grumpy grandpa: `mood` is
        // "angry" (default), "scared", or "sad", and `hair` varies the person
        // ("grandpa" = the classic wild white; otherwise a combed cap of that
        // color). Cops are always by-the-book angry.
        mood = mood || "angry";
        if (cop) { mood = "angry"; hair = null; }
        var grandpa = !hair || hair === "grandpa";
        var hairCol = grandpa ? "#FAFAFA" : hair;

        // A cop variant (when the wreck was a police cruiser): navy uniform,
        // peaked cap + badge instead of grandpa plaid + wild white hair.
        var shirtDark = cop ? "#0D1B5E" : (type && type.shirtDark) || "#8B0000";
        var shirtMain = cop ? "#1A237E" : (type && type.shirt) || "#B71C1C";

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(0, 22, 14, 4, 0, 0, Math.PI * 2); ctx.fill();

        var legSwing = state === "running" ? Math.sin(time * 18) * 6 : Math.sin(time * 4) * 1;
        var armRaise = state === "yelling" ? Math.sin(time * 12) * 10 : 0;

        // Legs (brown pants — navy for the cop)
        ctx.fillStyle = cop ? "#1A237E" : "#3E2723";
        roundRect(-6, 8 - legSwing, 5, 16 + legSwing, 2); ctx.fill();
        roundRect(1, 8 + legSwing, 5, 16 - legSwing, 2); ctx.fill();
        // Shoes
        ctx.fillStyle = "#212121";
        roundRect(-7, 22 - legSwing, 7, 4, 2); ctx.fill();
        roundRect(0, 22 + legSwing, 7, 4, 2); ctx.fill();

        // Body (plaid red shirt for grumpy-grandpa vibe / navy police shirt)
        ctx.fillStyle = shirtDark;
        roundRect(-11, -8, 22, 18, 5); ctx.fill();
        ctx.fillStyle = shirtMain;
        roundRect(-10, -7, 20, 16, 4); ctx.fill();
        if (cop) {
            // Police shirt details: button placket, badge, tie.
            ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 9); ctx.stroke();
            // gold badge (left chest)
            ctx.fillStyle = "#FFD54F";
            ctx.beginPath();
            for (var bs = 0; bs < 5; bs++) {
                var ba = -Math.PI / 2 + bs * (Math.PI * 2 / 5);
                ctx.lineTo(-6 + Math.cos(ba) * 3, -2 + Math.sin(ba) * 3);
                ctx.lineTo(-6 + Math.cos(ba + Math.PI / 5) * 1.4, -2 + Math.sin(ba + Math.PI / 5) * 1.4);
            }
            ctx.closePath(); ctx.fill();
            // collar tabs
            ctx.fillStyle = shirtDark;
            ctx.beginPath(); ctx.moveTo(-3, -7); ctx.lineTo(0, -4); ctx.lineTo(-1, -7); ctx.fill();
            ctx.beginPath(); ctx.moveTo(3, -7); ctx.lineTo(0, -4); ctx.lineTo(1, -7); ctx.fill();
        } else if (!type || type.hair === "grandpa") {
            // shirt lines (plaid) — the classic grumpy-grandpa flannel
            ctx.strokeStyle = "rgba(0,0,0,0.3)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-4, -7); ctx.lineTo(-4, 9);
            ctx.moveTo(4, -7); ctx.lineTo(4, 9);
            ctx.moveTo(-10, -2); ctx.lineTo(10, -2);
            ctx.moveTo(-10, 4); ctx.lineTo(10, 4);
            ctx.stroke();
        } else {
            // collared shirt with a button placket; a tie for the suit types
            ctx.fillStyle = "rgba(255,255,255,0.85)"; roundRect(-3, -7, 6, 5, 1); ctx.fill();   // open collar
            if (type.tie) { ctx.fillStyle = type.tie; ctx.beginPath(); ctx.moveTo(-1.6, -5); ctx.lineTo(1.6, -5); ctx.lineTo(1, 8); ctx.lineTo(-1, 8); ctx.closePath(); ctx.fill(); }
            else { ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 9); ctx.stroke(); }
        }

        // Arms (one raised when yelling)
        ctx.fillStyle = shirtMain;
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
            ctx.fillStyle = shirtMain;
            ctx.save();
            ctx.translate(10, -5);
            ctx.rotate(0.8 - armRaise * 0.03);
            roundRect(-3, -12, 6, 14, 2); ctx.fill();
            ctx.fillStyle = C.skin;
            ctx.beginPath(); ctx.arc(0, -13, 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else if (state === "running") {
            var armSwing = -legSwing;
            ctx.fillStyle = shirtMain;
            roundRect(-13, -5 - armSwing * 0.3, 5, 14, 2); ctx.fill();
            roundRect(8, -5 + armSwing * 0.3, 5, 14, 2); ctx.fill();
            ctx.fillStyle = C.skin;
            ctx.beginPath(); ctx.arc(-10, 9 - armSwing * 0.3, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(11, 9 + armSwing * 0.3, 2.5, 0, Math.PI * 2); ctx.fill();
        } else if (state === "talk" || state === "listen") {
            // calm chatting pose — arms at rest with a small gesture bob
            var gb = (state === "talk" ? Math.sin(time * 5) * 2 : 0);
            ctx.fillStyle = shirtMain;
            roundRect(-13, -5, 5, 13, 2); ctx.fill();
            roundRect(8, -5 + gb * 0.4, 5, 13, 2); ctx.fill();
            ctx.fillStyle = C.skin;
            ctx.beginPath(); ctx.arc(-10, 8, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(11, 8 + gb * 0.4, 2.5, 0, Math.PI * 2); ctx.fill();
        }

        // Head — flushed red when angry, pale when scared, wan when sad.
        ctx.fillStyle = "#222";
        ctx.beginPath(); ctx.arc(0, -16, 9, 0, Math.PI * 2); ctx.fill();
        var faceCol = mood === "scared" ? "#FFE3D2" : mood === "sad" ? "#EDB29A"
                    : (state === "yelling" ? "#FF7043" : "#FFAB91");
        ctx.fillStyle = faceCol;
        ctx.beginPath(); ctx.arc(0, -16, 8, 0, Math.PI * 2); ctx.fill();

        if (cop) {
            // Short dark hair under the cap
            ctx.fillStyle = "#3E2723";
            ctx.beginPath(); ctx.arc(0, -18, 8, Math.PI, 0); ctx.fill();
            // Peaked police cap: band, crown, glossy black peak, gold emblem.
            ctx.fillStyle = "#0D1B5E";
            ctx.beginPath(); ctx.ellipse(0, -22, 9, 3.2, 0, 0, Math.PI * 2); ctx.fill(); // band
            ctx.fillStyle = "#1A237E";
            ctx.beginPath(); ctx.ellipse(0, -25, 8.5, 4.5, 0, Math.PI, 0); ctx.fill();   // crown
            ctx.fillStyle = "#0A0A0A";
            ctx.beginPath(); ctx.ellipse(0, -20.5, 9.5, 2.2, 0, 0, Math.PI); ctx.fill(); // peak/brim
            // gold cap emblem
            ctx.fillStyle = "#FFD54F";
            ctx.beginPath(); ctx.arc(0, -24, 1.8, 0, Math.PI * 2); ctx.fill();
        } else if (grandpa) {
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
        } else {
        // A combed cap of hair in the driver's colour (a younger, varied person)
        ctx.fillStyle = hairCol;
        ctx.beginPath(); ctx.arc(0, -19, 8.6, Math.PI, 0); ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-7, -15, 2.6, 6, -0.3, 0, Math.PI * 2);
        ctx.ellipse(7, -15, 2.6, 6, 0.3, 0, Math.PI * 2);
        ctx.fill();
        }
        // ── type headwear (over the hair) ──
        if (!cop && type) {
            if (type.cap) {                                  // baseball cap, brim forward
                ctx.fillStyle = type.cap; ctx.beginPath(); ctx.ellipse(0, -21, 8.4, 5, 0, Math.PI, 0); ctx.fill();
                ctx.fillRect(-8.4, -21, 16.8, 2.5);
                ctx.fillStyle = shadeColor(type.cap, -18); roundRect(runDir >= 0 ? 4 : -16, -21.5, 12, 3.5, 2); ctx.fill();
                ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(0, -22, 1.4, 0, Math.PI * 2); ctx.fill();
            } else if (type.beanie) {                        // knit beanie with a fold
                ctx.fillStyle = type.beanie; ctx.beginPath(); ctx.arc(0, -18, 8.8, Math.PI, 0); ctx.fill();
                ctx.fillStyle = shadeColor(type.beanie, 18); ctx.fillRect(-8.8, -19.5, 17.6, 3.5);
                ctx.fillStyle = shadeColor(type.beanie, -12); ctx.beginPath(); ctx.arc(0, -26, 2, 0, Math.PI * 2); ctx.fill();
            } else if (type.sunhat) {                        // wide straw sun hat
                ctx.fillStyle = "#FFE082"; ctx.beginPath(); ctx.ellipse(0, -19, 13, 4.2, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = "#FFD54F"; ctx.beginPath(); ctx.ellipse(0, -22, 7, 4.5, 0, Math.PI, 0); ctx.fill();
                ctx.strokeStyle = "#26A69A"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-7, -20); ctx.lineTo(7, -20); ctx.stroke();
            }
        }
        // ── Brows / eyes / mouth all read the mood ──
        var browCol = cop ? "#3E2723" : (grandpa ? "#FAFAFA" : hairCol);
        ctx.fillStyle = browCol;
        if (mood === "scared") {                       // high, flat, worried
            roundRect(-6, -22, 5, 2, 1); ctx.fill();
            roundRect(1, -22, 5, 2, 1); ctx.fill();
        } else if (mood === "sad") {                   // inner-up "frown" brows
            ctx.save(); ctx.translate(-3, -19); ctx.rotate(-0.4); roundRect(-3, 0, 6, 2, 1); ctx.fill(); ctx.restore();
            ctx.save(); ctx.translate(3, -19); ctx.rotate(0.4); roundRect(-3, 0, 6, 2, 1); ctx.fill(); ctx.restore();
        } else {                                       // angry V
            ctx.save(); ctx.translate(-3, -18); ctx.rotate(0.4); roundRect(-3, 0, 6, 2, 1); ctx.fill(); ctx.restore();
            ctx.save(); ctx.translate(3, -18); ctx.rotate(-0.4); roundRect(-3, 0, 6, 2, 1); ctx.fill(); ctx.restore();
        }

        if (state === "faint") {                       // X_X knocked out cold
            ctx.strokeStyle = "#000"; ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-4.6, -16.6); ctx.lineTo(-1.4, -13.4); ctx.moveTo(-1.4, -16.6); ctx.lineTo(-4.6, -13.4);
            ctx.moveTo(1.4, -16.6); ctx.lineTo(4.6, -13.4); ctx.moveTo(4.6, -16.6); ctx.lineTo(1.4, -13.4);
            ctx.stroke();
        } else if (mood === "scared") {                // wide frightened eyes + sweat
            ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.arc(-3, -15.5, 2.2, 0, Math.PI * 2); ctx.arc(3, -15.5, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(-3, -15, 1.1, 0, Math.PI * 2); ctx.arc(3, -15, 1.1, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(130,200,240,0.9)"; ctx.beginPath(); ctx.arc(6.5, -14 + Math.abs(Math.sin(time * 6)) * 2, 1.3, 0, Math.PI * 2); ctx.fill();
        } else if (mood === "sad") {                   // droopy eyes + a welling tear
            ctx.strokeStyle = "#000"; ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.arc(-3, -14, 1.8, 1.05 * Math.PI, 1.95 * Math.PI); ctx.arc(3, -14, 1.8, 1.05 * Math.PI, 1.95 * Math.PI); ctx.stroke();
            ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(-3, -15, 0.9, 0, Math.PI * 2); ctx.arc(3, -15, 0.9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(120,190,235,0.95)"; ctx.beginPath(); ctx.arc(-4, -11 + ((time * 10) % 5), 1.3, 0, Math.PI * 2); ctx.fill();
        } else {                                       // angry slits + dot pupils
            ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(-5, -16); ctx.lineTo(-2, -15); ctx.moveTo(2, -15); ctx.lineTo(5, -16); ctx.stroke();
            ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(-3, -15, 0.9, 0, Math.PI * 2); ctx.arc(3, -15, 0.9, 0, Math.PI * 2); ctx.fill();
        }

        // Big mustache — only on the classic grandpa or the cop
        if (grandpa || cop) {
            ctx.fillStyle = cop ? "#3E2723" : "#FAFAFA";
            ctx.beginPath();
            ctx.ellipse(-3, -12, 4, 1.8, 0.2, 0, Math.PI * 2);
            ctx.ellipse(3, -12, 4, 1.8, -0.2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Mouth by mood
        if (state === "faint") {                        // slack, knocked-out mouth
            ctx.fillStyle = "#3A1A1A"; ctx.beginPath(); ctx.ellipse(0, -9, 1.6, 2, 0, 0, Math.PI * 2); ctx.fill();
        } else if (mood === "scared") {                // trembling little "o"
            ctx.fillStyle = "#3A1A1A"; ctx.beginPath();
            ctx.ellipse(Math.sin(time * 30) * 0.6, -9, 1.8, 2.2, 0, 0, Math.PI * 2); ctx.fill();
        } else if (mood === "sad") {                   // wobbly frown / open sob
            if (state === "yelling" || state === "talk") {
                ctx.fillStyle = "#3A1A1A"; ctx.beginPath();
                ctx.ellipse(0, -8, 2.4, 1.6 + Math.abs(Math.sin(time * 10)) * 1.2, 0, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.strokeStyle = "#000"; ctx.lineWidth = 1.3; ctx.beginPath();
                ctx.arc(0, -5, 3.4, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
            }
        } else if (state === "yelling" || state === "talk") {
            var talk = state === "talk";
            ctx.fillStyle = "#000"; ctx.beginPath();
            var mouthW = (talk ? 2 : 3) + Math.abs(Math.sin(time * (talk ? 14 : 25))) * (talk ? 1.4 : 1.2);
            ctx.ellipse(0, -9, mouthW, talk ? 1.8 : 2.5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#F44336"; ctx.beginPath(); ctx.ellipse(0, -8.5, mouthW * 0.6, 1, 0, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.strokeStyle = "#000"; ctx.lineWidth = 1.2; ctx.beginPath();
            ctx.arc(0, -8, 3, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke();
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

    // ── Procedural wanted-poster mugshot: it's ALWAYS LULU IN A DISGUISE ──
    // In-universe every "player" is Lulu, so every fugitive on the wanted board
    // is the SAME pink-car woman working through a stack of cheap aliases. So
    // drawMugshot renders ONE fixed canonical Lulu face (fair peachy skin, rosy
    // blush, big brown sparkly eyes, a can't-help-it little smile) and then
    // layers 1–3 name-derived DISGUISE props on top: obviously-fake wigs in
    // wrong colours (blue beehive / green bob / giant afro / askew blonde
    // sheitel / pigtails), dollar-store / groucho / monocle / novelty eyewear, a
    // peeling stick-on 'stache or drawn-on beauty mark, and headwear (cap pulled
    // low, babushka, inexplicable party hat, floppy sun hat). Everything stays a
    // deterministic function of the name string (mugHash + salted mugPick) so
    // the SAME alias always wears the SAME disguise forever. The tell that it's
    // her every single time: identical face, blush, eyes and that unrepentant
    // smile. It must NOT read the local player's salon choices
    // (save.luluHair / save.luluHairStyle) — those aliases are OTHER players, so
    // only Lulu's stock look is used. Flat cartoon look (drawLuluPortrait in
    // src/06 is the quality bar). ES5, single shared scope.
    var LULU_MUG_SKIN = "#FFD9C0";                                        // her canonical peachy skin
    var LULU_MUG_HAIR = "#3E2723";                                        // her canonical dark-brown hair
    // Wig colours by index: 0 natural dark · 1 blue beehive · 2 green bob ·
    // 3 orange afro · 4 cheap blonde sheitel · 5 magenta pigtails.
    var MUG_WIGC = ["#3E2723", "#2E7DF6", "#3FB65B", "#FB8C00", "#E7CB63", "#C24DBE"];
    function mugHash(str) {
        var h = 2166136261;
        str = "" + (str || "LULU");
        for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
        return h >>> 0;
    }
    // Each feature draws from an INDEPENDENT, well-mixed slice of the hash (a
    // salted xorshift) so choices don't correlate — plain `h % n` on FNV low
    // bits clusters badly, and signed `>>` can go negative. Always 0..n-1.
    function mugPick(h, salt, n) {
        var x = (h ^ Math.imul(salt, 0x9E3779B1)) >>> 0;
        x ^= x >>> 15; x = Math.imul(x, 0x85EBCA77) >>> 0; x ^= x >>> 13;
        return (x >>> 0) % n;
    }
    function drawMugshot(name, cx, cy, s) {
        var h = mugHash(name);
        var wig  = mugPick(h, 2, 6);   // 0 natural · 1 beehive · 2 green bob · 3 afro · 4 blonde sheitel askew · 5 pigtails
        var eyew = mugPick(h, 4, 5);   // 0 none · 1 shades · 2 groucho · 3 monocle · 4 novelty specs
        var face = mugPick(h, 6, 4);   // 0 none · 1 peeling 'stache · 2 beauty mark · 3 goatee
        var head = mugPick(h, 8, 5);   // 0 none · 1 cap low · 2 babushka · 3 party hat · 4 sun hat
        var expr = mugPick(h, 5, 4);   // 0 unbothered · 1 wink · 2 mid-laugh · 3 deadpan
        // Groucho brings its own moustache — don't stack a stick-on under it.
        if (eyew === 2 && face === 1) face = 0;
        // Every alias wears at LEAST one prop (else it's just bare-faced Lulu).
        if (wig === 0 && eyew === 0 && face === 0 && head === 0) eyew = 1;
        var hairC = MUG_WIGC[wig];
        var eyeY = -3.5, eyeX = 4.6, my = 5;
        // Lulu's unmistakable eye — big white, warm-brown iris, tiny sparkle.
        function mugEye(ex) {
            ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.ellipse(ex, eyeY, 2.9, 3.2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#7A4A2B"; ctx.beginPath(); ctx.arc(ex, eyeY + 0.2, 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#241208"; ctx.beginPath(); ctx.arc(ex, eyeY + 0.2, 1, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(ex - 0.8, eyeY - 0.8, 0.7, 0, Math.PI * 2); ctx.fill();
        }
        function mugArcEye(ex, cyy, a0, a1) {   // a happy closed curve (wink / laugh)
            ctx.strokeStyle = "#5D4037"; ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.arc(ex, cyy, 2.6, a0, a1); ctx.stroke();
        }

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s / 48, s / 48);
        ctx.lineJoin = "round"; ctx.lineCap = "round";

        // clip everything to a rounded booking card
        roundRect(-24, -24, 48, 48, 4);
        ctx.save();
        ctx.clip();

        // height-chart background
        ctx.fillStyle = "#AEB9C2";
        ctx.fillRect(-24, -24, 48, 48);
        ctx.strokeStyle = "rgba(58,70,82,0.32)"; ctx.lineWidth = 0.8;
        for (var gy = -18; gy <= 22; gy += 8) {
            ctx.beginPath(); ctx.moveTo(-24, gy); ctx.lineTo(24, gy); ctx.stroke();
        }
        ctx.strokeStyle = "rgba(58,70,82,0.5)";
        for (var ty = -20; ty <= 22; ty += 4) {
            ctx.beginPath(); ctx.moveTo(-24, ty); ctx.lineTo(-21, ty); ctx.stroke();
        }

        // shoulders — orange booking jumpsuit
        ctx.fillStyle = "#E67E22";
        roundRect(-17, 13, 34, 18, 7); ctx.fill();
        ctx.fillStyle = shadeColor("#E67E22", -26);        // collar V
        ctx.beginPath(); ctx.moveTo(-6, 13); ctx.lineTo(0, 19); ctx.lineTo(6, 13); ctx.closePath(); ctx.fill();

        // neck
        ctx.fillStyle = shadeColor(LULU_MUG_SKIN, -14);
        roundRect(-5, 6, 10, 9, 3); ctx.fill();

        // ── BACK WIG VOLUME (behind the head) — obvious fake, wrong colour ──
        if (wig === 3) {                                     // giant orange afro cloud
            ctx.fillStyle = hairC;
            var af = [[-11, -6, 8], [11, -6, 8], [-9, -15, 8], [9, -15, 8], [0, -18, 9], [-14, -2, 6], [14, -2, 6], [0, -4, 11]];
            for (var ai = 0; ai < af.length; ai++) { ctx.beginPath(); ctx.arc(af[ai][0], af[ai][1], af[ai][2], 0, Math.PI * 2); ctx.fill(); }
        } else if (wig === 2) {                              // green bob body
            ctx.fillStyle = hairC;
            ctx.beginPath(); ctx.ellipse(0, -1, 15, 14, 0, 0, Math.PI * 2); ctx.fill();
        } else if (wig === 5) {                              // pigtail puffs
            ctx.fillStyle = hairC;
            ctx.beginPath(); ctx.arc(-13, 2, 6, 0, Math.PI * 2); ctx.arc(13, 2, 6, 0, Math.PI * 2); ctx.fill();
        }

        // head + ears — THE fixed canonical Lulu face (identical every poster)
        ctx.fillStyle = LULU_MUG_SKIN;
        ctx.beginPath(); ctx.arc(-11.5, -2, 2.4, 0, Math.PI * 2); ctx.arc(11.5, -2, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -3, 12, 13.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(244,170,140,0.26)";           // soft warm face-edge shade
        ctx.beginPath(); ctx.ellipse(6.5, 0, 5, 9.5, 0, 0, Math.PI * 2); ctx.fill();

        // ── FRONT WIG / HAIR framing the face ──
        if (wig === 0) {                                     // natural dark centre-part swoop
            ctx.fillStyle = hairC;
            ctx.beginPath();
            ctx.moveTo(-12, -3);
            ctx.quadraticCurveTo(-14, -17, 0, -16.5);
            ctx.quadraticCurveTo(14, -17, 12, -3);
            ctx.quadraticCurveTo(9, -10, 4, -11);
            ctx.quadraticCurveTo(0, -13, -4, -11);
            ctx.quadraticCurveTo(-9, -10, -12, -3);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = shadeColor(hairC, 30);           // glossy part shine
            ctx.beginPath(); ctx.ellipse(-5, -12, 3, 1.4, -0.4, 0, Math.PI * 2); ctx.fill();
        } else if (wig === 1) {                              // blue beehive tower
            ctx.fillStyle = hairC;
            ctx.beginPath();
            ctx.moveTo(-12, -4);
            ctx.quadraticCurveTo(-16, -22, 0, -25);
            ctx.quadraticCurveTo(16, -22, 12, -4);
            ctx.quadraticCurveTo(8, -11, 0, -11);
            ctx.quadraticCurveTo(-8, -11, -12, -4);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = shadeColor(hairC, 36); ctx.lineWidth = 1;   // swirl lines
            ctx.beginPath();
            ctx.moveTo(-8, -8); ctx.quadraticCurveTo(0, -12, 8, -8);
            ctx.moveTo(-7, -15); ctx.quadraticCurveTo(0, -19, 7, -15);
            ctx.stroke();
        } else if (wig === 2) {                              // green bob — curtains + blunt fringe
            ctx.fillStyle = hairC;
            roundRect(-15, -13, 5, 21, 3); ctx.fill();
            roundRect(10, -13, 5, 21, 3); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-14, -7);
            ctx.quadraticCurveTo(-15, -17, 0, -17);
            ctx.quadraticCurveTo(15, -17, 14, -7);
            ctx.quadraticCurveTo(7, -9, 0, -8.5);
            ctx.quadraticCurveTo(-7, -9, -14, -7);
            ctx.closePath(); ctx.fill();
        } else if (wig === 3) {                              // afro — fuzzy front hairline
            ctx.fillStyle = hairC;
            ctx.beginPath(); ctx.ellipse(0, -11, 12, 6, 0, Math.PI, Math.PI * 2); ctx.fill();
            var afb = [[-9, -13, 3], [-3, -15, 3.4], [3, -15, 3.4], [9, -13, 3]];
            for (var afi = 0; afi < afb.length; afi++) { ctx.beginPath(); ctx.arc(afb[afi][0], afb[afi][1], afb[afi][2], 0, Math.PI * 2); ctx.fill(); }
        } else if (wig === 4) {                              // cheap blonde sheitel, sitting ASKEW
            ctx.save();
            ctx.translate(0.6, -1); ctx.rotate(0.13);        // crooked — that's the tell
            ctx.fillStyle = hairC;
            ctx.beginPath();
            ctx.moveTo(-13, -2);
            ctx.quadraticCurveTo(-15, -18, 0, -18);
            ctx.quadraticCurveTo(15, -18, 13, -2);
            ctx.lineTo(12, 8);
            ctx.quadraticCurveTo(9, 5, 8, -2);
            ctx.quadraticCurveTo(6, -8, 0, -8);
            ctx.quadraticCurveTo(-6, -8, -8, -2);
            ctx.quadraticCurveTo(-9, 5, -12, 8);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = shadeColor(hairC, 26);           // brassy highlight
            ctx.beginPath(); ctx.ellipse(-5, -12, 4, 1.6, -0.4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            ctx.fillStyle = LULU_MUG_HAIR;                   // sliver of her REAL hair peeking out
            ctx.beginPath(); ctx.ellipse(-10, 5, 2.6, 2, 0.3, 0, Math.PI * 2); ctx.fill();
        } else {                                             // wig 5 — pigtails: top hair, centre part, ties
            ctx.fillStyle = hairC;
            ctx.beginPath(); ctx.ellipse(0, -8, 12, 8, 0, Math.PI, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = shadeColor(hairC, -24); ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(0, -9); ctx.stroke();
            ctx.fillStyle = "#FF4081";                       // hair ties
            ctx.beginPath(); ctx.arc(-13, -2, 1.8, 0, Math.PI * 2); ctx.arc(13, -2, 1.8, 0, Math.PI * 2); ctx.fill();
        }

        // ── Rosy blush — Lulu's signature, on EVERY alias ──
        ctx.fillStyle = "rgba(255,150,170,0.55)";
        ctx.beginPath();
        ctx.ellipse(-7, 2.2, 3.2, 2.2, 0, 0, Math.PI * 2);
        ctx.ellipse(7, 2.2, 3.2, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // ── Eyebrows (her own warm brown; shaped by expression) ──
        ctx.strokeStyle = "#6B4A32"; ctx.lineWidth = 1.3;
        ctx.beginPath();
        if (expr === 3) {                                    // deadpan — flat
            ctx.moveTo(-eyeX - 2.4, eyeY - 5.4); ctx.lineTo(-eyeX + 2.2, eyeY - 5.4);
            ctx.moveTo(eyeX - 2.2, eyeY - 5.4); ctx.lineTo(eyeX + 2.4, eyeY - 5.4);
        } else {                                             // gentle arches
            ctx.moveTo(-eyeX - 2.4, eyeY - 4.8); ctx.quadraticCurveTo(-eyeX, eyeY - 6.4, -eyeX + 2.2, eyeY - 5);
            ctx.moveTo(eyeX - 2.2, eyeY - 5); ctx.quadraticCurveTo(eyeX, eyeY - 6.4, eyeX + 2.4, eyeY - 4.8);
        }
        ctx.stroke();

        // ── Eyes (big & bright — always hers; expression varies) ──
        if (expr === 1) {                                    // wink at the camera
            mugEye(-eyeX); mugArcEye(eyeX, eyeY - 1, 0.15 * Math.PI, 0.85 * Math.PI);
        } else if (expr === 2) {                             // mid-laugh — scrunched ^^
            mugArcEye(-eyeX, eyeY + 1.6, 1.15 * Math.PI, 1.85 * Math.PI);
            mugArcEye(eyeX, eyeY + 1.6, 1.15 * Math.PI, 1.85 * Math.PI);
        } else {                                             // 0 unbothered / 3 deadpan — both open
            mugEye(-eyeX); mugEye(eyeX);
            if (expr === 3) {                                // heavy half-lids
                ctx.strokeStyle = "#3E2723"; ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(-eyeX - 2.8, eyeY - 1.2); ctx.lineTo(-eyeX + 2.8, eyeY - 1.2);
                ctx.moveTo(eyeX - 2.8, eyeY - 1.2); ctx.lineTo(eyeX + 2.8, eyeY - 1.2);
                ctx.stroke();
            }
        }

        // ── Tiny nose + freckles (part of HER, always) ──
        ctx.fillStyle = "rgba(214,150,120,0.55)";
        ctx.beginPath(); ctx.ellipse(0, 1.4, 1.2, 1.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(180,110,80,0.5)";
        ctx.beginPath(); ctx.arc(-8.5, 3, 0.5, 0, Math.PI * 2); ctx.arc(8.5, 3, 0.5, 0, Math.PI * 2); ctx.fill();

        // ── Mouth — she is ALWAYS a little bit smiling (she'll do it again) ──
        ctx.strokeStyle = "#C44E63"; ctx.lineWidth = 1.5;
        if (expr === 2) {                                    // open laugh
            ctx.fillStyle = "#8E3B4A";
            ctx.beginPath(); ctx.moveTo(-3.6, my - 0.4); ctx.quadraticCurveTo(0, my + 4.6, 3.6, my - 0.4); ctx.quadraticCurveTo(0, my + 1.2, -3.6, my - 0.4); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath(); ctx.moveTo(-2.8, my - 0.2); ctx.quadraticCurveTo(0, my + 1, 2.8, my - 0.2); ctx.quadraticCurveTo(0, my + 0.2, -2.8, my - 0.2); ctx.closePath(); ctx.fill();
        } else if (expr === 3) {                             // deadpan — one corner still curls up
            ctx.beginPath(); ctx.moveTo(-3.4, my + 0.9); ctx.quadraticCurveTo(1, my + 0.3, 3.8, my - 1.2); ctx.stroke();
        } else {                                             // gentle knowing smile
            ctx.beginPath(); ctx.moveTo(-3.6, my); ctx.quadraticCurveTo(0, my + 3, 3.6, my); ctx.stroke();
        }
        ctx.fillStyle = "rgba(255,140,160,0.4)";             // lower-lip blush
        ctx.beginPath(); ctx.ellipse(0, my + 3.2, 2.6, 1, 0, 0, Math.PI * 2); ctx.fill();

        // ── FACIAL disguise ──
        if (face === 1) {                                    // peeling stick-on moustache
            ctx.fillStyle = "#3A2A1A";
            ctx.beginPath();
            ctx.moveTo(-4.6, my - 1.4);
            ctx.quadraticCurveTo(-2.2, my - 3.2, 0, my - 1.4);
            ctx.quadraticCurveTo(2.2, my - 3.2, 4.6, my - 1.4);
            ctx.quadraticCurveTo(2.4, my - 0.1, 0, my - 1);
            ctx.quadraticCurveTo(-2.4, my - 0.1, -4.6, my - 1.4);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = "#3A2A1A"; ctx.lineWidth = 0.8;   // one corner peeling off the skin
            ctx.beginPath(); ctx.moveTo(4.4, my - 1.4); ctx.lineTo(6, my - 3); ctx.stroke();
            ctx.beginPath(); ctx.arc(6.1, my - 3.1, 0.7, 0, Math.PI * 2); ctx.fill();
        } else if (face === 2) {                             // drawn-on beauty mark
            ctx.fillStyle = "#2A1A12";
            ctx.beginPath(); ctx.arc(4.6, 4.6, 0.9, 0, Math.PI * 2); ctx.fill();
        } else if (face === 3) {                             // obviously stuck-on goatee
            ctx.fillStyle = "#3A2A1A";
            ctx.beginPath();
            ctx.moveTo(-2.6, my + 3);
            ctx.quadraticCurveTo(0, my + 7, 2.6, my + 3);
            ctx.quadraticCurveTo(0, my + 4.4, -2.6, my + 3);
            ctx.closePath(); ctx.fill();
        }

        // ── EYEWEAR disguise ──
        if (eyew === 1) {                                    // dollar-store sunglasses
            ctx.fillStyle = "#181818";
            roundRect(-eyeX - 3.3, eyeY - 2.6, 6.6, 5, 2); ctx.fill();
            roundRect(eyeX - 3.3, eyeY - 2.6, 6.6, 5, 2); ctx.fill();
            ctx.strokeStyle = "#181818"; ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(-eyeX + 3.3, eyeY - 0.4); ctx.lineTo(eyeX - 3.3, eyeY - 0.4);
            ctx.moveTo(-eyeX - 3.3, eyeY - 1); ctx.lineTo(-11, eyeY - 2);
            ctx.moveTo(eyeX + 3.3, eyeY - 1); ctx.lineTo(11, eyeY - 2);
            ctx.stroke();
            ctx.fillStyle = "rgba(255,255,255,0.28)";        // cheap lens glare
            ctx.beginPath(); ctx.ellipse(-eyeX - 1, eyeY - 1, 1.3, 0.7, -0.5, 0, Math.PI * 2); ctx.ellipse(eyeX - 1, eyeY - 1, 1.3, 0.7, -0.5, 0, Math.PI * 2); ctx.fill();
        } else if (eyew === 2) {                             // GROUCHO — brows + rims + big nose + 'stache
            ctx.fillStyle = "#241812";
            roundRect(-eyeX - 3.4, eyeY - 4.2, 6.8, 2.2, 1); ctx.fill();
            roundRect(eyeX - 3.4, eyeY - 4.2, 6.8, 2.2, 1); ctx.fill();
            ctx.strokeStyle = "#241812"; ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(-eyeX, eyeY, 3.4, 0, Math.PI * 2);
            ctx.arc(eyeX, eyeY, 3.4, 0, Math.PI * 2);
            ctx.moveTo(-eyeX + 3.4, eyeY); ctx.lineTo(eyeX - 3.4, eyeY);
            ctx.moveTo(-eyeX - 3.4, eyeY); ctx.lineTo(-11, eyeY - 1);
            ctx.moveTo(eyeX + 3.4, eyeY); ctx.lineTo(11, eyeY - 1);
            ctx.stroke();
            ctx.fillStyle = "#E8A98A";                        // bulbous fake nose
            ctx.beginPath(); ctx.ellipse(0, 2.4, 3.2, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(0,0,0,0.10)";
            ctx.beginPath(); ctx.arc(1.2, 3.4, 1, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#241812";                        // bushy 'stache
            ctx.beginPath();
            ctx.moveTo(-5, my - 0.4);
            ctx.quadraticCurveTo(-2.5, my - 3, 0, my - 0.8);
            ctx.quadraticCurveTo(2.5, my - 3, 5, my - 0.4);
            ctx.quadraticCurveTo(2.5, my + 1.8, 0, my + 0.6);
            ctx.quadraticCurveTo(-2.5, my + 1.8, -5, my - 0.4);
            ctx.closePath(); ctx.fill();
        } else if (eyew === 3) {                             // monocle + dangling chain
            ctx.fillStyle = "rgba(230,240,255,0.20)";
            ctx.beginPath(); ctx.arc(eyeX, eyeY, 3.2, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#D4AF37"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(eyeX, eyeY, 3.4, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = "#B8972E"; ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.moveTo(eyeX + 3, eyeY + 1.6); ctx.quadraticCurveTo(9, 6, 8, 11); ctx.stroke();
        } else if (eyew === 4) {                             // big round novelty specs
            ctx.strokeStyle = "#20262E"; ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.arc(-eyeX, eyeY, 3.6, 0, Math.PI * 2);
            ctx.arc(eyeX, eyeY, 3.6, 0, Math.PI * 2);
            ctx.moveTo(-eyeX + 3.6, eyeY); ctx.lineTo(eyeX - 3.6, eyeY);
            ctx.moveTo(-eyeX - 3.6, eyeY); ctx.lineTo(-11, eyeY - 1.5);
            ctx.moveTo(eyeX + 3.6, eyeY); ctx.lineTo(11, eyeY - 1.5);
            ctx.stroke();
            ctx.fillStyle = "rgba(180,220,255,0.16)";
            ctx.beginPath(); ctx.arc(-eyeX, eyeY, 3.4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(eyeX, eyeY, 3.4, 0, Math.PI * 2); ctx.fill();
        }

        // ── HEADWEAR disguise (over the hair) ──
        if (head === 1) {                                    // baseball cap pulled LOW
            var capC2 = mugPick(h, 9, 2) ? "#C62828" : "#1565C0";
            ctx.fillStyle = capC2;
            ctx.beginPath(); ctx.ellipse(0, -6, 13, 10, 0, Math.PI, Math.PI * 2); ctx.fill();
            roundRect(-13, -7, 26, 3, 1); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-10, -5.5, 8, 2.6, -0.14, 0, Math.PI); ctx.fill();   // brim over brow
            ctx.fillStyle = shadeColor(capC2, 40);
            ctx.beginPath(); ctx.arc(0, -14, 1.4, 0, Math.PI * 2); ctx.fill();                // button
        } else if (head === 2) {                             // babushka / headscarf
            var scC = mugPick(h, 9, 3);
            var scarfC = scC === 0 ? "#D81B60" : (scC === 1 ? "#00897B" : "#FBC02D");
            ctx.fillStyle = scarfC;
            ctx.beginPath();
            ctx.moveTo(-13, -1);
            ctx.quadraticCurveTo(-15, -18, 0, -18);
            ctx.quadraticCurveTo(15, -18, 13, -1);
            ctx.quadraticCurveTo(8, -8, 0, -7.5);
            ctx.quadraticCurveTo(-8, -8, -13, -1);
            ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.arc(12, 0, 2.4, 0, Math.PI * 2); ctx.fill();                 // side knot
            ctx.beginPath(); ctx.moveTo(13, 1); ctx.lineTo(16, 6); ctx.lineTo(12, 4.5); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.7)";         // polka dots
            ctx.beginPath(); ctx.arc(-6, -10, 1, 0, Math.PI * 2); ctx.arc(2, -13, 1, 0, Math.PI * 2); ctx.arc(7, -8, 1, 0, Math.PI * 2); ctx.fill();
        } else if (head === 3) {                             // inexplicable PARTY hat
            ctx.fillStyle = "#7E57C2";
            ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(0, -27); ctx.lineTo(8, -12); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = "#FFD54F"; ctx.lineWidth = 1;  // zigzag streamer
            ctx.beginPath(); ctx.moveTo(-6, -16); ctx.lineTo(-1, -18); ctx.lineTo(-5, -20.5); ctx.lineTo(0, -22.5); ctx.stroke();
            ctx.fillStyle = "#FF7043";                        // pom-pom
            ctx.beginPath(); ctx.arc(0, -27, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.6;   // chin strap (why so serious)
            ctx.beginPath(); ctx.moveTo(-7, -11); ctx.quadraticCurveTo(0, 12, 7, -11); ctx.stroke();
        } else if (head === 4) {                             // big floppy sun hat
            ctx.fillStyle = "#EAD79A";
            ctx.beginPath(); ctx.ellipse(0, -7, 18, 5, 0, 0, Math.PI * 2); ctx.fill();        // wide brim
            ctx.fillStyle = shadeColor("#EAD79A", -16);
            ctx.beginPath(); ctx.ellipse(0, -11, 9, 5.5, 0, Math.PI, Math.PI * 2); ctx.fill(); // crown
            ctx.fillStyle = "#C97BA0";                        // ribbon band
            roundRect(-9, -10, 18, 2, 1); ctx.fill();
        }

        ctx.restore();                                       // drop the clip
        ctx.strokeStyle = "rgba(40,30,20,0.5)"; ctx.lineWidth = 1.2;  // card frame
        roundRect(-24, -24, 48, 48, 4); ctx.stroke();
        ctx.restore();
    }

    function drawBillboard(x, y, side, msg, wanted) {
        ctx.save();
        ctx.translate(x, y);
        // Two posts
        ctx.fillStyle = "#5D4037";
        ctx.fillRect(-30, 0, 5, 50);
        ctx.fillRect(25, 0, 5, 50);
        // Board outline
        ctx.fillStyle = "#3E2723";
        roundRect(-40, -38, 80, 44, 3); ctx.fill();

        if (wanted) {
            // A WANTED poster: aged paper, "WANTED", a Lulu mugshot, "REWARD".
            ctx.fillStyle = "#E8DBB5"; roundRect(-37, -35, 74, 38, 2); ctx.fill();
            ctx.fillStyle = "#3E2723"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.font = "bold 9px 'Segoe UI', Arial, sans-serif"; ctx.fillText("WANTED", 0, -31);
            // A REAL online fugitive's name (from the async board) when the poster
            // carries one, else the default reward gag.
            var wName = (msg && msg.indexOf("WANTED: ") === 0) ? msg.substring(8) : "LULU";
            if (wName && wName !== "LULU") {
                // Deterministic booking-photo face for the named fugitive.
                drawMugshot(wName, 0, -17, 21);
            } else {
                // Default poster keeps Lulu's own little mugshot.
                ctx.fillStyle = "#9E9E9E"; roundRect(-11, -27, 22, 20, 2); ctx.fill();
                ctx.fillStyle = (typeof save !== "undefined" && save.luluHair) || "#8B5A2B";
                ctx.beginPath(); ctx.arc(0, -18, 8, Math.PI, Math.PI * 2); ctx.fill();
                ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -16, 6.5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = "#1A1A1A";
                ctx.beginPath(); ctx.arc(-2.3, -16, 1, 0, Math.PI * 2); ctx.arc(2.3, -16, 1, 0, Math.PI * 2); ctx.fill();
                // height bars behind
                ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 0.5;
                ctx.beginPath(); ctx.moveTo(-9, -22); ctx.lineTo(9, -22); ctx.moveTo(-9, -12); ctx.lineTo(9, -12); ctx.stroke();
            }
            ctx.fillStyle = "#B71C1C";
            if (wName && wName !== "LULU") {
                var wfs = 7;
                ctx.font = "bold " + wfs + "px 'Segoe UI', Arial, sans-serif";
                while (wfs > 5 && ctx.measureText(wName).width > 66) {
                    wfs -= 0.5; ctx.font = "bold " + wfs + "px 'Segoe UI', Arial, sans-serif";
                }
                ctx.fillText(wName, 0, -2);
            } else {
                ctx.font = "bold 6px 'Segoe UI', Arial, sans-serif";
                ctx.fillText("REWARD: 1 KUGEL", 0, -2);
            }
            ctx.restore();
            return;
        }

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

    function drawTopBus(x, y) {
        ctx.save();
        ctx.translate(x, y);
        var bw = 24, bh = 54; // half-extents → 48 wide, 108 long
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(2, 6, bw + 4, bh - 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#F9A825"; roundRect(-bw, -bh, bw * 2, bh * 2, 10); ctx.fill();
        ctx.fillStyle = "#FBC02D"; roundRect(-bw + 2, -bh + 2, bw * 2 - 4, bh * 2 - 4, 8); ctx.fill();
        ctx.fillStyle = "#212121"; ctx.fillRect(-bw, -bh + 20, bw * 2, 4); ctx.fillRect(-bw, bh - 24, bw * 2, 4);
        // windshield at the front (bottom, toward player)
        ctx.fillStyle = "#81D4FA"; roundRect(-bw + 5, bh - 20, bw * 2 - 10, 14, 4); ctx.fill();
        // side windows
        ctx.fillStyle = "#4FC3F7";
        for (var wy = -bh + 26; wy < bh - 28; wy += 15) { ctx.fillRect(-bw + 4, wy, 8, 10); ctx.fillRect(bw - 12, wy, 8, 10); }
        drawText("SCHOOL", 0, -bh + 12, "bold 8px Arial", "#212121", null, 0);
        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(-6, -8, 12, 12); // roof hatch
        ctx.fillStyle = "#F44336"; ctx.beginPath(); ctx.arc(-bw + 6, bh - 3, 3, 0, Math.PI * 2); ctx.arc(bw - 6, bh - 3, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFEB3B"; ctx.beginPath(); ctx.arc(-bw + 6, -bh + 4, 3, 0, Math.PI * 2); ctx.arc(bw - 6, -bh + 4, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#222";
        roundRect(-bw - 3, -bh + 22, 6, 16, 2); ctx.fill(); roundRect(bw - 3, -bh + 22, 6, 16, 2); ctx.fill();
        roundRect(-bw - 3, bh - 38, 6, 16, 2); ctx.fill(); roundRect(bw - 3, bh - 38, 6, 16, 2); ctx.fill();
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

    // K9 UNIT — a blacked-out cruiser-SUV with a barking dog in the back, used
    // when a fugitive's heat is high. Boxier + darker than a patrol car.
    function drawK9Car(x, y, sirenTime) {
        ctx.save();
        ctx.translate(x, y);
        var hw = CAR_W / 2 + 6, hh = CAR_H / 2 + 6;
        ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.beginPath(); ctx.ellipse(2, 8, hw + 4, hh - 4, 0, 0, Math.PI * 2); ctx.fill();
        // boxy black SUV body
        ctx.fillStyle = "#0C0F13"; roundRect(-hw - 2, -hh - 2, hw * 2 + 4, hh * 2 + 4, 8); ctx.fill();
        var bg = ctx.createLinearGradient(-hw, 0, hw, 0);
        bg.addColorStop(0, "#1A1E24"); bg.addColorStop(0.5, "#2C333B"); bg.addColorStop(1, "#1A1E24");
        ctx.fillStyle = bg; roundRect(-hw, -hh, hw * 2, hh * 2, 7); ctx.fill();
        // white "POLICE K9" door panel
        ctx.fillStyle = "#ECEFF1"; roundRect(-hw, -6, hw * 2, 22, 0); ctx.fill();
        drawText("K9", 0, 6, "bold 11px Arial", "#0D1B5E", null, 0);
        // windshield + rear cage window
        ctx.fillStyle = "#37474F"; roundRect(-hw + 7, -hh + 7, hw * 2 - 14, 22, 5); ctx.fill();
        ctx.fillStyle = "#546E7A"; roundRect(-hw + 9, -hh + 9, hw * 2 - 18, 18, 4); ctx.fill();
        // rear cage with a dog silhouette (barking — head bobs)
        ctx.fillStyle = "#11161B"; roundRect(-hw + 8, hh - 30, hw * 2 - 16, 22, 4); ctx.fill();
        ctx.strokeStyle = "#5A6772"; ctx.lineWidth = 1;
        for (var cg = -hw + 12; cg < hw - 10; cg += 6) { ctx.beginPath(); ctx.moveTo(cg, hh - 30); ctx.lineTo(cg, hh - 8); ctx.stroke(); }
        var bob = Math.abs(Math.sin(sirenTime * 6)) * 2;
        ctx.fillStyle = "#5D4037"; ctx.beginPath(); ctx.arc(0, hh - 20 - bob, 5, 0, Math.PI * 2); ctx.fill();   // dog head
        ctx.fillStyle = "#3E2723"; ctx.beginPath(); ctx.moveTo(-5, hh - 24 - bob); ctx.lineTo(-2, hh - 27 - bob); ctx.lineTo(-2, hh - 22 - bob); ctx.closePath(); ctx.fill();  // ear
        ctx.beginPath(); ctx.moveTo(5, hh - 24 - bob); ctx.lineTo(2, hh - 27 - bob); ctx.lineTo(2, hh - 22 - bob); ctx.closePath(); ctx.fill();
        // roof light bar (red/blue strobe)
        var flashR = Math.sin(sirenTime * 18) > 0;
        ctx.fillStyle = "#11161B"; roundRect(-14, -4, 28, 7, 2); ctx.fill();
        ctx.fillStyle = flashR ? "#FF1744" : "#7A1320"; roundRect(-13, -3, 12, 5, 1); ctx.fill();
        ctx.fillStyle = flashR ? "#0D2A6B" : "#2979FF"; roundRect(1, -3, 12, 5, 1); ctx.fill();
        ctx.fillStyle = flashR ? "rgba(255,23,68,0.18)" : "rgba(41,121,255,0.18)";
        ctx.beginPath(); ctx.arc(flashR ? -7 : 7, 0, 22, 0, Math.PI * 2); ctx.fill();
        // chunky tires
        ctx.fillStyle = "#0A0A0A";
        roundRect(-hw - 4, -hh + 12, 8, 18, 3); ctx.fill(); roundRect(hw - 4, -hh + 12, 8, 18, 3); ctx.fill();
        roundRect(-hw - 4, hh - 30, 8, 18, 3); ctx.fill(); roundRect(hw - 4, hh - 30, 8, 18, 3); ctx.fill();
        ctx.restore();
    }

    // A little roadside police motor-pool: paved lot, parked cruisers, a
    // standing officer, and one walking a cuffed perp in. Drawn relative to a
    // scrolling building-like record {x (center), y (top), w, h, side}. Reused
    // as the lot the arrest cruiser pulls into at the station.
    function drawPoliceLot(b) {
        var lw = b.w, lh = b.h, lx = b.x - lw / 2, ly = b.y, t = gameTime;
        ctx.save();
        // drop shadow + asphalt pad
        ctx.fillStyle = "rgba(0,0,0,0.18)"; roundRect(lx + 3, ly + 5, lw, lh, 7); ctx.fill();
        var pg = ctx.createLinearGradient(0, ly, 0, ly + lh);
        pg.addColorStop(0, "#74797E"); pg.addColorStop(1, "#5E6368");
        ctx.fillStyle = pg; roundRect(lx, ly, lw, lh, 7); ctx.fill();
        ctx.strokeStyle = "#3F4448"; ctx.lineWidth = 2; roundRect(lx, ly, lw, lh, 7); ctx.stroke();
        // yellow parking-bay lines
        ctx.strokeStyle = "rgba(255,213,79,0.75)"; ctx.lineWidth = 2;
        for (var py = ly + 20; py < ly + lh - 16; py += 38) {
            ctx.beginPath(); ctx.moveTo(lx + 8, py); ctx.lineTo(lx + lw - 8, py); ctx.stroke();
        }
        // POLICE sign on a post at the entrance
        ctx.fillStyle = "#37474F"; ctx.fillRect(b.x - 1.5, ly - 16, 3, 16);
        ctx.fillStyle = "#1A237E"; roundRect(b.x - 26, ly - 30, 52, 15, 3); ctx.fill();
        drawText("POLICE", b.x, ly - 22, "bold 9px 'Segoe UI', Arial", "#FFD54F", "#000", 2);
        // two parked cruisers (static), scaled to fit the bays
        var sc = Math.min(0.7, (lw - 14) / (CAR_W + 12));
        for (var c = 0; c < 2; c++) {
            ctx.save(); ctx.translate(b.x, ly + 34 + c * 40); ctx.scale(sc, sc); drawCopCar(0, 0, 0); ctx.restore();
        }
        // an officer standing watch (lower-left)…
        drawAngryMan(lx + 16, ly + lh - 12, t, "talk", 1, true);
        // …and an officer walking a cuffed perp toward the door (lower-right)
        var ex = lx + lw - 30, ey = ly + lh - 12;
        ctx.save(); ctx.translate(ex + 13, ey);
        ctx.fillStyle = "#CFD8DC"; roundRect(-6, -16, 12, 16, 3); ctx.fill();             // perp torso
        ctx.strokeStyle = "#78909C"; ctx.lineWidth = 1.4;                                  // prison stripes
        ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(6, -12); ctx.moveTo(-6, -7); ctx.lineTo(6, -7); ctx.moveTo(-6, -2); ctx.lineTo(6, -2); ctx.stroke();
        ctx.fillStyle = (typeof C !== "undefined" && C.skin) || "#FFD9C0"; ctx.beginPath(); ctx.arc(0, -20, 5, 0, Math.PI * 2); ctx.fill();   // head
        ctx.fillStyle = "#5D4037"; ctx.beginPath(); ctx.arc(0, -22, 5, Math.PI, 0); ctx.fill();   // hair
        ctx.fillStyle = "#B0BEC5"; ctx.fillRect(-3, -6, 6, 3);                              // cuffs
        ctx.restore();
        drawAngryMan(ex, ey, t, "running", 1, true);
        ctx.restore();
    }

    // ── Drawing: Parking scene ───────────────────────────────