// features/cityhall/state.js — the save + the small shared bits every city hall module uses.
import { ctx, emit } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { ID } from "./data.js";

export { saveSoon };
/** 3D-only save (the classic 2D game never sees it). */
export const S = store(ID, { ticket: 411, pulls: 0, metMayor: {}, ribbons: 0, stats: {} });
if (!S.stats || typeof S.stats !== "object") S.stats = {};
if (!S.metMayor || typeof S.metMayor !== "object") S.metMayor = {};

/** Test knobs: { hour, closed (window index), mayorOut, noDing, ribbonNow }. */
export const force = {};
/** Run-level state shared between modules (the ribbon cutting that's on right now, if any). */
export const RUN = { ribbon: null };

export const inTown = () => !!(ctx.town && ctx.town.active);
export const townId = () => (inTown() && ctx.town.id) || "lakewood";
export const hour = () => (force.hour != null ? force.hour : new Date().getHours());
/** Which window says BACK IN 5 MINUTES right now (changes with the hour). */
export const closedWindow = () => {
    if (force.closed != null) return force.closed;
    const i = hour() % 3;
    // (an errand under way: Permits is never the closed one — Complaints takes its turn — so a form never waits an hour)
    return i === 0 && S.permits && S.permits.open && S.permits.open.length ? 2 : i;
};
/** Is the mayor in his office? Not while he's out cutting a ribbon, and not at lunch (12–13). */
export const mayorIn = () => !(force.mayorOut || RUN.ribbon || hour() === 12);
export function stat(id, n = 1) { S.stats[id] = (S.stats[id] || 0) + n; saveSoon(); emit("stat", { id, n }); }
