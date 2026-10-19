import assert from 'node:assert/strict'
import test from 'node:test'
import { parseRunInput } from './runs.service.js'

for (const [type, model] of [['chat', 'gpt-5.6-sol'], ['image', 'gpt-image-2']]) {
  test(`${type} selects the supported model before creating or queueing a run`, () => {
    const result = parseRunInput({ type, payload: { prompt: 'test' } })
    assert.equal(result.model, model)
    assert.equal(result.payload.model, model)
  })
  test(`${type} rejects old or conflicting model IDs before side effects`, () => {
    for (const input of [
      { type, model: 'gemini-3-pro-preview', payload: { model } },
      { type, model, payload: { model: 'gemini-3-pro-preview' } }
    ]) assert.throws(() => parseRunInput(input), (e) => e.status === 400 && e.code === 'UNSUPPORTED_MODEL')
  })
}

test('video model and payload are preserved', () => {
  const input = { type: 'video', model: 'kling-o1', payload: { model_name: 'kling-o1', prompt: 'test' } }
  assert.deepEqual(parseRunInput(input), input)
})
