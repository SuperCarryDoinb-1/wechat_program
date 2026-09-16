const config = require('../config/quiz');

// Submission must stop on storage failure; content caching is best effort.
function read(platform) {
  const record = platform.getStorageSync(config.resultStorageKey);
  return record && record.version === config.resultVersion ? record : null;
}

function write(platform, record) {
  platform.setStorageSync(config.resultStorageKey, record);
}

function saveContent(platform, record, content) {
  try {
    const latest = platform.getStorageSync(config.resultStorageKey);
    if (latest && latest.requestId === record.requestId) {
      write(platform, { ...latest, content });
    }
  } catch (_) { /* Cache failure must not prevent displaying this result. */ }
  return content;
}

module.exports = { read, write, saveContent };
