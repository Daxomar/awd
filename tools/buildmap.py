#!/usr/bin/env python3
"""Real-Accra map builder: OpenStreetMap JSON (Overpass 'out geom') -> streamed game tiles.
World units are metres. +x = east, +z = south (so the camera looking 'north' looks toward -z).
Usage: python3 buildmap.py <roads_pois.json> [buildings*.json ...] <outdir>
Map data © OpenStreetMap contributors (ODbL)."""
import json, math, os, sys, collections

LAT0, LON0 = 5.5560, -0.2000          # world origin (between Makola/Ussher Town and Osu)
KX = 111320 * math.cos(math.radians(LAT0)); KZ = 110574
TILE = 250
def proj(lat, lon): return ((lon - LON0) * KX, -(lat - LAT0) * KZ)

ROAD_W = {'motorway': 16, 'trunk': 14, 'primary': 12, 'secondary': 10, 'tertiary': 8, 'unclassified': 6.5, 'residential': 6, 'living_street': 5,
          'service': 4.5, 'trunk_link': 8, 'primary_link': 8, 'secondary_link': 7, 'tertiary_link': 6, 'pedestrian': 5, 'track': 4, 'footway': 2.2, 'path': 1.8, 'steps': 2, 'cycleway': 2}
MAJOR = {'motorway', 'trunk', 'primary', 'secondary', 'trunk_link', 'primary_link', 'secondary_link'}

def simplify(pts, eps=0.8):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dx, dz = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dz) or 1e-9
    imax, dmax = 0, 0
    for i in range(1, len(pts)-1):
        d = abs(dz*(pts[i][0]-a[0]) - dx*(pts[i][1]-a[1])) / L
        if d > dmax: imax, dmax = i, d
    if dmax <= eps: return [a, b]
    return simplify(pts[:imax+1], eps)[:-1] + simplify(pts[imax:], eps)

def simplify_ring(pts, eps):
    # closed ring: split at the vertex farthest from the start so Douglas-Peucker has a real baseline
    ring = pts[:-1] if len(pts) > 1 and pts[0] == pts[-1] else pts
    if len(ring) < 4: return ring
    a = ring[0]; k = max(range(len(ring)), key=lambda i: (ring[i][0]-a[0])**2 + (ring[i][1]-a[1])**2)
    left = simplify(ring[:k+1], eps); right = simplify(ring[k:] + [a], eps)
    return left[:-1] + right[:-1]

def tkey(x, z): return (math.floor(x / TILE), math.floor(z / TILE))
def r1(v): return round(v, 1)

def split_by_tile(pts):
    """Cut a polyline into runs per tile; each run keeps one point of overlap so ribbons join seamlessly."""
    runs = []; cur = [pts[0]]; ck = tkey(*pts[0])
    for p in pts[1:]:
        cur.append(p); k = tkey(*p)
        if k != ck:
            runs.append((ck, cur)); cur = [cur[-2], p]; ck = k
    runs.append((ck, cur))
    return runs

def main():
    *ins, out = sys.argv[1:]
    os.makedirs(out + '/tiles', exist_ok=True)
    tiles = collections.defaultdict(lambda: {'r': [], 'd': [], 'l': [], 'p': [], 'b': []})
    places, venues, coast = [], [], []
    seen_b = set()
    for fn in ins:
        try: data = json.load(open(fn))
        except Exception as e: print('skip', fn, e); continue
        for e in data.get('elements', []):
            t = e.get('tags', {}); g = e.get('geometry')
            if e['type'] == 'node':
                x, z = proj(e['lat'], e['lon']); nm = t.get('name')
                if t.get('place') and nm: places.append({'n': nm, 'k': t['place'], 'x': r1(x), 'z': r1(z)})
                kind = t.get('amenity') or t.get('shop') or t.get('tourism') or t.get('leisure')
                if kind: tiles[tkey(x, z)]['p'].append([nm or '', kind, r1(x), r1(z)])
                continue
            if not g: continue
            pts = [proj(q['lat'], q['lon']) for q in g if q]
            if len(pts) < 2: continue
            if 'building' in t:
                if e['id'] in seen_b: continue
                seen_b.add(e['id'])
                pts = simplify_ring(pts, 0.35)
                if len(pts) < 3: continue
                pts = pts + [pts[0]]
                lv = t.get('building:levels'); h = t.get('height')
                try: lv = float(lv) if lv else 0
                except: lv = 0
                try: h = float(str(h).replace('m', '')) if h else 0
                except: h = 0
                cx = sum(p[0] for p in pts) / len(pts); cz = sum(p[1] for p in pts) / len(pts)
                flat = [c for p in pts[:-1] for c in (r1(p[0]), r1(p[1]))]
                tiles[tkey(cx, cz)]['b'].append([r1(h), lv, t.get('building', 'yes'), t.get('name', ''), flat])
                continue
            hw = t.get('highway')
            if hw in ROAD_W:
                pts = simplify(pts, 0.7)
                for k, run in split_by_tile(pts):
                    tiles[k]['r'].append([hw, ROAD_W[hw], 1 if t.get('oneway') == 'yes' else 0, t.get('name', '')[:40] if hw in MAJOR else '', [c for p in run for c in (r1(p[0]), r1(p[1]))]])
                continue
            if t.get('waterway') in ('drain', 'ditch', 'stream', 'canal', 'river'):
                pts = simplify(pts, 0.7)
                for k, run in split_by_tile(pts):
                    tiles[k]['d'].append([t['waterway'], [c for p in run for c in (r1(p[0]), r1(p[1]))]])
                continue
            if t.get('natural') == 'coastline':
                coast.append([[r1(p[0]), r1(p[1])] for p in pts]); continue
            area = t.get('landuse') or t.get('leisure') or t.get('natural') or t.get('amenity')
            if area and pts[0] == pts[-1] or (area and len(pts) > 3 and math.hypot(pts[0][0]-pts[-1][0], pts[0][1]-pts[-1][1]) < 1):
                pts = simplify(pts, 1.0)
                cx = sum(p[0] for p in pts) / len(pts); cz = sum(p[1] for p in pts) / len(pts)
                flat = [c for p in pts[:-1] for c in (r1(p[0]), r1(p[1]))]
                if len(flat) >= 6: tiles[tkey(cx, cz)]['l'].append([area, t.get('name', ''), flat])
                if t.get('name') and area in ('marketplace', 'park', 'stadium', 'beach', 'university', 'hospital', 'aerodrome', 'school', 'place_of_worship', 'mall', 'pitch', 'sports_centre', 'bus_station', 'parking'):
                    venues.append({'n': t['name'], 'k': area, 'x': r1(cx), 'z': r1(cz)})
    # coastline: south-most sea line per 10 m of x (Accra's coast runs roughly east-west)
    cz = {}
    for line in coast:
        for (x0, z0), (x1, z1) in zip(line, line[1:]):
            n = max(1, int(abs(x1 - x0) / 5))
            for i in range(n + 1):
                x = x0 + (x1 - x0) * i / n; z = z0 + (z1 - z0) * i / n; k = int(round(x / 10))
                cz[k] = min(cz.get(k, 1e9), z)
    xs = sorted(cz)
    coast_s = [[k * 10, round(cz[k], 1)] for k in xs]
    index = {'origin': [LAT0, LON0], 'tile': TILE, 'tiles': {}, 'places': places, 'venues': venues, 'coast': coast_s, 'attribution': 'Map data © OpenStreetMap contributors (ODbL)'}
    for (tx, tz), d in tiles.items():
        name = f'{tx}_{tz}.json'
        json.dump(d, open(f'{out}/tiles/{name}', 'w'), separators=(',', ':'))
        index['tiles'][f'{tx},{tz}'] = [len(d['r']), len(d['b']), len(d['l'])]
    json.dump(index, open(f'{out}/world.json', 'w'), separators=(',', ':'))
    xs_all = [int(k.split(',')[0]) for k in index['tiles']]; zs_all = [int(k.split(',')[1]) for k in index['tiles']]
    print('tiles', len(tiles), 'x', min(xs_all), max(xs_all), 'z', min(zs_all), max(zs_all), 'places', len(places), 'venues', len(venues), 'coast pts', len(coast_s), 'buildings', len(seen_b))

if __name__ == '__main__': main()
