# ci/sweep-camera — the camera never shows the player junk

Sweep agent notes (rules: `RULES.md`). Started 2026-11-28 09:05 UTC.

Scope: one flat colour, the inside of a house / tree / block, a wall or a rail between the camera and Lulu, a sudden
jump. `ci/doors` (camClip, room camera) LANDED and quiet since 02:22; `ci/sweep-phone` (room shoulder camera) PAUSED —
both areas are this sweep's now.

## Open cases at the start (from sweep-health / sweep-phone)
1. On foot in Lakewood: camera in a street tree's leaves (Feldmans' door), in a big trunk after an unstuck rescue, in block@38,38.
2. Rooms: qa27 hospital "the room went away" in a corner; Maison de Gelt rail; ~1.4 m behind her at a small room's door.
3. cityhall ribbon cutting: camera 5.3 m in one frame on foot.
4. Home → highway: camera inside her own lot's block for 8 frames.
5. unstuck's flat white at the rest area (intermittent).

## Camera map — who places the camera, and what each one knows about

| state / moment | owner | keeps out of |
|---|---|---|
| driving (chase / far chase) | `core/camera.js` updateCamera → `carClip` (= `cam.carClip`, set by `foot/index.js` carClipFn) | in a town, on her home street (first 160 m), **in a rest area's lot (new)**: `foot/jump.js` camClip (houses' circles ≥ 0.8 m, town block outlines + CAM_FRONT, big trunks, leaves' near edge); the airport's buildings (`airport/index.js` camClip). Highway elsewhere: nothing (nothing to hit) |
| driving, Lulu's eyes | camera.js (fp) | n/a (inside the car) |
| title | `world/home.js` titleCamera (the street shot) / camera.js orbit round the car | fixed shot |
| on foot (walk, hotwire, approach) | `foot/index.js` footCamera → `cam.orbit` (the FREE camera, player-turned) with clipCam = camClip | as the chase cam (+ open lots: her lot, Refael's car lot, driveways) |
| on foot, climbing out (intro) / arrested | footCamera → `cam.cinematic` (intro picks the clear side with camClip) | **now every `cam.cinematic` shot is clipped by `cam.carClip` (new)** |
| foot scripts (F.script.camera) + ~20 feature cutscenes (`cam.cinematic` / `cam.follow`: law arrest/bust, cameos crash/ER, heist, hustle getaway, community help, streets jack/paint, party, shabbos, journey trip/story, places/out, world/depart) | the feature | cinematic: clipped (new); follow: nothing (used by foot only when the free camera is off, and a friend's car) |
| rooms (state `interior`) | `interiors/engine.js` orbitCamera → `cam.orbit` with the room's own camera + `Room.camClip` (room box + ceiling + a ray against the room's shell meshes, **+ a ray from her chest (new)**), `fadeOccluders` (furniture-sized meshes between, **rays now from the lens to her chest + head (new)**), her own see-through when the lens is close (sweep-phone) | fixed-camera rooms / mini-games: `updateCamera` (no clip) |
| soft cuts | `cam.blend(s)` — the picture glides from the old pose to the rig's | **a glide that would pass through a wall now ends in a cut to the rig's pose (new)** |
| leaves + trunks + poles between the lens and her / the car | **`core/seethrough.js` (new)**: a dithered tube along the line of sight cuts them away (town merged scenery: flagged vertices; highway: the leaf look) | — |

## Findings + status

1. **A street tree between the camera and her filled a phone with leaves** (the Feldmans' door shot; any tree on the
   camera's side — on the sidewalk the camera is pulled in by the block's outline to exactly the street-tree line, so
   with a tree behind her the lens sat in its canopy or its trunk). Cause: camClip ignores leaves unless the lens' own
   spot is in a canopy (by design: pulling in for every tree popped), and its leaf check ran BEFORE the block clip moved
   the lens. Fix: leaves, tree trunks and lamp poles are cut away in a soft dithered tube along the line of sight
   (`core/seethrough.js`; town: `town/kit.js` flags those vertices; highway: `merge.js`' leaf look). The watchdog's
   "camera inside a tree's leaves" rule is off while the cut is on (the cut shows her). sweepcamera › trees: 16 + 16
   street trees in both towns, 0 bad (before: every one hid her). Screenshots: before/after in the scratchpad (see report).
2. **A glide through a wall** (home start from the title: the street shot → her on her lot, through the neighbours'
   house; qaweekend "home → highway" camera inside block@128,195 ×8): `cam.blend` stops at the wall and cuts to the
   rig's pose (`camera.js` applyBlend, `cam.cutFrame` for the watchdog).
3. **A lamp post right in front of the lens** at the yeshiva / the precinct (back to the door, the camera between her and
   the building): poles are in the see-through set.
4. **Rooms: the pizza oven's top filled a phone** (her in the corner by the oven, the camera squeezed above her looking
   down; the oven never faded — the fade ray started at her chest inside its first 0.35 m). The fade now casts from the
   lens to her chest + head (what faces the camera), and two lines (Maison de Gelt's thin rail slipped between).
5. **Rooms: the shul's merged tables (one big mesh, can't fade) between the lens and her body**: the room's clip also
   looks from her chest to the lens spot.
6. qa27 "the room went away": the corner shuffle walked her out of the Hatzalah door (the door working — the test's own
   comment says so); the test notes it instead of failing. (Its "at the door" camera sat in FRONT of her: checking.)
7. Rest area: the chase cam had no walls in a rest area's lot (backed into its building → one flat white:
   unstuck's intermittent flat). carClipFn now covers `ctx.exits.inside`.

## For other branches

## Left
