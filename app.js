const cloud = require('./utils/cloud');

App({
  globalData: { cloudState: null },
  onLaunch() {
    this.globalData.cloudState = cloud.initialize();
  }
});
