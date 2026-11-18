// features/cameos — put Lulu back on the road after a cameo scene (porch,
// salon, ER, the reprieve fallback): her lane, rolling gently, a short
// re-entry immunity, the road clear around her. Same idea as the 2D
// returnToDriving(): score, coins and the run carry on — it's the SAME run.
import { ctx, setState, emit } from "../../core/ctx.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";

export function resumeDriving({ banner = "", hearts = null, s = null, speed = 13, onFoot = false } = {}) {
    const { car, world, traffic } = ctx;
    const G = ctx.G;
    const S = s != null ? s : car.s;
    const d = onFoot ? 8.0 : 1.75;               // on foot: she starts on the shoulder, not in a live lane
    if (onFoot) speed = 0;
    const p = world.road.point(S, d, {});
    car.place(p.x, p.z, p.h);
    car.s = S; car.d = d;
    car.vx = Math.sin(p.h) * speed; car.vz = Math.cos(p.h) * speed;
    car.showDriver(true);
    car.obj.visible = true;
    for (const c of traffic.cars.slice()) if (!c.keep && Math.abs(c.s - S) < 70) traffic.remove(c);
    if (hearts != null) G.hearts = hearts;
    G.hearts = Math.max(1, Math.min(G.maxHearts || 3, G.hearts || 1));
    H.setHearts(G.hearts, G.maxHearts || 3);
    G.invT = Math.max(G.invT || 0, 3);
    G.ended = false;
    if (ctx.cam) ctx.cam.snap();
    A.setMusic(G.music || "../luludriving.mp3");
    setState("playing");
    if (banner) H.banner(banner, 2600);
    emit("cameos:resume", { s: S, onFoot });
    // no car to give back (a stolen ride she crashed, an impounded car): she walks out instead
    if (onFoot && ctx.foot && ctx.foot.start) ctx.foot.start("discharged");
}
