'use strict';

// ═══════════════════════════════════════════════════════════════
// Admin Panel — API Routes
// Mounted at /api/admin. Requires admin role.
// Manages SES config, site settings, user management, bulk
// notifications, and system health.
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();

module.exports = function createAdminRoutes(db, notificationService, sesService, requireAuth) {

    // ─── Admin middleware ──────────────────────────────────
    function requireAdmin(req, res, next) {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ ok: false, error: 'Admin access required' });
        }
        next();
    }

    router.use(requireAuth, requireAdmin);

    // ═══════════════════════════════════════════════════════
    // SES Configuration
    // ═══════════════════════════════════════════════════════

    // GET /api/admin/ses — get current SES config
    router.get('/ses', (req, res) => {
        try {
            const status = sesService.getStatus();
            res.json({ ok: true, ses: status });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // PUT /api/admin/ses — update SES config
    router.put('/ses', (req, res) => {
        try {
            const { enabled, region, access_key_id, secret_access_key, from_email, from_name } = req.body;
            const setSetting = db.prepare('INSERT OR REPLACE INTO site_settings (key, value, type) VALUES (?, ?, ?)');

            const tx = db.transaction(() => {
                if (enabled !== undefined) setSetting.run('ses_enabled', String(enabled), 'boolean');
                if (region) setSetting.run('ses_region', region, 'string');
                if (access_key_id !== undefined) setSetting.run('ses_access_key_id', access_key_id, 'string');
                if (secret_access_key !== undefined) setSetting.run('ses_secret_access_key', secret_access_key, 'string');
                if (from_email) setSetting.run('ses_from_email', from_email, 'string');
                if (from_name) setSetting.run('ses_from_name', from_name, 'string');
            });
            tx();

            sesService.reload();

            // Audit
            db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)').run(
                req.user.id, 'ses_config_update', JSON.stringify({ region, from_email })
            );

            res.json({ ok: true, ses: sesService.getStatus() });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // POST /api/admin/ses/test — send test email
    router.post('/ses/test', async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) return res.status(400).json({ ok: false, error: 'Email required' });
            const sent = await sesService.sendTestEmail(email);
            res.json({ ok: true, sent });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ═══════════════════════════════════════════════════════
    // Site Settings
    // ═══════════════════════════════════════════════════════

    router.get('/settings', (req, res) => {
        try {
            const rows = db.prepare('SELECT * FROM site_settings').all();
            const settings = {};
            for (const r of rows) {
                // Don't expose secrets in full
                if (r.key === 'ses_secret_access_key' && r.value) {
                    settings[r.key] = { value: '••••' + r.value.slice(-4), type: r.type };
                } else {
                    settings[r.key] = { value: r.value, type: r.type };
                }
            }
            res.json({ ok: true, settings });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    router.put('/settings', (req, res) => {
        try {
            const { key, value, type } = req.body;
            if (!key) return res.status(400).json({ ok: false, error: 'Key required' });
            // Prevent overwriting secrets with masked values
            if (key === 'ses_secret_access_key' && value?.startsWith('••••')) {
                return res.json({ ok: true, skipped: true });
            }
            db.prepare('INSERT OR REPLACE INTO site_settings (key, value, type) VALUES (?, ?, ?)').run(key, String(value), type || 'string');
            db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)').run(
                req.user.id, 'setting_update', JSON.stringify({ key })
            );
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ═══════════════════════════════════════════════════════
    // User Management
    // ═══════════════════════════════════════════════════════

    router.get('/users', (req, res) => {
        try {
            const limit = Math.min(parseInt(req.query.limit) || 50, 200);
            const offset = parseInt(req.query.offset) || 0;
            const search = req.query.search || '';

            let users;
            if (search) {
                users = db.prepare(`
                    SELECT id, username, display_name, email, role, is_banned, created_at, last_seen
                    FROM users WHERE username LIKE ? OR display_name LIKE ? OR email LIKE ?
                    ORDER BY created_at DESC LIMIT ? OFFSET ?
                `).all(`%${search}%`, `%${search}%`, `%${search}%`, limit, offset);
            } else {
                users = db.prepare(`
                    SELECT id, username, display_name, email, role, is_banned, created_at, last_seen
                    FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?
                `).all(limit, offset);
            }

            const total = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
            res.json({ ok: true, users, total });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    router.put('/users/:id/role', (req, res) => {
        try {
            const { role } = req.body;
            const validRoles = ['user', 'streamer', 'global_mod', 'admin'];
            if (!validRoles.includes(role)) return res.status(400).json({ ok: false, error: 'Invalid role' });
            db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
            db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)').run(
                req.user.id, 'user_role_change', JSON.stringify({ targetId: req.params.id, role })
            );
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    router.put('/users/:id/ban', (req, res) => {
        try {
            const { banned, reason } = req.body;
            db.prepare('UPDATE users SET is_banned = ?, ban_reason = ? WHERE id = ?').run(banned ? 1 : 0, reason || null, req.params.id);
            db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)').run(
                req.user.id, banned ? 'user_ban' : 'user_unban', JSON.stringify({ targetId: req.params.id, reason })
            );

            // Notify the user
            if (banned) {
                notificationService.create({
                    user_id: parseInt(req.params.id),
                    type: 'BAN',
                    title: 'Account Suspended',
                    message: reason ? `Reason: ${reason}` : 'Your account has been suspended.',
                    priority: 'critical',
                    category: 'moderation',
                });
            }

            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ═══════════════════════════════════════════════════════
    // Broadcast Notifications
    // ═══════════════════════════════════════════════════════

    router.post('/broadcast', (req, res) => {
        try {
            const { title, message, icon, url, priority, category } = req.body;
            if (!title) return res.status(400).json({ ok: false, error: 'Title required' });

            // Get all non-banned user IDs
            const userIds = db.prepare('SELECT id FROM users WHERE is_banned = 0').all().map(u => u.id);
            const results = notificationService.createBulk(userIds, {
                type: 'ADMIN_BROADCAST',
                title,
                message,
                icon: icon || '📢',
                url,
                priority: priority || 'normal',
                category: category || 'admin',
                sender_id: req.user.id,
                sender_name: req.user.display_name || req.user.username,
                service: 'hobo-tools',
            });

            db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)').run(
                req.user.id, 'broadcast_notification', JSON.stringify({ title, recipients: results.length })
            );

            res.json({ ok: true, sent: results.length });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ═══════════════════════════════════════════════════════
    // System Health
    // ═══════════════════════════════════════════════════════

    router.get('/health', (req, res) => {
        try {
            const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
            const notifCount = db.prepare('SELECT COUNT(*) as cnt FROM notifications').get().cnt;
            const unreadCount = db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE is_read = 0').get().cnt;
            const anonCount = db.prepare('SELECT COUNT(*) as cnt FROM anon_users').get().cnt;
            const sessionCount = db.prepare('SELECT COUNT(*) as cnt FROM user_sessions WHERE is_active = 1').get().cnt;
            const ses = sesService.getStatus();

            res.json({
                ok: true,
                health: {
                    users: userCount,
                    anon_users: anonCount,
                    active_sessions: sessionCount,
                    total_notifications: notifCount,
                    unread_notifications: unreadCount,
                    ses_enabled: ses.enabled,
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                },
            });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ═══════════════════════════════════════════════════════
    // Audit Log
    // ═══════════════════════════════════════════════════════

    router.get('/audit', (req, res) => {
        try {
            const limit = Math.min(parseInt(req.query.limit) || 50, 500);
            const offset = parseInt(req.query.offset) || 0;
            const rows = db.prepare(`
                SELECT a.*, u.username FROM audit_log a
                LEFT JOIN users u ON u.id = a.user_id
                ORDER BY a.created_at DESC LIMIT ? OFFSET ?
            `).all(limit, offset);
            res.json({ ok: true, entries: rows });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    return router;
};
