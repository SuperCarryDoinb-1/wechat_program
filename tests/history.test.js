const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { createHandler } = require('../cloudfunctions/getHistory/handler');
const { loadHistory } = require('../utils/history-service');
const { historyRecord } = require('../utils/history-record');
const types = require('../config/types');
const { calc } = require('../utils/scoring');
const fixtures = require('./m1-fixtures.json');
const settings = { mode: 'cloud', cloudEnvId: 'test', timeoutMs: 25 };
const makeRecord = (i, owner = 'alice') => ({ _id: `record-${i}`, _openid: owner,
  ...calc(fixtures.types.TEA), answers: fixtures.types.TEA, createdAt: new Date(1700000000000 + i * 1000),
  roast: types.TEA.roastFallback, tips: types.TEA.tipsFallback, source: 'mock' });

function database(records, openid = 'alice', broken = false) {
  const calls = {};
  return { calls, cloud: { getWXContext: () => ({ OPENID: openid }), database() {
    calls.database = true;
    return { collection(name) {
      assert.equal(name, 'results');
      const query = {
        where(value) { calls.where = value; return query; },
        orderBy(key, direction) { (calls.order || (calls.order = [])).push([key, direction]); return query; },
        limit(value) { calls.limit = value; return query; },
        field(value) { calls.fields = value; return query; },
        async get() {
          if (broken) throw Error('DB_UNAVAILABLE');
          return { data: records.filter(r => r._openid === calls.where._openid)
            .sort((a, b) => b.createdAt - a.createdAt || b._id.localeCompare(a._id)).slice(0, calls.limit) };
        }
      };
      return query;
    } };
  } } };
}

test('history: newest five belong only to the authenticated owner; client identity and limits are ignored', async () => {
  const db = database([...Array.from({ length: 8 }, (_, i) => makeRecord(i)), makeRecord(99, 'bob')]);
  const result = await createHandler(db.cloud)({ openid: 'bob', _openid: 'bob', limit: 100 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.records.map(r => r.id), ['record-7', 'record-6', 'record-5', 'record-4', 'record-3']);
  assert.deepEqual(db.calls.where, { _openid: 'alice' });
  assert.deepEqual(db.calls.order, [['createdAt', 'desc'], ['_id', 'desc']]);
  assert.equal(db.calls.limit, 5);
  for (const record of result.records) {
    assert.equal('_openid' in record, false);
    assert.equal('answers' in record, false);
    assert.equal(record.createdAt > 0, true);
    assert.equal(record.tips.length, 3);
  }
});

test('history: new users see an empty list; no identity and database errors are not reported as empty success', async () => {
  assert.deepEqual(await createHandler(database([makeRecord(1, 'bob')]).cloud)(), { ok: true, records: [] });
  const noIdentity = database([], '');
  assert.equal((await createHandler(noIdentity.cloud)()).error, 'UNAUTHENTICATED');
  assert.equal(noIdentity.calls.database, undefined);
  assert.equal((await createHandler(database([], 'alice', true).cloud)()).error, 'HISTORY_READ_FAILED');
});

test('history: malformed content uses safe type defaults; invalid records never enter the view', () => {
  const valid = { ...makeRecord(1), id: 'record-1', createdAt: 1700000001000 };
  const repaired = historyRecord({ ...valid, roast: '<invalid>', tips: [], source: 'unknown' });
  assert.equal(repaired.source, 'fallback');
  assert.equal(repaired.roast, types.TEA.roastFallback);
  assert.equal(historyRecord({ ...valid, code: '__proto__' }), null);
  assert.equal(historyRecord({ ...valid, createdAt: 0 }), null);
  assert.equal(historyRecord({ ...valid, scores: { rel: 99, att: 0, lead: 0 } }), null);
});

test('history: client returns five sorted records, deduplicates IDs and uses getHistory without identity input', async () => {
  const records = Array.from({ length: 8 }, (_, i) => historyRecord({ ...makeRecord(i), id: `record-${i}`, createdAt: 1700000000000 + i }));
  const platform = { cloud: { async callFunction(args) {
    assert.deepEqual(args, { name: 'getHistory', data: {} });
    return { result: { ok: true, records: [records[7], ...records] } };
  } } };
  assert.deepEqual((await loadHistory(platform, settings)).map(r => r.id), ['record-7', 'record-6', 'record-5', 'record-4', 'record-3']);
});

test('history: offline, unavailable functions, malformed responses and timeout remain retryable errors', async () => {
  for (const callFunction of [
    async () => { throw Error('OFFLINE'); },
    async () => ({ result: { ok: false, error: 'HISTORY_READ_FAILED' } }),
    async () => ({ result: { ok: true, records: [{}] } }),
    () => new Promise(() => {})
  ]) await assert.rejects(loadHistory({ cloud: { callFunction } }, settings));
  await assert.rejects(loadHistory({}, settings), /CLOUD_UNAVAILABLE/);
});

function screen(loader) {
  const filename = path.resolve(__dirname, '../utils/screens/history.js');
  const local = createRequire(filename);
  const context = { module: { exports: {} }, wx: {}, require: name => name === '../history-service' ? { loadHistory: loader } : local(name) };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context);
  const definition = context.module.exports;
  const changes = [], routes = [];
  const page = { ...definition, data: JSON.parse(JSON.stringify(definition.data)),
    setData(value) { changes.push(value); Object.assign(this.data, value); },
    _flow: { go: (...args) => routes.push(args) } };
  page.onLoad({ fromRid: 'friend-1' });
  return { page, changes, routes };
}

test('history: empty and failure states differ; retry loads details without changing the current result', async () => {
  let attempts = 0;
  const record = historyRecord({ ...makeRecord(1), id: 'record-1', createdAt: 1700000001000 });
  const { page, routes } = screen(async () => { if (++attempts === 1) throw Error('OFFLINE'); return [record]; });
  await page.refreshHistory();
  assert.equal(page.data.failed, true);
  await page.refreshHistory();
  assert.equal(page.data.failed, false);
  assert.equal(page.data.loading, false);
  assert.equal(page.data.records[0].type.name, types.TEA.name);
  assert.match(page.data.records[0].dateLabel, /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
  page.toggleHistory({ currentTarget: { dataset: { id: record.id } } });
  assert.equal(page.data.expandedId, record.id);
  page.toggleHistory({ currentTarget: { dataset: { id: record.id } } });
  assert.equal(page.data.expandedId, '');
  page.historyStart();
  assert.equal(routes[0][0], 'quiz');
  assert.equal(routes[0][1].fromRid, 'friend-1');
  const empty = screen(async () => []).page;
  await empty.refreshHistory();
  assert.equal(empty.data.failed, false);
  assert.equal(empty.data.records.length, 0);
});

test('history: duplicate requests are ignored and a late response cannot update an exited screen', async () => {
  let resolve, calls = 0;
  const { page, changes } = screen(() => { calls++; return new Promise(done => { resolve = done; }); });
  const request = page.refreshHistory();
  await page.refreshHistory();
  assert.equal(calls, 1);
  page.onUnload();
  const count = changes.length;
  resolve([]);
  await request;
  assert.equal(changes.length, count);
});
