import {
  OBSERVABILITY_SLOW_API_MS,
  installIssueFlushLifecycle,
  issueObservability
} from './issueObservabilityClient.js'

const getErrorMessage = (error) => error?.message || String(error || 'Unknown error')

export const reportFrontendIssue = (event = {}) => issueObservability.capture(event)

export const reportErrorBoundaryIssue = (error, info = {}) => reportFrontendIssue({
  category: 'runtime_error',
  severity: 'p1',
  component: info.component || 'ErrorBoundary',
  message_summary: getErrorMessage(error),
  stack_summary: error?.stack || '',
  metadata: {
    info: info.info || ''
  }
})

export const reportApiIssue = ({
  category = 'api_error',
  severity = 'p2',
  error = null,
  response = null,
  config = null,
  durationMs = 0
} = {}) => {
  const headers = response?.headers || {}
  const requestId = headers['x-request-id'] || headers['X-Request-Id'] || config?.headers?.['x-request-id'] || ''
  return reportFrontendIssue({
    category,
    severity,
    request_id: requestId,
    method: config?.method || '',
    path_template: config?.url || '',
    status_code: response?.status,
    duration_ms: durationMs,
    error_code: response?.data?.code || error?.code || '',
    message_summary: response?.data?.message || error?.message || '',
    metadata: {
      base_url: config?.baseURL || '',
      timeout: config?.timeout || ''
    }
  })
}

const installGlobalErrorHandlers = () => {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (event) => {
    reportFrontendIssue({
      category: 'runtime_error',
      severity: 'p1',
      message_summary: getErrorMessage(event.error || event.message),
      stack_summary: event.error?.stack || '',
      metadata: {
        filename: event.filename || '',
        lineno: event.lineno || '',
        colno: event.colno || ''
      }
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    reportFrontendIssue({
      category: 'unhandled_rejection',
      severity: 'p1',
      message_summary: getErrorMessage(reason),
      stack_summary: reason?.stack || ''
    })
  })
}

const installLongTaskObserver = () => {
  if (typeof PerformanceObserver === 'undefined') return
  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        reportFrontendIssue({
          category: 'performance',
          severity: entry.duration >= OBSERVABILITY_SLOW_API_MS ? 'p1' : 'p2',
          duration_ms: entry.duration,
          message_summary: `Long task: ${Math.round(entry.duration)}ms`,
          metadata: {
            entry_type: entry.entryType || 'longtask',
            name: entry.name || ''
          }
        })
      })
    })
    observer.observe({ type: 'longtask', buffered: true })
  } catch {
    // Long task observation is best-effort only.
  }
}

const installRouteErrorHandler = (router) => {
  if (!router?.onError) return
  router.onError((error, to) => {
    reportFrontendIssue({
      category: 'route_load_error',
      severity: 'p1',
      route: to?.fullPath || '',
      route_name: to?.name || '',
      message_summary: getErrorMessage(error),
      stack_summary: error?.stack || ''
    })
  })
}

export const installIssueObservability = ({ router } = {}) => {
  installGlobalErrorHandlers()
  installLongTaskObserver()
  installRouteErrorHandler(router)
  installIssueFlushLifecycle({ client: issueObservability })
  return issueObservability
}

export { issueObservability, installIssueFlushLifecycle }
export { OBSERVABILITY_SLOW_API_MS }
