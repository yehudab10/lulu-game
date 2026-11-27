# Look test — how much better can the game look without changing engines?

Branch `ci/looktest`, 2026-11-27. Everything here is behind one switch, **`?look=2`**, and is off by default:
no flag = today's game exactly (the automated test `looktest` checks that). Saves and multiplayer are never touched.

The owner's rule: **new graphics and animation must still run well on devices.** So every upgrade here is measured on
three settings, and each gets one of three labels: **safe on phones**, **phones get the lighter version**, or
**strong devices only**. The three settings are the game's own graphics levels:
- **LOW**: weak phones, consoles and TVs.
- **MEDIUM**: what phones and tablets get on AUTO.
- **HIGH**: laptops and desktops.

## The answer in one table

| upgrade | what you see | weak phones (LOW) | phones (MEDIUM) | laptops (HIGH) | label |
|---|---|---|---|---|---|
| **Lulu with a skeleton** (knees, elbows, real walk / run / idle that blend) | the biggest visible gain | ✓ for her and up to 2 friends; anyone else stays today's Lulu | ✓, up to 10 at once | ✓ | **phones get the lighter version** |
| **Lulu's car, improved** | clearly better | the **lite** build, only on the car she drives | the full car for the one she drives; every other copy is the lite build | full everywhere | **phones get the lighter version** |
| **Kenney's free car** | no better than today; Lulu hidden | — | — | — | **not recommended** |
| **Truer colours + warmer sun** | small; pinks stay pink | ✓ | ✓ | ✓ | **safe on phones** (costs nothing) |
| **Softer shadow edges** | small | (LOW has no shadows) | ✓ | ✓ | **safe on phones** (same work as today's shadows) |
| **Sky light on everything** | small at noon; **clear step up at dusk** | ✗ | ✗ | ✓ | **strong devices only** (about +70 % frame time here) |

**Bottom line:** in an ordinary street, phones pay **+2 to 6 %** of a frame for all of this. The visible dusk
improvement is laptop-only. In a stress test far busier than the real game (30 extra Lulus + 12 extra copies of her
car), phones pay **+15 to 30 %** and weak phones **+20 to 50 %**. That is why phones get capped and lighter versions.
**Before anything rolls out, someone should play the `?look=2` link on a real phone for five minutes.** This test
machine draws everything in software, so its numbers are only good for comparing, and they wobble ±15–25 % from
run to run.

**What the switch does:**

| link | |
|---|---|
| `…/3d/?look=2` | everything, by graphics level as in the table |
| `?look=2&car=kenney` · `&car=lite` · `&car=0` | Kenney's car · the lite car everywhere · today's car |
| `&lulu=0` · `&light=0` · `&soft=0` | today's Lulu · today's light · today's shadow edges |
| `&sky=all` · `&glow=medium` | force the sky light / the bloom onto phones too (for testing on a real phone) |

---

## 1. One car, three ways (+ the lite build)

| picture | |
|---|---|
| `car-front.jpg`, `car-rear.jpg` | today · our model improved · Kenney's free model fitted |
| `car-blue-dented.jpg` | each repainted blue and crashed 4 times (dents + the hubcap rolling away) |
| `car-kit.jpg` | each with a dealer body kit |
| `car-front-ours-lite.jpg` (+ rear / dented / kit) | the improved car next to its **lite** phone build |
| `car-<view>-<today/ours/lite/kenney>.jpg` | each one full size |

These pictures use **today's light**, so the car is the only thing that changes.

**Our model, improved** (`3d/blender/assets_looktest.py`, the same Blender-script route as every model in the game).
Same size, same wheel spots, same part names. It has a rounded body, real wheel arches with dark insides, tyres with
rounded sidewalls and tread, 5-spoke rims, chrome-ringed lights, indicators, a grille, wrap-around bumpers, door lines
and handles, a dashboard with dials, seats with bolsters and headrests. **Clearly better.**

The **lite build** is the same script with fewer curves and no tiny interior bits. At game distance it is almost
indistinguishable (`car-front-ours-lite.jpg`).

**Kenney's free model** (CC0: free for anything, no credit needed; source + licence in
`3d/assets/looktest_kenney.LICENSE.txt`). **No better than today:** it's in the same simple style, and it's a closed
coupé, so Lulu disappears behind the roof.

**Game features that use the car** (checked by `scripts/looktest/car.js` → `car-hooks*.json`):

| | today | ours (full + lite) | Kenney |
|---|---|---|---|
| wheels spin, front 2 steer, steering wheel turns | ✓ | ✓ | ✓ (we added the steering wheel) |
| repaint, dents + scratches + hubcap, windscreen crack, brake lights | ✓ | ✓ | ✓ (only after we replaced its texture with plain colours) |
| the 9 attachment points, dealer body kits | ✓ | ✓ | ✓, but a hat on Lulu pokes through the roof |
| Lulu visible at the wheel, salon hair | ✓ | ✓ | mostly hidden |
| what it **loses** | | nothing | Lulu on show, the convertible look, the LULU plate, an interior, its own shading; its bigger wheels look slow when spinning |

**Cost:**

| | today | improved, full | improved, lite | Kenney |
|---|---|---|---|---|
| triangles | 9,316 | 26,852 | 14,586 | 6,332 |
| parts drawn separately (draw calls) | 31 | 40 | 39 | 22 |
| download | 280 KB | 722 KB | 428 KB | 212 KB |

**One full car costs almost nothing** (+2 % frame time driving). **Many copies do:** 12 full copies in view more than
doubled a weak phone's frame time in the first stress test. That is why phones get the lite build for copies, and weak
phones keep today's car for copies.

## 2. Lulu's movement

| clip / picture | |
|---|---|
| `walk-side-by-side.mp4` | today on the left, the new Lulu on the right. Same 14-second routine: standing 0 s → walking 1.6 s → running 4.2 s → stopping 6.6 s → walking and turning 8 s → running and turning 10.6 s → stopping 12.6 s. Filmed on MEDIUM with the first light settings, so the background light differs a little; look at her |
| `crowd-<low/medium/high>-<today/look>.jpg` | the stress test: 30 Lulus walking and running, and 12 copies of her car driving, in one street |

Today Lulu is five stiff pieces that swing like a toy's. The new Lulu has:
- **a real skeleton**: hips, spine, chest, neck, head, upper and lower arms, thighs, shins, feet. Knees and elbows
  bend, the hips sway and twist, the shoulders swing against the hips, and the skirt follows her legs a little;
- **three hand-made movements**: standing (breathing, shifting her weight, glancing around), walking and running;
- **smooth blending** by speed. Starting and stopping ease in and out, and walk and run stay in step;
- **a lean into turns**;
- **every old pose still works** (wave, cheer, point, clap, sit, jump, dance), with the same numbers as before.
  Sitting now bends her knees.

**The biggest visible gain of the three.**

**Kept light for phones:**
- far away she animates less often: every frame up close, every 2nd frame from 18 m, every 4th from 40 m, not at
  all when off screen;
- her shadow is **one** draw instead of 11;
- no shadow beyond 30 m;
- a **budget** of skinned Lulus: 3 on weak phones, 10 on phones. Her and her friends come first; anyone over the budget is today's Lulu.

**Does it break anything?**
- Clothes: colour changes work (same material names). Coats and bags hang on attachment points on her spine and forearms. *Not visually checked with a coat on.*
- The salon hairstyles still use today's Lulu (each would need the same treatment).
- Scenes that copy the model directly instead of going through the normal spawn keep today's Lulu.
- Her shadow only shows from the sun (indoor scenes with their own lamps would need the same one-line change).

**Cost:** 6,724 triangles vs 5,740. Download +141 KB, plus 9 KB of three.js's skeleton helper (vendored, r170). 11
parts vs 17, so fewer draws. Computer time is about +0.6–0.7 ms a frame per 10 skinned people.

## 3. One street's light

| picture | |
|---|---|
| `light-medium-noon-wide.jpg` · `light-medium-noon-low.jpg` · `light-medium-dusk-wide.jpg` · `light-medium-dusk-low.jpg` | **phones**: today vs the new light |
| `light-high-noon-*.jpg` · `light-high-dusk-*.jpg` | **laptops**: today vs the new light |

What each device gets:
- **truer colours and a warmer sun** (all devices): a different "tone" step keeps the pinks pink.
- **softer shadow edges** (phones and laptops): the same shadow work as today, just a wider blur.
- **the sky lights everything** (laptops only): shadowed sides get soft sky light, undersides pick up the ground's
  colour, glossy things reflect the sky. Laptops already have the glow on lamps and windows today.

**Honest verdict:**
- **On phones the light is barely different from today.** A touch warmer, slightly softer shadow edges. Free, but nobody will notice.
- **On laptops at noon:** a small change.
- **On laptops at dusk:** a clear step up. The building fronts are lit, the bricks keep their colour, and it has more depth.
- The first try put the sky light and the glow on phones too. That roughly doubled frame time on this machine (`perf/first-try/`), so it's laptop-only now.

## 4. Car bumps with a real physics library — skipped

Not cheap. It needs a physics engine (Rapier, about 2 MB) and the car crash rules rewritten on top of it.

---

## The numbers

Frame time is milliseconds per frame on this software-rendering test machine. Lower is better. Compare columns
within a row; don't read it as phone speed. On foot in Midwood (Avenue J), today → `?look=2` final settings.
Every run is in `perf/crowd-all-runs.json`.

| | weak phones (LOW) | phones (MEDIUM) | laptops (HIGH) |
|---|---|---|---|
| **ordinary street**, frame | 106 → 112–130 (+6 to +22 %) | 188 → 192–200 (+2 to +6 %) | 265 → 458 (+73 %, the sky light) |
| ordinary street, computer time / frame | 3.5 → 3.6–4.7 ms | 4.4–5.3 → 3.9–5.1 ms (same) | 5.0 → 5.4 ms |
| **stress test** (+30 Lulus, +12 cars), frame | 257 → 308–395 (+20 to +54 %) | 408–439 → 502–526 (+15 to +29 %) | 574 → 1010 (+76 %) |
| stress test, draw calls incl. shadows | 899 → 892–966 | 1166–1173 → 1145–1287 | 1206 → 1223 |
| stress test, triangles | 325k → 326k–370k | 327k–336k → 396k–414k | 334k → 547k |

**What the stress test still costs on phones** comes from the 10 skinned people (their skinning is done for every
point, every frame) and the 12 lite cars (+5k triangles each). The real game never shows 12 copies of Lulu's car or 30
Lulus at once. Today's town crowds are other people, and they are not upgraded here.

## Recommendation

Only what can stay smooth on a phone:
1. **Lulu's skeleton and movements, for Lulu (and friends), with the phone budget above.** Safe now.
   **Everyone else** (74 kinds of people, all from one generator, `lib_people.py`): the generator change is ~5 days,
   but **the town crowds stay as they are on phones**. Crowds are drawn in shared batches that skeletons can't use,
   and the stress test shows a crowd of skinned people is the expensive part. Skeleton crowds are laptop-only, or wait
   for a cheaper "baked animation" technique (more work, about a week).
2. **The improved car, full for the car she drives, lite for copies, today's for copies on weak phones.** Safe now.
   The 4 everyday traffic cars could follow, **lite builds only**, about half a day each.
3. **Truer colours + softer shadow edges: everywhere** (free).
4. **Sky light: laptops only.** It's where the dusk picture really improves, and phones can't afford it.
5. **Don't use free ready-made models for Lulu's car or other main characters.**

## Could any of this only be done in another engine?

**No — everything shown here was done inside today's game.** Including the phone-friendly versions: the lite model,
animating less when far away, the one-draw shadow and the budgets. These are the same techniques Unity or Godot games use on phones.

What those engines would add: a visual editor for artists, an animation editor and store-bought animations, baked
indoor lighting, and ready-made vehicle physics. A rebuild would mean rewriting ≈130,000 lines in 62 features. A Unity
web version downloads tens of MB and runs poorly in iPhone Safari. And the iPhone app's over-the-air updates and the
shared save are built on the web game.

## How to re-make all of this

```
python 3d/blender/make_assets.py --only looktest                          # the 4 models (pip install bpy)
NODE_PATH=/opt/node-tools/node_modules node scripts/looktest/car.js        # car pictures (CAR_VARIANTS=ours,lite for the lite pair)
NODE_PATH=/opt/node-tools/node_modules node scripts/looktest/walk.js       # the walk clip
NODE_PATH=/opt/node-tools/node_modules node scripts/looktest/street.js     # light pictures, phones + laptops
NODE_PATH=/opt/node-tools/node_modules node scripts/looktest/crowd.js      # the street + stress test on LOW / MEDIUM / HIGH
SMOKE3D_ONLY=looktest node scripts/smoke3d.js                              # the switch works / stays asleep
```
