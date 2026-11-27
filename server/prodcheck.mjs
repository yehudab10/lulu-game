// A quick check of a DEPLOYED relay after a deploy (read-only for everything old; the accounts part uses throw-away
// zz_test_… accounts and deletes them):  node server/prodcheck.mjs https://lulu-shared-road.<sub>.workers.dev
//   • an old-style EVERYONE join (the 2D game's: a curated name) → hello; a second client sees it join + its state
//   • a party-style join ("name|uid" in a private room) → hello
//   • /health, /board/scores, /board/wanted, /homes/config, /homes/list still answer the same shapes
//   • then server/test-accounts.mjs --url (the accounts endpoints end to end) and server/test-wear.mjs --url (👜 the
//     limited-piece stock + one throw-away hold that's cancelled)
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = (process.argv[2] || "").replace(/\/$/, "").replace(/^ws/, "http");
if (!BASE) { console.log("usage: node server/prodcheck.mjs https://…"); process.exit(2); }
const WSB = BASE.replace(/^http/, "ws");
let fails = 0;
const check = (l, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗"} ${l}${d && !ok ? "  (" + d + ")" : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function client(room, name) {
  const ws = new WebSocket(`${WSB}/room/${room}`);
  const c = { ws, msgs: [], open: new Promise((r) => { ws.onopen = r; }) };
  ws.onmessage = (e) => { try { c.msgs.push(JSON.parse(e.data)); } catch (_) {} };
  c.join = async () => { await c.open; ws.send(JSON.stringify({ t: "j", v: 1, room, name, sk: "gold" })); };
  c.wait = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = c.msgs.find(fn); if (m) return m; await sleep(50); } return null; };
  return c;
}
console.log("▶ prodcheck", BASE);
const h = await fetch(BASE + "/health").then((r) => r.text()).catch(() => "");
check("/health", /relay OK/.test(h), h);
// an old-style EVERYONE room (a private shard name so real players aren't disturbed)
const room = "ZZCHECK" + Math.floor(Math.random() * 1e4);
const a = client(room, "Kugel Kid"), b = client(room, "Latke Legend");
await a.join();
const ha = await a.wait((m) => m.t === "h");
check("old-style join → hello with an id", !!(ha && ha.id && Array.isArray(ha.peers)), JSON.stringify(ha));
await b.join();
const plus = await a.wait((m) => m.t === "+");
check("…a second client's join reaches the first (curated name kept)", !!(plus && plus.name === "Latke Legend"), JSON.stringify(plus));
b.ws.send(JSON.stringify({ t: "s", d: { m: 0, x: 240, di: 100, sp: 0, vk: "car" } }));
const st = await a.wait((m) => m.t === "s");
check("…its state fans out unchanged", !!(st && st.d && st.d.di === 100 && st.d.vk === "car"), JSON.stringify(st));
a.ws.close(); b.ws.close();
// a party-style room
const p = client("PZZ" + Math.floor(Math.random() * 1e5), "Kugel Kid|zzuid" + Date.now().toString(36));
await p.join();
const hp = await p.wait((m) => m.t === "h");
check("party-style join → hello", !!(hp && hp.id), JSON.stringify(hp));
p.ws.close();
const sc = await fetch(BASE + "/board/scores").then((r) => r.json()).catch(() => null);
check("/board/scores", !!(sc && Array.isArray(sc.list)), JSON.stringify(sc));
const wa = await fetch(BASE + "/board/wanted").then((r) => r.json()).catch(() => null);
check("/board/wanted", !!(wa && Array.isArray(wa.list)), JSON.stringify(wa).slice(0, 200));
const hc = await fetch(BASE + "/homes/config").then((r) => r.json()).catch(() => null);
check("/homes/config", !!(hc && hc.cfg && hc.cfg.cap), JSON.stringify(hc));
const hl = await fetch(BASE + "/homes/list?town=lakewood").then((r) => r.json()).catch(() => null);
check("/homes/list", !!(hl && Array.isArray(hl.list)), JSON.stringify(hl).slice(0, 200));
console.log(fails ? `✗ ${fails} failed (old protocol)` : "✓ old protocol fine");
const here = path.dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [path.join(here, "test-accounts.mjs"), "--url", BASE], { stdio: "inherit" });
// 👜 limited luxury pieces (ci/clothes): the stock answers; a throw-away account holds one number and lets it go
const ws = spawnSync(process.execPath, [path.join(here, "test-wear.mjs"), "--url", BASE], { stdio: "inherit" });
process.exit(fails || r.status || ws.status ? 1 : 0);
