// 📝 A day in Lulu's life: a Cruise from home hands Ima's list (an errand at a real place, a job, something
// silly) — the same all day; each item ticks once (coins once a day), the HUD chip + a light column point the
// way; all done → "home for dinner": pulling into the driveway ends the day (+ the dinner bonus, once a day).
module.exports = {
  name: "day",
  query: "&enable=world,foot,day,banter",
  viewport: { width: 1280, height: 720 },
  save2d: { totalCoins: 100, cruiseUnlocked: true },
  async run(t) {
    const g = t.game;
    await t.frames(10);
    await g(`ctx.day.debug.date(20261119)`);
    const L0 = await g(`ctx.day.list()`);
    t.check("today's list: an errand, a job, something silly", L0.length === 3 && L0.every(x => !x.done), JSON.stringify(L0.map(x => x.id)));
    t.check("the same list all day (seeded by the date)", JSON.stringify(await g(`ctx.day.debug.date(20261119)`)) === JSON.stringify(L0.map(x => x.id)));
    const other = await g(`(() => { const out = new Set(); for (let d = 20261101; d < 20261131; d++) out.add(ctx.day.debug.date(d).join()); ctx.day.debug.date(20261119); return out.size; })()`);
    t.check("…and it changes from day to day", other >= 3, `${other} different lists in a month`);

    await t.click(/Cruise/);
    t.check("Cruise starts at home with the list", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.day.active`, "day on", 3000));
    await t.frames(40);
    const line = await g(`ctx.places.home.depart().line`);
    t.check("Ima reads out today's list at the door", /Today:/.test(line) || /RIGHT THERE/.test(line), line);
    t.check("the 📝 chip is on the HUD", /Ima's list 0\/3/.test(await g(`ctx.day.debug.chip()`)), await g(`ctx.day.debug.chip()`));
    await t.shot("list");

    // tick the three items through their real events
    const w0 = await g(`L3.wallet.coins`);
    const ids = L0.map(x => x.id);
    const it = await g(`ctx.day.ITEMS`);
    const all = [...it.errand, ...it.job, ...it.silly];
    for (const id of ids) {
      const d = all.find(x => x.id === id);
      if (d.kind === "place") await g(`L3.emit("world:visit", { id: "${d.place}", s: 1300 })`);
      else if (d.kind === "job") { await g(`L3.emit("hustle:end", { id: "cab", result: "fail" })`); await g(`L3.emit("hustle:end", { id: "cab", result: "pass", pay: 20 })`); }
      else for (let i = 0; i < d.n; i++) await g(`L3.emit("stat", { id: "${d.stat}", n: 1 })`);
      await t.frames(3);
      t.check(`✅ ${id} ticks off`, await g(`ctx.day.done("${id}")`));
    }
    const w1 = await g(`L3.wallet.coins`);
    t.check("each item pays once (3 × 15)", w1 - w0 === 45, `${w0} → ${w1}`);
    // a repeat doesn't pay again
    await g(`L3.emit("hustle:end", { id: "cab", result: "pass" })`);
    t.check("a repeat pays nothing", (await g(`L3.wallet.coins`)) === w1);
    t.check("all done → head home", await g(`ctx.day.complete && /Home for dinner/.test(ctx.day.debug.chip())`), await g(`ctx.day.debug.chip()`));
    await t.frames(4);
    t.check("the light column stands over the driveway", await g(`ctx.day.debug.beacon() || Math.hypot(ctx.car.pos.x - ctx.places.home.park.x, ctx.car.pos.z - ctx.places.home.park.z) < 6`));
    await t.shot("head-home");

    // drive off and come back: pulling into the driveway ends the day
    await g(`ctx.foot.debug.getIn()`);
    await t.until(`["worldPullOut", "playing"].includes(__lulu3d.state)`, "in the car", 3000);
    await g(`L3.setState("playing")`);
    await t.frames(4);
    await g(`(() => { const P = ctx.places.home.park; ctx.car.place(P.x + 30, P.z, P.h); ctx.car.vx = ctx.car.vz = 0; })()`);
    await t.frames(10);
    t.check("not home yet", !(await g(`ctx.day.home`)));
    await g(`(() => { const P = ctx.places.home.park; ctx.car.place(P.x, P.z, P.h); ctx.car.vx = ctx.car.vz = 0; })()`);
    t.check("home for dinner ends the day", await t.until(`__lulu3d.ctx.day.home`, "home", 3000));
    const w2 = await g(`L3.wallet.coins`);
    t.check("the dinner bonus (+40, once)", w2 - w1 === 40, `${w1} → ${w2}`);
    await t.frames(20);
    await t.shot("home-for-dinner");
    t.check("the chip is gone", !(await g(`ctx.day.active`)) && (await t.L(`!document.querySelector(".day-chip")`)));

    // the same day again: no new list, no pay
    await g(`L3.setState("title")`);
    await t.frames(4);
    await g(`ctx.places.debug.parkNow()`);
    await t.click(/Cruise/);
    await t.until(`__lulu3d.state === "footRun"`, "home again", 3000);
    t.check("same day again: nothing new to do", !(await g(`ctx.day.active`)));
    // tomorrow: a fresh list
    await g(`L3.setState("title")`);
    await t.frames(4);
    await g(`(ctx.day.debug.date(20261120), ctx.places.debug.parkNow())`);
    await t.click(/Cruise/);
    await t.until(`__lulu3d.state === "footRun"`, "tomorrow", 3000);
    t.check("tomorrow: a fresh list", (await g(`ctx.day.active`)) && (await g(`ctx.day.list().every(x => !x.done)`)));
    // not in Story / with quick starts
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    t.check("a quick start has no list", !(await g(`ctx.day.active`)));
  },
};
