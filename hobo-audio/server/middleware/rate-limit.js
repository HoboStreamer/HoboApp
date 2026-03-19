'use strict';

// ═══════════════════════════════════════════════════════════════
// HoboAudio — Rate Limiting Middleware
// Tiered rate limits: anonymous vs authenticated users.
// ═══════════════════════════════════════════════════════════════

const rateLimit = require('express-rate-limit');

/** General API rate limit */
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
});

/**
 * Processing rate limit — stricter, tiered by auth.
 * Audio processing is more CPU-intensive than image processing,
 * so limits are a bit tighter.
 * Anonymous: 6 conversions/minute
 * Authenticated: 20 conversions/minute
 */
const processLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: (req) => req.user ? 20 : 6,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.sub || req.user?.id || req.ip,
    message: { error: 'Processing rate limit reached. Sign in for higher limits or wait a moment.' },
});

module.exports = { apiLimiter, processLimiter };
