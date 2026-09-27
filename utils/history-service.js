const env = require('../config/env');
const history = require('../config/history');
const { historyRecord } = require('./history-record');

async function loadHistory(platform, settings = env) {
  if (settings.mode !== 'cloud' || !settings.cloudEnvId || !platform.cloud) throw Error('CLOUD_UNAVAILABLE');
  let timer;
  try {
    const response = await Promise.race([
      Promise.resolve().then(() => platform.cloud.callFunction({ name: 'getHistory', data: {} })),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('HISTORY_TIMEOUT')), settings.timeoutMs || 8000); })
    ]);
    const result = response && response.result;
    if (!result || result.ok !== true || !Array.isArray(result.records)) {
      throw Error(result && ['UNAUTHENTICATED', 'HISTORY_READ_FAILED'].includes(result.error) ? result.error : 'HISTORY_UNAVAILABLE');
    }
    const records = result.records.map(historyRecord);
    if (records.some(record => !record)) throw Error('HISTORY_INVALID');
    const seen = new Set();
    return records.sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
      .filter(record => { if (seen.has(record.id)) return false; seen.add(record.id); return true; })
      .slice(0, history.limit);
  } finally { clearTimeout(timer); }
}
module.exports = { loadHistory };
