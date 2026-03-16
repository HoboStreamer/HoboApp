'use strict';

// ═══════════════════════════════════════════════════════════════
// Hobo Network — Theme Sync Engine
// Isomorphic theme system shared across all Hobo services.
// Works in both Node.js (SSR) and browser environments.
// ═══════════════════════════════════════════════════════════════

const CSS_VARIABLES = [
    '--bg-primary', '--bg-secondary', '--bg-tertiary', '--bg-card',
    '--bg-hover', '--bg-input',
    '--text-primary', '--text-secondary', '--text-muted',
    '--accent', '--accent-light', '--accent-dark',
    '--live-red', '--success', '--warning', '--danger', '--info',
    '--border', '--border-light', '--shadow', '--shadow-lg',
];

const DEFAULT_VARS = Object.freeze({
    '--bg-primary':   '#1e1e24',
    '--bg-secondary': '#252530',
    '--bg-tertiary':  '#2a2a38',
    '--bg-card':      '#22222c',
    '--bg-hover':     '#2f2f3d',
    '--bg-input':     '#1a1a22',
    '--text-primary': '#e0e0e0',
    '--text-secondary': '#b0b0b8',
    '--text-muted':   '#707080',
    '--accent':       '#c0965c',
    '--accent-light': '#dbb077',
    '--accent-dark':  '#a07840',
    '--live-red':     '#e74c3c',
    '--success':      '#2ecc71',
    '--warning':      '#f39c12',
    '--danger':       '#e74c3c',
    '--info':         '#3498db',
    '--border':       '#333340',
    '--border-light': '#404050',
    '--shadow':       '0 2px 8px rgba(0,0,0,0.3)',
    '--shadow-lg':    '0 8px 32px rgba(0,0,0,0.5)',
});

// ── Built-in Themes ──────────────────────────────────────────
// Minimal subset — full catalog lives in hobo.tools DB.
// These ship with every Hobo service for offline/fast paint.
const BUILTIN_THEMES = [
    {
        id: 'campfire',
        name: 'Campfire',
        slug: 'campfire',
        mode: 'dark',
        description: 'Default Hobo warmth',
        variables: { ...DEFAULT_VARS },
    },
    {
        id: 'midnight',
        name: 'Midnight',
        slug: 'midnight',
        mode: 'dark',
        description: 'Deep blue darkness',
        variables: {
            ...DEFAULT_VARS,
            '--bg-primary': '#0d1117', '--bg-secondary': '#161b22',
            '--bg-tertiary': '#1c2333', '--bg-card': '#0f1419',
            '--accent': '#58a6ff', '--accent-light': '#79c0ff', '--accent-dark': '#388bfd',
        },
    },
    {
        id: 'forest',
        name: 'Forest',
        slug: 'forest',
        mode: 'dark',
        description: 'Deep green canopy',
        variables: {
            ...DEFAULT_VARS,
            '--bg-primary': '#1a2318', '--bg-secondary': '#212d1e',
            '--bg-tertiary': '#283626', '--bg-card': '#1c261a',
            '--accent': '#6abf69', '--accent-light': '#8fd88e', '--accent-dark': '#4a9f49',
        },
    },
    {
        id: 'neon-tokyo',
        name: 'Neon Tokyo',
        slug: 'neon-tokyo',
        mode: 'dark',
        description: 'Cyberpunk neon glow',
        variables: {
            ...DEFAULT_VARS,
            '--bg-primary': '#0a0a1a', '--bg-secondary': '#12122a',
            '--bg-tertiary': '#1a1a3a', '--bg-card': '#0e0e22',
            '--accent': '#ff2d95', '--accent-light': '#ff6eb4', '--accent-dark': '#cc1a72',
        },
    },
];

// ── Dangerous CSS patterns (XSS prevention) ─────────────────
const DANGEROUS_PATTERNS = [
    /url\s*\(/i, /expression\s*\(/i, /javascript:/i,
    /@import/i, /behavior\s*:/i, /var\s*\(/i, /-moz-binding/i,
];

function sanitizeCssValue(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed.length > 200) return null;
    for (const pat of DANGEROUS_PATTERNS) {
        if (pat.test(trimmed)) return null;
    }
    return trimmed;
}

// ── Theme Application ────────────────────────────────────────

/**
 * Apply a theme's variables to a target (DOM element or plain object).
 * In browser: pass `document.documentElement` as target.
 * In Node: pass an empty object to collect computed values.
 */
function applyTheme(theme, target) {
    if (!theme || !theme.variables) return;
    const vars = { ...DEFAULT_VARS, ...theme.variables };
    for (const [key, value] of Object.entries(vars)) {
        if (!CSS_VARIABLES.includes(key)) continue;
        const safe = sanitizeCssValue(value);
        if (!safe) continue;
        if (target && typeof target.style !== 'undefined' && target.style.setProperty) {
            // DOM element (browser)
            target.style.setProperty(key, safe);
        } else if (typeof target === 'object') {
            // Plain object (Node SSR)
            target[key] = safe;
        }
    }
}

/**
 * Resolve a theme by ID from the built-in catalog.
 * Falls back to 'campfire' if not found.
 */
function resolveBuiltinTheme(themeId) {
    return BUILTIN_THEMES.find(t => t.id === themeId || t.slug === themeId)
        || BUILTIN_THEMES[0];
}

// ── Browser-Only Helpers ─────────────────────────────────────
// These are safe to call in Node (they no-op if `window` is undefined).

const STORAGE_KEY = 'hobo_theme';
const THEME_API_BASE = 'https://hobo.tools/api/themes';

function loadFromStorage() {
    if (typeof localStorage === 'undefined') return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function saveToStorage(theme) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            id: theme.id,
            slug: theme.slug,
            name: theme.name,
            mode: theme.mode,
            variables: theme.variables,
        }));
    } catch { /* quota exceeded, etc. */ }
}

/**
 * Sync theme choice to the central hobo.tools server.
 * Requires an auth token. Fails silently if offline.
 */
async function syncThemeToServer(themeId, customVars, token) {
    if (typeof fetch === 'undefined' || !token) return;
    try {
        await fetch(`${THEME_API_BASE}/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ theme_id: themeId, custom_variables: customVars || null }),
        });
    } catch { /* offline, CORS, etc. */ }
}

module.exports = {
    CSS_VARIABLES,
    DEFAULT_VARS,
    BUILTIN_THEMES,
    sanitizeCssValue,
    applyTheme,
    resolveBuiltinTheme,
    loadFromStorage,
    saveToStorage,
    syncThemeToServer,
    STORAGE_KEY,
};
