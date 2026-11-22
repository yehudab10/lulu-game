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
import { ctx } from "../../core/ctx.js";
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
