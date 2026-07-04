import { useState, useEffect, useRef } from "react";

// ── Island generation (32×32 version of GenerateMaps.py pipeline) ─────────────

const SIZE = 32;

// Seeds — same names as GenerateMaps.py
const ISLAND_SEED        = 42;
const BITE_SIZE          = Math.round(51 * (32/256) ** 2);  // scale ~3 cells for 32×32
const BITES_PER_LOOP     = 20;
const REMOVE_FRACTION    = 0.25;
const BIOME_SEED         = 99999;
const BIOME_WARP         = 35.0 * (32/256);  // scale warp to grid size
const BIOME_NS           = 0.025 * (256/32); // scale frequency
const BIOME_LOW          = 0.38;
const BIOME_HIGH         = 0.62;

// Seeded PRNG (mulberry32) — keeps generation deterministic in JS
function makePRNG(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const rng = makePRNG(seed);
  const TABLE = 256;
  const perm = Array.from({length: TABLE}, (_, i) => i);
  for (let i = TABLE - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const vals = Array.from({length: TABLE}, () => rng() * 2 - 1);
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  return (x, y) => {
    const xi = Math.floor(x) & (TABLE - 1);
    const yi = Math.floor(y) & (TABLE - 1);
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = perm[(perm[xi]   + yi)   & (TABLE - 1)];
    const ab = perm[(perm[xi]   + yi+1) & (TABLE - 1)];
    const ba = perm[(perm[xi+1] + yi)   & (TABLE - 1)];
    const bb = perm[(perm[xi+1] + yi+1) & (TABLE - 1)];
    return lerp(lerp(vals[aa], vals[ba], u), lerp(vals[ab], vals[bb], u), v);
  };
}

function neighbours4(x, y, size) {
  return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]
    .filter(([nx,ny]) => nx >= 0 && ny >= 0 && nx < size && ny < size);
}

function generateIsland() {
  const rng = makePRNG(ISLAND_SEED);
  const randInt = n => Math.floor(rng() * n);
  const randChoice = arr => arr[randInt(arr.length)];

  const grid = Array.from({length: SIZE}, () => new Array(SIZE).fill(true));
  const total = SIZE * SIZE;
  const targetRemoved = Math.floor(total * REMOVE_FRACTION);

  const isCoastal = (x, y) => {
    if (x === 0 || y === 0 || x === SIZE-1 || y === SIZE-1) return true;
    return neighbours4(x, y, SIZE).some(([nx, ny]) => !grid[ny][nx]);
  };

  const floodFillFromCentre = () => {
    let cx = Math.floor(SIZE / 2), cy = Math.floor(SIZE / 2);
    if (!grid[cy][cx]) {
      outer: for (let r = 1; r < SIZE; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            if (Math.abs(dx) + Math.abs(dy) === r) {
              const nx = cx+dx, ny = cy+dy;
              if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && grid[ny][nx]) {
                cx = nx; cy = ny; break outer;
              }
            }
          }
        }
      }
    }
    const visited = Array.from({length: SIZE}, () => new Array(SIZE).fill(false));
    const queue = [[cx, cy]]; visited[cy][cx] = true; let head = 0;
    while (head < queue.length) {
      const [x, y] = queue[head++];
      for (const [nx, ny] of neighbours4(x, y, SIZE)) {
        if (grid[ny][nx] && !visited[ny][nx]) {
          visited[ny][nx] = true; queue.push([nx, ny]);
        }
      }
    }
    let pruned = 0;
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (grid[y][x] && !visited[y][x]) { grid[y][x] = false; pruned++; }
    return pruned;
  };

  const deleteBite = (n = BITE_SIZE) => {
    const coastal = [];
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (grid[y][x] && isCoastal(x, y)) coastal.push([x, y]);
    if (!coastal.length) return 0;
    const [sx, sy] = randChoice(coastal);
    const land = [];
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (grid[y][x]) land.push([Math.sqrt((x-sx)**2+(y-sy)**2), x, y]);
    land.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < Math.min(n, land.length); i++)
      grid[land[i][2]][land[i][1]] = false;
  };

  const countLand = () => grid.flat().filter(Boolean).length;

  let removedTotal = 0;
  const log = [];
  while (removedTotal < targetRemoved) {
    for (let i = 0; i < BITES_PER_LOOP; i++) deleteBite();
    floodFillFromCentre();
    removedTotal = total - countLand();
    log.push(`Removed ${removedTotal}/${targetRemoved}`);
  }
  floodFillFromCentre();

  return { grid, log };
}

function assignBiomes(grid) {
  const nfn = makeNoise(BIOME_SEED);
  const biome = Array.from({length: SIZE}, () => new Array(SIZE).fill("s"));
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!grid[y][x]) continue;
      const wx = x + BIOME_WARP * nfn(x * BIOME_NS,      y * BIOME_NS + 10);
      const wy = y + BIOME_WARP * nfn(x * BIOME_NS + 20, y * BIOME_NS + 30);
      const diag = (wx + wy) / (2.0 * SIZE);
      biome[y][x] = diag < BIOME_LOW ? "f" : diag > BIOME_HIGH ? "d" : "p";
    }
  }
  return biome;
}

function placeBuildings(grid) {
  const landCells = [];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (grid[y][x]) landCells.push([x, y]);

  const nearest = (tx, ty) =>
    landCells.reduce((best, [x, y]) =>
      (x-tx)**2+(y-ty)**2 < (best[0]-tx)**2+(best[1]-ty)**2 ? [x,y] : best
    );

  const S = SIZE - 1;
  return {
    portly_pixie: nearest(0,    0   ),
    castle:       nearest(S,    S   ),
    star_garter:  nearest(S,    0   ),
    bedford_inn:  nearest(0,    S   ),
    woodland:     nearest(S>>1, 0   ),
    jolly_smith:  nearest(S>>2, S*3>>2),
    alvin:        nearest(S*3>>2, S>>2),
    elethran:     nearest(S>>1, S>>1),
  };
}

// Biome colours (matching maps.js)
const BIOME_COLOR = { f:"#2d6a27", p:"#8b6914", d:"#d4a843", s:"#1a4e8a" };
const BIOME_LABEL = { f:"Forest", p:"Plains", d:"Desert", s:"Sea" };

// Building markers
const BUILDING_INFO = {
  portly_pixie: { emoji:"🍺", label:"Portly Pixie" },
  castle:       { emoji:"🏰", label:"Castle" },
  star_garter:  { emoji:"🍺", label:"Star & Garter" },
  bedford_inn:  { emoji:"🍺", label:"Bedford Inn" },
  woodland:     { emoji:"🍺", label:"Woodland Tavern" },
  jolly_smith:  { emoji:"⚒️",  label:"Jolly Blacksmith" },
  alvin:        { emoji:"⚒️",  label:"Alvin's Armoury" },
  elethran:     { emoji:"✨", label:"Elethran's Magic Shop" },
};

export default function BuildIslandTest() {
  const canvasRef = useRef(null);
  const [generated, setGenerated] = useState(false);
  const [log, setLog] = useState([]);
  const [stats, setStats] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [buildings, setBuildings] = useState(null);
  const dataRef = useRef(null);

  useEffect(() => {
    const t0 = performance.now();
    const { grid, log: genLog } = generateIsland();
    const biome = assignBiomes(grid);
    const blds = placeBuildings(grid);

    // Count biome cells
    let counts = {f:0,p:0,d:0,s:0};
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        counts[biome[y][x]]++;

    const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
    dataRef.current = { grid, biome, blds };
    setBuildings(blds);
    setStats({ counts, elapsed, land: counts.f+counts.p+counts.d, total: SIZE*SIZE });
    setLog(genLog);
    setGenerated(true);
  }, []);

  // Draw canvas when data ready
  useEffect(() => {
    if (!generated || !canvasRef.current || !dataRef.current) return;
    const { grid, biome, blds } = dataRef.current;
    const canvas = canvasRef.current;
    const CELL = Math.floor(canvas.width / SIZE);
    const ctx = canvas.getContext("2d");

    // Build building lookup
    const bldLookup = {};
    for (const [id, [bx, by]] of Object.entries(blds))
      bldLookup[`${bx},${by}`] = id;

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const b = biome[y][x];
        ctx.fillStyle = BIOME_COLOR[b];
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);

        // Grid lines
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.strokeRect(x * CELL, y * CELL, CELL, CELL);

        // Building marker
        const bldId = bldLookup[`${x},${y}`];
        if (bldId) {
          ctx.fillStyle = "#fff";
          ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
          ctx.fillStyle = "#111";
          ctx.font = `${CELL-4}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(BUILDING_INFO[bldId]?.emoji || "?",
            x*CELL + CELL/2, y*CELL + CELL/2);
        }
      }
    }
  }, [generated]);

  const CELL_PX = 18;
  const canvasSize = SIZE * CELL_PX;

  const handleMouseMove = (e) => {
    if (!dataRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = Math.floor((e.clientX - rect.left) * scaleX / CELL_PX);
    const cy = Math.floor((e.clientY - rect.top)  * scaleY / CELL_PX);
    if (cx < 0 || cy < 0 || cx >= SIZE || cy >= SIZE) { setTooltip(null); return; }
    const { biome, blds } = dataRef.current;
    const b = biome[cy][cx];
    const bldId = Object.entries(blds).find(([, [bx,by]]) => bx===cx && by===cy)?.[0];
    setTooltip({
      x: cx, y: cy,
      biome: BIOME_LABEL[b] || "Sea",
      building: bldId ? BUILDING_INFO[bldId]?.label : null,
      screenX: e.clientX, screenY: e.clientY,
    });
  };

  return (
    <div style={{
      background: "#0d0a06", minHeight: "100vh", color: "#e8d5a3",
      fontFamily: "Georgia, serif", padding: 24,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
    }}>
      <h2 style={{ color: "#c9a84c", margin: 0, fontSize: 22, letterSpacing: 1 }}>
        ⚔ BuildIsland Test — {SIZE}×{SIZE}
      </h2>

      {!generated && (
        <div style={{ color: "#8a7a5a", fontSize: 14 }}>Generating island…</div>
      )}

      {generated && stats && (
        <div style={{
          display: "flex", gap: 24, fontSize: 13, color: "#a89060",
          background: "#1a1208", border: "1px solid #3d2f18",
          borderRadius: 8, padding: "10px 20px",
        }}>
          <span>🌊 <span style={{color:"#1a4e8a"}}>■</span> Sea: {stats.counts.s}</span>
          <span>🌲 <span style={{color:"#2d6a27"}}>■</span> Forest: {stats.counts.f}</span>
          <span>🌾 <span style={{color:"#8b6914"}}>■</span> Plains: {stats.counts.p}</span>
          <span>🏜 <span style={{color:"#d4a843"}}>■</span> Desert: {stats.counts.d}</span>
          <span style={{borderLeft:"1px solid #3d2f18",paddingLeft:16}}>
            Land: {stats.land}/{stats.total} ({(stats.land/stats.total*100).toFixed(1)}%)
          </span>
          <span>⏱ {stats.elapsed}s</span>
        </div>
      )}

      {generated && (
        <div style={{ position: "relative" }}>
          <canvas
            ref={canvasRef}
            width={canvasSize}
            height={canvasSize}
            style={{
              border: "2px solid #3d2f18", borderRadius: 4,
              cursor: "crosshair", display: "block",
              imageRendering: "pixelated",
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
          />
          {tooltip && (
            <div style={{
              position: "fixed",
              left: tooltip.screenX + 12,
              top: tooltip.screenY + 12,
              background: "#1a1208", border: "1px solid #c9a84c",
              borderRadius: 6, padding: "6px 12px", fontSize: 12,
              color: "#e8d5a3", pointerEvents: "none", zIndex: 99,
              whiteSpace: "nowrap",
            }}>
              <div>({tooltip.x}, {tooltip.y}) — {tooltip.biome}</div>
              {tooltip.building && (
                <div style={{ color: "#c9a84c", marginTop: 2 }}>
                  {BUILDING_INFO[Object.entries(buildings||{})
                    .find(([,[bx,by]])=>bx===tooltip.x&&by===tooltip.y)?.[0]]?.emoji}{" "}
                  {tooltip.building}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Building legend */}
      {generated && buildings && (
        <div style={{
          background: "#1a1208", border: "1px solid #3d2f18",
          borderRadius: 8, padding: "12px 20px",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 32px",
          fontSize: 12, color: "#a89060", maxWidth: canvasSize,
          width: "100%",
        }}>
          <div style={{ gridColumn:"1/-1", color:"#c9a84c", fontWeight:"bold",
            marginBottom:4, fontSize:13 }}>
            Buildings
          </div>
          {Object.entries(buildings).map(([id, [bx, by]]) => (
            <div key={id}>
              {BUILDING_INFO[id]?.emoji} {BUILDING_INFO[id]?.label}
              <span style={{ color:"#5a4a30", marginLeft:8 }}>({bx},{by})</span>
            </div>
          ))}
        </div>
      )}

      {/* Generation log */}
      {generated && (
        <details style={{ maxWidth: canvasSize, width:"100%", fontSize: 11 }}>
          <summary style={{ color:"#5a4a30", cursor:"pointer" }}>
            Generation log ({log.length} loops)
          </summary>
          <div style={{
            marginTop: 6, background:"#0a0805", border:"1px solid #2a1f0e",
            borderRadius:4, padding:"8px 12px", maxHeight:140, overflowY:"auto",
            color:"#5a4a30", lineHeight:1.6,
          }}>
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </details>
      )}

      <div style={{ fontSize: 11, color:"#3d2f18", marginTop:4 }}>
        Hover over the map to inspect cells · White cells = buildings
      </div>
    </div>
  );
}
