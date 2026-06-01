import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { waitForAbortableDelay } from './useVideoGenerationCore.js'

const videoApiSource = readFileSync(new URL('./api/useVideoApi.js', import.meta.url), 'utf8')
const videoNodeSource = readFileSync(new URL('../components/nodes/VideoNode.vue', import.meta.url), 'utf8')
const videoConfigNodeSource = readFileSync(new URL('../components/nodes/VideoConfigNode.vue', import.meta.url), 'utf8')

const getVideoGenerationSource = () => {
  const start = videoApiSource.indexOf('export const useVideoGeneration = () => {')
  return videoApiSource.slice(start)
}

const createManualTimers = () => {
  const scheduled = []
  const cleared = []

  return {
    scheduled,
    cleared,
    setTimeout(callback, ms) {
      const id = { callback, ms }
      scheduled.push(id)
      return id
    },
    clearTimeout(id) {
      cleared.push(id)
    }
  }
}

test('video generation polling delay rejects immediately when aborted', async () => {
  const timers = createManualTimers()
  const controller = new AbortController()

  const wait = waitForAbortableDelay(5000, controller.signal, timers)
  controller.abort()

  await assert.rejects(wait, (error) => error?.name === 'AbortError')
  assert.equal(timers.scheduled.length, 1)
  assert.deepEqual(timers.cleared, [timers.scheduled[0]])
})

test('video generation polling delay rejects without scheduling when already aborted', async () => {
  const timers = createManualTimers()
  const controller = new AbortController()
  controller.abort()

  await assert.rejects(
    waitForAbortableDelay(5000, controller.signal, timers),
    (error) => error?.name === 'AbortError'
  )
  assert.equal(timers.scheduled.length, 0)
  assert.equal(timers.cleared.length, 0)
})

test('useVideoGeneration wires stop into create requests, polling requests, and polling waits', () => {
  const videoGenerationSource = getVideoGenerationSource()

  assert.match(videoApiSource, /import \{[^}]*waitForAbortableDelay[^}]*\} from '@\/hooks\/useVideoGenerationCore\.js'/)
  assert.match(videoGenerationSource, /createVideoTask\(requestData,[\s\S]*signal: activeVideoAbortController\.signal/)
  assert.match(videoGenerationSource, /getVideoTaskStatus\(id,[\s\S]*signal: activeVideoAbortController\.signal/)
  assert.match(videoGenerationSource, /await waitForAbortableDelay\(interval, activeVideoAbortController\.signal\)/)
  assert.doesNotMatch(videoGenerationSource, /setTimeout\(resolve, interval\)/)
})

test('video config generation stops when the node unmounts', () => {
  assert.match(videoConfigNodeSource, /import \{ ref, computed, watch, onMounted, onUnmounted \} from 'vue'/)
  assert.match(videoConfigNodeSource, /const \{ loading, error, status, video: generatedVideo, progress, generate, stop \} = useVideoGeneration\(\)/)
  assert.match(videoConfigNodeSource, /onUnmounted\(\(\) => stop\(\)\)/)
})

test('video node generation stops when the node unmounts', () => {
  assert.match(videoNodeSource, /const videoGen = useVideoGeneration\(\)/)
  assert.match(videoNodeSource, /onUnmounted\(\(\) => videoGen\.stop\(\)/)
  assert.doesNotMatch(videoNodeSource, /clearProgressTimers\(\)\s*videoGen\.stop\(\)/)
})
