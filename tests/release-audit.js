// 只读取当前项目的明确目录；拒绝符号链接，不读取父目录或生成包外文件。
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const env = require('../config/env');
const assets = require('../config/assets');
function filesUnder(relative) {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep)) throw Error('OUTSIDE_PROJECT');
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) throw Error(`LINK_NOT_ALLOWED: ${relative}`);
  return stat.isDirectory() ? fs.readdirSync(absolute).flatMap(name => filesUnder(path.join(relative, name))) : [relative];
}
function audit() {
  const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
  // 根目录新增的 PRD 等文件也必须纳入检查，避免白名单统计掩盖漏排除的文档。
  const rootFiles = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isFile() && !entry.name.startsWith('.') && !['project.config.json', 'project.private.config.json'].includes(entry.name))
    .map(entry => entry.name);
  const candidates = [...rootFiles, ...['pages','components','config','utils','assets'].flatMap(filesUnder)];
  const files = candidates.filter(file => !project.packOptions.ignore.some(rule => {
    const value = file.replace(/\\/g, '/');
    return rule.type === 'file' ? value === rule.value : rule.type === 'folder' && (value === rule.value || value.startsWith(rule.value + '/'));
  }));
  const bytes = files.reduce((total, file) => total + fs.statSync(path.join(root, file)).size, 0);
  const source = ['copy','questions','types','pairing','pair-view','sharing','poster','quiz'].map(name => JSON.stringify(require(`../config/${name}`))).join('\n');
  const banned = ['人格测试','心理测试','性格诊断','宗教战争'].filter(word => source.includes(word));
  const missing = [!assets.hero && '首页插画', ...Object.keys(assets.types).filter(code => !assets.types[code]).map(code => `类型插画 ${code}`),
    ...assets.questions.map((value,index) => !value && `题图 Q${index+1}`).filter(Boolean), !assets.miniProgramCode && '真实小程序码'].filter(Boolean);
  const blockers = [];
  if (env.mode !== 'cloud' || !env.cloudEnvId) blockers.push('真实云环境尚未配置');
  if (env.showDiagnostics) blockers.push('开发诊断开关仍开启');
  if (bytes > 2 * 1024 * 1024) blockers.push('候选源码及资源合计超过项目 2 MiB 目标');
  if (banned.length) blockers.push('发现禁止的对外词汇');
  blockers.push('真实模型、微信编译、两账号回流、六轮真机与首屏耗时尚需人工验收', '隐私指引、实际类目与 AI 上线材料尚需账号后台确认');
  return { candidateFiles: files.length, sourceBytes: bytes, sourceKiB: Number((bytes / 1024).toFixed(2)),
    sizeMeaning: '按当前 ignore 规则统计候选源码及资源，非微信实际编译包体', banned, missing,
    placeholderCovers: Object.keys(assets.share).length + 1, blockers, readyToSubmit: false };
}
module.exports = { audit };
if (require.main === module) {
  console.log(JSON.stringify(audit(), null, 2));
  // 预检结果留在当前项目；非发布操作，也不把尚未完成的人工验收标为通过。
  fs.writeFileSync(path.join(root, 'docs/release-audit.json'), JSON.stringify(audit(), null, 2) + '\n');
}
