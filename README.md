# Eager Canvas

Eager Canvas 是一个面向 AI 图像与视频内容生产的可视化工作台。项目提供无限画布、节点编排、项目管理、共享模板、用量统计，以及两套后台能力，前后端代码都已包含在这个仓库里。

## 当前功能

| 模块 | 当前能力 |
| --- | --- |
| 可视化画布 | 基于 Vue Flow 的无限画布，支持拖拽、缩放、连线、撤销重做、节点分组、缩略导航 |
| 节点类型 | Text、Image、Video 三类主节点，支持提示词输入、图片预览、视频结果 |
| 图像能力 | 文生图、图生图、图片上传、远程素材入库、图片去背 |
| 视频能力 | 图像驱动视频生成，支持轮询任务状态并回填结果 |
| 工作流模板 | 内置多角度分镜、电商产品全套图等模板，可一键加入画布 |
| 项目管理 | 首页最近项目、重命名、复制、删除、封面自动更新、项目链接复制 |
| 工作区 | Shared Workspace、Featured Templates、发布项目为模板、复制共享模板为自己的项目 |
| 账户系统 | 邮箱验证码登录、注册、刷新登录态、个人资料与头像更新 |
| 用量统计 | 个人调用量、tokens、图片产出、费用汇总与日趋势 |
| 管理后台 | 角色权限、用户状态管理、API Key 分配、全局用量、302 余额与记录、操作审计 |
| 独立运营后台 | `/usage-admin` 独立账号登录，管理 302 Key、用户分配与消耗查看 |

## 当前支持的模型

| 类型 | 当前配置 |
| --- | --- |
| 图片 | Gemini 3.1 Flash Image Preview、Gemini 3 Pro Image Preview |
| 视频 | Kling O1、Google Veo 3.1 |
| 对话/提示词 | Gemini 2.5 Flash、Gemini 2.5 Flash Lite |

## 页面一览

| 路径 | 说明 |
| --- | --- |
| `/` | 首页、最近项目、登录注册入口 |
| `/canvas/:id?` | 主画布，执行节点工作流、分享、模板发布 |
| `/workspace` | 工作区与共享模板库 |
| `/usage` | 当前用户用量面板 |
| `/admin/*` | 基于角色权限的管理后台 |
| `/usage-admin` | 独立运营后台 |

## 仓库结构

| 目录 | 说明 |
| --- | --- |
| `src/` | 前端应用，包含首页、画布、工作区、统计页、管理页 |
| `backend/` | Express API，负责登录、项目、运行记录、用量、后台管理、上传 |
| `supabase/` | 数据库初始化与增量 SQL |
| `doc/` | 当前界面截图与文档素材 |
| `README.docker.md` | 纯前端 Docker 部署说明 |

## 本地启动

### 1. 安装依赖

```bash
npm install
npm --prefix backend install
```

### 2. 配置前端环境变量

在根目录创建 `.env`，最简配置如下：

```bash
VITE_APP_API_BASE_URL=/api/v1
```

开发时使用 Vite 代理即可，不需要把前端直接指到后端完整地址。

### 3. 配置后端环境变量

在 `backend/` 目录创建 `.env`。可以直接参考 `backend/import.env`，最少要补齐这些值：

| 变量 | 用途 |
| --- | --- |
| `FRONTEND_ORIGIN` | 前端访问域名，支持本地或正式域名 |
| `SUPABASE_URL` | Supabase 项目地址 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key |
| `JWT_ACCESS_SECRET` | Access Token 密钥 |
| `JWT_REFRESH_SECRET` | Refresh Token 密钥 |
| `RESEND_API_KEY` | 邮箱验证码发送服务 |
| `RESEND_FROM_EMAIL` | 验证码发件地址 |
| `PROVIDER_API_KEY` | AI 生成服务调用密钥 |
| `PROVIDER_API_BASE_URL` | AI 生成服务地址 |
| `PROVIDER_API_BASE_URLS` | 备用 AI 服务地址列表，可逗号分隔 |
| `DASHBOARD_302_API_KEY` | 302 后台查询 Key，用于余额、记录、对账数据 |
| `ADMIN_DASHBOARD_USERNAME` | `/usage-admin` 后台账号 |
| `ADMIN_DASHBOARD_PASSWORD` | `/usage-admin` 后台密码 |
| `ADMIN_DASHBOARD_JWT_SECRET` | `/usage-admin` 登录签名密钥 |

### 4. 初始化数据库

把 `supabase/` 目录下现有 SQL 按文件名顺序执行：

```text
001_init.sql
002_auth_registration.sql
003_usage_admin_key_assignments.sql
004_rbac_admin_system.sql
005_user_account_status.sql
006_usage_billing_reconciliation.sql
009_workspace_shared_templates.sql
```

这些脚本会创建：

- 用户、验证码、会话、项目、运行记录、用量事件
- 用户资料、账号状态、角色权限、后台操作日志
- API Key 分配关系
- Shared Workspace 与共享模板表

### 5. 启动后端

```bash
npm --prefix backend run dev
```

默认端口是 `8787`。

### 6. 启动前端

```bash
npm run dev
```

默认地址是 `http://localhost:5173`。

## 本地预览与完整联调的区别

- 只想快速看界面时，直接启动前端即可。
- 前端在本地 `localhost` 环境下会进入预览模式，登录态和项目会走本地临时数据。
- 图像生成、视频生成、共享模板、用量统计、后台管理、真实账号体系都依赖后端与 Supabase。

## 运行脚本

### 前端

```bash
npm run dev
npm run build
npm run preview
```

### 后端

```bash
npm --prefix backend run dev
npm --prefix backend start
```

## 部署说明

- 前端根目录包含 `vercel.json`
- 后端目录 `backend/` 也包含独立的 `vercel.json`
- 如果只需要静态前端容器部署，可参考 [README.docker.md](./README.docker.md)

## 补充说明

- 上传资源会写入 Supabase Storage 的 `uploads` bucket，服务端会自动尝试创建这个 bucket。
- 远程素材抓取只允许公开 `http/https` 地址，不允许内网地址或 `localhost`。
- 管理后台采用权限控制，是否显示用户管理、API Key 管理、审计与全局用量，取决于数据库里分配的角色。
