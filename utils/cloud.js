const env = require('../config/env');
let state = { mode: 'unavailable', ready: false };

function initialize() {
  if (env.mode === 'mock') {
    state = { mode: 'mock', ready: true };
    return state;
  }
  state = { mode: 'unavailable', ready: false };
  if (!env.cloudEnvId || typeof wx === 'undefined' || !wx.cloud) return state;
  try {
    wx.cloud.init({ env: env.cloudEnvId, traceUser: false });
    state = { mode: 'cloud', ready: true };
  } catch (_) {
    // 真实环境失败时不伪装为模拟成功。
  }
  return state;
}

async function check() {
  if (!state.ready) throw new Error('CLOUD_UNAVAILABLE');
  if (state.mode === 'mock') {
    // 只模拟本次检查，不存储用户数据，也不冒充真实云调用。
    const records = new Map();
    records.set('m0-healthcheck', { kind: 'm0-healthcheck', ok: true });
    return { ok: records.get('m0-healthcheck').ok, mode: 'mock', database: 'ok' };
  }
  let timer;
  try {
    const response = await Promise.race([
      wx.cloud.callFunction({ name: 'ping', data: { checkDatabase: true } }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('CLOUD_TIMEOUT')), env.timeoutMs); })
    ]);
    if (!response.result || response.result.ok !== true || response.result.database !== 'ok') {
      throw new Error('CLOUD_CHECK_FAILED');
    }
    return Object.assign({}, response.result, { mode: 'cloud' });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { initialize, check, getState: () => state };
