// features/homes — 🙋 REASONS TO KNOCK (not only to sneak): invitations, deliveries, small jobs, favours remembered.
//
//   wave-ins     a family on its porch waves her in as she walks past ("Lulu! Come in, there's cake!") — the door's
//                ✋ then says so, and the door menu's first choice walks her straight in as a guest
//   offers       about one lived door in six has something today (seeded by the door + the real day, the same all
//                day): the door menu's line hints at it ("Someone's struggling with grocery bags…") and offers 🤝
//   deliveries   📬 misdelivered mail / 🥘 a kugel dish to return: carry it to another family down the street (a
//                soft beacon over their door; their ✋ menu takes it); both families remember the favour
//   inside jobs  🛍️ carry the groceries in (three bags, door → counter) · 👓 find Bubbe's / Zeidy's glasses (look
//                in a few places; funny finds) · 🍼 babysit for sixty seconds of chaos (the parents step out, the kids
//                start mischief; settle them down — a calm house pays in full)
//   favours      rec.favours++ on both ends → they greet her BY NAME (life.js byName) at the door and from the porch
//
// PAY (golden rule 5 — no repeatable free coins): JOBS[type].pay, at most JOBS[type].cap of each a REAL day and
// DAY_CAP coins a real day for all of them together; past a cap a job still earns the thank-you, never coins. Nothing on
// Shabbos / Yom Tov (no errands, no money). Jobs are personal (each screen its own) — a friend in the same house just
// sees the household.
import { ctx, emit, on } from "../../core/ctx.js";
import { saveSoon } from "../../core/save.js";
import { addCoins } from "../../core/driving.js";
import * as H from "../../hud.js";
import { beacon, hideBeacon } from "../openworld/marks.js";
import { hash, rngOf, when, opinion, byName, has } from "./life.js";

export const JOBS = {
    mail: { emoji: "📬", name: "misdelivered mail", pay: 5, cap: 3, deliver: true },
    dish: { emoji: "🥘", name: "a kugel dish to return", pay: 6, cap: 2, deliver: true },
    groceries: { emoji: "🛍️", name: "carry the groceries in", pay: 8, cap: 2 },
    glasses: { emoji: "👓", name: "find the glasses", pay: 5, cap: 2 },
    babysit: { emoji: "🍼", name: "babysit for sixty seconds", pay: 15, cap: 1 },
    manos: { emoji: "🎁", name: "deliver mishloach manos", pay: 5, cap: 3, deliver: true },
    chametz: { emoji: "🪥", name: "scrub a corner for Pesach", pay: 5, cap: 1 },
};
/** All homes jobs together pay at most this many coins a real day. */
export const DAY_CAP = 40;
/** About this share of lived doors have a job offer on a given day. */
export const OFFER_RATE = 0.17;

const V = { S: null, cur: null, invites: new Map(), lived: () => true, homes: () => [], byId: () => null, rec: null, porchSaid: new Map() };
/** index.js hands over its save + door helpers (no circular imports). */
export function initVisits(o) { Object.assign(V, o); }
const pick = a => a[Math.floor(Math.random() * a.length)];
const plural = n => /(s|z|x|sh|ch)$/i.test(n) ? n + "es" : n + "s";

// ── the real day's ledger ────────────────────────────────────────────────
function dayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
export function ledger() {
    const S = V.S;
    if (!S.jobs || S.jobs.d !== dayKey()) S.jobs = { d: dayKey(), n: {}, coins: 0, done: {} };
    return S.jobs;
}
/** Pay for a finished job, inside both caps → the coins actually paid (0 = a thank-you only). */
export function payJob(type, factor = 1) {
    const J = JOBS[type], L = ledger();
    const n = L.n[type] | 0;
    L.n[type] = n + 1;
    const pay = n < J.cap ? Math.min(Math.round(J.pay * factor), Math.max(0, DAY_CAP - L.coins)) : 0;
    if (pay > 0) { L.coins += pay; addCoins(pay, "homes:" + type); }
    saveSoon();
    emit("homes:job", { type, paid: pay, capped: pay === 0 });
    emit("stat", { id: "homesFavours", n: 1 });
    if (pay) emit("stat", { id: "homesJobCoins", n: pay });
    return pay;
}

// ── who has something today ──────────────────────────────────────────────
const noErrands = w => w.shabbos || w.yomtov;
/** The job behind a door today (pure: door + the real day), or null. */
export function offerFor(home, w = when(), sc = null) {
    if (noErrands(w) || !V.lived(home)) return null;
    const L = ledger();
    if (L.done[home.key]) return null;
    const R = rngOf(hash(home.key + "|job|" + L.d));
    const purim = has(w, "purim");
    if (R() > (purim ? OFFER_RATE * 2.2 : OFFER_RATE)) return null;
    const sid = sc && sc.def && sc.def.id;
    if (sid === "cereal" || sid === "shabbosNap" || sid === "bedtime") return null;
    const cast = home.cast;
    const types = ["mail", "dish", "groceries"];
    if (cast.includes("bubbe") || cast.includes("zeidy")) types.push("glasses", "glasses");
    if ((cast.includes("boy") || cast.includes("girl")) && (cast.includes("mom") || cast.includes("dad")) && w.hour >= 8 && w.hour < 21) types.push("babysit", "babysit");
    const type = purim ? "manos" : types[Math.floor(R() * types.length)];
    if (JOBS[type].deliver) {
        // a family down the street (25–110 m away), the same one all day
        const others = V.homes().filter(h => h !== home && V.lived(h) && h.name !== home.name).map(h => [h, Math.hypot(h.ap.x - home.ap.x, h.ap.z - home.ap.z)]).filter(([, d]) => d > 25 && d < 110);
        if (!others.length) return null;
        const to = others[Math.floor(R() * others.length)][0];
        return { type, from: home.key, to: to.key, toName: to.name };
    }
    return { type, from: home.key };
}
/** The door menu's hint for an offer. */
export function offerHint(home, job) {
    const t = job.type;
    if (t === "mail") return `📬 There's a letter for the ${plural(job.toName)} stuck in their mailbox.`;
    if (t === "manos") return `🎁 A pile of mishloach manos by the door — one has a tag: "THE ${plural(job.toName).toUpperCase()}".`;
    if (t === "dish") return `🥘 A kugel dish on the porch with a note: "RETURN TO ${plural(job.toName).toUpperCase()}!!"`;
    if (t === "groceries") return "🛍️ A minivan's open in the driveway — about forty grocery bags.";
    if (t === "glasses") return "👓 Someone inside: \"Has anybody seen my GLASSES?!\"";
    return "🍼 Kids screaming happily. A parent screaming less happily.";
}
export function offerLabel(job) { const J = JOBS[job.type]; return `🤝 Offer a hand — ${J.name}${payLeft(job.type) ? ` (+${J.pay} 💰)` : ""}`; }
export function payLeft(type) { const L = ledger(); return (L.n[type] | 0) < JOBS[type].cap && L.coins < DAY_CAP; }
/** The ask, in the family's words. */
export function askLines(home, job) {
    const t = job.type;
    if (t === "mail") return [`The mailman gave us the ${plural(job.toName)}' mail AGAIN. Every week! Could you walk it over? It's just down the street.`];
    if (t === "manos") return [`Freilichen Purim! We have SIXTY of these and two hands. Could you bring this one to the ${plural(job.toName)}? With a "freilichen Purim" — you know.`];
    if (t === "dish") return [`This is the ${plural(job.toName)}' kugel dish. From SUKKOS. If I don't give it back they'll think I KEPT it. Please?`];
    if (t === "groceries") return ["You're a lifesaver! The bags are by the door — the kitchen's straight through. Mind the eggs!"];
    if (t === "glasses") return ["My GLASSES! I had them a minute ago! ...Could you look? My eyes aren't what they— well, I don't HAVE them, that's the problem."];
    return ["Oh THANK you — sixty seconds, I just need to move the car. They're angels. Mostly. Don't let anyone near the markers."];
}
export function markDone(home) { ledger().done[home.key] = 1; saveSoon(); }

// ── deliveries ───────────────────────────────────────────────────────────
export function startDelivery(home, job) {
    V.cur = Object.assign({ fromName: home.name, at: Date.now() }, job);
    markDone(home);
    const to = V.byId(job.to);
    if (to) beacon("homes:job", to.ap.x, to.ap.z, "#FFB74D", 1.4, 6);
    emit("homes:jobStart", { type: job.type, from: job.from, to: job.to });
    return V.cur;
}
export const delivery = () => V.cur;
export function deliveryFor(home) { return V.cur && V.cur.to === home.key ? V.cur : null; }
export function deliveryLabel(d) { if (d.label) return d.label; return d.type === "mail" ? `📬 Hand over the ${plural(d.toName)}' mail` : d.type === "manos" ? `🎁 Mishloach manos — from the ${plural(d.fromName)}!` : `🥘 Return the kugel dish (from the ${plural(d.fromName)})`; }
/** At the target door: the thank-you, the pay, both families remember. → coins paid */
export function finishDelivery(home) {
    const d = V.cur;
    if (!d) return 0;
    V.cur = null;
    hideBeacon("homes:job");
    const pay = payJob(d.type);
    const a = V.rec(home), from = V.byId(d.from);
    a.favours = (a.favours | 0) + 1;
    if (from) { const b = V.rec(from); b.favours = (b.favours | 0) + 1; }
    saveSoon();
    if (pay) H.toast(`${JOBS[d.type].emoji} +${pay} 💰 — a favour for the ${plural(home.name)}`, "gold", { key: "homes:job" });
    return pay;
}
export function thanksLines(home, d) {
    if (d.type === "manos") return [pick([`From the ${plural(d.fromName)}?! Oh, that's so NICE. Wait — we didn't send THEM one. ...MOISHE! Get a basket!`, "Freilichen Purim! Hamantaschen! And a GRAPE juice! Thank you, sheifele!"])];
    return d.type === "mail" ? [pick(["Our mail! From the GOLDBERGS' box? Again?! Thank you, sheifele.", "Oh! The electric bill. ...thank you. I think.", "You're a doll. A walking, mail-carrying doll."]).replace("GOLDBERGS", plural(d.fromName).toUpperCase())]
        : [pick([`MY DISH! The ${plural(d.fromName)} gave it back! I was going to say something at the Kiddush!`, "The dish! Finally! Tell them their kugel was... interesting. No— tell them DELICIOUS."])];
}
export function cancelDelivery(why) { if (!V.cur) return; V.cur = null; hideBeacon("homes:job"); emit("homes:jobCancel", { why }); }
on("town:leave", () => cancelDelivery("left town"));

// ── porch wave-ins + greetings by name (crowd.js calls this for a porch figure she walks past on foot) ──
/** → a line to say (and an invitation is made), or null. */
export function porchHook(p, d) {
    const h = p.home;
    if (!h || d > 6.5 || !V.lived(h)) return null;
    const now = performance.now() / 1000;
    if ((V.porchSaid.get(h.key) || -99) > now - 45) return null;
    const rec = V.S.fam[h.key];
    const op = opinion(rec, h);
    if (op === "wary" || op === "furious") { V.porchSaid.set(h.key, now); return Math.random() < 0.5 ? pick(["*watches you very carefully*", "We're WATCHING you, missy.", "*pulls the kids inside*"]) : null; }
    const w = when();
    const named = byName(rec, h);
    const R = rngOf(hash(h.key + "|wave|" + ledger().d));
    const invites = !noErrands(w) || w.shabbos ? (named ? 0.85 : 0.3) : 0;
    V.porchSaid.set(h.key, now);
    if (R() < invites || (named && Math.random() < invites)) {
        V.invites.set(h.key, now + 60);
        emit("homes:waveIn", { key: h.key, named });
        return named ? pick([`LULU! Come in, come in — there's cake!`, `Lulu! Perfect timing! Come, eat something!`, `Our Lulu! Come in, sheifele!`])
            : w.shabbos ? "Gut Shabbos! You'll come in? There's always room!" : pick(["You! Yes, YOU! Come in, we have too much food!", "Come in! We made enough for an ARMY.", "Hello! You look hungry. Come in!"]);
    }
    return named ? pick([`Hi Lulu!`, `Lulu! How's your mother?`, `There she is! Hi Lulu!`]) : null;
}
export function invited(home) { const t = V.invites.get(home.key); return !!t && t > performance.now() / 1000; }
export function useInvite(home) { V.invites.delete(home.key); }
export { V as VISITS };
