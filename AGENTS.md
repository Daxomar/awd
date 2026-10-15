# Accra We Dey project instructions

Continue the existing portrait mobile browser game. Preserve saved player data,
working phone apps, locations, multiplayer and security controls. Budget: GH₵0.
Use commercially compatible free assets and record their source and licence.

## Architecture and entry points

- `client/src/v2/main.js`: Three.js scene, UI, room and network lifecycle.
- `client/src/v2/scene/`: editable human avatars, rooms, map, navigation, lighting.
- `client/src/v2/ui/` and `phone/`: DOM UI; plain ES modules, no React framework.
- `server/src/index.js`: uWebSockets HTTP/WebSocket entry, security and startup.
- `server/src/shard.js`: room presence, synchronization and live player lifecycle.
- `server/src/game/`: authoritative progression, economy, wardrobe and content.
- `server/src/db.js`, `social.js`, `account-money.js`: PostgreSQL persistence and transactions.
- `docs/immersive-world-audit.md`: verified findings and phased implementation roadmap.

## Development and verification

- Client: `cd client`, `npm run dev` or `npm run build`; unit checks: `npm test`.
- Server: `cd server`, `npm test`; native start: `npm start` with explicit DB/Redis configuration.
- Runtime stack: see `docs/deployment.md`; do not commit `.env`, `.secrets`, `.local` or dumps.
- Character pipeline QA: Vite on 5173, then `python tools/character-integrity-test.py` from root.
- Browser QA uses disposable local accounts. Production requires cookie auth;
  older token-based browser helpers need explicit development mode and are not production checks.
- Check model changes in the actual game as well as the character harness.
- Never claim phone FPS from software-rendered desktop automation.

## Implementation conventions

- Keep currency, inventory, property and outcomes server controlled.
- Preserve look field names and bounds, birth probabilities and saved balances unless a reviewed change is requested.
- Respect shared geometry/material ownership; removing one avatar must not dispose another's resources.
- Keep changes modular; pair behavioral fixes with meaningful regression tests.
- The user has authorized committing and pushing validated work to `origin`
  (`https://github.com/Daxomar/awd.git`). Fetch/check history before pushing; never force-push.
- Explicit user approval is required before production deployment, destructive data changes,
  major system removal, architecture migration, monetization changes or saved-data incompatibility.
