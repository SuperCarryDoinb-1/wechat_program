const cloud = require('wx-server-sdk');
const { createHandler } = require('./handler');
const { createProvider } = require('./provider');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, timeout: 6000 });
exports.main = createHandler(cloud, createProvider(cloud, process.env));
