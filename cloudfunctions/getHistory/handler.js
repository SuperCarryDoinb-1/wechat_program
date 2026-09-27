const { historyRecord } = require('./history-record');
const { limit } = require('./history');

function createHandler(cloud) {
  return async function main() {
    // Never accept an openid or a result owner supplied by the client.
    const identity = cloud.getWXContext();
    if (!identity || !identity.OPENID) return { ok: false, error: 'UNAUTHENTICATED' };
    try {
      const response = await cloud.database().collection('results')
        .where({ _openid: identity.OPENID })
        .orderBy('createdAt', 'desc').orderBy('_id', 'desc').limit(limit)
        .field({ _id: true, code: true, scores: true, createdAt: true, roast: true, tips: true, source: true })
        .get();
      const records = response.data.map(record => historyRecord({ ...record, id: record._id,
        createdAt: record.createdAt instanceof Date ? record.createdAt.getTime() : record.createdAt
      })).filter(Boolean).slice(0, limit);
      return { ok: true, records };
    } catch (_) { return { ok: false, error: 'HISTORY_READ_FAILED' }; }
  };
}
module.exports = { createHandler };
