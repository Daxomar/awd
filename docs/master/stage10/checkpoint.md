# Stage 10 — advertising, music promotion and standalone checkout

Local implementation and browser acceptance pass (simulated Paystack on a loopback QA server). Exact-commit CI
pending. No live Paystack key was used or enabled; no real money moved.

## Completed
- **Standalone page restored** (`client/public/advertise.html`): billboards and ground panels with price and
  availability, billboard and ground previews, campaign type (business, music release, album, event, fashion,
  creator, community), artwork upload with client and server validation, destination link policy, Ghana phone
  (contact only), receipt email, duration, rights confirmation, checkout, verified return status, campaign
  management (resume/retry/cancel) and estimated reporting. The phone "Advertise" app and in-world "Advertise
  here" boards are now shortcuts to this page.
- **Checkout return**: the server-controlled Paystack callback returns ads to `/advertise.html` (top-ups still
  return to the game). The redirect is never proof: the page asks the server, which verifies with the provider.
  PostgreSQL attempts, signed webhooks, independent verification and reconciliation are unchanged.
- **Automatic activation**: on verified payment, campaigns that pass every automated check go live in the same
  transaction (exclusive boards start after the current booking). Checks: PNG/JPEG/WebP only, ≥600×300, ≤4 MB,
  ≤10 MP, server decode and re-encode, word filter on the name, https-only links with no shorteners, raw IPs,
  logins or ports, an allowlist (streaming, social, WhatsApp, events, maps) for automatic activation, sensitive
  topics held, rate limits (5 bookings/IP/hour, 3 unpaid per account), ownership, placement reservation.
  Anything not cleared waits in a disclosed moderator review with the reason shown. Admins can approve, suspend
  or reject (`/admin.html`). Late payments, expired reservations and duplicate charges go to review as before.
- **Propagation**: activations and suspensions broadcast `ads_changed`; players' boards refresh within seconds.
- **Billboard visibility**: enlarged boards and more placements were already shipped in 281d7ee (other session);
  the house board now points to the advertising page.
- **QA mock provider** (`PAYSTACK_MOCK=1`): refused unless the public origin is loopback and no real key exists.

## Files
Server: `src/ads.js`, `src/payments.js`, `src/index.js`, `src/security.js` (CRLF-safe CSP hashes),
`loadtest/ads-integration.js`, `loadtest/ads-vetting.test.js` (new), `loadtest/security.test.js`, `package.json`.
Client: `public/advertise.html`, `public/admin.html`, `src/v2/main.js`, `src/v2/phone/advertising.js`,
`src/v2/phone/apps.js`, `src/v2/scene/city/ads.js`. Tools: `tools/advertise-browser-test.py`.

## Database
Additive columns `ad_orders.category`, `ad_orders.review`.

## Tests
Server `npm test` 104/104; client 90/90 and build; ads integration 11/11; payments integration pass;
journey H 14/14 (page, validation, contrast, mock checkout, verified return, automatic activation, in-game
refresh, signed-webhook fulfilment, disclosed review, cancelled checkout, phone shortcut, no page errors).

## Fixed during the stage
CSP hash mismatch for CRLF files; reused purchase key after a paid booking; return check giving up on 429;
the old manual-approval test now asserts automatic activation (owner request).

## Limitations / approvals
- Image content cannot be judged automatically; moderators and reports remain the safeguard.
- Live Paystack needs the owner's key and approval (not enabled). Phone FPS not measured.
