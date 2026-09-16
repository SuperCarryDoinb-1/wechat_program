const copy = require('../../config/copy');
const navigation = require('../../utils/navigation');
const resultStore = require('../../utils/result-store');
const resultConfig = require('../../config/result');
const types = require('../../config/types');
const { calc } = require('../../utils/scoring');
const contentService = require('../../utils/content-service');
const requestId = require('../../utils/request-id');
const sharingCopy = require('../../config/sharing');
const { sharePayload } = require('../../utils/sharing');
const { validRid } = require('../../utils/public-result');
const { loadPair } = require('../../utils/pair-result');
const privacy = require('../../utils/privacy');
const posterFeature = require('./result/poster');
const contentFeature = require('./result/content');

module.exports = {
  data: { copy: { brand: copy.brand, title: copy.title, subtitle: copy.subtitle,
      disclaimer: copy.disclaimer, result: copy.result, home: { action: copy.home.action } },
    sharingCopy, ...posterFeature.data, ...contentFeature.data, invitation: false, privacyVisible: false, shareNote: sharingCopy.localNote,
    result: null, type: null, relations: null, detailsOpen: false,
    revealing: false, particles: resultConfig.particles, leadLabel: '' },
  ...posterFeature.create({ getPlatform: () => wx, getPoster: () => require('../../utils/poster') }),
  ...contentFeature.create({ getPlatform: () => wx, contentService, loadPair }),
  onLoad(options = {}) {
    this._disposed = false;
    // 朋友圈打开当前页，邀请访客必须先回首页，不能读取本机旧结果。
    if (Object.prototype.hasOwnProperty.call(options, 'rid') || options.invite) {
      const query = validRid(options.rid) ? `rid=${encodeURIComponent(options.rid)}` : 'invite=1';
      this.setData({ invitation: true });
      // 单页模式禁止路由，先展示邀请说明；用户进入完整小程序后再跳转。
      if (wx.getLaunchOptionsSync && wx.getLaunchOptionsSync().scene === 1154) return;
      wx.reLaunch({ url: `/pages/index/index?${query}`, fail: () => {
        if (!this._disposed) wx.showToast({ title: copy.errors.navigation, icon: 'none' });
      } });
      return;
    }
    if (wx.showShareMenu) wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    privacy.bind(wx, this);
    this._revealPlayed = false;
    this._timer = null;
    this._restarting = false;
    try {
      const stored = resultStore.read(wx);
      if (!stored) return;
      // 用原始答案重算，不信任缓存中可能过期或不一致的类型与坐标。
      const result = calc(stored.answers);
      const record = { ...stored, ...result, requestId: stored.requestId || requestId() };
      this._record = record;
      // 兼容 M2/M3 保存的旧记录，补充本次请求关联标识。
      if (!stored.requestId) {
        try { resultStore.write(wx, record); } catch (_) { /* 仍可展示与请求 */ }
      }
      const type = types[result.code];
      const resolve = ref => ({ name: types[ref.code].name, reason: ref.reason });
      this.setData({ result, type, pairLoading: validRid(record.fromRid), leadLabel: result.code[2] === 'M' ? copy.result.humanLead : copy.result.aiLead,
        relations: { best: resolve(type.match.best), worst: resolve(type.match.worst),
          looksDownOn: resolve(type.chain.looksDownOn), lookedDownBy: resolve(type.chain.lookedDownBy) } });
      this.loadContent(record, result, type);
    } catch (_) {
      // 无结果、版本不支持、存储异常或答案损坏时展示空态，提供重新开始入口。
      this.setData({ result: null, type: null, relations: null });
    }
  },
  onReady() {
    if (this._disposed || this._revealPlayed || !this.data.result || this.data.result.rarity !== 'hidden') return;
    this._revealPlayed = true;
    this.setData({ revealing: true });
    this._timer = setTimeout(() => this.skipReveal(), resultConfig.revealDurationMs);
  },
  onHide() { this.skipReveal(); },
  onUnload() {
    this._disposed = true;
    privacy.unbind(wx, this);
    if (this._timer !== null) clearTimeout(this._timer);
    this._timer = null;
  },
  skipReveal() {
    if (this._timer !== null) clearTimeout(this._timer);
    this._timer = null;
    if (!this._disposed && this.data.revealing) this.setData({ revealing: false });
  },
  toggleDetails() { this.setData({ detailsOpen: !this.data.detailsOpen }); },
  readPrivacy() { privacy.open(wx, this); },
  agreePrivacy() { privacy.finish(this, 'agree'); },
  refusePrivacy() { privacy.finish(this, 'disagree'); },
  onShareAppMessage() { return sharePayload(this.data.result, this.data.content, false, this.data.pairing); },
  onShareTimeline() { return sharePayload(this.data.result, this.data.content, true, this.data.pairing); },
  restart() {
    if (this._restarting) return;
    this._restarting = true;
    this.skipReveal();
    const fromRid = this._record && this._record.fromRid;
    if (this._flow) { this._flow.go('quiz', { fromRid }); return; }
    wx.redirectTo({ url: navigation.quizUrl(fromRid), fail: () => {
      this._restarting = false;
      wx.showToast({ title: copy.errors.navigation, icon: 'none' });
    } });
  },
  goHome() {
    if (this._flow) this._flow.go('index');
    else navigation.home();
  }
};
