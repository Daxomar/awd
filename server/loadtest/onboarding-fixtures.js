// Disposable local fixture generator. Does not alter existing accounts or probabilities.
// DATABASE_URL must point to the isolated local awd_security database.
// Use the same BIRTH_SEED as the QA server, never a production seed.
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
const url=new URL(process.env.DATABASE_URL||'postgres://localhost/invalid');
if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/awd_security'||process.env.NODE_ENV==='production')throw Error('Use the isolated local awd_security database in test mode.');
if(!process.env.BIRTH_SEED||process.env.BIRTH_SEED.length<32)throw Error('Set an explicit test BIRTH_SEED matching the QA server.');
const {signup}=await import('../src/auth.js'),{birthOrigin}=await import('../src/game/rules.js'),{pool,migrate}=await import('../src/db.js');
try{
 await migrate();const found={},all=[];const stamp=Date.now().toString(36).slice(-8);
 for(let i=0;i<40;i++){
  const username='onb'+stamp+i,password='onboarding-fixture-password';
  const a=await signup({username,password,dob:'1995-01-01',agree:true});if(a.error)throw Error(a.error);
  const f={username,password,cookie:a.sessionKey,origin:birthOrigin(a.id)};all.push(f);found[f.origin]??=f;
  if(found.hustler&&found.dbee&&all.filter(f=>f.origin==='hustler').length>=2)break;
 }
 if(!found.hustler||!found.dbee)throw Error('Both outcomes not found within 40 accounts. Try another test seed.');
 const output=resolve(process.argv[2]||'../.local/onboarding/fixtures.json');
 if(!output.split(/[\\/]/).includes('.local'))throw Error('Fixture sessions must stay in ignored .local.');
 await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify({found,all}),{mode:0o600});console.log('Created disposable fixtures for both outcomes. Keep their session file private in .local.');
}finally{await pool.end();}
