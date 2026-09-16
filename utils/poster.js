const assets = require('../config/assets');
const copy = require('../config/poster');
const { drawPoster, drawPairPoster } = require('./poster-renderer');

function call(platform, name, options = {}) {
  return new Promise((resolve, reject) => platform[name]({ ...options, success: resolve, fail: reject }));
}
function loadImage(canvas, path) {
  if (!path) return Promise.resolve(null);
  return new Promise(resolve => {
    let done = false;
    const finish = value => { if (done) return; done = true; clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => finish(null), 2500);
    try { const img = canvas.createImage(); img.onload = () => finish(img); img.onerror = () => finish(null); img.src = path; }
    catch (_) { finish(null); }
  });
}
async function exportPoster(platform, page, result, pairing = null, quality = 'standard') {
  const ultra = quality === '8k';
  const width = ultra ? copy.ultraWidth : copy.width;
  const height = ultra ? copy.ultraHeight : copy.height;
  const canvas = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('CANVAS_TIMEOUT')), 3000);
    try { platform.createSelectorQuery().in(page._view || page).select('#posterCanvas').fields({ node: true, size: true }).exec(rows => {
      clearTimeout(timer); rows && rows[0] && rows[0].node ? resolve(rows[0].node) : reject(Error('CANVAS_UNAVAILABLE'));
    }); } catch (error) { clearTimeout(timer); reject(error); }
  });
  try {
    canvas.width = width; canvas.height = height;
    const [portrait, code, friend] = await Promise.all([loadImage(canvas, assets.types[result.code]), loadImage(canvas, assets.miniProgramCode), loadImage(canvas, pairing ? assets.types[pairing.friendCode] : '')]);
    if (page._disposed) throw Error('DISPOSED');
    const ctx = canvas.getContext('2d');
    if (ultra) ctx.scale(width / copy.width, height / copy.height);
    if (pairing) drawPairPoster(ctx, result, pairing, { portrait, code, friend });
    else drawPoster(ctx, result, { portrait, code });
    const output = await call(platform, 'canvasToTempFilePath', { canvas, x: 0, y: 0, width, height,
      destWidth: width, destHeight: height, fileType: 'png' });
    if (ultra) {
      const info = await call(platform, 'getImageInfo', { src: output.tempFilePath });
      if (info.width !== width || info.height !== height) throw Error('EXPORT_SIZE');
    }
    return output.tempFilePath;
  } finally {
    // 高分辨率缓冲不随页面常驻；缓存只保存导出文件路径。
    canvas.width = 1; canvas.height = 1;
  }
}
async function saveToAlbum(platform, filePath, active = () => true) {
  if (platform.requirePrivacyAuthorize) {
    try { await call(platform, 'requirePrivacyAuthorize'); } catch (_) { throw Error('PRIVACY'); }
  }
  if (!active()) throw Error('DISPOSED');
  const settings = await call(platform, 'getSetting');
  if (!active()) throw Error('DISPOSED');
  if (settings.authSetting && settings.authSetting['scope.writePhotosAlbum'] === false) throw Error('ALBUM_DENIED');
  try { await call(platform, 'saveImageToPhotosAlbum', { filePath }); }
  catch (error) {
    if (/auth deny|auth denied|authorize|permission/i.test(error.errMsg || '')) throw Error('ALBUM_DENIED');
    throw error;
  }
}
module.exports = { exportPoster, saveToAlbum };
