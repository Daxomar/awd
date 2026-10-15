# Greater Accra geographic data

`greater-accra.json` is a simplified geographic database derived from
[OpenStreetMap](https://www.openstreetmap.org/copyright), distributed under the
[Open Database Licence 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Attribution: **© OpenStreetMap contributors**.

Source extract: [Geofabrik Ghana](https://download.geofabrik.de/africa/ghana.html).
The snapshot timestamp and SHA-256 of the input PBF are embedded in the JSON.
The derivative database is made available in full in this repository and in the
game's `/assets/greater-accra.json`. This licence applies to geographic data,
not to the independently authored game code, procedural models or player data.

The geographically derived placement database `city-blueprint.json` is also
distributed under ODbL 1.0. Its generated building footprints are artistic
representations, not surveyed building records.

`district-anchors.json` identifies the OSM place node used by each curated
district. Explicitly marked art anchors are representative geographic positions,
not surveyed boundaries or addresses. District influence radii are artistic.

Rebuild using `tools/build-city-geography.py` and its pinned optional developer
dependencies in `tools/requirements-citymap.txt`. Never ship the raw country PBF
or OSM contributor metadata to browsers. No map tiles or paid mapping service
are used. The game does not fetch OpenStreetMap while players explore.
