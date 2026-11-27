// features/lanes/net.js — 🎳 BOWLING WITH WHOEVER'S IN THE ALLEY. Client only: it rides on the state every screen in a
// group already sends (features/party's snapshot extras — d.x.bw, game.js has the format) and on features/together,
// which already draws the players in the same room (d.x.in). Nobody is pulled into anything: a player's game is just
// there on its lane — watch it, or walk up and ✋ JOIN.
//   publish()   my game (or nothing) → d.x.bw, only when it changed
//   sync()      everyone else's: their games on the other lanes (to watch / join), their balls in MY game, the owner's
//               roster (who's bowling, in order); a bowler gone > 6 s is skipped (the game goes on without her)
import { ctx } from "../../core/ctx.js";
import { friends, zoneOf, myZone, friendHex } from "../together/where.js";
import { readWire, wireOf, order, BOT, MAX_BOWLERS } from "./game.js";
import { G } from "./play.js";
import { V, showGame } from "./room.js";

const N = { sent: "", raw: new Map(), seen: new Map(), peer: [null, null, null, null, null] };
const AWAY_MS = 6000;

/** The players in the alley with me: [{ uid, w (their lane state | null) }]. */
export function peersHere() {
    const P = ctx.party, out = [];
    if (!P || !P.active || !P.peer) return out;
    for (const uid of friends()) {
        const p = P.peer(uid);
        if (!p || !P.fresh(p, 8000) || !p.x) continue;
        const a = p.x.in;
        if (!Array.isArray(a) || a[0] !== "lanes" || zoneOf(p) !== myZone()) continue;
        // (their lane state, parsed only when it changed)
        const raw = Array.isArray(p.x.bw) ? p.x.bw.join("|") : "";
        let c = N.raw.get(uid);
        if (!c || c.raw !== raw) { c = { raw, w: raw ? readWire(p.x.bw) : null }; N.raw.set(uid, c); }
        out.push({ uid, w: c.w });
    }
    return out;
}

export function publish() {
    const P = ctx.party;
    if (!P || !P.active || !P.setX) { N.sent = ""; return; }
    const inRoom = ctx.state === "interior" && V.rt && !V.rt.disposed;
    const w = inRoom && G.game ? wireOf(G.game, G.me) : null;
    const key = w ? JSON.stringify(w) : "";
    if (key === N.sent) return;
    N.sent = key;
    try { P.setX("bw", w); } catch (e) { /* not connected */ }
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x.down === b[i].down && x.x === b[i].x && x.aim === b[i].aim && x.p === b[i].p && x.s === b[i].s);
function setBalls(game, uid, list) { if (!game.balls[uid] || !same(game.balls[uid], list)) game.balls[uid] = list.slice(); }

export function sync() {
    if (!V.rt || V.rt.disposed) return;
    const peers = peersHere(), now = Date.now(), g = G.game;
    for (const q of peers) if (q.w) N.seen.set(`${q.uid}:${q.w.gid}`, now);
    // ── my game: the others' balls, the roster ──
    if (g) {
        const me = G.me;
        if (g.owner === me) {
            for (const q of peers) {
                const w = q.w;
                if (!w || w.gid !== g.gid || w.owner !== me || w.roster) continue;
                if (!g.roster.includes(q.uid) && g.roster.length < MAX_BOWLERS && !g.roster.includes(BOT) && order(g).next) g.roster.push(q.uid);
                if (g.roster.includes(q.uid)) setBalls(g, q.uid, w.balls);
            }
        } else {
            const o = peers.find(q => q.uid === g.owner);
            if (o && o.w && o.w.gid === g.gid && o.w.roster) {
                if (o.w.roster.join(",") !== g.roster.join(",")) g.roster = o.w.roster.slice();
                if (g.roster.includes(me)) G.joining = false;
                setBalls(g, g.owner, o.w.balls);
            }
            for (const q of peers) if (q.uid !== g.owner && g.roster.includes(q.uid) && q.w && q.w.gid === g.gid) setBalls(g, q.uid, q.w.balls);
            for (const u of g.roster) if (!g.balls[u]) g.balls[u] = [];
        }
        // a bowler who's gone (left the alley / another game) is skipped — the game goes on
        const away = new Set();
        for (const u of g.roster) {
            if (u === me || u === BOT) continue;
            const t = N.seen.get(`${u}:${g.gid}`) || g.joinedAt || g.startedAt || now;
            if (now - t > AWAY_MS) away.add(u);
        }
        const ak = [...away].join(","), old = g.away ? [...g.away].join(",") : "";
        if (ak !== old) g.away = away.size ? away : null;
        // two players took the same lane at the same moment: the one with the bigger id moves over
        const clash = g.owner === me && peers.find(q => q.w && q.w.roster && q.w.lane === g.lane && q.w.gid !== g.gid && q.uid < me);
        if (clash) {
            const free = freeLane(peers);
            if (free) { showGame(g.lane, null, ""); g.lane = free; }
        }
        showGame(g.lane, g, "mine", { color: "#E91E63" });
    }
    // ── the other lanes: the games players here own (watch them; ✋ join from the lane) ──
    for (let k = 1; k < V.lanes.length; k++) {
        if (g && g.lane === k) continue;
        const L = V.lanes[k];
        if (L.src === "house") continue;
        const owners = peers.filter(q => q.w && q.w.roster && q.w.lane === k).sort((a, b) => (a.uid < b.uid ? -1 : 1));
        const own = owners[0];
        if (!own) { if (L.src === "peer") { showGame(k, null, ""); N.peer[k] = null; } continue; }
        let pg = N.peer[k];
        if (!pg || pg.gid !== own.w.gid || pg.owner !== own.uid) pg = N.peer[k] = { lane: k, gid: own.w.gid, frames: own.w.frames, owner: own.uid, roster: [], balls: {} };
        if (pg.roster.join(",") !== own.w.roster.join(",")) pg.roster = own.w.roster.slice();
        setBalls(pg, own.uid, own.w.balls);
        if (pg.roster.includes(BOT)) setBalls(pg, BOT, own.w.bot);
        for (const q of peers) if (q.uid !== own.uid && q.w && q.w.gid === pg.gid && pg.roster.includes(q.uid)) setBalls(pg, q.uid, q.w.balls);
        // (and me, if I bowled in it and walked off: my own list)
        for (const u of pg.roster) if (!pg.balls[u]) pg.balls[u] = [];
        showGame(k, pg, "peer", { color: friendHex(own.uid) });
    }
}
/** A lane nobody's using (mine, a player's or the house's) → k | 0. */
export function freeLane(peers = peersHere()) {
    for (let k = 1; k < V.lanes.length; k++) {
        const L = V.lanes[k];
        if (L.src === "house" || (G.game && G.game.lane === k)) continue;
        if (peers.some(q => q.w && q.w.lane === k)) continue;
        if (L.src === "peer" && L.game) continue;
        return k;
    }
    return 0;
}
/** The game a player here owns on lane k, if I can join it: { w, uid } | null. */
export function joinable(k) {
    const L = V.lanes[k];
    if (!L || L.src !== "peer" || !L.game || G.game) return null;
    const pg = L.game;
    if (pg.roster.includes(BOT) || pg.roster.length >= MAX_BOWLERS || !order(pg).next) return null;
    return { uid: pg.owner, w: { lane: k, gid: pg.gid, frames: pg.frames, roster: pg.roster.slice(), balls: (pg.balls[pg.owner] || []).slice() } };
}
export const netDebug = { N, peersHere };
