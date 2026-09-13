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
  for (const module of ['sharing', 'poster-renderer']) {
    for (const file of visit(path.join(root, 'utils', `${module}.js`))) {
      assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /\bwx\s*\./, `${module} 的依赖必须可脱离微信运行`);
      assert.ok(!['friend-service', 'content-service', 'poster', 'privacy', 'cloud', 'navigation'].some(name => file === path.join(root, 'utils', `${name}.js`)), `${module} 不依赖平台服务`);
    }
  }
});

test('根目录产品文档和待办不进入小程序包', () => {
  const project = require('../project.config.json');
  for (const file of ['aiti_prd.md', 'aiti_prd_brief.md', 'not_complate_list.txt']) {
    assert.ok(project.packOptions.ignore.some(rule => rule.type === 'file' && rule.value === file), `${file} 应排除打包`);
  }
});
