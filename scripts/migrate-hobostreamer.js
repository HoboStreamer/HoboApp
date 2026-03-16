#!/usr/bin/env node
'use strict';

// ═══════════════════════════════════════════════════════════════
// HoboStreamer → Hobo Network Migration Script
//
// Migrates user accounts, verification keys, game data, canvas
// data, and tags from HoboStreamer's monolithic database into the
// distributed Hobo Network architecture:
//   - Users + verification keys → hobo-tools (central SSO)
//   - Game + canvas + tags       → hobo-quest
//   - Streaming/chat/economy     → stays on hobostreamer (user_ids unchanged)
//
// Run: node scripts/migrate-hobostreamer.js [options]
//   --dry-run     Preview without writing
//   --data-dir    Override data directory (default: auto-detect)
//   --force       Skip confirmation prompt
// ═══════════════════════════════════════════════════════════════

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ── CLI Flags ────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const dataIdx = args.indexOf('--data-dir');
const DATA_DIR_OVERRIDE = dataIdx !== -1 ? args[dataIdx + 1] : null;

// ── Path Resolution ──────────────────────────────────────────
// Production:  /opt/hobostreamer/data/, /opt/hobo/hobo-tools/data/, /opt/hobo/hobo-quest/data/
// Development: relative from monorepo root
const MONOREPO_ROOT = path.resolve(__dirname, '..');
const isProduction = fs.existsSync('/opt/hobostreamer/data/hobostreamer.db');

const PATHS = {
    hobostreamer: isProduction
        ? '/opt/hobostreamer/data/hobostreamer.db'
        : path.join(MONOREPO_ROOT, 'hobostreamer/data/hobostreamer.db'),
    hobotools: isProduction
        ? '/opt/hobo/hobo-tools/data/hobo-tools.db'
        : path.join(MONOREPO_ROOT, 'hobo-tools/data/hobo-tools.db'),
    hoboquest: isProduction
        ? '/opt/hobo/hobo-quest/data/hobo-quest.db'
        : path.join(MONOREPO_ROOT, 'hobo-quest/data/hobo-quest.db'),
};

if (DATA_DIR_OVERRIDE) {
    PATHS.hobostreamer = path.join(DATA_DIR_OVERRIDE, 'hobostreamer.db');
    PATHS.hobotools = path.join(DATA_DIR_OVERRIDE, 'hobo-tools.db');
    PATHS.hoboquest = path.join(DATA_DIR_OVERRIDE, 'hobo-quest.db');
}

// ── Logging ──────────────────────────────────────────────────
const stats = {
    users_migrated: 0,
    users_skipped: 0,
    users_conflict: 0,
    vkeys_migrated: 0,
    vkeys_skipped: 0,
    linked_accounts: 0,
    game_tables: 0,
    game_rows: 0,
    canvas_tables: 0,
    canvas_rows: 0,
    tag_tables: 0,
    tag_rows: 0,
};

function log(msg) { console.log(`[migrate] ${msg}`); }
function warn(msg) { console.warn(`[migrate] ⚠️  ${msg}`); }
function err(msg) { console.error(`[migrate] ❌ ${msg}`); }

// ═══════════════════════════════════════════════════════════════
// Phase 1: Migrate Users → hobo-tools
// ═══════════════════════════════════════════════════════════════

function migrateUsers(src, dst) {
    log('Phase 1: Migrating users to hobo-tools...');

    const srcUsers = src.prepare('SELECT * FROM users ORDER BY id ASC').all();
    log(`  Found ${srcUsers.length} users in HoboStreamer`);

    // Build mapping: old HoboStreamer user_id → new hobo-tools user_id
    const idMap = new Map(); // oldId → newId

    const insertUser = dst.prepare(`
        INSERT INTO users (username, email, password_hash, display_name, avatar_url, bio, role, profile_color,
                           is_banned, ban_reason, token_valid_after, legacy_source, legacy_id, created_at, updated_at, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'hobostreamer', ?, ?, ?, ?)
    `);

    const insertPrefs = dst.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)');

    const insertLinked = dst.prepare(`
        INSERT OR IGNORE INTO linked_accounts (user_id, service, service_user_id, service_username)
        VALUES (?, 'hobostreamer', ?, ?)
    `);

    const checkExistingByLegacy = dst.prepare(
        "SELECT id FROM users WHERE legacy_source = 'hobostreamer' AND legacy_id = ?"
    );
    const checkExistingByUsername = dst.prepare(
        'SELECT id FROM users WHERE LOWER(username) = LOWER(?)'
    );

    const migrateTransaction = dst.transaction(() => {
        for (const u of srcUsers) {
            // Skip internal anon game users (__game_anon_*)
            if (u.username && u.username.startsWith('__game_')) {
                stats.users_skipped++;
                continue;
            }

            // Already migrated?
            const existing = checkExistingByLegacy.get(u.id);
            if (existing) {
                idMap.set(u.id, existing.id);
                stats.users_skipped++;
                continue;
            }

            // Username conflict with existing hobo-tools user?
            const conflict = checkExistingByUsername.get(u.username);
            if (conflict) {
                // Link the existing hobo-tools user to the hobostreamer account
                idMap.set(u.id, conflict.id);
                insertLinked.run(conflict.id, String(u.id), u.username);
                stats.users_conflict++;
                stats.linked_accounts++;
                warn(`Username "${u.username}" already exists in hobo-tools (id:${conflict.id}) — linked to HoboStreamer id:${u.id}`);
                continue;
            }

            // Map roles: hobostreamer uses same role values
            const role = ['user', 'streamer', 'global_mod', 'admin'].includes(u.role) ? u.role : 'user';

            if (!DRY_RUN) {
                const result = insertUser.run(
                    u.username,
                    u.email || null,
                    u.password_hash,
                    u.display_name || u.username,
                    u.avatar_url || null,
                    u.bio || '',
                    role,
                    u.profile_color || '#c0965c',
                    u.is_banned || 0,
                    u.ban_reason || null,
                    u.token_valid_after || null,
                    u.id,
                    u.created_at,
                    u.updated_at,
                    u.last_seen
                );
                const newId = result.lastInsertRowid;
                idMap.set(u.id, newId);

                // Create default preferences
                insertPrefs.run(newId);

                // Create linked account entry
                insertLinked.run(newId, String(u.id), u.username);
                stats.linked_accounts++;
            } else {
                // Dry run: simulate sequential IDs
                const fakeId = 10000 + stats.users_migrated;
                idMap.set(u.id, fakeId);
            }

            stats.users_migrated++;
        }
    });

    migrateTransaction();
    log(`  ✅ Users: ${stats.users_migrated} migrated, ${stats.users_skipped} skipped, ${stats.users_conflict} conflicts linked`);
    return idMap;
}

// ═══════════════════════════════════════════════════════════════
// Phase 2: Migrate Verification Keys → hobo-tools
// ═══════════════════════════════════════════════════════════════

function migrateVerificationKeys(src, dst, idMap) {
    log('Phase 2: Migrating verification keys to hobo-tools...');

    // Check if verification_keys table exists in source
    const tableExists = src.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='verification_keys'"
    ).get();
    if (!tableExists) {
        log('  No verification_keys table in HoboStreamer — skipping');
        return;
    }

    const keys = src.prepare('SELECT * FROM verification_keys ORDER BY id ASC').all();
    log(`  Found ${keys.length} verification keys`);

    const checkExisting = dst.prepare('SELECT id FROM verification_keys WHERE key = ?');
    const insertKey = dst.prepare(`
        INSERT INTO verification_keys (key, target_username, note, created_by, used_by, status, created_at, used_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const keyTransaction = dst.transaction(() => {
        for (const vk of keys) {
            if (checkExisting.get(vk.key)) {
                stats.vkeys_skipped++;
                continue;
            }

            const newCreatedBy = idMap.get(vk.created_by);
            const newUsedBy = vk.used_by ? idMap.get(vk.used_by) : null;

            if (!newCreatedBy) {
                warn(`Verification key ${vk.key}: created_by user ID ${vk.created_by} not found in mapping — skipping`);
                stats.vkeys_skipped++;
                continue;
            }

            if (!DRY_RUN) {
                insertKey.run(
                    vk.key,
                    vk.target_username,
                    vk.note || '',
                    newCreatedBy,
                    newUsedBy || null,
                    vk.status,
                    vk.created_at,
                    vk.used_at || null
                );
            }
            stats.vkeys_migrated++;
        }
    });

    keyTransaction();
    log(`  ✅ Verification keys: ${stats.vkeys_migrated} migrated, ${stats.vkeys_skipped} skipped`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 3: Migrate Game Data → hobo-quest
// ═══════════════════════════════════════════════════════════════

function migrateGameData(src, dst, idMap) {
    log('Phase 3: Migrating game data to hobo-quest...');

    // First, ensure hobo-quest has the proper game schema (matching HoboStreamer)
    ensureGameSchema(dst);

    // ── game_world_state (no user_id — just copy) ────────────
    copyTable(src, dst, 'game_world_state', null, idMap);

    // ── Game tables with user_id column ──────────────────────
    const userIdTables = [
        { name: 'game_players', idCol: 'user_id' },
        { name: 'game_inventory', idCol: 'user_id' },
        { name: 'game_bank', idCol: 'user_id' },
        { name: 'game_farm_plots', idCol: 'user_id' },
        { name: 'game_recipes', idCol: 'user_id' },
        { name: 'game_effects', idCol: 'user_id' },
        { name: 'game_battle_stats', idCol: 'user_id' },
        { name: 'game_dungeon_runs', idCol: 'user_id' },
        { name: 'game_fish_collection', idCol: 'user_id' },
        { name: 'game_daily_quest_progress', idCol: 'user_id' },
        { name: 'game_daily_quest_claims', idCol: 'user_id' },
        { name: 'game_achievements', idCol: 'user_id' },
    ];

    for (const t of userIdTables) {
        copyTable(src, dst, t.name, t.idCol, idMap);
    }

    // ── game_structures (owner_id) ───────────────────────────
    copyTable(src, dst, 'game_structures', 'owner_id', idMap);

    // ── game_leaderboard (user_id) ───────────────────────────
    copyTable(src, dst, 'game_leaderboard', 'user_id', idMap);

    // ── user_cosmetics and user_equipped (user_id) ───────────
    copyTable(src, dst, 'user_cosmetics', 'user_id', idMap);
    copyTable(src, dst, 'user_equipped', 'user_id', idMap);

    log(`  ✅ Game data: ${stats.game_tables} tables, ${stats.game_rows} total rows`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 4: Migrate Canvas Data → hobo-quest
// ═══════════════════════════════════════════════════════════════

function migrateCanvasData(src, dst, idMap) {
    log('Phase 4: Migrating canvas data to hobo-quest...');

    ensureCanvasSchema(dst);

    // canvas_settings — no user_id
    copyTable(src, dst, 'canvas_settings', null, idMap);

    // canvas_tiles — user_id
    copyTable(src, dst, 'canvas_tiles', 'user_id', idMap, 'canvas');

    // canvas_actions — user_id
    copyTable(src, dst, 'canvas_actions', 'user_id', idMap, 'canvas');

    // canvas_snapshots — created_by
    copyTable(src, dst, 'canvas_snapshots', 'created_by', idMap, 'canvas');

    // canvas_region_locks — locked_by
    copyTable(src, dst, 'canvas_region_locks', 'locked_by', idMap, 'canvas');

    // canvas_bans — user_id (nullable, also has banned_by)
    copyCanvasBans(src, dst, idMap);

    // canvas_user_overrides — user_id
    copyTable(src, dst, 'canvas_user_overrides', 'user_id', idMap, 'canvas');

    log(`  ✅ Canvas data: ${stats.canvas_tables} tables, ${stats.canvas_rows} total rows`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 5: Migrate Tag Data → hobo-quest
// ═══════════════════════════════════════════════════════════════

function migrateTagData(src, dst, idMap) {
    log('Phase 5: Migrating tag data to hobo-quest...');

    ensureTagSchema(dst);

    copyTable(src, dst, 'user_tags', 'user_id', idMap, 'tag');
    copyTable(src, dst, 'user_equipped_tag', 'user_id', idMap, 'tag');
    copyTable(src, dst, 'tag_guardian_defeats', 'user_id', idMap, 'tag');

    log(`  ✅ Tag data: ${stats.tag_tables} tables, ${stats.tag_rows} total rows`);
}

// ═══════════════════════════════════════════════════════════════
// Schema Helpers — Create real game/canvas/tag tables in hobo-quest
// ═══════════════════════════════════════════════════════════════

function ensureGameSchema(db) {
    db.exec(`
        -- World state (key-value config store)
        CREATE TABLE IF NOT EXISTS game_world_state (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        -- Player core data (8 skills, equipment, stats)
        CREATE TABLE IF NOT EXISTS game_players (
            user_id INTEGER PRIMARY KEY,
            display_name TEXT,
            x REAL DEFAULT 4096,
            y REAL DEFAULT 4096,
            mining_xp INTEGER DEFAULT 0,
            fishing_xp INTEGER DEFAULT 0,
            woodcut_xp INTEGER DEFAULT 0,
            farming_xp INTEGER DEFAULT 0,
            combat_xp INTEGER DEFAULT 0,
            crafting_xp INTEGER DEFAULT 0,
            smithing_xp INTEGER DEFAULT 0,
            agility_xp INTEGER DEFAULT 0,
            hp INTEGER DEFAULT 100,
            max_hp INTEGER DEFAULT 100,
            attack INTEGER DEFAULT 10,
            defense INTEGER DEFAULT 5,
            stamina INTEGER DEFAULT 100,
            max_stamina INTEGER DEFAULT 100,
            last_stamina_tick DATETIME DEFAULT CURRENT_TIMESTAMP,
            equip_pickaxe TEXT,
            equip_rod TEXT,
            equip_axe TEXT,
            equip_hat TEXT DEFAULT '',
            equip_weapon TEXT DEFAULT '',
            equip_armor TEXT DEFAULT '',
            sleeping_bag_x REAL,
            sleeping_bag_y REAL,
            sprite_skin INTEGER DEFAULT 0,
            name_effect TEXT DEFAULT '',
            particle_effect TEXT DEFAULT '',
            chat_color TEXT DEFAULT '#e8e6e3',
            total_coins_earned INTEGER DEFAULT 0,
            total_items_crafted INTEGER DEFAULT 0,
            total_monsters_killed INTEGER DEFAULT 0,
            total_deaths INTEGER DEFAULT 0,
            battle_wins INTEGER DEFAULT 0,
            battle_losses INTEGER DEFAULT 0,
            structures_built INTEGER DEFAULT 0,
            resources_gathered INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_action DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Player inventory
        CREATE TABLE IF NOT EXISTS game_inventory (
            user_id INTEGER NOT NULL,
            item_id TEXT NOT NULL,
            quantity INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, item_id)
        );

        -- Bank storage (safe from death)
        CREATE TABLE IF NOT EXISTS game_bank (
            user_id INTEGER NOT NULL,
            item_id TEXT NOT NULL,
            quantity INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, item_id)
        );

        -- Placed structures
        CREATE TABLE IF NOT EXISTS game_structures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            x REAL NOT NULL,
            y REAL NOT NULL,
            owner_id INTEGER,
            data TEXT DEFAULT '{}',
            placed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Farm plots (real-time growth)
        CREATE TABLE IF NOT EXISTS game_farm_plots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            plot_index INTEGER DEFAULT 0,
            seed_id TEXT,
            planted_at DATETIME,
            watered_at DATETIME,
            stage TEXT DEFAULT 'empty'
        );

        -- Unlocked crafting recipes
        CREATE TABLE IF NOT EXISTS game_recipes (
            user_id INTEGER NOT NULL,
            recipe_id TEXT NOT NULL,
            unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, recipe_id)
        );

        -- Active buffs/effects
        CREATE TABLE IF NOT EXISTS game_effects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            effect_type TEXT NOT NULL,
            expires_at DATETIME,
            charges INTEGER,
            data TEXT DEFAULT '{}'
        );

        -- PvP battle stats
        CREATE TABLE IF NOT EXISTS game_battle_stats (
            user_id INTEGER PRIMARY KEY,
            battles_won INTEGER DEFAULT 0,
            battles_lost INTEGER DEFAULT 0,
            total_stolen INTEGER DEFAULT 0,
            total_lost INTEGER DEFAULT 0,
            kill_streak INTEGER DEFAULT 0,
            best_streak INTEGER DEFAULT 0,
            fatalities INTEGER DEFAULT 0,
            kills INTEGER DEFAULT 0,
            deaths INTEGER DEFAULT 0
        );

        -- Dungeon runs
        CREATE TABLE IF NOT EXISTS game_dungeon_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            dungeon_id TEXT NOT NULL,
            floor_reached INTEGER DEFAULT 1,
            party TEXT DEFAULT '[]',
            status TEXT DEFAULT 'active',
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            ended_at DATETIME
        );

        -- Cached leaderboards
        CREATE TABLE IF NOT EXISTS game_leaderboard (
            board TEXT NOT NULL,
            rank INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            username TEXT,
            value INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (board, rank)
        );

        -- Fish collection album
        CREATE TABLE IF NOT EXISTS game_fish_collection (
            user_id INTEGER NOT NULL,
            fish_id TEXT NOT NULL,
            count INTEGER DEFAULT 0,
            best_weight REAL DEFAULT 0,
            first_caught DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, fish_id)
        );

        -- Daily quest progress
        CREATE TABLE IF NOT EXISTS game_daily_quest_progress (
            user_id INTEGER NOT NULL,
            quest_date TEXT NOT NULL,
            stat_key TEXT NOT NULL,
            value INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, quest_date, stat_key)
        );

        -- Daily quest claims
        CREATE TABLE IF NOT EXISTS game_daily_quest_claims (
            user_id INTEGER NOT NULL,
            quest_date TEXT NOT NULL,
            tier INTEGER NOT NULL,
            claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, quest_date, tier)
        );

        -- Achievement tracking
        CREATE TABLE IF NOT EXISTS game_achievements (
            user_id INTEGER NOT NULL,
            achievement_id TEXT NOT NULL,
            unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, achievement_id)
        );

        -- Cosmetic ownership (name effects, particles, hats, voices)
        CREATE TABLE IF NOT EXISTS user_cosmetics (
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            item_id TEXT NOT NULL,
            acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, type, item_id)
        );

        -- Currently equipped cosmetics
        CREATE TABLE IF NOT EXISTS user_equipped (
            user_id INTEGER NOT NULL,
            slot TEXT NOT NULL,
            item_id TEXT NOT NULL,
            PRIMARY KEY (user_id, slot)
        );
    `);
}

function ensureCanvasSchema(db) {
    db.exec(`
        -- Canvas config
        CREATE TABLE IF NOT EXISTS canvas_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        -- Pixel board (x,y → color)
        CREATE TABLE IF NOT EXISTS canvas_tiles (
            x INTEGER NOT NULL,
            y INTEGER NOT NULL,
            color_index INTEGER NOT NULL DEFAULT 0,
            user_id INTEGER,
            placed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (x, y)
        );

        -- Placement audit log
        CREATE TABLE IF NOT EXISTS canvas_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            x INTEGER NOT NULL,
            y INTEGER NOT NULL,
            prev_color INTEGER,
            new_color INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Board snapshots
        CREATE TABLE IF NOT EXISTS canvas_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            board_data TEXT NOT NULL,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Admin-locked regions
        CREATE TABLE IF NOT EXISTS canvas_region_locks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            x1 INTEGER NOT NULL,
            y1 INTEGER NOT NULL,
            x2 INTEGER NOT NULL,
            y2 INTEGER NOT NULL,
            reason TEXT DEFAULT '',
            locked_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Canvas-specific bans
        CREATE TABLE IF NOT EXISTS canvas_bans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            ip TEXT,
            reason TEXT DEFAULT '',
            banned_by INTEGER,
            ban_type TEXT DEFAULT 'ban',
            expires_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Per-user canvas overrides (cooldown tweaks, etc.)
        CREATE TABLE IF NOT EXISTS canvas_user_overrides (
            user_id INTEGER PRIMARY KEY,
            cooldown_ms INTEGER,
            max_placements INTEGER,
            note TEXT DEFAULT ''
        );
    `);
}

function ensureTagSchema(db) {
    db.exec(`
        -- User tag ownership
        CREATE TABLE IF NOT EXISTS user_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tag_id TEXT NOT NULL,
            source TEXT DEFAULT 'shop',
            granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, tag_id)
        );

        -- Currently equipped tag
        CREATE TABLE IF NOT EXISTS user_equipped_tag (
            user_id INTEGER NOT NULL PRIMARY KEY,
            tag_id TEXT NOT NULL
        );

        -- Tag guardian boss defeats
        CREATE TABLE IF NOT EXISTS tag_guardian_defeats (
            user_id INTEGER NOT NULL PRIMARY KEY,
            defeated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

// ═══════════════════════════════════════════════════════════════
// Generic Table Copy with User ID Remapping
// ═══════════════════════════════════════════════════════════════

function copyTable(src, dst, tableName, userIdCol, idMap, category = 'game') {
    // Check source table exists
    const exists = src.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(tableName);
    if (!exists) {
        warn(`Source table "${tableName}" not found — skipping`);
        return 0;
    }

    const rows = src.prepare(`SELECT * FROM ${tableName}`).all();
    if (rows.length === 0) {
        log(`  ${tableName}: 0 rows (empty)`);
        if (category === 'canvas') { stats.canvas_tables++; }
        else if (category === 'tag') { stats.tag_tables++; }
        else { stats.game_tables++; }
        return 0;
    }

    // Get column info from destination
    const dstCols = dst.prepare(`PRAGMA table_info(${tableName})`).all();
    const dstColNames = new Set(dstCols.map(c => c.name));

    // Filter source columns to only those present in destination
    const srcColNames = Object.keys(rows[0]);
    const commonCols = srcColNames.filter(c => dstColNames.has(c));

    if (commonCols.length === 0) {
        warn(`No common columns between source and destination for "${tableName}" — skipping`);
        return 0;
    }

    const placeholders = commonCols.map(() => '?').join(', ');
    const insertSql = `INSERT OR IGNORE INTO ${tableName} (${commonCols.join(', ')}) VALUES (${placeholders})`;
    const insert = dst.prepare(insertSql);

    let migrated = 0;
    let skipped = 0;

    const batchInsert = dst.transaction(() => {
        for (const row of rows) {
            // Remap user ID if applicable
            if (userIdCol && row[userIdCol] != null) {
                const oldId = row[userIdCol];
                const newId = idMap.get(oldId);
                if (!newId) {
                    skipped++;
                    continue;
                }
                row[userIdCol] = newId;
            }

            // Also remap any other known user-reference columns
            for (const col of ['owner_id', 'created_by', 'banned_by', 'locked_by']) {
                if (col !== userIdCol && commonCols.includes(col) && row[col] != null) {
                    const mapped = idMap.get(row[col]);
                    if (mapped) row[col] = mapped;
                }
            }

            if (!DRY_RUN) {
                try {
                    insert.run(...commonCols.map(c => row[c] ?? null));
                    migrated++;
                } catch (e) {
                    // Skip duplicates silently (INSERT OR IGNORE)
                    skipped++;
                }
            } else {
                migrated++;
            }
        }
    });

    batchInsert();

    if (category === 'canvas') {
        stats.canvas_tables++;
        stats.canvas_rows += migrated;
    } else if (category === 'tag') {
        stats.tag_tables++;
        stats.tag_rows += migrated;
    } else {
        stats.game_tables++;
        stats.game_rows += migrated;
    }

    log(`  ${tableName}: ${migrated} rows migrated${skipped ? `, ${skipped} skipped` : ''}`);
    return migrated;
}

// Special handler for canvas_bans (multiple user ID columns)
function copyCanvasBans(src, dst, idMap) {
    const exists = src.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='canvas_bans'"
    ).get();
    if (!exists) return;

    const rows = src.prepare('SELECT * FROM canvas_bans').all();
    if (rows.length === 0) {
        stats.canvas_tables++;
        return;
    }

    const insert = dst.prepare(`
        INSERT OR IGNORE INTO canvas_bans (user_id, ip, reason, banned_by, ban_type, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let migrated = 0;
    const tx = dst.transaction(() => {
        for (const row of rows) {
            const newUserId = row.user_id ? idMap.get(row.user_id) : null;
            const newBannedBy = row.banned_by ? idMap.get(row.banned_by) : null;

            if (!DRY_RUN) {
                insert.run(
                    newUserId || row.user_id,
                    row.ip || null,
                    row.reason || '',
                    newBannedBy || row.banned_by,
                    row.ban_type || 'ban',
                    row.expires_at || null,
                    row.created_at
                );
                migrated++;
            }
        }
    });
    tx();

    stats.canvas_tables++;
    stats.canvas_rows += migrated;
    log(`  canvas_bans: ${migrated} rows migrated`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 6: Save ID Mapping
// ═══════════════════════════════════════════════════════════════

function saveIdMapping(idMap) {
    const mappingPath = path.join(MONOREPO_ROOT, 'scripts', 'migration-id-map.json');
    const mapping = {};
    for (const [oldId, newId] of idMap) {
        mapping[oldId] = newId;
    }
    if (!DRY_RUN) {
        fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
        log(`  ID mapping saved to ${mappingPath} (${idMap.size} entries)`);
    } else {
        log(`  Would save ID mapping to ${mappingPath} (${idMap.size} entries)`);
    }
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  HoboStreamer → Hobo Network Migration');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    if (DRY_RUN) {
        console.log('  🔍 DRY RUN MODE — no changes will be written\n');
    }

    // Verify source DB exists
    if (!fs.existsSync(PATHS.hobostreamer)) {
        err(`HoboStreamer database not found at: ${PATHS.hobostreamer}`);
        err('Use --data-dir to specify the correct location.');
        process.exit(1);
    }

    console.log(`  Source:    ${PATHS.hobostreamer}`);
    console.log(`  Users →    ${PATHS.hobotools}`);
    console.log(`  Game →     ${PATHS.hoboquest}`);
    console.log('');

    if (!FORCE && !DRY_RUN) {
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise(resolve => {
            rl.question('  Proceed with migration? (y/N): ', resolve);
        });
        rl.close();
        if (answer.toLowerCase() !== 'y') {
            console.log('  Aborted.');
            process.exit(0);
        }
        console.log('');
    }

    // Open databases
    const src = new Database(PATHS.hobostreamer, { readonly: true });
    src.pragma('journal_mode = WAL');

    // Ensure destination directories exist
    for (const p of [PATHS.hobotools, PATHS.hoboquest]) {
        const dir = path.dirname(p);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize destination DBs with their proper schemas
    const { initDb: initToolsDb } = require('../hobo-tools/server/db/database');
    const toolsDb = initToolsDb(PATHS.hobotools);

    // For hobo-quest, open directly (we'll create schemas inline)
    const questDb = new Database(PATHS.hoboquest);
    questDb.pragma('journal_mode = WAL');
    questDb.pragma('foreign_keys = ON');

    try {
        // Phase 1: Users
        const idMap = migrateUsers(src, toolsDb);

        // Phase 2: Verification Keys
        migrateVerificationKeys(src, toolsDb, idMap);

        // Phase 3: Game Data
        migrateGameData(src, questDb, idMap);

        // Phase 4: Canvas Data
        migrateCanvasData(src, questDb, idMap);

        // Phase 5: Tags
        migrateTagData(src, questDb, idMap);

        // Phase 6: Save mapping
        saveIdMapping(idMap);

        // Summary
        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('  Migration Summary');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`  Users migrated:        ${stats.users_migrated}`);
        console.log(`  Users skipped:         ${stats.users_skipped}`);
        console.log(`  Username conflicts:    ${stats.users_conflict}`);
        console.log(`  Linked accounts:       ${stats.linked_accounts}`);
        console.log(`  Verification keys:     ${stats.vkeys_migrated}`);
        console.log(`  Game tables:           ${stats.game_tables} (${stats.game_rows} rows)`);
        console.log(`  Canvas tables:         ${stats.canvas_tables} (${stats.canvas_rows} rows)`);
        console.log(`  Tag tables:            ${stats.tag_tables} (${stats.tag_rows} rows)`);
        console.log('');

        if (DRY_RUN) {
            console.log('  🔍 This was a DRY RUN — no data was written.');
            console.log('  Run without --dry-run to perform the actual migration.');
        } else {
            console.log('  ✅ Migration complete!');
            console.log('');
            console.log('  Next steps:');
            console.log('  1. Verify hobo-tools.db has the migrated users: sqlite3 data/hobo-tools.db "SELECT COUNT(*) FROM users"');
            console.log('  2. Verify hobo-quest.db has game data: sqlite3 data/hobo-quest.db "SELECT COUNT(*) FROM game_players"');
            console.log('  3. Restart hobo-tools and hobo-quest services');
            console.log('  4. Deploy the HoboStreamer OAuth integration');
        }
        console.log('');
    } finally {
        src.close();
        toolsDb.close();
        questDb.close();
    }
}

main().catch(e => {
    err(e.message);
    console.error(e.stack);
    process.exit(1);
});
