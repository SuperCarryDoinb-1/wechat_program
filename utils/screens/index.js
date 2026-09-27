const copy = require('../../config/copy');
const env = require('../../config/env');
const cloud = require('../../utils/cloud');
const navigation = require('../../utils/navigation');
const { sharePayload } = require('../../utils/sharing');
const { loadFriend } = require('../../utils/friend-service');
const sharingCopy = require('../../config/sharing');
const types = require('../../config/types');
const { typePreview } = require('../type-preview');
const { validRid } = require('../../utils/public-result');
const privacy = require('../../utils/privacy');
const previewOrder = ['TEM', 'PEM', 'TGM', 'TEA', 'PEA', 'TGA', 'PGM', 'PGA'];
function previewsAt(offset) {
  return [0, 1, 2].map(n => {
    const code = previewOrder[(offset + n) % previewOrder.length];
    return typePreview(code);
  });
}

module.exports = {
  data: { copy: { brand: copy.brand, home: copy.home, diagnostics: copy.diagnostics },
    typePreviews: previewsAt(0),
    sharingCopy: { timelineHint: sharingCopy.timelineHint },
    singlePage: false, friendMessage: '', showDiagnostics: env.showDiagnostics, modeLabel: '', checking: false, checkMessage: copy.diagnostics.idle, petAvoidRects: [], petLayoutReady: false, petScrolling: false },
  onLoad(options = {}) {
    this._disposed = false;
    this._previewOffset = 0;
    this._fromRid = validRid(options.rid) ? options.rid : '';
    if (wx.getLaunchOptionsSync && wx.getLaunchOptionsSync().scene === 1154) {
      this.setData({ singlePage: true });
      return;
    }
    if (wx.showShareMenu) wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    if (!Object.prototype.hasOwnProperty.call(options, 'rid')) return;
    this.setData({ friendMessage: sharingCopy.friendLoading });
    loadFriend(wx, options.rid).then(friend => {
      if (this._disposed) return;
      this.setData({ friendMessage: friend ? sharingCopy.friendTitle.replace('{typeName}', types[friend.code].name) : sharingCopy.friendUnavailable, petLayoutReady: false }, () => this.refreshPetObstacles());
    });
  },
  onUnload() { this._disposed = true; this._active = false; this.stopPreviews(); this.cancelPetLayout(); },
  onHide() { this._active = false; this.stopPreviews(); this.cancelPetLayout(); },
  stopPreviews() {
    this._previewVersion = (this._previewVersion || 0) + 1;
    if (this._previewTimer != null) clearTimeout(this._previewTimer);
    this._previewTimer = null;
  },
  startPreviews() {
    this.stopPreviews();
    const version = this._previewVersion;
    const advance = () => {
      if (this._disposed || !this._active || version !== this._previewVersion) return;
      this._previewOffset = ((this._previewOffset || 0) + 3) % previewOrder.length;
      this.setData({ typePreviews: previewsAt(this._previewOffset) });
      this._previewTimer = setTimeout(advance, 8000);
    };
    this._previewTimer = setTimeout(advance, 8000);
  },
  onReady() { this.refreshPetObstacles(); },
  onResize() {
    if (!this._active || this._disposed) return;
    this.refreshPetObstacles();
  },
  cancelPetLayout() {
    this._petLayoutVersion = (this._petLayoutVersion || 0) + 1;
    if (this._petScrollTimer != null) clearTimeout(this._petScrollTimer);
    this._petScrollTimer = null;
  },
  onPageScroll() {
    if (!this._active || this._disposed) return;
    this.cancelPetLayout();
    if (!this.data.petScrolling) this.setData({ petScrolling: true });
    this._petScrollTimer = setTimeout(() => {
      this._petScrollTimer = null;
      if (!this._active || this._disposed) return;
      this.setData({ petScrolling: false }, () => this.refreshPetObstacles());
    }, 32);
  },
  refreshPetObstacles() {
    if (!this._active || this._disposed || this.data.singlePage || this.data.petScrolling || !wx.createSelectorQuery) return;
    const version = this._petLayoutVersion = (this._petLayoutVersion || 0) + 1;
    try {
      wx.createSelectorQuery().selectAll('.brand-row, .start-area').boundingClientRect(rects => {
        if (!this._active || this._disposed || version !== this._petLayoutVersion) return;
        const valid = Array.isArray(rects) && rects.length === 2 && rects.every(rect =>
          rect && ['left', 'right', 'top', 'bottom'].every(key => Number.isFinite(rect[key])));
        // Full-width barriers keep roaming and dragging below the brand and above
        // the start area, including after scrolling. Content between them is open.
        const extent = Number.MAX_SAFE_INTEGER;
        const petAvoidRects = valid ? [
          { left: -extent, right: extent, top: -extent, bottom: rects[0].bottom },
          { left: -extent, right: extent, top: rects[1].top, bottom: extent }
        ] : [];
        this.setData({ petAvoidRects, petLayoutReady: valid });
      }).exec();
    } catch (_) { this.setData({ petLayoutReady: false }); }
  },
  onShareAppMessage() { return sharePayload(); },
  onShareTimeline() { return sharePayload(null, null, true); },
  readPrivacy() { privacy.open(wx, this); },
  onShow() {
    this._active = true;
    this.startPreviews();
    this._openingQuiz = false;
    this.setData({ modeLabel: copy.diagnostics.modes[cloud.getState().mode], petScrolling: false }, () => this.refreshPetObstacles());
  },
  openQuiz() {
    if (this._openingQuiz) return;
    this._openingQuiz = true;
    if (this._flow) { this._flow.go('quiz', { fromRid: this._fromRid }); return; }
    navigation.quiz(() => { this._openingQuiz = false; }, this._fromRid);
  },
  openHistory() {
    if (this.data.singlePage) return;
    if (this._flow) this._flow.go('history', { fromRid: this._fromRid });
    else wx.navigateTo({ url: '/pages/index/index?history=1' });
  },
  async checkCloud() {
    if (this.data.checking) return;
    this.setData({ checking: true, checkMessage: copy.diagnostics.loading });
    try {
      const result = await cloud.check();
      this.setData({ checkMessage: copy.diagnostics[result.mode] });
    } catch (_) {
      this.setData({ checkMessage: copy.diagnostics.failed });
    } finally {
      this.setData({ checking: false });
    }
  }
};
