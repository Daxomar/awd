// Accra We Dey v2 — portrait, room-based life sim (Lagos Life style): rooms, city map, phone, people, money.
import '@fontsource-variable/outfit';
import '@fontsource-variable/bricolage-grotesque';
import '@phosphor-icons/web/bold';
import '@phosphor-icons/web/fill';
import './ui/styles.css';
import './ui/refined.css';

import * as THREE from 'three';
import { Stage } from './scene/stage.js';
import { Room } from './scene/room.js';
import { VENUES, placeNpc } from './scene/venues.js';
import { fitRoom } from './scene/frame.js';
import { loadAvatars, Avatar } from './scene/avatars.js';
import { World } from './scene/world.js';
import { Governor, stepDown, saveQuality, resolveTier, lowEnd, TIERS } from './scene/quality.js';
import { Studio } from './scene/studio.js';
import { stylist } from './ui/stylist.js';
import { fitLook, myFit } from './fits.js';
import { CityMap } from './scene/map.js';
import { net } from './net.js';
import { resumePayment } from './payments.js';
import { G, money, loc, accraNow, accraClock, isOpen, actBlock } from './store.js';
import { h, ic, toast, sheet, closeSheets, celebrate, cedi, vibrate, confirmBox } from './ui/dom.js';
import { buildChat } from './ui/chat.js';
import { showTutorial } from './ui/tutorial.js';
import { buildHud } from './ui/hud.js';
import { confirmRoomArrival, zoneActions } from './ui/hud-state.js';
import { renderZones, openZone, actsFor } from './ui/venue.js';
import { openMeet } from './ui/meet.js';
import { openLifeEvent, showLifeResult } from './ui/life-event.js';
import { goObjective } from './ui/objectives-hud.js';
import { openPlace, rideScreen } from './ui/travel.js';
import { Ride } from './scene/ride.js';
import { cityAudio } from './audio.js';
import { openMatches } from './ui/matches.js';
import { openPhoneMarket } from './ui/market.js';
import { openPerson } from './ui/people.js';
import { playMinigame } from './ui/minigame.js';
import { owareView, owareChallenge } from './ui/oware.js';
import { authScreen } from './ui/auth.js';
import { onboardScreen } from './ui/onboard.js';
import { Phone } from './phone/phone.js';
import { makeApps } from './phone/apps.js';
import {ActivityRequests} from './ui/activity-requests.js';
import {worldBlocked,gameplayViewport} from './ui/overlays.js';
import {savedCameraMode,saveCameraMode,followSupported,joystickSpeed} from './scene/movement.js';

const ui = document.getElementById('ui');
const activityRequests=new ActivityRequests(net);
const loadEl = document.getElementById('load');
let stage = null, visualsReady = false;
try { stage = new Stage(document.getElementById('c')); } catch (error) { console.warn('3D view unavailable', error); }
window.__G = G; window.__stage = stage; window.__net = net;
let chat = null; let joy = null; let view = 'room', world = null, map = null, hud = null, phone = null, rideEnd = null, backdrop = null; const studio = stage ? new Studio(stage) : null; window.__studio = studio; const ride = stage ? new Ride(stage) : null; window.__ride = ride;

// ---------------------------------------------------------------- boot
async function boot() {
  const cat = fetch('/api/data', { signal: AbortSignal.timeout(15000) }).then((r) => { if(!r.ok)throw Error('City information is unavailable.');return r.json(); });
  const av = stage ? bounded(loadAvatars(),30000).then(()=>{visualsReady=true;}).catch(error=>console.warn('Preview unavailable; setup can continue.',error)) : Promise.resolve();
  G.cat = await cat; G.offset = 0;
  // shared render loop (backdrop, onboarding preview, game)
  const clock = new THREE.Clock(); let tAcc = 0, lastFrame = 0; const frameMs = matchMedia('(pointer: coarse)').matches || innerWidth < 600 ? 1000/30 : 1000/60;
  stage?.setTime(accraClock().h);
  const governor = new Governor();
  const loop = (time) => { requestAnimationFrame(loop); if (document.hidden || time - lastFrame < frameMs - 1) return; const gap = time - lastFrame; lastFrame = time;
    // Auto graphics: a device that keeps missing frames in the city is stepped down one quality level at a time.
    if (stage.qualityPref === 'auto' && view === 'room' && governor.sample(time, gap)) { const next = stepDown(stage.quality); if (next !== stage.quality) { stage.applyQuality(next); toast(`Graphics set to ${TIERS[next].name} to keep the game smooth. Change it in Settings.`); } } const dt = Math.min(0.05, clock.getDelta()); tAcc += dt;
    if (backdrop) backdrop(dt); studio.update(dt); if (ride.active) ride.update(dt); else if (world && view === 'room' && !studio.open) world.update(dt); if (map && view === 'map') map.update(dt);
    hud?.streetHint(view==='room'&&!ride.active&&!studio.open?world?.localHint():null);
    if (hud && tAcc > 0.25) { tAcc = 0; hud.progress(); applyCamera(); if (joy) joy.hidden = view !== 'room' || ride.active || studio.open || !world || !world.room || worldBlocked(ui); }
    cityAudio.update(G.state?.place,view==='room'&&!!world?.me?.path.length,!studio.open&&!ride.active);stage.render(); };
  if(stage)requestAnimationFrame(loop);
  await av;
  const session=await fetch('/api/session',{cache:'no-store',signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('Account service is unavailable.');return r.json();});
  let token=session.authenticated?'cookie':null;
  if(session.dev&&!token){token=new URLSearchParams(location.search).get('token');try{token ||= localStorage.getItem('awd_token');}catch{}}
  try{localStorage.removeItem('awd_token');}catch{}
  const cleanUrl=new URL(location.href);if(cleanUrl.searchParams.has('token')){cleanUrl.searchParams.delete('token');history.replaceState(null,'',cleanUrl);}
  net.on('auth_expired',()=>{net.close();location.reload();});
  net.on('reconnected',w=>{G.myId=w.id;G.shard=w.shard;G.offset=net.offset;});
  hideLoad();
  for (;;) {
    if (!token) { showBackdrop(); token = await authScreen(ui); }
    try { const w = await net.connect(token); stopBackdrop(); return start(w); }
    catch (e) { try { localStorage.removeItem('awd_token'); } catch {} token = null; toast(e.message === 'Disconnected' ? 'Please log in again.' : e.message, 'bad'); }
  }
}
function hideLoad() { loadEl.style.opacity = 0; setTimeout(() => loadEl.remove(), 400); }
// a live venue behind the login card, slowly orbiting
function showBackdrop() {
  if (backdrop || !stage || !visualsReady) return; const room = new Room(stage).build(structuredClone(VENUES.oxford)); fitRoom(stage, room.spec); stage.view.zoom *= 1.05; stage.offsetY = 0.27; stage.setTime(13); stage.applyView();
  (room.spec.npcs || []).forEach((n, i) => { const P = placeNpc(room, n); room.addPerson('n' + i, new Avatar(n.look), P.x, P.z); room.placeAt('n' + i, P.x, P.z, P.yaw, P.pose, P.y); });
  const walkers = [0, 1, 2].map((i) => { const id = 'w' + i; const L = [{ body: 'f', skinTone: 5, top: '#ff4f8b', bottom: '#1d2433' }, { body: 'm', skinTone: 6, top: '#ffc83d', bottom: '#2b3a55' }, { body: 'm', skinTone: 4, top: '#0e7a4e', bottom: '#e9e2d0' }][i]; room.addPerson(id, new Avatar(L), 0, 0); return id; });
  let t = 0; const wander = () => { for (const id of walkers) { const p = room.people.get(id); if (!p.path.length) { const s = room.spec; room.walkTo(id, (Math.random() - 0.5) * s.w * 0.8, (Math.random() - 0.5) * s.d * 0.8); } } };
  backdrop = (dt) => { t += dt; stage.view.yaw = Math.PI / 4 + Math.sin(t * 0.08) * 0.35; stage.view.target.y = 0.2; stage.applyView(); room.update(dt); if (Math.random() < 0.01) wander(); };
  backdrop.room = room; wander();
}
function stopBackdrop() { if (!backdrop) return; const r = backdrop.room; for (const id of [...r.people.keys()]) r.removePerson(id); r.dispose(); backdrop = null; stage.view.yaw = Math.PI / 4; stage.offsetY = 0; stage.setTime(accraClock().h); stage.applyView(); }

// ---------------------------------------------------------------- start / onboarding
async function start(w) {
  G.myId = w.id; G.shard = w.shard; G.state = w.state; G.dev = w.dev; G.offset = net.offset; G.gemsFound = w.gems || 0;
  if (!w.state.onboarded) {
    const creator = visualsReady ? studio : null;
    if(creator){studio.show(w.state.onboarding?.look || G.cat.defaultLook.m);stage.setTime(13);}
    const saved = await onboardScreen(ui, { preview: creator ? l => studio.preview(l) : null, username: w.state.name, studio: creator, stage });
    G.state = saved;
    if(creator){studio.hide();stage.offsetY=0;stage.setTime(accraClock().h);}
  }
  if(!stage || !visualsReady){
    return showStartError('Your setup is saved. The 3D city could not load on this browser. Enable WebGL or reload to try again.');
  }
  game();
}

// ---------------------------------------------------------------- the game
function game() {
  ui.classList.add('game-ui');gameplayViewport(ui);
  const tags = h('div.tags'); const mapUi = h('div.mapui', { hidden: true }); ui.append(tags, mapUi);
  world = new World(stage, tags); window.__world = world; map = new CityMap(stage, mapUi); window.__map = map; map.build(G.cat);
  fetch('/api/billboards').then((r) => r.json()).then((j) => applyBoards(j.slots || [])).catch(() => {});
  setInterval(() => fetch('/api/billboards').then((r) => r.json()).then((j) => applyBoards(j.slots || [])).catch(() => {}), 5 * 60000);
  const filters = h('div.map-filters', null, ...[['all', 'All'], ['open', 'Open now'], ['eat', 'Food'], ['gig', 'Work'], ['fun', 'Fun'], ['people', 'Busy'],['homes','Estates'],['streets','Streets']].map(([k, l]) => h('button' + (k === 'all' ? '.on' : ''), { onclick: (e) => { map.filter = k; filters.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); drawPins(); } }, l)));
  filters.append(h('label.map-names',null,h('input',{type:'checkbox',onchange:e=>{map.showNames=e.target.checked;} }),'Names'));mapUi.append(filters);
  hud = buildHud(ui, act);window.__hud=hud;window.__audio=cityAudio;phone=new Phone(ui,makeApps(act));window.__phone=phone;phone.onchange=()=>{if(phone.open){chat?.close();closeSheets();}hud.setNav(phone.open?'phone':view==='map'?'map':'home');};
  hud.setNav('home'); refresh();
  setInterval(() => { hud.clock(); if (studio.open) return; const hh = accraClock().h; stage.setTime(hh); }, 5000); hud.clock();
  setInterval(() => { hud.quests(); }, 15000);
  net.on('connection',m=>{hud.connection(m);hud.clock();}); G.connected = net.connected;
  bindInput(); joy = bindJoystick(); bindCamera(); bindNet(); world.onRoam = (x, z) => net.send({ t: 'rmv', x, z, it: null, zn: null }); chat = buildChat(ui, n => hud.badge('chat', n)); net.release();if(G.state.busy?.travel&&!ride.active)net.emit('busy',{busy:G.state.busy});
  showTutorial(ui);
  const focusBillboardOnMap = async (slotId) => {
    if (!slotId) return;
    try {
      const j = await fetch('/api/billboards').then(r => r.json());
      if (j.slots) applyBoards(j.slots);
    } catch {}
    setView('map');
    const b = map.ads.boards.find(b => b.slot.id === slotId);
    if (b) {
      const limits = map.limits, min = stage.zoomMin;
      map.limits = { ...limits, min: 0.85 };
      stage.zoomMin = 0.85;
      map.focus(b.root.position.x, b.root.position.z, 0.9, true);
      setTimeout(() => adSheet(b), 1200);
    }
  };
  resumePayment(phone, toast, { onAdConfirmed: focusBillboardOnMap });
  const targetPlacement = new URLSearchParams(location.search).get('placement');
  if (targetPlacement && !new URLSearchParams(location.search).get('payment')) {
    setTimeout(() => focusBillboardOnMap(targetPlacement), 800);
  }
  setTimeout(()=>net.send({t:'objective_status'}),2000);
  // Stage 10: advertising lives on its own page; signing in from there returns the player to it.
  if(new URLSearchParams(location.search).get('openAds')==='1')sheet(h('div.sheet-body',null,h('p',null,'You are signed in. Bookings, payments and campaign reports are on the advertising page.'),h('a.btn.primary.wide',{href:'/advertise.html'},'Back to advertising')),{title:'Advertising'});
  const tu = new URLSearchParams(location.search).get('topup'); if (tu) fetch('/api/topup/verify?ref=' + encodeURIComponent(tu)).then((r) => r.json()).then((r) => toast(r.status === 'paid' ? 'Top-up received! It will land in your MoMo.' : 'Payment still processing…', r.status === 'paid' ? 'good' : '')).catch(() => {});
}
let phoneSig = '',workZoneSig='',closeAdPreview=null;
function refresh() {
  if (!hud) return; if(world&&G.state)world.custody=(G.state.jail??G.state.flags?.jailUntil??0)>accraNow(); if (world && world.me && G.state) { const f = myFit(); const lk = G.state.look; const key = JSON.stringify(lk) + f; if (key !== world.me.av.styleKey) { world.me.av.styleKey = key; world.me.av.baseLook = lk; world.restyle('me', lk, f); } }
  hud.stats(); hud.quests(); hud.clock(); hud.progress(); hud.badge('phone', phoneBadge());
  // the phone only redraws when something it shows actually changed (keeps taps and scroll stable)
  const s = G.state; const sig = JSON.stringify([s.cash, s.momo, s.job&&[s.job.id,s.job.rank,s.job.grade,Math.round(s.job.perf),s.job.shifts,s.job.satisfaction,s.job.lastDay], s.shift && [Math.floor(s.shift.worked),s.shift.tasks,s.shift.assignment?.id,s.shift.assignment?.stage], s.items, s.home, s.car, s.loan, s.story && s.story.inbox.map((m) => m.id + ':' + m.ans), s.story && s.story.goals.length, s.daily, Object.keys(s.biz || {}), Object.keys(s.land || {}), Object.keys(s.friends || {}).length, G.unreadDm, s.dream, s.dreamTier, s.place, s.flags && s.flags.flirtOff]);
  const workKey=[world?.place,s.job?.id,!!s.shift].join(':');
  if(world?.spec&&world.place===s.place&&workKey!==workZoneSig){
    workZoneSig=workKey;renderZones(hud.zones,world.spec,world.place,act);
    for(const z of world.spec.zones.filter(z=>z.work)){
      const normal=world.spec.zones.find(a=>!a.work&&a.item===z.item);
      if(s.shift&&s.job?.id===z.work)world.itemZone.set(z.item,z);else if(normal)world.itemZone.set(z.item,normal);else world.itemZone.delete(z.item);
    }
  }
  if (sig !== phoneSig) { phoneSig = sig; phone && phone.refresh(); }
}
const phoneBadge = () => { const s = G.state; return (s && s.story ? s.story.inbox.filter((m) => m.ans === null).length : 0) + (G.unreadDm || 0); };

// ---------------------------------------------------------------- actions (called by UI modules)
const OPENS = { loans: 'bank', deposit: 'bank', 'shop:home': 'shop', 'shop:gadgets': 'shop', cars: 'cars', rentCar:'cars', ballot:'civic', police:'police', games:'games', momo: 'momo' };
const STYLE_OPENS = { wardrobe: 'boutique', 'shop:fashion': 'boutique', boutique: 'boutique' };
// Stage 9: a player business signboard. Customers are simulated by the game's demand model; nothing here is a fake sale.
function openFrontage(b){
  sheet(h('div.sheet-body',null,h('p',null,`Run by @${b.owner}${b.mine?' (you)':''}.`),
    h('p.context-hint',null,b.open?'Open now.':!b.operating?'Closed by the owner.':!b.stocked?'Out of stock right now.':'Closed at this hour.'),
    h('p.muted',null,'Sales here come from simulated customers in the game’s demand model. They are not purchases by real players.'),
    b.mine?h('button.btn.primary.wide',{onclick:()=>{closeSheets();act.phone('enterprise');}},'Manage your business'):h('button.btn.wide',{onclick:()=>{closeSheets();act.message(b.owner);}},`Message @${b.owner}`)),
  {title:b.name,sub:'A player-run business'});
}
const act = (window.__act = {
  toast, refresh: () => refresh(), nav(id) {
    closeAdPreview?.();
    closeSheets(); if(id!=='chat')chat?.close();hud.setNav(id);
    if(id==='phone')return phone.open?phone.close():phone.show();
    phone.close();
    if(id==='interact')return act.interact();
    if (id === 'chat') { hud.setNav(view === 'map' ? 'map' : 'home'); return chat.toggle(); }
    if (id === 'shop') { hud.setNav(view === 'map' ? 'map' : 'home'); return phone.show('shop'); }
    if (id === 'map') return setView('map');
    if (id === 'home') { if (view !== 'room') return setView('room'); if (G.state.place !== 'home') return act.place('home'); }
  },
  context(){if(ride.active||G.state.busy?.travel||view==='map')return null;return {spec:world?.spec,actions:actsFor(G.state.place)};},
  openZone(z){return openZone(z,G.state.place,act);},
  focusPerson(pid){world.focusTarget({person:'p'+pid});},
  zoneFocus(z){world.focusTarget({item:z.item});},clearFocus(){world.clearSelection();},
  sound(){cityAudio.controls();},
  interact(){if(ride.active||G.state.busy?.travel){hud.setNav('home');return toast('You can interact with places after you arrive.');}if(view==='map'){hud.setNav('map');return toast('Enter a place to interact with its surroundings.');}closeSheets();sheet(h('div.sheet-body',null,h('p.context-hint',null,'Tap an object in the world, or choose what is nearby.'),hud.zones,h('h3.panel-heading',null,'Players here'),world.others.size?h('div',null,...[...world.others.values()].map(p=>h('button.world-row',{onclick:()=>openPerson(p.id,p.n,act)},ic('user'),h('span',null,'@'+p.n),ic('caret-right')))):h('p.context-hint',null,'No other players in this room. City chat reaches everyone online.')),{title:'Around you',sub:G.placeName,onclose:()=>hud.setNav(view==='map'?'map':'home')});},
  status(){hud.openStatus();}, lifeEvent(){openLifeEvent();}, roomPeople(){return [...(world?.others?.values?.()||[])];}, meet(){closeSheets();phone.close();openMeet(act,{onObjective:d=>goObjective(d,act)});},
  map() { act.nav('map'); }, phone(app, arg) { closeAdPreview?.();phone.show(app, arg); }, app(id) { closeAdPreview?.();phone.show(id); }, closePhone() { phone.close(); },
  previewAd(slot,image){
    if(!map.ready)return toast('The city map is still loading. Try the preview again shortly.');
    closeAdPreview?.();phone.close();setView('map');map.ads.preview(slot.id,image);const b=map.ads.boards.find(b=>b.slot.id===slot.id);
    const limits=map.limits,min=stage.zoomMin;map.limits={...limits,min:.85};stage.zoomMin=.85;
    if(b)map.focus(b.root.position.x,b.root.position.z,.9);
    const back=h('button.btn.primary',{style:{position:'fixed',bottom:'100px',left:'16px',right:'16px',zIndex:50},onclick:()=>{closeAdPreview?.();window.open('/advertise.html?placement='+encodeURIComponent(slot.id),'_blank','noopener');}},'Preview only · book on the advertising page');ui.append(back);
    closeAdPreview=()=>{map.ads.clearPreview();map.limits=limits;stage.zoomMin=min;stage.view.zoom=Math.max(min,stage.view.zoom);stage.applyView();back.remove();closeAdPreview=null;};
  },
  adInventory(slots){applyBoards(slots);},
  recheckPayment(){resumePayment(phone,toast);},
  wallet() { phone.show('momo'); }, topup() { phone.show('momo', 'topup'); }, goals() { phone.show('goals'); }, me() { phone.show('life'); }, needs() { phone.show('health'); },
  work() { phone.show('jobs'); }, jobHere(cid) { const s = G.state; if (s.job && s.job.id === cid && !s.shift) { net.send({ t: 'work', op: 'start' }); } else phone.show('jobs'); },
  workStation(z){
    closeSheets();const task=G.state.shift?.assignment;if(!task||G.state.job?.id!==z.work)return toast('The next assignment opens as your shift progresses.');
    const status=h('p',{role:'status'});let waiting=false;
    const panel=sheet(h('div.sheet-body',null,h('p',null,task.situation),h('p',null,task.stage==='working'?`Working here until ${new Date(task.readyAt).toLocaleTimeString()}. Stay near this station.`:`Choose your approach, then work here for ${task.seconds} seconds. The server checks your attendance.`),
      ...task.choices.map((choice,index)=>h('button.btn.wide',{disabled:task.stage==='working',onclick:()=>{
        if(waiting)return;waiting=true;status.textContent='Walking to the work station…';
        const go=()=>{net.send({t:'work',op:'beginTask',id:task.id,choice:index});panel.close();};
        const [i,j]=world.room.nearestFree(task.station.x,task.station.z+.9),x=(i+.5)*.25-world.spec.w/2,zpos=(j+.5)*.25-world.spec.d/2;
        if(Math.hypot(x-task.station.x,zpos-task.station.z)>3){waiting=false;status.textContent='Approach the station from its clear side and try again.';return;}
        world.walkMe(x,zpos,go);net.send({t:'rmv',x,z:zpos,it:null,zn:null});
      }},choice)),status),{title:task.title,sub:z.label});
  },
  workAssignment(){phone.close();const z=world.spec?.zones.find(z=>z.work===G.state.job?.id);if(z)act.workStation(z);},
  // A one-off life action from the world (property door or in-unit activity); errors become toasts.
  lifeAction(op, fields) {
    const key = crypto.randomUUID();
    const off = net.on('life_result', (m) => { if (m.key !== key) return; off(); clearTimeout(timer); if (m.error) toast(m.error, 'bad'); });
    const timer = setTimeout(off, 20000);
    if (!net.send({ t: 'life_action', op, key, ...fields })) { off(); clearTimeout(timer); toast('Not connected. Try again shortly.', 'bad'); }
  },
  propertyTravel() { phone.close(); },
  route(zone) {
    if(G.state.busy||G.state.shift)return toast('Finish your current activity first.','bad');
    if(zone.route==='property-exit'){const go=()=>act.lifeAction('property_exit',{unit:zone.propertyUnit,mode:'walk'});const u=world.useZone(zone,go);if(u)net.send({t:'rmv',...u,zn:null});else go();return;}
    const district=/^[ne]:/.test(G.state.place)?G.state.place.slice(2):G.state.home;
    const go=()=>{if(zone.route==='map')return act.nav('map');if(zone.destination)return openPlace(zone.destination,act,{mode:'walk'});net.send({t:'street',to:zone.route==='estate'?'e:'+district:zone.route==='home'?'home':'n:'+district});};
    const u=world.useZone(zone,go);if(u)net.send({t:'rmv',...u,zn:null});else go();
  },
  place(id) { setView('map', id); },
  travel(to, mode, name) { net.send({ t: 'travel', to, mode }); act._rideTo = name; },
  cancel() { net.send({ t: 'cancel' }); },
  say(text, ch = 'city') { return net.send({ t: 'chat', text, ch }); },
  tutorial() { closeSheets(); phone.close(); showTutorial(ui, true); },
  gem() { if (G.gem) { if (G.state.place === G.gem.place) toast('It’s here somewhere! Look for the purple gem.', 'gold'); else setView('map', G.gem.place, true); } },
  sendMoney(name) { phone.show('momo', { send: name }); }, message(name) { phone.show('messages', { dm: name }); },
  oware(pid, name) { owareChallenge(pid, name, act); }, practice() { phone.close(); net.send({ t: 'oware_practice' }); },
  wardrobe(mode = 'wardrobe') { openStylist(mode); },
  setQuality(pref) { saveQuality(pref); if (!stage) return; stage.qualityPref = pref; stage.applyQuality(resolveTier(pref, {mobile: stage.mobile, low: lowEnd()})); },
  async logout() { try { const r=await fetch('/api/logout',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});if(!r.ok)throw Error();try{localStorage.removeItem('awd_token');}catch{}net.close();location.reload(); }catch{toast('Could not log out. Please try again.','bad');} },
  socialFx(pid) { const p = world.room && world.room.people.get('p' + pid); if (p) world.room.walkTo('me', p.x + 0.7, p.z + 0.4); },
  // start an activity in a zone: walk there, sit/stand, tell the server
  async start(a, zone) {
    if (a.opens) { if(a.opens==='matches')return openMatches(); if (OPENS[a.opens]) return phone.show(OPENS[a.opens], a.opens === 'momo' ? 'cash' : null); if (STYLE_OPENS[a.opens]) return openStylist(STYLE_OPENS[a.opens]); if (a.opens === 'circlephones') return openPhoneMarket(net, act); return toast('Coming soon to this place.', ''); }
    if(G.state.busy||G.state.shift)throw Error('Finish or stop your current activity first.');
    if (G.state.place?.startsWith('unit:')) { act._pending = { zone, at: Date.now() }; return act.lifeAction('property_home_act', { unit: G.state.place.slice(5), action: a.id }); }
    const msg = G.state.place === 'home' ? { t: 'act', home: true, id: a.id, zn: zone.id } : { t: 'act', loc: G.state.place, id: a.id, zn: zone.id };
    act._pending={zone,at:Date.now()};try{return await activityRequests.request(msg);}catch(error){act._pending=null;throw error;}
  },
});

// ---------------------------------------------------------------- views
function setView(v, focusPlace, forGem) {
  closeAdPreview?.();
  if(v==='map'&&ride.active)return toast('Your journey is in progress. The map reopens on arrival.');
  view = v; hud.setNav(v === 'map' ? 'map' : 'home');
  if (v === 'map' && stage.mode === 'follow') { stage.setMode('iso'); world.room?.enclose(false); }
  const inMap = v === 'map'; ui.classList.toggle('map-view', inMap); map.show(inMap); hud.chips.hidden = inMap; if (world.room) world.room.group.visible = !inMap; world.tagsEl.hidden = inMap; hud.zones.hidden = inMap;
  if (inMap) {
    const hh = accraClock().h; stage.setTime(hh); drawPins();
    const id = focusPlace || G.state.place; const L = id === 'home' && G.state.home ? G.cat.homes[G.state.home] : loc(id) || loc('circle'); const [x, z] = map.slotOf(id === 'home' ? 'h:' + G.state.home : id) || map.toMap(L.x, L.z); map.currentId = G.state.place === 'home' ? 'h:' + G.state.home : G.state.place; map.current = map.slotOf(map.currentId) || map.toMap(L.x, L.z); map.focus(x, z, map.mode==='compact'?map.normalZoom:focusPlace?5:9);
    if (focusPlace) setTimeout(() => openPlace(focusPlace, act), forGem ? 50 : 250);
  } else if (world.room && stage.mode === 'follow') { stage.bounds = [-world.spec.w / 2, world.spec.w / 2, -world.spec.d / 2, world.spec.d / 2]; world.prepareFollow(); }
  else if (world.room) { fitRoom(stage, world.spec);if(world.spec.neighbourhood&&world.me)stage.view.target.set(world.me.x,.8,world.me.z); stage.view.zoom = world.baseZoom; stage.applyView(); const r = Math.max(world.spec.w, world.spec.d) * 0.75 + 2; const sc = stage.key.shadow.camera; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.far = 80; sc.updateProjectionMatrix(); stage.bounds = [-world.spec.w / 2, world.spec.w / 2, -world.spec.d / 2, world.spec.d / 2]; stage.zoomMin = world.baseZoom * 0.45; stage.zoomMax = world.spec.neighbourhood?90:world.baseZoom * 1.35; }
}
function drawPins() {
  const s = G.state; const list = []; const f = map.filter;
  for (const l of G.cat.locs) {
    if(f==='homes'&&!l.estate||f==='streets'&&!l.neighbourhood)continue;if(!['homes','streets'].includes(f)&&(l.estate||l.neighbourhood)&&s.place!==l.id)continue;
    const open = isOpen(l); const n = G.places[l.id] || 0;
    if (f === 'open' && !open) continue; if (f === 'people' && !n) continue; if (['eat', 'gig'].includes(f) && !l.acts.some((a) => a.tags && a.tags.includes(f))) continue; if (f === 'fun' && !l.acts.some((a) => (a.tags || []).some((t) => ['party', 'nightlife', 'relax', 'sport', 'tour'].includes(t)))) continue;
    list.push({ id: l.id, ic: l.ic, name: l.name, x: l.x, z: l.z, count: n, cls: [open ? '' : 'closed', s.place === l.id ? 'here' : '', G.gem && G.gem.place === l.id ? 'gem' : ''].join(' '), keep: s.place === l.id || (G.gem && G.gem.place === l.id) });
  }
  if (s.home) { const H = G.cat.homes[s.home]; list.push({ id: 'home',homeId:s.home, ic: 'icon:house', name: 'Home', x: H.x, z: H.z, xz: map.slotOf('h:' + s.home), cls: 'home' + (s.place === 'home' ? ' here' : ''), keep: true }); }
  map.setPins(list, (id) => openPlace(id, act));
}

// Billboard inventory feeds both the city map and the street billboards around the player.
function applyBoards(slots) { G.billboards = slots; map.setBillboards(slots); if (world?.room) world.refreshBoards(); }
// ---------------------------------------------------------------- joystick: roam the place you're in (tap-to-walk still works)
function bindJoystick() {
  const knob = h('i'); const pad = h('div.joy', { 'aria-label': 'Walk' }, knob); ui.append(pad);
  let pid = null, ox = 0, oy = 0, vx = 0, vy = 0, timer = null, lastSend = 0;
  const clampXZ = (x, z) => {
    const sp=world.spec;
    if(sp.localNetwork){const [i,j]=world.room.nearestFree(x,z);return world.room.free(i,j)?[(i+.5)*.25-sp.w/2,(j+.5)*.25-sp.d/2]:[world.me.x,world.me.z];}
    return [Math.max(-sp.w/2+.3,Math.min(sp.w/2-.3,x)),Math.max(-sp.d/2+.3,Math.min(sp.d/2-.3,z))];
  };
  // The pad steers the body directly (scene/locomotion.js eases speed and turning, and slides
  // along obstacles); the server hears where we are heading a few times a second.
  const step = () => { const me = world.me; if(!world.room||!me||worldBlocked(ui))return; const m = Math.min(1, Math.hypot(vx, vy)); if (m < 0.15) { me.steer = { dx: 0, dz: 0, speed: 0 }; return; }
    const yaw = stage.view.yaw; const dx = Math.cos(yaw) * vx - Math.sin(yaw) * -vy, dz = -Math.sin(yaw) * vx - Math.cos(yaw) * -vy; const L = Math.hypot(dx, dz) || 1;
    const outdoor = !!(world.spec.outdoor || world.spec.neighbourhood), speed = joystickSpeed(m, outdoor);
    if (me.pose !== 'stand') world.standUp();
    me.path = []; me.onArrive = null; me.finalPose = null; me.anim = null; me.speed = speed; me.steer = { dx: dx / L, dz: dz / L, speed };
    const now = performance.now(); if (now - lastSend > 300) { lastSend = now; const [x, z] = clampXZ(me.x + (dx / L) * speed * 0.45, me.z + (dz / L) * speed * 0.45); net.send({ t: 'rmv', x, z, it: null, zn: null }); } };
  const move = (e) => { let dx = (e.clientX - ox) / 42, dy = (e.clientY - oy) / 42; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } vx = dx; vy = dy; knob.style.transform = `translate(${dx * 30}px, ${dy * 30}px)`; };
  pad.addEventListener('pointerdown', (e) => { e.stopPropagation();if(worldBlocked(ui))return; if (G.state.busy && !G.state.busy.travel) { net.send({ t: 'cancel' }); } pid = e.pointerId; try { pad.setPointerCapture(pid); } catch {} const r = pad.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; pad.classList.add('on'); move(e); step(); timer = setInterval(step, 50); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === pid) move(e); });
  const end = () => { if (pid == null) return; pid = null; clearInterval(timer); vx = vy = 0; knob.style.transform = ''; pad.classList.remove('on'); const me = world.me; if (me) { me.steer = null; me.speed = 1.45; const coast = Math.min(0.35, (me.vel || 0) * 0.12), [x, z] = clampXZ(me.x + Math.sin(me.yaw) * coast, me.z + Math.cos(me.yaw) * coast); world.walkMe(x, z); net.send({ t: 'rmv', x, z, it: null, zn: null }); } };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  return pad;
}
// ---------------------------------------------------------------- camera: overhead or third person (Stage 4)
let cameraPref = savedCameraMode(), cameraBtn = null;
function cameraContext() { return { spec: world?.spec, custody: world?.custody, studio: studio?.open, ride: ride?.active, view }; }
function applyCamera() {
  const want = cameraPref === 'follow' && followSupported(cameraContext()) ? 'follow' : 'iso';
  if (stage.mode !== want) { stage.setMode(want); world.room?.enclose(want === 'follow'); if (want === 'follow') world.prepareFollow(); else if (world.room) setView('room'); }
  if (cameraBtn) { const on = stage.mode === 'follow'; cameraBtn.setAttribute('aria-pressed', String(on)); cameraBtn.setAttribute('aria-label', on ? 'Camera: behind you. Switch to overhead view' : 'Camera: overhead. Switch to behind-you view'); cameraBtn.querySelector('i').className = 'ph-fill ' + (on ? 'ph-person-simple-walk' : 'ph-cube'); cameraBtn.hidden = view !== 'room' || ride.active || !world.room; }
}
function bindCamera() {
  cameraBtn = h('button.camera-toggle', { type: 'button', onclick: (e) => { e.stopPropagation(); cameraPref = stage.mode === 'follow' ? 'iso' : 'follow'; saveCameraMode(cameraPref); if (cameraPref === 'follow' && !followSupported(cameraContext())) toast('Behind-you view is not available here.'); applyCamera(); } }, h('i', { class: 'ph-fill ph-cube' }));
  cameraBtn.addEventListener('pointerdown', (e) => e.stopPropagation()); ui.append(cameraBtn); applyCamera();
}
// ---------------------------------------------------------------- input: tap / drag / pinch
function bindInput() {
  const cv = stage.renderer.domElement; const pts = new Map(); let moved = 0, pinch0 = 0, t0 = 0;
  cv.addEventListener('pointerdown', (e) => {if(worldBlocked(ui))return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; t0 = performance.now(); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } });
  cv.addEventListener('pointermove', (e) => { if(worldBlocked(ui)){pts.clear();return;}const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (view === 'map') map.transition = null;
    if (pts.size === 1) { moved += Math.abs(dx) + Math.abs(dy); if (studio.open) studio.turn(dx); else if (ride.active) ride.drag(dx); else if (moved > 8) stage.pan(dx, dy); }
    else if (pts.size === 2) { p.x = e.clientX; p.y = e.clientY; const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) stage.zoomBy(pinch0 / d); pinch0 = d; moved = 99; return; }
    p.x = e.clientX; p.y = e.clientY; });
  const up = (e) => { const was = pts.has(e.pointerId); pts.delete(e.pointerId); if (!was || moved > 8 || pts.size) return; if (performance.now() - t0 > 600) return; tap(e.clientX, e.clientY); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', (e) => pts.delete(e.pointerId));
  cv.addEventListener('wheel', (e) => { e.preventDefault();if(worldBlocked(ui))return; if(view==='map')map.transition=null; stage.zoomBy(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
}
// Tapping a thing you can use: free one-action things start at once (TV, guitar, a stroll); anything that
// costs money, needs a choice or carries a risk opens its sheet (costs shown first) while you walk over.
function useDirect(z) {
  if (z.route || z.work) return openZone(z, G.state.place, act);
  const place = G.state.place, list = zoneActions(z, actsFor(place)), l = place === 'home' ? null : loc(place);
  const one = list.length === 1 ? list[0] : null;
  if (one && !one.cost && !one.crime && !one.mg && !actBlock(one, l) && !(G.state.busy || G.state.shift)) {
    act.start(one, z).catch((e) => toast(e.message || 'That is not available right now.', 'bad'));
    return;
  }
  if (!(G.state.busy && !G.state.busy.travel) && Number.isInteger(z.item)) { const u = world.approachItem(z.item); if (u) net.send({ t: 'rmv', x: u.x, z: u.z, it: null, zn: null }); }
  return openZone(z, place, act);
}
function tap(x, y) {
  if(studio.open||ride.active||worldBlocked(ui))return;
  if (view === 'map') { const b = map.pickBoard(x, y); if (b) return adSheet(b); const id=map.pickDestination(x,y);if(id)map.select(loc(id));return; }
  const hit = world.pick(x, y); if (!hit) return;
  if (hit.type === 'gem') { if (G.gem) net.send({ t: 'gem', id: G.gem.id }); return; }
  if (hit.type === 'person') return openPerson(hit.pid, hit.name, act);
  if (hit.type === 'npc') { const z = world.zoneForNpc(hit.id); if (z) return openZone(z, G.state.place, act); world.focusTarget({person:hit.id});return sheet(h('div.sheet-body',null,h('p.context-hint',null,'A local resident — a scripted character, not a real player. City chat and Meet connect you with real players online.'),h('button.btn.primary.wide',{onclick:()=>{closeSheets();act.nav('chat');}},'Open city chat')),{title:hit.name,onclose:()=>world.clearSelection()}); }
  if (hit.type === 'item') {
    world.focusTarget({item:hit.index});const rec = hit.item;
    // Seats, beds and mats: tapping one sits (or lies) there straight away; tap the ground to get up.
    if (!rec.spec.frontage && !rec.spec.owner && rec.use.some((u) => u.pose && u.pose !== 'stand')) {
      if (G.state.busy && !G.state.busy.travel) { world.clearSelection(); return toast('Finish your current activity first.'); }
      const u = world.useZone({ item: hit.index }, () => world.clearSelection()); if (u) net.send({ t: 'rmv', ...u, zn: null }); return;
    }
    // Anything else in the room: walk up to it (and still say what it is).
    if (!rec.spec.frontage && !rec.spec.owner) { const u = world.approachItem(hit.index); if (u) net.send({ t: 'rmv', x: u.x, z: u.z, it: null, zn: null }); }if(rec.spec.frontage)return openFrontage(rec.spec.frontage);if(rec.spec.owner){const owner=rec.spec.owner;return sheet(h('div.sheet-body',null,h('p',null,`A purchased home belonging to @${owner.name}.`),!owner.mine?h('button.btn.primary.wide',{onclick:()=>{closeSheets();act.message(owner.name);}},'Message owner'):null,owner.mine?h('button.btn.wide',{onclick:()=>{closeSheets();net.send({t:'buy',kind:'home',id:owner.home});}},'Move into this home'):h('button.btn.wide',{onclick:()=>{net.send({t:'visit',name:owner.name,mode:'walk'});closeSheets();}},'Visit acquaintance at home')),{title:'@'+owner.name,sub:G.cat.homes[owner.home].area,onclose:()=>world.clearSelection()});} const usable = rec.use.some((u) => u.pose && u.pose !== 'stand');
    return sheet(h('div.sheet-body', null, h('p.muted', null, usable ? 'Take a seat or rest here. Tap the ground to get up.' : 'Part of this place. Choose an activity below to use nearby facilities.'), usable ? h('button.btn.primary.wide', { onclick: () => { if (G.state.busy) return toast('Finish your current activity first.'); const u = world.useZone({ item: hit.index }); if (u) net.send({ t: 'rmv', ...u, zn: null }); closeSheets(); } }, 'Use ' + (rec.label || 'seat')) : null), { title: rec.label || rec.spec.kind.replace(/_/g, ' '),onclose:()=>world.clearSelection() });
  }
  if (hit.type === 'zone') return useDirect(hit.zone);
  if (hit.type === 'floor') {
    if (G.state.busy && !G.state.busy.travel) return toast('Stop what you’re doing first.', '');
    let {x,z}=hit;
    // A tap on a roof, yard or verge walks to the nearest reachable point of the street (up to 12 m away).
    if(world.spec.localNetwork){const [i,j]=world.room.nearestFree(x,z,48);if(!world.room.free(i,j))return toast('You cannot walk there.');x=(i+.5)*.25-world.spec.w/2;z=(j+.5)*.25-world.spec.d/2;}
    // Far taps outdoors break into a jog; the ring shows where the player is heading.
    const me=world.me,far=me&&Math.hypot(x-me.x,z-me.z)>7&&(world.spec.outdoor||world.spec.neighbourhood);
    world.walkMe(x,z);if(me)me.speed=far?3.0:1.45;world.markTarget(x,z);net.send({t:'rmv',x,z,it:null,zn:null});
  }
}

function adSheet(b) {
  if(b.ad)fetch('/api/ads/exposure',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({campaign:b.ad.id,placement:b.slot.id,kind:'click'})}).catch(()=>{});
  const ad = b.ad; sheet(h('div.sheet-body', null, ad ? h('div', null, h('img', { src: ad.img, style: { width: '100%', borderRadius: '16px', display: 'block', marginBottom: '12px' } }), ad.url ? h('a.btn.primary.wide', { href: ad.url, target: '_blank', rel: 'noopener nofollow' }, 'Visit sponsor') : null)
    : h('div', null, h('p', null, `${b.slot.onAir}/${b.slot.cap} campaigns active. From GH₵${b.slot.price} per week. ${b.slot.exclusive?'Exclusive advertising rental.':'Shared rotation every 15 seconds.'}`), h('a.btn.gold.wide', { href:'/advertise.html?placement='+encodeURIComponent(b.slot.id), target:'_blank', rel:'noopener' }, 'Advertise here'))), { title: b.slot.name, sub: b.slot.type==='ground'?'Ground advertising rental':`${b.slot.tier} billboard` });
}
// fitting room in the game: your wardrobe (what you own) or the boutique (try on and buy)
function openStylist(mode) {
  if (studio.open) return; closeSheets(); phone.close();
  const hide = [hud.top, hud.chips, hud.bottom, world.tagsEl, hud.chatlog]; hide.forEach((e) => (e.hidden = true));
  studio.show(G.state.look, 0.245, 5.0);
  const top = h('div.sty-top', null, h('div.sty-title', null, mode === 'boutique' ? 'Boutique' : 'Wardrobe'), h('button.money', { onclick: () => phone.show('momo') }, h('span.tnum', null, cedi(money(), true))));
  const turn = h('div.sty-turn', null, ' Drag to turn');
  ui.append(top, turn);
  const close = () => { s.el.remove(); top.remove(); turn.remove(); offSt(); studio.hide(); hide.forEach((e) => (e.hidden = false)); if (view === 'room') setView('room'); };
  const s = stylist(ui, { mode, look: G.state.look, onPreview: (l) => studio.preview(l), onClose: close,
    onSave: (l) => { if (!net.send({ t: 'look', look: l })) return; toast(mode === 'boutique' ? 'Looking fresh! ' : 'Changed. Looking good.', 'good'); close(); },
    onBuy: async (ids, total) => { if (money() < total) return toast(`You need ${cedi(total)}.`, 'bad'); const ok = await confirmBox({ title: `Buy ${ids.length} item${ids.length > 1 ? 's' : ''}?`, text: ids.map((i) => G.cat.wear[i].name).join(', ') + ` · ${cedi(total)}`, yes: 'Buy' }); if (!ok) return; for (const id of ids) net.send({ t: 'buy', kind: 'wear', id }); } });
  const offSt = net.on('bought', (m) => { if (m.wear) { if (m.state) G.state = m.state; s.redraw(); top.querySelector('.tnum').textContent = cedi(money(), true); } });
}
// ---------------------------------------------------------------- server messages
function bindNet() {
  let lifeSync;net.on('life_notice',m=>{phone.notify({app:'relationships',title:m.from?'@'+m.from:'Life update',body:m.message||'An invitation is waiting in People.'});clearTimeout(lifeSync);lifeSync=setTimeout(()=>net.send({t:'life_status',section:'relationships'}),1800);});
  const merge = (st) => { G.state = st; refresh(); };
  net.on('st', (m) => merge(m.state));
  net.on('me', (m) => { const s = G.state; for (const k of ['n', 'cash', 'momo', 'mood', 'busy', 'shift', 'job', 'sick', 'food', 'home', 'rep', 'xp', 'moodlets', 'dumsor', 'jail', 'place']) if (k in m) s[k] = m[k]; refresh(); });
  net.on('autowork_done', (m) => { toast(`Auto-work paid ${cedi(m.paid)} after transport.`, 'gold'); });
  net.on('course_result', (m) => { if (m.state) { G.state = m.state; refresh(); } toast(m.passed ? 'Course passed. Certificate saved.' : 'Not passed yet. Retry after 10 minutes.', m.passed ? 'gold' : 'bad'); });
  net.on('toast', (m) => { toast(m.m, m.k); if (m.k === 'bad' && act._pending && Date.now() - act._pending.at < 4000) { act._pending = null; } });
  net.on('reconnected', (w) => { G.myId = w.id; G.shard = w.shard; G.state = w.state; G.offset=net.offset;refresh();if(G.state.busy?.travel&&!ride.active)net.emit('busy',{busy:G.state.busy}); });
  net.on('close', (e) => { if (e.code === 4000) { toast('You logged in somewhere else.', 'bad'); } });
  // rooms
  net.on('room', (m) => {
    if (rideEnd) { rideEnd(); rideEnd = null; } hud.top.hidden = false; hud.chips.hidden = false;
    closeSheets();world.clearSelection();
    G.room = m.key; G.place = m.place; G.placeName = m.name; G.unitRoom = m.home?.property ? m.home : null; confirmRoomArrival(G.state,m);
    world.enter(m, fitLook(G.state.look, myFit()), G.state.name); if (world.me) { world.me.av.baseLook = G.state.look; world.me.av.fit = myFit(); } renderZones(hud.zones, world.spec, m.place, act); if (G.state.busy && !G.state.busy.travel) world.setAction('me', G.state.busy.id, G.state.busy.ic); if (world.entry) net.send({ t: 'rmv', x: world.entry.x, z: world.entry.z, it: null, zn: null });
    if (m.gem && G.gem) world.showGem(m.gem);
    setView('room'); refresh();
    if(m.place==='viewing'||m.place.startsWith('n:'))net.send({t:'matches'});
    if(m.place.startsWith('e:'))net.send({t:'estate_list',area:m.place.slice(2),page:0});
    const l = loc(m.place); if (l && !isOpen(l)) toast(`${l.name} is closed right now. Come back during opening hours.`, 'bad');
  });
  setInterval(()=>{if(G.state?.place?.startsWith('e:'))net.send({t:'estate_list',area:G.state.place.slice(2),page:world.estate?.page||0});},30000);
  let estatePanel=null;net.on('estate_list',m=>{if(world.place!=='e:'+m.area)return;world.loadEstate(m);renderZones(hud.zones,world.spec,world.place,act);if(estatePanel)estatePanel.remove();estatePanel=h('div.estate-panel',null,h('span',null,`${G.cat.homes[m.area].area} · ${m.total} purchased homes`),m.total===0?h('span.muted',null,'Homes appear here when players buy in this area.'):null,...(m.total>12?[h('button.btn.sm',{disabled:m.page===0,onclick:()=>net.send({t:'estate_list',area:m.area,page:m.page-1})},'Previous'),h('span',null,`${m.page+1}/${Math.ceil(m.total/12)}`),h('button.btn.sm',{disabled:(m.page+1)*12>=m.total,onclick:()=>net.send({t:'estate_list',area:m.area,page:m.page+1})},'Next')]:[]));hud.zones.append(estatePanel);});
  net.on('matches',m=>{if(world?.room&&(world.place==='viewing'||world.place.startsWith('n:'))){const fixture=m.matches.find(f=>f.status==='live')||m.matches[0];for(const screen of world.room.screens)if(screen.kind==='match')screen.setFixture(fixture);}if(m.state){G.state=m.state;refresh();}});
  net.on('rjoin', (m) => world.addOther(m.e)); net.on('rleave', (m) => world.removeOther(m.id)); net.on('rmv', (m) => world.moveOther(m));
  net.on('rpos',m=>{if(world.place===m.place&&world.me&&Number.isFinite(m.x)&&Number.isFinite(m.z))world.room.placeAt('me',m.x,m.z,world.me.yaw,'stand');});
  net.on('rlook', (m) => world.restyle(m.id, m.lk));
  net.on('rst', (m) => { world.setStatus('p' + m.id, m.st);world.setAction('p' + m.id, m.act, m.st); { const p = world.room && world.room.people.get('p' + m.id); if (p && (p.av.fit || null) !== (m.fit || null)) world.restyle(m.id, null, m.fit || null); } if (!m.st) { const p = world.room && world.room.people.get('p' + m.id); if (p && p.pose !== 'stand') world.room.placeAt('p' + m.id, p.x, p.z, p.yaw, 'stand'); } });
  net.on('ranim', (m) => world.animOther(m.id, m.a));
  net.on('chat', (m) => { if (m.ch === 'room') { world.bubble(m.id === G.myId ? 'me' : 'p' + m.id, m.m); hud.chatLine(m.n, m.m); } else hud.chatLine('icon:globe-hemisphere-west ' + m.n, m.m); });
  net.on('rsocial', (m) => { for (const id of [m.a, m.b]) { const who = id === G.myId ? 'me' : 'p' + id; world.bubble(who, m.ic, 'social'); const p = world.room && world.room.people.get(who); if (p) world.gesture(p, m.anim); } });
  net.on('social_done', (m) => toast(`${m.label} with ${m.with} · ${m.level} (${m.pts})`, 'good'));
  net.on('social_in', (m) => toast(`${m.ic} ${m.from}: ${m.label.toLowerCase()} · ${m.level}`, ''));
  net.on('askout_in', async (m) => { const yes = await confirmBox(m.propose ? { title: ` ${m.from} is proposing!`, text: 'Will you get engaged? Accra will hear about it.', yes: 'YES ', no: 'Not yet' } : { title: ` ${m.from} is asking you out`, text: 'Say yes and you become a couple in Accra We Dey. You can always say no.', yes: 'Yes ', no: 'Not now' }); net.send({ t: 'askout_reply', id: m.id, yes }); });
  // activities
  net.on('busy', (m) => {
    G.state.busy = m.busy; refresh();
    if (m.busy.travel) { closeSheets(); const t = m.busy.travel; setView('room'); if (world.room) world.room.group.visible = false; hud.zones.hidden = true; world.tagsEl.hidden = true; hud.top.hidden = false; hud.chips.hidden = true;
      if (rideEnd) { rideEnd(); rideEnd = null; } rideEnd = rideScreen(ui, { mode: t.mode, to: act._rideTo || m.busy.label.replace(/^.* to /, ''), from: G.placeName, start: m.busy.start, end: m.busy.end, rush: t.rush, ride, look: G.state.look, car: G.state.car || (G.state.rental?.until>accraNow()?G.state.rental.car:null), paint: G.state.car ? G.state.carStyle?.paint : null }); G.placeName = 'On the road'; hud.clock(); return; }
    if(m.cost)world.floater(`−${cedi(m.cost)}`,true);
    toast(m.busy.label||'Activity started');world.setAction('me',m.busy.id,m.busy.ic);
    const z = act._pending && act._pending.zone; act._pending = null;
    if (z && world.room) { const u = world.useZone(z); if (u) net.send({ t: 'rmv', x: u.x, z: u.z, it: u.it, u: u.u, zn: z.id }); }
  });
  net.on('mg', (m) => { const z = act._pending && act._pending.zone; act._pending = null; if (z) world.useZone(z); setTimeout(() => playMinigame(ui, m.id, (stars) => net.send({ t: 'mgResult', stars })), 600); });
  net.on('cancelled', () => { G.state.busy = null;world.setAction('me',null); const p = world.standUp(); if (p) net.send({ t: 'rmv', x: p.x, z: p.z, it: null, zn: null }); refresh(); });
  net.on('done', (m) => {
    G.state.busy = null;world.setAction('me',null);toast(m.earned?`Activity complete · +${cedi(m.earned)}`:'Activity complete','good'); const fx = Object.entries(m.gains || {}).filter(([, v]) => v).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${({ hunger: '', energy: '', fun: '', social: '', hygiene: '', bladder: '' })[k] || k}`);
    if (m.earned) world.floater(`+${cedi(m.earned)}`); if (fx.length) setTimeout(() => world.floater(fx.slice(0, 3).join('  ')), m.earned ? 700 : 0);
    if (m.levelUp) celebrate({ icon: 'icon:chart-line-up', title: `${G.cat.skills[m.levelUp[0]]} level ${m.levelUp[1]}!`, text: 'You’re getting better. New gigs and promotions unlock with skill.', tone: 'gold' });
    if (m.crime === 'caught') net.send({t:'state'});
    if (m.crime === 'caught') celebrate({ icon: 'icon:circle', title: 'Caught!', text: `Police fine ${cedi(m.fine)} and ${m.jail} minutes in the cells. Crime doesn’t pay (most of the time).`, cta: 'Ugh', tone: 'red' });
    if (m.tired) toast('Customers are tired of you today. This hustle pays less now — try something else.', '');
    if (m.mvp != null) toast(`MVP ${m.mvp}% built`, 'good'); if (m.pitch === 'no') toast('Investors passed. Improve your skills and pitch again next week.', 'bad'); if (m.juju) toast(`Strange misfortune… you lost ${cedi(m.juju)}.`, 'bad');
    if (m.cured) toast('You feel much better. ', 'good');
    if (m.place === 'police') return; const p = world.standUp(); if (p) net.send({ t: 'rmv', x: p.x, z: p.z, it: null, zn: null }); refresh();
  });
  net.on('shift', (m) => { G.state.shift = m.shift; toast(`Shift started · ${m.title} · ${cedi(m.pay)}. Finish three short assignments here to get paid.`, 'good'); refresh(); });
  net.on('worktask',m=>{G.state.shift=m.shift;toast('Assignment started. Stay at this station.','good');refresh();});
  net.on('shiftDone', (m) => { G.state.shift = null; if (m.promoted) celebrate({ icon: 'icon:confetti', title: `Promoted: ${m.promoted}!`, text: `New pay ${cedi(m.newPay)} per shift.` }); else toast(`Shift done · +${cedi(m.pay)}${m.stars ? '  great work bonus' : ''}${m.grade ? ` · grade ${m.grade}` : ''}`, 'good'); if (m.needs) toast(m.needs, ''); refresh(); });
  net.on('hired', (m) => { celebrate({ icon: 'icon:briefcase', title: 'You’re hired!', text: `${m.title} · ${cedi(m.pay)} per shift. A shift is three short assignments (about 3 minutes), once a day.` }); });
  net.on('bought', (m) => { toast(`Bought: ${m.what}`, 'good'); if (G.state.place === 'home') setTimeout(() => net.send({ t: 'state' }), 200); });
  net.on('moved', (m) => {if(m.state)merge(m.state); toast('New home!  Your things are moving in.', 'good'); });
  net.on('open', (m) => act.start({ opens: m.what }, null));
  net.on('income', (m) => { toast(` Business profit today: +${cedi(m.amt)}`, 'good'); for (const n of m.notes || []) toast(n, ''); });
  net.on('dream', (m) => celebrate({ icon: m.done ? 'icon:circle' : 'icon:star', title: m.done ? 'Dream achieved!' : 'Milestone unlocked', text: `${m.label} · +${cedi(m.cash)} · +${m.rep} rep` }));
  net.on('streak', (m) => celebrate({ icon: 'icon:fire', title: `${m.streak}-day streak!`, text: m.bonus ? `Bonus +${cedi(m.bonus)}. Keep it going tomorrow.` : 'All daily missions done. Keep the streak alive tomorrow.' }));
  net.on('missions', (m) => { G.state.daily = { ...(G.state.daily || {}), list: m.list, streak: m.streak }; refresh(); });
  net.on('game_notice',m=>{if(phone.open&&phone.win?.app.id==='games')return;phone.notify({app:'games',title:'Game update from @'+m.from,body:'Open Games to see the invitation or latest move.'});});
  // phone traffic
  net.on('msg', (m) => { G.state.story.inbox.push(m.m); const c = G.cat.contacts[m.m.from] || { name: m.m.from }; phone.notify({ app: 'messages', title: c.name, body: m.m.text, icon: c.ic, arg: { story: m.m.from } }); refresh(); });
  net.on('msgdone', (m) => { G.state = m.state; if (m.goal) toast(` New goal: ${m.goal}`, 'gold'); refresh(); });
  net.on('money_in', (m) => { G.state.momo = m.momo; phone.notify({ app: 'momo', title: m.kind === 'topup' ? 'Top-up received' : `You received ${cedi(m.amount)}`, body: m.kind === 'topup' ? `${cedi(m.amount)} added to your wallet.` : `From @${m.from}${m.note ? ` · “${m.note}”` : ''}. New balance ${cedi(m.momo)}.` }); world.floater(`+${cedi(m.amount)}`); vibrate([20, 40, 20]); refresh(); });
  net.on('dm_in', (m) => { G.unreadDm = (G.unreadDm || 0) + 1; phone.notify({ app: 'messages', title: '@' + m.from, body: m.m.kind === 'req' ? ` Requested ${cedi(m.m.amount)} · ${m.m.text}` : m.m.text, arg: { dm: m.from } }); refresh(); });
  net.on('dm_unread', (m) => { G.unreadDm = m.n; refresh(); }); net.on('dm_thread', () => { G.unreadDm = 0; refresh(); });
  net.on('intro_offer',m=>{phone.notify({app:'meet',title:`@${m.from} wants to say hello`,body:'Accept or decline in Meet. Nothing is shared until you accept.'});toast(`@${m.from} wants to say hello. Open Meet to accept or decline.`);});
  net.on('intro_update',m=>{toast(m.status==='accepted'?`@${m.from} accepted your hello. Your conversation is open in Messages.`:'The player declined. You can say hello to someone else later.',m.status==='accepted'?'good':'');if(m.status==='accepted'&&!document.querySelector('.meet-body'))act.message(m.from);});
  net.on('intro_complete',()=>{toast('Your first conversation is complete.','good');});
  // Stage 10: a campaign activated after verified payment appears without a reload.
  let adsRefresh;net.on('ads_changed',()=>{clearTimeout(adsRefresh);adsRefresh=setTimeout(()=>fetch('/api/billboards').then(r=>r.json()).then(j=>applyBoards(j.slots||[])).catch(()=>{}),1000);});
  // Stage 9: real player businesses shown at their venue.
  net.on('frontage',m=>world?.setFrontage?.(m));
  // Stage 8: personal life events are offered and resolved by the server.
  net.on('life_event',m=>{if(m.event&&G.state){G.state.lifeEvents={...(G.state.lifeEvents||{}),active:m.event};}refresh();if(!ride.active&&!phone.open)setTimeout(openLifeEvent,400);else toast(`${m.event?.title||'Something happened'} — tap the reminder at the top.`);});
  net.on('life_event_result',m=>{if(m.state)G.state=m.state;refresh();showLifeResult(m);});
  // Stage 7: home invitations and community events.
  net.on('home_invite_in',m=>{phone.notify({app:'contacts',title:`@${m.from} invited you over`,body:'The invitation lasts 30 minutes.'});confirmBox({title:`@${m.from} invited you over`,text:'Visit their home now? You can leave any time. The invitation lasts 30 minutes.',yes:'Go now',no:'Not now'}).then(ok=>net.send({t:'home_invite_answer',from:m.from,yes:ok,mode:G.state.car?'car':'trotro'}));});
  net.on('event_live',m=>{toast(`${m.title} is happening now at ${m.venueName}.`,'good');phone.notify({app:'events',title:'Event starting',body:`${m.title} · ${m.venueName}`});});
  net.on('event_invite',m=>{phone.notify({app:'events',title:`@${m.from} invited you`,body:m.title});});
  net.on('event_cancelled',m=>{toast(`${m.title} was cancelled${m.reason?': '+m.reason:''}.`);});
  net.on('st',m=>{if(m.profileSaved)toast('Profile saved.','good');});
  net.on('intro',m=>{if(G.introPaused!==m.optedOut){G.introPaused=m.optedOut;setTimeout(()=>net.send({t:'objective_status'}),2000);}});
  // A refresh that lands while the account is saving is retried a few times, so HUD progress never sticks.
  let objectiveRetries=0;
  net.on('objectives',m=>{objectiveRetries=0;G.objectives=m.rows;if(m.state)G.state=m.state;hud.objective(m.rows);refresh();});
  net.on('objective_error',m=>{if(/saving|wait a moment|in progress/i.test(m.error||'')&&objectiveRetries<4){objectiveRetries++;setTimeout(()=>net.send({t:'objective_status'}),2500*objectiveRetries);}});
  let objectiveTimer;
  for(const event of ['arrived','done','shiftDone','bought','dm_sent','intro_complete','life_result','life_notice'])net.on(event,m=>{if(m.error)return;clearTimeout(objectiveTimer);objectiveTimer=setTimeout(()=>net.send({t:'objective_status'}),2000);});
  // Oware
  net.on('oware', (m) => { phone.close(); closeSheets(); owareView(ui, m); });
  net.on('oware_invite', async (m) => { const yes = await confirmBox({ title: ` ${m.from} challenges you to Oware`, text: m.stake ? `Stake ${cedi(m.stake)} each · winner takes ${cedi(Math.round(m.stake * 2 * 0.95))}.` : 'Friendly game, no money.', yes: 'Play', no: 'Not now' }); net.send({ t: 'oware_answer', id: m.id, yes }); });
  // world
  net.on('places', (m) => { G.places = m.c; G.online = m.online; if (view === 'map') map.setPresence(m.c); hud.clock(); });
  net.on('gem_drop', (m) => { G.gem = { ...m.gem, area: m.area }; if (!m.quiet) toast(m.hint, 'gold'); if (G.state.place === m.gem.place) world.showGem(m.gem); refresh(); if (view === 'map') drawPins(); });
  net.on('gem_gone', (m) => { G.gem = null; world.hideGem(); if (m.by) toast(` ${m.by} found the gem at ${m.place} (+${cedi(m.prize)})`, ''); refresh(); if (view === 'map') drawPins(); });
  net.on('gem_won', (m) => { G.gem = null; world.hideGem(); G.state.momo = m.momo; celebrate({ icon: 'icon:diamond', title: `You found the gem!`, text: `+${cedi(m.prize)} to your MoMo. ${m.found.toLocaleString()} gem${m.found === 1 ? "" : "s"} found in Accra so far.` }); refresh(); });
}
function bounded(promise,ms){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Preview took too long to load.')),ms);})]).finally(()=>clearTimeout(timer));}
function showStartError(message){
  hideLoad();const card=h('section.screen.auth',null,h('div.card',null,h('h1',null,'Let’s reconnect.'),h('p',null,message),h('button.btn.primary.wide',{onclick:()=>location.reload()},'Try again')));ui.append(card);
}
boot().catch(error=>{console.error(error);showStartError('Could not load your life. Check your connection, then try again.');});
