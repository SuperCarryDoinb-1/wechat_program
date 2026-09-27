const types = require('../config/types');
const assets = require('../config/assets');
const copy = require('../config/copy');
function typePreview(code) {
  const type = types[code];
  const brief = copy.home.previews.find(item => item.code === code);
  return { code, name: type.name, image: assets.types[code], description: brief ? brief.description : type.slogan };
}
module.exports = { typePreview };
