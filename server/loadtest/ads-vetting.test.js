import test from 'node:test';
import assert from 'node:assert/strict';
import {vetLink, vetCampaign, CATEGORIES, LINK_ALLOWLIST} from '../src/ads.js';
import {MOCK} from '../src/payments.js';

test('destination links: https only, no shorteners, raw IPs, logins or ports; allowlisted hosts activate automatically', () => {
  assert.deepEqual(vetLink(''), {url: ''});
  for (const u of ['http://example.com', 'javascript:alert(1)', 'ftp://x.com/a', 'not a url']) assert.ok(vetLink(u).error, u);
  for (const u of ['https://bit.ly/x', 'https://tinyurl.com/abc', 'https://1.2.3.4/a', 'https://user:pw@open.spotify.com/x', 'https://open.spotify.com:8443/x', 'https://localhost/x']) assert.ok(vetLink(u).error, u);
  for (const u of ['https://open.spotify.com/track/1', 'https://www.youtube.com/watch?v=1', 'https://wa.me/233240000000', 'https://audiomack.com/a', 'https://m.facebook.com/page']) { const r = vetLink(u); assert.ok(r.url && !r.review && !r.error, u); }
  const other = vetLink('https://auntie-esi-waakye.com/menu');
  assert.ok(other.url && /moderator/.test(other.review), 'other websites are allowed but held for a moderator');
  assert.ok(LINK_ALLOWLIST.includes('boomplay.com'));
});

test('campaign checks: categories, respectful names, sensitive topics go to review, never silently activate', () => {
  assert.equal(Object.keys(CATEGORIES).length, 7);
  assert.ok(vetCampaign({title: 'New single', url: '', category: 'mixtape'}).error, 'unknown category');
  assert.deepEqual(vetCampaign({title: 'Kofi new single', url: 'https://open.spotify.com/t', category: 'music'}), {url: 'https://open.spotify.com/t', review: null, category: 'music'});
  // Sensitive topics are either refused by the word filter or held for a moderator; they never activate automatically.
  for (const title of ['Best betting odds in Accra', 'Crypto double your money', 'Herbal cure for everything']) { const r = vetCampaign({title, url: 'https://open.spotify.com/t', category: 'business'}); assert.ok(r.error || /sensitive/.test(r.review), title); }
  assert.match(vetCampaign({title: 'Waakye joint', url: 'https://waakye.example', category: 'business'}).review, /allowlist/);
  assert.equal(vetCampaign({title: 'Waakye joint', url: '', category: undefined}).category, 'business');
});

test('the simulated checkout can never be enabled without an explicit loopback QA setting', () => {
  assert.equal(MOCK, false);
});
