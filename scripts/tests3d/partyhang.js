// 🎉 THE TOWN AS A HANGOUT (ci/hangout) — two real pages against the LOCAL relay (never production):
//   EMOTES   the wheel (hold D-pad ↑ · a quick tap = 👋) on foot and from the car; the friend SEES the gesture on my
//            puppet (d.x.e) — a walking Lulu dancing / face-palming, a car waving an arm + the phrase bubble;
//            two gestures at each other → a combo on BOTH screens; passing a friend → a greeting
//   JOIN     🌍 Hang out = straight into Free Roam (no lobby, no 3-2-1); a friend who opens my link (…&with=me) lands
//            right next to me — on foot, since I'm walking
//   SPOTS    the 🕹️ arcade outside the pizza shop: walk up → ✋ → the card → 🥘 Hot Kugel = an INVITATION (the friend
//            isn't pulled in); the friend drives over → opted in → GO for both (the starter back in her car)
//   NOBODY FROZEN  my emotes / my wheel / my invitation never stop a friend's world (their clock + frames keep going)
//   LEAVE    one tap in the 📱 👯 app; the friend keeps playing
// Waits are in GAME frames (scripts/lib/party3d.js), never wall time.
const path = require("path");
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
let relay = null;
const PORT = 25000 + (process.pid % 20000);
const Q0 = `&enable=party,foot,town,atmos,openworld&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;
const SHOTS = path.join(__dirname, "..", "..", "smoke-shots");
const PLACE = (x, z, h = 0) => `(() => { const c = ctx.car, n = ctx.world.road.nearest(${x}, ${z}, null, {}); c.place(${x}, ${z}, ${h}); c.s = n.s; c.d = n.d; c.vx = c.vz = 0; c.vF = 0; return true; })()`;

module.exports = {
  name: "partyhang",
  viewport: { width: 1280, height: 720 },
  query: Q0,
  save2d: { totalCoins: 500, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid", luluHair: "#8D6E63" },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(6 * 60000);       // (a page that stops drawing fails this test in minutes, not hours)
    const guests = [];
    try { await partyRun(t, guests); }
    catch (e) { t.check("party run threw", false, String(e && e.stack || e).slice(0, 400)); }
    finally {
      for (const g of guests) {
        t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
        try { await g.page.close(); } catch (e) { }
      }
      relay.kill();
    }
  },
};

async function partyRun(t, guests) {
  const g = t.game, Hp = hostPage(t);
  t.check("ctx.emotes service (8 gestures, fixed phrases only)", await g(`!!ctx.emotes && ctx.emotes.list.length === 8 && ctx.emotes.list.every(e => e.say && e.say.length <= 12)`));
  // ── solo, on foot: the wheel works (D-pad ↑ has no other job on foot) ──
  await g(`L3.startRun({ mode: "cruise", quick: true })`);
  if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
  await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law && ctx.law.hold && ctx.law.hold(900), true)`);
  await g(`ctx.foot.start("parked")`);
  if (!await t.until(`__lulu3d.ctx.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "solo: on foot", 30000)) return;
  t.check("solo on foot: emotes allowed + the 😀 button's wheel", await g(`ctx.emotes.allowed`));
  await t.hold(12, 1); await t.frames(12);
  t.check("hold D-pad ↑ → the emote wheel opens", await t.L(`document.getElementById("ptWheel").classList.contains("open") && document.querySelectorAll("#ptWheel .disc").length === 8`));
  await t.shot("wheel-foot");
  await t.L(`(__pad.axes[2] = 1, __pad.axes[3] = 0, true)`);     // aim the right stick at a slot
  await t.frames(4);
  await t.hold(12, 0); await t.frames(3);
  await t.L(`(__pad.axes[2] = 0, __pad.axes[3] = 0, true)`);
  const aimed = await g(`ctx.emotes.active`);
  t.check("let go of ↑ → the aimed gesture plays, the wheel closes", !!aimed && !aimed.local && await t.L(`!document.getElementById("ptWheel").classList.contains("open")`), JSON.stringify(aimed));
  await t.frames(90);
  await g(`ctx.emotes.debug.resetCool()`);
  await t.tap(12); await t.frames(3);
  t.check("a quick tap of ↑ = 👋 Hi!", (await g(`ctx.emotes.active && ctx.emotes.active.id`)) === "hi");
  await t.frames(6);
  await t.shot("solo-wave");
  // moving off cancels it (she never freezes in place)
  await t.stick(0, -1); await t.frames(30); await t.stick(0, 0);
  t.check("walking off cancels the gesture", !(await g(`ctx.emotes.active`)));
  await g(`(ctx.foot.end ? ctx.foot.end("test") : 0, L3.setState("title"), true)`);
  await t.frames(6);

  // ── 🌍 Hang out: the host goes straight into Free Roam ──
  await t.click(/Party with friends/);
  t.check("the hub's first choice is 🌍 Hang out (Free Roam)", await t.L(`(() => { const b = document.querySelector("#screenCard button"); return !!b && b.id === "pt_roam"; })()`));
  await t.L(`(() => { window.__states = []; import("./js/core/ctx.js").then(m => m.on("state", e => window.__states.push(e.to))); return true; })()`);
  await t.L(`document.getElementById("pt_roam").click()`);
  if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.G.mode === "party"`, "🌍 Hang out → driving in Free Roam", 120000)) return;
  const hostStates = await t.L(`window.__states.slice()`);
  t.check("no 3-2-1 grid on the way into Free Roam", !hostStates.includes("partyGrid"), hostStates.join(">"));
  const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`), HU = JSON.stringify(hostUid);
  t.check("my invite link carries me (…&with=)", await g(`(() => { const u = ctx.party.invite ? 1 : 0; return u; })()`) === 1);
  for (const p of [Hp]) await p.game(`(ctx.law && ctx.law.hold && ctx.law.hold(9999), true)`);
  // the host climbs out and walks a bit
  await g(`ctx.foot.start("parked")`);
  if (!await Hp.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, "the host walks", 60000)) return;

  // ── a friend opens the link → lands right beside the host (on foot, she's walking) ──
  const A = await guestPage(t, "guest", { totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q0}&party=${code}&with=${hostUid}`);
  guests.push(A);
  await A.L(`(() => { window.__states = []; const tryHook = () => { if (!window.__lulu3d) return setTimeout(tryHook, 200); import("./js/core/ctx.js").then(m => m.on("state", e => window.__states.push(e.to))); }; tryHook(); return true; })()`);
  if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && (ctx.state === "playing" || ctx.state === "footRun")`, "the link drops the friend straight into Free Roam", 240000)) return;
  const guestUid = await A.game(`ctx.party.uid`), GU = JSON.stringify(guestUid);
  // every friend's gesture this screen sees, as it starts (a slow page could miss a 2.6 s gesture between two polls)
  for (const p of [Hp, A]) await p.L(`import("./js/core/ctx.js").then(m => { window.__em = []; m.on("party:emote", e => { if (!e.me) window.__em.push(e.id); }); return true; })`);
  const SAW = id => `(window.__em || []).includes(${JSON.stringify(id)})`;
  t.check("guest: joined from my link (inviter = me)", (await A.game(`ctx.party.inviter`)) === hostUid);
  await A.game(`(ctx.law && ctx.law.hold && ctx.law.hold(9999), true)`);
  await A.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, "the friend climbs out to walk over (the host is on foot)", 90000);
  const hp0 = await g(`({ x: ctx.foot.pos.x, z: ctx.foot.pos.z })`);
  const gp0 = await A.game(`(() => { const p = ctx.foot.active && ctx.foot.pos ? ctx.foot.pos : ctx.car.pos; return { x: p.x, z: p.z }; })()`);
  t.check("guest lands right next to the host (≤ 30 m)", Math.hypot(hp0.x - gp0.x, hp0.z - gp0.z) < 30, JSON.stringify({ hp0, gp0 }));
  t.check("guest: no lobby wall / 3-2-1 on the way in", !(await A.L(`(window.__states || []).includes("partyGrid")`)), JSON.stringify(await A.L(`window.__states`)));
  await Hp.until(`(() => { const rc = ctx.party.remoteCar(${GU}); return !!rc && rc.shown; })()`, "the host sees the friend appear", 90000);
  await A.until(`(() => { const rc = ctx.party.remoteCar(${HU}); return !!rc && rc.shown && rc.foot; })()`, "the friend sees the host walking", 90000);
  await A.page.screenshot({ path: path.join(SHOTS, "3d-partyhang-guest-joined.png") }).catch(() => { });
  // a greeting when she's next to me (both screens, each its own way)
  await g(`ctx.emotes.debug.resetCool()`); await A.game(`ctx.emotes.debug.resetCool()`);
  await A.game(`(() => { const F = ctx.foot.debug.F; F.pos.set(${hp0.x} + 2.5, 0, ${hp0.z} + 2.5); return true; })()`);
  await A.until(`ctx.emotes.debug.ME.greet.has(${HU})`, "guest: a 👋 greeting next to the host", 60000);
  await Hp.until(`ctx.emotes.debug.ME.greet.has(${GU})`, "host: a 👋 greeting too", 60000);

  // ── on foot: the host face-palms (via the wheel) → the friend sees a walking Lulu do it ──
  await g(`ctx.emotes.debug.resetCool()`);
  const before = await A.game(`({ T: ctx.party.clock(), f: L3.frames })`);
  await t.hold(12, 1); await t.frames(10);
  t.check("host on foot (party): the wheel is open", await t.L(`document.getElementById("ptWheel").classList.contains("open")`));
  await t.L(`(() => { const d = [...document.querySelectorAll("#ptWheel .disc")].find(b => /Oy vey/.test(b.textContent)); return d ? (d.click(), true) : false; })()`);
  await t.hold(12, 0); await t.frames(3);
  t.check("host: 🤦 Oy vey! plays on foot", (await g(`ctx.emotes.active && ctx.emotes.active.id`)) === "facepalm");
  t.check("…it rides in my snapshot extras (d.x.e)", await g(`Array.isArray(ctx.party._debug.xk().e)`), JSON.stringify(await g(`ctx.party._debug.xk().e`)));
  if (!await A.until(SAW("facepalm"), "the friend sees the walker face-palm", 60000))
    console.log("   diag", JSON.stringify(await A.game(`(() => { const p = ctx.party.peer(${HU}), rc = ctx.party.remoteCar(${HU}); return { x: p && p.x, m: p && p.m, rc: rc && { shown: rc.shown, foot: rc.foot, key: rc.emKey, em: rc.emote, last: rc.emLast } }; })()`)), JSON.stringify(await g(`({ act: ctx.emotes.active, xk: ctx.party._debug.xk(), st: ctx.state })`)));
  const pose = await A.game(`(() => { const rc = ctx.party.remoteCar(${HU}); const arm = rc.walker && rc.walker.limbs.Arm_R; return { foot: rc.foot, live: !!rc.emote && !rc.emote.local, armX: arm ? +arm.rotation.x.toFixed(2) : null }; })()`);
  t.check("friend: the walker's arm is up at her face (while it plays)", pose.foot && (!pose.live || (pose.armX != null && Math.abs(pose.armX) > 1.2)), JSON.stringify(pose));
  await A.page.screenshot({ path: path.join(SHOTS, "3d-partyhang-guest-sees-facepalm.png") }).catch(() => { });
  await t.shot("host-facepalm");
  const after = await A.game(`({ T: ctx.party.clock(), f: L3.frames })`);
  t.check("nobody frozen: the friend's frames + party clock kept going while the host emoted", after.f > before.f && after.T > before.T, JSON.stringify({ before, after }));
  // a combo: both dance at each other
  await g(`ctx.emotes.debug.resetCool()`); await A.game(`ctx.emotes.debug.resetCool()`);
  await A.frames(60);
  await g(`ctx.emotes.play("dance")`);
  await A.until(SAW("dance"), "the friend sees the host dance", 60000);
  await A.game(`ctx.emotes.play("dance")`);
  await A.until(`!!ctx.emotes.lastCombo`, "friend: a DANCE-OFF combo", 30000);
  await Hp.until(`!!ctx.emotes.lastCombo`, "host: the combo too (it saw both gestures)", 60000);
  t.check("both screens call it the same combo", (await g(`ctx.emotes.lastCombo && ctx.emotes.lastCombo.t`)) === (await A.game(`ctx.emotes.lastCombo && ctx.emotes.lastCombo.t`)));
  await A.page.screenshot({ path: path.join(SHOTS, "3d-partyhang-dance-off.png") }).catch(() => { });

  // ── back in the cars: an emote from the car = an arm out of the window + the phrase ──
  const DRIVE = `(() => { const pk = ctx.foot.parkedCar, p = ctx.foot.pos; ctx.foot.drive(pk ? { own: true, x: pk.x, z: pk.z, h: pk.h } : { own: true, x: p.x, z: p.z, h: 0 }); return true; })()`;
  await g(DRIVE); await A.game(DRIVE);
  for (const p of [Hp, A]) await p.until(`ctx.state === "playing"`, "back behind the wheel", 30000);
  const s0 = await g(`Math.round(ctx.car.s)`);
  await g(`(ctx.party.placeCar(${s0} + 20, 1.75, 0), true)`);
  await A.game(`(ctx.party.placeCar(${s0} + 12, 5.25, 0), true)`);
  await A.until(`(() => { const rc = ctx.party.remoteCar(${HU}); return !!rc && rc.shown && !rc.foot; })()`, "the friend sees the host's car", 60000);
  await g(`ctx.emotes.debug.resetCool()`);
  t.check("party car: emotes allowed (↑ never fires a missile with friends)", await g(`ctx.emotes.allowed`));
  t.check("host plays 🙌 from the car", await g(`ctx.emotes.play("cheer")`));
  await A.until(SAW("cheer"), "the friend sees the host's 🙌 (car)", 60000);
  t.check("friend: the host's car waves + shows the phrase", await A.game(`(() => { const rc = ctx.party.remoteCar(${HU}); return rc.v.waveT > 0 || rc.bubble.life > 0 || !rc.shown; })()`));
  await A.page.screenshot({ path: path.join(SHOTS, "3d-partyhang-guest-sees-car-emote.png") }).catch(() => { });

  // ── 🕹️ a game spot in town: the arcade outside the pizza shop ──
  for (const p of [Hp, A]) {
    await p.until(`ctx.town.debug.S.loaded && ctx.town.exits.length > 0`, "town models + exits", 120000);
    await p.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exits[0].s, speed: 0 })`);
    await p.until(`ctx.town.active && ctx.openworld.zone === "lakewood"`, "in Lakewood", 30000);
  }
  await Hp.until(`ctx.openworld.debug.spots.SP.list.length >= 1`, "the town has its game spots", 30000);
  const spots = await g(`ctx.openworld.debug.spots.SP.list.map(s => ({ kind: s.kind, name: s.name, x: s.x, z: s.z, fx: s.fx, fz: s.fz }))`);
  t.check("Lakewood: an arcade cabinet (+ a notice board)", spots.some(s => s.kind === "arcade"), JSON.stringify(spots));
  const arc = spots.find(s => s.kind === "arcade") || spots[0];
  // the friend parks ~70 m away (not pulled anywhere by what follows)
  const cl = await A.game(`(() => { const pl = ctx.town.plan, st = pl.byName["Lake Dr"]; return { x: pl.ORIGIN.x + st.c + 1.75, z: pl.ORIGIN.z + 50, h: Math.PI }; })()`);
  await A.game(PLACE(cl.x, cl.z, cl.h));
  // the host drives up to it, hops out and walks up → ✋ PARTY GAMES
  const un = { x: (arc.fx - arc.x) / 1.1, z: (arc.fz - arc.z) / 1.1 }, along = { x: un.z, z: -un.x };
  await g(PLACE(arc.fx + along.x * 8 + un.x * 2, arc.fz + along.z * 8 + un.z * 2, 0));     // parked a few metres up the kerb
  await g(`ctx.foot.start("droveOff")`);
  await Hp.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, "host on foot by the arcade", 60000);
  await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${arc.fx}, 0, ${arc.fz}); F.vel.set(0, 0, 0); return true; })()`);
  await t.frames(6);
  if (!await Hp.until(`/PARTY GAMES/.test(document.body.textContent)`, "✋ PARTY GAMES at the cabinet", 10000)) console.log("   diag", await t.L(`document.getElementById("prompt") ? document.getElementById("prompt").textContent : ""`), JSON.stringify(await g(`({ st: ctx.state, ph: ctx.foot.phase, p: ctx.foot.pos && [ctx.foot.pos.x, ctx.foot.pos.z] })`)));
  await t.shot("arcade-prompt");
  await t.tap(0);
  await Hp.until(`!!document.getElementById("owSpot_kugel")`, "the arcade card opens with the games", 20000);
  await t.shot("arcade-card");
  const gpBefore = await A.game(`({ x: ctx.car.pos.x, z: ctx.car.pos.z, st: ctx.state })`);
  await t.L(`document.getElementById("owSpot_kugel").click()`);
  if (!await Hp.until(`ctx.openworld.game && (ctx.openworld.game.ph === "in" || ctx.openworld.game.ph === "off" || ctx.openworld.game.ph === "go")`, "🥘 Hot Kugel: an invitation", 30000))
    console.log("   diag", JSON.stringify(await g(`({ g: ctx.openworld.game, mem: ctx.party.members(), host: ctx.party.isHost, card: !!document.getElementById("owSpot_kugel"), toasts: [...document.querySelectorAll(".toast")].map(e => e.textContent), why: ctx.openworld.debug.getG && ctx.openworld.debug.getG() })`)));
  const g0 = await g(`ctx.openworld.game`);
  t.check("🥘 Hot Kugel from the arcade opens an INVITATION (not a game everyone is pulled into)", !!g0 && g0.ph === "in", JSON.stringify(g0 && { ph: g0.ph, ps: g0.ps, why: g0.why }));
  await A.until(`ctx.openworld.game && ctx.openworld.game.ph === "in" && /join/i.test(document.getElementById("owChip").textContent)`, "the friend gets the invitation (a join chip)", 60000);
  const gInv = await A.game(`({ ps: ctx.openworld.game.ps, spot: ctx.openworld.game.spot, chip: document.getElementById("owChip").textContent, st: ctx.state, x: ctx.car.pos.x, z: ctx.car.pos.z })`);
  t.check("invitation: only the starter is in; the friend isn't moved or held (a join chip)", gInv.ps.length === 1 && gInv.ps[0] === hostUid && !!gInv.spot && gInv.st === "playing" && Math.hypot(gInv.x - gpBefore.x, gInv.z - gpBefore.z) < 3 && /join/i.test(gInv.chip), JSON.stringify(gInv));
  await A.page.screenshot({ path: path.join(SHOTS, "3d-partyhang-guest-invited.png") }).catch(() => { });
  // the friend drives over → opted in → everyone's in → GO
  await A.game(PLACE(arc.fx + 6, arc.fz + 6, 0));
  await A.until(`ctx.openworld.game && ctx.openworld.game.ps.includes(${GU})`, "driving up to the spot opts the friend in", 30000);
  for (const p of [Hp, A]) await p.until(`ctx.openworld.game && ctx.openworld.game.ph === "go" && ctx.openworld.game.k === "kugel"`, "🥘 GO once everyone's in", 40000);
  await Hp.until(`ctx.state === "playing" && !ctx.foot.active`, "the host is back behind the wheel for the game", 30000);
  t.check("both play: ps = host + friend", (await g(`ctx.openworld.game.ps.length`)) === 2);
  await t.shot("kugel-from-the-arcade");
  await g(`ctx.openworld.end()`);
  for (const p of [Hp, A]) await p.until(`ctx.openworld.game && ctx.openworld.game.ph === "done"`, "the game ends", 30000);
  for (const p of [Hp, A]) { await p.frames(10); if (await p.game(`ctx.phone.isOpen`)) await p.game(`ctx.phone.closePhone()`); }

  // ── leave in one tap: 📱 👯 → 🚪 Leave the party; the host plays on ──
  await A.game(`ctx.phone.openPhone("owparty")`);
  await A.frames(4);
  t.check("👯 app: Invite + Leave rows", await A.L(`!!document.getElementById("owInvite") && !!document.getElementById("owLeave")`));
  await A.L(`document.getElementById("owLeave").click()`);
  await A.until(`!ctx.party.active && ctx.state === "title"`, "one tap: the friend has left", 30000);
  await Hp.until(`ctx.party.members().length === 1`, "the host sees the friend go", 120000);
  t.check("the host keeps playing", await g(`ctx.party.active && (ctx.state === "playing" || ctx.state === "footRun")`));
}
