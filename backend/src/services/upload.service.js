import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'

const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey)
const BUCKET_NAME = 'uploads'
let bucketReady = false
const UPLOAD_FILE_SIZE_LIMIT_BYTES = 150 * 1024 * 1024
const REMOTE_FETCH_MAX_BYTES = UPLOAD_FILE_SIZE_LIMIT_BYTES

const contentTypeToExtension = (contentType = '') => {
  const safe = String(contentType || '').split(';')[0].trim().toLowerCase()
  const mapping = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov'
  }
  return mapping[safe] || ''
}

const sanitizeOriginalName = (value = '', fallbackName = 'asset') => {
  const base = String(value || '').trim() || fallbackName
  return base.replace(/[^a-zA-Z0-9._-]/g, '_')
}

const buildStoredFileName = (originalName = '') => `${Date.now()}-${sanitizeOriginalName(originalName)}`

const isPrivateIpv4 = (host) => {
  const parts = String(host || '').split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  )
}

const assertAllowedRemoteUrl = (rawUrl) => {
  let parsed
  try {
    parsed = new URL(String(rawUrl || '').trim())
  } catch {
    throw new HttpError(400, 'Remote asset URL is invalid', 'UPLOAD_REMOTE_URL_INVALID')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new HttpError(400, 'Only http/https remote asset URLs are supported', 'UPLOAD_REMOTE_URL_INVALID')
  }

  const host = String(parsed.hostname || '').trim().toLowerCase()
  if (!host || host === 'localhost' || host === '::1' || host.endsWith('.local') || isPrivateIpv4(host)) {
    throw new HttpError(400, 'Remote asset host is not allowed', 'UPLOAD_REMOTE_URL_BLOCKED')
  }

  return parsed
}

const ensureBucket = async () => {
  if (bucketReady) return

  const { data: bucket, error: getErr } = await supabase.storage.getBucket(BUCKET_NAME)
  if (!getErr && bucket) {
    const { error: updateErr } = await supabase.storage.updateBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: UPLOAD_FILE_SIZE_LIMIT_BYTES
    })
    if (updateErr) {
      throw updateErr
    }
    bucketReady = true
    return
  }

  const { error: createErr } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: UPLOAD_FILE_SIZE_LIMIT_BYTES
  })

  if (createErr && !/already exists/i.test(createErr.message || '')) {
    throw createErr
  }
  bucketReady = true
}

const uploadToBucket = async (fileName, file) => {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    })
  return error
}

const getPublicUrl = (fileName) => {
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName)
  return publicUrl
}

const uploadBufferFile = async ({ originalName, buffer, mimetype }) => {
  const fileName = buildStoredFileName(originalName)

  try {
    await ensureBucket()
  } catch (error) {
    console.error('Supabase bucket check/create error:', error)
    throw new HttpError(500, 'File upload failed', 'UPLOAD_ERROR')
  }

  let error = await uploadToBucket(fileName, { buffer, mimetype })
  if (error && /bucket/i.test(error.message || '')) {
    try {
      bucketReady = false
      await ensureBucket()
      error = await uploadToBucket(fileName, { buffer, mimetype })
    } catch (retryErr) {
      error = retryErr
    }
  }

  if (error) {
    console.error('Supabase upload error:', error)
    throw new HttpError(500, 'File upload failed', 'UPLOAD_ERROR')
  }

  return { url: getPublicUrl(fileName) }
}

export const uploadFile = async (file) => {
  return uploadBufferFile({
    originalName: file.originalname,
    buffer: file.buffer,
    mimetype: file.mimetype
  })
}

export const uploadRemoteFile = async ({ url, fileName = '' }) => {
  const parsed = assertAllowedRemoteUrl(url)
  const response = await fetch(parsed.toString())
  if (!response.ok) {
    throw new HttpError(response.status || 502, 'Remote asset fetch failed', 'UPLOAD_REMOTE_FETCH_FAILED')
  }

  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > REMOTE_FETCH_MAX_BYTES) {
    throw new HttpError(400, 'Remote asset is too large', 'UPLOAD_REMOTE_TOO_LARGE')
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > REMOTE_FETCH_MAX_BYTES) {
    throw new HttpError(400, 'Remote asset is too large', 'UPLOAD_REMOTE_TOO_LARGE')
  }

  const contentType = String(response.headers.get('content-type') || 'application/octet-stream').trim()
  const derivedName = fileName
    || path.basename(parsed.pathname || '') 
    || `asset${contentTypeToExtension(contentType)}`
  const safeName = sanitizeOriginalName(
    path.extname(derivedName) ? derivedName : `${derivedName}${contentTypeToExtension(contentType)}`,
    `asset${contentTypeToExtension(contentType)}`
  )

  return uploadBufferFile({
    originalName: safeName,
    buffer,
    mimetype: contentType
  })
}

export const fetchRemoteAsset = async ({ url }) => {
  const parsed = assertAllowedRemoteUrl(url)
  const response = await fetch(parsed.toString())
  if (!response.ok) {
    throw new HttpError(response.status || 502, 'Remote asset fetch failed', 'UPLOAD_REMOTE_FETCH_FAILED')
  }

  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > REMOTE_FETCH_MAX_BYTES) {
    throw new HttpError(400, 'Remote asset is too large', 'UPLOAD_REMOTE_TOO_LARGE')
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > REMOTE_FETCH_MAX_BYTES) {
    throw new HttpError(400, 'Remote asset is too large', 'UPLOAD_REMOTE_TOO_LARGE')
  }

  return {
    buffer,
    contentType: String(response.headers.get('content-type') || 'application/octet-stream').trim(),
    contentLength: buffer.byteLength
  }
}

export const createSignedUpload = async ({ originalName = '', mimetype = '' }) => {
  const safeName = sanitizeOriginalName(
    path.extname(originalName)
      ? originalName
      : `${originalName || 'asset'}${contentTypeToExtension(mimetype)}`,
    `asset${contentTypeToExtension(mimetype)}`
  )
  const fileName = buildStoredFileName(safeName)

  try {
    await ensureBucket()
  } catch (error) {
    console.error('Supabase bucket check/create error:', error)
    throw new HttpError(500, 'Upload initialization failed', 'UPLOAD_SIGN_INIT_FAILED')
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUploadUrl(fileName)

  if (error || !data?.signedUrl || !data?.token || !data?.path) {
    console.error('Supabase signed upload error:', error)
    throw new HttpError(500, 'Upload initialization failed', 'UPLOAD_SIGN_FAILED')
  }

  return {
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    url: getPublicUrl(fileName)
  }
}
