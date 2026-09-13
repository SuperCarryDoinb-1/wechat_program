====================================================
【模块 M0 代码完成，真实环境待验收】项目骨架与云开发初始化
----------------------------------------------------
■ 本模块做了什么
  - 建立原生小程序目录，注册首页、答题页、结果页并接通预览跳转。
  - 建立深色主题、文案与素材配置；首页提供 WXSS 图形占位。
  - 实现云初始化、本地模拟、ping 云函数及 results 测试记录写入读回检查。
  - 补齐导入、建集合、权限配置、云函数部署与验收步骤。
■ 涉及的文件（均为新增，AITI.md 未修改）
  - project.config.json、app.js、app.json、app.wxss、sitemap.json、package.json
  - pages/index/index.{js,json,wxml,wxss}
  - pages/quiz/quiz.{js,json,wxml,wxss}
  - pages/result/result.{js,json,wxml,wxss}
  - config/env.js、config/copy.js、config/assets.js
  - utils/cloud.js、utils/navigation.js
  - components/.gitkeep、assets/.gitkeep
  - cloudfunctions/ping/index.js、handler.js、package.json
  - cloudfunctions/database.rules.json
  - tests/m0.test.js、README.md、docs/M0-report.md
■ 如何验证（用户操作步骤）
  1. 微信开发者工具导入当前目录，保留 mock 模式，编译。
  2. 点击「预览答题页」→「预览结果页」→「返回首页」。
  3. 点击首页「检查 ping 与数据库」。
  预期看到：深色页面、跳转正常，检查信息明确标注「本地模拟」。
  4. 按 README 填 AppID 和云环境 ID、创建 results、配置规则、部署 ping。
  5. 开启云函数诊断变量，切换 cloud 模式，重新检查。
  预期看到：「真实云端」检查成功；results 有 m0-healthcheck 测试记录。
■ 自测结果
  - [✓] Node 自动测试 7/7 通过，0 失败。
  - [✓] 三页注册、配套文件、事件绑定及路由闭环的静态/模拟检查。
  - [✓] ping 处理器本地调用返回 ok（使用 SDK 替身，不代表已部署）。
  - [✓] results 模拟数据库写入读回、重复检查、异常分支。
  - [✓] 云初始化失败、调用失败、超时及诊断关闭处理。
  - [待验收] 微信开发者工具实际 WXML 编译及三页视觉、交互。
  - [待验收] 云函数实际部署、真实 results 集合创建与读写。
■ 已知问题 / 需要用户决定的事
  - 需要小程序 AppID、云环境 ID 才能验证真实云端；目前使用占位和 mock。
  - 不具备本次真实环境验收证据，不将 M0 全清单标为通过。
  - 本轮仅实现 M0；未进入 M1 或预写后续模块。
====================================================
请先按 README 验收；完成后回复「确认」进入下一模块，或直接说要改什么。

停在 M0 的依据：AITI.md 第 0 节第 3 条明确要求「停下等待用户回复“确认”，未确认不得进入下一模块」。
