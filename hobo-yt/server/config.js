'use strict';

require('dotenv').config();

module.exports = {
    port: parseInt(process.env.PORT, 10) || 3401,
    host: process.env.HOST || '127.0.0.1',

    // yt-dlp binary path (auto-detect or override)
    ytdlpPath: process.env.YTDLP_PATH || 'yt-dlp',

    // Download limits
    download: {
        maxDuration: 3 * 60 * 60,     // 3 hours max video length (seconds)
        timeout: 10 * 60 * 1000,       // 10 min download timeout (ms)
        maxConcurrent: 5,               // max concurrent downloads
    },

    // Ephemeral file retention (ms)
    retention: {
        fileTTL: 60 * 60 * 1000,        // 1 hour
        cleanupInterval: 5 * 60 * 1000,  // every 5 min
    },

    // Rate limits (per user/IP)
    rateLimit: {
        anonPerHour: 5,
        authedPerHour: 20,
    },

    // Paths
    dataDir: process.env.DATA_DIR || 'data',
    downloadsDir: process.env.DOWNLOADS_DIR || 'data/downloads',

    // Auth — hobo.tools RS256 public key
    publicKeyPaths: [
        process.env.HOBO_TOOLS_PUBLIC_KEY,
        'data/keys/hobo-tools-public.pem',
        '/opt/hobo/hobo-tools/data/keys/public.pem',
    ].filter(Boolean),
};
