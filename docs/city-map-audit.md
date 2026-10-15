# Phase 3 map audit (before implementation)

The old map uses continuous legacy metres centred on 5.556 N, 0.200 W,
scaled by .0065 for display. The saved catalogue is the compatibility boundary;
map presentation can change without changing travel coordinates. Server travel
uses the catalogue and transport rules, not the rendered road network.

`map.js` draws 63 anchors (55 destinations plus eight homes). Sixteen of the
destinations are neighbourhood/estate entry points. The remaining 39 are venues.
`neighbourhood.js`, `world.js`, `homes.js` and the room kits implement playable
interiors separately. No rendered city filler is a functional property or venue.
Existing terrain is a 220×240 plane, schematic ten-route road asset and a
five-point shore. Coverage stops around central Accra and East Legon, with camera
bounds [-48,52,-84,36]. Tema and outer suburbs have no meaningful representation.

Buildings use repeated four-corner plots, two height bands and area palettes.
Landmarks use `kit.js` miniatures. `bake.js` merges transformed geometry but does
not reclaim original plot geometries. There is no city chunk lifecycle or LOD.
Billboard refresh removes scene objects without releasing their resources and
keeps an unbounded texture cache. Markers overlap; labels lack collision rules.
All city meshes are built at game entry, even when the map is closed.

Baseline, Chromium SwiftShader at 390×844, render pixel ratio .6, daylight13:
58 draw calls, 741,511 rendered triangles; 120 map meshes; 93,369,726 bytes of
unique map geometry buffers; 93 renderer geometries and 18 textures including
the hidden room. Seven synchronous GPU-fenced software renders were
7.9,8.7,7.3,7.7,246.4,143.3,17.3ms. These are diagnostic software timings, not
physical-phone FPS. Initial ready observation20.67s includes room startup.
Screenshots: `docs/images/city/before-*.png`. Raw metrics are retained locally;
the implementation report will include comparable after measurements.

Research boundary: 5.50–5.87 N, .46 W–.20 E. It covers the existing catalogue,
Kasoa corridor through central Accra and Tema to Prampram, and northern suburbs
through Oyarifa. Beyond this rectangle is outside this milestone. Proposed new
districts are geographic scenery, not new gameplay destinations. District names
must be resolved against sourced place nodes; any manual art anchors will be
identified. OpenStreetMap/Geofabrik provides roads, coast, water and place data
under ODbL. The raw country PBF stays outside version control and client payloads.

Baseline captured before map edits on 2026-10-15 at commit 5146ead.

## Compatibility inventory

All selectable venues / neighbourhoods / estates (IDs are authoritative):

| ID | Name | Area | Saved x,z |
|---|---|---|---|
| circle | Kwame Nkrumah Circle | Circle | -1673, -1581 |
| muni | Auntie Muni's Waakye | Circle | -1551, -1493 |
| makola | Makola Market | Accra Central | -787, 874 |
| kantamanto | Kantamanto Market | Accra Central | -1385, 774 |
| chopbar | Who Jah Bless Chop Bar | Accra Central | -554, 663 |
| kenkey | Sweet Mother Kenkey | Jamestown | -942, 2377 |
| oxford | Oxford Street, Osu | Osu | 1884, -276 |
| vibes | Vibes Lounge, Osu | Osu | 2050, -199 |
| hub | Sankofa Tech Hub, Osu | Osu | 2327, -166 |
| bank | Gold Coast Bank, Ridge | Ridge | 499, -829 |
| ridge | Ridge Hospital | Ridge | 78, -719 |
| korlebu | Korle Bu Teaching Hospital | Korle Bu | -2903, 2001 |
| police | Osu Police Station | Osu | 1662, 0 |
| memorial | Kwame Nkrumah Memorial Park | Accra Central | -355, 1261 |
| blackstar | Black Star Square | Osu | 864, 951 |
| castle | Osu Castle | Osu | 2249, 1117 |
| lighthouse | Jamestown Lighthouse | Jamestown | -1396, 2587 |
| bukom | Bukom Boxing Arena | Jamestown | -2305, 2200 |
| canoes | Jamestown Canoe Beach | Jamestown | -1141, 2676 |
| labadi | Labadi Beach | La | 5872, -398 |
| funeral | La Funeral Grounds | La | 4875, -885 |
| church | Glorious Fire Ministry | Osu | 1330, -442 |
| mosque | Nima Central Mosque | Nima | 166, -2985 |
| stadium | Accra Sports Stadium | Osu | 853, 520 |
| viewing | Nima Football Viewing Centre | Nima | 0, -2654 |
| radio | Sankofa FM Studios | Labone | 3324, -995 |
| mall | Accra Mall | Tetteh Quarshie | 2892, -7375 |
| ug | University of Ghana, Legon | Legon | 1440, -10482 |
| airport | Kotoka International Airport | Airport | 3678, -5440 |
| hotel | Labadi Beach Hotel | La | 5207, -608 |
| ama | Accra Metropolitan Assembly | Accra Central | -111, 663 |
| cars | Correct Cars, Spintex Road | Spintex | 6094, -6524 |
| momo | Blessed MoMo Agent | Circle | -1773, -1681 |
| cinema | Silverbird Cinemas, Accra Mall | Tetteh Quarshie | 2980, -7386 |
| court | Law Court Complex, High Street | Accra Central | -620, 1327 |
| aboki | Aboki Khebab Joint, Oxford Street | Osu | 2138, -885 |
| fanyogo | FanYogo Ice Cream Stop, Circle | Circle | -2194, -1482 |
| restaurant | Oxford Street Restaurant, Osu | Osu | 2260, -166 |
| gymlegon | East Legon Fitness Club | East Legon | 4044, -8735 |
| e:nima | Nima player estate | Nima | 332, -2952 |
| n:nima | Nima neighbourhood | Nima | 199, -2897 |
| e:jtown | Jamestown player estate | Jamestown | -886, 2411 |
| n:jtown | Jamestown neighbourhood | Jamestown | -1019, 2466 |
| e:kaneshie | Kaneshie player estate | Kaneshie | -3656, -1570 |
| n:kaneshie | Kaneshie neighbourhood | Kaneshie | -3789, -1515 |
| e:labadi | Labadi player estate | Labadi | 5097, -575 |
| n:labadi | Labadi neighbourhood | Labadi | 4964, -520 |
| e:osu | Osu player estate | Osu | 2216, -243 |
| n:osu | Osu neighbourhood | Osu | 2083, -188 |
| e:airres | Airport Residential player estate | Airport Residential | 2438, -4998 |
| n:airres | Airport Residential neighbourhood | Airport Residential | 2305, -4943 |
| e:legon | East Legon player estate | East Legon | 4432, -8757 |
| n:legon | East Legon neighbourhood | East Legon | 4299, -8702 |
| e:trasacco | Trasacco player estate | Trasacco | 6426, -9642 |
| n:trasacco | Trasacco neighbourhood | Trasacco | 6293, -9587 |

## Homes

| ID | Area | Saved x,z | Monthly rent | Advance months |
|---|---|---|---|---|
| nima | Nima | 111, -2820 | 110 | 8 |
| jtown | Jamestown | -1108, 2543 | 120 | 8 |
| kaneshie | Kaneshie | -3878, -1437 | 260 | 12 |
| labadi | Labadi | 4875, -442 | 450 | 12 |
| osu | Osu | 1994, -111 | 1600 | 24 |
| airres | Airport Residential | 2216, -4865 | 2600 | 24 |
| legon | East Legon | 4210, -8625 | 7500 | 12 |
| trasacco | Trasacco | 6205, -9509 | 45000 | 24 |
