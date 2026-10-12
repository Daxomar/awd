// Continuous authored adult anatomy, retargeted to the game's mocap skeleton.
// Source mesh and gender targets: MakeHuman Community, CC0. See models/LICENSE-human.md.
import * as THREE from 'three';
const V=(a)=>new THREE.Vector3(...a);
const clamp=(n)=>Math.max(0,Math.min(1,Number(n??.5)));
let neighbours; // Shared topology for the two adult shape targets.
export function humanBody(data,look,B,I) {
  const female=look.body==='f', gender=female?'female':'male', source=data[gender], J=data.joints[gender];
  const ground=Math.min(...source.filter((_,i)=>i%3===1));
  const scale=(B.Neck.y-B.LeftFoot.y)/(J.neck[1]-J['l-ankle'][1]);
  const specs=[['Hips','pelvis','spine-4','Spine'],['Spine','spine-4','spine-2','Spine1'],['Spine1','spine-2','spine-1','Spine2'],['Spine2','spine-1','neck','Neck'],['Neck','neck','head','Head'],['Head','head','head-2',null]];
  for(const side of ['Left','Right']) { const s=side==='Left'?'l-':'r-'; specs.push([side+'Shoulder',s+'clavicle',s+'shoulder',side+'Arm'],[side+'UpLeg',s+'upper-leg',s+'knee',side+'Leg'],[side+'Leg',s+'knee',s+'ankle',side+'Foot'],[side+'Foot',s+'ankle',s+'foot-2',side+'ToeBase'],[side+'Arm',s+'shoulder',s+'elbow',side+'ForeArm'],[side+'ForeArm',s+'elbow',s+'hand',side+'Hand'],[side+'Hand',s+'hand',s+'finger-3-1',side+'HandMiddle1']); }
  const bones=specs.map(([name,a,b,end])=>{
    const start=V(J[a]),finish=V(J[b]),delta=finish.clone().sub(start),target=B[name],tail=end?B[end]:target.clone().add(new THREE.Vector3(0,delta.length()*scale,0));
    return {name,start,delta,len:delta.lengthSq(),target,rotation:new THREE.Quaternion().setFromUnitVectors(delta.clone().normalize(),tail.clone().sub(target).normalize()),length:tail.distanceTo(target)/Math.sqrt(delta.lengthSq())};
  });
  const p=[],si=[],sw=[],uv=[], sleeveFields=[],limbFields=[];
  for(let i=0;i<source.length;i+=3) {
    const raw=V(source.slice(i,i+3));
    const arm=Math.abs(raw.x)>Math.abs(J[(raw.x>0?'l-':'r-')+'shoulder'][0])*.92 && raw.y>J[(raw.x>0?'l-':'r-')+'knee'][1]+1.2;
    const offsetIndex=i/3*4;
    const ranks=[];const weights=[];
    for(let k=0;k<4;k++){const weight=data.skinWeights[offsetIndex+k];if(!weight)continue;const name=data.weightBones[data.skinIndices[offsetIndex+k]],b=bones.find(b=>b.name===name);if(b){ranks.push({b});weights.push(weight);}}
    const sum=weights.reduce((a,b)=>a+b,0);const out=new THREE.Vector3();
    if(data.native){
      out.copy(raw);
      for(const [key,delta] of Object.entries(data.morphs[gender])){
        const amount=(clamp(look[key]??(key==='bust'?.45:.5))-(key==='bust'?.45:.5))*2;
        out.x+=delta[i]*amount;out.y+=delta[i+1]*amount;out.z+=delta[i+2]*amount;
      }
      out.y-=ground;out.multiplyScalar(scale);
    }else ranks.forEach((r,k)=>{
      const offset=raw.clone().sub(r.b.start),along=r.b.delta.clone().multiplyScalar(offset.dot(r.b.delta)/r.b.len);
      offset.sub(along).multiplyScalar(scale).add(along.multiplyScalar(r.b.length)).applyQuaternion(r.b.rotation).add(r.b.target);
      out.addScaledVector(offset,weights[k]/sum);
    });
    // Legacy retargeting is retained only for compatibility with the old JSON pack.
    if(!data.native){
    const armWeight=ranks.reduce((n,r,k)=>n+(/Arm/.test(r.b.name)?weights[k]/sum:0),0);
    out.y-=.070*Math.exp(-(((Math.abs(out.x)-.18)/.10)**2))*Math.exp(-(((out.y-B.Neck.y)/.13)**2));
    if(armWeight>.05){const limb=ranks.find(r=>/Arm/.test(r.b.name))?.b;if(limb){const tailName=limb.name.endsWith('ForeArm')?limb.name.replace('ForeArm','Hand'):limb.name.replace('Arm','ForeArm');const start=limb.target,end=B[tailName],axis=end.clone().sub(start);const centre=start.clone().addScaledVector(axis,Math.max(0,Math.min(1,out.clone().sub(start).dot(axis)/axis.lengthSq())));const fullness=(female?.06:.10)+(clamp(look.build)-.5)*.18+(clamp(look.muscle)-.5)*.12;out.addScaledVector(out.clone().sub(centre),fullness*armWeight);}}
    const y=out.y, mass=clamp(look.build)-.5, hipShape=clamp(look.hips)-.5;
    // Soft changes in circumference keep shoulders, joints and hands connected.
    const bodyFalloff=Math.exp(-(((y-B.Spine.y)/.32)**2)), hipFalloff=Math.exp(-(((y-B.Hips.y)/.19)**2));
    if(!arm) {out.x*=1+mass*.3*bodyFalloff+hipShape*.28*hipFalloff;out.z=B.Hips.z+(out.z-B.Hips.z)*(1+mass*.28*bodyFalloff+hipShape*.2*hipFalloff);}
    if(female&&!arm&&out.z>0) {const b=clamp(look.bust)-.45;out.z+=b*.18*Math.exp(-(((y-(B.Spine1.y+.05))/.10)**2))*(Math.exp(-(((out.x-.07)/.055)**2))+Math.exp(-(((out.x+.07)/.055)**2)));}
    if(!arm){const torso=Math.exp(-(((y-B.Spine1.y)/.24)**2)),waistCurve=Math.exp(-(((y-(B.Spine.y+.08))/.14)**2));out.x*=female?1+.075*hipFalloff-.10*waistCurve:1+.18*torso-.15*hipFalloff;out.z=B.Hips.z+(out.z-B.Hips.z)*(female?1+.06*hipFalloff:1+.04*torso);}
    const waist=Math.exp(-(((y-B.Spine.y)/.14)**2));if(!arm)out.x*=1+(clamp(look.waist)-.5)*.25*waist;
    if(y>B.Spine2.y-.03&&y<B.Neck.y+.01)out.x*=1+(clamp(look.shoulders)-.5)*.18;
    if(arm&&raw.y>J[(raw.x>0?'l-':'r-')+'hand'][1]+.5)out.z+=(clamp(look.muscle)-.5)*.022;
    if(raw.y>J.head[1]-.15){out.x*=1+(clamp(look.faceWidth)-.5)*.25;const nose=Math.exp(-((raw.x/.20)**2))*Math.exp(-(((raw.y-(J['l-eye'][1]-.30))/.35)**2));if(raw.z>J.head[2]+.6)out.z+=(clamp(look.nose)-.5)*.012*nose;const lips=Math.exp(-((raw.x/.36)**2))*Math.exp(-(((raw.y-(J['l-eye'][1]-.8))/.16)**2));if(raw.z>J.head[2]+.6)out.z+=(clamp(look.lips)-.5)*.009*lips;}
    // A relaxed neutral mouth, with a small lift at the corners.
    if(raw.z>J.head[2]+.6)out.y+=.005*Math.exp(-(((Math.abs(raw.x)-.29)/.14)**2))*Math.exp(-(((raw.y-(J['l-eye'][1]-.8))/.23)**2));
    }
    const y=out.y;
    p.push(out.x,out.y,out.z);
    for(let k=0;k<4;k++){si.push(k<ranks.length?I[ranks[k].b.name]:0);sw.push(k<ranks.length?weights[k]/sum:0);}

    // The pelvis is always clothed, including beneath skirts.
    limbFields.push(1-2*ranks.reduce((n,r,i)=>n+(/Arm|Hand/.test(r.b.name)?weights[i]/sum:0),0));
    const shoulder=V(J[(raw.x>0?'l-':'r-')+'shoulder']);
    sleeveFields.push(arm?(/hoodie|office|suit|kaftan/.test(look.full||look.top)?ranks[0].b.name.includes('Hand')?-.1:1:look.top==='singlet'||['sundress','kentedress','bodycon','kentecloth'].includes(look.full)?-1:1.6-raw.distanceTo(shoulder)):1);
    uv.push((1.75-Math.atan2(out.x,out.z-B.Hips.z)/(Math.PI*2))%1,(y-B.Hips.y)/(B.Neck.y-B.Hips.y));
  }
  // Fitted garments bridge fine anatomical surface detail while retaining body proportions.
  if (!neighbours) { const sets=Array.from({length:p.length/3},()=>new Set()); for(let i=0;i<data.triangles.length;i+=3){const ids=data.triangles.slice(i,i+3);for(const a of ids)for(const b of ids)if(a!==b)sets[a].add(b);}neighbours=sets.map(s=>[...s]); }
  for(let pass=0;pass<(data.native?12:6);pass++){const previous=p.slice();for(let i=0;i<neighbours.length;i++){const y=previous[i*3+1],x=previous[i*3];if(y<B.Spine.y+.08||y>B.Neck.y-.02||Math.abs(x)>.20||!neighbours[i].length)continue;const z=neighbours[i].reduce((sum,j)=>sum+previous[j*3+2],0)/neighbours[i].length;p[i*3+2]=previous[i*3+2]*.35+z*.65;}}
  const base=new THREE.BufferGeometry();base.setAttribute('position',new THREE.Float32BufferAttribute(p,3));base.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));base.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));base.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));base.setIndex(data.triangles);base.computeVertexNormals();
  // Clip garment hems and sleeves through triangles, avoiding saw-tooth material boundaries.
  const groups={},norm=base.attributes.normal;
  const vertex=id=>({p:p.slice(id*3,id*3+3),n:[norm.getX(id),norm.getY(id),norm.getZ(id)],uv:uv.slice(id*2,id*2+2),w:new Map(si.slice(id*4,id*4+4).map((bone,k)=>[bone,sw[id*4+k]])),s:sleeveFields[id],limb:limbFields[id]});
  const mix=(a,b,t)=>{const w=new Map();for(const [bone,v] of a.w)w.set(bone,(w.get(bone)||0)+v*(1-t));for(const [bone,v]of b.w)w.set(bone,(w.get(bone)||0)+v*t);return {p:a.p.map((v,i)=>v+(b.p[i]-v)*t),n:a.n.map((v,i)=>v+(b.n[i]-v)*t),uv:a.uv.map((v,i)=>v+(b.uv[i]-v)*t),s:a.s+(b.s-a.s)*t,limb:a.limb+(b.limb-a.limb)*t,w};};
  const cut=(poly,field)=>{const positive=[],negative=[];if(!poly.length)return [positive,negative];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],fa=field(a),fb=field(b);(fa>=0?positive:negative).push(a);if((fa>=0)!==(fb>=0)){const c=mix(a,b,fa/(fa-fb));positive.push(c);negative.push(c);}}return [positive,negative];};
  const emit=(poly,key)=>{if(poly.length<3)return;const g=groups[key]??={p:[],n:[],uv:[],si:[],sw:[],index:[],pool:new Map()},ids=[];for(const v of poly){const hash=[...v.p,...v.uv].map(n=>Math.round(n*1e6)).join(',');if(g.pool.has(hash)){ids.push(g.pool.get(hash));continue;}const id=g.p.length/3;g.pool.set(hash,id);ids.push(id);const position=v.p.slice();
      if(!data.native&&key==='topF'&&v.limb>.55&&position[1]<B.Neck.y-.005){
        const y=position[1],chest=Math.exp(-(((y-(B.Spine1.y+.09))/.16)**2)),width=(female?.17:.215)-(female?.025:.01)*Math.exp(-(((y-(B.Spine.y+.08))/.13)**2))+(clamp(look.build)-.5)*.055;
        const front=(female?.112+clamp(look.bust)*.075:.155),depth=.108+(front-.108)*chest+(clamp(look.build)-.5)*.025;
        const shape=Math.sqrt(Math.max(0,1-(position[0]/width)**2));
        const edge=Math.max(0,Math.min(1,(width-Math.abs(position[0]))/.045));
        const centre=B.Hips.z-.006,target=centre+(position[2]>centre?depth:-.12)*shape;
        const blend=Math.min(1,Math.max(0,(B.Neck.y-.005-y)/.09));
        position[2]+=(target-position[2])*.94*edge*blend;
      }
      if(!data.native&&key==='botP'&&position[1]>B.Hips.y-.22&&position[1]<B.Hips.y+.035&&Math.abs(position[0])<.24){const radius=(female?.24:.215)+(clamp(look.hips)-.5)*.045,front=B.Hips.z+.155*Math.sqrt(Math.max(.1,1-(position[0]/radius)**2)),blend=Math.exp(-(((position[1]-(B.Hips.y-.09))/.12)**2));if(position[2]>B.Hips.z)position[2]+=(front-position[2])*.85*blend;}
      if(data.native&&['topF','botP'].includes(key)){
        const ease=key==='topF'?.014:.009;
        for(let axis=0;axis<3;axis++)position[axis]+=v.n[axis]*ease;
      }
      if(key==='botP'&&position[1]<B.Hips.y-.07){const ease=/jeans|chinos|joggers|suitpants/.test(look.bottom)? .012:.005;position[0]+=v.n[0]*ease;position[2]+=v.n[2]*ease;}
      if(key==='anatomicalScalp')for(let axis=0;axis<3;axis++)position[axis]+=v.n[axis]*.003;
      g.p.push(...position);g.n.push(...v.n);g.uv.push(...v.uv);const weights=[...v.w].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=weights.reduce((n,w)=>n+w[1],0)||1;for(let k=0;k<4;k++){g.si.push(weights[k]?.[0]||0);g.sw.push((weights[k]?.[1]||0)/sum);}}for(let i=1;i<poly.length-1;i++)g.index.push(ids[0],ids[i],ids[i+1]);};
  const hem=B.Hips.y+.015, collar=B.Neck.y+.015, pantsCut=look.bottom==='shorts'?B.LeftLeg.y+.12:look.full||/slit|mini|pencil|skirt/.test(look.bottom)?B.Hips.y-.16:B.LeftFoot.y+.035;
  for(let i=0;i<data.triangles.length;i+=3){const tri=data.triangles.slice(i,i+3).map(vertex);const [upper,lower]=cut(tri,v=>v.p[1]-hem);const [head,shirt]=cut(upper,v=>v.p[1]-collar-Math.max(0,Math.abs(v.p[0])-.06)*.6);emit(head,'skin');let torso=shirt;if(look.top==='crop'&&!look.full){const [top,bare]=cut(torso,v=>v.p[1]-(B.Spine1.y+.035));emit(bare,'skin');torso=top;}const [clothed,arm]=cut(torso,v=>v.s);emit(clothed,'topF');emit(arm,'skin');const [body,hands]=cut(lower,v=>v.limb);emit(hands,'skin');const [pants,bare]=cut(body,v=>v.p[1]-pantsCut);emit(pants,'botP');if(data.native&&['sneakers','loafers','boots'].includes(look.shoes)){const [ankles]=cut(bare,v=>v.p[1]-(B.LeftFoot.y+.025));emit(ankles,'skin');}else emit(bare,'skin');}
  // Clip a continuous hairline into the scalp instead of dropping whole triangles.
  if(look.hair!=='bald')for(let i=0;i<data.triangles.length;i+=3){
    const tri=data.triangles.slice(i,i+3).map(vertex);
    const [hair]=cut(tri,v=>{const front=1/(1+Math.exp(-(v.p[2]-.025)*65)),temple=Math.min(1,Math.abs(v.p[0])/.08);return v.p[1]-(B.Head.y+.033+.057*front+(look.hair==='fade'?.026*temple:0));});
    emit(hair,'anatomicalScalp');
  }
  const result={};for(const [key,a]of Object.entries(groups)){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(a.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(a.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(a.uv,2));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(a.si,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(a.sw,4));g.setIndex(a.index);if(key==='topF'||key==='botP')g.computeVertexNormals();g.computeBoundingSphere();result[key]=g;}base.dispose();
  if(!female&&['stubble','goatee','fullbeard'].includes(look.beard)) {
    const g=result.skin.clone(),pos=g.attributes.position,n=g.attributes.normal,indices=[];
    for(let i=0;i<g.index.count;i+=3){const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];if(ids.every(id=>pos.getY(id)>B.Head.y-.085&&pos.getY(id)<B.Head.y-.03&&pos.getZ(id)>.048&&(look.beard!=='goatee'||Math.abs(pos.getX(id))<.04)))indices.push(...ids);}
    for(let i=0;i<pos.count;i++)pos.setXYZ(i,pos.getX(i)+n.getX(i)*.0015,pos.getY(i)+n.getY(i)*.0015,pos.getZ(i)+n.getZ(i)*.0015);
    if(indices.length){g.setIndex(indices);g.computeBoundingSphere();result.beard=g;}else g.dispose();
  }
  // Authored eyelids surround simple physical eyeballs; no painted face.
  const spheres=[],pupils=[];const eyeCentres=[];
  for(const s of ['l','r']) {const head=bones.find(b=>b.name==='Head');const pos=V(J[s+'-eye']).sub(V(J.head)).multiplyScalar(scale).applyQuaternion(head.rotation).add(B.Head);pos.x*=1+(clamp(look.faceWidth)-.5)*.25;pos.z-=.005;eyeCentres.push(pos.clone());const ball=new THREE.SphereGeometry(.0145,12,8);ball.translate(pos.x,pos.y,pos.z);spheres.push(ball);const pupil=new THREE.SphereGeometry(.0065,10,6);pupil.scale(1,1,.22);pupil.translate(pos.x,pos.y,pos.z+.014);pupils.push(pupil);}
  const combine=(list)=>{const positions=[],normals=[],weights=[],ids=[],indices=[];let count=0;for(const g of list){positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);for(let i=0;i<g.attributes.position.count;i++){ids.push(I.Head,0,0,0);weights.push(1,0,0,0);}indices.push(...Array.from(g.index.array,x=>x+count));count+=g.attributes.position.count;g.dispose();}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));g.setIndex(indices);g.computeBoundingSphere();return g;};
  // Subtle pigmentation follows the actual facial surface and its morphs.
  const skin=result.skin, positions=skin.attributes.position, colors=[];
  const eyeY=(eyeCentres[0].y+eyeCentres[1].y)/2;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    let brow=0,lip=0;
    if(z>eyeCentres[0].z-.005&&y>B.Head.y-.045){
      for(const eye of eyeCentres){const t=(x-eye.x)/.026, arch=eyeY+.022+.006*(1-t*t);brow=Math.max(brow,Math.exp(-(t**6))*Math.exp(-(((y-arch)/.0045)**2)));}
      lip=Math.exp(-((x/.030)**6))*Math.exp(-(((y-(eyeY-.076))/.009)**4));
    }
    colors.push(1-brow*.80-lip*.06,1-brow*.82-lip*.22,1-brow*.83-lip*.17);
  }
  skin.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  result.humanEyes=combine(spheres);result.humanIris=combine(pupils);return result;
}
