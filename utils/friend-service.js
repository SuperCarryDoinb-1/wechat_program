const env = require('../config/env');
const { validRid, publicResult } = require('./public-result');

function loadFriend(platform, rid, settings = env) {
  if (!validRid(rid) || settings.mode === 'mock' || !settings.cloudEnvId || !platform.cloud) return Promise.resolve(null);
  return new Promise(resolve => {
    let settled = false;
    const finish = value => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => finish(null), settings.timeoutMs || 8000);
    try {
      Promise.resolve(platform.cloud.callFunction({ name: 'getResult', data: { rid } }))
        .then(response => finish(publicResult(response && response.result)), () => finish(null));
    } catch (_) { finish(null); }
  });
}
module.exports = { loadFriend };
