// Shared Road — 🌍 ONE SHARED WORLD, the wire (ci/oneserver; the owner approved the plan 2026-11-27: "Go ahead with
// this" — AGENTS.md golden rule 3, fourth exception; 3d/docs/oneserver-plan.md). Used by BOTH relays (mp-worker.js's
// Room + local-relay.js) so they can't drift. Everything here is ADDITIVE: old clients ignore the new fields and never
// send the new message.
//
//  STEP 1 — ONE CLOCK: the hello (`h`) and the pong (`po`) carry `st` = the server's milliseconds; a pong echoes the
//   ping's `n`. Clients estimate the server clock from their fastest round trips (3d/js/core/worldclock.js).
//  STEP 2 — RELIABLE EVENTS + SERVER TIMESTAMPS: every passed-on state (`s`) carries `st` (when the relay got it);
//   a new message `r` = { id, k, d } (≤ 512 bytes, ≤ 4 a second per player) is passed on ONCE as
//   { t: "r", from, id, k, d, st }, acknowledged to the sender ({ t: "ra", id, st }), and the room keeps the last 32 for
//   20 s so a player who arrives late (or reconnects) gets them in her hello (`h.r`). Receivers drop duplicates by
//   from + id.
//  KILL SWITCHES: `WORLD` below, served (with the server time) at GET /world/config — a game only uses a step whose flag
//   is on. Off = today's behaviour. A flag changes with a one-line deploy.
//  THE FREE-PLAN BUDGET: rooms count what they receive and tell the Board now and then; GET /world/usage (?text=1 for a
//   sentence) says how much of today's free allowance is used; when the Durable Objects are over it, /world/usage
//   answers 503 { resting: 1 } so a game can say "online is resting until midnight UTC" instead of failing silently.

export const WORLD = { v: 1, clock: 1, reliable: 1, place: 1, claims: 0 };   // place: 1 — the owner approved step 3 on the Free plan, 2026-11-27

export const REL = { maxBytes: 512, perSec: 4, keep: 32, keepMs: 20000 };
export const FREE = { doRequests: 100000, workerRequests: 100000, wsRatio: 20 };
const ID_RE = /^[A-Za-z0-9]{1,16}$/;
const K_RE = /^[a-z0-9_]{1,12}$/;
const N_RE = /^[A-Za-z0-9]{1,12}$/;

/** The pong for a ping (step 1). */
export function pong(msg, now) {
  const o = { t: "po", st: now };
  if (msg && typeof msg.n === "string" && N_RE.test(msg.n)) o.n = msg.n;
  return o;
}

/** A reliable event from a client → the clean event, or null (dropped). */
export function cleanEvent(msg, fromId, now) {
  if (!WORLD.reliable || !msg || !ID_RE.test(msg.id) || !K_RE.test(msg.k)) return null;
  const d = msg.d == null ? null : msg.d;
  if (d !== null && (typeof d !== "object" || Array.isArray(d))) return null;
  const ev = { t: "r", from: fromId, id: msg.id, k: msg.k, d, st: now };
  if (JSON.stringify(ev).length > REL.maxBytes + 64) return null;
  return ev;
}

/** Per-socket limit for reliable events: ≤ REL.perSec in any 1 s window. `slot` is any object kept with the socket. */
export function relAllowed(slot, now) {
  if (!slot.rw || now - slot.rw.at >= 1000) slot.rw = { at: now, n: 0 };
  if (slot.rw.n >= REL.perSec) return false;
  slot.rw.n++;
  return true;
}

/** The room's memory of recent events (in memory: a room with players in it doesn't hibernate). */
export function remember(list, ev) {
  list.push(ev);
  while (list.length > REL.keep) list.shift();
}
export function recent(list, now) {
  while (list.length && now - list[0].st > REL.keepMs) list.shift();
  return list.slice();
}

/** The free-plan estimate from the day's counts. */
export function usageOf(row, now) {
  const r = row || { day: dayOf(now), ws: 0, conn: 0, http: 0 };
  const doReq = Math.round(r.conn + r.ws / FREE.wsRatio + r.http);
  const wkReq = r.conn + r.http;
  const pct = Math.max(doReq / FREE.doRequests, wkReq / FREE.workerRequests) * 100;
  const reset = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() + 1);
  return { day: r.day, wsMessages: r.ws, connections: r.conn, httpRequests: r.http, doRequests: doReq, workerRequests: wkReq,
    freeDoRequests: FREE.doRequests, freeWorkerRequests: FREE.workerRequests, pct: Math.round(pct * 10) / 10,
    playerHours: Math.round(r.ws / 18000 * 10) / 10, resetAt: reset, resetInMin: Math.round((reset - now) / 60000) };
}
export const dayOf = (now) => new Date(now).toISOString().slice(0, 10);
export function usageText(u) {
  const h = Math.floor(u.resetInMin / 60), m = u.resetInMin % 60;
  return `Today (UTC ${u.day}): about ${u.pct} % of the free daily allowance is used ` +
    `(${u.doRequests.toLocaleString("en-US")} of ${u.freeDoRequests.toLocaleString("en-US")} relay requests; ` +
    `about ${u.playerHours} player-hours of online play). It resets in ${h} h ${m} min (midnight UTC).\n`;
}

// ── STEP 3 — ROOMS BY PLACE (built; NOT to be used on the Free plan — the owner switches to Paid first) ──
// Place rooms are named "W…" (a lap segment, a town, JFK, a rest area, a building). They hold PLACE.cap players (40,
// then the game opens "…B"); a join with { lo: 1 } is a LISTENER: it gets everything said in the room, says nothing,
// isn't announced or listed and doesn't count toward the cap (≤ PLACE.listenCap) — a game near a segment boundary
// listens to the next one, so crossing it has no blink. Listening costs nothing (messages out are free).
export const PLACE = { cap: 40, listenCap: 40 };
export const isPlaceRoom = (room) => /^W[A-Z0-9]{1,11}$/.test(String(room || ""));
export const capFor = (room, legacyCap) => (isPlaceRoom(room) ? PLACE.cap : legacyCap);
