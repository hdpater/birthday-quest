// Shared save-game storage helpers — used by both Game.jsx (writing/reading
// saves during play) and App.jsx (checking on boot whether any save exists,
// to decide whether to show the intro screen).
export const SAVES_KEY="birthday_quest_saves";
export const storageSet=async(k,v)=>{try{if(window.storage){await window.storage.set(k,v);}else{localStorage.setItem(k,v);}}catch{localStorage.setItem(k,v);}};
export const storageGet=async(k)=>{try{if(window.storage){const r=await window.storage.get(k);return r?r.value:null;}}catch{}return localStorage.getItem(k);};
