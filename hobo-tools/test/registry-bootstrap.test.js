const assert = require('assert');
const Database = require('better-sqlite3');
const urlRegistry = require('../server/url-registry');

const db = new Database(':memory:');
urlRegistry.initializeUrlRegistry(db);
urlRegistry.seedBootstrapRegistry(db, { BASE_URL: 'https://bootstrap.example.com', HOBO_TOOLS_URL: 'https://hobo.tools' }, 'local-dev');
const resolved = urlRegistry.getResolvedRegistry(db, {});
assert.strictEqual(resolved.BASE_URL.value, 'https://bootstrap.example.com');
assert.strictEqual(resolved.BASE_URL.source, 'bootstrap');
assert.strictEqual(resolved.HOBO_TOOLS_URL.value, 'https://hobo.tools');
assert.strictEqual(resolved.HOBO_TOOLS_URL.source, 'bootstrap');
assert.strictEqual(resolved.WHIP_PUBLIC_URL.value, 'http://localhost:3000');
assert.strictEqual(resolved.WHIP_PUBLIC_URL.source, 'bootstrap');
assert.strictEqual(resolved.HOBOSTREAMER_INTERNAL_URL.value, 'http://127.0.0.1:3000');
assert.strictEqual(resolved.HOBOSTREAMER_INTERNAL_URL.source, 'bootstrap');

const storedExtra = db.prepare('SELECT key, value, type FROM url_registry WHERE key = ?').get('ALLOWED_EXTRA_ORIGINS');
assert.strictEqual(storedExtra.type, 'json_array');
assert.strictEqual(storedExtra.value, '[]');
assert.deepStrictEqual(urlRegistry.getAllRegistryEntries(db).find(e => e.key === 'ALLOWED_EXTRA_ORIGINS').value, []);

const updated = urlRegistry.setRegistryEntry(db, 'ALLOWED_EXTRA_ORIGINS', ['https://cdn.example.com'], null);
assert.deepStrictEqual(updated.value, ['https://cdn.example.com']);
assert.deepStrictEqual(urlRegistry.getAllRegistryEntries(db).find(e => e.key === 'ALLOWED_EXTRA_ORIGINS').value, ['https://cdn.example.com']);

const scalarUpdated = urlRegistry.setRegistryEntry(db, 'NETWORK_NAME', 'CoolTools', null);
assert.strictEqual(scalarUpdated.value, 'CoolTools');
assert.strictEqual(urlRegistry.getAllRegistryEntries(db).find(e => e.key === 'NETWORK_NAME').value, 'CoolTools');

const overrides = urlRegistry.loadOverrides(db);
assert.deepStrictEqual(overrides.ALLOWED_EXTRA_ORIGINS, ['https://cdn.example.com']);
assert.strictEqual(overrides.NETWORK_NAME, 'CoolTools');

console.log('✅ hobo-tools registry bootstrap test passed');
