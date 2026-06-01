import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const readText = (url) => readFile(fileURLToPath(url), 'utf8')
const countLines = (source) => source.split(/\r?\n/).length

test('root verification scripts include backend tests in the default check gate', async () => {
  const packageJson = JSON.parse(await readText(new URL('../package.json', import.meta.url)))

  assert.equal(
    packageJson.scripts['test:backend'],
    "find backend/src -name '*.test.js' -print0 | xargs -0 node --test"
  )
  assert.match(packageJson.scripts.check, /npm run test:backend/)
})

test('shared ui barrel does not expose the retired BaseCard component', async () => {
  const uiIndexSource = await readText(new URL('./components/ui/index.js', import.meta.url))
  const baseCardPath = fileURLToPath(new URL('./components/ui/BaseCard.vue', import.meta.url))

  assert.doesNotMatch(uiIndexSource, /BaseCard/)
  assert.equal(existsSync(baseCardPath), false)
})

test('retired workflow planner surface is not exposed from runtime modules', async () => {
  const hooksIndexSource = await readText(new URL('./hooks/index.js', import.meta.url))
  const retiredPaths = [
    './components/WorkflowPanel.vue',
    './hooks/useWorkflowExecutor.js',
    './hooks/useWorkflowOrchestrator.js'
  ].map((relativePath) => fileURLToPath(new URL(relativePath, import.meta.url)))

  assert.doesNotMatch(hooksIndexSource, /useWorkflowExecutor/)
  assert.doesNotMatch(hooksIndexSource, /useWorkflowOrchestrator/)
  retiredPaths.forEach((retiredPath) => {
    assert.equal(existsSync(retiredPath), false)
  })
})

test('video api does not expose the unused standalone polling helper', async () => {
  const videoApiSource = await readText(new URL('./api/video.js', import.meta.url))

  assert.doesNotMatch(videoApiSource, /pollVideoTask/)
})

test('image and video node runtime modules stay under the Task 8 line ceiling', async () => {
  const runtimeDirectories = [
    new URL('./components/nodes/image/', import.meta.url),
    new URL('./components/nodes/video/', import.meta.url)
  ]
  const runtimeEntries = runtimeDirectories.flatMap((directoryUrl) =>
    readdirSync(directoryUrl, { withFileTypes: true })
      .filter((entry) =>
        entry.isFile() &&
        !entry.name.endsWith('.test.js') &&
        (entry.name.endsWith('.vue') || entry.name.endsWith('.js'))
      )
      .map((entry) => new URL(entry.name, directoryUrl))
  )
  const oversizedRuntimeModules = []

  for (const moduleUrl of runtimeEntries) {
    const source = await readText(moduleUrl)
    const lineCount = countLines(source)
    if (lineCount >= 500) {
      oversizedRuntimeModules.push({
        path: fileURLToPath(moduleUrl),
        lines: lineCount
      })
    }
  }

  assert.equal(countLines(await readText(new URL('./components/nodes/ImageNode.vue', import.meta.url))) < 800, true)
  assert.equal(countLines(await readText(new URL('./components/nodes/VideoNode.vue', import.meta.url))) < 800, true)
  assert.deepEqual(oversizedRuntimeModules, [])
})
