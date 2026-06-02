import { env } from '../../config/env.js'
import { HttpError } from '../../utils/http.js'
import sharp from 'sharp'
import { buildGptImage2RequestBody } from '../gpt-image-2-size.js'
import { DelegatingProviderAdapter } from './delegating.adapter.js'
import { buildProviderUrl } from './http-client.js'
import { normalizeImageResponse } from './image-response.js'
import { extensionFromMimeType, fetchBinaryFromSource } from './media-source.js'

const DEFAULT_DEROUTER_BASE_URL = 'https://api-direct.derouter.ai/openai/v1'
const DEFAULT_DEROUTER_TIMEOUT_MS = 300000
const DEROUTER_REFERENCE_MAX_BYTES = 4 * 1024 * 1024
const DEROUTER_REFERENCE_OPTIMIZATION_ATTEMPTS = [
  { maxEdge: 1536, quality: 82 },
  { maxEdge: 1280, quality: 76 },
  { maxEdge: 1024, quality: 70 }
]

const pickFirstImageInput = (payload = {}) => {
  if (typeof payload.image === 'string') return payload.image
  if (Array.isArray(payload.image) && payload.image.length > 0) return payload.image[0]
  if (Array.isArray(payload.images) && payload.images.length > 0) return payload.images[0]
  if (typeof payload.first_frame_image === 'string') return payload.first_frame_image
  if (typeof payload.image_url === 'string') return payload.image_url
  return ''
}

const getDerouterInputImages = (payload = {}) => {
  const inputImages = Array.isArray(payload.images)
    ? payload.images.filter(Boolean)
    : []
  const firstImage = pickFirstImageInput(payload)
  if (!inputImages.length && firstImage) {
    inputImages.push(firstImage)
  }
  return inputImages
}

const resolveDerouterBaseUrl = (requestOptions = {}) =>
  String(requestOptions?.derouterApiBaseUrl || env.derouterApiBaseUrl || DEFAULT_DEROUTER_BASE_URL).trim()

const resolveDerouterApiKey = (requestOptions = {}) =>
  String(requestOptions?.derouterApiKey || env.derouterApiKey || '').trim()

const resolveDerouterTimeoutMs = (requestOptions = {}) =>
  Number(requestOptions?.derouterTimeoutMs || requestOptions?.timeoutMs || env.derouterTimeoutMs || DEFAULT_DEROUTER_TIMEOUT_MS)

const buildDerouterHeaders = (requestOptions = {}, extra = {}) => {
  const apiKey = resolveDerouterApiKey(requestOptions)
  if (!apiKey) {
    throw new HttpError(500, 'DEROUTER_API_KEY is not configured', 'DEROUTER_NOT_CONFIGURED')
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    ...extra
  }
}

const parseDerouterResponse = async (response) => {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

const extractDerouterErrorMessage = (data, status) => {
  if (status === 413) {
    return 'Derouter request is too large. Please use a smaller reference image or fewer reference images.'
  }

  const candidates = [
    data?.error?.message,
    data?.message,
    data?.msg,
    data?.error_msg,
    data?.raw
  ]
  const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
  const message = found ? String(found).trim() : ''
  if (/^\s*</.test(message)) {
    return `Derouter request failed: ${status}`
  }
  return message || `Derouter request failed: ${status}`
}

const callDerouter = async (path, body, { multipart = false } = {}, requestOptions = {}) => {
  const baseUrl = resolveDerouterBaseUrl(requestOptions)
  if (!baseUrl) {
    throw new HttpError(500, 'DEROUTER_API_BASE_URL is not configured', 'DEROUTER_NOT_CONFIGURED')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), resolveDerouterTimeoutMs(requestOptions))
  try {
    const response = await fetch(buildProviderUrl(baseUrl, path), {
      method: 'POST',
      headers: buildDerouterHeaders(
        requestOptions,
        multipart ? {} : { 'Content-Type': 'application/json' }
      ),
      body: multipart ? body : JSON.stringify(body),
      signal: controller.signal
    })
    const data = await parseDerouterResponse(response)

    if (!response.ok) {
      throw new HttpError(response.status, extractDerouterErrorMessage(data, response.status), 'DEROUTER_ERROR')
    }

    return data || {}
  } finally {
    clearTimeout(timer)
  }
}

const mimeTypeFromOutputFormat = (value = '') => {
  const safe = String(value || '').trim().toLowerCase()
  if (safe === 'jpeg' || safe === 'jpg') return 'image/jpeg'
  if (safe === 'webp') return 'image/webp'
  return 'image/png'
}

const normalizeDerouterImageResponse = (raw = {}, body = {}) => {
  const mimeType = mimeTypeFromOutputFormat(body.output_format)
  const urls = []
  const pushB64 = (value) => {
    const b64 = String(value || '').replace(/\s+/g, '')
    if (b64) urls.push(`data:${mimeType};base64,${b64}`)
  }

  if (Array.isArray(raw?.data)) {
    for (const item of raw.data) {
      if (item?.b64_json || item?.base64 || item?.image_base64) {
        pushB64(item.b64_json || item.base64 || item.image_base64)
      }
    }
  }
  if (raw?.b64_json || raw?.base64 || raw?.image_base64) {
    pushB64(raw.b64_json || raw.base64 || raw.image_base64)
  }

  const responseForNormalization = Array.isArray(raw?.data)
    ? {
        ...raw,
        data: raw.data.map((item) => (
          item && typeof item === 'object' && !Array.isArray(item)
            ? { ...item, mime_type: item.mime_type || item.mimeType || mimeType }
            : item
        ))
      }
    : (raw?.b64_json ? { data: [{ b64_json: raw.b64_json, mime_type: mimeType }] } : raw)

  const normalized = normalizeImageResponse(responseForNormalization)
  const normalizedUrls = Array.isArray(normalized.data)
    ? normalized.data.map((item) => String(item?.url || '').trim()).filter(Boolean)
    : []
  const data = [...new Set([...urls, ...normalizedUrls])].map((url) => ({ url }))

  if (data.length === 0) {
    throw new HttpError(502, 'No image output from derouter', 'NO_IMAGE_OUTPUT')
  }

  return {
    ...normalized,
    data,
    provider: 'derouter',
    raw
  }
}

export const buildDerouterImageRequestBody = (payload = {}) => {
  const body = buildGptImage2RequestBody(payload)
  return {
    ...body,
    model: 'gpt-image-2'
  }
}

const appendDerouterMultipartImages = async (formData, images = []) => {
  for (let index = 0; index < images.length; index += 1) {
    const source = String(images[index] || '').trim()
    if (!source) continue

    const image = await prepareDerouterReferenceImage(await fetchBinaryFromSource(source))
    const fileName = `image-${index + 1}.${extensionFromMimeType(image.mimeType)}`
    const blob = new Blob([image.buffer], { type: image.mimeType || 'image/jpeg' })
    formData.append('image', blob, fileName)
  }
}

const prepareDerouterReferenceImage = async ({ mimeType = 'image/png', buffer } = {}) => {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength === 0) {
    throw new HttpError(400, 'Reference image is empty', 'DEROUTER_REFERENCE_IMAGE_EMPTY')
  }
  if (buffer.byteLength <= DEROUTER_REFERENCE_MAX_BYTES) {
    return { mimeType, buffer }
  }

  let lastSize = buffer.byteLength
  try {
    for (const attempt of DEROUTER_REFERENCE_OPTIMIZATION_ATTEMPTS) {
      const optimized = await sharp(buffer, { limitInputPixels: false })
        .rotate()
        .resize({
          width: attempt.maxEdge,
          height: attempt.maxEdge,
          fit: 'inside',
          withoutEnlargement: true
        })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: attempt.quality, mozjpeg: true })
        .toBuffer()

      lastSize = optimized.byteLength
      if (optimized.byteLength <= DEROUTER_REFERENCE_MAX_BYTES) {
        return {
          mimeType: 'image/jpeg',
          buffer: optimized
        }
      }
    }
  } catch (error) {
    throw new HttpError(400, 'Reference image could not be prepared for derouter upload', 'DEROUTER_REFERENCE_IMAGE_INVALID')
  }

  throw new HttpError(
    400,
    `Reference image is too large for derouter after optimization (${lastSize} bytes)`,
    'DEROUTER_REFERENCE_IMAGE_TOO_LARGE'
  )
}

export const createDerouterImage = async (payload = {}, requestOptions = {}) => {
  const body = buildDerouterImageRequestBody(payload)
  const inputImages = getDerouterInputImages(payload)

  if (inputImages.length > 0) {
    const formData = new FormData()
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        formData.append(key, String(value))
      }
    }
    await appendDerouterMultipartImages(formData, inputImages.slice(0, 16))
    const raw = await callDerouter('/images/edits', formData, { multipart: true }, requestOptions)
    return normalizeDerouterImageResponse(raw, body)
  }

  const raw = await callDerouter('/images/generations', body, {}, requestOptions)
  return normalizeDerouterImageResponse(raw, body)
}

export class DerouterProviderAdapter extends DelegatingProviderAdapter {
  constructor(operations = {}) {
    super({
      imageGeneration: createDerouterImage,
      ...operations
    })
  }
}
