// Shared Road — 🏘️ THE WORLD-WIDE PROPERTY REGISTRY (ci/realestate; the owner approved it + this server change,
// 2026-11-20: "Do version B, you can touch the server"). Additive and backwards-compatible: new HTTP endpoints under
// /homes/* and ONE new table; nothing that exists changes shape. Old clients never call it; a new client against an
// old server gets a 404 on /homes/config and quietly keeps its local registry.
//
// The server only arbitrates WHO OWNS WHICH HOUSE. Coins stay on the device (as everything does today).
//
// What is stored, per owned house (one row): the house id ("lakewood:178:240" — a door's place in the town), the
// owner's random player id (16 base32 chars, made on the device — nothing about the person), a SHA-256 hash of the
// owner's device secret (never the secret), a GENERATED label ("Kugel Kid #37": one of the 12 curated names + a
// number from the id — never typed text), the town, when it was bought, when the owner was last seen, and whether the
// government seized it. No IP is stored (rate limits keep it in memory for seconds), no location, no device info.
//
// THE GOVERNMENT (the scarcity rule — "subject to change if the government decides differently"): every knob is in
// CONFIG below, sent to every client on /homes/config, so the owner can change the rules with a server deploy only.
//   • a player not seen for `idleDays` (14): THE ABANDONED KUGEL ORDINANCE seizes all of their homes — each becomes a
//     "Municipal Kugel Storage Facility" for `holdDays` (7) and then goes back on the market;
//   • while it's seized, the owner may APPEAL in court (once per house): `appealWin` (0.5) → the house is theirs again.
//   • `cap` (10) homes per player; claims are rate-limited per player and per IP.
// Storage adapter (worker: SQLite; local relay: a Map): { get(h), put(row), del(h), byOwner(pid), byTown(town),
// seizeIdle(cutoff, now), dropSeized(cutoff), count() }.

export const CONFIG = {
  ordinance: "the Abandoned Kugel Ordinance",
  amended: "2026-11-20",          // the date the Council last "amended the Ordinance" (clients show it)
  cap: 10,                        // homes per player
  idleDays: 14,                   // not seen this long → seized
  holdDays: 7,                    // seized this long → back on the market
  appealWin: 0.5,                 // the court's odds of giving a seized house back
  claimGapMs: 3000,               // claim / release / appeal: one per this, per player AND per IP
  sweepGapMs: 60 * 1000,          // the seizure sweep runs at most this often
  maxRows: 20000,                 // a hard ceiling on the table (two towns hold ~420 front doors today)
};

const CURATED = [
  "Cholent Boy", "Rugelach Queen", "Bubby's Favorite", "Kugel Kid",
  "Shabbos Racer", "Babka Baron", "Gefilte Ghost", "Mitzvah Machine",
  "Sheitel Slayer", "Dreidel Daredevil", "Latke Legend", "Schmaltz Speedster",
];
const TOWNS = new Set(["lakewood", "midwood"]);
const HOUSE_RE = /^(lakewood|midwood):-?\d{1,4}:-?\d{1,4}$/;
const PID_RE = /^[A-Z2-7]{16}$/;
const SEC_RE = /^[A-Za-z0-9_-]{32}$/;
const DAY = 86400000;

/** The same "#37" the client's core/player.js computes from an id. */
export function tagOf(id) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return 10 + h % 90; }
export function labelOf(pid, name) { return `${CURATED.includes(name) ? name : "Cholent Boy"} #${tagOf(pid)}`; }
async function sha(s) {
  const b = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** The registry: one instance per server (the worker's global Board object / the local relay process). */
export function createHomes(db, opts = {}) {
  const cfg = Object.assign({}, CONFIG, opts.config || {});
  const hits = new Map();                  // "p:<pid>" / "i:<ip>" → last ms (memory only, pruned)
  let lastSweep = 0;
  const clock = opts.clock || (() => Date.now());

  function rate(key, now) {
    const last = hits.get(key) || 0;
    if (now - last < cfg.claimGapMs) return false;
    hits.set(key, now);
    if (hits.size > 5000) for (const [k, t] of hits) if (now - t > 60000) hits.delete(k);
    return true;
  }
  function sweep(now) {
    if (now - lastSweep < cfg.sweepGapMs) return;
    lastSweep = now;
    db.seizeIdle(now - cfg.idleDays * DAY, now);
    db.dropSeized(now - cfg.holdDays * DAY);
  }
  /** Is this request really from player `pid`? (a player with no houses yet: any well-formed secret starts them) */
  async function auth(body) {
    if (!body || !PID_RE.test(body.pid) || !SEC_RE.test(body.sec)) return null;
    const h = await sha(body.sec), rows = db.byOwner(body.pid);
    if (rows.length && rows[0].sech !== h) return null;
    return { pid: body.pid, sech: h, rows };
  }
  const pub = (r) => ({ h: r.house, l: r.label, s: r.since, z: r.seized ? 1 : 0 });
  const config = () => ({ ordinance: cfg.ordinance, amended: cfg.amended, cap: cfg.cap, idleDays: cfg.idleDays, holdDays: cfg.holdDays, appealWin: cfg.appealWin });

  return {
    config,
    /** → { status, body } */
    async handle(path, method, body, ip) {
      const now = clock();
      sweep(now);
      if (path === "/homes/config" && method === "GET") return { status: 200, body: { v: 1, cfg: config(), now } };
      if (path === "/homes/list" && method === "GET") {
        const town = body && body.town;
        if (!TOWNS.has(town)) return { status: 400, body: { error: "bad town" } };
        return { status: 200, body: { town, list: db.byTown(town).map(pub), cfg: config(), now } };
      }
      if (method !== "POST") return { status: 404, body: { error: "not found" } };
      const me = await auth(body);
      if (!me) return { status: 403, body: { error: "who are you" } };
      // hello: I'm here (the idle clock restarts on every house that isn't seized) + my houses + my label
      if (path === "/homes/hello") {
        for (const r of me.rows) if (!r.seized) { r.seen = now; db.put(r); }
        const label = me.rows[0] ? me.rows[0].label : labelOf(me.pid, body.name);
        return { status: 200, body: { label, mine: db.byOwner(me.pid).map(pub), cfg: config(), now } };
      }
      const house = body.h;
      if (!HOUSE_RE.test(String(house))) return { status: 400, body: { error: "bad house" } };
      if (!rate("p:" + me.pid, now) || !rate("i:" + ip, now)) return { status: 429, body: { ok: false, why: "rate" } };
      const row = db.get(house);
      if (path === "/homes/claim") {
        if (row) return { status: 200, body: { ok: row.owner === me.pid && !row.seized, why: row.owner === me.pid ? (row.seized ? "seized" : "mine") : row.seized ? "seized" : "taken", l: row.label } };
        if (me.rows.length >= cfg.cap) return { status: 200, body: { ok: false, why: "cap", cap: cfg.cap } };
        if (db.count() >= cfg.maxRows) return { status: 200, body: { ok: false, why: "full" } };
        const label = me.rows[0] ? me.rows[0].label : labelOf(me.pid, body.name);
        db.put({ house, town: house.split(":")[0], owner: me.pid, sech: me.sech, label, since: now, seen: now, seized: 0, appealed: 0 });
        for (const r of me.rows) if (!r.seized) { r.seen = now; db.put(r); }
        return { status: 200, body: { ok: true, l: label, s: now } };
      }
      if (path === "/homes/release") {
        if (!row || row.owner !== me.pid) return { status: 200, body: { ok: false, why: "not yours" } };
        db.del(house);
        return { status: 200, body: { ok: true } };
      }
      if (path === "/homes/appeal") {
        // the court (the client plays the hearing; THE SERVER rolls the verdict): once per seized house
        if (!row || row.owner !== me.pid) return { status: 200, body: { ok: false, why: "gone" } };
        if (!row.seized) return { status: 200, body: { ok: false, why: "not seized" } };
        if (row.appealed) return { status: 200, body: { ok: false, why: "appealed" } };
        const won = Math.random() < cfg.appealWin;
        if (won) { row.seized = 0; row.seen = now; row.appealed = now; db.put(row); }
        else db.del(house);                          // lost: back on the market right away
        return { status: 200, body: { ok: true, won } };
      }
      return { status: 404, body: { error: "not found" } };
    },
  };
}

/** A Map-backed store (the local relay + tests). */
export function memoryStore() {
  const m = new Map();
  return {
    get: (h) => (m.has(h) ? Object.assign({}, m.get(h)) : null),
    put: (r) => { m.set(r.house, Object.assign({}, r)); },
    del: (h) => { m.delete(h); },
    byOwner: (pid) => [...m.values()].filter((r) => r.owner === pid).map((r) => Object.assign({}, r)),
    byTown: (town) => [...m.values()].filter((r) => r.town === town),
    seizeIdle(cutoff, now) { for (const r of m.values()) if (!r.seized && r.seen < cutoff) r.seized = now; },
    dropSeized(cutoff) { for (const [h, r] of m) if (r.seized && r.seized < cutoff) m.delete(h); },
    count: () => m.size,
  };
}

/** The SQLite store (the Cloudflare Durable Object's state.storage.sql). */
export function sqlStore(sql) {
  sql.exec("CREATE TABLE IF NOT EXISTS homes (house TEXT PRIMARY KEY, town TEXT, owner TEXT, sech TEXT, label TEXT, since INTEGER, seen INTEGER, seized INTEGER, appealed INTEGER)");
  sql.exec("CREATE INDEX IF NOT EXISTS homes_owner ON homes (owner)");
  sql.exec("CREATE INDEX IF NOT EXISTS homes_town ON homes (town)");
  const rows = (q, ...a) => sql.exec(q, ...a).toArray();
  return {
    get: (h) => rows("SELECT * FROM homes WHERE house = ?", h)[0] || null,
    put: (r) => { sql.exec("INSERT INTO homes (house, town, owner, sech, label, since, seen, seized, appealed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (house) DO UPDATE SET owner = excluded.owner, sech = excluded.sech, label = excluded.label, since = excluded.since, seen = excluded.seen, seized = excluded.seized, appealed = excluded.appealed",
      r.house, r.town, r.owner, r.sech, r.label, r.since, r.seen, r.seized || 0, r.appealed || 0); },
    del: (h) => { sql.exec("DELETE FROM homes WHERE house = ?", h); },
    byOwner: (pid) => rows("SELECT * FROM homes WHERE owner = ?", pid),
    byTown: (town) => rows("SELECT house, label, since, seized FROM homes WHERE town = ?", town),
    seizeIdle(cutoff, now) { sql.exec("UPDATE homes SET seized = ? WHERE seized = 0 AND seen < ?", now, cutoff); },
    dropSeized(cutoff) { sql.exec("DELETE FROM homes WHERE seized > 0 AND seized < ?", cutoff); },
    count: () => rows("SELECT COUNT(*) AS n FROM homes")[0].n,
  };
}
