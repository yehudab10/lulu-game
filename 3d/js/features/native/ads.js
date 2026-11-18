// features/native/ads.js — AdMob + App Tracking Transparency in the iOS app.
// A port of the classic game's ad manager (src/10c-ads.js): the SAME ad unit
// IDs, isTesting setting, ATT-before-init order and placements, in 3D terms:
//   • ATT: ~1.2 s after launch the app asks for tracking authorization (only
//     while the user hasn't answered), and only THEN initializes AdMob. Apple
//     rejected the app once (Guideline 2.1) for a missing ATT prompt — the
//     AdMob SDK links the ATT framework and Info.plist carries
//     NSUserTrackingUsageDescription, so the sheet MUST appear.
//   • Interstitial: every 2nd game over (the "gameover" state's card).
//   • Rewarded: an opt-in "📺 WATCH → +50 💰" button on that card, shown only
//     while an ad is actually loaded; one reward per game over.
// Never mid-drive (only the game-over card), never in a 🎉 party ("ads" is in
// party's OFF set and party.active is checked too), never in Dina's mode.
// On the web there is no Capacitor → every function is a silent no-op.
// In ?test runs it stays off unless the test opts in with &enable=ads.
import { ctx, on, emit } from "../../core/ctx.js";
import { wallet } from "../../core/save.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import { plugin, call } from "./cap.js";

// The REAL AdMob ad unit IDs for Lulu's Road Trip — identical to src/10c-ads.js.
// AdMob App ID (Info.plist GADApplicationIdentifier, injected by codemagic.yaml):
//   ca-app-pub-1477782549591980~6348467252
// isTesting:false serves LIVE ads — the App Store release setting.
// ⚠️ NEVER tap your own live ads (it can get the AdMob account banned): add your
// device's AdMob test-device ID to testingDevices to see TEST ads on it.
export const ADMOB = {
    interstitialId: "ca-app-pub-1477782549591980/3654325071", // real interstitial
    rewardedId:     "ca-app-pub-1477782549591980/2341243403", // real rewarded
    isTesting: false,        // false = LIVE ads (App Store release)
    testingDevices: [],      // add your device's test-device ID(s) to stay safe
    interstitialEveryN: 2,   // show an interstitial every Nth game over
    rewardCoins: 50,         // the rewarded ad's payout (the 2D game's +50 💰)
    attDelayMs: 1200,        // let the app become ACTIVE first: asking during the launch transition can silently no-op
};

const S = {
    started: false, ready: false, rewardedReady: false, showing: false,
    gameOvers: 0, interstitials: 0, rewards: 0,
    att: "unknown",          // the ATT status we saw: notDetermined → (asked) → authorized / denied / restricted
    rewardCb: null, rewardUsed: false,
    log: [],                 // for tests / debugging: "att:status", "att:request", "admob:init", "show:interstitial"…
};
const note = what => { S.log.push(what); if (S.log.length > 60) S.log.shift(); };
const AdMob = () => plugin("AdMob");

/** Allowed to touch the ad SDK at all? (native app; a ?test run must opt in) */
function sdkAllowed() { return !!AdMob() && (!ctx.TEST || ctx.enabled("ads")); }
/** Allowed to SHOW an ad right now? Only on the game-over card, never in a party or Dina's mode. */
function placementOK() {
    if (!sdkAllowed() || !S.ready) return false;
    if (!ctx.enabled("ads")) return false;                              // party's OFF set
    if (ctx.party && ctx.party.active) return false;                    // belt and braces
    if (ctx.dina && ctx.dina.active) return false;
    if (/^dina/.test(ctx.prevState || "") || (ctx.G && ctx.G.mode === "dina")) return false;
    return ctx.state === "gameover" && !ctx.paused;
}

// ── App Tracking Transparency ────────────────────────────────────────────
// The community AdMob plugin exposes ATT (trackingAuthorizationStatus /
// requestTrackingAuthorization) — the same calls the 2D game makes. Ask only
// when the user hasn't answered yet; a denial is fine (the IDFA comes back
// zeroed and AdMob serves non-personalized ads). Resolves no matter what, so
// ATT can never wedge the ads (or the game).
async function requestATT(ad) {
    if (typeof ad.trackingAuthorizationStatus !== "function" || typeof ad.requestTrackingAuthorization !== "function") return;
    note("att:status");
    const info = await call(ad, "trackingAuthorizationStatus");
    S.att = (info && info.status) || "unknown";
    for (let tries = 0; S.att === "notDetermined" && tries < 2; tries++) {
        // iOS silently ignores the request while the app isn't active (e.g. the player
        // switched away during launch) — wait until we're back on screen, then ask
        if (document.hidden) await new Promise(r => {
            const go = () => { if (!document.hidden) { document.removeEventListener("visibilitychange", go); setTimeout(r, 800); } };
            document.addEventListener("visibilitychange", go);
        });
        note("att:request");
        await call(ad, "requestTrackingAuthorization");
        const after = await call(ad, "trackingAuthorizationStatus");
        S.att = (after && after.status) || S.att;
    }
}

function prepInterstitial() {
    const ad = AdMob(); if (!ad || !S.ready) return;
    note("prep:interstitial");
    call(ad, "prepareInterstitial", { adId: ADMOB.interstitialId, isTesting: ADMOB.isTesting });
}
function prepRewarded() {
    const ad = AdMob(); if (!ad || !S.ready || typeof ad.prepareRewardVideoAd !== "function") return;
    S.rewardedReady = false;
    note("prep:rewarded");
    try {
        Promise.resolve(ad.prepareRewardVideoAd({ adId: ADMOB.rewardedId, isTesting: ADMOB.isTesting })).then(() => {
            S.rewardedReady = true;
            note("rewarded:loaded");
            addRewardButton();           // the game-over card may already be up
        }).catch(() => {});
    } catch (e) { /* no rewarded ads today */ }
}

/** Launch: ATT first, THEN AdMob.initialize, then preload both ad kinds. */
export function init() {
    if (S.started || !sdkAllowed()) return;
    S.started = true;
    setTimeout(async () => {
        const ad = AdMob(); if (!ad) return;
        try {
            await requestATT(ad);
            note("admob:init");
            await Promise.resolve(ad.initialize({ initializeForTesting: ADMOB.isTesting, testingDevices: ADMOB.testingDevices }));
            S.ready = true;
            // Reward event (the string is stable across plugin v6–v8).
            try {
                const l = ad.addListener && ad.addListener("onRewardedVideoAdReward", () => payReward("event"));
                if (l && l.catch) l.catch(() => {});
            } catch (e) { /* older plugin: showRewardVideoAd's result pays instead */ }
            prepInterstitial();
            prepRewarded();
            emit("ads:ready", { att: S.att });
        } catch (e) { note("admob:init-failed"); }   // ads unavailable → the game runs ad-free
    }, ADMOB.attDelayMs);
}

function payReward(how) {
    const cb = S.rewardCb;
    if (!cb) return;
    S.rewardCb = null;
    note("reward:" + how);
    cb();
}

/** Entering game over: every Nth one shows an interstitial (frequency-capped; preloads the next). */
function onGameOver() {
    if (!placementOK()) return;
    S.gameOvers++;
    if (S.gameOvers % ADMOB.interstitialEveryN !== 0) return;
    const ad = AdMob();
    S.interstitials++;
    S.showing = true;
    note("show:interstitial");
    call(ad, "showInterstitial").then(() => { S.showing = false; prepInterstitial(); });
}

/** True only in the app with a rewarded ad loaded, on a card where it may be offered. */
export function rewardedAvailable() { return S.rewardedReady && !S.rewardUsed && placementOK(); }

/** Show the rewarded ad; onReward() fires once if the player earns it. */
export function showRewarded(onReward) {
    const ad = AdMob();
    if (!ad || !S.rewardedReady) return false;
    S.rewardCb = onReward || null;
    S.rewardedReady = false;
    S.showing = true;
    note("show:rewarded");
    try {
        Promise.resolve(ad.showRewardVideoAd && ad.showRewardVideoAd()).then(item => {
            // Some plugin versions resolve with the reward item; otherwise the
            // onRewardedVideoAdReward event pays (rewardCb stays armed for it).
            if (item) payReward("result");
            S.showing = false;
            prepRewarded();
        }).catch(() => { S.rewardCb = null; S.showing = false; prepRewarded(); });
    } catch (e) { S.rewardCb = null; S.showing = false; prepRewarded(); }
    return true;
}

// ── the game-over card's 📺 button ───────────────────────────────────────
function addRewardButton() {
    if (!rewardedAvailable() || !H.screenOpen()) return;
    const card = H.screenCard();
    const menu = card && card.querySelector(".menu");
    if (!menu || card.querySelector("#adReward")) return;
    const b = document.createElement("button");
    b.className = "btn alt";
    b.id = "adReward";
    b.innerHTML = `📺 WATCH → +${ADMOB.rewardCoins} 💰`;
    b.addEventListener("click", () => {
        A.sfxSelect();
        if (!rewardedAvailable()) { b.remove(); H.refreshFocus(true); return; }
        S.rewardUsed = true;                       // one reward per game over
        b.disabled = true;
        b.remove();
        H.refreshFocus(true);
        showRewarded(() => {
            S.rewards++;
            wallet.add(ADMOB.rewardCoins);
            emit("stat", { id: "adRewards", n: 1 });
            H.toast(`+${ADMOB.rewardCoins} 💰 Thanks for watching!`, "gold");
        });
    });
    // second, under "Try again" — the controller's default focus stays on Try again,
    // and the D-pad reaches this like any other card button
    menu.insertBefore(b, menu.children[1] || null);
    H.refreshFocus(true);
    note("button:rewarded");
}

on("state", ({ to }) => {
    if (to !== "gameover") return;
    S.rewardUsed = false;
    onGameOver();
    addRewardButton();
});

// ── ctx.ads ──────────────────────────────────────────────────────────────
ctx.ads = {
    get native() { return !!AdMob(); },
    get ready() { return S.ready; },
    get att() { return S.att; },
    get rewardedReady() { return S.rewardedReady; },
    rewardedAvailable, showRewarded,
    /** Counters + the call log (tests). */
    debug: { S, ADMOB, log: S.log },
};

init();
