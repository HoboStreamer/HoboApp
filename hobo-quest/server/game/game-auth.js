'use strict';

/**
 * HoboQuest — Game Auth Helpers
 * JWT-based authentication for game WebSocket and REST endpoints.
 * Supports authenticated users (via hobo.tools JWT) and anonymous players (IP-based).
 * Anonymous identities are resolved through hobo.tools unified anon API.
 */

const jwt = require('jsonwebtoken');
const db = require('./db-adapter');
const config = require('../config');

// These are set once by index.js at startup
let _publicKey = null;
let _jwtIssuer = 'https://hobo.tools';

// ── Unified anon resolution cache ────────────────────────────
const _anonCache = new Map(); // IP → { anonNumber, anonId, displayName }
const HOBO_TOOLS_URL = config.hoboTools?.url || process.env.HOBO_TOOLS_URL || 'http://127.0.0.1:3100';
const INTERNAL_KEY = config.internalKey || process.env.INTERNAL_API_KEY || '';

function configure({ publicKey, jwtIssuer }) {
    _publicKey = publicKey;
    if (jwtIssuer) _jwtIssuer = jwtIssuer;
}

function getRequestIp(req) {
    const rawIp = req?.headers?.['cf-connecting-ip']
        || req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
        || req?.socket?.remoteAddress || req?.connection?.remoteAddress || 'unknown';
    // Normalize IPv6-mapped IPv4
    return rawIp.replace(/^::ffff:/, '');
}

/**
 * Verify a JWT token and return the decoded user payload, or null.
 */
function authenticateWs(token) {
    if (!token || !_publicKey) return null;
    try {
        const algorithm = _publicKey.includes('BEGIN') ? 'RS256' : 'HS256';
        const decoded = jwt.verify(token, _publicKey, { algorithms: [algorithm], issuer: _jwtIssuer });
        return {
            id: decoded.sub || decoded.id,
            username: decoded.username,
            display_name: decoded.display_name || decoded.username,
            role: decoded.role || 'user',
            is_banned: false,
        };
    } catch {
        return null;
    }
}

/**
 * Extract token from WebSocket upgrade request URL params or cookies.
 */
function extractWsToken(req) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const fromQuery = url.searchParams.get('token');
        if (fromQuery) return fromQuery;
    } catch {}
    // Try cookie
    const cookieHeader = req.headers?.cookie || '';
    const match = cookieHeader.match(/(?:^|;\s*)hobo_token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Resolve a unified anon number from hobo.tools internal API.
 * Falls back to local hash-based generation if the API is unavailable.
 */
async function _resolveUnifiedAnon(ip) {
    const normalized = (ip || 'unknown').replace(/^::ffff:/, '');

    // Check cache first
    if (_anonCache.has(normalized)) return _anonCache.get(normalized);

    try {
        const res = await fetch(`${HOBO_TOOLS_URL}/internal/resolve-anon`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Key': INTERNAL_KEY,
            },
            body: JSON.stringify({ ip: normalized }),
            signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
            const data = await res.json();
            const result = {
                anonNumber: data.anon_number,
                anonId: data.username,       // e.g. "anon_42"
                displayName: data.display_name,
            };
            _anonCache.set(normalized, result);
            return result;
        }
    } catch (e) {
        console.warn('[GameAuth] Unified anon resolve failed, using local fallback:', e.message);
    }

    // Fallback: deterministic hash (same as before)
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
    }
    const num = Math.abs(hash) % 100000;
    const result = { anonNumber: num, anonId: `anon${num}`, displayName: `Anonymous #${num}` };
    _anonCache.set(normalized, result);
    return result;
}

/**
 * Synchronous fallback: generate an anon game identity from IP hash.
 * Used when async resolution is not possible.
 */
function getAnonGameIdentityFromIp(ip) {
    const normalized = (ip || 'unknown').replace(/^::ffff:/, '');

    // Check cache for unified result
    const cached = _anonCache.get(normalized);
    if (cached) {
        const anonId = cached.anonId;
        const user = db.getOrCreateAnonGameUser(anonId);
        if (!user) throw new Error('Unable to create anonymous HoboGame profile');
        return { user: { ...user, display_name: cached.displayName }, anonId, isAnon: true };
    }

    // Kick off async resolve in background for next time
    _resolveUnifiedAnon(ip).catch(() => {});

    // Synchronous local fallback
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
    }
    const anonId = `anon${Math.abs(hash) % 100000}`;
    const user = db.getOrCreateAnonGameUser(anonId);
    if (!user) throw new Error('Unable to create anonymous HoboGame profile');
    return { user, anonId, isAnon: true };
}

/**
 * Async anon game identity resolution using unified hobo.tools numbers.
 */
async function getAnonGameIdentityFromIpAsync(ip) {
    const resolved = await _resolveUnifiedAnon(ip);
    const anonId = resolved.anonId;
    const user = db.getOrCreateAnonGameUser(anonId);
    if (!user) throw new Error('Unable to create anonymous HoboGame profile');
    return { user: { ...user, display_name: resolved.displayName }, anonId, isAnon: true };
}

/**
 * Resolve a game identity from request/token/IP (sync version).
 * Returns { user, anonId, isAnon } or throws.
 */
function resolveGameIdentity({ req, token, ip }) {
    const authToken = token ?? (req ? extractWsToken(req) : null);
    const user = authenticateWs(authToken);
    if (user) {
        return { user, anonId: null, isAnon: false };
    }
    return getAnonGameIdentityFromIp(ip || getRequestIp(req));
}

/**
 * Async version: resolves unified anon identity via hobo.tools API.
 */
async function resolveGameIdentityAsync({ req, token, ip }) {
    const authToken = token ?? (req ? extractWsToken(req) : null);
    const user = authenticateWs(authToken);
    if (user) {
        return { user, anonId: null, isAnon: false };
    }
    return getAnonGameIdentityFromIpAsync(ip || getRequestIp(req));
}

/**
 * Express middleware — attaches req.user and req.gameIdentity.
 */
async function requireGameAuth(req, res, next) {
    try {
        const identity = await resolveGameIdentityAsync({ req });
        if (!identity?.user) {
            return res.status(401).json({ error: 'Unable to resolve game identity' });
        }
        if (identity.user.is_banned) {
            return res.status(403).json({ error: 'Account is banned' });
        }
        req.user = identity.user;
        req.gameIdentity = identity;
        next();
    } catch (e) {
        res.status(500).json({ error: e.message || 'Failed to resolve game identity' });
    }
}

module.exports = {
    configure,
    getRequestIp,
    authenticateWs,
    extractWsToken,
    getAnonGameIdentityFromIp,
    getAnonGameIdentityFromIpAsync,
    resolveGameIdentity,
    resolveGameIdentityAsync,
    requireGameAuth,
};
