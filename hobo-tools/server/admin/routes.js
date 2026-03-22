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

    function getEmailMetrics() {
        const summary = {
            total: db.prepare('SELECT COUNT(*) AS count FROM email_delivery_log').get().count,
            sent: db.prepare("SELECT COUNT(*) AS count FROM email_delivery_log WHERE status = 'sent'").get().count,
            failed: db.prepare("SELECT COUNT(*) AS count FROM email_delivery_log WHERE status = 'failed'").get().count,
            sent_24h: db.prepare("SELECT COUNT(*) AS count FROM email_delivery_log WHERE status = 'sent' AND created_at >= datetime('now', '-1 day')").get().count,
            failed_24h: db.prepare("SELECT COUNT(*) AS count FROM email_delivery_log WHERE status = 'failed' AND created_at >= datetime('now', '-1 day')").get().count,
            password_resets_24h: db.prepare("SELECT COUNT(*) AS count FROM email_delivery_log WHERE email_type = 'password_reset' AND created_at >= datetime('now', '-1 day')").get().count,
            notifications_24h: db.prepare("SELECT COUNT(*) AS count FROM email_delivery_log WHERE email_type LIKE 'notification:%' AND created_at >= datetime('now', '-1 day')").get().count,
            tests_24h: db.prepare("SELECT COUNT(*) AS count FROM email_delivery_log WHERE email_type = 'test' AND created_at >= datetime('now', '-1 day')").get().count,
            last_sent_at: db.prepare("SELECT created_at FROM email_delivery_log WHERE status = 'sent' ORDER BY created_at DESC LIMIT 1").get()?.created_at || null,
            last_failed_at: db.prepare("SELECT created_at FROM email_delivery_log WHERE status = 'failed' ORDER BY created_at DESC LIMIT 1").get()?.created_at || null,
        };

        const byType = db.prepare(`
            SELECT email_type, status, COUNT(*) AS count
            FROM email_delivery_log
            WHERE created_at >= datetime('now', '-30 day')
            GROUP BY email_type, status
            ORDER BY count DESC, email_type ASC
            LIMIT 20
        `).all();

        const recent = db.prepare(`
            SELECT id, email_type, recipient, subject, status, error_message, created_at
            FROM email_delivery_log
            ORDER BY created_at DESC
            LIMIT 20
        `).all();

        return { summary, by_type: byType, recent };
    }

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
            res.json({ ok: true, ses: status, metrics: getEmailMetrics() });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // PUT /api/admin/ses — update SES config
    router.put('/ses', (req, res) => {
        try {
            const { enabled, region, access_key_id, secret_access_key, from_email, from_name,
                    from_email_hobostreamer, from_email_hoboquest, from_email_hobotools } = req.body;
            const setSetting = db.prepare('INSERT OR REPLACE INTO site_settings (key, value, type) VALUES (?, ?, ?)');

            const tx = db.transaction(() => {
                if (enabled !== undefined) setSetting.run('ses_enabled', String(enabled), 'boolean');
                if (region) setSetting.run('ses_region', region, 'string');
                // Only update credentials if they're not masked placeholder values
                if (access_key_id && !/\u2022/.test(access_key_id)) setSetting.run('ses_access_key_id', access_key_id, 'string');
                if (secret_access_key && !/\u2022/.test(secret_access_key)) setSetting.run('ses_secret_access_key', secret_access_key, 'string');
                if (from_email) setSetting.run('ses_from_email', from_email, 'string');
                if (from_name !== undefined) setSetting.run('ses_from_name', from_name || 'Hobo Network', 'string');
                // Per-service from addresses
                if (from_email_hobostreamer !== undefined) setSetting.run('ses_from_email_hobostreamer', from_email_hobostreamer, 'string');
                if (from_email_hoboquest !== undefined) setSetting.run('ses_from_email_hoboquest', from_email_hoboquest, 'string');
                if (from_email_hobotools !== undefined) setSetting.run('ses_from_email_hobotools', from_email_hobotools, 'string');
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
            // Keys managed exclusively by the SES tab — hide from generic settings
            const SES_MANAGED_KEYS = new Set([
                'ses_enabled', 'ses_region', 'ses_access_key_id', 'ses_secret_access_key',
                'ses_from_email', 'ses_from_name',
                'ses_from_email_hobostreamer', 'ses_from_email_hoboquest', 'ses_from_email_hobotools',
            ]);
            for (const r of rows) {
                if (SES_MANAGED_KEYS.has(r.key)) continue;
                settings[r.key] = { value: r.value, type: r.type };
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

    // ═══════════════════════════════════════════════════════
    // Verification Keys (reserved username claims)
    // ═══════════════════════════════════════════════════════

    router.get('/verification-keys', (req, res) => {
        try {
            const keys = db.getAllVerificationKeys();
            res.json({ ok: true, keys });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    router.post('/verification-keys', (req, res) => {
        try {
            const { target_username, note } = req.body;
            if (!target_username) {
                return res.status(400).json({ ok: false, error: 'Target username is required' });
            }
            if (!/^[a-zA-Z0-9_]+$/.test(target_username) || target_username.length < 3 || target_username.length > 24) {
                return res.status(400).json({ ok: false, error: 'Invalid username format (3-24 chars, alphanumeric + underscore)' });
            }

            // Check if username already taken
            const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(target_username);
            if (existingUser) {
                return res.status(409).json({ ok: false, error: `Username "${target_username}" is already registered` });
            }

            // Check for duplicate active key
            const existingKey = db.getVerificationKeyByUsername(target_username);
            if (existingKey) {
                return res.status(409).json({ ok: false, error: `Active key already exists for "${target_username}"` });
            }

            // Generate HOBO-XXXX-XXXX-XXXX
            const crypto = require('crypto');
            const key = 'HOBO-' + [4, 4, 4].map(() =>
                crypto.randomBytes(2).toString('hex').toUpperCase()
            ).join('-');

            db.createVerificationKey({
                key,
                target_username,
                note: note || '',
                created_by: req.user.id,
            });

            const created = db.getVerificationKeyByKey(key);

            db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)').run(
                req.user.id, 'verification_key_create', JSON.stringify({ key, target_username })
            );

            res.status(201).json({ ok: true, key: created });
        } catch (err) {
            console.error('[Admin] Verification key error:', err.message);
            res.status(500).json({ ok: false, error: 'Failed to generate key' });
        }
    });

    router.delete('/verification-keys/:id', (req, res) => {
        try {
            const result = db.revokeVerificationKey(req.params.id);
            if (result.changes === 0) {
                return res.status(404).json({ ok: false, error: 'Key not found or already used/revoked' });
            }

            db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)').run(
                req.user.id, 'verification_key_revoke', JSON.stringify({ keyId: req.params.id })
            );

            res.json({ ok: true, message: 'Verification key revoked' });
        } catch (err) {
            res.status(500).json({ ok: false, error: 'Failed to revoke key' });
        }
    });

    return router;
};
