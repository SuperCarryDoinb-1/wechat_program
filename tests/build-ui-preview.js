// 从实际 WXML、WXSS 与配置生成浏览器校样；不模拟微信 API，也不参与小程序打包。
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function read(file) {
  const target = path.resolve(root, file);
  assert.ok(target.startsWith(root + path.sep));
  assert.ok(!fs.lstatSync(target).isSymbolicLink());
  return fs.readFileSync(target, 'utf8');
}
const copy = require('../config/copy');
const assets = require('../config/assets');
const types = require('../config/types');
const questions = require('../config/questions');
const quiz = require('../config/quiz');
const sharingCopy = require('../config/sharing');
const pairCopy = require('../config/pair-view');
const fixtures = require('./m1-fixtures.json');
const { calc } = require('../utils/scoring');
const { buildPair } = require('../utils/pair-result');

function parse(source) {
  const tree = { children: [] }, stack = [tree];
  const tokens = source.match(/<!--[\s\S]*?-->|<(?:[^>"']|"[^"]*"|'[^']*')+>|[^<]+/g) || [];
  for (const token of tokens) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) { assert.equal(stack.pop().tag, token.slice(2, -1).trim()); continue; }
    if (!token.startsWith('<')) { stack.at(-1).children.push(token); continue; }
    const tag = token.match(/^<([\w-]+)/)[1], attrs = {};
    for (const match of token.slice(tag.length + 1).matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[match[1]] = match[2] === undefined ? true : match[2];
    const node = { tag, attrs, children: [] };
    stack.at(-1).children.push(node);
    if (!token.endsWith('/>')) stack.push(node);
  }
  assert.equal(stack.length, 1, 'WXML 标签成对闭合');
  return tree.children;
}
const templates = {};
for (const name of ['index', 'quiz', 'result']) templates[name] = parse(read(`pages/${name}/${name}-view.wxml`));
for (const name of ['type-card', 'quadrant-map', 'pet-companion']) templates[name] = parse(read(`components/${name}/${name}.wxml`));
const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function evaluate(expression, data) {
  return Function(...Object.keys(data), `"use strict"; return (${expression});`)(...Object.values(data));
}
function value(template, data) {
  if (template === true) return true;
  const match = template.match(/^{{((?:(?!}})[\s\S])*)}}$/);
  return match ? evaluate(match[1], data) : template.replace(/{{([\s\S]*?)}}/g, (_, code) => evaluate(code, data) ?? '');
}
function component(name, props) {
  if (name === 'pet-companion') {
    const pet = require('../config/pet');
    return { image: pet.image, size: pet.size,
      x: 210, y: props.scene === 'quiz' ? 76 : 260, active: true, positioned: true, available: props.scene !== 'quiz' || props['layout-ready'], passive: props.scene === 'quiz',
      mood: 'idle', beat: 0, facing: 1, imageFailed: false, confirmed: true, motionReady: false, dragging: false, motionSuspended: false };
  }
  if (name === 'type-card') {
    const code = props['type-code'];
    return { code, type: types[code], image: '', copy: copy.result };
  }
  const coords = props.coords, friend = props['friend-coords'];
  const clamp = n => Math.min(1, Math.max(-1, n));
  const point = c => ({ left: (clamp(c.x) + 1) * 50, top: (1 - clamp(c.y)) * 50 });
  const own = point(coords), other = friend ? point(friend) : own;
  const samePoint = own.left === other.left && own.top === other.top;
  return { copy: copy.result, pairCopy, valid: true, ...own, accent: props.accent,
    friendValid: !!friend, friendLeft: other.left, friendTop: other.top, friendAccent: props['friend-accent'], samePoint,
    connection: !friend || samePoint ? [] : Array.from({ length: 41 }, (_, id) => ({ id, left: own.left + (other.left - own.left) * id / 40, top: own.top + (other.top - own.top) * id / 40 })) };
}
function render(nodes, data) {
  let branch = false, output = '';
  for (const node of nodes) {
    if (typeof node === 'string') { output += escape(value(node, data)); continue; }
    const a = node.attrs;
    if ('wx:if' in a) { branch = !!value(a['wx:if'], data); if (!branch) continue; }
    else if ('wx:elif' in a) { if (branch) continue; branch = !!value(a['wx:elif'], data); if (!branch) continue; }
    else if ('wx:else' in a) { if (branch) continue; branch = true; }
    else branch = false;
    if (a['wx:for']) {
      const attrs = { ...a }; delete attrs['wx:for'];
      value(a['wx:for'], data).forEach((item, index) => {
        output += render([{ ...node, attrs }], { ...data, [a['wx:for-item'] || 'item']: item, [a['wx:for-index'] || 'index']: index });
      });
      continue;
    }
    const props = {};
    for (const [key, item] of Object.entries(a)) if (!key.startsWith('wx:')) props[key] = value(item, data);
    if (templates[node.tag]) { output += `<div class="component-${node.tag}">${render(templates[node.tag], component(node.tag, props))}</div>`; continue; }
    if (node.tag === 'block') { output += render(node.children, data); continue; }
    const tag = ({ view: 'div', text: 'span', 'scroll-view': 'div', image: 'img', 'movable-area': 'div', 'movable-view': 'div' })[node.tag] || node.tag;
    if (node.tag === 'movable-view') props.style = (props.style || '') + `transform: translate(${props.x}px, ${props.y || 0}px);`;
    if (tag === 'img' && typeof props.src === 'string' && props.src.startsWith('/assets/')) props.src = '..' + props.src;
    const attr = Object.entries(props).filter(([key]) => /^(class|style|id|src|disabled|role|aria-|data-)/.test(key))
      .filter(([key, val]) => key !== 'disabled' || val)
      .map(([key, val]) => `${key}="${escape(val)}"`).join(' ');
    output += `<${tag} ${attr}>${render(node.children, data)}</${tag}>`;
  }
  return output;
}
function css(file, scope = '') {
  let source = read(file);
  source = source.replace(/@import\s+"([^"]+)";/g, (_, target) => css(path.join(path.dirname(file), target)));
  if (scope) source = source.replace(/(^|})(\s*)([^{}]+)\{/g, (_, end, space, selectors) => `${end}${space}${selectors.split(',').map(s => `${scope} ${s.trim()}`).join(', ')} {`);
  return source.replace(/(-?[\d.]+)rpx/g, 'calc($1 * var(--rpx))').replace(/^page\s*\{/m, 'body {');
}
const commonCss = css('app.wxss') + css('components/type-card/type-card.wxss', '.component-type-card') + css('components/quadrant-map/quadrant-map.wxss', '.component-quadrant-map');
function screen(page, data) {
  const style = commonCss + css(`pages/${page}/${page}.wxss`) + css('components/pet-companion/pet-companion.wxss');
  return `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--rpx:calc(100vw / 750)}*{box-sizing:border-box}body{margin:0}button{border:0;cursor:pointer}span{white-space:inherit}.type-strip{overflow-x:auto}.nav{height:44px;display:flex;align-items:center;justify-content:center;font:600 15px sans-serif;color:#1D1D1F;background:#FFF4DA}.nav span{position:absolute;right:16px;border:1px solid #E5E5EA;border-radius:20px;padding:1px 10px;letter-spacing:6px}${style}</style><body><div class="nav">AITI<span>··· ⊙</span></div>${render(templates[page], data)}</body></html>`;
}
const petConfig = require('../config/pet');
const base = { copy, assets, sharingCopy, pairCopy, petAvoidRects: [], petLayoutReady: true, petScrolling: false,
  runnerFilters: quiz.runnerFilters,
  petImage: petConfig.image, petSize: petConfig.size, petBeat: -1,
  petMood: 'idle', petFacing: 1, petFloating: false, petX: 0, petY: 0, petMotionReady: false, petDragging: false };
const screens = { index: [screen('index', { ...base, singlePage: false, friendMessage: '', showDiagnostics: false, modeLabel: '', checking: false, checkMessage: '', typePreviews: Object.keys(types).map(code => ({ code, ...types[code] })) })], quiz: [], result: [], details: [], pair: [], privacy: [] };
questions.forEach((question, index) => screens.quiz.push(screen('quiz', { ...base, question, scene: quiz.scenes[index], sceneColor: quiz.sceneColors[index % quiz.sceneColors.length], image: '', number: index + 1, index, total: 12, answered: index, progress: Math.round(index / 12 * 100), selected: -1, transitioning: false, submitting: false, submitError: '' })));
for (const code of Object.keys(types)) {
  const type = types[code], result = calc(fixtures.types[code]);
  const resolve = ref => ({ name: types[ref.code].name, reason: ref.reason });
  const data = { ...base, result, type, invitation: false, revealing: false, contentLoading: false, contentLabel: copy.result.contentLabels.mock, contentNote: '',
    content: { roast: type.roastFallback, tips: type.tipsFallback }, leadLabel: code[2] === 'M' ? copy.result.humanLead : copy.result.aiLead,
    detailsOpen: false, relations: { best: resolve(type.match.best), worst: resolve(type.match.worst), looksDownOn: resolve(type.chain.looksDownOn), lookedDownBy: resolve(type.chain.lookedDownBy) },
    pairLoading: false, pairNote: '', pairing: null, shareNote: sharingCopy.localNote, savingPoster: false, albumDenied: false, privacyVisible: false, posterQuality: 'standard' };
  screens.result.push(screen('result', data));
  screens.details.push(screen('result', { ...data, detailsOpen: true }));
  screens.pair.push(screen('result', { ...data, pairing: buildPair(result, calc(fixtures.types.PEM)) }));
  screens.privacy.push(screen('result', { ...data, privacyVisible: true }));
}
const catalog = JSON.stringify(screens).replace(/</g, '\\u003c');
const fallbackPreview = screen('quiz', { ...base,
  petImage: undefined, petSize: undefined, petBeat: undefined,
  question: questions[0], scene: quiz.scenes[0], sceneColor: quiz.sceneColors[0], image: '', number: 1,
  index: 0, total: 12, answered: 0, progress: 0, selected: -1, transitioning: false, submitting: false, submitError: '' });
assert.match(fallbackPreview, /quiz-pet-image[^>]+src="\.\.\/assets\/pet\/03-glossy-jelly-pink.png"/);
assert.match(fallbackPreview, /quiz-pet-image[^>]+style="width: 104px; height: 104px;"/);
assert.doesNotMatch(fallbackPreview, /class="pet-walker/);
fs.writeFileSync(path.join(root, 'docs/quiz-pet-fallback-preview.html'), fallbackPreview);
const resultOptions = Object.keys(types).map((code, index) => `<option value="${index}">${code} · ${types[code].name}</option>`).join('');
const output = `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AITI 视觉校样</title><style>body{margin:0;background:#F1E6CB;color:#1D1D1F;font:14px system-ui}header{padding:24px 28px;background:#FFFFFF;color:#1D1D1F}h1{margin:0 0 12px;font-size:26px}header p{max-width:900px;line-height:1.8;margin:0;color:#636366}.controls{padding:18px 28px;display:flex;gap:16px;flex-wrap:wrap;align-items:center}select{padding:8px;background:#FFF;border:1px solid #202020;border-radius:8px;color:#FFFFFF}.frames{display:flex;align-items:flex-start;gap:24px;padding:12px 28px 40px;overflow-x:auto}.frame{flex-shrink:0}h2{font-size:16px}iframe{display:block;border:1px solid #202020;border-radius:8px;background:#FFF4DA;box-shadow:0 12px 32px #1D1D1F16}</style><header><h1>AITI / Neobrutalism</h1><p>使用项目真实 WXML、WXSS 和配置生成的浏览器视觉校样。可切换宽度、题目、身份与结果状态；手机画面内部可滚动。按钮仅展示样式，真实答题、分享和授权请在微信开发者工具中体验。本文件不是微信编译或真机验收结果。</p></header><div class="controls"><label>宽度 <select id="width"><option>320</option><option selected>375</option><option>430</option></select></label><label>题目 <select id="question">${questions.map((_, i) => `<option value="${i}">Q${i + 1}</option>`).join('')}</select></label><label>身份 <select id="type">${resultOptions}</select></label><label>结果状态 <select id="state"><option value="result">默认</option><option value="details">详情展开</option><option value="pair">与 PEM 配对</option><option value="privacy">隐私授权</option></select></label></div><main class="frames"><section class="frame"><h2>01 / 发现</h2><iframe id="home" title="首页校样"></iframe></section><section class="frame"><h2>02 / 选择</h2><iframe id="quiz" title="答题校样"></iframe></section><section class="frame"><h2>03 / 身份</h2><iframe id="result" title="结果校样"></iframe></section></main><script>const screens=${catalog};const el=id=>document.getElementById(id);function update(){const width=Number(el('width').value);for(const id of ['home','quiz','result']){el(id).width=width;el(id).height=width===320?568:760;}el('home').srcdoc=screens.index[0];el('quiz').srcdoc=screens.quiz[Number(el('question').value)];el('result').srcdoc=screens[el('state').value][Number(el('type').value)];}for(const id of ['width','question','type','state'])el(id).addEventListener('change',update);update();</script></html>`;
fs.writeFileSync(path.join(root, 'docs/ui-preview.html'), output);
console.log('Generated docs/ui-preview.html: 45 screens from actual templates; browser preview only.');
