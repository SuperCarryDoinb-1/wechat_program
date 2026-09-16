const test = require('node:test');
const assert = require('node:assert/strict');
const createFlowRuntime = require('../utils/flow-runtime');

test('流程内核支持独立注册和移除视图，隔离状态并释放旧视图', () => {
  const calls = [];
  const home = { data: {}, onLoad() {}, onShow() {} };
  const feature = {
    data: { count: 0 },
    onLoad(options) { calls.push(['load', options.id]); },
    onShow() { calls.push('show'); },
    onReady() { calls.push('ready'); },
    onHide() { calls.push('hide'); },
    onUnload() { calls.push('unload'); },
    increment() { this.setData({ count: this.data.count + 1 }); }
  };
  const flow = {
    home: 'home', screens: { home, extra: feature },
    resolveEntry: initial => initial,
    prepareTransition: (_stage, options) => options,
    share: timeline => ({ title: timeline ? 'timeline' : 'friend' })
  };
  const definition = createFlowRuntime(flow, 'home', () => ({ pageScrollTo() {} }));
  const page = { ...definition, data: JSON.parse(JSON.stringify(definition.data)), setData(update, done) {
    for (const [key, value] of Object.entries(update)) {
      if (key.startsWith('screen.')) this.data.screen[key.slice(7)] = value;
      else this.data[key] = value;
    }
    if (done) done();
  } };
  page.onLoad(); page.onShow(); page.onReady();
  page.changeScreen('extra', { id: 42 });
  assert.deepEqual(calls, [['load', 42], 'show', 'ready']);
  page.increment();
  assert.equal(page.data.screen.count, 1);
  assert.equal(feature.data.count, 0, '视图定义不持有运行期状态');
  const old = page._screen;
  page.backToStart();
  assert.deepEqual(calls.slice(-2), ['hide', 'unload']);
  old.setData({ count: 99 }); old._flow.go('extra'); page.increment();
  assert.equal(page.data.stage, 'home');
  assert.equal(page.data.screen.count, undefined);
  assert.deepEqual(page.onShareAppMessage(), { title: 'friend' });
  assert.deepEqual(page.onShareTimeline(), { title: 'timeline' });
  page.changeScreen('extra');
  assert.equal(page.data.screen.count, 0, '再次进入重建状态');
  page.onUnload();
  assert.equal(page._screen, null);
  assert.deepEqual(calls.slice(-2), ['hide', 'unload']);

  const withoutFeature = createFlowRuntime({ ...flow, screens: { home } }, 'home', () => ({}));
  assert.equal(withoutFeature.increment, undefined, '移除注册后不会遗留事件代理');
});
