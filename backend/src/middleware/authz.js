import { getUserAuthz } from '../services/rbac.service.js'
import { HttpError } from '../utils/http.js'

const toSet = (values) => new Set((values || []).map((item) => String(item || '').trim()).filter(Boolean))

const ensureAuthzContext = async (req) => {
  if (!req?.user?.id) {
    throw new HttpError(401, 'Missing authenticated user', 'UNAUTHORIZED')
  }

  const hasRoles = Array.isArray(req.user.roles)
  const hasPermissions = Array.isArray(req.user.permissions)
  if (hasRoles && hasPermissions) return

  const authz = await getUserAuthz(req.user.id)
  req.user.roles = authz.roles
  req.user.permissions = authz.permissions
}

export const attachAuthz = async (req, _res, next) => {
  try {
    await ensureAuthzContext(req)
    next()
  } catch (error) {
    next(error)
  }
}

export const requireRole = (roleCodes = []) => async (req, _res, next) => {
  try {
    await ensureAuthzContext(req)
    const expected = toSet(roleCodes)
    if (!expected.size) return next()

    const current = toSet(req.user.roles)
    const matched = [...expected].some((code) => current.has(code))
    if (!matched) {
      throw new HttpError(403, 'Insufficient role', 'FORBIDDEN')
    }
    next()
  } catch (error) {
    next(error)
  }
}

export const requirePermission = (permissionCodes = []) => async (req, _res, next) => {
  try {
    await ensureAuthzContext(req)
    const expected = toSet(permissionCodes)
    if (!expected.size) return next()

    const current = toSet(req.user.permissions)
    const matched = [...expected].some((code) => current.has(code))
    if (!matched) {
      throw new HttpError(403, 'Insufficient permission', 'FORBIDDEN')
    }
    next()
  } catch (error) {
    next(error)
  }
}
