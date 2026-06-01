export const getAdminSelectedRoleMap = (users = []) => {
  const roleMap = {}
  for (const item of Array.isArray(users) ? users : []) {
    roleMap[item.id] = Array.isArray(item.roles) && item.roles.length ? item.roles[0] : 'user'
  }
  return roleMap
}
