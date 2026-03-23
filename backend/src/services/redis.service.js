import { createClient } from 'redis'
import { env } from '../config/env.js'

let redisClient = null
let connectPromise = null
let nextRetryAt = 0

const RETRY_COOLDOWN_MS = 5000

const logRedisError = (() => {
  let lastLogAt = 0
  return (error) => {
    const now = Date.now()
    if (now - lastLogAt < RETRY_COOLDOWN_MS) return
    lastLogAt = now
    console.warn('[redis] connection error, fallback to in-memory providers', error?.message || error)
  }
})()

const createRedisClient = () => {
  const client = createClient({ url: env.redisUrl })
  client.on('error', logRedisError)
  return client
}

export const getRedisClient = async () => {
  if (!env.redisUrl) return null
  if (redisClient?.isReady) return redisClient
  if (connectPromise) return connectPromise
  if (Date.now() < nextRetryAt) return null

  if (!redisClient) {
    redisClient = createRedisClient()
  }

  connectPromise = redisClient
    .connect()
    .then(() => redisClient)
    .catch((error) => {
      logRedisError(error)
      nextRetryAt = Date.now() + RETRY_COOLDOWN_MS
      try {
        redisClient?.destroy()
      } catch {
        // Ignore destroy failures during fallback.
      }
      redisClient = null
      return null
    })
    .finally(() => {
      connectPromise = null
    })

  return connectPromise
}

export const withRedisClient = async (handler) => {
  const client = await getRedisClient()
  if (!client) return null

  try {
    return await handler(client)
  } catch (error) {
    logRedisError(error)
    return null
  }
}
