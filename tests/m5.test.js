const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { sharePayload } = require('../utils/sharing');
const { loadFriend } = require('../utils/friend-service');
const poster = require('../utils/poster');
const renderer = require('../utils/poster-renderer');
const { recordingContext } = require('./poster-recording');
const types = require('../config/types');
const assets = require('../config/assets');
const copy = require('../config/sharing');
const fixtures = require('./m1-fixtures.json');
const { calc } = require('../utils/scoring');
const root = path.join(__dirname, '..');
const cloudSettings = { mode: 'cloud', cloudEnvId: 'test', timeoutMs: 10 };
const flush = () => new Promise(resolve => setImmediate(resolve));
function pageHarness(page = 'result', options = {}) {
  const filename = path.join(root, `pages/${page}/${page}.js`);
  const calls = { routes: [], toasts: [], exports: 0, saves: 0, privacy: [], qualities: [] };
  let definition;
  const platform = {
    getStorageSync: () => ({ version: 1, answers: fixtures.types.TEM, requestId: 'test' }),
    reLaunch: arg => calls.routes.push(arg.url), showShareMenu() {},
    showToast: arg => calls.toasts.push(arg.title),
    onNeedPrivacyAuthorization: fn => { calls.privacyHandler = fn; },
    offNeedPrivacyAuthorization: fn => { assert.equal(fn, calls.privacyHandler); calls.offPrivacy = true; }
  };
  const localRequire = createRequire(filename);
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    Page: value => { definition = value; }, wx: platform, setTimeout, clearTimeout,
    require: name => {
      if (name === '../../utils/content-service') return { load: () => new Promise(() => {}) };
      if (name === '../../utils/poster') return {
        exportPoster: async (_platform, _page, _result, pairing, quality) => { calls.exports++; calls.qualities.push({ paired: !!pairing, quality }); if (options.exportError) throw Error('EXPORT'); return 'poster.png'; },
        saveToAlbum: async () => { calls.saves++; if (options.save) return options.save(); }
      };
      if (page === 'index' && name === '../../utils/friend-service') return { loadFriend: () => options.friend || Promise.resolve(null) };
      return localRequire(name);
    }
  }, { filename });
  const instance = { ...definition, data: JSON.parse(JSON.stringify(definition.data)),
    setData(update) { assert.ok(!this._disposed); Object.assign(this.data, update); } };
  return { instance, calls, platform };
}

test('M5：八类型分享标题、5:4 封面、真实 rid 路径及朋友圈 query', () => {
  for (const code of Object.keys(types)) {
    const result = calc(fixtures.types[code]), content = { code, rid: 'real_123-a', persisted: true };
    const friend = sharePayload(result, content), timeline = sharePayload(result, content, true);
    assert.equal(friend.path, '/pages/index/index?rid=real_123-a');
    assert.equal(friend.imageUrl, assets.share[code]);
    assert.equal(friend.title, code === 'TEM' ? copy.hiddenTitle : copy.ordinaryTitle.replace('{typeName}', types[code].name));
    assert.equal(timeline.title, friend.title); assert.equal(timeline.query, 'rid=real_123-a');
    assert.ok(!('path' in timeline));
  }
});
test('M5：本地/未落库/错误类型/恶意 rid 只分享普通邀请，不泄漏结果', () => {
  const result = calc(fixtures.types.TEM);
  for (const content of [null, {}, {code:'TEM',rid:'x',persisted:false}, {code:'TEA',rid:'x',persisted:true}, {code:'TEM',rid:'x&code=TEM',persisted:true}]) {
    const value = sharePayload(result, content);
    assert.equal(value.title, copy.genericTitle); assert.equal(value.path, '/pages/index/index?invite=1');
    assert.equal(value.imageUrl, assets.shareGeneric);
  }
});
test('M5：读取朋友只传 rid，过滤额外字段，无效/删除/断网/超时均降级', async () => {
  const result = calc(fixtures.types.TEA);
  const platform = { cloud: { callFunction: async args => {
    assert.deepEqual(args, { name: 'getResult', data: { rid: 'valid' } });
    return { result: { ...result, answers: fixtures.types.TEA, _openid: 'private' } };
  } } };
  assert.deepEqual(await loadFriend(platform, 'valid', cloudSettings), { code: result.code, scores: result.scores });
  for (const response of [null, {}, {code:'__proto__'}, {code:'TEM',scores:{rel:99,att:0,lead:0}}]) {
    assert.equal(await loadFriend({cloud:{callFunction:async()=>({result:response})}}, 'valid', cloudSettings), null);
  }
  assert.equal(await loadFriend({cloud:{callFunction:()=>{throw Error('NETWORK');}}}, 'valid', cloudSettings),null);
  assert.equal(await loadFriend({cloud:{callFunction:()=>new Promise(()=>{})}}, 'valid', cloudSettings),null);
  assert.equal(await loadFriend(platform,'bad&rid',cloudSettings),null);
  assert.equal(await loadFriend(platform,'valid',{mode:'mock'}),null);
});
test('M5：朋友圈入口绕开本地结果；普通结果页分享回调完整', () => {
  for (const query of [{rid:'friend'}, {rid:'bad&'}, {invite:'1'}]) {
    const {instance, calls, platform} = pageHarness();
    platform.getStorageSync = () => { throw Error('MUST_NOT_READ'); };
    instance.onLoad(query);
    assert.equal(instance.data.result,null); assert.equal(calls.routes.length,1);
    assert.equal(calls.routes[0], query.rid === 'friend' ? '/pages/index/index?rid=friend' : '/pages/index/index?invite=1');
  }
  const {instance} = pageHarness(); instance.onLoad();
  assert.equal(instance.onShareAppMessage().title,copy.genericTitle);
  assert.equal(instance.onShareTimeline().query,'invite=1'); instance.onUnload();
});
test('M5：首页展示朋友名称，读取失败不阻塞，卸载后不更新', async () => {
  const h = pageHarness('index',{friend:Promise.resolve({code:'TEA'})}); h.instance.onLoad({rid:'real'}); await flush();
  assert.equal(h.instance.data.friendMessage,copy.friendTitle.replace('{typeName}',types.TEA.name));
  const missing = pageHarness('index'); missing.instance.onLoad({rid:'missing'}); await flush();
  assert.equal(missing.instance.data.friendMessage,copy.friendUnavailable);
  let finish; const gone = pageHarness('index',{friend:new Promise(resolve=>{finish=resolve;})});
  gone.instance.onLoad({rid:'real'}); gone.instance.onUnload(); finish({code:'TEM'}); await flush();
  assert.equal(gone.instance.data.friendMessage,copy.friendLoading);
});
test('M5：朋友圈单页模式展示邀请提示，不调用路由或读取本机结果', () => {
  for (const page of ['result','index']) {
    const h=pageHarness(page); h.platform.getLaunchOptionsSync=()=>({scene:1154});
    h.platform.getStorageSync=()=>{throw Error('MUST_NOT_READ');};
    h.instance.onLoad({rid:'friend'});
    assert.equal(h.calls.routes.length,0);
    assert.equal(page==='result'?h.instance.data.invitation:h.instance.data.singlePage,true);
  }
});
test('M5：八张海报文字边界、金框角标、坐标正 y 向上及长文截断', () => {
  for (const code of Object.keys(types)) {
    const ctx = recordingContext(); renderer.drawPoster(ctx,calc(fixtures.types[code]));
    const text = ctx.operations.filter(op=>op.op==='text');
    for (const op of text) {
      assert.ok(op.x+op.width<=706,`${code} ${op.text} right`);
      assert.ok(op.y+op.size*1.45<=1302,`${code} ${op.text} bottom`);
      assert.ok(!op.text.endsWith('…'),`${code} configured copy truncated`);
    }
    for (let i=0;i<text.length;i++) for (let j=i+1;j<text.length;j++) {
      const a=text[i],b=text[j];
      const overlap=a.x<b.x+b.width && b.x<a.x+a.width && a.y<b.y+b.size*1.2 && b.y<a.y+a.size*1.2;
      assert.ok(!overlap,`${code}: ${a.text} / ${b.text}`);
    }
    const border=ctx.operations.find(op=>op.op==='stroke');
    assert.equal(border.thickness,code==='TEM'?6:2);
    if(code==='TEM') { assert.equal(border.color,'#8A691D'); assert.ok(text.some(op=>op.text==='隐藏款')); }
  }
  const ctx=recordingContext(); renderer.drawPoster(ctx,{code:'TEM',coords:{x:1,y:1}});
  const point=ctx.operations.filter(op=>op.op==='circle').at(-1); assert.equal(point.x,565); assert.equal(point.y,846);
  const lines=renderer.textBox(ctx,'长'.repeat(100),0,0,100,20,2);
  assert.equal(lines.length,2); assert.ok(lines[1].endsWith('…'));
});
test('M5：八张 750×1334 校样与九张 500×400 分享 PNG 资源齐全', () => {
  for(const code of Object.keys(types)) {
    const png=fs.readFileSync(path.join(root,'docs/poster-check',`${code}.png`));
    assert.equal(png.readUInt32BE(16),750); assert.equal(png.readUInt32BE(20),1334);
  }
  for(const value of [...Object.values(assets.share),assets.shareGeneric]) {
    const png=fs.readFileSync(path.join(root,value.slice(1)));
    assert.equal(png.readUInt32BE(16),500); assert.equal(png.readUInt32BE(20),400);
  }
});
test('M5：Canvas 节点替身验证导出参数，缺失节点/导出失败可捕获', async () => {
  const ctx=recordingContext(), canvas={getContext:()=>ctx};
  const platform={createSelectorQuery(){ return {in(){return this;},select(id){assert.equal(id,'#posterCanvas');return this;},fields(){return this;},exec(fn){fn([{node:canvas}]);}};},
    canvasToTempFilePath(args){assert.equal(args.canvas,canvas);assert.equal(args.destWidth,750);assert.equal(args.destHeight,1334);args.success({tempFilePath:'tmp.png'});} };
  assert.equal(await poster.exportPoster(platform,{},calc(fixtures.types.TEM)),'tmp.png');
  platform.canvasToTempFilePath=args=>args.fail(Error('EXPORT')); await assert.rejects(poster.exportPoster(platform,{},calc(fixtures.types.TEM)),/EXPORT/);
  platform.createSelectorQuery=()=>({in(){return this;},select(){return this;},fields(){return this;},exec(fn){fn([]);}});
  await assert.rejects(poster.exportPoster(platform,{},calc(fixtures.types.TEM)),/CANVAS_UNAVAILABLE/);
});
test('M5：插画与小程序码加载失败回退占位；页面退出后不继续申请相册', async () => {
  const oldPortrait=assets.types.TEM,oldCode=assets.miniProgramCode;
  try {
    assets.types.TEM='/missing.png';assets.miniProgramCode='/missing-code.png';
    const ctx=recordingContext(),canvas={getContext:()=>ctx,createImage(){return {set src(value){this.onerror();}};}};
    const platform={createSelectorQuery:()=>({in(){return this;},select(){return this;},fields(){return this;},exec(fn){fn([{node:canvas}]);}}),canvasToTempFilePath:args=>args.success({tempFilePath:'fallback.png'})};
    assert.equal(await poster.exportPoster(platform,{},calc(fixtures.types.TEM)),'fallback.png');
    assert.ok(!ctx.operations.some(op=>op.op==='image'));assert.ok(ctx.operations.some(op=>op.op==='circle'));
  } finally {assets.types.TEM=oldPortrait;assets.miniProgramCode=oldCode;}
  let settingsCalled=false;
  await assert.rejects(poster.saveToAlbum({requirePrivacyAuthorize:args=>args.success({}),getSetting:()=>{settingsCalled=true;}},'tmp.png',()=>false),/DISPOSED/);
  assert.equal(settingsCalled,false);
});

test('8K：按目标尺寸分配和绘制，检查实际输出尺寸并释放画布', async () => {
  const result = calc(fixtures.types.TEM);
  const pairing = require('../utils/pair-result').buildPair(result, calc(fixtures.types.PEM));
  for (const pair of [null, pairing]) {
    const ctx = recordingContext(), scales = [];
    ctx.scale = (x, y) => scales.push([x, y]);
    const canvas = { getContext: () => ctx };
    const platform = {
      createSelectorQuery: () => ({ in() { return this; }, select() { return this; }, fields() { return this; }, exec(fn) { fn([{ node: canvas }]); } }),
      canvasToTempFilePath(args) {
        assert.equal(canvas.width, 4318); assert.equal(canvas.height, 7680);
        assert.deepEqual(scales.at(-1), [4318 / 750, 7680 / 1334]);
        assert.equal(args.width, 4318); assert.equal(args.height, 7680);
        assert.equal(args.destWidth, 4318); assert.equal(args.destHeight, 7680);
        args.success({ tempFilePath: '8k.png' });
      },
      getImageInfo(args) { assert.equal(args.src, '8k.png'); args.success({ width: 4318, height: 7680 }); }
    };
    assert.equal(await poster.exportPoster(platform, {}, result, pair, '8k'), '8k.png');
    assert.equal(canvas.width, 1); assert.equal(canvas.height, 1);
    platform.getImageInfo = args => args.success({ width: 750, height: 1334 });
    await assert.rejects(poster.exportPoster(platform, {}, result, pair, '8k'), /EXPORT_SIZE/);
    assert.equal(canvas.width, 1); assert.equal(canvas.height, 1);
    platform.canvasToTempFilePath = args => args.fail(Error('MEMORY'));
    await assert.rejects(poster.exportPoster(platform, {}, result, pair, '8k'), /MEMORY/);
    assert.equal(canvas.width, 1); assert.equal(canvas.height, 1);
  }
});

test('8K：清晰度与单双人缓存隔离，生成期间禁止切换，失败提示可重试', async () => {
  const options = {}, h = pageHarness('result', options), page = h.instance;
  page.onLoad();
  const choose = quality => page.changePosterQuality({ currentTarget: { dataset: { quality } } });
  await page.savePoster();
  choose('8k'); await page.savePoster();
  choose('standard'); await page.savePoster();
  assert.equal(h.calls.exports, 2);
  page.data.pairing = require('../utils/pair-result').buildPair(page.data.result, calc(fixtures.types.PEM));
  await page.savePairPoster();
  choose('8k');
  const job = page.savePairPoster(); choose('standard');
  assert.equal(page.data.posterQuality, '8k'); await job;
  assert.deepEqual(h.calls.qualities, [{ paired: false, quality: 'standard' }, { paired: false, quality: '8k' }, { paired: true, quality: 'standard' }, { paired: true, quality: '8k' }]);
  choose('bad'); assert.equal(page.data.posterQuality, '8k');
  page._posterPath8k = ''; options.exportError = true;
  await page.savePoster(); assert.equal(h.calls.toasts.at(-1), copy.ultraFailed);
  assert.equal(page.data.savingPoster, false);
  options.exportError = false; await page.savePoster();
  assert.equal(h.calls.toasts.at(-1), copy.saved); page.onUnload();
});
test('M5：隐私先于相册保存；首次拒绝、历史拒绝、隐私拒绝均有明确结果', async () => {
  const calls=[];
  const platform={requirePrivacyAuthorize(args){calls.push('privacy');args.success({});},getSetting(args){calls.push('setting');args.success({authSetting:{}});},saveImageToPhotosAlbum(args){calls.push(args.filePath);args.success({});}};
  await poster.saveToAlbum(platform,'tmp.png'); assert.deepEqual(calls,['privacy','setting','tmp.png']);
  platform.saveImageToPhotosAlbum=args=>args.fail({errMsg:'saveImageToPhotosAlbum:fail auth deny'});
  await assert.rejects(poster.saveToAlbum(platform,'tmp.png'),/ALBUM_DENIED/);
  platform.getSetting=args=>args.success({authSetting:{'scope.writePhotosAlbum':false}});
  await assert.rejects(poster.saveToAlbum(platform,'tmp.png'),/ALBUM_DENIED/);
  platform.requirePrivacyAuthorize=args=>args.fail({}); await assert.rejects(poster.saveToAlbum(platform,'tmp.png'),/PRIVACY/);
});
test('M5：保存防连点、缓存海报，拒绝后设置引导、关闭、重试成功', async () => {
  const opts={save:()=>{throw Error('ALBUM_DENIED');}},h=pageHarness('result',opts); h.instance.onLoad();
  await Promise.all([h.instance.savePoster(),h.instance.savePoster()]);
  assert.equal(h.calls.exports,1);assert.equal(h.calls.saves,1);assert.equal(h.instance.data.albumDenied,true);
  h.instance.closeAlbumGuide();assert.equal(h.instance.data.albumDenied,false);
  await h.instance.savePoster();assert.equal(h.instance.data.albumDenied,true);assert.equal(h.calls.exports,1);
  h.instance.albumSettingsChanged({detail:{authSetting:{'scope.writePhotosAlbum':true}}});
  opts.save=()=>{};await h.instance.savePoster();assert.equal(h.calls.toasts.at(-1),copy.saved);assert.equal(h.instance.data.savingPoster,false);
  h.instance.onUnload();
});
test('M5：导出失败解锁可重试，卸载后不保存或更新 UI', async () => {
  const options={exportError:true},h=pageHarness('result',options);h.instance.onLoad();await h.instance.savePoster();
  assert.equal(h.instance.data.savingPoster,false);assert.equal(h.calls.toasts.at(-1),copy.failed);
  options.exportError=false;await h.instance.savePoster();assert.equal(h.calls.exports,2);h.instance.onUnload();
  const gone=pageHarness();gone.instance.onLoad();const job=gone.instance.savePoster();gone.instance.onUnload();await job;assert.equal(gone.calls.saves,0);
});
test('M5：隐私按钮显式同意/拒绝，离开页面释放待处理授权与监听', () => {
  const h=pageHarness();h.instance.onLoad();
  h.calls.privacyHandler(value=>h.calls.privacy.push(value));assert.equal(h.instance.data.privacyVisible,true);
  h.instance.agreePrivacy();assert.equal(h.calls.privacy[0].event,'agree');assert.equal(h.calls.privacy[0].buttonId,'poster-privacy-agree');
  h.calls.privacyHandler(value=>h.calls.privacy.push(value));h.instance.refusePrivacy();assert.equal(h.calls.privacy[1].event,'disagree');
  h.calls.privacyHandler(value=>h.calls.privacy.push(value));h.instance.onUnload();assert.equal(h.calls.privacy[2].event,'disagree');assert.equal(h.calls.offPrivacy,true);
});
