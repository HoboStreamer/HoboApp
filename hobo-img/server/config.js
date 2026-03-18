'use strict';

require('dotenv').config();

module.exports = {
    port: parseInt(process.env.PORT, 10) || 3400,
    host: process.env.HOST || '127.0.0.1',

    // Upload limits
    upload: {
        maxFileSize: 50 * 1024 * 1024, // 50 MB
        allowedMimes: [
            'image/png', 'image/jpeg', 'image/webp', 'image/avif',
            'image/tiff', 'image/bmp', 'image/gif', 'image/heic',
            'image/heif', 'image/svg+xml', 'image/x-icon',
            'image/vnd.microsoft.icon',
        ],
    },

    // Ephemeral file retention (milliseconds)
    retention: {
        anonTTL:   60 * 60 * 1000,       // 1 hour
        authedTTL: 24 * 60 * 60 * 1000,   // 24 hours
        cleanupInterval: 5 * 60 * 1000,    // every 5 min
        tempMaxAge: 10 * 60 * 1000,        // 10 min for uploads
    },

    // Paths
    dataDir: process.env.DATA_DIR || 'data',
    uploadsDir: process.env.UPLOADS_DIR || 'data/uploads',
    outputDir: process.env.OUTPUT_DIR || 'data/output',

    // Auth — hobo.tools RS256 public key
    publicKeyPaths: [
        process.env.HOBO_TOOLS_PUBLIC_KEY,
        'data/keys/hobo-tools-public.pem',
        '/opt/hobo/hobo-tools/data/keys/public.pem',
    ].filter(Boolean),
};
