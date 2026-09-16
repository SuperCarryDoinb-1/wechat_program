const flow = require('./screens/registry');
const createFlowRuntime = require('./flow-runtime');

// Preserve the three native route entries; business policy lives in the registry.
module.exports = function createPageFlow(initial = flow.home) {
  return createFlowRuntime(flow, initial, () => wx);
};
