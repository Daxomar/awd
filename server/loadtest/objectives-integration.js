import assert from 'node:assert/strict';
assert.notEqual(process.env.NODE_ENV,'production','Do not run fixture mutation against a production environment.');
const url=new URL(process.env.DATABASE_URL||'postgres://invalid/invalid');assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname.endsWith('_security'),'Isolated local *_security database required');
const {pool,migrate}=await import('../src/db.js'),Game=await import('../src/game/rules.js'),Social=await import('../src/social.js'),Intro=await import('../src/first-friend.js'),Obj=await import('../src/objectives.js');
try{
  await migrate();await Social.migrateSocial();await Intro.migrateFirstFriend();await Obj.migrateObjectives();
  const acct=+(await pool.query("insert into accounts(username,pass) values($1,'unused-mock-account') returning id",['ob'+Date.now().toString(36)])).rows[0].id;
  const state=Game.newState({id:acct,u:'objectiveqa'});state.onboarded=true;state.home='nima';const p={acct,state};
  await pool.query('insert into players(id,state) values($1,$2)',[acct,JSON.stringify(state)]);
  const cash=state.cash+state.momo,xp=state.xp;
  assert.equal((await Obj.claim(p,'first_market')).t,'objective_error');assert.equal((await Obj.claim(p,'invented')).t,'objective_error');
  Game.goPlace(p,'n:nima');assert.equal((await Obj.list(p)).rows.find(d=>d.id==='first_street').completed,true);
  assert.equal((await Obj.claim(p,'first_street')).claimed,'first_street');await Obj.claim(p,'first_street');
  assert.equal(p.state.xp,xp+15);assert.equal(p.state.cash+p.state.momo,cash);
  const saved=(await pool.query('select state from players where id=$1',[acct])).rows[0].state;p.state=Game.migrate(saved,{id:acct,u:'objectiveqa'});
  assert.equal((await Obj.list(p)).rows.find(d=>d.id==='first_street').claimed,true);
  assert.equal((await pool.query('select count(*) n from objective_rewards where acct=$1',[acct])).rows[0].n,'1');
  await Obj.migrateObjectives();assert.equal((await Obj.list(p)).rows.find(d=>d.id==='first_street').claimed,true);
  console.log(JSON.stringify({passed:6,checks:['incomplete/forged claim rejected','server visit records real progress','duplicate claim awards once','no cash balance change','reload persists XP and claim','migration rerun preserves claim']},null,2));
}finally{await pool.end();}
