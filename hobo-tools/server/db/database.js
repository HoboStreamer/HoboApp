'use strict';

// ═══════════════════════════════════════════════════════════════
// hobo.tools — Central Database
// Authoritative source for user accounts, OAuth2 clients,
// themes, and cross-platform preferences.
// ═══════════════════════════════════════════════════════════════

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function initDb(dbPath) {
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const db = new Database(path.resolve(dbPath));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');

    // ── Schema ───────────────────────────────────────────────
    db.exec(`
        -- Users (canonical identity for the Hobo Network)
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            display_name TEXT,
            avatar_url TEXT,
            bio TEXT DEFAULT '',
            role TEXT DEFAULT 'user' CHECK(role IN ('user','streamer','global_mod','admin')),
            profile_color TEXT DEFAULT '#c0965c',
            is_banned INTEGER DEFAULT 0,
            ban_reason TEXT,
            token_valid_after TEXT DEFAULT NULL,
            legacy_source TEXT,          -- 'hobostreamer' for migrated accounts
            legacy_id INTEGER,           -- original user ID in source platform
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- OAuth2 client registry
        CREATE TABLE IF NOT EXISTS oauth_clients (
            client_id TEXT PRIMARY KEY,
            client_secret TEXT NOT NULL,
            name TEXT NOT NULL,
            redirect_uris TEXT NOT NULL,   -- JSON array of allowed redirect URIs
            is_first_party INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- OAuth2 authorization codes (short-lived, single-use)
        CREATE TABLE IF NOT EXISTS oauth_codes (
            code TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            redirect_uri TEXT NOT NULL,
            scope TEXT DEFAULT 'profile theme',
            expires_at DATETIME NOT NULL,
            used INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        -- OAuth2 refresh tokens
        CREATE TABLE IF NOT EXISTS oauth_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT UNIQUE NOT NULL,
            client_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            scope TEXT DEFAULT 'profile theme',
            expires_at DATETIME NOT NULL,
            revoked INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        -- User preferences (theme, language, notification settings)
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id INTEGER PRIMARY KEY,
            theme_id TEXT DEFAULT 'campfire',
            custom_theme_variables TEXT,   -- JSON: custom CSS var overrides
            language TEXT DEFAULT 'en',
            notifications_enabled INTEGER DEFAULT 1,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        -- Theme catalog (built-in + community)
        CREATE TABLE IF NOT EXISTS themes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            author_id INTEGER,
            description TEXT DEFAULT '',
            mode TEXT DEFAULT 'dark' CHECK(mode IN ('dark','light')),
            variables TEXT NOT NULL,       -- JSON: CSS variable map
            preview_colors TEXT,           -- JSON: preview color swatches
            is_builtin INTEGER DEFAULT 0,
            is_public INTEGER DEFAULT 1,
            downloads INTEGER DEFAULT 0,
            rating_sum INTEGER DEFAULT 0,
            rating_count INTEGER DEFAULT 0,
            tags TEXT DEFAULT '[]',        -- JSON array
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (author_id) REFERENCES users(id)
        );

        -- Linked accounts (which Hobo user owns which service-specific account)
        CREATE TABLE IF NOT EXISTS linked_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            service TEXT NOT NULL,          -- 'hobostreamer', 'hoboquest', etc.
            service_user_id TEXT NOT NULL,
            linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(service, service_user_id)
        );

        -- Audit log
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,                 -- JSON context
            ip TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- IP log (cross-platform)
        CREATE TABLE IF NOT EXISTS ip_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            ip TEXT NOT NULL,
            action TEXT DEFAULT 'login',
            country TEXT,
            region TEXT,
            city TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        -- Site settings (key-value)
        CREATE TABLE IF NOT EXISTS site_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            type TEXT DEFAULT 'string'
        );

        -- ═══════════════════════════════════════════════════════
        -- Notifications
        -- ═══════════════════════════════════════════════════════

        -- Central notification store
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,              -- UUID
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,               -- from TYPES enum (FOLLOW, MENTION, etc.)
            category TEXT NOT NULL,           -- social, chat, game, stream, economy, etc.
            priority TEXT NOT NULL DEFAULT 'normal',  -- low, normal, high, critical
            title TEXT NOT NULL,
            message TEXT,
            icon TEXT,
            sender_id INTEGER,               -- who triggered this (nullable)
            sender_name TEXT,                 -- denormalized for display
            sender_avatar TEXT,
            service TEXT,                     -- originating service (hobostreamer, etc.)
            url TEXT,                         -- click-through destination
            rich_content TEXT,                -- JSON: images, actions, embeds
            is_read INTEGER DEFAULT 0,
            is_dismissed INTEGER DEFAULT 0,
            is_emailed INTEGER DEFAULT 0,
            expires_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications(user_id, is_read, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_notif_user_cat ON notifications(user_id, category);
        CREATE INDEX IF NOT EXISTS idx_notif_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;

        -- Per-user notification preferences (overrides per category)
        CREATE TABLE IF NOT EXISTS notification_preferences (
            user_id INTEGER NOT NULL,
            category TEXT NOT NULL,           -- or '*' for global
            enabled INTEGER DEFAULT 1,
            sound INTEGER DEFAULT 1,
            toasts INTEGER DEFAULT 1,
            email INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, category),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        -- ═══════════════════════════════════════════════════════
        -- Anonymous Users & Multi-Account Sessions
        -- ═══════════════════════════════════════════════════════

        -- Anonymous user tracking
        CREATE TABLE IF NOT EXISTS anon_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            anon_number INTEGER UNIQUE NOT NULL,
            fingerprint TEXT,                 -- browser fingerprint hash (optional)
            session_token TEXT UNIQUE NOT NULL,
            display_name TEXT,
            preferences TEXT DEFAULT '{}',    -- JSON
            total_messages INTEGER DEFAULT 0,
            total_commands INTEGER DEFAULT 0,
            first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Multi-account session tracking (like Google multi-login)
        CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_token TEXT UNIQUE NOT NULL,
            device_name TEXT,
            ip TEXT,
            user_agent TEXT,
            is_active INTEGER DEFAULT 1,
            last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id, is_active);
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);

        -- ═══════════════════════════════════════════════════════
        -- User Profile Extras
        -- ═══════════════════════════════════════════════════════

        -- Name & particle effects ownership
        CREATE TABLE IF NOT EXISTS user_effects (
            user_id INTEGER NOT NULL,
            effect_type TEXT NOT NULL,         -- 'name' or 'particle'
            effect_id TEXT NOT NULL,           -- e.g. 'rainbow', 'fire', 'neon'
            is_active INTEGER DEFAULT 0,
            acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, effect_type, effect_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        -- User followers
        CREATE TABLE IF NOT EXISTS follows (
            follower_id INTEGER NOT NULL,
            followed_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (follower_id, followed_id),
            FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (followed_id) REFERENCES users(id) ON DELETE CASCADE
        );

        -- Verification keys (reserved username claims)
        CREATE TABLE IF NOT EXISTS verification_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            target_username TEXT NOT NULL,
            note TEXT DEFAULT '',
            created_by INTEGER NOT NULL,
            used_by INTEGER,
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'used', 'revoked')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            used_at DATETIME,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_vkeys_key ON verification_keys(key);
        CREATE INDEX IF NOT EXISTS idx_vkeys_target ON verification_keys(target_username);
        CREATE INDEX IF NOT EXISTS idx_vkeys_status ON verification_keys(status);
    `);

    // ── Migration: Add columns that may not exist ────────────
    const migrations = [
        { table: 'linked_accounts', column: 'service_username', sql: "ALTER TABLE linked_accounts ADD COLUMN service_username TEXT" },
        { table: 'users', column: 'is_anon', sql: "ALTER TABLE users ADD COLUMN is_anon INTEGER DEFAULT 0" },
        { table: 'users', column: 'anon_number', sql: "ALTER TABLE users ADD COLUMN anon_number INTEGER" },
        { table: 'users', column: 'name_effect', sql: "ALTER TABLE users ADD COLUMN name_effect TEXT" },
        { table: 'users', column: 'particle_effect', sql: "ALTER TABLE users ADD COLUMN particle_effect TEXT" },
    ];
    for (const m of migrations) {
        const cols = db.prepare(`PRAGMA table_info(${m.table})`).all();
        if (!cols.find(c => c.name === m.column)) {
            try { db.exec(m.sql); console.log(`[DB] Migrated: ${m.table}.${m.column}`); }
            catch (e) { /* already exists — silently skip */ }
        }
    }

    // ── Seed OAuth2 Clients ──────────────────────────────────
    const clientCount = db.prepare('SELECT COUNT(*) as cnt FROM oauth_clients').get().cnt;
    if (clientCount === 0) {
        const { v4: uuidv4 } = require('uuid');
        const clients = [
            {
                client_id: 'hobostreamer',
                client_secret: uuidv4(),
                name: 'HoboStreamer',
                redirect_uris: JSON.stringify(['https://hobostreamer.com/auth/callback', 'https://hobostreamer.com/api/auth/callback']),
                is_first_party: 1,
            },
            {
                client_id: 'hoboquest',
                client_secret: uuidv4(),
                name: 'HoboQuest',
                redirect_uris: JSON.stringify(['https://hobo.quest/auth/callback']),
                is_first_party: 1,
            },
        ];
        const insert = db.prepare(
            'INSERT INTO oauth_clients (client_id, client_secret, name, redirect_uris, is_first_party) VALUES (?, ?, ?, ?, ?)'
        );
        for (const c of clients) {
            insert.run(c.client_id, c.client_secret, c.name, c.redirect_uris, c.is_first_party);
            console.log(`[DB] Seeded OAuth2 client: ${c.client_id} (secret: ${c.client_secret})`);
        }
        console.log('[DB] ⚠️  Save these client secrets! They are shown only once.');
    }

    // Ensure hobostreamer redirect_uris include /api/auth/callback path
    try {
        const hsClient = db.prepare("SELECT redirect_uris FROM oauth_clients WHERE client_id = 'hobostreamer'").get();
        if (hsClient) {
            const uris = JSON.parse(hsClient.redirect_uris);
            if (!uris.includes('https://hobostreamer.com/api/auth/callback')) {
                uris.push('https://hobostreamer.com/api/auth/callback');
                db.prepare("UPDATE oauth_clients SET redirect_uris = ? WHERE client_id = 'hobostreamer'")
                    .run(JSON.stringify(uris));
                console.log('[DB] Updated hobostreamer redirect_uris to include /api/auth/callback');
            }
        }
    } catch { /* already up to date */ }

    // ── Seed Default Settings ────────────────────────────────
    const settingsCount = db.prepare('SELECT COUNT(*) as cnt FROM site_settings').get().cnt;
    if (settingsCount === 0) {
        const defaults = [
            ['registration_open', 'true', 'boolean'],
            ['platform_name', 'Hobo Network', 'string'],
            ['default_theme', 'campfire', 'string'],
            // Amazon SES defaults
            ['ses_enabled', 'false', 'boolean'],
            ['ses_region', 'us-east-1', 'string'],
            ['ses_access_key_id', '', 'string'],
            ['ses_secret_access_key', '', 'string'],
            ['ses_from_email', 'noreply@hobo.tools', 'string'],
            ['ses_from_name', 'Hobo Network', 'string'],
            // Notification defaults
            ['notifications_enabled', 'true', 'boolean'],
            ['notification_max_age_days', '90', 'number'],
            ['notification_email_critical_only', 'true', 'boolean'],
        ];
        const insertSetting = db.prepare('INSERT OR IGNORE INTO site_settings (key, value, type) VALUES (?, ?, ?)');
        for (const [k, v, t] of defaults) insertSetting.run(k, v, t);
    }

    // ── Seed Built-in Themes ─────────────────────────────────
    const themeCount = db.prepare('SELECT COUNT(*) as cnt FROM themes WHERE is_builtin = 1').get().cnt;
    if (themeCount === 0) {
        const { BUILTIN_THEMES } = require('hobo-shared/theme-sync');
        const insertTheme = db.prepare(`
            INSERT OR IGNORE INTO themes (id, name, slug, description, mode, variables, is_builtin, is_public)
            VALUES (?, ?, ?, ?, ?, ?, 1, 1)
        `);
        for (const t of BUILTIN_THEMES) {
            insertTheme.run(t.id, t.name, t.slug, t.description, t.mode, JSON.stringify(t.variables));
        }
        console.log(`[DB] Seeded ${BUILTIN_THEMES.length} built-in themes`);
    }

    // ── Helper: getSetting ───────────────────────────────────
    db.getSetting = function (key) {
        const row = this.prepare('SELECT value, type FROM site_settings WHERE key = ?').get(key);
        if (!row) return null;
        if (row.type === 'boolean') return row.value === 'true';
        if (row.type === 'number') return Number(row.value);
        return row.value;
    };

    // ── Verification Key helpers ─────────────────────────────
    db.createVerificationKey = function ({ key, target_username, note, created_by }) {
        return this.prepare(
            'INSERT INTO verification_keys (key, target_username, note, created_by) VALUES (?, ?, ?, ?)'
        ).run(key, target_username, note || '', created_by);
    };

    db.getVerificationKeyByKey = function (key) {
        return this.prepare('SELECT * FROM verification_keys WHERE key = ?').get(key);
    };

    db.getVerificationKeyByUsername = function (username) {
        return this.prepare("SELECT * FROM verification_keys WHERE target_username = ? COLLATE NOCASE AND status = 'active'").get(username);
    };

    db.getAllVerificationKeys = function () {
        return this.prepare(`
            SELECT vk.*, u1.username as created_by_name, u2.username as used_by_name
            FROM verification_keys vk
            LEFT JOIN users u1 ON vk.created_by = u1.id
            LEFT JOIN users u2 ON vk.used_by = u2.id
            ORDER BY vk.created_at DESC
        `).all();
    };

    db.redeemVerificationKey = function (key, userId) {
        return this.prepare(
            "UPDATE verification_keys SET status = 'used', used_by = ?, used_at = CURRENT_TIMESTAMP WHERE key = ? AND status = 'active'"
        ).run(userId, key);
    };

    db.revokeVerificationKey = function (id) {
        return this.prepare("UPDATE verification_keys SET status = 'revoked' WHERE id = ? AND status = 'active'").run(id);
    };

    db.isUsernameReserved = function (username) {
        const vk = this.prepare("SELECT id FROM verification_keys WHERE target_username = ? COLLATE NOCASE AND status = 'active'").get(username);
        return !!vk;
    };

    console.log('[DB] Central database initialized');
    return db;
}

module.exports = { initDb };
