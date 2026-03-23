# 压测运行手册

这份手册用于采集第一批真实业务基线，目标是得到认证、项目读取、项目保存、生成接口的基础吞吐和延迟数据。

## 1. 启动服务

前端：

```bash
npm run dev
```

后端：

```bash
npm run dev:api
```

## 2. 准备环境变量

建议先导出这些变量：

```bash
export PERF_BASE_URL=http://localhost:8787/api/v1
export PERF_BEARER_TOKEN='你的 access token'
export PERF_PROJECT_ID='你的项目 ID'
export PERF_PROJECT_UPDATED_AT='项目当前 updatedAt'
export PERF_IMAGE_MODEL='你的图片模型名'
```

说明：

- `PERF_BEARER_TOKEN`：登录后从前端本地存储或接口响应中获取
- `PERF_PROJECT_ID`：选一个稳定存在的真实项目
- `PERF_PROJECT_UPDATED_AT`：项目详情里返回的 `updatedAt`
- `PERF_IMAGE_MODEL`：当前后端可用的真实图片模型

## 3. 推荐执行顺序

先跑轻读，再跑写入，最后跑生成，避免重接口影响前面的基线。

### 2.1 先验证 token 和项目参数

```bash
npm run perf:probe
```

如果同时提供了 `PERF_PROJECT_ID`，返回结果里会直接包含项目的 `updatedAt`，可用于保存压测。

### 3.1 健康检查

```bash
PERF_SCENARIO_NAME=health npm run perf:report
```

### 3.2 认证读取

```bash
PERF_SCENARIO_FILE=scripts/perf-scenarios/auth-me.example.json npm run perf:report
```

### 3.3 项目读取

```bash
PERF_SCENARIO_FILE=scripts/perf-scenarios/projects-read.example.json npm run perf:report
```

### 3.4 项目保存

```bash
PERF_SCENARIO_FILE=scripts/perf-scenarios/project-save.example.json npm run perf:report
```

### 3.5 图片生成创建

```bash
PERF_SCENARIO_FILE=scripts/perf-scenarios/generate-image.example.json npm run perf:report
```

## 4. 执行注意事项

- 先用较低并发试跑，确认 token、projectId、model 都有效
- `project-save` 场景会修改真实项目，建议使用专门的压测项目
- `generate-image` 会消耗真实模型额度，先小请求数验证
- 如果请求返回 409，优先检查 `PERF_PROJECT_UPDATED_AT` 是否已经过期
- 如果返回 429，先记录下来，不要立即提高限流阈值

## 5. 结果文件位置

所有结果默认落在：

```bash
perf-reports/
```

建议每次跑完后，把关键结论补到 `doc/perf-baseline-template.md`。
