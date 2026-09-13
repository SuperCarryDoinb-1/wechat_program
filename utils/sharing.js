const types = require('../config/types');
const assets = require('../config/assets');
const copy = require('../config/sharing');
const { validRid } = require('./public-result');
const pairCopy = require('../config/pair-view');
const { pair } = require('./pairing');

function canShareResult(result, content) {
  return !!(result && Object.prototype.hasOwnProperty.call(types, result.code) &&
    content && content.code === result.code && content.persisted === true && validRid(content.rid));
}

function sharePayload(result, content, timeline = false, pairing = null) {
  const identified = canShareResult(result, content);
  const query = identified ? `rid=${encodeURIComponent(content.rid)}` : 'invite=1';
  let title = identified ? (result.code === 'TEM' ? copy.hiddenTitle :
    copy.ordinaryTitle.replace('{typeName}', types[result.code].name)) : copy.genericTitle;
  if (identified && pairing && pairing.ownCode === result.code && pairing.friendCode === content.pairCode &&
    Object.prototype.hasOwnProperty.call(types, pairing.friendCode)) {
    title = pairCopy.shareTitle.replace('{friendName}', types[pairing.friendCode].name)
      .replace('{pairName}', pair(result.code, pairing.friendCode).name);
  }
  const imageUrl = identified ? assets.share[result.code] : assets.shareGeneric;
  return { title, ...(timeline ? { query } : { path: `/pages/index/index?${query}` }), ...(imageUrl ? { imageUrl } : {}) };
}

module.exports = { sharePayload, canShareResult };
