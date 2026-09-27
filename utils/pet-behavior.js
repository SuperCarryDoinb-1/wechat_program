const config = require('../config/pet');
const motion = require('./pet-motion');

// Shared movement, reactions and gestures for component and page-owned pets.
module.exports = function createPetBehavior(clock) {
  return {
    clearTimer(name) {
      if (this._timers && this._timers[name] !== undefined) {
        clock.clearTimeout(this._timers[name]); delete this._timers[name];
      }
    },
    clearTimers() {
      Object.keys(this._timers || {}).forEach(name => this.clearTimer(name));
      this._pendingDrag = this._queuedMood = this._touchOrigin = null;
      this._performing = false;
      if (this._alive) this.setData({ performing: '', trail: [], bubble: '', rainbow: false });
    },
    later(name, delay, callback) {
      this.clearTimer(name);
      if (!this._alive || !this._active) return;
      const id = clock.setTimeout(() => {
        if (this._timers[name] !== id) return;
        delete this._timers[name];
        if (this._alive && this._active) callback();
      }, delay);
      this._timers[name] = id;
    },
    position() { return { x: this._actualX, y: this._actualY }; },
    startMotion() {
      if (!this._alive || !this._active || this._dragging || this._performing || !this._bounds || !this.data.available || this.data.motionSuspended || this.data.imageFailed) return;
      if (this._timers.motion !== undefined) return;
      this._lastStep = clock.now();
      this.later('motion', config.tickMs, () => this.moveStep());
    },
    moveStep() {
      if (this._dragging || !this._bounds || !this.data.available) return;
      const current = this.position(), now = clock.now();
      // Do not jump forward to catch up after a busy page transition.
      const elapsed = Math.max(0, Math.min(config.tickMs, now - this._lastStep));
      this._lastStep = now;
      if (!this._target) this._target = motion.destination(current, this._bounds);
      const next = motion.step(current, this._target, (this.data.passive ? config.quizSpeed : config.speed) * elapsed / 1000);
      this._actualX = next.x; this._actualY = next.y;
      const update = { x: next.x, y: next.y, motionReady: true };
      if (Math.abs(this._target.x - current.x) > 12 && !this._touchOrigin) update.facing = this._target.x > current.x ? 1 : -1;
      this.setData(update);
      if (next.arrived) this._target = null;
      // No idle delay between destinations; movement and reaction timers are independent.
      this.later('motion', config.tickMs, () => this.moveStep());
    },
    react(mood = 'happy') {
      if (!this._alive || !this._active || !this.data.available || this.data.motionSuspended || this.data.imageFailed) return;
      // Let a reaction finish at its neutral pose before playing the next one.
      if (this._timers.reaction !== undefined) { this._queuedMood = mood; return; }
      this.setData({ mood: this.data.passive ? 'nod' : mood, beat: 1 - this.data.beat });
      this.later('reaction', config.reactionMs, () => {
        const queued = this._queuedMood;
        this._queuedMood = null;
        if (queued) this.react(queued);
        else this.setData({ mood: 'idle' });
      });
    },
    reactToAnswer() { if (!this._dragging && !this._performing) this.react(); },
    tapPet() {
      if (!this._alive || !this._active || !this.data.available || this.data.imageFailed || this.data.motionSuspended || this.data.passive || this._dragging || this._performing || clock.now() < (this._ignoreTapUntil || 0)) return;
      if (this._timers.tap !== undefined) {
        this.clearTimer('tap');
        const scene = this.properties && this.properties.scene;
        if (scene === 'home') this.drawHeart();
        else if (scene === 'result') this.blinkAway();
        else this.changeColor();
      } else this.later('tap', 280, () => this.changeColor());
    },
    changeColor() {
      this.clearTimer('reaction'); this._queuedMood = null;
      const hue = ((this.data.hue || 0) + 45 + Math.floor(Math.random() * 270)) % 360;
      const rainbow = clock.now() >= (this._rainbowAfter || 0) && Math.random() < .25;
      this.clearTimer('rainbow');
      this.setData({ hue, rainbow, mood: 'idle' });
      if (rainbow) {
        this._rainbowAfter = clock.now() + 20000;
        this.later('rainbow', 4000, () => this.setData({ rainbow: false }));
      }
    },
    stopPerformance() {
      this.clearTimer('performance'); this.clearTimer('trail'); this.clearTimer('bubble');
      this._performing = false; this._target = null;
      this.setData({ performing: '', trail: [], bubble: '' });
    },
    drawHeart() {
      if (!this._bounds) return;
      this.stopPerformance(); this.clearTimer('motion'); this.clearTimer('reaction');
      this._queuedMood = null; this._performing = true;
      const origin = this.position(), size = this.data.size;
      // Fit a local heart in the viewport; return to the exact starting position.
      const maxX = Math.max(0, this._width - size), maxY = Math.max(0, this._height - size);
      const scale = Math.min(4.2, maxX / 32, maxY / 30);
      const center = { x: Math.max(16 * scale, Math.min(maxX - 16 * scale, origin.x)),
        y: Math.max(12 * scale, Math.min(maxY - 18 * scale, origin.y)) };
      const heart = t => ({ x: center.x + scale * 16 * Math.pow(Math.sin(t), 3),
        y: center.y - scale * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) });
      const first = heart(0), started = clock.now(), trail = [];
      let previous = first;
      this.setData({ performing: 'heart', mood: 'idle', trail: [], motionReady: true });
      const frame = () => {
        const elapsed = Math.min(3000, clock.now() - started);
        let next;
        if (elapsed < 200) {
          const p = elapsed / 200;
          next = { x: origin.x + (first.x - origin.x) * p, y: origin.y + (first.y - origin.y) * p };
        } else if (elapsed <= 2800) {
          next = heart((elapsed - 200) / 2600 * Math.PI * 2);
          const dx = next.x - previous.x, dy = next.y - previous.y;
          trail.push({ id: trail.length, x: previous.x + size / 2, y: previous.y + size / 2,
            length: Math.hypot(dx, dy) + 2, angle: Math.atan2(dy, dx) * 180 / Math.PI,
            hue: (elapsed - 200) / 2600 * 360 });
          previous = next;
        } else {
          const p = (elapsed - 2800) / 200;
          next = { x: first.x + (origin.x - first.x) * p, y: first.y + (origin.y - first.y) * p };
        }
        this._actualX = next.x; this._actualY = next.y;
        this.setData({ ...next, trail: trail.slice() });
        if (elapsed < 3000) this.later('performance', 40, frame);
        else {
          this._performing = false;
          this.setData({ performing: '', trailFading: true });
          this.later('trail', 700, () => this.setData({ trail: [], trailFading: false }));
          this.startMotion();
        }
      };
      this.setData({ trailFading: false });
      this.later('performance', 40, frame);
    },
    blinkAway() {
      if (!this._bounds) return;
      this.stopPerformance(); this.clearTimer('motion');
      this._performing = true;
      const origin = this.position(), angle = Math.random() * Math.PI * 2;
      const distance = 45 + Math.random() * 35;
      let next = motion.project({ x: origin.x + Math.cos(angle) * distance, y: origin.y + Math.sin(angle) * distance }, this._bounds);
      if (Math.hypot(next.x - origin.x, next.y - origin.y) < 20) {
        next = motion.project({ x: origin.x - Math.cos(angle) * distance, y: origin.y - Math.sin(angle) * distance }, this._bounds);
      }
      this.setData({ performing: 'blink', mood: 'idle', bubble: '' });
      this.later('performance', 90, () => {
        this._actualX = next.x; this._actualY = next.y;
        this.setData({ ...next, bubble: '快来抓我', bubbleBelow: next.y < 50 });
        this.later('performance', 150, () => {
          this._performing = false; this.setData({ performing: '' }); this.startMotion();
        });
        this.later('bubble', 2200, () => this.setData({ bubble: '' }));
      });
    },
    touchStart(event) {
      if (!this._alive || !this._active || this.data.passive || this.data.motionSuspended || !this.data.available) return;
      if (this._touchOrigin) return;
      const touch = event && event.touches && event.touches[0];
      if (!touch || !Number.isFinite(touch.clientX) || !Number.isFinite(touch.clientY)) return;
      this._touchOrigin = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
      this._dragMoved = false;
      this._dragStart = this.position();
    },
    touchMove(event) {
      if (!this._alive || !this._active || !this._touchOrigin || !this._bounds) return;
      const touch = (event.touches || []).find(item => item.identifier === this._touchOrigin.id);
      if (!touch || !Number.isFinite(touch.clientX) || !Number.isFinite(touch.clientY)) return;
      if (!this._dragging) {
        if (Math.hypot(touch.clientX - this._touchOrigin.x, touch.clientY - this._touchOrigin.y) <= 5) return;
        this.clearTimer('tap'); this.stopPerformance();
        this._dragging = true;
        this.clearTimer('motion');
        this.setData({ dragging: true });
      }
      const next = motion.project({
        x: this._dragStart.x + touch.clientX - this._touchOrigin.x,
        y: this._dragStart.y + touch.clientY - this._touchOrigin.y
      }, this._bounds);
      this._actualX = next.x; this._actualY = next.y;
      this._pendingDrag = next;
      if (this._timers.drag === undefined) this.later('drag', config.dragTickMs, () => this.flushDrag());
      if (Math.hypot(next.x - this._dragStart.x, next.y - this._dragStart.y) > 5) this._dragMoved = true;
    },
    touchEnd(event) {
      if (!this._touchOrigin) return;
      if (event && event.changedTouches && !event.changedTouches.some(touch => touch.identifier === this._touchOrigin.id)) return;
      this._touchOrigin = null;
      if (!this._dragging) return;
      this.flushDrag();
      this._dragging = false; this._target = null;
      this.setData({ dragging: false });
      if (this._dragMoved) { this._ignoreTapUntil = clock.now() + 350; this.react('wave'); }
      this.startMotion();
    },
    touchCancel() {
      this._touchOrigin = null;
      if (!this._dragging) return;
      this.flushDrag();
      this._dragging = false; this._target = null;
      this._ignoreTapUntil = clock.now() + 350;
      if (this._alive && this._active) {
        this.setData({ dragging: false }); this.startMotion();
      }
    },
    flushDrag() {
      this.clearTimer('drag');
      if (this._pendingDrag && this._alive && this._active) this.setData(this._pendingDrag);
      this._pendingDrag = null;
    },
    applyBounds(bounds) {
      if (this._performing) this.stopPerformance();
      const current = this.position(), next = motion.project(current, bounds);
      this._bounds = bounds;
      if (this._target) this._target = motion.project(this._target, bounds);
      if (current.x !== next.x || current.y !== next.y) {
        this._pendingDrag = null;
        this.clearTimer('drag');
        this._actualX = next.x; this._actualY = next.y;
        this.setData(next);
        // A layout change during a drag starts from the corrected position.
        if (this._dragging) this.touchCancel();
      }
    },
  };
};
