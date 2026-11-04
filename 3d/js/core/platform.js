// Platform detection + TV / console mode.
//
// "TV mode" is the 10-foot layout: bigger HUD and menus, safe-area margins for
// TVs that overscan, no hover-only affordances, the mouse cursor hidden until
// it moves. It switches on automatically on consoles (PlayStation / Xbox
// browsers) and smart TVs, and can be forced in Settings.
//
// PlayStation note: the PS5's built-in browser is hidden and (as of the last
// reports) has no WebGL, so main.js shows a friendly "play the 2D game" card
// there. If it ever works — or on a PS4/PS5 browser that exposes no Gamepad
// API but sends the controller as keys — we keep PlayStation button glyphs and
// treat the arrow / Enter / Escape keys as the controller.
import { ctx } from "./ctx.js";
import { input } from "../input.js";

export function detectPlatform() {
    const ua = navigator.userAgent || "";
    const ps = /PlayStation/i.test(ua);
    const xbox = /Xbox/i.test(ua);
    const nintendo = /Nintendo (Switch|WiiU)/i.test(ua);
    const tv = /SMART-TV|SmartTV|Tizen|Web0S|webOS|BRAVIA|AFT[A-Z]|CrKey|Android TV|GoogleTV|HbbTV|NetCast|Roku|\bTV\b/i.test(ua);
    const consoleBrowser = ps || xbox || nintendo;
    const p = {
        ua, ps, ps5: /PlayStation 5/i.test(ua), xbox, nintendo, tv, console: consoleBrowser,
        gamepadApi: typeof navigator.getGamepads === "function",
    };
    if (consoleBrowser) {
        input.padKind = ps ? "ps" : nintendo ? "nintendo" : "xbox";
        if (!p.gamepadApi) {
            // the controller arrives as arrow / Enter / Escape key presses
            input.tvKeys = true;
            input.device = "gamepad";
            input.padConnected = true;
            input.padName = ps ? "PlayStation controller" : "Controller";
        }
    }
    return p;
}

let cursorTimer = 0;
export function applyTvMode(on) {
    document.body.classList.toggle("tv", !!on);
    ctx.tv = !!on;
    if (on && !applyTvMode.bound) {
        applyTvMode.bound = true;
        window.addEventListener("mousemove", () => {
            document.body.classList.add("cursor");
            clearTimeout(cursorTimer);
            cursorTimer = setTimeout(() => document.body.classList.remove("cursor"), 2500);
        });
    }
}
