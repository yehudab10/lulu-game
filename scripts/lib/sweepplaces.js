// 🔎 The places sweep (ci/sweep-places, Shabbos 2026-11-27): shared helpers for scripts/tests3d/sweepplaces*.js.
// Walks into every room a player can walk into in a town (the door's real ✋), with the QA watchdog on, and audits the
// room the way a player would see it: a screenshot inside, every ✋ hotspot reachable from the door + doing something +
// finishable (A) / leavable, nothing stacked, nobody standing inside a solid, the dialog box fitting the screen; then out
// of the same door, facing out, the car where she left it.
const W = require("./qawatch.js");
const fs = require("fs");
const path = require("path");

const SHOTS = path.resolve(__dirname, "..", "..", "smoke-shots", "sweep");

function make(t) {
  const g = t.game;
  const BOUGHT = new Set(), BUYS = [];
  let PENDING = null;
  const st = () => g(`L3.state`);
  const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
  const log = (...a) => console.log("   ·", ...a);
  const shot = async label => {
    if (!process.env.SWEEP_SHOTS && !process.argv.includes("--shots")) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    await t.page.screenshot({ path: path.join(SHOTS, `${label.replace(/[^\w-]+/g, "-")}.png`) });
  };
  const playing = async () => {
    if (await g(`!!(window.__interiors && __interiors.room)`)) { await g(`(__interiors.room.leave(), true)`); await t.until(`__lulu3d.state !== "interior"`, "out of the room", 30000); }
    if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); }
    if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); }
  };
  const start = async () => {
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "cruise starts")) return false;
    await playing();
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    return true;
  };
  const town = async id => {
    await playing();
    if (await g(`ctx.town.active && ctx.town.id === ${JSON.stringify(id)}`)) return true;
    if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(10); await playing(); }
    await g(`(ctx.town.load(${JSON.stringify(id)}), ctx.civic && ctx.civic.load && ctx.civic.load(), true)`);
    await t.until(`__lulu3d.ctx.town.loaded(${JSON.stringify(id)})`, `${id}'s models load`, 90000);
    await W.moved(t);
    await g(`ctx.town.enter({ town: ${JSON.stringify(id)}, speed: 0 })`);
    return t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === ${JSON.stringify(id)}`, `into ${id}`, 8000);
  };
  const onFoot = async () => {
    if (await st() !== "footRun") {
      await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "out on foot", 8000);
    }
    await g(`(ctx.foot.debug.F.phase = "walk", true)`);
  };
  // every door-like ✋ standing at a town spot (as scripts/tests3d/doors.js): { name, i, short, label, at }
  const findDoors = () => g(`(() => {
    const F = ctx.foot.debug.F, list = ctx.foot.spots(), T = ctx.town.debug.S.T, out = [];
    for (const name of Object.keys(T.spots)) {
      const sp = ctx.town.spot(name);
      if (!sp || sp.nx == null) continue;
      F.pos.set(sp.x, 0.05, sp.z);
      list.forEach((s, i) => {
        if (!s.door || out.some(o => o.i === i)) return;
        let at = null; try { at = s.pos ? s.pos() : s; } catch (e) { return; }
        let label = ""; try { label = typeof s.label === "function" ? s.label() : (s.label || ""); } catch (e) {}
        if (at && at.nx != null && Math.hypot(at.x - sp.x, at.z - sp.z) < 0.3) out.push({ name, i, short: s.short || "", label: String(label).slice(0, 60), at: { x: at.x, z: at.z, ux: at.ux, uz: at.uz, nx: at.nx, nz: at.nz } });
      });
    }
    return out;
  })()`);
  const room = expr => g(`(() => { const r = window.__interiors && window.__interiors.room; if (!r) return null; return ${expr}; })()`);

  // the dialog on screen: does it fit (inside the viewport, the text not cut, the buttons inside the box)?
  const dialogFit = () => t.L(`(() => {
    const d = document.getElementById("dialog"); if (!d || !d.classList.contains("open")) return null;
    const r = d.getBoundingClientRect(), W = innerWidth, H = innerHeight, bad = [];
    if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) bad.push("box off screen " + [r.left, r.top, r.right, r.bottom].map(Math.round));
    const tx = d.querySelector(".text"); if (tx && tx.scrollWidth > tx.clientWidth + 2) bad.push("text too wide");
    for (const b of d.querySelectorAll(".opt")) { const q = b.getBoundingClientRect(); if (b.style.visibility !== "hidden" && (q.right > W + 1 || q.bottom > H + 1 || b.scrollWidth > b.clientWidth + 2)) bad.push("option cut: " + b.textContent.slice(0, 30)); }
    return { bad, name: (d.querySelector(".name") || {}).textContent, text: (tx || {}).textContent, opts: [...d.querySelectorAll(".opt")].map(b => b.textContent) };
  })()`);

  // flood the floor from the room's door (her size, the room's own collisions, nobody in the way): which ✋ can't be reached
  const flood = () => room(`(() => {
    const B = r.bounds, ppl = r.people; r.people = [];
    const S = 0.15, nx = Math.ceil((B.x1 - B.x0) / S) + 1, nz = Math.ceil((B.z1 - B.z0) / S) + 1;
    const ok = (x, z) => { const p = { x, z }; r.collide(p, 0.32); return Math.hypot(p.x - x, p.z - z) < 0.02; };
    const st = new Int8Array(nx * nz).fill(-1), at = (i, k) => st[i * nz + k] < 0 ? (st[i * nz + k] = ok(B.x0 + i * S, B.z0 + k * S) ? 1 : 0) : st[i * nz + k];
    const seen = new Uint8Array(nx * nz), q = [];
    const L = r.lulu.obj.position; let si = Math.round((L.x - B.x0) / S), sk = Math.round((L.z - B.z0) / S);
    for (let tries = 0; tries < 40 && !at(si, sk); tries++) sk += (L.z > (B.z0 + B.z1) / 2 ? -1 : 1);
    if (at(si, sk)) { seen[si * nz + sk] = 1; q.push([si, sk]); }
    while (q.length) { const [i, k] = q.pop(); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i2 = i + a, k2 = k + b; if (i2 < 0 || k2 < 0 || i2 >= nx || k2 >= nz || seen[i2 * nz + k2] || !at(i2, k2)) continue; seen[i2 * nz + k2] = 1; q.push([i2, k2]); } }
    const best = (x, z, rad) => { let b = null, bd = 1e9; for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) if (seen[i * nz + k]) { const d = Math.hypot(B.x0 + i * S - x, B.z0 + k * S - z); if (d < bd) { bd = d; b = { x: B.x0 + i * S, z: B.z0 + k * S, d }; } } return b && b.d <= rad ? b : null; };
    const out = {};
    r.hots.forEach((h, i) => { const who = h.track && h.who && r.byId[h.who], x = who ? who.p.obj.position.x : h.x, z = who ? who.p.obj.position.z : h.z; out[i] = best(x, z, Math.max(0.35, h.r - 0.05)); });
    r.people = ppl;
    return out;
  })()`);

  // a list of the room's ✋ spots + people for the audit
  const facts = () => room(`(() => ({
    id: r.def.id, name: r.def.name, title: r.def.title, B: r.bounds,
    hots: r.hots.map((h, i) => { let lb = ""; try { lb = typeof h.label === "function" ? h.label(r) : h.label; } catch (e) { lb = "ERR " + e.message; }
      let en = true; try { en = !h.enabled || !!h.enabled(r); } catch (e) { en = "ERR"; }
      const who = h.track && h.who && r.byId[h.who]; return { i, id: h.id, label: String(lb || "").slice(0, 50), x: +(who ? who.p.obj.position.x : h.x).toFixed(2), z: +(who ? who.p.obj.position.z : h.z).toFixed(2), r: h.r, en }; }),
    people: r.people.map(q => ({ id: q.id, x: +q.p.obj.position.x.toFixed(2), z: +q.p.obj.position.z.toFixed(2), sit: !!q.pose.sit,
      inCol: r.cols.filter(c => c.on && q.p.obj.position.x > c.x0 + 0.08 && q.p.obj.position.x < c.x1 - 0.08 && q.p.obj.position.z > c.z0 + 0.08 && q.p.obj.position.z < c.z1 - 0.08).map(c => c.id).join(","),
      out: q.p.obj.position.x < r.bounds.x0 - 0.2 || q.p.obj.position.x > r.bounds.x1 + 0.2 || q.p.obj.position.z < r.bounds.z0 - 0.2 || q.p.obj.position.z > r.bounds.z1 + 0.2 })),
  }))()`);

  // a card on screen: fits? (inside the viewport, nothing cut) + a shop card: the cheapest thing she can afford bought for
  // real (two presses — the coins leave ONCE, it's hers after, a third press charges nothing) and something too dear refused
  const cardCheck = async where => {
    const fit = await t.L(`(() => { const c = document.getElementById("screenCard"), r = c.getBoundingClientRect(), bad = [];
      if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) bad.push("off screen " + [r.left, r.top, r.right, r.bottom].map(Math.round));
      for (const b of c.querySelectorAll("button")) { const q = b.getBoundingClientRect(); if (q.width && (q.right > innerWidth + 1 || q.left < -1)) bad.push("button off screen: " + b.textContent.slice(0, 24)); }
      const title = (c.querySelector(".dp-title, h2, h1, .title") || c).textContent.slice(0, 40);
      return { bad, title }; })()`);
    const spec = await t.L(`import("./js/features/shops/card.js").then(C => { const sp = C.cardSpec(); if (!sp) return null;
      return sp.tiles.map(t => { let st = "?"; try { st = t.state ? t.state() : t.price != null ? "buy" : "none"; } catch (e) { st = "ERR " + e.message; } return { id: t.id, name: String(t.name).replace(/<[^>]+>/g, ""), price: t.price, st, buy: !!t.buy }; }); })`);
    if (!spec) return { title: fit.title, bad: fit.bad, tiles: "" };
    const errs = spec.filter(x => /^ERR/.test(x.st));
    for (const e of errs) fit.bad.push(`tile ${e.id} state throws ${e.st}`);
    const c0 = await coins();
    const forSale = spec.filter(x => x.st === "buy" && x.buy && x.price != null).sort((a, b) => a.price - b.price);
    let buy = "";
    const cheap = forSale.find(x => x.price <= c0 && x.price > 0);
    if (cheap && !BOUGHT.has(fit.title)) {
      BOUGHT.add(fit.title);
      await t.L(`import("./js/features/shops/card.js").then(C => { C.press(${JSON.stringify(cheap.id)}); return true; })`); await t.frames(3);
      const cMid = await coins();
      await t.L(`import("./js/features/shops/card.js").then(C => { C.press(${JSON.stringify(cheap.id)}); return true; })`); await t.frames(20);
      const c1 = await coins();
      const st1 = await t.L(`import("./js/features/shops/card.js").then(C => { const t = C.cardSpec() && C.cardSpec().tiles.find(t => t.id === ${JSON.stringify(cheap.id)}); return t ? (t.state ? t.state() : "buy") : "gone"; })`);
      await t.L(`import("./js/features/shops/card.js").then(C => { C.press(${JSON.stringify(cheap.id)}); C.press(${JSON.stringify(cheap.id)}); return true; })`); await t.frames(20);
      const c2 = await coins();
      buy = `bought ${cheap.name} @${cheap.price}: first press ${cMid - c0}, paid ${c0 - c1}, now ${st1}, again ${c1 - c2}`;
      if (cMid !== c0) fit.bad.push(`one press already charged (${cheap.name})`);
      // (a card that hands over to a question first — the clothes' "Put it on now?" — charges when that's answered)
      if (st1 === "gone" && c1 === c0) PENDING = { name: cheap.name, price: cheap.price, c0 };
      else if (c0 - c1 !== cheap.price) fit.bad.push(`price shown ${cheap.price} ≠ charged ${c0 - c1} (${cheap.name})`);
      if (st1 !== "buy" && c1 !== c2) fit.bad.push(`a one-off charged twice (${cheap.name}: ${c1 - c2})`);
      BUYS.push({ where, title: fit.title, id: cheap.id, name: cheap.name, price: cheap.price, after: st1 });
    }
    const dear = forSale.find(x => x.price > c0);
    if (dear) {
      const c3 = await coins();
      const msg = await t.L(`import("./js/features/shops/card.js").then(C => { C.press(${JSON.stringify(dear.id)}); C.press(${JSON.stringify(dear.id)}); return (document.querySelector("#screenCard .dp-desc") || {}).textContent || ""; })`);
      await t.frames(6);
      const c4 = await coins();
      buy += ` · too dear ${dear.name} @${dear.price}: ${c3 - c4 ? "CHARGED " + (c3 - c4) : "refused"} «${msg.slice(0, 60)}»`;
      if (c3 !== c4) fit.bad.push(`bought ${dear.name} without the coins`);
    }
    return { title: fit.title, bad: fit.bad, tiles: spec.map(x => `${x.name}${x.price != null ? "@" + x.price : ""}:${x.st}`).join(", ").slice(0, 300), buy };
  };

  // play out whatever a ✋ started: lines advanced with A (✕), a choice → its LAST option (the "never mind" — logged),
  // a mini-game → B (○) until it lets go. → { steps, choices, fits, stuck }
  const drive = async (where, { pick = "last", max = 50 } = {}) => {
    const seen = [], fits = [];
    let k = 0, modeB = 0, cardB = 0;
    for (; k < max; k++) {
      const s = await g(`(() => { const r = (window.__interiors && __interiors.room) || { busy: false, mode: null, leaving: false, auto: null }; return ({ busy: r.busy, mode: !!r.mode, dlg: !!__lulu3d.ctx.dialogOpen, leaving: r.leaving, auto: !!r.auto,
        scr: (() => { const c = document.getElementById("screenCard"); return !!(c && c.offsetParent !== null && c.getBoundingClientRect().width > 0); })() }); })()`);
      if (!s) return { steps: k, seen, fits, left: true };
      if (s.scr && !s.dlg) {
        // a card on screen (a shop's buy card, a picker): it fits the phone? a real buy if it sells something, then ○ / B
        if (!cardB) {
          await t.frames(10);
          await shot(`${where}-card`);
          const c = await cardCheck(where);
          seen.push(`CARD «${c.title}» ${c.tiles}${c.buy ? " · " + c.buy : ""}`);
          for (const x of c.bad) fits.push(`card ${c.title}: ${x}`);
        }
        cardB++;
        await t.tap(1); await t.frames(6);
        if (cardB > 6) { seen.push("CARD did not close with B"); return { steps: k, seen, fits, stuck: "card" }; }
        continue;
      }
      if (!s.busy && !s.dlg && !s.mode && !s.auto) return { steps: k, seen, fits };
      if (s.dlg) {
        await t.frames(2);
        const f = await dialogFit();
        if (f) {
          if (f.bad.length) fits.push(`${f.name}: ${f.bad.join("; ")}`);
          if (f.opts.length) {
            await t.L(`(() => { const o = document.querySelectorAll("#dialog .opt"); o.forEach(b => b.style.visibility = "visible"); return true; })()`);
            const f2 = await dialogFit(); if (f2 && f2.bad.length) fits.push(`${f2.name}: ${f2.bad.join("; ")}`);
            const idx = pick === "first" ? 0 : typeof pick === "function" ? pick(f.opts) : f.opts.length - 1;
            seen.push(`[${f.name}] ${f.text.slice(0, 60)} ⟶ {${f.opts.join(" | ")}} picked «${f.opts[idx]}»`);
            await t.L(`(() => { const o = document.querySelectorAll("#dialog .opt")[${idx}]; if (o) { o.click(); o.click(); } return true; })()`);
          } else { seen.push(`[${f.name}] ${(f.text || "").slice(0, 60)}`); await t.tap(0); await t.tap(0); }
        } else await t.frames(4);
        continue;
      }
      if (s.mode) { modeB++; await t.tap(1); await t.frames(10); if (modeB > 12) { seen.push("MODE did not let go with B"); return { steps: k, seen, fits, stuck: "mode" }; } continue; }
      await t.frames(8);
    }
    return { steps: k, seen, fits, stuck: "busy" };
  };

  // walk her to a reachable floor point by a ✋, facing it, and press A (✕) the real way
  const useHot = async (i, at) => {
    await room(`(() => { const h = r.hots[${i}], o = r.lulu.obj, who = h.track && h.who && r.byId[h.who], x = who ? who.p.obj.position.x : h.x, z = who ? who.p.obj.position.z : h.z;
      o.position.x = ${at.x}; o.position.z = ${at.z}; o.rotation.y = Math.atan2(x - o.position.x, z - o.position.z); r.vel.set(0, 0, 0); r.outArmed = false; return true; })()`);
    await t.frames(3);
    const near = await room(`r.near ? r.hots.indexOf(r.near) : -2`);
    if (near !== i) return { near };
    await t.tap(0);
    await t.frames(4);
    return { near };
  };

  /** The whole audit of the room she's in. `skip` = ✋ ids not to press (they leave / start a long scene). */
  const audit = async (where, { skip = [], pick = "last", gated = false } = {}) => {
    const out = { where, problems: [] };
    await t.until(`window.__interiors && __interiors.room && __interiors.room.ready`, `${where}: the room is up`, 60000);
    await t.frames(40);
    const f = await facts();
    if (!f) { out.problems.push("no room"); return out; }
    log(`${where}: room ${f.id} "${f.name}" · ✋ ${f.hots.map(h => `${h.id}${h.en === true ? "" : "(off)"}`).join(", ")} · people ${f.people.map(p => p.id).join(", ")}`);
    await shot(`${where}-in`);
    // nothing of the street's left on screen: foot's walk hint, its speech bubbles
    const street = await t.L(`(() => { const r = document.getElementById("footBubbles"), vis = r && getComputedStyle(r).display !== "none" ? [...r.children].filter(e => getComputedStyle(e).display !== "none").map(e => e.textContent) : [];
      const G = __lulu3d.ctx.G; return { hint: G && G.hint || "", bubbles: vis }; })()`);
    if (/borrow/.test(street.hint)) out.problems.push(`the street's hint at the bottom: ${street.hint.slice(0, 40)}`);
    if (street.bubbles.length) out.problems.push(`the street's bubbles over the room: ${street.bubbles.join(" | ").slice(0, 80)}`);
    // people standing inside furniture / outside the room
    for (const p of f.people) {
      if (p.inCol && !p.sit) out.problems.push(`${p.id} stands inside ${p.inCol}`);
      if (p.out) out.problems.push(`${p.id} is outside the room's walls`);
    }
    // ✋ stacked on another (two enabled within 0.5 m → one hides the other)
    const en = f.hots.filter(h => h.en === true);
    for (let a = 0; a < en.length; a++) for (let b = a + 1; b < en.length; b++)
      if (Math.hypot(en[a].x - en[b].x, en[a].z - en[b].z) < 0.5) out.problems.push(`✋ ${en[a].id} and ${en[b].id} stacked`);
    for (const h of f.hots) if (h.en === "ERR" || /^ERR/.test(h.label)) out.problems.push(`✋ ${h.id} throws: ${h.label}`);
    // reachable from the door
    const reach = await flood();
    // (a room with a gate inside — JFK's airside past security — passes `gated`: those ✋ are logged, not failed)
    for (const h of en) if (!reach[h.i]) out.problems.push(`✋ ${h.id} (${h.label}) can't be reached from the door${gated ? " (past the gate)" : ""}`);
    // press each one, play it out
    const W0 = await coins();
    for (const h of en) {
      if (h.id === "door" || skip.includes(h.id) || !reach[h.i]) continue;
      if (!await g(`!!(window.__interiors && __interiors.room && __interiors.room.ready)`)) break;
      const c0 = await coins();
      const u = await useHot(h.i, reach[h.i]);
      if (u.near !== h.i) {
        const other = u.near >= 0 ? (await room(`r.hots[${u.near}].id`)) : "nothing";
        out.problems.push(`✋ ${h.id}: standing at it, the prompt is ${other}`);
        continue;
      }
      const d = await drive(`${where} ${h.id}`, { pick });
      // the room's speech bubbles (interiors/fx.js Bubbles): shown = it did something; none wider than the screen
      const bub = await room(`(() => { const cam = r.set.camera; return r.bubbles.list.map(b => { const d = cam.position.distanceTo(b.sp.position), vw = 2 * d * Math.tan(cam.fov * Math.PI / 360) * cam.aspect;
        return { text: b.text || "?", frac: +(b.sp.scale.x * (b.fill || 1) / vw).toFixed(2) }; }); })()`) || [];
      for (const b of bub) { d.seen.push(`💬 ${b.text.slice(0, 50)} (${Math.round(b.frac * 100)}% wide)`); if (b.frac > 0.95) d.fits.push(`bubble ${Math.round(b.frac * 100)}% of the screen wide: ${b.text.slice(0, 40)}`); }
      const c1 = await coins();
      const did = d.seen.length > 0 || c1 !== c0;
      log(`  ✋ ${h.id} «${h.label}» → ${d.seen.join(" ⇒ ").slice(0, 400) || "(nothing shown)"}${c1 !== c0 ? ` [coins ${c1 - c0}]` : ""}${d.stuck ? " STUCK " + d.stuck : ""}`);
      if (PENDING) { if (c0 - c1 !== PENDING.price) out.problems.push(`✋ ${h.id}: ${PENDING.name} shown ${PENDING.price}, charged ${c0 - c1}`); PENDING = null; }
      for (const x of d.fits) out.problems.push(`✋ ${h.id}: dialog doesn't fit — ${x}`);
      if (d.stuck) out.problems.push(`✋ ${h.id}: stuck (${d.stuck})`);
      if (d.left) { log(`  (✋ ${h.id} took her out of the room)`); break; }
      if (!did) out.problems.push(`✋ ${h.id} (${h.label}) does nothing visible`);
      if (d.stuck) { await g(`(() => { const r = __interiors.room; if (r && r.mode) { const m = r.mode; r.mode = null; if (m.stop) m.stop(r); m.done(); } return true; })()`); await t.frames(4); }
    }
    out.spent = (await coins()) - W0;
    return out;
  };

  // the audit's findings: the hard ones fail the test, the judgement calls (someone close to furniture, two ✋ close
  // together, a ✋ that only shows a bubble) are logged for a person to look at
  const HARD = /street's|% of the screen wide|doesn't fit|charged|without the coins|stuck|throws|can't be reached from the door$|the prompt is (?!nothing)/;
  const report = (where, a) => { for (const p of a.problems) { if (HARD.test(p)) t.check(`${where}: ${p}`, false); else console.log(`   ✗? ${where}: ${p}`); } };

  /** Into a door from the street with the real ✋; → true when the room is up. */
  const enter = async (d, where) => {
    await onFoot();
    await W.moved(t);
    await g(`(() => { const F = ctx.foot.debug.F, a = ${JSON.stringify(d.at)}; F.peds.length = 0; F.pos.set(a.x + a.nx * 1.4, 0.05, a.z + a.nz * 1.4); F.vel.set(0, 0, 0); F.lulu.obj.rotation.y = Math.atan2(-a.nx, -a.nz); ctx.cam.snap(); return true; })()`);
    await t.frames(6);
    const pr = await g(`(() => { const pr = ctx.foot.debug.interactables(); return pr ? { label: pr.label, mine: pr.ent === ctx.foot.spots()[${d.i}] } : null; })()`);
    if (!pr || !pr.mine) { t.check(`${where}: at its door the ✋ is the door`, false, JSON.stringify(pr)); return false; }
    await t.tap(0);
    // (a counter on the street — the makolet, Bling Bay, the impound gate — opens its card right there, no room)
    const scr = `(() => { const c = document.getElementById("screenCard"); return !!(c && c.offsetParent !== null && c.getBoundingClientRect().width > 0); })()`;
    const went = await t.until(`__lulu3d.state !== "footRun" || ${scr} || __lulu3d.ctx.dialogOpen`, `${where}: ✋ goes in (${pr.label})`, 60000);
    if (!went) return false;
    if (await st() === "footRun") {
      await t.frames(10);
      await shot(`${where}-card`);
      const c = await t.L(scr) ? await cardCheck(where) : null;
      if (c) { log(`${where}: ✋ «${pr.label}» → CARD «${c.title}» ${c.tiles} · ${c.buy}`); for (const x of c.bad) t.check(`${where}: card — ${x}`, false); }
      const dl = await drive(where).catch(() => null);
      if (dl && dl.seen.length) log(`${where}: ${dl.seen.join(" ⇒ ").slice(0, 300)}`);
      for (let k = 0; k < 6 && await t.L(scr); k++) { await t.tap(1); await t.frames(8); }
      t.check(`${where}: the counter's card closes with B`, !await t.L(scr));
      return "card";
    }
    if (await st() !== "interior") { log(`${where}: ✋ went to state ${await st()} (not a room)`); return "other"; }
    return t.until(`window.__interiors && __interiors.room && __interiors.room.ready`, `${where}: the room is up`, 60000);
  };

  /** Out with B (○) → "Leave" the real way; → where she stands vs the door. */
  const leave = async (d, where, car0) => {
    await t.tap(1);
    await t.frames(30);
    // ○ / B on "Head back outside?" is its "Stay a bit" (core/dialog.js cancelIndex) — then B again asks again
    if (await g(`ctx.dialogOpen`)) {
      await t.tap(1); await t.frames(4);
      t.check(`${where}: B on "Head back outside?" = stay`, await g(`!ctx.dialogOpen && L3.state === "interior"`));
      await t.frames(10); await t.tap(1); await t.frames(30);
    }
    const f = await dialogFit();
    if (f && f.opts.length) await t.L(`(() => { const o = document.querySelector("#dialog .opt"); if (o) { o.click(); o.click(); } return true; })()`);
    else t.check(`${where}: B asks to leave`, false, JSON.stringify(f));
    if (!await t.until(`__lulu3d.state === "footRun"`, `${where}: back out on foot`, 30000)) { await playing(); return; }
    await t.frames(20);
    const o = await g(`(() => { const F = ctx.foot.debug.F, a = ${JSON.stringify(d.at)}, c = ctx.car.pos;
      return { dist: +Math.hypot(F.pos.x - a.x, F.pos.z - a.z).toFixed(2), n: +((F.pos.x - a.x) * a.nx + (F.pos.z - a.z) * a.nz).toFixed(2),
        face: +(Math.sin(F.lulu.obj.rotation.y) * a.nx + Math.cos(F.lulu.obj.rotation.y) * a.nz).toFixed(2), town: ctx.town.active }; })()`);
    o.car = await carPos();
    t.check(`${where}: out at the same door (${o.dist} m), on the street side (${o.n})`, o.dist < 4 && o.n > -0.3, JSON.stringify(o));
    t.check(`${where}: …facing out (${o.face})`, o.face > 0.3, JSON.stringify(o));
    if (car0 && o.car) t.check(`${where}: …her car where she left it`, Math.hypot(o.car[0] - car0[0], o.car[1] - car0[1]) < 0.5, JSON.stringify({ car0, now: o.car }));
  };

  // where her parked car stands (on foot ctx.car.pos is only an anchor under her feet: the stub is the real car)
  const carPos = () => g(`(() => { const c = ctx.foot.debug.F && ctx.foot.debug.F.car && ctx.foot.debug.F.car.stub; return c ? [+c.x.toFixed(1), +c.z.toFixed(1)] : null; })()`);

  /** Visit every door-like room in a town (filter by name): in, audit, out. */
  const sweepTown = async (id, { only = null, skipNames = [], skipHots = {}, prefix = "" } = {}) => {
    if (!await town(id)) return [];
    await onFoot();
    await t.frames(20);
    const doors = (await findDoors()).filter(d => (!only || only.includes(d.name)) && !skipNames.includes(d.name));
    log(`${id}: ${doors.length} doors — ${doors.map(d => `${d.name}(${d.short || d.label})`).join(", ")}`);
    const res = [];
    for (const d of doors) {
      const where = `${prefix}${id}-${d.name}`;
      await W.reset(t);
      const car0 = await carPos();
      const ok = await enter(d, where);
      if (ok === "card") continue;
      if (ok === "other") { await shot(`${where}-other`); await playing(); await onFoot(); continue; }
      if (!ok) { await playing(); await onFoot(); continue; }
      const a = await audit(where, { skip: skipHots[d.name] || [] });
      res.push(a);
      report(where, a);
      if (await g(`!!(window.__interiors && __interiors.room && __interiors.room.ready)`)) {
        await shot(`${where}-end`);
        await leave(d, where, car0);
      } else { await playing(); }
      const r = await W.report(t); W.log(r); W.check(t, `${where}: in + out`, r); await W.reset(t);
      await onFoot();
    }
    return res;
  };

  /** The town's shopfronts (features/storefronts): every claimed front (the lanes…) + a few open ones (one shared room,
   *  dressed per shop) + what a closed one says. */
  const sweepFronts = async (id, { open = 4 } = {}) => {
    if (!await town(id)) return;
    await onFoot();
    await t.frames(20);
    const car0 = await carPos();
    const fronts = await g(`(() => { const SF = ctx.storefronts, F = SF.debug.F; return F.list.map(f => ({ id: f.id, name: f.name, st: SF.stateOf(f), label: SF.debug.label(f),
      at: f.door ? { x: f.door.x, z: f.door.z, nx: f.nx, nz: f.nz, ux: f.ux, uz: f.uz } : null })).filter(f => f.at); })()`);
    const by = s => fronts.filter(f => f.st === s);
    log(`${id}: ${fronts.length} fronts — ${["open", "claimed", "closed", "soon", "lease", "use", "gone", "office", "dentist"].map(s => `${s} ${by(s).length}`).join(", ")}`);
    for (const f of by("closed").slice(0, 3)) {
      await onFoot();
      await g(`(() => { const F = ctx.foot.debug.F, a = ${JSON.stringify(f.at)}; F.peds.length = 0; F.pos.set(a.x + a.nx * 1.4, 0.05, a.z + a.nz * 1.4); F.vel.set(0, 0, 0); return true; })()`);
      await t.frames(8);
      const pr = await g(`(() => { const pr = ctx.foot.debug.interactables(); return pr ? pr.label : "nothing"; })()`);
      log(`  closed ${f.name}: ✋ «${pr}»`);
    }
    const pickOpen = by("open").filter((f, k, a) => k % Math.max(1, Math.floor(a.length / open)) === 0).slice(0, open);
    for (const f of [...by("claimed"), ...pickOpen]) {
      const where = `${id}-front-${f.name}`;
      await onFoot();
      await g(`(() => { const F = ctx.foot.debug.F, a = ${JSON.stringify(f.at)}; F.peds.length = 0; F.pos.set(a.x + a.nx * 1.4, 0.05, a.z + a.nz * 1.4); F.vel.set(0, 0, 0); F.lulu.obj.rotation.y = Math.atan2(-a.nx, -a.nz); return true; })()`);
      await t.frames(8);
      const i = await g(`(() => { const pr = ctx.foot.debug.interactables(); return pr && pr.ent ? ctx.foot.spots().indexOf(pr.ent) : -1; })()`);
      const d = { name: f.name, i, at: f.at };
      await W.reset(t);
      const ok = await enter(d, where);
      if (ok !== true) { await playing(); continue; }
      const a = await audit(where);
      report(where, a);
      if (await g(`!!(window.__interiors && __interiors.room && __interiors.room.ready)`)) await leave(d, where, car0); else await playing();
      const r = await W.report(t); W.log(r); W.check(t, `${where}: in + out`, r); await W.reset(t);
    }
  };

  /** Everything bought in the sweep (the one-offs) is in the save, and still there after a reload. */
  const persisted = async () => {
    const oneOffs = BUYS.filter(b => b.after !== "buy");
    if (!oneOffs.length) return;
    await t.frames(60);
    await t.L(`import("./js/core/save.js").then(m => { try { m.flushShared && m.flushShared(); } catch (e) {} return true; })`);
    const has = () => t.L(`(() => { const s = Object.keys(localStorage).map(k => localStorage.getItem(k)).join(" "); return ${JSON.stringify(oneOffs.map(b => b.id))}.map(id => s.includes(JSON.stringify(id))); })()`);
    const a = await has();
    await t.page.reload();
    await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "boots again after the reload", 120000);
    const b = await has();
    oneOffs.forEach((x, k) => t.check(`bought ${x.name} (${x.where}) is in the save (${a[k]}) and survives a reload (${b[k]})`, a[k] && b[k]));
  };

  return { report, sweepFronts, persisted, BUYS, g, st, coins, log, shot, playing, start, town, onFoot, findDoors, room, dialogFit, flood, facts, drive, useHot, audit, enter, leave, carPos, sweepTown };
}

module.exports = { make, W };
