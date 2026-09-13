const types = require('../config/types');
function validRid(rid) { return typeof rid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(rid); }
function publicResult(value) {
  if (!value || !Object.prototype.hasOwnProperty.call(types, value.code)) return null;
  const scores = {};
  for (const axis of ['rel', 'att', 'lead']) {
    const n = value.scores && value.scores[axis];
    if (!Number.isInteger(n) || Math.abs(n) > 24) return null;
    scores[axis] = n;
  }
  return { code: value.code, scores };
}
module.exports = { validRid, publicResult };
