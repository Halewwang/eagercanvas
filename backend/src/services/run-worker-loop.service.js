import { env } from '../config/env.js'
import { processQueuedRuns } from './runs.service.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const startRunWorkerLoop = ({ label = 'worker', shouldProcess } = {}) => {
  let stopping = false

  const stop = () => {
    stopping = true
  }

  const runLoop = async () => {
    console.log(`[${label}] started`, JSON.stringify({
      mode: env.runQueueMode,
      pollMs: env.runWorkerPollMs,
      batchSize: env.runWorkerBatchSize
    }))

    while (!stopping) {
      try {
        if (typeof shouldProcess === 'function' && !shouldProcess()) {
          await sleep(env.runWorkerPollMs)
          continue
        }

        const result = await processQueuedRuns({ limit: env.runWorkerBatchSize })
        if (!result?.processed) {
          await sleep(env.runWorkerPollMs)
        }
      } catch (error) {
        console.error(`[${label}] loop error`, error?.message || error)
        await sleep(env.runWorkerPollMs)
      }
    }

    console.log(`[${label}] stopped`)
  }

  runLoop().catch((error) => {
    console.error(`[${label}] fatal error`, error?.message || error)
  })

  return { stop }
}
