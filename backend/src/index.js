import { app } from './app.js'
import { env } from './config/env.js'
import { startRunWorkerLoop } from './services/run-worker-loop.service.js'

app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port}`)
})

if (env.runRecoveryEnabled && env.runQueueMode !== 'worker') {
  startRunWorkerLoop({
    label: 'api-run-recovery',
    shouldProcess: () => env.runQueueMode !== 'worker'
  })
}
