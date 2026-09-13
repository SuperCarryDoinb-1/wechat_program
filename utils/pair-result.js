const { validRid, publicResult } = require('./public-result');
const { loadFriend } = require('./friend-service');
const { pair } = require('./pairing');
const types = require('../config/types');

function buildPair(result, friend) {
  const own = publicResult(result), other = publicResult(friend);
  if (!own || !other) return null;
  return { ...pair(own.code, other.code), ownCode: own.code, friendCode: other.code,
    friendName: types[other.code].name, friendColor: types[other.code].color,
    friendCoords: { x: other.scores.rel / 24, y: other.scores.att / 24 } };
}
async function loadPair(platform, record, content, settings) {
  if (!validRid(record.fromRid) || !content || !content.persisted || !validRid(content.rid) ||
    !Object.prototype.hasOwnProperty.call(types, content.pairCode)) return null;
  const friend = await loadFriend(platform, record.fromRid, settings);
  // 再读取公开分数，不使用客户端传入的类型或坐标；邀请被删除时降级。
  if (!friend || friend.code !== content.pairCode) return null;
  return buildPair(record, friend);
}
module.exports = { buildPair, loadPair };
