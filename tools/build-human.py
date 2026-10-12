"""Pack the CC0 MakeHuman continuous surface and adult shape targets for the browser."""
import json,pathlib,collections
ROOT=pathlib.Path(__file__).resolve().parents[1]; SRC=ROOT/'.local/human-source'
vertices=[];uv=[];faces=[];group='';groups=collections.Counter()
for line in (SRC/'base.obj').read_text().splitlines():
 s=line.split()
 if not s: continue
 if s[0]=='v': vertices.append(list(map(float,s[1:4])))
 elif s[0]=='vt': uv.append(list(map(float,s[1:3])))
 elif s[0]=='g': group=s[1]
 elif s[0]=='f':
  ids=[tuple(int(v)-1 if v else -1 for v in x.split('/')) for x in s[1:]]
  faces.append((group,ids));groups[group]+=1
print('groups',dict(groups),flush=True)
shapes={}
for gender in ['male','female']:
 p=[v[:] for v in vertices]
 for target in [f'african-{gender}-young.target',f'universal-{gender}-young-averagemuscle-averageweight.target']:
  for line in (SRC/target).read_text().splitlines():
   s=line.split()
   if not s or s[0].startswith('#'):continue
   i=int(s[0]);p[i]=[a+float(b) for a,b in zip(p[i],s[1:4])]
 shapes[gender]=p
 print(gender,[(round(min(v[a] for v in p),3),round(max(v[a] for v in p),3)) for a in range(3)],flush=True)
# Keep the authored surface, eyes and lashes. Helpers/joint markers are not render geometry.
keep=[(g,f) for g,f in faces if not any(k in g.lower() for k in ['joint','helper','ground','cage'])]
used=sorted({v[0] for _,f in keep for v in f});remap={old:i for i,old in enumerate(used)}
tri=[]
for g,f in keep:
 for i in range(1,len(f)-1):tri.extend([remap[f[0][0]],remap[f[i][0]],remap[f[i+1][0]]])
dest=ROOT/'client/public/assets/models/human.json'
def joints(p):
 result={}
 for g,f in faces:
  if not g.startswith('joint-'): continue
  ids={v[0] for gg,ff in faces if gg==g for v in ff}
  result[g[6:]]=[round(sum(p[i][a] for i in ids)/len(ids),5) for a in range(3)]
 return result
data={'source':'MakeHuman Community base.obj and African adult male/female targets; CC0',
 'joints':{'male':joints(shapes['male']),'female':joints(shapes['female'])},
 'male':[round(x,5) for i in used for x in shapes['male'][i]],'female':[round(x,5) for i in used for x in shapes['female'][i]],'triangles':tri}
# Preserve the artist-authored joint influences; proximity-based weights damage shoulders and faces.
def rig_name(name):
 side='Left' if name.endswith('.L') else 'Right'
 if name=='root' or name.startswith(('pelvis','spine05')):return 'Hips'
 if name in ['spine04','spine03']:return 'Spine'
 if name=='spine02' or name.startswith('breast'):return 'Spine1'
 if name=='spine01':return 'Spine2'
 if name.startswith('neck'):return 'Neck'
 if name.startswith('clavicle'):return side+'Shoulder'
 if name.startswith(('shoulder','upperarm')):return side+'Arm'
 if name.startswith('lowerarm'):return side+'ForeArm'
 if name.startswith(('wrist','finger','metacarpal')):return side+'Hand'
 if name.startswith('upperleg'):return side+'UpLeg'
 if name.startswith('lowerleg'):return side+'Leg'
 if name.startswith(('foot','toe')):return side+'Foot'
 return 'Head'
weights=[{} for _ in used]
for name,values in json.loads((SRC/'default_weights.mhw').read_text())['weights'].items():
 bone=rig_name(name)
 for old,weight in values:
  if old in remap:
   row=weights[remap[old]];row[bone]=row.get(bone,0)+weight
names=sorted({name for row in weights for name in row});indices=[];values=[]
for row in weights:
 entries=sorted(row.items(),key=lambda item:-item[1])[:4];total=sum(v for _,v in entries)
 if not total:raise ValueError('Unweighted body vertex')
 for i in range(4):
  indices.append(names.index(entries[i][0]) if i<len(entries) else 0)
  values.append(round(entries[i][1]/total,6) if i<len(entries) else 0)
data.update(weightBones=names,skinIndices=indices,skinWeights=values)
dest.write_text(json.dumps(data,separators=(',',':')))
print('packed',len(used),'vertices',len(tri)//3,'triangles',dest.stat().st_size,flush=True)
