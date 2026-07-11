export const PROJECT_LIST_ACTIVATION_FAILED = 'PROJECT_LIST_ACTIVATION_FAILED'

const captureRequest = (requestPromise) => Promise.resolve(requestPromise).then(
  (response) => ({ response, error: null }),
  (error) => ({ response: null, error })
)

export const awaitProjectListActivation = async ({ requestPromise, commitAfter = null } = {}) => {
  const requestResult = captureRequest(requestPromise)
  if (commitAfter) {
    try {
      await commitAfter
    } catch (cause) {
      const error = new Error(cause?.message || 'Workspace activation failed', { cause })
      error.code = PROJECT_LIST_ACTIVATION_FAILED
      throw error
    }
  }
  const result = await requestResult
  if (result.error) throw result.error
  return result.response
}
