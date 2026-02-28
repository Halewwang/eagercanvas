import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import { apiRouter } from './routes/index.js'
import { env } from './config/env.js'
import { errorMiddleware } from './middleware/error.js'
import { rateLimit } from './middleware/rate-limit.js'

export const app = express()

app.use(helmet())
app.use(cors({
  origin: env.frontendOrigin,
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())
app.use(rateLimit)

app.use('/api/v1', apiRouter)

app.use(errorMiddleware)
