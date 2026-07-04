import json, re
 
with open("/tmp/map_data_256_v5.json") as f:
    d = json.load(f)
 
pathway = d["pathway"]
print(f"Pathway cells: {sum(pathway)}, array len: {len(pathway)}")
 
with open("/mnt/user-data/outputs/game_256.jsx") as f:
    content = f.read()
 
# 1. Add PATHWAY constant after DIST
dist_line = re.search(r'const DIST  = \[[^\]]+\];', content)
pathway_str = "const PATHWAY = " + json.dumps(pathway) + ";\n"
content = content[:dist_line.end()] + "\n" + pathway_str + content[dist_line.end():]
 
# 2. Replace the terrain drawing loop with one that applies:
#    a) pathway (light grey overlay)
#    b) biome variation (noise-like using x,y position)
#    c) bottom-right darkening/reddening gradient
 
old_terrain = """    // Draw VIEW x VIEW cells centred on hero
    for(let vy=0;vy<VIEW;vy++){
      for(let vx=0;vx<VIEW;vx++){
        const wx=hx-HALF+vx, wy=hy-HALF+vy;
        const px=vx*CELL, py=vy*CELL;
        // Out of bounds → sea colour
        let r=26,g=78,bl=138;
        if(wx>=0&&wy>=0&&wx<SIZE&&wy<SIZE){
          const b=biomeAt(wx,wy);
          const rgb=BIOME_RGB[b]||[26,78,138];
          r=rgb[0];g=rgb[1];bl=rgb[2];
        }
        ctx.fillStyle=`rgb(${r},${g},${bl})`;
        ctx.fillRect(px,py,CELL,CELL);
      }
    }"""
 
new_terrain = """    // Draw VIEW x VIEW cells centred on hero
    // Pre-compute a tiny pseudo-noise for biome variation (fast, no import needed)
    const pnoise=(x,y)=>{
      const h=(x*374761393+y*668265263)^((x*668265263)+(y*374761393));
      return ((h^(h>>13))*1274126177&0x7fffffff)/0x7fffffff;
    };
    for(let vy=0;vy<VIEW;vy++){
      for(let vx=0;vx<VIEW;vx++){
        const wx=hx-HALF+vx, wy=hy-HALF+vy;
        const px=vx*CELL, py=vy*CELL;
        let r=26,g=78,bl=138;
        if(wx>=0&&wy>=0&&wx<SIZE&&wy<SIZE){
          const b=biomeAt(wx,wy);
          const base=BIOME_RGB[b]||[26,78,138];
          r=base[0]; g=base[1]; bl=base[2];
 
          // Biome variation: gentle per-cell noise ±12
          const n=(pnoise(wx,wy)-0.5)*24;
          r=Math.round(r+n); g=Math.round(g+n*0.8); bl=Math.round(bl+n*0.6);
 
          // Bottom-right gradient: redder and darker toward (SIZE,SIZE)
          const grad=((wx+wy)/(SIZE*2));  // 0 top-left → 1 bottom-right
          r=Math.round(r*(1-grad*0.25)+r*grad*1.15);
          g=Math.round(g*(1-grad*0.30));
          bl=Math.round(bl*(1-grad*0.35));
 
          // Pathway overlay: light grey-beige
          if(PATHWAY[wy*SIZE+wx]){
            r=Math.round(r*0.45+185*0.55);
            g=Math.round(g*0.45+178*0.55);
            bl=Math.round(bl*0.45+158*0.55);
          }
        }
        ctx.fillStyle=`rgb(${Math.min(255,Math.max(0,r))},${Math.min(255,Math.max(0,g))},${Math.min(255,Math.max(0,bl))})`;
        ctx.fillRect(px,py,CELL,CELL);
      }
    }"""
 
assert old_terrain in content, "Terrain loop not found"
content = content.replace(old_terrain, new_terrain)
 
with open("/mnt/user-data/outputs/game_256.jsx","w") as f:
    f.write(content)
 
print(f"Done: {len(content)//1024}KB")
assert "PATHWAY" in content
assert "pnoise" in content
assert "grad=" in content
print("All checks passed")
