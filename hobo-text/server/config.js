'use strict';
require('dotenv').config();

module.exports = {
    port: parseInt(process.env.PORT, 10) || 3600,
    host: process.env.HOST || '0.0.0.0',
    baseUrl: process.env.BASE_URL || 'https://text.hobo.tools',
    hoboToolsUrl: process.env.HOBO_TOOLS_URL || 'https://hobo.tools',
};
