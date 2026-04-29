import { app } from './app.js'
import { env } from './config/env.js'
import { startBillingReconciliationScheduler } from './services/billing-reconciliation.service.js'

app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port}`)
  startBillingReconciliationScheduler()
})
