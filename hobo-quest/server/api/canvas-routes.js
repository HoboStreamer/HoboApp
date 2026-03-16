'use strict';

// ═══════════════════════════════════════════════════════════════
// HoboQuest — Canvas API Routes (stub)
// Collaborative pixel canvas (r/place style).
// Will be fully populated when canvas migrates from hobostreamer.
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();

function getDb(req) { return req.app.locals.db; }

// ── Get Canvas State (batch) ────────────────────────────────
// Returns all pixels — client caches and applies deltas via WebSocket.
router.get('/state', (req, res) => {
    const db = getDb(req);
    const pixels = db.prepare('SELECT x, y, color FROM canvas_pixels').all();
    res.json({ size: 512, pixels });
});

// ── Get Single Pixel ────────────────────────────────────────
router.get('/pixel/:x/:y', (req, res) => {
    const db = getDb(req);
    const x = parseInt(req.params.x);
    const y = parseInt(req.params.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 511 || y > 511) {
        return res.status(400).json({ error: 'Invalid coordinates (0-511)' });
    }
    const pixel = db.prepare('SELECT x, y, color, placed_by, placed_at FROM canvas_pixels WHERE x = ? AND y = ?').get(x, y);
    res.json({ pixel: pixel || { x, y, color: '#FFFFFF', placed_by: null } });
});

// ── Place Pixel ─────────────────────────────────────────────
router.post('/pixel', (req, res) => {
    const { requireAuth } = req.app.locals;
    requireAuth(req, res, () => {
        const db = getDb(req);
        const config = req.app.locals.config;
        const userId = req.user.sub || req.user.id;
        const { x, y, color } = req.body;

        // Validate
        const px = parseInt(x);
        const py = parseInt(y);
        if (!Number.isFinite(px) || !Number.isFinite(py) || px < 0 || py < 0 || px > 511 || py > 511) {
            return res.status(400).json({ error: 'Invalid coordinates (0-511)' });
        }
        if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
            return res.status(400).json({ error: 'Invalid color (hex #RRGGBB)' });
        }

        // Cooldown check
        const role = req.user.role || 'user';
        const cooldownSecs = role === 'admin' || role === 'global_mod'
            ? config.canvas.cooldowns.staff
            : config.canvas.cooldowns.default;

        const lastPlace = db.prepare('SELECT last_place FROM canvas_cooldowns WHERE user_id = ?').get(userId);
        if (lastPlace) {
            const elapsed = (Date.now() - new Date(lastPlace.last_place + 'Z').getTime()) / 1000;
            if (elapsed < cooldownSecs) {
                return res.status(429).json({
                    error: 'Cooldown active',
                    remaining: Math.ceil(cooldownSecs - elapsed),
                });
            }
        }

        // Place
        db.prepare(`
            INSERT INTO canvas_pixels (x, y, color, placed_by, placed_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(x, y) DO UPDATE SET
                color = ?, placed_by = ?, placed_at = CURRENT_TIMESTAMP
        `).run(px, py, color, userId, color, userId);

        db.prepare(`
            INSERT INTO canvas_cooldowns (user_id, last_place)
            VALUES (?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET last_place = CURRENT_TIMESTAMP
        `).run(userId);

        // TODO: Broadcast via WebSocket to all connected clients
        res.json({ success: true, pixel: { x: px, y: py, color, placed_by: userId } });
    });
});

// ── Canvas Stats ────────────────────────────────────────────
router.get('/stats', (req, res) => {
    const db = getDb(req);
    const total = db.prepare('SELECT COUNT(*) as count FROM canvas_pixels').get().count;
    const unique = db.prepare('SELECT COUNT(DISTINCT placed_by) as count FROM canvas_pixels WHERE placed_by IS NOT NULL').get().count;
    res.json({ total_pixels: total, unique_artists: unique, canvas_size: 512 });
});

module.exports = router;
