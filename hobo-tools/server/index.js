'use strict';

// ═══════════════════════════════════════════════════════════════
// hobo.tools — Main Server Entry Point
// Central hub for the Hobo Network: SSO provider, account
// dashboard, theme API, and utility tools.
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const config = require('./config');
const { initDb } = require('./db/database');
const urlRegistry = require('./url-registry');
const { BRAND } = require('hobo-shared/brand');
const { NotificationService } = require('./notifications/notification-service');
const { EmailService } = require('./notifications/email-service');
const createNotificationRoutes = require('./notifications/routes');
const createAdminRoutes = require('./admin/routes');
const createSetupRoutes = require('./setup/routes');
const { AnalyticsTracker } = require('hobo-shared/analytics');
const createNetRoutes = require('./net/routes');
const { NET_TOOL_MAP, NET_ALIASES } = require('./net/config');
const createDevRoutes = require('./dev/routes');
const { DEV_TOOL_MAP, DEV_ALIASES } = require('./dev/config');
const { DiscordService } = require('./discord/discord-service');
const createDiscordRoutes = require('./discord/routes');

const app = express();

function getRequestHost(req) {
    return String(req.headers.host || '').split(':')[0].toLowerCase();
}

function ensureAdminUser(db, config) {
    const adminExists = db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get();
    if (adminExists) return;
    const username = config.admin.username || (config.nodeEnv !== 'production' ? 'admin' : null);
    const password = config.admin.password || (config.nodeEnv !== 'production' ? 'admin' : null);
    if (!username || !password) {
        console.warn('[Setup] No admin user exists and ADMIN_USERNAME/PASSWORD are not configured. Setup routes remain available to complete bootstrap.');
        return;
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare(`
        INSERT INTO users (username, email, password_hash, display_name, role, profile_color)
        VALUES (?, ?, ?, ?, 'admin', '#c0965c')
        ON CONFLICT(username) DO UPDATE SET role = 'admin', password_hash = excluded.password_hash
    `).run(username, null, passwordHash, username);
    console.log(`[Setup] Admin user created or elevated: ${username}`);
}

function isMyToolsHost(req) {
    return getRequestHost(req) === 'my.hobo.tools';
}

function redirectToMyTools(req, res) {
    const base = 'https://my.hobo.tools';
    const path = req.path === '/my' || req.path === '/my.html' ? '/' : req.path;
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    return res.redirect(302, `${base}${path}${query}`);
}

function redirectWithoutHtml(req, res, targetPath) {
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    return res.redirect(302, `${targetPath}${query}`);
}

function sendMyAccountApp(res) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'my.html'));
}

async function proxyJsonRequest(req, res, targetUrl, errorLabel) {
    try {
        const fetchOpts = {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${req.token}`,
            },
        };
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
            fetchOpts.body = JSON.stringify(req.body);
        }

        const upstream = await fetch(targetUrl, fetchOpts);
        const contentType = upstream.headers.get('content-type') || '';
        const raw = await upstream.text();

        res.status(upstream.status);
        if (contentType.includes('application/json')) {
            return res.json(raw ? JSON.parse(raw) : {});
        }
        return res.send(raw);
    } catch (err) {
        console.error(`[AdminProxy] ${errorLabel}:`, err.message);
        return res.status(502).json({ error: 'Could not reach HoboStreamer service' });
    }
}

// ── Security ─────────────────────────────────────────────────
app.set('trust proxy', 2); // Cloudflare → Nginx → Node

// Add CORS headers before helmet for better compatibility
app.use((req, res, next) => {
    const origin = req.headers.origin;
    // Allow any *.hobo.tools subdomain + main domains
    if (!origin || 
        origin === 'https://hobo.tools' ||
        origin === 'https://hobostreamer.com' ||
        origin === 'https://hobo.quest' ||
        /^https:\/\/[a-z0-9-]+\.hobo\.tools$/.test(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    }
    next();
});

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://hobo.tools", "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "fonts.googleapis.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"],
            fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:", "image.tmdb.org"],
            connectSrc: ["'self'", "https://hobo.tools", "https://login.hobo.tools", "https://maps.hobo.tools", "https://text.hobo.tools", "https://img.hobo.tools", "https://audio.hobo.tools", "https://net.hobo.tools", "https://dev.hobo.tools", "https://pastes.hobo.tools", "https://hobostreamer.com", "https://hobo.quest"],
            frameSrc: ["'none'"],
            scriptSrcAttr: ["'unsafe-inline'"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── CORS ─────────────────────────────────────────────────────
// Allow all Hobo Network domains + subdomains
const ALLOWED_ORIGINS = new Set([
    'https://hobo.tools',
    'https://login.hobo.tools',
    'https://maps.hobo.tools',
    'https://dl.hobo.tools',
    'https://hobostreamer.com',
    'https://www.hobostreamer.com',
    'https://hobo.quest',
    'https://www.hobo.quest',
]);

if (process.env.NODE_ENV === 'development') {
    ALLOWED_ORIGINS.add('http://localhost:3000');
    ALLOWED_ORIGINS.add('http://localhost:3100');
    ALLOWED_ORIGINS.add('http://localhost:3200');
    ALLOWED_ORIGINS.add('http://127.0.0.1:3100');
}

function getAllowedOrigins() {
    const origins = new Set(ALLOWED_ORIGINS);
    const registry = app.locals.urlRegistry;
    if (registry?.HOBO_TOOLS_URL?.value) origins.add(registry.HOBO_TOOLS_URL.value);
    if (registry?.HOBO_TOOLS_LOGIN_URL?.value) origins.add(registry.HOBO_TOOLS_LOGIN_URL.value);
    if (registry?.BASE_URL?.value) origins.add(registry.BASE_URL.value);
    if (registry?.WEBRTC_PUBLIC_URL?.value) origins.add(registry.WEBRTC_PUBLIC_URL.value);
    if (registry?.JSMPEG_PUBLIC_URL?.value) origins.add(registry.JSMPEG_PUBLIC_URL.value);
    return origins;
}

app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true); // non-browser
        const allowedOrigins = getAllowedOrigins();
        if (allowedOrigins.has(origin)) return callback(null, true);
        if (/^https:\/\/[a-z0-9-]+\.hobo\.tools$/.test(origin)) return callback(null, true);
        return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
}));

// ── Rate Limiting ────────────────────────────────────────────
app.use('/api/', rateLimit({ windowMs: 60_000, max: 120 }));
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60_000, max: 30, skipSuccessfulRequests: true }));

// ── Database ─────────────────────────────────────────────────
const db = initDb(config.db.path);
urlRegistry.initializeUrlRegistry(db);
urlRegistry.seedBootstrapRegistry(db, process.env, config.bootstrapProfile);
ensureAdminUser(db, config);
const resolvedRegistry = urlRegistry.getResolvedRegistry(db, process.env);

// Apply resolved network registry values to runtime config
if (resolvedRegistry.BASE_URL?.value) {
    config.baseUrl = resolvedRegistry.BASE_URL.value;
}
if (resolvedRegistry.HOBO_TOOLS_URL?.value) {
    config.hoboToolsUrl = resolvedRegistry.HOBO_TOOLS_URL.value;
    config.jwt.issuer = resolvedRegistry.HOBO_TOOLS_URL.value;
    if (!process.env.BASE_URL) config.baseUrl = resolvedRegistry.HOBO_TOOLS_URL.value;
}
if (resolvedRegistry.HOBO_TOOLS_LOGIN_URL?.value) {
    config.loginUrl = resolvedRegistry.HOBO_TOOLS_LOGIN_URL.value;
} else {
    config.loginUrl = config.loginUrl || config.hoboToolsUrl;
}
if (resolvedRegistry.HOBO_TOOLS_INTERNAL_URL?.value) config.internalUrl = resolvedRegistry.HOBO_TOOLS_INTERNAL_URL.value;
if (resolvedRegistry.HOBOSTREAMER_INTERNAL_URL?.value) config.services.hobostreamer.internalUrl = resolvedRegistry.HOBOSTREAMER_INTERNAL_URL.value;
if (resolvedRegistry.HOBOQUEST_INTERNAL_URL?.value) config.services.hoboquest.internalUrl = resolvedRegistry.HOBOQUEST_INTERNAL_URL.value;
if (resolvedRegistry.HOBOMAPS_INTERNAL_URL?.value) config.services.hobomaps.internalUrl = resolvedRegistry.HOBOMAPS_INTERNAL_URL.value;
if (resolvedRegistry.HOBOFOOD_INTERNAL_URL?.value) config.services.hobofood.internalUrl = resolvedRegistry.HOBOFOOD_INTERNAL_URL.value;
if (resolvedRegistry.HOBOIMG_INTERNAL_URL?.value) config.services.hoboimg.internalUrl = resolvedRegistry.HOBOIMG_INTERNAL_URL.value;
if (resolvedRegistry.HOBOYT_INTERNAL_URL?.value) config.services.hoboyt.internalUrl = resolvedRegistry.HOBOYT_INTERNAL_URL.value;
if (resolvedRegistry.HOBOAUDIO_INTERNAL_URL?.value) config.services.hoboaudio.internalUrl = resolvedRegistry.HOBOAUDIO_INTERNAL_URL.value;
if (resolvedRegistry.HOBOTEXT_INTERNAL_URL?.value) config.services.hobotext.internalUrl = resolvedRegistry.HOBOTEXT_INTERNAL_URL.value;

// Expose a canonical registry payload for admin/internal consumers
app.locals.urlRegistry = resolvedRegistry;
// ── Analytics Tracking ────────────────────────────────────────
const analytics = new AnalyticsTracker(db, 'hobo-tools');
app.locals.analytics = analytics;
app.use(analytics.middleware());

// ── Extract bearer token (available as req.token for optional-auth proxies) ─
app.use((req, _res, next) => {
    const ah = req.headers.authorization;
    req.token = ah?.startsWith('Bearer ') ? ah.slice(7) : req.cookies?.hobo_token || null;
    next();
});

// ── Load RSA Keys ────────────────────────────────────────────
let privateKey, publicKey;
try {
    privateKey = fs.readFileSync(path.resolve(config.jwt.privateKeyPath), 'utf8');
    publicKey = fs.readFileSync(path.resolve(config.jwt.publicKeyPath), 'utf8');
    console.log('[Auth] RS256 keypair loaded');
} catch (err) {
    console.warn('[Auth] RSA keypair not found — generating ephemeral keys for development');
    console.warn('[Auth] Run: openssl genrsa -out data/keys/private.pem 2048');
    console.warn('[Auth]      openssl rsa -in data/keys/private.pem -pubout -out data/keys/public.pem');
    // Fall back to HS256 with a random secret for development
    const crypto = require('crypto');
    privateKey = crypto.randomBytes(64).toString('hex');
    publicKey = privateKey;
    console.warn('[Auth] Using ephemeral HS256 key — DO NOT use in production');
}

// Make keys available to route modules
app.locals.db = db;
app.locals.privateKey = privateKey;
app.locals.publicKey = publicKey;
app.locals.config = config;

// ── Initialize Services ──────────────────────────────────────
const notificationService = new NotificationService(db);
const emailService = new EmailService(db);
app.locals.notificationService = notificationService;
app.locals.emailService = emailService;

// Discord bot service
const discordService = new DiscordService(db);
app.locals.discordService = discordService;
discordService.init().catch(err => console.error('[Discord] Init error:', err.message));

// requireAuth helper (needed by route factories)
const authRoutes = require('./auth/routes');
// Extract requireAuth from auth module (it's defined inline — we re-export it for route factories)
const jwt = require('jsonwebtoken');
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.hobo_token;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const algorithm = publicKey.includes('BEGIN') ? 'RS256' : 'HS256';
    try {
        const decoded = jwt.verify(token, publicKey, { algorithms: [algorithm], issuer: config.jwt.issuer });
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

// ── Routes ───────────────────────────────────────────────────
// Public key endpoint (services fetch this to verify JWTs)
app.get('/api/.well-known/jwks', (_req, res) => {
    res.json({ public_key: publicKey, algorithm: privateKey === publicKey ? 'HS256' : 'RS256' });
});

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'hobo-tools', version: '1.0.0' });
});

// Brand info (used by all frontends for consistent URLs/names)
app.get('/api/brand', (_req, res) => res.json(BRAND));

// Auth routes (SSO provider)
app.use('/api/auth', authRoutes);

// Discord account linking (OAuth2 flow)
app.use('/api/auth/discord', requireAuth, require('./auth/discord-link'));

// OAuth2 authorization endpoints
app.use('/oauth', require('./auth/oauth-routes'));

// Theme API
app.use('/api/themes', require('./themes/routes'));

// Notification API (authenticated users)
app.use('/api/notifications', createNotificationRoutes(db, notificationService, requireAuth));

// Push Notifications API
const pushService = require('./push/push-service');
pushService.initVapid(db);
app.use('/api/push', requireAuth, require('./push/routes'));

// Discord bot admin API
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}
app.use('/api/admin/discord', createDiscordRoutes(db, discordService, requireAuth, requireAdmin));

// Setup API for first-run bootstrapping and status checks
app.use('/api/setup', createSetupRoutes(db, config));

// Admin panel API
app.use('/api/admin', createAdminRoutes(db, notificationService, emailService, requireAuth));

// Analytics admin API
const createAnalyticsRoutes = require('./admin/analytics-routes');
app.use('/api/admin/analytics', createAnalyticsRoutes(analytics, requireAuth, config));

// ── Admin Proxy to HoboStreamer ──────────────────────────────
// Proxies /api/admin/streamer/* → hobostreamer.com /api/admin/*
// This lets the unified admin panel on hobo.tools manage hobostreamer features.
const HOBOSTREAMER_INTERNAL = process.env.HOBOSTREAMER_INTERNAL_URL || 'http://127.0.0.1:3000';
app.use('/api/admin/streamer', requireAuth, (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}, async (req, res) => {
    return proxyJsonRequest(req, res, `${HOBOSTREAMER_INTERNAL}/api/admin${req.url}`, 'Streamer proxy error');
});

// Proxy /api/mod/* for moderator routes
app.use('/api/admin/streamer-mod', requireAuth, (req, res, next) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'global_mod')) {
        return res.status(403).json({ error: 'Staff access required' });
    }
    next();
}, async (req, res) => {
    return proxyJsonRequest(req, res, `${HOBOSTREAMER_INTERNAL}/api/mod${req.url}`, 'Mod proxy error');
});

app.use('/api/admin/streamer-tts', requireAuth, (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}, async (req, res) => {
    return proxyJsonRequest(req, res, `${HOBOSTREAMER_INTERNAL}/api/tts${req.url}`, 'TTS proxy error');
});

app.use('/api/admin/streamer-funds', requireAuth, (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}, async (req, res) => {
    return proxyJsonRequest(req, res, `${HOBOSTREAMER_INTERNAL}/api/funds${req.url}`, 'Funds proxy error');
});

app.use('/api/admin/streamer-pastes', requireAuth, (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}, async (req, res) => {
    return proxyJsonRequest(req, res, `${HOBOSTREAMER_INTERNAL}/api/pastes${req.url}`, 'Pastes proxy error');
});

// ── Public Paste Proxy (pastes.hobo.tools) ───────────────────
// Proxies /api/pastes/* → hobostreamer /api/pastes/* (optionalAuth)
app.use('/api/pastes', rateLimit({ windowMs: 60_000, max: 120 }), async (req, res) => {
    try {
        const fetchOpts = {
            method: req.method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (req.token) fetchOpts.headers['Authorization'] = `Bearer ${req.token}`;
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
            fetchOpts.body = JSON.stringify(req.body);
        }
        const upstream = await fetch(`${HOBOSTREAMER_INTERNAL}/api/pastes${req.url}`, fetchOpts);
        const ct = upstream.headers.get('content-type') || '';
        const raw = await upstream.text();
        res.status(upstream.status);
        if (ct.includes('application/json')) return res.json(raw ? JSON.parse(raw) : {});
        return res.send(raw);
    } catch (err) {
        console.error('[PasteProxy]', err.message);
        return res.status(502).json({ error: 'Could not reach paste service' });
    }
});

// ── HoboNet — Network Tools API ──────────────────────────────
app.use('/api/net', rateLimit({ windowMs: 60_000, max: 60 }), createNetRoutes(db, requireAuth));

// ── HoboDev — Developer & SEO Tools API ──────────────────────
app.use('/api/dev', rateLimit({ windowMs: 60_000, max: 60 }), createDevRoutes(db, requireAuth));

// Internal API (server-to-server, localhost only)
app.use('/internal', require('./internal/routes'));

// ── HoboNet Subdomain Routing ─────────────────────────────────
// Serves net.html for any subdomain that matches a net tool
function isNetHost(req) {
    const h = getRequestHost(req);
    const sub = h.replace(/\.hobo\.tools$/, '');
    return NET_TOOL_MAP.has(sub) || NET_ALIASES[sub];
}

function sendNetApp(res) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'net.html'));
}

// Intercept all net-tool subdomains and serve the SPA
app.use((req, res, next) => {
    if (!isNetHost(req)) return next();
    if (req.path.startsWith('/api/') || req.path.startsWith('/internal/') || req.path.startsWith('/shared/')) return next();
    if (/\.(js|css|ico|png|svg|jpg|woff2?)$/.test(req.path)) return next();
    return sendNetApp(res);
});

// ── Pastes Subdomain Routing ──────────────────────────────────
app.use((req, res, next) => {
    if (getRequestHost(req) !== 'pastes.hobo.tools') return next();
    if (req.path.startsWith('/api/') || req.path.startsWith('/shared/')) return next();
    if (/\.(js|css|ico|png|svg|jpg|woff2?)$/.test(req.path)) return next();
    return res.sendFile(path.join(__dirname, '..', 'public', 'paste.html'));
});

// ── HoboDev Subdomain Routing ─────────────────────────────────
function isDevHost(req) {
    const h = getRequestHost(req);
    const sub = h.replace(/\.hobo\.tools$/, '');
    return DEV_TOOL_MAP.has(sub) || DEV_ALIASES[sub];
}

function sendDevApp(res) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'dev.html'));
}

app.use((req, res, next) => {
    if (!isDevHost(req)) return next();
    if (req.path.startsWith('/api/') || req.path.startsWith('/internal/') || req.path.startsWith('/shared/')) return next();
    if (/\.(js|css|ico|png|svg|jpg|woff2?)$/.test(req.path)) return next();
    return sendDevApp(res);
});

// ── Static Files ─────────────────────────────────────────────
app.get(['/login.html', '/admin.html'], (req, res) => {
    if (req.path === '/login.html') return redirectWithoutHtml(req, res, '/login');
    if (req.path === '/admin.html') return redirectWithoutHtml(req, res, '/admin');
    return res.status(404).end();
});

app.get(['/', '/index.html', '/my', '/my.html', '/themes', '/notifications', '/linked', '/security', '/profile', '/billing', '/preferences'], (req, res, next) => {
    if (req.path === '/index.html') {
        return redirectWithoutHtml(req, res, '/');
    }
    if (!isMyToolsHost(req) && ['/my', '/my.html', '/themes', '/notifications', '/linked', '/security', '/profile', '/billing', '/preferences'].includes(req.path)) {
        return redirectToMyTools(req, res);
    }
    if (isMyToolsHost(req) || req.path === '/my' || req.path === '/my.html') {
        return sendMyAccountApp(res);
    }
    if (req.path === '/themes') {
        return sendMyAccountApp(res);
    }
    return next();
});

app.use(express.static(path.join(__dirname, '..', 'public'), {
    setHeaders(res, filePath) {
        if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    },
}));

// Serve hobo-shared client-side libs (notification-ui.js, navbar.js, etc.)
// Accessible at https://hobo.tools/shared/notification-ui.js etc.
const sharedPath = path.resolve(__dirname, '..', '..', 'packages', 'hobo-shared');
app.use('/shared', express.static(sharedPath, {
    setHeaders(res, filePath) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        // Override helmet's same-origin policies so other domains can load these scripts
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
        res.setHeader('Cache-Control', 'public, max-age=300');
    },
}));

// Avatar serving
const avatarDir = path.resolve(config.avatars.path);
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
app.use('/data/avatars', express.static(avatarDir, { maxAge: '7d' }));

// SPA fallback
// Serve clean auth + recovery routes
app.get(['/login', '/forgot-password', '/reset-password'], (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// Admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/internal/')) {
        return res.status(404).json({ error: 'Not found' });
    }
    if (isMyToolsHost(req)) {
        return sendMyAccountApp(res);
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Start ────────────────────────────────────────────────────
app.listen(config.port, config.host, () => {
    console.log(`\n╔═══════════════════════════════════════╗`);
    console.log(`║   🔧 hobo.tools — Hobo Network Hub     ║`);
    console.log(`╠═══════════════════════════════════════╣`);
    console.log(`║  Port: ${String(config.port).padEnd(30)}║`);
    console.log(`║  URL:  ${config.baseUrl.padEnd(30)}║`);
    console.log(`║  Auth: ${config.loginUrl.padEnd(30)}║`);
    console.log(`╚═══════════════════════════════════════╝\n`);

    // ── Periodic Maintenance ─────────────────────────────────
    // Clean expired notifications every hour
    setInterval(() => notificationService.maintenance(), 60 * 60 * 1000);

    // Process email queue every 2 minutes
    setInterval(() => emailService.processQueue(notificationService), 2 * 60 * 1000);

    // Clean expired sessions daily
    setInterval(() => {
        const cleaned = db.prepare("DELETE FROM user_sessions WHERE expires_at < datetime('now') OR is_active = 0").run().changes;
        if (cleaned > 0) console.log(`[Sessions] Cleaned ${cleaned} expired sessions`);
    }, 24 * 60 * 60 * 1000);
});
