const env = require('../config/env');
const limits = require('../config/content');
const quizConfig = require('../config/quiz');
const types = require('../config/types');
const { validateContent } = require('./content-validation');
const { validRid } = require('./public-result');

function createContentService(platform, settings = env, timers = { setTimeout, clearTimeout }) {
  let current = null;
  const fallback = (record, source) => ({ code: record.code, rid: '', persisted: false, source,
    roast: types[record.code].roastFallback, tips: types[record.code].tipsFallback.slice() });
  function save(record, content) {
    try {
      const latest = platform.getStorageSync(quizConfig.resultStorageKey);
      if (latest && latest.requestId === record.requestId) {
        platform.setStorageSync(quizConfig.resultStorageKey, { ...latest, content });
      }
    } catch (_) { /* 本地缓存写入失败不影响本次展示。 */ }
    return content;
  }
  function checked(value, record) {
    const content = validateContent(value);
    if (!content || !['model', 'mock', 'fallback', 'offline'].includes(value.source)) return null;
    return { code: record.code, ...content, source: value.source,
      rid: validRid(value.rid) ? value.rid : '', persisted: validRid(value.rid) && value.persisted === true,
      ...(Object.prototype.hasOwnProperty.call(types, value.pairCode) ? { pairCode: value.pairCode } : {}) };
  }
  function start(record) {
    if (current && current.id === record.requestId) {
      // 跳转失败后重试可能重新写入基础记录，补回已完成的内容缓存。
      if (current.content) save(record, current.content);
      return current.promise;
    }
    const job = { id: record.requestId };
    job.promise = (async () => {
      if (settings.mode === 'mock') return save(record, fallback(record, 'mock'));
      let timer;
      try {
        if (!settings.cloudEnvId || !platform.cloud) throw new Error('CLOUD_UNAVAILABLE');
        const response = await Promise.race([
          Promise.resolve().then(() => platform.cloud.callFunction({ name: 'genContent', data: {
            code: record.code, answers: record.answers,
            fromRid: validRid(record.fromRid) ? record.fromRid : ''
          } })),
          new Promise((_, reject) => { timer = timers.setTimeout(() => reject(new Error('CLOUD_TIMEOUT')), limits.timeoutMs); })
        ]);
        const value = response && response.result;
        if (!value || value.ok !== true || !validRid(value.rid)) throw new Error('CLOUD_RESULT_INVALID');
        const content = checked({ ...value, persisted: true }, record);
        if (!content) throw new Error('CONTENT_INVALID');
        return save(record, content);
      } catch (_) {
        return save(record, fallback(record, 'offline'));
      } finally { if (timer !== undefined) timers.clearTimeout(timer); }
    })();
    current = job;
    job.promise.then(content => { job.content = content; }, () => {});
    return job.promise;
  }
  function load(record) {
    if (record.content && record.content.code === record.code) {
      const cached = checked(record.content, record);
      if (cached) return Promise.resolve(cached);
    }
    return start(record);
  }
  return { start, load };
}
let service;
function runtime() {
  if (!service) service = createContentService(wx);
  return service;
}
module.exports = { createContentService, start: record => runtime().start(record), load: record => runtime().load(record) };
