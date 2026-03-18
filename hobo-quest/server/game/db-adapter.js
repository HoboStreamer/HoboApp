'use strict';

/**
 * HoboQuest — Database Adapter
 * 
 * Provides the same db.run(), db.get(), db.all(), db.getDb(),
 * db.getUserById(), db.addHoboCoins(), db.deductHoboCoins(),
 * db.logModerationAction(), db.getOrCreateAnonGameUser() interface
 * that the hobostreamer game modules expect.
 *
 * Call setDb(betterSqlite3Instance) once at startup.
 */

let _db = null;

function setDb(db) {
    _db = db;
}

function getDb() {
    if (!_db) throw new Error('[db-adapter] Database not initialized — call setDb() first');
    return _db;
}

/**
 * Execute INSERT/UPDATE/DELETE with prepared statement.
 * @param {string} sql
 * @param {Array} params
 * @returns {{ changes: number, lastInsertRowid: number }}
 */
function run(sql, params = []) {
    return getDb().prepare(sql).run(...(Array.isArray(params) ? params : [params]));
}

/**
 * Query single row.
 * @param {string} sql
 * @param {Array} params
 * @returns {object|undefined}
 */
function get(sql, params = []) {
    return getDb().prepare(sql).get(...(Array.isArray(params) ? params : [params]));
}

/**
 * Query multiple rows.
 * @param {string} sql
 * @param {Array} params
 * @returns {Array<object>}
 */
function all(sql, params = []) {
    return getDb().prepare(sql).all(...(Array.isArray(params) ? params : [params]));
}

// ── User helpers (game_players doubles as user table for hobo-quest) ──

/**
 * Get user by ID. In hobo-quest, game_players IS the user table for game purposes.
 * We synthesize the fields the game engine expects (hobo_coins_balance, is_banned, display_name).
 */
function getUserById(userId) {
    const player = getDb().prepare(`
        SELECT user_id AS id, display_name AS username, display_name,
               coins AS hobo_coins_balance, 0 AS is_banned
        FROM game_players WHERE user_id = ?
    `).get(userId);
    return player || null;
}

/**
 * Add coins to a player's balance.
 */
function addHoboCoins(userId, amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    return run('UPDATE game_players SET coins = coins + ? WHERE user_id = ?', [amount, userId]);
}

/**
 * Deduct coins from a player's balance. Returns false if insufficient.
 */
function deductHoboCoins(userId, amount) {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    const player = getDb().prepare('SELECT coins FROM game_players WHERE user_id = ?').get(userId);
    if (!player || player.coins < amount) return false;
    run('UPDATE game_players SET coins = coins - ? WHERE user_id = ? AND coins >= ?', [amount, userId, amount]);
    return true;
}

/**
 * Get or create an anonymous game user from IP-based anon ID.
 * Returns a user-like object the game engine expects.
 */
function getOrCreateAnonGameUser(anonId) {
    const safeName = `hobo_${String(anonId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
    // Use a negative hash as the "user_id" for anon players
    let hash = 0;
    for (let i = 0; i < safeName.length; i++) {
        hash = ((hash << 5) - hash + safeName.charCodeAt(i)) | 0;
    }
    const anonUserId = -(Math.abs(hash) % 900000000 + 100000000); // negative ID

    const existing = getDb().prepare('SELECT * FROM game_players WHERE user_id = ?').get(anonUserId);
    if (existing) {
        return {
            id: anonUserId,
            username: safeName,
            display_name: safeName,
            hobo_coins_balance: existing.coins || 0,
            is_banned: false,
            role: 'user',
        };
    }

    // Create anon player
    run(`INSERT OR IGNORE INTO game_players (user_id, display_name, coins) VALUES (?, ?, 0)`, [anonUserId, safeName]);
    return {
        id: anonUserId,
        username: safeName,
        display_name: safeName,
        hobo_coins_balance: 0,
        is_banned: false,
        role: 'user',
    };
}

/**
 * Log a moderation action (canvas bans, rollbacks, etc.).
 * In hobo-quest we store these in a simple mod_log table.
 */
function logModerationAction({ scope_type, actor_user_id, target_user_id, action_type, details }) {
    try {
        getDb().exec(`
            CREATE TABLE IF NOT EXISTS mod_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scope_type TEXT,
                actor_user_id INTEGER,
                target_user_id INTEGER,
                action_type TEXT,
                details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        run(
            `INSERT INTO mod_log (scope_type, actor_user_id, target_user_id, action_type, details) VALUES (?, ?, ?, ?, ?)`,
            [scope_type || 'canvas', actor_user_id || null, target_user_id || null, action_type || '', JSON.stringify(details || {})]
        );
    } catch { /* non-critical */ }
}

module.exports = {
    setDb,
    getDb,
    run,
    get,
    all,
    getUserById,
    addHoboCoins,
    deductHoboCoins,
    getOrCreateAnonGameUser,
    logModerationAction,
};
