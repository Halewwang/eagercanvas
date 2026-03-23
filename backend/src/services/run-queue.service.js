import { env } from '../config/env.js'
import { withRedisClient } from './redis.service.js'

const queue = []
let activeWorkers = 0
const redisQueueKey = 'run-queue:slots'
const redisQueueInitKey = 'run-queue:slots:initialized'

const logBackendSelection = (() => {
  let logged = false
  return () => {
    if (logged) return
    logged = true
    console.log('[run-queue] provider', JSON.stringify({
      mode: env.runQueueMode,
      concurrency: env.runQueueConcurrency,
      redisConfigured: !!env.redisUrl
    }))
  }
})()

const runQueuedJob = () => {
  if (!queue.length) return
  if (activeWorkers >= env.runQueueConcurrency) return

  const next = queue.shift()
  if (!next) return

  activeWorkers += 1
  Promise.resolve()
    .then(() => next.handler())
    .then((result) => next.resolve(result))
    .catch((error) => next.reject(error))
    .finally(() => {
      activeWorkers = Math.max(activeWorkers - 1, 0)
      runQueuedJob()
    })
}

const submitMemoryQueuedJob = (handler) => new Promise((resolve, reject) => {
  queue.push({ handler, resolve, reject })
  runQueuedJob()
})

const runDetached = (runner) => {
  Promise.resolve()
    .then(() => runner())
    .catch((error) => {
      console.error('[run-queue] detached job failed', error?.message || error)
    })
}

const ensureRedisSlots = async () => {
  const concurrency = Math.max(Number(env.runQueueConcurrency || 1), 1)
  return withRedisClient(async (client) => {
    const initialized = await client.set(redisQueueInitKey, String(concurrency), { NX: true })
    if (initialized !== 'OK') return true

    const pipeline = client.multi()
    for (let index = 0; index < concurrency; index += 1) {
      pipeline.lPush(redisQueueKey, `slot:${index + 1}`)
    }
    await pipeline.exec()
    return true
  })
}

const acquireRedisSlot = async () => {
  const prepared = await ensureRedisSlots()
  if (!prepared) return null
  const response = await withRedisClient((client) => client.sendCommand(['BLPOP', redisQueueKey, '30']))
  if (!Array.isArray(response) || response.length < 2) return null
  return String(response[1] || '')
}

const releaseRedisSlot = async (slotToken) => {
  if (!slotToken) return
  await withRedisClient((client) => client.lPush(redisQueueKey, slotToken))
}

const runWithRedisSlot = async (handler) => {
  const slotToken = await acquireRedisSlot()
  if (!slotToken) {
    console.warn('[run-queue] redis slot unavailable, falling back to inline execution')
    return handler()
  }

  try {
    return await handler()
  } finally {
    await releaseRedisSlot(slotToken)
  }
}

export const submitRunJob = async ({ handler, waitForCompletion = true }) => {
  logBackendSelection()
  if (env.runQueueMode === 'redis') {
    if (!waitForCompletion) {
      runDetached(() => runWithRedisSlot(handler))
      return null
    }
    return runWithRedisSlot(handler)
  }

  if (env.runQueueMode === 'memory') {
    if (!waitForCompletion) {
      runDetached(() => submitMemoryQueuedJob(handler))
      return null
    }
    return submitMemoryQueuedJob(handler)
  }

  if (!waitForCompletion) {
    runDetached(handler)
    return null
  }

  if (env.runQueueMode !== 'memory') {
    return handler()
  }
  return submitMemoryQueuedJob(handler)
}
