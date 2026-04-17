'use strict';

const { BRAND } = require('./brand');
const { HoboAuthClient } = require('./auth-client');
const { CSS_VARIABLES, DEFAULT_VARS, BUILTIN_THEMES, applyTheme, resolveBuiltinTheme, sanitizeCssValue, loadFromStorage, saveToStorage, syncThemeToServer } = require('./theme-sync');
const { extractToken, requireHoboAuth, optionalHoboAuth, internalApiAuth } = require('./middleware');
const { PRIORITY, CATEGORY, TYPES, SOUNDS, EMAIL_ELIGIBLE_CATEGORIES, createNotification, DEFAULT_NOTIFICATION_PREFS } = require('./notifications');
const { AnalyticsTracker, classifyRequest, parseUserAgent, ANALYTICS_SCHEMA, BOT_USER_AGENTS, SUSPICIOUS_PATTERNS } = require('./analytics');
const { URL_DEFINITIONS, normalizeValue, validateValue, resolveRegistryValues, formatRegistryEntry } = require('./url-resolver');

module.exports = {
    // Brand
    BRAND,
    // Auth
    HoboAuthClient,
    extractToken,
    requireHoboAuth,
    optionalHoboAuth,
    internalApiAuth,
    // Themes
    CSS_VARIABLES,
    DEFAULT_VARS,
    BUILTIN_THEMES,
    applyTheme,
    resolveBuiltinTheme,
    sanitizeCssValue,
    loadFromStorage,
    saveToStorage,
    syncThemeToServer,
    // Notifications
    PRIORITY,
    CATEGORY,
    NOTIFICATION_TYPES: TYPES,
    SOUNDS,
    EMAIL_ELIGIBLE_CATEGORIES,
    createNotification,
    DEFAULT_NOTIFICATION_PREFS,
    // Analytics
    AnalyticsTracker,
    classifyRequest,
    parseUserAgent,
    ANALYTICS_SCHEMA,
    BOT_USER_AGENTS,
    SUSPICIOUS_PATTERNS,
    // URL Registry Resolver
    URL_DEFINITIONS,
    normalizeValue,
    validateValue,
    resolveRegistryValues,
    formatRegistryEntry,
    resolveBrandUrls,
    // Client-side modules (browser only — require() for bundlers, <script> tag for direct use)
    // HoboNotifications: require('./notification-ui'),
    // HoboUserCard: require('./user-card'),
    // HoboNavbar: require('./navbar'),
    // HoboAccountSwitcher: require('./account-switcher'),
};
