"""Build the small, attributed AWD city extract; never download data in the game.

python -m pip install -r tools/requirements-citymap.txt
python tools/build-city-geography.py .local/city3/ghana.osm.pbf
Source: https://download.geofabrik.de/africa/ghana.html (OSM, ODbL 1.0).
The country file and osmium location cache belong in ignored .local/ only.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import osmium
from shapely.geometry import LineString, Polygon, Point, box, shape
from shapely.ops import linemerge, unary_union, split, transform

ORIGIN = [5.556, -0.2]
BOUNDS = [5.50, -0.46, 5.79, 0.15]  # south, west, north, east; includes Prampram
COS = math.cos(math.radians(ORIGIN[0]))
def project(lon, lat):
    return ((lon - ORIGIN[1]) * 111320 * COS, -(lat - ORIGIN[0]) * 110574)
X0, Z1 = project(BOUNDS[1], BOUNDS[0])
X1, Z0 = project(BOUNDS[3], BOUNDS[2])
REGION = box(X0, Z0, X1, Z1)
def points(g):
    return [[round(x), round(z)] for x, z in g.coords]
def parts(g, kind):
    if g.is_empty:
        return []
    if g.geom_type == kind:
        return [g]
    return [p for child in getattr(g, 'geoms', []) for p in parts(child, kind)]
def rings(g):
    return [points(g.exterior)] + [points(r) for r in g.interiors]

class Extract(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.roads, self.coasts, self.water, self.green, self.places, self.features = [], [], [], [], [], []
    def node(self, n):
        if n.tags.get('place') in ['city', 'town', 'suburb', 'quarter', 'neighbourhood', 'village'] and n.tags.get('name'):
            x, z = project(n.location.lon, n.location.lat)
            if X0 <= x <= X1 and Z0 <= z <= Z1:
                self.places.append({'osm': n.id, 'name': n.tags['name'], 'p': [round(x), round(z)], 'll': [n.location.lat, n.location.lon]})
    def way(self, w):
        tags = dict(w.tags)
        highway = tags.get('highway', '')
        coast = tags.get('natural') == 'coastline'
        water = tags.get('natural') == 'water' or tags.get('waterway') == 'riverbank'
        green = tags.get('landuse') in ['forest', 'recreation_ground', 'grass', 'cemetery'] or tags.get('leisure') in ['park', 'nature_reserve', 'pitch'] or tags.get('natural') in ['wood', 'wetland']
        feature = tags.get('aeroway') in ['runway', 'aerodrome', 'terminal'] or tags.get('landuse') == 'industrial' or tags.get('man_made') == 'pier'
        road = highway in ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link', 'residential', 'unclassified', 'living_street', 'pedestrian']
        if not (coast or road or water or green or feature):
            return
        try:
            p = [project(n.lon, n.lat) for n in w.nodes]
        except osmium.InvalidLocationError:
            return
        if len(p) < 2:
            return
        line = LineString(p)
        if not line.intersects(REGION):
            return
        if coast:
            self.coasts.append(line)
        if road:
            # Retain way endpoints; simplify bends within 3m. Road ribbons cover
            # small offsets at unsplit intermediate-node junctions.
            for part in parts(line.intersection(REGION), 'LineString'):
                self.roads.append({'osm': w.id, 'kind': highway, 'name': tags.get('name', tags.get('ref', '')), 'p': points(part.simplify(3))})
        if feature:
            self.features.append({'osm': w.id, 'kind': tags.get('aeroway', tags.get('landuse', tags.get('man_made'))), 'name': tags.get('name', ''), 'p': points(line.simplify(5))})
        if len(p) > 3 and p[0] == p[-1] and (water or green):
            poly = Polygon(p).buffer(0).intersection(REGION).simplify(6, preserve_topology=True)
            for part in parts(poly, 'Polygon'):
                if part.area > (1800 if water else 6000):
                    (self.water if water else self.green).append({'osm': w.id, 'name': tags.get('name', ''), 'rings': rings(part)})

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pbf', type=Path)
    parser.add_argument('--output', type=Path, default=Path('client/public/assets/greater-accra.json'))
    args = parser.parse_args()
    fingerprint = hashlib.file_digest(args.pbf.open('rb'), 'sha256').hexdigest()
    data = Extract()
    cache = args.pbf.with_suffix('.extract.json')
    if cache.exists():
        saved = json.loads(cache.read_text(encoding='utf8'))
        if saved.get('_inputSha256') != fingerprint:
            raise RuntimeError('Extraction cache does not match input. Remove the ignored cache and rebuild.')
        for key, value in saved.items():
            if not key.startswith('_'):
                setattr(data, key, [LineString(p) for p in value] if key == 'coasts' else value)
    else:
        locations = osmium.NodeLocationsForWays(osmium.index.create_map('flex_mem'))
        osmium.apply(str(args.pbf), locations, osmium.filter.KeyFilter('place', 'highway', 'natural', 'leisure', 'landuse', 'aeroway', 'man_made', 'waterway'), data)
        saved = {key: ([list(l.coords) for l in value] if key == 'coasts' else value) for key, value in vars(data).items() if not key.startswith('_')}
        saved['_inputSha256'] = fingerprint
        cache.write_text(json.dumps(saved, separators=(',', ':'), ensure_ascii=False), encoding='utf8')
    area_cache = args.pbf.with_suffix('.water-areas.json')
    if area_cache.exists():
        saved_areas = json.loads(area_cache.read_text(encoding='utf8'))
        if saved_areas['inputSha256'] != fingerprint:
            raise RuntimeError('Water cache does not match input; clear the ignored cache.')
        water_areas = saved_areas['water']
    else:
        water_areas = []
        processor = osmium.FileProcessor(str(args.pbf)).with_areas(osmium.filter.TagFilter(('natural', 'water'))).with_filter(osmium.filter.EntityFilter(osmium.osm.AREA)).with_filter(osmium.filter.TagFilter(('natural', 'water'))).with_filter(osmium.filter.GeoInterfaceFilter())
        for area in processor:
            if area.from_way():
                continue
            geometry = transform(lambda x, y, z=None: project(x, y), shape(area.__geo_interface__['geometry'])).buffer(0).intersection(REGION).simplify(6, preserve_topology=True)
            for part in parts(geometry, 'Polygon'):
                if part.area > 1800:
                    water_areas.append({'osm': area.orig_id(), 'relation': True, 'name': area.tags.get('name', ''), 'rings': rings(part)})
        area_cache.write_text(json.dumps({'inputSha256': fingerprint, 'water': water_areas}, separators=(',', ':'), ensure_ascii=False), encoding='utf8')
    data.water.extend(water_areas)
    # Re-clip a cached extraction too, so refining the presentation boundary does
    # not leak out-of-extent geometry into the shipped database.
    data.roads = [dict(r, p=points(part)) for r in data.roads for part in parts(LineString(r['p']).intersection(REGION), 'LineString') if part.length > 1]
    data.places = [p for p in data.places if X0 <= p['p'][0] <= X1 and Z0 <= p['p'][1] <= Z1]
    for key in ['water', 'green']:
        setattr(data, key, [dict(r, rings=rings(part)) for r in getattr(data, key) for part in parts(Polygon(r['rings'][0], r['rings'][1:]).buffer(0).intersection(REGION), 'Polygon') if part.area > 10])
    data.features = [dict(r, p=points(part)) for r in data.features for part in parts(LineString(r['p']).intersection(REGION), 'LineString') if part.length > 1]
    coast = linemerge(unary_union(data.coasts))
    lines = parts(coast, 'LineString')
    # The coastline must actually cross both sides of our bounding rectangle.
    crossing = [l for l in lines if l.intersection(REGION).length > 2000]
    if len(crossing) != 1:
        raise RuntimeError('Coastline incomplete: ' + str([(l.bounds, l.length) for l in lines]))
    shore = crossing[0].intersection(REGION)
    polygons = parts(split(REGION, shore), 'Polygon')
    # The coast enters through the southern edge west of central Accra; both
    # land and sea therefore touch that edge. A known offshore south-east probe
    # disambiguates them; a northern city probe guards against an inverted sea.
    south = [p for p in polygons if p.contains(Point(X1 - 100, Z1 - 100))]
    if not south:
        raise RuntimeError('Could not identify sea polygon')
    if any(p.contains(Point(*project(-.2, 5.60))) for p in south):
        raise RuntimeError('Sea polygon incorrectly contains central Accra')
    with osmium.io.Reader(str(args.pbf)) as reader:
        timestamp = reader.header().get('osmosis_replication_timestamp')
    result = {'version': 1, 'source': 'OpenStreetMap / Geofabrik Ghana', 'license': 'ODbL-1.0', 'attribution': '© OpenStreetMap contributors', 'url': 'https://www.openstreetmap.org/copyright', 'snapshot': timestamp, 'inputSha256': fingerprint, 'origin': ORIGIN, 'bounds': BOUNDS, 'boundsMeters': [round(X0), round(X1), round(Z0), round(Z1)], 'roads': sorted(data.roads, key=lambda r: (r['osm'], r['p'][0])), 'coast': [points(l.simplify(5)) for l in parts(shore, 'LineString')], 'sea': [rings(p) for p in south], 'water': data.water, 'green': data.green, 'places': sorted(data.places, key=lambda p: p['osm']), 'features': data.features}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, separators=(',', ':'), ensure_ascii=False), encoding='utf8')
    print(json.dumps({'output': str(args.output), 'bytes': args.output.stat().st_size, 'roads': len(data.roads), 'places': len(data.places), 'coastParts': len(result['coast']), 'water': len(data.water), 'green': len(data.green), 'snapshot': timestamp}))

if __name__ == '__main__':
    main()
