const copy = require('../../config/history');
const resultCopy = require('../../config/copy').result;
const types = require('../../config/types');
const { typePreview } = require('../type-preview');
const { loadHistory } = require('../history-service');
const { validRid } = require('../public-result');
const navigation = require('../navigation');

function dateLabel(value) {
  const d = new Date(value);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

module.exports = {
  data: { copy, resultCopy, records: [], loading: true, failed: false, expandedId: '' },
  onLoad(options = {}) {
    this._disposed = false;
    this._requestVersion = 0;
    this._fromRid = validRid(options.fromRid) ? options.fromRid : '';
  },
  onShow() { this.refreshHistory(); },
  onUnload() { this._disposed = true; this._requestVersion += 1; },
  async refreshHistory() {
    if (this._loading || this._disposed) return;
    this._loading = true;
    const version = ++this._requestVersion;
    this.setData({ loading: true, failed: false, expandedId: '', records: [] });
    try {
      const records = await loadHistory(wx);
      if (this._disposed || version !== this._requestVersion) return;
      this.setData({ records: records.map(record => ({ ...record, ...typePreview(record.code), dateLabel: dateLabel(record.createdAt),
        type: types[record.code], sourceLabel: resultCopy.contentLabels[record.source],
        leadLabel: record.code[2] === 'M' ? resultCopy.humanLead : resultCopy.aiLead })) });
    } catch (error) {
      // Keep cloud failure diagnostics available without logging any history data.
      console.warn('[history] load failed:', error.errMsg || error.message || 'HISTORY_UNAVAILABLE');
      if (!this._disposed && version === this._requestVersion) this.setData({ failed: true });
    } finally {
      this._loading = false;
      if (!this._disposed && version === this._requestVersion) this.setData({ loading: false });
    }
  },
  toggleHistory(event) {
    const id = event.currentTarget.dataset.id;
    if (!this.data.records.some(record => record.id === id)) return;
    this.setData({ expandedId: this.data.expandedId === id ? '' : id });
  },
  historyHome() {
    if (this._flow) this._flow.go('index');
    else navigation.home();
  },
  historyStart() {
    if (this._flow) this._flow.go('quiz', { fromRid: this._fromRid });
    else navigation.quiz(null, this._fromRid);
  }
};
