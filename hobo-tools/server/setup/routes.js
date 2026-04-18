'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const urlRegistry = require('../url-registry');
const { URL_DEFINITIONS } = require('hobo-shared/url-resolver');

function createSetupRoutes(db, config) {
    const router = express.Router();

    function hasAdminUser() {
        return !!db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get();
    }

    function isValidSetupToken(req) {
        const token = req.headers['x-setup-token'] || req.body?.setup_token || req.query?.setup_token;
        return config.setupToken && token && token === config.setupToken;
    }

    function requireSetupMode(req, res, next) {
        if (!hasAdminUser()) return next();
        if (isValidSetupToken(req)) return next();
        return res.status(403).json({ ok: false, error: 'Setup locked. Provide a valid setup token or log in as an admin.' });
    }

    function getSetupWarnings(resolvedRegistry) {
        const warnings = [];
        const firstPartyUrl = resolvedRegistry.HOBO_TOOLS_URL?.value;
        if (config.nodeEnv === 'production') {
            if (!firstPartyUrl) {
                warnings.push('HOBO_TOOLS_URL is not configured. Public production hosts are required.');
            } else if (firstPartyUrl.startsWith('http://')) {
                warnings.push('HOBO_TOOLS_URL is using HTTP in production. Use HTTPS for public Hobo.Tools access.');
            }
            if (!resolvedRegistry.HOBO_TOOLS_INTERNAL_URL?.value) {
                warnings.push('HOBO_TOOLS_INTERNAL_URL is not configured. Services cannot reach the internal API.');
            }
            if (!resolvedRegistry.HOBOSTREAMER_INTERNAL_URL?.value) {
                warnings.push('HOBOSTREAMER_INTERNAL_URL is not configured. Hobo.Tools cannot notify HoboStreamer of config refreshes.');
            }
            if (resolvedRegistry.MEDIASOUP_ANNOUNCED_IP?.value && ['127.0.0.1', 'localhost'].includes(resolvedRegistry.MEDIASOUP_ANNOUNCED_IP.value)) {
                warnings.push('MEDIASOUP_ANNOUNCED_IP is set to a local address in production. External WebRTC clients may fail to connect.');
            }
            if (!config.internalKey || config.internalKey === 'change-me-in-production') {
                warnings.push('INTERNAL_API_KEY is not configured or using an insecure default. Internal service communication must be protected.');
            }
        }
        return warnings;
    }

    function getSetupIssues(resolvedRegistry) {
        const required = [
            'HOBO_TOOLS_URL',
            'HOBO_TOOLS_INTERNAL_URL',
            'HOBOSTREAMER_INTERNAL_URL',
        ];
        return required.filter(key => !resolvedRegistry[key]?.value).map(key => `${key} is missing or invalid.`);
    }

    function buildSetupStatus() {
        const resolvedRegistry = urlRegistry.getResolvedRegistry(db, process.env);
        return {
            adminExists: hasAdminUser(),
            setupTokenConfigured: Boolean(config.setupToken),
            registrySeeded: urlRegistry.isRegistrySeeded(db),
            bootstrapProfile: config.bootstrapProfile,
            warnings: getSetupWarnings(resolvedRegistry),
            issues: getSetupIssues(resolvedRegistry),
            resolvedRegistry,
        };
    }

    router.get('/status', (req, res) => {
        try {
            res.json({ ok: true, status: buildSetupStatus() });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    router.post('/bootstrap', requireSetupMode, (req, res) => {
        try {
            const profile = String(req.body.profile || config.bootstrapProfile || 'local-dev');
            const validProfiles = ['local-dev', 'single-node-prod'];
            if (!validProfiles.includes(profile)) {
                return res.status(400).json({ ok: false, error: 'Invalid bootstrap profile' });
            }
            urlRegistry.seedBootstrapRegistry(db, process.env, profile);
            const status = buildSetupStatus();
            return res.json({ ok: true, message: 'Bootstrap completed', status });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    router.post('/admin', requireSetupMode, (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) return res.status(400).json({ ok: false, error: 'username and password are required' });
            if (hasAdminUser() && !isValidSetupToken(req)) {
                return res.status(403).json({ ok: false, error: 'Admin account already exists' });
            }
            const normalizedUsername = String(username).trim().toLowerCase();
            const passwordHash = bcrypt.hashSync(String(password), 10);
            db.prepare(`
                INSERT INTO users (username, email, password_hash, display_name, role, profile_color)
                VALUES (?, ?, ?, ?, 'admin', '#c0965c')
                ON CONFLICT(username) DO UPDATE SET
                    password_hash = excluded.password_hash,
                    role = 'admin'
            `).run(normalizedUsername, null, passwordHash, normalizedUsername);
            return res.json({ ok: true, message: 'Admin account created' });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ── Brand identity setup ─────────────────────────────────
    // POST /api/setup/identity — configure network/service names and subdomain base.
    // These drive white-label installs: CORS wildcard patterns, brand display names, etc.
    // Accepted fields (all optional, only provided fields are written):
    //   network_name       → NETWORK_NAME       (e.g. "Hobo Network")
    //   tools_service_name → TOOLS_SERVICE_NAME (e.g. "HoboTools")
    //   streamer_service_name → STREAMER_SERVICE_NAME (e.g. "HoboStreamer")
    //   tools_subdomain_base  → TOOLS_SUBDOMAIN_BASE (e.g. "hobo.tools")
    //   extra_origins      → ALLOWED_EXTRA_ORIGINS (array of additional CORS origins)
    const IDENTITY_FIELD_MAP = {
        network_name: 'NETWORK_NAME',
        tools_service_name: 'TOOLS_SERVICE_NAME',
        streamer_service_name: 'STREAMER_SERVICE_NAME',
        tools_subdomain_base: 'TOOLS_SUBDOMAIN_BASE',
        extra_origins: 'ALLOWED_EXTRA_ORIGINS',
    };
    router.post('/identity', requireSetupMode, (req, res) => {
        try {
            const upsert = db.prepare(
                `INSERT INTO url_registry (key, value, source, updated_at)
                 VALUES (?, ?, 'admin', datetime('now'))
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, source = 'admin', updated_at = excluded.updated_at`
            );
            const updated = {};
            for (const [bodyKey, registryKey] of Object.entries(IDENTITY_FIELD_MAP)) {
                if (!(bodyKey in req.body)) continue;
                const raw = req.body[bodyKey];
                let value;
                if (registryKey === 'ALLOWED_EXTRA_ORIGINS') {
                    // Accept either an array or a comma-separated string
                    const origins = Array.isArray(raw)
                        ? raw
                        : String(raw).split(',').map(s => s.trim()).filter(Boolean);
                    // Validate each origin is a valid https:// URL
                    for (const o of origins) {
                        try { new URL(o); } catch {
                            return res.status(400).json({ ok: false, error: `Invalid origin URL: ${o}` });
                        }
                    }
                    value = JSON.stringify(origins);
                } else {
                    value = String(raw).trim();
                    if (!value) continue;
                    if (registryKey === 'TOOLS_SUBDOMAIN_BASE') {
                        // Must be a valid hostname (no protocol, no path)
                        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) {
                            return res.status(400).json({ ok: false, error: `Invalid subdomain base: ${value}. Expected a bare hostname like "hobo.tools"` });
                        }
                    }
                }
                upsert.run(registryKey, value);
                updated[registryKey] = value;
            }
            return res.json({ ok: true, updated, message: 'Identity config saved' });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ── URL config setup ─────────────────────────────────────
    // POST /api/setup/urls — configure network URLs during first-time setup.
    // Writes the provided values into the url_registry with source='admin'.
    // Only keys that exist in URL_DEFINITIONS are accepted.
    router.post('/urls', requireSetupMode, (req, res) => {
        try {
            const allowedKeys = new Set(Object.keys(URL_DEFINITIONS));
            const upsert = db.prepare(
                `INSERT INTO url_registry (key, value, source, updated_at)
                 VALUES (?, ?, 'admin', datetime('now'))
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, source = 'admin', updated_at = excluded.updated_at`
            );
            const updated = {};
            const rejected = {};
            for (const [key, value] of Object.entries(req.body)) {
                if (!allowedKeys.has(key)) {
                    rejected[key] = 'unknown registry key';
                    continue;
                }
                const def = URL_DEFINITIONS[key];
                if (def.type === 'url') {
                    try { new URL(String(value)); } catch {
                        rejected[key] = `invalid URL: ${value}`;
                        continue;
                    }
                }
                upsert.run(key, String(value).trim());
                updated[key] = String(value).trim();
            }
            const status = buildSetupStatus();
            return res.json({ ok: true, updated, rejected, status });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    return router;
}

module.exports = createSetupRoutes;
