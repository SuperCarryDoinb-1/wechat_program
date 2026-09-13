const copy = require('../../config/copy');
const navigation = require('../../utils/navigation');
const quizConfig = require('../../config/quiz');
const resultConfig = require('../../config/result');
const types = require('../../config/types');
const { calc } = require('../../utils/scoring');
const contentService = require('../../utils/content-service');
const requestId = require('../../utils/request-id');
const sharingCopy = require('../../config/sharing');
const { sharePayload, canShareResult } = require('../../utils/sharing');
const poster = require('../../utils/poster');
const { validRid } = require('../../utils/public-result');
const pairCopy = require('../../config/pair-view');
const { loadPair } = require('../../utils/pair-result');
const privacy = require('../../utils/privacy');

Page({
  data: { copy, sharingCopy, pairCopy, pairing: null, pairLoading: false, pairNote: '', invitation: false, savingPoster: false, albumDenied: false, privacyVisible: false, shareNote: sharingCopy.localNote,
    result: null, type: null, relations: null, detailsOpen: false, posterQuality: 'standard',
    revealing: false, particles: resultConfig.particles, leadLabel: '',
    contentLoading: true, content: null, contentLabel: '', contentNote: '' },
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
      const stored = wx.getStorageSync(quizConfig.resultStorageKey);
      if (!stored || stored.version !== quizConfig.resultVersion) return;
      // 用原始答案重算，不信任缓存中可能过期或不一致的类型与坐标。
      const result = calc(stored.answers);
      const record = { ...stored, ...result, requestId: stored.requestId || requestId() };
      this._record = record;
      this.setData({ pairLoading: validRid(record.fromRid) });
      // 兼容 M2/M3 保存的旧记录，补充本次请求关联标识。
      if (!stored.requestId) {
        try { wx.setStorageSync(quizConfig.resultStorageKey, record); } catch (_) { /* 仍可展示与请求 */ }
      }
      const type = types[result.code];
      const resolve = ref => ({ name: types[ref.code].name, reason: ref.reason });
      this.setData({ result, type, leadLabel: result.code[2] === 'M' ? copy.result.humanLead : copy.result.aiLead,
        relations: { best: resolve(type.match.best), worst: resolve(type.match.worst),
          looksDownOn: resolve(type.chain.looksDownOn), lookedDownBy: resolve(type.chain.lookedDownBy) } });
      contentService.load(record).then(content => {
        if (this._disposed) return;
        this.setData({ content, contentLoading: false,
          shareNote: canShareResult(result, content) ? '' : sharingCopy.localNote,
          contentLabel: copy.result.contentLabels[content.source],
          contentNote: content.source === 'offline' ? copy.result.offlineNote : '' });
        this.loadPairing(record, content);
      }).catch(() => {
        if (this._disposed) return;
        this.setData({ contentLoading: false, pairLoading: false, pairNote: validRid(record.fromRid) ? pairCopy.unavailable : '',
          content: { roast: type.roastFallback, tips: type.tipsFallback },
          contentLabel: copy.result.contentLabels.fallback, contentNote: '' });
      });
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
  async loadPairing(record, content) {
    if (!validRid(record.fromRid)) return;
    let pairing = null;
    try { pairing = await loadPair(wx, record, content); } catch (_) { /* 个人结果始终可用。 */ }
    if (!this._disposed) this.setData({ pairing, pairLoading: false, pairNote: pairing ? '' : pairCopy.unavailable });
  },
  savePairPoster() { return this.savePoster('pair'); },
  changePosterQuality(event) {
    const quality = event.currentTarget.dataset.quality;
    if (this._disposed || this._savingPoster || !['standard', '8k'].includes(quality)) return;
    this.setData({ posterQuality: quality });
  },
  async savePoster(kind) {
    const paired = kind === 'pair';
    if (paired && !this.data.pairing) return;
    if (this._savingPoster || this._disposed || !this.data.result) return;
    this._savingPoster = true;
    this.setData({ savingPoster: true, albumDenied: false });
    let exporting = true;
    try {
      const key = (paired ? '_pairPosterPath' : '_posterPath') + (this.data.posterQuality === '8k' ? '8k' : '');
      this[key] = this[key] || await poster.exportPoster(wx, this, this.data.result, paired ? this.data.pairing : null, this.data.posterQuality);
      exporting = false;
      if (this._disposed) return;
      await poster.saveToAlbum(wx, this[key], () => !this._disposed);
      if (!this._disposed) wx.showToast({ title: sharingCopy.saved, icon: 'success' });
    } catch (error) {
      if (this._disposed) return;
      if (error.message === 'ALBUM_DENIED') this.setData({ albumDenied: true });
      else wx.showToast({ title: error.message === 'PRIVACY' ? sharingCopy.privacyFailed :
        exporting && this.data.posterQuality === '8k' ? sharingCopy.ultraFailed : sharingCopy.failed, icon: 'none' });
    } finally {
      this._savingPoster = false;
      if (!this._disposed) this.setData({ savingPoster: false });
    }
  },
  closeAlbumGuide() { this.setData({ albumDenied: false }); },
  readPrivacy() { privacy.open(wx, this); },
  agreePrivacy() { privacy.finish(this, 'agree'); },
  refusePrivacy() { privacy.finish(this, 'disagree'); },
  albumSettingsChanged(event) {
    const granted = event.detail && event.detail.authSetting && event.detail.authSetting['scope.writePhotosAlbum'];
    this.setData({ albumDenied: !granted });
  },
  onShareAppMessage() { return sharePayload(this.data.result, this.data.content, false, this.data.pairing); },
  onShareTimeline() { return sharePayload(this.data.result, this.data.content, true, this.data.pairing); },
  restart() {
    if (this._restarting) return;
    this._restarting = true;
    this.skipReveal();
    const fromRid = this._record && this._record.fromRid;
    wx.redirectTo({ url: navigation.quizUrl(fromRid), fail: () => {
      this._restarting = false;
      wx.showToast({ title: copy.errors.navigation, icon: 'none' });
    } });
  },
  goHome: navigation.home
});
