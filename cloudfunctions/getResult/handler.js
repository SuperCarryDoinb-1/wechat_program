const { validRid, publicResult } = require('./shared/utils/public-result');
function createHandler(cloud) {
  return async function main(event) {
    if (!event || !validRid(event.rid)) return null;
    try {
      const record = await cloud.database().collection('results').doc(event.rid).get();
      // 通过白名单重新构造，绝不直接返回数据库对象。
      return publicResult(record.data);
    } catch (_) { return null; }
  };
}
module.exports = { createHandler };
