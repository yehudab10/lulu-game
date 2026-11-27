# Look test — how much better can the game look without changing engines?

Branch `ci/looktest`, 2026-11-27. Everything here is behind one switch, **`?look=2`**, and is off by default:
no flag = today's game exactly (the automated test `looktest` checks that). Saves and multiplayer are never touched.

**What the switch does:**

| link | what you see |
|---|---|
| `…/3d/?look=2` | everything: the improved car, Lulu with a skeleton, the new light |
| `…/3d/?look=2&car=kenney` | the free Kenney car instead of ours |
| `?look=2&car=0` · `&lulu=0` · `&light=0` · `&glow=0` · `&soft=0` | turn one piece off (today's car / Lulu / light / no glow / today's sharper shadows) |

All pictures use the same street (Avenue J in Midwood, by the bank and the college), the same camera and the same time
of day. They use the **MEDIUM** graphics setting, which is the one phones get, at 2× pixel density.

---

## 1. One car, three ways

| picture | what it shows |
|---|---|
| `car-front.jpg` | today · our model improved · Kenney's free model fitted — from the front |
| `car-rear.jpg` | the same from behind |
| `car-blue-dented.jpg` | each repainted blue and crashed 4 times (dents + the hubcap rolling away) |
| `car-kit.jpg` | each with a dealer body kit on |
| `car-<view>-today/ours/kenney.jpg` | each picture on its own, full size |

These pictures use **today's light**, so the car is the only thing that changes.

**Our model, improved** (`3d/blender/assets_looktest.py › build_good_car`, the same Blender-script route as every model
in the game). Same size, same wheel positions, same part names. It has a rounded body, real wheel arches with dark
insides, tyres with rounded sidewalls and tread, 5-spoke rims with a chrome lip and wheel nuts, chrome-ringed
headlights, amber indicators, a grille, wrap-around bumpers, door lines and handles, a dashboard with two dials, a
console, gear stick, seats with side bolsters and headrests, and carpet. Lulu at the wheel is unchanged.
**Verdict: clearly better.** It is still the same cartoon car, just finished properly.

**Kenney's free model** (CC0: free for anything, no credit needed). It is "sedan-sports" from Kenney's Car Kit 3.1.
Source and licence: `3d/assets/looktest_kenney.LICENSE.txt`. The original file is in `3d/blender/vendor/kenney_car-kit/`.
**Verdict: no better than today, and it isn't Lulu's car.** It is a closed coupé in the same simple blocky style as
our own models. Kenney's kit has no convertible, so Lulu disappears behind the roof.

**Game features that use the car** (checked by `scripts/looktest/car.js` → `car-hooks.json`):

| | today | ours | Kenney |
|---|---|---|---|
| 4 spinning wheels, front 2 steer | ✓ | ✓ | ✓ |
| steering wheel turns | ✓ | ✓ | ✓ (we added one) |
| repaint (all skins) | ✓ | ✓ | ✓ (only because we replaced its texture with plain colours) |
| dents + scratches + the hubcap | ✓ | ✓ (smoother dents: the body has more points) | ✓ |
| windscreen crack spot | ✓ | ✓ | ✓ (we added it) |
| tail lights brighten when braking | ✓ | ✓ | ✓ |
| the 9 attachment points (hats, decorations, passenger, mirrors…) | ✓ | ✓ | ✓, but a hat on Lulu's head pokes through the roof |
| dealer body kits | ✓ | ✓ | ✓ |
| Lulu visible at the wheel, salon hair | ✓ | ✓ | mostly hidden (closed roof, tinted glass) |
| what Kenney's model **loses** | | | Lulu on show, the convertible look, the LULU plate, an interior. Its wheels are bigger, so they look a little slow when spinning. Its shading is now flat colours (its texture was replaced so repainting works) |

**Cost of the car:**

| | today | ours | Kenney |
|---|---|---|---|
| triangles (model file) | 9,316 | 26,852 (×2.9) | 6,332 |
| parts drawn separately (each one is a draw call) | 31 | 40 | 22 |
| download size | 280 KB | 722 KB (+442 KB) | 212 KB |
| in the Midwood drive scene, whole screen | 139 draws, 105k triangles | 148 draws, 122k triangles | — |
| frame time, car + new Lulu on top of the new light | — | +2 % driving · +8 % on foot (the car is parked in view; most of it is the skinned Lulu) | not measured |

## 2. Lulu's movement

| clip | |
|---|---|
| `walk-side-by-side.mp4` | today on the left, the new Lulu on the right. Same 14-second routine, same camera: standing 0 s → walking 1.6 s → running 4.2 s → stopping 6.6 s → walking and turning 8 s → running and turning 10.6 s → stopping 12.6 s (`walk-marks.json`) |

Today Lulu is five stiff pieces: a body, two arms and two legs that swing like a toy's. The new Lulu
(`assets_looktest.py › build_rigged_lulu`, the game side is `3d/js/features/looktest/person.js`) has:
- a **real skeleton**: hips, spine, chest, neck, head, upper and lower arms, thighs, shins and feet. Knees and elbows
  bend, the hips sway and twist, the shoulders swing against the hips, and the skirt follows her legs a little;
- **three hand-made movements**: standing (breathing, shifting her weight, glancing around), walking and running;
- **smooth blending** between them by speed. Starting and stopping ease in and out, and the walk and run stay in step
  so her feet never stutter when she speeds up;
- a **lean into turns**;
- **every old pose still works** (wave, cheer, point, clap, sit, the jump, dance…). They use the same numbers as
  before, laid over the movement, and now sitting really bends her knees.

**Verdict: the biggest visible gain of the three.** She looks like a character, not a toy, especially when running.

**Does it break anything?**
- Her clothes: colour changes work (same material names). A coat or bag hangs on small attachment points on her spine
  and forearms, so it now moves with her elbow. *Not visually checked with a coat on.*
- Only the plain sheitel Lulu is upgraded. The salon hairstyles still use today's Lulu (each would need the same
  treatment). Scenes that copy the model directly instead of going through the normal spawn keep today's Lulu.
- Friends see the new Lulu too (party puppets use the same spawn).
- She now casts her shadow on her own instead of sharing the people's combined shadow (+3 shadow draws).

**Cost:** 6,724 triangles vs 5,740. Download 254 KB vs 113 KB (+141 KB, plus 9 KB of three.js's skeleton helper,
vendored from r170). 11 parts vs 17, so **fewer** draws. In the on-foot Midwood scene the JS time per frame went from 5.3 to 6.9 ms on this test machine, the most of any piece measured here.

## 3. One street's light

| picture | |
|---|---|
| `light-noon-wide.jpg` · `light-noon-low.jpg` | midday, today vs new light (two cameras) |
| `light-dusk-wide.jpg` · `light-dusk-low.jpg` | dusk, today vs new light |
| `light-*-today.jpg` / `light-*-light.jpg` | each picture full size |
| `everything-noon.jpg` · `everything-dusk.jpg` | everything on: light + car |

The new light (`3d/js/features/looktest/index.js`) has four parts:
- **sky light**: the sky (already made for the car's shine) lights every surface. Shadowed sides go a soft sky blue,
  undersides pick up the ground's colour, and glossy things reflect the sky;
- **softer shadow edges** (blurred instead of dithered);
- **colours that stay true**: a different "tone" step keeps the pinks pink (today's pushes them toward orange), and the sun is a touch warmer;
- **a glow** on lit windows, lamps, headlights and tail lights on MEDIUM too. Today only HIGH has it.

**Verdict, honestly:**
- **At midday the change is small.** Softer shadows and slightly more natural shading, but also a little cooler and
  flatter. Most people would not notice without the side-by-side.
- **At dusk it is a clear step up.** Windows glow warm, street lamps have a halo, the bricks keep their colour, and
  it feels like evening instead of a dark-blue filter.

**Cost of the light (the expensive part)**, MEDIUM, Midwood (driving / on foot):

| | frame time on this test machine* | draws incl. shadows + glow |
|---|---|---|
| today | 265 / 361 ms | 175 / 174 |
| + sky light + true colours only | 547 / 687 ms (**about ×2**) | 175 / 174 |
| + soft shadows | 567 / 694 ms | 233 / 289 (the shadows stop sharing draws — fixable) |
| + glow | 726 / 855 ms (glow ≈ +30 %) | 244 / 298 |
| + car + Lulu (everything) | 743 / 923 ms | 261 / 296 |

\* The test machine has no graphics chip, so the browser draws every pixel in software. That makes per-pixel effects
like the sky light and the glow look **far** more expensive than they are on a phone's graphics chip. Read the
numbers as "which piece costs most", not as phone frame rates. **The real answer needs one test on a real phone**:
the same `?look=2` link, with the in-game frame counter. Downloads: the light adds nothing.

## 4. Car bumps with a real physics library — skipped

Not cheap. It needs a physics engine (Rapier, about 2 MB, or cannon-es) and the car's crash and bump rules rewritten
on top of it. That is days of work, not a quick clip, so it was skipped as the brief allowed.

---

## Recommendation

1. **Lulu's skeleton and movements: yes, and do it for everyone.** All 74 people in the game come from ONE generator
   (`3d/blender/lib_people.py`), so the skeleton and the three movements can go into that generator once.
   The work: the generator + weights for every hat, beard and apron (~2 days), the game's person code (~1 day), then
   checking each feature's poses, friends' copies and phone speed (~2 days). **Watch-out:** the town crowds are drawn
   in big shared batches, and those can't use skeletons as they are. Crowds should stay as they are (they're small on
   screen), or use a cheaper "baked animation" trick later.
2. **The improved car: yes, for Lulu's car, and later the 4 everyday traffic cars** (sedan, van, truck, police car).
   About half a day each with the same script, a bit more to keep triangles down. The other ~20 special vehicles
   (buses, ambulances, ice-cream truck, taxi, minivans…) can follow over time.
3. **The light: the dusk / night glow, yes. The sky light: only after a phone test.** The cheap win is the glow plus
   the truer colours. Turn the sky light on for phones only if a real phone holds its frame rate. A cheaper middle
   way: sky light only on cars and people, as the car paint already does today. Soft shadows need their shadow
   sharing fixed first (~1 day). Interiors need their own light check.
4. **Don't use ready-made free cars for hero cars.** They look like our own models and lose what makes Lulu's car hers.
   Free packs are fine for background props.

## Could any of this only be done in another engine?

**No — everything shown here was done inside today's game, in a day.** Things Unity or Godot *would* make easier:
- a visual editor where an artist can place, light and animate by hand;
- an animation editor, and reuse of store-bought animations;
- baked "bounce" lighting for interiors;
- ready-made vehicle physics.

All four exist for the web too (Blender + three.js tools, Rapier physics), with more setup. What a rebuild would cost:
the whole game rewritten (≈130,000 lines in 62 features). A Unity web version downloads tens of MB before it starts and
runs poorly in iPhone Safari. And the iPhone app's over-the-air updates and the shared save are built on the web game.

## How to re-make all of this

```
python 3d/blender/make_assets.py --only looktest            # the 3 models (pip install bpy)
NODE_PATH=/opt/node-tools/node_modules node scripts/looktest/car.js      # car pictures + car-hooks.json
NODE_PATH=/opt/node-tools/node_modules node scripts/looktest/walk.js     # the walk clip
NODE_PATH=/opt/node-tools/node_modules node scripts/looktest/street.js   # light pictures
PERF3D_TIER=medium PERF3D_SCENES=middrive,midfoot PERF3D_QUERY="&look=2" node scripts/perf3d.js   # the costs
SMOKE3D_ONLY=looktest node scripts/smoke3d.js                # the switch works / stays asleep
```
