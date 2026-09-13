const types = require('../config/types');
const copy = require('../config/poster');
const resultCopy = require('../config/copy').result;
const pairCopy = require('../config/pair-view');
const { pair } = require('./pairing');

// 每段文字使用固定宽度与行数，在实际 Canvas 上测量后排版。
function textBox(ctx, text, x, y, width, size, maxLines = 1, color = '#202020') {
  ctx.font = `${size}px sans-serif`; ctx.fillStyle = color; ctx.textBaseline = 'top';
  const chars = Array.from(text), lines = []; let line = '';
  for (const char of chars) {
    if (ctx.measureText(line + char).width > width && line) { lines.push(line); line = ''; }
    line += char;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(last + '…').width > width) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
  }
  lines.forEach((value, index) => ctx.fillText(value, x, y + index * size * 1.45));
  return lines;
}
function circle(ctx, x, y, radius, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
}
function avatar(ctx, x, y, size, color) {
  circle(ctx, x + size / 2, y + size / 2, size / 2, '#A8C7FA');
  rounded(ctx, x + size * .17, y + size * .22, size * .68, size * .64, size * .2, '#202020');
  rounded(ctx, x + size * .14, y + size * .16, size * .68, size * .64, size * .2, color);
  rounded(ctx, x + size * .21, y + size * .31, size * .54, size * .29, size * .1, '#202020');
  rounded(ctx, x + size * .32, y + size * .38, size * .055, size * .09, size * .025, '#FFF4DA');
  rounded(ctx, x + size * .58, y + size * .38, size * .055, size * .09, size * .025, '#FFF4DA');
  ctx.fillStyle = '#FFF4DA'; ctx.fillRect(x + size * .43, y + size * .51, size * .1, size * .016);
  rounded(ctx, x + size * .43, y + size * .65, size * .1, size * .035, size * .015, '#202020');
}
function rounded(ctx, x, y, width, height, radius, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + radius, y, width - radius * 2, height);
  ctx.fillRect(x, y + radius, width, height - radius * 2);
  for (const cx of [x + radius, x + width - radius]) {
    for (const cy of [y + radius, y + height - radius]) circle(ctx, cx, cy, radius, color);
  }
}
function drawCover(ctx, code) {
  const type = types[code], accent = type ? type.color : '#FFE17D';
  ctx.fillStyle = '#FFF4DA'; ctx.fillRect(0, 0, 500, 400);
  ctx.fillStyle = '#202020'; ctx.fillRect(26, 26, 460, 270);
  ctx.fillStyle = '#A8C7FA'; ctx.fillRect(20, 20, 460, 270);
  ctx.strokeStyle = '#202020'; ctx.lineWidth = 3; ctx.strokeRect(20, 20, 460, 270);
  textBox(ctx, copy.brand, 40, 35, 200, 24, 1, '#202020');
  textBox(ctx, type ? code : copy.genericCode, 300, 38, 160, 20, 1, '#202020');
  avatar(ctx, 170, 90, 160, accent);
  textBox(ctx, type ? type.name : copy.posterSubtitle, 30, 313, 440, 32);
  ctx.fillStyle = accent; ctx.fillRect(30, 370, 70, 5);
}
function frame(ctx, color, hidden) {
  ctx.fillStyle = '#FFF4DA'; ctx.fillRect(0, 0, copy.width, copy.height);
  ctx.strokeStyle = hidden ? '#8A691D' : '#202020';
  ctx.lineWidth = hidden ? 6 : 2; ctx.strokeRect(22, 22, 706, 1290);
  ctx.fillStyle = '#202020'; ctx.fillRect(64, 162, 638, 270);
  ctx.fillStyle = '#C9B6FF'; ctx.fillRect(56, 154, 638, 270);
  ctx.strokeStyle = '#202020'; ctx.lineWidth = 3; ctx.strokeRect(56, 154, 638, 270);
  ctx.fillStyle = color; ctx.fillRect(56, 32, 82, 6);
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = '#202020'; ctx.fillRect(582 + i * 5, 1271, i % 3 === 0 ? 3 : 1, 18);
  }
}
function plot(ctx, x, y, width, height) {
  ctx.fillStyle = '#C9B6FF'; ctx.fillRect(x, y, width, height);
  ctx.fillStyle = '#202020'; ctx.fillRect(x + width / 2, y, 1, height); ctx.fillRect(x, y + height / 2, width, 1);
}
function drawPoster(ctx, result, images = {}) {
  const type = Object.prototype.hasOwnProperty.call(types, result.code) ? types[result.code] : null;
  if (!type || !result.coords || !Number.isFinite(result.coords.x) || !Number.isFinite(result.coords.y)) throw Error('INVALID_RESULT');
  frame(ctx, type.color, result.code === 'TEM');
  textBox(ctx, copy.brand, 56, 54, 260, 40);
  textBox(ctx, result.code === 'TEM' ? resultCopy.hidden : copy.posterSubtitle, 440, 64, 250, 24, 1, result.code === 'TEM' ? '#805F15' : '#363636');
  if (images.portrait) ctx.drawImage(images.portrait, 235, 135, 280, 280);
  else avatar(ctx, 235, 135, 280, type.color);
  textBox(ctx, result.code, 56, 455, 638, 26, 1, '#363636');
  textBox(ctx, type.name, 56, 505, 638, 52);
  textBox(ctx, type.slogan, 56, 586, 638, 30, 2);
  textBox(ctx, type.persona, 56, 691, 638, 23, 3, '#505050');
  const mx = 185, my = 846, mw = 380, mh = 200;
  plot(ctx, mx, my, mw, mh);
  textBox(ctx, resultCopy.embrace, 320, 812, 170, 19);
  textBox(ctx, resultCopy.guard, 320, 1056, 170, 19);
  textBox(ctx, resultCopy.tool, 60, 933, 110, 19);
  textBox(ctx, resultCopy.partner, 585, 933, 110, 19);
  const clamp = n => Math.max(-1, Math.min(1, n));
  circle(ctx, mx + (clamp(result.coords.x) + 1) * mw / 2, my + (1 - clamp(result.coords.y)) * mh / 2, 9, type.color);
  if (images.code) ctx.drawImage(images.code, 56, 1120, 124, 124);
  else {
    ctx.fillStyle = '#FFE17D'; ctx.fillRect(56, 1120, 124, 124);
    textBox(ctx, copy.codePlaceholder, 68, 1150, 100, 18, 3, '#505050');
  }
  textBox(ctx, copy.posterInvite, 210, 1126, 475, 26, 2);
  textBox(ctx, copy.posterHint, 210, 1206, 475, 21, 1, '#505050');
  textBox(ctx, copy.disclaimer, 56, 1270, 638, 17, 1, '#505050');
}
function drawPairPoster(ctx, result, pairing, images = {}) {
  const own = types[result.code], friend = types[pairing.friendCode];
  const content = pair(result.code, pairing.friendCode);
  const coords = [result.coords, pairing.friendCoords];
  if (coords.some(value => !value || !Number.isFinite(value.x) || !Number.isFinite(value.y))) throw Error('INVALID_COORDS');
  const hidden = result.code === 'TEM' || pairing.friendCode === 'TEM';
  frame(ctx, own.color, hidden);
  textBox(ctx, pairCopy.posterTitle, 56, 60, 638, 36);
  if (hidden) textBox(ctx, pairCopy.posterHidden, 56, 116, 638, 20, 1, '#805F15');
  if (images.portrait) ctx.drawImage(images.portrait, 90, 180, 220, 220); else avatar(ctx, 90, 180, 220, own.color);
  if (images.friend) ctx.drawImage(images.friend, 440, 180, 220, 220); else avatar(ctx, 440, 180, 220, friend.color);
  textBox(ctx, pairCopy.you, 70, 431, 275, 22, 1, '#363636');
  textBox(ctx, pairCopy.friend, 415, 431, 275, 22, 1, '#363636');
  textBox(ctx, own.name, 70, 474, 275, 30, 2);
  textBox(ctx, friend.name, 415, 474, 275, 30, 2);
  textBox(ctx, content.name, 56, 588, 638, 42, 2, '#202020');
  textBox(ctx, content.text, 56, 728, 638, 25, 3, '#505050');
  const mx = 185, my = 878, mw = 380, mh = 178;
  plot(ctx, mx, my, mw, mh);
  textBox(ctx, resultCopy.embrace, 320, 844, 170, 19); textBox(ctx, resultCopy.guard, 320, 1064, 170, 19);
  textBox(ctx, resultCopy.tool, 60, 948, 110, 19); textBox(ctx, resultCopy.partner, 585, 948, 110, 19);
  const clamp = n => Math.max(-1, Math.min(1, n));
  const points = coords.map(value => ({ x: mx + (clamp(value.x) + 1) * mw / 2, y: my + (1 - clamp(value.y)) * mh / 2 }));
  for (let i = 0; i <= 40; i++) circle(ctx, points[0].x + (points[1].x - points[0].x) * i / 40, points[0].y + (points[1].y - points[0].y) * i / 40, 1.5, '#505050');
  circle(ctx, points[1].x, points[1].y, 15, friend.color); circle(ctx, points[1].x, points[1].y, 11, '#C9B6FF');
  circle(ctx, points[0].x, points[0].y, 7, own.color);
  textBox(ctx, pairCopy.you, 185, 1103, 180, 19, 1, '#363636'); textBox(ctx, pairCopy.friend, 415, 1103, 180, 19, 1, '#363636');
  if (images.code) ctx.drawImage(images.code, 56, 1150, 100, 100);
  else { ctx.fillStyle = '#FFE17D'; ctx.fillRect(56, 1150, 100, 100); textBox(ctx, copy.codePlaceholder, 65, 1164, 82, 17, 3, '#505050'); }
  textBox(ctx, pairCopy.posterInvite, 210, 1155, 475, 28);
  textBox(ctx, copy.posterHint, 210, 1213, 475, 21, 1, '#505050');
  textBox(ctx, copy.disclaimer, 56, 1270, 638, 17, 1, '#505050');
}
module.exports = { drawPoster, drawPairPoster, drawCover, textBox };
