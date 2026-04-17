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
            updated_by INTEGER,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

function getRegistryRows(db) {
    return db.prepare('SELECT key, label, category, service, scope, type, value, description, updated_by, updated_at FROM url_registry ORDER BY category, service, key').all();
}

function getRegistryRow(db, key) {
    return db.prepare('SELECT key, label, category, service, scope, type, value, description, updated_by, updated_at FROM url_registry WHERE key = ?').get(key);
}

function getAllRegistryEntries(db) {
    const rows = db.prepare('SELECT key, value, updated_by, updated_at FROM url_registry').all();
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
            source: row?.value ? 'admin' : 'default',
            placeholder: def.default || '',
        };
    });
}

function loadOverrides(db) {
    const rows = db.prepare('SELECT key, value FROM url_registry WHERE value IS NOT NULL AND value != ""').all();
    return rows.reduce((map, row) => {
        map[row.key] = row.value;
        return map;
    }, {});
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
        updated_by: row.updated_by || null,
        updated_at: row.updated_at || null,
    };
}

function getResolvedRegistry(db, env = process.env) {
    const overrides = loadOverrides(db);
    return resolveRegistryValues(env, overrides, URL_DEFINITIONS);
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
        INSERT INTO url_registry (key, label, category, service, scope, type, value, description, updated_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
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

module.exports = {
    initializeUrlRegistry,
    getRegistryRows,
    getAllRegistryEntries,
    getRegistryRow,
    setRegistryEntry,
    resetRegistryEntry,
    loadOverrides,
    getResolvedRegistry,
    formatEntry,
};
