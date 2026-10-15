// Disposable local fixtures. Normal onboarding initializes all starting currency.
import fs from 'node:fs/promises';
const db=new URL(process.env.DATABASE_URL||'postgres://localhost/invalid');
if(!['127.0.0.1','localhost'].includes(db.hostname)||db.pathname!=='/awd_security'||process.env.NODE_ENV==='production')throw Error('Use only the isolated local awd_security database in test mode.');
if(!process.env.BIRTH_SEED||process.env.BIRTH_SEED.length<32)throw Error('Set the same explicit test seed as the local QA server.');
const {signup}=await import('../src/auth.js'),Game=await import('../src/game/rules.js'),{pool,savePlayers}=await import('../src/db.js');
try{
 const fixtures=[];
 for(let i=0;i<40&&fixtures.length<2;i++){
  const username='hud'+Date.now().toString(36).slice(-7)+i,password='hud-fixture-passphrase';const a=await signup({username,password,dob:'1995-01-01',agree:true});if(a.error)throw Error(a.error);
  if(Game.birthOrigin(a.id)!=='hustler')continue;
  const p={acct:a.id,name:username,state:Game.newState({id:a.id,u:username})};
  for(const [op,fields] of [['begin',{}],['character',{name:fixtures.length?'Kofi':'Ama',look:fixtures.length?{body:'m'}:{body:'f',bust:.8},traits:['hustler','highlife']}],['roll',{}],['homes',{}],['home',{home:'nima'}],['finish',{}]]){
   const r=Game.onboardingProgress(p,{id:'fixture-'+op,op,revision:p.state.onboarding?.revision||0,...fields});if(!r.ok)throw Error(r.error);
  }
  // Controlled need condition, never overwrite an existing account or its money.
  if(!fixtures.length)p.state.n.energy=15;
  await savePlayers([{id:a.id,state:p.state,worth:Game.netWorth(p.state)}]);fixtures.push({username,password,cookie:a.sessionKey});
 }
 if(fixtures.length!==2)throw Error('Two fixtures were not found within the bound.');
 const dir=new URL('../../.local/hud/',import.meta.url);await fs.mkdir(dir,{recursive:true});await fs.writeFile(new URL('fixtures.json',dir),JSON.stringify(fixtures),{mode:0o600});console.log('Created two new disposable HUD accounts; sessions remain in ignored .local.');
}finally{await pool.end();}
