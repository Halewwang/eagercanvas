#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

const DEFAULT_BASE_URL = process.env.PERF_BASE_URL || 'http://localhost:8787/api/v1'
const DEFAULT_PATHS = (process.env.PERF_PATHS || '/health')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const scenarioFile = String(process.env.PERF_SCENARIO_FILE || '').trim()
const outputFile = String(process.env.PERF_OUTPUT_FILE || '').trim()

const loadScenario = () => {
  if (!scenarioFile) return null
  const raw = fs.readFileSync(scenarioFile, 'utf8')
  return JSON.parse(raw)
}

const resolveTemplate = (value) => {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, name) => process.env[name] ?? '')
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplate(item))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveTemplate(item)])
    )
  }
  return value
}

const scenario = loadScenario()

const config = {
  baseUrl: DEFAULT_BASE_URL.replace(/\/+$/, ''),
  paths: DEFAULT_PATHS,
  concurrency: Number(process.env.PERF_CONCURRENCY || 10),
  requests: Number(process.env.PERF_REQUESTS || 100),
  method: String(process.env.PERF_METHOD || 'GET').toUpperCase(),
  body: process.env.PERF_BODY ? JSON.parse(process.env.PERF_BODY) : null,
  bearerToken: String(process.env.PERF_BEARER_TOKEN || '').trim(),
  scenario
}

if (config.scenario) {
  config.scenario = resolveTemplate(config.scenario)
  config.baseUrl = String(config.scenario.baseUrl || config.baseUrl).replace(/\/+$/, '')
  config.concurrency = Number(config.scenario.concurrency || config.concurrency)
  config.requests = Number(config.scenario.requests || config.requests)
  config.method = String(config.scenario.method || config.method).toUpperCase()
  config.body = Object.prototype.hasOwnProperty.call(config.scenario, 'body') ? config.scenario.body : config.body
  config.bearerToken = String(config.scenario.bearerToken || config.bearerToken || '').trim()
  if (Array.isArray(config.scenario.requestsList) && config.scenario.requestsList.length > 0) {
    config.requestsList = config.scenario.requestsList
  } else {
    config.paths = Array.isArray(config.scenario.paths) && config.scenario.paths.length > 0
      ? config.scenario.paths
      : config.paths
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const makeHeaders = (requestConfig = {}) => {
  const headers = { 'x-request-id': `perf-${Date.now()}` }
  const merged = {
    ...headers,
    ...(requestConfig.headers || {})
  }
  const hasBody = Object.prototype.hasOwnProperty.call(requestConfig, 'body')
    ? requestConfig.body != null
    : config.body != null
  const bearerToken = String(requestConfig.bearerToken || config.bearerToken || '').trim()
  if (hasBody) merged['content-type'] = merged['content-type'] || 'application/json'
  if (bearerToken) merged.authorization = `Bearer ${bearerToken}`
  return merged
}

const requests = Array.isArray(config.requestsList) && config.requestsList.length > 0
  ? Array.from({ length: config.requests }, (_, index) => ({
      id: index + 1,
      ...config.requestsList[index % config.requestsList.length]
    }))
  : Array.from({ length: config.requests }, (_, index) => ({
      id: index + 1,
      path: config.paths[index % config.paths.length]
    }))

const stats = {
  total: requests.length,
  ok: 0,
  failed: 0,
  byStatus: new Map(),
  durations: [],
  sampleErrors: []
}

const recordStatus = (status) => {
  stats.byStatus.set(status, Number(stats.byStatus.get(status) || 0) + 1)
}

const requestOnce = async (requestConfig) => {
  const { path, method, body, headers, bearerToken } = requestConfig
  const requestMethod = String(method || config.method).toUpperCase()
  const requestBody = Object.prototype.hasOwnProperty.call(requestConfig, 'body') ? body : config.body
  const startedAt = performance.now()
  const response = await fetch(`${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    method: requestMethod,
    headers: makeHeaders({ headers, body: requestBody, bearerToken }),
    body: requestBody != null ? JSON.stringify(requestBody) : undefined
  })

  const durationMs = performance.now() - startedAt
  stats.durations.push(durationMs)
  recordStatus(response.status)
  if (response.ok) stats.ok += 1
  else stats.failed += 1

  return {
    ok: response.ok,
    status: response.status,
    durationMs
  }
}

const percentile = (sorted, ratio) => {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))
  return sorted[index]
}

const run = async () => {
  const queue = [...requests]
  const workers = Array.from({ length: Math.min(config.concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift()
      if (!next) return
      try {
        await requestOnce(next)
      } catch (error) {
        stats.failed += 1
        recordStatus('network_error')
        stats.durations.push(0)
        if (stats.sampleErrors.length < 3) {
          stats.sampleErrors.push(String(error?.message || error))
        }
        await sleep(10)
      }
    }
  })

  const startedAt = performance.now()
  await Promise.all(workers)
  const totalMs = performance.now() - startedAt
  const sortedDurations = [...stats.durations].sort((a, b) => a - b)

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: config.baseUrl,
    scenarioFile: scenarioFile || null,
    paths: config.paths,
    method: config.method,
    concurrency: config.concurrency,
    requests: stats.total,
    ok: stats.ok,
    failed: stats.failed,
    totalDurationMs: Number(totalMs.toFixed(2)),
    throughputRps: Number((stats.total / Math.max(totalMs / 1000, 0.001)).toFixed(2)),
    latencyMs: {
      min: Number((sortedDurations[0] || 0).toFixed(2)),
      p50: Number(percentile(sortedDurations, 0.5).toFixed(2)),
      p95: Number(percentile(sortedDurations, 0.95).toFixed(2)),
      p99: Number(percentile(sortedDurations, 0.99).toFixed(2)),
      max: Number((sortedDurations[sortedDurations.length - 1] || 0).toFixed(2))
    },
    byStatus: Object.fromEntries(stats.byStatus.entries()),
    sampleErrors: stats.sampleErrors
  }

  if (outputFile) {
    const targetPath = path.resolve(outputFile)
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.writeFileSync(targetPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  }

  console.log(JSON.stringify(summary, null, 2))
}

run().catch((error) => {
  console.error('[perf-baseline] failed', error)
  process.exit(1)
})
