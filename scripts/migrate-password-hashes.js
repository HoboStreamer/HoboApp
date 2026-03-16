#!/usr/bin/env node
'use strict';

// ═══════════════════════════════════════════════════════════════
// Copy real bcrypt password hashes from HoboStreamer → Hobo.Tools
//
// The initial migration set placeholder 'hobo2026' passwords.
// This script copies the actual bcrypt hashes so users can
// log in with their original HoboStreamer passwords.
//
// Usage:
//   node scripts/migrate-password-hashes.js [--dry-run]
// ═══════════════════════════════════════════════════════════════

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DRY_RUN = process.argv.includes('--dry-run');

// ── Resolve DB paths ─────────────────────────────────────────
function resolveDb(prodPath, devPath) {
    if (fs.existsSync(prodPath)) return prodPath;
    const resolved = path.resolve(__dirname, '..', devPath);
    if (fs.existsSync(resolved)) return resolved;
    throw new Error(`DB not found at ${prodPath} or ${resolved}`);
}

const hsPath = resolveDb('/opt/hobostreamer/data/hobostreamer.db', 'hobostreamer/data/hobostreamer.db');
const htPath = resolveDb('/opt/hobo/hobo-tools/data/hobo-tools.db', 'hobo-tools/data/hobo-tools.db');

console.log(`[pw-migrate] HoboStreamer DB: ${hsPath}`);
console.log(`[pw-migrate] Hobo.Tools DB:   ${htPath}`);
if (DRY_RUN) console.log(`[pw-migrate] *** DRY RUN ***\n`);

const hsDb = new Database(hsPath, { readonly: true });
const htDb = new Database(htPath, { readonly: DRY_RUN });

// Get all linked accounts (hobostreamer user_id → hobo.tools service_user_id)
const links = htDb.prepare(
    "SELECT user_id AS ht_id, service_user_id AS hs_id FROM linked_accounts WHERE service = 'hobostreamer'"
).all();

console.log(`[pw-migrate] Found ${links.length} linked accounts\n`);

let updated = 0;
let skipped = 0;
let errors = 0;

const updateStmt = DRY_RUN ? null : htDb.prepare(
    'UPDATE users SET password_hash = ? WHERE id = ?'
);

for (const link of links) {
    const hsUser = hsDb.prepare('SELECT username, password_hash FROM users WHERE id = ?').get(link.hs_id);
    if (!hsUser) {
        console.log(`  [skip] hobo.tools id ${link.ht_id} — hobostreamer id ${link.hs_id} not found`);
        skipped++;
        continue;
    }

    // Only copy real bcrypt hashes (skip $sso$ placeholders)
    if (!hsUser.password_hash || !hsUser.password_hash.startsWith('$2')) {
        console.log(`  [skip] ${hsUser.username} — no real password hash (${(hsUser.password_hash || '').substring(0, 10)}...)`);
        skipped++;
        continue;
    }

    if (!DRY_RUN) {
        updateStmt.run(hsUser.password_hash, link.ht_id);
    }
    console.log(`  [ok] ${hsUser.username} (ht:${link.ht_id} ← hs:${link.hs_id}) — hash copied`);
    updated++;
}

console.log(`\n[pw-migrate] Done: ${updated} updated, ${skipped} skipped, ${errors} errors`);
if (DRY_RUN) console.log(`[pw-migrate] *** DRY RUN — no changes written ***`);

hsDb.close();
htDb.close();
