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
