// 🚪 Doors that are easy to use (ci/doors, roadmap 29, stage 0): every door's ✋ shows anywhere a player would stand to
// go in — across the doorway / shopfront, from the step out to the kerb — not one square metre. For each town: every
// registered door-like ✋ spot (`door:` spots — places, shul, city hall, bank, pizza / bakery, clothes, the realtor,
// the makolet counter, Bling Bay, the impound gate) found at its town spot, then a probe walked across its front (3 × 3
// points: left · middle · right × the step · the spot · the kerb) asserting the ✋ prompt is THAT door; a sample of
// strangers' front doors (features/homes) the same way; then each building door is actually entered and left. Last: the
// on-foot ✋ button on a phone (412 × 915, 667 × 375) is big and nothing covers it.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "doors",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,law,atmos,seasons,homes",
  save2d: { totalCoins: 2000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const st = () => g(`L3.state`);
    const playing = async () => { if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); } if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); } };
    const town = async id => {
      await playing();
      if (await g(`ctx.town.active && ctx.town.id === ${JSON.stringify(id)}`)) return true;
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(10); await playing(); }
      await g(`(ctx.town.load(${JSON.stringify(id)}), true)`);
      await t.until(`__lulu3d.ctx.town.loaded(${JSON.stringify(id)})`, `${id}'s models load`, 90000);
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
    // every door-like spot standing at a town spot: { name, i (index in ctx.foot.spots()), short, at: {x, z, ux, uz, nx, nz} }
    const findDoors = () => g(`(() => {
      const F = ctx.foot.debug.F, list = ctx.foot.spots(), T = ctx.town.debug.S.T, out = [];
      for (const name of Object.keys(T.spots)) {
        const sp = ctx.town.spot(name);
        if (!sp || sp.nx == null) continue;
        F.pos.set(sp.x, 0.05, sp.z);
        list.forEach((s, i) => {
          if (!s.door || out.some(o => o.i === i)) return;
          let at = null; try { at = s.pos ? s.pos() : s; } catch (e) { return; }
          if (at && at.nx != null && Math.hypot(at.x - sp.x, at.z - sp.z) < 0.3) out.push({ name, i, short: s.short || "", at: { x: at.x, z: at.z, ux: at.ux, uz: at.uz, nx: at.nx, nz: at.nz } });
        });
      }
      return out;
    })()`);
    // walk a probe across the door's front; → the probe points where the ✋ prompt was NOT this door (+ what won)
    const probe = (i, at, U, N) => g(`(() => {
      const F = ctx.foot.debug.F, s = ctx.foot.spots()[${i}], at = ${JSON.stringify(at)}, miss = [];
      const keep = { parked: F.parked, peds: F.peds, animals: F.animals };
      F.parked = []; F.peds = []; F.animals = [];       // (a chat / a parked car right beside her may fairly win — not the question here)
      try {
        for (const u of ${JSON.stringify(U)}) for (const n of ${JSON.stringify(N)}) {
          F.pos.set(at.x + at.ux * u + at.nx * n, 0.05, at.z + at.uz * u + at.nz * n);
          const pr = ctx.foot.debug.interactables();
          if (!pr || pr.ent !== s) miss.push(u + "," + n + "→" + (pr ? pr.label : "nothing"));
        }
      } finally { Object.assign(F, keep); }
      return miss;
    })()`);

    // 🎥 stage 1 — inside, the camera is the on-foot one: behind her at eye-ish height (not from above), inside the room's
    // box + under its ceiling, she's in the picture; up on the stick walks her AWAY from the camera, as outdoors
    const room = expr => g(`(() => { const r = window.__interiors.room; return ${expr}; })()`);
    const insideChecks = async where => {
      await t.frames(30);
      const c = await room(`(() => { const cam = r.set.camera, B = r.bounds, L = r.lulu.obj.position, v = L.clone().setY(1).project(cam);
        return { orbit: !!r.orbiting, y: cam.position.y, in: cam.position.x > B.x0 - 0.5 && cam.position.x < B.x1 + 0.5 && cam.position.z > B.z0 - 0.5 && cam.position.z < B.z1 + 0.5,
          seen: Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95 && v.z < 1, h: Math.hypot(cam.position.x - L.x, cam.position.z - L.z) }; })()`);
      t.check(`${where}: the on-foot camera inside (orbit ${c.orbit}, ${c.y.toFixed(1)} m up, ${c.h.toFixed(1)} m back)`, c.orbit && c.y < 3.0 && c.h > 0.5);
      t.check(`${where}: the camera stays inside the room`, c.in);
      t.check(`${where}: she's in the picture`, c.seen);
      // (nothing solid between the lens and her: a ray from the camera to her chest hits no unfaded room mesh)
      const blocked = await room(`(() => { const T = __lulu3d.THREE || null; return r.debugBlocked ? r.debugBlocked() : ""; })()`);
      t.check(`${where}: no wall between the camera and her`, !blocked, blocked);
      await t.shot(`room-${where.replace(/\W+/g, "-")}`);
      const before = await room(`(() => { const L = r.lulu.obj.position, cam = r.set.camera; return { fx: L.x - cam.position.x, fz: L.z - cam.position.z, x: L.x, z: L.z }; })()`);
      await t.stick(0, -1); await t.frames(20); await t.stick(0, 0); await t.frames(4);
      const after = await room(`(() => { const L = r.lulu.obj.position; return { x: L.x, z: L.z }; })()`);
      const mx = after.x - before.x, mz = after.z - before.z, moved = Math.hypot(mx, mz), away = (mx * before.fx + mz * before.fz) / Math.max(1e-6, moved * Math.hypot(before.fx, before.fz));
      t.check(`${where}: up on the stick walks her away from the camera (moved ${moved.toFixed(2)} m, cos ${away.toFixed(2)})`, moved < 0.3 || away > 0.5, JSON.stringify({ before, after }));
    };

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "cruise starts")) return;
    await playing();
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);

    // 🛋️ HOUSES: nothing blocks a way in (the owner: "a tv blocks some of the entrances to some rooms"). Every house
    // shape × many seeds — strangers' / neighbours' houses (features/homes), her own homes + viewings (features/realestate,
    // 2 and 3 rooms, viewing + owner), Ima's house (features/decor) — is built, then a probe floods the floor from the
    // front door (her size, the room's own collisions, nobody standing in the way): every room and every ✋ spot must be
    // reached. The pieces the clear-doorway rule had to slide are logged (the offenders).
    const flood = () => g(`(() => {
      const r = window.__interiors.room, B = r.bounds, ppl = r.people; r.people = [];
      const S = 0.15, nx = Math.ceil((B.x1 - B.x0) / S) + 1, nz = Math.ceil((B.z1 - B.z0) / S) + 1;
      const ok = (x, z) => { const p = { x, z }; r.collide(p, 0.32); return Math.hypot(p.x - x, p.z - z) < 0.02; };
      const st = new Int8Array(nx * nz).fill(-1), at = (i, k) => st[i * nz + k] < 0 ? (st[i * nz + k] = ok(B.x0 + i * S, B.z0 + k * S) ? 1 : 0) : st[i * nz + k];
      const seen = new Uint8Array(nx * nz), q = [];
      const d = r.spots.door; let si = Math.round((d.x - B.x0) / S), sk = Math.round((Math.min(d.z, B.z1) - B.z0) / S);
      for (let tries = 0; tries < 40 && !at(si, sk); tries++) sk--;
      if (at(si, sk)) { seen[si * nz + sk] = 1; q.push([si, sk]); }
      while (q.length) { const [i, k] = q.pop(); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i2 = i + a, k2 = k + b; if (i2 < 0 || k2 < 0 || i2 >= nx || k2 >= nz || seen[i2 * nz + k2] || !at(i2, k2)) continue; seen[i2 * nz + k2] = 1; q.push([i2, k2]); } }
      const near = (x, z, rad) => { for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) if (seen[i * nz + k] && Math.hypot(B.x0 + i * S - x, B.z0 + k * S - z) <= rad) return true; return false; };
      const bad = [];
      for (const h of r.hots) { const who = h.track && h.who && r.byId[h.who], x = who ? who.p.obj.position.x : h.x, z = who ? who.p.obj.position.z : h.z; if (!near(x, z, Math.max(0.35, h.r - 0.05))) bad.push("✋" + h.id); }
      const V = r.data.V || {}, rooms = V.rooms || (V.cx ? V.cx.map((c, i) => ({ type: (V.kinds || [])[i] || "room" + i, x0: c - 3.1, x1: c + 3.1 })) : []);
      for (const rm of rooms) { let hit = false; for (let i = 0; i < nx && !hit; i++) { const x = B.x0 + i * S; if (x < rm.x0 + 0.4 || x > rm.x1 - 0.4) continue; for (let k = 0; k < nz; k++) if (seen[i * nz + k]) { hit = true; break; } } if (!hit) bad.push("room " + rm.type); }
      r.people = ppl;
      return { bad, moved: V.moved || [], rooms: rooms.map(x => x.type).join("+") };
    })()`);
    const houseRun = async (label, setup, id) => {
      // (the real way in: on foot in town, through foot's hand-off — the same path the homes / real estate doors use)
      await onFoot();
      await g(`Promise.resolve(${setup}).then(() => { const F = ctx.foot.debug.F, n = ctx.world.road.nearest(F.pos.x, F.pos.z, F.s, {}); return ctx.foot.handoff(${JSON.stringify(id)}, { id: ${JSON.stringify(id)}, s: n.s, d: n.d, side: Math.sign(n.d) || 1 }); })`);
      if (!await t.until(`window.__interiors && __interiors.room && __interiors.room.ready`, `${label}: built`, 60000)) return null;
      await t.frames(2);
      const f = await flood();
      await g(`(__interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "footRun"`, `${label}: out`, 20000);
      return f;
    };
    await town("midwood");
    // (CI saw the page navigate away mid-houses: say where it went + the last words before it)
    const tail = [];
    t.page.on("console", m => { tail.push(`${m.type()}: ${m.text().slice(0, 160)}`); if (tail.length > 12) tail.shift(); });
    t.page.on("framenavigated", f => { if (f === t.page.mainFrame()) console.log(`  · NAVIGATED → ${f.url()}\n    last console: ${tail.join("\n      ")}`); });
    // (the house builders' modules, once: importing them from inside each call lost the page's context on CI)
    await t.L(`Promise.all([import("./js/features/homes/house.js"), import("./js/features/family/data.js"), import("./js/features/realestate/house.js")]).then(([homes, fam, re]) => { window.__dm = { homes, fam, re }; return true; })`);
    const offenders = new Map();
    const CASTS = [["dad", "mom"], ["dad", "mom", "boy"], ["bubbe", "dad", "mom", "baby"], ["zeidy", "girl"]];
    for (const cast of CASTS) for (let seed = 1; seed <= 10; seed++) {
      const home = { name: "Test", key: `test:${seed}:${cast.join("")}`, cast, seed: seed * 7919 };
      const f = await houseRun(`house ${cast.join(",")} #${seed}`, `window.__dm.homes.prepare(${JSON.stringify({ home, mode: "guest", via: "door", cast, noCatch: true })})`, "home");
      if (!f) continue;
      for (const m of f.moved) offenders.set(`${m} (${f.rooms})`, (offenders.get(`${m} (${f.rooms})`) || 0) + 1);
      t.check(`house ${f.rooms} [${cast.join(",")}] seed ${seed}: every room + ✋ reachable from the front door`, !f.bad.length, f.bad.join(", "));
    }
    // Fayge's basement (features/family: the homes builder with a fixed layout) + a neighbour family's house
    for (const [label, extra] of [["Fayge's basement", "fayge"], ["the neighbours", "neighbour"]]) for (let seed = 1; seed <= 3; seed++) {
      const setup = extra === "fayge"
        ? `((d, m) => m.prepare({ home: { name: d.FAYGE.name, key: "test:fayge" + ${seed}, cast: d.FAYGE.cast.slice(), seed: ${seed * 131}, rooms: d.FAYGE.rooms, palette: d.FAYGE.palette, basement: true, names: Object.assign({}, d.FAYGE.names) }, mode: "guest", via: "door", cast: d.FAYGE.cast.slice(), noCatch: true }))(window.__dm.fam, window.__dm.homes)`
        : `window.__dm.homes.prepare(${JSON.stringify({ home: { name: "Neighbour", key: "test:nb" + seed, cast: ["dad", "mom", "girl", "boy"], seed: seed * 313, neighbour: true, traits: ["hosts", "bakers"] }, mode: "guest", via: "door", cast: ["dad", "mom", "girl", "boy"], noCatch: true })})`;
      const f = await houseRun(`${label} #${seed}`, setup, "home");
      if (!f) continue;
      for (const m of f.moved) offenders.set(`${m} (${label}: ${f.rooms})`, (offenders.get(`${m} (${label}: ${f.rooms})`) || 0) + 1);
      t.check(`${label} [${f.rooms}] seed ${seed}: every room + ✋ reachable from the front door`, !f.bad.length, f.bad.join(", "));
    }
    for (const n of [2, 3]) for (const mode of ["viewing", "owner"]) {
      const rec = { id: `test:re${n}`, rooms: n, address: "1 Test St" };
      const f = await houseRun(`her home ${n} rooms (${mode})`, `window.__dm.re.nameHouse(${JSON.stringify(rec)}, ${JSON.stringify(mode)})`, "realestateHouse");
      if (f) t.check(`real estate ${n} rooms (${mode}): every room + ✋ reachable from the front door`, !f.bad.length, f.bad.join(", "));
    }
    {
      const f = await houseRun("Ima's house", `0`, "luluHome");
      if (f) t.check(`Ima's house: every room + ✋ reachable from the front door`, !f.bad.length, f.bad.join(", "));
    }
    console.log("  · the clear-doorway rule slid: " + ([...offenders].map(([k, v]) => `${k} ×${v}`).join(" · ") || "nothing"));
    if (process.env.DOORS_ONLY === "houses") return;

    const ROOMS = new Set(["precinct", "court", "hospital", "shul", "cityhall", "bank", "pizza", "bakery", "clothes", "realty"]);
    for (const id of ["midwood", "lakewood"]) {
      if (!await town(id)) continue;
      await onFoot();
      await t.frames(30);
      const doors = await findDoors();
      console.log(`  · ${id}: ${doors.length} doors — ${doors.map(d => d.name).join(", ")}`);
      t.check(`${id}: the town's doors are found (${doors.length})`, doors.length >= 8, doors.map(d => d.name).join(","));
      for (const d of doors) {
        const miss = await probe(d.i, d.at, [-1.2, 0, 1.2], [-1.2, 0, 2.4]);
        t.check(`${id} ${d.name}: ✋ shows across the doorway, step → kerb`, miss.length === 0, miss.join(" | "));
      }
      // strangers' front doors: a sample (a duplex has two doors side by side → narrower: ±0.6 along the street)
      const hi = await g(`ctx.foot.spots().findIndex(s => s.short === "HOUSE")`);
      // (the houses whose door is the homes ✋ — not her own / one for sale: those are real estate's)
      const homes = await g(`(() => { const F = ctx.foot.debug.F, s = ctx.foot.spots()[${hi}]; if (!s || !ctx.homes || !ctx.homes.homes) return [];
        return ctx.homes.homes().filter(h => h.ap && h.ap.nx != null).filter(h => { F.pos.set(h.ap.x, 0.05, h.ap.z); return !!s.pos(); }).slice(0, 60).filter((h, k) => k % 10 === 0).map(h => h.ap); })()`);
      t.check(`${id}: strangers' houses have doors to test (${homes.length})`, homes.length >= 3 && hi >= 0);
      for (const [k, ap] of homes.entries()) {
        const miss = await probe(hi, ap, [-0.6, 0, 0.6], [-0.4, 0.6, 1.8]);
        t.check(`${id} house ${k}: ✋ shows across the front path`, miss.length === 0, miss.join(" | "));
      }
      // …and every building door actually opens: in, then out again
      for (const d of doors.filter(d => ROOMS.has(d.name))) {
        await onFoot();
        await g(`(() => { const F = ctx.foot.debug.F, a = ${JSON.stringify(d.at)}; F.peds.length = 0; F.pos.set(a.x + a.nx * 1.4, 0.05, a.z + a.nz * 1.4); return true; })()`);
        await t.frames(4);
        const lbl = await g(`(() => { const pr = ctx.foot.debug.interactables(); if (!pr || pr.kind !== "spot") return "nothing"; pr.ent.act(); return pr.label; })()`);
        const inside = await t.until(`__lulu3d.state !== "footRun"`, `${id} ${d.name}: went in (${lbl})`, 60000);
        t.check(`${id} ${d.name}: walking up + ✋ goes in (${lbl})`, inside);
        if (!inside) continue;
        await t.until(`!window.__interiors || !__interiors.room || __interiors.room.ready`, `${id} ${d.name}: the room is up`, 60000);
        if (await g(`!!(window.__interiors && __interiors.room && __interiors.room.ready)`)) await insideChecks(`${id} ${d.name}`);
        await g(`(window.__interiors && __interiors.room ? __interiors.room.leave() : 0, true)`);
        t.check(`${id} ${d.name}: and back out on foot`, await t.until(`__lulu3d.state === "footRun"`, `${id} ${d.name}: out`, 30000));
        await t.frames(10);
      }
    }

    // 🚶‍♀️ stage 2 — NO CUT: walking into a public doorway is going in (no ✋, no fade, no black), walking back out of the
    // room's door is coming out (on the pavement, facing away, still walking). A probe on the frames: the soft-cut
    // overlay / the fades never show, and the picture never goes black.
    const curtain = () => t.L(`(() => { const o = []; for (const id of ["softCut", "townFade", "intFade", "lawFade", "cameosFade"]) { const e = document.getElementById(id); if (e && e.offsetParent !== null && +getComputedStyle(e).opacity > 0.05) o.push(id); } return o.join(","); })()`);
    const WALK_IN = ["shul", "pizza", "bank", "cityhall", "precinct"];
    if (await town("midwood")) {
      await onFoot();
      const doors = (await findDoors()).filter(d => WALK_IN.includes(d.name));
      for (const d of doors) {
        await onFoot();
        await g(`(() => { const F = ctx.foot.debug.F, a = ${JSON.stringify(d.at)}; F.peds.length = 0; F.pos.set(a.x + a.nx * 0.6, 0.05, a.z + a.nz * 0.6); F.vel.set(0, 0, 0);
          F.lulu.obj.rotation.y = Math.atan2(-a.nx, -a.nz); F.camFree = true; ctx.cam.free.yaw = Math.atan2(-a.nx, -a.nz); return true; })()`);
        await t.frames(30);          // (standing by the door: the room is warmed)
        await t.until(`(() => { const s = __lulu3d.ctx.foot.spots()[${d.i}]; const r = __lulu3d.ctx.interiors[s.walkIn.id]; return r.ready(); })()`, `${d.name}: the room is ready before she reaches the door`, 60000);
        await t.stick(0, -1);
        let seen = "", went = false;
        for (let k = 0; k < 90 && !went; k++) { await t.frames(2); const c = await curtain(); if (c) seen = c; went = await st() === "interior"; }
        await t.stick(0, 0);
        t.check(`midwood ${d.name}: walking into the doorway goes in (no ✋)`, went);
        t.check(`midwood ${d.name}: no fade / curtain on the way in`, !seen, seen);
        if (!went) continue;
        await t.until(`window.__interiors && __interiors.room && __interiors.room.ready`, `${d.name}: inside`, 20000);
        // …and out: walk away from the door 2.5 m (arms it), then back into it
        const out = await room(`(() => { const ds = r.spots.door; return ds && r.out ? { x: ds.x, z: ds.z, ox: r.out.x, oz: r.out.z } : null; })()`);
        t.check(`midwood ${d.name}: the room knows its way out`, !!out);
        if (!out) { await g(`(__interiors.room.leave(), true)`); await t.until(`__lulu3d.state === "footRun"`, "out", 30000); continue; }
        await room(`(r.lulu.obj.position.set(${out.x} - ${out.ox} * 2.6, 0, ${out.z} - ${out.oz} * 2.6), r.lulu.obj.rotation.y = Math.atan2(${out.ox}, ${out.oz}), ctx.cam.free.yaw = Math.atan2(${out.ox}, ${out.oz}), true)`);
        await t.frames(6);
        await t.stick(0, -1);
        seen = ""; went = false;
        for (let k = 0; k < 120 && !went; k++) { await t.frames(2); const c = await curtain(); if (c) seen = c; went = await st() === "footRun"; }
        t.check(`midwood ${d.name}: walking out of the door comes out`, went);
        t.check(`midwood ${d.name}: no fade / curtain on the way out`, !seen, seen);
        if (!went) { await t.stick(0, 0); await g(`(window.__interiors.room && __interiors.room.leave(), true)`); await t.until(`__lulu3d.state === "footRun"`, "out", 30000); continue; }
        await t.frames(4);
        const o = await g(`(() => { const F = ctx.foot.debug.F, a = ${JSON.stringify(d.at)}; return { sp: Math.hypot(F.vel.x, F.vel.z), n: (F.pos.x - a.x) * a.nx + (F.pos.z - a.z) * a.nz, face: Math.sin(F.lulu.obj.rotation.y) * a.nx + Math.cos(F.lulu.obj.rotation.y) * a.nz }; })()`);
        await t.stick(0, 0);
        t.check(`midwood ${d.name}: out on the pavement, facing away from the door, walking (${JSON.stringify(o)})`, o.face > 0.5 && o.sp > 0.5 && o.n > -2.6);
        await t.frames(30);
      }
    }

    // the ✋ button on a phone: big, and nothing on top of it
    for (const [name, w, h] of [["phone", 412, 915], ["phone-land", 667, 375]]) {
      await t.page.setViewportSize({ width: w, height: h });
      await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
      await onFoot();
      await t.frames(12);
      const b = await t.L(`(() => { const e = document.getElementById("tx_foot_hand"); if (!e || e.offsetParent === null) return null; const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom, iw: innerWidth, ih: innerHeight, covered: !!top && !e.contains(top) ? (top.id || top.className || top.tagName) : "" }; })()`);
      t.check(`${name}: the ✋ button is shown on foot`, !!b);
      if (!b) continue;
      t.check(`${name}: the ✋ button is big (≥ 80 px: ${Math.round(b.w)} × ${Math.round(b.h)})`, b.w >= 80 && b.h >= 80);
      t.check(`${name}: the ✋ button is on screen`, b.l >= 0 && b.t >= 0 && b.r <= b.iw && b.b <= b.ih);
      t.check(`${name}: nothing covers the ✋ button`, !b.covered, b.covered);
      await t.shot(`doors-hand-${name}`);
    }
    await t.page.setViewportSize({ width: 1280, height: 720 });
  },
};
