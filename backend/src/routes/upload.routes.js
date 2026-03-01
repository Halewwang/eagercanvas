import { Router } from 'express'
import multer from 'multer'
import { authRequired } from '../middleware/auth.js'
import { uploadFile } from '../services/upload.service.js'
import { asyncHandler } from '../utils/http.js'

const upload = multer({ storage: multer.memoryStorage() })

export const uploadRouter = Router()

uploadRouter.post('/', authRequired, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' })
  }
  
  const result = await uploadFile(req.file)
  res.json(result)
}))
