const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
function scan(relative) {
  const absolute = path.resolve(root, relative);
  assert.ok(absolute.startsWith(root + path.sep), '只访问当前项目');
  const stat = fs.lstatSync(absolute);
  assert.ok(!stat.isSymbolicLink(), `不跟随符号链接：${relative}`);
  if (stat.isDirectory()) return fs.readdirSync(absolute).flatMap(name => scan(path.join(relative, name)));
  return relative.endsWith('.js') && !relative.endsWith('.test.js') ? [absolute] : [];
}

test('前端模块引用存在、无循环，分享与绘图不依赖平台服务', () => {
  const files = [path.join(root, 'app.js'), ...['pages', 'components', 'config', 'utils'].flatMap(scan)];
  const graph = new Map(files.map(file => {
    const source = fs.readFileSync(file, 'utf8');
    const imports = [...source.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(match => {
      assert.ok(match[1].startsWith('.'), `前端不引入外部运行时包：${match[1]}`);
      const target = path.resolve(path.dirname(file), match[1] + (path.extname(match[1]) ? '' : '.js'));
      assert.ok(files.includes(target), `引用必须存在于前端目录：${target}`);
      return target;
    });
    return [file, imports];
  }));
  function visit(file, stack = [], visited = new Set()) {
    assert.ok(!stack.includes(file), `循环依赖：${[...stack, file].map(item => path.relative(root, item)).join(' → ')}`);
    if (visited.has(file)) return visited;
    visited.add(file);
    graph.get(file).forEach(next => visit(next, [...stack, file], visited));
    return visited;
  }
  files.forEach(file => visit(file));
  for (const [file, imports] of graph) {
    const relative = path.relative(root, file).replace(/\\/g, '/');
    for (const target of imports) {
      const dependency = path.relative(root, target).replace(/\\/g, '/');
      if (relative.startsWith('config/')) {
        assert.ok(dependency.startsWith('config/'), `配置不能反向依赖业务：${relative} → ${dependency}`);
      }
      if (relative.startsWith('utils/') && !relative.startsWith('utils/screens/') && relative !== 'utils/page-flow.js') {
        assert.ok(!/^(pages|components|utils\/screens)\//.test(dependency), `服务与流程内核不能依赖页面：${relative} → ${dependency}`);
      }
      if (relative.startsWith('utils/screens/result/')) {
        assert.ok(!/^(pages|components)\//.test(dependency) && (!dependency.startsWith('utils/screens/') || dependency.startsWith('utils/screens/result/')),
          `结果子模块不能反向依赖页面编排：${relative} → ${dependency}`);
      }
    }
    if (['utils/screens/quiz.js', 'utils/screens/result.js', 'utils/content-service.js'].includes(relative)) {
      assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /\.(?:getStorageSync|setStorageSync)\s*\(/, `当前结果缓存集中读写：${relative}`);
    }
  }
  assert.deepEqual(graph.get(path.join(root, 'utils/flow-runtime.js')), [], '流程内核通过参数接收业务规则');
  for (const module of ['scoring', 'pairing', 'public-result', 'content-validation', 'sharing', 'poster-renderer', 'pet-motion', 'pet-behavior']) {
    for (const file of visit(path.join(root, 'utils', `${module}.js`))) {
      assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /\bwx\s*\./, `${module} 的依赖必须可脱离微信运行`);
      assert.ok(!['friend-service', 'content-service', 'result-store', 'poster', 'privacy', 'cloud', 'navigation'].some(name => file === path.join(root, 'utils', `${name}.js`)), `${module} 不依赖平台服务`);
    }
  }
});

test('结果子模块的数据与事件无覆盖，组装后保持原来的页面接口', () => {
  const poster = require('../utils/screens/result/poster');
  const content = require('../utils/screens/result/content');
  const screen = require('../utils/screens/result');
  const fields = new Set(), events = new Set();
  for (const feature of [poster, content]) {
    for (const key of Object.keys(feature.data)) {
      assert.ok(!fields.has(key), `子模块状态冲突：${key}`);
      fields.add(key);
      assert.deepEqual(screen.data[key], feature.data[key]);
    }
    const methods = feature.create({ getPlatform() {}, getPoster() {}, contentService: {}, loadPair() {} });
    for (const key of Object.keys(methods)) {
      assert.ok(!events.has(key), `子模块事件冲突：${key}`);
      events.add(key);
      assert.equal(typeof screen[key], 'function');
    }
  }
});

test('排除的旧图片没有运行时引用，当前使用的图片仍被打包', () => {
  const project = require('../project.config.json');
  const excluded = ['AI.png', 'human.png', 'assets/quiz/ai-runner.png', 'assets/quiz/human-runner.png'];
  function sources(directory) {
    return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
      const relative = directory + '/' + entry.name;
      return entry.isDirectory() ? sources(relative) : /\.(js|json|wxml|wxss)$/.test(relative) && !relative.endsWith('.test.js') ? [relative] : [];
    });
  }
  const runtime = ['app.js', 'app.json', 'app.wxss', ...['config', 'utils', 'pages', 'components'].flatMap(sources)]
    .map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  for (const file of excluded) {
    assert.ok(fs.existsSync(path.join(root, file)), '原稿保留');
    assert.ok(!runtime.includes(file), `旧图片重新使用时需取消排除：${file}`);
    assert.ok(project.packOptions.ignore.some(rule => rule.type === 'file' && rule.value === file));
  }
  for (const file of [require('../config/assets').assistantStrip, require('../config/pet').image, '/assets/quiz/human-runner-cutout.png']) {
    assert.ok(!project.packOptions.ignore.some(rule => rule.type === 'file' ? rule.value === file.slice(1) : file.slice(1).startsWith(rule.value + '/')));
  }
});

test('根目录产品文档和待办不进入小程序包', () => {
  const project = require('../project.config.json');
  for (const file of ['aiti_prd.md', 'aiti_prd_brief.md', 'not_complate_list.txt']) {
    assert.ok(project.packOptions.ignore.some(rule => rule.type === 'file' && rule.value === file), `${file} 应排除打包`);
  }
});
