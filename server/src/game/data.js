import { EXTRA_LOCATIONS, neighbourhoodLocations } from './city-content.js';
import { NEIGHBOURHOOD_ACTIVITIES } from './discovery.js';
// ============================================================================================
// ACCRA WE DEY · game content. Prices in GH₵ calibrated to 2025–26 Accra (see ll/ACCRA_RESEARCH.md).
// Time is the real Accra clock (GMT). Action `min` = in-game minutes; real duration is compressed.
// Needs deltas are PER IN-GAME HOUR of the action (Sims-style), `inst` applied once on completion.
// Locations carry real lat/lon; tools/resolve-places.py converts them to world metres.
// ============================================================================================
export const NEEDS = { hunger: { label: 'Hunger', ic: 'icon:bowl-food', decay: 5.5 }, energy: { label: 'Energy', ic: 'icon:lightning', decay: 4 }, fun: { label: 'Fun', ic: 'icon:confetti', decay: 4.5 }, social: { label: 'Social', ic: 'icon:chat-circle-dots', decay: 3 }, hygiene: { label: 'Hygiene', ic: 'icon:shower', decay: 3.5 }, bladder: { label: 'Bladder', ic: 'icon:toilet', decay: 7 } };
export const SKILLS = { hustle: 'Hustle', charisma: 'Charisma', coding: 'Coding', cooking: 'Cooking', fitness: 'Fitness', dance: 'Dance', music: 'Music', comedy: 'Comedy', driving: 'Driving', photo: 'Photography' };

export const TRAITS = {
  hustler: { name: 'Hustler', ic: 'icon:briefcase', desc: 'Sees money everywhere. Hustle grows 50% faster, +20% work performance.', skill: { hustle: 1.5 }, work: 0.2 },
  chopmaster: { name: 'Chop Master', ic: 'icon:bowl-food', desc: 'Lives for waakye. Cooking grows fast; eating is extra fun.', skill: { cooking: 1.6 }, tagFun: { eat: 12, cook: 8 } },
  detty: { name: 'Detty Spirit', ic: 'icon:confetti', desc: 'Born for Detty December. Parties hit harder, but boredom comes quicker.', decay: { fun: 1.3 }, tagFun: { dance: 10, party: 15 } },
  gymrat: { name: 'Muscle Beach Regular', ic: 'icon:barbell', desc: 'Leg day every day. Fitness grows fast and workouts feel good.', skill: { fitness: 1.6 }, tagFun: { workout: 12 } },
  sweetmouth: { name: 'Sweet Mouth', ic: 'icon:smiley', desc: 'Talks anybody into anything. Charisma fast; socials land better.', skill: { charisma: 1.5 }, social: 0.15 },
  lazy: { name: 'Lazy Bone', ic: 'icon:bed', desc: 'Why stand when you can sit? Energy lasts longer; work suffers a bit.', decay: { energy: 0.7 }, work: -0.15, tagFun: { tv: 10, relax: 8 } },
  neat: { name: 'Key Soap Clean', ic: 'icon:shower', desc: 'Smells fresh in Circle traffic. Hygiene drains 35% slower.', decay: { hygiene: 0.65 } },
  nightcrawler: { name: 'Night Crawler', ic: 'icon:moon', desc: 'Osu after dark is home. Energy lasts longer at night; nightlife is extra fun.', decay: { energy: 0.85 }, tagFun: { nightlife: 14 } },
  techguru: { name: 'Tech Guru', ic: 'icon:laptop', desc: 'Born holding a charger. Coding grows 60% faster.', skill: { coding: 1.6 } },
  highlife: { name: 'Highlife Soul', ic: 'icon:music-notes', desc: 'Hums everywhere. Music grows fast; music is extra fun.', skill: { music: 1.6 }, tagFun: { music: 8 } },
};
export const DREAMS = {
  bigman: { name: 'Big Man of Accra', ic: 'icon:circle', desc: 'Reach the top level of any career.' },
  landlord: { name: 'East Legon Landlord', ic: 'icon:house', desc: 'Reach a net worth of GH₵1,000,000.' },
  star: { name: 'Afrobeats Star', ic: 'icon:microphone', desc: 'Max out Music (level 10).' },
  chale: { name: "Everybody's Chale", ic: 'icon:handshake', desc: 'Have 4 best friends.' },
  unicorn: { name: 'Osu Unicorn', ic: 'icon:circle', desc: 'Get your startup funded at the tech hub.' },
};
// Birth lottery (decided once per account, server-side)
export const ORIGINS = {
  hustler: { name: 'Hustler', ic: 'icon:briefcase', perks: ['GH₵800 starting savings', 'Choose a room in Nima or Jamestown', 'Every career, business and aspiration is open'], cash: 200, momo: 600, homes: ['nima','jtown'], learn: 1 },
  dbee: { name: 'Dbee', ic: 'icon:diamond', perks: ['GH₵25,000 family savings', 'Choose a home in Osu, Airport Residential or East Legon', 'Every career, business and aspiration is open'], cash: 1000, momo: 24000, homes: ['osu','airres','legon'], learn: 1 },
};
// ---------- homes (rent weekly, due Saturday 09:00; landlords want advance) ----------
export const HOMES = {
  nima: { name: 'Single room · Nima', area: 'Nima', ll: [5.5815, -0.1990], rent: 110, advance: 8, comfort: 0.85, toilet: 'shared', power: 'grid', theft: 0.05, grid: 6, start: true },
  jtown: { name: 'Fisher room · Jamestown', area: 'Jamestown', ll: [5.5330, -0.2100], rent: 120, advance: 8, comfort: 0.85, toilet: 'shared', power: 'grid', theft: 0.04, grid: 6, start: true },
  kaneshie: { name: 'Chamber & hall · Kaneshie', area: 'Kaneshie', ll: [5.5690, -0.2350], rent: 260, advance: 12, comfort: 0.92, toilet: 'shared', power: 'grid', theft: 0.03, grid: 7 },
  labadi: { name: 'Self-contain · La', area: 'Labadi', ll: [5.5600, -0.1560], rent: 450, advance: 12, comfort: 0.95, toilet: 'own', power: 'grid', theft: 0.02, grid: 7 },
  osu: { buy: 1600000, name: '1-bed apartment · Osu', area: 'Osu', ll: [5.5570, -0.1820], rent: 1600, advance: 24, comfort: 1.0, toilet: 'own', power: 'estate', theft: 0, grid: 9 },
  airres: { buy: 3200000, name: '2-bed flat · Airport Residential', area: 'Airport Residential', ll: [5.6000, -0.1800], rent: 2600, advance: 24, comfort: 1.05, toilet: 'own', power: 'estate', theft: 0, grid: 10 },
  legon: { name: 'Family house · East Legon', area: 'East Legon', ll: [5.6340, -0.1620], rent: 7500, advance:12, buy: 4200000, comfort: 1.1, toilet: 'own', power: 'grid', theft: 0, grid: 12 },
  trasacco: { name: 'Villa · Trasacco Valley', area: 'Trasacco', ll: [5.6420, -0.1440], rent: 45000, advance:24, buy: 25000000, comfort: 1.25, toilet: 'own', power: 'estate', theft: 0, grid: 14 },
};
// ---------- transport inside Accra ----------
// sb/sk: real seconds of travel = sb + sk × km (×rush in rush hour). surge: fare multiplier in rush hour. maxKm: how far it goes.
export const TRANSPORT = {
  walk: { name: 'Walk', ic: 'icon:person-simple-walk', base: 0, perKm: 0, speed: 1.4, sb: 4, sk: 14, rush: 1, surge: 1, maxKm: 5, hyg: -4, energy: -3, note: 'Free, slow, and you will sweat' },
  trotro: { name: 'Trotro', ic: 'icon:bus', base: 5.94, perKm: 0.972, speed: 6, sb: 9, sk: 3.4, rush: 1.6, surge: 1, fun: -3, hyg: -3, mood: 'trotroWahala', note: 'Cheap. Waits to fill up. Traffic hits hard' },
  okada: { name: 'Okada', ic: 'icon:motorcycle', base: 10, perKm: 2.2, speed: 11, sb: 3, sk: 2.1, rush: 1.05, surge: 1.2, maxKm: 15, fun: 4, risk: 0.02, note: 'Fastest in traffic. Small risk' },
  taxi: { name: 'Taxi (drop)', ic: 'icon:car', base: 25, perKm: 4.5, speed: 8, sb: 4, sk: 2.6, rush: 1.6, surge: 1, note: 'Door to door' },
  bolu: { name: 'Bolt ride', ic: 'icon:car', base: 18, perKm: 4.2, speed: 8, sb: 5, sk: 2.5, rush: 1.6, surge: 1.6, fun: 2, note: 'AC. Surge pricing in rush hour' },
  car: { name: 'Own car', ic: 'icon:circle', base: 0, perKm: 1.3, speed: 9, sb: 2, sk: 2.3, rush: 1.6, surge: 1, fun: 2, note: 'Fuel only. Flex on them' },
};
export const RUSH = [[6.5, 9.5], [16.5, 19.5]]; // weekday rush hours (Accra time)
export const CARS = { vitz: { name: 'Toyota Vitz (home-used)', price: 95000, rep: 5 }, corolla: { name: 'Toyota Corolla', price: 180000, rep: 12 }, prado: { name: 'Land Cruiser Prado', price: 1100000, rep: 40 }, gwagon: { name: 'G-Wagon', price: 4500000, rep: 90 } };

// ---------- activities shared by many places ----------
const T = (cost = 1) => ({ id: 'toilet', label: cost ? 'Pay toilet' : 'Use the washroom', ic: 'icon:toilet', min: 6, cost, inst: { bladder: 100, hygiene: 3 }, tags: ['toilet'] });
// ---------- locations: real Accra places ----------
// open: [from, to] in hours (to may exceed 24). days: 0=Sun..6=Sat (JS getUTCDay). acts: activities.
export const LOCATIONS = {
  circle: { name: 'Kwame Nkrumah Circle', area: 'Circle', ic: 'icon:circle', ll: [5.5703, -0.2151], open: [4, 24], blurb: 'Kaneshie! Mallam! Madina! The loudest interchange in West Africa.', acts: [
    T(1),
    { id: 'phonemarket', label: 'Phone market: buy, fix & flip', ic: 'icon:device-mobile', opens: 'circlephones', tags: ['shop', 'hustle'] },
    { id: 'fitter', label: 'Apprentice at the phone fitter', ic: 'icon:wrench', min: 90, earn: { base: 35, per: 14, skill: 'coding' }, needs: { energy: -8, fun: -4 }, skill: { coding: 0.3, hustle: 0.15 }, tags: ['gig'], rest: 45 },
    { id: 'unlock', label: 'Flash & unlock phones', ic: 'icon:circle', min: 60, earn: { base: 60, per: 22, skill: 'coding' }, req: { skill: { coding: 2 } }, skill: { coding: 0.35 }, tags: ['gig'], rest: 60 },
    { id: 'accessories', label: 'Hawk chargers & screen guards', ic: 'icon:circle', min: 60, earn: { base: 26, per: 10, skill: 'hustle' }, needs: { energy: -8, hygiene: -6 }, skill: { hustle: 0.3, charisma: 0.1 }, tags: ['gig', 'hustle'], rest: 30 },
    { id: 'preacher', label: 'Watch the market preacher', ic: 'icon:megaphone', min: 30, needs: { fun: 14, social: 10 }, skill: { comedy: 0.25 }, tags: ['social'] },
    { id: 'purewater', label: 'Pure water & Fan Ice', ic: 'icon:circle', min: 10, cost: 6, inst: { hunger: 6, fun: 6, bladder: -10 }, tags: ['eat'] },
    { id: 'sellwater', label: 'Sell pure water in traffic', ic: 'icon:circle', min: 60, earn: { base: 22, per: 9, skill: 'hustle' }, needs: { energy: -10, hygiene: -10 }, skill: { hustle: 0.35 }, tags: ['gig', 'hustle'], rest: 30 },
    { id: 'mate', label: 'Mate a few trotro trips (game)', ic: 'icon:bus', mg: 'trotro', tags: ['gig'], rest: 60 },
    { id: 'pickpocket', label: 'Pickpocket in the crowd', ic: 'icon:circle', min: 20, crime: { catch: 0.35, skill: 'hustle', loot: [10, 120] }, tags: ['crime'], rest: 180 },
  ] },
  muni: { name: "Auntie Muni's Waakye", area: 'Circle', ic: 'icon:bowl-food', ll: [5.5695, -0.2140], open: [5, 14], blurb: 'Gari, shito, wele, egg, spaghetti. Queue moves fast if you know Auntie.', acts: [
    { id: 'waakye', label: 'Waakye with everything', ic: 'icon:bowl-food', min: 25, cost: 30, needs: { hunger: 110, bladder: -12 }, tags: ['eat'], untilFull: 'hunger' },
    { id: 'waakyeSmall', label: 'Small waakye (₵20 one)', ic: 'icon:bowl-food', min: 20, cost: 20, needs: { hunger: 90 }, tags: ['eat'] },
    { id: 'gistMuni', label: 'Gist with Auntie Muni', ic: 'icon:chat-circle-dots', min: 20, needs: { social: 30, fun: 8 }, skill: { charisma: 0.2 }, tags: ['social'] },
  ] },
  makola: { name: 'Makola Market', area: 'Accra Central', ic: 'icon:circle', ll: [5.5481, -0.2071], open: [6, 18], days: [1, 2, 3, 4, 5, 6], blurb: 'If it exists, Makola sells it. Mind your pocket, mind your feet.', acts: [
    { id: 'foodstuff', label: 'Buy foodstuff (6 home meals)', ic: 'icon:circle', min: 40, cost: 85, inst: { food: 6 }, skill: { hustle: 0.2 }, tags: ['shop'] },
    { id: 'haggle', label: 'Haggle with the market queens', ic: 'icon:chat-circle-dots', min: 30, needs: { fun: 12, social: 20 }, skill: { hustle: 0.45, charisma: 0.15 }, tags: ['hustle', 'social'] },
    { id: 'kayayo', label: 'Carry loads (kayayo)', ic: 'icon:circle', min: 60, earn: { base: 35, per: 8, skill: 'fitness' }, needs: { energy: -14, hygiene: -12 }, skill: { fitness: 0.35 }, tags: ['gig'], rest: 30 },
    { id: 'resell', label: 'Buy & resell in the market', ic: 'icon:circle', min: 90, earn: { base: 30, per: 18, skill: 'hustle', var: 0.5 }, needs: { energy: -6, social: 8 }, skill: { hustle: 0.6 }, tags: ['gig', 'hustle'], rest: 45 },
    T(1),
  ] },
  kantamanto: { name: 'Kantamanto Market', area: 'Accra Central', ic: 'icon:t-shirt', ll: [5.5490, -0.2125], open: [7, 18], days: [1, 2, 3, 4, 5, 6], blurb: 'Obroni wawu: second-hand from Europe, first-class in Accra.', acts: [
    { id: 'thrift', label: 'Thrift shopping (try on & buy clothes)', ic: 'icon:t-shirt', opens: 'wardrobe', tags: ['shop'] },
    { id: 'bale', label: 'Dig through a fresh bale', ic: 'icon:circle', min: 45, cost: 20, needs: { fun: 18 }, skill: { hustle: 0.2, photo: 0.1 }, tags: ['shop'] },
  ] },
  chopbar: { name: 'Who Jah Bless Chop Bar', area: 'Accra Central', ic: 'icon:bowl-food', ll: [5.5500, -0.2050], open: [9, 21], blurb: 'Fufu pounded to music. Light soup that clears your sinuses.', acts: [
    { id: 'fufu', label: 'Fufu & light soup with goat', ic: 'icon:bowl-food', min: 35, cost: 55, needs: { hunger: 130, bladder: -12 }, tags: ['eat'], moodlet: 'goodChop' },
    { id: 'banku', label: 'Banku & tilapia', ic: 'icon:circle', min: 35, cost: 70, needs: { hunger: 140, fun: 10, bladder: -10 }, tags: ['eat'], moodlet: 'goodChop' },
    { id: 'redred', label: 'Red red & plantain', ic: 'icon:circle', min: 25, cost: 28, needs: { hunger: 100 }, tags: ['eat'] },
    { id: 'washplates', label: 'Wash plates for chop money', ic: 'icon:fork-knife', min: 60, earn: { base: 40, per: 0 }, needs: { energy: -8, hygiene: -6 }, tags: ['gig'], rest: 60 },
    { id: 'rush', label: 'Help at the lunch rush (game)', ic: 'icon:bowl-food', mg: 'waakye', tags: ['gig'], rest: 60 },
    T(0),
  ] },
  kenkey: { name: 'Sweet Mother Kenkey', area: 'Jamestown', ic: 'icon:circle', ll: [5.5345, -0.2085], open: [6, 21], blurb: 'Ga kenkey, fried fish, shito, pepper. The holy trinity.', acts: [
    { id: 'kenkey', label: 'Kenkey & fried fish', ic: 'icon:circle', min: 25, cost: 30, needs: { hunger: 120 }, tags: ['eat'] },
    { id: 'kenkeyTake', label: 'Kenkey takeaway (+2 home meals)', ic: 'icon:circle', min: 10, cost: 40, inst: { food: 2 }, tags: ['shop'] },
  ] },
  oxford: { name: 'Oxford Street, Osu', area: 'Osu', ic: 'icon:moon', ll: [5.5585, -0.1830], open: [0, 24], blurb: 'Neon, kelewele, shopping, hawkers, and everyone you know.', acts: [
    { id: 'kelewele', label: 'Kelewele & groundnuts', ic: 'icon:circle', min: 15, cost: 15, needs: { hunger: 60, fun: 30 }, tags: ['eat'], open: [16, 25] },
    { id: 'stroll', label: 'Stroll and people-watch', ic: 'icon:eye', min: 40, needs: { fun: 22, social: 14 }, tags: ['social'] },
    { id: 'photoOsu', label: 'Photograph tourists (DSLR)', ic: 'icon:camera', min: 90, earn: { base: 50, per: 32, skill: 'photo' }, skill: { photo: 0.5 }, req: { item: 'dslr' }, tags: ['gig', 'photo'], rest: 60 },
    { id: 'hawk', label: 'Hawk phone accessories', ic: 'icon:circle', min: 60, earn: { base: 30, per: 14, skill: 'hustle' }, skill: { hustle: 0.4 }, needs: { energy: -8 }, tags: ['gig', 'hustle'], rest: 40 },
  ] },
  vibes: { name: 'Vibes Lounge, Osu', area: 'Osu', ic: 'icon:circle', ll: [5.5578, -0.1815], open: [21, 29], blurb: 'Amapiano till 4. VIP is a state of mind (and GH₵1,500).', acts: [
    { id: 'party', label: 'Party (cover ₵60)', ic: 'icon:circle', min: 120, cost: 60, needs: { fun: 40, social: 30, energy: -10, bladder: -15 }, skill: { dance: 0.4 }, tags: ['party', 'nightlife', 'dance'] },
    { id: 'drinks', label: 'Bottle of Club & small chops', ic: 'icon:circle', min: 30, cost: 45, needs: { fun: 30, hunger: 20, bladder: -40 }, tags: ['nightlife', 'eat'] },
    { id: 'battle', label: 'Azonto dance battle (game)', ic: 'icon:person-simple-dance', mg: 'azonto', tags: ['gig', 'dance'], rest: 90 },
    { id: 'vip', label: 'VIP table', ic: 'icon:beer-bottle', min: 120, cost: 1500, needs: { fun: 70, social: 50 }, rep: 6, tags: ['party', 'nightlife', 'luxury'], moment: true },
    { id: 'shutdown', label: 'Shut down the club (everyone drinks on you)', ic: 'icon:wallet', min: 60, cost: 250000, needs: { fun: 100, social: 100 }, rep: 120, tags: ['luxury', 'nightlife'], moment: 'shutdown' },
    { id: 'sneakvip', label: 'Sneak into VIP', ic: 'icon:circle', min: 20, crime: { catch: 0.45, skill: 'charisma', reward: { fun: 40, social: 30 } }, tags: ['crime'] },
    T(2),
  ] },
  hub: { name: 'Sankofa Tech Hub, Osu', area: 'Osu', ic: 'icon:circle', ll: [5.5575, -0.1790], open: [8, 22], blurb: 'Fibre internet, standing desks, founders who say "disrupt".', acts: [
    { id: 'cowork', label: 'Co-working day pass', ic: 'icon:circle', min: 120, cost: 40, needs: { social: 6, fun: -4 }, skill: { coding: 0.9 }, tags: ['study', 'code'] },
    { id: 'bootcamp', label: 'Weekend coding bootcamp', ic: 'icon:circle', min: 240, cost: 250, days: [0, 6], skill: { coding: 2.5 }, needs: { social: 6 }, tags: ['study', 'code'] },
    { id: 'freelance', label: 'Freelance bug fixing (game)', ic: 'icon:circle', mg: 'bughunt', req: { skill: { coding: 2 } }, tags: ['gig', 'code'], rest: 90 },
    { id: 'buildmvp', label: 'Build your startup MVP', ic: 'icon:wrench', min: 180, needs: { energy: -18, fun: -6 }, skill: { coding: 0.5 }, req: { item: 'laptop', skill: { coding: 3 } }, mvp: true, tags: ['code'] },
    { id: 'sakawa', label: 'Chat "clients" on Facebook (yahoo-yahoo)', ic: '', min: 180, req: { item: 'laptop' }, crime: { catch: 0.1, skill: 'charisma', loot: [150, 1200] }, sakawa: true, needs: { fun: -6, energy: -10 }, tags: ['crime'], rest: 240 },
    { id: 'pitch', label: 'Pitch investors (needs a finished MVP)', ic: 'icon:circle', min: 60, req: { skill: { coding: 5, charisma: 3 } }, pitch: true, tags: ['pitch'], weekly: true },
    T(0),
  ] },
  bank: { name: 'Gold Coast Bank, Ridge', area: 'Ridge', ic: 'icon:bank', ll: [5.5635, -0.1955], open: [8, 17], days: [1, 2, 3, 4, 5], blurb: 'Air-conditioned queues and very serious tellers.', acts: [
    { id: 'loans', label: 'Loans desk', ic: 'icon:circle', opens: 'loans', tags: ['civic'] },
    { id: 'fixed', label: 'Fixed savings (simulated 12% p.a.)', ic: 'icon:circle', opens: 'deposit', tags: ['civic'] },
    T(0),
  ] },
  ridge: { name: 'Ridge Hospital', area: 'Ridge', ic: 'icon:first-aid', ll: [5.5625, -0.1993], open: [0, 24], blurb: 'Drink water. No, really, drink water.', acts: [
    { id: 'checkup', label: 'Check-up & multivitamins', ic: 'icon:first-aid', min: 60, cost: 150, inst: { energy: 15 }, cures: 'mild', tags: ['health'] },
    { id: 'treatment', label: 'Malaria / typhoid treatment', ic: 'icon:circle', min: 120, cost: 450, cures: 'serious', tags: ['health'] },
    T(0),
  ] },
  korlebu: { name: 'Korle Bu Teaching Hospital', area: 'Korle Bu', ic: 'icon:first-aid', ll: [5.5379, -0.2262], open: [0, 24], blurb: 'The biggest hospital in Ghana. Bring patience.', acts: [
    { id: 'checkup2', label: 'OPD consultation', ic: 'icon:first-aid', min: 120, cost: 90, cures: 'mild', tags: ['health'] },
    { id: 'nhis', label: 'NHIS ward treatment (free, long wait)', ic: 'icon:circle', min: 600, sleep: true, restore: 40, needs: { fun: -20, hunger: 10 }, cures: 'serious', tags: ['health'] },
    { id: 'hospfood', label: 'Hospital canteen (rice & stew)', ic: 'icon:bowl-food', min: 20, cost: 12, needs: { hunger: 70 }, tags: ['eat'] },
  ] },
  police: { name: 'Osu Police Station', area: 'Osu', ic: 'icon:circle', ll: [5.5560, -0.1850], open: [0, 24], blurb: 'The sign says BAIL IS FREE.', acts: [
    { id: 'report', label: 'Report a stolen phone', ic: 'icon:circle', min: 45, cost: 0, needs: { fun: -10 }, tags: ['civic'] },
  ] },
  memorial: { name: 'Kwame Nkrumah Memorial Park', area: 'Accra Central', ic: 'icon:circle', ll: [5.5446, -0.2032], open: [10, 17], blurb: 'Where Ghana declared independence. Fountains, statues, history.', acts: [
    { id: 'tour', label: 'Guided tour', ic: 'icon:circle', min: 60, cost: 25, needs: { fun: 26, social: 10 }, skill: { charisma: 0.15 }, tags: ['tour'] },
    { id: 'shoot', label: 'Photo shoot by the fountains', ic: 'icon:camera', min: 40, needs: { fun: 10 }, skill: { photo: 0.6 }, req: { item: 'dslr' }, tags: ['photo'] },
  ] },
  blackstar: { name: 'Black Star Square', area: 'Osu', ic: 'icon:star', ll: [5.5474, -0.1922], open: [0, 24], blurb: 'Independence Square. Parades, kites, early-morning joggers.', acts: [
    { id: 'jog', label: 'Morning jog', ic: 'icon:circle', min: 45, open: [5, 9], needs: { energy: -10, hygiene: -14, fun: 12 }, skill: { fitness: 0.6 }, tags: ['workout'] },
    { id: 'kite', label: 'Fly a kite', ic: 'icon:circle', min: 40, cost: 10, needs: { fun: 30 }, tags: ['relax'] },
  ] },
  castle: { name: 'Osu Castle', area: 'Osu', ic: 'icon:circle', ll: [5.5459, -0.1797], open: [9, 16], blurb: 'Old walls, heavy history.', acts: [
    { id: 'castletour', label: 'Castle history tour', ic: 'icon:circle', min: 75, cost: 30, needs: { fun: 20, social: 6 }, tags: ['tour'] },
    { id: 'guide', label: 'Guide diaspora visitors', ic: 'icon:circle', min: 90, earn: { base: 60, per: 28, skill: 'charisma' }, req: { skill: { charisma: 3 } }, skill: { charisma: 0.4 }, tags: ['gig'], rest: 120 },
  ] },
  lighthouse: { name: 'Jamestown Lighthouse', area: 'Jamestown', ic: 'icon:circle', ll: [5.5326, -0.2126], open: [9, 17], blurb: 'Climb it. See all of Accra and the fishing canoes below.', acts: [
    { id: 'climb', label: 'Climb the lighthouse', ic: 'icon:circle', min: 45, cost: 20, needs: { fun: 34, energy: -6 }, skill: { photo: 0.2 }, tags: ['tour'] },
  ] },
  bukom: { name: 'Bukom Boxing Arena', area: 'Jamestown', ic: 'icon:circle', ll: [5.5361, -0.2208], open: [6, 21], blurb: 'Azumah Nelson territory. Hands up!', acts: [
    { id: 'train', label: 'Train with the coach', ic: 'icon:circle', min: 60, cost: 15, needs: { energy: -14, hygiene: -18, fun: 10 }, skill: { fitness: 0.9 }, tags: ['workout'] },
    { id: 'spar', label: 'Paid sparring (game)', ic: 'icon:circle', mg: 'boxing', tags: ['gig'], rest: 90 },
    { id: 'fightnight', label: 'Watch fight night', ic: 'icon:circle', min: 120, cost: 40, days: [6], open: [18, 23], needs: { fun: 60, social: 30 }, tags: ['sport', 'nightlife'] },
  ] },
  canoes: { name: 'Jamestown Canoe Beach', area: 'Jamestown', ic: 'icon:sailboat', ll: [5.5318, -0.2103], open: [4, 18], blurb: 'Fishermen, nets, the smell of the sea. No fishing on Tuesdays.', acts: [
    { id: 'net', label: 'Help pull the net', ic: 'icon:circle', min: 40, needs: { energy: -10, social: 20, fun: 8 }, skill: { fitness: 0.3 }, tags: ['social'], days: [0, 1, 3, 4, 5, 6] },
    { id: 'fish', label: 'Buy fresh fish (+3 home meals)', ic: 'icon:circle', min: 20, cost: 45, inst: { food: 3 }, tags: ['shop'] },
  ] },
  labadi: { name: 'Labadi Beach', area: 'La', ic: 'icon:palm-tree', ll: [5.5596, -0.1470], open: [6, 22], blurb: 'Since 2 October 2026 the beachfront bars and stalls are rubble. The sea is still here; the businesses are not. Vendors sell from coolers on the sand.', acts: [
    { id: 'ruins', label: 'Walk through the demolished beachfront', ic: 'icon:house', min: 25, needs: { fun: -6, social: 8 }, moodlet: 'labadiRuins', moodV: -6, moodL: 'Saw what is left of the Labadi beachfront', tags: ['tour'] },
    { id: 'helpvendor', label: 'Help a displaced vendor move her stock', ic: 'icon:circle', min: 60, earn: { base: 25, per: 6, skill: 'hustle' }, needs: { energy: -14, hygiene: -10, social: 16 }, rep: 1, skill: { fitness: 0.2, charisma: 0.15 }, tags: ['gig'], rest: 60 },
    { id: 'donatefund', label: 'Give ₵50 to the vendors’ support fund', ic: 'icon:handshake', min: 10, cost: 50, needs: { fun: 8, social: 10 }, rep: 2, moodlet: 'gaveBack', moodL: 'Helped the Labadi vendors', tags: ['social'] },
    { id: 'swim', label: 'Swim in the sea', ic: 'icon:circle', min: 40, needs: { fun: 30, hygiene: 10, energy: -8 }, skill: { fitness: 0.2 }, tags: ['relax', 'sport'] },
    { id: 'palmwine', label: 'Palm wine from a cooler on the sand', ic: 'icon:circle', min: 20, cost: 15, needs: { fun: 34, bladder: -40 }, tags: ['relax'] },
    { id: 'tilapia', label: 'Tilapia & banku (cooked on a coal pot now)', ic: 'icon:circle', min: 40, cost: 70, needs: { hunger: 120, fun: 12 }, tags: ['eat'] },
    { id: 'beachworkout', label: 'Muscle Beach workout', ic: 'icon:barbell', min: 60, needs: { energy: -16, hygiene: -16, fun: 8, social: 8 }, skill: { fitness: 0.8 }, tags: ['workout'] },
    { id: 'drumjam', label: 'Sunday drummers’ jam on the sand', ic: 'icon:circle', min: 120, days: [0], open: [14, 22], needs: { fun: 44, social: 36, energy: -8 }, skill: { dance: 0.3, music: 0.2 }, tags: ['party'] },
    T(2),
  ] },
  funeral: { name: 'La Funeral Grounds', area: 'La', ic: 'icon:circle', ll: [5.5640, -0.1560], open: [8, 20], days: [6], blurb: 'Saturday funerals: black & red, DJs, jollof, and dancing the dead home.', acts: [
    { id: 'attend', label: 'Attend & donate ₵30', ic: 'icon:circle', min: 120, cost: 30, needs: { hunger: 40, social: 40, fun: 18 }, skill: { dance: 0.3 }, tags: ['social', 'dance'] },
    { id: 'mourn', label: 'Professional mourner', ic: 'icon:circle', min: 120, earn: { base: 70, per: 25, skill: 'charisma' }, tags: ['gig'], rest: 240 },
    { id: 'djfuneral', label: 'DJ the funeral (big speaker)', ic: 'icon:circle', min: 180, earn: { base: 150, per: 60, skill: 'music' }, req: { item: 'speaker' }, skill: { music: 0.6 }, tags: ['gig', 'music'], rest: 300 },
  ] },
  church: { name: 'Glorious Fire Ministry', area: 'Osu', ic: 'icon:church', ll: [5.5600, -0.1880], open: [6, 22], blurb: 'Three offerings, two hours of praise, one very loud keyboard.', acts: [
    { id: 'service', label: 'Sunday service (offering ₵10)', ic: 'icon:circle', min: 180, cost: 10, days: [0], open: [7, 13], needs: { fun: 22, social: 40 }, skill: { music: 0.2, charisma: 0.2 }, tags: ['social', 'civic'] },
    { id: 'prayer', label: 'Midweek prayer meeting', ic: 'icon:hand-heart', min: 90, days: [3, 5], open: [18, 21], needs: { fun: 10, social: 30 }, tags: ['social'] },
    { id: 'choir', label: 'Choir practice', ic: 'icon:music-notes', min: 60, needs: { fun: 14, social: 14 }, skill: { music: 0.6 }, tags: ['music'] },
    { id: 'seed', label: 'Sow a seed (₵100)', ic: 'icon:plant', min: 5, cost: 100, needs: { fun: 10 }, inst: { social: 8 }, tags: ['civic'] },
  ] },
  mosque: { name: 'Nima Central Mosque', area: 'Nima', ic: 'icon:mosque', ll: [5.5830, -0.1985], open: [5, 21], blurb: 'Calm in the middle of Nima noise.', acts: [
    { id: 'pray', label: 'Pray', ic: 'icon:mosque', min: 30, needs: { fun: 16, social: 18 }, tags: ['social'] },
    { id: 'jumah', label: 'Jumu’ah prayers (Friday)', ic: 'icon:circle', min: 90, days: [5], open: [12, 15], needs: { fun: 20, social: 40 }, skill: { charisma: 0.2 }, tags: ['social', 'civic'] },
  ] },
  stadium: { name: 'Accra Sports Stadium', area: 'Osu', ic: 'icon:circle', ll: [5.5513, -0.1923], open: [8, 22], blurb: 'Hearts of Oak home. Phobia!', acts: [
    { id: 'match', label: 'Watch Hearts vs Kotoko (₵60)', ic: 'icon:soccer-ball', min: 120, cost: 60, days: [0], open: [15, 18], needs: { fun: 60, social: 40 }, tags: ['sport'] },
    { id: 'stadiumjog', label: 'Run the stadium stairs', ic: 'icon:circle', min: 45, needs: { energy: -14, hygiene: -16 }, skill: { fitness: 0.8 }, tags: ['workout'] },
  ] },
  viewing: { name: 'Nima Football Viewing Centre', area: 'Nima', ic: 'icon:television', ll: [5.5800, -0.2000], open: [12, 24], blurb: 'Ghanaian and international football on an animated screen. Shared simulated fixtures and game-money predictions.', acts: [
    { id: 'watch', label: 'Watch the match (₵5)', ic: 'icon:soccer-ball', min: 110, cost: 5, needs: { fun: 40, social: 30 }, tags: ['sport', 'social'] },
    { id: 'bet', label: 'Match predictions', ic: 'icon:soccer-ball', opens: 'matches', tags: ['sport'] },
  ] },
  radio: { name: 'Sankofa FM Studios', area: 'Labone', ic: 'icon:circle', ll: [5.5650, -0.1700], open: [5, 22], blurb: 'Morning show, phone-ins, sponsor reads.', acts: [
    { id: 'callin', label: 'Call into the talk show', ic: 'icon:circle', min: 20, cost: 2, needs: { fun: 20, social: 16 }, skill: { comedy: 0.25 }, tags: ['social'] },
    { id: 'tourfm', label: 'Studio tour', ic: 'icon:circle', min: 40, needs: { fun: 14 }, skill: { music: 0.15, comedy: 0.15 }, tags: ['tour'] },
  ] },
  mall: { name: 'Accra Mall', area: 'Tetteh Quarshie', ic: 'icon:storefront', ll: [5.6227, -0.1739], open: [9, 22], blurb: 'AC, cinema, and people pretending they came for one thing.', acts: [
    { id: 'homestore', label: 'Home & lifestyle store', ic: 'icon:circle', opens: 'shop:home', tags: ['shop'] },
    { id: 'fashion', label: 'Fashion boutique (clothes, wigs, shoes)', ic: 'icon:t-shirt', opens: 'shop:fashion', tags: ['shop'] },
    { id: 'gadgets', label: 'Phones & gadgets', ic: 'icon:device-mobile', opens: 'shop:gadgets', tags: ['shop'] },
    { id: 'cinema', label: 'Cinema: new Kumawood x Nollywood', ic: 'icon:circle', min: 120, cost: 70, needs: { fun: 45, social: 10 }, tags: ['relax', 'date'] },
    { id: 'foodcourt', label: 'Food court burger', ic: 'icon:hamburger', min: 30, cost: 95, needs: { hunger: 110, fun: 14 }, tags: ['eat'] },
    { id: 'window', label: 'Window shopping', ic: 'icon:eye', min: 45, needs: { fun: 14, social: 8 }, tags: ['shop'] },
    T(0),
  ] },
  ug: { name: 'University of Ghana, Legon', area: 'Legon', ic: 'icon:graduation-cap', ll: [5.6508, -0.1870], open: [7, 22], blurb: 'Commonwealth Hall is singing again.', acts: [
    { id: 'lecture', label: 'Sit in on a lecture', ic: 'icon:book-open', min: 90, cost: 15, needs: { social: 10, fun: -4 }, skill: { coding: 0.5, charisma: 0.2 }, tags: ['study'] },
    { id: 'balme', label: 'Balme Library study session', ic: 'icon:book-open', min: 120, needs: { fun: -8 }, skill: { coding: 0.7 }, tags: ['study', 'read'] },
    { id: 'nightmarket', label: 'Night Market food', ic: 'icon:circle', min: 40, cost: 35, open: [17, 22], needs: { hunger: 90, social: 20, fun: 12 }, tags: ['eat', 'social'] },
    { id: 'tutor', label: 'Tutor first-years', ic: 'icon:circle', min: 90, earn: { base: 50, per: 32, skill: 'coding' }, req: { skill: { coding: 3 } }, tags: ['gig'], rest: 120 },
  ] },
  airport: { name: 'Kotoka International Airport', area: 'Airport', ic: 'icon:airplane', ll: [5.6052, -0.1668], open: [0, 24], blurb: 'Clap when it lands.', acts: [
    { id: 'planes', label: 'Watch planes land', ic: 'icon:circle', min: 40, needs: { fun: 18 }, tags: ['relax'] },
    { id: 'kumasi', label: 'Weekend flight to Kumasi', ic: 'icon:airplane', min: 960, cost: 1400, needs: { fun: 10, social: 4 }, inst: { fun: 60, social: 30 }, tags: ['travel', 'luxury'] },
    T(0),
  ] },
  hotel: { name: 'Labadi Beach Hotel', area: 'La', ic: 'icon:circle', ll: [5.5615, -0.1530], open: [0, 24], blurb: 'Pool, brunch, diaspora weddings.', acts: [
    { id: 'pool', label: 'Pool day pass', ic: 'icon:circle', min: 180, cost: 250, needs: { fun: 30, hygiene: 20, social: 14 }, tags: ['relax', 'luxury'] },
    { id: 'brunch', label: 'Sunday brunch', ic: 'icon:beer-bottle', min: 90, cost: 400, days: [0], needs: { hunger: 140, fun: 30, social: 20 }, tags: ['eat', 'luxury'] },
    { id: 'room', label: 'Book a room for the night', ic: 'icon:circle', min: 480, sleep: true, needs: {energy:95,hygiene:30,fun:15}, cost: 2500, tags: ['sleep', 'luxury'] },
    { id: 'emcee', label: 'MC a wedding reception', ic: 'icon:microphone', min: 180, earn: { base: 180, per: 70, skill: 'comedy' }, req: { skill: { comedy: 3 } }, days: [5, 6], tags: ['gig'], rest: 360 },
    T(0),
  ] },
  ama: { name: 'Accra Metropolitan Assembly', area: 'Accra Central', ic: 'icon:circle', ll: [5.5500, -0.2010], open: [8, 17], days: [1, 2, 3, 4, 5], blurb: 'Permits, rates, and a weekly community priorities ballot.', acts: [
    { id: 'vote', label: 'Community priorities ballot', ic: 'icon:circle', opens: 'ballot', tags: ['civic'] },
    { id: 'townhall', label: 'Attend town hall', ic: 'icon:circle', min: 60, needs: { social: 20 }, skill: { charisma: 0.4 }, tags: ['civic'] },
  ] },
  cars: { name: 'Correct Cars, Spintex Road', area: 'Spintex', ic: 'icon:circle', ll: [5.6150, -0.1450], open: [8, 19], blurb: 'Correct car, correct price. (Price is negotiable. Car is not correct.)', acts: [
    { id: 'showroom', label: 'Showroom', ic: 'icon:circle', opens: 'cars', tags: ['shop'] },
    { id: 'rent', label: 'Rent a car for the day (₵350)', ic: 'icon:key', opens: 'rentCar', tags: ['shop'] },
  ] },
  momo: { name: 'Blessed MoMo Agent', area: 'Circle', ic: 'icon:circle', ll: [5.5712, -0.2160], open: [6, 22], blurb: 'Cash in, cash out, network is down, come back.', acts: [
    { id: 'momo', label: 'Cash in / cash out', ic: 'icon:wallet', opens: 'momo', tags: ['civic'] },
  ] },
};

// ---------- careers: real 1-hour shifts inside real weekly schedules ----------
// days use JS getUTCDay (0=Sun). pay = GH₵ per shift. req = entry skills. promo = skill needed per rank-up.
export const CAREERS = {
  trotro: { name: 'Trotro', ic: 'icon:bus', at: 'circle', skill: 'driving', days: [1, 2, 3, 4, 5, 6], ranks: [['Trotro Mate', 100], ['Senior Mate', 140], ['Trotro Driver', 190], ['Station Master', 280], ['GPRTU Chairman', 420]], mg: 'trotro' },
  chef: { name: 'Chop Bar', ic: 'icon:bowl-food', at: 'chopbar', skill: 'cooking', days: [0, 1, 3, 4, 5, 6], ranks: [['Kitchen Hand', 60], ['Fufu Pounder', 90], ['Line Cook', 140], ['Head Cook', 230], ['Chop Bar Queen', 380]], mg: 'waakye' },
  trader: { name: 'Market Trading', ic: 'icon:circle', at: 'makola', skill: 'hustle', days: [1, 2, 3, 4, 5, 6], ranks: [['Kayayo', 50], ['Table Seller', 90], ['Shop Assistant', 150], ['Wholesaler', 270], ['Market Queen', 520]] },
  tech: { name: 'Tech', ic: 'icon:laptop', at: 'hub', skill: 'coding', days: [1, 2, 3, 4, 5], ranks: [['Intern', 150], ['Junior Developer', 260], ['Software Engineer', 420], ['Senior Engineer', 650], ['CTO', 1000]], req: {}, mg: 'bughunt' },
  bank: { name: 'Banking', ic: 'icon:bank', at: 'bank', skill: 'charisma', days: [1, 2, 3, 4, 5], ranks: [['Teller', 140], ['Customer Service', 210], ['Relationship Manager', 340], ['Branch Manager', 560], ['Regional Director', 980]], req: { charisma: 2 } },
  nurse: { name: 'Nursing', ic: 'icon:first-aid', at: 'ridge', skill: 'charisma', days: [0, 1, 2, 3, 4, 5, 6], ranks: [['Nurse Aide', 100], ['Staff Nurse', 170], ['Senior Staff Nurse', 260], ['Nursing Officer', 380], ['Matron', 600]] },
  doctor: { name: 'Medicine', ic: 'icon:circle', at: 'korlebu', skill: 'coding', days: [1, 2, 3, 4, 5, 6], ranks: [['House Officer', 260], ['Medical Officer', 420], ['Senior MO', 620], ['Specialist', 900], ['Chief Consultant', 1500]], req: { coding: 3, fitness: 2 } },
  police: { name: 'Ghana Police', ic: 'icon:police-car', at: 'police', skill: 'fitness', days: [0, 1, 2, 4, 5, 6], ranks: [['Constable', 120], ['Corporal', 180], ['Sergeant', 260], ['Inspector', 400], ['Commissioner', 800]], req: { fitness: 2 } },
  radio: { name: 'Radio & TV', ic: 'icon:circle', at: 'radio', skill: 'comedy', days: [1, 2, 3, 4, 5], ranks: [['Studio Intern', 80], ['Producer', 150], ['Co-host', 260], ['Morning Show Host', 460], ['Media Mogul', 1000]] },
  dj: { name: 'Nightlife', ic: 'icon:headphones', at: 'vibes', skill: 'music', days: [0, 3, 4, 5, 6], ranks: [['Hype Dancer', 80], ['Resident Dancer', 140], ['DJ', 250], ['Headline DJ', 430], ['Afrobeats Star', 1150]], mg: 'azonto', night: true },
  boxer: { name: 'Boxing', ic: 'icon:circle', at: 'bukom', skill: 'fitness', days: [1, 2, 3, 4, 5, 6], ranks: [['Sparring Partner', 60], ['Amateur', 110], ['Pro Boxer', 230], ['Contender', 420], ['Bukom Champion', 950]], mg: 'boxing' },
  teacher: { name: 'University', ic: 'icon:graduation-cap', at: 'ug', skill: 'coding', days: [1, 2, 3, 4, 5], ranks: [['Teaching Assistant', 120], ['Lecturer', 270], ['Senior Lecturer', 420], ['Professor', 680], ['Vice-Chancellor', 1050]], req: { coding: 2 } },
  hotel: { name: 'Hospitality', ic: 'icon:circle', at: 'hotel', skill: 'charisma', days: [0, 2, 3, 4, 5, 6], ranks: [['Waiter', 80], ['Receptionist', 140], ['Chef de Partie', 240], ['Hotel Manager', 430], ['General Manager', 760]] },
  aviation: { name: 'Aviation', ic: 'icon:airplane', at: 'airport', skill: 'driving', days: [0, 1, 4, 5, 6], ranks: [['Ground Staff', 150], ['Cabin Crew', 290], ['First Officer', 520], ['Captain', 920], ['Chief Pilot', 1450]], req: { driving: 3 } },
  civil: { name: 'Civil Service', ic: 'icon:circle', at: 'ama', skill: 'charisma', days: [1, 2, 3, 4, 5], ranks: [['Clerk', 110], ['Assistant Officer', 170], ['Senior Officer', 250], ['Director', 400], ['Metro Chief Executive', 720]] },
  ride: { name: 'Ride-hailing', ic: 'icon:car', at: 'cars', skill: 'driving', days: [0, 1, 2, 3, 4, 5, 6], ranks: [['Okada Rider', 90], ['Bolt Driver', 150], ['Gold Driver', 230], ['Fleet Manager', 340], ['Fleet Owner', 620]], mg: 'bolu' },
  fisher: { name: 'Fishing', ic: 'icon:sailboat', at: 'canoes', skill: 'fitness', days: [0, 1, 3, 4, 5, 6], ranks: [['Deckhand', 60], ['Net Mender', 90], ['Canoe Crew', 140], ['Canoe Captain', 230], ['Chief Fisherman', 410]] },
  fashion: { name: 'Fashion', ic: 'icon:circle', at: 'kantamanto', skill: 'photo', days: [1, 2, 3, 4, 5, 6], ranks: [['Apprentice', 55], ['Seamstress', 100], ['Master Tailor', 170], ['Designer', 310], ['Fashion House Owner', 620]] },
  pastor: { name: 'Ministry', ic: 'icon:church', at: 'church', skill: 'charisma', days: [0, 3, 5], ranks: [['Usher', 50], ['Choir Member', 90], ['Deacon', 160], ['Associate Pastor', 320], ['General Overseer', 950]] },
};
export const PROMO_SKILL = [1, 3, 5, 7];          // skill needed to leave rank i
export const PROMO_SHIFTS = [3, 5, 8, 12];        // shifts needed at rank i

// ---------- passive income ----------
export const BUSINESSES = {
  munishare: { name: "Share in Auntie Muni's Kaneshie waakye", ic: 'icon:bowl-food', price: 4000, pay: 40, hidden: true },
  water: { name: 'Sachet water distribution', ic: 'icon:circle', price: 3500, pay: 45 },
  kelewele: { name: 'Kelewele stand, Oxford St', ic: 'icon:circle', price: 8000, pay: 95 },
  barber: { name: 'Barbering salon, Nima', ic: 'icon:circle', price: 25000, pay: 230 },
  momoagent: { name: 'MoMo agent kiosk', ic: 'icon:circle', price: 40000, pay: 270 },
  chopbar: { name: 'Chop bar, Makola', ic: 'icon:bowl-food', price: 120000, pay: 880 },
  trotro: { name: 'Trotro (Sprinter) "God Dey"', ic: '', price: 260000, pay: 560 },
  pharmacy: { name: 'Pharmacy, East Legon', ic: 'icon:first-aid', price: 650000, pay: 3100 },
  events: { name: 'Event centre, La', ic: 'icon:circle', price: 1600000, pay: 7400 },
  club: { name: 'Share of Vibes Lounge', ic: 'icon:circle', price: 5000000, pay: 21000 },
};
export const LANDS = {
  kasoa: { name: 'Plot · Kasoa', price: 90000, g: 0.006, risk: 0.12 },
  adenta: { name: 'Plot · Adenta', price: 220000, g: 0.005, risk: 0.08 },
  oyarifa: { name: 'Plot · Oyarifa', price: 260000, g: 0.005, risk: 0.07 },
  prampram: { name: 'Plot · Prampram', price: 140000, g: 0.007, risk: 0.1 },
  legonhills: { name: 'Plot · East Legon Hills', price: 600000, g: 0.004, risk: 0.05 },
  eastlegon: { name: 'Plot · East Legon (prime)', price: 3500000, g: 0.003, risk: 0.03 },
};
// weekly progressive income tax on earnings (GRA-flavoured)
export const TAX_BANDS = [[1000, 0], [2000, 0.05], [7000, 0.175], [40000, 0.25], [Infinity, 0.35]];
// ECG load-shedding timetable, by JS weekday (0=Sun), [from, to] hours
export const DUMSOR = { 0: [20, 23], 1: [18, 22], 2: null, 3: [6, 10], 4: [19, 24], 5: null, 6: [12, 16] };
export const POLICIES = { trotro: 'Half-price trotro fares', food: 'Chop bar food 25% cheaper', wages: 'All shift pay +10%', light: 'ECG promises fewer outages', tax: 'Income tax −5 points' };

Object.assign(LOCATIONS, EXTRA_LOCATIONS, neighbourhoodLocations(HOMES));
for(const [id,act] of Object.entries(NEIGHBOURHOOD_ACTIVITIES))LOCATIONS['n:'+id].acts=[...LOCATIONS['n:'+id].acts,{...act,rest:30}];
// Retire employment-only minigame scoring, retaining action IDs and midpoint pay.
for(const [place,id,label,skill]of [['circle','mate','Help dispatch trotro trips','hustle'],['chopbar','rush','Coordinate the lunch rush','cooking'],['hub','freelance','Complete a freelance maintenance assignment','coding']]){
  const a=LOCATIONS[place].acts.find(a=>a.id===id);delete a.mg;
  Object.assign(a,{label,min:60,earn:{base:62,per:4.34,skill},skill:{[skill]:.8},needs:{energy:-8,fun:-4},rest:60});
}
