import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { initUsbService } from './services/usbService'
import { scanMusicFiles, getCachedTracks } from './services/adbService'
import streamRouter from './routes/stream'
import playlistRouter from './routes/playlists'

const app = express()
const httpServer = createServer(app)

const PORT = process.env.PORT || 3001

app.use(cors({
  origin: '*', // Allows Vite dev server AND Electron production protocols
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}))

app.use(express.json())

const io = new Server(httpServer, {
  cors: {
    origin: '*',
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

app.get('/tracks', (_req, res) => {
  res.json(getCachedTracks())
})

// Mount your routers
app.use('/stream', streamRouter)
app.use('/playlists', playlistRouter)

initUsbService(io)

httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})