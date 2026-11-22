// 🏡 Homelife (features/homes, roadmap 15 — houses with something going on).
//   stage 0 — the real-estate hook + STABLE door ids:
//     • every door's id is "town:lx:lz" (the door in the town's own frame — the same scheme as ctx.realestate.keyOf)
//     • a landmark replacing a neighbour: every other door keeps its id AND its family
//     • ctx.homes.claim(fn): a claimed door has no household (status), no ✋ from homes, no knock / break-in, no porch scene
//     • moveOut / moveIn (saved); household(id) / householdAt(x, z) — "who lives here"
module.exports = {
  name: "homelife",
  viewport: { width: 1280, height: 720 },
  query: `&enable=homes,town,law,foot,atmos,interiors,seasons,memory`,
  save2d: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, pepperSpray: 3 },
  async run(t) {
    const g = t.game, D = `ctx.homes.debug`;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 300)); } };
    const inTown = async (town = "lakewood") => {
      if (await g(`ctx.town.active && ctx.town.id === "${town}"`)) return true;
      if (await g(`ctx.town.active`)) { await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.leave("reset"), L3.setState("playing"), true)`); await t.frames(3); }
      await g(`ctx.town.load("${town}")`);
      await t.until(`__lulu3d.ctx.town.loaded("${town}")`, `${town} models`, 90000);
      await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.enter({ town: "${town}", speed: 0 }), true)`);
      return t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.homes.crowd().on`, `in ${town} with its crowd`, 60000);
    };
    const onFoot = async () => {
      if (!await g(`ctx.foot.active && L3.state === "footRun"`)) { await g(`ctx.foot.start("droveOff", { noIntro: true })`); await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 20000); }
    };
    const toDoor = async key => {
      await onFoot();
      await g(`(() => { const h = ctx.homes.household(${JSON.stringify(key)}), f = ctx.foot.pos; f.set(h.ap.x, 0.05, h.ap.z); ctx.foot.obj.position.copy(f); return true; })()`);
      await t.frames(3);
    };

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(9999), ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), true)`);

    // ── stage 0: stable ids + the real-estate hook ──
    await step("ids", async () => {
      if (!await inTown("lakewood")) return;
      const r = await g(`(() => { const H = ctx.homes.homes(), P = ctx.town.plan;
        const same = H.every(h => { const L = P.local(h.door.x, h.door.z, {}); return h.key === "lakewood:" + Math.round(L.x) + ":" + Math.round(L.z); });
        return { n: H.length, uniq: new Set(H.map(h => h.key)).size, same, ex: H[0] && H[0].key }; })()`);
      t.check("door ids are town + position in the town's frame (= ctx.realestate.keyOf)", r.n > 40 && r.same, JSON.stringify(r));
      t.check("door ids are unique", r.uniq === r.n, JSON.stringify(r));
      // a landmark takes a lot: drop house #2 from the town's list, rebuild — nobody else moves
      const st = await g(`(() => { const before = ctx.homes.homes().map(h => h.key + "|" + h.name);
        const T = ctx.town.debug.S.T, gone = T.homes.splice(2, 1)[0]; ${D}.rebuild();
        const after = new Set(ctx.homes.homes().map(h => h.key + "|" + h.name));
        T.homes.splice(2, 0, gone); ${D}.rebuild();
        const kept = before.filter(k => after.has(k)).length;
        return { before: before.length, after: after.size, kept }; })()`);
      t.check("a landmark replaces a house: every other door keeps its id and its family", st.after < st.before && st.kept === st.after, JSON.stringify(st));
    });
    await step("claim", async () => {
      if (!await g(`ctx.town.active`)) return;
      const key = await g(`ctx.homes.homes()[5].key`);
      t.check("household(id): who lives here", await g(`(() => { const h = ctx.homes.household(${JSON.stringify(key)}); return !!(h && h.name && h.cast.length && h.status === null && /^the /.test(h.family)); })()`));
      t.check("householdAt(x, z): the nearest door's family", await g(`(() => { const h = ctx.homes.household(${JSON.stringify(key)}); const a = ctx.homes.householdAt(h.ap.x + 0.5, h.ap.z); return !!a && a.id === h.id; })()`));
      await toDoor(key);
      t.check("an ordinary door: homes' ✋", (await g(`${D}.spot()`) || {}).key === key);
      // real estate claims it (Lulu's own house)
      await g(`(window.__unclaim = ctx.homes.claim(id => id === ${JSON.stringify(key)} ? "mine" : null), ctx.homes.refresh(), true)`);
      await t.frames(3);
      t.check("claimed: status 'mine', livedIn false", await g(`ctx.homes.household(${JSON.stringify(key)}).status === "mine" && !ctx.homes.livedIn(${JSON.stringify(key)})`));
      t.check("claimed: no ✋ from homes at that door", !(await g(`${D}.spot()`)));
      t.check("claimed: no knock, no break-in", !(await g(`ctx.homes.knock(${JSON.stringify(key)})`)) && !(await g(`ctx.homes.enter(${JSON.stringify(key)}, "sneak", "window")`)));
      t.check("claimed: no porch scene at that door", await g(`!ctx.homes.debug.CR.peds.some(p => p.home && p.home.key === ${JSON.stringify(key)})`));
      await g(`(window.__unclaim(), ctx.homes.refresh(), true)`);
      await t.frames(2);
      t.check("unclaimed: the family's back", await g(`ctx.homes.livedIn(${JSON.stringify(key)})`) && (await g(`${D}.spot()`) || {}).key === key);
      // the family moves out (saved)
      t.check("moveOut: the house is empty", await g(`ctx.homes.moveOut(${JSON.stringify(key)}) && ctx.homes.household(${JSON.stringify(key)}).status === "moved" && !!ctx.homes.debug.S.moved[${JSON.stringify(key)}]`));
      t.check("moveIn: back again", await g(`ctx.homes.moveIn(${JSON.stringify(key)}) && ctx.homes.livedIn(${JSON.stringify(key)})`));
    });
  },
};
