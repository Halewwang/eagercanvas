# 图片渠道迁移到 APIMart

图片继续使用 `gpt-image-2`，渠道改为 APIMart。文字继续使用 Enbrand `gpt-5.6-sol`，视频继续使用既有服务端渠道配置。用户服务权限、账户状态、任务所有权检查保持生效，不需要给用户分配 Key。

## 图片请求与胶囊

按 [APIMart 图片生成文档](https://docs.apimart.ai/en/api-reference/images/gpt-image-2/generation)适配，文生图和参考图均使用 JSON `POST /v1/images/generations`：

```json
{
  "model": "gpt-image-2",
  "prompt": "A blue circle and a red square on a cream background.",
  "n": 1,
  "size": "16:9",
  "resolution": "4k"
}
```

- `size` 使用渠道的 15 种比例或 Auto；`resolution` 使用 `1k / 2k / 4k`。比例和档位独立，Auto 比例可搭配固定档位。4K 为渠道定义的分辨率档位，具体像素随比例变化。
- 最多 15 张参考图通过 `image_urls` 传入，支持 HTTP 图片地址与有效 base64 image data URI 混用；超出上限或无效输入在请求上游前拒绝。
- 不发送旧渠道的 `quality`、`background`、`output_format`、multipart 编辑或客户端像素推导字段。文档示例与 schema 的 n 存在矛盾，项目继续固定数字 `n:1`。
- 胶囊恢复比例及 `1K / 2K / 4K` 两组参数，直接显示例如 `16:9  4K`，沿用项目深色菜单、键盘和选中状态。主节点、Enhance、3D Camera、Theme Set 继承相同参数契约。
- 请求偏好存入 `generationRatio / generationResolution`，实际媒体的 `size / ratio` 独立。兼容旧 export 字段及 Auto 分辨率；删除无效质量、背景、格式、旧像素选项和本地插值导出代码。下载保留原图，Tools → Crop 仍提供主动编辑裁切。

## 异步任务与持久化

APIMart 提交返回 task ID，按[任务文档](https://docs.apimart.ai/en/api-reference/tasks/status)通过 `GET /v1/tasks/:id` 查询。`pending` 归一化为 submitted；成功结果从 `data.result.images[].url[]` 取图。

后端在现有 audit metadata 中保存本地任务与上游 ID、截止时间及持久化 checkpoint，不新增数据库 schema、定时任务或长时间后台轮询。任务查询先检查服务、账户和所有权；CAS 租约防止正常并发重复完成。图片存储和媒体记录成功后才标记 run 完成，持久化失败可以继续查询恢复，不重新提交付费生成。checkpoint 恢复保留原有费用与 usage 记录。

客户端收到 task ID 后先将 `imageTaskId / imageTaskMetadata` 保存到项目草稿，再开始查询；重新打开节点只恢复 GET。普通生成与工具生成共用恢复路径，暂停本地跟踪或临时网络/权限错误保留任务，完成持久化或明确任务失败后才清理。超过本地等待截止时间也会先查询上游，已完成的结果仍可取回。

提交尚未返回 task ID 时点击暂停，只记录暂停意图并保持提交锁；收到并保存 task ID 后才停止本地轮询，避免再次 Create 重复付费提交。

上游提交与数据库写入不属于同一事务；上游提交成功、上游 ID 写入数据库失败时，明确返回失败，禁止自动重复 POST。此边界可能需要根据上游记录人工找回任务。

## 环境变量

后端项目 `eagercanvas-api` 的 Production、Preview、Development 已同步：

- `APIMART_API_BASE_URL=https://api.apimart.ai/v1`
- `APIMART_API_KEY`：独立图片凭据。Production/Preview 为 Secret，Development 为加密服务端变量。
- `APIMART_TIMEOUT_MS=1800000`

原 `OPENAI_*` 继续用于文字，`PROVIDER_*` 继续用于视频。核对非 APIMart 变量元数据未变化，前端不配置图片密钥。本地密钥仅保存在忽略的 backend/.env.local，模板不含密钥值。

## 两次授权真实生成

两次调用均使用合成图形，不使用用户图片。提交各一次；后续只 GET 查询和下载原图，没有自动重新提交。

| 验收 | 请求参数 | 返回原图 | 符合渠道文档 |
| --- | --- | --- | --- |
| 文生图 | `1:1 / 1k` | 1254 × 1254 PNG | 是，文档列出的 1K 方图尺寸 |
| 单参考图生成 | `16:9 / 4k` | 3840 × 2160 PNG | 是 |

首次查询发现合法 pending 状态未被旧映射覆盖，补回归后使用已保存 task ID 恢复 GET，未重发生成。两次授权额度已用完，未逐一付费验证全部 45 种比例与档位组合。

## 发布前检查

`npm run check` 通过：前端 745、后端 293、工具 19，共 1,057 项测试；ESLint、维护检查及 `npm run build` 通过。

临时本地项目使用模拟 API 验证提交后刷新恢复：1 次生成 POST、4 次状态 GET，完成后清理任务标记；胶囊显示 `16:9 / 4K`，没有原生 select。浏览器下载原图与第二次真实调用的 3840 × 2160 PNG 逐字节一致。浏览器验收未再调用付费模型，数据库并发和恢复路径使用后端测试替身验证。

请求摘要、任务状态、原图像素与哈希、环境元数据和浏览器证据保存在本地 `output/apimart-image-migration-2026-10-20/`，不纳入 Git；不包含公开密钥输出。
