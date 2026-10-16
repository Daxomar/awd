import fs from 'node:fs/promises';
const u=new URL(process.env.DATABASE_URL||'http://invalid');
if(process.env.NODE_ENV==='production'||!['127.0.0.1','localhost'].includes(u.hostname)||u.pathname!=='/awd_security')throw Error('Disposable local awd_security only.');
process.env.BIRTH_SEED='phase8-disposable-local-simulation-seed';
const {pool,savePlayers}=await import('../src/db.js');const Game=await import('../src/game/rules.js');
if(process.argv[2]==='age-businesses'){
 const id=Number(process.argv[3]);const own=(await pool.query("select id from accounts where id=$1 and username like 'p8%'",[id])).rowCount;
 if(!own)throw Error('Only phase8 fixture-owned businesses can be aged.');
 await pool.query('update life_businesses set last_period=floor(extract(epoch from now())/21600)::bigint-9 where owner=$1',[id]);console.log('Disposable fixture business periods aged for settlement testing; no wallet edit.');await pool.end();
}else{
 const {signup}=await import('../src/auth.js');const replace=process.argv[2]==='replace-role'?process.argv[3]:null;
 const dir=new URL('../../.local/phase8/',import.meta.url),fixtures=replace?JSON.parse(await fs.readFile(new URL('fixtures.json',dir),'utf8')).filter(f=>f.role!==replace):[];
 try{
  for(const [role,origin,place]of [['career','hustler','hub'],['owner','hustler','makola'],['seller','hustler','circle'],['buyer','dbee','circle'],['friend','hustler','n:nima'],['property','dbee','home']]){
   if(replace&&role!==replace)continue;
   let a,state;for(let n=0;n<60;n++){
    const username='p8'+Date.now().toString(36)+n.toString(36),password='phase8-disposable-browser-passphrase';
    a=await signup({username,password,dob:'1995-01-01',agree:true});if(a.error)throw Error(a.error);
    state=Game.newState({id:a.id,u:username});if(state.birthOrigin===origin){a.username=username;a.password=password;break;}a=null;
   }
   if(!a)throw Error('Could not draw required natural fixture birth outcome.');
   const o=Game.DATA.ORIGINS[origin];Object.assign(state,{onboarded:true,name:a.username,origin,home:o.homes[0],place,cash:o.cash,momo:o.momo,rentPaidUntil:Date.now()+7*86400000});
   state.flags.bornAt=Date.now()-2*86400000;state.traits=['hustler','highlife'];
   await savePlayers([{id:a.id,state,worth:Game.netWorth(state)}]);fixtures.push({role,username:a.username,password:a.password,id:a.id,cookie:a.sessionKey,origin,home:state.home});
  }
  await fs.mkdir(dir,{recursive:true});await fs.writeFile(new URL('fixtures.json',dir),JSON.stringify(fixtures),{mode:0o600});console.log('Isolated browser fixtures saved with natural Hustler/Dbee outcomes.');
 }finally{await pool.end();}
}
