# 图片设置统一到胶囊菜单（2026-10-19）

> 后续界面调整见[浏览器反馈修复](browser-feedback-2026-10-19.md)：当前胶囊提供本地裁切/导出，Background 菜单已删除。本文保留旧配置节点迁移的历史验收。

> 后续发布说明：Dashboard 精简与模型迁移已合并到当前生产；当前发布状态以 [main 发布记录](main-release-2026-10-19.md) 为准。本文中的缺素材、临时构建与未部署说明属于当时的历史记录。`output/` 链接指向本地验收附件，附件未纳入 Git。

此前参数验收截图中的“参数配置验收”是测试创建的旧 `ImageConfigNode`。上轮收缩参数后，这套独立设置卡仍被画布注册、工作流模板和旧画布使用，形成了重复入口。本次已删除组件及其专属尺寸辅助文件，图片模型、背景和生成操作统一使用现有图片胶囊菜单。

## 迁移规则

- 5 个工作流模板不再创建 `imageConfig`。5 对旧配置／空结果节点已合并，保留实际结果图片的位置、输入顺序及下游参考图连接。
- 旧配置没有图片输出时，原 ID、位置、提示词和参考图保留，转为普通图片节点。
- 旧配置有图片输出时，将输入连线接到现有输出，配置只补充输出缺失的模型、背景和保存输入；保留所有已有图片 ID、URL、实际尺寸、运行字段和历史 `sourceConfigId`。
- 已有分组或配置自身带有媒体时，保留原 ID 转为图片节点，避免合并时丢失媒体或破坏组归属。此时两个节点都使用图片胶囊，不再出现旧设置卡。
- 项目加载、保存快照、撤销／重做、旧模板导入和旧类型单节点创建均经过兼容处理。没有连接输入时可以复用保存的提示词和参考图；当前图片不会重复成为参考图。

## 验证

- `npm run check` 退出 0：前端 863、后端 468、工具 18，共 1349 项测试通过，0 失败、0 跳过；lint 与 maintenance 通过。
- 单元测试覆盖无／单／多输出、媒体与历史资产恢复、参考图和提示词顺序、分组共享输出、幂等、不修改原数据、快照往返及全部模板。
- 浏览器通过实际项目加载路径读入[旧画布夹具](../output/image-capsule-consolidation-2026-10-19/legacy-fixture.json)，确认旧卡片消失，原图片和历史运行信息保留；在胶囊中改背景、点击生成，并验证无连接旧节点复用保存输入、撤销／重做、工作流插入。2 次生成使用本地模拟 API，没有新增付费调用。
- [迁移截图](../output/image-capsule-consolidation-2026-10-19/legacy-canvas-capsules.png)、[胶囊生成截图](../output/image-capsule-consolidation-2026-10-19/capsule-generation.png)、[浏览器状态](../output/image-capsule-consolidation-2026-10-19/ui-review.json)、[请求记录](../output/image-capsule-consolidation-2026-10-19/ui-requests.json)、[模板插入状态](../output/image-capsule-consolidation-2026-10-19/workflow-ui-review.json)。临时本地验收项目与浏览器任务已清理。
- 最终源代码经临时 Vite 配置构建成功：3458 modules，5.65 秒。配置仅在工作区外补入原本缺失的 `scene01.jpeg`、`shot01.jpeg`、`workflow02.jpeg` 基线素材，原删除未恢复，不能据此认定原目录直接构建通过。

未部署生产；当前模型能力仍以此前 69 次[真实参数实测](image-parameter-capabilities-2026-10-19.md)为依据。
