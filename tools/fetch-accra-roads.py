"""Freeze a light OpenStreetMap road/coast network for the schematic Accra map."""
from pathlib import Path
import urllib.request,urllib.parse,json,math
ROOT=Path(__file__).resolve().parents[1]
query='[out:json][timeout:25];(way[highway~"^(trunk|primary|secondary)$"](5.525,-0.26,5.665,-0.125);way[natural=coastline](5.525,-0.26,5.665,-0.125););out geom;'
def simplify(points,eps=8):
 if len(points)<3:return points
 a,b=points[0],points[-1];dx=b[0]-a[0];dz=b[1]-a[1];length=math.hypot(dx,dz)or 1
 ds=[abs(dz*(p[0]-a[0])-dx*(p[1]-a[1]))/length for p in points];k=max(range(len(ds)),key=lambda i:ds[i])
 return points if len(points)<3 else simplify(points[:k+1],eps)[:-1]+simplify(points[k:],eps) if ds[k]>eps else [a,b]
for endpoint in ['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter']:
 try:
  req=urllib.request.Request(endpoint+'?'+urllib.parse.urlencode({'data':query}),headers={'User-Agent':'AccraWeDey-map-builder/1.0'})
  with urllib.request.urlopen(req,timeout=60)as r:data=json.load(r)
  break
 except Exception as e:print(endpoint,str(e),flush=True)
else:raise RuntimeError('No map data downloaded')
roads=[];coast=[];kx=111320*math.cos(math.radians(5.556))
for e in data['elements']:
 p=simplify([[(q['lon']+.2)*kx,-(q['lat']-5.556)*110574]for q in e['geometry']])
 row={'name':e['tags'].get('name',''),'kind':e['tags'].get('highway','coast'),'p':[[round(x,1),round(z,1)]for x,z in p]}
 (roads if row['kind']!='coast'else coast).append(row)
dest=ROOT/'client/public/assets/accra-roads.json';dest.write_text(json.dumps({'source':'OpenStreetMap contributors, ODbL 1.0','fetched':'2026-10-11','roads':roads,'coast':coast},separators=(',',':')))
print(len(roads),'roads',len(coast),'coast segments',dest.stat().st_size,flush=True)
