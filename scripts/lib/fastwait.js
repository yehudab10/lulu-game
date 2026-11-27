// Waits under the FAST TEST CLOCK (3d/js/core/testclock.js; scripts/smoke3d.js turns it on per test file).
//
// A wait sets a GATE in the game — "stop at frame N" or "stop the first step this condition is true" — and the game
// runs flat out until it's hit, then holds right there until we've seen it and let go. Meanwhile every OTHER page of
// the same test (a friend's) runs flat out too, so a condition that needs the friend's game to move still comes true.
// Between waits each page keeps the old clock's pace (one step per ~133 ms), so the game time that passes between
// two test commands is what it always was.
const PAGES = new Set();
/** smoke3d: a fast page of the current test file (its own or a friend's). */
function track(page) { PAGES.add(page); page.on("close", () => PAGES.delete(page)); }

const pause = ms => new Promise(r => setTimeout(r, ms));
const ev = (page, code, fb) => page.evaluate(code).catch(() => fb);

/** → true (hit), false (gave up: frame budget / wall cap), null (no fast clock on this page: poll instead). */
async function gateWait(page, spec, maxFrames = 0, wallCap = Date.now() + 30 * 60000) {
  const f0 = await ev(page, `window.__lulu3d && __lulu3d.fast && __lulu3d.setGate ? __lulu3d.frames : -1`, -1);
  if (f0 < 0) return null;
  if (!await ev(page, `(__lulu3d.setGate(${spec}), true)`, false)) return null;
  const others = [...PAGES].filter(p => p !== page);
  await Promise.all(others.map(p => ev(p, `window.__lulu3d && __lulu3d.runAdd ? __lulu3d.runAdd(1) : 0`, 0)));
  try {
    for (;;) {
      const st = await ev(page, `[__lulu3d.gateHit(), __lulu3d.frames]`, [false, -1]);
      if (st[0]) return true;
      if ((maxFrames && st[1] >= 0 && st[1] - f0 > maxFrames) || Date.now() > wallCap) return false;
      await pause(8);
    }
  } finally {
    await ev(page, `__lulu3d.clearGate()`, 0);
    await Promise.all(others.map(p => ev(p, `window.__lulu3d && __lulu3d.runAdd ? __lulu3d.runAdd(-1) : 0`, 0)));
  }
}
/** Wait `n` game frames on `page`. → true / false / null (as gateWait). */
const framesGate = (page, n) => gateWait(page, `{ frames: ${Math.max(1, n | 0)} }`);
/** Wait for `code` (scope: L3 + ctx like party3d's waitOn; false = page globals like smoke3d's t.until). */
const untilGate = (page, code, maxFrames, wallCap, scope = true) => gateWait(page, `{ code: ${JSON.stringify(code)}, scope: ${!!scope} }`, maxFrames, wallCap);

module.exports = { track, gateWait, framesGate, untilGate, PAGES };
