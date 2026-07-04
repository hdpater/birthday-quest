with open("/mnt/user-data/outputs/game_256.jsx") as f:
    content = f.read()
 
old_terrain = """    // ── Terrain ──────────────────────────────────────────────────────────────
    // Pass 1: fill each cell with blurred colour (sample 3x3 neighbours, weighted)
    // We use an offscreen canvas for the blur so we can apply ctx.filter
    const offscreen = document.createElement('canvas');
    offscreen.width  = VIEW * S;
    offscreen.height = VIEW * S;
    const off = offscreen.getContext('2d');
 
    // Compute per-cell colour including noise + gradient + pathway
    const cellRGB = new Uint8Array(VIEW * VIEW * 3);
    for(let vy=0;vy<VIEW;vy++){
      for(let vx=0;vx<VIEW;vx++){
        const wx=hx-HALF+vx, wy=hy-HALF+vy;
        let r=26,g=78,bl=138;
        if(wx>=0&&wy>=0&&wx<SIZE&&wy<SIZE){
          const b=biomeAt(wx,wy);
          const base=BIOME_RGB[b]||[26,78,138];
          r=base[0]; g=base[1]; bl=base[2];
          const n1=(pnoise(wx,wy)-0.5)*28;
          const n2=(pnoise2(wx,wy)-0.5)*12;
          const n=n1+n2;
          r=Math.round(r+n); g=Math.round(g+n*0.75); bl=Math.round(bl+n*0.55);
          const grad=(wx+wy)/(SIZE*2);
          r=Math.round(r*(1-grad*0.22)+r*grad*1.1);
          g=Math.round(g*(1-grad*0.28));
          bl=Math.round(bl*(1-grad*0.32));
          if(PATHWAY[wy*SIZE+wx]){
            r=Math.round(r*0.42+185*0.58);
            g=Math.round(g*0.42+172*0.58);
            bl=Math.round(bl*0.42+148*0.58);
          }
        }
        const idx=(vy*VIEW+vx)*3;
        cellRGB[idx]  =Math.min(255,Math.max(0,r));
        cellRGB[idx+1]=Math.min(255,Math.max(0,g));
        cellRGB[idx+2]=Math.min(255,Math.max(0,bl));
      }
    }
 
    // Draw flat cells to offscreen canvas
    for(let vy=0;vy<VIEW;vy++){
      for(let vx=0;vx<VIEW;vx++){
        const idx=(vy*VIEW+vx)*3;
        off.fillStyle=`rgb(${cellRGB[idx]},${cellRGB[idx+1]},${cellRGB[idx+2]})`;
        off.fillRect(vx*S, vy*S, S, S);
      }
    }
 
    // Apply Gaussian blur on offscreen, then draw to main canvas
    // blur radius ~60% of cell size gives smooth biome blending
    const blurPx = Math.round(S * 0.65);
    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(offscreen, 0, 0);
    ctx.filter = 'none';
 
    // Pass 2: sub-cell texture blobs — 10-15 per cell, alpha-blended
    for(let vy=0;vy<VIEW;vy++){
      for(let vx=0;vx<VIEW;vx++){
        const wx=hx-HALF+vx, wy=hy-HALF+vy;
        if(wx<0||wy<0||wx>=SIZE||wy>=SIZE) continue;
        if(biomeAt(wx,wy)==='s') continue;
        const px=vx*S, py=vy*S;
        const blobCount=10+((pnoise(wx*3,wy*7)*5)|0); // 10-15 blobs
        for(let i=0;i<blobCount;i++){
          const bx=pnoise(wx+i*17,wy+i*3);
          const by=pnoise(wx+i*5, wy+i*13);
          const br=pnoise(wx+i*11,wy+i*7);
          const ba=pnoise(wx+i*19,wy+i*23);
          const light=pnoise(wx+i*29,wy+i*31)>0.5;
          const ox=px+bx*S;
          const oy=py+by*S;
          const rad=0.8+br*2.2;
          ctx.globalAlpha=0.06+ba*0.10;
          ctx.fillStyle=light?"#ffffff":"#000000";
          ctx.beginPath(); ctx.arc(ox,oy,rad,0,Math.PI*2); ctx.fill();
        }
        ctx.globalAlpha=1;
      }
    }"""
 
new_terrain = """    // ── Terrain ──────────────────────────────────────────────────────────────
    // Strategy: compute interpolated RGB for each cell by averaging a neighbourhood
    // weighted by a Gaussian kernel — this blends biome colours at boundaries.
    // Then apply ctx.filter blur for additional sub-cell softening.
 
    // Gaussian kernel radius in world cells (controls biome blend distance)
    const KERN=3; // samples ±3 cells → 7x7 kernel, smooth transitions
    const gaussW=(d2)=>Math.exp(-d2/(2*1.8*1.8)); // sigma=1.8 cells
 
    // Helper: get raw biome RGB for a world cell (with noise + gradient)
    const rawRGB=(wx,wy)=>{
      if(wx<0||wy<0||wx>=SIZE||wy>=SIZE) return [26,78,138]; // sea
      const b=biomeAt(wx,wy);
      const base=BIOME_RGB[b]||[26,78,138];
      let r=base[0],g=base[1],bl=base[2];
      const n=(pnoise(wx,wy)-0.5)*22+(pnoise2(wx,wy)-0.5)*10;
      r=Math.round(r+n); g=Math.round(g+n*0.75); bl=Math.round(bl+n*0.55);
      const grad=(wx+wy)/(SIZE*2);
      r=Math.round(r*(1-grad*0.22)+r*grad*1.1);
      g=Math.round(g*(1-grad*0.28));
      bl=Math.round(bl*(1-grad*0.32));
      if(PATHWAY[wy*SIZE+wx]){
        r=Math.round(r*0.42+185*0.58);
        g=Math.round(g*0.42+172*0.58);
        bl=Math.round(bl*0.42+148*0.58);
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
    }"""
 
assert old_terrain in content, "terrain not found"
content = content.replace(old_terrain, new_terrain)
 
with open("/mnt/user-data/outputs/game_256.jsx","w") as f:
    f.write(content)
print(f"Done: {len(content)//1024}KB")
