// "The Daily Chale": one Accra front page per real day (headline, weather, tip, occasion).
// Deterministic per UTC day (Accra is GMT+0), so every player in the city reads the same paper.
// Facts behind the seasons and dates: docs/accra-facts.json.

const HEADLINES = [
  'Trotro mate gives correct change on first try. Passengers call pastor to confirm.',
  'Circle overhead: man finally finds the right exit after eleven years.',
  'Makola auntie reduces price by GH₵1. Customers suspect a trick.',
  'Kenkey seller says "last price" four times. Each one lower.',
  'Light comes back in Kaneshie. Whole street shouts like Black Stars scored.',
  'Osu landlord asks for only one year advance. Tenants faint from joy.',
  'Bolt driver arrives at the exact pin. Rider takes screenshot for evidence.',
  'Labadi: kite flies higher than a Spintex Road rent.',
  'East Legon traffic so slow, hawker sells a whole tray of plantain chips in one jam.',
  'Nima barber cuts fade in nine minutes. Rivals demand a recount.',
  'Pure water seller at Kaneshie First Light quotes three prices before 7 AM.',
  'Jamestown fisherman returns with a tuna so big it gets its own Instagram page.',
  'Waakye queue at Auntie Muni\'s reaches the main road. Office workers form a WhatsApp group to hold places.',
  'Okada rider swears it is "just two minutes". Clock disagrees.',
  'Accra Mall escalator works all day. Shoppers ride it twice for luck.',
  'Legon student finishes assignment before deadline. Lecturer requests a medical report.',
  'Kantamanto trader finds designer jacket in a bale. Sells it for GH₵40 and dances.',
  'Chop bar announces light soup "with plenty meat". Inspectors find two pieces.',
  'Funeral at La draws a bigger crowd than the match at the stadium.',
  'Sankofa Hub founder pitches "Uber for fufu pounding". Investors say "eiii".',
  'Spintex Road clear at 5 PM. Drivers fear the end of the world.',
  'MoMo agent gets network on the first try. Queue claps.',
  'Bukom boxer wins by knockout, then sings in the ring until the lights go off.',
  'Rain falls for twenty minutes. Kwame Nkrumah Avenue becomes a river with a current.',
];
const TIPS = [
  'Keep your money in MoMo. Trotro pickpockets love cash pockets.',
  'Dumsor timetable is in your HUD. Charge up and plan your evening.',
  'Okada beats the go-slow, but hold tight: the junctions bite.',
  'Bolt surges in rush hour (6:30–9:30 and 16:30–19:30). Trotro is cheaper and slower.',
  'Eat before your hunger bar goes red, or Ridge Hospital will bill you.',
  'Check on your businesses every few days or the managers will "chop" the profit.',
  'Register your land before landguards visit. They don\'t knock.',
  'Today\'s missions reset at midnight. Finish all three to keep your streak.',
  'A streak saver protects one missed day. You earn one every 7-day chest.',
  'Waakye in the morning, kelewele at night: that\'s how Accra does it.',
  'Gigs pay less when you repeat them all day. Mix your hustles.',
  'Sleep at home on a good bed and you wake up with more energy.',
];
// Accra's seasons (docs/accra-facts.json: climate). Index by UTC month 0–11.
const SEASONS = [
  { name: 'Harmattan', sky: ['Dusty harmattan haze', 'Dry and hazy, cool morning', 'Harmattan dust, dry lips weather'], hi: [31, 33] },
  { name: 'Harmattan', sky: ['Hazy and hot', 'Dry harmattan wind', 'Sunny with a dusty sky'], hi: [32, 33] },
  { name: 'Hot season', sky: ['Scorching sun', 'Hot and humid', 'Sunny, sticky afternoon'], hi: [32, 34] },
  { name: 'Major rains', sky: ['Afternoon thunderstorm', 'Humid with evening showers', 'Hot, then a heavy downpour'], hi: [31, 32] },
  { name: 'Major rains', sky: ['Heavy rain, gutters overflowing', 'Cloudy with downpours', 'Storm clouds over the sea'], hi: [30, 31] },
  { name: 'Major rains', sky: ['Grey and rainy', 'Heavy showers, roads flooding', 'Cool and wet'], hi: [28, 29] },
  { name: 'Short dry spell', sky: ['Cloudy and breezy', 'Cool sea breeze', 'Overcast, no rain'], hi: [27, 28] },
  { name: 'Short dry spell', sky: ['Cool and cloudy', 'Breezy, grey sky', 'Mild and dry'], hi: [27, 28] },
  { name: 'Minor rains', sky: ['Light showers', 'Cloudy with a drizzle', 'Warm with passing rain'], hi: [28, 29] },
  { name: 'Minor rains', sky: ['Afternoon shower', 'Humid, scattered rain', 'Sunny then a quick shower'], hi: [29, 30] },
  { name: 'Minor rains', sky: ['Warm and humid', 'Late shower', 'Sunny and sticky'], hi: [30, 31] },
  { name: 'Harmattan', sky: ['First harmattan haze', 'Dry, dusty and festive', 'Hazy sunshine'], hi: [31, 32] },
];
// Fixed-date occasions only; moon-dependent and movable dates are left out on purpose.
const OCCASIONS = {
  '1-1': 'New Year\'s Day. Accra is sleeping off last night.', '1-7': 'Constitution Day. Public holiday.',
  '3-6': 'Independence Day. Parade at Black Star Square, flags everywhere.', '5-1': 'Labour Day. Workers march, offices rest.',
  '5-25': 'Africa Union Day.', '7-1': 'Republic Day. Public holiday.', '9-21': 'Founders\' Day. Remember Kwame Nkrumah.',
  '12-24': 'Christmas Eve. Detty December is at full volume.', '12-25': 'Christmas Day. Rice, chicken and family.',
  '12-26': 'Boxing Day. Beach day at Labadi.', '12-31': 'Watch-night. Churches full, fireworks at midnight.',
};
const pick = (list, seed) => list[Math.abs(seed) % list.length];
function farmersDay(d) { return d.getUTCMonth() === 11 && d.getUTCDay() === 5 && d.getUTCDate() <= 7; }
export function occasionOf(now) {
  const d = new Date(now), key = `${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
  if (farmersDay(d)) return 'National Farmers\' Day. Respect to everyone who feeds Accra.';
  if (OCCASIONS[key]) return OCCASIONS[key];
  if (d.getUTCMonth() === 11) return 'Detty December: the city is full and the parties don\'t stop.';
  if (d.getUTCMonth() === 7 && d.getUTCDay() === 6) return 'August Saturday: Jamestown is painting the streets for Chale Wote season.';
  return null;
}
export function paper(now = Date.now()) {
  const day = Math.floor(now / 86400000), d = new Date(now), m = SEASONS[d.getUTCMonth()];
  const hi = m.hi[0] + (day % (m.hi[1] - m.hi[0] + 1));
  return { day, date: d.toISOString().slice(0, 10), headline: pick(HEADLINES, day * 7 + 3), tip: pick(TIPS, day * 5 + 1),
    weather: { season: m.name, sky: pick(m.sky, day), high: hi }, occasion: occasionOf(now) };
}
export const PAPER_SIZES = { headlines: HEADLINES.length, tips: TIPS.length };
