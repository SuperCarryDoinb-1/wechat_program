# 第三版：眼睛大小介于第一版与第二版之间

使用内置 image_gen 工具编辑。交付文件为四款对应的 `-v3.png`；前两版保留。提示词中的比例为编辑目标，生成结果经过目视检查，四款眼睛均比第二版略大、比第一版小。

## 01 / 03 / 04 最终编辑提示词

编辑目标为各款第二版，第一版作为尺寸参考。

```text
Use case: precise-object-edit. Input image 1 is the EDIT TARGET: current pet with the smaller eye. Input image 2 is a SIZE REFERENCE ONLY: same pet with the original larger eye. Produce ONE edited version of image 1. Change only the size of the entire single eye. Make its outer diameter exactly visually halfway between the small eye in image 1 and the large eye in image 2. This means enlarging image 1's eye by about 25% in width and height, NOT restoring the original large eye. The final eye must be clearly larger than image 1 and clearly smaller than image 2. Scale sclera, iris, pupil, star sparkle and catchlights together; preserve their relative proportions. Keep eye center in the same position as image 1. Blend the eye boundary naturally into the black face. Preserve image 1's identical black spherical body size, silhouette, short arms, short feet, pose, smile position and size, material, colors, texture, lighting, framing and transparent background. Exactly one eye. No other design changes. Output a single full-body pet PNG with genuine transparent alpha background, at the same square canvas composition as the input. No comparison panels, no text, no accessories, no floor plane.
```

## 02 毛绒款最终编辑提示词

编辑目标为毛绒款第一版。

```text
Use case: precise-object-edit. Edit this original black furry one-eyed pet PNG. Make its ENTIRE eye a LITTLE SMALLER: reduce the eye outer diameter by only 15%, to 85% of the supplied eye's current width and height. Target outer white-sclera diameter about 345 pixels on this 1254-pixel-wide canvas. This is a subtle reduction, not a tiny eye. Scale the entire white sclera, amber iris, black pupil and sparkles together around the existing eye center. Fill the narrow exposed ring with matching black fur. Preserve exactly the supplied pet's body shape and size, arm and foot poses, small smile, amber eye color, sparkle pattern, original fur texture, lighting and canvas placement. Only adjust eye size. Single character, single eye, transparent alpha background, PNG. No lettering or new elements.
```

