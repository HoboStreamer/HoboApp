'use strict';

// ═══════════════════════════════════════════════════════════════
// HoboQuest — Express + WebSocket Server
// Community MMORPG & Canvas at hobo.quest
// Authenticates via hobo.tools OAuth2 + RS256 JWT verification.
// ═══════════════════════════════════════════════════════════════

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { AnalyticsTracker } = require('hobo-shared/analytics');

const app = express();
const server = http.createServer(app);

// ── Trust proxy (Cloudflare → Nginx → Node) ────────────────
app.set('trust proxy', 2);

// ── Middleware ───────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "fonts.googleapis.com", "https://hobo.tools"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"],
            fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "wss:", "https://hobo.tools"],
            frameSrc: ["'self'"],
            workerSrc: ["'self'", "blob:"],
            scriptSrcAttr: ["'unsafe-inline'"],
        },
    },
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

// ── Analytics Tracking ────────────────────────────────────────
// Initialized after DB is ready (below)

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

// Initialize analytics tracker
const analytics = new AnalyticsTracker(db, 'hobo-quest');
app.locals.analytics = analytics;
app.use(analytics.middleware());

// ── Game Systems Initialization ─────────────────────────────
const dbAdapter = require('./game/db-adapter');
const gameAuth = require('./game/game-auth');
const game = require('./game/game-engine');
const gameServer = require('./game/game-server');
const canvasService = require('./canvas/canvas-service');
const canvasServer = require('./canvas/canvas-server');

// Wire db-adapter to the SQLite instance
dbAdapter.setDb(db);

// Configure JWT auth for game WebSocket connections
gameAuth.configure({ publicKey, jwtIssuer: config.jwt.issuer });

// Initialize game database tables + world state
game.initGameDb();
console.log('[hobo-quest] Game engine ready');

// Initialize canvas database tables
canvasService.initDb();
console.log('[hobo-quest] Canvas service ready');

// Initialize WebSocket servers (noServer mode)
gameServer.init(server);
canvasServer.init();

// ── OAuth2 Callback (exchange code for token) ───────────────
const authRoutes = require('./auth/routes');
app.use('/auth', authRoutes);

// ── API Routes ──────────────────────────────────────────────
const gameRoutes = require('./api/game-routes');
const canvasRoutes = require('./api/canvas-routes');
const internalRoutes = require('./api/internal-routes');

app.use('/api/game/canvas', canvasRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/internal', internalRoutes);

// ── Internal Analytics API ──────────────────────────────────
// Called by hobo-tools admin panel to fetch analytics
app.get('/api/internal/analytics', (req, res) => {
    if (req.headers['x-internal-secret'] !== 'hobo-internal-2026') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
        const days = Math.min(parseInt(req.query.days) || 30, 365);
        const hours = req.query.hours ? Math.min(parseInt(req.query.hours), 8760) : null;
        res.json({ ok: true, analytics: analytics.getStats({ days, hours }) });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});
app.get('/api/internal/analytics/bots', (req, res) => {
    if (req.headers['x-internal-secret'] !== 'hobo-internal-2026') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
        const days = Math.min(parseInt(req.query.days) || 30, 365);
        res.json({ ok: true, bots: analytics.getBotAnalysis(days) });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ── Health ──────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'hobo-quest', uptime: process.uptime() });
});

// ── Static Files ────────────────────────────────────────────
// Serve hobo-shared client-side libs (navbar, notifications, themes)
const sharedPath = path.resolve(__dirname, '..', '..', 'packages', 'hobo-shared');
app.use('/shared', express.static(sharedPath, {
    setHeaders(res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cache-Control', 'public, max-age=300');
    },
}));

app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Game & Canvas Pages ─────────────────────────────────────
app.get('/game', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'game.html'));
});
app.get('/canvas', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'canvas.html'));
});

// ── SPA Fallback ────────────────────────────────────────────
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── WebSocket Upgrade Handler ───────────────────────────────
server.on('upgrade', (req, socket, head) => {
    const url = req.url || '';

    if (url.startsWith('/ws/game')) {
        gameServer.handleUpgrade(req, socket, head);
    } else if (url.startsWith('/ws/canvas')) {
        canvasServer.handleUpgrade(req, socket, head);
    } else {
        socket.destroy();
    }
});

// ── Start Server ────────────────────────────────────────────
const PORT = config.port;
server.listen(PORT, () => {
    console.log('[hobo-quest] Server running on port ' + PORT);
    console.log('[hobo-quest] ' + config.baseUrl);
    console.log('[hobo-quest] WebSocket: ws://localhost:' + PORT + '/ws/game');
    console.log('[hobo-quest] WebSocket: ws://localhost:' + PORT + '/ws/canvas');
});

// ── Graceful Shutdown ───────────────────────────────────────
process.on('SIGTERM', () => {
    console.log('[hobo-quest] SIGTERM received — shutting down');
    gameServer.close();
    canvasServer.close();
    analytics.destroy();
    server.close(() => {
        db.close();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('[hobo-quest] SIGINT received — shutting down');
    gameServer.close();
    canvasServer.close();
    analytics.destroy();
    server.close(() => {
        db.close();
        process.exit(0);
    });
});
