import { useEffect, useRef, useState, useCallback } from "react";

// ── Constants ────────────────────────────────────────────────────────────────
const CELL = 10;
const VIEW_W = 51, VIEW_H = 51;
const N=0,NE=1,E=2,SE=3,S=4,SW=5,W_DIR=6,NW=7;
const DIR_VEC=[[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1]];
const LOS_RANGE = 20;

// ════════════════════════════════════════════════════════════════════════════
// LEVEL DEFINITIONS
// ════════════════════════════════════════════════════════════════════════════

// ── Pre-computed shared patrol paths ─────────────────────────────────────────
// (used by multiple guards to avoid repeated computation at definition time)
// NOTE: squarePath is a hoisted function declaration, so it's safe to call
// here even though it's defined later in the file (hoisting applies at parse time).
const _L2_R2_OUTER=squarePath(4,64,44,104);
const _L2_R2_OUTER_CCW=[..._L2_R2_OUTER].reverse();
const _L2_R2_INNER=squarePath(23,83,27,87);
const _L2_R2_INNER_CCW=[..._L2_R2_INNER].reverse();
const _L2_R5_OUTER=squarePath(124,64,164,104);
const _L2_R5_OUTER_CCW=[..._L2_R5_OUTER].reverse();
const _L2_R5_INNER=squarePath(142,82,146,86);
const _L2_R5_INNER_CCW=[..._L2_R5_INNER].reverse();
// ── Level 1 ──────────────────────────────────────────────────────────────────
// Layout (top→bottom, all cols 0-50, W=51):
//   Entranceway: rows 0-8,   cols 24-26
//   Room 1:      rows 9-59
//   Corridor:    rows 60-68, cols 24-26
//   Room 2:      rows 69-119
//   Corridor:    rows 120-128, cols 24-26
//   Room 3:      rows 129-179  + 4 corner alcoves
const L1_W=51, L1_H=182;
const L1_R1={r0:9,  r1:59, c0:0,c1:50};
const L1_R2={r0:69, r1:119,c0:0,c1:50};
const L1_R3={r0:129,r1:179,c0:0,c1:50};
// Checkpoint spawn points: entranceway, corridor before room 2, corridor before room 3
const L1_CHECKPOINTS=[
  {r:4,  c:25}, // start: entranceway
  {r:64, c:25}, // corridor between room 1 and room 2
  {r:124,c:25}, // corridor between room 2 and room 3
];
const L1_FLOOR_ZONES=[
  {r0:0,  r1:8,  c0:24,c1:26},
  {r0:9,  r1:59, c0:0, c1:50},
  {r0:60, r1:68, c0:24,c1:26},
  {r0:69, r1:119,c0:0, c1:50},
  {r0:120,r1:128,c0:24,c1:26},
  {r0:129,r1:179,c0:0, c1:50},
  {r0:127,r1:128,c0:0, c1:1 }, // alcove TL
  {r0:127,r1:128,c0:49,c1:50}, // alcove TR
  {r0:180,r1:181,c0:0, c1:1 }, // alcove BL
  {r0:180,r1:181,c0:49,c1:50}, // alcove BR
];
const L1_BARRIER_DEFS=[
  {r:60, c0:24,c1:26,id:0,dir:'h'}, // exit room 1
  {r:120,c0:24,c1:26,id:1,dir:'h'}, // exit room 2
];
// barrierId:-1 = stairs to next level; -2 = gem (win)
const L1_BUTTON_DEFS=[
  {r:34, c:25,barrierId:0, label:'①'},
  {r:94, c:25,barrierId:1, label:'②'},
  // Room 3 centre → stairs icon (barrierId:-1 = advance level)
  // Stairs rendered as 3x3 icon, trigger on centre cell
  {r:154,c:25,barrierId:-1,label:'STAIRS'},
];
function squarePath(r0,c0,r1,c1){
  const pts=[];
  for(let c=c0;c<=c1;c++)pts.push([r0,c]);
  for(let r=r0+1;r<=r1;r++)pts.push([r,c1]);
  for(let c=c1-1;c>=c0;c--)pts.push([r1,c]);
  for(let r=r1-1;r>=r0+1;r--)pts.push([r,c0]);
  return pts;
}
// Bounce path: r0==r1 → E-W line, c0==c1 → N-S line
function linePath(r0,c0,r1,c1){
  const pts=[];
  if(r0===r1){for(let c=c0;c<=c1;c++)pts.push([r0,c]);for(let c=c1-1;c>c0;c--)pts.push([r0,c]);}
  else       {for(let r=r0;r<=r1;r++)pts.push([r,c0]);for(let r=r1-1;r>r0;r--)pts.push([r,c0]);}
  return pts;
}
const L1_GUARD_DEFS=[
  // Room 1
  {path:squarePath(19,10,49,40),startIdx:0, dir:E,    stopPhase:0,pauseEvery:5,color:'#e84040',losColor:'rgba(232,64,64,0.18)',room:L1_R1},
  // Room 2
  {path:squarePath(79,4,109,14),startIdx:0, dir:S,    stopPhase:1,pauseEvery:5,color:'#e07020',losColor:'rgba(224,112,32,0.18)',room:L1_R2},
  {path:squarePath(79,36,109,46),startIdx:30,dir:N,   stopPhase:3,pauseEvery:5,color:'#e07020',losColor:'rgba(224,112,32,0.18)',room:L1_R2},
  // Room 3
  {path:squarePath(141,12,151,22),startIdx:0, dir:E,  stopPhase:0,pauseEvery:4,color:'#c040e0',losColor:'rgba(192,64,224,0.18)',room:L1_R3},
  {path:squarePath(141,28,151,38),startIdx:10,dir:S,  stopPhase:2,pauseEvery:4,color:'#c040e0',losColor:'rgba(192,64,224,0.18)',room:L1_R3},
  {path:squarePath(157,12,167,22),startIdx:20,dir:W_DIR,stopPhase:1,pauseEvery:4,color:'#c040e0',losColor:'rgba(192,64,224,0.18)',room:L1_R3},
  {path:squarePath(157,28,167,38),startIdx:30,dir:N,  stopPhase:3,pauseEvery:4,color:'#c040e0',losColor:'rgba(192,64,224,0.18)',room:L1_R3},
];
const L1_FLOOR_PATTERNS=[
  {type:'chess',   pal:['#2a1f14','#1e2a18'],r0:9,  c0:0, r1:59, c1:50},
  {type:'concentric',pal:['#1a2030','#0f1828','#14202c'],r0:69, c0:0, r1:119,c1:50},
  {type:'herring', pal:['#1e1428','#14101e'],r0:129,c0:0, r1:179,c1:50},
];
function l1RoomOf(r,c){
  if(r>=9  &&r<=59 &&c>=0&&c<=50)return 0;
  if(r>=69 &&r<=119&&c>=0&&c<=50)return 1;
  if(r>=129&&r<=179&&c>=0&&c<=50)return 2;
  return -1;
}

// ── Level 2 ──────────────────────────────────────────────────────────────────
// Five 51x51 rooms in a plus layout, W=H=171:
//              Room2(N)
//   Room3(W)  Room1(C)  Room4(E)
//              Room5(S)
// Room1: rows 60-110, cols 60-110
// Room2: rows  0-50,  cols 60-110
// Room3: rows 60-110, cols  0-50
// Room4: rows 60-110, cols 120-170
// Room5: rows 120-170,cols 60-110
// Corridors 3 wide, centred:
//   N: rows 51-59, cols 79-81
//   W: rows 79-81, cols 51-59
//   E: rows 79-81, cols 111-119
//   S: rows 111-119,cols 79-81
const L2_W=173, L2_H=171;
const L2_FLOOR_ZONES=[
  {r0:60, r1:110,c0:60, c1:110}, // room1 centre
  {r0:0,  r1:50, c0:60, c1:110}, // room2 north
  {r0:60, r1:110,c0:0,  c1:50 }, // room3 west
  {r0:60, r1:110,c0:120,c1:170}, // room4 east
  {r0:120,r1:170,c0:60, c1:110}, // room5 south
  {r0:51, r1:59, c0:79, c1:81 }, // corridor N
  {r0:79, r1:81, c0:51, c1:59 }, // corridor W
  {r0:79, r1:81, c0:111,c1:119}, // corridor E
  {r0:111,r1:119,c0:79, c1:81 }, // corridor S
  // Room3 entrance alcoves: single squares in east wall either side of corridor
  {r0:67,r1:68,c0:51,c1:52}, // north alcove (2x2)
  {r0:91,r1:92,c0:51,c1:52}, // south alcove (2x2)
  // Room3 wall alcoves: centre of N and S walls (2x2)
  {r0:58,r1:59,c0:24,c1:25}, // N wall centre alcove
  {r0:111,r1:112,c0:24,c1:25}, // S wall centre alcove
  // Room4 alcoves: single squares every 15 around perimeter
  {r0:59,r1:59,c0:135,c1:135},{r0:59,r1:59,c0:150,c1:150},{r0:59,r1:59,c0:165,c1:165}, // top
  {r0:111,r1:111,c0:135,c1:135},{r0:111,r1:111,c0:150,c1:150},{r0:111,r1:111,c0:165,c1:165}, // bottom
  {r0:75,r1:75,c0:119,c1:119},{r0:90,r1:90,c0:119,c1:119},{r0:105,r1:105,c0:119,c1:119}, // left
  {r0:75,r1:75,c0:171,c1:171},{r0:90,r1:90,c0:171,c1:171},{r0:105,r1:105,c0:171,c1:171}, // right
];
// Barriers: id 10-13 for level 2 (avoid clash with L1)
const L2_BARRIER_DEFS=[
  {r:51, c0:79,c1:81,id:10,dir:'h'}, // N barrier (top of N corridor)
  {r0:79,r1:81,c:51, id:11,dir:'v'}, // W barrier (left of W corridor)
  {r0:79,r1:81,c:111,id:12,dir:'v'}, // E barrier (right of E corridor into room4)
  {r:111,c0:79,c1:81,id:13,dir:'h'}, // S barrier
];
// Stone pickup in NE corner of room 1 (centre room), 2 cells from corner
const L2_STONE = {r:62, c:108};
// Torches: id0/1 flank Room 5's inner guards, id2-10 form a 3x3 grid in Room 1,
// id11-22 are spaced around Room 4's perimeter
const L2_TORCHES = [
  {r:140, c:80, id:0}, // NW of inner square (Room 5)
  {r:148, c:88, id:1}, // SE of inner square (Room 5)
  // Room 1: 4x4 grid, evenly spaced (10 cells apart), centred on the room
  {r:70, c:70, id:2}, {r:70, c:80, id:3}, {r:70, c:90, id:4}, {r:70, c:100,id:5},
  {r:80, c:70, id:6}, {r:80, c:80, id:7}, {r:80, c:90, id:8}, {r:80, c:100,id:9},
  {r:90, c:70, id:10},{r:90, c:80, id:11},{r:90, c:90, id:12},{r:90, c:100,id:13},
  {r:100,c:70, id:14},{r:100,c:80, id:15},{r:100,c:90, id:16},{r:100,c:100,id:17},
  // Room 4: 8 torches evenly spaced near the perimeter (2 per wall)
  {r:62, c:136, id:18}, {r:62, c:153, id:19}, // top
  {r:108,c:136, id:20}, {r:108,c:153, id:21}, // bottom
  {r:76, c:122, id:22}, {r:93, c:122, id:23}, // left
  {r:76, c:168, id:24}, {r:93, c:168, id:25}, // right
];
const TORCH_LIGHT_RADIUS = 8; // cells, fades with distance
const TORCH_DARK_LOS = 5;     // inner guard LOS when both Room 5 torches out
const L2_BUTTON_DEFS=[
  {r:62,c:62,barrierId:10,label:'①'}, // corner of room1 → opens N
  {r:25,c:85,barrierId:11,label:'②'}, // centre room2 → opens W
  {r:85,c:25,barrierId:12,label:'③'}, // centre room3 → opens E
  {r:85,c:145,barrierId:13,label:'④'}, // centre room4 → opens S
  {r:145,c:85,barrierId:-2,label:'GEM'}, // centre room5 → take diamond
  {r:108,c:62,barrierId:-3,label:'STAIRS'}, // start corner → escape (only once gem taken)
];
// Room bounds for L2 guards (used to check stone is in same room)
const L2_ROOMS={
  R2:{r0:0,  r1:50, c0:60,c1:110},
  R3:{r0:60, r1:110,c0:0, c1:50 },
  R4:{r0:60, r1:110,c0:120,c1:170},
  R5:{r0:120,r1:170,c0:60,c1:110},
};
const R2='#e84040',LR2='rgba(232,64,64,0.18)';
const R3C='#e07020',LR3='rgba(224,112,32,0.18)';
const R4C='#20a0e0',LR4='rgba(32,160,224,0.18)';
const R5C='#c040e0',LR5='rgba(192,64,224,0.18)';
// Maps each barrier id to the room it guards — used to hide unopened rooms
// entirely (solid black) until their barrier has been removed.
const L2_ROOM_LOCKS=[
  {barrierId:10,room:L2_ROOMS.R2},
  {barrierId:11,room:L2_ROOMS.R3},
  {barrierId:12,room:L2_ROOMS.R4},
  {barrierId:13,room:L2_ROOMS.R5},
];
const L2_GUARD_DEFS=[
  // Room2: four guards CW on 41x41 outer loop, one CCW on 5x5 inner
  {path:_L2_R2_OUTER,startIdx:0,  dir:E,    stopPhase:0,pauseEvery:5,color:R2, losColor:LR2,room:L2_ROOMS.R2},
  {path:_L2_R2_OUTER,startIdx:40, dir:S,    stopPhase:1,pauseEvery:5,color:R2, losColor:LR2,room:L2_ROOMS.R2},
  {path:_L2_R2_OUTER,startIdx:80, dir:W_DIR,stopPhase:2,pauseEvery:5,color:R2, losColor:LR2,room:L2_ROOMS.R2},
  {path:_L2_R2_OUTER,startIdx:120,dir:N,    stopPhase:3,pauseEvery:5,color:R2, losColor:LR2,room:L2_ROOMS.R2},
  // inner 5x5 CCW: reverse the path
  {path:_L2_R2_INNER_CCW,startIdx:0,dir:W_DIR,stopPhase:0,pauseEvery:5,losRange:10,color:R2,losColor:LR2,room:L2_ROOMS.R2},
  // Room3: three patrol guards on N-S lines, plus two stationary entrance watchers
  {path:linePath(70,41,100,41),startIdx:0, dir:S,stopPhase:0,pauseEvery:5,color:R3C,losColor:LR3,room:L2_ROOMS.R3},
  {path:linePath(70,31,100,31),startIdx:20,dir:N,stopPhase:2,pauseEvery:5,color:R3C,losColor:LR3,room:L2_ROOMS.R3},
  {path:linePath(70,21,100,21),startIdx:10,dir:S,stopPhase:1,pauseEvery:5,color:R3C,losColor:LR3,room:L2_ROOMS.R3},
  // Stationary watchers: 4 squares back from entrance (col 46), 3 either side of centre row 80, facing E
  {path:[[77,46]],startIdx:0,dir:E,stopPhase:0,pauseEvery:5,color:R3C,losColor:LR3,room:L2_ROOMS.R3},
  {path:[[83,46]],startIdx:0,dir:E,stopPhase:0,pauseEvery:5,color:R3C,losColor:LR3,room:L2_ROOMS.R3},
  // Room4: four 11x11 loops near corners, half speed
  {path:squarePath(70,130,80,140),startIdx:0, dir:E,    stopPhase:0,pauseEvery:2,color:R4C,losColor:LR4,room:L2_ROOMS.R4},
  {path:squarePath(70,150,80,160),startIdx:10,dir:S,    stopPhase:1,pauseEvery:2,color:R4C,losColor:LR4,room:L2_ROOMS.R4},
  {path:squarePath(90,130,100,140),startIdx:20,dir:W_DIR,stopPhase:2,pauseEvery:2,color:R4C,losColor:LR4,room:L2_ROOMS.R4},
  {path:squarePath(90,150,100,160),startIdx:30,dir:N,   stopPhase:3,pauseEvery:2,color:R4C,losColor:LR4,room:L2_ROOMS.R4},
  // Room5: 4 CW + 4 CCW on outer 41x41 square, 1 CW + 1 CCW on inner 5x5, half speed
  // Outer square: rows 124-164, cols 64-104 (159 pts, spacing 39)
  {path:_L2_R5_OUTER,startIdx:0,  dir:E,    stopPhase:0,pauseEvery:2,color:R5C,losColor:LR5,room:L2_ROOMS.R5},
  {path:_L2_R5_OUTER,startIdx:39, dir:S,    stopPhase:1,pauseEvery:2,color:R5C,losColor:LR5,room:L2_ROOMS.R5},
  {path:_L2_R5_OUTER,startIdx:78, dir:W_DIR,stopPhase:2,pauseEvery:2,color:R5C,losColor:LR5,room:L2_ROOMS.R5},
  {path:_L2_R5_OUTER,startIdx:117,dir:N,    stopPhase:3,pauseEvery:2,color:R5C,losColor:LR5,room:L2_ROOMS.R5},
  {path:_L2_R5_OUTER_CCW,startIdx:0,dir:W_DIR,stopPhase:0,pauseEvery:2,color:R5C,losColor:LR5,room:L2_ROOMS.R5},
  {path:_L2_R5_OUTER_CCW,startIdx:39,dir:N,   stopPhase:1,pauseEvery:2,color:R5C,losColor:LR5,room:L2_ROOMS.R5},
  {path:_L2_R5_OUTER_CCW,startIdx:78,dir:E,   stopPhase:2,pauseEvery:2,color:R5C,losColor:LR5,room:L2_ROOMS.R5},
  {path:_L2_R5_OUTER_CCW,startIdx:117,dir:S,  stopPhase:3,pauseEvery:2,color:R5C,losColor:LR5,room:L2_ROOMS.R5},
  // Inner 5x5 square: rows 142-146, cols 82-86 (16 pts)
  {path:_L2_R5_INNER,startIdx:0, dir:E,    stopPhase:0,pauseEvery:2,color:R5C,losColor:LR5,room:L2_ROOMS.R5},
  {path:_L2_R5_INNER_CCW,startIdx:8,dir:W_DIR,stopPhase:2,pauseEvery:2,color:R5C,losColor:LR5,room:L2_ROOMS.R5},
];
const L2_FLOOR_PATTERNS=[
  {type:'chess',    pal:['#1a2030','#0f1820'],r0:60, c0:60, r1:110,c1:110},
  {type:'herring',  pal:['#1e2818','#141e10'],r0:0,  c0:60, r1:50, c1:110},
  {type:'concentric',pal:['#2a1810','#1e1008','#241408'],r0:60,c0:0,  r1:110,c1:50},
  {type:'chess',    pal:['#10182a','#081020'],r0:60, c0:120,r1:110,c1:172},
  {type:'herring',  pal:['#1e1428','#14101e'],r0:120,c0:60, r1:170,c1:110},
];
function l2RoomOf(r,c){
  if(r>=60&&r<=110&&c>=60&&c<=110)return 0;
  if(r>=0 &&r<=50 &&c>=60&&c<=110)return 1;
  if(r>=60&&r<=110&&c>=0 &&c<=50 )return 2;
  if(r>=60&&r<=110&&c>=120&&c<=172)return 3; // includes right alcoves
  if(r>=120&&r<=170&&c>=60&&c<=110)return 4;
  return -1;
}

// ════════════════════════════════════════════════════════════════════════════
// LEVEL FACTORY — returns the data object for a given level number
// ════════════════════════════════════════════════════════════════════════════
function makeLevelData(lvl) {
  // Pre-compute alcove cell keys for fast lookup (used for black rendering + hero hiding)
  function makeAlcoveSet(zones, W) {
    const s=new Set();
    // Alcove zones are those that extend beyond any room (heuristic: outside main rooms)
    // We tag alcoves explicitly via the zones list - use the ones after the main rooms
    for(const z of zones) {
      // Tag all single-pixel or small external zones as alcoves
      if((z.r1-z.r0+1)*(z.c1-z.c0+1)<=6) { // small zones = alcoves
        for(let r=z.r0;r<=z.r1;r++) for(let c=z.c0;c<=z.c1;c++) s.add(r*W+c);
      }
    }
    return s;
  }

  if (lvl === 1) {
    const ld1={
      W:L1_W, H:L1_H,
      floorZones:L1_FLOOR_ZONES,
      barrierDefs:L1_BARRIER_DEFS,
      buttonDefs:L1_BUTTON_DEFS,
      guardDefs:L1_GUARD_DEFS,
      floorPatterns:L1_FLOOR_PATTERNS,
      roomOf:l1RoomOf,
      heroStart:{r:4,c:25},
      initBarriers:new Set([0,1]),
    };
    ld1.alcoveSet=makeAlcoveSet(L1_FLOOR_ZONES,L1_W);
    return ld1;
  } else {
    const ld2={
      W:L2_W, H:L2_H,
      floorZones:L2_FLOOR_ZONES,
      barrierDefs:L2_BARRIER_DEFS,
      buttonDefs:L2_BUTTON_DEFS,
      guardDefs:L2_GUARD_DEFS,
      floorPatterns:L2_FLOOR_PATTERNS,
      roomOf:l2RoomOf,
      heroStart:{r:108,c:62},
      initBarriers:new Set([10,11,12,13]),
    };
    ld2.alcoveSet=makeAlcoveSet(L2_FLOOR_ZONES,L2_W);

    // Static shadow zone cells (Room 1 + all four corridors). Whether each
    // cell is actually dark depends on the live state of torch id:2 (it can
    // be destroyed by a thrown stone like any other torch), so this set is
    // recomputed each render against the current torch list — see renderFrame.
    ld2.shadowZones=[
      {r0:60, r1:110,c0:60, c1:110}, // room1 centre
      {r0:51, r1:59, c0:79, c1:81 }, // corridor N
      {r0:79, r1:81, c0:51, c1:59 }, // corridor W
      {r0:79, r1:81, c0:111,c1:119}, // corridor E
      {r0:111,r1:119,c0:79, c1:81 }, // corridor S
    ];
    ld2.roomLocks=L2_ROOM_LOCKS;
    return ld2;
  }
}

// ── Room value comparison (identity-safe) ───────────────────────────────────
const sameRoom=(a,b)=>!!(a&&b&&a.r0===b.r0&&a.r1===b.r1&&a.c0===b.c0&&a.c1===b.c1);

// ── Map builder ───────────────────────────────────────────────────────────────
function buildMap(ld, barriers) {
  const {W,H,floorZones,barrierDefs} = ld;
  const map = new Uint8Array(W * H);
  for(let r=0;r<H;r++)
    for(let c=0;c<W;c++)
      if(floorZones.some(z=>r>=z.r0&&r<=z.r1&&c>=z.c0&&c<=z.c1))
        map[r*W+c]=1;
  for(const b of barrierDefs){
    if(!barriers.has(b.id)) continue;
    if(b.dir==='h'){ for(let c=b.c0;c<=b.c1;c++) map[b.r*W+c]=0; }
    else            { for(let r=b.r0;r<=b.r1;r++) map[r*W+b.c]=0; }
  }
  return map;
}

// ── Guard factory ─────────────────────────────────────────────────────────────
function makeGuardFromDef(d){
  return {
    r:d.path[d.startIdx][0], c:d.path[d.startIdx][1],
    dir:d.dir, path:d.path, pathIdx:d.startIdx,
    stopTick:0, turnDelay:0, pauseEvery:d.pauseEvery||5,
    slowGuard:(d.pauseEvery||5)<=4,
    color:d.color, losColor:d.losColor,
    room:d.room||null,
    losRange:d.losRange||null,
    startDir:d.dir,
    chasingStone:false, returningToPatrol:false,
  };
}
function makeGuards(guardDefs){ return guardDefs.map(makeGuardFromDef); }

// ── LOS ───────────────────────────────────────────────────────────────────────
function inSector(gr,gc,dir,tr,tc){
  const dr=tr-gr,dc=tc-gc;
  if(dr===0&&dc===0)return false;
  const[fdr,fdc]=DIR_VEC[dir];
  const dot=fdr*dr+fdc*dc;
  if(dot<=0)return false;
  // cos²(θ)≥cos²(45°)=0.5: dot²/(|f|²·mag²)≥0.5 → dot²·2≥(fdr²+fdc²)·mag²
  const fmag2=fdr*fdr+fdc*fdc; // 1 for cardinals, 2 for diagonals
  return dot*dot*2>=fmag2*(dr*dr+dc*dc);
}
function rayBlocked(gr,gc,tr,tc,map,W){
  const dr=tr-gr,dc=tc-gc;
  const steps=Math.max(Math.abs(dr),Math.abs(dc));
  for(let i=1;i<steps;i++){
    if(map[Math.round(gr+dr*i/steps)*W+Math.round(gc+dc*i/steps)]!==1)return true;
  }
  return false;
}
function computeLOSSet(g,map,W,H){
  const set=new Set();
  const range=g.losRange||LOS_RANGE;
  // Clamp search to guard's room bounds if defined
  const rMin=g.room?Math.max(0,g.room.r0,g.r-range):Math.max(0,g.r-range);
  const rMax=g.room?Math.min(H-1,g.room.r1,g.r+range):Math.min(H-1,g.r+range);
  const cMin=g.room?Math.max(0,g.room.c0,g.c-range):Math.max(0,g.c-range);
  const cMax=g.room?Math.min(W-1,g.room.c1,g.c+range):Math.min(W-1,g.c+range);
  for(let r=rMin;r<=rMax;r++)
    for(let c=cMin;c<=cMax;c++)
      if((r-g.r)**2+(c-g.c)**2<=range**2&&map[r*W+c]===1
         &&inSector(g.r,g.c,g.dir,r,c)&&!rayBlocked(g.r,g.c,r,c,map,W))
        set.add(r*W+c);
  return set;
}

// ── Guard movement ────────────────────────────────────────────────────────────
const ATAN2_TO_DIR=[E,SE,S,SW,W_DIR,NW,N,NE];
function dirToward(gr,gc,tr,tc){
  const slot=((Math.round(Math.atan2(tr-gr,tc-gc)/(Math.PI/4))%8)+8)%8;
  return ATAN2_TO_DIR[slot];
}
function stepGuard(g){
  if(g.path.length<=1)return; // stationary guard — never move or turn
  const nextIdx=(g.pathIdx+1)%g.path.length;
  const[nr,nc]=g.path[nextIdx];
  const needed=dirToward(g.r,g.c,nr,nc);
  if(g.dir!==needed){
    g.turnDelay=(g.turnDelay||0)+1;
    if(g.turnDelay>=2){g.turnDelay=0;const diff=((needed-g.dir)+8)%8;g.dir=(g.dir+(diff<=4?1:7))%8;}
  }else{g.turnDelay=0;g.r=nr;g.c=nc;g.pathIdx=nextIdx;}
}
function pursueHero(g,hr,hc,map,W,H){
  const needed=dirToward(g.r,g.c,hr,hc);
  g.dir=needed;
  const[dr,dc]=DIR_VEC[needed];
  const nr=g.r+dr,nc=g.c+dc;
  if(nr>=0&&nr<H&&nc>=0&&nc<W&&map[nr*W+nc]===1){g.r=nr;g.c=nc;}
}

// After stone chase ends: find nearest path point and flag guard to walk there.
// Guard will pursue that point until they reach it, then resume normal patrol.
function snapToNearestPathPoint(g){
  let best=0,bestDist=Infinity;
  for(let i=0;i<g.path.length;i++){
    const[pr,pc]=g.path[i];
    const d=(pr-g.r)**2+(pc-g.c)**2;
    if(d<bestDist){bestDist=d;best=i;}
  }
  // Stationary guards (1-cell path) walk back to their post just like
  // patrolling guards — pursueHero moves them one step per tick toward it.
  g.returnTargetIdx=g.path.length<=1?0:best;
  g.returningToPatrol=true;
  g.turnDelay=0;
}

// ── Graphics helpers ──────────────────────────────────────────────────────────
function pnoise(x,y){const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);}

function floorColor(r,c,ld){
  const ri=ld.roomOf(r,c);
  if(ri<0)return'#101418';
  const fp=ld.floorPatterns[ri];
  const lx=c-fp.c0,ly=r-fp.r0;
  const rw=fp.c1-fp.c0+1,rh=fp.r1-fp.r0+1;
  let idx=0;
  if(fp.type==='chess')idx=(lx+ly)%2;
  if(fp.type==='concentric')idx=Math.min(lx,ly,rw-1-lx,rh-1-ly)%fp.pal.length;
  if(fp.type==='herring')idx=(Math.floor(lx/2)+Math.floor(ly/2))%2;
  return fp.pal[idx%fp.pal.length];
}

// ── Draw icons (stairs / gem) ─────────────────────────────────────────────────
function drawStairs(ctx,x,y,s){
  // 3x3 icon of stairs: descending steps
  const step=s/3;
  ctx.fillStyle='#6a5a3a';
  for(let i=0;i<3;i++){
    const sx2=x+i*step, sy2=y+(2-i)*step;
    ctx.fillRect(sx2,sy2,step*(3-i),step);
    ctx.strokeStyle='#c8a860';ctx.lineWidth=0.5;
    ctx.strokeRect(sx2,sy2,step*(3-i),step);
  }
  // Arrow down
  ctx.fillStyle='#ffe080';ctx.font=`${s*0.55}px sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('▼',x+s/2,y+s/2);
}
// Decorative-only stairs icon for Room 1's start corner (level 2) — same
// graphic as the level-1 stairs but pointing up, since it's where the hero
// arrived FROM. Has no interaction; purely visual flavour.
function drawStairsUp(ctx,x,y,s){
  const step=s/3;
  ctx.fillStyle='#6a5a3a';
  for(let i=0;i<3;i++){
    const sx2=x+i*step, sy2=y+(2-i)*step;
    ctx.fillRect(sx2,sy2,step*(3-i),step);
    ctx.strokeStyle='#c8a860';ctx.lineWidth=0.5;
    ctx.strokeRect(sx2,sy2,step*(3-i),step);
  }
  ctx.fillStyle='#ffe080';ctx.font=`${s*0.55}px sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('▲',x+s/2,y+s/2);
}
function drawGem(ctx,x,y,s){
  // 3x3 icon: diamond shape with facets
  const cx=x+s/2,cy=y+s/2,r=s*0.42;
  ctx.fillStyle='#40d0ff';
  ctx.beginPath();
  ctx.moveTo(cx,cy-r);ctx.lineTo(cx+r*0.7,cy-r*0.2);
  ctx.lineTo(cx+r*0.7,cy+r*0.2);ctx.lineTo(cx,cy+r);
  ctx.lineTo(cx-r*0.7,cy+r*0.2);ctx.lineTo(cx-r*0.7,cy-r*0.2);
  ctx.closePath();ctx.fill();
  ctx.strokeStyle='#80f0ff';ctx.lineWidth=1;ctx.stroke();
  // Inner facet
  ctx.globalAlpha=0.5;ctx.fillStyle='#fff';
  ctx.beginPath();ctx.moveTo(cx,cy-r);ctx.lineTo(cx+r*0.3,cy-r*0.1);ctx.lineTo(cx,cy);ctx.closePath();ctx.fill();
  ctx.globalAlpha=1;
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderFrame(ctx, state) {
  const{hero,guards,losSets,map,barriers,levelDone,alerted,ld,stone,throwMode,torches}=state;
  const W=ld.W,H=ld.H;
  const CW=VIEW_W*CELL,CH=VIEW_H*CELL;
  ctx.clearRect(0,0,CW,CH);

  const vr=hero.r-Math.floor(VIEW_H/2);
  const vc=hero.c-Math.floor(VIEW_W/2);
  const sx=c=>(c-vc)*CELL,sy=r=>(r-vr)*CELL;
  const inView=(r,c)=>r>=vr&&r<vr+VIEW_H&&c>=vc&&c<vc+VIEW_W;

  // Room1 lighting: 9 torches (ids 2-10) in a 3x3 grid. A cell is lit if it's
  // within range of ANY currently-active torch; otherwise it's shadow.
  const room1TorchIds=[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];
  const activeRoom1Torches=ld.shadowZones&&torches
    ? L2_TORCHES.filter(t=>room1TorchIds.includes(t.id)&&torches.includes(t.id))
    : [];
  const inShadowZone=(r,c)=>{
    if(!ld.shadowZones) return false;
    if(!ld.shadowZones.some(z=>r>=z.r0&&r<=z.r1&&c>=z.c0&&c<=z.c1)) return false;
    if(activeRoom1Torches.length===0) return true; // all torches destroyed — fully dark
    const lit=activeRoom1Torches.some(t=>{
      const dist=Math.sqrt((r-t.r)**2+(c-t.c)**2);
      return dist<=TORCH_LIGHT_RADIUS;
    });
    return !lit;
  };

  // Locked rooms (barrier not yet opened) render fully black — no floor
  // pattern, no wall texture, nothing visible until the player unlocks them.
  const isLockedRoom=(r,c)=>{
    if(!ld.roomLocks) return false;
    return ld.roomLocks.some(lock=>
      barriers.has(lock.barrierId)&&
      r>=lock.room.r0&&r<=lock.room.r1&&c>=lock.room.c0&&c<=lock.room.c1);
  };

  // Floor / wall
  for(let r=vr;r<vr+VIEW_H;r++){
    for(let c=vc;c<vc+VIEW_W;c++){
      const x=sx(c),y=sy(r);
      if(r<0||r>=H||c<0||c>=W){ctx.fillStyle='#050608';ctx.fillRect(x,y,CELL,CELL);continue;}
      if(isLockedRoom(r,c)){
        ctx.fillStyle='#000000'; ctx.fillRect(x,y,CELL,CELL);
        continue;
      }
      if(map[r*W+c]!==1){
        const n=(pnoise(c,r)-0.5)*22+(pnoise(c*3,r*3)-0.5)*8;
        const v=Math.round(28+n);
        ctx.fillStyle=`rgb(${v},${v},${v+4})`;ctx.fillRect(x,y,CELL,CELL);
        ctx.globalAlpha=0.08;ctx.fillStyle='#fff';
        ctx.fillRect(x+CELL*0.15,y+CELL*0.12,CELL*0.55,CELL*0.65);ctx.globalAlpha=1;
      }else if((ld.alcoveSet&&ld.alcoveSet.has(r*W+c))||inShadowZone(r,c)){
        ctx.fillStyle='#050608'; ctx.fillRect(x,y,CELL,CELL);
        ctx.globalAlpha=0.18; ctx.fillStyle='#446';
        ctx.fillRect(x,y,CELL,1); ctx.fillRect(x,y,1,CELL); ctx.globalAlpha=1;
      }else{
        ctx.fillStyle=floorColor(r,c,ld);ctx.fillRect(x,y,CELL,CELL);
        const gn=(pnoise(c*7+1,r*7+3)-0.5)*0.12;
        if(gn>0){ctx.globalAlpha=gn;ctx.fillStyle='#fff';ctx.fillRect(x,y,CELL,CELL);ctx.globalAlpha=1;}
      }
    }
  }

  // Barriers
  for(const b of ld.barrierDefs){
    if(!barriers.has(b.id))continue;
    const cells=b.dir==='h'
      ?Array.from({length:b.c1-b.c0+1},(_,i)=>[b.r,b.c0+i])
      :Array.from({length:b.r1-b.r0+1},(_,i)=>[b.r0+i,b.c]);
    for(const[br,bc]of cells){
      if(!inView(br,bc))continue;
      const x=sx(bc),y=sy(br);
      ctx.fillStyle='#5a1010';ctx.fillRect(x,y,CELL,CELL);
      ctx.strokeStyle='#8a2020';ctx.lineWidth=1.5;
      for(let bx=x+2;bx<x+CELL-1;bx+=3){ctx.beginPath();ctx.moveTo(bx,y);ctx.lineTo(bx,y+CELL);ctx.stroke();}
    }
  }

  // Buttons / icons
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(const btn of ld.buttonDefs){
    if(isLockedRoom(btn.r,btn.c)) continue; // hidden behind an unopened barrier
    // Stairs: 3x3 icon centred on btn position. L1 stairs (barrierId:-1) point
    // down; L2 escape stairs (barrierId:-3) point up and only appear active
    // once the diamond has been taken.
    if(btn.label==='STAIRS'){
      if(!inView(btn.r,btn.c)) continue;
      const x=sx(btn.c-1),y=sy(btn.r-1);
      if(btn.barrierId===-3){
        if(!state.gemTaken) continue; // escape stairs hidden until gem is taken
        drawStairsUp(ctx,x,y,CELL*3);
      } else {
        drawStairs(ctx,x,y,CELL*3);
      }
      continue;
    }
    // Gem: 3x3 icon — disappears the instant it's taken
    if(btn.label==='GEM'){
      if(state.gemTaken) continue;
      const x=sx(btn.c-1),y=sy(btn.r-1);
      if(inView(btn.r,btn.c))drawGem(ctx,x,y,CELL*3);
      continue;
    }
    // Regular button
    if(!inView(btn.r,btn.c))continue;
    const done=btn.barrierId<0?levelDone:!barriers.has(btn.barrierId);
    const x=sx(btn.c),y=sy(btn.r);
    ctx.fillStyle=done?'#1a4020':'#102818';ctx.fillRect(x,y,CELL,CELL);
    ctx.strokeStyle=done?'#40e060':'#18a060';ctx.lineWidth=1;ctx.strokeRect(x+1,y+1,CELL-2,CELL-2);
    ctx.fillStyle=done?'#60ff80':'#20c070';ctx.font=`${CELL-3}px monospace`;
    ctx.fillText(btn.label,x+CELL/2,y+CELL/2+1);
  }

  // LOS — Gaussian kernel (KERN=2, sigma=1.2, from TextureTest.jsx)
  const LOS_KERN=2;
  const gaussW=d2=>Math.exp(-d2/(2*1.2*1.2));
  for(let gi=0;gi<guards.length;gi++){
    const losSet=losSets[gi];
    if(!losSet||losSet.size===0)continue;
    const g=guards[gi];
    if(isLockedRoom(g.r,g.c))continue; // hidden behind an unopened barrier
    const m=g.losColor.match(/rgba?\((\d+),(\d+),(\d+)/);
    const lr=m?+m[1]:200,lg2=m?+m[2]:80,lb=m?+m[3]:80;
    const rows=VIEW_H+LOS_KERN*2,cols=VIEW_W+LOS_KERN*2;
    const vis=new Float32Array(rows*cols);
    for(let r=vr-LOS_KERN;r<vr+VIEW_H+LOS_KERN;r++)
      for(let c=vc-LOS_KERN;c<vc+VIEW_W+LOS_KERN;c++)
        if(r>=0&&r<H&&c>=0&&c<W&&losSet.has(r*W+c))
          vis[(r-(vr-LOS_KERN))*cols+(c-(vc-LOS_KERN))]=1;
    const offLOS=document.createElement('canvas');
    offLOS.width=VIEW_W*CELL;offLOS.height=VIEW_H*CELL;
    const offCtx=offLOS.getContext('2d');
    for(let r=0;r<VIEW_H;r++){
      for(let c=0;c<VIEW_W;c++){
        let sw=0,sv=0;
        for(let dy=-LOS_KERN;dy<=LOS_KERN;dy++)
          for(let dx=-LOS_KERN;dx<=LOS_KERN;dx++){
            const w=gaussW(dx*dx+dy*dy);
            sv+=vis[(r+LOS_KERN+dy)*cols+(c+LOS_KERN+dx)]*w;sw+=w;
          }
        const alpha=(sv/sw)*0.55;
        if(alpha>0.01){offCtx.fillStyle=`rgba(${lr},${lg2},${lb},${alpha.toFixed(3)})`;offCtx.fillRect(c*CELL,r*CELL,CELL,CELL);}
      }
    }
    ctx.save();ctx.filter=`blur(${Math.round(CELL*0.6)}px)`;ctx.drawImage(offLOS,0,0);ctx.filter='none';ctx.restore();
  }

  // Stone pickup item (level 2 only)
  if(state.lvl===2&&!state.hasStone&&!state.stone){
    const sr=L2_STONE.r,sc=L2_STONE.c;
    if(inView(sr,sc)){
      const x=sx(sc),y=sy(sr);
      ctx.fillStyle='#8a7050';ctx.beginPath();ctx.arc(x+CELL/2,y+CELL/2,CELL/2-2,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#c8a870';ctx.lineWidth=1;ctx.stroke();
      ctx.fillStyle='#e8c890';ctx.font=`${CELL-3}px sans-serif`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('🪨',x+CELL/2,y+CELL/2+1);
    }
  }

  // Thrown stone on the ground
  if(state.stone){
    const{r:sr,c:sc}=state.stone;
    if(inView(sr,sc)){
      const x=sx(sc),y=sy(sr);
      ctx.fillStyle='#c8a870';ctx.beginPath();ctx.arc(x+CELL/2,y+CELL/2,CELL/2-3,0,Math.PI*2);ctx.fill();
      // Ripple rings
      ctx.strokeStyle='rgba(200,168,112,0.4)';ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(x+CELL/2,y+CELL/2,CELL*0.7,0,Math.PI*2);ctx.stroke();
    }
  }

  // Torches (Level 2 only)
  if(ld&&torches&&L2_TORCHES&&ld.W===L2_W){
    for(const t of L2_TORCHES){
      if(!torches.includes(t.id)) continue; // destroyed
      if(!inView(t.r,t.c)) continue;
      if(isLockedRoom(t.r,t.c)) continue; // hidden behind an unopened barrier
      const tx=sx(t.c),ty=sy(t.r);
      // Torch light halo (radial gradient, drawn large)
      const haloR=TORCH_LIGHT_RADIUS*CELL;
      const cx2=tx+CELL/2, cy2=ty+CELL/2;
      const grad=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,haloR);
      grad.addColorStop(0,'rgba(255,140,20,0.22)');
      grad.addColorStop(0.4,'rgba(255,100,10,0.12)');
      grad.addColorStop(1,'rgba(255,60,0,0)');
      ctx.save(); ctx.globalCompositeOperation='screen';
      ctx.fillStyle=grad;
      ctx.fillRect(cx2-haloR,cy2-haloR,haloR*2,haloR*2);
      ctx.restore();
      // Torch icon: small orange flame square
      ctx.fillStyle='#cc5500'; ctx.fillRect(tx+2,ty+2,CELL-4,CELL-4);
      ctx.fillStyle='#ffaa00'; ctx.fillRect(tx+3,ty+3,CELL-6,CELL-6);
      ctx.fillStyle='#fff8e0'; ctx.font=`${CELL-1}px sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🔥',tx+CELL/2,ty+CELL/2);
    }
  }

  // Guards
  for(const g of guards){
    if(!inView(g.r,g.c))continue;
    if(isLockedRoom(g.r,g.c))continue; // hidden behind an unopened barrier
    const x=sx(g.c),y=sy(g.r);
    ctx.fillStyle=g.color;ctx.beginPath();ctx.roundRect(x+1,y+1,CELL-2,CELL-2,2);ctx.fill();
    const[dvr,dvc]=DIR_VEC[g.dir];
    ctx.fillStyle='#fff';ctx.beginPath();
    ctx.arc(x+CELL/2+dvc*(CELL/2-2),y+CELL/2+dvr*(CELL/2-2),1.5,0,Math.PI*2);ctx.fill();
  }

  // Hero
  const hx=sx(hero.c)+CELL/2,hy=sy(hero.r)+CELL/2;
  const heroHiding=(ld.alcoveSet&&ld.alcoveSet.has(hero.r*W+hero.c))||inShadowZone(hero.r,hero.c);
  ctx.save();
  ctx.globalAlpha=heroHiding?0.35:1;
  ctx.shadowColor='#4ecdc4'; ctx.shadowBlur=heroHiding?2:6;
  ctx.fillStyle=heroHiding?'#1a5a58':'#4ecdc4';
  ctx.beginPath();ctx.arc(hx,hy,CELL/2-1,0,Math.PI*2);ctx.fill();
  ctx.restore();
  ctx.save(); ctx.globalAlpha=heroHiding?0.25:1;
  ctx.strokeStyle='#2a8a84';ctx.lineWidth=1;ctx.beginPath();ctx.arc(hx,hy,CELL/2-1,0,Math.PI*2);ctx.stroke();
  ctx.restore();

  // Throw-mode overlay: dim + crosshair grid hint
  if(state.throwMode){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fillRect(0,0,CW,CH);
    // Pulsing ring at hero position to indicate "aim from here"
    ctx.strokeStyle='rgba(200,168,112,0.8)';ctx.lineWidth=2;
    ctx.setLineDash([4,4]);
    ctx.beginPath();ctx.arc(hx,hy,CELL*1.5,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='#ffe080';ctx.font='bold 11px monospace';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('TAP TO THROW',CW/2,CH*0.08);
    ctx.restore();
  }

  // Alert vignette
  if(alerted){
    ctx.save();
    const grad=ctx.createRadialGradient(CW/2,CH/2,CW*0.2,CW/2,CH/2,CW*0.72);
    grad.addColorStop(0,'rgba(180,0,0,0)');grad.addColorStop(1,'rgba(180,0,0,0.38)');
    ctx.fillStyle=grad;ctx.fillRect(0,0,CW,CH);ctx.restore();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export default function StealthGame({onWin,onExit}={}){
  // Called from inside the long-lived setInterval tick loop below, so keep a
  // ref rather than adding onWin to that effect's deps (which would tear
  // down/rebuild the interval on every parent render).
  const onWinRef=useRef(onWin);
  useEffect(()=>{onWinRef.current=onWin;},[onWin]);
  const canvasRef=useRef(null);
  const[alertMsg,setAlertMsg]=useState(null);
  const[tick,setTick]=useState(0);
  const[currentLevel,setCurrentLevel]=useState(1);
  const alertTimerRef=useRef(null);
  const gs=useRef(null);

  // Furthest checkpoint reached in level 1 (persists across catches, resets on level change)
  const l1CheckpointRef=useRef(0);
  // Info screens already shown this session (persists across level/room resets)
  const seenInfosRef=useRef(new Set());

  function initState(lvl){
    const ld=makeLevelData(lvl);
    const barriers=new Set(ld.initBarriers);
    const heroStart = lvl===1 ? {...L1_CHECKPOINTS[l1CheckpointRef.current]} : {...ld.heroStart};
    return{
      hero:heroStart,
      guards:makeGuards(ld.guardDefs),
      losSets:[],keys:new Set(),
      touch:{active:false,held:false,dr:0,dc:0,startTime:0,consumedOnce:false},
      tick:0,map:buildMap(ld,barriers),barriers,
      levelDone:false,alerted:false,caughtTimer:0,descendTimer:0,gemTaken:false,
      ld, lvl,
      hasStone: false,
      stone: null,
      torches: lvl===2 ? Array.from({length:26},(_,i)=>i) : [],
    };
  }

  if(!gs.current) gs.current=initState(1);

  const showMsg=useCallback((text,color='#e84040',ms=2500)=>{
    setAlertMsg({text,color});
    if(alertTimerRef.current)clearTimeout(alertTimerRef.current);
    alertTimerRef.current=setTimeout(()=>setAlertMsg(null),ms);
  },[]);

  const[throwMode,setThrowMode]=useState(false);
  const[hasStone,setHasStone]=useState(false);
  const throwModeRef=useRef(false);

  // Info screen
  const[infoScreen,setInfoScreen]=useState(null); // {text, color}
  const gameRunningRef=useRef(true); // pause game loop while info shown

  const showInfo=useCallback((id,text,color='#c8d8e8')=>{
    if(seenInfosRef.current.has(id))return;
    seenInfosRef.current.add(id);
    gameRunningRef.current=false;
    setInfoScreen({text,color});
  },[]);

  const dismissInfo=useCallback(()=>{
    gameRunningRef.current=true;
    setInfoScreen(null);
  },[]);

  const enterThrowMode=useCallback(()=>{
    if(!gs.current.hasStone||gs.current.stone)return;
    // Toggle: press again to cancel
    const next=!throwModeRef.current;
    throwModeRef.current=next;
    setThrowMode(next);
  },[]);

  // Canvas tap/click during throw mode → select target cell
  const onCanvasPointer=useCallback(e=>{
    if(!throwModeRef.current)return;
    e.preventDefault();
    const canvas=canvasRef.current;if(!canvas)return;
    const rect=canvas.getBoundingClientRect();
    const px=(('clientX' in e)?e.clientX:e.changedTouches[0].clientX)-rect.left;
    const py=(('clientY' in e)?e.clientY:e.changedTouches[0].clientY)-rect.top;
    const scaleX=canvas.width/rect.width,scaleY=canvas.height/rect.height;
    const{hero,ld,map:gmap}=gs.current;
    const vr=hero.r-Math.floor(VIEW_H/2),vc=hero.c-Math.floor(VIEW_W/2);
    const tr=Math.floor(py*scaleY/CELL)+vr;
    const tc=Math.floor(px*scaleX/CELL)+vc;
    // Must be a floor cell within hero's LOS (ray must not be blocked)
    if(tr<0||tr>=ld.H||tc<0||tc>=ld.W||gmap[tr*ld.W+tc]!==1)return;
    // Hero has 360° visibility (no sector), just check ray clearance
    if(rayBlocked(hero.r,hero.c,tr,tc,gmap,ld.W)){
      showMsg('CAN\'T THROW — NO LINE OF SIGHT','#e84040',1200);
      return;
    }
    gs.current.stone={r:tr,c:tc};
    gs.current.hasStone=false;
    setHasStone(false);
    // Check if stone lands on or adjacent to a torch — destroy it immediately
    if(gs.current.lvl===2){
      const hitIdx=L2_TORCHES.findIndex(t=>
        Math.abs(t.r-tr)<=1&&Math.abs(t.c-tc)<=1&&gs.current.torches.includes(t.id));
      if(hitIdx>=0){
        gs.current.torches=gs.current.torches.filter(id=>id!==L2_TORCHES[hitIdx].id);
        gs.current.stone=null; // stone consumed by torch
        gs.current.hasStone=false;
        setHasStone(false);
        showMsg('🔥 TORCH DESTROYED!','#ff8020',1500);
      }
    }
    throwModeRef.current=false;
    setThrowMode(false);
    showMsg('🪨 STONE THROWN!','#c8a030',1000);
  },[showMsg]);

  // Keyboard
  useEffect(()=>{
    const dn=e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();gs.current.keys.add(e.key);};
    const up=e=>gs.current.keys.delete(e.key);
    window.addEventListener('keydown',dn);window.addEventListener('keyup',up);
    return()=>{window.removeEventListener('keydown',dn);window.removeEventListener('keyup',up);};
  },[]);

  // Joystick
  const joystickRef=useRef(null);
  const joystick=useRef({active:false,dr:0,dc:0,knobX:0,knobY:0});
  const[joystickState,setJoystickState]=useState({active:false,knobX:0,knobY:0});
  const DEAD_ZONE=12,JOY_R=50;

  const joystickDir=useCallback((cx,cy,touchX,touchY)=>{
    const dx=touchX-cx,dy=touchY-cy,dist=Math.sqrt(dx*dx+dy*dy);
    if(dist<DEAD_ZONE)return{dr:0,dc:0,knobX:0,knobY:0};
    const angle=Math.atan2(dy,dx),snap=Math.round(angle/(Math.PI/4))*(Math.PI/4);
    const knobDist=Math.min(dist,JOY_R*0.55);
    return{dr:Math.round(Math.sin(snap)),dc:Math.round(Math.cos(snap)),
           knobX:Math.cos(snap)*knobDist,knobY:Math.sin(snap)*knobDist};
  },[]);

  const getJoyCenter=useCallback(()=>{
    const el=joystickRef.current;if(!el)return[0,0];
    const rect=el.getBoundingClientRect();return[rect.left+rect.width/2,rect.top+rect.height/2];
  },[]);

  const onJoyStart=useCallback(e=>{e.preventDefault();const t=e.changedTouches[0];const[cx,cy]=getJoyCenter();const r=joystickDir(cx,cy,t.clientX,t.clientY);joystick.current={active:true,...r};setJoystickState({active:true,knobX:r.knobX,knobY:r.knobY});},[joystickDir,getJoyCenter]);
  const onJoyMove=useCallback(e=>{e.preventDefault();const t=e.changedTouches[0];const[cx,cy]=getJoyCenter();const r=joystickDir(cx,cy,t.clientX,t.clientY);joystick.current={active:true,...r};setJoystickState({active:true,knobX:r.knobX,knobY:r.knobY});},[joystickDir,getJoyCenter]);
  const onJoyEnd=useCallback(e=>{e.preventDefault();joystick.current={active:false,dr:0,dc:0,knobX:0,knobY:0};setJoystickState({active:false,knobX:0,knobY:0});},[]);

  const resetToLevel=useCallback((lvl)=>{
    try{
      const newState=initState(lvl);
      newState.keys=gs.current.keys;
      gs.current=newState;
      joystick.current={active:false,dr:0,dc:0,knobX:0,knobY:0};
      setJoystickState({active:false,knobX:0,knobY:0});
      setCurrentLevel(lvl);setTick(0);setHasStone(false);setThrowMode(false);throwModeRef.current=false;
      gameRunningRef.current=true;
    }catch(err){
      console.error('resetToLevel failed:',err);
      setAlertMsg({text:'ERROR: '+(err&&err.message||String(err)),color:'#ff0000'});
    }
  },[]);

  // Reset only the room the hero was caught in (L2 only)
  const resetRoom=useCallback(()=>{
    const g=gs.current;
    const{ld}=g;
    // Use room captured at catch time (hero position may have changed since)
    const heroRoom=g.caughtRoom||null;
    if(!heroRoom){ resetToLevel(g.lvl); return; }

    // Reset guards in this room — rebuild from defs to avoid index mismatch
    // Keep guards from other rooms intact; replace this room's guards fresh from defs
    // sameRoom is defined at module level
    const otherGuards=g.guards.filter(gu=>!sameRoom(gu.room,heroRoom));
    const roomGuards=ld.guardDefs.filter(d=>sameRoom(d.room,heroRoom)).map(makeGuardFromDef);
    g.guards=[...otherGuards,...roomGuards];

    // Re-add the barrier for the button in this room (if it was pressed)
    for(const btn of ld.buttonDefs){
      if(btn.barrierId>=0&&
         btn.r>=heroRoom.r0&&btn.r<=heroRoom.r1&&
         btn.c>=heroRoom.c0&&btn.c<=heroRoom.c1){
        g.barriers.add(btn.barrierId);
      }
    }
    g.map=buildMap(ld,g.barriers);

    // Move hero to centre of that room
    g.hero={...ld.heroStart}; // always return to level start
    g.alerted=false;
    g.stone=null;
    g.hasStone=false;
    setHasStone(false);
    setThrowMode(false);
    throwModeRef.current=false;
    // Restore the captured room's own torches without touching other rooms' torches
    if(g.lvl===2&&heroRoom===L2_ROOMS.R5){
      const room5Ids=new Set([0,1]);
      const keepIds=g.torches.filter(id=>!room5Ids.has(id));
      g.torches=[...new Set([...keepIds,0,1])];
    } else if(g.lvl===2&&heroRoom===L2_ROOMS.R4){
      const room4Ids=new Set([18,19,20,21,22,23,24,25]);
      const keepIds=g.torches.filter(id=>!room4Ids.has(id));
      g.torches=[...new Set([...keepIds,...room4Ids])];
    }
  },[resetToLevel]);

  // Game loop
  useEffect(()=>{
    const g=gs.current;
    const{ld}=g;
    g.losSets=g.guards.map(gu=>computeLOSSet(gu,g.map,ld.W,ld.H));
    const ctx=canvasRef.current?.getContext('2d');
    if(ctx)renderFrame(ctx,g);

    const interval=setInterval(()=>{
      try{
      const g=gs.current;
      const{ld}=g;
      const{W,H}=ld;

      if(g.descendTimer>0){
        g.descendTimer--;
        if(g.descendTimer===0) resetToLevel(2);
        return;
      }

      if(g.caughtTimer>0){
        g.caughtTimer--;
        if(g.caughtTimer===0){
          if(g.lvl===2) resetRoom();
          else resetToLevel(g.lvl);
        }
        return;
      }

      // Pause game while info screen is displayed
      if(!gameRunningRef.current) return;

      // Input
      let dr=0,dc=0;
      if(g.keys.has('ArrowUp')||g.keys.has('w'))dr-=1;
      if(g.keys.has('ArrowDown')||g.keys.has('s'))dr+=1;
      if(g.keys.has('ArrowLeft')||g.keys.has('a'))dc-=1;
      if(g.keys.has('ArrowRight')||g.keys.has('d'))dc+=1;
      if(dr===0&&dc===0&&joystick.current.active){dr=joystick.current.dr;dc=joystick.current.dc;}

      // Move hero (frozen during throw mode), with wall-sliding for diagonals
      if(!throwModeRef.current){
        const nr=g.hero.r+dr,nc=g.hero.c+dc;
        const canMove=nr>=0&&nr<H&&nc>=0&&nc<W&&g.map[nr*W+nc]===1;
        if(canMove){
          g.hero.r=nr;g.hero.c=nc;
        }else if(dr!==0&&dc!==0){
          // Diagonal blocked — try sliding along each axis
          const canR=g.hero.r+dr>=0&&g.hero.r+dr<H&&g.map[(g.hero.r+dr)*W+g.hero.c]===1;
          const canC=g.hero.c+dc>=0&&g.hero.c+dc<W&&g.map[g.hero.r*W+(g.hero.c+dc)]===1;
          if(canR) g.hero.r+=dr;
          else if(canC) g.hero.c+=dc;
        }
      }

      // ── Checkpoint tracking (level 1): advance furthest-room marker ──────
      if(g.lvl===1){
        if(g.hero.r>=L1_R3.r0) l1CheckpointRef.current=Math.max(l1CheckpointRef.current,2);
        else if(g.hero.r>=L1_R2.r0) l1CheckpointRef.current=Math.max(l1CheckpointRef.current,1);
      }

      // ── Info screen triggers (first-time only) ───────────────────────────
      // 1. Level 1 entry
      if(g.lvl===1)
        showInfo('lvl1_enter',
          'Avoid being seen by the guards.\nSneak up behind them to take them out.\nActivate the button in the middle of the room to open the door.');
      // 2. Level 2 entry
      if(g.lvl===2)
        showInfo('lvl2_enter',
          'Throwing a stone will distract the guards.\nUse them to slip past unseen.','#c8e8c8');
      // 3-5. Back in Room 1 (L2) after doors open
      if(g.lvl===2){
        const inR1=g.hero.r>=60&&g.hero.r<=110&&g.hero.c>=60&&g.hero.c<=110;
        if(inR1){
          if(!g.barriers.has(11)) // door to Room 3 (W) opened
            showInfo('l2_r3_done',
              'If you could only sneak past the guards in the next room,\nthere are some shadowy alcoves to hide in.','#e8d8c8');
          if(!g.barriers.has(12)) // door to Room 4 (E) opened
            showInfo('l2_r4_done',
              'The guards don\'t see so well in the dark…','#c8d8e8');
          if(!g.barriers.has(13)) // door to Room 5 (S) opened
            showInfo('l2_r5_open',
              'Final challenge: steal the diamond and get out!','#e8e8c0');
        }
      }

      // Stone pickup (level 2 only) — pick up from start OR from where it landed
      if(g.lvl===2&&!g.hasStone){
        const atStart=!g.stone
          &&Math.abs(g.hero.r-L2_STONE.r)<=1&&Math.abs(g.hero.c-L2_STONE.c)<=1;
        const atLanded=!!g.stone
          &&Math.abs(g.hero.r-g.stone.r)<=1&&Math.abs(g.hero.c-g.stone.c)<=1;
        if(atStart||atLanded){
          g.stone=null;
          g.hasStone=true;
          setHasStone(true);
          for(const gu of g.guards){if(gu.chasingStone){gu.chasingStone=false;snapToNearestPathPoint(gu);}}
          showMsg('🪨 STONE PICKED UP','#c8b060',1500);
        }
      }

      // Button / icon checks (always active — no reason to require stealth here)
      for(const btn of ld.buttonDefs){
        if(g.hero.r!==btn.r||g.hero.c!==btn.c)continue;
        if(btn.barrierId===-1&&!g.levelDone){
          // Stairs → advance to level 2 (tick-based countdown, not setTimeout)
          g.levelDone=true;
          g.descendTimer=20; // 2 seconds at 100ms/tick
          showMsg('▼ DESCENDING TO LEVEL 2...','#ffe080',2000);
        }else if(btn.barrierId===-2&&!g.gemTaken){
          // Gem → take it (icon disappears immediately); doesn't end the game by itself
          g.gemTaken=true;
          showMsg('💎 DIAMOND TAKEN! Now get back to the stairs...','#40d0ff',2500);
        }else if(btn.barrierId===-3&&g.gemTaken&&!g.levelDone){
          // Escape stairs (only active once the gem is taken) → win
          g.levelDone=true;
          showMsg('You have successfully stolen the diamond and escaped!','#40d0ff',6000);
          // Let the win message actually be read before handing control back
          // to whatever mounted this game.
          setTimeout(()=>onWinRef.current?.(),6000);
        }else if(btn.barrierId>=0&&g.barriers.has(btn.barrierId)){
          g.barriers.delete(btn.barrierId);
          g.map=buildMap(ld,g.barriers);
          showMsg('BARRIER REMOVED','#20c080',1500);
        }
      }

      // Helper: step one guard according to normal patrol speed
      const stepGuardNormally = gu => {
        if(gu.returningToPatrol){
          // Walk toward nearest path point, then resume patrol
          const[tr,tc]=gu.path[gu.returnTargetIdx];
          if(gu.r===tr&&gu.c===tc){
            gu.returningToPatrol=false;
            gu.pathIdx=(gu.returnTargetIdx-1+gu.path.length)%gu.path.length;
            // Restore original facing direction (critical for stationary guards)
            gu.dir=gu.startDir;
          } else {
            pursueHero(gu,tr,tc,g.map,W,H);
          }
        } else {
          gu.stopTick=(gu.stopTick+1)%gu.pauseEvery;
          if(gu.slowGuard?gu.stopTick===0:gu.stopTick!==0) stepGuard(gu);
        }
      };

      // Guards — stone chase (per-guard), alerted pursuit, or normal patrol
      if(g.stone){
        const{r:sr,c:sc}=g.stone;
        let arrived=false;
        for(const gu of g.guards){
          if(!gu.chasingStone){
            // Guard must have a room AND the stone must be inside it — no exceptions
            const inRoom=!!gu.room&&sr>=gu.room.r0&&sr<=gu.room.r1&&sc>=gu.room.c0&&sc<=gu.room.c1;
            if(inRoom&&!rayBlocked(gu.r,gu.c,sr,sc,g.map,W)) gu.chasingStone=true;
          }
          if(gu.chasingStone){
            pursueHero(gu,sr,sc,g.map,W,H);
            if(Math.abs(gu.r-sr)<=1&&Math.abs(gu.c-sc)<=1) arrived=true;
          } else {
            stepGuardNormally(gu);
          }
        }
        if(arrived){
          g.stone=null; g.hasStone=false; setHasStone(false);
          for(const gu of g.guards){if(gu.chasingStone){gu.chasingStone=false;snapToNearestPathPoint(gu);}}
          showMsg('GUARDS RETURNING TO PATROL','#c8a030',1500);
        }
      }else if(g.alerted){
        for(const gu of g.guards){
          const heroInRoom=!gu.room||(g.hero.r>=gu.room.r0&&g.hero.r<=gu.room.r1&&g.hero.c>=gu.room.c0&&g.hero.c<=gu.room.c1);
          if(heroInRoom) pursueHero(gu,g.hero.r,g.hero.c,g.map,W,H);
          else stepGuardNormally(gu); // hero left the room — guard can't follow into the corridor
        }
      }else{
        for(const gu of g.guards) stepGuardNormally(gu);
      }

      // Dynamic LOS: inner R5 guards dimmed when both R5 torches out;
      // all R4 guards dimmed when all 12 R4 torches out
      const r4TorchIds=[18,19,20,21,22,23,24,25];
      const r5TorchesOut=g.lvl===2&&g.torches&&!g.torches.includes(0)&&!g.torches.includes(1);
      const r4TorchesOut=g.lvl===2&&g.torches&&r4TorchIds.every(id=>!g.torches.includes(id));
      g.losSets=g.guards.map(gu=>{
        const isR5Inner=gu.room&&gu.room===L2_ROOMS.R5&&gu.path.length<=16;
        const isR4=gu.room&&gu.room===L2_ROOMS.R4;
        const dynamicGu = (r5TorchesOut&&isR5Inner)||(r4TorchesOut&&isR4)
          ? {...gu, losRange:TORCH_DARK_LOS}
          : gu;
        return computeLOSSet(dynamicGu,g.map,W,H);
      });
      const heroKey=g.hero.r*W+g.hero.c;

      // Caught
      const heroRoomNow=ld.guardDefs?.find(d=>d.room&&
        g.hero.r>=d.room.r0&&g.hero.r<=d.room.r1&&
        g.hero.c>=d.room.c0&&g.hero.c<=d.room.c1)?.room||null;
      const caught=g.guards.some(gu=>
        Math.abs(gu.r-g.hero.r)<=1&&Math.abs(gu.c-g.hero.c)<=1&&!(gu.r===g.hero.r&&gu.c===g.hero.c)&&
        (!gu.room||sameRoom(gu.room,heroRoomNow))); // never caught while standing outside the guard's room
      if(caught){
        g.alerted=false;g.caughtTimer=20;
        // Capture hero's room NOW before position changes
        // Find the room by value — return the canonical L2_ROOMS object for identity safety
        const _heroInRoom=d=>d.room&&
          g.hero.r>=d.room.r0&&g.hero.r<=d.room.r1&&
          g.hero.c>=d.room.c0&&g.hero.c<=d.room.c1;
        g.caughtRoom=ld.guardDefs?.find(_heroInRoom)?.room||null;
        showMsg('💥 CAUGHT! THROWN OUT...','#e84040',2000);
        g.tick++;setTick(g.tick);const ctx=canvasRef.current?.getContext('2d');if(ctx)renderFrame(ctx,g);return;
      }

      // Backstab
      if(!g.alerted){
        const surviving=[];
        for(let i=0;i<g.guards.length;i++){
          const gu=g.guards[i];
          const adj=Math.abs(gu.r-g.hero.r)<=2&&Math.abs(gu.c-g.hero.c)<=2&&!(gu.r===g.hero.r&&gu.c===g.hero.c);
          if(adj&&!g.losSets[i].has(heroKey))showMsg('⚔ BACK-STAB!','#4ecdc4',2000);
          else surviving.push(gu);
        }
        g.guards=surviving;
        // Dynamic LOS: inner R5 guards dimmed when both R5 torches out;
        // all R4 guards dimmed when all 12 R4 torches out
        const r5TorchesOut2=g.lvl===2&&g.torches&&!g.torches.includes(0)&&!g.torches.includes(1);
        const r4TorchesOut2=g.lvl===2&&g.torches&&r4TorchIds.every(id=>!g.torches.includes(id));
        g.losSets=g.guards.map(gu=>{
          const isR5Inner=gu.room&&gu.room===L2_ROOMS.R5&&gu.path.length<=16;
          const isR4=gu.room&&gu.room===L2_ROOMS.R4;
          const dynamicGu = (r5TorchesOut2&&isR5Inner)||(r4TorchesOut2&&isR4)
            ? {...gu, losRange:TORCH_DARK_LOS}
            : gu;
          return computeLOSSet(dynamicGu,g.map,W,H);
        });
      }

      // Alert
      const spotted=g.losSets.some(s=>s.has(heroKey));
      if(spotted&&!g.alerted){g.alerted=true;showMsg('⚠ SPOTTED! GUARDS ALERTED!','#e84040',3000);}
      else if(!spotted&&g.alerted){
        g.alerted=false;
        for(const gu of g.guards) snapToNearestPathPoint(gu);
        showMsg('LOST THEM...','#c8a030',1500);
      }

      g.tick++;setTick(g.tick);
      const ctx=canvasRef.current?.getContext('2d');
      if(ctx)renderFrame(ctx,g);
      }catch(err){
        console.error('Game loop tick failed:',err);
        setAlertMsg({text:'TICK ERROR: '+(err&&err.message||String(err)),color:'#ff0000'});
      }
    },100);

    return()=>clearInterval(interval);
  },[showMsg,resetToLevel,resetRoom,showInfo]);

  const canvasSize=VIEW_W*CELL;

  return(
    <div style={{background:'#0a0c0f',color:'#c8d0d8',fontFamily:"'Courier New',monospace",
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      minHeight:'100vh',gap:8,padding:8,
      userSelect:'none',WebkitUserSelect:'none',WebkitTouchCallout:'none'}}>
      <div style={{width:'100%',maxWidth:canvasSize,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontSize:11,letterSpacing:'0.3em',textTransform:'uppercase',color:'#3a6a8a'}}>
          ■ Stealth — Level {currentLevel}
        </div>
        {onExit&&<div onClick={onExit}
          style={{fontSize:10,letterSpacing:'0.15em',color:'#5a6a78',cursor:'pointer',border:'1px solid #2a3540',padding:'3px 8px',borderRadius:3}}>
          ✕ EXIT
        </div>}
      </div>
      <div style={{display:'flex',gap:24,fontSize:10,color:'#3a4a58'}}>
        <span>ARROWS / WASD / JOYSTICK</span>
        <span>TICK: {tick}</span>
      </div>
      <div style={{minHeight:20,maxWidth:`min(${canvasSize}px, 92vw)`,fontSize:13,letterSpacing:'0.2em',fontWeight:'bold',
        textAlign:'center',lineHeight:1.4,
        color:alertMsg?.color||'#e84040',opacity:alertMsg?1:0,transition:'opacity 0.12s'}}>
        {alertMsg?.text||'⚠'}
      </div>
      <div style={{position:'relative',width:canvasSize,height:canvasSize,touchAction:'none'}}>
        <canvas ref={canvasRef} width={canvasSize} height={canvasSize}
          style={{border:'1px solid #1a2430',display:'block',imageRendering:'pixelated',
            cursor:throwMode?'crosshair':'none'}}
          onClick={onCanvasPointer}
          onTouchEnd={onCanvasPointer}/>

        {/* Info screen overlay — pauses game, tap to dismiss */}
        {infoScreen&&(
          <div onClick={dismissInfo}
            style={{position:'absolute',inset:0,
              background:'rgba(5,8,12,0.88)',
              display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
              gap:20,cursor:'pointer',zIndex:10,padding:24}}>
            <div style={{fontSize:11,letterSpacing:'0.25em',color:'#445566',textTransform:'uppercase'}}>
              — message —
            </div>
            <div style={{
              fontSize:14,color:infoScreen.color,letterSpacing:'0.06em',
              lineHeight:1.8,textAlign:'center',whiteSpace:'pre-line',
              maxWidth:`min(${canvasSize*0.82}px, 85vw)`,
            }}>
              {infoScreen.text}
            </div>
            <div style={{fontSize:10,color:'#334455',letterSpacing:'0.15em',marginTop:8}}>
              TAP TO CONTINUE
            </div>
          </div>
        )}
        {/* Throw stone button — mirrors joystick position on left side */}
        {currentLevel===2&&hasStone&&!gs.current?.stone&&(
          <div onClick={enterThrowMode}
            style={{position:'absolute',bottom:70,left:120,
              width:JOY_R*2,height:JOY_R*2,borderRadius:'50%',
              background:throwMode?'rgba(200,168,80,0.35)':'rgba(200,168,80,0.12)',
              border:`2px solid ${throwMode?'#ffe080':'rgba(200,168,80,0.45)'}`,
              display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
              cursor:'pointer',touchAction:'none',gap:2}}>
            <span style={{fontSize:26}}>🪨</span>
            <span style={{fontSize:9,color:'#ffe080',letterSpacing:'0.05em'}}>THROW</span>
          </div>
        )}
        <div ref={joystickRef} onTouchStart={onJoyStart} onTouchMove={onJoyMove} onTouchEnd={onJoyEnd} onTouchCancel={onJoyEnd}
          style={{position:'absolute',bottom:70,left:canvasSize-JOY_R*2-120,
            width:JOY_R*2,height:JOY_R*2,borderRadius:'50%',
            background:'rgba(255,255,255,0.06)',border:'2px solid rgba(255,255,255,0.15)',touchAction:'none'}}>
          <div style={{position:'absolute',left:JOY_R+joystickState.knobX-22,top:JOY_R+joystickState.knobY-22,
            width:44,height:44,borderRadius:'50%',
            background:joystickState.active?'rgba(78,205,196,0.55)':'rgba(78,205,196,0.25)',
            border:'2px solid rgba(78,205,196,0.6)',
            transition:joystickState.active?'none':'left 0.1s,top 0.1s',pointerEvents:'none'}}/>
        </div>
      </div>
      <div style={{fontSize:10,color:'#2a3a48',display:'flex',gap:16}}>
        {[['#4ecdc4','YOU'],['#e84040','GUARD'],['#8a2020','BARRIER'],['#20c080','BUTTON']].map(([col,lbl])=>(
          <span key={lbl} style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:col,display:'inline-block'}}/>
            {lbl}
          </span>
        ))}
      </div>
    </div>
  );
}
