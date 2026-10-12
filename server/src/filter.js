// Chat / social moderation. 18+ game: swearing is allowed; slurs are masked.
// Hard-blocked (never delivered): sexual solicitation & image requests, anything sexual involving minors,
// "send me money and I'll double it" scams, and real-money trading of game cash. Off-platform contact is hidden
// (links, phone numbers, Snap/TikTok/IG/WhatsApp handles) because that is where scams and exploitation move.
const SLURS = ['nigga', 'nigger', 'faggot', 'retard', 'kwasia', 'gyimi'];
const SLUR_RE = SLURS.map((w) => new RegExp(w, 'gi'));
// normalise leetspeak / separators so "n.u.d.e", "nud3", "n*des" still match
const norm = (t) => t.toLowerCase().replace(/[0@]/g, 'o').replace(/3/g, 'e').replace(/[1!|]/g, 'i').replace(/\$/g, 's').replace(/4/g, 'a').replace(/[*._\-~]/g, '');
const BLOCK = [
  ['sexual', /\b(nudes?|noodles|nood|naked|nakd|sext|sexting|horny|hornie|naughty\s*(talk|chat|pic|vid)|sex\s*(chat|video|pic|tape)|boobs?|tits|dick\s*pic|pussy\s*pic|onlyfans|hookup|hook\s*up|sugar\s*(daddy|mummy|mommy)\s*(dm|needed|wanted)|pet\s*daughter|sleep\s*with\s*me)\b/],
  ['sexual', /\b(send|drop|share|show)\b.{0,20}\b(pic|pics|picture|video|vid|body|backside|yansh)\b.{0,25}\b(dm|snap|private|naked|without|nothing)\b/],
  ['sexual', /\b(send|drop|share|show)\b.{0,15}\bn[ou]?des?\b|\b(pic|pics|video|vid)\b.{0,25}\b(females?|girls?|ladies)\s*only\b/],
  ['minor', /\b(1[0-7]|[5-9])\s*(yo|yrs?|years?\s*old)\b.{0,40}\b(sex|dm|date|naughty|girl|boy|pics?)\b|\b(underage|under\s*age|minor|jss|shs\s*girl|school\s*girl|schoolgirl)\b.{0,30}\b(sex|dm|date|naughty|pics?)\b/],
  ['scam', /\b(double|triple)\s*(it|your|ur|am)\b|\bsend\b.{0,25}\b(what\s*you\s*have|any\s*amount|and\s*(i'?ll|i\s*will|ill)\s*(double|send\s*back))\b|\bgiveaway\b.{0,30}\bsend\b|\binvest\b.{0,20}\b(\d+x|double)\b/],
  ['rmt', /\b(sell|selling|buy|buying)\b.{0,40}\b(game\s*money|in\s*game|ingame|cedis?|₵|ghc|coins|cash)\b.{0,40}\b(real|momo|mobile\s*money|irl|for\s*\d)/],
];
const HANDLE = /\b(snap(chat)?|sc|tiktok|tt|insta(gram)?|ig|whats\s*app|wa|telegram|tg|x\.com|twitter|facebook|fb)\b\s*[:@-]?\s*@?[a-z0-9_.]{3,}|@[a-z0-9_.]{4,}\b/gi;
export function moderate(t, max = 140) {
  t = String(t || '').replace(/[\u0000-\u001f\u200b-\u200f\u2028-\u202f\ufeff]/g, '').slice(0, max);
  const n = norm(t).replace(/\s+/g, ' '), raw = t.toLowerCase().replace(/[*._~]/g, '').replace(/\s+/g, ' ');
  for (const [why, re] of BLOCK) if (re.test(n) || re.test(raw)) return { text: '', blocked: why };
  t = t.replace(/https?:\/\/\S+|www\.\S+|\S+\.(com|gh|net|org|io|me|ly|link|app)\b\S*/gi, '[link hidden]');
  t = t.replace(/(\+?\d[\d\s-]{6,}\d)/g, '[number hidden]');
  t = t.replace(HANDLE, '[contact hidden]');
  for (const re of SLUR_RE) t = t.replace(re, (m) => m[0] + '*'.repeat(Math.max(1, m.length - 1)));
  return { text: t.trim(), blocked: null };
}
// legacy helper used for names/titles: never blocks, just cleans
export function cleanText(t, max = 140) { const r = moderate(t, max); return r.blocked ? '' : r.text; }
export const BLOCK_MSG = {
  sexual: 'Message blocked: sexual requests are not allowed in Accra We Dey.',
  minor: 'Message blocked and reported.',
  scam: 'Message blocked: "double your money" schemes are scams.',
  rmt: 'Message blocked: selling game money for real money is not allowed.',
};
