const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { calc } = require('../utils/scoring');
const { pair } = require('../utils/pairing');
const { buildPair, loadPair } = require('../utils/pair-result');
const { sharePayload } = require('../utils/sharing');
const { createContentService } = require('../utils/content-service');
const { createHandler } = require('../cloudfunctions/genContent/handler');
const { createHandler: createReader } = require('../cloudfunctions/getResult/handler');
const { drawPairPoster } = require('../utils/poster-renderer');
const { recordingContext } = require('./poster-recording');
const fixtures = require('./m1-fixtures.json');
const types = require('../config/types');
const pairConfig = require('../config/pairing');
const settings = {mode:'cloud',cloudEnvId:'test',timeoutMs:20};
const root = path.join(__dirname,'..');
const flush = () => new Promise(resolve=>setImmediate(resolve));
function harness(relative, platform, overrides = {}) {
  const file = path.join(root,relative), local = createRequire(file); let definition;
  const timers = new Map(); let id=0;
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{
    require: name => Object.prototype.hasOwnProperty.call(overrides,name) ? overrides[name] : local(name),
    wx:platform,module: { set exports(value) { definition = value; } },Component:value=>{definition=value;},
    setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key)
  });
  return { ...definition, data:JSON.parse(JSON.stringify(definition.data)),
    setData(value, done){assert.ok(!this._disposed);Object.assign(this.data,value);if(done)done();},
    tick(){const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());}
  };
}
function cloudFixture() {
  const records = new Map(); let sequence=0,record=null,identity='A';
  const cloud={getWXContext:()=>({OPENID:identity}),database:()=>({serverDate:()=>1,collection:()=>({
    add:async({data})=>{const rid=`rid-${++sequence}`;records.set(rid,data);return {_id:rid};},
    doc:rid=>({get:async()=>{if(!records.has(rid))throw Error('MISSING');return {data:records.get(rid)};},
      update:async({data})=>records.set(rid,{...records.get(rid),...data})})
  })})};
  const generate=createHandler(cloud,{mode:'mock'}),read=createReader(cloud),calls=[];
  const platform={getStorageSync:()=>record,setStorageSync:(_,value)=>{record=value;},showToast(){},redirectTo:args=>calls.push(args.url),pageScrollTo(){},
    cloud:{callFunction:async args=>({result:await(args.name==='genContent'?generate(args.data):read(args.data))})}};
  return {records,platform,calls,setIdentity(value){identity=value;},get record(){return record;}};
}
test('M6：A 分享 → B 首页 → 12 题 → 云落库 → 双人卡 → C 邀请完整闭环（API/数据库替身）',async()=>{
  const db=cloudFixture(),service=createContentService(db.platform,settings);
  const a={...calc(fixtures.types.TEM),answers:fixtures.types.TEM,requestId:'A'};
  const aContent=await service.start(a); const invite=sharePayload(a,aContent); const rid=invite.path.split('rid=')[1];
  let carried;
  const home=harness('utils/screens/index.js',db.platform,{'../../utils/navigation':{quiz:(_,value)=>{carried=value;}},'../../utils/friend-service':{loadFriend:async()=>a}});
  home.onLoad({rid});home.openQuiz();assert.equal(carried,aContent.rid);
  db.setIdentity('B');
  const quiz=harness('utils/screens/quiz.js',db.platform,{'../../utils/content-service':service});quiz.onLoad({fromRid:carried});quiz.onShow();
  fixtures.types.TEA.forEach(option=>{quiz.selectOption({currentTarget:{dataset:{option,questionId:quiz.data.question.id}}});quiz.tick();});
  assert.equal(db.record.fromRid,aContent.rid);assert.equal(db.calls.at(-1),'/pages/result/result');
  const bContent=await service.load(db.record);assert.equal(bContent.pairCode,'TEM');
  assert.equal(db.records.get(bContent.rid).fromRid,aContent.rid);assert.equal(db.records.get(bContent.rid)._openid,'B');
  const result=harness('utils/screens/result.js',db.platform,{'../../utils/content-service':service,'../../utils/pair-result':{loadPair:(p,r,c)=>loadPair(p,r,c,settings)}});
  result.onLoad();await flush();assert.equal(result.data.pairing.name,'主仆关系');assert.equal(result.data.pairing.friendCode,'TEM');
  const next=result.onShareAppMessage();assert.ok(next.title.includes('主仆关系'));assert.equal(next.path,`/pages/index/index?rid=${bContent.rid}`);
  assert.notEqual(bContent.rid,aContent.rid);
  result.restart();assert.equal(db.calls.at(-1),`/pages/quiz/quiz?fromRid=${aContent.rid}`);
  result.onUnload();
});
test('M6：非法与无邀请不会残留上次 fromRid；首页读取未完成也能携带合法邀请',()=>{
  const db=cloudFixture();const page=harness('utils/screens/quiz.js',db.platform,{'../../utils/content-service':{start:async()=>({})}});
  page.onLoad({fromRid:'old'});assert.equal(page._fromRid,'old');page.onLoad();assert.equal(page._fromRid,'');
  page.onLoad({fromRid:'bad&value'});assert.equal(page._fromRid,'');
  let rid;const home=harness('utils/screens/index.js',db.platform,{'../../utils/navigation':{quiz:(_,value)=>{rid=value;}},'../../utils/friend-service':{loadFriend:()=>new Promise(()=>{})}});
  home.onLoad({rid:'valid'});home.openQuiz();assert.equal(rid,'valid');
});
test('M6：全部 64 组合，四档与四个特配正确且不泄漏答案',()=>{
  const levels=new Set(),specials=new Set();
  for(const a of Object.keys(types))for(const b of Object.keys(types)){
    const result=buildPair(calc(fixtures.types[a]),{...calc(fixtures.types[b]),answers:['private'],_openid:'private'});
    assert.equal(result.name,pair(a,b).name);assert.equal(result.text,pair(a,b).text);levels.add(result.level);
    if(pairConfig.specials.some(value=>value.name===result.name))specials.add(result.name);
    assert.ok(!JSON.stringify(result).includes('private'));assert.deepEqual(result.friendCoords,calc(fixtures.types[b]).coords);
  }
  assert.equal(levels.size,4);assert.equal(specials.size,4);assert.equal(buildPair({},{}),null);
});
test('M6：失效/删除/类型不一致/本地模拟/断网均降级，不伪造双人卡',async()=>{
  const db=cloudFixture(),record={...calc(fixtures.types.TEA),fromRid:'gone'},content={persisted:true,rid:'own',pairCode:'TEM'};
  assert.equal(await loadPair(db.platform,record,content,settings),null);
  db.records.set('gone',calc(fixtures.types.PGA));assert.equal(await loadPair(db.platform,record,content,settings),null);
  assert.equal(await loadPair(db.platform,record,{...content,persisted:false},settings),null);
  assert.equal(await loadPair(db.platform,record,content,{mode:'mock'}),null);
  assert.equal(await loadPair({cloud:{callFunction:async()=>{throw Error('OFFLINE');}}},record,content,settings),null);
  const page=harness('utils/screens/result.js',{...db.platform,getStorageSync:()=>({version:1,answers:fixtures.types.TEA,fromRid:'gone',requestId:'B'})},{'../../utils/content-service':{load:async()=>content},'../../utils/pair-result':{loadPair:async()=>null}});
  page.onLoad();await flush();assert.equal(page.data.pairing,null);assert.ok(page.data.result);assert.ok(page.data.pairNote);assert.equal(page.data.pairLoading,false);
  assert.ok(!page.onShareAppMessage().title.includes('配不配'));page.onUnload();
});
test('M6：配对请求晚到且页面退出，不写入 UI',async()=>{
  let finish;const db=cloudFixture();const page=harness('utils/screens/result.js',{...db.platform,getStorageSync:()=>({version:1,answers:fixtures.types.TEA,fromRid:'valid',requestId:'B'})},{'../../utils/content-service':{load:async()=>({})},'../../utils/pair-result':{loadPair:()=>new Promise(resolve=>{finish=resolve;})}});
  page.onLoad();await flush();page.onUnload();finish(buildPair(calc(fixtures.types.TEA),calc(fixtures.types.TEM)));await flush();assert.equal(page.data.pairing,null);
});
test('M6：双点连线四角、相同坐标圆环、非法坐标降级',()=>{
  const map=harness('components/quadrant-map/quadrant-map.js',{});const update=(a,b)=>map.observers['coords, friendCoords'].call(map,a,b);
  update({x:-1,y:1},{x:1,y:-1});assert.equal(map.data.friendLeft,100);assert.equal(map.data.friendTop,100);
  assert.equal(map.data.connection[0].left,0);assert.equal(map.data.connection.at(-1).top,100);
  update({x:0,y:0},{x:0,y:0});assert.equal(map.data.samePoint,true);assert.equal(map.data.connection.length,0);assert.equal(map.data.friendValid,true);
  update({x:0,y:0},{x:NaN,y:0});assert.equal(map.data.friendValid,false);
});
test('M6：64 种双人海报文字不截断、无重叠，包含朋友与自己坐标',()=>{
  for(const a of Object.keys(types))for(const b of Object.keys(types)){
    const ctx=recordingContext(),own=calc(fixtures.types[a]);drawPairPoster(ctx,own,buildPair(own,calc(fixtures.types[b])));
    const text=ctx.operations.filter(value=>value.op==='text');
    for(const op of text){assert.ok(op.x+op.width<=706,`${a}/${b} right`);assert.ok(op.y+op.size*1.45<=1302);assert.ok(!op.text.endsWith('…'));}
    for(let i=0;i<text.length;i++)for(let j=i+1;j<text.length;j++){
      const x=text[i],y=text[j];assert.ok(!(x.x<y.x+y.width&&y.x<x.x+x.width&&x.y<y.y+y.size*1.2&&y.y<x.y+x.size*1.2),`${a}/${b}: ${x.text}/${y.text}`);
    }
    assert.ok(text.some(value=>value.text===pair(a,b).name)||pair(a,b).name.length>15);
    const points=ctx.operations.filter(value=>value.op==='circle');assert.equal(points.at(-1).r,7);assert.equal(points.at(-3).r,15);
  }
});
test('M6：双人/个人海报缓存隔离，保存共用防连点与相册引导',async()=>{
  const db=cloudFixture(),own=calc(fixtures.types.TEA);let exports=[],saves=[];
  const page=harness('utils/screens/result.js',db.platform,{'../../utils/poster':{exportPoster:async(p,pg,r,pairing)=>{exports.push(!!pairing);return pairing?'pair.png':'own.png';},saveToAlbum:async(p,file)=>{saves.push(file);}}});
  page.data.result=own;page.data.pairing=buildPair(own,calc(fixtures.types.TEM));
  await Promise.all([page.savePairPoster(),page.savePoster()]);assert.deepEqual(exports,[true]);
  await page.savePoster();await page.savePairPoster();assert.deepEqual(exports,[true,false]);assert.deepEqual(saves,['pair.png','own.png','pair.png']);
});
