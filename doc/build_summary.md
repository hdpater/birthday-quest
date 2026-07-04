# Birthday Quest — Game Design Summary

## Overview

A custom RPG built for a friend's 50th birthday. The player moves a hero around a
procedurally generated island, collecting 50 candles and visiting special locations.
The goal is to deliver all 50 candles to the Warlock in the Castle to trigger the
birthday finale.

---

## Hero State

| Field | Range | Notes |
|---|---|---|
| `health` | 0–100 | Drops to 0 = dead, game over |
| `gold` | 0+ | Found in treasure chests or on monsters; spent in shops |
| `candles` | 0–50 | Primary win condition |
| `baseStrength` | 10+ | Increases on level-up after defeating higher-level monsters |
| `baseSkill` | 12+ | As above |
| `baseArmour` | 0+ | Modified by equipped items |
| `inventory` | list (max 5) | Carried items not yet equipped |
| `equipped` | 6 slots | head, body, right\_hand, left\_hand, finger, feet |

Initial hero state: health 100, gold 10, candles 0, strength 10, skill 12, armour 0.
Hero starts at **The Portly Pixie** tavern (top-left corner of island).

---

## Island Generation (`GenerateMaps.py`)

A single script that reproduces `maps.js` exactly. All tunable parameters (seeds,
bite size, biome thresholds, pathway noise) are grouped at the top. The pipeline runs
in eight steps:

### Step 1 — Island shape
- Start with a full 256×256 grid (all land)
- Repeat: pick a random **coastal** cell, remove the 51 nearest land cells by
  Euclidean distance (a circular bite)
- Every 20 bites: flood-fill from the grid centre to prune any disconnected land
- Stop when 25% of cells (≈16,384) have been removed
- Seed: `ISLAND_SEED = 42`

### Step 2 — Building placement
Eight buildings are placed at the nearest land cell to fixed geographic targets
(corners, edges, centre). No seed needed — fully deterministic from the land shape.

| Building | Type | Target corner/position |
|---|---|---|
| The Portly Pixie | Tavern | Top-left (0,0) |
| The Castle | Castle | Bottom-right (255,255) |
| Star & Garter | Tavern | Top-right (255,0) |
| Bedford Inn | Tavern | Bottom-left (0,255) |
| Woodland Tavern | Tavern | Top-centre (128,0) |
| The Jolly Blacksmith | Armourer | Left-lower (64,192) |
| Alvin's Armoury | Armourer | Right-upper (192,64) |
| Elethran's Magic Shop | Magic shop | Centre (128,128) |

### Step 3 — Guardian placement
Eight guardians placed one per zone (2× forest, 2× desert, 2× plains, 2× coastal),
each at least 10 Manhattan-distance from any existing placed location.
Seed: `GUARDIAN_SEED = 77`

Note: guardian zone assignment uses a secondary Voronoi biome (seed 12345, kept
internally) that differs from the final BIOME data. This is intentional — it matches
the original BuildIsland.py behaviour so guardian positions are reproduced exactly.

### Step 4 — Dragon and arena
- **Dragon**: random cell 5–20 BFS steps from the Castle. Seed: `DRAGON_SEED = 999`
- **Arena**: random cell 4–10 BFS steps from The Portly Pixie. Seed: `ARENA_SEED = 123`

### Step 5 — DIST array
BFS distances from The Portly Pixie to every land cell. Used by the game to scale
monster difficulty (deeper into the island = harder monsters). `MAX_DIST = 444`.

### Step 6 — Biome assignment
Each land cell assigned forest / plains / desert via a diagonal gradient warped by
Perlin noise:
- Compute `diag = (wx + wy) / (2 × SIZE)` where (wx, wy) is the noise-warped position
- `diag < 0.38` → forest (top-left), `diag > 0.62` → desert (bottom-right), else plains
- Seed: `BIOME_SEED = 99999`; warp strength 35px; noise frequency 0.025

Biome colours: forest = dark green `#2d6a27`, plains = brown `#8b6914`,
desert = yellow `#d4a843`, sea = blue `#1a4e8a`.

### Step 7 — Pathway network
Roads connecting all special locations (buildings, guardians, dragon, arena):
- Prim's MST to find the minimal spanning connection tree, starting from Portly Pixie
- Each MST edge traced with A* using noise-perturbed move costs (wandering roads)
- Path widened by 1 cell with probability 0.35
- Seed: `PATHWAY_SEED = 777`; noise weight 5.0

### Step 8 — Output
Writes `maps.js` containing: `LAND`, `BIOME`, `BIOME_COL`, `BIOME_RGB`,
`BIOME_LABEL`, `DIST`, `PATHWAY`, `MAX_DIST`, `SIZE`.

---

## Buildings

When the hero steps onto a building cell, a dialogue opens.

### Taverns (Portly Pixie, Star & Garter, Bedford Inn, Woodland Tavern)
- Buy food items (Wham Bar 1g, Monster Munch 5g, Butterfinger 15g, 5th Avenue 50g,
  Hot Can of Coffee 80g, Cherry 7-up 150g) — added to inventory, eaten later to heal
- Full board (free): restores health to 100
- Save / load game

### Armourers (Jolly Blacksmith, Alvin's Armoury)
- Buy weapons (Dagger 8g → Great Sword 1500g) and armour (Leather 8g → Mithril 2750g)
- Sell items at 50% of purchase price (rounded up)

### Magic Shop (Elethran's)
- Buy magic items: rings, wands, potions with random types (fire, lightning, iron,
  green, sun, frost, arcane)
- Sell at 80% of purchase price (rounded up)

### Castle
- Win condition: visit with all 50 candles to trigger the birthday finale

---

## Guardians & Riddles

Eight guardians placed around the island. Answering the riddle correctly rewards
+100 gold and +5 candles. Wrong answer triggers a combat encounter.

| Guardian | Riddle | Answer |
|---|---|---|
| Sea Golem | Attack, attack, attack — use what? Defend, defend… | 6 |
| Mermaid | What is the real name of your friend Pelvis? | Andrew Davis |
| Iron Golem | And now on Radio 4… what violent display of psychopathy? | Debate |
| Granite Statue | What is the last name of Izembard Zachariah? | Thump |
| Forest Golem | After tequila comes vodka. What comes after vodka? | Tequila |
| Oak Statue | The Innkeeper is called Roger. What is his wife called? | Helen |
| Sand Golem | France, USA, Egypt and Jordan — where next? | Japan |
| Sphinx | What is the profession of Rathiel? | Mage |

---

## Monsters

Monsters spawn dynamically based on BFS distance from The Portly Pixie. Monster
level scales from ~5 (near start) to ~31 (far corner). Defeating a monster whose
level ≥ hero's level may trigger a stat increase (strength or skill +1).

---

## Castle Level Generation (`GenerateCastle.py`)

Produces `castle_level.js` with the castle dungeon layout. Change `CASTLE_SEED` at the
top to generate a different castle. Seed 1 reproduces the layout in `CastleTest` exactly
(map, rooms, door positions, start, stairs). Lock/key assignments differ from `CastleTest`
as those were hand-edited after the original generation.

### Algorithm (BSP dungeon)

**Step 1 — BSP partition:** Recursively split a 62×62 space (1-cell border) into binary
leaves. A leaf splits if it exceeds MAX\_LEAF=19 in either dimension, or with 75%
probability. Minimum leaf size MIN\_LEAF=8.

**Step 2 — Room placement:** Each leaf gets one room, inset 2 cells on each side
(1-cell solid wall + 1-cell corridor clearance). Rooms smaller than 3×3 are skipped.
Retries if fewer than 10 rooms generated.

**Step 3 — Corridor connection:** Working up the BSP tree, each pair of sibling leaves
is connected by:
- Choosing the nearest valid door-slot pair (one cell outside each room's wall, with the
  cell beyond it clear of all wall rings)
- Running A\* between the outer cells through free space only, never through wall rings
  (existing corridor cells cost 0.5 to encourage reuse)
- Marking both door cells and the A\* path as passable

**Step 4 — Entrance:** The room face (mid-edge midpoint) nearest to the grid boundary
gets a straight corridor punched out to the grid edge. That edge cell is `START`.

**Step 5 — BFS + stairs:** BFS distances from `START`; stairs placed at the deepest
reachable cell.

**Step 6 — Lock/key puzzle:** Up to 6 doors are locked (one per key colour). Keys are
placed in rooms reachable from `START` without that lock, ensuring the puzzle is always
solvable. Full reachability validated after key placement.

### Output (`castle_level.js`)
`CSIZE`, `CASTLE_MAP`, `START`, `STAIRS`, `ROOMS_DATA` (with BFS depth),
`DOORS_INIT` (with lock colours), `KEYS_INIT`, `KEY_COLORS`.

---

## Rendering

The game uses a 45×45 cell viewport (each cell 16px = 720px canvas). Terrain is
rendered with:
- Gaussian-weighted colour blending across a 7×7 neighbourhood (smooth biome borders)
- Two-layer noise: large-scale variation + fine sub-cell texture blobs
- Bottom-right darkening gradient (world gets darker/more dangerous toward the Castle)
- Pathway cells rendered as light beige-grey overlay
