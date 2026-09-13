const { calc } = require('./shared/utils/scoring');
const types = require('./shared/config/types');
const questions = require('./shared/config/questions');
const { parseContent } = require('./shared/utils/content-validation');
const { validRid, publicResult } = require('./shared/utils/public-result');
const prompt = require('./config/prompt');

function bounded(work, ms) {
  let timer;
  return Promise.race([Promise.resolve().then(work), new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('MODEL_TIMEOUT')), ms);
  })]).finally(() => clearTimeout(timer));
}

function createHandler(cloud, provider, options = {}) {
  return async function main(event) {
    let result;
    try {
      result = calc(event && event.answers);
      if (event.code !== result.code) throw new Error('TYPE_MISMATCH');
    } catch (_) { return { ok: false, error: 'INVALID_INPUT' }; }
    const identity = cloud.getWXContext();
    if (!identity || !identity.OPENID) return { ok: false, error: 'UNAUTHENTICATED' };
    const type = types[result.code];
    const fallback = { roast: type.roastFallback, tips: type.tipsFallback.slice() };
    const fromRid = validRid(event.fromRid) ? event.fromRid : '';
    const db = cloud.database();
    const collection = db.collection('results');
    let rid;
    try {
      // 先存安全兜底，模型慢或失败也有独立结果记录。
      const saved = await collection.add({ data: {
        _openid: identity.OPENID, code: result.code, scores: result.scores,
        answers: event.answers.slice(), ...fallback, source: 'fallback', fromRid, createdAt: db.serverDate()
      } });
      rid = saved._id;
      if (!validRid(rid)) throw new Error('INVALID_RESULT_ID');
    } catch (_) { return { ok: false, error: 'DATABASE_WRITE_FAILED' }; }
    let content = fallback;
    let source = provider.mode === 'mock' ? 'mock' : 'fallback';
    if (provider.mode !== 'mock') {
      const answersText = event.answers.map((answer, i) => `${questions[i].title} ${questions[i].options[answer].text}`).join('\n');
      const messages = [
        { role: 'system', content: prompt.system },
        { role: 'user', content: `${prompt.typeLabel}${type.name} (${result.code})\n${prompt.personaLabel}${type.persona}\n${prompt.answersLabel}\n${answersText}` }
      ];
      // 最多两次尝试，每次最多 2.8 秒，给前端 8 秒截止预留时间。
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const text = await bounded(() => provider.generate(messages), options.attemptTimeoutMs || 2800);
          const parsed = parseContent(text);
          if (parsed) { content = parsed; source = 'model'; break; }
        } catch (_) { /* 失败后再试一次，仍失败就使用安全兜底。 */ }
      }
    }
    try {
      await collection.doc(rid).update({ data: { ...content, source } });
    } catch (_) {
      // 更新失败时保持返回内容与已经写入的兜底记录一致。
      content = fallback; source = 'fallback';
    }
    let pairCode;
    if (fromRid) {
      try {
        const friend = publicResult((await collection.doc(fromRid).get()).data);
        if (friend) pairCode = friend.code;
      } catch (_) { /* 失效邀请不影响本人的结果。 */ }
    }
    return { ok: true, rid, ...content, source, ...(pairCode ? { pairCode } : {}) };
  };
}
module.exports = { createHandler };
