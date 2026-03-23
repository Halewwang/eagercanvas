# Ling's Visuals Canvas

一个基于 Vue Flow 的可视化 AI 创作画布，支持文生图、视频生成等 AI 工作流的节点式编排。
[体验地址](https://marketing.chatfire.site/eager/)

![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)
![Vite](https://img.shields.io/badge/Vite-5.2-646CFF?logo=vite)
![License](https://img.shields.io/badge/License-MIT-blue)

## 📸 截图

## ✨ 特性

- 🎨 **可视化节点编排** - 基于 Vue Flow 的无限画布，支持拖拽、缩放、连接
- 🖼️ **文生图工作流** - 支持配置提示词、模型、尺寸等参数生成图片
- 🎬 **视频生成工作流** - 支持图生视频，可设置首帧/尾帧图片
- 🤖 **AI 提示词润色** - 一键 AI 优化提示词，提升生成质量
- 🌓 **深色/浅色主题** - 支持主题切换，保护眼睛
- 💾 **本地项目存储** - 项目数据本地持久化，支持多项目管理
- ↩️ **撤销/重做** - 完整的操作历史记录

## 开发与基线压测

- 启动前端：`npm run dev`
- 启动后端：`npm run dev:api`
- 启动独立 worker：`npm --prefix backend run worker`
- 基线压测：`npm run perf:baseline`
- 场景压测示例：`PERF_SCENARIO_FILE=scripts/perf-scenarios/health.json npm run perf:baseline`
- 报告落盘：`PERF_SCENARIO_NAME=health npm run perf:report`

队列与缓存运行模式：

- `CACHE_BACKEND=redis`：共享缓存走 Redis
- `RATE_LIMIT_STORE=redis`：限流走 Redis
- `RUN_QUEUE_MODE=worker`：图片/视频任务由独立 worker 消费
- `RUN_QUEUE_MODE=redis`：API 进程内执行，但使用 Redis 共享并发槽位
- `RUN_QUEUE_MODE=inline`：默认模式，保持最强兼容

当前兼容策略：

- 聊天仍保持同步
- 图片已改成“请求层透明轮询”的兼容式异步
- 视频已支持独立 worker 模式，前端仍保持原有轮询交互

常用环境变量：

- `PERF_BASE_URL`：默认 `http://localhost:8787/api/v1`
- `PERF_PATHS`：逗号分隔路径，默认 `/health`
- `PERF_CONCURRENCY`：并发数，默认 `10`
- `PERF_REQUESTS`：总请求数，默认 `100`
- `PERF_METHOD`：请求方法，默认 `GET`
- `PERF_BEARER_TOKEN`：需要登录接口时传入 Bearer Token
- `PERF_BODY`：JSON 字符串，请求体
- `PERF_SCENARIO_FILE`：场景文件路径，支持每类请求单独定义 method/path/body
- `PERF_SCENARIO_NAME`：场景名，配合 `npm run perf:report` 使用
- `PERF_OUTPUT_FILE`：压测结果输出文件
- `PERF_REPORTS_DIR`：报告目录，默认 `perf-reports`
- 场景文件支持 `${ENV_VAR}` 占位符，例如 `${PERF_PROJECT_ID}`

常用业务场景变量：

- `PERF_BASE_URL`：例如 `http://localhost:8787/api/v1`
- `PERF_BEARER_TOKEN`：真实登录后的 access token
- `PERF_PROJECT_ID`：真实项目 ID
- `PERF_PROJECT_UPDATED_AT`：项目当前 `updatedAt`，用于保存冲突压测
- `PERF_IMAGE_MODEL`：真实图片模型名

请求观测相关环境变量：

- `REQUEST_LOG_ENABLED`：默认 `true`
- `REQUEST_LOG_SLOW_MS`：慢请求阈值，默认 `800`

场景文件示例：

- [health.json](/Users/adler/Documents/New%20project%202/scripts/perf-scenarios/health.json)
- [auth-me.example.json](/Users/adler/Documents/New%20project%202/scripts/perf-scenarios/auth-me.example.json)
- [projects-read.example.json](/Users/adler/Documents/New%20project%202/scripts/perf-scenarios/projects-read.example.json)
- [project-save.example.json](/Users/adler/Documents/New%20project%202/scripts/perf-scenarios/project-save.example.json)
- [generate-image.example.json](/Users/adler/Documents/New%20project%202/scripts/perf-scenarios/generate-image.example.json)

运行手册与记录模板：

- [perf-runbook.md](/Users/adler/Documents/New%20project%202/doc/perf-runbook.md)
- [perf-baseline-template.md](/Users/adler/Documents/New%20project%202/doc/perf-baseline-template.md)
- [worker-cutover-checklist.md](/Users/adler/Documents/New%20project%202/doc/worker-cutover-checklist.md)
- [prelaunch-stability-checklist.md](/Users/adler/Documents/New%20project%202/doc/prelaunch-stability-checklist.md)

## 📦 节点类型

| 节点 | 描述 |
|------|------|
| **文本节点** | 输入/编辑提示词文本 |
| **文生图配置** | 配置图片生成参数（模型、尺寸、数量等） |
| **图片节点** | 展示生成的图片或上传本地图片 |
| **视频生成配置** | 配置视频生成参数（支持首帧/尾帧图片） |
| **视频节点** | 展示生成的视频 |



## 📄 License

[MIT](./LICENSE)
