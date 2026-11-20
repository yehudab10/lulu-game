// features/realestate/court.js — ⚖️ FIGHTING THE ORDINANCE (stage 6; the owner: "if they come back they can fight it in
// court maybe and still lose possible or win something").
//
// Every home the government holds (`seized` — still the Council's) or let go (`lost` — back on the market while she was
// away) is a CASE on that town's Courtroom 2B docket (ci/courts' engine: `ctx.civic.courts.addCase`, data only), one
// hearing: the Council's lawyer, the judge, her defence (three silly choices) — then the verdict (`verdict()`):
//   • HELD: the SERVER rolls the appeal (homes.mjs CONFIG.appealWin): won → hers again; lost → back on the market +
//     COURT.heldLose of what she paid in (a "sympathy payment")
//   • LOST: the judge rolls COURT.lostWin: won → COURT.lostWinPay of what she paid in; lost → COURT.lostLosePay
// Never more than she paid in, once per house (the case is then closed for good), coins never below 0.
// Without the courts engine (or the hearing unreachable) the same verdict runs from her SEIZED sign: ✋ ⚖️ CONTEST IT.
import { ctx, on, emit } from "../../core/ctx.js";
import { wallet, saveSoon } from "../../core/save.js";
import { COURT, COURT_LINES as CL } from "./data.js";
import { registry, S } from "./registry.js";
import { appeal, SV } from "./server.js";
import { log } from "./deal.js";
import { say } from "../../core/dialog.js";

const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = n => Math.round(n).toLocaleString("en-US");
/** Everything she paid in for a home (the price, or the down payment + mortgage payments). */
function paidIn(id) { const h = S.owned[id], m = S.mortgage[id]; return Math.max(0, Math.round(m ? m.paidIn : (h && h.paid) || 0)); }
/** Homes with an open case: [{ id, h, kind: "held" | "lost" }] */
export function openCases(town = null) {
    return Object.entries(S.owned).filter(([, h]) => (h.seized || h.lost) && !h.ruled && (!town || h.town === town)).map(([id, h]) => ({ id, h, kind: h.lost ? "lost" : "held" }));
}

/** The verdict for home `id` → { won, coins, line } (it also does it: the house back / released, the coins). */
export async function verdict(id) {
    const h = S.owned[id];
    if (!h || h.ruled) return { won: false, coins: 0, line: CL.offline, none: true };
    const paid = paidIn(id);
    let won = false, coins = 0, line = "";
    if (h.seized && !h.lost) {
        const r = await appeal(id);
        if (!r.ok && r.why === "offline") return { won: false, coins: 0, line: CL.offline, offline: true };
        if (!r.ok && r.why === "appealed") { h.ruled = Date.now(); saveSoon(); return { won: false, coins: 0, line: CL.offline }; }
        won = !!(r.ok && r.won);
        if (won) { delete h.seized; delete h.lost; line = CL.won(h.address); }
        else { coins = Math.round(paid * COURT.heldLose); line = CL.lostHeld(h.address, fmt(coins)); }
    } else {
        won = Math.random() < COURT.lostWin;
        coins = Math.round(paid * (won ? COURT.lostWinPay : COURT.lostLosePay));
        line = won ? CL.wonLost(h.address, fmt(coins)) : CL.lostLost(h.address, fmt(coins));
    }
    coins = Math.min(coins, paid);
    if (won && !h.lost) {
        h.ruled = 0; h.reg = true;
        saveSoon();
        registry.changed({ id, why: "court" });
    } else {
        delete S.mortgage[id]; delete S.rent[id]; delete S.decor[id];
        const addr = h.address, town = h.town;
        registry.release(id, h.lost ? "court" : "courtLost");
        if (coins) wallet.add(coins);
        emit("realestate:owner", { id, from: "lulu", to: null, price: coins, why: "court", address: addr, town });
        S.ruled = S.ruled || {}; S.ruled[id] = Date.now();
    }
    log({ ev: "court", id, n: coins, won });
    emit("realestate:court", { id, won, coins });
    emit("stat", { id: won ? "reCourtWins" : "reCourtLosses", n: 1 });
    saveSoon();
    return { won, coins, line };
}

// ── the case on 2B's docket (ci/courts' engine), one per home ─────────────
const added = new Set();
function addCases() {
    const C = ctx.civic && ctx.civic.courts;
    if (!C || !C.addCase) return;
    for (const { id, h } of openCases()) {
        const cid = "ordinance:" + id;
        if (added.has(cid)) continue;
        added.add(cid);
        C.addCase({
            id: cid, town: h.town, oneADay: false, solo: true, priority: 10,
            title: `COUNCIL v. LULU — ${String(h.address).toUpperCase()}`,
            label: `⚖️ Fight the Ordinance (${h.address})`,
            docket: () => `📋 NOW: The Town Council v. Lulu — the Abandoned Kugel Ordinance (${h.address})`,
            available: () => !!(S.owned[id] && (S.owned[id].seized || S.owned[id].lost) && !S.owned[id].ruled),
            cast: { council: Object.assign({ seat: "respCounsel", model: "npcMan", colors: { Top: "#37474F", Bottom: "#263238" } }, CL.counsel) },
            acts: {
                verdict: async (H, api) => {
                    const v = await verdict(id);
                    H.verdict = v;
                    await say("THE JUDGE", v.line, { emoji: "👨‍⚖️", color: "#7E57C2" });
                },
            },
            hearings: [{
                title: "the Abandoned Kugel Ordinance",
                steps: [
                    ["bailiff", CL.open(h.address)],
                    ["council", pick(CL.council)],
                    { do: "gavel" },
                    ["judge", CL.judgeAsk],
                    { do: "luluToStand" },
                    { choose: { who: "lulu", text: "Your defence:", options: CL.defence.map(d => ({ label: d.label, then: [["judge", d.judge]] })) } },
                    { do: "verdict" },
                    { do: "gavel" },
                    ["bailiff", CL.fine],
                    { do: "luluToGallery" },
                ],
            }],
        });
    }
}
on("boot", () => setTimeout(addCases, 0));
on("realestate:seized", () => addCases());
on("town:enter", () => addCases());
export { addCases };
void SV;
