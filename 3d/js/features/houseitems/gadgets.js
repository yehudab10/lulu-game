// features/houseitems — 🚀🌶️ MISSILES + PEPPER SPRAY, MORE WAYS (round 2; the owner: "think creatively, even with missiles and
// pepper spray"). Still bought at Shmerel's van / the makolet, still one spent per use; from the car exactly as garage has them.
//
//   🚀 on foot (the fire button): fired STRAIGHT UP = a firework (the street looks up; at the Avenue M Ballroom on a wedding
//      evening "the best simcha entrance EVER"; on Lag BaOmer the kids cheer) · at the impound gate it does NOT open it
//      ("nice try" — Bruno). NEVER at a person (it only goes up), NEVER indoors (a line, nothing spent), NEVER by a school in
//      school hours (a line, nothing spent). A cop who sees a firework → a ⚠️ look (crime's footCrime: the second → a chase).
//   🚀 from the car: a rocket that knocks out a cruiser → a chase (or one more star + the charge if one is on) — law's own rule.
//   🌶️ pepper in rooms + the contexts (contexts.js: the kiddush cholent, the fitting room…) — spent one at a time.
import { ctx, on, emit } from "../../core/ctx.js";
import { shared } from "../../core/save.js";
import { footCrime, copWatching } from "../crime/common.js";

export const G = { log: [], force: {} };
const log = (ev, d = {}) => { G.log.push(Object.assign({ ev }, d)); if (G.log.length > 40) G.log.shift(); emit("gadgets:" + ev, d); };
export const missilesN = () => { try { return shared.get().missiles | 0; } catch (e) { return 0; } };
export const pepperN = () => { try { return shared.get().pepperSpray | 0; } catch (e) { return 0; } };
export function spend(kind) { try { shared.update(s => { if (kind === "missile") s.missiles = Math.max(0, (s.missiles | 0) - 1); else s.pepperSpray = Math.max(0, (s.pepperSpray | 0) - 1); }); } catch (e) { /* */ } }
const pick = a => a[Math.floor(Math.random() * a.length)];
const near = (p, sp, r) => !!(p && sp) && Math.hypot(p.x - sp.x, p.z - sp.z) < r;
const spot = k => (ctx.town && ctx.town.active && ctx.town.spot ? ctx.town.spot(k) : null);

export const LINES = {
    indoors: ["No rockets INDOORS, Lulu. …that was Ima's voice. In her HEAD.", "*reaches for a rocket* …in a ROOM? No. Even she has limits."],
    school: ["Not by a SCHOOL. Not in school hours. Not EVER, actually. *puts it away*"],
    up: ["*FWOOOSH… BANG!* — a little firework over the street. Everyone looks up. A dog barks. A Bubbe says \"OOH.\"", "*fires it straight up* — *pop!* — pink sparkles. A kid on a bike: \"AGAIN!\""],
    hall: ["*FWOOOSH… BANG!* over the Avenue M Ballroom — the whole wedding spills out: \"THE BEST SIMCHA ENTRANCE EVER!\""],
    lag: ["*FWOOOSH… BANG!* — every kid at the bonfire CHEERS. It's Lag BaOmer. She's a legend now."],
    gate: ["*FWOOSH* — the rocket bonks off the impound gate. Bruno, not looking up from his sandwich: \"Nice try.\""],
    none: ["*click* …no rockets. Shmerel's van has some."],
};

/** 🚀 On foot: the fire button. → "firework" | "gate" | "indoors" | "school" | "none" | "" */
export function fireOnFoot() {
    const me = ctx.foot && ctx.foot.pos;
    if (!me) return "";
    const say = t => { try { ctx.foot.say(ctx.foot.obj, t, 2.8); } catch (e) { /* */ } };
    if (missilesN() <= 0 && !G.force.free) { say(pick(LINES.none)); return "none"; }
    // never by a school in school hours (nothing spent)
    const school = spot("school");
    const hours = G.force.school != null ? G.force.school : !!(ctx.cameras && ctx.cameras.schoolHours && ctx.cameras.schoolHours());
    if (hours && near(me, school, 80)) { say(pick(LINES.school)); log("school"); return "school"; }
    spend("missile");
    emit("stat", { id: "missilesFired", n: 1 });
    const gate = spot("impound");
    if (near(me, gate, 15)) { say(pick(LINES.gate)); burst(me.x, me.z, 3, false); log("gate"); return "gate"; }
    // straight up: a firework
    burst(me.x, me.z, 16, true);
    const hall = spot("simchaHall");
    const wedding = ctx.family && ctx.family.avigail && ctx.family.avigail().hall === "wedding";
    const lag = !!(ctx.seasons && ctx.seasons.is("lagBaomer"));
    say(pick(wedding && near(me, hall, 45) ? LINES.hall : lag ? LINES.lag : LINES.up));
    // a cop who saw it: a ⚠️ look (the second one → a chase) — crime's on-foot rule
    let law = "";
    try { if (G.force.cop || copWatching(me.x, me.z)) law = footCrime("firework", "ILLEGAL FIREWORKS", { x: me.x, z: me.z }) || "seen"; } catch (e) { /* no crime */ }
    log("firework", { law });
    return "firework";
}
/** A rising trail, then a burst of sparks at height h (the car's particle pool — no new draw calls). */
function burst(x, z, h, sparkle) {
    const fx = ctx.car && ctx.car.fx;
    if (!fx || !fx.emit) return;
    for (let i = 0; i < 8; i++) fx.emit(x, 1 + i * (h / 8), z, 0, 0.5, 0, 0.5, 0.5, [1, 0.85, 0.5]);
    if (!sparkle) return;
    setTimeout(() => { for (let k = 0; k < 40; k++) { const a = Math.random() * 6.28, u = Math.random() * 2 - 1, sp = 4 + Math.random() * 3;
        fx.emit(x, h, z, Math.cos(a) * sp * Math.sqrt(1 - u * u), u * sp, Math.sin(a) * sp * Math.sqrt(1 - u * u), 1.2, 0.8, [[1, 0.4, 0.7], [1, 0.9, 0.4], [0.6, 0.8, 1]][k % 3]); } }, 650);
}
// 🚀 from the car: knocking out a cruiser is a chase / one more star (law's own rule, like ramming one)
on("missile:hit", e => onMissileHit(e));
export function onMissileHit(e) {
    if (!e || !e.car || !/cop/.test(e.car.kind || "")) return;
    try { ctx.law && ctx.law.startChase && ctx.law.startChase("FIRING A ROCKET AT A POLICE CRUISER", { heat: 1 }); } catch (err) { console.error("[gadgets] law", err); }
    log("copHit");
}
