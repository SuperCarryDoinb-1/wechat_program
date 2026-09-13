====================================================
【模块 M4 代码完成，真实云/模型验收待完成】AI 内容生成与结果落库
----------------------------------------------------
■ 本模块做了什么
  - 实现 genContent：服务端复核答案与类型、创建结果记录、生成/校验点评和 3 条建议。
  - 实现 getResult：按 rid 只返回 code 与 scores，不返回答案、点评、建议或身份。
  - 接入云开发内置 AI 与兼容 HTTPS 模型 API；无配置时走模拟内容。
  - 前端答完即请求，结果页展示骨架并接收内容，8 秒超时或异常使用兜底。
  - 补齐请求复用、缓存来源标记、旧请求保护、云函数配置同步与部署说明。
■ 涉及的文件
  - cloudfunctions/genContent/{index.js,handler.js,provider.js,package.json,config/prompt.js}（新增）
  - cloudfunctions/getResult/{index.js,handler.js,package.json}（新增）
  - 两个函数 shared/ 中的明确配置与纯逻辑副本（新增，由同步脚本生成）
  - config/blocklist.js、config/content.js（新增）、config/copy.js（修改）
  - utils/content-validation.js、public-result.js、content-service.js、request-id.js（新增）
  - pages/quiz/quiz.js、pages/result/result.{js,wxml,wxss}（修改）
  - tests/m4.test.js、tests/sync-cloud.js（新增）
  - tests/m2.test.js、tests/m3.test.js、tests/run.js、package.json（修改）
  - README.md（修改）、docs/M4-deploy.md、docs/M4-report.md（新增）
■ 如何验证（用户操作步骤）
  1. 本地保持 mode=mock，重新编译并答完一轮。
  2. 预期看到：示例点评和 3 条建议，来源为「示例解读」，人设与详情正常。
  3. 运行 node tests/run.js，检查全部自动测试。
  4. 按 docs/M4-deploy.md 同步代码、部署两个云函数并设置实际云环境。
  5. 无模型配置先验云记录和 getResult 白名单，再配置真实模型并执行 10 次调用验收。
  预期看到：云模式有真实 rid；真实模型成功时才标记「AI 生成」；失败与超时有兜底。
■ 自测结果
  - [✓] 无密钥 mock：前端服务 → 云函数处理器 → 数据库替身完整闭环。
  - [✓] 同一可信用户连续测 3 次生成 3 条独立结果（数据库替身）。
  - [✓] 非 JSON、超长、敏感词、错误建议数量重试一次后兜底。
  - [✓] getResult 严格只返回 code、scores；无效 rid 与健康检查记录返回 null。
  - [✓] 类型伪造、非法答案、无可信身份不落库、不请求模型。
  - [✓] 模型提示词仅含类型与固定选项文本，不含 OPENID、rid 或客户端额外字段。
  - [✓] 8 秒前端兜底、模型单次截止、晚到响应和新旧本地结果隔离。
  - [✓] 内容来源标记、页面卸载保护、请求复用和缓存写入异常。
  - [✓] 云开发/HTTP 模型适配器与共享文件同步检查。
  - [✓] M4 共 15 项自动测试通过；此前 M0～M3 回归通过。
  - [待验收] SDK 云端安装、云函数实际部署、数据库真实读写与规则。
  - [待验收] 真实模型成功率 ≥9/10、微信模拟器页面渲染与真实网络超时体验。
■ 已知问题 / 需要用户决定的事
  - 当前 config/env.js 仍为 mock，云环境 ID 为空，没有实际云请求或真实模型调用。
  - 内置 AI 需开通服务并选择可用模型 ID；自备模型密钥只在云函数环境变量设置。
  - 内置 AI 的 SDK 依赖按官方最低版本 3.0.5-beta.1 配置，是预发布版；本轮未实际安装验证。
  - 本地模拟没有可分享 rid；云端 mock 有真实 rid，但内容仍是示例而非 AI 生成。
  - 初始词表属于文档要求的基础过滤，实际生成文案仍需在真实环境验收。
  - 本轮未进入 M5；海报、好友分享仍为占位。
====================================================
请按部署说明验收；回复「确认」进入 M5，或直接说要改什么。

## 实现决定与限制

- 默认无模型配置时使用静态 mock；内置 AI 不需要自备 key，但需要可用云环境与模型服务。文案来源明确区分，不把 mock 当成真实生成。
- 云函数先落一条安全兜底记录，再更新模型内容，更新失败返回与已存记录一致的兜底。数据库写入失败不调用模型，也不返回假 rid。
- `_openid` 从可信 `getWXContext()` 获取并显式写入。没有自建账号、不存昵称头像；客户端 event 中的身份字段被忽略。
- 不信任客户端类型，服务端按同一题库重新计算并核对。配置通过 `node tests/sync-cloud.js` 同步，测试逐文件对照，避免前后端题库漂移。
- `fromRid` 只用于读取对方公开类型并返回 `pairCode`。失效邀请不阻塞本人结果；配对页面留给 M6。
- 本地只保留当前完整测评，`requestId` 用于当前进程请求复用和过期响应隔离。服务端每次生成调用均独立建记录，不承诺网络重放下的持久幂等。
- 缓存内容保留来源。切换模型/模式后要重新测试，不会自动重发旧测评。
- 前端请求从答完题时开始，最长等 8 秒；模型最多尝试两次，每次最多 2.8 秒。超时不清除用户人设与坐标，不伪造云端 ID。前端超时不能取消已开始的云函数，云端可能随后完成记录，但迟到响应不覆盖当前页面。
- M4 的所有本地验证使用可控替身，无外部网络、密钥或真实账号调用。模拟成功不代表生产服务已连接。

## 测试命令与统计

`node tests/m4.test.js`：M4 15 项。

`node tests/run.js`：M1 独立脚本 10 组；Node 运行器统计 M0、M2、M3、M4 共 42 项，均通过。

部署与真实 10 次模型验收步骤见 [M4-deploy.md](M4-deploy.md)。官方接口依据为 [CloudBase 内置 AI 云函数调用](https://docs.cloudbase.net/ai/model/wx-server-sdk-access)和 [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)。

按 AITI.md 第 0 节「未确认不得进入下一模块」，本轮停在 M4。文件操作均限定在当前项目目录，未读取或修改其他目录。
