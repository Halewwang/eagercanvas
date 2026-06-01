export class BaseProviderAdapter {
  async chatCompletion() {
    throw new Error('BaseProviderAdapter must implement chatCompletion')
  }

  async imageGeneration() {
    throw new Error('BaseProviderAdapter must implement imageGeneration')
  }

  async videoGeneration() {
    throw new Error('BaseProviderAdapter must implement videoGeneration')
  }

  async pollTaskStatus() {
    throw new Error('BaseProviderAdapter must implement pollTaskStatus')
  }
}
