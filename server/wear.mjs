// Shared Road — 👜 LIMITED LUXURY PIECES: a world-wide stock counter (ci/clothes, roadmap 24 (f); the owner, 2026-11-27:
// "I wanted limited supply of items rather than time based" — AGENTS.md golden rule 3, third exception). ADDITIVE: new
// HTTP endpoints under /wear/* on the existing global Board object + ONE new table; rooms, presence, the board, scores,
// /homes/* and /acct/* keep their shapes. An old client never calls it.
//
// A fixed number of each limited piece exists in the whole world (LIMITED, below — the same ids and totals as
// 3d/js/features/clothes/data.js). Each copy has a number (1 … total). The server only arbitrates WHO HOLDS NUMBER N;
// coins stay on the device, like everything else. One copy of each piece per account; nothing is ever resold or traded.
//
// Buying safely (the client): reserve (the server holds the lowest free number for HOLD_MS) → the coins come off on the
// device → confirm (the number is hers for good). A hold that's never confirmed simply runs out (the number is free
// again); a confirmed copy her phone forgot comes back from /wear/mine (never charged twice). Deleting the account
// (/acct/delete) gives her copies back to the world (`releaseAll`).
//
// What is stored, per copy taken (one row): the piece id, its number, the account's random player id, held (1) or hers
// (2), until when a hold lasts, when. No name, no IP (rate limits live in memory for seconds), nothing about the person.
// Auth: an ACCOUNT (ci/accounts) — the player id + device secret whose hash accounts.mjs keeps, and a username.
//
// Storage: q(sql, ...args) → rows (the worker's doSql / node:sqlite in the local relay + tests).

/** The limited pieces and how many of each exist in the world. Keep in step with features/clothes/data.js › LIMITED. */
export const LIMITED = { jfk_bag: 25, jfk_trench: 50, jfk_wrap: 75, jfk_shades: 100 };

export const CONFIG = {
  v: 1,
  holdMs: 5 * 60000,       // a reservation lasts this long unconfirmed
  writeGapMs: 800,         // reserve / confirm / cancel: one per this per account
  ipGapMs: 250,            // … and per IP (memory only)
};

const PID_RE = /^[A-Z2-7]{16}$/;
const SEC_RE = /^[A-Za-z0-9_-]{32}$/;
async function sha(s) {
  const b = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * The counter: one per server. opts: { sechOf(pid) → the account's secret hash | null, nameOf(pid) → username | null,
 * clock, config, limited }.
 */
export function createWear(q, opts = {}) {
  const cfg = Object.assign({}, CONFIG, opts.config || {});
  const LIM = Object.assign({}, opts.limited || LIMITED);
  const clock = opts.clock || (() => Date.now());
  const hits = new Map();
  let ready = false;
  function schema() {
    if (ready) return;
    q("CREATE TABLE IF NOT EXISTS wear_limited (piece TEXT, n INTEGER, owner TEXT, st INTEGER, until INTEGER, at INTEGER, PRIMARY KEY (piece, n))");
    q("CREATE INDEX IF NOT EXISTS wear_owner ON wear_limited (owner)");
    ready = true;
  }
  function rate(key, gap, now) {
    const last = hits.get(key) || 0;
    if (now - last < gap) return false;
    hits.set(key, now);
    if (hits.size > 5000) for (const [k, t] of hits) if (now - t > 60000) hits.delete(k);
    return true;
  }
  const drop = (now) => q("DELETE FROM wear_limited WHERE st = 1 AND until < ?", now);
  function stock(now) {
    const taken = {};
    for (const r of q("SELECT piece, COUNT(*) AS c FROM wear_limited WHERE st = 2 OR (st = 1 AND until >= ?) GROUP BY piece", now)) taken[r.piece] = r.c;
    const out = {};
    for (const [p, total] of Object.entries(LIM)) out[p] = { total, left: Math.max(0, total - (taken[p] | 0)) };
    return out;
  }
  async function auth(body) {
    if (!body || !PID_RE.test(body.pid) || !SEC_RE.test(body.sec)) return null;
    const ah = opts.sechOf ? opts.sechOf(body.pid) : null;
    if (!ah || ah !== await sha(body.sec)) return null;          // (an account only — and its own secret)
    if (opts.nameOf && !opts.nameOf(body.pid)) return null;       // (…with a username)
    return body.pid;
  }
  const mine = (pid) => q("SELECT piece, n, st, until FROM wear_limited WHERE owner = ?", pid).map((r) => ({ p: r.piece, n: r.n, st: r.st, until: r.until, total: LIM[r.piece] || 0 }));
  const ok = (b) => ({ status: 200, body: b });

  async function handle(path, method, body, ip) {
    schema();
    const now = clock();
    if (path === "/wear/stock" && method === "GET") return ok({ v: cfg.v, stock: stock(now), now });
    if (method !== "POST") return { status: 404, body: { error: "not found" } };
    const pid = await auth(body);
    if (!pid) return { status: 403, body: { error: "who are you" } };
    if (path === "/wear/mine") return ok({ mine: mine(pid), stock: stock(now), now });
    const piece = String(body.p || "");
    if (!LIM[piece]) return { status: 400, body: { error: "bad piece" } };
    if (!rate("p:" + pid, cfg.writeGapMs, now) || !rate("i:" + ip, cfg.ipGapMs, now)) return { status: 429, body: { ok: false, why: "rate" } };
    // (everything below is synchronous: no other request runs in between — the Durable Object / one Node thread)
    const row = q("SELECT n, st, until FROM wear_limited WHERE owner = ? AND piece = ?", pid, piece)[0] || null;
    if (path === "/wear/reserve") {
      if (row && row.st === 2) return ok({ ok: false, why: "owned", n: row.n, total: LIM[piece] });
      if (row) {   // her own hold again: it lasts from now
        q("UPDATE wear_limited SET until = ? WHERE piece = ? AND n = ?", now + cfg.holdMs, piece, row.n);
        return ok({ ok: true, n: row.n, total: LIM[piece], until: now + cfg.holdMs });
      }
      drop(now);
      const used = new Set(q("SELECT n FROM wear_limited WHERE piece = ?", piece).map((r) => r.n));
      let n = 0;
      for (let k = 1; k <= LIM[piece]; k++) if (!used.has(k)) { n = k; break; }
      if (!n) return ok({ ok: false, why: "soldout", total: LIM[piece], left: 0 });
      q("INSERT INTO wear_limited (piece, n, owner, st, until, at) VALUES (?, ?, ?, 1, ?, ?)", piece, n, pid, now + cfg.holdMs, now);
      return ok({ ok: true, n, total: LIM[piece], until: now + cfg.holdMs });
    }
    if (path === "/wear/confirm") {
      if (row && row.st === 2) return ok({ ok: true, n: row.n, total: LIM[piece], already: true });
      // (a hold past its time still counts while nobody took its number — the coins already moved on her phone)
      if (!row) return ok({ ok: false, why: "expired" });
      q("UPDATE wear_limited SET st = 2, until = 0, at = ? WHERE piece = ? AND n = ?", now, piece, row.n);
      return ok({ ok: true, n: row.n, total: LIM[piece] });
    }
    if (path === "/wear/cancel") {
      if (row && row.st === 1) q("DELETE FROM wear_limited WHERE piece = ? AND n = ?", piece, row.n);
      return ok({ ok: true });
    }
    return { status: 404, body: { error: "not found" } };
  }
  /** An account was deleted: its copies go back to the world. */
  function releaseAll(pid) { schema(); if (PID_RE.test(pid)) q("DELETE FROM wear_limited WHERE owner = ?", pid); }
  return { handle, releaseAll, schema, config: () => ({ v: cfg.v, holdMs: cfg.holdMs }), limited: LIM };
}
