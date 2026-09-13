const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const fonts = [
  { id: 'bungee', name: 'Bungee', weight: 400, tag: '首推 · 趣味招牌', color: '#C9B6FF',
    reason: '厚实字块与利落转角，能接住页面的粗描边和卡通角色。四个字母就有醒目的招牌感。',
    tradeoff: '个性最强，整体会更活泼。', author: 'David Jonathan Ross', source: 'https://djr.com/bungee' },
  { id: 'archivoblack', name: 'Archivo Black', weight: 400, tag: '稳重 · 厚实醒目', color: '#FFE17D',
    reason: '笔画扎实、轮廓直接，和黑色边框、黄色按钮容易形成统一的视觉重量。',
    tradeoff: '更克制，卡通感稍弱。', author: 'Héctor Gatti / Omnibus-Type', source: 'https://www.omnibus-type.com/fonts/archivo-black/' },
  { id: 'unbounded', name: 'Unbounded', weight: 800, tag: '科技 · 宽体未来感', color: '#A8C7FA',
    reason: '宽体几何字形让 AITI 更像一个 AI 产品标识，与蓝色主视觉很合拍。',
    tradeoff: '横向占位较大，建议观察 320px 小屏。', author: 'NaN / Polkadot', source: 'https://unbounded.polkadot.network/' },
  { id: 'outfit', name: 'Outfit', weight: 900, tag: '简洁 · 几何品牌感', color: '#BCE8CC',
    reason: '简洁几何结构带来清爽、亲近的感觉，适合想让图标承担更多趣味的首页。',
    tradeoff: '易融入页面，但字形个性较温和。', author: 'Outfit', source: 'https://github.com/Outfitio/Outfit-Fonts' },
  { id: 'fredoka', name: 'Fredoka', weight: 600, tag: '可爱 · 圆润卡通感', color: '#FFD1BC',
    reason: '圆润笔画像软糖，与新加入的四个卡通图标形成呼应，娱乐测评的轻松感更明显。',
    tradeoff: '最偏可爱，科技感相对较弱。', author: 'Milena Brandão / Hafontia', source: 'https://github.com/hafontia-zz/Fredoka-One' }
];
const escaped = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const faces = fonts.map(font => `@font-face{font-family:'Study-${font.id}';font-style:normal;font-weight:${font.weight};font-display:block;src:url(data:font/ttf;base64,${fs.readFileSync(path.join(root, 'docs/font-study', font.id + '.ttf')).toString('base64')})}`).join('\n');
const ui = fs.readFileSync(path.join(root, 'docs/ui-preview.html'), 'utf8');
const match = ui.match(/const screens=([\s\S]*?);const el=/);
if (!match) throw new Error('Generate docs/ui-preview.html first');
let home = JSON.parse(match[1]).index[0];
home = home.replace(/src="\.\.\/assets\/([^"]+)"/g, (_, name) => {
  const assetPath = path.resolve(root, 'assets', name);
  if (!assetPath.startsWith(path.join(root, 'assets') + path.sep)) throw new Error('Invalid asset path');
  return `src="data:image/png;base64,${fs.readFileSync(assetPath).toString('base64')}"`;
});
const cards = fonts.map((font, i) => `<article class="font-card" style="--accent:${font.color}">
  <button class="font-pick" type="button" data-font="${font.id}" aria-pressed="${i === 0}" aria-label="预览 ${font.name}">
    <span class="card-top"><span class="number">0${i + 1}</span><span class="tag">${font.tag}</span><span class="selection-mark" aria-hidden="true">✓</span></span>
    <span class="wordmark" style="font-family:Study-${font.id};font-weight:${font.weight}">AITI</span>
    <span class="font-title">${font.name}</span><span class="weight">${font.weight} 字重</span>
    <span class="reason">${font.reason}</span><span class="tradeoff">${font.tradeoff}</span>
  </button>
  <div class="source-row"><span>${font.author}</span><a href="${font.source}" target="_blank" rel="noopener noreferrer">官方来源 ↗</a></div>
</article>`).join('\n');
const licenses = fonts.map(font => `<details><summary>${font.name} · SIL OFL 1.1</summary><pre>${escaped(fs.readFileSync(path.join(root, 'docs/font-study', font.id + '-OFL.txt'), 'utf8'))}</pre></details>`).join('\n');
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AITI 字体选择 · 5 款真实字体对比</title>
<style>${faces}
:root{--ink:#202020;--paper:#FFF4DA;--violet:#C9B6FF;--logo-size:46px;--tracking:-1px}
*{box-sizing:border-box}body{margin:0;background:#F7F3EA;color:var(--ink);font:14px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif}
button,input,select{font:inherit}button,a,input,select{touch-action:manipulation}button{color:inherit;cursor:pointer}a{color:inherit;text-underline-offset:4px}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #6850B5;outline-offset:4px}
.wrap{max-width:1400px;margin:auto;padding:40px 40px 30px}.masthead{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid var(--ink);padding-bottom:18px;gap:16px}.masthead strong{font-size:16px;letter-spacing:2px}.edition{color:#666;font-size:12px}
.intro{padding:32px 0 24px}.eyebrow{font-size:12px;font-weight:700;letter-spacing:2px;color:#666;margin:0 0 10px}h1{font-size:clamp(28px,3.2vw,44px);line-height:1.3;letter-spacing:-1px;margin:0 0 16px}.intro p{max-width:800px;color:#62605B;margin:0}.intro strong{color:#202020}
.workspace{display:grid;grid-template-columns:minmax(0,1fr) 410px;gap:36px;align-items:start}.controls{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center;border:1px solid #C9C2B5;border-radius:12px;padding:16px 20px;margin-bottom:22px;background:#FFFFFF}
.controls label{display:flex;gap:10px;align-items:center}.controls input{width:100px;accent-color:#6B50AE}.controls output{min-width:56px;font-variant-numeric:tabular-nums;font-size:12px}.reset{margin-left:auto;border:0;background:none;text-decoration:underline;text-underline-offset:4px}
.font-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}.font-card{border:2px solid var(--ink);border-radius:12px;background:#FFF;overflow:hidden;box-shadow:4px 4px 0 #202020}.font-card:has([aria-pressed=true]){box-shadow:5px 5px 0 #8B71C5}.font-pick{width:100%;padding:20px;border:0;background:none;text-align:left;display:block}.font-pick[aria-pressed=true]{background:#F6F0FF}.font-pick:hover{background:#F8F5ED}.card-top{display:flex;gap:8px;align-items:center}.number{font-size:13px;font-weight:800}.tag{font-size:11px;background:var(--accent);border:1px solid var(--ink);border-radius:5px;padding:2px 7px}.selection-mark{margin-left:auto;width:22px;height:22px;border:1px solid #BBB;border-radius:50%;color:transparent;flex-shrink:0}.font-pick[aria-pressed=true] .selection-mark{color:#FFF;background:#202020;border-color:#202020;text-align:center;line-height:20px}
.wordmark{display:flex;align-items:center;min-height:138px;font-size:calc(var(--logo-size) * 1.5);letter-spacing:var(--tracking);line-height:1.25;font-synthesis:none;white-space:nowrap}.font-title{font-size:19px;font-weight:750;display:block}.weight{font-size:11px;color:#777}.reason{display:block;margin-top:12px;color:#4E4B46;font-size:13px;min-height:64px}.tradeoff{display:block;margin-top:8px;font-size:12px;color:#756F64}.source-row{border-top:1px solid #E9E4DA;padding:12px 18px;display:flex;justify-content:space-between;gap:12px;color:#777;font-size:10px}.source-row a{white-space:nowrap;color:#4C4560}
.baseline{border:1px dashed #B3ACA0;border-radius:12px;margin-top:22px;padding:18px 22px;display:flex;gap:24px;align-items:center;background:#F0ECE3}.baseline-word{font-size:46px;font-weight:900;line-height:1;letter-spacing:-1px}.baseline small{display:block;color:#726C63}.research-note{margin:20px 0;color:#6D675E;font-size:12px}
.preview-panel{position:sticky;top:20px}.preview-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}.preview-heading h2{margin:0;font-size:18px}.preview-heading select{border:1px solid #B3ACA0;background:#FFF;border-radius:6px;padding:4px 8px}.preview-caption{font-size:12px;color:#716B62;margin:0 0 14px}.phone-holder{overflow-x:auto;padding:3px 5px 8px}.phone{display:block;border:2px solid #202020;border-radius:18px;box-shadow:4px 4px 0 #D6C9B1;background:#FFF4DA;margin:auto;height:760px;max-width:none}.compare{display:flex;gap:8px;align-items:center;margin:12px 0}.compare input{accent-color:#6B50AE}.decision{background:#FFFFFF;border:2px solid var(--ink);border-radius:12px;padding:18px;margin-top:14px}.decision p{margin:0 0 10px}.decision strong{font-size:18px}.decision button{width:100%;border:2px solid var(--ink);border-radius:8px;padding:11px;background:#FFE17D;font-weight:700;box-shadow:3px 3px 0 #202020}.decision input{width:100%;border:1px solid #CCC;border-radius:6px;margin-top:14px;padding:9px;color:#4B4640;font-size:12px;background:#FAF8F3}.decision small{display:block;color:#777;margin-top:8px}.status{font-size:12px;color:#55744C;min-height:20px;margin:12px 0}.licenses{margin-top:36px;border-top:1px solid #C9C2B5;padding-top:18px;color:#736D63;font-size:12px}.licenses details{margin-top:8px}.licenses summary{cursor:pointer}.licenses pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#FFF;padding:18px;border-radius:8px;font-size:11px}
@media(min-width:1250px){.workspace{grid-template-columns:minmax(0,1fr) 456px}}
@media(max-width:1050px){.wrap{padding:24px}.workspace{grid-template-columns:minmax(0,1fr)}.preview-panel{position:static;max-width:500px;width:100%;margin:auto}.phone-holder{background:#EFE8DA;border-radius:16px;padding:16px 8px}.font-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.reason{min-height:0}}
@media(max-width:570px){.wrap{padding:20px 14px}.masthead{align-items:flex-start}.edition{max-width:110px;text-align:right}.font-grid{grid-template-columns:1fr}.intro{padding:25px 0}.controls{padding:14px;gap:12px}.controls label{flex:1 1 100%}.controls input{flex:1}.reset{margin-left:0}.wordmark{min-height:126px}.baseline{gap:16px}.phone{height:700px}.source-row{font-size:11px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style></head><body><div class="wrap">
<header class="masthead"><strong>AITI / 字体试衣间</strong><span class="edition">05 款候选 · 2026.09.13</span></header>
<section class="intro"><p class="eyebrow">为你的首页挑选一个字标</p><h1>AITI，哪一款更像你？</h1><p>根据现有的<strong>奶油底色、粗描边、卡通角色</strong>筛选 5 款字体。点击卡片，直接看它出现在首页左上角的效果；也可以微调字号和字距。</p></section>
<main class="workspace"><section aria-label="五款字体对比">
<div class="controls"><label for="size">字号 <input id="size" type="range" min="36" max="56" value="46"><output id="size-value" for="size">92rpx</output></label><label for="tracking">字距 <input id="tracking" type="range" min="-2" max="2" step="0.25" value="-1"><output id="tracking-value" for="tracking">−1px</output></label><button class="reset" id="reset" type="button">恢复默认</button></div>
<div class="font-grid">${cards}</div>
<div class="baseline"><span class="baseline-word">AITI</span><div><strong>当前字体参考</strong><small>系统粗体 · 不同设备显示可能略有差异</small></div></div>
<p class="research-note">默认沿用首页 92rpx 字号、−1px 字距。左侧为放大字形，右侧按所选手机宽度展示。排序与适配说明是结合本项目作出的设计判断；我的首选是 01 Bungee，偏可爱可重点看 05 Fredoka。</p>
</section><aside class="preview-panel" aria-label="首页实时预览">
<div class="preview-heading"><h2>放进首页，看一眼</h2><label>宽度 <select id="width"><option value="320">320px</option><option value="375" selected>375px</option><option value="430">430px</option></select></label></div>
<p class="preview-caption">当前首页内容 · 手机画面可滚动 · 按钮为视觉展示</p>
<div class="phone-holder"><iframe id="phone" class="phone" title="选中字体的首页效果" width="375" height="760"></iframe></div>
<label class="compare"><input type="checkbox" id="original">临时查看当前系统字体</label>
<div class="decision"><p>正在预览 <strong id="chosen">01 · Bungee</strong></p><button id="copy" type="button">选这款，复制选择结果</button><input id="choice" aria-label="可复制的字体选择结果" readonly><small id="copy-note">复制后发给我，我再替换小程序中的字体。</small></div>
<p class="status" id="font-status" role="status" aria-live="polite">正在确认字体加载…</p>
</aside></main>
<footer class="licenses"><p>字体与图片已内嵌，可离线打开此 HTML。字体仅包含 AITI 所需字形，原始许可附后；完整字体可访问卡片中的官方来源。此页用于选择，不会直接修改小程序。</p><details><summary>查看 5 款字体的许可原文</summary>${licenses}</details></footer>
</div><script>
const fonts=${json(fonts)};
const fontCSS=${json(faces)};
const homepage=${json(home)};
const el=id=>document.getElementById(id);
let active=fonts[0];
if(innerWidth<570) el('width').value='320';
function draw(){
 const size=Number(el('size').value), tracking=Number(el('tracking').value);
 document.documentElement.style.setProperty('--logo-size',size+'px');
 document.documentElement.style.setProperty('--tracking',tracking+'px');
 el('size-value').value=(size*2)+'rpx';el('tracking-value').value=tracking+'px';
 document.querySelectorAll('[data-font]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.font===active.id)));
 el('chosen').textContent=String(fonts.indexOf(active)+1).padStart(2,'0')+' · '+active.name;
 el('choice').value='我选择 '+active.name+'，字重 '+active.weight+'，字号 '+(size*2)+'rpx，字距 '+tracking+'px。';
 const override=el('original').checked?'':'.home-page .brand{font-family:"Study-'+active.id+'";font-weight:'+active.weight+';font-size:calc('+size*2+' * var(--rpx));letter-spacing:'+tracking+'px;font-synthesis:none;}';
 el('phone').width=el('width').value;
 el('phone').srcdoc=homepage.replace('</style>',fontCSS+override+'</style>');
}
document.querySelectorAll('[data-font]').forEach(button=>button.addEventListener('click',()=>{active=fonts.find(font=>font.id===button.dataset.font);el('original').checked=false;el('copy-note').textContent='复制后发给我，我再替换小程序中的字体。';draw();}));
for(const id of ['size','tracking'])el(id).addEventListener('input',draw);
for(const id of ['width','original'])el(id).addEventListener('change',draw);
el('reset').addEventListener('click',()=>{el('size').value=46;el('tracking').value=-1;el('original').checked=false;draw();});
el('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(el('choice').value);el('copy-note').textContent='已复制，将这句话发给我即可。';}catch{el('choice').focus();el('choice').select();el('copy-note').textContent='已选中选择结果，请手动复制后发给我。';}});
draw();
Promise.all(fonts.map(font=>document.fonts.load(font.weight+' 46px "Study-'+font.id+'"','AITI').then(loaded=>{if(!loaded.length)throw Error(font.name);}))).then(()=>{el('font-status').textContent='5 / 5 款真实字体已加载 · 可离线比较';document.body.dataset.fontsLoaded='5';}).catch(()=>{el('font-status').textContent='部分字体未能加载，请使用新版 Chrome 或 Edge 打开。';el('font-status').style.color='#9B392E';});
</script></body></html>`;
fs.writeFileSync(path.join(root, 'docs/aiti-font-preview.html'), html);
console.log(`Generated docs/aiti-font-preview.html: five embedded fonts, live homepage, ${Buffer.byteLength(html)} bytes`);
