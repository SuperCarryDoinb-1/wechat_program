const copy = require('../../../config/copy');
const pairCopy = require('../../../config/pair-view');
const sharingCopy = require('../../../config/sharing');
const { canShareResult } = require('../../sharing');
const { validRid } = require('../../public-result');

const data = {
  pairCopy, pairing: null, pairLoading: false, pairNote: '',
  contentLoading: true, content: null, contentLabel: '', contentNote: ''
};

function create({ getPlatform, contentService, loadPair }) {
  return {
    loadContent(record, result, type) {
      return contentService.load(record).then(content => {
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
    },
    async loadPairing(record, content) {
      if (!validRid(record.fromRid)) return;
      let pairing = null;
      try { pairing = await loadPair(getPlatform(), record, content); } catch (_) { /* 个人结果始终可用。 */ }
      if (!this._disposed) this.setData({ pairing, pairLoading: false, pairNote: pairing ? '' : pairCopy.unavailable });
    },
  };
}

module.exports = { data, create };
