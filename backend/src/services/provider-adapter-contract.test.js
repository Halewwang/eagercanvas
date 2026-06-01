import assert from 'node:assert/strict'
import test from 'node:test'

import { BaseProviderAdapter } from './providers/base.adapter.js'
import { Dashboard302ProviderAdapter } from './providers/dashboard302.adapter.js'
import { Dashboard302VideoProviderAdapter } from './providers/dashboard302-video.adapter.js'
import { OpenAiProviderAdapter } from './providers/openai.adapter.js'
import { PhotoRoomProviderAdapter } from './providers/photoroom.adapter.js'
import { SeedanceProviderAdapter } from './providers/seedance.adapter.js'
import { getProviderAdapter, providerAdapters } from './providers/index.js'

const adapterMethods = ['chatCompletion', 'imageGeneration', 'videoGeneration', 'pollTaskStatus']

test('base provider adapter defines the shared adapter contract', async () => {
  const adapter = new BaseProviderAdapter()

  for (const method of adapterMethods) {
    assert.equal(typeof adapter[method], 'function')
    await assert.rejects(
      adapter[method]({}, {}),
      /BaseProviderAdapter must implement/
    )
  }
})

test('provider adapter registry exposes the planned provider adapters', () => {
  assert.deepEqual(Object.keys(providerAdapters).sort(), ['dashboard302', 'dashboard302-video', 'openai', 'photoroom', 'seedance'])
  assert.ok(providerAdapters.openai instanceof OpenAiProviderAdapter)
  assert.ok(providerAdapters.seedance instanceof SeedanceProviderAdapter)
  assert.ok(providerAdapters.dashboard302 instanceof Dashboard302ProviderAdapter)
  assert.ok(providerAdapters['dashboard302-video'] instanceof Dashboard302VideoProviderAdapter)
  assert.ok(providerAdapters.photoroom instanceof PhotoRoomProviderAdapter)

  for (const adapter of Object.values(providerAdapters)) {
    assert.ok(adapter instanceof BaseProviderAdapter)
    for (const method of adapterMethods) {
      assert.equal(typeof adapter[method], 'function')
      assert.notEqual(adapter[method], BaseProviderAdapter.prototype[method])
    }
  }

  assert.equal(getProviderAdapter('openai'), providerAdapters.openai)
  assert.equal(getProviderAdapter('seedance'), providerAdapters.seedance)
  assert.equal(getProviderAdapter('dashboard302'), providerAdapters.dashboard302)
  assert.equal(getProviderAdapter('dashboard302-video'), providerAdapters['dashboard302-video'])
  assert.equal(getProviderAdapter('photoroom'), providerAdapters.photoroom)
  assert.equal(getProviderAdapter('unknown'), null)
})

test('provider adapters delegate contract calls to injected provider operations', async () => {
  const adapter = new OpenAiProviderAdapter({
    chatCompletion: async (payload, options) => ({ type: 'chat', payload, options }),
    imageGeneration: async (payload, options) => ({ type: 'image', payload, options }),
    videoGeneration: async (payload, options) => ({ type: 'video', payload, options }),
    pollTaskStatus: async (taskId, options) => ({ type: 'status', taskId, options })
  })

  assert.deepEqual(await adapter.chatCompletion({ prompt: 'hello' }, { signal: 's' }), {
    type: 'chat',
    payload: { prompt: 'hello' },
    options: { signal: 's' }
  })
  assert.deepEqual(await adapter.imageGeneration({ prompt: 'image' }, { apiKey: 'key' }), {
    type: 'image',
    payload: { prompt: 'image' },
    options: { apiKey: 'key' }
  })
  assert.deepEqual(await adapter.videoGeneration({ prompt: 'video' }, { apiKey: 'key' }), {
    type: 'video',
    payload: { prompt: 'video' },
    options: { apiKey: 'key' }
  })
  assert.deepEqual(await adapter.pollTaskStatus('task-1', { apiKey: 'key' }), {
    type: 'status',
    taskId: 'task-1',
    options: { apiKey: 'key' }
  })
})
