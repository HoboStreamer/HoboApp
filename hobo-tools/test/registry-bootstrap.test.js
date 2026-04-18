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

console.log('✅ hobo-tools registry bootstrap test passed');
