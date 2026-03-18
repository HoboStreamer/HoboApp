'use strict';

/**
 * HoboQuest — Game API Routes (Full)
 * Ported from hobostreamer/server/game/routes.js
 * Uses hobo-quest JWT auth instead of hobostreamer's game-auth.
 */

const express = require('express');
const http = require('http');
const router = express.Router();
const game = require('../game/game-engine');
const db = require('../game/db-adapter');
const tags = require('../game/tags');

// Auth middleware — pulled from app.locals (set in index.js)
function requireGameAuth(req, res, next) {
    const fn = req.app.locals.requireAuth;
    if (!fn) return res.status(500).json({ error: 'Auth not configured' });
    fn(req, res, () => {
        req.user.id = req.user.sub || req.user.id;
        next();
    });
}

// Public endpoints (no auth required)
router.get('/leaderboard/:type', (req, res) => {
    try { res.json({ success: true, entries: game.getLeaderboard(req.params.type) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.use(requireGameAuth);

// ══════════════════════════════════════════════════════════════
//  PLAYER
// ══════════════════════════════════════════════════════════════

router.get('/player', (req, res) => {
    try {
        const player = game.getPlayer(req.user.id);
        const user = db.getUserById(req.user.id);
        player.hobo_coins = user?.hobo_coins_balance || 0;
        res.json({ success: true, player });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  INVENTORY & BANK
// ══════════════════════════════════════════════════════════════

router.get('/inventory', (req, res) => {
    try { res.json({ success: true, items: game.getInventory(req.user.id) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/bank', (req, res) => {
    try {
        if (!game.isNearBankNPC(req.user.id)) return res.status(403).json({ error: 'You must visit the Bank NPC in the Outpost!' });
        res.json({ success: true, items: game.getBank(req.user.id) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/bank/deposit', (req, res) => {
    try {
        if (!game.isNearBankNPC(req.user.id)) return res.status(403).json({ error: 'You must visit the Bank NPC in the Outpost!' });
        const { itemId, quantity } = req.body;
        const ok = game.bankDeposit(req.user.id, itemId, quantity || 1);
        if (!ok) return res.json({ error: 'Not enough items' });
        res.json({ success: true, bank: game.getBank(req.user.id), inventory: game.getInventory(req.user.id) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/bank/withdraw', (req, res) => {
    try {
        if (!game.isNearBankNPC(req.user.id)) return res.status(403).json({ error: 'You must visit the Bank NPC in the Outpost!' });
        const { itemId, quantity } = req.body;
        const ok = game.bankWithdraw(req.user.id, itemId, quantity || 1);
        if (!ok) return res.json({ error: 'Not enough in bank' });
        res.json({ success: true, bank: game.getBank(req.user.id), inventory: game.getInventory(req.user.id) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  NPC INTERACTION
// ══════════════════════════════════════════════════════════════

router.post('/npc/interact', (req, res) => {
    try {
        const { npcId } = req.body;
        if (!npcId) return res.json({ error: 'No NPC specified' });
        if (!game.isNearNPC(req.user.id, npcId)) return res.json({ error: 'Too far from NPC' });
        const user = db.getUserById(req.user.id);
        const inv = game.getInventory(req.user.id);
        if (npcId === 'banker') {
            const bank = game.getBank(req.user.id);
            return res.json({ success: true, npcId, type: 'bank', bank, inventory: inv, hobo_coins: user?.hobo_coins_balance || 0 });
        }
        if (npcId === 'tagmaster') {
            const guardianDefeated = tags.hasDefeatedGuardian(req.user.id);
            const shopTags = guardianDefeated ? tags.getShopTags() : [];
            const ownedTags = tags.getUserTags(req.user.id);
            const equipped = tags.getEquippedTag(req.user.id);
            return res.json({
                success: true, npcId, type: 'tag_shop',
                guardianDefeated, tags: shopTags, ownedTags, equipped,
                guardian: !guardianDefeated ? tags.TAG_GUARDIAN : null,
                hobo_coins: user?.hobo_coins_balance || 0,
            });
        }
        const items = game.getShopItemsForNPC(npcId);
        const player = game.getPlayer(req.user.id);
        return res.json({ success: true, npcId, type: 'shop', items, inventory: inv, hobo_coins: user?.hobo_coins_balance || 0, playerLevels: {
            mining: player.mining_level, fishing: player.fishing_level, woodcut: player.woodcut_level,
            combat: player.combat_level, crafting: player.crafting_level,
        }});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/npc/buy', (req, res) => {
    try {
        const { npcId, itemId, quantity } = req.body;
        if (!game.isNearNPC(req.user.id, npcId)) return res.json({ error: 'Too far from NPC' });
        const result = game.buyItem(req.user.id, itemId, quantity || 1);
        if (result.error) return res.json(result);
        const user = db.getUserById(req.user.id);
        const inventory = game.getInventory(req.user.id);
        const player = game.getPlayer(req.user.id);
        res.json({ ...result, hobo_coins: user?.hobo_coins_balance || 0, inventory,
            equip_pickaxe: player.equip_pickaxe, equip_axe: player.equip_axe,
            equip_rod: player.equip_rod, equip_weapon: player.equip_weapon,
            equip_armor: player.equip_armor, equip_hat: player.equip_hat,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/npc/sell', (req, res) => {
    try {
        const { npcId, itemId, quantity } = req.body;
        if (!game.isNearNPC(req.user.id, npcId)) return res.json({ error: 'Too far from NPC' });
        const result = game.sellItem(req.user.id, itemId, quantity || 1);
        if (result.error) return res.json(result);
        const user = db.getUserById(req.user.id);
        res.json({ ...result, hobo_coins: user?.hobo_coins_balance || 0 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  SHOP
// ══════════════════════════════════════════════════════════════

router.get('/shop', (req, res) => {
    try { res.json({ success: true, items: game.getShopItems() }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/shop/buy', (req, res) => {
    try {
        const result = game.buyItem(req.user.id, req.body.itemId, req.body.quantity || 1);
        if (result.error) return res.json(result);
        const user = db.getUserById(req.user.id);
        res.json({ ...result, hobo_coins: user?.hobo_coins_balance || 0 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/shop/sell', (req, res) => {
    try {
        const result = game.sellItem(req.user.id, req.body.itemId, req.body.quantity || 1);
        if (result.error) return res.json(result);
        const user = db.getUserById(req.user.id);
        res.json({ ...result, hobo_coins: user?.hobo_coins_balance || 0 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/coinshop', (req, res) => {
    try { res.json({ success: true, items: game.getCoinShopItems() }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/coinshop/buy', (req, res) => {
    try {
        const result = game.buyWithCoins(req.user.id, req.body.itemId);
        if (result.error) return res.json(result);
        const user = db.getUserById(req.user.id);
        res.json({ ...result, hobo_coins: user?.hobo_coins_balance || 0 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  GATHERING
// ══════════════════════════════════════════════════════════════

router.post('/gather', (req, res) => {
    try { res.json(game.gather(req.user.id, req.body.tileX, req.body.tileY)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  BUILDING
// ══════════════════════════════════════════════════════════════

router.post('/build', (req, res) => {
    try { res.json(game.placeStructure(req.user.id, req.body.structureType, req.body.tileX, req.body.tileY)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/destroy', (req, res) => {
    try { res.json(game.destroyStructure(req.user.id, req.body.tileX, req.body.tileY)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/storage/deposit', (req, res) => {
    try { res.json(game.storageDeposit(req.user.id, req.body.structureId, req.body.itemId, req.body.quantity || 1)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/storage/withdraw', (req, res) => {
    try { res.json(game.storageWithdraw(req.user.id, req.body.structureId, req.body.itemId, req.body.quantity || 1)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  FARMING
// ══════════════════════════════════════════════════════════════

router.get('/farm', (req, res) => {
    try { res.json({ success: true, plots: game.getFarmPlots(req.user.id) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/farm/plant', (req, res) => {
    try { res.json(game.plant(req.user.id, req.body.plotIndex, req.body.seedId)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/farm/water', (req, res) => {
    try { res.json(game.water(req.user.id, req.body.plotIndex)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/farm/harvest', (req, res) => {
    try { res.json(game.harvest(req.user.id, req.body.plotIndex)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  CRAFTING & SMELTING
// ══════════════════════════════════════════════════════════════

router.get('/recipes', (req, res) => {
    try { res.json({ success: true, recipes: game.getUnlockedRecipes(req.user.id) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/craft', (req, res) => {
    try {
        const result = game.craft(req.user.id, req.body.recipeId);
        if (result.error) return res.json(result);
        const unlock = game.rollRecipeUnlock(req.user.id);
        res.json({ ...result, newRecipe: unlock });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/smelt', (req, res) => {
    try { res.json(game.smelt(req.user.id, req.body.recipeId)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  COMBAT
// ══════════════════════════════════════════════════════════════

router.post('/attack', (req, res) => {
    try { res.json(game.attackPlayer(req.user.id, req.body.targetId)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/battlestats', (req, res) => {
    try { res.json({ success: true, stats: game.getBattleStats(req.user.id) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/dungeon/enter', (req, res) => {
    try { res.json(game.enterDungeon(req.user.id)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/dungeon/fight', (req, res) => {
    try { res.json(game.fightMonster(req.user.id, req.body.monster)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  EQUIPMENT
// ══════════════════════════════════════════════════════════════

router.post('/equip', (req, res) => {
    try {
        const result = game.equipItem(req.user.id, req.body.itemId);
        if (result.success) {
            const player = game.getPlayer(req.user.id);
            const existing = game.getLivePlayers()[req.user.id];
            if (existing) {
                game.updateLivePlayer(req.user.id, {
                    ...existing,
                    equip_weapon: player.equip_weapon, equip_armor: player.equip_armor,
                    equip_hat: player.equip_hat, equip_pickaxe: player.equip_pickaxe,
                    equip_axe: player.equip_axe, equip_rod: player.equip_rod,
                });
            }
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/unequip', (req, res) => {
    try {
        const result = game.unequipItem(req.user.id, req.body.slot);
        if (result.success) {
            const player = game.getPlayer(req.user.id);
            const existing = game.getLivePlayers()[req.user.id];
            if (existing) {
                game.updateLivePlayer(req.user.id, {
                    ...existing,
                    equip_weapon: player.equip_weapon, equip_armor: player.equip_armor,
                    equip_hat: player.equip_hat, equip_pickaxe: player.equip_pickaxe,
                    equip_axe: player.equip_axe, equip_rod: player.equip_rod,
                });
            }
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/cosmetic/equip', (req, res) => {
    try { res.json(game.equipCosmetic(req.user.id, req.body.itemId)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/cosmetic/unequip', (req, res) => {
    try { res.json(game.unequipCosmetic(req.user.id, req.body.type)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// Proxy cosmetic activation to hobostreamer (where global cosmetics live)
router.post('/cosmetic/activate', (req, res) => {
    const token = req.headers.authorization?.slice(7) || req.cookies?.hobo_token || '';
    const body = JSON.stringify({ itemId: req.body.itemId });
    const proxyReq = http.request('http://127.0.0.1:3000/api/cosmetics/activate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Content-Length': Buffer.byteLength(body),
        },
        timeout: 5000,
    }, (proxyRes) => {
        let chunks = '';
        proxyRes.on('data', (c) => chunks += c);
        proxyRes.on('end', () => {
            try { res.status(proxyRes.statusCode).json(JSON.parse(chunks)); }
            catch { res.status(502).json({ error: 'Bad gateway' }); }
        });
    });
    proxyReq.on('error', () => res.status(502).json({ error: 'HoboStreamer unavailable' }));
    proxyReq.on('timeout', () => { proxyReq.destroy(); res.status(504).json({ error: 'Gateway timeout' }); });
    proxyReq.write(body);
    proxyReq.end();
});

// ══════════════════════════════════════════════════════════════
//  FISHING
// ══════════════════════════════════════════════════════════════

router.post('/use-sonar', (req, res) => {
    try { res.json(game.useSonar(req.user.id, req.body.tileX, req.body.tileY)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/fish-collection', (req, res) => {
    try { res.json({ success: true, ...game.getFishCollection(req.user.id) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  CONSUMABLES & EFFECTS
// ══════════════════════════════════════════════════════════════

router.post('/use', (req, res) => {
    try { res.json(game.useConsumable(req.user.id, req.body.itemId)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/effects', (req, res) => {
    try { res.json({ success: true, effects: game.getActiveEffects(req.user.id) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  ACHIEVEMENTS & DAILY QUESTS
// ══════════════════════════════════════════════════════════════

router.get('/achievements', (req, res) => {
    try { res.json({ success: true, ...game.getAchievements(req.user.id) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/daily-quests', (req, res) => {
    try { res.json({ success: true, ...game.getDailyQuests(req.user.id) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/daily-quests/claim', (req, res) => {
    try { res.json(game.claimDailyQuest(req.user.id, req.body.questId)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  TAGS
// ══════════════════════════════════════════════════════════════

router.get('/tags', (req, res) => {
    try {
        const owned = tags.getUserTags(req.user.id);
        const equipped = tags.getEquippedTag(req.user.id);
        res.json({ success: true, tags: owned, equipped });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/tags/shop', (req, res) => {
    try {
        const shopTags = tags.getShopTags();
        const guardianDefeated = tags.hasDefeatedGuardian(req.user.id);
        const user = db.getUserById(req.user.id);
        res.json({ success: true, tags: shopTags, guardianDefeated, hobo_coins: user?.hobo_coins_balance || 0 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/tags/catalog', (req, res) => {
    try { res.json({ success: true, tags: tags.getAllTags() }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tags/guardian/fight', (req, res) => {
    try {
        if (!game.isNearNPC(req.user.id, 'tagmaster')) return res.json({ error: 'You must be near the Tag Master\'s building!' });
        res.json(tags.fightGuardian(req.user.id));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tags/buy', (req, res) => {
    try {
        if (!game.isNearNPC(req.user.id, 'tagmaster')) return res.json({ error: 'You must visit the Tag Master NPC!' });
        const result = tags.buyTag(req.user.id, req.body.tagId);
        if (result.error) return res.json(result);
        const user = db.getUserById(req.user.id);
        res.json({ ...result, hobo_coins: user?.hobo_coins_balance || 0 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tags/equip', (req, res) => {
    try { res.json(tags.equipTag(req.user.id, req.body.tagId)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tags/unequip', (req, res) => {
    try { res.json(tags.unequipTag(req.user.id)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
