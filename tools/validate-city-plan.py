"""Independent GEOS validation of shipped procedural footprints, not runtime code.
Uses the optional dependencies in tools/requirements-citymap.txt. No game writes.
"""
import json, math
from pathlib import Path
from shapely.geometry import Polygon, LineString
from shapely.strtree import STRtree

data=json.loads(Path('client/public/assets/greater-accra.json').read_text(encoding='utf8'))
plan=json.loads(Path('client/public/assets/city-blueprint.json').read_text(encoding='utf8'))
water=[Polygon(r[0],r[1:]) for r in data['sea']]+[Polygon(w['rings'][0],w['rings'][1:]) for w in data['water']]
green=[Polygon(w['rings'][0],w['rings'][1:]) for w in data['green']]
width=lambda kind:24 if 'motorway' in kind or 'trunk' in kind else 18 if 'primary' in kind else 13 if 'secondary' in kind else 10 if 'tertiary' in kind else 5 if kind=='pedestrian' else 6
roads=[LineString(r['p']).buffer(width(r['kind'])*.7,cap_style=2) for r in data['roads']]
trees=[STRtree(water),STRtree(green),STRtree(roads)]
violations=[]
for i,p in enumerate(plan['buildings']):
 x,z,w,d,_,angle,_,_,district,*_=p;c,s=math.cos(angle),math.sin(angle)
 footprint=Polygon([(x+a*c+b*s,z-a*s+b*c) for a,b in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]])
 for kind,geometries,tree in zip(['water','green','road'],[water,green,roads],trees):
  for index in tree.query(footprint,predicate='intersects'):
   area=footprint.intersection(geometries[index]).area
   if area>.01:violations.append({'building':i,'district':plan['districts'][district],'kind':kind,'overlapSquareMeters':round(area,3)})
report={'buildings':len(plan['buildings']),'violations':violations,'method':'Independent Shapely/GEOS polygon intersection; 0.01m² rounding tolerance'}
Path('.local/city3').mkdir(parents=True,exist_ok=True)
Path('.local/city3/placement-validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({'buildings':len(plan['buildings']),'violations':len(violations),'examples':violations[:12]}))
raise SystemExit(1 if violations else 0)
