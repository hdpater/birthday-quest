// ── Buildings ─────────────────────────────────────────────────────────────────
export const BUILDINGS = [
  {id:"portly_pixie",name:"The Portly Pixie",    type:"tavern",   x:23, y:14, color:"#c9a84c"},
  {id:"castle",      name:"The Castle",           type:"castle",   x:237, y:242, color:"#9b59b6"},
  {id:"star_garter", name:"Star & Garter",        type:"tavern",   x:244, y:24,  color:"#c9a84c"},
  {id:"bedford_inn", name:"Bedford Inn",          type:"tavern",   x:15, y:241, color:"#c9a84c"},
  {id:"woodland",    name:"Woodland Tavern",      type:"tavern",   x:133, y:11,  color:"#c9a84c"},
  {id:"jolly_smith", name:"The Jolly Blacksmith", type:"armourer", x:64, y:192, color:"#e74c3c"},
  {id:"alvin",       name:"Alvin's Armoury",      type:"armourer", x:192, y:64,  color:"#e74c3c"},
  {id:"elethran",    name:"Elethran's Magic Shop",type:"magic",    x:128, y:128, color:"#2ecc71"},
  {id:"arena",        name:"The Arena",             type:"arena",   x:25, y:16, color:"#c0392b"},
];
export const GUARDIANS = [
  {id:"forest_golem",name:"Forest Golem",  col:0,row:0,x:33,y:201},
  {id:"oak_statue",  name:"Oak Statue",    col:1,row:0,x:48,y:134},
  {id:"sand_golem",  name:"Sand Golem",    col:2,row:0,x:156,y:213},
  {id:"sphinx",      name:"Sphinx",        col:3,row:0,x:207,y:25},
  {id:"iron_golem",  name:"Iron Golem",    col:0,row:1,x:211,y:121},
  {id:"granite",     name:"Granite Statue",col:1,row:1,x:218,y:163},
  {id:"sea_golem",   name:"Sea Golem",     col:2,row:1,x:224,y:242},
  {id:"mermaid",     name:"Mermaid",       col:3,row:1,x:17,y:40},
];
export const GUARDIAN_RIDDLES = {
  forest_golem:{q:"After tequila comes vodka. What comes after vodka?",        a:["tequila"]},
  oak_statue:  {q:"The Innkeeper is called Roger. What is his wife called?",    a:["helen"]},
  sand_golem:  {q:"France, USA, Egypt and Jordan — where next?",               a:["japan"]},
  sphinx:      {q:"What is the profession of Rathiel?",                         a:["mage","wizard"]},
  iron_golem:  {q:"And now on Radio 4… what violent display of psychopathy?",  a:["debate"]},
  granite:     {q:"What is the last name of Izembard Zachariah?",               a:["thump"]},
  sea_golem:   {q:"Attack, attack, attack — use what? Defend, defend…",         a:["6"]},
  mermaid:     {q:"What is the real name of your friend Pelvis?",               a:["andrew davis","andy davis","andrew","andy"]},
};
export const GUARDIAN_ANGRY = {
  forest_golem:["The ancient wood creaks with fury — roots lash out!","The golem's amber eyes blaze with rage!"],
  oak_statue:  ["The oak statue animates, sword swinging wildly!","Ancient bark splits as the statue roars!"],
  sand_golem:  ["A sandstorm erupts from the golem's fury!","The desert itself rises against you!"],
  sphinx:      ["The Sphinx spreads its wings and strikes!","The Sphinx's eyes glow with deadly violet light!"],
  iron_golem:  ["The iron fist comes crashing down!","Steam vents as the golem attacks!"],
  granite:     ["Stone grinds as the statue swings its shield!","The granite warrior strikes with terrible force!"],
  sea_golem:   ["The sea golem crashes over you like a wave!","Seaweed and fury — it drags you under!"],
  mermaid:     ["The mermaid's song turns lethal — you reel in pain!","Her trident strikes before you can react!"],
};

