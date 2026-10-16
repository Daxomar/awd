// New disposable accounts only. Never edits an existing player or production DB.
import fs from 'node:fs/promises';
const url=new URL(process.env.DATABASE_URL||'postgres://localhost/invalid');
if(process.env.NODE_ENV==='production'||!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/awd_security')throw Error('Use the isolated local awd_security test database.');
const {signup}=await import('../src/auth.js'),Game=await import('../src/game/rules.js'),{pool,savePlayers}=await import('../src/db.js');
const fixtures=[];
try{
 for(const [index,home]of ['nima','jtown','kaneshie','labadi','osu','airres','legon','trasacco','osu'].entries()){
  const username='st'+Date.now().toString(36).slice(-7)+index,password='street-fixture-passphrase';
  const a=await signup({username,password,dob:'1995-01-01',agree:true});if(a.error)throw Error(a.error);
  const state=Game.newState({id:a.id,u:username});
  // Controlled new-account test conditions let every existing housing tier and
  // legitimate owned/rented estate condition be exercised without spending real funds.
  Object.assign(state,{onboarded:true,name:'Street QA '+(index+1),home,place:'home',cash:0,momo:100000000,rentPaidUntil:Date.now()+365*86400000});
  state.traits=['hustler','highlife'];state.look={body:index%2?'f':'m',skin:5,top:'tee',topCol:'#d9d6c3',bottom:'chinos',bottomCol:'#42584f',hair:'lowcut',beard:'nobeard'};
  if(Game.DATA.HOMES[home].buy)state.owned[home]=true;
  await savePlayers([{id:a.id,state,worth:Game.netWorth(state)}]);fixtures.push({username,password,cookie:a.sessionKey,home,owned:!!state.owned[home],id:a.id});
 }
 const dir=new URL('../../.local/phase5/',import.meta.url);await fs.mkdir(dir,{recursive:true});await fs.writeFile(new URL('fixtures.json',dir),JSON.stringify(fixtures),{mode:0o600});console.log('Created nine isolated street QA accounts.');
}finally{await pool.end();}
