import { HttpError } from '../utils/http.js'

const isProjectOwnerIneligibleError = (error = {}) => (
  [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(' ')
    .includes('PROJECT_OWNER_INELIGIBLE')
)

export const throwProjectOwnerWriteError = (error, fallbackCode) => {
  if (isProjectOwnerIneligibleError(error)) {
    throw new HttpError(409, 'Project owner must be an active account', 'PROJECT_OWNER_INELIGIBLE')
  }
  throw new HttpError(500, error?.message || 'Project owner write failed', fallbackCode)
}
