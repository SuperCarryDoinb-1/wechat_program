const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const types = require('../config/types');
const assets = require('../config/assets');
const copy = require('../config/copy');
const quizConfig = require('../config/quiz');
const { calc } = require('../utils/scoring');
const fixtures = require('./m1-fixtures.json');
const clone = value => JSON.parse(JSON.stringify(value));

function load(relative, stored, readFails = false) {
  const filename = path.join(__dirname, '..', relative);
  let definition, nextTimer = 0;
  const timers = new Map(), calls = { routes: [], toasts: [] };
  const state = { navigationFails: false };
  const instanceRequire = createRequire(filename);
  const wx = {
    getStorageSync(key) { assert.equal(key, quizConfig.resultStorageKey); if (readFails) throw Error('READ_FAILED'); return stored; },
    redirectTo(args) { calls.routes.push(args.url); if (state.navigationFails) args.fail(); },
    showToast(args) { calls.toasts.push(args.title); }
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    require(name) {
      if (name === '../../utils/content-service') return { load: () => new Promise(() => {}) };
      return instanceRequire(name);
    }, module: { set exports(value) { definition = value; } }, Component(value) { definition = value; }, wx,
    setTimeout(callback, delay) { assert.equal(delay, 1200); const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }
  }, { filename });
  const instance = Object.assign({}, definition, definition.methods, { data: clone(definition.data),
    setData(update) { assert.ok(!this._disposed); Object.assign(this.data, clone(update)); } });
  const tick = () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); };
  return { instance, definition, timers, tick, calls, state };
}
function resultPage(code = 'TEM') {
  const h = load('utils/screens/result.js', { version: 1, answers: fixtures.types[code], ...calc(fixtures.types[code]) });
  h.instance.onLoad(); return h;
}

test('M3：8 类真实答案到结果页，名称/颜色/稀有度/坐标/详情关系一致', () => {
  Object.keys(types).forEach(code => {
    const { instance } = resultPage(code);
    assert.equal(instance.data.result.code, code);
    assert.deepEqual(instance.data.type, types[code]);
    assert.deepEqual(instance.data.result.coords, calc(fixtures.types[code]).coords);
    assert.equal(instance.data.relations.best.name, types[types[code].match.best.code].name);
    assert.equal(instance.data.relations.lookedDownBy.name, types[types[code].chain.lookedDownBy.code].name);
    assert.equal(instance.data.leadLabel, code[2] === 'M' ? copy.result.humanLead : copy.result.aiLead);
  });
});

test('M3：缺失、损坏、版本不支持和读取失败展示空态', () => {
  [undefined, null, '', {}, { version: 99, answers: fixtures.types.TEM },
    { version: 1, answers: [] }, { version: 1, answers: Array(12).fill(9) }].forEach(stored => {
    const { instance, timers } = load('utils/screens/result.js', stored);
    instance.onLoad(); instance.onReady();
    assert.equal(instance.data.result, null);
    assert.equal(timers.size, 0);
  });
  const { instance } = load('utils/screens/result.js', null, true);
  instance.onLoad(); assert.equal(instance.data.result, null);
});

test('M3：以真实答案重算，不把错误缓存代码/坐标当结果', () => {
  const { instance } = load('utils/screens/result.js', { version: 1, answers: fixtures.types.TEA, code: 'TEM', coords: {x:99,y:99} });
  instance.onLoad();
  assert.deepEqual(instance.data.result, calc(fixtures.types.TEA));
});

test('M3：隐藏款揭晓只播放一次，1.2 秒结束，普通款不播放', () => {
  const h = resultPage();
  h.instance.onReady(); h.instance.onReady();
  assert.equal(h.instance.data.revealing, true);
  assert.equal(h.timers.size, 1);
  h.tick(); assert.equal(h.instance.data.revealing, false);
  h.instance.onReady(); assert.equal(h.timers.size, 0);
  Object.keys(types).filter(code=>code!=='TEM').forEach(code => {
    const normal = resultPage(code); normal.instance.onReady();
    assert.equal(normal.instance.data.revealing, false); assert.equal(normal.timers.size, 0);
  });
});

test('M3：动效可跳过，切后台不重播，卸载后无计时回调', () => {
  for (const action of ['skipReveal', 'onHide', 'onUnload']) {
    const h = resultPage(); h.instance.onReady(); h.instance[action]();
    assert.equal(h.timers.size, 0);
    h.tick();
    if (action !== 'onUnload') {
      assert.equal(h.instance.data.revealing, false);
      h.instance.onReady(); assert.equal(h.timers.size, 0);
    }
  }
});

test('M3：详情反复展开收起，重测防连点，失败可重试', () => {
  const h = resultPage();
  assert.equal(h.instance.data.detailsOpen, false);
  h.instance.toggleDetails(); assert.equal(h.instance.data.detailsOpen, true);
  h.instance.toggleDetails(); assert.equal(h.instance.data.detailsOpen, false);
  h.state.navigationFails = true; h.instance.restart();
  h.state.navigationFails = false; h.instance.restart(); h.instance.restart();
  assert.deepEqual(h.calls.routes, ['/pages/quiz/quiz', '/pages/quiz/quiz']);
});

test('M3：人设组件能连续切换 8 类，图片失败回退且旧图错误不影响新类型', () => {
  const h = load('components/type-card/type-card.js');
  const update = code => h.definition.observers.typeCode.call(h.instance, code);
  Object.keys(types).forEach(code => { update(code); assert.deepEqual(h.instance.data.type, types[code]); assert.equal(h.instance.data.code, code); });
  const old = assets.types.TEM;
  try {
    assets.types.TEM = '/assets/not-present.png'; update('TEM');
    assert.equal(h.instance.data.image, assets.types.TEM);
    h.instance.imageFailed({ currentTarget: { dataset: { code: 'TEA' } } });
    assert.equal(h.instance.data.image, assets.types.TEM);
    h.instance.imageFailed({ currentTarget: { dataset: { code: 'TEM' } } });
    assert.equal(h.instance.data.image, '');
  } finally { assets.types.TEM = old; }
  update('__proto__'); assert.equal(h.instance.data.type, null);
});

test('M3：坐标四角与中心正确映射，正 y 向上，异常值无误导点位', () => {
  const h = load('components/quadrant-map/quadrant-map.js');
  const update = coords => h.definition.observers.coords.call(h.instance, coords);
  [[-1,1,0,0],[1,1,100,0],[-1,-1,0,100],[1,-1,100,100],[0,0,50,50]].forEach(([x,y,left,top]) => {
    update({x,y}); assert.equal(h.instance.data.valid,true);
    assert.equal(h.instance.data.left,left); assert.equal(h.instance.data.top,top);
  });
  update({x:2,y:-2}); assert.equal(h.instance.data.left,100); assert.equal(h.instance.data.top,100);
  [null, {}, {x:NaN,y:0}, {x:0,y:Infinity}, {x:'1',y:0}].forEach(value => {update(value); assert.equal(h.instance.data.valid,false);});
});

test('M3：组件注册、WXML 事件绑定与配置引用完整', () => {
  const json = JSON.parse(fs.readFileSync(path.join(__dirname,'../pages/result/result.json'),'utf8'));
  Object.values(json.usingComponents).forEach(route => {
    const base = path.join(__dirname, '..', route.slice(1));
    for (const ext of ['js','json','wxml','wxss']) assert.ok(fs.existsSync(`${base}.${ext}`));
    assert.equal(JSON.parse(fs.readFileSync(`${base}.json`,'utf8')).component,true);
  });
  for (const relative of ['pages/result/result','components/type-card/type-card','components/quadrant-map/quadrant-map']) {
    const isPage = relative.startsWith('pages/');
    const h = load(isPage ? 'utils/screens/result.js' : `${relative}.js`);
    const wxml = fs.readFileSync(path.join(__dirname,'..',`${relative}${isPage ? '-view' : ''}.wxml`),'utf8');
    for (const match of wxml.matchAll(/bind(?:tap|error)="(\w+)"/g)) assert.equal(typeof h.instance[match[1]],'function');
  }
});
