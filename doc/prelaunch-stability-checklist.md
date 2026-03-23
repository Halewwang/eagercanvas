# 上线前稳定性验收清单

这份清单用于上线前做最后一轮确认，目标不是“功能能跑”，而是“切换后不会因为 Redis、worker、兼容异步化引入新的系统性风险”。

## 1. 功能验收

- 登录、刷新 token、退出登录正常
- 项目创建、保存、删除正常
- 画布自动保存正常
- 图片生成正常
- 视频生成正常
- 管理后台正常
- 用户 API key 分配与解绑正常

## 2. 状态流验收

### 图片 run

- `queued`
- `running`
- `completed` 或 `failed`

### 视频 run

- `queued`
- `running`
- `completed` 或 `failed`

检查点：

- `workflow_runs.status` 状态流转正确
- `audit_logs` 中能看到 `run.job.created`
- `audit_logs` 中能看到 `run.result.updated`
- 视频任务能看到 `video.task.created`

## 3. 缓存与限流验收

- 认证缓存可命中
- RBAC 缓存可命中
- 管理员后台缓存可命中
- API key 分配缓存可失效
- 429 返回仍带 `requestId`
- 多实例下限流结果一致

## 4. worker 验收

- worker 可独立启动
- worker 停掉后，API 不应崩溃
- worker 恢复后，新的图片/视频任务可继续被消费
- 不应出现大量 run 永久停留在 `queued`

## 5. Redis 验收

- Redis 不可用时，API 能回退到内存模式而不是直接崩溃
- Redis 可用时，共享缓存和限流正常工作
- 不应出现高频 reconnect 风暴

## 6. 观测验收

- 慢请求日志正常输出
- 错误请求日志正常输出
- `requestId` 可贯穿请求排障
- 能区分 `auth-code / generate / polling / default` 路由组

## 7. 压测建议

即使这次先跳过正式并发验证，上线前也建议至少补一轮轻量压测：

- `auth/me`
- `projects read`
- `project save`
- `generate image create`

最少要确认：

- 没有异常 5xx 激增
- 没有明显排队失控
- 没有 Redis 成为新瓶颈

## 8. 回退策略

上线前必须准备好下面这些回退开关：

- `RUN_QUEUE_MODE=inline`
- `CACHE_BACKEND=memory`
- `RATE_LIMIT_STORE=memory`

要求：

- 这些回退开关可以独立生效
- 切换后只需要重启服务，不需要改前端

## 9. 最终放行条件

只有同时满足下面条件才建议放行：

- 功能回归通过
- 图片/视频状态流正确
- worker 稳定
- Redis 稳定
- 无明显新增错误率
- 有清晰回退方案
