const I = (kind, x, z, extra = {}) => ({ kind, x, z, ...extra });
const Z = (id, label, icon, item, acts, extra = {}) => ({ id, label, icon: 'ph-' + icon, item, acts, ...extra });
export function streetSpec(area, estate = false) {
  if(estate)return {w:42,d:38,outdoor:true,floor:'grass',floorColor:'#afbd96',neighbourhood:true,estate:true,area,spawn:{x:0,z:7},items:[I('street_road:40,6',0,6),I('street_gate',0,17,{label:'NEIGHBOURHOOD'}),I('tree',-19,16),I('tree',19,16)],zones:[Z('exit','Back to neighbourhood','person-simple-walk',1,[],{route:'neighbourhood'})],npcs:[]};
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
  return { w:36,d:30,outdoor:true,floor:'pavers',floorColor:'#d6c8ad',items,zones,spawn:{x:0,z:10},neighbourhood:true,estate,area,
    npcs:[{label:'Aboki grill seller',x:11,z:6,rot:0,pose:'work',look:look('m','kaftan','#ebe6d8','lowcut'),open:[17,26],gesture:'agree'}, {label:'FanYogo vendor',x:-9,z:7,rot:-.7,pose:'stand',look:look('m','tee','#f3f4f0','fade'),open:[9,19],patrol:[[-9,7],[-6,5],[-12,4]]}, {label:'Neighbour Ama',x:-2,z:5,rot:1,pose:'stand',look:look('f','blouse','#397b69','bun'),patrol:[[-2,5],[5,5],[7,9],[-3,10]]}],
    lights:[{x:-10,z:4,intensity:8,dist:12},{x:11,z:6,intensity:8,dist:12}] };
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
  return {w,d,outdoor,wallColor,floor:'tiles',floorColor:'#d2c4ad',items,zones,spawn:{x:0,z:3},npcs:id==='aboki'?[{label:'Aboki grill seller',x:0,z:-2,rot:0,pose:'work',look:{body:'m',skin:5,top:'tee',topCol:'#e6e0cd',hair:'lowcut',beard:'nobeard'},open:[17,26],gesture:'agree'}]:id==='fanyogo'?[{label:'FanYogo vendor',x:1,z:0,pose:'stand',look:{body:'m',skin:5,top:'tee',topCol:'#eee9df',hair:'fade',beard:'nobeard'},open:[9,19],patrol:[[1,0],[3,2],[-1,2]]}]:[],sign:{text:zones[0].label.toUpperCase()}};
}
