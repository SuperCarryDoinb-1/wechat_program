const clone = value => JSON.parse(JSON.stringify(value));
const lifecycle = new Set(['onLoad', 'onShow', 'onReady', 'onHide', 'onUnload', 'onResize', 'onPageScroll']);

// 管理视图挂载、生命周期和事件转发；业务入口规则由 flow 注入。
module.exports = function createFlowRuntime(flow, initial, getPlatform) {
  const { screens } = flow;
  const definition = {
    data: { stage: initial, screen: clone(screens[initial].data) },
    onLoad(options = {}) {
      this._flowVisible = false;
      this._flowReady = false;
      this._flowDisposed = false;
      this._flowScrollTop = 0;
      this.changeScreen(flow.resolveEntry(initial, options), options);
    },
    onShow() { this._flowVisible = true; this.activateScreen(); },
    onReady() { this._flowReady = true; this.activateScreen(); },
    onHide() {
      this._flowVisible = false;
      const current = this._screen;
      if (current && current._shown) {
        current._shown = false;
        if (current.onHide) current.onHide();
      }
    },
    onUnload() {
      this._flowDisposed = true;
      this.disposeScreen();
    },
    onResize(event) {
      const current = this._screen;
      if (current && current._shown && current.onResize) current.onResize(event);
    },
    onPageScroll(event) {
      this._flowScrollTop = event.scrollTop;
      const current = this._screen;
      if (current && current._shown && current.onPageScroll) current.onPageScroll(event);
    },
    disposeScreen() {
      const current = this._screen;
      if (!current) return;
      if (current._shown && current.onHide) current.onHide();
      current._shown = false;
      if (current.onUnload) current.onUnload();
      current._disposed = true;
      this._screen = null;
    },
    activateScreen() {
      const current = this._screen;
      if (this._flowDisposed || !this._flowVisible || !this._flowReady || !current || !current._mounted) return;
      if (!current._shown) {
        current._shown = true;
        if (current.onShow) current.onShow();
      }
      if (!current._readyCalled) {
        current._readyCalled = true;
        if (current.onReady) current.onReady();
      }
    },
    changeScreen(stage, options = {}) {
      if (this._flowDisposed || !screens[stage]) return;
      const old = this._screen;
      options = flow.prepareTransition(stage, options, old);
      this.disposeScreen();
      const host = this;
      const callbacks = [];
      const current = {
        ...screens[stage], data: clone(screens[stage].data), _disposed: false,
        _mounted: false, _initializing: true, _shown: false, _readyCalled: false,
        // Canvas 查询必须使用真实的微信 Page 实例。
        _view: host,
        _flow: { go: (next, query) => {
          if (host._screen === current && !current._disposed) host.changeScreen(next, query);
        } },
        setData(update, done) {
          if (current._disposed || host._flowDisposed || host._screen !== current) { if (done) done(); return; }
          Object.assign(current.data, update);
          if (current._initializing) { if (done) callbacks.push(done); return; }
          const patch = {};
          Object.keys(update).forEach(key => { patch['screen.' + key] = update[key]; });
          host.setData(patch, done);
        }
      };
      this._screen = current;
      if (current.onLoad) current.onLoad(options);
      current._initializing = false;
      // onLoad 的更新一起提交，避免先显示空题或旧结果再补数据。
      this.setData({ stage, screen: current.data }, () => {
        if (this._flowDisposed || this._screen !== current) return;
        current._mounted = true;
        this.activateScreen();
        callbacks.forEach(done => done());
      });
      if (this._flowScrollTop > 0) {
        this._flowScrollTop = 0;
        getPlatform().pageScrollTo({ scrollTop: 0, duration: 0 });
      }
    },
    backToStart() { this.changeScreen(flow.home); },
    onShareAppMessage() {
      const current = this._screen;
      return current && current.onShareAppMessage ? current.onShareAppMessage() : flow.share(false);
    },
    onShareTimeline() {
      const current = this._screen;
      return current && current.onShareTimeline ? current.onShareTimeline() : flow.share(true);
    }
  };
  // WXML 事件与分享回调只交给当前视图，已退出视图不再接收事件。
  for (const screen of Object.values(screens)) {
    for (const name of Object.keys(screen)) {
      if (name === 'data' || lifecycle.has(name) || definition[name] || typeof screen[name] !== 'function') continue;
      definition[name] = function(...args) {
        const current = this._screen;
        if (!current || current._disposed || typeof current[name] !== 'function') return;
        return current[name](...args);
      };
    }
  }
  return definition;
};
