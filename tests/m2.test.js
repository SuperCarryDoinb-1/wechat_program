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

function harness(file = 'utils/screens/quiz.js', options = {}) {
  let definition, sequence = 0, now = 1000;
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
    module: { set exports(value) { definition = value; } }, wx,
    require(name) {
      if (name === '../../utils/content-service') return { start: () => Promise.resolve() };
      if (name === '../../utils/navigation') return {
        quiz(onFail) { wx.navigateTo({ url: '/pages/quiz/quiz', fail: () => { onFail(); } }); }
      };
      return localRequire(name);
    },
    Date: { now: () => now },
    setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, delay, due: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  const page = Object.assign({}, definition, {
    data: snapshot(definition.data),
    setData(update, done) { assert.ok(!this._disposed, '卸载后不应更新页面'); Object.assign(this.data, snapshot(update)); if (done) done(); }
  });
  if (page.onLoad) page.onLoad();
  if (!options.hidden && page.onShow) page.onShow();
  function tick(ms = quizConfig.transitionMs) {
    const end = now + ms;
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      now = next[1].due; timers.delete(next[0]); next[1].callback();
    }
    now = end;
  }
  function choose(option, questionId = page.data.question.id) {
    page.selectOption({ currentTarget: { dataset: { option, questionId } } });
  }
  function next(questionId = page.data.question.id) {
    page.nextQuestion({ currentTarget: { dataset: { questionId } } });
  }
  function advance() { next(); tick(); }
  function complete(answers = fixtures.types.TEM) { answers.forEach(answer => { choose(answer); tick(); }); }
  return { page, calls, state, storage, timers, tick, choose, next, advance, complete, wx,
    get pendingAdvances() { return [...timers.values()].filter(timer => timer.delay === quizConfig.transitionMs).length; } };
}

test('pet: home protects the start button and discards stale scroll and hidden layout callbacks', () => {
  const h = harness('utils/screens/index.js'), queries = [];
  h.wx.createSelectorQuery = () => {
    const query = {
      selectAll(selector) { assert.ok(selector.includes('.start-area')); return query; },
      boundingClientRect(callback) { queries.push(callback); return query; }, exec() {}
    };
    return query;
  };
  const button = { left: 15, right: 360, top: 410, bottom: 485 };
  h.page.onReady(); queries.shift()([button]);
  assert.equal(h.page.data.petLayoutReady, true);
  assert.deepEqual(h.page.data.petAvoidRects, [button]);
  h.page.refreshPetObstacles(); const stale = queries.shift();
  h.page.onPageScroll(); stale([button]);
  assert.equal(h.page.data.petLayoutReady, true); assert.equal(h.page.data.petScrolling, true);
  h.page.openQuiz(); assert.equal(h.calls.navigate.length, 1);
  const timer = [...h.timers.values()][0]; h.timers.clear();
  assert.equal(timer.delay, 32); timer.callback();
  queries.shift()([{ ...button, top: 310, bottom: 385 }]);
  assert.equal(h.page.data.petScrolling, false); assert.equal(h.page.data.petAvoidRects[0].top, 310);
  h.page.onResize(); const hiddenQuery = queries.shift();
  h.page.onHide(); const hidden = snapshot(h.page.data); hiddenQuery([button]);
  assert.deepEqual(h.page.data, hidden);
  h.page.onShow(); queries.shift()(null); assert.equal(h.page.data.petLayoutReady, false);
  h.page.onReady(); queries.shift()([button]); assert.equal(h.page.data.petLayoutReady, true);
  h.page.onPageScroll(); const lateTimer = [...h.timers.values()][0].callback;
  h.page.onUnload(); lateTimer(); h.page.onResize(); assert.equal(h.timers.size, 0);
});

test('pet: quiz header keeps the same PNG and size as home without platform measurements', () => {
  const h = harness(), petConfig = require('../config/pet');
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/quiz/quiz-view.wxml'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../pages/quiz/quiz-view.wxss'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, '../utils/screens/quiz.js'), 'utf8');
  const header = wxml.slice(0, wxml.indexOf('<view class="quiz-progress"'));
  const imageNode = header.slice(header.indexOf('<view class="quiz-pet"'));
  assert.ok(imageNode.startsWith('<view class="quiz-pet"'));
  assert.match(header, /class="quiz-header quiz-heading"[\s\S]*class="screen-home pressable"[\s\S]*class="quiz-pet"[\s\S]*class="progress-heading"/);
  assert.doesNotMatch(imageNode, /wx:if|hidden=|petRoamingVisible|available/);
  assert.doesNotMatch(wxml, /<pet-companion/);
  assert.ok(imageNode.includes("src=\"{{petImage || '" + petConfig.image + "'}}\""));
  assert.ok(imageNode.includes('width: {{petSize || ' + petConfig.size + '}}px; height: {{petSize || ' + petConfig.size + '}}px;'));
  assert.equal(h.page.data.petImage, petConfig.image);
  assert.equal(h.page.data.petSize, petConfig.size);
  assert.match(css, /\.quiz-pet\s*\{[^}]*position: relative[^}]*flex-shrink: 0/);
  assert.match(imageNode, /catchtap="tapPet"/);
  assert.doesNotMatch(source, /petVisibilityChanged|refreshPetObstacles|petLayoutReady/);
  // Missing or broken platform measurement APIs cannot hide this native image.
  h.wx.createSelectorQuery = () => { throw Error('unavailable'); };
  h.page.onHide(); h.page.onShow();
  assert.equal(h.page.data.petSize, petConfig.size);
  assert.equal(h.page.data.question.id, questions[0].id);
  h.page.onUnload(); assert.equal(h.timers.size, 0);
});

test('pet: answer reactions run independently of the question transition', () => {
  const h = harness();
  h.page.selectComponent = () => { throw Error('must not need a component'); };
  const originalBeat = h.page.data.petBeat;
  h.choose(1); const beat = h.page.data.petBeat;
  assert.notEqual(beat, originalBeat);
  h.choose(2); assert.equal(h.page.data.petBeat, beat);
  assert.equal(h.pendingAdvances, 1);
  h.tick(); assert.equal(h.page.data.index, 1);
  h.choose(2); assert.equal(h.page.data.petBeat, beat, 'Do not restart a reaction during the next question');
  assert.equal(h.pendingAdvances, 1); h.tick();
  assert.equal(h.page.data.index, 2);
  h.page.submissionFailed('retry');
  assert.equal(h.page.data.petSize, require('../config/pet').size);
  h.page.onUnload(); assert.equal(h.timers.size, 0);
});

test('pet: tapping the quiz pet cheers repeatedly without answering or navigating', () => {
  const h = harness();
  const touch = { touches: [{ clientX: 260, clientY: 50, identifier: 1 }] };
  h.page.petTouchStart(touch); h.page.petTouchEnd(); h.page.tapPet();
  assert.equal(h.page.data.petMood, 'happy');
  const beat = h.page.data.petBeat;
  h.page.tapPet(); assert.equal(h.page.data.petBeat, beat);
  assert.equal(h.page.data.selected, -1); assert.equal(h.page.data.answered, 0);
  assert.equal(h.pendingAdvances, 0); assert.equal(h.calls.redirect.length, 0);
  h.tick(require('../config/pet').reactionMs);
  assert.notEqual(h.page.data.petBeat, beat, 'A queued tap plays after the current reaction');
  h.tick(require('../config/pet').reactionMs); assert.equal(h.page.data.petMood, 'idle');
  h.page.onHide(); h.page.tapPet(); assert.equal(h.timers.size, 0);
  h.page.onShow(); h.page.tapPet(); assert.equal(h.page.data.petMood, 'happy');
  h.page.onUnload(); h.tick(1200); assert.equal(h.timers.size, 0);
});

test('pet: quiz movement and dragging stay between home and count at phone widths; release resumes motion', () => {
  for (const width of [320, 375, 430]) {
    const h = harness(), height = 667;
    const anchor = { left: 100, right: width - 100, top: 24, bottom: 128 };
    const obstacles = [
      { left: 16, right: 96, top: 60, bottom: 92 },
      { left: width - 96, right: width - 16, top: 60, bottom: 92 },
      { left: 0, right: width, top: 132, bottom: height }
    ];
    h.wx.getWindowInfo = () => ({ windowWidth: width, windowHeight: height });
    h.wx.createSelectorQuery = () => {
      const q = { select() { return q; }, selectAll() { return q; }, boundingClientRect() { return q; },
        exec(done) { done([anchor, obstacles]); } };
      return q;
    };
    h.page.onReady(); assert.equal(h.page.data.petFloating, true);
    const start = { x: h.page.data.petX, y: h.page.data.petY };
    const checkPosition = () => {
      const { petX: x, petY: y, petSize: size } = h.page.data;
      assert.ok(x >= 0 && x + size <= width && y >= 0 && y + size <= height);
      assert.ok(x >= anchor.left && x + size <= anchor.right && y >= anchor.top && y + size <= anchor.bottom,
        'The pet must remain in the middle header slot, including after dragging');
      for (const r of obstacles) assert.equal(x < r.right && x + size > r.left && y < r.bottom && y + size > r.top, false);
    };
    for (let i = 0; i < 100; i++) { h.tick(80); checkPosition(); }
    assert.ok(h.page.data.petX !== start.x || h.page.data.petY !== start.y);
    h.page.petTouchStart({ touches: [{ clientX: 0, clientY: 0, identifier: 1 }] });
    const dragX = h.page.data.petX < (anchor.left + anchor.right - h.page.data.petSize) / 2 ? 999 : -999;
    h.page.petTouchMove({ touches: [{ clientX: dragX, clientY: 999, identifier: 1 }] });
    checkPosition(); h.page.petTouchEnd();
    assert.equal(h.page.data.petMood, 'wave');
    const beat = h.page.data.petBeat;
    h.page.tapPet(); assert.equal(h.page.data.petBeat, beat, 'drag release must not trigger a second tap');
    assert.ok(h.timers.has(h.page._pet._timers.motion));
    h.tick(400); h.page.tapPet(); assert.equal(h.page.data.petMood, 'wave');
    h.tick(require('../config/pet').reactionMs - 400); assert.equal(h.page.data.petMood, 'happy');
    h.choose(1); h.tick(200); assert.equal(h.page.data.index, 1);
    checkPosition(); assert.equal(h.page.data.petFloating, true);
    h.page.onUnload(); assert.equal(h.timers.size, 0);
  }
});

test('pet: stale quiz layout results cannot revive a hidden pet; missing bounds keep native tap feedback', () => {
  const h = harness(), pending = [];
  h.wx.getWindowInfo = () => ({ windowWidth: 375, windowHeight: 667 });
  h.wx.createSelectorQuery = () => {
    const q = { select() { return q; }, selectAll() { return q; }, boundingClientRect() { return q; },
      exec(done) { pending.push(done); } };
    return q;
  };
  h.page.onReady(); h.page.onPageScroll();
  const rects = [{ left: 243, right: 347, top: 34, bottom: 138 }, [{ left: 0, right: 375, top: 180, bottom: 667 }]];
  pending.shift()(rects); assert.equal(h.page.data.petFloating, false);
  h.page.onHide(); const hidden = snapshot(h.page.data);
  pending.shift()(rects); assert.deepEqual(h.page.data, hidden);
  h.page.onShow(); pending.shift()([null, []]);
  h.page.tapPet(); assert.equal(h.page.data.petMood, 'happy');
  assert.equal(h.page.data.petFloating, false);
  h.page.onResize(); const late = pending.shift();
  h.page.onUnload(); late(rects); h.tick(1500); assert.equal(h.timers.size, 0);
});

test('pet: all 12 question layouts preserve roaming position, destination and the current animation', () => {
  const h = harness(), writes = [], originalSetData = h.page.setData;
  h.wx.getWindowInfo = () => ({ windowWidth: 375, windowHeight: 667 });
  h.wx.createSelectorQuery = () => {
    const q = { select() { return q; }, selectAll() { return q; }, boundingClientRect() { return q; },
      exec(done) { done([{ left: 116, right: 259, top: 24, bottom: 128 }, [
        { left: 16, right: 112, top: 60, bottom: 92 },
        { left: 263, right: 359, top: 60, bottom: 92 },
        { left: 0, right: 375, top: 132, bottom: 667 }
      ]]); } };
    return q;
  };
  h.page.onReady(); h.tick(80); h.page.tapPet();
  h.page.setData = function(update, done) { writes.push(update); originalSetData.call(this, update, done); };
  for (let i = 0; i < questions.length; i++) {
    const position = { x: h.page.data.petX, y: h.page.data.petY };
    const target = { ...h.page._pet._target };
    const movement = h.page._pet._timers.motion, reaction = h.page._pet._timers.reaction;
    h.page.showQuestion(i); h.page.onReady(); h.page.onPageScroll({ scrollTop: 0 });
    assert.deepEqual({ x: h.page.data.petX, y: h.page.data.petY }, position);
    assert.deepEqual(h.page._pet._target, target);
    assert.equal(h.page._pet._timers.motion, movement);
    assert.equal(h.page._pet._timers.reaction, reaction);
    assert.equal(h.page.data.petFloating, true);
    h.tick(80);
  }
  assert.equal(writes.filter(update => update.petFloating === false).length, 0);
  h.page.onHide(); const position = { x: h.page.data.petX, y: h.page.data.petY };
  h.tick(2000); h.page.onShow();
  assert.deepEqual({ x: h.page.data.petX, y: h.page.data.petY }, position);
  h.page.onUnload(); assert.equal(h.timers.size, 0);
});

test('quiz: selected options match the current card after going back, changing answers and going forward', () => {
  const h = harness();
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/quiz/quiz-view.wxml'), 'utf8');
  const optionStyle = wxml.match(/class="option [^"]*" style="{{([\s\S]*?)}}"/)[1];
  function checkHighlight() {
    for (let index = 0; index < 4; index++) {
      const actual = vm.runInNewContext(optionStyle, { ...h.page.data, index });
      const expected = index === h.page.data.selected ? `background-color: ${h.page.data.sceneColor};` : '';
      assert.equal(actual, expected, 'Only the selected option must match the visible question card');
    }
  }
  try {
    checkHighlight();
    h.choose(0); checkHighlight(); h.tick();
    h.choose(1); checkHighlight(); h.tick();
    for (const answer of [3, 2, 0]) {
      h.page.previousQuestion();
      assert.equal(h.page.data.index, 1);
      checkHighlight();
      const color = h.page.data.sceneColor;
      h.choose(answer);
      assert.equal(h.page.data.selected, answer);
      assert.equal(h.page.data.sceneColor, color);
      assert.equal(h.page.data.answered, 2);
      checkHighlight(); h.tick(); checkHighlight();
    }
    h.page.previousQuestion(); checkHighlight();
    h.advance(); checkHighlight();
    h.page.previousQuestion(); checkHighlight();
    h.page.previousQuestion();
    assert.equal(h.page.data.selected, 0);
    checkHighlight();
  } finally { h.page.onUnload(); }
});

test('quiz: preserves feedback before advancing and scrolls only when needed', () => {
  const h = harness();
  h.choose(1);
  assert.equal(h.page.data.transitioning, true);
  assert.equal(h.page.data.selected, 1);
  h.tick(quizConfig.transitionMs - 1);
  assert.equal(h.page.data.index, 0);
  h.tick(1);
  assert.equal(h.page.data.index, 1);
  assert.equal(h.calls.scroll.length, 0);
  h.page.onPageScroll({ scrollTop: 180 });
  h.choose(2); h.tick();
  assert.equal(h.calls.scroll.length, 1);
  assert.equal(h.calls.scroll[0].scrollTop, 0);
  h.page.onPageScroll({ scrollTop: 0 });
  h.page.previousQuestion();
  assert.equal(h.calls.scroll.length, 1);
  h.page.onUnload();
});

test('M2：12 题选择后高亮，120ms 自动切题，最终结果完整存储后跳转', () => {
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
    assert.equal(h.pendingAdvances, 1);
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
  assert.equal(h.pendingAdvances, 1);
  h.next(); h.next(); h.choose(0);
  assert.equal(h.page.data.selected, 1);
  assert.equal(h.pendingAdvances, 1);
  h.tick();
  h.choose(2, 1);
  h.next(1);
  assert.equal(h.page.data.index, 1);
  assert.equal(h.page.data.selected, -1);
  assert.equal(h.pendingAdvances, 0);
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
  assert.equal(h.pendingAdvances, 1);
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
  const h = harness('utils/screens/index.js');
  h.page.openQuiz(); h.page.openQuiz();
  assert.equal(h.calls.navigate.length, 1);
  h.page.onShow(); h.state.navigateFails = true;
  h.page.openQuiz();
  h.state.navigateFails = false; h.page.openQuiz();
  assert.equal(h.calls.navigate.length, 3);
});

test('M2：布局采用自然滚动，四选项无固定遮挡；小屏真机仍需人工验收', () => {
  const base = fs.readFileSync(path.join(__dirname, '../app.wxss'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../pages/quiz/quiz-view.wxss'), 'utf8');
  const fixedRules = [...(base + css).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(match => /position\s*:\s*fixed/.test(match[2]));
  assert.equal(fixedRules.length, 1);
  assert.equal(fixedRules[0][1].trim(), '.quiz-pet-motion.is-roaming');
  assert.ok(!/disableScroll/.test(fs.readFileSync(path.join(__dirname, '../pages/quiz/quiz.json'), 'utf8')));
  const optionRule = css.match(/\.option\s*\{([^}]+)\}/)[1];
  assert.ok(Number(optionRule.match(/min-height:\s*(\d+)px/)[1]) >= 48);
  assert.ok(css.includes('max-width: 340px'));
  assert.ok(css.includes('safe-area-inset-bottom'));
  assert.equal(quizConfig.scenes.length, 12);
});
