// features/houseitems — 🧭 MORE WAYS TO USE EVERYTHING (round 2, the owner: "more immersion… think creatively"): what the
// thing in her hand does depends on WHERE she is and WHO is near — discovered by trying. Each row is DATA:
//
//   { id, items: [item ids | "pepper"], where: "street" | "room:<interior id>", near: a probe name (PROBES below) or null,
//     when: a calendar / clock rule (WHEN below) or null, do: an effect name (index.js / gadgets.js EFFECTS), lines: [...],
//     consume: true (the thing is used up) }
//
// The first row that matches wins; nothing matches → the item's own verbs (data.js). Add a row (+ a probe / an effect if
// it needs a new one) and nothing else changes. Nothing here pays coins; nothing holy is a prop or a punchline.
import { ctx } from "../../core/ctx.js";
import { PR } from "../cityhall/protest.js";
import { WAS } from "../cityhall/wrongaddress.js";
import { AL } from "../life/alarm.js";

export const CONTEXTS = [
    // ── the street ──
    { id: "blowerPigeons", items: ["blower"], where: "street", near: "pigeons", do: "scatterPigeons",
        lines: ["*VRRRM* — every pigeon on the block takes off at once. They'll be back. They're ALWAYS back."] },
    { id: "foodPigeons", items: ["rugelach", "challah", "kugel"], where: "street", near: "pigeons", do: "feedPigeons", consume: true,
        lines: ["*crumbles the {item}* — forty pigeons arrive from NOWHERE. She is their queen now.", "*one crumb* …the pigeons have formed a LINE. An orderly line. In Brooklyn."] },
    { id: "blowerPile", items: ["blower"], where: "street", near: "leafPile", do: "kickPile",
        lines: ["*VRRRRM* — the neighbour's raked pile is now the WHOLE street's pile. Sorry, Mr. Feldman!"] },
    { id: "pinPile", items: ["rollingpin"], where: "street", near: "leafPile", do: "kickPile",
        lines: ["*rolls the leaf pile flat* …a leaf pancake. Nobody asked for a leaf pancake."] },
    { id: "blowerProtest", items: ["blower"], where: "street", near: "protest", do: "line",
        lines: ["*VRRRRM* — the protest's flyers go EVERYWHERE. Three people chase them. Nobody remembers what they were protesting."] },
    { id: "pillowAlarm", items: ["pillow"], where: "street", near: "carAlarm", do: "muffleAlarm",
        lines: ["*stuffs the pillow against the car's grille* …WEE-oo… *mmff* …blessed silence. The whole street applauds."] },
    { id: "seltzerBonfire", items: ["seltzer", "spray"], where: "street", near: "bonfire", when: "lagbaomer", do: "line",
        lines: ["*PSSSHT* at the bonfire — FORTY kids turn round. \"…did she just— she did. She put out the FIRE.\" (Nobody is talking to her for a week.)"] },
    { id: "panLatke", items: ["pan"], where: "street", near: "stall", when: "chanukah", do: "line",
        lines: ["*FLIP* — a latke, off the stall's griddle, a perfect double turn, back in the pan. The stall lady: \"…you're HIRED.\""] },
    { id: "broomPesach", items: ["broom"], where: "street", when: "pesachPrep", do: "line",
        lines: ["*sweeps the kerb for Pesach* — every Bubbe on the block nods. One brings her a second broom. \"For the CORNERS.\""] },
    { id: "chickenChani", items: ["chicken"], where: "street", near: "fayge", do: "line",
        lines: ["*SQUEAK* — Chani laughs so hard she falls over. \"AGAIN!\" (Fayge: \"…you're babysitting tonight. You did this.\")"] },
    { id: "challahFriday", items: ["challah"], where: "street", near: "fayge", when: "friday", do: "line", consume: true,
        lines: ["Fayge: \"A challah! For Shabbos! …you BOUGHT it? …it's good. It's a good one. Thank you, Lulu.\""] },
    { id: "sprayPigeons", items: ["spray"], where: "street", near: "pigeons", do: "scatterPigeons",
        lines: ["*psst psst* — the pigeons look personally offended. They leave. Slowly. Making a point."] },
    // ── inside (interior id) ──
    { id: "hatRack", items: ["hat"], where: "room:shul", do: "line", consume: true,
        lines: ["*hangs the black hat on the rack with the other hundred* …ten minutes later, three men leave with the wrong one. Nobody notices. Nobody EVER notices."] },
    { id: "trophyPhil", items: ["trophy"], where: "room:cityhall", do: "line", consume: true,
        lines: ["*presents the bowling trophy at the mic* — Pothole Phil, in tears: \"Finally. RECOGNITION.\" (The pothole vote is deferred again.)"] },
    { id: "pepperKiddush", items: ["pepper"], where: "room:shul", when: "shabbos", do: "spendPepper",
        lines: ["*a tiny psst into the cholent* — \"Who MADE this?! It's the best one YET!\" (She will take this secret to her grave.)"] },
    { id: "pepperFitting", items: ["pepper"], where: "room:clothesShop", do: "spendPepper",
        lines: ["*tries the pepper spray like a perfume* …AAACHOO! The shop lady: \"…we have TESTERS, sweetie.\""] },
    { id: "lampshadeShop", items: ["lampshade"], where: "room:clothesShop", do: "line",
        lines: ["*tries the lampshade on in the mirror* — the shop lady: \"…it's a STATEMENT. I'll give you that.\""] },
];

// ── who / what is near (her position → a target or null) ──
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || null;
const near = (p, x, z, r) => !!p && Math.hypot(p.x - x, p.z - z) < r;
export const PROBES = {
    pigeons: p => { const f = ctx.life && ctx.life.debug && ctx.life.debug.flock && ctx.life.debug.flock(""); return f && !f.away && near(p, f.x, f.z, 14) ? f : null; },
    leafPile: p => { const pl = ctx.life && ctx.life.debug && ctx.life.debug.pile && ctx.life.debug.pile(); return pl && near(p, pl.x, pl.z, 3.2) ? pl : null; },
    protest: p => { const W = PR.on || WAS.on; return W && near(p, W.x != null ? W.x : W.sp.x, W.z != null ? W.z : W.sp.z, 16) ? W : null; },
    carAlarm: p => (AL.list.length ? AL.list[0] : null),
    bonfire: p => { const it = ctx.seasons && ctx.seasons.debug && ctx.seasons.debug.items ? ctx.seasons.debug.items("bonfire").find(b => near(p, b.x, b.z, 6)) : null; return it || null; },
    stall: p => { const st = ctx.seasons && ctx.seasons.debug && ctx.seasons.debug.stands ? ctx.seasons.debug.stands().find(s => near(p, s.x, s.z, 4)) : null; return st || null; },
    fayge: p => { const f = ctx.family && ctx.family.fayge; return f && near(p, f.x, f.z, 3) ? f : null; },
};
export const WHEN = {
    lagbaomer: () => !!(ctx.seasons && ctx.seasons.is("lagBaomer")),
    chanukah: () => !!(ctx.seasons && ctx.seasons.is("chanukah")),
    pesachPrep: () => !!(ctx.seasons && (ctx.seasons.is("pesachPrep") || ctx.seasons.is("erevPesach"))),
    friday: () => !!(ctx.seasons && ctx.seasons.is("friday")),
    shabbos: () => !!(ctx.seasons && ctx.seasons.is("shabbos")),
};

/** The first row that fits the thing in hand here: { row, target } | null. where: "street" | "room:<id>". */
export function matchContext(itemId, where, force = null) {
    const p = herPos();
    for (const row of CONTEXTS) {
        if (!row.items.includes(itemId)) continue;
        if (row.where !== where) continue;
        if (force && force.context && force.context !== row.id) continue;
        if (row.when && !(force && force.when) && !(WHEN[row.when] && WHEN[row.when]())) continue;
        let target = true;
        if (row.near) { target = force && force.near ? force.near : (PROBES[row.near] ? PROBES[row.near](p) : null); if (!target) continue; }
        return { row, target };
    }
    return null;
}
