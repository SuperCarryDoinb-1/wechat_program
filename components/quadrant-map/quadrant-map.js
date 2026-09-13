const copy = require('../../config/copy');
const pairCopy = require('../../config/pair-view');
Component({
  properties: {
    coords: { type: Object, value: null },
    friendCoords: { type: Object, value: null },
    friendAccent: { type: String, value: '#42D9CE' },
    accent: { type: String, value: '#B9FF66' }
  },
  data: { copy: copy.result, pairCopy, valid: false, left: 50, top: 50, friendValid: false, friendLeft: 50, friendTop: 50, connection: [], samePoint: false },
  observers: {
    'coords, friendCoords'(coords, friend) {
      const valid = value => value && Number.isFinite(value.x) && Number.isFinite(value.y);
      if (!valid(coords) || !valid(friend)) { this.setData({ friendValid: false, connection: [], samePoint: false }); return; }
      const clamp = value => Math.max(-1, Math.min(1, value));
      const left = (clamp(coords.x) + 1) * 50, top = (1 - clamp(coords.y)) * 50;
      const friendLeft = (clamp(friend.x) + 1) * 50, friendTop = (1 - clamp(friend.y)) * 50;
      const samePoint = left === friendLeft && top === friendTop;
      const connection = samePoint ? [] : Array.from({ length: 41 }, (_, index) => ({
        id: index, left: left + (friendLeft - left) * index / 40, top: top + (friendTop - top) * index / 40
      }));
      this.setData({ friendValid: true, friendLeft, friendTop, connection, samePoint });
    },
    coords(coords) {
      const valid = !!coords && Number.isFinite(coords.x) && Number.isFinite(coords.y);
      const clamp = value => Math.min(1, Math.max(-1, value));
      this.setData({ valid, left: valid ? (clamp(coords.x) + 1) * 50 : 50,
        top: valid ? (1 - clamp(coords.y)) * 50 : 50 });
    }
  }
});
