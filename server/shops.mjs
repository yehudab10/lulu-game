// Shared Road — 🏪 PLAYER-OWNED SHOPS (ci/playershops stage 2, roadmap 44; the plan the owner read:
// 3d/docs/playershops-plan.md). ADDITIVE like /homes/* and /wear/*: new HTTP endpoints under /shops/* on the existing global
// Board object + THREE small tables; nothing that exists changes shape; an old client never calls it. The owner approved it
// 2026-11-27 ("Yes everything you suggested is approved" — AGENTS.md golden rule 3, fifth exception). KILL SWITCH:
// world.mjs › WORLD.shops (served at GET /world/config) — off: /shops/config says { off: 1 } and every call is refused,
// so games show their shops as OPENING SOON again (stage 1's behaviour).
//
// The idea: a player leases / buys a storefront in her game; only REAL players buy from it. Coins stay on the device
// (like everything else) — the server only keeps what has to be SHARED and honest: who runs which shop, what's on its
// shelves at what price, the till, the 👍 count, and the daily caps that keep the coin flow small and a net sink:
//   • a buyer pays the shelf price on her phone; the owner's till gets (1 − salesTax) of it (the town keeps the rest);
//   • the owner's profit (till share − what the stock cost) is capped per real day (ownerDayProfit) — past it the shop
//     reads "sold out for today"; a buyer spends at most buyerPerOwner a day at one owner's shops and buys at most
//     buysPerShop times a day in one shop; nobody buys from her own shop; only accounts with a username, made at least
//     minDays ago;
//   • prices must sit inside the band (cost × [bandMin, bandMax]) — the server knows each good's cost (GOODS, below).
// A hacked client can already give itself coins on its own phone, so the server can't stop coin cheating; what it does
// stop is a shop becoming a coin PUMP for other accounts: the worst a ring of fake buyers gets one owner is
// ownerDayProfit a day (the same as a busy honest shop), and it costs those buyers more than the owner gains.
//
// Ghost shops (the homes rule): an owner not seen for idleDays → her shops are "under renovation" for holdDays, then
// gone (the front goes back FOR LEASE on everyone's screen); one appeal is the client's business (court), not here.
//
// Stored (per shop): the storefront id (`<town>:<lx>:<lz>` — from the map, never typed text), the owner's random player
// id, the kind, the town, an optional shop name (the same rules as a username; 3 reports from different accounts → reset),
// since / seen / seized, the 👍 count; per shelf slot: the good id, units, price, stars, its cost; per real day: counters
// (dropped after 2 days); per owner: the till. No IP (rate limits live in memory for seconds), nothing about the person.
//
// Storage: q(sql, ...args) → rows (the worker's doSql / node:sqlite in the local relay + tests).
import * as R from "../3d/js/features/accounts/rules.js";

/** Keep in step with 3d/js/features/playershops/data.js (CAP, TOTAL, LICENCES, GOODS[*].cost, BAND, SALES_TAX, SALES). */
export const CONFIG = {
  v: 1,
  cap: { midwood: 1, lakewood: 3 }, total: 4,
  licences: { midwood: { kugel: 2, sushi: 1, carcare: 1, party: 1, handy: 1, cake: 1 }, lakewood: { kugel: 3, sushi: 2, carcare: 2, party: 2, handy: 2, cake: 2 } },
  bandMin: 1.2, bandMax: 1.8, salesTax: 0.15, slots: 24, perSlot: 4,
  ownerDayProfit: 300, buyerPerOwner: 150, buysPerShop: 3, minDays: 3,
  idleDays: 14, holdDays: 7, reportsToReset: 3,
  writeGapMs: 600, ipGapMs: 200, sweepGapMs: 60 * 1000, maxShops: 2000,
};
export const GOODS = { kugel: 12, kugelSweet: 14, cake: 14, rugelach: 10, sushi: 22, pan: 30, seltzer: 12, pillow: 18, blower: 40, balloon: 6, chicken: 10, giftbox: 20, washToken: 15, airFresh: 8 };
export const KIND_GOODS = { kugel: ["kugel", "kugelSweet"], cake: ["cake", "rugelach"], sushi: ["sushi"], handy: ["pan", "seltzer", "pillow", "blower"], party: ["balloon", "chicken", "giftbox"], carcare: ["washToken", "airFresh"] };

const PID_RE = /^[A-Z2-7]{16}$/;
const SEC_RE = /^[A-Za-z0-9_-]{32}$/;
const SHOP_RE = /^(midwood|lakewood):-?\d{1,4}:-?\d{1,4}$/;
const DAY = 86400000;
async function sha(s) {
  const b = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** opts: { sechOf(pid), nameOf(pid), madeOf(pid) → ms, on() → bool (the kill switch), clock, config } */
export function createShops(q, opts = {}) {
  const cfg = Object.assign({}, CONFIG, opts.config || {});
  const clock = opts.clock || (() => Date.now());
  const hits = new Map();
  let ready = false, sweptAt = -1e15;
  function schema() {
    if (ready) return;
    q("CREATE TABLE IF NOT EXISTS shops (id TEXT PRIMARY KEY, owner TEXT, kind TEXT, town TEXT, name TEXT, since INTEGER, seen INTEGER, seized INTEGER DEFAULT 0, thumbs INTEGER DEFAULT 0, reports TEXT DEFAULT '')");
    q("CREATE INDEX IF NOT EXISTS shops_owner ON shops (owner)");
    q("CREATE TABLE IF NOT EXISTS shop_stock (id TEXT, slot INTEGER, good TEXT, n INTEGER, price INTEGER, stars INTEGER, PRIMARY KEY (id, slot))");
    q("CREATE TABLE IF NOT EXISTS shop_day (day INTEGER, k TEXT, v INTEGER, PRIMARY KEY (day, k))");
    q("CREATE TABLE IF NOT EXISTS shop_till (owner TEXT PRIMARY KEY, coins INTEGER)");
    ready = true;
  }
  function rate(key, gap, now) {
    const last = hits.get(key) || 0;
    if (now - last < gap) return false;
    hits.set(key, now);
    if (hits.size > 5000) for (const [k, t] of hits) if (now - t > 60000) hits.delete(k);
    return true;
  }
  const dayOf = (now) => Math.floor(now / DAY);
  const getC = (day, k) => { const r = q("SELECT v FROM shop_day WHERE day = ? AND k = ?", day, k)[0]; return r ? r.v : 0; };
  const addC = (day, k, n) => q("INSERT INTO shop_day (day, k, v) VALUES (?, ?, ?) ON CONFLICT (day, k) DO UPDATE SET v = v + excluded.v", day, k, n);
  const band = (g) => [Math.ceil(GOODS[g] * cfg.bandMin), Math.floor(GOODS[g] * cfg.bandMax)];
  function sweep(now) {
    if (now - sweptAt < cfg.sweepGapMs) return;
    sweptAt = now;
    q("UPDATE shops SET seized = ? WHERE seized = 0 AND seen < ?", now, now - cfg.idleDays * DAY);
    for (const r of q("SELECT id FROM shops WHERE seized > 0 AND seized < ?", now - cfg.holdDays * DAY)) { q("DELETE FROM shop_stock WHERE id = ?", r.id); q("DELETE FROM shops WHERE id = ?", r.id); }
    q("DELETE FROM shop_day WHERE day < ?", dayOf(now) - 1);
  }
  async function auth(body) {
    if (!body || !PID_RE.test(body.pid) || !SEC_RE.test(body.sec)) return null;
    const ah = opts.sechOf ? opts.sechOf(body.pid) : null;
    if (!ah || ah !== await sha(body.sec)) return null;
    if (opts.nameOf && !opts.nameOf(body.pid)) return null;          // (an account with a username)
    return body.pid;
  }
  const pub = (r) => ({ id: r.id, k: r.kind, n: r.name || "", o: (opts.nameOf && opts.nameOf(r.owner)) || "", z: r.seized ? 1 : 0, t: r.thumbs | 0 });
  const shelf = (id) => q("SELECT slot, good, n, price, stars FROM shop_stock WHERE id = ? AND n > 0 ORDER BY slot", id).map((r) => ({ s: r.slot, g: r.good, n: r.n, p: r.price, st: r.stars }));
  const ok = (b) => ({ status: 200, body: b });
  const no = (why, extra = {}) => ok(Object.assign({ ok: false, why }, extra));

  async function handle(path, method, body, ip, query = {}) {
    schema();
    const now = clock(), day = dayOf(now);
    sweep(now);
    const on = opts.on ? !!opts.on() : true;
    if (method === "GET" && path === "/shops/config" && !on) return ok({ v: cfg.v, off: 1 });
    if (!on) return { status: 503, body: { ok: false, why: "off" } };
    if (method === "GET" && path === "/shops/config") return ok({ v: cfg.v, cfg: { cap: cfg.cap, total: cfg.total, licences: cfg.licences, ownerDayProfit: cfg.ownerDayProfit, buyerPerOwner: cfg.buyerPerOwner, buysPerShop: cfg.buysPerShop, salesTax: cfg.salesTax } });
    if (method === "GET" && path === "/shops/list") {
      const town = String(query.town || "");
      if (!cfg.cap[town]) return { status: 400, body: { error: "bad town" } };
      return ok({ list: q("SELECT * FROM shops WHERE town = ? LIMIT 400", town).map(pub) });
    }
    if (method === "GET" && path === "/shops/view") {
      const id = String(query.id || ""), r = SHOP_RE.test(id) ? q("SELECT * FROM shops WHERE id = ?", id)[0] : null;
      if (!r) return no("none");
      // (a spot is sold out for today when one more would take the owner past her day's profit cap)
      const op = getC(day, "op:" + r.owner), out = (x) => op + Math.max(0, Math.floor(x.p * (1 - cfg.salesTax)) - GOODS[x.g]) > cfg.ownerDayProfit;
      const sh = r.seized ? [] : shelf(id).map((x) => Object.assign(x, out(x) ? { so: 1 } : {}));
      return ok({ ok: true, shop: pub(r), shelf: sh, soldOut: sh.length > 0 && sh.every((x) => x.so) });
    }
    if (method !== "POST") return { status: 404, body: { error: "not found" } };
    const pid = await auth(body);
    if (!pid) return { status: 403, body: { error: "who are you" } };
    if (!rate("p:" + pid, cfg.writeGapMs, now) || !rate("i:" + ip, cfg.ipGapMs, now)) return { status: 429, body: { ok: false, why: "rate" } };
    q("UPDATE shops SET seen = ?, seized = 0 WHERE owner = ? AND (seized = 0 OR seized > ?)", now, pid, now - cfg.holdDays * DAY);
    const id = String(body.id || "");
    const row = SHOP_RE.test(id) ? q("SELECT * FROM shops WHERE id = ?", id)[0] || null : null;
    const mineRow = row && row.owner === pid ? row : null;

    if (path === "/shops/hello") {
      const till = (q("SELECT coins FROM shop_till WHERE owner = ?", pid)[0] || {}).coins || 0;
      return ok({ mine: q("SELECT * FROM shops WHERE owner = ?", pid).map(pub), till });
    }
    if (path === "/shops/claim") {
      const kind = String(body.kind || ""), town = id.split(":")[0];
      if (!SHOP_RE.test(id) || !KIND_GOODS[kind]) return { status: 400, body: { error: "bad shop" } };
      if (row) return no(row.owner === pid ? "mine" : "taken", { o: pub(row).o });
      const have = q("SELECT town FROM shops WHERE owner = ?", pid);
      const capTown = (cfg.cap[town] || 1) + (town === "midwood" && body.edictStruck === true ? 1 : 0);
      if (have.length >= cfg.total) return no("cap");
      if (have.filter((h) => h.town === town).length >= capTown) return no("edict");
      const used = q("SELECT COUNT(*) AS c FROM shops WHERE town = ? AND kind = ?", town, kind)[0].c;
      if (used >= ((cfg.licences[town] || {})[kind] || 0)) return no("licence");
      if (q("SELECT COUNT(*) AS c FROM shops")[0].c >= cfg.maxShops) return no("full");
      q("INSERT INTO shops (id, owner, kind, town, name, since, seen) VALUES (?, ?, ?, ?, '', ?, ?)", id, pid, kind, town, now, now);
      return ok({ ok: true });
    }
    if (path === "/shops/release") {
      if (!mineRow) return no("not yours");
      q("DELETE FROM shop_stock WHERE id = ?", id); q("DELETE FROM shops WHERE id = ?", id);
      return ok({ ok: true });
    }
    if (path === "/shops/stock") {
      if (!mineRow || mineRow.seized) return no("not yours");
      const list = Array.isArray(body.shelf) ? body.shelf.slice(0, cfg.slots) : null;
      if (!list) return { status: 400, body: { error: "bad shelf" } };
      const goods = new Set(KIND_GOODS[mineRow.kind]);
      const clean = [];
      for (const x of list) {
        const s = x && Number.isInteger(x.s) ? x.s : -1, g = x && x.g, n = x && Number.isInteger(x.n) ? x.n : 0, p = x && Number.isInteger(x.p) ? x.p : 0;
        if (s < 0 || s >= cfg.slots || !goods.has(g) || n < 1 || n > cfg.perSlot) return no("bad slot", { s });
        const [lo, hi] = band(g);
        if (p < lo || p > hi) return no("price", { s, lo, hi });
        clean.push({ s, g, n, p, st: Math.max(0, Math.min(3, x.st | 0)) });
      }
      q("DELETE FROM shop_stock WHERE id = ?", id);
      for (const x of clean) q("INSERT INTO shop_stock (id, slot, good, n, price, stars) VALUES (?, ?, ?, ?, ?, ?)", id, x.s, x.g, x.n, x.p, x.st);
      return ok({ ok: true, n: clean.length });
    }
    if (path === "/shops/buy") {
      // (everything below is synchronous — no other request runs in between: the Durable Object / one Node thread)
      if (!row || row.seized) return no("closed");
      if (row.owner === pid) return no("yours");
      const made = opts.madeOf ? opts.madeOf(pid) : 0;
      if (!made || now - made < cfg.minDays * DAY) return no("new");
      const slot = Number.isInteger(body.slot) ? body.slot : -1;
      const it = q("SELECT good, n, price, stars FROM shop_stock WHERE id = ? AND slot = ?", id, slot)[0];
      if (!it || it.n < 1) return no("gone");
      if (body.p !== it.price) return no("price", { p: it.price });         // (she saw an old price: show the new one)
      const kBO = `bo:${pid}:${row.owner}`, kBS = `bs:${pid}:${id}`, kOP = `op:${row.owner}`;
      if (getC(day, kBS) >= cfg.buysPerShop) return no("buys");
      if (getC(day, kBO) + it.price > cfg.buyerPerOwner) return no("spent");
      const share = Math.floor(it.price * (1 - cfg.salesTax)), margin = Math.max(0, share - GOODS[it.good]);
      if (getC(day, kOP) + margin > cfg.ownerDayProfit) return no("soldout");
      q("UPDATE shop_stock SET n = n - 1 WHERE id = ? AND slot = ?", id, slot);
      addC(day, kBO, it.price); addC(day, kBS, 1); addC(day, kOP, margin);
      q("INSERT INTO shop_till (owner, coins) VALUES (?, ?) ON CONFLICT (owner) DO UPDATE SET coins = coins + excluded.coins", row.owner, share);
      return ok({ ok: true, g: it.good, st: it.stars, p: it.price, left: it.n - 1 });
    }
    if (path === "/shops/collect") {
      const coins = (q("SELECT coins FROM shop_till WHERE owner = ?", pid)[0] || {}).coins || 0;
      if (coins > 0) q("UPDATE shop_till SET coins = 0 WHERE owner = ?", pid);
      return ok({ ok: true, coins });
    }
    if (path === "/shops/thumb") {
      if (!row || row.owner === pid) return no("no");
      if (!q("SELECT 1 FROM shop_day WHERE day = ? AND k = ?", day, `bs:${pid}:${id}`).length) return no("buy first");
      if (getC(day, `tu:${pid}:${id}`)) return no("already");
      addC(day, `tu:${pid}:${id}`, 1);
      q("UPDATE shops SET thumbs = thumbs + 1 WHERE id = ?", id);
      return ok({ ok: true });
    }
    if (path === "/shops/name") {
      if (!mineRow) return no("not yours");
      const name = String(body.name || "").trim();
      const bad = name && R.check(name);
      if (bad) return no(bad);
      q("UPDATE shops SET name = ?, reports = '' WHERE id = ?", name.slice(0, 24), id);
      return ok({ ok: true });
    }
    if (path === "/shops/report") {
      if (!row || row.owner === pid || !row.name) return no("no");
      const by = new Set((row.reports || "").split(",").filter(Boolean)); by.add(pid);
      if (by.size >= cfg.reportsToReset) { q("UPDATE shops SET name = '', reports = '' WHERE id = ?", id); return ok({ ok: true, reset: true }); }
      q("UPDATE shops SET reports = ? WHERE id = ?", [...by].slice(0, 10).join(","), id);
      return ok({ ok: true });
    }
    return { status: 404, body: { error: "not found" } };
  }
  /** An account was deleted: its shops go back to the market, its till is dropped. */
  function releaseAll(pid) {
    schema();
    if (!PID_RE.test(pid)) return;
    for (const r of q("SELECT id FROM shops WHERE owner = ?", pid)) q("DELETE FROM shop_stock WHERE id = ?", r.id);
    q("DELETE FROM shops WHERE owner = ?", pid); q("DELETE FROM shop_till WHERE owner = ?", pid);
  }
  return { handle, releaseAll, schema, config: () => cfg };
}
