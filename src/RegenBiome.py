import json, random, math
 
SIZE = 256
 
with open("/tmp/island256_v5_land.txt") as f:
    land_compact = f.read().strip()
 
grid = [[land_compact[y*SIZE+x]=="1" for x in range(SIZE)] for y in range(SIZE)]
land_cells = [(x,y) for y in range(SIZE) for x in range(SIZE) if grid[y][x]]
 
def make_noise(seed):
    random.seed(seed); TABLE=256; perm=list(range(TABLE))
    for i in range(TABLE-1,0,-1):
        j=random.randint(0,i); perm[i],perm[j]=perm[j],perm[i]
    vals=[random.random()*2-1 for _ in range(TABLE)]
    def fade(t): return t*t*t*(t*(t*6-15)+10)
    def lerp(a,b,t): return a+t*(b-a)
    def noise(x,y):
        xi=int(x)&(TABLE-1); yi=int(y)&(TABLE-1)
        xf=x-int(x); yf=y-int(y); u=fade(xf); v=fade(yf)
        aa=perm[(perm[xi]+yi)&(TABLE-1)]; ab=perm[(perm[xi]+yi+1)&(TABLE-1)]
        ba=perm[(perm[xi+1]+yi)&(TABLE-1)]; bb=perm[(perm[xi+1]+yi+1)&(TABLE-1)]
        return lerp(lerp(vals[aa],vals[ba],u),lerp(vals[ab],vals[bb],u),v)
    return noise
 
nfn = make_noise(99999)
 
# New biome logic:
# Use diagonal position: diag = (x+y) / (2*SIZE) goes 0 (top-left) → 1 (bottom-right)
# Warp with noise for natural boundaries
# diag < 0.35 → forest, diag > 0.65 → desert, else plains
 
WARP = 35.0  # noise warp amount in pixels
NS = 0.025   # noise frequency
 
biome_compact = ""
for y in range(SIZE):
    for x in range(SIZE):
        if not grid[y][x]:
            biome_compact += "s"
            continue
        # Warp the position
        wx = x + WARP * nfn(x*NS,       y*NS + 10)
        wy = y + WARP * nfn(x*NS + 20,  y*NS + 30)
        # Diagonal gradient 0..1
        diag = (wx + wy) / (2.0 * SIZE)
        if diag < 0.38:
            biome_compact += "f"
        elif diag > 0.62:
            biome_compact += "d"
        else:
            biome_compact += "p"
 
# Report distribution
counts = {b: biome_compact.count(b) for b in "fpds"}
total_land = land_compact.count("1")
for b,n in counts.items():
    print(f"  {b}: {n} ({n/total_land*100:.1f}% of land)" if b!='s' else f"  {b}: {n}")
 
print("Biome generation done")
 
# Save and patch into game
with open("/tmp/map_data_256_v5.json") as f:
    d = json.load(f)
d["biome"] = biome_compact
with open("/tmp/map_data_256_v5.json","w") as f:
    json.dump(d, f)
 
# Update biome seeds for guardian placement (forest=top-left, desert=bottom-right)
import re
with open("/mnt/user-data/outputs/game_256.jsx") as f:
    content = f.read()
 
old_biome = re.search(r'const BIOME = "[fpds]+";', content).group()
new_biome = f'const BIOME = "{biome_compact}";'
content = content.replace(old_biome, new_biome)
 
with open("/mnt/user-data/outputs/game_256.jsx","w") as f:
    f.write(content)
print(f"Done: {len(content)//1024}KB")
