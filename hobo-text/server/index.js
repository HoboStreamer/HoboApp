'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config');

const app = express();

// ── Security ─────────────────────────────────────────────────
app.set('trust proxy', 2);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));

// ── CORS ─────────────────────────────────────────────────────
app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (/^https:\/\/[a-z0-9-]+\.hobo\.tools$/.test(origin)) return callback(null, true);
        if (/^https:\/\/(hobostreamer\.com|hobo\.quest)$/.test(origin)) return callback(null, true);
        if (process.env.NODE_ENV === 'development' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
        return callback(new Error('Origin not allowed'));
    },
    credentials: true,
}));

// ── Rate Limiting ────────────────────────────────────────────
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

// ── Hostname → HTML file mapping ─────────────────────────────
// Each subdomain gets its own static HTML page for SEO + focused UX.
const HOSTNAME_MAP = {
    // Text hubs
    'text.hobo.tools':       'index.html',
    'type.hobo.tools':       'index.html',
    'fonts.hobo.tools':      'index.html',
    // Fancy text generators
    'fancy.hobo.tools':      'fancy.html',
    'zalgo.hobo.tools':      'zalgo.html',
    'ascii.hobo.tools':      'ascii.html',
    'symbols.hobo.tools':    'symbols.html',
    'unicode.hobo.tools':    'unicode.html',
    'bubble.hobo.tools':     'bubble.html',
    'glitch.hobo.tools':     'zalgo.html',
    'smallcaps.hobo.tools':  'fancy.html',
    'cursive.hobo.tools':    'fancy.html',
    'gothic.hobo.tools':     'fancy.html',
    'wide.hobo.tools':       'fancy.html',
    'monospaced.hobo.tools': 'fancy.html',
    'braille.hobo.tools':    'braille.html',
    'morse.hobo.tools':      'morse.html',
    'binary.hobo.tools':     'binary.html',
    // Quick-action text tools
    'case.hobo.tools':       'case.html',
    'caps.hobo.tools':       'case.html',
    'titlecase.hobo.tools':  'case.html',
    'reverse.hobo.tools':    'reverse.html',
    'clean.hobo.tools':      'clean.html',
    'strip.hobo.tools':      'clean.html',
    'count.hobo.tools':      'count.html',
    'lines.hobo.tools':      'count.html',
    'sort.hobo.tools':       'sort.html',
    'dedupe.hobo.tools':     'sort.html',
    'slug.hobo.tools':       'slug.html',
    'compare.hobo.tools':    'compare.html',
    'diff.hobo.tools':       'compare.html',
    'markdown.hobo.tools':   'markdown.html',
    'json.hobo.tools':       'json.html',
    'escape.hobo.tools':     'escape.html',
    // Identity / social
    'bio.hobo.tools':        'bio.html',
    'nickname.hobo.tools':   'nickname.html',
    'username.hobo.tools':   'nickname.html',
    'gamertag.hobo.tools':   'nickname.html',
    'kaomoji.hobo.tools':    'kaomoji.html',
    'emojis.hobo.tools':     'kaomoji.html',
    'copypaste.hobo.tools':  'symbols.html',
    // ASCII art / banners
    'banner.hobo.tools':     'ascii.html',
    'textart.hobo.tools':    'ascii.html',
    'figlet.hobo.tools':     'ascii.html',
    // Logo / title / design
    'logo.hobo.tools':       'logo-hub.html',
    'title.hobo.tools':      'title.html',
    'wordmark.hobo.tools':   'wordmark.html',
    'textlogo.hobo.tools':   'wordmark.html',
    'transparent.hobo.tools':'transparent.html',
    'badge.hobo.tools':      'badge.html',
    'sticker.hobo.tools':    'badge.html',
    'thumbnail.hobo.tools':  'thumbnail.html',
    'cover.hobo.tools':      'thumbnail.html',
    'channelart.hobo.tools': 'thumbnail.html',
    'watermark.hobo.tools':  'watermark.html',
    'neon.hobo.tools':       'wordmark.html',
    'overlay.hobo.tools':    'watermark.html',
    'lowerthird.hobo.tools': 'watermark.html',
};

function getHostname(req) {
    return String(req.headers.host || '').split(':')[0].toLowerCase();
}

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'hobo-text', version: '1.0.0' });
});

// ── Serve shared hobo-network scripts ────────────────────────
const sharedPath = path.resolve(__dirname, '..', '..', 'packages', 'hobo-shared');
app.use('/shared', express.static(sharedPath, {
    setHeaders(res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
        res.setHeader('Cache-Control', 'public, max-age=300');
    },
}));

// ── Static assets (CSS/JS) ──────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public'), {
    index: false, // Disable auto index.html — hostname routing handles /
    setHeaders(res, filePath) {
        if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    },
}));

// ── Hostname-based routing ───────────────────────────────────
app.get('/', (req, res) => {
    const hostname = getHostname(req);
    const file = HOSTNAME_MAP[hostname] || 'index.html';
    res.sendFile(path.join(__dirname, '..', 'public', file));
});

// SPA fallback (all non-asset paths → root HTML for that host)
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Not found' });
    }
    const hostname = getHostname(req);
    const file = HOSTNAME_MAP[hostname] || 'index.html';
    res.sendFile(path.join(__dirname, '..', 'public', file));
});

// ── Start ────────────────────────────────────────────────────
app.listen(config.port, config.host, () => {
    const toolCount = new Set(Object.values(HOSTNAME_MAP)).size;
    const domainCount = Object.keys(HOSTNAME_MAP).length;
    console.log(`\n╔═══════════════════════════════════════╗`);
    console.log(`║  ✏️  HoboText + HoboLogo                ║`);
    console.log(`╠═══════════════════════════════════════╣`);
    console.log(`║  Port:    ${String(config.port).padEnd(28)}║`);
    console.log(`║  Tools:   ${String(toolCount).padEnd(28)}║`);
    console.log(`║  Domains: ${String(domainCount).padEnd(28)}║`);
    console.log(`╚═══════════════════════════════════════╝\n`);
});
