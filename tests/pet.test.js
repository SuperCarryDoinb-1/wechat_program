const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const config = require('../config/pet');
const motion = require('../utils/pet-motion');
const root = path.resolve(__dirname, '..');

function harness(scene = 'home', width = 375, height = 667) {
  let definition, sequence = 0, now = 1000, observerDepth = 0;
  const timers = new Map(), events = [];
  const wx = { getWindowInfo: () => ({ windowWidth: width, windowHeight: height }) };
  const filename = path.join(root, 'components/pet-companion/pet-companion.js');
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    Component(value) { definition = value; }, require: createRequire(filename),
    Date: { now: () => now }, wx,
    setTimeout(callback, delay) { timers.set(++sequence, { callback, delay }); return sequence; },
    clearTimeout(id) { timers.delete(id); }
  });
  const pet = { ...definition.methods,
    properties: { scene, avoidRects: [], layoutReady: scene !== 'quiz', suspended: false },
    data: structuredClone(definition.data),
    setData(update, done) {
      assert.notEqual(this._alive, false);
      Object.assign(this.data, update);
      for (const key of Object.keys(update)) {
        if (key in this.properties) this.properties[key] = update[key];
      }
      // WeChat observes setData fields even when their values are unchanged.
      // Model that behavior so writes back to watched properties cannot pass tests.
      for (const [fields, observer] of Object.entries(definition.observers || {})) {
        if (!fields.split(',').some(field => field.trim() in update)) continue;
        assert.ok(observerDepth < 20, 'Pet setData recursively triggered its own observer');
        observerDepth++;
        try { observer.call(this); } finally { observerDepth--; }
      }
      if (done) done();
    },
    triggerEvent(name, detail) { events.push({ name, detail }); }
  };
  definition.lifetimes.attached.call(pet); definition.lifetimes.ready.call(pet);
  function measure() { pet.measure(); }
  function fire(name) {
    const id = pet._timers[name]; assert.ok(timers.has(id), 'Expected ' + name);
    const timer = timers.get(id); timers.delete(id); now += timer.delay; timer.callback();
  }
  function lifecycle(name) { (definition.pageLifetimes[name] || definition.lifetimes[name]).call(pet); }
  function props(update) { Object.assign(pet.properties, update); pet.updateBounds(); }
  return { pet, timers, wx, events, fire, measure, lifecycle, props,
    elapse(ms) { now += ms; },
    start() { pet.touchStart({ touches: [{ clientX: 0, clientY: 0, identifier: 1 }] }); },
    arrive(x, y) { pet.touchMove({ touches: [{ clientX: x - pet._dragStart.x, clientY: y - pet._dragStart.y, identifier: 1 }] }); },
    resize(w, h) { width = w; height = h; lifecycle('resize'); measure(); } };
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const overlaps = (p, size, r) => p.x < r.right && p.x + size > r.left && p.y < r.bottom && p.y + size > r.top;

test('pet: handoff waits for image load and real bounds; stale confirmations cannot hide the page pet', () => {
  const h = harness('quiz'), reads = [];
  h.pet.createSelectorQuery = () => {
    const query = { select(selector) { assert.equal(selector, '.pet-image'); return query; },
      boundingClientRect(done) { reads.push(done); return query; }, exec() {} };
    return query;
  };
  const visible = () => h.events.at(-1).detail.visible;
  assert.equal(visible(), false);
  h.props({ layoutReady: true, avoidRects: [] });
  assert.equal(visible(), false); assert.equal(reads.length, 0);
  h.pet.onImageLoad(); assert.equal(visible(), false);
  reads.shift()({ left: 0, top: 0, width: 0, height: 0 });
  assert.equal(visible(), false, 'A loaded zero-size node must not take over');
  h.pet.publishVisibility();
  reads.shift()({ left: 200, top: 100, width: config.size, height: config.size });
  assert.equal(visible(), true); assert.equal(h.pet.data.confirmed, true);
  h.props({ suspended: true });
  assert.equal(visible(), false); assert.equal(h.pet.data.confirmed, false);
  h.props({ suspended: false }); assert.equal(visible(), false);
  h.pet.onImageLoad(); const late = reads.shift();
  h.props({ layoutReady: false });
  late({ left: 200, top: 100, width: config.size, height: config.size });
  assert.equal(visible(), false, 'A late callback cannot take over after layout was invalidated');
  h.props({ layoutReady: true }); h.pet.onImageLoad();
  reads.shift()({ left: 600, top: 100, width: config.size, height: config.size });
  assert.equal(visible(), false, 'An offscreen node must not take over');
  h.pet.publishVisibility(); const detached = reads.shift();
  h.lifecycle('detached'); detached({ left: 200, top: 100, width: config.size, height: config.size });
  assert.equal(visible(), false);
});

test('pet: starts immediately and moves continuously at a bounded slow speed', () => {
  const h = harness(); h.measure();
  for (let i = 0; i < 250; i++) {
    const previous = { x: h.pet.data.x, y: h.pet.data.y };
    h.fire('motion');
    const moved = distance(previous, h.pet.data);
    assert.ok(moved > 0 && moved <= config.speed * config.tickMs / 1000 + 1e-8);
    assert.ok(h.pet.data.x >= 0 && h.pet.data.x <= 375 - config.size);
    assert.ok(h.pet.data.y >= 0 && h.pet.data.y <= 667 - config.size);
    assert.equal(h.timers.size, 1);
  }
});

test('pet: home and result keep parent suspension separate from internal animation state', () => {
  for (const scene of ['home', 'result']) {
    const h = harness(scene);
    assert.equal(h.pet.data.positioned, true);
    assert.equal(h.pet.data.available, true);
    const position = h.pet.position();
    h.props({ suspended: true });
    assert.equal(h.pet.properties.suspended, true, 'The component cannot overwrite a watched parent property');
    assert.equal(h.pet.data.motionSuspended, true);
    assert.equal(h.pet.data.available, true, 'Suspending movement must not unmount the visible image');
    assert.equal(h.pet._timers.motion, undefined);
    const beat = h.pet.data.beat;
    h.pet.tapPet(); assert.equal(h.pet.data.beat, beat);
    h.props({ suspended: false });
    assert.equal(h.pet.data.motionSuspended, false);
    assert.deepEqual(h.pet.position(), position);
    assert.ok(h.timers.has(h.pet._timers.motion));
    h.lifecycle('detached'); assert.equal(h.timers.size, 0);
  }
});

test('pet: crossing a destination continues on the very next tick', () => {
  const h = harness(); h.measure();
  const p = h.pet.position();
  h.pet._target = { x: p.x - .1, y: p.y };
  h.fire('motion'); const next = h.pet.position();
  assert.ok(distance(p, next) > 0);
  h.fire('motion'); assert.ok(distance(next, h.pet.position()) > 0);
});

test('pet: home and result remeasurement preserves position, target, reaction and the motion timer', () => {
  for (const scene of ['home', 'result']) {
    const h = harness(scene); h.fire('motion'); h.pet.tapPet();
    const start = h.pet.position(), target = { ...h.pet._target };
    const motionTimer = h.pet._timers.motion, reactionTimer = h.pet._timers.reaction;
    for (let i = 0; i < 20; i++) {
      h.measure(); h.props({ avoidRects: [] });
      assert.deepEqual(h.pet.position(), start);
      assert.deepEqual(h.pet._target, target);
      assert.equal(h.pet._timers.motion, motionTimer);
      assert.equal(h.pet._timers.reaction, reactionTimer);
      assert.equal(h.pet.data.mood, 'happy');
    }
    h.lifecycle('hide'); h.elapse(3000); h.lifecycle('show');
    assert.deepEqual(h.pet.position(), start);
    h.fire('motion'); assert.ok(distance(start, h.pet.position()) <= config.speed * config.tickMs / 1000 + 1e-8);
    h.lifecycle('detached');
  }
});

test('pet: a real tap or slight finger movement never interrupts walking or the current reaction', () => {
  const h = harness(); h.pet.tapPet();
  const movement = h.pet._timers.motion, reaction = h.pet._timers.reaction;
  h.start();
  h.pet.touchMove({ touches: [{ clientX: 2, clientY: 2, identifier: 1 }] });
  h.pet.touchEnd(); h.pet.tapPet();
  assert.equal(h.pet._dragging, false);
  assert.equal(h.pet._timers.motion, movement);
  assert.equal(h.pet._timers.reaction, reaction);
  h.lifecycle('detached');
});

test('pet: dense drag events batch view updates and release flushes the last finger position', () => {
  const h = harness(), writes = [], setData = h.pet.setData;
  h.pet.setData = function(update, done) { writes.push(update); setData.call(this, update, done); };
  h.start();
  for (let i = 0; i < 100; i++) h.arrive(20 + i, 200);
  assert.equal(writes.filter(update => 'x' in update).length, 0);
  assert.equal(h.pet.data.dragging, true);
  assert.equal(h.pet._timers.motion, undefined);
  h.fire('drag');
  assert.equal(writes.filter(update => 'x' in update).length, 1);
  assert.equal(h.pet.data.x, 119);
  h.arrive(180, 250); h.pet.touchEnd();
  assert.equal(h.pet.data.x, 180); assert.equal(h.pet.data.y, 250);
  assert.equal(h.pet.data.dragging, false);
  assert.equal(h.pet._timers.drag, undefined);
  assert.ok(h.timers.has(h.pet._timers.motion));
  h.lifecycle('detached');
});

test('pet: delayed logic frames cannot cause a large catch-up jump', () => {
  const h = harness(); const before = h.pet.position();
  h.elapse(2000); h.fire('motion');
  const moved = distance(before, h.pet.position());
  assert.ok(moved > 0 && moved <= config.speed * config.tickMs / 1000 + 1e-8);
  h.lifecycle('detached');
});

test('pet: interaction animation never pauses the motion clock', () => {
  const h = harness(); h.measure();
  const timer = h.pet._timers.motion;
  h.pet.tapPet(); const beat = h.pet.data.beat;
  h.pet.tapPet(); assert.equal(h.pet.data.beat, beat);
  assert.equal(h.pet._timers.motion, timer);
  h.pet.reactToAnswer();
  assert.equal(h.timers.size, 2);
  const p = h.pet.position(); h.fire('motion'); assert.ok(distance(p, h.pet.position()) > 0);
  h.fire('reaction'); assert.notEqual(h.pet.data.beat, beat);
  h.fire('reaction'); assert.equal(h.pet.data.mood, 'idle');
  assert.ok(h.timers.has(h.pet._timers.motion));
});

test('pet: dragging reaches corners and releasing resumes continuous movement', () => {
  const h = harness(); h.measure();
  for (const [x, y, expectedX, expectedY] of [
    [-100, -100, 0, 0], [9999, -100, 271, 0], [-100, 9999, 0, 563], [9999, 9999, 271, 563]
  ]) {
    h.start(); assert.ok(h.timers.has(h.pet._timers.motion));
    h.arrive(x, y); h.pet.touchEnd();
    assert.equal(h.pet.data.x, expectedX); assert.equal(h.pet.data.y, expectedY);
    assert.ok(h.timers.has(h.pet._timers.motion));
  }
  const beat = h.pet.data.beat;
  h.pet.tapPet(); assert.equal(h.pet.data.beat, beat);
  h.start(); h.arrive(20, 30); h.pet.touchCancel();
  assert.equal(h.pet.data.x, 20); assert.equal(h.pet.data.y, 30);
  assert.equal(h.pet._dragging, false); assert.ok(h.timers.has(h.pet._timers.motion));
});

test('pet: safe regions protect the entire image, including every intermediate path position', () => {
  const obstacles = [
    { left: 15, right: 350, top: 180, bottom: 510 },
    { left: 0, right: 375, top: 560, bottom: 650 }
  ];
  const zones = motion.safeZones(375, 667, 64, obstacles, 10);
  assert.ok(zones.length);
  for (const zone of zones) {
    let p = motion.project({ x: 200, y: 300 }, zone);
    for (let n = 0; n < 30; n++) {
      const target = motion.destination(p, zone);
      for (let i = 0; i < 300; i++) {
        const next = motion.step(p, target, .72);
        for (const r of obstacles) assert.equal(overlaps(next, 64, r), false);
        p = next; if (next.arrived) break;
      }
    }
  }
});

test('pet: short obstacles do not erase a tall free corridor', () => {
  const obstacle = { left: 120, right: 250, top: 90, bottom: 160 };
  const zones = motion.safeZones(250, 250, config.size, [obstacle], config.obstacleGap);
  const region = motion.nearestZone({ x: 0, y: 110 }, zones);
  assert.ok(region, 'A 110px wide corridor fits the 104px pet');
  assert.deepEqual(region.point, { x: 0, y: 110 });
  assert.equal(overlaps(region.point, config.size, obstacle), false);
});

test('pet: crowded quiz screens keep a full-size visible pet in the reserved header space', () => {
  for (const [width, height] of [[320, 480], [375, 667], [430, 820]]) {
    const h = harness('quiz', width, height);
    const padding = width * 32 / 750;
    const space = config.size + config.obstacleGap * 2 + 16;
    const top = 20, headerBottom = top + space;
    const obstacles = [
      { left: padding, right: width - padding - space, top, bottom: headerBottom },
      // Treat all remaining content as blocked: even four full-width long options
      // must leave the header refuge visible, with room to continue moving.
      { left: 0, right: width, top: headerBottom + 10, bottom: height }
    ];
    h.props({ avoidRects: obstacles, layoutReady: true });
    assert.equal(h.pet.data.available, true, 'visible at width ' + width);
    assert.equal(h.pet.data.size, config.size);
    const start = h.pet.position();
    for (let i = 0; i < 150; i++) {
      h.fire('motion');
      for (const rect of obstacles) assert.equal(overlaps(h.pet.position(), config.size, rect), false);
    }
    assert.ok(distance(start, h.pet.position()) > 0);
    h.pet.reactToAnswer(); assert.equal(h.pet.data.mood, 'nod');
    h.props({ layoutReady: false }); h.props({ layoutReady: true });
    assert.equal(h.pet.data.available, true, 'restores after the next question');
    h.lifecycle('hide'); h.lifecycle('show');
    assert.equal(h.pet.data.available, true, 'restores after returning to the page');
  }
});

test('pet: quiz waits for layout, uses slow passive mode and avoids option rectangles', () => {
  const h = harness('quiz'); h.measure();
  assert.equal(h.pet.data.available, false); assert.equal(h.timers.size, 0);
  const options = { left: 0, right: 375, top: 170, bottom: 667 };
  h.props({ layoutReady: true, avoidRects: [options] });
  assert.equal(h.pet.data.size, config.size); assert.equal(h.pet.data.passive, true);
  assert.equal(h.pet.data.available, true);
  for (let i = 0; i < 150; i++) {
    const previous = h.pet.position();
    h.fire('motion');
    assert.ok(distance(previous, h.pet.position()) <= config.quizSpeed * config.tickMs / 1000 + 1e-8);
    assert.equal(overlaps(h.pet.position(), config.size, options), false);
  }
  const beat = h.pet.data.beat;
  h.pet.tapPet(); h.start();
  assert.equal(h.pet.data.beat, beat); assert.equal(h.pet._dragging, false);
  h.pet.reactToAnswer(); assert.equal(h.pet.data.mood, 'nod');
  assert.ok(h.timers.has(h.pet._timers.motion));
});

test('pet: no safe space or scrolling hides it; new layout restores safe movement', () => {
  const h = harness('quiz'); h.measure();
  h.props({ layoutReady: true, avoidRects: [{ left: 0, right: 375, top: 0, bottom: 667 }] });
  assert.equal(h.pet.data.available, false); assert.equal(h.timers.size, 0);
  h.props({ avoidRects: [] }); assert.equal(h.pet.data.available, true);
  h.props({ suspended: true }); assert.equal(h.pet.data.available, false); assert.equal(h.timers.size, 0);
  h.props({ suspended: false }); assert.equal(h.pet.data.available, true); assert.equal(h.timers.size, 1);
});

test('pet: hide and detach cancel motion and stale callbacks cannot revive it', () => {
  const h = harness();
  const staleTimer = [...h.timers.values()][0].callback;
  h.lifecycle('hide'); const hidden = { ...h.pet.data };
  staleTimer(); h.pet.tapPet(); h.measure();
  assert.deepEqual(h.pet.data, hidden); assert.equal(h.timers.size, 0);
  h.lifecycle('show'); staleTimer(); assert.equal(h.timers.size, 1);
  h.lifecycle('detached'); h.measure(); staleTimer(); assert.equal(h.timers.size, 0);
});

test('pet: viewport resize clamps position and invalid dimensions hide safely', () => {
  const h = harness();
  h.start(); h.arrive(9999, 9999); h.pet.touchEnd();
  h.resize(240, 400); assert.equal(h.pet.data.x, 136); assert.equal(h.pet.data.y, 296);
  h.resize(80, 80); assert.equal(h.pet.data.available, false); assert.equal(h.timers.size, 0);
  h.resize(NaN, 667); assert.equal(h.pet.data.available, false);
  h.resize(375, 667); assert.equal(h.pet.data.available, true);
  h.wx.getWindowInfo = () => { throw Error('unavailable'); };
  h.measure(); assert.equal(h.pet.data.available, false); assert.equal(h.timers.size, 0);
  delete h.wx.getWindowInfo;
  h.wx.getSystemInfoSync = () => ({ windowWidth: 375, windowHeight: 667 });
  h.measure(); assert.equal(h.pet.data.available, true);
});

test('pet: image failure stops all activity', () => {
  const h = harness(); h.measure(); h.pet.onImageError(); h.pet.tapPet();
  assert.equal(h.pet.data.imageFailed, true); assert.equal(h.timers.size, 0);
});

test('pet: only the initiating finger can move or finish a drag', () => {
  const h = harness(); const p = h.pet.position();
  h.pet.touchMove({ touches: [{ clientX: 0, clientY: 0, identifier: 1 }] });
  assert.deepEqual(h.pet.position(), p);
  h.start();
  h.pet.touchStart({ touches: [{ clientX: 100, clientY: 100, identifier: 2 }] });
  h.pet.touchMove({ touches: [{ clientX: 0, clientY: 0, identifier: 2 }] });
  assert.deepEqual(h.pet.position(), p);
  h.pet.touchEnd({ changedTouches: [{ identifier: 2 }] });
  assert.equal(h.pet._touchOrigin.id, 1);
  h.arrive(20, 30);
  h.fire('drag');
  assert.equal(h.pet.data.x, 20); assert.equal(h.pet.data.y, 30);
  h.pet.touchEnd({ changedTouches: [{ identifier: 1 }] });
  assert.equal(h.pet._dragging, false); assert.ok(h.timers.has(h.pet._timers.motion));
});

test('pet: home and quiz share one size; home movement and dragging avoid the start button', () => {
  const home = harness(), quiz = harness('quiz');
  assert.equal(home.pet.data.size, quiz.pet.data.size);
  const button = { left: 15, right: 360, top: 410, bottom: 485 };
  home.props({ avoidRects: [button], layoutReady: true });
  home.start(); home.arrive(100, 440); home.pet.touchEnd();
  for (let n = 0; n < 250; n++) {
    assert.equal(overlaps(home.pet.position(), config.size, button), false);
    home.fire('motion');
  }
});

test('pet: overlay remains frameless and quiz pet cannot capture option taps', () => {
  const wxml = fs.readFileSync(path.join(root, 'components/pet-companion/pet-companion.wxml'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'components/pet-companion/pet-companion.wxss'), 'utf8');
  assert.doesNotMatch(wxml, /<button|<text|pet-home|pet-message|pet-floor/);
  assert.doesNotMatch(wxml, /movable-area|movable-view|pet-track|pet-layer/);
  assert.match(wxml, /width: {{size}}px; height: {{size}}px/);
  assert.match(wxml, /catchtouchmove="touchMove"/);
  assert.match(css, /\.pet-walker\s*\{[^}]*position: fixed/);
  assert.match(css, /\.pet-walker\.is-passive\s*\{[^}]*pointer-events:\s*none/);
  for (const name of ['index', 'result']) {
    const page = fs.readFileSync(path.join(root, 'pages', name, name + '-view.wxml'), 'utf8').trim();
    assert.match(page, /<\/view>\s*<pet-companion[^>]+\/>$/);
  }
  assert.match(config.image, /pink\.png$/);
  const png = fs.readFileSync(path.join(root, config.image));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png[25], 6, 'PNG includes alpha');
});
