#!/usr/bin/env node
'use strict';

// ═══════════════════════════════════════════════════════════════
// Migrate HoboStreamer Users → Hobo.Tools
//
// Creates hobo.tools accounts for all real HoboStreamer users,
// sets up linked_accounts on BOTH sides, and prepares for
// SSO-only authentication on HoboStreamer.
//
// Usage:
//   node scripts/migrate-users-to-hobotools.js [--dry-run] [--force]
// ═══════════════════════════════════════════════════════════════

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ── CLI Flags ────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

// ── Default migration password (bcrypt hashed) ──────────────
// Users will need to change this on hobo.tools after migration.
// For SSO users with $sso$ placeholders, this gives them a
// working password to log in and change it.
const MIGRATION_PASSWORD = 'hobo2026';
const MIGRATION_HASH = bcrypt.hashSync(MIGRATION_PASSWORD, 10);

// ── Path Resolution ──────────────────────────────────────────
const MONOREPO_ROOT = path.resolve(__dirname, '..');
const isProduction = fs.existsSync('/opt/hobostreamer/data/hobostreamer.db');

const PATHS = {
    hobostreamer: isProduction
        ? '/opt/hobostreamer/data/hobostreamer.db'
        : path.join(MONOREPO_ROOT, 'hobostreamer/data/hobostreamer.db'),
    hobotools: isProduction
        ? '/opt/hobo/hobo-tools/data/hobo-tools.db'
        : path.join(MONOREPO_ROOT, 'hobo-tools/data/hobo-tools.db'),
};

// ── Logging ──────────────────────────────────────────────────
const stats = {
    total_users: 0,
    skipped_anon: 0,
    already_exists: 0,
    created: 0,
    linked_hobotools: 0,
    linked_hobostreamer: 0,
    errors: 0,
};

function log(msg) { console.log(`[migrate] ${msg}`); }
function warn(msg) { console.warn(`[migrate] ⚠️  ${msg}`); }

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

function main() {
    log('═══════════════════════════════════════════════');
    log('  HoboStreamer → Hobo.Tools User Migration');
    log('═══════════════════════════════════════════════');
    if (DRY_RUN) log('  *** DRY RUN — no changes will be written ***');
    log('');

    // Validate paths
    for (const [name, p] of Object.entries(PATHS)) {
        if (!fs.existsSync(p)) {
            console.error(`[migrate] ❌ Database not found: ${name} → ${p}`);
            process.exit(1);
        }
        log(`  ${name}: ${p}`);
    }
    log('');

    const src = new Database(PATHS.hobostreamer, { readonly: true });
    const dst = new Database(PATHS.hobotools);

    // Enable WAL for performance
    dst.pragma('journal_mode = WAL');

    // Fetch all hobostreamer users
    const srcUsers = src.prepare('SELECT * FROM users ORDER BY id ASC').all();
    stats.total_users = srcUsers.length;
    log(`Found ${srcUsers.length} HoboStreamer users`);

    // Prepare hobo.tools statements
    const checkByUsername = dst.prepare('SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)');
    const checkByLegacy = dst.prepare("SELECT id FROM users WHERE legacy_source = 'hobostreamer' AND legacy_id = ?");

    const insertUser = dst.prepare(`
        INSERT INTO users (username, email, password_hash, display_name, avatar_url, bio, role, profile_color,
                           is_banned, ban_reason, legacy_source, legacy_id, created_at, updated_at, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'hobostreamer', ?, ?, ?, ?)
    `);

    const insertPrefs = dst.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)');

    // Linked accounts on hobo.tools side (service='hobostreamer')
    const insertLinkOnTools = dst.prepare(`
        INSERT OR IGNORE INTO linked_accounts (user_id, service, service_user_id, service_username)
        VALUES (?, 'hobostreamer', ?, ?)
    `);

    // Linked accounts on hobostreamer side (service='hobotools')
    const checkLinkOnStreamer = src.prepare
        ? null  // src is readonly, we'll use a separate writable connection
        : null;

    // We need a writable connection to hobostreamer for linked_accounts
    const srcWrite = DRY_RUN ? null : new Database(PATHS.hobostreamer);
    const insertLinkOnStreamer = srcWrite?.prepare(`
        INSERT OR IGNORE INTO linked_accounts (user_id, service, service_user_id, service_username)
        VALUES (?, 'hobotools', ?, ?)
    `);
    const checkExistingLink = srcWrite?.prepare(
        "SELECT id FROM linked_accounts WHERE user_id = ? AND service = 'hobotools'"
    );

    // ── Migration Transaction ────────────────────────────────
    const migrate = dst.transaction(() => {
        for (const u of srcUsers) {
            // Skip internal game anon accounts
            if (u.username && u.username.startsWith('__game_')) {
                stats.skipped_anon++;
                continue;
            }

            // Already migrated? (check by legacy_id)
            const existingByLegacy = checkByLegacy.get(u.id);
            if (existingByLegacy) {
                log(`  [skip] ${u.username} — already migrated (hobo.tools id: ${existingByLegacy.id})`);
                // Ensure linked_accounts exist on hobostreamer side
                if (!DRY_RUN && insertLinkOnStreamer) {
                    const existing = checkExistingLink.get(u.id);
                    if (!existing) {
                        insertLinkOnStreamer.run(u.id, String(existingByLegacy.id), u.username);
                        stats.linked_hobostreamer++;
                    }
                }
                stats.already_exists++;
                continue;
            }

            // Username conflict with existing hobo.tools user?
            const conflict = checkByUsername.get(u.username);
            let hoboToolsId;

            if (conflict) {
                // User already exists on hobo.tools — just link
                hoboToolsId = conflict.id;
                log(`  [link] ${u.username} — already on hobo.tools (id: ${hoboToolsId}), linking`);

                if (!DRY_RUN) {
                    insertLinkOnTools.run(hoboToolsId, String(u.id), u.username);
                }
                stats.linked_hobotools++;
            } else {
                // Create new hobo.tools user
                // Use migration password for all users (they'll change on first login)
                const passwordHash = MIGRATION_HASH;
                const role = ['user', 'streamer', 'global_mod', 'admin'].includes(u.role) ? u.role : 'user';

                if (!DRY_RUN) {
                    const result = insertUser.run(
                        u.username,
                        u.email || null,
                        passwordHash,
                        u.display_name || u.username,
                        u.avatar_url || null,
                        u.bio || '',
                        role,
                        u.profile_color || '#c0965c',
                        u.is_banned || 0,
                        u.ban_reason || null,
                        u.id,           // legacy_id
                        u.created_at,
                        u.updated_at,
                        u.last_seen
                    );
                    hoboToolsId = result.lastInsertRowid;

                    // Create default preferences
                    insertPrefs.run(hoboToolsId);

                    // Link on hobo.tools side
                    insertLinkOnTools.run(hoboToolsId, String(u.id), u.username);
                } else {
                    hoboToolsId = 10000 + stats.created; // fake ID for dry run
                }

                stats.created++;
                stats.linked_hobotools++;
                log(`  [new] ${u.username} → hobo.tools id: ${hoboToolsId} (role: ${u.role})`);
            }

            // Create linked_accounts on hobostreamer side
            if (!DRY_RUN && insertLinkOnStreamer && hoboToolsId) {
                const existing = checkExistingLink.get(u.id);
                if (!existing) {
                    insertLinkOnStreamer.run(u.id, String(hoboToolsId), u.username);
                    stats.linked_hobostreamer++;
                }
            }
        }
    });

    migrate();

    // ── Summary ──────────────────────────────────────────────
    log('');
    log('═══════════════════════════════════════════════');
    log('  Migration Summary');
    log('═══════════════════════════════════════════════');
    log(`  Total HoboStreamer users:   ${stats.total_users}`);
    log(`  Skipped (__game_anon*):     ${stats.skipped_anon}`);
    log(`  Already migrated:           ${stats.already_exists}`);
    log(`  Created on hobo.tools:      ${stats.created}`);
    log(`  Linked (hobo.tools side):   ${stats.linked_hobotools}`);
    log(`  Linked (hobostreamer side): ${stats.linked_hobostreamer}`);
    log(`  Errors:                     ${stats.errors}`);
    log('');
    if (stats.created > 0) {
        log(`  ⚠️  Migrated users have temporary password: "${MIGRATION_PASSWORD}"`);
        log('     They should change it on hobo.tools after first login.');
    }
    if (DRY_RUN) {
        log('  *** DRY RUN — no changes were written ***');
        log('  Run without --dry-run to apply changes.');
    } else {
        log('  ✅ Migration complete!');
    }

    src.close();
    dst.close();
    if (srcWrite) srcWrite.close();
}

// ── Confirmation ─────────────────────────────────────────────
if (!FORCE && !DRY_RUN) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('[migrate] This will modify BOTH databases. Continue? (y/N) ', (answer) => {
        rl.close();
        if (answer.toLowerCase() === 'y') {
            main();
        } else {
            log('Aborted.');
        }
    });
} else {
    main();
}
