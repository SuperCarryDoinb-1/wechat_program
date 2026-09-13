// M1 独立测试入口：node utils/scoring.test.js；不启动子进程，不连接微信或云端。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { calc } = require('./scoring');
const { pair } = require('./pairing');
const questions = require('../config/questions');
const types = require('../config/types');
const rarity = require('../config/rarity');
const pairing = require('../config/pairing');
const { randomAnswers } = require('../tests/sample');
const fixtures = require('../tests/m1-fixtures.json');
const axes = ['rel', 'att', 'lead'];
let passed = 0;
function check(name, run) {
  run();
  passed += 1;
  console.log(`✓ ${name}`);
}
function totals(answers, onlyStrong = false) {
  return Object.fromEntries(axes.map(axis => [axis, answers.reduce((sum, value, i) => {
    const score = questions[i].options[value].score[axis] || 0;
    return sum + (onlyStrong && Math.abs(score) !== 2 ? 0 : score);
  }, 0)]));
}
function baseCode(answers) {
  const s = totals(answers), strong = totals(answers, true);
  return axes.map((axis, i) => {
    const value = s[axis] === 0 ? strong[axis] : s[axis];
    if (value === 0) return ['T', 'E', 'M'][i];
    return value > 0 ? ['P', 'E', 'A'][i] : ['T', 'G', 'M'][i];
  }).join('');
}

check('题库顺序、选项、向量范围与文档差异可追踪', () => {
  assert.equal(questions.length, 12);
  const source = fs.readFileSync(path.join(__dirname, '../AITI.md'), 'utf8').split('### 3.2 ')[1].split('### 3.3 ')[0];
  const blocks = [...source.matchAll(/\*\*Q(\d+) (.*?)\*\*\r?\n([\s\S]*?)(?=\r?\n\*\*Q|$)/g)];
  assert.equal(blocks.length, 12);
  const differences = [];
  questions.forEach((q, i) => {
    assert.equal(q.id, i + 1);
    assert.equal(q.imageIndex, i);
    assert.equal(q.title, blocks[i][2]);
    assert.equal(q.options.length, 4);
    const options = [...blocks[i][3].matchAll(/^- ([A-D]) (.*?) `\{(.*?)\}`/gm)];
    q.options.forEach((o, j) => {
      assert.equal(o.label, 'ABCD'[j]);
      // M7 文案审阅仅替换 Q7-B 的夸张表达；其他题目仍严格核对原稿。
      assert.equal(o.text, i === 6 && j === 1 ? '我会非常不适应' : options[j][2]);
      const original = Object.fromEntries(options[j][3].split(',').map(v => {
        const [key, number] = v.trim().split(':'); return [key, Number(number)];
      }));
      assert.deepEqual(Object.keys(o.score).sort(), Object.keys(original).sort());
      Object.entries(o.score).forEach(([axis, value]) => {
        assert.ok(axes.includes(axis) && Number.isInteger(value) && Math.abs(value) <= 2);
        if (value !== original[axis]) differences.push({ question: i + 1, option: o.label, axis, from: original[axis], to: value });
      });
    });
  });
  assert.deepEqual(differences, fixtures.adjustments);
});

check('8 类内容、稀有度、精简长度、原文及闭环引用', () => {
  const source = fs.readFileSync(path.join(__dirname, '../AITI.md'), 'utf8');
  assert.equal(Object.keys(types).length, 8);
  Object.entries(types).forEach(([code, type]) => {
    assert.equal(type.rarity, code === 'TEM' ? 'hidden' : 'common');
    assert.ok(/^#[0-9A-F]{6}$/i.test(type.color));
    const length = Array.from(type.persona.replace(/[\s\p{P}]/gu, '')).length;
    assert.ok(length >= 30 && length <= 40, `${code} 人设长度 ${length}`);
    assert.ok(source.includes(type.personaOriginal), `${code} 原文不一致`);
    ['name', 'slogan', 'scene', 'roastFallback'].forEach(key => assert.ok(type[key].length > 0));
    assert.ok(Array.from(type.roastFallback).length <= 60);
    assert.ok(!type.roastFallback.startsWith('你是'));
    assert.equal(type.pros.length, 2);
    assert.equal(type.cons.length, 2);
    assert.equal(type.tipsFallback.length, 3);
    Object.values(type.match).concat(Object.values(type.chain)).forEach(ref => assert.ok(types[ref.code]));
    assert.equal(types[type.chain.looksDownOn.code].chain.lookedDownBy.code, code);
  });
  let current = 'TEM';
  const visited = new Set();
  for (let i = 0; i < 8; i += 1) { visited.add(current); current = types[current].chain.looksDownOn.code; }
  assert.equal(visited.size, 8);
  assert.equal(current, 'TEM');
});

check('8 个类型各有一组固定命中答案', () => {
  Object.entries(fixtures.types).forEach(([code, answers]) => {
    assert.equal(calc(answers).code, code);
    console.log(`  ${code} ${types[code].name}: ${JSON.stringify(answers)}`);
  });
  assert.deepEqual(Object.keys(fixtures.types).sort(), Object.keys(types).sort());
});

check('三个维度平局：强选项正负判定与最终默认值', () => {
  axes.forEach((axis, index) => {
    ['negative', 'zero', 'positive'].forEach(kind => {
      const answers = fixtures.ties[axis][kind];
      assert.equal(totals(answers)[axis], 0);
      assert.equal(Math.sign(totals(answers, true)[axis]), { negative: -1, zero: 0, positive: 1 }[kind]);
      const expected = kind === 'zero' ? ['T', 'E', 'M'][index] :
        (kind === 'positive' ? ['P', 'E', 'A'][index] : ['T', 'G', 'M'][index]);
      assert.equal(baseCode(answers)[index], expected);
      // 此组夹具不经过隐藏款转型，可直接检验最终字母。
      assert.notEqual(baseCode(answers), 'TEM');
      assert.equal(calc(answers).code[index], expected);
    });
  });
});

check('隐藏款包含边界，三个单维未达标按最弱维度转型', () => {
  const t = rarity.thresholds;
  assert.deepEqual(t, fixtures.thresholds);
  assert.deepEqual(totals(fixtures.hiddenBoundary), t);
  assert.equal(calc(fixtures.hiddenBoundary).code, 'TEM');
  axes.forEach(axis => {
    const answers = fixtures.fallbacks[axis];
    const s = totals(answers);
    assert.equal(baseCode(answers), 'TEM');
    const meets = { rel: s.rel <= t.rel, att: s.att >= t.att, lead: s.lead <= t.lead };
    axes.forEach(key => assert.equal(meets[key], key !== axis));
    axes.filter(key => key !== axis).forEach(key => assert.ok(Math.abs(s[axis]) < Math.abs(s[key])));
    assert.equal(calc(answers).code, { rel: 'PEM', att: 'TGM', lead: 'TEA' }[axis]);
    assert.equal(calc(answers).rarity, 'common');
    console.log(`  ${axis} 未达标: ${JSON.stringify(answers)} → ${calc(answers).code}`);
  });
  assert.equal(baseCode(fixtures.weakestTie), 'TEM');
  assert.deepEqual(totals(fixtures.weakestTie), { rel: 0, att: 0, lead: 0 });
  assert.equal(calc(fixtures.weakestTie).code, 'PEM');
});

check('非法输入拒绝，不补答、不静默强转、不接受稀疏数组', () => {
  [null, {}, '000000000000', [], Array(11).fill(0), Array(13).fill(0), Array(12),
    ...[-1, 4, 0.5, NaN, Infinity, '0', null, undefined].map(v => [v, ...Array(11).fill(0)])
  ].forEach(input => assert.throws(() => calc(input), TypeError));
  [null, '', 'tem', 'XYZ', 'constructor', '__proto__', 1].forEach(code => {
    assert.throws(() => pair(code, 'TEM'), TypeError);
    assert.throws(() => pair('TEM', code), TypeError);
  });
});

check('配对四档、三种互补维度、四个特配及 64 组交换对称', () => {
  [['TEM', 'TEM'], ['PEA', 'PGA'], ['TEM', 'PEA'], ['TEM', 'PGA']].forEach(([a, b], level) => {
    assert.deepEqual(pair(a, b), { level, name: pairing.levels[level].name,
      text: level === 1 ? pairing.complements[1] : pairing.levels[level].text });
  });
  [['TEA', 'PEA'], ['PEA', 'PGA'], ['PEA', 'PEM']].forEach(([a,b], i) => assert.equal(pair(a,b).text, pairing.complements[i]));
  const expectedSpecials = ['主仆关系', '路线之争', '质检员与甩锅侠', '同一个人的白天和夜晚'];
  pairing.specials.forEach((s, i) => assert.equal(pair(...s.codes).name, expectedSpecials[i]));
  Object.keys(types).forEach(a => Object.keys(types).forEach(b => {
    assert.deepEqual(pair(a, b), pair(b, a));
    assert.equal(pair(a,b).level, [...a].filter((letter,i)=>letter!==b[i]).length);
  }));
});

check('一万组可复现抽样分布、原始坐标、结果确定性和输入不变', () => {
  const counts = Object.fromEntries(Object.keys(types).map(code => [code, 0]));
  for (const answers of randomAnswers(10000)) {
    const before = answers.slice();
    const result = calc(answers);
    assert.deepEqual(answers, before);
    assert.deepEqual(calc(answers), result);
    assert.deepEqual(result.scores, totals(answers));
    assert.equal(result.coords.x, result.scores.rel / 24);
    assert.equal(result.coords.y, result.scores.att / 24);
    assert.ok(Math.abs(result.coords.x) <= 1 && Math.abs(result.coords.y) <= 1);
    assert.equal(result.rarity, types[result.code].rarity);
    const original = baseCode(answers);
    if (original !== 'TEM') assert.equal(result.code, original);
    counts[result.code] += 1;
  }
  Object.entries(counts).forEach(([code, count]) => {
    const [min, max] = code === 'TEM' ? rarity.targets.hidden : rarity.targets.common;
    const rate = count / 10000;
    console.log(`  ${code} ${types[code].name}: ${(rate * 100).toFixed(2)}% (${count}/10000)`);
    assert.ok(rate >= min && rate <= max, `${code} 未达分布目标`);
  });
});
check('不同种子的十万组独立复核也达到分布目标', () => {
  const counts = Object.fromEntries(Object.keys(types).map(code => [code, 0]));
  randomAnswers(100000, 8972341).forEach(answers => { counts[calc(answers).code] += 1; });
  Object.entries(counts).forEach(([code, count]) => {
    const [min, max] = code === 'TEM' ? rarity.targets.hidden : rarity.targets.common;
    const rate = count / 100000;
    assert.ok(rate >= min && rate <= max, `${code} 独立复核未达目标`);
    console.log(`  ${code}: ${(rate * 100).toFixed(3)}%`);
  });
});

check('Node 测试代码与夹具不会打入小程序包', () => {
  const project = JSON.parse(fs.readFileSync(path.join(__dirname, '../project.config.json'), 'utf8'));
  assert.ok(project.packOptions.ignore.some(item => item.type === 'file' && item.value === 'utils/scoring.test.js'));
  assert.ok(project.packOptions.ignore.some(item => item.type === 'folder' && item.value === 'tests'));
});
console.log(`M1: ${passed} 组测试全部通过；阈值 ${JSON.stringify(rarity.thresholds)}`);
