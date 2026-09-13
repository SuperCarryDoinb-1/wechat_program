const types = require('../../config/types');
const assets = require('../../config/assets');
const copy = require('../../config/copy');

Component({
  properties: { typeCode: { type: String, value: '' } },
  data: { type: null, code: '', image: '', copy: copy.result },
  observers: {
    typeCode(code) {
      const type = Object.prototype.hasOwnProperty.call(types, code) ? types[code] : null;
      this.setData({ type, code: type ? code : '', image: type ? assets.types[code] : '' });
    }
  },
  methods: {
    imageFailed(event) {
      if (event.currentTarget.dataset.code === this.data.code) this.setData({ image: '' });
    }
  }
});
