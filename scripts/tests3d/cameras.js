// 📸 features/cameras — speed cameras (roadmap 36). Midwood: the Ocean Parkway poles + the school block's pole stand (one
// small mesh each), the flash fires ONLY above 35 on the parkway (30 = nothing) and only once per pass (re-armed past it),
// the school pole only in school hours (above 25) · each flash takes a real picture (a JPEG) · ≤ 3 a real day · never in a
// chase · 2 played days later: the notice (City Hall's ledger, a `need` 💬 line, "📬 You have mail" on the objective line,
// the ✋ mailbox at home → the card with the photo) · paid at City Hall → closed · unpaid → late fee → summons → Courtroom 2B
// (dismissed = waived; upheld = what she has, never below 0) · 3 unpaid → a bench warrant on law's file → the arrest serves it.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "cameras",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,law,atmos,cityhall,cameras,phone,community,places,foot,realestate",
  save2d: { totalCoins: 500, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); }
      if (process.env.CAM_LOG) console.log(`    [${label}]`, JSON.stringify(await g(`${D}.CM.log.slice(-8)`))); };
    const st = () => g(`L3.state`);
    const D = `ctx.cameras.debug`;
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const setCoins = n => t.L(`import("./js/core/save.js").then(m => { const c = m.wallet.coins; if (c > ${n}) m.wallet.spend(c - ${n}); else m.wallet.add(${n} - c); return m.wallet.coins; })`);
    const playing = async () => { if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); } if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); } };
    // a new device day + one tick (City Hall's played-day clock, as its own test does it)
    let dayOff = 0;
    const newDay = async n => { for (let i = 0; i < n; i++) { await g(`(ctx.realestate.debug.CLOCK.offset = ${++dayOff}, ctx.cityhall.tax.tick(), true)`); await t.frames(2); } };
    const tickets = () => g(`ctx.cameras.tickets().map(x => ({ id: x.id, stage: x.stage, owed: x.owed, unread: x.unread, kind: x.kind, mph: x.mph, photo: (x.photo || "").length }))`);
    /** A point in camera i's zone, on its street (the car stays put: a teleport onto a parked cruiser is RAMMING A POLICE CRUISER). */
    const atCam = i => g(`(() => { const c = ${D}.CM.cams[${i}], T = ctx.town; let p;
      if (c.kind === "pkwy") p = T.plan.world(c.st.c + 2, c.lz, {}); else p = ctx.world.road.point(c.s0, 0, {});
      window.__camPt = [p.x, p.z]; return true; })()`);
    const fire = (i, mph) => g(`(() => { const [x, z] = window.__camPt; const t = ${D}.check(${D}.CM.cams[${i}], ${mph}, x, z); return t ? { id: t.id, photo: t.photo.length, mph: t.mph } : null; })()`);
    const away = i => g(`(() => { const c = ${D}.CM.cams[${i}]; return ${D}.check(c, 0, c.x + 200, c.z + 200), c.armed; })()`);
    const resetDay = () => g(`(${D}.S.n = 0, ${D}.S.day = "", true)`);

    // ▶ PLAY: her day starts at home, on foot, in Midwood (the family house + its mailbox are in THIS Midwood)
    await t.click(/PLAY/);
    if (!await t.until(`__lulu3d.state === "footRun" || __lulu3d.state === "playing"`, "PLAY: at home")) return;
    await playing();
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    await W.install(t);
    if (!await g(`ctx.town.active && ctx.town.id === "midwood"`)) {
      await g(`(ctx.town.load("midwood"), true)`);
      if (!await t.until(`__lulu3d.ctx.town.loaded("midwood")`, "Midwood's models load", 90000)) return;
      await g(`ctx.town.enter({ town: "midwood", speed: 0 })`);
      if (!await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "midwood"`, "into Midwood", 8000)) return;
    }
    await t.until(`__lulu3d.ctx.cameras.cams.length > 0`, "the cameras stand", 8000);
    await g(`(ctx.law.hold(9999), ${D}.CM.force.manual = true, true)`);
    await t.L(`import("./js/core/ctx.js").then(m => { window.__chases = []; m.on("cop:chase", e => __chases.push(e && e.reason)); return true; })`);
    // the ledger's clock: today is the first played day
    await g(`(() => { const L = ctx.cityhall.tax.ledger; L.day = null; L.played = 0; ctx.realestate.debug.CLOCK.offset = 0; ctx.cityhall.tax.tick(); return true; })()`);
    await t.frames(10); await W.reset(t);

    // ════ the poles ════
    let PK = [], SC = [];
    await step("poles", async () => {
      const cams = await g(`ctx.cameras.cams`);
      PK = cams.map((c, i) => c.kind === "pkwy" ? i : -1).filter(i => i >= 0);
      SC = cams.map((c, i) => c.kind === "school" ? i : -1).filter(i => i >= 0);
      t.check(`Ocean Parkway has its 2 camera poles (limit 25, fires above 35)`, PK.length === 2 && PK.every(i => cams[i].limit === 25 && cams[i].trigger === 35), JSON.stringify(cams));
      t.check(`Midwood's school block has its camera (limit 15, fires above 25)`, SC.length >= 1 && SC.every(i => cams[i].limit === 15 && cams[i].trigger === 25));
      const onWalk = await g(`${D}.CM.cams.filter(c => c.kind === "pkwy").every(c => { const L = ctx.town.plan.local(c.x, c.z, {}); const d = Math.abs(L.x - c.st.c); return d > c.st.outer && d < c.st.walk; })`);
      t.check("the parkway poles stand on the sidewalk (not in a lane)", onWalk);
      const meshes = await g(`${D}.CM.cams.reduce((a, c) => { let n = 0; c.group.traverse(o => { if (o.isMesh) n++; }); return a + n; }, 0)`);
      t.check(`a few meshes per pole (${meshes} for ${PK.length + SC.length})`, meshes <= (PK.length + SC.length) * 3);
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__camWrap) { const o = r.render.bind(r); window.__camWrap = true; r.render = (s, c) => { const V = window.__camAt; if (V && c === __lulu3d.ctx.camera) { c.position.set(V[0], V[1], V[2]); c.lookAt(V[3], V[4], V[5]); c.updateMatrixWorld(); } o(s, c); }; } return true; })()`);
      const view = async (i, name) => { await g(`(() => { const c = ${D}.CM.cams[${i}], L = ctx.town.plan.local(c.x, c.z, {}), k = c.kind === "pkwy" ? Math.sign(c.st.c - L.x) : 1; const w = c.kind === "pkwy" ? ctx.town.plan.world(c.st.c, c.lz - 12, {}) : { x: c.x + 8, z: c.z + 8 }; window.__camAt = [w.x, 3.4, w.z, c.x, 2.6, c.z]; return true; })()`); await t.frames(3); await t.shot(name); };
      await view(PK[0], "cameras-pole-pkwy");
      if (SC.length) await view(SC[0], "cameras-pole-school");
      await t.L(`(window.__camAt = null, true)`); await t.frames(3); await W.reset(t);
    });

    // ════ the flash: only above 35 on the parkway, once per pass, a real picture ════
    await step("parkway", async () => {
      await resetDay();
      await atCam(PK[0]); await t.frames(4);
      t.check("in the parkway camera's zone", await g(`${D}.inZone(${D}.CM.cams[${PK[0]}], window.__camPt[0], window.__camPt[1])`));
      t.check("30 mph on the parkway (over 25, not over 35): no flash", (await fire(PK[0], 30)) === null);
      const a = await fire(PK[0], 41);
      t.check("41 mph: FLASH — a ticket with a picture", !!a && a.mph === 41 && a.photo > 1500, JSON.stringify(a));
      t.check("the white flash showed", await t.L(`(() => { const e = document.getElementById("camFlash"); return !!e; })()`));
      t.check("same pass at 50: no second ticket", (await fire(PK[0], 50)) === null);
      t.check("driving on past it re-arms the camera", await away(PK[0]));
      const shot = await g(`ctx.cameras.tickets().slice(-1)[0].photo`);
      t.check("the picture is a JPEG", /^data:image\/jpeg/.test(shot || ""));
    });

    // ════ the school block: only in school hours ════
    await step("school", async () => {
      if (!SC.length) return;
      await atCam(SC[0]); await t.frames(4);
      t.check("on the school block", await g(`${D}.inZone(${D}.CM.cams[${SC[0]}], window.__camPt[0], window.__camPt[1])`));
      await g(`(${D}.CM.force.school = false, true)`);
      t.check("after school hours: 40 mph → nothing", (await fire(SC[0], 40)) === null);
      await g(`(${D}.CM.force.school = true, true)`); await t.frames(30);
      t.check("in school hours the beacon flashes", await g(`${D}.CM.cams.filter(c => c.beacon).length > 0`));
      t.check("in school hours: 22 mph (over 15, not over 25) → nothing", (await fire(SC[0], 22)) === null);
      const why = await t.L(`JSON.stringify(window.__chases || [])`);
      if (await g(`ctx.law.chasing`)) { await g(`(ctx.law.standDown("test"), true)`); await t.frames(3); }
      const b = await fire(SC[0], 31);
      t.check("in school hours: 31 mph → FLASH (fine 60)", !!b && b.photo > 1500, `chases so far: ${why}`);
      await away(SC[0]);
    });

    // ════ caps: 3 a real day; never in a chase ════
    await step("caps", async () => {
      const n0 = (await tickets()).length;
      await atCam(PK[1]); await t.frames(3);
      const c = await fire(PK[1], 44); await away(PK[1]);
      t.check("the 3rd flash today still tickets", !!c);
      await atCam(PK[1]); await t.frames(3);
      t.check("the 4th today: the flash is capped (no ticket)", (await fire(PK[1], 60)) === null && (await tickets()).length === n0 + 1);
      await away(PK[1]); await resetDay();
      await atCam(PK[1]); await t.frames(3);
      await g(`(ctx.law.startChase("RECKLESS DRIVING", { msg: "test" }), true)`); await t.frames(3);
      t.check("in a chase the camera doesn't ticket (the cops already have her)", (await g(`ctx.law.chasing`)) && (await fire(PK[1], 70)) === null);
      await g(`(ctx.law.standDown("test"), true)`); await t.frames(3); await away(PK[1]);
      await resetDay();
    });

    // ════ the mail: 2 played days later ════
    let T1 = null;
    await step("mail", async () => {
      const list = await tickets();
      T1 = list[0];
      t.check("nothing's in the mail on the day of the flash", list.every(x => x.stage === "new" && !x.unread));
      await newDay(1);
      t.check("1 played day later: still nothing", (await tickets()).every(x => x.stage === "new"));
      await newDay(1); await t.frames(6);
      const l2 = await tickets();
      t.check("2 played days later: the notices are mailed (unread), each a line on City Hall's ledger", l2.every(x => x.stage === "mailed" && x.unread && x.owed > 0), JSON.stringify(l2));
      t.check("the parkway fine is 40, the school one 60", l2.find(x => x.kind === "pkwy").owed === 40 && (!SC.length || l2.find(x => x.kind === "school").owed === 60));
      t.check("one 📬 line in Messages (a `need` one)", await g(`ctx.phone.inbox.msgs.some(m => /Borough of Midwood/.test(m.from || "") || /mailbox/i.test(m.msg || ""))`));
      await t.frames(10);
      const chip = await t.L(`(document.querySelector(".cam-chip") || {}).textContent || ""`);
      t.check(`the objective line's lowest slot: "📬 You have mail"`, /You have mail/.test(chip), chip);
      const ob = await t.L(`__lulu3d.H && __lulu3d.H.objectives ? JSON.stringify(__lulu3d.H.objectives()) : ""`);
      t.check("it's an objective (info priority)", /cammail/.test(ob) || !ob, ob);
      const mb = await g(`(() => { const m = ctx.cameras.mailbox(), L = ctx.home.lot; return m && L ? { d: +Math.hypot(m.x - L.x, m.z - L.z).toFixed(1), town: m.town } : m; })()`);
      t.check(`the mailbox is at her home (the family lot, ${mb && mb.d} m)`, !!mb && mb.town === "midwood" && mb.d < 20, JSON.stringify(mb));
    });

    // ════ the ✋ mailbox → the notice card with the photo ════
    await step("mailbox", async () => {
      // her day starts at her OWN house here ("🏠 Start my day here"): the notices go to its mailbox, by the front door
      await g(`(() => { const sp = ctx.town.spot("school"); const x = sp.x + sp.ux * 20 + sp.nx * 1.5, z = sp.z + sp.uz * 20 + sp.nz * 1.5; ctx.home.setStartAt({ town: "midwood", key: "test", door: { x, z }, face: 0, label: "test" }); return true; })()`);
      const own = await g(`(() => { const m = ctx.cameras.mailbox(), sa = ctx.home.startAt; return !!m && m.own && Math.hypot(m.x - sa.door.x, m.z - sa.door.z) < 0.1; })()`);
      t.check("a day that starts at her own house: the mail goes to that house", own);
      await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 8000);
      await g(`(() => { const m = ctx.cameras.mailbox(), F = ctx.foot.debug.F; F.pos.x = m.x; F.pos.z = m.z; F.vel.set(0, 0, 0); F.lulu.obj.position.set(F.pos.x, 0, F.pos.z); if (window.__qa) { window.__qa.cutF = ctx.frames + 6; window.__qa.last = null; } return true; })()`);
      await t.frames(10); await W.reset(t);
      const p = await t.L(`((document.querySelector("#slot-bottom .prompt") || {}).textContent || "") + " | " + ((document.getElementById("tx_foot_hand") || {}).textContent || "")`);
      t.check(`✋ at the mailbox: "${p.trim()}"`, /MAIL/i.test(p));
      await g(`(ctx.cameras.read(), true)`); await t.frames(6);
      const card = await t.L(`(() => { const c = document.querySelector(".cam-notice"); return c ? { imgs: c.querySelectorAll("img").length, txt: c.textContent.slice(0, 300) } : null; })()`);
      t.check("the notice card: the photo(s), the speed, the fine", !!card && card.imgs >= 1 && /mph/.test(card.txt) && /Fine/.test(card.txt), JSON.stringify(card));
      await t.shot("cameras-notice");
      await t.L(`(() => { const b = [...document.querySelectorAll("#screen button, .screen button")].find(b => /Got it/.test(b.textContent)); if (b) b.click(); return !!b; })()`);
      await t.frames(10);
      t.check("read → the mail chip's gone", !(await t.L(`(() => { const c = document.querySelector(".cam-chip"); return !!c && !c.classList.contains("hidden") && /mail/.test(c.textContent); })()`)) && (await g(`ctx.cameras.unread()`)) === 0);
      await W.pause(t);                                        // (the test ends the walk itself: a declared cut)
      await g(`(ctx.home.setStartAt(null), ctx.foot.end("test"), true)`); await t.frames(3); await playing(); await t.frames(20);
      await W.pause(t, true);
    });

    // ════ pay at City Hall → closed ════
    await step("pay", async () => {
      await setCoins(500);
      const c0 = await coins(), owed = (await tickets()).reduce((a, x) => a + x.owed, 0);
      const n = await g(`ctx.cityhall.tax.payNow("test")`); await t.frames(3);
      const l = await tickets();
      t.check(`paid ${n} at City Hall (the tickets: ${owed}) → every ticket closed`, n >= owed && l.every(x => x.stage === "paid"), JSON.stringify(l));
      t.check("coins down by exactly what was paid", (await coins()) === c0 - n);
    });

    // ════ unpaid → late → summons → Courtroom 2B (dismissed / upheld) ════
    await step("ladder", async () => {
      await resetDay();
      await atCam(PK[0]); await t.frames(3); await fire(PK[0], 45); await away(PK[0]);
      await atCam(PK[1]); await t.frames(3); await fire(PK[1], 45); await away(PK[1]);
      const ids = (await tickets()).filter(x => x.stage === "new").map(x => x.id);
      await newDay(2);
      t.check("mailed", (await tickets()).filter(x => ids.includes(x.id)).every(x => x.stage === "mailed" && x.owed === 40));
      await newDay(3);
      const late = (await tickets()).filter(x => ids.includes(x.id));
      t.check("unpaid by the due day: a late fee (+20) and a second notice", late.every(x => x.stage === "late" && x.owed === 60 && x.unread), JSON.stringify(late));
      await newDay(3);
      const sm = (await tickets()).filter(x => ids.includes(x.id));
      t.check("ignored: a SUMMONS", sm.every(x => x.stage === "summons"));
      const cases = await g(`${JSON.stringify(ids)}.map(id => { const c = ctx.civic.courts.caseById("cameras:" + id); return c ? c.town + ":" + (c.available ? c.available() : true) : null; })`);
      t.check("…a case waits in Midwood's Courtroom 2B for each", cases.every(c => c === "midwood:true"), JSON.stringify(cases));
      const r1 = await g(`${D}.rule(${ids[0]}, true)`);
      t.check("dismissed → its bills waived, nothing paid", r1.dismissed && (await tickets()).find(x => x.id === ids[0]).stage === "dismissed" && (await tickets()).find(x => x.id === ids[0]).owed === 0);
      await setCoins(25);
      const r2 = await g(`${D}.rule(${ids[1]}, false)`);
      t.check(`upheld with 25 coins: she pays what she has (${r2.n}), never below 0`, r2.n === 25 && (await coins()) === 0 && (await tickets()).find(x => x.id === ids[1]).owed === 35, JSON.stringify(r2));
      await setCoins(500);
      await g(`ctx.cityhall.tax.payNow("test")`); await t.frames(3);
    });

    // ════ 3 unpaid at once → a bench warrant on law's file → the arrest serves it ════
    await step("warrant", async () => {
      await resetDay();
      for (const i of [PK[0], PK[1], PK[0]]) { await atCam(i); await t.frames(3); await fire(i, 50); await away(i); }
      await newDay(2);
      t.check("3 notices that just arrived aren't a warrant yet", !(await g(`ctx.cameras.warrant`)));
      await newDay(3);
      t.check("3 unpaid tickets → a bench warrant", await g(`ctx.cameras.warrant`));
      t.check("…on law's own warrant file (cops who see her give chase)", (await g(`ctx.law.warrants`)).includes("UNPAID SPEED CAMERA TICKETS"));
      await t.L(`import("./js/core/ctx.js").then(m => m.emit("law:arrest", { charges: ["UNPAID SPEED CAMERA TICKETS"], town: "midwood" }))`);
      await t.frames(3);
      t.check("arrested → the warrant's served, those tickets closed", !(await g(`ctx.cameras.warrant`)) && (await tickets()).every(x => ["paid", "dismissed", "served"].includes(x.stage)));
      t.check("the charge has its own court lines", await g(`!!ctx.law.chargeEvent(["UNPAID SPEED CAMERA TICKETS"])`));
    });

    W.check(t, "cameras", await W.report(t));
  },
};
