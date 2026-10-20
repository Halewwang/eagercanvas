# 图片生成参数与网关验收

> 历史验收：Enbrand 图片渠道的传参与测试结论保留于此。当前实现已由 [APIMart 图片迁移](apimart-image-migration-2026-10-20.md)替代，使用比例 size + resolution 档位和异步任务，旧质量参数与像素矩阵已删除。

本次以最新反馈为准：比例、分辨率和画质属于下一次模型生成的请求参数。删除上一版本的本地裁切/插值导出实现；胶囊和预览下载均保留返回原图，Tools → Crop 继续提供用户主动选择的编辑裁切。

## 请求与界面

- 新空节点默认 `1:1 / 1K / Auto`，胶囊直接显示当前比例、分辨率及画质。菜单继续使用项目深色 Naive UI，下拉支持键盘、当前选项状态和忙碌禁用。3D Camera 恢复显示的参数改用共享 BaseSelect。
- 主胶囊、3D Camera、Theme Set 的用户选择共用 Auto 联动：任一尺寸选项选 Auto 时两项同步 Auto；从 Auto 选择固定比例默认 1K，选择固定分辨率默认 1:1，避免界面显示固定尺寸而请求实际为 Auto。
- 节点持久化 `generationRatio / generationResolution / generationQuality`；旧 `exportRatio / exportSize` 迁移为生成偏好，保留历史图片的实际 `size / ratio`。复制、刷新、连接结果、Enhance、3D Camera 与 Theme Set 继承生成偏好。
- 前端将比例和分辨率映射为 `size`，例如 `16:9 / 4K` → `3840x2160`，另发送 `quality: high`。4K 档按上游像素约束映射，非所有比例均为 4096 长边；菜单展示具体像素。Auto 将尺寸交给模型决定。
- 后端验证 size/quality 后同时用于普通生成 JSON 和参考图编辑 multipart body，保留现有模型、共享凭据、参考图上限和 PNG 输出逻辑。
- 重新生成成功时清除上一张图的实际 size/ratio，避免保留旧媒体尺寸；不把请求尺寸写成实际尺寸。
- 返回元数据明确报告的 size/quality 与非 Auto 请求不符时，返回 `502 / PROVIDER_IMAGE_PARAMETER_MISMATCH`。inline PNG 另核对 IHDR 的真实像素，避免把参数忽略当作成功。不裁切、不放大、不自动重试。远程 URL 没有尺寸元数据时不新增抓取，画质只比较上游明确报告值。

## 两次授权真实测试

沿用现有 Enbrand 网关和模型，总共调用两次，未追加调用。测试提示词仅含合成圆形与方块，不包含用户图片。

| 路径 | 请求 | HTTP | 返回原图 | 上游报告画质 | 符合设置 |
| --- | --- | --- | --- | --- | --- |
| `/v1/images/generations` | `gpt-image-2`, `3840x2160`, `high` | 200 | 1536 × 1024 PNG | low | 否 |
| `/v1/responses` 的 image_generation 工具 | `gpt-5.6-sol` + `gpt-image-2`, `3840x2160`, `high` | 200，SSE | 1536 × 1024 PNG | low | 否 |

两条路径均忽略指定参数，未在本轮额度内找到能返回所选尺寸与画质的网关路径。因此本次只能确认请求正确与不匹配保护有效，不能宣称当前网关已支持 4K/比例控制。需要网关提供支持这些参数的接口或修复上游执行；不会静默更换模型/服务。

## 验收

- `npm run check`：前端 738、后端 284、脚本 18，共 1040 项通过；ESLint、维护检查通过。`npm run build` 通过。
- 本地浏览器：空节点预选 `16:9 / 4K / High`，保存刷新仍保留；菜单背景 `rgb(28, 28, 28)`，所恢复参数无原生 select。
- 点击 Create 的模拟 HTTP 请求实际包含 `size: 3840x2160`、`quality: high`，未发送 ratio/resolution 别名。仅模拟结果用于免费 UI 验收，不代表真实网关能力。
- 将下一次生成比例改为 `1:1` 后下载，仍得到合成原图的 3840 × 2160 PNG，SHA-256 与原图一致，未进入裁切或插值。Tools → Crop 可独立进入并取消。
- 两次真实返回原图离线重放均被新的不匹配保护拒绝，未产生第三次模型调用。
- 合成本地项目已删除，浏览器验收空间已关闭。本轮按用户等待网关确认的回复暂缓 main 推送和上线，当前结论不代表生产已更新。

检查日志、真实请求和像素摘要、原图、截图与发布证据保存在本地 `output/image-generation-body-2026-10-20/`，不纳入 Git。本轮不修改数据库或 Vercel 环境变量。
