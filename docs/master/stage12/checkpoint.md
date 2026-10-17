# Stage 12 — multiplayer, economy, performance and release readiness (IN PROGRESS)

This is a progress checkpoint, not a completion claim. Stage 12 is not complete: several browser journeys still
fail, the performance diagnostics have not been run, and the release gates for real money are open. Nothing was
deployed. No balance, salary, price, birth amount or odds changed.

## Done so far
- **Economy (12.2)**: `server/loadtest/stage12-economy.mjs` models 2,400 players (Hustler/Dbee × employment,
  business, social, mixed, casual, auto-work; 90 days) on the live catalogue. Report and approval-ready proposal:
  [economy-report.md](economy-report.md). Key findings: a working Hustler gains slowly (+GH₵76/week; +GH₵181 with
  a stall); business-only, social and casual Hustlers miss rent; Dbee players lose GH₵1,200–1,800/week to Osu rent.
  Proposals P1–P2 change money and need approval; P3–P5 are guidance only.
- **Adaptive graphics (12.3)**: Settings → Graphics (Auto, Battery saver, Balanced, Sharp) controls pixel ratio,
  shadows and the street crowd; in Auto a frame-time governor steps quality down on slow devices
  (`client/src/v2/scene/quality.js`, 4 unit tests).
- **Onboarding fix**: brand-new players get 30 minutes before any random life event (one was covering the HUD
  before the first home was claimed). QA fixtures also quiet random events for journeys about other features.
- **Accessibility fix (12.6)**: objective HUD buttons raised from 36 px to the 44 px touch-target minimum (found by
  the five-viewport layout test).
- **Privacy and moderation (12.8)**: `/privacy.html` (linked from sign-up, Settings and the advertising page)
  describes what is kept, why, for how long and who can see it, plus the community rules. Retention added for
  day-level activity rows (about 13 months).
- **Release gates**: [release-gates.md](release-gates.md) — real-money, privacy, security, multiplayer,
  performance and resilience status with evidence. Merchant configuration, refund policy and legal review are open.
- **Tests repaired**: `security-e2e.js` advert block (stale since Stage 10 sign-in requirement),
  `master-hud-layout-test.py` selector (stale since Stage 6), career journey now picks a career that works on the
  current day (Tech has no weekend shifts).
- **Release sweep**: `tools/release-sweep.py` runs every journey with fresh fixtures and its documented QA setup;
  results in [sweep.json](sweep.json).

## Verification
- Server `npm test` 112/112, client `npm test` 94/94, production build passes.
- PostgreSQL integrations all pass: payments, ads, First Friend, objectives, events, life, property DB, vehicle DB;
  admin integration 46/46; security-e2e passes without the optional key block (updated block not yet re-run).
- Browser journeys passing in the latest sweep: world views, life events (I), ambient street life and frontage (J),
  advertising (K), community event (L), admin security (M), trading, shared activities and housing under reconnect
  (N), Dbee progression (O).

## Not done
- Journeys still failing: property (D) and vehicle (E) time out in the travel/arrival step after the purchase and
  sale checks pass; camera (H) times out entering the street; business reconnect (J) needs to run straight after
  commerce (sweep order fixed, not re-run); meet (A/F/G) hit a Windows file lock saving a screenshot; career (B/C)
  and HUD layout need a re-run with today's fixes. Root cause of the travel timeouts not yet found (possibly slow
  scene loading under software rendering on this 8 GB machine).
- Performance diagnostics (`tools/perf-diagnostics.py`) written but not run; no phone FPS measured.
- Docker stack not verified locally (Docker Desktop would not start); CI builds and smoke-tests it on push.
- The Blender world and map overhaul (landmark models) is a separate later task; its draft script is not part of
  this commit.

## Approval needed
Economy proposals P1 (salary floor) and P2 (offline meals); live Paystack key and merchant setup; refund policy;
legal review of the privacy page; earlier pending items (Stage 5 salaries, Stage 7 event XP, property prices).
