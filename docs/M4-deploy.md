# M4 部署与验收

当前没有实际云环境 ID、模型配置或部署凭据，本轮没有部署或执行真实模型调用。下面的步骤用于真实环境验收。

## 部署清单

1. 在项目目录运行 `node tests/sync-cloud.js`，同步云函数配置副本；运行 `node tests/run.js` 检查全部模块。
2. 按 README 开通环境、创建 `results` 并配置客户端禁止直接读写的规则。核对函数运行环境与前端环境 ID 一致。
3. 在开发者工具中对 `genContent` 与 `getResult` 分别选择「上传并部署：云端安装依赖」。`genContent` 使用 Node.js 18 或更新运行时，执行超时设为至少 15 秒。
4. `genContent` 依赖固定为 `wx-server-sdk@3.0.5-beta.1`，这是官方 AI 文档列出的最低支持版本；该版本是预发布版本，**本轮未实际安装验证**。若控制台安装不成功，使用控制台可安装且支持 `cloud.ai()` 的 SDK 版本，再执行下方真实验收。使用兼容 HTTP 模式不依赖 `cloud.ai()` 能力，可单独选择可用的稳定 SDK 版本。
5. `getResult` 使用 `wx-server-sdk@~3.0.1`。两个函数的 `shared/` 已随代码生成，勿只上传入口文件。

## 三种运行方式

| 方式 | 前端 config/env.js | genContent 云函数环境变量 | 结果 |
|---|---|---|---|
| 本地演示 | mode=mock | 无需部署 | 示例解读，无云 rid |
| 云端无模型 | mode=cloud，实际环境ID | 留空，或 AITI_AI_PROVIDER=mock | 示例解读，真实云 rid |
| 云端内置 AI（优先） | mode=cloud，实际环境ID | AITI_AI_PROVIDER=cloudbase；AITI_AI_MODEL=可用模型ID | 成功时 AI 生成，失败时预设解读 |
| 自备模型 API | mode=cloud，实际环境ID | AITI_AI_PROVIDER=compatible；AITI_AI_MODEL；AITI_AI_KEY；可选 AITI_AI_ENDPOINT | 成功时 AI 生成，失败时预设解读 |

变量只设置在云函数控制台，前端不持有 API key。内置 AI 模型 ID 从该环境可用模型列表选取；没有预设一个可能不可用的型号。兼容 HTTP 地址默认 `https://api.deepseek.com/chat/completions`，其他服务需提供支持相同 JSON 请求/响应结构的完整 HTTPS 地址，不跟随重定向。

## 真实云端验证

必须从已关联 AppID 的小程序调用，以便 `getWXContext()` 获得可信 OPENID。控制台直接测试如果没有用户上下文，将返回 `UNAUTHENTICATED`；不要把 openid 放进 event 绕过校验。

在开发者工具调试控制台执行以下代码，使用固定测试答案；它会实际创建一条云记录：

```js
wx.cloud.callFunction({
  name: 'genContent',
  data: { code: 'TEM', answers: [0,2,3,2,1,1,2,2,0,1,1,3] }
}).then(({ result }) => console.log(result))
```

预期：`ok: true`、非空 `rid`、`roast`、3 条 `tips`、`source`。无模型配置为 mock，真实模型成功为 model。复制返回 rid，执行：

```js
wx.cloud.callFunction({ name: 'getResult', data: { rid: '替换为返回的rid' } })
  .then(({ result }) => console.log(result))
```

预期严格只有 `code` 和 `scores`。数据库里应有完整答案和服务端写入的 `_openid`，查询接口不得返回这些私有字段。

同一微信用户连续测 3 次，检查生成 3 个不同 rid。无效 rid、`m0-healthcheck`、不存在记录应返回 null。

## 真实模型 10 次验收

配置好真实模型后，从调试控制台执行；统计必须以 `source === 'model'` 为成功，不能把兜底算作模型成功：

```js
(async () => {
  const checks = []
  for (let i = 0; i < 10; i++) {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'genContent',
        data: { code: 'TEM', answers: [0,2,3,2,1,1,2,2,0,1,1,3] }
      })
      checks.push({ ok: result.ok === true && result.source === 'model', source: result.source })
    } catch (_) { checks.push({ ok: false, source: 'error' }) }
  }
  console.table(checks)
  console.log('真实模型成功次数', checks.filter(item => item.ok).length, '/ 10')
})()
```

目标至少 9/10。当前 2.8 秒单次模型上限为满足 8 秒前端等待目标，较慢模型可能经常回退；需要在真实环境选择响应快的模型并测量。不能仅延长前端等待来宣布满足原需求。

## 页面验证

- 本地 mock 完成答题：马上显示示例点评和 3 条建议。
- 云模式完成答题：先显示人设与内容骨架，8 秒内显示生成内容或兜底。
- 断网或云调用失败：显示「离线解读」和简短连接提示，人设、坐标和重测仍可用。
- 重新测试后，旧请求即使晚到也不能覆盖新结果；退出结果页后不得更新已卸载页面。
- 切换模式/模型后重新答题，当前实现会保留同一轮缓存内容，避免重复生成。

## 当前验证边界

本地测试覆盖 SDK 替身、HTTP 替身、数据库替身及页面逻辑；不包含真实依赖安装、数据库规则生效、真实模型成功率和微信样式编译。词表是文档要求的初始过滤机制，不是完整语义审核系统，M7 仍需审核实际文案与平台要求。

官方依据：[CloudBase 云函数内置 AI](https://docs.cloudbase.net/ai/model/wx-server-sdk-access)、[微信云函数调用与上下文](https://docs.cloudbase.net/recipes/add-cloud-function-wechat-miniprogram)、[DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)。
