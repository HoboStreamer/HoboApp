'use strict';

// ═══════════════════════════════════════════════════════════════
// HoboYT — JWT Auth (hobo.tools RS256 verification)
// Same lightweight auth as hobo-img.
// ═══════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const config = require('./config');

let publicKey = null;
const ISSUER = 'https://hobo.tools';

function loadPublicKey() {
    for (const p of config.publicKeyPaths) {
        try {
            const resolved = path.resolve(p);
            if (fs.existsSync(resolved)) {
                publicKey = fs.readFileSync(resolved, 'utf8');
                console.log(`[Auth] Loaded hobo.tools public key from ${resolved}`);
                return;
            }
        } catch { /* try next */ }
    }
    console.warn('[Auth] hobo.tools public key not found — all users treated as anonymous');
}
loadPublicKey();

function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.slice(7);
    if (req.cookies?.hobo_token) return req.cookies.hobo_token;
    if (req.cookies?.token) return req.cookies.token;
    return null;
}

function verifyToken(token) {
    if (!publicKey || !token) return null;
    try {
        return jwt.verify(token, publicKey, { algorithms: ['RS256'], issuer: ISSUER });
    } catch {
        return null;
    }
}

function optionalAuth(req, _res, next) {
    const token = extractToken(req);
    if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
            req.user = decoded;
            req.token = token;
        }
    }
    next();
}

module.exports = { extractToken, verifyToken, optionalAuth, loadPublicKey };
