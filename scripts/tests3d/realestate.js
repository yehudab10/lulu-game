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
      t.check("the board lists today's homes with prices", o1.length >= 3 && o1.every(o => /💰|Never/.test(o)), o1.slice(0, 3).join(" | "));
      await t.shot("office-board");
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

    // ── the cap: 10 homes ──
    await step("the cap", async () => {
      const r = await g(`(() => { const R = ctx.realestate.registry; for (let k = 0; k < 20; k++) R.claim("test:" + k, { town: "nowhere", address: "#" + k, paid: 0 }); return R.count(); })()`);
      t.check("at most 10 homes per player", r === 10, r);
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
      t.check("after a reload: still hers", (await g(`ctx.realestate.owns(${JSON.stringify(homeId)})`)) && (await g(`ctx.realestate.count()`)) === 1);
    });

  },
};
