// Look test › Lulu's movement: the same little routine (stand, walk, run, stop, turn) filmed frame by frame from the
// same tracking camera, today (no flag) and with ?look=2 — then glued side by side into one clip.
//   NODE_PATH=/opt/node-tools/node_modules node scripts/looktest/walk.js        (→ 3d/docs/looktest/walk-*.mp4)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const L = require("./lib.js");

const FPS = 15;                          // one picture every 2 game frames (the game runs 30 frames a game second)
const SCRIPT = [                         // [seconds, keys held, label]
  [1.6, [], "standing"],
  [2.6, ["KeyW"], "walking"],
  [2.4, ["KeyW", "ShiftLeft"], "running"],
  [1.4, [], "stopping"],
  [2.6, ["KeyW", "KeyD"], "walking + turning"],
  [2.0, ["KeyW", "ShiftLeft", "KeyA"], "running + turning"],
  [1.2, [], "stopping"],
];

async function film(look, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const s = await L.open({ query: look ? "&look=2" : "", viewport: { width: 960, height: 540 }, scale: 1 });
  await L.toMidwood(s, ["Avenue J", 150, 1.75]);
  await s.g(`ctx.foot.start("droveOff")`);
  await s.until(`__lulu3d.state === "footRun"`, "on foot");
  await s.frames(90);                                 // (the hop out of the car finishes)
  await L.timeOfDay(s, "noon");
  await L.clean(s);
  await s.g(`(ctx.car.obj.visible = false, true)`);  // (the parked car would block the side view)
  await L.pinCamera(s, { pos: [5.2, 1.5, 1.2], look: [0, 0.85, 0.4], fov: 42, follow: "foot" });
  let n = 0;
  const info = [];
  await s.g(`(ctx.hold = true, true)`);
  for (const [sec, keys, label] of SCRIPT) {
    for (const k of ["KeyW", "KeyA", "KeyD", "ShiftLeft"]) await s.page.keyboard.up(k);
    for (const k of keys) await s.page.keyboard.down(k);
    const steps = Math.round(sec * FPS);
    for (let i = 0; i < steps; i++) {
      await s.g(`(ctx.hold = false, true)`);
      await s.frames(2);
      await s.g(`(ctx.hold = true, true)`);
      await s.page.screenshot({ path: path.join(dir, `f${String(n++).padStart(4, "0")}.png`) });
      if (i === 0) info.push({ label, frame: n - 1 });
    }
  }
  const stats = await L.info(s);
  console.log(look ? "after" : "before", "errors:", s.errors.slice(0, 2), stats);
  await s.close();
  return info;
}

(async () => {
  const tmp = process.env.LOOK_TMP || "/tmp/looktest-frames";
  const out = L.OUT;
  fs.mkdirSync(out, { recursive: true });
  const marks = await film(false, path.join(tmp, "before"));
  await film(true, path.join(tmp, "after"));
  const enc = (d, file) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(d, "f%04d.png"),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-movflags", "+faststart", file]);
  enc(path.join(tmp, "before"), path.join(out, "walk-before.mp4"));
  enc(path.join(tmp, "after"), path.join(out, "walk-after.mp4"));
  // side by side: before | after
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(out, "walk-before.mp4"), "-i", path.join(out, "walk-after.mp4"),
    "-filter_complex", "[0:v][1:v]hstack=inputs=2[v]", "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-movflags", "+faststart",
    path.join(out, "walk-side-by-side.mp4")]);
  fs.writeFileSync(path.join(out, "walk-marks.json"), JSON.stringify(marks.map(m => ({ label: m.label, at: +(m.frame / FPS).toFixed(1) })), null, 1));
  console.log("clips in", path.relative(L.ROOT, out));
})().catch(e => { console.error(e); process.exit(1); });
