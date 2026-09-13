# M5 海报校样

本目录 TEM、TEA、PEM、PEA、TGM、TGA、PGM、PGA 八张 PNG 为 750×1334 的本地排版校样，使用真实计分夹具与 `utils/poster.js` 的同一套绘图指令。

**不是微信 Canvas 截图，也不是 iOS/Android 保存成功凭据。** 本地记录器估算字宽，再使用 Windows GDI 绘制；微信实际使用 Canvas.measureText，字体和换行可能略有差异。当前八张校样已逐张查看，无明显文字重叠或越界，自动检查也覆盖文字边界与金框。实际微信渲染仍待验收。

在项目根目录重新生成（仅写入本项目）：

```powershell
node tests/build-poster-previews.js
& ./tests/render-poster-previews.ps1
```

同时生成 `assets/share/` 下的九张 500×400 封面，主体在中间区域，朋友圈方形裁切仍需真机检查。图形为代码绘制的机器人占位，并非最终 AI 插画；小程序码位置为明确文字占位，不可扫码。

真机验收时把图片存为 `TEM-ios.png`、`TEM-android.png` 等，并在 M5-check.md 记录设备和微信版本，不覆盖或冒充本地校样。
