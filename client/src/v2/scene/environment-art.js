// Original modular environment art. Everything returned here is decorative:
// it has no item index, action, tap target or navigation footprint.
import * as THREE from 'three';
import { B, mat, T, floorMaterial } from './kit.js';

const HP=Math.PI/2;
const lightMaterial=()=>{const m=new THREE.MeshStandardMaterial({color:'#fff0d2',emissive:'#ffc685',emissiveIntensity:.15,roughness:.6});m.userData.environmentGlow=true;return m;};
function patch(root,x,z,w,d,kind,color) {
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,.018,d),floorMaterial(kind,color,w,d));
  m.position.set(x,.012,z);m.receiveShadow=true;root.add(m);
}
function add(root,b) { const g=b.done([0,0],[]).obj;root.add(g);return g; }
function planter(b,x,z,w,d,color='#c7b99d',height=.32) {
  b.box(w,height,d,color,x,0,z,.04);b.box(w-.12,.04,d-.12,'#5d5844',x,height-.04,z,.01);
  for(let i=0;i<Math.max(2,Math.floor(w/.35));i++)b.sph(.23,'#5e7e51',x-w*.38+i*w*.76/Math.max(1,Math.floor(w/.35)-1),height+.14,z,1,.8,.9,8,5);
}
function canopy(b,x,z,w,d,accent,y=2.85) {
  // Rear-edge supports keep the activity and the front sightline open.
  for(const sx of [-1,1])b.box(.075,y,.075,'#665b4b',x+sx*w*.46,0,z-d*.45,.008);
  b.bc(w,.09,d,accent,x,y,z,.06,0,0,.02);
  b.box(w,.17,.07,'#eee0c4',x,y-.1,z+d*.5,.008);
  for(let i=0;i<8;i++)b.box(w/16,.014,d, '#dfd6c1',x-w*.47+i*w/8,y+.05,z,.002);
}
function backFacade(root,spec,art) {
  const b=new B(),W=spec.w,D=spec.d,c=art.accent;
  const coast=art.category==='coast'||['castle','lighthouse'].includes(art.id);
  if(coast){
    patch(root,0,-D/2-1.55,W+1.2,3,'sand','#dcc99f');
    const water=new THREE.Mesh(new THREE.PlaneGeometry(W+1.2,2),new THREE.MeshStandardMaterial({color:'#579ba2',roughness:.27,metalness:.1}));
    water.rotation.x=-HP;water.position.set(0,-.05,-D/2-3);water.userData.water=true;root.add(water);
    for(let i=0;i<3;i++)b.box(W+.8,.018,.08,'#b9d7cb',0,-.035,-D/2-2.2-i*.5,0);
  }else if(['heritage','fitness','community'].includes(art.category)){
    patch(root,0,-D/2-.6,W+1,1.2,'grass','#8d9c70');
    for(const x of [-W*.37,W*.37])planter(b,x,-D/2-.3,1.6,.6,'#c3b38e');
  }else{
    const n=art.id==='circle'?4:3,colors=[art.wall,'#d6c6ab','#bbbaa2'];
    for(let i=0;i<n;i++){
      const w=(W+.6)/n-.12,x=-W/2+(i+.5)*(W+.6)/n,z=-D/2-.75,H=2.6+(i%2)*.6;
      b.box(w,H,1.4,colors[i%3],x,0,z,.025);
      b.box(w+.16,.13,1.55,c,x,H,z,.01);
      b.box(w*.8,.36,.055,c,x,2,z+.73,.008);
      b.plane(w*.75,.28,mat('#ffffff',{map:T.text(({'circle':['TROTRO STATION','TIPTOE LANE','CIRCLE SHOPS'],'makola':['TEXTILES','PROVISIONS','FRESH PRODUCE'],'kantamanto':['TAILORING','CLOTH & CARE','ALTERATIONS'],'oxford':['OXFORD STREET','LOCAL SHOPS','OSU']}[art.id]||['LOCAL SHOPS','PROVISIONS','WELCOME'])[i%3],c,'#f4eddb',256,64)}),x,2.2,z+.77);
      for(const dx of [-w*.27,w*.27]){b.box(w*.32,1.15,.045,'#547476',x+dx,.55,z+.72,.008);b.box(w*.35,.05,.12,'#e9ddc7',x+dx,.5,z+.75,.004);}
      if(i%2===0)canopy(b,x,z+1.05,w*.92,.8,c,2.05);
    }
  }
  add(root,b);
}
function interiorArchitecture(root,spec,art) {
  const b=new B(),W=spec.w,D=spec.d,H=spec.wallH||2.7,c=art.accent||'#7b8775',wood=art.wood||'#80684e';
  // A layered cutaway edge, shallow cornice and timber reveals give wall depth.
  b.box(W+.26,.08,.32,'#f2eadb',0,H-.16,-D/2-.035,.008);
  b.box(.32,.08,D+.26,'#f2eadb',-W/2-.035,H-.16,0,.008);
  b.box(W+.18,.055,.22,wood,0,H+.035,-D/2-.04,.008);
  b.box(.22,.055,D+.18,wood,-W/2-.04,H+.035,0,.008);
  b.box(W+.18,.065,.12,wood,0,-.15,D/2+.1,.008);
  b.box(.12,.065,D+.18,wood,W/2+.1,-.15,0,.008);
  for(const win of spec.windows||[]){
    const f=new B(),w=win.w||1.2;
    for(const x of [-w/2,w/2])f.box(.065,1.25,.16,wood,x,.91,.07,.008);
    for(const y of [.91,2.13])f.box(w+.12,.065,.16,wood,0,y,.07,.008);
    f.box(.045,1.12,.055,'#e9e5d7',0,.98,.09,.003);
    f.box(w,.045,.055,'#e9e5d7',0,1.48,.09,.003);
    f.box(w+.25,.08,.32,'#f1e8d7',0,.88,.08,.01);
    const g=add(root,f);if(win.wall==='back')g.position.set(-W/2+win.at*W,0,-D/2);else{g.rotation.y=HP;g.position.set(-W/2,0,D/2-win.at*D);}
  }
  if(spec.door){
    const f=new B();for(const x of [-.54,.54])f.box(.085,2.22,.2,wood,x,0,.01,.008);
    f.box(1.16,.12,.2,wood,0,2.16,.01,.008);f.box(1.04,.018,.3,'#b6a281',0,.005,0,.004);
    const g=add(root,f);if(spec.door.wall==='back')g.position.set(-W/2+spec.door.at*W,0,-D/2);else{g.rotation.y=HP;g.position.set(-W/2,0,D/2-spec.door.at*D);}
  }
  // Wall-mounted, unshadowed fixtures: no new point-light shaders per object.
  for(const x of [-W*.32,W*.3]){
    b.box(.18,.32,.09,wood,x,2.15,-D/2+.06,.02);
    b.box(.24,.16,.14,lightMaterial(),x,2.22,-D/2+.13,.02);
  }
  if(['gallery','modern','villa'].includes(art.style)||['office','hotel','medical','retail','campus'].includes(art.category)){
    // Repeated low-relief panels live on the wall plane, never in circulation.
    for(let x=-W/2+.25;x<W/2;x+=.32)b.box(.045,.7,.035,wood,x,1.05,-D/2+.025,.002);
  }
  add(root,b);
}
function homeComposition(root,spec,art) {
  const W=spec.w,D=spec.d,b=new B(),bed=spec.items.find(i=>i.key==='bed');
  // Materials distinguish actual existing sleeping / wet / living / terrace zones.
  if(bed){const w=art.id==='nima'||art.id==='jtown'?1.9:2.2;patch(root,bed.x,bed.z,w,2.25,'carpet',art.cloth);}
  if(!['nima','jtown','kaneshie'].includes(art.id))patch(root,-W/2+1.25,-D/2+1.1,2.35,2.15,'tiles','#c6d2c9');
  const cook=spec.items.find(i=>i.key==='cook');if(cook)patch(root,cook.x,cook.z,Math.abs(Math.sin(cook.rot))>.5?.85:1.1,Math.abs(Math.sin(cook.rot))>.5?1.1:.85,'stone','#c4b69a');
  if(art.id==='kaneshie'){
    // Chamber threshold, above-eye-level beam and short rear divider; the central
    // passage remains open and the bed use point is unchanged.
    b.box(.08,.025,D-.5,art.wood,-.2,.02,0,.002);
    b.box(.08,.16,2,art.wood,-.2,2.35,-D/2+1,.01);
  }
  if(art.id==='jtown'){
    // Coastal plaster, shutter details and a shallow rear veranda.
    patch(root,0,-D/2-.35,W+.3,.7,'stone','#cdbb9f');
    for(const x of [-2.1,2.1])b.box(.11,2.5,.11,art.accent,x,0,-D/2-.3,.01);
    b.bc(W+.4,.1,.8,'#a67752',0,2.5,-D/2-.35,.06,0,0,.01);
  }
  if(art.id==='nima'){
    patch(root,-W/2-.4,0,.8,D+.3,'concrete','#c4b9a0');
    for(const z of [-1.8,1.8])planter(b,-W/2-.45,z,.5,.65,'#b98b68');
  }
  if(['osu','airres','legon'].includes(art.id)){
    patch(root,W/2+.5,0,1,D+.2,art.id==='osu'?'pavers':'stone','#c9bc9f');
    for(const z of [-D*.33,D*.33])planter(b,W/2+.5,z,.65,1.2,'#c4b89b');
    b.box(.07,.62,D+.2,art.accent,W/2+.99,0,0,.01);
  }
  if(art.id==='trasacco'){
    patch(root,1,2.8,9.6,4.1,'wood','#b49a78');
    for(const x of [-4,4])planter(b,x,D/2+.35,2,.6,'#d2c5aa');
    b.box(W,.1,.24,art.wood,0,.02,D/2+.1,.02);
    // Terrace pergola along the rear edge of the exterior wing, not over avatars.
    for(let x=0;x<5.9;x+=.6)b.box(.065,.09,1.5,art.wood,x,2.65,D/2-.6,.006);
    b.box(6,.12,.1,art.wood,3,2.6,D/2+.1,.006);
    for(const x of [.1,5.8])b.box(.09,2.6,.09,art.wood,x,0,D/2+.1,.006);
  }
  add(root,b);
}
function venueComposition(root,spec,art) {
  const b=new B(),W=spec.w,D=spec.d,c=art.accent,id=art.id;
  if(['market','food'].includes(art.category)){
    if(spec.outdoor)canopy(b,-W*.24,-D/2+.7,W*.44,1.25,c,2.85);
    else {b.box(W*.6,.14,.4,art.wall,0,2.5,-D/2+.2,.02);for(let x=-W*.25;x<W*.3;x+=.48)b.box(.07,.07,.6,'#82654b',x,2.45,-D/2+.26,.005);}
  }
  if(art.category==='medical'){
    b.box(W-.3,.12,.035,'#668b81',0,1.05,-D/2+.045,.004);
    b.plane(1.3,.32,mat('#fff',{map:T.text(id==='ridge'?'OUTPATIENT CARE':'PATIENT RECEPTION',c,'#fff',256,64)}),W*.23,2.25,-D/2+.1);
    patch(root,0,0,W*.3,D-.5,'tiles','#d9e2d8');
  }
  if(['office','civic'].includes(art.category)){
    patch(root,0,0,W*.3,D-.5,'carpet',id==='bank'?'#6b897b':'#84938c');
    for(let x=-W*.35;x<W*.4;x+=1.4)b.box(.8,.5,.025,c,x,1.5,-D/2+.04,.01);
  }
  if(art.category==='night'){
    const glow=lightMaterial();glow.emissive.set(id==='vibes'?'#dd887e':'#b99ad4');
    b.box(W-.2,.035,.06,glow,0,2.5,-D/2+.1,.003);
    for(let x=-W*.4;x<W*.45;x+=.65)b.box(.22,1.2,.07,id==='radio'?'#434e62':'#5c4656',x,1.0,-D/2+.07,.02);
    if(id==='cinema')patch(root,0,0,1.1,D-.4,'carpet','#b09775');
  }
  if(art.category==='retail'||art.category==='hotel'){
    patch(root,0,0,W*.55,D-.2,'stone',id==='mall'?'#d0c7b9':'#dbd1bf');
    if(!spec.outdoor)for(const x of [-W*.39,W*.39]){b.box(.18,H(spec),.24,'#d9cfbc',x,0,-D/2+.15,.02);b.box(.3,.15,.32,c,x,2.3,-D/2+.15,.01);}
  }
  if(art.category==='campus'){
    b.box(W-.2,.12,.35,'#a86d4c',0,2.6,-D/2+.12,.008);
    b.plane(2,.3,mat('#fff',{map:T.text('READ · LEARN · CREATE','#915d43','#f5ead2',256,64)}),0,2.28,-D/2+.12);
    patch(root,-W/2-.5,0,1,D,'pavers','#c4b79c');
  }
  if(art.category==='fitness'){
    for(const x of [-W*.35,W*.35])b.box(.13,spec.outdoor?1.3:2.35,.08,c,x,0,-D/2+.05,.01);
    if(!spec.outdoor)patch(root,0,0,W-.5,D*.7,'carpet','#6c7b70');
  }
  if(art.category==='community'&&!spec.outdoor){
    b.box(W*.65,.04,.04,'#ba9b62',0,2.2,-D/2+.1,.003);
    if(id==='mosque')for(let x=-W*.4;x<W*.45;x+=.7)b.box(.035,.01,D*.7,'#acb48d',x,.018,.3,.001);
    else patch(root,0,.2,1.2,D-.4,'carpet',id==='church'?'#9a6659':'#6a6060');
  }
  if(id==='labadi'||id==='canoes')canopy(b,-W*.32,-D*.36,W*.28,1.3,'#a79468',2.6);
  if(id==='circle'){
    for(let x=-W*.45;x<W*.45;x+=.5)b.box(.23,.012,1.3,'#e5d8b5',x,.025,-D*.43,.001);
    b.plane(3,.34,mat('#fff',{map:T.text('CIRCLE  ·  TROTRO STATION','#506a60','#f3e8ce',512,64)}),0,3,-D/2-.02);
  }
  if(id==='aboki'||id==='fanyogo')planter(b,W/2+.1,0,.65,2.6,'#c6b295');
  add(root,b);
}
const H=spec=>(spec.wallH||2.7)-.25;
function neighbourhoodComposition(root,spec,art) {
  const b=new B(),W=spec.w,D=spec.d,c=art.accent;
  const coastal=['coastal','compound'].includes(art.style),premium=['gallery','modern','villa'].includes(art.style);
  if(spec.estate){
    // Estate buildings are supplied only by server owner records. These are
    // verges and boundary treatments, not invented occupied homes.
    patch(root,0,6,W-.6,6,'asphalt',premium?'#727772':'#999586');
    patch(root,0,-4,2.6,20,'pavers',art.ground);
    if(art.id==='jtown')for(const x of [-9,9])patch(root,x,0,1.5,29,'stone','#bfae90');
    if(art.id==='osu')patch(root,0,0,16,5,'pavers','#bd9d83');
    if(art.id==='trasacco')for(const x of [-9,9])patch(root,x,-5,2,14,'grass','#7e946d');
    if(art.id==='labadi')patch(root,0,8,W-1,1.2,'sand','#e3cfaa');
    const offsets={nima:0,jtown:1,kaneshie:2,labadi:3,osu:4,airres:5,legon:6,trasacco:7};
    for(const x of [-W/2+.4,W/2-.4]){
      b.box(.22,premium?.9:.6,D-2,art.familyArt.wall,x,0,-.5,.02);
      for(let z=-D/2+2;z<D/2-1;z+=3.8+(offsets[art.id]%3))planter(b,x*.97,z,.7,1.4,coastal?'#b49a7a':'#c8baa0');
    }
    b.box(W-.8,.65,.2,art.familyArt.wall,0,0,-D/2+.2,.02);
    if(premium)for(const x of [-10,10]){patch(root,x,9,4,1.4,'grass','#82956e');planter(b,x,10,3,.65,'#bfb49b');}
  }else{
    const border=art.id==='jtown'?'sand':premium?'grass':'concrete';
    patch(root,W/2+.55,0,1.1,D,border,art.familyArt.ground);
    if(art.id==='jtown'||art.id==='labadi'){
      patch(root,-W/2-.7,0,1.4,D,'sand','#d9c49a');
      for(const z of [-7,1,9])b.box(.14,.75,.14,'#b89e77',-W/2-.65,0,z,.008);
    }
    if(premium){for(const x of [-12,12])planter(b,x,11,2.8,.8,'#c4bca8');}
    if(['nima','kaneshie','osu'].includes(art.id))canopy(b,-11,-5,7,1.3,c,3.0);
    if(art.id==='labadi')canopy(b,3,-6,5,1.4,'#b89d67',2.9);
    if(art.id==='airres')patch(root,0,1,10,1.1,'pavers','#d4d1bd');
    if(art.id==='legon')for(const x of [-9,9])b.box(4,.4,.2,'#cfbf9f',x,0,-5.8,.02);
    if(art.id==='trasacco')for(const x of [-7,7])planter(b,x,-5.4,3,1,'#dad1bc',.45);
  }
  add(root,b);
}
export function buildEnvironmentArt(spec) {
  const root=new THREE.Group(),art=spec.environment;
  if(!art)return root;
  root.name='environment-art';
  if(!spec.outdoor)interiorArchitecture(root,spec,art);
  else if(!spec.neighbourhood)backFacade(root,spec,art);
  if(art.type==='home')homeComposition(root,spec,art);
  else if(spec.neighbourhood)neighbourhoodComposition(root,spec,art);
  else venueComposition(root,spec,art);
  root.traverse(o=>{if(o.isMesh){o.castShadow=!o.material?.transparent;o.receiveShadow=true;o.userData.decorative=true;}});
  return root;
}
