import { resolveActiveUserServiceAccess } from './service-access.service.js'

export const resolveRunProviderAccess = async (userId, run = {}, deps = {}) => {
  const resolveServiceAccess = deps.resolveServiceAccess || resolveActiveUserServiceAccess
  const access = await resolveServiceAccess(userId)
  return {
    serviceCredentialId: access.serviceCredentialId || null,
    apiName: run.type === 'chat' || run.type === 'image' ? 'enbrand' : 'shared'
  }
}
