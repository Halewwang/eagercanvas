import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const readSource = (relativePath) => {
  const url = new URL(relativePath, import.meta.url)
  assert.ok(existsSync(fileURLToPath(url)), `${relativePath} should exist`)
  return readFileSync(url, 'utf8')
}

const countLines = (source) => source.trimEnd().split('\n').length

test('chat API hook lives in the chat domain module with legacy exports preserved', () => {
  const useApiSource = readSource('./useApi.js')
  const indexSource = readSource('./index.js')
  const chatSource = readSource('./api/useChatApi.js')

  assert.match(chatSource, /export const useChat = /)
  assert.match(chatSource, /streamChatCompletions/)
  assert.match(chatSource, /DEFAULT_CHAT_MODEL/)
  assert.match(chatSource, /useApiState/)

  assert.match(useApiSource, /export \{ useChat \} from '\.\/api\/useChatApi\.js'/)
  assert.doesNotMatch(useApiSource, /export const useChat = /)
  assert.doesNotMatch(useApiSource, /streamChatCompletions/)
  assert.doesNotMatch(useApiSource, /DEFAULT_CHAT_MODEL/)
  assert.match(indexSource, /useChat/)
})

test('shared API state lives in the API support module', () => {
  const useApiSource = readSource('./useApi.js')
  const apiStateSource = readSource('./api/useApiState.js')

  assert.match(apiStateSource, /export const useApiState = /)
  assert.match(useApiSource, /export \{ useApiState \} from '\.\/api\/useApiState\.js'/)
  assert.doesNotMatch(useApiSource, /import \{ useApiState \} from '\.\/api\/useApiState\.js'/)
  assert.doesNotMatch(useApiSource, /export const useApiState = /)
})

test('image API hooks live in the image domain module with legacy exports preserved', () => {
  const useApiSource = readSource('./useApi.js')
  const indexSource = readSource('./index.js')
  const imageSource = readSource('./api/useImageApi.js')
  const imageCoreSource = readSource('./api/imageApiCore.js')

  assert.match(imageSource, /export const useImageGeneration = /)
  assert.match(imageSource, /export const useImageTools = /)
  assert.match(imageSource, /generateImage/)
  assert.match(imageSource, /getImageGenerationTask/)
  assert.match(imageSource, /removeBackground/)
  assert.match(imageSource, /useApiState/)
  assert.match(imageSource, /from '\.\/imageApiCore\.js'/)
  assert.doesNotMatch(imageSource, /const ratioFromSize = /)
  assert.doesNotMatch(imageSource, /const normalizeGeneratedImages = /)
  assert.match(imageCoreSource, /export const ratioFromSize = /)
  assert.match(imageCoreSource, /export const normalizeGeneratedImages = /)
  assert.ok(countLines(imageSource) < 200, 'useImageApi.js should stay below 200 lines')

  assert.match(useApiSource, /export \{ useImageGeneration, useImageTools \} from '\.\/api\/useImageApi\.js'/)
  assert.doesNotMatch(useApiSource, /export const useImageGeneration = /)
  assert.doesNotMatch(useApiSource, /export const useImageTools = /)
  assert.doesNotMatch(useApiSource, /generateImage/)
  assert.doesNotMatch(useApiSource, /getImageGenerationTask/)
  assert.doesNotMatch(useApiSource, /removeBackground/)
  assert.match(indexSource, /useImageGeneration/)
})

test('video API hook lives in the video domain module with legacy exports preserved', () => {
  const useApiSource = readSource('./useApi.js')
  const indexSource = readSource('./index.js')
  const videoSource = readSource('./api/useVideoApi.js')
  const videoCoreSource = readSource('./api/videoApiCore.js')

  assert.match(videoSource, /export const useVideoGeneration = /)
  assert.match(videoSource, /createVideoTask/)
  assert.match(videoSource, /getVideoTaskStatus/)
  assert.match(videoSource, /waitForAbortableDelay/)
  assert.match(videoSource, /useApiState/)
  assert.match(videoSource, /from '\.\/videoApiCore\.js'/)
  assert.doesNotMatch(videoSource, /const getTaskId = /)
  assert.doesNotMatch(videoSource, /const getVideoUrl = /)
  assert.match(videoCoreSource, /export const getVideoTaskId = /)
  assert.match(videoCoreSource, /export const getVideoUrl = /)
  assert.ok(countLines(videoSource) < 200, 'useVideoApi.js should stay below 200 lines')

  assert.match(useApiSource, /export \{ useVideoGeneration \} from '\.\/api\/useVideoApi\.js'/)
  assert.doesNotMatch(useApiSource, /export const useVideoGeneration = /)
  assert.doesNotMatch(useApiSource, /createVideoTask/)
  assert.doesNotMatch(useApiSource, /getVideoTaskStatus/)
  assert.doesNotMatch(useApiSource, /waitForAbortableDelay/)
  assert.match(indexSource, /useVideoGeneration/)
})

test('runtime API callers import hooks from their domain modules instead of compatibility facades', () => {
  const callerSources = [
    '../components/nodes/LLMConfigNode.vue',
    '../components/nodes/TextNode.vue',
    '../components/nodes/ImageConfigNode.vue',
    '../components/nodes/ImageNode.vue',
    '../components/nodes/VideoConfigNode.vue',
    '../components/nodes/VideoNode.vue',
    '../components/tools/MultiAngleToolDrawer.vue',
    '../components/tools/Wedding3x3ToolDrawer.vue',
    '../components/tools/VideoEnhanceToolDrawer.vue'
  ].map((path) => [path, readSource(path)])

  for (const [path, source] of callerSources) {
    assert.doesNotMatch(
      source,
      /import \{[^}]*use(?:Chat|ImageGeneration|ImageTools|VideoGeneration)[^}]*\} from ['"]@\/hooks(?:\/useApi)?['"]/,
      `${path} should import API hooks from domain modules`
    )
  }

  assert.match(readSource('../components/nodes/LLMConfigNode.vue'), /from '@\/hooks\/api\/useChatApi\.js'/)
  assert.match(readSource('../components/nodes/TextNode.vue'), /from '@\/hooks\/api\/useChatApi\.js'/)
  assert.match(readSource('../components/nodes/ImageNode.vue'), /from '@\/hooks\/api\/useImageApi\.js'/)
  assert.match(readSource('../components/tools/VideoEnhanceToolDrawer.vue'), /from '@\/hooks\/api\/useVideoApi\.js'/)
})
