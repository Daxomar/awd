import { neighbourhoodArt, dressVenue } from './environment-profiles.js';
import { NEIGHBOURHOOD_ACTIVITY_IDS } from '../../../../shared/exploration.js';
const I = (kind, x, z, extra = {}) => ({ kind, x, z, ...extra });
const Z = (id, label, icon, item, acts, extra = {}) => ({ id, label, icon: 'ph-' + icon, item, acts, ...extra });
export function streetSpec(area, estate = false) {
  const art=neighbourhoodArt(area);
  if(estate)return {environment:{...art,type:'estate'},ownerPlots:estatePlots(art.id),w:42,d:38,outdoor:true,floor:STREET_LAYOUTS[art.id].floor,floorColor:art.familyArt.ground,neighbourhood:true,estate:true,area,spawn:{x:0,z:7},items:[I('street_road:40,6',0,6),I('street_gate',0,17,{label:'NEIGHBOURHOOD'}),I('tree',-19,16),I('tree',19,16)],zones:[Z('exit','Back to neighbourhood','person-simple-walk',1,[],{route:'neighbourhood'})],npcs:[]};
  const items = [I('street_road:34,5', 0, 1), I('wooden_bench', -3, 7), I('khebab_grill', 11, 7, { open: [17, 26] }), I('icecream_bicycle', -10, 7, { open: [9, 19] }), I('big_screen:3.2', 3, -5), I('wooden_bench:3', 3, -2), I('street_gate', 0, 13, { key: 'exit', label: estate ? 'NEIGHBOURHOOD' : 'CITY MAP' })];
  for (const x of [-15, -6, 6, 15]) items.push(I('lamp_post', x, 4), I('tree', x, 11));
  if (!estate) {
    for (const [x,z,label,col] of [[-12,-8,'PROVISIONS','#d8c4a8'],[-5,-8,'BARBER','#dce8de'],[12,-8,'FOOD JOINT','#eddac0']]) items.push(I('street_building:5,4',x,z,{label,color:col}));
    items.push(I('street_gate', -16, 6, { label: 'RESIDENTS ESTATE', key: 'estate' }));
  }
  const zones = [Z('walk','Walk the neighbourhood','person-simple-walk',1,['stroll','streetgames']), Z('khebab','Aboki joint · evenings','fire',2,['khebab','chickenkhebab']), Z('ice','FanYogo vendor · daytime','ice-cream',3,['fanyogo','fanice']), Z('watch','Viewing centre','television',5,['streetwatch','streetbet']), Z('exit',estate?'Back to neighbourhood':'City map','map-trifold',6,[],{route:estate?'neighbourhood':'map'})];
  if (!estate) zones.push(Z('estate','Player-owned estate','buildings',items.length-1,[],{route:'estate'}));
  zones.push(Z('provisions', 'Provisions shop', 'storefront', 15, ['provisionsnack']), Z('barber', 'Barber shop', 'scissors', 16, ['barber']), Z('food', 'Neighbourhood food joint', 'bowl-food', 17, ['streetmeal']));
  const look = (body,top,topCol,hair) => ({ body,skin:5,top,topCol,hair,beard:'nobeard',bottom:'chinos',bottomCol:'#37465a',shoes:'sneakers' });
  if(NEIGHBOURHOOD_ACTIVITY_IDS[art.id])zones[0].acts.push(NEIGHBOURHOOD_ACTIVITY_IDS[art.id]);
  const spec={ w:36,d:30,outdoor:true,floor:'pavers',floorColor:'#d6c8ad',items,zones,spawn:{x:0,z:10},neighbourhood:true,estate,area,
    npcs:[{label:'Aboki grill seller',x:11,z:6,rot:0,pose:'work',look:look('m','kaftan','#ebe6d8','lowcut'),open:[17,26],gesture:'agree'}, {label:'FanYogo vendor',x:-9,z:7,rot:-.7,pose:'stand',look:look('m','tee','#f3f4f0','fade'),open:[9,19],patrol:[[-9,7],[-6,5],[-12,4]]}, {label:'Neighbour Ama',x:-2,z:5,rot:1,pose:'stand',look:look('f','blouse','#397b69','bun'),patrol:[[-2,5],[5,5],[7,9],[-3,10]]}],
    lights:[{x:-10,z:4,intensity:8,dist:12},{x:11,z:6,intensity:8,dist:12}] };
  return composeStreet(spec,art);
}
export function extraVenue(id) {
  const items=[],zones=[];
  const add = (kind,x,z,label,acts,extra={}) => {const item=items.length;items.push(I(kind,x,z,{label,...extra}));zones.push(Z(label.toLowerCase().replace(/[^a-z]/g,'').slice(0,12),label,extra.icon||'star',item,acts));};
  let w=10,d=8,wallColor='#eadfcd',outdoor=false;
  if(id==='cinema') { wallColor='#292b39'; add('big_screen:4',0,-3,'Cinema screen',['film'],{screen:'film',icon:'film-slate'});for(const x of [-3,-1,1,3])for(const z of [-.8,1,2.8])items.push(I('cinema_chair',x,z));add('counter:2',-3.5,-3,'Popcorn counter',['popcorn'],{icon:'popcorn'}); }
  else if(id==='court'){ add('reception_desk',-3,-2,'Legal information',['legal'],{icon:'scales'});add('wooden_bench:3',2,0,'Public gallery',['gallery'],{icon:'scales'});items.push(I('bookshelf',-4,-3)); }
  else if(id==='aboki'){outdoor=true;add('khebab_grill',0,-1,'Aboki khebab',['khebab','chickenkhebab'],{icon:'fire'});items.push(I('wooden_bench',-3,1),I('lamp_post',3,-2));}
  else if(id==='fanyogo'){outdoor=true;add('icecream_bicycle',0,0,'FanYogo and FanIce',['fanyogo','fanice'],{icon:'ice-cream'});items.push(I('tree',-3,-2),I('wooden_bench',3,1));}
  else if(id==='restaurant'){add('chop_table',-2,0,'Restaurant tables',['jollof','tilapia'],{icon:'fork-knife'});items.push(I('chop_table',2,1),I('kitchen_counter:3',0,-3),I('plant',4,-3));}
  else if(id==='gymlegon'){add('dumbbells:3',-2,-1,'Weights',['train'],{icon:'barbell'});items.push(I('weight_bench',2,0),I('treadmill',-3,2));}
  else return null;
  return dressVenue({w,d,outdoor,wallColor,floor:'tiles',floorColor:'#d2c4ad',items,zones,spawn:{x:0,z:3},npcs:id==='aboki'?[{label:'Aboki grill seller',x:0,z:-2,rot:0,pose:'work',look:{body:'m',skin:5,top:'tee',topCol:'#e6e0cd',hair:'lowcut',beard:'nobeard'},open:[17,26],gesture:'agree'}]:id==='fanyogo'?[{label:'FanYogo vendor',x:1,z:0,pose:'stand',look:{body:'m',skin:5,top:'tee',topCol:'#eee9df',hair:'fade',beard:'nobeard'},open:[9,19],patrol:[[1,0],[3,2],[-1,2]]}]:[],sign:{text:zones[0].label.toUpperCase()}},id);
}

// Coordinates below are authored compositions, not a random decoration pass.
// Existing zone indices, schedules, spawn, estate and home routes remain stable.
export const STREET_LAYOUTS = {
  nima: {road:[32,4,0,1,0], shops:[[-12,-8],[-5,-7],[12,-8]], bench:[-3,7],watch:[3,-5],ice:[-10,7],grill:[11,7],floor:'concrete'},
  jtown: {road:[32,3.6,0,1,-.1],shops:[[-13,-9],[-13,-2,Math.PI/2],[11,-10]],bench:[-4,8],watch:[6,-4],ice:[-9,5],grill:[11,9],floor:'stone'},
  kaneshie: {road:[34,5.5,0,0,0],shops:[[-12,-10],[-5,-10],[12,-5,-Math.PI/2]],bench:[-3,8],watch:[3,-5],ice:[-11,6],grill:[10,7],floor:'concrete'},
  labadi: {road:[30,3.5,0,1,.08],shops:[[-13,-10],[-13,-3,Math.PI/2],[12,-11]],bench:[-4,9],watch:[1,-6],ice:[-10,5],grill:[10,9],floor:'sand'},
  osu: {road:[34,4.6,0,0,-.05],shops:[[-12,-9],[-5,-9],[12,-4,-Math.PI/2]],bench:[-3,6],watch:[2,-4],ice:[-10,8],grill:[11,7],floor:'pavers'},
  airres: {road:[34,5,0,1,0],shops:[[-12,-10],[-12,-3,Math.PI/2],[12,-10]],bench:[-4,7],watch:[5,-4],ice:[-8,6],grill:[11,8],floor:'grass'},
  legon: {road:[32,4,0,1,0],shops:[[-12,-9],[-5,-10],[13,-3,-Math.PI/2]],bench:[-3,8],watch:[3,-4],ice:[-10,7],grill:[11,9],floor:'pavers'},
  trasacco: {road:[32,4.8,0,1,0],shops:[[-13,-10],[-13,-3,Math.PI/2],[13,-8,-Math.PI/2]],bench:[-4,8],watch:[3,-5],ice:[-11,6],grill:[10,8],floor:'grass'},
};
function composeStreet(spec,art){
  const v=STREET_LAYOUTS[art.id],items=spec.items;spec.environment={...art,type:'street'};spec.floor=v.floor;spec.floorColor=art.familyArt.ground;
  const [w,d,x,z,rot]=v.road;Object.assign(items[0],{kind:`street_road:${w},${d}`,x,z,rot});
  for(const [index,p]of [[1,v.bench],[2,v.grill],[3,v.ice],[4,v.watch],[5,[v.watch[0],v.watch[1]+3]]]){items[index].x=p[0];items[index].z=p[1];}
  for(let i=0;i<3;i++)Object.assign(items[15+i],{x:v.shops[i][0],z:v.shops[i][1],rot:v.shops[i][2]||0,color:i===1?art.accent:art.wall,family:art.family,style:art.style});
  for(let i=0;i<4;i++){const tree=items[8+i*2];tree.kind=['jtown','labadi'].includes(art.id)?'palm_tree':'tree';tree.z=11+(i%2);}
  spec.npcs[0].x=v.grill[0];spec.npcs[0].z=v.grill[1]-1;
  spec.npcs[1].x=v.ice[0]+1;spec.npcs[1].z=v.ice[1];
  const dx=v.ice[0]+10,dz=v.ice[1]-7;spec.npcs[1].patrol=spec.npcs[1].patrol.map(([x,z])=>[x+dx,z+dz]);
  spec.lights=[{x:v.grill[0],z:v.grill[1]-1,intensity:8,dist:13},{x:v.ice[0],z:v.ice[1],intensity:7,dist:13}];
  return spec;
}

export function estatePlots(id){
  // Coastal lanes and Osu's courtyard place the outer homes facing inwards.
  // Other districts use staggered courts; the central entrance stays at (0,17).
  if(id==='jtown')return [-14,14].flatMap(x=>[-12,-4,4,12].map(z=>({x,z,rot:x<0?Math.PI/2:-Math.PI/2}))).concat([-5,5].flatMap(x=>[-12,13].map(z=>({x,z,rot:z>0?Math.PI:0}))));
  if(id==='osu')return [-14,14].flatMap(x=>[-10,-2,12].map(z=>({x,z,rot:x<0?Math.PI/2:-Math.PI/2}))).concat([-7,0,7].flatMap(x=>[-12,13].map(z=>({x,z,rot:z>0?Math.PI:0}))));
  const layouts={nima:[[-5,5,-13,13],[0,-7.5,12]],jtown:[[-5.5,5.5,-14,14],[-1,-9,12]],kaneshie:[[-4.5,4.5,-13,13],[0,-8,13]],labadi:[[-5,5,-14,14],[-1,-9,12]],osu:[[-5,5,-14,14],[0,-8,13]],airres:[[-5.5,5.5,-14.5,14.5],[-1,-9,13]],legon:[[-5,5,-14,14],[0,-9,13]],trasacco:[[-5.5,5.5,-14.5,14.5],[-1,-10,13]]};
  const [xs,zs]=layouts[id]||layouts.nima;
  return zs.flatMap((z,row)=>xs.map((x,col)=>({x,z:z+(id==='legon'&&col%2?-1.2:0),rot:row===2?Math.PI:(id==='labadi'&&col>1?(x<0?Math.PI/2:-Math.PI/2):0)})));
}
