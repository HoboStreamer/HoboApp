'use strict';

// ═══════════════════════════════════════════════════════════════
// Hobo Network — Brand Constants
// Shared across all Hobo services for consistent branding.
// ═══════════════════════════════════════════════════════════════

const BRAND = Object.freeze({
    name: 'Hobo Network',
    tagline: 'One Account. All of Hobo.',
    campTagline: 'Live Streaming for Camp Culture',

    urls: Object.freeze({
        tools:    'https://hobo.tools',
        login:    'https://hobo.tools',
        maps:     'https://maps.hobo.tools',
        dl:       'https://dl.hobo.tools',
        streamer: 'https://hobostreamer.com',
        quest:    'https://hobo.quest',
        discord:  'https://discord.gg/M6MuRUaeJj',
        github:   'https://github.com/HoboStreamer',
    }),

    colors: Object.freeze({
        accent:     '#c0965c',
        bgDark:     '#1e1e24',
        flame:      '#dbb077',
        signalRed:  '#e74c3c',
        success:    '#2ecc71',
        warning:    '#f39c12',
        info:       '#3498db',
    }),

    // OAuth2 client IDs for each service
    oauth: Object.freeze({
        hobostreamer: 'hobostreamer',
        hoboquest:    'hoboquest',
    }),

    // Services in the network (for dashboard display, health checks, etc.)
    services: Object.freeze([
        { id: 'hobostreamer', name: 'HoboStreamer',  url: 'https://hobostreamer.com',  description: 'Live Streaming Platform' },
        { id: 'hoboquest',    name: 'HoboQuest',     url: 'https://hobo.quest',        description: 'Community MMORPG & Canvas' },
        { id: 'hobotools',    name: 'HoboTools',     url: 'https://hobo.tools',        description: 'Nomadic Toolkit & Utilities' },
        { id: 'hobomaps',     name: 'HoboMaps',      url: 'https://maps.hobo.tools',   description: 'Camp & Shelter Locator' },
    ]),
});

module.exports = { BRAND };
