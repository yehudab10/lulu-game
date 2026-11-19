// 🎵 Music (audio.js setMusic): ONE song at a time.
//   • a change of track is a short crossfade — and when it's over only the new track is sounding
//   • on an iPhone a page can't set a song's volume (a set reads back for a moment, then it's 1 again): there the
//     switch is instant, and the old track STOPS. (The bug this guards: the fade waited for a volume that never came
//     down, so every "faded out" track kept playing under the next — parking, then driving, then walking… a pile-up.)
//   • the real game flow (drive → parking lot → back on the road → on foot → back in the car) never has two songs
//     sounding once a switch has settled
const AUDIO = `import("./js/audio.js")`;
module.exports = {
  name: "music",
  query: "",
  save2d: { totalCoins: 100, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    const wait = ms => t.L(`new Promise(r => setTimeout(() => r(true), ${ms}))`);
    const now = () => t.L(`${AUDIO}.then(m => m.musicPlaying())`);
    const set = src => t.L(`${AUDIO}.then(m => (m.setMusic(${JSON.stringify(src)}), true))`);
    const only = (st, src) => st.playing.length === 1 && st.playing[0].src === src && st.fading === 0;

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts")) return;
    await t.key("KeyL");                                           // (a real key press, one the game doesn't use: the browser lets audio play)
    await t.L(`${AUDIO}.then(m => (m.unlockAudio(), m.audio.musicOn || m.toggleMusic(), true))`);
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    await wait(400);
    let st = await now();
    if (!st.playing.length) { t.check("(this browser won't play audio: nothing to check)", true); return; }
    t.check("driving: one song", only(st, "../luludriving.mp3"), JSON.stringify(st));

    // ── a browser that can set volume: a crossfade, and then ONE song ──
    t.check("this browser can fade", st.canFade === true, JSON.stringify(st));
    await set("../parking.mp3");
    st = await now();
    t.check("a change of track crossfades (two songs for a moment)", st.playing.length === 2 && st.fading === 1, JSON.stringify(st));
    await wait(2000);
    st = await now();
    t.check("…and when it's over only the new song is sounding, at full level", only(st, "../parking.mp3") && Math.abs(st.playing[0].vol - 0.32) < 0.01, JSON.stringify(st));
    await set("../luludriving.mp3"); await set("../walking.mp3"); await set("../salon.mp3"); await set("../luludriving.mp3");
    await wait(2000);
    st = await now();
    t.check("four quick changes: still one song at the end", only(st, "../luludriving.mp3") && Math.abs(st.playing[0].vol - 0.32) < 0.01, JSON.stringify(st));

    // ── an iPhone: volume can't be set; a set reads back until the next task, then it's 1 again ──
    await t.L(`(() => { const tmp = new WeakMap();
      Object.defineProperty(HTMLMediaElement.prototype, "volume", { configurable: true,
        get() { return tmp.has(this) ? tmp.get(this) : 1; },
        set(v) { tmp.set(this, v); setTimeout(() => tmp.delete(this), 0); } });
      return true; })()`);
    await t.L(`${AUDIO}.then(m => (m.debugReprobe(), true))`);
    await wait(400);
    st = await now();
    t.check("iPhone: the game notices it can't set a song's volume", st.canFade === false, JSON.stringify(st));
    for (const src of ["../parking.mp3", "../luludriving.mp3", "../walking.mp3", "../luludriving.mp3", "../court.mp3"]) {
      await set(src);
      st = await now();
      t.check(`iPhone: → ${src.slice(3)} is the only song, at once`, only(st, src), JSON.stringify(st));
    }
    await wait(1200);
    st = await now();
    t.check("iPhone: …and it stays one song", only(st, "../court.mp3"), JSON.stringify(st));
    // even if the game had guessed wrong about this phone, a "fade" still ends (it counts its own steps)
    await t.L(`${AUDIO}.then(m => { m.debugReprobe(); return true; })`);
    await t.L(`(() => { const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "volume"); const tmp = new WeakMap();
      Object.defineProperty(HTMLMediaElement.prototype, "volume", { configurable: true, get() { return tmp.has(this) ? tmp.get(this) : 1; }, set(v) { tmp.set(this, v); } });
      window.__volBack = () => Object.defineProperty(HTMLMediaElement.prototype, "volume", d); return true; })()`);
    await wait(400);                                               // (the probe now believes volume works…)
    await t.L(`(() => { const tmp = new WeakMap(); Object.defineProperty(HTMLMediaElement.prototype, "volume", { configurable: true,
        get() { return tmp.has(this) ? tmp.get(this) : 1; }, set(v) { tmp.set(this, v); setTimeout(() => tmp.delete(this), 0); } }); return true; })()`);
    await set("../parking.mp3"); await set("../luludriving.mp3"); await set("../walking.mp3");
    await wait(1500);
    st = await now();
    t.check("a fade on a phone that can't fade still ENDS: one song", only(st, "../walking.mp3"), JSON.stringify(st));
    await t.L(`${AUDIO}.then(m => (m.debugReprobe(), true))`);
    await wait(400);

    // ── the real flow on that iPhone: the parking lot and back, out of the car and back in ──
    await set("../luludriving.mp3");
    await g(`(ctx.parking.start({}), true)`);
    await t.until(`__lulu3d.state === "parking"`, "the parking lot opens", 8000);
    await t.frames(10);
    st = await now();
    t.check("iPhone: pulling into the parking lot → only the parking song", only(st, "../parking.mp3"), JSON.stringify(st));
    await set("../luludriving.mp3");
    st = await now();
    t.check("iPhone: …and back to the driving song → only that", only(st, "../luludriving.mp3"), JSON.stringify(st));
  },
};
