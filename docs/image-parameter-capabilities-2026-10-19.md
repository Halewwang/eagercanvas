# 图片参数实测与界面验收（2026-10-19）

> 后续发布说明：Dashboard 精简与模型迁移已合并到当前生产；当前发布状态以 [main 发布记录](main-release-2026-10-19.md) 为准。本文中的缺素材、临时构建及尚未生产验收说明属于当时的历史记录；网关参数实测仍保留原适用范围。`output/` 链接指向本地验收附件，附件未纳入 Git。

当前 Enbrand 网关的 `gpt-image-2` 会接受许多参数，但返回图片并不遵循这些参数。配置已收缩为：提示词、最多 16 张参考图、背景 Auto / Opaque；固定单张 PNG。尺寸和质量由上游实际输出决定，界面不再提供精确控制或承诺。

后续已移除本记录旧截图中的独立图片配置卡，图片设置统一到胶囊菜单；当前界面及旧画布迁移验收见[图片胶囊菜单整理](image-capsule-consolidation-2026-10-19.md)。以下截图保留为当时的参数测试证据。

## 实测范围与依据

- 网关：`https://api.enbrand.co/v1`；文生图走 `/images/generations`，参考图走 multipart `/images/edits` 的 `image[]`。
- 共 69 次真实付费请求：初始计划 65 次，补充 JPEG / WebP 参考图各 2 次。全部 HTTP 200、有效图片；没有自动重试、429、5xx 或网络超时。并发最多 2，单次 12.275–26.557 秒。
- 每次检查实际文件签名、解码尺寸、透明像素、数量、SHA256 和用量，并保存原图；不能仅凭 HTTP 200 或返回的参数字段认定生效。
- 全部 69 张实际为 PNG：58 张 1536×1024、10 张参考图编辑 1254×1254、1 张最小请求 1774×887。

| 参数 | 覆盖 | 实际结果 | 当前处理 |
| --- | --- | --- | --- |
| `size` / 比例 / 分辨率 | 10 个比例 × 1K / 2K / 4K 的全部 30 个旧尺寸；另测 auto、1024、1536×1024、3840×2160 重复请求 | 30 个显式尺寸全部输出 1536×1024，竖图也未生效；3:2 的偶然匹配不能证明可控 | 移除尺寸、比例、分辨率选项，不再向上游发送 |
| `quality` | low 基线；auto / medium / high 各 2 次，固定 Opaque | 上游均报告 low、343 output tokens，选择未生效；无法据此承诺高质量档位 | 移除选项，不发送质量参数 |
| `background` | Opaque 基线及重复；Auto、Transparent 各 2 次；最小请求 2 次 | Opaque 无透明像素；Auto / Transparent 均产生真实透明像素，且上游同时切换到 medium；最小请求尺寸也会变化 | 保留既有 Auto / Opaque，Auto 不承诺透明效果或尺寸 |
| `output_format` | PNG 基线；JPEG / WebP 各配合 compression 0 / 100，每组 2 次 | 全部仍为 PNG，文件签名与解码一致 | 移除格式选择，后端固定 PNG |
| `output_compression` | JPEG / WebP 的 0 / 100，各 2 次 | JPEG / WebP 格式本身未生效，压缩选项不能成立 | 移除，不发送 |
| `n` | 1 基线；2 各 2 次 | `n=2` 两次都仅返回 1 张 | 固定 1，不提供数量参数 |
| `moderation` | auto 基线；low 2 次，使用无害图形提示词 | 请求成功不能证明审核政策差异 | 移除覆盖值，使用上游默认策略 |
| PNG 参考图 | 1 / 2 / 16 张，各 2 次 | 均保留红圆与蓝方块；16 张用例只有第 16 张含蓝方块，结果保留该对象 | 保留，前后端均限制最多 16 张 |
| JPEG / WebP 参考图 | 各 2 次，检查上传字节、MIME 和文件名一致 | 4 次均保留输入对象，输出有效 PNG | 保留输入支持 |

10 个比例为 1:1、3:2、2:3、4:3、3:4、4:5、5:4、16:9、9:16、21:9。最小请求仅包含 `model`、`prompt`、`n:1`，重复两次也成功，但实际尺寸不同，因此不采用固定预览比例。

## 配置与调用调整

- 图片节点、图片配置节点、多角度、婚礼场景和 Enhance 均不补回已删除参数；保留语义提示词与参考图。
- 所有现有生图入口沿用节点选择的背景。多角度界面说明角度属于视角引导，生成角度可能不同；Enhance 不再承诺 4K 或指定像素放大。主题场景移除仅拼入提示词的 Random Seed，结构控制改为 Structure Guidance 并说明结果可能变化。
- 旧画布加载与保存会清理无效生成参数，保留已有媒体真实尺寸、比例、URL 和引用。重新选择模型也应保留媒体尺寸。
- 图片预览按解码后的自然尺寸显示，避免旧参数导致拉伸或裁切。后端从实际图片字节判断 MIME，并以真实类型持久化。
- 17 张参考图在前端发请求前和后端调用上游前拒绝；没有为了测试边界向上游提交 17 张。
- 上游生成成功而存储失败时保留已发生的 token 用量，任务标记失败，不伪造已结算金额。

## 原始证据与复现

- [原始逐次记录](../output/image-parameter-probe-2026-10-19/manifest.jsonl)、[汇总](../output/image-parameter-probe-2026-10-19/summary.json)
- [初始 65 次计划](../output/image-parameter-probe-2026-10-19/plan.json)、[4 次参考图格式补测](../output/image-parameter-probe-2026-10-19/reference-formats-plan.json)
- [旧尺寸矩阵快照](../output/image-parameter-probe-2026-10-19/size-matrix.snapshot.json)、[参考图视觉审查](../output/image-parameter-probe-2026-10-19/visual-review.json)
- [总览 1](../output/image-parameter-probe-2026-10-19/contact-sheet-01.jpg)、[总览 2](../output/image-parameter-probe-2026-10-19/contact-sheet-02.jpg)、[总览 3](../output/image-parameter-probe-2026-10-19/contact-sheet-03.jpg)、[总览 4](../output/image-parameter-probe-2026-10-19/contact-sheet-04.jpg)、[总览 5](../output/image-parameter-probe-2026-10-19/contact-sheet-05.jpg)

探测工具为 `backend/scripts/probe-image-capabilities.mjs`，默认只写计划，不请求接口。`--live` 才发真实付费请求；已尝试过的 ID 不会自动重复，包括中断后的请求。工具测试使用模拟接口，已接入 `npm run test:tools`。不要使用新的输出目录无意重跑付费矩阵。

## 最终回归与浏览器验收

- `npm run check` 退出 0：lint、maintenance、前端 846 项、后端 468 项、工具 18 项，共 1332 项测试通过，0 失败、0 跳过。
- 浏览器实际点击普通生成、多角度、Theme Set 和 Enhance，4 次本地模拟生成请求均传入 `background:opaque`，没有尺寸、比例、分辨率、质量、格式、压缩或 seed 字段；3 个工具路径均保留参考图。检查了新生成节点背景继承和 2:1 真实预览比例，无运行时异常。
- [浏览器请求记录](../output/image-parameter-probe-2026-10-19/ui-requests.json)、[显示状态](../output/image-parameter-probe-2026-10-19/ui-review.json)、[图片节点截图](../output/image-parameter-probe-2026-10-19/ui-desktop.png)、[视角工具截图](../output/image-parameter-probe-2026-10-19/ui-viewpoint.png)、[主题工具截图](../output/image-parameter-probe-2026-10-19/ui-theme.png)。这些是本地模拟工作流证据，真实网关能力以 69 次实测为依据。
- 原工作区已有 3 张素材删除：`scene01.jpeg`、`shot01.jpeg`、`workflow02.jpeg`，未恢复或改动这些删除。临时 Vite 配置仅将这 3 张素材指向工作区外的 Git 基线副本，使用最终源代码构建成功，3466 modules transformed，4.73 秒；不将此结果描述为原目录无条件构建通过。
- 扫描了 784 份源码和文本证据文件，未发现本次新密钥；本地密钥文件继续忽略。`git diff --check` 因本机 Git 读取挂起而超时，未将其标为通过；lint 与测试均已完成。

## 验证边界

本次覆盖当前项目已有可配置参数及小型 PNG / JPEG / WebP 参考图，没有验证上传体积上限、17 张上游行为或审核策略差异。实测说明本账号、本模型、当前网关在本次调用中的表现，不保证网关未来行为不变；新增选项应先重复验证实际文件结果。

真实接口参数测试与本地浏览器模拟流程分开记录；浏览器模拟不增加付费请求，也不作为生产登录、数据库或正式部署验收。
