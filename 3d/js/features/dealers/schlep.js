// features/dealers/schlep.js — ⚡ FULL SCHLEP DRIVING (a parody subscription for the Tushla cars).
//   THE SUBSCRIPTION: 100 coins per 30 REAL days (data.js SUB), bought at Tushla's tablet. It shows "renews in N days";
//   cancel any time (it runs to the end of what she paid, then stops); at the end it renews ONCE if she isn't cancelled and
//   has the coins — otherwise it lapses quietly. Never a debt, never below 0 (garage/buy.js buyExtra).
//   THE DRIVING: in a Tushla car on the highway, ❚❚ › "⚡ Let the car drive" → it holds a lane of OUR side at the mode's
//   speed, never over the limit (law/data.js SPEED_LIMIT; a camera / a trooper never sees a speeder), keeps its gap,
//   overtakes (Normal / Meshuga) when the next lane is clear. Steering, braking, nitro or the handbrake take over at once.
//   It HANDS BACK with a chime: a chase, a work zone ahead, a job (💼 hustle), a town, getting out, a crash. It earns no
//   close-call / style bonus (ctx.G.selfDriving — core/driving.js + moves/common.js) and pays nothing. Quirks now and then.
//   Stage 2b (later): through town to the 📍 Ping, once ci/hud's ping lands.
import { ctx, on, emit, hook, MPH, wrapAngle, addMenuItem } from "../../core/ctx.js";
import { saveSoon } from "../../core/save.js";
import { resume } from "../../core/screens.js";
import { autoDrive } from "../../core/driving.js";
import { input } from "../../input.js";
import * as H from "../../hud.js";
import { LANES_OURS } from "../../world.js";
import { buyExtra } from "../garage/buy.js";
import { SPEED_LIMIT } from "../law/data.js";
import { zoneAhead } from "../roadevents/construction.js";
import { SUB, EV_IDS } from "./data.js";
import { DS } from "./perks.js";

const DAY = 86400000;
const now = () => (ctx.schlepNow ? ctx.schlepNow() : Date.now());          // (tests move the clock)
const pick = a => a[Math.floor(Math.random() * a.length)];
const SD = { on: false, lane: 0, changeT: 0, quirkT: 30, brakeT: 0, last: "" };

// ── the subscription ──
function sub() { return DS.sub || null; }
export const subActive = () => { const s = sub(); return !!(s && !s.lapsed && s.until > now()); };
export const daysLeft = () => { const s = sub(); return s ? Math.max(0, Math.ceil((s.until - now()) / DAY)) : 0; };
/** Subscribe (or un-cancel). → { ok, why? } */
export function subscribe() {
    const s = sub();
    if (s && !s.lapsed && s.until > now()) { if (s.cancelled) { s.cancelled = false; saveSoon(); emit("dealers:sub", { act: "resume" }); return { ok: true, resumed: true }; } return { ok: false, why: "active" }; }
    const r = buyExtra("subscription", "schlep", SUB.price);
    if (!r.ok) return r;
    DS.sub = { until: now() + SUB.days * DAY, cancelled: false, since: now() };
    saveSoon();
    emit("dealers:sub", { act: "start", price: SUB.price });
    return { ok: true };
}
/** Cancel: it runs to the end of what she paid, then stops. Never a refund, never a debt. */
export function cancel() {
    const s = sub();
    if (!s || s.cancelled) return false;
    s.cancelled = true; saveSoon();
    emit("dealers:sub", { act: "cancel" });
    return true;
}
/** At the end of a period: renew ONCE if not cancelled and she has the coins, else lapse quietly. */
export function renewCheck() {
    const s = sub();
    if (!s || s.until > now() || s.lapsed) return;
    if (!s.cancelled) {
        const r = buyExtra("subscription", "schlep", SUB.price);
        if (r.ok) { s.until = now() + SUB.days * DAY; saveSoon(); emit("dealers:sub", { act: "renew", price: SUB.price }); H.toast(`⚡ Full Schlep Driving renewed — ${SUB.price} 💰 for ${SUB.days} more days`, "", { key: "schlepSub" }); return; }
    }
    s.lapsed = true; saveSoon();
    if (SD.on) handBack("lapsed");
    emit("dealers:sub", { act: "lapse" });
    H.toast("⚡ Full Schlep Driving has ended. Renew any time at Tushla's tablet.", "", { key: "schlepSub" });
}
on("run:start", () => renewCheck());
let subT = 0;
hook("hud", dt => { if ((subT -= dt) <= 0) { subT = 30; renewCheck(); } });

// ── the self-driving ──
const evCar = () => !!(ctx.car && EV_IDS.includes(ctx.car.skinKey));
const mode = () => SUB.modes[DS.sdMode] ? DS.sdMode : "normal";
/** Why it can't drive right now ("" = it can). */
function blocker() {
    if (!subActive()) return "sub";
    if (!evCar()) return "car";
    if (ctx.state !== "playing") return "state";
    if (ctx.G && ctx.G.mode === "dina") return "dina";
    if (ctx.town && ctx.town.active) return "town";
    if (ctx.foot && ctx.foot.active) return "foot";
    if (ctx.law && (ctx.law.chasing || ctx.law.wanted > 0)) return "chase";
    if (ctx.hustle && ctx.hustle.job) return "job";
    if (ctx.car && zoneAhead(ctx.car.s, 150)) return "construction";
    return "";
}
const BACK = {
    you: "🫱 You've got it.", chase: "🚨 Police! Your car, your problem — you drive.", construction: "🚧 Work zone ahead — the car says it's your turn.",
    job: "💼 A job? The car doesn't do jobs. You drive.", town: "🏘️ Town streets — your turn (it only does the highway, for now).",
    foot: "", state: "", crash: "💥 Bump! The car gave the wheel back. Sulking.", lapsed: "⚡ The subscription ended. You drive.", car: "", dina: "",
};
function chime(up) {
    import("../parking/sfx.js").then(m => { m.tone(up ? 660 : 880, 0.08, "sine", 0.12); setTimeout(() => m.tone(up ? 880 : 660, 0.12, "sine", 0.12), 110); }).catch(() => {});
}
/** Engage. → started? (a toast says why not) */
export function engage() {
    const b = blocker();
    if (b) {
        H.toast(b === "sub" ? "⚡ Full Schlep Driving needs a subscription (Tushla's tablet)" : b === "car" ? "⚡ Only a Tushla can drive itself" : BACK[b] || "⚡ Not now", "", { key: "schlep" });
        return false;
    }
    const d = ctx.car.d;
    SD.on = true; SD.lane = d > 0 && Math.abs(d - LANES_OURS[1]) < Math.abs(d - LANES_OURS[0]) ? 1 : 0;
    SD.changeT = 2; SD.quirkT = 25 + Math.random() * 40; SD.brakeT = 0;
    ctx.G.selfDriving = true;
    chime(true);
    H.toast(`⚡ Full Schlep Driving: ${SUB.modes[mode()].name} — steer or brake to take over`, "gold", { key: "schlep" });
    emit("dealers:selfdrive", { on: true, mode: mode() });
    return true;
}
/** Hand the wheel back (why: a key of BACK). */
export function handBack(why = "you") {
    if (!SD.on) return;
    SD.on = false; SD.last = why;
    if (ctx.G) ctx.G.selfDriving = false;
    chime(false);
    if (BACK[why]) H.toast(BACK[why], why === "you" ? "" : "gold", { key: "schlep" });
    emit("dealers:selfdrive", { on: false, why });
}
/** The speed it drives at (m/s): the mode's, never over the limit (a mile under, so no radar ever flags it). */
export function targetSpeed() {
    const m = SUB.modes[mode()];
    const mph = Math.min(m.mph || SPEED_LIMIT, SPEED_LIMIT) - 1;
    return mph / MPH;
}
hook("controls", (ctl, dt) => {
    if (!SD.on) return;
    if (Math.abs(input.steer) > 0.35 || input.brake > 0.35 || input.boost || input.handbrake) { handBack("you"); return; }
    const b = blocker();
    if (b) { handBack(b); return; }
    const car = ctx.car, M = SUB.modes[mode()], T = ctx.traffic;
    let v = targetSpeed();
    // the car ahead in our lane: follow it (the mode's gap), or pull out when the next lane is clear
    let lead = null;
    const d0 = LANES_OURS[SD.lane];
    if (T && T.cars) for (const c of T.cars) {
        if (c.hit || c.dir <= 0 || Math.abs(c.d - d0) > 1.6) continue;
        const ds = c.s - car.s;
        if (ds > 2 && ds < M.gap * 2 && (!lead || ds < lead.s - car.s)) lead = c;
    }
    SD.changeT -= dt;
    if (lead) {
        const ds = lead.s - car.s;
        const other = 1 - SD.lane;
        if (M.lanes && SD.changeT <= 0 && ds < M.gap * 1.6 && T.laneFree(car.s + 10, LANES_OURS[other], 1, M.gap) && T.laneFree(car.s - 8, LANES_OURS[other], 1, 12)) {
            SD.lane = other; SD.changeT = mode() === "meshuga" ? 3 : 6;
            emit("dealers:selfdrive", { on: true, lane: SD.lane });
        } else if (ds < M.gap) v = Math.min(v, Math.max(0, (lead.speed || 0) - (ds < M.gap * 0.6 ? 3 : 0.5)));
    }
    // a quirk now and then (a phantom brake is a real tap of the brake)
    if ((SD.quirkT -= dt) <= 0) {
        SD.quirkT = 40 + Math.random() * 50;
        const q = pick(SUB.quirks);
        if (/Phantom/.test(q)) SD.brakeT = 0.6;
        H.toast(q, "", { key: "schlepQuirk" });
        emit("dealers:selfdrive", { on: true, quirk: q });
    }
    const c = autoDrive(dt, LANES_OURS[SD.lane], v);
    if (car.speed > v + 0.6) { c.throttle = 0; c.brake = Math.max(c.brake, Math.min(0.6, (car.speed - v) * 0.15)); }
    if (SD.brakeT > 0) { SD.brakeT -= dt; c.throttle = 0; c.brake = 0.5; }
    // (a slight wobble back to the heading — autoDrive aims 14 m ahead; a lane change eases over)
    c.steer = Math.max(-0.6, Math.min(0.6, c.steer));
    Object.assign(ctl, c);
}, -90);
on("crash", () => { if (SD.on) handBack("crash"); });
on("state", ({ to }) => { if (SD.on && to !== "playing") handBack("state"); });
on("run:start", () => { if (SD.on) handBack("state"); });

// ── ❚❚ the pause menu: on / off, the mode ──
addMenuItem("pause", { id: "schlepOn", order: 84, cls: "alt",
    label: () => (SD.on ? "⚡ Take the wheel back" : `⚡ Let the car drive (${SUB.modes[mode()].name})`),
    visible: () => ctx.state === "playing" && subActive() && evCar() && !(ctx.town && ctx.town.active) && !(ctx.foot && ctx.foot.active),
    action: () => { const was = SD.on; resume(); if (was) handBack("you"); else engage(); } });
addMenuItem("pause", { id: "schlepMode", order: 85, cls: "alt",
    label: () => `⚡ Driving mode: ${SUB.modes[mode()].name} → ${SUB.modes[nextMode()].name}`,
    visible: () => ctx.state === "playing" && subActive() && evCar(),
    action: () => { setMode(nextMode()); resume(); H.toast(`⚡ Driving mode: ${SUB.modes[mode()].name} — ${SUB.modes[mode()].desc}`, "", { key: "schlep" }); } });
function nextMode() { const k = Object.keys(SUB.modes); return k[(k.indexOf(mode()) + 1) % k.length]; }
export function setMode(m) { if (SUB.modes[m]) { DS.sdMode = m; saveSoon(); return true; } return false; }

export const schlep = {
    subscribe, cancel, renewCheck, active: subActive, daysLeft, engage, handBack, setMode, targetSpeed,
    get on() { return SD.on; }, get mode() { return mode(); }, debug: SD,
};
