'use strict';

// ═══════════════════════════════════════════════════════════════
// HoboQuest — Auth Routes (OAuth2 Client)
// Handles the callback from hobo.tools OAuth2 flow.
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const config = require('../config');

// ── OAuth2 Callback ─────────────────────────────────────────
// User is redirected here after authorizing on hobo.tools
router.get('/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error) {
        return res.status(400).send(`<h2>Authorization denied</h2><p>${error}</p><a href="/">Go home</a>`);
    }
    if (!code) {
        return res.status(400).send('<h2>Missing authorization code</h2><a href="/">Go home</a>');
    }

    try {
        // Exchange code for tokens with hobo.tools
        const tokenRes = await fetch(`${config.oauth.tokenUrl || config.hoboTools.url + '/oauth/token'}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                code,
                client_id: config.oauth.clientId,
                client_secret: config.oauth.clientSecret,
                redirect_uri: config.oauth.redirectUri,
            }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenData.error || 'Token exchange failed');

        const { access_token, refresh_token } = tokenData;

        // Verify + decode the access token to get user info
        const jwt = require('jsonwebtoken');
        const publicKey = req.app.locals.publicKey;
        const algorithm = publicKey.includes('BEGIN') ? 'RS256' : 'HS256';
        const decoded = jwt.verify(access_token, publicKey, {
            algorithms: [algorithm],
            issuer: config.jwt.issuer,
        });

        // Upsert character in our game database
        const db = req.app.locals.db;
        const userId = decoded.sub || decoded.id;
        const username = decoded.username;

        const existing = db.prepare('SELECT user_id FROM characters WHERE user_id = ?').get(userId);
        if (!existing) {
            db.prepare(`
                INSERT INTO characters (user_id, username, x, y)
                VALUES (?, ?, 256, 256)
            `).run(userId, username);
            console.log(`[hobo-quest] New character created for ${username}`);
        } else {
            db.prepare('UPDATE characters SET username = ?, last_active = CURRENT_TIMESTAMP WHERE user_id = ?').run(username, userId);
        }

        // Set cookies and redirect to game
        res.cookie('hobo_token', access_token, {
            httpOnly: false, // JS needs access for WebSocket auth
            maxAge: 24 * 60 * 60 * 1000, // 24h
            sameSite: 'Lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
        });

        if (refresh_token) {
            res.cookie('hobo_refresh', refresh_token, {
                httpOnly: true,
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30d
                sameSite: 'Lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/auth/',
            });
        }

        res.redirect('/');
    } catch (err) {
        console.error('[hobo-quest] OAuth callback error:', err.message);
        res.status(500).send(`<h2>Authentication failed</h2><p>${err.message}</p><a href="/">Try again</a>`);
    }
});

// ── Initiate Login (redirect to hobo.tools) ─────────────────
router.get('/login', (_req, res) => {
    const params = new URLSearchParams({
        client_id: config.oauth.clientId,
        redirect_uri: config.oauth.redirectUri,
        response_type: 'code',
        scope: 'profile game',
    });
    res.redirect(`${config.oauth.authorizationUrl}?${params.toString()}`);
});

// ── Logout ──────────────────────────────────────────────────
router.get('/logout', (_req, res) => {
    res.clearCookie('hobo_token', { path: '/' });
    res.clearCookie('hobo_refresh', { path: '/auth/' });
    res.redirect('/');
});

// ── Get Current User (from JWT) ─────────────────────────────
router.get('/me', (req, res) => {
    const { requireAuth } = req.app.locals;
    requireAuth(req, res, () => {
        const db = req.app.locals.db;
        const userId = req.user.sub || req.user.id;
        const character = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(userId);
        res.json({ user: req.user, character: character || null });
    });
});

module.exports = router;
