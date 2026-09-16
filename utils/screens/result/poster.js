const sharingCopy = require('../../../config/sharing');

const data = { savingPoster: false, albumDenied: false, posterQuality: 'standard' };

// Methods run with the current screen as this; each screen owns its export cache.
// Resolve the platform and renderer only when needed, after the canvas mounts.
function create({ getPlatform, getPoster }) {
  return {
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
      let exporting = true;
      try {
        // 等画布挂载完成后再查询节点；首次进入结果页不创建画布。
        await new Promise(resolve => this.setData({ savingPoster: true, albumDenied: false }, resolve));
        if (this._disposed) return;
        const poster = getPoster();
        const key = (paired ? '_pairPosterPath' : '_posterPath') + (this.data.posterQuality === '8k' ? '8k' : '');
        this[key] = this[key] || await poster.exportPoster(getPlatform(), this, this.data.result, paired ? this.data.pairing : null, this.data.posterQuality);
        exporting = false;
        if (this._disposed) return;
        await poster.saveToAlbum(getPlatform(), this[key], () => !this._disposed);
        if (!this._disposed) getPlatform().showToast({ title: sharingCopy.saved, icon: 'success' });
      } catch (error) {
        if (this._disposed) return;
        if (error.message === 'ALBUM_DENIED') this.setData({ albumDenied: true });
        else getPlatform().showToast({ title: error.message === 'PRIVACY' ? sharingCopy.privacyFailed :
          exporting && this.data.posterQuality === '8k' ? sharingCopy.ultraFailed : sharingCopy.failed, icon: 'none' });
      } finally {
        this._savingPoster = false;
        if (!this._disposed) this.setData({ savingPoster: false });
      }
    },
    closeAlbumGuide() { this.setData({ albumDenied: false }); },
    albumSettingsChanged(event) {
      const granted = event.detail && event.detail.authSetting && event.detail.authSetting['scope.writePhotosAlbum'];
      this.setData({ albumDenied: !granted });
    },
  };
}

module.exports = { data, create };
