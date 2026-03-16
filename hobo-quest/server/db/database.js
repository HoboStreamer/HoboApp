'use strict';

// ═══════════════════════════════════════════════════════════════
// HoboQuest — Database Schema
// Game state, canvas, tags, and player data.
// Accounts live in hobo.tools — this DB stores game-specific data.
// User IDs reference hobo.tools user IDs (via JWT sub claim).
// ═══════════════════════════════════════════════════════════════

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function initDb(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');

    // ═══════════════════════════════════════════════════════════
    // Game Tables
    // ═══════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════
    // Canvas Tables
    // ═══════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════
    // Tag Tables
    // ═══════════════════════════════════════════════════════════

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

    console.log('[hobo-quest] Database initialized');
    return db;
}

module.exports = { initDb };
