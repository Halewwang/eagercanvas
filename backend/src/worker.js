import { env } from './config/env.js'
import { startRunWorkerLoop } from './services/run-worker-loop.service.js'

const controller = startRunWorkerLoop({
  label: 'worker',
  shouldProcess: () => env.runQueueMode === 'worker'
})

process.on('SIGINT', () => {
  controller.stop()
})

process.on('SIGTERM', () => {
  controller.stop()
})
