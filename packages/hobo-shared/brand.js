'use strict';

// ═══════════════════════════════════════════════════════════════
// Hobo Network — Brand Constants
// Shared across all Hobo services for consistent branding.
// Values are seeded with Hobo Network defaults and can be
// overridden at runtime via the URL registry / admin panel.
// ═══════════════════════════════════════════════════════════════

// ── Default (Hobo Network) values ────────────────────────────
// These are the canonical defaults for the Hobo deployment.
// White-label installs override via the URL registry.

const BRAND_DEFAULTS = Object.freeze({
    networkName:        'Hobo Network',
    toolsServiceName:   'HoboTools',
    streamerServiceName:'HoboStreamer',
    tagline:            'One Account. All of Hobo.',
    campTagline:        'Live Streaming for Camp Culture',
    toolsSubdomainBase: 'hobo.tools',
    discord:            'https://discord.gg/M6MuRUaeJj',
    github:             'https://github.com/HoboStreamer',
});

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
        discord:  BRAND_DEFAULTS.discord,
        github:   BRAND_DEFAULTS.github,
    };
}

const DEFAULT_URLS = Object.freeze(getDefaultBrandUrls());

function resolveBrandUrls(overrides = {}, env = process.env) {
    return Object.freeze({
        ...getDefaultBrandUrls(env),
        ...overrides,
    });
}

/**
 * Build a brand object from a resolved URL registry map.
 * Call this server-side when the canonical registry has been loaded.
 *
 * @param {Object} registry - resolved registry map from resolveRegistryValues()
 * @param {Object} [env]    - process.env fallback
 * @returns {Object}         brand object with names, urls, colors, services, oauth
 */
function buildBrandFromRegistry(registry = {}, env = process.env) {
    const get = (key) => (registry[key]?.value) || null;

    const networkName        = get('NETWORK_NAME')        || BRAND_DEFAULTS.networkName;
    const toolsServiceName   = get('TOOLS_SERVICE_NAME')  || BRAND_DEFAULTS.toolsServiceName;
    const streamerServiceName= get('STREAMER_SERVICE_NAME')|| BRAND_DEFAULTS.streamerServiceName;
    const toolsUrl           = get('HOBO_TOOLS_URL')      || getDefaultBrandUrls(env).tools;
    const streamerUrl        = get('BASE_URL')             || getDefaultBrandUrls(env).streamer;

    const urls = resolveBrandUrls({
        tools:    toolsUrl,
        login:    get('HOBO_TOOLS_LOGIN_URL') || toolsUrl,
        streamer: streamerUrl,
    }, env);

    // Build service list using registry URLs where available
    const services = [
        { id: 'hobostreamer', name: streamerServiceName,   url: streamerUrl,                   description: 'Live Streaming Platform' },
        { id: 'hoboquest',    name: 'HoboQuest',           url: urls.quest,                    description: 'Community MMORPG & Canvas' },
        { id: 'hobotools',    name: toolsServiceName,       url: toolsUrl,                      description: 'Nomadic Toolkit & Utilities' },
        { id: 'hobomaps',     name: 'HoboMaps',            url: urls.maps,                     description: 'Camp & Shelter Locator' },
        { id: 'hoboimg',      name: 'HoboImg',             url: urls.img,                      description: 'Image Converter & Tools' },
        { id: 'hoboyt',       name: 'HoboYT',              url: urls.yt,                       description: 'YouTube Downloader' },
        { id: 'hoboaudio',    name: 'HoboAudio',           url: urls.audio,                    description: 'Audio Converter & Effects' },
        { id: 'hobotext',     name: 'HoboText',            url: urls.text,                     description: 'Text Generation & Unicode' },
        { id: 'hobologo',     name: 'HoboLogo',            url: urls.logo,                     description: 'Logo & Title Card Maker' },
        { id: 'hobonet',      name: 'HoboNet',             url: urls.net,                      description: 'Network & Internet Diagnostics' },
        { id: 'hobodev',      name: 'HoboDev',             url: urls.dev,                      description: 'Developer & SEO Tools' },
    ];

    return Object.freeze({
        name:        networkName,
        toolsName:   toolsServiceName,
        streamerName:streamerServiceName,
        tagline:     BRAND_DEFAULTS.tagline,
        campTagline: BRAND_DEFAULTS.campTagline,
        toolsSubdomainBase: get('TOOLS_SUBDOMAIN_BASE') || BRAND_DEFAULTS.toolsSubdomainBase,
        urls:        Object.freeze(urls),
        colors:      BRAND.colors,
        oauth:       BRAND.oauth,
        services:    Object.freeze(services),
    });
}

const BRAND = Object.freeze({
    name: BRAND_DEFAULTS.networkName,
    tagline: BRAND_DEFAULTS.tagline,
    campTagline: BRAND_DEFAULTS.campTagline,

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
    // Static list with Hobo defaults — use buildBrandFromRegistry() for live values.
    services: Object.freeze([
        { id: 'hobostreamer', name: 'HoboStreamer',  url: 'https://hobostreamer.com',  description: 'Live Streaming Platform' },
        { id: 'hoboquest',    name: 'HoboQuest',     url: 'https://hobo.quest',        description: 'Community MMORPG & Canvas' },
        { id: 'hobotools',    name: 'HoboTools',     url: 'https://hobo.tools',        description: 'Nomadic Toolkit & Utilities' },
        { id: 'hobomaps',     name: 'HoboMaps',      url: 'https://maps.hobo.tools',   description: 'Camp & Shelter Locator' },
        { id: 'hoboimg',      name: 'HoboImg',       url: 'https://img.hobo.tools',    description: 'Image Converter & Tools' },
        { id: 'hoboyt',       name: 'HoboYT',        url: 'https://yt.hobo.tools',     description: 'YouTube Downloader' },
        { id: 'hoboaudio',    name: 'HoboAudio',     url: 'https://audio.hobo.tools',  description: 'Audio Converter & Effects' },
        { id: 'hobotext',     name: 'HoboText',      url: 'https://text.hobo.tools',   description: 'Text Generation & Unicode' },
        { id: 'hobologo',     name: 'HoboLogo',      url: 'https://logo.hobo.tools',   description: 'Logo & Title Card Maker' },
        { id: 'hobonet',      name: 'HoboNet',       url: 'https://net.hobo.tools',    description: 'Network & Internet Diagnostics' },
        { id: 'hobodev',      name: 'HoboDev',       url: 'https://dev.hobo.tools',    description: 'Developer & SEO Tools' },
    ]),
});

module.exports = { BRAND, BRAND_DEFAULTS, resolveBrandUrls, buildBrandFromRegistry };
