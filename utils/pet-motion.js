const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Keep overlapping free rectangles: trimming the side strips to the obstacle's
// height can discard a tall empty corridor that still fits the whole pet.
function safeZones(width, height, size, obstacles = [], gap = 8) {
  let zones = [{ left: 0, top: 0, right: width, bottom: height }];
  for (const rect of obstacles) {
    if (!rect || !['left', 'top', 'right', 'bottom'].every(key => Number.isFinite(rect[key]))) continue;
    if (rect.right <= rect.left || rect.bottom <= rect.top) continue;
    const block = { left: rect.left - gap, top: rect.top - gap, right: rect.right + gap, bottom: rect.bottom + gap };
    zones = zones.flatMap(zone => {
      const left = Math.max(zone.left, block.left), right = Math.min(zone.right, block.right);
      const top = Math.max(zone.top, block.top), bottom = Math.min(zone.bottom, block.bottom);
      if (left >= right || top >= bottom) return [zone];
      return [
        { ...zone, bottom: top }, { ...zone, top: bottom },
        { ...zone, right: left }, { ...zone, left: right }
      ];
    }).filter(zone => zone.right - zone.left >= size && zone.bottom - zone.top >= size);
    // Remove duplicates and contained regions so successive cuts remain small.
    zones = zones.filter((zone, index, all) => !all.some((other, j) => j !== index
      && other.left <= zone.left && other.top <= zone.top && other.right >= zone.right && other.bottom >= zone.bottom
      && (j < index || other.left < zone.left || other.top < zone.top || other.right > zone.right || other.bottom > zone.bottom)));
  }
  return zones.filter(zone => zone.right - zone.left >= size && zone.bottom - zone.top >= size)
    .map(zone => ({ minX: zone.left, minY: zone.top, maxX: zone.right - size, maxY: zone.bottom - size }));
}

function project(point, bounds) {
  return { x: clamp(point.x, bounds.minX, bounds.maxX), y: clamp(point.y, bounds.minY, bounds.maxY) };
}

function nearestZone(point, zones) {
  return zones.reduce((best, zone) => {
    const p = project(point, zone), distance = Math.hypot(p.x - point.x, p.y - point.y);
    return !best || distance < best.distance ? { bounds: zone, point: p, distance } : best;
  }, null);
}

function destination(point, bounds, random = Math.random) {
  let target = { x: bounds.minX + random() * (bounds.maxX - bounds.minX), y: bounds.minY + random() * (bounds.maxY - bounds.minY) };
  if (Math.hypot(target.x - point.x, target.y - point.y) < 16) {
    target = { x: point.x < (bounds.minX + bounds.maxX) / 2 ? bounds.maxX : bounds.minX,
      y: point.y < (bounds.minY + bounds.maxY) / 2 ? bounds.maxY : bounds.minY };
  }
  return target;
}

function step(point, target, pixels) {
  const dx = target.x - point.x, dy = target.y - point.y, distance = Math.hypot(dx, dy);
  if (!distance || distance <= pixels) return { ...target, arrived: true };
  return { x: point.x + dx / distance * pixels, y: point.y + dy / distance * pixels, arrived: false };
}

module.exports = { safeZones, project, nearestZone, destination, step };
