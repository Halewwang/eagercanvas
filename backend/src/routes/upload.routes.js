import { Router } from 'express'
import path from 'path'
import multer from 'multer'
import { z } from 'zod'
import { authRequired } from '../middleware/auth.js'
import { recordUploadedMediaAsset } from '../services/media-library.service.js'
import { createSignedUpload, fetchRemoteAsset, uploadFile, uploadRemoteFile } from '../services/upload.service.js'
import { HttpError, asyncHandler } from '../utils/http.js'

const MAX_UPLOAD_SIZE_BYTES = 150 * 1024 * 1024

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES
  }
})

const optionalProjectIdSchema = z.string().uuid().optional().nullable()

export const uploadRouter = Router()

const authRequiredWithQueryToken = (req, res, next) => {
  const queryToken = String(req.query?.access_token || '').trim()
  if (!req.headers.authorization && queryToken) {
    req.headers.authorization = `Bearer ${queryToken}`
  }
  return authRequired(req, res, next)
}

uploadRouter.post('/', authRequired, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return next(new HttpError(400, `Upload error: ${err.message}`, 'UPLOAD_BAD_REQUEST'))
    }
    if (err) {
      return next(new HttpError(500, `Unknown upload error: ${err.message}`, 'UPLOAD_UNKNOWN_ERROR'))
    }
    next()
  })
}, asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new HttpError(400, 'No file uploaded', 'UPLOAD_FILE_MISSING')
  }

  const result = await uploadFile(req.file)
  const projectId = optionalProjectIdSchema.safeParse(req.body?.projectId).success
    ? req.body?.projectId
    : undefined

  await recordUploadedMediaAsset({
    userId: req.user.id,
    projectId,
    url: result?.url,
    fileName: req.file.originalname,
    fileType: req.file.mimetype,
    sizeBytes: req.file.size,
    origin: 'upload',
    source: req.body?.source,
    sourceNodeId: req.body?.sourceNodeId
  })
  res.json(result)
}))

const remoteUploadSchema = z.object({
  url: z.string().url(),
  fileName: z.string().max(180).optional(),
  projectId: z.string().uuid().optional(),
  source: z.string().max(120).optional(),
  sourceNodeId: z.string().max(120).optional()
})

const remoteProxySchema = z.object({
  url: z.string().url(),
  access_token: z.string().min(1).optional()
})

const signedUploadSchema = z.object({
  fileName: z.string().min(1).max(180),
  fileType: z.string().min(1).max(180).optional()
})

uploadRouter.post('/remote', authRequired, asyncHandler(async (req, res) => {
  const payload = remoteUploadSchema.parse(req.body || {})
  const result = await uploadRemoteFile(payload)
  await recordUploadedMediaAsset({
    userId: req.user.id,
    projectId: payload.projectId,
    url: result?.url,
    fileName: payload.fileName || path.basename(new URL(payload.url).pathname || ''),
    origin: 'remote_upload',
    source: payload.source,
    sourceNodeId: payload.sourceNodeId
  })
  res.json(result)
}))

uploadRouter.get('/proxy', authRequiredWithQueryToken, asyncHandler(async (req, res) => {
  const payload = remoteProxySchema.parse(req.query || {})
  const asset = await fetchRemoteAsset({ url: payload.url })
  res.setHeader('Content-Type', asset.contentType || 'application/octet-stream')
  res.setHeader('Content-Length', String(asset.contentLength || asset.buffer?.byteLength || 0))
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.send(asset.buffer)
}))

uploadRouter.post('/signed', authRequired, asyncHandler(async (req, res) => {
  const payload = signedUploadSchema.parse(req.body || {})
  const result = await createSignedUpload({
    originalName: payload.fileName,
    mimetype: payload.fileType || 'application/octet-stream'
  })
  res.json(result)
}))
