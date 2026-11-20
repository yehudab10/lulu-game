// features/places — ⚖️ the courthouse LOBBY (walking in freely, when she's not in trouble): the interiors engine on
// the places_courtlobby set — the metal detector + the bailiff, the clerk's window, the docket board, a bench of
// nervous defendants, the locked doors of Courtroom 2B, a water fountain and a portrait. Lines only: nothing pays.
// (The courtroom itself — law/court.js — is what's behind 2B when she's brought here from a cell.)
import { ctx, emit } from "../../core/ctx.js";
import { registerModels } from "../../models.js";
import { defineInterior, pool, pick } from "../interiors/engine.js";
import { CLERK, BAILIFF, DOCKET, BENCH, DOORS, FOUNTAIN, DETECTOR, PORTRAIT } from "./data.js";

registerModels({ placesCourtLobby: "places_courtlobby" });

const clerkLine = pool(CLERK), bailiffLine = pool(BAILIFF), docketLine = pool(DOCKET), benchLine = pool(BENCH),
    doorsLine = pool(DOORS), fountainLine = pool(FOUNTAIN), detectorLine = pool(DETECTOR), portraitLine = pool(PORTRAIT);
const CLERK_S = { emoji: "🗂️", color: "#6D4C41" }, BAILIFF_S = { emoji: "👮", color: "#1F3A5F" }, BENCH_S = { emoji: "😬", color: "#5D4037" };

export const lobbyDef = defineInterior({
    id: "courthouse", name: "the courthouse", short: "the courthouse", emoji: "⚖️",
    title: "⚖️ THE COURTHOUSE — LOBBY", tagline: "",
    model: "placesCourtLobby", models: ["copPerson", "npcWoman", "npcMan"],
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
        rt.person("bench0", "npcMan", "bench0", { name: "A nervous man", pose: { sit: true }, colors: { Top: "#5C6BC0" }, faceLulu: false, collide: false });
        rt.person("bench1", "npcWoman", "bench1", { name: "A lady with a folder", pose: { sit: true }, colors: { Top: "#EF9A9A" }, faceLulu: false, collide: false });
        // ── hotspots ──
        rt.hot({ id: "clerk", spot: "clerkTalk", who: "clerk", r: 1.5, label: "🗂️ Talk to the clerk",
            action: rt => rt.say("The Clerk", clerkLine(), Object.assign({ person: rt.byId.clerk }, CLERK_S)) });
        rt.hot({ id: "bailiff", spot: "bailiffTalk", who: "bailiff", r: 1.4, label: "👮 Talk to the bailiff",
            action: rt => rt.say("The Bailiff", bailiffLine(), Object.assign({ person: rt.byId.bailiff }, BAILIFF_S)) });
        rt.hot({ id: "bench", spot: "bench", who: "bench0", r: 1.6, label: "😬 Chat with the bench",
            action: rt => { const w = pick(["bench0", "bench1"]); return rt.say(rt.byId[w].name, benchLine(), Object.assign({ person: rt.byId[w] }, BENCH_S)); } });
        rt.hot({ id: "docket", spot: "docket", r: 1.4, label: "📋 Read today's docket", action: rt => rt.say("Today's docket", docketLine(), { emoji: "📋", color: "#6D4C41" }) });
        rt.hot({ id: "doors2b", spot: "doors2b", r: 1.4, label: "🚪 Courtroom 2B", action: rt => rt.say("Courtroom 2B", doorsLine(), { emoji: "⚖️", color: "#4E342E" }) });
        rt.hot({ id: "fountain", spot: "fountain", r: 1.2, label: "💧 The water fountain", action: rt => rt.say("Lulu", fountainLine(), { emoji: "💧", color: "#0277BD" }) });
        rt.hot({ id: "detector", spot: "detector", r: 1.0, label: "🚨 Walk through the metal detector", action: async rt => {
            d.beepT = 1.2;
            emit("stat", { id: "placesBeeps", n: 1 });
            await rt.say("Lulu", detectorLine(), { emoji: "🚨", color: "#C62828" });
        } });
        rt.hot({ id: "portrait", spot: "portrait", r: 1.3, label: "🖼️ The portrait", action: rt => rt.say("Lulu", portraitLine(), { emoji: "🖼️" }) });
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
