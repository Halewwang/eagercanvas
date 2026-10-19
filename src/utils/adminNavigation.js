export const ADMIN_NAV_ITEMS = Object.freeze([
  Object.freeze({
    key: 'AdminUsers', routeName: 'AdminUsers', path: '/admin/users',
    label: '用户管理', permission: 'admin.user.read'
  })
])

export const getAllowedAdminNavItems = (permissions = []) => {
  const allowedPermissions = new Set(Array.isArray(permissions) ? permissions : [])
  return ADMIN_NAV_ITEMS.filter((item) => allowedPermissions.has(item.permission))
}

export const getFirstAllowedAdminRoute = (permissions = []) =>
  getAllowedAdminNavItems(permissions)[0]?.routeName || 'Home'

export const hasAdminAccessPermission = (permissions = []) =>
  getAllowedAdminNavItems(permissions).length > 0

export const resolveAdminRouteAccess = ({ permission = '', permissions = [] } = {}) => {
  const allowedPermissions = new Set(Array.isArray(permissions) ? permissions : [])
  if (!permission || allowedPermissions.has(permission)) {
    return { allowed: true, routeName: null }
  }
  return { allowed: false, routeName: getFirstAllowedAdminRoute(permissions) }
}
