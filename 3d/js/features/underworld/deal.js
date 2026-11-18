// features/underworld — the roadside DEAL: she's pulled onto a glowing pad (Officer Krupnik's
// shoulder, Velvel's apron), the car rolls to a stop, the camera swings round to the window and the
// other side makes an offer (core/dialog say / choose). One state for every deal: "underworldDeal"
// with data { offer, run: async D => result } — D = { say(who, text), choose(text, options), alive }.
// When the script resolves (or the state is left) she's back on the road ("playing"); anything that
// must happen ON the road (a sting's chase, a call-in) goes in D.after(fn) and runs a frame later.
import * as THREE from "three";
import { ctx, registerState, setState, wrapAngle } from "../../core/ctx.js";
import { updateDriving } from "../../core/driving.js";
import { say as dlgSay, choose as dlgChoose, isOpen, closeDialog } from "../../core/dialog.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { CAST } from "./data.js";
import { UW, later } from "./common.js";

const SPEAKERS = {
    lulu: { name: "LULU", emoji: "💁‍♀️", color: "#E91E63" },
    cop: CAST.krupnik, feldman: CAST.feldman, velvel: CAST.velvel, fixer: CAST.fixer,
};
const tmp = {}, tmpB = {};
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
class Dead extends Error {}

let D = null;
registerState("underworldDeal", {
    hud: false, touch: false, pausable: true, driving: true,
    enter(data) {
        const offer = data.offer;
        D = { offer, t: 0, alive: true, after: [], done: false };
        A.duckMusic(0.18);
        H.prompt("");
        ctx.cam.snap();
        const api = {
            get alive() { return !!(D && D.alive); },
            say: async (who, text, opts = {}) => {
                if (!D || !D.alive) throw new Dead();
                const sp = SPEAKERS[who] || { name: who, emoji: "💬", color: "#555" };
                if (offer.talk) offer.talk(who);
                await dlgSay(opts.name || sp.name, text, { emoji: sp.emoji, color: sp.color, auto: opts.auto != null ? opts.auto : 1.6 + text.length / 50 });
                if (offer.talk) offer.talk(null);
                if (!D || !D.alive) throw new Dead();
            },
            choose: async (text, options, who = "lulu") => {
                if (!D || !D.alive) throw new Dead();
                const sp = SPEAKERS[who] || SPEAKERS.lulu;
                const i = await dlgChoose(sp.name, text, options, { emoji: sp.emoji, color: sp.color });
                if (!D || !D.alive) throw new Dead();
                return Math.max(0, i);
            },
            after: fn => { if (D) D.after.push(fn); },
        };
        const me = D;
        Promise.resolve().then(() => data.run(api)).catch(e => { if (!(e instanceof Dead)) console.error("[underworld] deal", e); })
            .then(() => { if (D === me && ctx.state === "underworldDeal") leave(); });
    },
    exit() {
        if (!D) return;
        D.alive = false;
        if (isOpen()) closeDialog();
        A.duckMusic(0.32);
        const after = D.after;
        D = null;
        // (on the road again: a sting's chase / a call-in need the driving state)
        for (const fn of after) later(0.05, fn);
        ctx.G.invT = Math.max(ctx.G.invT || 0, 1.5);
    },
    update(dt) {
        if (!D) return;
        D.t += dt;
        // ease to a stop where she pulled in (never reverse)
        const car = ctx.car, road = ctx.world.road;
        road.point(car.s + 12, car.d, tmp);
        const diff = wrapAngle(Math.atan2(tmp.x - car.pos.x, tmp.z - car.pos.z) - car.h);
        updateDriving(dt, {}, false, { steer: Math.max(-1, Math.min(1, -diff * 2)), throttle: 0, brake: car.vF > 0.6 ? 0.9 : 0, handbrake: car.speed < 0.6, analog: true });
        if (D.offer.tick) D.offer.tick(dt, true);
    },
    camera(dt) {
        if (!D) return false;
        // from the shoulder ahead of the car, looking back at her window and whoever she's talking to
        const car = ctx.car, road = ctx.world.road, o = D.offer;
        road.point(car.s + 7.5, car.d + 3.2, tmp);
        const who = o.who && o.who();
        if (who) { _b.set((who.x + car.pos.x) / 2, 1.2, (who.z + car.pos.z) / 2); }
        else { road.point(car.s - 1, car.d + 1, tmpB); _b.set(tmpB.x, 1.15, tmpB.z); }
        ctx.cam.cinematic(_a.set(tmp.x, 2.4, tmp.z), _b, dt, 1.8, 48);
        return true;
    },
});

/** Back on the road. */
export function leave() {
    if (ctx.state !== "underworldDeal") return;
    setState("playing");
}
/** Pull her in for a deal now (she must be driving). */
export function startDeal(offer, run) {
    if (ctx.state !== "playing") return false;
    UW.lastDeal = offer.kind;
    setState("underworldDeal", { offer, run });
    return true;
}
export const dealActive = () => !!D;
