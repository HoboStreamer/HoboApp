'use strict';

// ═══════════════════════════════════════════════════════════════
// HoboQuest — Express Server
// Community MMORPG & Canvas at hobo.quest
// Authenticates via hobo.tools OAuth2 + RS256 JWT verification.
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const config = require('./config');

const app = express();

// ── Trust proxy (Cloudflare → Nginx → Node) ────────────────
app.set('trust proxy', 2);

// ── Middleware ───────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));

app.use(cors({
    origin: [
        'https://hobo.quest',
        'https://hobo.tools',
        /\.hobo\.tools$/,
        'https://hobostreamer.com',
        ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3200', 'http://localhost:3100', 'http://localhost:3000'] : []),
    ],
    credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// ── Rate Limiting ───────────────────────────────────────────
app.use('/api/', rateLimit({ windowMs: 60_000, max: 200 }));
app.use('/auth/', rateLimit({ windowMs: 15 * 60_000, max: 30 }));

// ── Load RSA Public Key (for JWT verification) ──────────────
let publicKey;
try {
    const keyPath = path.resolve(config.jwt.publicKeyPath);
    publicKey = fs.readFileSync(keyPath, 'utf8');
    console.log('[hobo-quest] RS256 public key loaded');
} catch {
    publicKey = config.jwt.fallbackSecret;
    console.warn('[hobo-quest] No RSA public key found — using HS256 fallback (dev only)');
}
app.locals.publicKey = publicKey;
app.locals.config = config;

// ── Auth Middleware ──────────────────────────────────────────
function extractToken(req) {
    if (req.headers.authorization?.startsWith('Bearer ')) return req.headers.authorization.slice(7);
    if (req.cookies?.hobo_token) return req.cookies.hobo_token;
    if (req.query?.token) return req.query.token;
    return null;
}

function requireAuth(req, res, next) {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const algorithm = publicKey.includes('BEGIN') ? 'RS256' : 'HS256';
    try {
        req.user = jwt.verify(token, publicKey, { algorithms: [algorithm], issuer: config.jwt.issuer });
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function optionalAuth(req, _res, next) {
    const token = extractToken(req);
    if (token) {
        const algorithm = publicKey.includes('BEGIN') ? 'RS256' : 'HS256';
        try { req.user = jwt.verify(token, publicKey, { algorithms: [algorithm], issuer: config.jwt.issuer }); } catch {}
    }
    next();
}

app.locals.requireAuth = requireAuth;
app.locals.optionalAuth = optionalAuth;

// ── Database ────────────────────────────────────────────────
const { initDb } = require('./db/database');
const db = initDb(config.db.path);
app.locals.db = db;

// ── OAuth2 Callback (exchange code for token) ───────────────
const authRoutes = require('./auth/routes');
app.use('/auth', authRoutes);

// ── API Routes ──────────────────────────────────────────────
const gameRoutes = require('./api/game-routes');
const canvasRoutes = require('./api/canvas-routes');

app.use('/api/game', gameRoutes);
app.use('/api/canvas', canvasRoutes);

// ── Health ──────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'hobo-quest', uptime: process.uptime() });
});

// ── Static Files ────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── SPA Fallback ────────────────────────────────────────────
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Start Server ────────────────────────────────────────────
const PORT = config.port;
app.listen(PORT, () => {
    console.log(`[hobo-quest] Server running on port ${PORT}`);
    console.log(`[hobo-quest] ${config.baseUrl}`);
});
