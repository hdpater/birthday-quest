// ── Weapons & Armour ──────────────────────────────────────────────────────────
export const WEAPONS = [
  {id:"dagger",     name:"Dagger",       slot:"either",strBonus:2, cost:8,     twoHanded:false, tier:1},
  {id:"mace",       name:"Mace",         slot:"either",strBonus:4, cost:55,    twoHanded:false, tier:2},
  {id:"shortsword", name:"Short Sword",  slot:"either",strBonus:5, cost:400,   twoHanded:false, tier:3},
  {id:"longsword",  name:"Long Sword",   slot:"right", strBonus:7, cost:900,   twoHanded:false, tier:4},
  {id:"greatsword", name:"Great Sword",  slot:"both",  strBonus:10,cost:1500,  twoHanded:true,  tier:5},
];
export const ARMOUR_ITEMS = [
  {id:"leather",    name:"Leather Armour", slot:"body",        armourBonus:2,  cost:8,    tier:1},
  {id:"chainmail",  name:"Chainmail",      slot:"body",        armourBonus:4,  cost:55,   tier:2},
  {id:"plate",      name:"Plate Armour",   slot:"body",        armourBonus:7,  cost:400,  tier:3},
  {id:"mithril",    name:"Mithril Armour", slot:"body",        armourBonus:11, cost:2750, tier:4},
  {id:"leathercap", name:"Leather Cap",    slot:"head",        armourBonus:1,  cost:8,    tier:1},
  {id:"ironhelm",   name:"Iron Helm",      slot:"head",        armourBonus:2,  cost:55,   tier:2},
  {id:"greathelm",  name:"Great Helm",     slot:"head",        armourBonus:4,  cost:400,  tier:3},
  {id:"mithrilhelm",name:"Mithril Helm",   slot:"head",        armourBonus:6,  cost:2750, tier:4},
  {id:"boots",      name:"Iron-shod Boots",slot:"feet",        armourBonus:1,  cost:8,    tier:1},
  {id:"woodshield", name:"Wooden Shield",  slot:"left_shield", armourBonus:2,  cost:8,    tier:1},
  {id:"ironshield", name:"Iron Shield",    slot:"left_shield", armourBonus:4,  cost:55,   tier:2},
];
export const FOOD = [
  {id:"wham",   name:"Wham Bar",         type:"food",price:1,    heal:5,  emoji:"🍬"},
  {id:"munch",  name:"Monster Munch",    type:"food",price:5,    heal:10, emoji:"👾"},
  {id:"butter", name:"Butterfinger",     type:"food",price:15,   heal:20, emoji:"🍫"},
  {id:"fifth",  name:"5th Avenue Bar",   type:"food",price:50,   heal:40, emoji:"🍫"},
  {id:"coffee", name:"Hot Can of Coffee",type:"food",price:80,   heal:60, emoji:"☕"},
  {id:"sevenup",name:"Cherry 7-up",      type:"food",price:150,  heal:100,emoji:"🥤"},
];
export const BOARD_PRICE = 10;
export const MAGIC_TYPES_LIST = ["fire","lightning","iron","green","sun","frost","arcane"];
export const MAGIC_FORMS_LIST = ["wand","potion","ring"];
export const MAGIC_BASE  = {wand:25, potion:10, ring:1000};
export const MAGIC_MULT  = {fire:1,lightning:1,iron:1,green:4,sun:4,frost:4,arcane:20};
export const MAGIC_COLOR = {fire:"#e74c3c",lightning:"#f39c12",iron:"#95a5a6",green:"#27ae60",sun:"#f1c40f",frost:"#2980b9",arcane:"#9b59b6"};
export const MAGIC_COMPS = {fire:["fire"],lightning:["lightning"],iron:["iron"],green:["fire","iron"],sun:["lightning","fire"],frost:["lightning","iron"],arcane:["fire","lightning","iron"]};
