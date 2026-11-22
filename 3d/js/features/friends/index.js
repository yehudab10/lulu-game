// features/friends — 👯 A FRIENDS LIST THAT LASTS (ci/friends, roadmap 19 stage 1; the owner, 2026-11-20: "combine party
// mode into the main world so friends could just friend each other and teleport and join their friends").
//
//  • ADD a friend — both must say yes — from someone you're playing with (📍 Nearby: a driver out in the world;
//    👯 in a party: a friend's row), or with a short FRIEND CODE / link (👯 › ➕ Add by code: live only while that
//    screen is open). Names are the game's curated ones (+ a small #number); no free text anywhere. ≤ 30 friends.
//    Remove / block (a block hides their asks for good). Kept on the device, in the 💾 save code with everything else.
//  • PRESENCE + JOIN without a server change: each player's private DOORBELL room (bell.js). 👯 shows who's playing
//    right now and roughly where; ▶ JOIN knocks, and (her setting: always / ask me / nobody — default ask: one quiet
//    chip) her game hands back a party code: we land next to her in 🌍 Free Roam (today's party, created silently).
//    🙈 Appear offline = no doorbell at all.
//  • Strangers never see a doorbell, a code or a secret (the key exchange happens in the open, the rest is sealed —
//    crypto.js), can't knock (they don't know the room), can't be told where she is.
// Files: crypto.js · room.js (one relay room) · store.js (save) · handshake.js (making friends) · bell.js (doorbell)
//        · ui.js (👯 app, 📍 Nearby rows, the chip, ⚙️).
// Service: ctx.friends — see the bottom. Events: friends:made, friends:asks, friends:presence, friends:joinAsk, friends:checked.
import { ctx, on, emit } from "../../core/ctx.js";
import * as H from "../../hud.js";
import { cryptoOk, randStr } from "./crypto.js";
import { openRoom } from "./room.js";
import * as ST from "./store.js";
import * as HS from "./handshake.js";
import * as BL from "./bell.js";
import * as UI from "./ui.js";
import "./group.js";
import * as VOTE from "./vote.js";     // stage 2 step 4: the lobby games as invitations from 🌍 Free Roam (everyone says yes)              // ctx.group — "with friends" as a group you're in (stage 2, step 1: today = the party)

const QS = new URLSearchParams(location.search);
export const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
const live = () => cryptoOk() && !!(ctx.mp && ctx.mp.allowed);

// ── the handshake's channels ──────────────────────────────────────────────
HS.chans.mp = {
    myId: () => (ctx.mp && ctx.mp.connected && ctx.mp.room === "lobby" ? ctx.mp.myId : null),
    peers: () => { const P = ctx.mp && ctx.mp._debug && ctx.mp._debug.peers; return P ? Object.values(P).filter(p => p.fr).map(p => ({ id: p.id, fr: p.fr })) : []; },
    publish: list => { if (ctx.mp && ctx.mp.setFr) ctx.mp.setFr(list); },
};
HS.chans.party = {
    myId: () => (ctx.party && ctx.party.active && ctx.party.connected ? ctx.party.uid : null),
    peers: () => (ctx.party && ctx.party.active ? ctx.party.players.filter(p => !p.me).map(p => { const q = ctx.party.peer(p.uid); return { id: p.uid, fr: q && q.x && q.x.fr }; }) : []),
    publish: list => { if (ctx.party && ctx.party.setX) ctx.party.setX("fr", list); },
};

// ── friend codes: a room "F" + CODE, open only while I show it (or while I use someone's) ──
const C = { mine: null, code: "", until: 0, using: null };
function codeChannel(room, ownerSide) {
    const id = "code";
    HS.chans[id] = {
        myId: () => (room.connected ? room.me : null),
        peers: () => [...room.peers].filter(([, d]) => d && d.fr).map(([pid, d]) => ({ id: pid, fr: d.fr })),
        publish: list => room.state(Object.assign(ownerSide ? { fc: 1 } : {}, list ? { fr: list } : {})),
    };
    return id;
}
/** ➕ Show my friend code (and keep its room open ≤ 10 min). → the code */
export function showCode() {
    if (!live()) return "";
    if (C.mine && Date.now() < C.until) return C.code;
    closeCode();
    C.code = randStr(6);
    C.until = Date.now() + 10 * 60000;
    C.mine = openRoom("F" + C.code, { stay: true, name: "Friend" });
    codeChannel(C.mine, true);
    C.mine.state({ fc: 1 });
    return C.code;
}
export function closeCode() { if (C.mine) { C.mine.close(); C.mine = null; HS.dropChannel("code"); delete HS.chans.code; } C.code = ""; }
export const codeLink = code => `${location.origin}${location.pathname.replace(/[^/]*$/, "")}?friend=${code}`;
/** Use someone's code: ask them (they say yes on their screen). → promise of "asked" | "nobody" | "bad" | "offline" */
export function useCode(code) {
    code = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!CODE_RE.test(code)) return Promise.resolve("bad");
    if (!live()) return Promise.resolve("offline");
    if (C.mine && C.code === code) return Promise.resolve("bad");
    if (C.using) { C.using.close(); HS.dropChannel("code"); }
    return new Promise(resolve => {
        let done = false;
        const fin = v => { if (!done) { done = true; resolve(v); } };
        const room = openRoom("F" + code, {
            name: "Friend",
            onHello: rm => { const o = [...rm.peers].find(([, d]) => d && d.fc === 1); if (!o) { setTimeout(() => { if (!done) { rm.close(); fin("nobody"); } }, 2500); } },
            onPeer: async (rm, pid, d) => { if (d && d.fc === 1 && !done) { codeChannel(rm, false); const r = await HS.ask("code", pid); fin(r === "full" ? "full" : "asked"); } },
            onClose: () => fin("offline"),
        });
        C.using = room;
        setTimeout(() => { if (C.using === room && !done) { room.close(); fin("nobody"); } }, 8000);
        setTimeout(() => { if (C.using === room) { room.close(); C.using = null; if (HS.chans.code && !C.mine) { HS.dropChannel("code"); delete HS.chans.code; } } }, 90000);
    });
}

// ── one-tap JOIN ──────────────────────────────────────────────────────────
const NO = { nobody: "isn't taking visitors right now", busy: "is busy — try again in a minute", ask: "said not right now" };
/** ▶ Join a friend: knock "join"; on a yes, hop into their party right next to them. → a promise of a message */
export async function join(fid, onWait) {
    const f = ST.friend(fid);
    if (!f) return "";
    if (!live()) return "You're offline";
    const P = ctx.party;
    const v = await BL.knock(f, "join", onWait);
    if (!v.on) return `${ST.labelOf(f)} isn't playing right now`;
    if (v.no) return `${ST.labelOf(f)} ${NO[v.no] || NO.busy}`;
    if (!v.code) return `${ST.labelOf(f)} ${NO.busy}`;
    const s = BL.seen.get(fid); if (s) s.code = v.code;
    if (P && P.active && P.code === v.code) return "";
    if (P && P.active) P.leave(false);
    const ok = P && P.join && P.join(v.code, { with: v.u });
    emit("friends:joining", { f: fid });
    return ok ? `🚀 Off to ${ST.labelOf(f)}…` : "Couldn't join right now";
}

// ── the loop (real time: it's all network) ────────────────────────────────
setInterval(() => { if (cryptoOk()) HS.tick(); }, 250);
setInterval(() => { if (!cryptoOk()) return; BL.tickBell(); if (C.mine && Date.now() > C.until) closeCode(); }, 1000);
on("party:status", e => { if (!(e && e.want)) HS.dropChannel("party"); });
on("friends:made", e => {
    if (!e) return;
    const msg = e.result === "full" ? `👯 Your friends list is full (${ST.CAP})` : e.result === "added" ? `🤝 You and ${ST.labelOf({ n: e.n, f: e.f })} are friends!` : e.result === "updated" ? `🤝 ${ST.labelOf({ n: e.n, f: e.f })} — still friends` : "";
    if (msg) H.toast(msg, "pink", { prio: 2 });               // (the answer to a tap: never dropped by the budget)
    if (e.chan === "code" && C.using) { const r = C.using; setTimeout(() => { if (C.using === r) { r.close(); C.using = null; } }, 3000); }
    UI.refresh();
});
on("boot", () => {
    if (!cryptoOk()) return;
    // a ?friend=CODE link: ask that player (they say yes on their screen)
    const code = (QS.get("friend") || "").toUpperCase();
    if (CODE_RE.test(code)) setTimeout(() => useCode(code).then(r => H.toast(r === "asked" ? "🤝 Asked them to be friends — they say yes on their screen" : r === "full" ? `👯 Your friends list is full (${ST.CAP})` : "🤝 That friend code isn't open right now", "pink", { prio: 2 })), ctx.TEST ? 500 : 2500);
    // once, a little after starting: knock at every friend's door (who's on — and it tells them I'm on)
    setTimeout(() => { if (ST.S.list.length) BL.checkAll(); }, ctx.TEST ? 1500 : 6000);
});
UI.install({ showCode, closeCode, codeLink, useCode, join, live, C });

// ── the service ───────────────────────────────────────────────────────────
ctx.friends = {
    get ok() { return cryptoOk(); },
    get live() { return live(); },
    get me() { return ST.me().fid; },
    get list() { return ST.S.list.map(f => ({ f: f.f, n: f.n, label: ST.labelOf(f), sk: f.sk, presence: BL.seen.get(f.f) || null })); },
    get blocked() { return ST.S.blocked.map(b => ({ f: b.f, n: b.n })); },
    get join() { return ST.S.join; }, set join(v) { ST.setJoin(v); },
    get hidden() { return ST.S.hidden; }, set hidden(v) { ST.setHidden(v); },
    CAP: ST.CAP,
    /** ➕ ask (or answer) a player: chan "mp" (📍 Nearby) | "party" (👯) | "code". */
    add: (chan, peer) => HS.ask(chan, peer),
    accept: (chan, peer) => HS.accept(chan, peer),
    decline: (chan, peer) => HS.decline(chan, peer),
    incoming: chan => HS.incoming(chan),
    outgoing: (chan, peer) => HS.outgoing(chan, peer),
    remove: fid => { const ok = ST.removeFriend(fid); BL.seen.delete(fid); UI.refresh(); return ok; },
    block: (fid, name) => { ST.block(fid, name); BL.seen.delete(fid); UI.refresh(); },
    unblock: fid => { ST.unblock(fid); UI.refresh(); },
    check: () => BL.checkAll(),
    joinFriend: (fid, onWait) => join(fid, onWait),
    joinAsks: () => BL.joinAsks(),
    answerJoin: (fid, yes) => BL.answerJoin(fid, yes),
    showCode, closeCode, useCode, codeLink,
    get code() { return C.mine ? C.code : ""; },
    /** the views openworld's 👯 / 📍 Nearby borrow */
    ui: { missionRows: UI.missionRows, wireMissions: UI.wireMissions, voteRows: UI.voteRows, wireVote: UI.wireVote, render: UI.render, partyRow: UI.partyRow, wirePartyRow: UI.wirePartyRow, driverNote: UI.driverNote, driverView: UI.driverView, open: UI.openApp },
    debug: () => ({ hs: HS.debug(), bell: BL.debug(), store: { me: ST.S.me, n: ST.S.list.length, blocked: ST.S.blocked.length, join: ST.S.join, hidden: ST.S.hidden } }),
};
