// features/openworld — THE GAMES. Each one is a small rule book over one plain state
// object `g` that the HOST owns (in a party it rides inside the party activity state, so
// every snapshot carries the whole truth; solo, it's local and "the host" is you):
//
//   request(here)        — on the screen that asks for a game: where to go (pins near HERE)
//   setup(g, req, rnd)   — host: roles, the pin, the clock          → "" or a reason it can't
//   event(g, uid, k, a, t) — host: a player's claim (a bust, a pass, a finish, a snap) → changed?
//   tick(g, t, mem)      — host: the end conditions                 → changed?
//   play(g, me, t, X)    — every screen: detect MY contacts / arrivals and claim them (X = helpers)
//   hud(g, me, t, X)     — the one objective chip (+ the arrow target) and the little score list
//   rows(g) / title(g, me) — the scoreboard
//
// Claims are idempotent and validated by the host against `g` (the right game number, the
// right holder, the head-start over…), so two screens racing to claim the same thing settle
// on ONE answer that every friend then sees.
import { fmtT, fmtRace, esc } from "./hud.js";

const near = (a, b, r) => !!a && !!b && (a.x - b.x) ** 2 + (a.z - b.z) ** 2 < r * r;
const dist = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity);
const fire = (f, t) => "🔥".repeat(Math.max(1, Math.min(4, 1 + Math.floor(f * 4))));
const crew = (g, mem) => g.ps.filter(u => mem.includes(u));

export const GAMES = {
    // ── 📍 RACE TO A PIN ────────────────────────────────────────────────
    pin: {
        id: "pin", emoji: "📍", name: "Race to a Pin", blurb: "First to the pin wins — shortcuts welcome", min: 1, solo: true,
        request(X) {
            const pins = X.pins(160, 4);
            return pins.length ? { pins } : "Nowhere to race to from here — try in town 🏙️";
        },
        setup(g, req, rnd) {
            const p = req.pins[Math.floor(rnd() * req.pins.length)];
            Object.assign(g, { pin: p, dur: 240000, fin: {} });
            return "";
        },
        event(g, uid, k, a, t) {
            if (k !== "owf" || g.fin[uid] != null) return false;
            g.fin[uid] = Math.max(g.t0, Math.min(Math.round(t + 500), a[1] | 0));
            return true;
        },
        tick(g, t, mem) {
            const c = crew(g, mem), times = Object.values(g.fin);
            const first = times.length ? Math.min(...times) : 0;
            return (c.length && c.every(u => g.fin[u] != null)) || (first && t > first + 30000) || t > g.t0 + g.dur;
        },
        play(g, me, t, X) {
            if (t < g.t0 || X.L.fin || !near(X.pos(me), g.pin, 14)) return;
            X.L.fin = true;
            X.send("owf", g.n, Math.round(t));
            const place = 1 + Object.keys(g.fin).filter(u => u !== me).length;
            X.banner(`<b>📍 You made it${g.ps.length > 1 ? ` — ${X.ord(place)}!` : "!"}</b><small>${esc(g.pin.name)} · ${fmtRace(t - g.t0)}</small>`, 2600);
            X.fanfare(); X.burst();
        },
        hud(g, me, t, X) {
            const rows = GAMES.pin.rows(g, X);
            const mine = rows.findIndex(r => r.uid === me);
            const done = g.fin[me] != null || X.L.fin;
            const chip = done ? `📍 Made it! ${g.ps.length > 1 ? `<b>${X.ord(mine + 1)}</b> · waiting for the gang…` : fmtRace((g.fin[me] || t) - g.t0)}`
                : `📍 Race to <b>${esc(g.pin.name)}</b>${g.ps.length > 1 ? ` · ${X.ord(mine + 1)} of ${rows.length}` : ` · ${fmtRace(t - g.t0)}`}`;
            return { chip, cls: done ? "gold" : "", to: done ? null : g.pin, rows, unit: r => (r.t != null ? "🏁 " + fmtRace(r.t) : r.d < 1e6 ? Math.round(r.d) + " m" : "") };
        },
        rows(g, X) {
            const rows = g.ps.map(u => ({ uid: u, t: g.fin[u] != null ? g.fin[u] - g.t0 : null, d: X ? dist(X.pos(u), g.pin) : 1e9 }));
            rows.sort((a, b) => (a.t != null) !== (b.t != null) ? (a.t != null ? -1 : 1) : a.t != null ? a.t - b.t : a.d - b.d);
            rows.forEach((r, i) => { r.val = r.t != null ? fmtRace(r.t) : "DNF"; r.win = i === 0 && r.t != null; });
            return rows;
        },
        title(g, me, rows, X) {
            if (!rows[0] || rows[0].t == null) return "📍 Nobody made it!";
            if (g.ps.length === 1) return `📍 ${esc(g.pin.name)} in ${fmtRace(rows[0].t)}!`;
            return rows[0].uid === me ? "🏆 You got there first!" : `📍 ${esc(X.name(rows[0].uid))} got there first!`;
        },
    },

    // ── 🚓 COPS & ROBBERS ────────────────────────────────────────────────
    cnr: {
        id: "cnr", emoji: "🚓", name: "Cops & Robbers", blurb: "One cop · everyone else gets the stash to Uncle Moishe's van", min: 2,
        request(X) {
            const pins = X.pins(170, 3);
            return pins.length ? { pins } : "No getaway spot from here — try in town 🏙️";
        },
        setup(g, req, rnd) {
            if (g.ps.length < 2) return "Cops & Robbers needs a friend 👯";
            const cop = g.ps[(g.n + Math.floor(rnd() * g.ps.length)) % g.ps.length];
            g.ps = g.ps.filter(u => u !== cop).concat([cop]);            // the cop lines up at the back
            const p = req.pins[Math.floor(rnd() * req.pins.length)];
            Object.assign(g, { cop, drop: Object.assign({}, p, { name: "Uncle Moishe's van", icon: "🚐", near: p.name }), copGo: g.t0 + 5000, dur: 150000, out: {}, outT: {} });
            return "";
        },
        event(g, uid, k, a, t) {
            if (k === "owb") {
                const v = a[1];
                if (uid !== g.cop || t < g.copGo - 200 || v === g.cop || !g.ps.includes(v) || g.out[v]) return false;
                g.out[v] = "b"; g.outT[v] = Math.round(t); g.by = uid;
                return true;
            }
            if (k === "owd") {
                if (uid === g.cop || g.out[uid]) return false;
                g.out[uid] = "d"; g.outT[uid] = Math.round(t);
                return true;
            }
            return false;
        },
        tick(g, t, mem) {
            const robbers = crew(g, mem).filter(u => u !== g.cop);
            return !mem.includes(g.cop) || !robbers.length || robbers.every(u => g.out[u]) || t > g.t0 + g.dur;
        },
        play(g, me, t, X) {
            if (t < g.t0) return;
            if (me === g.cop) {
                if (t < g.copGo) return;
                for (const u of g.ps) {
                    if (u === me || g.out[u] || X.L.claimed[u]) continue;
                    if (X.touching(u)) { X.L.claimed[u] = true; X.send("owb", g.n, u); X.siren(); }
                }
            } else if (!g.out[me] && !X.L.fin && near(X.pos(me), g.drop, 13)) {
                X.L.fin = true;
                X.send("owd", g.n);
                X.banner(`<b>💰 STASH DELIVERED!</b><small>Uncle Moishe: "I don't know you. Thank you."</small>`, 2600);
                X.fanfare(); X.burst();
            }
        },
        hud(g, me, t, X) {
            const left = fmtT(g.t0 + g.dur - t), robbers = g.ps.filter(u => u !== g.cop);
            const free = robbers.filter(u => !g.out[u]);
            let chip, cls = "", to = null;
            if (me === g.cop) {
                cls = "cop";
                if (t < g.copGo) chip = `🚓 You're the COP · they get a head start… <b>${Math.ceil((g.copGo - t) / 1000)}</b>`;
                else {
                    chip = `🚓 COP · bust the robbers! <b>${free.length}</b> on the loose · ${left}`;
                    let best = Infinity; for (const u of free) { const d = dist(X.pos(u), X.pos(me)); if (d < best) { best = d; to = X.pos(u); } }
                }
            } else if (g.out[me] === "b") { chip = `🚔 BUSTED · cheer on the gang · ${left}`; cls = ""; }
            else if (g.out[me] === "d") { chip = `💰 Delivered! Keep the cop busy 😎 · ${left}`; cls = "green"; }
            else { chip = `💰 Get the stash to <b>Uncle Moishe's van</b> · ${left}`; cls = "gold"; to = g.drop; }
            const rows = GAMES.cnr.rows(g, X);
            return { chip, cls, to, rows, unit: r => r.val };
        },
        rows(g) {
            const busts = Object.values(g.out).filter(x => x === "b").length;
            return g.ps.map(u => {
                const o = g.out[u];
                const val = u === g.cop ? `🚓 ${busts} bust${busts === 1 ? "" : "s"}` : o === "d" ? "💰 got away" : o === "b" ? "🚔 busted" : "😅 still running";
                return { uid: u, val, rank: u === g.cop ? 1 : o === "d" ? 0 : o === "b" ? 3 : 2, out: o === "b", cop: u === g.cop };
            }).sort((a, b) => a.rank - b.rank);
        },
        winners(g) {
            const robbers = g.ps.filter(u => u !== g.cop), got = robbers.filter(u => g.out[u] === "d");
            return got.length * 2 >= robbers.length && got.length ? got : [g.cop];
        },
        title(g, me, rows, X) {
            const w = GAMES.cnr.winners(g);
            if (w[0] === g.cop) return g.cop === me ? "🚓 You busted the gang!" : `🚓 ${esc(X.name(g.cop))} the cop wins!`;
            return w.includes(me) ? "💰 You got away with it!" : "💰 The robbers got away!";
        },
    },

    // ── 🥘 HOT KUGEL ─────────────────────────────────────────────────────
    kugel: {
        id: "kugel", emoji: "🥘", name: "Hot Kugel", blurb: "Bump to pass it · whoever's holding it when it blows loses", min: 2,
        request() { return { pins: [] }; },
        setup(g, req, rnd) {
            if (g.ps.length < 2) return "Hot Kugel needs a friend 👯";
            Object.assign(g, { it: g.ps[Math.floor(rnd() * g.ps.length)], itN: 0, since: g.t0, held: {}, guard: g.t0 + 3000, fuse: g.t0 + 65000 + Math.round(rnd() * 30000), by: null });
            return "";
        },
        event(g, uid, k, a, t) {
            if (k !== "owk") return false;
            const v = a[2];
            if (uid !== g.it || (a[1] | 0) !== g.itN || t < g.guard - 200 || t >= g.fuse || v === uid || !g.ps.includes(v)) return false;
            g.held[uid] = (g.held[uid] || 0) + Math.round(t - g.since);
            Object.assign(g, { it: v, itN: g.itN + 1, since: Math.round(t), guard: Math.round(t + 2200), by: uid });
            return true;
        },
        tick(g, t, mem) {
            if (!mem.includes(g.it)) {                       // the holder left: it jumps to whoever's next
                const c = crew(g, mem);
                if (c.length < 1) return true;
                Object.assign(g, { it: c[g.itN % c.length], itN: g.itN + 1, since: Math.round(t), guard: Math.round(t + 2200), by: null });
                return "changed";
            }
            if (t < g.fuse) return false;
            g.held[g.it] = (g.held[g.it] || 0) + Math.round(g.fuse - g.since);
            g.loser = g.it;
            return true;
        },
        play(g, me, t, X) {
            if (me !== g.it || t < g.guard || t >= g.fuse || X.L.passed === g.itN) return;
            for (const u of g.ps) {
                if (u === me || !X.touching(u)) continue;
                X.L.passed = g.itN;
                X.send("owk", g.n, g.itN, u);
                break;
            }
        },
        hud(g, me, t, X) {
            const heat = fire((t - g.t0) / Math.max(1, g.fuse - g.t0));
            let chip, cls = "hot", to = null;
            if (t < g.t0) chip = "🥘 Hot Kugel";
            else if (g.it === me) {
                chip = t < g.guard ? `🥘 YOU'VE GOT THE KUGEL! (hands still burning…) ${heat}` : `🥘 YOU'VE GOT THE HOT KUGEL! Bump someone! ${heat}`;
                let best = Infinity; for (const u of g.ps) { if (u === me) continue; const d = dist(X.pos(u), X.pos(me)); if (d < best) { best = d; to = X.pos(u); } }
            } else { chip = `🥘 <b>${esc(X.name(g.it))}</b> has the kugel — stay away! ${heat}`; cls = ""; to = X.pos(g.it); }
            const rows = GAMES.kugel.rows(g, X, t);
            return { chip, cls, to, rows, unit: r => r.val };
        },
        rows(g, X, tNow) {
            const t = tNow != null ? tNow : g.fuse;
            const rows = g.ps.map(u => ({ uid: u, ms: (g.held[u] || 0) + (g.ph === "go" && g.it === u ? Math.max(0, Math.min(t, g.fuse) - g.since) : 0), it: g.it === u, lost: g.loser === u }));
            rows.sort((a, b) => (a.lost !== b.lost ? (a.lost ? 1 : -1) : a.ms - b.ms));
            rows.forEach(r => { r.val = r.lost ? "🥘💥 holding it!" : `🥘 ${Math.round(r.ms / 1000)} s`; r.out = r.lost; });
            return rows;
        },
        winners(g) { const r = GAMES.kugel.rows(g); return r.length ? [r[0].uid] : []; },
        title(g, me, rows, X) {
            if (g.loser === me) return "🥘💥 The kugel blew up in YOUR car!";
            return `🥘💥 KABOOM — ${esc(X.name(g.loser))} was holding it!`;
        },
    },

    // ── 📸 PHOTO HUNT ────────────────────────────────────────────────────
    photo: {
        id: "photo", emoji: "📸", name: "Photo Hunt", blurb: "Snap the town's sights · first to a sight gets a bonus", min: 1, solo: true, town: true,
        request(X) {
            if (!X.inTown()) return "Photo Hunt happens in town — take the exit 🏙️";
            const pins = X.pins(40, 5, true);
            return pins.length >= 3 ? { pins } : "Not enough sights around here 🤷";
        },
        setup(g, req, rnd) {
            const p = req.pins.slice();
            for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
            Object.assign(g, { spots: p.slice(0, 4), got: {}, first: {}, dur: 180000 });
            return "";
        },
        event(g, uid, k, a) {
            const i = a[1] | 0;
            if (k !== "owp" || !g.spots[i]) return false;
            const got = g.got[i] || (g.got[i] = []);
            if (got.includes(uid)) return false;
            got.push(uid);
            if (g.first[i] == null) g.first[i] = uid;
            return true;
        },
        tick(g, t, mem) {
            const c = crew(g, mem);
            const all = u => g.spots.every((s, i) => (g.got[i] || []).includes(u));
            return c.some(all) || t > g.t0 + g.dur || !c.length;
        },
        play(g, me, t, X) {
            if (t < g.t0) return;
            const p = X.pos(me);
            if (!p || X.speed() > 7) return;
            g.spots.forEach((s, i) => {
                if (X.L.snap[i] || (g.got[i] || []).includes(me) || !near(p, s, 18)) return;
                X.L.snap[i] = true;
                X.send("owp", g.n, i);
                X.snap(s);
            });
        },
        hud(g, me, t, X) {
            const mine = g.spots.filter((s, i) => X.L.snap[i] || (g.got[i] || []).includes(me)).length;
            let to = null, best = Infinity, next = null;
            const p = X.pos(me);
            g.spots.forEach((s, i) => { if (X.L.snap[i] || (g.got[i] || []).includes(me)) return; const d = dist(p, s); if (d < best) { best = d; to = s; next = s; } });
            const chip = next ? `📸 Photo hunt · <b>${mine}/${g.spots.length}</b> · next: ${esc(next.icon || "")} ${esc(next.name)} (stop to snap)` : `📸 Got them all! ${mine}/${g.spots.length}`;
            const rows = GAMES.photo.rows(g);
            return { chip, cls: next ? "pink" : "gold", to, rows, unit: r => r.val };
        },
        rows(g) {
            const rows = g.ps.map(u => {
                let n = 0, b = 0;
                g.spots.forEach((s, i) => { if ((g.got[i] || []).includes(u)) { n++; if (g.first[i] === u) b++; } });
                return { uid: u, n, b, pts: n + b };
            });
            rows.sort((a, b) => b.pts - a.pts);
            rows.forEach(r => { r.val = `📸 ${r.n}${r.b ? ` +${r.b}★` : ""}`; });
            return rows;
        },
        winners(g) { const r = GAMES.photo.rows(g); return r.length && r[0].pts ? [r[0].uid] : []; },
        title(g, me, rows, X) {
            if (g.ps.length === 1) return rows[0].n === g.spots.length ? "📸 Every sight, snapped!" : `📸 ${rows[0].n} of ${g.spots.length} sights`;
            return rows[0].uid === me ? "📸 Best photographer: YOU!" : `📸 ${esc(X.name(rows[0].uid))} snapped the most!`;
        },
    },
};
export const ORDER = ["cnr", "pin", "kugel", "photo"];
/** Winners of a finished game: [uid…]. */
export function winners(g) {
    const G = GAMES[g.k];
    if (G.winners) return G.winners(g);
    const r = G.rows(g);
    return r[0] && r[0].t != null ? [r[0].uid] : [];
}
