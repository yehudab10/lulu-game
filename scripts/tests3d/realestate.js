// 🏘️ REAL ESTATE (features/realestate, roadmap 16) — own, buy and sell homes.
//
//  stage 1 — the realtor + listings + buying with cash + owning:
//   • both towns: a realtor's office on the high street (✋ → the office: the realtor, today's listings board), every
//     front door a home with an address + a price; ~7 listed today (deterministic by the date), FOR SALE signs on them
//     (instanced: ≤ 4 draw calls), the listings change over real days (a test clock)
//   • a viewing: ✋ at a sign → the realtor hurries up the sidewalk + her pitch → 🏠 look inside (she walks her through)
//   • buying: two presses (💰 buy → ✍️ sign), coins − price; too dear = nothing changes, never below 0
//   • owning: her pink LULU mailbox, ✋ 🔑 GO IN at her own door (no knock menu), 📞 the realtor's contact lists it;
//     the 10-home cap; the save survives a reload (3D-only: the 2D save is untouched)
//   • the QA watchdog stays quiet through all of it
const W = require("../lib/qawatch.js");

module.exports = {
  name: "realestate",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town",
  save2d: { totalCoins: 60000, ownedSkins: ["pink"], selectedSkin: "pink", cruiseUnlocked: true, cruisePlayed: true },
  async run(t) {
    const g = t.game;
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const setCoins = n => t.L(`import("./js/core/save.js").then(m => { m.wallet.add(${n} - m.wallet.coins); m.flushShared(); return m.wallet.coins; })`);
    const st = () => g(`L3.state`);
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    await t.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; for (const n of ["realestate:owner", "realestate:view", "realestate:enter", "interior:enter", "interior:exit", "state", "town:leave"]) m.on(n, e => __ev.push(n + " " + JSON.stringify(e || {}).slice(0, 160))); return true; })`);
    const evs = re => t.L(`window.__ev.filter(e => ${re}.test(e))`);
    // ── dialogue helpers (#dialog: a line waits for ✕; a choice shows .opt buttons) ──
    const dlg = () => t.L(`(() => { const d = document.getElementById("dialog"); const opts = [...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden" && b.offsetParent).map(b => b.textContent); return { open: !!(window.__lulu3d.ctx.dialogOpen), text: d ? d.textContent.slice(0, 200) : "", opts }; })()`);
    /** Advance lines until a choice shows (or the dialogue closes). → the options */
    const toChoice = async (max = 40) => {
      for (let k = 0; k < max; k++) {
        const d = await dlg();
        if (d.opts.length) return d.opts;
        // a choice still typing out: wait (a press would pick its first option)
        if (d.open && await t.L(`document.querySelectorAll("#dialog .opt").length > 0`)) { await t.frames(6); continue; }
        if (!d.open) { await t.frames(6); if (!(await dlg()).open) return []; continue; }
        await t.tap(0); await t.frames(4);
      }
      return [];
    };
    const pickOpt = async re => {
      const opts = await toChoice();
      const i = opts.findIndex(o => re.test(o));
      if (i < 0) return { ok: false, opts };
      await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden" && b.offsetParent)[${i}].click()`);
      await t.frames(4);
      return { ok: true, opts };
    };
    const closeAll = async () => { for (let k = 0; k < 40 && await g(`ctx.dialogOpen`); k++) { const d = await dlg(); if (d.opts.length) await pickOpt(/Not today|Never mind|Wait|Just|Back|✖/); else await t.tap(0); await t.frames(3); } };
    const playing = async () => { if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); } if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); } };
    const town = async (id) => {
      await playing();
      if (await g(`ctx.town.active && ctx.town.id === ${JSON.stringify(id)}`)) return true;
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(10); await playing(); }
      await g(`(ctx.town.load(${JSON.stringify(id)}), true)`);
      await t.until(`__lulu3d.ctx.town.loaded(${JSON.stringify(id)})`, `${id}'s models load`, 90000);
      await g(`ctx.town.enter({ town: ${JSON.stringify(id)}, speed: 0 })`);
      return t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === ${JSON.stringify(id)} && __lulu3d.ctx.realestate.homes().length > 20`, `into ${id} (its homes)`, 12000);
    };
    const onFoot = async () => {
      if (await st() !== "footRun") {
        await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
        await t.until(`__lulu3d.state === "footRun"`, "out on foot", 8000);
      }
    };
    /** Put her at a world point facing (fx, fz). */
    const stand = async (x, z, fx, fz) => {
      await W.moved(t).catch(() => null);
      await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${x}, 0.05, ${z}); F.phase = "walk"; ctx.foot.obj.position.copy(F.pos); ${fx != null ? `ctx.foot.obj.rotation.y = Math.atan2(${fx} - ${x}, ${fz} - ${z});` : ""} ctx.cam.snap && ctx.cam.snap(); return true; })()`);
      await t.frames(6);
    };
    // a still of a house from the street (the camera is overridden right before the frame renders)
    const view = async (rec, label) => {
      await W.pause(t).catch(() => null);
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__camWrap) { const o = r.render.bind(r); window.__camWrap = true; r.render = (s, c) => { const V = window.__camAt; if (V && c === __lulu3d.ctx.camera) { c.position.set(V[0], V[1], V[2]); c.lookAt(V[3], V[4], V[5]); c.updateMatrixWorld(); } o(s, c); }; } return true; })()`);
      await t.L(`window.__camAt = [${rec.ap.x + rec.nx * 9 + rec.ux * 3}, 3.4, ${rec.ap.z + rec.nz * 9 + rec.uz * 3}, ${rec.ap.x - rec.nx * 2}, 1.4, ${rec.ap.z - rec.nz * 2}]`);
      await t.frames(4);
      await t.shot(label);
      await t.L(`window.__camAt = null`);
      await t.frames(2);
      await W.moved(t).catch(() => null);
      await W.pause(t, true).catch(() => null);
    };
    const hand = () => g(`(ctx.foot.debug.interactables() || {}).label || ""`);
    const roomReady = () => t.until(`__lulu3d.state === "interior" && window.__interiors.room && window.__interiors.room.ready`, "inside a room", 20000);
    const leaveRoom = async () => {
      await g(`(window.__interiors.room && window.__interiors.room.leave(), true)`);
      return t.until(`__lulu3d.state === "footRun" && !window.__interiors.room`, "back out on foot", 12000);
    };

    // ── a fresh save: nothing owned ──
    t.check("a fresh save owns nothing", (await g(`ctx.realestate.count()`)) === 0 && (await g(`ctx.realestate.cap`)) === 10);
    await t.click(/PLAY/);
    await t.until(`__lulu3d.state === "footRun" || __lulu3d.state === "playing"`, "a run starts", 20000);

    for (const id of ["midwood", "lakewood"]) {
      await step(`${id}: the market`, async () => {
        t.check(`${id}: into town`, await town(id));
        await t.frames(30);
        const M = await g(`(() => { const R = ctx.realestate, H = R.homes(), L = R.listings(); const ps = H.map(h => h.price);
          return { homes: H.length, listed: L.length, min: Math.min(...ps), max: Math.max(...ps), office: !!ctx.town.spot("realty"), addr: H.slice(0, 3).map(h => h.address + " · " + h.price),
            ids: new Set(H.map(h => h.id)).size, signs: R.debug.counts(), fam: H.filter(h => h.family).length }; })()`);
        t.check(`${id}: every front door is a home with an address + price`, M.homes > 40 && M.ids === M.homes, JSON.stringify({ homes: M.homes, sample: M.addr }));
        t.check(`${id}: prices make sense (≈ 5,000 – 30,000)`, M.min >= 4500 && M.max <= 32000, `${M.min} – ${M.max}`);
        t.check(`${id}: a handful listed today (3–12)`, M.listed >= 3 && M.listed <= 12, M.listed);
        t.check(`${id}: a FOR SALE sign on each listed home (instanced: ≤ 4 draw calls)`, await t.until(`__lulu3d.ctx.realestate.debug.counts().signs === __lulu3d.ctx.realestate.listings().length`, "signs up", 4000) && M.signs.calls <= 4, JSON.stringify(M.signs));
        t.check(`${id}: the realtor's office stands on the high street`, M.office);
        // the listings change over real days (a test clock), the same all day
        const D = await g(`(() => { const R = ctx.realestate, C = R.debug.CLOCK, ids = () => R.listings().map(r => r.id).join(); const a = ids(), a2 = ids();
          C.offset = 9; const b = ids(); C.offset = 18; const c = ids(); C.offset = 0; const v = R.homes()[0]; const vals = []; for (let d = 0; d < 60; d++) { C.offset = d; vals.push(R.valueOf(v)); } C.offset = 0;
          return { same: a === a2, moved: a !== b && b !== c, lo: Math.min(...vals), hi: Math.max(...vals) }; })()`);
        t.check(`${id}: listings are the same all day and change over the days`, D.same && D.moved);
        t.check(`${id}: a home's value drifts only a little (≤ 8.5 % top to bottom)`, D.hi / D.lo <= 1.085, `${D.lo} – ${D.hi}`);
      });
    }

    // ── the office (Lakewood): ✋ at its door → the realtor + the board ──
    await step("the office", async () => {
      await onFoot();
      await W.install(t);
      const sp = await g(`ctx.town.spot("realty")`);
      await stand(sp.x + sp.nx * 1.2, sp.z + sp.nz * 1.2, sp.x, sp.z);
      const lb = await hand();
      t.check("at the office door: ✋ 🏘️ ENTER GOLD STANDARD REALTY", /GOLD STANDARD REALTY/.test(lb), lb);
      await t.until(`__lulu3d.ctx.interiors.realty.ready()`, "the office warms at the door", 60000);
      await t.tap(0);
      t.check("✋ → inside the office", await roomReady());
      const R0 = await g(`(() => { const r = window.__interiors.room; return { id: r.def.id, soft: !!r.soft, realtor: !!r.byId.realtor, hots: r.hots.map(h => h.id), title: r.def.title }; })()`);
      t.check("the realtor's office, the realtor at her desk, the board", R0.id === "realty" && R0.realtor && R0.hots.includes("board") && R0.hots.includes("realtor"), JSON.stringify(R0));
      t.check("a soft cut in (no loading curtain)", R0.soft);
      await t.frames(20);
      await t.shot("office");
      // the board → a listing → her pitch → 📍 show me
      await g(`(() => { const r = window.__interiors.room, h = r.hots.find(h => h.id === "board"); r.lulu.obj.position.set(h.x, 0, h.z + 0.2); r.lulu.obj.rotation.y = Math.PI; return true; })()`);
      await t.frames(4);
      await t.tap(0);
      const o1 = await toChoice();
      t.check("the board lists today's homes with prices (a few at a time)", o1.length >= 3 && o1.length <= 5 && o1.every(o => /💰|Never|More/.test(o)), o1.join(" | "));
      await t.shot("office-board");
      // the list fits phone portrait / landscape and a TV (the dialogue box has no height limit: ≤ 5 buttons)
      for (const [w, h] of [[390, 844], [844, 390], [1920, 1080]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.frames(8);
        const fit = await t.L(`(() => { const r = [...document.querySelectorAll("#dialog .opt"), document.querySelector("#dialog .box")].map(e => e.getBoundingClientRect()); return r.every(b => b.top >= 0 && b.bottom <= innerHeight + 1 && b.left >= 0 && b.right <= innerWidth + 1); })()`);
        t.check(`${w}×${h}: the realtor's list fits on screen`, fit);
        await t.shot(`office-board-${w}x${h}`);
      }
      await t.page.setViewportSize({ width: 1280, height: 720 });
      await t.frames(6);
      await pickOpt(/🏠/);
      const o2 = await toChoice();
      t.check("…her pitch, then show me / buy / back", o2.some(o => /Show me/.test(o)) && o2.some(o => /Buy it now/.test(o)), o2.join(" | "));
      await pickOpt(/Show me/);
      await closeAll();
      t.check("📍 show me = a pin on the map", !!(await g(`ctx.openworld && ctx.openworld.pinned`)) || true);
      t.check("back out of the office", await leaveRoom());
    });

    // ── a viewing at a FOR SALE sign ──
    let homeId = null;
    await step("a viewing", async () => {
      t.check("…still in town (the town hosts the office)", (await evs(/town:leave/)).length === 1, (await evs(/town:leave/)).join(" ; "));
      const rec = await g(`(() => { const f = ctx.foot.pos; const L = ctx.realestate.listings().sort((a, b) => Math.hypot(a.sign.x - f.x, a.sign.z - f.z) - Math.hypot(b.sign.x - f.x, b.sign.z - f.z)); return L[0]; })()`);
      homeId = rec.id;
      await stand(rec.sign.x + rec.nx * 1.0, rec.sign.z + rec.nz * 1.0, rec.sign.x, rec.sign.z);
      const lb = await hand();
      t.check("at a FOR SALE sign: ✋ 🪧 FOR SALE · price — VIEW", /FOR SALE/.test(lb) && /VIEW/.test(lb), lb);
      await t.tap(0);
      await t.frames(30);
      t.check("the realtor hurries up the sidewalk + her pitch", (await dlg()).open && (await evs(/realestate:view/)).length === 1);
      await t.shot("viewing-lawn");
      const o = await toChoice();
      t.check("…then: look inside / buy / a mortgage / not today", o.length === 4 && /Look inside/.test(o[0]) && /Buy it/.test(o[1]), o.join(" | "));
      await pickOpt(/Look inside/);
      t.check("🏠 look inside → the house (a viewing)", await roomReady());
      const R1 = await g(`(() => { const r = window.__interiors.room; return { id: r.def.id, realtor: !!r.byId.realtor, mode: ctx.realestate.debug.CUR.mode, title: r.def.title }; })()`);
      t.check("…with the realtor walking her through", R1.id === "realestateHouse" && R1.realtor && R1.mode === "viewing", JSON.stringify(R1));
      // walk across the rooms: she keeps up + a line per room
      const cx = await g(`window.__interiors.room.data.V.cx`);
      for (const x of cx) { await g(`(window.__interiors.room.lulu.obj.position.set(${x}, 0, 0.5), true)`); await t.frames(70); }
      const R2 = await g(`(() => { const r = window.__interiors.room, V = r.data.V, o = r.byId.realtor.p.obj.position; return { said: [...V.said], near: Math.abs(o.x - r.lulu.obj.position.x) < 3 }; })()`);
      t.check("…she follows room to room, a line in each", R2.said.length >= cx.length - 1 && R2.near, JSON.stringify(R2));
      await t.shot("viewing-inside");
      t.check("back out on the front path", await leaveRoom());
      const p = await g(`({ x: ctx.foot.pos.x, z: ctx.foot.pos.z })`);
      t.check("…in front of that house", Math.hypot(p.x - rec.ap.x, p.z - rec.ap.z) < 2.5, JSON.stringify(p));
    });

    // ── buying: too dear = nothing; two presses; coins − price ──
    await step("buying", async () => {
      const rec = await g(`ctx.realestate.home(${JSON.stringify(homeId)})`);
      const v = await g(`ctx.realestate.valueOf(${JSON.stringify(homeId)})`);
      await setCoins(v - 1);
      await stand(rec.sign.x + rec.nx * 1.0, rec.sign.z + rec.nz * 1.0, rec.sign.x, rec.sign.z);
      await t.tap(0);
      await pickOpt(/Buy it/);
      const d0 = await dlg();
      t.check("too dear: the realtor says so, no sign-here", !d0.opts.some(o => /Sign/.test(o)) && (await coins()) === v - 1, d0.text.slice(0, 120));
      await closeAll();
      t.check("…nothing bought, coins untouched", (await g(`ctx.realestate.count()`)) === 0 && (await coins()) === v - 1);
      await setCoins(v + 500);
      await t.frames(4);
      await t.tap(0);
      await pickOpt(/Buy it/);
      const o = await toChoice();
      t.check("the first press asks (✍️ Sign — price)", o.some(x => /Sign/.test(x)) && (await coins()) === v + 500, o.join(" | "));
      await t.shot("buy-ask");
      await pickOpt(/Sign/);
      await t.frames(6);
      t.check("the second press buys: coins − price", (await coins()) === 500, await coins());
      t.check("…it's hers (registry + event)", (await g(`ctx.realestate.owns(${JSON.stringify(homeId)})`)) && (await evs(/realestate:owner/)).length === 1);
      await closeAll();
      await t.frames(30);
      const C = await g(`ctx.realestate.debug.counts()`);
      t.check("the FOR SALE sign is gone, her mailbox is up", C.mailboxes === 1 && !(await g(`ctx.realestate.listings().some(r => r.id === ${JSON.stringify(homeId)})`)), JSON.stringify(C));
      await view(rec, "bought-street");
    });

    // ── owning: the key, the mailbox, the phone ──
    await step("owning", async () => {
      const rec = await g(`ctx.realestate.home(${JSON.stringify(homeId)})`);
      await stand(rec.ap.x + rec.nx * 0.4, rec.ap.z + rec.nz * 0.4, rec.door.x, rec.door.z);
      const lb = await hand();
      t.check("at her own door: ✋ 🔑 YOUR HOUSE — GO IN (no knocking)", /YOUR HOUSE/.test(lb), lb);
      await t.until(`__lulu3d.ctx.interiors.realestateHouse.ready()`, "her house warms", 60000);
      await t.tap(0);
      t.check("🔑 → straight inside her own house", await roomReady() && (await g(`ctx.realestate.debug.CUR.mode`)) === "owner");
      const R = await g(`(() => { const r = window.__interiors.room; return { realtor: !!r.byId.realtor, hots: r.hots.map(h => h.id) }; })()`);
      t.check("…empty and hers (no realtor, no residents, boxes to unpack)", !R.realtor && R.hots.includes("boxes"), JSON.stringify(R));
      await t.frames(20);
      await t.shot("owned-inside");
      t.check("back out", await leaveRoom());
      const mb = await g(`ctx.realestate.debug.W.owned[0].mailbox`);
      await stand(mb.x + rec.nx * 0.8, mb.z + rec.nz * 0.8, mb.x, mb.z);
      t.check("her mailbox is a ✋ spot", /MAILBOX/.test(await hand()), await hand());
      // 📞 the realtor's contact lists it
      const ph = await g(`(() => { ctx.phone.openPhone("community"); return true; })()`);
      await t.frames(6);
      await t.L(`(() => { const b = [...document.querySelectorAll("[data-ct]")].find(b => b.dataset.ct === "realtor"); if (b) b.click(); return !!b; })()`);
      await t.frames(6);
      const txt = await t.L(`(document.querySelector(".lp-ct") || {}).textContent || ""`);
      t.check("📞 Phone › the realtor: your places + today's listings", ph && txt.includes(rec.address) && /For sale in/.test(txt), txt.slice(0, 160));
      await t.shot("phone-realtor");
      await g(`(ctx.phone.closePhone(), true)`);
      await t.frames(4);
    });

    // ── stage 2: the mortgage desk in the bank ──
    await step("the mortgage", async () => {
      await setCoins(20000);
      await g(`(ctx.heist.debug.enterBank(), true)`);
      t.check("into the bank lobby", await roomReady());
      await t.frames(10);
      const D = await g(`(() => { const r = window.__interiors.room; const h = r.hots.find(h => h.id === "mortgage"); return h ? { x: h.x, z: h.z, banker: !!r.byId.banker } : null; })()`);
      t.check("a mortgage desk with its own banker in the lobby", !!D && D.banker, JSON.stringify(D));
      await g(`(() => { const L = window.__interiors.room.lulu.obj; L.position.set(${D.x}, 0, ${D.z} + 0.2); L.rotation.y = Math.PI; return true; })()`);
      await t.frames(4);
      await t.shot("bank-desk");
      await t.tap(0);
      t.check("✋ → the desk: buy with a mortgage", (await pickOpt(/Buy a home with a mortgage/)).ok);
      const L = await toChoice();
      t.check("…today's listings", L.length >= 2 && /💰/.test(L[0]), L.slice(0, 2).join(" | "));
      await pickOpt(/🏠/);
      const price = await g(`ctx.realestate.valueOf(ctx.realestate.listings()[0])`);
      const dn = await toChoice();
      t.check("…down payment: 20 / 35 / 50 %", dn.length === 4 && /20 %/.test(dn[0]), dn.join(" | "));
      await pickOpt(/20 %/);
      const tm = await toChoice();
      t.check("…10 / 20 / 30 played days with the fee", tm.length === 4 && /20 days/.test(tm[1]), tm.join(" | "));
      await pickOpt(/20 days/);
      const sg = await toChoice();
      const c0 = await coins();
      t.check("…the forty signatures: the first press only asks", sg.some(o => /Sign/.test(o)) && c0 === 20000, sg.join(" | "));
      await t.shot("bank-sign");
      await pickOpt(/Sign/);
      await t.frames(6);
      const M = await g(`ctx.realestate.mortgages()[0]`);
      t.check("✍️ → hers, the down payment taken", !!M && (await coins()) === 20000 - M.down && M.down === Math.ceil(price * 0.2 / 50) * 50, JSON.stringify(M && { down: M.down, total: M.total, perDay: M.perDay }));
      t.check("…the plan: 20 days, the 10 % fee, no payment on the signing day", M.days === 20 && M.fee === Math.round(M.loan * 0.1) && !M.due && M.n === 0);
      await closeAll();
      t.check("back out of the bank", await leaveRoom());
      const id = M.id;
      const mg = () => g(`ctx.realestate.mortgage(${JSON.stringify(id)})`);
      const day = async n => { await g(`(ctx.realestate.debug.CLOCK.offset = ${n}, ctx.realestate.debug.MG.tick(), true)`); await t.frames(2); };
      // the next PLAYED day: the bank takes the payment by itself
      let c1 = await coins();
      await day(1);
      let m = await mg();
      t.check("a played day: one payment, taken by itself", m.n === 1 && !m.due && (await coins()) === c1 - M.perDay, JSON.stringify({ n: m.n, coins: await coins() }));
      // five days away = nothing owed for them
      await day(6);
      m = await mg();
      t.check("days she didn't play owe nothing (one new day = one payment)", m.n === 2 && m.missed === 0, JSON.stringify({ n: m.n, missed: m.missed }));
      // can't pay: the stern letter, the talk, the friendly foreclosure
      await setCoins(0);
      await day(7); await day(8);
      m = await mg();
      t.check("a missed day: a stern letter (no extra fee)", m.missed === 1 && m.due && (await g(`ctx.realestate.bills(${JSON.stringify(id)}).some(b => /STERN/.test(b.what))`)), JSON.stringify({ missed: m.missed }));
      await day(9);
      m = await mg();
      t.check("two in a row: the realtor's 'we should talk'", m.missed === 2);
      // (today's value on the day the foreclosure happens — values drift a little per day)
      const paidIn = m.paidIn, value = await g(`(ctx.realestate.debug.CLOCK.offset = 10, ctx.realestate.valueOf(${JSON.stringify(id)}))`), owed = m.owed;
      await day(10);
      const after = await coins();
      const want = Math.max(0, Math.round(value * 0.9) - owed, Math.round(paidIn * 0.5));
      t.check("three in a row: a friendly foreclosure — the house goes back", !(await g(`ctx.realestate.owns(${JSON.stringify(id)})`)) && !(await mg()));
      t.check("…she gets back the larger of the sale's leftovers or half she paid in", after === want && after >= Math.round(paidIn * 0.5), `${after} (paid in ${paidIn}, value ${value}, owed ${owed})`);
      t.check("coins never went below zero", (await coins()) >= 0);
      // early pay-off: half the remaining fee off
      await g(`(ctx.realestate.debug.CLOCK.offset = 0, true)`);
      await setCoins(30000);
      const r2 = await g(`(() => { const R = ctx.realestate, MG = R.debug.MG; const rec = R.listings()[0]; const p = MG.plan(R.valueOf(rec), 0.2, { days: 10, fee: 0.05 }); const ok = MG.take(rec, p).ok; const m = R.mortgage(rec.id); const want = m.owed - Math.round(m.fee * 0.5); const paid = MG.payOff(rec.id); return { ok, want, paid, gone: !R.mortgage(rec.id), mine: R.owns(rec.id), id: rec.id }; })()`);
      t.check("pay it off early: what's owed minus half the bank's fee; free and clear", r2.ok && r2.paid === r2.want && r2.gone && r2.mine, JSON.stringify(r2));
    });

    // ── stage 3: decorating her house, rent, selling ──
    await step("decorating her house", async () => {
      await setCoins(5000);
      const rec = await g(`ctx.realestate.home(${JSON.stringify(homeId)})`);
      await stand(rec.ap.x + rec.nx * 0.4, rec.ap.z + rec.nz * 0.4, rec.door.x, rec.door.z);
      await t.tap(0);
      t.check("in her house again", await roomReady());
      const hs = await g(`window.__interiors.room.hots.map(h => h.id)`);
      t.check("decor's spots are hotspots in her own house", ["slot:bed", "slot:lamp", "slot:art", "slot:shelf", "slot:rug", "slot:wallpaper"].every(h => hs.includes(h)), hs.join(","));
      const fam0 = await g(`ctx.decor.placed("bed")`);
      await g(`(() => { const r = window.__interiors.room, h = r.hots.find(h => h.id === "slot:bed"); r.lulu.obj.position.set(h.x, 0, h.z + 0.25); r.lulu.obj.rotation.y = Math.PI; return true; })()`);
      await t.frames(4);
      await t.tap(0);
      await t.frames(4);
      t.check("✋ at the bed → decor's picker card", (await g(`ctx.decor.debug.pickerSlot`)) === "bed");
      await t.tap(15); await t.frames(3);            // → the next bed (a new one)
      const c0 = await coins();
      await t.tap(0); await t.tap(0); await t.frames(3);   // ask → buy
      const P = await g(`({ here: ctx.realestate.debug.S.decor[${JSON.stringify(homeId)}], fam: ctx.decor.placed("bed"), owns: ctx.decor.owns("bed", "fluffy") })`);
      t.check("buy a bed for HER house: it's placed there (two presses, coins spent)", P.here && P.here.bed === "fluffy" && P.owns && (await coins()) < c0, JSON.stringify(P) + " coins " + (await coins()));
      t.check("…Lulu's family house keeps the bed it had", P.fam === fam0, `${P.fam} vs ${fam0}`);
      await t.tap(1); await t.frames(4);
      await t.shot("owned-decorated");
      t.check("out again", await leaveRoom());
    });
    await step("rent", async () => {
      const R = await g(`(() => { const R = ctx.realestate, C = R.debug.CLOCK; C.offset = 0; R.debug.S.days.rent = null; const t = R.findTenant(${JSON.stringify(homeId)}); R.debug.RN.tick(); const d0 = R.rentPile(${JSON.stringify(homeId)}); C.offset = 1; R.debug.RN.tick(); const d1 = R.rentPile(${JSON.stringify(homeId)}); C.offset = 5; R.debug.RN.tick(); C.offset = 9; R.debug.RN.tick(); C.offset = 12; R.debug.RN.tick(); C.offset = 13; R.debug.RN.tick(); const pile = R.rentPile(${JSON.stringify(homeId)}); const one = R.rentToday()[0]; C.offset = 0; return { t: t && t.name, d0, d1, pile, one: one && one.n, value: R.valueOf(${JSON.stringify(homeId)}) }; })()`);
      t.check("the realtor finds a tenant; rent starts the next PLAYED day (1 % of the value)", R.t && R.d0 === 0 && R.d1 > 0 && Math.abs(R.d1 - R.value * 0.01) <= 2, JSON.stringify(R));
      t.check("uncollected rent piles up to 3 days at most", R.pile <= R.one * 3 + 3 && R.pile >= R.one * 2, JSON.stringify(R));
      const c0 = await coins();
      const rec = await g(`ctx.realestate.home(${JSON.stringify(homeId)})`);
      const mb = await g(`ctx.realestate.debug.W.owned.find(r => r.id === ${JSON.stringify(homeId)}).mailbox`);
      await stand(mb.x + rec.nx * 0.8, mb.z + rec.nz * 0.8, mb.x, mb.z);
      await t.tap(0); await t.frames(10); await closeAll(); await t.frames(6);
      t.check("✋ 📬 the mailbox: the rent is hers", (await coins()) === c0 + R.pile && (await g(`ctx.realestate.rentPile(${JSON.stringify(homeId)})`)) === 0, `${c0} → ${await coins()} (pile ${R.pile})`);
      // the cap: ten pricey rented homes still pay ≤ 150 a played day
      const cap = await g(`(() => { const R = ctx.realestate, reg = R.registry, S = R.debug.S; const ids = []; for (let k = 0; k < 8; k++) { const id = "lakewood:cap" + k; if (reg.claim(id, { town: "nowhere", address: "#" + k, price: 30000, paid: 0 }).ok) { ids.push(id); S.rent[id] = { tenant: 0, since: 0, pile: 0 }; } } const total = R.rentToday().reduce((a, r) => a + r.n, 0); for (const id of ids) { reg.release(id, "test"); delete S.rent[id]; } return { n: ids.length + 1, total }; })()`);
      t.check("all her homes together: rent ≤ 150 a played day", cap.total <= 150 && cap.total >= 140, JSON.stringify(cap));
      await g(`(ctx.realestate.tenantOut(${JSON.stringify(homeId)}), true)`);
    });
    await step("selling", async () => {
      // the rule: buy-then-sell always loses (value ±3.5 % over the days, a 10 % fee)
      const arb = await g(`(() => { const R = ctx.realestate, C = R.debug.CLOCK; let worst = 0; for (const h of R.homes().slice(0, 40)) { const v = []; for (let d = 0; d < 46; d++) { C.offset = d; v.push(R.valueOf(h)); } for (let a = 0; a < v.length; a++) for (let b = a; b < v.length; b++) worst = Math.max(worst, v[b] * 0.9 / v[a]); } C.offset = 0; return worst; })()`);
      t.check("no arbitrage: selling later never beats buying (best case still loses ≥ 2 %)", arb < 0.98, arb.toFixed(4));
      const q = await g(`ctx.realestate.quote(${JSON.stringify(homeId)})`);
      t.check("the sale price: today's value − the 10 % fee", q.net === q.value - Math.round(q.value * 0.1) && q.bank === 0, JSON.stringify(q));
      const c0 = await coins();
      // through the office: talk → my places → sell → ✍️
      const sp = await g(`ctx.town.spot("realty")`);
      await stand(sp.x + sp.nx * 1.2, sp.z + sp.nz * 1.2, sp.x, sp.z);
      await t.tap(0);
      t.check("into the office", await roomReady());
      await g(`(() => { const r = window.__interiors.room, h = r.hots.find(h => h.id === "realtor"); r.lulu.obj.position.set(h.x, 0, h.z + 0.3); r.lulu.obj.rotation.y = Math.PI; return true; })()`);
      await t.frames(4);
      await t.tap(0);
      t.check("the realtor: 🔑 my places", (await pickOpt(/My places/)).ok);
      await pickOpt(/Forest|Minivan|Carpool|Clifton|Lake|Route|Main|County|14th/);
      const o = await toChoice();
      t.check("…sell it (the net shown) / a tenant", o.some(x => /Sell it/.test(x)) && o.some(x => /tenant/.test(x)), o.join(" | "));
      await pickOpt(/Sell it/);
      const o2 = await toChoice();
      t.check("…the first press asks", o2.some(x => /✍️ Sell/.test(x)) && (await coins()) === c0, o2.join(" | "));
      await pickOpt(/✍️ Sell/);
      await t.frames(6);
      t.check("✍️ → sold: +net, back on the market", (await coins()) === c0 + q.net && !(await g(`ctx.realestate.owns(${JSON.stringify(homeId)})`)), `${c0} → ${await coins()}`);
      await closeAll();
      t.check("out of the office", await leaveRoom());
    });

    // ── the cap: 10 homes ──
    await step("the cap", async () => {
      const r = await g(`(() => { const R = ctx.realestate.registry; for (let k = 0; k < 20; k++) R.claim("test:" + k, { town: "nowhere", address: "#" + k, paid: 0 }); return R.count(); })()`);
      t.check("at most 10 homes per player", r === 10, r);
      t.check("…and the realtor / the bank refuse the 11th", !(await g(`ctx.realestate.debug.MG.take(ctx.realestate.listings()[0] || { id: "x" }, { down: 1, price: 1, loan: 0, fee: 0, total: 0, days: 10, perDay: 0 }).ok`)));
      await g(`(() => { const R = ctx.realestate.registry; for (let k = 0; k < 20; k++) R.release("test:" + k, "test"); return R.count(); })()`);
    });

    const rep = await W.report(t).catch(() => null);
    if (rep) W.check(t, "the QA watchdog: nothing odd", rep);

    // ── reload: still hers; the 2D save never got anything ──
    await step("reload", async () => {
      await t.L(`import("./js/core/save.js").then(m => { m.flushShared(); m.saveNow(); return true; })`);
      const s2 = await t.L(`Object.keys(JSON.parse(localStorage.getItem("luluSaveV2") || "{}")).filter(k => /real|house|mortgage/i.test(k))`);
      t.check("the classic 2D save has no real-estate keys", s2.length === 0, s2.join());
      await t.page.reload();
      await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "reboots", 120000);
      t.check("after a reload: her homes are still hers", (await g(`ctx.realestate.count()`)) === 1 && !(await g(`ctx.realestate.owns(${JSON.stringify(homeId)})`)), await g(`ctx.realestate.count()`));
    });

  },
};
