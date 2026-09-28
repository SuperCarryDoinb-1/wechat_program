// 使用微信云开发，无需自建服务器或配置服务器域名。
// cloudEnvId 填写 YOUR_APPID 关联的实际云环境 ID（不是 AppID）。
// 未填写时使用离线兜底，不能保存云端结果或读取好友结果；前端不得放置任何密钥。
module.exports = {
  mode: 'cloud',
  cloudEnvId: '',
  timeoutMs: 8000,
  showDiagnostics: false
};
