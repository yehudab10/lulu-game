# Midwood, Brooklyn: data and reference brief for the 3D town engine

Purpose: give the town builder a street grid or graph and a set of landmarks for a drivable,
low-poly, stylised but recognisable **Midwood, Brooklyn**. Teen-rated, affectionate parody:
every business, shul, school and person in the game gets a **parody name**.

**How the facts were gathered (November 2026):**
- **Wikipedia:** the Midwood, Ocean Parkway, BMT Brighton Line, station and Brooklyn College
  articles.
- **NYC Landmarks/HDC and press coverage:** used for Fiske Terrace–Midwood Park.
- **NYC 311:** used for the alternate-side parking rules.
- **OpenStreetMap data:** downloaded from the OSM API for about 40.606–40.640 N and
  73.976–73.940 W, then parsed locally. All street order, spacing, one-way direction,
  lane counts, rail crossings and building heights below come from that OSM pull. OSM in NYC
  largely follows NYC DOT/LION street data and is generally reliable. Lane counts are partly
  tagged and are flagged where thin.

**Confidence markers used throughout:**
- **[OSM]:** measured or derived from OpenStreetMap geometry and tags.
- **[WP]:** Wikipedia or another published source; links are in §6.
- **[est]:** my estimate or typical NYC practice. Not verified for this specific street.
- **[verify]:** plausible but uncertain. Check Street View before you rely on it.

---

## 0. Coordinate frame used in this brief (important)

Brooklyn's street grid here is **rotated about 8.2° counter-clockwise from true east–west**
[OSM, measured]. The lettered avenues climb about 11.5 m north per 80 m east. To make the grid
axis-aligned, every coordinate below is in a **"grid frame"**:

- Rotate by −8.2° about (40.6200 N, −73.9600 W), then translate.
- **Origin (0,0):** the centre of the **Avenue M × Brighton Line embankment** crossing, next to
  the Avenue M station.
- **+x:** "grid east", along the avenues, toward Nostrand Ave.
- **+y:** "grid north", along the East streets, toward Brooklyn College.
- **Units:** metres, centreline to centreline.
- In this frame the avenues sit at almost exactly constant y and the streets at almost exactly
  constant x. The residual is under 2 m, so it can be modelled as a perfect grid.
- **Exceptions:** Kings Highway, Foster Ave, Elm/Chestnut/Locust Aves and Flatbush Ave run on
  diagonals (see §2).

If the engine wants true north, rotate the whole map +8.2° (grid north points about 8° west of
true north).

---

## 1. Bounds (verified, with caveats)

Midwood has **no official boundary**. Sources disagree, mostly on the north and south edges [WP]:

| Edge | Most-cited | Variants seen |
|---|---|---|
| **North** | The **LIRR Bay Ridge Branch open cut**, "just above Avenue I", plus the Brooklyn College campus [WP Midwood] | Avenue I (older Wikipedia), **Foster Ave / Fiske Terrace** (broad definitions; Fiske Terrace–Midwood Park is "considered part of Midwood by many") |
| **South** | **Avenue P and Kings Highway** [WP] | Kings Hwy only; one source says Avenue P plus the Bay Ridge Branch (clearly garbled) |
| **West** | **Ocean Parkway**, or McDonald Ave in broader definitions [WP] | Coney Island Ave (narrow definitions) |
| **East** | **Nostrand Ave** [WP]. Flatbush Ave in older definitions. East of Nostrand is usually "East Flatbush/Flatlands". | — |

**Your proposed box is a reasonable, defensible union:**
- North: Avenue I / Foster Ave.
- South: Kings Highway / Avenue P.
- West: Ocean Parkway, or Coney Island Ave for the core.
- East: Nostrand Ave, or Flatbush Ave in the north-east corner.

Suggested game bounds:
- **Core playable box:** Ocean Pkwy → Nostrand Ave, and Avenue I → Avenue P / Kings Hwy. That is
  about **2.0 km E–W × 1.9 km N–S** at 1:1.
- **Optional north strip:** the Bay Ridge cut → Avenue H → Campus Rd / Glenwood Rd / Foster Ave.
  It holds Brooklyn College, Midwood HS and the Fiske Terrace "Victorian" houses, and adds about
  0.3–0.9 km.
- Community Board 14 covers Flatbush, Midwood, Kensington and the Ocean Parkway strip, with
  Kings Highway/Avenue P as its southern edge [WP].

Real extents in the grid frame [OSM]:
- **x:** Ocean Pkwy centreline −819 to Nostrand Ave +1195, about **2,014 m**.
- **y:**
  - Kings Highway at Ocean Pkwy is −1261 and Avenue P is −849.
  - Avenue I is +1068, the Bay Ridge cut about +1225, Avenue H +1334, Glenwood Rd +1602.
  - Foster Ave runs diagonally from +1450 at Ocean Pkwy to +2111 at Nostrand.

---

## 2. The street grid

### 2.1 North–south streets, west → east (real positions) [OSM]

The pattern is the "East" numbered streets. **Four wide arterials replace a numbered street:**
Ocean Pkwy sits in the E 6th slot, Coney Island Ave in E 11th, Ocean Ave in E 20th, Bedford Ave
in E 25th and Nostrand Ave in E 30th. **There is no E 6th, 11th, 20th, 25th or 30th Street in
Midwood.** (An E 25th fragment exists only north of Foster Ave.)

| # | Street | x (m) | Gap to previous | Traffic in core (Ave I → Kings Hwy) |
|---|---|---|---|---|
| — | McDonald Ave (F train elevated overhead; west edge of broad Midwood) | −1274 | — | 2-way |
| — | E 2nd St | −1182 | 92 | one-way, flips (see note A) |
| — | E 3rd St | −1095 | 87 | one-way, flips |
| — | E 4th St | −1015 | 80 | one-way, flips |
| — | E 5th St | −936 | 79 | one-way, flips |
| 1 | **Ocean Parkway** (main road plus 2 service roads) | −819 (SB service rd −842, NB service rd −795) | 117 | **2-way boulevard** |
| 2 | E 7th St | −702 | 117 | one-way **S** |
| 3 | E 8th St | −610 | 92 | one-way **N** |
| 4 | E 9th St | −531 | 79 | one-way **S** |
| 5 | E 10th St | −452 | 79 | one-way **N** |
| 6 | **Coney Island Ave** | −367 | 85 | **2-way arterial** |
| 7 | E 12th St | −282 | 85 | one-way **S** |
| 8 | E 13th St | −203 | 79 | one-way **N** |
| 9 | E 14th St | −124 | 79 | one-way **S** (one short N block near Kings Hwy [verify]) |
| 10 | E 15th St | −44 | 80 | one-way **N** |
| — | **BMT Brighton Line embankment (B/Q)** | ≈ 0 (four tracks, roughly −8 to +8) | — | rail; streets pass under it |
| 11 | E 16th St | +35 | 79 | one-way **S** — **interrupted between Ave K and Ave M** (school/park superblock) |
| 12 | E 17th St | +117 | 82 | one-way **N** |
| 13 | E 18th St | +199 | 82 | one-way **S** |
| 14 | E 19th St | +280 | 81 | one-way **N** |
| 15 | **Ocean Avenue** | +382 | 102 | **2-way arterial** |
| 16 | E 21st St | +471 | 89 | one-way **S** |
| 17 | E 22nd St | +550 | 79 | one-way **N** |
| 18 | E 23rd St | +629 | 79 | one-way **S** |
| 19 | E 24th St | +708 | 79 | one-way **N** |
| 20 | **Bedford Avenue** | +790 | 82 | **2-way** (1 lane each way plus painted bike lanes) |
| 21 | E 26th St | +872 | 82 | one-way **S** |
| 22 | E 27th St | +952 | 80 | one-way **N** |
| 23 | E 28th St | +1030 | 78 | one-way **S** |
| 24 | E 29th St | +1110 | 80 | one-way **N** |
| 25 | **Nostrand Avenue** | +1195 | 85 | **2-way arterial** |
| — | E 31st St (beyond the east edge) | +1280 | 85 | one-way S/N mixed |

**A neat rule for the game [OSM]:** between Ocean Pkwy and Nostrand the East streets alternate
**S, N, S, N…**, starting with **S** immediately east of each arterial and ending with **N**
immediately west of the next one:
- E 7th S … E 10th N | CI Ave | E 12th S … E 15th N | rail | E 16th S … E 19th N | Ocean Ave |
  E 21st S … E 24th N | Bedford | E 26th S … E 29th N | Nostrand.
- One quirk: the block between E 15th and E 16th is split by the subway, but the alternation
  still holds.

**Notes:**
- **A. West of Ocean Pkwy:** E 2nd–E 5th reverse direction around Ave L/M. South of Ave M, E 2nd
  runs S, E 3rd N, E 4th S, E 5th N. North of Ave J they flip. There is a short 2-way stretch in
  between [OSM; verify].
- **B. North of the Bay Ridge cut:** in Fiske Terrace, E 21st–E 24th run the **opposite** way
  (E 21st N, E 22nd S, E 23rd N, E 24th S) [OSM].
- **C. Short blocks north of Avenue I:** the East streets between Avenue I and the Bay Ridge cut
  are short **two-way stubs**, about 150 m. Most of them dead-end at the cut (see §2.4).

### 2.2 East–west avenues, north → south (real positions) [OSM]

| Avenue | y (m) | Gap | Traffic | Notes |
|---|---|---|---|---|
| Foster Ave | diagonal: +1450 at Ocean Pkwy → +1984 at Ocean Ave → +2111 at Nostrand | — | 2-way, 1+1 lanes, painted bike lane | Not on the grid; it slants about 25° across the north. Optional. |
| Glenwood Rd | +1602 | — | mixed: 1-way pairs and 2-way pieces | North edge of Brooklyn College / Midwood HS |
| Campus Rd | about +1390 → +1460 (slants) | — | mostly 1-way W | Wraps the north of the college |
| **Avenue H** | **+1334** | — | 2-way | **Absorbed by the Brooklyn College campus between Ocean Ave and Nostrand.** Also broken at the Brighton line (tracks at grade; Ave H station). |
| *LIRR Bay Ridge Branch (open cut)* | *≈ +1225* | — | rail | **Barrier.** Only Ocean Pkwy (rail in a tunnel under it), Coney Island Ave, **E 14th St**, Ocean Ave, Bedford Ave and Nostrand Ave cross it on bridges. Other East streets dead-end at the fence. |
| **Avenue I** | **+1068** | 266 | 2-way, 1+1 | **No road crossing at the Brighton line** per OSM. It dead-ends both sides at about E 15th/E 16th [verify]. |
| **Avenue J** | **+802** | 266 | 2-way, 1+1 lanes, parking both sides | **Main kosher commercial strip** (§4). Passes under the embankment at the Ave J station. |
| **Avenue K** | **+534** | 268 | 2-way | **Does not exist west of Ocean Pkwy** [WP/OSM] |
| **Avenue L** | **+267** | 267 | 2-way, 1+1 | Edward R. Murrow HS and Kolbert Park sit just south, E 16th–E 18th |
| Locust Ave | diagonal, about +146 at the rail | — | 1-way E (west part) | Tiny oblique lane, CI Ave → E 16th; passes under the embankment |
| Chestnut Ave | diagonal, about +66 at the rail | — | 1-way | Tiny oblique lane |
| **Avenue M** | **0** | 267 | 2-way, 1+1 (2+1 at the station) | **Second commercial strip.** Ave M station at x≈0. |
| **Elm Ave** | diagonal: −108 at CI Ave → meets Ave M at the rail (x≈0) → +21…+44 at E 17th–E 18th | — | **1-way E**, 1 lane | Short oblique street that **crosses Avenue M at the Avenue M station**. Not a full avenue. |
| **Avenue N** | **−267** | 267 | **1-way EAST, 2 lanes** (east of Ocean Pkwy) | Two-way west of Ocean Pkwy |
| **Avenue O** | **−564** | 297 | **1-way WEST, 2 lanes** (east of CI Ave) | Two-way west of CI Ave. Ends at Kings Hwy (x≈926). |
| **Avenue P** | **−849** | 285 | **2-way, 4 lanes** (2+2), primary | Wide. Kings Hwy crosses it at E 21st (x≈471). East of there it narrows to 1–2 lanes with one-way bits. |
| Quentin Rd | −1089 | 240 | mostly 2-way (1-way W stub near Kings Hwy) | "Avenue Q" in all but name |
| **Kings Highway** | **diagonal** (below) | — | 2-way | **Ancient road (1704) that ignores the grid** [WP] |

**Kings Highway polyline (grid frame, x,y) [OSM]:**
- **West part:**
  - Ocean Pkwy (−796,−1261) → E 8th (−609,−1206) → Coney Island Ave (−368,−1145).
  - Then E 13th/Quentin Rd (−202,−1092) → E 16th, Kings Hwy station (+35,−1003).
  - Then Ocean Ave (+383,−883) → Avenue P/E 21st (+471,−849) → E 23rd (+630,−808).
  - In this stretch it climbs about 13°.
- **East part:** it bends to about 35–40°, through Bedford (+790,−671) → E 27th (+951,−564),
  where Ave O ends → Nostrand (+1196,−400) → crosses Ave M around (+1598,0).

**Avenue spacing:** a **regular 267 m** (about 875 ft) centre to centre from Ave H to Ave N,
then 285–297 m for N→O→P [OSM].

### 2.3 Arterials: cross-sections and widths

**Ocean Parkway** [WP, OSM]:
- **Right-of-way: 210 ft = 64 m.** Olmsted & Vaux, 1870s. NYC Scenic Landmark (1975), National
  Register listed.
- Cross-section from west to east, in feet and metres:
  - sidewalk 15 / 4.6
  - **SB service road 25 / 7.6**: 1 lane plus a parking lane, one-way **south** [OSM]
  - **west mall 20 / 6.1**: the **historic bike path** (1894/95, billed as the first in the US)
    plus a walkway, benches and trees
  - **central roadway 70 / 21.3**: **6 lanes, 3+3, with a 4th turn/merge lane in places.**
    OSM tags 6–7 lanes, no parking, no commercial vehicles, speed limit **25 mph** since 2015.
  - **east mall 20 / 6.1**: walkway, benches and chess tables (a second path was added in 1896)
  - **NB service road 25 / 7.6**: 1 lane plus parking, one-way **north**
  - sidewalk 15 / 4.6
- **Trees:** historically six rows (two per mall, one per sidewalk) of elm, oak, maple,
  sycamore and some ginkgo [WP]. In the game, use big leafy canopy trees in double rows on the
  malls.
- **Cross streets:** they cut through all three roadways at each avenue. The malls stop at each
  avenue, so they come in blocks about 230–250 m long. The service roads have stop signs or
  lights at each avenue; the main road has lights.
- **Mall paths:** which mall carries the bike path today is per Wikipedia (the west mall).
  [verify signage: both malls are now shared-use in places]

**Coney Island Avenue** [OSM]:
- 2-way, **4–5 lanes**: 2+2, alternating with a 3rd lane or turn lane in one direction, plus
  parking both sides.
- Roadway about **18–21 m**, right-of-way about 30 m [est].
- Low 1–2-storey commercial frontage, lots of **auto repair shops, garages and gas stations**
  (OSM counts about 190 garage footprints along it).
- Continuous, busy bus route [est: B68].

**Ocean Avenue** [OSM]:
- 2-way, **4–5 lanes** plus parking. Roadway about 18–21 m [est].
- Lined with **5–6-storey pre-war apartment houses**; OSM p90 height about 20 m. Few shops.
- Crosses the Bay Ridge cut on a bridge.

**Bedford Avenue** [OSM]:
- 2-way, **1 lane each way plus painted bike lanes plus parking**, 25 mph.
- Roadway about 13–14 m [est].
- Runs **through the Brooklyn College campus** between the West and East quads, then south past
  James Madison HS (near Quentin Rd).

**Nostrand Avenue** [OSM]:
- 2-way, **4–5 lanes** plus parking. Busy commercial, bus corridor [est: B44 incl. Select Bus
  Service].
- North of Flatbush Ave it becomes one-way (not in our box).

**Kings Highway** [OSM, WP]:
- **West of Ocean Ave:** a busy 2-way shopping street. **2–4 lanes** (mostly 1–2 each way) plus
  parking, plus the Kings Hwy station bridge at E 15th–E 16th.
- **East of about E 24th–E 25th:** it becomes a **boulevard**. The central roadway has
  **4–5 lanes** (2+2 or 3+2), with **tree-planted malls** and **1-lane one-way service roads**
  on both sides. The malls were created in a 1922 widening [WP / NYC Parks "Kings Highway
  Malls"].
- Right-of-way east of Ocean Ave is about 45–50 m [est].

**Avenue P:** primary, **2+2 lanes** plus parking, about 18 m roadway [est] [OSM lanes = 4].

**Avenues I, J, K, L, M** (local avenues) [OSM lanes = 2, parking both sides]:
- One lane each way plus a parking lane each side.
- Right-of-way **80 ft ≈ 24 m**; roadway about 13–15 m, sidewalks about 4.5 m [est, typical NYC].
- On Avenue J and Avenue M the "parking lane" effectively becomes a **double-parking lane**.
- Avenue M widens to 2+1 lanes near the station.

**Avenues N and O** (one-way pair): **2 travel lanes, one direction**, plus parking both sides.
Same width as the local avenues [OSM].

**East Streets** [OSM]:
- One-way, **1 travel lane**, parking both sides.
- Roadway **about 30 ft ≈ 9 m**: OSM has width tags of 29–33 ft on several.
- Right-of-way about 60 ft ≈ 18 m, so sidewalks about 4.5 m each including a **tree pit strip**
  [est].

**Typical blocks (centre to centre) [OSM]:**
- **E–W** (between East streets): **79–82 m** (about 260–270 ft).
  - About 102 m across Ocean Ave, about 85 m across Coney Island and Nostrand, and **117 m each
    side of Ocean Pkwy** because of its 64 m width.
- **N–S** (between avenues): **267 m** (about 875 ft).
- **Block shape:** long, narrow blocks with **houses fronting the East streets**. Avenue
  frontages are the short ends, where corner shops and apartment houses sit.
- **Lot depth:** about 30 m each side of a mid-block back-lot line.
- **Interior lots:** **side driveways to detached rear garages** are everywhere. About 40% of
  interior building footprints in OSM are garages, which is a very recognisable Midwood
  silhouette.

**Building heights by zone** (OSM height tags, NYC building import):

| Zone | Median height | p90 height | What it is |
|---|---|---|---|
| East-street interiors | 8.2 m | 11 m | 2–2.5-storey houses plus 1-storey garages |
| Avenues I/J/L/M/N/P frontage | 8.4–9.9 m | 11–12 m | 2–3-storey mixed use: shops below, flats above |
| Ocean Pkwy frontage | 9.4 m | 18 m | large houses mixed with 6-storey apartment houses |
| Ocean Ave frontage | 9.3 m | 20 m | 5–6-storey apartment houses |
| Coney Island Ave | 7.7 m | 11 m | 1–2-storey commercial and garages |

### 2.4 Rail crossings and barriers (the drivable topology) [OSM]

**Brighton Line embankment (x ≈ 0):** an earth embankment, with steel bridges carrying the
tracks **over** these roads, which pass **under** at grade:
- **Avenue J, Avenue K, Avenue L, Locust Ave, Chestnut Ave, Avenue M (with Elm Ave), Avenue N,
  Avenue O, Avenue P and Kings Highway.**
- Kings Highway passes under the station structure (the rail is OSM layer 2 there).
- **No crossing at Avenue I or Avenue H.** The tracks come down to grade near Ave H, and these
  avenues are broken at the line [OSM; verify].
- **No East street crosses the embankment.** It runs parallel, in the middle of the
  E 15th/E 16th block.

**Bay Ridge Branch open cut (y ≈ +1225):** a freight railroad in a walled cut. Road bridges at:
- **Coney Island Ave, E 14th St, Ocean Ave, Bedford Ave and Nostrand Ave.**
- **Ocean Parkway** crosses at grade; the rail runs in a short tunnel under it.
- Every other street dead-ends at a fence.
- For the game this is a "**moat**" between core Midwood and the Fiske Terrace / Brooklyn
  College strip, with 5–6 chokepoint bridges.

### 2.5 The simplified grid for the game (data block)

Design choices:
- **12 N–S streets and 9 E–W avenues**, plus 1 diagonal (Kings Hwy) and 2 rail features.
- Kept: every arterial, the **alternating one-way pattern**, the two commercial avenues, the
  Ave N/Ave O one-way pair, both rail barriers and the Kings Hwy diagonal.
- Dropped: every other East street. This preserves the alternation (each kept East street keeps
  its real direction).
- Positions are **real metres** in the grid frame. Gaps between kept streets therefore become
  about 160 m. If the engine prefers uniform blocks, multiply x and y by one global scale (e.g.
  0.5) and/or snap the kept streets to equal spacing. Keep relative order and the "arterials are
  wider" rule.

```jsonc
{
  "name": "Midwood (parody)",
  "frame": {
    "units": "m",
    "origin": "Avenue M x Brighton Line (Ave M station)",
    "x": "grid-east along avenues", "y": "grid-north along East streets",
    "rotation_to_true_north_deg": 8.2,
    "anchor_latlon": [40.6200, -73.9600],
    "note": "real centreline positions from OSM; scale uniformly if needed"
  },
  "defaults": {
    "lane_width": 3.3, "parking_lane_width": 2.4, "sidewalk_width": 4.5,
    "speed_limit_mph": 25, "tree_pits": true, "curb_height": 0.15
  },
  "ns_streets": [
    { "id": "ocean_pkwy", "name": "Ocean Parkway", "x": -819, "kind": "boulevard",
      "oneway": false, "lanes_each_way": 3, "parking": false,
      "row_width": 64,
      "cross_section_m": [
        {"part":"sidewalk","w":4.6},
        {"part":"service_road","w":7.6,"lanes":1,"oneway":"S","parking":"one_side"},
        {"part":"mall","w":6.1,"features":["bike_path","benches","trees_2_rows"]},
        {"part":"main_road","w":21.3,"lanes":6,"oneway":false},
        {"part":"mall","w":6.1,"features":["walkway","benches","chess_tables","trees_2_rows"]},
        {"part":"service_road","w":7.6,"lanes":1,"oneway":"N","parking":"one_side"},
        {"part":"sidewalk","w":4.6}
      ],
      "malls_break_at_each_avenue": true },
    { "id": "e8",  "name": "East 8th St",  "x": -610, "kind": "local", "oneway": "N", "lanes": 1, "parking": "both", "roadway_width": 9.1 },
    { "id": "coney_island_ave", "name": "Coney Island Ave", "x": -367, "kind": "arterial",
      "oneway": false, "lanes_each_way": 2, "center_turn_lane": "sometimes", "parking": "both",
      "roadway_width": 19.5, "frontage": "auto_shops_gas_low_commercial" },
    { "id": "e14", "name": "East 14th St", "x": -124, "kind": "local", "oneway": "S", "lanes": 1, "parking": "both", "roadway_width": 9.1,
      "note": "only East street that bridges the Bay Ridge cut" },
    { "id": "e15", "name": "East 15th St", "x": -44,  "kind": "local", "oneway": "N", "lanes": 1, "parking": "both", "roadway_width": 9.1,
      "note": "backs onto the subway embankment (east side lots)" },
    { "id": "e16", "name": "East 16th St", "x": 35,   "kind": "local", "oneway": "S", "lanes": 1, "parking": "both", "roadway_width": 9.1,
      "gaps": [{"from_y": 534, "to_y": 0, "why": "school/park superblock (Murrow-type HS + park)"}] },
    { "id": "e17", "name": "East 17th St", "x": 117,  "kind": "local", "oneway": "N", "lanes": 1, "parking": "both", "roadway_width": 9.1 },
    { "id": "ocean_ave", "name": "Ocean Avenue", "x": 382, "kind": "arterial",
      "oneway": false, "lanes_each_way": 2, "parking": "both", "roadway_width": 19.5,
      "frontage": "6_storey_prewar_apartments" },
    { "id": "e23", "name": "East 23rd St", "x": 629, "kind": "local", "oneway": "S", "lanes": 1, "parking": "both", "roadway_width": 9.1 },
    { "id": "bedford_ave", "name": "Bedford Avenue", "x": 790, "kind": "collector",
      "oneway": false, "lanes_each_way": 1, "bike_lanes": "painted_both", "parking": "both",
      "roadway_width": 14 },
    { "id": "e27", "name": "East 27th St", "x": 952, "kind": "local", "oneway": "N", "lanes": 1, "parking": "both", "roadway_width": 9.1 },
    { "id": "nostrand_ave", "name": "Nostrand Avenue", "x": 1195, "kind": "arterial",
      "oneway": false, "lanes_each_way": 2, "parking": "both", "roadway_width": 19.5,
      "frontage": "commercial_bus_corridor" }
  ],
  "ew_avenues": [
    { "id": "ave_h", "name": "Avenue H", "y": 1334, "kind": "local", "oneway": false, "lanes_each_way": 1, "parking": "both",
      "x_extent": [-819, 382], "breaks": [{"at_x": 0, "why": "Brighton tracks at grade (Ave H station)"}],
      "note": "east of Ocean Ave the college campus occupies its line", "optional": true },
    { "id": "ave_i", "name": "Avenue I", "y": 1068, "kind": "local", "oneway": false, "lanes_each_way": 1, "parking": "both",
      "breaks": [{"at_x": 0, "why": "no crossing at Brighton line (verify)"}] },
    { "id": "ave_j", "name": "Avenue J", "y": 802, "kind": "commercial", "oneway": false, "lanes_each_way": 1,
      "parking": "both", "double_parking": "constant", "roadway_width": 14,
      "shops_x": [-367, 382], "shops_peak_x": [-282, 117],
      "underpass_at_x": 0, "station": "ave_j" },
    { "id": "ave_k", "name": "Avenue K", "y": 534, "kind": "local", "oneway": false, "lanes_each_way": 1, "parking": "both",
      "x_extent": [-819, 1195], "note": "does not continue west of Ocean Pkwy", "underpass_at_x": 0, "optional": true },
    { "id": "ave_l", "name": "Avenue L", "y": 267, "kind": "local", "oneway": false, "lanes_each_way": 1, "parking": "both", "underpass_at_x": 0 },
    { "id": "ave_m", "name": "Avenue M", "y": 0, "kind": "commercial", "oneway": false, "lanes_each_way": 1,
      "parking": "both", "double_parking": "frequent", "roadway_width": 14,
      "shops_x": [-367, 382], "shops_peak_x": [-203, 199], "underpass_at_x": 0, "station": "ave_m" },
    { "id": "ave_n", "name": "Avenue N", "y": -267, "kind": "local", "oneway": "E", "lanes": 2, "parking": "both", "underpass_at_x": 0 },
    { "id": "ave_o", "name": "Avenue O", "y": -564, "kind": "local", "oneway": "W", "lanes": 2, "parking": "both",
      "x_extent": [-819, 926], "note": "two-way west of Coney Island Ave; ends at Kings Hwy", "underpass_at_x": 0, "optional": true },
    { "id": "ave_p", "name": "Avenue P", "y": -849, "kind": "arterial", "oneway": false, "lanes_each_way": 2, "parking": "both",
      "roadway_width": 18, "underpass_at_x": 0 }
  ],
  "diagonals": [
    { "id": "kings_hwy", "name": "Kings Highway", "kind": "arterial", "oneway": false,
      "points": [[-819,-1268],[-368,-1145],[-202,-1092],[35,-1003],[383,-883],[471,-849],[630,-808],[790,-671],[951,-564],[1195,-400]],
      "segments": [
        {"from": 0, "to": 6, "lanes_each_way": 2, "parking": "both", "frontage": "shopping_strip",
         "note": "busiest shops between x -280 and +200 around the station"},
        {"from": 6, "to": 9, "lanes_each_way": 2, "center_extra_lane": true, "service_roads": {"lanes":1, "oneway": true},
         "malls": {"width": 4, "trees": true}, "row_width": 46}
      ],
      "underpass_at": [0, -1021], "station": "kings_hwy" },
    { "id": "elm_ave", "name": "Elm Avenue", "kind": "local", "oneway": "E", "lanes": 1, "parking": "both",
      "points": [[-367,-108],[-45,-23],[0,0],[117,21],[199,44]], "optional": true,
      "note": "oblique lane that meets Ave M right at the station" }
  ],
  "rail": [
    { "id": "brighton_line", "name": "B/Q (parody: the 'B/Q-Maybe')", "kind": "embankment",
      "x": 0, "width": 18, "tracks": 4, "height_m": 5.5,
      "y_extent": [-1400, 1250],
      "north_of_y": 1250, "north_kind": "open_cut",
      "bridges_over_roads_at_y": [802, 534, 267, 146, 66, 0, -267, -564, -849, -1021],
      "stations": [
        {"id": "ave_h", "y": 1300, "type": "local", "platforms": "2 side", "at_grade_or_shallow_cut": true,
         "house": "wooden cottage station house on Ave H (landmark style)"},
        {"id": "ave_j", "y": 802, "type": "local", "platforms": "2 side", "house": "under the tracks, south side of Ave J"},
        {"id": "ave_m", "y": 0, "type": "local", "platforms": "2 side", "house": "brick building under the tracks"},
        {"id": "kings_hwy", "y": -1035, "type": "express", "platforms": "2 island", "house": "under the tracks, both sides of Kings Hwy"}
      ],
      "platform_length_m": 185 },
    { "id": "bay_ridge_cut", "name": "Freight line (open cut)", "kind": "open_cut",
      "y": 1225, "width": 20, "depth_m": 6,
      "road_bridges_at_x": [-819, -367, -124, 382, 790, 1195],
      "dead_ends_elsewhere": true }
  ],
  "zones": [
    { "id": "brooklyn_college", "kind": "campus", "x": [395, 1195], "y": [1240, 1450],
      "split_by": "bedford_ave", "landmark": "clock_tower_library", "optional": true },
    { "id": "fiske_terrace", "kind": "victorian_houses", "x": [35, 382], "y": [1240, 1600], "optional": true },
    { "id": "murrow_type_hs", "kind": "modernist_high_school", "x": [10, 104], "y": [81, 255] },
    { "id": "kolbert_type_park", "kind": "park_playground", "x": [117, 199], "y": [150, 255] },
    { "id": "madison_type_hs", "kind": "classic_brick_high_school", "x": [803, 942], "y": [-1077, -865] },
    { "id": "midwood_type_hs", "kind": "classic_brick_high_school", "x": [717, 862], "y": [1469, 1590], "optional": true },
    { "id": "kings_hwy_library", "kind": "library", "x": [399, 428], "y": [-950, -917] }
  ]
}
```

Notes on the data block:
- Kings Hwy's first point is extended west to the Ocean Pkwy centreline. Its malls and service
  roads start about E 24th / Corporal Wiltshire triangle (NYC Parks says "widens east of …
  East 25th Street").
- The Brighton embankment height (about 5–6 m) is [est] from one-storey-plus clearance under
  the bridges. The four tracks are about 15 m; give the embankment a sloped or retained profile
  about 18–25 m wide.
- Station y values are the platform centres [OSM]. The B-division platforms are about 180–190 m
  long, so a platform straddles its avenue.

---

## 3. The subway: B/Q Brighton Line through Midwood

**Facts [WP, OSM]:**
- **Line:** the **BMT Brighton Line**.
  - **Q:** local, all times, stops everywhere.
  - **B:** **weekday** express on the centre tracks, stopping only at express stations.
  - Four tracks south of Prospect Park.
- **Alignment:**
  - Mid-block between **East 15th and East 16th Streets**, dead straight N–S on the grid.
  - Stations are named for the avenue they straddle.
  - Ave J and Ave M are each "between E 15th and E 16th".
- **Profile, north to south:**
  - **Church Ave → Avenue H:** a **depressed open cut**, with steel bridges carrying cross
    streets over it. Cottage-style station houses perch over the cut at Beverley Rd and
    Cortelyou Rd, and Newkirk Plaza is a sunken pedestrian plaza.
  - **At Avenue H:** the line comes up to **street level**. The Ave H station house is a
    **1905 wooden cottage**, originally a real-estate office for Fiske Terrace, NYC landmark
    2004.
  - **Avenue H → south past Kings Highway (to Sheepshead Bay):** a **raised earthen
    embankment**, built from earth dug out of the cut. Cross streets run under on short bridges.
  - **Construction:** the Brooklyn Grade Crossing Elimination Commission rebuilt it 1905–1908.
    (Wikipedia gives both "1907" and "1908" as the end date.)
- **Avenue J station:**
  - Local, Q only, **2 side platforms**, on the embankment.
  - The station house is **under the right-of-way on the south side of Ave J**, with stairs up
    to the platforms. There is an exit-only/HEET entrance on the north side.
  - Opened about 1900 as "Manhattan Terrace", renamed in 1907, rebuilt 2009–2011.
- **Avenue M station:** local, Q only, 2 side platforms, on the embankment, **brick station
  house under the tracks**.
- **Kings Highway station:**
  - **Express**: B (weekdays) and Q. **2 island platforms**, cross-platform transfer.
  - Platforms are offset, with the northbound one about 75 ft further north.
  - Mezzanines **directly underneath the embankment**, plus a part-time Quentin Rd entrance.
  - It is on the Midwood/Homecrest border.

**Look (for the art pass):**
- **The embankment:**
  - A long green-brown berm, or **concrete retaining walls** where houses press close. Use a
    berm on the backyard sides and walls/fences at the bridges [est; varies by block, verify].
  - On top: four tracks, third rail, signal heads and a chain-link fence.
- **Bridges:**
  - Short **steel plate-girder spans** over each avenue, painted dark green or grey and
    rust-streaked.
  - Pigeon spikes, a "LOW CLEARANCE"-style sign and dripping water under them.
  - Each underpass is a dark, slightly lower-lit tunnel slot about 15–20 m long [est].
- **Stations:**
  - Platforms sit on top with **long, low canopies** on slim columns (2009–2012
    rehabilitation style), windscreens and a mosaic or painted name band.
  - At street level: a squat **brick station house** tucked under the bridge, a token-booth
    window, turnstiles and stairs climbing up.
- **Trains:** silver stainless-steel cars with a circle route bullet: **B = orange** (Sixth Ave
  line colour) and **Q = yellow** (Broadway line colour).
- **North of Ave H (optional set-piece):** a deep cut with brick/stone retaining walls, and
  cottage station houses on bridges.

---

## 4. Landmarks and their look, by type (use parody names)

### 4.1 The college campus (Brooklyn College type)

**Facts [WP, OSM]:**
- Planned 1932 by Randolph Evans, built 1935–37. **Georgian (Colonial Revival) style.**
- Red brick with white trim, slate roofs and white cupolas.
- Arranged around a **central quadrangle** (the "East Quad") anchored by the **library with its
  tower**. The college's iconic **white clock tower/cupola** sits on the library.
- About **35 acres** (expanded from 26 in 2011).
- **Bedford Ave runs through the campus**, between the West Quad (newer, with a modern glass
  student centre) and the original East Quad.
- OSM heights: library about 22 m (tower taller), main hall about 26 m, student centre about
  35 m.
- Campus extent in the grid frame: x +395…+1195, y +1240…+1450, between the Bay Ridge cut and
  Campus Rd, from about E 21st to Nostrand.

**Look:**
- A big **lawn quad** crossed by diagonal paths and lined with tall trees.
- Long 3–4-storey **red-brick buildings** with white columned porticoes.
- A **tall white tower**: square base, octagonal lantern, clock faces, weathervane.
- A small **lily pond** with a footbridge (photo captions on WP mention the Lily Pond).
- Iron gates and brick piers on Bedford Ave / Campus Rd, and students with backpacks.

**Parody:** "**Brooklyn Kollege of Knowledge**" or "**Midwood U**". The tower clock is always
7 minutes fast ("Midwood Time").

**Nearby:** a matching **Georgian red-brick high school with a cupola** (Midwood HS type) sits
just north of the campus at Bedford/Glenwood.

### 4.2 Ocean Parkway: benches, bike path and trees

- **The malls:** 6 m wide, with a **hexagonal asphalt-paver path** (classic NYC park pavers)
  [est], **green slatted wooden benches** on concrete or iron legs, and stone **chess tables**
  with stools.
- **Trees:** **two rows of big plane, oak or elm trees** per mall, forming a tunnel canopy.
- **Bike path:** a painted bike symbol on the west mall, and the occasional cyclist dodging
  strollers.
- **Lamps:** "Bishop's crook" style lamps [est].
- **Frontage:**
  - Grand **6-storey 1920s–30s apartment houses**, often with Art Deco or Tudor entrances and
    canopies.
  - **Very large detached houses**: older brick or stucco mansions, plus many **rebuilt modern
    stone-and-glass mega-houses**. The strip near E 5th–E 8th is known for big renovated family
    homes [observation; verify].
- **Life on the malls:** elderly folks on benches, double strollers, men walking to shul,
  joggers and dog-walkers.
- **Traffic:** the main road is fast with timed lights; the **service roads are slow**, with
  stop signs every block, double-parked cars and kids biking.

### 4.3 The Avenue J and Avenue M commercial strips

**Facts:**
- **Avenue J:** "a major business street … many **kosher restaurants, delis, pizzerias, and
  butchers**" [WP].
  - Densest from Coney Island Ave to about E 17th, peaking around the **Ave J station
    (E 15th/E 16th)** [OSM POI clustering; approximate].
  - Real examples include long-running kosher **bakeries** and **pizzerias**; one closed in 2025
    after losing its lease. Use them only as type references.
- **Avenue M:** "a central location for **kosher food and butchers**" [WP].
  - Shops cluster from about E 13th to E 18th around the Ave M station, plus a few near
    Ocean Ave [OSM].
  - OSM shows supermarkets, banks, clothing and confectionery.
- **Hours** [general knowledge]: shops close for Shabbos, from Friday afternoon to Saturday
  night. Saturday nights after Shabbos are a pizza and dessert rush (a real Ave J pizzeria
  listing warns of "long wait times, especially on Saturday nights").

**Look:** a stylised but recognisable strip, made of 2–3-storey brick "taxpayer" and
mixed-use buildings.
- **Ground floor:**
  - Glass storefronts with **colourful fabric awnings**: striped, with Hebrew and English
    lettering.
  - Roll-down security gates covered in graffiti-free paint, and A-frame sidewalk signs.
- **Upper floors:** apartments with window AC units and fire escapes on some.
- **Shop types to model** (parody names in §5):
  - **Kosher bakery:** challah towers in the window; a "rugelach by the pound" sign; a line out
    the door on Fridays.
  - **Kosher pizza shop:** slice counter, fluorescent light, a "chalav Yisroel" type sign, a
    "fleishig/milchig" split.
  - **Fish store:** whole fish on ice, a hand-written "gefilte fish fresh ground" sign.
  - **Butcher:** "glatt" sign, meat cases.
  - **Sefarim (Jewish bookstore):** shelves of gold-stamped dark books, menorahs and kiddush cups
    in the window, a Judaica sale bin.
  - **Grocery/supermarket:** produce crates on the sidewalk.
  - Wig salon (sheitel macher), children's clothing, optician, dry cleaner, florist (busiest
    Friday), toy and gift shop, phone store.
- **Street furniture:** "tzedakah" charity boxes [est], parking meters / Muni-Meter kiosks,
  bus-stop shelters, and stacks of free community newspapers in boxes.
- **Traffic texture:** **double-parked minivans with hazards on**, delivery trucks, car-service
  sedans, strollers. The bridge underpass at the station is the choke point.

### 4.4 Typical housing

1. **Detached "Victorian" houses** (Fiske Terrace–Midwood Park type) [WP/LPC/HDC]:
   - Historic district designated 2008, about **250 houses**, built about **1905–1914** by
     developers T.B. Ackerson Co. and John R. Corbin Co.
   - Wood-frame, free-standing, with lawns and driveways.
   - Styles: **Queen Anne** (turrets, wrap-around porches, shingle patterns), **Colonial
     Revival** (columns, symmetrical porches), **Dutch Colonial** (gambrel roofs) and
     **Arts & Crafts** (stucco, half-timber).
   - Location: north of the Bay Ridge cut, around E 16th–Ocean Ave, Avenue H to Glenwood Rd /
     Foster Ave [approximate].
   - **Look:** 2.5–3 storeys, big porches, pastel or white clapboard, dark shutters, mature
     trees and street lamps.
2. **Interior Midwood (Ave I–Kings Hwy):**
   - **1910s–30s detached and semi-detached houses** in brick, stucco and clapboard.
     **2–2.5 storeys** (OSM median 8.2 m), a small front lawn or paved front yard, a stoop or
     porch.
   - **A narrow side driveway to a detached rear garage** (OSM: about 40% of interior footprints
     are garages).
   - Many houses have been **expanded into large modern brick-and-stone homes**, so the block
     looks varied.
   - Low brick walls, wrought-iron fences and hedges.
3. **Attached brick row houses:**
   - Rows of 2-storey brick houses with bay fronts, shared walls and small front yards.
   - More typical toward the **Kings Hwy/Ave P edge and in the side streets near the
     arterials** [est; verify by block].
   - Use them to vary the block types.
4. **Small apartment buildings:**
   - **On the avenues:** 2–3-storey shop-plus-apartment buildings.
   - **On Ocean Ave and Ocean Pkwy:** **5–6-storey pre-war elevator buildings**, U- or H-shaped,
     with courtyards, brick with stone trim, Art Deco/Tudor doorways, a canopy and a fire escape
     (OSM p90 height 18–20 m).

### 4.5 Shuls

- **Density [OSM]:** OSM maps **about 23 synagogues** inside the core box, against about 8
  churches. Real density is higher, because many small shuls are unmapped [est].
- **Types to model:**
  1. **Shtiebel:** a **converted house** with a small sign over the door, a lit window and men
     arriving on foot.
  2. **Mid-size brick shul:** 2–3 storeys, arched windows with stained glass, a Star of David
     or Hebrew lettering over the entrance, a cornerstone.
  3. **Large "Jewish Center" type:** a neoclassical or modernist community building with
     columns and a wide stair. Several real ones are **former churches**: OSM tags some
     synagogues with building=church.
  4. A Sephardic congregation with slightly different style cues (Mediterranean arches) [est].
- **Exterior extras:**
  - A plaque, bike racks, stroller parking, a **sukkah on a porch in autumn**, a "minyan
    times" board.
  - An **eruv** wire strung on utility poles. That is real: Brooklyn eruvin use pole-top lines.
    It is a nice subtle prop.
- **Churches** (a few) are also present along Ave L, Ave N, Kings Hwy and Ocean Ave: a Greek
  Orthodox church, a Catholic parish, Baptist and Pentecostal churches. Include one or two for
  realism.

### 4.6 The Kings Highway shopping strip

**Facts [WP/OSM]:** chain stores, ethnic food stores and sushi restaurants. The busiest part is
around the **Kings Hwy express station** (about E 12th–E 18th) west of Ocean Ave. OSM POIs
include department stores, supermarkets, phone shops, beauty, clothing and greengrocers.

**Look:**
- A wider, louder, more mixed version of Ave J: 1–3-storey commercial blocks plus a few older
  4–6-storey apartment and office buildings.
- Big plastic box signs, discount and dollar stores, a supermarket, phone repair, a
  cellphone/electronics shop, nail salons, a fruit stand under an awning, a bank on a corner.
- Constant bus traffic and **the station bridge across the street**.
- **East of Ocean Ave** it turns into a residential boulevard with tree malls and service roads.
- A real **public library branch** stands at Ocean Ave & Kings Hwy (parody: "Kings Hwy Lending
  Library").

### 4.7 High schools (Edward R. Murrow type, and others)

- **Murrow type:**
  - Opened **1974** (some sources say 1977) at Avenue L between E 16th and E 17th, on the east
    flank of the subway embankment.
  - **1970s modernist:** low-to-mid-rise, **tan or brown brick and concrete**, horizontal ribbon
    windows, a flat roof, minimal ornament.
  - One architecture writer calls this school generation "austere and uninviting" (Untapped
    Cities). No architect found.
  - Adjoining park and playground (Kolbert Park type) with handball walls and basketball
    courts.
  - Parody: "**Edward R. Mumble HS**" or "**Ed Murrow-ish High**".
- **Madison type:**
  - Bedford Ave at Quentin Rd/Ave P.
  - **1920s Collegiate/Georgian red brick**, 4–5 storeys, a big formal entrance, flagpole and
    athletic field.
- **Midwood HS type:** Bedford/Glenwood, next to the college. Georgian red brick with a
  **cupola**.
- **Yeshivas and girls' schools:**
  - Many: OSM lists a dozen-plus in the box.
  - Buildings are often brick 3–4-storey blocks or converted houses, with **yellow school buses
    double-parked** outside at 8 am and 4 pm.

### 4.8 Small extras that sell the place

- **Coney Island Ave:** auto-body shops with hand-painted signs, tyre stacks, gas stations, a
  **car-service base** (a storefront with a dispatch window and Town Cars or minivans), funeral
  homes, tile and stone stores, Turkish and South Asian restaurants (WP mentions Turkish
  restaurants between Ave O and Quentin Rd).
- **Tiny triangles:** traffic-island parks such as **"the smallest park in NYC" type**
  (Sgt. Joyce Kilmer Triangle) [WP] and a Corporal-Wiltshire-type triangle at Kings Hwy.
- **Alternate-side signs:** the **"P with a broom through it" symbol** on every block.
- **Kerb details:** fire hydrants, tree pits with low iron guards, recycling bins out on the
  wrong day.
- **Overhead:** **eruv wire** on top of the poles, and a **Muni-Meter** on the avenues.
- **Bus details:** MTA buses with blue-and-yellow stripes. Select Bus Service buses carry blue
  "SBS" livery.

---

## 5. The vibe for comedy (Teen-rated, affectionate roast)

Factual underpinnings (so the jokes land on real things):
- **Alternate-side parking:**
  - Every block has posted cleaning windows, marked with the broom-P sign. You can't park on the
    side being cleaned during the posted hours. Per NYC 311, **the rule applies for the whole
    posted window even after the sweeper passes**.
  - Each side is cleaned at a different time so cars can swap sides. The fine is about $65.
  - The local ritual: cars **double-park on the opposite side**, with drivers sitting in them
    waiting out the window. Whether this is "allowed" is a grey area [verify; it's common
    practice, not a rule].
- **Double parking on Ave J/M:** a one-lane-each-way avenue plus heavy shop traffic means the
  parking lane is full. People stop "for one second" with hazards on.
- **Car service:**
  - Brooklyn's neighbourhood livery "car services" with dispatch bases, minivans and sedans,
    radio chatter.
  - They predate the ride-hailing apps.
- **B/Q being late:** a classic NYC complaint.
  - B runs weekdays only; nights and weekends are Q-only.
  - Ave J and Ave M are **Q-only** stops, so the B rolls past express on the middle tracks.
    This is a free running gag.
- **Ocean Parkway's slow lane:** the service roads have stop signs every block, double-parked
  cars, cyclists and kids. The main road has lights timed for 25 mph.
- **Sunday traffic:** stores close on Shabbos, so **Sunday is the big errand and shopping day**.
  Ave J, Ave M and Kings Hwy are packed, with simchas and events as well [general knowledge].
- **Erev Shabbos (Friday afternoon):** a rush for challah, cake, flowers, fish and wine before
  candle-lighting.
  - Shops close early, especially in winter when sunset is about 4:15 pm.
  - Then the streets go **quiet**, and Saturday is peaceful with almost no local driving.
  - **Motzei Shabbos** (Saturday night): the pizza rush.
- **Brooklyn vs. Lakewood:**
  - Lakewood, NJ, about 1–1.5 h south via the Garden State Parkway, is home to a very large
    Orthodox community and yeshiva. Many Brooklyn families have moved there.
  - Brooklynites tease Lakewood about lawns, cul-de-sacs, Route 9 traffic and "the country".
  - Lakewooders tease Brooklyn about parking, cramped houses and paying a fortune for a
    driveway.
  - Keep it sibling-rivalry level: never mean about religion or people, only about suburbs vs.
    city life.

**Tone rules for the writer:**
- Parody names only.
- Jokes target **traffic, parking, weather, food, lines, transit and suburbs-vs-city**, and
  never religious practice itself, appearance or ethnicity.
- No money or greed tropes.
- Characters are generic types: "Bubby in the Buick", "the Car-Service Guy", "the Fish-Store
  Man".

### 5.1 Example lines (NPC barks, radio and phone, mission text)

1. "Alternate side! Alternate side! Everybody move your car to the side that is also full!"
2. "I've been double-parked here for 'one second' since Tuesday."
3. "Hazards on means it's legal. That's the law. I think. Bubby said."
4. "The B train? On a Saturday? Sweetheart, the B is a weekday rumour."
5. "Next Q in 2 minutes. That was 11 minutes ago. The sign is an optimist."
6. "The B just flew past Avenue J like it saw a meter maid."
7. "Car service! Five minutes!" — *Five Brooklyn minutes, which is roughly a fiscal quarter.*
8. "Ocean Parkway service road: where speed limits are a suggestion and the suggestion is
   'stop'."
9. "There are eleven stop signs between here and Avenue M and I've met all of them personally."
10. "Erev Shabbos, 2:58 pm: the challah line now has its own zip code."
11. "Out of rugelach. Out of babka. Out of patience. Come back Sunday."
12. "In Lakewood they have lawns. In Brooklyn we have a lawn chair holding a parking spot."
13. "Lakewood guy: 'We have a driveway.' Brooklyn guy: 'We have a driveway too. It's shared by
    three houses and a dumpster.'"
14. "Brooklyn: you can walk to six shuls, four pizza stores and the Q. Lakewood: you can drive
    to Route 9 and sit."
15. "My cousin moved to Lakewood. Now he calls Avenue J 'the city' and wears a jacket to visit."
16. "Lakewood traffic? Cute. Come see Kings Highway at 1 pm on a Sunday."
17. "Sunday on Avenue J: the only parade where nobody moves."
18. "Is this the line for the bakery or for the fish store?" — "Yes."
19. "The fish store man says it's 'fresh-ish'. That's the most honest sign on the avenue."
20. "Who moved my car? … Oh. The sweeper did. Spiritually."
21. "Parking spot opening up on East 15th — everybody stay calm, NOBODY honk."
22. "Ima says be home before candle-lighting. The GPS says 41 minutes. Ima says that's a 'you'
    problem."
23. "The underpass at Avenue M: twelve meters of darkness and one pigeon who runs this
    neighbourhood."
24. "Coney Island Avenue: if your car makes a noise, someone there already fixed it, twice."
25. "The college clock says 4:07. The college clock has said 4:07 for my entire degree."
26. "Bubby's Buick has been in the left lane of Ocean Parkway since 1994. It's a landmark now
    too."
27. "Motzei Shabbos pizza line: forty minutes. Worth it. Don't tell my cardiologist."
28. "Car-service dispatcher: 'He's around the corner.' Which corner? 'A corner. Brooklyn has
    many.'"
29. "On Avenue N everything goes east. On Avenue O everything goes west. On Avenue J everything
    goes nowhere."
30. "Ticket for double parking? I was triple parking. Read the ticket again."
31. "In Lakewood they say 'the city' like it's a place where dragons live. It's Avenue M.
    There's a bakery."
32. "Brooklyn kid in Lakewood: 'Where's the subway?' Lakewood kid: 'Where's the… what?'"
33. "Sunday errands: shoes, sheitel, sefarim, supermarket, and a forty-five-minute search for
    the car."
34. "Rule of the road on East 16th: it's one-way, but tell that to the delivery bike."
35. "The B/Q is running with delays because of a train ahead of us. The train ahead of us is
    also running with delays because of a train ahead of it. It's trains all the way down."
36. "Erev Shabbos 3:59 pm: florist sold out of everything except one cactus and good wishes."
37. "Honking on Ocean Parkway is like davening: everyone does it, nobody agrees on the tune."
    *(Writer check: keep only if it reads as warm. Drop it if it feels like it pokes at
    religious practice.)*
38. "Alternate side is suspended for a holiday! Midwood celebrates by double parking anyway."

### 5.2 Sign texts (props, awnings, billboards)

All of these are invented parody names. Run a quick web search before you ship, to avoid
accidental real matches.

**Bakery, pizza and food:**
- **"CHALLAH-DAY INN BAKERY — Braided Fresh Since Whenever"**
- **"RUGELACH RUSH — Sold By The Pound, Gone By Noon"**
- **"SLICE OF SINAI KOSHER PIZZA — Motzei Shabbos Line Starts Here →"**
- **"THE GEFILTE STATION — Fish • Fresh • Probably"**
- **"KUGEL KINGDOM — Long Live The Lokshen"**
- **"CHOLENT & CHILL — Open Thursday Night Till It's Gone"**

**Shops:**
- **"SHELF HELP SEFARIM & JUDAICA — Big Books, Small Store"**
- **"GLATT-ITUDE BUTCHER — We Take Our Meat Seriously"**
- **"WIG OUT SHEITELS — Appointments Only (Fridays: Prayers Only)"**

**Car-service bases:**
- **"KINGS WAY KAR SERVICE — 'He's Around The Corner'"**
- **"MIDWOOD MINIVAN EXPRESS — 7 Seats, 9 Kids, No Problem"**

**Other businesses:**
- **"BUMPER TO BUMPER BODY SHOP — If It's Bent, We Meant It"** (Coney Island Ave)
- **"THE B/Q-MAYBE — Next Train: Eventually"** (station countdown clock gag)

**Street signs and civic notices:**
- **"NO PARKING 8:30–10 AM TUES & FRI — BROOM ICON"**, with a parody sub-plate: *"(Yes, You.)"*
- **"DOUBLE PARKING TOLERANCE ZONE: ZERO. (NOBODY READS THIS SIGN.)"** (Avenue J)
- **"OCEAN PARKWAY SERVICE ROAD — SPEED LIMIT: BENCH"**
- **"WELCOME TO MIDWOOD — Twinned With Lakewood (Lakewood Did Not Agree)"**
- **"LAKEWOOD 64 MI →  /  REAL PIZZA 0.2 MI ↑"**
- **"ERE-V SHABBOS SALE — Everything Must Go By 3 PM"**
- **"SUNDAY TRAFFIC AHEAD — BRING SNACKS"**
- **"ALTERNATE SIDE SUSPENDED — HAPPY HOLIDAY — STILL NOWHERE TO PARK"**
- **"CAUTION: DOUBLE-PARKED MINIVAN MAY OPEN SLIDING DOOR WITHOUT WARNING"**

**Campus, school and shul parodies:**
- **"BROOKLYN KOLLEGE OF KNOWLEDGE — Est. When The Clock Was Last Right"**
- **"EDWARD R. MUMBLE HIGH SCHOOL — Home Of The Mumblers"**
- **"YOUNG ISRAEL OF EAST 15½ STREET"** (generic shul parody; "Young Israel" is a generic
  movement name)
- **"THE LITTLE SHTIEBEL THAT COULD — Mincha 4:12"**

---

## 6. Sources

**Wikipedia articles:**
- Midwood, Brooklyn: https://en.wikipedia.org/wiki/Midwood,_Brooklyn
- Ocean Parkway: https://en.wikipedia.org/wiki/Ocean_Parkway_(Brooklyn)
- BMT Brighton Line: https://en.wikipedia.org/wiki/BMT_Brighton_Line
- Avenue J station: https://en.wikipedia.org/wiki/Avenue_J_station
- Avenue M station: https://en.wikipedia.org/wiki/Avenue_M_station
- Kings Highway station (BMT Brighton Line):
  https://en.wikipedia.org/wiki/Kings_Highway_station_(BMT_Brighton_Line)
- Brooklyn College: https://en.wikipedia.org/wiki/Brooklyn_College
- Kings Highway (Brooklyn): https://en.wikipedia.org/wiki/Kings_Highway_(Brooklyn)
- Brooklyn Community Board 14: https://en.wikipedia.org/wiki/Brooklyn_Community_Board_14
- Edward R. Murrow High School: https://en.wikipedia.org/wiki/Edward_R._Murrow_High_School

**Other references:**
- NYC Parks, Kings Highway Malls history: https://www.nycgovparks.org/parks/B198/history
- HDC, Fiske Terrace–Midwood Park:
  https://hdc.org/hdc-across-nyc/brooklyn/brooklyn-landmarked/fiske-terrace-midwood-park/
- Brownstoner, Fiske Terrace historic district:
  https://www.brownstoner.com/architecture/midwood-brooklyn-architecture-fiske-terrace-historic-district
- Forgotten NY, Midwood/Flatlands walk: https://forgotten-ny.com/?p=116959
- Forgotten NY, Kings Highway: https://forgotten-ny.com/?p=28827
- NYC 311, alternate-side parking: https://portal.311.nyc.gov/article?kanumber=KA-01011
- NYC street cleaning: https://www.nyc.gov/asp
- Untapped Cities, NYC school architecture: https://www.untappedcities.com/cbj-snyder-shools/
- OpenStreetMap data (© OpenStreetMap contributors, ODbL), downloaded via
  https://api.openstreetmap.org/api/0.6/map for the bounding box above. The street-grid,
  one-way, lane, rail-crossing and building-height figures in §2 are derived from it.

**Open items to verify with Street View before final art:**
1. Avenue I and Avenue H have no road crossing at the Brighton line.
2. Embankment wall vs. berm treatment, and its height.
3. Which Ocean Pkwy mall carries the bike path today.
4. Exact Fiske Terrace boundaries.
5. Kings Hwy lane counts at specific blocks.
6. Bus route numbers on each arterial.
