'use strict';

const express = require('express');
const router = express.Router();
const pushService = require('./push-service');

// All routes require auth (middleware applied by parent)

/** GET /api/push/vapid-key — return the public VAPID key for client subscription */
router.get('/vapid-key', (req, res) => {
    const key = pushService.getPublicKey();
    if (!key) return res.status(503).json({ error: 'Push notifications not configured' });
    res.json({ publicKey: key });
});

/** POST /api/push/subscribe — save a PushSubscription */
router.post('/subscribe', (req, res) => {
    try {
        const { subscription } = req.body;
        if (!subscription) return res.status(400).json({ error: 'Missing subscription' });
        pushService.subscribe(req.user.id, subscription);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/** POST /api/push/unsubscribe — remove a PushSubscription */
router.post('/unsubscribe', (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
    pushService.unsubscribe(req.user.id, endpoint);
    res.json({ success: true });
});

module.exports = router;
