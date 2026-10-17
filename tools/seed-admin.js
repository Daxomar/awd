#!/usr/bin/env node
// Root wrapper to seed an administrator user into the Accra We Dey database.
// Usage:
//   node tools/seed-admin.js [--username <name>] [--password <pass>] [--role <role>] [--db <url>]
//   DATABASE_URL="postgres://..." node tools/seed-admin.js

import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverScript = path.resolve(__dirname, '../server/seed-admin.js');

// Dynamically import and run server/seed-admin.js using file:// URL for cross-platform compatibility
import(pathToFileURL(serverScript).href);
