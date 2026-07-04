"""
GenerateCastle.py  —  Castle level generator
Produces castle_level.js (imported by the game's castle level component).

Change CASTLE_SEED to generate a different castle layout.
The generator retries automatically if a seed produces an invalid layout.

Algorithm (BSP dungeon):
  1. Recursively partition 64×64 space into binary leaves (MIN_LEAF=8, MAX_LEAF=19)
  2. Place one room per leaf (inset by 2+gap on each side)
  3. Connect sibling leaves with door-slot A* corridors (no corridor touches room walls)
  4. Find nearest-to-edge room, punch entrance corridor to grid boundary
  5. BFS distances from entrance; stairs at deepest reachable cell
  6. Lock up to 8 doors; place keys in reachable rooms behind each lock
  7. Validate full reachability (all rooms reachable with all keys collected)
"""

import random, heapq, os
from collections import deque

# ═══════════════════════════════════════════════════════════════════
#  CONFIGURATION
# ═══════════════════════════════════════════════════════════════════

CASTLE_SEED  = 1        # change to generate a different castle
                        # (seed 1 reproduces the layout in CastleTest exactly)

SIZE         = 64       # grid width and height
MIN_LEAF     = 8        # minimum BSP leaf dimension
MAX_LEAF     = 19       # maximum BSP leaf dimension before forced split
MIN_ROOMS    = 10       # retry if fewer rooms generated
MAX_LOCKS    = 6        # maximum number of locked doors (≤ 6 key colours)

OUTPUT_PATH  = os.path.join(os.path.dirname(__file__), "castle_level.js")

# ═══════════════════════════════════════════════════════════════════
#  GENERATOR
# ═══════════════════════════════════════════════════════════════════

KEY_TYPES = ["red", "blue", "green", "yellow", "purple", "orange"]

def generate(seed):
    """
    Returns a dict with map/rooms/doors/keys/start/stairs on success, or None
    if this seed produces an unplayable layout (caller should try next seed).
    """
    random.seed(seed)

    # ── Step 1: BSP partition ──────────────────────────────────────
    class Leaf:
        def __init__(self, x, y, w, h):
            self.x, self.y, self.w, self.h = x, y, w, h
            self.a = self.b = self.room = None

        def split(self):
            if self.a:
                return False
            horiz = random.random() < 0.5
            if self.w > self.h * 1.25:  horiz = False
            elif self.h > self.w * 1.25: horiz = True
            maxd = (self.h if horiz else self.w) - MIN_LEAF
            if maxd < MIN_LEAF:
                return False
            cut = random.randint(MIN_LEAF, maxd)
            if horiz:
                self.a = Leaf(self.x, self.y,       self.w, cut)
                self.b = Leaf(self.x, self.y + cut, self.w, self.h - cut)
            else:
                self.a = Leaf(self.x,       self.y, cut,          self.h)
                self.b = Leaf(self.x + cut, self.y, self.w - cut, self.h)
            return True

    def build(l):
        if (l.w > MAX_LEAF or l.h > MAX_LEAF or random.random() < 0.75) and l.split():
            build(l.a)
            build(l.b)

    root = Leaf(1, 1, SIZE - 2, SIZE - 2)
    build(root)

    leaves = []
    def collect(l):
        if l.a: collect(l.a); collect(l.b)
        else:   leaves.append(l)
    collect(root)

    # ── Step 2: Place rooms in leaves ──────────────────────────────
    rooms = []
    grid  = [[False] * SIZE for _ in range(SIZE)]

    for l in leaves:
        rx, ry = l.x + 1, l.y + 1
        rw, rh = l.w - 4, l.h - 4      # inset 2 each side → 1-cell wall + 1-cell corridor gap
        if rw < 3 or rh < 3:
            l.room = None
            continue
        l.room = len(rooms)
        rooms.append((rx, ry, rw, rh))
        for y in range(ry, ry + rh):
            for x in range(rx, rx + rw):
                grid[y][x] = True

    if len(rooms) < MIN_ROOMS:
        return None

    # Cell → room index lookup, plus the "wall ring" (Chebyshev-1 neighbourhood of rooms)
    cell_room = {}
    for i, (rx, ry, rw, rh) in enumerate(rooms):
        for y in range(ry, ry + rh):
            for x in range(rx, rx + rw):
                cell_room[(x, y)] = i
    room_cells = set(cell_room)

    near8 = set()
    for (x, y) in room_cells:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                n = (x + dx, y + dy)
                if n not in room_cells:
                    near8.add(n)

    # ── Step 3: Connect rooms with corridors ───────────────────────
    doors    = set()
    corridor = set()

    def adj_to_door(c):
        x, y = c
        return any((x + dx, y + dy) in doors
                   for dx in (-1, 0, 1) for dy in (-1, 0, 1))

    def astar(start, goal):
        """
        A* through free space (never through room_cells or near8).
        Prefers reusing existing corridor cells (cost 0.5) to minimise crossings.
        """
        openh = [(0, start)]
        came  = {start: None}
        cost  = {start: 0}
        while openh:
            _, cur = heapq.heappop(openh)
            if cur == goal:
                path = []; c = cur
                while c: path.append(c); c = came[c]
                return path[::-1]
            x, y = cur
            for dx, dy in ((0,1),(0,-1),(1,0),(-1,0)):
                n = (x + dx, y + dy); nx, ny = n
                if not (0 < nx < SIZE-1 and 0 < ny < SIZE-1): continue
                if n in room_cells: continue
                if n in near8 and n != goal and n != start: continue
                ncost = cost[cur] + (0.5 if n in corridor else 1)
                if n not in cost or ncost < cost[n]:
                    cost[n] = ncost; came[n] = cur
                    heapq.heappush(openh, (ncost + abs(nx-goal[0]) + abs(ny-goal[1]), n))
        return None

    def door_slots(i):
        """
        Valid door positions for room i: one cell outside the room wall,
        with the cell beyond it also clear of all wall rings.
        """
        rx, ry, rw, rh = rooms[i]
        slots = []
        for x in range(rx, rx + rw):
            slots.append(((x, ry - 1),    (x, ry - 2)))
            slots.append(((x, ry + rh),   (x, ry + rh + 1)))
        for y in range(ry, ry + rh):
            slots.append(((rx - 1, y),    (rx - 2, y)))
            slots.append(((rx + rw, y),   (rx + rw + 1, y)))
        valid = []
        for (d, o) in slots:
            if not (0 < d[0] < SIZE-1 and 0 < d[1] < SIZE-1): continue
            if not (0 < o[0] < SIZE-1 and 0 < o[1] < SIZE-1): continue
            if d in room_cells or o in room_cells: continue
            if o in near8: continue                   # outside cell must clear ALL rings
            if adj_to_door(d): continue               # no two doors adjacent
            valid.append((d, o))
        return valid

    def pick_room(l):
        if l is None: return None
        if l.room is not None: return l.room
        a = pick_room(l.a); b = pick_room(l.b)
        if a is None: return b
        if b is None: return a
        return a if random.random() < 0.5 else b

    def connect(l):
        if not l.a: return True
        if not connect(l.a) or not connect(l.b): return False
        ra, rb = pick_room(l.a), pick_room(l.b)
        if ra is None or rb is None: return True
        sa, sb = door_slots(ra), door_slots(rb)
        if not sa or not sb: return False
        pairs = sorted(
            ((abs(o1[0]-o2[0]) + abs(o1[1]-o2[1]), d1, o1, d2, o2)
             for (d1, o1) in sa for (d2, o2) in sb),
            key=lambda t: t[0]
        )
        for _, d1, o1, d2, o2 in pairs[:80]:
            if d1 == d2: continue
            if abs(d1[0]-d2[0]) <= 1 and abs(d1[1]-d2[1]) <= 1: continue
            path = astar(o1, o2)
            if path is None: continue
            doors.add(d1); doors.add(d2)
            for c in path: corridor.add(c)
            return True
        return False

    if not connect(root):
        return None

    for (x, y) in doors | corridor:
        grid[y][x] = True

    def passable(x, y):
        return 0 <= x < SIZE and 0 <= y < SIZE and grid[y][x]

    # Validate: wall ring around every room cell must be solid except at door positions
    for (x, y) in room_cells:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if (dx, dy) == (0, 0): continue
                n = (x + dx, y + dy)
                if n in room_cells: continue
                if passable(*n) and n not in doors: return None

    # No two doors adjacent to each other
    for (x, y) in doors:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if (dx, dy) != (0, 0) and (x + dx, y + dy) in doors:
                    return None

    # ── Step 4: Entrance ───────────────────────────────────────────
    # Find the room face (mid-point of an edge) nearest to any grid border
    best = None
    for i, (rx, ry, rw, rh) in enumerate(rooms):
        for (x, y, side) in [
            (rx,          ry + rh//2, 'L'),
            (rx + rw - 1, ry + rh//2, 'R'),
            (rx + rw//2,  ry,         'T'),
            (rx + rw//2,  ry + rh - 1,'B'),
        ]:
            dd = min(x, SIZE-1-x, y, SIZE-1-y)
            if best is None or dd < best[0]:
                best = (dd, x, y, side)

    _, ex, ey, side = best
    if   side == 'L':
        cells = [(x, ey) for x in range(0, ex)]
        entrance = (0, ey);      edoor = (ex - 1, ey)
    elif side == 'R':
        cells = [(x, ey) for x in range(ex + 1, SIZE)]
        entrance = (SIZE-1, ey); edoor = (ex + 1, ey)
    elif side == 'T':
        cells = [(ex, y) for y in range(0, ey)]
        entrance = (ex, 0);      edoor = (ex, ey - 1)
    else:
        cells = [(ex, y) for y in range(ey + 1, SIZE)]
        entrance = (ex, SIZE-1); edoor = (ex, ey + 1)

    for c in cells:
        if (c in near8 and c != edoor) or c in room_cells: return None
    if adj_to_door(edoor): return None
    for (x, y) in cells: grid[y][x] = True
    doors.add(edoor)

    # Re-validate ring rule after adding entrance
    for (x, y) in room_cells:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if (dx, dy) == (0, 0): continue
                n = (x + dx, y + dy)
                if n in room_cells: continue
                if passable(*n) and n not in doors: return None

    # ── Step 5: BFS distances, stairs ─────────────────────────────
    def bfs_dist(start):
        dist = {start: 0}; q = deque([start])
        while q:
            x, y = q.popleft()
            for dx, dy in ((0,1),(0,-1),(1,0),(-1,0)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < SIZE and 0 <= ny < SIZE and grid[ny][nx] and (nx, ny) not in dist:
                    dist[(nx, ny)] = dist[(x, y)] + 1
                    q.append((nx, ny))
        return dist

    dist = bfs_dist(entrance)
    if any(c not in dist for c in room_cells): return None
    stairs = max(dist, key=dist.get)

    # ── Step 6: Lock doors, place keys ────────────────────────────
    final_doors = [
        {"cells": [[x, y]], "id": f"door_{i}", "locked": None}
        for i, (x, y) in enumerate(sorted(doors))
    ]
    dmap     = {tuple(d["cells"][0]): d for d in final_doors}
    lockable = [d for d in final_doors if tuple(d["cells"][0]) != edoor]
    random.shuffle(lockable)
    n_locks  = min(MAX_LOCKS, len(lockable))
    for i, d in enumerate(lockable[:n_locks]):
        d["locked"] = KEY_TYPES[i % len(KEY_TYPES)]

    keys = []; placed = set(); unlocked = set()

    def flood():
        seen = {entrance}; stack = [entrance]; frontier = set()
        while stack:
            x, y = stack.pop()
            for dx, dy in ((0,1),(0,-1),(1,0),(-1,0)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < SIZE and 0 <= ny < SIZE): continue
                if not grid[ny][nx] or (nx, ny) in seen: continue
                d = dmap.get((nx, ny))
                if d and d["locked"] and d["id"] not in unlocked:
                    frontier.add(d["id"]); continue
                seen.add((nx, ny)); stack.append((nx, ny))
        return seen, frontier

    by_id = {d["id"]: d for d in final_doors}
    for it in range(21):
        if it == 20: return None
        seen, frontier = flood()
        if not frontier: break
        for did in frontier:
            d = by_id[did]; kt = d["locked"]
            if kt not in placed:
                cand = [
                    (x, y) for (x, y) in seen
                    if (x, y) in room_cells
                    and (x, y) != entrance
                    and (x, y) != stairs
                    and not dmap.get((x, y))
                ]
                if not cand: return None
                kx, ky = random.choice(cand)
                keys.append({"x": kx, "y": ky, "keyType": kt})
                placed.add(kt)
            for d2 in final_doors:
                if d2["locked"] == kt: unlocked.add(d2["id"])

    # Final reachability check
    seen, _ = flood()
    if len(seen) != len(dist): return None

    # ── Build output data ──────────────────────────────────────────
    compact = "".join("1" if grid[y][x] else "0"
                      for y in range(SIZE) for x in range(SIZE))

    rooms_data = [
        {"rx": rx, "ry": ry, "rw": rw, "rh": rh,
         "depth": dist[(rx, ry)], "id": f"room_{i}"}
        for i, (rx, ry, rw, rh) in enumerate(rooms)
    ]

    return {
        "map":    compact,
        "start":  list(entrance),
        "stairs": list(stairs),
        "doors":  final_doors,
        "keys":   keys,
        "rooms":  rooms_data,
        "stats": {
            "rooms":    len(rooms),
            "doors":    len(final_doors),
            "locks":    sum(1 for d in final_doors if d["locked"]),
            "keys":     len(keys),
            "depth":    dist[stairs],
            "passable": sum(grid[y][x] for y in range(SIZE) for x in range(SIZE)),
        },
    }


# ═══════════════════════════════════════════════════════════════════
#  MAIN — try CASTLE_SEED, then successive seeds until valid
# ═══════════════════════════════════════════════════════════════════

import time, json
t0 = time.time()

result = None
seed   = CASTLE_SEED
while result is None:
    result = generate(seed)
    if result is None:
        print(f"  Seed {seed}: invalid layout, trying {seed + 1}...")
        seed += 1

print(f"Seed {seed}: {result['stats']}  ({time.time()-t0:.2f}s)")
print(f"  Start:  {result['start']}")
print(f"  Stairs: {result['stairs']}")

# ── Write castle_level.js ──────────────────────────────────────────

def js_val(v):
    return json.dumps(v, separators=(",", ":"))

lines = [
    "// ── Castle level data ────────────────────────────────────────────────────────",
    f"// Generated by GenerateCastle.py  seed={seed}",
    f"export const CSIZE = {SIZE};",
    f"export const CASTLE_MAP = {js_val(result['map'])};",
    f"export const START = {{x:{result['start'][0]},y:{result['start'][1]}}};",
    f"export const STAIRS = {{x:{result['stairs'][0]},y:{result['stairs'][1]}}};",
    f"export const ROOMS_DATA = {js_val(result['rooms'])};",
    f"export const DOORS_INIT = {js_val(result['doors'])};",
    f"export const KEYS_INIT  = {js_val(result['keys'])};",
    'export const KEY_COLORS = {"red":"#e74c3c","blue":"#3498db","green":"#2ecc71",'
    '"yellow":"#f1c40f","purple":"#9b59b6","orange":"#e67e22"};',
]

with open(OUTPUT_PATH, "w") as f:
    f.write("\n".join(lines) + "\n")

print(f"Written to {OUTPUT_PATH}  ({os.path.getsize(OUTPUT_PATH)//1024}KB)")
