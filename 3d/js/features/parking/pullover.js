// The in-drive PULL-OVER (startParkExit / dropToFoot in src/05-driving-loop.js).
//
// Crawl along in a SIDE lane (the outer lane or the shoulder — not the middle
// of the road) for 1.6 s — braking or just under ~25 mph — and a
// "🅿️ Hold ✕ to pull over" prompt appears. HOLD ✕ / A (or E) for half a second
// — a hold, so a quick ✕ meant for another feature (drive-thru, a hitchhiker…)
// never hijacks — or tap the 🚶 EXIT CAR touch button, and Lulu eases onto the
// nearer shoulder, braking to a stop
// (invincible for the moment), then drops into the casual parking minigame:
// ctx.parking.start({ from: "pullover" }). Not offered mid-chase (that would
// be a free escape) or while she's on foot.
import { ctx, on, hook, wrapAngle, css } from "../../core/ctx.js";
import { input, glyph, addTouchButton, rumble } from "../../input.js";
import * as H from "../../hud.js";
import { tone } from "./sfx.js";

const SLOW_MPS = 11;        // ~25 mph counts as "crawling"
const SHOW_AFTER = 1.6;     // 2D: slowDriveT > 1.6
const PULL_MAX_MPS = 12.5;  // won't start a pull-over faster than this
const HOLD_S = 0.5;         // hold ✕ this long

export const pullover = { slowT: 0, shown: false, exit: null, chase: false, promptOn: false, holdT: 0 };
const PO = pullover;

on("run:start", () => { PO.slowT = 0; PO.shown = false; PO.exit = null; PO.chase = false; clearPrompt(); });
on("cop:chase", e => { PO.chase = !!(e && e.active); });
on("state", e => { if (e.to !== "playing") { PO.shown = false; PO.slowT = 0; if (e.to !== "parking") PO.exit = null; clearPrompt(); } });

function clearPrompt() { if (PO.promptOn) { H.prompt(""); PO.promptOn = false; } }

function canPullOver() {
    const G = ctx.G;
    if (ctx.state !== "playing" || !ctx.parking) return false;
    if (PO.chase || G.noPullOver || G.wreckInfo && G.hearts <= 0) return false;
    if (ctx.foot && ctx.foot.active) return false;
    if (ctx.law && ctx.law.chasing) return false;
    return Math.abs(ctx.car.d) > 3.5;          // over in a side lane / on the shoulder
}

hook("update", (dt, P, controlsOn) => {
    const car = ctx.car;
    if (PO.exit) {
        PO.exit.t += dt;
        const done = (car.speed < 0.5 && PO.exit.t > 0.8) || PO.exit.t > 3.2;
        if (done && ctx.state === "playing") {
            PO.exit = null;
            car.vx = car.vz = 0; car.spin = 0;
            ctx.parking.start({ from: "pullover" });
        }
        return;
    }
    if (!controlsOn || !canPullOver()) { PO.slowT = 0; PO.shown = false; PO.holdT = 0; clearPrompt(); return; }
    const slow = input.brake > 0.3 || car.speed < SLOW_MPS;
    PO.slowT = slow ? PO.slowT + dt : Math.max(0, PO.slowT - dt * 2.5);
    PO.shown = PO.slowT > SHOW_AFTER;
    if (PO.shown) {
        // touch: the dedicated EXIT CAR button is a tap; everything else is a hold
        if (P.interact && input.device === "touch") { startExit(); return; }
        PO.holdT = input.interactHeld && car.speed < PULL_MAX_MPS ? PO.holdT + dt : 0;
        const pct = Math.min(100, PO.holdT / HOLD_S * 100).toFixed(0);
        H.prompt(`🅿️ Hold ${glyph("interact")} to pull over &amp; park<span class="po-bar"><i style="width:${pct}%"></i></span>`);
        PO.promptOn = true;
        if (PO.holdT >= HOLD_S) startExit();
    } else { PO.holdT = 0; clearPrompt(); }
}, -10);

css("pullover", `.prompt .po-bar { display: inline-block; vertical-align: middle; margin-left: 10px; width: 64px; height: 8px; border-radius: 4px; background: rgba(255,255,255,.25); overflow: hidden; }
.prompt .po-bar i { display: block; height: 100%; background: #CE93D8; }
body.tv .prompt .po-bar { width: 96px; height: 12px; }`);

function startExit() {
    const car = ctx.car;
    PO.exit = { t: 0, side: car.d < 0 ? -1 : 1 };
    PO.slowT = 0; PO.shown = false; PO.holdT = 0;
    clearPrompt();
    H.toast("🅿️ pulling over…", "pink");
    tone(440, 0.12, "sine", 0.1, 320);
    rumble(0.2, 0.4, 160);
}

// ease onto the shoulder, braking to a stop (runs last so nothing flips it)
hook("controls", (ctl) => {
    if (!PO.exit) return;
    const car = ctx.car, road = ctx.world.road;
    const look = Math.max(6, car.speed * 1.1);
    const tgt = road.point(car.s + look, PO.exit.side * 7.9, {});
    const want = Math.atan2(tgt.x - car.pos.x, tgt.z - car.pos.z);
    const diff = wrapAngle(want - car.h);
    ctl.steer = Math.max(-1, Math.min(1, -diff * 2.6));
    ctl.throttle = car.speed < 2.5 && PO.exit.t < 0.6 ? 0.25 : 0;
    ctl.brake = car.speed > 1 ? Math.min(0.55, 0.15 + car.speed / 26) : 0.6;
    ctl.handbrake = false;
    ctl.analog = true;
}, -100);

// she's invincible while pulling in (2D: invincibleTimer ≥ 0.3)
hook("damage", () => (PO.exit ? false : undefined), 95);

addTouchButton({ id: "pullover", emoji: "🚶", label: "EXIT CAR", action: "interact", visible: () => PO.shown && ctx.state === "playing" });
