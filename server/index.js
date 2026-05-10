import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initDatabase } from './db.js'
import logger from './logger.js'

import { addClient } from './sse.js'
import jwt from 'jsonwebtoken'
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key'

// Import Routes
import authRoutes from './routes/auth.js'
import tasksRoutes from './routes/tasks.js'
import usersRoutes from './routes/users.js'
import messagesRoutes from './routes/messages.js'
import adminRoutes from './routes/admin.js'

import { authLimiter } from './config.js'

dotenv.config()

const app = express()
app.set('trust proxy', 1)
const port = Number(process.env.PORT || 4000)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}))
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ limit: '5mb', extended: true }))
app.use(cookieParser())

// SSE Endpoint
app.get('/api/sse/stream', (req, res) => {
  const token = req.query.token || req.cookies?.gh_token
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const userId = decoded.id

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    addClient(userId, res)
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
})

// Mount modular routes with prefixes
app.use('/api/auth', authRoutes)
app.use('/api/tasks', tasksRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/messages', messagesRoutes)
app.use('/api/admin', adminRoutes)

// Fallback mountings for legacy/non-prefixed paths used by the frontend
app.use('/api', authRoutes)     // For /me
app.use('/api', tasksRoutes)    // For /tasks, /categories
app.use('/api', usersRoutes)    // For /home/summary
app.use('/api', messagesRoutes) // For /notifications
app.use('/api', adminRoutes)    // For /public/stats

app.use((error, _req, res, _next) => {
  logger.error('API Error:', error.message)
  res.status(500).json({ message: 'An internal server error occurred.' })
})

async function startServer(retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      logger.info(`Starting server (Attempt ${i + 1}/${retries})...`)
      await initDatabase()
      app.listen(port, '0.0.0.0', () => {
        logger.info(`GawaHelper API running on port ${port}`)
      })
      return // Success!
    } catch (error) {
      logger.error(`Attempt ${i + 1} failed: ${error.message}`)
      if (i === retries - 1) {
        logger.error('All connection attempts failed. Exiting.')
        process.exit(1)
      }
      logger.info('Retrying in 5 seconds...')
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }
}

startServer()
