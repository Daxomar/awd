# Payments: Stage B

Official documentation checked 16 October 2026: [initialize transactions](https://paystack.com/docs/api/transaction/), [verification](https://paystack.com/docs/payments/verify-payments/), [webhooks](https://paystack.com/docs/payments/webhooks/), [Ghana mobile money](https://paystack.com/docs/payments/payment-channels/).

Both existing purchase types use `payment_orders` → `payment_attempts` → minimal `payment_events`. Legacy paid orders are backfilled as fulfilled without credits being replayed. Legacy IDs, artwork paths and references remain intact. New advertising purchases require a signed-in account. Existing unowned advertising stays available to owner moderation; never assign it to an arbitrary player.

Each purchase supplies a stable random key, persisted by the browser. A database advisory lock and unique key return the same order/reference/checkout link for retries. Initialization is claimed and committed before contacting Paystack. A timeout leaves the reference uncertain for reconciliation rather than creating another potentially chargeable reference. No browser success field is accepted. The signed expiring return token identifies a persisted context; the authenticated owner is checked before returning it. No caller controls a redirect URL.

Fulfillment locks the order and attempt and checks exact reference, integer pesewas, GHS, success and unique provider transaction ID. Wallet credits and fulfilled markers commit together. A second provider ID is retained in the event ledger and flagged for refund review. Weekly wallet caps still apply. Failed/mismatched/closed purchases cannot activate inventory. Ad payment is separate from moderation/activation.

The raw SHA512-authenticated webhook triggers independent verification. Unavailable verification returns retryable failure; the runtime worker scans unresolved payments every minute with a ten-minute per-reference interval. `node reconcile-payments.js` is the manual alternative. Keep orders/attempts while reconciling; never erase an uncertain charge. Provider payloads, phone numbers, card details and secret keys are excluded from the payment event ledger and logs.

## Ghana checkout and receipts

Reconciliation also checks unresolved older attempts on fulfilled orders. A late
success therefore enters review even if its webhook and browser return are both
missing. Review attempts stop automatic processing; operators must investigate
and refund through the provider where appropriate, preserving the ledger.

Hosted checkout offers `mobile_money` and `card`; Paystack collects the actual wallet number and customer authorization. A number typed into the game is a contact/validation convenience, never permission to charge and never a substitute for the supported charge API's `mobile_money` instrument. Checkout initialization requires a customer receipt email. We retain this instead of silently replacing it with an administrative email. Customer confirmations remain enabled. The game does not initiate direct phone charges.

Optional `PAYMENT_ADMIN_EMAIL` adds a backend-only administrative receipt outbox entry on fulfillment. It is not sent to browser UI, does not change Paystack's customer receipt address, and requires an operator-provided email delivery worker before administrative copies are sent. No mail service or billable dependency is added. A shared email alone cannot implement MoMo charging.

## Migration / rollback

Startup runs additive `CREATE IF NOT EXISTS` and conflict-safe legacy backfills after legacy ads/social tables exist. New tables: `payment_orders`, `payment_attempts`, `payment_events`, `payment_receipt_outbox`. No historical balance mutation. Application rollback retains these tables and references. Do not drop a ledger with pending/paid attempts. A destructive table-drop rollback is intentionally not automated. Back up and review schema in staging before production; this milestone is local only.

Confirmed failed/abandoned provider attempts may be retried on the **same order**, with a new persistent attempt/reference and one initialization claim. Uncertain initialization never creates a new reference automatically. Late successes from an older attempt are recorded and flagged for refund review if another attempt already fulfilled the order. Verification observations with different amount/currency/status retain separate event facts; a later success does not relabel an earlier mismatch as fulfilled. Numeric provider IDs outside JavaScript’s safe integer range are held for review; exact digit strings remain supported. Database connections are released before external initialization calls.
