import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { nextTick } from 'vue'

const modelConfigUrl = new URL('./useModelConfig.js', import.meta.url)
const modelsUrl = new URL('../config/models.js', import.meta.url)
const modelsSource = readFileSync(modelsUrl, 'utf8')
  .replace("from '@/utils/gptImageParameters'", `from '${new URL('../utils/gptImageParameters.js', import.meta.url).href}'`)
const modelsModuleUrl = `data:text/javascript;base64,${Buffer.from(modelsSource).toString('base64')}`
const constantsUrl = new URL('../utils/constants.js', import.meta.url)
const { STORAGE_KEYS } = await import(constantsUrl.href)

// Load a fresh singleton against the saved preferences for this browser session.
test('model preferences discard retired saved models and reject unsupported custom models', async () => {
  const saved = new Map([
    [STORAGE_KEYS.SELECTED_CHAT_MODEL, 'gemini-2.5-flash'],
    [STORAGE_KEYS.SELECTED_IMAGE_MODEL, 'gpt-image-lite'],
    [STORAGE_KEYS.CUSTOM_CHAT_MODELS, JSON.stringify([{ key: 'gemini-2.5-flash' }, { key: 'custom-chat' }])],
    [STORAGE_KEYS.CUSTOM_IMAGE_MODELS, JSON.stringify([{ key: 'gemini-3-pro-image-preview' }])]
  ])
  const originalStorage = globalThis.localStorage
  globalThis.localStorage = {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key)
  }
  try {
    const source = readFileSync(modelConfigUrl, 'utf8')
      .replace("from 'vue'", `from '${import.meta.resolve('vue')}'`)
      .replace("from '@/utils'", `from '${constantsUrl.href}'`)
      .replace("from '@/config/models'", `from '${modelsModuleUrl}'`)
    const { useModelConfig } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
    const config = useModelConfig()
    await nextTick()

    assert.equal(config.selectedChatModel.value, 'gpt-5.6-sol')
    assert.equal(config.selectedImageModel.value, 'gpt-image-2')
    assert.equal(saved.get(STORAGE_KEYS.SELECTED_CHAT_MODEL), 'gpt-5.6-sol')
    assert.equal(saved.get(STORAGE_KEYS.SELECTED_IMAGE_MODEL), 'gpt-image-2')
    assert.deepEqual(config.allChatModels.value.map((model) => model.key), ['gpt-5.6-sol'])
    assert.deepEqual(config.allImageModels.value.map((model) => model.key), ['gpt-image-2'])
    assert.equal(saved.get(STORAGE_KEYS.CUSTOM_CHAT_MODELS), '[]')
    assert.equal(saved.get(STORAGE_KEYS.CUSTOM_IMAGE_MODELS), '[]')
    assert.equal(config.addCustomChatModel('gemini-2.5-flash'), false)
    assert.equal(config.addCustomImageModel('gpt-image-lite'), false)

    config.selectedChatModel.value = 'custom-chat'
    config.selectedImageModel.value = 'gemini-3-pro-image-preview'
    config.customChatModels.value.push({ key: 'custom-chat' })
    await nextTick()
    assert.equal(config.selectedChatModel.value, 'gpt-5.6-sol')
    assert.equal(config.selectedImageModel.value, 'gpt-image-2')
    assert.deepEqual(config.customChatModels.value, [])
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = originalStorage
  }
})
