const cloud = require('wx-server-sdk');
const { createHandler } = require('./handler');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = createHandler(cloud, process.env);
