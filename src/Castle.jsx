import React from "react";
import { CombatScreen, HeroPanel, GroundItemsDialogue, weaponAttacks, totalArmour, doEquipWeapon, btnS, INV_MAX } from "./Game.jsx";
import { NPC_IMG } from "./data/images.js";
import { CASTLE_LEVELS } from "./data/castleLevels.js";

// 2x2 grid, same cropping approach as the island's GuardianPortrait.
function NpcPortrait({col,row,size=130}){
  return <div style={{width:size,height:size,backgroundImage:`url(${NPC_IMG})`,backgroundSize:"200% 200%",backgroundPosition:`${col*100}% ${row*100}%`,backgroundRepeat:"no-repeat",borderRadius:6,border:"2px solid #3d2f18",flexShrink:0}}/>;
}

// Raw level data (CASTLE_LEVELS, imported from data/castleLevels.js) stays
// at its original 64-unit resolution; SCALE blows every room/corridor/door/
// position up at load time via scaleLevel() below.
const SCALE = 4;
const RAW_SIZE = 64;
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
    encounters: raw.encounters.map(e => ({...e, cx:e.cx*SCALE, cy:e.cy*SCALE})),
    // corner picks where in the raw cell's SCALE x SCALE block the torch
    // sits: "ul" (default) top-left, "ur" top-right, "dl" bottom-left,
    // "dr" bottom-right. radius scales the torch's illumination reach
    // relative to the hero's own highlight radius (1 = same, 0.5 = half).
    torches: (raw.torches||[]).map(([x,y,corner,radius=1]) => {
      const tx = (corner==="ur"||corner==="dr") ? x*SCALE+SCALE-1 : x*SCALE;
      const ty = (corner==="dl"||corner==="dr") ? y*SCALE+SCALE-1 : y*SCALE;
      return [tx, ty, radius];
    }),
  };
}

// Passability is rooms (rectangles, by corners) + corridors (coordinate
// sequences) — no bitmap, so resolution/size can change without regenerating
// a per-cell grid. passableSet is a precomputed "x,y" lookup for O(1) checks.
function castlePassable(passableSet, x, y) {
  return x>=0&&y>=0&&x<CASTLE_SIZE&&y<CASTLE_SIZE&&passableSet.has(`${x},${y}`);
}

function NpcModalCastle({enc,heroState,setHeroState,C,addLog,setDefeatedRooms,onDismiss}){
  const [paid,setPaid]=React.useState(false);
  const action=enc.action||{};
  const inv=heroState.inventory||[];
  const hasItem=action.wantsId?inv.some(i=>i.id===action.wantsId||i.uid===action.wantsId):true;
  const isShelter=action.type==="shelter";
  const canAct=!paid&&(isShelter||(action.wantsId?hasItem:true));
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
        {hasItem&&<span style={{color:"#6fcf97",marginLeft:8}}>✓ in inventory</span>}
      </div>}
      {!isShelter&&<div style={{fontSize:11,color:"#6a9a8a",marginBottom:14}}>
        Reward: {action.type==="secret_door"?"🚪 Secret passage":
                 action.type==="teleport"?"🌀 Teleport activated":
                 action.type==="fire_clear"?"❄ Fire cleared":"?"}
      </div>}
      <div style={{display:"flex",gap:8}}>
        <button style={{...btnStyle(isShelter?"#2d8a4e":C.gold,!canAct),flex:1}}
          onClick={()=>{
            if(!canAct)return;
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
          {isShelter?"Sleep (restore HP)":(action.wantsId&&!hasItem?"Need: "+action.wants:"Help me")}
        </button>
        <button style={{...btnStyle(C.dim,false),flex:1}}
          onClick={()=>{clearTrigger();onDismiss(false);}}>
          Leave
        </button>
      </div>
    </div></div>
  );
}


export default function CastleLevel({heroState,setHeroState,addLog,onExit,onWin}){
  const canvasRef=React.useRef(null);
  const [levelIdx,setLevelIdx]=React.useState(0);
  const level=React.useMemo(()=>scaleLevel(CASTLE_LEVELS[levelIdx]),[levelIdx]);
  const [keyOpen,setKeyOpen]=React.useState(false);

  const [heroPos,setHeroPos]=React.useState({x:level.start[0],y:level.start[1]});
  const heroPosRef=React.useRef({x:level.start[0],y:level.start[1]});
  // Barrier model (matches StealthGame): barrierDefs are static per-level door
  // definitions; closedBarriers is the Set of ids still blocking passage —
  // removing an id from the set opens that door.
  const [closedBarriers,setClosedBarriers]=React.useState(()=>new Set(level.barrierDefs.map(d=>d.id)));
  const closedBarriersRef=React.useRef(closedBarriers);
  React.useEffect(()=>{closedBarriersRef.current=closedBarriers;},[closedBarriers]);
  const [heroKeys,setHeroKeys]=React.useState([]);
  const heroKeysRef=React.useRef([]);
  React.useEffect(()=>{heroKeysRef.current=heroKeys;},[heroKeys]);
  const [groundKeys,setGroundKeys]=React.useState(level.keys);
  const [groundItems,setGroundItems]=React.useState(()=>({...level.groundItemsInit}));
  const [groundModal,setGroundModal]=React.useState(null);
  const [encounters,setEncounters]=React.useState(level.encounters);
  const encRef=React.useRef(encounters);
  React.useEffect(()=>{encRef.current=encounters;},[encounters]);
  const [defeatedRooms,setDefeatedRooms]=React.useState(new Set());
  const [encModal,setEncModal]=React.useState(null);
  const [target,setTarget]=React.useState(null);
  const pathRef=React.useRef([]);
  const exploredRef=React.useRef(new Set());
  // Tracks the ground-item tile the modal was last auto-shown for, so
  // dismissing it doesn't immediately re-show the same tile — the hero
  // must actually reach a different tile before it can trigger again.
  const shownGroundKeyRef=React.useRef(null);
  // Same idea, for monster/NPC encounter triggering.
  const shownEncounterKeyRef=React.useRef(null);
  const lastCorridorRef=React.useRef({x:level.start[0],y:level.start[1]});
  const [msg,setMsg]=React.useState(null);
  const [log,setLog]=React.useState([]);
  const addCLog=m=>{addLog(m);setLog(p=>[m,...p].slice(0,15));};
  
  // Secret doors, teleporters, fire state
  const [secretRevealed,setSecretRevealed]=React.useState(new Set());
  const [teleportsActive,setTeleportsActive]=React.useState(new Set());
  const [fireCleared,setFireCleared]=React.useState(new Set());  // set of room ids with fire cleared
  const [combatModal,setCombatModal]=React.useState(null);

  const C={bg:"#0d0a06",panel:"#1a1510",border:"#3d2f18",gold:"#c9a84c",text:"#e8dcc8",dim:"#7a6a4a",red:"#c0392b",green:"#2d8a4e",blue:"#2e6da4"};

  // Switch level
  const goToLevel=(idx)=>{
    const lv=scaleLevel(CASTLE_LEVELS[idx]);
    setLevelIdx(idx);
    setHeroPos({x:lv.start[0],y:lv.start[1]});
    heroPosRef.current={x:lv.start[0],y:lv.start[1]};
    setClosedBarriers(new Set(lv.barrierDefs.map(d=>d.id)));
    closedBarriersRef.current=new Set(lv.barrierDefs.map(d=>d.id));
    setHeroKeys([]);heroKeysRef.current=[];
    setGroundKeys(lv.keys);
    setGroundItems({...lv.groundItemsInit});
    setEncounters(lv.encounters);
    encRef.current=lv.encounters;
    setDefeatedRooms(new Set());
    exploredRef.current=new Set();
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

  const isPassable=(x,y)=>castlePassable(passableSet,x,y);

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
    const enc=encRef.current.find(e=>e.type==="fire"&&e.room===room.id);
    return enc&&enc.cells&&enc.cells.some(c=>c[0]===x&&c[1]===y);
  };

  const canPass=(x,y,doorList,keyList,closedSet)=>{
    if(!isPassable(x,y))return false;
    if(isFire(x,y))return false;
    const d=doorAt(x,y,doorList);
    if(d&&closedSet.has(d.id)){
      if(d.isSecret&&!secretRevealed.has(d.id))return false;
      if(d.locked)return keyList.some(k=>k===d.locked);
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
          while(c){const[px,py]=c.split(",").map(Number);path.unshift({x:px,y:py});c=vis.get(c);}
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
        const isWall=!isPassable(wx,wy);

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
          // Door
          const door=doorAt(wx,wy,doorList);
          if(door){
            const isSecret=door.isSecret&&!secretRevealed.has(door.id);
            const isOpen=!closedSet.has(door.id);
            if(isSecret){ctx.fillStyle="#555";ctx.fillRect(px,py,S,S);}
            else{
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
          }
          // Dropped/ground items
          const gi=(gItems||{})[`${wx},${wy}`];
          if(gi&&gi.length>0){
            ctx.font=`${Math.round(S*0.55)}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";
            ctx.fillText("📦",px+S/2,py+S/2);
          }
          // Encounters
          const enc=(encs||[]).find(e=>e.cx===wx&&e.cy===wy);
          if(enc){
            const icon=enc.type==="monster"?"👾":enc.type==="dragon_boss"?"🐉":
              enc.type==="npc"?{shelter:"🛖",secret_door:"🚪",teleport:"🌀",fire_clear:"❄"}[enc.action?.type]||"🧙":
              enc.type==="items"?"📦":"?";
            ctx.font=`${Math.round(S*0.65)}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";
            ctx.fillText(icon,px+S/2,py+S/2+1);
          }
          // Stairs
          if(wx===lv.stairs[0]&&wy===lv.stairs[1]){
            ctx.font=`${Math.round(S*0.6)}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";
            ctx.fillText(levelIdx===0?"🪜":"🐉",px+S/2,py+S/2+1);
          }
          // Entrance
          if(wx===lv.start[0]&&wy===lv.start[1]){
            ctx.fillStyle="#c9a84c44";ctx.fillRect(px,py,S,S);
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
  },[levelIdx,level,rooms,secretRevealed,isFire,torchLitMap,torchReachSets]);

  React.useEffect(()=>{draw(heroPos.x,heroPos.y,target,level.barrierDefs,groundKeys,encounters,closedBarriers,groundItems);},[heroPos,target,level,groundKeys,encounters,closedBarriers,groundItems,secretRevealed,draw]);

  // Click to move
  const handleClick=React.useCallback((e)=>{
    const rect=canvasRef.current.getBoundingClientRect();
    const cx=Math.floor((e.clientX-rect.left)/CASTLE_CELL);
    const cy=Math.floor((e.clientY-rect.top)/CASTLE_CELL);
    const wx=heroPosRef.current.x-CASTLE_HALF+cx;
    const wy=heroPosRef.current.y-CASTLE_HALF+cy;
    if(!isPassable(wx,wy))return;
    if(!exploredRef.current.has(`${wx},${wy}`))return;
    const path=bfsPath(heroPosRef.current.x,heroPosRef.current.y,wx,wy,level.barrierDefs,heroKeysRef.current,exploredRef.current,closedBarriersRef.current);
    if(path&&path.length>0){setTarget({x:wx,y:wy});pathRef.current=path;}
  },[isPassable,bfsPath,level]);

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
        if(d.isSecret&&!secretRevealed.has(d.id)){pathRef.current=[];setTarget(null);return;}
        if(d.locked&&!heroKeysRef.current.includes(d.locked)){
          addCLog(`🔒 Need the ${d.locked} key!`);pathRef.current=[];setTarget(null);return;
        }
        if(d.locked&&heroKeysRef.current.includes(d.locked)){
          setClosedBarriers(cb=>{const next=new Set(cb);next.delete(d.id);return next;});
          addCLog(`🗝 ${d.locked} door opened!`);
        } else {
          setClosedBarriers(cb=>{const next=new Set(cb);next.delete(d.id);return next;});
        }
      }

      // Key pickup
      const gk=groundKeys.find(k=>k.x===nx&&k.y===ny);
      if(gk){
        setHeroKeys(hk=>[...hk,gk.keyType]);heroKeysRef.current=[...heroKeysRef.current,gk.keyType];
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

      // Encounters
      const encs=encRef.current||[];
      const wholeRoom=encs.find(e=>{
        if(e.type!=="monster"&&e.type!=="dragon_boss"&&e.type!=="guardian")return false;
        const r=rooms.find(r=>r.id===e.room);
        return r&&nx>=r.rx&&nx<r.rx+r.rw&&ny>=r.ry&&ny<r.ry+r.rh;
      });
      const single=encs.find(e=>{
        if(e.type==="monster"||e.type==="dragon_boss"||e.type==="guardian")return false;
        return e.cx===nx&&e.cy===ny;
      });
      const activeEnc=wholeRoom||single;
      if(activeEnc){
        const ek=activeEnc.type==="monster"||activeEnc.type==="dragon_boss"?activeEnc.room:`${activeEnc.cx},${activeEnc.cy}`;
        // Same debounce as the ground-items check: skip re-processing while
        // still on/in the same encounter's key, so a repeated step can't
        // reopen the same modal. Resets (see the else-branch below) as soon
        // as the hero is on a position with no active encounter, so leaving
        // and coming back later can still re-trigger it normally.
        if(ek!==shownEncounterKeyRef.current){
          setDefeatedRooms(dr=>{
            if(dr.has(ek+"_triggered"))return dr;
            const nd=new Set(dr);nd.add(ek+"_triggered");
            shownEncounterKeyRef.current=ek;
            setTimeout(()=>{
              if(activeEnc.type==="monster"){
                setCombatModal({monster:{...activeEnc,maxHealth:100,level:activeEnc.level||1,isDragon:false},fromPos:{...lastCorridorRef.current}});
              } else if(activeEnc.type==="dragon_boss"){
                setCombatModal({monster:{...activeEnc,maxHealth:100,strength:40,skill:40,armour:25,attacks:2,level:35,isDragon:true},fromPos:{...lastCorridorRef.current}});
              } else {
                setEncModal({enc:activeEnc,fromPos:{...lastCorridorRef.current}});
              }
            },50);
            return nd;
          });
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
  },[pathRef.current.length,heroPos,level,levelIdx,groundKeys,encounters,closedBarriers,rooms,secretRevealed]);

  const dismissEnc=(remove,actionType)=>{
    if(remove&&encModal?.enc){
      const enc=encModal.enc;
      if(enc.type==="npc"){
        if(actionType==="secret_door"){
          // Find secret door to reveal — mark room as secret_revealed
          setSecretRevealed(s=>new Set([...s,"secret_1"]));
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

  return(
    <div style={{position:"fixed",inset:0,background:"#0d0a06",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:50}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:CASTLE_CANVAS+"px",marginBottom:6}}>
        <div style={{color:"#9b59b6",fontSize:13,fontFamily:"serif"}}>🏰 Castle — Level {levelIdx+1}</div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span style={{fontSize:11,color:C.dim}}>HP: <span style={{color:heroState.health>60?"#6fcf97":heroState.health>25?"#c9a02b":"#c0392b"}}>{heroState.health||0}%</span></span>
          {heroKeys.map((k,i)=><span key={i} style={{fontSize:14,color:KEY_COLORS_C[k]||"#fff"}}>🗝</span>)}
        </div>
        <button style={{padding:"4px 12px",background:"transparent",border:"1px solid #7a6a4a",color:"#7a6a4a",cursor:"pointer",fontSize:10,borderRadius:3}} onClick={onExit}>⬆ Exit Castle</button>
      </div>
      <canvas ref={canvasRef} width={CASTLE_CANVAS} height={CASTLE_CANVAS}
        style={{cursor:"pointer",border:"1px solid #3d2f18",display:"block"}}
        onClick={handleClick}/>
      <div style={{marginTop:6,color:C.dim,fontSize:10,maxWidth:CASTLE_CANVAS+"px"}}>{log[0]||"Explore the castle..."}</div>

      {/* HERO INFO TAB — same collapsible panel as the island; no ground-items
          system in the castle, so heroPos/setGroundItems are omitted and
          HeroPanel hides its Drop button accordingly. */}
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
        {keyOpen&&<HeroPanel heroState={heroState} setHeroState={setHeroState} C={C} btnS={btnS} INV_MAX={INV_MAX} totalArmour={totalArmour} weaponAttacks={weaponAttacks} doEquipWeapon={doEquipWeapon} heroPos={heroPos} setGroundItems={setGroundItems} posScale={SCALE}/>}
      </div>

      {encModal&&<NpcModalCastle enc={encModal.enc} heroState={heroState} setHeroState={setHeroState}
        C={C} addLog={addCLog} setDefeatedRooms={setDefeatedRooms}
        onDismiss={(remove,actionType)=>dismissEnc(remove,actionType)}/>}

      {combatModal&&<CombatScreen
        monster={combatModal.monster}
        heroState={heroState} setHeroState={setHeroState}
        isDragon={combatModal.monster.isDragon}
        isCastle={true}
        addLog={addCLog}
        groundItems={groundItems} setGroundItems={setGroundItems} heroPos={heroPos}
        onVictory={(mon)=>{
          setEncounters(es=>es.filter(e=>e.room!==combatModal.monster.room));
          addCLog(`⚔ ${combatModal.monster.name} defeated!`);
          if(mon.isDragon){setCombatModal(null);onWin&&onWin();}
          else setCombatModal(null);
        }}
        onDefeat={()=>{setCombatModal(null);addLog("💀 You fell in the castle...");setHeroState(h=>({...h,health:0}));}}
        onFlee={()=>{
          heroPosRef.current=combatModal.fromPos;
          setHeroPos(combatModal.fromPos);
          pathRef.current=[];setTarget(null);
          const ek=combatModal.monster.room;
          setDefeatedRooms(dr=>{const nd=new Set(dr);nd.delete(ek+"_triggered");return nd;});
          setCombatModal(null);
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
