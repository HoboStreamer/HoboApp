'use strict';

// ═══════════════════════════════════════════════════════════════
// hobo.tools — Internal Server-to-Server API
// Used by hobostreamer (port 3000) and hobo-quest (port 3200)
// to verify tokens, sync users, and fetch shared data.
// Protected by X-Internal-Key header.
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();

function getDb(req) { return req.app.locals.db; }
function getConfig(req) { return req.app.locals.config; }

// ── Internal Key Middleware ──────────────────────────────────
function requireInternalKey(req, res, next) {
    const key = req.headers['x-internal-key'];
    const config = getConfig(req);
    if (!key || key !== config.internalKey) {
        return res.status(403).json({ error: 'Invalid or missing internal key' });
    }
    next();
}

router.use(requireInternalKey);

// ── Verify Token ─────────────────────────────────────────────
// Other services call this to validate an access token and get user data.
// Avoids each service needing the public key locally (though they can — this is a convenience).
const jwt = require('jsonwebtoken');

router.post('/verify-token', (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });

    const publicKey = req.app.locals.publicKey;
    const config = getConfig(req);
    const algorithm = publicKey.includes('BEGIN') ? 'RS256' : 'HS256';

    try {
        const decoded = jwt.verify(token, publicKey, {
            algorithms: [algorithm],
            issuer: config.jwt.issuer
        });
        const db = getDb(req);
        const user = db.prepare('SELECT id, username, display_name, role, avatar_url, color FROM users WHERE id = ?').get(decoded.sub || decoded.id);
        res.json({ valid: true, decoded, user: user || null });
    } catch (err) {
        res.json({ valid: false, error: err.message });
    }
});

// ── Get User by ID ───────────────────────────────────────────
router.get('/users/:id', (req, res) => {
    const db = getDb(req);
    const user = db.prepare(`
        SELECT id, username, display_name, role, avatar_url, color, bio, created_at
        FROM users WHERE id = ?
    `).get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
});

// ── Lookup User by Username ──────────────────────────────────
router.get('/users/by-username/:username', (req, res) => {
    const db = getDb(req);
    const user = db.prepare(`
        SELECT id, username, display_name, role, avatar_url, color, bio, created_at
        FROM users WHERE username = ?
    `).get(req.params.username.toLowerCase());
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
});

// ── Bulk User Lookup ─────────────────────────────────────────
router.post('/users/bulk', (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    if (ids.length > 200) return res.status(400).json({ error: 'Max 200 ids per request' });

    const db = getDb(req);
    const placeholders = ids.map(() => '?').join(',');
    const users = db.prepare(`
        SELECT id, username, display_name, role, avatar_url, color
        FROM users WHERE id IN (${placeholders})
    `).all(...ids);
    res.json({ users });
});

// ── Get User Theme Preference ────────────────────────────────
router.get('/users/:id/theme', (req, res) => {
    const db = getDb(req);
    const prefs = db.prepare('SELECT theme_id, custom_theme_variables FROM user_preferences WHERE user_id = ?').get(req.params.id);
    if (!prefs) return res.json({ theme_id: 'campfire', custom_variables: null });
    let custom = null;
    try { custom = prefs.custom_theme_variables ? JSON.parse(prefs.custom_theme_variables) : null; } catch {}
    res.json({ theme_id: prefs.theme_id, custom_variables: custom });
});

// ── Sync Linked Account ──────────────────────────────────────
// When a user connects their hobostreamer or hobo.quest account,
// the service reports the link here.
router.post('/link-account', (req, res) => {
    const { user_id, service, service_user_id, service_username } = req.body;
    if (!user_id || !service || !service_user_id) {
        return res.status(400).json({ error: 'user_id, service, and service_user_id required' });
    }

    const db = getDb(req);
    db.prepare(`
        INSERT INTO linked_accounts (user_id, service, service_user_id, service_username, linked_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, service) DO UPDATE SET
            service_user_id = ?,
            service_username = ?,
            linked_at = CURRENT_TIMESTAMP
    `).run(user_id, service, service_user_id, service_username || null, service_user_id, service_username || null);

    res.json({ success: true });
});

// ── Get Linked Accounts ──────────────────────────────────────
router.get('/users/:id/linked-accounts', (req, res) => {
    const db = getDb(req);
    const accounts = db.prepare('SELECT service, service_user_id, service_username, linked_at FROM linked_accounts WHERE user_id = ?').all(req.params.id);
    res.json({ accounts });
});

// ── Audit Log ────────────────────────────────────────────────
router.post('/audit', (req, res) => {
    const { user_id, action, details, ip } = req.body;
    if (!action) return res.status(400).json({ error: 'action required' });
    const db = getDb(req);
    db.prepare('INSERT INTO audit_log (user_id, action, details, ip) VALUES (?, ?, ?, ?)').run(user_id || null, action, details || null, ip || null);
    res.json({ success: true });
});

// ── Health / Stats ───────────────────────────────────────────
router.get('/stats', (req, res) => {
    const db = getDb(req);
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const themeCount = db.prepare('SELECT COUNT(*) as count FROM themes').get().count;
    const linkedCount = db.prepare('SELECT COUNT(*) as count FROM linked_accounts').get().count;
    const notifCount = db.prepare('SELECT COUNT(*) as count FROM notifications').get().count;
    res.json({ users: userCount, themes: themeCount, linked_accounts: linkedCount, notifications: notifCount });
});

// ═══════════════════════════════════════════════════════════════
// Cross-Service Notification Push
// Services call these to create notifications for users without
// needing direct DB access.
// ═══════════════════════════════════════════════════════════════

// ── Push Single Notification ─────────────────────────────────
// POST /internal/notifications/push
// Body: { user_id, type, title, message, icon, sender_id, sender_name, sender_avatar, service, url, priority, category, rich_content, expires_at }
router.post('/notifications/push', (req, res) => {
    const notifService = req.app.locals.notificationService;
    if (!notifService) return res.status(503).json({ error: 'Notification service unavailable' });

    const { user_id, ...data } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    try {
        const notification = notifService.create({ user_id, ...data });
        if (!notification) return res.json({ ok: true, skipped: true, reason: 'User has category disabled' });
        res.json({ ok: true, notification });
    } catch (err) {
        console.error('[Internal] Notification push error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── Push Bulk Notifications ──────────────────────────────────
// POST /internal/notifications/push-bulk
// Body: { user_ids: [], type, title, message, ... }
router.post('/notifications/push-bulk', (req, res) => {
    const notifService = req.app.locals.notificationService;
    if (!notifService) return res.status(503).json({ error: 'Notification service unavailable' });

    const { user_ids, ...data } = req.body;
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ error: 'user_ids array required' });
    }
    if (user_ids.length > 1000) {
        return res.status(400).json({ error: 'Max 1000 user_ids per request' });
    }

    try {
        const results = notifService.createBulk(user_ids, data);
        res.json({ ok: true, sent: results.length, total: user_ids.length });
    } catch (err) {
        console.error('[Internal] Bulk notification push error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── Get Unread Count for User ────────────────────────────────
// GET /internal/notifications/unread/:userId
router.get('/notifications/unread/:userId', (req, res) => {
    const notifService = req.app.locals.notificationService;
    if (!notifService) return res.status(503).json({ error: 'Notification service unavailable' });

    try {
        const count = notifService.getUnreadCount(parseInt(req.params.userId));
        res.json({ ok: true, count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Resolve User for Notification Context ────────────────────
// POST /internal/notifications/resolve-users
// Body: { usernames: [] }  → returns user IDs + display info
router.post('/notifications/resolve-users', (req, res) => {
    const { usernames } = req.body;
    if (!Array.isArray(usernames) || usernames.length === 0) {
        return res.status(400).json({ error: 'usernames array required' });
    }
    const db = getDb(req);
    const placeholders = usernames.map(() => '?').join(',');
    const users = db.prepare(`
        SELECT id, username, display_name, avatar_url, name_effect, particle_effect
        FROM users WHERE LOWER(username) IN (${placeholders})
    `).all(...usernames.map(u => u.toLowerCase()));
    res.json({ ok: true, users });
});

// ── Issue Token for Linked User ──────────────────────────────
// POST /internal/issue-token
// Body: { user_id }
// Used by hobostreamer/hobo-quest to get a hobo.tools JWT for
// users who logged in via password but have a linked account.
// This enables cross-service features (notifications, themes).
router.post('/issue-token', (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const db = getDb(req);
    const config = getConfig(req);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.is_banned) return res.status(403).json({ error: 'User is banned' });

    const privateKey = req.app.locals.privateKey;
    const algorithm = privateKey === req.app.locals.publicKey ? 'HS256' : 'RS256';

    const token = jwt.sign(
        { sub: user.id, username: user.username, role: user.role },
        privateKey,
        { algorithm, expiresIn: config.jwt.accessTokenExpiry, issuer: config.jwt.issuer }
    );

    res.json({ token, user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role, avatar_url: user.avatar_url } });
});

module.exports = router;
