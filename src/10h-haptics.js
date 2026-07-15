
    // ══════════════════════════════════════════════════════════
    // ═══════════════════ HAPTIC FEEDBACK ══════════════════════
    // ══════════════════════════════════════════════════════════
    // Tactile juice at three impact levels + notification patterns.
    //  • Native (Capacitor iOS/Android): @capacitor/haptics — the real
    //    Taptic engine (impact Light/Medium/Heavy, notification
    //    Success/Warning/Error, selection ticks).
    //  • Web fallback: navigator.vibrate patterns (Android browsers;
    //    iOS Safari has no vibration API → silently no-ops).
    // Every call is throttled per-channel (a coin-combo shouldn't buzz
    // the phone into a massage chair), gated by save.hapticsOff (pause
    // menu toggle), and try/caught so haptics can never break the game.
    var Haptic = (function () {
        function plugin() {
            try {
                if (typeof window === "undefined" || !window.Capacitor) return null;
                var cap = window.Capacitor;
                if (!cap.isNativePlatform || !cap.isNativePlatform()) return null;
                return (cap.Plugins && cap.Plugins.Haptics) || null;
            } catch (e) { return null; }
        }
        function off() { return !!(typeof save !== "undefined" && save && save.hapticsOff); }

        // Per-channel throttle: channel → earliest next allowed time (ms clock).
        var nextAt = {};
        function gate(channel, minGapMs) {
            var now = Date.now();
            if (nextAt[channel] && now < nextAt[channel]) return false;
            nextAt[channel] = now + (minGapMs || 70);
            return true;
        }

        function impact(style, channel, gapMs, webPattern) {
            if (off() || !gate(channel || style, gapMs)) return;
            var hp = plugin();
            try {
                if (hp && hp.impact) { hp.impact({ style: style }); return; }
                if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(webPattern);
            } catch (e) {}
        }
        function notify(type, channel, gapMs, webPattern) {
            if (off() || !gate(channel || type, gapMs)) return;
            var hp = plugin();
            try {
                if (hp && hp.notification) { hp.notification({ type: type }); return; }
                if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(webPattern);
            } catch (e) {}
        }

        return {
            // Impacts — the physical "thunk" levels.
            light:  function (ch) { impact("LIGHT",  ch || "light",  70,  8); },
            medium: function (ch) { impact("MEDIUM", ch || "medium", 110, 18); },
            heavy:  function (ch) { impact("HEAVY",  ch || "heavy",  160, 35); },
            // Notifications — patterned feedback for outcomes.
            success: function (ch) { notify("SUCCESS", ch || "success", 250, [12, 40, 18]); },
            warning: function (ch) { notify("WARNING", ch || "warning", 250, [18, 40, 18]); },
            error:   function (ch) { notify("ERROR",   ch || "error",   250, [24, 50, 24, 50, 24]); },
            // Selection tick — the faintest touch, for UI taps.
            selection: function () {
                if (off() || !gate("sel", 60)) return;
                var hp = plugin();
                try {
                    if (hp && hp.selectionStart) { hp.selectionStart(); if (hp.selectionChanged) hp.selectionChanged(); if (hp.selectionEnd) hp.selectionEnd(); return; }
                    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(5);
                } catch (e) {}
            }
        };
    })();
