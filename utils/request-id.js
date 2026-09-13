// 仅用于当前客户端提交关联，不是用户身份，也不作为服务端授权凭证。
let sequence = 0;
module.exports = function requestId() {
  sequence += 1;
  return `${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};
