'use strict';

// ═══════════════════════════════════════════════════════════════
// HoboQuest — Game API Routes (stub)
// Will be fully populated when game engine migrates from hobostreamer.
// For now, provides character + leaderboard endpoints.
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();

function getDb(req) { return req.app.locals.db; }

// ── Get Character ───────────────────────────────────────────
router.get('/character', (req, res) => {
    const { requireAuth } = req.app.locals;
    requireAuth(req, res, () => {
        const db = getDb(req);
        const userId = req.user.sub || req.user.id;
        const character = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(userId);
        if (!character) return res.status(404).json({ error: 'No character found. Play the game to create one!' });

        const skills = db.prepare('SELECT skill_name, level, xp FROM skills WHERE user_id = ?').all(userId);
        const equipment = db.prepare('SELECT * FROM equipment WHERE user_id = ?').get(userId);
        const achievements = db.prepare('SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = ?').all(userId);

        res.json({ character, skills, equipment: equipment || {}, achievements });
    });
});

// ── Get Inventory ───────────────────────────────────────────
router.get('/inventory', (req, res) => {
    const { requireAuth } = req.app.locals;
    requireAuth(req, res, () => {
        const db = getDb(req);
        const userId = req.user.sub || req.user.id;
        const items = db.prepare('SELECT item_id, quantity FROM inventory WHERE user_id = ? AND quantity > 0').all(userId);
        res.json({ items });
    });
});

// ── Leaderboards ────────────────────────────────────────────
router.get('/leaderboard/:board', (req, res) => {
    const db = getDb(req);
    const { board } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const entries = db.prepare(`
        SELECT rank, user_id, username, value FROM leaderboard_cache
        WHERE board = ? ORDER BY rank ASC LIMIT ?
    `).all(board, limit);

    res.json({ board, entries });
});

// ── Available Leaderboards ──────────────────────────────────
router.get('/leaderboards', (_req, res) => {
    res.json({
        boards: [
            { id: 'level', name: 'Top Level', description: 'Highest character levels' },
            { id: 'gold', name: 'Richest', description: 'Most gold accumulated' },
            { id: 'combat', name: 'Warriors', description: 'Highest combat skill' },
            { id: 'fishing', name: 'Anglers', description: 'Highest fishing skill' },
            { id: 'mining', name: 'Miners', description: 'Highest mining skill' },
            { id: 'woodcutting', name: 'Lumberjacks', description: 'Highest woodcutting skill' },
            { id: 'crafting', name: 'Artisans', description: 'Highest crafting skill' },
            { id: 'dungeons', name: 'Dungeon Crawlers', description: 'Deepest dungeon floors' },
            { id: 'achievements', name: 'Completionists', description: 'Most achievements' },
        ],
    });
});

// ── World Buildings (public) ────────────────────────────────
router.get('/buildings', (req, res) => {
    const db = getDb(req);
    const { x1, y1, x2, y2 } = req.query;
    // Return buildings in viewport
    if (x1 && y1 && x2 && y2) {
        const buildings = db.prepare(`
            SELECT id, owner_id, type, x, y, data FROM buildings
            WHERE x BETWEEN ? AND ? AND y BETWEEN ? AND ?
        `).all(parseInt(x1), parseInt(x2), parseInt(y1), parseInt(y2));
        return res.json({ buildings });
    }
    // Return all (limited)
    const buildings = db.prepare('SELECT id, owner_id, type, x, y FROM buildings ORDER BY placed_at DESC LIMIT 500').all();
    res.json({ buildings });
});

module.exports = router;
