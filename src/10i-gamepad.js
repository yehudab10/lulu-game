
    // ══════════════════════════════════════════════════════════
    // ═══════════════ GAME CONTROLLER (Gamepad API) ═════════════
    // ══════════════════════════════════════════════════════════
    // Plug in / pair any controller (PS5 DualSense, PS4, Xbox, Switch Pro…):
    //   D-pad / left stick … steer & move (the same as the arrow keys)
    //   R2 / RT … boost (↑)          L2 / LT … slow down (↓)
    //   ✕ / A … action (Space/Enter) — and CLICK where the pink pointer is in menus
    //   □ / X … missile (M)          ○ / B … honk (H)        △ / Y … on-foot interact (E)
    //   L1 / LB … pepper spray (X)   R1 / RB … siren (Z)     Share / View … ditch the car (Q)
    //   Options / Start / touchpad … pause (P)
    //   Right stick (anywhere) / left stick (in menus) … move the pointer
    // Menus are drawn on the canvas, so a controller gets a pointer it moves with
    // the stick and clicks with ✕ — exactly like a mouse click at that spot.
    // Haptics (Haptic.*) also rumble the controller.
    //
    // Mouse/cursor drag steering: holding the mouse button (or a console
    // browser's cursor "click") and moving steers like a finger drag does on
    // phones — handy on desktops and on TV/console browsers that turn the
    // controller into a cursor.
    var padGP = { prev: {}, connected: false, kind: "xbox", hintT: 0, lastUse: 0,
               cursor: { x: 240, y: 427 }, cursorAlpha: 0 };
    // Scenes where the left stick steers/moves instead of driving the pointer.
    var GP_STEER_STATES = { playing: 1, footRun: 1, footInterior: 1, footWedding: 1, dinaRun: 1,
                            cookieCatch: 1, dinaHome: 1, parking: 1 };

    function gpPad() {
        var pads = (navigator.getGamepads && navigator.getGamepads()) || [];
        for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) return pads[i];
        return null;
    }

    function gpRumble(strong, weak, ms) {
        if (typeof save !== "undefined" && save && save.hapticsOff) return;
        var p = gpPad();
        var va = p && p.vibrationActuator;
        if (!va || !va.playEffect || Date.now() - padGP.lastUse > 20000) return;
        try {
            var r = va.playEffect("dual-rumble", { startDelay: 0, duration: ms, strongMagnitude: strong, weakMagnitude: weak });
            if (r && r.catch) r.catch(function () {});
        } catch (e) {}
    }

    // The game's haptic moments rumble the controller too.
    (function () {
        if (typeof Haptic === "undefined" || !Haptic) return;
        var map = { light: [0.1, 0.35, 70], medium: [0.35, 0.55, 120], heavy: [0.9, 0.9, 260],
                    success: [0.2, 0.6, 160], warning: [0.4, 0.6, 180], error: [0.8, 0.8, 300], selection: [0, 0.2, 40] };
        Object.keys(map).forEach(function (k) {
            var orig = Haptic[k];
            if (typeof orig !== "function") return;
            Haptic[k] = function (ch) {
                try { orig(ch); } catch (e) {}
                gpRumble(map[k][0], map[k][1], map[k][2]);
            };
        });
    })();

    function gamepadUpdate(dt) {
        var p = gpPad();
        if (!p) {
            if (padGP.connected) {   // let go of anything the pad was holding
                ["left", "right", "up", "down"].forEach(function (k) { if (padGP.prev[k]) keys[k] = false; });
                padGP.prev = {};
                padGP.connected = false;
            }
            return;
        }
        if (!padGP.connected) {
            padGP.connected = true;
            padGP.kind = /054c|playstation|dualsense|dualshock|wireless controller/i.test(p.id) ? "ps" : "xbox";
            padGP.hintT = 6;
        }
        function btn(i) { var b = p.buttons[i]; return !!(b && (b.pressed || b.value > 0.5)); }
        var ax = p.axes[0] || 0, ay = p.axes[1] || 0, rx = p.axes[2] || 0, ry = p.axes[3] || 0;
        var steer = !!GP_STEER_STATES[state];
        var cur = {
            left: btn(14) || (steer && ax < -0.35),
            right: btn(15) || (steer && ax > 0.35),
            up: btn(12) || btn(7) || (steer && state !== "playing" && ay < -0.5),
            down: btn(13) || btn(6) || (steer && state !== "playing" && ay > 0.5),
            a: btn(0), b: btn(1), x: btn(2), y: btn(3), l1: btn(4), r1: btn(5),
            view: btn(8), start: btn(9), r3: btn(11), pad: btn(16) || btn(17)
        };
        var any = false;
        for (var k in cur) if (cur[k]) any = true;
        if (any || Math.abs(ax) > 0.2 || Math.abs(ay) > 0.2 || Math.abs(rx) > 0.2 || Math.abs(ry) > 0.2) padGP.lastUse = Date.now();

        // Held directions → the same `keys` the keyboard sets. Only written when
        // the pad's state CHANGES, so keyboard and touch keep working alongside.
        ["left", "right", "up", "down"].forEach(function (d) { if (cur[d] !== !!padGP.prev[d]) keys[d] = cur[d]; });
        function edge(n) { return cur[n] && !padGP.prev[n]; }
        if (edge("start") || edge("pad")) pauseQueued = true;
        if (edge("x")) missileQueued = true;
        if (edge("b")) honkQueued = true;
        if (edge("y")) footActQueued = true;
        if (edge("l1")) pepperQueued = true;
        if (edge("r1")) sirenQueued = true;
        if (edge("view")) exitQueued = true;

        // The pointer: right stick anywhere, left stick in menus.
        var c = padGP.cursor;
        var mx = Math.abs(rx) > 0.15 ? rx : (!steer ? ax : 0);
        var my = Math.abs(ry) > 0.15 ? ry : (!steer ? ay : 0);
        if (Math.abs(mx) > 0.15 || Math.abs(my) > 0.15) {
            var sp = 640 * dt;
            c.x = clamp(c.x + mx * Math.abs(mx) * sp * 1.4, 4, W - 4);
            c.y = clamp(c.y + my * Math.abs(my) * sp * 1.4, 4, H - 4);
        }
        if (edge("a") || edge("r3")) {
            if (!steer) {
                clickQueue = { x: c.x, y: c.y };
                tapFx.push({ x: c.x, y: c.y, t: 0 }); if (tapFx.length > 6) tapFx.shift();
            }
            queueAction();
        }
        padGP.prev = cur;
        if (padGP.hintT > 0) padGP.hintT -= dt;
        var showCursor = !steer && Date.now() - padGP.lastUse < 30000;
        padGP.cursorAlpha += ((showCursor ? 1 : 0) - padGP.cursorAlpha) * Math.min(1, dt * 10);
    }

    function drawGamepadCursor() {
        if (!padGP.connected) return;
        var c = padGP.cursor;
        if (padGP.cursorAlpha > 0.02) {
            ctx.save();
            ctx.globalAlpha = padGP.cursorAlpha;
            ctx.translate(c.x, c.y);
            // a chunky pink arrow pointer with a white outline
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(0, 24); ctx.lineTo(6, 18); ctx.lineTo(11, 29);
            ctx.lineTo(16, 27); ctx.lineTo(11, 16); ctx.lineTo(19, 16); ctx.closePath();
            ctx.fillStyle = "#E91E63"; ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 3;
            ctx.stroke(); ctx.fill();
            ctx.restore();
        }
        if (padGP.hintT > 0) {
            var a = clamp(padGP.hintT, 0, 1);
            var ok = padGP.kind === "ps" ? "✕" : "A";
            var txt = "🎮 Controller! Stick = pointer · " + ok + " = click · D-pad / R2 = drive";
            ctx.save();
            ctx.globalAlpha = a;
            ctx.font = "bold 14px sans-serif";
            var w = ctx.measureText(txt).width + 28;
            ctx.fillStyle = "rgba(43,27,46,0.85)";
            roundRect((W - w) / 2, H - 64, w, 30, 15);
            ctx.fill();
            ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(txt, W / 2, H - 49);
            ctx.restore();
        }
    }

    // Mouse / console-cursor drag steering (finger-drag already does this on touch).
    canvas.addEventListener("mousedown", function (e) {
        if (!GP_STEER_STATES[state] || steerTouchId !== null) return;
        var pos = screenToCanvas(e.clientX, e.clientY);
        if (typeof hitGameButton === "function" && hitGameButton(pos)) return;   // HUD buttons stay buttons
        steerTouchId = "mouse";
        touchX = pos.x; touchY = pos.y;
    });
    canvas.addEventListener("mousemove", function (e) {
        if (steerTouchId !== "mouse") return;
        var pos = screenToCanvas(e.clientX, e.clientY);
        touchX = pos.x; touchY = pos.y;
    });
    window.addEventListener("mouseup", function () {
        if (steerTouchId === "mouse") { steerTouchId = null; touchX = null; touchY = null; }
    });
