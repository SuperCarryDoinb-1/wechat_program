const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { createContentService } = require('../utils/content-service');
const fixtures = require('./m1-fixtures.json');
const copy = require('../config/copy');
const { audit } = require('./release-audit');
const root = path.join(__dirname, '..');
function page(name, wx, service) {
  const file = path.join(root, `utils/screens/${name}.js`), localRequire = createRequire(file);
  let definition; const tasks = new Map(); let sequence=0;
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    module: { set exports(value) { definition = value; } }, wx,
    require: name => name === '../../utils/content-service' ? service : localRequire(name),
    setTimeout: fn => { tasks.set(++sequence, fn); return sequence; }, clearTimeout: id => tasks.delete(id)
  });
  return { ...definition, data: JSON.parse(JSON.stringify(definition.data)),
    setData(value) { Object.assign(this.data, value); },
    tick() { const callbacks=[...tasks.values()]; tasks.clear(); callbacks.forEach(fn=>fn()); }
  };
}
test('M7：真实云配置下断网，12 题可完成，个人结果显示离线解读与网络提示', async () => {
  let record; const routes=[];
  const wx={getStorageSync:()=>record,setStorageSync:(_,value)=>{record=value;},pageScrollTo(){},redirectTo:args=>routes.push(args.url),
    cloud:{callFunction:async()=>{throw Error('NETWORK_OFFLINE');}}};
  const service=createContentService(wx,{mode:'cloud',cloudEnvId:'test'});
  const quiz=page('quiz',wx,service);quiz.onLoad();quiz.onShow();
  fixtures.types.TEA.forEach(option=>{quiz.selectOption({currentTarget:{dataset:{option,questionId:quiz.data.question.id}}});quiz.tick();});
  assert.equal(routes.at(-1),'/pages/result/result');assert.equal(record.answers.length,12);
  await service.load(record);
  const result=page('result',wx,service);result.onLoad();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(result.data.result.code,'TEA');assert.equal(result.data.content.source,'offline');
  assert.equal(result.data.content.tips.length,3);assert.equal(result.data.contentNote,copy.result.offlineNote);
  assert.equal(result.data.content.persisted,false);assert.equal(result.data.content.rid,'');
  result.onUnload();
});
test('M7：首页隐私入口打开官方指引，失败提示，不把不可用当已同意',()=>{
  const calls=[];const wx={openPrivacyContract:args=>{calls.push('open');args.fail();},showToast:args=>calls.push(args.title)};
  const home=page('index',wx,{});home.readPrivacy();assert.deepEqual(calls,['open',copy.home.privacyUnavailable]);
  delete wx.openPrivacyContract;home.readPrivacy();assert.equal(calls.at(-1),copy.home.privacyUnavailable);
});
test('M7：发布预检区分源码大小与真实包体，不把未联调的配置标为可提审',()=>{
  const result=audit();assert.deepEqual(result.banned,[]);assert.ok(result.sourceBytes<2*1024*1024);
  assert.ok(result.sizeMeaning.includes('非微信'));assert.equal(result.readyToSubmit,false);
  assert.equal(require('../config/env').showDiagnostics,false);
  const app=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8'));
  assert.equal(app.lazyCodeLoading,'requiredComponents');assert.ok(!('requiredPrivacyInfos' in app));
});
