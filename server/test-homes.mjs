// Tests for the 🏘️ property registry (homes.mjs) — against the LOCAL relay over HTTP (the same code the worker runs).
//   node server/test-homes.mjs        (starts local-relay.js on a private port; never touches production)
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { tagOf } from "./homes.mjs";

const PORT = 31000 + (process.pid % 20000);
const BASE = `http://127.0.0.1:${PORT}`;
const here = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const check = (label, ok, detail = "") => { console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? "  (" + detail + ")" : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const pid = () => Array.from({ length: 16 }, () => B32[Math.floor(Math.random() * 32)]).join("");
const sec = () => Array.from({ length: 32 }, () => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"[Math.floor(Math.random() * 64)]).join("");
async function post(p, body) { if (p !== "/homes/_clock") await sleep(330); const r = await fetch(BASE + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { st: r.status, j: await r.json().catch(() => null) }; }
async function get(p) { const r = await fetch(BASE + p); return { st: r.status, j: await r.json().catch(() => null) }; }
const clock = (days) => post("/homes/_clock", { offset: days * 86400000 });

const relay = spawn(process.execPath, [path.join(here, "local-relay.js")], { env: { ...process.env, PORT: String(PORT) }, stdio: ["ignore", "pipe", "pipe"] });
try {
  for (let k = 0; k < 40; k++) { try { if ((await fetch(BASE + "/health")).ok) break; } catch (e) { /* not yet */ } await sleep(150); }
  console.log("▶ homes registry (local relay)");
  const cfg = await get("/homes/config");
  check("GET /homes/config: the government's knobs", cfg.st === 200 && cfg.j.cfg.cap === 10 && cfg.j.cfg.idleDays === 14, JSON.stringify(cfg.j && cfg.j.cfg));
  const A = { pid: pid(), sec: sec(), name: "Kugel Kid" }, B = { pid: pid(), sec: sec(), name: "Latke Legend" };
  const h1 = "lakewood:178:240", h2 = "midwood:-12:88";
  let r = await post("/homes/claim", { ...A, h: h1 });
  check("A claims a house", r.j.ok === true && r.j.l === `Kugel Kid #${tagOf(A.pid)}`, JSON.stringify(r.j));
  await sleep(350);
  r = await post("/homes/claim", { ...B, h: h1 });
  check("B can't claim A's house (taken)", r.j.ok === false && r.j.why === "taken", JSON.stringify(r.j));
  const L = await get("/homes/list?town=lakewood");
  check("the town list shows it with A's GENERATED label, no player id, no secret", L.j.list.length === 1 && L.j.list[0].l === `Kugel Kid #${tagOf(A.pid)}` && !JSON.stringify(L.j).includes(A.pid) && !JSON.stringify(L.j).includes(A.sec), JSON.stringify(L.j.list));
  r = await post("/homes/claim", { pid: A.pid, sec: sec(), h: h2 });
  check("someone with A's id but the wrong secret is refused (no stealing)", r.st === 403, r.st);
  r = await post("/homes/release", { pid: B.pid, sec: B.sec, h: h1 });
  check("B can't release A's house", r.j.ok === false, JSON.stringify(r.j));
  r = await post("/homes/claim", { ...B, name: "<script>Bad words</script>", h: h2 });
  check("a typed name never becomes a label (unknown → a curated one)", r.j.ok && r.j.l === `Cholent Boy #${tagOf(B.pid)}`, JSON.stringify(r.j));
  r = await post("/homes/claim", { ...A, h: "lakewood:1:1; DROP TABLE homes" });
  check("a malformed house id is refused", r.st === 400);
  // the cap: 10
  const C = { pid: pid(), sec: sec(), name: "Babka Baron" };
  let got = 0, last = null;
  for (let k = 0; k < 12; k++) { await sleep(320); last = await post("/homes/claim", { ...C, h: `midwood:${k}:${k * 3}` }); if (last.j && last.j.ok) got++; }
  check("at most 10 houses per player (the 11th says cap)", got === 10 && last.j.why === "cap", `${got} · ${JSON.stringify(last.j)}`);
  // rate limit
  const D = { pid: pid(), sec: sec() };
  await post("/homes/claim", { ...D, h: "lakewood:5:5" });
  r = await fetch(BASE + "/homes/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...D, h: "lakewood:6:6" }) }).then((x) => ({ st: x.status }));
  check("claims are rate-limited per player", r.st === 429, r.st);
  // hello: my houses + label
  r = await post("/homes/hello", { ...A });
  check("hello: my houses + my label", r.j.mine.length === 1 && r.j.mine[0].h === h1 && r.j.label === `Kugel Kid #${tagOf(A.pid)}`, JSON.stringify(r.j));
  // THE GOVERNMENT: 15 days without A — seized; B (who said hello) keeps theirs
  await clock(13); await post("/homes/hello", { ...B }); await clock(15);
  await get("/homes/config");
  const L2 = await get("/homes/list?town=lakewood"), L3 = await get("/homes/list?town=midwood");
  check("14 days without a login: the Ordinance seizes A's house", L2.j.list.find((x) => x.h === h1).z === 1);
  check("…B played on day 13: B's house is still B's", L3.j.list.find((x) => x.h === h2).z === 0);
  await sleep(350);
  r = await post("/homes/claim", { ...B, h: h1 });
  check("a seized house can't be bought while the Council holds it", r.j.ok === false && r.j.why === "seized", JSON.stringify(r.j));
  r = await post("/homes/hello", { ...A });
  check("A comes back: hello lists the seized house (the court case)", r.j.mine.length === 1 && r.j.mine[0].z === 1);
  r = await post("/homes/appeal", { ...A, h: h1 });
  check("A appeals: the server rolls the verdict", r.j.ok === true && typeof r.j.won === "boolean", JSON.stringify(r.j));
  const won = r.j.won;
  const L4 = await get("/homes/list?town=lakewood"), row = L4.j.list.find((x) => x.h === h1);
  check(won ? "…won: the house is A's again" : "…lost: the house is back on the market", won ? row && row.z === 0 : !row);
  await sleep(350);
  r = await post("/homes/appeal", { ...A, h: h1 });
  check("one appeal per house", r.j.ok === false, JSON.stringify(r.j));
  // seized + nobody appeals for 7 more days → back on the market
  const E = { pid: pid(), sec: sec() };
  await post("/homes/claim", { ...E, h: "midwood:77:77" });
  await clock(15 + 15); await get("/homes/config");
  let row2 = (await get("/homes/list?town=midwood")).j.list.find((x) => x.h === "midwood:77:77");
  check("E idle 15 days: seized", row2 && row2.z === 1);
  await clock(15 + 15 + 8); await get("/homes/config");
  row2 = (await get("/homes/list?town=midwood")).j.list.find((x) => x.h === "midwood:77:77");
  check("…7 more days: back on the market", !row2);
  // the old protocol is untouched
  const b = await get("/board/scores");
  check("the old /board endpoints still answer", b.st === 200 && Array.isArray(b.j.list));
  console.log(fails ? `\ntest-homes: ${fails} FAILED` : "\ntest-homes: all passed");
} finally { relay.kill(); }
process.exit(fails ? 1 : 0);
