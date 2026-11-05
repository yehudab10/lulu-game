// Dina's world: title → sister picker → school bus → the run home (hazards,
// sprint, Mom) → porch + medal → bedroom (Mom's hug, sticker book, Morgan, nap,
// Cookie Catch, the tablet) → back outside. Uses a PS5 DualSense layout.
const PS5 = "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)";
const save2d = () => `JSON.parse(localStorage.getItem("luluSaveV2") || "{}")`;

module.exports = {
  name: "dina",
  query: "&enable=dina",
  padId: PS5,
  save2d: { totalCoins: 200, ownedSkins: ["pink"], selectedSkin: "pink" },
  async run(t) {
    const S = async expr => t.L(`(() => { const s = ${save2d()}; return ${expr}; })()`);
    await t.frames(5);
    t.check("title lists 👧 Dina", await t.L(`[...document.querySelectorAll("#screenCard .btn")].some(b => /Dina/.test(b.textContent))`));

    // ── the sister picker ──
    await t.click(/Dina/);
    if (!await t.until(`__lulu3d.state === "dinaSelect"`, "Dina opens the sister picker")) return;
    t.check("Dina opens the sister picker", true);
    await t.frames(6);
    t.check("picker shows both sisters", await t.L(`!!document.querySelector("#dsLulu") && !!document.querySelector("#dsDina")`));
    t.check("Dina's card is focused", await t.L(`document.querySelector("#dsDina").classList.contains("focus")`));
    await t.shot("select");

    // ── the school bus ──
    await t.tap(0);
    if (!await t.until(`__lulu3d.state === "dinaBus"`, "✕ on Dina starts the bus intro")) return;
    t.check("✕ on Dina starts the bus intro", true);
    const busAt = async (sec, shot) => { await t.until(`__lulu3d.ctx.dina.debug.bus.t > ${sec}`, "bus intro reaches " + sec + " s"); await t.shot(shot); };
    await busAt(2.3, "bus-arrives");
    await busAt(5.3, "bus-girls");
    await busAt(6.4, "bus-wheres-mom");
    await busAt(7.45, "bus-hmph");
    await t.tap(0);   // skip
    if (!await t.until(`__lulu3d.state === "dinaRun"`, "✕ skips to the run")) return;
    t.check("✕ skips to the run", true);
    t.check("run #1 is saved (dinaRunsPlayed)", await S(`s.dinaRunsPlayed === 1`));

    // ── the run ──
    await t.hold(0, 1);    // hold ✕ = sprint
    const z0 = await t.game(`ctx.dina.run.z`);
    await t.frames(20);
    const z1 = await t.game(`ctx.dina.run.z`);
    t.check("holding ✕ sprints (×2 speed)", z1 - z0 > 20 / 30 * 4 * 1.6, `${(z1 - z0).toFixed(2)} m in 20 frames`);
    t.check("sprint drains the ⚡ meter", await t.game(`ctx.dina.run.dina.sprint < 3`));
    await t.hold(0, 0);
    await t.shot("run");
    // hazards: a dog right in front (+2 💰 + a long stumble), then the hopscotch (+1 sticker)
    const c0 = await t.game(`ctx.dina.run.coins`);
    await t.game(`ctx.dina.debug.spawn("dog", 1.2)`);
    await t.frames(12);
    t.check("the dog: +2 coins and a stumble", await t.game(`ctx.dina.run.coins`) === c0 + 2 && await t.game(`ctx.dina.run.dina.stumble > 0`));
    await t.shot("run-dog");
    await t.game(`ctx.dina.debug.spawn("hopscotch", 1.0)`);
    await t.frames(14);
    t.check("hopscotch: +1 sticker", await t.game(`ctx.dina.run.stickers`) === 1);
    await t.game(`ctx.dina.debug.spawn("greenblatt", 6)`);
    await t.frames(8);
    await t.shot("run-greenblatt");
    // finish line
    await t.game(`(ctx.dina.run.z = 179.5, ctx.dina.run.mom.distance = 1)`);
    if (!await t.until(`__lulu3d.state === "dinaCaught"`, "reaching home ends the run")) return;
    t.check("reaching home ends the run", true);
    const res = await t.game(`ctx.dina.run.result`);
    t.check("a win with a 10+ haul... or not: medal matches the 2D rule", res && res.won && res.medal === (res.haul >= 10 ? "gold" : "silver"), JSON.stringify(res));
    await t.frames(40);
    t.check("medal + best saved to the shared save", await S(`s.dinaMedals && s.dinaMedals["${res.medal}"] === 1 && s.dinaBest === ${res.haul}`));
    t.check("coins + stickers + win bonus banked", await S(`s.totalCoins`) === 200 + res.banked, `${await S(`s.totalCoins`)} vs ${200 + res.banked}`);
    await t.shot("porch");

    // ── race again: run #2 is harder, and this time Mom catches up ──
    await t.click(/Race home again/);
    if (!await t.until(`__lulu3d.state === "dinaRun"`, "'Race home again' restarts the run")) return;
    t.check("'Race home again' restarts the run", true);
    t.check("run #2 is harder (dinaDiff 1.12)", await t.game(`ctx.dina.run.level === 2 && Math.abs(ctx.dina.run.diff - 1.12) < 1e-9`));
    await t.game(`(ctx.dina.run.mom.distance = 0.12, ctx.dina.run.mom.sayTimer = 0.9)`);
    await t.frames(12);
    await t.shot("run-mom-close");
    await t.game(`ctx.dina.run.mom.distance = 0`);
    if (!await t.until(`__lulu3d.state === "dinaCaught"`, "Mom catching up ends the run")) return;
    const res2 = await t.game(`ctx.dina.run.result`);
    t.check("Mom caught up: no win bonus, still a medal", res2 && !res2.won && res2.winBonus === 0 && ["silver", "bronze"].includes(res2.medal), JSON.stringify(res2));
    await t.frames(30);
    await t.shot("porch-walked");

    // ── the bedroom ──
    await t.tap(0);
    if (!await t.until(`__lulu3d.state === "dinaHome"`, "✕ goes inside")) return;
    t.check("✕ goes inside", true);
    await t.frames(10);
    await t.shot("bedroom");
    // Mom pops in; walk up and hug her
    await t.game(`ctx.dina.home_.momCooldown = 0.05`);
    await t.frames(40);
    t.check("Mom pops in", await t.game(`!!ctx.dina.home_.momVisit`));
    await t.game(`ctx.dina.home_.dina.obj.position.set(-2.5, 0, -0.2)`);
    await t.frames(4);
    const w0 = await S(`s.totalCoins`);
    await t.tap(0);
    await t.frames(40);
    t.check("hugging Mom: +1 💰", await S(`s.totalCoins`) === w0 + 1, `${w0} → ${await S(`s.totalCoins`)}`);
    await t.shot("bedroom-mom");
    const at = (x, z) => t.game(`(ctx.dina.home_.momVisit = null, ctx.dina.home_.momCooldown = 999, ctx.dina.home_.mom.obj.visible = false, ctx.dina.home_.dina.obj.position.set(${x}, 0, ${z}))`);

    // ── the sticker book: pick ⭐ (💰1), steer it, stick it — saved in the SHARED stickerBook ──
    await at(2.2, 1.85);
    await t.frames(3);
    await t.tap(0);
    if (!await t.until(`__lulu3d.state === "dinaStickers"`, "✕ by the sticker book opens it")) return;
    t.check("✕ by the sticker book opens it", true);
    await t.frames(4);
    const n0 = await S(`(s.stickerBook || []).length`), m0 = await S(`s.totalCoins`);
    await t.tap(0);                       // pick the focused ⭐
    await t.frames(4);
    await t.stick(0.8, -0.5); await t.frames(10); await t.stick(0, 0);
    await t.tap(0);                       // stick it
    await t.frames(30);
    const sb = await S(`s.stickerBook`);
    const st = sb && sb[sb.length - 1];
    t.check("a sticker lands in the shared 2D stickerBook", sb && sb.length === n0 + 1 && st.e === "⭐" && st.x >= 40 && st.x <= 440 && st.y >= 110 && st.y <= 490, JSON.stringify(st));
    t.check("…and costs 💰1", await S(`s.totalCoins`) === m0 - 1);
    await t.shot("stickers");
    await t.tap(1);                       // ○ puts the held sticker back
    await t.tap(1);                       // ○ back to the room
    if (!await t.until(`__lulu3d.state === "dinaHome"`, "○ leaves the sticker book")) return;
    t.check("○ leaves the sticker book", true);

    // ── Morgan: belly rubs (+15) until she's 100% happy → +1 💰, back home ──
    await at(-3.2, 1.9);
    await t.frames(3);
    await t.tap(0);
    if (!await t.until(`__lulu3d.state === "dinaMorgan"`, "✕ by Morgan opens the plushie scene")) return;
    t.check("✕ by Morgan opens the plushie scene", true);
    await t.frames(6);
    await t.tap(13);                      // D-pad ↓ = belly
    await t.shot("morgan");
    const m1 = await S(`s.totalCoins`);
    for (let i = 0; i < 7; i++) await t.tap(0);
    await t.frames(4);
    await t.shot("morgan-happy");
    if (await t.until(`__lulu3d.state === "dinaHome"`, "Morgan at 100% → back to the room")) t.check("Morgan at 100% → back to the room", true);
    await t.frames(40);
    t.check("Morgan's celebration pays +1 💰", await S(`s.totalCoins`) === m1 + 1, `${m1} → ${await S(`s.totalCoins`)}`);

    // ── the nap ──
    await at(3.0, -0.95);
    await t.frames(3);
    await t.tap(0);
    if (!await t.until(`__lulu3d.state === "dinaNap"`, "✕ by the bed: nap time")) return;
    t.check("✕ by the bed: nap time", true);
    await t.frames(4);
    await t.shot("nap-tired");
    const m2 = await S(`s.totalCoins`);
    await t.tap(0);                       // tuck her in
    await t.frames(104);
    await t.shot("nap-asleep");
    await t.tap(0);                       // wake up
    if (await t.until(`__lulu3d.state === "dinaHome"`, "✕ wakes her up")) t.check("✕ wakes her up", true);
    await t.frames(40);
    t.check("the nap pays +1 💰", await S(`s.totalCoins`) === m2 + 1, `${m2} → ${await S(`s.totalCoins`)}`);

    // ── Cookie Catch (💰10 to play) ──
    await at(-2.15, 1.75);
    await t.frames(3);
    const m3 = await S(`s.totalCoins`);
    await t.tap(0);
    if (!await t.until(`__lulu3d.state === "dinaCookie"`, "✕ on cookie & milk starts Cookie Catch")) return;
    t.check("✕ on cookie & milk starts Cookie Catch", true);
    await t.frames(4);
    t.check("the 💰10 fee is paid", await S(`s.totalCoins`) === m3 - 10, `${m3} → ${await S(`s.totalCoins`)}`);
    await t.stick(-1, 0); await t.frames(10); await t.stick(0, 0);
    t.check("the stick slides the plate", await t.game(`ctx.dina.cookie.plateX < 240`));
    await t.frames(40);
    await t.shot("cookie");
    await t.game(`(ctx.dina.cookie.score = 23, ctx.dina.cookie.caught = 12, ctx.dina.cookie.timer = 0.05)`);
    if (await t.until(`!!document.querySelector("#screenCard .dina-profit")`, "time up shows the result")) t.check("time up shows the result", true);
    await t.frames(30);
    t.check("cookieBest saved", await S(`s.cookieBest`) === 23);
    t.check("the round's 💰23 is banked", await S(`s.totalCoins`) === m3 - 10 + 23, `${await S(`s.totalCoins`)}`);
    await t.shot("cookie-result");
    await t.click(/Head back/);
    if (!await t.until(`__lulu3d.state === "dinaHome"`, "head back to the room")) return;

    // ── the tablet: Lulu's game on Dina's tablet, and back ──
    await at(0.45, 1.65);
    await t.frames(3);
    await t.tap(0);
    if (await t.until(`["intro", "playing"].includes(__lulu3d.state)`, "the tablet starts Lulu's game")) t.check("the tablet starts Lulu's game", true);
    t.check("…inside Dina's tablet bezel", await t.L(`document.body.classList.contains("dina-tablet")`));
    await t.until(`__lulu3d.state === "playing"`, "countdown ends");
    await t.tap(9);
    t.check("pause offers 'Back to Dina's room'", await t.L(`[...document.querySelectorAll("#screenCard .btn")].some(b => /Dina's room/.test(b.textContent))`));
    await t.click(/Back to Dina's room/);
    if (await t.until(`__lulu3d.state === "dinaHome"`, "back in Dina's room")) t.check("back in Dina's room", true);

    // ── the door: back outside to the sister picker, ○ to the title ──
    await at(-4.0, -1.4);
    await t.frames(3);
    await t.tap(0);
    if (await t.until(`__lulu3d.state === "dinaSelect"`, "the door goes back outside")) t.check("the door goes back outside", true);
    await t.frames(4);
    t.check("the picker now offers 'Straight to Dina's room'", await t.L(`!!document.querySelector("#dsRoom")`));
    await t.tap(1);
    if (await t.until(`__lulu3d.state === "title"`, "○ returns to the title")) t.check("○ returns to the title", true);
    t.check("Dina's layer is cleaned up", await t.L(`document.getElementById("dinaLayer").classList.contains("off")`));

    // ── layouts: a phone held upright (touch) and TV mode ──
    await t.page.setViewportSize({ width: 390, height: 844 });
    await t.L(`__lulu3d.input.device = "touch"`);
    await t.click(/Dina/);
    if (!await t.until(`__lulu3d.state === "dinaSelect"`, "portrait: picker")) return;
    await t.frames(6);
    await t.shot("portrait-select");
    await t.click(/Straight to Dina's room/);
    if (await t.until(`__lulu3d.state === "dinaHome"`, "portrait: straight to Dina's room")) t.check("'Straight to Dina's room' works", true);
    await t.frames(8);
    t.check("portrait bedroom shows the touch stick", await t.L(`!document.getElementById("touch").classList.contains("hidden")`));
    await t.shot("portrait-bedroom");
    await t.game(`L3.setState("dinaRun")`);
    await t.frames(10);
    t.check("portrait run relabels the pedals SPRINT / SLOW", await t.L(`document.body.classList.contains("dina-run") && getComputedStyle(document.getElementById("tGas"), "::after").content.includes("SPRINT")`));
    await t.shot("portrait-run");
    await t.page.setViewportSize({ width: 1280, height: 720 });
    await t.L(`(__lulu3d.input.device = "gamepad", document.body.classList.add("tv"))`);
    await t.frames(8);
    await t.shot("tv-run");
    await t.L(`document.body.classList.remove("tv")`);
    await t.tap(9);
    await t.click(/Title/);
    if (await t.until(`__lulu3d.state === "title"`, "pause → title from the run")) t.check("pause → title from the run", true);
  },
};
