const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const questions = require('../config/questions');
const quizConfig = require('../config/quiz');
const assets = require('../config/assets');
const copy = require('../config/copy');
const { calc } = require('../utils/scoring');
const fixtures = require('./m1-fixtures.json');
const snapshot = value => JSON.parse(JSON.stringify(value));

function harness(file = 'pages/quiz/quiz.js', options = {}) {
  let definition, sequence = 0;
  const timers = new Map(), storage = new Map();
  const calls = { redirect: [], navigate: [], scroll: [], writes: [], toasts: [] };
  const state = { saveFails: false, redirectFails: false, navigateFails: false };
  const wx = {
    setStorageSync(key, value) {
      if (state.saveFails) throw new Error('STORAGE_FULL');
      calls.writes.push(key); storage.set(key, snapshot(value));
    },
    redirectTo(args) { calls.redirect.push(args.url); if (state.redirectFails) args.fail(); },
    navigateTo(args) { calls.navigate.push(args.url); if (state.navigateFails) args.fail(); },
    pageScrollTo(args) { calls.scroll.push(args); },
    showToast(args) { calls.toasts.push(args); }
  };
  const filename = path.join(__dirname, '..', file);
  const localRequire = createRequire(filename);
  const context = {
    Page(value) { definition = value; }, wx,
    require(name) {
      if (name === '../../utils/content-service') return { start: () => Promise.resolve() };
      if (name === '../../utils/navigation') return {
        quiz(onFail) { wx.navigateTo({ url: '/pages/quiz/quiz', fail: () => { onFail(); } }); }
      };
      return localRequire(name);
    },
    setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  const page = Object.assign({}, definition, {
    data: snapshot(definition.data),
    setData(update) { assert.ok(!this._disposed, '卸载后不应更新页面'); Object.assign(this.data, snapshot(update)); }
  });
  if (page.onLoad) page.onLoad();
  if (!options.hidden && page.onShow) page.onShow();
  function tick() {
    const queued = [...timers.values()]; timers.clear();
    queued.forEach(item => { assert.equal(item.delay, 200); item.callback(); });
  }
  function choose(option, questionId = page.data.question.id) {
    page.selectOption({ currentTarget: { dataset: { option, questionId } } });
  }
  function next(questionId = page.data.question.id) {
    page.nextQuestion({ currentTarget: { dataset: { questionId } } });
  }
  function advance() { next(); tick(); }
  function complete(answers = fixtures.types.TEM) { answers.forEach(answer => { choose(answer); tick(); }); }
  return { page, calls, state, storage, timers, tick, choose, next, advance, complete, wx };
}

test('M2：12 题选择后高亮，200ms 自动切题，最终结果完整存储后跳转', () => {
  const h = harness();
  const answers = fixtures.types.TEM;
  let previousSceneColor = '';
  questions.forEach((q, i) => {
    assert.equal(h.page.data.number, i + 1);
    assert.equal(h.page.data.question.title, q.title);
    assert.deepEqual(h.page.data.question.options, q.options.map(o => ({ label: o.label, text: o.text })));
    assert.equal(h.page.data.selected, -1);
    assert.equal(h.page.data.scene.caption, quizConfig.scenes[i].caption);
    assert.ok(quizConfig.sceneColors.includes(h.page.data.sceneColor));
    assert.notEqual(h.page.data.sceneColor, previousSceneColor);
    previousSceneColor = h.page.data.sceneColor;
    h.choose(answers[i]);
    assert.equal(h.page.data.selected, answers[i]);
    assert.equal(h.page.data.index, i);
    assert.equal(h.page.data.answered, i + 1);
    assert.equal(h.calls.redirect.length, 0);
    assert.equal(h.page.data.transitioning, true);
    assert.equal(h.timers.size, 1);
    assert.equal(h.calls.writes.length, 0);
    h.tick();
  });
  const record = h.storage.get(quizConfig.resultStorageKey);
  assert.deepEqual(record.answers, answers);
  const result = calc(answers);
  Object.keys(result).forEach(key => assert.deepEqual(record[key], result[key]));
  assert.equal(record.version, 1);
  assert.ok(Number.isFinite(record.createdAt));
  assert.equal(h.page.data.progress, 100);
  assert.deepEqual(h.calls.writes, [quizConfig.resultStorageKey]);
  assert.deepEqual(h.calls.redirect, ['/pages/result/result']);
});

test('M2：未选择不能继续，重复选项、下一题及旧题事件不会跳题', () => {
  const h = harness();
  ['', null, undefined, -1, 4, 0.5, 'oops'].forEach(value => h.choose(value));
  assert.equal(h.page.data.selected, -1);
  h.advance();
  assert.equal(h.page.data.index, 0);
  h.choose(1);
  h.choose(3);
  assert.equal(h.page.data.selected, 1);
  assert.equal(h.timers.size, 1);
  h.next(); h.next(); h.choose(0);
  assert.equal(h.page.data.selected, 1);
  assert.equal(h.timers.size, 1);
  h.tick();
  h.choose(2, 1);
  h.next(1);
  assert.equal(h.page.data.index, 1);
  assert.equal(h.page.data.selected, -1);
  assert.equal(h.timers.size, 0);
});

test('M2：返回保留选择，修改后按新答案计分，不重复累加', () => {
  const h = harness();
  h.choose(0); h.advance();
  h.choose(1); h.advance();
  h.page.previousQuestion();
  assert.equal(h.page.data.index, 1);
  assert.equal(h.page.data.selected, 1);
  h.page.previousQuestion();
  assert.equal(h.page.data.selected, 0);
  h.page.previousQuestion();
  assert.equal(h.page.data.index, 0);
  const revised = [2, 3, ...fixtures.types.TEM.slice(2)];
  h.complete(revised);
  assert.deepEqual(h.storage.get(quizConfig.resultStorageKey).answers, revised);
  assert.deepEqual(h.storage.get(quizConfig.resultStorageKey).scores, calc(revised).scores);
});

test('M2：切题期间返回可取消待执行切题', () => {
  const h = harness();
  h.choose(0); h.advance(); h.choose(1); h.next();
  h.page.previousQuestion();
  h.tick();
  assert.equal(h.page.data.index, 0);
  assert.equal(h.page.data.selected, 0);
  h.advance();
  assert.equal(h.page.data.index, 1);
  assert.equal(h.page.data.selected, 1);
});

test('M2：中途退出取消任务；新进入从第一题开始，不保存草稿', () => {
  const h = harness();
  h.choose(0); h.advance(); h.choose(1); h.next();
  h.page.onUnload(); h.tick();
  assert.equal(h.calls.writes.length, 0);
  assert.equal(h.calls.redirect.length, 0);
  const fresh = harness();
  assert.equal(fresh.page.data.index, 0);
  assert.equal(fresh.page.data.answered, 0);
  assert.equal(fresh.page.data.selected, -1);
});

test('M2：切后台暂停计时，回前台继续一次，不在后台提交', () => {
  const h = harness();
  fixtures.types.TEM.slice(0, 11).forEach(answer => { h.choose(answer); h.advance(); });
  h.choose(fixtures.types.TEM[11]);
  h.page.onHide(); h.tick();
  assert.equal(h.calls.writes.length, 0);
  h.page.onShow(); h.page.onShow();
  assert.equal(h.timers.size, 1);
  h.tick();
  assert.equal(h.calls.writes.length, 1);
  assert.equal(h.calls.redirect.length, 1);
  h.page.onUnload(); h.tick();
});

test('M2：保存失败保留答案、可重试，失败时不跳结果页', () => {
  const h = harness(); h.state.saveFails = true; h.complete();
  assert.equal(h.page.data.submitError, copy.quiz.saveFailed);
  assert.equal(h.page.data.submitting, false);
  assert.equal(h.calls.redirect.length, 0);
  assert.equal(h.storage.size, 0);
  h.state.saveFails = false;
  h.page.retryFinish(); h.page.retryFinish();
  assert.equal(h.calls.writes.length, 1);
  assert.equal(h.calls.redirect.length, 1);
});

test('M2：跳转失败可重试，只覆盖当前结果，不积累历史', () => {
  const h = harness(); h.state.redirectFails = true; h.complete();
  assert.equal(h.page.data.submitError, copy.quiz.navigationFailed);
  assert.equal(h.storage.size, 1);
  h.state.redirectFails = false; h.page.retryFinish();
  assert.equal(h.calls.redirect.length, 2);
  assert.equal(h.storage.size, 1);
  h.page.retryFinish();
  assert.equal(h.calls.redirect.length, 2);
});

test('M2：无图/图片加载失败使用对应占位，旧图片错误不影响新题', () => {
  const previous = assets.questions[0];
  try {
    assets.questions[0] = '/assets/not-present.png';
    const h = harness();
    assert.equal(h.page.data.image, '/assets/not-present.png');
    h.page.imageFailed({ currentTarget: { dataset: { questionId: 1 } } });
    assert.equal(h.page.data.image, '');
    h.choose(0); h.advance();
    h.page.imageFailed({ currentTarget: { dataset: { questionId: 1 } } });
    assert.equal(h.page.data.question.id, 2);
    h.page.previousQuestion();
    assert.equal(h.page.data.image, '');
  } finally { assets.questions[0] = previous; }
});

test('M2：首页开始按钮防重复，失败或返回后能再次开始', () => {
  const h = harness('pages/index/index.js');
  h.page.openQuiz(); h.page.openQuiz();
  assert.equal(h.calls.navigate.length, 1);
  h.page.onShow(); h.state.navigateFails = true;
  h.page.openQuiz();
  h.state.navigateFails = false; h.page.openQuiz();
  assert.equal(h.calls.navigate.length, 3);
});

test('M2：布局采用自然滚动，四选项无固定遮挡；小屏真机仍需人工验收', () => {
  const base = fs.readFileSync(path.join(__dirname, '../app.wxss'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../pages/quiz/quiz.wxss'), 'utf8');
  assert.ok(!/position\s*:\s*fixed/.test(base + css));
  assert.ok(!/disableScroll/.test(fs.readFileSync(path.join(__dirname, '../pages/quiz/quiz.json'), 'utf8')));
  const optionRule = css.match(/\.option\s*\{([^}]+)\}/)[1];
  assert.ok(Number(optionRule.match(/min-height:\s*(\d+)px/)[1]) >= 48);
  assert.ok(css.includes('max-width: 340px'));
  assert.ok(css.includes('safe-area-inset-bottom'));
  assert.equal(quizConfig.scenes.length, 12);
});
