// features/lanes/game.js — 🎳 ONE LANE'S GAME: who bowls, in what order, every ball — and how it travels.
//
// A game = { lane, gid, frames (10 | 3), owner (a uid), roster: [uids, in order], balls: { uid: [throw…] } }.
// A throw on the wire is 6 base-36 characters: x aim p s (one each, 0…35) + the pins it knocked down (a 10-bit mask,
// 2 characters) — decided on the thrower's screen (pins.js). Each player publishes ONLY her own balls, in the state her
// screen already sends to the others (the party snapshot's extras: d.x.bw — a list, ≤ ~140 characters):
//   owner:  [lane, gid, frames, ownerUid, "uid,uid,…" (the roster), "my balls", "the house bowler's balls"]
//   joiner: [lane, gid, frames, ownerUid, "",                       "my balls"]
// State, not events: a dropped packet just means the next snapshot carries it. Every screen rebuilds the same order of
// balls from the roster + everyone's lists (order() below), so every screen shows the same pins, frames and score.
//
// Turn order: whoever is in the middle of a frame keeps bowling; otherwise the bowler with the FEWEST frames done goes
// next (ties: roster order) — so a friend who joins late bowls her missed frames on her turns until she's caught up.
import { framesOf, countOf } from "./pins.js";

export const BOT = "~shimmy";            // the house bowler (solo games only — never on the wire as a joiner)
export const MAX_BOWLERS = 4;

const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";
export function packThrow(t, down) {
    const c = v => B36[Math.max(0, Math.min(35, v | 0))];
    const m = Math.max(0, Math.min(1023, down | 0));
    return c(t.x) + c(t.aim) + c(t.p) + c(t.s) + B36[Math.floor(m / 36)] + B36[m % 36];
}
export function unpackBalls(str) {
    const out = [];
    if (typeof str !== "string") return out;
    for (let i = 0; i + 6 <= str.length && out.length < 21; i += 6) {
        const v = k => B36.indexOf(str[i + k]);
        const d = v(4) * 36 + v(5);
        if ([0, 1, 2, 3, 4, 5].some(k => v(k) < 0) || d > 1023) break;
        out.push({ x: v(0), aim: v(1), p: v(2), s: v(3), down: d });
    }
    return out;
}
export const packBalls = list => list.map(b => packThrow(b, b.down)).join("");

export function newGid() { let s = ""; for (let i = 0; i < 4; i++) s += B36[Math.floor(Math.random() * 36)]; return s; }

/** A bowler's frames (pins.js) from her balls. */
export const sheetOf = (balls, nFrames) => framesOf((balls || []).map(b => b.down), nFrames);

/**
 * The balls in the order they were bowled: [{ uid, k (her k-th ball), ball, standing (pins up before it) }] + who's
 * next (uid | null when the game is over) and each bowler's sheet.
 */
export function order(game) {
    // (cached on the game until a ball, the roster or who's away changes — the lanes ask every frame)
    const n = game.roster.map(u => (game.balls[u] ? game.balls[u].length : -1)).join(".");
    const key = `${n}|${game.roster.join(",")}|${game.away ? [...game.away].join(",") : ""}`;
    if (game._o && game._ok === key) return game._o;
    game._ok = key;
    return (game._o = orderNow(game));
}
function orderNow(game) {
    const nF = game.frames, ros = game.roster.filter(u => game.balls[u]);
    const used = {}, sheets = {};
    for (const u of ros) { used[u] = 0; sheets[u] = sheetOf([], nF); }
    const seq = [];
    let next = null;
    for (let guard = 0; guard < 200; guard++) {
        next = whoNext(ros, sheets, game.away || null);
        if (!next) break;
        const list = game.balls[next];
        if (used[next] >= list.length) break;          // (her ball hasn't arrived yet / she hasn't bowled it)
        const st = sheets[next];
        const b = list[used[next]];
        seq.push({ uid: next, k: used[next], ball: b, standing: st.standing, frame: st.frame });
        used[next]++;
        sheets[next] = sheetOf(list.slice(0, used[next]), nF);
    }
    return { seq, next, sheets };
}
/** Who bowls next (null = everyone's done). `away`: uids skipped (gone from the alley). */
export function whoNext(ros, sheets, away) {
    let best = null, bf = 1e9;
    for (const u of ros) {
        if (away && away.has(u)) continue;
        const s = sheets[u];
        if (s.done) continue;
        if (s.ball > 0) return u;                     // mid-frame: she finishes it
        if (s.complete < bf) { bf = s.complete; best = u; }
    }
    return best;
}

/** What I publish for a game (null = not bowling). */
export function wireOf(game, me) {
    if (!game) return null;
    const mine = packBalls(game.balls[me] || []);
    if (game.owner === me) return [game.lane, game.gid, game.frames, me, game.roster.join(","), mine, game.roster.includes(BOT) ? packBalls(game.balls[BOT] || []) : ""];
    return [game.lane, game.gid, game.frames, game.owner, "", mine];
}
/** A peer's published lane state → { lane, gid, frames, owner, roster | null, balls, bot } | null. */
export function readWire(a) {
    if (!Array.isArray(a) || a.length < 6) return null;
    const lane = a[0] | 0, frames = a[2] === 3 ? 3 : 10;
    if (lane < 1 || lane > 4 || typeof a[1] !== "string" || typeof a[3] !== "string") return null;
    const roster = typeof a[4] === "string" && a[4] ? a[4].split(",").filter(Boolean).slice(0, MAX_BOWLERS) : null;
    return { lane, gid: a[1].slice(0, 8), frames, owner: a[3].slice(0, 40), roster, balls: unpackBalls(a[5]), bot: unpackBalls(a[6] || "") };
}

export { countOf };
