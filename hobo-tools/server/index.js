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

const config = require('./config');
const { initDb } = require('./db/database');
const { BRAND } = require('hobo-shared/brand');
const { NotificationService } = require('./notifications/notification-service');
const { SESService } = require('./notifications/ses-service');
const createNotificationRoutes = require('./notifications/routes');
const createAdminRoutes = require('./admin/routes');

const app = express();

// ── Security ─────────────────────────────────────────────────
app.set('trust proxy', 2); // Cloudflare → Nginx → Node
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
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

app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true); // non-browser
        if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
        // Allow any *.hobo.tools subdomain
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
const sesService = new SESService(db);
app.locals.notificationService = notificationService;
app.locals.sesService = sesService;

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

// OAuth2 authorization endpoints
app.use('/oauth', require('./auth/oauth-routes'));

// Theme API
app.use('/api/themes', require('./themes/routes'));

// Notification API (authenticated users)
app.use('/api/notifications', createNotificationRoutes(db, notificationService, requireAuth));

// Admin panel API
app.use('/api/admin', createAdminRoutes(db, notificationService, sesService, requireAuth));

// Internal API (server-to-server, localhost only)
app.use('/internal', require('./internal/routes'));

// ── Static Files ─────────────────────────────────────────────
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
        res.setHeader('Cache-Control', 'public, max-age=300');
    },
}));

// Avatar serving
const avatarDir = path.resolve(config.avatars.path);
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
app.use('/data/avatars', express.static(avatarDir, { maxAge: '7d' }));

// SPA fallback
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/internal/')) {
        return res.status(404).json({ error: 'Not found' });
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

    // Process SES email queue every 2 minutes
    setInterval(() => sesService.processQueue(notificationService), 2 * 60 * 1000);

    // Clean expired sessions daily
    setInterval(() => {
        const cleaned = db.prepare("DELETE FROM user_sessions WHERE expires_at < datetime('now') OR is_active = 0").run().changes;
        if (cleaned > 0) console.log(`[Sessions] Cleaned ${cleaned} expired sessions`);
    }, 24 * 60 * 60 * 1000);
});
