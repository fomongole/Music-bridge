// packages/server/src/index.ts

import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { initUsbService } from './services/usbService'

const app = express()
const httpServer = createServer(app)
const PORT = 3001

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
}))

app.use(express.json())

const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  }
})

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Send current device status immediately when client connects
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'MusicBridge server running' })
})

initUsbService(io)

httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})