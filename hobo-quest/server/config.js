'use strict';

// ═══════════════════════════════════════════════════════════════
// HoboQuest — Server Configuration
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();

module.exports = {
    port: parseInt(process.env.PORT, 10) || 3200,
    baseUrl: process.env.BASE_URL || 'https://hobo.quest',

    jwt: {
        // Public key from hobo.tools for RS256 token verification
        publicKeyPath: process.env.RSA_PUBLIC_KEY_PATH || 'data/keys/public.pem',
        // Fallback HS256 secret for dev (when no RSA keys exist)
        fallbackSecret: process.env.JWT_SECRET || 'hobo-quest-dev-secret',
        issuer: 'https://hobo.tools',
    },

    // Internal API key — must match hobo.tools and hobostreamer
    internalKey: process.env.INTERNAL_API_KEY || 'dev-internal-key',

    db: {
        path: process.env.DB_PATH || 'data/hobo-quest.db',
    },

    // OAuth2 client config (registered in hobo.tools)
    oauth: {
        clientId: 'hoboquest',
        clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
        authorizationUrl: 'https://hobo.tools/authorize',
        tokenUrl: 'https://hobo.tools/token',
        redirectUri: 'https://hobo.quest/auth/callback',
    },

    // hobo.tools internal API
    hoboTools: {
        url: process.env.HOBO_TOOLS_URL || 'http://127.0.0.1:3100',
    },

    // Game config
    game: {
        mapSize: 512,
        tickRate: 100,       // ms between game ticks
        saveInterval: 30000, // ms between DB saves
    },

    canvas: {
        size: 512,
        cooldowns: {
            default: 30,    // seconds
            verified: 10,
            staff: 1,
        },
    },
};
