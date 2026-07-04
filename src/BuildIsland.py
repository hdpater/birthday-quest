import random, json, re, time
 
SIZE = 256
t0 = time.time()
 
with open("/tmp/island256_v5_land.txt") as f:
    land_compact = f.read().strip()
 
grid = [[land_compact[y*SIZE+x]=="1" for x in range(SIZE)] for y in range(SIZE)]
land_cells = [(x,y) for y in range(SIZE) for x in range(SIZE) if grid[y][x]]
print(f"Land cells: {len(land_cells)}")
 
def neighbours4(x,y):
    return [(nx,ny) for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)] if 0<=nx<SIZE and 0<=ny<SIZE]
 
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
 
nfn=make_noise(12345); random.seed(12345)
biome_names=["forest","plains","desert"]; seeds=[]; min_dist=SIZE*0.25; tries=0
while len(seeds)<6 and tries<5000:
    tries+=1; cx,cy=random.choice(land_cells)
    if any(((s[0]-cx)**2+(s[1]-cy)**2)**0.5<min_dist for s in seeds): continue
    bi=[0,0,0]
    for s in seeds: bi[s[2]]+=1
    seeds.append((cx,cy,bi.index(min(bi))))
 
WARP=SIZE*0.35; NS=0.18/8
biome_compact=""
for y in range(SIZE):
    for x in range(SIZE):
        if not grid[y][x]: biome_compact+="s"; continue
        wx=x+WARP*nfn(x*NS,y*NS+100); wy=y+WARP*nfn(x*NS+200,y*NS+300)
        nearest=seeds[0][2]; nd_=1e9
        for sx,sy,bi in seeds:
            d=(sx-wx)**2+(sy-wy)**2
            if d<nd_: nd_=d; nearest=bi
        biome_compact+={"forest":"f","plains":"p","desert":"d"}[biome_names[nearest]]
print("Biomes done")
 
def nearest_land(tx,ty):
    return min(land_cells, key=lambda p:(p[0]-tx)**2+(p[1]-ty)**2)
 
def bfs_from(sx,sy,max_d=None):
    dist={(sx,sy):0}; q=[(sx,sy)]; head=0
    while head<len(q):
        x,y=q[head]; head+=1
        if max_d and dist[(x,y)]>=max_d: continue
        for nx,ny in neighbours4(x,y):
            if grid[ny][nx] and (nx,ny) not in dist:
                dist[(nx,ny)]=dist[(x,y)]+1; q.append((nx,ny))
    return dist
 
portly_pixie=nearest_land(0,0)
dist_map=bfs_from(*portly_pixie)
max_dist=max(dist_map.values())
dist_flat=[dist_map.get((x,y),-1) for y in range(SIZE) for x in range(SIZE)]
print(f"Portly Pixie: {portly_pixie}, max_dist: {max_dist}")
 
buildings={
    "portly_pixie":list(portly_pixie),
    "castle":list(nearest_land(SIZE-1,SIZE-1)),
    "star_garter":list(nearest_land(SIZE-1,0)),
    "bedford_inn":list(nearest_land(0,SIZE-1)),
    "woodland":list(nearest_land(SIZE//2,0)),
    "jolly_smith":list(nearest_land(SIZE//4,SIZE*3//4)),
    "alvin":list(nearest_land(SIZE*3//4,SIZE//4)),
    "elethran":list(nearest_land(SIZE//2,SIZE//2)),
}
print(f"Castle: {buildings['castle']}")
 
is_coastal=lambda x,y: any(not grid[ny][nx] for nx,ny in neighbours4(x,y))
bld_set=set(map(tuple,buildings.values()))
forest_cells =[(x,y) for x,y in land_cells if biome_compact[y*SIZE+x]=='f' and (x,y) not in bld_set]
desert_cells =[(x,y) for x,y in land_cells if biome_compact[y*SIZE+x]=='d' and (x,y) not in bld_set]
plains_cells =[(x,y) for x,y in land_cells if biome_compact[y*SIZE+x]=='p' and (x,y) not in bld_set]
coastal_cells=[(x,y) for x,y in land_cells if is_coastal(x,y) and (x,y) not in bld_set]
random.seed(77)
def place_one(cells,excl):
    avail=[c for c in cells if c not in excl]; random.shuffle(avail)
    for c in avail:
        if not any(abs(c[0]-p[0])+abs(c[1]-p[1])<10 for p in excl): return c
    return avail[0]
placed=set(bld_set); guardians={}
for gid,cells in [("forest_golem",forest_cells),("oak_statue",forest_cells),
                   ("sand_golem",desert_cells),("sphinx",desert_cells),
                   ("iron_golem",plains_cells),("granite",plains_cells),
                   ("sea_golem",coastal_cells),("mermaid",coastal_cells)]:
    pos=place_one(cells,placed); guardians[gid]=list(pos); placed.add(pos)
 
castle=tuple(buildings["castle"])
dc=bfs_from(*castle,max_d=21)
dragon_cands=[p for p,d in dc.items() if 5<=d<=20 and p not in placed]
random.seed(999); dragon_pos=random.choice(dragon_cands); placed.add(dragon_pos)
 
pixie=tuple(buildings["portly_pixie"])
dp=bfs_from(*pixie,max_d=11)
arena_cands=[p for p,d in dp.items() if 4<=d<=10 and p not in placed]
random.seed(123); arena_pos=random.choice(arena_cands)
print(f"Dragon: {dragon_pos}, Arena: {arena_pos}")
 
data={"land":land_compact,"biome":biome_compact,"dist":dist_flat,"max_dist":max_dist,
      "buildings":buildings,"guardians":guardians,"dragon":list(dragon_pos),"arena":list(arena_pos)}
with open("/tmp/map_data_256_v5.json","w") as f:
    json.dump(data,f)
print(f"Done in {time.time()-t0:.1f}s  Size: {len(json.dumps(data))//1024}KB")
