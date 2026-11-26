// features/native — the iOS app (Capacitor) glue for 2.0. On the web every part
// is a no-op: nothing here runs unless window.Capacitor.isNativePlatform().
//   ads.js      AdMob + App Tracking Transparency (a port of src/10c-ads.js):
//               ATT before AdMob init, an interstitial every 2nd knock-out + once a jail stay
//               (the game HOLDS while any ad is up — AGENTS rule 4b), the opt-in 📺 rewarded · ctx.ads
//   haptics.js  touch-play rumble → the Taptic engine (@capacitor/haptics) · ctx.haptics
//   ota.js      updates of the web game from the server (the stable channel): download in the background,
//               switch at the next launch, roll back a copy that never reaches the title · ctx.native.ota
//   cap.js      isNative() / plugin(name) — Capacitor.Plugins, like the 2D game
// See IOS_BUILD.md for the build + App Review side.
import { ctx, addMenuItem } from "../../core/ctx.js";
import * as H from "../../hud.js";
import { isNative, platformName } from "./cap.js";
import "./ads.js";
import "./haptics.js";
import { ota } from "./ota.js";

ctx.native = {
    get active() { return isNative(); },
    get platform() { return platformName(); },
    ota,
};
if (isNative()) document.documentElement.classList.add("native-app");

// ⚙️ More → 📱 the app's version (only in the app): the owner can see which build is installed and whether the game
// on the server already needs a newer App Store build (then: Codemagic → Start new build). Tap = check for an update now.
addMenuItem("title", {
    id: "appVersion", order: 98, group: "more",
    visible: () => isNative(),
    label: () => `📱 ${ota.status().app || "App version"}`,
    sub: () => { const st = ota.status(); return st.needs ? `Needs a newer app (${st.needs} or later) — update from the App Store` : st.copy; },
    action: () => {
        H.toast("📱 Checking for an update…", "", { prio: 3, key: "ota-check" });
        Promise.resolve(ota.check()).then(r => {
            const say = { "up to date": "The game is up to date", downloaded: "An update is ready — it starts next time you open the app",
                "already downloaded": "An update is ready — it starts next time you open the app", offline: "No internet right now",
                "needs a newer app": "The game needs a newer app — update from the App Store", paused: "Updates are paused for now",
                revert: "Going back to the built-in game next time", "bundled copy is newer": "The game is up to date",
                "waiting for Wi-Fi": "An update is waiting for Wi-Fi" }[r] || "Couldn't check right now";
            H.toast(`📱 ${say}`, "", { prio: 3, key: "ota-check" });
        });
    },
});

