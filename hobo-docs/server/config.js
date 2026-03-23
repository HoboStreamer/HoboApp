'use strict';

require('dotenv').config();

module.exports = {
    port: parseInt(process.env.PORT, 10) || 3700,
    host: process.env.HOST || '127.0.0.1',

    // Upload limits
    upload: {
        maxFileSize: 100 * 1024 * 1024, // 100 MB (PDFs can be large)
        allowedMimes: [
            'application/pdf',
            'image/png', 'image/jpeg', 'image/webp', 'image/avif',
            'image/tiff', 'image/bmp', 'image/gif',
            'image/heic', 'image/heif',
        ],
    },

    // Ephemeral file retention (milliseconds)
    retention: {
        anonTTL:   60 * 60 * 1000,        // 1 hour
        authedTTL: 24 * 60 * 60 * 1000,    // 24 hours
        cleanupInterval: 5 * 60 * 1000,     // every 5 min
        tempMaxAge: 10 * 60 * 1000,         // 10 min for uploads
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
