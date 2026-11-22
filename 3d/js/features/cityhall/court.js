// features/cityhall/court.js — ⚖️ FIGHTING THE LIEN (stage 2): while a lien stands (tax.js), the town that filed it has a
// case on its Courtroom 2B docket (ci/courts' engine, `ctx.civic.courts.addCase` — data only): the Town Attorney, the
// judge, her defence (three silly choices), then the ruling — LIEN_COURT.win: won = the lien fee waived + the lien
// lifted; lost = she pays her bills now (only as much as she has; never below 0). One hearing per lien.
import { ctx, on } from "../../core/ctx.js";
import { say } from "../../core/dialog.js";
import { LIEN_COURT as LC } from "./data.js";
import { S } from "./state.js";
import { lienOn, ruleLien, ledger } from "./tax.js";

export const CT = { force: {}, added: new Set() };
const pick = a => a[Math.floor(Math.random() * a.length)];
/** The lien's town: the town of the home with the oldest unpaid tax bill (else Lakewood). */
function lienTown() {
    const b = ledger.bills.find(x => !x.paid && x.kind === "tax" && x.home);
    const t = b && String(b.home).split(":")[0];
    return t === "midwood" || t === "lakewood" ? t : "lakewood";
}
export function addLienCase() {
    const C = ctx.civic && ctx.civic.courts;
    if (!C || !C.addCase || !lienOn()) return false;
    const n = ledger.lien.n || 1, cid = "cityhall:lien:" + n;
    if (CT.added.has(cid)) return true;
    CT.added.add(cid);
    C.addCase({
        id: cid, town: lienTown(), oneADay: false, solo: true, priority: 8,
        title: "THE TOWN v. LULU — THE MAILBOX-FLAG LIEN",
        label: LC.label, docket: () => LC.docket,
        available: () => lienOn() && (ledger.lien.n || 1) === n && !ledger.lien.ruled,
        cast: { town: Object.assign({ seat: "respCounsel", model: "npcMan", colors: { Top: "#455A64", Bottom: "#263238" } }, LC.counsel) },
        acts: {
            ruling: async H => {
                const won = CT.force.won != null ? !!CT.force.won : Math.random() < LC.win;
                const r = ruleLien(won);
                H.ruling = r;
                await say("THE JUDGE", r.none ? LC.nothing : r.won ? LC.won : LC.lost(r.n || 0, !!r.all), { emoji: "👨‍⚖️", color: "#7E57C2" });
            },
        },
        hearings: [{
            title: "the mailbox-flag lien",
            steps: [
                ["bailiff", LC.open],
                ["town", pick(LC.town)],
                { do: "gavel" },
                ["judge", LC.judgeAsk],
                { do: "luluToStand" },
                { choose: { who: "lulu", text: "Your defence:", options: LC.defence.map(d => ({ label: d.label, then: [["judge", d.judge]] })) } },
                { do: "ruling" },
                { do: "gavel" },
                { do: "luluToGallery" },
            ],
        }],
    });
    return true;
}
on("boot", () => setTimeout(addLienCase, 0));
on("cityhall:lien", e => { if (e && e.phase === "filed") addLienCase(); });
on("town:enter", () => addLienCase());
void S;
