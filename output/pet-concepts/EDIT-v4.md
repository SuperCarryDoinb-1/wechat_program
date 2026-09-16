# 第四版：在第三版基础上继续放大眼睛

使用内置 image_gen 工具，以四款第三版为编辑目标。交付文件为对应的 `-v4.png`，此前版本保留。提示词中的 15% 为编辑目标，实际结果经过目视检查，四款眼睛均明显大于第三版。

## 完整编辑提示词

```text
Use case: precise-object-edit. Edit the supplied pet PNG. ENLARGE THE ENTIRE SINGLE EYE by 15% in both width and height relative to this input, keeping its center fixed. This must be a visible increase: the outer white sclera should expand outward on every side, and the iris, pupil, star sparkle and other catchlights must all grow proportionally with it. The supplied eye is about 300 pixels wide on the 1254-pixel-wide canvas; make the final eye about 345-355 pixels wide. Do not leave the eye at the input size. Keep the exact black spherical body size and silhouette, two short arms and feet, pose, mouth position and size, material, fur or smooth texture, shading, lighting, eye color, expression and canvas framing unchanged. Change only the eye's overall size and the necessary local blending around its boundary. Exactly one character and one eye. Preserve genuinely transparent alpha background. Output full-body PNG on the same square composition. No text, no floor, no new elements.
```

