import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { nextTick, ref } from 'vue'

const progressStateUrl = new URL('./useImageNodeProgressState.js', import.meta.url)
const layoutUrl = new URL('../../../utils/imageNodeLayout.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const progressStateSource = readFileSync(progressStateUrl, 'utf8')
  .replace("from 'vue'", `from '${vueUrl}'`)
  .replace("from '@/utils/imageNodeLayout'", `from '${layoutUrl.href}'`)
const { useImageNodeProgressState } = await import(`data:text/javascript;base64,${Buffer.from(progressStateSource).toString('base64')}`)

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

const createProgressHarness = (overrides = {}) => {
  const loading = ref(false)
  const error = ref('')
  const scheduler = createScheduler()
  const progress = useImageNodeProgressState({
    clearIntervalFn: scheduler.clearIntervalFn,
    clearTimeoutFn: scheduler.clearTimeoutFn,
    error: () => error.value,
    loading: () => loading.value,
    nowFn: overrides.nowFn,
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

test('image node progress state starts loading progress and finishes through scheduled timers', async () => {
  const { loading, progress, scheduler } = createProgressHarness()

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

test('image node progress state clears generation progress when loading ends with an error', async () => {
  const { error, loading, progress, scheduler } = createProgressHarness()

  loading.value = true
  await nextTick()
  scheduler.runIntervals()
  assert.equal(progress.showProgress.value, true)

  error.value = 'Generation failed'
  loading.value = false
  await nextTick()

  assert.equal(progress.showProgress.value, false)
  assert.equal(progress.progressValue.value, 0)
  assert.equal(scheduler.intervals.size, 0)
})

test('image node progress state exposes phase labels and elapsed wait time', async () => {
  let now = 0
  const { loading, progress, scheduler } = createProgressHarness({
    nowFn: () => now
  })

  loading.value = true
  await nextTick()

  assert.equal(progress.progressPhaseLabel.value, 'Submitting request')
  assert.equal(progress.progressElapsedSeconds.value, 0)

  now = 32_000
  progress.progressValue.value = 42
  scheduler.runIntervals()

  assert.equal(progress.progressPhaseLabel.value, 'Generating image')
  assert.equal(progress.progressElapsedSeconds.value, 32)

  progress.progressValue.value = 90
  scheduler.runIntervals()
  assert.equal(progress.progressPhaseLabel.value, 'Fetching result')

  progress.progressValue.value = 98
  scheduler.runIntervals()
  assert.equal(progress.progressPhaseLabel.value, 'Saving result')
})

test('image node progress state exposes resetProgress for stop handling', async () => {
  const { loading, progress, scheduler } = createProgressHarness()

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

test('image node progress state exposes upload progress refs and derived style', () => {
  const { progress } = createProgressHarness()

  progress.showUploadProgress.value = true
  progress.uploadStage.value = 'saving'
  progress.uploadProgress.value = 95

  assert.equal(progress.showUploadProgress.value, true)
  assert.deepEqual(progress.uploadProgressStyle.value, {
    background: '#d8dbe0',
    width: '95%'
  })
})
