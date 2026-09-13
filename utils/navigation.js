const copy = require('../config/copy');
const { validRid } = require('./public-result');
function fail() { wx.showToast({ title: copy.errors.navigation, icon: 'none' }); }
function quizUrl(fromRid) {
  return '/pages/quiz/quiz' + (validRid(fromRid) ? `?fromRid=${encodeURIComponent(fromRid)}` : '');
}
module.exports = {
  quizUrl,
  quiz(onFail, fromRid) {
    wx.navigateTo({ url: quizUrl(fromRid), fail: () => {
      fail();
      if (typeof onFail === 'function') onFail();
    } });
  },
  home() { wx.reLaunch({ url: '/pages/index/index', fail }); }
};
