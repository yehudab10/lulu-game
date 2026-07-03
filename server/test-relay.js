// Protocol conformance test for the Shared Road relay.
//
// Spins up local-relay.js in-process, then drives WebSocket clients through
// the full protocol and asserts the fan-out behaviour, room isolation, and
// the 24-member cap.
//
//   node test-relay.js
//
// Exits non-zero on the first failed assertion.

const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

let WebSocket;
try {
  WebSocket = require("ws");
} catch (_) {
  console.error("test needs the `ws` client package (npm install)");
  process.exit(2);
}

const PORT = 9988; // separate port so it won't collide with a running dev relay
const BASE = `ws://127.0.0.1:${PORT}`;

let pass = 0;
let fail = 0;
function assert(cond, label) {
  if (cond) {
    pass++;
    console.log("  ok  - " + label);
  } else {
    fail++;
    console.log("  FAIL- " + label);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A small client wrapper that records every server message.
function connect(room, autojoin) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BASE}/room/${room}`);
    ws.inbox = [];
    ws.on("message", (data) => {
      try {
        ws.inbox.push(JSON.parse(data.toString()));
      } catch (_) {}
    });
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}
function join(ws, name, sk) {
  ws.send(JSON.stringify({ t: "j", v: 1, room: "X", name, sk }));
}
function last(ws, type) {
  for (let i = ws.inbox.length - 1; i >= 0; i--) if (ws.inbox[i].t === type) return ws.inbox[i];
  return null;
}
function count(ws, type) {
  return ws.inbox.filter((m) => m.t === type).length;
}

// Plain-HTTP request to the board endpoints on the same port. `ip` sets a
// fake CF-Connecting-IP so we control per-IP rate limiting from the test.
function httpReq(method, pathname, body, ip) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : Buffer.from(JSON.stringify(body));
    const headers = {};
    if (payload) {
      headers["content-type"] = "application/json";
      headers["content-length"] = payload.length;
    }
    if (ip) headers["cf-connecting-ip"] = ip;
    const req = http.request(
      { host: "127.0.0.1", port: PORT, method, path: pathname, headers },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, json });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  // ---- boot the relay -----------------------------------------------------
  const relay = spawn(process.execPath, [path.join(__dirname, "local-relay.js")], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  relay.stdout.on("data", (d) => process.stdout.write("[relay] " + d));
  relay.stderr.on("data", (d) => process.stderr.write("[relay] " + d));
  await sleep(600);

  try {
    // ---- 1. two clients join the same room --------------------------------
    console.log("\n# join + hello + peer-joined");
    const a = await connect("ROOM1");
    join(a, "Cholent Boy", "pink");
    await sleep(100);
    const helloA = last(a, "h");
    assert(helloA && typeof helloA.id === "string", "A receives hello with an id");
    assert(helloA && Array.isArray(helloA.peers) && helloA.peers.length === 0, "A hello peers empty (first in)");

    const b = await connect("ROOM1");
    join(b, "Kugel Kid", "blue");
    await sleep(100);
    const helloB = last(b, "h");
    assert(helloB && helloB.peers.length === 1, "B hello lists 1 peer (A)");
    assert(helloB && helloB.peers[0].id === helloA.id, "B hello peer id matches A");
    assert(helloB && helloB.peers[0].name === "Cholent Boy", "B hello carries A's name");

    const plusA = last(a, "+");
    assert(plusA && plusA.id === helloB.id, "A gets '+' for B");
    assert(plusA && plusA.name === "Kugel Kid" && plusA.sk === "blue", "A '+' carries B name+sk");

    // ---- 2. state fan-out (only to others) --------------------------------
    console.log("\n# state relay");
    a.inbox.length = 0;
    b.inbox.length = 0;
    const stateD = { m: 0, x: 220, di: 123456, sp: 340, vk: "car" };
    a.send(JSON.stringify({ t: "s", d: stateD }));
    await sleep(80);
    const sB = last(b, "s");
    assert(sB && sB.id === helloA.id, "B receives A's state tagged with A id");
    assert(sB && sB.d && sB.d.di === 123456, "B state payload intact");
    assert(count(a, "s") === 0, "A does NOT receive its own state (no echo)");

    // ---- 3. event fan-out (honk) ------------------------------------------
    console.log("\n# event relay (honk)");
    b.inbox.length = 0;
    a.send(JSON.stringify({ t: "e", e: "honk" }));
    await sleep(80);
    const eB = last(b, "e");
    assert(eB && eB.e === "honk" && eB.id === helloA.id, "B receives A's honk");

    // ---- 4. ping/pong -----------------------------------------------------
    console.log("\n# ping/pong");
    a.inbox.length = 0;
    a.send(JSON.stringify({ t: "pi" }));
    await sleep(80);
    assert(last(a, "po") !== null, "A gets pong for ping");

    // ---- 5. room isolation -------------------------------------------------
    console.log("\n# room isolation");
    const c = await connect("ROOM2");
    join(c, "Other Room", "green");
    await sleep(100);
    const helloC = last(c, "h");
    assert(helloC && helloC.peers.length === 0, "C in ROOM2 sees no peers");
    a.inbox.length = 0;
    c.send(JSON.stringify({ t: "s", d: { m: 1, x: 10, di: 5, sp: 0 } }));
    await sleep(80);
    assert(count(a, "s") === 0, "ROOM1 client A gets nothing from ROOM2 client C");

    // ---- 6. peer-left ------------------------------------------------------
    console.log("\n# peer left");
    a.inbox.length = 0;
    b.close();
    await sleep(150);
    const minus = last(a, "-");
    assert(minus && minus.id === helloB.id, "A receives '-' when B disconnects");

    // ---- 7. rate limit (8/sec) --------------------------------------------
    console.log("\n# state rate limit (8/sec)");
    // reconnect a fresh partner to observe A's bursts
    const d = await connect("ROOM1");
    join(d, "Watcher", "pink");
    await sleep(100);
    d.inbox.length = 0;
    for (let i = 0; i < 20; i++) a.send(JSON.stringify({ t: "s", d: { m: 0, x: i, di: i, sp: 1 } }));
    await sleep(200);
    const got = count(d, "s");
    assert(got <= 8, `<=8 state msgs relayed in one window (got ${got})`);
    assert(got >= 1, "at least 1 state msg relayed");

    // ---- 8. 24-member cap --------------------------------------------------
    console.log("\n# 24-member cap");
    const capClients = [];
    // ROOM1 already has A and D (2 members). Fill to 24, then 25th rejected.
    for (let i = 0; i < 22; i++) {
      const w = await connect("ROOM1");
      join(w, "Filler" + i, "pink");
      capClients.push(w);
      await sleep(15);
    }
    await sleep(150);
    // now 24 members. The 25th should be closed with 4001.
    const over = await connect("ROOM1");
    let closeCode = null;
    over.on("close", (code) => (closeCode = code));
    join(over, "TooMany", "pink");
    await sleep(250);
    assert(closeCode === 4001, `25th member rejected with close 4001 (got ${closeCode})`);
    assert(last(over, "h") === null, "25th member never got a hello");

    // ---- 9. oversized frame dropped ---------------------------------------
    console.log("\n# oversized frame dropped");
    d.inbox.length = 0;
    const huge = "z".repeat(3000);
    a.send(JSON.stringify({ t: "s", d: { m: 0, x: 1, di: 1, sp: 1, junk: huge } }));
    await sleep(100);
    assert(count(d, "s") === 0, ">2KB frame is dropped (not relayed)");

    // ---- 10. async board: wanted roundtrip --------------------------------
    console.log("\n# board: wanted post + get roundtrip");
    const w1 = await httpReq(
      "POST",
      "/board/wanted",
      { name: "Cholent Boy", charges: ["GRAND THEFT AUTO", "SPEEDING"] },
      "10.0.0.1"
    );
    assert(w1.status === 204, `valid wanted POST → 204 (got ${w1.status})`);
    assert(
      w1.headers["access-control-allow-origin"] === "*",
      "wanted POST carries CORS allow-origin *"
    );
    const wg = await httpReq("GET", "/board/wanted", null, "10.0.0.9");
    assert(wg.status === 200 && wg.json && Array.isArray(wg.json.list), "GET wanted returns a list");
    const found = wg.json.list.find((x) => x.name === "Cholent Boy");
    assert(!!found, "posted wanted poster appears in GET");
    assert(
      found &&
        found.charges.length === 2 &&
        found.charges[0] === "GRAND THEFT AUTO",
      "wanted charges round-tripped intact"
    );
    assert(
      wg.headers["access-control-allow-origin"] === "*",
      "GET wanted carries CORS allow-origin *"
    );

    // ---- 11. board: curated-name rejection --------------------------------
    console.log("\n# board: curated-name validation");
    const bad = await httpReq(
      "POST",
      "/board/wanted",
      { name: "H4X0R Kid", charges: ["SPEEDING"] },
      "10.0.0.2"
    );
    assert(bad.status === 400, `non-curated name → 400 (got ${bad.status})`);
    const badScore = await httpReq(
      "POST",
      "/board/score",
      { name: "Not Real", score: 999 },
      "10.0.0.3"
    );
    assert(badScore.status === 400, `non-curated score name → 400 (got ${badScore.status})`);

    // ---- 12. board: oversized/too-many charges truncated ------------------
    console.log("\n# board: charge sanitation (truncate)");
    const longCharge = "X".repeat(50) + "!!!bad$$$"; // >32 chars + illegal chars
    const cs = await httpReq(
      "POST",
      "/board/wanted",
      {
        name: "Babka Baron",
        charges: [longCharge, "RECKLESS DRIVING", "JAYWALKING", "FOURTH ONE"],
      },
      "10.0.0.4"
    );
    assert(cs.status === 204, `oversized-charge POST accepted → 204 (got ${cs.status})`);
    const cg = await httpReq("GET", "/board/wanted", null, "10.0.0.9");
    const baron = cg.json.list.find((x) => x.name === "Babka Baron");
    assert(!!baron, "sanitized poster present");
    assert(baron && baron.charges.length === 3, `charges capped at 3 (got ${baron ? baron.charges.length : "?"})`);
    assert(
      baron && baron.charges[0].length <= 32 && !/[^A-Z0-9()&' ]/.test(baron.charges[0]),
      "first charge truncated to ≤32 chars and stripped of illegal chars"
    );

    // ---- 13. board: wanted retention cap (GET ≤12, newest first) ----------
    console.log("\n# board: wanted retention / newest-first");
    for (let i = 0; i < 15; i++) {
      // distinct IPs to sidestep the 20s per-IP throttle
      await httpReq(
        "POST",
        "/board/wanted",
        { name: "Kugel Kid", charges: ["TAG " + i] },
        "10.9." + i + ".1"
      );
    }
    const rg = await httpReq("GET", "/board/wanted", null, "10.0.0.9");
    assert(rg.json.list.length === 12, `GET wanted capped at 12 (got ${rg.json.list.length})`);
    assert(
      rg.json.list[0].charges[0] === "TAG 14",
      `newest poster first (got ${rg.json.list[0].charges[0]})`
    );

    // ---- 14. board: score best-per-day upsert -----------------------------
    console.log("\n# board: score best-per-day upsert");
    const s1 = await httpReq("POST", "/board/score", { name: "Latke Legend", score: 12345 }, "11.0.0.1");
    assert(s1.status === 204, `score POST → 204 (got ${s1.status})`);
    // lower score for the SAME name (different IP to avoid the throttle)
    const s2 = await httpReq("POST", "/board/score", { name: "Latke Legend", score: 5000 }, "11.0.0.2");
    assert(s2.status === 204, `lower score POST → 204 (got ${s2.status})`);
    const sg = await httpReq("GET", "/board/scores", null, "11.0.0.9");
    assert(sg.status === 200 && sg.json && sg.json.day, "GET scores returns day + list");
    const latke = sg.json.list.find((x) => x.name === "Latke Legend");
    assert(latke && latke.score === 12345, `best-per-day kept the higher score (got ${latke ? latke.score : "?"})`);

    // ---- 15. board: score clamp -------------------------------------------
    console.log("\n# board: score clamp to 2e6");
    await httpReq("POST", "/board/score", { name: "Gefilte Ghost", score: 9999999999 }, "11.0.0.3");
    const sg2 = await httpReq("GET", "/board/scores", null, "11.0.0.9");
    const ghost = sg2.json.list.find((x) => x.name === "Gefilte Ghost");
    assert(ghost && ghost.score === 2000000, `huge score clamped to 2e6 (got ${ghost ? ghost.score : "?"})`);

    // ---- 16. board: per-IP rate limit (429) -------------------------------
    console.log("\n# board: per-IP rate limit");
    const rl1 = await httpReq("POST", "/board/wanted", { name: "Shabbos Racer", charges: ["SPEEDING"] }, "12.0.0.1");
    assert(rl1.status === 204, `first wanted from IP → 204 (got ${rl1.status})`);
    const rl2 = await httpReq("POST", "/board/wanted", { name: "Shabbos Racer", charges: ["SPEEDING"] }, "12.0.0.1");
    assert(rl2.status === 429, `immediate second wanted from same IP → 429 (got ${rl2.status})`);

    // ---- 17. board: CORS preflight ----------------------------------------
    console.log("\n# board: OPTIONS preflight");
    const pre = await httpReq("OPTIONS", "/board/wanted", null, "13.0.0.1");
    assert(pre.status === 204, `OPTIONS preflight → 204 (got ${pre.status})`);
    assert(
      pre.headers["access-control-allow-origin"] === "*" &&
        /POST/.test(pre.headers["access-control-allow-methods"] || ""),
      "preflight advertises CORS origin + methods"
    );

    // cleanup
    [a, c, d, over, ...capClients].forEach((w) => {
      try {
        w.close();
      } catch (_) {}
    });
  } catch (err) {
    console.error("test error:", err);
    fail++;
  } finally {
    await sleep(100);
    relay.kill();
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
