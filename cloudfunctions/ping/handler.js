// 与 SDK 分离，便于在不安装依赖、不访问云端时验证逻辑。
function createHandler(cloud, env) {
  return async function main(event = {}) {
    if (!event.checkDatabase) return { ok: true, message: 'ok', database: 'unchecked' };
    // 仅在测试环境显式开启，防止上线后被反复调用写数据库。
    if (env.ENABLE_M0_DIAGNOSTICS !== 'true') {
      return { ok: false, message: 'DIAGNOSTICS_DISABLED', database: 'unchecked' };
    }
    try {
      const db = cloud.database();
      const doc = db.collection('results').doc('m0-healthcheck');
      // 固定 ID，重复检查不累积记录；不存放身份、答案等用户数据。
      await doc.set({ data: { kind: 'm0-healthcheck', ok: true, createdAt: db.serverDate() } });
      const read = await doc.get();
      if (!read.data || read.data.kind !== 'm0-healthcheck' || read.data.ok !== true) {
        return { ok: false, message: 'READBACK_FAILED', database: 'failed' };
      }
      return { ok: true, message: 'ok', database: 'ok' };
    } catch (_) {
      return { ok: false, message: 'DATABASE_CHECK_FAILED', database: 'failed' };
    }
  };
}
module.exports = { createHandler };
