import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/game/rules.js';

function player(origin){const p={acct:7,name:'setup_player',state:Game.newState({id:7,u:'setup_player'})};p.state.birthOrigin=origin;return p;}
function act(p,op,fields={}){return Game.onboardingProgress(p,{id:'request',op,revision:p.state.onboarding?.revision||0,...fields},123456789);}
function prepared(p){act(p,'begin');act(p,'character',{name:'Ama',look:{body:'f',bust:.8,skin:7},traits:['hustler','highlife']});act(p,'roll');act(p,'homes');}

for(const origin of ['hustler','dbee'])test(`${origin}: persisted setup, repeated reveal and completion credit exactly once`,()=>{
 const p=player(origin);assert.equal(act(p,'finish').ok,false);prepared(p);
 const assigned=p.state.birthOrigin,revision=p.state.onboarding.revision;
 for(let i=0;i<5;i++){assert.ok(act(p,'roll',{birthOrigin:origin==='dbee'?'hustler':'dbee',revision:0}).ok);assert.equal(p.state.onboarding.revision,revision);}
 assert.equal(p.state.cash+p.state.momo,0);
 p.state=Game.migrate(structuredClone(p.state),{id:7,u:p.name});
 assert.equal(p.state.onboarding.step,'home');assert.equal(p.state.onboarding.look.bust,.8);
 const home=Game.DATA.ORIGINS[origin].homes.at(-1);assert.ok(act(p,'home',{home}).ok);assert.ok(act(p,'finish').complete);
 const balance=p.state.cash+p.state.momo;assert.equal(balance,origin==='dbee'?25000:800);assert.equal(p.state.home,home);assert.equal(p.state.birthOrigin,assigned);
 p.state.cash-=17;for(let i=0;i<3;i++)assert.ok(act(p,'finish').complete);
 assert.equal(p.state.cash+p.state.momo,balance-17);assert.equal(p.state.look.body,'f');assert.equal(p.state.look.bust,.8);
});
test('invalid home, stale edits and skipped steps preserve state',()=>{
 const p=player('hustler');const before=structuredClone(p.state);
 for(const op of ['roll','homes','home','finish']){assert.equal(act(p,op,{home:'trasacco'}).ok,false);assert.deepEqual(p.state,before);}
 prepared(p);const saved=structuredClone(p.state);
 assert.equal(act(p,'home',{home:'trasacco'}).ok,false);assert.deepEqual(p.state,saved);
 assert.equal(act(p,'home',{home:'nima',revision:-1}).conflict,true);assert.deepEqual(p.state,saved);
});
test('character drafts persist without awarding funds; back navigation retains reveal',()=>{
 const p=player('dbee');act(p,'begin');act(p,'draft',{name:'Kojo',look:{body:'m',skin:8},traits:['hustler']});
 p.state=Game.migrate(structuredClone(p.state),{id:7,u:p.name});assert.equal(p.state.onboarding.name,'Kojo');assert.equal(p.state.onboarding.look.skin,8);
 assert.equal(act(p,'character',{name:'Kojo',look:{body:'m'},traits:['bad','bad']}).ok,false);
 prepared(p);act(p,'back',{to:'lottery'});const at=p.state.onboarding.revealedAt;act(p,'back',{to:'character'});
 assert.equal(act(p,'homes').ok,false);
 act(p,'character',{name:'Kojo',look:{body:'m'},traits:['hustler','highlife']});assert.equal(p.state.onboarding.revealedAt,at);assert.equal(p.state.cash,0);
 assert.equal(Game.onMsg(p,{t:'onboard',traits:['hustler','highlife'],home:'osu'}, {},Date.now()).k,'bad');
});
import {spawnSync} from 'node:child_process';
test('production rejects a legacy command that skips the checkpoint sequence',()=>{
 const script=`import * as G from './src/game/rules.js';const p={acct:1,name:'test',state:G.newState({id:1,u:'test'})};const r=G.onMsg(p,{t:'onboard',traits:['hustler','highlife'],home:G.DATA.ORIGINS[p.state.birthOrigin].homes[0]},{});if(p.state.onboarded||r.k!=='bad')process.exit(1);`;
 const env={...process.env,NODE_ENV:'production',SESSION_SECRET:'session-unit-test-'.repeat(4),BIRTH_SEED:'birth-unit-test-'.repeat(4),PUBLIC_URL:'http://127.0.0.1:8082',DATABASE_URL:'postgres://local/test',REDIS_URL:'redis://localhost'};
 for(const key of ['DEV','BOT_KEY','SESSION_SECRET_FILE','BIRTH_SEED_FILE','ADMIN_KEY','ADMIN_KEY_FILE'])delete env[key];
 const r=spawnSync(process.execPath,['--input-type=module','-e',script],{env,encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});
