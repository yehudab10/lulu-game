// Tests for 🌍 one shared world, steps 1 + 2 (world.mjs) — against the LOCAL relay (the same code the worker runs), or
// a deployed relay with --url (throw-away rooms named ZZWORLD…; nothing stored).
//   node server/test-world.mjs            node server/test-world.mjs --url https://…
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ARG = process.argv.indexOf("--url");
const REMOTE = ARG > 0 ? process.argv[ARG + 1].replace(/\/$/, "").replace(/^ws/, "http") : "";
const PORT = 35000 + (process.pid % 20000);
const BASE = REMOTE || `http://127.0.0.1:${PORT}`;
const WSB = BASE.replace(/^http/, "ws");
const here = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const check = (l, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗"} ${l}${d && !ok ? "  (" + d + ")" : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function client(room, name = "Kugel Kid") {
  const ws = new WebSocket(`${WSB}/room/${room}`);
  const c = { ws, msgs: [], open: new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }) };
  ws.onmessage = (e) => { try { c.msgs.push(JSON.parse(e.data)); } catch (_) {} };
  c.send = (o) => ws.send(JSON.stringify(o));
  c.join = async () => { await c.open; c.send({ t: "j", v: 1, name, sk: "pink" }); return c.wait((m) => m.t === "h"); };
  c.wait = async (fn, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = c.msgs.find(fn); if (m) return m; await sleep(25); } return null; };
  c.all = (fn) => c.msgs.filter(fn);
  return c;
}

let relay = null;
if (!REMOTE) relay = spawn(process.execPath, [path.join(here, "local-relay.js")], { env: { ...process.env, PORT: String(PORT), WORLD_KEEP_MS: "1500" }, stdio: ["ignore", "pipe", "pipe"] });
try {
  for (let k = 0; k < 40; k++) { try { if ((await fetch(BASE + "/health")).ok) break; } catch (e) { /* not yet */ } await sleep(150); }
  console.log(`▶ world (${REMOTE ? "REMOTE " + BASE : "local relay"})`);
  const room = "ZZWORLD" + Math.floor(Math.random() * 1e5);

  // ── kill switches + the server clock over HTTP ──
  const t0 = Date.now();
  const cfg = await fetch(BASE + "/world/config").then((r) => r.json());
  check("GET /world/config: the flags + the server time", cfg.world && cfg.world.clock === 1 && cfg.world.reliable === 1 && cfg.world.place === 0 && Math.abs(cfg.st - (t0 + Date.now()) / 2) < 5000, JSON.stringify(cfg));

  // ── step 1: the clock ──
  const A = client(room), B = client(room, "Latke Legend");
  const ha = await A.join();
  check("hello carries the server time (st)", ha && typeof ha.st === "number" && Array.isArray(ha.peers), JSON.stringify(ha));
  const rtts = [];
  for (let k = 0; k < 8; k++) {
    const n = "p" + k, s0 = performance.now(), w0 = Date.now();
    A.send({ t: "pi", n });
    const po = await A.wait((m) => m.t === "po" && m.n === n, 3000);
    if (po) rtts.push({ rtt: performance.now() - s0, off: po.st - (w0 + (performance.now() - s0) / 2) });
  }
  check("a pong echoes the ping's n and carries st", rtts.length === 8, rtts.length);
  const best = rtts.sort((a, b) => a.rtt - b.rtt)[0];
  console.log(`    (round trip ${best.rtt.toFixed(1)} ms; this machine's clock vs the server's: ${best.off.toFixed(1)} ms)`);
  check("the clock estimate is within half a round trip (+ clock skew allowance)", Math.abs(best.off) < (REMOTE ? 2000 : best.rtt / 2 + 5), best.off.toFixed(1));
  A.send({ t: "pi" });
  const plain = await A.wait((m) => m.t === "po" && !m.n, 3000);
  check("an old-style ping still gets a pong", !!plain);

  // ── step 2: server timestamps on states ──
  await B.join();
  B.send({ t: "s", d: { m: 0, x: 240, di: 5, sp: 0, vk: "car", newField: "kept" } });
  const st = await A.wait((m) => m.t === "s");
  check("a passed-on state carries st, and unknown fields pass through untouched", st && typeof st.st === "number" && st.d.newField === "kept" && st.d.di === 5, JSON.stringify(st));

  // ── step 2: reliable events ──
  B.send({ t: "r", id: "ev1", k: "emote", d: { i: 3 } });
  const ev = await A.wait((m) => m.t === "r" && m.id === "ev1");
  const ack = await B.wait((m) => m.t === "ra" && m.id === "ev1");
  check("an event reaches the others once, with who sent it + st", ev && ev.from === (await B.wait((m) => m.t === "h")).id && ev.k === "emote" && ev.d.i === 3 && typeof ev.st === "number", JSON.stringify(ev));
  check("…and the sender gets an ack", !!ack);
  check("…not echoed back to the sender", !B.msgs.some((m) => m.t === "r"));
  const C = client(room, "Babka Baron");
  const hc = await C.join();
  check("a player who arrives late gets it in her hello", hc && Array.isArray(hc.r) && hc.r.some((e) => e.id === "ev1"), JSON.stringify(hc && hc.r));
  // limits (a fresh 1 s window first)
  await sleep(1100);
  for (let k = 0; k < 7; k++) B.send({ t: "r", id: "burst" + k, k: "ping", d: {} });
  await sleep(600);
  check("≤ 4 events a second per player", A.all((m) => m.t === "r" && /^burst/.test(m.id)).length === 4, A.all((m) => m.t === "r" && /^burst/.test(m.id)).length);
  await sleep(1100);
  B.send({ t: "r", id: "big", k: "ping", d: { x: "y".repeat(700) } });
  B.send({ t: "r", id: "bad id!", k: "ping", d: {} });
  B.send({ t: "r", id: "badk", k: "Ping Pong", d: {} });
  B.send({ t: "r", id: "arr", k: "ping", d: [1, 2] });
  await sleep(500);
  check("oversized / malformed events are dropped", !A.msgs.some((m) => m.t === "r" && ["big", "bad id!", "badk", "arr"].includes(m.id)));
  if (!REMOTE) {
    await sleep(1600);
    const D = client(room, "Kugel Kid");
    const hd = await D.join();
    check("events older than the room keeps them (20 s; 1.5 s in this test) aren't replayed", hd && !(hd.r || []).some((e) => e.id === "ev1"), JSON.stringify(hd && hd.r));
    D.ws.close();
  }
  // ── step 3 (rooms by place: listeners + the place-room cap) — local only until the owner is on the Paid plan ──
  if (!REMOTE) {
    const place = "WZZ" + Math.floor(Math.random() * 1e4);
    const P1 = client(place), L1 = client(place, "Kugel Kid");
    await P1.join();
    await L1.open; L1.send({ t: "j", v: 1, name: "Kugel Kid", sk: "pink", lo: 1 });
    const hl = await L1.wait((m) => m.t === "h");
    check("a listener joins (hello)", !!hl);
    await sleep(200);
    check("…isn't announced to the players", !P1.msgs.some((m) => m.t === "+"));
    const P2 = client(place, "Latke Legend");
    const h2 = await P2.join();
    check("…isn't listed in a newcomer's hello", h2 && h2.peers.length === 1, JSON.stringify(h2 && h2.peers));
    P1.send({ t: "s", d: { m: 0, x: 1, di: 7 } });
    P1.send({ t: "r", id: "pl1", k: "ping", d: {} });
    check("…hears the room's states and events", !!(await L1.wait((m) => m.t === "s" && m.d.di === 7)) && !!(await L1.wait((m) => m.t === "r" && m.id === "pl1")));
    L1.send({ t: "s", d: { m: 0, x: 1, di: 99 } });
    L1.send({ t: "r", id: "lsay", k: "ping", d: {} });
    await sleep(400);
    check("…and says nothing (its states / events are dropped)", !P1.msgs.some((m) => (m.t === "s" && m.d.di === 99) || (m.t === "r" && m.id === "lsay")));
    L1.ws.close(); await sleep(200);
    check("…and leaves without a goodbye", !P1.msgs.some((m) => m.t === "-"));
    const many = [];
    for (let k = 0; k < 38; k++) { const c = client(place, "Kugel Kid"); many.push(c); await c.join(); }
    const extra = client(place, "Kugel Kid");
    await extra.open; extra.send({ t: "j", v: 1, name: "Kugel Kid", sk: "pink" });
    const closed = await new Promise((r) => { extra.ws.onclose = (e) => r(e.code); setTimeout(() => r(0), 3000); });
    check("a place room holds 40 players, the 41st is refused (4001)", closed === 4001 && many.length + 2 === 40, closed);
    const L2 = client(place, "Kugel Kid");
    await L2.open; L2.send({ t: "j", v: 1, name: "Kugel Kid", sk: "pink", lo: 1 });
    check("…but a listener still gets in", !!(await L2.wait((m) => m.t === "h")));
    for (const c of [P1, P2, L2, ...many]) c.ws.close();
    const old = "ZZOLD" + Math.floor(Math.random() * 1e4), olds = [];
    for (let k = 0; k < 24; k++) { const c = client(old); olds.push(c); await c.join(); }
    const o25 = client(old); await o25.open; o25.send({ t: "j", v: 1, name: "Kugel Kid", sk: "pink" });
    const oc = await new Promise((r) => { o25.ws.onclose = (e) => r(e.code); setTimeout(() => r(0), 3000); });
    check("an old-style room still holds 24", oc === 4001, oc);
    for (const c of olds) c.ws.close();
  }

  // ── the free-plan budget ──
  const u = await fetch(BASE + "/world/usage").then((r) => r.json());
  check("GET /world/usage: today's estimate", typeof u.pct === "number" && u.freeDoRequests === 100000 && u.resetInMin > 0 && (REMOTE || u.wsMessages > 10), JSON.stringify(u));
  const txt = await fetch(BASE + "/world/usage?text=1").then((r) => r.text());
  check("…and as a sentence", /free daily allowance/.test(txt), txt);
  for (const x of [A, B, C]) x.ws.close();
} catch (e) {
  console.log("  ✗ crashed:", e && e.stack); fails++;
} finally {
  if (relay) relay.kill();
}
console.log(fails ? `✗ ${fails} failed` : "✓ all passed");
process.exit(fails ? 1 : 0);
