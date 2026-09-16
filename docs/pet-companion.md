# 粉红色悬浮宠物

## 选择页当前实现

- 页面最外层直接放置原生 image，明确引用 `/assets/pet/03-glossy-jelly-pink.png`，图片与外层均指定 104px 尺寸。
- 使用 fixed 定位在视口右上方，置于页面内容上方，触摸穿透。标题区域保留透明活动空间并吸顶，使宠物的小幅漂移不遮挡选项。
- 宠物节点没有 wx:if、hidden、透明度切换，也不依赖自定义组件、窗口测量、图片接管事件或题目条件。已删除选择页相应的测量、滚动隐藏与接管代码。
- 保留轻微漂移、呼吸、每次有效选择的点头反馈；反馈不增加切题计时器。选择页宠物在右上方小范围活动。
- 首页和结果页继续使用共享宠物组件进行缓慢随机移动和拖动。所有页面使用同一张粉红 PNG 和 `config/pet.js` 中的统一尺寸；测试检查选择页显式图片路径与配置一致。

## 验证与边界

- `node tests/run.js`：90 项测试通过，另有评分规则 10 组校验通过。覆盖原生图片无条件挂载、资源和尺寸一致、平台测量接口不可用、答题反馈、防连点、切题和生命周期。
- `node tests/build-ui-preview.js`：从实际模板生成预览，检查选择页包含直接引用的粉红 PNG，且没有宠物组件。
- `docs/quiz-pet-fallback-preview.html`：选择页固定宠物的单页预览，沿用原文件名；当前已无后备显示切换。
- 尚未完成微信模拟器或真机显示确认。当前仅修改本地项目，未上传或发布到微信。需要核对查看的是开发者工具模拟器、新扫码预览还是已上传的体验版/正式版。

## 图片编辑记录

输入：`assets/pet/03-glossy-jelly-v4.png`。工具：内置 imagegen 编辑。生成结果直接复制为粉红 PNG，未进行额外像素处理。

实际提示词：

> Edit the supplied transparent PNG pet sprite. Change ONLY the black glossy jelly body, short arms and short feet to a beautiful vivid soft bubblegum pink, with lighter pink specular highlights and deeper rose pink shadows. Preserve the exact original single blue eye, eye size, proportions, pose, silhouette, glossy jelly material, composition, transparent alpha background, and image dimensions. This is the same character recolored pink, not a redesign. No text, no frame, no extra objects, no backdrop. Keep the background truly transparent.
