'use strict';

// ═══════════════════════════════════════════════════════════════
// Hobo Network — Brand Constants
// Shared across all Hobo services for consistent branding.
// ═══════════════════════════════════════════════════════════════

function getDefaultBrandUrls(env = process.env) {
    return {
        tools:    env.HOBO_TOOLS_URL || 'https://hobo.tools',
        login:    env.LOGIN_URL || env.HOBO_TOOLS_URL || 'https://hobo.tools',
        maps:     env.HOBO_MAPS_URL || 'https://maps.hobo.tools',
        dl:       env.HOBO_DL_URL || 'https://dl.hobo.tools',
        img:      env.HOBO_IMG_URL || 'https://img.hobo.tools',
        yt:       env.HOBO_YT_URL || 'https://yt.hobo.tools',
        audio:    env.HOBO_AUDIO_URL || 'https://audio.hobo.tools',
        text:     env.HOBO_TEXT_URL || 'https://text.hobo.tools',
        logo:     env.HOBO_LOGO_URL || 'https://logo.hobo.tools',
        net:      env.HOBO_NET_URL || 'https://net.hobo.tools',
        dev:      env.HOBO_DEV_URL || 'https://dev.hobo.tools',
        streamer: env.BASE_URL || env.HOBOSTREAMER_URL || 'https://hobostreamer.com',
        quest:    env.HOBOQUEST_URL || 'https://hobo.quest',
        discord:  'https://discord.gg/M6MuRUaeJj',
        github:   'https://github.com/HoboStreamer',
    };
}

const DEFAULT_URLS = Object.freeze(getDefaultBrandUrls());

function resolveBrandUrls(overrides = {}, env = process.env) {
    return Object.freeze({
        ...getDefaultBrandUrls(env),
        ...overrides,
    });
}

const BRAND = Object.freeze({
    name: 'Hobo Network',
    tagline: 'One Account. All of Hobo.',
    campTagline: 'Live Streaming for Camp Culture',

    urls: resolveBrandUrls(),

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
        { id: 'hoboimg',      name: 'HoboImg',       url: 'https://img.hobo.tools',    description: 'Image Converter & Tools' },
        { id: 'hoboyt',       name: 'HoboYT',        url: 'https://yt.hobo.tools',     description: 'YouTube Downloader' },
        { id: 'hoboaudio',    name: 'HoboAudio',     url: 'https://audio.hobo.tools',  description: 'Audio Converter & Effects' },
        { id: 'hobotext',     name: 'HoboText',      url: 'https://text.hobo.tools',   description: 'Text Generation & Unicode' },
        { id: 'hobologo',     name: 'HoboLogo',      url: 'https://logo.hobo.tools',   description: 'Logo & Title Card Maker' },        { id: 'hobonet',      name: 'HoboNet',      url: 'https://net.hobo.tools',    description: 'Network & Internet Diagnostics' },
        { id: 'hobodev',      name: 'HoboDev',      url: 'https://dev.hobo.tools',    description: 'Developer & SEO Tools' },    ]),
});

module.exports = { BRAND, resolveBrandUrls };
