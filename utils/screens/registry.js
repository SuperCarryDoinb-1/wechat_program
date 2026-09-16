const screens = {
  index: require('./index'),
  quiz: require('./quiz'),
  result: require('./result')
};

module.exports = {
  screens,
  home: 'index',
  resolveEntry(initial, options) {
    // 分享入口先展示邀请首页，不能读取接收者本机的旧结果。
    const invited = Object.prototype.hasOwnProperty.call(options, 'rid') || options.invite;
    return invited ? 'index' : initial;
  },
  prepareTransition(stage, options, previous) {
    if (stage === 'index' && previous) {
      const rid = previous._fromRid || (previous._record && previous._record.fromRid);
      if (rid) return { ...options, rid };
    }
    return options;
  },
  share(timeline) {
    return timeline ? screens.index.onShareTimeline() : screens.index.onShareAppMessage();
  }
};
