'use strict';

// ═══════════════════════════════════════════════════════════════
// HoboQuest — Database Schema
// Game state, canvas, and player data.
// Accounts live in hobo.tools — this DB stores game-specific data.
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

    // ── Game Characters ─────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS characters (
            user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            x INTEGER DEFAULT 256,
            y INTEGER DEFAULT 256,
            hp INTEGER DEFAULT 100,
            max_hp INTEGER DEFAULT 100,
            level INTEGER DEFAULT 1,
            xp INTEGER DEFAULT 0,
            gold INTEGER DEFAULT 0,
            attack INTEGER DEFAULT 5,
            defense INTEGER DEFAULT 5,
            speed INTEGER DEFAULT 5,
            sprite TEXT DEFAULT 'default',
            direction TEXT DEFAULT 'down',
            last_active TEXT DEFAULT CURRENT_TIMESTAMP,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // ── Skills ──────────────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS skills (
            user_id TEXT NOT NULL,
            skill_name TEXT NOT NULL,
            level INTEGER DEFAULT 1,
            xp INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, skill_name)
        )
    `);

    // ── Inventory ───────────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS inventory (
            user_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            quantity INTEGER DEFAULT 1,
            PRIMARY KEY (user_id, item_id)
        )
    `);

    // ── Equipment ───────────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS equipment (
            user_id TEXT PRIMARY KEY,
            weapon TEXT,
            armor TEXT,
            helmet TEXT,
            shield TEXT,
            accessory TEXT
        )
    `);

    // ── Buildings / Structures ───────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS buildings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id TEXT NOT NULL,
            type TEXT NOT NULL,
            x INTEGER NOT NULL,
            y INTEGER NOT NULL,
            data TEXT DEFAULT '{}',
            placed_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // ── Dungeons ────────────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS dungeon_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            dungeon_id TEXT NOT NULL,
            floor_reached INTEGER DEFAULT 1,
            completed INTEGER DEFAULT 0,
            started_at TEXT DEFAULT CURRENT_TIMESTAMP,
            ended_at TEXT
        )
    `);

    // ── Achievements ────────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS achievements (
            user_id TEXT NOT NULL,
            achievement_id TEXT NOT NULL,
            unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, achievement_id)
        )
    `);

    // ── Daily Quests ────────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS daily_quests (
            user_id TEXT NOT NULL,
            quest_id TEXT NOT NULL,
            progress INTEGER DEFAULT 0,
            completed INTEGER DEFAULT 0,
            date TEXT NOT NULL,
            PRIMARY KEY (user_id, quest_id, date)
        )
    `);

    // ── Canvas ──────────────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS canvas_pixels (
            x INTEGER NOT NULL,
            y INTEGER NOT NULL,
            color TEXT NOT NULL DEFAULT '#FFFFFF',
            placed_by TEXT,
            placed_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (x, y)
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS canvas_cooldowns (
            user_id TEXT PRIMARY KEY,
            last_place TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // ── Leaderboards (materialized, refreshed periodically) ─
    db.exec(`
        CREATE TABLE IF NOT EXISTS leaderboard_cache (
            board TEXT NOT NULL,
            rank INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            value INTEGER NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (board, rank)
        )
    `);

    console.log('[hobo-quest] Database initialized');
    return db;
}

module.exports = { initDb };
