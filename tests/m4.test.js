const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');
const { createHandler } = require('../cloudfunctions/genContent/handler');
const { createHandler: createReader } = require('../cloudfunctions/getResult/handler');
const { createProvider } = require('../cloudfunctions/genContent/provider');
const { createContentService } = require('../utils/content-service');
const { validateContent, parseContent } = require('../utils/content-validation');
const { calc } = require('../utils/scoring');
const types = require('../config/types');
const copy = require('../config/copy');
const fixtures = require('./m1-fixtures.json');
const quizConfig = require('../config/quiz');
const clone = value => JSON.parse(JSON.stringify(value));
const good = { roast: '提示词一发，待办清单就先松了口气。', tips: ['核查关键数据。', '保留自己的判断。', '尝试把任务拆成小步。'] };
const event = code => ({ code, answers: fixtures.types[code].slice() });

function database() {
  const records = new Map();
  const state = { writeFails: false, updateFails: false, openid: 'private-openid', reads: 0 };
  let id = 0;
  const cloud = {
    getWXContext: () => ({ OPENID: state.openid }),
    database: () => ({ serverDate: () => 123456, collection(name) {
      assert.equal(name, 'results');
      return {
        async add({data}) { if (state.writeFails) throw Error('DB'); const rid = `result-${++id}`; records.set(rid, clone(data)); return {_id:rid}; },
        doc(rid) { return {
          async update({data}) { if (state.updateFails) throw Error('DB'); records.set(rid, {...records.get(rid),...clone(data)}); },
          async get() { state.reads++; if (!records.has(rid)) throw Error('NOT_FOUND'); return {data:clone(records.get(rid))}; }
        }; }
      };
    } })
  };
  return {cloud, records, state};
}

function frontend(call) {
  const state = {record:null, requests:0, writeFails:false};
  const tasks = new Map(); let sequence=0;
  const platform = {
    getStorageSync: () => state.record,
    setStorageSync(key,value) { assert.equal(key,quizConfig.resultStorageKey); if(state.writeFails)throw Error('FULL'); state.record=value; },
    cloud: { async callFunction(args) { state.requests++; assert.equal(args.name,'genContent'); return call(args.data); } }
  };
  const timers = { setTimeout(fn,ms) { assert.equal(ms,8000); const id=++sequence; tasks.set(id,fn); return id; }, clearTimeout(id) {tasks.delete(id);} };
  const service = createContentService(platform, {mode:'cloud',cloudEnvId:'test-env'}, timers);
  const record = (code='TEM', requestId='request-1') => ({version:1,requestId,...event(code),...calc(fixtures.types[code])});
  return {service,platform,state,tasks,record,timeout() {const fns=[...tasks.values()]; tasks.clear(); fns.forEach(fn=>fn());}};
}

test('M4：无密钥云端 mock，三次测评产生三条记录并可公开查询', async () => {
  const db=database();
  const generate=createHandler(db.cloud,createProvider(db.cloud,{}));
  const read=createReader(db.cloud);
  const ids=[];
  for(const code of ['TEM','TEA','PEM']) {
    const result=await generate(event(code)); ids.push(result.rid);
    assert.equal(result.ok,true); assert.equal(result.source,'mock');
    assert.equal(result.roast,types[code].roastFallback);
    assert.equal(db.records.get(result.rid)._openid,'private-openid');
    assert.deepEqual(await read({rid:result.rid}), {code,scores:calc(fixtures.types[code]).scores});
  }
  assert.equal(new Set(ids).size,3); assert.equal(db.records.size,3);
});

test('M4：非法答案、伪造类型、无可信身份均不落库不调用模型', async () => {
  const db=database(); let calls=0;
  const generate=createHandler(db.cloud,{mode:'model',generate:async()=>{calls++;return JSON.stringify(good);}});
  for(const value of [null,{}, {code:'TEM',answers:[]}, {...event('TEA'),code:'TEM'}]) assert.equal((await generate(value)).error,'INVALID_INPUT');
  db.state.openid=''; assert.equal((await generate({...event('TEM'),_openid:'forged'})).error,'UNAUTHENTICATED');
  assert.equal(calls,0);assert.equal(db.records.size,0);
});

test('M4：有效模型输出入库；提示词不含身份、rid 或客户端额外字段', async () => {
  const db=database(); let captured;
  const generate=createHandler(db.cloud,{mode:'model',generate:async messages=>{captured=messages;return JSON.stringify(good);}});
  const result=await generate({...event('TEM'),fromRid:'private-invite',name:'private-name',prompt:'injected-prompt'});
  assert.equal(result.source,'model'); assert.deepEqual(result.tips,good.tips);
  assert.equal(db.records.get(result.rid).roast,good.roast);
  const prompt=JSON.stringify(captured);
  ['private-openid','private-invite','private-name','injected-prompt'].forEach(text=>assert.ok(!prompt.includes(text)));
  assert.ok(prompt.includes(types.TEM.name)); assert.equal(captured.length,2);
});

test('M4：非法 JSON、超长、敏感词、错误建议数量最多重试一次并兜底', async () => {
  const bad = [
    'not json', '```json\n'+JSON.stringify(good)+'\n```',
    JSON.stringify({...good,roast:'字'.repeat(61)}),
    JSON.stringify({...good,roast:'废\u200b 物'}),
    JSON.stringify({...good,tips:['一条']}),
    JSON.stringify({...good,tips:['去死','第二条','第三条']}),
    JSON.stringify({...good,roast:'你是一个好帮手'}), ' '.repeat(5000)
  ];
  for(const output of bad){
    const db=database();let calls=0;
    const generate=createHandler(db.cloud,{mode:'model',generate:async()=>{calls++;return output;}});
    const result=await generate(event('TEM'));
    assert.equal(result.source,'fallback');assert.equal(calls,2);
    assert.equal(result.roast,types.TEM.roastFallback);
    assert.equal(db.records.get(result.rid).source,'fallback');
  }
  const db=database();let attempts=0;
  const retry=createHandler(db.cloud,{mode:'model',generate:async()=>++attempts===1?'bad':JSON.stringify(good)});
  assert.equal((await retry(event('TEM'))).source,'model');assert.equal(attempts,2);
});

test('M4：模型拒绝/卡住有截止；数据库故障不伪报真实生成', async () => {
  for(const work of [async()=>{throw Error('MODEL');},()=>new Promise(()=>{})]){
    const db=database();
    const generate=createHandler(db.cloud,{mode:'model',generate:work},{attemptTimeoutMs:5});
    const result=await generate(event('TEM'));
    assert.equal(result.source,'fallback');assert.equal(db.records.size,1);
  }
  const db=database();let calls=0;
  const generate=createHandler(db.cloud,{mode:'model',generate:async()=>{calls++;return JSON.stringify(good);}});
  db.state.writeFails=true;
  assert.equal((await generate(event('TEM'))).error,'DATABASE_WRITE_FAILED');assert.equal(calls,0);
  db.state.writeFails=false;db.state.updateFails=true;
  const result=await generate(event('TEM'));assert.equal(result.source,'fallback');
  assert.equal(result.roast,db.records.get(result.rid).roast);
});

test('M4：getResult 只回白名单，非法/缺失 rid 与健康检查记录安全降级', async () => {
  const db=database();const read=createReader(db.cloud);
  db.records.set('private',{...calc(fixtures.types.TEM), answers:fixtures.types.TEM,roast:'private',tips:['private'],_openid:'private',extra:'private'});
  assert.deepEqual(Object.keys(await read({rid:'private'})).sort(),['code','scores']);
  for(const rid of [undefined,'','../private',{},'x'.repeat(129),'missing']) assert.equal(await read({rid}),null);
  db.records.set('m0-healthcheck',{kind:'m0-healthcheck',ok:true});
  assert.equal(await read({rid:'m0-healthcheck'}),null);
});

test('M4：fromRid 只解析对方代码，不泄露其答案；失效邀请不阻塞生成', async () => {
  const db=database();const generate=createHandler(db.cloud,{mode:'mock'});
  const a=await generate(event('TEA'));
  const b=await generate({...event('TEM'),fromRid:a.rid});
  assert.equal(b.pairCode,'TEA');assert.ok(!('answers' in b));assert.ok(!('_openid' in b));
  for(const fromRid of ['missing','../../x']) assert.equal((await generate({...event('TEM'),fromRid})).ok,true);
});

test('M4：本地模拟不请求云、不伪造 rid；所有类型兜底都通过校验', async () => {
  assert.equal(createProvider({}, {AITI_AI_PROVIDER:'compatible'}).mode, 'mock');
  const h=frontend(()=>{throw Error('不应调用');});
  const service=createContentService(h.platform,{mode:'mock'});
  for(const [code,type] of Object.entries(types)){
    const record=h.record(code,code);h.state.record=record;
    assert.ok(validateContent({roast:type.roastFallback,tips:type.tipsFallback}));
    const result=await service.start(record);
    assert.equal(result.source,'mock');assert.equal(result.rid,'');assert.equal(result.persisted,false);
  }
  assert.equal(h.state.requests,0);
  assert.equal(parseContent(JSON.stringify({...good,tips:[null,'2','3']})),null);
});

test('M4：前端到云函数完整闭环，复用请求及缓存，不重复提交', async () => {
  const db=database();const generate=createHandler(db.cloud,{mode:'mock'});
  const h=frontend(async data=>({result:await generate(data)}));
  const record=h.record();h.state.record=record;
  const one=h.service.start(record),two=h.service.load(record);
  assert.equal(one,two);
  const result=await one;
  assert.equal(result.persisted,true);assert.ok(result.rid);
  assert.equal(h.state.record.content.rid,result.rid);
  assert.deepEqual(await h.service.load(h.state.record),result);
  h.state.record = record;
  await h.service.start(record);
  assert.equal(h.state.record.content.rid, result.rid);
  assert.equal(h.state.requests,1);assert.equal(db.records.size,1);
  assert.equal(h.tasks.size,0);
});

test('M4：前端八秒兜底，迟到结果不覆盖；旧请求不覆盖新一轮缓存', async () => {
  let resolve;
  const h=frontend(()=>new Promise(done=>{resolve=done;}));
  const record=h.record();h.state.record=record;
  const pending=h.service.start(record);await Promise.resolve();h.timeout();
  const result=await pending;assert.equal(result.source,'offline');
  resolve({result:{ok:true,rid:'late',...good,source:'model'}});await Promise.resolve();
  assert.equal(h.state.record.content.source,'offline');
  let finishOld;
  const other=frontend(()=>new Promise(done=>{finishOld=done;}));
  const old=other.record();other.state.record=old;
  const job=other.service.start(old);await Promise.resolve();
  other.state.record=other.record('TEA','request-new');
  finishOld({result:{ok:true,rid:'old',...good,source:'model'}});await job;
  assert.equal(other.state.record.requestId,'request-new');assert.equal(other.state.record.content,undefined);
});

test('M4：前端拒绝畸形云返回，断网及缓存写入失败仍显示内容', async () => {
  for(const response of [null,{result:{ok:false}},{result:{ok:true,rid:'ok',...good,source:'unknown'}},
    {result:{ok:true,rid:'ok',...good,roast:'废物',source:'model'}}]){
    const h=frontend(async()=>response);const record=h.record();h.state.record=record;
    assert.equal((await h.service.start(record)).source,'offline');
  }
  const h=frontend(async()=>({result:{ok:true,rid:'valid',...good,source:'model'}}));
  const record=h.record();h.state.record=record;h.state.writeFails=true;
  assert.equal((await h.service.start(record)).source,'model');
  const down=frontend(async()=>{throw Error('OFFLINE');});const local=down.record();down.state.record=local;
  assert.equal((await down.service.start(local)).source,'offline');
});

test('M4：CloudBase 模型适配器按官方接口调用，缺配置或 SDK 能力失败', async () => {
  let input;
  const provider=createProvider({ai:()=>({createModel(group){assert.equal(group,'cloudbase');return {async generateText(args){input=args;return {text:JSON.stringify(good)};}};}})},
    {AITI_AI_PROVIDER:'cloudbase',AITI_AI_MODEL:'configured-model'});
  assert.equal(await provider.generate([{role:'user',content:'safe'}]),JSON.stringify(good));
  assert.equal(input.model,'configured-model');
  await assert.rejects(createProvider({}, {AITI_AI_PROVIDER:'cloudbase',AITI_AI_MODEL:'model'}).generate([]));
  await assert.rejects(createProvider({}, {AITI_AI_PROVIDER:'compatible',AITI_AI_KEY:'test-key'}).generate([]));
});

test('M4：兼容 API 使用 HTTPS/服务端密钥，校验状态、截断及响应结构', async () => {
  function transport(status,payload){return (url,options,callback)=>{
    assert.equal(url.protocol,'https:');assert.equal(options.headers.Authorization,'Bearer server-test-key');
    const req=new EventEmitter();
    req.destroy=error=>req.emit('error',error);
    req.end=body=>queueMicrotask(()=>{
      assert.equal(JSON.parse(body).response_format.type,'json_object');
      const res=new EventEmitter();res.statusCode=status;res.resume=()=>{};res.setEncoding=()=>{};
      callback(res);res.emit('data',payload);res.emit('end');
    });return req;
  };}
  const env={AITI_AI_PROVIDER:'compatible',AITI_AI_MODEL:'configured-model',AITI_AI_KEY:'server-test-key'};
  const body=JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(good)}}]});
  assert.equal(await createProvider({},env,transport(200,body)).generate([]),JSON.stringify(good));
  for(const [status,body] of [[401,'{}'],[200,'not json'],[200,JSON.stringify({choices:[{finish_reason:'length'}]})]])
    await assert.rejects(createProvider({},env,transport(status,body)).generate([]));
  await assert.rejects(createProvider({}, {...env,AITI_AI_ENDPOINT:'http://invalid'},transport(200,body)).generate([]));
});

test('M4：结果页面结束骨架并标记来源，卸载后不更新，失败使用预设', async () => {
  for(const scenario of ['success','unloaded','failure']){
    let definition,resolve,reject;
    const filename=path.join(__dirname,'../pages/result/result.js');const localRequire=createRequire(filename);
    const job=new Promise((yes,no)=>{resolve=yes;reject=no;});
    const record={version:1,requestId:'page-id',...event('TEM')};
    vm.runInNewContext(fs.readFileSync(filename,'utf8'),{
      Page(value){definition=value;},require(name){return name==='../../utils/content-service'?{load:()=>job}:localRequire(name);},
      wx:{getStorageSync:()=>record},setTimeout,clearTimeout
    });
    const page={...definition,data:clone(definition.data),setData(update){assert.ok(!this._disposed);Object.assign(this.data,clone(update));}};
    page.onLoad();assert.equal(page.data.contentLoading,true);
    if(scenario==='unloaded')page.onUnload();
    if(scenario==='failure')reject(Error('FAILED'));else resolve({...good,source:'model'});
    await Promise.resolve();await Promise.resolve();
    if(scenario==='unloaded')assert.equal(page.data.contentLoading,true);
    else {assert.equal(page.data.contentLoading,false);assert.equal(page.data.contentLabel,copy.result.contentLabels[scenario==='failure'?'fallback':'model']);}
  }
});

test('M4：部署副本与源文件一致，模型提示词及提供商代码仅在云函数目录', () => {
  const root=path.join(__dirname,'..');
  for(const name of ['genContent','getResult']){
    for(const directory of ['config','utils']){
      const base=path.join(root,'cloudfunctions',name,'shared',directory);
      for(const file of fs.readdirSync(base))assert.equal(fs.readFileSync(path.join(base,file),'utf8'),fs.readFileSync(path.join(root,directory,file),'utf8'));
    }
  }
  assert.ok(!fs.readFileSync(path.join(root,'config/env.js'),'utf8').includes('AITI_AI_KEY'));
  const project=JSON.parse(fs.readFileSync(path.join(root,'project.config.json'),'utf8'));
  assert.ok(project.packOptions.ignore.some(item=>item.value==='cloudfunctions'&&item.type==='folder'));
});
