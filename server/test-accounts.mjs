// Tests for 🪪 accounts (accounts.mjs) — against the LOCAL relay over HTTP (the same code the worker runs).
//   node server/test-accounts.mjs        (starts local-relay.js on a private port; never touches production)
//   node server/test-accounts.mjs --url https://…   (a deployed relay: only the read-only + throw-away-account checks)
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as R from "../3d/js/features/accounts/rules.js";

const ARG = process.argv.indexOf("--url");
const REMOTE = ARG > 0 ? process.argv[ARG + 1].replace(/\/$/, "").replace(/^ws/, "http") : "";
const PORT = 33000 + (process.pid % 20000);
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
  const k = body && body.pid;                          // the server's per-account write gap (400 ms)
  if (k) { const w = 520 - (Date.now() - (last.get(k) || 0)); if (w > 0) await sleep(w); last.set(k, Date.now()); }
  const r = await fetch(BASE + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { st: r.status, j: await r.json().catch(() => null) };
}
async function get(p) { await sleep(320); const r = await fetch(BASE + p); return { st: r.status, j: await r.json().catch(() => null) }; }
const clock = (days) => post("/acct/_clock", { offset: days * 86400000 });
const mk = () => ({ pid: pid(), sec: sec() });
const uniq = (b) => (b + Array.from({ length: 6 }, () => "abcdefghjkmnpqrstvwxyz"[Math.floor(Math.random() * 22)]).join("")).slice(0, 15);
const hello = (A, extra = {}) => post("/acct/hello", { ...A, ...extra });

let relay = null;
if (!REMOTE) relay = spawn(process.execPath, [path.join(here, "local-relay.js")], { env: { ...process.env, PORT: String(PORT) }, stdio: ["ignore", "pipe", "pipe"] });
const made = [];
try {
  for (let k = 0; k < 40; k++) { try { if ((await fetch(BASE + "/health")).ok) break; } catch (e) { /* not yet */ } await sleep(150); }
  console.log(`▶ accounts (${REMOTE ? "REMOTE " + BASE : "local relay"})`);

  // ── the shared rules file ──
  if (!REMOTE) {
    check("rules: a fine name", R.check("Lulu_K") === "" && R.check("Annalise") === "" && R.check("Something") === "");
    check("rules: shape", R.check("ab") === "short" && R.check("a".repeat(17)) === "long" && R.check("9lives") === "start" && R.check("Lu lu") === "chars" && R.check("Lu__lu") === "under" && R.check("Lulu_") === "under");
    check("rules: rude incl. spelled-around", ["fuck", "Fuuuck", "sh1t", "B1tch", "n1gger", "Big_Ass", "pu55y"].every((n) => R.check(n) === "rude"));
    check("rules: staff", ["Admin", "Lulu_Mod", "LuluOfficial", "Lulu_Team", "Support"].every((n) => R.check(n) === "staff"));
    check("rules: contact", ["Lulu12345", "Insta_Lulu", "DM_me", "snapchat", "Lulu_com"].every((n) => R.check(n) === "contact"));
    check("rules: look-alikes share a key", R.norm("Lulu_K") === R.norm("LULUK") && R.norm("LuIuK") === R.norm("1u1u_k") && R.norm("Burn") === R.norm("Bum"));
  }

  const cfg = await get("/acct/config");
  check("GET /acct/config", cfg.st === 200 && cfg.j.cfg && cfg.j.cfg.renameDays === 30, JSON.stringify(cfg.j));
  const s0 = await get("/acct/check?n=");
  check("3 one-tap suggestions with no typing", s0.j && s0.j.sugg && s0.j.sugg.length === 3 && s0.j.sugg.every((s) => !R.check(s)), JSON.stringify(s0.j));

  // ── accounts + names ──
  const A = mk(), B = mk(), C = mk(), D = mk();
  made.push(A, B, C, D);
  let r = await hello(A, { pk: "A".repeat(87) });
  check("hello makes an account (no name yet)", r.st === 200 && r.j.me.pid === A.pid && r.j.me.name === null && Array.isArray(r.j.friends), JSON.stringify(r.j));
  r = await hello({ pid: A.pid, sec: sec() });
  check("the wrong secret for an account is refused", r.st === 403);
  const nameA = uniq("zz_test_A");
  r = await post("/acct/name", { ...A, name: "Big_Ass" });
  check("a rude name is refused by the server", r.j.ok === false && r.j.why === "rude", JSON.stringify(r.j));
  r = await post("/acct/name", { ...A, name: nameA });
  check("pick a name", r.j.ok === true && r.j.name === nameA, JSON.stringify(r.j));
  r = await get("/acct/check?n=" + encodeURIComponent(nameA.toUpperCase()));
  check("that name is taken (any case) + 3 free suggestions", r.j.ok === false && r.j.why === "taken" && r.j.sugg.length === 3, JSON.stringify(r.j));
  await hello(B);
  const lookalike = nameA.replace("test", "7E5t");
  r = await post("/acct/name", { ...B, name: lookalike });
  check("a look-alike of a taken name is taken", r.j.ok === false && r.j.why === "taken", lookalike + " " + JSON.stringify(r.j));
  const nameB = uniq("zz_test_B");
  r = await post("/acct/name", { ...B, name: nameB });
  check("B picks a name", r.j.ok === true);
  r = await post("/acct/name", { ...A, name: uniq("zz_test_A2") });
  check("changing again within 30 days: wait", r.j.ok === false && r.j.why === "wait" && r.j.next > Date.now(), JSON.stringify(r.j));
  r = await post("/acct/name", { ...C, name: uniq("zz_test_C") });
  check("no account yet → refused (hello first)", r.st === 403);

  // ── friend requests (B offline the whole time: it all waits on the server) ──
  await hello(C); const nameC = uniq("zz_test_C"); await post("/acct/name", { ...C, name: nameC });
  r = await post("/acct/ask", { ...A, to: nameB.toLowerCase() });
  check("A asks B by name (any case)", r.j.ok === true && r.j.why === "sent" && r.j.f === B.pid, JSON.stringify(r.j));
  r = await post("/acct/ask", { ...A, to: "zz_nobody_here" });
  check("asking a name nobody has", r.j.ok === false && r.j.why === "none");
  r = await hello(B);
  check("B (back later) sees the request + a badge of 1", r.j.badge === 1 && r.j.inReq[0].f === A.pid && r.j.inReq[0].n === nameA, JSON.stringify(r.j.inReq));
  r = await hello(A);
  check("A sees it waiting", r.j.outReq.length === 1 && r.j.outReq[0].n === nameB);
  r = await post("/acct/answer", { ...B, f: A.pid, yes: true });
  check("B accepts", r.j.ok === true && r.j.why === "friends");
  r = await hello(A, { cards: { [B.pid]: "sealedNoteFromA_0123456789" } });
  check("A sees B as a friend (with B's name + key slot) and posts a sealed note", r.j.friends.length === 1 && r.j.friends[0].f === B.pid && r.j.friends[0].n === nameB && r.j.outReq.length === 0, JSON.stringify(r.j.friends));
  r = await hello(B);
  check("B gets A's sealed note + A's public key", r.j.friends[0].c === "sealedNoteFromA_0123456789" && r.j.friends[0].pk === "A".repeat(87), JSON.stringify(r.j.friends));
  // decline is silent + stops re-asks
  r = await post("/acct/ask", { ...C, to: nameB });
  check("C asks B", r.j.why === "sent");
  r = await post("/acct/answer", { ...B, f: C.pid, yes: false });
  check("B declines", r.j.ok === true);
  r = await hello(C);
  check("C isn't told (still shows as sent)", r.j.outReq.some((x) => x.f === B.pid));
  r = await post("/acct/ask", { ...C, to: nameB });
  r = await hello(B);
  check("…and asking again doesn't reach B", r.j.badge === 0 && !r.j.inReq.length, JSON.stringify(r.j.inReq));
  // mutual ask = friends
  await hello(D); const nameD = uniq("zz_test_D"); await post("/acct/name", { ...D, name: nameD });
  await post("/acct/ask", { ...D, to: nameC });
  r = await post("/acct/ask", { ...C, to: nameD });
  check("asking someone who asked you = friends", r.j.why === "friends");
  // remove
  r = await post("/acct/remove", { ...C, f: D.pid });
  r = await hello(D);
  check("remove: gone for both", !r.j.friends.some((x) => x.f === C.pid));
  // block
  await post("/acct/block", { ...B, f: D.pid });
  r = await post("/acct/ask", { ...D, to: nameB });
  check("a blocked player's ask says sent…", r.j.ok === true && r.j.why === "sent");
  r = await hello(B);
  check("…but never arrives; B's block list has them", !r.j.inReq.some((x) => x.f === D.pid) && r.j.blocks.some((x) => x.f === D.pid));
  await post("/acct/unblock", { ...B, f: D.pid });
  r = await hello(B);
  check("unblock", !r.j.blocks.length);
  // who can send me requests
  await post("/acct/set", { ...B, who: 2 });
  r = await post("/acct/ask", { ...D, to: nameB });
  check("'nobody' → closed", r.j.ok === false && r.j.why === "closed");
  await post("/acct/set", { ...B, who: 1 });
  r = await post("/acct/ask", { ...D, to: nameB });
  check("'friends of friends' with no shared friend → closed", r.j.why === "closed");
  await post("/acct/ask", { ...D, to: nameA }); await post("/acct/answer", { ...A, f: D.pid, yes: true });
  r = await post("/acct/ask", { ...D, to: nameB });
  check("'friends of friends' with A in common → sent", r.j.why === "sent", JSON.stringify(r.j));
  await post("/acct/set", { ...B, who: 0 });

  // ── the migration of on-device friendships ──
  const E = mk(), F = mk(); made.push(E, F);
  r = await hello(E, { claims: [F.pid] });
  check("E's phone says F is a friend (F not updated yet): nothing shows", r.j.friends.length === 0 && r.j.claims.includes(F.pid));
  r = await hello(F, { claims: [E.pid] });
  check("F updates and says the same → friends on the server", r.j.friends.some((x) => x.f === E.pid));
  r = await hello(E);
  check("…and E sees it", r.j.friends.some((x) => x.f === F.pid) && !r.j.claims.length);
  const G = mk(); made.push(G);
  r = await hello(G, { claims: [A.pid] });
  r = await hello(A);
  check("a one-sided claim never shows to the other side", !r.j.friends.some((x) => x.f === G.pid) && !r.j.inReq.some((x) => x.f === G.pid));

  // ── tickets: names for players in a room ──
  r = await post("/acct/ticket", { ...A, room: "LOBBY", rid: "ab12" });
  check("a ticket for my relay connection", typeof r.j.t === "string" && r.j.t.startsWith(A.pid + "."), JSON.stringify(r.j));
  const tA = r.j.t;
  r = await post("/acct/names", { q: [["LOBBY", "ab12", tA], ["LOBBY", "zz99", tA], ["P123", "ab12", tA], ["LOBBY", "ab12", tA.slice(0, -2) + "xx"]] });
  check("names: right connection → the name; another connection / room / a forged one → nothing", JSON.stringify(r.j.n) === JSON.stringify([nameA, null, null, null]), JSON.stringify(r.j));
  r = await post("/acct/ticket", { ...E, room: "LOBBY", rid: "e1" });
  check("no name yet → no ticket", r.j.t === null);

  // ── reports (3 different accounts, each a day old) ──
  const reporters = [mk(), mk(), mk(), mk()]; made.push(...reporters);
  for (const X of reporters) await hello(X);
  const T = mk(); made.push(T); await hello(T); const nameT = uniq("zz_test_T"); await post("/acct/name", { ...T, name: nameT });
  r = await post("/acct/report", { ...reporters[0], f: T.pid });
  check("a brand-new account's report doesn't count", r.j.ok === true && r.j.counted === false);
  if (!REMOTE) {
    await clock(2);
    for (const X of reporters.slice(0, 2)) await hello(X);
    await post("/acct/report", { ...reporters[0], f: T.pid });
    await post("/acct/report", { ...reporters[0], f: T.pid });          // the same reporter twice = once
    r = await post("/acct/report", { ...reporters[1], f: T.pid });
    let h = await hello(T);
    check("two reports: still the same name", h.j.me.name === nameT && !r.j.replaced);
    r = await post("/acct/report", { ...reporters[2], t: (await post("/acct/ticket", { ...T, room: "LOBBY", rid: "t1" })).j.t, room: "LOBBY", rid: "t1" });
    h = await hello(T);
    check("the third (by ticket, from a ghost) → the name is replaced + she's asked to pick again", r.j.replaced === true && h.j.me.name !== nameT && h.j.me.gen === 1 && h.j.me.ask === 1 && !R.check(h.j.me.name), JSON.stringify(h.j.me));
    r = await get("/acct/check?n=" + nameT);
    check("the reported name is retired", r.j.why === "retired");
    r = await post("/acct/name", { ...T, name: uniq("zz_test_T2") });
    check("she can pick a new one right away (no 30-day wait)", r.j.ok === true, JSON.stringify(r.j));
    await clock(31);
    r = await post("/acct/name", { ...A, name: uniq("zz_test_A3") });
    check("after 30 days she can change her name", r.j.ok === true, JSON.stringify(r.j));
    await clock(0);
  }

  // ── rate limits / caps ──
  const S = mk(); made.push(S); await hello(S); await post("/acct/name", { ...S, name: uniq("zz_test_S") });
  const targets = [];
  for (let k = 0; k < 11; k++) { const X = mk(); made.push(X); await hello(X); const n = uniq("zz_test_x"); await post("/acct/name", { ...X, name: n }); targets.push(n); }
  let sent = 0, slow = 0;
  for (const n of targets) { r = await post("/acct/ask", { ...S, to: n }); if (r.j && r.j.why === "sent") sent++; if (r.st === 429) slow++; }
  check("at most 10 requests an hour from one account", sent === 10 && slow === 1, `${sent} sent, ${slow} slowed`);
  r = await post("/acct/name", { ...S, name: "x" });
  let big = 0;
  try { big = (await fetch(BASE + "/acct/hello", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" + "x".repeat(20000) })).status; } catch (e) { big = 999; }
  check("an oversized body is refused", big >= 400, big);

  // ── homes: an account's secret guards its id there too ──
  r = await post("/homes/claim", { pid: A.pid, sec: sec(), h: "lakewood:5:5" });
  check("homes: someone with A's id but not A's secret is refused", r.st === 403);
  if (!REMOTE) {
    r = await post("/homes/claim", { ...A, name: "Kugel Kid", h: "lakewood:7:7" });
    const L = await get("/homes/list?town=lakewood");
    const mine = L.j.list.find((x) => x.h === "lakewood:7:7");
    check("homes: the town list shows the owner's username", r.j.ok && mine && /^zz_test_A/.test(mine.l), JSON.stringify(L.j.list));
  }

  // ── delete ──
  for (const X of made) { const d = await post("/acct/delete", X); if (d.st !== 200 && d.st !== 403) console.log("delete?", d.st); }
  r = await get("/acct/check?n=" + nameB);
  check("deleted accounts free their names", r.j.ok === true, JSON.stringify(r.j));
  r = await post("/acct/name", { ...B, name: uniq("zz_test_B") });
  check("a deleted account is gone", r.st === 403);
} catch (e) {
  console.log("  ✗ crashed:", e && e.stack); fails++;
} finally {
  if (relay) relay.kill();
}
console.log(fails ? `✗ ${fails} failed` : "✓ all passed");
process.exit(fails ? 1 : 0);
