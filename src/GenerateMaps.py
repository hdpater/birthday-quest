"""
GenerateMaps.py  —  Full island generation pipeline
Produces maps.js (imported by the game's React component).

Edit the seed/parameter variables in the CONFIGURATION section below
to generate a different island. All other values should be left as-is
unless you understand their effect.

Pipeline:
  1. Generate island shape  (circular coastal bites + flood-fill connectivity)
  2. Place buildings        (nearest-land to fixed target corners)
  3. Place guardians        (one per biome zone + coastal)
  4. Place dragon & arena   (BFS-distance-constrained random positions)
  5. Compute DIST           (BFS from portly_pixie)
  6. Assign biomes          (diagonal gradient + Perlin warp)
  7. Trace pathways         (Prim's MST of locations + A* with noise)
  8. Write maps.js
"""

import random, math, heapq, time, os

t0 = time.time()

# ═══════════════════════════════════════════════════════════════════
#  CONFIGURATION  —  edit seeds here to generate a fresh island
# ═══════════════════════════════════════════════════════════════════

SIZE              = 256     # grid width and height (keep as power of 2)

# Step 1 – island shape
ISLAND_SEED       = 42      # controls which coastal cells are bitten
BITE_SIZE         = 51      # land cells removed per coastal bite
BITES_PER_LOOP    = 20      # bites between each connectivity check
REMOVE_FRACTION   = 0.25    # fraction of total cells to remove

# Step 3 – guardian placement
GUARDIAN_SEED     = 77      # shuffle order when placing the 8 guardians

# Step 4 – dragon and arena placement
DRAGON_SEED       = 999     # picks dragon position from candidates near castle
ARENA_SEED        = 123     # picks arena position from candidates near tavern

# Step 6 – biome assignment
BIOME_SEED        = 99999   # Perlin noise seed for biome boundary warp
BIOME_WARP        = 35.0    # warp strength in world pixels (higher = wilder borders)
BIOME_NS          = 0.025   # noise frequency (lower = smoother)
BIOME_LOW         = 0.38    # diagonal threshold below which a cell is forest
BIOME_HIGH        = 0.62    # diagonal threshold above which a cell is desert

# Step 7 – pathway network
PATHWAY_SEED      = 777     # noise seed for A* cost perturbation
PATHWAY_NOISE_WEIGHT = 5.0  # how strongly noise bends paths (0 = straight)
PATHWAY_WIDEN_PROB   = 0.35 # probability of adding a neighbour cell to widen path

# Output
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "maps.js")

# ═══════════════════════════════════════════════════════════════════
#  STEP 1 — Generate island shape
# ═══════════════════════════════════════════════════════════════════
print("Step 1: Generating island shape...")
random.seed(ISLAND_SEED)

grid = [[True] * SIZE for _ in range(SIZE)]
total = SIZE * SIZE
target_removed = int(total * REMOVE_FRACTION)

def neighbours4(x, y):
    return [(nx, ny) for nx, ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]
            if 0 <= nx < SIZE and 0 <= ny < SIZE]

def is_coastal(x, y):
    if x == 0 or y == 0 or x == SIZE-1 or y == SIZE-1:
        return True
    return any(not grid[ny][nx] for nx, ny in neighbours4(x, y))

def flood_fill_from_centre():
    """Flood-fill land from the centre cell; prune any disconnected land."""
    cx, cy = SIZE // 2, SIZE // 2
    if not grid[cy][cx]:
        # Centre is sea — find nearest land cell by Manhattan distance
        for r in range(1, SIZE):
            found = False
            for dx in range(-r, r+1):
                for dy in range(-r, r+1):
                    if abs(dx) + abs(dy) == r:
                        nx2, ny2 = cx+dx, cy+dy
                        if 0 <= nx2 < SIZE and 0 <= ny2 < SIZE and grid[ny2][nx2]:
                            cx, cy = nx2, ny2
                            found = True
                            break
                if found:
                    break
            if found:
                break
    visited = [[False] * SIZE for _ in range(SIZE)]
    queue = [(cx, cy)]
    visited[cy][cx] = True
    head = 0
    while head < len(queue):
        x, y = queue[head]; head += 1
        for nx, ny in neighbours4(x, y):
            if grid[ny][nx] and not visited[ny][nx]:
                visited[ny][nx] = True
                queue.append((nx, ny))
    pruned = 0
    for y in range(SIZE):
        for x in range(SIZE):
            if grid[y][x] and not visited[y][x]:
                grid[y][x] = False
                pruned += 1
    return pruned

def delete_bite(n=BITE_SIZE):
    """Pick a random coastal cell; remove the n nearest land cells (circular bite)."""
    coastal = [(x, y) for y in range(SIZE) for x in range(SIZE)
               if grid[y][x] and is_coastal(x, y)]
    if not coastal:
        return 0
    sx, sy = random.choice(coastal)
    land = [(math.sqrt((x-sx)**2 + (y-sy)**2), x, y)
            for y in range(SIZE) for x in range(SIZE) if grid[y][x]]
    land.sort()
    for _, x, y in land[:n]:
        grid[y][x] = False
    return min(n, len(land))

def count_land():
    return sum(grid[y][x] for y in range(SIZE) for x in range(SIZE))

removed_total = 0
outer = 0
while removed_total < target_removed:
    outer += 1
    for _ in range(BITES_PER_LOOP):
        delete_bite()
    flood_fill_from_centre()
    removed_total = total - count_land()
    print(f"  Loop {outer:3d}: removed {removed_total}/{target_removed} "
          f"({removed_total/total*100:.1f}%)")

flood_fill_from_centre()
land_compact = "".join("1" if grid[y][x] else "0"
                       for y in range(SIZE) for x in range(SIZE))
land_cells = [(x, y) for y in range(SIZE) for x in range(SIZE) if grid[y][x]]
print(f"  Land cells: {len(land_cells)}, removed: {land_compact.count('0')}")

# ═══════════════════════════════════════════════════════════════════
#  STEP 2 — Place buildings at fixed geographic corners
# ═══════════════════════════════════════════════════════════════════
print("Step 2: Placing buildings...")

def nearest_land(tx, ty):
    return min(land_cells, key=lambda p: (p[0]-tx)**2 + (p[1]-ty)**2)

buildings = {
    "portly_pixie": list(nearest_land(0,           0          )),
    "castle":        list(nearest_land(SIZE-1,      SIZE-1     )),
    "star_garter":   list(nearest_land(SIZE-1,      0          )),
    "bedford_inn":   list(nearest_land(0,           SIZE-1     )),
    "woodland":      list(nearest_land(SIZE//2,     0          )),
    "jolly_smith":   list(nearest_land(SIZE//4,     SIZE*3//4  )),
    "alvin":         list(nearest_land(SIZE*3//4,   SIZE//4    )),
    "elethran":      list(nearest_land(SIZE//2,     SIZE//2    )),
}
for name, pos in buildings.items():
    print(f"  {name}: {pos}")

# ═══════════════════════════════════════════════════════════════════
#  STEP 3 — Place guardians (one per biome + coastal)
# ═══════════════════════════════════════════════════════════════════
print("Step 3: Placing guardians...")

# Biome needed for guardian placement; full biome assigned in step 6,
# but BuildIsland.py used its own (seed 12345) Voronoi biome purely for
# guard placement — we replicate that here so guardian positions are identical.
def make_noise(seed):
    random.seed(seed)
    TABLE = 256
    perm = list(range(TABLE))
    for i in range(TABLE-1, 0, -1):
        j = random.randint(0, i)
        perm[i], perm[j] = perm[j], perm[i]
    vals = [random.random() * 2 - 1 for _ in range(TABLE)]
    def fade(t): return t*t*t*(t*(t*6-15)+10)
    def lerp(a, b, t): return a + t*(b-a)
    def noise(x, y):
        xi = int(x) & (TABLE-1); yi = int(y) & (TABLE-1)
        xf = x - int(x); yf = y - int(y)
        u = fade(xf); v = fade(yf)
        aa = perm[(perm[xi  ]+yi  ) & (TABLE-1)]
        ab = perm[(perm[xi  ]+yi+1) & (TABLE-1)]
        ba = perm[(perm[xi+1]+yi  ) & (TABLE-1)]
        bb = perm[(perm[xi+1]+yi+1) & (TABLE-1)]
        return lerp(lerp(vals[aa], vals[ba], u),
                    lerp(vals[ab], vals[bb], u), v)
    return noise

# Voronoi biome used only for guardian cell lists (matches BuildIsland.py exactly)
_nfn = make_noise(12345)
random.seed(12345)
_biome_names = ["forest", "plains", "desert"]
_seeds = []; _min_dist = SIZE * 0.25; _tries = 0
while len(_seeds) < 6 and _tries < 5000:
    _tries += 1
    cx, cy = random.choice(land_cells)
    if any(((s[0]-cx)**2 + (s[1]-cy)**2)**0.5 < _min_dist for s in _seeds):
        continue
    bi = [0, 0, 0]
    for s in _seeds: bi[s[2]] += 1
    _seeds.append((cx, cy, bi.index(min(bi))))

_WARP = SIZE * 0.35; _NS = 0.18 / 8
def _voronoi_biome(x, y):
    wx = x + _WARP * _nfn(x*_NS, y*_NS+100)
    wy = y + _WARP * _nfn(x*_NS+200, y*_NS+300)
    nearest = _seeds[0][2]; nd = 1e9
    for sx, sy, bi in _seeds:
        d = (sx-wx)**2 + (sy-wy)**2
        if d < nd: nd = d; nearest = bi
    return _biome_names[nearest]

bld_set = set(map(tuple, buildings.values()))
is_coastal_cell = lambda x, y: any(not grid[ny][nx] for nx, ny in neighbours4(x, y))

forest_cells  = [(x,y) for x,y in land_cells if _voronoi_biome(x,y)=="forest"  and (x,y) not in bld_set]
desert_cells  = [(x,y) for x,y in land_cells if _voronoi_biome(x,y)=="desert"  and (x,y) not in bld_set]
plains_cells  = [(x,y) for x,y in land_cells if _voronoi_biome(x,y)=="plains"  and (x,y) not in bld_set]
coastal_cells = [(x,y) for x,y in land_cells if is_coastal_cell(x,y)           and (x,y) not in bld_set]

random.seed(GUARDIAN_SEED)

def place_one(cells, excl):
    avail = [c for c in cells if c not in excl]
    random.shuffle(avail)
    for c in avail:
        if not any(abs(c[0]-p[0]) + abs(c[1]-p[1]) < 10 for p in excl):
            return c
    return avail[0]

placed = set(bld_set)
guardians = {}
for gid, cells in [
    ("forest_golem", forest_cells), ("oak_statue",  forest_cells),
    ("sand_golem",   desert_cells), ("sphinx",       desert_cells),
    ("iron_golem",   plains_cells), ("granite",      plains_cells),
    ("sea_golem",    coastal_cells),("mermaid",      coastal_cells),
]:
    pos = place_one(cells, placed)
    guardians[gid] = list(pos)
    placed.add(pos)
    print(f"  {gid}: {pos}")

# ═══════════════════════════════════════════════════════════════════
#  STEP 4 — Place dragon (near castle) and arena (near tavern)
# ═══════════════════════════════════════════════════════════════════
print("Step 4: Placing dragon and arena...")

def bfs_from(sx, sy, max_d=None):
    dist = {(sx,sy): 0}; q = [(sx,sy)]; head = 0
    while head < len(q):
        x, y = q[head]; head += 1
        if max_d and dist[(x,y)] >= max_d:
            continue
        for nx, ny in neighbours4(x, y):
            if grid[ny][nx] and (nx,ny) not in dist:
                dist[(nx,ny)] = dist[(x,y)] + 1
                q.append((nx,ny))
    return dist

castle = tuple(buildings["castle"])
dc = bfs_from(*castle, max_d=21)
dragon_cands = [p for p, d in dc.items() if 5 <= d <= 20 and p not in placed]
random.seed(DRAGON_SEED)
dragon_pos = random.choice(dragon_cands)
placed.add(dragon_pos)

pixie = tuple(buildings["portly_pixie"])
dp = bfs_from(*pixie, max_d=11)
arena_cands = [p for p, d in dp.items() if 4 <= d <= 10 and p not in placed]
random.seed(ARENA_SEED)
arena_pos = random.choice(arena_cands)

print(f"  Dragon: {dragon_pos}")
print(f"  Arena:  {arena_pos}")

# ═══════════════════════════════════════════════════════════════════
#  STEP 5 — Compute DIST (BFS distances from portly_pixie)
# ═══════════════════════════════════════════════════════════════════
print("Step 5: Computing BFS distances from portly_pixie...")

dist_map = bfs_from(*pixie)
max_dist = max(dist_map.values())
dist_flat = [dist_map.get((x,y), -1) for y in range(SIZE) for x in range(SIZE)]
print(f"  max_dist: {max_dist}")

# ═══════════════════════════════════════════════════════════════════
#  STEP 6 — Assign biomes (diagonal gradient + Perlin warp)
# ═══════════════════════════════════════════════════════════════════
print("Step 6: Assigning biomes...")

nfn = make_noise(BIOME_SEED)

biome_compact = ""
for y in range(SIZE):
    for x in range(SIZE):
        if not grid[y][x]:
            biome_compact += "s"
            continue
        wx = x + BIOME_WARP * nfn(x * BIOME_NS,       y * BIOME_NS + 10)
        wy = y + BIOME_WARP * nfn(x * BIOME_NS + 20,  y * BIOME_NS + 30)
        diag = (wx + wy) / (2.0 * SIZE)
        if diag < BIOME_LOW:
            biome_compact += "f"
        elif diag > BIOME_HIGH:
            biome_compact += "d"
        else:
            biome_compact += "p"

counts = {b: biome_compact.count(b) for b in "fpds"}
print(f"  f={counts['f']}, p={counts['p']}, d={counts['d']}, s={counts['s']}")

# ═══════════════════════════════════════════════════════════════════
#  STEP 7 — Trace pathway network (Prim's MST + noisy A*)
# ═══════════════════════════════════════════════════════════════════
print("Step 7: Tracing pathway network...")

random.seed(PATHWAY_SEED)
noise_grid = [[random.random() for _ in range(SIZE)] for _ in range(SIZE)]

is_land = lambda x, y: 0 <= x < SIZE and 0 <= y < SIZE and grid[y][x]

def astar(sx, sy, tx, ty):
    g = {(sx,sy): 0}
    parent = {(sx,sy): None}
    h = lambda x, y: math.sqrt((x-tx)**2 + (y-ty)**2)
    heap = [(h(sx,sy), sx, sy)]
    while heap:
        _, cx, cy = heapq.heappop(heap)
        if cx == tx and cy == ty:
            path = []
            pos = (cx, cy)
            while pos:
                path.append(pos)
                pos = parent[pos]
            return list(reversed(path))
        for nx, ny in [(cx-1,cy),(cx+1,cy),(cx,cy-1),(cx,cy+1)]:
            if not is_land(nx, ny):
                continue
            cost = g[(cx,cy)] + 1.0 + noise_grid[ny][nx] * PATHWAY_NOISE_WEIGHT
            if (nx,ny) not in g or cost < g[(nx,ny)]:
                g[(nx,ny)] = cost
                parent[(nx,ny)] = (cx,cy)
                heapq.heappush(heap, (cost + h(nx,ny), nx, ny))
    return None

def bfs_dist_from(sx, sy):
    dist = {(sx,sy): 0}; q = [(sx,sy)]; head = 0
    while head < len(q):
        x, y = q[head]; head += 1
        for nx, ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
            if is_land(nx,ny) and (nx,ny) not in dist:
                dist[(nx,ny)] = dist[(x,y)] + 1
                q.append((nx,ny))
    return dist

# All special locations for the MST
locations = {}
for k, v in buildings.items():  locations[k] = tuple(v)
for k, v in guardians.items():  locations[k] = tuple(v)
locations["dragon"] = tuple(dragon_pos)
locations["arena"]  = tuple(arena_pos)

loc_names = list(locations.keys())
loc_pos   = locations

# Prim's MST starting from portly_pixie
in_tree = {"portly_pixie"}
edges = []
while len(in_tree) < len(loc_names):
    best_dist = 1e9; best_from = None; best_to = None
    for name in in_tree:
        sx, sy = loc_pos[name]
        dist = bfs_dist_from(sx, sy)
        for other in loc_names:
            if other in in_tree: continue
            ox, oy = loc_pos[other]
            d = dist.get((ox,oy), 1e9)
            if d < best_dist:
                best_dist = d; best_from = name; best_to = other
    if best_to is None:
        break
    in_tree.add(best_to)
    edges.append((best_from, best_to))
    print(f"  MST: {best_from} → {best_to} (dist {best_dist})")

pathway_cells = set()
for src, dst in edges:
    sx, sy = loc_pos[src]
    tx, ty = loc_pos[dst]
    path = astar(sx, sy, tx, ty)
    if path:
        for x, y in path:
            pathway_cells.add((x,y))
            for nx, ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                if is_land(nx,ny) and random.random() < PATHWAY_WIDEN_PROB:
                    pathway_cells.add((nx,ny))
        print(f"  Path {src}→{dst}: {len(path)} steps")
    else:
        print(f"  WARNING: no path found {src}→{dst}")

pathway_flat = [1 if (x,y) in pathway_cells else 0
                for y in range(SIZE) for x in range(SIZE)]
print(f"  Total pathway cells: {sum(pathway_flat)}")

# ═══════════════════════════════════════════════════════════════════
#  STEP 8 — Write maps.js
# ═══════════════════════════════════════════════════════════════════
print("Step 8: Writing maps.js...")

land_js    = f'"{land_compact}"'
biome_js   = f'"{biome_compact}"'
dist_js    = "[" + ", ".join(str(v) for v in dist_flat) + "]"
pathway_js = "[" + ", ".join(str(v) for v in pathway_flat) + "]"

output = f"""// ── Map data ─────────────────────────────────────────────────────────────────
export const SIZE = {SIZE};
export const LAND  = {land_js};
export const BIOME = {biome_js};
export const BIOME_COL={{f:"#2d6a27",p:"#8b6914",d:"#d4a843",s:"#1a4e8a"}};
export const BIOME_RGB={{f:[45,106,39],p:[171,201,84],d:[212,168,67],s:[26,78,138]}};
export const BIOME_LABEL={{f:"Forest",p:"Plains",d:"Desert",s:"Sea"}};
export const DIST  = {dist_js};
export const PATHWAY = {pathway_js};
export const MAX_DIST = {max_dist};
"""

with open(OUTPUT_PATH, "w") as f:
    f.write(output)

print(f"  Written to {OUTPUT_PATH} ({os.path.getsize(OUTPUT_PATH)//1024} KB)")
print(f"  Total time: {time.time()-t0:.1f}s")
