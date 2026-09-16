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
      if (!this._alive || !this._active || this._dragging || !this._bounds || !this.data.available || this.data.motionSuspended || this.data.imageFailed) return;
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
    reactToAnswer() { if (!this._dragging) this.react(); },
    tapPet() {
      if (this.data.passive || this._dragging || clock.now() < (this._ignoreTapUntil || 0)) return;
      this.react();
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
