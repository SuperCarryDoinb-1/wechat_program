// 云函数上传目录彼此隔离，复制明确列出的配置与纯逻辑，不访问项目之外的路径。
// 修改题库、类型或过滤规则后，部署前运行 node tests/sync-cloud.js。
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = {
  genContent: ['config/questions.js', 'config/types.js', 'config/rarity.js', 'config/content.js', 'config/blocklist.js',
    'utils/scoring.js', 'utils/content-validation.js', 'utils/public-result.js'],
  getResult: ['config/types.js', 'utils/public-result.js']
};
for (const [name, sources] of Object.entries(files)) {
  for (const source of sources) {
    const from = path.join(root, source);
    const to = path.join(root, 'cloudfunctions', name, 'shared', source);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}
console.log('Cloud function shared files synchronized.');
