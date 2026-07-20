import React from "react";
import { CombatScreen, MultiCombatScreen, HeroPanel, GroundItemsDialogue, weaponAttacks, totalArmour, doEquipWeapon, btnS, INV_MAX, squareViewStyle, magicItem } from "./Game.jsx";
import { NPC_IMG, DRAGON_IMG } from "./data/images.js";
import { CASTLE_LEVELS } from "./data/castleLevels.js";
import StealthGame from "./StealthGame.tsx";
import NinjaDummy from "./NinjaDummy artifact.tsx";

// 2x2 grid, same cropping approach as the island's GuardianPortrait.
function NpcPortrait({col,row,size=130}){
  return <div style={{width:size,height:size,backgroundImage:`url(${NPC_IMG})`,backgroundSize:"200% 200%",backgroundPosition:`${col*100}% ${row*100}%`,backgroundRepeat:"no-repeat",borderRadius:6,border:"2px solid #3d2f18",flexShrink:0}}/>;
}

// Raw level data (CASTLE_LEVELS, imported from data/castleLevels.js) stays
// at its original 64-unit resolution; SCALE blows every room/corridor/door/
// position up at load time via scaleLevel() below.
const SCALE = 4;
// 112 rather than 64 — room_27 (teleporter destination, level 2) sits at
// raw (100,100), deliberately far from the rest of the map since it's only
// ever reached via teleporter, not a corridor.
const RAW_SIZE = 112;
const CASTLE_SIZE = RAW_SIZE * SCALE;
const CASTLE_VIEW = 51;
const CASTLE_HALF = (CASTLE_VIEW - 1) / 2;
const CASTLE_CELL = 10;
const CASTLE_CANVAS = CASTLE_VIEW * CASTLE_CELL;
// Actual radial reach of the highlight raycast in grid cells (each ray step
// advances 0.5 cells) — used to fade the highlight smoothly near its edge.
const HIGHLIGHT_REACH = (CASTLE_HALF + 1) * 0.5;

const KEY_COLORS_C = {
  red:"#c0392b",blue:"#2980b9",green:"#27ae60",
  yellow:"#f39c12",purple:"#8e44ad",orange:"#e67e22"
};

// Mobile browsers render 🗝 with the system's full-colour emoji font, which
// ignores the CSS `color` used to tint each key — so on phones every
// collected key shows up the same default grey instead of its key colour.
// An SVG glyph filled with the given colour renders correctly everywhere.
function KeyIcon({color,size=14,flip}){
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={flip?{transform:"scaleX(-1)"}:undefined}>
      <path fillRule="evenodd" clipRule="evenodd" d="M7 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-2.5A1.5 1.5 0 1 1 7 10a1.5 1.5 0 0 1 0 3.5z"/>
      <rect x="10.8" y="11" width="10.2" height="2" rx="0.5"/>
      <rect x="16" y="13" width="2" height="3" rx="0.5"/>
      <rect x="19" y="13" width="2" height="3.5" rx="0.5"/>
    </svg>
  );
}

// A door originally sat on one raw cell, exactly 1 wide, matching a 1-wide
// corridor. Now that corridors are SCALE cells wide, a door must widen to
// match — but only across the corridor's width, staying 1 cell thick along
// the direction of travel. Direction comes from the door's connecting
// corridor: if the corridor's next cell shares the door's row, travel is
// horizontal and the door bars it with a vertical (1 wide x SCALE tall) bar;
// if it shares the column, travel is vertical and the bar is horizontal
// (SCALE wide x 1 tall) — an "8x1" rectangle either way, just oriented to
// whichever passage it blocks.
function doorWideAxis(doorCell, rawCorridors) {
  const [dx, dy] = doorCell;
  for (const c of rawCorridors) {
    const cells = c.cells;
    if (cells.length < 2) continue;
    const first = cells[0], last = cells[cells.length - 1];
    let neighbor = null;
    if (first[0] === dx && first[1] === dy) neighbor = cells[1];
    else if (last[0] === dx && last[1] === dy) neighbor = cells[cells.length - 2];
    if (neighbor) {
      if (neighbor[1] === dy) return "y"; // travel along x → bar spans y
      if (neighbor[0] === dx) return "x"; // travel along y → bar spans x
    }
  }
  return "x";
}

// Scales one raw CASTLE_LEVELS entry up by SCALE: room rectangles, corridor
// points, start/stairs/keys/encounters all multiply directly; doors become
// SCALE x 1 (or 1 x SCALE) rectangles instead of single cells.
function scaleLevel(raw) {
  const mid = Math.floor(SCALE / 2);
  const rooms = raw.rooms.map(r => ({...r, rx:r.rx*SCALE, ry:r.ry*SCALE, rw:r.rw*SCALE, rh:r.rh*SCALE}));
  const corridors = raw.corridors.map(c => ({...c, cells:c.cells.map(([x,y]) => [x*SCALE, y*SCALE])}));
  const barrierDefs = raw.barrierDefs.map(d => {
    const [dx, dy] = d.cells[0];
    const sx = dx*SCALE, sy = dy*SCALE;
    const rect = doorWideAxis(d.cells[0], raw.corridors) === "x"
      ? {x0:sx, x1:sx+SCALE, y0:sy+mid, y1:sy+mid+1}
      : {x0:sx+mid, x1:sx+mid+1, y0:sy, y1:sy+SCALE};
    return {...d, rect};
  });
  const groundItemsInit = {};
  for (const [key, items] of Object.entries(raw.groundItemsInit?raw.groundItemsInit():{})) {
    const [gx, gy] = key.split(",").map(Number);
    groundItemsInit[`${gx*SCALE},${gy*SCALE}`] = items;
  }
  return {
    ...raw,
    rooms, corridors, barrierDefs, groundItemsInit,
    start: [raw.start[0]*SCALE, raw.start[1]*SCALE],
    stairs: [raw.stairs[0]*SCALE, raw.stairs[1]*SCALE],
    keys: raw.keys.map(k => ({...k, x:k.x*SCALE, y:k.y*SCALE})),
    // "fire" encounters are unpassable hazard blocks, not point encounters —
    // {x,y} names the raw cell, expanded here into the full SCALE x SCALE
    // block of scaled cells it occupies (matching how rooms/corridors blow
    // up a raw cell into an SCALE-wide block). Cleared via the fire_clear
    // NPC action (see dismissEnc), tracked per-room in fireCleared.
    encounters: raw.encounters.map(e => {
      if (e.type === "fire") {
        const cells = [];
        for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) cells.push([e.x*SCALE+dx, e.y*SCALE+dy]);
        return {...e, cells};
      }
      return {...e, cx:e.cx*SCALE, cy:e.cy*SCALE};
    }),
    // corner picks where in the raw cell's SCALE x SCALE block the torch
    // sits: "ul" (default) top-left, "ur" top-right, "dl" bottom-left,
    // "dr" bottom-right. radius scales the torch's illumination reach
    // relative to the hero's own highlight radius (1 = same, 0.5 = half).
    torches: (raw.torches||[]).map(([x,y,corner,radius=1]) => {
      const tx = (corner==="ur"||corner==="dr") ? x*SCALE+SCALE-1 : x*SCALE;
      const ty = (corner==="dl"||corner==="dr") ? y*SCALE+SCALE-1 : y*SCALE;
      return [tx, ty, radius];
    }),
    teleporters: (raw.teleporters||[]).map(t => ({
      ...t,
      a:{x:t.a.x*SCALE, y:t.a.y*SCALE},
      b:{x:t.b.x*SCALE, y:t.b.y*SCALE},
    })),
  };
}

// Passability is rooms (rectangles, by corners) + corridors (coordinate
// sequences) — no bitmap, so resolution/size can change without regenerating
// a per-cell grid. passableSet is a precomputed "x,y" lookup for O(1) checks.
function castlePassable(passableSet, x, y) {
  return x>=0&&y>=0&&x<CASTLE_SIZE&&y<CASTLE_SIZE&&passableSet.has(`${x},${y}`);
}

// Walks a Bresenham line from (sx,sy) toward (tx,ty), one cell at a time,
// and returns the last cell for which stepOk(x,y) held — used to turn a
// click on an unreachable tile (darkness, a wall, a closed door) into
// "walk as far that way as possible" instead of silently ignoring the click.
function lastPassableAlongLine(sx,sy,tx,ty,stepOk){
  let x=sx,y=sy;
  const dx=Math.abs(tx-x),dy=Math.abs(ty-y);
  const stepX=tx>x?1:-1,stepY=ty>y?1:-1;
  let err=dx-dy;
  while(x!==tx||y!==ty){
    const e2=2*err;
    let nx=x,ny=y;
    if(e2>-dy){err-=dy;nx+=stepX;}
    if(e2<dx){err+=dx;ny+=stepY;}
    if(!stepOk(nx,ny))break;
    x=nx;y=ny;
  }
  return {x,y};
}

// The Golden Dragon's hoard — fixed, not the usual random gold/item roll
// (see the isDragon branch in CombatScreen's endCombat). Built fresh each
// fight so a re-fight after fleeing gets its own uids.
function dragonHoard(){
  const seed=Date.now();
  return [
    magicItem("mystic","ring",`dragon_ring_${seed}`),
    magicItem("crystal","potion",`dragon_potion_${seed}`),
    {id:"party_hat",name:"Party Hat",slot:"head",armourBonus:12,cost:5000,tier:5,
      desc:"A jaunty conical hat, somehow deflects blows.",uid:`dragon_hat_${seed}`},
  ];
}

function NpcModalCastle({enc,heroState,setHeroState,C,addLog,setDefeatedRooms,saves,saveMsg,onSaveGame,onLoadGame,onDeleteSave,hasIceCrystal,onLaunchStealth,hasBlackBelt,onLaunchNinja,onDismiss}){
  const [paid,setPaid]=React.useState(false);
  const action=enc.action||{};
  const inv=heroState.inventory||[];
  // Neither the Ice Crystal nor the Black Belt is a real inventory item —
  // they're one-off flags (see iceCrystal/blackBelt in CastleLevel) awarded
  // by winning their respective mini-games, so these two wantsIds check
  // those flags instead of the inventory.
  const isIceCrystalGate=action.wantsId==="ice_crystal";
  const isBlackBeltGate=action.wantsId==="black_belt";
  const hasItem=action.wantsId?(isIceCrystalGate?hasIceCrystal:isBlackBeltGate?hasBlackBelt:inv.some(i=>i.id===action.wantsId||i.uid===action.wantsId)):true;
  const isShelter=action.type==="shelter";
  // Always clickable for the ice-crystal/black-belt gates — the handler
  // below decides whether that click launches a mini-game or does the
  // normal trade.
  const canAct=!paid&&(isShelter||isIceCrystalGate||isBlackBeltGate||(action.wantsId?hasItem:true));
  const outerStyle={position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200};
  const innerStyle={background:C.panel,border:"2px solid "+C.border,borderRadius:10,padding:20,maxWidth:360,width:"90%",color:C.text};
  const btnStyle=(col,dis)=>({padding:"8px 16px",background:"transparent",border:"1.5px solid "+(dis?"#333":col),color:dis?"#444":col,cursor:dis?"not-allowed":"pointer",borderRadius:3,fontSize:12});
  const clearTrigger=()=>{
    const entryKey=enc.cx+","+enc.cy;
    setDefeatedRooms(dr=>{const nd=new Set(dr);nd.delete(entryKey+"_triggered");return nd;});
  };
  return(
    <div style={outerStyle}><div style={innerStyle}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
        <NpcPortrait col={enc.col} row={enc.row} size={300}/>
      </div>
      <div style={{fontSize:12,color:C.text,marginBottom:10,fontStyle:"italic"}}>
          "{isShelter?"They don't come over here for some reason. Rest and you will be safe.":(enc.dialogue||"I need something in return for my help.")}"
      </div>
      {action.wants&&!isShelter&&<div style={{fontSize:11,color:C.dim,marginBottom:10}}>
        Requires: <span style={{color:C.gold}}>{action.wants}</span>
        {hasItem&&<span style={{color:"#6fcf97",marginLeft:8}}>✓ {(isIceCrystalGate||isBlackBeltGate)?"obtained":"in inventory"}</span>}
      </div>}
      {!isShelter&&<div style={{fontSize:11,color:"#6a9a8a",marginBottom:14}}>
        Reward: {action.type==="secret_door"?"🚪 Secret passage":
                 action.type==="teleport"?"🌀 Teleport activated":
                 action.type==="fire_clear"?"❄ Fire cleared":"?"}
      </div>}
      {isShelter&&<div style={{marginBottom:14}}>
        <button style={{...btnStyle(C.gold,false),width:"100%"}} onClick={onSaveGame}>
          💾 Save Game
        </button>
        {saveMsg&&<div style={{marginTop:8,textAlign:"center",fontSize:11,
          color:saveMsg.startsWith("✓")?"#6fcf97":saveMsg.startsWith("✗")?C.red:C.dim,
          padding:"6px",background:"#0d0a06",borderRadius:4,border:"1px solid "+C.border}}>
          {saveMsg}
        </div>}
        <div style={{marginTop:10,color:C.dim,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>
          Load Game ({(saves||[]).length}/3)
        </div>
        {(saves||[]).length===0
          ? <div style={{fontSize:10,color:C.dim,fontStyle:"italic",textAlign:"center",padding:"6px 0"}}>No saved games found.</div>
          : [...saves].sort((a,b)=>b.timestamp-a.timestamp).map(entry=>(
              <div key={entry.timestamp} style={{display:"flex",gap:6,marginBottom:6}}>
                <button style={{...btnStyle(C.blue,false),flex:1,textAlign:"left"}}
                  onClick={()=>onLoadGame(entry)}>
                  📂 {new Date(entry.timestamp).toLocaleString()}
                </button>
                <button title="Delete save" style={{...btnStyle(C.red,false),flexShrink:0}}
                  onClick={()=>onDeleteSave&&onDeleteSave(entry)}>
                  ✕
                </button>
              </div>
            ))}
      </div>}
      <div style={{display:"flex",gap:8}}>
        <button style={{...btnStyle(isShelter?"#2d8a4e":C.gold,!canAct),flex:1}}
          onClick={()=>{
            if(!canAct)return;
            if(isIceCrystalGate&&!hasIceCrystal){
              setPaid(true);
              onLaunchStealth();
              return;
            }
            if(isBlackBeltGate&&!hasBlackBelt){
              setPaid(true);
              onLaunchNinja();
              return;
            }
            setPaid(true);
            if(isShelter){
              setHeroState(h=>({...h,health:100}));
              addLog("🛖 You rest and recover fully.");
              clearTrigger();
              onDismiss(false);
            } else {
              if(action.wantsId) setHeroState(h=>({...h,inventory:h.inventory.filter(i=>i.id!==action.wantsId&&i.uid!==action.wantsId)}));
              addLog("🧙 "+enc.name+": deal done.");
              onDismiss(true,action.type);
            }
          }}>
          {isShelter?"Sleep (restore HP)":
            isIceCrystalGate&&!hasIceCrystal?"Steal the Ice Crystal":
            isBlackBeltGate&&!hasBlackBelt?"Enter the Dojo":
            (action.wantsId&&!hasItem?"Need: "+action.wants:"Help me")}
        </button>
        <button style={{...btnStyle(C.dim,false),flex:1}}
          onClick={()=>{clearTrigger();onDismiss(false);}}>
          Leave
        </button>
      </div>
    </div></div>
  );
}

// Shown once when the hero first steps into the dragon's room, before combat
// starts — a chance to back out via Flee (which leaves the room exactly like
// walking away from any other encounter) instead of being dropped straight
// into CombatScreen with no warning.
function DragonIntroModal({C,onFight,onFlee}){
  const outerStyle={position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200};
  const innerStyle={background:C.panel,border:"2px solid "+C.border,borderRadius:10,padding:20,maxWidth:420,width:"90%",color:C.text,textAlign:"center"};
  const btnStyle=col=>({padding:"10px 20px",background:"transparent",border:"1.5px solid "+col,color:col,cursor:"pointer",borderRadius:3,fontSize:13,flex:1});
  return(
    <div style={outerStyle}><div style={innerStyle}>
      <img src={DRAGON_IMG} alt="The Golden Dragon" style={{width:"100%",maxWidth:340,height:260,objectFit:"cover",borderRadius:8,border:"2px solid "+C.border,marginBottom:14}}/>
      <div style={{fontSize:16,color:C.gold,fontFamily:"serif",marginBottom:8}}>The Golden Dragon</div>
      <div style={{fontSize:12,color:C.text,marginBottom:16,fontStyle:"italic"}}>
        "I am magnificent and very beautiful. Look at how shiny my shiny scales are, little hero. And my fire! Bet you can't breathe fire. And I have a lot of gold. Now run, or I'll bite you!"
      </div>
      <div style={{display:"flex",gap:10}}>
        <button style={btnStyle(C.red)} onClick={onFight}>⚔ Fight</button>
        <button style={btnStyle(C.dim)} onClick={onFlee}>🏃 Flee</button>
      </div>
    </div></div>
  );
}

export default function CastleLevel({heroState,setHeroState,addLog,onExit,onWin,onDeath,initialState,onSaveGame,onLoadGame,onDeleteSave,saves,saveMsg}){
  const canvasRef=React.useRef(null);
  // initialState (from a loaded save's castleState) seeds every piece of
  // castle progress below instead of the fresh-entry defaults — levelIdx
  // must be seeded first since `level` and several other initializers
  // depend on it.
  const [levelIdx,setLevelIdx]=React.useState(()=>initialState?.levelIdx ?? 0);
  const level=React.useMemo(()=>scaleLevel(CASTLE_LEVELS[levelIdx]),[levelIdx]);
  const [keyOpen,setKeyOpen]=React.useState(false);

  // Per-level progress (doors, keys, items, encounters, secrets, fog of
  // war...) is cached here keyed by levelIdx, so switching levels — or
  // saving/loading — doesn't discard whichever level isn't currently
  // active. goToLevel() writes the outgoing level's live state into this
  // cache before switching and reads the incoming level's state back out
  // of it (falling back to fresh defaults the first time a level is
  // entered). Room/door ids are reused between levels (e.g. both levels
  // have a "room_1"), so this per-level namespacing also stops progress on
  // one level from bleeding into the other.
  const levelCacheRef=React.useRef(null);
  if(levelCacheRef.current===null){
    const cache={};
    for(const [idxKey,ls] of Object.entries(initialState?.levels ?? {})){
      cache[idxKey]={
        closedBarriers:new Set(ls.closedBarriers ?? []),
        groundKeys:ls.groundKeys,
        groundItems:ls.groundItems,
        encounters:ls.encounters,
        defeatedRooms:new Set(ls.defeatedRooms ?? []),
        secretRevealed:new Set(ls.secretRevealed ?? []),
        teleportsActive:new Set(ls.teleportsActive ?? []),
        fireCleared:new Set(ls.fireCleared ?? []),
        explored:new Set(ls.explored ?? []),
      };
    }
    levelCacheRef.current=cache;
  }
  const initialLevelCache=levelCacheRef.current[levelIdx];

  const [heroPos,setHeroPos]=React.useState(()=>initialState?.heroPos ?? {x:level.start[0],y:level.start[1]});
  const heroPosRef=React.useRef(initialState?.heroPos ?? {x:level.start[0],y:level.start[1]});
  // Barrier model (matches StealthGame): barrierDefs are static per-level door
  // definitions; closedBarriers is the Set of ids still blocking passage —
  // removing an id from the set opens that door.
  const [closedBarriers,setClosedBarriers]=React.useState(()=>new Set(initialLevelCache?.closedBarriers ?? level.barrierDefs.map(d=>d.id)));
  const closedBarriersRef=React.useRef(closedBarriers);
  React.useEffect(()=>{closedBarriersRef.current=closedBarriers;},[closedBarriers]);
  const [heroKeys,setHeroKeys]=React.useState(()=>initialState?.heroKeys ?? []);
  const heroKeysRef=React.useRef(initialState?.heroKeys ?? []);
  React.useEffect(()=>{heroKeysRef.current=heroKeys;},[heroKeys]);
  const [groundKeys,setGroundKeys]=React.useState(()=>initialLevelCache?.groundKeys ?? level.keys);
  const groundKeysRef=React.useRef(groundKeys);
  React.useEffect(()=>{groundKeysRef.current=groundKeys;},[groundKeys]);
  const [groundItems,setGroundItems]=React.useState(()=>initialLevelCache?.groundItems ?? {...level.groundItemsInit});
  const groundItemsRef=React.useRef(groundItems);
  React.useEffect(()=>{groundItemsRef.current=groundItems;},[groundItems]);
  const [groundModal,setGroundModal]=React.useState(null);
  const [encounters,setEncounters]=React.useState(()=>initialLevelCache?.encounters ?? level.encounters);
  const encRef=React.useRef(encounters);
  React.useEffect(()=>{encRef.current=encounters;},[encounters]);
  const [defeatedRooms,setDefeatedRooms]=React.useState(()=>new Set(initialLevelCache?.defeatedRooms ?? []));
  const defeatedRoomsRef=React.useRef(defeatedRooms);
  React.useEffect(()=>{defeatedRoomsRef.current=defeatedRooms;},[defeatedRooms]);
  const [encModal,setEncModal]=React.useState(null);
  const [target,setTarget]=React.useState(null);
  const pathRef=React.useRef([]);
  const exploredRef=React.useRef(new Set(initialLevelCache?.explored ?? []));
  // Tracks the ground-item tile the modal was last auto-shown for, so
  // dismissing it doesn't immediately re-show the same tile — the hero
  // must actually reach a different tile before it can trigger again.
  const shownGroundKeyRef=React.useRef(null);
  // Same idea, for monster/NPC encounter triggering.
  const shownEncounterKeyRef=React.useRef(null);
  const lastCorridorRef=React.useRef(initialState?.heroPos ?? {x:level.start[0],y:level.start[1]});
  const [msg,setMsg]=React.useState(null);
  const [log,setLog]=React.useState([]);
  const addCLog=m=>{addLog(m);setLog(p=>[m,...p].slice(0,15));};

  // Secret doors, teleporters, fire state
  const [secretRevealed,setSecretRevealed]=React.useState(()=>new Set(initialLevelCache?.secretRevealed ?? []));
  const secretRevealedRef=React.useRef(secretRevealed);
  React.useEffect(()=>{secretRevealedRef.current=secretRevealed;},[secretRevealed]);
  const [teleportsActive,setTeleportsActive]=React.useState(()=>new Set(initialLevelCache?.teleportsActive ?? []));
  const teleportsActiveRef=React.useRef(teleportsActive);
  React.useEffect(()=>{teleportsActiveRef.current=teleportsActive;},[teleportsActive]);
  const [fireCleared,setFireCleared]=React.useState(()=>new Set(initialLevelCache?.fireCleared ?? []));  // set of room ids with fire cleared
  const fireClearedRef=React.useRef(fireCleared);
  React.useEffect(()=>{fireClearedRef.current=fireCleared;},[fireCleared]);
  const [combatModal,setCombatModal]=React.useState(null);
  const [multiCombatModal,setMultiCombatModal]=React.useState(null);
  const [dragonIntroModal,setDragonIntroModal]=React.useState(null);
  // One-off castle-wide reward, awarded by winning the Stealth mini-game
  // (see Red's NPC entry, room_13/level 1) — displayed as a header icon like
  // heroKeys, not added to heroState.inventory. Not per-level, so goToLevel
  // never resets it.
  const [iceCrystal,setIceCrystal]=React.useState(()=>initialState?.iceCrystal ?? false);
  const iceCrystalRef=React.useRef(iceCrystal);
  React.useEffect(()=>{iceCrystalRef.current=iceCrystal;},[iceCrystal]);
  const [playingStealth,setPlayingStealth]=React.useState(false);
  // Same one-off header-icon pattern, awarded by winning the Ninja Dummy
  // mini-game (see the Acolyte's NPC entry, room_13/level 2).
  const [blackBelt,setBlackBelt]=React.useState(()=>initialState?.blackBelt ?? false);
  const blackBeltRef=React.useRef(blackBelt);
  React.useEffect(()=>{blackBeltRef.current=blackBelt;},[blackBelt]);
  const [playingNinja,setPlayingNinja]=React.useState(false);

  const C={bg:"#0d0a06",panel:"#1a1510",border:"#3d2f18",gold:"#c9a84c",text:"#e8dcc8",dim:"#7a6a4a",red:"#c0392b",green:"#2d8a4e",blue:"#2e6da4"};

  // Snapshots the live per-level state (the pieces cached by levelCacheRef)
  // for whichever level is currently active, so it can be written into the
  // cache before switching away from it or before saving. Reads from the
  // *Ref mirrors, not the useState values directly — this is called from
  // deep inside the walk-step timer chain (see goToLevel), whose closure
  // can be one or more renders behind the latest setEncounters/setGroundKeys/
  // etc. call; the refs are kept in sync via effects and are always current.
  const snapshotCurrentLevel=()=>({
    closedBarriers:new Set(closedBarriersRef.current),
    groundKeys:groundKeysRef.current,
    groundItems:groundItemsRef.current,
    encounters:encRef.current,
    defeatedRooms:new Set(defeatedRoomsRef.current),
    secretRevealed:new Set(secretRevealedRef.current),
    teleportsActive:new Set(teleportsActiveRef.current),
    fireCleared:new Set(fireClearedRef.current),
    explored:new Set(exploredRef.current),
  });

  // Gathers current castle progress for saving — mirrors the shape
  // `initialState` seeds the useStates above from. Sets aren't JSON-
  // serializable, so they're converted to arrays here. Per-level state
  // covers both levels (whichever isn't currently active comes straight
  // out of levelCacheRef), not just the one the hero is standing on.
  const buildCastleSnapshot=()=>{
    levelCacheRef.current[levelIdx]=snapshotCurrentLevel();
    const levels={};
    for(const [idxKey,ls] of Object.entries(levelCacheRef.current)){
      levels[idxKey]={
        closedBarriers:[...ls.closedBarriers],
        groundKeys:ls.groundKeys,
        groundItems:ls.groundItems,
        encounters:ls.encounters,
        defeatedRooms:[...ls.defeatedRooms],
        secretRevealed:[...ls.secretRevealed],
        teleportsActive:[...ls.teleportsActive],
        fireCleared:[...ls.fireCleared],
        explored:[...ls.explored],
      };
    }
    return {
      levelIdx,
      heroPos:heroPosRef.current,
      heroKeys:heroKeysRef.current,
      iceCrystal:iceCrystalRef.current,
      blackBelt:blackBeltRef.current,
      levels,
    };
  };

  // Switch level. viaStairs spawns the hero at the target level's `stairs`
  // position instead of its `start` — used when ascending back from level 2
  // via its start square, so the hero lands where level 1's down-stairs are,
  // not back at level 1's own entrance. The level being left has its live
  // state written into levelCacheRef so it's restored exactly as left when
  // the hero comes back; the level being entered is restored from that same
  // cache (or fresh defaults, the first time it's visited).
  const goToLevel=(idx,{viaStairs}={})=>{
    levelCacheRef.current[levelIdx]=snapshotCurrentLevel();
    const lv=scaleLevel(CASTLE_LEVELS[idx]);
    const spawn=viaStairs?{x:lv.stairs[0],y:lv.stairs[1]}:{x:lv.start[0],y:lv.start[1]};
    const cached=levelCacheRef.current[idx];
    setLevelIdx(idx);
    setHeroPos(spawn);
    heroPosRef.current=spawn;
    const cb=new Set(cached?.closedBarriers ?? lv.barrierDefs.map(d=>d.id));
    setClosedBarriers(cb);
    closedBarriersRef.current=cb;
    // heroKeys is NOT reset here — keys are tagged with the level they were
    // found on (see pickup below) and only unlock doors on that same level,
    // so carrying them across a level transition is harmless and lets the
    // hero keep level 2 keys when popping back up to level 1 via the stairs.
    setGroundKeys(cached?.groundKeys ?? lv.keys);
    setGroundItems(cached?.groundItems ?? {...lv.groundItemsInit});
    const encs=cached?.encounters ?? lv.encounters;
    setEncounters(encs);
    encRef.current=encs;
    setDefeatedRooms(new Set(cached?.defeatedRooms ?? []));
    setSecretRevealed(new Set(cached?.secretRevealed ?? []));
    setTeleportsActive(new Set(cached?.teleportsActive ?? []));
    setFireCleared(new Set(cached?.fireCleared ?? []));
    exploredRef.current=new Set(cached?.explored ?? []);
    pathRef.current=[];setTarget(null);
  };

  const rooms=level.rooms;
  const passableSet=React.useMemo(()=>{
    const set=new Set();
    for(const r of level.rooms){
      for(let y=r.ry;y<r.ry+r.rh;y++)
        for(let x=r.rx;x<r.rx+r.rw;x++)
          set.add(`${x},${y}`);
    }
    for(const c of level.corridors){
      // Each corridor point is the origin of a SCALE x SCALE block (matching
      // how a raw 1x1 corridor cell scales up), not a single scaled point.
      for(const[bx,by]of c.cells){
        for(let y=by;y<by+SCALE;y++)
          for(let x=bx;x<bx+SCALE;x++)
            set.add(`${x},${y}`);
      }
    }
    return set;
  },[level]);

  // Corridors leading up to an unrevealed secret door (see barrierDefs'
  // optional secretCorridorId) stay fully disguised too — otherwise a
  // corridor that dead-ends at a wall gives the secret away on sight, even
  // though the door cell itself is already hidden. Once the door's id is in
  // secretRevealed, its corridor is excluded here and behaves normally.
  const hiddenCorridorCells=React.useMemo(()=>{
    const set=new Set();
    for(const d of level.barrierDefs){
      if(!d.isSecret||!d.secretCorridorId||secretRevealed.has(d.id))continue;
      const c=level.corridors.find(c=>c.id===d.secretCorridorId);
      if(!c)continue;
      for(const[bx,by]of c.cells){
        for(let y=by;y<by+SCALE;y++)
          for(let x=bx;x<bx+SCALE;x++)
            set.add(`${x},${y}`);
      }
    }
    return set;
  },[level,secretRevealed]);

  const isPassable=(x,y)=>castlePassable(passableSet,x,y)&&!hiddenCorridorCells.has(`${x},${y}`);

  const doorAt=(x,y,doorList,inclSecret)=>{
    for(const d of doorList){
      if(d.isSecret&&!secretRevealed.has(d.id)&&!inclSecret)continue;
      const r=d.rect;
      if(x>=r.x0&&x<r.x1&&y>=r.y0&&y<r.y1)return d;
    }
    return null;
  };
  
  const isFire=(x,y)=>{
    const room=rooms.find(r=>x>=r.rx&&x<r.rx+r.rw&&y>=r.ry&&y<r.ry+r.rh);
    if(!room||fireCleared.has(room.id))return false;
    // A room can have several "fire" entries (one per raw cell filled with
    // fire) — check all of them, not just the first found.
    return encRef.current.some(e=>e.type==="fire"&&e.room===room.id&&e.cells&&e.cells.some(c=>c[0]===x&&c[1]===y));
  };

  const canPass=(x,y,doorList,keyList,closedSet)=>{
    if(!isPassable(x,y))return false;
    if(isFire(x,y))return false;
    const d=doorAt(x,y,doorList);
    if(d&&closedSet.has(d.id)){
      if(d.isSecret&&!secretRevealed.has(d.id))return false;
      if(d.locked)return keyList.some(k=>k.keyType===d.locked&&k.level===levelIdx);
    }
    return true;
  };

  // Visited set for BFS path
  const bfsPath=(sx,sy,tx,ty,doorList,keyList,explored,closedSet)=>{
    if(sx===tx&&sy===ty)return[];
    const vis=new Map([[`${sx},${sy}`,null]]);
    const q=[[sx,sy]];
    // 8-directional, same as the island's computePath — diagonal moves are
    // blocked if either flanking orthogonal cell isn't passable, so the hero
    // can't cut through a wall corner.
    const dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
    while(q.length){
      const[x,y]=q.shift();
      for(const[dx,dy]of dirs){
        const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;
        if(!canPass(nx,ny,doorList,keyList,closedSet))continue;
        if(dx!==0&&dy!==0&&(!canPass(x+dx,y,doorList,keyList,closedSet)||!canPass(x,y+dy,doorList,keyList,closedSet)))continue;
        if(explored&&!explored.has(k))continue;
        if(vis.has(k))continue;
        vis.set(k,`${x},${y}`);
        if(nx===tx&&ny===ty){
          const path=[];let c=k;
          const startKey=`${sx},${sy}`;
          // Stop before the start cell itself (matches the island's
          // computePath) — otherwise the returned path's first "step" is
          // just the hero's current tile, a harmless no-op for most walk-
          // step checks (they're debounced against re-processing the same
          // tile) but not for one-shot triggers like the stairs: landing
          // exactly on a stairs tile, then clicking anywhere else, would
          // immediately re-trigger that tile's transition before the hero
          // ever moves.
          while(c&&c!==startKey){const[px,py]=c.split(",").map(Number);path.unshift({x:px,y:py});c=vis.get(c);}
          return path;
        }
        q.push([nx,ny]);
      }
    }
    return null;
  };

  // Compute LOS
  // maxSteps bounds how far a ray travels before giving up even if unblocked;
  // rays always stop early at a wall/closed door regardless. Used both for
  // the short "highlight" radius and the long/boundless exploration pass.
  const castRays=(hx,hy,doorList,closedSet,maxSteps)=>{
    const vis=new Set([`${hx},${hy}`]);
    for(let a=0;a<360;a+=0.5){
      const rad=a*Math.PI/180;
      let rx=hx+0.5,ry=hy+0.5;
      for(let d=0;d<maxSteps;d++){
        const cx=Math.floor(rx),cy=Math.floor(ry);
        if(cx<0||cy<0||cx>=CASTLE_SIZE||cy>=CASTLE_SIZE)break;
        vis.add(`${cx},${cy}`);
        if(!isPassable(cx,cy))break;
        const sd=doorAt(cx,cy,doorList);
        if(sd&&closedSet.has(sd.id)&&!(cx===hx&&cy===hy))break;
        rx+=Math.cos(rad)*0.5;ry+=Math.sin(rad)*0.5;
      }
    }
    return vis;
  };
  // Bounded — matches the old radius, used only for the "fully lit" highlight.
  const computeVis=(hx,hy,doorList,closedSet)=>castRays(hx,hy,doorList,closedSet,CASTLE_HALF+1);
  // Boundless (capped only by the map size) — rays still stop at walls/closed
  // doors, but otherwise travel as far as sight reaches. Drives exploration/
  // fog-of-war and click-to-move eligibility.
  // Each ray step only advances 0.5 cells, so reaching an actual radius of
  // CASTLE_HALF cells (the view's edge) takes CASTLE_HALF*2 steps, not
  // CASTLE_HALF+1 — that shorter figure is computeVis's own (smaller,
  // "highlight") radius. Using it here by mistake made the two passes
  // identical and erased the farther fog-of-war reveal entirely.
  // A circular radius of CASTLE_HALF cells reaches the flat edges of the
  // square viewport but not its corners (which sit at CASTLE_HALF*sqrt(2)
  // cells out) — scale the step count by sqrt(2) so those get reached too.
  const computeVisFar=(hx,hy,doorList,closedSet)=>castRays(hx,hy,doorList,closedSet,Math.ceil((CASTLE_HALF*2+1)*Math.SQRT2));

  // Torches: static, indestructible light sources. Same reach/radius as the
  // hero's own "highlight" glow (computeVis), just centred on the torch and
  // always on, independent of hero position. reached (per-torch) is the set
  // of cells the torch's own LOS-respecting raycast actually gets to —
  // walls/closed doors block it exactly like the hero's rays — kept around
  // so the halo render pass can clip its glow to those cells instead of
  // painting a raw gradient rect that would bleed straight through walls.
  const torchReachSets=React.useMemo(()=>
    (level.torches||[]).map(([tx,ty,radius=1])=>
      castRays(tx,ty,level.barrierDefs,closedBarriers,Math.round((CASTLE_HALF+1)*radius))
    ),
  [level,closedBarriers]);
  // Merged distance-from-nearest-torch map, built from the same per-torch
  // reach sets above. Value is distance-from-torch, so overlapping hero/
  // torch light can use whichever is closer for the brightness fade.
  const torchLitMap=React.useMemo(()=>{
    const m=new Map();
    (level.torches||[]).forEach(([tx,ty,radius=1],i)=>{
      const reached=torchReachSets[i];
      for(const k of reached){
        const [cx,cy]=k.split(",").map(Number);
        // Normalize by radius so the shared fade math below (tuned for the
        // hero's own HIGHLIGHT_REACH) fades a smaller-radius torch out
        // sooner, and a larger one further out.
        const d=Math.hypot(cx-tx,cy-ty)/radius;
        if(!m.has(k)||d<m.get(k))m.set(k,d);
      }
    });
    return m;
  },[level,torchReachSets]);

  // Floor patterns (same as castle_test_v1)
  const PATTERNS=["chessboard","concentric","herringbone","pinwheel"];
  const PALETTES={
    chessboard:[["#9b4a4a","#4a6a9b"],["#4a7a3a","#9b8a30"],["#6a3a8a","#2a7a7a"]],
    concentric:[["#8a3a3a","#b8a888","#3a5a8a"],["#3a6a3a","#a8988a","#8a7a2a"]],
    herringbone:[["#9a5030","#4a5a70"],["#3a6030","#8a6820"]],
    pinwheel:[["#3a508a","#8a7028"],["#6a2838","#4a6a50"]],
  };
  const roomPatterns=React.useRef({});
  if(Object.keys(roomPatterns.current).length===0){
    rooms.forEach((r,i)=>{
      if(r.rw>5&&r.rh>5){
        const p=PATTERNS[i%PATTERNS.length];
        const pal=PALETTES[p][i%PALETTES[p].length];
        roomPatterns.current[r.id]={p,pal};
      }
    });
  }

  const pnoise=(x,y)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);};

  // Draw
  const draw=React.useCallback((hx,hy,tgt,doorList,gKeys,encs,closedSet,gItems)=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#000";ctx.fillRect(0,0,CASTLE_CANVAS,CASTLE_CANVAS);
    const vis=computeVis(hx,hy,doorList,closedSet);
    // Boundless pass (still stops at walls/closed doors) — anything it
    // reaches becomes permanently explored/clickable, rendered as fog of war
    // if outside the short "highlight" radius above. A room behind a closed
    // door is never in this set at all (the ray can't get past the door), so
    // it stays black; once the door's open, LOS reaches in normally and the
    // room reveals like any other space — no special-casing needed here.
    const visFar=computeVisFar(hx,hy,doorList,closedSet);
    for(const k of visFar)exploredRef.current.add(k);
    const lv=level;
    for(let vy=0;vy<CASTLE_VIEW;vy++){
      for(let vx=0;vx<CASTLE_VIEW;vx++){
        const wx=hx-CASTLE_HALF+vx,wy=hy-CASTLE_HALF+vy;
        if(wx<0||wy<0||wx>=CASTLE_SIZE||wy>=CASTLE_SIZE)continue;
        const px=vx*CASTLE_CELL,py=vy*CASTLE_CELL;
        const S=CASTLE_CELL,R=S/2,C2=S/2;
        const cellKey=`${wx},${wy}`;
        const isExp=exploredRef.current.has(cellKey);
        if(!isExp){ctx.fillStyle="#000";ctx.fillRect(px,py,S,S);continue;}
        const isHeroVis=vis.has(cellKey);
        const torchDist=torchLitMap.has(cellKey)?torchLitMap.get(cellKey):null;
        const isVis=isHeroVis||torchDist!==null;
        const doorHere=doorAt(wx,wy,doorList);
        // An unrevealed secret door renders exactly like solid wall — no
        // grey giveaway square — and is treated as a wall for the fog-dim
        // pass below too, until secretRevealed picks it up.
        const hiddenSecretDoor=doorHere&&doorHere.isSecret&&!secretRevealed.has(doorHere.id);
        const isWall=!isPassable(wx,wy)||hiddenSecretDoor;

        if(isWall){
          // Wall — lit only by the hero's own presence, never by torches, so
          // solid rock stays pure black instead of glowing near a static
          // light source (see fog-dim block below, which uses isWallVis).
          const isWallVis=isHeroVis;
          const n=(pnoise(wx,wy)-0.5)*20+(pnoise(wx*3,wy*3)-0.5)*8;
          const c=Math.round(40+n);
          ctx.fillStyle=`rgb(${c},${c},${c})`;ctx.fillRect(px,py,S,S);
          if(isWallVis){ctx.globalAlpha=0.15;ctx.strokeStyle="#fff";ctx.lineWidth=0.5;
            ctx.strokeRect(px+S*0.2,py+S*0.15,S*0.5,S*0.6);ctx.globalAlpha=1;}
        } else {
          // Floor
          const room=rooms.find(r=>wx>=r.rx&&wx<r.rx+r.rw&&wy>=r.ry&&wy<r.ry+r.rh);
          const rp=room?roomPatterns.current[room.id]:null;
          if(rp){
            const lx=wx-room.rx,ly=wy-room.ry,rw=room.rw,rh=room.rh,pal=rp.pal;
            let idx=0;
            if(rp.p==="chessboard")idx=(lx+ly)%2;
            if(rp.p==="concentric")idx=Math.min(lx,ly,rw-1-lx,rh-1-ly)%pal.length;
            if(rp.p==="herringbone")idx=(Math.floor(lx/2)+Math.floor(ly/2))%2;
            if(rp.p==="pinwheel")idx=(Math.floor(lx/2)+Math.floor(ly/2))%2===0?(lx%2===0?0:1):(lx%2===0?1:0);
            ctx.fillStyle=pal[idx%pal.length];ctx.fillRect(px,py,S,S);
            ctx.globalAlpha=0.05+(pnoise(wx*3,wy*3)*0.05);
            ctx.fillStyle=pnoise(wx*5,wy*5)>0.5?"#fff":"#000";ctx.fillRect(px,py,S,S);ctx.globalAlpha=1;
          } else {
            const n=(pnoise(wx,wy)-0.5)*18+(pnoise(wx*2,wy*2)-0.5)*8;
            const nr=Math.round(110+n),ng=Math.round(95+n*0.8),nb=Math.round(75+n*0.6);
            ctx.fillStyle=`rgb(${Math.min(255,Math.max(0,nr))},${Math.min(255,Math.max(0,ng))},${Math.min(255,Math.max(0,nb))})`;
            ctx.fillRect(px,py,S,S);
          }
          // Door — hiddenSecretDoor took the wall branch above instead, so
          // by the time we're here it's either not secret or already
          // revealed, and renders as a normal door either way.
          const door=doorHere;
          if(door){
            const isOpen=!closedSet.has(door.id);
            const locked=door.locked&&!isOpen;
            ctx.fillStyle=locked?(KEY_COLORS_C[door.locked]||"#8b6914"):(isOpen?"#5a4a30":"#8b6914");
            ctx.fillRect(px,py,S,S);
            if(locked){
              // Door rect spans multiple cells now — draw the lock icon
              // once, at the rect's centre cell, not on every sub-cell.
              const r=door.rect;
              const ccx=Math.floor((r.x0+r.x1-1)/2),ccy=Math.floor((r.y0+r.y1-1)/2);
              if(wx===ccx&&wy===ccy){
                ctx.font=`${Math.round(S*0.35)}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";
                ctx.fillText("🔒",px+S/2,py+S/2);
              }
            }
          }
          // Dropped/ground items
          const gi=(gItems||{})[`${wx},${wy}`];
          if(gi&&gi.length>0){
            ctx.font=`${Math.round(S*0.55)}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";
            ctx.fillText("📦",px+S/2,py+S/2);
          }
          // Encounters — NPCs are drawn oversized in their own pass below
          // (like keys/torches), so skip them here.
          const enc=(encs||[]).find(e=>e.cx===wx&&e.cy===wy);
          if(enc&&enc.type!=="npc"){
            const icon=enc.type==="monster"?"👾":enc.type==="dragon_boss"?"🐉":
              enc.type==="items"?"📦":"?";
            ctx.font=`${Math.round(S*0.65)}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";
            ctx.fillText(icon,px+S/2,py+S/2+1);
          }
          // Stairs — icon itself is drawn oversized (3x3) in its own pass
          // below, after every tile has been painted, same reason as keys/NPCs.
          // Entrance — on level 2, the start square doubles as an
          // up-staircase back to level 1 (its ladder icon is in the same
          // oversized pass below).
          if(wx===lv.start[0]&&wy===lv.start[1]){
            ctx.fillStyle="#c9a84c44";ctx.fillRect(px,py,S,S);
          }
          // Teleporter pads — invisible until teleportsActive has the
          // gating room (see dismissEnc's "teleport" action).
          for(const t of (lv.teleporters||[])){
            if(!teleportsActive.has(t.gateRoom))continue;
            if((wx===t.a.x&&wy===t.a.y)||(wx===t.b.x&&wy===t.b.y)){
              ctx.font=`${Math.round(S*0.6)}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";
              ctx.fillText("🌀",px+S/2,py+S/2+1);
            }
          }
        }
        // Fog of war dim — soft fade near the edge of the highlight radius
        // instead of a hard cutoff between full brightness and fog. A cell
        // can be lit by the hero, a torch, or both — use whichever is
        // closer (only counting hero distance if the hero's own LOS
        // actually reaches this cell, not just straight-line proximity).
        // Walls never take torch light into account (see isWallVis above) —
        // solid rock stays pure black unless the hero is right next to it.
        if(isWall?isHeroVis:isVis){
          let dist;
          if(isWall)dist=Math.hypot(wx-hx,wy-hy);
          else if(isHeroVis&&torchDist!==null)dist=Math.min(Math.hypot(wx-hx,wy-hy),torchDist);
          else if(isHeroVis)dist=Math.hypot(wx-hx,wy-hy);
          else dist=torchDist;
          const fadeStart=HIGHLIGHT_REACH*0.5;
          const t=Math.max(0,Math.min(1,(dist-fadeStart)/(HIGHLIGHT_REACH-fadeStart)));
          if(t>0){ctx.fillStyle=`rgba(0,0,0,${(t*0.75).toFixed(3)})`;ctx.fillRect(px,py,S,S);}
        } else {
          ctx.fillStyle="rgba(0,0,0,0.75)";ctx.fillRect(px,py,S,S);
        }
      }
    }
    // Stairs / entrance — drawn oversized (3x3 cells), same pattern as keys
    // below, so the icon reads clearly instead of being squeezed into one cell.
    {
      const stairsKey=`${lv.stairs[0]},${lv.stairs[1]}`;
      if(vis.has(stairsKey)||exploredRef.current.has(stairsKey)){
        const svx=lv.stairs[0]-hx+CASTLE_HALF,svy=lv.stairs[1]-hy+CASTLE_HALF;
        if(svx>=0&&svy>=0&&svx<CASTLE_VIEW&&svy<CASTLE_VIEW){
          const spx=svx*CASTLE_CELL,spy=svy*CASTLE_CELL;
          ctx.font=`${Math.round(CASTLE_CELL*3*0.8)}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";
          ctx.fillText(levelIdx===0?"🪜":"🐉",spx+CASTLE_CELL/2,spy+CASTLE_CELL/2);
        }
      }
      if(levelIdx===1){
        const startKey=`${lv.start[0]},${lv.start[1]}`;
        if(vis.has(startKey)||exploredRef.current.has(startKey)){
          const evx=lv.start[0]-hx+CASTLE_HALF,evy=lv.start[1]-hy+CASTLE_HALF;
          if(evx>=0&&evy>=0&&evx<CASTLE_VIEW&&evy<CASTLE_VIEW){
            const epx=evx*CASTLE_CELL,epy=evy*CASTLE_CELL;
            ctx.font=`${Math.round(CASTLE_CELL*3*0.8)}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";
            ctx.fillText("🪜",epx+CASTLE_CELL/2,epy+CASTLE_CELL/2);
          }
        }
      }
    }
    // Keys on ground — drawn oversized (3x3 cells) in their own pass, after
    // every tile has been painted, so the overflow isn't clipped by a
    // later-drawn neighbouring cell's floor fill.
    for(const gk of (gKeys||[])){
      const cellKey=`${gk.x},${gk.y}`;
      if(!vis.has(cellKey)&&!exploredRef.current.has(cellKey))continue;
      const kvx=gk.x-hx+CASTLE_HALF,kvy=gk.y-hy+CASTLE_HALF;
      if(kvx<0||kvy<0||kvx>=CASTLE_VIEW||kvy>=CASTLE_VIEW)continue;
      const kpx=kvx*CASTLE_CELL,kpy=kvy*CASTLE_CELL;
      ctx.fillStyle=KEY_COLORS_C[gk.keyType]||"#fff";
      ctx.font=`${Math.round(CASTLE_CELL*3*0.8)}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText("🗝",kpx+CASTLE_CELL/2,kpy+CASTLE_CELL/2);
    }
    // NPCs — drawn oversized (3x3 cells), same pattern as keys above. Always
    // the same wizard icon regardless of what they offer — it should read
    // as "a person is here", not advertise the reward in advance.
    for(const enc of (encs||[])){
      if(enc.type!=="npc")continue;
      const cellKey=`${enc.cx},${enc.cy}`;
      if(!vis.has(cellKey)&&!exploredRef.current.has(cellKey))continue;
      const evx=enc.cx-hx+CASTLE_HALF,evy=enc.cy-hy+CASTLE_HALF;
      if(evx<0||evy<0||evx>=CASTLE_VIEW||evy>=CASTLE_VIEW)continue;
      const epx=evx*CASTLE_CELL,epy=evy*CASTLE_CELL;
      ctx.font=`${Math.round(CASTLE_CELL*3*0.8)}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText("🧙",epx+CASTLE_CELL/2,epy+CASTLE_CELL/2);
    }
    // Fire — unpassable hazard, visually like a torch (see below) but scaled
    // up to fill the whole SCALE x SCALE block it blocks, instead of a
    // single cell. Cleared via the fire_clear NPC action (see dismissEnc),
    // tracked per-room in fireCleared — once cleared it stops rendering
    // here and canPass() stops blocking it (see isFire).
    for(const enc of (encs||[])){
      if(enc.type!=="fire"||fireCleared.has(enc.room))continue;
      const [fx,fy]=enc.cells[0];
      const cellKey=`${fx},${fy}`;
      if(!vis.has(cellKey)&&!exploredRef.current.has(cellKey))continue;
      const fvx=fx-hx+CASTLE_HALF,fvy=fy-hy+CASTLE_HALF;
      if(fvx<0||fvy<0||fvx>=CASTLE_VIEW||fvy>=CASTLE_VIEW)continue;
      const fpx=fvx*CASTLE_CELL,fpy=fvy*CASTLE_CELL;
      const FS=CASTLE_CELL*SCALE;
      ctx.fillStyle="#cc5500";ctx.fillRect(fpx+2,fpy+2,FS-4,FS-4);
      ctx.fillStyle="#ffaa00";ctx.fillRect(fpx+4,fpy+4,FS-8,FS-8);
      ctx.font=`${FS-4}px sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText("🔥",fpx+FS/2,fpy+FS/2);
    }
    // Torches — static, indestructible light sources (visual style borrowed
    // from StealthGame's torches, minus the destructible/state-tracking
    // part). Halo is drawn in its own pass, after every tile, so the large
    // radial glow isn't clipped by neighbouring cells painting over it.
    level.torches?.forEach(([tx,ty,radius=1],torchIdx)=>{
      const cellKey=`${tx},${ty}`;
      if(!vis.has(cellKey)&&!exploredRef.current.has(cellKey))return;
      const tvx=tx-hx+CASTLE_HALF,tvy=ty-hy+CASTLE_HALF;
      if(tvx<0||tvy<0||tvx>=CASTLE_VIEW||tvy>=CASTLE_VIEW)return;
      const tpx=tvx*CASTLE_CELL,tpy=tvy*CASTLE_CELL;
      const haloR=HIGHLIGHT_REACH*CASTLE_CELL*radius;
      const hcx=tpx+CASTLE_CELL/2,hcy=tpy+CASTLE_CELL/2;
      const grad=ctx.createRadialGradient(hcx,hcy,0,hcx,hcy,haloR);
      grad.addColorStop(0,"rgba(255,140,20,0.22)");
      grad.addColorStop(0.4,"rgba(255,100,10,0.12)");
      grad.addColorStop(1,"rgba(255,60,0,0)");
      ctx.save();
      // Clip the glow to cells this torch's own LOS-respecting raycast
      // actually reaches (and that the hero has explored) — otherwise the
      // gradient rect paints straight through walls into whatever room
      // happens to sit within its radius, lighting up areas that should
      // stay pure black.
      ctx.beginPath();
      for(const k of torchReachSets[torchIdx]){
        if(!exploredRef.current.has(k))continue;
        const [cx,cy]=k.split(",").map(Number);
        const cvx=cx-hx+CASTLE_HALF,cvy=cy-hy+CASTLE_HALF;
        if(cvx<0||cvy<0||cvx>=CASTLE_VIEW||cvy>=CASTLE_VIEW)continue;
        ctx.rect(cvx*CASTLE_CELL,cvy*CASTLE_CELL,CASTLE_CELL,CASTLE_CELL);
      }
      ctx.clip();
      ctx.globalCompositeOperation="screen";
      ctx.fillStyle=grad;ctx.fillRect(hcx-haloR,hcy-haloR,haloR*2,haloR*2);
      ctx.restore();
      ctx.fillStyle="#cc5500";ctx.fillRect(tpx+2,tpy+2,CASTLE_CELL-4,CASTLE_CELL-4);
      ctx.fillStyle="#ffaa00";ctx.fillRect(tpx+3,tpy+3,CASTLE_CELL-6,CASTLE_CELL-6);
      ctx.font=`${CASTLE_CELL-1}px sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText("🔥",tpx+CASTLE_CELL/2,tpy+CASTLE_CELL/2);
    });
    // Hero
    const hpx=(CASTLE_HALF)*CASTLE_CELL,hpy=(CASTLE_HALF)*CASTLE_CELL;
    const S=CASTLE_CELL;
    ctx.fillStyle="#4a8ac8";ctx.beginPath();ctx.arc(hpx+S/2,hpy+S*0.38,S*0.18,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#5a9aD8";ctx.fillRect(hpx+S*0.32,hpy+S*0.56,S*0.36,S*0.32);
    // Target
    if(tgt){
      const tvx=tgt.x-hx+CASTLE_HALF,tvy=tgt.y-hy+CASTLE_HALF;
      if(tvx>=0&&tvy>=0&&tvx<CASTLE_VIEW&&tvy<CASTLE_VIEW){
        ctx.strokeStyle="#c9a84c88";ctx.lineWidth=2;ctx.setLineDash([3,3]);
        ctx.strokeRect(tvx*S+2,tvy*S+2,S-4,S-4);ctx.setLineDash([]);
      }
    }
  },[levelIdx,level,rooms,secretRevealed,isFire,fireCleared,teleportsActive,torchLitMap,torchReachSets]);

  React.useEffect(()=>{draw(heroPos.x,heroPos.y,target,level.barrierDefs,groundKeys,encounters,closedBarriers,groundItems);},[heroPos,target,level,groundKeys,encounters,closedBarriers,groundItems,secretRevealed,draw]);

  // Click to move
  const handleClick=React.useCallback((e)=>{
    const rect=canvasRef.current.getBoundingClientRect();
    const scaleX=CASTLE_CANVAS/rect.width, scaleY=CASTLE_CANVAS/rect.height;
    const cx=Math.floor((e.clientX-rect.left)*scaleX/CASTLE_CELL);
    const cy=Math.floor((e.clientY-rect.top)*scaleY/CASTLE_CELL);
    const wx=heroPosRef.current.x-CASTLE_HALF+cx;
    const wy=heroPosRef.current.y-CASTLE_HALF+cy;
    let path=bfsPath(heroPosRef.current.x,heroPosRef.current.y,wx,wy,level.barrierDefs,heroKeysRef.current,exploredRef.current,closedBarriersRef.current);
    let dest={x:wx,y:wy};
    if(!path){
      // Unreachable target (darkness, a wall, a closed/locked door) — walk
      // as far toward it as possible instead of ignoring the click,
      // stopping at the last passable, already-explored tile along the way.
      const canStep=(x,y)=>canPass(x,y,level.barrierDefs,heroKeysRef.current,closedBarriersRef.current)&&exploredRef.current.has(`${x},${y}`);
      const stop=lastPassableAlongLine(heroPosRef.current.x,heroPosRef.current.y,wx,wy,canStep);
      if(stop.x===heroPosRef.current.x&&stop.y===heroPosRef.current.y)return;
      dest=stop;
      path=bfsPath(heroPosRef.current.x,heroPosRef.current.y,dest.x,dest.y,level.barrierDefs,heroKeysRef.current,exploredRef.current,closedBarriersRef.current);
    }
    if(path&&path.length>0){setTarget(dest);pathRef.current=path;}
  },[bfsPath,canPass,level]);

  // Walk step
  React.useEffect(()=>{
    if(!pathRef.current.length)return;
    const timer=setTimeout(()=>{
      if(!pathRef.current.length)return;
      const next=pathRef.current[0];
      pathRef.current=pathRef.current.slice(1);
      const nx=next.x,ny=next.y;

      // Door interaction
      const d=level.barrierDefs.find(d=>nx>=d.rect.x0&&nx<d.rect.x1&&ny>=d.rect.y0&&ny<d.rect.y1);
      if(d&&closedBarriersRef.current.has(d.id)){
        if(d.isSecret&&!secretRevealedRef.current.has(d.id)){pathRef.current=[];setTarget(null);return;}
        const hasKey=k=>heroKeysRef.current.some(hk=>hk.keyType===k&&hk.level===levelIdx);
        if(d.locked&&!hasKey(d.locked)){
          addCLog(`🔒 Need the ${d.locked} key!`);pathRef.current=[];setTarget(null);return;
        }
        if(d.locked&&hasKey(d.locked)){
          setClosedBarriers(cb=>{const next=new Set(cb);next.delete(d.id);return next;});
          addCLog(`🗝 ${d.locked} door opened!`);
        } else {
          setClosedBarriers(cb=>{const next=new Set(cb);next.delete(d.id);return next;});
        }
      }

      // Key pickup
      const gk=groundKeysRef.current.find(k=>k.x===nx&&k.y===ny);
      if(gk){
        const newKey={keyType:gk.keyType,level:levelIdx};
        setHeroKeys(hk=>[...hk,newKey]);heroKeysRef.current=[...heroKeysRef.current,newKey];
        setGroundKeys(ks=>ks.filter(k=>!(k.x===nx&&k.y===ny)));
        addCLog(`🗝 Found ${gk.keyType} key!`);
      }

      // Track corridor for flee
      const inRoom=rooms.some(r=>nx>=r.rx&&nx<r.rx+r.rw&&ny>=r.ry&&ny<r.ry+r.rh);
      if(!inRoom)lastCorridorRef.current={x:nx,y:ny};

      // Stairs
      if(nx===level.stairs[0]&&ny===level.stairs[1]){
        if(levelIdx===0){
          pathRef.current=[];setTarget(null);
          addCLog("🪜 You descend to the second level...");
          goToLevel(1);return;
        } else {
          // Level 2 stairs = dragon boss trigger handled by encounters
        }
      }
      // Level 2's start square doubles as an up-staircase back to level 1,
      // landing at level 1's own (down-)stairs rather than its entrance.
      if(levelIdx===1&&nx===level.start[0]&&ny===level.start[1]){
        pathRef.current=[];setTarget(null);
        addCLog("🪜 You ascend to the first level...");
        goToLevel(0,{viaStairs:true});return;
      }
      // Level 1's start square doubles as the castle entrance — stepping
      // back onto it exits the castle, returning the hero to the island.
      if(levelIdx===0&&nx===level.start[0]&&ny===level.start[1]){
        pathRef.current=[];setTarget(null);
        onExit(buildCastleSnapshot());return;
      }

      // Teleporters — only active once teleportsActive has the gating room
      // (set by dismissEnc's "teleport" action). Stepping on either pad
      // sends the hero straight to the other.
      for(const t of (level.teleporters||[])){
        if(!teleportsActiveRef.current.has(t.gateRoom))continue;
        const at=nx===t.a.x&&ny===t.a.y,bt=nx===t.b.x&&ny===t.b.y;
        if(!at&&!bt)continue;
        const dest=at?t.b:t.a;
        pathRef.current=[];setTarget(null);
        heroPosRef.current={x:dest.x,y:dest.y};setHeroPos({x:dest.x,y:dest.y});
        addCLog("🌀 The teleporter whisks you away!");
        return;
      }

      // Encounters
      const encs=encRef.current||[];
      const bossOrGuardian=encs.find(e=>{
        if(e.type!=="dragon_boss"&&e.type!=="guardian")return false;
        const r=rooms.find(r=>r.id===e.room);
        return r&&nx>=r.rx&&nx<r.rx+r.rw&&ny>=r.ry&&ny<r.ry+r.rh;
      });
      // All "monster"-type encounters sharing the room the hero just entered
      // — a room can hold more than one courtier now, so this is a filter
      // (every match), not a single find. One match plays out as a normal
      // single fight; more than one launches MultiCombatScreen instead.
      const roomMonsters=bossOrGuardian?[]:encs.filter(e=>{
        if(e.type!=="monster")return false;
        const r=rooms.find(r=>r.id===e.room);
        return r&&nx>=r.rx&&nx<r.rx+r.rw&&ny>=r.ry&&ny<r.ry+r.rh;
      });
      const single=encs.find(e=>{
        if(e.type==="monster"||e.type==="dragon_boss"||e.type==="guardian")return false;
        // NPCs render as an oversized 3x3 icon (see the draw pass below), so
        // trigger from any of those 9 cells, not just the exact anchor point
        // — otherwise an NPC sitting at a room corner (like the shelter at
        // raw 59,22) has its icon spill into non-passable cells, and the
        // hero can never actually stand close enough to hit the one exact
        // trigger tile.
        return Math.abs(e.cx-nx)<=1&&Math.abs(e.cy-ny)<=1;
      });
      // NPC proximity wins over a shared-room monster group — otherwise an
      // NPC placed in the same room as monsters (like the one in room_18)
      // can never actually be talked to: every step anywhere in that room
      // would trigger the monster fight first, since it used to be checked
      // before the NPC's own (much narrower) proximity match.
      const activeEnc=bossOrGuardian||single||roomMonsters[0];
      if(activeEnc){
        const isGroup=roomMonsters.length>1&&activeEnc===roomMonsters[0];
        const ek=activeEnc.type==="monster"||activeEnc.type==="dragon_boss"?activeEnc.room:`${activeEnc.cx},${activeEnc.cy}`;
        // Same debounce as the ground-items check: skip re-processing while
        // still on/in the same encounter's key, so a repeated step can't
        // reopen the same modal. Resets (see the else-branch below) as soon
        // as the hero is on a position with no active encounter, so leaving
        // and coming back later can still re-trigger it normally.
        if(ek!==shownEncounterKeyRef.current){
          // Stop any further queued steps right away (matching the island's
          // stopAt) — otherwise, since this effect doesn't pause for an open
          // modal, the walk-step timer keeps consuming the rest of a longer
          // queued path every 5ms while the encounter modal is scheduled/open,
          // silently moving the hero and re-running the ground-items check at
          // each new tile in the meantime. Only done on a genuinely new
          // trigger (inside this debounce branch) — clearing it on every step
          // near an already-acknowledged encounter would truncate the hero's
          // path to one cell at a time while just walking past/away from it.
          pathRef.current=[];setTarget(null);
          if(activeEnc.type==="npc"){
            // NPCs are always repeatable — no persisted "used" flag here,
            // just the ref-based debounce above. A monster-style persisted
            // flag would get set the instant the hero steps near, before
            // the modal even opens — if anything ever interrupted that
            // (e.g. stepping away within the 50ms delay), the flag would be
            // stuck "used" forever, since castle progress now survives an
            // exit/re-entry, permanently disabling the NPC.
            shownEncounterKeyRef.current=ek;
            setTimeout(()=>{setEncModal({enc:activeEnc,fromPos:{...lastCorridorRef.current}});},50);
          } else {
            setDefeatedRooms(dr=>{
              if(dr.has(ek+"_triggered"))return dr;
              const nd=new Set(dr);nd.add(ek+"_triggered");
              shownEncounterKeyRef.current=ek;
              setTimeout(()=>{
                if(activeEnc.type==="dragon_boss"){
                  setDragonIntroModal({enc:activeEnc,fromPos:{...lastCorridorRef.current}});
                } else if(isGroup){
                  setMultiCombatModal({monsters:roomMonsters.map(m=>({...m,maxHealth:100,level:m.level||1,uid:`${m.room}_${m.cx}_${m.cy}`})),room:activeEnc.room,fromPos:{...lastCorridorRef.current}});
                } else {
                  setCombatModal({monster:{...activeEnc,maxHealth:100,level:activeEnc.level||1,isDragon:false},fromPos:{...lastCorridorRef.current}});
                }
              },50);
              return nd;
            });
          }
        }
      } else {
        shownEncounterKeyRef.current=null;
      }

      heroPosRef.current={x:nx,y:ny};setHeroPos({x:nx,y:ny});

      // Ground items check — same pattern as the island, but guarded so the
      // tile the modal was last shown for can't immediately re-trigger it;
      // the hero has to actually reach a different tile first.
      const gKey=`${nx},${ny}`;
      if(gKey!==shownGroundKeyRef.current){
        shownGroundKeyRef.current=null;
        setGroundItems(g=>{
          if(g[gKey]&&g[gKey].length>0){
            pathRef.current=[];setTarget(null);
            shownGroundKeyRef.current=gKey;
            setGroundModal({key:gKey,items:g[gKey]});
          }
          return g;
        });
      }
    },5);
    return()=>clearTimeout(timer);
  },[pathRef.current.length,heroPos,level,levelIdx,groundKeys,encounters,closedBarriers,rooms,secretRevealed,teleportsActive]);

  const dismissEnc=(remove,actionType)=>{
    if(remove&&encModal?.enc){
      const enc=encModal.enc;
      if(enc.type==="npc"){
        if(actionType==="secret_door"){
          setSecretRevealed(s=>new Set([...s,enc.action.doorId]));
          addCLog("🚪 A hidden passage reveals itself!");
        } else if(actionType==="teleport"){
          setTeleportsActive(t=>new Set([...t,enc.room]));
          addCLog("🌀 A teleport circle activates!");
        } else if(actionType==="fire_clear"){
          setFireCleared(f=>new Set([...f,enc.room]));
          addCLog("❄ The flames gutter and die!");
        } else if(actionType==="shelter"){
          addCLog("🛖 Rested.");
        }
        setEncounters(es=>es.filter(e=>!(e.cx===enc.cx&&e.cy===enc.cy)));
      } else {
        setEncounters(es=>es.filter(e=>e.room!==enc.room));
      }
    }
    setEncModal(null);
  };

  // Wrapped so a player-initiated drop (Hero panel, or the mid-combat loot
  // screen) marks its own tile as "already seen" for the ground-items
  // auto-popup — otherwise stepping back over that tile right after
  // dropping (e.g. leaving a room through the same doorway you fought in)
  // immediately re-shows the dialogue for an item the hero only just put
  // there themselves.
  const setGroundItemsTracked=(updater)=>{
    setGroundItems(g=>{
      const next=typeof updater==="function"?updater(g):updater;
      const hgKey=`${heroPosRef.current.x},${heroPosRef.current.y}`;
      if(next[hgKey]&&next[hgKey].length>0) shownGroundKeyRef.current=hgKey;
      return next;
    });
  };

  if(playingStealth) return <StealthGame
    onWin={()=>{setPlayingStealth(false);setIceCrystal(true);addCLog("🧊 You steal the Ice Crystal!");}}
    onExit={()=>setPlayingStealth(false)}/>;

  if(playingNinja) return <NinjaDummy
    // NinjaDummy fires onReward the instant the 4th level is won, alongside
    // its own "⚔ Victory!" screen — delay unmounting it so the player
    // actually gets to see that screen instead of it vanishing immediately.
    onReward={()=>{setTimeout(()=>{setPlayingNinja(false);setBlackBelt(true);addCLog("🥋 You earn the Black Belt!");},2500);}}
    onExit={()=>setPlayingNinja(false)}/>;

  // Same responsive fit as the main game's map (see squareViewStyle) — the
  // castle's own chrome (title/key-icon header + log footer) is taller than
  // the main game's single-row status bar, so it reserves more space, but
  // it's the same "shrink the square to whatever's left" formula, applied
  // to the header/footer widths too so they stay visually aligned with the
  // canvas below them instead of the canvas alone shrinking under a
  // fixed-width header (which is what forced the old scroll-to-see-it fix).
  const castleBox=squareViewStyle(80);
  return(
    <div style={{position:"fixed",inset:0,background:"#0d0a06",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",overflowY:"auto",padding:"8px 0",zIndex:50}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:castleBox.width,marginBottom:6,flexShrink:0}}>
        <div style={{color:"#9b59b6",fontSize:13,fontFamily:"serif"}}>🏰 Castle — Level {levelIdx+1}</div>
        <div style={{display:"flex",flexDirection:"column",gap:2,alignItems:"flex-end"}}>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:11,color:C.dim}}>HP: <span style={{color:heroState.health>60?"#6fcf97":heroState.health>25?"#c9a02b":"#c0392b"}}>{heroState.health||0}%</span></span>
            {heroKeys.filter(k=>k.level===0).map((k,i)=><KeyIcon key={i} color={KEY_COLORS_C[k.keyType]||"#fff"}/>)}
            {iceCrystal&&<span style={{fontSize:14}} title="Ice Crystal">🧊</span>}
          </div>
          {/* Level 2 keys — same icon, mirrored, in their own row. Only
              these unlock level 2 doors; level 1 keys (row above) don't. */}
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {heroKeys.filter(k=>k.level===1).map((k,i)=><KeyIcon key={i} color={KEY_COLORS_C[k.keyType]||"#fff"} flip/>)}
            {blackBelt&&<span style={{fontSize:14}} title="Black Belt">🥋</span>}
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} width={CASTLE_CANVAS} height={CASTLE_CANVAS}
        style={{cursor:"pointer",border:"1px solid #3d2f18",display:"block",flexShrink:0,...castleBox}}
        onClick={handleClick}/>
      <div style={{marginTop:6,marginBottom:8,color:C.dim,fontSize:10,width:castleBox.width,flexShrink:0}}>{log[0]||"Explore the castle..."}</div>

      {/* HERO INFO TAB — same collapsible panel as the island. */}
      <div style={{position:"fixed",top:"50%",right:0,transform:"translateY(-50%)",
        display:"flex",alignItems:"stretch",zIndex:50}}>
        <div onClick={()=>setKeyOpen(o=>!o)}
          style={{background:"#1a1510",border:`1px solid ${C.border}`,borderRight:"none",
            borderRadius:"6px 0 0 6px",padding:"10px 5px",cursor:"pointer",
            display:"flex",alignItems:"center",writingMode:"vertical-rl",
            color:C.gold,fontSize:9,letterSpacing:"0.15em",textTransform:"uppercase",
            userSelect:"none"}}>
          {keyOpen?"▶":"◀"} Hero
        </div>
        {keyOpen&&<HeroPanel heroState={heroState} setHeroState={setHeroState} C={C} btnS={btnS} INV_MAX={INV_MAX} totalArmour={totalArmour} weaponAttacks={weaponAttacks} doEquipWeapon={doEquipWeapon} heroPos={heroPos} setGroundItems={setGroundItemsTracked} posScale={SCALE}/>}
      </div>

      {encModal&&<NpcModalCastle enc={encModal.enc} heroState={heroState} setHeroState={setHeroState}
        C={C} addLog={addCLog} setDefeatedRooms={setDefeatedRooms}
        saves={saves} saveMsg={saveMsg} onSaveGame={()=>onSaveGame(buildCastleSnapshot())} onLoadGame={onLoadGame} onDeleteSave={onDeleteSave}
        hasIceCrystal={iceCrystal} onLaunchStealth={()=>{setEncModal(null);setPlayingStealth(true);}}
        hasBlackBelt={blackBelt} onLaunchNinja={()=>{setEncModal(null);setPlayingNinja(true);}}
        onDismiss={(remove,actionType)=>dismissEnc(remove,actionType)}/>}

      {dragonIntroModal&&<DragonIntroModal C={C}
        onFight={()=>{
          const{enc,fromPos}=dragonIntroModal;
          setDragonIntroModal(null);
          setCombatModal({monster:{...enc,maxHealth:100,strength:100,skill:100,armour:100,attacks:2,level:100,isDragon:true},fromPos,
            fixedGold:50000,fixedLoot:dragonHoard()});
        }}
        onFlee={()=>{
          // Same as backing out of CombatScreen mid-fight: return to the
          // corridor the hero entered from and clear the trigger flag so
          // stepping back in shows this same intro again.
          const{enc,fromPos}=dragonIntroModal;
          heroPosRef.current=fromPos;
          setHeroPos(fromPos);
          pathRef.current=[];setTarget(null);
          setDefeatedRooms(dr=>{const nd=new Set(dr);nd.delete(enc.room+"_triggered");return nd;});
          setDragonIntroModal(null);
        }}/>}

      {combatModal&&<CombatScreen
        monster={combatModal.monster}
        heroState={heroState} setHeroState={setHeroState}
        isDragon={combatModal.monster.isDragon}
        fixedLoot={combatModal.fixedLoot} fixedGold={combatModal.fixedGold}
        isCastle={true}
        addLog={addCLog}
        groundItems={groundItems} setGroundItems={setGroundItemsTracked} heroPos={heroPos}
        onVictory={(mon)=>{
          const survivingEncounters=encRef.current.filter(e=>e.room!==combatModal.monster.room);
          setEncounters(survivingEncounters);
          addCLog(`⚔ ${combatModal.monster.name} defeated!`);
          if(mon.isDragon){
            setCombatModal(null);
            // encRef normally catches up via its own effect, but onWin needs
            // a snapshot built from *this* click — sync it immediately so
            // the fallen dragon isn't still sitting in what gets saved.
            encRef.current=survivingEncounters;
            onWin&&onWin(buildCastleSnapshot());
          }
          else setCombatModal(null);
        }}
        onDefeat={()=>{setCombatModal(null);addLog("💀 You fell in the castle...");setHeroState(h=>({...h,health:0}));onDeath&&onDeath();}}
        onFlee={()=>{
          heroPosRef.current=combatModal.fromPos;
          setHeroPos(combatModal.fromPos);
          pathRef.current=[];setTarget(null);
          const ek=combatModal.monster.room;
          setDefeatedRooms(dr=>{const nd=new Set(dr);nd.delete(ek+"_triggered");return nd;});
          setCombatModal(null);
        }}
      />}

      {multiCombatModal&&<MultiCombatScreen
        monsters={multiCombatModal.monsters}
        heroState={heroState} setHeroState={setHeroState}
        isCastle={true}
        addLog={addCLog}
        groundItems={groundItems} setGroundItems={setGroundItemsTracked} heroPos={heroPos}
        onVictory={()=>{
          setEncounters(es=>es.filter(e=>e.room!==multiCombatModal.room));
          addCLog(`⚔ ${multiCombatModal.monsters.length} courtiers defeated!`);
          setMultiCombatModal(null);
        }}
        onDefeat={()=>{setMultiCombatModal(null);addLog("💀 You fell in the castle...");setHeroState(h=>({...h,health:0}));onDeath&&onDeath();}}
        onFlee={()=>{
          heroPosRef.current=multiCombatModal.fromPos;
          setHeroPos(multiCombatModal.fromPos);
          pathRef.current=[];setTarget(null);
          const ek=multiCombatModal.room;
          setDefeatedRooms(dr=>{const nd=new Set(dr);nd.delete(ek+"_triggered");return nd;});
          setMultiCombatModal(null);
        }}
      />}

      {groundModal&&(
        <GroundItemsDialogue
          items={groundItems[groundModal.key]||[]}
          groundKey={groundModal.key}
          heroState={heroState}
          setHeroState={setHeroState}
          setGroundItems={setGroundItems}
          onDismiss={()=>setGroundModal(null)}
        />
      )}
    </div>
  );
}
