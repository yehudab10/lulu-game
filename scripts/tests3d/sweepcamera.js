// 🎥 ci/sweep-camera (Shabbos fix sweep 2026-11-28): the camera never shows the player junk — a screen of leaves, the
// inside of a wall / a house / a block, a rail right in front of the lens, a jump. Notes: 3d/docs/sweeps/sweep-camera.md.
// On a phone held upright (390 × 844: the tall narrow view is where it's worst). The probe (scripts/lib/camjunk.js) casts
// rays from the camera into the real scene: `near` = the share of the screen within 1.6 m of the lens.
const W = require("../lib/qawatch.js");
const CJ = require("../lib/camjunk.js");

async function inTown(t, town) {
  const g = t.game;
  if (await g(`ctx.town.active && ctx.town.id === "${town}"`)) return true;
  if (await g(`ctx.town.active`)) { await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.leave("reset"), L3.setState("playing"), true)`); await t.frames(3); }
  await g(`(ctx.foot.active && ctx.foot.end("test"), L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.load("${town}"), true)`);
  await t.until(`__lulu3d.ctx.town.loaded("${town}")`, `${town}'s models load`, 120000);
  await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.enter({ town: "${town}", speed: 0 }), true)`);
  const ok = await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "${town}"`, `in ${town}`, 60000);
  await t.frames(10);
  return ok;
}
async function onFoot(t) {
  const g = t.game;
  if (await g(`ctx.foot.active && L3.state === "footRun"`)) return true;
  await g(`ctx.foot.start("droveOff", { noIntro: true })`);
  const ok = await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 20000);
  await t.frames(6);
  return ok;
}
/** Put her at (x, z) with the free camera looking along yaw (the camera sits behind her: opposite the yaw). */
async function standAt(t, x, z, yaw, pitch = null) {
  await t.game(`(() => { const f = ctx.foot.pos; f.set(${x}, 0.05, ${z}); ctx.foot.vel.set(0, 0, 0); ctx.foot.obj.position.copy(f);
    const F = ctx.cam.free; F.yaw = ${yaw}; ${pitch == null ? "" : `F.pitch = ${pitch};`} F.idle = 0; ctx.cam.snap && ctx.cam.snap();
    if (window.__qa) { window.__qa.cutF = ctx.frames + 12; window.__qa.last = null; } return true; })()`);
  await t.frames(3);
}

module.exports = {
  name: "sweepcamera",
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  query: "&enable=all",
  save2d: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts", 120000)) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    await W.install(t);
    await CJ.install(t);
    if (process.env.SWEEPCAM_NOSEE) await t.L(`import("./js/core/seethrough.js").then(m => { m.SEE.set = () => m.SEE.off(); return true; })`);     // (before / after pictures)
    const only = (process.env.SWEEPCAM_PARTS || "trees,doors,rooms,ribbon").split(",");

    // ── 1. street trees: walk past every street tree with the tree behind her (the camera's side) ──
    if (only.includes("trees")) for (const town of ["lakewood", "midwood"]) {
      if (!await inTown(t, town)) continue;
      if (!await onFoot(t)) continue;
      await W.reset(t);
      // every street tree near her chunk window: spots 3 m from the trunk on open ground, the camera looking from the tree to her
      const spots = await g(`(() => { const out = [], seen = new Set();
        for (const c of ctx.town.debug.S.T.colliders) { if (c.kind !== "tree" || c.r > 0.6 || c.off) continue;
          const k = Math.round(c.x) + "," + Math.round(c.z); if (seen.has(k)) continue; seen.add(k);
          for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4, x = c.x + Math.sin(ang) * 3, z = c.z + Math.cos(ang) * 3;
            if (window.__qa.solidAt(x, z, 0.3, -0.6)) continue;
            out.push({ x: +x.toFixed(2), z: +z.toFixed(2), yaw: ang, tx: c.x, tz: c.z }); break; } }
        return out; })()`);
      console.log(`   ${town}: ${spots.length} street-tree spots`);
      const bad = [];
      const N = Math.min(spots.length, +(process.env.SWEEPCAM_N || 16));
      for (let i = 0; i < N; i++) {
        const s = spots[Math.floor(i * spots.length / N)];
        await standAt(t, s.x, s.z, s.yaw);
        await t.frames(12);
        const p = await CJ.probe(t);
        if (i < 2) await t.shot(`tree-${town}-sample${i}`);
        if (p.near > 0.3 || (p.block && /leaves/.test(p.block))) { bad.push({ ...s, ...p }); if (bad.length <= 3) await t.shot(`tree-${town}-${bad.length}`); }
      }
      console.log("   bad:", JSON.stringify(bad.slice(0, 6)));
      t.check(`${town}: a street tree behind her never fills the screen / hides her (${N} trees)`, bad.length === 0, bad.length + " bad: " + JSON.stringify(bad.slice(0, 3)));
      W.check(t, `${town} street trees`, await W.report(t), ["nan", "flat", "underground", "inwall"]);
    }

    // ── 2. front doors: standing at a door (a building's, a stranger's house) with the camera behind her toward the street,
    //       turned ±0.9 rad, and facing away from the door (the camera between her and the house) ──
    const findDoors = () => g(`(() => {
      const F = ctx.foot.debug.F, list = ctx.foot.spots(), T = ctx.town.debug.S.T, out = [];
      for (const name of Object.keys(T.spots)) {
        const sp = ctx.town.spot(name);
        if (!sp || sp.nx == null) continue;
        F.pos.set(sp.x, 0.05, sp.z);
        list.forEach((s, i) => {
          if (!s.door || out.some(o => o.i === i)) return;
          let at = null; try { at = s.pos ? s.pos() : s; } catch (e) { return; }
          if (at && at.nx != null && Math.hypot(at.x - sp.x, at.z - sp.z) < 0.3) out.push({ name, i, at: { x: at.x, z: at.z, nx: at.nx, nz: at.nz } });
        });
      }
      return out;
    })()`);
    const homeDoors = n => g(`(() => { if (!ctx.homes || !ctx.homes.homes) return []; const H = ctx.homes.homes().filter(h => h.ap && h.ap.nx != null);
      return H.filter((h, k) => k % Math.max(1, Math.floor(H.length / ${n})) === 0).slice(0, ${n}).map(h => ({ name: "house " + (h.name || ""), at: { x: h.ap.x, z: h.ap.z, nx: h.ap.nx, nz: h.ap.nz } })); })()`);
    if (only.includes("doors")) for (const town of ["lakewood", "midwood"]) {
      if (!await inTown(t, town)) continue;
      if (!await onFoot(t)) continue;
      await W.reset(t);
      const doors = (await findDoors()).concat(await homeDoors(+(process.env.SWEEPCAM_HOMES || 12)));
      const bad = [];
      for (const d of doors) {
        const a = d.at, x = a.x + a.nx * 1.8, z = a.z + a.nz * 1.8, face = Math.atan2(-a.nx, -a.nz);
        for (const [lab, yaw] of [["at the door", face], ["at the door, turned left", face + 0.9], ["at the door, turned right", face - 0.9], ["back to the door", face + Math.PI]]) {
          await standAt(t, x, z, yaw);
          await t.frames(14);
          const p = await CJ.probe(t);
          if (p.near > 0.35 || (p.block && !(/Minivan|Car|Lod|Sedan|Truck|Bus/i.test(p.block) && p.bd > 3))) { bad.push({ town, door: d.name, lab, ...p }); if (bad.length <= 4) await t.shot(`door-${town}-${bad.length}`); }
        }
      }
      console.log(`   ${town}: ${doors.length} doors × 4 views; bad: ${JSON.stringify(bad.slice(0, 8))}`);
      t.check(`${town}: at ${doors.length} front doors the camera shows her (no wall / nothing filling the screen)`, bad.length === 0, bad.length + " bad: " + JSON.stringify(bad.slice(0, 4)));
      W.check(t, `${town} front doors`, await W.report(t), ["nan", "flat", "underground", "inwall"]);
    }

    // ── 3. rooms: in through the ✋ (buildings + a few strangers' houses), then at the door, in every corner, next to every
    //       person, at every ✋ hot-spot: the camera in the room, she's seen, nothing between, nothing filling the screen ──
    const room = expr => g(`(() => { const r = window.__interiors && window.__interiors.room; if (!r) return null; return ${expr}; })()`);
    const camIn = () => room(`(() => { const cam = r.set.camera, B = r.bounds, Lp = r.lulu.obj.position, v = Lp.clone().setY(1).project(cam);
        return { in: cam.position.x > B.x0 - 0.7 && cam.position.x < B.x1 + 0.7 && cam.position.z > B.z0 - 0.7 && cam.position.z < B.z1 + 0.7,
          seen: Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95 && v.z < 1, wall: r.debugBlocked ? r.debugBlocked() : "",
          behind: (() => { const f = { x: Math.sin(r.lulu.obj.rotation.y), z: Math.cos(r.lulu.obj.rotation.y) }, dx = Lp.x - cam.position.x, dz = Lp.z - cam.position.z, L = Math.hypot(dx, dz) || 1; return +((dx * f.x + dz * f.z) / L).toFixed(2); })() }; })()`);
    const ROOMS = new Set(["precinct", "court", "hospital", "shul", "cityhall", "bank", "pizza", "bakery", "clothes", "realty", "yeshiva", "lanes", "carsvc"]);
    if (only.includes("rooms")) for (const town of ["midwood", "lakewood"]) {
      if (!await inTown(t, town)) continue;
      if (!await onFoot(t)) continue;
      // (+ strangers' houses: built + entered the way foot's door hand-off does — doors.js' houseRun)
      await t.L(`import("./js/features/homes/house.js").then(m => { window.__hm = m; return true; })`);
      const CASTS = [["dad", "mom", "boy"], ["bubbe", "dad", "mom", "baby"], ["zeidy", "girl"]];
      const doors = (await findDoors()).filter(d => ROOMS.has(d.name)).concat(CASTS.map((cast, k) => ({ name: "house " + cast.join(","), house: { name: "Test", key: `test:cam${k}:${town}`, cast, seed: (k + 3) * 7919 } })));
      const bad = [];
      for (const d of doors) {
        await onFoot(t);
        await W.reset(t);
        let lbl = "";
        if (d.house) {
          lbl = d.name;
          await g(`Promise.resolve(window.__hm.prepare(${JSON.stringify({ home: d.house, mode: "guest", via: "door", cast: d.house.cast, noCatch: true })})).then(() => { const F = ctx.foot.debug.F, n = ctx.world.road.nearest(F.pos.x, F.pos.z, F.s, {}); return ctx.foot.handoff("home", { id: "home", s: n.s, d: n.d, side: Math.sign(n.d) || 1 }); })`);
        } else {
          const a = d.at;
          await g(`(() => { const F = ctx.foot.debug.F, a = ${JSON.stringify(a)}; F.peds.length = 0; F.pos.set(a.x + a.nx * 1.4, 0.05, a.z + a.nz * 1.4); F.vel.set(0, 0, 0);
            F.lulu.obj.rotation.y = Math.atan2(-a.nx, -a.nz); ctx.cam.free.yaw = Math.atan2(-a.nx, -a.nz); ctx.cam.snap(); return true; })()`);
          await t.frames(6);
          lbl = await g(`(() => { const pr = ctx.foot.debug.interactables(); if (!pr || pr.kind !== "spot") return "nothing"; pr.ent.act(); return pr.label; })()`);
        }
        if (!await t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready`, `${town} ${d.name}: in (${lbl})`, 60000)) {
          if (await g(`ctx.dialogOpen`)) await t.L(`(() => { const b = [...document.querySelectorAll("#dialog button")].pop(); if (b) b.click(); return true; })()`);
          continue;
        }
        await t.frames(30);
        const id = await room(`r.def.id`);
        const where = `${town} ${d.name} (${id})`;
        const look = async (lab, i) => {
          const c = await camIn(), p = await CJ.probe(t, { room: true });
          const fail = !c || !c.in || !c.seen || c.wall || !p || p.near > 0.35 || p.block;
          if (fail) { bad.push({ where, lab, c, p }); if (bad.length <= 8) await t.shot(`room-${id}-${i}`); }
          return c;
        };
        const c0 = await look("as she comes in", "in");
        if (c0 && c0.behind < 0.3) bad.push({ where, lab: "the camera isn't behind her as she comes in", c: c0 });
        await t.shot(`room-${id}-in`);
        const spots = await room(`(() => { const B = r.bounds, out = [];
          for (const [x, z] of [[B.x0 + 0.7, B.z0 + 0.7], [B.x1 - 0.7, B.z0 + 0.7], [B.x0 + 0.7, B.z1 - 0.7], [B.x1 - 0.7, B.z1 - 0.7]]) out.push({ lab: "corner", x, z, ry: Math.atan2((B.x0 + B.x1) / 2 - x, (B.z0 + B.z1) / 2 - z) });
          for (const q of r.people || []) { const P = q.p.obj.position, fy = q.p.obj.rotation.y; out.push({ lab: "facing " + (q.id || "someone"), x: P.x + Math.sin(fy) * 1.1, z: P.z + Math.cos(fy) * 1.1, ry: fy + Math.PI }); }
          for (const h of r.hots || []) if (h.x != null && h.id !== "door") out.push({ lab: "✋ " + h.id, x: h.x, z: h.z, ry: null });
          return out.slice(0, 14); })()`);
        for (const [i, s] of (spots || []).entries()) {
          await room(`(() => { const p = { x: ${s.x}, z: ${s.z} }; r.collide(p, 0.32); r.lulu.obj.position.set(p.x, r.groundAt(p.x, p.z), p.z); ${s.ry == null ? "" : `r.lulu.obj.rotation.y = ${s.ry}; ctx.cam.free.yaw = ${s.ry};`} return true; })()`);
          await t.frames(24);
          if (await g(`L3.state`) !== "interior") break;
          await look(s.lab, i);
        }
        await g(`(window.__interiors && __interiors.room ? __interiors.room.leave() : 0, true)`);
        await t.until(`__lulu3d.state === "footRun"`, `${where}: out`, 30000);
        await t.frames(6);
        W.check(t, `${where}: in + out`, await W.report(t), ["nan", "flat", "inwall", "jump"]);
      }
      console.log(`   ${town} rooms (${doors.length}); bad: ${JSON.stringify(bad.slice(0, 10))}`);
      t.check(`${town}: in every room (${doors.length}) at the door, the corners, next to people, at the ✋s the camera shows her`, bad.length === 0, bad.length + " bad: " + JSON.stringify(bad.slice(0, 5)));
    }

    // ── 4. the mayor's ribbon cutting (cityhall): it starts up her sidewalk — never inside a block of houses, where she'd
    //       walk to its ✋ and stand in a wall with the camera in the houses (cityhall's CI run: "Lulu stands inside block@-36,95") ──
    if (only.includes("ribbon")) for (const town of ["midwood", "lakewood"]) {
      if (!await inTown(t, town)) continue;
      if (!await onFoot(t)) continue;
      const starts = await homeDoors(18);
      const bad = []; let n = 0;
      for (const d of starts) {
        const a = d.at;
        await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${a.x + a.nx * 3}, 0.05, ${a.z + a.nz * 3}); F.vel.set(0, 0, 0); return true; })()`);
        await t.frames(3);
        const r = await g(`(() => { const D = ctx.cityhall.debug; D.endRibbon("test"); if (!D.startRibbon()) return null; const R = D.RUN.ribbon;
          const at = { x: R.x + R.nx * 1.2, z: R.z + R.nz * 1.2 }, q = window.__qa.solidAt;
          return { what: R.what, x: +R.x.toFixed(1), z: +R.z.toFixed(1), it: q(R.x, R.z, 0.3, 0.1), hand: q(at.x, at.z, 0.3, 0.1) }; })()`);
        if (!r) continue;
        n++;
        if (r.it || r.hand) bad.push(r);
      }
      await g(`(ctx.cityhall.debug.endRibbon("test"), true)`);
      t.check(`${town}: ${n} ribbon cuttings start on open pavement (never inside a block)`, n >= 5 && bad.length === 0, JSON.stringify(bad.slice(0, 4)));
    }
  },
};
