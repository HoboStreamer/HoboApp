const assert = require('assert');
const adminRoutes = require('../server/admin/routes');

const getServiceRefreshInfo = adminRoutes._getServiceRefreshInfo;

assert.ok(typeof getServiceRefreshInfo === 'function', 'Expected getServiceRefreshInfo helper to exist');

const mockReq = {
    app: {
        locals: {
            config: {
                services: {
                    hobostreamer: { internalUrl: 'http://127.0.0.1:3000' },
                },
            },
        },
    },
};

const hoboToolsInfo = getServiceRefreshInfo(mockReq, 'hobotools');
assert.strictEqual(hoboToolsInfo.mode, 'local');
assert.strictEqual(hoboToolsInfo.service, 'hobotools');
assert.strictEqual(hoboToolsInfo.configured, true);
assert.strictEqual(hoboToolsInfo.target, null);

const hobodocsInfo = getServiceRefreshInfo(mockReq, 'hobodocs');
assert.strictEqual(hobodocsInfo.mode, 'not_configured');
assert.strictEqual(hobodocsInfo.configured, false);
assert.strictEqual(hobodocsInfo.target, null);

const streamerInfo = getServiceRefreshInfo(mockReq, 'hobostreamer');
assert.strictEqual(streamerInfo.mode, 'remote');
assert.strictEqual(streamerInfo.configured, true);
assert.strictEqual(streamerInfo.target, 'http://127.0.0.1:3000/internal/url-registry/refresh');

console.log('✅ Admin service refresh helper tests passed');
