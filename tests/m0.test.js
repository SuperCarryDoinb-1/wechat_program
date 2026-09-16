const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const { createHandler } = require('../cloudfunctions/ping/handler');

test('三个路由入口注册同一流程容器，所有视图事件存在', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  assert.equal(app.pages.length, 3);
  const calls = [];
  global.wx = {
    navigateTo: args => calls.push(args.url),
    redirectTo: args => calls.push(args.url),
    reLaunch: args => calls.push(args.url)
  };
  for (const route of app.pages) {
    for (const ext of ['js', 'json', 'wxml', 'wxss']) assert.ok(fs.existsSync(path.join(root, `${route}.${ext}`)));
    JSON.parse(fs.readFileSync(path.join(root, `${route}.json`), 'utf8'));
    let page;
    global.Page = definition => { page = definition; };
    require(path.join(root, `${route}.js`));
    const wxml = [`${route}.wxml`, 'utils/flow-view.wxml', ...app.pages.map(page => `${page}-view.wxml`)]
      .map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
    for (const match of wxml.matchAll(/bindtap="(\w+)"/g)) assert.equal(typeof page[match[1]], 'function');
    assert.equal(typeof page.changeScreen, 'function');
  }
  assert.deepEqual(calls, []);
  delete global.Page;
  delete global.wx;
});

function client(env, wx) {
  const context = { module: { exports: {} }, require: () => env, wx, setTimeout, clearTimeout };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'utils/cloud.js'), 'utf8'), context);
  return context.module.exports;
}

test('默认模拟模式可独立检查，且不调用云端', async () => {
  const api = client({ mode: 'mock' }, undefined);
  assert.equal(api.initialize().mode, 'mock');
  assert.equal((await api.check()).database, 'ok');
  assert.equal((await api.check()).mode, 'mock');
});

test('云环境缺失、SDK 缺失、初始化异常均不会伪报成功', async () => {
  for (const wx of [undefined, {}, { cloud: { init() { throw new Error('init'); } } }]) {
    const api = client({ mode: 'cloud', cloudEnvId: 'test-env' }, wx);
    assert.equal(api.initialize().ready, false);
    await assert.rejects(api.check(), /CLOUD_UNAVAILABLE/);
  }
  assert.equal(client({ mode: 'cloud', cloudEnvId: '' }, {}).initialize().ready, false);
});

test('云调用成功、失败响应、拒绝和超时', async () => {
  let config;
  const env = { mode: 'cloud', cloudEnvId: 'test-env', timeoutMs: 15 };
  const api = client(env, { cloud: {
    init(value) { config = value; },
    async callFunction(args) { assert.equal(args.name, 'ping'); return { result: { ok: true, database: 'ok' } }; }
  } });
  api.initialize();
  assert.equal(config.env, env.cloudEnvId);
  assert.equal(config.traceUser, false);
  assert.equal((await api.check()).mode, 'cloud');
  for (const callFunction of [
    async () => ({ result: { ok: false } }),
    async () => { throw new Error('network'); },
    () => new Promise(() => {})
  ]) {
    const broken = client(env, { cloud: { init() {}, callFunction } });
    broken.initialize();
    await assert.rejects(broken.check());
  }
});

test('ping 本地处理器返回 ok；未开启诊断时禁止数据库操作', async () => {
  const ping = createHandler({ database() { throw new Error('不应访问数据库'); } }, {});
  assert.equal((await ping()).message, 'ok');
  assert.equal((await ping({ checkDatabase: true })).message, 'DIAGNOSTICS_DISABLED');
});

test('results 写入读回契约、重复检查不累积、失败不误报', async () => {
  const records = new Map();
  const database = {
    serverDate: () => 123,
    collection(name) {
      assert.equal(name, 'results');
      return { doc(id) { return {
        async set({ data }) { records.set(id, data); },
        async get() { return { data: records.get(id) }; }
      }; } };
    }
  };
  const ping = createHandler({ database: () => database }, { ENABLE_M0_DIAGNOSTICS: 'true' });
  assert.equal((await ping({ checkDatabase: true })).database, 'ok');
  await ping({ checkDatabase: true });
  assert.equal(records.size, 1);
  assert.equal(records.get('m0-healthcheck').kind, 'm0-healthcheck');
  const broken = createHandler({ database() { throw new Error('offline'); } }, { ENABLE_M0_DIAGNOSTICS: 'true' });
  assert.equal((await broken({ checkDatabase: true })).ok, false);
  database.collection = () => ({ doc: () => ({ set: async () => {}, get: async () => ({ data: {} }) }) });
  assert.equal((await ping({ checkDatabase: true })).message, 'READBACK_FAILED');
});

test('项目配置与资源占位完整，数据库禁止客户端直接读写', () => {
  const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
  assert.equal(project.cloudfunctionRoot, 'cloudfunctions/');
  const assets = require('../config/assets');
  assert.equal(assets.questions.length, 12);
  assert.equal(Object.keys(assets.types).length, 8);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'cloudfunctions/database.rules.json'), 'utf8')), { read: false, write: false });
});
