'use strict';

const { URL_DEFINITIONS, normalizeValue, resolveRegistryValues } = require('hobo-shared/url-resolver');

function initializeUrlRegistry(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS url_registry (
            key TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            category TEXT NOT NULL,
            service TEXT NOT NULL,
            scope TEXT NOT NULL,
            type TEXT NOT NULL,
            value TEXT,
            description TEXT,
            source TEXT NOT NULL DEFAULT 'admin',
            updated_by INTEGER,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

function getRegistryRows(db) {
    return db.prepare('SELECT key, label, category, service, scope, type, value, description, source, updated_by, updated_at FROM url_registry ORDER BY category, service, key').all();
}

function getRegistryRow(db, key) {
    return db.prepare('SELECT key, label, category, service, scope, type, value, description, source, updated_by, updated_at FROM url_registry WHERE key = ?').get(key);
}

function getAllRegistryEntries(db) {
    const rows = db.prepare('SELECT key, value, source, updated_by, updated_at FROM url_registry').all();
    const rowMap = rows.reduce((map, row) => {
        map[row.key] = row;
        return map;
    }, {});

    return Object.values(URL_DEFINITIONS).map(def => {
        const row = rowMap[def.key];
        return {
            key: def.key,
            label: def.label,
            category: def.category,
            service: def.service,
            scope: def.scope,
            type: def.type,
            description: def.description || '',
            value: row?.value || null,
            updated_by: row?.updated_by || null,
            updated_at: row?.updated_at || null,
            source: row?.source || 'default',
            placeholder: def.default || '',
        };
    });
}

function loadRegistryValuesBySource(db, source) {
    const rows = db.prepare("SELECT key, value FROM url_registry WHERE source = ? AND value IS NOT NULL AND value != ''").all(source);
    return rows.reduce((map, row) => {
        map[row.key] = row.value;
        return map;
    }, {});
}

function loadOverrides(db) {
    return loadRegistryValuesBySource(db, 'admin');
}

function loadBootstrapValues(db) {
    return loadRegistryValuesBySource(db, 'bootstrap');
}

function formatEntry(row) {
    if (!row) return null;
    return {
        key: row.key,
        label: row.label,
        category: row.category,
        service: row.service,
        scope: row.scope,
        type: row.type,
        description: row.description || '',
        value: row.value || null,
        source: row.source || 'admin',
        updated_by: row.updated_by || null,
        updated_at: row.updated_at || null,
    };
}

function getResolvedRegistry(db, env = process.env) {
    const overrides = loadOverrides(db);
    const bootstrap = loadBootstrapValues(db);
    return resolveRegistryValues(env, overrides, bootstrap, URL_DEFINITIONS);
}

function setRegistryEntry(db, key, value, updatedBy = null) {
    if (!URL_DEFINITIONS[key]) {
        throw new Error(`Unknown URL registry key: ${key}`);
    }
    const normalized = normalizeValue(value, URL_DEFINITIONS[key].type);
    if (normalized == null) {
        throw new Error(`Invalid value for ${key}`);
    }
    const entry = URL_DEFINITIONS[key];
    db.prepare(`
        INSERT INTO url_registry (key, label, category, service, scope, type, value, description, source, updated_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            source = 'admin',
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
    `).run(entry.key, entry.label, entry.category, entry.service, entry.scope, entry.type, normalized, entry.description, updatedBy);
    return formatEntry(getRegistryRow(db, key));
}

function resetRegistryEntry(db, key) {
    if (!URL_DEFINITIONS[key]) {
        throw new Error(`Unknown URL registry key: ${key}`);
    }
    db.prepare('DELETE FROM url_registry WHERE key = ?').run(key);
    return URL_DEFINITIONS[key];
}

function isRegistrySeeded(db) {
    const rowCount = db.prepare('SELECT COUNT(*) AS cnt FROM url_registry').get().cnt;
    return rowCount > 0;
}

function buildBootstrapOverrides(env = {}, profile = 'local-dev') {
    const bootstrap = {};
    for (const [key, def] of Object.entries(URL_DEFINITIONS)) {
        if (env[key]) {
            bootstrap[key] = env[key];
            continue;
        }
        if (profile === 'local-dev') {
            bootstrap[key] = def.default;
            continue;
        }
        bootstrap[key] = def.default;
    }
    return bootstrap;
}

function seedBootstrapRegistry(db, env = process.env, profile = 'local-dev') {
    const bootstrap = buildBootstrapOverrides(env, profile);
    const insert = db.prepare(`
        INSERT INTO url_registry (key, label, category, service, scope, type, value, description, source, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'bootstrap', CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO NOTHING
    `);
    const exists = db.prepare('SELECT 1 FROM url_registry WHERE key = ? LIMIT 1');

    const tx = db.transaction(() => {
        for (const [key, def] of Object.entries(URL_DEFINITIONS)) {
            if (exists.get(def.key)) continue;
            const value = normalizeValue(bootstrap[key], def.type);
            if (value == null) continue;
            insert.run(def.key, def.label, def.category, def.service, def.scope, def.type, value, def.description || '');
        }
    });
    tx();
}

module.exports = {
    initializeUrlRegistry,
    getRegistryRows,
    getRegistryRow,
    getAllRegistryEntries,
    setRegistryEntry,
    resetRegistryEntry,
    loadOverrides,
    loadBootstrapValues,
    getResolvedRegistry,
    formatEntry,
    isRegistrySeeded,
    seedBootstrapRegistry,
    buildBootstrapOverrides,
};
