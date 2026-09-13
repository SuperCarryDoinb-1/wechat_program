# 双人海报校样

本目录八张 750×1334 PNG 是本地 GDI 校样，复用 `utils/poster.js` 的 Canvas 绘图指令，**不是微信截图或真机保存凭据**。已检查重合点、对角连线与最长特殊关系标题的代表校样；64 种组合的文字边界与重叠自动检查通过。

| 文件 | 配对 |
| --- | --- |
| level-0.png | 镜像人 |
| level-1.png | 最佳搭子 |
| level-2.png | 互看不惯 |
| level-3.png | 宿敌 CP |
| special-0.png | 主仆关系 |
| special-1.png | 路线之争（M7 调整名称，规则不变） |
| special-2.png | 质检员与甩锅侠 |
| special-3.png | 同一个人的白天和夜晚 |

重新生成：在项目根目录依次运行 `node tests/build-poster-previews.js`、`& ./tests/render-poster-previews.ps1`。同时更新个人海报校样和分享封面；全部输出限定在本项目。插画与小程序码仍为占位。

自己的坐标是实心点，朋友是圆环；同类型同分时同心展示。图上两个轴相同不代表三个维度都相同，配对关系仍按完整类型代码计算。
