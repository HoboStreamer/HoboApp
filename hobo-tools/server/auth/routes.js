'use strict';

// ═══════════════════════════════════════════════════════════════
// hobo.tools — Auth API Routes
// Registration, login, profile management, password changes.
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────

function getDb(req) { return req.app.locals.db; }
function getConfig(req) { return req.app.locals.config; }

function signToken(user, privateKey, config) {
    const algorithm = privateKey.includes('BEGIN') ? 'RS256' : 'HS256';
    return jwt.sign(
        {
            sub: user.id,
            id: user.id,
            username: user.username,
            display_name: user.display_name || user.username,
            role: user.role,
            avatar_url: user.avatar_url,
            profile_color: user.profile_color,
        },
        privateKey,
        {
            algorithm,
            issuer: config.jwt.issuer,
            audience: ['hobostreamer.com', 'hobo.quest', 'hobo.tools'],
            expiresIn: config.jwt.accessTokenExpiry,
        }
    );
}

function sanitizeUser(user) {
    const { password_hash, token_valid_after, ...safe } = user;
    return safe;
}

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.hobo_token;
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const config = getConfig(req);
    const publicKey = req.app.locals.publicKey;
    const algorithm = publicKey.includes('BEGIN') ? 'RS256' : 'HS256';

    try {
        const decoded = jwt.verify(token, publicKey, { algorithms: [algorithm], issuer: config.jwt.issuer });
        const db = getDb(req);
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.sub || decoded.id);
        if (!user) return res.status(401).json({ error: 'User not found' });
        if (user.is_banned) return res.status(403).json({ error: 'Account banned', ban_reason: user.ban_reason });
        if (user.token_valid_after) {
            const tokenIat = decoded.iat * 1000;
            const validAfter = new Date(user.token_valid_after + (user.token_valid_after.includes('Z') ? '' : 'Z')).getTime();
            if (tokenIat < validAfter) return res.status(401).json({ error: 'Token revoked' });
        }
        req.user = user;
        req.token = token;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// ── Register ─────────────────────────────────────────────────
router.post('/register', (req, res) => {
    const db = getDb(req);
    const config = getConfig(req);

    if (!db.getSetting('registration_open')) {
        return res.status(403).json({ error: 'Registration is currently closed' });
    }

    const { username, password, email, verification_key } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (typeof username !== 'string' || username.length < 3 || username.length > 24) {
        return res.status(400).json({ error: 'Username must be 3-24 characters' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (/^anon/i.test(username)) return res.status(400).json({ error: 'Username cannot start with "anon"' });

    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username);
    if (existing) return res.status(409).json({ error: 'Username already taken' });

    // Check if username is reserved (has an active verification key)
    const reserved = db.isUsernameReserved(username);
    if (reserved) {
        if (!verification_key) {
            return res.status(403).json({
                error: 'This username is reserved. A verification key is required to claim it.',
                reserved: true,
            });
        }
        const vk = db.getVerificationKeyByKey(verification_key);
        if (!vk || vk.status !== 'active') {
            return res.status(403).json({ error: 'Invalid or expired verification key' });
        }
        if (vk.target_username.toLowerCase() !== username.toLowerCase()) {
            return res.status(403).json({ error: 'This verification key is for a different username' });
        }
    }

    if (email) {
        const emailExists = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
        if (emailExists) return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
        INSERT INTO users (username, email, password_hash, display_name, profile_color)
        VALUES (?, ?, ?, ?, '#c0965c')
    `).run(username, email || null, passwordHash, username);

    // Create default preferences
    db.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').run(result.lastInsertRowid);

    // Redeem verification key if used
    if (verification_key && reserved) {
        db.redeemVerificationKey(verification_key, result.lastInsertRowid);
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = signToken(user, req.app.locals.privateKey, config);

    console.log(`[Auth] New user registered: ${username} (id: ${user.id})${reserved ? ' [verification key redeemed]' : ''}`);
    res.status(201).json({ token, user: sanitizeUser(user) });
});

// ── Login ────────────────────────────────────────────────────
router.post('/login', (req, res) => {
    const db = getDb(req);
    const config = getConfig(req);

    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username);
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });
    if (user.is_banned) return res.status(403).json({ error: 'Account banned', ban_reason: user.ban_reason });
    if (!bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    const token = signToken(user, req.app.locals.privateKey, config);

    console.log(`[Auth] Login: ${user.username}`);
    res.json({ token, user: sanitizeUser(user) });
});

// ── Get Current User ─────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
    const db = getDb(req);
    const prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);
    res.json({
        user: sanitizeUser(req.user),
        preferences: prefs || { theme_id: 'campfire' },
    });
});

// ── Update Profile ───────────────────────────────────────────
router.put('/profile', requireAuth, (req, res) => {
    const db = getDb(req);
    const { display_name, bio, avatar_url, email, profile_color } = req.body;
    const updates = [];
    const params = [];

    if (display_name !== undefined) { updates.push('display_name = ?'); params.push(display_name); }
    if (bio !== undefined) { updates.push('bio = ?'); params.push(bio.slice(0, 500)); }
    if (avatar_url !== undefined) { updates.push('avatar_url = ?'); params.push(avatar_url); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email || null); }
    if (profile_color !== undefined) { updates.push('profile_color = ?'); params.push(profile_color); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.user.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: sanitizeUser(user) });
});

// ── Change Password ──────────────────────────────────────────
router.post('/change-password', requireAuth, (req, res) => {
    const db = getDb(req);
    const config = getConfig(req);
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    if (!bcrypt.compareSync(current_password, req.user.password_hash)) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password_hash = ?, token_valid_after = CURRENT_TIMESTAMP WHERE id = ?')
        .run(hash, req.user.id);

    // Issue fresh token
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const token = signToken(user, req.app.locals.privateKey, config);

    // Notify about password change
    const notifService = req.app.locals.notificationService;
    if (notifService) {
        notifService.create({
            user_id: user.id,
            type: 'PASSWORD_CHANGED',
            title: 'Password Changed',
            message: 'Your password was changed. If this wasn\'t you, contact support immediately.',
            priority: 'critical',
            category: 'system',
            service: 'hobo-tools',
        });
    }

    res.json({ token, message: 'Password changed. All other sessions have been invalidated.' });
});

// ═══════════════════════════════════════════════════════════════
// Anonymous User Management
// ═══════════════════════════════════════════════════════════════

// ── Create Anonymous Session ─────────────────────────────────
// POST /api/auth/anon-session
// Creates a temporary anonymous identity with a unique number.
router.post('/anon-session', (req, res) => {
    const db = getDb(req);
    const config = getConfig(req);

    try {
        const sessionToken = uuidv4();
        const fingerprint = req.body.fingerprint || null;

        // Check if this fingerprint already has an anon user
        if (fingerprint) {
            const existing = db.prepare('SELECT * FROM anon_users WHERE fingerprint = ?').get(fingerprint);
            if (existing) {
                // Return existing anon user with a fresh session token
                db.prepare('UPDATE anon_users SET session_token = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?')
                    .run(sessionToken, existing.id);
                return res.json({
                    token: sessionToken,
                    user: {
                        id: `anon_${existing.id}`,
                        is_anon: true,
                        anon_number: existing.anon_number,
                        display_name: `Anonymous #${existing.anon_number}`,
                        username: `anon_${existing.anon_number}`,
                        preferences: JSON.parse(existing.preferences || '{}'),
                        total_messages: existing.total_messages,
                        total_commands: existing.total_commands,
                        first_seen: existing.first_seen,
                    },
                });
            }
        }

        // Generate next anon number
        const maxNum = db.prepare('SELECT MAX(anon_number) as max FROM anon_users').get().max || 0;
        const anonNumber = maxNum + 1;

        const result = db.prepare(
            'INSERT INTO anon_users (anon_number, fingerprint, session_token) VALUES (?, ?, ?)'
        ).run(anonNumber, fingerprint, sessionToken);

        console.log(`[Auth] New anonymous user: #${anonNumber}`);
        res.json({
            token: sessionToken,
            user: {
                id: `anon_${result.lastInsertRowid}`,
                is_anon: true,
                anon_number: anonNumber,
                display_name: `Anonymous #${anonNumber}`,
                username: `anon_${anonNumber}`,
                preferences: {},
                total_messages: 0,
                total_commands: 0,
            },
        });
    } catch (err) {
        console.error('[Auth] Anon session error:', err);
        res.status(500).json({ error: 'Failed to create anonymous session' });
    }
});

// ── Get Anonymous User Info ──────────────────────────────────
// GET /api/auth/anon/:token
router.get('/anon/:token', (req, res) => {
    const db = getDb(req);
    const anon = db.prepare('SELECT * FROM anon_users WHERE session_token = ?').get(req.params.token);
    if (!anon) return res.status(404).json({ error: 'Anonymous session not found' });

    db.prepare('UPDATE anon_users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(anon.id);

    res.json({
        user: {
            id: `anon_${anon.id}`,
            is_anon: true,
            anon_number: anon.anon_number,
            display_name: anon.display_name || `Anonymous #${anon.anon_number}`,
            username: `anon_${anon.anon_number}`,
            preferences: JSON.parse(anon.preferences || '{}'),
            total_messages: anon.total_messages,
            total_commands: anon.total_commands,
            first_seen: anon.first_seen,
            last_seen: anon.last_seen,
        },
    });
});

// ── Update Anonymous User Preferences ────────────────────────
// PUT /api/auth/anon/:token/preferences
router.put('/anon/:token/preferences', (req, res) => {
    const db = getDb(req);
    const anon = db.prepare('SELECT * FROM anon_users WHERE session_token = ?').get(req.params.token);
    if (!anon) return res.status(404).json({ error: 'Anonymous session not found' });

    const current = JSON.parse(anon.preferences || '{}');
    const updated = { ...current, ...req.body };
    // Only allow safe preference keys
    const allowed = ['theme_id', 'language', 'display_name', 'notifications_enabled'];
    const safe = {};
    for (const key of allowed) {
        if (updated[key] !== undefined) safe[key] = updated[key];
    }

    db.prepare('UPDATE anon_users SET preferences = ?, display_name = ? WHERE id = ?')
        .run(JSON.stringify(safe), safe.display_name || anon.display_name, anon.id);

    res.json({ ok: true, preferences: safe });
});

// ── Link Anonymous to Registered Account ─────────────────────
// POST /api/auth/anon/:token/link
// Merges anon stats into the authenticated user's account.
router.post('/anon/:token/link', requireAuth, (req, res) => {
    const db = getDb(req);
    const anon = db.prepare('SELECT * FROM anon_users WHERE session_token = ?').get(req.params.token);
    if (!anon) return res.status(404).json({ error: 'Anonymous session not found' });

    // Store anon number on the user for reference
    db.prepare('UPDATE users SET anon_number = ? WHERE id = ? AND anon_number IS NULL')
        .run(anon.anon_number, req.user.id);

    console.log(`[Auth] Linked anon #${anon.anon_number} → user ${req.user.username}`);
    res.json({ ok: true, anon_number: anon.anon_number });
});

// ═══════════════════════════════════════════════════════════════
// Multi-Account Session Management
// ═══════════════════════════════════════════════════════════════

// ── List Active Sessions ─────────────────────────────────────
// GET /api/auth/sessions
router.get('/sessions', requireAuth, (req, res) => {
    const db = getDb(req);
    const sessions = db.prepare(`
        SELECT id, device_name, ip, last_used, created_at FROM user_sessions
        WHERE user_id = ? AND is_active = 1
        ORDER BY last_used DESC
    `).all(req.user.id);
    res.json({ ok: true, sessions });
});

// ── Create Session (for multi-account) ───────────────────────
// POST /api/auth/sessions
// Called when logging in with "add account" — stores session token.
router.post('/sessions', requireAuth, (req, res) => {
    const db = getDb(req);
    const config = getConfig(req);

    const sessionToken = uuidv4();
    const deviceName = req.body.device_name || req.headers['user-agent']?.slice(0, 100) || 'Unknown';
    const ip = req.ip;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    db.prepare(`
        INSERT INTO user_sessions (user_id, session_token, device_name, ip, user_agent, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.id, sessionToken, deviceName, ip, req.headers['user-agent'] || '', expiresAt);

    // Issue a JWT for this session
    const token = signToken(req.user, req.app.locals.privateKey, config);

    res.json({ ok: true, session_token: sessionToken, token });
});

// ── Revoke Session ───────────────────────────────────────────
// DELETE /api/auth/sessions/:id
router.delete('/sessions/:id', requireAuth, (req, res) => {
    const db = getDb(req);
    const result = db.prepare('UPDATE user_sessions SET is_active = 0 WHERE id = ? AND user_id = ?')
        .run(req.params.id, req.user.id);
    res.json({ ok: true, revoked: result.changes > 0 });
});

// ── Revoke All Sessions ──────────────────────────────────────
// DELETE /api/auth/sessions
router.delete('/sessions', requireAuth, (req, res) => {
    const db = getDb(req);
    const result = db.prepare('UPDATE user_sessions SET is_active = 0 WHERE user_id = ?').run(req.user.id);
    res.json({ ok: true, revoked: result.changes });
});

// ═══════════════════════════════════════════════════════════════
// User Card / Public Profile
// ═══════════════════════════════════════════════════════════════

// GET /api/users/:id/card — public user card data for context menus
router.get('/users/:id/card', (req, res) => {
    const db = getDb(req);
    const userId = req.params.id;

    const user = db.prepare(`
        SELECT id, username, display_name, avatar_url, bio, role, profile_color,
               name_effect, particle_effect, is_anon, anon_number, created_at
        FROM users WHERE id = ?
    `).get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Linked services
    const linked = db.prepare('SELECT service, service_username FROM linked_accounts WHERE user_id = ?').all(userId);

    // Follower count
    const followers = db.prepare('SELECT COUNT(*) as cnt FROM follows WHERE followed_id = ?').get(userId)?.cnt || 0;
    const following = db.prepare('SELECT COUNT(*) as cnt FROM follows WHERE follower_id = ?').get(userId)?.cnt || 0;

    // Is current user following this user?
    let isFollowing = false;
    if (req.headers.authorization) {
        try {
            const publicKey = req.app.locals.publicKey;
            const config = getConfig(req);
            const algorithm = publicKey.includes('BEGIN') ? 'RS256' : 'HS256';
            const token = req.headers.authorization.replace('Bearer ', '');
            const decoded = jwt.verify(token, publicKey, { algorithms: [algorithm], issuer: config.jwt.issuer });
            const follow = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?').get(decoded.sub || decoded.id, userId);
            isFollowing = !!follow;
        } catch { /* not logged in, fine */ }
    }

    // Active effects
    const effects = db.prepare(`
        SELECT effect_type, effect_id FROM user_effects
        WHERE user_id = ? AND is_active = 1
    `).all(userId);

    res.json({
        ok: true,
        user: {
            ...user,
            linked_services: linked,
            followers,
            following,
            is_following: isFollowing,
            active_effects: effects,
        },
    });
});

// POST /api/users/:id/follow
router.post('/users/:id/follow', requireAuth, (req, res) => {
    const db = getDb(req);
    const targetId = parseInt(req.params.id);
    if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });

    try {
        db.prepare('INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)').run(req.user.id, targetId);

        // Notify target
        const notifService = req.app.locals.notificationService;
        if (notifService) {
            notifService.create({
                user_id: targetId,
                type: 'FOLLOW',
                title: 'New Follower',
                message: `${req.user.display_name || req.user.username} started following you`,
                sender_id: req.user.id,
                sender_name: req.user.display_name || req.user.username,
                sender_avatar: req.user.avatar_url,
                url: `https://hobo.tools/user/${req.user.username}`,
                service: 'hobo-tools',
            });
        }

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to follow' });
    }
});

// DELETE /api/users/:id/follow
router.delete('/users/:id/follow', requireAuth, (req, res) => {
    const db = getDb(req);
    const targetId = parseInt(req.params.id);
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND followed_id = ?').run(req.user.id, targetId);
    res.json({ ok: true });
});

module.exports = router;
