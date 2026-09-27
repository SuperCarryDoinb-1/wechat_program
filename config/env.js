// Public checkout uses mock mode. Configure your own AppID and cloud environment locally.
// Provider credentials belong only in cloud-function environment variables.
module.exports = {
  mode: 'mock',
  cloudEnvId: '',
  timeoutMs: 8000,
  showDiagnostics: false
};
