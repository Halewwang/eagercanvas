import { HttpError } from '../utils/http.js'

export const isAdminLifecycleMutationEnabled = (environment = process.env) => (
  String(environment?.ADMIN_LIFECYCLE_MUTATIONS_ENABLED || '').trim().toLowerCase() === 'true'
)

export const requireAdminLifecycleMutationEnabled = (_req, _res, next, environment = process.env) => {
  if (isAdminLifecycleMutationEnabled(environment)) return next()
  return next(new HttpError(
    503,
    'Administrative lifecycle mutations are temporarily disabled for a controlled rollout.',
    'ADMIN_LIFECYCLE_MAINTENANCE'
  ))
}

export default requireAdminLifecycleMutationEnabled
