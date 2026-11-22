// features/friends — 👯 STAGE 2 step 4: the old LOBBY games (🏁 race, 🏡 road trip, 🕎 dreidel dash, 🚓 cop tag) as
// INVITATIONS from 🌍 Free Roam. Anyone proposes one from 👯 › Games; everyone else gets ONE quiet chip (and a ✅ row in
// 👯); it starts only when EVERY friend in the group said yes within 40 s — a party shares one activity, so a "maybe"
// never pulls anyone off what they're doing — and when it's over the results offer 🌍 Back to Free Roam (no lobby).
// Host-run, on the party's own channel (no new network): proposals / votes are reliable host events ("gvp" key,
// "gvy" n, "gvx" n), the host publishes the tally in its snapshot extras as x.gv = [n, key, byUid, yesUids, untilClock].
import { ctx, on, emit } from "../../core/ctx.js";

export const LOBBY = {
    race: { emoji: "🏁", name: "Race", blurb: "a grid start, first to the line" },
    trip: { emoji: "🏡", name: "Road trip", blurb: "a convoy to Bubbe's" },
    dash: { emoji: "🕎", name: "Dreidel dash", blurb: "grab the most golden dreidels" },
    tag: { emoji: "🚓", name: "Cop tag", blurb: "one cop, everyone else runs" },
};
const LIFE = 40000;
const P = () => ctx.party || null;
const roaming = () => !!(ctx.group && ctx.group.roaming);
const H = { n: 0, k: "", by: "", yes: [], until: 0 };          // the host's tally

function publish() { const p = P(); if (p && p.setX) p.setX("gv", H.k ? [H.n, H.k, H.by, H.yes.slice(0, 8), Math.round(H.until)] : null); emit("group:vote", {}); }
function hostCheck() {
    const p = P();
    if (!H.k || !p || !p.isHost) return;
    const mem = p.members();
    if (mem.length >= 2 && mem.every(u => H.yes.includes(u))) {
        const k = H.k; H.k = ""; publish();
        p.hostStart(k, { fromRoam: 1 });
        emit("group:voteStart", { k });
    }
}
function onHost(uid, kind, a) {
    const p = P();
    if (!p || !p.isHost || !/^gv/.test(kind)) return;
    const t = p.clock();
    if (kind === "gvp") {
        if (!roaming() || !LOBBY[a[0]] || (H.k && t < H.until)) return;
        Object.assign(H, { n: H.n + 1, k: a[0], by: uid, yes: [uid], until: t + LIFE });
        publish(); hostCheck();
    } else if (kind === "gvy") {
        if (!H.k || a[0] !== H.n || t > H.until) return;
        if (!H.yes.includes(uid)) H.yes.push(uid);
        publish(); hostCheck();
    } else if (kind === "gvx") {
        if (H.k && a[0] === H.n && uid === H.by) { H.k = ""; publish(); }
    }
}
let wired = false;
function wire() { const p = P(); if (wired || !p || !p.onHostEvent) return; wired = true; p.onHostEvent(onHost); }
wire(); on("boot", wire);
setInterval(() => {
    const p = P();
    if (!p || !p.active) { if (H.k) { H.k = ""; } return; }
    if (p.isHost && H.k && (p.clock() > H.until || !roaming())) { H.k = ""; publish(); }
}, 500);

/** The open vote, as everyone sees it: { n, k, by, yes: [uid], left (s), mine, iAmIn, need } | null */
export function current() {
    const p = P();
    if (!p || !p.active || !roaming()) return null;
    let a = null;
    if (p.isHost) a = H.k ? [H.n, H.k, H.by, H.yes, H.until] : null;
    else { const h = p.peer(p.host); a = h && h.x && Array.isArray(h.x.gv) ? h.x.gv : null; }
    if (!a || !LOBBY[a[1]]) return null;
    const left = Math.max(0, Math.round((a[4] - p.clock()) / 1000));
    if (!left) return null;
    const yes = Array.isArray(a[3]) ? a[3] : [];
    return { n: a[0], k: a[1], by: a[2], yes, left, mine: a[2] === p.uid, iAmIn: yes.includes(p.uid), need: p.members().length };
}
/** Propose a lobby game (→ "" or why not). */
export function propose(k) {
    const p = P();
    if (!LOBBY[k]) return "No such game";
    if (!roaming()) return "Games start when you're playing with friends";
    if (p.members().length < 2) return "Wait for a friend first 👯";
    if (current()) return "A vote is already open";
    p.sendEvent("gvp", k);
    return "";
}
export function voteYes() { const v = current(), p = P(); if (v && !v.iAmIn) p.sendEvent("gvy", v.n); return !!v; }
export function callOff() { const v = current(), p = P(); if (v && v.mine) p.sendEvent("gvx", v.n); return !!v; }
/** The chip line for someone who hasn't answered ("" = none). */
export function chipLine() {
    const v = current(), p = P();
    if (!v || v.iAmIn) return "";
    const by = p.players.find(m => m.uid === v.by);
    const G = LOBBY[v.k];
    return `${G.emoji} ${by ? by.name : "A friend"} wants a ${G.name.toLowerCase()} — ${v.yes.length}/${v.need} in · 📱 👯`;
}
