const assert = require('assert');
const { URL_DEFINITIONS, normalizeValue, resolveRegistryValues } = require('../url-resolver');

const env = {
    BASE_URL: 'https://env.example.com',
    WEBRTC_PUBLIC_URL: 'https://webrtc.env.example.com',
    HOBO_TOOLS_URL: 'https://tools.env.example.com',
};

const bootstrap = {
    BASE_URL: 'https://bootstrap.example.com',
    WHIP_PUBLIC_URL: 'https://bootstrap.whip.example.com',
};

const overrides = {
    BASE_URL: 'https://admin.example.com',
};

const resolved = resolveRegistryValues(env, overrides, bootstrap, URL_DEFINITIONS);
assert.strictEqual(resolved.BASE_URL.value, 'https://admin.example.com');
assert.strictEqual(resolved.BASE_URL.source, 'admin');
assert.strictEqual(resolved.WHIP_PUBLIC_URL.value, 'https://bootstrap.whip.example.com');
assert.strictEqual(resolved.WHIP_PUBLIC_URL.source, 'bootstrap');
assert.strictEqual(resolved.WEBRTC_PUBLIC_URL.value, 'https://webrtc.env.example.com');
assert.strictEqual(resolved.WEBRTC_PUBLIC_URL.source, 'env');
assert.strictEqual(resolved.HOBO_TOOLS_URL.value, 'https://tools.env.example.com');
assert.strictEqual(resolved.HOBO_TOOLS_URL.source, 'env');
assert.strictEqual(resolved.JSMPEG_PUBLIC_URL.source, 'default');

assert.strictEqual(normalizeValue('turn:turn.example.com:3478', 'turn_url'), 'turn:turn.example.com:3478');
assert.strictEqual(normalizeValue('turn://turn.example.com:3478', 'turn_url'), 'turn:turn.example.com:3478');
assert.strictEqual(normalizeValue('turns://turn.example.com:5349', 'turn_url'), 'turns:turn.example.com:5349');
assert.strictEqual(normalizeValue('turn://user:pass@turn.example.com:3478', 'turn_url'), null);
assert.strictEqual(normalizeValue('turn://invalid host', 'turn_url'), null);

console.log('✅ hobo-shared url-resolver precedence test passed');
