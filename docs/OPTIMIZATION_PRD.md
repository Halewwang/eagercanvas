# Eager Canvas 优化 PRD

> 文档目的：作为 AI 编码代理（Codex / Claude Code 等）执行优化任务的输入规格。
> 每个 Task 都包含：文件路径、行号、当前代码状态、期望结果、验收标准、回滚策略。
> AI Agent 应**逐 Task 执行并验证**，不要一次性完成所有 Task。

---

## 0. 元信息 / Meta

- **Repo**：eagercanvas（Vue 3 + Vite + @vue-flow + Express + Supabase）
- **基线分支**：main
- **执行单位**：每个 Task 单独 commit；commit message 格式 `perf(canvas): ...` / `refactor(...)` / `test(...)`
- **强制验证命令**：每 Task 完成后必须运行
  ```bash
  npm run check        # lint + maintenance check + frontend tests
  npm run build        # 生产构建必须成功
  ```
- **禁止事项**：
  - 不要绕过 `scripts/check-maintenance.mjs` 检查
  - 不要新增 `console.log`（ESLint 会拒绝）
  - 不要引入新的顶层依赖（除非 Task 明确要求）
  - 不要修改 `.pen` 文件
  - 修改超过 200 行的 Task 必须拆分为多个 commit

---

## 1. 背景与目标 / Background

### 1.1 项目现状

- 2026-05-31 校准：前端 `src` 约 47k LOC，后端 `backend/src` 约 9.7k LOC，主画布基于 `@vue-flow/core`
- 后端 Express + Supabase，多 AI provider（OpenAI / Seedance / 302）
- 已有 ESLint flat config + `check:maintenance` 脚本；根级 `npm run check` 已覆盖前端 lint、maintenance、前端测试和后端 service 测试
- 当前测试入口：前端 94 个 `.test.js`，后端 26 个 `.test.js`；结构拆分测试已覆盖 Canvas、Workspace、Admin、UsageAdmin、节点和 shared UI 主要边界

### 1.2 核心痛点（按用户感知排序）

1. **50+ 节点画布拖拽/撤销卡顿**（主线程阻塞 100-300ms）
2. **聊天接口标榜 stream 实际整包返回**（首字延迟 5-30s）
3. **超大单文件继续收敛**（`Canvas.vue` 已降至 733 行，`ImageNode.vue` 已降至 735 行，`VideoNode.vue` 已降至 768 行）
4. **视频轮询请求泄漏**（路由切换后仍在轮询）
5. **状态管理半 Pinia 半模块级 ref 混合**

### 1.3 优化目标（Definition of Done）

| 指标 | Baseline | Target |
|------|----------|--------|
| 200 节点画布拖拽 FPS | 20-30 | ≥ 50 |
| 单次保存主线程阻塞 | 100-300ms | < 16ms |
| 聊天首字延迟 | 5-30s | < 500ms |
| `Canvas.vue` 行数 | 1668（当前 733） | < 800 |
| `ImageNode.vue` 行数 | 1922（当前 735） | < 800 |
| 前端单测文件数 | 94 | 保持增长，关键结构边界有测试 |
| `npm run build` 产物 size | baseline | 增长 ≤ 5% |

### 1.4 当前结构审计结果（2026-05-31）

> 本节只记录当前 worktree 可验证的结构证据；不确定删除项仅标记为候选，不直接移除。

**审计证据**

- `git status --short` 显示当前 worktree 已有大量未提交改动和新增模块；执行优化时必须基于当前文件内容继续，不能回滚未确认的既有变更。
- 大文件扫描：`ImageNode.vue` 已从 1922 行降至 735 行、`provider.service.js` 已从 1761 行降至 123 行、`dashboard302.adapter.js` 已从 532 行降至 349 行并复用 shared video response helper 与 `dashboard302-video-helpers.js`、`runs.service.js` 已从 945 行降至 599 行并把生成资产持久化 helpers 拆到 `run-assets.js`、把 task ownership / status sync 拆到 `run-task-records.js`；`admin-usage.service.js` 已从 941 行降至 12 行并把纯 user usage view 聚合拆到 `admin-usage-view.js`、把 admin operation log 写入/查询拆到 `admin-operation-logs.js`、把 usage summary / timeseries 查询拆到 `admin-usage-metrics.js`、把 API key assignment / provider access 逻辑拆到 `admin-api-key-assignments.js`、把角色/状态/删除用户管理逻辑拆到 `admin-user-management.js`、把用户列表数据装配拆到 `admin-users-list.js`；`projects.js` 已从 1005 行降至 904 行并把项目数据映射、缩略图选择、activity 排序和 canvas 内容判断拆到 `projectsData.js`；`Wedding3x3ToolDrawer.vue` 已从 1545 行降至 473 行、`MultiAngleToolDrawer.vue` 已从 1000 行降至 505 行、`VideoEnhanceToolDrawer.vue` 已从 592 行降至 254 行、`Home.vue` 已从 1201 行降至 414 行、`canvas.js` 1083 行、`VideoNode.vue` 已降至 768 行、`Canvas.vue` 已从 1668 行降至 733 行。
- 模块化现状：`src/components/canvas` 已有 32 个 focused 文件；`src/components/admin` 有 30 个 shared admin UI 文件，`src/components/admin/features` 有 62 个 feature 文件；`src/components/nodes/{config,image,video,text}` 已有 75 个节点子模块/测试文件。
- 静态组件引用扫描未发现可直接判定为孤儿的 `.vue` 组件；`BaseCard.vue` 和旧 `WorkflowPanel` surface 已在 Phase 1 中删除，`src/config/workflows.js` 仍被 `Canvas.vue` 与 `stores/workflows.js` 使用，不属于无效代码。

**问题清单**

| ID | 风险 | 涉及文件 | 当前证据 | 建议处理 |
|----|------|----------|----------|----------|
| A1 | High | `src/stores/canvas.js:36-38`, `src/stores/canvas.js:106-108`, `src/stores/canvas.js:776-777` | `nodes/edges/groups` 是模块级深响应式 `ref`；历史、恢复、持久化路径多处 JSON 深克隆；保存路径仍生成 local/remote 两份快照。 | 先做 T1/T3 的纯函数化和测试补强，再评估 T2 shallowRef；不要直接做 T10 Pinia 纯化。 |
| A2 | Medium | `src/hooks/useApi.js:405-670`, `src/components/nodes/VideoNode.vue:708`, `src/components/nodes/VideoConfigNode.vue:110` | `useVideoGeneration.stop()` 能 abort 当前请求，但 `setTimeout` 等待不可中断；组件侧已有部分 unmount stop 调用，需要覆盖所有调用点。 | 优先执行 T4；新增 `useVideoGeneration.abort.test.js`，验证 request 与 wait 都能停止。 |
| A3 | Medium | `src/api/chat.js:16-106`, `backend/src/services/provider.service.js` | `streamChatCompletions` 是 async generator，但注释明确后端当前返回 JSON，前端强制 `stream: false`。 | T5 单独实施；保留非 streaming fallback，避免一次性影响 LLM 节点主流程。 |
| A4 | Medium | `src/views/Canvas.vue`, `src/components/nodes/ImageNode.vue`, `src/components/nodes/VideoNode.vue` | 组件已拆出显示层子模块，但主文件仍承担 route/load、store orchestration、节点动作、modal 状态等多种职责。 | T7/T8 先抽 page/node composable，再继续拆模板；每次拆分配结构测试和人工视觉回归。 |
| A5 | Low | `src/views/AdminUsers.vue`, `src/components/admin/**`, `src/hooks/useAdmin*.js`, `backend/src/services/admin-usage.service.js`, `backend/src/services/admin-usage-view.js`, `backend/src/services/admin-operation-logs.js`, `backend/src/services/admin-usage-metrics.js`, `backend/src/services/admin-api-key-assignments.js`, `backend/src/services/admin-user-management.js`, `backend/src/services/admin-users-list.js` | Admin 主页面已降至 284 行，shared UI 与 feature 模块已成型；后台 admin usage 服务已把纯视图聚合拆到 `admin-usage-view.js`，把 admin operation log 写入/查询拆到 `admin-operation-logs.js`，把 usage summary / timeseries 查询拆到 `admin-usage-metrics.js`，把 API key assignment / provider access 拆到 `admin-api-key-assignments.js`，把角色/状态/删除用户管理拆到 `admin-user-management.js`，把用户列表数据装配拆到 `admin-users-list.js`，`admin-usage.service.js` 仅保留兼容导出层。剩余风险主要是 feature 数量多、barrel 边界需要保持清楚。 | T9 不做大拆，聚焦 props/data 边界和 tab 状态隔离；继续用现有结构测试防止 shared/feature 互相反向依赖，并用 `admin-usage.service.structure.test.js` 防止后台 admin view、operation log IO、metrics 查询、API key assignment、user management 和 user list assembly 实现回流到服务编排层。 |
| A6 | Medium | `src/hooks/useApi.js:104`, `src/hooks/useApi.js:171`, `src/hooks/useApi.js:362`, `src/hooks/useApi.js:405` | 一个 hook 文件同时承载 chat、image generation、image tools、video generation 和 combined API facade。 | T12 按 domain 迁移，先保留 `src/hooks/index.js` 兼容导出，迁移完成后再收窄 barrel。 |
| A7 | Low | `backend/src/services/provider.service.js`, `backend/src/services/providers/**`, `backend/src/services/runs.service.js`, `backend/src/services/run-assets.js`, `backend/src/services/run-task-records.js` | `provider.service.js` 已降至 123 行并做请求路由分发；provider adapter/helper 已拆出；`dashboard302.adapter.js` 已把 task id / video URL 提取委派给 `video-response.js`，并把 Kling / Topaz routing、status normalization、request builder 下沉到 `dashboard302-video-helpers.js`，当前降至 349 行；`runs.service.js` 已把 provider 输出 URL 提取、远程/inline asset 持久化、image/video generation asset 组装拆到 `run-assets.js`，把 audit log task ownership、task context lookup 和 workflow run status sync 拆到 `run-task-records.js`，并保留 `runs.service.js` 旧命名导出兼容。 | 继续用 provider contract/backend tests、`dashboard302-adapter-structure.test.js`、`dashboard302-video-helpers.test.js`、`run-task-records.test.js` 和 `runs.service.structure.test.js` 防止 adapter registry、请求归一化、资产持久化和 task status 边界回退；后续只做小步 helper 收敛。 |
| A8 | Low | `src/components/tools/Wedding3x3ToolDrawer.vue`, `src/components/tools/MultiAngleToolDrawer.vue`, `src/components/tools/VideoEnhanceToolDrawer.vue`, `src/views/Home.vue` | `Wedding3x3ToolDrawer.vue` 已先把 Autocomplete / MultiAutocomplete 字段 UI 抽到 `ToolAutocompleteFields.js`，把尺寸/比例/分辨率推导抽到 `Wedding3x3GenerationOptions.js`，把异步图片结果解析/轮询抽到 `Wedding3x3AsyncImageResult.js`，把 JSON/prompt 复制和 JSON 下载动作抽到 `Wedding3x3PreviewActions.js`，把同步/异步生成编排和 pending/apply payload 组装抽到 `Wedding3x3GenerationRunner.js`，并把 scoped panel 样式抽到 `Wedding3x3ToolDrawer.css`；`Home.vue` 已把 scoped presentation 样式抽到 `Home.css`；`MultiAngleToolDrawer.vue` 已把 camera context、pending/apply payload 和 image generation request 编排抽到 `src/utils/multiAngleGenerationRunner.js`，把尺寸/比例/分辨率 option 归一化抽到 `src/utils/multiAngleSizeOptions.js`，并把 scoped panel 样式抽到 `MultiAngleToolDrawer.css`；`VideoEnhanceToolDrawer.vue` 已把 scoped panel 样式抽到 `VideoEnhanceToolDrawer.css`，把输出尺寸、pending/apply payload、增强请求 payload 和 provider URL 解析抽到 `VideoEnhanceGeneration.js`，模板、状态和 emit 入口保持不变。剩余候选文件仍被运行时引用或路由使用，不是无效代码。 | 继续纳入 UI 结构优化候选；未做动态交互截图前不改视觉和流程。 |

---

## 2. 范围 / Scope

### 2.1 In-Scope

- `src/stores/canvas.js` 性能与状态管理重构
- `src/views/Canvas.vue`、`src/components/nodes/ImageNode.vue`、`src/components/nodes/VideoNode.vue`、`src/views/AdminUsers.vue` 拆分
- `src/api/chat.js`、`src/api/video.js` 网络层优化
- `src/hooks/useApi.js` 按 chat / image / video domain 拆分
- `backend/src/services/provider.service.js` 按 provider 拆分
- 补充画布核心单测

### 2.2 Out-of-Scope

- UI 视觉/交互重设计（保持现有外观）
- 新增业务功能
- 数据库 schema 变更
- 部署/CI 流程改动
- 国际化抽离（i18n 单独立项）

---

## 3. 任务拆解 / Tasks

> 任务依赖关系：T1 → T2 → T3 → T4 ...，原则上按编号顺序执行。
> 每个 Task 单独 PR，单独 review。

### 3.0 分阶段重构计划

| Phase | 目标 | 改动范围 | 预期收益 | 验收方式 |
|-------|------|----------|----------|----------|
| Phase 0 | 审计和执行边界固化 | 仅文档、结构证据、验证门禁 | 明确“不改业务流程”的执行边界，避免后续重构漂移 | `rg` 复查旧引用；`npm run check`；`npm run build` |
| Phase 1 | 低风险无效代码和验证门禁 | `package.json`、`projectStructure.test.js`、已确认无入口的旧 surface | 降低 dead code 噪音，保证后续每步有默认验证门禁 | 已完成项保持 `npm run check` 与 `npm run build` 通过 |
| Phase 2 | 画布性能安全改造 | T1、T3、T4 和对应测试 | 降低深克隆/重复快照/轮询泄漏风险，不改变节点和保存业务语义 | 前端相关单测、完整 check/build、手动撤销/复制/刷新恢复、视频切路由验证 |
| Phase 3 | 高风险画布状态改造 | T2、T6、T10 | 收敛响应式和历史栈成本，为 200 节点场景建立性能余量 | 新增 canvas history/actions 测试，200 节点性能录制，完整回归 |
| Phase 4 | 前端 UI 模块继续收敛 | T7、T8、T9、工具抽屉候选 | 主视图和节点主文件继续瘦身，保持视觉和操作路径一致 | 结构测试、截图对比、画布节点全流程人工冒烟 |
| Phase 5 | API 与后端 provider 模块化 | T5、T12、T13 | 让网络层和 provider 适配层边界清晰，降低新增模型/供应商成本 | chat SSE 联调、provider contract test、backend tests、核心 API 回归 |
| Phase 6 | 稳定性与最终验收 | T14、T15、最终手动回归 | 关键链路有测试与降级 UI，形成可推送判断 | `npm run check`、`npm run build`、§4.3 手动 9 项、性能 baseline 对比 |

**代码改动确认门禁**

- Phase 2 及之后的运行时代码改动，需要先明确本轮执行的 Task 编号、影响范围、回滚方式和验证命令。
- 高风险项（T2、T6、T10、T13）不得和其他高风险项同一轮实施。
- 不确定的无效代码只进入候选清单，必须经过静态引用、动态入口、路由、构建和测试证据确认后再删除。

---

### Task 1 — 收敛 JSON 深克隆为安全 clone helper

**Priority**: P0
**Effort**: 30 min
**Risk**: Low

**File**: `src/stores/canvas.js`

**Current State (2026-05-31)**:
- Phase 2 T1 code update: `src/stores/canvasClone.js` owns the centralized clone helper.
- `src/stores/canvas.js` routes history snapshots, load/restore snapshots, strip-removed-node clones, and persistence sanitize clones through `cloneCanvasData()`.
- JSON fallback is retained only inside `canvasClone.js` for non-cloneable values, preserving the previous JSON-compatible fallback behavior in one place.
- Browser smoke on 2026-05-31 verified Workspace → New Project → add Text node → undo/redo → duplicate node → reload same canvas URL; the local project restored 2 text nodes after reload with no browser error logs.
- During that browser smoke, a dev-bypass direct canvas reload gap was found and fixed: `Canvas.vue` now calls `bootstrapAuth()` before `loadCachedProjects()`, covered by `src/views/Canvas.test.js`.

**Locations addressed** (line numbers based on current worktree):
- L107-109：`saveToHistory()` 对 nodes / edges / groups 使用 `cloneCanvasData()`
- L150-156：`cloneNodes`、`cloneEdges`、`stripRemovedNodes()` 使用 `cloneCanvasData()`
- L225、L266、L276：持久化 sanitize 对 node / edge / groups 使用 `cloneCanvasData()`
- L754-756：`loadProjectCanvas()` 初始化 history 使用 `cloneCanvasData()`
- L988-990：`restoreState()` 恢复 history 使用 `cloneCanvasData()`

**Previous Behavior**:
```js
nodes: JSON.parse(JSON.stringify(nodes.value))
```

**Implemented Behavior**:
```js
const cloneCanvasData = (value) => structuredClone(toRaw(value))

nodes: cloneCanvasData(nodes.value)
```

**Acceptance Criteria**:
- [x] `src/stores/canvas.js` 不再有散落的 `JSON.parse(JSON.stringify(...))` callsite；如需兼容 fallback，只能集中在一个 clone helper 内
- [x] `npm run test:frontend` 全绿（特别注意 `canvasSync.test.js`、`canvasDrafts.test.js`）
- [x] 手动验证：撤销/重做、复制节点、刷新恢复 三个场景行为不变
- [ ] Chrome DevTools Performance：执行 saveToHistory 耗时下降 ≥ 50%

**Notes**:
- `structuredClone` 不支持 function/symbol，但 nodes/edges 数据应是纯数据结构；如遇异常先排查是否混入了响应式 ref、DOM 引用或类实例
- 如果某个对象包含 DOM 引用或类实例，需保留 JSON 方式并加 TODO 注释说明

**Rollback**: 单 commit revert 即可。

---

### Task 2 — nodes / edges / groups 改为 shallowRef

**Priority**: P0
**Effort**: 4-6 hours
**Risk**: Medium（可能影响多处 reactive 依赖）

**File**: `src/stores/canvas.js`

**Locations**:
- L36-38：`nodes`、`edges`、`groups` 当前为 `ref([])`

**Current**:
```js
const nodes = ref([])
const edges = ref([])
const groups = ref([])
```

**Expected**:
```js
import { shallowRef, triggerRef } from 'vue'

const nodes = shallowRef([])
const edges = shallowRef([])
const groups = shallowRef([])
```

**Required Changes**:
1. 所有就地修改（`nodes.value.push`、`nodes.value[i].xxx = yyy`）必须改为：
   - 创建新数组：`nodes.value = [...nodes.value, newNode]`
   - 或显式触发：`nodes.value[i].xxx = yyy; triggerRef(nodes)`
2. `triggerRef(nodes)` 必须在所有就地变更后调用
3. 已有的 L407 `triggerRef` 调用作为参考模式

**Acceptance Criteria**:
- [x] 三个 ref 改为 shallowRef
- [x] 所有 `nodes.value.xxx`、`edges.value.xxx`、`groups.value.xxx` 的就地变更点都加上 `triggerRef`
- [x] @vue-flow 画布渲染正常（节点新增、删除、移动、连边、缩放）
- [x] 撤销/重做正常
- [x] 多端 broadcast 同步正常（`canvasBroadcast.test.js` 全绿）
- [x] 200 节点画布拖拽 FPS ≥ 45（目标 ≥ 50）

**Current Progress**:
- [x] `src/stores/canvas.js` 已将 `nodes`、`edges`、`groups` 从 deep `ref([])` 改为 `shallowRef([])`，并新增 `refreshCanvasCollectionRefs()` 作为 Vue Flow in-place change 的显式刷新边界。
- [x] `useCanvasNodeDragInteraction.js` 在 `nodes-change` 批次进入时触发 `refreshCanvasCollectionRefs({ nodes: true })`；`useCanvasConnectionInteraction.js` 在 `edges-change` 批次进入时触发 `refreshCanvasCollectionRefs({ edges: true })`，覆盖 Vue Flow 可能的原地 position / selected / edge 变更。
- [x] `src/stores/canvasReactivity.test.js` 锁定 shallowRef / triggerRef 结构和禁止 graph collection 数组原地 push/splice/sort 等变更；节点拖拽、边变化、画布 store/history/broadcast 相关回归 66/66 通过。
- [x] 完整本地检查：`npm run check` 通过，frontend 527/527、backend 93/93；`npm run build` 通过，3364 modules transformed。
- [x] 浏览器烟测复核 `/canvas/local-1780188562318-p06xku`：Vue Flow 正常渲染，Add Text 后节点数 6 → 7，Undo 回到 6，Redo 回到 7，最终 Undo 回到 6；无 ErrorBoundary fallback、无 Vite overlay、浏览器 warn/error 日志为空。
- [x] 2026-05-31 Browser QA 复核完整 Vue Flow 手动链路：当前画布从 7 个节点新增临时 Text 到 8 个节点；拖拽后临时节点 rect 从 `(601,425)` 变为 `(658,468)`；缩放控件从 72% 变为 86%；临时 Text → Image 连边后 edge 数 2 → 3，节点 tag 显示 `Linked to 1 module`；Delete 删除临时节点后节点数 8 → 7、edge 数 3 → 2；浏览器 warn/error 日志为空。
- [x] 2026-06-01 200 节点本地性能基线：在 `VITE_BYPASS_AUTH=true` 本地画布通过真实 UI 路径批量创建 200 个 Text 节点；12s 浏览器 rAF / PerformanceObserver 采样窗口内执行节点拖拽，`avgFrameMs=16.67`、`p95FrameMs=16.9`、`approxAvgFps=60.0`、`approxP95Fps=59.2`、`maxFrameMs=17.6`、`framesOver50Ms=0`、`longTaskCount=0`，拖拽耗时约 943ms，控制台 warn/error 为空，无 Vite overlay。该证据为本地浏览器采样，不是导出的 Chrome DevTools trace 文件。

**Verification Script**:
```bash
npm run test:frontend
npm run dev
# 手动测试：创建 50+ 节点画布，拖拽、连边、撤销、重做
```

**Pitfalls**:
- VueFlow 内部可能依赖深响应式更新，如果出现节点 UI 不更新，先检查是否漏调 `triggerRef`
- watcher 回调可能减少触发次数，需检查 `watch(nodes, ...)` 是否还能正确响应

**Rollback**: revert commit；shallowRef 改动隔离在 canvas.js 一个文件内。

---

### Task 3 — 合并 local/remote 双快照

**Priority**: P0
**Effort**: 2 hours
**Risk**: Low

**File**: `src/stores/canvas.js`

**Current State (2026-05-31)**:
- Phase 2 T3 code update: `src/stores/canvasSnapshots.js` owns persistence snapshot sanitization and paired local/remote snapshot construction.
- `saveProject()` now calls `createCanvasPersistenceSnapshots()` once to produce `{ containsTransientMedia, localSnapshot, remoteSnapshot }`.
- `createCanvasSnapshot()` remains available for non-save content snapshot keys.

**Locations addressed**:
- `src/stores/canvas.js` save setup now calls `createCanvasPersistenceSnapshots({ nodes, edges, groups, viewport })`
- `src/stores/canvasSnapshots.js` builds local and remote node payloads in one top-level nodes iteration

**Previous**:
```js
const localSnapshot = createCanvasSnapshot({ preserveTransientMedia: true })
const remoteSnapshot = createCanvasSnapshot()
```

**Implemented**:
```js
const { containsTransientMedia, localSnapshot, remoteSnapshot } = createCanvasPersistenceSnapshots({
  nodes: nodes.value,
  edges: edges.value,
  groups: groups.value,
  viewport: canvasViewport.value
})
```

**Acceptance Criteria**:
- [x] 保存路径上仅遍历 nodes 一次
- [x] `canvasSync.test.js` 全绿
- [x] 远端持久化的字段集合不变（用 `canvasSnapshots.test.js` 覆盖 remote transient pruning 和 persisted upload URL 保留语义）
- [ ] 单次保存耗时下降 ≥ 30%

---

### Task 4 — 视频轮询加 AbortController

**Priority**: P0
**Effort**: 1-2 hours
**Risk**: Low

**Files**:
- `src/hooks/useApi.js`
- `src/components/nodes/VideoNode.vue`
- `src/components/nodes/VideoConfigNode.vue`

**Current State (2026-05-31)**:
- standalone video API polling helper has been removed because no runtime caller used it.
- Current runtime polling is implemented inside `useVideoGeneration()` in `src/hooks/useApi.js`.
- Phase 2 T4 code update: `src/hooks/useVideoGenerationCore.js` owns abortable polling delay; `useVideoGeneration()` passes one active abort signal through create request, polling request, and polling wait.
- `VideoNode.vue`、`VideoConfigNode.vue` and the composable unmount lifecycle now call `stop()`.

**Current Behavior**: 固定 5s 间隔轮询，最多 120 次；代码路径已支持中断等待与请求，仍需在真实视频任务下做浏览器 Network 面板人工确认。

**Expected**:
1. `useVideoGeneration()` 内部轮询等待支持 abortable delay
2. 每次轮询前检查取消状态，aborted 时立即停止并保持现有用户提示语义
3. `VideoNode.vue` / `VideoConfigNode.vue` / 相关 composable 在 `onUnmounted` 触发 `stop()`
4. 退避策略可选升级：5s → 10s → 15s 上限（不强制）

**Code Skeleton**:
```js
const delay = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(new DOMException('Aborted', 'AbortError'))
    return
  }
  const timer = window.setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => {
    window.clearTimeout(timer)
    reject(new DOMException('Aborted', 'AbortError'))
  }, { once: true })
})

onUnmounted(() => {
  videoGen.stop()
  clearProgressTimers()
})
```

**Acceptance Criteria**:
- [x] `useVideoGeneration` 的 create request、polling request 和 delay 都能被 `stop()` 中断
- [x] 视频生成调用点全部在 unmount 时调用 `stop()`
- [ ] 切换路由后浏览器 Network 面板不再有该任务的 polling 请求
- [x] `src/utils/videoPreview.test.js` 全绿
- [x] 新增测试：验证 `useVideoGeneration.stop()` 中断 polling wait/request 行为

---

### Task 5 — 聊天 API 改真 SSE

**Priority**: P0
**Effort**: 1-2 days（前端 + 后端 + 联调）
**Risk**: Medium（涉及后端 + 多个调用方）

**Files**:
- 前端：`src/api/chat.js` L16-106
- 后端：`backend/src/services/provider.service.js` 中 chat 相关 endpoint
- 调用方：`src/components/nodes/LLMConfigNode.vue` L180-220

**Current Behavior**:
- 后端返回 `{ stream: false, ...JSON }`
- 前端 `streamChatCompletions` 是 async generator 但实际只 yield 一次
- 文本提取使用 16 路 fallback path（脆弱）

**Expected**:
1. **后端**：
   - 设置 `Content-Type: text/event-stream`
   - 使用 OpenAI SDK 的 stream 模式或对应 provider 的 streaming API
   - 按 SSE 格式输出：`data: {"delta":"..."}\n\n`，结束 `data: [DONE]\n\n`
2. **前端**：
   - 用 `fetch` + `ReadableStream` 解析 `data: ...\n\n`
   - async generator 逐 chunk yield delta
   - 删除 16 路 fallback，统一 schema：`{ delta: string, done: boolean }`
3. **节点组件**：
   - `LLMConfigNode.vue` 流式追加文本到 ref，实现打字机效果
   - 删除 L207-214 的 DOM 刷新 hack

**Acceptance Criteria**:
- [x] 后端 endpoint 返回 SSE 而非 JSON
- [x] 前端能逐 chunk 拿到 delta，UI 实时更新
- [ ] 首字延迟 < 500ms（用 DevTools Network 验证 TTFB）
- [x] 删除 chat.js L44-46 的 16 路 fallback
- [ ] 长回答（500+ token）不再白屏等待
- [x] 错误路径（429、500）有明确提示
- [x] 新增测试 `src/api/chat.stream.test.js`

**Current Progress**:
- [x] `src/api/chat.js` 已改为 `fetch` + `ReadableStream` 解析 `text/event-stream` 的 `data:` 事件，`streamChatCompletions()` 请求体发送 `stream: true`，逐个 yield provider delta，并移除旧 JSON completion 的多路径文本 fallback。
- [x] `src/hooks/api/useChatApi.js` 仍沿用现有逐 chunk 累加 `currentResponse` 的路径，调用方不需要改 API；`src/api/chat.stream.test.js` 覆盖 SSE delta chunk、SSE error、HTTP 429/500 error 和删除 `stream:false` fallback。
- [x] 后端 `/chat/completions` 对 `stream:true` 请求已改为 provider 级 SSE：`providerChatCompletionsStream()` 强制请求体 `stream: true` + `stream_options.include_usage`，`readChatCompletionSseStream()` 逐 provider event 解析 delta/usage/[DONE]，路由通过 `streamChatCompletion()` 边读边 `res.write()`，不再走 `createChatCompletion(req.user.id, { ...req.body, stream: false })` 的 JSON 转 SSE 兼容层。
- [x] streaming run 仍保留现有 run/usage 数据链路：开始时创建 `workflow_runs` running 记录，流结束后累计 assistant content / usage，更新 run completed，并写入 usage event；provider stream error 会更新 run failed 后抛出。
- [x] 新增后端测试：`backend/src/services/provider-chat-stream.test.js` 覆盖 provider stream 请求体和 SSE response，`backend/src/utils/chat-sse.test.js` 覆盖 provider SSE event reader，`backend/src/routes/chat-stream.routes.test.js` 覆盖路由不再降级到 `stream:false` JSON run。
- [ ] 仍未完成真实 provider + DevTools 验证：TTFB `<500ms` 和 500+ token 长回答不白屏需要在可用服务凭证下录制 Network/页面行为后才能验收。

**Notes**:
- 如后端 provider 不支持流式，仍可在 BFF 层用 chunk 模拟（每 50 token 发一个 chunk）
- 保留旧的非 streaming 接口作为 fallback（query 参数 `?stream=false`）

---

### Task 6 — 历史栈差分化

**Priority**: P1
**Effort**: 1-2 days
**Risk**: Medium-High（撤销重做是核心功能，需充分测试）

**File**: `src/stores/canvas.js`

**Locations**: 历史相关函数（`saveToHistory`、`undo`、`redo`、L74 `MAX_HISTORY = 50`、L280 恢复逻辑）

**Current**: 每次操作存储完整画布快照（深克隆）。

**Expected**:
- 历史项改为 patch 结构：`{ type: 'add'|'remove'|'update'|'move', payload: {...} }`
- `saveToHistory` 接受操作描述而非整个 state
- `undo / redo` 通过反向应用 patch 实现
- 复合操作（多节点拖拽）用 `transaction`：`startTransaction() → ... → commitTransaction()`

**Acceptance Criteria**:
- [x] 撤销重做行为与现状一致（用现有手动用例覆盖）
- [ ] 历史栈内存占用下降 ≥ 80%（用 Performance Memory 录制对比）
- [x] 单次 undo/redo 耗时 < 5ms
- [x] 新增 `src/stores/canvas.history.test.js`，覆盖：单节点 add/remove、多节点 move、连边、复合事务、超过 MAX_HISTORY 的滚出
- [x] 测试场景：连续 100 次操作 + 50 次撤销 + 50 次重做，最终状态与连续操作前一致

**Current Progress**:
- [x] `src/stores/canvasHistoryCore.js` 已把非初始 history entry 从完整快照改为 patch entry：`snapshot` 作为滚动基线，后续使用 `add` / `remove` / `update` / `move` / `transaction` / `noop` 记录差异。
- [x] `canvas.js` 的 `saveToHistory`、`undo`、`redo` 已接入 patch history core；对外 action、toolbar undo/redo 调用和现有保存时机保持不变。
- [x] `canvas.history.test.js` 覆盖 patch 分类、future trim、MAX_HISTORY 滚动后 snapshot base、legacy snapshot 兼容、add/remove/move/edge undo/redo、multi-node move transaction、100 次操作 + 50 undo + 50 redo，并断言 patch history 序列化体积不超过 full snapshot history 的 20%。
- [x] Node 基准（200 nodes / 100 move operations）测得 patch history 97,022 bytes vs full snapshot 8,668,108 bytes，序列化体积下降 98.88%；50 次 undo 最大 2.902ms，50 次 redo 最大 0.233ms。
- [x] 浏览器烟测复核 `/canvas/local-1780188562318-p06xku`：Add Node → Text 后节点数 5 → 6，Undo 回到 5，Redo 回到 6，最终 Undo 回到 5；无 ErrorBoundary fallback、无 Vite overlay、浏览器 warn/error 日志为空。
- [ ] 尚未录制 Chrome DevTools Performance Memory；当前 98.88% 为 Node 序列化基线，不等同于 Chrome heap 证据。

**Implementation Hint**: 已有 `markCanvasDirty` debounce 机制可复用，patch 累积即落到 dirty 周期内。

---

### Task 7 — Canvas.vue 拆分

**Priority**: P1
**Effort**: 3-5 days
**Risk**: Medium

**File**: `src/views/Canvas.vue`（当前 733 行，原 1668 行）

**Target Structure**:
```
src/
├── views/
│   └── Canvas.vue                              ← 仅做容器与 store 对接，目标 < 800 行
└── components/canvas/
    ├── CanvasToolbar.vue                       ← 已存在：侧向工具栏
    ├── CanvasTopControls.vue                   ← 已存在：顶部项目 / 分享 / 远端刷新入口
    ├── CanvasFlowStage.vue                     ← 已存在：Vue Flow stage 包装
    ├── CanvasGroupOverlay.vue                  ← 已存在：分组 overlay
    └── CanvasProjectModals.vue / CanvasSyncModals.vue / CanvasShareModal.vue
└── hooks/
    ├── useCanvasNodeMenuState.js               ← 已存在：节点创建菜单状态 / 文案 / 浮层位置 / 数量步进
    ├── useCanvasRouteLifecycle.js              ← 已存在：route / initial load / cached draft / cleanup orchestration
    ├── useCanvasProjectUiState.js              ← 已存在：project dropdown / share / rename/delete modal state
    ├── useCanvasGroupActions.js                ← 已存在：group create / rename / duplicate / ungroup / delete orchestration
    ├── useCanvasGroupDrag.js                   ← 已存在：group drag listener lifecycle / movement / body hit target orchestration
    ├── useCanvasNodeDragInteraction.js         ← 已存在：node drag / grouped sibling movement / node change orchestration
    ├── useCanvasOverlayRects.js                ← 已存在：group / multiselect overlay rect measurement and scheduling
    ├── useCanvasViewportInteraction.js         ← 已存在：grid style / viewport settle persistence orchestration
    ├── useCanvasSelectionInteraction.js        ← 已存在：node/group selection / pane click / delete keyboard orchestration
    ├── useCanvasConnectionInteraction.js       ← 已存在：connect / connect-release node menu / context menu / edge removal history orchestration
    └── useCanvasSyncResolution.js              ← 已存在：sync indicator / conflict / remote refresh orchestration
```

**Current Progress**:
- [x] `CanvasTopControls`、`CanvasToolbar`、`CanvasZoomControls`、`CanvasFlowStage`、`CanvasGroupOverlay`、`CanvasNodeMenu`、`CanvasProjectModals`、`CanvasSyncModals`、`CanvasAuxiliaryPanels`、`CanvasShareModal` 已作为 focused canvas components 接管主要页面 chrome 和弹层结构。
- [x] `useCanvasNodeMenuState.js` 已承接节点创建菜单的 mode/title/copy/style、浮层坐标、connect/pane 上下文、数量 stepper 和 toolbar toggle 状态。
- [x] `useCanvasNodeMenuState.test.js` 覆盖菜单文案、数量边界、toolbar toggle、connect/pane 菜单坐标和 viewport clamp 行为；`Canvas.test.js` 覆盖 `Canvas.vue` 对该 composable 的结构委派。
- [x] `useCanvasGroupActions.js` 已承接分组创建、选择、重命名、复制、取消分组和删除的 orchestration；拖拽相关编排已继续拆入 `useCanvasGroupDrag.js`。
- [x] `useCanvasGroupActions.test.js` 覆盖 group create/select/rename/duplicate/ungroup/delete/invalid no-op 行为；`Canvas.test.js` 覆盖 `Canvas.vue` 对该 composable 的结构委派。
- [x] `useCanvasGroupDrag.js` 已承接 group drag listener lifecycle、blank body hit target、指针移动增量、overlay rect 平移和结束保存标记。
- [x] `useCanvasGroupDrag.test.js` 覆盖 group drag listener 注册/清理、节点移动增量、overlay rect 平移、history save flag、blank body 拖拽和交互目标忽略；`Canvas.test.js` 覆盖 `Canvas.vue` 对该 composable 的结构委派。
- [x] `useCanvasNodeDragInteraction.js` 已承接 node drag start/stop、grouped sibling delta 移动、Vue Flow 已移动 sibling 时跳过重复移动、nodes-change selection sync 和 overlay scheduling。
- [x] `useCanvasNodeDragInteraction.test.js` 覆盖 grouped node sibling 增量移动、Vue Flow group movement guard、非 position change selection sync、无移动时不保存 history；`Canvas.test.js` 覆盖 `Canvas.vue` 对该 composable 的结构委派。
- [x] `useCanvasOverlayRects.js` 已承接 group / multiselect overlay rect measurement、selected group menu rect、body hit rects、RAF/timeout scheduling 和 unmount cleanup。
- [x] `useCanvasOverlayRects.test.js` 覆盖 group overlay 派生状态、multi-select 菜单显示规则、拖拽期间跳过 measurement、force schedule 和 cleanup 行为；`Canvas.test.js` 覆盖 `Canvas.vue` 对该 composable 的结构委派。
- [x] `useCanvasSyncResolution.js` 已承接 sync indicator、remote refresh control、sync conflict modal 状态、远端刷新、覆盖远端版本和另存副本 orchestration。
- [x] `useCanvasSyncResolution.test.js` 覆盖 indicator 文案、conflict modal 自动打开/取消、远端刷新、覆盖保存和另存副本路径；`Canvas.test.js` 覆盖 `Canvas.vue` 对该 composable 的结构委派和 setup 声明顺序，避免 route runtime 空白页回归。
- [x] 浏览器烟测已覆盖 `/canvas/local-1780188562318-p06xku`：原始画布可渲染 Workspace / sync controls / Text / Image / Video nodes / Vue Flow，控制台无 warn/error。
- [x] `useCanvasRouteLifecycle.js` 已承接 route watch、初始 auth/cache/project load、远端快照刷新保护、空白媒体恢复、pending workflow template 应用、pagehide/visibility 保存和 unmount cleanup。
- [x] `useCanvasRouteLifecycle.test.js` 覆盖缓存优先加载、pending template、远端刷新不覆盖本地编辑、空媒体恢复和 cleanup listener 行为；`Canvas.test.js` 覆盖 `Canvas.vue` 对该 composable 的结构委派。
- [x] route lifecycle 拆分后浏览器烟测已复核 `/canvas/local-1780188562318-p06xku`：Workspace / Share / sync controls / 5 个 Vue Flow nodes 正常渲染，控制台无 warn/error。
- [x] `useCanvasViewportInteraction.js` 已承接 canvas grid style、缩放中样式冻结、viewport-change perf 记录、延迟持久化和 settle timer cleanup。
- [x] `useCanvasViewportInteraction.test.js` 覆盖 grid style 计算、zoom freeze、viewport settle persistence 和 timer cleanup；`Canvas.test.js` 覆盖 `Canvas.vue` 对该 composable 的结构委派。
- [x] viewport interaction 拆分后浏览器烟测已复核 `/canvas/local-1780188562318-p06xku`：Vue Flow / 5 个 nodes / grid CSS variables / Workspace / Share / sync controls 正常渲染，控制台无 warn/error。
- [x] `useCanvasSelectionInteraction.js` 已承接 selected node/group 派生状态、node/pane click、selection flag sync、capsule suppression 和 Delete/Backspace 删除 orchestration。
- [x] `useCanvasSelectionInteraction.test.js` 覆盖选择派生、清空 node/group selection、multi-select capsule suppression、pane click suppression、typing target guard 和 delete/backspace 路径；`Canvas.test.js` 覆盖 `Canvas.vue` 对该 composable 的结构委派。
- [x] `useCanvasConnectionInteraction.js` 已承接 connect edge resolve、invalid connection warning、connect-release node menu、pane/context menu 和 edge removal history save orchestration。
- [x] `useCanvasConnectionInteraction.test.js` 覆盖有效连边、释放到空白处打开节点菜单、非法连边提示、pane/context menu 目标过滤和 edge removal nextTick history save；`Canvas.test.js` 覆盖 `Canvas.vue` 对该 composable 的结构委派。
- [x] connection/context menu 拆分后浏览器烟测已复核 `/canvas/local-1780188562318-p06xku`：Workspace / Share / sync controls / 5 个 Vue Flow nodes 正常渲染，点击文字节点后选中状态正常，控制台无 warn/error。
- [x] `useCanvasProjectUiState.js` 已承接 project dropdown options、project name/workspace name、rename/delete modal visibility、share dialog loading/action state、template title/description/status 和 timestamp 状态；`useCanvasProjectActions.js` 保留 rename/duplicate/delete/publish/unpublish 业务编排并委派 UI state。`useCanvasProjectUiState.test.js` 覆盖 project menu、rename/delete modal 默认值、share dialog 默认值和 template status 更新；`Canvas.test.js` 覆盖结构委派。

**Acceptance Criteria**:
- [x] `Canvas.vue` 行数 < 800
- [x] 抽出的子组件 / composable 各自单一职责，行数 < 400
- [ ] 视觉与交互 100% 一致（人工对比）
- [x] `npm run check` 全绿
- [x] 至少为新抽出的 Canvas page-level composable 增加单测

**Latest Verification**:
- [x] `src/views/Canvas.test.js` 已新增 focused module line ceiling 结构测试，扫描 `src/components/canvas/*.vue` 与非测试的 `src/hooks/useCanvas*.js`，要求所有抽出的 Canvas component / composable 低于 400 行，并继续要求 `Canvas.vue` 低于 800 行。
- [x] 当前行数证据：`Canvas.vue` 742 行；最大 Canvas composable 为 `useCanvasRouteLifecycle.js` 240 行；最大 Canvas component 为 `CanvasFlowStage.vue` 142 行。
- [x] Canvas 结构与 hook 回归：`node --test src/views/Canvas.test.js src/hooks/useCanvas*.test.js`，48/48 通过。

**拆分原则**：
- 先拆 composable（不影响模板），再拆子组件
- 每个子组件 / composable 独立 commit，便于回滚
- props 传递保持显式（不用 provide/inject 走捷径）

---

### Task 8 — ImageNode.vue / VideoNode.vue 拆分

**Priority**: P1
**Effort**: 3-4 days each
**Risk**: Medium

**Files**:
- `src/components/nodes/ImageNode.vue`（当前 735 行，原 1922 行）
- `src/components/nodes/VideoNode.vue`（当前 768 行）

**Target Structure**:
```
src/components/nodes/image/
├── ImageNodeDisplayFrame.vue    ← 已存在：预览区
├── ImageNodePreviewModal.vue    ← 已存在：预览 modal
├── ImageNodeCropOverlay.vue     ← 已存在：裁剪 overlay
├── ImageNodeToolDrawers.vue     ← 已存在：工具抽屉
├── useImageNodePreviewState.js  ← 已存在：预览 modal 状态 / stage measurement / zoom focus / resize listener orchestration
├── useImageNodeProgressState.js ← 已存在：generation progress timers / upload progress style orchestration
├── useImageNodePreviewDownload.js ← 已存在：preview filename / blob download / fallback download orchestration
├── useImageNodeCanvasPreview.js ← 已存在：canvas preview cache / stale request guard / display source orchestration
├── useImageNodeCropInteraction.js ← 已存在：crop mode / crop rect / pointer listener / keyboard shortcut orchestration
├── useImageNodeLinkedNodes.js ← 已存在：linked image node create / edge / selection / update save orchestration
├── useImageNodeModelControls.js ← 已存在：image model / size / ratio / resolution / advanced capsule controls
├── useImageNodeUploadLifecycle.js ← 已存在：upload input trigger / local blob preview cleanup / beforeunload guard / progress reset / upload save outcome application
├── useImageNodePersistence.js ← 已存在：image output persistence / save feedback / tool save message dispatch
├── useImageNodeReplacement.js ← 已存在：crop/replacement preview, upload persistence, save feedback, and restore orchestration
├── useImageNodeGeneration.js ← 已存在：create/regenerate request, output persistence, save feedback, and stop orchestration
├── useImageNodeToolActions.js ← 已存在：tool menu dispatch, 4K enhancement, remove background, crop apply, persistence feedback orchestration
├── useImageNodeToolDrawerResults.js ← 已存在：multi-angle / wedding 3x3 apply, pending linked node, error, persistence feedback orchestration
└── useImageNodeUploadPersistence.js ← 已存在：manual upload persistence / cloud save / failure fallback orchestration
```

**Current Progress**:
- [x] Text/Image/Video 节点的 binding status tag 已统一到父节点生成 `items` 并直接渲染共享 `NodeBindingStatus`；已删除空转发/重复 wrapper `TextNodeBindingStatus.vue` / `ImageNodeBindingStatus.vue` / `VideoNodeBindingStatus.vue`，共享组件提供 `flush` 模式保持 Video 既有无上边距布局，`TextNodeStructure.test.js` / `ImageNodeStructure.test.js` / `VideoNodeStructure.test.js` 覆盖一致的共享 UI contract。
- [x] Text/Image 节点的 binding status tag 已显式通过 `:module-style="moduleStyle"` 锚定到模块宽度，避免 Text 的 `Not linked` / `Image` 胶囊偏离图片模块 tag UI；`TextNodeStructure.test.js` / `ImageNodeStructure.test.js` 覆盖状态胶囊在模块之后渲染，浏览器烟测复核 2 个 Text nodes 与 2 个 Image nodes 的 tag 均位于模块底部且宽度一致，控制台无 warn/error。
- [x] `useTextNodeProgressState.js` 已承接 TextNode 生成进度 timer、finish transition、error clear 和 stop/reset 逻辑；`TextNode.vue` 已降至 372 行，`TextNodeStructure.test.js` 覆盖结构委派，`useTextNodeProgressState.test.js` 覆盖 loading、error 和 stop reset 行为。
- [x] `useVideoNodeProgressState.js` 已承接 VideoNode 生成进度 timer、finish transition、已有 URL 时不启动、error clear 和 stop/reset 逻辑；该切片后 `VideoNode.vue` 降至 983 行，`VideoNodeStructure.test.js` 覆盖结构委派，`useVideoNodeProgressState.test.js` 覆盖 loading、existing video URL、error 和 stop reset 行为。
- [x] `useVideoNodeUploadPersistence.js` 已承接 VideoNode 视频上传文件大小校验、上传进度派生、beforeunload 保护、上传 API 调用、保存反馈、失败 error patch 和 input trigger guard；`VideoNode.vue` 不再内联 `handleFileUpload` / `triggerUpload` / `resetUploadProgress` / beforeunload watcher，该切片后降至 888 行。
- [x] `useVideoNodeUploadPersistence.test.js` 覆盖超大文件校验、上传保存成功、项目保存失败、上传异常、trigger guard 和 beforeunload listener lifecycle；VideoNode 周边 `node --test` 回归 40/40 通过。
- [x] upload persistence 拆分后浏览器烟测已复核 `/canvas/local-1780188562318-p06xku`：5 个 Vue Flow nodes、1 个 Video node、1 个 video upload input 正常渲染，控制台无 warn/error。
- [x] `useVideoNodeEnhanceResults.js` 已承接 VideoNode 增强工具的 linked video node 创建、edge 连接、pending node 保存、增强结果持久化、保存反馈、临时结果警告和错误回填；`VideoNode.vue` 不再内联 `createLinkedVideoNode` / `updateLinkedVideoNode` / `resolveVideoPersistence` / `handleEnhance*`，当前已降至 768 行。
- [x] `useVideoNodeEnhanceResults.test.js` 覆盖 replace/enhance 工具菜单分发、pending linked node 创建、replace-mode pending 跳过、持久化成功、持久化失败临时结果、保存失败 warning、apply 错误和 drawer error 回填；VideoNode 周边 `node --test` 回归 49/49 通过。
- [x] enhance results 拆分后浏览器烟测已复核 `/canvas/local-1780188562318-p06xku`：5 个 Vue Flow nodes、1 个 Video node、1 个 video upload input、Video node Tools/Create 文案正常渲染，控制台无 warn/error。
- [x] 浏览器回归已复核 `/canvas/local-1780188562318-p06xku`：Text 的 `Not linked` / `Image` 与 Image 的 `Prompt` / `Reference Picture` 均渲染在模块下方，控制台无 warn/error。
- [x] `ToolAutocompleteFields.js` 已承接 Wedding 3x3 抽屉的 Autocomplete / MultiAutocomplete 字段 UI、搜索匹配和浮层关闭逻辑；`Wedding3x3ToolDrawer.vue` 不再内联 `defineComponent` 字段组件，当前已从 1545 行降至 1238 行。
- [x] `Wedding3x3ToolDrawerStructure.test.js` 覆盖 Wedding 抽屉对字段模块的结构委派，以及下拉选项归一化和 label/description/key 搜索匹配；工具抽屉周边 `node --test` 回归 22/22 通过。
- [x] 字段组件拆分后浏览器烟测已复核 `/canvas/local-1780188562318-p06xku`：reload 后 5 个 Vue Flow nodes、2 个 Image nodes、Workspace/Share/Tools 基础 chrome 正常渲染，选中 Image node 后控制台无 warn/error；当前本地画布 Image 工具入口因无可用输出资产处于 disabled，未强制写入测试图片打开 Wedding 抽屉。
- [x] `Wedding3x3GenerationOptions.js` 已承接 Wedding 3x3 抽屉的 provider size → ratio/resolution 推导、ratio/resolution option 去重和 selected size fallback 规则；`Wedding3x3ToolDrawer.vue` 当前已降至 1184 行。
- [x] `Wedding3x3GenerationOptions.test.js` 覆盖比例 bucket、分辨率 bucket、option 输出顺序和 selected size fallback；`Wedding3x3ToolDrawerStructure.test.js` 覆盖抽屉对生成选项模块的结构委派，工具抽屉周边 `node --test` 回归 27/27 通过。
- [x] 生成选项拆分后浏览器烟测已复核 `/canvas/local-1780188562318-p06xku`：reload 后 5 个 Vue Flow nodes、2 个 Image nodes、Workspace/Share/Tools/Create 基础 chrome 正常渲染，控制台无 warn/error。
- [x] `Wedding3x3AsyncImageResult.js` 已承接 Wedding 3x3 抽屉的异步模型识别、provider task id 提取、结果 URL 提取、失败状态识别和轮询超时消息；`Wedding3x3ToolDrawer.vue` 当前已降至 1119 行。
- [x] `Wedding3x3AsyncImageResult.test.js` 覆盖异步模型大小写/空值、task id 别名、URL 别名、轮询成功、失败状态、超时消息和空 task id；`Wedding3x3ToolDrawerStructure.test.js` 覆盖抽屉对异步结果模块的结构委派，工具抽屉周边 `node --test` 回归 33/33 通过。
- [x] 异步结果拆分后浏览器烟测已复核 `/canvas/local-1780188562318-p06xku`：reload 后 5 个 Vue Flow nodes、2 个 Image nodes、1 个 Video node、Workspace/Share/Tools/Create 基础 chrome 正常渲染，控制台无 warn/error。
- [x] `Wedding3x3PreviewActions.js` 已承接 Wedding 3x3 抽屉的 JSON/prompt 复制、复制失败提示、JSON blob 下载、临时 object URL 清理和下载失败提示；`Wedding3x3ToolDrawer.vue` 当前已降至 1099 行。
- [x] `Wedding3x3PreviewActions.test.js` 覆盖复制成功/失败、JSON 下载 link 组装、filename、object URL revoke 调度和下载失败提示；`Wedding3x3ToolDrawerStructure.test.js` 覆盖抽屉对 preview action 模块的结构委派，工具抽屉周边 `node --test` 回归 38/38 通过。
- [x] `Wedding3x3GenerationRunner.js` 已承接 Wedding 3x3 抽屉的 pending/apply payload 组装、同步模型 `imageGen.generate()` 请求、异步模型 run 创建、task polling、结果 URL 归一化和空输出错误；`Wedding3x3ToolDrawer.vue` 当前已降至 1035 行。
- [x] `Wedding3x3GenerationRunner.test.js` 覆盖 pending/apply payload、同步模型请求 payload、异步 task polling 和空输出错误；`Wedding3x3ToolDrawerStructure.test.js` 覆盖抽屉对 generation runner 的结构委派，工具抽屉周边 targeted `node --test` 回归 11/11 通过。
- [x] `Wedding3x3ToolDrawer.css` 已承接 Wedding 3x3 抽屉的 scoped panel 样式；`Wedding3x3ToolDrawer.vue` 保留模板、状态和 generation orchestration 入口，当前已降至 473 行。
- [x] `Wedding3x3ToolDrawerStructure.test.js` 覆盖抽屉对外置 scoped stylesheet 的结构委派；Wedding 3x3 targeted `node --test` 回归 26/26 通过。
- [x] `Home.css` 已承接 Home 页面 scoped presentation 样式；`Home.vue` 保留页面模板、资源 import、路由/auth 操作入口和生命周期逻辑，当前已降至 414 行。
- [x] `Home.test.js` 覆盖 Home 页面对外置 scoped stylesheet 的结构委派，以及现有三列 module tab / 3D module / Figma icon 资源 contract；Home targeted `node --test` 回归 4/4 通过。
- [x] `src/utils/multiAngleGenerationRunner.js` 已承接 Multi Angle 抽屉的 camera context/prompt/meta 组装、pending/apply payload、同步 image generation 请求、结果 URL 归一化和空输出错误；`src/utils/multiAngleSizeOptions.js` 已承接尺寸/比例/分辨率 option 归一化、ratio 过滤和 resolution 去重；`MultiAngleToolDrawer.css` 已承接 Multi Angle 抽屉的 scoped panel 样式；`MultiAngleToolDrawer.vue` 当前已降至 505 行。
- [x] `multiAngleGenerationRunner.test.js` 覆盖 camera context、pending/apply payload、生成请求 payload 和空输出错误；`multiAngleSizeOptions.test.js` 覆盖比例 bucket、分辨率 bucket、option normalize、ratio fallback 和 resolution 去重；`MultiAngleToolDrawerStructure.test.js` 覆盖抽屉对 runner、size option utility 与外置 scoped stylesheet 的结构委派，Multi Angle targeted `node --test` 回归 16/16 通过。
- [x] `VideoEnhanceToolDrawer.css` 已承接 Video Enhance 抽屉的 scoped panel 样式；`VideoEnhanceToolDrawer.vue` 保留模板、状态、输出尺寸计算、pending/apply meta 和 `videoGen.generate()` 请求编排，当前已从 592 行降至 313 行。
- [x] `VideoEnhanceToolDrawerStructure.test.js` 覆盖 Video Enhance 抽屉对外置 scoped stylesheet 的结构委派，targeted `node --test src/components/tools/VideoEnhanceToolDrawerStructure.test.js` 回归 1/1 通过。
- [x] `VideoEnhanceGeneration.js` 已承接 Video Enhance 抽屉的输出尺寸计算、output payload、pending/apply payload、`tool: enhance` 请求 payload、provider `url` / `video_url` 解析和空输出错误；`VideoEnhanceToolDrawer.vue` 保留模板、表单状态、显示用 `ratioLabel`、可见性同步和 emit 入口，当前已从 313 行降至 254 行。
- [x] `VideoEnhanceGeneration.test.js` 覆盖 16:9 / 9:16 / 非法 ratio 的输出尺寸、source frame rate fallback、pending/apply meta、provider 请求形状、`video_url` 解析和空输出错误；`VideoEnhanceToolDrawerStructure.test.js` 覆盖抽屉对 generation module 与外置 scoped stylesheet 的结构委派，targeted `node --test src/components/tools/VideoEnhanceGeneration.test.js src/components/tools/VideoEnhanceToolDrawerStructure.test.js` 回归 7/7 通过。
- [x] Video Enhance generation runner 拆分后全量本地检查通过：工具抽屉 targeted `node --test` 回归 27/27，`npm run check` 中 frontend 578/578、backend 99/99、tools 7/7 通过，`npm run build` 打包 3378 modules 并在 5.42s 完成；comparable gzip 体积为 420,396 bytes，较 400,929 baseline 增加 4.8555%，距离 420,975 bytes 上限剩余 579 bytes；`npm run check:validation-readiness` 仍为 7/10 ready，剩余阻塞是本地 `SUPABASE_SERVICE_ROLE_KEY`、`RESEND_API_KEY`、`PROVIDER_API_KEY` / `DASHBOARD_302_API_KEY` 仍为占位值。
- [x] `run-assets.js` 已承接 `runs.service.js` 内的 provider video URL 提取、远程 URL / inline data URL 持久化、image/video generation asset 组装和 source node id 归一化；`runs.service.js` 当前从 945 行降至 790 行，只导入这些 helper 并保留旧命名导出，避免破坏既有测试/调用方。
- [x] `run-assets.test.js` 覆盖远程/inline 图片持久化、inline data URL 不进入 image history、嵌套 video URL 替换和 provider result metadata 的 source node id 优先级；`runs.service.structure.test.js` 覆盖 `runs.service.js` 对 `run-assets.js` 的结构委派与兼容导出。targeted `node --test backend/src/services/run-assets.test.js backend/src/services/runs.service.structure.test.js backend/src/services/runs.service.persistence.test.js backend/src/services/runs.service.video.test.js` 回归 13/13 通过。
- [x] `run-assets.js` 拆分后全量本地检查通过：`npm run check` 中 frontend 578/578、backend 105/105、tools 7/7 通过，`npm run build` 打包 3378 modules 并在 4.86s 完成；comparable gzip 体积为 420,382 bytes，较 400,929 baseline 增加 4.8520%，距离 420,975 bytes 上限剩余 593 bytes；`git diff --check` 通过；`npm run check:validation-readiness` 仍为 7/10 ready，剩余阻塞是本地 `SUPABASE_SERVICE_ROLE_KEY`、`RESEND_API_KEY`、`PROVIDER_API_KEY` / `DASHBOARD_302_API_KEY` 仍为占位值。
- [x] `run-task-records.js` 已承接 `runs.service.js` 内的 image/video task ownership audit log 写入、task ownership 校验、task → run context 查询、image/video task result 到 `workflow_runs` 状态同步；`runs.service.js` 当前从 790 行降至 599 行，只保留 run 创建、provider 调用、usage/media record 编排入口。
- [x] 清理 `runs.service.js` 内未被调用、也未导出的 `findImageRunIdByTask` dead helper；保留实际使用的 `findImageRunContextByTask` 和 `findVideoRunContextByTask` 于 `run-task-records.js`，避免删除动态入口风险。
- [x] `run-task-records.test.js` 覆盖 image task audit metadata、缺失 ownership 的 404、task context 回查、失败 image task 状态同步和带 provider video URL 的 completed 状态同步；`runs.service.structure.test.js` 覆盖 `runs.service.js` 对 task ownership/status helper 的结构委派。targeted `node --test backend/src/services/run-task-records.test.js backend/src/services/runs.service.structure.test.js backend/src/services/runs.service.persistence.test.js backend/src/services/runs.service.video.test.js` 回归 15/15 通过。
- [x] `run-task-records.js` 拆分后全量本地检查通过：`npm run check` 中 frontend 578/578、backend 111/111、tools 7/7 通过，`npm run build` 打包 3378 modules 并在 4.70s 完成；comparable gzip 体积为 420,397 bytes，较 400,929 baseline 增加 4.8557%，距离 420,975 bytes 上限剩余 578 bytes；`git diff --check` 通过；touched files secret scan 无命中；`npm run check:validation-readiness` 仍为 7/10 ready，剩余阻塞是本地 `SUPABASE_SERVICE_ROLE_KEY`、`RESEND_API_KEY`、`PROVIDER_API_KEY` / `DASHBOARD_302_API_KEY` 仍为占位值。
- [x] `admin-usage-view.js` 已承接后台 admin user usage view 的纯聚合逻辑、active/deleted API key assignment 过滤、302 key inventory cost alias 读取、official usage / reconciliation / usageMeta / service safe view 组装；`admin-usage.service.js` 当前从 941 行降至 725 行，保留原 `buildAdminUserUsageView` re-export 兼容现有导入。
- [x] `admin-usage-view.test.js` 覆盖 deleted api assignment 过滤与 `currentCost` alias 成本读取；`admin-usage.service.structure.test.js` 覆盖后台服务对 `admin-usage-view.js` 的结构委派，并防止 `formatServiceCredentialForAdmin` / `readKeyCost` / `buildAdminUserUsageView` 回流到服务编排文件；既有 `admin-usage.service.test.js` 保持从 service 导入的兼容路径。targeted `node --test backend/src/services/admin-usage-view.test.js backend/src/services/admin-usage.service.test.js backend/src/services/admin-usage.service.structure.test.js` 回归 3/3 通过。
- [x] `admin-usage-view.js` 拆分后全量本地检查通过：`npm run check` 中 frontend 578/578、backend 113/113、tools 7/7 通过，`npm run build` 打包 3378 modules 并在 4.43s 完成；comparable gzip 体积为 420,374 bytes，较 400,929 baseline 增加 4.8500%，距离 420,975 bytes 上限剩余 601 bytes；`git diff --check` 通过；touched files secret scan 无命中；`npm run check:validation-readiness` 仍为 7/10 ready，剩余阻塞是本地 `SUPABASE_SERVICE_ROLE_KEY`、`RESEND_API_KEY`、`PROVIDER_API_KEY` / `DASHBOARD_302_API_KEY` 仍为占位值。
- [x] `admin-operation-logs.js` 已承接后台 admin operation log 写入、缺失 `admin_operation_logs` 表时 fallback 到 `audit_logs`、日志分页查询、operator/target email 映射和 pagination clamp；`admin-usage.service.js` 当前从 725 行降至 641 行，继续 re-export `listAdminOperationLogs` 兼容 `admin.routes.js` 原有导入。
- [x] `admin-operation-logs.test.js` 覆盖 missing relation fallback 与列表分页/email 映射；`admin-usage.service.structure.test.js` 覆盖后台服务对 `admin-operation-logs.js` 的结构委派，并防止 `admin_operation_logs` / `ADMIN_AUDIT_QUERY_FAILED` 回流到服务编排文件。targeted `node --test backend/src/services/admin-operation-logs.test.js backend/src/services/admin-usage.service.structure.test.js` 回归 4/4 通过。
- [x] `admin-operation-logs.js` 拆分后全量本地检查通过：`npm run check` 中 frontend 578/578、backend 116/116、tools 7/7 通过，`npm run build` 打包 3378 modules 并在 4.72s 完成；comparable gzip 体积为 420,375 bytes，较 400,929 baseline 增加 4.8502%，距离 420,975 bytes 上限剩余 600 bytes；`git diff --check` 通过；touched files secret scan 无命中；`npm run check:validation-readiness` 仍为 7/10 ready，剩余阻塞是本地 `SUPABASE_SERVICE_ROLE_KEY`、`RESEND_API_KEY`、`PROVIDER_API_KEY` / `DASHBOARD_302_API_KEY` 仍为占位值。
- [x] `admin-usage-metrics.js` 已承接后台 admin usage summary / timeseries 查询、日期过滤归一化、summary 缺表 fallback、timeseries 同日聚合排序；`admin-usage.service.js` 当前从 641 行降至 555 行，继续 re-export `getAdminUsageSummary` / `getAdminUsageTimeseries` 兼容 `admin.routes.js` 原有导入。
- [x] `admin-usage-metrics.test.js` 覆盖 provider billing records 聚合、user/date 过滤和 duplicate daily aggregate 合并；`admin-usage.service.structure.test.js` 覆盖后台服务对 `admin-usage-metrics.js` 的结构委派，并防止 metrics 查询实现回流到服务编排文件。targeted `node --test backend/src/services/admin-usage-metrics.test.js backend/src/services/admin-usage.service.test.js backend/src/services/admin-usage.service.structure.test.js` 回归 6/6 通过。
- [x] `admin-usage-metrics.js` 拆分后全量本地检查通过：`npm run check` 中 frontend 578/578、backend 119/119、tools 7/7 通过，`npm run build` 打包 3378 modules 并在 4.93s 完成；comparable gzip 体积为 420,392 bytes，较 400,929 baseline 增加 4.8545%，距离 420,975 bytes 上限剩余 583 bytes；`git diff --check` 通过；touched files secret scan 无命中；`npm run check:validation-readiness` 仍为 7/10 ready，剩余阻塞是本地 `SUPABASE_SERVICE_ROLE_KEY`、`RESEND_API_KEY`、`PROVIDER_API_KEY` / `DASHBOARD_302_API_KEY` 仍为占位值。
- [x] `admin-api-key-assignments.js` 已承接后台用户 302 API key assignment 列表读取、active dashboard key 过滤、provider access runtime key 解析、assign/unassign/remove assignment 和 deleted user assignment best-effort 清理；`admin-usage.service.js` 当前从 555 行降至 374 行，继续 re-export `assignApiKeyToUser` / `unassignApiKeyFromUser` / `removeApiKeyAssignments` / `getUserAssignedApiKeys` / `resolveUserProviderAccess` 兼容 `admin.routes.js` 与 `usage-admin.routes.js` 原有导入。
- [x] `admin-api-key-assignments.test.js` 覆盖 active dashboard key 过滤、assign inventory 校验 + assignment upsert + audit log 写入、empty remove no-op 和按 api name 删除；`admin-usage.service.structure.test.js` 覆盖后台服务对 `admin-api-key-assignments.js` 的结构委派，并防止 assignment 表常量、inventory 错误码和公开函数实现回流到服务编排文件。targeted `node --test backend/src/services/admin-api-key-assignments.test.js backend/src/services/admin-usage.service.structure.test.js backend/src/services/admin-usage.service.test.js` 回归 8/8 通过。
- [x] `admin-api-key-assignments.js` 拆分后全量本地检查通过：`npm run check` 中 frontend 578/578、backend 123/123、tools 7/7 通过，`npm run build` 打包 3378 modules 并在 4.73s 完成；comparable gzip 体积为 420,387 bytes，较 400,929 baseline 增加 4.8532%，距离 420,975 bytes 上限剩余 588 bytes；`git diff --check` 通过；touched files secret scan 无命中；`npm run check:validation-readiness` 仍为 7/10 ready，剩余阻塞是本地 `SUPABASE_SERVICE_ROLE_KEY`、`RESEND_API_KEY`、`PROVIDER_API_KEY` / `DASHBOARD_302_API_KEY` 仍为占位值。
- [x] `admin-user-management.js` 已承接后台用户角色更新、状态启停、软删除、自删拦截、super admin 修改保护、session revoke、service credential disable 和 admin audit log 写入；`admin-usage.service.js` 当前从 374 行降至 97 行，继续 re-export `updateUserRoles` / `updateUserStatus` / `deleteUserAccount` 兼容 `admin.routes.js` 原有导入。
- [x] `admin-user-management.test.js` 覆盖角色替换 + audit log 写入、非 super admin 修改 super admin 的 403 拦截、self-delete 在访问数据库前拒绝；`admin-usage.service.structure.test.js` 覆盖后台服务对 `admin-user-management.js` 的结构委派，并防止 role helper、super admin 错误码和用户状态/删除错误码回流到服务编排文件。targeted `node --test backend/src/services/admin-user-management.test.js backend/src/services/admin-usage.service.structure.test.js backend/src/services/admin-usage.service.test.js` 回归 9/9 通过。
- [x] `admin-user-management.js` 拆分后全量本地检查通过：`npm run check` 中 frontend 578/578、backend 127/127、tools 7/7 通过，`npm run build` 打包 3378 modules 并在 4.52s 完成；comparable gzip 体积为 420,372 bytes，较 400,929 baseline 增加 4.8495%，距离 420,975 bytes 上限剩余 603 bytes；`git diff --check` 通过；touched files secret scan 无命中；`npm run check:validation-readiness` 仍为 7/10 ready，剩余阻塞是本地 `SUPABASE_SERVICE_ROLE_KEY`、`RESEND_API_KEY`、`PROVIDER_API_KEY` / `DASHBOARD_302_API_KEY` 仍为占位值。
- [x] `admin-users-list.js` 已承接后台 admin 用户列表的数据读取和装配入口，包括 users/profiles/roles、API key assignments、usage events、service credentials、provider billing records 与 dashboard key inventory 汇总；`admin-usage.service.js` 当前从 97 行降至 12 行，只保留 `admin-usage-view.js`、`admin-users-list.js`、operation logs、metrics、API key assignments 和 user management 的兼容导出。
- [x] `admin-users-list.test.js` 覆盖用户列表视图的 profile/role、active assigned key 过滤、pending usage、dashboard key cost 和相关表查询路径；`admin-usage.service.structure.test.js` 覆盖后台服务对 `admin-users-list.js` 的结构委派，并防止 `provider_billing_records` / `user_service_credentials` 查询和错误码回流到兼容导出层。targeted `node --test backend/src/services/admin-users-list.test.js backend/src/services/admin-usage.service.structure.test.js backend/src/services/admin-usage.service.test.js` 回归 8/8 通过。
- [x] `admin-users-list.js` 拆分后全量本地检查通过：`npm run check` 中 frontend 578/578、backend 129/129、tools 7/7 通过，`npm run build` 打包 3378 modules 并在 4.60s 完成；comparable gzip 体积为 420,482 bytes，较 400,929 baseline 增加 4.8769%，距离 420,975 bytes 上限剩余 493 bytes；`git diff --check` 通过；touched files secret scan 无命中；`npm run check:validation-readiness` 仍为 7/10 ready，剩余阻塞是本地 `SUPABASE_SERVICE_ROLE_KEY`、`RESEND_API_KEY`、`PROVIDER_API_KEY` / `DASHBOARD_302_API_KEY` 仍为占位值。
- [x] Video Enhance 样式外置后全量本地检查通过：工具抽屉 targeted `node --test` 回归 11/11，`npm run check` 中 frontend 572/572、backend 99/99、tools 7/7 通过，`npm run build` 打包 3377 modules 并在 5.18s 完成；comparable gzip 体积为 420,148 bytes，较 400,929 baseline 增加 4.7936%，距离 420,975 bytes 上限剩余 827 bytes；`npm run check:validation-readiness` 仍为 7/10 ready，剩余阻塞是本地 `SUPABASE_SERVICE_ROLE_KEY`、`RESEND_API_KEY`、`PROVIDER_API_KEY` / `DASHBOARD_302_API_KEY` 仍为占位值。
- [x] Video Enhance generation runner 拆分后浏览器基础烟测已复核 `/canvas/local-1780279477000-6xtecf`：页面标题为 `Aion Craft｜Canvas`，无 Vite overlay，Workspace/Share/保存状态基础 chrome 可见，2 个 Vue Flow nodes 正常渲染；当前该 local 项目无 Video node，因此 Video Enhance 抽屉打开态仍由结构测试和 build 覆盖，未把当前画布数据改造成视频场景。
- [x] Multi Angle scoped 样式外置后全量本地检查通过：`npm run check` 中 frontend 554/554、backend 98/98 通过，`git diff --check` 通过，`npm run build` 打包 3375 modules 并在 2.86s 完成。
- [x] Multi Angle 样式外置后浏览器烟测已复核 `/canvas/local-1780188562318-p06xku`：reload 后标题为 `Aion Craft｜Canvas`，7 个 Vue Flow nodes、2 个 Image nodes、4 个 Text nodes、1 个 Video node 可见，Workspace/Share/Upload 基础 chrome 正常渲染，控制台无 warn/error，未出现 Vite overlay。
- [x] Text/Image 绑定状态 tag 布局复核：当前 4 个 Text nodes 与 2 个 Image nodes 都使用 `.binding-status-wrap`，wrap 宽度与模块 shell 同为 311px，状态胶囊均位于模块底部下方并 center 对齐；`Not linked` / `Image` 与图片模块 `Prompt` / `Reference Picture` 的 tag UI 规则一致。
- [x] Preview action 拆分后浏览器烟测已复核 `/canvas/local-1780188562318-p06xku`：reload 后 5 个 Vue Flow nodes、2 个 Text nodes、2 个 Image nodes、1 个 Video node、Workspace/Share/Tools/Create 基础 chrome 正常渲染，控制台无 warn/error。
- [x] `useImageNodePreviewState.js` 已承接图片预览 modal 的打开状态、stage 尺寸测量、图片自然尺寸、zoom clamp、zoom focus scroll、resize listener 和关闭清理。
- [x] `useImageNodePreviewState.test.js` 覆盖打开预览、stage measurement、resize listener 移除、zoom focus preservation、zoom 边界 clamp 和 image load 后重新居中；`ImageNodeStructure.test.js` 覆盖 `ImageNode.vue` 对该 composable 的结构委派。
- [x] preview state 拆分后浏览器烟测已复核 `/canvas/local-1780188562318-p06xku`：2 个 Image nodes 正常渲染，点击后 1 个 Image node 进入 selected 状态，Preview 胶囊按钮可见，控制台无 warn/error；该本地画布当前无已上传图片资产，modal 打开和 zoom 路径由 `useImageNodePreviewState.test.js` 覆盖。
- [x] `useImageNodeProgressState.js` 已承接生成进度条 timer、finish transition、error clear、stop/reset、上传进度 refs 和 upload progress style 派生状态；`ImageNode.vue` 已降至 1334 行。
- [x] `useImageNodeProgressState.test.js` 覆盖生成 loading 进度启动、finish timer 收尾、error clear、stop reset、上传进度 refs 和 style 派生；`ImageNodeStructure.test.js` 覆盖 `ImageNode.vue` 对该 composable 的结构委派。
- [x] progress state 拆分后浏览器烟测已复核 `/canvas/local-1780188562318-p06xku`：5 个 Vue Flow nodes、2 个 Image nodes 正常渲染，点击 Image node 后 selected 状态正常，Preview / Upload 控件可见，控制台无 warn/error。
- [x] `getImageDimensionsFromFile()` 已从 `ImageNode.vue` 本地函数抽到 `src/utils/imageDimensions.js`，上传尺寸读取仍发生在同一上传入口；`ImageNode.vue` 已降至 1320 行。
- [x] `imageDimensions.test.js` 覆盖尺寸比例 bucket、文件尺寸读取成功、失败 fallback 和 object URL cleanup；`ImageNodeStructure.test.js` 覆盖 ImageNode 对共享工具的结构委派。
- [x] `loadImageElementFromSource()` 已从 `ImageNode.vue` 本地裁剪 helper 抽到 `src/utils/imageElementLoader.js`，裁剪入口、canvas/data URL 输出和替换保存链路保持在原组件中；`ImageNode.vue` 已降至 1287 行。
- [x] `imageElementLoader.test.js` 覆盖远程图片 fetch/object URL、cleanup revoke、fetch 失败 cross-origin fallback、data image 直用和空 source 拒绝；`ImageNodeStructure.test.js` 覆盖 ImageNode 对共享加载工具的结构委派。
- [x] `createImageNodeCropPayload()` 已从 `ImageNode.vue` 裁剪流程抽到 `src/utils/imageCropOutput.js`，canvas 绘制、toBlob、FileReader data URL 和裁剪尺寸/比例/分辨率 payload 组装由工具承接；crop apply 的替换当前图和 UI 反馈现由 `useImageNodeToolActions.js` 编排。
- [x] `imageCropOutput.test.js` 覆盖 crop source geometry 到 replacement payload、drawImage 参数、data URL/fileName 输出和失败 cleanup；`ImageNodeStructure.test.js` 覆盖 ImageNode 不再内联 `document.createElement('canvas')` / `canvas.toBlob`。
- [x] `useImageNodePreviewDownload.js` 已承接预览下载文件名生成、fetch blob 下载、object URL cleanup 和失败后回退原始 source URL 下载。
- [x] `useImageNodePreviewDownload.test.js` 覆盖 label sanitization、扩展名保留、blob 下载清理、fetch 失败 fallback 和空 source 跳过；ImageNode 周边 `node --test` 回归 125/125 通过。
- [x] preview download 拆分后浏览器烟测已复核 `/canvas/local-1780188562318-p06xku`：5 个 Vue Flow nodes、2 个 Image nodes 正常渲染，点击空 Image node 后 selected 状态正常，Upload 入口可见，控制台无 warn/error；该本地画布当前无已上传图片资产，真实预览下载路径由 `useImageNodePreviewDownload.test.js` 覆盖。
- [x] `useImageNodeCanvasPreview.js` 已承接画布低清预览 cache state、cached preview display source、interaction skip、失败 fallback 和 stale async request 防护。
- [x] `useImageNodeCanvasPreview.test.js` 覆盖 cache hit、cache miss 生成与保存、crop 模式保留原图、生成失败 fallback 和 source 变化后的旧请求忽略；`ImageNodeStructure.test.js` 覆盖 `ImageNode.vue` 对该 composable 的结构委派。
- [x] canvas preview 拆分后浏览器烟测已复核 `/canvas/local-1780188562318-p06xku`：5 个 Vue Flow nodes、2 个 Image nodes 正常渲染，点击空 Image node 后 selected 状态正常，Upload 入口可见，控制台无 warn/error。
- [x] `useImageNodeCropInteraction.js` 已承接裁剪模式状态、初始 crop rect、drag/resize pointer listener、Esc 取消和 Enter 应用快捷键编排；Enter 应用仍通过外部回调触发，实际 crop apply 已由 `useImageNodeToolActions.js` 承接。
- [x] `useImageNodeCropInteraction.test.js` 覆盖进入裁剪、无图跳过、拖拽、resize、pointer listener cleanup、Enter apply 和 Escape cancel；`ImageNodeStructure.test.js` 覆盖 `ImageNode.vue` 对该 composable 的结构委派。
- [x] crop interaction 拆分后浏览器烟测已复核 `/canvas/local-1780188562318-p06xku`：5 个 Vue Flow nodes、2 个 Image nodes 正常渲染，点击空 Image node 后 selected 状态正常，Upload 入口可见，控制台无 warn/error；该本地画布当前无已上传图片资产，真实 crop 入口由 `useImageNodeCropInteraction.test.js` 和 `imageNodeLayout.test.js` 覆盖。
- [x] `useImageNodeModelControls.js` 已承接 ImageNode 模型选择、尺寸/比例/分辨率选择、高级参数胶囊显示、局部参数同步、nearest size 选择和参数 patch 编排；生成、上传、裁剪应用、工具保存链路仍留在 `ImageNode.vue`。
- [x] `useImageNodeModelControls.test.js` 覆盖 capsule option/display 派生、切换模型 patch、比例/分辨率 nearest size patch、外部 node data 同步和 GPT Image 2 `auto`/ratio size 语义；`ImageNodeStructure.test.js` 覆盖 `ImageNode.vue` 对该 composable 的结构委派。
- [x] `useImageNodeUploadLifecycle.js` 已承接 upload input click guard、本地 blob preview URL 替换/释放、上传中 beforeunload 保护、上传进度完成后 reset 和上传保存结果应用。
- [x] `useImageNodeUploadLifecycle.test.js` 覆盖 beforeunload listener 注册/移除、blob URL revoke、上传中禁止重复触发 input、success/error 进度 reset、active upload 不被 reset，以及 upload save outcome 的进度/消息反馈；`ImageNodeStructure.test.js` 覆盖 `ImageNode.vue` 对该 composable 的结构委派。
- [x] `useImageNodeLinkedNodes.js` 已承接右侧 linked image node 创建、edge resolve/add、selection sync、linked node update、loading update 跳过保存和最终结果 flush save；增强、抠图、多视角、Wedding 3x3 等工具仍复用原有业务入口。
- [x] `useImageNodeLinkedNodes.test.js` 覆盖创建右侧 image 节点、连边、selection 同步、source/position 缺失跳过、非 loading update 保存和 loading update 暂不保存；`ImageNodeStructure.test.js` 覆盖 `ImageNode.vue` 对该 composable 的结构委派。
- [x] `useImageNodePersistence.js` 已承接 ImageNode 的图片输出持久化、保存反馈派生和工具保存消息分发；`ImageNode.vue` 不再内联 `resolveImagePersistence` / `resolveImageSaveFeedback` / `showImageToolSaveMessage`，该切片后降至 1201 行。
- [x] `useImageNodePersistence.test.js` 覆盖持久化成功 source metadata、远端持久化失败保留 preview、空输出拒绝、保存反馈委派和空消息不分发；`ImageNodeStructure.test.js` 覆盖该 composable 的结构委派。
- [x] `useImageNodeReplacement.js` 已承接裁剪/替换当前 ImageNode 的 preview patch、本地参数同步、上传持久化、保存反馈、失败恢复和消息分发；`ImageNode.vue` 不再内联 `replaceCurrentImageNode`，当前已降至 1141 行。
- [x] `useImageNodeReplacement.test.js` 覆盖替换预览 + 上传保存、本地 preview 模式、无法转换文件 fallback、上传失败恢复 preview state；`ImageNodeStructure.test.js` 覆盖该 composable 的结构委派。
- [x] `useImageNodeGeneration.js` 已承接 ImageNode 的 create/regenerate 输入合并、生成请求、输出持久化、保存反馈、临时结果提示、错误处理和 stop reset；`ImageNode.vue` 不再内联 `runImageGeneration` / `handleStopGeneration`，该切片后降至 1076 行。
- [x] `useImageNodeGeneration.test.js` 覆盖未登录提示、缺少输入提示、self image + reference 合并、jpeg/webp compression、持久化成功保存反馈、临时输出不保存项目、生成失败错误 patch 和 stop reset；`ImageNodeStructure.test.js` 覆盖该 composable 的结构委派。
- [x] `useImageNodeToolActions.js` 已承接 ImageNode 的基础工具动作菜单分发、4K enhancement request/linked node/result persistence、remove background linked result、crop apply 和工具保存反馈；`ImageNode.vue` 不再内联 `handleToolAction` / `buildEnhancementRequest` / `handleEnhanceTo4k` / `handleRemoveBackground` / `applyCrop`，该切片后降至 949 行。
- [x] `useImageNodeToolActions.test.js` 覆盖 replace/crop/drawer menu dispatch、4K enhancement linked result、无可复用 source warning、remove background save feedback 和 crop replacement apply；ImageNode 周边 `node --test` 回归 82/82 通过。
- [x] `useImageNodeToolDrawerResults.js` 已承接 ImageNode 的 multi-angle replace/create/pending/error、Wedding 3x3 create/pending/error、linked node result/create patch、当前节点替换保存反馈和抽屉关闭状态；`ImageNode.vue` 不再内联 `handleMultiAngleApply` / `handleMultiAnglePending` / `handleMultiAngleError` / `handleWedding3x3Apply` / `handleWedding3x3Pending` / `handleWedding3x3Error`，该切片后降至 807 行。
- [x] `useImageNodeToolDrawerResults.test.js` 覆盖 multi-angle 当前节点替换、已有 pending node 完成、pending/error linked node 更新、Wedding 3x3 linked create 和 pending/error 更新；ImageNode 周边 `node --test` 回归 88/88 通过。
- [x] `useImageNodeUploadPersistence.js` 已承接 ImageNode 手动上传的文件大小校验、blob preview patch、云端上传、项目保存反馈、空 URL retry 提示、上传失败 fallback 和外层错误 patch；`ImageNode.vue` 不再内联 `handleFileUpload`，当前已降至 735 行。
- [x] `useImageNodeUploadPersistence.test.js` 覆盖超大文件校验、预览上传保存、local preview 模式、空上传结果、上传失败保存兜底和尺寸读取错误；ImageNode 周边 `node --test` 回归 110/110 通过。
- [x] upload persistence 拆分后浏览器烟测已复核 `/canvas/local-1780188562318-p06xku`：5 个 Vue Flow nodes、2 个 Image nodes、2 个 Text nodes、1 个 Video node、4 个 image upload inputs 正常渲染，控制台无 warn/error。
- [x] `src/projectStructure.test.js` 已新增 Task 8 line ceiling 结构测试，扫描 `src/components/nodes/image` 与 `src/components/nodes/video` 下非测试 `.vue/.js` 运行时模块，要求所有子模块低于 500 行，并继续要求 `ImageNode.vue` / `VideoNode.vue` 主文件低于 800 行。
- [x] `ImageConfigSizeOptions.js` 已承接 ImageConfigNode 的 provider size → ratio/resolution 推导、size meta 构建和 nearest provider-safe size 选择；`ImageConfigNode.vue` 不再内联 `BASE_SIZE_BY_RATIO` / `sizeMetaOptions` / `pickNearestSizeKey`，当前已从 814 行降至 762 行。
- [x] `ImageConfigSizeOptions.test.js` 覆盖 `auto`、常见比例、1k/2k/4k 分辨率、按 ratio/resolution 精确选择和无精确分辨率时回退到同 ratio 最小 provider-safe size；`ConfigNodeStructure.test.js` 覆盖 ImageConfigNode 对纯 helper 的结构委派。
- [x] 当前行数证据：`ImageNode.vue` 755 行，`VideoNode.vue` 773 行，`ImageConfigNode.vue` 762 行；最大 Image runtime module 为 `useImageNodeToolActions.js` 279 行，最大 Video runtime module 为 `VideoNodeCapsuleMenu.vue` 198 行。
- [x] `imagePreviewCache.js` 行为已由 `src/utils/imagePreviewCache.test.js` 与 `src/components/nodes/image/useImageNodeCanvasPreview.test.js` 联合覆盖：缓存 key/version、1280px 预览尺寸、canvas 使用低清 preview 且完整操作保留原图、交互中跳过生成、memory driver 存取、cache hit 不重新生成、cache miss 生成并保存、crop/failure fallback 和 stale async 防护均保持当前行为。
- [x] 预览缓存回归：`node --test src/utils/imagePreviewCache.test.js src/components/nodes/image/useImageNodeCanvasPreview.test.js`，11/11 通过。

**Acceptance Criteria**:
- [x] 主节点文件 < 800 行
- [x] 子组件各自 < 500 行
- [x] 预览缓存（`imagePreviewCache.js`）行为不变
- [x] 现有测试 `imagePreviewCache.test.js`、`videoPreview.test.js` 全绿
- [ ] 视觉一致性回归：画布添加图片节点 → 上传 → 预览 → 编辑 → 删除 全流程通过

---

### Task 9 — AdminUsers.vue 按 Tab 拆分

**Priority**: P1
**Effort**: 1-2 days
**Risk**: Low

**File**: `src/views/AdminUsers.vue`（284 行）

**Target Structure**:
```
src/views/
├── AdminUsers.vue                ← 已基本成为路由容器
src/components/admin/
├── AdminShell.vue / AdminSidebar.vue / AdminPageHeader.vue
└── features/
    ├── AdminDashboardSections.vue
    ├── AdminOverviewSection.vue
    ├── AdminUserServiceSection.vue
    ├── AdminServiceReconciliationSection.vue
    └── AdminAuditLogSection.vue
```

**Acceptance Criteria**:
- [x] 主文件继续收敛到 < 300 行
- [x] feature 子组件保持 < 500 行
- [x] 路由 / 权限校验逻辑保留在主文件
- [x] 各 tab 之间状态隔离（不再共享 ref）

---

**Current Progress**:
- [x] `useAdminUsersDashboardSections.js` 已承接 `AdminUsers.vue` 的 dashboard section props 聚合边界，内部继续委派到 `useAdminDashboardSectionProps`，不改变 overview / user service / reconciliation / audit props 语义。
- [x] `useAdminUsersDashboardSections.js` 已从 group state spread 改为显式依赖映射；用户列表筛选/分页/角色选择、服务对账 request/log query、审计 log query 分别绑定到各自 section props，避免不同 tab 可变状态通过共享 ref 输入混在一起。
- [x] `AdminUsers.vue` 当前已降至 284 行，仍保留 `useRoute` / `useRouter` / `useAdminAccessState` / `useAdminSectionNavigation`，路由、权限和 section 导航编排仍在路由容器内。
- [x] `AdminUsers.test.js` 覆盖 `AdminUsers.vue` < 300 行、页面级 section props 聚合委派、tab state 显式映射和 shared/feature import 边界；Admin 相关 `node --test` 回归 89/89 通过。
- [x] Admin 浏览器烟测已复核 `/admin/users` 按现有路由逻辑落到 `/admin/dashboard`：Admin shell、header 文案、概览、用量趋势、会话面板和权限降级文案正常渲染，控制台无 warn/error。

### Task 10 — canvas.js 收敛为纯 Pinia store

**Priority**: P1
**Effort**: 2-3 days
**Risk**: High（影响所有调用方）

**File**: `src/stores/canvas.js`

**Current**: `canvas.js` 已迁移为 Pinia setup store；调用方通过 `useCanvasStore(pinia)` 读取 state/action，剩余未验收项是 DevTools panel 人工可见性确认。

**Expected**:
- 删除所有模块级 `ref()` 导出
- 所有读写通过 `useCanvasStore()` 的 actions / getters
- 所有调用方更新 import

**Migration Path**:
1. 先把现有模块级函数包装为 store action，并行存在
2. 全量替换调用方
3. 删除模块级 export

**Acceptance Criteria**:
- [x] `src/stores/canvas.js` 只通过 `defineStore` 导出
- [ ] Pinia DevTools 能看到所有 nodes/edges 变更
- [x] 所有现有测试全绿
- [x] 新增 `src/stores/canvas.actions.test.js`

**Current Progress**:
- [x] `pinia@3.0.4` 已接入应用入口：`src/stores/pinia.js` 创建共享 Pinia instance，`src/main.js` 在 router 前 `app.use(pinia)`，为 DevTools / store inspection 建立真实 Pinia 边界。
- [x] `src/stores/canvas.js` 已从模块级 singleton exports 迁移为 `export const useCanvasStore = defineStore('canvas', () => { ... })`；运行时不再直接导出 `nodes` / `edges` / `groups` / `addNode` 等 state/action。
- [x] 所有 Canvas 调用方已迁移为 `useCanvasStore(pinia)`，state 通过 `storeToRefs()` 保持原 `.value` 使用语义，actions 继续复用原函数名；`rg` 验证 `@/stores/canvas` 的运行时导入只剩 `useCanvasStore`。
- [x] `src/stores/storeFacade.test.js` 新增结构断言，要求 `canvas.js` 只通过 `defineStore('canvas', ...)` 暴露 store 边界；`canvasReactivity.test.js` / `canvasSnapshots.test.js` 已同步到新 Pinia store 结构。
- [x] `src/stores/canvasActionsCore.js` 已承接 add/update/remove/duplicate node 的纯状态变更计算，`canvas.js` 通过 Pinia action 保留现有保存时机和业务语义。
- [x] `src/stores/canvas.actions.test.js` 覆盖节点创建默认值/时间戳、节点 data merge、节点删除的连边过滤、复制节点偏移/zIndex，以及 `canvas.js` 对 action core 的结构委派。
- [x] `src/stores/canvasHistoryCore.js` 已承接 history snapshot、future trim、MAX_HISTORY 滚动、undo/redo 指针计算，作为后续 T6 差分化的可测边界。
- [x] 本地验证：`npm run check` 通过，frontend 533/533、backend 96/96；`npm run build` 通过，3372 modules transformed；浏览器烟测 `/canvas/local-1780188562318-p06xku` reload 后 7 个节点正常渲染，Add Text 7→8，Undo 8→7，Redo 7→8，最终 Undo 回 7，控制台 warn/error 为空。
- [ ] 尚未打开浏览器 DevTools 的 Pinia panel 做人工核验；当前证据证明应用已安装 Pinia 且节点/边状态通过 Pinia store 驱动，但 DevTools 面板可见性仍需手动确认。

**注意**：建议在 Task 1-6 完成后再做，避免性能改动与状态重构冲突。

---

### Task 11 — Retired workflow planner surface 清理（已完成）

**Priority**: P1
**Effort**: Done in Phase 1 cleanup
**Risk**: Low

**Current State (2026-05-31)**:
- 旧 workflow planner surface 没有页面、路由、组件或 store 调用入口。
- 旧 planner component 和 hooks 已从 runtime tree 删除，并从 hooks barrel 移除导出。
- 现有 Canvas 模板入口仍通过 `src/config/workflows.js`、`src/stores/workflows.js` 和 `useNodesFactory` 保留，不属于本清理项。

**Follow-up**:
- 不要恢复旧 planner surface 来满足本任务。
- 如果未来需要自动工作流编排，应作为新功能重新立项，先定义入口、调用方、数据合约和验收路径。

**Acceptance Criteria**:
- [x] runtime source 不再引用旧 planner surface
- [x] hooks barrel 不再导出旧 planner hooks
- [x] `npm run check` 和 `npm run build` 通过

---

### Task 12 — useApi 按 domain 拆分

**Priority**: P1
**Effort**: 1-2 days
**Risk**: Low

**File**: `src/hooks/useApi.js`（679 行 baseline；2026-05-31 当前 27 行）

**Current State (2026-05-31)**:
- T12 domain slices complete at the first boundary: chat API hook moved to `src/hooks/api/useChatApi.js`, image generation/tools moved to `src/hooks/api/useImageApi.js`, video generation moved to `src/hooks/api/useVideoApi.js`, and shared loading/error/status state moved to `src/hooks/api/useApiState.js`.
- `src/hooks/useApi.js` is now a compatibility facade: it preserves legacy exports for `useChat`、`useImageGeneration`、`useImageTools`、`useVideoGeneration` and `useApiState`, plus the combined `useApi()` helper, so existing callers from `@/hooks` and `@/hooks/useApi` do not need to change in these slices.
- `src/hooks/api/imageApiCore.js` and `src/hooks/api/videoApiCore.js` own pure request/response normalization helpers, keeping `useImageApi.js` and `useVideoApi.js` under 200 lines without changing public hook behavior.
- Runtime API callers in nodes and tool drawers import `useChat`、`useImageGeneration`、`useImageTools` and `useVideoGeneration` from the domain modules directly; `src/hooks/index.js` and `src/hooks/useApi.js` keep compatibility exports for older entry points.
- `src/hooks/useApiStructure.test.js` protects the chat/image/video domain boundaries, shared state location, per-hook size ceiling, and direct domain imports; `src/hooks/apiCore.test.js` protects moved helper behavior.
- Shared HTTP concerns are now routed through `src/api/_httpClient.js`, a narrow API-layer facade over the existing `src/utils/request.js` axios instance and `src/utils/authFetch.js`. This keeps the single axios/interceptor implementation intact while preventing endpoint modules from importing HTTP helpers through the broad utils barrel.
- T12 is complete at the planned hook/API boundary. A dedicated `src/hooks/api/_httpClient.js` was intentionally not added because it would make endpoint modules depend on the hooks layer; the HTTP facade belongs in `src/api`.

**Target Structure**:
```
src/hooks/api/
├── useChatApi.js
├── useImageApi.js
├── useVideoApi.js
├── useStorageApi.js
└── useApiState.js

src/api/
└── _httpClient.js               ← API-layer facade over shared request/auth fetch utilities
```

**Acceptance Criteria**:
- [x] `useChatApi.js` < 200 行
- [x] `useImageGeneration` / `useImageTools` moved into `useImageApi.js` with existing behavior and legacy exports preserved
- [x] `useVideoGeneration` moved into `useVideoApi.js` with existing behavior and legacy exports preserved
- [x] `useApiState.js` owns shared loading/error/status state
- [x] 每个子 hook < 200 行
- [x] 共享 axios 实例集中（认证、错误重试、baseURL）
- [x] 调用方更新 import 路径

---

### Task 13 — provider.service.js 按 provider 拆分（后端）

**Priority**: P1
**Effort**: 3-4 days
**Risk**: Medium

**File**: `backend/src/services/provider.service.js`（当前 123 行，原 1761 行）

**Target Structure**:
```
backend/src/services/providers/
├── base.adapter.js               ← 统一接口定义
├── openai.adapter.js
├── seedance.adapter.js
├── dashboard302.adapter.js
├── dashboard302-video.adapter.js
├── photoroom.adapter.js
├── http-client.js                 ← provider base URL / auth / fallback 请求层
├── image-request.js               ← 图片请求路由 / prompt / ratio / resolution / 输入图归一化
├── image-response.js              ← 图片输出归一化 / prediction metadata
├── media-source.js                 ← data URL / remote image 二进制读取
├── prediction-result.js            ← 302 prediction 轮询和状态归一化
├── video-response.js                ← 视频 task/status/url/size/error 归一化
└── index.js                      ← 注册表
backend/src/services/provider.service.js   ← 仅做请求路由分发，< 300 行
```

**Adapter Interface**:
```js
class BaseProviderAdapter {
  async chatCompletion(payload, { signal }) {}
  async imageGeneration(payload, { signal }) {}
  async videoGeneration(payload, { signal }) {}
  async pollTaskStatus(taskId) {}
}
```

**Acceptance Criteria**:
- [x] 主 service 文件 < 300 行
- [x] 每个 adapter 文件 < 600 行
- [x] 现有 `provider.service.*.test.js` 全绿
- [x] 新增 `provider-adapter-contract.test.js` 验证所有 adapter 实现统一接口

**Current Progress**:
- [x] 建立 `providers/base.adapter.js`、`delegating.adapter.js`、`openai.adapter.js`、`seedance.adapter.js`、`dashboard302.adapter.js`、`dashboard302-video.adapter.js`、`photoroom.adapter.js` 和 `index.js` 注册表。
- [x] `provider-adapter-contract.test.js` 覆盖统一接口、注册表和注入式委派行为，并验证 `dashboard302-video` 与 `photoroom` 注册项。
- [x] `providers/http-client.js` 已承接 provider base URL 归一化、鉴权 header、JSON/multipart 请求、fallback path 重试与响应 metadata 挂载。
- [x] `provider-http-client.test.js` 锁定 `/v1`、`/v1beta`、相对路径和绝对 URL 覆盖的归一化行为。
- [x] `providers/image-request.js` 已承接图片请求路由、style prompt 追加、aspect ratio 推导、resolution 推导、Wavespeed/Gemini/GPT Image 2 adapter payload 构建和输入图片 fallback。
- [x] `provider-image-request.test.js` 覆盖 GPT Image 2、Gemini preview、Wavespeed 和默认直连图片请求构建语义。
- [x] `providers/image-response.js` 已承接图片输出 URL/base64 归一化和 Wavespeed prediction metadata 提取。
- [x] `provider-image-response.test.js` 覆盖 Gemini/OpenAI/Wavespeed 常见图片响应形态与 prediction metadata 包装。
- [x] `OpenAiProviderAdapter.pollTaskStatus` 已承接 GPT Image 2 async result 状态查询，`providerImageStatus` 通过 adapter registry 委派。
- [x] `providers/media-source.js` 已承接 data URL 解析、远程图片 base64 拉取、二进制图片读取和 MIME 扩展名映射。
- [x] `OpenAiProviderAdapter.imageGeneration` 已承接 GPT Image 2 `/v1/images/generations?async=true` 与 `/v1/images/edits?async=true` 创建逻辑；`providerGenerateImage` 的 `gpt-image-2` 分支改为通过 adapter registry 委派。
- [x] `OpenAiProviderAdapter.videoGeneration` 和 `pollTaskStatus` 已承接 Sora `/openai/v1/videos` 创建、`video_*` 状态查询与 completed content fallback；`providerCreateVideo` / `providerVideoStatus` 的 Sora 分支改为通过 adapter registry 委派。
- [x] `openai-adapter.test.js` 覆盖 GPT Image 2 generation/edit 创建、pending 和 completed 状态响应，以及 Sora video 创建和 content fallback 状态响应。
- [x] `providers/prediction-result.js` 已承接 302 prediction 轮询和通用状态归一化，供 Gemini 同步轮询和 Dashboard302 adapter 复用。
- [x] `providers/video-response.js` 已承接视频尺寸、任务 ID、视频 URL、状态和 Veo 供应商错误文案归一化，供后续 Veo/generic video adapter 迁移复用。
- [x] `provider-video-response.test.js` 覆盖视频 helper 的尺寸/model 映射、任务/URL/状态提取、endpoint fallback 判定和 Veo 错误文案映射。
- [x] `Dashboard302ProviderAdapter.imageGeneration` 已承接 Wavespeed provider path 图片创建；`providerGenerateImage` 的 Wavespeed 分支改为通过 adapter registry 委派。
- [x] `Dashboard302ProviderAdapter.pollTaskStatus` 已承接通用 `/ws/api/v3/predictions/{id}/result` 图片状态查询；`providerImageStatus` 的非 GPT Image 2 分支改为通过 adapter registry 委派。
- [x] `Dashboard302ProviderAdapter.imageGeneration` 已承接 Gemini image preview 的 `nano-banana-2` / `nano-banana-pro` text-to-image 和 edit endpoint 创建逻辑；`providerGenerateImage` 的 Gemini image 分支改为通过 adapter registry 委派。
- [x] `Dashboard302ProviderAdapter.videoGeneration` 和 `pollTaskStatus` 已承接 Kling O1/O3 创建与 `kling_*` / `task_*` 状态查询；`providerCreateVideo` / `providerVideoStatus` 的 Kling 分支改为通过 adapter registry 委派。
- [x] `Dashboard302ProviderAdapter.videoGeneration` 和 `pollTaskStatus` 已承接 Topaz video enhance 创建与 `topaz` 状态查询；`providerCreateVideo` / `providerVideoStatus` 的 Topaz 分支改为通过 adapter registry 委派。
- [x] `dashboard302-adapter.test.js` 覆盖 Wavespeed image task、Gemini text-to-image task、Gemini edit output、completed prediction output、Kling O1/O3 创建、Kling 状态响应、Topaz enhance 创建和 Topaz 状态响应。
- [x] `dashboard302.adapter.js` 已删除本地重复的 `extractTaskId` / `extractVideoUrl` 实现，统一复用 `providers/video-response.js` 的 shared helper；同时将 Kling / Topaz routing predicate、input image picker、status normalization 与 O1/O3 request builder 下沉到 `dashboard302-video-helpers.js`；文件从 532 行降至 349 行，Kling / Topaz / prediction 公共提取逻辑不再分叉。
- [x] `dashboard302-adapter-structure.test.js` 覆盖 Dashboard302 adapter 对 shared video response extraction helper 与 Kling / Topaz video helper 的结构委派，并防止本地 `extractTaskId`、`extractVideoUrl`、`pickFirstImageInput`、`normalizeKlingStatus`、`extractKlingStatus`、`normalizeTopazStatus`、`buildKlingO1Request`、`buildKlingO3Request` 回流；`dashboard302-video-helpers.test.js` 覆盖 helper 行为不变。targeted `node --test backend/src/services/dashboard302-video-helpers.test.js backend/src/services/dashboard302-adapter-structure.test.js backend/src/services/dashboard302-adapter.test.js backend/src/services/provider-video-response.test.js backend/src/services/provider.service.gpt-image-2.test.js` 回归 23/23 通过。
- [x] `dashboard302.adapter.js` shared helper 去重后全量本地检查通过：`npm run check` 中 frontend 584/584、backend 135/135、tools 7/7 通过，`npm run build` 打包 3379 modules 并在 4.74s 完成；comparable gzip 体积为 420,687 bytes，较 400,929 baseline 增加 4.9281%，距离 420,975 bytes 上限剩余 288 bytes；`git diff --check` 通过；touched files secret scan 无命中；`npm run check:validation-readiness` 仍为 7/10 ready，剩余阻塞是本地 `SUPABASE_SERVICE_ROLE_KEY`、`RESEND_API_KEY`、`PROVIDER_API_KEY` / `DASHBOARD_302_API_KEY` 仍为占位值。
- [x] `Dashboard302VideoProviderAdapter.videoGeneration` 和 `pollTaskStatus` 已承接 Veo 3.1 text/image-to-video 创建、302 fallback、generic `/302/v2/video/create` 创建与 Veo/generic 状态 fallback；`providerCreateVideo` / `providerVideoStatus` 的 Veo/generic 分支改为通过 adapter registry 委派。
- [x] `dashboard302-video-adapter.test.js` 覆盖 Veo text-to-video、image-to-video、404 fallback、供应商资源不可用错误映射、generic 302 创建和状态 fallback。
- [x] `SeedanceProviderAdapter.videoGeneration` 和 `pollTaskStatus` 已承接 Volcengine Seedance 2.0 创建与 `cgt-*` 状态查询；`providerCreateVideo` / `providerVideoStatus` 的 Seedance 分支改为通过 adapter registry 委派。
- [x] `seedance-adapter.test.js` 覆盖 Volcengine content payload、模型名映射、任务创建和 `content.video_url` 状态响应。
- [x] `PhotoRoomProviderAdapter.removeBackground` 已承接 `/photoroom/v1/segment` multipart 上传、背景移除响应归一化和上游鉴权错误遮罩；`providerRemoveBackground` 改为通过 adapter registry 委派。
- [x] `photoroom-adapter.test.js` 覆盖 assigned provider key、auth failure masking 和缺失图片源错误。
- [x] `provider.service.js` 已低于 300 行并收敛到 chat/image/video/status/remove-bg 分发；通用图片请求 helper 已下沉到 image domain helper。

---

### Task 14 — 补充画布核心单测

**Priority**: P2
**Effort**: 3-5 days
**Risk**: Low

**Target**: 前端测试从当前 56 个 `.test.js` 继续覆盖高风险行为路径；不再以“新增文件数”作为主要目标。

**新增测试**：

```
src/stores/
├── canvas.actions.test.js               ← addNode/removeNode/updateNode
├── canvas.history.test.js               ← undo/redo/transaction
└── canvas.persistence.test.js           ← save debounce / conflict resolution

src/components/nodes/
├── LLMConfigNode.test.js                ← 渲染 + send 交互
├── ImageConfigNode.test.js
└── TextNode.test.js

src/hooks/
├── useCanvasRouteLifecycle.test.js      ← route load / cleanup
├── useCanvasProjectUiState.test.js      ← project menu / share modal state
└── useVideoGeneration.abort.test.js     ← stop() 中断 polling wait/request
```

**测试工具**：当前用 Node 内置 `node:test`；优先沿用现有测试方式，若要引入 `@vue/test-utils` / `vitest` 必须单独评估依赖、收益和回滚方式。

**Acceptance Criteria**:
- [x] 覆盖关键路径：状态变更、撤销重做、节点交互、视频轮询取消、项目持久化
- [x] CI 全绿

**Current Progress**:
- [x] 新增 `src/stores/canvas.actions.test.js` 和 `src/stores/canvas.history.test.js`，覆盖画布核心状态变更与 undo/redo history 指针规则；`canvas.js` 对应逻辑已委派到纯 core helper，保持现有业务语义和调用入口。
- [x] 当前画布 store 周边回归：`node --test src/stores/canvas.actions.test.js src/stores/canvas.history.test.js src/stores/canvasClone.test.js src/stores/canvasSnapshots.test.js src/stores/canvasDrafts.test.js src/stores/canvasOfflineSync.test.js src/stores/canvasSync.test.js src/stores/canvasSyncStatus.test.js src/stores/canvasBroadcast.test.js src/stores/storeFacade.test.js`，29/29 通过。
- [x] 完整本地 CI 等价检查：`npm run check` 通过，frontend 520/520、backend 93/93；`npm run build` 通过，3364 modules transformed。
- [x] 浏览器烟测复核 `/canvas/local-1780188562318-p06xku`：Workspace / Share / Vue Flow / 5 个 nodes / Text / Image / Video 正常渲染，无 ErrorBoundary fallback、无 Vite overlay、浏览器 warn/error 日志为空。

---

### Task 15 — 全局 ErrorBoundary + 网络降级

**Priority**: P2
**Effort**: 1-2 days
**Risk**: Low

**Files**:
- 新增：`src/components/ui/ErrorBoundary.vue`
- 新增：`src/components/ui/NetworkBanner.vue`
- 修改：`src/App.vue`

**Acceptance Criteria**:
- [x] 任意子组件抛错时显示降级 UI 而非白屏
- [x] `online`/`offline` 事件触发顶部横幅
- [x] 离线状态下 IndexedDB drafts 仍可保存，恢复后自动同步
- [x] 新增 `ErrorBoundary.test.js`

**Current Progress**:
- [x] `src/components/ui/ErrorBoundary.vue` 已作为根稳定性边界接入 `App.vue`，包裹 `BaseToastViewport`、`NetworkBanner`、`UpdatePrompt` 和 `router-view`，子组件错误会落到 resettable fallback，避免整页白屏。
- [x] `src/components/ui/NetworkBanner.vue` 已通过 `src/components/ui/networkStatus.js` 委托监听 `online` / `offline` 事件，并在恢复在线时调用 `syncOfflineCanvasDrafts()`，触发 IndexedDB draft 恢复同步。
- [x] `src/components/ui/ErrorBoundary.test.js` 覆盖 ErrorBoundary 捕获边界、NetworkBanner 事件监听、UI barrel 导出和 `App.vue` 根接入；UI / project / style 结构回归 11/11 通过。
- [x] `src/stores/canvasOfflineSync.js` 已承接离线 draft 同步 payload 构建和单条 draft 同步；远端安全 draft 成功后标记 `remoteSynced: true`，含 blob/data URL 或未持久化远端媒体的 draft 会同步净化后的远端快照并保留本地 draft，避免把临时媒体写入云端。
- [x] `src/stores/projects.js` 已导出 `syncOfflineCanvasDrafts()` 批量入口，按当前用户的 IndexedDB draft hydrate 结果定位项目、跳过 local-only/已同步/缺远端项目的记录，并通过现有 `apiPatchProject`、revision payload、draft storage 和 broadcast 机制完成恢复同步。
- [x] `src/stores/projectsData.js` 已承接 `projects.js` 内的纯项目数据 helper：默认 canvas 数据、JSON clone/key、API row/payload 映射、持久化 upload URL 缩略图选择、activity 排序、canvas 内容判断和 base revision 解析；`projects.js` 当前从 1005 行降至 904 行，保留 auth、localStorage、IndexedDB draft、API 同步和 broadcast 编排。
- [x] `projectsData.test.js` 覆盖 API mapping、thumbnail sanitization、clone/key、summary、content/version、image-first thumbnail resolution 和 activity sort；`projectsActivity.test.js` 改为验证排序行为与 `projectsData.js` 委派。targeted `node --test src/stores/projectsData.test.js src/stores/projectsActivity.test.js src/stores/storeFacade.test.js src/stores/canvasOfflineSync.test.js` 回归 13/13 通过。
- [x] `projectsData.js` 拆分后全量本地检查通过：`npm run check` 中 frontend 584/584、backend 129/129、tools 7/7 通过，`npm run build` 打包 3379 modules 并在 4.72s 完成；comparable gzip 体积为 420,692 bytes，较 400,929 baseline 增加 4.9293%，距离 420,975 bytes 上限剩余 283 bytes；`git diff --check` 通过；touched files secret scan 无命中；`npm run check:validation-readiness` 仍为 7/10 ready，剩余阻塞是本地 `SUPABASE_SERVICE_ROLE_KEY`、`RESEND_API_KEY`、`PROVIDER_API_KEY` / `DASHBOARD_302_API_KEY` 仍为占位值。
- [x] `src/stores/canvasOfflineSync.test.js` 覆盖安全 draft 同步、临时媒体净化与本地保留、projects store 接线；`src/components/ui/networkStatus.test.js` 覆盖离线状态切换、在线恢复触发同步和卸载清理；离线同步相关 `node --test` 回归 8/8 通过。

---

## 4. 验收 / Verification

### 4.1 每 Task 验收清单

- [x] `npm run check` 全绿
- [x] `npm run build` 产物 size 增长 ≤ 5%
- [x] `npm run check:validation-readiness` 可重复检查最终验收环境是否就绪
- [ ] 手动冒烟流程：登录 → 创建项目 → 添加 5 类节点 → 连边 → 运行 workflow → 保存 → 刷新恢复
- [ ] 提交 PR 描述包含：变更摘要、影响面、测试结果、性能数据（如有）

2026-05-31 final-gate evidence:

- `vite.config.js` 已显式关闭未使用的 Vue production branches：`__VUE_OPTIONS_API__`、`__VUE_PROD_DEVTOOLS__`、`__VUE_PROD_HYDRATION_MISMATCH_DETAILS__` 均为 `false`；`src/buildConfig.test.js` 同时扫描运行时 `.vue/.js`，确认未使用 Options API component declarations。
- `UpdatePrompt.vue` 不再在根加载时静态导入 canvas/project store 链路；刷新前保存仍在 Canvas 路由点击刷新时通过 lazy `import('@/stores/canvas')` 触发。`NetworkBanner` 的离线 draft 恢复入口也由 App 侧 lazy `import('./stores/projects')` 提供，降低根组件常驻依赖耦合。
- `vite.config.js` 已改用 Vite/Terser production minify，关闭 modulepreload polyfill 与 Rollup transitive import hoist，并在 production compress 中移除 `console.debug`；`src/buildConfig.test.js` 锁定 `terser` dev dependency、Vue flags 和压缩配置，避免后续回退。
- Home 页实际导入的 15 个 Figma SVG 已用 SVGO multipass 做机械压缩；`src/views/Home.test.js` 新增 gzip budget，导入 SVG 合计从 19,067 bytes 降至 ≤13,000 bytes。
- `npm run check` 重新验证通过：frontend 584/584、backend 135/135、tools 7/7；`git diff --check` 通过。
- `npm run build` 重新验证通过：3379 modules transformed，4.74s。沿用已记录的干净 HEAD baseline，对当前 `dist` 做对比：JS/CSS/HTML/JSON/SVG gzip comparable 400,929 bytes → 420,687 bytes（+4.9281%），低于 ≤5% 上限 420,975 bytes，余量 288 bytes。当前最大 gzip chunk：Canvas 105.65KB、vendor 74.71KB、naive-vendor 60.23KB、flow-vendor 49.27KB、AdminUsers 20.88KB。
- 2026-06-01 final validation readiness：新增 `scripts/check-final-validation-readiness.mjs`、`scripts/final-validation-readiness-core.mjs`、`scripts/final-validation-readiness-core.test.mjs`、`npm run check:validation-readiness` 与 `npm run test:tools`，只读取真实 `.env` / `.env.local` 和 `backend/.env` / `backend/.env.local`，不会把 `.env.example` 当作真实配置；输出只显示 pass/fail 和缺失原因，不输出密钥值。当前机器执行结果为 7/10 ready：本地 env skeleton、前端 API base、auth mode、Supabase URL、JWT access / refresh secret 已就绪，仍缺 Supabase service role、Resend key、provider/dashboard API key，因此最终验收环境未就绪。
- 2026-06-01 env handoff 补充：新增 `docs/FINAL_VALIDATION_ENV.md`，明确真实 `.env.local` / `backend/.env.local` 的本机创建位置、必填 Supabase / JWT / Resend / provider / dashboard key、readiness 命令和 10/10 ready 后的最终验收范围；`.gitignore` 补充忽略 `.env` / `.env.*` / `backend/.env` / `backend/.env.*`，防止真实密钥误提交。
- 2026-06-01 Supabase connector evidence：新增 `docs/SUPABASE_VALIDATION_EVIDENCE.md`，记录非敏感项目证据。当前账号下 `Ling's Visuals Canvas`（ref `rzfsyezidhgyikehucrh`）为 `ACTIVE_HEALTHY`，URL `https://rzfsyezidhgyikehucrh.supabase.co`，public schema 中 `projects` / `workflow_runs` / `usage_events` / `audit_logs` 等表存在且 RLS 均开启；security advisor 无 lint。performance advisor 仅返回 unused-index 信息，先记录为后续优化参考，不在最终验收前删除索引。
- 2026-06-01 Vercel env handoff：Vercel 文档确认 Environment Variables 可通过 Dashboard / `vercel env add --sensitive` 管理，`vercel env pull` 可写入本地 ignored env 文件。当前仓库没有 `.vercel/project.json`，Vercel team list 为空且项目列表读取失败；用户提供后端 Vercel 项目名 `eagercanvas-api`，但当前连接器缺少 teamId 且本机未安装 Vercel CLI，尚无法直接确认项目 env 是否存在。`docs/FINAL_VALIDATION_ENV.md` 已补充 `cd backend && vercel link --project eagercanvas-api && vercel env pull .env.local --environment=development --yes` 的安全拉取路径。
- 2026-06-01 backend env loader：新增 `backend/src/config/load-env-files.js` 和 `backend/src/config/load-env-files.test.js`，让后端显式按 shell/Vercel env → `backend/.env.local` → `backend/.env` 优先级读取配置，避免 Vercel pull 到 `backend/.env.local` 后 dev server 实际不加载的问题；测试先红后绿覆盖加载顺序。
- 2026-06-01 validation env skeleton：新增 `npm run prepare:validation-env` 与 `scripts/write-final-validation-env-template.mjs`，生成被 gitignore 覆盖的 `.env.local` / `backend/.env.local` 骨架，只写入非敏感默认值和占位符；`npm run test:tools` 新增 4/4 覆盖模板不包含真实 key 格式。运行后 readiness 从 1/10 推进到 5/10。
- 2026-06-01 local JWT secret generation：新增 `npm run generate:validation-jwt-secrets` 与 `scripts/generate-validation-jwt-secrets.mjs`，只替换 ignored `backend/.env.local` 中的 JWT access / refresh 占位符，使用 `crypto.randomBytes(48).toString('base64url')` 生成 64 字符随机值且不打印 secret；`npm run test:tools` 5/5 覆盖仅替换 JWT 字段。运行后 readiness 从 5/10 推进到 7/10。
- 2026-06-01 final validation runbook：新增 `npm run show:final-validation-runbook` 与 `scripts/show-final-validation-runbook.mjs`，按当前 readiness 输出阻断项、后端/前端启动命令、auth、云端 project persistence、provider workflow、usage ledger、UI 回归和最终门禁步骤；输出不打印 env 值。`npm run test:tools` 7/7 覆盖未 ready 阻断项和 10/10 ready 步骤清单。
- 局部浏览器冒烟已覆盖当前本地画布 `/canvas/local-1780188562318-p06xku`：新增临时 Text 节点 7→8，Undo 8→7，Redo 7→8；随后删除临时节点并 reload，恢复为 7 个 nodes、4 个 Text、2 个 Image、1 个 Video，Workspace/Share/Saved locally 可见，控制台无 warn/error，无 Vite overlay。该证据不覆盖登录、创建新项目、5 类节点、真实 workflow 运行，因此完整手动冒烟仍未勾选。
- Terser/SVGO/lazy boundary 后浏览器烟测复核同一画布：reload 后标题 `Aion Craft｜Canvas`、7 个 Vue Flow nodes、4 个 Text、2 个 Image、1 个 Video、Workspace/Share/Saved locally 正常，控制台 warn/error 为空，无 Vite overlay。浏览器截图接口两次超时，因此此条仅采用 DOM/console 证据。
- Workspace 本地预览阻断已修复：`Workspace.vue` 在 `VITE_BYPASS_AUTH=true` 且 8787 后端缺席时，原先会因 `loadCurrentWorkspace()` / `loadFeaturedTemplates()` API 失败进入 ErrorBoundary fallback（`页面暂时无法显示` / `Request failed with status code 500`）。现已通过 `loadWorkspaceSurfaces()` 将 workspace/template 云端 surface 改为 fail-soft，本地 projects 区域仍可访问；`src/views/Workspace.test.js` 新增结构测试锁定该边界。
- 本地预览模式补充冒烟：从 `/workspace` 点击 `New Project` 创建本地项目 `/canvas/local-1780224342181-y9t00c`，添加 Text / Image / Video 三类基础节点，等待本地保存后 reload；刷新后恢复 3 个 Vue Flow nodes（1 Text、1 Image、1 Video），`Saved locally` 可见，控制台 warn/error 为空，无 ErrorBoundary fallback。该证据仍不覆盖真实登录、云端创建项目、连边、真实 provider workflow 运行。
- 2026-06-01 Text binding status tag 复核：在 `VITE_BYPASS_AUTH=true` 本地预览画布新增并选中 Text 节点，`Not linked / Image` 状态行使用共享 `.binding-status-wrap`，位于 Text 模块底部下方 8px，宽度与模块一致（差值 0px），`position: static`；本次 reload/add/select 后新增浏览器 warn/error 日志为空。为保持本地阶段验收日志干净，`useCanvasRouteLifecycle` 在 local preview 模式下跳过 blank media recovery 后端请求，云端项目链路保持原恢复逻辑。
- 2026-06-01 Usage 本地预览降级复核：`/usage` 在 `VITE_BYPASS_AUTH=true` 且后端缺席时不再发起 usage summary/timeseries 请求，保留默认 0 数据和空趋势；页面无 ErrorBoundary fallback、无 `Request failed` toast，本次 reload 后新增浏览器 warn/error 日志为空。真实模式仍按原路径加载 usage API 并保留错误提示。
- 2026-06-01 主要页面本地访问矩阵：`/`、`/workspace`、`/canvas/local-1780188562318-p06xku`、`/usage`、`/usage-admin`、`/admin/dashboard` 均可在 `VITE_BYPASS_AUTH=true` 且后端缺席时访问；6 个路由均无 ErrorBoundary fallback、无 Vite overlay、新增浏览器 warn/error 日志为空。`/admin/dashboard` 在 local preview 下保留管理端壳层和权限降级内容，不再因 admin session 缺席跳回首页；真实模式仍保持 session denied 后 `router.replace('/')`。
- 2026-06-01 local version manifest 降噪：本地 dev server 缺少 `/version.json` 时不再记录 `App version check skipped: Failed to fetch` warn，避免预期内 manifest 缺失污染浏览器验收日志；production 仍保留版本检查失败 warn。`src/utils/appVersion.test.js` 先红后绿覆盖该行为。
- 2026-06-01 本地手工回归补充：从 `/workspace` 通过 `New Project` 新建 `/canvas/local-1780277092199-7lzhq4`，用画布空白区右键创建路径分别放置 Text / Image / Video 三类基础模块；Undo 将节点数 3→2，Redo 恢复 2→3；选中 Image 节点后点击可见 `Duplicate` 动作，节点数 3→4、Image 数 1→2；等待 `Offline saved` 后 reload，刷新恢复为 4 个 nodes（1 Text、2 Image、1 Video），`Saved locally` 可见，无 ErrorBoundary fallback、无 Vite overlay。该证据仍不覆盖真实连边、真实 workflow 运行和云端保存。
- 2026-06-01 路由健康矩阵复跑：在 `VITE_BYPASS_AUTH=true` 本地 server 上依次访问 `/`、`/workspace`、`/canvas/local-1780277092199-7lzhq4`、`/usage`、`/usage-admin`、`/admin/dashboard`，6 个路由均渲染非空内容、无 ErrorBoundary fallback、无 Vite overlay，且本轮开始时间 `2026-06-01T01:28:32.477Z` 之后浏览器 warn/error 日志为空。`/admin/dashboard` 渲染为中文管理控制台权限降级内容。
- 2026-06-01 连边交互补充复核：同一 `/canvas/local-1780277092199-7lzhq4` 本地项目中，选中 source 节点使 handle 可交互后完成 Text → Image 拖拽连接，生成 `promptOrder` edge；随后完成 Image → Video 拖拽连接，生成 `imageRole` edge。最终状态为 4 nodes / 2 edges，Text 状态显示 `Linked to 1 module`，本轮连接尝试新增浏览器 warn/error 日志为空。上一轮失败原因定位为自动化拖拽未经过目标节点 hover 路径，目标 handle 仍为 `opacity: 0; pointer-events: none`，不是当前连接代码回归。
- 2026-06-01 多端 broadcast 补充复核：打开两个浏览器标签页到同一新建本地项目 `/canvas/local-1780278514056-y2y48e`，A/B 初始均为 1 Text node。B 标签页新增 Image 后进入 `Unsaved`，随后 A 标签页编辑 Text 并 blur 保存；最终 A/B 均显示 2 nodes（1 Text、1 Image）且 Text 内容同步为 `broadcast-a-1780278556758`，两个标签页均无 ErrorBoundary fallback，本轮 broadcast 操作新增浏览器 warn/error 日志为空。
- 2026-06-01 Video 路由切换补充复核：在含 Video 节点的 `/canvas/local-1780277092199-7lzhq4` 中记录 4 nodes / 2 edges / 1 Video，切到 `/workspace` 等待约 2.2s 后再返回同一 canvas，仍恢复为 4 nodes / 2 edges / 1 Video，Video 文案 `Connect Text/Image node to generate` 可见，无 ErrorBoundary fallback、无 Vite overlay，本轮切换新增浏览器 warn/error 日志为空。浏览器沙箱无法读取 `performance.getEntriesByType('resource')`，因此该条是可见状态 + 控制台健康证据；轮询 abort 仍由 `useVideoGenerationCore.test.js` 的单元测试覆盖。
- 2026-06-01 NetworkBanner 离线恢复结构复核：新增 `networkStatus.js` 将在线/离线监听从 Vue 组件内抽出，`networkStatus.test.js` 证明初始离线状态会反映到 `isOnline`、`offline` 事件只切换本地状态、`online` 事件触发一次 `syncOfflineDrafts()`、卸载后不再响应事件；配合 `canvasOfflineSync.test.js`，离线同步相关 `node --test src/components/ui/networkStatus.test.js src/components/ui/ErrorBoundary.test.js src/stores/canvasOfflineSync.test.js` 8/8 通过。本地浏览器复核 `/canvas/local-1780279477000-6xtecf`：reload 后页面有 Workspace/Text/Saved locally，NetworkBanner 默认不显示，无 Vite overlay，本轮新增 warn/error 为空。当前 Browser 能验证页面健康，但不能控制真实网络离线，因此仍不把 §4.3 的“人工断网 30s 后恢复”标为完整通过。

### 4.2 阶段性性能基线

每完成 Stage（T1-6 / T7-9 / T10-13 / T14-15）后录制：

```
场景 1: 200 节点画布拖拽 5 秒
  - FPS：min / avg / p95
  - Long Tasks 数量
  - 主线程阻塞总时长

场景 2: 撤销 50 次连续操作
  - 总耗时
  - 单次最大耗时

场景 3: 长聊天回答（500 token）
  - 首字延迟（TTFB）
  - 总完成时间
```

2026-06-01 local browser baseline:

| 场景 | 节点/边 | 采样方式 | 结果 |
|------|---------|----------|------|
| 200 节点拖拽 | 200 Text nodes / 0 edges | 本地浏览器 rAF + PerformanceObserver，12s 采样，真实 UI 创建节点后拖拽 | avg FPS 60.0，p95 FPS 59.2，p95 frame 16.9ms，max frame 17.6ms，>50ms frames 0，long tasks 0 |

### 4.3 回归用例

每次发版前执行：

1. 创建空白项目
2. 添加文本节点 + LLM 配置节点 + 图像配置节点 + 图像输出节点 + 视频配置节点
3. 连边构成工作流
4. 运行工作流验证流式输出
5. Ctrl+Z 撤销 5 步、Ctrl+Y 重做 3 步
6. 复制粘贴 3 个节点
7. 多端打开同一项目验证 broadcast 同步
8. 离线断网 30s 后恢复，验证 drafts 自动同步
9. 切换路由再回来，验证视频任务无泄漏请求

### 4.4 当前阶段验收判断（2026-06-01）

**可以阶段验收**

| 范围 | 当前结论 | 证据 |
|------|----------|------|
| 结构审计与分阶段计划 | 可验收 | §1.4 问题清单、§3.0 Phase 计划已按当前 worktree 更新 |
| 前端/Canvas/UI 结构拆分 | 可验收 | `Canvas.vue`、`ImageNode.vue`、`VideoNode.vue` 主文件均低于目标线；结构测试覆盖 canvas / nodes / tools / workspace / admin / usage |
| 本地预览基础路径 | 可验收 | `/`、`/workspace`、`/canvas`、`/usage`、`/usage-admin`、`/admin/dashboard` 在 `VITE_BYPASS_AUTH=true` 且后端缺席时有降级证据；无 ErrorBoundary fallback |
| Text/Image tag UI 一致性 | 可验收 | Text `Not linked / Image` 使用共享 `.binding-status-wrap`，与 Image tag 宽度和下方布局规则一致 |
| 本地手工编辑回归子集 | 可验收 | Workspace 新建本地项目、空白区放置 Text/Image/Video、Text→Image 和 Image→Video 连边、Undo/Redo、Image duplicate、reload 恢复、多端 broadcast、Video 路由切换均有浏览器证据；新增 warn/error 为空 |
| 200 节点性能基线 | 可验收 | 200 Text nodes 拖拽采样 avg FPS 60.0、p95 FPS 59.2、long tasks 0、控制台 warn/error 为空 |
| 工程门禁 | 可验收 | `npm run check`、`npm run build` 已通过；size gate 低于 +5% |
| 最终验收 readiness 检查 | 可验收 | `npm run check:validation-readiness` 已能稳定输出真实环境缺口；当前 7/10 ready，因此它是阻断证据而不是最终通过证据 |

**不能最终验收**

| 范围 | 缺口 | 需要的环境/证据 |
|------|------|----------------|
| 真实登录与 auth | 本地 bypass 不等于真实登录链路 | 后端 `.env`、Supabase Auth、邮件/验证码或等价登录凭证 |
| 云端项目持久化 | local preview 只证明本地草稿和 IndexedDB 路径 | 可用 API 后端、数据库、远端 project create/update/read 证据 |
| 真实 workflow 运行 | 本地未执行 provider 生成链路 | provider credentials、run 创建/完成、usage event 写入证据 |
| 最终验收环境 | `npm run check:validation-readiness` 当前仅 7/10 ready | 替换 `backend/.env.local` 中的 Supabase service role、Resend、provider/dashboard key 占位符 |
| 完整 §4.3 手工回归 | 本地已覆盖新建项目、三类基础模块、Text→Image 和 Image→Video 连边、Undo/Redo、单节点 duplicate、reload 恢复、多端 broadcast、Video 路由切换可见健康；在线恢复触发 draft sync 已有单元覆盖；真实流式输出、真实人工断网 30s 恢复、真实视频任务泄漏仍未完整跑通 | 真实/等价环境执行 9 项回归，记录每项 pass/fail 与截图/日志 |
| Pinia DevTools | 代码已迁移 Pinia，但未人工打开 DevTools 面板 | 浏览器 DevTools Pinia panel 中 nodes/edges 变更可见性截图或人工记录 |
| 发布判断 | 真实链路与性能缺口未闭合 | 完整 §4.3 9 项回归和生产等价环境验证 |

---

## 5. 风险与应对 / Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| shallowRef 改动后 VueFlow 不响应 | High | 先在 spike 分支验证 200 节点场景；保留 triggerRef 兜底 |
| 历史栈差分化引入 undo bug | High | T6 必须配 ≥ 20 个测试用例；分阶段灰度 |
| SSE 后端改动影响生产稳定 | Medium | 保留旧 endpoint 作为 fallback；用 query 参数控制 |
| 大组件拆分破坏视觉/交互 | Medium | 每次拆分配视觉对比 screenshot |
| 后端 provider 拆分引入回归 | Medium | adapter 契约测试 + 灰度发布 |

---

## 6. 排期建议 / Timeline

| 周 | 任务 |
|----|------|
| W1 | T1, T2, T3, T4 |
| W2 | T5, T6 |
| W3-4 | T7 |
| W5 | T8 (Image) |
| W6 | T8 (Video), T9 |
| W7 | T10 |
| W8 | T12（T11 已在 Phase 1 清理完成） |
| W9-10 | T13 |
| W11-12 | T14, T15 |

总周期：约 12 周（按 1 名工程师全职估算）。

---

## 7. AI Agent 执行指引 / Instructions for AI Coding Agents

> Codex / Claude Code 等 AI agent 执行本 PRD 时，请遵循：

1. **逐 Task 执行**，禁止合并多个 Task 到一个 PR
2. **先读后改**：开始 Task 前读完该文件相关行号上下文
3. **Task 完成顺序**：原则上按编号；如发现依赖问题，停下来询问用户
4. **每 Task 结束**：
   - 运行 `npm run check`
   - 运行 `npm run build`
   - 总结变更摘要、影响面、性能数据（如有）
5. **遇到不确定**：不要猜测。把疑问明确列出来询问用户
6. **拒绝以下行为**：
   - 修改 `.pen` 文件
   - 新增 `console.log`
   - 引入未授权依赖
   - 跳过 lint / test
   - 一次性重写大文件而非渐进重构
7. **Commit message 规范**：
   - `perf(canvas): replace JSON clone with structuredClone (Task 1)`
   - `refactor(canvas): split Canvas.vue into subcomponents (Task 7)`
   - `test(video): cover generation polling cancellation (Task 14)`

---

## 8. 关键文件索引 / Key Files

执行任何 Task 前，先熟悉：

| 文件 | 行数 | 作用 |
|------|------|------|
| `src/stores/canvas.js` | 1083 | 画布核心状态、保存、历史栈 |
| `src/views/Canvas.vue` | 733 | 主画布视图入口 |
| `src/components/nodes/ImageNode.vue` | 735 | 图像节点（含预览/特效） |
| `src/components/nodes/VideoNode.vue` | 768 | 视频节点 |
| `src/views/AdminUsers.vue` | 284 | 管理员后台路由容器 |
| `src/hooks/useApi.js` | 27 | API 兼容导出 facade |
| `src/api/chat.js` | - | 聊天接口 |
| `src/api/video.js` | 26 | 视频接口（create/status；runtime polling 在 `src/hooks/api/useVideoApi.js`） |
| `backend/src/services/provider.service.js` | 123 | 后端 AI provider 路由分发 |
| `scripts/check-maintenance.mjs` | - | 工程纪律检查规则 |
| `eslint.config.js` | - | ESLint flat config |

---

## 9. 验收 sign-off

所有 Task 完成后，触发完整验收：

```bash
# 1. 完整 check
npm run check

# 2. 构建
npm run build

# 3. 性能 baseline 对比
# （手动用 Chrome DevTools Performance 录制 200 节点拖拽 5s）

# 4. 回归用例（手动 9 项）
# 见 §4.3
```

通过后合并 main，打 tag `v-perf-2026-Q2`（或对应版本号）。

---

## 10. PR 描述草稿 / Pull Request Draft

### Summary

- 重构前端、Canvas、Workspace、Usage/Admin 等模块结构，沉淀 shared UI、feature 组件、hooks、utils 和 store core helpers，降低大组件与隐式耦合。
- 清理已确认无入口的旧资源和样板文件，补充工程结构测试与维护检查，避免无效代码回流。
- 修复本地预览模式下 Workspace 云端 surface 失败导致整页 fallback 的问题，保持本地 projects 工作流可访问。
- 优化生产构建体积：关闭未使用 Vue production branches，启用 Terser size minify，移除 production `console.debug`，压缩 Home Figma SVG，并将根组件中的 canvas/project store 入口改为 lazy boundary。

### Impact

- 业务流程、API 合约、权限边界和数据持久化模型保持不变。
- 本地预览模式下 Workspace 在后端缺席时降级为仅展示本地项目和空模板区，不再阻断本地项目创建/打开。
- Production build 时间从约 2.8s 增至约 5.05s，换取 gzip comparable 体积从 +11% 降至 +5% 内。

### Verification

- `npm run check`：frontend 584/584、backend 135/135、tools 7/7 通过。
- `npm run build`：3379 modules transformed，4.74s，通过。
- `npm run check:validation-readiness`：当前 7/10 ready，真实验收环境仍缺 Supabase service role、Resend、provider/dashboard keys。
- `git diff --check`：通过。
- Browser smoke：`/canvas/local-1780188562318-p06xku` 渲染 7 nodes；本地新建项目 `/canvas/local-1780224342181-y9t00c` 渲染并刷新恢复 3 nodes；`/usage` 在 local preview 后端缺席时显示默认 0 数据且无错误 toast；控制台 warn/error 为空。

### Performance / Size

- Baseline comparable gzip：400,929 bytes。
- Current comparable gzip：420,687 bytes。
- Delta：+19,758 bytes / +4.9281%，低于 +5% 上限 420,975 bytes，余量 288 bytes。

### Remaining Risk

- 完整真实链路仍需替换 `backend/.env.local` 中的 Supabase service role、Resend、provider credentials 占位符后复测：登录、云端创建项目、连边、真实 workflow 运行、云端保存和刷新恢复；当前 readiness 命令显示 7/10 ready。
