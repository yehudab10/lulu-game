// features/playershops/hearing.js — ⚖️ STAGE 4: MIDWOOD'S HEARING. Midwood allows ONE shop per player (Mayor Marxdani's
// People's Retail Fairness Edict, cityhall/data.js › EDICTS id "shops"). When the landlord turns her away for a second,
// she can FILE an appeal; it's on Courtroom 2B's docket in the Midwood courthouse (ctx.civic.courts — a case is data):
// the People's lawyer, her argument, the judge's ruling — the court's odds (HEARING.win). Win → the edict is struck
// (ctx.cityhall.mayor31.strike) and Midwood allows two (index.js › capOf). Lose → she may try again after a week.
// Nothing pays; nothing is taken.
import { ctx, on, emit } from "../../core/ctx.js";
import { saveSoon } from "../../core/save.js";
import { say } from "../../core/dialog.js";
import { HEARING } from "./data.js";

let API = null;          // index.js: { S, today, log }
export function bindHearing(api) { API = api; }
const CID = "playershops:edict";
const M = () => (ctx.cityhall && ctx.cityhall.mayor31) || null;
export const struck = () => { try { return !!(M() && M().struck && M().struck(HEARING.edict)); } catch (e) { return false; } };
const H = () => (API.S.met.hearing = API.S.met.hearing || {});
/** Can she file now? → "" | why not */
export function fileBlock() {
    if (struck()) return "struck";
    const h = H();
    if (h.lost != null && API.today() - h.lost < HEARING.retryDays) return HEARING.wait(HEARING.retryDays - (API.today() - h.lost));
    return "";
}
/** She files the appeal (the landlord's offer). → bool */
export function file() {
    if (fileBlock()) return false;
    H().filed = Date.now(); delete H().lost;
    saveSoon();
    API.log("file", {});
    emit("playershops:hearing", { phase: "filed" });
    addCase();
    return true;
}
export const filed = () => !!H().filed && !struck();
let added = false;
function addCase() {
    const C = ctx.civic && ctx.civic.courts;
    if (!C || !C.addCase || added) return false;
    added = true;
    C.addCase({
        id: CID, town: "midwood", oneADay: true, solo: true, priority: 6,
        title: HEARING.title, label: HEARING.label, docket: () => HEARING.docket,
        available: () => !!(API && H().filed) && !struck() && !fileBlock(),
        cast: { people: Object.assign({ seat: "respCounsel", model: "npcMan", colors: { Top: "#8E2B2B", Bottom: "#263238" } }, HEARING.counsel) },
        acts: {
            ruling: async R => {
                const win = Math.random() < (ROLL.force != null ? ROLL.force : HEARING.win);
                const h = H();
                delete h.filed;
                if (win) { if (M() && M().strike) M().strike(HEARING.edict); h.won = Date.now(); }
                else h.lost = API.today();
                saveSoon();
                API.log("ruling", { win });
                emit("playershops:hearing", { phase: "ruling", win });
                emit("stat", { id: win ? "shopHearingWon" : "shopHearingLost", n: 1 });
                if (R) R.struck = win;
                await say("THE JUDGE", win ? HEARING.win_ : HEARING.lose, { emoji: "👨‍⚖️", color: "#7E57C2" });
            },
        },
        hearings: [{
            title: HEARING.title,
            steps: [
                ["bailiff", HEARING.open],
                ["people", HEARING.people[Math.floor(Math.random() * HEARING.people.length)]],
                { do: "gavel" },
                ["judge", HEARING.ask],
                { do: "luluToStand" },
                { choose: { who: "lulu", text: "Your argument:", options: HEARING.args.map(a => ({ label: a.label, then: [["judge", a.judge]] })) } },
                { do: "ruling" },
                { do: "gavel" },
                { do: "luluToGallery" },
            ],
        }],
    });
    return true;
}
/** Tests: force the court's roll (0 = lose, 1 = win; null = the odds). */
export const ROLL = { force: null };
on("boot", () => setTimeout(addCase, 0));
on("town:enter", () => addCase());
export { CID };
