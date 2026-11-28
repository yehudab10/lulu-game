// Shared Road — 🪪 PLAYER ACCOUNTS: unique usernames, a friends list + friend requests that wait for an offline player,
// blocks and name reports (ci/accounts; the owner, 2026-11-26: "add real usernames … unique … make the friends thing
// work even if a player is offline … do the changes necessary even server side" — AGENTS.md golden rule 3, second
// exception). ADDITIVE: new HTTP endpoints under /acct/* on the existing global Board object + new tables; rooms,
// presence, the board, scores and /homes/* keep their shapes. An old client never calls any of it.
//
// ONE account = the player id + device secret the game already has (core/player.js; /homes/hello uses the same pair):
// a random public id (16 base32 chars) and a SHA-256 hash of the secret (never the secret). The 💾 save code carries
// both, so a new phone is the same account.
//
// What is stored — nothing else:
//   accounts  pid, secret hash, username + its normalised form, generated-name flag, "please pick a name" flag,
//             made / last seen / last renamed times, who-can-send-requests (0 everyone · 1 friends of friends ·
//             2 nobody), the friendship PUBLIC key (pk: ECDH P-256, lets two friends seal their doorbell note), when the
//             on-device list was first synced (mig)
//   edges     a friendship (a < b), since when, and each side's SEALED doorbell note for the other (only those two
//             phones can open it: AES-GCM under their ECDH secret — the server can't read it)
//   requests  who asked whom, when, and when it was declined (a decline is silent and stops re-asks for 30 days)
//   claims    "my phone already lists X as a friend" (the migration of on-device friendships) until X says the same
//   blocks    who blocked whom, when
//   reports   who reported whose NAME, when (counted, then cleared when the name changes)
//   retired   normalised names taken away after reports (nobody can take them again)
//   acct_meta the ticket key (random, made on first use — no deploy secret)
// No IP is stored (rate limits live in memory for minutes), no email, no real name, no contacts, no location.
//
// The rules for names are 3d/js/features/accounts/rules.js — the SAME file the game uses for instant feedback; the
// server's answer is the one that counts.
import * as R from "../3d/js/features/accounts/rules.js";

export const CONFIG = {
  v: 1,
  renameDays: 30,          // a username can change once per this (a first pick / a replaced name: free)
  friendCap: 30,           // friends per player (the game's list holds 30)
  outCap: 20,              // requests one player can have waiting
  inCap: 30,               // requests one player can have waiting FOR them (more are quietly not stored)
  askPerHour: 10,          // friend requests sent per account per hour
  askPerHourIp: 30,        // … per IP (memory only)
  declineDays: 30,         // a declined request blocks a re-ask this long
  requestDays: 60,         // an unanswered request expires
  reportNeed: 3,           // different accounts reporting a name → it's replaced
  reportDays: 14,          // … within this many days
  reportMinAgeMs: 86400000, // a reporting account must be at least this old (no throw-away accounts)
  reportPerDay: 5,         // reports one account can make a day
  blockCap: 200,
  claimCap: 60,
  ticketMs: 6 * 3600000,   // how long a name ticket lasts (bound to one relay room + connection)
  maxAccounts: 500000,
  idleUnnamedDays: 60,     // an account that never picked a name and wasn't seen this long is dropped
  checkGapMs: 200,         // name checks per IP
  writeGapMs: 400,         // name / ask / answer / remove / block / report / set per account
};

const PID_RE = /^[A-Z2-7]{16}$/;
const SEC_RE = /^[A-Za-z0-9_-]{32}$/;
const B64_RE = /^[A-Za-z0-9_-]{16,700}$/;
const ROOM_RE = /^[A-Z0-9]{1,12}$/;
const RID_RE = /^[A-Za-z0-9]{1,16}$/;
const DAY = 86400000;
const enc = new TextEncoder();

async function sha(s) {
  const b = await globalThis.crypto.subtle.digest("SHA-256", enc.encode(String(s)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function b64(bytes) {
  let s = ""; const u = new Uint8Array(bytes);
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const pair = (x, y) => (x < y ? [x, y] : [y, x]);

/**
 * The accounts service. `q(sql, ...args)` runs one SQL statement and returns its rows as an array (the worker:
 * state.storage.sql.exec(...).toArray(); the local relay: node:sqlite). → { handle(path, method, body, ip), schema() }
 */
export function createAccounts(q, opts = {}) {
  const cfg = Object.assign({}, CONFIG, opts.config || {});
  const clock = opts.clock || (() => Date.now());
  const homeSech = opts.homeSech || (() => null);      // pid → the homes registry's secret hash (an account must match it)
  const hits = new Map();                              // rate limits: key → last ms / [window start, count]
  let ready = false, lastSweep = 0, tkey = null;

  function schema() {
    if (ready) return;
    q("CREATE TABLE IF NOT EXISTS accounts (pid TEXT PRIMARY KEY, sech TEXT, name TEXT, norm TEXT UNIQUE, gen INTEGER DEFAULT 0, ask INTEGER DEFAULT 0, made INTEGER, seen INTEGER, named INTEGER DEFAULT 0, who INTEGER DEFAULT 0, pk TEXT, mig INTEGER DEFAULT 0)");
    q("CREATE TABLE IF NOT EXISTS edges (a TEXT, b TEXT, at INTEGER, ca TEXT, cb TEXT, PRIMARY KEY (a, b))");
    q("CREATE INDEX IF NOT EXISTS edges_b ON edges (b)");
    q("CREATE TABLE IF NOT EXISTS requests (src TEXT, dst TEXT, at INTEGER, no INTEGER DEFAULT 0, PRIMARY KEY (src, dst))");
    q("CREATE INDEX IF NOT EXISTS requests_dst ON requests (dst)");
    q("CREATE TABLE IF NOT EXISTS claims (src TEXT, dst TEXT, at INTEGER, PRIMARY KEY (src, dst))");
    q("CREATE INDEX IF NOT EXISTS claims_dst ON claims (dst)");
    q("CREATE TABLE IF NOT EXISTS blocks (src TEXT, dst TEXT, at INTEGER, PRIMARY KEY (src, dst))");
    q("CREATE INDEX IF NOT EXISTS blocks_dst ON blocks (dst)");
    q("CREATE TABLE IF NOT EXISTS reports (src TEXT, dst TEXT, at INTEGER, PRIMARY KEY (src, dst))");
    q("CREATE INDEX IF NOT EXISTS reports_dst ON reports (dst)");
    q("CREATE TABLE IF NOT EXISTS retired (norm TEXT PRIMARY KEY, at INTEGER)");
    q("CREATE TABLE IF NOT EXISTS acct_meta (k TEXT PRIMARY KEY, v TEXT)");
    ready = true;
  }

  // ── rate limits (memory only) ──
  function gap(key, ms, now) {
    const last = hits.get(key) || 0;
    if (now - last < ms && now >= last) return false;           // (a clock that went back never locks anyone out)
    hits.set(key, now);
    prune(now);
    return true;
  }
  function quota(key, max, windowMs, now) {
    let w = hits.get(key);
    if (!Array.isArray(w) || now - w[0] > windowMs) { w = [now, 0]; hits.set(key, w); }
    if (w[1] >= max) return false;
    w[1]++;
    prune(now);
    return true;
  }
  function prune(now) {
    if (hits.size < 20000) return;
    for (const [k, v] of hits) if (now - (Array.isArray(v) ? v[0] : v) > 3600000) hits.delete(k);
  }

  // ── small queries ──
  const acct = (pid) => q("SELECT * FROM accounts WHERE pid = ?", pid)[0] || null;
  const byNorm = (n) => q("SELECT * FROM accounts WHERE norm = ?", n)[0] || null;
  const friendsOf = (pid) => q("SELECT a, b, at, ca, cb FROM edges WHERE a = ? OR b = ?", pid, pid);
  const friendIds = (pid) => friendsOf(pid).map((e) => (e.a === pid ? e.b : e.a));
  const edge = (x, y) => { const [a, b] = pair(x, y); return q("SELECT * FROM edges WHERE a = ? AND b = ?", a, b)[0] || null; };
  function makeEdge(x, y, now) {
    const [a, b] = pair(x, y);
    q("INSERT OR IGNORE INTO edges (a, b, at) VALUES (?, ?, ?)", a, b, now);
    q("DELETE FROM requests WHERE (src = ? AND dst = ?) OR (src = ? AND dst = ?)", x, y, y, x);
    q("DELETE FROM claims WHERE (src = ? AND dst = ?) OR (src = ? AND dst = ?)", x, y, y, x);
  }
  function cut(x, y) {
    const [a, b] = pair(x, y);
    q("DELETE FROM edges WHERE a = ? AND b = ?", a, b);
    q("DELETE FROM claims WHERE (src = ? AND dst = ?) OR (src = ? AND dst = ?)", x, y, y, x);
  }
  const blocked = (x, y) => q("SELECT 1 AS k FROM blocks WHERE (src = ? AND dst = ?) OR (src = ? AND dst = ?)", x, y, y, x).length > 0;
  const nameOf = (pid) => { const r = acct(pid); return r && r.name ? r.name : null; };

  function sweep(now) {
    if (now - lastSweep < 10 * 60000) return;
    lastSweep = now;
    q("DELETE FROM requests WHERE (no = 0 AND at < ?) OR (no > 0 AND no < ?)", now - cfg.requestDays * DAY, now - cfg.declineDays * DAY);
    q("DELETE FROM claims WHERE at < ?", now - 180 * DAY);
    q("DELETE FROM reports WHERE at < ?", now - cfg.reportDays * DAY);
    q("DELETE FROM accounts WHERE name IS NULL AND seen < ?", now - cfg.idleUnnamedDays * DAY);
  }

  // ── tickets: "this relay connection is account X" (HMAC with a key made on first use and kept in the table) ──
  async function key() {
    if (tkey) return tkey;
    let row = q("SELECT v FROM acct_meta WHERE k = 'tk'")[0];
    if (!row) {
      const raw = b64(globalThis.crypto.getRandomValues(new Uint8Array(32)));
      q("INSERT OR IGNORE INTO acct_meta (k, v) VALUES ('tk', ?)", raw);
      row = q("SELECT v FROM acct_meta WHERE k = 'tk'")[0];
    }
    const s = String(row.v).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(s + "===".slice((s.length + 3) % 4));
    const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    tkey = await globalThis.crypto.subtle.importKey("raw", u, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return tkey;
  }
  async function mac(pid, room, rid, exp) {
    const sig = await globalThis.crypto.subtle.sign("HMAC", await key(), enc.encode(`${pid}|${room}|${rid}|${exp}`));
    return b64(new Uint8Array(sig).slice(0, 16));
  }
  async function ticketPid(t, room, rid, now) {
    const m = /^([A-Z2-7]{16})\.([0-9a-z]{1,10})\.([A-Za-z0-9_-]{22})$/.exec(String(t || ""));
    if (!m || !ROOM_RE.test(room) || !RID_RE.test(rid)) return null;
    const exp = parseInt(m[2], 36);
    if (!(exp > now) || exp > now + cfg.ticketMs + 60000) return null;
    return (await mac(m[1], room, rid, m[2])) === m[3] ? m[1] : null;
  }

  // ── names ──
  function free(name, selfPid) {
    const n = R.norm(name);
    if (q("SELECT 1 AS k FROM retired WHERE norm = ?", n).length) return "retired";
    const other = byNorm(n);
    return other && other.pid !== selfPid ? "taken" : "";
  }
  function why(name, selfPid) { return R.check(name) || free(name, selfPid); }
  function suggest(base, selfPid, n = 3) {
    const out = [];
    for (let round = 0; round < 3 && out.length < n; round++) {
      for (const s of R.ideas(round < 2 ? base : "", 12)) {
        if (out.length >= n) break;
        if (!out.some((o) => R.norm(o) === R.norm(s)) && !free(s, selfPid)) out.push(s);
      }
    }
    return out;
  }
  function generatedName(selfPid) {
    for (let k = 0; k < 40; k++) { const g = R.generated(); if (!R.check(g) && !free(g, selfPid)) return g; }
    return "Knish" + Date.now().toString(36).slice(-6);
  }
  const nextRename = (row) => (!row.name || row.gen || row.ask || !row.named ? 0 : row.named + cfg.renameDays * DAY);

  // ── auth ──
  /** → { pid, sech, row } (row null: no account yet) | null (bad / someone else's secret) */
  async function who(body) {
    if (!body || !PID_RE.test(body.pid) || !SEC_RE.test(body.sec)) return null;
    const h = await sha(body.sec);
    const row = acct(body.pid);
    if (row) return row.sech === h ? { pid: body.pid, sech: h, row } : null;
    const hs = homeSech(body.pid);
    if (hs && hs !== h) return null;
    return { pid: body.pid, sech: h, row: null };
  }

  /** Everything the game needs to show: me, friends, requests, blocks. */
  function view(pid, now) {
    const row = acct(pid);
    const es = friendsOf(pid);
    const ids = es.map((e) => (e.a === pid ? e.b : e.a));
    const info = new Map();
    for (const id of ids) info.set(id, acct(id));
    const friends = es.map((e) => {
      const f = e.a === pid ? e.b : e.a, r = info.get(f);
      return { f, n: (r && r.name) || null, pk: (r && r.pk) || null, c: (e.a === pid ? e.cb : e.ca) || null, mine: !!(e.a === pid ? e.ca : e.cb), at: e.at };
    });
    const inReq = q("SELECT src, at FROM requests WHERE dst = ? AND no = 0 ORDER BY at DESC LIMIT 40", pid).map((r) => ({ f: r.src, n: nameOf(r.src), at: r.at }));
    const outReq = q("SELECT dst, at FROM requests WHERE src = ? ORDER BY at DESC LIMIT 40", pid).map((r) => ({ f: r.dst, n: nameOf(r.dst), at: r.at }));
    const blocks = q("SELECT dst, at FROM blocks WHERE src = ? ORDER BY at DESC LIMIT ?", pid, cfg.blockCap).map((r) => ({ f: r.dst, n: nameOf(r.dst), at: r.at }));
    const claims = q("SELECT dst FROM claims WHERE src = ?", pid).map((r) => r.dst);
    return {
      me: { pid, name: row.name || null, gen: row.gen ? 1 : 0, ask: row.ask ? 1 : 0, next: nextRename(row), who: row.who || 0, made: row.made },
      friends, inReq, outReq, blocks, claims, badge: inReq.length, now,
    };
  }
  const pubCfg = () => ({ v: cfg.v, min: R.MIN, max: R.MAX, renameDays: cfg.renameDays, friendCap: cfg.friendCap, outCap: cfg.outCap, reportNeed: cfg.reportNeed });

  async function handle(path, method, body, ip) {
    schema();
    const now = clock();
    sweep(now);
    ip = String(ip || "0");
    if (path === "/acct/config" && method === "GET") return ok({ cfg: pubCfg(), now });
    if (path === "/acct/check" && method === "GET") {
      if (!gap("c:" + ip, cfg.checkGapMs, now)) return { status: 429, body: { ok: false, why: "slow" } };
      const n = String((body && body.n) || "").slice(0, 40);
      if (!n) return ok({ ok: false, why: "", sugg: suggest("", null) });
      const w = why(n, body && PID_RE.test(body.pid) ? body.pid : null);
      return ok({ ok: !w, why: w, sugg: w ? suggest(n, null) : [] });
    }
    if (method !== "POST") return { status: 404, body: { error: "not found" } };

    // names for the tickets other players carry (no account needed: it's what a ghost's label shows)
    if (path === "/acct/names") {
      const list = Array.isArray(body && body.q) ? body.q.slice(0, 30) : [];
      if (!gap("n:" + ip, 250, now)) return { status: 429, body: { error: "slow" } };
      const out = [];
      for (const e of list) {
        const [room, rid, t] = Array.isArray(e) ? e.map(String) : [];
        const pid = await ticketPid(t, room, rid, now);
        out.push(pid ? nameOf(pid) : null);
      }
      return ok({ n: out });
    }

    const me = await who(body);
    if (!me) return { status: 403, body: { error: "who are you" } };

    if (path === "/acct/hello") {
      if (!gap("h:" + me.pid, cfg.writeGapMs, now)) return { status: 429, body: { error: "slow" } };
      if (!me.row) {
        if ((q("SELECT COUNT(*) AS n FROM accounts")[0] || {}).n >= cfg.maxAccounts) return { status: 503, body: { error: "full" } };
        q("INSERT OR IGNORE INTO accounts (pid, sech, made, seen) VALUES (?, ?, ?, ?)", me.pid, me.sech, now, now);
      } else q("UPDATE accounts SET seen = ? WHERE pid = ?", now, me.pid);
      if (typeof body.pk === "string" && B64_RE.test(body.pk) && body.pk.length <= 120) q("UPDATE accounts SET pk = ? WHERE pid = ?", body.pk, me.pid);
      if (Array.isArray(body.claims)) {
        // the migration: "my phone lists these as friends" — mutual claims become a friendship; nothing one-sided shows
        const mine = new Set(friendIds(me.pid));
        let have = q("SELECT COUNT(*) AS n FROM claims WHERE src = ?", me.pid)[0].n;
        for (const f of body.claims.slice(0, 40)) {
          if (!PID_RE.test(f) || f === me.pid || mine.has(f) || blocked(me.pid, f)) continue;
          if (q("SELECT 1 AS k FROM claims WHERE src = ? AND dst = ?", f, me.pid).length) {
            if (mine.size < cfg.friendCap && friendIds(f).length < cfg.friendCap) { makeEdge(me.pid, f, now); mine.add(f); }
          } else if (have < cfg.claimCap && !q("SELECT 1 AS k FROM claims WHERE src = ? AND dst = ?", me.pid, f).length) {
            q("INSERT INTO claims (src, dst, at) VALUES (?, ?, ?)", me.pid, f, now); have++;
          }
        }
        q("UPDATE accounts SET mig = ? WHERE pid = ? AND mig = 0", now, me.pid);
      }
      if (body.cards && typeof body.cards === "object") {
        // my sealed doorbell note for each friend (only that friend can open it)
        for (const [f, c] of Object.entries(body.cards).slice(0, cfg.friendCap)) {
          if (!PID_RE.test(f) || typeof c !== "string" || !B64_RE.test(c)) continue;
          const [a, b] = pair(me.pid, f);
          q(`UPDATE edges SET ${a === me.pid ? "ca" : "cb"} = ? WHERE a = ? AND b = ?`, c, a, b);
        }
      }
      return ok(Object.assign(view(me.pid, now), { cfg: pubCfg() }));
    }
    if (!me.row) return { status: 403, body: { error: "no account" } };
    const row = me.row;
    if (!gap("w:" + me.pid, cfg.writeGapMs, now)) return { status: 429, body: { ok: false, why: "slow" } };

    if (path === "/acct/name") {
      const name = String(body.name || "");
      const w = why(name, me.pid);
      if (w) return ok({ ok: false, why: w, sugg: suggest(name, me.pid) });
      const nx = nextRename(row);
      if (row.name === name) { q("UPDATE accounts SET ask = 0 WHERE pid = ?", me.pid); return ok({ ok: true, name, next: nx }); }
      if (nx > now) return ok({ ok: false, why: "wait", next: nx });
      try {
        q("UPDATE accounts SET name = ?, norm = ?, gen = 0, ask = 0, named = ? WHERE pid = ?", name, R.norm(name), now, me.pid);
      } catch (e) { return ok({ ok: false, why: "taken", sugg: suggest(name, me.pid) }); }
      q("DELETE FROM reports WHERE dst = ?", me.pid);           // a new name starts with a clean slate
      return ok({ ok: true, name, next: now + cfg.renameDays * DAY });
    }
    if (path === "/acct/set") {
      const w = Number(body.who);
      if (![0, 1, 2].includes(w)) return { status: 400, body: { error: "bad" } };
      q("UPDATE accounts SET who = ? WHERE pid = ?", w, me.pid);
      return ok({ ok: true, who: w });
    }
    if (path === "/acct/ticket") {
      const room = String(body.room || ""), rid = String(body.rid || "");
      if (!ROOM_RE.test(room) || !RID_RE.test(rid)) return { status: 400, body: { error: "bad" } };
      if (!row.name) return ok({ t: null });
      const exp = (now + cfg.ticketMs).toString(36);
      return ok({ t: `${me.pid}.${exp}.${await mac(me.pid, room, rid, exp)}`, exp: parseInt(exp, 36) });
    }
    if (path === "/acct/delete") {
      const p = me.pid;
      q("DELETE FROM edges WHERE a = ? OR b = ?", p, p);
      q("DELETE FROM requests WHERE src = ? OR dst = ?", p, p);
      q("DELETE FROM claims WHERE src = ? OR dst = ?", p, p);
      q("DELETE FROM blocks WHERE src = ? OR dst = ?", p, p);
      q("DELETE FROM reports WHERE src = ? OR dst = ?", p, p);
      q("DELETE FROM accounts WHERE pid = ?", p);
      // (👜 her numbered limited pieces go back to the world — wear.mjs, ci/clothes)
      if (opts.onDelete) { try { opts.onDelete(p); } catch (e) { /* the account is gone either way */ } }
      // (her houses are game progress on the same random id, like her coins — they stay hers; the registry stores no name)
      return ok({ ok: true });
    }

    // everything below names another player: f (an account id), or `to` (a username), or a ticket (t + room + rid)
    let f = PID_RE.test(body.f) ? body.f : null;
    if (!f && typeof body.to === "string" && body.to.length <= 40) { const r = byNorm(R.norm(body.to)); f = r ? r.pid : null; }
    if (!f && body.t) f = await ticketPid(body.t, String(body.room || ""), String(body.rid || ""), now);

    if (path === "/acct/ask") {
      if (!f) return ok({ ok: false, why: "none" });
      if (f === me.pid) return ok({ ok: false, why: "self" });
      if (!quota("a:" + me.pid, cfg.askPerHour, 3600000, now) || !quota("ai:" + ip, cfg.askPerHourIp, 3600000, now)) return { status: 429, body: { ok: false, why: "slow" } };
      const them = acct(f);
      if (!them || !them.name) return ok({ ok: false, why: "none" });
      if (edge(me.pid, f)) return ok({ ok: true, why: "friends", f, n: them.name });
      if (blocked(me.pid, f)) return ok({ ok: true, why: "sent", f, n: them.name });   // (never tell anyone they're blocked)
      const back = q("SELECT * FROM requests WHERE src = ? AND dst = ?", f, me.pid)[0];
      const mineN = friendIds(me.pid).length;
      if (back && !back.no) {                                    // they asked me first: that's a yes both ways
        if (mineN >= cfg.friendCap) return ok({ ok: false, why: "full" });
        if (friendIds(f).length >= cfg.friendCap) return ok({ ok: false, why: "busy" });
        makeEdge(me.pid, f, now);
        return ok({ ok: true, why: "friends", f, n: them.name });
      }
      const mineReq = q("SELECT * FROM requests WHERE src = ? AND dst = ?", me.pid, f)[0];
      if (mineReq) return ok({ ok: true, why: "sent", f, n: them.name });                // (a declined one too: silent)
      if (them.who === 2) return ok({ ok: false, why: "closed" });
      if (them.who === 1) {
        const mine = new Set(friendIds(me.pid));
        if (!friendIds(f).some((x) => mine.has(x))) return ok({ ok: false, why: "closed" });
      }
      if (mineN >= cfg.friendCap) return ok({ ok: false, why: "full" });
      if (q("SELECT COUNT(*) AS n FROM requests WHERE src = ? AND no = 0", me.pid)[0].n >= cfg.outCap) return ok({ ok: false, why: "outfull" });
      if (friendIds(f).length >= cfg.friendCap || q("SELECT COUNT(*) AS n FROM requests WHERE dst = ? AND no = 0", f)[0].n >= cfg.inCap) return ok({ ok: false, why: "busy" });
      q("INSERT INTO requests (src, dst, at, no) VALUES (?, ?, ?, 0)", me.pid, f, now);
      return ok({ ok: true, why: "sent", f, n: them.name });
    }
    if (!f) return { status: 400, body: { error: "who" } };
    if (path === "/acct/answer") {
      const r = q("SELECT * FROM requests WHERE src = ? AND dst = ? AND no = 0", f, me.pid)[0];
      if (!r) return ok({ ok: false, why: "gone" });
      if (!body.yes) { q("UPDATE requests SET no = ? WHERE src = ? AND dst = ?", now, f, me.pid); return ok({ ok: true, why: "declined" }); }
      if (friendIds(me.pid).length >= cfg.friendCap) return ok({ ok: false, why: "full" });
      if (friendIds(f).length >= cfg.friendCap) return ok({ ok: false, why: "busy" });
      makeEdge(me.pid, f, now);
      return ok({ ok: true, why: "friends", n: nameOf(f) });
    }
    if (path === "/acct/cancel") {
      q("DELETE FROM requests WHERE src = ? AND dst = ? AND no = 0", me.pid, f);
      return ok({ ok: true });
    }
    if (path === "/acct/remove") { cut(me.pid, f); return ok({ ok: true }); }
    if (path === "/acct/block") {
      if (f === me.pid) return ok({ ok: false });
      cut(me.pid, f);
      q("DELETE FROM requests WHERE (src = ? AND dst = ?) OR (src = ? AND dst = ?)", me.pid, f, f, me.pid);
      q("INSERT OR IGNORE INTO blocks (src, dst, at) VALUES (?, ?, ?)", me.pid, f, now);
      const n = q("SELECT COUNT(*) AS n FROM blocks WHERE src = ?", me.pid)[0].n;
      if (n > cfg.blockCap) q("DELETE FROM blocks WHERE src = ? AND dst IN (SELECT dst FROM blocks WHERE src = ? ORDER BY at ASC LIMIT ?)", me.pid, me.pid, n - cfg.blockCap);
      return ok({ ok: true });
    }
    if (path === "/acct/unblock") { q("DELETE FROM blocks WHERE src = ? AND dst = ?", me.pid, f); return ok({ ok: true }); }
    if (path === "/acct/report") {
      // 🚩 a NAME report. Several different (not brand-new) accounts → the name is replaced, nobody can take it again,
      // and its owner is asked to pick another. No human in the loop.
      if (f === me.pid) return ok({ ok: false });
      const target = acct(f);
      if (!target || !target.name) return ok({ ok: true });
      if (now - (row.made || now) < cfg.reportMinAgeMs) return ok({ ok: true, counted: false });
      if (q("SELECT COUNT(*) AS n FROM reports WHERE src = ? AND at > ?", me.pid, now - DAY)[0].n >= cfg.reportPerDay) return ok({ ok: true, counted: false });
      q("INSERT OR IGNORE INTO reports (src, dst, at) VALUES (?, ?, ?)", me.pid, f, now);
      const n = q("SELECT COUNT(*) AS n FROM reports WHERE dst = ? AND at > ?", f, Math.max(now - cfg.reportDays * DAY, target.named || 0))[0].n;
      if (n >= cfg.reportNeed && !target.gen) {
        q("INSERT OR IGNORE INTO retired (norm, at) VALUES (?, ?)", target.norm, now);
        const g = generatedName(f);
        q("UPDATE accounts SET name = ?, norm = ?, gen = 1, ask = 1 WHERE pid = ?", g, R.norm(g), f);
        q("DELETE FROM reports WHERE dst = ?", f);
        return ok({ ok: true, counted: true, replaced: true });
      }
      return ok({ ok: true, counted: true });
    }
    return { status: 404, body: { error: "not found" } };
  }
  const ok = (b) => ({ status: 200, body: b });
  return { handle, schema, config: pubCfg, nameOf: (pid) => { schema(); return nameOf(pid); }, madeOf: (pid) => { schema(); const r = acct(pid); return r ? r.made || 0 : 0; }, sechOf: (pid) => { schema(); const r = acct(pid); return r ? r.sech : null; } };
}

/** The worker's SQL (a Durable Object's state.storage.sql) as `q`. */
export const doSql = (sql) => (s, ...a) => sql.exec(s, ...a).toArray();
/** node:sqlite (the local relay + tests) as `q`. → null when this Node has no node:sqlite */
export async function nodeSql(file = ":memory:") {
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(file), cache = new Map();
    return (s, ...a) => {
      let st = cache.get(s);
      if (!st) { st = db.prepare(s); cache.set(s, st); }
      return st.all(...a).map((r) => Object.assign({}, r));
    };
  } catch (e) { return null; }
}
