import { apiRequest } from './_httpClient.js'

const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504])

const isTransientError = (error) => {
  const status = Number(error?.response?.status || error?.status || 0)
  return transientStatuses.has(status) || !status
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const withRetry = async (fn, { retries = 2, delayMs = 250 } = {}) => {
  let lastError
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isTransientError(error) || i === retries) throw error
      await sleep(delayMs * (i + 1))
    }
  }
  throw lastError
}

export const apiListProjects = () =>
  apiRequest({
    url: '/projects',
    method: 'get',
    silentNetworkErrorToast: true
  })

export const apiCreateProject = (payload) =>
  withRetry(() =>
    apiRequest({
      url: '/projects',
      method: 'post',
      data: payload,
      silentNetworkErrorToast: true
    })
  )

export const apiGetProject = (id) =>
  apiRequest({
    url: `/projects/${id}`,
    method: 'get',
    silentNetworkErrorToast: true
  })

export const apiPatchProject = (id, payload) =>
  withRetry(() =>
    apiRequest({
      url: `/projects/${id}`,
      method: 'patch',
      data: payload,
      silentNetworkErrorToast: true
    })
  )

export const apiDeleteProject = (id) =>
  withRetry(() =>
    apiRequest({
      url: `/projects/${id}`,
      method: 'delete',
      silentNetworkErrorToast: true
    })
  )

export const apiRequestProjectEditAccess = (id, payload = {}) =>
  apiRequest({
    url: `/projects/${encodeURIComponent(id)}/edit-requests`,
    method: 'post',
    data: payload,
    silentNetworkErrorToast: true
  })

export const apiListProjectEditRequests = (id) =>
  apiRequest({
    url: `/projects/${encodeURIComponent(id)}/edit-requests`,
    method: 'get',
    silentNetworkErrorToast: true
  })

export const apiReviewProjectEditRequest = (id, requestId, payload = {}) =>
  apiRequest({
    url: `/projects/${encodeURIComponent(id)}/edit-requests/${encodeURIComponent(requestId)}/review`,
    method: 'post',
    data: payload,
    silentNetworkErrorToast: true
  })
