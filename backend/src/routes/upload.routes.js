import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { authRequired } from '../middleware/auth.js'
import { createSignedUpload, uploadFile, uploadRemoteFile } from '../services/upload.service.js'
import { HttpError, asyncHandler } from '../utils/http.js'

const MAX_UPLOAD_SIZE_BYTES = 150 * 1024 * 1024

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES
  }
})

export const uploadRouter = Router()

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
  res.json(result)
}))

const remoteUploadSchema = z.object({
  url: z.string().url(),
  fileName: z.string().max(180).optional()
})

const signedUploadSchema = z.object({
  fileName: z.string().min(1).max(180),
  fileType: z.string().min(1).max(180).optional()
})

uploadRouter.post('/remote', authRequired, asyncHandler(async (req, res) => {
  const payload = remoteUploadSchema.parse(req.body || {})
  const result = await uploadRemoteFile(payload)
  res.json(result)
}))

uploadRouter.post('/signed', authRequired, asyncHandler(async (req, res) => {
  const payload = signedUploadSchema.parse(req.body || {})
  const result = await createSignedUpload({
    originalName: payload.fileName,
    mimetype: payload.fileType || 'application/octet-stream'
  })
  res.json(result)
}))
