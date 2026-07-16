# Birthday Game — Design Summary

## 1. Island Generation

### Overview
The world is a connected island on a 256×256 grid (32×32 for testing), surrounded by impassable sea. 25% of squares are removed to create an organic coastline.

### Algorithm
1. Start with a full N×N grid of land squares.
2. Repeatedly pick a random land square and attempt to remove it, subject to two conditions:
   - **Coastal rule:** The square must be coastal — i.e. it touches the grid edge or an existing sea square. This prevents inland removal and guarantees no lakes.
   - **Connectivity rule:** Before removing, run a full BFS/flood-fill from any other land cell (excluding the candidate). The removal is only allowed if every remaining land cell is reachable — i.e. the island stays fully connected.
3. Continue until 25% of squares have been removed (or max attempts reached).

### Biome Assignment
The island is divided into three biomes — **Forest**, **Plains**, **Desert** — using a noise-warped Voronoi approach:

1. Place **6 seed points** on the island (2 per biome), enforcing a minimum separation of ~25% of grid width to ensure good spread.
2. For each land cell, compute its distance to every seed. Before comparing distances, **warp the lookup point** using a value-noise function (warp amplitude ~35% of grid size, noise frequency ~0.18). This curves the Voronoi boundaries into organic shapes.
3. Assign the cell to the biome of its nearest (warped-distance) seed.

### Colours (display)
| Terrain | Colour |
|---------|--------|
| Sea     | Blue `#1a4e8a` |
| Forest  | Dark green `#2d6a27` |
| Plains  | Brown `#8b6914` |
| Desert  | Yellow `#d4a843` |

### Movement
The hero stores position as (x, y) and can move up/down/left/right, provided the destination square is land (not sea).

---

## 2. Buildings & Shops

### General
Buildings are fixed locations on the island. When the hero steps onto a building square, a menu is presented. Items can be bought (deducting gold) or sold (refunding a percentage of purchase price, rounded up). Purchased slotted items prompt the player to equip immediately or stash in inventory.

---

### 2a. Armourer
Trades gold for weapons, armour, boots, and shields. **Sell-back rate: 50%** (rounded up).

#### Weapons
| Item | Slot | Price |
|------|------|-------|
| Dagger | Right hand | 8g |
| Mace | Right hand | 12g |
| Short Sword | Right hand | 18g |
| Long Sword | Right hand | 28g |
| Great Sword | Both hands | 40g |

> Great Sword occupies both the left and right hand slots simultaneously.

#### Armour
| Item | Slot | Price |
|------|------|-------|
| Leather Armour | Body | 10g |
| Chainmail | Body | 25g |
| Plate Armour | Body | 50g |
| Mithril Armour | Body | 90g |

#### Other
| Item | Slot | Price |
|------|------|-------|
| Iron-shod Boots | Feet | 12g |
| Wooden Shield | Left hand | 15g |

---

### 2b. Magic Shop
Trades gold for magic items. Each item is assigned a random type from: Green, Sun, Iron, Fire, Lightning, Frost, Shadow, Arcane. Stock is randomised each visit. **Sell-back rate: 80%** (rounded up).

| Item | Slot | Price |
|------|------|-------|
| Ring | Finger | 20g |
| Wand | Right hand | 30g |
| Potion | (inventory only) | 15g |

---

### 2c. Tavern
Offers food (carried in inventory and eaten later) and overnight board (immediate full heal).

#### Food items
| Item | Price | Health restored |
|------|-------|----------------|
| Wham Bar | 1g | 5% |
| Monster Munch | 2g | 10% |
| Butterfinger | 5g | 20% |
| 5th Avenue Bar | 10g | 40% |
| Hot Can of Coffee | 12g | 60% |
| Coca-Cola | 20g | 100% |

- Food is added to inventory on purchase and consumed (removed) when eaten.
- Health is capped at 100%; excess healing is lost.

#### Board for the night
- **Cost:** 10g
- **Effect:** Immediately restores health to 100%.

---

## 4. Guardians

### Overview
8 guardian types, placed at randomly chosen locations on the island at game start. Each guardian is assigned one riddle from the pool (randomly, one per guardian). Region determines which guardian types can appear:

| Region | Guardians |
|--------|-----------|
| Forest | Forest Golem, Oak Statue |
| Desert | Sand Golem, Sphinx |
| Plains | Iron Golem, Granite Statue |
| Adjacent to sea | Sea Golem, Mermaid |

### Images
Portraits are sliced from a single 4×2 grid image using CSS `background-size: 400% 200%` and `background-position` per cell (col 0–3, row 0–1).

### Encounter flow
1. Guardian portrait and riddle are displayed.
2. Player types their answer and submits.
3. **Correct:** +25 gold, +5 candles. Guardian stands aside.
4. **Wrong:** Random damage 1–25% health. Guardian delivers an angry flavour response. Answer is not revealed.
5. Player may **Flee** before answering with no penalty.

### Riddles & accepted answers
| Question | Accepted answers |
|----------|-----------------|
| Attack, attack, attack — use what? Defend, defend… | 6 |
| Real name of your friend Pelvis | andrew davis, andy davis, andrew, andy |
| And now on Radio 4… what violent display of psychopathy? | debate |
| After tequila comes vodka. What comes after vodka? | tequila |
| The Innkeeper is called Roger. What is his wife called? | helen |
| Last name of Izembard Zachariah | thump |
| France, USA, Egypt and Jordan — where next? | japan |
| Profession of Rathiel | mage, wizard |

---

## 5. Monsters

### Overview
100 monsters stored as a grid image (1092×1092px, 10×10 cells, 2px white borders, 107px cell content). Each monster is sliced via CSS absolute positioning. Monsters are randomly encountered on the island; harder monsters appear in deeper/later regions.

### Image slicing
- Cell origin: `x = 2 + col × 109`, `y = 2 + row × 109`
- Rendered by scaling the full image and clipping to a fixed-size container

### Monster attributes
| Attribute | Description |
|-----------|-------------|
| Health | 0–100 |
| Strength | Damage dealt per hit |
| Skill | Hit chance (vs opponent skill) |
| Armour | Flat damage reduction |
| Attacks | Hits per round (scaled by health, rounded up) |
| Level | Difficulty rating (see below) |

### Combat mechanics
- **Hit chance** = `attacker_skill / (attacker_skill + defender_skill)` (both degraded by HP%)
- **Damage** = `max(0, attacker_strength − defender_armour)` (strength degraded by HP%)
- **Stat degradation**: `effective = round(base × hp / 100)`. Attacks use `ceil`. Displayed as `current/base` when degraded.
- **Flee**: 80% success. On failure, monster gets one free hit.
- Each round: hero attacks once, then monster attacks `attacks` times.

### Difficulty level
Each monster has a **level** computed by simulation: find the hero stat value X (strength = skill = armour = X) that gives 3–7 wins out of 10 trials. This is the ~50% difficulty threshold.

### Full monster roster
| Idx | Name | Str | Skl | Arm | Atk | Level |
|-----|------|-----|-----|-----|-----|-------|
| 0 | Skeleton | 7 | 6 | 2 | 1 | 5 |
| 1 | Skeleton Pair | 6 | 10 | 3 | 3 | 5 |
| 2 | Ogre | 7 | 9 | 4 | 1 | 5 |
| 3 | Dark Cultist | 12 | 8 | 4 | 1 | 8 |
| 4 | Vampire | 9 | 6 | 6 | 1 | 8 |
| 5 | Vampire Lord | 7 | 7 | 5 | 1 | 6 |
| 6 | Demon Bat | 5 | 9 | 6 | 1 | 7 |
| 7 | Goblin Rabble | 7 | 12 | 4 | 3 | 7 |
| 8 | Goblin Pack | 10 | 8 | 3 | 3 | 8 |
| 9 | Minotaur | 23 | 9 | 6 | 1 | 12 |
| 10 | Hellspawn Horde | 15 | 11 | 6 | 3 | 11 |
| 11 | Necromancer | 15 | 12 | 9 | 3 | 13 |
| 12 | Horned Abomination | 10 | 9 | 9 | 1 | 10 |
| 13 | Skeletal Warrior | 9 | 13 | 7 | 1 | 8 |
| 14 | Spectre | 15 | 15 | 7 | 1 | 11 |
| 15 | Ghoul | 8 | 7 | 6 | 1 | 7 |
| 16 | Dark Witch | 14 | 8 | 6 | 1 | 10 |
| 17 | Winged Demon | 8 | 10 | 3 | 3 | 7 |
| 18 | Orc Mob | 10 | 11 | 4 | 3 | 8 |
| 19 | Spiked Brute | 14 | 8 | 4 | 1 | 8 |
| 20 | Plague Walkers | 13 | 13 | 10 | 3 | 11 |
| 21 | Shadow Fiends | 13 | 16 | 11 | 3 | 13 |
| 22 | Chaos Spawn | 12 | 17 | 9 | 1 | 11 |
| 23 | Bone Horror | 17 | 15 | 7 | 1 | 11 |
| 24 | Goblin Scouts | 11 | 11 | 6 | 3 | 9 |
| 25 | Goblin Mob | 12 | 11 | 6 | 3 | 10 |
| 26 | Rotting Giant | 15 | 16 | 10 | 1 | 13 |
| 27 | Goblin Warriors | 17 | 11 | 10 | 3 | 14 |
| 28 | Goblin Shaman | 12 | 11 | 7 | 1 | 10 |
| 29 | Hunter Beast | 15 | 11 | 6 | 1 | 10 |
| 30 | Swamp Zombie | 17 | 20 | 9 | 1 | 13 |
| 31 | Banshee | 17 | 16 | 8 | 1 | 13 |
| 32 | Chaos Warrior | 21 | 21 | 11 | 1 | 16 |
| 33 | Thorn Beast | 17 | 17 | 9 | 1 | 13 |
| 34 | Goblin Fighter | 19 | 19 | 9 | 3 | 16 |
| 35 | Goblin Brute | 21 | 19 | 8 | 1 | 15 |
| 36 | Forest Troll | 20 | 19 | 8 | 1 | 14 |
| 37 | Goblin Raider | 16 | 19 | 7 | 1 | 11 |
| 38 | Claw Horror | 18 | 21 | 9 | 1 | 14 |
| 39 | Orc Champion | 18 | 21 | 12 | 1 | 15 |
| 40 | Cursed Sorcerer | 24 | 21 | 15 | 1 | 19 |
| 41 | Goblin Horde | 19 | 23 | 11 | 3 | 16 |
| 42 | Tusked Demon | 23 | 21 | 11 | 1 | 17 |
| 43 | Spine Crawler | 23 | 21 | 15 | 1 | 19 |
| 44 | Goblin Warband | 23 | 20 | 11 | 3 | 18 |
| 45 | Shadow Wolf | 24 | 19 | 13 | 1 | 18 |
| 46 | Orc Berserkers | 23 | 24 | 10 | 3 | 18 |
| 47 | Flame Fiend | 23 | 18 | 13 | 1 | 18 |
| 48 | Goblin Skirmishers | 23 | 22 | 14 | 3 | 20 |
| 49 | Orc Warlord | 19 | 23 | 11 | 1 | 15 |
| 50 | Bull Demon | 24 | 20 | 14 | 1 | 19 |
| 51 | Dark Stalker | 21 | 22 | 15 | 1 | 18 |
| 52 | Void Wraith | 27 | 21 | 16 | 1 | 21 |
| 53 | Jaw Beast | 24 | 21 | 15 | 1 | 19 |
| 54 | Tentacle Horror | 27 | 23 | 14 | 1 | 20 |
| 55 | Mind Corruptor | 26 | 25 | 16 | 1 | 21 |
| 56 | Purple Demon | 27 | 21 | 11 | 1 | 18 |
| 57 | Plague Lich | 22 | 22 | 14 | 1 | 18 |
| 58 | Dark Archer | 28 | 23 | 13 | 1 | 21 |
| 59 | Orc War Chief | 25 | 27 | 15 | 1 | 20 |
| 60 | Iron Revenant | 26 | 29 | 19 | 1 | 22 |
| 61 | Chaos Mage | 30 | 26 | 14 | 1 | 21 |
| 62 | Multi-Armed Demon | 28 | 24 | 14 | 1 | 21 |
| 63 | Bone Colossus | 28 | 29 | 17 | 1 | 22 |
| 64 | Lizard Fiend | 27 | 30 | 14 | 1 | 20 |
| 65 | Death Crone | 26 | 25 | 16 | 1 | 20 |
| 66 | Forest Wraith | 31 | 26 | 18 | 1 | 24 |
| 67 | Spider Horror | 31 | 27 | 18 | 1 | 23 |
| 68 | Goblin Raiders | 31 | 26 | 14 | 3 | 25 |
| 69 | Dungeon Brawler | 25 | 25 | 16 | 1 | 20 |
| 70 | Infernal Golem | 27 | 28 | 18 | 1 | 22 |
| 71 | Plague Monks | 30 | 32 | 18 | 3 | 26 |
| 72 | Bone Lord | 32 | 31 | 18 | 1 | 25 |
| 73 | Cave Beast | 31 | 27 | 19 | 1 | 24 |
| 74 | Skull Horde | 28 | 26 | 17 | 3 | 24 |
| 75 | Axe Berserker | 29 | 32 | 16 | 1 | 22 |
| 76 | Dark Warlord | 31 | 31 | 18 | 1 | 24 |
| 77 | Void Mage | 34 | 27 | 16 | 1 | 23 |
| 78 | Sword Wraith | 30 | 29 | 18 | 1 | 25 |
| 79 | Orc Warband | 29 | 30 | 19 | 3 | 25 |
| 80 | Winged Terror | 36 | 35 | 17 | 1 | 28 |
| 81 | Spiked Demon | 36 | 35 | 22 | 1 | 29 |
| 82 | Fire Colossus | 32 | 30 | 22 | 1 | 26 |
| 83 | Horned Demon | 36 | 30 | 22 | 1 | 28 |
| 84 | Dragon Spawn | 36 | 34 | 22 | 1 | 28 |
| 85 | Maw Beast | 36 | 32 | 17 | 1 | 28 |
| 86 | Orc Deathguard | 33 | 34 | 18 | 1 | 25 |
| 87 | Horn Demon | 32 | 30 | 20 | 1 | 25 |
| 88 | Goblin Death Cult | 38 | 35 | 17 | 3 | 31 |
| 89 | Chaos Lord | 34 | 34 | 18 | 1 | 25 |
| 90 | Undead Knight | 40 | 34 | 22 | 1 | 31 |
| 91 | Skull Fiend | 40 | 39 | 19 | 1 | 28 |
| 92 | Thorn Demon | 41 | 39 | 24 | 1 | 31 |
| 93 | Lightning Colossus | 40 | 35 | 21 | 1 | 29 |
| 94 | Void Archer | 34 | 35 | 21 | 1 | 27 |
| 95 | Bone Dragon | 35 | 40 | 24 | 1 | 30 |
| 96 | Flame Warlord | 40 | 34 | 20 | 1 | 31 |
| 97 | Orc Marauder | 37 | 33 | 21 | 1 | 29 |
| 98 | Cursed Goblin | 39 | 35 | 21 | 1 | 29 |
| 99 | Night Terror | 37 | 39 | 19 | 1 | 28 |

---

## 3. Hero State

- **Location:** (x, y) grid coordinate
- **Health:** 0–100%. Death (0%) ends the game.
- **Gold:** 0+. Earned from treasure chests and monsters; spent in shops.
- **Candles:** 0–50. Collecting all 50 and bringing them to the Warlock in the castle wins the game.
- **Equipment slots (6):** Head, Body, Left Hand, Right Hand, Finger, Feet.
- **Inventory:** List of unequipped carried items (food, potions, stashed gear).

---

## 6. Island Placement & Buildings

### Building locations (256×256 full map, 32×32 test)
Buildings are placed at the nearest land cell to their target position:

| Building | Type | Target position | Colour |
|----------|------|----------------|--------|
| The Portly Pixie | Tavern | Top-left corner | Gold |
| The Castle | Castle | Bottom-right corner | Purple |
| Star & Garter | Tavern | Top-right corner | Gold |
| Bedford Inn | Tavern | Bottom-left corner | Gold |
| Woodland Tavern | Tavern | Top-centre | Gold |
| The Jolly Blacksmith | Armourer | Left-lower quarter | Red |
| Alvin's Armoury | Armourer | Right-upper quarter | Red |
| Elethran's Magic Shop | Magic shop | Centre | Green |

### Monster difficulty gradient
- BFS distance is computed from the Portly Pixie to every land cell at game start.
- Monster level at any cell = `round(5 + (dist / max_dist) × 26)`, giving a smooth gradient from level 5 (near Portly Pixie) to level 31 (near the Castle).
- When a monster encounter is triggered, a monster is selected from those whose level is within ±3 of the location's difficulty.

### Monster encounter probability
- Each step onto a new land square has a **5% chance** of triggering a monster encounter.
- Movement halts at the centre of the square where the encounter occurs.
- Entering a building square also halts movement and opens the building dialogue.

---

## 7. Hero Movement

### Algorithm
Path is computed **once per click** using BFS and stored. The hero follows it step by step — no re-evaluation mid-path, which prevents oscillation.

**BFS with Manhattan-sorted neighbours:**
1. Standard BFS from hero position to target, tracking parents for path reconstruction.
2. At each node, the four neighbours are sorted by Manhattan distance to the target before being added to the queue. This means the algorithm explores toward the target first, producing a straight-line path on open land and the shortest route around obstacles.
3. The full path (excluding the start position) is stored in a ref on click.
4. Steps are taken at 80ms intervals, consuming from the front of the path array.

### Stopping conditions
Movement halts (hero snaps to centre of current square) when:
- The path is exhausted (destination reached).
- The next step is a building square → building dialogue opens.
- A random monster encounter triggers (5% per step) → encounter opens.
- Player clicks a new target → path is cleared and recomputed.

### Why not greedy straight-line + detour?
An earlier approach tried to walk straight and only invoke BFS when blocked. This caused oscillation (hero bouncing between two equidistant cells) and suboptimal routes (walking to the coast before detouring). Full upfront BFS eliminates both problems.

---

## 8. Magic Items

### Item types
Three item forms: **Wands** (used in combat as an action), **Potions** (boost hero stats for combat duration), **Rings** (worn, passive effect during combat).

### Magic types & pricing

| Type | Category | Wand | Potion | Ring |
|------|----------|------|--------|------|
| Fire | Main | 25g | 10g | 100g |
| Lightning | Main | 25g | 10g | 100g |
| Iron | Main | 25g | 10g | 100g |
| Green (Fire+Iron) | Compound (4×) | 100g | 40g | 400g |
| Sun (Lightning+Fire) | Compound (4×) | 100g | 40g | 400g |
| Frost (Lightning+Iron) | Compound (4×) | 100g | 40g | 400g |
| Arcane (all three) | Compound (20×) | 500g | 200g | 2000g |

### Wands (used as combat action — replaces Fight that round)

| Type | Effect |
|------|--------|
| Fire | 1–5 damage to monster |
| Lightning | Decrease monster skill by 1–3 |
| Iron | Decrease monster strength by 1–3 |
| Green | Fire + Iron effects |
| Sun | Lightning + Fire effects |
| Frost | Lightning + Iron effects |
| Arcane | Fire + Lightning + Iron effects |

### Potions (consumed on use — boost lasts for combat duration, reverts after)

| Type | Effect |
|------|--------|
| Fire | +1–5 health (can exceed 100 temporarily) |
| Lightning | +1–5 skill |
| Iron | +1–5 strength |
| Green | Fire + Iron effects |
| Sun | Lightning + Fire effects |
| Frost | Lightning + Iron effects |
| Arcane | Fire + Lightning + Iron effects |

### Rings (worn passively — always active while equipped, no action needed)

| Type | Effect per combat round |
|------|------------------------|
| Fire | Recover 1–3 health per round (capped at 100) |
| Iron | +5 armour (flat addition to armour stat) |
| Lightning | +1 extra attack per round |
| Green | Fire + Iron effects |
| Sun | Lightning + Fire effects |
| Frost | Lightning + Iron effects |
| Arcane | Fire + Lightning + Iron effects |

### Notes
- Potion stat boosts are temporary — original values restore after combat ends.
- Ring effects are always active while the ring is equipped (occupies finger slot).
- Wands are consumed on use (removed from inventory).
- Potions are consumed on use (removed from inventory).

---

## 9. Armoury

### Armour items (add to hero armour stat while equipped)

**Body (body slot)**
| Item | Armour bonus | Cost | Sell |
|------|-------------|------|------|
| Leather Armour | +2 | 10g | 5g |
| Chainmail | +4 | 25g | 13g |
| Plate Armour | +7 | 50g | 25g |
| Mithril Armour | +11 | 90g | 45g |

**Helmet (head slot)**
| Item | Armour bonus | Cost | Sell |
|------|-------------|------|------|
| Leather Cap | +1 | 8g | 4g |
| Iron Helm | +2 | 20g | 10g |
| Great Helm | +4 | 45g | 23g |
| Mithril Helm | +6 | 80g | 40g |

**Boots (feet slot)**
| Item | Armour bonus | Cost | Sell |
|------|-------------|------|------|
| Iron-shod Boots | +1 | 12g | 6g |

**Shield (left hand slot)**
| Item | Armour bonus | Cost | Sell |
|------|-------------|------|------|
| Wooden Shield | +2 | 15g | 8g |
| Iron Shield | +4 | 35g | 18g |

### Weapons (add to hero strength for that weapon's attack)

| Item | Slot | Strength bonus | Cost | Sell | Notes |
|------|------|---------------|------|------|-------|
| Dagger | Either hand | +2 | 8g | 4g | |
| Mace | Either hand | +4 | 12g | 6g | |
| Short Sword | Either hand | +5 | 18g | 9g | |
| Long Sword | Right hand only | +7 | 28g | 14g | |
| Great Sword | Both hands | +15 | 80g | 40g | One attack only |

### Combat with weapons
- Each hand generates **one attack per round** (fist if empty — no strength bonus).
- Each weapon's strength bonus applies **independently** to its own attack roll: `rand(0, base_strength + weapon_bonus) - rand(0, monster_armour)`.
- **Left hand** can hold: Dagger, Mace, Short Sword, or Shield (no Long Sword in left hand).
- **Great Sword** occupies both hand slots and gives only **one attack** per round.
- **Dual-wield limit**: maximum one Long Sword; cannot combine Great Sword with anything.

### Sell-back rate: 50% (rounded up)

---

## 11. The Dragon

### Location
Randomly placed within 20 squares (BFS distance) of the castle. Marked on the map with a distinct icon.

### Stats
| Attribute | Value |
|-----------|-------|
| Strength | 40 |
| Skill | 40 |
| Armour | 25 |
| Attacks | 2 |

### Candles
The dragon holds the remaining **10 candles** (8 guardians × 5 = 40; dragon = 10; total = 50).

### Special dialogue
On encounter: *"Ah Jon, now that you are 50, you may have acquired much wisdom, but you are foolish to think you can defeat me. See how lovely and shiny I am. Behold my many treasures and so on. Now run away and bother me no more!"*

### Victory
Defeating the dragon yields 10 candles. The hero must then take all 50 candles to the Warlock in the castle to win the game.

---
*Further sections to be added as development progresses.*
