// Developer-only procedural compilation: the browser loads the frozen compact
// blueprint, then generates only bounded facade detail near the camera.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {resolveDistricts,FAMILIES} from '../client/src/v2/scene/city/districts.js';
import {landmarkInventory} from '../client/src/v2/scene/city/landmarks.js';
import {createPlan} from '../client/src/v2/scene/city/planner.js';
import {ROOFS} from '../client/src/v2/scene/city/blueprint.js';
const read = p => JSON.parse(fs.readFileSync(p,'utf8'));
const data=read('client/public/assets/greater-accra.json'),anchors=read('client/public/assets/district-anchors.json'),cat=read('client/test/fixtures/city-catalog.json');
const districts=resolveDistricts(data,anchors),landmarks=landmarkInventory(cat,data,districts);
const start=performance.now(),plan=createPlan(data,districts,landmarks),families=Object.keys(FAMILIES),ids=districts.map(d=>d.id);
const round=(n,p=2)=>Number(n.toFixed(p));
const buildings=plan.buildings.map(p=>[round(p.x,3),round(p.z,3),round(p.w,3),round(p.d,3),round(p.h,3),round(p.angle,7),p.floors,families.indexOf(p.family),ids.indexOf(p.district),p.seed,ROOFS.indexOf(p.roof)]);
const sourceFiles=['client/public/assets/greater-accra.json','client/public/assets/district-anchors.json','client/test/fixtures/city-catalog.json','client/src/v2/scene/city/planner.js','client/src/v2/scene/city/districts.js','client/src/v2/scene/city/geography.js','client/src/v2/scene/city/landmarks.js'];
const sourceHashes=Object.fromEntries(sourceFiles.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
const output={version:1,sourceHashes,families,districts:ids,buildings};
fs.writeFileSync('client/public/assets/city-blueprint.json',JSON.stringify(output));
console.log(JSON.stringify({buildings:buildings.length,chunks:plan.chunks.size,counts:Object.fromEntries(plan.counts),buildMs:performance.now()-start,bytes:fs.statSync('client/public/assets/city-blueprint.json').size}));
