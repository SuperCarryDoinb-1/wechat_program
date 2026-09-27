# 人物图使用说明

## 当前版本：直接使用原图裁片

当前运行图片直接裁取 `all.png`，完整保留人物画面内的背景、图标、文字和细节，不重绘、不改色、不抠图，仅缩小压缩。无损原尺寸裁片保存在 `output/characters/original-crops/`，运行素材位于 `assets/types/`。当前处理脚本为 `tmp/use-original-portraits.js`，旧处理脚本不应再覆盖运行图片。原图下方画面外的模型名称和宣传语不包含在人物裁片中。

首页案例改为 TEM、PEM、TGM，左图右文，字母和名称同行，简介在下；结果页保留左右各半，移除覆盖图片的渐变。Claude 人物仍仅用于隐藏款 TEM。

以下为旧版处理记录，配色、背景、备用图说明已被上述当前版本替代。

原始素材：根目录 `all.png`。使用图像编辑处理背景和文字后，8 位人物按原图从左到右、从上到下的顺序拆分，保存在 `output/characters/character-01.png` 至 `character-08.png`。

| 原图位置 | 类型 | 小程序资源 |
| --- | --- | --- |
| 第 1 排第 1 位 | TEM AI 驯兽师（隐藏款专属） | assets/types/TEM.png |
| 第 1 排第 2 位 | PEM 碳硅合伙人 | assets/types/PEM.png |
| 第 1 排第 3 位 | TGA 赛博牛马 | assets/types/TGA.png |
| 第 1 排第 4 位 | PGM 碳基原教旨 | assets/types/PGM.png |
| 第 2 排第 1 位 | TEA AI 甩手掌柜 | assets/types/TEA.png |
| 第 2 排第 2 位 | PGA AI 真香党 | assets/types/PGA.png |
| 第 2 排第 3 位 | TGM AI 审讯官 | assets/types/TGM.png |
| 第 2 排第 4 位 | PEA 硅基信徒 | assets/types/PEA.png |

Claude 人物仅供隐藏款 TEM（AI 驯兽师）使用，TGA（赛博牛马）使用原图第 1 排第 3 位银发人物。八种类型各自使用独立人物图。页面不展示模型名称；人物图保留原有图形标记（含 K、Z 等），去除模型全称和说明文字。结果卡片左右各占一半，左图右文，使用统一米黄色背景和柔和边缘过渡。

类型资源统一配置在 `config/assets.js`。首页三个类型预览、结果卡片、历史详情和保存海报使用相同映射。首页品牌头像仍使用 `assets/brand/doubao.png` 和 `assets/brand/douzai.png`，已替换为米黄色背景版本。

人物旁的图标从 `all.png` 提取，保留原图轮廓，不使用重绘的 App 图标。图标主色按服装调整为棕色、炭黑、蓝紫、蓝色、紫色、藏蓝或豆沙粉，以确保米黄色背景上的辨识度。原色裁片保留在 `output/characters/source-icons/`。

类型图片为 320×320 压缩 PNG，品牌头像为 240×240 压缩 PNG。大原图、生成的整图和备用人物保留在根目录或 output 中，均不参与小程序打包。
