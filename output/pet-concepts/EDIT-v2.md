# 第二版：缩小眼睛

使用内置 image_gen 工具，以各款第一版 PNG 为编辑目标，缩小整只眼睛，保留星光、眼睛颜色、身体材质和姿势。四款另存为原文件名加 `-v2.png`，原图保留。

## 完整编辑提示词

```text
Use case: precise-object-edit. Edit the supplied PNG character image. Make one targeted proportional change: reduce the ENTIRE single eye (outer white sclera, iris, pupil and sparkling reflections together) to approximately 75% of its current width and height, maintaining the eye's original center position. The smaller eye should clearly reveal more black spherical face around it and feel more balanced and cute. Fill the newly exposed ring of face seamlessly with the surrounding original black body material, matching surface texture, shading, curvature and lighting. Preserve the original iris color, eye design, white sclera, star sparkle and catchlights, proportionally scaled together. Keep everything else as close to the supplied image as possible: identical character identity, exact round black body size and silhouette, two short arms, two short feet, pose, tiny smile, material, lighting, style, framing and canvas composition. Do not shrink the body. Do not enlarge the pupil relative to the sclera. Exactly one eye. Preserve a genuinely transparent alpha background and output PNG. No new objects, lettering, borders, shadows on a floor or decorative elements.
```

