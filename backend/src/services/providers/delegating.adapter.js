import { BaseProviderAdapter } from './base.adapter.js'

export class DelegatingProviderAdapter extends BaseProviderAdapter {
  constructor(operations = {}) {
    super()
    this.operations = operations
  }

  async chatCompletion(payload, options = {}) {
    return this.#call('chatCompletion', payload, options)
  }

  async imageGeneration(payload, options = {}) {
    return this.#call('imageGeneration', payload, options)
  }

  async videoGeneration(payload, options = {}) {
    return this.#call('videoGeneration', payload, options)
  }

  async pollTaskStatus(taskId, options = {}) {
    return this.#call('pollTaskStatus', taskId, options)
  }

  #call(method, payload, options) {
    const handler = this.operations?.[method]
    if (typeof handler !== 'function') {
      throw new Error(`${this.constructor.name} must configure ${method}`)
    }
    return handler(payload, options)
  }
}
