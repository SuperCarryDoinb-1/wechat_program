const { publicResult, validRid } = require('./public-result');
const { validateContent } = require('./content-validation');
const types = require('./types');

// Only the fields needed by the history view may cross the cloud boundary.
function historyRecord(value) {
  const result = publicResult(value);
  if (!result || !validRid(value.id) || !Number.isFinite(value.createdAt) || value.createdAt <= 0) return null;
  const type = types[result.code];
  const content = validateContent(value);
  const source = content && ['model', 'mock', 'fallback', 'offline'].includes(value.source) ? value.source : 'fallback';
  return {
    id: value.id, ...result, createdAt: value.createdAt,
    coords: { x: result.scores.rel / 24, y: result.scores.att / 24 },
    roast: content ? content.roast : type.roastFallback,
    tips: content ? content.tips : type.tipsFallback.slice(), source
  };
}
module.exports = { historyRecord };
