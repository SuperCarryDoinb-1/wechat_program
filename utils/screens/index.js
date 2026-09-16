const copy = require('../../config/copy');
const assets = require('../../config/assets');
const env = require('../../config/env');
const cloud = require('../../utils/cloud');
const navigation = require('../../utils/navigation');
const { sharePayload } = require('../../utils/sharing');
const { loadFriend } = require('../../utils/friend-service');
const sharingCopy = require('../../config/sharing');
const types = require('../../config/types');
const { validRid } = require('../../utils/public-result');
const privacy = require('../../utils/privacy');

module.exports = {
  data: { copy: { brand: copy.brand, home: copy.home, diagnostics: copy.diagnostics },
    assets: { hero: assets.hero, assistantStrip: assets.assistantStrip },
    sharingCopy: { timelineHint: sharingCopy.timelineHint },
    singlePage: false, friendMessage: '', showDiagnostics: env.showDiagnostics, modeLabel: '', checking: false, checkMessage: copy.diagnostics.idle, petAvoidRects: [], petLayoutReady: false, petScrolling: false },
  onLoad(options = {}) {
    this._disposed = false;
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
  onUnload() { this._disposed = true; this._active = false; this.cancelPetLayout(); },
  onHide() { this._active = false; this.cancelPetLayout(); },
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
      wx.createSelectorQuery().selectAll('.start-area, .diagnostics, .footer').boundingClientRect(rects => {
        if (!this._active || this._disposed || version !== this._petLayoutVersion) return;
        const valid = Array.isArray(rects) && rects.length > 0 && rects.every(rect =>
          rect && ['left', 'right', 'top', 'bottom'].every(key => Number.isFinite(rect[key])));
        this.setData({ petAvoidRects: valid ? rects.map(({ left, right, top, bottom }) => ({ left, right, top, bottom })) : [], petLayoutReady: valid });
      }).exec();
    } catch (_) { this.setData({ petLayoutReady: false }); }
  },
  onShareAppMessage() { return sharePayload(); },
  onShareTimeline() { return sharePayload(null, null, true); },
  readPrivacy() { privacy.open(wx, this); },
  onShow() {
    this._active = true;
    this._openingQuiz = false;
    this.setData({ modeLabel: copy.diagnostics.modes[cloud.getState().mode], petScrolling: false }, () => this.refreshPetObstacles());
  },
  openQuiz() {
    if (this._openingQuiz) return;
    this._openingQuiz = true;
    if (this._flow) { this._flow.go('quiz', { fromRid: this._fromRid }); return; }
    navigation.quiz(() => { this._openingQuiz = false; }, this._fromRid);
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
