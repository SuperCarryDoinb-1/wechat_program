// 先用开发者工具的 wcc 编译到 tmp/flow-wxml.js，再运行本检查。
// 执行实际编译产物验证节点和数据作用域；不等同于模拟器截图或帧率测试。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const warnings = [];
const context = vm.createContext({ window: {}, console: {
  log: value => warnings.push(String(value)), warn: value => warnings.push(String(value)), error: value => warnings.push(String(value))
} });
vm.runInContext(fs.readFileSync(path.join(root, 'tmp/flow-wxml.js'), 'utf8'), context);
const quiz = require('../config/quiz');
const questions = require('../config/questions');
const pet = require('../config/pet');
const fixtures = require('./m1-fixtures.json');
const { calc } = require('../utils/scoring');
const result = calc(fixtures.types.TEA);
const states = {
  index: require('../utils/screens/index').data,
  quiz: { ...require('../utils/screens/quiz').data, question: questions[0], scene: quiz.scenes[0], sceneColor: quiz.sceneColors[0] },
  result: { ...require('../utils/screens/result').data, result, type: require('../config/types')[result.code] }
};
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...(tree.children || []).flatMap(nodes)];
}
for (const entry of ['index', 'quiz', 'result']) {
  const render = context.$gwx(`pages/${entry}/${entry}.wxml`);
  assert.equal(typeof render, 'function');
  const registrations = require(`../pages/${entry}/${entry}.json`).usingComponents;
  for (const stage of ['index', 'quiz', 'result', 'quiz', 'index']) {
    const tree = render({ stage, screen: states[stage] }), all = nodes(tree);
    const className = stage === 'index' ? 'home-page' : stage + '-page';
    assert.equal(all.filter(node => (node.attr?.class || '').split(' ').includes(className)).length, 1);
    for (const name of ['pet-companion', 'type-card', 'quadrant-map']) {
      if (all.some(node => node.tag === 'wx-' + name)) assert.ok(registrations[name]);
    }
    const pets = all.filter(node => node.tag === 'wx-pet-companion');
    if (stage === 'quiz') {
      assert.equal(pets.length, 0);
      assert.equal(all.filter(node => node.attr?.src === pet.image).length, 1);
      assert.ok(JSON.stringify(tree).includes(questions[0].title));
      assert.equal(all.filter(node => node.tag === 'wx-button' && node.attr?.class?.startsWith('option ')).length, 4);
    } else assert.equal(pets.length, 1);
    assert.equal(all.filter(node => node.tag === 'wx-canvas').length, 0);
  }
  const saving = nodes(render({ stage: 'result', screen: { ...states.result, savingPoster: true } }));
  assert.equal(saving.filter(node => node.tag === 'wx-canvas').length, 1);
  const fallback = nodes(render({ stage: 'quiz', screen: { ...states.quiz, petImage: '', petSize: 0 } }));
  assert.equal(fallback.filter(node => node.attr?.src === pet.image).length, 1);
}
assert.deepEqual(warnings, []);
console.log('Compiled WXML passed: all 3 entries render home, quiz, result and back; pet nodes, options and lazy canvas verified.');
