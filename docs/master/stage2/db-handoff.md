# Stage 2 PostgreSQL integration handoff

Owner: `stage1_review`. Scope: `server/loadtest/property-db.test.js` and this file.
Backend, client, character production and release integration belong to other owners.

The suite refuses production mode, non-loopback hosts and database names without
the `_security` suffix. It creates a fresh randomly named schema, sets its search
path before importing the game pool, and asserts the pool uses that schema. It
does not touch the regular `awd` database or mutate previous fixture catalogues.
Schemas are retained for diagnostics rather than recursively dropped.

Run from `server` with an explicitly configured disposable loopback
`DATABASE_URL`, `NODE_ENV=test` and a disposable `BIRTH_SEED`:

```text
node loadtest/property-db.test.js
```

Fixture wallets and catalogue prices are explicit test inputs for adversarial
transactions, not changes to birth values, production prices or an economy
simulation. Assertions exercise `Life.handle` and the existing account
reservation/transaction/receipt path. Durable seller proceeds are claimed through
the existing `Social.claim` path. No payment provider or Redis service is needed.

Implementation and execution are in progress; no passing result is claimed yet.
