// Tests for 👜 limited luxury pieces (wear.mjs) — against the LOCAL relay over HTTP (the same code the worker runs).
//   node server/test-wear.mjs                   (starts local-relay.js on a private port with tiny totals; never touches production)
//   node server/test-wear.mjs --url https://…   (a deployed relay: the read-only stock + a throw-away zz_test account
//                                                that reserves and CANCELS — nothing is kept, the account is deleted)
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ARG = process.argv.indexOf("--url");
const REMOTE = ARG > 0 ? process.argv[ARG + 1].replace(/\/$/, "").replace(/^ws/, "http") : "";
const PORT = 35000 + (process.pid % 20000);
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
  const k = body && body.pid;                          // (the per-account write gaps: accounts 400 ms, wear 800 ms)
  if (k) { const w = 900 - (Date.now() - (last.get(k) || 0)); if (w > 0) await sleep(w); }
  if (p.startsWith("/wear/")) { const w = 320 - (Date.now() - (last.get("ip") || 0)); if (w > 0) await sleep(w); last.set("ip", Date.now()); }   // (+ the per-IP gap)
  if (k) last.set(k, Date.now());
  const r = await fetch(BASE + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { st: r.status, j: await r.json().catch(() => null) };
}
async function get(p) { await sleep(300); const r = await fetch(BASE + p); return { st: r.status, j: await r.json().catch(() => null) }; }
const uniq = (b) => (b + Array.from({ length: 6 }, () => "abcdefghjkmnpqrstvwxyz"[Math.floor(Math.random() * 22)]).join("")).slice(0, 15);
async function account(tag) {
  const A = { pid: pid(), sec: sec() };
  await post("/acct/hello", A);
  const r = await post("/acct/name", { ...A, name: uniq("zz_test_" + tag) });
  A.ok = !!(r.j && r.j.ok);
  return A;
}

let relay = null;
if (!REMOTE) relay = spawn(process.execPath, [path.join(here, "local-relay.js")], { env: { ...process.env, PORT: String(PORT), WEAR_LIMITED: JSON.stringify({ jfk_bag: 2 }) }, stdio: ["ignore", "pipe", "pipe"] });
const made = [];
try {
  for (let k = 0; k < 40; k++) { try { if ((await fetch(BASE + "/health")).ok) break; } catch (e) { /* not yet */ } await sleep(150); }
  console.log(`▶ wear: limited pieces (${REMOTE ? "REMOTE " + BASE : "local relay"})`);
  const s0 = await get("/wear/stock");
  check("GET /wear/stock: every limited piece with total + left", s0.st === 200 && s0.j.stock && ["jfk_bag", "jfk_trench", "jfk_wrap", "jfk_shades"].every((p) => s0.j.stock[p] && s0.j.stock[p].total > 0 && s0.j.stock[p].left <= s0.j.stock[p].total), JSON.stringify(s0.j));
  const A = await account("A");
  made.push(A);
  check("a throw-away account with a name", A.ok);
  const N = { pid: pid(), sec: sec() };
  await post("/acct/hello", N);
  made.push(N);
  let r = await post("/wear/reserve", { ...N, p: "jfk_wrap" });
  check("no username → refused", r.st === 403, r.st);
  r = await post("/wear/reserve", { pid: A.pid, sec: sec(), p: "jfk_wrap" });
  check("A's id with the wrong secret → refused", r.st === 403, r.st);
  r = await post("/wear/reserve", { ...A, p: "not_a_piece" });
  check("a piece that isn't limited → 400", r.st === 400, r.st);

  if (REMOTE) {
    // production: hold one number, then let it go (nothing kept)
    const before = s0.j.stock.jfk_shades.left;
    r = await post("/wear/reserve", { ...A, p: "jfk_shades" });
    check("reserve → a number held for her", r.j && r.j.ok === true && r.j.n >= 1 && r.j.total === s0.j.stock.jfk_shades.total, JSON.stringify(r.j));
    const s1 = await get("/wear/stock");
    check("…one fewer left while it's held", s1.j.stock.jfk_shades.left === before - 1 || before === 0, `${before} → ${s1.j.stock.jfk_shades.left}`);
    r = await post("/wear/cancel", { ...A, p: "jfk_shades" });
    const s2 = await get("/wear/stock");
    check("cancel → the number is free again", r.j && r.j.ok && s2.j.stock.jfk_shades.left === before, `${before} → ${s2.j.stock.jfk_shades.left}`);
  } else {
    const B = await account("B"), C = await account("C");
    made.push(B, C);
    r = await post("/wear/reserve", { ...A, p: "jfk_bag" });
    check("A reserves the bag: No. 1 of 2", r.j.ok === true && r.j.n === 1 && r.j.total === 2, JSON.stringify(r.j));
    r = await post("/wear/reserve", { ...A, p: "jfk_bag" });
    check("…asking again keeps her same number", r.j.ok === true && r.j.n === 1, JSON.stringify(r.j));
    let s = await get("/wear/stock");
    check("…the stock counts a hold (1 of 2 left)", s.j.stock.jfk_bag.left === 1, JSON.stringify(s.j.stock.jfk_bag));
    r = await post("/wear/confirm", { ...A, p: "jfk_bag" });
    check("A confirms (paid on her phone): No. 1 is hers", r.j.ok === true && r.j.n === 1, JSON.stringify(r.j));
    r = await post("/wear/reserve", { ...A, p: "jfk_bag" });
    check("…one of each per account (a second: owned)", r.j.ok === false && r.j.why === "owned" && r.j.n === 1, JSON.stringify(r.j));
    r = await post("/wear/reserve", { ...B, p: "jfk_bag" });
    check("B reserves: No. 2 of 2", r.j.ok === true && r.j.n === 2, JSON.stringify(r.j));
    r = await post("/wear/reserve", { ...C, p: "jfk_bag" });
    check("C: sold out (the last one is held by B)", r.j.ok === false && r.j.why === "soldout", JSON.stringify(r.j));
    s = await get("/wear/stock");
    check("…stock: 0 of 2 left", s.j.stock.jfk_bag.left === 0, JSON.stringify(s.j.stock.jfk_bag));
    // B never confirms: the hold runs out → C gets No. 2
    await post("/wear/_clock", { offset: 6 * 60000 });
    s = await get("/wear/stock");
    check("B's hold runs out after 5 minutes: 1 left again", s.j.stock.jfk_bag.left === 1, JSON.stringify(s.j.stock.jfk_bag));
    r = await post("/wear/reserve", { ...C, p: "jfk_bag" });
    check("…C reserves: No. 2", r.j.ok === true && r.j.n === 2, JSON.stringify(r.j));
    r = await post("/wear/confirm", { ...B, p: "jfk_bag" });
    check("…B confirming too late is told it ran out (her phone gives the coins back)", r.j.ok === false && r.j.why === "expired", JSON.stringify(r.j));
    r = await post("/wear/confirm", { ...C, p: "jfk_bag" });
    check("…C confirms", r.j.ok === true && r.j.n === 2, JSON.stringify(r.j));
    r = await post("/wear/mine", A);
    check("/wear/mine: A's numbered pieces come back (a new phone restores them, no charge)", r.j.mine.length === 1 && r.j.mine[0].p === "jfk_bag" && r.j.mine[0].n === 1 && r.j.mine[0].st === 2 && r.j.mine[0].total === 2, JSON.stringify(r.j));
    r = await post("/wear/confirm", { ...A, p: "jfk_bag" });
    check("…confirming again is harmless (already hers, same number)", r.j.ok === true && r.j.n === 1 && r.j.already === true, JSON.stringify(r.j));
    // B cancels a hold she won't pay for
    r = await post("/wear/reserve", { ...B, p: "jfk_wrap" });
    const wn = r.j.n;
    r = await post("/wear/cancel", { ...B, p: "jfk_wrap" });
    s = await get("/wear/stock");
    check("cancel gives a held number straight back", wn >= 1 && r.j.ok && s.j.stock.jfk_wrap.left === s.j.stock.jfk_wrap.total, JSON.stringify([wn, r.j, s.j.stock.jfk_wrap]));
    // deleting an account → her pieces go back to the world
    r = await post("/acct/delete", A);
    s = await get("/wear/stock");
    check("A deletes her account: the bag's No. 1 goes back (1 left)", r.j && r.j.ok && s.j.stock.jfk_bag.left === 1, JSON.stringify(s.j.stock.jfk_bag));
    // the rate limit
    const D = await account("D"); made.push(D);
    const t0 = await fetch(BASE + "/wear/reserve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...D, p: "jfk_trench" }) });
    const t1 = await fetch(BASE + "/wear/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...D, p: "jfk_trench" }) });
    check("two writes in a row from one account: the second is rate-limited", t0.status === 200 && t1.status === 429, `${t0.status} ${t1.status}`);
  }
} catch (e) {
  check("threw", false, String(e && e.stack || e));
} finally {
  for (const A of made) { try { await post("/acct/delete", A); } catch (e) { /* gone */ } }
  if (relay) relay.kill();
}
console.log(fails ? `✗ ${fails} failed` : "✓ wear fine");
process.exit(fails ? 1 : 0);
