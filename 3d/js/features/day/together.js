// features/day — 📝 IMA'S LIST WITH FRIENDS (ci/friends stage 2, step 3: a 👯 › Missions invitation, ctx.group.invitable).
// It's the OFFERER's list (today's, on her screen, as solo — the chip, the light column, her once-a-day coins). Friends
// who say yes HELP: whatever they do that's on her list (the place, a side job passed, the silly thing) ticks it on her
// screen; they see her list in a chip of their own. Home for dinner (her driveway) → everyone gets the banner, the
// helpers with Ima's thank-you — and NO coins (golden rule 5: the list pays its owner once a day, exactly as solo).
// Wire (the party's own channels): the owner's d.x.dl = [key, ids, doneBits, home 0|1]; helpers → owner: a "dlb"
// broadcast [key, id, n] (the owner checks the id is on her list, and bump()'s own once-a-day rules hold).
import { ctx, on, emit, hook } from "../../core/ctx.js";
import * as H from "../../hud.js";
import { DAYX } from "./index.js";

const T = { key: "", own: false, by: "", seen: "", chip: null, chipText: "", home: false, endAt: 0, pubT: 0, pub: "" };
const P = () => ctx.party;
const roaming = () => { const p = P(); return !!(p && p.active && p.activity && p.activity.k === "roam"); };
const nameOf = uid => { try { return P().displayName(uid); } catch (e) { return "your friend"; } };

function why() {
    if (!ctx.enabled("day")) return "This is off right now.";
    if (!roaming()) return "You can only do this with friends.";
    if (T.key) return "You're already doing Ima's list.";
    DAYX.ensureToday();
    return DAYX.DAY.home ? "You already had dinner at home today. There's a new list tomorrow." : "";
}
function start({ members, me, by, seed }) {
    T.key = String(seed || "x").slice(0, 8); T.home = false; T.endAt = 0;
    if (me === by) {
        T.own = true;
        DAYX.ensureToday();
        DAYX.S.group = { key: T.key, members: members.slice() };
        DAYX.S.active = true;
        emit("day:start", { list: DAYX.DAY.list.slice(), group: true });
        H.banner(`<b>📝 Ima's list, with friends</b><small>Anything your friends do on the list counts. Then come home for dinner.</small>`, 4200, { key: "day" });
        return;
    }
    T.own = false; T.by = by; T.seen = "";
    H.banner(`<b>📝 You're helping with ${nameOf(by)}'s list</b><small>Anything you do on it counts. Dinner is at her house. The coins go to her.</small>`, 4600, { key: "day" });
}
function stop() {
    if (T.own) { DAYX.S.group = null; if (DAYX.S.active && !roaming()) DAYX.S.active = false; const p = P(); if (p && p.active) p.setX("dl", null); }
    T.key = ""; T.own = false; T.by = ""; T.seen = ""; T.home = false; T.endAt = 0; T.pub = "";
    if (T.chip) { T.chip.remove(); T.chip = null; T.chipText = ""; }
}

// ── the owner: publish the list; take the helpers' ticks ──
function publish() {
    const D = DAYX.DAY, bits = D.list.map(id => (DAYX.isDone(id) ? 1 : 0)).join("");
    const v = JSON.stringify([T.key, D.list, bits, T.home ? 1 : 0]);
    if (v === T.pub) return;
    T.pub = v;
    P().setX("dl", [T.key, D.list.slice(), bits, T.home ? 1 : 0]);
}
on("party:bc", ({ p, k, a }) => {
    if (k !== "dlb" || !T.own || !T.key || !p || !Array.isArray(a) || a[0] !== T.key) return;
    const g = DAYX.S.group;
    if (!g || !g.members.includes(p.uid) || !DAYX.DAY.list.includes(a[1])) return;
    const n = Math.max(1, Math.min(5, a[2] | 0));
    DAYX.bump(a[1], n);                       // (once a day, as solo; a finished item ignores it)
});
on("day:home", () => {
    if (!T.own || !T.key) return;
    T.home = true; T.endAt = Date.now() + 8000;
    publish();
});

// ── a helper: what I do that's on her list → a tick on her screen ──
function herList() {
    const q = T.by && P() && P().peer(T.by), dl = q && q.x && q.x.dl;
    return Array.isArray(dl) && dl[0] === T.key && Array.isArray(dl[1]) ? dl : null;
}
function help(match) {
    if (T.own || !T.key || !T.by) return;
    const dl = herList();
    if (!dl) return;
    dl[1].forEach((id, i) => {
        const it = DAYX.byId(id);
        if (!it || String(dl[2])[i] === "1") return;
        const n = match(it);
        if (n > 0) P().broadcast("dlb", T.key, id, n);
    });
}
on("world:visit", e => help(it => (it.kind === "place" && e && e.id === it.place ? 1 : 0)));
on("hustle:end", e => help(it => (it.kind === "job" && e && e.result === "pass" ? 1 : 0)));
on("stat", e => help(it => (it.kind === "stat" && e && it.stat === e.id ? e.n || 1 : 0)));
// (kind "event": listened for once it's on her list — other features add these at boot, e.g. shops' "say hi to Refael")
const EVS = new Set();
function listenEv(ev) { if (!ev || EVS.has(ev)) return; EVS.add(ev); on(ev, () => help(it => (it.kind === "event" && it.ev === ev ? 1 : 0))); }

function helperTick() {
    const dl = herList();
    if (!dl) return;
    const bits = String(dl[2]);
    for (const id of dl[1]) { const it = DAYX.byId(id); if (it && it.kind === "event") listenEv(it.ev); }
    if (T.seen && bits !== T.seen) {
        dl[1].forEach((id, i) => { if (bits[i] === "1" && T.seen[i] !== "1") { const it = DAYX.byId(id); if (it) H.toast(`✅ Done for ${nameOf(T.by)}: ${it.text.replace(/ \(.*\)$/, "")}`, "gold", { prio: 2 }); } });
    }
    T.seen = bits;
    if (dl[3] === 1 && !T.home) {
        T.home = true; T.endAt = Date.now() + 8000;
        H.banner(`🏠 <b>HOME FOR DINNER!</b><small>Ima: “Thank you for helping my Lulu! Sit, sit, there's plenty.”</small>`, 3800, { prio: 2 });
        emit("day:helped", { by: T.by });
        emit("stat", { id: "dayHelped", n: 1 });
    }
    // the chip: her list
    const def = ctx.states[ctx.state];
    if (!def || !def.hud) { if (T.chip) { T.chip.remove(); T.chip = null; T.chipText = ""; } return; }
    const n = [...bits].filter(b => b === "1").length, next = dl[1].find((id, i) => bits[i] !== "1");
    const it = next && DAYX.byId(next);
    const txt = `📝 ${nameOf(T.by)}'s list <span class="ok">${n}/${dl[1].length}</span><small>${it ? it.text : "Go to her house for dinner."}</small>`;
    if (!T.chip) { T.chip = document.createElement("div"); T.chip.className = "day-chip"; H.hudSlot("left").appendChild(T.chip); T.chipText = ""; }
    if (txt !== T.chipText) { T.chipText = txt; T.chip.innerHTML = txt; }
}
hook("hud", () => {
    if (!T.key) return;
    if (!roaming()) { stop(); return; }
    if (T.endAt && Date.now() > T.endAt) { stop(); return; }
    if (T.own) { if (Date.now() - T.pubT > 300) { T.pubT = Date.now(); publish(); } }
    else helperTick();
});
on("party:status", e => { if (!(e && e.want) && T.key) stop(); });

let reg = false;
function register() {
    if (reg || !ctx.group || !ctx.group.invitable) return reg;
    ctx.group.invitable({ id: "day.list", icon: "📝", title: "Ima's list together", blurb: "Do today's list together, then come home for dinner.", max: 4, canStart: why, start });
    return (reg = true);
}
on("boot", register);
export const dayTogetherDebug = () => ({ key: T.key, own: T.own, by: T.by, seen: T.seen, home: T.home, chip: T.chip ? T.chip.textContent : "" });
