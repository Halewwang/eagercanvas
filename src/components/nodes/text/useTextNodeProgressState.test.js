import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { nextTick, ref } from 'vue'

const progressStateUrl = new URL('./useTextNodeProgressState.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')

const loadProgressState = async () => {
  assert.ok(existsSync(progressStateUrl), 'useTextNodeProgressState.js should exist')
  const source = readFileSync(progressStateUrl, 'utf8')
    .replace("from 'vue'", `from '${vueUrl}'`)
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

const createScheduler = () => {
  let nextId = 0
  const intervals = new Map()
  const timeouts = new Map()
  const cleared = []

  return {
    cleared,
    intervals,
    timeouts,
    clearIntervalFn: (id) => {
      cleared.push(['interval', id])
      intervals.delete(id)
    },
    clearTimeoutFn: (id) => {
      cleared.push(['timeout', id])
      timeouts.delete(id)
    },
    runIntervals: () => {
      Array.from(intervals.values()).forEach((entry) => entry.callback())
    },
    runTimeouts: () => {
      Array.from(timeouts.values()).forEach((entry) => entry.callback())
      timeouts.clear()
    },
    setIntervalFn: (callback, delay) => {
      nextId += 1
      intervals.set(nextId, { callback, delay })
      return nextId
    },
    setTimeoutFn: (callback, delay) => {
      nextId += 1
      timeouts.set(nextId, { callback, delay })
      return nextId
    }
  }
}

const createProgressHarness = async () => {
  const { useTextNodeProgressState } = await loadProgressState()
  const loading = ref(false)
  const error = ref('')
  const scheduler = createScheduler()
  const progress = useTextNodeProgressState({
    clearIntervalFn: scheduler.clearIntervalFn,
    clearTimeoutFn: scheduler.clearTimeoutFn,
    error: () => error.value,
    loading: () => loading.value,
    setIntervalFn: scheduler.setIntervalFn,
    setTimeoutFn: scheduler.setTimeoutFn
  })

  return {
    error,
    loading,
    progress,
    scheduler
  }
}

test('text node progress state starts loading progress and finishes through scheduled timers', async () => {
  const { loading, progress, scheduler } = await createProgressHarness()

  loading.value = true
  await nextTick()

  assert.equal(progress.showProgress.value, true)
  assert.equal(progress.progressValue.value, 0)
  assert.equal(scheduler.intervals.size, 1)

  scheduler.runIntervals()
  assert.equal(progress.progressValue.value, 3)
  assert.equal(progress.progressPercent.value, 3)
  assert.deepEqual(progress.progressBarStyle.value, { width: '3%' })

  progress.progressValue.value = 99
  loading.value = false
  await nextTick()
  scheduler.runIntervals()
  scheduler.runTimeouts()

  assert.equal(progress.showProgress.value, false)
  assert.equal(progress.progressValue.value, 0)
})

test('text node progress state clears generation progress when loading ends with an error', async () => {
  const { error, loading, progress, scheduler } = await createProgressHarness()

  loading.value = true
  await nextTick()
  scheduler.runIntervals()
  assert.equal(progress.showProgress.value, true)

  error.value = 'Text generation failed'
  loading.value = false
  await nextTick()

  assert.equal(progress.showProgress.value, false)
  assert.equal(progress.progressValue.value, 0)
  assert.equal(scheduler.intervals.size, 0)
})

test('text node progress state exposes resetProgress for stop handling', async () => {
  const { loading, progress, scheduler } = await createProgressHarness()

  loading.value = true
  await nextTick()
  scheduler.runIntervals()
  assert.equal(progress.showProgress.value, true)
  assert.equal(progress.progressValue.value, 3)

  progress.resetProgress()

  assert.equal(progress.showProgress.value, false)
  assert.equal(progress.progressValue.value, 0)
  assert.equal(scheduler.intervals.size, 0)
})
