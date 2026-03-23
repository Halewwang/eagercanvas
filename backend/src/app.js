import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import { randomUUID } from 'crypto'
import { apiRouter } from './routes/index.js'
import { env } from './config/env.js'
import { errorMiddleware } from './middleware/error.js'
import { rateLimit } from './middleware/rate-limit.js'

export const app = express()

const buildAllowedOrigins = () => {
  const allowList = new Set(env.frontendOrigins || [env.frontendOrigin])
  for (const origin of [...allowList]) {
    try {
      const url = new URL(origin)
      if (url.hostname.startsWith('www.')) {
        const noWww = `${url.protocol}//${url.hostname.replace(/^www\./, '')}${url.port ? `:${url.port}` : ''}`
        allowList.add(noWww)
      } else if (!url.hostname.startsWith('localhost')) {
        const withWww = `${url.protocol}//www.${url.hostname}${url.port ? `:${url.port}` : ''}`
        allowList.add(withWww)
      }
    } catch {
      // Ignore invalid origins from env
    }
  }
  return allowList
}

const allowedOrigins = buildAllowedOrigins()

app.use(helmet())
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server and same-origin requests without Origin header.
    if (!origin) return callback(null, true)
    const isVercelPreview = /\.vercel\.app$/i.test(origin)
    if (allowedOrigins.has(origin) || isVercelPreview) {
      return callback(null, true)
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`))
  },
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || randomUUID()
  req.requestId = String(requestId)
  res.setHeader('x-request-id', req.requestId)
  next()
})
app.use((req, res, next) => {
  if (!env.requestLogEnabled) return next()

  const startedAt = Date.now()
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt
    const shouldLog = res.statusCode >= 400 || durationMs >= env.requestLogSlowMs
    if (!shouldLog) return

    console.log('[api:request]', JSON.stringify({
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl || req.path,
      status: res.statusCode,
      durationMs,
      routeGroup: req.rateLimitRouteGroup || 'unknown',
      userId: req.user?.id || null
    }))
  })
  next()
})
app.use(rateLimit)

app.use('/api/v1', apiRouter)

app.use(errorMiddleware)
