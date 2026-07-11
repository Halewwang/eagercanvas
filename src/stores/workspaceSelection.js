export const createWorkspaceSelectionCoordinator = ({
  applyResponse,
  findWorkspace,
  getConfirmedFromResponse,
  getCurrentWorkspace,
  requestSelection,
  setCurrentWorkspace
}) => {
  let selectionQueue = Promise.resolve()
  let selectionRequestToken = 0
  let confirmedWorkspace

  const confirm = (workspace) => {
    if (workspace) confirmedWorkspace = workspace
    return confirmedWorkspace
  }

  const select = async (workspaceId) => {
    if (confirmedWorkspace === undefined) confirm(getCurrentWorkspace())

    const requestToken = ++selectionRequestToken
    const optimisticWorkspace = findWorkspace(workspaceId)
    if (optimisticWorkspace) setCurrentWorkspace(optimisticWorkspace)

    const selectionRequest = selectionQueue
      .catch(() => null)
      .then(() => requestSelection(workspaceId))
    selectionQueue = selectionRequest.catch(() => null)

    try {
      const response = await selectionRequest
      confirm(getConfirmedFromResponse(response))
      if (requestToken !== selectionRequestToken) return getCurrentWorkspace()
      applyResponse(response)
      return getCurrentWorkspace()
    } catch (error) {
      if (requestToken === selectionRequestToken) setCurrentWorkspace(confirmedWorkspace || null)
      throw error
    }
  }

  return { confirm, select }
}
