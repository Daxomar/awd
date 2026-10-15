// One live Accra instance. v2 is room-based (like Lagos Life): every player is inside one place (a venue, their home,
// or a friend's home) or on the road. Each place runs as room instances of up to ROOM_CAP players; presence, walking,
// sitting and chat are relayed only inside the room. Money, DMs and gems work across the whole city.
import { CFG } from './config.js';
import { cleanText, moderate, BLOCK_MSG } from './filter.js';
import * as Gist from './gist.js';
import * as Game from './game/rules.js';
import * as Social from './social.js';
import { Oware } from './oware.js';
import {ballot} from './civic.js';
import * as PhoneGames from './game/phone-games.js';
import { loadPlayer, savePlayers, pool } from './db.js';
import { randomUUID } from 'node:crypto';

const DEV = CFG.dev;
const GYM = new Set(['workout', 'beachworkout', 'train', 'jog', 'stadiumjog', 'spar']);
const ROOM_CAP = +(process.env.ROOM_CAP || 25);
const D = Game.DATA;

// player-to-player socials. min = friendship points needed, gain = social need for both, pts = friendship gained
export const SOCIALS = {
  wave: { label: 'Wave', ic: 'icon:hand-waving', min: 0, gain: 5, pts: 1, anim: 'agree' },
  chat: { label: 'Chat', ic: 'icon:chat-circle-dots', min: 0, gain: 16, pts: 3 },
  joke: { label: 'Crack a joke', ic: 'icon:smiley', min: 0, gain: 12, fun: 12, pts: 3, skill: 'comedy' },
  compliment: { label: 'Compliment', ic: 'icon:star', min: 3, gain: 14, pts: 4, skill: 'charisma' },
  gist: { label: 'Share gist', ic: 'icon:chat-circle-dots', min: 8, gain: 20, fun: 6, pts: 4 },
  dance: { label: 'Dance together', ic: 'icon:person-simple-dance', min: 10, gain: 18, fun: 18, pts: 5, anim: 'dance' },
  hug: { label: 'Hug', ic: 'icon:smiley', min: 25, gain: 22, pts: 5 },
  flirt: { label: 'Flirt', ic: 'icon:smiley', min: 35, gain: 16, fun: 12, pts: 6, romance: true },
  askout: { label: 'Ask out', ic: 'icon:envelope', min: 70, romance: true, request: true },
  propose: { label: 'Propose', ic: 'icon:diamond', min: 120, romance: true, request: true, propose: true },
};
export const FRIEND_LEVELS = [[0, 'Stranger'], [10, 'Acquaintance'], [30, 'Friend'], [70, 'Good friend'], [120, 'Best friend']];

export class Shard {
  constructor(bus) {
    this.bus = bus; this.players = new Map(); this.byAcctMap = new Map(); this.rooms = new Map(); this.nextId = 1; this.saves = new Map();
    this.stats = { tickMs: 0, outBytes: 0, inMsgs: 0, rooms: 0 }; this.oware = new Oware(this); this.gem = null; this.gemsFound = 0; this.policy = null;
    pool.query(`create table if not exists kv (k text primary key, v bigint)`).then(() => pool.query(`select v from kv where k='gems'`)).then((r) => { this.gemsFound = r.rows[0] ? +r.rows[0].v : 0; }).catch(() => {});
    setInterval(() => this.slowTick(), 1000);
    setInterval(() => this.placesTick(), 5000);
    // Free play: no unsolicited timed treasure hunts or story objectives.
    setInterval(() => this.flush().catch((e) => console.error('[save]', e.message)), CFG.saveEveryMs);
  }
  get online() { return this.players.size; }
  byAcct(id) { return this.byAcctMap.get(id) || null; }
  byName(n) { n = String(n || '').toLowerCase(); for (const p of this.players.values()) if (p.name.toLowerCase() === n) return p; return null; }
  async join(ws, acct) {
    this.joining ||= new Set();
    if(this.joining.has(acct.id))return {error:'Your account is connecting. Try again shortly.'};
    this.joining.add(acct.id);
    try{return await this.joinAccount(ws,acct);}finally{this.joining.delete(acct.id);}
  }
  async joinAccount(ws, acct) {
    if (this.players.size >= CFG.shardCap) return { error: 'This Accra is full. Try another server.' };
    const old = this.byAcct(acct.id); if (old) { try { old.ws.end(4000, 'Logged in elsewhere'); } catch {} this.leave(old); }
    if (this.saves.has(acct.id)) await this.saves.get(acct.id);
    const leaseToken=randomUUID(),leaseKey=CFG.redisNamespace+'awd:account:'+acct.id;
    const redis=this.bus?.pub;
    if(!acct.bot&&(CFG.production||redis?.status==='ready')){
      if(redis?.status!=='ready'||await redis.set(leaseKey,leaseToken,'EX',90,'NX')!=='OK')return {error:'This account is active on another server. Log out there first.'};
    }
    let saved, state;
    try{
      saved=acct.bot?null:await loadPlayer(acct.id);state=Game.migrate(saved,acct);
      // Save the assigned birth background before exposing a first welcome packet.
      if(!saved&&!acct.bot)await savePlayers([{id:acct.id,state,worth:Game.netWorth(state)}]);
    }catch(e){if(redis?.status==='ready')await redis.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",1,leaseKey,leaseToken);throw e;}
    const fresh = !saved;
    const p = { id: this.nextId++ >>> 0, acct: acct.id, name: acct.u, ws, state, x: 0, z: 0, rx: null, rz: null, it: null, zn: null, room: null,
      chatAt: 0, chatBurst: 0, dirty: fresh, bot: !!acct.bot, dev: DEV,leaseKey,leaseToken };
    if (state.place) Game.goPlace(p, state.place);
    this.players.set(p.id, p); this.byAcctMap.set(p.acct, p);
    if(!p.bot&&redis?.status==='ready')p.leaseTimer=setInterval(async()=>{
      try{const ok=await redis.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('EXPIRE',KEYS[1],90) end return 0",1,leaseKey,leaseToken);if(!ok&&!p.gone)p.ws.end(4003,'Account lock expired');}
      catch{if(!p.gone)p.ws.end(4003,'Account lock unavailable');}
    },30000);
    const wb = Game.onJoin(p, Date.now());
    this.send(p, { t: 'welcome', id: p.id, shard: CFG.shardId, now: Date.now(), state: Game.view(p.state), fresh, dev: DEV, gems: this.gemsFound });
    if (wb) this.send(p, wb);
    if (state.onboarded) this.enterRoom(p);
    if (this.gem) { const L = Game.LOC[this.gem.place]; this.send(p, { t: 'gem_drop', gem: this.gemInfo(), area: L.area, hint: ` A gem is hiding somewhere in ${L.area}!`, found: this.gemsFound, quiet: true }); }
    if (!p.bot) { Social.claim(p).then((list) => list.forEach((m) => this.send(p, m))).catch((e) => console.error('[claim]', e.message)); Social.unreadCount(p).then((n) => n && this.send(p, { t: 'dm_unread', n })).catch(() => {}); }
    return { p };
  }
  fault(p, where, e) { this.stats.faults = (this.stats.faults || 0) + 1; p.faults = (p.faults || 0) + 1; if (p.faults <= 3 || p.faults % 100 === 0) console.error(`[fault] acct=${p.acct} ${where}:`, e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e); if (p.faults > 20) { p.state.busy = null; p.state.shift = null; } }
  leave(p) {
    if (!this.players.has(p.id)) return;
    this.oware.leave(p); this.leaveRoom(p); this.players.delete(p.id); if (this.byAcctMap.get(p.acct) === p) this.byAcctMap.delete(p.acct); p.gone = true;
    clearInterval(p.leaseTimer);
    if (!p.bot) {
      const pendingOnboarding=p.onboardingTask||(p.onboardingSave?this.saves.get(p.acct):null);
      const save = (async()=>{
        if(p.moneyTask)await p.moneyTask.catch(()=>{});
        if(p.saving)await p.saving.catch(()=>{});
        if(pendingOnboarding)await pendingOnboarding.catch(()=>{});
        await savePlayers([{id:p.acct,state:this.persist(p),worth:Game.netWorth(p.state)}]);
        if(this.bus?.pub?.status==='ready')await this.bus.pub.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",1,p.leaseKey,p.leaseToken);
      })();
      this.saves.set(p.acct, save);
      save.catch((e) => console.error('[save on leave]', e.message)).finally(() => { if (this.saves.get(p.acct) === save) this.saves.delete(p.acct); });
    }
  }
  persist(p) { p.state.pos = [Math.round(p.x), Math.round(p.z)]; p.state.lastSeen = Date.now(); return p.state; }
  async flush() {
    const batch = [],people=[]; for (const p of this.players.values()) if (p.dirty && !p.bot && !p.moneyBusy && !p.onboardingSave && !p.saving) { p.dirty = false;people.push(p); batch.push({ id: p.acct, state: structuredClone(this.persist(p)), worth: Game.netWorth(p.state) }); }
    const saving=savePlayers(batch);for(const p of people)p.saving=saving;
    try { await saving; } catch (error) {
      for (const row of batch) { const p = this.byAcct(row.id); if (p) p.dirty = true; }
      throw error;
    }finally{for(const p of people)if(p.saving===saving)p.saving=null;}
  }
  send(p, obj) { try { const s = JSON.stringify(obj); p.ws.send(s, false); this.stats.outBytes += s.length; } catch {} }

  // ---------------- rooms ----------------
  roomBase(p) { const pl = p.state.place; if (!pl) return null; if (pl === 'home') return 'home:' + p.acct; if (pl.startsWith('visit:')) return 'home:' + pl.slice(6); return pl; }
  fit(o) { const s = o.state, b = s.busy; return s.shift && s.job ? 'work:' + s.job.id : b && b.sleep ? 'sleep' : b && GYM.has(b.id) ? 'gym' : null; }
  info(o) { const b = o.state.busy; return { id: o.id, n: o.name, lk: o.state.look, fit: this.fit(o), x: o.rx, z: o.rz, it: o.it, zn: o.zn, st: b && !b.travel ? b.ic : o.state.shift ? 'icon:briefcase' : '', lbl: b && !b.travel ? b.label || '' : o.state.shift ? 'At work' : '' }; }
  enterRoom(p) {
    this.leaveRoom(p); const base = this.roomBase(p); p.roomPlace = p.state.place; if (!base) return;
    let room = null;
    if (base.startsWith('home:')) { room = this.rooms.get(base); if (!room) this.rooms.set(base, (room = { key: base, base, members: new Set() })); }
    else for (let i = 0; i < 400 && !room; i++) { const k = base + '#' + i; const r = this.rooms.get(k); if (!r) this.rooms.set(k, (room = { key: k, base, members: new Set() })); else if (r.members.size < ROOM_CAP) room = r; }
    const custody=p.state.flags.jailUntil>Date.now();
    p.room = room; p.rx = custody?-2.8:null; p.rz = custody?-2.4:null; p.it = null; p.zn = null;
    const people = []; for (const o of room.members) people.push(this.info(o));
    room.members.add(p); this.stats.rooms = this.rooms.size;
    let home = null; if (base.startsWith('home:')) { const ownerId = +base.slice(5); const owner = ownerId === p.acct ? p : this.byAcct(ownerId); const st = owner ? owner.state : p.state; home = { id: st.home, items: st.items, owner: owner ? owner.name : p.name, mine: ownerId === p.acct }; }
    const gem = this.gem && this.gem.place === p.state.place ? this.gemInfo() : null;
    this.send(p, { t: 'room', key: room.key, place: p.state.place, custody, name: Game.placeName(p.state, p.state.place) || (home && `${home.owner}'s place`), people, home, gem });
    this.toRoom(room, { t: 'rjoin', e: this.info(p) }, p);
  }
  leaveRoom(p) { const r = p.room; if (!r) return; r.members.delete(p); p.room = null; this.toRoom(r, { t: 'rleave', id: p.id }); if (!r.members.size) { this.rooms.delete(r.key); this.stats.rooms = this.rooms.size; } }
  toRoom(room, msg, except) { if (!room) return; const s = JSON.stringify(msg); for (const o of room.members) if (o !== except) { try { o.ws.send(s, false); this.stats.outBytes += s.length; } catch {} } }

  onBinary() { /* v1 open-world movement is retired; rooms use JSON 'rmv' */ }
  onJson(p, msg) {
    this.stats.inMsgs++;
    if (!msg || typeof msg.t !== 'string') return;
    if(p.gone)return;
    if(msg.t==='onboarding')return this.progressOnboarding(p,msg);
    if((p.moneyBusy||p.onboardingSave)&&!['ping','rmv'].includes(msg.t))return this.send(p,{t:'toast',k:'bad',m:'Saving your account. Try again shortly.'});
    switch (msg.t) {
      case 'chat': return this.chat(p, msg);
      case 'rmv': return this.roomMove(p, msg);
      case 'emote': { const a = ['agree', 'shake', 'dance', 'sad', 'wave'].includes(msg.a) ? msg.a : null; if (a && p.room && Date.now() - (p.emoteAt || 0) > 1500) { p.emoteAt = Date.now(); this.toRoom(p.room, { t: 'ranim', id: p.id, a }, p); } return; }
      case 'social': return this.social(p, msg);
      case 'askout_reply': return this.askoutReply(p, msg);
      case 'oware_practice': return this.oware.practice(p);
      case 'oware_invite': return this.oware.invite(p, msg);
      case 'oware_answer': return this.oware.answer(p, msg);
      case 'oware_move': return this.oware.move(p, msg);
      case 'oware_resign': return this.oware.resign(p, msg);
      case 'visit': return this.visit(p, msg);
      case 'gem': return this.claimGem(p, msg);
      case 'report': return this.reportPlayer(p, msg);
      case 'ping': return this.send(p, { t: 'pong', c: msg.c, now: Date.now() });
      case 'settings': { const f = p.state.flags; if (typeof msg.flirtOff === 'boolean') f.flirtOff = msg.flirtOff; if (typeof msg.dmFriends === 'boolean') f.dmFriends = msg.dmFriends; p.dirty = true; return this.send(p, { t: 'settings', flirtOff: !!f.flirtOff, dmFriends: !!f.dmFriends }); }
    }
    if (msg.t.startsWith('gist_')) return this.gist(p, msg);
    if (['estate_list','ballot','game_list','game_create','game_answer','game_move','game_resign'].includes(msg.t)) return this.async(p,msg);
    if (['send', 'dm', 'dm_answer','dm_threads', 'dm_thread', 'block', 'find', 'profile', 'forbes', 'momo_hist', 'topup'].includes(msg.t)) return this.async(p, msg);
    const beforeOnboard=msg.t==='onboard'?structuredClone(p.state):null;
    let r; try { r = Game.onMsg(p, msg, this, Date.now()); } catch (e) { this.fault(p, 'msg ' + msg.t, e); return this.send(p, { t: 'toast', k: 'bad', m: 'Something went wrong. Try again.' }); }
    if(r?.t==='onboarded'&&!p.bot){
      p.dirty=true;p.onboardingSave=true;const save=savePlayers([{id:p.acct,state:this.persist(p),worth:Game.netWorth(p.state)}]);this.saves.set(p.acct,save);
      save.then(()=>{this.send(p,r);this.after(p,r);}).catch(e=>{p.state=beforeOnboard;this.fault(p,'save onboarding',e);this.send(p,{t:'toast',k:'bad',m:'Could not save your new life. Please try again.'});}).finally(()=>{p.onboardingSave=false;if(this.saves.get(p.acct)===save)this.saves.delete(p.acct);});return;
    }
    if (r && r.look && p.room) this.toRoom(p.room, { t: 'rlook', id: p.id, lk: p.state.look }, p);
    if (r) { p.dirty = true; if (msg.t === 'act' && r.t === 'busy') { p.zn = typeof msg.zn === 'string' ? msg.zn.slice(0, 24) : null; } this.send(p, r); this.after(p, r); }
  }
  progressOnboarding(p,msg) {
    const id=typeof msg.id==='string'?msg.id.slice(0,48):'';
    if(!id)return;
    if(p.onboardingSave||p.moneyBusy||p.pending||p.gistPending)return this.send(p,{t:'onboarding',id,ok:false,error:'Saving your account. Try again shortly.',state:Game.view(p.onboardingBefore||p.state)});
    p.onboardingSave=true;p.onboardingBefore=structuredClone(p.state);
    const task=(async()=>{
      const before=structuredClone(p.state);
      try{
        if(p.saving)await p.saving;
        if(p.gone)return;
        const result=Game.onboardingProgress(p,{...msg,id});
        if(result.ok&&!p.bot)await savePlayers([{id:p.acct,state:structuredClone(this.persist(p)),worth:Game.netWorth(p.state)}]);
        this.send(p,result);
        if(result.ok&&!before.onboarded&&p.state.onboarded){Game.goPlace(p,p.state.place);this.after(p,{t:'onboarded',state:Game.view(p.state)});}
      }catch(e){p.state=before;this.fault(p,'onboarding progress',e);this.send(p,{t:'onboarding',id,ok:false,error:'Could not save your setup. Try again.',state:Game.view(p.state)});}
    })();
    p.onboardingTask=task;this.saves.set(p.acct,task);
    task.catch(e=>this.fault(p,'onboarding',e)).finally(()=>{p.onboardingSave=false;p.onboardingBefore=null;if(p.onboardingTask===task)p.onboardingTask=null;if(this.saves.get(p.acct)===task)this.saves.delete(p.acct);});
    return task;
  }
  // async (database) requests; one in flight per player
  async async(p, msg) {
    if(p.bot||p.gone)return;
    if(p.pending){
      p.asyncQueue||=[];
      if(p.asyncQueue.length<4){p.asyncQueue.push(msg);return;}
      if(msg.t==='dm')this.send(p,{t:'dm_ack',clientId:typeof msg.clientId==='string'?msg.clientId.slice(0,80):null,ok:false,m:'Network busy. Your draft is kept.'});
      return this.send(p,{t:'toast',k:'bad',m:'Network busy, try again.'});
    }
    p.pending=1;
    try {
      let r = null;
      switch (msg.t) {
        case 'estate_list': {
          const area=String(msg.area||'');if(!Object.hasOwn(D.HOMES,area)||p.state.place!=='e:'+area){r={t:'toast',k:'bad',m:'Enter the estate first.'};break;}
          const page=Math.max(0,Math.min(100000,Number.isInteger(msg.page)?msg.page:0));
          const online=[...this.players.values()].filter(p=>!p.bot),liveOwners=online.filter(p=>p.state.owned?.[area]).map(p=>({id:p.acct,name:p.name}));
          const {rows}=await pool.query(`WITH owners AS (
            SELECT a.id,a.username AS name FROM players p JOIN accounts a ON a.id=p.id
              WHERE p.state->'owned'->$1 = 'true'::jsonb AND NOT a.id=ANY($2::int[])
            UNION ALL SELECT id,name FROM jsonb_to_recordset($3::jsonb) AS live(id int,name text)
          ) SELECT count(*)::int AS total, COALESCE((SELECT jsonb_agg(h) FROM
            (SELECT id,name FROM owners ORDER BY id LIMIT 12 OFFSET $4) h),'[]'::jsonb) AS owners FROM owners`,
            [area,online.map(p=>p.acct),JSON.stringify(liveOwners),page*12]);
          r={t:'estate_list',area,page,total:rows[0].total,owners:rows[0].owners.map(owner=>({...owner,home:area,mine:owner.id===p.acct}))};break;
        }
        case 'ballot': r=await ballot(p,msg);break;
        case 'game_list': case 'game_create': case 'game_answer': case 'game_move': case 'game_resign': r=await PhoneGames.handle(this,p,msg);break;
        case 'send': r=this.oware.busy(p)?{t:'send_res',ok:false,m:'Finish your Oware game before sending money.'}:await Social.send(this,p,msg); if (r.ok) { p.dirty = true; this.send(p, { t: 'st', state: Game.view(p.state) }); } break;
        case 'dm': if (msg.to && this.isBlocking(msg.to, p.acct)) r = { t: 'toast', k: 'bad', m: 'This person is not receiving your messages.' }; else r = await Social.dm(this, p, msg); break;
        case 'dm_threads': r = await Social.threads(p); break;
        case 'dm_answer': r=await Social.answerDm(this,p,msg);break;
        case 'dm_thread': r = await Social.thread(p, msg.with); break;
        case 'block': r = await Social.block(p, msg.name, msg.on !== false); break;
        case 'find': r = await Social.find(this, msg.q); break;
        case 'profile': r = await Social.profile(this, p, msg.name); break;
        case 'forbes': r = await Social.forbes(); break;
        case 'momo_hist': r = await Social.history(p); break;
        case 'topup': r = { t: 'topup', ...(await Social.topupInit(p.acct, msg.pack, msg.email)) }; break;
      }
      if (r) this.send(p, r);
      if (msg.t === 'dm') this.send(p, { t: 'dm_ack', clientId: typeof msg.clientId === 'string' ? msg.clientId.slice(0,80) : null, ok: r?.t === 'dm_sent', m: r?.m || 'Message was not sent.' });
    } catch (e) { if(msg.t === 'dm') this.send(p,{t:'dm_ack',clientId:typeof msg.clientId === 'string' ? msg.clientId.slice(0,80) : null,ok:false,m:'Message service unavailable. Your draft is kept.'}); console.error('[async ' + msg.t + ']', e.message); this.send(p, { t: 'toast', k: 'bad', m: 'Network wahala. Try again.' }); }
    finally {p.pending=0;if(!p.gone&&p.asyncQueue?.length)this.async(p,p.asyncQueue.shift()).catch(e=>this.fault(p,'queued request',e));}
  }
  isBlocking(name, acct) { const o = this.byName(name); return o ? Social.isBlockedBy(o.state, acct) : false; }
  // cross-shard delivery
  deliverCredit(acct) { const o = this.byAcct(acct); if (o) Social.claim(o).then((l) => l.forEach((m) => this.send(o, m))).catch(() => {}); else this.bus && this.bus.publish('awd:credit', { acct }); }
  deliverDm(acct, m) { const o = this.byAcct(acct); if (o) { if (this.canReceiveDm(o, m)) this.send(o, m); } else this.bus && this.bus.publish('awd:dm', { acct, m }); }
  canReceiveDm(o, m) { const acct = Number.isInteger(m.fromAcct) ? m.fromAcct : this.acctOfName(m.from); return !Social.isBlockedBy(o.state, acct) && (!o.state.flags.dmFriends || o.state.friends?.[acct]?.pts >= 30); }
  acctOfName(n) { const o = this.byName(n); return o ? o.acct : -1; }
  strike(p, kind, raw) {
    const f = p.state.flags, now = Date.now(); f.strikes = (f.strikes || []).filter((t) => now - t < 86400000); f.strikes.push(now); p.dirty = true;
    if (f.strikes.length >= 3) { f.muteUntil = now + 3600000 * Math.min(24, f.strikes.length - 2); this.send(p, { t: 'toast', k: 'bad', m: 'Muted for repeated violations.' }); }
    if (kind === 'minor' || kind === 'sexual' || f.strikes.length >= 3) this.report(p.acct, `auto:${kind}:${p.name}`, String(raw).slice(0, 200));
  }
  // Life events update room membership.
  after(p, r) {
    const list = r.t === 'multi' ? r.list : [r];
    for (const m of list) {
      if(m.t==='onboarded'&&!p.gone&&p.state.place!==p.roomPlace)this.enterRoom(p);
      if (m.t === 'moved' || (m.t === 'done' && m.place) || m.t === 'arrived') if (p.state.place !== p.roomPlace) this.enterRoom(p);
      if (m.t === 'busy' && m.busy && m.busy.travel) this.leaveRoom(p), (p.roomPlace = null);
    }

  }
  roomMove(p, m) {
    if (!p.room) return; const now = Date.now(); if (now - (p.mvAt || 0) < 120) return; p.mvAt = now;
    const n = (v) => (Number.isFinite(v) ? Math.max(-20, Math.min(20, Math.round(v * 100) / 100)) : null);
    p.rx = n(m.x); p.rz = n(m.z); p.it = Number.isInteger(m.it) && m.it >= 0 && m.it < 200 ? m.it : null; if (typeof m.zn === 'string') p.zn = m.zn.slice(0, 24); else if (m.zn === null) p.zn = null;
    if(p.state.flags.jailUntil>now){p.rx=Math.max(-3.6,Math.min(-2,p.rx??-2.8));p.rz=Math.max(-3,Math.min(-1.8,p.rz??-2.4));p.it=null;p.zn=null;}
    this.toRoom(p.room, { t: 'rmv', id: p.id, x: p.rx, z: p.rz, it: p.it, u: Number.isInteger(m.u) ? m.u : 0, zn: p.zn }, p);
  }
  // ---------------- socials ----------------
  social(p, m) {
    const S = SOCIALS[m.kind]; const o = this.players.get(m.id | 0); const now = Date.now();
    if (!S || !o || o === p) return; if (!p.room || o.room !== p.room) return this.send(p, { t: 'toast', k: 'bad', m: `${o.name} is not here anymore.` });
    if(o.moneyBusy||o.onboardingSave)return this.send(p,{t:'toast',m:'They are saving their account. Try again shortly.'});
    if (Social.isBlockedBy(o.state, p.acct)) return this.send(p, { t: 'toast', k: 'bad', m: `${o.name} isn't interested.` });
    const fa = (p.state.friends[o.acct] ||= { n: o.name, pts: 0 }), fb = (o.state.friends[p.acct] ||= { n: p.name, pts: 0 });
    if (fa.pts < S.min) return this.send(p, { t: 'toast', k: 'bad', m: `You need to be closer first (${S.min} friendship). Chat more.` });
    if (S.romance && (o.state.flags.flirtOff || p.state.flags.flirtOff)) return this.send(p, { t: 'toast', k: 'bad', m: `${o.name} has romance turned off.` });
    if (now - (p.socialAt || 0) < 6000) return this.send(p, { t: 'toast', m: 'Small small. Give them a moment.' });
    p.socialAt = now;
    if (S.propose) { if (p.state.flags.partner !== o.acct) return this.send(p, { t: 'toast', k: 'bad', m: `You and ${o.name} need to be a couple first.` }); if (!p.state.items.ring) return this.send(p, { t: 'toast', k: 'bad', m: 'You need an engagement ring (Shop app).' }); if (p.state.flags.engaged) return this.send(p, { t: 'toast', m: 'You are already engaged! ' }); o.askFrom = { acct: p.acct, at: now, propose: true }; this.send(o, { t: 'askout_in', id: p.id, from: p.name, propose: true }); this.toRoom(p.room, { t: 'rsocial', a: p.id, b: o.id, kind: 'propose', ic: 'icon:diamond', anim: 'agree' }); return this.send(p, { t: 'toast', m: ` You went down on one knee for ${o.name}…` }); }
    if (S.request) { if (p.state.flags.partner || o.state.flags.partner) return this.send(p, { t: 'toast', k: 'bad', m: 'One of you is already in a relationship. ' }); o.askFrom = { acct: p.acct, at: now }; this.send(o, { t: 'askout_in', id: p.id, from: p.name }); return this.send(p, { t: 'toast', m: ` You asked ${o.name} out. Waiting…` }); }
    const sk = S.skill ? Math.floor(p.state.skills[S.skill] || 0) : 0; const pts = S.pts + Math.floor(sk / 3);
    fa.pts = Math.min(200, fa.pts + pts); fb.pts = Math.min(200, fb.pts + pts); fa.n = o.name; fb.n = p.name;
    for (const x of [p, o]) { const st = x.state; st.n.social = Math.min(100, st.n.social + S.gain); if (S.fun) st.n.fun = Math.min(100, st.n.fun + S.fun); Game.bump(st, 'social'); Game.bump(st, 'chat'); x.dirty = true; }
    const lvl = (v) => FRIEND_LEVELS.filter(([t]) => v >= t).pop()[1];
    this.toRoom(p.room, { t: 'rsocial', a: p.id, b: o.id, kind: m.kind, ic: S.ic, anim: S.anim || 'agree' });
    this.send(p, { t: 'social_done', with: o.name, kind: m.kind, label: S.label, pts: fa.pts, level: lvl(fa.pts) });
    this.send(o, { t: 'social_in', id: p.id, from: p.name, kind: m.kind, label: S.label, ic: S.ic, pts: fb.pts, level: lvl(fb.pts) });
  }
  askoutReply(p, m) {
    const o = this.players.get(m.id | 0); if (!o || !p.askFrom || p.askFrom.acct !== o.acct || Date.now() - p.askFrom.at > 300000) return; m.propose = !!p.askFrom.propose; p.askFrom = null;
    if (!m.yes) { this.send(o, { t: 'toast', m: `${p.name} said maybe another time. ` }); return; }
    if (o.state.flags.partner === p.acct && p.state.flags.partner === o.acct && o.state.items.ring && m.propose) {
      o.state.items.ring = false; for (const x of [p, o]) { x.state.flags.engaged = true; x.state.rel.partner = 100; x.dirty = true; Game.bump(x.state, 'engaged'); }
      this.toRoom(p.room, { t: 'rsocial', a: o.id, b: p.id, kind: 'engaged', ic: 'icon:diamond', anim: 'dance' });
      for (const x of [p, o]) this.send(x, { t: 'toast', k: 'gold', m: ` ${x === p ? o.name : p.name} and you are ENGAGED! Accra, prepare the knocking.` });
      Gist.post(o, ` They said YES! Me and @${p.name} are engaged. Knocking ceremony loading…`, true).catch(() => {}); return;
    }
    for (const [a, b] of [[p, o], [o, p]]) { a.state.flags.partner = b.acct; a.state.flags.partnerName = b.name; a.state.rel.partner = 50; a.dirty = true; Game.bump(a.state, 'partner'); }
    this.toRoom(p.room, { t: 'rsocial', a: o.id, b: p.id, kind: 'couple', ic: 'icon:heart', anim: 'dance' });
    for (const x of [p, o]) this.send(x, { t: 'toast', k: 'gold', m: ` You and ${x === p ? o.name : p.name} are now together!` });
    Gist.post(o, ` Off the market! Me and @${p.name} are officially a thing.`, true).catch(() => {});
  }
  visit(p, m) {
    const o = this.byName(m.name); const now = Date.now();
    if (!o || o === p) return this.send(p, { t: 'toast', k: 'bad', m: 'They are not online right now.' });
    if (!o.state.home || o.state.place !== 'home') return this.send(p, { t: 'toast', k: 'bad', m: `${o.name} is not at home.` });
    const f = p.state.friends[o.acct]; if (!f || f.pts < 10) return this.send(p, { t: 'toast', k: 'bad', m: `You need to know ${o.name} a bit first (Acquaintance) before you visit.` });
    const hp = Game.HOME_POS[o.state.home];
    const r = Game.travel(p, { to: 'visit:' + o.acct, mode: D.TRANSPORT[m.mode] ? m.mode : 'trotro' }, now, this, { x: hp.x, z: hp.z, name: `${o.name}'s place` });
    if (r) { this.send(p, r); this.after(p, r); }
  }
  // ---------------- daily gem hunt: a gem hides in one place; first to find it wins ----------------
  gemInfo() { const g = this.gem; return g && { id: g.id, place: g.place, seed: g.seed, prize: g.prize, until: g.until }; }
  gemTick() {
    const now = Date.now();
    if (this.gem && now > this.gem.until) { this.gem = null; this.broadcast({ t: 'gem_gone' }); }
    if (this.gem || now < (this.nextGem || 0)) return;
    const open = Object.values(Game.LOC).filter((l) => Game.isOpen(l, now)); if (!open.length) return;
    const L = open[Math.floor(Math.random() * open.length)]; const jackpot = Math.random() < 0.08;
    this.gem = { id: now, place: L.id, seed: Math.floor(Math.random() * 1e9), prize: jackpot ? 500 : 20 + Math.floor(Math.random() * 7) * 10, until: now + 12 * 60000 };
    this.nextGem = now + (12 + Math.random() * 10) * 60000;
    this.broadcast({ t: 'gem_drop', gem: this.gemInfo(), area: L.area, hint: ` A gem is hiding somewhere in ${L.area}!`, found: this.gemsFound });
  }
  claimGem(p, m) {
    const g = this.gem; if (!g || g.id !== m.id) return this.send(p, { t: 'toast', m: 'Too late! Someone found it first. ' });
    if (p.state.place !== g.place) return; this.gem = null; this.gemsFound++;
    p.state.momo += g.prize; p.state.ledger.push([Date.now(), g.prize, 'Gem hunt prize']); Game.bump(p.state, 'gem'); p.dirty = true;
    pool.query(`insert into kv (k, v) values ('gems', $1) on conflict (k) do update set v = excluded.v`, [this.gemsFound]).catch(() => {});
    this.send(p, { t: 'gem_won', prize: g.prize, momo: p.state.momo, found: this.gemsFound });
    this.broadcast({ t: 'gem_gone', by: p.name, prize: g.prize, place: Game.LOC[g.place].name, found: this.gemsFound }, p);
    if (g.prize >= 100) Gist.post(p, ` Found the gem at ${Game.LOC[g.place].name} and won GH₵${g.prize}!`, true).catch(() => {});
  }
  broadcast(m, except) { const s = JSON.stringify(m); for (const o of this.players.values()) if (o !== except && !o.bot) try { o.ws.send(s, false); } catch {} }
  placesTick() {
    const c = {}; for (const p of this.players.values()) { const pl = p.state.place; if (pl && Game.LOC[pl]) c[pl] = (c[pl] || 0) + 1; }
    this.bus && this.bus.shards().then((sh) => { const total = Object.values(sh).reduce((a, b) => a + b, 0) || this.online; this.broadcast({ t: 'places', c, online: Math.max(total, this.online) }); }).catch(() => this.broadcast({ t: 'places', c, online: this.online }));
  }
  // ---------------- feed, reports, chat ----------------
  gist(p, msg) {
    if (p.bot || p.gistPending>=2) return;
    p.gistPending=(p.gistPending||0)+1;let finished=false;
    const done = (r) => {if(!finished){finished=true;p.gistPending--;}this.send(p,r);}, fail = (e) => { console.error('[gist]', e.code||'request failed'); done({ t: 'toast', k: 'bad', m: 'Gist is busy, try again.' }); };
    if (msg.t === 'gist_feed') Gist.feed(['latest', 'trending', 'following', 'me'].includes(msg.mode) ? msg.mode : 'latest', p.acct).then((rows) => done({ t: 'gist_feed', mode: msg.mode, rows, news: Gist.NEWS })).catch(fail);
    else if (msg.t === 'gist_follow') Gist.follow(p.acct, msg.u).then((r) => done({ t: 'gist_follow', ...r })).catch(fail);
    else if (msg.t === 'gist_post') Gist.post(p, String(msg.text || '')).then((r) => { if (r.blocked) this.strike(p, r.blocked, msg.text); done(r.error ? { t: 'toast', k: 'bad', m: r.error } : { t: 'gist_posted', id: r.id }); p.dirty = true; Game.bump(p.state, 'gist'); }).catch(fail);
    else if (msg.t === 'gist_like') Gist.like(p.acct, msg.id).then(() => done({ t: 'gist_liked', id: msg.id | 0 })).catch(fail);
    else if (msg.t === 'gist_report') { this.report(p.acct, `gist:${msg.id | 0}`, 'reported post'); done({ t: 'toast', k: 'good', m: 'Post reported. Thanks for keeping Accra clean.' }); }
    else if (msg.t === 'gist_del') Gist.hide(p.acct, msg.id).then(() => done({ t: 'gist_posted' })).catch(fail);
    else done({t:'toast',m:'Unknown Gist action.',k:'bad'});
  }
  report(reporter, target, text) { if (reporter > 0) pool.query('insert into reports (reporter, target, text) values ($1,$2,$3)', [reporter, String(target).slice(0, 80), String(text || '').slice(0, 400)]).catch((e) => console.error('[report]', e.message)); }
  reportPlayer(p, msg) {
    const o = this.players.get(msg.id | 0) || this.byName(msg.name); if (!o) return; const k = 'rep:' + o.acct; if (p[k]) return this.send(p, { t: 'toast', m: 'Already reported. Thanks.' }); p[k] = 1;
    this.report(p.acct, `player:${o.acct}:${o.name}`, cleanText(msg.reason || '', 200) + ' | last: ' + (o.lastChat || ''));
    this.send(p, { t: 'toast', k: 'good', m: `Reported ${o.name}. Our team will review it.` });
  }
  chat(p, msg) {
    const now = Date.now();
    const clientId = typeof msg.clientId === 'string' ? msg.clientId.slice(0, 80) : null;
    const reject = (m) => { this.send(p, { t: 'chat_ack', clientId, ok: false, m }); this.send(p, { t: 'toast', k: 'bad', m }); };
    if (!p.state.onboarded) return reject('Finish creating your character first.');
    if (typeof msg.text !== 'string') return reject('Enter a message.');
    if (msg.ch !== 'city' && !p.room) return reject('Nearby chat is unavailable while travelling. Switch to City chat.');
    if (now - p.chatAt < 1000) { p.chatBurst++; if (p.chatBurst > 3) return reject('Please wait a moment before sending another message.'); } else p.chatBurst = 0;
    p.chatAt = now;
    const f = p.state.flags; if (f.muteUntil > now) return reject(`You are muted for ${Math.ceil((f.muteUntil - now) / 60000)} more min.`);
    const mod = moderate(msg.text);
    if (mod.blocked) { this.strike(p, mod.blocked, msg.text); return reject(BLOCK_MSG[mod.blocked] || 'Message blocked.'); }
    const text = mod.text; if (!text) return reject('Enter a message.'); if (!p.bot) { Game.bump(p.state, 'chat'); if ((msg.ch === 'city' ? this.players.size : p.room?.members.size) > 1) p.state.n.social = Math.min(100,p.state.n.social + 4); p.dirty = true; }
    p.lastChat = text; const out = { t: 'chat', ch: msg.ch === 'city' ? 'city' : 'room', id: p.id, acct: p.acct, shard: CFG.shardId, n: p.name, m: text, at: now, clientId };
    if (out.ch === 'room') { for (const o of p.room.members) if (!Social.isBlockedBy(o.state, p.acct)) this.send(o, out); }
    else { for (const o of this.players.values()) if (!Social.isBlockedBy(o.state, p.acct)) this.send(o, out); this.bus && this.bus.publish('awd:city', out); }
    this.send(p, { t: 'chat_ack', clientId, ok: true });
  }
  fromBus(ch, m) {
    if(ch==='awd:session'){const p=this.byAcct(m.id);if(p&&(!m.sessionHash||p.ws.getUserData().acct.sessionHash===m.sessionHash))p.ws.end(4003,'Session ended');}
    else if (ch === 'awd:city' && m.t === 'chat') { for (const o of this.players.values()) if (!Social.isBlockedBy(o.state, m.acct)) this.send(o, m); }
    else if (ch === 'awd:global') for (const o of this.players.values()) this.send(o, m);
    else if (ch === 'awd:credit') { const o = this.byAcct(m.acct); if (o) Social.claim(o).then((l) => l.forEach((x) => this.send(o, x))).catch(() => {}); }
    else if (ch === 'awd:dm') { const o = this.byAcct(m.acct); if (o && this.canReceiveDm(o, m.m)) this.send(o, m.m); }
  }
  slowTick() {
    const t0 = performance.now(); const now = Date.now(); const odd = (this.slowN = (this.slowN || 0) + 1) & 1;
    for (const p of this.players.values()) {
      if(p.moneyBusy||p.onboardingSave)continue;
      try {
        if(!p.bot&&this.slowN%10===0)Social.claim(p).then(l=>l.forEach(m=>this.send(p,m))).catch(e=>console.error('[claim]',e.code||'transaction failed'));
        if(p.moneyBusy)continue;
        const r = Game.tick(p, now, this); if (r) { p.dirty = true; this.send(p, r); this.after(p, r); }
        if (p.state.onboarded && p.state.place !== p.roomPlace) this.enterRoom(p);
        // status changes (started/finished an activity) are shown to the room
        const b = p.state.busy, key = b && !b.travel ? b.id : p.state.shift ? 'shift' : '';
        if (key !== (p.lastKey || '')) { p.lastKey = key; if (p.room) { const inf = this.info(p); this.toRoom(p.room, { t: 'rst', id: p.id, st: inf.st, lbl: inf.lbl, fit: inf.fit, zn: key ? p.zn : null }, p); } }
        if (!p.bot && p.state.onboarded && (p.id & 1) === odd) this.send(p, { ...Game.me(p.state, now, this.policy), place: p.state.place });
      } catch (e) { this.fault(p, 'tick', e); }
    }
    const ms = performance.now() - t0; this.stats.slowMs = Math.round((this.stats.slowMs || 0) * 0.8 + ms * 0.2); this.stats.tickMs = this.stats.slowMs;
  }
}
