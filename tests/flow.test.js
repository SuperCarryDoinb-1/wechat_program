const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fixtures = require('./m1-fixtures.json');
const config = require('../config/quiz');
const copy = require('../config/copy');
const pet = require('../config/pet');
const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function harness(entry = 'index', options = {}) {
  let now = 1000, sequence = 0, definition, record = options.record;
  const timers = new Map(), modules = new Map(), commits = [], callbacks = [];
  const calls = { routes: [], scrolls: [], writes: 0, privacy: new Set(), exports: 0, saves: 0 };
  const platform = {
    getLaunchOptionsSync: () => ({ scene: options.scene || 1001 }),
    getStorageSync: () => record,
    setStorageSync(key, value) { if (options.storageFails) throw Error('STORAGE_FULL'); record = clone(value); calls.writes++; },
    showShareMenu() {}, showToast() {},
    onNeedPrivacyAuthorization: fn => calls.privacy.add(fn),
    offNeedPrivacyAuthorization: fn => calls.privacy.delete(fn),
    pageScrollTo: args => calls.scrolls.push(args),
    navigateTo: args => calls.routes.push(args.url),
    redirectTo: args => calls.routes.push(args.url),
    reLaunch: args => calls.routes.push(args.url)
  };
  const context = vm.createContext({ wx: platform, Page: value => { definition = value; },
    Date: { now: () => now },
    setTimeout(fn, delay) { const id = ++sequence; timers.set(id, { fn, due: now + delay }); return id; },
    clearTimeout: id => timers.delete(id)
  });
  function load(relative) {
    if (relative === 'utils/content-service.js' && options.contentService) return options.contentService;
    if (relative === 'utils/friend-service.js' && options.friendService) return options.friendService;
    if (relative === 'utils/poster.js') return {
      async exportPoster(_wx, controller) { assert.equal(controller._view, page); calls.exports++; return 'poster.png'; },
      async saveToAlbum() { calls.saves++; }
    };
    if (modules.has(relative)) return modules.get(relative).exports;
    const module = { exports: {} }; modules.set(relative, module);
    const local = request => {
      const file = path.resolve(root, path.dirname(relative), request + '.js');
      assert.ok(file.startsWith(root + path.sep));
      return load(path.relative(root, file).replace(/\\/g, '/'));
    };
    vm.runInContext('(function(require,module){\n' + fs.readFileSync(path.join(root, relative), 'utf8') + '\n})', context, { filename: relative })(local, module);
    return module.exports;
  }
  load(`pages/${entry}/${entry}.js`);
  const page = { ...definition, data: clone(definition.data), setData(update, done) {
    assert.ok(!this._flowDisposed, 'No view updates after page unload');
    commits.push(clone(update));
    for (const [key, value] of Object.entries(update)) {
      const parts = key.split('.'); let target = this.data;
      for (const part of parts.slice(0, -1)) target = target[part];
      target[parts.at(-1)] = clone(value);
    }
    if (done) callbacks.push(done);
  } };
  function mount() {
    for (let count = 0; callbacks.length; count++) {
      assert.ok(count < 100, 'View callback loop');
      callbacks.shift()();
    }
  }
  function tick(ms = config.transitionMs) {
    const end = now + ms;
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.due <= end).sort((a,b) => a[1].due - b[1].due)[0];
      if (!next) break;
      timers.delete(next[0]); now = next[1].due; next[1].fn(); mount();
    }
    now = end;
  }
  function choose(option) { page.selectOption({ currentTarget: { dataset: { option, questionId: page.data.screen.question.id } } }); }
  function complete() { fixtures.types.TEA.forEach(option => { choose(option); tick(); }); }
  page.onLoad(options.query || {}); page.onShow(); page.onReady();
  if (!options.deferMount) mount();
  return { page, calls, timers, callbacks, commits, mount, tick, choose, complete, get record() { return record; } };
}

test('flow: start, all answers, result, retry and home use one page with fresh state', async () => {
  const h = harness(), page = h.page;
  assert.equal(page.data.stage, 'index');
  page.openQuiz(); h.mount();
  const quiz = page._screen;
  assert.equal(page.data.stage, 'quiz');
  assert.equal(page.data.screen.number, 1);
  assert.equal(page.data.screen.petImage, pet.image);
  assert.equal(page.onShareAppMessage().path, '/pages/index/index?invite=1');
  page.tapPet(); assert.notEqual(page.data.screen.petMood, 'idle');
  h.complete(); await flush(); h.mount();
  assert.equal(page.data.stage, 'result');
  assert.ok(page.data.screen.result.code);
  assert.equal(page.data.screen.contentLoading, false);
  assert.deepEqual(h.record.answers, fixtures.types.TEA);
  assert.equal(quiz._disposed, true);
  assert.equal(quiz._pet._alive, false);
  assert.equal(h.timers.size, 0);
  assert.equal(h.calls.privacy.size, 1);
  const saving = page.savePoster(); h.mount(); await saving;
  assert.equal(h.calls.exports, 1); assert.equal(h.calls.saves, 1);
  page.restart(); h.mount();
  assert.equal(h.calls.privacy.size, 0);
  assert.equal(page.data.stage, 'quiz');
  assert.equal(page.data.screen.number, 1);
  assert.equal(page.data.screen.answered, 0);
  assert.equal(page.data.screen.submitting, false);
  assert.equal(page.data.screen.petMood, 'idle');
  page.backToStart(); h.mount();
  assert.equal(page.data.stage, 'index');
  assert.deepEqual(h.calls.routes, []);
  page.onUnload();
});

test('flow: direct quiz and result routes retain compatibility without extra navigation', async () => {
  const quiz = harness('quiz'); quiz.complete(); await flush(); quiz.mount();
  assert.equal(quiz.page.data.stage, 'result');
  const result = harness('result', { record: quiz.record });
  assert.equal(result.page.data.stage, 'result');
  assert.ok(result.page.data.screen.result);
  result.page.restart(); result.mount();
  assert.equal(result.page.data.stage, 'quiz');
  assert.deepEqual(result.calls.routes, []);
  quiz.page.onUnload(); result.page.onUnload();
});

test('flow: hidden quiz pauses pending answer; old callbacks cannot revive a departed screen', () => {
  const h = harness('quiz'), page = h.page;
  h.choose(0); page.onHide(); h.tick(1000);
  assert.equal(page.data.screen.number, 1);
  page.onShow(); h.tick();
  assert.equal(page.data.screen.number, 2);
  h.choose(2);
  const old = page._screen, timerCallbacks = [...h.timers.values()].map(timer => timer.fn);
  page.backToStart(); h.mount();
  const snapshot = clone(page.data);
  timerCallbacks.forEach(fn => fn()); old.setData({ petMood: 'jump', index: 9 });
  assert.deepEqual(page.data, snapshot);
  assert.equal(h.timers.size, 0);
  page.onUnload(); h.tick(5000);
});

test('flow: content resolving before view mount is not lost; late results cannot overwrite home', async () => {
  for (const beforeMount of [true, false]) {
    let resolve;
    const record = { version: 1, answers: fixtures.types.TEA, requestId: 'test' };
    const h = harness('result', { record, deferMount: true,
      contentService: { load: () => new Promise(done => { resolve = done; }) } });
    if (!beforeMount) { h.mount(); h.page.backToStart(); h.mount(); }
    resolve({ code: 'TEA', source: 'mock', roast: 'Test', tips: ['a', 'b', 'c'] });
    await flush(); h.mount();
    if (beforeMount) { assert.equal(h.page.data.screen.contentLoading, false); assert.equal(h.page.data.screen.content.roast, 'Test'); }
    else { assert.equal(h.page.data.stage, 'index'); assert.equal(h.page.data.screen.content, undefined); }
    h.page.onUnload();
  }
});

test('flow: share invitations never expose cached results and friend ID survives restart', async () => {
  for (const entry of ['index', 'quiz', 'result']) {
    const h = harness(entry, { query: { rid: 'friend-123' }, record: { version: 1, answers: fixtures.types.TEA },
      friendService: { loadFriend: async () => null } });
    assert.equal(h.page.data.stage, 'index');
    assert.equal(h.page.data.screen.result, undefined);
    h.page.openQuiz(); h.mount(); h.complete(); await flush(); h.mount();
    assert.equal(h.record.fromRid, 'friend-123');
    h.page.restart(); h.mount(); assert.equal(h.page._screen._fromRid, 'friend-123');
    h.page.backToStart(); h.mount(); assert.equal(h.page._screen._fromRid, 'friend-123');
    assert.deepEqual(h.calls.routes, []); h.page.onUnload();
  }
  const single = harness('result', { scene: 1154, query: { invite: '1' } });
  assert.equal(single.page.data.screen.singlePage, true);
  assert.deepEqual(single.calls.routes, []); single.page.onUnload();
});

test('flow: result sharing uses active result even when the native route remains index', async () => {
  const h = harness('index', { contentService: { load: async record => ({ code: record.code,
    rid: 'result-123', persisted: true, source: 'model', roast: 'Test', tips: ['a','b','c'] }) } });
  h.page.openQuiz(); h.mount(); h.complete(); await flush(); h.mount();
  assert.equal(h.page.onShareAppMessage().path, '/pages/index/index?rid=result-123');
  assert.equal(h.page.onShareTimeline().query, 'rid=result-123');
  h.page.backToStart(); h.mount();
  assert.equal(h.page.onShareAppMessage().path, '/pages/index/index?invite=1');
  h.page.onUnload();
});

test('flow: failed storage stays on final question and retry enters result once', async () => {
  const options = { storageFails: true }, h = harness('quiz', options);
  h.complete();
  assert.equal(h.page.data.stage, 'quiz');
  assert.equal(h.page.data.screen.submitError, copy.quiz.saveFailed);
  options.storageFails = false;
  h.page.retryFinish(); h.mount(); await flush();
  assert.equal(h.page.data.stage, 'result');
  assert.deepEqual(h.calls.routes, []);
  h.page.onUnload();
});

test('flow: scroll resets at screen boundaries and unload rejects pending mount activation', () => {
  const h = harness(); h.page.onPageScroll({ scrollTop: 180 }); h.page.openQuiz();
  assert.equal(h.calls.scrolls.length, 1);
  h.page.onUnload(); h.mount();
  assert.equal(h.timers.size, 0);
  assert.equal(h.page._screen, null);
});
