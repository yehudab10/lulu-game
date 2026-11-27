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
import { cryptoOk, randStr, keyPair } from "./crypto.js";
import { openRoom } from "./room.js";
import * as ST from "./store.js";
import * as HS from "./handshake.js";
import * as BL from "./bell.js";
import * as UI from "./ui.js";
import "./group.js";
import * as VOTE from "./vote.js";
import * as SV from "./server.js";      // (ci/accounts) the list, requests + blocks kept on the server too     // stage 2 step 4: the lobby games as invitations from 🌍 Free Roam (everyone says yes)              // ctx.group — "with friends" as a group you're in (stage 2, step 1: today = the party)

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
// Two phones can each be hosting AND visiting. Relay peer ids are local to a room.
// An invitation tag lets crossed exchanges with the same phone derive the same
// friendship secret, even when both players press Accept at the same time.
function invitation() { return { tag: randStr(16), keys: new Map() }; }
function codeChannel(room, chan, invite) {
    const marker = chan === "code" ? { fc: 1, tag: invite.tag } : { tag: invite.tag };
    HS.chans[chan] = {
        myId: () => (room.connected ? room.me : null),
        peers: () => [...room.peers].filter(([, d]) => d && d.fr).map(([pid, d]) => ({ id: pid, fr: d.fr })),
        keyFor(peer) {
            const tag = room.peers.get(peer)?.tag;
            if (!/^[A-HJ-NP-Z2-9]{16}$/.test(tag || "")) return keyPair(); // older client
            if (!invite.keys.has(tag)) invite.keys.set(tag, keyPair());
            return invite.keys.get(tag);
        },
        publish: list => room.state(list ? { ...marker, fr: list } : marker),
    };
    room.state(marker);
}
/** ➕ Show my friend code (and keep its room open ≤ 10 min). → the code */
export function showCode() {
    if (!live()) return "";
    if (C.mine && Date.now() < C.until) return C.code;
    closeCode();
    C.code = randStr(6);
    C.until = Date.now() + 10 * 60000;
    C.mine = openRoom("F" + C.code, { stay: true, name: "Friend" });
    C.mine.invite = invitation();
    codeChannel(C.mine, "code", C.mine.invite);
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
    if (C.using?.code === code) return C.using.result;
    C.using?.stop("nobody");

    const visit = { code, owner: null };
    visit.result = new Promise(resolve => { visit.resolve = resolve; });
    C.using = visit;
    const room = openRoom("F" + code, {
        name: "Friend",
        onHello: rm => {
            if (![...rm.peers.values()].some(d => d?.fc === 1))
                setTimeout(() => { if (!visit.owner) visit.stop("nobody"); }, 2500);
        },
        onPeer: async (rm, pid, d) => {
            if (C.using !== visit || visit.owner || d?.fc !== 1) return;
            visit.owner = pid;
            visit.ownerTag = d.tag;
            try {
                const r = await HS.ask("code-out", pid);
                if (r === "asked" || r === "pending") visit.resolve("asked");
                else visit.stop(r === "full" ? "full" : "offline");
            } catch { visit.stop("offline"); }
        },
        onLeave: (rm, pid) => { if (pid === visit.owner) visit.stop("nobody"); },
        onClose: () => visit.stop("offline"),
    });
    codeChannel(room, "code-out", C.mine?.invite || invitation());
    visit.stop = reason => {
        if (C.using !== visit) return;
        C.using = null;
        room.close();
        HS.dropChannel("code-out");
        delete HS.chans["code-out"];
        visit.resolve(reason);
    };
    setTimeout(() => { if (!visit.owner) visit.stop("nobody"); }, 8000);
    setTimeout(() => visit.stop("nobody"), 60000);
    return visit.result;
}

// ── one-tap JOIN ──────────────────────────────────────────────────────────
const NO = { nobody: "isn't taking visitors right now", busy: "is busy — try again in a minute", ask: "said not right now" };
/** ▶ Join a friend: knock "join"; on a yes, hop into their party right next to them. → a promise of a message */
export async function join(fid, onWait) {
    const f = ST.friend(fid);
    if (!f) return "";
    if (!live()) return "You're offline";
    const P = ctx.party;
    if (!ST.ready(f)) return `${ST.labelOf(f)} isn't playing right now`;
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
// a friend recognised in EVERYONE: knocks carry which ghost each of us is (sealed) → relabel the ghosts
on("friends:presence", () => { if (ctx.mp && ctx.mp.relabel) ctx.mp.relabel(); });
// I just came into the EVERYONE room (a new ghost id): tell my friends which one is me (a knock round; ≤ 1 a minute)
let lastLobbyCheck = 0, lastLobbyId = "";
on("mp:status", e => {
    if (!(e && e.connected) || !cryptoOk() || !ST.S.list.length || ST.S.hidden) return;
    setTimeout(() => {
        const M = ctx.mp;
        if (!M || !M.connected || M.room !== "lobby" || M.myId === lastLobbyId || Date.now() - lastLobbyCheck < 60000) return;
        lastLobbyId = M.myId; lastLobbyCheck = Date.now();
        BL.checkAll();
    }, ctx.TEST ? 300 : 2000);
});
on("friends:made", e => {
    if (!e) return;
    const msg = e.result === "full" ? `👯 Your friends list is full (${ST.CAP})` : e.result === "added" ? `🤝 You and ${ST.labelOf({ n: e.n, f: e.f })} are friends!` : e.result === "updated" ? `🤝 ${ST.labelOf({ n: e.n, f: e.f })} — still friends` : "";
    if (msg) H.toast(msg, "pink", { prio: 2 });               // (the answer to a tap: never dropped by the budget)
    const incomingTag = e.chan === "code" && C.mine?.peers.get(e.peer)?.tag;
    if (C.using && (e.chan === "code-out" || (incomingTag && incomingTag === C.using.ownerTag))) {
        const visit = C.using;
        setTimeout(() => visit.stop("nobody"), 3000);
    }
    UI.refresh();
});
on("boot", () => {
    if (!cryptoOk()) return;
    // a ?friend=CODE link: ask that player (they say yes on their screen)
    const code = (QS.get("friend") || "").toUpperCase();
    if (CODE_RE.test(code)) setTimeout(() => useCode(code).then(r => H.toast(r === "asked" ? "🤝 Asked them to be friends. They say yes on their screen." : r === "full" ? `👯 Your friends list is full (${ST.CAP})` : "🤝 That friend code isn't open right now", "pink", { prio: 2 })), ctx.TEST ? 500 : 2500);
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
    remove: fid => { const ok = ST.removeFriend(fid); BL.seen.delete(fid); SV.removed(fid); UI.refresh(); return ok; },
    block: (fid, name) => { ST.block(fid, name); BL.seen.delete(fid); SV.blocked(fid); UI.refresh(); },
    unblock: fid => { ST.unblock(fid); SV.unblocked(fid); UI.refresh(); },
    // (ci/accounts) friend requests on the server — they wait for a player who is offline
    get requests() { return SV.requests(); },
    get badge() { return SV.badge(); },
    askByName: name => SV.ask({ to: String(name || "") }),
    answer: (fid, yes) => SV.answer(fid, yes),
    cancel: fid => SV.cancel(fid),
    get who() { return SV.who(); }, setWho: w => SV.setWho(w),
    server: SV,
    check: () => BL.checkAll(),
    /** A ghost in EVERYONE → her friend label if she's my friend (she told me, sealed), else null. */
    byMp: id => BL.byMp(id),
    joinFriend: (fid, onWait) => join(fid, onWait),
    joinAsks: () => BL.joinAsks(),
    answerJoin: (fid, yes) => BL.answerJoin(fid, yes),
    showCode, closeCode, useCode, codeLink,
    get code() { return C.mine ? C.code : ""; },
    /** the views openworld's 👯 / 📍 Nearby borrow */
    ui: { missionRows: UI.missionRows, wireMissions: UI.wireMissions, voteRows: UI.voteRows, wireVote: UI.wireVote, render: UI.render, partyRow: UI.partyRow, wirePartyRow: UI.wirePartyRow, driverNote: UI.driverNote, driverView: UI.driverView, open: UI.openApp },
    debug: () => ({ hs: HS.debug(), bell: BL.debug(), store: { me: ST.S.me, n: ST.S.list.length, blocked: ST.S.blocked.length, join: ST.S.join, hidden: ST.S.hidden } }),
};
