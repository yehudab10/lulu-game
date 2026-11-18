// features/memory — 👀 small recognitions. Other features ask
//   ctx.memory.recognize(who, info) → a line ("" when nobody remembers anything)
// right where they would have said their usual line, and use it instead.
// Every kind is rate-limited (once a run, and only some of the time) so it stays
// a surprise. Off in ?test unless memory is enabled, off in a 🎉 party.
//   "cop"           the pull-over: "Oh, it's YOU again." at 3+ arrests
//   "moishe"        Paint & Pray, info { color: the new colour's name } — remembers her colours
//   "hitch"         the hitchhiker, info { event: "pick" | "pass" | "drop" } — records it too
//   "avigailRoad"   Avigail's taunt from her coupe, about Lulu's notoriety
//   "avigailPorch"  one line at the porch door
import { M, CAP, dirty, personal as live, chance, pick, fill, notoriety, oncePerRun, logPush } from "./data.js";
import { aviNews } from "./texts.js";
import * as T from "./lines.js";

export const RC = { said: [] };
function out(who, line) {
    if (!line) return "";
    RC.said.push({ who, line });
    if (RC.said.length > 12) RC.said.shift();
    return line;
}

export function recognize(who, info = {}) {
    try {
        // the hitchhiker's history is kept even when nothing is said
        if (who === "hitch") return out(who, hitch(info.event));
        if (!live()) return "";
        if (who === "cop") return out(who, cop());
        if (who === "moishe") return out(who, moishe(info.color));
        if (who === "avigailRoad") return out(who, aviRoad());
        if (who === "avigailPorch") return out(who, aviPorch());
    } catch (e) { console.error("[memory] recognize", e); }
    return "";
}

function cop() {
    const n = notoriety();
    if (n.arrests < 3 || !chance(0.75) || !oncePerRun("cop")) return "";
    return fill(pick(T.COP_AGAIN), { n: n.arrests + 1 });
}

/** Paint & Pray: colours are remembered from streets:paint (rememberPaint). */
export function rememberPaint(e = {}) {
    const name = e.color && (e.color.name || e.color);
    if (!name || typeof name !== "string") return;
    const list = (M.log.paint || []).map(p => p.color);
    logPush("paint", { color: name });
    while ((M.log.paint || []).length > CAP.paints) M.log.paint.shift();
    return list;
}
function moishe(color) {
    const prev = (M.log.paint || []).map(p => p.color);
    if (!prev.length || !chance(0.7) || !oncePerRun("moishe")) return "";
    if (color && prev.includes(color)) return fill(pick(T.PAINT_AGAIN), { color });
    return fill(pick(T.PAINT_BACK), { color: color || "new", prev: prev[prev.length - 1] });
}

function hitch(event) {
    const H = M.hitch;
    let line = "";
    const may = () => live() && chance(0.75) && oncePerRun("hitch");
    if (event === "pick") {
        if (H.passes > 0 && may()) line = pick(T.HITCH.pickAfterPass);
        else if (H.picks > 0 && may()) line = fill(pick(T.HITCH.pickAgain), { n: H.picks + 1 });
        H.picks++;
    } else if (event === "pass") {
        if (H.passes > 0 && may()) line = fill(pick(T.HITCH.passAgain), { n: H.passes + 1 });
        else if (H.picks > 0 && may()) line = pick(T.HITCH.passAfterRide);
        H.passes++;
    } else if (event === "drop") {
        if (H.drops > 0 && may()) line = fill(pick(T.HITCH.dropAgain), { n: H.drops + 1 });
        H.drops++;
    } else return "";
    dirty();
    return line;
}

function aviRoad() {
    const n = notoriety();
    if (n.level < 1 || !chance(0.45) || !oncePerRun("aviRoad")) return "";
    return pick(T.AVI_ROAD);
}
function aviPorch() {
    const n = notoriety();
    if (n.level < 1 || !chance(0.6) || !oncePerRun("aviPorch")) return "";
    const news = aviNews(n);
    const key = news ? news.key : n.arrests ? "arrests" : n.maxStars >= 3 ? "stars" : n.escapes ? "escapes" : n.carjacks ? "carjacks" : n.er ? "er" : null;
    return key ? T.AVI_PORCH[key] : "";
}
