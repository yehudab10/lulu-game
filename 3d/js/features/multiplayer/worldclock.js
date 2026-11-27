// features/multiplayer/worldclock.js — 🌍 THE WORLD CLOCK (ci/oneserver step 1; the owner, 2026-11-27: "friends and
// everyone… as if they are in the same world"). Every game estimates the RELAY's clock, so anything computed from
// (a seed, the time) — traffic loops, townspeople, the sky, events — can be the same on every screen. The client half
// that USES it (the world seed for traffic / people / weather) is ci/friends'; this file only says what time it is.
//
//   ctx.worldClock.now()       the server's milliseconds, estimated (Date.now() + offset)
//   .synced / .offset / .rtt   whether it's been measured; the offset from this device's clock (ms); the best round trip
//   .flags                     the relay's kill switches (GET /world/config): { clock, reliable, place, claims } — a
//                              step whose flag is 0 isn't used; null = an older relay (nothing new is used)
//   .resting                   the relay is over its free daily allowance (until .restUntil, midnight UTC)
// How: the relay's hello / pong carry `st` (its ms). A sample = st + rtt/2 − the local time it arrived; the one with the
// FASTEST round trip in the last 2 minutes wins (the same method as the party's host clock); the offset slews ≤ 2 ms per
// 100 ms so nothing on screen jumps, except a first sync or a jump > 1.5 s. Feeds: multiplayer/net.js's pings (6 quick
// ones on each connect, then the old 25 s heartbeat) and GET /world/config (boot + every 10 min) as a coarse fallback.
// Cost on the free plan: 6 more messages per connection (a player-hour is ~18,000) and one Worker request per 10 min.
import { ctx, emit } from "../../core/ctx.js";

const QS = new URLSearchParams(location.search);
const WC = { off: 0, target: 0, synced: false, samples: [], rtt: -1, flags: null, resting: false, restUntil: 0, base: "", cfgAt: -1e9, checking: false };

export function now() { return Date.now() + WC.off; }
/** A clock sample: the server said `st`; it arrived `rtt` ms after we asked, at local time `at`. */
export function addSample(st, rtt, at = Date.now(), weak = false) {
    if (typeof st !== "number" || !isFinite(st) || !(rtt >= 0) || rtt > 10000) return;
    const t = Date.now();
    WC.samples.push({ off: st + rtt / 2 - at, rtt: rtt + (weak ? 1000 : 0), at: t });
    WC.samples = WC.samples.filter(s => t - s.at < 120000).slice(-16);
    let best = null;
    for (const s of WC.samples) if (!best || s.rtt < best.rtt) best = s;
    WC.target = best.off; WC.rtt = Math.round(best.rtt);
    if (!WC.synced || Math.abs(WC.target - WC.off) > 1500) { WC.off = WC.target; if (!WC.synced) { WC.synced = true; emit("world:clock", { off: WC.off, rtt: WC.rtt }); } }
}
setInterval(() => { if (!WC.synced) return; const e = WC.target - WC.off; WC.off += Math.max(-2, Math.min(2, e)); }, 100);

export function setBase(httpBase) { WC.base = httpBase || ""; }
const allowed = () => !!WC.base && (!ctx.TEST || !!QS.get("mpurl"));
/** GET /world/config: the kill switches + a coarse clock sample. */
export async function config(force = false) {
    if (!allowed() || (!force && Date.now() - WC.cfgAt < 600000)) return WC.flags;
    WC.cfgAt = Date.now();
    try {
        const t0 = performance.now(), at0 = Date.now();
        const r = await fetch(WC.base + "/world/config", { cache: "no-store" });
        const rtt = performance.now() - t0;
        if (!r.ok) { WC.flags = null; return null; }
        const j = await r.json();
        WC.flags = j && j.world && typeof j.world === "object" ? j.world : null;
        if (j && typeof j.st === "number") addSample(j.st, rtt, at0 + rtt, true);   // (HTTP: weaker than a socket ping)
        emit("world:flags", { flags: WC.flags });
    } catch (e) { /* offline: keep what we had */ }
    return WC.flags;
}
export const flag = k => !!(WC.flags && WC.flags[k]);

/** The relay keeps refusing: is it the free daily allowance? (GET /world/usage answers 503 { resting } then) */
export async function checkResting() {
    if (!allowed() || WC.checking) return WC.resting;
    WC.checking = true;
    try {
        const r = await fetch(WC.base + "/world/usage", { cache: "no-store" });
        const j = await r.json().catch(() => null);
        const was = WC.resting;
        WC.resting = r.status === 503 && !!(j && j.resting);
        WC.restUntil = WC.resting ? Number(j.resetAt) || 0 : 0;
        if (WC.resting !== was) emit("world:resting", { resting: WC.resting, until: WC.restUntil });
    } catch (e) { /* the Worker itself is unreachable: just offline */ }
    WC.checking = false;
    return WC.resting;
}
export function clearResting() { if (WC.resting) { WC.resting = false; WC.restUntil = 0; emit("world:resting", { resting: false }); } }

ctx.worldClock = {
    now,
    get synced() { return WC.synced; },
    get offset() { return Math.round(WC.off); },
    get rtt() { return WC.rtt; },
    get flags() { return WC.flags; },
    get resting() { return WC.resting; },
    get restUntil() { return WC.restUntil; },
    info: () => ({ off: Math.round(WC.off), target: Math.round(WC.target), synced: WC.synced, rtt: WC.rtt, samples: WC.samples.length, flags: WC.flags, resting: WC.resting }),
};
