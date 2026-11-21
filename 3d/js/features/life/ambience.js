// features/life — 🏘️ THE NEIGHBOURHOOD you hear: every several seconds something happens somewhere AROUND her
// (positional, 12–40 m off, never on top of her) — a songbird in a street tree, a dog in a back yard (and the
// one next door answering), a screen door slapping shut, a kid dribbling a basketball in a driveway, somebody
// hammering (a sukkah before Sukkos — a LOT of hammering then; never on Shabbos / Yom Tov), wind chimes on a porch when it's gusty. At night
// in the warm months the crickets come out; on a winter night an owl. On the highway (on foot) it's birds in the
// fields and a far farm dog. Rain hushes the birds. All of it rides ⚙️ 🐦 Street sounds (+ the game's Sound).
import { ctx } from "../../core/ctx.js";
import { L, rand, stats, countSound, soundsOn } from "./common.js";
import { play, loop } from "./sounds.js";
import { gustNow } from "./wind.js";

export const AMB = { t: 4, next: "", last: "", crick: null, crickPt: { x: 0, y: 0.1, z: 0 }, crick2: null, crickPt2: { x: 0, y: 0.1, z: 0 }, answerT: -1, answerAt: { x: 0, y: 0, z: 0 } };
const PTS = Array.from({ length: 6 }, () => ({ x: 0, y: 0, z: 0 }));
let pi = 0;
/** A point `r` m from her in a random direction (in town: preferably off the street — a yard). */
function around(rMin, rMax, yard = false) {
    const p = PTS[pi++ % PTS.length];
    for (let k = 0; k < (yard && L.town ? 5 : 1); k++) {
        const a = Math.random() * Math.PI * 2, r = rand(rMin, rMax);
        p.x = L.x + Math.cos(a) * r; p.z = L.z + Math.sin(a) * r; p.y = 0;
        if (!yard || !L.town || !ctx.town.hideSpot) break;
        let sp = null;
        try { sp = ctx.town.hideSpot(p.x, p.z); } catch (e) { sp = null; }
        if (sp && sp.spot === "yard") break;
    }
    return p;
}
/** What could happen right now, weighted. */
function weights() {
    const night = L.night > 0.55, rain = L.rain > 0.3, autumn = L.season === "autumn";
    const S = ctx.seasons, day = S && S.day ? S.day() : null;
    const sukkos = !!(S && S.is && S.is("sukkosPrep"));
    const rest = !!(S && S.is && S.is("shabbos")) || !!(day && day.yomtov);     // Shabbos / Yom Tov: nobody's hammering

    if (!L.town) {     // the highway, on foot: fields and farms
        if (night) return [["lifeOwl", L.season === "winter" || autumn ? 2 : 0.5], ["lifeBark", 1]];
        return rain ? [["lifeBark", 1]] : [["lifeChirp", 5], ["lifeChirp2", 4], ["lifeBark", 1]];
    }
    if (night) return [["lifeBark", 3], ["lifeBarkSmall", 2], ["lifeDoor", 2], ["lifeOwl", L.season === "winter" || autumn ? 2 : 0.6], ["lifeChimes", gustNow() > 2 ? 4 : 0]];
    if (rain) return [["lifeBark", 2], ["lifeDoor", 3], ["lifeChimes", gustNow() > 2 ? 3 : 0.5]];
    return [["lifeChirp", 6], ["lifeChirp2", 5], ["lifeBark", 3], ["lifeBarkSmall", 2], ["lifeDoor", 2.5], ["lifeBall", L.season === "winter" ? 0.8 : 2.5],
        ["lifeHammer", rest ? 0 : sukkos ? 9 : 1.5], ["lifeChimes", gustNow() > 2 ? 6 : 0.8]];
}
function choose(list) {
    let sum = 0;
    for (const [, w] of list) sum += w;
    let r = Math.random() * sum;
    for (const [k, w] of list) { r -= w; if (r <= 0) return k; }
    return list[list.length - 1][0];
}
const DIST = { lifeChirp: [10, 26], lifeChirp2: [10, 26], lifeBark: [16, 40], lifeBarkSmall: [14, 34], lifeDoor: [14, 32], lifeBall: [14, 30], lifeHammer: [22, 45], lifeChimes: [10, 24], lifeOwl: [18, 40] };
/** Play one neighbourhood sound now (`kind` or a weighted pick for the moment). */
export function happen(kind = "") {
    const k = kind || choose(weights());
    const [a, b] = DIST[k] || [14, 34];
    const p = around(a, b, /Bark|Door|Ball|Hammer|Chimes/.test(k));
    const h = play(k, p, { gain: rand(0.75, 1.05), rate: rand(0.92, 1.08) });
    AMB.last = k;
    countSound(k);
    // the dog next door answers
    if ((k === "lifeBark" || k === "lifeBarkSmall") && Math.random() < 0.45) { AMB.answerT = L.time + rand(0.9, 1.8); AMB.answerAt.x = p.x + rand(-25, 25); AMB.answerAt.z = p.z + rand(-25, 25); }
    return h ? k : "";
}
function crickets(on) {
    if (on) {
        AMB.crickPt.x = L.x + 13; AMB.crickPt.z = L.z - 6;          // (a bed around her: follows her at a fixed offset)
        AMB.crickPt2.x = L.x - 11; AMB.crickPt2.z = L.z + 9;
        if (!AMB.crick || !AMB.crick.alive) AMB.crick = loop("lifeCrickets", AMB.crickPt, { gain: 1 });
        if (!AMB.crick2 || !AMB.crick2.alive) AMB.crick2 = loop("lifeCrickets", AMB.crickPt2, { gain: 0.8, rate: 1.07 });
    } else {
        if (AMB.crick) AMB.crick = AMB.crick.stop(0.6) || null;
        if (AMB.crick2) AMB.crick2 = AMB.crick2.stop(0.6) || null;
    }
}
export function tickAmbience(dt) {
    const want = L.on && soundsOn() && !L.quiet && (L.town || L.foot);
    const warm = L.season === "summer" || L.season === "spring" || (L.season === "autumn" && new Date().getMonth() < 9);
    crickets(want && L.night > 0.6 && warm && L.rain < 0.2 && !L.snow);
    if (!want) return;
    // driving through town: the car drowns most of it out (and it'd whizz by) — fewer, closer
    const busy = !L.foot && L.speed > 8;
    AMB.t -= dt;
    if (AMB.t <= 0) {
        AMB.t = busy ? rand(9, 16) : rand(4.5, 10);
        happen();
    }
    if (AMB.answerT > 0 && L.time >= AMB.answerT) {
        AMB.answerT = -1;
        const p = PTS[pi++ % PTS.length];
        p.x = AMB.answerAt.x; p.z = AMB.answerAt.z; p.y = 0;
        if (play(Math.random() < 0.5 ? "lifeBarkSmall" : "lifeBark", p, { gain: 0.8, rate: rand(0.9, 1.15) })) countSound("answer");
    }
}
export function ambienceStop() { crickets(false); AMB.answerT = -1; }
export function ambienceInfo() { return { next: +AMB.t.toFixed(1), last: AMB.last, crickets: !!(AMB.crick && AMB.crick.alive), sounds: stats.sounds, kinds: Object.assign({}, stats.soundKinds) }; }
