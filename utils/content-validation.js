const limits = require('../config/content');
const blocklist = require('../config/blocklist');

function validateContent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const clean = (text, limit) => {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed || Array.from(trimmed).length > limit) return null;
    const normalized = trimmed.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();
    if (blocklist.some(word => normalized.includes(word.toLowerCase()))) return null;
    return trimmed;
  };
  const roast = clean(value.roast, limits.maxRoastLength);
  if (!roast || roast.startsWith('你是') || !Array.isArray(value.tips) || value.tips.length !== 3) return null;
  const tips = Array.from(value.tips, text => clean(text, limits.maxTipLength));
  return tips.every(Boolean) ? { roast, tips } : null;
}

function parseContent(text) {
  if (typeof text !== 'string' || text.length > limits.maxPayloadLength) return null;
  try { return validateContent(JSON.parse(text)); } catch (_) { return null; }
}
module.exports = { validateContent, parseContent };
