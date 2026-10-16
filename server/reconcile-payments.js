// Manual alternative to the runtime worker; requires the normal server secret/config.
import * as Ads from './src/ads.js';
import * as Social from './src/social.js';
import * as Payments from './src/payments.js';
import { pool } from './src/db.js';
Payments.registerPayment('ad',Ads.fulfillPayment);
Payments.registerPayment('topup',Social.fulfillPayment);
try { console.log(JSON.stringify(await Payments.reconcile(50))); } finally { await pool.end(); }
