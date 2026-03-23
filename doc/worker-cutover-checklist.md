# Worker 切换清单

这份清单用于把当前项目从默认兼容模式切换到 `Redis + 独立 worker` 模式，目标是在不打断前端业务的前提下，让图片和视频任务从 API 进程中剥离出去。

## 1. 切换前确认

- 确认当前后端版本已经包含：
  - Redis 共享缓存
  - Redis 分布式限流
  - 图片兼容式异步化
  - 视频队列化和独立 worker 支持
- 确认测试环境已有可用的 Redis 实例
- 确认 Supabase `workflow_runs`、`audit_logs`、`usage_events`、`usage_daily_agg` 表可正常读写
- 确认前端当前版本已经使用兼容式图片轮询逻辑

## 2. 测试环境变量

后端 API 和 worker 都需要至少配置下面这些变量：

```bash
REDIS_URL=redis://your-redis-host:6379
CACHE_BACKEND=redis
RATE_LIMIT_STORE=redis
RUN_QUEUE_MODE=worker
RUN_QUEUE_CONCURRENCY=4
RUN_WORKER_POLL_MS=2000
RUN_WORKER_BATCH_SIZE=2
```

建议同时保留：

```bash
REQUEST_LOG_ENABLED=true
REQUEST_LOG_SLOW_MS=800
```

## 3. 启动顺序

1. 先启动 API
2. 确认 `/api/v1/health` 正常
3. 再启动 worker
4. 确认 worker 启动日志正常，没有持续报 Redis 连接错误

命令示例：

```bash
npm --prefix backend start
npm --prefix backend run worker
```

## 4. 切换后最小验证

先只验证功能通，再看稳定性。

### 4.1 认证与普通页面

- 登录正常
- 首页、工作台、画布页可正常打开
- 项目列表和详情可正常读取

### 4.2 图片生成

- 创建图片时前端仍保持原有 loading 行为
- 最终能正常出图
- 后端 API 请求不再长时间占住
- `workflow_runs` 中应看到图片 run 从 `queued -> running -> completed`

### 4.3 视频生成

- 创建视频时立即返回本地 `task_id/run_id`
- 前端继续按原有逻辑轮询
- 最终能正常完成或失败
- `workflow_runs` 中应看到视频 run 从 `queued -> running -> completed/failed`

### 4.4 管理后台

- 用户列表正常
- 用量汇总正常
- 分配/解绑 API key 后不会看到明显旧缓存

## 5. 切换后重点观察

- API 进程 CPU 是否比切换前更平稳
- 图片/视频创建接口耗时是否明显下降
- worker 是否出现持续积压
- Redis 是否出现频繁连接失败或超时
- 是否出现大量 `queued` 长时间不进入 `running`
- 是否出现 `run.result.updated` 或 `run.job.created` 写入异常

## 6. 回退方式

如果测试环境发现不稳定，按下面顺序回退：

1. 保留 `REDIS_URL`
2. 把 `RUN_QUEUE_MODE` 改回 `inline`
3. 如 Redis 本身不稳定，再把：
   - `CACHE_BACKEND=memory`
   - `RATE_LIMIT_STORE=memory`
4. 重启 API
5. 暂停 worker

这样可以快速回到最强兼容模式，不需要改前端代码。

## 7. 切换完成标准

满足下面这些条件，才算测试环境切换完成：

- 图片和视频都能稳定生成
- 前端交互没有明显变化
- API 进程不再被图片/视频长任务明显拖住
- worker 无持续报错
- Redis 无持续报错
- 后端无明显新增 5xx
