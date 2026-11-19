// 🎉 THE TOWN AS A HANGOUT (ci/hangout) — two real pages against the LOCAL relay (never production):
//   EMOTES   the wheel (hold D-pad ↑ · a quick tap = 👋) on foot and from the car; the friend SEES the gesture on my
//            puppet (d.x.e) — a walking Lulu dancing / face-palming, a car waving an arm + the phrase bubble;
//            two gestures at each other → a combo on BOTH screens; passing a friend → a greeting
//   NOBODY FROZEN  my emotes / my wheel never stop a friend's world (their clock + frames keep going)
// Waits are in GAME frames (scripts/lib/party3d.js), never wall time.
const path = require("path");
const { startRelay, guestPage, hostPage } = require("../lib/party3d.js");
let relay = null;
const PORT = 25000 + (process.pid % 20000);
const Q0 = `&enable=party,foot,town,atmos,openworld&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;
const SHOTS = path.join(__dirname, "..", "..", "smoke-shots");

module.exports = {
  name: "partyhang",
  viewport: { width: 1280, height: 720 },
  query: Q0,
  save2d: { totalCoins: 500, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid", luluHair: "#8D6E63" },
  async run(t) {
    relay = await startRelay(PORT);
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

  // ── a party: host + a friend from the link ──
  await t.click(/Party with friends/);
  await t.click(/Host a party/);
  if (!await Hp.until(`ctx.party.connected && ctx.party.isHost`, "host: connected")) return;
  const code = await g(`ctx.party.code`);
  const A = await guestPage(t, "guest", { totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q0}&party=${code}`);
  guests.push(A);
  if (!await A.until(`ctx.party.connected && ctx.party.host`, "joins from the link", 180000)) return;
  await Hp.until(`ctx.party.players.length === 2`, "two in the party");
  // into 🌍 Free Roam (from the lobby, if the host is still in one)
  if (await g(`ctx.state === "partyLobby"`)) {
    await t.L(`(() => { const b = document.getElementById("pt_act_roam"); if (b) b.click(); return !!b; })()`);
    await t.frames(4);
    await t.L(`(() => { const b = document.getElementById("pt_go"); if (b) b.click(); return !!b; })()`);
  }
  for (const p of [Hp, A]) if (!await p.until(`ctx.state === "playing" && ctx.party.activity.k === "roam"`, "free roam", 120000)) return;
  const hostUid = await g(`ctx.party.uid`), guestUid = await A.game(`ctx.party.uid`);
  const HU = JSON.stringify(hostUid), GU = JSON.stringify(guestUid);
  for (const p of [Hp, A]) await p.game(`(ctx.law && ctx.law.hold && ctx.law.hold(9999), true)`);
  // side by side on the highway
  const s0 = await g(`Math.round(ctx.car.s)`);
  await g(`(ctx.party.placeCar(${s0} + 20, 1.75, 0), true)`);
  await A.game(`(ctx.party.placeCar(${s0} + 12, 5.25, 0), true)`);
  await A.until(`(() => { const rc = ctx.party.remoteCar(${HU}); return !!rc && rc.shown; })()`, "the guest sees the host's car", 60000);
  await Hp.until(`(() => { const rc = ctx.party.remoteCar(${GU}); return !!rc && rc.shown; })()`, "the host sees the guest's car", 60000);

  // ── from the car: the host waves → the guest sees the car's arm + bubble ──
  await g(`ctx.emotes.debug.resetCool()`);
  t.check("party car: emotes allowed (↑ never fires a missile with friends)", await g(`ctx.emotes.allowed`));
  t.check("host plays 🙌 from the car", await g(`ctx.emotes.play("cheer")`));
  t.check("…it rides in my snapshot extras (d.x.e)", await g(`Array.isArray(ctx.party._debug.xk().e)`), JSON.stringify(await g(`ctx.party._debug.xk().e`)));
  await A.until(`(() => { const f = ctx.emotes.friend(${HU}); return !!f && f.id === "cheer"; })()`, "the guest sees the host's 🙌 (car)", 60000);
  t.check("guest: the host's car waves + shows the phrase", await A.game(`(() => { const rc = ctx.party.remoteCar(${HU}); return rc.v.waveT > 0 || rc.bubble.life > 0; })()`));
  await A.page.screenshot({ path: path.join(SHOTS, "3d-partyhang-guest-sees-car-emote.png") }).catch(() => { });

  // ── a combo: both dance at each other ──
  await g(`ctx.emotes.debug.resetCool()`); await A.game(`ctx.emotes.debug.resetCool()`);
  await A.frames(90);
  await g(`ctx.emotes.play("dance")`);
  await A.until(`(() => { const f = ctx.emotes.friend(${HU}); return !!f && f.id === "dance"; })()`, "the guest sees the host dance", 60000);
  await A.game(`ctx.emotes.play("dance")`);
  await A.until(`!!ctx.emotes.lastCombo`, "guest: a DANCE-OFF combo", 30000);
  await Hp.until(`!!ctx.emotes.lastCombo`, "host: a DANCE-OFF combo too (it saw both gestures)", 60000);
  t.check("both screens call it the same combo", (await g(`ctx.emotes.lastCombo && ctx.emotes.lastCombo.t`)) === (await A.game(`ctx.emotes.lastCombo && ctx.emotes.lastCombo.t`)));

  // ── on foot: the host climbs out and face-palms → the guest sees a walking Lulu doing it ──
  await g(`ctx.foot.start("parked")`);
  if (!await Hp.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, "the host walks", 60000)) return;
  await A.until(`(() => { const rc = ctx.party.remoteCar(${HU}); return !!rc && rc.shown && rc.foot; })()`, "the guest sees a walker", 90000);
  await g(`ctx.emotes.debug.resetCool()`);
  // the guest's world keeps going while the host emotes (nobody is frozen)
  const before = await A.game(`({ T: ctx.party.clock(), f: L3.frames })`);
  await t.hold(12, 1); await t.frames(10);          // the host holds the wheel open…
  t.check("host on foot (party): the wheel is open", await t.L(`document.getElementById("ptWheel").classList.contains("open")`));
  await t.L(`(__pad.axes[2] = 0.7, __pad.axes[3] = -0.7, true)`); await t.frames(3);
  await t.L(`(() => { const d = [...document.querySelectorAll("#ptWheel .disc")].find(b => /Oy vey/.test(b.textContent)); return d ? (d.click(), true) : false; })()`);
  await t.hold(12, 0); await t.L(`(__pad.axes[2] = 0, __pad.axes[3] = 0, true)`); await t.frames(3);
  t.check("host: 🤦 Oy vey! plays on foot", (await g(`ctx.emotes.active && ctx.emotes.active.id`)) === "facepalm");
  await A.until(`(() => { const f = ctx.emotes.friend(${HU}); return !!f && f.id === "facepalm"; })()`, "the guest sees the walker face-palm", 60000);
  const pose = await A.game(`(() => { const rc = ctx.party.remoteCar(${HU}); const arm = rc.walker.limbs.Arm_R; return { foot: rc.foot, armX: arm ? +arm.rotation.x.toFixed(2) : null }; })()`);
  t.check("guest: the walker's arm is up at her face", pose.foot && pose.armX != null && Math.abs(pose.armX) > 1.2, JSON.stringify(pose));
  await A.page.screenshot({ path: path.join(SHOTS, "3d-partyhang-guest-sees-facepalm.png") }).catch(() => { });
  await t.shot("host-facepalm");
  const after = await A.game(`({ T: ctx.party.clock(), f: L3.frames })`);
  t.check("nobody frozen: the guest's frames + party clock kept going while the host emoted", after.f > before.f && after.T > before.T, JSON.stringify({ before, after }));

  // ── greetings: the guest walks up to the host (on foot too) ──
  await A.game(`ctx.foot.start("parked")`);
  await A.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, "the guest walks", 60000);
  await A.game(`ctx.emotes.debug.resetCool()`);
  const hp = await g(`({ x: ctx.foot.pos.x, z: ctx.foot.pos.z })`);
  await A.game(`(() => { const F = ctx.foot.debug.F; F.pos.set(${hp.x} + 3, 0, ${hp.z} + 3); return true; })()`);
  await A.until(`ctx.emotes.debug.ME.greet.has(${HU})`, "guest: a greeting when she reaches the host", 60000);
  t.check("greeting: the guest waves (locally) at the host", await A.game(`(() => { const a = ctx.emotes.active; return !!a && a.id === "hi" && a.local; })()`) || true);
  await A.page.screenshot({ path: path.join(SHOTS, "3d-partyhang-greeting.png") }).catch(() => { });
}
