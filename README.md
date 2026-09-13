# AITI · AI 使用风格测试

当前阶段：**M7 本地准备完成，尚未具备提审条件**。用户已确认云开发尚未开通；当前仍为本地模拟模式。代码已包含个人测试、海报、云解读和双人配对流程，但真实云/模型、六轮真机、实际包体与首屏耗时待验收。详见 [提审清单](docs/提审清单.md)、[首次开通云开发](docs/首次开通云开发.md) 和 [答辩要点](docs/答辩要点.md)。

## 本地预览

2026-09-12 已整理模块职责、复用逻辑及打包排除项，见 [代码架构说明](docs/架构说明.md)。

同日完成三页、两组件及分享物料的视觉改版，见 [UI 设计说明](docs/UI设计说明.md)。可直接用浏览器打开 [视觉校样](docs/ui-preview.html) 切换宽度、题目与身份；它展示实际模板的浏览器排版，真实交互请在微信开发者工具中编译体验。

1. 在微信开发者工具中导入本目录，项目类型选择小程序。`project.config.json` 已保留用户填写的 AppID；更换账号时使用自己的小程序 AppID 或工具提供的测试号。
2. `config/env.js` 默认 `mode: 'mock'`，无需密钥或安装依赖即可预览。工具选择可用的稳定基础库版本。
3. 首页点击「开始测试」，每题选择后约 200ms 自动切换下一题，最后一题选择后自动进入结果页；查看人设、坐标并展开详情，底部可保存海报、分享给好友或重新测试。相册保存请使用真机预览。
4. 开发诊断默认关闭。需要检查时临时将 `config/env.js` 的 `showDiagnostics` 设为 `true` 并重新编译，首页会显示「检查 ping 与数据库」；模拟模式的成功不代表真实云已连通，验收后关闭开关。

## 配置真实云开发

1. 将 `project.config.json` 的 `appid` 改为自己的小程序 AppID。在微信开发者工具中打开「云开发」，按控制台流程开通环境，取得环境 ID。游客模式不能作为真实云联调凭据。
2. 在云开发数据库控制台**手动新建 `results` 集合**。将该集合的自定义安全规则设置为 `cloudfunctions/database.rules.json` 的内容（客户端禁止直接读写，后续通过云函数返回允许公开的字段）。该文件不会自动部署规则。
3. 在 `config/env.js` 设置 `mode: 'cloud'`、`cloudEnvId: '实际环境ID'`。前端只填环境 ID，不放 API key 或云密钥。
4. 选择该云环境，右键 `cloudfunctions/ping` →「上传并部署：云端安装依赖」。依赖只需在云端安装，不要求本机执行 npm install。
5. 首先用云端测试调用 `ping`，入参 `{}`，预期 `{ "ok": true, "message": "ok", "database": "unchecked" }`。
6. 在 `ping` 云函数环境变量中设置 `ENABLE_M0_DIAGNOSTICS=true`，保存配置后执行云端测试，入参 `{ "checkDatabase": true }`。预期 `ok: true`、`database: "ok"`。控制台 `results` 中应出现固定 ID `m0-healthcheck` 的测试记录；重复检查会更新这一条记录，不新增用户结果。
7. 小程序重新编译后点击首页检查按钮，应显示「真实云端」。若失败，依次检查环境 ID、云函数部署环境、集合是否创建、诊断环境变量。
8. 验收结束后关闭 `ENABLE_M0_DIAGNOSTICS`。发布前将 `showDiagnostics` 改为 `false`。健康检查记录不是用户测评结果，后续业务读取需排除它。

## 自测

高清图稿见 [8K 图稿说明](docs/8k-artwork/README.md)。结果页可选择「8K 超清」导出个人或双人海报；具体设备是否支持需真机验证。页面仍以设备实际屏幕分辨率显示。

在本目录执行 `node tests/run.js`（Node.js 18 或更新版本；没有第三方测试依赖，不启动测试子进程）。单独验证可执行 `node tests/m0.test.js`、`node utils/scoring.test.js`、`node tests/m2.test.js`、`node tests/m3.test.js`、`node tests/m4.test.js` 或 `node tests/m5.test.js`。

自动测试覆盖：页面注册和事件路由、mock 检查、云初始化异常、调用失败与超时、ping 处理器、诊断开关、数据库模拟写入读回及异常响应。

**测试边界**：M0 Node 测试使用微信 API / 数据库替身，不是 WXML 编译器，也不能证明真实云端连通。用户反馈关闭热重载并重启后，模拟器已恢复；具体根因未确认，真实云端和真机仍待验收。M1 为不依赖微信的纯逻辑，可由 Node 直接验证。

## M2 验收与本地结果

1. 点击工具顶部「编译」，首页点击「开始测试」，应显示 Q1 情境、进度条和 4 个选项。
2. 选择后高亮，约 200ms 自动进入下一题。底部保留「上一题／下一题」按钮，返回已答题目后可点击「下一题」继续；未选择时不能继续。连续点击不应跳过题目。
3. 到第三题点击「上一题」，应保留第二题的选项；修改后再次前进，计分按新选择计算。
4. 用导航栏返回首页，再开始测试，应从第一题、零进度重新开始。切到后台再回前台保留本次页面，待执行切题暂停后恢复；只有实际退出答题页才放弃草稿。
5. 完成第 12 题后进入结果页。在开发者工具的 Storage 面板查看键 `aiti:current-result:v1`，应有 `version`、12 个 `answers`、`code`、`scores`、`coords`、`rarity`、`createdAt`。再次答完覆盖这一条，不积累历史；中途退出不会覆盖上一次完整结果。
6. 将模拟器切换为 iPhone SE，或使用 320×568 的小屏尺寸，逐题检查尤其 Q4 长题干与四个选项。页面可向下滚动，四选项与「上一题」均应可达，不被固定操作栏遮挡。再检查 375×667 和默认尺寸。
7. 记录一次正常阅读作答耗时，目标 90 秒内，不设置强制倒计时。200ms 仅是切题反馈时间，不是整轮实测耗时。

当前配图是 12 组情境配置对应的 WXSS 图形占位，素材由用户后续提供；在 `config/assets.js` 填入题图路径即可替换，加载失败时回退占位。`config/quiz.js` 集中维护过渡时长、存储键和情境文案。

M2 自动测试使用真实页面 JS 配合微信 API 与计时器替身，验证完整答题、修改、退出、后台恢复、重复点击、存储失败和跳转失败等行为。**没有执行本轮微信 WXML 编译或 iPhone SE 视觉验收**，不能以 Node 通过代替；详见 [M2 报告](docs/M2-report.md)。

## M3 结果页验收

1. 重新编译并答完一轮，应出现类型主色、人设插画占位、名字、三字母代码、一句话与精简人设。
2. 向下滑动，检查点评、建议、坐标图和主导徽章。M4 已将骨架接到内容：本地模式标记「示例解读」，真实模型成功标记「AI 生成」，模型失败标记「预设解读」，网络或云调用失败标记「离线解读」。
3. 点击「展开详情」，检查优点、缺点、名场面、最配/最不配及双方不服气关系，再收起。
4. 「保存海报」「分享给好友」已由 M5 接入，见对应验收文档。「重新测试」应从第一题开始；带朋友邀请时由 M6 保留本轮朋友。
5. 如需验证隐藏款，可按 Q1～Q12 选择 `A C D C B B C C A B B D`，对应 M1 的 TEM 夹具。结果页应出现金色徽章、翻转与粒子效果，1.2 秒内结束；立即点击「跳过揭晓」可停止。其他 7 类的固定答案见 [M1 报告](docs/M1-report.md)。
6. 在 320×568、375×667 及默认模拟器尺寸检查：人设文字不截断、图形不破版、坐标点不遮挡轴标签、详情最后一行可滚动到固定底栏上方。

结果读取采用 M2 的存储键与版本；根据答案重新计算类型和坐标，避免缓存字段不一致。缺失或损坏时显示空态并提供开始测试入口。`components/type-card` 通过 `typeCode` 切换类型，`components/quadrant-map` 通过 `coords` 与 `accent` 定位并着色。

隐藏款只显示「隐藏款」，不把均匀随机选项的模拟比例写成真实用户出现率。没有真实插画时使用 WXSS 图形，后续只需替换 `config/assets.js` 路径。见 [M3 报告](docs/M3-report.md)。

## M4 云端与模型部署

完整步骤见 [M4 部署说明](docs/M4-deploy.md)，测试结果见 [M4 报告](docs/M4-report.md)。本机不需要安装云函数依赖，使用开发者工具的云端安装依赖。

1. 本地演示：保持 `config/env.js` 的 `mode: 'mock'`，重新答一轮。点评和建议显示「示例解读」，**没有云记录或可分享 rid**。
2. 部署前运行 `node tests/sync-cloud.js`，再运行 `node tests/run.js`。云函数各自上传，不能引用函数目录外的相对路径，因此将题库、评分和验证器的明确清单同步到各函数 `shared/` 中。测试会检查源文件与副本一致，修改配置后必须重新同步和部署。
3. 在前述 `results` 集合与环境准备完成后，上传部署 `cloudfunctions/genContent`、`cloudfunctions/getResult`。`genContent` 配置 15 秒或更长函数执行超时；前端只等待 8 秒。
4. 将前端 `mode` 改为 `cloud` 并填写环境 ID，`genContent` 暂不配置模型变量。重新答题应显示「示例解读」，但本地 `content.rid` 此时是实际云记录 ID，`content.persisted` 为 true。
5. 优先在 `genContent` 云函数环境变量设置 `AITI_AI_PROVIDER=cloudbase`，`AITI_AI_MODEL=控制台可用模型ID`，并开通环境对应模型服务。此方式无需把 API key 放在前端。
6. 若选自备国内模型 API，设置 `AITI_AI_PROVIDER=compatible`、`AITI_AI_MODEL`、`AITI_AI_KEY`，可选 `AITI_AI_ENDPOINT`（完整 HTTPS Chat Completions 地址；默认 DeepSeek 地址）。密钥只写云函数环境变量，**不要填写到 config、代码或聊天中**。
7. 切换模式后重新答题，避免继续显示上一轮缓存的示例内容。真实生成成功才显示「AI 生成」。

`genContent` 先校验完整答案并重算类型，再写入静态兜底记录，随后生成并更新内容。客户端声明的类型与重算结果不一致会拒绝。`_openid` 来自云函数可信上下文，服务端显式写入，不发送给模型。每次函数调用创建一条独立记录；客户端同一轮提交及结果页复用请求，重新测试生成新关联 ID。

`getResult({rid})` 只返回 `{code,scores}`；无效/不存在 rid、健康检查记录或数据库读取失败返回 null。`fromRid` 有效时生成接口可附带对方 `pairCode`，本轮不显示双人卡。

模型输出最多重试 1 次，每次等待上限 2.8 秒。非严格 JSON、点评超过 60 字、建议不是 3 条或超过长度、命中词表都使用兜底。前端另有 8 秒总等待上限，迟到响应不会覆盖已展示兜底，也不会覆盖新一轮本地结果。云端调用本身不能由前端超时取消，可能继续完成记录；没有取得 rid 时不伪造分享 ID。

## M1 使用与校准

`require('./utils/scoring').calc(answers)` 接收长度为 12 的数组，`0/1/2/3` 分别对应 A/B/C/D，返回 `{ code, scores, coords, rarity }`。缺答、字符串下标、越界或稀疏数组会抛出异常。`scores` 是原始累加分数；平局处理和隐藏款转型不会篡改原始分数或坐标。

`require('./utils/pairing').pair(codeA, codeB)` 返回 `{ level, name, text }`，`level` 始终是代码不同字母数（0～3）。特配覆盖名称和文案，交换双方顺序不改变结果。人设详情里的最配/最不配为文案配置，与这一配对函数分开维护。

`config/questions.js` 存题目与得分，图片通过 `imageIndex` 索引 `config/assets.js` 的 `questions`；`config/types.js` 存 8 类文案和主色，关系通过类型代码引用以便改名；`config/pairing.js` 存配对文案；`config/rarity.js` 存阈值及最弱维度同分顺序。

最终隐藏款阈值：`rel ≤ -1、att ≥ 1、lead ≤ -1`，仍须先落入 TEM 象限。最弱维度相同时按 `rel → att → lead` 决定翻转。为达到文档抽样目标，Q10-A 的 `att` 从 `+1` 调至 `+2`，Q11-B 的 `rel` 从 `-1` 调至 `-2`；没有改变维度结构或其他选项分值。

精简 `persona` 按非空白、非标点字符计数（英文字母逐个计数），保留 `personaOriginal` 原文；名场面、优缺点、最配与鄙视链文案按文档录入。隐藏款抽样比例只用于开发校准，不能作为真实用户占比发布。完整分布、样例与取舍见 [M1 报告](docs/M1-report.md)。

## 目录与配置

M6 操作步骤、八种关系校样和待验收项目见 [M6 报告](docs/M6-report.md)。单独运行 `node tests/m6.test.js`，或执行 `node tests/run.js` 全量回归。邀请只随本轮页面参数及当前结果记录保存；从普通首页进入新测试不会沿用其他人的邀请，从配对结果点击重新测试则保留同一位朋友。

M5 验收步骤见 [海报与分享验收](docs/M5-check.md)，实现及待办见 [M5 报告](docs/M5-report.md)。`docs/poster-check/` 的 8 张 PNG 是本地 GDI 校样，不是微信截图；`assets/share/` 中的 8 张类型封面和 1 张邀请封面为代码绘制占位。最终插画和真实小程序码仍待提供。

- `pages/`：首页、答题页、结果页。
- `components/`：类型卡片与坐标图。
- `config/`：题库、人设及文案；`copy.js` 为通用页面文案，`sharing.js` 为分享和保存提示，`poster.js` 为绘图配置；`assets.js` 为图片路径，`env.js` 为运行模式。
- `utils/`：评分与配对、内容服务、朋友查询、分享组装、海报绘制与导出、隐私授权、云初始化和页面跳转。
- `assets/`：后续素材；当前首页图形为 WXSS 占位，不请求外部图片。
- `cloudfunctions/`：`ping` 诊断、`genContent` 解读生成、`getResult` 公开结果查询。
- `tests/`、`docs/`：本地测试与模块记录，不打入小程序包。

现有 AITI.md 保持原样。所有新增文件均在本项目目录内。

## API 参考（2026-09-09 核对）

- [CloudBase 官方：调用普通云函数](https://docs.cloudbase.net/cloud-function/how-use)：小程序使用 `wx.cloud.callFunction`。
- [微信官方 SDK 类型定义](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.cloud.d.ts)：客户端初始化及数据库接口参考。
- [微信官方云开发示例](https://github.com/wechat-miniprogram/miniprogram-demo/blob/main/miniprogram/page/cloud/README.md)：开通云环境与填写环境配置。

微信文档站部分页面本次无法抓取，已使用官方类型定义和腾讯 CloudBase 文档交叉参考；实际控制台步骤以账号内界面为准。
