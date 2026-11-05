// Shared Road against the LOCAL relay (never production): server/local-relay.js
// on a private port + a fake 2D player (Node's WebSocket) speaking protocol v1.
// Checks: name picker + connect from the title with the controller-navigable
// screen, the 3D client's state arrives in the 2D format (x/di/sp/m/vk), a 2D
// ghost renders on the 3D road, honks both ways, the emote wheel (hold LB +
// right stick → d.em), party record toasts, friend room switch, a friend race
// (invite → countdown → standings → winner), TAG start + pass, BONK, convoy,
// party parking (room-seeded lot = the 2D layout, pk poses both ways), the
// daily leaderboard POST, disconnect / opt-out, and cruise auto-join.
const { spawn } = require("child_process");
const path = require("path");
const PORT = 20000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const S = `__lulu3d.ctx.mp._debug`;
let relay = null;

function startRelay() {
  return new Promise((resolve, reject) => {
    relay = spawn(process.execPath, [path.join(__dirname, "..", "..", "server", "local-relay.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: ["ignore", "pipe", "pipe"] });
    let done = false;
    const ok = () => { if (!done) { done = true; resolve(); } };
    relay.stdout.on("data", d => { if (/listen|relay|9977|127\.0\.0\.1/i.test(String(d))) ok(); });
    relay.on("error", reject);
    setTimeout(ok, 1500);
  });
}
process.on("exit", () => { try { relay && relay.kill(); } catch (e) { } });

/** A 2D player: joins a room, sends 2D-format states, records what it receives. */
class Fake2D {
  constructor(room, name, sk) { this.room = room; this.name = name; this.sk = sk; this.got = []; this.events = []; this.peers = {}; this.d = { m: 0, x: 345, di: 0, sp: 0, vk: "car" }; }
  open() {
    return new Promise((resolve, reject) => {
      const ws = this.ws = new WebSocket(`${URL}/room/${this.room}`);
      ws.onopen = () => ws.send(JSON.stringify({ t: "j", v: 1, room: this.room, name: this.name, sk: this.sk }));
      ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        if (m.t === "h") { this.id = m.id; for (const p of m.peers || []) this.peers[p.id] = p; resolve(); }
        else if (m.t === "+") this.peers[m.id] = m;
        else if (m.t === "s") { this.got.push(m.d); this.last = m.d; this.lastFrom = m.id; }
        else if (m.t === "e") this.events.push(m.e);
      };
      ws.onerror = e => reject(new Error("fake 2D peer could not connect"));
    });
  }
  state(extra = {}) { Object.assign(this.d, extra); this.ws.send(JSON.stringify({ t: "s", d: this.d })); }
  event(e) { this.ws.send(JSON.stringify({ t: "e", e })); }
  pump(ms, fn) {   // keep sending ~5 Hz for a while; fn(peer) → fields to patch in first
    return new Promise(res => { const iv = setInterval(() => { if (fn) Object.assign(this.d, fn(this) || {}); this.state(); }, 200); setTimeout(() => { clearInterval(iv); res(); }, ms); });
  }
  close() { try { this.ws.close(); } catch (e) { } }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// the 2D game's room-seeded lot (buildRoadsideParkingLayout + mpParkingRng)
function lot2D(room, spotIndex) {
  let h = 5381; const s = "lot:" + room; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  let a = h >>> 0;
  const rf = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rowY = Math.round(152 + rf() * 44), carsN = 2 + Math.floor(rf() * 3), slots = carsN + 1, spotW = 98;
  const slack = Math.max(0, 436 - (carsN * 84 + spotW)), side = Math.floor(rf() * 3);
  const startX = 22 + (side === 0 ? 0 : side === 2 ? slack : slack / 2);
  const openIdx = ((Math.floor(rf() * slots) + spotIndex) % slots + slots) % slots;
  let cursor = startX, zone = null;
  for (let k = 0; k < slots; k++) { if (k === openIdx) { zone = { x: cursor, y: rowY }; cursor += spotW; } else cursor += 84; }
  return { rowY, carsN, zone };
}

module.exports = {
  name: "multiplayer",
  query: `&enable=multiplayer&mpurl=${encodeURIComponent(URL)}`,
  save2d: { totalCoins: 100, ownedSkins: ["pink", "gold"], selectedSkin: "pink" },
  async run(t) {
    await startRelay();
    try { await body(t); } finally { try { relay.kill(); } catch (e) { } }
  },
};

async function body(t) {
  await t.frames(6);
  t.check("title lists 🌐 Shared Road", await t.L(`[...document.querySelectorAll("#screenCard .btn")].some(b => /Shared Road/.test(b.textContent))`));
  t.check("nothing connects until the player joins", await t.game(`!${S}.sock && !${S}.want`));

  // ── the screen: pick a curated name with the D-pad, connect to EVERYONE ──
  await t.click(/Shared Road/);
  t.check("Shared Road screen with the 12 curated names", await t.L(`document.querySelectorAll("#screenCard .mp-names .btn").length === 12`));
  await t.click(/Kugel Kid/);
  t.check("picking a name saves it to the shared 2D save", await t.L(`JSON.parse(localStorage.getItem("luluSaveV2")).mpName === "Kugel Kid"`));
  await t.shot("picker");
  const peer = new Fake2D("lobby", "Latke Legend", "gold");
  await t.click(/Connect/);
  if (!await t.until(`${S}.connected`, "connects to the local relay")) return;
  t.check("connects to the local relay", true);
  await peer.open();
  await peer.pump(800);
  if (!await t.until(`Object.keys(${S}.peers).length === 1`, "sees the 2D player")) return;
  t.check("sees the 2D player join", await t.game(`Object.values(ctx.mp._debug.peers)[0].name`) === "Latke Legend");
  await t.frames(4);
  await t.shot("connected");
  await t.tap(1);   // ○ closes back to the title
  await t.frames(4);
  t.check("title shows YOUR CREW", await t.L(`/YOUR CREW/.test(document.querySelector("#screenCard").textContent)`));

  // ── drive: my state arrives in the 2D format ──
  await t.game(`L3.startRun({ mode: "cruise" })`);
  if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
  await t.game(`(() => { ctx.traffic.clear(); ctx.traffic.config.enabled = false; const r = ctx.world.road, p = r.point(400, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = 400; })()`);
  await peer.pump(2500);
  const last = peer.last || {};
  t.check("3D state relayed in 2D format (m, x, di, sp, vk)", last.m === 0 && typeof last.di === "number" && last.vk === "car" && Math.abs(last.x - 275) <= 3,
    JSON.stringify(last));
  t.check("di = s × 56000/4800", Math.abs(last.di - 400 * 56000 / 4800) < 60, `${last.di}`);

  // ── a 2D ghost on the 3D road ──
  const myDi = last.di;
  await peer.pump(1500, () => ({ di: myDi + 300, x: 345, sp: 0 }));
  await t.frames(6);
  const g = await t.game(`(() => { const p = Object.values(ctx.mp._debug.peers)[0]; return { rel: p.rel, on: !!p.onScreen }; })()`);
  t.check("2D player's ghost shows ~26 m ahead in the right lane", g.on && Math.abs(g.rel - 300) < 80, JSON.stringify(g));
  peer.event("honk");
  await t.frames(6);
  t.check("their honk → 📣 over the ghost", await t.game(`Object.values(ctx.mp._debug.peers)[0].honkT > 0`));
  await t.shot("ghost");

  // my honk + an emote via the wheel (hold L1 → right stick → release)
  const ev0 = peer.events.length;
  await t.tap(4);
  await sleep(1500);
  t.check("my honk reaches the 2D player", peer.events.slice(ev0).includes("honk"));
  await t.hold(4, 1);
  await t.frames(16);
  t.check("holding L1 opens the emote wheel", await t.L(`document.getElementById("mpWheel").classList.contains("open")`));
  const a = -Math.PI / 2 + 2 * Math.PI * 2 / 7;   // slot 2 = 😱
  await t.L(`(__pad.axes[2] = ${Math.cos(a).toFixed(3)}, __pad.axes[3] = ${Math.sin(a).toFixed(3)})`);
  await t.frames(3);
  await t.shot("emote-wheel");
  await t.hold(4, 0);
  await t.frames(3);
  await t.L(`(__pad.axes[2] = 0, __pad.axes[3] = 0)`);
  await peer.pump(2500);
  t.check("emote 😱 sent as d.em = [nonce, 2]", peer.got.some(d => d.em && d.em[1] === 2));

  // party record toast from the 2D player
  peer.state({ pb: [7, 123456] });
  await t.frames(6);
  t.check("🎉 record toast", await t.L(`/Latke Legend set a record: 123,456/.test(document.getElementById("mpOverlay").textContent)`));
  delete peer.d.pb;

  // ── friend room: switch rooms from the pause menu ──
  await t.tap(9);
  await t.click(/Shared Road/);
  await t.game(`(${S}.codeSlots = [0, 1, 2, 3], ${S}.roomKind = "friend")`);
  await t.click(/FRIEND CODE/);
  await t.click(/Switch to ABCD/);
  peer.close();
  const fr = new Fake2D("ABCD", "Latke Legend", "gold");
  if (!await t.until(`${S}.connected && ${S}.room === "ABCD"`, "switches to friend room ABCD")) return;
  t.check("switches to friend room ABCD", true);
  await fr.open();
  await fr.pump(1200);
  await t.until(`Object.keys(${S}.peers).length === 1`, "friend joins the room");
  await t.shot("friend-room");
  await t.click(/Close/);
  await t.tap(1);
  await t.frames(3);

  // ── race: the 2D player's invite (rn) → countdown → standings → their win ──
  const myDi2 = (fr.last && fr.last.di) || myDi;
  await fr.pump(600, () => ({ di: myDi2 + 2000, x: 205, rn: 4242 }));
  if (!await t.until(`${S}.race && ${S}.race.id === 4242`, "joins the friend race")) return;
  // the overlay updates on the next HUD frame — wait for it rather than checking the same instant
  t.check("joins the friend race (countdown)", await t.until(`/FRIEND RACE/.test((document.getElementById("mpOverlay") || {}).textContent || "")`, "friend race overlay", 5000));
  await t.shot("race-count");
  await t.until(`${S}.race && ${S}.race.state === "go"`, "race GO");
  await fr.pump(1200, () => ({ rp: 50000 }));
  await t.frames(4);
  t.check("race standings in the HUD", await t.L(`/RACE/.test(document.getElementById("mpRace").textContent) && /Latke Legend/.test(document.getElementById("mpRace").textContent)`));
  await t.shot("race-standings");
  await fr.pump(600, () => ({ rw: 4242 }));
  await t.until(`${S}.race && ${S}.race.state === "done"`, "their win ends the race");
  t.check("🏆 winner banner", await t.L(`/Latke Legend WINS/.test(document.getElementById("mpOverlay").textContent)`));
  delete fr.d.rn; delete fr.d.rp; delete fr.d.rw;

  // ── BONK + convoy: ride side by side ──
  const myDi3 = (fr.last && fr.last.di) || myDi2;
  await t.game(`(ctx.car.vx = 0, ctx.car.vz = 0)`);
  await fr.pump(1500, p => ({ di: (p.last && p.last.di) || myDi3, x: 290, sp: 0 }));
  await t.frames(80);
  t.check("convoy ×1.5 with a friend nearby", await t.game(`${S}.convoy.active`));
  t.check("BONK! when the ghosts overlap", await t.game(`${S}.bonks > 0`));
  await t.shot("bonk-convoy");

  // ── TAG: start it, the 2D player claims IT, then tags me back ──
  await t.game(`ctx.mpNet.MP.tagDur = 30`);
  await t.game(`ctx.mpNet.tagStart()`);
  await fr.pump(1400);
  const tgo = fr.got.find(d => typeof d.tgo === "number");
  t.check("TAG announced (d.tgo) with me IT (d.it)", !!tgo && fr.got.some(d => d.it && d.it[0] === 1));
  await fr.pump(800, () => ({ it: [2, tgo.tgo], x: 100 }));
  t.check("their higher marker makes them IT", await t.game(`${S}.tag && !${S}.tag.itIsMe`));
  await t.game(`(() => { const r = ctx.world.road, p = r.point(ctx.car.s, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.d = 1.75; ctx.mp._debug.tag.tagGuardUntil = 0; })()`);
  await fr.pump(1200, p => ({ di: (p.last && p.last.di) || myDi3, x: 275 }));
  await t.frames(6);
  t.check("touching IT passes the marker to me", await t.game(`${S}.tag && ${S}.tag.itIsMe && ${S}.tag.n === 3`));
  await t.shot("tag-it");
  delete fr.d.it;

  // ── party parking: the room-seeded lot matches the 2D layout ──
  await t.game(`(ctx.G.hearts = 3, ctx.parking.start({ from: "pullover" }))`);
  if (!await t.until(`__lulu3d.state === "parking" && __lulu3d.ctx.parking._debug.phase === "drive"`, "party lot opens")) return;
  const lay = await t.game(`(() => { const s = ctx.parking._debug; return { rowY: s.layout.rowY, carsN: s.layout.cars.length, zx: s.layout.zone.x }; })()`);
  const exp = lot2D("ABCD", await t.game(`ctx.mp.parkingSpotIndex()`));
  t.check("room-seeded lot = the 2D game's lot for ABCD", lay.rowY === exp.rowY && lay.carsN === exp.carsN && Math.abs(lay.zx - exp.zone.x) < 0.01, JSON.stringify([lay, exp]));
  await fr.pump(1500, () => ({ pk: { x: 120, y: 420, r: 0.3 } }));
  await t.frames(6);
  t.check("party member's car parks as a ghost in my lot", await t.game(`Object.keys(ctx.parking._debug.lot.ghosts || {}).length === 1`));
  t.check("my lot pose goes out as d.pk", fr.got.some(d => d.pk && typeof d.pk.x === "number" && typeof d.pk.r === "number"));
  await t.shot("party-parking");
  delete fr.d.pk;
  await t.game(`L3.setState("title")`);
  await t.frames(4);

  // ── leaderboard: a finished run posts the daily score ──
  await t.game(`L3.startRun({ mode: "cruise" })`);
  await t.until(`__lulu3d.state === "playing"`, "second run");
  await t.game(`(ctx.G.score = 4321, L3.endRun("test"))`);
  await sleep(1500);
  const board = await (await fetch(`http://127.0.0.1:${PORT}/board/scores`)).json();
  t.check("run end posts the daily score to the board", (board.list || []).some(e => e.name === "Kugel Kid" && e.score === 4321), JSON.stringify(board.list));

  // ── disconnect = opt out; a cruise no longer auto-joins ──
  await t.game(`L3.setState("title")`);
  await t.click(/Online|Shared Road/);
  await t.click(/Disconnect/);
  t.check("disconnect closes the socket + opts out", await t.game(`!${S}.want && !${S}.connected`) && await t.L(`JSON.parse(localStorage.getItem("luluSaveV2")).mpAutoOff === true`));
  await t.click(/Cancel/);
  await t.game(`L3.startRun({ mode: "cruise" })`);
  await t.frames(10);
  t.check("opted out → cruise stays solo", await t.game(`!${S}.want`));
  await t.L(`(() => { const s = JSON.parse(localStorage.getItem("luluSaveV2")); s.mpAutoOff = false; localStorage.setItem("luluSaveV2", JSON.stringify(s)); })()`);
  await t.game(`L3.startRun({ mode: "cruise" })`);
  await t.until(`${S}.connected`, "cruise auto-joins EVERYONE");
  t.check("cruise auto-joins the EVERYONE lobby", await t.game(`${S}.room === "lobby"`));
  fr.close();

  // phone portrait: the Shared Road screen still fits
  await t.page.setViewportSize({ width: 390, height: 844 });
  await t.game(`L3.setState("title")`);
  await t.frames(3);
  await t.click(/Online|Shared Road/);
  await t.game(`(${S}.roomKind = "friend")`);
  await t.click(/FRIEND CODE/);
  await t.frames(3);
  await t.shot("portrait-screen");
  t.check("portrait: screen card fits the width", await t.L(`document.getElementById("screenCard").getBoundingClientRect().right <= innerWidth`));
}
