import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { initUsbService } from './services/usbService'
import { scanMusicFiles, getCachedTracks } from './services/adbService'
import streamRouter from './routes/stream'

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

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })

  socket.on('scan:request', () => {
    console.log('Scan requested by client')
    scanMusicFiles(io)
  })
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'MusicBridge server running' })
})

app.use('/stream', streamRouter)

// Returns cached tracks so the client can restore the list on page refresh
app.get('/tracks', (_req, res) => {
  res.json(getCachedTracks())
})

initUsbService(io)

httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})