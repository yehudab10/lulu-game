// 👯 A FRIENDS LIST THAT LASTS (ci/friends, roadmap 19 stage 1) — against the LOCAL relay (never production).
//   ADD       out in the world (EVERYONE): A ➕ asks driver B from 📍 Nearby; B sees it ONLY as a line on A's row in
//             Nearby (no toast, no banner, no chip — A is a stranger); B ✓ → both lists have each other (curated names)
//   PRESENCE  each sits in her own doorbell; A's 👯 knocks → B "playing · on the highway"; B off the EVERYONE room
//             (⚙️ Play online OFF) is STILL reachable by friends; 🙈 appear offline → B shows as not playing
//   JOIN      B "nobody" → a friendly no · "ask me" → ONE chip on B, B ✓ → A lands next to B in 🌍 Free Roam
//   STRANGER  a raw relay client at B's doorbell (with a made-up friend id) gets no answer; a closed code room is empty
//   CODE      A shows a code, C types it, A ✓ → friends (both said yes)
//   REMOVE / BLOCK  remove → A's doorbell changes (B can't find A until A knocks); block → B's asks are dropped
//   BACKUP    A's 💾 save code restored on a fresh page → the same friends, and they still find each other
//   GHOSTS    tap a name over a car → that driver's page (➕); once friends knock, each sees the other's ghost in
//             EVERYONE as 👯 + their name (the knock says which ghost — sealed; strangers keep the random label)
// Waits are in GAME frames (scripts/lib/party3d.js), never wall time.
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
let relay = null;
const PORT = 29000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const Q = url => `&enable=multiplayer,party,openworld,foot,town,atmos,phone,friends&mpurl=${encodeURIComponent(url)}`;
const S = `ctx.mp._debug`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = {
  name: "friends",
  fast: false,     // (two pages on the relay, which keep a REAL performance.now: flaky on the fast clock — 1 red in 2 full runs — the old clock)
  viewport: { width: 960, height: 540 },
  query: Q(URL),
  save2d: { totalCoins: 100, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(6 * 60000);
    const pages = [];
    try { await body(t, pages); }
    catch (e) { t.check("friends threw", false, String(e && e.stack || e).slice(0, 400)); }
    finally {
      for (const g of pages) {
        t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
        try { await g.page.close(); } catch (e) { }
      }
      relay.kill();
    }
  },
};

const PLACE = (s, d) => `(() => { ctx.traffic.clear(); ctx.traffic.config.enabled = false; const p = ctx.world.road.point(${s}, ${d}, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = ${d}; ctx.car.vx = ctx.car.vz = 0; ctx.car.vF = 0; return true; })()`;
const HOLD = `(ctx.law && ctx.law.hold && ctx.law.hold(900), ctx.G.invT = 999, true)`;
const F = `ctx.friends`;
/** Every pop-up on screen right now (toasts + banner + chips) as one string. */
const POPS = `[...document.querySelectorAll(".toast, #banner:not(.hidden), #frChip, #owChip, #mpOverlay .ban, #mpOverlay .toasts > div")].filter(e => e.offsetParent !== null).map(e => e.textContent).join(" | ")`;

async function drive(P, s, d) {
  await P.game(`L3.startRun({ mode: "cruise", quick: true })`);
  await P.until(`__lulu3d.state === "playing"`, `${P.label}: cruise starts`);
  await P.game(HOLD); await P.game(PLACE(s, d));
}

async function body(t, pages) {
  const A = hostPage(t);
  t.check("friends: crypto available on the test page", await A.game(`${F}.ok`));
  await drive(A, 400, 1.75);
  if (!await A.until(`${S}.connected && ctx.mp.room === "lobby"`, "A: online (EVERYONE)")) return;
  const B = await guestPage(t, "B", { totalCoins: 0, ownedSkins: ["pink", "gold"], selectedSkin: "gold", mpName: "Latke Legend" }, Q(URL));
  pages.push(B);
  await B.until(`__lulu3d && __lulu3d.state === "title"`, "B boots", 120000);
  await drive(B, 425, -1.75);
  await B.until(`${S}.connected`, "B: online");
  if (!await A.until(`Object.values(${S}.peers).some(p => p.onScreen)`, "A sees B's ghost", 60000)) return;
  const bId = await B.game(`${S}.myId`), aId = await A.game(`${S}.myId`);

  // ── tap a NAME over a car → that driver's page (➕) ──
  t.check("before: B's ghost wears a stranger's label (a colour + a number)", /^[A-Z][a-z]+ \d\d$/.test(await A.game(`(ctx.mp.peerById(${JSON.stringify(bId)}) || {}).name || ""`)), await A.game(`(ctx.mp.peerById(${JSON.stringify(bId)}) || {}).name`));
  const ts = await A.game(`ctx.mp.tagOnScreen(${JSON.stringify(bId)})`);
  if (ts) {
    await A.page.mouse.click(ts.x, ts.y);
    await A.frames(4);
    t.check("tap B's name over the car → 📍 Nearby › B's page with ➕ Ask to be friends", await A.L(`!!document.getElementById("frDa")`) && await A.game(`ctx.phone.isOpen`));
    await A.game(`(ctx.phone.closePhone(), true)`);
    await A.frames(3);
  } else t.check("B's name tag is on A's screen", false, "no tag on screen");
  const miss = await A.game(`ctx.mp.ghostAt(5, 5)`);
  t.check("a tap anywhere else isn't a name", miss === null, String(miss));

  // ── ADD from 📍 Nearby: A asks, B sees only a line on A's row ──
  t.check("no friends yet, no doorbell (a friends list costs nothing)", await A.game(`${F}.list.length === 0 && !${F}.debug().bell.open`));
  await A.game(`(ctx.phone.openPhone("nearby"), true)`);
  await A.frames(4);
  const row = await A.L(`(() => { const b = document.querySelector('[data-drv="${bId}"]'); return b ? b.textContent : ""; })()`);
  t.check("📍 Nearby lists B as a tappable driver row", !!row, row);
  await A.L(`document.querySelector('[data-drv="${bId}"]').click()`);
  await A.frames(3);
  t.check("A: the driver page offers ➕ Ask to be friends", await A.L(`!!document.getElementById("frDa")`));
  await A.L(`document.getElementById("frDa").click()`);
  await A.until(`${F}.outgoing("mp", ${JSON.stringify(bId)}) === "ask"`, "A: asked");
  await A.game(`(ctx.phone.closePhone(), true)`);
  if (!await B.until(`${F}.incoming("mp").some(q => q.peer === ${JSON.stringify(aId)})`, "B: A's ask arrives", 60000)) return;
  await B.frames(20);
  const popsB = await B.L(POPS);
  t.check("B: a stranger's ask pops up NOTHING (no toast / banner / chip)", !/friend/i.test(popsB), popsB);
  await B.game(`(ctx.phone.openPhone("nearby"), true)`);
  await B.frames(4);
  const rowB = await B.L(`(() => { const b = document.querySelector('[data-drv="${aId}"]'); return b ? b.textContent : ""; })()`);
  t.check("B: A's row in 📍 Nearby says \"wants to be friends\"", /wants to be friends/.test(rowB), rowB);
  await B.L(`document.querySelector('[data-drv="${aId}"]').click()`);
  await B.frames(3);
  await B.L(`document.getElementById("frDy").click()`);
  const made = await A.until(`${F}.list.length === 1`, "A: B is a friend", 60000) && await B.until(`${F}.list.length === 1`, "B: A is a friend", 60000);
  t.check("both said yes → each is on the other's list", made);
  if (!made) return;
  await B.game(`(ctx.phone.closePhone(), true)`);
  const la = await A.game(`${F}.list[0]`), lb = await B.game(`${F}.list[0]`);
  t.check("A's list: B by their curated name + a small number", /^Latke Legend #\d\d$/.test(la.label), JSON.stringify(la));
  t.check("B's list: A as Kugel Kid #NN", /^Kugel Kid #\d\d$/.test(lb.label), JSON.stringify(lb));
  t.check("the friend ids are random and differ", la.f !== lb.f && /^[A-Z2-7]{16}$/.test(la.f), la.f + " / " + lb.f);
  const fA = await A.game(`${F}.me`), fB = await B.game(`${F}.me`);
  t.check("each side's record of the other matches their real id", la.f === fB && lb.f === fA);
  t.check("the friend id IS the one player identity (ctx.player.id())", fA === await A.game(`ctx.player.id()`) && fB === await B.game(`ctx.player.id()`));
  t.check("…and my friends see my label the way I do (ctx.player.label())", lb.label === await A.game(`ctx.player.label()`), lb.label);

  // ── PRESENCE through the doorbells ──
  t.check("A's doorbell opens once A has a friend", await A.until(`${F}.debug().bell.open`, "A: doorbell", 30000));
  t.check("B's doorbell opens too", await B.until(`${F}.debug().bell.open`, "B: doorbell", 30000));
  await A.game(`${F}.check()`);
  const pa = await A.game(`${F}.list[0].presence`);
  t.check("A's 👯 knock: B is playing, on the highway", !!pa && pa.on === true && /highway/.test(pa.w || ""), JSON.stringify(pa));
  t.check("…and the knock told B that A is on", await B.until(`(${F}.list[0].presence || {}).on === true`, "B: A on", 20000));
  // ── a friend recognised in EVERYONE (the knocks said which ghost each is — sealed) ──
  t.check("A sees B's ghost as 👯 Latke Legend #NN", await A.until(`/^👯 Latke Legend #\\d\\d$/.test((ctx.mp.peerById(${JSON.stringify(bId)}) || {}).name || "")`, "A: B's ghost labelled as a friend", 20000));
  t.check("B sees A's ghost as 👯 Kugel Kid #NN", await B.until(`/^👯 Kugel Kid #\\d\\d$/.test((ctx.mp.peerById(${JSON.stringify(aId)}) || {}).name || "")`, "B: A's ghost labelled as a friend", 20000));
  // a friend who isn't in my EVERYONE room at all
  await B.game(`(ctx.mp.setOnline(false), true)`);
  await B.until(`!${S}.want`, "B: Play online OFF");
  await A.game(`${F}.check()`);
  const pa2 = await A.game(`${F}.list[0].presence`);
  t.check("B off the EVERYONE room (⚙️ Play online OFF): friends still see B playing", !!pa2 && pa2.on === true, JSON.stringify(pa2));

  // ── the 👯 app ──
  await A.game(`(ctx.phone.openPhone("friends"), true)`);
  await A.frames(4);
  const appTx = await A.L(`(document.getElementById("lpApp") || {}).textContent || ""`);
  t.check("👯 Friends app: B under \"Playing now\" with ▶ Join", /Playing now/.test(appTx) && /Latke Legend #\d\d/.test(appTx) && /Join/.test(appTx), appTx.slice(0, 300));
  t.check("👯 has ➕ Add by code · who can join me · appear offline", /Add by code/.test(appTx) && /Who can join me: Ask me/.test(appTx) && /Appear offline/.test(appTx));
  await A.game(`(ctx.phone.closePhone(), true)`);

  // ── JOIN: nobody → a no; ask me → one chip, ✓ → A lands next to B ──
  await B.game(`(${F}.join = "nobody", true)`);
  const no = await A.game(`${F}.joinFriend(${JSON.stringify(la.f)})`);
  t.check("B \"nobody\": A gets a friendly no", /isn't taking visitors/.test(no), no);
  await B.game(`(${F}.join = "ask", true)`);
  await A.game(`(window.__jr = null, ${F}.joinFriend(${JSON.stringify(la.f)}).then(m => window.__jr = m), true)`);
  if (!await B.until(`${F}.joinAsks().length === 1`, "B: A's join ask", 30000)) return;
  await B.frames(4);
  const chip = await B.L(`(() => { const c = document.getElementById("frChip"); return c && c.offsetParent !== null ? c.textContent : ""; })()`);
  t.check("B \"ask me\": ONE quiet chip says A wants to join", /Kugel Kid #\d\d wants to join you/.test(chip), chip);
  await B.game(`${F}.answerJoin(${JSON.stringify(lb.f)}, true)`);
  if (!await B.until(`ctx.party.active && ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam"`, "B: hosts a 🌍 Free Roam silently", 120000)) return;
  if (!await A.until(`window.__jr && ctx.party.active && ctx.party.connected && ctx.state === "playing" && ctx.party.activity.k === "roam"`, "A: joins B's party", 120000)) return;
  const jr = await A.game(`window.__jr`);
  t.check("A: \"off to B\"", /Off to Latke Legend/.test(jr), jr);
  t.check("A and B are in the same party", await A.game(`ctx.party.code`) === await B.game(`ctx.party.code`));
  const grp = await A.game(`({ active: ctx.group.active, size: ctx.group.size, roaming: ctx.group.roaming, friend: ctx.group.members.filter(m => !m.me).map(m => m.friend) })`);
  t.check("ctx.group: with friends, in 🌍 Free Roam, 2 of us, and B is on my friends list", grp.active && grp.roaming && grp.size === 2 && grp.friend.length === 1 && grp.friend[0] === true, JSON.stringify(grp));
  const near = await A.until(`(() => { const p = ctx.party.players.find(q => !q.me); const pos = p && ctx.openworld.debug.posOf(p.uid); const m = ctx.car.pos; return !!pos && Math.hypot(pos.x - m.x, pos.z - m.z) < 60; })()`, "A lands next to B", 60000);
  t.check("A lands right next to B", near);
  await A.game(`(ctx.phone.openPhone("owparty"), true)`);
  await A.frames(4);
  t.check("in the party, 👯 has \"My friends list\"", await A.L(`!!document.getElementById("owFL")`));
  await A.L(`document.getElementById("owFL").click()`);
  await A.frames(4);
  const inParty = await A.L(`(document.getElementById("lpApp") || {}).textContent || ""`);
  t.check("…which shows B as \"with you\"", /with you/.test(inParty), inParty.slice(0, 200));
  await A.game(`(ctx.phone.closePhone(), true)`);
  const aw = await A.L(`import("./js/features/friends/group.js").then(m => [m.awayFrom("lakewood", [{ zone: "midwood" }], z => z === "midwood" ? "Midwood" : z), m.awayFrom("lakewood", [{ zone: "lakewood" }]), m.awayFrom("", [{ zone: "midwood" }])])`);
  t.check("\"leave the group?\" only when she's in a town none of her friends are in", /friends are in Midwood — leave the group/.test(aw[0]) && aw[1] === "" && aw[2] === "", JSON.stringify(aw));
  // 🏁 the old lobby games as a vote from 🌍 Free Roam: A asks, B gets ONE chip, it starts only when everyone's in
  await A.game(`(ctx.phone.isOpen && ctx.phone.closePhone(), true)`);
  const why = await A.game(`ctx.group.vote.propose("race")`);
  t.check("👯 › Games: A asks for a 🏁 race (everyone)", why === "", why);
  if (await B.until(`(ctx.group.vote.current() || {}).k === "race"`, "B: the race vote arrives", 30000)) {
    await B.frames(6);
    const vchip = await B.L(`(() => { const c = document.getElementById("frChip"); return c && c.offsetParent !== null ? c.textContent : ""; })()`);
    t.check("B: ONE quiet chip — Kugel Kid wants a race (1/2 in)", /wants a race — 1\/2 in/.test(vchip), vchip);
    t.check("…and nothing has started yet (still 🌍 Free Roam on both)", await A.game(`ctx.party.activity.k === "roam"`) && await B.game(`ctx.party.activity.k === "roam"`));
    await B.game(`ctx.group.vote.yes()`);
    const go = await A.until(`ctx.party.activity.k === "race" && ctx.party.activity.fromRoam === 1`, "A: everyone said yes → the race starts", 60000) && await B.until(`ctx.party.activity.k === "race"`, "B: the race starts", 60000);
    t.check("everyone in → the race starts for both (and remembers it came from Free Roam)", go);
    await B.game(`ctx.party.hostStart("roam")`);
    t.check("…and back to 🌍 Free Roam after (no lobby)", await A.until(`ctx.party.activity.k === "roam"`, "A: back in Free Roam", 60000) && await B.until(`ctx.party.activity.k === "roam"`, "B: back in Free Roam", 60000));
    await A.until(`ctx.state === "playing" || ctx.state === "footRun"`, "A: roaming again", 60000);
  }
  // 🤝 missions together (the API features adopt): a test mission on both screens; A offers, B joins, A goes → both start
  const REG = `(window.__ms = [], ctx.group.invitable({ id: "test.pair", icon: "🧪", title: "Test pair job", blurb: "two of us", max: 4, start: o => window.__ms.push(o) }))`;
  await A.game(REG); await B.game(REG);
  const off = await A.game(`ctx.group.offer("test.pair")`);
  t.check("missions: A offers a mission from 👯", off === "", off);
  if (await B.until(`(ctx.group.offerNow() || {}).id === "test.pair"`, "B: the offer arrives", 30000)) {
    await B.frames(6);
    const mchip = await B.L(`(() => { const c = document.getElementById("frChip"); return c && c.offsetParent !== null ? c.textContent : ""; })()`);
    t.check("B: ONE quiet chip — Kugel Kid: Test pair job — join?", /Test pair job — join\?/.test(mchip), mchip);
    await B.game(`ctx.group.joinOffer()`);
    await A.until(`(ctx.group.offerNow() || {}).ins && ctx.group.offerNow().ins.length === 2`, "A: B is in", 30000);
    await A.game(`ctx.group.goNow()`);
    const both = await A.until(`window.__ms.length === 1`, "A: the mission starts", 30000) && await B.until(`window.__ms.length === 1`, "B: the mission starts", 30000);
    const ma = await A.game(`window.__ms[0]`), mb = await B.game(`window.__ms[0]`);
    t.check("▶ go now → start() runs on BOTH screens with the same members + seed", both && ma.members.length === 2 && ma.seed === mb.seed && ma.members.join() === mb.members.join() && !!ma.by && ma.by === mb.by, JSON.stringify([ma, mb]));
  }
  // 🚪 Leave the group (one tap in 👯): carry on alone from home — not the title screen
  await A.game(`(ctx.phone.openPhone("owparty"), true)`);
  await A.frames(4);
  await A.L(`document.getElementById("owLeave").click()`);
  await B.game(`(ctx.party.leave(), true)`);
  await A.until(`!ctx.party.active && (ctx.state === "footRun" || ctx.state === "playing") && ctx.G.mode === "cruise"`, "A: left the group → home, still playing", 120000);
  t.check("🚪 Leave the group: carries on alone from home (not the title screen)", await A.game(`!ctx.party.active && ctx.state !== "title"`));
  t.check("ctx.group: alone again after leaving", await A.game(`!ctx.group.active && ctx.group.size === 0 && ctx.group.members.length === 0`));
  await B.until(`!ctx.party.active && ctx.state === "title"`, "B: left the party");
  await drive(A, 400, 1.75);
  await drive(B, 425, -1.75);

  // ── STRANGER: a raw client at B's doorbell with a made-up id gets nothing ──
  const bell = await B.game(`${F}.debug().bell.bell`);
  const got = await strangerKnock(bell);
  t.check("a stranger at B's doorbell (made-up friend id) gets no answer", got.owner && !got.answer, JSON.stringify(got));

  // ── APPEAR OFFLINE ──
  await B.game(`(${F}.hidden = true, true)`);
  await B.until(`!${F}.debug().bell.open`, "B: doorbell closed", 20000);
  await A.game(`${F}.check()`);
  t.check("🙈 B appears offline → A sees B as not playing", (await A.game(`${F}.list[0].presence`) || {}).on === false);
  await B.game(`(${F}.hidden = false, true)`);
  await B.until(`${F}.debug().bell.open`, "B: doorbell back", 20000);

  // ── CODE: A shows a code, C types it, A says yes ──
  const C = await guestPage(t, "C", { totalCoins: 0, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Babka Baron" }, Q(URL));
  pages.push(C);
  await C.until(`__lulu3d && __lulu3d.state === "title"`, "C boots", 120000);
  await A.game(`(ctx.phone.openPhone("friends", { code: 1 }), true)`);
  await A.frames(4);
  const code = await A.game(`${F}.code`);
  t.check("➕ Add by code shows a 6-letter code", /^[A-Z2-9]{6}$/.test(code), code);
  await drive(C, 450, 1.75);
  await C.game(`(ctx.phone.openPhone("friends", { code: 1 }), true)`);
  const cCode = await C.game(`${F}.code`);
  const send = `${F}.useCode(${JSON.stringify(code)})`;
  const used = await C.game(`Promise.all([${send}, ${send}])`);
  t.check("double send uses one visit", used.every(v => v === "asked"), used);
  if (!await A.until(`${F}.incoming("code").length === 1`, "A sees one request", 30000)) return;
  const oldPeer = await A.game(`${F}.incoming("code")[0].peer`);
  // Switching to an empty room closes that connection. Its row must disappear.
  const empty = [ "ABC234", "DEF567", "GHJ789" ].find(v => v !== code && v !== cCode);
  await C.game(`${F}.useCode(${JSON.stringify(empty)})`);
  t.check("disconnected request disappears", await A.until(`!${F}.incoming("code").length && !document.querySelector("[data-cy]")`, "stale row removed"));
  t.check("stale Accept cannot succeed", !await A.game(`${F}.accept("code", ${JSON.stringify(oldPeer)})`));
  await Promise.all([C.game(send), A.game(`${F}.useCode(${JSON.stringify(cCode)})`)]);
  for (const player of [A, C]) {
    if (!await player.until(`document.querySelectorAll("[data-cy]").length === 1`, "one live Accept button", 30000)) return;
  }
  await Promise.all([A, C].map(player => player.L(`document.querySelector("[data-cy]").click()`)));
  t.check("crossed codes add each friend once", await A.until(`${F}.list.length === 2`, "A: 2 friends", 30000) && await C.until(`${F}.list.length === 1`, "C: 1 friend", 30000));
  const secretFor = id => `import("./js/features/friends/store.js").then(m => m.friend(${JSON.stringify(id)})?.s)`;
  const ac = await A.L(secretFor(await C.game(`${F}.me`)));
  t.check("both phones can read future friend messages", !!ac && ac === await C.L(secretFor(fA)));
  await A.game(`(ctx.phone.closePhone(), true)`);
  await A.until(`!${F}.code`, "A: the code room closes with the screen", 10000);
  const late = await C.game(`${F}.useCode(${JSON.stringify(code)})`);
  t.check("the code is dead once A's screen closed", late === "nobody", late);

  // ── BACKUP: A's save code on a fresh page D → same friends, still found ──
  const saveCode = await A.L(`import("./js/features/meta/screens.js").then(m => m.saveToCode())`);
  const D = await guestPage(t, "D", { totalCoins: 0, selectedSkin: "pink" }, Q(URL));
  pages.push(D);
  await D.until(`__lulu3d && __lulu3d.state === "title"`, "D boots", 120000);
  await Promise.all([
    D.page.waitForEvent("load", { timeout: 180000 }),
    D.L(`import("./js/features/meta/screens.js").then(m => (m.applySave(m.codeToSave(${JSON.stringify(saveCode)})), true))`).catch(() => null),
  ]);
  await D.until(`__lulu3d && __lulu3d.state === "title" && __lulu3d.frames > 30`, "D reloads after the restore", 120000);
  const dl = await D.game(`({ me: ${F}.me, n: ${F}.list.length })`);
  t.check("the 💾 save code brings the friends list back (same id, 2 friends)", dl.me === fA && dl.n === 2, JSON.stringify(dl));
  t.check("…and the same player secret (ctx.player — a new phone is the same player)", await D.game(`ctx.player.secret()`) === await A.game(`ctx.player.secret()`));
  await D.page.close(); pages.splice(pages.indexOf(D), 1);

  // ── REMOVE: A removes C → A's doorbell changes; C can't find A ──
  const bell0 = await A.game(`${F}.debug().bell.bell`);
  await A.game(`${F}.remove(${JSON.stringify(await C.game(`${F}.me`))})`);
  await A.until(`${F}.debug().bell.bell !== ${JSON.stringify(bell0)} && ${F}.debug().bell.open`, "A: a new doorbell", 20000);
  await C.game(`${F}.check()`);
  t.check("removed: C now sees A as not playing (the doorbell C knew is gone)", (await C.game(`${F}.list[0].presence`) || {}).on === false);
  // B still finds A: A's next knock hands B the new doorbell
  await A.game(`${F}.check()`);
  await B.game(`${F}.check()`);
  t.check("…but B (still a friend) finds A again after A's knock", (await B.game(`${F}.list[0].presence`) || {}).on === true);

  // ── BLOCK: B blocks A → A's ask never shows on B ──
  await B.game(`${F}.block(${JSON.stringify(lb.f)})`);
  t.check("B blocked A: off B's list, on the blocked list", await B.game(`${F}.list.length === 0 && ${F}.blocked.length === 1`));
  await A.game(`(ctx.mp.setOnline(true), true)`);
  await B.game(`(ctx.mp.setOnline(true), true)`);
  await B.until(`${S}.connected`, "B: online again");
  await A.until(`Object.values(${S}.peers).some(p => p.onScreen)`, "A sees B again", 60000);
  const bId2 = await B.game(`${S}.myId`), aId2 = await A.game(`${S}.myId`);
  await A.game(`${F}.add("mp", ${JSON.stringify(bId2)})`);
  await B.frames(120);
  t.check("a blocked player's ➕ never reaches B", !(await B.game(`${F}.incoming("mp").some(q => q.peer === ${JSON.stringify(aId2)})`)));
}

/** A raw relay client that knows B's doorbell (as if leaked) but isn't a friend: knock with a made-up id. */
function strangerKnock(bell) {
  return new Promise(resolve => {
    const ws = new WebSocket(`${URL}/room/B${bell}`);
    let owner = false, answer = false, me = null;
    ws.onopen = () => ws.send(JSON.stringify({ t: "j", v: 1, room: "B" + bell, name: "BAD", sk: "red" }));
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.t === "h") { me = m.id; owner = (m.peers || []).some(p => p.d && p.d.o === 1); ws.send(JSON.stringify({ t: "s", d: { k: { f: "ABCDEFGHJK", c: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" } } })); }
      if (m.t === "s" && m.d && Array.isArray(m.d.r) && m.d.r.some(x => x && x.to === me)) answer = true;
    };
    setTimeout(() => { try { ws.close(); } catch (e) { } resolve({ owner, answer }); }, 4000);
  });
}
