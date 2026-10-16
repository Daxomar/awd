// Creates new disposable browser accounts; never edits an existing player.
import fs from 'node:fs/promises';
const u=new URL(process.env.DATABASE_URL||'postgres://localhost/invalid');
if(process.env.NODE_ENV==='production'||!['localhost','127.0.0.1'].includes(u.hostname)||u.pathname!=='/awd_security')throw Error('Use isolated local awd_security only.');
const {signup}=await import('../src/auth.js'),Game=await import('../src/game/rules.js'),{pool,savePlayers}=await import('../src/db.js');
const fixtures=[];
try{
  for(const [i,role]of ['newcomer','host','worker','newcomer2'].entries()){
    const username='en'+Date.now().toString(36)+i,password='engagement-fixture-passphrase';
    const a=await signup({username,password,dob:'1995-01-01',agree:true});if(a.error)throw Error(a.error);
    const state=Game.newState({id:a.id,u:username}),o=Game.DATA.ORIGINS[state.birthOrigin];
    Object.assign(state,{onboarded:true,name:username,origin:state.birthOrigin,home:o.homes[0],place:role==='worker'?'hub':'home',cash:o.cash,momo:o.momo,rentPaidUntil:Date.now()+30*86400000});
    state.flags.bornAt=Date.now();state.traits=['hustler','highlife'];
    if(role==='worker')state.job={id:'tech',rank:0,grade:0,perf:45,shifts:0,lastDay:-1,since:Date.now()};
    await savePlayers([{id:a.id,state,worth:Game.netWorth(state)}]);fixtures.push({username,password,cookie:a.sessionKey,id:a.id,home:state.home,role});
  }
  const dir=new URL('../../.local/engagement/',import.meta.url);await fs.mkdir(dir,{recursive:true});await fs.writeFile(new URL('fixtures.json',dir),JSON.stringify(fixtures),{mode:0o600});console.log('Four new disposable browser fixtures created.');
}finally{await pool.end();}
