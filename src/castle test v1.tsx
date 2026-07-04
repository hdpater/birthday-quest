import React, { useState, useEffect, useRef, useCallback } from "react";

// ── Castle data (16 rooms, doors, keys) ──────────────────────────────────────
const CSIZE = 64;
const CASTLE_MAP = "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000111111111111111111111111111111111110000111111111111111111100000011111110000111111110000111100001111000011111000011111111110000001111111000011111111111011110000111101111111100001111111111000000111111100001111111100101111000011110100111110000111111111100001111111110000111111110010111100001111010011111000011111111110000001111111000011111111001011110000111101001111100001111111111000000111111100001111111100101111000011110100111110000111111111100000011111110000111111110010111100001111010011111000011111111110000000000000000000000000001000000000000001000000000001000000000000000000000000000000000000111111111111111100000000111100000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000111111111111000011111111111100001111111111111111111111111100000011110000111100001111000011110000111111111111010011111111110000001111000011110000111100001111000011111111111101001111111111000000111100001111000011110000111100001111111111110100111111111100000011110000111100001111000011110000111111111111010011111111110000001000000010000000111100001111000011111111111101001111111111000000111111111000000011110000111100001111111111110100111111111100000000000000111111111111000011110000111111111111010011111111110000000000000010010100111100001111000011111111111101001111111111000000111111111111010010100000100000000000000000000100001000000000000011111111111101001010000010000000000000111111110000100000000000001111111111110100101111001000000000000010000000000010000000000000111111111111010010000100100000000000001000000000001000000000000011111111111101001111010011110000111111111111111111111111110000001111111111110100111101001111000011111111000011110100111111000000111111111111010011110100111100001111111100001111010011111100000011111111111101001111010011110000111111110000111101001111110000001111111111110100111101001000000000000001000000000100000000000000000000000000010000000100100000000000000100000000010000000000000000000000001111000011110010000000000000011100001111000000000000000000000000100000001000001000000000000000010000100000000000000000000000000010000000100000111100001111111111110010111111111100000011111111111111111111000011110000111100001111001011111111110000001111111110100111111100001111011111110000111100101111111111000000111111111010011111110000111101001111110011110010111111111100000011111111101001111111000011110100101001001111001011111111110000001111111110100111111100001111010010100100111100101111111111000000111111111010011111110000111101001011110011110010111111111100000011111111101001111111000011110100100001001111001010000000000000001111111110100111111100001111010011110100111100111000000000000000111111111010011111110000111101001111010011110000111000000000000000000000001000000000000000000100111101001111000010100000000000000000000000100000111111111111110011110100111100001111111111000000111111111111111110000000000000000000010000000111111111111100000010001001000000001000000000000000001111111111110011111111110000001111100101111111111111111111000000100000000000001111111111000000111110010111111001011111111100000010000000000000111111111100000011111111011111100111111111110000111111111111000011111111110000001111100001111110000111111111000011111111111100001111111111000000111110000111111000011111111100001111111111110000111111111100000011111000011111100001111111110000111111111111000011111111110000001111100001111110000111111111000011111111111100001111111111000000111110000111111000011111111100001111111111110000111111111100000011111000011111100001111111110000111111111111000011111111110000001111100001111110000111111111000011111111111100001111111111000000111110000111111000011111111100001111111111110000111111111100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
const START = {x:0, y:6};
const ROOMS_DATA = [{"rx": 2, "ry": 2, "rw": 7, "rh": 8, "depth": 5, "id": "room_0"}, {"rx": 13, "ry": 2, "rw": 8, "rh": 8, "depth": 25, "id": "room_1"}, {"rx": 25, "ry": 2, "rw": 4, "rh": 8, "depth": 35, "id": "room_2"}, {"rx": 33, "ry": 2, "rw": 4, "rh": 8, "depth": 43, "id": "room_3"}, {"rx": 41, "ry": 2, "rw": 5, "rh": 8, "depth": 65, "id": "room_4"}, {"rx": 50, "ry": 2, "rw": 10, "rh": 8, "depth": 81, "id": "room_5"}, {"rx": 34, "ry": 14, "rw": 12, "rh": 9, "depth": 98, "id": "room_6"}, {"rx": 50, "ry": 14, "rw": 10, "rh": 9, "depth": 99, "id": "room_7"}, {"rx": 34, "ry": 27, "rw": 8, "rh": 4, "depth": 111, "id": "room_8"}, {"rx": 46, "ry": 27, "rw": 4, "rh": 4, "depth": 111, "id": "room_9"}, {"rx": 54, "ry": 27, "rw": 6, "rh": 4, "depth": 112, "id": "room_10"}, {"rx": 42, "ry": 35, "rw": 4, "rh": 12, "depth": 125, "id": "room_11"}, {"rx": 34, "ry": 35, "rw": 4, "rh": 4, "depth": 127, "id": "room_12"}, {"rx": 50, "ry": 35, "rw": 10, "rh": 7, "depth": 137, "id": "room_13"}, {"rx": 34, "ry": 43, "rw": 4, "rh": 4, "depth": 139, "id": "room_14"}, {"rx": 50, "ry": 46, "rw": 10, "rh": 14, "depth": 142, "id": "room_15"}, {"rx": 34, "ry": 51, "rw": 12, "rh": 9, "depth": 153, "id": "room_16"}, {"rx": 11, "ry": 49, "rw": 6, "rh": 11, "depth": 166, "id": "room_17"}, {"rx": 21, "ry": 49, "rw": 9, "rh": 11, "depth": 169, "id": "room_18"}, {"rx": 2, "ry": 49, "rw": 5, "rh": 11, "depth": 176, "id": "room_19"}, {"rx": 2, "ry": 36, "rw": 9, "rh": 9, "depth": 182, "id": "room_20"}, {"rx": 15, "ry": 36, "rw": 7, "rh": 9, "depth": 182, "id": "room_21"}, {"rx": 18, "ry": 14, "rw": 4, "rh": 9, "depth": 198, "id": "room_22"}, {"rx": 10, "ry": 14, "rw": 4, "rh": 5, "depth": 202, "id": "room_23"}, {"rx": 2, "ry": 23, "rw": 12, "rh": 9, "depth": 203, "id": "room_24"}, {"rx": 18, "ry": 27, "rw": 4, "rh": 5, "depth": 203, "id": "room_25"}, {"rx": 2, "ry": 14, "rw": 4, "rh": 5, "depth": 210, "id": "room_26"}, {"rx": 26, "ry": 14, "rw": 4, "rh": 9, "depth": 214, "id": "room_27"}, {"rx": 26, "ry": 27, "rw": 4, "rh": 4, "depth": 225, "id": "room_28"}, {"rx": 26, "ry": 35, "rw": 4, "rh": 10, "depth": 236, "id": "room_29"}];
const ENCOUNTERS_INIT = [{"type": "npc", "room": "room_0", "name": "Mysterious Stranger", "dialogue": "I need 20 gold pieces. In return I can help you.", "giveGold": 21, "cx": 5, "cy": 6, "removedOnDefeat": true, "requires": {"gold": 20}, "action": {"type": "reveal_secret", "text": "The wall shimmers... a passage appears!"}}, {"type": "merchant", "room": "room_1", "name": "Wandering Merchant", "cx": 17, "cy": 6, "removedOnDefeat": false}, {"type": "monster", "room": "room_3", "name": "Zombie", "level": 1, "health": 100, "strength": 10, "skill": 8, "armour": 3, "cx": 35, "cy": 6, "removedOnDefeat": true}, {"type": "monster", "room": "room_5", "name": "Goblin", "level": 3, "health": 100, "strength": 14, "skill": 12, "armour": 5, "cx": 55, "cy": 6, "removedOnDefeat": true}, {"type": "monster", "room": "room_6", "name": "Goblin", "level": 3, "health": 100, "strength": 14, "skill": 12, "armour": 5, "cx": 40, "cy": 18, "removedOnDefeat": true}, {"type": "monster", "room": "room_8", "name": "Orc", "level": 4, "health": 100, "strength": 16, "skill": 14, "armour": 6, "cx": 38, "cy": 29, "removedOnDefeat": true}, {"type": "monster", "room": "room_9", "name": "Orc", "level": 4, "health": 100, "strength": 16, "skill": 14, "armour": 6, "cx": 48, "cy": 29, "removedOnDefeat": true}, {"type": "monster", "room": "room_11", "name": "Wraith", "level": 5, "health": 100, "strength": 18, "skill": 16, "armour": 7, "cx": 44, "cy": 41, "removedOnDefeat": true}, {"type": "monster", "room": "room_12", "name": "Wraith", "level": 5, "health": 100, "strength": 18, "skill": 16, "armour": 7, "cx": 36, "cy": 37, "removedOnDefeat": true}, {"type": "monster", "room": "room_13", "name": "Wraith", "level": 5, "health": 100, "strength": 18, "skill": 16, "armour": 7, "cx": 55, "cy": 38, "removedOnDefeat": true}, {"type": "monster", "room": "room_14", "name": "Wraith", "level": 5, "health": 100, "strength": 18, "skill": 16, "armour": 7, "cx": 36, "cy": 45, "removedOnDefeat": true}, {"type": "monster", "room": "room_15", "name": "Wraith", "level": 5, "health": 100, "strength": 18, "skill": 16, "armour": 7, "cx": 55, "cy": 53, "removedOnDefeat": true}, {"type": "monster", "room": "room_16", "name": "Troll", "level": 6, "health": 100, "strength": 20, "skill": 18, "armour": 8, "cx": 40, "cy": 55, "removedOnDefeat": true}, {"type": "items", "room": "room_17", "items": ["Old Map", "Old Map"], "gold": 0, "cx": 14, "cy": 54, "removedOnDefeat": true}, {"type": "monster", "room": "room_18", "name": "Troll", "level": 6, "health": 100, "strength": 20, "skill": 18, "armour": 8, "cx": 25, "cy": 54, "removedOnDefeat": true}, {"type": "items", "room": "room_19", "items": ["Leather Armour"], "gold": 0, "cx": 4, "cy": 54, "removedOnDefeat": true}, {"type": "monster", "room": "room_20", "name": "Dark Knight", "level": 7, "health": 100, "strength": 22, "skill": 20, "armour": 9, "cx": 6, "cy": 40, "removedOnDefeat": true}, {"type": "monster", "room": "room_21", "name": "Dark Knight", "level": 7, "health": 100, "strength": 22, "skill": 20, "armour": 9, "cx": 18, "cy": 40, "removedOnDefeat": true}, {"type": "monster", "room": "room_22", "name": "Dark Knight", "level": 7, "health": 100, "strength": 22, "skill": 20, "armour": 9, "cx": 20, "cy": 18, "removedOnDefeat": true}, {"type": "items", "room": "room_23", "items": ["Health Potion"], "gold": 13, "cx": 12, "cy": 16, "removedOnDefeat": true}, {"type": "monster", "room": "room_24", "name": "Dark Knight", "level": 8, "health": 100, "strength": 24, "skill": 22, "armour": 10, "cx": 8, "cy": 27, "removedOnDefeat": true}, {"type": "monster", "room": "room_25", "name": "Dark Knight", "level": 8, "health": 100, "strength": 24, "skill": 22, "armour": 10, "cx": 20, "cy": 29, "removedOnDefeat": true}, {"type": "monster", "room": "room_27", "name": "Dark Knight", "level": 8, "health": 100, "strength": 24, "skill": 22, "armour": 10, "cx": 28, "cy": 18, "removedOnDefeat": true}, {"type": "monster", "room": "room_28", "name": "Dark Knight", "level": 9, "health": 100, "strength": 26, "skill": 24, "armour": 11, "cx": 28, "cy": 29, "removedOnDefeat": true}];
const DOORS_INIT = [{"cells": [[1, 6]], "id": "door_0", "locked": null}, {"cells": [[2, 19]], "id": "door_1", "locked": null}, {"cells": [[2, 48]], "id": "door_2", "locked": null}, {"cells": [[6, 14]], "id": "door_3", "locked": null}, {"cells": [[6, 48]], "id": "door_4", "locked": null}, {"cells": [[7, 51]], "id": "door_5", "locked": null}, {"cells": [[9, 2]], "id": "door_6", "locked": null}, {"cells": [[9, 14]], "id": "door_7", "locked": null}, {"cells": [[10, 19]], "id": "door_8", "locked": null}, {"cells": [[10, 22]], "id": "door_9", "locked": null}, {"cells": [[11, 36]], "id": "door_10", "locked": "yellow"}, {"cells": [[12, 2]], "id": "door_11", "locked": null}, {"cells": [[13, 22]], "id": "door_12", "locked": null}, {"cells": [[14, 36]], "id": "door_13", "locked": null}, {"cells": [[17, 21]], "id": "door_14", "locked": null}, {"cells": [[17, 49]], "id": "door_15", "locked": "red"}, {"cells": [[18, 23]], "id": "door_16", "locked": null}, {"cells": [[18, 26]], "id": "door_17", "locked": null}, {"cells": [[20, 23]], "id": "door_18", "locked": null}, {"cells": [[20, 35]], "id": "door_19", "locked": null}, {"cells": [[20, 49]], "id": "door_20", "locked": null}, {"cells": [[20, 51]], "id": "door_21", "locked": null}, {"cells": [[21, 2]], "id": "door_22", "locked": null}, {"cells": [[21, 4]], "id": "door_23", "locked": null}, {"cells": [[22, 14]], "id": "door_24", "locked": "orange"}, {"cells": [[24, 2]], "id": "door_25", "locked": "purple"}, {"cells": [[25, 14]], "id": "door_26", "locked": null}, {"cells": [[26, 23]], "id": "door_27", "locked": null}, {"cells": [[26, 26]], "id": "door_28", "locked": "green"}, {"cells": [[26, 31]], "id": "door_29", "locked": null}, {"cells": [[26, 34]], "id": "door_30", "locked": null}, {"cells": [[29, 2]], "id": "door_31", "locked": null}, {"cells": [[32, 2]], "id": "door_32", "locked": null}, {"cells": [[33, 37]], "id": "door_33", "locked": null}, {"cells": [[34, 39]], "id": "door_34", "locked": null}, {"cells": [[34, 42]], "id": "door_35", "locked": null}, {"cells": [[36, 39]], "id": "door_36", "locked": null}, {"cells": [[36, 50]], "id": "door_37", "locked": null}, {"cells": [[38, 35]], "id": "door_38", "locked": null}, {"cells": [[38, 38]], "id": "door_39", "locked": null}, {"cells": [[40, 4]], "id": "door_40", "locked": null}, {"cells": [[40, 26]], "id": "door_41", "locked": null}, {"cells": [[41, 31]], "id": "door_42", "locked": null}, {"cells": [[41, 35]], "id": "door_43", "locked": null}, {"cells": [[42, 27]], "id": "door_44", "locked": null}, {"cells": [[43, 34]], "id": "door_45", "locked": null}, {"cells": [[45, 27]], "id": "door_46", "locked": null}, {"cells": [[46, 2]], "id": "door_47", "locked": null}, {"cells": [[46, 14]], "id": "door_48", "locked": null}, {"cells": [[49, 2]], "id": "door_49", "locked": "blue"}, {"cells": [[49, 14]], "id": "door_50", "locked": null}, {"cells": [[49, 47]], "id": "door_51", "locked": null}, {"cells": [[50, 10]], "id": "door_52", "locked": null}, {"cells": [[50, 27]], "id": "door_53", "locked": null}, {"cells": [[50, 42]], "id": "door_54", "locked": null}, {"cells": [[50, 45]], "id": "door_55", "locked": null}, {"cells": [[52, 23]], "id": "door_56", "locked": null}, {"cells": [[52, 45]], "id": "door_57", "locked": null}, {"cells": [[53, 27]], "id": "door_58", "locked": null}];
const KEYS_INIT  = [{"x": 20, "y": 8, "keyType": "purple"}, {"x": 2, "y": 4, "keyType": "blue"}, {"x": 36, "y": 20, "keyType": "yellow"}, {"x": 41, "y": 20, "keyType": "orange"}, {"x": 21, "y": 42, "keyType": "red"}, {"x": 45, "y": 52, "keyType": "green"}];
const STAIRS = {x:29, y:44};
const KEY_COLORS = {"red": "#e74c3c", "blue": "#3498db", "green": "#2ecc71", "yellow": "#f1c40f", "purple": "#9b59b6", "orange": "#e67e22"};

const isPassable = (x,y) => {
  if(x<0||y<0||x>=CSIZE||y>=CSIZE) return false;
  return CASTLE_MAP[y*CSIZE+x]==="1";
};

const VIEW=15, CELL=32, CANVAS=VIEW*CELL, HALF=Math.floor(VIEW/2);

const C = {bg:"#0d0a06",panel:"#1a1208",border:"#3d2f18",gold:"#c9a84c",
  text:"#e8dcc8",dim:"#7a6a4a",red:"#c0392b",green:"#2d8a4e"};

const pnoise =(x,y)=>{const h=(x*374761393+y*668265263)^((x*668265263)+(y*374761393));return((h^(h>>13))*1274126177&0x7fffffff)/0x7fffffff;};
const pnoise2=(x,y)=>{const h=(x*1013904223+y*1664525)^((y*1013904223)+(x*22695477));return((h^(h>>15))*214013&0x7fffffff)/0x7fffffff;};

function NpcModal({enc,gold,setGold,C,setHeroKeys,addLog,setDefeatedRooms,onDismiss}){
  const [paid,setPaid]=React.useState(false);
  const canPay=!paid&&gold>=(enc.requires?.gold||0);
  const base={position:"fixed",inset:0,background:"#000c",display:"flex",
    alignItems:"center",justifyContent:"center",zIndex:200};
  const box={background:C.panel,border:`2px solid ${C.border}`,borderRadius:10,
    padding:20,maxWidth:340,width:"90%",color:C.text};
  return(
    <div style={base}><div style={box}>
      <div style={{color:"#6a9a8a",fontSize:14,marginBottom:10}}>🧙 {enc.name}</div>
      <div style={{fontSize:12,color:C.text,marginBottom:10,fontStyle:"italic"}}>"{enc.dialogue}"</div>
      {enc.requires?.gold&&<div style={{fontSize:11,color:C.dim,marginBottom:10}}>
        Requires: <span style={{color:C.gold}}>{enc.requires.gold} gold</span>
      </div>}
      {enc.action&&<div style={{fontSize:11,color:"#6a9a8a",marginBottom:14}}>
        Reward: {enc.action.type==="give_key"?`🗝 ${enc.action.keyType} key`:
          enc.action.type==="give_gold"?`💰 ${enc.action.amount} gold`:
          "🚪 Secret passage"}
      </div>}
      <div style={{display:"flex",gap:8}}>
        <button style={{flex:1,padding:"8px",background:"transparent",
          border:`1px solid ${C.gold}`,color:canPay?C.gold:"#444",
          cursor:canPay?"pointer":"not-allowed",borderRadius:4}}
          onClick={()=>{
            if(!canPay) return;
            setPaid(true);
            const act=enc.action;
            setGold(g=>g-(enc.requires?.gold||0));
            if(act.type==="give_key"){
              setHeroKeys(hk=>[...hk,act.keyType]);
              addLog(`🧙 You receive the ${act.keyType} key! (-${enc.requires?.gold||0}g)`);
            } else if(act.type==="give_gold"){
              setGold(g=>g+act.amount);
              addLog(`🧙 You receive ${act.amount} gold!`);
            } else if(act.type==="reveal_secret"){
              addLog("🧙 A hidden passage appears!");
            }
            onDismiss(true);
          }}>
          Pay {enc.requires?.gold||0}g
        </button>
        <button style={{flex:1,padding:"8px",background:"transparent",
          border:`1px solid ${C.dim}`,color:C.dim,cursor:"pointer",borderRadius:4}}
          onClick={()=>{
            const entryKey=`${enc.cx},${enc.cy}`;
            setDefeatedRooms(dr=>{const nd=new Set(dr);nd.delete(entryKey+"_triggered");return nd;});
            onDismiss(false);
          }}>
          Leave
        </button>
      </div>
    </div></div>
  );
}

export default function CastleBspTest(){
  const canvasRef=useRef(null);
  const pathRef=useRef([]);
  const stepRef=useRef(null);
  const walkRef=useRef(null);
  const heroPosRef=useRef({...START});
  const exploredRef=useRef(new Set());
  const doorsRef=useRef(null);
  const heroKeysRef=useRef(null);

  const [heroPos,setHeroPos]=useState({...START});
  const [target,setTarget]=useState(null);
  const [doors,setDoors]=useState(DOORS_INIT.map(d=>({...d,open:false})));
  const [groundKeys,setGroundKeys]=useState(KEYS_INIT);
  const [heroKeys,setHeroKeys]=useState([]);
  const [log,setLog]=useState(["You enter the great castle... find the keys to explore all 16 rooms!"]);
  const [msg,setMsg]=useState(null);
  const [encounters,setEncounters]=useState(ENCOUNTERS_INIT);
  const [defeatedRooms,setDefeatedRooms]=useState(new Set());
  const [encModal,setEncModal]=useState(null); // {type,enc}
  const [gold,setGold]=useState(50);
  const encRef=useRef(null);
  const lastCorridorRef=useRef({...START});
  useEffect(()=>{encRef.current=encounters;},[encounters]);

  useEffect(()=>{doorsRef.current=doors;},[doors]);
  useEffect(()=>{heroKeysRef.current=heroKeys;},[heroKeys]);

  const addLog=m=>setLog(p=>[m,...p].slice(0,20));

  // Door lookup: cell → door
  const doorAt=(x,y,doorList)=>{
    for(const d of doorList){
      for(const c of d.cells){
        if(c[0]===x&&c[1]===y) return d;
      }
    }
    return null;
  };

  // Passable considering doors
  const canPass=(x,y,doorList,keyList)=>{
    if(!isPassable(x,y)) return false;
    const d=doorAt(x,y,doorList);
    if(d&&!d.open&&d.locked){
      // locked - passable only with key
      return keyList.some(k=>k===d.locked);
    }
    return true; // unlocked doors open on contact
  };

  // ── LOS ray casting (doors block sight when closed) ────────────────────────
  const computeVis=useCallback((hx,hy,doorList)=>{
    const vis=new Set();
    vis.add(`${hx},${hy}`);
    const RAYS=360;
    for(let i=0;i<RAYS;i++){
      const a=(i/RAYS)*Math.PI*2;
      const dx=Math.cos(a),dy=Math.sin(a);
      let rx=hx+0.5,ry=hy+0.5;
      for(let s=0;s<VIEW+1;s++){
        const cx=Math.floor(rx),cy=Math.floor(ry);
        if(cx<0||cy<0||cx>=CSIZE||cy>=CSIZE)break;
        vis.add(`${cx},${cy}`);
        if(!isPassable(cx,cy))break;
        const d=doorAt(cx,cy,doorList);
        if(d&&!d.open&&!(cx===hx&&cy===hy))break; // ALL closed doors block sight
        rx+=dx;ry+=dy;
      }
    }
    return vis;
  },[]);

  // ── BFS path (doors passable if open or hero has key) ──────────────────────
  const bfsPath=useCallback((sx,sy,tx,ty,doorList,keyList,explored)=>{
    if(!isPassable(tx,ty))return null;
    if(sx===tx&&sy===ty)return[];
    const visited=new Set([sx*1000+sy]);
    const queue=[[sx,sy,[]]];
    const DIRS=[[0,-1],[0,1],[-1,0],[1,0]];
    while(queue.length){
      const[x,y,path]=queue.shift();
      for(const[dx,dy]of DIRS){
        const nx=x+dx,ny=y+dy,k=nx*1000+ny;
        if(visited.has(k))continue;
        if(!canPass(nx,ny,doorList,keyList))continue;
        if(explored&&!explored.has(`${nx},${ny}`))continue; // unexplored = impassable
        const np=[...path,[nx,ny]];
        if(nx===tx&&ny===ty)return np;
        visited.add(k);
        queue.push([nx,ny,np]);
      }
    }
    return null;
  },[]);

  // ── Draw ────────────────────────────────────────────────────────────────────
  const draw=useCallback((hx,hy,tgt,doorList,gKeys,encounters)=>{

  // Room floor patterns
  const ROOMS = [{"rx": 2, "ry": 2, "rw": 7, "rh": 8, "p": "chessboard", "pal": ["#6a3a8a", "#2a7a7a"]}, {"rx": 13, "ry": 2, "rw": 8, "rh": 8, "p": "chessboard", "pal": ["#6a3a8a", "#2a7a7a"]}, {"rx": 25, "ry": 2, "rw": 4, "rh": 8, "p": "noise", "pal": []}, {"rx": 33, "ry": 2, "rw": 4, "rh": 8, "p": "noise", "pal": []}, {"rx": 41, "ry": 2, "rw": 5, "rh": 8, "p": "noise", "pal": []}, {"rx": 50, "ry": 2, "rw": 10, "rh": 8, "p": "herringbone", "pal": ["#9a5030", "#4a5a70"]}, {"rx": 2, "ry": 14, "rw": 4, "rh": 5, "p": "noise", "pal": []}, {"rx": 10, "ry": 14, "rw": 4, "rh": 5, "p": "noise", "pal": []}, {"rx": 2, "ry": 23, "rw": 12, "rh": 9, "p": "concentric", "pal": ["#8a3a3a", "#b8a888", "#3a5a8a"]}, {"rx": 18, "ry": 14, "rw": 4, "rh": 9, "p": "noise", "pal": []}, {"rx": 18, "ry": 27, "rw": 4, "rh": 5, "p": "noise", "pal": []}, {"rx": 2, "ry": 36, "rw": 9, "rh": 9, "p": "concentric", "pal": ["#8a3a3a", "#b8a888", "#3a5a8a"]}, {"rx": 15, "ry": 36, "rw": 7, "rh": 9, "p": "concentric", "pal": ["#8a3a3a", "#b8a888", "#3a5a8a"]}, {"rx": 26, "ry": 14, "rw": 4, "rh": 9, "p": "noise", "pal": []}, {"rx": 26, "ry": 27, "rw": 4, "rh": 4, "p": "noise", "pal": []}, {"rx": 26, "ry": 35, "rw": 4, "rh": 10, "p": "noise", "pal": []}, {"rx": 2, "ry": 49, "rw": 5, "rh": 11, "p": "noise", "pal": []}, {"rx": 11, "ry": 49, "rw": 6, "rh": 11, "p": "chessboard", "pal": ["#6a3a8a", "#2a7a7a"]}, {"rx": 21, "ry": 49, "rw": 9, "rh": 11, "p": "chessboard", "pal": ["#7a5a30", "#4a5a6a"]}, {"rx": 34, "ry": 14, "rw": 12, "rh": 9, "p": "pinwheel", "pal": ["#3a508a", "#8a7028"]}, {"rx": 50, "ry": 14, "rw": 10, "rh": 9, "p": "chessboard", "pal": ["#4a7a3a", "#9b8a30"]}, {"rx": 34, "ry": 27, "rw": 8, "rh": 4, "p": "noise", "pal": []}, {"rx": 46, "ry": 27, "rw": 4, "rh": 4, "p": "noise", "pal": []}, {"rx": 54, "ry": 27, "rw": 6, "rh": 4, "p": "noise", "pal": []}, {"rx": 34, "ry": 35, "rw": 4, "rh": 4, "p": "noise", "pal": []}, {"rx": 34, "ry": 43, "rw": 4, "rh": 4, "p": "noise", "pal": []}, {"rx": 42, "ry": 35, "rw": 4, "rh": 12, "p": "noise", "pal": []}, {"rx": 34, "ry": 51, "rw": 12, "rh": 9, "p": "chessboard", "pal": ["#9b4a4a", "#4a6a9b"]}, {"rx": 50, "ry": 35, "rw": 10, "rh": 7, "p": "chessboard", "pal": ["#6a3a8a", "#2a7a7a"]}, {"rx": 50, "ry": 46, "rw": 10, "rh": 14, "p": "concentric", "pal": ["#8a3a3a", "#b8a888", "#3a5a8a"]}];
  const findRoom=(wx,wy)=>{for(const r of ROOMS){if(wx>=r.rx&&wx<r.rx+r.rw&&wy>=r.ry&&wy<r.ry+r.rh)return r;}return null;};
  const floorColor=(wx,wy)=>{
    const room=findRoom(wx,wy);
    if(!room||room.p==="noise"||!room.pal.length)return null;
    const lx=wx-room.rx,ly=wy-room.ry,rw=room.rw,rh=room.rh,pal=room.pal;
    let idx=0;
    if(room.p==="chessboard") idx=(lx+ly)%2;
    if(room.p==="concentric") idx=Math.min(lx,ly,rw-1-lx,rh-1-ly)%pal.length;
    if(room.p==="herringbone")idx=(Math.floor(lx/2)+Math.floor(ly/2))%2;
    if(room.p==="pinwheel")   idx=(Math.floor(lx/2)+Math.floor(ly/2))%2===0?(lx%2===0?0:1):(lx%2===0?1:0);
    return pal[idx%pal.length];
  };
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");
    const vis=computeVis(hx,hy,doorList);

    for(let vy=0;vy<VIEW;vy++){
      for(let vx=0;vx<VIEW;vx++){
        const wx=hx-HALF+vx,wy=hy-HALF+vy;
        const px=vx*CELL,py=vy*CELL;
        const cellKey=`${wx},${wy}`;
        const isVis=vis.has(cellKey);
        if(isVis)exploredRef.current.add(cellKey);
        const isExplored=exploredRef.current.has(cellKey);
        if(!isVis&&!isExplored){
          ctx.fillStyle="#000";ctx.fillRect(px,py,CELL,CELL);continue;
        }
        if(!isPassable(wx,wy)){
          const n=(pnoise(wx,wy)-0.5)*20;
          const v=Math.round(55+n);
          ctx.fillStyle=`rgb(${v},${v},${v})`;
          ctx.fillRect(px,py,CELL,CELL);
          ctx.globalAlpha=0.15;
          for(let i=0;i<4;i++){
            const ox=px+pnoise(wx+i*7,wy+i*3)*CELL;
            const oy=py+pnoise(wx+i*5,wy+i*9)*CELL;
            ctx.fillStyle="#000";
            ctx.fillRect(ox,oy,1+pnoise(wx+i*11,wy)*3,1);
          }
          ctx.globalAlpha=1;
        } else {
          const n=(pnoise(wx,wy)-0.5)*18+(pnoise2(wx,wy)-0.5)*8;
          const nr=Math.round(110+n),ng=Math.round(95+n*0.8),nb=Math.round(75+n*0.6);
          const patterned=floorColor(wx,wy);
          if(patterned){
            ctx.fillStyle=patterned;
            ctx.fillRect(px,py,CELL,CELL);
            // subtle noise stipple over pattern for texture
            ctx.globalAlpha=0.06+(pnoise2(wx*3,wy*3)*0.06);
            ctx.fillStyle=pnoise(wx*5,wy*5)>0.5?"#fff":"#000";
            ctx.fillRect(px,py,CELL,CELL);
            ctx.globalAlpha=1;
          } else {
            ctx.fillStyle=`rgb(${Math.min(255,Math.max(0,nr))},${Math.min(255,Math.max(0,ng))},${Math.min(255,Math.max(0,nb))})`;
            ctx.fillRect(px,py,CELL,CELL);
            const tileX=Math.floor(wx/2)*2,tileY=Math.floor(wy/2)*2;
            ctx.globalAlpha=0.12;ctx.fillStyle="#000";
            if(wx===tileX)ctx.fillRect(px,py,1,CELL);
            if(wy===tileY)ctx.fillRect(px,py,CELL,1);
            ctx.globalAlpha=1;
          }
          const bc=6+((pnoise(wx*3,wy*7)*5)|0);
          for(let i=0;i<bc;i++){
            const ox=px+pnoise(wx+i*17,wy+i*3)*CELL;
            const oy=py+pnoise(wx+i*5,wy+i*13)*CELL;
            ctx.globalAlpha=0.05+pnoise(wx+i*19,wy+i*23)*0.07;
            ctx.fillStyle=pnoise(wx+i*29,wy+i*31)>0.5?"#fff":"#000";
            ctx.beginPath();ctx.arc(ox,oy,0.5+pnoise(wx+i*11,wy+i*7)*1.5,0,Math.PI*2);ctx.fill();
          }
          ctx.globalAlpha=1;

          // Door rendering
          const d=doorAt(wx,wy,doorList);
          if(d){
            ctx.textAlign="center";ctx.textBaseline="middle";
            if(d.open){
              // open door: faint frame + open archway icon
              ctx.strokeStyle="#5a3a18aa";ctx.lineWidth=2;
              ctx.strokeRect(px+2,py+2,CELL-4,CELL-4);
              ctx.font=`${Math.round(CELL*0.55)}px serif`;
              ctx.globalAlpha=0.55;
              ctx.fillText("🚪",px+CELL/2,py+CELL/2); // door ajar, faded
              ctx.globalAlpha=1;
              // gap line to suggest open
              ctx.strokeStyle="#00000055";ctx.lineWidth=1;
              ctx.beginPath();ctx.moveTo(px+CELL*0.3,py+3);ctx.lineTo(px+CELL*0.3,py+CELL-3);ctx.stroke();
            } else if(d.locked){
              // locked: solid door + coloured padlock
              ctx.fillStyle="#4a3318";
              ctx.fillRect(px+1,py+1,CELL-2,CELL-2);
              const col=KEY_COLORS[d.locked]||"#888";
              ctx.strokeStyle=col;ctx.lineWidth=3;
              ctx.strokeRect(px+3,py+3,CELL-6,CELL-6);
              ctx.font=`${Math.round(CELL*0.5)}px serif`;
              ctx.fillText("🔒",px+CELL/2,py+CELL/2);
            } else {
              // closed unlocked: solid wooden door
              ctx.fillStyle="#4a3318";
              ctx.fillRect(px+1,py+1,CELL-2,CELL-2);
              ctx.strokeStyle="#7a5a30";ctx.lineWidth=2;
              ctx.strokeRect(px+3,py+3,CELL-6,CELL-6);
              ctx.font=`${Math.round(CELL*0.55)}px serif`;
              ctx.fillText("🚪",px+CELL/2,py+CELL/2);
            }
          }

          // Encounter icons — only on the encounter's own cell (cx,cy)
          {(()=>{
            const enc=(encounters||[]).find(e=>e.cx===wx&&e.cy===wy);
            if(enc){
              const icon=enc.type==="monster"?"👾":enc.type==="merchant"?"🧳":
                enc.type==="guardian"?"👁":enc.type==="npc"?"🧙":enc.type==="items"?"📦":"?";
              ctx.font=`${Math.round(CELL*0.7)}px serif`;
              ctx.textAlign="center";ctx.textBaseline="middle";
              ctx.fillText(icon,px+CELL/2,py+CELL/2+1);
            }
          })()}
          // Entrance marker
          if(wx===START.x&&wy===START.y){
            ctx.font=`${Math.round(CELL*0.6)}px serif`;
            ctx.textAlign="center";ctx.textBaseline="middle";
            ctx.fillText("🏰",px+CELL/2,py+CELL/2);
          }
          // Stairs marker
          if(wx===STAIRS.x&&wy===STAIRS.y){
            ctx.fillStyle="#1a1208";
            ctx.fillRect(px+2,py+2,CELL-4,CELL-4);
            ctx.font=`${Math.round(CELL*0.6)}px serif`;
            ctx.textAlign="center";ctx.textBaseline="middle";
            ctx.fillText("🪜",px+CELL/2,py+CELL/2);
          }
        }
        // Fog of war: explored but not currently visible → dimmed
        if(!isVis){
          ctx.fillStyle="rgba(0,0,0,0.55)";
          ctx.fillRect(px,py,CELL,CELL);
        }
      }
    }

    // Keys on ground
    (gKeys||[]).forEach(k=>{
      if(!vis.has(`${k.x},${k.y}`))return;
      const px=(k.x-(hx-HALF))*CELL+CELL/2;
      const py=(k.y-(hy-HALF))*CELL+CELL/2;
      const col=KEY_COLORS[k.keyType]||"#888";
      // glow
      const gg=ctx.createRadialGradient(px,py,3,px,py,CELL*0.7);
      gg.addColorStop(0,col+"aa");gg.addColorStop(1,col+"00");
      ctx.fillStyle=gg;ctx.beginPath();ctx.arc(px,py,CELL*0.7,0,Math.PI*2);ctx.fill();
      // key icon
      ctx.font=`${Math.round(CELL*0.6)}px serif`;
      ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillStyle=col;
      ctx.fillText("🗝",px,py);
    });

    // Target
    if(tgt&&vis.has(`${tgt.x},${tgt.y}`)){
      const px=(tgt.x-(hx-HALF))*CELL,py=(tgt.y-(hy-HALF))*CELL;
      ctx.strokeStyle="#ffffff55";ctx.lineWidth=1.5;
      ctx.strokeRect(px+1,py+1,CELL-2,CELL-2);
    }

    // Hero (same figure as before, simplified)
    {
      const px=HALF*CELL+CELL/2,py=HALF*CELL+CELL/2;
      const sc=CELL*0.45;
      ctx.fillStyle="rgba(0,0,0,0.3)";
      ctx.beginPath();ctx.ellipse(px,py+sc*1.1,sc*0.5,sc*0.18,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="#3a2a6a";ctx.lineWidth=sc*0.28;ctx.lineCap="round";
      ctx.beginPath();ctx.moveTo(px-sc*0.18,py+sc*0.35);ctx.lineTo(px-sc*0.22,py+sc*0.95);ctx.stroke();
      ctx.beginPath();ctx.moveTo(px+sc*0.18,py+sc*0.35);ctx.lineTo(px+sc*0.22,py+sc*0.95);ctx.stroke();
      const cg=ctx.createLinearGradient(px-sc*0.45,py-sc*0.1,px+sc*0.45,py+sc*0.4);
      cg.addColorStop(0,"#4a2a8a");cg.addColorStop(1,"#2a1050");
      ctx.fillStyle=cg;
      ctx.beginPath();
      ctx.moveTo(px-sc*0.12,py-sc*0.1);ctx.lineTo(px-sc*0.45,py+sc*0.5);
      ctx.lineTo(px+sc*0.45,py+sc*0.5);ctx.lineTo(px+sc*0.12,py-sc*0.1);
      ctx.closePath();ctx.fill();
      ctx.strokeStyle="#4a2a8a";ctx.lineWidth=sc*0.22;
      ctx.beginPath();ctx.moveTo(px-sc*0.12,py+sc*0.05);ctx.lineTo(px-sc*0.52,py+sc*0.3);ctx.stroke();
      ctx.beginPath();ctx.moveTo(px+sc*0.12,py+sc*0.05);ctx.lineTo(px+sc*0.52,py+sc*0.3);ctx.stroke();
      ctx.strokeStyle="#c0c0d0";ctx.lineWidth=sc*0.1;
      ctx.beginPath();ctx.moveTo(px+sc*0.52,py+sc*0.3);ctx.lineTo(px+sc*0.72,py-sc*0.15);ctx.stroke();
      const hg=ctx.createRadialGradient(px-sc*0.08,py-sc*0.42,sc*0.05,px,py-sc*0.38,sc*0.28);
      hg.addColorStop(0,"#e8c090");hg.addColorStop(1,"#c4885c");
      ctx.fillStyle=hg;ctx.beginPath();ctx.arc(px,py-sc*0.38,sc*0.26,0,Math.PI*2);ctx.fill();
      const hmg=ctx.createLinearGradient(px-sc*0.28,py-sc*0.72,px+sc*0.28,py-sc*0.38);
      hmg.addColorStop(0,"#d0d8e8");hmg.addColorStop(1,"#708090");
      ctx.fillStyle=hmg;
      ctx.beginPath();ctx.arc(px,py-sc*0.42,sc*0.28,Math.PI,0);
      ctx.lineTo(px+sc*0.32,py-sc*0.38);ctx.lineTo(px-sc*0.32,py-sc*0.38);
      ctx.closePath();ctx.fill();
      ctx.strokeStyle="#cc2233";ctx.lineWidth=sc*0.12;
      ctx.beginPath();ctx.moveTo(px,py-sc*0.68);ctx.quadraticCurveTo(px+sc*0.25,py-sc*0.82,px+sc*0.18,py-sc*0.55);ctx.stroke();
    }
  },[computeVis]);

  useEffect(()=>{draw(heroPos.x,heroPos.y,target,doors,groundKeys,encounters);},[heroPos,target,doors,groundKeys,encounters,draw]);

  // ── Walk ────────────────────────────────────────────────────────────────────
  const walk=useCallback(()=>{
    if(pathRef.current.length===0){setTarget(null);return;}
    const[nx,ny]=pathRef.current.shift();
    const dList=doorsRef.current;
    const kList=heroKeysRef.current;

    // Door handling
    const d=doorAt(nx,ny,dList);
    if(d&&!d.open){
      if(d.locked){
        if(kList.includes(d.locked)){
          setDoors(ds=>ds.map(x=>x.id===d.id?{...x,open:true}:x));
          addLog(`🗝 You unlock the ${d.locked} door!`);
          setMsg({text:`Unlocked with the ${d.locked} key!`,color:KEY_COLORS[d.locked]});
          setTimeout(()=>setMsg(null),1500);
        } else {
          pathRef.current=[];
          setTarget(null);
          addLog(`🔒 The door is locked. You need the ${d.locked} key.`);
          setMsg({text:`Locked! Find the ${d.locked} key.`,color:KEY_COLORS[d.locked]});
          setTimeout(()=>setMsg(null),2000);
          return;
        }
      } else {
        // unlocked door: opens on contact (permanently)
        setDoors(ds=>ds.map(x=>x.id===d.id?{...x,open:true}:x));
        addLog("You push the door open.");
      }
    }

    heroPosRef.current={x:nx,y:ny};
    setHeroPos({x:nx,y:ny});

    // Stairs?
    if(nx===STAIRS.x&&ny===STAIRS.y){
      pathRef.current=[];
      setTarget(null);
      setMsg({text:"🪜 Stairs to the next level! (Level 2 coming soon)",color:"#c9a84c"});
      setTimeout(()=>setMsg(null),2500);
      addLog("You found the stairs to the next level!");
    }
    // Track last corridor position (for flee)
    const inAnyRoom=ROOMS_DATA.some(r=>nx>=r.rx&&nx<r.rx+r.rw&&ny>=r.ry&&ny<r.ry+r.rh);
    if(!inAnyRoom) lastCorridorRef.current={x:nx,y:ny};

    // Room encounter trigger
    const encs=encRef.current||[];
    // Monster/guardian: whole room trigger (any cell)
    const wholeRoomEnc=encs.find(e=>{
      if(e.type!=="monster"&&e.type!=="guardian")return false;
      const r=ROOMS_DATA.find(r=>r.id===e.room);
      return r&&nx>=r.rx&&nx<r.rx+r.rw&&ny>=r.ry&&ny<r.ry+r.rh;
    });
    // Merchant/NPC/items: single square trigger
    const singleEnc=encs.find(e=>{
      if(e.type==="monster"||e.type==="guardian")return false;
      return e.cx===nx&&e.cy===ny;
    });
    const activeEnc=wholeRoomEnc||singleEnc;
    if(activeEnc){
      const entryKey=activeEnc.type==="monster"||activeEnc.type==="guardian"
        ?activeEnc.room:`${activeEnc.cx},${activeEnc.cy}`;
      setDefeatedRooms(dr=>{
        if(dr.has(entryKey+'_triggered'))return dr;
        const nd=new Set(dr); nd.add(entryKey+'_triggered');
        setTimeout(()=>setEncModal({type:activeEnc.type,enc:activeEnc,fromPos:{...lastCorridorRef.current}}),50);
        return nd;
      });
    }
    // Key pickup
    setGroundKeys(gk=>{
      const found=gk.find(k=>k.x===nx&&k.y===ny);
      if(found){
        setHeroKeys(hk=>[...hk,found.keyType]);
        addLog(`🗝 You found the ${found.keyType} key!`);
        setMsg({text:`Found the ${found.keyType} key!`,color:KEY_COLORS[found.keyType]});
        setTimeout(()=>setMsg(null),1500);
        return gk.filter(k=>k!==found);
      }
      return gk;
    });

    stepRef.current=setTimeout(()=>walkRef.current&&walkRef.current(),80);
  },[]);

  useEffect(()=>{walkRef.current=walk;});

  const handleClick=(e)=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const rect=canvas.getBoundingClientRect();
    const scaleX=CANVAS/rect.width,scaleY=CANVAS/rect.height;
    const cx=Math.floor((e.clientX-rect.left)*scaleX/CELL);
    const cy=Math.floor((e.clientY-rect.top)*scaleY/CELL);
    const wx=heroPosRef.current.x-HALF+cx;
    const wy=heroPosRef.current.y-HALF+cy;
    if(!isPassable(wx,wy))return;
    // Don't allow targeting unseen (black) squares — explored squares OK
    {
      const vis=computeVis(heroPosRef.current.x,heroPosRef.current.y,doorsRef.current);
      if(!vis.has(`${wx},${wy}`)&&!exploredRef.current.has(`${wx},${wy}`))return;
    }
    clearTimeout(stepRef.current);
    const path=bfsPath(heroPosRef.current.x,heroPosRef.current.y,wx,wy,doorsRef.current,heroKeysRef.current,exploredRef.current);
    if(!path){
      // try path ignoring key requirement to walk up to the locked door
      const path2=bfsPath(heroPosRef.current.x,heroPosRef.current.y,wx,wy,doorsRef.current.map(d=>({...d,open:true})),heroKeysRef.current,exploredRef.current);
      if(path2){
        // walk until we hit the locked door
        pathRef.current=path2;
        setTarget({x:wx,y:wy});
        walkRef.current&&walkRef.current();
      }
      return;
    }
    pathRef.current=path;
    setTarget({x:wx,y:wy});
    walkRef.current&&walkRef.current();
  };

  return(
    <div style={{background:C.bg,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{color:C.gold,fontSize:18,marginBottom:6,letterSpacing:"0.15em",textTransform:"uppercase"}}>Castle — Level 1</div>
      {/* Key ring */}
      <div style={{display:"flex",gap:6,marginBottom:8,minHeight:24,alignItems:"center"}}>
        <span style={{fontSize:12,padding:"2px 10px",borderRadius:10,border:"1px solid #c9a84c",color:"#c9a84c",background:"#0008"}}>💰 {gold}g</span>
        {heroKeys.length===0&&<span style={{color:"#444",fontSize:10}}>No keys yet</span>}
        {heroKeys.map((k,i)=>(
          <span key={i} style={{fontSize:14,padding:"2px 8px",borderRadius:10,border:`1.5px solid ${KEY_COLORS[k]}`,color:KEY_COLORS[k],background:"#0008"}}>🗝 {k}</span>
        ))}
      </div>
      <div style={{position:"relative"}}>
        <canvas ref={canvasRef} width={CANVAS} height={CANVAS}
          style={{width:"min(480px, 92vw)",height:"min(480px, 92vw)",cursor:"crosshair",border:`1px solid ${C.border}`,borderRadius:4}}
          onClick={handleClick}/>
        {msg&&(
          <div style={{position:"absolute",top:12,left:"50%",transform:"translateX(-50%)",
            background:"#000d",border:`2px solid ${msg.color}`,borderRadius:6,
            padding:"6px 16px",color:msg.color,fontSize:13,fontWeight:"bold",whiteSpace:"nowrap"}}>
            {msg.text}
          </div>
        )}
      </div>
      {/* Encounter Modals */}
      {encModal&&(()=>{
        const {type,enc}=encModal;
        const dismiss=(remove)=>{
          if(remove){
            // Remove by cx,cy for single-square encounters, by room for whole-room
            if(type==="monster"||type==="guardian"){
              setEncounters(es=>es.filter(e=>e.room!==enc.room));
            } else {
              setEncounters(es=>es.filter(e=>!(e.cx===enc.cx&&e.cy===enc.cy)));
            }
          }
          setEncModal(null);
        };
        const base={position:"fixed",inset:0,background:"#000c",display:"flex",
          alignItems:"center",justifyContent:"center",zIndex:200};
        const box={background:C.panel,border:`2px solid ${C.border}`,borderRadius:10,
          padding:20,maxWidth:340,width:"90%",color:C.text};

        if(type==="monster") return(
          <div style={base}><div style={box}>
            <div style={{color:C.red,fontSize:16,marginBottom:10}}>⚔ {enc.name} (Lv{enc.level})</div>
            <div style={{fontSize:11,color:C.dim,marginBottom:14}}>
              STR:{enc.strength} SKL:{enc.skill} ARM:{enc.armour}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={{flex:1,padding:"8px",background:"transparent",
                border:`1px solid ${C.red}`,color:C.red,cursor:"pointer",borderRadius:4}}
                onClick={()=>{addLog(`⚔ You defeat the ${enc.name}!`);dismiss(true);}}>
                ⚔ Fight (auto-win test)
              </button>
              <button style={{flex:1,padding:"8px",background:"transparent",
                border:`1px solid ${C.dim}`,color:C.dim,cursor:"pointer",borderRadius:4}}
                onClick={()=>{
                  addLog("You flee back the way you came!");
                  // Return to previous position
                  if(encModal.fromPos){
                    heroPosRef.current=encModal.fromPos;
                    setHeroPos(encModal.fromPos);
                    pathRef.current=[];setTarget(null);
                  }
                  // Clear trigger so monster fires again on re-entry
                  const entryKey=encModal.enc.room;
                  setDefeatedRooms(dr=>{const nd=new Set(dr);nd.delete(entryKey+'_triggered');return nd;});
                  dismiss(false);
                }}>
                Flee
              </button>
            </div>
          </div></div>
        );

        if(type==="guardian") {
          const [ans,setAns]=React.useState("");
          const [result,setResult]=React.useState(null);
          const check=()=>{
            const correct=ans.trim().toLowerCase()===enc.answer.toLowerCase();
            setResult(correct?"correct":"wrong");
            if(correct){addLog(`✓ The guardian nods and vanishes. +5 candles!`);}
            else{addLog(`✗ The guardian shakes its head.`);}
            setTimeout(()=>dismiss(correct),1200);
          };
          return(
            <div style={base}><div style={box}>
              <div style={{color:"#9b2335",fontSize:14,marginBottom:12}}>👁 {enc.name}</div>
              <div style={{fontSize:12,color:C.text,marginBottom:14,fontStyle:"italic"}}>"{enc.riddle}"</div>
              {!result&&<>
                <input value={ans} onChange={e=>setAns(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&check()}
                  placeholder="Your answer..."
                  style={{width:"100%",background:"#0d0a06",border:`1px solid ${C.border}`,
                    color:C.text,padding:"6px 10px",borderRadius:4,marginBottom:10,boxSizing:"border-box"}}/>
                <button onClick={check}
                  style={{width:"100%",padding:"8px",background:"transparent",
                    border:`1px solid ${C.gold}`,color:C.gold,cursor:"pointer",borderRadius:4}}>
                  Answer
                </button>
              </>}
              {result&&<div style={{textAlign:"center",fontSize:14,
                color:result==="correct"?"#6fcf97":C.red}}>
                {result==="correct"?"✓ Correct!":"✗ Wrong"}
              </div>}
            </div></div>
          );
        }

        if(type==="merchant") return(
          <div style={base}><div style={box}>
            <div style={{color:C.gold,fontSize:14,marginBottom:10}}>🧳 {enc.name}</div>
            <div style={{fontSize:11,color:C.dim,marginBottom:14}}>
              "Fine wares for the discerning adventurer."
            </div>
            <div style={{fontSize:11,color:C.text,marginBottom:14}}>
              (Full merchant screen would open here)
            </div>
            <button style={{width:"100%",padding:"8px",background:"transparent",
              border:`1px solid ${C.dim}`,color:C.dim,cursor:"pointer",borderRadius:4}}
              onClick={()=>{
                const entryKey=`${enc.cx},${enc.cy}`;
                setDefeatedRooms(dr=>{const nd=new Set(dr);nd.delete(entryKey+'_triggered');return nd;});
                dismiss(true);
              }}>
              Leave
            </button>
          </div></div>
        );

        if(type==="npc") return(
          <NpcModal enc={enc} gold={gold} setGold={setGold} C={C}
            setHeroKeys={setHeroKeys} addLog={addLog}
            setDefeatedRooms={setDefeatedRooms}
            onDismiss={(remove)=>{setEncModal(null);if(remove)setEncounters(es=>es.filter(e=>e.room!==enc.room));}}/>
        );
                if(type==="items") return(
          <div style={base}><div style={box}>
            <div style={{color:"#c9a84c",fontSize:14,marginBottom:10}}>📦 Items found!</div>
            {enc.gold>0&&<div style={{color:C.gold,fontSize:12,marginBottom:8}}>💰 {enc.gold} gold</div>}
            {enc.items.map((item,i)=>(
              <div key={i} style={{fontSize:11,color:C.text,marginBottom:4}}>• {item}</div>
            ))}
            <button style={{width:"100%",padding:"8px",marginTop:10,background:"transparent",
              border:`1px solid ${C.gold}`,color:C.gold,cursor:"pointer",borderRadius:4}}
              onClick={()=>{
                addLog(`📦 Picked up: ${enc.items.join(", ")}${enc.gold>0?" +"+enc.gold+"g":""}`);
                dismiss(true);
              }}>
              Take all
            </button>
          </div></div>
        );
        return null;
      })()}
      <div style={{marginTop:8,color:C.dim,fontSize:10,maxWidth:"min(480px, 92vw)",width:"100%"}}>{log[0]}</div>
      <div style={{marginTop:4,color:"#555",fontSize:9}}>Click to move • 🚪 doors open on contact • 🔒 need keys • Find the stairs 🪜</div>
    </div>
  );
}
