// Tests for 🏪 player-owned shops (shops.mjs) — against the LOCAL relay over HTTP (the same code the worker runs).
//   node server/test-shops.mjs                   (starts local-relay.js on a private port with small caps; never touches production)
//   node server/test-shops.mjs --url https://…   (a deployed relay: the read-only config + list, then a throw-away zz_test
//                                                account claims a shop at a lot no town has, stocks it, releases it — and
//                                                is deleted; nothing is kept)
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ARG = process.argv.indexOf("--url");
const REMOTE = ARG > 0 ? process.argv[ARG + 1].replace(/\/$/, "").replace(/^ws/, "http") : "";
const PORT = 36000 + (process.pid % 20000);
const BASE = REMOTE || `http://127.0.0.1:${PORT}`;
const here = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const check = (label, ok, detail = "") => { console.log(`  ${ok ? "✓" : "✗"} ${label}${detail && !ok ? "  (" + detail + ")" : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const pid = () => Array.from({ length: 16 }, () => B32[Math.floor(Math.random() * 32)]).join("");
const sec = () => Array.from({ length: 32 }, () => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"[Math.floor(Math.random() * 64)]).join("");
const last = new Map();
async function post(p, body) {
  const k = body && body.pid;                          // (the per-account write gaps: accounts 400 ms, shops 600 ms; + the per-IP gap)
  if (k) { const w = 700 - (Date.now() - (last.get(k) || 0)); if (w > 0) await sleep(w); }
  const w2 = 260 - (Date.now() - (last.get("ip") || 0)); if (w2 > 0) await sleep(w2); last.set("ip", Date.now());
  if (k) last.set(k, Date.now());
  const r = await fetch(BASE + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { st: r.status, j: await r.json().catch(() => null) };
}
async function get(p) { const r = await fetch(BASE + p); return { st: r.status, j: await r.json().catch(() => null) }; }
const uniq = (b) => (b + Array.from({ length: 6 }, () => "abcdefghjkmnpqrstvwxyz"[Math.floor(Math.random() * 22)]).join("")).slice(0, 15);
async function account(tag) {
  const A = { pid: pid(), sec: sec() };
  await post("/acct/hello", A);
  const r = await post("/acct/name", { ...A, name: uniq("zz_test_" + tag) });
  A.ok = !!(r.j && r.j.ok); A.name = r.j && r.j.name;
  return A;
}
const SMALL = { ownerDayProfit: 10, buyerPerOwner: 50, buysPerShop: 3 };
const start = (env) => spawn(process.execPath, [path.join(here, "local-relay.js")], { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
async function up(base) { for (let k = 0; k < 60; k++) { try { if ((await fetch(base + "/health")).ok) return true; } catch (e) { /* not yet */ } await sleep(150); } return false; }

let relay = null, relay2 = null;
if (!REMOTE) relay = start({ PORT: String(PORT), SHOPS_CFG: JSON.stringify(SMALL) });
const made = [];
try {
  await up(BASE);
  console.log(`▶ shops: player-owned shops (${REMOTE ? "REMOTE " + BASE : "local relay"})`);
  const c0 = await get("/shops/config");
  check("GET /shops/config: the caps + licences", c0.st === 200 && c0.j.cfg && c0.j.cfg.cap.midwood === 1 && c0.j.cfg.cap.lakewood === 3 && c0.j.cfg.licences.lakewood.kugel === 3, JSON.stringify(c0.j));
  const w0 = await get("/world/config");
  check("GET /world/config: the shops kill switch is on", w0.st === 200 && JSON.stringify(w0.j).includes('"shops":1'), JSON.stringify(w0.j).slice(0, 200));
  const l0 = await get("/shops/list?town=lakewood");
  check("GET /shops/list?town=lakewood", l0.st === 200 && Array.isArray(l0.j.list), l0.st);
  check("…a town that doesn't exist → 400", (await get("/shops/list?town=narnia")).st === 400);
  const A = await account("A"); made.push(A);
  check("a throw-away account with a name", A.ok);
  const N = { pid: pid(), sec: sec() }; await post("/acct/hello", N); made.push(N);
  let r = await post("/shops/claim", { ...N, id: "lakewood:9990:9990", kind: "kugel" });
  check("no username → refused", r.st === 403, r.st);
  r = await post("/shops/claim", { pid: A.pid, sec: sec(), id: "lakewood:9990:9990", kind: "kugel" });
  check("A's id with the wrong secret → refused", r.st === 403, r.st);
  r = await post("/shops/claim", { ...A, id: "lakewood:<script>", kind: "kugel" });
  check("a shop id that isn't a lot → 400", r.st === 400, r.st);

  if (REMOTE) {
    // production: one throw-away shop at a lot no town has, stocked, then given back
    const id = "lakewood:9990:9990";
    r = await post("/shops/claim", { ...A, id, kind: "kugel" });
    check("claim a throw-away shop", r.j && r.j.ok === true, JSON.stringify(r.j));
    r = await post("/shops/stock", { ...A, id, shelf: [{ s: 0, g: "kugel", n: 4, p: 18, st: 2 }] });
    check("stock it (inside the band)", r.j && r.j.ok === true, JSON.stringify(r.j));
    const v = await get(`/shops/view?id=${id}`);
    check("GET /shops/view: her shelf + her username", v.j && v.j.ok && v.j.shelf.length === 1 && v.j.shop.o === A.name, JSON.stringify(v.j));
    r = await post("/shops/release", { ...A, id });
    check("release it", r.j && r.j.ok === true, JSON.stringify(r.j));
    check("…gone", !(await get(`/shops/view?id=${id}`)).j.ok);
  } else {
    const B = await account("B"), C = await account("C"), D = await account("D"); made.push(B, C, D);
    const S1 = "lakewood:57:133", S2 = "lakewood:45:171", S3 = "lakewood:10:20", S4 = "lakewood:11:21";
    r = await post("/shops/claim", { ...A, id: S1, kind: "kugel" });
    check("A claims a kugel shop in Lakewood", r.j.ok === true, JSON.stringify(r.j));
    r = await post("/shops/claim", { ...B, id: S1, kind: "kugel" });
    check("…B can't: taken (and told whose — A's username)", r.j.ok === false && r.j.why === "taken" && r.j.o === A.name, JSON.stringify(r.j));
    // Midwood: one (the edict); two once the court struck it down; never more than 4 in all
    r = await post("/shops/claim", { ...A, id: "midwood:1:1", kind: "handy" });
    check("A: one shop in Midwood", r.j.ok === true, JSON.stringify(r.j));
    r = await post("/shops/claim", { ...A, id: "midwood:2:2", kind: "party" });
    check("…a second in Midwood: the edict says no", r.j.ok === false && r.j.why === "edict", JSON.stringify(r.j));
    r = await post("/shops/claim", { ...A, id: "midwood:2:2", kind: "party", edictStruck: true });
    check("…after the court struck it down: a second", r.j.ok === true, JSON.stringify(r.j));
    r = await post("/shops/claim", { ...A, id: S2, kind: "cake" });
    check("A's fourth shop (Lakewood)", r.j.ok === true, JSON.stringify(r.j));
    r = await post("/shops/claim", { ...A, id: S3, kind: "sushi" });
    check("…a fifth: no — 4 in all", r.j.ok === false && r.j.why === "cap", JSON.stringify(r.j));
    // licences: Lakewood has 3 kugel shops
    await post("/shops/claim", { ...B, id: S3, kind: "kugel" });
    await post("/shops/claim", { ...C, id: S4, kind: "kugel" });
    r = await post("/shops/claim", { ...D, id: "lakewood:12:22", kind: "kugel" });
    check("licences: Lakewood's 3 kugel shops are taken → a 4th is refused", r.j.ok === false && r.j.why === "licence", JSON.stringify(r.j));
    // stocking: only her kind's goods, prices inside the band
    r = await post("/shops/stock", { ...A, id: S1, shelf: [{ s: 0, g: "kugel", n: 4, p: 30 }] });
    check("a price above the band is refused", r.j.ok === false && r.j.why === "price", JSON.stringify(r.j));
    r = await post("/shops/stock", { ...A, id: S1, shelf: [{ s: 0, g: "pan", n: 2, p: 40 }] });
    check("a good her kind doesn't sell is refused", r.j.ok === false && r.j.why === "bad slot", JSON.stringify(r.j));
    r = await post("/shops/stock", { ...B, id: S1, shelf: [{ s: 0, g: "kugel", n: 4, p: 15 }] });
    check("someone else can't stock her shop", r.j.ok === false, JSON.stringify(r.j));
    // slot 0: potato kugel at 15 (her share 12 = what it cost: no profit); slot 1: lokshen kugel at 25 (share 21, profit 7)
    r = await post("/shops/stock", { ...A, id: S1, shelf: [{ s: 0, g: "kugel", n: 4, p: 15, st: 3 }, { s: 1, g: "kugelSweet", n: 4, p: 25 }] });
    check("A stocks two spots", r.j.ok === true && r.j.n === 2, JSON.stringify(r.j));
    const v = await get(`/shops/view?id=${S1}`);
    check("GET /shops/view: her shelf + her username", v.j.ok && v.j.shelf.length === 2 && v.j.shop.o === A.name && v.j.shop.k === "kugel", JSON.stringify(v.j));
    // buying
    r = await post("/shops/buy", { ...B, id: S1, slot: 0, p: 15 });
    check("a new account can't buy yet (≥ 3 days)", r.j.ok === false && r.j.why === "new", JSON.stringify(r.j));
    for (const X of [A, B, C, D]) await post("/shops/_made", { pid: X.pid, ago: 4 * 86400000 });
    r = await post("/shops/buy", { ...A, id: S1, slot: 0, p: 15 });
    check("nobody buys from her own shop", r.j.ok === false && r.j.why === "yours", JSON.stringify(r.j));
    r = await post("/shops/buy", { ...B, id: S1, slot: 0, p: 12 });
    check("an old price → told the real one", r.j.ok === false && r.j.why === "price" && r.j.p === 15, JSON.stringify(r.j));
    let n = 0;
    for (let k = 0; k < 3; k++) { r = await post("/shops/buy", { ...B, id: S1, slot: 0, p: 15 }); if (r.j.ok) n++; }
    check("B buys 3 potato kugels", n === 3 && r.j.g === "kugel" && r.j.st === 3 && r.j.left === 1, JSON.stringify(r.j));
    r = await post("/shops/buy", { ...B, id: S1, slot: 0, p: 15 });
    check("…a 4th from the same shop today: no (3 a day)", r.j.ok === false && r.j.why === "buys", JSON.stringify(r.j));
    r = await post("/shops/buy", { ...C, id: S1, slot: 1, p: 25 });
    check("C buys a lokshen kugel (A's profit today: 7)", r.j.ok === true, JSON.stringify(r.j));
    r = await post("/shops/buy", { ...C, id: S1, slot: 1, p: 25 });
    check("…another would take A past her day's profit cap: sold out for today", r.j.ok === false && r.j.why === "soldout", JSON.stringify(r.j));
    check("…that spot says sold out for today (view)", (await get(`/shops/view?id=${S1}`)).j.shelf.find((x) => x.s === 1).so === 1);
    r = await post("/shops/buy", { ...C, id: S1, slot: 0, p: 15 });
    check("C buys a potato kugel (no profit in it: allowed; 40 spent at A)", r.j.ok === true, JSON.stringify(r.j));
    r = await post("/shops/stock", { ...A, id: S2, shelf: [{ s: 0, g: "cake", n: 4, p: 17 }] });
    r = await post("/shops/buy", { ...C, id: S2, slot: 0, p: 17 });
    check("…at A's other shop: past what one buyer may spend at one owner a day (50)", r.j.ok === false && r.j.why === "spent", JSON.stringify(r.j));
    // the till: 85 % of each price
    r = await post("/shops/hello", A);
    check("A's till: 85 % of what was paid (3 × 12 + 21 + 12 = 69)", r.j.till === 69, JSON.stringify(r.j.till));
    r = await post("/shops/collect", A);
    check("collect → 69, and the till is empty", r.j.ok && r.j.coins === 69 && (await post("/shops/hello", A)).j.till === 0, JSON.stringify(r.j));
    // 👍
    r = await post("/shops/thumb", { ...B, id: S1 });
    check("B (bought today) gives a 👍", r.j.ok === true, JSON.stringify(r.j));
    r = await post("/shops/thumb", { ...B, id: S1 });
    check("…once a day", r.j.ok === false && r.j.why === "already", JSON.stringify(r.j));
    r = await post("/shops/thumb", { ...D, id: S1 });
    check("D (bought nothing) can't", r.j.ok === false, JSON.stringify(r.j));
    check("…the list shows 1 👍", (await get("/shops/list?town=lakewood")).j.list.find((x) => x.id === S1).t === 1);
    // names: the accounts filter + 3 reports → reset
    r = await post("/shops/name", { ...A, id: S1, name: "KugelPalace" });
    check("A names her shop", r.j.ok === true && (await get(`/shops/view?id=${S1}`)).j.shop.n === "KugelPalace", JSON.stringify(r.j));
    r = await post("/shops/name", { ...A, id: S1, name: "fuck" });
    check("…a rude name is refused (the username filter)", r.j.ok === false, JSON.stringify(r.j));
    for (const X of [B, C]) await post("/shops/report", { ...X, id: S1 });
    check("2 reports: still named", (await get(`/shops/view?id=${S1}`)).j.shop.n === "KugelPalace");
    r = await post("/shops/report", { ...D, id: S1 });
    check("…a 3rd account reports → the name is reset", r.j.reset === true && (await get(`/shops/view?id=${S1}`)).j.shop.n === "", JSON.stringify(r.j));
    // a new day: the caps start again
    await post("/shops/_clock", { offset: 86400000 });
    await post("/shops/stock", { ...A, id: S1, shelf: [{ s: 0, g: "kugel", n: 4, p: 15 }] });
    r = await post("/shops/buy", { ...B, id: S1, slot: 0, p: 15 });
    check("the next day (restocked) B may buy again", r.j.ok === true, JSON.stringify(r.j));
    // ghost shops: B's not seen for 14 days → under renovation; 7 more → gone (a lot FOR LEASE again)
    await post("/shops/_clock", { offset: 16 * 86400000 });
    await post("/shops/hello", A);           // (any call runs the sweep; A is seen)
    let L = (await get("/shops/list?town=lakewood")).j.list;
    check("B unseen 15 days: her shop is under renovation (z)", L.find((x) => x.id === S3) && L.find((x) => x.id === S3).z === 1, JSON.stringify(L.find((x) => x.id === S3)));
    check("…A's (seen) is open", L.find((x) => x.id === S1).z === 0);
    r = await post("/shops/buy", { ...A, id: S3, slot: 0, p: 15 });
    check("…a shop under renovation sells nothing", r.j.ok === false && r.j.why === "closed", JSON.stringify(r.j));
    await post("/shops/_clock", { offset: 24 * 86400000 });
    await post("/shops/hello", A);
    L = (await get("/shops/list?town=lakewood")).j.list;
    check("…7 days later it's gone (back FOR LEASE)", !L.find((x) => x.id === S3), JSON.stringify(L.map((x) => x.id)));
    // deleting the account gives her shops back
    r = await post("/acct/delete", A);
    L = (await get("/shops/list?town=lakewood")).j.list;
    check("A deletes her account: her shops go back", r.j && r.j.ok && !L.find((x) => x.id === S1), JSON.stringify(L.map((x) => x.id)));
    // the rate limit
    const t0 = await fetch(BASE + "/shops/hello", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(C) });
    const t1 = await fetch(BASE + "/shops/hello", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(C) });
    check("two writes in a row from one account: the second is rate-limited", t0.status === 200 && t1.status === 429, `${t0.status} ${t1.status}`);
    // the kill switch (a second relay started with it off)
    const P2 = PORT + 1, B2 = `http://127.0.0.1:${P2}`;
    relay2 = start({ PORT: String(P2), SHOPS_OFF: "1" });
    await up(B2);
    const off = await (await fetch(B2 + "/shops/config")).json();
    const offList = await fetch(B2 + "/shops/list?town=lakewood");
    check("kill switch off: /shops/config says off, every call refused (503)", off.off === 1 && offList.status === 503, JSON.stringify(off) + " " + offList.status);
  }
} catch (e) {
  check("threw", false, String(e && e.stack || e));
} finally {
  for (const A of made) { try { await post("/acct/delete", A); } catch (e) { /* gone */ } }
  if (relay) relay.kill();
  if (relay2) relay2.kill();
}
console.log(fails ? `✗ ${fails} failed` : "✓ shops fine");
process.exit(fails ? 1 : 0);
