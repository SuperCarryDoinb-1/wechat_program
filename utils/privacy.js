const copy = require('../config/copy');

// 页面只负责按钮与状态，授权监听的注册、结算与释放在这里成对维护。
function bind(platform, page) {
  if (!platform.onNeedPrivacyAuthorization) return;
  page._privacyHandler = resolve => {
    if (page._disposed) { resolve({ event: 'disagree' }); return; }
    if (page._privacyResolve) page._privacyResolve({ event: 'disagree' });
    page._privacyResolve = resolve;
    page.setData({ privacyVisible: true });
  };
  platform.onNeedPrivacyAuthorization(page._privacyHandler);
}

function unbind(platform, page) {
  const resolve = page._privacyResolve;
  page._privacyResolve = null;
  if (resolve) resolve({ event: 'disagree' });
  if (page._privacyHandler && platform.offNeedPrivacyAuthorization) platform.offNeedPrivacyAuthorization(page._privacyHandler);
  page._privacyHandler = null;
}

function finish(page, event) {
  const resolve = page._privacyResolve;
  page._privacyResolve = null;
  if (!page._disposed) page.setData({ privacyVisible: false });
  if (resolve) resolve({ event, ...(event === 'agree' ? { buttonId: 'poster-privacy-agree' } : {}) });
}

function open(platform, page) {
  const fail = () => {
    if (!page._disposed) platform.showToast({ title: copy.home.privacyUnavailable, icon: 'none' });
  };
  if (platform.openPrivacyContract) platform.openPrivacyContract({ fail });
  else fail();
}

module.exports = { bind, unbind, finish, open };
