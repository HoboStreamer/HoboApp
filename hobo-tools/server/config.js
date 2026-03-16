'use strict';

require('dotenv').config();

module.exports = {
    port: parseInt(process.env.PORT, 10) || 3100,
    host: process.env.HOST || '0.0.0.0',
    baseUrl: process.env.BASE_URL || 'https://hobo.tools',
    loginUrl: process.env.LOGIN_URL || '',

    jwt: {
        // RS256 keypair — generate with:
        //   openssl genrsa -out data/keys/private.pem 2048
        //   openssl rsa -in data/keys/private.pem -pubout -out data/keys/public.pem
        privateKeyPath: process.env.JWT_PRIVATE_KEY || 'data/keys/private.pem',
        publicKeyPath:  process.env.JWT_PUBLIC_KEY  || 'data/keys/public.pem',
        accessTokenExpiry:  '24h',
        refreshTokenExpiry: '30d',
        issuer: 'https://hobo.tools',
    },

    // Internal API key for server-to-server calls
    internalKey: process.env.INTERNAL_API_KEY || 'change-me-in-production',

    // Database
    db: {
        path: process.env.DB_PATH || 'data/hobo-tools.db',
    },

    // Admin auto-creation
    admin: {
        username: process.env.ADMIN_USERNAME || '',
        password: process.env.ADMIN_PASSWORD || '',
    },

    // Upload paths
    avatars: {
        path: process.env.AVATAR_PATH || 'data/avatars',
        maxSize: 512 * 1024, // 512 KB
    },

    // Connected services (OAuth2 clients are registered in the DB,
    // but we allow env-based overrides for the internal API URLs)
    services: {
        hobostreamer: {
            internalUrl: process.env.HOBOSTREAMER_INTERNAL_URL || 'http://127.0.0.1:3000',
            webhookSecret: process.env.HOBOSTREAMER_WEBHOOK_SECRET || '',
        },
        hoboquest: {
            internalUrl: process.env.HOBOQUEST_INTERNAL_URL || 'http://127.0.0.1:3200',
            webhookSecret: process.env.HOBOQUEST_WEBHOOK_SECRET || '',
        },
    },
};
