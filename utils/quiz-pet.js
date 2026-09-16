const config = require('../config/pet');
const motion = require('./pet-motion');
const createPetBehavior = require('./pet-behavior');

// Keep the native header image visible even when layout APIs are unavailable.
module.exports = function createQuizPet(page, wx, clock) {
  const pet = {
    ...createPetBehavior(clock),
    data: { available: true, passive: false, imageFailed: false, beat: 0, mood: 'idle' },
    _alive: true, _active: false, _timers: {}, _actualX: 0, _actualY: 0,
    _layoutVersion: 0, _dragging: false,
    setData(update) {
      Object.assign(this.data, update);
      if (!this._alive || page._disposed) return;
      const mapped = {};
      for (const key of ['x', 'y', 'mood', 'beat', 'facing', 'dragging', 'motionReady']) {
        if (key in update) mapped['pet' + key[0].toUpperCase() + key.slice(1)] = update[key];
      }
      if (Object.keys(mapped).length) page.setData(mapped);
    },
    refresh() {
      if (!this._alive || !this._active) return;
      // Coalesce queries without resetting the image, position or motion clock.
      if (this._measuring) { this._measureAgain = true; return; }
      const version = ++this._layoutVersion;
      this._measuring = true;
      const complete = () => {
        this._measuring = false;
        if (this._measureAgain) { this._measureAgain = false; this.refresh(); }
      };
      try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        if (!info || !Number.isFinite(info.windowWidth) || !Number.isFinite(info.windowHeight)) { complete(); return; }
        const query = wx.createSelectorQuery();
        query.select('.quiz-pet').boundingClientRect();
        query.selectAll('.screen-home, .progress-heading, .quiz-progress, .question-stage, .quiz-bottom, .submit-error').boundingClientRect();
        query.exec(results => {
          if (!this._alive || !this._active || version !== this._layoutVersion) return;
          if (this._measureAgain) { complete(); return; }
          const [anchor, obstacles] = results || [];
          const valid = rect => rect && ['left', 'right', 'top', 'bottom'].every(key => Number.isFinite(rect[key]));
          if (valid(anchor) && Array.isArray(obstacles) && obstacles.length && obstacles.every(valid)) {
            // Keep roaming and dragging inside the middle header slot.
            const zones = motion.safeZones(info.windowWidth, info.windowHeight, config.size, obstacles, 2)
              .map(bounds => ({
                minX: Math.max(bounds.minX, anchor.left),
                maxX: Math.min(bounds.maxX, anchor.right - config.size),
                minY: Math.max(bounds.minY, anchor.top),
                maxY: Math.min(bounds.maxY, anchor.bottom - config.size)
              }))
              .filter(bounds => bounds.minX <= bounds.maxX && bounds.minY <= bounds.maxY);
            const point = this._positioned ? this.position() : {
              x: (anchor.left + anchor.right - config.size) / 2,
              y: (anchor.top + anchor.bottom - config.size) / 2
            };
            const region = motion.nearestZone(point, zones);
            if (region) {
              if (!this._positioned) {
                this._actualX = region.point.x; this._actualY = region.point.y;
                this._positioned = true;
                page.setData({ petX: region.point.x, petY: region.point.y, petFloating: true });
              }
              this.applyBounds(region.bounds);
              this.startMotion();
            } else {
              // Only a genuinely blocked viewport needs the visible header fallback.
              this.clearTimer('motion'); this.touchCancel(); this.clearTimer('motion');
              this._positioned = false; this._bounds = this._target = null;
              page.setData({ petFloating: false, petMotionReady: false });
            }
          }
          complete();
        });
      } catch (_) { complete(); }
    },
    show() { this._active = true; this.refresh(); },
    hide() {
      this._active = false;
      ++this._layoutVersion;
      this._measuring = this._measureAgain = false;
      this._dragging = false;
      this.clearTimers();
      this.setData({ mood: 'idle', dragging: false, motionReady: false });
    },
    dispose() { this._alive = false; this.hide(); }
  };
  return pet;
};
