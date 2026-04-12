export const shouldApplyRemoteProjectSnapshot = ({
  refreshedProjectId = '',
  activeRouteProjectId = '',
  currentCanvasProjectId = '',
  hasPendingCanvasChanges = false
} = {}) => {
  const refreshedId = String(refreshedProjectId || '').trim()
  const routeId = String(activeRouteProjectId || '').trim()
  const currentId = String(currentCanvasProjectId || '').trim()

  if (!refreshedId || !routeId || refreshedId !== routeId) {
    return false
  }

  if (currentId && refreshedId === currentId && hasPendingCanvasChanges) {
    return false
  }

  return true
}
