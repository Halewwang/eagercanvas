import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import {
  buildProbePlan,
  buildReferenceFormatPlan,
  inspectImage,
  runProbeCases,
  sanitizeMessage,
  validateReferenceCount
} from './probe-image-capabilities.mjs'

const sizes = Array.from({ length: 30 }, (_, i) => ({ ratio: `ratio-${i}`, resolution: '1k', size: `${1024 + i * 16}x1024` }))
const response = (image) => new Response(JSON.stringify({
  output_format: 'png', size: '16x12', data: [{ b64_json: image.toString('base64') }]
}), { headers: { 'content-type': 'application/json' } })

test('probe plan has 65 bounded cases and tests minimum requests twice', () => {
  const plan = buildProbePlan(sizes)
  assert.equal(plan.length, 65)
  assert.equal(new Set(plan.map((item) => item.id)).size, 65)
  assert.equal(plan.filter((item) => item.group === 'size').length, 31)
  assert.equal(plan.filter((item) => item.group === 'minimal').length, 2)
  assert.equal(plan.filter((item) => item.referenceCount).length, 6)
  for (const item of plan.filter((item) => item.group === 'minimal')) {
    assert.deepEqual(Object.keys(item.params).sort(), ['model', 'n', 'prompt'])
  }
  assert.throws(() => validateReferenceCount(17), /16/)
  assert.doesNotThrow(() => validateReferenceCount(16))
})

test('byte inspection identifies actual format and dimensions independent of reported format', async () => {
  const image = await sharp({ create: { width: 16, height: 12, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } } }).png().toBuffer()
  const inspected = await inspectImage(image)
  assert.equal(inspected.sniffedFormat, 'png')
  assert.equal(inspected.width, 16)
  assert.equal(inspected.height, 12)
  assert.equal(inspected.hasAlpha, true)
  assert.equal(inspected.alpha.hasTransparentPixels, true)
  assert.equal(inspected.colors.redFraction, 1)
})

test('paid probe is journaled before fetching, resumes without repeats and caps concurrency at two', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'image-probe-test-'))
  const image = await sharp({ create: { width: 16, height: 12, channels: 3, background: 'red' } }).png().toBuffer()
  let active = 0
  let maximum = 0
  let calls = 0
  const cases = buildProbePlan(sizes).slice(0, 4)
  const mockFetch = async (_url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer secret-test')
    const entries = (await readFile(path.join(outputDir, 'manifest.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
    assert.equal(entries.some((entry) => entry.phase === 'started'), true)
    calls += 1
    active += 1
    maximum = Math.max(maximum, active)
    await new Promise((resolve) => setTimeout(resolve, 5))
    active -= 1
    return response(image)
  }
  try {
    const first = await runProbeCases(cases, { outputDir, apiKey: 'secret-test', fetchImpl: mockFetch, log: () => {} })
    assert.equal(first.completed, 4)
    assert.equal(maximum, 2)
    await runProbeCases(cases, { outputDir, apiKey: 'secret-test', fetchImpl: mockFetch, log: () => {} })
    assert.equal(calls, 4)
    const manifest = await readFile(path.join(outputDir, 'manifest.jsonl'), 'utf8')
    assert.doesNotMatch(manifest, /secret-test|Authorization|b64_json":/)
    const completed = manifest.trim().split('\n').map(JSON.parse).find((item) => item.phase === 'completed')
    assert.equal(completed.images[0].format, 'png')
    assert.equal(completed.images[0].width, 16)
    assert.equal(completed.images[0].height, 12)
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})

test('network failures are not retried or treated as unsupported parameters, and secret URLs are removed', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'image-probe-error-'))
  let calls = 0
  const cases = buildProbePlan(sizes).slice(0, 1)
  const settings = { outputDir, apiKey: 'secret-test', log: () => {}, fetchImpl: async () => {
    calls += 1
    throw new Error('request to https://example.com/image?token=secret-test failed secret-test')
  } }
  try {
    await runProbeCases(cases, settings)
    await runProbeCases(cases, settings)
    assert.equal(calls, 1)
    const manifest = await readFile(path.join(outputDir, 'manifest.jsonl'), 'utf8')
    assert.doesNotMatch(manifest, /secret-test|https:/)
    assert.match(manifest, /network_error/)
    assert.equal(sanitizeMessage('Bearer sk-abcdef https://example.com/?secret=abc'), 'Bearer [redacted] [url]')
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})

test('sustained provider errors pause the remaining queue without automatic retries', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'image-probe-pause-'))
  let calls = 0
  try {
    const result = await runProbeCases(buildProbePlan(sizes).slice(0, 10), {
      outputDir, apiKey: 'secret-test', log: () => {}, fetchImpl: async () => {
        calls += 1
        return new Response(JSON.stringify({ error: { message: 'temporarily unavailable' } }), { status: 503 })
      }
    })
    assert.equal(result.paused, true)
    assert.ok(calls >= 3 && calls <= 4)
    assert.ok(result.remaining >= 6)
    assert.doesNotMatch(await readFile(path.join(outputDir, 'manifest.jsonl'), 'utf8'), /unsupported_parameter/)
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})

test('reference-format probes upload actual JPEG and WebP bytes with matching MIME and filenames', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'image-probe-formats-'))
  const output = await sharp({ create: { width: 16, height: 12, channels: 3, background: 'red' } }).png().toBuffer()
  const cases = buildReferenceFormatPlan()
  assert.equal(cases.length, 4)
  const seen = []
  try {
    await runProbeCases(cases, { outputDir, apiKey: 'secret-test', log: () => {}, fetchImpl: async (_url, init) => {
      const image = init.body.get('image[]')
      const actual = await inspectImage(Buffer.from(await image.arrayBuffer()))
      assert.equal(image.type, `image/${actual.format}`)
      assert.match(image.name, new RegExp(`\\.${actual.format}$`))
      seen.push(actual.format)
      return response(output)
    } })
    assert.deepEqual(seen.sort(), ['jpeg', 'jpeg', 'webp', 'webp'])
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})

test('a fresh output directory uses the preserved size fixture and rejects unknown CLI flags without live calls', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'image-probe-cli-'))
  const script = fileURLToPath(new URL('./probe-image-capabilities.mjs', import.meta.url))
  try {
    const result = spawnSync(process.execPath, [script, `--output-dir=${outputDir}`], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    const plan = JSON.parse(await readFile(path.join(outputDir, 'plan.json'), 'utf8'))
    assert.equal(plan.cases.length, 65)
    assert.equal(plan.cases[0].params.size, '1024x1024')
    const rejected = spawnSync(process.execPath, [script, `--output-dir=${outputDir}`, '--quality-background'], { encoding: 'utf8' })
    assert.equal(rejected.status, 1)
    assert.match(rejected.stderr, /Unknown option/)
    const item = plan.cases[0]
    await writeFile(path.join(outputDir, 'manifest.jsonl'), `${JSON.stringify({ id: item.id, phase: 'started' })}\n`)
    const resumed = await runProbeCases([item], { outputDir, apiKey: 'secret-test', log: () => {}, fetchImpl: () => assert.fail('an interrupted paid request must never automatically repeat') })
    assert.equal(resumed.skippedPreviouslyAttempted, 1)
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})
