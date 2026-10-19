# 模型接口迁移与验证（2026-10-19）

> 后续发布说明：Dashboard 精简与模型迁移已合并到当前生产；当前发布状态以 [main 发布记录](main-release-2026-10-19.md) 为准。本文中的旧账单链路、缺素材、未部署及当时的密钥存放状态属于历史记录，不代表当前生产状态。

图片仅保留 `gpt-image-2`，文字仅保留 `gpt-5.6-sol`。模型 ID 已通过带鉴权的 `GET https://api.enbrand.co/v1/models` 核对，返回 HTTP 200。密钥只保存在忽略的 `backend/.env.local`，没有写入前端或受版本控制的文件。

| 能力 | 上游路径 | 实测结果 |
| --- | --- | --- |
| 文字非流式 | `POST https://api.enbrand.co/v1/responses`，`store:false` | HTTP 200，得到指定回复；网关即使 `stream:false` 也返回 SSE，适配器已聚合解析 |
| 文字流式 | 同上，`stream:true` | HTTP 200，SSE 文本与 token usage 正确 |
| 图片理解 | 同上，消息包含参考图 | HTTP 200，正确识别蓝色圆形 |
| 文生图 | `POST https://api.enbrand.co/v1/images/generations` | HTTP 200，返回有效 PNG |
| 参考图编辑 | `POST https://api.enbrand.co/v1/images/edits`，multipart `image[]` | HTTP 200，返回有效 PNG |

初次接入发现图片网关存在参数偏差：请求 `1024x1024` 得到 `1254x1254`；请求 `1536x1024`、`jpeg` 得到 `2172x724`、`png`。后续已完成 69 次全参数与重复实测，并据此移除无效控制，详见[图片参数实测与界面验收](image-parameter-capabilities-2026-10-19.md)。

旧 Gemini、GPT Image Lite、Derouter 和 PhotoRoom 图片接入已移除。前端会归一化旧画布与本地存储中的模型选择；后端直接提交旧模型会被拒绝。新图片沿用本地 run 任务、后台持久化与轮询，旧上游图片任务不再请求 302，已存历史资产仍可读取。

302 视频、服务启停及历史/视频账单保留。新文字/图片不会获取用户 302 runtime key，也不会按请求 ID 查询 302 账单。新接口目前只返回 token usage，没有正式 USD 金额，账本不标记为已结算；原 302 key 金额配额只覆盖视频，不覆盖新接口的独立服务端 key。

初次迁移的本地 `npm run check` 已通过：前端 836、后端 467、工具 11，共 1314 项，包含 lint 与 maintenance 检查。另验证了服务启停、密钥隔离、旧模型拒绝、图片后台持久化及失败处理；参数收缩后的最终回归见上述后续验收记录。

原工作区在本次修改前已删除 `scene01.jpeg`、`shot01.jpeg`、`workflow02.jpeg`，导致原目录 `npm run build` 缺资源失败。这些删除保持原状；临时副本仅补入 Git 基线的三张素材，生产构建成功。未执行浏览器登录验收或生产部署。
