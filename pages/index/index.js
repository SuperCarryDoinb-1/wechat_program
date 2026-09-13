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

Page({
  data: { copy, assets, sharingCopy, singlePage: false, friendMessage: '', showDiagnostics: env.showDiagnostics, modeLabel: '', checking: false, checkMessage: copy.diagnostics.idle },
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
      this.setData({ friendMessage: friend ? sharingCopy.friendTitle.replace('{typeName}', types[friend.code].name) : sharingCopy.friendUnavailable });
    });
  },
  onUnload() { this._disposed = true; },
  onShareAppMessage() { return sharePayload(); },
  onShareTimeline() { return sharePayload(null, null, true); },
  readPrivacy() { privacy.open(wx, this); },
  onShow() {
    this._openingQuiz = false;
    this.setData({ modeLabel: copy.diagnostics.modes[cloud.getState().mode] });
  },
  openQuiz() {
    if (this._openingQuiz) return;
    this._openingQuiz = true;
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
});
