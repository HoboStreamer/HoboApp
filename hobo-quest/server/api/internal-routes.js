'use strict';

/**
 * HoboQuest — Internal API Routes
 * Server-to-server endpoints called by hobostreamer (localhost only).
 * Protected by a shared secret header, NOT by JWT.
 */

const express = require('express');
const router = express.Router();
const db = require('../game/db-adapter');

const INTERNAL_SECRET = 'hobo-internal-2026';

// ── Internal auth: shared secret header ──────────────────────
function requireInternal(req, res, next) {
    if (req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
}

router.use(requireInternal);

// ── Check & consume item from game inventory ─────────────────
// Called by hobostreamer's cosmetics.activateFromGame()
router.post('/inventory/consume', (req, res) => {
    const { userId, itemId, quantity } = req.body;
    if (!userId || !itemId || !quantity) {
        return res.status(400).json({ error: 'userId, itemId, and quantity required' });
    }

    try {
        const d = db.getDb();
        const inv = d.prepare('SELECT quantity FROM game_inventory WHERE user_id = ? AND item_id = ?').get(userId, itemId);
        if (!inv || inv.quantity < quantity) {
            return res.json({ error: 'You don\'t have this item in your game inventory' });
        }

        if (inv.quantity <= quantity) {
            d.prepare('DELETE FROM game_inventory WHERE user_id = ? AND item_id = ?').run(userId, itemId);
        } else {
            d.prepare('UPDATE game_inventory SET quantity = quantity - ? WHERE user_id = ? AND item_id = ?').run(quantity, userId, itemId);
        }

        res.json({ success: true, remaining: Math.max(0, inv.quantity - quantity) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Add item to game inventory ───────────────────────────────
// Called by hobostreamer's cosmetics.deactivateToGame()
router.post('/inventory/add', (req, res) => {
    const { userId, itemId, quantity } = req.body;
    if (!userId || !itemId || !quantity) {
        return res.status(400).json({ error: 'userId, itemId, and quantity required' });
    }

    try {
        const d = db.getDb();
        d.prepare(
            'INSERT INTO game_inventory (user_id, item_id, quantity) VALUES (?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + ?'
        ).run(userId, itemId, quantity, quantity);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Get item count from game inventory ───────────────────────
router.get('/inventory/count', (req, res) => {
    const { userId, itemId } = req.query;
    if (!userId || !itemId) {
        return res.status(400).json({ error: 'userId and itemId required' });
    }

    try {
        const d = db.getDb();
        const inv = d.prepare('SELECT quantity FROM game_inventory WHERE user_id = ? AND item_id = ?').get(userId, itemId);
        res.json({ quantity: inv?.quantity || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
