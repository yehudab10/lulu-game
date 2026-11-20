// 👯 FRIENDS TOGETHER (features/together) — two real pages in one party against the LOCAL relay (never production):
//   FINDER   the 📱 🗺️ Map replaces the story map in a party (a dot per friend, a row per friend); tapping a friend =
//            a destination (one beam over them + their pointer stays on); the beam clears when you meet up.
//            The edge pointers: one per friend, ahead → the top edge, behind → down a side, a friend right there on
//            screen → it fades; inside a building → it points at the door and says where; in another zone → the exit
//            to take; ⚙️ 🧭 Friend pointers OFF hides them; never over a touch button / the HUD (portrait + landscape)
//   STRANGERS  a stranger ghost (the EVERYONE room) is never pointed at, never on the map
// Waits are in GAME frames (scripts/lib/party3d.js), never wall time.
const path = require("path");
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
let relay = null;
const PORT = 26000 + (process.pid % 20000);
const Q0 = `&enable=party,foot,town,atmos,openworld,homes&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;
const SHOTS = path.join(__dirname, "..", "..", "smoke-shots");

module.exports = {
  name: "together",
  viewport: { width: 1280, height: 720 },
  query: Q0,
  save2d: { totalCoins: 500, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(8 * 60000);
    const guests = [];
    try { await body(t, guests); }
    catch (e) { t.check("together threw", false, String(e && e.stack || e).slice(0, 500)); }
    finally {
      for (const g of guests) {
        t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
        try { await g.page.close(); } catch (e) { }
      }
      relay.kill();
    }
  },
};

const PILL = uid => `(ctx.together.debug.pointers().find(p => p.uid === ${JSON.stringify(uid)}) || null)`;

async function body(t, guests) {
  const g = t.game, Hp = hostPage(t);
  t.check("ctx.together service", await g(`!!ctx.together && typeof ctx.together.locate === "function"`));
  t.check("solo: no friend map in the phone (the story map keeps the 🗺️ slot)", await g(`!ctx.phone.apps().includes("tgmap")`));
  // ── the host: 👯 Friends → 🌍 Hang out (straight into Free Roam) ──
  await t.click(/Friends/);
  await t.L(`document.getElementById("pt_roam").click()`);
  if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "host: Free Roam", 120000)) return;
  await g(`(ctx.law && ctx.law.hold && ctx.law.hold(99999), true)`);
  const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`), HU = JSON.stringify(hostUid);
  const A = await guestPage(t, "guest", { totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q0}&party=${code}&with=${hostUid}`);
  guests.push(A);
  if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.state === "playing"`, "guest joins Free Roam", 240000)) return;
  await A.game(`(ctx.law && ctx.law.hold && ctx.law.hold(99999), true)`);
  const guestUid = await A.game(`ctx.party.uid`), GU = JSON.stringify(guestUid);
  for (const p of [Hp, A]) await p.game(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);

  // ── the map app ──
  t.check("party: the 📱 has the friends 🗺️ Map (and not the story map)", await g(`ctx.phone.apps().includes("tgmap") && !ctx.phone.apps().includes("map")`), JSON.stringify(await g(`ctx.phone.apps()`)));

  // put the host at s = 400 in the right lane, the guest 230 m ahead
  await g(`ctx.party._debug.place(400, 1.75, 0)`);
  await A.game(`ctx.party._debug.place(630, 1.75, 0)`);
  await t.frames(20);
  if (!await Hp.until(`(() => { const l = ctx.together.locate(${GU}); return !!l && l.kind === "here" && l.dist > 180 && l.dist < 280; })()`, "host locates the guest ~230 m ahead", 60000)) return;
  await Hp.until(`(() => { const p = ${PILL(guestUid)}; return !!p && p.shown; })()`, "a pointer for the guest (far ahead)", 20000);
  let pill = await g(PILL(guestUid));
  t.check("…it's on the TOP edge (ahead) and says the name + the distance", !!pill && pill.y < 720 * 0.3 && /Latke Legend/.test(pill.text) && /\d+ m/.test(pill.text), JSON.stringify(pill));
  await t.shot("pointer-ahead");
  // behind me → down a side
  await A.game(`ctx.party._debug.place(250, 1.75, 0)`);
  await Hp.until(`(() => { const l = ctx.together.locate(${GU}); const p = ${PILL(guestUid)}; return !!l && l.dist > 100 && l.dist < 200 && !!p && p.shown && (p.x < 200 || p.x > 1280 - 400) && p.y > 720 * 0.2; })()`, "behind → the pointer slides down a side", 40000);
  pill = await g(PILL(guestUid));
  t.check("behind: on a side, never the bottom 30 %", !!pill && pill.y + pill.h <= 720 * 0.72, JSON.stringify(pill));
  // right there, on screen → it fades
  await A.game(`ctx.party._debug.place(428, 1.75, 0)`);
  await Hp.until(`(() => { const l = ctx.together.locate(${GU}); return !!l && l.dist < 40; })()`, "the guest pulls up just ahead", 30000);
  await Hp.until(`(() => { const p = ${PILL(guestUid)}; return !p || !p.shown; })()`, "a friend right there on screen: no pointer (their nametag says it)", 20000);
  t.check("close + on screen → faded", !(await g(`(() => { const p = ${PILL(guestUid)}; return !!p && p.shown; })()`)));
  // the switch
  await A.game(`ctx.party._debug.place(680, 1.75, 0)`);
  await Hp.until(`(() => { const p = ${PILL(guestUid)}; return !!p && p.shown; })()`, "far again → the pointer is back", 30000);
  await g(`ctx.together.setPointers(false)`); await t.frames(4);
  t.check("🧭 Friend pointers OFF → no pointer", !(await g(`(() => { const p = ${PILL(guestUid)}; return !!p && p.shown; })()`)));
  t.check("…the setting is in ⚙️ Settings", await t.L(`import("./js/core/ctx.js").then(m => m.menuItems("settings").some(i => i.id === "friendPointers"))`));
  await g(`ctx.together.setPointers(true)`); await t.frames(4);

  // ── the map: a row + a dot for the guest; tap → destination (a beam + the pointer stays) ──
  const opened = await g(`ctx.phone.openPhone("tgmap")`);
  await t.frames(6);
  t.check("📱 🗺️ Map opens", opened && await t.L(`!!document.querySelector(".tg-map canvas")`));
  t.check("…a row for the guest with the distance", await t.L(`(() => { const b = document.querySelector('.tg-row[data-u=${GU}]'); return !!b && /Latke Legend/.test(b.textContent) && /\\d+ m/.test(b.textContent); })()`));
  t.check("…no stranger ghosts listed (only party members)", await t.L(`document.querySelectorAll(".tg-row").length`) === 1);
  await t.shot("map-highway");
  await t.L(`document.querySelector('.tg-row[data-u=${GU}]').click()`);
  await t.frames(6);
  t.check("tap a friend → the destination, the phone closes", (await g(`ctx.together.dest()`)) === guestUid && !(await g(`ctx.phone.isOpen`)));
  await t.frames(6);
  t.check("…one beam over them", await g(`ctx.openworld.debug.beaconCount() >= 1`));
  t.check("…their pointer is the destination's", await t.L(`!!document.querySelector(".tg-p.dest")`));
  await t.shot("destination");
  // meet up → it clears
  await A.game(`ctx.party._debug.place(408, 1.75, 0)`);
  await Hp.until(`ctx.together.dest() === ""`, "meeting up clears the destination", 40000);

  // ── another zone: the guest drives into Lakewood → my pointer says which exit ──
  await A.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exits[0].s, speed: 0 })`);
  if (!await A.until(`ctx.town.active && ctx.openworld.zone === "lakewood"`, "guest in Lakewood", 30000)) return;
  await Hp.until(`(() => { const l = ctx.together.locate(${GU}); return !!l && l.kind === "exit" && /Lakewood/.test(l.label); })()`, "host: the guest is in Lakewood → the exit", 40000);
  const lx = await g(`ctx.together.locate(${GU})`);
  t.check("…the pointer says to take the Lakewood exit", /take the Lakewood exit/.test(lx.label), JSON.stringify(lx));
  await Hp.until(`(() => { const p = ${PILL(guestUid)}; return !!p && p.shown && /Lakewood/.test(p.text); })()`, "the exit pointer shows", 20000);

  // ── the guest walks into a house → host (also in town) sees a door pointer ──
  await g(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exits[0].s, speed: 0 })`);
  if (!await Hp.until(`ctx.town.active && ctx.openworld.zone === "lakewood"`, "host in Lakewood too", 30000)) return;
  await A.game(`ctx.foot.start("parked")`);
  if (!await A.until(`ctx.state === "footRun" && ctx.foot.phase === "walk" && ctx.homes.homes().length > 0`, "guest walks in town", 60000)) return;
  // the house farthest from the host, so the pointer has a long way to point
  const hi = await A.game(`(() => { const hs = ctx.homes.homes(); const c = ${JSON.stringify(await g(`({ x: ctx.car.pos.x, z: ctx.car.pos.z })`))}; let b = 0, bd = -1; hs.forEach((h, i) => { const d = Math.hypot(h.ap.x - c.x, h.ap.z - c.z); if (d > bd && d < 260) { bd = d; b = i; } }); const h = hs[b]; ctx.foot.debug.F.pos.set(h.ap.x, 0.05, h.ap.z); return b; })()`);
  await A.frames(4);
  await A.game(`ctx.homes.enter(${hi}, "guest", "door")`);
  if (!await A.until(`ctx.state === "interior"`, "guest goes into the house", 60000)) return;
  await Hp.until(`(() => { const l = ctx.together.locate(${GU}); return !!l && l.kind === "door" && l.inside; })()`, "host: the guest is inside → the door", 40000);
  const ld = await g(`ctx.together.locate(${GU})`), door = await A.game(`ctx.homes.homes()[${hi}].ap`);
  t.check("…the pointer points at that house's door (≤ 4 m)", Math.hypot(ld.x - door.x, ld.z - door.z) < 4, JSON.stringify({ ld, door }));
  t.check("…and says where (in a house)", /house|inside/.test(ld.label), ld.label);
  await t.shot("door-pointer");

  // ── a phone, portrait + landscape: the pointers never cover a button / the HUD ──
  await t.L(`(window.dispatchEvent(new Event("touchstart")), __lulu3d.input && (__lulu3d.input.device = "touch"), 0)`);
  for (const [w, h] of [[390, 844], [844, 390]]) {
    await t.page.setViewportSize({ width: w, height: h });
    await t.frames(20);
    await Hp.until(`(() => { const p = ${PILL(guestUid)}; return !!p && p.shown; })()`, `${w}×${h}: the pointer shows`, 20000);
    const pl = await g(PILL(guestUid)), av = await g(`ctx.together.debug.avoid()`);
    const hit = pl && av.filter(q => pl.x < q.r - 6 && pl.x + pl.w > q.l + 6 && pl.y < q.b - 6 && pl.y + pl.h > q.t + 6);
    t.check(`${w}×${h}: the pointer is on screen and over no button / HUD bit`, !!pl && pl.x >= 0 && pl.y >= 0 && pl.x + pl.w <= w && pl.y + pl.h <= h && hit.length === 0, JSON.stringify({ pl, hit }));
    await t.shot(`touch-${w}x${h}`);
  }
  await t.page.setViewportSize({ width: 1280, height: 720 });
}
