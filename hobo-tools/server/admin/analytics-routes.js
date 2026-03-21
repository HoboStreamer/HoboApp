'use strict';

// ═══════════════════════════════════════════════════════════════
// Admin Panel — Analytics Routes
// Mounted at /api/admin/analytics. Requires admin role.
// Aggregates analytics from all Hobo Network services:
//   hobo-tools (local), hobostreamer, hobo-quest,
//   hobo-maps, hobo-food, hobo-img, hobo-yt,
//   hobo-audio, hobo-text
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();

module.exports = function createAnalyticsRoutes(analytics, requireAuth, config) {

    const INTERNAL_SECRET = 'hobo-internal-2026';

    // All remote services with their internal URLs and fetch strategy
    const REMOTE_SERVICES = [
        { name: 'hobostreamer', label: 'HoboStreamer',     url: config.services?.hobostreamer?.internalUrl || 'http://127.0.0.1:3000', path: '/api/admin/analytics',    auth: 'bearer' },
        { name: 'hobo-quest',   label: 'Hobo.Quest',       url: config.services?.hoboquest?.internalUrl    || 'http://127.0.0.1:3200', path: '/api/internal/analytics', auth: 'internal' },
        { name: 'hobo-maps',    label: 'Hobo.Maps',        url: config.services?.hobomaps?.internalUrl     || 'http://127.0.0.1:3300', path: '/api/internal/analytics', auth: 'internal' },
        { name: 'hobo-food',    label: 'Hobo.Food',        url: config.services?.hobofood?.internalUrl     || 'http://127.0.0.1:3301', path: '/api/internal/analytics', auth: 'internal' },
        { name: 'hobo-img',     label: 'Hobo.Img',         url: config.services?.hoboimg?.internalUrl      || 'http://127.0.0.1:3400', path: '/api/internal/analytics', auth: 'internal' },
        { name: 'hobo-yt',      label: 'Hobo.YT',          url: config.services?.hoboyt?.internalUrl       || 'http://127.0.0.1:3401', path: '/api/internal/analytics', auth: 'internal' },
        { name: 'hobo-audio',   label: 'Hobo.Audio',       url: config.services?.hoboaudio?.internalUrl    || 'http://127.0.0.1:3500', path: '/api/internal/analytics', auth: 'internal' },
        { name: 'hobo-text',    label: 'Hobo.Text',        url: config.services?.hobotext?.internalUrl     || 'http://127.0.0.1:3600', path: '/api/internal/analytics', auth: 'internal' },
    ];

    function requireAdmin(req, res, next) {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ ok: false, error: 'Admin access required' });
        }
        next();
    }

    router.use(requireAuth, requireAdmin);

    // ── Helper: fetch analytics from a remote service ────────
    async function fetchRemoteAnalytics(svc, subPath, token, days) {
        try {
            const url = `${svc.url}${svc.path}${subPath}?days=${days}`;
            const headers = { 'Content-Type': 'application/json' };

            if (svc.auth === 'internal') {
                headers['X-Internal-Secret'] = INTERNAL_SECRET;
            } else {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
            if (!res.ok) return null;
            return await res.json();
        } catch (err) {
            console.warn(`[Analytics] Failed to fetch from ${svc.name}:`, err.message);
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Overview — Cross-Service Summary
    // ═══════════════════════════════════════════════════════════

    router.get('/overview', async (req, res) => {
        try {
            const days = Math.min(parseInt(req.query.days) || 30, 365);

            // Fetch from all services in parallel
            const promises = [
                Promise.resolve({ ok: true, analytics: analytics.getStats({ days }), name: 'hobo-tools', label: 'Hobo.Tools' }),
                ...REMOTE_SERVICES.map(svc =>
                    fetchRemoteAnalytics(svc, '', req.token, days).then(result => ({
                        ...result, name: svc.name, label: svc.label,
                    }))
                ),
            ];

            const results = await Promise.allSettled(promises);

            // Build service list
            const services = [];
            const allDataSources = [];
            for (const r of results) {
                if (r.status !== 'fulfilled' || !r.value) continue;
                const v = r.value;
                const data = v.analytics;
                if (!data) continue;

                allDataSources.push(data);
                services.push({
                    name: v.name,
                    label: v.label,
                    ...data.summary,
                    realtime: data.realtime,
                });
            }

            // Combined totals
            const totals = {
                total_pageviews: services.reduce((s, v) => s + (v.total_pageviews || 0), 0),
                total_api_calls: services.reduce((s, v) => s + (v.total_api_calls || 0), 0),
                total_unique_visitors: services.reduce((s, v) => s + (v.total_unique_visitors || 0), 0),
                total_unique_users: services.reduce((s, v) => s + (v.total_unique_users || 0), 0),
                total_bot_hits: services.reduce((s, v) => s + (v.total_bot_hits || 0), 0),
                total_errors: services.reduce((s, v) => s + (v.total_errors || 0), 0),
                avg_response_ms: Math.round(services.reduce((s, v) => s + (v.avg_response_ms || 0), 0) / Math.max(services.length, 1)),
            };

            // Combine daily trends from all data sources
            const dailyMap = new Map();
            for (const src of allDataSources) {
                if (!src?.daily) continue;
                for (const d of src.daily) {
                    const existing = dailyMap.get(d.date) || { date: d.date, pageviews: 0, api_calls: 0, unique_visitors: 0, bot_hits: 0 };
                    existing.pageviews += d.pageviews || 0;
                    existing.api_calls += d.api_calls || 0;
                    existing.unique_visitors += d.unique_visitors || 0;
                    existing.bot_hits += d.bot_hits || 0;
                    dailyMap.set(d.date, existing);
                }
            }
            const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

            // Realtime across services
            const realtimeTotal = {
                requests: services.reduce((s, v) => s + (v.realtime?.requests || 0), 0),
                visitors: services.reduce((s, v) => s + (v.realtime?.visitors || 0), 0),
                bots: services.reduce((s, v) => s + (v.realtime?.bots || 0), 0),
            };

            res.json({
                ok: true,
                overview: {
                    period_days: days,
                    totals,
                    services,
                    dailyTrend,
                    realtime: realtimeTotal,
                },
            });
        } catch (err) {
            console.error('[Analytics] Overview error:', err);
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ═══════════════════════════════════════════════════════════
    // Per-Service Detail
    // ═══════════════════════════════════════════════════════════

    router.get('/service/:name', async (req, res) => {
        try {
            const { name } = req.params;
            const days = Math.min(parseInt(req.query.days) || 30, 365);
            let data = null;

            if (name === 'hobo-tools') {
                data = analytics.getStats({ days });
            } else {
                const svc = REMOTE_SERVICES.find(s => s.name === name);
                if (svc) {
                    const remote = await fetchRemoteAnalytics(svc, '', req.token, days);
                    data = remote?.analytics || null;
                }
            }

            if (!data) {
                return res.status(404).json({ ok: false, error: `No analytics data available for ${name}` });
            }

            res.json({ ok: true, analytics: data });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ═══════════════════════════════════════════════════════════
    // Bot Analysis
    // ═══════════════════════════════════════════════════════════

    router.get('/bots', async (req, res) => {
        try {
            const days = Math.min(parseInt(req.query.days) || 30, 365);

            const promises = [
                Promise.resolve({ ok: true, bots: analytics.getBotAnalysis(days), name: 'hobo-tools' }),
                ...REMOTE_SERVICES.map(svc =>
                    fetchRemoteAnalytics(svc, '/bots', req.token, days).then(result => ({
                        ...result, name: svc.name,
                    }))
                ),
            ];

            const results = await Promise.allSettled(promises);
            const bots = {};
            for (const r of results) {
                if (r.status !== 'fulfilled' || !r.value?.bots) continue;
                bots[r.value.name] = r.value.bots;
            }

            res.json({ ok: true, bots });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ═══════════════════════════════════════════════════════════
    // Real-time snapshot
    // ═══════════════════════════════════════════════════════════

    router.get('/realtime', (req, res) => {
        try {
            const fiveMinAgo = new Date(Date.now() - 300000).toISOString().slice(0, 19).replace('T', ' ');
            const db = analytics.db;

            const realtime = db.prepare(`
                SELECT
                    COUNT(*) as requests,
                    COUNT(DISTINCT ip) as visitors,
                    COUNT(*) FILTER (WHERE is_bot = 1) as bots,
                    COUNT(*) FILTER (WHERE event_type = 'pageview') as pageviews,
                    COUNT(*) FILTER (WHERE event_type = 'api_call') as api_calls
                FROM analytics_events
                WHERE created_at >= ?
            `).get(fiveMinAgo);

            const byPath = db.prepare(`
                SELECT path, COUNT(*) as hits
                FROM analytics_events
                WHERE created_at >= ? AND is_bot = 0
                GROUP BY path ORDER BY hits DESC LIMIT 10
            `).all(fiveMinAgo);

            res.json({ ok: true, realtime: { ...realtime, topPaths: byPath } });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    return router;
};
