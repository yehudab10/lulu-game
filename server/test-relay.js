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
