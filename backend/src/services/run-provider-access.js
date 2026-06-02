import { resolveImageGenerationRequest } from './providers/image-request.js'
import {
  resolveActiveUserServiceAccess,
  resolveActiveUserServiceCredential
} from './service-access.service.js'

const isDerouterImageRun = (run = {}) => {
  if (run?.type !== 'image') return false
  const request = resolveImageGenerationRequest(run.payload || {})
  return request.kind === 'adapter' && request.adapter === 'derouter'
}

export const resolveRunProviderAccess = async (userId, run = {}, deps = {}) => {
  const resolveCredential = deps.resolveCredential || resolveActiveUserServiceCredential
  const resolveServiceAccess = deps.resolveServiceAccess || resolveActiveUserServiceAccess

  if (isDerouterImageRun(run)) {
    const access = await resolveServiceAccess(userId)
    return {
      serviceCredentialId: access.serviceCredentialId || null,
      apiName: 'derouter',
      apiKey: ''
    }
  }

  return resolveCredential(userId)
}

export const buildRunProviderRequestOptions = (providerAccess = {}) => {
  const apiKey = String(providerAccess?.apiKey || '').trim()
  return apiKey ? { apiKey } : {}
}
