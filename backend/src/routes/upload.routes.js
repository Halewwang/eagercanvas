import { Router } from 'express'
import multer from 'multer'
import { authRequired } from '../middleware/auth.js'
import { uploadFile } from '../services/upload.service.js'
import { asyncHandler } from '../utils/http.js'

const upload = multer({ storage: multer.memoryStorage() })

export const uploadRouter = Router()

uploadRouter.post('/', authRequired, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Upload error: ${err.message}` })
    } else if (err) {
      return res.status(500).json({ message: `Unknown error: ${err.message}` })
    }
    next()
  })
}, asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' })
  }
  
  try {
    const result = await uploadFile(req.file)
    res.json(result)
  } catch (error) {
    console.error('Upload service error:', error)
    throw error // Let error middleware handle it
  }
}))
