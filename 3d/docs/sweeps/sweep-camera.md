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
6. **The roadside rooms (Trooper Post 7, the traffic court, the first-aid room, Hatzalah), the pizza shop, the bakery
   and the clothes shop: she walked in FACING THE DOOR**, the camera inside looking out at the street through the
   cut-away front, and "up" on the stick walked her straight back out (qa27's "the room went away" in a corner: the
   shuffle walked her out). Cause: a spot turned 180° reads back as 0° (`rotation.y` from a cloned quaternion spans
   ±90°; `lanes/room.js` had already worked round it). Her own spots (`lulu`, `door`) now read their true heading
   (`interiors/engine.js` yawOf); other spots keep the old reading (the sets' people were placed against it — see Left).
   qa27's corner loop notes a walk-out by the door instead of failing.
7. **Her see-through in a small room showed her face from behind** (a ghost staring back at the camera: the transparent
   head let the face show through). A depth-only twin of each faded part, drawn after the room's solids, keeps only her
   nearest surface (`fadeSelf`).
8. Rest area: the chase cam had no walls in a rest area's lot (backed into its building → one flat white:
   unstuck's intermittent flat). carClipFn now covers `ctx.exits.inside`.
9. **Cutscene / scene shots** (`cam.cinematic`: arrests, the crash, the ER, heists, getaways, the climb-out…) in a town
   could stand inside the houses: they're clipped by the same walls as the chase cam now.
10. cityhall's ribbon cutting: 36 starts in both towns never stand in a block (sweepcamera › ribbon); CI's "Lulu inside
    block@-36,95" + the 5.3 m camera move were the test's own teleport (R + n · 1.4) into a block's edge, then the
    camera coming out — not reproduced by the game's own placement; a glide through a wall is a cut now anyway (item 2).
11. sweepcamera's "Lakewood City Hall: Lulu moved 62 m in one frame" was the TEST teleporting her from the bank's door
    to city hall's without declaring it (fixed in the test; every building's walk-out lands at its door: › doorout).

Tests: `scripts/tests3d/sweepcamera.js` (parts: home, trees, doors, rooms, ribbon, doorout, roadside; `SWEEPCAM_PARTS`),
`scripts/lib/camjunk.js` (the probe: rays from the lens into the real scene — what's within 1.6 m of the lens, what
stands between the lens and her chest / head; knows the see-through cut).

## For other branches
- **✋ "💬 SAY HI" (a homes crowd pedestrian, `homes/crowd.js`) wins over a door / a parked car's HOTWIRE** when a
  townsperson happens to stand near: life3 "next to a parked car: ✋ HOTWIRE (got SAY HI)", sweepplaces
  "lakewood-bling: at its door the ✋ is the door", sweepcamera's own door entries (shul, hospital) now and then. Random
  (where the crowd stands); foot's NEXT_TO rule / the homes crowd — `ci/doors` / homes owners.

## Left
- **Spots turned 180° in five Blender sets read as 0°** (airport_terminal 37 spots, heist_bankint 7, interiors_bar 3,
  interiors_beach 2, places_courtlobby 4 — people / bench spots): the people there may face the wrong way; with
  faceLulu most turn to her anyway. Fixing it flips them all — a look change for the sets' owners to check, not done.
- Right at a small room's door the camera sits ~1.4 m behind her (she's see-through, now cleanly): a higher / further
  camera for small rooms would read better — a rig-tuning change, not tonight.
