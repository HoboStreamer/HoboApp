'use strict';

// ═══════════════════════════════════════════════════════════════
// HoboAudio — Main Server Entry Point
// Unified audio processing hub serving all format subdomains.
// One backend, many hostnames, dynamic branding per domain.
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const { optionalAuth } = require('./auth');
const { resolveContext } = require('./domain-map');
const { getTool, listTools } = require('./tools');
const { readMetadata } = require('./tools/metadata');
const { uploadSingle, uploadMultiple } = require('./middleware/upload');
const { apiLimiter, processLimiter } = require('./middleware/rate-limit');
const retention = require('./retention/manager');
const { probe, getDuration, cleanTmp } = require('./tools/ffmpeg-helper');

const app = express();

// ── Security ─────────────────────────────────────────────────
app.set('trust proxy', 2); // Cloudflare → Nginx → Node
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "https://hobo.tools"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            mediaSrc: ["'self'", "blob:"],
            connectSrc: ["'self'", "https://hobo.tools", "https://*.hobo.tools"],
            workerSrc: ["'self'", "blob:"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// ── CORS ─────────────────────────────────────────────────────
app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (/^https:\/\/([a-z0-9-]+\.)?hobo\.tools$/.test(origin)) return callback(null, true);
        if (process.env.NODE_ENV === 'development' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
        return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
}));

// ── Rate Limiting ────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ── Auth (optional on all routes) ────────────────────────────
app.use(optionalAuth);

// ── Attach domain context to every request ───────────────────
app.use((req, _res, next) => {
    req.ctx = resolveContext(req.headers.host);
    next();
});

// ── API Routes ───────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
    const stats = retention.getStats();
    res.json({ status: 'ok', service: 'hobo-audio', version: '1.0.0', files: stats });
});

// Domain context (frontend calls this on load to get branding)
app.get('/api/context', (req, res) => {
    const ctx = req.ctx;
    const tools = listTools();
    res.json({
        toolId: ctx.toolId,
        brandName: ctx.brandName,
        defaultOp: ctx.defaultOp,
        defaultFormat: ctx.defaultFormat || null,
        faIcon: ctx.faIcon,
        seoTitle: ctx.seoTitle,
        seoDescription: ctx.seoDescription,
        tools,
        user: req.user ? { username: req.user.username, display_name: req.user.display_name } : null,
    });
});

// List tools
app.get('/api/tools', (_req, res) => {
    res.json({ tools: listTools() });
});

// ── Probe / Metadata Endpoint ────────────────────────────────
app.post('/api/probe', processLimiter, uploadSingle, async (req, res) => {
    try {
        const info = await probe(req.file.path);
        const meta = await readMetadata(req.file.path);
        cleanTmp(req.file.path);
        res.json({ success: true, ...meta, probe: info.format });
    } catch (err) {
        cleanTmp(req.file?.path);
        res.status(422).json({ error: err.message || 'Failed to read audio file' });
    }
});

// ── Main Processing Endpoint ─────────────────────────────────
app.post('/api/process', processLimiter, uploadSingle, async (req, res) => {
    try {
        const toolId = req.body.tool || req.ctx.defaultOp || 'convert';
        const tool = getTool(toolId);
        if (!tool) {
            cleanTmp(req.file.path);
            return res.status(400).json({ error: `Unknown tool: ${toolId}` });
        }

        // Build options from body params
        const options = { ...req.body };
        delete options.tool;
        delete options.file;

        // If this is a format-specific domain, enforce that format
        if (req.ctx.defaultFormat && toolId === 'convert') {
            options.format = req.ctx.defaultFormat;
        }

        // Execute the tool
        const result = await tool.handler(req.file.path, options);

        // Clean up the uploaded input file
        cleanTmp(req.file.path);

        // Save to retention
        const saved = retention.saveOutputFromFile(
            result.outputPath,
            result.ext,
            result.mime,
            !!req.user,
            req.file.originalname,
        );

        // Probe input for size comparison
        const inputSize = req.file.size;

        res.json({
            success: true,
            tool: toolId,
            download: saved,
            output: {
                mime: result.mime,
                ext: result.ext,
                size: saved.size,
                sizeKB: Math.round(saved.size / 1024 * 10) / 10,
                duration: result.duration || null,
            },
            input: {
                size: inputSize,
                sizeKB: Math.round(inputSize / 1024 * 10) / 10,
            },
            ...(result.metadata && { metadata: result.metadata }),
            ...(result.preset && { preset: result.preset }),
        });
    } catch (err) {
        cleanTmp(req.file?.path);
        console.error('[Process] Error:', err.message);
        res.status(422).json({ error: err.message || 'Audio processing failed' });
    }
});

// ── File Download ────────────────────────────────────────────
app.get('/api/download/:id', (req, res) => {
    const entry = retention.getFile(req.params.id);
    if (!entry) {
        return res.status(404).json({ error: 'File not found or expired' });
    }
    const baseName = entry.originalName
        ? path.basename(entry.originalName, path.extname(entry.originalName))
        : 'hoboaudio-output';

    res.set({
        'Content-Type': entry.mime,
        'Content-Disposition': `attachment; filename="${baseName}.${entry.ext}"`,
        'Content-Length': entry.size,
    });
    res.sendFile(entry.filePath);
});

// ── Preview / Stream ─────────────────────────────────────────
app.get('/api/preview/:id', (req, res) => {
    const entry = retention.getFile(req.params.id);
    if (!entry) {
        return res.status(404).json({ error: 'File not found or expired' });
    }

    res.set({
        'Content-Type': entry.mime,
        'Content-Length': entry.size,
        'Accept-Ranges': 'bytes',
    });

    // Support range requests for audio seeking
    const range = req.headers.range;
    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : entry.size - 1;
        const chunkSize = end - start + 1;

        res.status(206).set({
            'Content-Range': `bytes ${start}-${end}/${entry.size}`,
            'Content-Length': chunkSize,
        });
        fs.createReadStream(entry.filePath, { start, end }).pipe(res);
    } else {
        fs.createReadStream(entry.filePath).pipe(res);
    }
});

// ── Static Files ─────────────────────────────────────────────
// Serve hobo-shared client-side libs
const sharedPath = path.resolve(__dirname, '..', '..', 'packages', 'hobo-shared');
app.use('/shared', express.static(sharedPath, {
    setHeaders(res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cache-Control', 'public, max-age=300');
    },
}));

// Public assets
app.use(express.static(path.join(__dirname, '..', 'public'), {
    setHeaders(res, filePath) {
        if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    },
}));

// SPA fallback
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Start ────────────────────────────────────────────────────
app.listen(config.port, config.host, () => {
    retention.startCleanup();
    console.log(`\n╔═══════════════════════════════════════╗`);
    console.log(`║   🎵  HoboAudio — Audio Processing Hub ║`);
    console.log(`╠═══════════════════════════════════════╣`);
    console.log(`║  Port: ${String(config.port).padEnd(30)}║`);
    console.log(`║  Host: ${config.host.padEnd(30)}║`);
    console.log(`╚═══════════════════════════════════════╝\n`);
});
