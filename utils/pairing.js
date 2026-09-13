const types = require('../config/types');
const config = require('../config/pairing');

function pair(codeA, codeB) {
  [codeA, codeB].forEach(code => {
    if (typeof code !== 'string' || !Object.prototype.hasOwnProperty.call(types, code)) {
      throw new TypeError('TYPE_CODE_INVALID');
    }
  });
  const different = [0, 1, 2].filter(i => codeA[i] !== codeB[i]);
  const level = different.length;
  const special = config.specials.find(item =>
    (item.codes[0] === codeA && item.codes[1] === codeB) ||
    (item.codes[0] === codeB && item.codes[1] === codeA));
  const content = special || config.levels[level];
  return {
    level, name: content.name,
    text: !special && level === 1 ? config.complements[different[0]] : content.text
  };
}
module.exports = { pair };
