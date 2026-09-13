// 记录同一份 Canvas 绘图指令，供本地校样与布局断言使用；不是微信渲染器。
function recordingContext() {
  const operations = [];
  return {
    operations, font: '20px sans-serif', fillStyle: '#FFFFFF', strokeStyle: '#FFFFFF', lineWidth: 1,
    measureText(text) {
      const size = parseFloat(this.font);
      return { width: Array.from(text).reduce((sum, char) => sum + size * (char.charCodeAt(0) > 255 ? 1 : .62), 0) };
    },
    fillRect(x,y,w,h) { operations.push({ op: 'rect', x,y,w,h,color: this.fillStyle }); },
    strokeRect(x,y,w,h) { operations.push({ op: 'stroke', x,y,w,h,color: this.strokeStyle, thickness: this.lineWidth }); },
    beginPath() {}, arc(x,y,r) { this._circle = { x,y,r }; },
    fill() { operations.push({ op: 'circle', ...this._circle, color: this.fillStyle }); },
    fillText(text,x,y) { operations.push({ op: 'text', text,x,y,size: parseFloat(this.font),color: this.fillStyle, width: this.measureText(text).width }); },
    drawImage(image,x,y,w,h) { operations.push({ op: 'image', x,y,w,h }); }
  };
}
module.exports = { recordingContext };
