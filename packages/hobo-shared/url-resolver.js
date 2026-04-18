'use strict';

const URL_DEFINITIONS = Object.freeze({
    BASE_URL: {
        key: 'BASE_URL',
        label: 'HoboStreamer Public URL',
        category: 'public_first_party_urls',
        service: 'hobostreamer',
        scope: 'global',
        type: 'origin',
        default: 'http://localhost:3000',
        description: 'Canonical public origin for HoboStreamer.com.',
    },
    WEBRTC_PUBLIC_URL: {
        key: 'WEBRTC_PUBLIC_URL',
        label: 'WebRTC Public URL',
        category: 'protocol_ingest_urls',
        service: 'hobostreamer',
        scope: 'global',
        type: 'origin',
        default: 'http://localhost:3000',
        description: 'Public origin used for WebRTC endpoint discovery and browser consumers.',
    },
    WHIP_PUBLIC_URL: {
        key: 'WHIP_PUBLIC_URL',
        label: 'WHIP Public URL',
        category: 'protocol_ingest_urls',
        service: 'hobostreamer',
        scope: 'global',
        type: 'origin',
        default: 'http://localhost:3000',
        description: 'Canonical WHIP ingestion origin for OBS and other WHIP clients.',
    },
    JSMPEG_PUBLIC_URL: {
        key: 'JSMPEG_PUBLIC_URL',
        label: 'JSMPEG Public URL',
        category: 'protocol_ingest_urls',
        service: 'hobostreamer',
        scope: 'global',
        type: 'origin',
        default: 'http://localhost:3000',
        description: 'Public origin used to construct JSMPEG relay endpoints for browsers and FFmpeg clients.',
    },
    TURN_URL: {
        key: 'TURN_URL',
        label: 'TURN URL',
        category: 'protocol_ingest_urls',
        service: 'hobostreamer',
        scope: 'global',
        type: 'turn_url',
        default: '',
        description: 'TURN server connection string used for WebRTC NAT traversal.',
    },
    MEDIASOUP_ANNOUNCED_IP: {
        key: 'MEDIASOUP_ANNOUNCED_IP',
        label: 'Mediasoup Announced IP/Hostname',
        category: 'protocol_ingest_urls',
        service: 'hobostreamer',
        scope: 'global',
        type: 'hostname',
        default: 'localhost',
        description: 'Hostname or public IP advertised in Mediasoup ICE candidates.',
    },
    RTMP_HOST: {
        key: 'RTMP_HOST',
        label: 'RTMP Host',
        category: 'protocol_ingest_urls',
        service: 'hobostreamer',
        scope: 'global',
        type: 'rtmp_host',
        default: '',
        description: 'Hostname used for RTMP ingest. Do not include protocol or path.',
    },
    HOBO_TOOLS_URL: {
        key: 'HOBO_TOOLS_URL',
        label: 'Hobo.Tools URL',
        category: 'public_first_party_urls',
        service: 'hobotools',
        scope: 'global',
        type: 'origin',
        default: 'https://hobo.tools',
        description: 'Public URL for the Hobo.Tools SSO and registry service.',
    },
    HOBO_TOOLS_LOGIN_URL: {
        key: 'HOBO_TOOLS_LOGIN_URL',
        label: 'Hobo.Tools Login URL',
        category: 'public_first_party_urls',
        service: 'hobotools',
        scope: 'global',
        type: 'origin',
        default: 'https://hobo.tools',
        description: 'Public login URL for Hobo.Tools. Typically the same as the public Hobo.Tools origin.',
    },
    HOBO_TOOLS_INTERNAL_URL: {
        key: 'HOBO_TOOLS_INTERNAL_URL',
        label: 'Hobo.Tools Internal URL',
        category: 'internal_service_urls',
        service: 'hobotools',
        scope: 'global',
        type: 'internal_base_url',
        default: 'http://127.0.0.1:3100',
        description: 'Internal URL used by services to call the Hobo.Tools internal API.',
    },
    HOBOSTREAMER_INTERNAL_URL: {
        key: 'HOBOSTREAMER_INTERNAL_URL',
        label: 'HoboStreamer Internal URL',
        category: 'internal_service_urls',
        service: 'hobostreamer',
        scope: 'global',
        type: 'internal_base_url',
        default: 'http://127.0.0.1:3000',
        description: 'Internal URL used by Hobo.Tools or other Hobo services to reach HoboStreamer.',
    },
    HOBOQUEST_INTERNAL_URL: {
        key: 'HOBOQUEST_INTERNAL_URL',
        label: 'HoboQuest Internal URL',
        category: 'internal_service_urls',
        service: 'hoboquest',
        scope: 'global',
        type: 'internal_base_url',
        default: 'http://127.0.0.1:3200',
        description: 'Internal URL used by Hobo.Tools to reach HoboQuest.',
    },
    HOBOMAPS_INTERNAL_URL: {
        key: 'HOBOMAPS_INTERNAL_URL',
        label: 'HoboMaps Internal URL',
        category: 'internal_service_urls',
        service: 'hobomaps',
        scope: 'global',
        type: 'internal_base_url',
        default: 'http://127.0.0.1:3300',
        description: 'Internal URL used by Hobo.Tools to reach HoboMaps.',
    },
    HOBOFOOD_INTERNAL_URL: {
        key: 'HOBOFOOD_INTERNAL_URL',
        label: 'HoboFood Internal URL',
        category: 'internal_service_urls',
        service: 'hobofood',
        scope: 'global',
        type: 'internal_base_url',
        default: 'http://127.0.0.1:3301',
        description: 'Internal URL used by Hobo.Tools to reach HoboFood.',
    },
    HOBOIMG_INTERNAL_URL: {
        key: 'HOBOIMG_INTERNAL_URL',
        label: 'HoboImg Internal URL',
        category: 'internal_service_urls',
        service: 'hoboimg',
        scope: 'global',
        type: 'internal_base_url',
        default: 'http://127.0.0.1:3400',
        description: 'Internal URL used by Hobo.Tools to reach HoboImg.',
    },
    HOBOYT_INTERNAL_URL: {
        key: 'HOBOYT_INTERNAL_URL',
        label: 'HoboYT Internal URL',
        category: 'internal_service_urls',
        service: 'hoboyt',
        scope: 'global',
        type: 'internal_base_url',
        default: 'http://127.0.0.1:3401',
        description: 'Internal URL used by Hobo.Tools to reach HoboYT.',
    },
    HOBOAUDIO_INTERNAL_URL: {
        key: 'HOBOAUDIO_INTERNAL_URL',
        label: 'HoboAudio Internal URL',
        category: 'internal_service_urls',
        service: 'hoboaudio',
        scope: 'global',
        type: 'internal_base_url',
        default: 'http://127.0.0.1:3500',
        description: 'Internal URL used by Hobo.Tools to reach HoboAudio.',
    },
    HOBOTEXT_INTERNAL_URL: {
        key: 'HOBOTEXT_INTERNAL_URL',
        label: 'HoboText Internal URL',
        category: 'internal_service_urls',
        service: 'hobotext',
        scope: 'global',
        type: 'internal_base_url',
        default: 'http://127.0.0.1:3600',
        description: 'Internal URL used by Hobo.Tools to reach HoboText.',
    },
    HOBODOCS_INTERNAL_URL: {
        key: 'HOBODOCS_INTERNAL_URL',
        label: 'HoboDocs Internal URL',
        category: 'internal_service_urls',
        service: 'hobodocs',
        scope: 'global',
        type: 'internal_base_url',
        default: 'http://127.0.0.1:3400',
        description: 'Internal URL used by Hobo.Tools to reach HoboDocs.',
    },
});

function normalizeOrigin(value) {
    if (!value || typeof value !== 'string') return null;
    try {
        const url = new URL(value.trim());
        if (!url.protocol || !url.hostname) return null;
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
    } catch {
        return null;
    }
}

function normalizeInternalBaseUrl(value) {
    if (!value || typeof value !== 'string') return null;
    try {
        const url = new URL(value.trim());
        if (!url.protocol || !url.hostname) return null;
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
    } catch {
        return null;
    }
}

function normalizeWsOrigin(value) {
    if (!value || typeof value !== 'string') return null;
    try {
        const url = new URL(value.trim());
        if (!url.hostname) return null;
        if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return null;
        return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
    } catch {
        return null;
    }
}

function normalizeHostname(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (/^\w+:\/\//.test(trimmed)) {
        try {
            const url = new URL(trimmed);
            return url.hostname || null;
        } catch {
            return null;
        }
    }
    if (/[^a-zA-Z0-9.\-:]/.test(trimmed)) return null;
    return trimmed;
}

function normalizeTurnUrl(value) {
    if (!value || typeof value !== 'string') return null;
    let trimmed = value.trim();
    if (/^turns?:[^/]/i.test(trimmed)) {
        trimmed = trimmed.replace(/^turns?:/i, (s) => s + '//');
    }
    if (!/^turns?:\/\//i.test(trimmed)) return null;
    try {
        const url = new URL(trimmed);
        if (!url.hostname) return null;
        return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}${url.search}`;
    } catch {
        return null;
    }
}

function normalizeJson(value, type) {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }
    if (type === 'json_map' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return value;
    }
    if (type === 'json_array' && Array.isArray(value)) {
        return value;
    }
    return null;
}

function normalizeValue(value, type) {
    if (value === undefined || value === null) return null;
    switch (type) {
        case 'origin': return normalizeOrigin(value);
        case 'internal_base_url': return normalizeInternalBaseUrl(value);
        case 'ws_origin': return normalizeWsOrigin(value);
        case 'hostname': return normalizeHostname(value);
        case 'rtmp_host': return normalizeHostname(value);
        case 'turn_url': return normalizeTurnUrl(value);
        case 'json_map': return normalizeJson(value, 'json_map');
        case 'json_array': return normalizeJson(value, 'json_array');
        case 'string': return typeof value === 'string' ? value.trim() : String(value);
        default: return typeof value === 'string' ? value.trim() : String(value);
    }
}

function validateValue(value, type) {
    return normalizeValue(value, type) !== null;
}

function resolveRegistryValues(env = {}, overrides = {}, bootstrap = {}, definitions = URL_DEFINITIONS) {
    const resolved = {};
    for (const [key, def] of Object.entries(definitions)) {
        let rawValue = def.default;
        let source = 'default';
        if (env[key]) {
            rawValue = env[key];
            source = 'env';
        }
        if (bootstrap[key] != null && bootstrap[key] !== '') {
            rawValue = bootstrap[key];
            source = 'bootstrap';
        }
        if (overrides[key] != null && overrides[key] !== '') {
            rawValue = overrides[key];
            source = 'admin';
        }
        const normalized = normalizeValue(rawValue, def.type);
        resolved[key] = {
            key,
            label: def.label,
            category: def.category,
            service: def.service,
            scope: def.scope,
            type: def.type,
            description: def.description,
            value: normalized,
            source,
        };
    }
    return resolved;
}

function formatRegistryEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    return {
        key: entry.key,
        label: entry.label,
        category: entry.category,
        service: entry.service,
        scope: entry.scope,
        type: entry.type,
        description: entry.description,
        value: entry.value || null,
        source: entry.source || 'admin',
        updatedBy: entry.updated_by || null,
        updatedAt: entry.updated_at || null,
    };
}

module.exports = {
    URL_DEFINITIONS,
    normalizeValue,
    validateValue,
    resolveRegistryValues,
    formatRegistryEntry,
};
