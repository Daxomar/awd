# Stage G: optional milestones

Twelve stable definitions in `server/src/objectives.js` cover local streets, meals, markets, journeys, social hubs, player interaction, private messaging, the first-friend exchange, paid work, appearance changes, two districts and returning home. Existing aspirations remain separate and available. No script, forced order, daily reward, streak or cash faucet. The map-open example is intentionally omitted: a browser's assertion that it displayed a screen is not authoritative evidence of exploration.

Server `goPlace` records public visits and actual return home in additive saved `discovery` data; only existing server destinations qualify. Existing authoritative meal/shift counters and action/social/DM/outfit events supply progress. The social introduction uses `intro_completions`, never a client-sent completion flag. A saved appearance must actually change. Old players can receive credit for existing valid counters/ownership history where supported; no balances or birth odds are rewritten. The first-week introduction objective is hidden when ineligible unless previously completed.

Definitions, progress and claim records are PostgreSQL-backed. Sync and claim use the existing account-money transaction boundary to persist game state with the objective ledger. Unique account/objective reward keys plus conditional claims prevent duplicate XP or badge issuance. Rewards are 15–25 XP and three milestone badges; no recurring claims, cosmetic purchase bypass or automatic cash. A reconnect retains completed/claimed milestones.

The HUD shows one compact optional suggestion linking to Phone → Milestones. The phone shows every eligible milestone, its real requirement, reward, progress, claim and next action. Any order is permitted. Existing normal gameplay and aspirations remain available while a milestone is incomplete. There are no completion popups.

Additive tables: `objective_definitions`, `player_objectives`, `objective_rewards`. Retain progress/reward ledgers during application rollback; no destructive migration is automated.
