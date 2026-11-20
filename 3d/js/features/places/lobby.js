// features/places — ⚖️ the courthouse LOBBY (walking in freely, when she's not in trouble): the interiors engine on
// the places_courtlobby set — the metal detector + the bailiff, the clerk's window, the docket board, a bench of
// nervous defendants, the locked doors of Courtroom 2B, a water fountain and a portrait. Lines only: nothing pays.
// (The courtroom itself — law/court.js — is what's behind 2B when she's brought here from a cell.)
import { ctx, emit } from "../../core/ctx.js";
import { registerModels } from "../../models.js";
import { defineInterior, pool, pick } from "../interiors/engine.js";
import { CLERK, BAILIFF, DOCKET, BENCH, DOORS, FOUNTAIN, DETECTOR, PORTRAIT } from "./data.js";
import { BENCH_SHLOIME, BENCH_DONE_TODAY, BABY, MW_DOORS, MW_ABBA } from "./shloime.js";
import { CS, caseDone, hearingToday, sitIn, warmCourt, caseIn, caseById, docketText } from "./courts.js";

registerModels({ placesCourtLobby: "places_courtlobby" });

const clerkLine = pool(CLERK), bailiffLine = pool(BAILIFF), docketLine = pool(DOCKET), benchLine = pool(BENCH),
    doorsLine = pool(DOORS), fountainLine = pool(FOUNTAIN), detectorLine = pool(DETECTOR), portraitLine = pool(PORTRAIT);
const party = () => !!(ctx.party && ctx.party.active);
const CLERK_S = { emoji: "🗂️", color: "#6D4C41" }, BAILIFF_S = { emoji: "👮", color: "#1F3A5F" }, BENCH_S = { emoji: "😬", color: "#5D4037" };

export const lobbyDef = defineInterior({
    id: "courthouse", name: "the courthouse", short: "the courthouse", emoji: "⚖️",
    title: "⚖️ THE COURTHOUSE — LOBBY", tagline: "",
    model: "placesCourtLobby", models: ["copPerson", "npcWoman", "npcMan", "homesDad", "homesBaby", "lawAbba"],
    music: "../story-relax.mp3",
    light: "indoor", sky: "#d9cbb0",
    bounds: { x0: -6.6, x1: 6.6, z0: -4.0, z1: 4.0 },
    cam: { dist: 7.0, height: 4.7 },

    build(rt) {
        const set = rt.set, d = rt.data;
        set.hemi.color.set("#fff4e0"); set.hemi.intensity = 1.3;
        set.sun.color.set("#fff1d6"); set.sun.intensity = 1.05;
        rt.pointLight("tube0", "#fff3dd", 6, 11);
        rt.pointLight("tube1", "#fff3dd", 6, 11, 1.6, true);
        d.beepT = 0;
        // ── people ──
        rt.person("clerk", "npcWoman", "clerk", { name: "The Clerk", colors: { Top: "#B0BEC5", Hair: "#424242" }, faceLulu: false, collide: false });
        rt.person("bailiff", "copPerson", "bailiff", { name: "The Bailiff", collide: false });
        const town = (ctx.town && ctx.town.active && ctx.town.id) || "lakewood";
        // (Lakewood, while his case is on: Shloime on the bench with the baby, rehearsing — features/places courts.js)
        d.shloime = town === "lakewood" && !caseDone();
        if (d.shloime) {
            rt.person("bench0", "homesDad", "bench0", { name: "Shloime", pose: { sit: true }, colors: { Top: "#FFFFFF", Bottom: "#212121", Hair: "#3E2723" }, faceLulu: false, collide: false });
            rt.person("bench1", "homesBaby", "bench1", { name: "Baby Gitty", pose: { sit: true }, y: 0.32, faceLulu: false, collide: false });
            warmCourt();
        } else {
            rt.person("bench0", "npcMan", "bench0", { name: "A nervous man", pose: { sit: true }, colors: { Top: "#5C6BC0" }, faceLulu: false, collide: false });
            rt.person("bench1", "npcWoman", "bench1", { name: "A lady with a folder", pose: { sit: true }, colors: { Top: "#EF9A9A" }, faceLulu: false, collide: false });
        }
        // (Midwood: Abba is here, on the bench. He's always here.)
        if (town === "midwood") rt.person("abba", "lawAbba", "bench2", { name: "Abba", pose: { sit: true }, faceLulu: false, collide: false });
        // ── hotspots ──
        rt.hot({ id: "clerk", spot: "clerkTalk", who: "clerk", r: 1.5, label: "🗂️ Talk to the clerk",
            action: rt => rt.say("The Clerk", clerkLine(), Object.assign({ person: rt.byId.clerk }, CLERK_S)) });
        rt.hot({ id: "bailiff", spot: "bailiffTalk", who: "bailiff", r: 1.4, label: "👮 Talk to the bailiff",
            action: rt => rt.say("The Bailiff", bailiffLine(), Object.assign({ person: rt.byId.bailiff }, BAILIFF_S)) });
        if (d.shloime) rt.hot({ id: "bench", spot: "bench", who: "bench0", r: 1.6, label: "🍼 Shloime (and the baby)", action: async rt => {
            await rt.say("Shloime", hearingToday() ? pick(BENCH_SHLOIME) : pick(BENCH_DONE_TODAY), { person: rt.byId.bench0, emoji: "🧔", color: "#1565C0" });
            if (!rt.disposed) await rt.say("Baby Gitty", pick(BABY), { person: rt.byId.bench1, emoji: "👶", color: "#F06292" });
        } });
        else rt.hot({ id: "bench", spot: "bench", who: "bench0", r: 1.6, label: "😬 Chat with the bench",
            action: rt => { const w = pick(["bench0", "bench1"]); return rt.say(rt.byId[w].name, benchLine(), Object.assign({ person: rt.byId[w] }, BENCH_S)); } });
        if (town === "midwood") {
            // (in front of his bench — the other bench's talk spot, mirrored)
            const b2 = rt.spots.bench2 || { x: 3.4, z: 1.95 }, bh = rt.spots.bench || { z: 3.0 };
            rt.hot({ id: "abba", x: b2.x, z: bh.z, who: "abba", r: 1.6, label: "👨 Abba?!",
                action: rt => rt.say("Abba", MW_ABBA[(CS.abbaL++) % MW_ABBA.length], { person: rt.byId.abba, emoji: "👨", color: "#EF6C00" }) });
        }
        rt.hot({ id: "portrait", spot: "portrait", r: 1.3, label: "🖼️ The portrait", action: rt => rt.say("Lulu", portraitLine(), { emoji: "🖼️" }) });
        // Courtroom 2B's docket (features/places courts.js — cases are data: Shloime's in Lakewood, others can be added)
        const onDocket = () => caseIn(town) || (town === "lakewood" ? caseById("shloime") : null);
        rt.hot({ id: "docket", spot: "docket", r: 1.4, label: "📋 Read today's docket", action: rt => {
            const c = onDocket();
            return rt.say("Today's docket", (c ? docketText(c) + "\n" : "") + docketLine(), { emoji: "📋", color: "#6D4C41" });
        } });
        rt.hot({ id: "doors2b", spot: "doors2b", r: 1.4,
            label: () => { const c = caseIn(town); return c && hearingToday(c) ? (c.label || `⚖️ Sit in on the hearing (${c.title})`) : "🚪 Courtroom 2B"; },
            action: async rt => {
                const c = caseIn(town);
                // into 2B: today's hearing (a scene on the courtroom set) — then back out here
                if (c && hearingToday(c) && await sitIn(c, () => !!(ctx.civic && ctx.civic.enter && ctx.civic.enter("court")))) return;
                const lines = c && !party() ? [`🔒 Locked for today. A note: '${c.title} — continued until TOMORROW.'${c.id === "shloime" ? " (Someone drew a bottle.)" : ""}`]
                    : town === "midwood" ? MW_DOORS
                    : town === "lakewood" && caseDone() ? ["🔒 Locked. A crayon drawing is taped to the door: a baby, a man, a lady, and a VERY large bailiff. ❤️"] : null;
                return rt.say("Courtroom 2B", lines ? pick(lines) : doorsLine(), { emoji: "⚖️", color: "#4E342E" });
            } });
        rt.hot({ id: "fountain", spot: "fountain", r: 1.2, label: "💧 The water fountain", action: rt => rt.say("Lulu", fountainLine(), { emoji: "💧", color: "#0277BD" }) });
        rt.hot({ id: "detector", spot: "detector", r: 1.0, label: "🚨 Walk through the metal detector", action: async rt => {
            d.beepT = 1.2;
            emit("stat", { id: "placesBeeps", n: 1 });
            await rt.say("Lulu", detectorLine(), { emoji: "🚨", color: "#C62828" });
        } });
    },

    tick(rt, dt) {
        const d = rt.data;
        if (d.beepT > 0) {
            d.beepT -= dt;
            if (Math.floor(d.beepT * 6) !== Math.floor((d.beepT + dt) * 6) && rt.byId.bailiff) rt.bubble("BEEP!", rt.byId.bailiff.p.obj, 0.5, { color: "#C62828" });
        }
    },
});

/** The lobby's title follows the town she's in. */
export function nameLobby(n) {
    lobbyDef.name = n.name; lobbyDef.title = n.title; lobbyDef.tagline = n.tagline;
    if (ctx.interiors.courthouse) ctx.interiors.courthouse.name = n.name;
}
