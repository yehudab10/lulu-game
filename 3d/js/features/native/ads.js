// features/native/ads.js — AdMob + App Tracking Transparency in the iOS app.
// A port of the classic game's ad manager (src/10c-ads.js): the SAME ad unit
// IDs, isTesting setting, ATT-before-init order and placements, in 3D terms:
//   • ATT: ~1.2 s after launch the app asks for tracking authorization (only
//     while the user hasn't answered), and only THEN initializes AdMob. Apple
//     rejected the app once (Guideline 2.1) for a missing ATT prompt — the
//     AdMob SDK links the ATT framework and Info.plist carries
//     NSUserTrackingUsageDescription, so the sheet MUST appear.
//   • Interstitial — WHEN (owner, 2026-11-20; AGENTS golden rule 4b): every 2nd knock-out (out of hearts — there's no
//     game-over card in normal play) and once during a jail stay; also every 2nd game-over card that still exists
//     (parking's challenge). One break counter for knock-outs + cards (`interstitialEveryN`).
//   • Rewarded: the opt-in "📺 WATCH → +50 💰" — on a game-over card (one per card), and after a knock-out on the ❚❚
//     pause menu (one per knock-out, at most REWARD_KO_MAX a run).
//   • THE RULE: an ad never costs the player a moment.
//       – It only STARTS at a calm moment (calmNow): a knock-out's ad once she's back on her feet and WALKING (not the
//         spin-out, not the climb-out, not during the crash comedy / the ER, not while driving, not in a chase, no
//         dialogue / card / cutscene / skip / pause running) within KO_WINDOW s of the knock-out, else it's dropped; the
//         jail's when the cell is quiet (law emits "law:cellQuiet" once a stay — not the arrest, the booking, the court).
//       – While it's up the WHOLE GAME HOLDS (ctx.hold → app.js skips the frame: no game time, no state update, so every
//         script that waits on game time waits; no traffic, no world; A.holdAll: the music pauses, the AudioContext
//         suspends) and picks up exactly where it was.
//       – It ends on the plugin's own "dismissed" / "failed to show" events (v8: showInterstitial resolves as soon as
//         the ad APPEARS, so that is "shown", not "closed"); if nothing says it even appeared within showWaitMs (no
//         network, the app backgrounded…) or it's still "up" after maxAdMs, the game comes back anyway.
// On the web there is no Capacitor → every function is a silent no-op.
// In ?test runs it stays off unless the test opts in with &enable=ads.
import { ctx, on, emit, hook, addMenuItem } from "../../core/ctx.js";
import { pause, resume } from "../../core/screens.js";
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
    interstitialEveryN: 2,   // show an interstitial every Nth break (a knock-out or a game over)
    rewardCoins: 50,         // the rewarded ad's payout (the 2D game's +50 💰)
    attDelayMs: 1200,        // let the app become ACTIVE first: asking during the launch transition can silently no-op
    showWaitMs: 8000,        // the hold gives up if the ad hasn't even appeared by then (no network / no callback)
    maxAdMs: 60000,          // …or if it is still "up" this long after appearing (a lost "dismissed" event)
    minGapMs: 90000,         // never two interstitials closer than this (real time)
};
export const KO_WINDOW = 20; // s of game time after a knock-out in which its ad may still start (then it's dropped)

const S = {
    started: false, ready: false, rewardedReady: false, showing: false,
    gameOvers: 0, interstitials: 0, rewards: 0,
    knockouts: 0, koAd: null, koReward: false, jailAds: 0, lastAdAt: -1e9,
    hold: null,              // the ad on screen right now: { kind, why, shown, timer, t0 } (ctx.hold mirrors it)
    holds: [],               // tests: every hold { kind, why, state, phase, ms, how }
    att: "unknown",          // the ATT status we saw: notDetermined → (asked) → authorized / denied / restricted
    rewardCb: null, rewardUsed: false,
    log: [],                 // for tests / debugging: "att:status", "att:request", "admob:init", "show:interstitial"…
};
const note = what => { S.log.push(what); if (S.log.length > 60) S.log.shift(); };
const AdMob = () => plugin("AdMob");

/** Allowed to touch the ad SDK at all? (native app; a ?test run must opt in) */
function sdkAllowed() { return !!AdMob() && (!ctx.TEST || ctx.enabled("ads")); }
/** Allowed to show an ad in this mode at all? (never in a party or Dina's mode) */
function modeOK() {
    if (!sdkAllowed() || !S.ready) return false;
    if (!ctx.enabled("ads")) return false;                              // party's OFF set
    if (ctx.party && ctx.party.active) return false;                    // belt and braces
    if (ctx.dina && ctx.dina.active) return false;
    if (/^dina/.test(ctx.prevState || "") || (ctx.G && ctx.G.mode === "dina")) return false;
    return true;
}
/** Allowed to SHOW an ad right now? On the game-over card. */
function placementOK() { return modeOK() && ctx.state === "gameover" && !ctx.paused && !S.hold; }

/** A calm moment for an interstitial to START (THE RULE above). where: "foot" | "cell". */
export function calmNow(where) {
    if (!modeOK() || S.hold || S.showing || ctx.paused || ctx.dialogOpen || ctx.skipping) return false;
    if (ctx.cutscene && ctx.cutscene.active && ctx.cutscene.active()) return false;
    if (ctx.law && ctx.law.chasing) return false;                         // never while she's being chased
    if (where === "foot") {
        if (ctx.state !== "footRun" || H.screenOpen()) return false;
        const f = ctx.foot;
        if (!f || f.phase !== "walk" || (f.debug && f.debug.F && f.debug.F.chase)) return false;
        return true;
    }
    if (where === "cell") {
        if (ctx.state !== "lawJail") return false;
        const st = ctx.law && ctx.law._dbg && ctx.law._dbg.jail ? ctx.law._dbg.jail() : null;
        return !!st && st.phase === "cell";
    }
    return false;
}
const realNow = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

// ── the hold: the game stands still while an ad is on screen ─────────────
function holdOn(kind, why) {
    const h = { kind, why, shown: false, timer: null, t0: realNow(), state: ctx.state, phase: ctx.foot && ctx.foot.phase || null };
    S.hold = h;
    S.showing = true;
    ctx.hold = why;
    A.holdAll(true);
    note("hold:on:" + why);
    h.timer = setTimeout(() => holdOff("noshow"), ADMOB.showWaitMs);
    emit("ads:hold", { on: true, why, kind });
    return h;
}
function holdShown(kind) {
    const h = S.hold;
    if (!h || h.shown || (kind && h.kind !== kind)) return;
    h.shown = true;
    clearTimeout(h.timer);
    h.timer = setTimeout(() => holdOff("timeout"), ADMOB.maxAdMs);
    note("hold:shown");
}
function holdOff(how, kind) {
    const h = S.hold;
    if (!h || (kind && h.kind !== kind)) return;
    clearTimeout(h.timer);
    S.hold = null;
    S.showing = false;
    ctx.hold = null;
    A.holdAll(false);
    S.lastAdAt = realNow();
    S.holds.push({ kind: h.kind, why: h.why, state: h.state, phase: h.phase, ms: Math.round(realNow() - h.t0), how });
    if (S.holds.length > 20) S.holds.shift();
    note("hold:off:" + how);
    emit("ads:hold", { on: false, why: h.why, kind: h.kind, how });
    if (h.kind === "interstitial") prepInterstitial(); else prepRewarded();
}
/** Show the interstitial now, holding the game until it's gone. why: "ko" | "jail" | "gameover" | "debug". */
function showInterstitialHeld(why) {
    const ad = AdMob();
    if (!ad || S.hold) return false;
    S.interstitials++;
    note("show:interstitial");
    note(why + ":interstitial");
    holdOn("interstitial", why);
    try { Promise.resolve(ad.showInterstitial()).then(() => holdShown("interstitial"), () => holdOff("error", "interstitial")); }
    catch (e) { holdOff("error", "interstitial"); }
    return true;
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
            const listen = (ev, fn) => { try { const l = ad.addListener && ad.addListener(ev, fn); if (l && l.catch) l.catch(() => {}); } catch (e) { /* older plugin */ } };
            listen("onRewardedVideoAdReward", () => payReward("event"));
            // when an ad is really up / really gone (v8 InterstitialAdPluginEvents / RewardAdPluginEvents) — the hold follows these
            listen("interstitialAdShowed", () => holdShown("interstitial"));
            listen("interstitialAdDismissed", () => holdOff("dismissed", "interstitial"));
            listen("interstitialAdFailedToShow", () => holdOff("failed", "interstitial"));
            listen("onRewardedVideoAdShowed", () => holdShown("rewarded"));
            listen("onRewardedVideoAdDismissed", () => holdOff("dismissed", "rewarded"));
            listen("onRewardedVideoAdFailedToShow", () => holdOff("failed", "rewarded"));
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

/** Entering game over (parking's challenge card): every Nth break shows an interstitial — the card is a still moment. */
function onGameOver() {
    if (!placementOK()) return;
    S.gameOvers++;
    if (S.gameOvers % ADMOB.interstitialEveryN !== 0) return;
    showInterstitialHeld("gameover");
}

/** True only in the app with a rewarded ad loaded, on a card where it may be offered. */
export function rewardedAvailable() { return S.rewardedReady && !S.rewardUsed && placementOK(); }

// ── knock-outs (out of hearts: no game-over card any more) ───────────────
export const REWARD_KO_MAX = 3;
on("knockout", () => {
    if (!modeOK()) return;
    S.knockouts++;
    S.gameOvers++;                       // (one break counter: knock-outs + game-over cards → every Nth an interstitial)
    S.koReward = true;                   // one 📺 reward per knock-out (pause menu), capped a run
    if (S.gameOvers % ADMOB.interstitialEveryN === 0) S.koAd = { at: ctx.time };
});
// it starts only once she's back on her feet and walking — a calm moment (see THE RULE); not in time → dropped
hook("hud", () => {
    const k = S.koAd;
    if (!k) return;
    if (ctx.time - k.at > KO_WINDOW || ctx.state === "title") { S.koAd = null; note("ko:dropped"); return; }
    if (!calmNow("foot") || realNow() - S.lastAdAt < ADMOB.minGapMs) return;
    S.koAd = null;
    showInterstitialHeld("ko");
});
// ── one in a jail stay: when the cell is quiet (law/jail.js emits it once a stay) ──
on("law:cellQuiet", () => {
    if (!calmNow("cell") || realNow() - S.lastAdAt < ADMOB.minGapMs) { note("jail:skipped"); return; }
    S.jailAds++;
    showInterstitialHeld("jail");
});
/** The pause menu's 📺 after a knock-out. */
function koRewardOK() {
    const G = ctx.G || {};
    return S.koReward && S.rewardedReady && modeOK() && (G.adRewards || 0) < REWARD_KO_MAX && !!ctx.paused && !S.hold;
}
addMenuItem("pause", {
    id: "adReward", order: 6, group: "main",
    label: () => `📺 Watch an ad for +${ADMOB.rewardCoins} coins`,
    visible: () => koRewardOK(),
    action: () => {
        if (!koRewardOK()) return;
        S.koReward = false;
        const G = ctx.G;
        G.adRewards = (G.adRewards || 0) + 1;
        note("button:rewardedKO");
        resume();
        pause();                         // (re-open without the button; the game holds while the ad plays)
        showRewarded(() => {
            S.rewards++;
            wallet.add(ADMOB.rewardCoins);
            emit("stat", { id: "adRewards", n: 1 });
            H.toast(`+${ADMOB.rewardCoins} 💰 Thanks for watching!`, "gold");
        });
    },
});

/** Show the rewarded ad (the game holds while it's up); onReward() fires once if the player earns it. */
export function showRewarded(onReward) {
    const ad = AdMob();
    if (!ad || !S.rewardedReady || S.hold) return false;
    S.rewardCb = onReward || null;
    S.rewardedReady = false;
    note("show:rewarded");
    holdOn("rewarded", "rewarded");
    try {
        Promise.resolve(ad.showRewardVideoAd && ad.showRewardVideoAd()).then(item => {
            // Some plugin versions resolve with the reward item; otherwise the
            // onRewardedVideoAdReward event pays (rewardCb stays armed for it).
            if (item) payReward("result");
            holdShown("rewarded");
        }).catch(() => { S.rewardCb = null; holdOff("error", "rewarded"); });
    } catch (e) { S.rewardCb = null; holdOff("error", "rewarded"); }
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
    b.innerHTML = `📺 Watch an ad for +${ADMOB.rewardCoins} coins`;
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
    /** An ad is on screen (the game is holding). */
    get holding() { return !!S.hold; },
    calmNow,
    /** Counters + the call log (tests); interstitial(why) shows one now through the same held path. */
    debug: { S, ADMOB, log: S.log, interstitial: why => showInterstitialHeld(why || "debug"), release: how => holdOff(how || "debug") },
};

init();
