// ── Weapons & Armour ──────────────────────────────────────────────────────────
export const WEAPONS = [
  {id:"club",       name:"Club",         slot:"either",strBonus:1, cost:1,     twoHanded:false, tier:1},
  {id:"dagger",     name:"Dagger",       slot:"either",strBonus:2, cost:4,     twoHanded:false, tier:1},
  {id:"mace",       name:"Mace",         slot:"either",strBonus:3, cost:75,    twoHanded:false, tier:2},
  {id:"morningstar",name:"Morning Star", slot:"either",strBonus:4, cost:125,   twoHanded:false, tier:2},
  {id:"shortsword", name:"Short Sword",  slot:"either",strBonus:5, cost:300,   twoHanded:false, tier:3},
  {id:"longsword",  name:"Long Sword",   slot:"right", strBonus:7, cost:500,   twoHanded:false, tier:4},
  {id:"greatsword", name:"Great Sword",  slot:"both",  strBonus:10,cost:1500,  twoHanded:true,  tier:5},
  {id:"greataxe",   name:"Great Axe",    slot:"both",  strBonus:9, cost:1200,  twoHanded:true,  tier:5},
];
export const ARMOUR_ITEMS = [
    //{id:"cheat",    name:"Cheat's Armour", slot:"body", strBonus:100, sklBonus:100,       armourBonus:100,  cost:8,    tier:1},
  {id:"leather",    name:"Leather Armour", slot:"body",        armourBonus:2,  cost:50,   tier:1},
  {id:"chainmail",  name:"Chainmail",      slot:"body",        armourBonus:5,  cost:320,  tier:2},
  {id:"plate",      name:"Plate Armour",   slot:"body",        armourBonus:8,  cost:1200, tier:3},
  {id:"mithril",    name:"Mithril Armour", slot:"body",        armourBonus:13, cost:9750, tier:4},
  {id:"leathercap", name:"Leather Cap",    slot:"head",        armourBonus:1,  cost:8,    tier:1},
  {id:"ironhelm",   name:"Iron Helm",      slot:"head",        armourBonus:2,  cost:100,  tier:2},
  {id:"greathelm",  name:"Great Helm",     slot:"head",        armourBonus:3,  cost:400,  tier:3},
  {id:"mithrilhelm",name:"Mithril Helm",   slot:"head",        armourBonus:5,  cost:2750, tier:4},
  {id:"boots",      name:"Leather Boots",  slot:"feet",        armourBonus:1,  cost:8,    tier:1},
  {id:"sabotons",   name:"Sabotons",       slot:"feet",        armourBonus:2,  cost:60,   tier:2},
  {id:"woodshield", name:"Wooden Shield",  slot:"left_shield", armourBonus:1,  cost:8,    tier:1},
  {id:"buckler",    name:"Buckler Shield", slot:"left_shield", armourBonus:2,  cost:50,   tier:2},
  {id:"ironshield", name:"Iron Shield",    slot:"left_shield", armourBonus:4,  cost:135,  tier:3},
];
export const FOOD = [
  {id:"wham",   name:"Wham Bar",         type:"food",price:1,    heal:5,  emoji:"🍬"},
  {id:"munch",  name:"Monster Munch",    type:"food",price:3,    heal:10, emoji:"👾"},
  {id:"butter", name:"Butterfinger",     type:"food",price:5,    heal:20, emoji:"🍫"},
  {id:"fifth",  name:"5th Avenue Bar",   type:"food",price:10,   heal:40, emoji:"🍫"},
  {id:"coffee", name:"Hot Can of Coffee",type:"food",price:20,   heal:60, emoji:"☕"},
  {id:"sevenup",name:"Cherry 7-up",      type:"food",price:50,   heal:100,emoji:"🥤"},
];
export const BOARD_PRICE = 10;
export const MAGIC_TYPES_LIST = ["fire","lightning","iron","green","sun","frost","arcane"];
export const MAGIC_FORMS_LIST = ["wand","potion","ring"];
export const MAGIC_BASE  = {wand:25, potion:10, ring:1000};
export const MAGIC_MULT  = {fire:1,lightning:1,iron:1,green:4,sun:4,frost:4,arcane:20};
export const MAGIC_COLOR = {fire:"#e74c3c",lightning:"#f39c12",iron:"#95a5a6",green:"#27ae60",sun:"#f1c40f",frost:"#2980b9",arcane:"#9b59b6"};
export const MAGIC_COMPS = {fire:["fire"],lightning:["lightning"],iron:["iron"],green:["fire","iron"],sun:["lightning","fire"],frost:["lightning","iron"],arcane:["fire","lightning","iron"]};
