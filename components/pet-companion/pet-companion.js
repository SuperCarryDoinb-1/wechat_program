const config = require('../../config/pet');
const motion = require('../../utils/pet-motion');
const createPetBehavior = require('../../utils/pet-behavior');

Component({
  properties: {
    scene: { type: String, value: 'home' },
    avoidRects: { type: Array, value: [] },
    layoutReady: { type: Boolean, value: true },
    suspended: { type: Boolean, value: false }
  },
  data: {
    image: config.image, size: config.size, x: 0, y: 0, active: true,
    dragging: false, motionReady: false, motionSuspended: false,
    positioned: false, available: false, confirmed: false, passive: false, mood: 'idle', beat: 0, facing: 1, imageFailed: false
  },
  observers: {
    'avoidRects, layoutReady, suspended'() {
      if (this._alive && this._ready && this._active) this.updateBounds();
    }
  },
  lifetimes: {
    attached() {
      this._alive = this._active = true;
      this._ready = false;
      this._timers = {};
      this._width = this._height = this._actualX = this._actualY = 0;
      this._dragging = false;
      this._imageLoaded = false;
      const passive = this.properties.scene === 'quiz';
      this.setData({ passive, size: config.size });
    },
    ready() { this._ready = true; this.measure(); },
    detached() { this._alive = this._active = false; this.clearTimers(); }
  },
  pageLifetimes: {
    show() {
      this._active = true;
      if (this._ready) this.measure();
    },
    hide() {
      this._active = false;
      this.publishVisibility(false);
      this._dragging = false;
      this.clearTimers();
      if (this._alive) this.setData({ active: false, mood: 'idle', dragging: false, motionReady: false });
    },
    resize() { this.measure(); }
  },
  methods: {
    ...createPetBehavior({ setTimeout, clearTimeout, now: () => Date.now() }),
    publishVisibility(visible = this._active && this.data.active && this.data.positioned
      && this.data.available && this._imageLoaded && !this.data.imageFailed) {
      if (!this._alive || (visible && this._visible)) return;
      const version = this._visibilityVersion = (this._visibilityVersion || 0) + 1;
      const commit = value => {
        if (!this._alive || version !== this._visibilityVersion || this._visible === value) return;
        this._visible = value;
        this.setData({ confirmed: value }, () => {
          if (this._alive && version === this._visibilityVersion) this.triggerEvent('visibilitychange', { visible: value });
        });
      };
      if (!visible) { commit(false); return; }
      // Loading an image is not proof that its native node is on screen.
      // Keep the page-owned pet until the rendered component has usable bounds.
      try {
        this.createSelectorQuery().select('.pet-image').boundingClientRect(rect => {
          const valid = rect && ['left', 'top', 'width', 'height'].every(key => Number.isFinite(rect[key]))
            && rect.width >= this.data.size * .8 && rect.height >= this.data.size * .8
            && rect.left >= -8 && rect.top >= -8
            && rect.left + rect.width <= this._width + 8 && rect.top + rect.height <= this._height + 8;
          commit(!!valid);
        }).exec();
      } catch (_) { commit(false); }
    },
    hidePet() {
      this.clearTimers();
      this._dragging = false;
      this._imageLoaded = false;
      this.publishVisibility(false);
      this.setData({ available: false, mood: 'idle', dragging: false });
    },
    onImageLoad() {
      if (!this._alive || !this._active || !this.data.available || this.data.imageFailed) return;
      this._imageLoaded = true;
      this.publishVisibility();
    },
    measure() {
      if (!this._alive || !this._active) return;
      let info;
      try {
        info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      } catch (_) {
        this.hidePet(); return;
      }
      if (!info || !Number.isFinite(info.windowWidth) || !Number.isFinite(info.windowHeight)
        || info.windowWidth <= 0 || info.windowHeight <= 0) {
        this.hidePet(); return;
      }
      this._width = info.windowWidth; this._height = info.windowHeight;
      if (!this.data.positioned) {
        this._actualX = Math.max(0, this._width - this.data.size - 12);
        this._actualY = Math.max(0, this._height - this.data.size) * 0.25;
      }
      this.setData({ active: true });
      this.updateBounds();
    },
    updateBounds() {
      if (!this._width || !this._height) return;
      if (this.properties.suspended && this.data.positioned && !this.data.passive) {
        this.clearTimer('motion');
        this.touchCancel();
        this.clearTimer('motion');
        this.setData({ motionSuspended: true });
        return;
      }
      if (this.properties.suspended || !this.properties.layoutReady) {
        this.hidePet(); return;
      }
      const zones = motion.safeZones(this._width, this._height, this.data.size,
        this.properties.avoidRects, config.obstacleGap);
      const region = motion.nearestZone(this.position(), zones);
      if (!region) { this._bounds = null; this.hidePet(); return; }
      this.applyBounds(region.bounds);
      this.setData({ ...(!this.data.positioned ? region.point : {}), positioned: true, available: true, motionSuspended: false }, () => this.publishVisibility());
      this.startMotion();
    },
    onImageError() {
      if (!this._alive) return;
      this.clearTimers(); this.hidePet(); this.setData({ imageFailed: true });
    }
  }
});
