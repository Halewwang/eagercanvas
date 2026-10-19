import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import sharp from 'sharp'

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPO = path.dirname(BACKEND)
const DEFAULT_OUTPUT = path.join(REPO, 'output/image-parameter-probe-2026-10-19')
const BASE_URL = 'https://api.enbrand.co/v1'
const TIMEOUT_MS = 180000
const PROMPT = 'A minimal flat illustration containing one solid red circle and one solid blue square as two separate complete objects. No text, no other objects.'
const EDIT_PROMPT = 'Create one composition containing the distinct objects from all input images. Preserve their original colors and shapes as separate complete objects. No text or additional objects.'
const BASE_PARAMS = { model: 'gpt-image-2', prompt: PROMPT, size: '1024x1024', quality: 'low', background: 'opaque', output_format: 'png', n: 1, moderation: 'auto' }

export const validateReferenceCount = (count) => {
  if (count < 1 || count > 16) throw new Error('Reference count must be between 1 and 16')
}

export const buildProbePlan = (sizes) => {
  const plan = sizes.map((item, index) => ({
    id: `size-${String(index + 1).padStart(2, '0')}`, group: 'size', ratio: item.ratio, resolution: item.resolution,
    params: { ...BASE_PARAMS, size: item.size }
  }))
  plan.push({ id: 'size-auto', group: 'size', params: { ...BASE_PARAMS, size: 'auto' } })
  plan.push({ id: 'baseline-repeat', group: 'baseline', params: { ...BASE_PARAMS } })
  const variants = [
    ...['auto', 'medium', 'high'].map((quality) => ({ name: `quality-${quality}`, params: { quality } })),
    ...['auto', 'transparent'].map((background) => ({ name: `background-${background}`, params: { background } })),
    ...['jpeg', 'webp'].flatMap((output_format) => [0, 100].map((output_compression) => ({
      name: `format-${output_format}-compression-${output_compression}`, params: { output_format, output_compression }
    }))),
    { name: 'moderation-low', params: { moderation: 'low' } },
    { name: 'count-2', params: { n: 2 } }
  ]
  for (const variant of variants) {
    for (let repeat = 1; repeat <= 2; repeat += 1) plan.push({
      id: `${variant.name}-rep-${repeat}`, group: 'parameter', params: { ...BASE_PARAMS, ...variant.params }
    })
  }
  for (const referenceCount of [1, 2, 16]) {
    for (let repeat = 1; repeat <= 2; repeat += 1) plan.push({
      id: `edit-${referenceCount}-rep-${repeat}`, group: 'edit', referenceCount,
      params: { ...BASE_PARAMS, prompt: EDIT_PROMPT }
    })
  }
  for (const size of ['auto', '1536x1024', '3840x2160']) plan.push({
    id: `size-${size}-repeat`, group: 'size-repeat', params: { ...BASE_PARAMS, size }
  })
  for (let repeat = 1; repeat <= 2; repeat += 1) plan.push({
    id: `minimal-rep-${repeat}`, group: 'minimal', params: { model: 'gpt-image-2', prompt: PROMPT, n: 1 }
  })
  return plan
}

export const buildReferenceFormatPlan = () => ['jpeg', 'webp'].flatMap((referenceFormat) => [1, 2].map((repeat) => ({
  id: `edit-format-${referenceFormat}-rep-${repeat}`, group: 'edit-format', referenceCount: 1, referenceFormat,
  params: { ...BASE_PARAMS, prompt: EDIT_PROMPT }
})))

export const sanitizeMessage = (message, apiKey = '') => {
  let safe = String(message || '')
  if (apiKey) safe = safe.split(apiKey).join('[redacted]')
  return safe.replace(/https?:\/\/[^\s"'<>]+/gi, '[url]').replace(/sk-[a-z0-9_-]+/gi, '[redacted]').slice(0, 500)
}

export const inspectImage = async (buffer) => {
  const sniffedFormat = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
    : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 ? 'jpeg'
      : buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : 'unknown'
  const metadata = await sharp(buffer).metadata()
  const stats = metadata.hasAlpha ? await sharp(buffer).stats() : null
  const alphaStats = stats?.channels?.at(-1)
  const { data, info } = await sharp(buffer).resize(128, 128, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let red = 0
  let blue = 0
  const pixels = info.width * info.height
  for (let index = 0; index < data.length; index += info.channels) {
    const [r, g, b] = data.subarray(index, index + 3)
    if (r > 130 && r > g * 1.6 && r > b * 1.6) red += 1
    if (b > 100 && b > g * 1.6 && b > r * 1.6) blue += 1
  }
  return {
    sniffedFormat, format: metadata.format, width: metadata.width, height: metadata.height,
    hasAlpha: Boolean(metadata.hasAlpha), bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex'),
    alpha: alphaStats ? { min: alphaStats.min, max: alphaStats.max, hasTransparentPixels: alphaStats.min < 255 } : { hasTransparentPixels: false },
    colors: { redFraction: red / pixels, blueFraction: blue / pixels, bothColorsDetected: red / pixels > 0.005 && blue / pixels > 0.005 }
  }
}

const loadManifest = async (outputDir) => {
  try {
    const text = await readFile(path.join(outputDir, 'manifest.jsonl'), 'utf8')
    return text.split('\n').filter(Boolean).map((line) => JSON.parse(line))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

const ensureReferences = async (outputDir) => {
  const referenceDir = path.join(outputDir, 'references')
  await mkdir(referenceDir, { recursive: true })
  const shapes = {
    red: '<circle cx="128" cy="128" r="80" fill="#ef2020"/>',
    blue: '<rect x="48" y="48" width="160" height="160" fill="#2020ef"/>',
    both: '<circle cx="66" cy="128" r="45" fill="#ef2020"/><rect x="145" y="83" width="90" height="90" fill="#2020ef"/>'
  }
  const buffers = {}
  for (const [name, shape] of Object.entries(shapes)) {
    buffers[name] = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="white"/>${shape}</svg>`)).png().toBuffer()
    await writeFile(path.join(referenceDir, `${name}.png`), buffers[name])
  }
  return buffers
}

const numericUsage = (value) => {
  if (!value || typeof value !== 'object') return undefined
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    if (typeof item === 'number') return [[key, item]]
    if (item && typeof item === 'object') return [[key, numericUsage(item)]]
    return []
  }))
}

const executeCase = async (item, { outputDir, apiKey, fetchImpl, references }) => {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('Image probe timed out after 180 seconds', 'AbortError')), TIMEOUT_MS)
  const endpoint = item.referenceCount ? '/images/edits' : '/images/generations'
  const result = { id: item.id, group: item.group, phase: 'completed', endpoint, params: item.params, referenceCount: item.referenceCount || 0, completedAt: undefined }
  try {
    let body = JSON.stringify(item.params)
    const headers = { Authorization: `Bearer ${apiKey}` }
    if (item.referenceCount) {
      validateReferenceCount(item.referenceCount)
      body = new FormData()
      for (const [key, value] of Object.entries(item.params)) body.append(key, String(value))
      const inputs = item.referenceCount === 1 ? [references.both]
        : Array.from({ length: item.referenceCount }, (_, index) => index === item.referenceCount - 1 ? references.blue : references.red)
      result.references = []
      for (const [index, input] of inputs.entries()) {
        const format = item.referenceFormat || 'png'
        const buffer = format === 'png' ? input : await sharp(input).toFormat(format).toBuffer()
        const mime = `image/${format}`
        const fileName = `reference-${index + 1}.${format}`
        body.append('image[]', new Blob([buffer], { type: mime }), fileName)
        result.references.push({ format, mime, fileName, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') })
        if (item.referenceFormat) await writeFile(path.join(outputDir, 'references', `both.${format}`), buffer)
      }
    } else headers['Content-Type'] = 'application/json'
    const response = await fetchImpl(`${BASE_URL}${endpoint}`, { method: 'POST', headers, body, signal: controller.signal })
    result.httpStatus = response.status
    result.requestId = sanitizeMessage(response.headers.get('x-request-id') || response.headers.get('request-id') || '', apiKey)
    const text = await response.text()
    let raw
    try { raw = JSON.parse(text) } catch {
      result.outcome = 'invalid_response'
      result.error = sanitizeMessage(`Non-JSON response (${text.length} characters)`, apiKey)
      return result
    }
    result.returnedFields = Object.keys(raw).map((key) => sanitizeMessage(key, apiKey))
    result.reported = Object.fromEntries(['output_format', 'size', 'quality', 'background', 'n', 'created'].filter((key) => raw[key] !== undefined).map((key) => [key, typeof raw[key] === 'number' ? raw[key] : sanitizeMessage(raw[key], apiKey)]))
    result.usage = numericUsage(raw.usage)
    if (!response.ok) {
      result.outcome = 'http_error'
      result.error = sanitizeMessage(raw.error?.message || raw.message || `HTTP ${response.status}`, apiKey)
      return result
    }
    const entries = Array.isArray(raw.data) ? raw.data : []
    result.outputCount = entries.length
    result.images = []
    for (const [index, output] of entries.entries()) {
      let buffer
      if (output.b64_json) buffer = Buffer.from(output.b64_json, 'base64')
      else if (output.url) {
        if (String(output.url).startsWith('data:')) buffer = Buffer.from(String(output.url).split(',')[1] || '', 'base64')
        else {
          const imageResponse = await fetchImpl(output.url, { signal: controller.signal })
          if (!imageResponse.ok) throw new Error(`Output image download failed: ${imageResponse.status}`)
          buffer = Buffer.from(await imageResponse.arrayBuffer())
        }
      } else continue
      const inspected = await inspectImage(buffer)
      const requestedDimensions = String(item.params.size || '').match(/^(\d+)x(\d+)$/)
      const requestedAspect = requestedDimensions ? Number(requestedDimensions[1]) / Number(requestedDimensions[2]) : null
      const actualAspect = inspected.width / inspected.height
      const relativeAspectError = requestedAspect ? Math.abs(actualAspect / requestedAspect - 1) : null
      const extension = ['png', 'jpeg', 'webp'].includes(inspected.sniffedFormat) ? inspected.sniffedFormat : 'bin'
      const file = `images/${item.id}-${index + 1}.${extension}`
      await writeFile(path.join(outputDir, file), buffer)
      result.images.push({ file, ...inspected, requestedAspect, actualAspect, relativeAspectError, aspectWithinOnePercent: relativeAspectError === null ? null : relativeAspectError <= 0.01, exactRequestedSize: requestedDimensions ? `${inspected.width}x${inspected.height}` === item.params.size : null })
    }
    result.outcome = result.images.length ? 'success' : 'no_image_output'
    return result
  } catch (error) {
    result.outcome = error.name === 'AbortError' ? 'timeout' : 'network_error'
    result.error = sanitizeMessage(error.message, apiKey)
    return result
  } finally {
    clearTimeout(timer)
    result.elapsedMs = Date.now() - startedAt
    result.completedAt = new Date().toISOString()
  }
}

export const runProbeCases = async (cases, { outputDir, apiKey, fetchImpl = fetch, log = console.log }) => {
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for live probes')
  await mkdir(path.join(outputDir, 'images'), { recursive: true })
  const manifest = await loadManifest(outputDir)
  const attempted = new Set(manifest.map((entry) => entry.id))
  const pending = cases.filter((item) => !attempted.has(item.id))
  const references = await ensureReferences(outputDir)
  let nextIndex = 0
  let completed = 0
  let transientStreak = 0
  let paused = false
  const journal = async (entry) => appendFile(path.join(outputDir, 'manifest.jsonl'), `${JSON.stringify(entry)}\n`)
  const worker = async () => {
    while (!paused && nextIndex < pending.length) {
      const item = pending[nextIndex++]
      await journal({ id: item.id, phase: 'started', startedAt: new Date().toISOString(), params: item.params, referenceCount: item.referenceCount || 0 })
      const result = await executeCase(item, { outputDir, apiKey, fetchImpl, references })
      await journal(result)
      completed += 1
      const transient = result.httpStatus === 429 || result.httpStatus >= 500 || ['network_error', 'timeout'].includes(result.outcome)
      transientStreak = transient ? transientStreak + 1 : 0
      if (transientStreak >= 3) paused = true
      log(JSON.stringify({ id: item.id, outcome: result.outcome, status: result.httpStatus, elapsedMs: result.elapsedMs, count: result.outputCount, reported: result.reported, actual: result.images?.map(({ format, width, height, hasAlpha, bytes }) => ({ format, width, height, hasAlpha, bytes })) }))
    }
  }
  await Promise.all([worker(), worker()])
  return { completed, skippedPreviouslyAttempted: cases.length - pending.length, remaining: pending.length - completed, paused }
}

const writeContactSheets = async (outputDir, records) => {
  const images = records.flatMap((record) => (record.images || []).map((image) => ({ ...image, id: record.id })))
  const sheetFiles = []
  for (let offset = 0; offset < images.length; offset += 16) {
    const batch = images.slice(offset, offset + 16)
    const composites = []
    for (const [index, item] of batch.entries()) {
      const left = index % 4 * 256
      const top = Math.floor(index / 4) * 220
      const thumbnail = await sharp(path.join(outputDir, item.file)).resize(244, 180, { fit: 'contain', background: '#dddddd' }).png().toBuffer()
      const label = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="32"><rect width="256" height="32" fill="white"/><text x="4" y="12" font-family="sans-serif" font-size="10">${item.id}</text><text x="4" y="26" font-family="sans-serif" font-size="10">${item.width}x${item.height} ${item.format} ${item.bytes} B</text></svg>`)).png().toBuffer()
      composites.push({ input: thumbnail, left: left + 6, top }, { input: label, left, top: top + 184 })
    }
    const filename = `contact-sheet-${String(offset / 16 + 1).padStart(2, '0')}.jpg`
    await sharp({ create: { width: 1024, height: Math.ceil(batch.length / 4) * 220, channels: 3, background: 'white' } }).composite(composites).jpeg({ quality: 85 }).toFile(path.join(outputDir, filename))
    sheetFiles.push(filename)
  }
  return sheetFiles
}

const preparePlan = async (outputDir) => {
  await mkdir(outputDir, { recursive: true })
  let snapshot
  try { snapshot = JSON.parse(await readFile(path.join(outputDir, 'size-matrix.snapshot.json'), 'utf8')) } catch (error) {
    if (error.code !== 'ENOENT') throw error
    snapshot = JSON.parse(await readFile(path.join(BACKEND, 'scripts/image-probe-size-matrix.snapshot.json'), 'utf8'))
    await writeFile(path.join(outputDir, 'size-matrix.snapshot.json'), JSON.stringify(snapshot, null, 2))
  }
  const plan = buildProbePlan(snapshot.sizes)
  await writeFile(path.join(outputDir, 'plan.json'), JSON.stringify({
    model: 'gpt-image-2', baseUrl: BASE_URL, concurrency: 2, timeoutMs: TIMEOUT_MS, maxPaidCases: plan.length,
    interpretation: 'The size snapshot records requested parameters, not guaranteed output. Metadata can be an echo. Actual bytes, dimensions, output count and alpha are measured. A failed network request is not evidence that a parameter is unsupported.',
    reference17: 'Local guard only; no paid request. Reference 16 uses red circles in images 1-15 and the blue square only in image 16.',
    cases: plan
  }, null, 2))
  return plan
}

const main = async () => {
  const args = process.argv.slice(2)
  if (args.some((arg) => !['--live', '--reference-formats'].includes(arg) && !arg.startsWith('--output-dir=') && !arg.startsWith('--cases='))) throw new Error('Unknown option; no requests were sent')
  const outputArg = args.find((arg) => arg.startsWith('--output-dir='))?.slice(13)
  const outputDir = path.resolve(outputArg || DEFAULT_OUTPUT)
  const plan = await preparePlan(outputDir)
  const activePlan = args.includes('--reference-formats') ? buildReferenceFormatPlan() : plan
  if (args.includes('--reference-formats')) await writeFile(path.join(outputDir, 'reference-formats-plan.json'), JSON.stringify(activePlan, null, 2))
  if (args.includes('--live')) {
    const envFile = dotenv.parse(await readFile(path.join(BACKEND, '.env.local')))
    const selectedIds = args.find((arg) => arg.startsWith('--cases='))?.slice(8).split(',')
    if (selectedIds?.some((id) => !activePlan.some((item) => item.id === id))) throw new Error('Unknown case id; no requests were sent')
    const cases = selectedIds ? [...new Set(selectedIds)].map((id) => activePlan.find((item) => item.id === id)) : activePlan
    console.log(JSON.stringify(await runProbeCases(cases, { outputDir, apiKey: envFile.OPENAI_API_KEY })))
  }
  const records = (await loadManifest(outputDir)).filter((entry) => entry.phase === 'completed')
  const contactSheets = await writeContactSheets(outputDir, records)
  const planned = plan.length + (records.some((record) => record.group === 'edit-format') ? 4 : 0)
  const summary = { planned, attempted: records.length, successful: records.filter((item) => item.outcome === 'success').length, contactSheets, outcomes: records.map((item) => ({ id: item.id, outcome: item.outcome, status: item.httpStatus, reported: item.reported, outputCount: item.outputCount, images: item.images })) }
  await writeFile(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify({ outputDir, planned: summary.planned, attempted: summary.attempted, successful: summary.successful, contactSheets }))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(sanitizeMessage(error.message))
  process.exitCode = 1
})
