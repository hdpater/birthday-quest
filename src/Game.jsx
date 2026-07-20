import React, { useState, useEffect, useRef, useCallback } from "react";
import CastleLevel from "./Castle.jsx";
import finalCelebration from "../images/final_celebration.mp4";
// ── Images ───────────────────────────────────────────────────────────────────
import { GUARDIAN_IMG } from "./data/images.js";
import { MONSTER_GRID } from "./data/images.js";
import { DRAGON_IMG } from "./data/images.js";
import { TOURNAMENT_IMG } from "./data/images.js";
import { COURTIER_IMG } from "./data/images.js";
import { SAVES_KEY, storageGet, storageSet } from "./data/storage.js";

// ── Map data ─────────────────────────────────────────────────────────────────
import { SIZE } from "./data/maps.js";
import { LAND } from "./data/maps.js";
import { BIOME } from "./data/maps.js";
import { BIOME_COL } from "./data/maps.js";
import { BIOME_RGB } from "./data/maps.js";
import { BIOME_LABEL } from "./data/maps.js";
import { DIST } from "./data/maps.js";
import { PATHWAY } from "./data/maps.js";
import { MAX_DIST } from "./data/maps.js";
const isLand   = (x,y) => x>=0&&y>=0&&x<SIZE&&y<SIZE && LAND[y*SIZE+x]==="1";
const biomeAt  = (x,y) => BIOME[y*SIZE+x];
const distAt   = (x,y) => DIST[y*SIZE+x];
const monLvl   = (x,y) => Math.round(5 + (distAt(x,y)/MAX_DIST)*26);

// Walks a Bresenham line from (sx,sy) toward (tx,ty), one cell at a time,
// and returns the last cell for which stepOk(x,y) held — used to turn a
// click on an unreachable tile (sea, castle darkness/a wall) into "walk as
// far that way as possible" instead of silently ignoring the click.
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

// ── Monsters ─────────────────────────────────────────────────────────────────
import { M_NAMES } from "./data/monsters.js";
import { M_LEVELS } from "./data/monsters.js";
import { M_ATTACKS } from "./data/monsters.js";
import { M_STATS } from "./data/monsters.js";
import { TOURNAMENT_FIGHTERS } from "./data/monsters.js";

function spawnMonster(x, y) {
  const targetLvl = monLvl(x, y);
  // Pick monster whose level is within ±2
  const pool = M_LEVELS.map((l,i)=>({i,l})).filter(({l})=>Math.abs(l-targetLvl)<=2);
  const pick = pool.length ? pool[Math.floor(Math.random()*pool.length)] : {i:0};
  const idx = pick.i;
  return {
    idx, name:M_NAMES[idx], col:idx%10, row:Math.floor(idx/10),
    health:100, maxHealth:100,
    strength:M_STATS[idx][0], skill:M_STATS[idx][1], armour:M_STATS[idx][2],
    attacks:M_ATTACKS[idx], level:M_LEVELS[idx],
  };
}

// ── Locations ─────────────────────────────────────────────────────────────────
import { BUILDINGS } from "./data/buildings.js";
import { GUARDIANS } from "./data/buildings.js";
import { TOURNAMENT_POS } from "./data/monsters.js";

const buildingAt = (x,y) => BUILDINGS.find(b=>b.x===x&&b.y===y)||null;
const guardianAt = (x,y) => GUARDIANS.find(g=>g.x===x&&g.y===y)||null;
const tournamentAt = (x,y) => (TOURNAMENT_POS.x===x&&TOURNAMENT_POS.y===y)?TOURNAMENT_POS:null;
import { GUARDIAN_RIDDLES } from "./data/buildings.js";
import { GUARDIAN_ANGRY } from "./data/buildings.js";

// ── Items ──────────────────────────────────────────────────────────
import { WEAPONS } from "./data/items.js";
import { ARMOUR_ITEMS } from "./data/items.js";
import { FOOD } from "./data/items.js";
import { MAGIC_TYPES_LIST } from "./data/items.js";
import { MAGIC_FORMS_LIST } from "./data/items.js";
import { MAGIC_BASE } from "./data/items.js";
import { MAGIC_MULT } from "./data/items.js";
import { MAGIC_COLOR } from "./data/items.js";
import { MAGIC_COMPS } from "./data/items.js";
import { MAGIC_TYPE_TIER } from "./data/items.js";
import { MAGIC_FORM_TIER } from "./data/items.js";

// ── Helper functions ──────────────────────────────────────────────────────────
const sellPct  = (item) => item.type==="magic"?0.8:0.5;
const sellPrice= (item) => Math.ceil(item.cost*sellPct(item));
export const INV_MAX = 5;
const invFull = (heroState) => (heroState.inventory||[]).length >= INV_MAX;
const clamp    = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const rng      = (lo,hi) => Math.floor(Math.random()*(hi-lo+1))+lo;
const eff      = (base,hp) => Math.max(1,Math.round(base*hp/100));
const effCeil  = (base,hp) => Math.max(1,Math.ceil(base*hp/100));
const hitChance= (a,d) => a/(a+d);

function randDmg(str,arm) { return Math.max(0, rng(0,str)-rng(0,arm)); }

// Shared square-viewport sizing: shrinks to fit whichever of width/height is
// tighter, using dvh (not vh) so mobile browser chrome that shows/hides
// doesn't leave the reserved chrome (header/status bar) off-screen.
// `reservedPx` is how much vertical space the screen's own header/footer
// chrome needs outside the square itself.
export function squareViewStyle(reservedPx){
  const side=`min(100vw, calc(100dvh - ${reservedPx}px))`;
  return {width:side,height:side,maxWidth:"100%",maxHeight:`calc(100dvh - ${reservedPx}px)`};
}

export function weaponAttacks(eq) {
  const {right_hand:rh, left_hand:lh} = eq;
  if (rh?.twoHanded) return [{label:rh.name, bonus:rh.strBonus, twoHanded:true}];
  const atks = [{label:rh?rh.name:"Fist", bonus:rh?.strBonus||0}];
  if (lh && !lh.armourBonus) atks.push({label:lh.name, bonus:lh.strBonus||0});
  return atks;
}

export function totalArmour(eq, base) {
  return base + Object.values(eq).reduce((s,i)=>s+(i?.armourBonus||0),0);
}

// strBonus/sklBonus on an armour-slotted item (e.g. Helmet of Thruk, Greegan's
// Boots) is baked directly into baseStrength/baseSkill on equip/unequip,
// rather than applied at combat-calc time.
const armourStrBonus=(item)=>item?.strBonus||0;
const armourSklBonus=(item)=>item?.sklBonus||0;

const magicTier=(t,f)=>MAGIC_TYPE_TIER[t]+MAGIC_FORM_TIER[f];
const MAGIC_COMBOS=MAGIC_TYPES_LIST.flatMap(t=>MAGIC_FORMS_LIST.map(f=>({t,f,tier:magicTier(t,f)})));

// maxTier, if given, restricts the pick to combos at or below it — mirrors
// how WEAPONS/ARMOUR_ITEMS loot is gated by monster/merchant tier.
function randomMagicItem(maxTier) {
    const pool=maxTier?MAGIC_COMBOS.filter(c=>c.tier<=maxTier):MAGIC_COMBOS;
    const {t,f}=pool[rng(0,pool.length-1)];
    return magicItem(t, f, `magic_${Date.now()}_${Math.random()}`);
}

export function magicItem(t, f, id) {
    return {id:id,name:`${t[0].toUpperCase()+t.slice(1)} ${f[0].toUpperCase()+f.slice(1)}`,type:"magic",form:f,magicType:t,cost:MAGIC_BASE[f]*MAGIC_MULT[t],color:MAGIC_COLOR[t],tier:magicTier(t,f)};
}

export function gold(amount) {
    return {isGold:true,amount:amount,name:`${amount} gold`};
}

// Single source of truth for ground-spawned weapons/armour/food:
// looks up the canonical item definition by id from WEAPONS/ARMOUR_ITEMS/FOOD
// so ground items can never drift out of sync with shop stats.
export function groundItem(id, uid) {
  const found = [...WEAPONS, ...ARMOUR_ITEMS, ...FOOD].find(i => i.id === id);
  if (!found) { console.error(`groundItem: unknown id "${id}"`); return null; }
  return {...found, uid};
}

const varyPrice=(cost)=>Math.max(1,Math.round(cost*(0.8+Math.random()*0.4)));

const computeChecksum=(data)=>{
  const str=JSON.stringify(data); let h=0;
  for(let i=0;i<str.length;i++){h=(Math.imul(31,h)+str.charCodeAt(i))|0;}
  return(h>>>0).toString(16);
};

function generateMerchantStock(tier) {
  // Gear tops out at tier 5, unlike magic (which now goes higher) — clamp
  // separately so a high-tier merchant's gear band doesn't land entirely
  // above every weapon/armour's tier and leave the stock empty.
  const gearTier=Math.min(5,tier);
  const inBand=i=>i.tier>=gearTier-1&&i.tier<=gearTier;
  const pool=[...FOOD,...ARMOUR_ITEMS.filter(inBand),...WEAPONS.filter(inBand)];
  const shuffled=[...pool].sort(()=>Math.random()-0.5);
  const items=shuffled.slice(0,rng(4,8)).map(i=>({...i,uid:Date.now()+Math.random(),price:varyPrice(i.cost??i.price)}));
    if(Math.random()<0.5){
	const magic=randomMagicItem(tier);
	items.push({...magic,uid:Date.now()+Math.random(),price:varyPrice(magic.cost)});
    }
  return items;
}

// Equip weapon with correct hand logic
export function doEquipWeapon(item, eq) {
  // If a two-handed weapon is currently equipped, clear both hands first
  // and return the greatsword to inventory as a single item (not twice)
  let baseEq = {...eq};
  let baseInv = [];
  const rh0 = eq.right_hand, lh0 = eq.left_hand;
  if (rh0?.twoHanded) {
    baseEq = {...baseEq, right_hand:null, left_hand:null};
    baseInv = [rh0]; // only add once even though it occupied both slots
  }

  const {right_hand:rh, left_hand:lh} = baseEq;
  const SIZE_ORDER = ["dagger","mace","shortsword","longsword"];
  const fitsLeft = w => w && w.slot !== "right";
  let newEq = {...baseEq}, toInv = [...baseInv], msg = "";

  if (item.twoHanded) {
    // Replace whatever is in hands (already cleared two-handers above)
    if (rh) toInv.push(rh);
    if (lh) toInv.push(lh);
    newEq = {...baseEq, right_hand:item, left_hand:item};
    msg = `Equipped ${item.name} (both hands).`;
  } else if (item.slot === "left") {
    // Force into left hand (e.g. Kenshiro Short Blade)
    if (lh) toInv.push(lh);
    newEq = {...baseEq, left_hand:item};
    msg = `Equipped ${item.name} in left hand.`;
  } else if (!rh && !lh) {
    newEq = {...baseEq, right_hand:item};
    msg = `Equipped ${item.name} in right hand.`;
  } else if (!rh) {
    newEq = {...baseEq, right_hand:item};
    msg = `Equipped ${item.name} in right hand.`;
  } else if (!lh) {
    const smaller = (SIZE_ORDER.indexOf(item.id)||0)<=(SIZE_ORDER.indexOf(rh.id)||0)?item:rh;
    const larger  = smaller===item?rh:item;
    if (fitsLeft(smaller)) {
      newEq={...baseEq,right_hand:larger,left_hand:smaller};
      msg=`Equipped: ${larger.name} (right), ${smaller.name} (left).`;
    } else { toInv.push(rh); newEq={...baseEq,right_hand:item}; msg=`Equipped ${item.name} in right hand.`; }
  } else {
    const cands=[item,rh,lh];
    let placed=false;
    for(const [r,l] of [[item,rh],[item,lh],[rh,item],[lh,item]]) {
      if(fitsLeft(l)&&r.slot!=="left") {
        const disp=cands.find(c=>c!==r&&c!==l);
        newEq={...baseEq,right_hand:r,left_hand:l}; toInv.push(disp); placed=true;
        msg=`Equipped: ${r.name} (right), ${l.name} (left). ${disp.name} to inventory.`; break;
      }
    }
    if(!placed){toInv.push(rh);newEq={...baseEq,right_hand:item};msg=`Equipped ${item.name} in right hand.`;}
  }
  return {newEq, toInv:toInv.filter(Boolean), msg};
}

// ── Colour palette ────────────────────────────────────────────────────────────
const C={bg:"#0d1117",panel:"#1a1510",border:"#3d2f18",gold:"#c9a84c",text:"#e8dcc8",dim:"#7a6a4a",red:"#c0392b",green:"#2d8a4e",blue:"#2e6da4"};
export const btnS=(col,dis)=>({padding:"6px 14px",background:"transparent",border:`1.5px solid ${dis?"#333":col}`,color:dis?"#444":col,fontFamily:"'Palatino Linotype',Palatino,serif",fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",cursor:dis?"not-allowed":"pointer",borderRadius:3,transition:"background 0.15s"});

function HpBar({pct,color}){
  const c=color||(pct>60?"#2d8a4e":pct>25?"#c9a02b":"#c0392b");
  return <div style={{height:6,background:"#1a1208",borderRadius:3,overflow:"hidden",marginBottom:4}}>
    <div style={{height:"100%",width:`${clamp(pct,0,100)}%`,background:c,borderRadius:3,transition:"width 0.3s"}}/>
  </div>;
}

// ── Combat stance slider ──────────────────────────────────────────────────────
// val: -5..+5. Negative = aggressive (str up, skl down). Positive = skilled (skl up, str down).
function CombatSlider({val,onChange,baseStr,baseSkl,C}){
  const left=val<0;
  const right=val>0;
  const trackCol=val<0?"#8b2222":val>0?"#22558b":"#3d2f18";
  const strVal=baseStr; // already offset by parent
  const sklVal=baseSkl;
  return(
    <div style={{margin:"6px 0 4px",userSelect:"none"}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.dim,marginBottom:2,letterSpacing:"0.06em"}}>
        <span style={{color:left?"#c06040":C.dim}}>◀ AGGRESSIVE{left?` (Str +${Math.abs(val)}, Skl -${Math.abs(val)})`:""}</span>
        <span style={{color:right?"#4080c0":C.dim}}>{right?`(Str -${val}, Skl +${val}) `:""} SKILLED ▶</span>
      </div>
      <div style={{position:"relative",height:18,display:"flex",alignItems:"center"}}>
        {/* Coloured track fill */}
        <div style={{position:"absolute",left:0,right:0,height:4,background:"#1a1208",borderRadius:2}}/>
        <div style={{position:"absolute",
          left: val<=0 ? `${(val+5)/10*100}%` : "50%",
          width: `${Math.abs(val)/10*100}%`,
          height:4, background:trackCol, borderRadius:2, transition:"all 0.1s"}}/>
        <input type="range" min={-5} max={5} step={1} value={val}
          onChange={e=>onChange(e.target.value)}
          style={{width:"100%",position:"relative",zIndex:1,accentColor:trackCol,
            cursor:"pointer",background:"transparent",height:18,margin:0}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.dim,marginTop:1}}>
        <span>Str <span style={{color:left?"#c06040":C.text}}>{strVal}</span></span>
        <span style={{color:val===0?C.dim:"#888"}}>●</span>
        <span>Skl <span style={{color:right?"#4080c0":C.text}}>{sklVal}</span></span>
      </div>
    </div>
  );
}

// ── Portrait components ───────────────────────────────────────────────────────
function GuardianPortrait({col,row,size=180}){
  return <div style={{width:size,height:size,backgroundImage:`url(${GUARDIAN_IMG})`,backgroundSize:"400% 200%",backgroundPosition:`${col*(100/3)}% ${row*100}%`,backgroundRepeat:"no-repeat",borderRadius:6,border:"2px solid #3d2f18",flexShrink:0}}/>;
}
function MonsterPortrait({col,row,size=160}){
  const MCELL=107,BORDER=2,NATURAL=1092,scale=size/MCELL;
  const srcX=BORDER+col*(MCELL+BORDER),srcY=BORDER+row*(MCELL+BORDER);
  return <div style={{width:size,height:size,overflow:"hidden",borderRadius:6,border:"2px solid #3d2f18",flexShrink:0,position:"relative"}}>
    <div style={{position:"absolute",width:NATURAL*scale,height:NATURAL*scale,backgroundImage:`url(${MONSTER_GRID})`,backgroundSize:"100% 100%",left:-srcX*scale,top:-srcY*scale}}/>
  </div>;
}

function CourtierPortrait({col,row,size=160}){
  // undeadCourt.png is a plain 4x4 grid (16 portraits), no gutter between cells.
  const MCELL=273,NATURAL=1092,scale=size/MCELL;
  const srcX=col*MCELL,srcY=row*MCELL;
  return <div style={{width:size,height:size,overflow:"hidden",borderRadius:6,border:"2px solid #3d2f18",flexShrink:0,position:"relative"}}>
    <div style={{position:"absolute",width:NATURAL*scale,height:NATURAL*scale,backgroundImage:`url(${COURTIER_IMG})`,backgroundSize:"100% 100%",left:-srcX*scale,top:-srcY*scale}}/>
  </div>;
}

// ── Guardian Encounter ────────────────────────────────────────────────────────
function GuardianEncounter({guardian,setHeroState,onDismiss,onDefeated}){
  const [answer,setAnswer]=useState("");
  const [result,setResult]=useState(null);
  const riddle=GUARDIAN_RIDDLES[guardian.id];
  const submit=()=>{
    const correct=riddle.a.includes(answer.trim().toLowerCase());
    if(correct){
      setHeroState(h=>({...h,gold:h.gold+200,candles:h.candles+5}));
      if(onDefeated) onDefeated(guardian.id);
      const disappear=[
        "With a thunderous crack, the guardian shatters into a thousand shards of light!",
        "The guardian lets out a final roar, then crumbles into dust and blows away on the wind.",
        "A blinding flash — and the guardian is gone, fading silently into the mists.",
        "The guardian dissolves in a swirl of ancient magic, fading to nothing before your eyes.",
        "Roots retract, stone crumbles, water recedes — the guardian vanishes without a trace.",
      ][rng(0,4)];
      setResult({correct:true,msg:`${disappear} +200 gold, +5 candles.`});
    } else {
      const dmg=rng(1,25);
      setHeroState(h=>({...h,health:Math.max(0,h.health-dmg)}));
      const angry=GUARDIAN_ANGRY[guardian.id];
      setResult({correct:false,msg:angry[rng(0,angry.length-1)],dmg});
    }
  };
  return (
    <div style={{position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",maxWidth:460,width:"95%"}}>
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`}}>
          <GuardianPortrait col={guardian.col} row={guardian.row} size={130}/>
          <div style={{padding:"12px 14px",flex:1,display:"flex",flexDirection:"column",justifyContent:"center"}}>
            <div style={{color:C.gold,fontSize:16,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3}}>{guardian.name}</div>
            {result&&<div style={{fontSize:11,padding:"6px 8px",borderRadius:3,background:result.correct?"#0d2a1a":"#2a0d0d",border:`1px solid ${result.correct?C.green:C.red}`,color:result.correct?"#6fcf97":"#e07070",marginTop:6}}>{result.correct?"✓ Correct!":`✗ Wrong! −${result.dmg}% health`}</div>}
          </div>
        </div>
        <div style={{padding:"14px 18px"}}>
          <div style={{background:"#100e08",border:`1px solid ${C.border}`,borderRadius:4,padding:"11px 13px",marginBottom:12,fontStyle:"italic",fontSize:14,lineHeight:1.7,color:"#d4c8a8",textAlign:"center"}}>"{riddle.q}"</div>
          {!result&&<>
            <input value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>e.key==="Enter"&&answer.trim()&&submit()} placeholder="Your answer…" autoFocus
              style={{width:"100%",padding:"8px 11px",background:"#0d0a06",border:`1px solid ${C.border}`,borderRadius:3,color:C.text,fontFamily:"inherit",fontSize:13,marginBottom:10,boxSizing:"border-box",outline:"none"}}/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button style={btnS(C.dim,false)} onClick={onDismiss} onMouseEnter={e=>{e.currentTarget.style.background=C.dim;e.currentTarget.style.color=C.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.dim;}}>Flee</button>
              <button style={btnS(C.gold,!answer.trim())} disabled={!answer.trim()} onClick={submit} onMouseEnter={e=>{if(answer.trim()){e.currentTarget.style.background=C.gold;e.currentTarget.style.color=C.bg;}}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=answer.trim()?C.gold:"#444";}}>Answer</button>
            </div>
          </>}
          {result&&<>
            <div style={{fontSize:13,lineHeight:1.7,color:result.correct?"#a8d8b8":"#d89898",marginBottom:12,fontStyle:"italic",textAlign:"center"}}>{result.msg}</div>
            <div style={{display:"flex",justifyContent:"center"}}>
              <button style={btnS(C.gold,false)} onClick={onDismiss} onMouseEnter={e=>{e.currentTarget.style.background=C.gold;e.currentTarget.style.color=C.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.gold;}}>Return to Map</button>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

// ── Tournament Fight ───────────────────────────────────────────────────────────
function TournamentFight({defeatedTournament,setDefeatedTournament,
    heroState,setHeroState,addLog,groundItems,setGroundItems,heroPos,onDismiss,onDead}){
  const fighter=TOURNAMENT_FIGHTERS.find(f=>!defeatedTournament.has(f.id));
  const allDone=!fighter;

  const btnS2=(col,dis)=>({padding:"8px 16px",background:"transparent",
    border:`1.5px solid ${dis?"#333":col}`,color:dis?"#444":col,
    cursor:dis?"not-allowed":"pointer",borderRadius:3,fontSize:12});

  if(allDone)return(
    <div style={{position:"fixed",inset:0,background:"#000d",display:"flex",
      alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.panel,border:"2px solid #c9a84c",borderRadius:12,
        maxWidth:420,width:"90%",textAlign:"center",padding:"28px 24px"}}>
        <div style={{fontSize:20,color:"#c9a84c",marginBottom:12}}>🏆 Grand Tournament Complete!</div>
        <div style={{color:C.text,fontSize:13,marginBottom:20}}>
          All four champions have fallen. The Grand Tournament is yours!
        </div>
        <button style={btnS2("#c9a84c",false)} onClick={onDismiss}>Claim glory</button>
      </div>
    </div>
  );

  // Convert the tournament fighter into a CombatScreen-compatible monster shape
  const monster={
    id:fighter.id,name:fighter.name,col:fighter.col,row:fighter.row,
    strength:fighter.strength,skill:fighter.skill,armour:fighter.armour,
    attacks:fighter.attacks,twoHanded:fighter.twoHanded,
    weaponAtks:fighter.weaponAtks,poisonDagger:fighter.poisonDagger,
    maxHealth:100,level:Math.round((fighter.strength+fighter.skill)/2),
    dialogue:fighter.dialogue,
  };

  return(
    <CombatScreen
      monster={monster}
      heroState={heroState} setHeroState={setHeroState}
      isTournament={true}
      fixedLoot={fighter.loot}
      fixedCandles={fighter.candles}
      addLog={addLog}
      groundItems={groundItems} setGroundItems={setGroundItems} heroPos={heroPos}
      onVictory={(mon)=>{
        const f=TOURNAMENT_FIGHTERS.find(x=>x.id===mon.id);
        if(!f){onDismiss();return;}
        const nd=new Set(defeatedTournament);nd.add(f.id);
        setDefeatedTournament(nd);
        addLog(`🏆 ${f.name} defeated! +${f.candles} candles!`
          +((f.loot&&f.loot.length)?` Found: ${f.loot.map(i=>i.name).join(", ")}`:""));
        onDismiss();
      }}
      onDefeat={()=>{onDismiss();onDead&&onDead();}}
      onFlee={()=>{addLog(`You flee from ${fighter.name}!`);onDismiss();}}
    />
  );
}


// ── Item Pickup Panel (shared by combat-victory loot and ground-item pickup) ──
// mode="victory": items are already in inventory; offers Drop/Eat/Equip, single Continue button.
// mode="ground":  items are still on the ground; offers Take/Eat, plus Take All / Leave buttons.
function ItemRow({item,col,extras,actions}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:6,padding:"7px 10px",marginBottom:5,
      borderRadius:4,background:"#1f1a11",border:`1px solid ${C.border}`}}>
      <span style={{fontSize:12,color:col,flex:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{item.name}</span>
      {extras}
      {actions}
    </div>
  );
}

function ItemPickupPanel({mode,
    // victory mode
    loot,inventory,equipped,doEquipWeapon,
    // ground mode
    items,groundKey,
    // shared
    INV_MAX,setHeroState,groundItems,setGroundItems,heroPos,onDismiss}){
  const isVictory=mode==="victory";
  const heroInv=inventory||[];

  const itemColor=item=>item.type==="magic"?(item.color||"#9b59b6"):
    item.type==="food"?C.gold:item.strBonus!=null?"#e74c3c":"#7f8c8d";

  const dropToGround=(item)=>{
    if(heroPos&&setGroundItems){
      const key=`${heroPos.x},${heroPos.y}`;
      setGroundItems(g=>({...g,[key]:[...(g[key]||[]),item]}));
    }
  };

  // ── Victory mode logic ──────────────────────────────────────────────────────
  const overFull=isVictory&&heroInv.length>INV_MAX;

  // ── Ground mode logic ────────────────────────────────────────────────────────
  const gold=!isVictory?(items||[]).filter(i=>i.isGold).reduce((s,i)=>s+(i.amount||0),0):0;
  const realItems=!isVictory?(items||[]).filter(i=>!i.isGold):[];

  const takeAll=()=>{
    const room=INV_MAX-heroInv.length;
    if(room<=0){
      if(gold>0){
        setHeroState(h=>({...h,gold:h.gold+gold}));
        setGroundItems(g=>({...g,[groundKey]:(g[groundKey]||[]).filter(i=>!i.isGold)}));
      }
      return;
    }
    const toTake=realItems.slice(0,room);
    const leftover=realItems.slice(room);
    setHeroState(h=>({...h,gold:h.gold+gold,inventory:[...h.inventory,...toTake]}));
    setGroundItems(g=>{
      if(leftover.length===0){const n={...g};delete n[groundKey];return n;}
      return {...g,[groundKey]:leftover};
    });
    if(leftover.length===0)onDismiss();
  };

  const takeItem=(item)=>{
    if(heroInv.length>=INV_MAX)return;
    setHeroState(h=>({...h,inventory:[...h.inventory,item]}));
    setGroundItems(g=>{
      const updated=(g[groundKey]||[]).filter(i=>(i.uid||i.id)!==(item.uid||item.id));
      if(updated.length===0){const n={...g};delete n[groundKey];return n;}
      return {...g,[groundKey]:updated};
    });
  };

  const takeGold=()=>{
    if(gold<=0)return;
    setHeroState(h=>({...h,gold:h.gold+gold}));
    setGroundItems(g=>{
      const updated=(g[groundKey]||[]).filter(i=>!i.isGold);
      if(updated.length===0){const n={...g};delete n[groundKey];return n;}
      return {...g,[groundKey]:updated};
    });
  };

  const eatGroundItem=(item,i)=>{
    setHeroState(h=>({...h,health:Math.min(100,h.health+(item.heal||0))}));
    setGroundItems(g=>{
      const updated=(g[groundKey]||[]).filter((_,j)=>j!==i);
      if(updated.length===0){const n={...g};delete n[groundKey];return n;}
      return {...g,[groundKey]:updated};
    });
  };

  // Auto-close ground dialogue once everything has been taken
  React.useEffect(()=>{if(!isVictory&&(items||[]).length===0)onDismiss();},[isVictory,items?.length]);

  // ── Shared item-action handlers for victory mode (Drop/Eat/Equip on owned items) ──
  const dropOwned=(item,i)=>{
    dropToGround(item);
    setHeroState(h=>({...h,inventory:h.inventory.filter((_,j)=>j!==i)}));
  };
  const eatOwned=(item,i)=>{
    setHeroState(h=>({...h,health:Math.min(100,h.health+(item.heal||0)),
      inventory:h.inventory.filter((_,j)=>j!==i)}));
  };
  const equipOwned=(item,i)=>{
    if(item.armourBonus==null&&item.strBonus!=null){
      const {newEq,toInv}=doEquipWeapon(item,equipped);
      setHeroState(h=>({...h,equipped:{...h.equipped,...newEq},
        inventory:[...h.inventory.filter((_,j)=>j!==i),...toInv]}));
    } else {
      const slot=item.slot==="left_shield"?"left_hand":item.slot;
      const old=equipped[slot];
      const strDelta=armourStrBonus(item)-armourStrBonus(old);
      const sklDelta=armourSklBonus(item)-armourSklBonus(old);
      setHeroState(h=>({...h,baseStrength:h.baseStrength+strDelta,baseSkill:h.baseSkill+sklDelta,equipped:{...h.equipped,[slot]:item},
        inventory:[...h.inventory.filter((_,j)=>j!==i),...(old?[old]:[])]}));
    }
  };

  return(
    <div style={isVictory?{}:{position:"fixed",inset:0,background:"#000b",display:"flex",
      alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={isVictory?{}:{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,
        overflow:"hidden",maxWidth:400,width:"95%",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>

        {/* Header */}
        {isVictory
          ?<div style={{color:"#6fcf97",fontSize:15,fontWeight:"bold",marginBottom:8,textAlign:"center"}}>🏆 Victory!</div>
          :<div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,background:"#120f07",flexShrink:0}}>
              <div style={{color:C.gold,fontSize:15,letterSpacing:"0.1em",textTransform:"uppercase"}}>Items on the Ground</div>
              <div style={{color:C.dim,fontSize:10,marginTop:2}}>You find something here...</div>
            </div>}

        {/* Body */}
        <div style={isVictory?{}:{flex:1,overflowY:"auto",padding:"10px 14px"}}>
          {isVictory?(
            <>
              <div style={{background:"#0d2a1a",border:"1px solid #2d8a4e",borderRadius:5,padding:"8px 10px",marginBottom:8,fontSize:11}}>
                {loot.candles
                  ?<div style={{color:"#f1c40f",marginBottom:3}}>🕯 <strong>+{loot.candles} candles</strong> earned.</div>
                  :<div style={{color:"#6fcf97",marginBottom:3}}>💰 <strong>{loot.gold} gold</strong> found.</div>}
                {loot.items.map((item,i)=><div key={i} style={{color:"#a8d8b8",marginTop:2}}>📦 {item.name}</div>)}
                {loot.items.length===0&&<div style={{color:"#7a6a4a"}}>No items found.</div>}
                {loot.levelUp&&<div style={{color:"#f1c40f",marginTop:6,fontWeight:"bold"}}>
                  ⬆ {loot.levelUpStat==="baseStrength"?"Strength":"Skill"} increased by 1!
                </div>}
              </div>
              {overFull&&(
                <div style={{background:"#2a0d0d",border:`1px solid ${C.red}`,borderRadius:5,padding:"8px 10px",marginBottom:8}}>
                  <div style={{color:C.red,fontSize:11,marginBottom:5}}>⚠ Inventory over limit ({heroInv.length}/{INV_MAX})</div>
                  {heroInv.map((item,i)=>{
                    const isOver=i>=INV_MAX;
                    return(
                      <div key={item.uid||i} style={{display:"flex",alignItems:"center",gap:4,marginBottom:3,
                        padding:"2px 5px",borderRadius:2,
                        background:isOver?"#3a0808":"#1a1208",
                        border:`1px solid ${isOver?C.red:C.border}`}}>
                        <span style={{fontSize:10,color:isOver?C.red:C.text,flex:1,overflow:"hidden",
                          whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{item.name}</span>
                        <button style={{fontSize:8,padding:"1px 5px",background:"transparent",
                          border:`1px solid ${C.dim}`,color:C.dim,cursor:"pointer",borderRadius:2,flexShrink:0}}
                          onClick={()=>dropOwned(item,i)}>Drop</button>
                        {item.type==="food"&&(
                          <button style={{fontSize:8,padding:"1px 5px",background:"transparent",
                            border:`1px solid ${C.green}`,color:C.green,cursor:"pointer",borderRadius:2,flexShrink:0}}
                            onClick={()=>eatOwned(item,i)}>Eat</button>
                        )}
                        {(item.strBonus!=null||item.armourBonus!=null)&&(
                          <button style={{fontSize:8,padding:"1px 5px",background:"transparent",
                            border:`1px solid ${C.green}`,color:C.green,cursor:"pointer",borderRadius:2,flexShrink:0}}
                            onClick={()=>equipOwned(item,i)}>Equip</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ):(
            <>
              {gold>0&&(
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:6,borderRadius:4,background:"#1f1a08",border:`1px solid ${C.border}`}}>
                  <span style={{fontSize:18}}>💰</span>
                  <span style={{fontSize:13,color:C.gold,flex:1}}>{gold} gold</span>
                  <button style={{fontSize:8,padding:"2px 7px",background:"transparent",border:`1px solid ${C.gold}`,color:C.gold,cursor:"pointer",borderRadius:2}}
                    onClick={takeGold}>Take</button>
                </div>
              )}
              {realItems.map((item,i)=>(
                <ItemRow key={item.uid||i} item={item} col={itemColor(item)}
                  extras={<>
                    {item.strBonus!=null&&<span style={{fontSize:9,color:C.dim}}>+{item.strBonus}str</span>}
                    {item.armourBonus!=null&&<span style={{fontSize:9,color:C.dim}}>+{item.armourBonus}arm</span>}
                    {item.heal!=null&&<span style={{fontSize:9,color:C.dim}}>+{item.heal}hp</span>}
                  </>}
                  actions={<>
                    <button style={{fontSize:8,padding:"2px 7px",background:"transparent",
                      border:`1px solid ${heroInv.length>=INV_MAX?"#444":C.green}`,
                      color:heroInv.length>=INV_MAX?"#444":C.green,
                      cursor:heroInv.length>=INV_MAX?"not-allowed":"pointer",borderRadius:2}}
                      disabled={heroInv.length>=INV_MAX}
                      onClick={()=>takeItem(item)}>Take</button>
                    {item.type==="food"&&<button style={{fontSize:8,padding:"2px 7px",background:"transparent",
                      border:"1px solid #2d8a4e",color:"#2d8a4e",cursor:"pointer",borderRadius:2}}
                      onClick={()=>eatGroundItem(item,i)}>Eat</button>}
                  </>}
                />
              ))}
              {heroInv.length>0&&<>
                <div style={{color:C.dim,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",margin:"10px 0 5px"}}>Your inventory — drop here</div>
                {heroInv.map((item,i)=>(
                  <div key={item.uid||i} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",marginBottom:4,borderRadius:4,background:"#151008",border:`1px solid ${C.border}`}}>
                    <span style={{fontSize:11,color:C.text,flex:1}}>{item.name}</span>
                    <button style={{fontSize:8,padding:"2px 7px",background:"transparent",border:`1px solid ${C.dim}`,color:C.dim,cursor:"pointer",borderRadius:2}}
                      onClick={()=>{dropToGround(item);setHeroState(h=>({...h,inventory:h.inventory.filter(i2=>(i2.uid||i2.id)!==(item.uid||item.id))}));}}>Drop</button>
                  </div>
                ))}
              </>}
            </>
          )}
        </div>

        {/* Footer */}
        {isVictory
          ?<div style={{display:"flex",justifyContent:"center"}}>
              <button style={btnS(C.gold,overFull)} disabled={overFull} onClick={onDismiss}
                onMouseEnter={e=>{if(!overFull){e.currentTarget.style.background=C.gold;e.currentTarget.style.color=C.bg;}}}
                onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=overFull?"#333":C.gold;}}>
                {overFull?"Drop items to continue →":"Continue"}
              </button>
            </div>
          :<div style={{padding:"10px 14px",borderTop:`1px solid ${C.border}`,flexShrink:0,display:"flex",gap:8,justifyContent:"space-between"}}>
              {(gold>0||realItems.length>0)&&<button style={{...btnS(C.gold,false),padding:"6px 16px"}} onClick={takeAll}
                onMouseEnter={e=>{e.currentTarget.style.background=C.gold;e.currentTarget.style.color=C.bg;}}
                onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.gold;}}>
                Take All
              </button>}
              <button style={{...btnS(C.dim,false),padding:"6px 16px"}} onClick={onDismiss}
                onMouseEnter={e=>{e.currentTarget.style.background=C.dim;e.currentTarget.style.color=C.bg;}}
                onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.dim;}}>
                Leave
              </button>
            </div>}
      </div>
    </div>
  );
}

// ── Combat Screen ─────────────────────────────────────────────────────────────
export function CombatScreen({monster,heroState,setHeroState,isDragon,isTournament,isCastle,fixedLoot,fixedCandles,onVictory,onDefeat,onFlee,addLog,groundItems,setGroundItems,heroPos}){
  const [mon,setMon]=useState({...monster,health:monster.maxHealth||100});
  const [potionReverts,setPotionReverts]=useState({});
  const [combatLog,setCombatLog]=useState(monster.dialogue
    ?[`⚔ You face the ${monster.name}!`,`"${monster.dialogue}"`]
    :[`⚔ You face the ${monster.name}!`]);
  const addCombatLog=msg=>setCombatLog(p=>[msg,...p].slice(0,20));
  const [done,setDone]=useState(null); // "won"|"fled"|"dead"
  const [poisoned,setPoisoned]=useState(false);

  const eq=heroState.equipped||{head:null,body:null,right_hand:null,left_hand:null,feet:null};
  const ring=eq.finger;
  const atks=weaponAttacks(eq);
  const armour=totalArmour(eq,heroState.baseArmour||0);
  const heroHp=heroState.health;

  const inv=heroState.inventory||[];
  const wands=inv.filter(i=>i.type==="magic"&&i.form==="wand");
  const potions=inv.filter(i=>i.type==="magic"&&i.form==="potion");

  const [loot,setLoot]=useState(null);
  const [sliderVal,setSliderVal]=useState(0);
  const [sliderReverts,setSliderReverts]=useState(null); // {baseStrength, baseSkill} originals

  const moveSlider=(val)=>{
    const v=Number(val);
    setSliderVal(v);
    setHeroState(h=>{
      // Capture originals on first move away from centre
      const orig=sliderReverts||{baseStrength:h.baseStrength,baseSkill:h.baseSkill};
      if(!sliderReverts) setSliderReverts(orig);
      return{...h,
        baseStrength:orig.baseStrength-v,
        baseSkill:orig.baseSkill+v,
      };
    });
  };

  const endCombat=(outcome)=>{
    // Revert slider offsets first, then potion reverts
    if(sliderReverts){
      setHeroState(h=>({...h,baseStrength:sliderReverts.baseStrength,baseSkill:sliderReverts.baseSkill}));
      setSliderReverts(null);
    }
    if(Object.keys(potionReverts).length>0){
      setHeroState(h=>({...h,...potionReverts}));
      setPotionReverts({});
    }
    setDone(outcome);
    if(outcome==="won"){
      if(isTournament){
        // Tournament fighters drop fixed named loot + fixed candles, not random gold/items
        const lootItems=(fixedLoot||[]).map((l,i)=>({...l,uid:l.uid||Date.now()+i}));
        setLoot({gold:0,items:lootItems,levelUp:false,levelUpStat:null,candles:fixedCandles||0});
        setHeroState(h=>({...h,candles:(h.candles||0)+(fixedCandles||0),inventory:[...h.inventory,...lootItems]}));
        return;
      }
      const gold=rng(5+mon.level,10+mon.level*4);
      const lootItems=[];
      // Tier scales with monster level: lvl1-5→t1, 6-10→t2, etc. Uncapped —
      // gear naturally saturates at tier 5 (its highest item), but this lets
      // high-level monsters roll higher-tier magic drops (see MAGIC_TYPE_TIER).
      const monTier=Math.ceil((mon.level||1)/5);
      if(Math.random()<0.75){
        // Allow items from tier-1 to tier, weighted toward current tier
        const pool=[...FOOD,...WEAPONS.filter(i=>i.tier<=monTier),...ARMOUR_ITEMS.filter(i=>i.tier<=monTier)];
        // Weight higher-tier items more
        const weighted=pool.flatMap(i=>i.tier?(Array(i.tier).fill(i)):[i]);
        lootItems.push({...weighted[rng(0,weighted.length-1)],uid:Date.now()+Math.random()});
      }
      if(Math.random()<0.10) lootItems.push({...randomMagicItem(monTier),uid:Date.now()+Math.random()});
      // Level-up: if monster level >= hero's effective level, boost str or skl
      const heroLvl=Math.round((heroState.baseStrength+heroState.baseSkill)/2);
      const levelUp=mon.level>=heroLvl&&!mon.isDragon;
      const levelUpStat=levelUp?(Math.random()<0.5?"baseStrength":"baseSkill"):null;
      setLoot({gold,items:lootItems,levelUp,levelUpStat});
      setHeroState(h=>({...h,gold:h.gold+gold,inventory:[...h.inventory,...lootItems],
        ...(levelUpStat?{[levelUpStat]:h[levelUpStat]+1}:{})}));
    }
    // "dead" just sets `done` above — onDefeat fires from the "Game Over"
    // button's onClick once the player acknowledges the death screen, not
    // automatically here (that used to unmount the modal before the
    // "You have fallen" panel could ever render).
  };

  const doFight=()=>{
    let hHp=heroState.health, mHp=mon.health;
    let newPoisoned=poisoned;
    const lines=[];

    // Ring passives
    if(ring){
      const comps=MAGIC_COMPS[ring.magicType]||[];
      if(comps.includes("fire")){const g=Math.min(1,100-hHp);hHp=Math.min(100,hHp+1);if(g>0)lines.push(`${ring.name} heals 1 HP.`);}
    }
    // Poison tick
    if(newPoisoned){const pd=rng(1,3);hHp=Math.max(0,hHp-pd);lines.push(`☠ Poison: -${pd} HP.`);}
    if(hHp<=0){lines.forEach(addCombatLog);setHeroState(h=>({...h,health:0}));endCombat("dead");return;}

    // Hero attacks (always use the hero's own weapon stats — normal for every fighter)
    const extraAtk=ring&&MAGIC_COMPS[ring.magicType]?.includes("lightning")?1:0;
    const totalAtks=[...atks,...Array(extraAtk).fill({label:"Ring Attack",bonus:0})];
    for(const atk of totalAtks){
      if(mHp<=0) break;
      const hStr=eff(heroState.baseStrength+(atk.bonus||0),hHp);
      const hSkl=eff(heroState.baseSkill,hHp);
      const mSkl=eff(mon.skill,mHp);
      if(Math.random()<hitChance(hSkl,mSkl)){
        const d=atk.twoHanded ? randDmg(hStr*2, mon.armour) : randDmg(hStr, mon.armour);
        mHp=Math.max(0,mHp-d);
        lines.push(`${atk.label}: ${d} dmg.`);
      } else lines.push(`${atk.label}: miss.`);
    }

    // Monster/fighter attacks
    if(mHp>0){
      // Tournament fighters with weaponAtks (e.g. Kenshiro) use their own named weapons,
      // each attacking once per round with double damage: 2*rand(0,fighter.strength+bonus)-rand(0,armour)
      const usingFighterAtks=!!mon.weaponAtks;
      const fighterAtks=usingFighterAtks?mon.weaponAtks:null;
      const effAtks=usingFighterAtks?fighterAtks.length:effCeil(mon.attacks,mHp);
      for(let a=0;a<effAtks;a++){
        const atk=usingFighterAtks?fighterAtks[a]:null;
        const mStr=usingFighterAtks?eff((mon.strength||0)+(atk.bonus||0),mHp):eff(mon.strength,mHp);
        const mSkl=eff(mon.skill,mHp);
        const hSkl=eff(heroState.baseSkill,hHp);
        if(Math.random()<hitChance(mSkl,hSkl)){
          const twoH=usingFighterAtks?atk.twoHanded:mon.twoHanded;
          const d=twoH?randDmg(mStr*2,armour):randDmg(mStr,armour);
          hHp=Math.max(0,hHp-d);
          lines.push(`${mon.name}${usingFighterAtks?` (${atk.label})`:""}: ${d} dmg.`);
          if(mon.poisonDagger&&!newPoisoned&&Math.random()<0.4){newPoisoned=true;lines.push("☠ You are poisoned!");}
        } else lines.push(`${mon.name}${usingFighterAtks?` (${atk.label})`:""} misses.`);
        if(hHp<=0) break;
      }
    }

    lines.forEach(addCombatLog);
    setMon(m=>({...m,health:mHp}));
    if(newPoisoned!==poisoned) setPoisoned(newPoisoned);
    setHeroState(h=>({...h,health:hHp}));
    if(mHp<=0) endCombat("won");
    else if(hHp<=0) endCombat("dead");
  };

  const useWand=(wand)=>{
    const comps=MAGIC_COMPS[wand.magicType]||[];
    const lines=[];
    let wonCombat=false;
    setMon(prev=>{
      let m={...prev};
      if(comps.includes("fire")){const d=rng(1,5);m.health=Math.max(0,m.health-d);lines.push(`${wand.name}: ${d} fire dmg.`);}
      if(comps.includes("lightning")){const d=rng(1,3);m.skill=Math.max(1,m.skill-d);lines.push(`${wand.name}: -${d} monster skill.`);}
      if(comps.includes("iron")){const d=rng(1,3);m.strength=Math.max(1,m.strength-d);lines.push(`${wand.name}: -${d} monster strength.`);}
      if(comps.includes("dark")){const d=rng(1,5)*10;m.health=Math.max(0,m.health-d);lines.push(`${wand.name}: ${d} dark dmg.`);}
      if(comps.includes("crystal")){const d=rng(1,3)*10;m.strength=Math.max(1,m.strength-d);lines.push(`${wand.name}: -${d} monster strength.`);}
      if(comps.includes("shadow")){const d=rng(1,3)*10;m.skill=Math.max(1,m.skill-d);lines.push(`${wand.name}: -${d} monster skill.`);}
      if(m.health<=0) wonCombat=true;
      return m;
    });
    setHeroState(h=>{
      const current=h.inventory.find(i=>i.uid===wand.uid);
      if(!current) return h;
      const uses=(current.uses||0)+1;
      const breaks=uses>5&&Math.random()<0.5;
      if(breaks){
        lines.push(`${wand.name} sputters and loses its power!`);
        return {...h,inventory:h.inventory.filter(i=>i.uid!==wand.uid)};
      }
      if(uses===5) lines.push(`${wand.name} flickers — further uses may destroy it.`);
      return {...h,inventory:h.inventory.map(i=>i.uid===wand.uid?{...i,uses}:i)};
    });
    setTimeout(()=>{lines.forEach(addCombatLog);if(wonCombat)endCombat("won");},0);
  };

  const usePotion=(pot)=>{
    const comps=MAGIC_COMPS[pot.magicType]||[];
    const reverts={};
    setHeroState(h=>{
      let nh={...h};
	if(comps.includes("fire")){
	    const d=rng(1,5)+3;
	    reverts.health=h.health;
	    nh.health=h.health+d;
	    addCombatLog(`${pot.name}: +${d} health.`);
	}
	if(comps.includes("lightning")){
	    const d=rng(1,5)+3;
	    reverts.baseSkill=h.baseSkill;
	    nh.baseSkill=(h.baseSkill)+d;
	    addCombatLog(`${pot.name}: +${d} skill.`);
	}
	if(comps.includes("iron")){
	    const d=rng(1,5)+3;
	    reverts.baseStrength=h.baseStrength;
	    nh.baseStrength=(h.baseStrength)+d;
	    addCombatLog(`${pot.name}: +${d} strength.`);
	}
	if(comps.includes("dark")){
	    const d=(rng(1,5)+3)*10;
	    reverts.health=h.health;
	    nh.health=h.health+d;
	    addCombatLog(`${pot.name}: +${d} health.`);
	}
	if(comps.includes("crystal")){
	    const d=rng(1,5);
	    nh.baseStrength=h.baseStrength+d;
	    addCombatLog(`${pot.name}: +${d} strength (permanent).`);
	}
	if(comps.includes("shadow")){
	    const d=rng(1,5);
	    nh.baseSkill=h.baseSkill+d;
	    addCombatLog(`${pot.name}: +${d} skill (permanent).`);
	}
      nh.inventory=h.inventory.filter(i=>i.id!==pot.id);
      return nh;
    });
    setPotionReverts(r=>({...r,...reverts}));
  };

  const mHpPct=(mon.health/100)*100;
  const hHpPct=clamp(heroHp,0,100);

  return(
    <div style={{position:"fixed",inset:0,background:"#000d",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.panel,border:`1px solid ${isDragon?"#ff6b00":C.border}`,borderRadius:10,overflow:"hidden",maxWidth:520,width:"95%",maxHeight:"92vh",display:"flex",flexDirection:"column"}}>

        {/* Monster header */}
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          {isDragon
            ? <img src={DRAGON_IMG} alt="Dragon" style={{width:120,height:120,objectFit:"cover",flexShrink:0}}/>
            : isTournament
            ? <div style={{width:120,height:120,flexShrink:0,borderRadius:4,overflow:"hidden",
                backgroundImage:`url(${TOURNAMENT_IMG})`,backgroundSize:"200% 200%",
                backgroundPosition:`${mon.col*100}% ${mon.row*100}%`}}/>
            : isCastle
            ? <CourtierPortrait col={mon.col} row={mon.row} size={120}/>
            : <MonsterPortrait col={mon.col} row={mon.row} size={120}/>
          }
          <div style={{padding:"10px 14px",flex:1}}>
            <div style={{color:isDragon?"#ff6b00":C.gold,fontSize:15,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>{mon.name}</div>
            <HpBar pct={mHpPct}/>
            <div style={{display:"flex",gap:12,fontSize:10,color:C.dim}}>
              <span>Str:{Math.round(eff(mon.strength,mon.health))}/{mon.strength}</span>
              <span>Skl:{Math.round(eff(mon.skill,mon.health))}/{mon.skill}</span>
              <span>Arm:{mon.armour}</span>
              <span>Atk:{effCeil(mon.attacks,mon.health)}/{mon.attacks}</span>
            </div>
          </div>
        </div>

        {/* Hero bar */}
        <div style={{padding:"8px 14px",background:"#150f08",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
            <span style={{color:C.dim}}>Hero</span>
            <span style={{color:C.text}}>{heroHp}% HP · Armour {armour}</span>
          </div>
          <HpBar pct={hHpPct}/>
          <div style={{fontSize:10,color:C.dim}}>
            {atks.map((a,i)=><span key={i} style={{marginRight:8}}>⚔ {a.label} (+{a.bonus})</span>)}
            {ring&&<span style={{color:MAGIC_COLOR[ring.magicType]}}>💍 {ring.name}</span>}
          </div>
        </div>

        {/* Actions */}
        <div style={{padding:"10px 14px",borderTop:`1px solid ${C.border}`,flexShrink:0}}>
          {!done&&<>
            <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
              <button style={btnS(C.red,false)} onClick={doFight} onMouseEnter={e=>{e.currentTarget.style.background=C.red;e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.red;}}>⚔ Fight</button>
              <button style={btnS(C.dim,false)} onClick={()=>{ if(Math.random()<0.75){endCombat("fled");}else{addCombatLog("Failed to flee! The enemy strikes as you turn!");doFight();}}} onMouseEnter={e=>{e.currentTarget.style.background=C.dim;e.currentTarget.style.color=C.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.dim;}}>🏃 Flee (75%)</button>
            </div>
            <CombatSlider val={sliderVal} onChange={moveSlider} baseStr={heroState.baseStrength} baseSkl={heroState.baseSkill} C={C}/>
            {(wands.length>0||potions.length>0)&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
              {wands.map(w=>{const uses=w.uses||0;const risky=uses>=5;return(<button key={w.uid||w.id} style={{...btnS(risky?"#e07030":MAGIC_COLOR[w.magicType],false),padding:"3px 9px",fontSize:10}} onClick={()=>useWand(w)} onMouseEnter={e=>{e.currentTarget.style.background=risky?"#e07030":MAGIC_COLOR[w.magicType];e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=risky?"#e07030":MAGIC_COLOR[w.magicType];}}>⚡ {w.name}{uses>0?` (${uses})`:""}</button>);})}
              {potions.map(p=><button key={p.id} style={{...btnS(MAGIC_COLOR[p.magicType],false),padding:"3px 9px",fontSize:10}} onClick={()=>usePotion(p)} onMouseEnter={e=>{e.currentTarget.style.background=MAGIC_COLOR[p.magicType];e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=MAGIC_COLOR[p.magicType];}}>🧪 {p.name}</button>)}
            </div>}
          </>}
          {done==="won"&&loot&&<ItemPickupPanel
              mode="victory"
              loot={loot}
              inventory={heroState.inventory||[]}
              equipped={heroState.equipped||{}}
              INV_MAX={INV_MAX}
              setHeroState={setHeroState}
              doEquipWeapon={doEquipWeapon}
              groundItems={groundItems}
              setGroundItems={setGroundItems}
              heroPos={heroPos}
              onDismiss={()=>{addLog(loot.candles?`Victory! +${loot.candles} candles${loot.items.length?", "+loot.items.map(i=>i.name).join(", "):""}.`:`Victory! +${loot.gold}g${loot.items.length?", "+loot.items.map(i=>i.name).join(", "):""}.`);onVictory(mon);}}
            />}
          {done==="fled"&&<div style={{textAlign:"center"}}><div style={{color:C.dim,fontSize:13,marginBottom:8}}>You flee into the shadows.</div><button style={btnS(C.gold,false)} onClick={onFlee} onMouseEnter={e=>{e.currentTarget.style.background=C.gold;e.currentTarget.style.color=C.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.gold;}}>Continue</button></div>}
          {done==="dead"&&<div style={{textAlign:"center"}}><div style={{color:C.red,fontSize:14,marginBottom:8}}>💀 You have fallen.</div><button style={btnS(C.red,false)} onClick={onDefeat} onMouseEnter={e=>{e.currentTarget.style.background=C.red;e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.red;}}>Game Over</button></div>}
        </div>
        {/* Combat log — fixed at bottom */}
        <div style={{height:140,overflowY:"auto",padding:"6px 14px",background:"#0d0a06",borderTop:`1px solid ${C.border}`,flexShrink:0}}>
          {combatLog.map((l,i)=><div key={i} style={{fontSize:10,color:i===0?C.text:C.dim,marginBottom:1,lineHeight:1.4}}>{i===0?"▶ ":""}{l}</div>)}
        </div>
      </div>
    </div>
  );
}


// ── Multi-Monster Combat Screen ───────────────────────────────────────────────
export function MultiCombatScreen({monsters:initMonsters,heroState,setHeroState,isCastle,addLog,groundItems,setGroundItems,heroPos,onVictory,onDefeat,onFlee}){
  const [mons,setMons]=useState(initMonsters.map(m=>({...m,health:m.maxHealth||100})));
  const [potionReverts,setPotionReverts]=useState({});
  const [combatLog,setCombatLog]=useState([`⚔ You are ambushed by ${initMonsters.length} enemies!`]);
  const addCombatLog=msg=>setCombatLog(p=>[msg,...p].slice(0,30));
  const [done,setDone]=useState(null);
  const [loot,setLoot]=useState(null);
  const [poisoned,setPoisoned]=useState(false);
  const [sliderVal,setSliderVal]=useState(0);
  const [sliderReverts,setSliderReverts]=useState(null);

  const moveSlider=(val)=>{
    const v=Number(val);
    setSliderVal(v);
    setHeroState(h=>{
      const orig=sliderReverts||{baseStrength:h.baseStrength,baseSkill:h.baseSkill};
      if(!sliderReverts) setSliderReverts(orig);
      return{...h,baseStrength:orig.baseStrength-v,baseSkill:orig.baseSkill+v};
    });
  };

  const eq=heroState.equipped||{};
  const ring=eq.finger;
  const atks=weaponAttacks(eq);
  const armour=totalArmour(eq,heroState.baseArmour||0);
  const inv=heroState.inventory||[];
  const wands=inv.filter(i=>i.type==="magic"&&i.form==="wand");
  const potions=inv.filter(i=>i.type==="magic"&&i.form==="potion");

  const endCombat=(outcome,finalMons)=>{
    if(sliderReverts){
      setHeroState(h=>({...h,baseStrength:sliderReverts.baseStrength,baseSkill:sliderReverts.baseSkill}));
      setSliderReverts(null);
    }
    if(Object.keys(potionReverts).length>0){
      setHeroState(h=>({...h,...potionReverts}));
      setPotionReverts({});
    }
    setDone(outcome);
    if(outcome==="won"){
      const allMons=finalMons||mons;
      let gold=0;
      const lootItems=[];
      for(const m of allMons){
        gold+=rng(5+m.level,10+m.level*4);
        const monTier=Math.ceil((m.level||1)/5);
        if(Math.random()<0.75){
          const pool=[...FOOD,...WEAPONS.filter(i=>i.tier<=monTier),...ARMOUR_ITEMS.filter(i=>i.tier<=monTier)];
          const weighted=pool.flatMap(i=>i.tier?(Array(i.tier).fill(i)):[i]);
          lootItems.push({...weighted[rng(0,weighted.length-1)],uid:Date.now()+Math.random()});
        }
        if(Math.random()<0.10) lootItems.push({...randomMagicItem(monTier),uid:Date.now()+Math.random()});
      }
      const topMon=allMons.reduce((a,b)=>b.level>a.level?b:a,allMons[0]);
      const heroLvl=Math.round((heroState.baseStrength+heroState.baseSkill)/2);
      const levelUp=topMon.level>=heroLvl;
      const levelUpStat=levelUp?(Math.random()<0.5?"baseStrength":"baseSkill"):null;
      setLoot({gold,items:lootItems,levelUp,levelUpStat});
      setHeroState(h=>({...h,gold:h.gold+gold,inventory:[...h.inventory,...lootItems],
        ...(levelUpStat?{[levelUpStat]:h[levelUpStat]+1}:{})}));
    }
    // "dead" just sets `done` above — onDefeat fires from the "Game Over"
    // button's onClick once the player acknowledges the death screen, not
    // automatically here (that used to unmount the modal before the
    // "You have fallen" panel could ever render).
  };

  const doFight=(targetUid)=>{
    if(done) return;
    let hHp=heroState.health;
    let newPoisoned=poisoned;
    const lines=[];
    if(ring){const comps=MAGIC_COMPS[ring.magicType]||[];if(comps.includes("fire")){const g=Math.min(1,100-hHp);hHp=Math.min(100,hHp+1);if(g>0)lines.push(`${ring.name} heals 1 HP.`);}}
    if(newPoisoned){const pd=rng(1,3);hHp=Math.max(0,hHp-pd);lines.push(`☠ Poison: -${pd} HP.`);}
    if(hHp<=0){lines.forEach(addCombatLog);setHeroState(h=>({...h,health:0}));endCombat("dead");return;}
    const extraAtk=ring&&MAGIC_COMPS[ring.magicType]?.includes("lightning")?1:0;
    const totalAtks=[...atks,...Array(extraAtk).fill({label:"Ring Attack",bonus:0})];
    let updatedMons=mons.map(m=>({...m}));
    const tIdx=updatedMons.findIndex(m=>m.uid===targetUid);
    if(tIdx===-1) return;
    let target=updatedMons[tIdx];
    for(const atk of totalAtks){
      if(target.health<=0) break;
      const hStr=eff(heroState.baseStrength+(atk.bonus||0),hHp);
      const hSkl=eff(heroState.baseSkill,hHp);
      const mSkl=eff(target.skill,target.health);
      if(Math.random()<hitChance(hSkl,mSkl)){
        const d=atk.twoHanded?randDmg(hStr*2,target.armour):randDmg(hStr,target.armour);
        target.health=Math.max(0,target.health-d);
        lines.push(`${atk.label} hits ${target.name}: ${d} dmg.`);
      } else lines.push(`${atk.label} misses ${target.name}.`);
    }
    if(target.health<=0) lines.push(`💀 ${target.name} is slain!`);
    updatedMons[tIdx]=target;
    for(const mon of updatedMons){
      if(mon.health<=0) continue;
      if(hHp<=0) break;
      const effAtks=effCeil(mon.attacks,mon.health);
      for(let a=0;a<effAtks;a++){
        const mStr=eff(mon.strength,mon.health);
        const mSkl=eff(mon.skill,mon.health);
        const hSkl=eff(heroState.baseSkill,hHp);
        if(Math.random()<hitChance(mSkl,hSkl)){
          const d=mon.twoHanded?randDmg(mStr*2,armour):randDmg(mStr,armour);
          hHp=Math.max(0,hHp-d);
          lines.push(`${mon.name}: ${d} dmg.`);
          if(mon.poisonDagger&&!newPoisoned&&Math.random()<0.4){newPoisoned=true;lines.push("☠ You are poisoned!");}
        } else lines.push(`${mon.name} misses.`);
        if(hHp<=0) break;
      }
    }
    lines.forEach(addCombatLog);
    const remaining=updatedMons.filter(m=>m.health>0);
    setMons(updatedMons);
    if(newPoisoned!==poisoned) setPoisoned(newPoisoned);
    setHeroState(h=>({...h,health:hHp}));
    if(hHp<=0) endCombat("dead");
    else if(remaining.length===0) endCombat("won",updatedMons);
  };

  const useWand=(wand)=>{
    const comps=MAGIC_COMPS[wand.magicType]||[];
    const lines=[];
    let wonCombat=false;
    setMons(prev=>{
      const alive=prev.filter(m=>m.health>0);
      if(!alive.length) return prev;
      const target=alive.reduce((a,b)=>b.health<a.health?b:a);
      const next=prev.map(m=>{
        if(m.uid!==target.uid) return m;
        let nm={...m};
        if(comps.includes("fire")){const d=rng(1,5);nm.health=Math.max(0,nm.health-d);lines.push(`${wand.name}: ${d} fire dmg on ${nm.name}.`);}
        if(comps.includes("lightning")){const d=rng(1,3);nm.skill=Math.max(1,nm.skill-d);lines.push(`${wand.name}: -${d} skill on ${nm.name}.`);}
        if(comps.includes("iron")){const d=rng(1,3);nm.strength=Math.max(1,nm.strength-d);lines.push(`${wand.name}: -${d} str on ${nm.name}.`);}
        if(comps.includes("dark")){const d=rng(1,5)*10;nm.health=Math.max(0,nm.health-d);lines.push(`${wand.name}: ${d} dark dmg on ${nm.name}.`);}
        if(comps.includes("crystal")){const d=rng(1,3)*10;nm.strength=Math.max(1,nm.strength-d);lines.push(`${wand.name}: -${d} str on ${nm.name}.`);}
        if(comps.includes("shadow")){const d=rng(1,3)*10;nm.skill=Math.max(1,nm.skill-d);lines.push(`${wand.name}: -${d} skill on ${nm.name}.`);}
        return nm;
      });
      // A wand only ends the fight once every monster in the group is
      // down — checking just the struck target let killing the first of
      // several monsters jump straight to the victory screen.
      wonCombat=next.every(m=>m.health<=0);
      return next;
    });
    setHeroState(h=>{
      const cur=h.inventory.find(i=>i.uid===wand.uid);
      if(!cur) return h;
      const uses=(cur.uses||0)+1;
      const breaks=uses>5&&Math.random()<0.5;
      if(breaks){lines.push(`${wand.name} sputters and loses its power!`);return{...h,inventory:h.inventory.filter(i=>i.uid!==wand.uid)};}
      if(uses===5) lines.push(`${wand.name} flickers — further uses may destroy it.`);
      return{...h,inventory:h.inventory.map(i=>i.uid===wand.uid?{...i,uses}:i)};
    });
    setTimeout(()=>{lines.forEach(addCombatLog);if(wonCombat)endCombat("won");},0);
  };

  const usePotion=(pot)=>{
    const comps=MAGIC_COMPS[pot.magicType]||[];
    const reverts={};
    setHeroState(h=>{
      let nh={...h};
      if(comps.includes("fire")){const d=rng(1,5);reverts.health=h.health;nh.health=h.health+d;addCombatLog(`${pot.name}: +${d} health.`);}
      if(comps.includes("lightning")){const d=rng(1,5);reverts.baseSkill=h.baseSkill;nh.baseSkill=h.baseSkill+d;addCombatLog(`${pot.name}: +${d} skill.`);}
      if(comps.includes("iron")){const d=rng(1,5);reverts.baseStrength=h.baseStrength;nh.baseStrength=h.baseStrength+d;addCombatLog(`${pot.name}: +${d} strength.`);}
      if(comps.includes("dark")){const d=rng(1,5)*10;reverts.health=h.health;nh.health=h.health+d;addCombatLog(`${pot.name}: +${d} health.`);}
      if(comps.includes("crystal")){const d=rng(1,5);nh.baseStrength=h.baseStrength+d;addCombatLog(`${pot.name}: +${d} strength (permanent).`);}
      if(comps.includes("shadow")){const d=rng(1,5);nh.baseSkill=h.baseSkill+d;addCombatLog(`${pot.name}: +${d} skill (permanent).`);}
      nh.inventory=h.inventory.filter(i=>i.id!==pot.id);
      return nh;
    });
    setPotionReverts(r=>({...r,...reverts}));
  };

  const hHpPct=clamp(heroState.health,0,100);
  const living=mons.filter(m=>m.health>0);
  const allSlots=[initMonsters[0],initMonsters[1],initMonsters[2],initMonsters[3]];
  const PIC=72;

  return(
    <div style={{position:"fixed",inset:0,background:"#000d",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",maxWidth:540,width:"95%",maxHeight:"96vh",display:"flex",flexDirection:"column"}}>
        <div style={{background:"#150f08",borderBottom:`1px solid ${C.border}`,padding:"5px 14px",textAlign:"center",color:C.gold,fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",flexShrink:0}}>
          ⚔ {initMonsters.length > 1?`${initMonsters.length}-Way Encounter`:"Encounter"}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,padding:"6px 8px",flexShrink:0}}>
          {allSlots.map((orig,i)=>{
            if(!orig) return <div key={i}/>;
            const live=mons.find(m=>m.uid===orig.uid);
            const isDead=!live||live.health<=0;
            return(
              <div key={orig.uid} style={{background:"#100c08",border:`1px solid ${isDead?"#2a2010":C.border}`,borderRadius:5,padding:"4px 6px 5px",opacity:isDead?0.35:1,transition:"opacity 0.4s"}}>
                <div style={{color:isDead?"#555":C.gold,fontSize:9,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:3,textAlign:"center",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  {isDead?"💀 Defeated":orig.name}
                </div>
                <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
                  {isCastle
                    ? <CourtierPortrait col={orig.col} row={orig.row} size={PIC}/>
                    : <MonsterPortrait col={orig.col} row={orig.row} size={PIC}/>}
                  <div style={{flex:1,minWidth:0,paddingTop:2}}>
                    {!isDead&&<>
                      <HpBar pct={live.health}/>
                      <div style={{fontSize:8,color:C.dim,marginTop:3,lineHeight:1.5}}>
                        <div>HP: {live.health}%</div>
                        <div>Str: {Math.round(eff(live.strength,live.health))}/{live.strength}</div>
                        <div>Skl: {live.skill} · Arm: {live.armour}</div>
                        <div>Atk×{live.attacks} · Lv{live.level}</div>
                      </div>
                    </>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{padding:"4px 10px",background:"#150f08",borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:2}}>
            <span style={{color:C.dim}}>Hero</span>
            <span style={{color:C.text}}>{heroState.health}% HP · Armour {armour}</span>
          </div>
          <HpBar pct={hHpPct}/>
          <div style={{fontSize:9,color:C.dim,marginTop:2}}>
            {atks.map((a,i)=><span key={i} style={{marginRight:8}}>⚔ {a.label} (+{a.bonus})</span>)}
            {ring&&<span style={{color:MAGIC_COLOR[ring.magicType]}}>💍 {ring.name}</span>}
          </div>
        </div>
        <div style={{flex:1,minHeight:40,overflowY:"auto",padding:"5px 10px",background:"#0d0a06"}}>
          {combatLog.map((l,i)=><div key={i} style={{fontSize:10,color:i===0?C.text:C.dim,marginBottom:1,lineHeight:1.35,opacity:Math.max(0.3,1-i*0.07)}}>{i===0?"▶ ":""}{l}</div>)}
        </div>
        <div style={{padding:"6px 10px 8px",borderTop:`1px solid ${C.border}`,flexShrink:0}}>
          {!done&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:5}}>
              {allSlots.map((orig,i)=>{
                if(!orig) return <div key={i}/>;
                const live=mons.find(m=>m.uid===orig.uid);
                const isDead=!live||live.health<=0;
                return(
                  <button key={orig.uid}
                    style={{...btnS(isDead?"#333":C.red,isDead),padding:"4px 6px",fontSize:10,opacity:isDead?0.4:1}}
                    disabled={isDead}
                    onClick={()=>!isDead&&doFight(orig.uid)}
                    onMouseEnter={e=>{if(!isDead){e.currentTarget.style.background=C.red;e.currentTarget.style.color="#fff";}}}
                    onMouseLeave={e=>{if(!isDead){e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.red;}}}>
                    {isDead?"💀 Slain":"⚔ Fight"}
                  </button>
                );
              })}
            </div>
            <CombatSlider val={sliderVal} onChange={moveSlider} baseStr={heroState.baseStrength} baseSkl={heroState.baseSkill} C={C}/>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center",marginTop:4}}>
              <button style={{...btnS(C.dim,false),padding:"4px 10px",fontSize:10}} onClick={()=>{if(Math.random()<0.75){endCombat("fled");}else{addCombatLog("Failed to flee!");doFight(living[0]?.uid);}}} onMouseEnter={e=>{e.currentTarget.style.background=C.dim;e.currentTarget.style.color=C.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.dim;}}>🏃 Flee (75%)</button>
              {wands.map(w=>{const uses=w.uses||0;const risky=uses>=5;return(<button key={w.uid||w.id} style={{...btnS(risky?"#e07030":MAGIC_COLOR[w.magicType],false),padding:"4px 8px",fontSize:10}} onClick={()=>useWand(w)} onMouseEnter={e=>{e.currentTarget.style.background=risky?"#e07030":MAGIC_COLOR[w.magicType];e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=risky?"#e07030":MAGIC_COLOR[w.magicType];}}>⚡ {w.name}{uses>0?` (${uses})`:""}</button>);})}
              {potions.map(p=>(<button key={p.id} style={{...btnS(MAGIC_COLOR[p.magicType],false),padding:"4px 8px",fontSize:10}} onClick={()=>usePotion(p)} onMouseEnter={e=>{e.currentTarget.style.background=MAGIC_COLOR[p.magicType];e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=MAGIC_COLOR[p.magicType];}}>🧪 {p.name}</button>))}
            </div>
          </>}
          {done==="won"&&loot&&<ItemPickupPanel mode="victory" loot={loot} inventory={heroState.inventory||[]} equipped={heroState.equipped||{}} INV_MAX={INV_MAX} setHeroState={setHeroState} doEquipWeapon={doEquipWeapon} groundItems={groundItems} setGroundItems={setGroundItems} heroPos={heroPos} onDismiss={()=>{addLog(`Victory over ${initMonsters.length} enemies! +${loot.gold}g${loot.items.length?", "+loot.items.map(i=>i.name).join(", "):""}.`);onVictory();}}/>}
          {done==="fled"&&<div style={{textAlign:"center"}}><div style={{color:C.dim,fontSize:13,marginBottom:8}}>You flee into the shadows.</div><button style={btnS(C.gold,false)} onClick={onFlee} onMouseEnter={e=>{e.currentTarget.style.background=C.gold;e.currentTarget.style.color=C.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.gold;}}>Continue</button></div>}
          {done==="dead"&&<div style={{textAlign:"center"}}><div style={{color:C.red,fontSize:14,marginBottom:8}}>💀 You have fallen.</div><button style={btnS(C.red,false)} onClick={onDefeat} onMouseEnter={e=>{e.currentTarget.style.background=C.red;e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.red;}}>Game Over</button></div>}
        </div>
      </div>
    </div>
  );
}

// ── Shop dialogues ────────────────────────────────────────────────────────────
function TavernDialogue({building,heroState,setHeroState,saves,saveMsg,onSaveGame,onLoadGame,onDeleteSave,onDismiss}){
  const [tab,setTab]=useState("buy");
  const inv=heroState.inventory||[];
  const eat=(food)=>{
    const idx=inv.findIndex(i=>i.id===food.id&&i.type==="food");
    if(idx===-1) return;
    const gained=Math.min(food.heal,100-heroState.health);
    setHeroState(h=>({...h,health:clamp(h.health+food.heal,0,100),inventory:h.inventory.filter((_,i2)=>i2!==idx)}));
  };
  const buyFood=(food)=>{
    if(heroState.gold<food.price) return;
    setHeroState(h=>({...h,gold:h.gold-food.price,inventory:[...h.inventory,{...food,uid:Date.now()+Math.random(),type:"food"}]}));
  };
  const buyBoard=()=>{
    if(heroState.health===100) return;
    setHeroState(h=>({...h,health:100}));
  };
  const foodInInv=(food)=>inv.filter(i=>i.id===food.id&&i.type==="food").length;
  return(
    <div style={{position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.panel,border:`2px solid ${building.color}55`,borderRadius:10,overflow:"hidden",maxWidth:440,width:"95%",maxHeight:"88vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,background:"#120f07",flexShrink:0,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:28}}>🍺</span>
          <div>
            <div style={{color:C.gold,fontSize:15,letterSpacing:"0.1em",textTransform:"uppercase"}}>{building.name}</div>
            <div style={{color:C.dim,fontSize:11}}>Gold: <span style={{color:C.gold}}>{heroState.gold}g</span> · Health: <span style={{color:heroState.health>60?"#2d8a4e":heroState.health>25?"#c9a02b":"#c0392b"}}>{heroState.health}%</span></div>
          </div>
          <button style={{...btnS(C.dim,false),marginLeft:"auto"}} onClick={onDismiss} onMouseEnter={e=>{e.currentTarget.style.background=C.dim;e.currentTarget.style.color=C.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.dim;}}>Leave</button>
        </div>
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          {[["buy","🛒 Buy"],["board","🛏 Board"],["save","💾 Save"]].map(([t,l])=>(
            <div key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"8px",textAlign:"center",fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",color:tab===t?C.gold:C.dim,background:tab===t?C.panel:"#130f0a",borderBottom:tab===t?`2px solid ${C.gold}`:"2px solid transparent"}}>{l}</div>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 14px"}}>
          {false&&<>
          <div style={{color:C.dim,fontSize:11,fontStyle:"italic",marginTop:8}}>No food? Buy some in the Buy tab.</div></>}
          {tab==="buy"&&<>{FOOD.map(food=>{const can=heroState.gold>=food.price;return(<div key={food.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:5,borderRadius:4,background:can?"#1f1a11":"#130f0a",border:`1px solid ${C.border}`,opacity:can?1:0.5}}>
            <span style={{fontSize:16}}>{food.emoji}</span>
            <div style={{flex:1}}><div style={{fontSize:12,color:C.text}}>{food.name}</div><div style={{fontSize:10,color:C.dim}}>+{food.heal}% health</div></div>
            <span style={{fontSize:12,color:C.gold}}>{food.price}g</span>
            <button style={btnS(C.gold,!can)} disabled={!can} onClick={()=>buyFood(food)} onMouseEnter={e=>{if(can){e.currentTarget.style.background=C.gold;e.currentTarget.style.color=C.bg;}}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=can?C.gold:"#444";}}>Buy</button>
          </div>);})}
          </>}
          {tab==="board"&&<div style={{padding:"8px 0"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px",background:"#1f1a11",border:`1px solid ${C.border}`,borderRadius:4,marginBottom:12}}>
              <span style={{fontSize:24}}>🛏</span>
              <div style={{flex:1}}><div style={{fontSize:13,color:C.text}}>Full Night's Board</div><div style={{fontSize:11,color:C.dim}}>Warm bed & hearty breakfast. Restores health to 100%.</div></div>
              <span style={{fontSize:12,color:C.green}}>Free</span>
              <button style={btnS(C.blue,heroState.health===100)} disabled={heroState.health===100} onClick={buyBoard} onMouseEnter={e=>{if(heroState.health<100){e.currentTarget.style.background=C.blue;e.currentTarget.style.color="#fff";}}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=heroState.health<100?C.blue:"#444";}}>Stay</button>
            </div>
            {heroState.health===100&&<div style={{color:C.dim,fontSize:11,fontStyle:"italic",textAlign:"center"}}>You are already at full health.</div>}
          {heroState.health<100&&<div style={{color:C.dim,fontSize:11,textAlign:"center",marginTop:6}}>Tonight's stay is complimentary.</div>}
          </div>}
          {tab==="save"&&<div style={{padding:"8px 0"}}>
            <div style={{fontSize:11,color:C.dim,marginBottom:14,fontStyle:"italic",textAlign:"center"}}>"Rest here, traveller. Your tale shall be remembered."</div>
            <button style={{...btnS(C.gold,false),padding:"10px",width:"100%"}} onClick={onSaveGame}
              onMouseEnter={e=>{e.currentTarget.style.background=C.gold;e.currentTarget.style.color=C.bg;}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.gold;}}>
              💾 Save Game
            </button>
            {saveMsg&&<div style={{marginTop:12,textAlign:"center",fontSize:12,
              color:saveMsg.startsWith("✓")?"#6fcf97":saveMsg.startsWith("✗")?C.red:C.dim,
              padding:"6px",background:"#0d0a06",borderRadius:4,border:`1px solid ${C.border}`}}>
              {saveMsg}
            </div>}
            <div style={{marginTop:16,color:C.dim,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>
              Load Game ({saves.length}/3)
            </div>
            {saves.length===0
              ? <div style={{fontSize:10,color:C.dim,fontStyle:"italic",textAlign:"center",padding:"8px 0"}}>No saved games found.</div>
              : [...saves].sort((a,b)=>b.timestamp-a.timestamp).map(entry=>(
                  <div key={entry.timestamp} style={{display:"flex",gap:6,marginBottom:6}}>
                    <button style={{...btnS(C.blue,false),padding:"8px 10px",flex:1,textAlign:"left"}}
                      onClick={()=>onLoadGame(entry)}
                      onMouseEnter={e=>{e.currentTarget.style.background=C.blue;e.currentTarget.style.color="#fff";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.blue;}}>
                      📂 {new Date(entry.timestamp).toLocaleString()}
                    </button>
                    <button title="Delete save" style={{...btnS(C.red,false),padding:"8px 10px",flexShrink:0}}
                      onClick={()=>onDeleteSave&&onDeleteSave(entry)}
                      onMouseEnter={e=>{e.currentTarget.style.background=C.red;e.currentTarget.style.color="#fff";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.red;}}>
                      ✕
                    </button>
                  </div>
                ))}
          </div>}
        </div>
      </div>
    </div>
  );
}

// ── Armourer Dialogue ─────────────────────────────────────────────────────────
function ArmourerDialogue({building,heroState,setHeroState,onDismiss}){
  const [tab,setTab]=useState("buy");
  const [notice,setNotice]=useState("");
  const notify=msg=>{setNotice(msg);setTimeout(()=>setNotice(""),2500);};
  const eq=heroState.equipped||{};
  const inv=heroState.inventory||[];
  // The Jolly Blacksmith stocks the cheap end (tiers 1-2); Alvin's Armoury
  // stocks the pricier end (tiers 3-4) — keeps the two armourers distinct
  // instead of both selling the same full catalogue.
  const ARMOURER_TIERS={jolly_smith:[1,2],alvin:[3,4]};
  const [minTier,maxTier]=ARMOURER_TIERS[building.id]||[1,5];
  const armourItems=[...WEAPONS,...ARMOUR_ITEMS].filter(i=>i.tier>=minTier&&i.tier<=maxTier);

  const buy=(item)=>{
    if(heroState.gold<item.cost) return;
    setHeroState(h=>({...h,gold:h.gold-item.cost,inventory:[...h.inventory,{...item,uid:Date.now()+Math.random()}]}));
  };
  const sell=(uid)=>{
    const item=inv.find(i=>i.uid===uid); if(!item) return;
    setHeroState(h=>({...h,gold:h.gold+sellPrice(item),inventory:h.inventory.filter(i=>i.uid!==uid)}));
  };
  const equip=(item)=>{
    if(WEAPONS.find(w=>w.id===item.id)){
      const {newEq,toInv,msg}=doEquipWeapon(item,eq);
      setHeroState(h=>({...h,equipped:{...h.equipped,...newEq},inventory:[...h.inventory.filter(i=>i.uid!==item.uid),...toInv]}));
      notify(msg);
    } else {
      const slot=item.slot==="left_shield"?"left_hand":item.slot;
      if(slot==="left_hand"&&eq.right_hand?.twoHanded){notify("Remove Great Sword first.");return;}
      const old=eq[slot];
      const strDelta=armourStrBonus(item)-armourStrBonus(old);
      const sklDelta=armourSklBonus(item)-armourSklBonus(old);
      setHeroState(h=>({...h,baseStrength:h.baseStrength+strDelta,baseSkill:h.baseSkill+sklDelta,equipped:{...h.equipped,[slot]:item},inventory:[...h.inventory.filter(i=>i.uid!==item.uid),...(old?[old]:[])]}));
    }
  };
  const unequip=(slot)=>{
    const item=eq[slot]; if(!item) return;
    if(item.twoHanded){
      setHeroState(h=>({...h,equipped:{...h.equipped,right_hand:null,left_hand:null},inventory:[...h.inventory,item]}));
    } else if(slot==="right_hand"){
      const lh=eq.left_hand;
      setHeroState(h=>({...h,equipped:{...h.equipped,right_hand:lh||null,left_hand:null},inventory:[...h.inventory,item]}));
    } else {
      setHeroState(h=>({...h,baseStrength:h.baseStrength-armourStrBonus(item),baseSkill:h.baseSkill-armourSklBonus(item),equipped:{...h.equipped,[slot]:null},inventory:[...h.inventory,item]}));
    }
  };
  const SLOT_LABELS={head:"Head",body:"Body",right_hand:"Right Hand",left_hand:"Left Hand",feet:"Feet"};
  return(
    <div style={{position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.panel,border:`2px solid ${building.color}55`,borderRadius:10,overflow:"hidden",maxWidth:500,width:"95%",maxHeight:"88vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,background:"#120f07",flexShrink:0,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:28}}>⚔</span>
          <div><div style={{color:C.gold,fontSize:15,letterSpacing:"0.1em",textTransform:"uppercase"}}>{building.name}</div><div style={{color:C.dim,fontSize:11}}>Gold: <span style={{color:C.gold}}>{heroState.gold}g</span> · Inv: <span style={{color:(heroState.inventory||[]).length>=INV_MAX?C.red:C.dim}}>{(heroState.inventory||[]).length}/{INV_MAX}</span></div></div>
          <button style={{...btnS(C.dim,false),marginLeft:"auto"}} onClick={onDismiss} onMouseEnter={e=>{e.currentTarget.style.background=C.dim;e.currentTarget.style.color=C.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.dim;}}>Leave</button>
        </div>
        {notice&&<div style={{background:"#1a0e0e",borderBottom:`1px solid ${C.red}`,padding:"6px 14px",fontSize:11,color:"#e07070",flexShrink:0}}>⚠ {notice}</div>}
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          {[["buy","🛒 Buy"],["inv","🎒 Inventory"],["eq","🛡 Equipped"]].map(([t,l])=>(
            <div key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"7px",textAlign:"center",fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",color:tab===t?C.gold:C.dim,background:tab===t?C.panel:"#130f0a",borderBottom:tab===t?`2px solid ${C.gold}`:"2px solid transparent"}}>{l}</div>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"10px 12px"}}>
          {tab==="buy"&&armourItems.map(item=>{const can=heroState.gold>=item.cost;return(
            <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 9px",marginBottom:5,borderRadius:3,background:can?"#1f1a11":"#130f0a",border:`1px solid ${C.border}`,opacity:can?1:0.5}}>
              <div style={{flex:1}}><div style={{fontSize:11,color:C.text}}>{item.name}</div><div style={{fontSize:9,color:C.dim}}>{item.strBonus!=null?`+${item.strBonus} str`:``}{item.armourBonus!=null?`+${item.armourBonus} armour`:``}{item.twoHanded?" · both hands":""}</div></div>
              <span style={{fontSize:11,color:C.gold}}>{item.cost}g</span>
              <button style={{...btnS(C.gold,!can),padding:"4px 10px",fontSize:10}} disabled={!can} onClick={()=>buy(item)} onMouseEnter={e=>{if(can){e.currentTarget.style.background=C.gold;e.currentTarget.style.color=C.bg;}}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=can?C.gold:"#444";}}>Buy</button>
            </div>);})}
          {tab==="inv"&&(inv.filter(i=>i.type!=="magic").length===0?<div style={{color:C.dim,fontStyle:"italic",fontSize:12,padding:"10px 0"}}>Inventory empty.</div>:
            inv.filter(i=>i.type!=="magic").map(item=>(
              <div key={item.uid} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 9px",marginBottom:5,borderRadius:3,background:"#1f1a11",border:`1px solid ${C.border}`}}>
                <span style={{fontSize:11,color:C.text,flex:1}}>{item.name}</span>
                {item.type==="food"?<>
                  <button style={{...btnS(C.green,false),padding:"3px 8px",fontSize:9}} onClick={()=>{const gained=Math.min(item.heal,100-heroState.health);setHeroState(h=>({...h,health:Math.min(100,h.health+item.heal),inventory:h.inventory.filter(i2=>i2.uid!==item.uid)}));}} onMouseEnter={e=>{e.currentTarget.style.background=C.green;e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.green;}}>Eat</button>
                  <button style={{...btnS(C.dim,false),padding:"3px 8px",fontSize:9}} onClick={()=>setHeroState(h=>({...h,inventory:h.inventory.filter(i2=>i2.uid!==item.uid)}))} onMouseEnter={e=>{e.currentTarget.style.background=C.dim;e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.dim;}}>Drop</button>
                </>:<>
                  <button style={{...btnS(C.green,false),padding:"3px 8px",fontSize:9}} onClick={()=>equip(item)} onMouseEnter={e=>{e.currentTarget.style.background=C.green;e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.green;}}>Equip</button>
                  <button style={{...btnS("#7a6234",false),padding:"3px 8px",fontSize:9}} onClick={()=>sell(item.uid)} onMouseEnter={e=>{e.currentTarget.style.background="#7a6234";e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#7a6234";}}>{sellPrice(item)}g</button>
                </>}
              </div>)))}
          {tab==="eq"&&Object.entries(SLOT_LABELS).map(([slot,label])=>{const item=eq[slot];const isGS=item?.twoHanded&&slot==="left_hand";return(
            <div key={slot} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 9px",marginBottom:5,borderRadius:3,background:"#1a1510",border:`1px solid ${C.border}`}}>
              <span style={{fontSize:10,color:C.dim,width:70,flexShrink:0}}>{label}</span>
              <span style={{fontSize:11,color:item?C.text:"#3a3020",flex:1}}>{isGS?"— (Great Sword)":item?item.name:"—"}</span>
              {item&&!isGS&&<><button style={{...btnS(C.dim,false),padding:"2px 7px",fontSize:9}} onClick={()=>unequip(slot)} onMouseEnter={e=>{e.currentTarget.style.background=C.dim;e.currentTarget.style.color=C.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.dim;}}>Un</button>
              <button style={{...btnS("#7a6234",false),padding:"2px 7px",fontSize:9}} onClick={()=>{unequip(slot);sell(item.uid);}} onMouseEnter={e=>{e.currentTarget.style.background="#7a6234";e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#7a6234";}}>{sellPrice(item)}g</button></>}
            </div>);})}
        </div>
      </div>
    </div>
  );
}

// ── Magic Shop Dialogue ───────────────────────────────────────────────────────
function MagicShopDialogue({building,heroState,setHeroState,hasMap,setHasMap,onDismiss}){
  const [tab,setTab]=useState("buy");
  const inv=heroState.inventory||[];
  const eq=heroState.equipped||{};
  const [scrollMsg,setScrollMsg]=useState(null);
  const buy=(form,type)=>{
    const price=MAGIC_BASE[form]*MAGIC_MULT[type];
    if(heroState.gold<price) return;
    const inv=heroState.inventory||[];
    const eq=heroState.equipped||{};
    const isRing=form==="ring";
    const noRingEquipped=!eq.finger;
    // Block purchase if inventory full, unless it's a ring and slot is empty
    if(inv.length>=INV_MAX&&!(isRing&&noRingEquipped)) return;
    const item={...magicItem(type,form,`magic_${Date.now()}_${Math.random()}`),uid:Date.now()+Math.random()};
    if(isRing&&noRingEquipped){
      // Equip immediately, don't add to inventory
      setHeroState(h=>({...h,gold:h.gold-price,equipped:{...h.equipped,finger:item}}));
    } else {
      setHeroState(h=>({...h,gold:h.gold-price,inventory:[...h.inventory,item]}));
    }
  };
  const equipRing=(item)=>{
    const old=eq.finger;
    setHeroState(h=>({...h,equipped:{...h.equipped,finger:item},inventory:[...h.inventory.filter(i=>i.id!==item.id),...(old?[old]:[])]}));
  };
  const sell=(item)=>{
    setHeroState(h=>({...h,gold:h.gold+sellPrice(item),inventory:h.inventory.filter(i=>i.id!==item.id)}));
  };
  const MAGIC_DESC={wand:{fire:"1–5 dmg",lightning:"−1–3 skill",iron:"−1–3 strength",green:"Fire+Iron",sun:"Lightning+Fire",frost:"Lightning+Iron",arcane:"All three"},
    potion:{fire:"+1–5 HP",lightning:"+1–5 skill",iron:"+1–5 str",green:"Fire+Iron",sun:"Lightning+Fire",frost:"Lightning+Iron",arcane:"All three"},
    ring:{fire:"Heal 1–3/rnd",lightning:"+1 attack/rnd",iron:"+5 armour",green:"Fire+Iron",sun:"Lightning+Fire",frost:"Lightning+Iron",arcane:"All three"}};
  return(
    <div style={{position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.panel,border:`2px solid ${building.color}55`,borderRadius:10,overflow:"hidden",maxWidth:460,width:"95%",maxHeight:"88vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,background:"#120f07",flexShrink:0,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:28}}>✦</span>
          <div><div style={{color:C.gold,fontSize:15,letterSpacing:"0.1em",textTransform:"uppercase"}}>{building.name}</div><div style={{color:C.dim,fontSize:11}}>Gold: <span style={{color:C.gold}}>{heroState.gold}g</span></div></div>
          <button style={{...btnS(C.dim,false),marginLeft:"auto"}} onClick={onDismiss} onMouseEnter={e=>{e.currentTarget.style.background=C.dim;e.currentTarget.style.color=C.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.dim;}}>Leave</button>
        </div>
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          {[["buy","🛒 Buy"],["inv","🎒 Inventory"]].map(([t,l])=>(
            <div key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"7px",textAlign:"center",fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",color:tab===t?C.gold:C.dim,background:tab===t?C.panel:"#130f0a",borderBottom:tab===t?`2px solid ${C.gold}`:"2px solid transparent"}}>{l}</div>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"10px 12px"}}>
          {tab==="buy"&&MAGIC_FORMS_LIST.map(form=><React.Fragment key={form}>
            <div style={{color:C.dim,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:5,marginTop:8}}>{"⚡🧪💍"[MAGIC_FORMS_LIST.indexOf(form)]} {form}s</div>
            {MAGIC_TYPES_LIST.filter(type=>magicTier(type,form)<=5).map(type=>{const price=MAGIC_BASE[form]*MAGIC_MULT[type];const can=heroState.gold>=price;return(
              <div key={type} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",marginBottom:4,borderRadius:3,background:can?"#1f1a11":"#130f0a",border:`1px solid ${C.border}`,opacity:can?1:0.5}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:MAGIC_COLOR[type],flexShrink:0}}/>
                <div style={{flex:1}}><span style={{fontSize:11,color:C.text}}>{type[0].toUpperCase()+type.slice(1)} {form} </span><span style={{fontSize:10,color:C.dim}}>· {MAGIC_DESC[form][type]}</span></div>
                <span style={{fontSize:11,color:C.gold,flexShrink:0}}>{price}g</span>
                {(()=>{
                const isRing=form==="ring";
                const noRingEquipped=!(heroState.equipped||{}).finger;
                const invFull2=(heroState.inventory||[]).length>=INV_MAX;
                const blocked=!can||(invFull2&&!(isRing&&noRingEquipped));
                const label=isRing&&noRingEquipped?"Equip":"Buy";
                return <button style={{...btnS(C.gold,blocked),padding:"3px 8px",fontSize:9}} disabled={blocked} onClick={()=>buy(form,type)} onMouseEnter={e=>{if(!blocked){e.currentTarget.style.background=C.gold;e.currentTarget.style.color=C.bg;}}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=blocked?"#444":C.gold;}}>{label}</button>;
              })()}
              </div>);})}
          </React.Fragment>)}
          {tab==="buy"&&<div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
            <div style={{color:C.dim,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>📜 mysterious items</div>
            {(()=>{
              const canBuy=heroState.gold>=50&&(heroState.inventory||[]).length<INV_MAX;
              return(
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",background:"#1a1208",borderRadius:5,marginBottom:4}}>
                  <div>
                    <span style={{color:"#c9a84c",fontSize:12}}>📜 Old Scroll</span>
                    <span style={{color:C.dim,fontSize:10,marginLeft:8}}>— 25% chance: treasure map</span>
                  </div>
                  <button style={{...btnS(canBuy?"#c9a84c":"#444",!canBuy),padding:"3px 10px",fontSize:10}}
                    onClick={()=>{
                      if(!canBuy)return;
                      const isTreasureMap=Math.random()<0.25;
                      if(isTreasureMap){
                        setHasMap(true);
                        setHeroState(h=>({...h,gold:h.gold-50}));
                        setScrollMsg("🗺 The scroll reveals itself as a Treasure Map! All ground items glow!");
                      } else {
                        setHeroState(h=>({...h,gold:h.gold-50,inventory:[...h.inventory,
                          {id:`scroll_${Date.now()}`,uid:`scroll_${Date.now()}`,name:"Old Scroll",type:"misc",value:2,cost:2}]}));
                        setScrollMsg("📜 Just an old scroll. Worthless.");
                      }
                      setTimeout(()=>setScrollMsg(null),2500);
                    }}
                    onMouseEnter={e=>{if(canBuy){e.currentTarget.style.background="#c9a84c";e.currentTarget.style.color="#0d1117";}}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=canBuy?"#c9a84c":"#444";}}>
                    50g
                  </button>
                </div>
              );
            })()}
            {scrollMsg&&<div style={{color:"#c9a84c",fontSize:11,fontStyle:"italic",marginTop:6,textAlign:"center"}}>{scrollMsg}</div>}
          </div>}
          {tab==="inv"&&(inv.filter(i=>i.type==="magic").length===0?<div style={{color:C.dim,fontStyle:"italic",fontSize:12,padding:"10px 0"}}>No magic items.</div>:
            inv.filter(i=>i.type==="magic").map(item=>(
              <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 9px",marginBottom:5,borderRadius:3,background:"#1f1a11",border:`1px solid ${C.border}`}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:item.color,flexShrink:0}}/>
                <span style={{fontSize:11,color:item.color,flex:1}}>{item.name}</span>
                {item.form==="ring"&&<button style={{...btnS("#9b59b6",false),padding:"3px 8px",fontSize:9}} onClick={()=>equipRing(item)} onMouseEnter={e=>{e.currentTarget.style.background="#9b59b6";e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#9b59b6";}}>Equip</button>}
                <button style={{...btnS("#7a6234",false),padding:"3px 8px",fontSize:9}} onClick={()=>sell(item)} onMouseEnter={e=>{e.currentTarget.style.background="#7a6234";e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#7a6234";}}>{sellPrice(item)}g</button>
              </div>)))}
        </div>
      </div>
    </div>
  );
}

// ── Castle Dialogue ───────────────────────────────────────────────────────────
function CastleDialogue({heroState,onDismiss,onEnter,onWin}){
  const candles=heroState.candles||0;
  const canEnter=candles>=50;
  return(
    <div style={{position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:"#12101a",border:"2px solid #9b59b6",borderRadius:10,padding:24,maxWidth:420,width:"95%",textAlign:"center",boxShadow:"0 0 40px #9b59b644"}}>
        <div style={{fontSize:40,marginBottom:8}}>🏰</div>
        <div style={{color:"#9b59b6",fontSize:18,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>The Castle Gates</div>
        {canEnter?<>
          <div style={{background:"#1a1030",border:"1px solid #9b59b6",borderRadius:6,padding:"12px 14px",marginBottom:16,fontSize:13,lineHeight:1.8,color:"#d4c8e8",fontStyle:"italic"}}>
            "You have the candles for the Warlock's birthday? Amazing! Come on in! You might be able to help with our other problem…"
          </div>
          <div style={{color:"#6fcf97",fontSize:12,marginBottom:16}}>🕯 {candles} / 50 candles — all collected!</div>
          <button style={{...btnS("#9b59b6",false),padding:"12px 28px",fontSize:14}} onClick={onEnter}
            onMouseEnter={e=>{e.currentTarget.style.background="#9b59b6";e.currentTarget.style.color="#fff";}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#9b59b6";}}>
            Enter the Castle
          </button>
        </>:<>
          <div style={{background:"#1a1208",border:`1px solid ${C.border}`,borderRadius:6,padding:"12px 14px",marginBottom:16,fontSize:13,lineHeight:1.8,color:"#c8b89a",fontStyle:"italic"}}>
            "Oh terrific, that's all we need. A time-waster! Go away and don't come back unless you've got the candles!"
          </div>
          <div style={{color:C.dim,fontSize:12,marginBottom:16}}>🕯 {candles} / 50 candles</div>
          <button style={btnS(C.dim,false)} onClick={onDismiss}
            onMouseEnter={e=>{e.currentTarget.style.background=C.dim;e.currentTarget.style.color=C.bg;}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.dim;}}>
            Slink away
          </button>
        </>}
      </div>
    </div>
  );
}

// ── Merchant Dialogue ─────────────────────────────────────────────────────────
function MerchantDialogue({stock,setStock,heroState,setHeroState,groundItems,setGroundItems,heroPos,onDismiss}){
  const [tab,setTab]=useState("buy");
  const inv=heroState.inventory||[];
  const buy=(item)=>{
    if(heroState.gold<item.price&&heroState.gold<item.cost) return;
    const price=item.price||item.cost;
    setHeroState(h=>({...h,gold:h.gold-price,inventory:[...h.inventory,{...item,uid:Date.now()+Math.random()}]}));
    setStock(s=>s.filter(i=>i.uid!==item.uid));
  };
  // Deterministic ±40% variance (seeded off the item's own uid/id) so the
  // displayed offer and the price actually paid on click always match.
  const merchantSellPrice=(item)=>{
    const seed=String(item.uid??item.id??item.name);
    let h=0;
    for(let i=0;i<seed.length;i++) h=(Math.imul(31,h)+seed.charCodeAt(i))|0;
    const variance=0.6+((h>>>0)%1000)/1000*0.8; // 0.6..1.4
    return Math.max(1,Math.round(sellPrice(item)*variance));
  };
  const sell=(item)=>{
    const sp=merchantSellPrice(item);
    setHeroState(h=>({...h,gold:h.gold+sp,inventory:h.inventory.filter(i=>(i.uid||i.id)!==(item.uid||item.id))}));
  };
  const dropItem=(item)=>{
    if(heroPos&&setGroundItems){
      const key=`${heroPos.x},${heroPos.y}`;
      setGroundItems(g=>({...g,[key]:[...(g[key]||[]),item]}));
    }
    setHeroState(h=>({...h,inventory:h.inventory.filter(i=>(i.uid||i.id)!==(item.uid||item.id))}));
  };
  const TYPE_ICON={food:"🍺",weapon:"⚔",armour:"🛡",magic:"✦"};
  return(
    <div style={{position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.panel,border:"1px solid #8B6914",borderRadius:10,overflow:"hidden",maxWidth:460,width:"95%",maxHeight:"88vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,background:"#120f07",flexShrink:0,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:28}}>🧳</span>
          <div><div style={{color:C.gold,fontSize:15,letterSpacing:"0.1em",textTransform:"uppercase"}}>Wandering Merchant</div><div style={{color:C.dim,fontSize:11,fontStyle:"italic"}}>"Fine wares, traveller!"</div></div>
          <div style={{marginLeft:"auto",textAlign:"right"}}><div style={{color:C.dim,fontSize:10}}>Gold</div><div style={{color:C.gold,fontSize:15,fontWeight:"bold"}}>{heroState.gold}g</div></div>
        </div>
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          {[["buy","🛒 Buy"],["sell","💰 Sell"],["equip","⚔ Equip"]].map(([t,l])=>(
            <div key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"7px",textAlign:"center",fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",color:tab===t?C.gold:C.dim,background:tab===t?C.panel:"#130f0a",borderBottom:tab===t?`2px solid ${C.gold}`:"2px solid transparent"}}>{l}</div>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"10px 12px"}}>
          {tab==="buy"&&(stock.length===0?<div style={{color:C.dim,fontStyle:"italic",fontSize:12,padding:10}}>Sold out!</div>:
            stock.map(item=>{const price=item.price||item.cost;const can=heroState.gold>=price;const col=item.type==="magic"?(item.color||"#9b59b6"):"#e8dcc8";return(
              <div key={item.uid} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:5,borderRadius:4,background:can?"#1f1a11":"#130f0a",border:`1px solid ${C.border}`,opacity:can?1:0.5}}>
                <span style={{fontSize:14}}>{item.emoji||TYPE_ICON[item.type]||"•"}</span>
                <div style={{flex:1}}><div style={{fontSize:11,color:col}}>{item.name}</div><div style={{fontSize:9,color:C.dim}}>{item.desc||(item.heal?`+${item.heal}% HP`:"")}</div></div>
                <span style={{fontSize:11,color:C.gold,flexShrink:0}}>{price}g</span>
                <button style={{...btnS(C.gold,!can),padding:"4px 10px",fontSize:10}} disabled={!can} onClick={()=>buy(item)} onMouseEnter={e=>{if(can){e.currentTarget.style.background=C.gold;e.currentTarget.style.color=C.bg;}}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=can?C.gold:"#444";}}>Buy</button>
              </div>);}))}
          {tab==="sell"&&(inv.length===0?<div style={{color:C.dim,fontStyle:"italic",fontSize:12,padding:10}}>Nothing to sell.</div>:
            inv.map((item,idx)=>(
              <div key={item.uid||idx} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:5,borderRadius:4,background:"#1f1a11",border:`1px solid ${C.border}`}}>
                <span style={{fontSize:14}}>{item.emoji||TYPE_ICON[item.type]||"•"}</span>
                <span style={{fontSize:11,color:C.text,flex:1}}>{item.name}</span>
                {item.type==="food"?<>
                  <button style={{...btnS(C.green,false),padding:"4px 10px",fontSize:10}} onClick={()=>setHeroState(h=>({...h,health:Math.min(100,h.health+(item.heal||0)),inventory:h.inventory.filter(i2=>(i2.uid||i2.id)!==(item.uid||item.id))}))} onMouseEnter={e=>{e.currentTarget.style.background=C.green;e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.green;}}>Eat</button>
                  <button style={{...btnS(C.dim,false),padding:"4px 10px",fontSize:10}} onClick={()=>dropItem(item)} onMouseEnter={e=>{e.currentTarget.style.background=C.dim;e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.dim;}}>Drop</button>
                </>:<>
                  <button style={{...btnS("#7a6234",false),padding:"4px 10px",fontSize:10}} onClick={()=>sell(item)} onMouseEnter={e=>{e.currentTarget.style.background="#7a6234";e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#7a6234";}}>{merchantSellPrice(item)}g</button>
                  <button style={{...btnS(C.dim,false),padding:"4px 8px",fontSize:10}} onClick={()=>dropItem(item)} onMouseEnter={e=>{e.currentTarget.style.background=C.dim;e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.dim;}}>Drop</button>
                    </>
		}
              </div>)))}
        </div>
        {tab==="equip"&&<div style={{padding:"4px 0"}}>
          {/* Equipped slots */}
          <div style={{marginBottom:8}}>
            <div style={{color:C.gold,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:5}}>Equipped</div>
            {Object.entries({head:"Head",body:"Body",right_hand:"Right",left_hand:"Left",finger:"Ring",feet:"Feet"}).map(([slot,label])=>{
              const eq=heroState.equipped||{};
              const item=eq[slot];
              const isGS=item?.twoHanded&&slot==="left_hand";
              return(
                <div key={slot} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 6px",marginBottom:3,borderRadius:3,background:"#1f1a11",border:`1px solid ${C.border}`}}>
                  <span style={{fontSize:10,color:C.dim,width:36,flexShrink:0}}>{label}</span>
                  <span style={{fontSize:10,color:item?C.text:"#3a3020",flex:1}}>{isGS?"(off-hand)":item?item.name:"—"}</span>
                  {item&&!isGS&&<button style={{fontSize:8,padding:"1px 6px",background:"transparent",border:`1px solid ${C.red}`,color:C.red,cursor:"pointer",borderRadius:2}}
                    onClick={()=>setHeroState(h=>({...h,
                      equipped:{...h.equipped,[slot]:null},
                      inventory:[...h.inventory,item]}))}>Unequip</button>}
                </div>
              );
            })}
          </div>
          {/* Inventory equippable items */}
          <div>
            <div style={{color:C.gold,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:5}}>Inventory</div>
            {(heroState.inventory||[]).filter(i=>i.type!=="food").length===0
              &&<div style={{color:C.dim,fontSize:11,fontStyle:"italic"}}>No equippable items.</div>}
            {(heroState.inventory||[]).filter(i=>i.type!=="food").map((item,i)=>{
              const inv=heroState.inventory||[];
              const realIdx=inv.indexOf(item);
              return(
                <div key={item.uid||i} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 6px",marginBottom:3,borderRadius:3,background:"#1f1a11",border:`1px solid ${C.border}`}}>
                  <span style={{fontSize:10,color:item.type==="magic"?(item.color||"#9b59b6"):item.strBonus!=null?"#e74c3c":"#7f8c8d",flex:1}}>{item.name}</span>
                  {(item.strBonus!=null||item.armourBonus!=null)&&<button style={{fontSize:8,padding:"1px 6px",background:"transparent",border:`1px solid ${C.green}`,color:C.green,cursor:"pointer",borderRadius:2}}
                    onClick={()=>{
                      const eq=heroState.equipped||{};
                      if(item.armourBonus==null&&item.strBonus!=null){
                        const{newEq,toInv}=doEquipWeapon(item,eq);
                        setHeroState(h=>({...h,equipped:{...h.equipped,...newEq},inventory:[...h.inventory.filter((_,j)=>j!==realIdx),...toInv]}));
                      } else {
                        const slot=item.slot==="left_shield"?"left_hand":item.slot;
                        const old=eq[slot];
                        const strDelta=armourStrBonus(item)-armourStrBonus(old);
                        const sklDelta=armourSklBonus(item)-armourSklBonus(old);
                        setHeroState(h=>({...h,baseStrength:h.baseStrength+strDelta,baseSkill:h.baseSkill+sklDelta,equipped:{...h.equipped,[slot]:item},inventory:[...h.inventory.filter((_,j)=>j!==realIdx),...(old?[old]:[])]}));
                      }
                    }}>Equip</button>}
                  {item.type==="magic"&&item.form==="ring"&&<button style={{fontSize:8,padding:"1px 6px",background:"transparent",border:`1px solid #9b59b6`,color:"#9b59b6",cursor:"pointer",borderRadius:2}}
                    onClick={()=>{
                      const old=(heroState.equipped||{}).finger;
                      setHeroState(h=>({...h,equipped:{...h.equipped,finger:item},inventory:[...h.inventory.filter((_,j)=>j!==realIdx),...(old?[old]:[])]}));
                    }}>Wear</button>}
                  <button style={{fontSize:8,padding:"1px 6px",background:"transparent",border:`1px solid ${C.dim}`,color:C.dim,cursor:"pointer",borderRadius:2}}
                    onClick={()=>setHeroState(h=>({...h,inventory:h.inventory.filter((_,j)=>j!==realIdx)}))}>Drop</button>
                </div>
              );
            })}
          </div>
        </div>}
        <div style={{padding:"10px 12px",borderTop:`1px solid ${C.border}`,flexShrink:0,display:"flex",justifyContent:"flex-end"}}>
          <button style={btnS(C.dim,false)} onClick={onDismiss} onMouseEnter={e=>{e.currentTarget.style.background=C.dim;e.currentTarget.style.color=C.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.dim;}}>Move On</button>
        </div>
      </div>
    </div>
  );
}



// ── Arena Dialogue ────────────────────────────────────────────────────────────
function ArenaDialogue({heroState,setHeroState,onDismiss,addLog}){

  function makeChallenger(maxLevel){
    // Pick a random monster at or below maxLevel
    const pool=M_LEVELS.map((l,i)=>({i,l})).filter(({l})=>l<=maxLevel&&l>=1);
    const pick=pool.length?pool[rng(0,pool.length-1)]:{i:rng(0,99)};
    const idx=pick.i;
    return {idx,name:M_NAMES[idx],col:idx%10,row:Math.floor(idx/10),
      health:100,maxHealth:100,strength:M_STATS[idx][0],skill:M_STATS[idx][1],
      armour:M_STATS[idx][2],attacks:M_ATTACKS[idx],level:M_LEVELS[idx]};
  }

  // Each slot tracks: current challenger + next level ceiling
  // Start: 5 challengers all level <10
  const [slots,setSlots]=useState(()=>
    Array.from({length:5},()=>({challenger:makeChallenger(9),nextCeiling:12}))
  );
  const [phase,setPhase]=useState("choose");
  const [fightSlot,setFightSlot]=useState(null);
  const [combatLog,setCombatLog]=useState([]);
  const [result,setResult]=useState(null);

  const goldPrize  = (mon)=>Math.round(5+mon.level*2+rng(0,mon.level));
  const goldPenalty= (mon)=>Math.round(3+mon.level+rng(0,5));

  const fightRound=(heroHp,monHp,mon,eq,armour)=>{
    const lines=[]; const ring=eq.finger;
    if(ring&&MAGIC_COMPS[ring.magicType]?.includes("fire")){
      const g=Math.min(1,100-heroHp);heroHp=Math.min(100,heroHp+1);
      if(g>0) lines.push(`Ring heals 1 HP.`);
    }
    const extraAtk=ring&&MAGIC_COMPS[ring.magicType]?.includes("lightning")?1:0;
    const atks=[...weaponAttacks(eq),...Array(extraAtk).fill({label:"Ring",bonus:0})];
    for(const atk of atks){
      if(monHp<=0) break;
      const hStr=eff(heroState.baseStrength+(atk.bonus||0),heroHp);
      const hSkl=eff(heroState.baseSkill,heroHp);
      const mSkl=eff(mon.skill,monHp);
      if(Math.random()<hitChance(hSkl,mSkl)){const d=randDmg(hStr,mon.armour);monHp=Math.max(0,monHp-d);lines.push(`${atk.label}: ${d} dmg.`);}
      else lines.push(`${atk.label}: miss.`);
    }
    if(monHp>0){
      const effAtks=effCeil(mon.attacks,monHp);
      for(let a=0;a<effAtks;a++){
        const mStr=eff(mon.strength,monHp);const mSkl=eff(mon.skill,monHp);const hSkl=eff(heroState.baseSkill,heroHp);
        if(Math.random()<hitChance(mSkl,hSkl)){const d=randDmg(mStr,armour);heroHp=Math.max(0,heroHp-d);lines.push(`${mon.name} hits: ${d} dmg.`);}
        else lines.push(`${mon.name} misses.`);
        if(heroHp<=0) break;
      }
    }
    return {heroHp,monHp,lines};
  };

  const startFight=(slotIdx)=>{
    const mon=slots[slotIdx].challenger;
    if(!mon) return;
    setFightSlot(slotIdx); setPhase("fighting");
    setCombatLog([`⚔ The crowd roars as you face the ${mon.name}!`]);

    const eq=heroState.equipped||{};
    const armour=totalArmour(eq,heroState.baseArmour||0);
    let heroHp=heroState.health,monHp=100;
    const allLines=[];

    for(let round=1;round<=50;round++){
      const {heroHp:hh,monHp:mh,lines}=fightRound(heroHp,monHp,mon,eq,armour);
      heroHp=hh; monHp=mh;
      allLines.push(`── Round ${round} ──`,...lines);
      if(heroHp<=0||monHp<=0) break;
    }

    if(monHp<=0){
      const prize=goldPrize(mon);
      setHeroState(h=>({...h,health:heroHp,gold:h.gold+prize}));
      allLines.push(`🏆 Victory! +${prize} gold.`);
      addLog(`Arena: defeated ${mon.name} for ${prize}g!`);

      // Replace defeated challenger with a harder one, capped at level 30
      // (never leaves the slot empty — it just stops escalating).
      setSlots(prev=>prev.map((s,i)=>{
        if(i!==slotIdx) return s;
        const newCeiling=Math.min(s.nextCeiling+3,30);
        return {challenger:makeChallenger(newCeiling), nextCeiling:newCeiling};
      }));
      setResult({outcome:"won",prize});
    } else {
      const penalty=Math.min(goldPenalty(mon),heroState.gold);
      setHeroState(h=>({...h,health:5,gold:Math.max(0,h.gold-penalty)}));
      allLines.push(`💀 Defeated! HP → 5%. -${penalty}g.`);
      addLog(`Arena: defeated by ${mon.name}. Lost ${penalty}g.`);
      setResult({outcome:"lost",penalty});
    }
    setCombatLog(allLines.reverse().slice(0,25));
    setPhase("result");
  };

  const heroLevel=Math.round((heroState.baseStrength+heroState.baseSkill)/2);

  return(
    <div style={{position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:"#1a0a0a",border:"2px solid #c0392b",borderRadius:10,overflow:"hidden",maxWidth:500,width:"95%",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>

        {/* Header */}
        <div style={{padding:"12px 16px",borderBottom:"1px solid #3d1818",background:"#120808",flexShrink:0,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:28}}>⚔</span>
          <div>
            <div style={{color:"#c0392b",fontSize:15,letterSpacing:"0.1em",textTransform:"uppercase"}}>The Arena</div>
            <div style={{color:C.dim,fontSize:11}}>Gold: <span style={{color:C.gold}}>{heroState.gold}g</span> · HP: <span style={{color:heroState.health>25?"#2d8a4e":"#c0392b"}}>{heroState.health}%</span></div>
          </div>
          {phase!=="fighting"&&<button style={{...btnS(C.dim,false),marginLeft:"auto"}} onClick={onDismiss} onMouseEnter={e=>{e.currentTarget.style.background=C.dim;e.currentTarget.style.color=C.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.dim;}}>Leave</button>}
        </div>

        {/* Choose phase */}
        {phase==="choose"&&<>
          <div style={{padding:"8px 14px",color:C.dim,fontSize:11,borderBottom:"1px solid #3d1818",flexShrink:0}}>
            Defeat challengers to earn gold. Each victory brings a harder replacement.
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"10px 12px"}}>
            {slots.map((slot,i)=>{
              const mon=slot.challenger;
              const diff=mon.level-heroLevel;
              const diffColor=diff>2?"#e74c3c":diff>0?"#c9a02b":diff<-2?"#2d8a4e":"#7a6a4a";
              const prize=goldPrize(mon); const penalty=goldPenalty(mon);
              return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 11px",marginBottom:6,borderRadius:5,background:"#1f0f0f",border:"1px solid #3d1818",cursor:"pointer"}}
                  onClick={()=>startFight(i)}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#c0392b";e.currentTarget.style.background="#2a1010";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#3d1818";e.currentTarget.style.background="#1f0f0f";}}>
                  <MonsterPortrait col={mon.col} row={mon.row} size={52}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:C.text}}>{mon.name}</div>
                    <div style={{fontSize:10,color:C.dim,marginTop:2}}>Str:{mon.strength} Skl:{mon.skill} Arm:{mon.armour} Atk:{mon.attacks}</div>
                    <div style={{fontSize:10,marginTop:1,color:diffColor}}>Lv {mon.level} ({diff>=0?"+":""}{diff} vs you)</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:11,color:C.green}}>+{prize}g win</div>
                    <div style={{fontSize:10,color:"#e07070"}}>−{penalty}g lose</div>
                    {slot.nextCeiling>=30&&<div style={{fontSize:9,color:"#7a3030"}}>Max difficulty</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </>}

        {/* Result phase */}
        {phase==="result"&&<>
          {result&&<div style={{padding:"10px 14px",background:result.outcome==="won"?"#0d2a1a":"#2a0d0d",borderBottom:"1px solid #3d1818",flexShrink:0,textAlign:"center",fontSize:13,color:result.outcome==="won"?"#6fcf97":"#e07070"}}>
            {result.outcome==="won"?`🏆 Victory! +${result.prize} gold.`:`💀 Defeated. HP → 5%. -${result.penalty} gold.`}
          </div>}
          <div style={{flex:1,overflowY:"auto",padding:"10px 14px"}}>
            {combatLog.map((l,i)=><div key={i} style={{fontSize:11,color:l.startsWith("──")?"#7a6234":i===0?C.text:C.dim,marginBottom:2}}>{l}</div>)}
          </div>
          <div style={{padding:"10px 14px",borderTop:"1px solid #3d1818",flexShrink:0,display:"flex",gap:8,justifyContent:"center"}}>
            <button style={btnS(C.red,false)} onClick={()=>{setPhase("choose");setResult(null);setFightSlot(null);setCombatLog([]);}} onMouseEnter={e=>{e.currentTarget.style.background=C.red;e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.red;}}>Fight Again</button>
            <button style={btnS(C.dim,false)} onClick={onDismiss} onMouseEnter={e=>{e.currentTarget.style.background=C.dim;e.currentTarget.style.color=C.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.dim;}}>Leave</button>
          </div>
        </>}
      </div>
    </div>
  );
}


// ── WIN / GAME OVER screens ───────────────────────────────────────────────────
function WinScreen({onContinue}){
  const [stage,setStage]=useState("message"); // "message" -> "video"
  const [videoEnded,setVideoEnded]=useState(false);
  return(
    <div style={{position:"fixed",inset:0,background:"#000e",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
      {stage==="message"&&
        <div style={{background:"#12101a",border:"2px solid #f1c40f",borderRadius:12,padding:32,maxWidth:440,width:"95%",textAlign:"center",boxShadow:"0 0 60px #f1c40f44"}}>
          <div style={{fontSize:60,marginBottom:12}}>🎂🕯🎉</div>
          <div style={{color:"#f1c40f",fontSize:22,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:12}}>Happy Birthday, Jon!</div>
          <div style={{color:"#e8d4b0",fontSize:14,lineHeight:1.8,marginBottom:20,fontStyle:"italic"}}>
            The dragon is defeated and your memory unclouds! You have gathered all 50 candles and brought them to the castle for your own birthday! The birthday celebration can begin! May your 50th year be full of adventure, wisdom, and treasure.
          </div>
          <div style={{fontSize:32,marginBottom:20}}>🐉 ⚔ 🏰</div>
          <button style={{padding:"10px 28px",background:"transparent",border:"1.5px solid #f1c40f",color:"#f1c40f",fontSize:13,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",borderRadius:3}}
            onClick={()=>setStage("video")}>
            Continue
          </button>
        </div>
      }
      {stage==="video"&&
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",maxWidth:"90%"}}>
          <video src={finalCelebration} autoPlay playsInline
            onEnded={()=>setVideoEnded(true)}
            style={{maxWidth:"100%",maxHeight:"80vh",objectFit:"contain",marginBottom:20}}/>
          {videoEnded&&
            <button style={{padding:"10px 28px",background:"transparent",border:"1.5px solid #f1c40f",color:"#f1c40f",fontSize:13,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",borderRadius:3}}
              onClick={onContinue}>
              Continue
            </button>
          }
        </div>
      }
    </div>
  );
}

function GameOverScreen({onRestart}){
  return(
    <div style={{position:"fixed",inset:0,background:"#000e",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
      <div style={{background:"#1a0505",border:"2px solid #c0392b",borderRadius:10,padding:28,maxWidth:340,width:"95%",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:8}}>💀</div>
        <div style={{color:"#c0392b",fontSize:18,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:10}}>You Have Fallen</div>
        <div style={{color:C.dim,fontSize:13,marginBottom:18}}>You wake up again in the Salty Cove Tavern...</div>
        <button style={btnS(C.red,false)} onClick={onRestart} onMouseEnter={e=>{e.currentTarget.style.background=C.red;e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.red;}}>↺ Try Again</button>
      </div>
    </div>
  );
}

// ── Main Game ─────────────────────────────────────────────────────────────────
const INIT_HERO = {
  health:100, maxHealth:100,
  baseStrength:10, baseSkill:12, baseArmour:0,
  gold:10, candles:0,
  inventory:[],
  equipped:{head:null,body:null,right_hand:null,left_hand:null,finger:null,feet:null},
};
const VIEW=45;
const CELL_PX=16;
const CANVAS=VIEW*CELL_PX; // 976px viewport


export function HeroPanel({heroState,setHeroState,C,btnS,INV_MAX,totalArmour,weaponAttacks,doEquipWeapon,heroPos,setGroundItems,posScale=1}){
  const eq=heroState.equipped||{};
  const inv=heroState.inventory||[];
  const overFull=inv.length>INV_MAX;
  const armour=totalArmour(eq,heroState.baseArmour||0);
  const atks=weaponAttacks(eq);
  const SLOT_LABELS={head:"Head",body:"Body",right_hand:"Right",left_hand:"Left",finger:"Ring",feet:"Feet"};
  // No-op (rather than silently deleting the item) if there's nowhere to drop
  // it — e.g. the castle has no ground-items system of its own.
  const canDrop=!!(heroPos&&setGroundItems);
  const dropToGround=(item,idx)=>{
    if(!canDrop)return;
    const key=`${heroPos.x},${heroPos.y}`;
    setGroundItems(g=>({...g,[key]:[...(g[key]||[]),item]}));
    setHeroState(h=>({...h,inventory:h.inventory.filter((_,j)=>j!==idx)}));
  };
  return(
    <div style={{background:"#1a1510",border:`1px solid ${C.border}`,borderRight:"none",
      padding:"10px 12px",width:185,maxHeight:"85vh",overflowY:"auto",
      display:"flex",flexDirection:"column",gap:8}}>

      <div>
        <div style={{color:C.gold,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:5}}>Stats</div>
        <div style={{height:5,background:"#1a1208",borderRadius:3,overflow:"hidden",marginBottom:3}}>
          <div style={{height:"100%",width:`${heroState.health}%`,
            background:heroState.health>60?"#2d8a4e":heroState.health>25?"#c9a02b":"#c0392b",borderRadius:3}}/>
        </div>
        {[["❤",`${heroState.health}%`],["💰",`${heroState.gold}g`],["🕯",`${heroState.candles}/50`],
          ["⚔ Str",heroState.baseStrength],["🎯 Skl",heroState.baseSkill],["🛡 Arm",armour],
          ...(heroPos?[["📍",`${Math.floor(heroPos.x/posScale)},${Math.floor(heroPos.y/posScale)}`]]:[])
        ].map(([l,v])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:2}}>
            <span style={{color:C.dim}}>{l}</span><span style={{color:C.text}}>{v}</span>
          </div>
        ))}
        <div style={{fontSize:9,color:"#a8d8b8",marginTop:2}}>
          {atks.map((a,i)=><span key={i} style={{marginRight:5}}>⚔{a.label}+{a.bonus}</span>)}
        </div>
      </div>

      <div>
        <div style={{color:C.gold,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:5}}>Equipped</div>
        {Object.entries(SLOT_LABELS).map(([slot,label])=>{
          const item=eq[slot];
          const isGS=item?.twoHanded&&slot==="left_hand";
          return(
            <div key={slot} style={{fontSize:9,marginBottom:2,display:"flex",justifyContent:"space-between"}}>
              <span style={{color:C.dim,flexShrink:0}}>{label}</span>
              <span style={{color:item?C.text:"#3a3020",textAlign:"right",fontSize:9,marginLeft:4}}>
                {isGS?"(off-hand)":item?item.name:"—"}
              </span>
            </div>
          );
        })}
      </div>

      <div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{color:C.gold,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase"}}>Inventory</span>
          <span style={{fontSize:9,color:overFull?C.red:C.dim}}>{inv.length}/{INV_MAX}</span>
        </div>
        {overFull&&<div style={{fontSize:9,color:C.red,marginBottom:4,background:"#2a0d0d",
          border:`1px solid ${C.red}`,borderRadius:3,padding:"2px 6px"}}>Over limit!</div>}
        {inv.length===0&&<div style={{fontSize:10,color:"#3a3020"}}>Empty</div>}
        {inv.map((item,i)=>{
          const isOver=i>=INV_MAX;
          const col=item.type==="magic"?(item.color||"#9b59b6"):
            item.type==="food"?C.gold:item.type==="weapon"?"#e74c3c":"#7f8c8d";
          return(
            <div key={item.uid||i} style={{marginBottom:3,padding:"3px 5px",borderRadius:3,
              background:isOver?"#2a0d0d":"#1f1a11",
              border:`1px solid ${isOver?C.red:C.border}`}}>
              <div style={{fontSize:10,color:isOver?C.red:col,marginBottom:2,
                overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{item.name}</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {canDrop&&<button style={{fontSize:8,padding:"1px 5px",background:"transparent",
                  border:`1px solid ${C.dim}`,color:C.dim,cursor:"pointer",borderRadius:2}}
                  onClick={()=>dropToGround(item,i)}>
                  Drop
                </button>}
                {item.type==="food"&&(
                  <button style={{fontSize:8,padding:"1px 5px",background:"transparent",
                    border:"1px solid #2d8a4e",color:"#2d8a4e",cursor:"pointer",borderRadius:2}}
                    onClick={()=>setHeroState(h=>({...h,
                      health:Math.min(100,h.health+(item.heal||0)),
                      inventory:h.inventory.filter((_,j)=>j!==i)}))}>
                    Eat
                  </button>
                )}
                {(item.strBonus!=null||item.armourBonus!=null)&&(
                  <button style={{fontSize:8,padding:"1px 5px",background:"transparent",
                    border:"1px solid #2d8a4e",color:"#2d8a4e",cursor:"pointer",borderRadius:2}}
                    onClick={()=>{
                      if(item.armourBonus==null&&item.strBonus!=null){
                        const{newEq,toInv}=doEquipWeapon(item,eq);
                        setHeroState(h=>({...h,equipped:{...h.equipped,...newEq},
                          inventory:[...h.inventory.filter((_,j)=>j!==i),...toInv]}));
                      } else {
                        const slot=item.slot==="left_shield"?"left_hand":item.slot;
                        const old=eq[slot];
                        const strDelta=armourStrBonus(item)-armourStrBonus(old);
                        const sklDelta=armourSklBonus(item)-armourSklBonus(old);
                        setHeroState(h=>({...h,baseStrength:h.baseStrength+strDelta,baseSkill:h.baseSkill+sklDelta,equipped:{...h.equipped,[slot]:item},
                          inventory:[...h.inventory.filter((_,j)=>j!==i),...(old?[old]:[])]}));
                      }
                    }}>
                    Equip
                  </button>
                )}
                {item.type==="magic"&&item.form==="ring"&&(
                  <button style={{fontSize:8,padding:"1px 5px",background:"transparent",
                    border:"1px solid #9b59b6",color:"#9b59b6",cursor:"pointer",borderRadius:2}}
                    onClick={()=>{
                      const old=eq.finger;
                      setHeroState(h=>({...h,equipped:{...h.equipped,finger:item},
                        inventory:[...h.inventory.filter((_,j)=>j!==i),...(old?[old]:[])]}));
                    }}>
                    Wear
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Ground Items Dialogue ────────────────────────────────────────────────────
export function GroundItemsDialogue({items,groundKey,heroState,setHeroState,setGroundItems,onDismiss}){
  const C2=C; // alias
  const eq=heroState.equipped||{};

  const takeAll=()=>{
    const gold=items.filter(i=>i.isGold).reduce((s,i)=>s+(i.amount||0),0);
    const realItems=items.filter(i=>!i.isGold);
    const room=INV_MAX-(heroState.inventory||[]).length;
    if(room<=0){
      // No room for items, but still allow collecting gold
      if(gold>0){
        setHeroState(h=>({...h,gold:h.gold+gold}));
        setGroundItems(g=>({...g,[groundKey]:(g[groundKey]||[]).filter(i=>!i.isGold)}));
      }
      return;
    }
    const toTake=realItems.slice(0,room);
    const leftover=realItems.slice(room);
    setHeroState(h=>({...h,gold:h.gold+gold,inventory:[...h.inventory,...toTake]}));
    setGroundItems(g=>{
      if(leftover.length===0){const n={...g};delete n[groundKey];return n;}
      return {...g,[groundKey]:leftover};
    });
    if(leftover.length===0)onDismiss();
  };

  const takeItem=(item)=>{
    if((heroState.inventory||[]).length>=INV_MAX)return;
    setHeroState(h=>({...h,inventory:[...h.inventory,item]}));
    setGroundItems(g=>{
      const updated=(g[groundKey]||[]).filter(i=>(i.uid||i.id)!==(item.uid||item.id));
      if(updated.length===0){const n={...g};delete n[groundKey];return n;}
      return {...g,[groundKey]:updated};
    });
  };

  const takeGold=()=>{
    if(gold<=0)return;
    setHeroState(h=>({...h,gold:h.gold+gold}));
    setGroundItems(g=>{
      const updated=(g[groundKey]||[]).filter(i=>!i.isGold);
      if(updated.length===0){const n={...g};delete n[groundKey];return n;}
      return {...g,[groundKey]:updated};
    });
  };

  const dropItem=(item)=>{
    setGroundItems(g=>({...g,[groundKey]:[...(g[groundKey]||[]),item]}));
    setHeroState(h=>({...h,inventory:h.inventory.filter(i=>(i.uid||i.id)!==(item.uid||item.id))}));
  };

  const equipItem=(item,idx)=>{
    takeItem(item,idx);
    // equip handled by hero panel after taking
  };

  const gold=items.filter(i=>i.isGold).reduce((s,i)=>s+(i.amount||0),0);
  const realItems=items.filter(i=>!i.isGold);

  // Auto-close when everything (items and gold) has been taken
  React.useEffect(()=>{if(items.length===0)onDismiss();},[items.length]);

  return(
    <div style={{position:"fixed",inset:0,background:"#000b",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C2.panel,border:`1px solid ${C2.border}`,borderRadius:10,overflow:"hidden",maxWidth:400,width:"95%",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${C2.border}`,background:"#120f07",flexShrink:0}}>
          <div style={{color:C2.gold,fontSize:15,letterSpacing:"0.1em",textTransform:"uppercase"}}>Items on the Ground</div>
          <div style={{color:C2.dim,fontSize:10,marginTop:2}}>You find something here...</div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"10px 14px"}}>
          {gold>0&&(
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:6,borderRadius:4,background:"#1f1a08",border:`1px solid ${C2.border}`}}>
              <span style={{fontSize:18}}>💰</span>
              <span style={{fontSize:13,color:C2.gold,flex:1}}>{gold} gold</span>
              <button style={{fontSize:8,padding:"2px 7px",background:"transparent",border:`1px solid ${C2.gold}`,color:C2.gold,cursor:"pointer",borderRadius:2}}
                onClick={takeGold}>Take</button>
            </div>
          )}
          {realItems.map((item,i)=>{
            const col=item.type==="magic"?(item.color||"#9b59b6"):
              item.type==="food"?C2.gold:item.strBonus!=null?"#e74c3c":"#7f8c8d";
            return(
              <div key={item.uid||i} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 10px",marginBottom:5,borderRadius:4,background:"#1f1a11",border:`1px solid ${C2.border}`}}>
                <span style={{fontSize:12,color:col,flex:1}}>{item.name}</span>
                {item.strBonus!=null&&<span style={{fontSize:9,color:C2.dim}}>+{item.strBonus}str</span>}
                {item.armourBonus!=null&&<span style={{fontSize:9,color:C2.dim}}>+{item.armourBonus}arm</span>}
                {item.heal!=null&&<span style={{fontSize:9,color:C2.dim}}>+{item.heal}hp</span>}
                <button style={{fontSize:8,padding:"2px 7px",background:"transparent",border:`1px solid ${(heroState.inventory||[]).length>=INV_MAX?"#444":C2.green}`,color:(heroState.inventory||[]).length>=INV_MAX?"#444":C2.green,cursor:(heroState.inventory||[]).length>=INV_MAX?"not-allowed":"pointer",borderRadius:2}}
                  disabled={(heroState.inventory||[]).length>=INV_MAX}
                  onClick={()=>takeItem(item)}>Take</button>
                {item.type==="food"&&<button style={{fontSize:8,padding:"2px 7px",background:"transparent",border:`1px solid #2d8a4e`,color:"#2d8a4e",cursor:"pointer",borderRadius:2}}
                  onClick={()=>{
                    setHeroState(h=>({...h,health:Math.min(100,h.health+(item.heal||0))}));
                    setGroundItems(g=>{
                      const updated=(g[groundKey]||[]).filter((_,j)=>j!==i);
                      if(updated.length===0){const n={...g};delete n[groundKey];return n;}
                      return {...g,[groundKey]:updated};
                    });
                  }}>Eat</button>}
              </div>
            );
          })}
          {/* Hero inventory for dropping */}
          {(heroState.inventory||[]).length>0&&<>
            <div style={{color:C2.dim,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",margin:"10px 0 5px"}}>Your inventory — drop here</div>
            {(heroState.inventory||[]).map((item,i)=>(
              <div key={item.uid||i} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",marginBottom:4,borderRadius:4,background:"#151008",border:`1px solid ${C2.border}`}}>
                <span style={{fontSize:11,color:C2.text,flex:1}}>{item.name}</span>
                <button style={{fontSize:8,padding:"2px 7px",background:"transparent",border:`1px solid ${C2.dim}`,color:C2.dim,cursor:"pointer",borderRadius:2}}
                  onClick={()=>dropItem(item)}>Drop</button>
              </div>
            ))}
          </>}
        </div>
        <div style={{padding:"10px 14px",borderTop:`1px solid ${C2.border}`,flexShrink:0,display:"flex",gap:8,justifyContent:"space-between"}}> 
          {(gold>0||realItems.length>0)&&<button style={{...btnS(C2.gold,false),padding:"6px 16px"}} onClick={takeAll}
            onMouseEnter={e=>{e.currentTarget.style.background=C2.gold;e.currentTarget.style.color=C2.bg;}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C2.gold;}}>
            Take All
          </button>}
          <button style={{...btnS(C2.dim,false),padding:"6px 16px"}} onClick={onDismiss}
            onMouseEnter={e=>{e.currentTarget.style.background=C2.dim;e.currentTarget.style.color=C2.bg;}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C2.dim;}}>
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Game(){
  const [heroState,setHeroState]=useState({...INIT_HERO});
  const [defeatedGuardians,setDefeatedGuardians]=useState(new Set());
  const [hasMap,setHasMap]=useState(false);
  const [defeatedTournament,setDefeatedTournament]=useState(new Set());
  const defeatedTournamentRef=useRef(new Set());
  useEffect(()=>{defeatedTournamentRef.current=defeatedTournament;},[defeatedTournament]);
  const defeatedGuardiansRef=useRef(new Set());
  const [fadingGuardian,setFadingGuardian]=useState(null); // id of guardian currently animating out
  const [heroPos,setHeroPos]=useState({x:23,y:14});
  const [target,setTarget]=useState(null);
  const [log,setLog]=useState(["Your quest begins at The Salty Cove Tavern."]);
  const [keyOpen,setKeyOpen]=useState(false);
  const [modal,setModal]=useState(null); // {type, data}
  const [merchantStock,setMerchantStock]=useState(null);
  const [groundItems,setGroundItems]=useState({
    "32,30": [{...magicItem("fire","potion","fire_pot_g"),uid:"fire_pot_g"}, {...gold(49),uid:"gold_32_30"}],
    "69,58": [{...magicItem("fire","potion","fire_pot_g2"),uid:"fire_pot_g2"}, {...gold(33),uid:"gold_69_58"}],
    "145,20": [{...magicItem("fire","potion","fire_pot_g3"),uid:"fire_pot_g3"}, {...gold(46),uid:"gold_145_20"}],
    "186,17": [{...magicItem("fire","wand","fire_wand_g"),uid:"fire_wand_g"}, {...gold(22),uid:"gold_186_17"}],
    "208,20": [{...magicItem("arcane","wand","arc_wand_g"),uid:"arc_wand_g"}, {...gold(55),uid:"gold_208_20"}],
    "28,89": [{...magicItem("frost","wand","frost_wand_g"),uid:"frost_wand_g"}, {...gold(14),uid:"gold_28_89"}],
    "95,113": [groundItem("longsword","ground_longsword_95_113"), {...gold(12),uid:"gold_95_113"}],
    "112,110": [groundItem("greatsword","ground_greatsword_112_110"), {...gold(52),uid:"gold_112_110"}],
    "171,120": [groundItem("dagger","ground_dagger_171_120"), {...gold(24),uid:"gold_171_120"}],
    "221,103": [groundItem("chainmail","ground_chainmail_221_103"), {...gold(59),uid:"gold_221_103"}],
    "32,135": [groundItem("plate","ground_plate_32_135"), {...gold(28),uid:"gold_32_135"}],
    "73,179": [groundItem("mithril","ground_mithril_73_179"), {...gold(15),uid:"gold_73_179"}],
    "138,156": [groundItem("leather","ground_leather_138_156"), {...gold(24),uid:"gold_138_156"}],
    "176,144": [groundItem("ironhelm","ground_ironhelm_176_144"), {...gold(16),uid:"gold_176_144"}],
    "220,156": [groundItem("mithrilhelm","ground_mithrilhelm_220_156"), {...gold(34),uid:"gold_220_156"}],
    "39,201": [groundItem("boots","ground_boots_39_201"), {...gold(27),uid:"gold_39_201"}],
    "85,217": [{...magicItem("fire","ring","fire_ring_g"),uid:"fire_ring_g"}, {...gold(39),uid:"gold_85_217"}],
    "127,197": [{...magicItem("iron","ring","iron_ring_g"),uid:"iron_ring_g"}, {...gold(50),uid:"gold_127_197"}],
    "166,219": [groundItem("sevenup","ground_sevenup_166_219"), {...gold(33),uid:"gold_166_219"}],
    "225,235": [groundItem("coffee","ground_coffee_225_235"), {...gold(20),uid:"gold_225_235"}],
  }); // key="x,y" → [{item},...,gold:N] — items resolved from canonical WEAPONS/ARMOUR_ITEMS/FOOD/magicItem()
  const [gameState,setGameState]=useState("playing"); // playing|won|dead
  // Save/load — owned here (not TavernDialogue) so a save taken from inside
  // the castle's shelter dialogue can share the same save-slot list and
  // reach island-side fields (heroPos, groundItems, etc.) that only live in
  // this component. pendingCastleState is the current in-session castle
  // progress: CastleLevel reads it to seed a fresh mount, and reports its
  // latest snapshot back here on exit — so leaving and re-entering the
  // castle resumes exactly, even without an explicit save. Loading a save
  // overwrites it (to the loaded castleState, or null for an island save,
  // discarding any unsaved in-session castle progress from before the load).
  const [saves,setSaves]=useState([]);
  const [saveMsg,setSaveMsg]=useState("");
  const [pendingCastleState,setPendingCastleState]=useState(null);
  const canvasRef=useRef(null);
  const pathRef=useRef([]);
  const stepRef=useRef(null);
  const walkPathRef=useRef(null);
  const stepCountRef=useRef(0);
  const heroStateRef=useRef(null);
  const heroPosRef=useRef({x:23,y:14});


  // ── Canvas draw ──────────────────────────────────────────────────────────
  const drawCanvas = useCallback((hx,hy,tgt,defeated,fading,mapActive,gItems)=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext("2d");
    const HALF=Math.floor(VIEW/2);
    const C2=CELL_PX/2;
    const S=CELL_PX; // cell size alias

    // Fast deterministic noise: returns 0..1
    const pnoise=(x,y)=>{
      const h=(x*374761393+y*668265263)^((x*668265263)+(y*374761393));
      return ((h^(h>>13))*1274126177&0x7fffffff)/0x7fffffff;
    };
    // Second noise layer for detail
    const pnoise2=(x,y)=>{
      const h=(x*1013904223+y*1664525)^((y*1013904223)+(x*22695477));
      return ((h^(h>>15))*214013&0x7fffffff)/0x7fffffff;
    };

    // ── Terrain ──────────────────────────────────────────────────────────────
    // Strategy: compute interpolated RGB for each cell by averaging a neighbourhood
    // weighted by a Gaussian kernel — this blends biome colours at boundaries.
    // Then apply ctx.filter blur for additional sub-cell softening.

    // Gaussian kernel radius in world cells (controls biome blend distance)
    const KERN=2; // samples ±2 cells → 5x5 kernel, smooth transitions
    const gaussW=(d2)=>Math.exp(-d2/(2*1.2*1.2)); // sigma=1.2 cells

    // Helper: get raw biome RGB for a world cell (with noise + gradient)
    const rawRGB=(wx,wy)=>{
      if(wx<0||wy<0||wx>=SIZE||wy>=SIZE) return [26,78,138]; // sea
      const b=biomeAt(wx,wy);
      const base=BIOME_RGB[b]||[26,78,138];
      let r=base[0],g=base[1],bl=base[2];
      const n=(pnoise(wx,wy)-0.5)*22+(pnoise2(wx,wy)-0.5)*10;
      r=Math.round(r+n); g=Math.round(g+n*0.75); bl=Math.round(bl+n*0.55);

      if(PATHWAY[wy*SIZE+wx]){
        r=Math.round(r*0.35+80*0.65);
        g=Math.round(g*0.35+70*0.65);
        bl=Math.round(bl*0.35+50*0.65);
      }
      return [Math.min(255,Math.max(0,r)),Math.min(255,Math.max(0,g)),Math.min(255,Math.max(0,bl))];
    };

    // Draw blended cells to offscreen canvas, then blur further for sub-cell softness
    const offscreen=document.createElement('canvas');
    offscreen.width=VIEW*S; offscreen.height=VIEW*S;
    const off=offscreen.getContext('2d');

    for(let vy=0;vy<VIEW;vy++){
      for(let vx=0;vx<VIEW;vx++){
        const wx=hx-HALF+vx, wy=hy-HALF+vy;
        // Gaussian-weighted average of neighbourhood colours
        let sr=0,sg=0,sb=0,sw=0;
        for(let dy=-KERN;dy<=KERN;dy++){
          for(let dx=-KERN;dx<=KERN;dx++){
            const w=gaussW(dx*dx+dy*dy);
            const [r,g,bl]=rawRGB(wx+dx,wy+dy);
            sr+=r*w; sg+=g*w; sb+=bl*w; sw+=w;
          }
        }
        const fr=Math.round(sr/sw), fg=Math.round(sg/sw), fb=Math.round(sb/sw);
        off.fillStyle=`rgb(${fr},${fg},${fb})`;
        off.fillRect(vx*S, vy*S, S, S);
      }
    }

    // Additional ctx.filter blur for intra-cell softening (bigger radius = smoother)
    const blurPx=Math.round(S*1.1);
    ctx.filter=`blur(${blurPx}px)`;
    ctx.drawImage(offscreen,0,0);
    ctx.filter='none';

    // Pass 2: sub-cell texture blobs — 10-15 per cell
    for(let vy=0;vy<VIEW;vy++){
      for(let vx=0;vx<VIEW;vx++){
        const wx=hx-HALF+vx, wy=hy-HALF+vy;
        if(wx<0||wy<0||wx>=SIZE||wy>=SIZE) continue;
        if(biomeAt(wx,wy)==='s') continue;
        const px=vx*S, py=vy*S;
        const blobCount=10+((pnoise(wx*3,wy*7)*5)|0);
        for(let i=0;i<blobCount;i++){
          const ox=px+pnoise(wx+i*17,wy+i*3)*S;
          const oy=py+pnoise(wx+i*5, wy+i*13)*S;
          const rad=0.8+pnoise(wx+i*11,wy+i*7)*2.5;
          const alpha=0.05+pnoise(wx+i*19,wy+i*23)*0.09;
          const light=pnoise(wx+i*29,wy+i*31)>0.5;
          ctx.globalAlpha=alpha;
          ctx.fillStyle=light?"#ffffff":"#000000";
          ctx.beginPath(); ctx.arc(ox,oy,rad,0,Math.PI*2); ctx.fill();
        }
        ctx.globalAlpha=1;
      }
    }

    ctx.textAlign="center"; ctx.textBaseline="middle";
    const vp=(wx,wy)=>[(wx-(hx-HALF))*S+C2,(wy-(hy-HALF))*S+C2];
    const inView=(wx,wy)=>wx>=hx-HALF&&wx<=hx+HALF&&wy>=hy-HALF&&wy<=hy+HALF;
    const R=S*1.4; // icon radius — spans ~3 cells visually

    // ── Buildings (3×3 display) ───────────────────────────────────────────────
    const bldIcon={tavern:"🍺",armourer:"⚔",magic:"✦",castle:"🏰",arena:"🏟"};
    for(const b of BUILDINGS){
      if(!inView(b.x,b.y)) continue;
      const [px,py]=vp(b.x,b.y);
      // Glow halo
      const grd=ctx.createRadialGradient(px,py,R*0.3,px,py,R);
      grd.addColorStop(0,b.color+"99"); grd.addColorStop(1,b.color+"00");
      ctx.fillStyle=grd;
      ctx.beginPath(); ctx.arc(px,py,R,0,Math.PI*2); ctx.fill();
      // Icon circle
      ctx.fillStyle=b.color+"dd";
      ctx.beginPath(); ctx.arc(px,py,R*0.62,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#ffffff55"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(px,py,R*0.62,0,Math.PI*2); ctx.stroke();
      ctx.font=`bold ${Math.round(S*1.1)}px serif`;
      ctx.fillStyle="#fff";
      ctx.fillText(bldIcon[b.type]||"?",px,py+1);
    }

    // ── Guardians (3×3 display) ───────────────────────────────────────────────
    for(const g of GUARDIANS){
      if(defeated?.has(g.id)||!inView(g.x,g.y)) continue;
      const isFading=fading===g.id;
      const [px,py]=vp(g.x,g.y);
      ctx.globalAlpha=isFading?0.12:1;
      // Outer glow
      const gg=ctx.createRadialGradient(px,py,R*0.2,px,py,R);
      gg.addColorStop(0,"#9b233599"); gg.addColorStop(1,"#9b233500");
      ctx.fillStyle=gg;
      ctx.beginPath(); ctx.arc(px,py,R,0,Math.PI*2); ctx.fill();
      // Iris
      ctx.fillStyle=isFading?"#ff8800cc":"#9b2335cc";
      ctx.beginPath(); ctx.arc(px,py,R*0.58,0,Math.PI*2); ctx.fill();
      // White of eye
      ctx.fillStyle="#ffffffee";
      ctx.beginPath(); ctx.ellipse(px,py,R*0.45,R*0.30,0,0,Math.PI*2); ctx.fill();
      // Pupil
      ctx.fillStyle=isFading?"#ff8800":"#0a0505";
      ctx.beginPath(); ctx.arc(px,py,R*0.18,0,Math.PI*2); ctx.fill();
      // Highlight
      ctx.fillStyle="#ffffff";
      ctx.beginPath(); ctx.arc(px-R*0.07,py-R*0.07,R*0.07,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    }

    // ── Dragon (3×3 starburst) ────────────────────────────────────────────────
    if(inView(TOURNAMENT_POS.x,TOURNAMENT_POS.y)){
      const [px,py]=vp(TOURNAMENT_POS.x,TOURNAMENT_POS.y);
      const spikes=8,outerR=R*0.95,innerR=R*0.40;
      // Glow
      const dg=ctx.createRadialGradient(px,py,innerR,px,py,outerR*1.2);
      dg.addColorStop(0,"#ff6b0088"); dg.addColorStop(1,"#ff6b0000");
      ctx.fillStyle=dg;
      ctx.beginPath(); ctx.arc(px,py,outerR*1.2,0,Math.PI*2); ctx.fill();
      // Starburst
      ctx.fillStyle="#ff6b00"; ctx.strokeStyle="#ffcc00"; ctx.lineWidth=1;
      ctx.beginPath();
      for(let i=0;i<spikes*2;i++){
        const r2=i%2===0?outerR:innerR;
        const a=Math.PI/spikes*i-Math.PI/2;
        i===0?ctx.moveTo(px+r2*Math.cos(a),py+r2*Math.sin(a))
             :ctx.lineTo(px+r2*Math.cos(a),py+r2*Math.sin(a));
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // Centre orb
      ctx.fillStyle="#ffee55";
      ctx.beginPath(); ctx.arc(px,py,R*0.28,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#ff9900";
      ctx.beginPath(); ctx.arc(px,py,R*0.14,0,Math.PI*2); ctx.fill();
    }

    // ── Target highlight ──────────────────────────────────────────────────────
    if(tgt&&inView(tgt.x,tgt.y)){
      const [px,py]=vp(tgt.x,tgt.y);
      ctx.strokeStyle="#ffffff88"; ctx.lineWidth=1;
      ctx.strokeRect(px-C2+0.5,py-C2+0.5,S-1,S-1);
      ctx.strokeStyle="#ffffff33"; ctx.lineWidth=1;
      ctx.strokeRect(px-C2-0.5,py-C2-0.5,S+1,S+1);
    }

    // ── Ground items (📦 icon, gold glow when hasMap active) ─────────────────
    if(mapActive){
      for(const [key,items] of Object.entries(gItems||{})){
        if(!items||items.length===0) continue;
        const [gx,gy]=key.split(",").map(Number);
        if(!inView(gx,gy)) continue;
        const [px,py]=vp(gx,gy);
        // Gold glow
        const gg=ctx.createRadialGradient(px,py,2,px,py,R*1.1);
        gg.addColorStop(0,"#c9a84caa"); gg.addColorStop(1,"#c9a84c00");
        ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(px,py,R*1.1,0,Math.PI*2); ctx.fill();
        ctx.font=`${Math.round(S*0.75)}px serif`;
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText("📦",px,py+1);
      }
    }

    // ── Hero (humanoid figure, 2.2× cell) ────────────────────────────────────
    {
      const [px,py]=vp(hx,hy);
      const sc=S*0.52; // scale factor
      ctx.save();

      // Shadow
      ctx.fillStyle="rgba(0,0,0,0.35)";
      ctx.beginPath(); ctx.ellipse(px,py+sc*1.1,sc*0.55,sc*0.18,0,0,Math.PI*2); ctx.fill();

      // Legs
      ctx.strokeStyle="#3a2a6a"; ctx.lineWidth=sc*0.28; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(px-sc*0.18,py+sc*0.35); ctx.lineTo(px-sc*0.22,py+sc*0.95); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px+sc*0.18,py+sc*0.35); ctx.lineTo(px+sc*0.22,py+sc*0.95); ctx.stroke();
      // Boots
      ctx.strokeStyle="#1a1008"; ctx.lineWidth=sc*0.22;
      ctx.beginPath(); ctx.moveTo(px-sc*0.22,py+sc*0.9); ctx.lineTo(px-sc*0.38,py+sc*0.95); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px+sc*0.22,py+sc*0.9); ctx.lineTo(px+sc*0.38,py+sc*0.95); ctx.stroke();

      // Cloak / body
      const cloakGrad=ctx.createLinearGradient(px-sc*0.45,py-sc*0.1,px+sc*0.45,py+sc*0.4);
      cloakGrad.addColorStop(0,"#4a2a8a"); cloakGrad.addColorStop(1,"#2a1050");
      ctx.fillStyle=cloakGrad;
      ctx.beginPath();
      ctx.moveTo(px-sc*0.12,py-sc*0.1);
      ctx.lineTo(px-sc*0.45,py+sc*0.5);
      ctx.lineTo(px+sc*0.45,py+sc*0.5);
      ctx.lineTo(px+sc*0.12,py-sc*0.1);
      ctx.closePath(); ctx.fill();

      // Arms
      ctx.strokeStyle="#4a2a8a"; ctx.lineWidth=sc*0.22; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(px-sc*0.12,py+sc*0.05); ctx.lineTo(px-sc*0.52,py+sc*0.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px+sc*0.12,py+sc*0.05); ctx.lineTo(px+sc*0.52,py+sc*0.3); ctx.stroke();
      // Sword in right hand
      ctx.strokeStyle="#c0c0d0"; ctx.lineWidth=sc*0.1;
      ctx.beginPath(); ctx.moveTo(px+sc*0.52,py+sc*0.3); ctx.lineTo(px+sc*0.72,py-sc*0.15); ctx.stroke();
      ctx.strokeStyle="#8a6a20"; ctx.lineWidth=sc*0.18;
      ctx.beginPath(); ctx.moveTo(px+sc*0.44,py+sc*0.42); ctx.lineTo(px+sc*0.62,py+sc*0.28); ctx.stroke();

      // Neck
      ctx.fillStyle="#d4a574";
      ctx.beginPath(); ctx.arc(px,py-sc*0.12,sc*0.12,0,Math.PI*2); ctx.fill();

      // Head
      const headGrad=ctx.createRadialGradient(px-sc*0.08,py-sc*0.42,sc*0.05,px,py-sc*0.38,sc*0.28);
      headGrad.addColorStop(0,"#e8c090"); headGrad.addColorStop(1,"#c4885c");
      ctx.fillStyle=headGrad;
      ctx.beginPath(); ctx.arc(px,py-sc*0.38,sc*0.26,0,Math.PI*2); ctx.fill();

      // Helmet
      const helmGrad=ctx.createLinearGradient(px-sc*0.28,py-sc*0.72,px+sc*0.28,py-sc*0.38);
      helmGrad.addColorStop(0,"#d0d8e8"); helmGrad.addColorStop(1,"#708090");
      ctx.fillStyle=helmGrad;
      ctx.beginPath();
      ctx.arc(px,py-sc*0.42,sc*0.28,Math.PI,0); // dome
      ctx.lineTo(px+sc*0.32,py-sc*0.38);
      ctx.lineTo(px-sc*0.32,py-sc*0.38);
      ctx.closePath(); ctx.fill();
      // Visor
      ctx.strokeStyle="#50607080"; ctx.lineWidth=sc*0.06;
      ctx.beginPath(); ctx.moveTo(px-sc*0.18,py-sc*0.38); ctx.lineTo(px+sc*0.18,py-sc*0.38); ctx.stroke();
      // Plume
      ctx.strokeStyle="#cc2233"; ctx.lineWidth=sc*0.12; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(px,py-sc*0.68); ctx.quadraticCurveTo(px+sc*0.25,py-sc*0.82,px+sc*0.18,py-sc*0.55); ctx.stroke();

      ctx.restore();
    }
  },[]);

  useEffect(()=>{
    drawCanvas(heroPos.x,heroPos.y,target,defeatedGuardians,fadingGuardian,hasMap,groundItems);
  },[heroPos,target,defeatedGuardians,fadingGuardian,hasMap,groundItems,drawCanvas]);

  const addLog=msg=>setLog(p=>[msg,...p].slice(0,30));

  // Sync heroPosRef
  useEffect(()=>{heroPosRef.current=heroPos;},[heroPos]);
  useEffect(()=>{heroStateRef.current=heroState;},[heroState]);

  const computePath=useCallback((sx,sy,tx,ty)=>{
    if(!isLand(tx,ty)) return null;
    if(sx===tx&&sy===ty) return [];
    const visited=new Set();
    const parent=new Map();
    const key=(x,y)=>x*1000+y;
    visited.add(key(sx,sy));
    parent.set(key(sx,sy),-1);
    const q=[[sx,sy]]; let head=0;
    const dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
    while(head<q.length){
      const[cx,cy]=q[head++];
      for(const[dx,dy] of dirs){
        const nx=cx+dx,ny=cy+dy;
        if(!isLand(nx,ny)) continue;
        if(dx!==0&&dy!==0&&(!isLand(cx+dx,cy)||!isLand(cx,cy+dy))) continue;
        const k=key(nx,ny);
        if(visited.has(k)) continue;
        visited.add(k);
        parent.set(k,key(cx,cy));
        if(nx===tx&&ny===ty){
          const path=[];
          let cur=k;
          while(cur!==key(sx,sy)){path.push([cur/1000|0,cur%1000]);cur=parent.get(cur);}
          return path.reverse();
        }
        q.push([nx,ny]);
      }
    }
    return null;
  },[]);

  const stopAt=(nx,ny)=>{heroPosRef.current={x:nx,y:ny};setHeroPos({x:nx,y:ny});pathRef.current=[];setTarget(null);};

  // ── Unified save/load — visible save slots (shared by the Tavern's Save
  // tab and the castle shelter NPC's Save section) ──────────────────────────
  const MAX_SAVES=3;
  const readSaves=async()=>{
    try{
      const raw=await storageGet(SAVES_KEY);
      const list=raw?JSON.parse(raw):[];
      return Array.isArray(list)?list:[];
    }catch{return [];}
  };
  useEffect(()=>{readSaves().then(setSaves);},[]);
  // castleSnapshot is null for an island save (Tavern), or the castle's own
  // live-state snapshot when saved from the shelter NPC dialogue. Either way
  // heroState.location records where to resume: island coordinates always,
  // plus the castle level/position when castleSnapshot is present.
  const commitSave=async(castleSnapshot=null)=>{
    try{
      const location={
        area:castleSnapshot?"castle":"island",
        islandPos:heroPos,
        castleLevelIdx:castleSnapshot?castleSnapshot.levelIdx:null,
        castlePos:castleSnapshot?castleSnapshot.heroPos:null,
      };
      const saveData={heroState:{...heroState,location},heroPos,defeatedGuardians:[...(defeatedGuardians||[])],defeatedTournament:[...(defeatedTournament||[])],groundItems:groundItems||{},hasMap,castleState:castleSnapshot,timestamp:Date.now()};
      const cs=computeChecksum(saveData);
      let list=await readSaves();
      list=[...list,{...saveData,checksum:cs}].sort((a,b)=>a.timestamp-b.timestamp);
      if(list.length>MAX_SAVES) list=list.slice(list.length-MAX_SAVES); // oldest evicted first
      await storageSet(SAVES_KEY,JSON.stringify(list));
      setSaves(list);
      setSaveMsg("✓ Game saved!");setTimeout(()=>setSaveMsg(""),2500);
    }catch(e){console.error("Save error:",e);setSaveMsg("✗ Save failed: "+String(e.message||e));}
  };
  const deleteSave=async(entry)=>{
    if(!window.confirm(`Delete the save from ${new Date(entry.timestamp).toLocaleString()}? This can't be undone.`))return;
    try{
      let list=await readSaves();
      list=list.filter(s=>s.timestamp!==entry.timestamp);
      await storageSet(SAVES_KEY,JSON.stringify(list));
      setSaves(list);
      setSaveMsg("✓ Save deleted.");setTimeout(()=>setSaveMsg(""),2500);
    }catch(e){console.error("Delete save error:",e);setSaveMsg("✗ Delete failed: "+String(e.message||e));}
  };
  const loadGame=(entry)=>{
    try{
      const{checksum:cs,...saveData}=entry;
      if(cs!==computeChecksum(saveData)){setSaveMsg("✗ Save corrupted!");return;}
      setHeroState(saveData.heroState);
      const loc=saveData.heroState?.location;
      const islandPos=loc?.islandPos||saveData.heroPos;
      if(islandPos) stopAt(islandPos.x,islandPos.y);
      if(saveData.hasMap!=null)setHasMap(saveData.hasMap);
      if(saveData.groundItems)setGroundItems(saveData.groundItems);
      if(saveData.defeatedTournament){
        const t=new Set(saveData.defeatedTournament);
        setDefeatedTournament(t);defeatedTournamentRef.current=t;
      }
      if(saveData.defeatedGuardians){
        const s=new Set(saveData.defeatedGuardians);
        setDefeatedGuardians(s);defeatedGuardiansRef.current=s;
      }
      if(loc?.area==="castle"&&saveData.castleState){
        setPendingCastleState(saveData.castleState);
        setGameState("castle");
        setModal(null); // dismiss whatever island dialogue triggered the load — can't stay open over the castle
      } else {
        setPendingCastleState(null);
        setGameState("playing");
      }
      setSaveMsg("✓ Game loaded!");setTimeout(()=>setSaveMsg(""),2500);
    }catch(e){console.error("Load error:",e);setSaveMsg("✗ Load failed: "+String(e.message||e));}
  };

  const walkPath=useCallback(()=>{
    if(pathRef.current.length===0){setTarget(null);return;}
    const[nx,ny]=pathRef.current.shift();

    // Grand Tournament?
    if(tournamentAt(nx,ny)){stopAt(nx,ny);
      const remaining=TOURNAMENT_FIGHTERS.filter(f=>!defeatedTournamentRef.current.has(f.id));
      if(remaining.length>0){addLog(`⚔ You enter the Grand Tournament! Next: ${remaining[0].name}`);setModal({type:"tournament"});}
      else{addLog("🏆 The Grand Tournament is complete! All champions defeated.");}
      return;}
    // Guardian?
    const grd=guardianAt(nx,ny);
    if(grd&&!defeatedGuardiansRef.current.has(grd.id)){stopAt(nx,ny);addLog(`${grd.name} bars your way!`);setModal({type:"guardian",data:grd});return;}
    // Building?
    const bld=buildingAt(nx,ny);
    if(bld){stopAt(nx,ny);addLog(`You enter ${bld.name}.`);setModal({type:"building",data:bld});return;}
    // Merchant? (0.2%)
    if(Math.random()<0.002){stopAt(nx,ny);addLog("A wandering merchant appears!");
      const merchantTier=Math.ceil(monLvl(nx,ny)/5);
      setMerchantStock(generateMerchantStock(merchantTier));setModal({type:"merchant"});return;}
    // Monster? (1%)
    if(Math.random()<0.01){
      const count=Math.random()<0.2?rng(2,4):1;
      const monsters=Array.from({length:count},()=>({...spawnMonster(nx,ny),uid:Date.now()+Math.random()}));
      stopAt(nx,ny);
      if(count===1){
        addLog(`A ${monsters[0].name} (Lv${monsters[0].level}) blocks your path!`);
        setModal({type:"combat",data:monsters[0]});
      } else {
        addLog(`⚔ Ambushed by ${count} monsters: ${monsters.map(m=>m.name).join(", ")}!`);
        setModal({type:"multi_combat",data:monsters});
      }
      return;
    }
    heroPosRef.current={x:nx,y:ny};
    setHeroPos({x:nx,y:ny});
    // Ground items check
    const gKey=`${nx},${ny}`;
    setGroundItems(g=>{
      if(g[gKey]&&g[gKey].length>0){
        stopAt(nx,ny);
        setModal({type:"ground",data:{key:gKey,items:g[gKey]}});
      }
      return g;
    });
    // Fire ring: heal 1 HP every 10 steps
    stepCountRef.current=(stepCountRef.current||0)+1;
    if(stepCountRef.current%10===0){
      const eq=heroStateRef.current?.equipped||{};
      const ring=eq.finger;
      if(ring&&MAGIC_COMPS[ring.magicType]?.includes("fire")){
        setHeroState(h=>{
          if(h.health<100){addLog("🔥 Ring heals 1 HP.");return{...h,health:Math.min(100,h.health+1)};}
          return h;
        });
      }
    }
    stepRef.current=setTimeout(()=>walkPathRef.current&&walkPathRef.current(),80);
  },[]);
  walkPathRef.current=walkPath;

  const handleMapClick=useCallback((x,y)=>{
    if(modal||gameState!=="playing") return;
    clearTimeout(stepRef.current); pathRef.current=[];
    let path=computePath(heroPosRef.current.x,heroPosRef.current.y,x,y);
    let dest={x,y};
    if(!path){
      // Unreachable target (sea, or a disconnected pocket of land) — walk
      // as far toward it as possible instead of ignoring the click,
      // stopping at the last passable tile before the line of travel runs
      // off land.
      const stop=lastPassableAlongLine(heroPosRef.current.x,heroPosRef.current.y,x,y,isLand);
      if(stop.x===heroPosRef.current.x&&stop.y===heroPosRef.current.y) return;
      dest=stop;
      path=computePath(heroPosRef.current.x,heroPosRef.current.y,dest.x,dest.y);
    }
    if(!path||path.length===0) return;
    pathRef.current=path; setTarget(dest);
    walkPath();
  },[modal,gameState,computePath,walkPath]);

  useEffect(()=>()=>clearTimeout(stepRef.current),[]);

  // merchant stock generated fresh each encounter

  const eq=heroState.equipped||{};
  const armour=totalArmour(eq,heroState.baseArmour||0);
  const hp=heroPos;
  const hpPct=clamp(heroState.health,0,100);
  const hpColor=hpPct>60?"#2d8a4e":hpPct>25?"#c9a02b":"#c0392b";

  return(
    <div style={{width:"100vw",height:"100dvh",background:C.bg,color:C.text,fontFamily:"'Palatino Linotype',Palatino,'Book Antiqua',serif",display:"flex",flexDirection:"column",justifyContent:"center",overflow:"hidden",position:"relative"}}>

      {/* MAP - canvas rendered, always square, fills smaller screen dimension.
          No flex:1/vertical-centering here — this wraps the canvas at its own
          size so the status bar below sits flush against it instead of being
          pushed down by leftover centered space (which, combined with mobile
          browsers' shifting chrome, could push the status bar off-screen). */}
      <div style={{display:"flex",justifyContent:"center",background:C.bg,overflow:"hidden"}}>
        <canvas ref={canvasRef} width={CANVAS} height={CANVAS}
          onClick={e=>{
            const rect=canvasRef.current.getBoundingClientRect();
            const scaleX=CANVAS/rect.width, scaleY=CANVAS/rect.height;
            const vx=Math.floor((e.clientX-rect.left)*scaleX/CELL_PX);
            const vy=Math.floor((e.clientY-rect.top)*scaleY/CELL_PX);
            const HALF=Math.floor(VIEW/2);
            const wx=heroPosRef.current.x-HALF+vx;
            const wy=heroPosRef.current.y-HALF+vy;
            handleMapClick(wx,wy);
          }}
          style={{
            display:"block",
            cursor:"crosshair",
            imageRendering:"pixelated",
            ...squareViewStyle(36),
          }}/>
      </div>

      {/* STATUS BAR */}
      <div style={{flexShrink:0,background:"#100e0a",borderTop:`1px solid ${C.border}`,padding:"5px 12px",display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:3,alignItems:"center"}}>
          <div style={{width:60,height:5,background:"#1a1208",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${hpPct}%`,background:hpColor,borderRadius:3}}/>
          </div>
          <span style={{color:hpColor,fontSize:11}}>{heroState.health}%</span>
        </div>
        {[["💰",`${heroState.gold}g`],["🕯",`${heroState.candles}/50`],["🌿",BIOME_LABEL[biomeAt(hp.x,hp.y)]||"?"],["🗡",`Lv~${monLvl(hp.x,hp.y)}`]].map(([icon,val])=>(
          <div key={icon} style={{display:"flex",alignItems:"center",gap:3}}>
            <span style={{fontSize:12}}>{icon}</span><span style={{color:C.text,fontSize:11}}>{val}</span>
          </div>
        ))}
        <div style={{flex:1,color:C.dim,fontSize:10,fontStyle:"italic",textAlign:"right",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",minWidth:0}}>{log[0]||""}</div>

      </div>

            {/* HERO INFO TAB */}
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
        {keyOpen&&<HeroPanel heroState={heroState} setHeroState={setHeroState} C={C} btnS={btnS} INV_MAX={INV_MAX} totalArmour={totalArmour} weaponAttacks={weaponAttacks} doEquipWeapon={doEquipWeapon} heroPos={heroPos} setGroundItems={setGroundItems}/>}
      </div>
      {/* MODALS */}
      {modal?.type==="building"&&modal.data.type==="tavern"&&
        <TavernDialogue building={modal.data} heroState={heroState} setHeroState={setHeroState} saves={saves} saveMsg={saveMsg} onSaveGame={()=>commitSave(null)} onLoadGame={loadGame} onDeleteSave={deleteSave} onDismiss={()=>{if((heroState.inventory||[]).length>INV_MAX){alert("Please drop or use items before leaving (max 5).");return;}setModal(null);addLog(`You leave ${modal.data.name}`);}}/>}
      {modal?.type==="building"&&modal.data.type==="armourer"&&
        <ArmourerDialogue building={modal.data} heroState={heroState} setHeroState={setHeroState} onDismiss={()=>{setModal(null);addLog(`You leave ${modal.data.name}.`);}}/>}
      {modal?.type==="building"&&modal.data.type==="arena"&&
        <ArenaDialogue heroState={heroState} setHeroState={setHeroState} onDismiss={()=>{setModal(null);addLog("You leave the Arena.");}} addLog={addLog}/>}
      {modal?.type==="building"&&modal.data.type==="magic"&&
        <MagicShopDialogue building={modal.data} heroState={heroState} setHeroState={setHeroState} hasMap={hasMap} setHasMap={setHasMap} onDismiss={()=>{if((heroState.inventory||[]).length>INV_MAX){alert("Please drop or use items before leaving (max 5).");return;}setModal(null);addLog(`You leave ${modal.data.name}.`);}}/>}
      {modal?.type==="building"&&modal.data.type==="castle"&&
        <CastleDialogue heroState={heroState}
          onDismiss={()=>{setModal(null);addLog("The guard glares at you as you leave.");}}
          onEnter={()=>{setModal(null);setGameState("castle");addLog("You enter the castle!");}}
          onWin={()=>{setModal(null);setGameState("won");}}/>}
      {modal?.type==="guardian"&&
        <GuardianEncounter guardian={modal.data} setHeroState={setHeroState}
          onDefeated={(id)=>{
            setFadingGuardian(id);
            setTimeout(()=>{
              setDefeatedGuardians(s=>{const n=new Set([...s,id]);defeatedGuardiansRef.current=n;return n;});
              setFadingGuardian(null);
            },1200);
          }}
          onDismiss={()=>{setModal(null);addLog(`You leave ${modal.data.name}.`);}}/>}
      {modal?.type==="tournament"&&
        <TournamentFight
          defeatedTournament={defeatedTournament}
          setDefeatedTournament={(s)=>{setDefeatedTournament(s);defeatedTournamentRef.current=s;}}
          heroState={heroState} setHeroState={setHeroState}
          addLog={addLog}
          groundItems={groundItems} setGroundItems={setGroundItems} heroPos={heroPos}
          onDead={()=>{setModal(null);setGameState("dead");}}
          onDismiss={()=>setModal(null)}/>}
      {modal?.type==="combat"&&
        <CombatScreen
          monster={modal.data} heroState={heroState} setHeroState={setHeroState}
          addLog={addLog}
          groundItems={groundItems} setGroundItems={setGroundItems} heroPos={heroPos}
          onVictory={()=>setModal(null)}
          onDefeat={()=>{setModal(null);setGameState("dead");}}
          onFlee={()=>{setModal(null);addLog("You flee to safety.");}}/>}
      {modal?.type==="multi_combat"&&
        <MultiCombatScreen
          monsters={modal.data}
          heroState={heroState} setHeroState={setHeroState}
          addLog={addLog}
          groundItems={groundItems} setGroundItems={setGroundItems} heroPos={heroPos}
          onVictory={()=>setModal(null)}
          onDefeat={()=>{setModal(null);setGameState("dead");}}
          onFlee={()=>{setModal(null);addLog("You flee to safety.");}}/>}
      {modal?.type==="ground"&&modal.data&&(
        <GroundItemsDialogue
          items={groundItems[modal.data.key]||[]}
          groundKey={modal.data.key}
          heroState={heroState}
          setHeroState={setHeroState}
          setGroundItems={setGroundItems}
          onDismiss={()=>setModal(null)}
        />
      )}
      {modal?.type==="merchant"&&merchantStock&&
        <MerchantDialogue stock={merchantStock} setStock={setMerchantStock} heroState={heroState} setHeroState={setHeroState} groundItems={groundItems} setGroundItems={setGroundItems} heroPos={heroPos} onDismiss={()=>{setModal(null);setMerchantStock(null);addLog("The merchant tips his hat and moves on.");}}/>}

      {gameState==="won"&&<WinScreen onContinue={()=>{setGameState("playing");addLog("You step out of the castle, your quest complete.");}}/>}
      {gameState==="castle"&&<CastleLevel heroState={heroState} setHeroState={setHeroState} addLog={addLog}
        initialState={pendingCastleState} saves={saves} saveMsg={saveMsg} onSaveGame={(snap)=>commitSave(snap)} onLoadGame={loadGame} onDeleteSave={deleteSave}
        onExit={(snap)=>{setPendingCastleState(snap);setGameState("playing");addLog("You return to the island.");}}
        onWin={(snap)=>{
          // Keep everything the hero earned (keys, opened doors, cleared
          // rooms, ice crystal/black belt) but reset levelIdx/heroPos so the
          // next castle entry starts fresh at level 1's entry stairs instead
          // of resuming right where the dragon fight ended, on level 2.
          // Omitting heroPos lets CastleLevel fall back to its own level-1
          // start position.
          setPendingCastleState(snap?{...snap,levelIdx:0,heroPos:undefined}:null);
          setGameState("won");
          addLog("🐉 The Golden Dragon falls! Victory!");
        }}
        onDeath={()=>setGameState("dead")}/>}
      {gameState==="dead"&&<GameOverScreen onRestart={()=>{setHeroState({...INIT_HERO});setHeroPos({x:23,y:14});heroPosRef.current={x:23,y:14};setDefeatedGuardians(new Set());defeatedGuardiansRef.current=new Set();setGameState("playing");setModal(null);pathRef.current=[];setLog(["Your quest begins anew at The Salty Cove Tavern."]);}}/>}
    </div>
  );
}
