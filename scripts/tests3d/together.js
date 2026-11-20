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
  t.check("…it's on the TOP edge (ahead) and says the name + the distance", !!pill && pill.y < 720 * 0.3 && /Latke Legend/.test(pill.text) && /\d+ m/.test(pill.text), JSON.stringify({ pill, avoid: await g(`ctx.together.debug.avoid()`) }));
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
  await A.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exitOf("lakewood"), speed: 0 })`);
  if (!await A.until(`ctx.town.active && ctx.openworld.zone === "lakewood"`, "guest in Lakewood", 30000)) return;
  await Hp.until(`(() => { const l = ctx.together.locate(${GU}); return !!l && l.kind === "exit" && /Lakewood/.test(l.label); })()`, "host: the guest is in Lakewood → the exit", 40000);
  const lx = await g(`ctx.together.locate(${GU})`);
  t.check("…the pointer says to take the Lakewood exit", /take the Lakewood exit/.test(lx.label), JSON.stringify(lx));
  await Hp.until(`(() => { const p = ${PILL(guestUid)}; return !!p && p.shown && /Lakewood/.test(p.text); })()`, "the exit pointer shows", 20000);

  // ── the guest walks into a house → host (also in town) sees a door pointer ──
  await g(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exitOf("lakewood"), speed: 0 })`);
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
  // the map in town: the streets from above, the guest's dot at the house's door (🏠)
  await g(`ctx.phone.openPhone("tgmap")`); await t.frames(8);
  t.check("📱 🗺️ Map in town: the row says the guest is in a house", await t.L(`(() => { const b = document.querySelector('.tg-row[data-u=${GU}]'); return !!b && /house/.test(b.textContent); })()`));
  t.check("…the guest's dot is on the town map", await t.L(`import("./js/features/together/map.js").then(() => true)`) && await g(`ctx.together.debug.mapDots().some(d => d.uid === ${GU})`), JSON.stringify(await g(`ctx.together.debug.mapDots()`)));
  await t.shot("map-town");
  await g(`ctx.phone.closePhone()`); await t.frames(4);

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
  await t.L(`(__lulu3d.input && (__lulu3d.input.device = "gamepad"), 0)`);
  await t.frames(6);

  // ════ STAGE 2: FRIENDS IN THE SAME BUILDING ════
  await rooms(t, g, Hp, A, hostUid, guestUid, hi);
}

const OPT = (P, re) => P.L(`(() => { const o = [...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden"); const b = o.find(b => ${re}.test(b.textContent)); if (b) b.click(); return o.map(b => b.textContent); })()`);
async function rooms(t, g, Hp, A, hostUid, guestUid, hi) {
  const HU = JSON.stringify(hostUid), GU = JSON.stringify(guestUid);
  const coins0 = { h: await g(`L3.wallet.coins`), a: await A.game(`L3.wallet.coins`) };
  // the guest is inside the house (as a guest); the host walks up to the same front door
  await g(`ctx.foot.start("parked")`);
  if (!await Hp.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, "host on foot in town", 60000)) return false;
  await g(`(() => { const h = ctx.homes.homes()[${hi}]; ctx.foot.debug.F.pos.set(h.ap.x, 0.05, h.ap.z); return true; })()`);
  await t.frames(4);
  t.check("host at the door: the guest is in there (together.friendIn)", (await g(`ctx.together.friendIn("home", ctx.homes.homes()[${hi}].key)`)) === "Latke Legend");
  await g(`(() => { const s = ctx.foot.debug.interactables(); if (s && s.ent && s.ent.act) s.ent.act(); return !!s; })()`);
  await Hp.until(`ctx.dialogOpen`, "the door menu opens", 20000);
  let opts = [];
  for (let k = 0; k < 40 && !opts.some(o => /Join/.test(o)); k++) { opts = await OPT(Hp, `/Join Latke Legend inside/`); if (!opts.length) await t.tap(0); await t.frames(2); }
  t.check("the door menu offers 👯 Join Latke Legend inside", opts.some(o => /Join Latke Legend inside/.test(o)), JSON.stringify(opts));
  if (!await Hp.until(`ctx.state === "interior" && ctx.homes.inside`, "…and in she goes", 60000)) return false;
  // both inside the SAME house: each draws the other
  await Hp.until(`ctx.together.debug.room().mates.some(m => m.uid === ${GU})`, "host sees the guest inside", 60000);
  await A.until(`ctx.together.debug.room().mates.some(m => m.uid === ${HU})`, "guest sees the host come in", 60000);
  t.check("same room on both screens (the house's key)", (await g(`ctx.together.debug.room().inst`)) === (await A.game(`ctx.together.debug.room().inst`)) && (await g(`ctx.together.debug.room().room`)) === "home");
  t.check("…only party members are in there with me (no strangers)", await g(`ctx.together.debug.room().mates.every(m => ctx.party.members().includes(m.uid))`));
  // the guest walks across the room → the host sees her right there
  const spot = await A.game(`(() => { const rt = ctx.homes.debug.VISIT.cur.rt, B = rt.bounds; const x = (B.x0 + B.x1) / 2 + 1.1, z = 0.4; rt.lulu.obj.position.set(x, 0, z); return { x, z }; })()`);
  await Hp.until(`(() => { const m = ctx.together.debug.room().mates.find(m => m.uid === ${GU}); return !!m && Math.hypot(m.x - ${spot.x}, m.z - ${spot.z}) < 0.6; })()`, "host sees the guest where she walked (≤ 0.6 m)", 40000);
  const hm = await g(`ctx.together.debug.room().mates.find(m => m.uid === ${GU})`);
  t.check("…with her nametag", !!hm && hm.tag, JSON.stringify(hm));
  await t.shot("room-together");
  await A.page.screenshot({ path: path.join(SHOTS, "3d-together-room-guest.png") }).catch(() => { });
  // an emote inside: the friend sees it
  await g(`import("./js/core/ctx.js").then(m => { window.__emr = []; m.on("party:emote", e => { if (!e.me) window.__emr.push(e.id + (e.room ? "@room" : "")); }); return true; })`);
  t.check("emotes work inside a shared room", await A.game(`ctx.emotes.allowed`));
  await A.game(`ctx.emotes.debug.resetCool()`);
  await A.game(`ctx.emotes.play("dance")`);
  await Hp.until(`(window.__emr || []).includes("dance@room")`, "host sees the guest's 💃 inside", 30000);
  // nothing paid, nothing spent
  t.check("coins untouched by being together", (await g(`L3.wallet.coins`)) === coins0.h && (await A.game(`L3.wallet.coins`)) === coins0.a, JSON.stringify({ coins0, h: await g(`L3.wallet.coins`), a: await A.game(`L3.wallet.coins`) }));
  // the guest walks out through the door → gone from my room
  await A.game(`(() => { const c = ctx.homes.debug.VISIT.cur; c.V.exit = "door"; c.rt.leave(); return true; })()`);
  await A.until(`ctx.state === "footRun"`, "guest back outside", 40000);
  await Hp.until(`!ctx.together.debug.room().mates.some(m => m.uid === ${GU} && !m.leaving)`, "host: the guest heads out the door", 30000);
  await Hp.until(`ctx.together.debug.room().mates.length === 0`, "…and is gone", 30000);
  // the guest, outside, watches the host walk out and back in: she steps in through the door (no blink on the step)
  await A.game(`import("./js/core/ctx.js").then(m => { window.__step = []; m.on("together:stepin", e => window.__step.push(e.uid)); return true; })`);
  await g(`(() => { const c = ctx.homes.debug.VISIT.cur; c.V.exit = "door"; c.rt.leave(); return true; })()`);
  await Hp.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, "host back outside", 40000);
  await A.until(`(() => { const rc = ctx.party.remoteCar(${HU}); return !!rc && rc.shown && rc.foot; })()`, "the guest sees the host come out at the door", 40000);
  await g(`ctx.homes.enter(${hi}, "guest", "door")`);
  await Hp.until(`ctx.state === "interior"`, "host back inside", 40000);
  await A.until(`(window.__step || []).includes(${HU})`, "guest sees the host step in through the door (not freeze / blink)", 30000);
  await g(`(() => { const c = ctx.homes.debug.VISIT.cur; c.V.exit = "door"; c.rt.leave(); return true; })()`);
  await Hp.until(`ctx.state === "footRun"`, "host out again", 40000);

  // ── LULU'S HOUSE: the host's, with friends — the guest walks in and sees the HOST's decorations ──
  await g(`(() => { const S = ctx.decor.debug.S; S.owned.rug = ["road"]; S.placed.rug = "road"; return true; })()`);
  await A.game(`(() => { const S = ctx.decor.debug.S; S.owned = {}; S.placed = {}; return true; })()`);
  for (const P of [Hp, A]) {
    await P.game(`(() => { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); return true; })()`);
    await P.until(`ctx.state === "playing"`, `${P.label}: back in the car`, 30000);
    await P.game(`(ctx.town.active && ctx.town.leave("reset"), true)`);
    await P.until(`!ctx.town.active`, `${P.label}: out of town`, 30000);
    await P.game(`ctx.party._debug.place(36, 5.25, 0)`);
    await P.frames(10);
    await P.game(`ctx.foot.start("parked")`);
    await P.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, `${P.label}: on foot by Lulu's house`, 60000);
  }
  const door = await g(`ctx.decor.debug.spotAt("door")`);
  t.check("Lulu's house in a party: the front door is open (canEnter)", await g(`ctx.decor.canEnter()`) && !(await g(`ctx.decor.allowed()`)));
  await g(`(ctx.foot.debug.F.pos.set(${door.x}, 0.05, ${door.z}), true)`); await t.frames(3);
  t.check("…✋ GO INSIDE at the door with friends", /GO INSIDE/.test(await g(`(ctx.foot.debug.interactables() || {}).label || ""`)), await g(`(ctx.foot.debug.interactables() || {}).label`));
  await g(`ctx.decor.enter()`);
  if (!await Hp.until(`ctx.state === "interior" && !!ctx.decor.debug.room()`, "host goes into HER house", 60000)) return false;
  t.check("host: it's her own house (the visit's owner)", (await g(`ctx.decor.visitOwner()`)) === hostUid && !(await g(`ctx.decor.visiting`)));
  t.check("…no redecorating with friends (no picker spots, nothing sold)", await g(`!ctx.decor.debug.room().hots.some(h => /^slot:/.test(h.id)) && !ctx.decor.buy("rug", "round").ok`));
  await A.game(`(ctx.foot.debug.F.pos.set(${door.x}, 0.05, ${door.z}), true)`); await A.frames(3);
  await A.until(`(() => { const p = ctx.party.peer(${HU}); return !!p && p.x && Array.isArray(p.x.dc) && Array.isArray(p.x.in) && p.x.in[0] === "luluHome"; })()`, "guest knows the host is home", 30000);
  await A.game(`ctx.decor.enter()`);
  if (!await A.until(`ctx.state === "interior" && !!ctx.decor.debug.room()`, "the guest comes over", 60000)) return false;
  t.check("guest: it's the HOST's house", (await A.game(`ctx.decor.visitOwner()`)) === hostUid && await A.game(`ctx.decor.visiting`));
  t.check("…with the host's road-map rug (not her own bare floor)", await A.game(`(() => { const V = ctx.decor.debug.room().data.V; return !!V.objs.rug && Object.keys(V.cache.rug || {}).includes("road"); })()`), JSON.stringify(await A.game(`Object.keys(ctx.decor.debug.room().data.V.cache.rug || {})`)));
  t.check("…and nothing of the host's changed in her own save", await A.game(`ctx.decor.placed("rug") === "none"`));
  await Hp.until(`ctx.together.debug.room().mates.some(m => m.uid === ${GU})`, "host sees the guest come in", 60000);
  await A.until(`ctx.together.debug.room().mates.some(m => m.uid === ${HU})`, "guest sees the host at home", 60000);
  await t.shot("luluhome-together");
  t.check("coins still untouched", (await g(`L3.wallet.coins`)) === coins0.h && (await A.game(`L3.wallet.coins`)) === coins0.a);
  for (const P of [A, Hp]) {
    await P.game(`(ctx.decor.debug.room().leave(), true)`);
    await P.until(`ctx.state === "footRun"`, `${P.label}: back out on the porch`, 40000);
  }

  // ── a roadside place (the bar on the party highway): the same door → the same room ──
  const bar = await g(`ctx.foot.debug.nextDoorAt(300, "bar")`);
  if (!bar) { t.check("a bar up the party highway", false); return true; }
  for (const P of [Hp, A]) {
    await P.game(`(() => { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); return true; })()`);
    await P.until(`ctx.state === "playing"`, `${P.label}: driving`, 30000);
    await P.game(`ctx.party._debug.place(${bar.s - 14}, ${bar.side > 0 ? 5.25 : -5.25}, 0)`);
    await P.frames(20);
    await P.game(`ctx.foot.start("parked")`);
    await P.until(`ctx.state === "footRun" && ctx.foot.phase === "walk" && ctx.foot.debug.allDoors().some(d => d.id === "bar")`, `${P.label}: on foot by the bar`, 60000);
    await P.game(`(() => { const d = ctx.foot.debug.allDoors().filter(d => d.id === "bar").sort((a, b) => Math.abs(a.s - ${bar.s}) - Math.abs(b.s - ${bar.s}))[0]; ctx.foot.debug.F.pos.set(d.x, 0.05, d.z); return ctx.foot.handoff("bar", { s: d.s, d: d.d, side: d.side, id: "bar" }); })()`);
    await P.until(`ctx.state === "interior"`, `${P.label}: into the bar`, 60000);
  }
  await Hp.until(`ctx.together.debug.room().room === "bar" && ctx.together.debug.room().mates.some(m => m.uid === ${GU})`, "the bar: the host sees the guest inside", 60000);
  await A.until(`ctx.together.debug.room().mates.some(m => m.uid === ${HU})`, "the bar: the guest sees the host", 60000);
  await t.shot("bar-together");
  for (const P of [A, Hp]) { await P.game(`(window.__interiors && window.__interiors.room ? window.__interiors.room.leave() : 0, true)`); await P.until(`ctx.state === "footRun"`, `${P.label}: out of the bar`, 40000); }
  await car(t, g, Hp, A, hostUid, guestUid);
  return true;
}

// ════ PART D: IN THE SAME CAR ════
async function car(t, g, Hp, A, hostUid, guestUid) {
  const HU = JSON.stringify(hostUid), GU = JSON.stringify(guestUid);
  const coins0 = { h: await g(`L3.wallet.coins`), a: await A.game(`L3.wallet.coins`) };
  // the host gets back in her car and waits at the kerb; the guest walks up to the PASSENGER door
  await g(`(() => { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); return true; })()`);
  await Hp.until(`ctx.state === "playing"`, "host back behind the wheel", 30000);
  await g(`ctx.party._debug.place(900, 5.25, 0)`);
  await A.game(`(() => { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); return true; })()`);
  await A.until(`ctx.state === "playing"`, "guest driving", 30000);
  await A.game(`ctx.party._debug.place(880, 1.75, 0)`);
  await A.frames(10);
  await A.game(`ctx.foot.start("parked")`);
  await A.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, "guest on foot near the host's car", 60000);
  await A.until(`(() => { const rc = ctx.party.remoteCar(${HU}); return !!rc && rc.shown && !rc.foot; })()`, "guest sees the host's car", 40000);
  await A.game(`(() => { const rc = ctx.party.remoteCar(${HU}); ctx.foot.debug.F.pos.set(rc.x - Math.cos(rc.h) * 1.6, 0.05, rc.z + Math.sin(rc.h) * 1.6); return true; })()`);
  await A.frames(4);
  const lbl = await A.game(`(ctx.foot.debug.interactables() || {}).label || ""`);
  t.check("✋ at a friend's passenger door: 🚗 HOP IN with <name>", /HOP IN with Kugel Kid/.test(lbl), lbl);
  // the driver's side is not a hop-in (theirs)
  t.check("…only at the passenger side (the door point is on their right)", await A.game(`(() => { const rc = ctx.party.remoteCar(${HU}), d = ctx.together.debug.hop(); if (!d) return false; const rx = -Math.cos(rc.h), rz = Math.sin(rc.h); return (d.x - rc.x) * rx + (d.z - rc.z) * rz > 1; })()`));
  await A.game(`(() => { const s = ctx.foot.debug.interactables(); s.ent.act(); return true; })()`);
  if (!await A.until(`ctx.state === "playing" && ctx.openworld.riding === ${HU}`, "the hop: she's riding with the host", 40000)) return;
  await Hp.until(`(() => { const p = ctx.party.peer(${GU}); return !!p && p.x && p.x.rd === ${HU}; })()`, "host: the guest is in my passenger seat", 30000);
  await Hp.until(`!!(ctx.car.anchors && ctx.car.anchors.passenger && ctx.car.anchors.passenger.children.length)`, "host draws a Lulu in the passenger seat", 20000);
  // the host drives off: the guest rides along (her car hidden, following)
  await g(`ctx.party._debug.place(905, 5.25, 10)`);
  await t.hold(7, 1);                       // (the host keeps her foot down)
  const p0 = await A.game(`({ x: ctx.car.pos.x, z: ctx.car.pos.z })`);
  await A.until(`(() => { const rc = ctx.party.remoteCar(${HU}); return !!rc && Math.hypot(rc.x - ctx.car.pos.x, rc.z - ctx.car.pos.z) < 1.5 && Math.hypot(ctx.car.pos.x - ${p0.x}, ctx.car.pos.z - ${p0.z}) > 10; })()`, "the guest rides along with the driver (10 m on, in their car)", 60000);
  await t.shot("riding-host");
  await A.page.screenshot({ path: path.join(SHOTS, "3d-together-riding-guest.png") }).catch(() => { });
  // hop out MOVING: into her own car alongside, rolling — no heart lost, still hers
  const hearts = await A.game(`ctx.G.hearts`);
  await A.game(`ctx.openworld.hopOut({ moving: true })`);
  await A.until(`ctx.openworld.riding == null && ctx.state === "playing"`, "hop out while moving → in her own car alongside", 30000);
  t.check("…no heart lost, still driving her own car (not dropped on the road)", (await A.game(`ctx.G.hearts`)) >= hearts && await A.game(`ctx.state === "playing" && !ctx.foot.active`));
  await t.hold(7, 0);
  // ride again (the 📱 shortcut), the driver stops, hop out SLOW → on her feet at the door, her car parked right there
  await g(`ctx.party._debug.place(1000, 5.25, 0)`);
  await A.game(`ctx.party._debug.place(985, 1.75, 0)`);
  await A.frames(20);
  t.check("📱 shortcut still works: Ride with …", (await A.game(`ctx.openworld.ride(${HU})`)) === "");
  await A.until(`ctx.openworld.riding === ${HU}`, "riding again", 20000);
  await A.frames(20);
  await A.game(`ctx.openworld.hopOut({ moving: false })`);
  await A.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, "hop out stopped → on her feet", 40000);
  t.check("…by the host's car, with her own car parked right there", await A.game(`(() => { const rc = ctx.party.remoteCar(${HU}), pk = ctx.foot.parkedCar, f = ctx.foot.pos; return !!rc && !!pk && Math.hypot(rc.x - f.x, rc.z - f.z) < 8 && Math.hypot(pk.x - f.x, pk.z - f.z) < 8; })()`), JSON.stringify(await A.game(`({ pk: ctx.foot.parkedCar, f: ctx.foot.pos })`)));
  // the driver can't keep her in: when the driver parks and walks off, she's let out too
  await A.game(`(() => { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); return true; })()`);
  await A.until(`ctx.state === "playing"`, "guest in her car", 30000);
  await A.game(`ctx.openworld.ride(${HU})`);
  await A.until(`ctx.openworld.riding === ${HU}`, "riding a third time", 20000);
  await A.frames(25);
  await g(`ctx.foot.start("parked")`);
  await A.until(`ctx.openworld.riding == null && ctx.state === "footRun"`, "the driver walks off → the passenger is let out on her feet", 40000);
  // a ride through a town exit: she comes along into town
  await g(`(() => { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); return true; })()`);
  await Hp.until(`ctx.state === "playing"`, "host driving", 30000);
  await A.game(`(() => { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); return true; })()`);
  await A.until(`ctx.state === "playing"`, "guest in her car", 30000);
  await A.game(`ctx.openworld.ride(${HU})`);
  await A.until(`ctx.openworld.riding === ${HU}`, "riding before the exit", 20000);
  await g(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exitOf("lakewood"), speed: 0 })`);
  await Hp.until(`ctx.town.active`, "host in town", 30000);
  await A.until(`ctx.openworld.zone === "lakewood" && ctx.openworld.riding === ${HU}`, "the passenger comes along into town, still riding", 60000);
  await A.game(`ctx.openworld.hopOut({ moving: false })`);
  // ── the town's courthouse lobby (features/places): open in Free Roam, and a shared room ──
  await A.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, "guest on foot in town", 40000);
  await g(`ctx.foot.start("parked")`);
  await Hp.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, "host on foot in town", 40000);
  for (const P of [Hp, A]) {
    if (!await P.until(`!!ctx.civic.spot("court")`, `${P.label}: the town has a courthouse`, 30000)) return;
    await P.game(`(() => { const sp = ctx.civic.spot("court"); ctx.foot.debug.F.pos.set(sp.x, 0.05, sp.z); return true; })()`);
    await P.frames(4);
    const lb = await P.game(`(ctx.foot.debug.interactables() || {}).label || ""`);
    t.check(`${P.label}: ⚖️ ENTER THE COURTHOUSE works with friends (Free Roam)`, /COURTHOUSE/.test(lb), lb);
    await P.game(`(() => { const s = ctx.foot.debug.interactables(); if (s && s.ent && s.ent.act) s.ent.act(); return true; })()`);
    await P.until(`ctx.state === "interior"`, `${P.label}: into the courthouse`, 60000);
  }
  await Hp.until(`ctx.together.debug.room().room === "courthouse" && ctx.together.debug.room().mates.some(m => m.uid === ${GU})`, "the courthouse lobby: the host sees the guest", 60000);
  await A.until(`ctx.together.debug.room().mates.some(m => m.uid === ${HU})`, "the courthouse lobby: the guest sees the host", 60000);
  await t.shot("court-together");
  // ── THE BANK (ci/bankfriends stage 1): open in Free Roam, one lobby for the friends, the solo job stays solo ──
  for (const P of [A, Hp]) { await P.game(`(window.__interiors && window.__interiors.room ? window.__interiors.room.leave() : 0, true)`); await P.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, `${P.label}: out of the courthouse`, 40000); }
  for (const P of [Hp, A]) {
    if (!await P.until(`!!ctx.town.spot("bank")`, `${P.label}: the town has a bank`, 30000)) return;
    await P.frames(30);           // (the courthouse door's 'just came out' pause)
    await P.game(`(() => { const sp = ctx.town.spot("bank"); ctx.foot.debug.F.pos.set(sp.x, 0.05, sp.z); return true; })()`);
    await P.frames(4);
    const lb = await P.game(`(ctx.foot.debug.interactables() || {}).label || ""`);
    t.check(`${P.label}: 🏦 ENTER the bank works with friends (Free Roam)`, /ENTER/.test(lb) && !/COURTHOUSE/.test(lb), lb);
    await P.game(`(() => { const s = ctx.foot.debug.interactables(); if (s && s.ent && s.ent.act) s.ent.act(); return true; })()`);
    await P.until(`ctx.state === "interior" && ctx.stateData && ctx.stateData.id === "bank"`, `${P.label}: into the bank`, 60000);
  }
  await Hp.until(`ctx.together.debug.room().room === "bank" && ctx.together.debug.room().mates.some(m => m.uid === ${GU})`, "the bank lobby: the host sees the guest", 60000);
  await A.until(`ctx.together.debug.room().mates.some(m => m.uid === ${HU})`, "the bank lobby: the guest sees the host", 60000);
  t.check("…the same bank on both screens (this town's)", (await g(`ctx.together.debug.room().inst`)) === (await A.game(`ctx.together.debug.room().inst`)));
  t.check("…and the solo job can't be planned with friends there", !(await g(`!!(ctx.heist && ctx.heist.debug && ctx.heist.debug.J && ctx.heist.debug.J.plan)`)));
  await t.shot("bank-together");
  t.check("riding never costs anyone coins (no fines, nothing taken)", (await g(`L3.wallet.coins`)) >= coins0.h && (await A.game(`L3.wallet.coins`)) >= coins0.a, JSON.stringify({ coins0, h: await g(`L3.wallet.coins`), a: await A.game(`L3.wallet.coins`) }));
}
